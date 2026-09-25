// THE FX KIT — how a power effect is PAINTED, so it reads as Head Soccer's sprite art and not as
// canvas vector shapes.
//
// Why the old effects looked cheap: every piece was a flat, hard-edged canvas path in one colour
// (a stroked arc, a filled trapezoid, a 3 px dot), drawn fresh each frame, mostly with normal
// blending — on a half-resolution pixelated canvas. Head Soccer's effects are painted sprite
// animations: soft glows, white-hot cores fading through saturated colour to nothing, additive
// light, streaky motion-blur texture, flicker.
//
// So everything here is a TEXTURE painted once, OFFSCREEN, at load (per-pixel falloffs, noise,
// streaks, and a cheap downscale–upscale blur for bloom — no ctx.filter, no shadowBlur, both
// unreliable or slow on an iPhone), then BLITTED every frame with drawImage, mostly with
// 'lighter' (additive). A blit is a single textured quad: a whole comet, a ring of rays or a
// bolt costs one call. Flicker comes from picking another frame of a flipbook, not from
// re-rolling geometry.
//
// Legal: every texture is generated here by our own code. Nothing is traced or copied from Head
// Soccer; its footage was only studied for shapes, sizes, colours and timing.
//
// Node (the tests) has no canvas: textures come back as stubs with the right size and every
// draw call still goes through, so the recorder canvas counts the same calls the phone makes.

export const TAU = Math.PI * 2;
const DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
export const LIVE = DOM;

// ── surfaces and the cache ─────────────────────────────────────────────────────────────
export function surface(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (!DOM) return { width: w, height: h, stub: true };
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const ctx2d = (c) => { const x = c.getContext('2d'); x.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in x) x.imageSmoothingQuality = 'high'; return x; };
const CACHE = new Map();
// A texture by key: painted once by `paint(ctx, w, h)` (or returned as a stub in Node).
export function tex(key, w, h, paint) {
  let t = CACHE.get(key);
  if (t) return t;
  t = surface(w, h);
  if (!t.stub) paint(ctx2d(t), w, h, t);
  CACHE.set(key, t);
  return t;
}
// A flipbook: n frames of one texture (each painted with its own frame index).
export function book(key, n, w, h, paint) {
  let b = CACHE.get(key);
  if (b) return b;
  b = [];
  for (let i = 0; i < n; i++) { const t = surface(w, h); if (!t.stub) paint(ctx2d(t), w, h, i, t); b.push(t); }
  CACHE.set(key, b);
  return b;
}
export const cacheSize = () => CACHE.size;

