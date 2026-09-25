// STAGE 1 — SOUTH KOREA'S BLUE AURA SHOT.
//
// Wiki (South_Korea): "shoots the ball horizontally towards the opponent at a high speed, which is
// cloaked in a blue aura." It is Head Soccer's starter shot, and M4 is South Korea against South
// Korea: the comet we filmed eleven times IS this shot. So it is that comet, frame for frame
// (M4 43.00–43.30 s at full resolution, 2 frame px a world px; docs/HS-POWER-SHOTS.md §3):
//   • the ball at the nose of a blunt WHITE-HOT bullet that reaches ≈ 36 px ahead of it and is
//     ≈ 80 px tall at the ball, solid white back to ≈ 110 px behind it and thinning after;
//   • round it the aura: a thin yellow-green seam on the upper side, then cyan, then deep blue at
//     the edges, fanning OUT to ≈ 140 px tall ≈ 200 px behind the ball, streaked all through with
//     fine motion-blur lines, the streaks running out ragged ≈ 330–440 px back;
//   • the stands show through the blue, not through the white;
//   • full for its first 0.2 s (while the screen is still dark), then thinner and fainter, with
//     the ball's motion-blurred after-images showing through, down to a faint streak.
// Painted once per pixel into three shimmer frames (public/vfx/fx-kit.js), blitted along the
// ball's heading with a soft additive bloom under it.
// Armed: Head Soccer's own yellow flame licks (fx-kit drawArmedGlow) — the same for everyone.

import { tex, book, pix, blurred, blit, glow, ghostBall, noise1, sstep, mix, clamp01 } from '../fx-kit.js';
import { cometAlpha, COMET } from '../families.js';

const PALETTE = ['#ffffff', '#3fe0ff', '#1a78ff', '#c8ff8a'];
// world px: the whole sprite, the nose's reach ahead of the ball, texels a world px
export const KOREA = { L: 560, H: 230, NOSE: 36, D: 1.5 };

const HALF = (u) => (u < 46 ? Math.sqrt(Math.max(0, 46 * 46 - (46 - u) * (46 - u))) : u < 240 ? 46 + 42 * sstep(46, 240, u) : 88 - 26 * sstep(240, 520, u));
const CORE = (u) => 0.9 * Math.exp(-(((Math.max(0, u - 30)) / 140) ** 2));
const SEAM = [206, 255, 90], PALE = [200, 255, 250], CYAN = [36, 236, 244], BLUE = [18, 140, 255], DEEP = [12, 60, 220];

