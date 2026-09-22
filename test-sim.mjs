// Physics + rules tests. Run: node test-sim.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY, headR, hurtTier, serialize, restore } from './shared/sim.js';
import { shotFor, SHOTS } from './shared/powershots.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const NONE = [{}, {}];

// THE ULTIMATE, as the tests have to drive it now: fill the meter, press POWER to ARM, then
// put the ball on the player's body. The press alone does nothing — that is the rule the
// whole file is written around — so every test that needs a power BALL has to make a contact.

// Fill the meter and press POWER once. Returns whether the player came out of it armed.
function armPower(m, i = 0) {
  const p = m.players[i];
  p.gauge = 1; p.prev = {}; m.hitStop = 0;
  const inputs = [{}, {}]; inputs[i] = { power: true };
  step(m, inputs);
  return p.armed > 0;
}

// Put a player where the ultimate's line passes. It leaves from wherever the body met the
// ball — usually head height — so this is simply "head on the ball's line".
function inLine(m, p) {
  p.y = C.GROUND_Y;
  p.vy = 0;
  p.onGround = true;
}

// Arm, then walk the ball into the armed player's head until the ultimate goes off.
function firePower(m, i = 0, dir) {
  const p = m.players[i];
  armPower(m, i);
  m.events.length = 0;
  for (let t = 0; t < 40 && !m.ball.power; t++) {
    m.hitStop = 0;
    // The ball, delivered to the body. Contact is what fires it.
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, [{}, {}]);
    m.events.length = 0;
  }
  if (dir !== undefined && m.ball.power) { m.ball.vx = Math.abs(m.ball.vx) * dir; m.ball.power.dir = dir; }
  return m.ball.power;
}


const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const fresh = (opts) => {
  const m = createMatch(CA, CB, opts);
  m.freeze = 0; m.phase = 'play';
  return m;
};
const run = (m, ticks, inputs = NONE) => {
  for (let i = 0; i < ticks; i++) step(m, typeof inputs === 'function' ? inputs(i, m) : inputs);
  return m;
};

// --- ball physics -----------------------------------------------------------
{
  const m = fresh();
  const y0 = m.ball.y;
  run(m, 10);
  ok('ball falls under gravity', m.ball.y > y0);
  run(m, 240);
  ok('ball settles on the grass', m.ball.y <= C.GROUND_Y - C.BALL_R + 1.5, `y=${m.ball.y.toFixed(1)}`);
  ok('ball does not tunnel through the floor', m.ball.y < C.GROUND_Y + 1);
}
{
  const m = fresh();
  m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vy = 600; m.ball.vx = 0;
  step(m, NONE);
  ok('ball bounces off the grass', m.ball.vy < 0);
  ok('bounce loses energy', Math.abs(m.ball.vy) < 600);
}
{
  const m = fresh();
  m.ball.x = C.W / 2; m.ball.y = 200; m.ball.vy = 0; m.ball.vx = -3000;
  run(m, 30);
  ok('ball speed is capped', Math.hypot(m.ball.vx, m.ball.vy) <= C.BALL_MAX_SPEED + 1);
}

// --- goals ------------------------------------------------------------------
//
// A GOAL IS SHOT, NOT PLACED. These used to drop the ball at x = 40 — already behind the line
// — and step once, because scoring was a test on the ball's POSITION. It is a test on the ball's
// CROSSING now (see enteredGoal in shared/sim.js), so a ball that materialises in the net has
// not scored and never will: there is no entry to see. Every goal in this file is driven in
// from the pitch, which is also the only way a goal happens in the game.
const scoreOn = (m, left, y = C.GROUND_Y - 60, speed = 600) => {
  const b = m.ball;
  b.x = left ? C.GOAL_W + b.r + 2 : C.W - C.GOAL_W - b.r - 2;
  b.y = y; b.vx = left ? -speed : speed; b.vy = 0;
  return run(m, 8);
};
{
  const m = fresh();
  scoreOn(m, true);
  ok('ball driven into the left net scores for player 1', m.score[1] === 1, JSON.stringify(m.score));
  ok('a goal freezes play', m.phase === 'goal');
  ok('positions reset after a goal', Math.abs(m.players[0].x - C.SPAWN_X[0]) < 1);
}
{
  const m = fresh();
  scoreOn(m, false);
  ok('ball driven into the right net scores for player 0', m.score[0] === 1, JSON.stringify(m.score));
}
{
  const m = fresh();
  m.ball.x = 40; m.ball.y = C.GROUND_Y - C.GOAL_H - 40; m.ball.vx = -300; m.ball.vy = 0;
  step(m, NONE);
  ok('a ball ABOVE the mouth is not a goal', m.score[1] === 0);
  // The arena wall is the screen edge, not the goal line — a lob clears the bar and
  // comes back off the wall, which is what makes lobbing a real option.
  m.ball.x = C.BALL_R; m.ball.y = C.GROUND_Y - C.GOAL_H - 40; m.ball.vx = -300;
  step(m, NONE);
  ok('a ball above the mouth bounces off the wall', m.ball.vx > 0);
}
{
  // ⚠️ The bug Adam reported: a ball CLIPPING the top of the goal used to score, because
  // the test was on the ball's centre. Now the whole ball must be under the bar.
  const barY = C.GROUND_Y - C.GOAL_H;
  // Driven straight at the goal AT bar height: it must hit the bar, not sail in.
  const m = fresh();
  m.ball.x = C.GOAL_W + 90; m.ball.y = barY; m.ball.vx = -700; m.ball.vy = 0;
  run(m, 25);
  ok('a shot at crossbar height does NOT score', m.score[1] === 0, `score=${m.score.join('-')}`);

  // …and the same shot a ball-and-a-bit lower goes in, so the bar is not just a wall.
  const m2 = fresh();
  m2.ball.x = C.GOAL_W + 90; m2.ball.y = barY + C.BALL_R + C.POST_R + 8; m2.ball.vx = -700; m2.ball.vy = 0;
  run(m2, 25);
  ok('a shot just under the bar DOES score', m2.score[1] === 1, `score=${m2.score.join('-')}`);
}
{
  // Half over the line is not a goal either — the whole ball has to cross it.
  const m = fresh();
  m.ball.x = C.GOAL_W - 2; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -10; m.ball.vy = 0;
  step(m, NONE);
  ok('a ball straddling the goal line does NOT score', m.score[1] === 0, `x=${m.ball.x.toFixed(1)} line=${C.GOAL_W}`);
}
{
  // The crossbar is now a solid bar across the whole net, so nothing drops in through the roof.
  const barY = C.GROUND_Y - C.GOAL_H;
  const m = fresh();
  m.ball.x = C.GOAL_W / 2; m.ball.y = barY - C.BALL_R - C.POST_R - 4; m.ball.vx = 0; m.ball.vy = 700;
  step(m, NONE);
  ok('the ball bounces off the crossbar', m.ball.vy < 0, `vy=${m.ball.vy.toFixed(0)}`);
  run(m, 40);
  ok('and never falls through the roof of the net', m.score[1] === 0);
}
{
  const m = fresh();
  const conceded = m.players[0], scorer = m.players[1];
  // Both part-filled, so this measures an ADDITION rather than an assignment. A goal used to
  // wipe both meters and then gift the conceder, which passed a `>= BONUS` check while
  // destroying everything either player had earned.
  conceded.gauge = 0.4; scorer.gauge = 0.7;
  scoreOn(m, true);
  ok('(the goal went in)', m.score[1] === 1, `score ${m.score.join('-')}`);
  ok('conceding ADDS the gift to what was there',
     Math.abs(conceded.gauge - (0.4 + C.GAUGE_CONCEDE_BONUS)) < 1e-9, `gauge=${conceded.gauge}`);
  ok('and the scorer keeps their own meter untouched',
     Math.abs(scorer.gauge - 0.7) < 1e-9, `gauge=${scorer.gauge}`);
}

// --- player movement --------------------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  run(m, 30, [{ right: true }, {}]);
  ok('holding right moves right', p.x > C.SPAWN_X[0]);
  ok('walk speed is capped near PLAYER_SPEED', p.vx <= C.PLAYER_SPEED * p.stats.speed + 1);
}
{
  const m = fresh();
  const p = m.players[0];
  step(m, [{ jump: true }, {}]);
  ok('jump leaves the ground', p.vy < 0 && !p.onGround);
  run(m, 200, [{ jump: false }, {}]);
  ok('player lands again', p.onGround && Math.abs(p.y - C.GROUND_Y) < 0.001);
}
{
  const m = fresh();
  const p = m.players[0];
  // tap right, release, tap right again inside DASH_WINDOW
  step(m, [{ right: true }, {}]);
  step(m, [{ right: false }, {}]);
  step(m, [{ right: true }, {}]);
  ok('double-tap dashes', p.dashT > 0 && Math.abs(p.vx) > C.PLAYER_SPEED, `vx=${p.vx.toFixed(0)}`);
}
{
  // A player walks INTO their own goal and is stopped by the BACK of the net, not by the goal
  // line — the mouth is a doorway now, see shared/goalbox.js. test-goal.mjs owns the rest of
  // the room (the crossbar ceiling, no entry from above, no teleports); this is the one line
  // that used to say the opposite and has to keep saying the new thing.
  const m = fresh();
  run(m, 400, [{ left: true }, { right: true }]);
  ok('player 0 stops at the back of its net', m.players[0].x >= C.POST_R + C.BODY_W / 2 - 0.01, `x=${m.players[0].x}`);
  ok('player 0 got past the goal line', m.players[0].x < C.GOAL_W, `x=${m.players[0].x}`);
  ok('player 1 stops at the back of its net', m.players[1].x <= C.W - C.POST_R - C.BODY_W / 2 + 0.01);
  ok('player 1 got past the goal line', m.players[1].x > C.W - C.GOAL_W, `x=${m.players[1].x}`);
}
{
  const m = fresh();
  m.players[0].x = 400; m.players[1].x = 404;
  step(m, NONE);
  ok('players push apart', Math.abs(m.players[1].x - m.players[0].x) > 4);
}

// --- striking the ball ------------------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
  m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  // Relative to KICK_POWER, not a literal: PACE rescales every speed, so an absolute
  // threshold here just breaks the day someone slows the game down.
  ok('kick launches the ball forward', m.ball.vx > C.KICK_POWER * 0.6, `vx=${m.ball.vx.toFixed(0)} of ${C.KICK_POWER.toFixed(0)}`);
  ok('kick lifts the ball', m.ball.vy < 0);
}
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4;
  m.ball.vx = 0; m.ball.vy = 300;
  step(m, NONE);
  // A head DEADENS now (HEAD_DEADEN), like the chest but livelier — it does not bounce the
  // ball away. Hitting it hard is a deliberate act: the boot, or the kick button at head
  // height. This used to assert `vy < 0`.
  ok('a head kills the ball rather than bouncing it', Math.abs(m.ball.vy) < 120,
     `vy=${m.ball.vy.toFixed(0)} off a drop`);
}
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4;
  m.ball.vy = 300;
  const before = Math.abs(m.ball.vy);
  step(m, NONE);
  // This used to assert the head was SPRINGIER than the ground. It is now deliberately the
  // opposite: at HEAD_POWER 0.52 a head is a control surface — it cushions and redirects —
  // and the boot (or a deliberate header on the kick button) is the only thing that hits the
  // ball hard. Heading used to beat playing, which is why the number came down twice.
  ok('a head CUSHIONS the ball rather than launching it',
     Math.abs(m.ball.vy) < before * C.BALL_BOUNCE,
     `${Math.abs(m.ball.vy).toFixed(0)} back off a ${before.toFixed(0)} drop, vs ${(before * C.BALL_BOUNCE).toFixed(0)} off the ground`);
}

{
  // Holding JUMP while kicking lobs it — the only aiming in the game, and the counter to a
  // defender camped on their line.
  const flat = fresh(), lob = fresh();
  for (const m of [flat, lob]) {
    const p = m.players[0];
    m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
  }
  step(flat, [{ kick: true }, {}]);
  step(lob, [{ kick: true, jump: true }, {}]);
  ok('a lob goes higher', lob.ball.vy < flat.ball.vy,
     `lob vy=${lob.ball.vy.toFixed(0)} flat vy=${flat.ball.vy.toFixed(0)}`);
  ok('a lob goes less far', Math.abs(lob.ball.vx) < Math.abs(flat.ball.vx),
     `lob vx=${lob.ball.vx.toFixed(0)} flat vx=${flat.ball.vx.toFixed(0)}`);
  ok('a lob still goes forward', lob.ball.vx > 0);
}