// ── per-pixel painting ─────────────────────────────────────────────────────────────────
// fn(x, y, out) with x, y in texels; out = [r, g, b, a] (0–255, 0–1), straight alpha.
export function pix(g, w, h, fn) {
  const img = g.createImageData(w, h), d = img.data, o = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      o[0] = o[1] = o[2] = 255; o[3] = 0;
      fn(x, y, o);
      const i = (y * w + x) * 4, a = o[3] < 0 ? 0 : o[3] > 1 ? 1 : o[3];
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// ── a cheap, good blur: halve n times with smoothing, then double back up ──────────────
// Each halving roughly doubles the radius: n = 2 ≈ 3–4 px, 3 ≈ 7 px, 4 ≈ 14 px.
export function blurred(src, n) {
  if (src.stub || n <= 0) return src;
  const chain = [src];
  let cur = src;
  for (let i = 0; i < n; i++) {
    const c = surface(Math.max(1, cur.width / 2), Math.max(1, cur.height / 2));
    ctx2d(c).drawImage(cur, 0, 0, c.width, c.height);
    chain.push(c); cur = c;
  }
  for (let i = n - 1; i >= 0; i--) {
    const c = surface(chain[i].width, chain[i].height);
    ctx2d(c).drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  return cur;
}
// Bloom: the sharp painting plus blurred copies of itself added round it (core → halo → bloom).
// layers: [[blurLevels, alpha, tint?], …]; a tint recolours that glow (warm halo round a white core).
export function bloom(g, sharp, layers, w, h) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [n, a, tint] of layers) {
    let b = blurred(sharp, n);
    if (tint) {
      const c = surface(w, h), x = ctx2d(c);
      x.drawImage(b, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = tint; x.fillRect(0, 0, w, h);
      b = c;
    }
    g.globalAlpha = a; g.drawImage(b, 0, 0, w, h);
  }
  g.globalAlpha = 1; g.drawImage(sharp, 0, 0, w, h);
  g.restore();
}

// ── noise ──────────────────────────────────────────────────────────────────────────────
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (f) => f * f * (3 - 2 * f);
// 1-D value noise over [0, n), wrapping; returns 0..1
export function noise1(seed, n = 256) {
  const r = rng(seed), v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = r();
  return (x) => { x = ((x % n) + n) % n; const i = Math.floor(x), f = smooth(x - i); return v[i] + (v[(i + 1) % n] - v[i]) * f; };
}
// 2-D value noise, wrapping on an n grid; returns 0..1
export function noise2(seed, n = 64) {
  const r = rng(seed), v = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) v[i] = r();
  return (x, y) => {
    x = ((x % n) + n) % n; y = ((y % n) + n) % n;
    const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j), i1 = (i + 1) % n, j1 = (j + 1) % n;
    const a = v[j * n + i], b = v[j * n + i1], c = v[j1 * n + i], d = v[j1 * n + i1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
export function fbm(nz, x, y, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += nz(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; } return s / t; }
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ── drawing ────────────────────────────────────────────────────────────────────────────
// One textured quad: centred on (x, y) by default (ax, ay = the anchor in the texture, 0–1),
// w × h world px, turned by `rot`, additive unless add = false.
export function blit(g, t, x, y, w, h, rot = 0, a = 1, add = true, ax = 0.5, ay = 0.5) {
  if (!(a > 0.004) || !(w > 0) || !(h > 0)) return;
  g.save();
  if (add) g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a > 1 ? 1 : a;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(t, -w * ax, -h * ay, w, h);
  g.restore();
}
// A sprite stretched from its head (hx, hy) back along the heading (ux, uy): the texture's right
// edge is the head. `len` long, `wid` across.
export function beamBlit(g, t, hx, hy, ux, uy, len, wid, a = 1, add = true, nose = 0) {
  blit(g, t, hx, hy, len, wid, Math.atan2(uy, ux), a, add, 1 - nose, 0.5);
}

// ── the shared textures ────────────────────────────────────────────────────────────────
// GLOW: a soft round light, white-hot in the middle, `rgb` round it, falling to nothing.
export function glow(col, hot = 0.35) {
  const c = hex(col);
  return tex(`glow${col}${hot}`, 64, 64, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
    const core = Math.exp(-d * d / (hot * hot * 0.25 + 1e-4));
    o[0] = mix(c[0], 255, core); o[1] = mix(c[1], 255, core); o[2] = mix(c[2], 255, core);
    o[3] = Math.exp(-d * d * 5) * (1 - sstep(0.8, 1, d));
  }));
}
// SPARK: a spear of light, its head at the right edge, tapering back to a point, white core.
export function spark(col) {
  const c = hex(col);
  return tex(`spark${col}`, 128, 32, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const u = (x + 0.5) / w, v = ((y + 0.5) / h) * 2 - 1;
    const along = u < 0.82 ? Math.pow(u / 0.82, 1.4) : 1 - Math.pow((u - 0.82) / 0.18, 2);
    const sig = 0.1 + 0.32 * Math.sqrt(Math.max(0, along));
    const a = Math.exp(-(v * v) / (sig * sig)) * Math.max(0, along);
    const core = sstep(0.45, 0.85, a);
    o[0] = mix(c[0], 255, core); o[1] = mix(c[1], 255, core); o[2] = mix(c[2], 255, core); o[3] = a;
  }));
}
// RING: a soft ring of light (a shockwave / pop), radius 0.78 of the texture.
export function ring(col) {
  const c = hex(col);
  return tex(`ring${col}`, 128, 128, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const d = Math.hypot(x + 0.5 - 64, y + 0.5 - 64) / 64, e = (d - 0.78) / 0.07;
    const a = Math.exp(-e * e) + 0.25 * Math.exp(-(((d - 0.72) / 0.18) ** 2)) * (d < 0.78 ? 1 : 0);
    const core = sstep(0.6, 1, Math.exp(-e * e * 4));
    o[0] = mix(c[0], 255, core); o[1] = mix(c[1], 255, core); o[2] = mix(c[2], 255, core); o[3] = Math.min(1, a);
  }));
}
// SMOKE: a soft, noisy puff (4 variants), grey-white, lit from the top.
export function smoke(i = 0, col = '#eef0f6') {
  const c = hex(col);
  return book(`smoke${col}`, 4, 96, 96, (g, w, h, k) => {
    const nz = noise2(101 + k * 17, 32);
    pix(g, w, h, (x, y, o) => {
      const dx = (x + 0.5 - 48) / 48, dy = (y + 0.5 - 48) / 48, d = Math.hypot(dx, dy);
      const n = fbm(nz, x / 12 + k * 5, y / 12, 4);
      const edge = 1 - sstep(0.35 + 0.45 * n, 0.95, d);
      const lit = 0.72 + 0.28 * clamp01(0.6 - dy * 0.6 + (n - 0.5));
      o[0] = c[0] * lit; o[1] = c[1] * lit; o[2] = c[2] * lit;
      o[3] = edge * (0.55 + 0.45 * n);
    });
  })[i & 3];
}
// GHOST BALL: a motion-blurred after-image of the ball (pale, soft, a hint of its panels).
export function ghostBall() {
  return tex('ghostball', 64, 64, (g, w, h) => {
    const s = surface(w, h), x = ctx2d(s);
    x.fillStyle = '#f4f7ff'; x.beginPath(); x.arc(32, 32, 20, 0, TAU); x.fill();
    x.fillStyle = '#9aa6bf';
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - 1.3; x.beginPath(); x.arc(32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14, 5, 0, TAU); x.fill(); }
    x.beginPath(); x.arc(32, 32, 6, 0, TAU); x.fill();
    g.drawImage(blurred(s, 2), 0, 0);
  });
}

