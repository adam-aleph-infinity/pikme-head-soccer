// Bot opponent. Produces the same {left,right,jump,kick,power} an input device produces,
// so the sim can't tell a bot from a human — and a human can drop into slot 1 later.
//
// Difficulty is one dial (0..5), a row of DIFFICULTIES (or an arcade champion's profile placed
// anywhere between them). Since Phase E the bot plays like the Head Soccer CPU off Idan's footage
// (docs/hs-estimates.json cpu.*; `node _cpu.mjs`): it meets the ball, jumps a lot, mashes the boot
// near the ball, dashes, stands on heads, and answers every power-shot family. The dials decide
// how fast and how well it reads the flight (react, error), how often it takes the chance it sees
// (skill, read off `aim`), how far it presses (aggression), and how it plays the power (counter,
// powerHold). The whole ladder is monotonic: every tier beats every lower tier on average.

import * as C from './constants.js';
import { bootReach } from './kick.js';
import { headY } from './sim.js';
import { stepPower, launch as launchPower, FAMILIES } from './hs-powers.js';
// Where the boot passes on its swing, [ahead, up] from the feet (the CPU's reach test).
const BOOT_POINTS = bootReach();
// CPU habits fitted to HS (test-hs-parity cpu.* rows, _cpu probe): per 0.25 s roll while it has
// somewhere to be, and the chance a close ball in front gets the boot mashed at it.
const DASH_BASE = 0.03, DASH_SKILL = 0.55, HOP = 0.075, MASH_SKILL = 0.12, LAZY = 0.15, KICK_GO = 0.2;

// `aggression` is flat across the tiers: it is how often a bot chases a ball the other player is
// nearer to, and it was measured three times over (on the old physics) to be the one dial that
// inverts the ladder if it moves with skill. Phase E adds to it with skill (openPlay, `press`),
// but only a little — the tiers are separated by reading, timing and taking chances.
export const DIFFICULTIES = [
  { name: 'קל מאוד',  react: 0.34, error: 78, counter: 0.02, aggression: 0.38, aim: 0.35, powerHold: 2.2 },
  { name: 'קל',       react: 0.26, error: 58, counter: 0.08, aggression: 0.38, aim: 0.50, powerHold: 1.6 },
  { name: 'בינוני',   react: 0.19, error: 40, counter: 0.18, aggression: 0.38, aim: 0.64, powerHold: 1.1 },
  { name: 'קשה',      react: 0.13, error: 26, counter: 0.32, aggression: 0.38, aim: 0.78, powerHold: 0.7 },
  { name: 'קשה מאוד', react: 0.08, error: 15, counter: 0.48, aggression: 0.38, aim: 0.90, powerHold: 0.4 },
  { name: 'אגדי',     react: 0.04, error: 7,  counter: 0.66, aggression: 0.38, aim: 0.98, powerHold: 0.2 },
];
// HOW LONG A FULL GAUGE SITS BEFORE THE BOT ARMS IT. `powerHold` was compared with bot.t, the
// bot's lifetime clock, which passes 2.2s two seconds into its first match — so every tier armed
// the tick its gauge filled and fired at the first touch after: 2.4–2.8s from full to cut-in
// (median, level 3), 4.5 power shots a match from one bot. The HS CPU in M4 (weakest tier) fires
// 5.2, 6.8, 5.2, 10.5, 14.7 and 8.3s after its gauge fills (mean 8.5s: kickoff/cut-in times in
// docs/hs-estimates.json against the measured 15.0s fill and 13.0s refill), about 3 a match.
// Every one of those cut-ins is a 1.34s freeze of the whole game, so an eager bot is felt as a
// game that keeps stopping. The hold is now time spent FULL, and the tiers keep their order.
const FULL_HOLD = 2.5;               // s, added to each tier's powerHold (0.2–2.2s)
// `profile` is an arcade champion's bot (shared/champions.js botProfile): the same dials as a
// DIFFICULTIES row, placed anywhere on the line between them, plus how the champion plays its
// own power. Without one, a bot is exactly the tier `level` names, as it always was.
export function createBot(level = 2, rng = Math.random, profile = null) {
  const d = profile || DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, level))];
  return {
    level, d, rng,
    t: 0, nextThink: 0,
    aim: C.W / 2,          // the x it is currently walking to (re-picked on each think)
    wantJump: false, wantKick: false,
    counterArmed: false, powerPlan: null,
    holdJump: 0,           // frames of jump still held — jump height is variable here
    out: { left: false, right: false, jump: false, kick: false, power: false },
  };
}

// WHEN A CHAMPION ARMS. The trigger is still the touch; this only decides whether now is the
// moment its power was made for — a shot with the goal ahead, a wall with the ball coming home.
// Weak arcade bots (and every non-arcade bot) skip the question and arm the moment they can.
function armMoment(d, p, b) {
  if (!d.arm || !d.smart) return true;
  const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
  const depth = (b.x - myGoalX) * p.side;           // 0 at my own line
  if (d.arm === 'attack') return depth > C.W * 0.4 && (b.x - p.x) * p.side > -60;
  if (d.arm === 'defend') return depth < C.W * 0.5;
  return true;
}

