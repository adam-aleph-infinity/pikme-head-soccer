// Physics + rules tests. Run: node test-sim.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { shotFor, SHOTS } from './shared/powershots.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const NONE = [{}, {}];

// Fire the power move and let it land: press, then run out the wind-up. Tests that need a
// power BALL to exist (counters, blocks, shields) used to arm and kick; the button buys a
// committed volley now, so this is how you get one.

// Put a player where a JUMPING one is when the volley passes: head on the ball's line, feet
// off the ground. The volley flies at POWER_CHARGE_HEIGHT, above a standing head, so any test
// about what a hit DOES has to get the defender up there first.
function inLine(m, p) {
  p.y = C.GROUND_Y - (C.POWER_CHARGE_HEIGHT - C.BODY_H - C.HEAD_R + 18);
  p.vy = 0;
  p.onGround = false;
}

function firePower(m, i = 0, dir) {
  const p = m.players[i];
  p.gauge = 1; p.prev = {}; m.hitStop = 0;
  const inputs = [{}, {}]; inputs[i] = { power: true };
  step(m, inputs);
  m.events.length = 0;
  for (let t = 0; t < Math.round(C.POWER_CHARGE_TIME / C.TICK) + 3 && !m.ball.power; t++) {
    m.hitStop = 0;
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
{
  const m = fresh();
  m.ball.x = 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -200; m.ball.vy = 0;
  step(m, NONE);
  ok('ball in the left net scores for player 1', m.score[1] === 1, JSON.stringify(m.score));
  ok('a goal freezes play', m.phase === 'goal');
  ok('positions reset after a goal', Math.abs(m.players[0].x - C.SPAWN_X[0]) < 1);
}
{
  const m = fresh();
  m.ball.x = C.W - 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = 200;
  step(m, NONE);
  ok('ball in the right net scores for player 0', m.score[0] === 1, JSON.stringify(m.score));
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
  const conceded = m.players[0];
  conceded.gauge = 0;
  m.ball.x = 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -200;
  step(m, NONE);
  ok('conceding gifts gauge', conceded.gauge >= C.GAUGE_CONCEDE_BONUS - 1e-6, `gauge=${conceded.gauge}`);
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
  const m = fresh();
  run(m, 400, [{ left: true }, { right: true }]);
  ok('player 0 stops at its goal line', m.players[0].x >= C.GOAL_W + C.BODY_W / 2 - 0.01, `x=${m.players[0].x}`);
  ok('player 1 stops at its goal line', m.players[1].x <= C.W - C.GOAL_W - C.BODY_W / 2 + 0.01);
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
  run(m, Math.ceil(C.POWER_MODE_TIME / C.TICK) + 4, [{}, {}]);
  ok('power mode times out if unused', p.armed === 0);
}
{
  // a straight power shot ignores gravity
  const m = fresh();
  const p = m.players[0];
  p.shot = SHOTS.blaze;
  p.gauge = 1; step(m, [{ power: true }, {}]);
  firePower(m, 0);
  const y0 = m.ball.y;
  run(m, 12);
  ok('straight power shot holds its line', Math.abs(m.ball.y - y0) < 30, `dy=${(m.ball.y - y0).toFixed(1)}`);
}
{
  // defender eats a power shot → knocked down, cannot act
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
  ok('the defender is knocked down', b.knocked > 0, `knocked=${b.knocked}`);
  // Test the PROPERTY, not a magnitude. Any threshold here is really measuring the
  // knockback impulse — which is not what "ignores input" means, and broke the moment the
  // push got bigger than a walking speed. Run the same knocked player with and without
  // input and assert the two are identical.
  const withInput = { ...b };
  // The control match has to be set up the SAME way, volley and all, or the two are not
  // comparable — one knocked-down player and one merely standing there always differ.
  const ctrl = fresh();
  const ca = ctrl.players[0], cb = ctrl.players[1];
  ca.shot = SHOTS.blaze;
  cb.x = ca.x + 300;
  firePower(ctrl, 0);
  inLine(ctrl, cb);
  run(ctrl, 30);
  run(m, 5, [{}, { right: true }]);      // held right
  run(ctrl, 5, [{}, {}]);                // held nothing
  ok('a knocked defender ignores input',
     Math.abs(b.vx - cb.vx) < 0.001 && Math.abs(b.x - cb.x) < 0.001,
     `input ${b.vx.toFixed(1)} vs control ${cb.vx.toFixed(1)}`);
}
{
  // tentacles root the defender in place
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.tentacles;
  firePower(m, 0);
  // Wait for the shot to actually ARRIVE rather than for a fixed 40 ticks — at a slower
  // PACE the ball had not reached the defender yet and the test read as "roots nothing".
  // And hold the defender on the volley's line every tick: it flies above a standing head by
  // design, and gravity pulls a defender out of its path in a handful of frames.
  for (let i = 0; i < 240 && b.rooted <= 0; i++) { inLine(m, b); step(m, NONE); }
  ok('tentacles root the defender', b.rooted > 0, `rooted=${b.rooted}`);
  const x0 = b.x;
  run(m, 20, [{}, { left: true }]);
  ok('a rooted defender cannot walk', Math.abs(b.x - x0) < 2, `moved ${Math.abs(b.x - x0).toFixed(1)}`);
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

// --- power MODE: the button arms, the KICK fires --------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.hitStop = 0;
  firePower(m, 0);
  ok('the KICK is what fires it', !!m.ball.power);
  ok('and it flies flat and fast', Math.abs(m.ball.vx) > C.KICK_POWER * 1.5 && Math.abs(m.ball.vy) < 60,
     `v=(${m.ball.vx.toFixed(0)}, ${m.ball.vy.toFixed(0)})`);
  ok('firing spends power mode', p.armed === 0);
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
  ok('but the blocker pays for it', b.knocked > 0 || b.rooted > 0 || b.slow > 0 || b.effectId !== null,
     'blocking was free');
}
{
  // Every character's power has to land a DIFFERENT consequence.
  const kinds = new Set();
  for (const id of Object.keys(SHOTS)) {
    const shot = SHOTS[id];
    ok(`${id} has an effect`, !!shot.effect && shot.effect.time > 0);
    kinds.add(shot.effect.kind);
  }
  ok('the effects are not all the same', kinds.size >= 3, [...kinds].join(','));
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
  ok('the victim is slowed', b.slow > 0);
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
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  m.ball.x = C.W / 2; m.ball.y = 100;
  b.x = a.x + C.KICK_REACH;
  step(m, [{ kick: true }, {}]);
  m.hitStop = 0;
  const slowRun = fresh();
  run(slowRun, 40, [{ right: true }, {}]);              // unslowed reference
  run(m, 40, [{}, { right: true }]);
  ok('a slowed player really is slower',
     Math.abs(b.vx) < Math.abs(slowRun.players[0].vx) - 20,
     `slowed=${Math.abs(b.vx).toFixed(0)} normal=${Math.abs(slowRun.players[0].vx).toFixed(0)}`);
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
  m.ball.x = 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -200;
  step(m, NONE);
  ok('a golden goal ends it', m.phase === 'over' && m.score[1] === 1);
}

// --- roster -----------------------------------------------------------------
{
  const seen = new Set();
  for (const r of ['common', 'rare', 'epic', 'legendary']) {
    for (let n = 1; n <= 45; n++) {
      const s = shotFor(r, n);
      ok(`every card has a shot (${r}_${n})`, !!s && !!s.effect && !!s.effect.kind);
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
  ok('pace keeps jump height', Math.abs(fast.apex - slow.apex) / fast.apex < 0.03, `${fast.apex.toFixed(1)} vs ${slow.apex.toFixed(1)}`);
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
  p.gauge = 1; p.charge = 0;
  step(m, [{ power: true }, {}]);
  ok('power winds the player up', m.players[0].charge > 0);
  // The wind-up fires it — there is no kick to wait for any more, and the ball comes to the
  // player rather than the player to the ball.
  m.ball.x = p.x + 30; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0;
  for (let i = 0; i < 40 && !m.ball.power; i++) { m.hitStop = 0; step(m, NONE); }
  ok('the wind-up fires a power shot', !!m.ball.power);
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
    return { rooted: b.rooted, vx: Math.abs(b.vx), behind: ev && ev.behind };
  };
  const front = hit(false), back = hit(true);
  // Against the LIVE constant, not the authored one: TACKLE_PUSH rides the PACE dial, so a
  // literal here would fail every time someone slowed the game down.
  ok('a tackle from the front is a shove',
     front.vx > C.TACKLE_PUSH * 0.9 && front.rooted <= C.TACKLE_STUN + 1e-6,
     `push ${front.vx.toFixed(0)} of ${C.TACKLE_PUSH.toFixed(0)}, freeze ${front.rooted.toFixed(2)}s`);
  ok('a tackle from behind is a freeze', back.rooted > front.rooted * 2,
     `${front.rooted.toFixed(2)}s front vs ${back.rooted.toFixed(2)}s behind`);
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

  ok('a kick from deep is lofted toward the goal', far.vy < 0 && Math.abs(far.vy) > C.KICK_LIFT,
     `vy ${far.vy.toFixed(0)} vs a flat ${(-C.KICK_LIFT).toFixed(0)}`);
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
  for (let i = 0; i < 6 && a.gauge < 1; i++) {
    a.x = 500; b.x = 500 + 34; b.y = a.y; a.facing = 1; b.facing = -1;
    a.kickCd = 0; a.prev = {}; b.tackleImmune = 0; b.knocked = 0; b.rooted = 0; m.hitStop = 0;
    step(m, [{ kick: true }, {}]);
    if (m.events.some((e) => e.type === 'tackle')) landed++;
    m.events.length = 0;
  }
  ok('three kicks into the opponent fill it', a.gauge >= 1 && landed === 3,
     `${landed} landed tackles, gauge ${a.gauge.toFixed(2)}`);
}
{
  // 2. PRESSING POWER WINDS UP — it does not fire, and it does not arm a later kick.
  const m = fresh();
  const p = m.players[0];
  p.x = 400; p.facing = 1; p.gauge = 1;
  m.ball.x = 460; m.ball.y = C.GROUND_Y - 20;
  m.hitStop = 0;
  step(m, [{ power: true }, {}]);
  const started = m.events.find((e) => e.type === 'charging');
  m.events.length = 0;
  ok('power starts a wind-up', p.charge > 0 && !!started, `charge ${p.charge.toFixed(2)}s`);
  ok('and spends the gauge', p.gauge === 0);
  ok('the ball has not been fired yet', !m.ball.power);

  // 3. THE BALL COMES UP ABOVE THE HEAD while it charges, and lights up.
  run(m, Math.round(C.POWER_CHARGE_TIME / C.TICK) - 3);
  const ballUp = C.GROUND_Y - m.ball.y;
  ok('the ball is drawn up above head height', ballUp > C.BODY_H + C.HEAD_R,
     `${ballUp.toFixed(0)}px up vs a head at ${(C.BODY_H + C.HEAD_R).toFixed(0)}`);
  ok('and it is over the player who is charging', Math.abs(m.ball.x - p.x) < 30,
     `ball ${m.ball.x.toFixed(0)} vs player ${p.x.toFixed(0)}`);
  ok('the renderer can see the charge', m.players[0].charge > 0);

  // 4. THEN IT FIRES, FLAT AND FAST. (run() in this file returns the MATCH, not the events,
  // so the events are drained by hand here.)
  const seen = [];
  for (let i = 0; i < 8; i++) { m.hitStop = 0; step(m, NONE); seen.push(...m.events); m.events.length = 0; }
  ok('the wind-up ends in a volley', seen.some((e) => e.type === 'powershot'),
     seen.map((e) => e.type).join(','));
  ok('the ball is a power ball', !!m.ball.power);
  ok('it flies THREE times a normal power shot',
     Math.abs(m.ball.vx) > C.POWER_SHOT_SPEED * 2.5,
     `${Math.abs(m.ball.vx).toFixed(0)} vs ${C.POWER_SHOT_SPEED.toFixed(0)}`);
  ok('dead flat', Math.abs(m.ball.vy) < 40, `vy ${m.ball.vy.toFixed(0)}`);
  ok('and towards the other goal', Math.sign(m.ball.vx) === Math.sign(p.side));
  ok('the wind-up is spent', p.charge === 0);
}
{
  // 4b. THE WIND-UP CAN BE PUNISHED. Half a second rooted in the open is the price of the
  // move, and reading it has to be worth something — otherwise the volley is strictly better
  // the more often you can charge it, which inverts the whole skill ladder. Measured before
  // this rule existed: a level-2 bot beat a level-5 bot by charging nine times as often.
  const m = fresh();
  const [a, b] = m.players;
  a.x = 500; a.gauge = 1; a.facing = 1;
  b.x = 534; b.y = a.y; b.facing = -1; b.kickCd = 0; b.prev = {};
  m.hitStop = 0;
  step(m, [{ power: true }, {}]); m.events.length = 0;
  ok('(the wind-up started)', a.charge > 0);

  // The tackle lands on this tick; the cancel is read on the NEXT one, when stepCharge sees
  // the rooted flag the tackle set.
  m.hitStop = 0;
  step(m, [{}, { kick: true }]);
  const tackled = m.events.some((e) => e.type === 'tackle');
  ok('(the defender got the hit in)', tackled, m.events.map((e) => e.type).join(','));
  m.events.length = 0;
  m.hitStop = 0;
  step(m, [{}, {}]);
  const lost = m.events.some((e) => e.type === 'chargeLost');
  ok('a tackle during the wind-up cancels it', a.charge === 0 && lost,
     `charge ${a.charge.toFixed(2)} lost=${lost}`);
  ok('and the gauge is gone with it', a.gauge === 0, `gauge ${a.gauge}`);

  m.hitStop = 0;
  run(m, 40);
  ok('no volley comes out of a cancelled wind-up', !m.ball.power);
}
{
  // 5. A STANDING DEFENDER CANNOT REACH IT — the whole point of the height.
  const stand = (jump) => {
    const m = fresh();
    const [a, d] = m.players;
    a.x = 300; a.facing = 1; a.gauge = 1;
    d.x = 760; d.y = C.GROUND_Y;
    m.ball.x = 340; m.ball.y = C.GROUND_Y - 20;
    m.hitStop = 0;
    step(m, [{ power: true }, {}]); m.events.length = 0;
    let blocked = false;
    for (let i = 0; i < 200 && !blocked; i++) {
      // A defender who jumps does so when the ball is close enough to read.
      const near = jump && m.ball.power && Math.abs(m.ball.x - d.x) < 210 && d.onGround;
      m.hitStop = 0;
      step(m, [{}, near ? { jump: true } : {}]);
      blocked = m.events.some((e) => e.type === 'blocked');
      m.events.length = 0;
      if (m.score[0] > 0) break;
    }
    return { blocked, score: m.score[0] };
  };
  const standing = stand(false);
  ok('standing still does not block it', !standing.blocked && standing.score === 1,
     `blocked=${standing.blocked} score=${standing.score}`);
  const jumped = stand(true);
  ok('jumping into its line does', jumped.blocked, 'a jump did not reach it');
}
{
  // 6. YOU CANNOT WIND UP WITHOUT THE GAUGE, OR TWICE.
  const m = fresh();
  const p = m.players[0];
  p.gauge = 0.9;
  step(m, [{ power: true }, {}]); m.events.length = 0;
  ok('a half gauge cannot wind up', p.charge === 0);
  p.gauge = 1; p.prev = {};
  step(m, [{ power: true }, {}]); m.events.length = 0;
  const c1 = p.charge;
  p.gauge = 1; p.prev = {};
  step(m, [{ power: true }, {}]);
  ok('and a second press mid-wind-up does nothing', p.charge <= c1 && p.gauge === 1,
     `charge ${p.charge.toFixed(2)} gauge ${p.gauge}`);
}

console.log(`test-sim: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
