// Physics + rules tests. Run: node test-sim.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY, headR, stun, serialize, restore, playerContact } from './shared/sim.js';
import { walkBounds, barY, NET_DEEP } from './shared/goalbox.js';
import { shotFor, shotById, FAMILY_ORDER } from './shared/hs-powers.js';
import { CHAMPIONS } from './shared/champions.js';

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
//
// The shot's CUT-IN (1.34s of the whole match holding, POWER_CUTIN) is skipped here unless
// `keepCutin`: these blocks are about where the shot flies and what it hits, and the pause in
// front of it is asserted on its own (see THE CUT-IN below).
function firePower(m, i = 0, dir, keepCutin = false) {
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
  if (!keepCutin && m.cutin > 0) { m.hitStop = 0; m.cutin = 0; m.cutinBy = -1; }
  if (dir !== undefined && m.ball.power) { m.ball.vx = Math.abs(m.ball.vx) * dir; m.ball.power.dir = dir; }
  return m.ball.power;
}


const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
// Open play: past the KICK OFF banner and past the gauge's kickoff lead (GAUGE_LEAD), so the
// clock is running. The real kickoff is built with createMatch and asserted on its own.
const fresh = (opts) => {
  const m = createMatch(CA, CB, opts);
  m.freeze = 0; m.phase = 'play'; m.banner = null; m.bannerT = 0; m.gaugeLead = 0;
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
  ok('a goal puts up GOAL! and play runs on under it', m.banner === 'goal' && m.afterGoal > 0 && m.phase === 'play');
  run(m, Math.ceil(C.AFTER_GOAL / C.TICK) + 1);
  ok('then both are held on their spots', m.phase === 'goal' && m.freeze > 0);
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
  // Both part-filled. A goal used to wipe both meters, and later to gift the conceder a quarter
  // of one; Head Soccer's meter is a clock and nothing else, so now the goal adds NOTHING. Both
  // meters gain exactly the same — the clock's share of the ticks the goal took — and no more.
  conceded.gauge = 0.4; scorer.gauge = 0.7;
  scoreOn(m, true);
  ok('(the goal went in)', m.score[1] === 1, `score ${m.score.join('-')}`);
  const gotC = conceded.gauge - 0.4, gotS = scorer.gauge - 0.7;
  ok('conceding gives the conceder nothing the scorer did not also get',
     Math.abs(gotC - gotS) < 1e-9, `conceder +${gotC.toFixed(4)}, scorer +${gotS.toFixed(4)}`);
  ok('and what both got is only the clock',
     gotC >= 0 && gotC <= m.t * C.GAUGE_PASSIVE + 1e-9, `+${gotC.toFixed(4)} in ${m.t.toFixed(2)}s`);
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
  // no dash in the air: the same double-tap mid-jump does nothing
  const m = fresh();
  const p = m.players[0];
  step(m, [{ jump: true }, {}]);
  run(m, 6, [{ jump: true }, {}]);
  step(m, [{ right: true }, {}]);
  step(m, [{ right: false }, {}]);
  step(m, [{ right: true }, {}]);
  ok('no dash in the air', !p.onGround && !(p.dashT > 0), `onGround=${p.onGround} dashT=${p.dashT}`);
}
{
  // A player walks INTO their own goal and is stopped by the BACK of the net, not by the goal
  // line — the mouth is a doorway now, see shared/goalbox.js. test-goal.mjs owns the rest of
  // the room (the crossbar ceiling, no entry from above, no teleports); this is the one line
  // that used to say the opposite and has to keep saying the new thing.
  const m = fresh();
  run(m, 400, [{ left: true }, { right: true }]);
  ok('player 0 stops at the back of its net', m.players[0].x >= -NET_DEEP - 0.01, `x=${m.players[0].x}`);
  ok('player 0 got past the goal line', m.players[0].x < C.GOAL_W, `x=${m.players[0].x}`);
  ok('player 1 stops at the back of its net', m.players[1].x <= C.W + NET_DEEP + 0.01);
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
  // A HEAD IS SPRINGY (HS M4, HEAD_BOUNCE): a drop onto a still head goes back up at about
  // three quarters of the pace it came down at. It used to be a dead cushion (HEAD_DEADEN),
  // which HS does not have.
  ok('a head bounces a drop back up', m.ball.vy < -300 * 0.6 && m.ball.vy > -300,
     `vy=${m.ball.vy.toFixed(0)} off a 300 drop`);
}
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4;
  m.ball.vy = 300;
  const before = Math.abs(m.ball.vy);
  step(m, NONE);
  // A STILL head never returns a ball faster than it arrived: the bounce is relative to the
  // head, so only a head that is itself moving up (a jump) adds pace. About as lively as the
  // grass — HS M4 reads 0.79 off a still head and 0.65 off the grass.
  ok('a still head bounces, but never harder than the ball came',
     Math.abs(m.ball.vy) < before && Math.abs(m.ball.vy) > before * C.BALL_BOUNCE * 0.9,
     `${Math.abs(m.ball.vy).toFixed(0)} back off a ${before.toFixed(0)} drop, vs ${(before * C.BALL_BOUNCE).toFixed(0)} off the ground`);
}

// --- HS's KICK: no header button, a boot that rises to head height ---------------
{
  const kickAt = (dx, h, ticks = 4) => {
    const m = fresh();
    const p = m.players[0];
    p.x = 400; p.kickCd = 0; p.prev = {};
    m.players[1].x = C.W - 60;
    const seen = [];
    for (let i = 0; i < ticks; i++) {
      m.hitStop = 0;
      if (i < 2 && !seen.some((e) => e.type === 'strike')) { m.ball.x = p.x + dx; m.ball.y = C.GROUND_Y - h; m.ball.vx = 0; m.ball.vy = 0; }
      step(m, [{ kick: i === 0 }, {}]); seen.push(...m.events); m.events.length = 0;
    }
    return { m, strike: seen.find((e) => e.type === 'strike') };
  };
  for (const dx of [30, 40, 50]) {
    const { m, strike } = kickAt(dx, C.BALL_R);
    ok(`a ball resting ${dx}px out is KICKED, not headed`, !!strike && !strike.head && m.ball.vx > 0,
       JSON.stringify(strike));
  }
  const { strike: hi } = kickAt(62, 70, 8);
  ok('a still ball 70px up in front is met by the raised boot', !!hi && !hi.head, JSON.stringify(hi));
  const { strike: hs } = kickAt(10, C.GROUND_Y - headY(fresh().players[0]) + 4, 3);
  ok('KICK with the ball on your head is never an aimed header', !hs || !hs.aimed, JSON.stringify(hs));
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
  // The press spent the meter and it has been refilling since: 600 ticks of the clock's rate.
  ok('and the meter refills while it waits', Math.abs(p.gauge - 600 * C.TICK * C.GAUGE_PASSIVE) < 1e-9, `gauge=${p.gauge}`);
}
{
  // a straight power shot is DEAD FLAT (HS M4 43.07–43.33 s: level from release to the defender)
  const m = fresh();
  m.players[0].shot = shotById('straight');
  firePower(m, 0);
  const y0 = m.ball.y;
  run(m, 12);
  ok('a straight power shot holds its line', Math.abs(m.ball.y - y0) < 2, `dy=${(m.ball.y - y0).toFixed(1)}`);
}