export function botInput(bot, m, index, dt) {
  const out = botInputRaw(bot, m, index, dt);
  // A bot that has had its own controls reversed on it (the `reverse` ailment, ???). The sim swaps
  // them after the bot has chosen, so an able bot chooses the other way round; a weak one runs the
  // wrong way, the same as a person does.
  const p = m.players[index];
  if ((bot.d.adapt ?? skillOf(bot.d) >= 0.6) && p.ail === 'reverse') {
    const l = out.left; out.left = out.right; out.right = l;
  }
  return out;
}

function botInputRaw(bot, m, index, dt) {
  const p = m.players[index];
  const foe = m.players[1 - index];
  const b = m.ball;
  const out = bot.out;
  const d = bot.d;
  bot.t += dt;
  // How long the gauge has sat FULL and unarmed, on the wall clock (the bot runs through every
  // pause). What `powerHold` was always meant to gate — see FULL_HOLD.
  bot.fullT = p.gauge >= 1 && p.armed <= 0 ? (bot.fullT || 0) + dt : 0;

  // Stunned is the only state that takes the controls away now — `knocked` is gone with the
  // rest of the signature effects. Pressing buttons at a stunned player does nothing anyway;
  // letting go of them keeps the bot's edge-triggered moves from all firing on the frame it
  // gets back up.
  // …and so do the ailments that take every control (hs-powers ailMods: frozen in ice, or the
  // three stars of a daze or a knockout): the sim ignores the buttons anyway.
  if (p.stunned > 0 || m.phase === 'over' || p.ail === 'freeze' || p.ail === 'stars') {
    out.left = out.right = out.jump = out.kick = out.power = false;
    bot.lastKick = false; bot.lastJump = false;
    return out;
  }

  // ---- the opponent is ARMED: the glow is the telegraph ----------------------
  //
  // An armed opponent is waiting for a touch of the ball; the shot goes where its FAMILY flies
  // from wherever that touch happens. Three answers, all generic (no family or champion is
  // named here):
  //   * ARM TOO, when the gauge is full: an armed defender's touch of the shot is the counter
  //     (§4), and it is the only answer to a shot a boot cannot stop (FAMILIES[fam].block —
  //     a Ground shot passes through a block, a strong Destructive or a Critical smashes it).
  //   * a boot CAN stop it: stand in its path. The path is the family's own flight, run
  //     forward from the ball as it is now (launch + stepPower on copies — see foeShotPath):
  //     flat at the ball's height, down onto the grass, up and out and diving at the mouth…
  //     and the spot is where that path crosses a height a body can meet, nearest to me.
  //   * or DENY THE TOUCH — get to the ball first and boot it away — which answers every
  //     family, and is what is left when the boot cannot stop the shot and the gauge is empty.
  // Whether it reads the glow at all, and how well, is the skill axis (re-decided a few times a
  // second, not flipped every tick).
  if (foe.armed > 0 && !b.power) {
    if (bot.t >= (bot.foeArmT ?? 0)) {
      bot.foeArmT = bot.t + 0.3;
      const s = skillOf(d);
      bot.readsGlow = bot.rng() < 0.35 + 0.6 * s;
      bot.shieldArm = p.gauge >= 1 && p.armed <= 0 && bot.rng() < 0.2 + 0.7 * s;
      const F = FAMILIES[foe.shot?.family] || FAMILIES.straight;
      bot.bootStops = F.block === 'grind' || F.block === 'grab' || (F.block === 'smash' && (foe.shot?.intensity ?? 0.5) < 0.4);
      bot.foeSpot = null;
      if (bot.readsGlow && (bot.bootStops || p.armed > 0)) {
        const path = foeShotPath(m, b, foe);
        const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
        // Where it passes at a height a standing body meets (no timing needed), else where a
        // jump reaches — as far as a stride inside my own goal mouth, where a dive ends.
        const crown = headY(p) - C.HEAD_R;
        const pick = (hi) => {
          let best = null;
          for (const q of path) {
            if (q.hidden || q.y < hi || q.y > C.GROUND_Y) continue;
            if ((q.x - myGoalX) * p.side < -30) break;
            const cost = Math.abs(q.x - p.x);
            if (!best || cost < best.cost) best = { x: q.x, cost };
          }
          return best;
        };
        const best = pick(crown - C.BALL_R * 0.5) || pick(crown - JUMP_APEX() - C.BALL_R);
        bot.foeSpot = best ? best.x : null;
      }
    }
    if (bot.readsGlow) {
      const adx = Math.abs(b.x - p.x);
      const iAmFirst = adx + 40 < Math.abs(b.x - foe.x);
      // Deny when I will get there first (or nothing else works); otherwise stand in the path.
      const spot = bot.foeSpot != null && !iAmFirst ? bot.foeSpot - p.side * 6
        : Math.max(C.GOAL_W + 24, Math.min(C.W - C.GOAL_W - 24, b.x - p.side * 26));
      steer(bot, p, out, spot);
      out.kick = adx < C.KICK_REACH + C.KICK_R && (b.x - p.x) * p.side > -10 && p.kickCd <= 0 && !bot.lastKick;
      bot.lastKick = out.kick;
      out.jump = false;
      out.power = bot.shieldArm && m.phase === 'play' && p.gauge >= 1 && p.armed <= 0;
      return out;
    }
  }

  // ---- THE OTHER PLAYER'S POWER SHOT is coming (docs/HS-POWER-SHOTS.md §4) ----------------
  //
  // At the defender HS has three outcomes: ARMED and touching it → the counter (your own shot
  // goes back); KICKING into it → the block (it grinds on the boot, then fires back as yours);
  // anything else → hit, knocked back and dazed. And the family can change the answer: a Ground
  // shot cannot be blocked at all, a strong Destructive or a Critical smashes through a boot.
  //
  // Generic on purpose: the bot never asks WHICH family or champion it is facing. It runs the
  // power ball's own flight forward (hs-powers stepPower, on a copy) to see where it will be —
  // flat, rolling, up and out then diving at the mouth, hopping and dropping, hanging and going
  // on — and reads from FAMILIES[fam].block whether a boot can stop it. Then: get into the path
  // and kick on time-to-arrival (or, armed, just meet it); against a shot a boot cannot stop, get
  // over it if it is low and out from under nothing — a hit is a hit.
  const pw = b.power;
  if (pw && pw.owner !== index && !pw.extra && !['grind', 'grab'].includes(pw.ph)) {
    if (bot.powerRef !== pw || bot.powerPlanOwner !== pw.owner) {
      // Decide ONCE per shot (a block's rebound is a new shot with a new owner).
      bot.powerRef = pw; bot.powerPlanOwner = pw.owner;
      const F = FAMILIES[pw.fam] || FAMILIES.straight;
      // (A burning bot cannot kick — hs-powers ailMods — so it has no block either.)
      const bootStops = p.ail !== 'burn' && (pw.rb || F.block === 'grind' || F.block === 'grab' || (F.block === 'smash' && pw.int < 0.4));
      // HS power shots score about 58% of the time (M3/M4: 7 goals from 12 cut-ins), so a
      // defender who is always on the line is not an HS defender: 30% (weakest) to 70%
      // (legendary) of the time it gets its answer in, otherwise it is caught flat.
      const onIt = bot.rng() < 0.3 + 0.4 * skillOf(d);
      bot.powerPlan = p.armed > 0 ? 'counter' : !onIt ? 'panic' : bootStops ? 'block' : 'dodge';
      bot.powerKickAt = 0.06 + 0.06 * skillOf(d) + (bot.rng() * 2 - 1) * 0.05 * (1 - skillOf(d));
    }
    if (p.armed > 0 && bot.powerPlan !== 'counter') bot.powerPlan = 'counter';
    const path = powerPath(m, b, 1.6);
    const hy = headY(p), crown = hy - C.HEAD_R;
    // Where it crosses my line of play: the first point of its path in front of my goal that
    // is at a height a body (standing, or at the top of a jump) can meet, and that I can reach.
    const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
    const speed = C.PLAYER_SPEED * (p.stats?.speed ?? 1);
    const top = crown - JUMP_APEX() - C.BALL_R;
    const find = (hi) => {
      for (const q of path) {
        if (q.hidden) continue;
        if ((q.x - myGoalX) * p.side < -30) break;                     // already in my net
        if (q.y < hi || q.y > C.GROUND_Y) continue;
        if (Math.abs(q.x - p.x) <= speed * q.t + C.HEAD_R) return q;
      }
      return null;
    };
    // A point it passes at standing height first (no jump to time), else one a jump reaches.
    const meet = find(crown - C.BALL_R * 0.5) || find(top);
    const coming = path.length > 0 && path.some((q) => !q.hidden && Math.abs(q.x - p.x) < C.HEAD_R + C.BALL_R + 10 && q.y > top && q.y < C.GROUND_Y + 1);
    if (bot.powerPlan === 'panic') {
      // Caught flat: it stands and watches, and is hit only if the shot is aimed through it.
      out.left = out.right = out.jump = out.kick = out.power = false;
      return out;
    }
    if (bot.powerPlan === 'dodge') {
      // A boot cannot stop it. Low (a Ground shot rolling in): jump it — the feet clear a rolling
      // ball 0.1 s into the rise. Otherwise stand clear of where it will cross, if there is time.
      const here = path.find((q) => !q.hidden && Math.abs(q.x - p.x) < C.HEAD_R + C.BALL_R);
      out.kick = false; out.power = false;
      out.jump = false;
      if (here && here.y > p.y - C.BODY_H - 2 && here.t < 0.22 && here.t > 0.08 && p.onGround) out.jump = true;
      else if (here && here.y > crown - C.BALL_R && here.y <= p.y - C.BODY_H - 2) {
        const away = myGoalX + p.side * (Math.abs(here.x - myGoalX) + 90);
        steer(bot, p, out, Math.max(C.GOAL_W, Math.min(C.W - C.GOAL_W, away)));
        return out;
      }
      out.left = out.right = false;
      return out;
    }
    // BLOCK or COUNTER: into the path, then the boot (or, armed, any touch) on time-to-arrival.
    if (meet) steer(bot, p, out, meet.x - p.side * 6);
    else { const guard = myGoalX + p.side * 40; steer(bot, p, out, guard); }
    const here = path.find((q) => !q.hidden && Math.abs(q.x - p.x) < C.HEAD_R + C.BALL_R + 6 && q.y > top && q.y < C.GROUND_Y + 1);
    // Over my head at the moment it gets here: jump so the crown is in its way.
    out.jump = false;
    if (here && here.y < crown - 4 && p.onGround) {
      const rise = crown - here.y;                                       // how far up it passes
      for (let t = 0.06; t <= 0.42; t += C.TICK) if (jumpRise(t) >= rise - 6) { if (Math.abs(here.t - t) < 0.05) out.jump = true; break; }
    }
    // The boot: pressed so it is out (KICK_TIME, 0.26 s) as the ball arrives. A counter needs
    // only the touch, but a boot touch counts too and reaches further.
    out.kick = !!here && here.t < bot.powerKickAt + (bot.powerPlan === 'counter' ? 0.08 : 0) && p.kickCd <= 0 && !bot.lastKick;
    bot.lastKick = out.kick;
    out.power = false;
    void coming;
    return out;
  }
  bot.powerRef = null;

  // ════ OPEN PLAY — played the way the Head Soccer CPU plays it ═════════════════════════════
  //
  // Measured off Idan's footage (docs/hs-estimates.json cpu.*: M3's five-star CPU, M4's two
  // weaker ones). The HS CPU is not a keeper that waits for the ball to come to it. It runs AT
  // the ball and meets it: 22 touches a minute at five stars (10 at the weak end), a jump every
  // 1.6–2.3 s, the boot out 23–45 times a minute and mashed whenever the ball or the other
  // player is close, dashes (14 a minute at five stars, 2 at the weak end), and it stands on the
  // other player's head whenever it lands there. It plays 30–40% of the pitch out from its own
  // wall on average and ranges the whole of it.
  //
  // The old bot was tuned on the old physics (slow acceleration, variable jump, a dead head) and
  // on the new physics it stood off the ball a boot's length and waited for a perfect toe-poke
  // that the instant run never gives it time for: four touches in forty seconds at level 0.
  // Everything below is one loop — read the flight, go to where it can be met, then jump / kick
  // / dash on frame-accurate checks — and the tiers differ in how fast and how well they read
  // (react, error), how often they take the chance they see (skill), and how far they press.
  openPlay(bot, m, p, foe, b, out, d, dt);

  // ---- power: ARM, on exactly the player's terms ----------------------------
  //
  // THIS IS THE FIX FOR "the rival used its ultimate the moment the match started".
  //
  // The bot writes a LEVEL into `out.power` and the sim reads an EDGE, so whatever is here
  // fires on the first tick it is true — and on the first tick of a match `prev` is empty, so
  // "true at kickoff" means "armed at kickoff". The old condition could be true immediately:
  // `bot.t > d.powerHold` is satisfied by a REUSED bot object (bot.t is never reset by a new
  // match), and a full gauge could arrive in the first second from a card. Both halves are
  // gone — the cards with them — and what is left is four conditions that cannot hold at
  // kickoff no matter what state came before:
  //
  //   m.phase === 'play' — never during the kickoff freeze or a goal restart.
  //   p.gauge >= 1       — the meter fills on the clock (GAUGE_PASSIVE) and starts every
  //                        match at zero (clearUltimate), so it is never full at kickoff.
  //   p.armed <= 0       — no re-pressing something already armed.
  //   armDelay           — a beat of ordinary football after kickoff before the bot will even
  //                        consider it, measured on the MATCH clock rather than on bot.t, so a
  //                        bot object that outlives its match cannot carry the clock over.
  //
  // And arming is no longer the move: the bot still has to walk the ball down afterwards,
  // through the same contact test a human faces. There is no shortcut here that the player
  // does not have.
  const played = C.MATCH_DURATION - m.clock;         // s of football actually played
  const armDelay = 1.5;
  const wantPower = m.phase === 'play' &&
                    played > armDelay &&
                    p.gauge >= 1 && p.armed <= 0 && b.power == null &&
                    bot.fullT > FULL_HOLD + d.powerHold &&
                    (foe.x - p.x) * p.side > -80 &&   // the goal I am shooting at is ahead
                    armMoment(d, p, b);
  out.power = wantPower;

  return out;
}