// --- power shots ------------------------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 0.5;
  step(m, [{ power: true }, {}]);
  ok('a half gauge cannot arm', p.armed === 0);
}
{
  const m = fresh();
  const p = m.players[0];
  armPower(m, 0);
  // Pinned out of reach up by the ceiling every tick: no contact, and no accidental goal to
  // reset the match out from under the assertion. The arm has no clock on it, so it waits.
  for (let i = 0; i < 600; i++) {
    m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{}, {}]);
  }
  ok('an arm that never reaches the ball keeps waiting', p.armed > 0, `armed=${p.armed}`);
  ok('and it costs the meter nothing to wait', p.gauge >= 1, `gauge=${p.gauge}`);
}
{
  // a straight power shot ignores gravity
  const m = fresh();
  const p = m.players[0];
  p.shot = SHOTS.blaze;
  firePower(m, 0);
  const y0 = m.ball.y;
  run(m, 12);
  ok('straight power shot holds its line', Math.abs(m.ball.y - y0) < 30, `dy=${(m.ball.y - y0).toFixed(1)}`);
}
{
  // A POWER SHOT HURTS YOU. IT DOES NOT SWITCH YOU OFF.
  //
  // This block used to assert the opposite: `b.knocked > 0`, and then that the defender's
  // input was ignored for the length of it. That was the old signature effect — grey head, no
  // controls — and it is what the damage system replaces. Taking a power shot on the body is
  // still the heaviest hit in the game; it is just paid in health now.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze;
  b.x = a.x + 300;
  firePower(m, 0);
  // AFTER the volley is away, not before: the wind-up is half a second long and gravity puts
  // a defender back on the grass inside it, so a defender parked in the air before the press
  // is standing again by the time the ball arrives. This is the position a jumping one is in
  // as it passes — standing is safe from this shot, which is the entire point of the move.
  inLine(m, b);
  run(m, 30);
  ok('a power shot costs the defender health', b.hp < 1, `hp=${b.hp.toFixed(2)}`);
  ok('and it is the heaviest hit there is', 1 - b.hp >= C.POWER_DAMAGE - 0.05,
     `took ${(1 - b.hp).toFixed(2)} of ${C.POWER_DAMAGE}`);
  ok('one power shot is not enough to stun anybody', b.stunned === 0 && b.hp > 0,
     `stunned=${b.stunned}`);
  // The old test proved the defender was frozen by comparing them against a control that was
  // given no input. Same comparison, opposite expectation: a hit player still plays.
  const ctrl = fresh();
  const ca = ctrl.players[0], cb = ctrl.players[1];
  ca.shot = SHOTS.blaze;
  cb.x = ca.x + 300;
  firePower(ctrl, 0);
  inLine(ctrl, cb);
  run(ctrl, 30);
  run(m, 5, [{}, { right: true }]);      // held right
  run(ctrl, 5, [{}, {}]);                // held nothing
  ok('a damaged defender still answers the controls', Math.abs(b.vx - cb.vx) > 20,
     `input ${b.vx.toFixed(1)} vs no input ${cb.vx.toFixed(1)}`);
}
{
  // …and nothing about which character fired it locks the defender down. `tentacles` used to
  // ROOT whoever blocked it — the total lockout, the one the old comments called the hardest
  // in the game. Every shot lands the same consequence now, and it is a number off their
  // health, so this asserts what it must never do again: take a player's legs away.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.tentacles;
  firePower(m, 0);
  // Wait for the shot to actually ARRIVE rather than for a fixed 40 ticks — at a slower
  // PACE the ball had not reached the defender yet. And hold the defender on the volley's
  // line every tick: it flies above a standing head by design, and gravity pulls a defender
  // out of its path in a handful of frames.
  for (let i = 0; i < 240 && b.hp >= 1; i++) { inLine(m, b); step(m, NONE); }
  ok('tentacles damage the defender like anything else', b.hp < 1, `hp=${b.hp.toFixed(2)}`);
  const x0 = b.x;
  run(m, 20, [{}, { left: true }]);
  ok('and the defender can still walk away', Math.abs(b.x - x0) > 10,
     `moved ${Math.abs(b.x - x0).toFixed(1)}px`);
}
{
  // counter: kicking a live enemy power ball flips ownership and direction
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze;
  firePower(m, 0);
  ok('power ball exists before the counter', !!m.ball.power);
  // Firing a power shot sets hit-stop, and a frozen step ignores input by design. Clear it
  // so this test is about the COUNTER and not about the freeze.
  m.hitStop = 0;
  m.ball.x = b.x - 40; m.ball.y = headY(b);
  step(m, [{}, { kick: true }]);
  ok('countering flips ownership', m.ball.power && m.ball.power.owner === 1, `owner=${m.ball.power?.owner}`);
  ok('countering flips direction', m.ball.power && m.ball.power.dir === b.side);
  ok('the countered ball travels back', m.ball.vx * b.side > 0);
}
{
  // a counter kick from too far away does nothing
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze;
  firePower(m, 0);
  m.hitStop = 0;
  m.ball.x = C.W / 2; m.ball.y = 200;
  step(m, [{}, { kick: true }]);
  ok('an out-of-range kick does not counter', m.ball.power.owner === 0);
}

// --- the ultimate: the button ARMS, the TOUCH fires -------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.hitStop = 0;
  firePower(m, 0);
  ok('a touch on the ball is what fires it', !!m.ball.power);
  ok('and it flies flat and fast', Math.abs(m.ball.vx) > C.KICK_POWER * 1.5 && Math.abs(m.ball.vy) < 60,
     `v=(${m.ball.vx.toFixed(0)}, ${m.ball.vy.toFixed(0)})`);
  ok('firing spends the arm', p.armed === 0);
  ok('and the meter with it', p.gauge === 0, `gauge=${p.gauge}`);
}
{
  // Blockable, not a battering ram: getting in the way has to save the goal, or the
  // defender has nothing to do and every power shot is an automatic goal.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze;
  m.hitStop = 0;
  b.x = a.x + 260;
  firePower(m, 0);
  inLine(m, b);                       // where a jumping defender is; standing is safe by design
  m.hitStop = 0;
  run(m, 30);
  ok('a defender in the path blocks it', m.events.some((e) => e.type === 'blocked') || !m.ball.power,
     'shot went through');
  ok('a blocked shot comes back out', m.ball.vx <= 0 || !m.ball.power, `vx=${m.ball.vx.toFixed(0)}`);
  ok('but the blocker pays for it', b.hp < 1, `blocking was free (hp ${b.hp.toFixed(2)})`);
}
{
  // ARMED BEATS INCOMING: a defender who is ALSO armed and gets hit by the incoming shot does
  // not just block it and take the damage — the touch fires their own ultimate instead, same
  // as any other touch on the ball while armed. Their shot replaces the incoming one entirely.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze; b.shot = SHOTS.wave;
  firePower(m, 0, 1);                 // a's shot, flying toward b
  ok('the incoming shot is a\'s', m.ball.power && m.ball.power.owner === 0);
  ok('b starts unarmed', b.armed === 0);
  armPower(m, 1);                     // b arms while a's shot is already live
  ok('b is armed with a live enemy shot on the pitch', b.armed > 0 && !!m.ball.power);
  m.hitStop = 0;
  m.ball.x = b.x; m.ball.y = headY(b); m.ball.vx = 0; m.ball.vy = 0;
  m.events.length = 0;
  step(m, [{}, {}]);
  ok('b took no damage', b.hp === 1, `hp=${b.hp.toFixed(2)}`);
  ok('the touch fired b\'s own shot, not a\'s', m.ball.power && m.ball.power.shot.id === 'wave',
     `shot=${m.ball.power?.shot.id}`);
  ok('ownership moved to b', m.ball.power && m.ball.power.owner === 1);
  ok('b\'s arm and gauge are spent', b.armed === 0 && b.gauge === 0);
  ok('the event says it was a counter', m.events.some((e) => e.type === 'powershot' && e.countered),
     JSON.stringify(m.events));
}
{
  // EVERY CHARACTER'S POWER LANDS THE SAME CONSEQUENCE, and that is the change. This used to
  // assert the opposite — that the five shots produced at least three DIFFERENT effects — back
  // when each one left its own lockout on whoever blocked it. The lockouts are gone, so what
  // is left to differ is speed and colour, and the consequence is one number for all of them.
  for (const id of Object.keys(SHOTS)) {
    const shot = SHOTS[id];
    ok(`${id} no longer carries a signature effect`, shot.effect === undefined);
    ok(`${id} still has its own speed and colour`, shot.speed > 0 && /^#/.test(shot.color));
  }
  const dmg = Object.keys(SHOTS).map((id) => {
    const m = fresh();
    const a = m.players[0], d = m.players[1];
    a.shot = SHOTS[id];
    d.x = a.x + 300;
    firePower(m, 0);
    inLine(m, d);
    run(m, 30);
    return +(1 - d.hp).toFixed(4);
  });
  ok('and every one of them costs the same health', new Set(dmg).size === 1, dmg.join(','));
}

// --- the head deadens too, just less -----------------------------------------
{
  // Both surfaces kill the ball now; the head keeps twice as much of it as the chest. This
  // block used to assert the head BOUNCED (vy < -100) — that was the trampoline Adam asked
  // twice to remove, and the second ask was to make it a body part rather than a softer
  // trampoline.
  const drop = (yOffset) => {
    const m = fresh();
    const p = m.players[0];
    m.ball.x = p.x; m.ball.y = headY(p) + yOffset; m.ball.vy = 400;
    step(m, NONE);
    return Math.abs(m.ball.vy);
  };
  const head = drop(-C.HEAD_R - C.BALL_R + 4);
  ok('a head takes the pace off the ball', head < 400 * 0.6, `${head.toFixed(0)} of 400`);
  ok('and it is livelier than the chest', C.HEAD_DEADEN > C.BODY_DEADEN,
     `head ${C.HEAD_DEADEN} vs body ${C.BODY_DEADEN}`);
}
{
  // Low contact — chest height and below — kills it. At Head Soccer proportions the torso
  // is a sliver, so this is a rule about HEIGHT on the silhouette, not about which box.
  const m = fresh();
  const p = m.players[0];
  const hy = headY(p);
  m.ball.x = p.x + (C.HEAD_R + C.BALL_R) * 0.7;
  m.ball.y = hy + (C.HEAD_R + C.BALL_R) * 0.7;      // ny ≈ 0.7, well past DEADEN_ZONE
  m.ball.vx = -600; m.ball.vy = 0;
  step(m, NONE);
  ok('low contact deadens the ball', Math.abs(m.ball.vx) < 200, `vx=${m.ball.vx.toFixed(0)} (was -600)`);
  ok('and it does not fly back', m.ball.vx > -200);
}
{
  // The crown used to bounce so that heading was a tool. Heading is still a tool — it is just
  // the BUTTON now (tryHeader), not a surface. What the crown does passively is take a ball
  // out of the air and drop it, and that is what this asserts.
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 3; m.ball.vy = 400;
  step(m, NONE);
  ok('the crown takes a falling ball out of the air', Math.abs(m.ball.vy) < 200,
     `vy=${m.ball.vy.toFixed(0)} from a 400 drop`);
}

// --- tackling ---------------------------------------------------------------
{
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  m.ball.x = C.W / 2; m.ball.y = 100;                    // ball nowhere near
  b.x = a.x + C.KICK_REACH;                              // stand the victim on the boot
  a.gauge = 0;
  step(m, [{ kick: true }, {}]);
  ok('kicking the opponent lands a tackle', m.events.some((e) => e.type === 'tackle'));
  // Not exactly TACKLE_GAUGE: the ordinary per-tick charge lands in the same step.
  ok('the tackler gains gauge', a.gauge >= C.TACKLE_GAUGE && a.gauge < C.TACKLE_GAUGE + 0.01,
     `gauge=${a.gauge.toFixed(4)}`);
  ok('the victim takes damage', b.hp < 1 && b.hp >= 1 - C.KICK_DAMAGE * C.KICK_DAMAGE_BACK - 1e-9,
     `hp=${b.hp.toFixed(3)}`);
  // Within a tick of regen of the live value, not equal to it: the victim's own stepPlayer
  // runs after the tackler's in the same tick and mends HP_REGEN * dt of it straight away.
  ok('the tackle event reports what it took off',
     m.events.some((e) => e.type === 'tackle' && e.damage > 0
                       && Math.abs(e.hp - b.hp) <= C.HP_REGEN * C.TICK + 1e-9),
     JSON.stringify(m.events.filter((e) => e.type === 'tackle')));
  ok('the victim is knocked back', Math.abs(b.vx) > 100, `vx=${b.vx.toFixed(0)}`);
  ok('a tackle grants immunity', b.tackleImmune > 0);
  ok('a tackle causes hit-stop', m.hitStop > 0);
}
{
  // Stun-locking someone out of the match would be the obvious abuse.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  m.ball.x = C.W / 2; m.ball.y = 100;
  b.x = a.x + C.KICK_REACH;
  step(m, [{ kick: true }, {}]);
  m.hitStop = 0; a.kickCd = 0; b.x = a.x + C.KICK_REACH; b.vx = 0;
  m.events.length = 0;
  step(m, [{ kick: false }, {}]);
  step(m, [{ kick: true }, {}]);
  ok('an immune player cannot be re-tackled', !m.events.some((e) => e.type === 'tackle'),
     `immune=${b.tackleImmune.toFixed(2)}`);
}
{
  // A TACKLED PLAYER RUNS AT FULL SPEED. The exact inverse of what this used to assert, which
  // was that a tackle left them at TACKLE_SLOW (55%) for 1.7 seconds. The comparison is kept
  // — same reference run, same 40 ticks — so that if a slow ever creeps back in, this catches
  // it the way the old one caught its absence.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  m.ball.x = C.W / 2; m.ball.y = 100;
  b.x = a.x + C.KICK_REACH;
  step(m, [{ kick: true }, {}]);
  m.hitStop = 0;
  const ref = fresh();
  run(ref, 40, [{ right: true }, {}]);                  // untouched reference
  run(m, 40, [{}, { right: true }]);
  ok('a tackled player is not slowed at all',
     Math.abs(Math.abs(b.vx) - Math.abs(ref.players[0].vx)) < 1,
     `tackled=${Math.abs(b.vx).toFixed(0)} untouched=${Math.abs(ref.players[0].vx).toFixed(0)}`);
}
{
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  b.x = a.x + 400;                                       // far away
  m.ball.x = C.W / 2; m.ball.y = 100;
  step(m, [{ kick: true }, {}]);
  ok('kicking thin air is not a tackle', !m.events.some((e) => e.type === 'tackle'));
}
{
  // The boot is spent on the player, so a tackle must not also blast the ball.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  b.x = a.x + C.KICK_REACH;
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = a.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  ok('a tackle consumes the kick', a.kickT === 0);
}

// --- jump feel --------------------------------------------------------------
{
  // COYOTE: jump still works just after leaving the ground.
  const m = fresh();
  const p = m.players[0];
  p.onGround = false; p.y = C.GROUND_Y - 6; p.vy = 40; p.coyote = C.COYOTE_TIME;
  step(m, [{ jump: true }, {}]);
  ok('coyote time still allows a jump', p.vy < 0, `vy=${p.vy.toFixed(0)}`);
}
{
  // …but not forever.
  const m = fresh();
  const p = m.players[0];
  p.onGround = false; p.y = 200; p.vy = 300; p.coyote = 0; p.jumps = 1;
  step(m, [{ jump: true }, {}]);
  ok('an expired coyote window does not jump', p.vy > 0, `vy=${p.vy.toFixed(0)}`);
}
{
  // BUFFER: a press just before landing fires on touchdown instead of being eaten.
  const m = fresh();
  const p = m.players[0];
  p.onGround = false; p.y = C.GROUND_Y - 4; p.vy = 300; p.coyote = 0; p.jumps = 0;
  step(m, [{ jump: true }, {}]);        // pressed mid-air, too late to jump
  ok('the early press is buffered', p.jumpBuf > 0 || p.vy < 0);
  step(m, [{ jump: true }, {}]);        // now on the ground
  ok('a buffered jump fires on landing', p.vy < 0, `vy=${p.vy.toFixed(0)}`);
}
{
  // Falling must be heavier than rising, or the arc reads as floaty. Measure ONE tick of
  // each — comparing two ticks of rise against one of fall proves nothing.
  const m = fresh();
  const p = m.players[0];
  p.onGround = false; p.y = 200; p.vy = -200;
  const upBefore = p.vy;
  step(m, [{ jump: true }, {}]);
  const dRise = p.vy - upBefore;

  p.vy = 200;
  const downBefore = p.vy;
  step(m, [{ jump: true }, {}]);
  const dFall = p.vy - downBefore;

  ok('gravity is heavier on the way down', dFall > dRise * 1.3,
     `rise +${dRise.toFixed(1)}/tick vs fall +${dFall.toFixed(1)}/tick`);
  ok('and by roughly FALL_MULT', Math.abs(dFall / dRise - C.FALL_MULT) < 0.05,
     `ratio ${(dFall / dRise).toFixed(2)} vs ${C.FALL_MULT}`);
}

// --- hit-stop ---------------------------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  ok('a solid kick causes hit-stop', m.hitStop > 0);
  const bx = m.ball.x;
  step(m, [{}, {}]);
  ok('the world is frozen during hit-stop', Math.abs(m.ball.x - bx) < 0.001);
  run(m, 12);
  ok('hit-stop always clears', m.hitStop <= 0);
}
{
  // A press held across the freeze must still register when play resumes, or hit-stop
  // would eat inputs — the exact thing that makes freeze frames feel broken.
  const m = fresh();
  const p = m.players[0];
  m.hitStop = 0.05;
  step(m, [{ jump: true }, {}]);
  ok('input during hit-stop is not consumed', p.vy === 0);
  run(m, 5, [{ jump: true }, {}]);
  ok('and fires once the freeze ends', p.vy < 0, `vy=${p.vy.toFixed(0)}`);
}

