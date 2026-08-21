// Authoritative head-soccer physics. Pure JS, no DOM, no timers — step() is the whole game.
// The renderer only reads this state; the bot only writes inputs into it. Same split as
// football-mock's shared/sim.js, so wiring this to a server later is a lift-and-shift.

import * as C from './constants.js';
import { launchPowerShot, stepPowerShot, counterPowerShot, shotFor, statsFor, SHOTS } from './powershots.js';

// A player's geometry, derived (never stored) so nothing can drift out of sync.
// `y` is the FEET line; the body box hangs above it and the head sits on the body.
export const headY = (p) => p.y - C.BODY_H - C.HEAD_R + 8;
export const bodyTop = (p) => p.y - C.BODY_H;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Effects are fire-and-forget messages to whatever is drawing. Tests pass NO_FX.
export const NO_FX = { trail() {}, shockwave() {}, grab() {}, hit() {}, goal() {} };

function makePlayer(index, char) {
  const side = index === 0 ? 1 : -1;       // +1 attacks the RIGHT goal
  const st = statsFor(char.rarity);
  return {
    index, side, char,
    shot: shotFor(char.rarity, char.number),
    stats: st,
    x: C.SPAWN_X[index], y: C.GROUND_Y,
    vx: 0, vy: 0,
    onGround: true, facing: side,
    jumps: C.MAX_JUMPS,
    kickT: 0, kickCd: 0,
    dashT: 0, dashCd: 0, dashDir: 0,
    tapDir: 0, tapT: 0,
    gauge: 0, armed: 0,
    knocked: 0, rooted: 0, shoved: 0,
    prev: {},
    stats_: null,
  };
}

export function createMatch(charA, charB, opts = {}) {
  const m = {
    t: 0,
    clock: opts.duration ?? C.MATCH_DURATION,
    phase: 'kickoff',        // kickoff → play → goal → (kickoff | over)
    freeze: C.KICKOFF_FREEZE,
    score: [0, 0],
    golden: false,
    lastScorer: null,
    players: [makePlayer(0, charA), makePlayer(1, charB)],
    ball: { x: C.BALL_SPAWN.x, y: C.BALL_SPAWN.y, vx: 0, vy: 0, r: C.BALL_R, spin: 0, power: null },
    events: [],              // drained by the renderer each frame
  };
  return m;
}

function resetPositions(m, towards) {
  for (const p of m.players) {
    p.x = C.SPAWN_X[p.index]; p.y = C.GROUND_Y;
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = p.side;
    p.kickT = 0; p.kickCd = 0; p.dashT = 0; p.dashCd = 0;
    p.knocked = 0; p.rooted = 0; p.shoved = 0;
    p.jumps = C.MAX_JUMPS;
  }
  const b = m.ball;
  b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y;
  // Kickoff drifts towards whoever just conceded, so the restart isn't a coin flip.
  b.vx = towards ? towards * 90 : 0;
  b.vy = 0; b.spin = 0; b.power = null;
}

// ---------------------------------------------------------------------------
// step(): one fixed tick. `inputs` is [inputA, inputB], each {left,right,jump,kick,power}.
export function step(m, inputs, dt = C.TICK, fx = NO_FX) {
  m.t += dt;

  if (m.phase === 'over') return m;

  if (m.freeze > 0) {
    m.freeze -= dt;
    if (m.freeze <= 0 && (m.phase === 'kickoff' || m.phase === 'goal')) m.phase = 'play';
    // Frozen: no physics, no clock, but gauges still tick so a restart isn't dead time.
    for (const p of m.players) chargeGauge(m, p, dt);
    return m;
  }

  if (m.phase === 'play') {
    m.clock -= dt;
    if (m.clock <= 0) {
      m.clock = 0;
      if (m.score[0] === m.score[1] && C.GOLDEN_GOAL) {
        if (!m.golden) { m.golden = true; m.events.push({ type: 'golden' }); }
      } else {
        m.phase = 'over';
        m.events.push({ type: 'fulltime', winner: m.score[0] > m.score[1] ? 0 : 1 });
        return m;
      }
    }
  }

  for (let i = 0; i < 2; i++) stepPlayer(m, m.players[i], inputs[i] || {}, dt, fx);
  separatePlayers(m);
  stepBall(m, dt, fx);
  return m;
}

