// Power shots — the mechanic Head Soccer is actually built around.
//
// The loop the real game uses (and what this mirrors):
//   gauge fills with match time  →  POWER button appears  →  press it to ARM  →
//   the NEXT ball contact fires your signature shot  →  the defender either eats it
//   (knockdown) or COUNTERS it by kicking at the right moment, and steals the shot.
//
// A shot is data, not code branches scattered through the sim: `kind` selects one of five
// flight behaviours, everything else is flavour. Adding a character = adding a row here.

import * as C from './constants.js';

// The five flight behaviours, straight from the wiki's taxonomy:
//   straight  — flat rocket at the goal, ignores gravity
//   arc       — lobbed high, then slams down and shockwaves along the ground
//   trap      — freezes, roots the defender in place, then drifts in
//   wave      — stage-wide front that shoves the defender back; the ball rides it
//   homing    — seeks the defender's head first, then ricochets goalward
export const SHOTS = {
  blaze: {
    id: 'blaze', kind: 'straight', name: 'מנגל בוער', en: 'Blaze',
    color: '#ff7a18', glow: '#ffd166', life: 1.05, speed: 1.0,
  },
  coins: {
    id: 'coins', kind: 'arc', name: 'גשם מטבעות', en: 'Coin Rain',
    color: '#ffc400', glow: '#fff3b0', life: 1.5, speed: 0.85,
  },
  tentacles: {
    id: 'tentacles', kind: 'trap', name: 'תולעים', en: 'Tentacles',
    color: '#5ce15c', glow: '#c8ffb0', life: 2.0, speed: 0.55,
    rootTime: 1.5,
  },
  wave: {
    id: 'wave', kind: 'wave', name: 'גל אדום', en: 'Red Wave',
    color: '#e01e4f', glow: '#ff9ab5', life: 1.25, speed: 1.05,
    shove: 900,
  },
  strike: {
    id: 'strike', kind: 'homing', name: 'סטרייק', en: 'Strike',
    color: '#7b5cff', glow: '#d9c9ff', life: 1.6, speed: 0.95,
    seekTime: 0.55,
  },
};

export const SHOT_ORDER = ['blaze', 'coins', 'tentacles', 'wave', 'strike'];
const RARITY_INDEX = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Hand-picked cards whose art already *is* the power shot — the grill guy throws fire,
// the tentacle card traps you. Everything else falls through to the deterministic pick,
// so every one of the 180 cards is playable without a per-card table.
export const FEATURED = {
  legendary_3: 'blaze',
  legendary_6: 'coins',
  legendary_2: 'tentacles',
  legendary_9: 'wave',
  legendary_18: 'strike',
};

export function shotFor(rarity, number) {
  const key = `${rarity}_${number}`;
  if (FEATURED[key]) return SHOTS[FEATURED[key]];
  const i = (Number(number) + (RARITY_INDEX[rarity] ?? 0)) % SHOT_ORDER.length;
  return SHOTS[SHOT_ORDER[i]];
}

// Rarity nudges the feel — a legendary head is a bit quicker and hits a bit harder.
// Deliberately a narrow spread: the mock is testing whether the ALBUM hook is fun,
// not whether pay-to-win is fun.
export const RARITY_STATS = {
  common:    { speed: 0.94, jump: 0.96, kick: 0.94 },
  rare:      { speed: 0.98, jump: 0.99, kick: 0.98 },
  epic:      { speed: 1.02, jump: 1.02, kick: 1.03 },
  legendary: { speed: 1.06, jump: 1.05, kick: 1.08 },
};

export function statsFor(rarity) {
  return RARITY_STATS[rarity] || RARITY_STATS.common;
}

// ---------------------------------------------------------------------------
// Launch: turn a normal ball into a power ball. `dirX` is the goalward direction
// of the shooter (+1 shoots right). Called by the sim on the armed player's touch.
export function launchPowerShot(ball, shooter, shot, dirX) {
  const speed = C.POWER_SHOT_SPEED * (shot.speed || 1);
  ball.power = {
    id: shot.id,
    kind: shot.kind,
    owner: shooter.index,
    dir: dirX,
    t: 0,
    life: shot.life,
    phase: 0,           // behaviour-local stage counter
    color: shot.color,
    glow: shot.glow,
    shot,
  };
  ball.spin = dirX * 22;

  switch (shot.kind) {
    case 'straight':
      ball.vx = dirX * speed;
      ball.vy = 0;
      break;
    case 'arc':
      ball.vx = dirX * speed * 0.52;
      ball.vy = -speed * 0.72;
      break;
    case 'trap':
      ball.vx = 0;
      ball.vy = 0;
      break;
    case 'wave':
      ball.vx = dirX * speed;
      ball.vy = -60;
      break;
    case 'homing':
      ball.vx = dirX * speed * 0.45;
      ball.vy = -220;
      break;
  }
  return ball.power;
}