// BOLT: a lightning bolt, left to right across the texture, forked, bloomed — `n` variants.
// Drawn stretched between two points with boltBlit.
export function bolts(col = '#ffe94a', core = '#fffef0', n = 8, seed = 7) {
  return book(`bolt${col}${core}${seed}`, n, 256, 64, (g, w, h, k) => {
    const r = rng(seed * 97 + k * 131);
    const pts = [[6, 32], [250, 32]];
    // midpoint displacement
    for (let lvl = 0, amp = 18; lvl < 5; lvl++, amp *= 0.55) {
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i - 1], b = pts[i];
        pts.splice(i, 0, [(a[0] + b[0]) / 2 + (r() - 0.5) * amp * 0.4, (a[1] + b[1]) / 2 + (r() - 0.5) * amp * 2]);
      }
    }
    for (const p of pts) p[1] = 32 + (p[1] - 32) * Math.sin(Math.PI * clamp01(p[0] / 256)) ;
    const branches = [];
    for (let b = 0; b < 2; b++) {
      const i0 = 4 + Math.floor(r() * (pts.length - 12)), p0 = pts[i0], sgn = r() < 0.5 ? -1 : 1;
      const br = [p0.slice()];
      let x = p0[0], y = p0[1];
      for (let s = 0; s < 6; s++) { x += 6 + r() * 8; y += sgn * (2 + r() * 5) + (r() - 0.5) * 6; br.push([x, y]); }
      branches.push(br);
    }
    const s = surface(w, h), x = ctx2d(s);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const line = (P, lw, col2) => { x.strokeStyle = col2; x.lineWidth = lw; x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); };
    line(pts, 7, col); for (const b of branches) line(b, 4.5, col);
    line(pts, 2.8, core); for (const b of branches) line(b, 1.8, core);
    bloom(g, s, [[1, 0.8, col], [2, 1, col], [3, 0.8, col], [4, 0.5, col]], w, h);
  });
}
export function boltBlit(g, bk, x1, y1, x2, y2, wid, a = 1, pick = Math.random()) {
  const t = bk[Math.floor(pick * bk.length) % bk.length];
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  if (L < 2) return;
  blit(g, t, (x1 + x2) / 2, (y1 + y2) / 2, L * 1.05, wid, Math.atan2(dy, dx), a, true);
}