// ---------------------------------------------------------------------------
function chargeGauge(m, p, dt) {
  // Sudden death freezes the gauges — the wiki's rule, and it stops overtime becoming
  // a power-shot slugfest where positioning stops mattering.
  if (m.golden) return;
  if (p.gauge < 1) p.gauge = Math.min(1, p.gauge + dt / C.GAUGE_FULL);
}

function stepPlayer(m, p, input, dt, fx) {
  chargeGauge(m, p, dt);

  if (p.armed > 0) p.armed = Math.max(0, p.armed - dt);
  if (p.kickT > 0) p.kickT -= dt;
  if (p.kickCd > 0) p.kickCd -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.shoved > 0) p.shoved -= dt;
  if (p.rooted > 0) p.rooted -= dt;
  if (p.knocked > 0) {
    p.knocked -= dt;
    p.vx *= 0.86;
    integrate(p, dt);
    p.prev = { ...input };
    return;                             // knocked down = no input at all
  }

  const prev = p.prev || {};
  const canAct = p.rooted <= 0;
  const dir = canAct ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;

  // ---- dash: two taps of the same direction inside DASH_WINDOW ----
  if (p.tapT > 0) p.tapT -= dt;
  for (const [key, d] of [['left', -1], ['right', 1]]) {
    if (canAct && input[key] && !prev[key]) {
      if (p.tapDir === d && p.tapT > 0 && p.dashCd <= 0) {
        p.dashT = C.DASH_TIME; p.dashDir = d; p.dashCd = C.DASH_COOLDOWN;
        p.tapT = 0; p.tapDir = 0;
        m.events.push({ type: 'dash', player: p.index, dir: d });
      } else {
        p.tapDir = d; p.tapT = C.DASH_WINDOW;
      }
    }
  }

  if (dir !== 0) p.facing = dir;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * C.DASH_V * p.stats.speed;
  } else {
    const target = dir * C.PLAYER_SPEED * p.stats.speed;
    const accel = (p.onGround ? C.PLAYER_ACCEL : C.PLAYER_AIR_ACCEL) * dt;
    if (dir !== 0) {
      p.vx += clamp(target - p.vx, -accel, accel);
    } else if (p.onGround && p.shoved <= 0) {
      p.vx *= C.PLAYER_FRICTION;
    }
  }

  // ---- jump ----
  if (canAct && input.jump && !prev.jump && p.jumps > 0) {
    p.vy = -C.JUMP_V * p.stats.jump;
    p.onGround = false;
    p.jumps--;
    m.events.push({ type: 'jump', player: p.index });
  }
  if (!input.jump && p.vy < 0) p.vy *= 1 - (1 - C.JUMP_CUT) * dt * 12;   // variable height

  // ---- kick ----
  if (canAct && input.kick && !prev.kick && p.kickCd <= 0) {
    p.kickT = C.KICK_TIME;
    p.kickCd = C.KICK_COOLDOWN;
    m.events.push({ type: 'kick', player: p.index });
    tryCounter(m, p, fx);
  }

  // ---- arm the power shot ----
  if (canAct && input.power && !prev.power && p.gauge >= 1 && p.armed <= 0) {
    p.gauge = 0;
    p.armed = C.ARMED_TIME;
    m.events.push({ type: 'armed', player: p.index, shot: p.shot.id });
  }

  integrate(p, dt);
  p.prev = { ...input };
}

function integrate(p, dt) {
  p.vy += C.PLAYER_GRAV * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.y >= C.GROUND_Y) {
    p.y = C.GROUND_Y;
    if (p.vy > 0) p.vy = 0;
    if (!p.onGround) p.jumps = C.MAX_JUMPS;
    p.onGround = true;
  } else {
    p.onGround = false;
  }
  // Players hold the goal LINE but never stand inside the net — otherwise the
  // right answer to every match is "park in the goal and never move".
  const lo = C.GOAL_W + C.BODY_W / 2;
  const hi = C.W - C.GOAL_W - C.BODY_W / 2;
  if (p.x < lo) { p.x = lo; if (p.vx < 0) p.vx = 0; }
  if (p.x > hi) { p.x = hi; if (p.vx > 0) p.vx = 0; }
}