// --- gauge & clock ----------------------------------------------------------
{
  const m = fresh();
  run(m, Math.round(C.GAUGE_FULL / C.TICK));
  // The gauge is EARNED off the opponent now — GAUGE_PASSIVE is 0, so a minute of standing
  // about buys nothing. What fills it is tested with the power move at the bottom of this
  // file; this one only guards that the clock stays switched off.
  ok('the clock alone does not fill the gauge', m.players[0].gauge === 0, `gauge=${m.players[0].gauge.toFixed(3)}`);
}
{
  const m = fresh({ duration: 0.5 });
  m.score = [2, 1];
  run(m, 40);
  ok('the clock ends the match', m.phase === 'over');
  ok('the leader wins', m.events.some((e) => e.type === 'fulltime' && e.winner === 0));
}
{
  const m = fresh({ duration: 0.5 });
  run(m, 40);
  ok('a draw goes to golden goal', m.golden && m.phase !== 'over');
  const g0 = m.players[0].gauge;
  run(m, 60);
  ok('gauges freeze in golden goal', Math.abs(m.players[0].gauge - g0) < 1e-9, `${g0} → ${m.players[0].gauge}`);
  scoreOn(m, true);
  ok('a golden goal ends it', m.phase === 'over' && m.score[1] === 1);
}

// --- roster -----------------------------------------------------------------
{
  const seen = new Set();
  for (const r of ['common', 'rare', 'epic', 'legendary']) {
    for (let n = 1; n <= 45; n++) {
      const s = shotFor(r, n);
      ok(`every card has a shot (${r}_${n})`, !!s && !!s.id && s.speed > 0);
      seen.add(s.id);
    }
  }
  ok('all five shot kinds are reachable', seen.size === 5, [...seen].join(','));
  ok('featured cards get their themed shot', shotFor('legendary', 3).id === 'blaze' && shotFor('legendary', 2).id === 'tentacles');
}

// --- determinism ------------------------------------------------------------
{
  const seq = (i) => [{ right: i % 40 < 20, jump: i % 27 === 0, kick: i % 13 === 0 }, { left: i % 31 < 15, kick: i % 17 === 0 }];
  const a = fresh(); run(a, 600, seq);
  const b = fresh(); run(b, 600, seq);
  ok('the sim is deterministic', JSON.stringify(a.ball) === JSON.stringify(b.ball) && a.score.join() === b.score.join());
}

// --- pace -------------------------------------------------------------------
// PACE has to be slow-motion, not a nerf: the same jump, the same arc, a longer clock.
{
  const shipped = C.PACE;
  const arc = () => {
    let y = 0, vy = -C.JUMP_V, t = 0, apex = 0;
    while (y <= 0) { vy += C.PLAYER_GRAV * (vy > 0 ? C.FALL_MULT : 1) * C.TICK; y += vy * C.TICK; t += C.TICK; apex = Math.min(apex, y); }
    return { apex: -apex, hang: t };
  };
  C.setPace(1); const fast = arc(), fastSpeed = C.PLAYER_SPEED;
  C.setPace(0.5); const slow = arc(), slowSpeed = C.PLAYER_SPEED;
  // The invariance is EXACT in the continuous case — (kv)^2 / (2·k^2·g) = v^2 / (2g) — so what
  // is measured here is the fixed-tick integrator, not the physics. Euler undershoots the apex
  // by about half a tick of velocity, v·TICK/2, which is a constant absolute error against an
  // apex of v^2/2g: the RELATIVE gap between two paces is therefore ~g·TICK/(2·JUMP_V), and it
  // grows as the jump gets smaller. At JUMP_V 830 that was 2.4% and 3% was a fair fence; at the
  // 505 the jump was pulled down to (it is derived from GOAL_H now) it is 3.8%, and the fence
  // was catching the arithmetic rather than a regression. 5% holds it either side of that.
  ok('pace keeps jump height', Math.abs(fast.apex - slow.apex) / fast.apex < 0.05, `${fast.apex.toFixed(1)} vs ${slow.apex.toFixed(1)}`);
  ok('pace stretches hang time', Math.abs(slow.hang / fast.hang - 2) < 0.06, `x${(slow.hang / fast.hang).toFixed(2)}`);
  ok('pace halves running speed', Math.abs(slowSpeed / fastSpeed - 0.5) < 1e-9);
  C.setPace(shipped);
  ok('pace is restorable', Math.abs(C.PLAYER_SPEED - fastSpeed * shipped) < 1e-6);
  ok('setPace ignores nonsense', (C.setPace(0), C.setPace(NaN), C.PACE === shipped));
}

// --- a power shot is as fast as it says it is -------------------------------
// The ball clamp used to run after stepPowerShot and pinned every power shot to
// BALL_MAX_SPEED, which made POWER_SHOT_SPEED a knob wired to nothing.
{
  const m = fresh();
  const p = m.players[0];
  ok('power arms the player', armPower(m, 0) && p.armed > 0);
  firePower(m, 0);
  ok('the touch fires a power shot', !!m.ball.power);
  if (m.ball.power) {
    const sp = Math.hypot(m.ball.vx, m.ball.vy);
    const want = C.POWER_SHOT_SPEED * (m.ball.power.speed || 1) * (m.ball.power.mult || 1);
    ok('a power shot flies at POWER_SHOT_SPEED', sp > want * 0.9, `${sp.toFixed(0)} vs ${want.toFixed(0)}`);
    // The knob is only real if it can push PAST the ordinary ball cap. Shipped, the two are
    // equal, so prove it with a value the old clamp would have eaten.
    const keep = C.POWER_SHOT_SPEED;
    C.tune({ POWER_SHOT_SPEED: C.BALL_MAX_SPEED * 1.6 });
    run(m, 8);                     // the launch hit-stop freezes the ball for ~5 ticks first
    ok('POWER_SHOT_SPEED can exceed BALL_MAX_SPEED',
       Math.hypot(m.ball.vx, m.ball.vy) > C.BALL_MAX_SPEED * 1.4,
       `${Math.hypot(m.ball.vx, m.ball.vy).toFixed(0)} vs cap ${C.BALL_MAX_SPEED.toFixed(0)}`);
    C.tune({ POWER_SHOT_SPEED: keep });
  }
  // …while an ordinary ball is still capped.
  {
    const n = fresh();
    n.ball.vx = C.BALL_MAX_SPEED * 4; n.ball.vy = 0;
    step(n, NONE);
    ok('an ordinary ball is still capped', Math.hypot(n.ball.vx, n.ball.vy) <= C.BALL_MAX_SPEED + 1);
  }
}

// ── A TACKLE FROM BEHIND ──────────────────────────────────────────────────────
// Same button, two outcomes, decided by where you are standing: a hit to the front SHOVES
// them, a hit to the back FREEZES them. Kicking someone in the back is the one hit they had
// no chance to read, so it is the one that stops them dead — and it deliberately shoves them
// less, or a freeze would also slide them out of the fight.
{
  const hit = (fromBehind) => {
    const m = fresh();
    const [a, b] = m.players;
    a.x = 500; b.x = 500 + 34; b.y = a.y;
    a.facing = 1;
    // The victim's own facing is what makes it a back: away from the tackler = they never saw
    // it, whichever side of the pitch they happen to be on.
    b.facing = fromBehind ? 1 : -1;
    a.kickCd = 0; a.prev = {}; m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    const ev = m.events.find((e) => e.type === 'tackle');
    return { hurt: 1 - b.hp, vx: Math.abs(b.vx), behind: ev && ev.behind, stunned: b.stunned };
  };
  const front = hit(false), back = hit(true);
  // Against the LIVE constant, not the authored one: TACKLE_PUSH rides the PACE dial, so a
  // literal here would fail every time someone slowed the game down.
  ok('a tackle from the front is a shove', front.vx > C.TACKLE_PUSH * 0.9,
     `push ${front.vx.toFixed(0)} of ${C.TACKLE_PUSH.toFixed(0)}`);
  // THE DISTINCTION MOVED, from the lockout to the damage. A back hit used to FREEZE you for
  // three times as long; it now HURTS you half again as much, and neither hit stops you
  // playing at all. Same read for the player — get behind them, it is worth more — bought
  // without taking anybody's controls away.
  ok('a tackle from behind hurts more', back.hurt > front.hurt * 1.4,
     `${front.hurt.toFixed(3)} front vs ${back.hurt.toFixed(3)} behind`);
  ok('and neither one freezes anybody', front.stunned === 0 && back.stunned === 0);
  ok('and it shoves them less, not more', back.vx < front.vx,
     `${front.vx.toFixed(0)} front vs ${back.vx.toFixed(0)} behind`);
  ok('the event says which it was', back.behind === true && front.behind === false,
     `front=${front.behind} back=${back.behind}`);
}

