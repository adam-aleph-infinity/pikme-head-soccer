// STAGE 1 — SOUTH KOREA'S BLUE AURA SHOT.
//
// Wiki (South_Korea): "shoots the ball horizontally towards the opponent at a high speed, which is
// cloaked in a blue aura." It is Head Soccer's starter shot, and M4 is South Korea against South
// Korea: the comet we filmed eleven times IS this shot. Re-read frame by frame at 60 fps and full
// resolution (M4 43.05–43.40 s, 2556 x 1180, 2 frame px a world px; docs/HS-FIRST-3-POWERS.md):
//
// THE SHAPE (M4 43.17 s, the comet at its fullest), world px behind the ball's centre:
//   • the ball sits at a SLIM tip — the white reaches only 38 px ahead of its centre and is ±30 px
//     tall there; the comet is NOT a fat bulb round the ball;
//   • it FATTENS BACKWARDS like a cone, and the top edge flares far more than the bottom: 80 px up
//     and 43 down at 240–290 px back, then it closes to its end ≈ 460 px back;
//   • a long WHITE-HOT core fills it from the tip back to ≈ 200 px, wrapped in a thin yellow-green
//     seam (the upper edge further back, the lower edge by the ball); then cyan, blue, and a deep
//     blue top-back where the only streaks are — soft wisps running out the back. The body is one
//     soft volume, not a bundle of speed lines.
// THE DEATH, which is most of what the eye reads as "HS" (M4 43.07 → 43.40 s):
//   • 0 → 0.12 s full, at full length from its first frame (at the wall its back is simply cut
//     off by the edge of the screen);
//   • 0.12 → 0.22 s it DISSOLVES FROM THE BACK forward and the white core shrinks to the ball;
//   • by 0.22 s what is left is a translucent GREEN-YELLOW band along the lower half of the ball's
//     path, cyan-blue further back, ≈ 250–300 px long, fading out by ≈ 0.36 s;
//   • from ≈ 0.15 s faint GHOST BALLS are left along the path, one every ≈ 110 px, each where the
//     ball was — stamps that stay put and fade, not copies trailing it.
// Painted once per pixel into PHASES of that death (public/vfx/fx-kit.js), cross-faded by time,
// each with a soft additive bloom that bleeds into the stands the way HS's does.
// Armed: Head Soccer's own yellow glow and wisps (fx-kit drawArmedGlow) — the same for everyone.

import { tex, pix, blurred, blit, glow, ghostBall, noise1, sstep, mix, clamp01 } from '../fx-kit.js';

const PALETTE = ['#ffffff', '#3fe0ff', '#1a78ff', '#c8ff8a'];
// world px: the sprite runs from BACK px behind the ball's centre to FRONT px ahead of it, UP px
// above the axis and DOWN below; D texels a world px
export const KOREA = { BACK: 470, FRONT: 44, UP: 100, DOWN: 70, D: 1.25, NOSE: 38 };
const L = KOREA.BACK + KOREA.FRONT, H = KOREA.UP + KOREA.DOWN;
// the timeline (s after the release)
export const KOREA_T = { FULL: 0.12, BAND: 0.30, GONE: 0.38, GHOST: 0.15, GHOST_STEP: 110, GHOST_LIFE: 0.42 };
const PHASES = 7;

