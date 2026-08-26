// Bot opponent. Produces the same {left,right,jump,kick,power} an input device produces,
// so the sim can't tell a bot from a human — and a human can drop into slot 1 later.
//
// Difficulty is one dial (0..5) that moves four things: how fast it reacts, how much it
// mis-reads the ball, how often it spots a counter, and how greedily it commits forward.

import * as C from './constants.js';
import { headY } from './sim.js';
import { activeMeteors } from './spectacle.js';
import { activePickup, PU } from './powerups.js';
import { cardKind, cardReady, liveKind, CARD_SLOTS, CARD_KEYS } from './cards.js';

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
export function createBot(level = 2, rng = Math.random) {
  const d = DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, level))];
  return {
    level, d, rng,
    t: 0, nextThink: 0,
    aim: C.W / 2,          // the x it is currently walking to (re-picked on each think)
    wantJump: false, wantKick: false,
    counterArmed: false, powerPlan: null,
    dodge: null,           // null = not dodging this rock; a number = ticking down to the step
    puGo: false,           // am I currently running at the crate?
    puFor: null, puWant: false,   // the crate I have already made my mind up about
    holdJump: 0,           // frames of jump still held — jump height is variable here
    cardWait: 0,           // s until it will consider its hand again — the reaction dial, again
    out: { left: false, right: false, jump: false, kick: false, power: false,
           card1: false, card2: false, card3: false },
  };
}

// The meteor about to land closest to me, if one is close enough to be my problem. The
// margin is the blast radius plus a body — standing on the rim still hurts.
function nearestMeteor(m, p) {
  const met = activeMeteors(m);
  let best = null;
  for (const r of met) {
    if (Math.abs(r.x - p.x) > C.METEOR_R + C.BODY_W) continue;
    if (!best || r.left < best.left) best = r;
  }
  return best;
}

// Where the ball will be when it next crosses this height, ignoring collisions.
// Good enough to look like reading the flight; wrong often enough to look human.
function predictX(ball, targetY) {
  const g = C.BALL_GRAV;
  const dy = targetY - ball.y;
  const disc = ball.vy * ball.vy + 2 * g * dy;
  if (disc < 0) return ball.x;
  const t = (-ball.vy + Math.sqrt(disc)) / g;
  if (!isFinite(t) || t < 0) return ball.x;
  return ball.x + ball.vx * Math.min(t, 1.6);
}