// ---------------------------------------------------------------------------
// Per-tick flight behaviour. Returns true while the shot still owns the ball
// (i.e. the sim should skip normal gravity/friction for this tick).
export function stepPowerShot(ball, players, dt, fx) {
  const p = ball.power;
  if (!p) return false;
  p.t += dt;
  if (p.t >= p.life) { ball.power = null; return false; }

  const defender = players[1 - p.owner];
  const shot = p.shot;

  switch (p.kind) {
    case 'straight': {
      // Dead flat, no gravity: the shot that looks unstoppable until you learn to counter it.
      ball.vy *= 0.82;
      ball.vx = p.dir * C.POWER_SHOT_SPEED * (shot.speed || 1);
      fx.trail(ball.x, ball.y, p.color, 3);
      break;
    }
    case 'arc': {
      // Up, over, then a near-vertical slam that shockwaves along the grass.
      if (p.phase === 0) {
        ball.vy += C.BALL_GRAV * 0.55 * dt;
        if (ball.vy > 0) { p.phase = 1; ball.vx *= 0.45; }
      } else {
        ball.vy += C.BALL_GRAV * 2.6 * dt;      // slam
      }
      fx.trail(ball.x, ball.y, p.color, 2);
      if (p.phase === 1 && ball.y > C.GROUND_Y - C.BALL_R - 4) {
        fx.shockwave(ball.x, C.GROUND_Y, p.color);
        p.phase = 2;
        ball.vx = p.dir * C.POWER_SHOT_SPEED * 0.9;
        ball.vy = -420;
      }
      break;
    }
    case 'trap': {
      // Hangs in the air, roots the defender, then strolls in while they can't move.
      if (p.phase === 0) {
        ball.vx = 0; ball.vy = 0;
        if (p.t > 0.42) {
          p.phase = 1;
          defender.rooted = shot.rootTime;
          fx.grab(defender.x, defender.y, p.color);
          ball.vx = p.dir * C.POWER_SHOT_SPEED * 0.55;
          ball.vy = -90;
        }
      } else {
        ball.vy += C.BALL_GRAV * 0.18 * dt;
      }
      fx.trail(ball.x, ball.y, p.color, 2);
      break;
    }
    case 'wave': {
      // A front sweeping the whole stage: everything in its path gets shoved goalward.
      const front = p.dir > 0
        ? ball.x + 90
        : ball.x - 90;
      p.front = front;
      const hits = p.dir > 0 ? defender.x < front && defender.x > front - 260
                             : defender.x > front && defender.x < front + 260;
      if (hits && !defender.knocked) {
        defender.vx += p.dir * shot.shove * dt * 4;
        defender.shoved = 0.25;
      }
      ball.vy *= 0.9;
      fx.trail(ball.x, ball.y, p.color, 4);
      break;
    }
    case 'homing': {
      // Seeks the defender's head, guarantees the hit, then ricochets at the goal.
      if (p.phase === 0 && p.t < shot.seekTime && !defender.knocked) {
        const dx = defender.x - ball.x;
        const dy = (defender.y - C.HEAD_R * 0.4) - ball.y;
        const d = Math.hypot(dx, dy) || 1;
        const s = C.POWER_SHOT_SPEED * (shot.speed || 1);
        ball.vx += (dx / d * s - ball.vx) * 6 * dt;
        ball.vy += (dy / d * s - ball.vy) * 6 * dt;
      } else if (p.phase === 0) {
        p.phase = 1;
        ball.vx = p.dir * C.POWER_SHOT_SPEED * 1.05;
        ball.vy = -140;
      }
      fx.trail(ball.x, ball.y, p.color, 3);
      break;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Counter: kicking a live power ball at the right moment reverses it AND hands the
// counterer the shot — the wiki's rule ("you will use their Power Shot").
export function counterPowerShot(ball, counterer) {
  const p = ball.power;
  if (!p) return null;
  const dir = counterer.side;          // fire it back at THEIR goal
  p.owner = counterer.index;
  p.dir = dir;
  p.t = 0;
  p.phase = 0;
  ball.vx = Math.abs(ball.vx || C.POWER_SHOT_SPEED) * dir;
  ball.vy = -180;
  return p;
}