function separatePlayers(m) {
  const [a, b] = m.players;
  const min = C.BODY_W * 0.92;
  const d = b.x - a.x;
  const ad = Math.abs(d);
  if (ad < min && ad > 0.0001) {
    const push = (min - ad) / 2 * Math.sign(d);
    a.x -= push; b.x += push;
  }
}

// ---------------------------------------------------------------------------
function stepBall(m, dt, fx) {
  const b = m.ball;

  const powered = stepPowerShot(b, m.players, dt, fx);
  if (!powered) {
    b.vy += C.BALL_GRAV * dt;
    b.vx *= C.BALL_AIR;
  }
  b.spin *= C.BALL_SPIN_DECAY;

  const sp = Math.hypot(b.vx, b.vy);
  if (sp > C.BALL_MAX_SPEED) { b.vx *= C.BALL_MAX_SPEED / sp; b.vy *= C.BALL_MAX_SPEED / sp; }

  // Sub-step the ball so it can never skip past a body in one tick. Discrete stepping
  // let a 1250px/s shot jump the 40px-wide body box, after which the nearest-point
  // push-out resolved it on the WRONG side — straight into the net. That single bug was
  // half of every bot-vs-bot scoreline (52% of goals came with the defender on the line).
  const travel = Math.hypot(b.vx, b.vy) * dt;
  const sub = Math.max(1, Math.min(8, Math.ceil(travel / (C.BALL_R * 0.5))));
  const sdt = dt / sub;
  for (let i = 0; i < sub; i++) {
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    collideBounds(m, b, fx);
    resolveBallPlayers(m, sdt, fx);
    if (checkGoal(m, fx)) return;
  }
}

function collideBounds(m, b, fx) {
  // ground
  if (b.y > C.GROUND_Y - b.r) {
    b.y = C.GROUND_Y - b.r;
    if (b.vy > 0) {
      if (b.power) { b.vy = -Math.abs(b.vy) * 0.45; }
      else {
        b.vy = -b.vy * C.BALL_BOUNCE;
        if (Math.abs(b.vy) < 60) b.vy = 0;
        fx.hit(b.x, b.y, '#ffffff', 0.4);
      }
    }
    b.vx *= C.BALL_GROUND_FRICTION;
  }
  // ceiling
  if (b.y < C.CEIL_Y + b.r) { b.y = C.CEIL_Y + b.r; if (b.vy < 0) b.vy = -b.vy * C.BALL_WALL_BOUNCE; }

  // side walls — only ABOVE the goal mouth; inside the mouth the ball is a goal
  const inMouthY = b.y > C.GROUND_Y - C.GOAL_H;
  if (!inMouthY) {
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * C.BALL_WALL_BOUNCE; }
    if (b.x > C.W - b.r) { b.x = C.W - b.r; b.vx = -Math.abs(b.vx) * C.BALL_WALL_BOUNCE; }
  } else {
    // back of the net
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.2; }
    if (b.x > C.W - b.r) { b.x = C.W - b.r; b.vx = -Math.abs(b.vx) * 0.2; }
  }

  // crossbars
  bounceOffPost(b, C.GOAL_W, C.GROUND_Y - C.GOAL_H, fx);
  bounceOffPost(b, C.W - C.GOAL_W, C.GROUND_Y - C.GOAL_H, fx);
}

function bounceOffPost(b, px, py, fx) {
  const dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = b.r + C.POST_R;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d;
  b.x = px + nx * min; b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  b.vx = (b.vx - 2 * dot * nx) * 0.78;
  b.vy = (b.vy - 2 * dot * ny) * 0.78;
  fx.hit(px, py, '#ffe08a', 1);
}

// ---------------------------------------------------------------------------
// Counter window: a kick that lands while a live power ball is close enough
// reverses it and transfers ownership.
function tryCounter(m, p, fx) {
  const b = m.ball;
  if (!b.power || b.power.owner === p.index) return;
  const d = Math.hypot(b.x - p.x, b.y - headY(p));
  if (d > C.COUNTER_WINDOW) return;
  counterPowerShot(b, p);
  m.events.push({ type: 'counter', player: p.index });
  fx.shockwave(b.x, b.y, '#ffffff');
}

