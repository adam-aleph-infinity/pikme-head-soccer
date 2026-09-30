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

// ── THE ARMED GLOW (HS §1: M4 36.5–36.9, 39.6–40.2 and 122.0–122.4 s, M3 71.0–71.6 s, full-res,
// every frame) ──────────────────────────────────────────────────────────────────────────────
// From the frame after POWER until the touch, the WHOLE character — head and body, down to the
// boots — sits in a yellow glow that hugs its silhouette (the same on every character: it follows
// a square head in M3 as it follows a round one in M4): white-hot right on the edge, saturated
// yellow ≈ 0.15 head radii out, fading by ≈ 0.5 — strongest down the sides and round the body,
// weaker over the crown. It is BEHIND the sprite: the face and the black suit are never washed.
// Over it crackle THIN electric wisps (≈ 0.1 head radii across, white core, yellow body, bloom):
// two or three rising off the upper corners of the head, a head or so tall, S- and C-curved, some
// forked or ending in a hot comma; a long thin crescent down each side, hugging the outline from
// the temple to the boots; and a brighter flare at the lower cheek and body. A whole new set every
// ≈ 3 frames (20 Hz), so it crackles — no pulse, no ring. (The DOM head adds the thin rim on its
// real hair line: style.css .head.armed.)
export const ARMED = { HZ: 20, FRAMES: 16 };
// The silhouette glow: the head's own cartoon outline (game.js HEAD_SHAPE: 1.28 × 1.04 of the
// hitbox, a dome on top, full cheeks) — a bright rim just on its edge and a yellow glow out
// from it (the body gets a soft glow of its own in drawArmedGlow).
export const HEAD_W = 1.28, HEAD_H = 1.04;   // game.js HEAD_W/HEAD_H (keep the two in step)
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
// The press look is painted in one box round the player, in head radii from the head centre
// (y down): the head's own outline (headPath) and the body's box under it down to the feet at
// y = kb, so the glow and the wisps sit on the silhouette the player actually has.
const AB = { L: 2.1, T: 2.35, B: 0.55, TX: 48 };        // box: ±L across, T above, B under the feet; TX texels a radius
const headPoly = () => {
  const P = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * TAU, c = Math.cos(t), s = Math.sin(t), n = s < 0 ? 2.1 : 2.9;
    let u = Math.sign(c) * Math.abs(c) ** (2 / n);
    const v = Math.sign(s) * Math.abs(s) ** (2 / n);
    u *= 1 - 0.1 * Math.max(0, v) ** 2;
    P.push([u * HEAD_W, (0.06 + v * (v < 0 ? 0.56 : 0.44)) * 2 * HEAD_H]);
  }
  return P;
};
const HEAD_POLY = headPoly();
function polyDist(P, x, y) {
  let d = Infinity, inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [bx, by] = P[i], ex = bx - ax, ey = by - ay;
    const h = clamp01(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(x - ax - ex * h, y - ay - ey * h));
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) / (by - ay)) * ex) inside = !inside;
  }
  return inside ? -d : d;
}
// the body under the chin: the suit and the boots (body-art.js), a rounded box ±0.64 across
function bodyDist(x, y, kb) {
  const top = 0.45, bot = kb - 0.02, rr = 0.26, hx = 0.64 - rr, hy = (bot - top) / 2 - rr;
  const qx = Math.abs(x) - hx, qy = Math.abs(y - (top + bot) / 2) - hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
}
const kbKey = (kb) => Math.round(Math.min(2.2, Math.max(1.2, kb)) * 10) / 10;
// THE SILHOUETTE GLOW (behind the sprite): nothing inside the body (its layer is under this
// one), a little way inside the head's outline (the DOM head covers it) so the edge never gaps.
export function armedGlowTex(kb) {
  kb = kbKey(kb);
  const w = Math.ceil(2 * AB.L * AB.TX), h = Math.ceil((AB.T + kb + AB.B) * AB.TX);
  return tex(`armedGlow${kb}`, w, h, (g) => pix(g, w, h, (x, y, o) => {
    const X = (x + 0.5) / AB.TX - AB.L, Y = (y + 0.5) / AB.TX - AB.T;
    const dh = polyDist(HEAD_POLY, X, Y), db = bodyDist(X, Y, kb), d = Math.min(dh, db);
    // the head: bright right on its edge; the body (its boots move, so its box is only roughly
    // the drawn one): soft, with no edge of its own to show
    const fall = (q) => Math.exp(-q / 0.1) + 0.85 * Math.exp(-q / 0.28) + 0.3 * Math.exp(-q / 0.6);
    const ah = dh < 0 ? Math.exp(dh / 0.04) : fall(dh);
    const ab = db < 0 ? 0 : (0.75 * Math.exp(-db / 0.2) + 0.35 * Math.exp(-db / 0.55)) * sstep(0, 0.12, db);
    let a = db < 0 ? 0 : Math.max(ah, ab);
    // weaker over the crown, full down the sides and round the body
    const side = Math.abs(X) / (Math.hypot(X, Y + 0.1) || 1);
    a *= Y < -0.2 ? 0.6 + 0.4 * side : 1 + 0.3 * sstep(-0.2, 0.6, Y);
    const t = sstep(0, 0.3, Math.max(0, d));
    o[0] = 255; o[1] = mix(250, 226, t); o[2] = mix(190, 20, sstep(0, 0.1, Math.max(0, d)));
    o[3] = Math.min(1, a) * (1 - sstep(0.9, 1, Math.max(Math.abs(X) / AB.L, 0)));
  }));
}
// THE SIDE FLAMES — MEASURED (tools/hs-glow-measure.mjs on M4 37.85–39.3 s, 87 frames at 60 fps,
// the flame's light cut out from the stadium and mapped round the head in head radii; ours is
// measured the same way from the game, `node _powers-hq.mjs glow`). On each side, mirrored:
//   · a LOWER flame: broad and solid, from the feet (≈ 1.8 under the head centre) up the outside
//     of the cheek to about eye level, ≈ 0.9 wide at its base, standing ≈ 1.0–1.9 out;
//   · an UPPER flame: from the head's upper corner up to ≈ 2.1 over the centre, ≈ 0.7 wide,
//     nearly upright, ≈ 0.6–1.6 out;
//   · the two keep flowing together into one and apart (Idan: a second each);
//   · real fire: its edges torn by noise that scrolls UP through it, so the shapes flow upward and
//     change fast (HS: 79 % of the flame still there a frame later, 47 % after 3, 22 % after 8),
//     and it swells and shrinks (area ± 40 %).
// Painted once, per pixel, as a looping flipbook (FLM.N frames over FLM.LOOP s; the noise wraps,
// so the loop is seamless). Units: head radii from the head centre, the right side (+X out).
export const FLM = { N: 60, LOOP: 2, X0: 0.3, X1: 2.4, Y0: -2.6, Y1: 2.1, TX: 40, LINE: 0.17 };
const FLAME_LO = { base: [0.82, 1.7], tip: [0.98, -0.35], hw: 0.42, pow: 0.5, bow: 0.18, flow: 0.6 };  // flow: it moves all the way down
const FLAME_HI = { base: [0.72, -0.55], tip: [0.98, -2.1], hw: 0.3, pow: 0.7, bow: 0.12, flow: 0.6 };
// Painting all FLM.N frames at once is ≈ 2 s on a Mac (much more on a phone), so the frames are
// painted ONE AT A TIME — in the idle slices after load (sideFlameJobs, champ-vfx warmTextures) or,
// if one is needed before that, when it is first drawn. The head's distance map is the same for
// every frame and is worked out once.
const SFB = { frames: null, dh: null };
export function sideFlame() {
  const T = FLM.TX, w = Math.ceil((FLM.X1 - FLM.X0) * T), h = Math.ceil((FLM.Y1 - FLM.Y0) * T);
  if (!SFB.frames) SFB.frames = new Array(FLM.N).fill(null);
  if (!DOM) { for (let k = 0; k < FLM.N; k++) SFB.frames[k] ||= surface(w, h); return SFB.frames; }
  return SFB.frames;
}
export const sideFlameJobs = () => Array.from({ length: FLM.N }, (_, k) => () => sideFlameFrame(k));
export function sideFlameFrame(k) {
  const fr = sideFlame();
  if (fr[k]) return fr[k];
  const T = FLM.TX, w = Math.ceil((FLM.X1 - FLM.X0) * T), h = Math.ceil((FLM.Y1 - FLM.Y0) * T);
  if (!SFB.dh) {
    SFB.dh = new Float32Array(w * h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) SFB.dh[py * w + px] = polyDist(HEAD_POLY, FLM.X0 + (px + 0.5) / T, FLM.Y0 + (py + 0.5) / T);
  }
  const nA = noise2(501, 16), nB = noise2(733, 16), nS = noise2(911, 16);
  const out = surface(w, h);
  (() => {
    const g = ctx2d(out);
    const u = k / FLM.N, scroll = u * 16 * 2;                      // two noise periods a loop
    const merge = 0.5 + 0.5 * Math.cos(TAU * u);                   // 1 = one flame, 0 = two
    const pulse = (ph) => 0.86 + 0.1 * Math.sin(TAU * (3 * u + ph)) + 0.08 * Math.sin(TAU * (5 * u + ph * 2.3));
    const fHi = 0.25 + 0.75 * sstep(0, 0.6, 0.6 + 0.4 * Math.sin(TAU * (3 * u + 0.2)) + 0.2 * Math.sin(TAU * (7 * u + 0.6)));
    const fLo = 0.25 + 0.75 * sstep(0, 0.6, 0.65 + 0.35 * Math.sin(TAU * (2 * u + 0.75)) + 0.2 * Math.sin(TAU * (5 * u + 0.1)));
    const flare = Math.max(0, 0.32 + 0.22 * Math.sin(TAU * (7 * u)) + 0.16 * Math.sin(TAU * (11 * u + 0.3)) + 0.1 * Math.sin(TAU * (17 * u + 0.7)));
    const s2 = surface(w, h);
    // one flame's heat at (x, y): a teardrop along base → tip, its edge torn by the rising noise
    const heat = (F, x, y, grow, ph) => {
      // the tip leaps up and sinks back (HS: its top varies ± 0.35 head radii)
      const leap = 0.3 * Math.sin(TAU * (2 * u + ph * 0.1)) + 0.18 * Math.sin(TAU * (5 * u + ph * 0.37));
      const [bx, by] = F.base, tx = F.tip[0], ty = F.tip[1] - grow - leap;
      const v = (by - y) / (by - ty);                              // 0 at the base, 1 at the tip
      if (v < -0.15 || v > 1.35) return -9;
      // the whole flame sways out and in (its lines sweep ≈ 0.3 wide, as HS's do)
      // (top and bottom swing TOGETHER, one fire — Idan: the same swing and flow)
      const sway = 0.14 * Math.sin(TAU * 3 * u) * ((F.flow || 0.3) + Math.max(0, Math.min(1, v)));
      const cxl = bx + (tx - bx) * Math.max(0, Math.min(1, v)) + (F.bow || 0) * Math.sin(Math.PI * Math.max(0, Math.min(1, v))) + sway;
      // the tearing: sideways push and a ragged width, both scrolling up with the fire
      const q = y * 1.9 + scroll;
      // (the noise hardly varies across the flame, so it tears the edges, not stripes)
      const push = (fbm(nA, x * 0.35, q * 0.8, 2) - 0.5) * 1.45 * ((F.flow || 0.25) + v);
      const rag = 0.65 + 0.7 * fbm(nB, x * 0.5 + ph * 3, q * 0.9, 2);
      const vv = Math.max(0, Math.min(1, v));
      const hw = F.hw * pulse(ph) * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + vv * 0.95)), F.pow) * Math.pow(1 - vv * 0.85, 0.6) * rag;
      const off = x - cxl - push, d = Math.abs(off) / Math.max(1e-3, hw);
      let e = 1 - d;
      // only the flame's OUTER edge is a line (HS: one curling line per flame), and its tip
      if (off < 0 && vv < 0.93) return -9;
      // the tip breaks up into rising tongues and blobs
      if (v > 0.6) e -= (v - 0.6) * 1.6 * fbm(nS, x * 0.9 + ph, q * 1.7, 2);
      if (v < 0) e -= -v * 6;
      if (v > 1) e -= (v - 1) * 3;
      return e;
    };
    pix(ctx2d(s2), w, h, (px, py, o) => {
      const x = FLM.X0 + (px + 0.5) / T, y = FLM.Y0 + (py + 0.5) / T;
      // never over the face: the lines run just outside the head's outline
      const dh = SFB.dh[py * w + px];
      if (dh < 0.0) return;
      // each flame's signed distance to its edge (head radii, + inside), their union
      const sd = (F, grow, ph, e = heat(F, x, y, grow, ph)) => (e <= -8 ? -9 : e * F.hw * 0.8);
      const lo = sd(FLAME_LO, 0.55 * merge, 0), hi = sd(FLAME_HI, 0, 7.3);
      // each flame flares and fades on its own (HS's lines come and go: area ± 40 %, reach ± 0.35)
      const br = merge > 0.02 ? sd({ base: [1.3, 0.1], tip: [1.08, -0.95], hw: 0.2 * merge, pow: 0.5 }, 0, 3.1) : -1;
      const D = Math.max(lo, hi, br);
      // HS's look: the fire's EDGE is a thin white-hot line (≈ 0.1 across) curling as the shape
      // flows; inside it only a faint haze
      // fatter toward the top, where HS's line ends in a hot comma, and by the jaw (HS: 0.5 there)
      const lw = FLM.LINE * (1 + 2.5 * sstep(-1.3, -2.0, y) + 0.9 * sstep(-0.2, 0.4, y) * (1 - sstep(1.0, 1.6, y)));
      const who = D === hi ? fHi : D === lo ? fLo : 1;
      const line = Math.exp(-((D / lw) ** 2)) * who;
      // and the bright soft haze HS has along the lower cheek, hugging the outline
      // — it FLARES and dies back fast (HS's flame area swings ± 40 %), and its edge is torn too
      const haze = flare * Math.exp(-dh / (0.16 + 0.22 * flare)) * sstep(-0.9, 0.1, y) * (1 - sstep(1.4, 2.0, y)) * (0.6 + 0.8 * fbm(nB, x * 1.2, y * 1.6 + scroll, 2));
      const a = Math.max(line, haze) * sstep(0.0, 0.05, dh);
      if (a < 0.01) return;
      o[0] = 255; o[1] = mix(228, 255, line); o[2] = mix(60, 245, line * line);
      o[3] = a;
    });
    bloom(g, s2, [[1, 1, '#fff04a'], [2, 1, '#ffe41a'], [3, 1, '#ffd400'], [4, 0.8, '#ffc800'], [5, 0.5, '#ffc000']], w, h);
  })();
  fr[k] = out;
  return out;
}
// The whole press look at one player: head centre (hx, hy), radius r, feet (fx, fy), now t.
// `part` 'under' paints the silhouette glow (the layer under the heads), 'over' the wisps (over
// them); without layers both go on one canvas.
export function drawArmedGlow(g, hx, hy, r, fx, fy, t, seed = 0, part = 'both') {
  const f = Math.floor(t * ARMED.HZ);
  const R = rng(f * 7919 + seed * 104729);
  const kb = (fy - hy) / r, bw = 2 * AB.L * r, bh = (AB.T + kbKey(kb) + AB.B) * r;
  if (part !== 'over') blit(g, armedGlowTex(kb), hx, hy - AB.T * r, bw, bh, 0, 0.9 + 0.1 * R(), true, 0.5, 0);
  if (part === 'under') return;
  // the side flames (sideFlame): one frame of the loop, mirrored for the left side
  const tx = sideFlameFrame(Math.floor(((t + seed * 0.37) / FLM.LOOP) * FLM.N) % FLM.N);
  const W = (FLM.X1 - FLM.X0) * r, H = (FLM.Y1 - FLM.Y0) * r;
  for (const out of [1, -1]) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(hx, hy);
    g.scale(out, 1);
    g.drawImage(tx, FLM.X0 * r, FLM.Y0 * r, W, H);
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
// THE KNOCKOUT STARS, as HS draws them (M4 119.3–121 s, M3 82.6 s): a thick solid yellow ring
// round the crown, tipped with the head (`tilt`), and three big flat gold stars — each about
// half a head across — riding it, the near one bigger and the far half of the ring fainter.
function starPath(g, x, y, R, rot) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const an = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * 0.5 : R;
    g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  g.closePath();
}
function drawStar(g, x, y, R, rot, a) {
  g.save();
  g.globalAlpha = a;
  g.lineJoin = 'round';
  starPath(g, x, y, R, rot);
  g.lineWidth = R * 0.2; g.strokeStyle = '#d98200'; g.stroke();
  const lg = g.createLinearGradient(x, y - R, x, y + R);
  lg.addColorStop(0, '#fff47c'); lg.addColorStop(0.45, '#ffd81c'); lg.addColorStop(1, '#f2a100');
  g.fillStyle = lg; g.fill();
  starPath(g, x - R * 0.06, y - R * 0.1, R * 0.5, rot);
  g.fillStyle = 'rgba(255,250,190,0.55)'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.ellipse(x - R * 0.3, y - R * 0.34, R * 0.13, R * 0.08, -0.6, 0, TAU); g.fill();
  g.restore();
}
export function drawStars(g, cx, cy, r, t, a = 1, tilt = 0) {
  const rx = r * 1.4, ry = r * 0.3;
  const ring = (from, to, alpha) => {
    g.save();
    g.globalAlpha = a * alpha;
    g.translate(cx, cy); g.rotate(tilt);
    g.lineCap = 'round';
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, from, to);
    g.lineWidth = r * 0.2; g.strokeStyle = '#e8b400'; g.stroke();
    g.lineWidth = r * 0.1; g.strokeStyle = '#ffe94a'; g.stroke();
    g.restore();
  };
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const stars = [0, 1, 2].map((k) => {
    const an = t * 4.2 + (k * TAU) / 3, lx = Math.cos(an) * rx, ly = Math.sin(an) * ry;
    return { x: cx + lx * c - ly * sn, y: cy + lx * sn + ly * c, z: (Math.sin(an) + 1) / 2, rot: tilt + Math.sin(t * 3 + k) * 0.15 };
  }).sort((p, q) => p.z - q.z);
  ring(Math.PI, TAU, 0.8);                                   // the far half, behind the stars
  for (const s of stars) if (s.z < 0.5) drawStar(g, s.x, s.y, r * (0.56 + 0.2 * s.z), s.rot, a);
  ring(0, Math.PI, 1);                                       // the near half, over them
  for (const s of stars) if (s.z >= 0.5) drawStar(g, s.x, s.y, r * (0.56 + 0.2 * s.z), s.rot, a);
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
