// THE CUT-IN'S LIGHT — the white disc behind the shooter's head, the ring that expands off it and
// the three layers of rays, as painted textures (public/vfx/fx-kit.js), played on HS's own fixed
// timeline (THE CUT-IN AS HS PLAYS IT, below; docs/HS-POWER-VFX-RESEARCH.md §5).
import { tex, pix, bloom, surface, blit, rng, noise1, sstep, mix, clamp01, TAU } from './fx-kit.js';
// (goldRay / softRay are the textures of the earlier 16-ray wheel; the cut-in now draws rayA /
// rayB below — see THE CUT-IN AS HS PLAYS IT.)

export const CUT = { DISC: 45, DISC_TEX: 0.52, HALO: 84, HALO_TEX: 0.66, GOLD_L: 240, GOLD_W: 58, SOFT_L: 200, SOFT_W: 104, R0: 34 };

export function goldRay() {
  return tex('goldray', 256, 48, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const u = (x + 0.5) / w, v = ((y + 0.5) / h) * 2 - 1;
    const hw = 0.1 + 0.9 * Math.pow(u, 0.85);
    const body = Math.exp(-((v / hw) ** 2) * 2.6), core = Math.exp(-((v / (hw * 0.3 + 0.04)) ** 2)), halo = Math.exp(-((v / hw) ** 2) * 0.8);
    const along = sstep(0, 0.05, u) * (1 - sstep(0.5, 1, u) * 0.9) * (1 - sstep(0.93, 1, u));
    const a = clamp01(core * 1 + body * 0.85 + halo * 0.22) * along;
    const wht = clamp01(core * 1.2 * (1 - u * 0.5));
    o[0] = 255; o[1] = mix(196, 255, wht); o[2] = mix(34, 225, wht); o[3] = a;
  }));
}
export function softRay() {
  const n = noise1(33, 256), n2 = noise1(71, 256);
  return tex('softray', 256, 96, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const u = (x + 0.5) / w, v = ((y + 0.5) / h) * 2 - 1;
    const hw = 0.22 + 0.78 * u, q = v / hw;
    const across = Math.exp(-(q * q) * 2.4);
    const streak = 0.62 + 0.28 * n(q * 20 + 40) + 0.16 * n2(q * 50 + 9 + u * 3);
    const along = sstep(0, 0.12, u) * (1 - sstep(0.4, 1, u));
    o[0] = 255; o[1] = mix(222, 248, Math.exp(-q * q * 6)); o[2] = mix(110, 190, Math.exp(-q * q * 6));
    o[3] = clamp01(across * streak * along) * 0.95;
  }));
}
export function disc() {
  return tex('cutdisc', 128, 128, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const d = Math.hypot(x + 0.5 - 64, y + 0.5 - 64) / 64;
    const e = Math.max(0, d - CUT.DISC_TEX);
    const a = d < CUT.DISC_TEX ? 1 : Math.exp(-((e / 0.15) ** 2)) * 0.95 + 0.25 * Math.exp(-e / 0.3);
    const k = clamp01(e / 0.2);
    o[0] = 255; o[1] = mix(255, 206, k); o[2] = mix(255, 70, k);
    o[3] = a * (1 - sstep(0.94, 1, d));
  }));
}
export function halo(i = 0) {
  return tex(`cuthalo${i}`, 256, 256, (g, w, h) => {
    const n = noise1(500 + i * 7, 512), n2 = noise1(800 + i * 11, 512);
    const s = surface(w, h), x = s.getContext('2d');
    pix(x, w, h, (px, py, o) => {
      const dx = px + 0.5 - 128, dy = py + 0.5 - 128, d = Math.hypot(dx, dy) / 128, th = Math.atan2(dy, dx) / TAU + 0.5;
      const R = CUT.HALO_TEX, e = (d - R) / 0.055;
      const ring = Math.exp(-e * e) + 0.45 * Math.exp(-(((d - R + 0.03) / 0.03) ** 2));
      const stri = 0.35 + 0.65 * n(th * 420) * (0.6 + 0.4 * n2(th * 90));
      const inner = 0.1 * Math.exp(-(((d - R * 0.8) / 0.12) ** 2));
      o[0] = 255; o[1] = mix(190, 250, clamp01(ring - 0.4)); o[2] = mix(40, 170, clamp01(ring - 0.5));
      o[3] = clamp01(ring * stri * 0.95 + inner);
    });
    // the sparkle spikes crossing the ring
    const r = rng(40 + i * 3);
    x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    for (let k = 0; k < 18; k++) {
      const a = r() * TAU, r0 = 128 * (CUT.HALO_TEX - 0.08 - r() * 0.06), r1 = 128 * (CUT.HALO_TEX + 0.07 + r() * 0.16);
      const lg = x.createLinearGradient(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0, 128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
      lg.addColorStop(0, 'rgba(255,230,120,0)'); lg.addColorStop(0.45, 'rgba(255,250,215,0.95)'); lg.addColorStop(1, 'rgba(255,220,90,0)');
      x.strokeStyle = lg; x.lineWidth = 1.2 + r() * 1.4;
      x.beginPath(); x.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); x.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); x.stroke();
    }
    bloom(g, s, [[1, 0.5, '#ffd84a'], [3, 0.35, '#ffb800']], w, h);
  });
}