export function botInput(bot, m, index, dt) {
  const p = m.players[index];
  const foe = m.players[1 - index];
  const b = m.ball;
  const out = bot.out;
  const d = bot.d;
  bot.t += dt;

  if (p.knocked > 0 || m.phase === 'over') {
    out.left = out.right = out.jump = out.kick = out.power = false;
    return out;
  }

  // ---- get out from under a meteor -----------------------------------------
  // A telegraph nobody answers is not a telegraph. The bot has to prove the marker is
  // readable, or "fair" is only true for a human who happens to be watching for it.
  //
  // Skill-scaled like everything else here: `aim` is how reliably it spots the marker at
  // all, and `react` delays the step, so a very-easy bot wanders into rocks and the
  // legendary one is never under one. Runs BEFORE the power-shot branch and outside the
  // think cadence — nothing else matters while something is falling on your head.
  const rock = nearestMeteor(m, p);
  if (rock) {
    if (bot.dodge == null) bot.dodge = bot.rng() < 0.35 + d.aim * 0.65 ? d.react * 0.8 : null;
    if (bot.dodge != null) {
      bot.dodge -= dt;
      if (bot.dodge <= 0) {
        // Step away from the impact, but never into the back of my own net.
        const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
        let away = Math.sign(p.x - rock.x) || -p.side;
        if ((p.x + away * 120 - myGoalX) * p.side < 30) away = -away;
        out.left = away < 0; out.right = away > 0;
        out.jump = false; out.kick = false; out.power = false;
        return out;
      }
    }
  } else if (bot.dodge !== undefined) {
    bot.dodge = null;
  }

  // ---- facing a power shot: counter it, or get in its way --------------------
  // Power shots fly flat and fast and are BLOCKED by a body in the path, so the right
  // answer is to step into the line — not to dodge. The old code ran away from them, which
  // under the new model just gifts a goal.
  // THE WIND-UP IS A TELEGRAPH. The opponent charging their power move is half a second of
  // warning, and the whole point of the move being readable is that a defender can use it.
  // Get onto the goal line and wait — the jump itself is timed below, once the ball is real.
  if (foe.charge > 0) {
    // Two answers, and choosing between them is the skill. If I can REACH them inside the
    // wind-up, go and hit them: a tackle cancels the whole move and the gauge is already
    // spent. If I cannot, get on the goal line and wait to jump.
    // The wind-up has two phases and they want opposite things. Inside the CANCEL WINDOW a
    // tackle kills the shot, so go and get them. Once that window shuts the shot is coming
    // whatever you do, and every frame spent running at the charger is a frame not spent
    // getting onto the line — which is how two bots ended up conceding ten volleys a match.
    const elapsed = C.POWER_CHARGE_TIME - foe.charge;
    const windowLeft = C.POWER_CANCEL_WINDOW - elapsed;
    const reach = Math.abs(foe.x - p.x);
    const canGetThere = windowLeft > 0 &&
                        reach < C.PLAYER_SPEED * windowLeft * 0.9 + C.KICK_REACH;
    if (canGetThere && bot.rng() < d.aim) {
      out.left = foe.x < p.x - 6;
      out.right = foe.x > p.x + 6;
      out.kick = reach < C.KICK_REACH + C.KICK_R && p.kickCd <= 0;
      out.jump = false;
      out.power = false;
      return out;
    }
    const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
    const post = Math.max(C.GOAL_W + 24, Math.min(C.W - C.GOAL_W - 24, myGoalX + p.side * 60));
    out.left = p.x > post + 8;
    out.right = p.x < post - 8;
    // Time the jump off the WIND-UP, not off the ball: the volley crosses the pitch in half a
    // second and the shot leaves at 0.9 of the goal, so a defender who waits to see it leave
    // is already too late. Jump so the head is up there as it arrives — and HOLD it, because a
    // tapped jump cannot reach that height at all.
    const flight = Math.abs(post - foe.x) / (C.POWER_SHOT_SPEED * C.POWER_VOLLEY_SPEED);
    if (foe.charge <= flight + 0.22 && Math.abs(p.x - post) < 90) bot.holdJump = 16;
    out.jump = bot.holdJump > 0;
    if (bot.holdJump > 0) bot.holdJump--;
    out.kick = false;
    out.power = false;
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
      bot.powerPlan = r > d.aim ? 'panic' : (bot.rng() < d.counter ? 'counter' : 'block');
    }

    if (bot.powerPlan !== 'panic' && incoming) {
      // ALWAYS take the blocking line. Countering is layered on top of it, never instead of
      // it: a bot that stepped out to time a counter and missed had also abandoned the
      // block, and the strong bot ended up 7 goals WORSE than the weak one for trying.
      const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
      const intercept = Math.max(C.GOAL_W + 30, Math.min(C.W - C.GOAL_W - 30, myGoalX + p.side * 70));
      out.left = p.x > intercept + 10;
      out.right = p.x < intercept - 10;
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
      // HOLD the jump, do not tap it. Jump height is variable here — a tap tops out at 146px
      // and a held jump reaches 239 — and the volley flies at 0.9 of the goal, so a tapping
      // bot cannot reach it at all. Measured: one block across sixteen matches before this.
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
    if (bot.powerPlan === 'panic' && dist < 240) {
      out.jump = bot.rng() < 0.5;
      out.kick = false;
      out.left = p.side > 0; out.right = p.side < 0;
      return out;
    }
  } else {
    bot.powerPlan = null;
  }

  // Press/hold is decided on its OWN slow clock, not per think. Rolling it inside the
  // think block tied it to `react`, so the legendary bot (thinking 25x/s) pressed 8x more
  // often than the easy one at the same nominal aggression — the dial did the opposite of
  // what its name said.
  bot.modeT = (bot.modeT ?? 0) - dt;
  if (bot.modeT <= 0) {
    bot.press = bot.rng() < d.aggression;
    bot.modeT = 0.8 + bot.rng() * 0.8;
  }

  // ---- think on a cadence so it visibly reacts rather than tracking perfectly ----
  if (bot.t >= bot.nextThink) {
    bot.nextThink = bot.t + d.react;
    const err = (bot.rng() * 2 - 1) * d.error;

    const landing = predictX(b, C.GROUND_Y - C.BALL_R) + err;
    const myGoalX = p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
    const depth = (b.x - myGoalX) * p.side;        // 0 at my line, ~W at theirs
    const incoming = b.vx * p.side < -40;          // travelling at my goal

    // Pressing is a privilege, not the default: only chase into their half when I'm
    // genuinely the nearer player. Bots that always charged finished matches 15-12
    // because both of them were mid-pitch every time the ball came back.
    const iAmNearer = Math.abs(b.x - p.x) < Math.abs(b.x - foe.x);

    if (depth < C.W * 0.42 || incoming) {
      // My half, or a ball heading home: intercept, and always stand GOAL-SIDE of it
      // so a whiff still leaves my body between the ball and the net.
      bot.aim = landing - p.side * 34;
    } else if (iAmNearer) {
      // Nearer to a loose ball in their half: go and get it. This is not aggression,
      // it is just playing — gating it behind the dial made the legendary bot a passive
      // keeper that lost 6-3 to the reckless one because it never attacked.
      bot.aim = landing - p.side * 20;
    } else if (bot.press) {
      bot.aim = landing - p.side * 20;             // chasing a ball I am NOT nearer to
    } else {                                        // is the over-commit `aggression` buys
      bot.aim = myGoalX + p.side * 150;            // hold a defensive slot
    }

    // ---- the crate ----------------------------------------------------------
    // A pickup no opponent contests is not a mechanic, it is a free gift to the human. So
    // the bot races for it — and it races for the TELEGRAPH, not for the live item, because
    // reacting only once a thing is collectable is a second late and loses every race a
    // human is also in.
    //
    // Skill-scaled like everything else on this ladder: `aim` is how reliably it wants the
    // crate at all AND how far off its football job it is willing to wander. The very-easy
    // bot walks past most of them; the legendary one is standing on the spot when it lights.
    const pk = activePickup(m);
    bot.puGo = false;
    if (!pk) {
      bot.puFor = null;
    } else {
      // Decide ONCE per crate, exactly like powerPlan. Rolling it every think would tie the
      // dial to `react` and let the legendary bot (thinking 25x/s) re-roll its mind eight
      // times for every roll the easy one gets — the bug that made `aggression` do the
      // opposite of what its name said.
      const id = pk.x * 8 + pk.kind;
      if (bot.puFor !== id) {
        bot.puFor = id;
        bot.puWant = bot.rng() < 0.22 + d.aim * 0.78;
      }
      // Never enter a race that is already lost, and never take a detour so long that the
      // net is open when the ball comes back. Those two are the whole safety here; the
      // goal-side caps below then get the last word anyway.
      const winnable = Math.abs(pk.x - p.x) <= Math.abs(pk.x - foe.x) + 40;
      const detour = Math.abs(pk.x - bot.aim);
      if (bot.puWant && winnable && !incoming && detour < C.W * (0.16 + d.aim * 0.34)) {
        bot.aim = pk.x;
        bot.puGo = true;
      }
    }

    // Never chase past the ball toward their goal while it's mine to defend, and never
    // abandon my half entirely — the two ways a chasing bot gifts an open net.
    const goalSideCap = b.x - p.side * 8;
    if (incoming || depth < C.W * 0.42) {
      bot.aim = p.side > 0 ? Math.min(bot.aim, goalSideCap) : Math.max(bot.aim, goalSideCap);
    }
    const pressCap = myGoalX + p.side * C.W * 0.66;
    bot.aim = p.side > 0 ? Math.min(bot.aim, pressCap) : Math.max(bot.aim, pressCap);
    bot.aim = Math.max(C.GOAL_W + 30, Math.min(C.W - C.GOAL_W - 30, bot.aim));

    // Recovery dash: too far from home with the ball coming, burn the dash to get back.
    bot.wantDash = incoming && Math.abs(p.x - myGoalX) > 260 && (bot.aim - p.x) * p.side < 0;

    // Tackle when the OPPONENT is in boot range and the ball is not — free gauge, and it
    // slows them. Skill-scaled: a weak bot rarely spots it, the legendary one always does.
    const foeNear = Math.abs(foe.x - p.x) < C.KICK_REACH + C.KICK_R * 0.8 &&
                    Math.abs(foe.y - p.y) < C.BODY_H + C.HEAD_R;
    // Tackling is an OFF-BALL move. Gating it only on "the ball is not on my boot" made the
    // legendary bot tackle in contested situations and lose 6-3 to the reckless one: the
    // gauge is not worth surrendering a 50/50 for. It only pays when the ball is genuinely
    // someone else's problem and nothing is heading at my goal.
    // "Opponent on my boot AND ball 200px away AND in their half" almost never co-occurred —
    // both players chase the same ball, so they are close to each other exactly when the ball
    // is close too. Measured: 0 tackles a match. The only condition that really matters is
    // not turning your back on a ball heading for your own goal.
    const ballFar = Math.abs(b.x - p.x) > 140;
    // Tackling is how the power gauge is earned now — three hits buy a volley — so a bot with
    // an empty gauge should WANT the hit rather than take it only when it happens to be
    // convenient. Measured before this line existed: a level-1 bot charged 78 times over
    // sixteen matches and a level-5 bot six, because the good bot plays positionally and the
    // flailing one blunders into people. That is the gradient upside down.
    // `ballFar` used to be part of this, and under the new gauge rule it inverted the whole
    // ladder: a good bot is nearly always ON the ball, so it never met the condition, never
    // tackled, and never earned a volley — while a bad bot, who loses the ball constantly,
    // farmed the gauge by blundering into people. Measured over twenty matches: the level-2
    // bot charged 101 times to the level-5 bot's 11, and won.
    //
    // So with an empty gauge, a hit on the man is worth taking even when the ball is right
    // there. Going for the man to earn the super IS the game Adam described; the better bot
    // should understand that first.
    const needGauge = p.gauge < 1;
    bot.wantTackle = foeNear && !incoming && foe.tackleImmune <= 0
                     && (ballFar || needGauge)
                     && bot.rng() < Math.min(0.95, d.aim * (needGauge ? 1.5 : 1));

    // Jump when the ball is genuinely headable, not just "high".
    const dxb = Math.abs(b.x - p.x);
    const headable = b.y < C.GROUND_Y - C.BODY_H - 20 && b.y > C.CEIL_Y + 40;
    bot.wantJump = headable && dxb < C.HEAD_R * 2.4 && p.onGround && bot.rng() < 0.85;
  }

  // ---- steering ----
  const dx = bot.aim - p.x;
  out.left = dx < -12;
  out.right = dx > 12;

  // Dashing is a double-tap, so a bot that just holds the key can never dash. Emit the
  // literal pattern the sim listens for: off, on, off, on — two rising edges in 4 frames.
  if (bot.wantDash && bot.dashPulse == null && p.dashCd <= 0 && (out.left || out.right)) {
    bot.dashPulse = 0;
    bot.pulseDir = out.right ? 1 : -1;
  }
  if (bot.dashPulse != null) {
    const pressed = bot.dashPulse % 2 === 1;
    out.left = pressed && bot.pulseDir < 0;
    out.right = pressed && bot.pulseDir > 0;
    if (++bot.dashPulse > 3) { bot.dashPulse = null; bot.wantDash = false; }
  }

  // ---- jump / kick are continuous checks: they need frame accuracy, not think-cadence ----
  const dxb = b.x - p.x;
  const adxb = Math.abs(dxb);
  const bh = b.y - headY(p);
  out.jump = bot.wantJump || (p.onGround && adxb < C.HEAD_R * 2 && bh < -30 && bh > -170);
  if (out.jump) bot.wantJump = false;

  const kickable = adxb < C.KICK_REACH + C.KICK_R &&
                   b.y > p.y - C.BODY_H - 10 &&
                   dxb * p.side > -20;               // ball is in front of me, goalward
  // Timing is the skill the ladder was missing. A strong bot swings when the ball is on its
  // boot; a weak one also swings at nothing, burning KICK_COOLDOWN and arriving late for the
  // touch that mattered. Without this, every tier kicked identically and only the aim of the
  // shot differed — not enough to separate them over a 60-second match.
  const whiff = (1 - d.aim) * 0.06;                   // per-frame chance of a pointless swing
  const swingAtNothing = !kickable && !bot.wantTackle && bot.rng() < whiff;
  out.kick = (kickable || bot.wantTackle || swingAtNothing) && p.kickCd <= 0 && bot.rng() < 0.85;
  if (out.kick && bot.wantTackle) bot.wantTackle = false;

  // Facing comes from the movement keys, so "aim" is literally which way I'm holding when
  // the boot connects. A weak bot swings whichever way it happened to be running.
  if (out.kick && bot.dashPulse == null) {
    // A tackle needs the boot pointed at the OPPONENT; a shot needs it pointed at the goal.
    const atFoe = Math.abs(foe.x - p.x) < C.KICK_REACH + C.KICK_R && !kickable;
    const aimed = bot.rng() < d.aim;
    const want = atFoe ? (Math.sign(foe.x - p.x) || p.facing) : (aimed ? p.side : -p.side);
    out.left = want < 0; out.right = want > 0;
  }

  // ---- power: arm it when the ball is reachable, don't waste it mid-pitch ----
  // The power button buys a committed wind-up now, so the bot should press it when the volley
  // has somewhere to go — not when the ball is at its feet, because the wind-up takes the
  // ball wherever it is.
  const wantPower = p.gauge >= 1 && p.charge <= 0 && b.power == null &&
                    bot.t > d.powerHold &&
                    (foe.x - p.x) * p.side > -80;      // the goal I am shooting at is ahead
  out.power = wantPower;

  playCards(bot, m, p, foe, b, dt, adxb);

  return out;
}