// ── THE ARMED GLOW (HS §1, M4 36.49–36.90 s full-res, every frame) ─────────────────────
// The frame after POWER the player is wrapped in bright yellow electric FLAME LICKS: 3–5 thick
// flowing S-curves with white-hot cores, rising off the sides of the head and body and over the
// crown (about a head tall), some ending in a hot blob, all with a soft yellow bloom; a yellow
// glow hugs the whole silhouette and lights the edge of the hair. They are redrawn every other
// frame (≈ 30 Hz), so it crackles — no pulse, no ring.
export const ARMED = { SLOTS: 6, HZ: 30 };
export function licks() {
  return book('licks', 12, 96, 192, (g, w, h, k) => {
    const r = rng(900 + k * 53);
    const s = surface(w, h), x = ctx2d(s);
    const blob = k % 4 === 3;                           // a hot blob on a thin stalk
    const N = 30, cx = w / 2, bot = h - 18, top = 18 + r() * 22;
    const A = (8 + r() * 8) * (r() < 0.5 ? -1 : 1), ph = r() * 1.2, fq = 1.2 + r() * 0.8, hook = (r() - 0.5) * 22;
    const Wm = blob ? 5 : 9 + r() * 4;
    const P = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = bot - (bot - top) * t;
      const xx = cx + A * Math.sin(t * Math.PI * fq + ph) * (0.3 + 0.9 * t) + hook * t * t * t;
      // fat low down, tapering to a flicking point (a flame lick), or a stalk with a hot blob
      let wd = Wm * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.6) * (1.1 - 0.55 * t);
      if (blob) wd = Wm * 0.7 * Math.sin(Math.PI * Math.min(1, t)) + 11 * Math.exp(-(((t - 0.82) / 0.1) ** 2));
      P.push([xx, y, wd]);
    }
    const shape = (k2) => {
      x.beginPath();
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const p = P[i]; x.lineTo(p[0] + nx * p[2] * k2, p[1] + ny * p[2] * k2);
      }
      for (let i = P.length - 1; i >= 0; i--) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const p = P[i]; x.lineTo(p[0] - nx * p[2] * k2, p[1] - ny * p[2] * k2);
      }
      x.closePath();
    };
    x.fillStyle = '#ffd900'; shape(1); x.fill();
    x.fillStyle = '#fff47a'; shape(0.72); x.fill();
    x.fillStyle = '#ffffff'; shape(0.42); x.fill();
    bloom(g, s, [[1, 0.8, '#fff04a'], [2, 1, '#ffd800'], [3, 0.85, '#ffc400'], [4, 0.5, '#ffae00']], w, h);
  });
}
// The silhouette glow: the head's own cartoon outline (game.js HEAD_SHAPE: 1.17 × 1.07 of the
// hitbox, a dome on top, full cheeks) — a bright rim just on its edge and a yellow glow out
// from it (the body gets a soft glow of its own in drawArmedGlow).
export const HEAD_W = 1.17, HEAD_H = 1.07;
function headDist(dx, dy) {
  // signed distance (in head radii) to the head's superellipse outline, approximated radially
  const a = Math.atan2(dy, dx), c = Math.cos(a), s = Math.sin(a);
  const n = s < 0 ? 2.1 : 2.9;
  const ex = Math.sign(c) * Math.abs(c) ** (2 / n), ey = Math.sign(s) * Math.abs(s) ** (2 / n);
  const R = Math.hypot(ex * HEAD_W * (1 - 0.1 * Math.max(0, ey) ** 2), ey * HEAD_H * (ey < 0 ? 1.12 : 0.88));
  return Math.hypot(dx, dy) - R;
}
export function headPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * TAU, c = Math.cos(t), s = Math.sin(t), n = s < 0 ? 2.1 : 2.9;
    let u = Math.sign(c) * Math.abs(c) ** (2 / n);
    const v = Math.sign(s) * Math.abs(s) ** (2 / n);
    u *= 1 - 0.1 * Math.max(0, v) ** 2;
    const px = 0.5 + u / 2, py = 0.56 + v * (v < 0 ? 0.56 : 0.44);
    g.lineTo(x + (px - 0.5) * 2 * r * HEAD_W, y + (py - 0.5) * 2 * r * HEAD_H);
  }
  g.closePath();
}
export function auraTex(col = '#ffd21a') {
  const c = hex(col);
  // 2.4 head radii across; the texture is 128 px, so 1 head radius = 128 / 4.8 texels
  return tex(`aura${col}`, 128, 128, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const R = w / 4.8, d = headDist((x + 0.5 - w / 2) / R, (y + 0.5 - h / 2) / R + 0.06);
    const out = d > 0 ? Math.exp(-d / 0.2) * 0.95 + 0.35 * Math.exp(-d / 0.55) : Math.exp(d / 0.07);
    const rim = Math.exp(-(((d + 0.02) / 0.06) ** 2));
    o[0] = mix(c[0], 255, rim); o[1] = mix(c[1], 250, rim); o[2] = mix(c[2], 130, rim);
    // strongest down the sides (where the licks root), weakest over the crown (M4 36.5–36.9 s)
    const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2, sides = Math.abs(dx) / (Math.hypot(dx, dy) || 1);
    const k = dy < 0 ? 0.35 + 0.65 * sides : 0.75 + 0.25 * sides;
    o[3] = Math.min(1, out * (d > 0 ? 1 : 0.8) + rim * 0.3) * k * (1 - sstep(0.9, 1, Math.hypot(dx, dy) / (w / 2)));
  }));
}
// The whole press look at one player: head centre (hx, hy), radius r, feet (fx, fy), now t.
// `col` recolours it (HS's is yellow for every character).
const LICK_SLOTS = [
  // [x (head radii from the head centre), y of its root, height (r), lean (rad)]
  [-1.2, 0.5, 2.2, -0.12], [1.2, 0.45, 2.15, 0.12],             // up the sides of the head
  [-0.95, -0.45, 1.6, -0.5], [0.95, -0.5, 1.55, 0.52],          // off the upper sides, curling out
  [-1.0, 1.7, 1.5, -0.2], [1.02, 1.7, 1.5, 0.2],                // beside the body
];
export function drawArmedGlow(g, hx, hy, r, fx, fy, t, seed = 0) {
  const f = Math.floor(t * ARMED.HZ);
  const R = rng(f * 7919 + seed * 104729);
  const flick = 0.82 + 0.18 * R();
  // the silhouette glow (head and body)
  blit(g, auraTex(), hx, hy, r * 4.8, r * 4.8, 0, flick * 0.8, true);
  const bh = fy - (hy + r * 0.85);
  if (bh > 4) blit(g, glow('#ffd21a', 0.02), fx, fy - bh / 2, r * 2.6, bh * 2.6, 0, flick * 0.55, true);
  // the flame licks: most slots lit, each with its own frame, mirror, size and lean
  const bk = licks();
  let lit = 0;
  for (let i = 0; i < LICK_SLOTS.length; i++) {
    const s = LICK_SLOTS[i];
    if (R() < 0.3 && lit >= 3) continue;
    lit++;
    const k = Math.floor(R() * bk.length), H = r * s[2] * (0.8 + 0.35 * R()), W = H * 0.5;
    const x = hx + s[0] * r + (R() - 0.5) * r * 0.2, y = hy + s[1] * r;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.8 + 0.2 * R();
    g.translate(x, y); g.rotate(s[3] + (R() - 0.5) * 0.25);
    if (R() < 0.5) g.scale(-1, 1);
    g.drawImage(bk[k], -W / 2, -H * 0.91, W, H);
    g.restore();
  }
}

