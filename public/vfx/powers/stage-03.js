// STAGE 3 — NIGERIA'S TORNADO SHOT.
//
// Wiki (Nigeria): "Nigeria unleashes a tornado whirlwind on the ground towards the opponent";
// "the shot bounces up and down very quickly"; "if the tornado touches the opponent, they fly and
// spin in the air and they stay unconscious for 3 seconds". Power_Shot_Guide: "you can also get
// hit by the power shot when you jump". Not in our own footage; read off the wiki's GIF frame by
// frame (Nigeria.gif, 640 x 480, ≈ real time; docs/HS-FIRST-3-POWERS.md §1.3):
//   • it is NOT an upright dust devil: it is a CORKSCREW OF WHITE WIND LYING ON ITS SIDE along the
//     grass — 6–8 translucent crescent ribbons wound round an axis just above the turf, grey on
//     their undersides, the stands showing through, motion-smeared. No sand, no dust, no brown;
//   • it ERUPTS from Nigeria himself the frame the ball leaves: ≈ 200 px tall at its back (≈ 3.5
//     heads), unrolling to ≈ 500 px and narrowing to a small swirl streaming off the ball;
//   • it travels a little slower than the ball, the ball runs out of its front, and it DISSOLVES
//     ≈ 0.45 s after the release; the ball runs on along the grass, hopping, a small swirl on it.
// Painted as an 8-frame flipbook of the corkscrew (fx-kit textures: soft strokes, a motion smear,
// a blur) stretched between its back and its front each frame. The one it catches tumbles with
// the gold stars (ailments.js `twister`), as in HS.
// Armed: Head Soccer's own yellow glow and wisps (fx-kit drawArmedGlow) — the same for everyone.

import { book, surface, blurred, blit, glow, sstep, mix } from '../fx-kit.js';
import * as C from '../../../shared/constants.js';

export const VORTEX = {
  H_BACK: 200,       // world px tall at its back, standing on the grass
  BEHIND: 240,       // px behind the release point its back starts (behind Nigeria, often off the screen)
  FRONT_HOLD: 0.2,   // s its front keeps up with the ball before the ball runs out of it
  FRONT_K: 0.55,     // …then its front goes on at this share of the ball's speed
  BACK_K: 0.42,      // its back follows at this share of the ball's speed, from BACK_T
  BACK_T: 0.08,
  FULL: 0.22, GONE: 0.48,   // full, then dissolving, gone
  SMALL_L: 130, SMALL_H: 62,  // the small swirl streaming off the ball
};