// ---------------------------------------------------------------------------
// THE BOT'S HAND
//
// A hand only the human can press is not a mechanic, it is a handicap — so the bot holds
// the same three cards and plays them by the same rules. What separates the tiers is the
// same thing that separates everything else about this bot: WHEN. A legendary bot spends a
// card at the moment it does something (the ball is live and near, the opponent is on it);
// the easiest one presses on a slow timer whether or not the moment is right.
//
// Deliberately NOT modelled: holding a card back for a better moment later. A bot that
// hoards is a bot that never uses its hand, and an opponent whose abilities never appear
// teaches a player that the mechanic does not matter.
// The x of the goal a player defends — the one on their own side.
const goalX = (p) => (p.side > 0 ? 0 : C.W);

function playCards(bot, m, p, foe, b, dt, adxb) {
  const out = bot.out;
  out.card1 = out.card2 = out.card3 = false;
  if (!m.cards || C.CARDS_ON < 0.5) return;

  bot.cardWait = Math.max(0, bot.cardWait - dt);
  if (bot.cardWait > 0 || m.phase !== 'play') return;

  const d = bot.d;
  const i = p.index;
  const ballNear = adxb < 260;
  const foeOnBall = Math.abs(foe.x - b.x) < 90;

  // Worth it right now? A weak bot barely asks the question — that IS the difficulty.
  let best = -1, bestScore = 0;
  for (let s = 0; s < CARD_SLOTS; s++) {
    if (!cardReady(m, i, s)) continue;
    const kind = cardKind(m, i, s);
    if (liveKind(m, i, kind)) continue;              // already running: pressing wastes it

    let score = 0.35;                                 // a card in hand is worth playing
    if (kind === PU.MAGNET) score += ballNear ? 0.5 : -0.2;
    if (kind === PU.ICE) score += foeOnBall ? 0.5 : -0.1;
    if (kind === PU.CHARGE) score += p.gauge < 0.6 ? 0.45 : -0.3;
    if (kind === PU.SHIELD) score += (foe.armed > 0 || foe.gauge >= 1) ? 0.5 : -0.05;
    if (kind === PU.GROW) score += ballNear ? 0.35 : 0;
    if (kind === PU.SPRING) score += b.y < C.GROUND_Y - 120 ? 0.4 : 0;
    // The four specials. Each is worth pressing at a different moment, and a bot that fires
    // them at random is a bot that teaches the player they do not matter.
    if (kind === PU.DART) {
      // Worth a shot when they are in front of you and far enough away to be worth a dart
      // rather than a boot — and it pays either way, so an empty net is also a reason.
      const ahead = (foe.x - p.x) * p.facing > 0;
      score += ahead && Math.abs(foe.x - p.x) > 120 ? 0.55 : -0.15;
    }
    if (kind === PU.GOALWALL) {
      // Only when the ball is actually coming at my goal. A wall up at the other end is a
      // wasted cooldown, which is exactly how a special stops feeling special.
      const danger = (b.x - p.x) * p.side < 0 && Math.abs(b.x - goalX(p)) < 300;
      score += danger ? 0.75 : -0.4;
    }
    if (kind === PU.SUPERKICK) score += adxb < 200 ? 0.6 : -0.25;
    if (kind === PU.DOG) score += foe.onGround && Math.abs(foe.x - p.x) > 180 ? 0.5 : -0.1;
    // The read itself is a skill: a weak bot's judgement is mostly noise, a strong one's is
    // mostly the situation. Same shape as `aim` for the boot.
    score = score * d.aim + bot.rng() * (1 - d.aim);
    if (score > bestScore) { bestScore = score; best = s; }
  }

  if (best < 0) return;
  // Even a good read is not instant, and nothing here should look like a machine.
  if (bestScore < 0.45 && bot.rng() > 0.02) return;
  out[CARD_KEYS[best]] = true;
  // One press, then a pause scaled to the tier: the easiest bot goes quiet for four seconds
  // after a card, the legendary one is thinking again inside one.
  bot.cardWait = 0.8 + d.react * 12;
}