// ════ OPEN PLAY ═══════════════════════════════════════════════════════════════════════════════

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// THE SKILL AXIS, 0 (the weakest tier) … 1 (legendary), read off `aim` — the dial every tier and
// every arcade champion already carries (DIFFICULTIES, champions.js stageDifficulty) — so the new
// behaviour needs no new field and the star ladder stays one monotonic line.
const skillOf = (d) => clamp01((d.aim - 0.35) / 0.63);
// HOW THE `react` AND `error` DIALS ARE READ HERE. They were calibrated for the old bot, which
// used them on a slower, floatier game; read one-for-one by this loop every tier read the flight
// like a machine — frame-perfect under every ball — and bot-vs-bot scoring fell to ~4 a match
// against HS's 8.7 (M1–M3), because nothing ever got past a bot. A person misjudges where a ball
// comes down by a head's width and re-decides a few times a second. Measured over 32 matches:
// ×3 misread and ×1.5 think interval → 6–7 goals a match with the ladder intact (tier 5 beats
// tier 0 by ~2.5 goals a match). The dials themselves are untouched, so DIFFICULTIES and the
// arcade's stageDifficulty keep their order and their tests.
const MISREAD_SCALE = 3;
const THINK_SCALE = 1.5;

// Where the ball goes, a tick at a time: the ball's own flight (gravity, air drag, the grass
// bounce and its settle cutoff, the side walls, the dead ceiling), no bodies and no goal frame.
function flight(b, T) {
  const path = [];
  const r = b.r ?? C.BALL_R;
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  for (let t = C.TICK; t <= T + 1e-9; t += C.TICK) {
    vy += C.BALL_GRAV * C.TICK; vx *= C.BALL_AIR;
    x += vx * C.TICK; y += vy * C.TICK;
    if (y > C.GROUND_Y - r) {
      y = C.GROUND_Y - r;
      if (vy > 0) { vy = -vy * C.BALL_BOUNCE; if (Math.abs(vy) < 60) vy = 0; }
      vx *= C.BALL_GROUND_FRICTION;
    }
    if (y < C.CEIL_Y + r) { y = C.CEIL_Y + r; if (vy < 0) { vy = -vy * C.CEIL_BOUNCE; vx *= C.CEIL_KEEP_X; } }
    if (x < r) { x = r; vx = Math.abs(vx) * C.BALL_WALL_BOUNCE; }
    if (x > C.W - r) { x = C.W - r; vx = -Math.abs(vx) * C.BALL_WALL_BOUNCE; }
    path.push({ t, x, y });
  }
  return path;
}

