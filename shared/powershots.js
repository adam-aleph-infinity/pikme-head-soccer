// Power shots.
//
// The loop:
//   the meter fills  →  press POWER to ARM (you glow, nothing else happens)  →  the next
//   time your BODY reaches the ball, the touch launches a shot that travels in a straight
//   line at the goal, much faster than a normal strike  →  the defender has to physically
//   get in the way to block it.
//
// The middle step is the one that has changed twice. It was a MODE (armed, then any kick
// fired it) and then a committed WIND-UP (the press spent the meter and pulled the ball in
// by itself). Both let the press BE the move, which is how a rival with a stale full meter
// could let one off at kickoff. Now the press is a promise and the ball has to be reached.
//
// Every shot flies the SAME way on purpose. If trajectories differed per character, "get in
// the way" would mean something different every time and blocking would be a guess rather
// than a read. What differs is the SPEED, and the colour it is drawn in.
//
// It used to be the EFFECT: each character's shot left its own consequence on whoever blocked
// it — burned, drowned, rooted, swept away — implemented as knocked/rooted/slow plus a grey
// head. That is gone. It read as "you defended well, now sit out the next second and a half",
// and a consequence you cannot play through is not a consequence, it is a pause. A blocked
// shot costs the defender HEALTH now (C.POWER_DAMAGE, applied in hitByPowerShot), which shows
// on the character's face and can be played around and mended.

import * as C from './constants.js';

export const SHOTS = {
  blaze: {
    id: 'blaze', name: 'מנגל בוער', en: 'Blaze', color: '#ff7a18', glow: '#ffd166',
    speed: 1.0,
  },
  coins: {
    id: 'coins', name: 'גשם מטבעות', en: 'Coin Rain', color: '#ffc400', glow: '#fff3b0',
    speed: 0.92,
  },
  tentacles: {
    id: 'tentacles', name: 'תולעים', en: 'Tentacles', color: '#5ce15c', glow: '#c8ffb0',
    speed: 0.88,
  },
  wave: {
    id: 'wave', name: 'גל אדום', en: 'Red Wave', color: '#e01e4f', glow: '#ff9ab5',
    speed: 1.05,
  },
  strike: {
    id: 'strike', name: 'סטרייק', en: 'Strike', color: '#7b5cff', glow: '#d9c9ff',
    speed: 1.12,                 // Adam's example, and the fastest shot in the game
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