// The corkscrew, back (left) to front (right), standing on the texture's bottom edge.
const TW = 560, TH = 300;
function paintVortex(g, w, h, k) {
  const s = surface(w, h), x = s.getContext('2d');
  // (a margin all round: a tilted, wide loop must never reach the texture's edge)
  const bot = h - 10, Rb = (h - 60) / 2, Rf = Rb * 0.34, X0 = w * 0.06, XW = w * 0.8;
  const R = (u) => mix(Rb, Rf, Math.pow(u, 0.8));
  x.lineCap = 'round';
  // FEW, FAT, WIDE ribbons that overlap into one white mass (HS: 5–6 broad crescents), each a
  // little different — never a regular coil
  const N = 5.5, ph = k / 8;
  const jit = (j, n) => { const v = Math.sin(j * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (const near of [false, true]) {
    for (let j = -1; j <= 6; j++) {
      const u = ((j + ph) / N) * 0.92 + 0.04;
      if (u < -0.02 || u > 1.02) continue;
      const jj = Math.floor(j - ph * 0) + 7;
      const r = R(clamp(u)) * (0.9 + 0.22 * jit(jj, 1)), cx = X0 + u * XW, cy = bot - r;
      const endA = sstep(-0.02, 0.12, u) * (1 - sstep(0.78, 1.0, u));
      x.save();
      x.translate(cx, cy); x.rotate(-0.34 + 0.16 * jit(jj, 2));
      const [a0, a1] = near ? [-Math.PI * (0.62 + 0.1 * jit(jj, 3)), Math.PI * (0.52 + 0.08 * jit(jj, 4))] : [Math.PI * 0.55, Math.PI * 1.4];
      const rx = r * (0.9 + 0.2 * jit(jj, 5)), lw = r * (near ? 0.46 : 0.3);
      const passes = near
        ? [[lw * 1.7, 'rgba(255,255,255,0.08)', 0], [lw, 'rgba(146,156,172,0.30)', 5], [lw * 0.8, 'rgba(255,255,255,0.36)', 0], [lw * 0.34, 'rgba(255,255,255,0.8)', -2]]
        : [[lw * 1.3, 'rgba(255,255,255,0.06)', 0], [lw * 0.5, 'rgba(228,234,242,0.22)', 0]];
      for (const [wd, col, off] of passes) {
        x.strokeStyle = col; x.lineWidth = wd; x.globalAlpha = endA;
        x.beginPath(); x.ellipse(off * 0.4, off, rx, r, 0, a0, a1); x.stroke();
      }
      x.restore();
    }
  }
  // the motion smear: the ribbons dragged back along the flight
  g.globalCompositeOperation = 'lighter';
  for (let i = 4; i >= 1; i--) { g.globalAlpha = 0.14 * (5 - i) / 4; g.drawImage(s, -i * 12, 0); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.drawImage(s, 0, 0);
  const soft = blurred(g.canvas, 2);
  g.clearRect(0, 0, w, h); g.globalAlpha = 0.55; g.drawImage(g.canvas, 0, 0);
  g.globalAlpha = 1; g.drawImage(soft, 0, 0, w, h);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(s, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
const clamp = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
export const vortexBook = () => book('nigeria-vortex', 8, TW, TH, (g, w, h, k) => paintVortex(g, w, h, k));

// The corkscrew with its back at xb and its front at xf on the grass line gy, `h` tall at the back.
export function drawVortex(g, xb, xf, gy, h, t, a = 1) {
  const L = Math.abs(xf - xb);
  if (!(L > 8) || !(a > 0.004)) return;
  const bk = vortexBook(), f = Math.floor(t * 30) % bk.length, dir = xf >= xb ? 1 : -1;
  g.save();
  g.globalAlpha = a > 1 ? 1 : a;
  g.translate(xb, gy + 6 * (h / TH));
  g.scale(dir, 1);
  // the texture's margins (paintVortex) are drawn off past both ends, so the ribbons span L × h
  const kx = 1 / 0.86, ky = TH / (TH - 60);
  g.drawImage(bk[f], -0.06 * L * kx, -h * ky, L * kx, h * ky);
  g.restore();
}

// Where the big vortex is `t` s after the release, for a ball `dist` px out from the release point
// x0 flying at `S` px/s the way `dir` points.
export function vortexSpan(x0, dir, dist, S, t) {
  const V = VORTEX;
  const front = Math.min(dist + 20, S * V.FRONT_HOLD + Math.max(0, t - V.FRONT_HOLD) * S * V.FRONT_K);
  const back = -V.BEHIND + Math.max(0, t - V.BACK_T) * S * V.BACK_K;
  const a = t < V.FULL ? 1 : Math.max(0, 1 - (t - V.FULL) / (V.GONE - V.FULL));
  return { xb: x0 + dir * back, xf: x0 + dir * Math.max(back + 120, front), a };
}

export default {
  id: 'tornado',
  palette: ['#ffffff', '#e8eef4', '#9aa6b6'],
  warm() { vortexBook(); glow('#ffffff', 0.3); },
  draw(g, b, s) {
    const dir = s.pw.dir || 1, gy = C.GROUND_Y, t = s.t;
    const S = Math.max(300, Math.abs(b.vx) || C.POWER_SHOT_SPEED * 0.68);
    const dist = Math.max(0, (s.x - s.fx) * dir);
    // the big corkscrew erupting from Nigeria, then dissolving
    const v = vortexSpan(s.fx, dir, dist, S, t);
    if (v.a > 0) drawVortex(g, v.xb, v.xf, gy, VORTEX.H_BACK * (1 - 0.2 * (1 - v.a)), t, v.a);
    // the small swirl streaming off the ball, on it for the rest of the run
    const sa = sstep(0.05, 0.25, t) * 0.85;
    drawVortex(g, s.x - dir * VORTEX.SMALL_L, s.x + dir * 14, gy, VORTEX.SMALL_H, t + 0.37, sa);
    // the ball glows white where it scours the grass
    blit(g, glow('#ffffff', 0.3), s.x, s.y, 58, 50, 0, 0.55, true);
    return false;
  },
};