// ── THE CUT-IN AS HS PLAYS IT ────────────────────────────────────────────────────────────────
// One FIXED animation, the same to a frame every time and not mirrored for a shooter on the left
// (docs/HS-POWER-VFX-RESEARCH.md §5: M4 40.20, 59.97, 122.67, 150.38 and 41.78 s at 60 fps, the
// rays' angles found by unrolling the frames round the head and fitting each ray's turn). All times
// are frames at 60 fps from the TOUCH (f0); angles are maths angles (0° right, 90° up); sizes are
// head radii. Three layers of light, all additive, over a white disc and an expanding ring.
const ease = (t) => t * t * (3 - 2 * t);
// piecewise-linear keyframes [[frame, value], …]
function keys(K, f) {
  if (f <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (f <= K[i][0]) { const [f0, v0] = K[i - 1], [f1, v1] = K[i]; return v0 + (v1 - v0) * (f - f0) / (f1 - f0); }
  return K[K.length - 1][1];
}
// A — three thin lemon rays with white cores, ≈ 6.8 r. Still until their start frame, then each
// turns clockwise at its own rate (fitted per ray, two cut-ins agree to ±0.1°/frame).
export const RAYS_A = [
  { a: 91, v: -1.51, s: 11, on: 1.5 },
  { a: 205, v: -1.51, s: 15, on: 3 },
  { a: 335, v: -1.97, s: 17.5, on: 3 },
];
// B — a five-point star of wide streaky cream rays, the longest (≈ 8 r), clockwise 164°/s;
// C — a short soft X (≈ 5.3 r), counter-clockwise 104°/s. Angles as they are at f24.
export const RAYS_B = { at24: [71, 137, 216, 282, 358], v: -2.73, on: [7, 15] };
export const RAYS_C = { at24: [56, 146, 234, 323], v: 1.74, on: [9, 16] };
export const CUT_LEN = { A: 7.6, B: 8.6, C: 6.6, WA: 1.6, WB: 4.6, WC: 3.6 };
// the white disc: how far out it reads pure white (r; HS luma ≥ 225, the median round the head),
// its strength (going soft after f56 — by f70 HS's is only a glow), and the expanding ring
const DISC_K = [[1.5, 0], [3, 1.0], [5, 1.8], [8, 1.9], [12, 2.2], [16, 2.15], [22, 2.0], [30, 1.85], [42, 1.75], [56, 1.55], [80, 1.5]];
const DISC_A = [[56, 1], [68, 0.55], [80, 0.5]];
// the texture reads white a little past its solid core (≈ 1.2×, measured on our capture)
const DISC_WHITE = 1.2;
const BLOOM_K = [[2, 0], [5, 0.5], [9, 1], [16, 1], [26, 0.35], [56, 0.15]];
const RING_R = [[22, 2.8], [42, 3.8], [56, 4.8], [62, 5.1]];
const RING_A = [[21, 0], [25, 1], [42, 0.6], [56, 0.25], [62, 0]];

// Where the cut-in is at frame `f` (from the touch) with the ball leaving at frame `fr`.
export function cutTimeline(f, fr) {
  // the rays and the disc go with the ball: gone within 3 frames of the release (M4 f76 → f79)
  const out = 1 - Math.min(1, Math.max(0, (f - fr) / 3));
  return { f, out, disc: keys(DISC_K, f) / DISC_WHITE, discA: keys(DISC_A, f), bloom: keys(BLOOM_K, f), ringR: keys(RING_R, f), ringA: keys(RING_A, f) };
}

const rayA = () => tex('cutrayA', 256, 48, (g, w, h) => pix(g, w, h, (x, y, o) => {
  const u = (x + 0.5) / w, v = ((y + 0.5) / h) * 2 - 1;
  const hw = 0.18 + 0.82 * Math.pow(u, 0.7);
  const core = Math.exp(-((v / (hw * 0.22 + 0.03)) ** 2)), body = Math.exp(-((v / (hw * 0.45)) ** 2)), glow = Math.exp(-((v / hw) ** 2) * 1.2);
  const along = sstep(0, 0.04, u) * (1 - sstep(0.72, 1, u));
  const wht = clamp01(core * (1.1 - u * 0.6));
  o[0] = 255; o[1] = mix(246, 255, wht); o[2] = mix(96, 235, wht);
  o[3] = clamp01(core + body * 0.75 + glow * 0.3) * along;
}));
// wide cream beams, streaky along their length like a radial blur (B and C share it)
const rayB = () => {
  const n = noise1(33, 256), n2 = noise1(71, 256);
  return tex('cutrayB', 256, 96, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const u = (x + 0.5) / w, v = ((y + 0.5) / h) * 2 - 1;
    const hw = 0.22 + 0.78 * u, q = v / hw;
    const across = Math.exp(-(q * q) * 2.4);
    const streak = 0.6 + 0.3 * n(q * 20 + 40) + 0.16 * n2(q * 50 + 9 + u * 3);
    const along = sstep(0, 0.1, u) * (1 - sstep(0.6, 1, u));
    const c = Math.exp(-q * q * 5);
    o[0] = 255; o[1] = mix(240, 252, c); o[2] = mix(150, 205, c);
    o[3] = clamp01(across * streak * along);
  }));
};
// each B/C ray's own flicker (HS's wide rays fade in and out one by one)
const flick = (i, el) => 0.62 + 0.38 * Math.sin(el * 10.7 + i * 2.1) * Math.sin(el * 4.1 + i * 1.3);
const DEG = Math.PI / 180;
function ray(g, t, hx, hy, r, deg, len, wid, alpha) {
  const a = -deg * DEG, r0 = 0.6 * r;
  blit(g, t, hx + Math.cos(a) * r0, hy + Math.sin(a) * r0, (len - 0.6) * r, wid * r, a, alpha, true, 0, 0.5);
}