// ── THE STUNNED STARS (HS §4, M4 80.85 s, M3 74.1 s full-res) ──────────────────────────
// Three chunky, puffy gold five-point stars (≈ 0.75 head radii across), lit from the top left,
// a thin dark keyline, orbiting a thin glowing yellow ellipse over the crown; the far side of
// the orbit smaller and behind.
export function starTex() {
  return tex('star', 64, 64, (g, w, h) => {
    const path = (x, cx, cy, R, k) => {
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? R * k : R;
        const p = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
        const a2 = -Math.PI / 2 + ((i + 1) / 10) * TAU, rr2 = (i + 1) % 2 ? R * k : R;
        const q = [cx + Math.cos(a2) * rr2, cy + Math.sin(a2) * rr2];
        if (!i) x.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        else x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      const p = [cx + Math.cos(-Math.PI / 2) * R, cy - R];
      const q = [cx + Math.cos(-Math.PI / 2 + TAU / 10) * R * k, cy + Math.sin(-Math.PI / 2 + TAU / 10) * R * k];
      x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      x.closePath();
    };
    g.lineJoin = 'round';
    path(g, 32, 34, 28, 0.5); g.fillStyle = '#5a3200'; g.fill();          // keyline
    path(g, 32, 33.5, 25, 0.5);
    const lg = g.createLinearGradient(14, 10, 48, 56);
    lg.addColorStop(0, '#fff7a8'); lg.addColorStop(0.35, '#ffd92e'); lg.addColorStop(0.75, '#f5a800'); lg.addColorStop(1, '#c97200');
    g.fillStyle = lg; g.fill();
    path(g, 30, 30, 15, 0.5);
    const hg = g.createRadialGradient(26, 22, 1, 28, 26, 16);
    hg.addColorStop(0, 'rgba(255,255,235,0.95)'); hg.addColorStop(1, 'rgba(255,245,160,0)');
    g.fillStyle = hg; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(24, 20, 4, 2.6, -0.6, 0, TAU); g.fill();
  });
}
export function orbitTex() {
  return tex('orbit', 128, 48, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const dx = (x + 0.5 - 64) / 58, dy = (y + 0.5 - 24) / 17, d = (Math.hypot(dx, dy) - 1) * 17;
    const a = Math.exp(-(d * d) / 1.4) + 0.35 * Math.exp(-(d * d) / 10);
    o[0] = 255; o[1] = mix(214, 250, Math.exp(-d * d)); o[2] = mix(60, 190, Math.exp(-d * d)); o[3] = a;
  }));
}
export function drawStars(g, cx, cy, r, t, a = 1) {
  const rx = r * 1.08, ry = r * 0.3;
  blit(g, orbitTex(), cx, cy, rx * 2.2, ry * 2 * 1.4, 0, 0.75 * a, true);
  const st = starTex();
  const order = [0, 1, 2].map((k) => { const an = t * 7 + k * TAU / 3; return { an, z: (Math.sin(an) + 1) / 2 }; }).sort((p, q) => p.z - q.z);
  for (const s of order) {
    const S = r * (0.78 + 0.34 * s.z);
    blit(g, st, cx + Math.cos(s.an) * rx, cy + Math.sin(s.an) * ry, S, S, Math.sin(t * 5 + s.an) * 0.25, a * (0.75 + 0.25 * s.z), false);
  }
}

