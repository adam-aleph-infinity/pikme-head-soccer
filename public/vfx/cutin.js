// THE CUT-IN'S LIGHT — the white disc behind the shooter's head, its golden halo ring and the
// sixteen rays, as painted textures (public/vfx/fx-kit.js).
//
// Measured frame by frame off M4 40.36–40.66 s and 41.2 s at full resolution (2 frame px a world
// px; docs/HS-POWER-SHOTS.md §2):
//   • the DISC: solid white to ≈ 45 px (1.7 head radii) round the head, a soft gold falloff to
//     ≈ 60 px — the head and body sit on it;
//   • the HALO: a golden ring ≈ 82 px out (3.1 r), ≈ 14 px thick, made of fine radial striations,
//     brightest on its inner edge, with thin white-gold sparkle spikes crossing it;
//   • EIGHT GOLD RAYS: narrow and hot at the disc (≈ 4 px), widening to ≈ 22 px, a white core
//     line down the middle, still bright at ≈ 230 px;
//   • EIGHT SOFT RAYS between them: wide (≈ 50 px at the end), pale cream, translucent and
//     streaky like radial motion blur, ≈ 190 px;
//   • all of it turning slowly (≈ 0.5 rad/s), the rays flickering in length, additive.
import { tex, pix, bloom, surface, blit, rng, noise1, sstep, mix, clamp01, TAU } from './fx-kit.js';

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
    const streak = 0.45 + 0.4 * n(q * 26 + 40) + 0.25 * n2(q * 60 + 9 + u * 3);
    const along = sstep(0, 0.12, u) * (1 - sstep(0.4, 1, u));
    o[0] = 255; o[1] = mix(214, 246, Math.exp(-q * q * 6)); o[2] = mix(120, 212, Math.exp(-q * q * 6));
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

// jitter per ray, fixed (HS's rays are not a perfect clock face)
const JIT = (() => { const r = rng(1234); return Array.from({ length: 16 }, () => [(r() - 0.5) * 0.14, 0.85 + r() * 0.3, r() * TAU]); })();

// The light at the head (hx, hy), radius r, `el` s into the cut-in; `glow` its strength (0–1),
// `grow` how far the rays have grown in (0–1). The DISC is separate (drawDisc) so a caller can
// put the shooter's body over it.
export function drawRays(g, hx, hy, r, el, glow, grow) {
  const k = r / 26.4;
  const rot = el * 0.5;
  // the halo ring (two frames, alternating ≈ 15 Hz, turning the other way a touch slower)
  const H = CUT.HALO * 2 / CUT.HALO_TEX * k * (0.85 + 0.15 * grow);
  blit(g, halo(Math.floor(el * 15) & 1), hx, hy, H, H, -el * 0.3, glow * 0.72, true);
  const gr = goldRay(), sr = softRay();
  for (let i = 0; i < 16; i++) {
    const [ja, jl, jp] = JIT[i];
    const gold = i % 2 === 0, a = rot + (i / 16) * TAU + ja;
    const fl = 0.88 + 0.12 * Math.sin(el * 9 + jp);
    const L = (gold ? CUT.GOLD_L : CUT.SOFT_L) * k * jl * fl * grow, W = (gold ? CUT.GOLD_W : CUT.SOFT_W) * k * (0.7 + 0.3 * grow);
    const r0 = CUT.R0 * k;
    // the texture's left edge is the ray's root at the disc; anchor it there
    blit(g, gold ? gr : sr, hx + Math.cos(a) * r0, hy + Math.sin(a) * r0, L, W, a, glow * (gold ? 1 : 0.62), true, 0, 0.5);
  }
}
export function drawDisc(g, hx, hy, r, glow, grow) {
  const k = r / 26.4, D = CUT.DISC * 2 / CUT.DISC_TEX * k * (0.8 + 0.2 * grow);
  blit(g, disc(), hx, hy, D, D, 0, glow, false);
  blit(g, disc(), hx, hy, D * 1.15, D * 1.15, 0, glow * 0.35, true);
}