// Walk a live shot onto player `i`, pressing KICK once when it is `reach` px away — the block.
function kickInto(m, i, reach = 130, ticks = 90) {
  const q = m.players[i];
  let pressed = false;
  const log = [];
  for (let t = 0; t < ticks; t++) {
    const near = !pressed && m.ball.power && m.ball.power.owner !== i && Math.abs(m.ball.x - q.x) < reach;
    if (near) pressed = true;
    const inputs = [{}, {}]; inputs[i] = { kick: near };
    step(m, inputs);
    log.push(...m.events);
    m.events.length = 0;
  }
  return log;
}
{
  // THE BLOCK IS A KICK (HS M4 61.45 s, 79.55 s — Kick lit both times). The ball grinds on the boot,
  // the blocker is dazed for POWER_BLOCK_STUN and only that, and nothing is scored off it.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = shotById('straight');
  b.x = a.x + 300;
  firePower(m, 0);
  const log = kickInto(m, 1, 130, 20);
  ok('a defender who kicks into the power shot blocks it', log.some((e) => e.type === 'blocked' && e.player === 1) && m.score[0] === 0,
     log.map((e) => e.type).join(','));
  ok('and the block dazes him, for POWER_BLOCK_STUN',
     log.some((e) => e.type === 'stunned' && e.player === 1 && Math.abs(e.time - C.POWER_BLOCK_STUN) < 1e-9) && !('hp' in b), `stunned=${b.stunned}`);
  run(m, Math.ceil(C.POWER_BLOCK_STUN / C.TICK) + 1);
  ok('…and the daze runs out', b.stunned === 0, `stunned=${b.stunned}`);
  const x0 = b.x;
  run(m, 5, [{}, { left: true }]);
  ok('a defender who blocked still answers the controls', Math.abs(b.x - x0) > 5, `moved ${Math.abs(b.x - x0).toFixed(1)}px`);
}
{
  // …AND THE BLOCKED BALL GOES BACK AS HIS SHOT: 0.8s grinding, 0.4s dead at his feet, then it
  // fires at the shooter's goal (M4 62.75 s, 80.75 s).
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = shotById('straight');
  b.x = a.x + 300;
  firePower(m, 0);
  const log = kickInto(m, 1, 130, 20);
  ok('(blocked)', log.some((e) => e.type === 'blocked'));
  const back = [];
  for (let t = 0; t < 90 && !back.some((e) => e.type === 'rebound'); t++) { step(m, NONE); back.push(...m.events); m.events.length = 0; }
  ok('the block fires back as the blocker\'s own power shot', back.some((e) => e.type === 'rebound' && e.player === 1) &&
     m.ball.power && m.ball.power.owner === 1 && m.ball.vx * b.side > 0, JSON.stringify(m.ball.power && { o: m.ball.power.owner, vx: m.ball.vx }));
}
{
  // STANDING IN ITS PATH IS NOT A BLOCK (M3 38.25 s, M4 43.33 s): the defender is knocked back
  // toward his own net, dazed with three stars, and the ball bounces off him.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = shotById('straight');
  b.x = a.x + 300;
  firePower(m, 0);
  const log = [];
  for (let t = 0; t < 20; t++) { step(m, NONE); log.push(...m.events); m.events.length = 0; }
  ok('a standing defender is hit, not blocking', log.some((e) => e.type === 'powerHit' && e.player === 1) && !log.some((e) => e.type === 'blocked'));
  ok('he is thrown toward his own goal', b.vx * b.side < 0 || b.x > a.x + 300, `vx=${b.vx.toFixed(0)}`);
  ok('dazed for POWER_BLOCK_STUN, with the stars', log.some((e) => e.type === 'stunned' && e.player === 1 && Math.abs(e.time - C.POWER_BLOCK_STUN) < 1e-9) && b.ail === 'stars');
  ok('and the ball bounces off him, no longer the shot', !m.ball.power, `vx=${m.ball.vx.toFixed(0)}`);
}
{
  // Head Soccer has no unarmed COUNTER: a kick from out of reach does nothing to a power ball.
  const m = fresh();
  const b = m.players[1];
  m.players[0].shot = shotById('straight');
  firePower(m, 0);
  m.hitStop = 0;
  m.ball.x = C.W / 2; m.ball.y = 200;
  step(m, [{}, { kick: true }]);
  ok('an out-of-reach kick changes nothing', m.ball.power && m.ball.power.owner === 0 && m.ball.power.ph === 'fly');
  void b;
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
  // …and does NOT touch the meter: the press emptied it and the refill has run since.
  ok('and leaves the refill alone', p.gauge > 0 && p.gauge < 0.05, `gauge=${p.gauge}`);
}
{
  // ARMED BEATS INCOMING: a defender who is ALSO armed and gets hit by the incoming shot does
  // not just block it and take the damage — the touch fires their own ultimate instead, same
  // as any other touch on the ball while armed. Their shot replaces the incoming one entirely.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = shotById('straight'); b.shot = shotById('updown');
  firePower(m, 0, 1);                 // a's shot, flying toward b
  ok('the incoming shot is a\'s', m.ball.power && m.ball.power.owner === 0);
  ok('b starts unarmed', b.armed === 0);
  armPower(m, 1);                     // b arms while a's shot is already live
  ok('b is armed with a live enemy shot on the pitch', b.armed > 0 && !!m.ball.power);
  m.hitStop = 0;
  m.ball.x = b.x; m.ball.y = headY(b); m.ball.vx = 0; m.ball.vy = 0;
  m.events.length = 0;
  step(m, [{}, {}]);
  ok('b was not knocked down', b.stunned === 0, `stunned=${b.stunned}`);
  ok('the touch fired b\'s own shot, not a\'s', m.ball.power && m.ball.power.fam === 'updown',
     `shot=${m.ball.power?.fam}`);
  ok('ownership moved to b', m.ball.power && m.ball.power.owner === 1);
  ok('b\'s arm is spent (the press already spent its gauge)', b.armed === 0 && b.gauge < 0.05);
  ok('the event says it was a counter', m.events.some((e) => e.type === 'powershot' && e.countered),
     JSON.stringify(m.events));
}
// --- the head bounces, the chest deadens ---------------------------------------
{
  // HS M4: the passive head touch is a restitution bounce (HEAD_BOUNCE, ~0.75 relative to the
  // head). The body bounces the same way (HS is one Box2D restitution everywhere).
  const drop = (yOffset) => {
    const m = fresh();
    const p = m.players[0];
    m.ball.x = p.x; m.ball.y = headY(p) + yOffset; m.ball.vy = 400;
    step(m, NONE);
    return -m.ball.vy;
  };
  const head = drop(-C.HEAD_R - C.BALL_R + 4);
  ok('a head sends a drop back up at ~HEAD_BOUNCE of its pace', Math.abs(head - 400 * C.HEAD_BOUNCE) < 400 * 0.1,
     `${head.toFixed(0)} of 400 (HEAD_BOUNCE ${C.HEAD_BOUNCE})`);
  // Walking into a still ball: HS's body sends it on at ~(1 + e) of your pace, not dead at your feet.
  const w = fresh(), q = w.players[0];
  q.x = 400; w.players[1].x = C.W - 60;
  w.ball.x = q.x + C.BODY_W / 2 + C.BALL_R + 3; w.ball.y = C.GROUND_Y - C.BALL_R; w.ball.vx = 0; w.ball.vy = 0;
  let out = 0;
  for (let i = 0; i < 20; i++) { step(w, [{ right: true }, {}]); out = Math.max(out, w.ball.vx); }
  ok('walking into the ball bounces it on ahead of you (HS)', out > C.PLAYER_SPEED * 1.4, `${out.toFixed(0)} px/s vs walk ${C.PLAYER_SPEED}`);
}
{
  // Low contact — chest height and below — BOUNCES, as in HS (one Box2D restitution; it used to
  // be deadened on request, and Idan chose HS).
  const m = fresh();
  const p = m.players[0];
  const hy = headY(p);
  m.ball.x = p.x + (C.HEAD_R + C.BALL_R) * 0.7;
  m.ball.y = hy + (C.HEAD_R + C.BALL_R) * 0.7;      // ny ≈ 0.7, well past DEADEN_ZONE
  m.ball.vx = -600; m.ball.vy = 0;
  step(m, NONE);
  ok('low contact bounces the ball back out', m.ball.vx > 150, `vx=${m.ball.vx.toFixed(0)} (was -600)`);
  ok('at no more than the head\'s restitution', m.ball.vx <= 600 * C.HEAD_BOUNCE + 5, `vx=${m.ball.vx.toFixed(0)}`);
}
{
  // A head RISING from its jump is a surface moving up, so it returns the ball faster than a
  // still one does — HS M4's passive jumping headers leave at ~720px/s off a ~580 arrival.
  const off = (vy) => {
    const m = fresh();
    const p = m.players[0];
    p.vy = vy; p.onGround = vy === 0;
    m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 3; m.ball.vy = 400;
    step(m, NONE);
    return -m.ball.vy;
  };
  const still = off(0), rising = off(-200);
  ok('a rising head returns the ball faster than a still one', rising > still + 150,
     `${rising.toFixed(0)} off a head rising at 200 vs ${still.toFixed(0)} off a still one`);
  ok('and faster than it came', rising > 400, `${rising.toFixed(0)} from a 400 drop`);
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
  // A TACKLE PAYS NO GAUGE (Head Soccer): the tackler's meter moves by exactly one tick of the
  // clock and not a hair more. It used to pay TACKLE_GAUGE, a fifth of a meter a hit.
  ok('the tackler gains no gauge from it', Math.abs(a.gauge - C.TICK * C.GAUGE_PASSIVE) < 1e-9,
     `gauge=${a.gauge.toFixed(4)}`);
  ok('and the victim\'s meter is not touched either', Math.abs(b.gauge - C.TICK * C.GAUGE_PASSIVE) < 1e-9,
     `gauge=${b.gauge.toFixed(4)}`);
  ok('the victim takes no damage and is not knocked down', !('hp' in b) && b.stunned === 0);
  ok('the tackle event carries no health', m.events.some((e) => e.type === 'tackle' && !('hp' in e) && !('damage' in e)),
     JSON.stringify(m.events.filter((e) => e.type === 'tackle')));
  ok('the victim is knocked back', Math.abs(b.vx) > 100, `vx=${b.vx.toFixed(0)}`);
  // …TOWARD THEIR OWN GOAL. b is player 1, who defends the RIGHT net (side -1), so the shove
  // is +x — here that is also away from the tackler, which the next block pulls apart.
  ok('toward their own goal', Math.sign(b.vx) === -b.side, `vx=${b.vx.toFixed(0)} side=${b.side}`);
  ok('a tackle grants immunity', b.tackleImmune > 0);
  // HS has no hit-stop on a touch (HIT_STOP_TACKLE, constants.js): the game does not stop.
  ok('a tackle does not freeze the game', m.hitStop === 0, `hitStop=${m.hitStop}`);
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
  // ONE GRAVITY, UP AND DOWN ALIKE. This used to assert the opposite — falling FALL_MULT heavier
  // than rising, the platformer's trick. HS M4's jumps are one parabola (595 px/s² both ways), so
  // one tick of rise and one tick of fall now pick up exactly the same speed. ONE tick of each:
  // comparing two ticks of rise against one of fall proves nothing.
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

  ok('gravity is the same on the way down as on the way up', Math.abs(dFall - dRise) < 1e-9,
     `rise +${dRise.toFixed(2)}/tick vs fall +${dFall.toFixed(2)}/tick`);
  ok('and it is PLAYER_GRAV, 595 (HS M4)', Math.abs(dRise - C.PLAYER_GRAV * C.TICK) < 1e-9 && C.PLAYER_GRAV === 595,
     `${(dRise / C.TICK).toFixed(1)} px/s²`);
}