// ── THE BOOT IS AIMED, AND THE HEAD IS A TOOL ─────────────────────────────────
{
  // A kick from deep used to fly dead flat along your facing, so the only way to score was to
  // already be standing in the right place. It now bows toward the far goal.
  const kickFrom = (x) => {
    const m = fresh();
    const p = m.players[0];
    p.x = x; p.facing = 1; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;                       // out of the way
    m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
    for (let i = 0; i < 2; i++) { m.hitStop = 0; step(m, [{ kick: true }, {}]); m.events.length = 0; }
    return { vx: m.ball.vx, vy: m.ball.vy };
  };
  const far = kickFrom(120);                          // a long way from the far goal
  const near = kickFrom(C.W - 260);                   // right on top of it

  // Against the SAME kick taken from close in, not against KICK_LIFT. KICK_LIFT is the loft of
  // a dead-centre contact and the middle of the boot is no longer the neutral shot — the ball
  // you are dribbling sits at the ankle end of the circle, so that is where the neutral went
  // (see KICK_TOE_NEUTRAL). What this test is actually about is the BOW, and the bow is the
  // only thing that differs between these two kicks.
  ok('a kick from deep is lofted toward the goal',
     far.vy < 0 && Math.abs(far.vy) > Math.abs(near.vy) * 1.2,
     `vy ${far.vy.toFixed(0)} vs ${near.vy.toFixed(0)} from close in`);
  ok('and it still goes forward', far.vx > 0, `vx ${far.vx.toFixed(0)}`);
  // From close in, lofting it would put the ball over the bar — so it does not.
  ok('a kick from close in stays low', Math.abs(near.vy) <= Math.abs(far.vy),
     `near ${near.vy.toFixed(0)} vs far ${far.vy.toFixed(0)}`);
}
{
  // THE HEADER. Pressing kick with the ball at head height is the aerial tool — before this
  // the boot simply missed, because the hitbox is at hip height and the ball was not.
  const m = fresh();
  const p = m.players[0];
  p.x = 500; p.facing = 1; p.kickCd = 0; p.prev = {};
  m.players[1].x = 900;
  m.ball.x = p.x + 10; m.ball.y = headY(p) - 4;      // on the forehead, not on the boot
  m.ball.vx = 0; m.ball.vy = 0;
  m.hitStop = 0;
  const seen = [];
  for (let i = 0; i < 3; i++) { m.hitStop = 0; step(m, [{ kick: true }, {}]); seen.push(...m.events); m.events.length = 0; }
  const hdr = seen.find((e) => e.type === 'strike' && e.head);
  ok('kick with the ball at your head is a HEADER', !!hdr, seen.map((e) => e.type).join(','));
  ok('and it sends the ball up and forward', m.ball.vy < 0 && m.ball.vx > 0,
     `vx ${m.ball.vx.toFixed(0)} vy ${m.ball.vy.toFixed(0)}`);
  ok('with more loft than a boot', Math.abs(m.ball.vy) > C.KICK_LIFT,
     `${Math.abs(m.ball.vy).toFixed(0)} vs ${C.KICK_LIFT.toFixed(0)}`);
}
{
  // A passive head touch is NOT a header: it cushions. That is the whole point of dropping
  // HEAD_POWER, and it must not be undone by the new button.
  const m = fresh();
  const p = m.players[0];
  p.x = 500; m.players[1].x = 900;
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 2;
  m.ball.vx = 0; m.ball.vy = 300;                    // dropping onto the head
  for (let i = 0; i < 6; i++) { m.hitStop = 0; step(m, [{}, {}]); m.events.length = 0; }
  ok('a ball that lands on you without a press is cushioned',
     Math.abs(m.ball.vy) < 300, `bounced back at ${Math.abs(m.ball.vy).toFixed(0)} of 300`);
}

// (The blocks that used to live here tested POWER MODE: press power, get 4.5 seconds in which
// your next kick was a special shot, and a tackle inside it landed your signature effect. The
// power button buys a committed VOLLEY now — the wind-up, the ball over the head, the flat
// three-speed shot and the jump that blocks it are all tested at the bottom of this file. The
// signature effects did not go anywhere: they land on whoever BLOCKS the volley.)