// Where a POWER ball goes: its family's own flight (hs-powers stepPower) run forward on a copy,
// one step a tick, the way stepBall moves it. `hidden` marks the stretch it is off the top of the
// picture (an Aerial going up and waiting) — nobody can touch it there. Stops when the power ends
// (the ball is a loose ball again) or is pinned (a block's grind and rest, a grab).
const NO_KIT = { stun() {}, headY, keepOutOfGoal: (fx, fy, x) => x, bounds() {} };
const NO_FX = { trail() {}, shockwave() {}, grab() {}, hit() {}, goal() {} };
function powerPath(m, b, T) {
  const ball = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r ?? C.BALL_R, spin: 0, power: { ...b.power } };
  const fake = { events: [], players: m.players, cutin: 0, hitStop: 0 };
  const path = [];
  for (let t = C.TICK; t <= T + 1e-9; t += C.TICK) {
    const pw = ball.power;
    if (!pw || pw.ph === 'grind' || pw.ph === 'rest' || pw.ph === 'grab') break;
    if (!stepPower(fake, ball, C.TICK, NO_KIT, NO_FX)) break;
    ball.x += ball.vx * C.TICK; ball.y += ball.vy * C.TICK;
    if (ball.y > C.GROUND_Y - ball.r) ball.y = C.GROUND_Y - ball.r;
    const ph = ball.power ? ball.power.ph : '';
    path.push({ t, x: ball.x, y: ball.y, hidden: ph === 'up' || ph === 'wait' || ph === 'hold' || ball.y < C.CEIL_Y });
  }
  return path;
}