// --- HS movement (M4) ---------------------------------------------------------
// The measured feel, asserted as behaviour rather than as constants: what a player's body does
// on the ticks after a press. The numbers are Head Soccer's (docs/hs-reference.json), measured on
// the STARTER character — so these bodies play at 1x stats, not the legendary card's +6%.
const starter = (m) => { for (const p of m.players) p.stats = { speed: 1, jump: 1, kick: 1 }; return m; };
const jumpArc = (input) => {
  // One jump from standing, JUMP held for as long as `input(i)` says. Apex (px above standing)
  // and ticks from takeoff to landing.
  const m = starter(fresh());
  const p = m.players[0];
  m.ball.x = C.W - 40; m.ball.y = C.GROUND_Y - C.BALL_R;      // out of the way
  const y0 = p.y;
  let apex = 0, up = -1, down = -1, jumps = 0;
  for (let i = 0; i < 120; i++) {
    step(m, [{ jump: input(i) }, {}]);
    jumps += m.events.filter((e) => e.type === 'jump' && e.player === 0).length;
    m.events.length = 0;
    if (up < 0 && !p.onGround) up = i;
    apex = Math.max(apex, y0 - p.y);
    if (up >= 0 && down < 0 && p.onGround) { down = i; break; }
  }
  return { apex, air: down - up, jumps, p, m };
};
{
  const tap = jumpArc((i) => i === 0);
  const hold = jumpArc((i) => i < 30);
  // v²/2g less the integrator's half-tick: 46.4 sampled (see JUMP_V). HS: 45.8.
  ok('a tapped jump peaks ~46px up (HS M4 45.8)', tap.apex > 44 && tap.apex < 48, `${tap.apex.toFixed(1)}px`);
  ok('and HOLDING jump does not make it any higher — no variable height', Math.abs(hold.apex - tap.apex) < 1e-9,
     `tap ${tap.apex.toFixed(2)} vs hold ${hold.apex.toFixed(2)}`);
  ok('it is in the air ~0.79s (2 x 235 / 595)', Math.abs(tap.air * C.TICK - 0.79) < 0.03, `${(tap.air * C.TICK).toFixed(3)}s`);
}
{
  // HOLD JUMP AND YOU KEEP JUMPING: 3 ticks (0.05s) after every landing, with no fresh press.
  const m = fresh();
  const p = m.players[0];
  const takeoffs = [];
  let landed = -1, gap = -1;
  for (let i = 0; i < 150; i++) {
    const was = p.onGround;
    step(m, [{ jump: true }, {}]);
    if (was && !p.onGround) { takeoffs.push(i); if (landed >= 0 && gap < 0) gap = i - landed; }
    if (!was && p.onGround) landed = i;
  }
  ok('a held jump re-jumps on its own', takeoffs.length >= 2, `takeoffs at ${takeoffs.join(',')}`);
  ok('JUMP_REJUMP (3 ticks, HS M4 0.05s) after landing', gap === 3, `gap ${gap} ticks`);
  // …and a fresh press on the grass still takes off on the tick it is pressed.
  const n = fresh();
  step(n, [{ jump: true }, {}]);
  ok('a press takes off on the very tick', !n.players[0].onGround && n.players[0].vy < 0);
}
{
  // NO DOUBLE JUMP (MAX_JUMPS 1): a second press near the top of the arc does nothing.
  const two = jumpArc((i) => i === 0 || i === 20);
  ok('there is no second jump in the air', two.jumps === 1 && Math.abs(two.apex - jumpArc((i) => i === 0).apex) < 1e-9,
     `jumps=${two.jumps}`);
}
{
  // INSTANT RUN, STOP AND TURN (HS M4: each inside 3 frames). The body takes the stick's
  // velocity on the tick it is pressed; on the grass and — assumed, unmeasured — in the air.
  const m = starter(fresh());
  const p = m.players[0];
  step(m, [{ right: true }, {}]);
  ok('full speed on the first tick', p.vx === C.PLAYER_SPEED && C.PLAYER_SPEED === 228, `vx=${p.vx}`);
  step(m, [{}, {}]);
  ok('a dead stop on the tick it is let go', p.vx === 0, `vx=${p.vx}`);
  // (A fresh body for the turn: right, let go, right again is a double tap — a dash.)
  const t = starter(fresh()), q = t.players[0];
  run(t, 5, [{ right: true }, {}]);
  step(t, [{ left: true }, {}]);
  ok('and a reversal in one tick', q.vx === -C.PLAYER_SPEED, `vx=${q.vx}`);
  // In the air too (the assumption, stated in constants.js).
  step(m, [{}, {}]);
  run(m, 16);                                          // clear of the double-tap window
  step(m, [{ jump: true, right: true }, {}]);
  step(m, [{}, {}]);
  ok('the air is steered the same way (assumed)', !p.onGround && p.vx === 0, `vx=${p.vx} air=${!p.onGround}`);
}
{
  // THE DASH: double-tap, 5 ticks at DASH_V (1790) — what the camera reads as HS's 4 frames and
  // 120px (see DASH_TIME) — then straight back to a walk; and not again for DASH_COOLDOWN.
  const m = starter(fresh());
  const p = m.players[0];
  const seq = [{ right: true }, {}, { right: true }];
  const vs = [];
  for (let i = 0; i < 14; i++) { step(m, [seq[i] || { right: true }, {}]); vs.push(p.vx); }
  const fast = vs.filter((v) => v === C.DASH_V).length;
  ok('a double tap dashes at 1790 px/s', vs.includes(1790), vs.join(','));
  ok('for 5 ticks', fast === 5, `${fast} ticks`);
  ok('then walks again at once', vs[vs.length - 1] === C.PLAYER_SPEED);
  // Cooldown: a second double-tap straight after does not dash.
  m.events.length = 0;
  for (let i = 0; i < 6; i++) step(m, [i % 2 ? {} : { right: true }, {}]);
  ok('no second dash inside DASH_COOLDOWN (HS >= 0.42s)', !m.events.some((e) => e.type === 'dash') && C.DASH_COOLDOWN >= 0.42);
}
{
  // THE KICK'S CLOCKS (HS M4): the leg is out 0.26s, and a mashed kick comes round every 0.349s.
  const m = fresh();
  const p = m.players[0];
  m.ball.x = C.W - 40; m.ball.y = C.GROUND_Y - C.BALL_R;       // nothing to hit
  m.players[1].x = C.W - 150;
  const kicks = [];
  let out = 0;
  for (let i = 0; i < 90; i++) {
    step(m, [{ kick: i % 2 === 0 }, {}]);
    if (m.events.some((e) => e.type === 'kick')) kicks.push(i);
    if (kicks.length === 1 && p.kickT > 0) out++;
    m.events.length = 0;
  }
  ok('the leg stays out 0.26s', Math.abs(out * C.TICK - 0.26) < 1.5 * C.TICK, `${(out * C.TICK).toFixed(3)}s`);
  const gap = (kicks[1] - kicks[0]) * C.TICK;
  ok('and a mashed kick repeats every ~0.35s', Math.abs(gap - 0.349) < 0.04, `${gap.toFixed(3)}s (${kicks.join(',')})`);
}

// --- hit-stop ---------------------------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  // HS has no hit-stop on a touch: ~85 of them a match each froze the game for 3 frames, which
  // is what "the game feels a little bit stuck" was (HIT_STOP_KICK, constants.js).
  ok('a solid kick does not freeze the game', m.hitStop === 0, `hitStop=${m.hitStop}`);
  const bx = m.ball.x;
  step(m, [{}, {}]);
  ok('the kicked ball flies on the very next tick', Math.abs(m.ball.x - bx) > 1, `dx=${(m.ball.x - bx).toFixed(2)}`);
  // The mechanism stays, for the blocked power shot (HIT_STOP_POWER).
  m.hitStop = C.HIT_STOP_POWER;
  const fx = m.ball.x;
  step(m, [{}, {}]);
  ok('the world is frozen during hit-stop', Math.abs(m.ball.x - fx) < 0.001);
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
  // THE GAUGE IS A CLOCK (Head Soccer). Nobody touches anything: both meters go from empty to
  // full in 1 / GAUGE_PASSIVE seconds — 15s, HS M4's first fill AND its refill — and stay full.
  const m = fresh();
  const full = 1 / C.GAUGE_PASSIVE;
  ok('(the fill time is HS\'s 15s)', Math.abs(full - 15) < 1e-9, `${full}s`);
  run(m, Math.round((full - 0.5) / C.TICK));
  const [p0, p1] = m.players;
  ok('half a second short of it, the gauge is not yet full', p0.gauge < 1 && p0.gauge > 0.95,
     `gauge=${p0.gauge.toFixed(3)}`);
  ok('and it has filled at the clock\'s rate', Math.abs(p0.gauge - m.t * C.GAUGE_PASSIVE) < 1e-6,
     `${p0.gauge.toFixed(4)} after ${m.t.toFixed(2)}s`);
  run(m, Math.round(1 / C.TICK));
  ok('half a second past it, both gauges are full', p0.gauge === 1 && p1.gauge === 1,
     `${p0.gauge} / ${p1.gauge}`);
  run(m, Math.round(5 / C.TICK));
  ok('and a full gauge stays full, never past it', p0.gauge === 1 && p1.gauge === 1);
  ok('the clock alone arms nobody', p0.armed === 0 && p1.armed === 0);
}
{
  // THE FIRST FILL, FROM A REAL KICKOFF: 15.0s after the KICK OFF banner ends (HS M4), the same
  // 15s as its refill from the press (see GAUGE_PASSIVE): nothing under the banner, 1/15 a
  // second of play after it.
  const m = createMatch(CA, CB, {});
  run(m, Math.round(C.KICKOFF_FREEZE / C.TICK) - 2);
  ok('the gauge does not fill under the KICK OFF banner', m.players[0].gauge === 0 && m.phase === 'kickoff');
  let t = 0;
  while (m.phase !== 'play') { step(m, NONE); }
  while (m.players[0].gauge < 1 && t < 30) { m.ball.x = C.W / 2; m.ball.y = 60; m.ball.vx = m.ball.vy = 0; step(m, NONE); t += C.TICK; }
  ok('the first fill takes ~15s from the banner (HS M4 14.99)', Math.abs(t - 15) < 0.1, `${t.toFixed(2)}s`);
}
{
  // It runs straight through a cut-in (HS M4 40.44 s / 41.97 s: same rate under both), and it
  // STOPS through a goal's restart (M4: still from the goal at 43.40 s to the ball at 46.59 s).
  const m = fresh();
  m.hitStop = 1; m.cutin = 1; m.cutinBy = 0;
  run(m, 30);
  ok('the gauge fills under a cut-in', Math.abs(m.players[0].gauge - 30 * C.TICK * C.GAUGE_PASSIVE) < 1e-9, `${m.players[0].gauge}`);
  const n = fresh();
  scoreOn(n, true);
  const g0 = n.players[0].gauge;
  run(n, 60);
  ok('but not through a goal\'s restart', n.afterGoal > 0 && n.players[0].gauge === g0, `${g0} → ${n.players[0].gauge}`);
  while (n.afterGoal > 0 || n.phase === 'goal') step(n, NONE);
  ok('nor while the ball has still to drop in', n.ballWait > 0 && n.players[0].gauge === g0, `${g0} → ${n.players[0].gauge}`);
  while (n.ballWait > 0) step(n, NONE);
  step(n, NONE);
  ok('it starts again with the ball', n.players[0].gauge > g0, `${g0} → ${n.players[0].gauge}`);
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
  ok('no goal counts while sudden death restarts', m.score[1] === 0 && m.phase !== 'over');
  run(m, Math.ceil((C.GOLDEN_HOLD + C.GOAL_BALL_DELAY) / C.TICK) + 2);
  scoreOn(m, true);
  ok('a golden goal ends it', m.phase === 'over' && m.score[1] === 1);
}
{
  // SUDDEN DEATH IS A RESTART (HS M2, 5–5 at 0:00): both players back on their spots, the ball
  // dropped in at the centre ~2.5 s after the whistle.
  const m = fresh({ duration: 0.5 });
  m.players[0].x = 700; m.players[1].x = 300;
  let t = 0, drop = -1;
  while (!m.golden) { step(m, NONE); m.events.length = 0; }
  ok('sudden death puts both players back on their spots', m.players[0].x === C.SPAWN_X[0] && m.players[1].x === C.SPAWN_X[1] && m.phase === 'goal');
  while (drop < 0 && t < 4) { step(m, NONE); t += C.TICK; if (m.events.some((e) => e.type === 'ballDrop')) drop = t; m.events.length = 0; }
  ok('and the ball drops in ~2.5 s after the whistle', Math.abs(drop - 2.5) < 2 * C.TICK, `${drop.toFixed(3)}s`);
}