// ── BEAM: the filmed comet's anatomy as a parametrized painted streak ──────────────────
// A white-hot rounded nose on the ball fading back through `mid` to `edge`, streaked with fine
// motion-blur lines, the streaks running out ragged. The texture's right edge is the nose; the
// ball sits `nose` world px behind it. o = { L, H (world px), D (texels a px), mid, edge, core
// (0–1 how far back the white reaches), streak (0–1), fan (how much wider it gets behind) }.
export function beam(key, o) {
  const L = o.L, H = o.H, D = o.D || 1.5, mid = hex(o.mid), edge = hex(o.edge);
  const R0 = H * (o.head || 0.25), core = o.core ?? 0.45, fan = o.fan ?? 1.7, str = o.streak ?? 0.8, n = o.frames || 2;
  return book(`beam-${key}`, n, Math.ceil(L * D), Math.ceil(H * D), (g, w, h, k) => {
    const n1 = noise1(300 + k * 13, 512), n2 = noise1(420 + k * 29, 512), n3 = noise1(510 + k * 7, 512);
    pix(g, w, h, (x, y, px) => {
      const u = L - (x + 0.5) / D, v = (y + 0.5) / D - H / 2, f = u / L;
      const half = u < R0 ? Math.sqrt(Math.max(0, R0 * R0 - (R0 - u) * (R0 - u))) : R0 * (1 + (fan - 1) * sstep(0, 0.45, f - R0 / L)) * (1 - 0.45 * sstep(0.5, 1, f));
      if (half < 0.4) return;
      const q = Math.abs(v) / half;
      if (q > 1.2) return;
      const wc = 0.88 * Math.exp(-((Math.max(0, f - 0.04) / core) ** 2));
      const s = 0.6 * n1(v * 0.5 * (40 / H) * 1.2 + 50) + 0.4 * n2(v * 1.3 * (40 / H) + 20);
      const amt = sstep(0.05, 0.5, f) * str;
      const streak = mix(1, 0.4 + 0.8 * s, amt);
      const end = 0.72 + 0.26 * n3(v * 0.3 * (40 / H) + 5);
      const fade = 1 - sstep(end - 0.25, end, f);
      const cr = 1 - sstep(wc - 0.25, wc + 0.08, q), ed = 1 - sstep(0.62, 1.12, q);
      const t = clamp01((q - wc) / Math.max(0.05, 1 - wc));
      const c0 = mid.map((a, i) => mix(a, edge[i], sstep(0.25, 1, t)));
      const wht = Math.max(cr, sstep(0.75, 0.97, s) * amt * 0.5);
      px[0] = mix(c0[0], 255, wht); px[1] = mix(c0[1], 255, wht); px[2] = mix(c0[2], 255, wht);
      px[3] = Math.max(cr, ed * 0.9 * streak) * fade;
    });
  });
}