// the outline, world px off the axis, by u = px behind the ball's centre (M4 43.17 s)
const UPT = [[0, 30], [50, 47], [90, 57], [140, 67], [190, 75], [240, 80], [290, 80], [340, 72], [390, 58], [430, 34], [460, 0]];
// the white core's half-height, world px, by u (M4 43.17 s: ±28 at the ball, fullest ≈ 60 back)
const CORE = [[0, 28], [60, 34], [120, 30], [170, 18], [215, 0]];
const LOT = [[0, 30], [50, 37], [90, 42], [140, 45], [190, 45], [240, 43], [290, 38], [340, 32], [390, 24], [430, 12], [460, 0]];
const lerpT = (T, u) => {
  if (u <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (u <= T[i][0]) { const [a, va] = T[i - 1], [b, vb] = T[i]; return va + (vb - va) * sstep(0, 1, (u - a) / (b - a)); }
  return 0;
};
// ahead of the ball: a round tip reaching NOSE px
const half = (T, u) => (u >= 0 ? lerpT(T, u) : 30 * Math.sqrt(Math.max(0, 1 - (u / KOREA.NOSE) ** 2)));

const WHITE = [255, 255, 255], SEAM = [206, 255, 96], CYAN = [40, 232, 246], BLUE = [22, 142, 255], DEEP = [14, 62, 222];
const BAND_Y = [210, 255, 110], BAND_C = [70, 226, 236];
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// One phase of the comet's life: p = 0 full, 1 = only the green-yellow band left.
function paintPhase(g, w, h, p) {
  const n1 = noise1(11, 512), n2 = noise1(29, 512), n3 = noise1(61, 512);
  const D = KOREA.D;
  const cut = 470 - 250 * p;                                 // the back dissolving forward
  const coreEnd = 215 * Math.pow(1 - p, 1.1), coreK = Math.pow(1 - p, 0.8);
  const bodyA = (1 - 0.3 * p) * (1 - sstep(0.55, 1, p));
  const bandA = sstep(0.3, 0.9, p) * 0.85;
  pix(g, w, h, (x, y, o) => {
    const u = KOREA.BACK - (x + 0.5) / D;                    // px behind the ball's centre (− ahead)
    const v = (y + 0.5) / D - KOREA.UP;                      // px off the axis (− up)
    let r = 0, gg = 0, b = 0, a = 0;
    // ─ the body ─
    const hh = v < 0 ? half(UPT, u) : half(LOT, u);
    if (hh > 0.5 && u > -KOREA.NOSE - 2) {
      const q = Math.abs(v) / hh;
      if (q < 1.25) {
        // the white core: a long soft rounded billow in world px (±28 at the ball, ±34 at 60 back,
        // closing by ≈ 215), a touch above the axis, shrinking with p — never a hard blade
        const ch = coreK * (u < 0 ? 30 * Math.sqrt(Math.max(0, 1 - (u / (KOREA.NOSE - 4)) ** 2)) : lerpT(CORE, u * (215 / Math.max(1, coreEnd))));
        const cd = Math.abs(v + 4);
        const core = ch > 1 ? 1 - sstep(ch - 14, ch + 10, cd) : 0;
        const cw = ch > 1 ? Math.min(0.95, ch / hh) : 0;
        // colour outside it: seam → cyan → blue → deep (deepest top-back)
        const t = clamp01((q - cw) / Math.max(0.08, 1 - cw));
        let c = t < 0.3 ? mixc(CYAN, BLUE, sstep(0, 0.3, t) * 0.35) : mixc(mixc(CYAN, BLUE, 0.35), DEEP, sstep(0.3, 1, t) * (v < 0 ? 0.95 : 0.55) * sstep(60, 260, u));
        // the yellow-green seam: a soft tint just outside the core, never an outline
        const seamW = v < 0 ? sstep(20, 70, u) * (1 - sstep(220, 320, u)) : (1 - sstep(90, 170, u));
        const seam = Math.exp(-(((q - cw - 0.16) / 0.2) ** 2)) * seamW * (1 - p * 0.6);
        c = mixc(c, SEAM, seam * 0.55);
        c = mixc(c, WHITE, core);
        // soft wisps only in the back, running out ragged
        const s = 0.6 * n1(v * 0.1 + 100) + 0.4 * n2(v * 0.28 + 40);
        const back = sstep(220, 400, u);
        const wisp = mix(1, 0.62 + 0.5 * s, back);
        const end = 440 + 40 * n3(v * 0.12 + 7);
        const fade = (1 - sstep(end - 110, end, u)) * (1 - sstep(cut - 130, cut, u));
        const edge = 1 - sstep(0.62, 1.12, q);
        const al = Math.max(core, edge * 0.94 * wisp) * fade * bodyA;
        r = c[0]; gg = c[1]; b = c[2]; a = al;
      }
    }
    // ─ the band it leaves (p → 1): the lower half of the path, green-yellow at the ball ─
    if (bandA > 0.001 && u > -8 && u < 360) {
      const bv = (v - 9) / 15, bq = Math.exp(-bv * bv * 1.6);
      const along = sstep(-8, 14, u) * (1 - sstep(220, 360, u)) * (0.8 + 0.2 * n1(u * 0.05 + 3));
      const ba = bq * along * bandA;
      if (ba > a) { const c = mixc(BAND_Y, BAND_C, sstep(150, 320, u)); r = c[0]; gg = c[1]; b = c[2]; }
      a = Math.max(a, ba);
    }
    o[0] = r; o[1] = gg; o[2] = b; o[3] = a;
  });
}
// painted, then softened a texel or two: HS's comet has no hard edge anywhere
const phase = (k) => tex(`korea-comet-${k}`, Math.ceil(L * KOREA.D), Math.ceil(H * KOREA.D), (g, w, h, c) => {
  paintPhase(g, w, h, k / (PHASES - 1));
  const soft = blurred(c, 1);
  g.clearRect(0, 0, w, h); g.drawImage(soft, 0, 0, w, h);
});
const bloom = (k) => tex(`korea-bloom-${k}`, Math.ceil(L * KOREA.D / 4), Math.ceil(H * KOREA.D / 4), (g, w, h) => g.drawImage(blurred(phase(k), 3), 0, 0, w, h));

// Where in its death the comet is, `t` s after the release: p (0 full → 1 band) and its alpha.
export function koreaPhase(t) {
  const T = KOREA_T;
  const p = t < T.FULL ? 0 : Math.min(1, (t - T.FULL) / (T.BAND - T.FULL));
  const a = t < T.BAND ? 1 : Math.max(0, 1 - (t - T.BAND) / (T.GONE - T.BAND));
  return { p, a };
}

// The comet on the ball at (x, y), heading (ux, uy), `t` s after the release.
export function drawKoreaComet(g, x, y, ux, uy, t = 0, a0 = 1) {
  const { p, a } = koreaPhase(t);
  if (!(a * a0 > 0.004)) return;
  const rot = Math.atan2(uy, ux), ax = KOREA.BACK / L, ay = KOREA.UP / H;
  const f = p * (PHASES - 1), k0 = Math.floor(f), k1 = Math.min(PHASES - 1, k0 + 1), w1 = f - k0;
  for (const [k, w] of [[k0, 1 - w1], [k1, w1]]) {
    if (w < 0.01) continue;
    blit(g, bloom(k), x, y, L * 1.06, H * 1.25, rot, 0.62 * w * a * a0, true, ax, ay);
    blit(g, phase(k), x, y, L, H, rot, w * a * a0, false, ax, ay);
  }
}

// The ghost balls it leaves on its path: a stamp every GHOST_STEP px from the release point (x0, y0)
// up to the ball, each fading from the moment the ball passed it.
export function drawKoreaGhosts(g, x0, y0, x, y, speed, t, r) {
  const T = KOREA_T;
  if (t < T.GHOST * 0.7) return;
  const dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy);
  if (dist < T.GHOST_STEP) return;
  const ux = dx / dist, uy = dy / dist, gb = ghostBall(), on = sstep(T.GHOST * 0.7, T.GHOST + 0.04, t);
  for (let d = T.GHOST_STEP; d < dist - 24; d += T.GHOST_STEP) {
    const age = (dist - d) / Math.max(300, speed);
    const k = 1 - age / T.GHOST_LIFE;
    if (k <= 0) continue;
    blit(g, gb, x0 + ux * d, y0 + uy * d, r * 2.6, r * 2.6, 0, 0.5 * k * on, false);
  }
}

export default {
  id: 'blueaura',
  palette: PALETTE,
  warm() { for (let k = 0; k < PHASES; k++) { phase(k); bloom(k); } ghostBall(); glow('#7fe8ff', 0.25); },
  draw(g, b, s) {
    const dir = s.pw.dir || 1;
    const v = Math.hypot(b.vx, b.vy);
    const ux = v > 1 ? b.vx / v : dir, uy = v > 1 ? b.vy / v : 0;
    if (s.pw.ph === 'fly') drawKoreaGhosts(g, s.fx, s.fy, s.x, s.y, v, s.t, s.r);
    drawKoreaComet(g, s.x, s.y, ux, uy, s.t);
    // a few sparkles left in the dissolving back (M4 43.13–43.24 s)
    const { p } = koreaPhase(s.t);
    if (p > 0.1 && p < 0.85) {
      const gl = glow('#7fe8ff', 0.25);
      for (let i = 0; i < 2; i++) {
        const d = 120 + Math.random() * 200, o = (Math.random() - 0.6) * 50;
        blit(g, gl, s.x - ux * d - uy * o, s.y - uy * d + ux * o, 8, 8, 0, 0.7 * (1 - p), true);
      }
    }
    return false;
  },
};