// --- roster -----------------------------------------------------------------
{
  const seen = new Set();
  for (const r of ['common', 'rare', 'epic', 'legendary']) {
    for (let n = 1; n <= 45; n++) {
      const s = shotFor({ rarity: r, number: n });
      ok(`every card has a family (${r}_${n})`, !!s && FAMILY_ORDER.includes(s.family));
      seen.add(s.family);
    }
  }
  ok('every one of the eleven families is on some card', FAMILY_ORDER.every((f) => seen.has(f)), [...seen].join(','));
  ok('champion cards fire their mapped shot', shotFor({ rarity: 'legendary', number: 3 }).family === 'straight' &&
     shotFor({ rarity: 'legendary', number: 3 }).ailment === 'burn' && shotFor({ rarity: 'legendary', number: 2 }).family === 'grab');
}

// --- determinism ------------------------------------------------------------
{
  const seq = (i) => [{ right: i % 40 < 20, jump: i % 27 === 0, kick: i % 13 === 0 }, { left: i % 31 < 15, kick: i % 17 === 0 }];
  const a = fresh(); run(a, 600, seq);
  const b = fresh(); run(b, 600, seq);
  ok('the sim is deterministic', JSON.stringify(a.ball) === JSON.stringify(b.ball) && a.score.join() === b.score.join());
}

// --- no pace layer -----------------------------------------------------------------
// The PACE dial (a 0.68x slow-motion over every speed, gravity, drag and duration) is gone: the
// constants are Head Soccer's own absolute per-second numbers, so there is nothing to rescale.
// This used to prove the dial kept a jump's shape; now it proves the dial cannot come back
// quietly and the numbers the file says are the numbers the sim runs.
{
  ok('there is no PACE and no setPace', !('PACE' in C) && !('setPace' in C) && !C.TUNABLE.includes('PACE'));
  const m = starter(fresh());
  const p = m.players[0];
  step(m, [{ right: true }, {}]);
  ok('a constant is the live value (PLAYER_SPEED reads what the body does)', p.vx === C.PLAYER_SPEED);
  m.ball.x = C.W / 2; m.ball.y = 100; m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE);
  ok('and BALL_GRAV is the ball\'s fall, per second, as written', Math.abs(m.ball.vy - C.BALL_GRAV * C.TICK) < 1e-9, `${m.ball.vy / C.TICK}`);
}

// --- THE CUT-IN ------------------------------------------------------------
// HS M4, 7 cut-ins: 1.34s of the whole match holding the moment a power shot fires. A sim pause,
// so an online client freezes on the same tick; asserted here as frozen bodies, a frozen ball,
// a stun that is not run down under it, and a restored snapshot that finishes it identically.
{
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = shotById('straight');
  firePower(m, 0, undefined, true);
  // 1.34s of dark (POWER_CUTIN), of which the first 1.14s is a hold: the ball leaves then and play
  // runs under the last POWER_RELEASE (M4 60.17 → 61.27 → 61.49 s).
  const HOLD = C.POWER_CUTIN - C.POWER_RELEASE;
  ok('firing a power shot starts a cut-in', m.cutin === C.POWER_CUTIN && m.cutinBy === 0 && Math.abs(m.hitStop - HOLD) < C.TICK,
     `cutin=${m.cutin} hitStop=${m.hitStop} by=${m.cutinBy}`);
  b.stunned = 0.4;
  const before = JSON.stringify([m.ball.x, m.ball.y, a.x, a.y, b.x, b.y, m.clock]);
  const snap = serialize(m);
  const ticks = Math.round(HOLD / C.TICK) - 2;
  run(m, ticks, [{ right: true, jump: true }, { left: true }]);
  ok('the whole match holds for the first 0.97s — both bodies and the ball',
     JSON.stringify([m.ball.x, m.ball.y, a.x, a.y, b.x, b.y]) === JSON.stringify(JSON.parse(before).slice(0, 6)));
  ok('but the clock runs on under it (HS M4 40.44 s / 60.19 s)', Math.abs(JSON.parse(before)[6] - m.clock - ticks * C.TICK) < 1e-6,
     `${JSON.parse(before)[6]} → ${m.clock}`);
  ok('and a daze is not run down under the hold', b.stunned === 0.4, `stunned=${b.stunned}`);
  run(m, 4, NONE);
  ok('then the shot flies while it is still dark', m.cutin > 0 && m.hitStop <= 0 && !!m.ball.power && m.ball.x !== JSON.parse(before)[0], `cutin=${m.cutin}`);
  run(m, Math.round(C.POWER_RELEASE / C.TICK), NONE);
  ok('and the dark lifts at POWER_CUTIN', m.cutin === 0 && m.cutinBy === -1);
  // Restore mid-cut-in into two fresh matches and play both on: they have to agree tick for tick.
  const r = fresh(), q = fresh();
  r.players[0].shot = shotById('straight'); q.players[0].shot = shotById('straight');
  restore(r, snap); restore(q, snap);
  run(r, ticks + 4, NONE); run(q, ticks + 4, NONE);
  ok('a snapshot taken inside the cut-in carries it', snap.cutin > 0 && snap.cutinBy === 0 &&
     JSON.stringify(serialize(r)) === JSON.stringify(serialize(q)) && r.hitStop <= 0 && !!r.ball.power);
}

