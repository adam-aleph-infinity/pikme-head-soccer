// Power shots.
//
// The loop, as Adam specified it 2026-08-21:
//   the gauge fills  →  press POWER to enter POWER MODE for a few seconds  →  while powered,
//   KICKING the ball fires a shot that travels in a straight line at the goal, much faster
//   than a normal strike  →  the defender has to physically get in the way (usually by
//   jumping) to block it.
//
// Every shot flies the SAME way on purpose. If trajectories differed per character, "get in
// the way" would mean something different every time and blocking would be a guess rather
// than a read. What differs is the EFFECT — what the shot does to whoever it hits, and what
// your tackle does while you are powered up. Same threat, different consequence.

import * as C from './constants.js';

// Effects map onto state the sim already has:
//   knock  — full knockdown, no input, gets up after `time`
//   root   — planted; cannot move OR act (the total lockout, so it is always the shortest)
//   slow   — still playing, just heavy
//   shove  — launched a long way, briefly
export const SHOTS = {
  blaze: {
    id: 'blaze', name: 'מנגל בוער', en: 'Blaze', color: '#ff7a18', glow: '#ffd166',
    speed: 1.0,
    effect: { kind: 'knock', time: 0.75, push: 420, note: 'נשרף' },
  },
  coins: {
    id: 'coins', name: 'גשם מטבעות', en: 'Coin Rain', color: '#ffc400', glow: '#fff3b0',
    speed: 0.92,
    effect: { kind: 'slow', time: 2.6, push: 160, note: 'מוצף' },
  },
  tentacles: {
    id: 'tentacles', name: 'תולעים', en: 'Tentacles', color: '#5ce15c', glow: '#c8ffb0',
    speed: 0.88,
    effect: { kind: 'root', time: 1.2, push: 0, note: 'נתפס' },
  },
  wave: {
    id: 'wave', name: 'גל אדום', en: 'Red Wave', color: '#e01e4f', glow: '#ff9ab5',
    speed: 1.05,
    effect: { kind: 'shove', time: 1.0, push: 900, note: 'נסחף' },
  },
  strike: {
    id: 'strike', name: 'סטרייק', en: 'Strike', color: '#7b5cff', glow: '#d9c9ff',
    speed: 1.12,
    // Adam's example. The hardest lockout in the game, so it is also the briefest.
    effect: { kind: 'root', time: 0.5, push: 120, note: 'קפוא' },
  },
};

export const SHOT_ORDER = ['blaze', 'coins', 'tentacles', 'wave', 'strike'];
const RARITY_INDEX = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Hand-picked cards whose art already IS the power — the grill guy burns you, the tentacle
// card grabs you. Everything else falls through to the deterministic pick, so all 180 cards
// are playable without a per-card table.
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
// Deliberately a narrow spread: the mock is testing whether the ALBUM hook is fun, not
// whether pay-to-win is fun.
export const RARITY_STATS = {
  common: { speed: 0.94, jump: 0.96, kick: 0.94 },
  rare: { speed: 0.98, jump: 0.99, kick: 0.98 },
  epic: { speed: 1.02, jump: 1.02, kick: 1.03 },
  legendary: { speed: 1.06, jump: 1.05, kick: 1.08 },
};

export function statsFor(rarity) {
  return RARITY_STATS[rarity] || RARITY_STATS.common;
}

// ---------------------------------------------------------------------------
// Launch: turn a normal ball into a power ball. Straight and flat at the goal — no arc, no
// gravity — so it arrives fast and the only answer is to be in its path.
export function launchPowerShot(ball, shooter, shot, dirX) {
  const speed = C.POWER_SHOT_SPEED * (shot.speed || 1);
  ball.power = {
    id: shot.id,
    owner: shooter.index,
    dir: dirX,
    t: 0,
    life: C.POWER_SHOT_LIFE,
    mult: 1,                       // the volley raises this; see stepCharge in sim.js
    color: shot.color,
    glow: shot.glow,
    shot,
  };
  ball.vx = dirX * speed;
  ball.vy = 0;
  ball.spin = dirX * 26;
  return ball.power;
}

// Per-tick flight. Returns true while the shot owns the ball (the sim then skips gravity
// and friction for this tick).
export function stepPowerShot(ball, players, dt, fx) {
  const p = ball.power;
  if (!p) return false;
  p.t += dt;
  if (p.t >= p.life) { ball.power = null; return false; }

  // Dead flat, at a speed the flight OWNS — the ball is driven, not thrown, so this is set
  // every tick rather than decayed. `mult` is how the power VOLLEY goes three times as fast:
  // without it this line quietly undid the launch on the very next tick, which is exactly
  // what it did to the first version of that move.
  ball.vx = p.dir * C.POWER_SHOT_SPEED * (p.shot.speed || 1) * (p.mult || 1);
  ball.vy += C.BALL_GRAV * C.POWER_SHOT_SAG * dt;
  fx.trail(ball.x, ball.y, p.color, 3);
  return true;
}

// ---------------------------------------------------------------------------
// The signature effect. Applied when a shot connects with a defender, and again — at
// `scale` strength — when a powered-up player kicks the opponent instead of the ball.
export function applyEffect(shot, victim, dirX, scale = 1) {
  const e = shot.effect;
  victim.effectId = shot.id;
  victim.effectT = e.time * scale;

  switch (e.kind) {
    case 'knock':
      victim.knocked = Math.max(victim.knocked, e.time * scale);
      victim.vx = dirX * e.push * scale;
      victim.vy = Math.min(victim.vy, -280);
      victim.onGround = false;
      break;
    case 'root':
      victim.rooted = Math.max(victim.rooted, e.time * scale);
      victim.vx = dirX * e.push * scale;
      break;
    case 'slow':
      victim.slow = Math.max(victim.slow, e.time * scale);
      victim.vx += dirX * e.push * scale;
      break;
    case 'shove':
      victim.vx = dirX * e.push * scale;
      victim.vy = Math.min(victim.vy, -240);
      victim.onGround = false;
      victim.slow = Math.max(victim.slow, e.time * scale * 0.6);
      break;
  }
  victim.dashT = 0;
  return e;
}

// Counter: kicking a live power ball at the right moment reverses it AND hands the
// counterer the shot — the wiki's rule ("you will use their Power Shot").
export function counterPowerShot(ball, counterer) {
  const p = ball.power;
  if (!p) return null;
  p.owner = counterer.index;
  p.dir = counterer.side;
  p.t = 0;
  ball.vx = Math.abs(ball.vx || C.POWER_SHOT_SPEED) * counterer.side;
  ball.vy = 0;
  return p;
}
