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

const TOE_BIAS = 0.8;

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
    out.left = p.x > spot + 5; out.right = p.x < spot - 5;
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
    out.left = p.x > block + 8;
    out.right = p.x < block - 8;
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
      // HOLD the jump, do not tap it. Jump height is variable here — JUMP_CUT takes a tap to
      // 45% of a held jump's rise — and with the jump now set just under the crossbar there is
      // no headroom left to throw away. Measured: one block across sixteen matches before this.
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

    // STAND A BOOT'S LENGTH OFF THE BALL, and this is where the ladder lives now.
    //
    // These offsets were 34 and 20 — a shoulder's width, enough to stay goal-side of the ball
    // and no more. That was fine while a kick went wherever you were facing: stand on top of
    // the ball, turn, swing, connect. The boot only swings toward the goal you attack now, so
    // the ball has to be on your ATTACKING side to be playable at all, and the kick circle
    // does not even begin until KICK_REACH px out — a bot hugging the ball at 34 has it behind
    // the swing and can do nothing with it but shin it.
    //
    // So the offset IS the skill: a good bot parks itself a boot's length from where the ball
    // is going, a weak one stands on top of it and can only shin it. Measured over sixteen
    // matches, with everything else already forward-only: at the flat 34 this used to be, the
    // legendary bot lost to the very-easy one by nine.
    //
    // And it parks a little FURTHER out than that, because the contact point is a choice now
    // and the best shot in the game is made on the toe: dead flat, straight at the goal, half
    // again the pace of the lofted kick off the middle of the foot (see KICK_TOE_LOFT). So the
    // bot that can aim stands where the ball will arrive on its TOE CAP — KICK_REACH plus most
    // of the circle's radius — and the one that cannot just crowds it.
    const wantAlong = d.aim * TOE_BIAS;             // -1 ankle … +1 toe cap
    // Against the CONTACT radius, which is what the sim divides the contact point by.
    const standOff = 10 + d.aim * (C.KICK_REACH + wantAlong * (C.KICK_R + C.BALL_R) - 10);

    if (depth < C.W * 0.42 || incoming) {
      // My half, or a ball heading home: intercept, and always stand GOAL-SIDE of it
      // so a whiff still leaves my body between the ball and the net.
      bot.aim = landing - p.side * standOff;
    } else if (iAmNearer) {
      // Nearer to a loose ball in their half: go and get it. This is not aggression,
      // it is just playing — gating it behind the dial made the legendary bot a passive
      // keeper that lost 6-3 to the reckless one because it never attacked.
      bot.aim = landing - p.side * standOff;
    } else if (bot.press) {
      bot.aim = landing - p.side * standOff;       // chasing a ball I am NOT nearer to
    } else {                                        // is the over-commit `aggression` buys
      bot.aim = myGoalX + p.side * 150;            // hold a defensive slot
    }

    // ARMED MYSELF: go and get the ball. The ultimate is spent by TOUCHING it now, so being
    // armed is a reason to close on the ball rather than to wait for a moment — and this is
    // the whole of the bot's "use the ultimate". It walks into the ball like a player does;
    // there is no path here that reaches the shot any other way.
    if (p.armed > 0) bot.aim = b.x;
    // CARRYING THE BALL (the arcade's דבק): walk it at their goal.
    if (m.champ && carrying(m, index)) bot.aim = (p.side > 0 ? C.W - C.GOAL_W : C.GOAL_W) - p.side * 150;

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
                     && bot.rng() < Math.min(0.95, d.aim * (needGauge ? 1.5 : 1) * (d.tackle ?? 1));

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
  // How much higher a jump actually puts the head, derived rather than typed: the apex of the
  // rise, plus the head's own radius, because the crown meets the ball. This was a flat -170,
  // authored against a jump that rose 150px; the jump is now tied to GOAL_H and rises 55, and a
  // bot leaping at a ball 170px over its head is a bot jumping at nothing. Ratio of two paced
  // values, so PACE leaves it alone.
  const jumpGain = (C.JUMP_V * C.JUMP_V) / (2 * C.PLAYER_GRAV) + C.HEAD_R;
  out.jump = bot.wantJump || (p.onGround && adxb < C.HEAD_R * 2 && bh < -30 && bh > -jumpGain);
  if (out.jump) bot.wantJump = false;

  // IS THE BALL EVEN IN FRONT OF ME? The single biggest thing that separates the tiers now,
  // and it used to be free: every bot got the check, so no bot ever swung at a ball sitting on
  // its own goal side. That cost nothing while the boot followed the facing — a swing with the
  // ball behind you simply turned round and connected — but forward-only it is a swing at
  // fresh air, and getting ROUND the ball before playing it is most of what the new rule asks
  // of anybody. So it is skill now: the legendary bot always checks, the weakest one usually
  // does not and hits nothing while the cooldown runs. That one line is worth ten goals over
  // sixteen matches, and without it the ladder sits inverted.
  const kickable = adxb < C.KICK_REACH + C.KICK_R &&
                   b.y > p.y - C.BODY_H - 10 &&
                   (dxb * p.side > -20 || bot.rng() > d.aim);

  // Timing is the skill the ladder was missing. A strong bot swings when the ball is on its
  // boot; a weak one also swings at nothing, burning KICK_COOLDOWN and arriving late for the
  // touch that mattered. Without this, every tier kicked identically and only the aim of the
  // shot differed — not enough to separate them over a 60-second match.
  const whiff = (1 - d.aim) * 0.06;                   // per-frame chance of a pointless swing
  const swingAtNothing = !kickable && !bot.wantTackle && bot.rng() < whiff;

  // WHERE ON THE BOOT. Which part of the foot reaches the ball IS the shot now (see
  // KICK_TOE_LOFT), so WHEN to swing is a decision and not just "am I in range": 0 here is the
  // middle of the boot and ±1 its two ends. A good bot waits for the ball to arrive on the part
  // of the foot it wants; a weak one swings the moment anything enters the circle and takes
  // whatever contact it is handed, which is usually a toe-end scuff.
  //
  // Except in your own third, where there is no time to be picky and anything that moves the
  // ball away is the right answer. Without that exception the good bot stood over the ball
  // choosing a shot while the other one bundled it in.
  // The window is around the contact this bot was aiming for (the toe, for one that can aim),
  // not around the middle of the boot — a legendary bot standing where the toe cap meets the
  // ball would otherwise refuse the very swing it walked there to take.
  const along = (dxb * p.side - C.KICK_REACH) / (C.KICK_R + C.BALL_R);
  const dangerous = (b.x - (p.side > 0 ? C.GOAL_W : C.W - C.GOAL_W)) * p.side < C.W * 0.35;
  const onTheBoot = dangerous || Math.abs(along - d.aim * TOE_BIAS) < 0.5 + (1 - d.aim) * 2;

  out.kick = ((kickable && onTheBoot) || bot.wantTackle || swingAtNothing) &&
             p.kickCd <= 0 && bot.rng() < 0.55 + d.aim * 0.45;
  if (out.kick && bot.wantTackle) bot.wantTackle = false;

  // DRIVING THROUGH THE BALL, which is what this block turns out to have been about all along.
  //
  // It was written as AIM — the boot went wherever you were facing, so holding goalward as the
  // swing landed pointed the shot at the goal and a weak bot was made to hold the other way.
  // The boot goes toward the attacking side now whatever the body does, so none of that aims
  // anything any more. What it still does is decide which way the bot is RUNNING at the moment
  // of contact, and a kick takes 40% of the striker's own pace (see the strike in
  // resolveBallPlayers) — so a bot that runs onto the ball hits it appreciably harder than one
  // that swings while backing away. That was always the larger half of this.
  //
  // Which is why it stays, unchanged, rather than being deleted with the aim it was named
  // after: pulled out, the ladder inverts — the level-1 bot beat the level-5 one by 14 goals
  // over sixteen matches, because the good bot was the one who lost its run-up.
  if (out.kick && bot.dashPulse == null) {
    // A tackle wants the run pointed at the OPPONENT; a shot wants it pointed at the goal.
    const atFoe = Math.abs(foe.x - p.x) < C.KICK_REACH + C.KICK_R && !kickable;
    const driven = bot.rng() < d.aim;
    const want = atFoe ? (Math.sign(foe.x - p.x) || p.facing) : (driven ? p.side : -p.side);
    out.left = want < 0; out.right = want > 0;
  }

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
  //   p.gauge >= 1       — and the meter is now zeroed at every kickoff (clearUltimate), so
  //                        it can only be full again after tackles THIS passage of play.
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
                    bot.t > d.powerHold &&
                    (foe.x - p.x) * p.side > -80 &&   // the goal I am shooting at is ahead
                    armMoment(d, p, b);
  out.power = wantPower;

  return out;
}