// --- HS restarts ---------------------------------------------------------------
{
  // KICKOFF: KICK OFF for 2.17s, nobody moving; the ball waiting 302px above the grass.
  const m = createMatch(CA, CB, {});
  ok('a match opens on the KICK OFF banner', m.phase === 'kickoff' && m.banner === 'kickoff' && m.freeze === C.KICKOFF_FREEZE && C.KICKOFF_FREEZE === 2.17);
  ok('with the ball 302px up at the centre', m.ball.x === C.W / 2 && Math.abs(C.GROUND_Y - m.ball.y - 302) < 1e-9);
  let t = 0;
  while (m.phase === 'kickoff') { step(m, [{ right: true }, {}]); t += C.TICK; }
  ok('play starts 2.17s in', Math.abs(t - 2.17) < 1.5 * C.TICK, `${t.toFixed(3)}s`);
}
{
  // AFTER A GOAL: GOAL! for 2.05s, players moving at 2.24s, the ball dropping in at 2.795s with
  // a 138 px/s drift toward whoever conceded.
  const m = fresh();
  const b = m.ball;
  b.x = C.GOAL_W + b.r + 2; b.y = C.GROUND_Y - 60; b.vx = -600; b.vy = 0;
  let t = 0;
  while (!m.afterGoal && t < 1) { step(m, NONE); t += C.TICK; }
  ok('a goal puts up GOAL!, and play runs on under it', m.phase === 'play' && m.banner === 'goal' && m.afterGoal > 0);
  t = 0;
  let bannerOff = -1, moved = -1, drop = -1, held = -1;
  while (t < 4 && drop < 0) {
    const x0 = m.players[0].x;
    step(m, [{ right: true }, {}]);
    t += C.TICK;
    if (bannerOff < 0 && !m.banner) bannerOff = t;
    if (held < 0 && m.phase === 'goal') held = t;
    if (held >= 0 && moved < 0 && m.phase === 'play' && m.players[0].x !== x0) moved = t;
    if (m.events.some((e) => e.type === 'ballDrop')) drop = t;
    m.events.length = 0;
  }
  ok('the GOAL! banner is up 2.05s', Math.abs(bannerOff - 2.05) < 1.5 * C.TICK, `${bannerOff.toFixed(3)}s`);
  ok('then the players are put on their spots and held', Math.abs(held - 2.05) < 1.5 * C.TICK, `${held.toFixed(3)}s`);
  // The freeze lifts on the tick it runs out and the body moves on the next: a tick of slack.
  ok('the players move again at 2.24s', Math.abs(moved - 2.24) < 2 * C.TICK, `${moved.toFixed(3)}s`);
  ok('the ball drops in at 2.795s', Math.abs(drop - 2.795) < 1.5 * C.TICK, `${drop.toFixed(3)}s`);
  ok('302px up, drifting 138 px/s toward the conceder', Math.abs(C.GROUND_Y - b.y - 302) < 2 &&
     Math.abs(Math.abs(b.vx) - 138) < 3 && Math.sign(b.vx) === m.players[0].side,
     `y ${(C.GROUND_Y - b.y).toFixed(1)} vx ${b.vx.toFixed(1)}`);
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
// Same button, two strengths, decided by where you are standing: a hit you never saw coming
// shoves you less (TACKLE_PUSH_BACK). It used to FREEZE you, and later to cost half again as
// much hidden health; both are gone, and both hits push the victim toward their OWN goal.
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
    return { dir: Math.sign(b.vx), side: b.side, vx: Math.abs(b.vx), behind: ev && ev.behind, stunned: b.stunned };
  };
  const front = hit(false), back = hit(true);
  // Against the LIVE constant, not the authored one: TACKLE_PUSH rides the PACE dial, so a
  // literal here would fail every time someone slowed the game down.
  ok('a tackle from the front is a shove', front.vx > C.TACKLE_PUSH * 0.9,
     `push ${front.vx.toFixed(0)} of ${C.TACKLE_PUSH.toFixed(0)}`);
  ok('both push the victim toward their own goal', front.dir === -front.side && back.dir === -back.side,
     `front ${front.dir}, back ${back.dir}, victim side ${front.side}`);
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
  // 1. THE GAUGE IS A CLOCK, AND NOTHING ELSE FILLS IT. It used to be earned off the opponent
  // (five tackles bought a volley, TACKLE_GAUGE) and standing still bought nothing. Head Soccer
  // is the other way round, so this asserts both halves: three seconds of nothing buys exactly
  // three seconds of GAUGE_PASSIVE, and a string of landed tackles buys not a hair more than
  // the ticks they took.
  const m = fresh();
  const [a, b] = m.players;
  run(m, 180);                                        // three seconds of doing nothing
  ok('the gauge fills on its own', Math.abs(a.gauge - 180 * C.TICK * C.GAUGE_PASSIVE) < 1e-9,
     `gauge ${a.gauge.toFixed(4)} after 3s`);

  const before = [a.gauge, b.gauge];
  let landed = 0, ticks = 0;
  // Count the tackles that LAND, not the swings taken (a swing can miss a victim still in the
  // air from the last one), and charge the clock for every tick either way.
  for (let i = 0; i < 9 && landed < 5; i++) {
    a.x = 500; b.x = 500 + 34; b.y = a.y; a.facing = 1; b.facing = -1;
    a.kickCd = 0; a.prev = {}; b.tackleImmune = 0; b.stunned = 0; m.hitStop = 0;
    step(m, [{ kick: true }, {}]); ticks++;
    if (m.events.some((e) => e.type === 'tackle')) landed++;
    m.events.length = 0;
  }
  const clock = ticks * C.TICK * C.GAUGE_PASSIVE;
  ok('(the tackles landed)', landed === 5, `${landed}/5`);
  ok('tackling adds nothing to the tackler\'s gauge', Math.abs(a.gauge - before[0] - clock) < 1e-9,
     `+${(a.gauge - before[0]).toFixed(4)} over ${ticks} ticks (clock ${clock.toFixed(4)})`);
  ok('and takes nothing off the victim\'s', Math.abs(b.gauge - before[1] - clock) < 1e-9,
     `+${(b.gauge - before[1]).toFixed(4)}`);
}
{
  // 2. PRESSING POWER ARMS AND EMPTIES THE BAR. It fires nothing, and it does not go anywhere
  // near the ball — the reason the rival can no longer let one off by existing. The meter IS
  // spent on the press (HS M4 36.49 s), so the refill runs while the player finds the ball.
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
  ok('and empties the gauge on the press', p.gauge === 0, `gauge ${p.gauge}`);
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
  ok('and the gauge is the refill since the press, not zeroed again', p.gauge > 20 * C.TICK * C.GAUGE_PASSIVE,
     `gauge ${p.gauge}`);
}
{
  // 5. IT IS STILL BLOCKABLE — by a KICK (HS M4 61.45 s). The ultimate leaves from wherever the
  // body met the ball, so the answer is to meet it with the boot wherever it arrives; it has to
  // remain an answer, or the shot is an automatic goal again.
  const m = fresh();
  const [a, d] = m.players;
  a.x = 300; a.facing = 1;
  a.shot = shotById('straight');
  firePower(m, 0);
  ok('(the ultimate is away)', !!m.ball.power);
  d.x = m.ball.x + 200; d.y = C.GROUND_Y; d.vy = 0; d.onGround = true;
  const log = kickInto(m, 1, 130, 30);
  const blocked = log.some((e) => e.type === 'blocked');
  ok('a boot in its path blocks it', blocked && m.score[0] === 0, `score ${m.score[0]}`);
  // HS's half-second daze (POWER_BLOCK_STUN) — not a knockdown.
  ok('and the block dazes, it does not knock down', log.some((e) => e.type === 'stunned' && e.player === 1 && e.time === C.POWER_BLOCK_STUN));
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
  m.ball.x = p.x + C.KICK_REACH + 34 + C.BALL_R; m.ball.y = p.y - C.BALL_R;
  // Rolling in FASTER than a player runs: steering is instant now (PLAYER_SPEED), so the body
  // turned left walks away from the ball at full speed on the very next tick, and a 260 px/s
  // ball never caught it inside the swing.
  m.ball.vx = -700; m.ball.vy = 0;
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
  m2.ball.vx = 700; m2.ball.vy = 0;
  m2.hitStop = 0;
  step(m2, [{}, { kick: true }]);
  let struck2 = m2.events.some((e) => e.type === 'strike');   // it can meet on the press tick
  m2.events.length = 0;
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
    // It has to come off the head and reach the grass. The head is springy now (HS M4), so it
    // bounces there a few times first — each lower — and then rolls off.
    const m = fresh();
    const p = m.players[0], b = m.ball;
    p.x = 400; p.y = C.GROUND_Y;
    m.players[1].x = 80;
    b.x = p.x; b.y = C.GROUND_Y - 200; b.vx = 0; b.vy = 300;
    let reached = -1, under = 0, deepest = 0;
    for (let i = 0; i < 540; i++) {
      m.hitStop = 0;
      step(m, NONE);
      if (reached < 0 && b.y > REST_Y - 1) reached = i;
      if (b.y > REST_Y + 0.5) under++;
      deepest = Math.max(deepest, embed(m, p));
    }
    ok('a ball dropped on a head does not balance there', reached >= 0,
       `never reached the grass; ended at y=${b.y.toFixed(1)}, rest is ${REST_Y}`);
    // Dead centre is the worst case: every bounce comes straight back down onto the crown, so
    // it bounces itself out (~4.5 s at HEAD_BOUNCE 0.75) before the curve can roll it off. Any
    // ball that lands a hair off centre is gone on the first bounce.
    ok('it rolls off once it has bounced itself out', reached >= 0 && reached < 480, `${reached} ticks`);
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
        // …and a ball WEDGED BETWEEN THE GRASS AND A HEAD: sitting on the ground under a chin,
        // the head pushes it down and the ground pushes it back up. Same over-constraint, and it
        // got commoner when the ball started rolling as far as HS's does (measured at ticks 2151
        // and 3624: the ball at rest height, 2px into the head's circle, 0 into the body).
        const onGrass = m.ball.y >= C.GROUND_Y - C.BALL_R - 0.5;
        const b = m.ball, cx = Math.max(p.x - C.BODY_W / 2, Math.min(b.x, p.x + C.BODY_W / 2));
        const cy = Math.max(p.y - C.BODY_H, Math.min(b.y, p.y));
        if (onGrass && C.BALL_R - Math.hypot(b.x - cx, b.y - cy) < 1.5) continue;
        // …and one WEDGED AGAINST A SIDE WALL by a body driving into it (a dash into the corner):
        // the wall holds it on one side, the body on the other. Found when the body started
        // bouncing the ball as HS's does (tick 3381: the wall clamps the ball, the dashing body pushes it
        // 5 px back off it, 15 px into the head).
        if ((b.x - C.BALL_R < 8 || b.x + C.BALL_R > C.W - 8) && Math.abs(b.x - p.x) < C.BODY_W / 2 + C.BALL_R + C.HEAD_R) continue;
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
//
// …except that JUMP is no longer only an edge. HS re-jumps on its own while JUMP is held
// (JUMP_REJUMP), so a button held through a pause IS a jump once the pause lifts — one, on the
// landing clock, not a second one out of the latch. KICK and POWER are still edges only, and
// POWER is asserted below the way JUMP used to be.
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
  ok('a jump HELD through a goal restart jumps once as play resumes (HS: a held JUMP re-jumps)',
     restart(true, true) === 1, `${restart(true, true)} jumps`);
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
  ok('a jump held right through a hit-stop jumps once, on the landing clock — not out of the latch',
     hitstop(true, true, true) === 1, `${hitstop(true, true, true)} jumps`);
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
// silently loses. `stunned` sits in the seat the old `effectId`/`effectT` (and later `hp`) sat
// in: it decides whether input is read at all, and the renderer draws the slump off it — leave
// it out and every reconcile flickers a downed player back onto their feet.
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
  p.stunned = 0.66; p.kickDir = -1;
  restore(m2, serialize(m));
  const lost = live.filter((k) => m2.players[0][k] !== p[k]);
  ok('every live player field survives serialize -> restore', lost.length === 0, `lost: ${lost.join(', ')}`);
  ok('the stun survives a reconcile', m2.players[0].stunned === 0.66, `${m2.players[0].stunned}`);
  ok('and the snapshot has no health seat any more', !('hp' in m2.players[0]) && !JSON.stringify(s).includes('"hp"'));
}