// ── WHIRL: a whirlwind funnel, 8 frames of one turn ────────────────────────────────────
// Narrow at the foot, flaring to the top; its body a translucent spinning cylinder of dust —
// helical bands wrapping round it, fine turbulent grain, the silhouette edges denser than the
// middle (you look through the thin front and back), soft top and foot. `light`/`dark` its dust.
// Drawn with its foot at the texture's bottom centre.
export function whirl(key = 'sand', light = '#efe6d2', dark = '#7d6c52', n = 8) {
  const L = hex(light), Dk = hex(dark);
  return book(`whirl-${key}`, n, 160, 200, (g, w, h, k) => {
    const nz = noise2(700, 64), ph = k / n;
    pix(g, w, h, (x, y, o) => {
      const f = (y + 0.5) / h;                                   // 0 top → 1 foot
      const W = 0.13 + 0.85 * Math.pow(1 - f, 1.8) + 0.045 * Math.sin(f * 11 + ph * TAU) * (1.2 - f);
      const cx = 0.5 + 0.08 * Math.sin(f * 5 + 1 + ph * TAU * 0.5) * (1 - f * 0.7);
      const xn = ((x + 0.5) / w - cx) / (W * 0.5);
      if (Math.abs(xn) > 1.06) return;
      const th = Math.asin(Math.max(-1, Math.min(1, xn)));      // angle round the cylinder
      const turn = th / TAU + ph;                                // spinning: the angle advances
      const band = 0.5 + 0.5 * Math.sin((turn * 3 + f * 2.2) * TAU);
      const grain = fbm(nz, turn * 16 + 3, f * 22, 4);
      const streaks = fbm(nz, turn * 40, f * 5 + 9, 3);
      const limb = 0.3 + 0.7 * Math.pow(Math.abs(xn), 3);
      // thin bright swirl lines wrapping helically round it
      const fr = (turn * 2 + f * 3.4) % 1, line = Math.exp(-((((fr < 0 ? fr + 1 : fr) - 0.5) / 0.035) ** 2)) * (0.5 + 0.5 * streaks);
      const side = 0.5 - 0.5 * xn;                               // lit from the left
      const lit = clamp01(0.2 + 0.42 * band + 0.55 * (streaks - 0.5) + 0.3 * (grain - 0.5) + 0.25 * side + 0.15 * (1 - f) + 0.6 * line);
      const edge = 1 - sstep(0.88, 1.06, Math.abs(xn) + 0.12 * (grain - 0.5));
      // a ragged, cloudy top (never a cut edge) and a soft foot
      const ends = sstep(0.02, 0.2, f + 0.22 * (grain - 0.5) + 0.06 * Math.sin(turn * TAU * 3)) * (1 - sstep(0.93, 1, f));
      o[0] = mix(Dk[0], L[0], lit); o[1] = mix(Dk[1], L[1], lit); o[2] = mix(Dk[2], L[2], lit);
      o[3] = clamp01((0.62 + 0.45 * limb) * (0.7 + 0.5 * grain) * (0.8 + 0.3 * band) + line * 0.4) * edge * ends;
    });
  });
}

// ── THE BLOCK'S ORB (HS §4, M4 61.55–61.80 s full-res) ─────────────────────────────────
// A translucent pale-yellow bubble ≈ 27 px round the ball, a bright rim, a white-hot heart;
// yellow spears of light shoot out of it the whole grind (champ-vfx's shards).
export function bubble() {
  return tex('bubble', 96, 96, (g, w, h) => pix(g, w, h, (x, y, o) => {
    const d = Math.hypot(x + 0.5 - 48, y + 0.5 - 48) / 40;
    const rim = Math.exp(-(((d - 0.93) / 0.07) ** 2));
    const fill = d < 0.95 ? 0.38 + 0.22 * d * d : 0;
    const heart = 0.6 * Math.exp(-((d / 0.3) ** 2));
    const halo = d > 0.93 ? 0.35 * Math.exp(-(d - 0.93) / 0.08) : 0;
    const wht = clamp01(heart * 1.2 + rim * 0.5);
    o[0] = 255; o[1] = mix(232, 255, wht); o[2] = mix(90, 235, wht);
    o[3] = clamp01(fill + rim * 0.8 + heart * 0.9 + halo);
  }));
}