function paintComet(g, w, h, k) {
  const n1 = noise1(11 + k * 5, 512), n2 = noise1(29 + k * 7, 512), n3 = noise1(61 + k * 3, 512);
  const D = KOREA.D;
  pix(g, w, h, (x, y, o) => {
    const u = KOREA.L - (x + 0.5) / D;                           // world px behind the nose
    const v = (y + 0.5) / D - KOREA.H / 2;                       // world px off the axis (− up)
    const H = HALF(u) * (v < 0 ? 1.12 : 0.86);
    if (u < 0 || H < 0.5) return;
    const q = Math.abs(v) / H;
    if (q > 1.2) return;
    const wc = CORE(u);
    // streaks: fine lines along the flight, stronger toward the tail, ragged ends
    const s = 0.6 * n1(v * 0.3 + 100) + 0.4 * n2(v * 0.9 + 40);
    const amt = sstep(30, 260, u) * 0.85;
    const streak = mix(1, 0.5 + 0.7 * s, amt);
    const end = 430 + 120 * n3(v * 0.16 + 7);
    const fade = 1 - sstep(end - 140, end, u);
    const core = 1 - sstep(wc - 0.26, wc + 0.08, q);
    const edge = 1 - sstep(0.66, 1.14, q);
    // colour outside the core: seam (upper side only) → cyan → blue → deep at the rim
    const t = clamp01((q - wc) / Math.max(0.05, 1 - wc));
    let c;
    if (t < 0.18) c = PALE.map((a, i) => mix(a, CYAN[i], sstep(0, 0.18, t)));
    else if (t < 0.55) c = CYAN.map((a, i) => mix(a, BLUE[i], sstep(0.18, 0.55, t) * 0.5));
    else { const f = sstep(0.55, 1, t); c = CYAN.map((a, i) => mix(mix(a, BLUE[i], 0.5), DEEP[i], f * (v < 0 ? 0.7 : 1))); }
    // the green-yellow seam along the top of the core, strongest toward the ball
    if (v < 0) { const sm = Math.exp(-(((q - wc - 0.12) / 0.16) ** 2)) * (1 - sstep(140, 340, u)); c = c.map((a, i) => mix(a, SEAM[i], sm * 0.8)); }
    // bright lines inside the blue
    const hl = sstep(0.72, 0.95, s) * amt * 0.6;
    const wht = Math.max(core, hl);
    o[0] = mix(c[0], 255, wht); o[1] = mix(c[1], 255, wht); o[2] = mix(c[2], 255, wht);
    o[3] = Math.max(core, edge * 0.93 * streak) * fade;
  });
}
const frames = () => book('korea-comet', 3, Math.ceil(KOREA.L * KOREA.D), Math.ceil(KOREA.H * KOREA.D), paintComet);
const bloomTex = () => tex('korea-bloom', Math.ceil(KOREA.L * KOREA.D / 4), Math.ceil(KOREA.H * KOREA.D / 4), (g, w, h) => {
  g.drawImage(blurred(frames()[0], 3), 0, 0, w, h);
});

// The comet on the ball at (x, y), heading (ux, uy), `k` its strength (1 full → 0.2 faint).
export function drawKoreaComet(g, x, y, ux, uy, k = 1, frame = 0) {
  const rot = Math.atan2(uy, ux), ax = (KOREA.L - KOREA.NOSE) / KOREA.L;
  const wk = 0.55 + 0.45 * k, a = Math.pow(k, 0.8);
  blit(g, bloomTex(), x, y, KOREA.L * 1.04, KOREA.H * wk * 1.3, rot, 0.7 * a, true, ax, 0.5);
  blit(g, frames()[frame % 3], x, y, KOREA.L, KOREA.H * wk, rot, a, false, ax, 0.5);
}

export default {
  id: 'blueaura',
  palette: PALETTE,
  warm() { frames(); bloomTex(); ghostBall(); },
  draw(g, b, s) {
    const dir = s.pw.dir || 1;
    const v = Math.hypot(b.vx, b.vy);
    const ux = v > 1 ? b.vx / v : dir, uy = v > 1 ? b.vy / v : 0;
    const k = cometAlpha(s.t);
    drawKoreaComet(g, s.x, s.y, ux, uy, k, Math.floor(s.now * 30));
    // the after-images once the aura thins (M4 43.20–43.30 s): the ball, motion-blurred, down its path
    if (s.t > COMET.FULL && s.hist && s.hist.length > 6) {
      const gb = ghostBall(), f = Math.min(1, (s.t - COMET.FULL) / 0.06);
      for (let i = 4; i >= 1; i--) {
        const h = s.hist[i * 3]; if (!h) continue;
        blit(g, gb, h.x, h.y, s.r * 2.8, s.r * 2.8, 0, (0.46 - i * 0.08) * f, false);
      }
    }
    // a few glints in the aura
    if (k > 0.5) {
      const gl = glow('#7fe8ff', 0.25);
      for (let i = 0; i < 3; i++) {
        const d = 60 + Math.random() * 220, o = (Math.random() - 0.5) * 60 * (d / 200);
        blit(g, gl, s.x - ux * d - uy * o, s.y - uy * d + ux * o, 9, 9, 0, 0.8 * k, true);
      }
    }
    return false;
  },
};