// The shot an ARMED opponent would fire if they touched the ball where it is now: their family's
// launch and flight, run on copies.
function foeShotPath(m, b, foe) {
  if (!foe.shot) return [];
  const ball = { x: b.x, y: b.y, vx: 0, vy: 0, r: b.r ?? C.BALL_R, spin: 0, power: null };
  const fake = { events: [], xballs: null, players: m.players, cutin: 0, hitStop: 0 };
  launchPower(fake, ball, foe, NO_KIT, NO_FX);
  return ball.power ? powerPath(fake, ball, 2.2) : [];
}

// The fixed jump, derived: how high it lifts the head, and the head's rise t seconds after
// takeoff (HS: one impulse, 45.8px, 0.77 s in the air; no variable height).
const jumpRise = (t) => Math.max(0, C.JUMP_V * t - 0.5 * C.PLAYER_GRAV * t * t);
const JUMP_APEX = () => (C.JUMP_V * C.JUMP_V) / (2 * C.PLAYER_GRAV);

function steer(bot, p, out, target) {
  // Hysteresis: start moving at 12px off the target, stop inside 4px. Without it a bot parked on
  // its spot flickers left/right/left — and two presses of one arrow inside DASH_WINDOW are a
  // DASH. The old bot's 12px dead band did exactly that: 31–36 dashes a minute that nobody
  // chose, against the HS CPU's 2–14.
  const dx = target - p.x;
  let dir = bot.dir || 0;
  if (dir === 0) { if (Math.abs(dx) > 12) dir = Math.sign(dx); }
  else if (dx * dir < 4) dir = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
  // …and never a second press of the same arrow inside the dash window unless a dash is meant.
  if (dir !== 0 && dir !== bot.dir && bot.t - (bot.pressT?.[dir] ?? -9) < C.DASH_WINDOW + C.TICK) dir = 0;
  if (dir !== 0 && dir !== bot.dir) (bot.pressT ??= {})[dir] = bot.t;
  bot.dir = dir;
  out.left = dir < 0; out.right = dir > 0;
}