// ── THE POWER MOVE: EARNED, CHARGED, VOLLEYED ─────────────────────────────────
{
  // 1. THE GAUGE IS EARNED OFF THE OPPONENT. It used to fill on a clock whether you played
  // or not; now three tackles buy a volley and standing still buys nothing.
  const m = fresh();
  const [a, b] = m.players;
  const before = a.gauge;
  run(m, 180);                                        // three seconds of doing nothing
  ok('the gauge does not fill on its own', a.gauge === before, `${before} -> ${a.gauge}`);

  // Count the tackles that LAND, not the swings taken: a swing that misses is not what the
  // rule is about, and counting attempts made this read as four when it is three.
  let landed = 0;
  for (let i = 0; i < 9 && a.gauge < 1; i++) {
    a.x = 500; b.x = 500 + 34; b.y = a.y; a.facing = 1; b.facing = -1;
    a.kickCd = 0; a.prev = {}; b.tackleImmune = 0; b.hp = 1; b.stunned = 0; m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    if (m.events.some((e) => e.type === 'tackle')) landed++;
    m.events.length = 0;
  }
  // FIVE now, not three: TACKLE_GAUGE came down to 0.2 when a three-tackle volley turned out
  // to be cheap enough for two bots to trade ten of them a match. Derived from the constant so
  // the next retune does not need this line edited.
  const want = Math.ceil(1 / C.TACKLE_GAUGE);
  ok('a handful of kicks into the opponent fills it', a.gauge >= 1 && landed === want,
     `${landed} landed tackles (wanted ${want}), gauge ${a.gauge.toFixed(2)}`);
}
{
  // 2. PRESSING POWER ONLY ARMS. It fires nothing, it spends nothing, and it does not go
  // anywhere near the ball — which is the whole change, and the reason the rival can no
  // longer let one off by existing.
  const m = fresh();
  const p = m.players[0];
  p.x = 400; p.facing = 1; p.gauge = 1;
  m.ball.x = 460; m.ball.y = C.GROUND_Y - 20;
  const ballWas = { x: m.ball.x, y: m.ball.y };
  m.hitStop = 0;
  step(m, [{ power: true }, {}]);
  const started = m.events.find((e) => e.type === 'armed');
  m.events.length = 0;
  ok('power arms the player', p.armed > 0 && !!started, `armed ${p.armed.toFixed(2)}s`);
  ok('and does NOT spend the gauge', p.gauge >= 1, `gauge ${p.gauge}`);
  ok('the ball has not been fired', !m.ball.power);
  // The old wind-up SWEPT the ball sideways to the player and lifted it over their head. So
  // the test for "nothing touched it" is: no sideways movement at all, and it fell rather
  // than rose — which is simply gravity, doing what it does to a ball nobody is holding.
  ok('and the ball is not pulled sideways', m.ball.x === ballWas.x,
     `ball x ${m.ball.x.toFixed(1)} from ${ballWas.x.toFixed(1)}`);
  ok('and it falls rather than rising to the player', m.ball.y > ballWas.y,
     `ball y ${m.ball.y.toFixed(1)} from ${ballWas.y.toFixed(1)}`);

  // 3. AND IT STAYS THAT WAY while the ball is out of reach. No attraction, no drift.
  run(m, 20);
  ok('an armed player does not pull the ball in', Math.abs(m.ball.x - p.x) > 40,
     `ball ${m.ball.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
  ok('still armed, still nothing fired', p.armed > 0 && !m.ball.power);

  // 4. THE TOUCH FIRES IT, FLAT AND AT THE OTHER GOAL.
  const seen = [];
  for (let i = 0; i < 40 && !m.ball.power; i++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    seen.push(...m.events); m.events.length = 0;
  }
  ok('the touch ends in a power shot', seen.some((e) => e.type === 'powershot'),
     seen.map((e) => e.type).join(','));
  ok('the ball is a power ball', !!m.ball.power);
  ok('dead flat', Math.abs(m.ball.vy) < 40, `vy ${m.ball.vy.toFixed(0)}`);
  ok('and towards the other goal', Math.sign(m.ball.vx) === Math.sign(p.side));
  ok('the arm is spent', p.armed === 0);
  ok('and NOW the gauge is spent', p.gauge === 0, `gauge ${p.gauge}`);
}
{
  // 5. IT IS STILL BLOCKABLE. The ultimate leaves from wherever the body met the ball rather
  // than from a fixed height now, so "get in its way" is the answer instead of "jump to one
  // known line" — but it has to remain an answer, or the shot is an automatic goal again.
  const m = fresh();
  const [a, d] = m.players;
  a.x = 300; a.facing = 1;
  firePower(m, 0);
  ok('(the ultimate is away)', !!m.ball.power);
  d.x = m.ball.x + 200; d.y = C.GROUND_Y; d.vy = 0; d.onGround = true;
  let blocked = false;
  for (let i = 0; i < 240 && !blocked; i++) {
    m.hitStop = 0;
    step(m, NONE);
    blocked = m.events.some((e) => e.type === 'blocked');
    m.events.length = 0;
    if (m.score[0] > 0) break;
  }
  ok('a body in its path blocks it', blocked, `score ${m.score[0]}`);
  ok('and the blocker pays for it in health', d.hp < 1, `blocking was free (hp ${d.hp.toFixed(2)})`);
}
{
  // 6. YOU CANNOT ARM WITHOUT THE METER, OR TWICE OFF ONE PRESS.
  const m = fresh();
  const p = m.players[0];
  p.gauge = 0.9;
  step(m, [{ power: true }, {}]); m.events.length = 0;
  ok('a part-filled meter cannot arm', p.armed === 0);
  ok('and the press did not fire anything', !m.ball.power);
  p.gauge = 1; p.prev = {};
  step(m, [{ power: true }, {}]); m.events.length = 0;
  const a1 = p.armed;
  ok('(armed on a full meter)', a1 > 0);
  p.gauge = 1; p.prev = {};
  step(m, [{ power: true }, {}]);
  ok('and a second press while armed does not re-arm or fire',
     p.armed <= a1 && p.gauge === 1 && !m.ball.power,
     `armed ${p.armed.toFixed(2)} gauge ${p.gauge}`);
}

// ── THE BOOT GOES WHERE YOU AIMED IT ──────────────────────────────────────────
// "Sometimes it kicks the other way." The swing latched the LOB at the press but read the
// DIRECTION at contact, and the leg is out for a sixth of a second — so turning during it
// sent the ball backwards. This is the same bug football shipped as "shoots wrong direction",
// and the fix is the same: latch the aim to the fire edge.
{
  const m = fresh();
  const p = m.players[0];
  p.x = 500; p.facing = 1; p.kickCd = 0; p.prev = {};
  m.players[1].x = 900;
  // The ball starts OUT of reach and rolls in, so contact lands a few ticks into the swing —
  // which is the only way to exercise the latch. Placed inside the hitbox it connects on the
  // press tick, before any turn, and the test proves nothing.
  m.ball.x = p.x + C.KICK_REACH + 46; m.ball.y = p.y - C.BODY_H * 0.45;
  m.ball.vx = -260; m.ball.vy = 0;
  m.hitStop = 0;

  // Swing facing RIGHT, then hold left before the ball is struck.
  step(m, [{ kick: true }, {}]);
  m.events.length = 0;
  let struck = false;
  for (let i = 0; i < 10 && !struck; i++) {
    m.hitStop = 0;
    step(m, [{ left: true }, {}]);
    struck = m.events.some((e) => e.type === 'strike');
    m.events.length = 0;
  }
  ok('(the ball was struck during the swing)', struck);
  ok('a kick aimed right goes right even if you turn during it', m.ball.vx > 0,
     `vx ${m.ball.vx.toFixed(0)} (turned left mid-swing)`);

  // And the mirror, so this is about the rule and not about a sign: player two attacks LEFT,
  // so player two's boot goes left, under exactly the same provocation.
  const m2 = fresh();
  const q = m2.players[1];
  q.x = 500; q.facing = 1; q.kickCd = 0; q.prev = {};
  m2.players[0].x = 100;
  m2.ball.x = q.x - C.KICK_REACH - 46; m2.ball.y = q.y - C.BODY_H * 0.45;
  m2.ball.vx = 260; m2.ball.vy = 0;
  m2.hitStop = 0;
  step(m2, [{}, { kick: true }]);
  m2.events.length = 0;
  let struck2 = false;
  for (let i = 0; i < 10 && !struck2; i++) {
    m2.hitStop = 0;
    step(m2, [{}, { right: true }]);
    struck2 = m2.events.some((e) => e.type === 'strike');
    m2.events.length = 0;
  }
  ok('and player two\'s boot goes the other way for the same reason',
     struck2 && m2.ball.vx < 0, `vx ${m2.ball.vx.toFixed(0)}`);
}

// ── THE BOOT ONLY SWINGS FORWARD ──────────────────────────────────────────────
// "When you walk backwards the kick kicks backwards." The aim was the FACING, so retreating
// turned the boot round and the kick went at your own net — the leg you could see was pointing
// the wrong way while it happened. The aim is the attacking SIDE now, whatever the body does.
{
  const kickWhileWalking = (dirKey) => {
    const m = fresh();
    const p = m.players[0];
    p.x = 500; p.kickCd = 0; p.prev = {};
    m.players[1].x = 900;
    m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
    // Walk first, so the facing has really turned before the kick is pressed.
    for (let i = 0; i < 6; i++) { m.hitStop = 0; step(m, [{ [dirKey]: true }, {}]); m.events.length = 0; }
    m.hitStop = 0;
    step(m, [{ [dirKey]: true, kick: true }, {}]);
    return { vx: m.ball.vx, facing: p.facing };
  };
  const back = kickWhileWalking('left');
  const fwd = kickWhileWalking('right');
  ok('(walking left really does turn the body)', back.facing === -1, `facing ${back.facing}`);
  ok('a kick while walking backwards still goes forward', back.vx > 0, `vx ${back.vx.toFixed(0)}`);
  ok('and it is the same kick you get walking forward',
     Math.abs(back.vx - fwd.vx) < Math.abs(fwd.vx) * 0.5,
     `back ${back.vx.toFixed(0)} vs forward ${fwd.vx.toFixed(0)}`);

  // The HEADER is the same button, so it obeys the same rule — otherwise the ball still goes
  // backwards, just off a different part of the body.
  const m = fresh();
  const p = m.players[0];
  p.x = 500; p.kickCd = 0; p.prev = {};
  m.players[1].x = 900;
  for (let i = 0; i < 6; i++) { m.hitStop = 0; step(m, [{ left: true }, {}]); m.events.length = 0; }
  m.ball.x = p.x + 10; m.ball.y = headY(p) - 4;
  m.ball.vx = 0; m.ball.vy = 0;
  m.hitStop = 0;
  step(m, [{ left: true, kick: true }, {}]);
  ok('a header while retreating goes forward too', m.ball.vx > 0 && m.ball.vy < 0,
     `v=(${m.ball.vx.toFixed(0)}, ${m.ball.vy.toFixed(0)})`);
}

// ── WHERE ON THE BOOT ─────────────────────────────────────────────────────────
// The contact point is the shot: the toe cap pokes it flat and fast, the whole foot gets under
// it and lifts it. The neutral — the plain 1.0 kick — sits at KICK_TOE_NEUTRAL, near the ankle
// end, because that is where a dribbled ball actually meets the boot.
{
  // Struck at a chosen offset along the boot, from the ankle end (-1) to the toe cap (+1).
  const kickAt = (along) => {
    const m = fresh();
    const p = m.players[0];
    p.x = 400; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;
    // Against the CONTACT radius, which is what the sim divides the contact point by — the
    // ball's centre reaches KICK_R + its own radius out and still touches the circle. Half a
    // pixel inside it, because the sim's test is a strict `<` and dead on the rim is a miss.
    m.ball.x = p.x + C.KICK_REACH + along * (C.KICK_R + m.ball.r - 0.5);
    m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return { vx: m.ball.vx, vy: m.ball.vy };
  };
  // The ankle END of the circle is not sampled: it reaches far enough back to be inside the
  // HEADER's slack around the head, and the header is resolved first, so a ball there is
  // nodded rather than booted. -0.5 is the deepest a boot contact actually goes.
  const toe = kickAt(0.95), mid = kickAt(0), foot = kickAt(-0.5);
  ok('the toe cap drives it flat', Math.abs(toe.vy) < Math.abs(mid.vy) * 0.75,
     `toe vy ${toe.vy.toFixed(0)} vs mid ${mid.vy.toFixed(0)}`);
  ok('and the whole foot lifts it', Math.abs(foot.vy) > Math.abs(mid.vy) * 1.2,
     `foot vy ${foot.vy.toFixed(0)} vs mid ${mid.vy.toFixed(0)}`);
  ok('a toe-poke is the faster shot of the two', toe.vx > foot.vx,
     `toe vx ${toe.vx.toFixed(0)} vs foot ${foot.vx.toFixed(0)}`);
  ok('every one of them still goes forward', toe.vx > 0 && mid.vx > 0 && foot.vx > 0);
  // THE FLAT SHOT IS REACHABLE, which is the whole point of the toe end: on the very tip the
  // loft reaches zero and the ball leaves PARALLEL TO THE GRASS, straight at the goal. A shot
  // that always climbed a little was not a flat shot, it was a slightly worse lofted one.
  const tip = kickAt(1);
  ok('the very tip of the boot hits it dead flat', Math.abs(tip.vy) < 1,
     `vy ${tip.vy.toFixed(1)}`);
  ok('and dead flat is the fastest thing the boot does, forward',
     tip.vx > mid.vx * 1.25, `tip vx ${tip.vx.toFixed(0)} vs mid ${mid.vx.toFixed(0)}`);
  // The aim adds LOFT, so it multiplies a flat shot by nothing: kick it straight and it stays
  // straight however far out you are. Without this the bow quietly re-arced the driven shot.
  const tipDeep = (() => {
    const m = fresh();
    const p = m.players[0];
    p.x = 150; p.kickCd = 0; p.prev = {};            // as deep as the pitch gets
    m.players[1].x = C.W - 60;
    m.ball.x = p.x + C.KICK_REACH + C.KICK_R + m.ball.r - 0.5;   // the very tip; see kickAt
    m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return m.ball.vy;
  })();
  ok('a flat kick from deep is still flat — the bow cannot arc it', Math.abs(tipDeep) < 1,
     `vy ${tipDeep.toFixed(1)}`);

  // A ball DROPPING onto the boot is chipped: the foot is under it, which is the other axis.
  const chip = (() => {
    const m = fresh();
    const p = m.players[0];
    p.x = 400; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;
    m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45 - C.KICK_R;
    m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return m.ball.vy;
  })();
  ok('a ball above the boot is chipped', Math.abs(chip) > Math.abs(mid.vy),
     `chip ${chip.toFixed(0)} vs flat ${mid.vy.toFixed(0)}`);

  // The LOB is an aim, not an accident: it must not be flattened by a toe-end contact, or the
  // one shot whose job is to clear a defender's head stops clearing it.
  const lobToe = (() => {
    const m = fresh();
    const p = m.players[0];
    p.x = 400; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;
    m.ball.x = p.x + C.KICK_REACH + 0.95 * C.KICK_R; m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true, jump: true }, {}]);
    return m.ball.vy;
  })();
  ok('a lob off the toe still lobs', lobToe < mid.vy, `lob ${lobToe.toFixed(0)} vs ${mid.vy.toFixed(0)}`);
}

// ── MEETING THE BALL ──────────────────────────────────────────────────────────
// A strike is a COLLISION. It used to be an assignment: the ball's own pace was thrown away
// and a volley off a driven ball left at exactly the speed of a tap off a ball asleep on the
// grass. Now what the ball brings into the boot comes back out of it.
{
  // Same contact point, same swing — the only difference is what the ball was doing.
  const strike = (ballVx) => {
    const m = fresh();
    const p = m.players[0];
    p.x = 400; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;
    m.ball.x = p.x + C.KICK_REACH + C.KICK_R + m.ball.r - 0.5;   // the very tip; see kickAt
    m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = ballVx; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return m.ball.vx;
  };
  const still = strike(0), met = strike(-600), fleeing = strike(600);
  ok('volleying a ball driven at you hits it far harder', met > still * 1.4,
     `met ${met.toFixed(0)} vs still ${still.toFixed(0)}`);
  // Only the pace coming AT the boot counts. A ball already running away is caught up with and
  // struck, not smashed — otherwise chasing a loose ball would be the best shot in the game.
  // Not exactly equal: a ball running away gets a little further out before the boot catches
  // it, so it is met a little nearer the toe, and the toe hits harder. That is a real few per
  // cent and not the meet term leaking in — what this asserts is that it is nothing like the
  // gain a ball driven AT the boot earns.
  ok('and a ball running away is not', fleeing < still + (met - still) * 0.15,
     `fleeing ${fleeing.toFixed(0)} vs still ${still.toFixed(0)}, met ${met.toFixed(0)}`);
}
{
  // THE HEADER, the same way. Two things make one hard: the ball came at you, and you met it
  // on the way UP. Both were worth nothing before — a header was one number whatever arrived.
  const nod = ({ ballVx = 0, rising = false } = {}) => {
    const m = fresh();
    const p = m.players[0];
    p.x = 500; p.kickCd = 0; p.prev = {};
    m.players[1].x = 900;
    if (rising) { p.vy = -C.JUMP_V; p.onGround = false; }
    m.ball.x = p.x + 10; m.ball.y = headY(p) - 4;
    m.ball.vx = ballVx; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return { vx: m.ball.vx, vy: m.ball.vy, sp: Math.hypot(m.ball.vx, m.ball.vy) };
  };
  const lazy = nod(), driven = nod({ ballVx: -600 }), jumped = nod({ rising: true });
  ok('a header meeting a driven ball goes much faster', driven.sp > lazy.sp * 1.3,
     `${driven.sp.toFixed(0)} vs ${lazy.sp.toFixed(0)}`);
  ok('…and it is the FORWARD half that grows', driven.vx > lazy.vx * 2,
     `${driven.vx.toFixed(0)} vs ${lazy.vx.toFixed(0)}`);
  ok('a header taken on the way up is harder than one standing still',
     jumped.sp > lazy.sp * 1.2, `${jumped.sp.toFixed(0)} vs ${lazy.sp.toFixed(0)}`);
  ok('…and the jump is what lifts it', jumped.vy < lazy.vy,
     `${jumped.vy.toFixed(0)} vs ${lazy.vy.toFixed(0)}`);
  // The timing this buys: at the apex there is no rise left, so the same jump headed late is
  // worth nothing. That is the skill, and it is why the rise is read rather than `onGround`.
  const apex = (() => {
    const m = fresh();
    const p = m.players[0];
    p.x = 500; p.kickCd = 0; p.prev = {};
    m.players[1].x = 900;
    p.vy = 0; p.onGround = false;                    // airborne, but no longer climbing
    m.ball.x = p.x + 10; m.ball.y = headY(p) - 4;
    m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    return Math.hypot(m.ball.vx, m.ball.vy);
  })();
  ok('a header at the apex is just a header', apex < jumped.sp * 0.95,
     `apex ${apex.toFixed(0)} vs rising ${jumped.sp.toFixed(0)}`);
}
{
  // THE ULTIMATE LEAVES FROM WHERE THE BODY MET THE BALL, and it never fetches the ball. An
  // armed player parked away from it waits for as long as the arm lasts and gets nothing.
  const m = fresh();
  const p = m.players[0];
  armPower(m, 0);
  m.ball.x = p.x + 200; m.ball.y = C.GROUND_Y - 8;      // on the floor, a long way off
  m.hitStop = 0;
  const x0 = m.ball.x;
  for (let i = 0; i < 30; i++) { m.hitStop = 0; step(m, NONE); m.events.length = 0; }
  ok('an armed player 200px away fires nothing', !m.ball.power);
  ok('and the ball is not dragged toward them', m.ball.x > x0 - 30,
     `ball ${m.ball.x.toFixed(0)} from ${x0.toFixed(0)}, player at ${p.x.toFixed(0)}`);
}

// --- player/ball contact: never through, never under, never stuck -----------
// Two reported bugs, one cause. The torso test needed a non-zero distance to build a normal
// from (`bd > 0.0001`), so the DEEPEST overlap there is — the ball's centre inside the box —
// was the single case that produced no response at all, leaving an unguarded slab at the
// feet a ball passed straight underneath. And the response handed the ball 0.22 of the
// player's run, which is less than the run: the player closed on it every tick, walked the
// contact from the front of the torso through the middle and out the back, and re-applied
// `vy *= 0.18` sixty times a second so the ball stopped falling and hung there.
{
  // Signed: how far INSIDE the silhouette the ball is, negative when it is clear by that
  // much. The silhouette is the UNION of the head circle and the torso box, so the ball is
  // only really clear when it is outside both.
  const depth = (m, p) => {
    const b = m.ball;
    const dh = Math.hypot(b.x - p.x, b.y - headY(p));
    const head = (headR(m, p) + C.BALL_R) - dh;
    const cx = Math.max(p.x - C.BODY_W / 2, Math.min(b.x, p.x + C.BODY_W / 2));
    const cy = Math.max(p.y - C.BODY_H, Math.min(b.y, p.y));
    const body = C.BALL_R - Math.hypot(b.x - cx, b.y - cy);
    return Math.max(head, body);
  };
  const embed = (m, p) => Math.max(0, depth(m, p));
  const REST_Y = C.GROUND_Y - C.BALL_R;

  // ---- a FAST PLAYER running onto the ball ---------------------------------
  {
    // At a dash — the quickest a player can ever move — and straight through a ball sitting
    // on the grass. The ball has to end up in FRONT of them, every tick, for the length of
    // the pitch. It used to be overtaken at ~227px/s and come out the back.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 220; p.y = C.GROUND_Y;
    m.players[1].x = C.W - 60;
    b.x = 330; b.y = REST_Y; b.vx = 0; b.vy = 0;
    let behind = 0, deepest = 0;
    // Stop before the far goal: a goal resets both of them to the spawn spots, and comparing
    // positions across that would be measuring the restart, not the contact.
    for (let i = 0; i < 60 && p.x < C.W - C.GOAL_W - 120; i++) {
      p.dashT = C.DASH_TIME; p.dashDir = 1; p.facing = 1;   // hold the dash
      m.hitStop = 0;
      step(m, NONE);
      if (b.x < p.x) behind++;
      deepest = Math.max(deepest, embed(m, p));
    }
    ok('a dashing player never overtakes the ball', behind === 0, `${behind} ticks with the ball behind`);
    ok('and never ends a tick inside it', deepest < 1, `${deepest.toFixed(2)}px embedded`);
    ok('the ball is pushed along, not run over', b.x > 330, `ball at ${b.x.toFixed(0)}`);
  }

  // ---- a FAST BALL into a standing player ----------------------------------
  {
    // Flat out at the speed ceiling, into someone who is not moving. It must not come out
    // the other side.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 600; p.y = C.GROUND_Y;
    m.players[1].x = 80;
    b.x = 300; b.y = C.GROUND_Y - 40; b.vx = C.BALL_MAX_SPEED; b.vy = 0;
    let through = false, deepest = 0;
    for (let i = 0; i < 40; i++) {
      m.hitStop = 0;
      step(m, NONE);
      if (b.x > p.x + C.BODY_W) through = true;
      deepest = Math.max(deepest, embed(m, p));
    }
    ok('a ball at the speed ceiling does not tunnel through a player', !through,
       `ball ${b.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
    ok('and never ends a tick inside them', deepest < 1, `${deepest.toFixed(2)}px embedded`);
    ok('a stationary player deadens it', Math.abs(b.vx) < C.BALL_MAX_SPEED * 0.5,
       `vx=${b.vx.toFixed(0)} of ${C.BALL_MAX_SPEED}`);
  }

  // ---- UNDERNEATH a grounded player ----------------------------------------
  {
    // Rolling flat along the grass, straight at the boots. The body box reaches the feet
    // line, so there is no gap to go through — but the ball's centre ends up INSIDE that
    // box, which is exactly the case the old code dropped.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 520; p.y = C.GROUND_Y;
    m.players[1].x = 80;
    b.x = 300; b.y = REST_Y; b.vx = 900; b.vy = 0;
    let through = false;
    for (let i = 0; i < 60; i++) { m.hitStop = 0; step(m, NONE); if (b.x > p.x + C.BODY_W) through = true; }
    ok('a ball cannot roll underneath a grounded player', !through,
       `ball ${b.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
  }
  {
    // The measured dead zone: a player whose boots are a few px off the grass — landing, or
    // hopping over the ball. The head circle reaches 42px from a centre 49px up, so it stops
    // short of the feet, and the torso interior was doing nothing. A 32x10px slab of the
    // silhouette was a hole you could roll a ball through.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    m.players[1].x = 80;
    b.x = 300; b.y = REST_Y; b.vx = 900; b.vy = 0;
    let through = false;
    for (let i = 0; i < 60; i++) {
      p.x = 520; p.y = C.GROUND_Y - 5; p.vx = 0; p.vy = 0; p.onGround = false;   // boots just clear
      m.hitStop = 0;
      step(m, NONE);
      if (b.x > p.x + C.BODY_W) through = true;
    }
    ok('nor underneath one whose feet are just off the grass', !through,
       `ball ${b.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
  }

  // ---- a JUMPING player ----------------------------------------------------
  {
    // Jump first, then fire at the head once they are off the ground — aiming at the grass
    // and calling it a collision test would only prove that a jump clears a rolling ball.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 560; p.y = C.GROUND_Y;
    m.players[1].x = 80;
    b.x = -500; b.y = 0; b.vx = 0; b.vy = 0;              // parked off-pitch until the apex
    let airborne = 0;
    for (let i = 0; i < 40 && (p.onGround || p.vy < 0); i++) {
      m.hitStop = 0;
      step(m, [{ jump: i < 3 }, {}]);
      if (!p.onGround) airborne++;
    }
    ok('the player actually left the ground', airborne > 5 && !p.onGround,
       `${airborne} airborne ticks, onGround=${p.onGround}`);
    b.x = p.x - 90; b.y = headY(p); b.vx = 900; b.vy = 0;  // fired at the head, at the apex
    let through = false, deepest = 0;
    for (let i = 0; i < 30; i++) {
      m.hitStop = 0;
      step(m, NONE);
      if (b.x > p.x + C.BODY_W) through = true;
      deepest = Math.max(deepest, embed(m, p));
    }
    ok('a ball into a jumping player does not pass through', !through,
       `ball ${b.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
    ok('and is never left embedded in them', deepest < 1, `${deepest.toFixed(2)}px embedded`);
  }

  // ---- SEPARATION: the ball keeps obeying gravity ---------------------------
  {
    // The stick. A ball taken on the chest by a running player used to have `vy *= 0.18`
    // applied on every tick of the overlap, which beats gravity — so it hung at chest
    // height and travelled sideways with the player as if bolted on. It has to fall.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 240; p.y = C.GROUND_Y;
    m.players[1].x = C.W - 60;
    b.x = 320; b.y = C.GROUND_Y - 70; b.vx = 0; b.vy = 0;
    let landed = -1;
    for (let i = 0; i < 120; i++) {
      m.hitStop = 0;
      step(m, [{ right: true }, {}]);
      if (landed < 0 && b.y > REST_Y - 1.5) landed = i;
    }
    ok('a ball taken on the run still falls to the grass', landed >= 0,
       `ball stopped at y=${b.y.toFixed(1)}, rest is ${REST_Y}`);
    ok('and it gets there promptly', landed >= 0 && landed < 90, `${landed} ticks`);
  }
  {
    // And it comes OFF. Run into the ball, then stand still: the ball must roll away rather
    // than stay welded at the contact distance for the rest of the match.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 240; p.y = C.GROUND_Y;
    m.players[1].x = C.W - 60;
    b.x = 300; b.y = REST_Y; b.vx = 0; b.vy = 0;
    for (let i = 0; i < 60; i++) { m.hitStop = 0; step(m, [{ right: true }, {}]); }
    const gapWhileRunning = b.x - p.x;
    for (let i = 0; i < 90; i++) { m.hitStop = 0; step(m, NONE); }     // let go of everything
    ok('the ball separates once the player stops', b.x - p.x > gapWhileRunning + 8,
       `gap ${gapWhileRunning.toFixed(1)} -> ${(b.x - p.x).toFixed(1)}`);
    ok('and it is rolling, not stuck to them', embed(m, p) < 1, `${embed(m, p).toFixed(2)}px embedded`);
  }
  {
    // Dropped dead on the crown. That is the one spot where the contact normal points
    // straight up and gravity has nothing to roll the ball off with, so it used to balance
    // there indefinitely — the clearest form of "the ball sticks and its physics stop".
    // It has to come off the head and reach the grass.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 400; p.y = C.GROUND_Y;
    m.players[1].x = 80;
    b.x = p.x; b.y = C.GROUND_Y - 200; b.vx = 0; b.vy = 300;
    let reached = -1, under = 0, deepest = 0;
    for (let i = 0; i < 180; i++) {
      m.hitStop = 0;
      step(m, NONE);
      if (reached < 0 && b.y > REST_Y - 1) reached = i;
      if (b.y > REST_Y + 0.5) under++;
      deepest = Math.max(deepest, embed(m, p));
    }
    ok('a ball dropped on a head does not balance there', reached >= 0,
       `never reached the grass; ended at y=${b.y.toFixed(1)}, rest is ${REST_Y}`);
    ok('it rolls off promptly', reached >= 0 && reached < 60, `${reached} ticks`);
    ok('it is never pushed under the grass', under === 0, `${under} ticks below the pitch`);
    ok('and never ends a tick inside the player', deepest < 1, `${deepest.toFixed(2)}px embedded`);
  }

  {
    // A player standing squarely ON a resting ball. It is pinned between the boots and the
    // grass, so the only way out is sideways — it must not be lifted onto their chest, and
    // it must not be pushed down through the pitch.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    m.players[1].x = 80;
    b.x = 400; b.y = REST_Y; b.vx = 0; b.vy = 0;
    let lifted = 0, under = 0;
    for (let i = 0; i < 40; i++) {
      p.x = 400; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true;   // stand on it
      m.hitStop = 0;
      step(m, NONE);
      if (b.y < REST_Y - 6) lifted++;
      if (b.y > REST_Y + 0.5) under++;
    }
    ok('standing on a ball squeezes it out sideways', Math.abs(b.x - 400) > C.BODY_W / 2,
       `ball moved to ${b.x.toFixed(1)} from 400`);
    ok('it is not lifted onto the chest', lifted === 0, `${lifted} ticks above the grass`);
    ok('and not pushed through the pitch', under === 0, `${under} ticks below the grass`);
    ok('and it is left clear of the player', embed(m, p) < 1, `${embed(m, p).toFixed(2)}px embedded`);
  }

  // ---- SOAK: no embedding anywhere, over a long random match ----------------
  {
    // The assertions above each aim at one geometry. This one just plays: both players
    // mashing buttons for half a minute of match time, asserting only that the ball never
    // ends a tick inside a player it is supposed to collide with. Seeded, so a failure is
    // reproducible.
    let seed = 20260918;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const m = fresh({ duration: 9999 });
    let deepest = 0, worst = null;
    const held = [{}, {}];
    for (let i = 0; i < 4000; i++) {
      for (let s = 0; s < 2; s++) {
        if (rnd() < 0.12) held[s] = { left: rnd() < 0.35, right: rnd() < 0.35,
                                      jump: rnd() < 0.25, kick: rnd() < 0.3 };
      }
      // A hit-stop or a kickoff freeze makes step() return before ANY physics runs, so the
      // ball stays wherever the freeze caught it — including mid-contact. Has to be read
      // before the step, not after: the last frame of a hit-stop ends with hitStop back at 0.
      const frozen = m.hitStop > 0 || m.freeze > 0;
      step(m, held);
      // Skip the frames where the sim deliberately owns or ignores the ball: a wind-up holds
      // it over the player's head, and a knocked-down or rooted player is passed through by
      // design (see resolveBallPlayers).
      if (frozen || m.freeze > 0 || m.hitStop > 0) continue;
      // And skip a CONTESTED ball. Two players are held 29px apart by separatePlayers while
      // each wants 28px of clearance, so a ball between them has no position that satisfies
      // both — it is over-constrained, not unresolved, and the resolver settles it in favour
      // of whichever player it handled last. What this soak is for is the single-player case.
      if (m.players.filter((p) => depth(m, p) > -1).length > 1) continue;
      // …and skip a ball CONTESTED BY THE FRAME, which is the same thing with a goalpost as
      // the second collider. A player may stand on their own goal line, so their torso can
      // straddle it; keepOutOfGoal will not let a push-out set the ball down behind that line
      // (see shared/goalbox.js — a contact is not a way into the net). A ball between the two
      // therefore has no position that satisfies both either, and it settles held against the
      // line: measured at tick 3731 as the ball at x=57 with its edge exactly on the 69 line
      // and 1.58px of the player's corner over it. Over-constrained, not unresolved — and the
      // budget below stays where it was for every configuration that is neither.
      const edge = m.ball.x + C.BALL_R, redge = m.ball.x - C.BALL_R;
      const heldByFrame = m.ball.y - C.BALL_R > C.GROUND_Y - C.GOAL_H
        && (Math.abs(edge - C.GOAL_W) < 1 || Math.abs(redge - (C.W - C.GOAL_W)) < 1);
      if (heldByFrame) continue;
      for (const p of m.players) {
        if (p.stunned > 0) continue;
        const e = embed(m, p);
        if (e > deepest) { deepest = e; worst = { i, p: p.index }; }
      }
    }
    ok('4000 ticks of random play leave the ball embedded in nobody', deepest < 1.5,
       `${deepest.toFixed(2)}px at tick ${worst?.i} on player ${worst?.p}`);
  }
}

// ── A PAUSE MUST NOT EAT THE NEXT PRESS ───────────────────────────────────────
//
// hitStop and freeze both return out of step() before stepPlayer runs, so for the length of
// either one nothing was updating `p.prev` — the latch every edge in this file is read
// against. It kept whatever was true when the pause began, and a release that happened DURING
// the pause was never recorded, so the press that followed was not a rising edge.
//
// Measured before the fix: score while holding JUMP (which is how a header is scored), let go
// during the two-second restart, press again as play resumes — zero jumps. And a JUMP pressed
// during a hit-stop and held never fired at all.
//
// The fix watches releases and only releases, so all three of these hold at once. The middle
// one is the reason the naive fix (clearing `prev` on a restart) is wrong: it would hand a
// free jump to anyone still leaning on the button.
{
  const held = (m, i, input, ticks, want) => {
    let n = 0;
    for (let t = 0; t < ticks; t++) {
      const ins = [{}, {}]; ins[i] = input;
      step(m, ins);
      n += m.events.filter((e) => e.type === want && e.player === i).length;
      m.events.length = 0;
    }
    return n;
  };
  // …across a GOAL RESTART
  const restart = (holdThrough, pressAfter) => {
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
    m.phase = 'play'; m.freeze = 0;
    held(m, 0, { jump: true }, 1, 'jump');              // establish prev.jump = true
    const b = m.ball;
    b.x = C.W - C.GOAL_W - 5; b.y = C.GROUND_Y - 20; b.vx = 900;
    for (let t = 0; t < 30 && m.phase === 'play'; t++) { step(m, [{ jump: true }, {}]); m.events.length = 0; }
    let guard = 0;
    while (m.phase !== 'play' && guard++ < 400) { step(m, [{ jump: holdThrough }, {}]); m.events.length = 0; }
    return held(m, 0, { jump: pressAfter }, 20, 'jump');
  };
  ok('a jump released during a goal restart fires on the next press', restart(false, true) === 1,
     `${restart(false, true)} jumps`);
  ok('a jump HELD through a goal restart does not fire for free', restart(true, true) === 0,
     `${restart(true, true)} jumps`);
  ok('no press after a restart means no jump', restart(false, false) === 0);

  // …and across a HIT-STOP. `before` is the half that matters: the latch only goes stale if
  // the button was already DOWN when the pause started, so a test that begins from a released
  // button passes with or without the fix and proves nothing.
  const hitstop = (before, duringPause, after) => {
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
    m.phase = 'play'; m.freeze = 0;
    // Hold `before` for a tick to set the latch, and let the resulting jump land again.
    held(m, 0, { jump: before }, 1, 'jump');
    for (let t = 0; t < 60 && !m.players[0].onGround; t++) { step(m, [{ jump: before }, {}]); m.events.length = 0; }
    m.hitStop = 0.2;
    let n = 0, guard = 0;
    while (m.hitStop > 0 && guard++ < 60) {
      step(m, [{ jump: duringPause }, {}]);
      n += m.events.filter((e) => e.type === 'jump').length; m.events.length = 0;
    }
    return n + held(m, 0, { jump: after }, 20, 'jump');
  };
  ok('a jump held into a hit-stop, released during it, fires on the next press',
     hitstop(true, false, true) === 1, `${hitstop(true, false, true)} jumps`);
  ok('a jump held right through a hit-stop does not re-fire', hitstop(true, true, true) === 0,
     `${hitstop(true, true, true)} jumps`);
  ok('a jump pressed during a hit-stop fires when it lifts', hitstop(false, true, true) === 1);
  ok('a jump pressed and released inside a hit-stop does not fire', hitstop(false, true, false) === 0);

  // POWER is edge-read the same way, and holding it through a restart must not re-arm.
  {
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
    m.phase = 'play'; m.freeze = 0;
    m.players[0].gauge = 1;
    step(m, [{ power: true }, {}]); m.events.length = 0;     // arm once
    const b = m.ball;
    b.x = C.W - C.GOAL_W - 5; b.y = C.GROUND_Y - 20; b.vx = 900;
    let arms = 0, guard = 0;
    for (let t = 0; t < 30 && m.phase === 'play'; t++) { step(m, [{ power: true }, {}]); m.events.length = 0; }
    while (m.phase !== 'play' && guard++ < 400) {
      step(m, [{ power: true }, {}]);
      arms += m.events.filter((e) => e.type === 'armed').length; m.events.length = 0;
    }
    arms += held(m, 0, { power: true }, 30, 'armed');
    ok('holding POWER through a goal restart does not re-arm', arms === 0, `${arms} extra arms`);
  }
}

// ── THE SNAPSHOT CARRIES EVERY LIVE FIELD ─────────────────────────────────────
//
// P_FIELDS is the wire schema, and a field left out of it is a field a reconciling client
// silently loses. The pair in that seat now is `hp`/`stunned`, and they are the same shape of
// hazard the old `effectId`/`effectT` were: `hp` barely moves the physics, so nothing else
// would catch it, but the character's damaged look is derived from it and from nothing else —
// leave it out and every reconcile flickers a hurt player back to healthy.
//
// Written as "no live field is missing" rather than "these two are present", so the next field
// somebody adds to a player has to be classified rather than quietly dropped.
{
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  // Fields that are match-constant or rebuilt by restore(), so they legitimately do not travel.
  const CONSTANT = new Set(['index', 'side', 'char', 'shot', 'stats', 'prev', 'stats_', 'x0', 'y0']);
  const live = Object.keys(m.players[0]).filter((k) => !CONSTANT.has(k));
  const s = serialize(m);
  const m2 = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  // Give every live numeric field a distinctive value, then round-trip it.
  const p = m.players[0];
  p.gauge = 0.37; p.armed = 1; p.coyote = 0.04; p.jumpBuf = 0.03;
  p.tackleImmune = 0.55; p.shoved = 0.13;
  p.hp = 0.37; p.stunned = 0.66; p.kickLob = true; p.kickDir = -1;
  restore(m2, serialize(m));
  const lost = live.filter((k) => m2.players[0][k] !== p[k]);
  ok('every live player field survives serialize -> restore', lost.length === 0, `lost: ${lost.join(', ')}`);
  ok('health and the stun survive a reconcile',
     m2.players[0].hp === 0.37 && m2.players[0].stunned === 0.66,
     `${m2.players[0].hp} / ${m2.players[0].stunned}`);
}

// ══ HEALTH, DAMAGE AND THE ONE STUN ═══════════════════════════════════════════
//
// The system that replaced the signature effects. The rule it is built to keep is a single
// sentence: BEING HIT COSTS YOU CONDITION, AND ONLY BOTTOMING OUT COSTS YOU CONTROL. Health is
// invisible — no bar, no number, nothing in the HUD — so the character's own face is the only
// readout, and hurtTier is the one place the thresholds are written down.
{
  // Put the victim on the tackler's boot and press. Returns the match so a test can keep going.
  const tackle = (m, attacker = 0) => {
    const a = m.players[attacker], v = m.players[1 - attacker];
    m.ball.x = C.W / 2; m.ball.y = 100;                 // ball nowhere near: this is a tackle
    v.x = a.x + Math.sign(v.x - a.x || 1) * C.KICK_REACH;
    a.facing = Math.sign(v.x - a.x) || 1;
    v.facing = -a.facing;                               // face them: a FRONT hit, the cheap one
    a.kickCd = 0; a.prev = {}; v.tackleImmune = 0; m.hitStop = 0;
    step(m, attacker === 0 ? [{ kick: true }, {}] : [{}, { kick: true }]);
    m.hitStop = 0;
    return m;
  };
  const events = (m) => m.events.filter((e) => e.type === 'tackle');
  // Land `n` tackles on the victim, clearing the immunity between them. Returns the events.
  const beat = (m, n, attacker = 0) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      tackle(m, attacker);
      seen.push(...m.events);
      m.events.length = 0;
      m.players[1 - attacker].tackleImmune = 0;
    }
    return seen;
  };

  // ---- 1. health exists, starts full, and is not on screen -----------------
  {
    const m = fresh();
    ok('both players start at full health', m.players[0].hp === 1 && m.players[1].hp === 1);
    ok('and neither starts stunned', m.players[0].stunned === 0 && m.players[1].stunned === 0);
    ok('health is a fraction, not a percentage', m.players[0].hp === 1);
  }

  // ---- 2. a kick damages, and does NOT grey / slow / stick -----------------
  {
    const m = fresh();
    const v = m.players[1];
    tackle(m);
    ok('a kick damages the opponent', v.hp < 1, `hp=${v.hp.toFixed(3)}`);
    ok('…by KICK_DAMAGE', Math.abs((1 - v.hp) - C.KICK_DAMAGE) < C.HP_REGEN * C.TICK + 1e-9,
       `took ${(1 - v.hp).toFixed(4)}, expected ${C.KICK_DAMAGE}`);
    ok('a damage event says so', m.events.some((e) => e.type === 'damage' && e.player === 1));
    // The three fields the old effect lived in are gone from the player entirely. Asserted as
    // ABSENT rather than zero, so re-adding one is a failure rather than a silent revival.
    for (const dead of ['knocked', 'rooted', 'slow', 'effectId', 'effectT']) {
      ok(`a kicked player has no '${dead}' state any more`, !(dead in v), `${dead}=${v[dead]}`);
    }
    ok('and a kick does not stun', v.stunned === 0);
  }
  {
    // The control test: a kicked player answers the buttons exactly as an untouched one does.
    // Run both from a standstill so the tackle's own shove is not what is being measured.
    const hit = fresh(), clean = fresh();
    tackle(hit);
    hit.players[1].vx = 0; hit.players[1].vy = 0; hit.players[1].y = C.GROUND_Y; hit.players[1].onGround = true;
    run(hit, 40, [{}, { right: true }]);
    run(clean, 40, [{}, { right: true }]);
    ok('a kicked player keeps normal movement',
       Math.abs(Math.abs(hit.players[1].vx) - Math.abs(clean.players[1].vx)) < 1,
       `${hit.players[1].vx.toFixed(0)} vs ${clean.players[1].vx.toFixed(0)}`);
    ok('…and normal jumping', hit.players[1].hp < 1
       && (run(hit, 2, [{}, { jump: true }]), hit.players[1].vy < -100), `vy=${hit.players[1].vy.toFixed(0)}`);
  }

  // ---- 3. a power hit damages, harder ---------------------------------------
  {
    const m = fresh();
    const a = m.players[0], d = m.players[1];
    a.shot = SHOTS.blaze;
    d.x = a.x + 300;
    firePower(m, 0);
    inLine(m, d);
    run(m, 30);
    ok('a power hit damages the opponent', d.hp < 1, `hp=${d.hp.toFixed(3)}`);
    ok('…by more than a kick', 1 - d.hp > C.KICK_DAMAGE, `${(1 - d.hp).toFixed(3)} vs ${C.KICK_DAMAGE}`);
    ok('and it does not stun on its own', d.stunned === 0);
  }

  // ---- 4. the thresholds, and what the character shows ----------------------
  {
    ok('above 80% the character is untouched', hurtTier(1) === 0 && hurtTier(0.81) === 0);
    ok('80% or lower is the first red', hurtTier(0.8) === 1 && hurtTier(0.61) === 1);
    ok('60% or lower is stronger', hurtTier(0.6) === 2 && hurtTier(0.41) === 2);
    ok('40% or lower brings the blue marks', hurtTier(0.4) === 3 && hurtTier(0.01) === 3);
    ok('0% is the critical look', hurtTier(0) === 4);
    // Monotonic: a player who is getting worse never looks better on the way down.
    let worst = 0, drops = 0;
    for (let hp = 1; hp >= 0; hp -= 0.005) {
      const t = hurtTier(Math.max(0, +hp.toFixed(4)));
      if (t < worst) drops++;
      worst = Math.max(worst, t);
    }
    ok('the damaged look only ever gets worse as health falls', drops === 0, `${drops} reversals`);
  }
  {
    // …and the tier really does follow damage as it lands, tick by tick, on a live match.
    const m = fresh();
    const v = m.players[1];
    const tiers = [hurtTier(v.hp)];
    for (let i = 0; i < 6; i++) { tackle(m); m.events.length = 0; v.tackleImmune = 0; tiers.push(hurtTier(v.hp)); }
    ok('the character visibly worsens as the kicks land', tiers[0] === 0 && tiers[tiers.length - 1] >= 3,
       tiers.join('->'));
  }

  // ---- 5. ONE stun at 0%, 1.5-2s, no duplicates ----------------------------
  {
    ok('the stun is between 1.5 and 2 seconds', C.HP_STUN_TIME >= 1.5 && C.HP_STUN_TIME <= 2,
       `${C.HP_STUN_TIME}s`);
    const m = fresh();
    const v = m.players[1];
    const seen = beat(m, 12);                            // more than enough to bottom them out
    const stuns = seen.filter((e) => e.type === 'stunned' && e.player === 1);
    ok('bottoming out stuns the player', stuns.length >= 1, `${stuns.length} stuns`);
    ok('…exactly once, however many hits land', stuns.length === 1, `${stuns.length} stuns`);
    ok('the stun is set to HP_STUN_TIME', Math.abs(stuns[0].time - C.HP_STUN_TIME) < 1e-9);
    ok('and the character is at its critical look', hurtTier(v.hp) === 4, `hp=${v.hp}`);
    // Keep kicking a player who is already down: no second stun, and the clock does not grow.
    const before = v.stunned;
    const more = beat(m, 4);
    ok('a stunned player cannot be re-stunned', !more.some((e) => e.type === 'stunned'));
    ok('and hitting them does not extend it', v.stunned <= before + 1e-9,
       `${before.toFixed(2)} -> ${v.stunned.toFixed(2)}`);
    ok('nor damage them further', v.hp === 0, `hp=${v.hp}`);
  }
  {
    // A stun takes the controls, and gives them back. Both halves, on one match.
    const m = fresh();
    const v = m.players[1];
    beat(m, 12);
    m.events.length = 0;
    ok('(the victim is down)', v.stunned > 0);
    // Against a control, the way the old knockdown test did it: a stunned player still COASTS
    // — the tackle's shove is decaying under them — so "cannot walk" cannot be a distance. It
    // is "input changes nothing", which is the property that actually matters.
    const ctrl = fresh();
    beat(ctrl, 12);
    run(m, 20, [{}, { right: true }]);
    run(ctrl, 20, NONE);
    ok('a stunned player ignores the controls',
       Math.abs(v.x - ctrl.players[1].x) < 0.001 && Math.abs(v.vx - ctrl.players[1].vx) < 0.001,
       `${v.x.toFixed(2)} vs ${ctrl.players[1].x.toFixed(2)}`);
    // Run out what is LEFT of the stun, timed against the clock it is actually holding: the
    // ticks above have already eaten some of it. The cap is generous on purpose — what is
    // asserted is that it ENDS, and a stun that never did would fail here rather than hang.
    const left = v.stunned;
    let t = 0;
    for (; t < 400 && v.stunned > 0; t++) { m.hitStop = 0; step(m, NONE); }
    ok('the stun always ends', v.stunned === 0, `still stunned after ${t} ticks`);
    ok('…and runs exactly the clock it was given', Math.abs(t * C.TICK - left) <= C.TICK + 1e-9,
       `${(t * C.TICK).toFixed(3)}s of ${left.toFixed(3)}s`);
    ok('and it comes back at about 40%', Math.abs(v.hp - C.HP_AFTER_STUN) < 0.02, `hp=${v.hp.toFixed(3)}`);
    ok('the player is still visibly hurt', hurtTier(v.hp) === 3, `tier ${hurtTier(v.hp)}`);
    ok('a revive event reports the handover', m.events.some((e) => e.type === 'revive' && e.player === 1));
    const x1 = v.x;
    run(m, 30, [{}, { right: true }]);
    ok('and the controls come back with them', Math.abs(v.x - x1) > 20,
       `moved ${Math.abs(v.x - x1).toFixed(1)}px`);
  }
  {
    // A CHAIN-STUN TAKES LONGER THAN THE FIRST ONE, on request — coming back at 40% used to
    // mean two more boots, under 1.2s of continuous kicking, put the same player straight back
    // down. HP_REVIVE_GRACE buys one extra TACKLE_IMMUNE window right on revival so a repeat
    // knockdown costs roughly the length of the example given: ~4-5s from full, ~3s from a
    // revive. Driven by mashing kick every tick against a stationary victim, the way a human
    // holding the button down against someone AFK actually plays.
    const mash = (m, attacker, victim, cond, maxTicks) => {
      let key = false;
      for (let t = 0; t < maxTicks; t++) {
        m.hitStop = 0; key = !key;
        victim.x = attacker.x + C.KICK_REACH; victim.vx = 0; victim.y = C.GROUND_Y; victim.onGround = true;
        const input = [{}, {}]; input[attacker.index] = { kick: key };
        step(m, input);
        m.events.length = 0;
        if (cond()) return t * C.TICK;
      }
      return -1;
    };
    const m = fresh();
    const a = m.players[0], v = m.players[1];
    m.ball.x = 9999; m.ball.y = 9999;                    // out of the way
    const firstStun = mash(m, a, v, () => v.stunned > 0, 600);
    ok('mashed from full health, the first stun lands in about 4-5s',
       firstStun >= 3.5 && firstStun <= 6, `${firstStun.toFixed(2)}s`);
    let t = 0;
    for (; t < 400 && v.stunned > 0; t++) { m.hitStop = 0; step(m, NONE); }
    ok('(revived)', v.stunned === 0 && Math.abs(v.hp - C.HP_AFTER_STUN) < 1e-9);
    const secondStun = mash(m, a, v, () => v.stunned > 0, 600);
    ok('mashed again right after revival, the second stun takes about 3s',
       secondStun >= 2.3 && secondStun <= 3.8, `${secondStun.toFixed(2)}s`);
    ok('…clearly longer than a bare two-hit gap would give without the grace',
       secondStun > C.TACKLE_IMMUNE * 1.3, `${secondStun.toFixed(2)}s vs immune ${C.TACKLE_IMMUNE}s`);
  }

  {
    // THE STUN IS A WALL CLOCK, and hit-stop is the thing that used to bend it. step() returns
    // before any player is stepped for the length of a hit-stop, so a stun that spanned a few
    // of them ran long — measured at 1.98s against an authored 1.75s, and a player standing
    // over a downed opponent could keep adding to it. Now the countdown runs through the pause
    // and a downed player cannot be tackled at all.
    const lengthOf = (withHitStops) => {
      const m = fresh();
      const v = m.players[1];
      beat(m, 12);
      m.events.length = 0;
      let t = 0;
      for (; t < 600 && v.stunned > 0; t++) {
        if (!withHitStops) m.hitStop = 0;
        else m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);   // a heavy connect, every tick
        step(m, NONE);
      }
      return t * C.TICK;
    };
    const quiet = lengthOf(false), busy = lengthOf(true);
    ok('a stun spanning hit-stops still runs its own clock', Math.abs(busy - quiet) <= C.TICK * 2 + 1e-9,
       `${quiet.toFixed(3)}s quiet vs ${busy.toFixed(3)}s under constant hit-stop`);
    ok('…and both are inside the 1.5-2s the brief asks for',
       quiet >= 1.5 && quiet <= 2 && busy >= 1.5 && busy <= 2, `${quiet.toFixed(2)} / ${busy.toFixed(2)}`);
  }
  {
    // A downed player is not a target. Booting one used to pay the tackler gauge for nothing
    // and stretch the victim's time on the floor with every hit-stop it made.
    const m = fresh();
    const a = m.players[0], v = m.players[1];
    beat(m, 12);
    ok('(the victim is down)', v.stunned > 0);
    const gauge = a.gauge;
    m.events.length = 0;
    beat(m, 5);
    ok('a stunned player cannot be tackled', !m.events.some((e) => e.type === 'tackle')
       && !events(m).length, JSON.stringify(m.events.map((e) => e.type)));
    ok('…so nobody farms meter off them', Math.abs(a.gauge - gauge) < 0.02,
       `${gauge.toFixed(3)} -> ${a.gauge.toFixed(3)}`);
  }

  // ---- 6. regeneration ------------------------------------------------------
  {
    const m = fresh();
    const v = m.players[1];
    tackle(m);
    const hurt = v.hp;
    run(m, 30);
    ok('health regenerates on its own', v.hp > hurt, `${hurt.toFixed(3)} -> ${v.hp.toFixed(3)}`);
    ok('…gradually, not in a jump', v.hp - hurt < 0.1, `+${(v.hp - hurt).toFixed(3)} in half a second`);
    // All the way back, and no further. 100% is a ceiling, not a target it overshoots.
    run(m, 60 * 30);
    ok('it reaches full health', Math.abs(v.hp - 1) < 1e-9, `hp=${v.hp}`);
    ok('and never exceeds it', v.hp <= 1);
    ok('the character looks untouched again', hurtTier(v.hp) === 0);
  }
  {
    // The visuals have to follow the mend, not just the damage — a player who has regenerated
    // past a threshold must LOOK better before they are all the way back.
    const m = fresh();
    const v = m.players[1];
    beat(m, 12);
    for (let i = 0; i < 400 && v.stunned > 0; i++) { m.hitStop = 0; step(m, NONE); }
    const tiers = [hurtTier(v.hp)];                      // 3, at 40%
    // HP_REGEN is slow on purpose now (40% -> full in ~30s), so the sample window has to
    // cover that whole climb rather than the first 12 seconds of it.
    for (let i = 0; i < 32; i++) { run(m, 60); tiers.push(hurtTier(v.hp)); }
    ok('the damaged look lifts as health comes back', tiers[0] === 3 && tiers[tiers.length - 1] === 0,
       tiers.join('->'));
    ok('…passing through every tier on the way', tiers.includes(2) && tiers.includes(1),
       tiers.join('->'));
    ok('and it never worsens while mending',
       tiers.every((t, i) => i === 0 || t <= tiers[i - 1]), tiers.join('->'));
  }

  // ---- 7. both players, the same rules -------------------------------------
  {
    const outcome = (attacker) => {
      const m = fresh();
      const v = m.players[1 - attacker];
      const seen = beat(m, 12, attacker);
      const stun = seen.find((e) => e.type === 'stunned');
      let t = 0;
      for (; t < 400 && v.stunned > 0; t++) { m.hitStop = 0; step(m, NONE); }
      return { hurt: +(1 - m.players[1 - attacker].hp).toFixed(6), stunT: stun && stun.time,
               victim: stun && stun.player, ticks: t, after: +v.hp.toFixed(6) };
    };
    const byP0 = outcome(0), byP1 = outcome(1);
    ok('player 1 takes damage from player 0 exactly as player 0 does from player 1',
       byP0.hurt === byP1.hurt && byP0.stunT === byP1.stunT && byP0.after === byP1.after,
       `${JSON.stringify(byP0)} vs ${JSON.stringify(byP1)}`);
    // Within a tick, not equal: the two players are stepped in index order, so a victim who is
    // player 1 has their stun counted down once in the very tick it was set and a victim who is
    // player 0 does not. One frame, and it belongs to the step order, not to the rules.
    ok('…and both stuns last the same time to within a tick', Math.abs(byP0.ticks - byP1.ticks) <= 1,
       `${byP0.ticks} vs ${byP1.ticks} ticks`);
    ok('…and the stun lands on the one who was hit, both ways',
       byP0.victim === 1 && byP1.victim === 0, `${byP0.victim} / ${byP1.victim}`);
  }

  // ---- 8. a goal restart clears the STUN, not the health --------------------
  //
  // Changed on request: a beating is meant to carry across the whole match, so a goal no
  // longer heals either player back to full. What it still has to do is release a stun — a
  // kickoff nobody can move for is a bug no matter whose fault the health is.
  {
    const m = fresh();
    const v = m.players[1];
    beat(m, 12);
    const hpBefore = v.hp;
    ok('(somebody is hurt and down)', v.hp === 0 && v.stunned > 0);
    scoreOn(m, true);                                    // drive a ball into the left net
    ok('(the goal went in)', m.score[1] === 1, `score ${m.score}`);
    ok('a goal restart does NOT heal health back to full',
       v.hp === hpBefore, `${hpBefore} -> ${v.hp}`);
    ok('…but it does clear the stun', v.stunned === 0);
    m.freeze = 0; m.phase = 'play';                      // past the post-goal freeze
    run(m, 20, [{}, { right: true }]);
    ok('…so the hurt character can move again immediately',
       Math.abs(v.vx) > 20, `vx=${v.vx.toFixed(0)}`);
  }
  {
    // A NEW MATCH IS A NEW MATCH. createMatch builds fresh players, so this is really a guard
    // against health ever being hung off something module-level that outlives one of them.
    const m = fresh();
    beat(m, 12);
    const next = fresh();
    ok('a new match starts both players at full health',
       next.players[0].hp === 1 && next.players[1].hp === 1);
    ok('and neither of them is carrying a stun into it',
       next.players[0].stunned === 0 && next.players[1].stunned === 0);
  }

  // ---- 9. nothing else moved -----------------------------------------------
  {
    // Damage must not pay a meter, move a score or touch the ball. The tackler's gauge gain is
    // TACKLE_GAUGE and was already there; what is asserted is that damage adds nothing to it.
    const m = fresh();
    const a = m.players[0], v = m.players[1];
    tackle(m);
    ok('damage does not move the score', m.score[0] === 0 && m.score[1] === 0);
    ok('damage does not touch the victim\'s meter', v.gauge < 0.01, `gauge=${v.gauge.toFixed(3)}`);
    ok('and the tackler still gets exactly TACKLE_GAUGE',
       a.gauge >= C.TACKLE_GAUGE && a.gauge < C.TACKLE_GAUGE + 0.01, `gauge=${a.gauge.toFixed(4)}`);
    // Against a control stepped the same way without the kick — the ball is falling under
    // gravity in both, so the question is whether the tackle STRUCK it, not whether it moved.
    const ctrl = fresh();
    ctrl.ball.x = C.W / 2; ctrl.ball.y = 100;
    ctrl.players[1].x = ctrl.players[0].x + C.KICK_REACH;
    ctrl.hitStop = 0;
    step(ctrl, NONE);
    ok('a tackle still does not strike the ball',
       Math.abs(m.ball.x - ctrl.ball.x) < 1e-9 && Math.abs(m.ball.vx - ctrl.ball.vx) < 1e-9,
       `${m.ball.x.toFixed(2)}/${m.ball.vx.toFixed(2)} vs ${ctrl.ball.x.toFixed(2)}/${ctrl.ball.vx.toFixed(2)}`);
  }
}

console.log(`test-sim: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