function resolveBallPlayers(m, dt, fx) {
  const b = m.ball;
  for (const p of m.players) {
    // A knocked-down player is on the floor: nothing collides with them. That IS the payoff
    // of landing a power shot — the goal is briefly undefended.
    if (p.knocked > 0) continue;
    // Rooted (tentacles) still blocks normal play, but never the shot that rooted them —
    // otherwise a trapping shot would trap the defender and then bounce off their face.
    if (b.power && b.power.owner !== p.index && p.rooted > 0) continue;

    const hy = headY(p);

    // ---- kick hitbox (only while the leg is out) ----
    if (p.kickT > 0) {
      const kx = p.x + p.facing * C.KICK_REACH;
      const ky = p.y - C.BODY_H * 0.45;
      if (Math.hypot(b.x - kx, b.y - ky) < C.KICK_R + b.r) {
        if (firePowerIfArmed(m, p, b, fx)) return;
        if (!b.power) {
          const mult = p.stats.kick;
          b.vx = p.facing * C.KICK_POWER * mult + p.vx * 0.4;
          b.vy = -C.KICK_LIFT * mult + p.vy * 0.3;
          b.spin = p.facing * 14;
          p.kickT = 0;
          m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, power: false });
          fx.hit(b.x, b.y, '#ffffff', 1);
          return;
        }
      }
    }

    // ---- head (circle) ----
    const dx = b.x - p.x, dy = b.y - hy;
    const d = Math.hypot(dx, dy);
    const min = C.HEAD_R + b.r;
    if (d < min && d > 0.0001) {
      if (firePowerIfArmed(m, p, b, fx)) return;
      if (b.power && b.power.owner !== p.index) { hitByPowerShot(m, p, b, fx); return; }
      const nx = dx / d, ny = dy / d;
      b.x = p.x + nx * min; b.y = hy + ny * min;
      const rel = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
      if (rel < 0) {
        b.vx -= (1 + C.HEAD_POWER) * rel * nx;
        b.vy -= (1 + C.HEAD_POWER) * rel * ny;
      }
      b.vx += p.vx * 0.42;
      b.vy += Math.min(0, p.vy) * 0.5;
      b.spin += p.vx * 0.02;
      m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, head: true });
      fx.hit(b.x, b.y, '#ffffff', 0.7);
      continue;
    }

    // ---- body box ----
    const halfW = C.BODY_W / 2;
    const top = bodyTop(p);
    const nearestX = clamp(b.x, p.x - halfW, p.x + halfW);
    const nearestY = clamp(b.y, top, p.y);
    const bx = b.x - nearestX, by = b.y - nearestY;
    const bd = Math.hypot(bx, by);
    if (bd < b.r && bd > 0.0001) {
      if (firePowerIfArmed(m, p, b, fx)) return;
      if (b.power && b.power.owner !== p.index) { hitByPowerShot(m, p, b, fx); return; }
      const nx = bx / bd, ny = by / bd;
      b.x = nearestX + nx * b.r; b.y = nearestY + ny * b.r;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) { b.vx -= 1.55 * dot * nx; b.vy -= 1.55 * dot * ny; }
      b.vx += p.vx * 0.3;
      fx.hit(b.x, b.y, '#ffffff', 0.5);
    }
  }
}

function firePowerIfArmed(m, p, b, fx) {
  if (p.armed <= 0 || b.power) return false;
  p.armed = 0;
  launchPowerShot(b, p, p.shot, p.side);
  m.events.push({ type: 'powershot', player: p.index, shot: p.shot.id });
  fx.shockwave(b.x, b.y, p.shot.color);
  return true;
}

function hitByPowerShot(m, p, b, fx) {
  p.knocked = C.POWER_STUN;
  p.vx = b.power.dir * 330;
  p.vy = -320;
  p.onGround = false;
  m.events.push({ type: 'knocked', player: p.index, shot: b.power.id });
  fx.shockwave(p.x, headY(p), b.power.color);
  // The shot punches THROUGH the defender — that's what makes it worth arming.
  b.x = p.x + b.power.dir * (C.HEAD_R + b.r + 4);
}

