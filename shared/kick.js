// THE BOOT — one path for the sim and the drawing, so the boot you see is the boot that hits.
//
// Head Soccer's kick is not a hitbox that hands the ball a velocity. It is Box2D: a boot swings
// through the air on a fixed path and the ball bounces off it wherever and whenever the two meet.
// That is the whole of HS's shot variety — a ball met while the boot is still rising is flung
// up hard, one that touches it once it is held up just drops off it, and a running or dashing
// body adds its own speed to the boot's.
//
// THE PATH, frame by frame off HS (M5 80.59–80.71 s, Idan standing still, mashing KICK under a
// dropping ball; and M4 29.68–31.96 s, the same swing with no ball near): no leg is ever drawn.
// The front boot leaves the resting foot low and forward on the first frame, climbs to face
// height by the sixth, and is HELD there, toe up, for the rest of the swing; then it snaps back.
// Keyframes are [progress through KICK_TIME, forward, up, toe-up angle (rad)] in head radii off
// the feet, for the boot's centre. One frame is 1/60 ÷ 0.26 = 0.064 of the swing. M5, read at
// 5× zoom (±1 video px = ±0.08 R):
//   rest (the frame before)  0.62 0.25     f1 0.85 0.48     f2 1.53 0.76     f3 1.75 1.10
//   f4 1.86 1.27     f5 1.92 1.84     f6 1.98 2.18     f7… 1.98 2.29 (held)
// M4 (the older keyframes) runs the same shape ~0.2 R shorter and lower; these are the mean.
import * as C from './constants.js';

export const KICK_KEYS = [
  [0.000, 0.90, 0.45, -0.25],
  [0.064, 1.47, 0.72, 0.30],
  [0.128, 1.67, 1.09, 0.65],
  [0.192, 1.78, 1.34, 0.95],
  [0.256, 1.85, 1.80, 1.20],
  [0.320, 1.88, 2.10, 1.28],
  [0.550, 1.88, 2.20, 1.30],
  [0.920, 1.84, 2.15, 1.30],
  [1.000, 1.00, 0.60, 0.40],
];
// Where the front boot rests, the frame before a swing: under the front of the body.
export const BOOT_REST = [0.62, 0.25, 0];

// [forward, up, angle] at progress k (0..1). Before 0 — the tick the button is pressed — the boot
// is on its way out of the rest pose, so the first frame of a swing already moves (that motion is
// the strike: 0.3 R forward and up in a single tick).
export function kickPose(k) {
  if (k < 0) {
    const u = Math.max(0, 1 + k / (C.TICK / C.KICK_TIME));
    const a = BOOT_REST, b = KICK_KEYS[0];
    return [a[0] + (b[1] - a[0]) * u, a[1] + (b[2] - a[1]) * u, a[2] + (b[3] - a[2]) * u];
  }
  let i = 0;
  while (i < KICK_KEYS.length - 2 && k > KICK_KEYS[i + 1][0]) i++;
  const a = KICK_KEYS[i], b = KICK_KEYS[i + 1];
  const u = Math.max(0, Math.min(1, (k - a[0]) / (b[0] - a[0])));
  return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}

// The boot's centre in the world for a player whose feet are at (x, y), attacking `dir`, with
// the swing at progress k. Offsets scale with the head (the whole character does).
export function bootAt(x, y, dir, k, R = C.HEAD_R) {
  const [f, u] = kickPose(k);
  return { x: x + dir * f * R, y: y - u * R };
}

// The places the boot passes through, for anything that has to guess its reach ahead of time
// (the CPU deciding when to press, the early block): [forward, up] in world px from the feet.
export function bootReach(R = C.HEAD_R) {
  return [[BOOT_REST[0], BOOT_REST[1]], ...KICK_KEYS.slice(0, 7).map((k) => [k[1], k[2]])]
    .map(([f, u]) => [f * R, u * R]);
}