// The light at the head (hx, hy), head radius r; `T` from cutTimeline; `el` seconds in (flicker).
export function drawRays(g, hx, hy, r, T, el) {
  const f = T.f;
  if (T.out <= 0 || f < 2) return;
  // the ring: an expanding, fading shockwave from f22
  if (T.ringA > 0) {
    const H = T.ringR * r * 2 / CUT.HALO_TEX;
    blit(g, halo(Math.floor(el * 15) & 1), hx, hy, H, H, -el * 0.3, T.ringA * 0.5 * T.out, true);
  }
  const b = rayB();
  const inB = ease(clamp01((f - RAYS_B.on[0]) / (RAYS_B.on[1] - RAYS_B.on[0])));
  if (inB > 0) RAYS_B.at24.forEach((a0, i) => ray(g, b, hx, hy, r, a0 + RAYS_B.v * (f - 24), CUT_LEN.B * (0.55 + 0.45 * inB) * (0.93 + 0.07 * flick(i + 5, el)), CUT_LEN.WB, 0.95 * inB * flick(i, el) * T.out));
  const inC = ease(clamp01((f - RAYS_C.on[0]) / (RAYS_C.on[1] - RAYS_C.on[0])));
  if (inC > 0) RAYS_C.at24.forEach((a0, i) => ray(g, b, hx, hy, r, a0 + RAYS_C.v * (f - 24), CUT_LEN.C * (0.55 + 0.45 * inC), CUT_LEN.WC, 1.0 * inC * flick(i + 11, el) * T.out));
  const a = rayA();
  for (const R of RAYS_A) {
    const g0 = ease(clamp01((f - R.on) / 4));
    if (g0 <= 0) continue;
    ray(g, a, hx, hy, r, R.a + R.v * Math.max(0, f - R.s), CUT_LEN.A * (0.3 + 0.7 * g0), CUT_LEN.WA * (0.6 + 0.4 * g0), g0 * T.out);
  }
}
// The white disc behind the head (and the hot bloom round it at the start).
export function drawDisc(g, hx, hy, r, T) {
  if (T.out <= 0 || T.disc <= 0) return;
  const D = T.disc * r * 2 / CUT.DISC_TEX;
  blit(g, disc(), hx, hy, D, D, 0, T.out * T.discA, false);
  blit(g, disc(), hx, hy, D * (1.05 + 0.15 * T.bloom), D * (1.05 + 0.15 * T.bloom), 0, (0.1 + 0.15 * T.bloom) * T.out, true);
}