// ══ NO HEALTH: A TACKLE IS KNOCKBACK, AND THE ONE STUN IS A TIMER ═══════════════
//
// This section used to fence the hidden-health system: KICK_DAMAGE off every boot, the face
// bruising through four hurtTier looks, a 1.75s stun at 0%, regeneration, a revive at 40%.
// Head Soccer has none of it, so it was removed (hs-parity, Phase C1) and these tests now fence
// the other side: nothing about being hit takes health or controls, a tackle shoves the victim
// toward their OWN goal, and the stun that survives is a plain timer (stun()/tickStun()) that
// the arcade's knockdown powers — and later HS's ailments — set directly.
{
  // Put the victim on the tackler's boot and press. Returns the match so a test can keep going.
  const tackle = (m, attacker = 0) => {
    const a = m.players[attacker], v = m.players[1 - attacker];
    m.ball.x = C.W / 2; m.ball.y = 100;                 // ball nowhere near: this is a tackle
    v.x = a.x + Math.sign(v.x - a.x || 1) * C.KICK_REACH;
    a.facing = Math.sign(v.x - a.x) || 1;
    v.facing = -a.facing;                               // face them: a FRONT hit
    a.kickCd = 0; a.prev = {}; v.tackleImmune = 0; m.hitStop = 0;
    step(m, attacker === 0 ? [{ kick: true }, {}] : [{}, { kick: true }]);
    m.hitStop = 0;
    return m;
  };
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
  // Knock player `i` down for `secs` through the sim's own stun(), as a power would.
  const down = (m, i, secs = C.STUN_TIME) => stun(m, m.players[i], secs);

  // ---- 1. there is no health ------------------------------------------------
  {
    const m = fresh();
    ok('a player has no health field', m.players.every((p) => !('hp' in p)));
    ok('and neither starts stunned', m.players[0].stunned === 0 && m.players[1].stunned === 0);
    // One short of the KNOCKOUT (KICK_HURT_EVERY x KICK_HURTS_TO_KO kicks), which has its own
    // block at the end of this file: short of it, a kick never takes the controls away.
    const seen = beat(m, C.KICK_HURT_EVERY * C.KICK_HURTS_TO_KO - 1);
    ok('tackles short of the knockout never knock anybody down', m.players[1].stunned === 0
       && !seen.some((e) => e.type === 'stunned'), seen.filter((e) => e.type === 'stunned').length + ' stuns');
    ok('and no damage event exists any more', !seen.some((e) => e.type === 'damage'));
  }

  // ---- 2. a kick shoves, and does NOT grey / slow / stick --------------------
  {
    const m = fresh();
    const v = m.players[1];
    tackle(m);
    // The fields the old effect and the old health lived in are gone from the player entirely.
    // Asserted as ABSENT rather than zero, so re-adding one is a failure, not a silent revival.
    for (const dead of ['knocked', 'rooted', 'slow', 'effectId', 'effectT', 'hp']) {
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
    ok('…and normal jumping', (run(hit, 2, [{}, { jump: true }]), hit.players[1].vy < -100),
       `vy=${hit.players[1].vy.toFixed(0)}`);
  }

  // ---- 3. the knockback is toward the victim's OWN goal -----------------------
  {
    // Both directions: player 0 shoving player 1 (who defends the RIGHT net) and back.
    for (const attacker of [0, 1]) {
      const m = fresh();
      const v = m.players[1 - attacker];
      tackle(m, attacker);
      ok(`player ${attacker} tackling sends player ${1 - attacker} toward their own goal`,
         Math.sign(v.vx) === -v.side && Math.abs(v.vx) > C.TACKLE_PUSH * 0.9,
         `vx=${v.vx.toFixed(0)} side=${v.side}`);
    }
  }
  {
    // …and whichever side the boot came from. A victim tucked in just BEHIND the tackler's hip
    // is still inside the swing, and used to be shoved AWAY FROM THE TACKLER — toward the goal
    // they attack. Head Soccer's rule is the victim's own goal, every time.
    const m = fresh();
    const [a, v] = m.players;
    m.ball.x = C.W / 2; m.ball.y = 100;
    a.x = 500; a.facing = 1; v.x = 490; v.y = a.y; v.facing = 1;
    a.kickCd = 0; a.prev = {}; v.tackleImmune = 0; m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    const ev = m.events.find((e) => e.type === 'tackle');
    ok('(a victim behind the tackler is still tackled)', !!ev, m.events.map((e) => e.type).join(','));
    ok('and is shoved toward their own goal, not away from the tackler', ev && Math.sign(v.vx) === -v.side,
       `vx=${v.vx.toFixed(0)} side=${v.side}`);
  }

  // ---- 4. the stun: one timer, set once, taken off on time ------------------
  {
    const m = fresh();
    const v = m.players[1];
    ok('stun() knocks a player down for the time asked', down(m, 1) && Math.abs(v.stunned - C.STUN_TIME) < 1e-9,
       `stunned=${v.stunned}`);
    ok('and says so in an event', m.events.some((e) => e.type === 'stunned' && e.player === 1 && e.time === C.STUN_TIME));
    const before = v.stunned;
    ok('a stunned player cannot be re-stunned', down(m, 1, 5) === false);
    ok('and a second stun does not extend the first', v.stunned === before, `${before} -> ${v.stunned}`);
  }
  {
    // A stun takes the controls, and gives them back. Both halves, on one match.
    const m = fresh(), ctrl = fresh();
    const v = m.players[1];
    down(m, 1); down(ctrl, 1);
    m.events.length = 0;
    // Against a control: "input changes nothing" is the property that actually matters.
    run(m, 20, [{}, { right: true }]);
    run(ctrl, 20, NONE);
    ok('a stunned player ignores the controls',
       Math.abs(v.x - ctrl.players[1].x) < 0.001 && Math.abs(v.vx - ctrl.players[1].vx) < 0.001,
       `${v.x.toFixed(2)} vs ${ctrl.players[1].x.toFixed(2)}`);
    const left = v.stunned;
    let t = 0;
    for (; t < 400 && v.stunned > 0; t++) { m.hitStop = 0; step(m, NONE); }
    ok('the stun always ends', v.stunned === 0, `still stunned after ${t} ticks`);
    ok('…and runs exactly the clock it was given', Math.abs(t * C.TICK - left) <= C.TICK + 1e-9,
       `${(t * C.TICK).toFixed(3)}s of ${left.toFixed(3)}s`);
    ok('a revive event reports the handover', m.events.some((e) => e.type === 'revive' && e.player === 1));
    ok('and getting up buys a tackle-immunity window', v.tackleImmune > 0, `immune ${v.tackleImmune.toFixed(2)}`);
    const x1 = v.x;
    run(m, 30, [{}, { right: true }]);
    ok('and the controls come back with them', Math.abs(v.x - x1) > 20, `moved ${Math.abs(v.x - x1).toFixed(1)}px`);
  }
  {
    // THE STUN IS A WALL CLOCK. step() returns before any player is stepped for the length of a
    // hit-stop, so a stun that spanned a few of them used to run long. The countdown runs
    // through the pause now.
    const lengthOf = (withHitStops) => {
      const m = fresh();
      const v = m.players[1];
      down(m, 1);
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
    ok('…and both are STUN_TIME long', Math.abs(quiet - C.STUN_TIME) <= C.TICK * 2 && Math.abs(busy - C.STUN_TIME) <= C.TICK * 2,
       `${quiet.toFixed(2)} / ${busy.toFixed(2)} of ${C.STUN_TIME}`);
  }
  {
    // A downed player is not a target: booting one would stretch their time on the floor with
    // every hit-stop it made.
    const m = fresh();
    down(m, 1);
    m.events.length = 0;
    beat(m, 5);
    ok('a stunned player cannot be tackled', !m.events.some((e) => e.type === 'tackle'),
       JSON.stringify(m.events.map((e) => e.type)));
  }

  // ---- 5. both players, the same rules -------------------------------------
  {
    const outcome = (attacker) => {
      const m = fresh();
      const v = m.players[1 - attacker];
      tackle(m, attacker);
      return { vx: +v.vx.toFixed(6), vy: +v.vy.toFixed(6), immune: +v.tackleImmune.toFixed(6) };
    };
    const byP0 = outcome(0), byP1 = outcome(1);
    // The shove itself is exactly mirrored. Lift and immunity only to within a tick: players
    // are stepped in index order, so a victim who is player 1 is integrated (and has a tick of
    // immunity counted off) in the very tick the boot landed, and one who is player 0 is not.
    // A STANDING victim slides (TACKLE_GROUND_PUSH bled off by PLAYER_FRICTION per tick), so
    // the same stepping order that costs a tick of immunity also costs one tick of friction: a
    // victim who is player 1 has already slid a tick when this reads it. Mirrored in direction,
    // equal to within exactly that one tick.
    const same = Math.abs(byP0.vx) === Math.abs(byP1.vx)
      || Math.abs(Math.max(Math.abs(byP0.vx), Math.abs(byP1.vx)) * C.PLAYER_FRICTION - Math.min(Math.abs(byP0.vx), Math.abs(byP1.vx))) < 1e-6;
    ok('player 1 is shoved by player 0 exactly as player 0 is by player 1, mirrored',
       Math.sign(byP0.vx) === -Math.sign(byP1.vx) && byP0.vx !== 0 && same, `${JSON.stringify(byP0)} vs ${JSON.stringify(byP1)}`);
    ok('…with the same immunity to within a tick', Math.abs(byP0.immune - byP1.immune) <= C.TICK + 1e-6,
       `${byP0.immune} vs ${byP1.immune}`);
  }

  // ---- 6. a goal restart clears the stun -------------------------------------
  {
    const m = fresh();
    const v = m.players[1];
    down(m, 1, 30);                                      // longer than the goal takes
    scoreOn(m, true);                                    // drive a ball into the left net
    ok('(the goal went in)', m.score[1] === 1, `score ${m.score}`);
    run(m, Math.ceil(C.AFTER_GOAL / C.TICK) + 1);          // the free play under GOAL!, then the spots
    ok('a goal restart clears the stun', v.stunned === 0);
    m.freeze = 0; m.phase = 'play';                      // past the hold on the spots
    run(m, 20, [{}, { right: true }]);
    ok('…so the downed character can move again immediately', Math.abs(v.vx) > 20, `vx=${v.vx.toFixed(0)}`);
  }
  {
    // A NEW MATCH IS A NEW MATCH: nothing module-level outlives one.
    const m = fresh();
    down(m, 1, 30);
    const next = fresh();
    ok('a new match carries no stun into it', next.players[0].stunned === 0 && next.players[1].stunned === 0);
  }

  // ---- 7. nothing else moved -----------------------------------------------
  {
    // A tackle must not pay a meter, move a score or touch the ball.
    const m = fresh();
    const a = m.players[0], v = m.players[1];
    tackle(m);
    ok('a tackle does not move the score', m.score[0] === 0 && m.score[1] === 0);
    ok('a tackle pays neither meter anything past the clock',
       Math.abs(a.gauge - C.TICK * C.GAUGE_PASSIVE) < 1e-9 && Math.abs(v.gauge - C.TICK * C.GAUGE_PASSIVE) < 1e-9,
       `${a.gauge.toFixed(4)} / ${v.gauge.toFixed(4)}`);
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

// --- the gauge is a clock: kicks, headers, tackles and goals pay NOTHING ---------------
// Idan, on his phone: "the kicks give power to the power bar". Head Soccer's gauge fills with
// time alone (GAUGE_PASSIVE; 15.0s first fill, 13.0s refill), so here both players spend a
// long stretch doing nothing BUT kicking — at the ball, at each other, jumping into headers —
// with the gauge parked well below full, and every single tick is held to the clock: no tick
// may add more than dt × GAUGE_PASSIVE (× the champion's meterRate in the arcade), and none
// may take any away. Plain match and arcade with champions, both seats.
{
  const plain = [{ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }];
  const runs = [
    { name: 'plain', cards: plain, opts: {} },
    ...[0, 9, 21, 30, 44].map((k) => ({
      name: `arcade ${CHAMPIONS[k].power} v ${CHAMPIONS[(k + 7) % 45].power}`,
      cards: [CHAMPIONS[k].card, CHAMPIONS[(k + 7) % 45].card],
      opts: { champions: true, meterRate: [1, 1.9] },
    })),
  ];
  for (const r of runs) {
    const m = createMatch(r.cards[0], r.cards[1], r.opts);
    const n = { kick: 0, tackle: 0, head: 0, goal: 0 };
    let bad = 0, first = '';
    for (let k = 0; k < Math.round(40 / C.TICK) && m.phase !== 'over'; k++) {
      // Parked at 0.3, well short of full: this is about what fills it, not about arming.
      if (m.players.some((p) => p.gauge > 0.9)) m.players.forEach((p) => { p.gauge = 0.3; });
      const before = m.players.map((p) => p.gauge);
      step(m, m.players.map((p, i) => {
        const tgt = (k % 300 < 150) ? m.ball.x : m.players[1 - i].x;
        return { left: tgt < p.x - 10, right: tgt > p.x + 10, jump: (k % 37) === i * 5, kick: (k % 6) < 3, power: false };
      }), C.TICK);
      for (const e of m.events) {
        if (e.type === 'kick') n.kick++;
        if (e.type === 'tackle') n.tackle++;
        if (e.type === 'goal') n.goal++;
        if (e.type === 'strike' && e.head) n.head++;
      }
      const evs = m.events.map((e) => e.type).join(',');
      const drop = m.events.some((e) => e.type === 'ballDrop');
      m.events.length = 0;
      m.players.forEach((p, i) => {
        const rate = m.champ ? p.meterRate || 1 : 1;
        // The ONE non-clock gain: the conceder's bonus, on the ball-drop tick after a goal.
        const bonus = drop && i !== m.lastScorer ? C.GAUGE_CONCEDE : 0;
        const d = p.gauge - before[i];
        if (d > C.TICK * C.GAUGE_PASSIVE * rate + bonus + 1e-9 || d < -1e-9) {
          if (!bad++) first = `P${i + 1} tick ${k}: ${before[i].toFixed(4)} -> ${p.gauge.toFixed(4)} [${evs}]`;
        }
      });
    }
    ok(`${r.name}: the scenario really kicked, tackled and headed`, n.kick > 100 && n.tackle > 10 && n.head > 0,
       JSON.stringify(n));
    ok(`${r.name}: no kick, header or tackle moved either gauge off the clock (only the conceder's bonus)`, bad === 0,
       `${bad} ticks; first ${first}`);
  }
}

// (The arcade's drain — the last power that touched a meter — went with shared/powers.js: every
// champion is only its Head Soccer shot now, and no shot pays or takes a gauge.)

// --- players are solid to each other (HS M4: standing on heads, pinned on a shoulder) -------
{
  const crownFeet = (lo) => headY(lo) - C.HEAD_R;          // boots on the lower one's crown
  const overlap = (m) => { const c = playerContact(m, m.players[0], m.players[1]); return c ? c.d : 0; };
  const inBounds = (m, p) => {
    const crown = headY(p) - headR(m, p);
    const { lo, hi } = walkBounds(C.BODY_W, crown >= barY() + C.POST_R - 1e-6);
    return p.x >= lo - 1e-6 && p.x <= hi + 1e-6 && p.y <= C.GROUND_Y + 1e-9;
  };
  const stack = (x = 500) => {
    const m = fresh();
    const [a, b] = m.players;
    m.ball.x = 950; m.ball.y = C.GROUND_Y - C.BALL_R;
    b.x = x; a.x = x; a.y = C.GROUND_Y - 150; a.vy = 0; a.onGround = false;
    return m;
  };

  {
    // Two bodies walking into each other stop head to head — they no longer stand inside each
    // other 26px apart.
    const m = fresh();
    const [a, b] = m.players;
    a.x = 480; b.x = 580; m.ball.x = 950;
    let worst = 0;
    run(m, 60, (i, mm) => { worst = Math.max(worst, overlap(mm)); return [{ right: true }, { left: true }]; });
    ok('walking into each other: heads meet and stop', Math.abs(b.x - a.x) >= 2 * C.HEAD_R - 0.5 && worst < 1,
       `gap ${(b.x - a.x).toFixed(1)}, deepest ${worst.toFixed(2)}px`);
  }
  {
    const m = stack();
    const [a, b] = m.players;
    run(m, 60);
    const y0 = a.y;
    let drift = 0;
    run(m, 120, (i, mm) => { drift = Math.max(drift, Math.abs(mm.players[0].y - y0)); return NONE; });
    ok('a player dropped on a head stands on the crown (HS: heads 70px apart)',
       Math.abs(a.y - crownFeet(b)) < 0.5 && a.stand === 1 && a.onGround,
       `feet ${a.y.toFixed(1)} vs crown ${crownFeet(b).toFixed(1)}, stand ${a.stand}, onGround ${a.onGround}`);
    ok('…and does not sink into it', drift < 0.5, `${drift.toFixed(2)}px over 2 s`);
    ok('…and the head under it stays on the grass', b.y === C.GROUND_Y && b.onGround);
    // Jump off it: a head is ground to jump from.
    let top = a.y;
    run(m, 50, (i, mm) => { top = Math.min(top, mm.players[0].y); return [i === 1 ? { jump: true } : {}, {}]; });
    ok('…and can jump off it', crownFeet(b) - top > 40, `rose ${(crownFeet(b) - top).toFixed(1)}px off the crown`);
  }
  {
    // The head walks away: nothing carries the upper body sideways (HS M4 53.00–53.40 s), and
    // once the crown is out from under it, it falls to the grass.
    const m = stack();
    const [a, b] = m.players;
    run(m, 60);
    const x0 = a.x;
    let maxDx = 0, deepest = 0;
    run(m, 90, (i, mm) => { if (mm.players[0].stand === 1) maxDx = Math.max(maxDx, Math.abs(mm.players[0].x - x0)); deepest = Math.max(deepest, overlap(mm)); return [{}, { right: true }]; });
    ok('no carry: the upper body stays put while the head walks away under it', maxDx < 1, `moved ${maxDx.toFixed(2)}px`);
    ok('…and falls to the grass once it is off', a.y === C.GROUND_Y && a.stand === -1, `y ${a.y.toFixed(1)}, stand ${a.stand}`);
    ok('…never ending a tick inside the other body', deepest < 1, `${deepest.toFixed(2)}px`);
  }
  {
    // Dash into a player at the top of its jump: HS M4 66.36 s — no launch; it hangs on the
    // dasher's shoulder while he keeps pushing, and drops when he stops.
    const apexOf = (dash) => {
      const m = fresh();
      const [a, b] = m.players;
      a.x = 380; b.x = 560; m.ball.x = 950;
      let top = C.GROUND_Y, held = 0;
      run(m, 110, (i, mm) => {
        top = Math.min(top, mm.players[1].y);
        if (mm.players[1].stand === 0) held++;
        return [dash && ((i >= 13 && i < 15) || (i >= 17 && i < 62)) ? { right: true } : {}, i === 0 ? { jump: true } : {}];
      });
      return { rise: C.GROUND_Y - top, held, m };
    };
    const calm = apexOf(false), hit = apexOf(true);
    ok('dash into an airborne player: no launch', hit.rise <= calm.rise + 1,
       `${hit.rise.toFixed(1)}px vs ${calm.rise.toFixed(1)}px undisturbed`);
    ok('…it hangs on the dasher while he pushes', hit.held > 20, `${hit.held} ticks held`);
    ok('…and ends on the grass', hit.m.players[1].y === C.GROUND_Y);
  }
  {
    // Pressed against somebody, a jump is still a whole jump: the grip only ever holds a body
    // up, it never slows one going up.
    const m = fresh();
    const [a, b] = m.players;
    a.x = 480; b.x = 540; m.ball.x = 950;
    run(m, 20, [{ right: true }, { left: true }]);
    const y0 = a.y;
    let top = y0;
    run(m, 30, (i, mm) => { top = Math.min(top, mm.players[0].y); return [{ right: true, jump: i === 0 }, { left: true }]; });
    ok('jumping while pushing into somebody is not damped', y0 - top > 40, `rose ${(y0 - top).toFixed(1)}px`);
  }
  {
    // STACKED UNDER THE CROSSBAR. A player standing in his own mouth, the other dropped on
    // him from above: two heads (139.6px) do not fit under a 128px bar, so the upper one must
    // end up out of the mouth, on the pitch — not wedged inside the lower one, not pushed into
    // the net, not up through the bar.
    for (const [side, x] of [['left', C.GOAL_W - 10], ['right', C.W - C.GOAL_W + 10]]) {
      const m = fresh();
      const [a, b] = m.players;
      m.ball.x = C.W / 2;
      b.x = x; a.x = x + (side === 'left' ? 30 : -30); a.y = C.GROUND_Y - 150; a.onGround = false;
      let deepest = 0, outside = 0, throughBar = 0;
      run(m, 180, (i, mm) => {
        for (const p of mm.players) {
          if (!inBounds(mm, p)) outside++;
          const inMouth = side === 'left' ? p.x < C.GOAL_W : p.x > C.W - C.GOAL_W;
          if (inMouth && headY(p) - C.HEAD_R < barY() + C.POST_R - 0.5) throughBar++;
        }
        if (i > 30) deepest = Math.max(deepest, overlap(mm));
        return [{}, i % 40 === 20 ? { jump: true } : {}];      // …and the lower one jumping under him
      });
      ok(`stacked in the ${side} mouth: no wedge`, deepest < 1, `${deepest.toFixed(2)}px deep`);
      ok(`…nobody pushed into the net or out of bounds (${side})`, outside === 0, `${outside} ticks`);
      ok(`…no crown up through the crossbar (${side})`, throughBar === 0, `${throughBar} ticks`);
    }
    // And a player carried INTO the mouth: the lower one walks into his goal with the other on
    // his head. The upper one cannot come with him (no room under the bar) and gets left on
    // the pitch.
    const m = stack(C.GOAL_W + 60);
    run(m, 60);
    let deepest = 0, outside = 0;
    run(m, 120, (i, mm) => { deepest = Math.max(deepest, overlap(mm)); for (const p of mm.players) if (!inBounds(mm, p)) outside++; return [{}, { left: true }]; });
    const [a, b] = m.players;
    ok('walking into the goal with a player on your head leaves him on the pitch',
       a.x >= C.GOAL_W && a.y === C.GROUND_Y && b.x < C.GOAL_W, `upper x ${a.x.toFixed(1)} y ${a.y.toFixed(1)}, lower x ${b.x.toFixed(1)}`);
    ok('…without a wedge or a body out of bounds', deepest < 1 && outside === 0, `${deepest.toFixed(2)}px, ${outside} ticks out`);
  }
  {
    // Online: a client restored mid-stand plays on exactly as the server does.
    const m = stack();
    run(m, 60);
    const snap = JSON.parse(JSON.stringify(serialize(m)));
    const twin = restore(stack(), snap);
    const script = (i) => [i === 10 ? { jump: true } : {}, i > 20 ? { right: true } : {}];
    run(m, 90, script); run(twin, 90, script);
    ok('a restored stack plays on identically',
       JSON.stringify(serialize(m).p) === JSON.stringify(serialize(twin).p) && snap.p[0].length > 0);
  }
}

// ── THE KNOCKOUT: stars after enough kicks (HS M4 106–121 s, M3 82.6 s) ─────────────────────
// Every connected kick counts; every KICK_HURT_EVERY-th hurts (a tier of bruise); the
// KICK_HURTS_TO_KO-th hurt knocks the victim out for KICK_KO_TIME and zeroes the count. No clock
// on it, no goal reset, no randomness. See kickDamage in shared/sim.js.
{
  const KO = C.KICK_HURT_EVERY * C.KICK_HURTS_TO_KO;
  // One connected boot from a standstill, victim squarely on the swing. Returns its events.
  const land = (m, attacker = 0) => {
    const a = m.players[attacker], v = m.players[1 - attacker];
    m.ball.x = C.W / 2; m.ball.y = 100; m.ball.vx = 0; m.ball.vy = 0;
    const s = attacker === 0 ? 1 : -1;
    v.x = a.x + s * C.KICK_REACH; v.y = C.GROUND_Y; v.vx = 0; v.vy = 0; v.onGround = true;
    a.facing = s; v.facing = -s;
    a.kickCd = 0; a.prev = {}; v.tackleImmune = 0; v.shoved = 0; m.hitStop = 0;
    m.events.length = 0;
    step(m, attacker === 0 ? [{ kick: true }, {}] : [{}, { kick: true }]);
    return m.events.slice();
  };
  {
    const m = fresh();
    const v = m.players[1];
    const first = land(m);
    ok('a single kick never stuns', v.stunned === 0 && v.kicked === 1 && !first.some((e) => e.type === 'hurt'),
       `stunned=${v.stunned} kicked=${v.kicked}`);
    const hurtsAt = [], koAt = [];
    for (let k = 2; k <= KO; k++) {
      const ev = land(m);
      if (ev.some((e) => e.type === 'hurt' && e.player === 1)) hurtsAt.push(k);
      if (ev.some((e) => e.type === 'knockout' && e.player === 1)) koAt.push(k);
      if (k < KO && v.stunned > 0) break;
    }
    const want = Array.from({ length: C.KICK_HURTS_TO_KO }, (_, j) => (j + 1) * C.KICK_HURT_EVERY);
    ok(`every ${C.KICK_HURT_EVERY}th kick hurts`, JSON.stringify(hurtsAt) === JSON.stringify(want), `hurts on ${hurtsAt}`);
    ok(`the ${KO}th kick knocks out, and no earlier one`, JSON.stringify(koAt) === JSON.stringify([KO]) && Math.abs(v.stunned - C.KICK_KO_TIME) < C.TICK + 1e-9,
       `knockout on ${koAt}, stunned=${v.stunned.toFixed(3)}`);
    ok('the knockout zeroes the count', v.kicked === 0, `kicked=${v.kicked}`);
    ok('…and the bruise is a tier per hurt, kept through it', v.hurt === Math.min(3, C.KICK_HURTS_TO_KO), `hurt=${v.hurt}`);
    const kicker = m.players[0];
    ok('the kicker is untouched by any of it', kicker.kicked === 0 && kicker.hurt === 0 && kicker.stunned === 0);

    // Down: a kick sends him sliding fast toward his own goal (Idan), and nothing counts.
    const onDowned = land(m);
    ok('a knocked-out player kicked slides fast toward his own goal', onDowned.some((e) => e.type === 'tackle' && e.ko)
       && Math.sign(v.vx) === -v.side && Math.abs(v.vx) > 800 && v.koSlide > 0, `vx=${v.vx.toFixed(0)} ${onDowned.map((e) => e.type).join(',')}`);
    ok('…without counting toward another knockout', v.kicked === 0 && !onDowned.some((e) => e.type === 'hurt' || e.type === 'knockout'));
    v.vx = 0; v.koSlide = 0;
    // …and cannot act: every button held for the rest of it.
    const x0 = v.x;
    let acted = false, t = 0;
    while (v.stunned > 0 && t < 600) {
      step(m, [{}, { left: true, jump: true, kick: true, power: true }]);
      if (m.events.some((e) => e.player === 1 && ['jump', 'kick', 'dash', 'armed'].includes(e.type))) acted = true;
      t++;
    }
    ok('a knocked-out player cannot move, jump or kick', !acted && Math.abs(v.x - x0) < 12, `moved ${(v.x - x0).toFixed(1)} px, acted=${acted}`);
    // `land` spent one tick; the loop the rest.
    const secs = (t + 1) * C.TICK;
    ok(`the stars last KICK_KO_TIME (${C.KICK_KO_TIME} s, HS M3 1.97 s)`, Math.abs(secs - C.KICK_KO_TIME) <= 2 * C.TICK, `${secs.toFixed(3)} s`);
    ok('and he gets up with his controls back', v.stunned === 0 && (run(m, 2, [{}, { left: true }]), v.vx < 0), `vx=${v.vx}`);

    // The count starts again from zero: KO - 1 more kicks do nothing, the next one knocks out.
    let early = false;
    for (let k = 1; k < KO; k++) { land(m); if (v.stunned > 0) early = true; }
    const again = land(m);
    ok('after a knockout it takes the full count again', !early && again.some((e) => e.type === 'knockout'), `early=${early}`);
  }
  {
    // NO CLOCK ON THE COUNT (HS M4: 9 s and only three kicks between the 1st and 2nd hurt).
    const m = fresh();
    const v = m.players[1];
    for (let k = 1; k < C.KICK_HURT_EVERY; k++) land(m);
    run(m, 60 * 20);
    const ev = land(m);
    ok('the count does not decay with time', ev.some((e) => e.type === 'hurt' && e.player === 1), `kicked=${v.kicked}`);
  }
  {
    // NOR BY A GOAL (HS M4: 2nd hurt at 116.7 s, goal at 117.5 s, stars at 119.3 s) — but the
    // restart does clear a knockout in progress (M4 121.2 s: the CPU is up at the kickoff).
    const m = fresh();
    const v = m.players[1];
    for (let k = 1; k < KO; k++) land(m);
    const before = [v.kicked, v.hurt];
    scoreOn(m, true);
    let t = 0;
    while (m.phase !== 'play' && t < 60 * 15) { step(m, NONE); t++; }
    ok('a goal does not reset the kick count or the bruise', m.score[1] === 1 && v.kicked === before[0] && v.hurt === before[1],
       `score ${m.score} kicked ${before[0]}→${v.kicked} hurt ${before[1]}→${v.hurt}`);
    const ev = land(m);
    ok('…so the next kick after the restart is the knockout', ev.some((e) => e.type === 'knockout'));
  }
  {
    // THE KNOCKBACK: standing, you stay on your feet and slide ~40 px (HS M4 6201–6243, 6990);
    // in the air you are carried off (6299, 6345).
    const m = fresh();
    const v = m.players[1];
    land(m);
    let lifted = false;
    const start = v.x;
    for (let i = 0; i < 40; i++) { step(m, NONE); if (!v.onGround) lifted = true; }
    const slid = (v.x - start) * -v.side;
    ok('a standing victim is not lifted', !lifted && v.y === C.GROUND_Y);
    ok('…and slides 25–60 px toward his own goal', slid > 25 && slid < 60, `${slid.toFixed(1)} px`);
    const n = fresh();
    const w = n.players[1];
    const a = n.players[0];
    n.ball.x = C.W / 2; n.ball.y = 100;
    w.x = a.x + C.KICK_REACH; w.y = C.GROUND_Y - 20; w.vy = 0; w.onGround = false;
    a.kickCd = 0; a.prev = {}; a.facing = 1; w.facing = -1;
    const s0 = w.x;
    step(n, [{ kick: true }, {}]);
    const lift = w.vy < 0;
    run(n, 60);
    ok('an airborne victim is lifted and carried off (> 90 px)', lift && (w.x - s0) * -w.side > 90, `vy<0=${lift}, ${((w.x - s0) * -w.side).toFixed(0)} px`);
  }
  {
    // ONLINE: a client restored mid-count puts the stars on the same boot as the server.
    const m = fresh();
    for (let k = 1; k < KO - 1; k++) land(m);
    const twin = restore(fresh(), JSON.parse(JSON.stringify(serialize(m))));
    ok('the kick count and the bruise travel in the snapshot', twin.players[1].kicked === m.players[1].kicked && twin.players[1].hurt === m.players[1].hurt,
       `${twin.players[1].kicked}/${twin.players[1].hurt}`);
    const koOf = (mm) => { let k = 0; while (mm.players[1].stunned === 0 && k < KO) { land(mm); k++; } return k; };
    ok('…and a restored client knocks out on the same kick', koOf(m) === koOf(twin) && m.players[1].stunned > 0);
  }
}

// --- the conceder's bonus: +1/3 gauge to whoever let the goal in, on the ball drop (HS M4 43.5 s)
{
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 });
  m.phase = 'play'; m.freeze = 0; m.hitStop = 0;
  m.lastScorer = 0; m.ballWait = C.TICK / 2;              // P1 just scored; the ball drops this tick
  m.players[0].gauge = 0.2; m.players[1].gauge = 0.2;
  step(m, [{}, {}], C.TICK);
  const g0 = m.players[0].gauge, g1 = m.players[1].gauge;
  ok('the conceder gets a third of a bar on the ball drop', Math.abs(g1 - (0.2 + C.GAUGE_CONCEDE)) < 0.02, `${g1.toFixed(4)}`);
  ok('the scorer gets no bonus', g0 < 0.2 + 0.02, `${g0.toFixed(4)}`);
  m.players[1].gauge = 0.9; m.ballWait = C.TICK / 2; step(m, [{}, {}], C.TICK);
  ok('the bonus never overfills the bar', m.players[1].gauge <= 1, `${m.players[1].gauge}`);
}

console.log(`test-sim: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