function openPlay(bot, m, p, foe, b, out, d, dt) {
  const s = skillOf(d);
  const side = p.side;
  const myGoalX = side > 0 ? C.GOAL_W : C.W - C.GOAL_W;     // my goal line
  const hy = headY(p);
  const speed = C.PLAYER_SPEED * (p.stats?.speed ?? 1);
  const jumpV = C.JUMP_V * (p.stats?.jump ?? 1);
  const apex = (jumpV * jumpV) / (2 * C.PLAYER_GRAV);
  // The highest ball centre a jump can put the crown under.
  const reachY = C.GROUND_Y - (apex + C.BODY_H + 2 * C.HEAD_R - C.NECK) - C.BALL_R + 4;

  // An APPROACH is one arrival of the ball: it ends when the ball is well away again.
  if (Math.hypot(b.x - p.x, b.y - hy) > 180) { if (bot.wasNear) bot.approach = (bot.approach || 0) + 1; bot.wasNear = false; } else bot.wasNear = true;

  // ---- think: read the flight and pick the spot, on the tier's own cadence ----
  if (bot.t >= bot.nextThink) {
    bot.nextThink = bot.t + d.react * THINK_SCALE;
    const err = (bot.rng() * 2 - 1) * d.error * MISREAD_SCALE;
    const path = flight(b, 1.6);
    const dashReady = p.dashCd <= 0;
    // THE MEETING POINT: the first moment on the ball's path at a height a player can play
    // (on the grass up to a jumping header) that this player can get under in time. Stand so
    // the ball arrives IN FRONT — on the side it attacks, where the boot swings and a head
    // bounce sends it on — a boot-and-a-half out for a low ball, just ahead of the crown for a
    // high one.
    let meet = null;
    for (const q of path) {
      if (q.y < reachY) continue;
      const low = q.y > C.GROUND_Y - C.BODY_H - C.HEAD_R;
      const standX = q.x - side * (low ? 34 + 14 * s : 16);
      if (Math.abs(standX - p.x) - 6 <= speed * q.t + (dashReady ? 60 : 0)) { meet = { ...q, standX }; break; }
    }
    const last = path[path.length - 1];
    if (!meet) meet = { ...last, standX: last.x - side * 30 };
    meet.standX += err;

    const ballDepth = (meet.x - myGoalX) * side;                 // 0 at my line, W at theirs
    const toMyGoal = b.vx * side < -40;
    const foeFirst = Math.abs(foe.x - meet.x) + 40 < Math.abs(p.x - meet.x);
    // PRESSING. The HS CPU goes for everything in its own 55% of the pitch and presses deeper
    // when it is the nearer player; beyond that it chases on the tier's aggression, and a weak
    // one also simply fails to go (1 - skill of the time it hangs back).
    bot.modeT = (bot.modeT ?? 0) - d.react;
    if (bot.modeT <= 0) { bot.press = bot.rng() < d.aggression + 0.3 * s; bot.modeT = 0.6 + bot.rng() * 0.8; }
    // …and a weak tier sometimes simply does not go for a ball it could reach (re-rolled per
    // approach): HS's weak CPUs play 49% of the balls that come within reach, the five-star 86%.
    if (bot.goFor !== bot.approach) { bot.goFor = bot.approach; bot.lazy = bot.rng() < LAZY * (1 - s); }
    const engage = !bot.lazy && (ballDepth < C.W * 0.55 || !foeFirst || bot.press);
    // Home: where it waits when it is not going. Stronger tiers wait further out (HS: the
    // five-star CPU averages 425px out from its wall, the weak ones 320).
    const home = myGoalX + side * 180;
    let target = engage ? meet.standX : home;
    // A ball that has got BEHIND me and is heading home: get back past it, goal-side, the
    // quickest way there is (a dash when it is far) — this is the defence against lobs.
    const behind = (meet.x - p.x) * side < -20 && toMyGoal;
    if (behind) target = meet.x - side * 20;
    // Never further forward than the tier will go: its pressing depth.
    const cap = myGoalX + side * C.W * (0.5 + 0.15 * s);
    target = side > 0 ? Math.min(target, cap) : Math.max(target, cap);
    // ARMED: the power goes off on ANY touch of the ball (kick, head or body — shared/sim.js
    // fireUltimateOnContact), so an armed bot simply runs into the ball. Generic on purpose:
    // whatever the power family, "armed → touch the ball" is the whole of using it.
    if (p.armed > 0 && !b.power) target = b.x - side * 6;
    bot.aim = Math.max(C.GOAL_W * 0.5, Math.min(C.W - C.GOAL_W * 0.5, target));

    // DASH, on purpose: a long way to go and a reason to hurry (the ball is loose and they are
    // after it too, or it is coming home). HS: 14 a minute at five stars, 2 at the weak end.
    const far = Math.abs(bot.aim - p.x);
    const urgent = behind || (engage && Math.abs(foe.x - meet.x) < far + 120) || p.armed > 0;
    bot.dashRoll = (bot.dashRoll ?? 0) - d.react;
    if (bot.dashRoll <= 0) {
      bot.dashRoll = 0.25;
      bot.wantDash = far > 70 && (urgent || engage) && dashReady && bot.rng() < DASH_BASE + DASH_SKILL * s * s;
    }
    // Tackle: the boot shoves an opponent standing in it, off the ball. An able bot takes it
    // when nothing is coming at its goal.
    const foeNear = Math.abs(foe.x - p.x) < C.KICK_REACH + C.KICK_R * 0.8 && Math.abs(foe.y - p.y) < C.BODY_H + C.HEAD_R;
    // NOT A STUN-LOCK. Every fifth boot that lands hurts and the fifteenth knocks the player out
    // for 2 s (sim.js kickDamage, HS's knockout), so a bot that booted whoever stood next to it
    // every time the cooldown allowed would chain knockouts. A deliberate tackle is for a ball in
    // dispute (it is within reach of one of them), never on a helpless player, and at most once
    // a second; the boot still lands when it is swung at the ball, as it does in HS.
    const contest = Math.min(Math.abs(b.x - p.x), Math.abs(b.x - foe.x)) < 160;
    const helpless = foe.stunned > 0 || foe.ail === 'freeze' || foe.ail === 'stars';
    bot.wantTackle = foeNear && contest && !helpless && !toMyGoal && foe.tackleImmune <= 0 && bot.t >= (bot.tackleT ?? 0) &&
      bot.rng() < Math.min(0.95, d.aim * 1.2 * (d.tackle ?? 1));
  }

  // ---- steering ----
  steer(bot, p, out, bot.aim);
  // Dashing is a double tap: off, on, off, on — two rising edges inside DASH_WINDOW.
  if (bot.wantDash && bot.dashPulse == null && p.dashCd <= 0 && (out.left || out.right)) {
    bot.dashPulse = 0; bot.pulseDir = out.right ? 1 : -1;
  }
  if (bot.dashPulse != null) {
    const pressed = bot.dashPulse % 2 === 1;
    out.left = pressed && bot.pulseDir < 0;
    out.right = pressed && bot.pulseDir > 0;
    if (++bot.dashPulse > 3) { bot.dashPulse = null; bot.wantDash = false; (bot.pressT ??= {})[bot.pulseDir] = bot.t; bot.dir = bot.pulseDir; }
  }

  // ---- jump and kick: frame-accurate, on the ball as it is now ----
  const near = flight(b, 0.5);
  const vxNow = (out.right ? 1 : 0) - (out.left ? 1 : 0);
  const dxb = b.x - p.x;
  const ahead = dxb * side;                                       // + = on the side I attack
  const toMyGoal = b.vx * side < -40;
  let jump = false;

  if (p.onGround) {
    // THE HEADER: if I jump now, does the rising crown meet the ball, with the ball on the side
    // I attack (so the springy head sends it on, not back over my shoulder)? Defending, any
    // side will do — a ball headed anywhere is a ball not in my net.
    // TIMING is the skill here, not seeing it: the rise it expects is misjudged by up to
    // `late` seconds, re-rolled per approach (a person's jump is early or late by a few frames;
    // a perfect one blocks every shot on target, and the goal rate collapses — bot-vs-bot, 57%
    // of shots on target were jumping saves before this).
    if (bot.jitterFor !== bot.approach) { bot.jitterFor = bot.approach; bot.jitter = (bot.rng() * 2 - 1) * (0.09 * (1 - s) + 0.03); }
    let chance = false;
    for (const q of near) {
      if (q.t > 0.42) break;
      const tj = Math.max(0, q.t + bot.jitter);
      const hx = p.x + vxNow * speed * q.t, hyT = hy - jumpRise(tj) * (jumpV / C.JUMP_V);
      const dd = Math.hypot(q.x - hx, q.y - hyT);
      if (dd < C.HEAD_R + C.BALL_R + 3 && (q.x - hx) * side > -C.HEAD_R * 0.3 && q.y < hy - 6) { chance = true; break; }
      if (dd < C.HEAD_R + C.BALL_R + 3 && toMyGoal) { chance = true; break; }
    }
    // A chance is taken or passed on ONCE (per approach), on skill — a weak tier misses the
    // moment as often as it sees it.
    if (chance && !bot.headerSeen) { bot.headerSeen = true; bot.headerGo = bot.rng() < 0.1 + 0.9 * s; }
    if (!chance) bot.headerSeen = false;
    // (No head, no header — the `beheaded` ailment; a shocked body cannot jump at all.)
    if (chance && bot.headerGo && p.ail !== 'beheaded') jump = true;
    // THE HOP-KICK: a ball between the knee and the head, in front — jump with the boot out
    // (HS's CPU volleys in the air all the time).
    if (!jump && ahead > 20 && ahead < C.KICK_REACH + 30 && b.y < p.y - C.BODY_H - 14 && b.y > hy - 30 && p.kickCd <= 0 &&
        bot.rng() < 0.08 + 0.2 * s) jump = true;
    // THE HOP: the HS CPU is in the air every 1.6–2.3 s, and not only for a header it has
    // lined up — a ball dropping in over it, close in front, gets a jump to meet it early.
    if (!jump && b.y < hy - C.HEAD_R && Math.abs(dxb) < 150 && bot.rng() < HOP) jump = true;
    // SOLID BODIES: the other player is between me and where I am going, on the grass. Jump:
    // a jump does not clear a head, it lands ON it (HS: standing on heads), and from there the
    // walk carries on over the top.
    const goingTo = Math.sign(bot.aim - p.x);
    const foeAhead = (foe.x - p.x) * goingTo;
    if (!jump && goingTo !== 0 && foeAhead > 0 && foeAhead < C.HEAD_R * 2 + 14 && Math.abs(bot.aim - p.x) > foeAhead + 20 &&
        foe.onGround && Math.abs(foe.y - p.y) < 4 && bot.rng() < 0.05 + 0.1 * s) jump = true;
  }
  out.jump = jump && !bot.lastJump;           // an edge: HOLDING jump re-jumps on every landing
  bot.lastJump = out.jump;

  // THE BOOT. The same swing the sim collides against (shared/kick.js): out of the rest pose low
  // in front, up to face height in six frames, held there for the rest of KICK_TIME (0.26 s) —
  // so a swing pressed a few ticks before the ball arrives still meets it, low or at head height.
  const boots = BOOT_POINTS;
  let onBoot = false;
  for (const q of near) {
    if (q.t > 0.12) break;
    const dy = p.onGround ? 0 : p.vy * q.t;
    for (const [reach, up] of boots) {
      const px = p.x + side * reach + vxNow * speed * q.t, py = p.y - up + dy;
      if (Math.hypot(q.x - px, q.y - py) < C.BOOT_R + C.BALL_R + 6) { onBoot = true; break; }
    }
    if (onBoot) break;
  }
  if (onBoot && !bot.kickSeen) { bot.kickSeen = true; bot.kickGo = bot.rng() < KICK_GO + (1 - KICK_GO) * s; }
  if (!onBoot) bot.kickSeen = false;
  // MASHING: the HS CPU keeps the boot going whenever the ball is close in front, or the other
  // player is (the tackle) — 23–45 swings a minute overall, near the cooldown's cap up close.
  const close = ahead > -10 && Math.abs(dxb) < 110 && b.y > hy - 70;
  const mash = close && bot.rng() < 0.02 + MASH_SKILL * s;
  const want = (bot.kickSeen && bot.kickGo) || mash || bot.wantTackle || (p.armed > 0 && Math.abs(dxb) < 90);
  out.kick = want && p.kickCd <= 0 && !bot.lastKick;
  bot.lastKick = out.kick;
  if (out.kick && bot.wantTackle) { bot.wantTackle = false; bot.tackleT = bot.t + 1; }
}
