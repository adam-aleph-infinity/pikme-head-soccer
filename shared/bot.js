// Bot opponent. Produces the same {left,right,jump,kick,power} an input device produces,
// so the sim can't tell a bot from a human — and a human can drop into slot 1 later.
//
// Difficulty is one dial (0..5) that moves four things: how fast it reacts, how much it
// mis-reads the ball, how often it spots a counter, and how greedily it commits forward.

import * as C from './constants.js';
import { headY } from './sim.js';

// `aggression` runs BACKWARDS on purpose. Measured over 10 headless matches per setting,
// it is the single dominant term in the scoreline — 0.00 → 0.0 goals a match, 0.15 → 8.3,
// 0.55 → 13.6, and flat above that. It isn't "how good the bot is", it's how often it
// abandons its goal, and a 812px pitch never gives it time to get back. So the weak bots
// are the ones that chase everything and leave the net open; the legendary bot holds its
// post and only presses when it is genuinely the nearer player.
// `aim` is what actually separates the tiers. Defence alone is not skill: when difficulty
// only moved aggression, the legendary bot held its post beautifully and LOST 6-3 to the
// reckless one, because a bot that never aims its kicks cannot score. So the ladder is
// mostly about striking the ball TOWARDS the goal, with discipline as a smaller term.
export const DIFFICULTIES = [
  { name: 'קל מאוד',  react: 0.34, error: 78, counter: 0.02, aggression: 0.45, aim: 0.35, powerHold: 2.2 },
  { name: 'קל',       react: 0.26, error: 58, counter: 0.08, aggression: 0.40, aim: 0.50, powerHold: 1.6 },
  { name: 'בינוני',   react: 0.19, error: 40, counter: 0.18, aggression: 0.36, aim: 0.62, powerHold: 1.1 },
  { name: 'קשה',      react: 0.13, error: 26, counter: 0.32, aggression: 0.32, aim: 0.74, powerHold: 0.7 },
  { name: 'קשה מאוד', react: 0.08, error: 15, counter: 0.48, aggression: 0.28, aim: 0.86, powerHold: 0.4 },
  { name: 'אגדי',     react: 0.04, error: 7,  counter: 0.66, aggression: 0.24, aim: 0.96, powerHold: 0.2 },
];

export function createBot(level = 2, rng = Math.random) {
  const d = DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, level))];
  return {
    level, d, rng,
    t: 0, nextThink: 0,
    aim: C.W / 2,          // the x it is currently walking to (re-picked on each think)
    wantJump: false, wantKick: false,
    counterArmed: false,
    out: { left: false, right: false, jump: false, kick: false, power: false },
  };
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

  // ---- counter attempts get their own fast path: the window is ~2 frames wide ----
  if (b.power && b.power.owner !== index) {
    const dist = Math.hypot(b.x - p.x, b.y - headY(p));
    const incoming = (b.x - p.x) * p.side < 0;      // heading at me, not away
    if (!bot.counterArmed && dist < C.COUNTER_WINDOW * 2.2 && incoming) {
      bot.counterArmed = bot.rng() < d.counter;
      bot.counterDecided = true;
    }
    if (bot.counterArmed && dist < C.COUNTER_WINDOW * 0.82) {
      out.kick = true;
      out.left = out.right = out.jump = out.power = false;
      return out;
    }
    // Not countering: get out of the flight path instead of eating a knockdown.
    if (!bot.counterArmed && dist < 260) {
      const away = b.y < headY(p) + 20;             // high shot → duck under, low → jump over
      out.jump = !away;
      out.kick = false;
      out.left = p.side > 0; out.right = p.side < 0;
      return out;
    }
  } else {
    bot.counterArmed = false;
    bot.counterDecided = false;
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
  out.kick = kickable && p.kickCd <= 0 && bot.rng() < 0.85;

  // Facing comes from the movement keys, so "aim" is literally which way I'm holding when
  // the boot connects. A weak bot swings whichever way it happened to be running.
  if (out.kick && bot.dashPulse == null) {
    const aimed = bot.rng() < d.aim;
    const want = aimed ? p.side : -p.side;
    out.left = want < 0; out.right = want > 0;
  }

  // ---- power: arm it when the ball is reachable, don't waste it mid-pitch ----
  const wantPower = p.gauge >= 1 && p.armed <= 0 &&
                    (adxb < 230 || (b.x - p.x) * p.side > 0) &&
                    bot.t > d.powerHold;
  out.power = wantPower;

  return out;
}
