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
  ok('kick launches the ball forward', m.ball.vx > 400, `vx=${m.ball.vx.toFixed(0)}`);
  ok('kick lifts the ball', m.ball.vy < 0);
}
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4;
  m.ball.vx = 0; m.ball.vy = 300;
  step(m, NONE);
  ok('head bounces the ball back up', m.ball.vy < 0, `vy=${m.ball.vy.toFixed(0)}`);
}
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4;
  m.ball.vy = 300;
  const before = Math.abs(m.ball.vy);
  step(m, NONE);
  ok('a head is springier than a plain bounce', Math.abs(m.ball.vy) > before * C.BALL_BOUNCE);
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
  p.gauge = 1;
  step(m, [{ power: true }, {}]);
  ok('pressing power arms (does not fire)', p.armed > 0 && !m.ball.power);
  ok('arming spends the gauge', p.gauge === 0);
}
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
  p.gauge = 1;
  step(m, [{ power: true }, {}]);
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  ok('the armed touch fires the power shot', !!m.ball.power, 'no power on ball');
  ok('the power shot flies goalward', m.ball.power && m.ball.vx * p.side > 0);
  ok('firing consumes the armed state', p.armed === 0);
}
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1; step(m, [{ power: true }, {}]);
  run(m, Math.ceil(C.POWER_MODE_TIME / C.TICK) + 4, [{}, {}]);
  ok('power mode times out if unused', p.armed === 0);
}
{
  // a straight power shot ignores gravity
  const m = fresh();
  const p = m.players[0];
  p.shot = SHOTS.blaze;
  p.gauge = 1; step(m, [{ power: true }, {}]);
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = 260; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  const y0 = m.ball.y;
  run(m, 12);
  ok('straight power shot holds its line', Math.abs(m.ball.y - y0) < 30, `dy=${(m.ball.y - y0).toFixed(1)}`);
}
{
  // defender eats a power shot → knocked down, cannot act
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.blaze;
  a.gauge = 1; step(m, [{ power: true }, {}]);
  b.x = a.x + 300;
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  run(m, 30);
  ok('the defender is knocked down', b.knocked > 0, `knocked=${b.knocked}`);
  const x0 = b.x;
  run(m, 5, [{}, { right: true }]);
  ok('a knocked defender ignores input', Math.abs(b.vx) < 340);
}
{
  // tentacles root the defender in place
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.tentacles;
  a.gauge = 1; step(m, [{ power: true }, {}]);
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = a.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
  run(m, 40);
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
  a.gauge = 1; step(m, [{ power: true }, {}]);
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = a.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
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
  a.gauge = 1; step(m, [{ power: true }, {}]);
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = a.y - C.BODY_H * 0.45;
  step(m, [{ kick: true }, {}]);
  m.hitStop = 0;
  m.ball.x = C.W / 2; m.ball.y = 200;
  step(m, [{}, { kick: true }]);
  ok('an out-of-range kick does not counter', m.ball.power.owner === 0);
}

// --- power MODE: the button arms, the KICK fires --------------------------
{
  // Head contact must NOT spend power mode. Firing on any touch is what made the POWER
  // button feel like it did nothing: the shot went off on a stray header seconds later.
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1; step(m, [{ power: true }, {}]);
  m.hitStop = 0;
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4; m.ball.vy = 300;
  step(m, NONE);
  ok('a header does not fire the power shot', !m.ball.power);
  ok('power mode survives a header', p.armed > 0);
}
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1; step(m, [{ power: true }, {}]);
  m.hitStop = 0;
  m.ball.x = p.x + C.BODY_W / 2; m.ball.y = p.y - C.BODY_H / 2; m.ball.vx = -100;
  step(m, NONE);
  ok('a body bump does not fire the power shot', !m.ball.power);
  ok('power mode survives a body bump', p.armed > 0);
}
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1; step(m, [{ power: true }, {}]);
  m.hitStop = 0;
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
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
  a.gauge = 1; step(m, [{ power: true }, {}]);
  m.hitStop = 0;
  b.x = a.x + 260;
  m.ball.x = a.x + C.KICK_REACH; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ kick: true }, {}]);
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
{
  // Adam's example: kicking the opponent while powered freezes them.
  const m = fresh();
  const a = m.players[0], b = m.players[1];
  a.shot = SHOTS.strike;                      // root, 0.5s — the "freeze"
  a.gauge = 1; step(m, [{ power: true }, {}]);
  m.hitStop = 0;
  m.ball.x = C.W / 2; m.ball.y = 100;          // ball elsewhere
  b.x = a.x + C.KICK_REACH;
  a.kickCd = 0;
  step(m, [{ kick: false }, {}]);
  step(m, [{ kick: true }, {}]);
  const ev = m.events.find((e) => e.type === 'tackle');
  ok('a powered tackle is flagged as powered', ev && ev.powered === true, JSON.stringify(ev));
  ok('and freezes the victim', b.rooted > 0, `rooted=${b.rooted.toFixed(2)}`);
  ok('the victim is marked with the effect', b.effectId === 'strike', String(b.effectId));
  ok('a powered tackle spends power mode', a.armed === 0);
}

// --- head bounces, body deadens --------------------------------------------
{
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 4; m.ball.vy = 400;
  step(m, NONE);
  ok('the head still bounces the ball', m.ball.vy < -100, `vy=${m.ball.vy.toFixed(0)}`);
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
  // …but the top of the head still bounces, or heading stops being a tool.
  const m = fresh();
  const p = m.players[0];
  m.ball.x = p.x; m.ball.y = headY(p) - C.HEAD_R - C.BALL_R + 3; m.ball.vy = 400;
  step(m, NONE);
  ok('the crown of the head still bounces', m.ball.vy < -100, `vy=${m.ball.vy.toFixed(0)}`);
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
  ok('the gauge fills in GAUGE_FULL seconds', m.players[0].gauge >= 0.999, `gauge=${m.players[0].gauge.toFixed(3)}`);
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
  p.gauge = 1; p.armed = 0;
  step(m, [{ power: true }, {}]);
  ok('power arms the player', m.players[0].armed > 0);
  m.ball.x = p.x + 30; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0;
  for (let i = 0; i < 30 && !m.ball.power; i++) step(m, [{ kick: i % 3 === 0, right: true }, {}]);
  ok('the kick fires a power shot', !!m.ball.power);
  if (m.ball.power) {
    const sp = Math.hypot(m.ball.vx, m.ball.vy);
    const want = C.POWER_SHOT_SPEED * (m.ball.power.speed || 1);
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

console.log(`test-sim: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