// ---------------------------------------------------------------------------
// Returns true when a goal was scored this sub-step, so the ball loop stops moving.
function checkGoal(m, fx) {
  if (m.phase !== 'play') return false;
  const b = m.ball;
  if (b.y <= C.GROUND_Y - C.GOAL_H) return false;   // above the mouth — not a goal
  let scorer = null;
  if (b.x < C.GOAL_W - b.r * 0.2) scorer = 1;       // into the LEFT net → player 1 scores
  else if (b.x > C.W - C.GOAL_W + b.r * 0.2) scorer = 0;
  if (scorer === null) return false;

  m.score[scorer]++;
  m.lastScorer = scorer;
  m.events.push({ type: 'goal', player: scorer, power: !!b.power, shot: b.power?.id || null });
  fx.goal(b.x, b.y, b.power?.color || '#ffffff');

  const conceded = m.players[1 - scorer];
  conceded.gauge = Math.min(1, conceded.gauge + C.GAUGE_CONCEDE_BONUS);

  if (m.golden) {
    m.phase = 'over';
    m.events.push({ type: 'fulltime', winner: scorer, golden: true });
    return true;
  }
  m.phase = 'goal';
  m.freeze = C.KICKOFF_FREEZE + 0.9;
  resetPositions(m, m.players[1 - scorer].side);
  return true;
}

export { resetPositions };

// ---------------------------------------------------------------------------
// Rollback support. serialize() must capture EVERYTHING that can affect a future step —
// including the cooldown timers, the double-tap window and `prev` (the previous frame's
// input, which is how the sim detects edges). Miss `prev` and a held key re-fires the
// instant a client reconciles; miss `tapT` and dash stops working right after a snapshot.
//
// Deliberately lossless: no rounding. `test-net.mjs` asserts a restored sim stays in
// lockstep, and that property is what makes rollback sound. A few extra bytes on the wire
// is a trivial price for it at 1v1 scale.
const PREV_KEYS = ['left', 'right', 'jump', 'kick', 'power'];
const P_FIELDS = [
  'x', 'y', 'vx', 'vy', 'onGround', 'facing', 'jumps',
  'kickT', 'kickCd', 'dashT', 'dashCd', 'dashDir', 'tapDir', 'tapT',
  'gauge', 'armed', 'knocked', 'rooted', 'shoved',
];

export function serialize(m) {
  return {
    t: m.t, clock: m.clock, phase: m.phase, freeze: m.freeze,
    score: [m.score[0], m.score[1]], golden: m.golden, lastScorer: m.lastScorer,
    // Players travel POSITIONALLY, in P_FIELDS order. Field names were 60% of the whole
    // snapshot — an array halves it at no cost in precision, and P_FIELDS is the schema.
    p: m.players.map((p) => {
      const o = P_FIELDS.map((f) => p[f]);
      // `prev` packed as 0/1 flags: this is how the sim detects edges, so it must travel,
      // but it does not need five object keys per player to do it.
      o.push(PREV_KEYS.map((k) => (p.prev && p.prev[k] ? 1 : 0)));
      return o;
    }),
    b: {
      x: m.ball.x, y: m.ball.y, vx: m.ball.vx, vy: m.ball.vy, spin: m.ball.spin,
      // The shot itself is static data; only its live flight state travels.
      pw: m.ball.power ? {
        id: m.ball.power.id, kind: m.ball.power.kind, owner: m.ball.power.owner,
        dir: m.ball.power.dir, t: m.ball.power.t, life: m.ball.power.life, phase: m.ball.power.phase,
      } : null,
    },
  };
}

// Restores INTO an existing match built with the same two characters — `char`, `shot`,
// `side` and `stats` are match-constant and never travel.
export function restore(m, s) {
  m.t = s.t; m.clock = s.clock; m.phase = s.phase; m.freeze = s.freeze;
  m.score[0] = s.score[0]; m.score[1] = s.score[1];
  m.golden = s.golden; m.lastScorer = s.lastScorer;
  for (let i = 0; i < 2; i++) {
    const p = m.players[i], o = s.p[i];
    P_FIELDS.forEach((f, j) => { p[f] = o[j]; });
    const pv = o[P_FIELDS.length] || [];
    p.prev = {};
    PREV_KEYS.forEach((k, j) => { p.prev[k] = !!pv[j]; });
  }
  const b = m.ball, o = s.b;
  b.x = o.x; b.y = o.y; b.vx = o.vx; b.vy = o.vy; b.spin = o.spin;
  if (!o.pw) b.power = null;
  else b.power = { ...o.pw, shot: SHOTS[o.pw.id], color: SHOTS[o.pw.id].color, glow: SHOTS[o.pw.id].glow };
  m.events.length = 0;
  return m;
}
