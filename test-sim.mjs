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
  run(m, Math.ceil(C.ARMED_TIME / C.TICK) + 4, [{}, {}]);
  ok('an unused armed state burns out', p.armed === 0);
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
  m.ball.x = C.W / 2; m.ball.y = 200;
  step(m, [{}, { kick: true }]);
  ok('an out-of-range kick does not counter', m.ball.power.owner === 0);
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
      ok(`every card has a shot (${r}_${n})`, !!s && !!s.kind);
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

console.log(`test-sim: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
