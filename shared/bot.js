// Bot opponent. Produces the same {left,right,jump,kick,power} an input device produces,
// so the sim can't tell a bot from a human — and a human can drop into slot 1 later.
//
// Difficulty is one dial (0..5) that moves four things: how fast it reacts, how much it
// mis-reads the ball, how often it spots a counter, and how greedily it commits forward.

import * as C from './constants.js';
import { headY } from './sim.js';
import { carrying, activeEffect } from './powers.js';

// `aggression` runs BACKWARDS on purpose. Measured over 10 headless matches per setting,
// it is the single dominant term in the scoreline — 0.00 → 0.0 goals a match, 0.15 → 8.3,
// 0.55 → 13.6, and flat above that. It isn't "how good the bot is", it's how often it
// abandons its goal, and a 812px pitch never gives it time to get back. So the weak bots
// are the ones that chase everything and leave the net open; the legendary bot holds its
// post and only presses when it is genuinely the nearer player.
// What separates the tiers is REACTION, AIM and COUNTERING — not commitment.
//
// This was got wrong twice. First `aggression` rose with difficulty, and the legendary bot
// lost because both bots ended up mid-pitch every time the ball came back. Then it FELL
// with difficulty, and the legendary bot lost again because a bot that never presses never
// scores. Once the goal became genuinely hard to score in (whole ball over the line, solid
// crossbar), pressure started mattering more than position and the dial inverted a third
// time. So it is now flat: every tier commits about equally, and the good ones are simply
// faster, more accurate, and better at reading a power shot.
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
  // A champion that has had its own controls reversed on it. The sim swaps them after the bot
  // has chosen, so an able bot chooses the other way round; a weak one runs the wrong way, the
  // same as a person does.
  const p = m.players[index];
  if (m.champ && bot.d.adapt && p.mods.reverse) {
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
  if (p.stunned > 0 || m.phase === 'over') {
    out.left = out.right = out.jump = out.kick = out.power = false;
    return out;
  }

  // ---- TIME HAS STOPPED, and this bot stopped it (the arcade's עצירת זמן) --------------
  // The ball hangs where it was touched and the other player is a statue. Walk up behind the
  // ball and head it at their goal once; the strike is banked and goes off when time restarts.
  // Then stand off it, so a stray shoulder does not nudge the banked shot.
  const stop = m.champ ? activeEffect(m, 'timestop') : null;
  if (stop && stop.owner === index) {
    const spot = b.x - p.side * 34;
    out.jump = false; out.power = false;
    if (stop.stored) {
      out.left = p.side > 0; out.right = p.side < 0; out.kick = false;
      return out;
    }
    steer(bot, p, out, spot);
    const reach = Math.hypot(b.x - p.x, b.y - headY(p));
    out.kick = (b.x - p.x) * p.side > 0 && reach < C.HEAD_R + C.BALL_R + C.HEADER_R - 3 && p.kickCd <= 0 && !bot.stopKick;
    bot.stopKick = out.kick;                             // one press, not a held button
    return out;
  }

  // ---- the opponent is ARMED: the glow is the telegraph ----------------------
  //
  // Under the old wind-up this branch keyed off `foe.charge`, and the answer was "go and
  // tackle them to cancel it, or get on the line". The ultimate does not wind up any more:
  // an armed opponent is glowing and waiting for a touch on the BALL, so a tackle cannot
  // cancel it and there is nothing to interrupt.
  //
  // What CAN be done is the thing the new rule creates — deny the touch. Get between them and
  // the ball, and the arm is stuck: it has no clock on it, so it waits, and denying the touch
  // denies the shot for exactly as long as you can keep it up. Whether the bot spots the glow
  // at all is `aim`, same ladder as everything else here, so the easy tiers still walk into it.
  if (foe.armed > 0 && !b.power && bot.rng() < d.aim) {
    // Stand goal-side of the ball: in the line the shot would take if they do reach it, and
    // in their way while they try to.
    const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
    const block = Math.max(C.GOAL_W + 24, Math.min(C.W - C.GOAL_W - 24, b.x - p.side * 26));
    steer(bot, p, out, block);
    // Close enough to contest the ball: boot it away from them. A ball that leaves is a ball
    // they cannot touch, which is the whole defence against this now.
    const adx = Math.abs(b.x - p.x);
    out.kick = adx < C.KICK_REACH + C.KICK_R && p.kickCd <= 0;
    out.jump = false;
    out.power = false;
    void myGoalX;
    return out;
  }

  if (b.power && b.power.owner !== index) {
    const dist = Math.hypot(b.x - p.x, b.y - headY(p));
    const incoming = (b.x - p.x) * p.side < 0;      // heading at me, not away

    if (bot.powerPlan == null) {
      // Decide ONCE per shot: counter (hardest), block (default), or fluff it.
      // A weak bot sometimes just loses its head; everyone else defends, and the best also
      // tries to time a counter out of the block.
      const r = bot.rng();
      // HS power shots score about 58% of the time (M3/M4: 7 goals from 12 cut-ins), so a
      // defender who is always on the line is not an HS defender: 30% (weakest) to 70%
      // (legendary) of the time it gets into the blocking line, otherwise it is caught flat.
      const blockP = 0.3 + 0.4 * skillOf(d);
      bot.powerPlan = r > blockP ? 'panic' : (bot.rng() < d.counter ? 'counter' : 'block');
    }

    if (bot.powerPlan !== 'panic' && incoming) {
      // ALWAYS take the blocking line. Countering is layered on top of it, never instead of
      // it: a bot that stepped out to time a counter and missed had also abandoned the
      // block, and the strong bot ended up 7 goals WORSE than the weak one for trying.
      const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
      const intercept = Math.max(C.GOAL_W + 30, Math.min(C.W - C.GOAL_W - 30, myGoalX + p.side * 70));
      steer(bot, p, out, intercept);
      // A shot above head height can only be met in the air — but WHEN matters more than
      // whether. The volley crosses the pitch at three times a normal shot, and a bot that
      // jumped the moment it saw one had landed again before it arrived: the same mistake a
      // player makes against the dog. So jump on TIME-TO-ARRIVAL, about a quarter of a
      // second out, which is roughly the rise to a jump's apex.
      const eta = Math.abs(b.vx) > 1 ? Math.abs(b.x - p.x) / Math.abs(b.vx) : 9;
      // A BETTER bot jumps EARLIER, not later: anticipation is the skill, and a late jump
      // against a ball moving at 2000px/s is a miss. The first version had this backwards and
      // the strong bot blocked nine to the weak bot's twenty-four.
      const lead = 0.18 + d.aim * 0.16;
      // HOLD the jump for a beat. It used to matter for height (JUMP_CUT took a tap to 45% of a
      // held jump); HS's jump is one fixed impulse, so now it only has to cover the takeoff tick.
      // 14 ticks is well inside the 0.79s airtime, so the hold never becomes HS's re-jump.
      if (p.onGround && b.y < headY(p) - C.HEAD_R * 0.4 && eta < lead) bot.holdJump = 14;
      out.jump = bot.holdJump > 0;
      if (bot.holdJump > 0) bot.holdJump--;
      // The counter is a kick timed into the block, not a substitute for it.
      out.kick = bot.powerPlan === 'counter'
        ? dist < C.COUNTER_WINDOW * 0.82
        : dist < C.KICK_REACH;
      out.power = false;
      return out;
    }
    if (bot.powerPlan === 'panic') {
      // Caught flat: it stands and watches, and blocks only if the shot happens to be aimed
      // through it.
      out.left = out.right = out.jump = out.kick = out.power = false;
      return out;
    }
  } else {
    bot.powerPlan = null;
  }

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

  // …and a carried ball is released with a kick, which should come close enough to the goal to
  // count. Until then: keep running, no swings, no jumps.
  if (m.champ && carrying(m, index)) {
    const toGoal = ((p.side > 0 ? C.W - C.GOAL_W : C.GOAL_W) - p.x) * p.side;
    const c = activeEffect(m, 'carry');
    // Let it go close in, or when the other player is about to take it off the boot, or just
    // before the glue runs out — never simply the moment it is in range.
    const blocked = (foe.x - p.x) * p.side > 0 && (foe.x - p.x) * p.side < 110;
    out.kick = (toGoal < 230 || blocked || (c && c.life - c.t < 0.35)) && p.kickCd <= 0;
    out.jump = false;
    out.left = p.side < 0; out.right = p.side > 0;
  }

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
    if (bot.goFor !== bot.approach) { bot.goFor = bot.approach; bot.lazy = bot.rng() < 0.15 * (1 - s); }
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
      bot.wantDash = far > 110 && urgent && dashReady && bot.rng() < 0.01 + 0.22 * s * s;
    }
    // Tackle: the boot shoves an opponent standing in it, off the ball. An able bot takes it
    // when nothing is coming at its goal.
    const foeNear = Math.abs(foe.x - p.x) < C.KICK_REACH + C.KICK_R * 0.8 && Math.abs(foe.y - p.y) < C.BODY_H + C.HEAD_R;
    bot.wantTackle = foeNear && !toMyGoal && foe.tackleImmune <= 0 && bot.rng() < Math.min(0.95, d.aim * 1.2 * (d.tackle ?? 1));
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
    if (chance && bot.headerGo) jump = true;
    // THE HOP-KICK: a ball between the knee and the head, in front — jump with the boot out
    // (HS's CPU volleys in the air all the time).
    if (!jump && ahead > 20 && ahead < C.KICK_REACH + 30 && b.y < p.y - C.BODY_H - 14 && b.y > hy - 30 && p.kickCd <= 0 &&
        bot.rng() < 0.08 + 0.2 * s) jump = true;
    // THE HOP: the HS CPU is in the air every 1.6–2.3 s, and not only for a header it has
    // lined up — a ball dropping in over it, close in front, gets a jump to meet it early.
    if (!jump && b.y < hy - C.HEAD_R && Math.abs(dxb) < 150 && bot.rng() < 0.04) jump = true;
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

  // THE BOOT. The kick circle hangs KICK_REACH out on the attacking side at shin height, and a
  // swing keeps it out for KICK_TIME (0.26 s) — so a swing pressed a few ticks before the ball
  // arrives still catches it. And KICK at a ball on the head is the aimed header (tryHeader).
  const kx = p.x + side * C.KICK_REACH, ky = p.y - C.BODY_H * 0.5;
  let onBoot = false;
  for (const q of near) {
    if (q.t > 0.12) break;
    const px = kx + vxNow * speed * q.t, py = ky + (p.onGround ? 0 : p.vy * q.t);
    if (Math.hypot(q.x - px, q.y - py) < C.KICK_R + C.BALL_R - 3) { onBoot = true; break; }
  }
  // (No aimed header off a ball on the crown: measured over 32 bot matches a tier, KICK at a
  // ball on the head — tryHeader's big loft — scored less and flattened the ladder than letting
  // the springy head play it. The mash below still throws one now and then, as a person does.)
  if (onBoot && !bot.kickSeen) { bot.kickSeen = true; bot.kickGo = bot.rng() < 0.45 + 0.55 * s; }
  if (!onBoot) bot.kickSeen = false;
  // MASHING: the HS CPU keeps the boot going whenever the ball is close in front, or the other
  // player is (the tackle) — 23–45 swings a minute overall, near the cooldown's cap up close.
  const close = ahead > -10 && Math.abs(dxb) < 110 && b.y > hy - 70;
  const mash = close && bot.rng() < 0.02 + 0.2 * s;
  const want = (bot.kickSeen && bot.kickGo) || mash || bot.wantTackle || (p.armed > 0 && Math.abs(dxb) < 90);
  out.kick = want && p.kickCd <= 0 && !bot.lastKick;
  bot.lastKick = out.kick;
  if (out.kick && bot.wantTackle) bot.wantTackle = false;
}
