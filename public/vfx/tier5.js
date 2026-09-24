// Tier 5 — אגדות (stages 37-45) champion VFX. See public/champ-vfx.js for the contract: every
// hook only DRAWS, reading the match it is handed (s.M) and never writing to it.
//
// These are the finale, so each one is the biggest show in the game — a super-move opener
// (sunburst, light, a comic word, a themed storm of particles), a signature drawing inside the
// engine's cut-in, a main phase that changes the whole scene, and a payoff that explodes in
// theme. Every layer stays tied to live state: the mirror's pane reflects the real ball, the
// teleporter's exit beam sits where the ball really is, the timeslow hourglass drains with the
// effect's own clock, the timestop dial shows the banked strike. The ball itself always keeps a
// bright core and outline, drawn last, so it is the easiest thing on the pitch to find.

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// A stable 0..1 per integer: the same pixel / debris piece keeps its identity across frames.
const hash = (n) => { const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };
// 0→1 over `a` seconds in, 1→0 over the last `b` seconds of a record's life.
const fade = (e, a = 0.2, b = 0.4) => clamp(Math.min(e.t / a, (e.life - e.t) / b), 0, 1);
const dirOf = (b) => Math.sign(b.vx) || 1;
// The cut-in's own fade (k = 0→1 over its second): in fast, out over the last third.
const cutA = (k) => clamp(Math.min(k / 0.1, (1 - k) / 0.35), 0, 1);
// Where a comic word can pop without leaving the screen.
const spot = (s, x, y) => ({ x: clamp(x, 130, s.C.W - 130), y: clamp(y, 80, s.C.GROUND_Y - 80) });

// The super-move opener every finale power shares the SHAPE of (the colours and word are its
// own): a spinning sunburst, two light blobs, a comic word, a shake and glowing screen edges.
function opener(s, at, o) {
  const { fx } = s, p = spot(s, at.x, at.y - 80);
  const spin = o.spin ?? 1.2;
  fx.rays(at.x, at.y, { color: o.col, color2: o.col2, n: 18, r1: 460, life: 0.95, alpha: 0.55, spin });
  fx.rays(at.x, at.y, { color: o.col2, n: 10, r: 20, r1: 620, life: 0.7, alpha: 0.3, spin: -spin * 0.7, rot: 0.3 });
  fx.glow(at.x, at.y, 230, o.col, { life: 0.8, alpha: 0.9 });
  fx.glow(at.x, at.y, 110, o.col2, { life: 0.55, alpha: 0.8 });
  fx.glow(at.x, at.y, 64, o.hot, { life: 0.4, alpha: 1 });
  // a double shockwave: a fat dark-edged ring and a thin hot one racing past it
  fx.ring(at.x, at.y, { color: o.edge || '#1b1030', r: 20, r1: 260, life: 0.55, w: 12, alpha: 0.7 });
  fx.ring(at.x, at.y, { color: o.col, r: 20, r1: 250, life: 0.55, w: 7 });
  fx.ring(at.x, at.y, { color: o.hot, r: 10, r1: 360, life: 0.7, w: 4 });
  fx.burst(at.x, at.y, 26, { shape: 'star', speed: 520, r: 7, r1: 2, spin: 9, drag: 1.6, life: 0.8, color: o.hot, color2: o.col, blend: 'lighter' });
  fx.burst(at.x, at.y, 18, { shape: 'streak', speed: 900, r: 14, w: 4, drag: 2.5, life: 0.4, color: o.col2, blend: 'lighter' });
  fx.stamp(p.x, p.y, o.word, { color: o.wordCol || o.hot, edge: o.edge || '#1b1030', r: o.size || 66 });
  fx.shake(o.shake || 7, 0.45);
  fx.vignette(o.col, 0.5, o.vig || 1.4);
}

// The armed tell every finale champion wears over the gold glow: a fat ring of dashes turning
// round the whole body and head (dark edge under a bright stroke, so it reads on any backdrop),
// a pulse racing out of it and a light pool in the power's colour.
function beacon(g, s, p, col, edge) {
  const hy = s.headY(p), R = s.headR(p);
  const cy = (hy + p.y) / 2 - 6, rx = R + 30, ry = (p.y - hy) / 2 + R + 22;
  s.fx.drawGlow(g, p.x, cy, ry + 50, col, 0.5 + 0.2 * Math.sin(s.t * 8));
  g.save();
  g.lineCap = 'round';
  const a0 = s.t * 2.2;
  for (const [w, c, al] of [[9, edge, 0.7], [4, col, 1]]) {
    g.lineWidth = w; g.strokeStyle = c; g.globalAlpha = al;
    for (let i = 0; i < 8; i++) { const a = a0 + (i / 8) * TAU; g.beginPath(); g.ellipse(p.x, cy, rx, ry, 0, a, a + 0.42); g.stroke(); }
  }
  const f = (s.t * 1.4) % 1;
  g.globalAlpha = 0.85 * (1 - f); g.strokeStyle = col; g.lineWidth = 4;
  g.beginPath(); g.ellipse(p.x, cy, rx + f * 60, ry + f * 60, 0, 0, TAU); g.stroke();
  g.restore();
}

// Somewhere random on the pitch — for the ambient particles a power fills the whole scene with.
const anywhere = (s) => ({ x: s.fx.rand(10, s.C.W - 10), y: s.fx.rand(s.C.CEIL_Y + 10, s.C.GROUND_Y - 10) });
// A wrapped, drifting x across the screen for ambient objects: seed i, speed v px/s.
const drift = (s, i, v) => { const W = s.C.W + 160; return ((hash(i) * W + s.t * v) % W + W) % W - 80; };

// The ball's keyline — a dark ring under a white one — so it is findable over any effect.
function keyline(g, x, y, r) {
  g.save();
  g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = '#10081c';
  g.beginPath(); g.arc(x, y, r + 1, 0, TAU); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, r + 1, 0, TAU); g.stroke();
  g.restore();
}

// A four-point sparkle: two crossed strokes.
function twinkle(g, x, y, r, a, col) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
  g.restore();
}
function hexPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath();
}

// A brass gear: `teeth` square teeth round a disc, a hub hole, turned by `rot`.
function gear(g, x, y, r, teeth, rot, fill, edge, a) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalAlpha = a;
  g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 2;
  g.beginPath();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU, rr = (i % 4 < 2) ? r : r * 0.8;
    g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.28, 0, TAU); g.stroke();
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * TAU;
    g.beginPath(); g.moveTo(Math.cos(ang) * r * 0.28, Math.sin(ang) * r * 0.28); g.lineTo(Math.cos(ang) * r * 0.72, Math.sin(ang) * r * 0.72); g.stroke();
  }
  g.restore();
}

// An hourglass, `fill` = how much sand is still in the top bulb (1 → 0).
function hourglass(g, x, y, h, fill, rot, a, t) {
  const w = h * 0.42;
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalAlpha = 0.35 * a; g.fillStyle = '#f6ead0';
  const glass = () => { g.beginPath(); g.moveTo(-w, -h / 2); g.lineTo(w, -h / 2); g.lineTo(3, 0); g.lineTo(w, h / 2); g.lineTo(-w, h / 2); g.lineTo(-3, 0); g.closePath(); };
  glass(); g.fill();
  g.globalAlpha = 0.95 * a; g.fillStyle = '#e6c88a';
  const f = clamp(fill, 0, 1);
  if (f > 0.02) {
    const ty = -h / 2 * f, tw = w * f;
    g.beginPath(); g.moveTo(-tw, ty); g.lineTo(tw, ty); g.lineTo(2, -1); g.lineTo(-2, -1); g.closePath(); g.fill();
    g.fillRect(-1, 0, 2, h / 2 - 2);
  }
  const ph = (h / 2) * (1 - f) * 0.9;
  g.beginPath(); g.moveTo(-w, h / 2); g.lineTo(w, h / 2); g.lineTo(0, h / 2 - ph - 1); g.closePath(); g.fill();
  g.globalAlpha = 0.9 * a; g.strokeStyle = '#f6ead0'; g.lineWidth = 2; glass(); g.stroke();
  g.fillStyle = '#5b3a1e';
  g.fillRect(-w - 4, -h / 2 - 5, w * 2 + 8, 5); g.fillRect(-w - 4, h / 2, w * 2 + 8, 5);
  g.fillRect(-w - 4, -h / 2, 3, h); g.fillRect(w + 1, -h / 2, 3, h);
  g.globalAlpha = 0.6 * a; g.fillStyle = '#ffffff';
  g.fillRect(-w * 0.55, -h / 2 + 4 + ((t * 20) % (h * 0.3)), 2, 5);
  g.restore();
}

// The teleporter beam: a column of light from ceiling to grass, scanlines streaming down it.
function beam(g, x, s, k, w) {
  if (k <= 0.02) return;
  const { C } = s;
  const top = C.CEIL_Y, bot = C.GROUND_Y, h = bot - top;
  g.save();
  const gr = g.createLinearGradient(x - w, 0, x + w, 0);
  gr.addColorStop(0, '#0b4f4a'); gr.addColorStop(0.5, '#00f5d4'); gr.addColorStop(1, '#0b4f4a');
  g.globalAlpha = 0.22 * k; g.fillStyle = gr; g.fillRect(x - w, top, w * 2, h);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.6 * k; g.fillStyle = '#e6fff9'; g.fillRect(x - 3, top, 6, h);
  g.fillStyle = '#7dff4f';
  const off = (s.t * 240) % 14;
  g.globalAlpha = 0.3 * k;
  for (let y = top + off; y < bot; y += 14) g.fillRect(x - w, y, w * 2, 2);
  g.restore();
  g.save();
  g.globalAlpha = 0.85 * k; g.strokeStyle = '#5dfdcb'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(x, bot, w + 8, 6, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(x, top + 5, w + 4, 5, 0, 0, TAU); g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#7dff4f';
  for (let i = 0; i < 3; i++) {
    const f = (s.t * 1.4 + i / 3) % 1;
    g.globalAlpha = 0.6 * k * (1 - f);
    g.beginPath(); g.ellipse(x, bot - f * h, w + 2, 4, 0, 0, TAU); g.stroke();
  }
  g.restore();
}

// A ball made of pixels: only the cells whose hash is under `f` are there.
function pixelBall(g, x, y, r, f, drift) {
  const c = 4, n = Math.ceil(r / c) + 1;
  const cols = ['#00f5d4', '#e6fff9', '#7dff4f'];
  g.save();
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const cx = (i + 0.5) * c, cy = (j + 0.5) * c;
      if (cx * cx + cy * cy > r * r) continue;
      const hh = hash(i * 31 + j * 7 + 3);
      if (hh > f) continue;
      g.globalAlpha = 0.9;
      g.fillStyle = cols[(i + j + 99) % 3];
      g.fillRect(Math.round(x + cx - c / 2), Math.round(y + cy - c / 2 - drift * hash(i * 5 + j * 13)), c - 1, c - 1);
    }
  }
  g.restore();
}

// Cyberspace: the pitch turns into a digital grid — lines scrolling on the grass, a scan bar
// sweeping the whole screen, and glitch slices flickering across it.
function cyber(g, s, k) {
  if (k <= 0.02) return;
  const { C } = s, G = C.GROUND_Y, depth = C.H - G;
  g.save();
  g.lineWidth = 2; g.strokeStyle = '#00f5d4';
  const off = (s.t * 60) % 16;
  for (let y = G + 4 + off * 0.5; y < C.H; y += 8 + (y - G) * 0.4) { g.globalAlpha = 0.5 * k; g.beginPath(); g.moveTo(0, y); g.lineTo(C.W, y); g.stroke(); }
  for (let i = -10; i <= 10; i++) {
    const x0 = C.W / 2 + i * 60, x1 = C.W / 2 + i * 110;
    g.globalAlpha = 0.4 * k; g.beginPath(); g.moveTo(x0, G); g.lineTo(x1, G + depth); g.stroke();
  }
  g.globalCompositeOperation = 'lighter';
  const sy = C.CEIL_Y + ((s.t * 320) % (G - C.CEIL_Y));
  g.globalAlpha = 0.35 * k; g.fillStyle = '#7dff4f'; g.fillRect(0, sy, C.W, 3);
  g.globalAlpha = 0.1 * k; g.fillRect(0, sy - 18, C.W, 18);
  const seed = Math.floor(s.t * 14);
  for (let i = 0; i < 4; i++) {
    const hh = hash(seed * 7 + i);
    if (hh < 0.45) continue;
    g.globalAlpha = 0.3 * k; g.fillStyle = i % 2 ? '#00f5d4' : '#7dff4f';
    g.fillRect(hash(seed + i * 3) * C.W * 0.6, C.CEIL_Y + hash(seed * 3 + i) * (G - C.CEIL_Y), 80 + hh * 300, 3 + hh * 8);
  }
  g.restore();
}

// The rainbow sky: six spectral ribbons waving right across the top of the pitch, with prism
// triangles turning in it — the scene the split shot flies through.
function aurora(g, s, k) {
  if (k <= 0.02) return;
  const { C, fx } = s, cols = ['#ff3b5c', '#ff8c2b', '#ffe14a', '#39ff88', '#3bc9ff', '#a24bff'];
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    g.globalAlpha = 0.28 * k; g.strokeStyle = cols[i]; g.lineWidth = 12;
    g.beginPath();
    for (let x = -20; x <= C.W + 20; x += 40) {
      const y = C.CEIL_Y + 40 + i * 13 + Math.sin(x * 0.008 + s.t * 1.6) * 34 + Math.sin(x * 0.02 - s.t * 2.4) * 8;
      x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  for (let i = 0; i < 5; i++) {
    const x = drift(s, i + 150, i % 2 ? 40 : -34), y = C.CEIL_Y + 150 + hash(i + 160) * 180 + Math.sin(s.t * 1.4 + i) * 16, S = 14 + hash(i + 170) * 14;
    fx.drawGlow(g, x, y, S * 2.4, cols[(i * 2) % 6], 0.5 * k);
    g.save();
    g.translate(x, y); g.rotate(s.t * 1.2 + i);
    g.globalAlpha = 0.75 * k; g.fillStyle = '#eef6ff';
    g.beginPath(); g.moveTo(0, -S); g.lineTo(S * 0.87, S * 0.5); g.lineTo(-S * 0.87, S * 0.5); g.closePath(); g.fill();
    g.strokeStyle = '#ff006e'; g.lineWidth = 3; g.stroke();
    g.restore();
  }
}

// A honey bee: striped body, flickering wings. `dir` faces it.
function bee(g, x, y, dir, t, a, sc = 1) {
  g.save();
  g.translate(x, y); g.scale(dir * sc, sc);
  g.globalAlpha = 0.7 * a; g.fillStyle = '#fff1c1';
  const fl = 2 + Math.abs(Math.sin(t * 45)) * 5;
  g.beginPath(); g.ellipse(-2, -6, 4, fl, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(3, -6, 3.5, fl * 0.8, 0.3, 0, TAU); g.fill();
  g.globalAlpha = a; g.fillStyle = '#ffd97a';
  g.beginPath(); g.ellipse(0, 0, 8, 5.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a2206';
  g.fillRect(-3, -5, 2.5, 10); g.fillRect(1.5, -5, 2.5, 10);
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(-12, -1); g.lineTo(-8, 2); g.fill();
  g.beginPath(); g.arc(6, -1, 1.6, 0, TAU); g.fill();
  g.restore();
}

// The clone's hologram figure: body box + head disc, scanlines, a scan bar, visor eyes.
function holo(g, x, y, s, a, face) {
  const { C } = s;
  const R = C.HEAD_R, hy = y - C.BODY_H - R + 8;
  const shape = () => {
    g.beginPath();
    g.rect(x - C.BODY_W / 2, y - C.BODY_H, C.BODY_W, C.BODY_H);
    g.moveTo(x + R, hy); g.arc(x, hy, R, 0, TAU);
  };
  g.save();
  g.globalAlpha = 0.3 * a; g.fillStyle = '#4ea0ff'; shape(); g.fill();
  g.save(); shape(); g.clip();
  g.fillStyle = '#9fd4ff'; g.globalAlpha = 0.4 * a;
  const off = (s.t * 36) % 6;
  for (let yy = hy - R - 6 + off; yy < y; yy += 6) g.fillRect(x - R, yy, R * 2, 2);
  const span = y - hy + R;
  g.globalAlpha = 0.8 * a; g.fillStyle = '#2de2ff';
  g.fillRect(x - R, hy - R + ((s.t * 80) % span), R * 2, 3);
  g.restore();
  g.globalAlpha = 0.95 * a; g.strokeStyle = '#9fd4ff'; g.lineWidth = 2; shape(); g.stroke();
  g.fillStyle = '#e3f3ff';
  g.fillRect(x + face * 4 - 11, hy - 5, 7, 4); g.fillRect(x + face * 4 + 4, hy - 5, 7, 4);
  g.restore();
}
// The wireframe pad it stands on: rings and spokes on the grass, slowly turning.
function holoFloor(g, x, y, a, t, W = 58) {
  g.save();
  g.strokeStyle = '#2de2ff'; g.lineWidth = 2; g.globalAlpha = 0.5 * a;
  const D = W * 0.21;
  for (let i = 1; i <= 3; i++) { const f = i / 3; g.beginPath(); g.ellipse(x, y, W * f, D * f, 0, 0, TAU); g.stroke(); }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + t * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * W, y + Math.sin(ang) * D); g.stroke();
  }
  g.restore();
}
let cloneRipple = -9;                 // when the clone last saved a shot (client clock) — its ripple

// A sheet ghost, hollow eyes and an "o" mouth, little arms waving. Drawn at (x, y) = its dome.
function sheet(g, x, y, sc, dir, t, a) {
  g.save();
  g.translate(x, y); g.scale(sc * dir, sc);
  g.globalAlpha = 0.5 * a; g.fillStyle = '#b8ffcf';
  g.beginPath(); g.arc(0, 0, 14, Math.PI, 0);
  g.lineTo(14, 18);
  for (let i = 1; i <= 6; i++) g.lineTo(14 - i * (28 / 6), 18 + (i % 2 ? -5 : 0) + Math.sin(t * 8 + i) * 2);
  g.closePath(); g.fill();
  g.globalAlpha = 0.85 * a; g.strokeStyle = '#5cf2a0'; g.lineWidth = 2 / sc; g.stroke();
  g.globalAlpha = 0.5 * a; g.fillStyle = '#e0e0ff';
  g.beginPath(); g.ellipse(-16, 4 + Math.sin(t * 6) * 3, 5, 3, -0.6, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(16, 2 - Math.sin(t * 6) * 3, 5, 3, 0.6, 0, TAU); g.fill();
  g.globalAlpha = 0.9 * a; g.fillStyle = '#2f5d50';
  g.beginPath(); g.ellipse(-5, -3, 2.8, 4.5, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(5, -3, 2.8, 4.5, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, 7, 3, 4, 0, 0, TAU); g.fill();
  g.restore();
}

// The tornado's shape at height fraction f (0 = grass, 1 = top), for the funnel and its debris.
function twist(e, s, f, H) {
  const { C } = s;
  const rx = 22 + 185 * Math.pow(f, 1.4);
  return {
    x: e.x + Math.sin(s.t * 3 + f * 5) * 20 * f + e.dir * 40 * f,
    y: C.GROUND_Y - f * H,
    rx, ry: 4 + rx * 0.2,
  };
}
const funnelH = (e) => 395 * clamp(e.t / 0.35, 0.05, 1);
// Debris orbiting the funnel: planks, leaves, dust clods. Front half in front of bodies.
function debris(g, e, s, front) {
  const H = funnelH(e), k = fade(e, 0.35, 0.4);
  const EMO = ['🐄', '🪣', '🌳', '🐔'];
  for (let i = 0; i < 24; i++) {
    const f = 0.08 + 0.88 * hash(i + 1);
    const w = 3.5 + 3 * hash(i + 7);
    const ang = s.t * w + hash(i + 3) * TAU;
    if ((Math.sin(ang) > 0) !== front) continue;
    const T = twist(e, s, f, H);
    const x = T.x + Math.cos(ang) * T.rx * 1.3, y = T.y + Math.sin(ang) * T.ry * 1.8;
    g.save();
    g.translate(x, y); g.rotate(ang * 2 + i);
    g.globalAlpha = (front ? 1 : 0.8) * k;
    const kind = i % 6;
    if (kind === 5) {
      g.font = '26px -apple-system, "Apple Color Emoji", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(EMO[(i / 6 | 0) % 4], 0, 0);
      g.restore();
      continue;
    }
    g.scale(2, 2);
    g.strokeStyle = '#1b1d22'; g.lineWidth = 1.2;
    if (kind === 0 || kind === 4) { g.fillStyle = '#8b5a2b'; g.fillRect(-10, -2.5, 20, 5); g.strokeRect(-10, -2.5, 20, 5); g.fillStyle = '#5e3b1a'; g.fillRect(-10, -2.5, 4, 5); }
    else if (kind === 1) { g.fillStyle = '#94d2bd'; g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, TAU); g.fill(); g.stroke(); }
    else if (kind === 2) { g.fillStyle = '#5e8c3a'; g.beginPath(); g.ellipse(0, 0, 5, 2.5, 0.4, 0, TAU); g.fill(); g.stroke(); }
    else { g.fillStyle = '#c9b68a'; g.fillRect(-3.5, -3.5, 7, 7); g.strokeRect(-3.5, -3.5, 7, 7); }
    g.restore();
  }
}

export default {
  // ── 37 · mirror — silvered mirror glass ───────────────────────────────────
  mirror: {
    theme: 'Silvered mirror glass',
    visual: 'a tall silvered pane with sliding reflection glints, one-way etched chevrons, a live reflection of the incoming ball, glass-shard shatter, chrome return ball',
    palette: ['#d0f4ff', '#c3ccd6', '#8a96a8', '#f2fbff', '#56657a'],
    doc: {
      fantasy: 'A full-height pane of silvered glass rises on your half: whatever comes at your goal meets its own reflection and flies back as your shot.',
      purpose: 'A defensive answer that turns the opponent\'s attack into yours. It teaches the late stages that a champion\'s half can have rules of its own — here, a one-way wall 130px from halfway that lasts 6 seconds or one ball, whichever comes first.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body: the ball is struck forward (1.05× kick, 0.8 lift) and the mirror stands at halfway − 130px on your side for 6s. The first ball to cross it toward your goal is relaunched flat as your power shot at 1.1× (1100 px/s), its vertical speed cut to 30%, and the mirror is gone.',
      bot: 'Arms on defence (POWERS.mirror.arm = "defend": the ball in its own half) and plays the keeper style (aggression −0.1, tackle 0.9), so it sits back behind its mirror and waits for you to shoot into it.',
      sequence: {
        anticipation: 'While armed, five silver panes orbit the champion\'s head in a halo of silver light, glinting, and a glowing dashed silver line with light pools at both ends marks the exact x where the mirror will stand. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant silvered pane rises out of the grass on the mirror line, a glint sweeping down it and sparkles on its corners. Then "דינג!": a silver sunburst and light blob at the ball, a spray of glass shards and silver glitter, a column of stars and a white energy beam shooting up the mirror line, glowing silver screen edges and a shake. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'The pane rises to the ceiling: silvered gradient glass lit from inside by three light pools, a steel frame, glints sliding up, twinkling sparkles on its face, chevrons pointing back at the opponent, a gleaming reflection pool on the grass and a live reflection of the ball as it approaches. The returned shot is a chrome sphere in a big silver glow, six mirror shards orbiting it and speed glints streaming off, a white outline drawn last. All over the pitch a hall of mirrors: eight silver diamond shards drift and turn, catching glints, silver motes fall from the ceiling and sparkles pop everywhere; two searchlights swing out of the pane. The pane itself is wider, near-opaque silver with a dark steel frame. The chrome ball wears a lens flare — a 300px light streak and a big turning star — and a dark+white keyline drawn last.',
        impact: 'Mirrored: "חזור!" — the pane shatters in a silver sunburst, a white beam fires back the way the ball leaves, 50+ glass shards and silver glitter spray, a white flash and a big shake. The chrome shot blocked or scoring: "קראש!" with rays, shards, glitter and light. The shatter now throws 64 shards, 24 sparkles and 30 confetti with a second sunburst and a dark shockwave.',
        aftermath: 'An unused mirror dissolves into silver dust and fading light pools down its line; a spent chrome shot leaves a sparkle and a fading glow.',
        cleanup: 'Shards and glitter fall under gravity and fade within ~1.6s; the pane is only drawn while its record lives.',
      },
      layers: 'Cut-in: giant pane with clipped glint and corner sparkles. Back: silver glass pane (gradient) with drawGlow light pools, sliding glint bands (clipped), steel frame, etched chevrons, twinkles, floor gleam, ball reflection. Front: glowing reflective edge, steel stand. Ball: drawGlow halo, orbiting shards, chrome core + outline last. Particles: rays, glows, stamp, beams, glint stars, glass shards, glitter confetti, silver rings, dust.',
      camera: 'Shake 6 and a 1.2s silver vignette on firing; shake 3 as the pane lands; shake 9 with a 0.14s white flash on the shatter; shake 8 on the chrome shot\'s impact.',
      hud: 'The engine\'s status ring does not apply (the mirror targets no one); the pane itself is the timer — it flickers in its last 0.5s.',
      audio: 'Fire: a pure glass chime with a shimmering high sweep. Impact: a bright shatter — high bandpassed cracks and a tinkle. End: a soft fading ring.',
      counterplay: 'It is one-way and one-use: do not shoot through it — carry or dribble the ball past its line, or chip a weak ball into it to spend it, then attack. It only covers the 6 seconds after firing.',
      perf: 'Pane ≈ 45 canvas calls with one clip and 3 drawGlow; one shadowBlur (the reflective edge); chrome ball ≈ 40 calls, 1 shadowBlur, 1 drawGlow; ≤2 trail particles a frame; the opener is ≈ 70 particles, the shatter ≈ 90. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.beam, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.emit(star/shard/sq/streak), fx.shake, fx.flash, s.depth, createLinearGradient.',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 1760, type: 'sine', peak: 0.35, dur: 0.5 }, { k: 'sweep', from: 2400, to: 3600, type: 'triangle', peak: 0.18, dur: 0.35, detune: 12 }],
      impact: [{ k: 'thud', freq: 4200, q: 6, peak: 0.6, decay: 0.18 }, { k: 'thud', freq: 2600, q: 3, peak: 0.45, decay: 0.35, t: 0.03 }, { k: 'blip', freq: 3100, type: 'square', peak: 0.12, dur: 0.12, t: 0.06 }],
      end: [{ k: 'blip', freq: 2200, type: 'sine', peak: 0.14, dur: 0.4 }],
    },

    aura(g, p, s) {
      const { C, fx } = s;
      const hx = p.x, hy = s.headY(p), R = s.headR(p) + 30;
      beacon(g, s, p, '#d0f4ff', '#56657a');
      fx.drawGlow(g, hx, hy, R + 50, '#d0f4ff', 0.55 + 0.15 * Math.sin(s.t * 6));
      g.save();
      for (let i = 0; i < 5; i++) {
        const a = s.t * 1.6 + (i / 5) * TAU;
        const x = hx + Math.cos(a) * R, y = hy + Math.sin(a) * R * 0.5;
        g.save();
        g.translate(x, y); g.rotate(Math.sin(a) * 0.3);
        g.globalAlpha = 0.85; g.fillStyle = '#c3ccd6'; g.fillRect(-6, -16, 12, 32);
        g.strokeStyle = '#56657a'; g.lineWidth = 2; g.strokeRect(-6, -16, 12, 32);
        g.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 7 + i * 2); g.fillStyle = '#f2fbff';
        g.beginPath(); g.moveTo(-4, 4); g.lineTo(4, -6); g.lineTo(4, -12); g.lineTo(-4, -2); g.fill();
        g.restore();
      }
      twinkle(g, hx + Math.cos(s.t * 3) * (R + 14), hy - R * 0.6, 9, 0.5 + 0.5 * Math.sin(s.t * 9), '#ffffff');
      // where the mirror will stand
      const mx = C.W / 2 - p.side * 130;
      g.globalAlpha = 0.5 + 0.2 * Math.sin(s.t * 10);
      const off = (s.t * 60) % 24;
      g.fillStyle = '#56657a';
      for (let y = C.CEIL_Y + off; y < C.GROUND_Y; y += 24) g.fillRect(mx - 5, y - 1, 10, 15);
      g.fillStyle = '#f2fbff';
      for (let y = C.CEIL_Y + off; y < C.GROUND_Y; y += 24) g.fillRect(mx - 3, y, 6, 13);
      g.restore();
      fx.drawGlow(g, mx, C.GROUND_Y, 44, '#d0f4ff', 0.5);
      fx.drawGlow(g, mx, C.CEIL_Y + 10, 30, '#f2fbff', 0.35);
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k), mx = C.W / 2 - s.side * 130;
      const rise = clamp(k / 0.3, 0, 1), top = C.GROUND_Y - (C.GROUND_Y - C.H * 0.46) * (1 - (1 - rise) ** 3);
      const w = 46, h = C.GROUND_Y - top;
      fx.drawGlow(g, mx, (top + C.GROUND_Y) / 2, 200, '#d0f4ff', 0.6 * a);
      g.save();
      g.globalAlpha = 0.85 * a;
      const gr = g.createLinearGradient(mx - w, 0, mx + w, 0);
      gr.addColorStop(0, '#56657a'); gr.addColorStop(0.4, '#c3ccd6'); gr.addColorStop(0.55, '#f2fbff'); gr.addColorStop(1, '#8a96a8');
      g.fillStyle = gr; g.fillRect(mx - w, top, w * 2, h);
      g.save(); g.beginPath(); g.rect(mx - w, top, w * 2, h); g.clip();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 2; i++) {
        const y = top - 60 + ((k * 1.8 + i * 0.5) % 1) * (h + 120);
        g.globalAlpha = 0.7 * a;
        g.beginPath(); g.moveTo(mx - w, y + 30); g.lineTo(mx + w, y - 20); g.lineTo(mx + w, y - 44); g.lineTo(mx - w, y + 6); g.fill();
      }
      g.restore();
      g.globalAlpha = a; g.strokeStyle = '#56657a'; g.lineWidth = 6; g.strokeRect(mx - w, top, w * 2, h);
      g.strokeStyle = '#f2fbff'; g.lineWidth = 2; g.strokeRect(mx - w + 5, top + 5, w * 2 - 10, h - 10);
      g.restore();
      twinkle(g, mx + w, top, 16 + 8 * Math.sin(k * 30), a, '#ffffff');
      twinkle(g, mx - w, top + h * 0.55, 11 + 5 * Math.sin(k * 24 + 1), a, '#d0f4ff');
    },

    fire(s, at) {
      const { fx, C, side } = s;
      opener(s, at, { col: '#d0f4ff', col2: '#8a96a8', hot: '#ffffff', word: 'דינג!', wordCol: '#f2fbff', edge: '#56657a' });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 20, r1: 50, life: 0.25, color: '#f2fbff', color2: '#d0f4ff', blend: 'lighter' });
      fx.ring(at.x, at.y, { color: '#c3ccd6', r1: 130, life: 0.45, w: 6 });
      fx.burst(at.x, at.y, 26, { shape: 'shard', speed: 420, r: 7, spin: 16, grav: 700, life: 0.9, color: '#c3ccd6', color2: '#f2fbff' });
      fx.confetti(at.x, at.y, 18, ['#f2fbff', '#c3ccd6', '#d0f4ff', '#8a96a8']);
      const mx = C.W / 2 - side * 130;
      fx.beam(mx, C.GROUND_Y, mx, C.CEIL_Y, { color: '#d0f4ff', w: 30, life: 0.5 });
      for (let i = 0, n = fx.n(14); i < n; i++) {
        fx.emit({ shape: 'star', x: mx + fx.rand(-10, 10), y: C.GROUND_Y - (i / n) * (C.GROUND_Y - C.CEIL_Y), vy: -240, r: 6, life: 0.6, color: '#f2fbff', blend: 'lighter', spin: 6 });
      }
      fx.flash('#f2fbff', 0.2, 0.16);
    },

    back(g, e, s) {
      const { C, fx } = s, o = s.owner;
      const k = fade(e, 0.25, 0.5) * (e.life - e.t < 0.5 && Math.random() < 0.25 ? 0.5 : 1);
      const top = C.GROUND_Y - (C.GROUND_Y - C.CEIL_Y) * clamp(e.t / 0.25, 0.05, 1);
      const x = e.x, w = 26, h = C.GROUND_Y - top;
      // the hall of mirrors: silver shards drifting all over the pitch, each catching the light
      for (let i = 0; i < 8; i++) {
        const sx = drift(s, i + 11, (i % 2 ? 26 : -22)), sy = C.CEIL_Y + 50 + hash(i + 21) * (C.GROUND_Y - C.CEIL_Y - 130) + Math.sin(s.t * 1.3 + i) * 14;
        const S = 16 + hash(i + 5) * 18, gl = Math.max(0, Math.sin(s.t * 2.2 + i * 1.7));
        g.save();
        g.translate(sx, sy); g.rotate(s.t * 0.7 + i);
        g.globalAlpha = 0.7 * k; g.fillStyle = gl > 0.8 ? '#f2fbff' : '#c3ccd6';
        g.beginPath(); g.moveTo(0, -S); g.lineTo(S * 0.55, 0); g.lineTo(0, S); g.lineTo(-S * 0.55, 0); g.closePath(); g.fill();
        g.globalAlpha = 0.9 * k; g.strokeStyle = '#56657a'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-S * 0.25, -S * 0.3); g.lineTo(S * 0.15, -S * 0.7); g.stroke();
        g.restore();
        if (gl > 0.85) twinkle(g, sx + S * 0.3, sy - S * 0.5, 12 * gl, k, '#ffffff');
      }
      // two searchlights swinging out of the pane across the pitch
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const oy = C.CEIL_Y + (C.GROUND_Y - C.CEIL_Y) * (0.3 + i * 0.35), a = Math.sin(s.t * 0.9 + i * 2) * 0.35 + (i ? 0.15 : -0.15);
        const dir = -o.side, L = 640;
        g.globalAlpha = 0.13 * k; g.fillStyle = '#d0f4ff';
        g.beginPath(); g.moveTo(x, oy);
        g.lineTo(x + dir * Math.cos(a - 0.12) * L, oy + Math.sin(a - 0.12) * L);
        g.lineTo(x + dir * Math.cos(a + 0.12) * L, oy + Math.sin(a + 0.12) * L); g.closePath(); g.fill();
      }
      g.restore();
      // the gleam it throws on the grass, and the light inside it
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3 * k; g.fillStyle = '#f2fbff';
      g.beginPath(); g.ellipse(x, C.GROUND_Y + 2, 90, 9, 0, 0, TAU); g.fill();
      g.restore();
      for (let i = 0; i < 3; i++) fx.drawGlow(g, x, top + h * (0.2 + i * 0.3), 90, '#d0f4ff', 0.45 * k);
      g.save();
      g.globalAlpha = 0.62 * k;
      const gr = g.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, '#56657a'); gr.addColorStop(0.45, '#c3ccd6'); gr.addColorStop(0.55, '#f2fbff'); gr.addColorStop(1, '#8a96a8');
      g.fillStyle = gr; g.fillRect(x - w, top, w * 2, h);
      g.beginPath(); g.rect(x - w, top, w * 2, h); g.clip();
      g.fillStyle = '#f2fbff';
      for (let i = 0; i < 3; i++) {
        const y = C.GROUND_Y + 30 - ((s.t * 150 + i * 150) % (h + 60));
        g.globalAlpha = 0.6 * k;
        g.beginPath(); g.moveTo(x - w, y + 12); g.lineTo(x + w, y - 10); g.lineTo(x + w, y - 24); g.lineTo(x - w, y - 2); g.fill();
      }
      g.restore();
      g.save();
      g.globalAlpha = 0.95 * k; g.strokeStyle = '#2a3342'; g.lineWidth = 7; g.strokeRect(x - w, top, w * 2, h);
      g.strokeStyle = '#c3ccd6'; g.lineWidth = 3; g.strokeRect(x - w + 4, top + 4, w * 2 - 8, h - 8);
      g.strokeStyle = '#d0f4ff'; g.lineWidth = 3; g.globalAlpha = 0.6 * k;
      for (let y = top + 30; y < C.GROUND_Y - 10; y += 56) {
        g.beginPath(); g.moveTo(x - o.side * 6, y - 8); g.lineTo(x + o.side * 6, y); g.lineTo(x - o.side * 6, y + 8); g.stroke();
      }
      const b = s.M.ball, dist = (b.x - x) * o.side;
      if (dist > 0 && dist < 320 && b.y > top) {
        g.globalAlpha = 0.45 * k * (1 - dist / 320);
        g.fillStyle = '#c3ccd6';
        g.beginPath(); g.arc(x - (b.x - x), b.y, b.r, 0, TAU); g.fill();
        g.strokeStyle = '#f2fbff'; g.lineWidth = 2; g.stroke();
      }
      g.restore();
      for (let i = 0; i < 3; i++) {
        const tw = Math.sin(s.t * 5 + i * 2.1);
        if (tw > 0.3) twinkle(g, x + (i - 1) * 8, top + h * hash(i + Math.floor(s.t * 0.8) * 3), 8 * tw, k * tw, '#ffffff');
      }
    },

    front(g, e, s) {
      const { C } = s, o = s.owner;
      const k = fade(e, 0.25, 0.5);
      const top = C.GROUND_Y - (C.GROUND_Y - C.CEIL_Y) * clamp(e.t / 0.25, 0.05, 1);
      const fx0 = e.x + o.side * 14;
      g.save();
      g.globalAlpha = 0.85 * k;
      g.strokeStyle = '#d0f4ff'; g.lineWidth = 4;
      g.shadowColor = '#d0f4ff'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(fx0, top); g.lineTo(fx0, C.GROUND_Y); g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#56657a'; g.fillRect(e.x - 20, C.GROUND_Y - 6, 40, 7);
      g.fillStyle = '#c3ccd6'; g.fillRect(e.x - 20, C.GROUND_Y - 6, 40, 2);
      g.restore();
    },

    tick(e, s) {
      const { C, fx } = s;
      if (Math.random() < 0.45) {
        fx.emit({ shape: 'star', x: e.x + fx.rand(-12, 12), y: fx.rand(C.CEIL_Y + 10, C.GROUND_Y - 10), r: 5, r1: 1, life: 0.45, color: '#f2fbff', blend: 'lighter', spin: 5, layer: 'back' });
      }
      if (Math.random() < 0.08) fx.glow(e.x, fx.rand(C.CEIL_Y + 40, C.GROUND_Y - 20), 36, '#d0f4ff', { life: 0.5, alpha: 0.5 });
      const q = anywhere(s);
      fx.emit({ shape: 'star', x: q.x, y: q.y, r: 1, r1: 9, life: 0.7, color: '#f2fbff', color2: '#d0f4ff', blend: 'lighter', spin: 3, layer: 'back' });
      if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: q.x, y: C.CEIL_Y, vy: fx.rand(40, 90), r: 3, life: 1.6, color: '#c3ccd6', color2: '#8a96a8', layer: 'back' });
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), r = b.r * 1.25, dir = dirOf(b);
      s.fx.drawGlow(g, d.x, d.y, r * 5, '#d0f4ff', 0.8);
      s.fx.drawGlow(g, d.x, d.y, r * 2.2, '#ffffff', 0.6);
      g.save();
      g.translate(d.x, d.y);
      // a lens flare: a long horizontal streak and a big turning four-point star behind the ball
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.75; g.fillStyle = '#f2fbff';
      g.fillRect(-150, -2, 300, 4);
      g.rotate(s.t * 1.5);
      g.globalAlpha = 0.6; g.fillStyle = '#d0f4ff';
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? r * 0.5 : r * 3.2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = '#d0f4ff'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const f = (s.t * 5 + i / 5) % 1;
        g.globalAlpha = 0.7 * (1 - f);
        g.beginPath(); g.moveTo(-dir * (r + f * 40), (i - 2) * 7); g.lineTo(-dir * (r + 22 + f * 40), (i - 2) * 7); g.stroke();
      }
      // six mirror shards orbiting it — a crown of glass
      for (let i = 0; i < 6; i++) {
        const a = s.t * 6 + (i / 6) * TAU, x = Math.cos(a) * r * 2.3, y = Math.sin(a) * r * 1.2;
        g.save(); g.translate(x, y); g.rotate(a);
        g.globalAlpha = Math.sin(a) > 0 ? 0.95 : 0.55;
        g.fillStyle = '#c3ccd6';
        g.beginPath(); g.moveTo(0, -8); g.lineTo(4, 0); g.lineTo(0, 8); g.lineTo(-4, 0); g.closePath(); g.fill();
        g.strokeStyle = '#f2fbff'; g.lineWidth = 2; g.stroke();
        g.restore();
      }
      g.globalAlpha = 1;
      g.shadowColor = '#d0f4ff'; g.shadowBlur = 12;
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
      gr.addColorStop(0, '#f2fbff'); gr.addColorStop(0.5, '#c3ccd6'); gr.addColorStop(1, '#56657a');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      g.globalAlpha = 0.5; g.fillStyle = '#56657a'; g.fillRect(-r, r * 0.1, r * 2, r);
      g.globalAlpha = 0.9; g.fillStyle = '#f2fbff'; g.fillRect(-r, r * 0.05, r * 2, 2);
      g.restore();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff';
      g.translate(-r * 0.4, -r * 0.45); g.rotate(s.t * 3);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? 1.2 : 6; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.fill();
      g.restore();
      keyline(g, d.x, d.y, r);
    },

    trail(b, s) {
      const { fx } = s;
      fx.emit({ shape: 'streak', x: b.x, y: b.y + fx.rand(-7, 7), vx: -b.vx * 0.15, vy: 0, r: 8, w: 4, life: 0.25, color: '#d0f4ff', blend: 'lighter' });
      if (Math.random() < 0.5) fx.emit({ shape: 'star', x: b.x - dirOf(b) * 16, y: b.y + fx.rand(-14, 14), r: 6, r1: 1, spin: 8, life: 0.4, color: '#f2fbff', blend: 'lighter' });
      if (Math.random() < 0.25) fx.emit({ shape: 'shard', x: b.x, y: b.y, vx: -b.vx * 0.2, vy: fx.rand(-120, 120), r: 4, spin: 14, grav: 500, life: 0.5, color: '#c3ccd6' });
    },

    impact(s, ev) {
      const { fx, owner, C } = s;
      if (ev.kind === 'land') {
        const x = ev.e.x;
        fx.ring(x, C.GROUND_Y, { color: '#c3ccd6', r1: 110, life: 0.45, w: 5 });
        fx.glow(x, C.GROUND_Y - 10, 90, '#d0f4ff', { life: 0.5 });
        fx.burst(x, C.GROUND_Y - 4, 16, { shape: 'star', speed: 300, spread: 0.6, angle: -Math.PI / 2, r: 6, spin: 6, life: 0.7, color: '#f2fbff', blend: 'lighter', layer: 'back' });
        fx.shake(3, 0.2);
        return;
      }
      const mirrored = ev.kind === 'mirrored';
      const away = mirrored ? (owner.side > 0 ? 0 : Math.PI) : 0;
      const p = spot(s, ev.x, ev.y - 80);
      fx.rays(ev.x, ev.y, { color: '#f2fbff', color2: '#8a96a8', n: 20, r1: 420, life: 0.8, alpha: 0.5 });
      fx.glow(ev.x, ev.y, 170, '#d0f4ff', { life: 0.6, alpha: 0.9 });
      fx.glow(ev.x, ev.y, 60, '#ffffff', { life: 0.35 });
      fx.stamp(p.x, p.y, mirrored ? 'חזור!' : 'קראש!', { color: '#f2fbff', edge: '#56657a', r: 58 });
      fx.emit({ shape: 'star', x: ev.x, y: ev.y, r: 22, r1: 56, life: 0.25, color: '#ffffff', color2: '#d0f4ff', blend: 'lighter' });
      fx.ring(ev.x, ev.y, { color: '#d0f4ff', r1: 170, life: 0.5, w: 7 });
      fx.ring(ev.x, ev.y, { color: '#8a96a8', r1: 100, life: 0.4, w: 4 });
      fx.burst(ev.x, ev.y, 64, { shape: 'shard', speed: 560, spread: mirrored ? 1.8 : TAU, angle: away, r: 9, spin: 16, grav: 900, life: 1.1, color: '#c3ccd6', color2: '#f2fbff' });
      fx.rays(ev.x, ev.y, { color: '#c3ccd6', n: 10, r: 20, r1: 600, life: 0.6, alpha: 0.3, spin: -1, rot: 0.2 });
      fx.ring(ev.x, ev.y, { color: '#56657a', r: 20, r1: 280, life: 0.6, w: 12, alpha: 0.7 });
      fx.burst(ev.x, ev.y, 24, { shape: 'star', speed: 420, r: 8, r1: 2, spin: 8, drag: 1.5, life: 0.8, color: '#ffffff', color2: '#d0f4ff', blend: 'lighter' });
      fx.burst(ev.x, ev.y, 14, { shape: 'shard', speed: 260, r: 5, spin: 20, grav: 700, life: 0.8, color: '#8a96a8' });
      fx.confetti(ev.x, ev.y, 30, ['#f2fbff', '#c3ccd6', '#d0f4ff', '#8a96a8']);
      fx.vignette('#d0f4ff', 0.45, 0.9);
      if (mirrored) {
        fx.beam(ev.x, ev.y, ev.x + Math.cos(away) * 460, ev.y, { color: '#d0f4ff', w: 26, life: 0.4 });
        fx.flash('#f2fbff', 0.28, 0.14);
        fx.shake(9, 0.35);
      } else fx.shake(8, 0.35);
    },

    end(s, info) {
      const { fx, C } = s;
      if (info.kind === 'effect' && !info.e.used) {
        for (let i = 0, n = fx.n(16); i < n; i++) {
          fx.emit({ shape: 'sq', x: info.e.x + fx.rand(-12, 12), y: fx.rand(C.CEIL_Y, C.GROUND_Y), vy: fx.rand(20, 70), r: 3, life: 1.1, color: '#c3ccd6', color2: '#8a96a8', layer: 'back' });
        }
        for (let i = 0; i < 3; i++) fx.glow(info.e.x, C.CEIL_Y + 80 + i * 120, 60, '#d0f4ff', { life: 0.9, alpha: 0.5 });
        return;
      }
      if (info.kind === 'effect') return;
      const b = s.M.ball;
      fx.emit({ shape: 'star', x: b.x, y: b.y, r: 12, r1: 2, life: 0.5, color: '#f2fbff', blend: 'lighter', spin: 4 });
      fx.glow(b.x, b.y, 70, '#d0f4ff', { life: 0.7, alpha: 0.6 });
    },
  },

  // ── 38 · teleport — the teleporter beam ───────────────────────────────────
  teleport: {
    theme: 'Sci-fi teleporter beam',
    visual: 'vertical transporter beam columns with streaming scanlines, a ball dissolving into cyan and lime pixels, re-materialising cell by cell in the exit beam',
    palette: ['#00f5d4', '#7dff4f', '#e6fff9', '#0b4f4a', '#5dfdcb'],
    doc: {
      fantasy: 'Beam it up: the ball dissolves into pixels on your head and re-materialises in a transporter column right in front of the opponent\'s goal.',
      purpose: 'The shot that skips the pitch. It asks the defender to read a telegraph instead of a trajectory: the exit beam shows where the ball will reappear 0.38s before it moves.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball vanishes and reappears 190px out from the goal you attack, at mid-goal height, hangs there for 0.38s (passing through everyone), then leaves flat at 1.05× (1050 px/s). The shot lives 1.6 + 0.38 = 1.98s.',
      bot: 'Arms on attack (POWERS.teleport.arm = "attack": ball past 40% of the pitch toward your goal and not behind it) and plays the striker style (aggression +0.06), so it fires as soon as it reaches the ball in your half.',
      sequence: {
        anticipation: 'While armed, the champion stands inside a full-height transporter beam: a glowing pad, scan rings climbing the body, data bits orbiting and a cyan light pool at the feet. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: two giant beam columns — one on the champion, one at the exit — light up, and a stream of pixels arcs from one to the other. Then "זאפ!": a cyan sunburst, white energy beams slam down both columns, 50 pixels explode from the head, glowing cyan screen edges. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'Two beams: the entry column where the ball was, its pixel ball breaking up and drifting upward, and the exit column in front of the goal, its pixel ball assembling cell by cell with chevrons pointing where it will fly, both lit with light pools and joined by a dashed lime warp link arcing over the pitch. Once out, a dark-core digital ball inside a cyan glow, a turning targeting reticle of four brackets round it, a pixel skin and sweeping scanline, a bright outline drawn last, dropping pixel breadcrumbs. The whole scene goes digital while the shot lives: a scrolling perspective grid on the grass, a lime scan bar sweeping the screen, glitch slices flickering across it and matrix pixels raining from the ceiling. The exit column stays up for 1s; the ball flies in a dark-edged turning hexagon of light with a keyline drawn last.',
        impact: 'Blocked or scoring: "ביפ-בום!" — a cyan sunburst, a pixel explosion, a white beam shooting up to the ceiling, streaks, pixel confetti and a shake. The blast now throws 70 pixels, a second sunburst, a dark shockwave and a screen-wide horizontal cyan beam.',
        aftermath: 'The last pixels flicker out where the shot ended, under a fading cyan glow.',
        cleanup: 'Pixels are square particles of ≤0.6s; confetti ≤1.6s; the beams are drawn only while the shot is hidden or just out.',
      },
      layers: 'Cut-in: two beam columns with light pools, a pixel arc. Entry beam, exit beam (gradient column, lighter core, scanlines, pad and emitter rings, climbing rings) with drawGlow, warp link, dissolving and assembling pixel balls, exit chevrons, digital ball with drawGlow, reticle and scanline, pixel trail, bursts, rays, beams, stamp, confetti.',
      camera: 'A 0.14s cyan flash, shake 6 and a 1.2s cyan vignette on firing; shake 8 on impact.',
      hud: 'Nothing extra: the exit beam is the telegraph, visible from the moment of firing.',
      audio: 'Fire: a rising digital sweep with a pair of square blips (the "energise" cue). Impact: a crunchy digital burst. End: a descending blip.',
      counterplay: 'Watch for the exit beam: you have 0.38s to get between it and the goal. Stand in the flat line to block, or kick into it for a counter; the shot goes flat at head height of a standing player, so a jump over it gives it away.',
      perf: 'Two beams ≈ 80 canvas calls + 2 drawGlow; the pixel ball ≤ 50 small rects; the reticle 8 strokes; ≤3 particles a frame; one shadowBlur (the ball ring). Opener ≈ 75 particles, impact ≈ 95. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.beam, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(sq/streak/star), fx.burst, fx.ring, fx.flash, fx.shake, s.depth, createLinearGradient, setLineDash.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 300, to: 2400, type: 'square', peak: 0.22, dur: 0.38 }, { k: 'blip', freq: 1568, type: 'square', peak: 0.2, dur: 0.06, t: 0.3 }, { k: 'blip', freq: 2093, type: 'square', peak: 0.18, dur: 0.08, t: 0.38 }],
      impact: [{ k: 'thud', freq: 700, q: 1.5, peak: 0.7, decay: 0.2 }, { k: 'blip', freq: 220, type: 'square', peak: 0.3, dur: 0.12 }, { k: 'blip', freq: 3520, type: 'square', peak: 0.12, dur: 0.05, t: 0.04 }],
      end: [{ k: 'sweep', from: 1400, to: 300, type: 'square', peak: 0.1, dur: 0.2 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), R = s.headR(p), { fx } = s;
      beam(g, p.x, s, 0.75 + 0.2 * Math.sin(s.t * 8), R + 22);
      beacon(g, s, p, '#00f5d4', '#0b4f4a');
      fx.drawGlow(g, p.x, p.y, 70, '#00f5d4', 0.65);
      fx.drawGlow(g, p.x, hy, R + 50, '#7dff4f', 0.25);
      g.save();
      g.globalAlpha = 0.95; g.strokeStyle = '#5dfdcb'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(p.x, p.y, R + 16, 7, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#7dff4f'; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const f = (s.t * 1.2 + i / 3) % 1;
        g.globalAlpha = 0.8 * (1 - f);
        g.beginPath(); g.ellipse(p.x, p.y - f * (p.y - hy + R + 24), R + 12, 5, 0, 0, TAU); g.stroke();
      }
      // data bits orbiting the body
      for (let i = 0; i < 8; i++) {
        const a = s.t * 2.4 + (i / 8) * TAU, x = p.x + Math.cos(a) * (R + 22), y = (hy + p.y) / 2 + Math.sin(a) * 12 + (i - 4) * 6;
        g.globalAlpha = Math.sin(a) > 0 ? 0.95 : 0.45;
        g.fillStyle = i % 2 ? '#7dff4f' : '#e6fff9';
        g.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
      }
      g.restore();
      if (Math.random() < 0.4) fx.emit({ shape: 'sq', x: p.x + fx.rand(-R, R), y: p.y - 4, vy: -140, r: 4, life: 0.5, color: '#7dff4f', color2: '#00f5d4', layer: 'back' });
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k), o = s.owner;
      const exitX = s.side > 0 ? C.W - C.GOAL_W - 190 : C.GOAL_W + 190;
      const cols = [[o.x, 1 - k * 0.6], [exitX, clamp(k * 2, 0, 1)]];
      for (const [x, kk] of cols) {
        beam(g, x, s, a * kk, 46);
        fx.drawGlow(g, x, C.GROUND_Y - 30, 130, '#00f5d4', 0.75 * a * kk);
      }
      g.save();
      for (let i = 0; i < 26; i++) {
        const f = (i / 26 + k * 1.4) % 1, x = o.x + (exitX - o.x) * f, y = C.GROUND_Y - 70 - Math.sin(f * Math.PI) * 100;
        g.globalAlpha = a * (0.5 + 0.5 * Math.sin(f * Math.PI));
        g.fillStyle = i % 3 ? '#7dff4f' : '#e6fff9';
        g.fillRect(Math.round(x - 5), Math.round(y - 5), 10, 10);
      }
      const dir = Math.sign(exitX - o.x) || 1, mx = (o.x + exitX) / 2;
      g.strokeStyle = '#5dfdcb'; g.lineWidth = 8; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const cx = mx + dir * (i - 1) * 50 + dir * ((k * 200) % 50);
        g.globalAlpha = 0.8 * a;
        g.beginPath(); g.moveTo(cx - dir * 20, C.H * 0.62 - 30); g.lineTo(cx + dir * 10, C.H * 0.62); g.lineTo(cx - dir * 20, C.H * 0.62 + 30); g.stroke();
      }
      g.restore();
    },

    fire(s, at) {
      const { fx, C } = s, b = s.M.ball, o = s.owner;
      const src = (b.power && b.power.src) || { x: o.x, y: s.headY(o) };
      opener(s, src, { col: '#00f5d4', col2: '#7dff4f', hot: '#e6fff9', word: 'זאפ!', wordCol: '#7dff4f', edge: '#0b4f4a' });
      fx.beam(src.x, C.CEIL_Y, src.x, C.GROUND_Y, { color: '#00f5d4', w: 36, life: 0.5 });
      fx.beam(b.x, C.CEIL_Y, b.x, C.GROUND_Y, { color: '#7dff4f', w: 30, life: 0.6 });
      fx.glow(b.x, b.y, 110, '#7dff4f', { life: 0.6 });
      fx.burst(src.x, src.y, 44, { shape: 'sq', speed: 260, r: 5, life: 0.6, vy: -80, drag: 2, color: '#00f5d4', color2: '#7dff4f' });
      fx.burst(src.x, src.y, 12, { shape: 'streak', speed: 600, spread: 0.6, angle: -Math.PI / 2, r: 12, w: 3, life: 0.35, color: '#e6fff9', blend: 'lighter' });
      fx.ring(src.x, src.y, { color: '#5dfdcb', r1: 110, life: 0.4, w: 5 });
      fx.ring(b.x, b.y, { color: '#7dff4f', r: 90, r1: 8, life: 0.38, w: 5 });   // the exit, closing in
      fx.flash('#00f5d4', 0.16, 0.14);
    },

    ball(g, b, s) {
      const pw = b.power, { C, fx } = s;
      const k = clamp(pw.t / 0.38, 0, 1);
      const exitX = pw.dir > 0 ? C.W - C.GOAL_W - 190 : C.GOAL_W + 190;
      cyber(g, s, clamp(Math.min(pw.t / 0.15, (1.98 - pw.t) / 0.4), 0, 1));
      if (pw.hidden) {
        const src = pw.src || { x: b.x, y: b.y };
        beam(g, src.x, s, 1 - k, 24);
        fx.drawGlow(g, src.x, src.y, 80, '#00f5d4', 0.7 * (1 - k));
        pixelBall(g, src.x, src.y, b.r + 4, 1 - k * 1.1, k * 40);
        beam(g, b.x, s, 0.4 + k * 0.6, 26);
        fx.drawGlow(g, b.x, b.y, 90, '#7dff4f', 0.4 + 0.5 * k);
        pixelBall(g, b.x, b.y, b.r + 4, k, 0);
        g.save();
        // the warp link: a dashed arc from one beam to the other
        g.strokeStyle = '#7dff4f'; g.lineWidth = 3; g.globalAlpha = 0.7;
        g.setLineDash([10, 10]); g.lineDashOffset = -s.t * 120;
        g.beginPath(); g.moveTo(src.x, src.y); g.quadraticCurveTo((src.x + b.x) / 2, C.CEIL_Y + 30, b.x, b.y); g.stroke();
        g.setLineDash([]);
        g.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const f = (s.t * 3 + i / 3) % 1, cx = b.x + pw.dir * (30 + f * 60);
          g.globalAlpha = 0.9 * (1 - f) * k;
          g.beginPath(); g.moveTo(cx - pw.dir * 8, b.y - 10); g.lineTo(cx, b.y); g.lineTo(cx - pw.dir * 8, b.y + 10); g.stroke();
        }
        g.restore();
        return;
      }
      if (pw.t < 1) beam(g, exitX, s, 1 - (pw.t - 0.38) / 0.62, 30);
      const d = s.depth(b.x, b.y), r = b.r * 1.2;
      fx.drawGlow(g, d.x, d.y, r * 4.6, '#00f5d4', 0.8);
      fx.drawGlow(g, d.x, d.y, r * 2.2, '#7dff4f', 0.5);
      // a turning hexagon of light round it, dark-edged
      g.save();
      g.translate(d.x, d.y); g.rotate(-s.t * 3);
      hexPath(g, 0, 0, r * 2.9);
      g.globalAlpha = 0.8; g.strokeStyle = '#0b4f4a'; g.lineWidth = 7; g.stroke();
      g.strokeStyle = '#00f5d4'; g.lineWidth = 3; g.stroke();
      g.restore();
      g.save();
      g.translate(d.x, d.y);
      // the targeting reticle
      g.rotate(s.t * 2);
      g.strokeStyle = '#7dff4f'; g.lineWidth = 3; g.globalAlpha = 0.9;
      const Q = r * 2.1;
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.beginPath(); g.moveTo(Q, Q - 9); g.lineTo(Q, Q); g.lineTo(Q - 9, Q); g.stroke();
      }
      g.restore();
      g.save();
      g.translate(d.x, d.y);
      g.shadowColor = '#00f5d4'; g.shadowBlur = 12;
      g.strokeStyle = '#00f5d4'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, r + 3, 0, TAU); g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#0b4f4a'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.restore();
      pixelBall(g, d.x, d.y, r - 1, 0.55, 0);
      g.save();
      g.beginPath(); g.arc(d.x, d.y, r, 0, TAU); g.clip();
      g.globalAlpha = 0.9; g.fillStyle = '#e6fff9';
      g.fillRect(d.x - r, d.y - r + ((s.t * 90) % (r * 2)), r * 2, 3);
      g.restore();
      keyline(g, d.x, d.y, r);
    },

    trail(b, s) {
      const { fx } = s, pw = b.power;
      if (pw.hidden) {
        const src = pw.src || b;
        fx.emit({ shape: 'sq', x: src.x + fx.rand(-14, 14), y: src.y + fx.rand(-14, 14), vy: -110, r: 4, life: 0.45, color: '#00f5d4', color2: '#e6fff9' });
        const a = fx.rand(0, TAU);
        fx.emit({ shape: 'sq', x: b.x + Math.cos(a) * 50, y: b.y + Math.sin(a) * 50, vx: -Math.cos(a) * 130, vy: -Math.sin(a) * 130, r: 4, life: 0.38, color: '#7dff4f' });
        fx.emit({ shape: 'sq', x: Math.round(fx.rand(0, s.C.W) / 20) * 20, y: s.C.CEIL_Y, vy: fx.rand(260, 420), r: 5, life: 1.1, color: '#7dff4f', color2: '#00f5d4', layer: 'back' });
        return;
      }
      fx.emit({ shape: 'sq', x: Math.round(fx.rand(0, s.C.W) / 20) * 20, y: s.C.CEIL_Y, vy: fx.rand(260, 420), r: 5, life: 1.1, color: '#7dff4f', color2: '#00f5d4', layer: 'back' });
      fx.emit({ shape: 'sq', x: b.x - dirOf(b) * 12, y: b.y + fx.rand(-10, 10), r: 5, life: 0.45, color: '#00f5d4', color2: '#0b4f4a' });
      fx.emit({ shape: 'sq', x: b.x - dirOf(b) * 22, y: b.y + fx.rand(-12, 12), r: 3, life: 0.3, color: '#7dff4f' });
      if (Math.random() < 0.3) fx.emit({ shape: 'streak', x: b.x, y: b.y + fx.rand(-10, 10), vx: -b.vx * 0.2, r: 10, w: 2, life: 0.2, color: '#e6fff9', blend: 'lighter' });
    },

    impact(s, ev) {
      const { fx, C } = s;
      const p = spot(s, ev.x, ev.y - 80);
      fx.rays(ev.x, ev.y, { color: '#00f5d4', color2: '#7dff4f', n: 18, r1: 380, life: 0.7 });
      fx.glow(ev.x, ev.y, 150, '#00f5d4', { life: 0.6 });
      fx.stamp(p.x, p.y, 'ביפ-בום!', { color: '#7dff4f', edge: '#0b4f4a', r: 52 });
      fx.burst(ev.x, ev.y, 70, { shape: 'sq', speed: 520, r: 7, drag: 1.5, life: 0.8, color: '#00f5d4', color2: '#7dff4f' });
      fx.rays(ev.x, ev.y, { color: '#7dff4f', n: 10, r: 20, r1: 600, life: 0.55, alpha: 0.3, spin: -1.4 });
      fx.ring(ev.x, ev.y, { color: '#0b4f4a', r: 20, r1: 260, life: 0.55, w: 12, alpha: 0.7 });
      fx.beam(0, ev.y, s.C.W, ev.y, { color: '#00f5d4', w: 14, life: 0.3 });
      fx.vignette('#00f5d4', 0.45, 0.8);
      fx.ring(ev.x, ev.y, { color: '#5dfdcb', r1: 170, life: 0.5, w: 7 });
      fx.beam(ev.x, ev.y, ev.x, C.CEIL_Y, { color: '#00f5d4', w: 30, life: 0.45 });
      for (let i = 0, n = fx.n(8); i < n; i++) {
        fx.emit({ shape: 'streak', x: ev.x + fx.rand(-30, 30), y: ev.y, vy: -fx.rand(500, 850), r: 12, w: 3, life: 0.3, color: '#e6fff9', blend: 'lighter' });
      }
      fx.confetti(ev.x, ev.y, 18, ['#00f5d4', '#7dff4f', '#e6fff9', '#5dfdcb']);
      fx.shake(8, 0.35);
    },

    end(s) {
      const { fx } = s, b = s.M.ball;
      for (let i = 0, n = fx.n(12); i < n; i++) fx.emit({ shape: 'sq', x: b.x + fx.rand(-18, 18), y: b.y + fx.rand(-18, 18), vy: -30, r: 3, life: fx.rand(0.3, 0.6), color: '#5dfdcb' });
      fx.glow(b.x, b.y, 70, '#00f5d4', { life: 0.6, alpha: 0.6 });
    },
  },

  // ── 39 · carry — sticky honey ─────────────────────────────────────────────
  carry: {
    theme: 'Sticky honey glue',
    visual: 'amber honey coating the ball, sagging goo strands stretched from boot to ball, drips and sticky footprints, strands snapping on release, a splat when stolen',
    palette: ['#ffb627', '#e08a00', '#ffd97a', '#7a4308', '#fff1c1'],
    doc: {
      fantasy: 'Your boot is dipped in honey: the ball sticks to it and comes with you wherever you run, until you kick it loose.',
      purpose: 'A dribble instead of a shot: the power is possession. It asks the defender to tackle or body the ball rather than stand in a line.',
      player: 'Fill the meter, press POWER, then touch the ball: it glues to the front of your boot for up to 3s and you run at 1.2× speed. Press kick to release it as a flat power shot at 1.25× (1250 px/s). A tackle on you, the opponent\'s head or body touching the ball, or being stunned frees it as a plain ball.',
      bot: 'Arms on attack (POWERS.carry.arm = "attack") with the striker style (aggression +0.06); while carrying, the bot walks the ball at your goal (carrying() in powers.js) and kicks it loose close in.',
      sequence: {
        anticipation: 'While armed, honey oozes from the champion\'s boots — a wide glowing amber puddle and five drips stretching off the body — and two honey bees buzz round the head. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: honey pours over the top of the screen in a dripping curtain, a honeycomb glows below the band and a giant bee zooms across. Then "בלופ!": an amber sunburst and light, 40 honey blobs splatter out, golden confetti, a sticky ring, amber screen edges and a shake. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'While carried: an amber glow round ball and boot, a glossy honey coat on the ball\'s lower half with hanging drips, a glob on the boot, three thick sagging goo strands stretched between them — thinning and flickering as the 3s run out — and a bee circling the ball. Drops fall off and sticky footprints are left when running. The released shot is a honey comet: a big golden glow, a honey teardrop stretched behind it, drips and two bees chasing it, a pale outline drawn last. The whole stadium drips: a honey band along the ceiling with 14 fat, dark-edged drips stretching and dropping, a glowing honeycomb floor spreading under the carrier, six bees swarming wide round him and golden pollen twinkling all over the pitch; the ball gets a keyline last. The released shot is a honey comet with a fat dark-edged tail, a double glow and four bees chasing it.',
        impact: 'Released: "בזזז!" — the strands snap back, droplets fly forward, a honey glow and ring. Stolen: "אופס!" and a big amber splat. The honey shot blocked or scoring: "ספלאט!" — an amber sunburst, 50 sticky blobs, golden confetti and a heavy shake. Release adds a sunburst and 30 sparkles; the honey shot\'s splat throws 70 blobs, 30 confetti, flying bee glyphs, a second sunburst and a dark shockwave.',
        aftermath: 'If the glue simply ran out, the last drops fall off the ball under a fading glow; a spent honey shot leaves splatter on the grass.',
        cleanup: 'Drops fall under gravity and die at ≤0.9s, confetti ≤1.6s; strands are drawn only while the carry record lives.',
      },
      layers: 'Cut-in: honey curtain with drips, honeycomb, giant bee, drawGlow. Back: glowing puddle under the carrier. Front: goo strands (3 beziers + highlight), honey coat and drips on the ball, boot glob, orbiting bee, drawGlow. Ball: drawGlow, honey teardrop, drips, bees, glaze core + outline last. Particles: drops, footprints, blobs, snap streaks, rays, glows, stamps, confetti.',
      camera: 'Shake 4 and a 1.2s amber vignette on firing; shake 5 on release, 4 on a steal, 8 on the honey shot\'s impact; no flash — honey is soft.',
      hud: 'The engine\'s status ring round the carrier\'s pill counts the 3s down; the strands thinning is the in-world clock.',
      audio: 'Fire: a wet squelch — a low bandpassed thud and a falling triangle glide. Impact: a sticky pop. End: a soft drip.',
      counterplay: 'Body the ball or tackle the carrier: any head/body touch or tackle steals it. The carrier cannot shoot without pressing kick, so stand in front of the ball, not the player.',
      perf: 'Strands + coat + bee ≈ 45 canvas calls, 2 drawGlow; the honey ball ≈ 45 calls, 1 drawGlow; ≤3 tick particles a frame; opener ≈ 60 particles, splat ≈ 75. No shadowBlur. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(dot/sq/streak), fx.burst, fx.ring, fx.shake, s.depth, quadraticCurveTo, createRadialGradient.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 180, q: 3, peak: 0.6, decay: 0.22 }, { k: 'sweep', from: 520, to: 160, type: 'triangle', peak: 0.28, dur: 0.25 }],
      impact: [{ k: 'thud', freq: 320, q: 4, peak: 0.7, decay: 0.14 }, { k: 'blip', freq: 880, type: 'triangle', peak: 0.2, dur: 0.07, t: 0.05 }],
      end: [{ k: 'blip', freq: 1320, type: 'sine', peak: 0.1, dur: 0.12 }],
    },

    aura(g, p, s) {
      const { C, fx } = s, hy = s.headY(p), R = s.headR(p);
      beacon(g, s, p, '#ffb627', '#7a4308');
      fx.drawGlow(g, p.x, p.y, 80, '#ffb627', 0.6);
      g.save();
      g.globalAlpha = 0.8; g.fillStyle = '#e08a00';
      g.beginPath(); g.ellipse(p.x, p.y + 1, C.BODY_W * 1.3 + Math.sin(s.t * 3) * 4, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd97a'; g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(p.x - 6, p.y, C.BODY_W * 0.5, 2.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffb627';
      for (let i = 0; i < 5; i++) {
        const x = p.x + (i - 2) * (C.BODY_W / 4);
        const L = 6 + ((s.t * 1.6 + i * 0.37) % 1) * 16;
        g.globalAlpha = 0.95;
        g.beginPath(); g.moveTo(x - 3.5, p.y - 10); g.lineTo(x + 3.5, p.y - 10); g.lineTo(x + 2, p.y - 10 + L); g.arc(x, p.y - 10 + L, 3, 0, Math.PI); g.closePath(); g.fill();
      }
      g.globalAlpha = 0.9; g.fillStyle = '#fff1c1'; g.fillRect(p.x - 8, p.y - 1, 6, 2);
      g.restore();
      for (let i = 0; i < 4; i++) {
        const a = s.t * 3.2 + i * (TAU / 4);
        bee(g, p.x + Math.cos(a) * (R + 40), hy + Math.sin(a * 2) * 16 - 10, -Math.sin(a) >= 0 ? 1 : -1, s.t + i, 1, 1.5);
      }
      if (Math.random() < 0.2) fx.emit({ x: p.x + fx.rand(-18, 18), y: p.y - 8, vy: 20, grav: 800, r: 3, life: 0.3, color: '#e08a00' });
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k), pour = clamp(k * 1.8, 0, 1);
      g.save();
      g.globalAlpha = 0.92 * a; g.fillStyle = '#e08a00';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(C.W, 0); g.lineTo(C.W, 30 * pour);
      for (let i = 14; i >= 0; i--) g.lineTo((i / 14) * C.W, (26 + (i % 2) * 10) * pour);
      g.closePath(); g.fill();
      for (let i = 0; i < 10; i++) {
        const x = ((i + 0.5) / 10) * C.W + Math.sin(i * 3) * 20, L = (30 + hash(i) * 60) * pour;
        g.fillStyle = i % 3 ? '#ffb627' : '#e08a00';
        g.fillRect(x - 7, 20, 14, L); g.beginPath(); g.arc(x, 20 + L, 10, 0, TAU); g.fill();
        g.fillStyle = '#fff1c1'; g.globalAlpha = 0.7 * a; g.fillRect(x - 4, 24, 3, L * 0.7); g.globalAlpha = 0.92 * a;
      }
      // a honeycomb glowing under the band
      const cx = C.W / 2 - s.side * 220, cy = C.H * 0.72;
      g.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        const col = i % 4, row = Math.floor(i / 4), hx = cx + (col - 1.5) * 52 + (row % 2) * 26, hy = cy + (row - 1) * 45;
        hexPath(g, hx, hy, 28);
        g.globalAlpha = 0.55 * a; g.fillStyle = hash(i + 5) > 0.4 ? '#ffb627' : '#ffd97a'; g.fill();
        g.globalAlpha = 0.9 * a; g.strokeStyle = '#7a4308'; g.stroke();
      }
      g.restore();
      fx.drawGlow(g, cx, cy, 170, '#ffb627', 0.5 * a);
      const from = s.side > 0 ? -1 : 1, bx = C.W / 2 + from * (0.5 - k) * C.W * 1.1, by = C.H * 0.62 + Math.sin(k * 24) * 18;
      bee(g, bx, by, -from, s.t, a, 4);
    },

    fire(s, at) {
      const { fx } = s;
      opener(s, at, { col: '#ffb627', col2: '#ffd97a', hot: '#fff1c1', word: 'בלופ!', wordCol: '#ffd97a', edge: '#7a4308', shake: 4 });
      fx.burst(at.x, at.y, 40, { speed: 300, r: 5, grav: 700, life: 0.8, color: '#ffb627', color2: '#e08a00' });
      fx.burst(at.x, at.y, 8, { shape: 'smoke', speed: 90, r: 6, r1: 18, drag: 2, life: 0.6, color: '#ffd97a' });
      fx.confetti(at.x, at.y, 14, ['#ffb627', '#ffd97a', '#e08a00', '#fff1c1']);
      fx.ring(at.x, at.y, { color: '#ffd97a', r1: 110, life: 0.4, w: 6 });
    },

    back(g, e, s) {
      const p = s.M.players[e.owner], { C, fx } = s, k = fade(e, 0.2, 0.3);
      // the whole stadium drips: a honey band along the ceiling with fat drips stretching down
      g.save();
      g.globalAlpha = 0.92 * k;
      g.fillStyle = '#e08a00';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(C.W, 0); g.lineTo(C.W, C.CEIL_Y + 6);
      for (let i = 20; i >= 0; i--) g.lineTo((i / 20) * C.W, C.CEIL_Y + 6 + (i % 2) * 8 + Math.sin(s.t * 2 + i) * 3);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a4308'; g.lineWidth = 3; g.stroke();
      for (let i = 0; i < 14; i++) {
        const x = ((i + 0.5) / 14) * C.W + (hash(i + 40) - 0.5) * 30;
        const cyc = (s.t * (0.35 + hash(i) * 0.3) + hash(i + 9)) % 1, L = 20 + cyc * (60 + hash(i + 3) * 90);
        g.fillStyle = i % 3 ? '#ffb627' : '#e08a00';
        g.beginPath(); g.moveTo(x - 7, C.CEIL_Y + 6); g.lineTo(x + 7, C.CEIL_Y + 6); g.lineTo(x + 3, C.CEIL_Y + L); g.arc(x, C.CEIL_Y + L, 6 + cyc * 3, 0, Math.PI); g.lineTo(x - 7, C.CEIL_Y + 6); g.closePath(); g.fill();
        g.strokeStyle = '#7a4308'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#fff1c1'; g.fillRect(x - 4, C.CEIL_Y + 10, 2, L * 0.6);
      }
      // a glowing honeycomb floor spreading under the carrier
      for (let i = -3; i <= 3; i++) {
        const hx = p.x + i * 34, hy2 = C.GROUND_Y + 14 + (i % 2 ? 6 : 0);
        const kk = k * (1 - Math.abs(i) / 4.5);
        g.save(); g.translate(hx, hy2); g.scale(1, 0.4);
        hexPath(g, 0, 0, 20);
        g.globalAlpha = 0.6 * kk; g.fillStyle = (i + 9) % 2 ? '#ffb627' : '#ffd97a'; g.fill();
        g.globalAlpha = 0.9 * kk; g.strokeStyle = '#7a4308'; g.lineWidth = 3; g.stroke();
        g.restore();
      }
      g.restore();
      fx.drawGlow(g, p.x, C.GROUND_Y + 10, 150, '#ffb627', 0.55 * k);
      fx.drawGlow(g, p.x, p.y, 70, '#e08a00', 0.5 * k);
      g.save();
      g.globalAlpha = 0.65 * k; g.fillStyle = '#e08a00';
      g.beginPath(); g.ellipse(p.x, p.y + 1, C.BODY_W * 1.1, 5, 0, 0, TAU); g.fill();
      g.restore();
    },

    front(g, e, s) {
      const p = s.M.players[e.owner], b = s.M.ball, { C, fx } = s;
      const left = 1 - e.t / e.life;
      const flick = left < 0.2 && Math.random() < 0.3 ? 0.4 : 1;
      const d = s.depth(b.x, b.y);
      const bx = p.x + p.side * (C.BODY_W / 2 - 2), by = p.y - 6;
      fx.drawGlow(g, d.x, d.y, b.r * 3, '#ffb627', 0.55 * flick);
      g.save();
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const sag = 8 + i * 5 + Math.sin(s.t * 7 + i * 2) * 4;
        const mx = (bx + d.x) / 2, my = (by + d.y) / 2 + sag;
        g.globalAlpha = 0.9 * flick; g.strokeStyle = i === 1 ? '#ffb627' : '#e08a00';
        g.lineWidth = Math.max(2, (6 - i * 1.5) * (0.5 + left * 0.5));
        g.beginPath(); g.moveTo(bx, by - i * 3); g.quadraticCurveTo(mx, my, d.x - p.side * b.r * 0.6, d.y + b.r * 0.3 - i * 3); g.stroke();
      }
      g.globalAlpha = 0.75 * flick; g.strokeStyle = '#fff1c1'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx, by - 4); g.quadraticCurveTo((bx + d.x) / 2, (by + d.y) / 2 + 5, d.x - p.side * b.r * 0.6, d.y - 2); g.stroke();
      g.globalAlpha = 0.95; g.fillStyle = '#ffb627';
      g.beginPath(); g.ellipse(bx, by + 1, 8, 5, 0, 0, TAU); g.fill();
      g.save();
      g.globalAlpha = 0.65;
      const gr = g.createRadialGradient(d.x, d.y + b.r * 0.4, 1, d.x, d.y, b.r + 3);
      gr.addColorStop(0, '#ffd97a'); gr.addColorStop(1, '#e08a00');
      g.fillStyle = gr;
      g.beginPath(); g.arc(d.x, d.y, b.r + 2, 0.1, Math.PI - 0.1); g.closePath(); g.fill();
      g.globalAlpha = 0.9; g.fillStyle = '#e08a00';
      for (let i = 0; i < 3; i++) {
        const x = d.x + (i - 1) * b.r * 0.6, L = 4 + ((s.t * 1.3 + i * 0.41) % 1) * 12;
        g.beginPath(); g.moveTo(x - 3, d.y + b.r); g.lineTo(x + 3, d.y + b.r); g.lineTo(x + 1.4, d.y + b.r + L); g.arc(x, d.y + b.r + L, 2.5, 0, Math.PI); g.closePath(); g.fill();
      }
      g.fillStyle = '#fff1c1'; g.globalAlpha = 0.85; g.fillRect(d.x - b.r * 0.5, d.y + b.r * 0.35, 6, 2);
      g.restore();
      g.globalAlpha = 0.9 * flick; g.strokeStyle = '#fff1c1'; g.lineWidth = 2;
      g.beginPath(); g.arc(d.x, d.y, b.r + 3, 0, TAU); g.stroke();
      g.restore();
      const a = s.t * 5;
      bee(g, d.x + Math.cos(a) * (b.r + 26), d.y + Math.sin(a) * 14 - 16, -Math.sin(a) >= 0 ? 1 : -1, s.t, 1, 1.2);
      // the swarm: six bees looping wide round the carrier, cheering him on
      const hy = s.headY(p);
      for (let i = 0; i < 6; i++) {
        const w = s.t * (2.2 + i * 0.25) + i * 1.1, rx = 80 + (i % 3) * 26;
        bee(g, p.x + Math.cos(w) * rx, hy - 20 + Math.sin(w * 1.7) * 40, -Math.sin(w) >= 0 ? 1 : -1, s.t + i, 0.95, 1.4);
      }
      keyline(g, d.x, d.y, b.r + 2);
    },

    tick(e, s) {
      const p = s.M.players[e.owner], b = s.M.ball, { fx, C } = s;
      if (Math.random() < 0.45) fx.emit({ x: b.x + fx.rand(-8, 8), y: b.y + b.r + 4, vy: 30, grav: 900, r: 3.5, life: 0.5, color: '#e08a00', color2: '#7a4308' });
      const q = anywhere(s);
      fx.emit({ shape: 'star', x: q.x, y: q.y, vx: fx.rand(-20, 20), vy: fx.rand(-30, -10), r: 5, r1: 1, spin: 3, life: 1.2, color: '#ffd97a', color2: '#ffb627', blend: 'lighter', layer: 'back' });
      if (Math.abs(p.vx) > 120 && p.onGround && Math.random() < 0.15) {
        fx.emit({ shape: 'sq', x: p.x - p.side * 6, y: C.GROUND_Y - 1, r: 6, life: 0.9, color: '#7a4308', alpha: 0.7, layer: 'back' });
      }
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), r = b.r * 1.25, dir = dirOf(b);
      s.fx.drawGlow(g, d.x, d.y, r * 5, '#ffb627', 0.8);
      s.fx.drawGlow(g, d.x - dir * r * 3, d.y, r * 3, '#e08a00', 0.6);
      // a honey comet: a fat dark-edged golden tail behind everything else
      g.save();
      g.translate(d.x, d.y);
      g.globalAlpha = 0.9; g.fillStyle = '#e08a00';
      g.beginPath(); g.moveTo(0, -r * 1.3); g.quadraticCurveTo(-dir * r * 4, -r, -dir * r * 7, Math.sin(s.t * 10) * 6); g.quadraticCurveTo(-dir * r * 4, r * 1.1, 0, r * 1.3); g.closePath(); g.fill();
      g.strokeStyle = '#7a4308'; g.lineWidth = 3; g.stroke();
      g.restore();
      g.save();
      g.translate(d.x, d.y);
      // the honey teardrop it drags
      g.globalAlpha = 0.7; g.fillStyle = '#ffb627';
      g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(-dir * r * 2, -r * 0.8, -dir * r * 3.4, Math.sin(s.t * 14) * 4);
      g.quadraticCurveTo(-dir * r * 2, r * 0.9, 0, r); g.closePath(); g.fill();
      g.strokeStyle = '#e08a00'; g.lineWidth = 3; g.lineCap = 'round'; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(-dir * r, 0);
      g.quadraticCurveTo(-dir * (r + 22), Math.sin(s.t * 18) * 12, -dir * (r + 46), Math.sin(s.t * 18 + 1.5) * 8); g.stroke();
      g.fillStyle = '#e08a00';
      for (let i = 0; i < 4; i++) {
        const f = (s.t * 4 + i / 4) % 1;
        g.globalAlpha = 0.9 * (1 - f);
        g.beginPath(); g.arc(-dir * (r * 0.4 + f * 34), r * 0.7 + f * 14, 3.5 - f * 1.5, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      gr.addColorStop(0, '#fff1c1'); gr.addColorStop(0.45, '#ffb627'); gr.addColorStop(1, '#7a4308');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = '#fff1c1'; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(-r * 0.35, -r * 0.45, r * 0.3, r * 0.15, -0.5, 0, TAU); g.fill();
      g.globalAlpha = 1; g.strokeStyle = '#fff1c1'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.restore();
      for (let i = 0; i < 4; i++) bee(g, d.x - dir * (r * 4 + i * 24), d.y + Math.sin(s.t * 9 + i * 2) * 22 - 14 + (i % 2) * 28, dir, s.t + i, 0.95, 1.5);
      keyline(g, d.x, d.y, r);
    },

    trail(b, s) {
      const { fx } = s;
      fx.emit({ x: b.x - dirOf(b) * 12, y: b.y + fx.rand(0, 10), vx: -b.vx * 0.05, vy: 20, grav: 800, r: 4, life: 0.5, color: '#e08a00', color2: '#7a4308' });
      if (Math.random() < 0.5) fx.emit({ x: b.x, y: b.y, vx: -b.vx * 0.1, vy: fx.rand(-50, 50), r: 3, life: 0.35, color: '#ffd97a' });
    },

    impact(s, ev) {
      const { fx, owner } = s;
      if (ev.kind === 'land') {
        const b = s.M.ball;
        fx.burst(b.x, b.y, 14, { speed: 140, r: 4, grav: 600, life: 0.5, color: '#ffb627' });
        fx.glow(b.x, b.y, 70, '#ffb627', { life: 0.4 });
        return;
      }
      const p = spot(s, ev.x, ev.y - 80);
      if (ev.kind === 'released') {
        fx.stamp(p.x, p.y, 'בזזז!', { color: '#ffd97a', edge: '#7a4308', r: 60 });
        fx.glow(ev.x, ev.y, 160, '#ffb627', { life: 0.5 });
        fx.rays(ev.x, ev.y, { color: '#ffb627', color2: '#ffd97a', n: 14, r1: 360, life: 0.55 });
        fx.burst(ev.x, ev.y, 30, { shape: 'star', speed: 460, r: 7, r1: 2, spin: 8, drag: 1.5, life: 0.7, color: '#fff1c1', color2: '#ffb627', blend: 'lighter' });
        fx.burst(ev.x, ev.y, 12, { shape: 'streak', speed: 420, spread: 0.9, angle: owner.side > 0 ? Math.PI : 0, r: 10, w: 3, life: 0.25, color: '#e08a00' });
        fx.burst(ev.x, ev.y, 18, { speed: 340, spread: 1.2, angle: owner.side > 0 ? 0 : Math.PI, r: 4, grav: 700, life: 0.6, color: '#ffb627', color2: '#e08a00' });
        fx.ring(ev.x, ev.y, { color: '#ffd97a', r1: 100, life: 0.35, w: 5 });
        fx.shake(5, 0.25);
        return;
      }
      if (ev.kind === 'stolen') {
        fx.stamp(p.x, p.y, 'אופס!', { color: '#ffb627', edge: '#7a4308', r: 48 });
        fx.burst(ev.x, ev.y, 30, { speed: 300, r: 5, grav: 800, life: 0.7, color: '#ffb627', color2: '#7a4308' });
        fx.ring(ev.x, ev.y, { color: '#e08a00', r1: 90, life: 0.4, w: 6 });
        fx.glow(ev.x, ev.y, 90, '#e08a00', { life: 0.4 });
        fx.shake(4, 0.2);
        return;
      }
      fx.rays(ev.x, ev.y, { color: '#ffb627', color2: '#ffd97a', n: 16, r1: 380, life: 0.75 });
      fx.glow(ev.x, ev.y, 160, '#ffb627', { life: 0.6 });
      fx.stamp(p.x, p.y, 'ספלאט!', { color: '#ffd97a', edge: '#7a4308', r: 58 });
      fx.emit({ x: ev.x, y: ev.y, r: 18, r1: 56, life: 0.3, color: '#ffd97a', color2: '#ffb627', blend: 'lighter' });
      fx.burst(ev.x, ev.y, 70, { speed: 520, r: 7, grav: 900, life: 1, color: '#ffb627', color2: '#e08a00' });
      fx.confetti(ev.x, ev.y, 30, ['#ffb627', '#ffd97a', '#e08a00', '#fff1c1']);
      fx.ring(ev.x, ev.y, { color: '#7a4308', r: 20, r1: 260, life: 0.6, w: 12, alpha: 0.7 });
      fx.rays(ev.x, ev.y, { color: '#ffd97a', n: 10, r: 20, r1: 600, life: 0.6, alpha: 0.3, spin: -1 });
      for (let i = 0; i < 5; i++) fx.glyph(ev.x, ev.y - 10, '🐝', { r: 26, vx: Math.cos(-Math.PI / 2 + (i - 2) * 0.6) * 260, vy: Math.sin(-Math.PI / 2 + (i - 2) * 0.6) * 260, drag: 1.5, life: 1.2 });
      fx.vignette('#ffb627', 0.45, 0.9);
      fx.ring(ev.x, ev.y, { color: '#e08a00', r1: 160, life: 0.5, w: 7 });
      fx.shake(8, 0.35);
    },

    end(s, info) {
      const { fx, C } = s, b = s.M.ball;
      if (info.kind === 'effect') {
        if (b.power && b.power.champ === 'carry') return;
        for (let i = 0, n = fx.n(10); i < n; i++) fx.emit({ x: b.x + fx.rand(-10, 10), y: b.y + b.r, vy: fx.rand(10, 60), grav: 900, r: 3.5, life: 0.6, color: '#e08a00' });
        fx.glow(b.x, b.y, 60, '#ffb627', { life: 0.6, alpha: 0.6 });
        return;
      }
      for (let i = 0, n = fx.n(8); i < n; i++) fx.emit({ shape: 'sq', x: b.x + fx.rand(-26, 26), y: C.GROUND_Y - 1, r: 6, life: 1, color: '#7a4308', layer: 'back' });
      fx.glow(b.x, b.y, 70, '#ffb627', { life: 0.7, alpha: 0.6 });
    },
  },

  // ── 40 · phantom — ghost ectoplasm ────────────────────────────────────────
  phantom: {
    theme: 'Ghost ectoplasm',
    visual: 'a translucent pale-green sheet ghost wrapped round the ball, ectoplasm wisps and trailing ghost faces, a spectral shiver as it passes through a body',
    palette: ['#b8ffcf', '#e0e0ff', '#5cf2a0', '#2f5d50', '#f0fff6'],
    doc: {
      fantasy: 'The ball becomes a ghost: it wails through your opponent\'s head and body as if they were not there.',
      purpose: 'The shot a body cannot block. It removes the ordinary answer (stand in the line) and leaves only the skilled one: a counter kick timed onto the ball.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. It leaves flat at 1.05× (1050 px/s) for the ordinary 1.6s power-shot life and passes through the opponent\'s head and body.',
      bot: 'Arms on attack (POWERS.phantom.arm = "attack") with the striker style (aggression +0.06): it fires from your half, where there is little time to read it.',
      sequence: {
        anticipation: 'While armed, a big sheet ghost with hollow eyes and waving arms bobs behind the champion\'s shoulder in a green glow, a smaller one circles the head, and pale wisps curl up off the body. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant ghost rises from the bottom of the screen, arms waving, in a green glow, while little ghosts fly across. Then "בוווו!": a green sunburst and light, a big puff of ectoplasm, green blobs, four ghost glyphs flying out, a green ring, the pitch dimmed spectral green with glowing green edges for the whole flight. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'The ball wrapped in a big translucent ghost (about 2× the ball) inside a green glow: a glowing dome in front, a wavy tail flapping behind, hollow eyes and an "o" mouth, the pale ball with a bright outline always visible at its core; two little ghosts chase it. Wisps and faint ghost faces peel off behind. Passing through the opponent, the ghost shivers (jittered afterimages) and a spectral ring wobbles round them. The stadium is haunted for the whole flight: six sheet ghosts parade across the pitch in green glows, pairs of glowing eyes blink open in the dark, and ghost fog rolls over the grass the whole width of the pitch. The ball\'s ghost is bigger (2.3× the ball) with a dark+pale keyline drawn last.',
        impact: 'Countered: "איכס!" — an ectoplasm splat of green blobs, smoke and light. Scoring: "בוו-הא!" — a green sunburst, a ghost swirl in the net, a big ghost rising, ghost-green confetti and a pale flash. A goal also bursts six ghosts outward, 40 green blobs, a second sunburst and a dark shockwave.',
        aftermath: 'Wisps rise and dissipate from where it ended under a fading green glow.',
        cleanup: 'Smoke and glyph particles fade within ~1.2s, confetti ≤1.6s.',
      },
      layers: 'Cut-in: giant ghost, flying small ghosts, drawGlow. Ball: drawGlow, chasing ghosts, ghost body (path, one shadowBlur), ball core + outline last, face, shiver afterimages, spectral ring on the foe. Particles: wisp smoke, ghost glyphs, blobs, rays, glows, stamps, confetti.',
      camera: 'A 1.2s dark-green tint (0.14) and a 1.6s green vignette on firing, shake 5; a 0.18s pale flash on a goal; shake 7 on impact.',
      hud: 'No status: the ghost is the shot, and the counter window is the whole flight.',
      audio: 'Fire: a theremin wail — two detuned sine sweeps rising. Impact: a hollow whoosh with a low moan. End: a breathy fade.',
      counterplay: 'You cannot body it. Time a kick into it (the ordinary counter) — the only thing that stops it — or be out of the way and cover the rebound.',
      perf: '≈60 canvas calls for the ghost and its two chasers; one shadowBlur; 1 drawGlow; ≤3 particles a frame in flight; opener ≈ 60 particles, goal ≈ 55. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(smoke/glyph/dot), fx.burst, fx.ring, fx.tint, fx.flash, fx.shake, s.depth, s.headY, s.headR.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 520, to: 980, type: 'sine', peak: 0.3, dur: 0.6 }, { k: 'sweep', from: 540, to: 940, type: 'sine', peak: 0.22, dur: 0.6, detune: 30 }],
      impact: [{ k: 'thud', freq: 400, q: 0.6, peak: 0.6, decay: 0.4 }, { k: 'sweep', from: 300, to: 140, type: 'sine', peak: 0.3, dur: 0.5 }],
      end: [{ k: 'thud', freq: 1800, q: 0.4, peak: 0.12, decay: 0.5 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), R = s.headR(p), { fx } = s;
      const x = p.x - p.side * (R + 26), y = hy - R - 4 + Math.sin(s.t * 3) * 6;
      beacon(g, s, p, '#5cf2a0', '#2f5d50');
      fx.drawGlow(g, x, y + 10, 70, '#5cf2a0', 0.55);
      sheet(g, x, y, 2.2, p.side, s.t, 1);
      const a = s.t * 2.2;
      sheet(g, p.x + Math.cos(a) * (R + 30), hy + Math.sin(a) * 16 - 6, 0.8, Math.cos(a) < 0 ? 1 : -1, s.t + 1, 0.75);
      if (Math.random() < 0.35) fx.emit({ shape: 'smoke', x: p.x + fx.rand(-18, 18), y: p.y - 10, vy: -50, vx: fx.rand(-10, 10), r: 4, r1: 12, life: 0.8, color: '#b8ffcf', layer: 'back' });
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      const rise = 1 - (1 - clamp(k / 0.45, 0, 1)) ** 3;
      const x = C.W / 2 - s.side * 230, y = C.H + 120 - (C.H + 120 - C.H * 0.72) * rise;
      fx.drawGlow(g, x, y + 40, 220, '#5cf2a0', 0.6 * a);
      sheet(g, x, y, 6, s.side, s.t * 0.6, a);
      for (let i = 0; i < 3; i++) {
        const f = (k * 1.3 + i * 0.3) % 1, from = s.side > 0 ? -1 : 1;
        const gx = C.W / 2 + from * (0.6 - f * 1.2) * C.W, gy = C.H * 0.6 + i * 40 + Math.sin(f * 20 + i) * 16;
        sheet(g, gx, gy, 1.8, -from, s.t + i, a * 0.8);
      }
    },

    fire(s, at) {
      const { fx } = s;
      opener(s, at, { col: '#5cf2a0', col2: '#e0e0ff', hot: '#f0fff6', word: 'בוווו!', wordCol: '#b8ffcf', edge: '#2f5d50', shake: 5, vig: 1.6 });
      fx.burst(at.x, at.y, 30, { shape: 'smoke', speed: 150, r: 6, r1: 20, drag: 2, life: 0.9, color: '#b8ffcf', color2: '#5cf2a0' });
      fx.burst(at.x, at.y, 18, { speed: 320, r: 4, grav: 400, drag: 1, life: 0.7, color: '#5cf2a0', color2: '#e0e0ff' });
      fx.ring(at.x, at.y, { color: '#5cf2a0', r1: 130, life: 0.5, w: 5 });
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.7;
        fx.glyph(at.x, at.y - 20, '👻', { r: 30, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, drag: 1.5, life: 1.1, alpha: 0.7 });
      }
      fx.tint('#2f5d50', 0.14, 1.2);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), dir = dirOf(b), R = b.r * 2.3, L = R * 2.4;
      const q = s.foe, hr = s.headR(q), hy = s.headY(q), { C } = s;
      const inside = Math.abs(b.x - q.x) < hr + b.r + 6 && b.y > hy - hr - b.r && b.y < q.y + 4;
      const near = Math.abs(b.x - q.x) < 80;
      // the haunted stadium: a ghost parade drifting over the whole pitch, and pairs of glowing
      // eyes blinking open in the dark
      const hk = clamp((b.power.t ?? 1) / 0.25, 0, 1);
      for (let i = 0; i < 6; i++) {
        const gx = drift(s, i + 60, (i % 2 ? 50 : -40)), gy = C.CEIL_Y + 60 + hash(i + 70) * 220 + Math.sin(s.t * 2 + i) * 18;
        s.fx.drawGlow(g, gx, gy + 10, 50, '#5cf2a0', 0.35 * hk);
        sheet(g, gx, gy, 1.4 + hash(i + 80) * 0.8, i % 2 ? 1 : -1, s.t + i, 0.8 * hk);
      }
      g.save();
      for (let i = 0; i < 5; i++) {
        const cyc = (s.t * 0.7 + hash(i + 90)) % 1, open = Math.sin(cyc * Math.PI);
        if (open < 0.2) continue;
        const ex = hash(i + 91 + Math.floor(s.t * 0.7 + hash(i + 90))) * C.W, ey = C.CEIL_Y + 40 + hash(i + 95) * 200;
        g.globalAlpha = 0.9 * hk * open; g.fillStyle = '#b8ffcf';
        g.beginPath(); g.ellipse(ex - 7, ey, 4, 6 * open, 0, 0, TAU); g.ellipse(ex + 7, ey, 4, 6 * open, 0, 0, TAU); g.fill();
      }
      g.restore();
      s.fx.drawGlow(g, d.x, d.y, R * 3.2, '#5cf2a0', 0.75);
      if (near) {
        g.save();
        g.globalAlpha = 0.7 * (1 - Math.abs(b.x - q.x) / 80);
        g.strokeStyle = '#5cf2a0'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(q.x, (hy + q.y) / 2 - 6, hr + 14 + Math.sin(s.t * 40) * 4, (q.y - hy) / 2 + hr + 16, 0, 0, TAU); g.stroke();
        g.restore();
      }
      // two little ghosts chasing it
      for (let i = 0; i < 2; i++) sheet(g, d.x - dir * (L * 1.2 + i * 34), d.y - 6 + Math.sin(s.t * 7 + i * 2) * 12, 0.9 - i * 0.2, dir, s.t + i, 0.6 - i * 0.15);
      const draw = (ox, a) => {
        g.save();
        g.translate(d.x + ox, d.y); g.scale(dir, 1);
        const wob = Math.sin(s.t * 20) * 4;
        g.globalAlpha = 0.5 * a; g.fillStyle = '#b8ffcf';
        g.beginPath();
        g.moveTo(0, -R);
        g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2);
        g.quadraticCurveTo(-L * 0.5, R * 1.05, -L * 0.8, R * 0.5 + wob);
        g.lineTo(-L * 0.65, R * 0.1);
        g.lineTo(-L * 1.05, -R * 0.1 - wob);
        g.lineTo(-L * 0.7, -R * 0.4);
        g.quadraticCurveTo(-L * 0.4, -R * 1.05, 0, -R);
        g.closePath(); g.fill();
        if (a === 1) { g.shadowColor = '#5cf2a0'; g.shadowBlur = 14; }
        g.globalAlpha = 0.9 * a; g.strokeStyle = '#5cf2a0'; g.lineWidth = 3; g.stroke();
        g.shadowBlur = 0;
        // the ball itself, pale but always there, ringed so it can be tracked
        g.globalAlpha = 0.7 * a; g.fillStyle = '#f0fff6';
        g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.fill();
        g.globalAlpha = 0.85 * a; g.fillStyle = '#2f5d50';
        g.beginPath(); g.ellipse(b.r * 0.05, -b.r * 0.35, 3, 5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(b.r * 0.6, -b.r * 0.35, 3, 5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(b.r * 0.35, b.r * 0.35, 3.5, 4, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.95 * a; g.strokeStyle = '#f0fff6'; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.stroke();
        g.restore();
      };
      if (inside) { draw(-8, 0.35); draw(8, 0.35); draw(s.fx.rand(-3, 3), 1); }
      else draw(0, 1);
      g.save();
      g.globalAlpha = 0.95; g.strokeStyle = '#2f5d50'; g.lineWidth = 5;
      g.beginPath(); g.arc(d.x, d.y, b.r + 1, 0, TAU); g.stroke();
      g.strokeStyle = '#f0fff6'; g.lineWidth = 3;
      g.beginPath(); g.arc(d.x, d.y, b.r + 1, 0, TAU); g.stroke();
      g.restore();
    },

    trail(b, s) {
      const { fx } = s, q = s.foe;
      fx.emit({ shape: 'smoke', x: b.x - dirOf(b) * 24, y: b.y + fx.rand(-8, 8), vy: -30, vx: -b.vx * 0.05, r: 5, r1: 18, life: 0.7, color: '#b8ffcf', layer: 'back' });
      if (Math.random() < 0.08) fx.glyph(b.x - dirOf(b) * 36, b.y, '👻', { r: 20, vy: -40, life: 0.9, alpha: 0.4 });
      // ghost fog rolling over the grass the whole width of the pitch
      fx.emit({ shape: 'smoke', x: fx.rand(0, s.C.W), y: s.C.GROUND_Y - fx.rand(0, 30), vx: fx.rand(-40, 40), vy: -8, r: 14, r1: 40, life: 1.5, color: '#5cf2a0', color2: '#b8ffcf', alpha: 0.6, layer: 'back' });
      if (Math.abs(b.x - q.x) < s.headR(q) + b.r) {
        fx.emit({ shape: 'smoke', x: q.x + fx.rand(-18, 18), y: q.y - fx.rand(0, 60), vx: fx.rand(-60, 60), vy: -60, r: 5, r1: 16, life: 0.6, color: '#5cf2a0' });
      }
    },

    impact(s, ev) {
      const { fx } = s, p = spot(s, ev.x, ev.y - 80);
      if (ev.kind === 'goal') {
        fx.rays(ev.x, ev.y, { color: '#5cf2a0', color2: '#e0e0ff', n: 16, r1: 400, life: 0.8 });
        fx.glow(ev.x, ev.y, 160, '#5cf2a0', { life: 0.7 });
        fx.stamp(p.x, p.y, 'בוו-הא!', { color: '#b8ffcf', edge: '#2f5d50', r: 58 });
        fx.ring(ev.x, ev.y, { color: '#5cf2a0', r1: 150, life: 0.6, w: 6 });
        fx.burst(ev.x, ev.y, 22, { shape: 'smoke', speed: 180, r: 7, r1: 24, drag: 2, vy: -60, life: 1, color: '#b8ffcf', color2: '#e0e0ff' });
        fx.confetti(ev.x, ev.y, 20, ['#b8ffcf', '#e0e0ff', '#5cf2a0', '#f0fff6']);
        fx.glyph(ev.x, ev.y - 20, '👻', { r: 70, vy: -100, life: 1.3, alpha: 0.85 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; fx.glyph(ev.x, ev.y, '👻', { r: 30, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 - 60, drag: 1.4, life: 1.2, alpha: 0.8, spin: 2 }); }
        fx.burst(ev.x, ev.y, 40, { speed: 460, r: 6, grav: 500, life: 0.9, color: '#5cf2a0', color2: '#b8ffcf' });
        fx.rays(ev.x, ev.y, { color: '#e0e0ff', n: 10, r: 20, r1: 600, life: 0.6, alpha: 0.3, spin: -1 });
        fx.ring(ev.x, ev.y, { color: '#2f5d50', r: 20, r1: 260, life: 0.6, w: 12, alpha: 0.7 });
        fx.vignette('#5cf2a0', 0.45, 0.9);
        fx.flash('#b8ffcf', 0.2, 0.18);
      } else {
        fx.glow(ev.x, ev.y, 120, '#5cf2a0', { life: 0.5 });
        fx.stamp(p.x, p.y, 'איכס!', { color: '#5cf2a0', edge: '#2f5d50', r: 50 });
        fx.burst(ev.x, ev.y, 50, { speed: 420, r: 6, grav: 800, life: 0.9, color: '#5cf2a0', color2: '#2f5d50' });
        fx.rays(ev.x, ev.y, { color: '#5cf2a0', color2: '#e0e0ff', n: 14, r1: 360, life: 0.55 });
        fx.burst(ev.x, ev.y, 10, { shape: 'smoke', speed: 100, r: 7, r1: 20, life: 0.8, color: '#b8ffcf' });
        fx.ring(ev.x, ev.y, { color: '#e0e0ff', r1: 120, life: 0.45, w: 5 });
      }
      fx.shake(7, 0.3);
    },

    end(s) {
      const { fx } = s, b = s.M.ball;
      for (let i = 0, n = fx.n(9); i < n; i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-16, 16), y: b.y, vy: -50 - i * 6, r: 5, r1: 18, life: 1.1, color: '#b8ffcf', layer: 'back' });
      fx.glow(b.x, b.y, 80, '#5cf2a0', { life: 0.9, alpha: 0.5 });
    },
  },

  // ── 41 · timeslow — hourglass sand ────────────────────────────────────────
  timeslow: {
    theme: 'Hourglass sand',
    visual: 'a draining hourglass beside the slowed player, slow-falling sand grains, a sepia halo and lagging sepia afterimages of his body',
    palette: ['#a67c52', '#e6c88a', '#7209b7', '#5b3a1e', '#f6ead0'],
    doc: {
      fantasy: 'You turn the opponent\'s hourglass: for him the sand runs thick and every move drags behind itself.',
      purpose: 'A pure tempo power: the opponent\'s whole clock runs slow, so a plain attack suddenly outruns him. It pairs with the strike it fires off.',
      player: 'Fill the meter, press POWER, then touch the ball: it is struck at the goal you attack (1.15× kick power, lofted) and the opponent runs at 0.45× time for 3.5s — moving, jumping, kicking, recovering.',
      bot: 'Arms anywhere (POWERS.timeslow.arm = "any") with the striker style (aggression +0.06): it fires on the first touch it gets and attacks into the slowed window.',
      sequence: {
        anticipation: 'While armed, a big hourglass hovers over the champion\'s back shoulder in a warm sand glow, slowly turning, sand trickling out, and a ring of sand grains circles the body. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant hourglass under the band slowly flips over, sand pouring, purple time rings pulsing round it. Then "לאאאט!": a slow-turning purple sunburst, a burst of 40 sand grains, sand confetti, an hourglass glyph flipping upward, purple screen edges and the long "tape slowing" sound. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'On the opponent: a purple time bubble round his whole body with slow ripples, a sepia halo, three sepia afterimages trailing his real motion (driven by his velocity), a big lit hourglass by his side whose top bulb drains with the effect\'s own 3.5s clock, and sand grains drifting down in slow motion; over the pitch, a faint sepia film and cinematic letterbox bars for the slow-motion window. The slow world spreads over the whole pitch: six hourglasses drift in slow motion under sand glows, gold and violet ripples roll out 400px from him, twelve giant clock marks crawl round him, and sand trickles from the ceiling everywhere. His hourglass is 84px tall; the ball itself trails four sepia/violet echoes inside a turning violet time ring, with a keyline drawn last.',
        impact: 'As it takes hold: "איטי!" — a slow purple sunburst on him, a sand explosion, a purple ring, light and a brief sepia grade. Taking hold throws 60 grains, a second sunburst, a dark shockwave and a big ⏳; time snapping back adds a fast sunburst and speed streaks.',
        aftermath: 'When time catches up: "מהר!" — the sand pours to the grass and a fast ring snaps outward with a flash of light.',
        cleanup: 'Sand grains live ≤1.3s; the bubble, halo, afterimages, hourglass and bars are drawn only while the record lives (fading in and out).',
      },
      layers: 'Cut-in: giant flipping hourglass, purple rings, drawGlow. Back: time bubble + ripples, sepia halo, drawGlow, afterimages. Front: lit hourglass with live sand level. Over: sepia film (0.08) and letterbox bars outside the pitch. Particles: sand grains, time rings, rays, glows, stamps, confetti, bursts.',
      camera: 'A 1.2s purple vignette and shake 3 on firing; a 0.7s sepia tint (0.12) as it lands; no big shake — slowness is quiet.',
      hud: 'The engine\'s 🐢 pill and ring count the 3.5s; the in-world hourglass shows the same clock.',
      audio: 'Fire: a sawtooth sweep falling from 420 to 70Hz over 0.8s with a soft low thud — a tape slowing down. Impact: a hollow, stretched tock. End: a quick rising sweep as time catches up.',
      counterplay: 'Slow does not mean helpless: stay between the ball and your goal and let it come to you, since your reach is unchanged. Avoid starting long runs; after 3.5s you are back to full speed.',
      perf: 'Bubble + halo + 3 afterimages + hourglass + bars ≈ 70 canvas calls, 2 drawGlow; ≤2 sand grains a frame; opener ≈ 60 particles, land ≈ 50. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(sq/ring/glyph), fx.burst, fx.ring, fx.tint, s.headY, s.headR, createRadialGradient.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 420, to: 70, type: 'sawtooth', peak: 0.3, dur: 0.8 }, { k: 'thud', freq: 110, q: 1, peak: 0.5, decay: 0.5 }],
      impact: [{ k: 'thud', freq: 600, q: 5, peak: 0.5, decay: 0.45 }, { k: 'blip', freq: 330, type: 'triangle', peak: 0.2, dur: 0.4, t: 0.1 }],
      end: [{ k: 'sweep', from: 120, to: 700, type: 'sawtooth', peak: 0.18, dur: 0.25 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), R = s.headR(p), { fx } = s;
      const x = p.x - p.side * (R + 28), y = hy - R - 14 + Math.sin(s.t * 2) * 4;
      beacon(g, s, p, '#7209b7', '#5b3a1e');
      fx.drawGlow(g, x, y, 70, '#e6c88a', 0.7);
      fx.drawGlow(g, p.x, (hy + p.y) / 2, R + 60, '#7209b7', 0.25);
      hourglass(g, x, y, 58, 0.5 + 0.5 * Math.sin(s.t * 0.8), Math.sin(s.t * 1.2) * 0.4, 1, s.t);
      g.save();
      g.fillStyle = '#e6c88a';
      for (let i = 0; i < 14; i++) {
        const a = s.t * 0.9 + (i / 14) * TAU;
        g.globalAlpha = Math.sin(a) > 0 ? 0.95 : 0.45;
        g.fillRect(Math.round(p.x + Math.cos(a) * (R + 28) - 2), Math.round((hy + p.y) / 2 + Math.sin(a) * 18 - 2), 4, 4);
      }
      const f = (s.t * 0.6) % 1;
      g.globalAlpha = 0.6 * (1 - f); g.strokeStyle = '#7209b7'; g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, (hy + p.y) / 2, R + 20 + f * 40, 0, TAU); g.stroke();
      g.restore();
      if (Math.random() < 0.3) fx.emit({ shape: 'sq', x: x + fx.rand(-4, 4), y: y + 22, vy: 40, grav: 60, r: 3, life: 0.8, color: '#e6c88a', layer: 'back' });
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      const x = C.W / 2 - s.side * 200, y = C.H * 0.74;
      const u = clamp(k / 0.6, 0, 1), flip = u * u * (3 - 2 * u);
      fx.drawGlow(g, x, y, 200, '#e6c88a', 0.55 * a);
      fx.drawGlow(g, x, y, 120, '#7209b7', 0.5 * a);
      g.save();
      g.strokeStyle = '#7209b7'; g.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        const f = (k * 1.2 + i / 3) % 1;
        g.globalAlpha = 0.7 * a * (1 - f);
        g.beginPath(); g.arc(x, y, 90 + f * 150, 0, TAU); g.stroke();
      }
      g.translate(x, y); g.scale(4.6, 4.6);
      hourglass(g, 0, 0, 40, 1 - k * 0.7, Math.PI * (1 - flip), a, s.t);
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      opener(s, at, { col: '#7209b7', col2: '#e6c88a', hot: '#f6ead0', word: 'לאאאט!', wordCol: '#e6c88a', edge: '#5b3a1e', shake: 3, spin: 0.35 });
      fx.burst(at.x, at.y, 40, { shape: 'sq', speed: 200, r: 4, drag: 1.5, grav: 120, life: 1, color: '#e6c88a', color2: '#a67c52' });
      fx.confetti(at.x, at.y, 12, ['#e6c88a', '#a67c52', '#f6ead0', '#7209b7'], { grav: 200, drag: 2 });
      fx.glyph(at.x, at.y - 24, '⏳', { r: 34, vy: -50, spin: Math.PI, life: 1 });
      fx.ring(at.x, at.y, { color: '#7209b7', r1: 120, life: 0.7, w: 5 });
    },

    back(g, e, s) {
      const q = s.M.players[e.target], hy = s.headY(q), hr = s.headR(q), { C, fx } = s;
      const k = fade(e, 0.3, 0.4);
      const cy = (hy + q.y) / 2 - 8;
      fx.drawGlow(g, q.x, cy, hr * 3, '#7209b7', 0.35 * k);
      g.save();
      // the time bubble
      const rx = hr * 2.1 + Math.sin(s.t * 1.5) * 4, ry = (q.y - hy) / 2 + hr + 22 + Math.cos(s.t * 1.3) * 4;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 * k; g.fillStyle = '#7209b7';
      g.beginPath(); g.ellipse(q.x, cy, rx, ry, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.55 * k; g.strokeStyle = '#7209b7'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(q.x, cy, rx, ry, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#f6ead0'; g.lineWidth = 2; g.globalAlpha = 0.5 * k;
      g.beginPath(); g.ellipse(q.x, cy, rx - 6, ry - 6, 0, -2.4, -1.4); g.stroke();
      for (let i = 0; i < 3; i++) {
        const f = (s.t * 0.3 + i / 3) % 1;
        g.globalAlpha = 0.75 * k * (1 - f); g.strokeStyle = i % 2 ? '#e6c88a' : '#a24bd8'; g.lineWidth = 6 - f * 3;
        g.beginPath(); g.ellipse(q.x, cy, rx + f * 420, ry + f * 260, 0, 0, TAU); g.stroke();
      }
      g.lineWidth = 3;
      const gr = g.createRadialGradient(q.x, cy, 4, q.x, cy, hr * 2.4);
      gr.addColorStop(0, '#e6c88a'); gr.addColorStop(1, '#a67c52');
      g.globalAlpha = 0.2 * k; g.fillStyle = gr;
      g.beginPath(); g.arc(q.x, cy, hr * 2.4, 0, TAU); g.fill();
      g.restore();
      // the slow world: hourglasses drifting in slow motion all over the pitch, sand trickling
      for (let i = 0; i < 6; i++) {
        const x = drift(s, i + 120, i % 2 ? 14 : -12), y = C.CEIL_Y + 70 + hash(i + 130) * 230 + Math.sin(s.t * 0.6 + i) * 10;
        fx.drawGlow(g, x, y, 40, '#e6c88a', 0.35 * k);
        hourglass(g, x, y, 30 + hash(i + 140) * 22, 0.5 + 0.5 * Math.sin(s.t * 0.3 + i), s.t * 0.25 + i, 0.75 * k, s.t);
      }
      // giant clock marks round him, turning at a crawl
      g.save();
      g.strokeStyle = '#e6c88a'; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + s.t * 0.12, R1 = hr * 3.2, R2 = R1 + (i % 3 ? 10 : 22);
        g.globalAlpha = 0.8 * k; g.lineWidth = i % 3 ? 3 : 6;
        g.beginPath(); g.moveTo(q.x + Math.cos(a) * R1, cy + Math.sin(a) * R1); g.lineTo(q.x + Math.cos(a) * R2, cy + Math.sin(a) * R2); g.stroke();
      }
      g.restore();
      g.save();
      for (let i = 1; i <= 3; i++) {
        const lag = i * 0.06;
        const x = q.x - q.vx * lag, y = q.y - q.vy * lag;
        g.globalAlpha = (0.34 / i) * k;
        g.fillStyle = '#a67c52'; g.fillRect(x - C.BODY_W / 2, y - C.BODY_H, C.BODY_W, C.BODY_H);
        g.strokeStyle = '#a67c52'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y - C.BODY_H - hr + 8, hr, 0, TAU); g.stroke();
      }
      g.restore();
    },

    front(g, e, s) {
      const q = s.M.players[e.target], hy = s.headY(q), hr = s.headR(q), k = fade(e, 0.3, 0.3);
      const x = q.x - q.side * (hr + 44), y = hy - 6;
      s.fx.drawGlow(g, x, y, 90, '#e6c88a', 0.6 * k);
      s.fx.drawGlow(g, x, y, 50, '#7209b7', 0.5 * k);
      hourglass(g, x, y, 84, 1 - e.t / e.life, Math.sin(s.t * 1.5) * 0.15, k, s.t);
      // the ball, in slow motion too: sepia echoes of it trailing behind, a purple time ring
      const b = s.M.ball;
      g.save();
      for (let i = 4; i >= 1; i--) {
        g.globalAlpha = (0.4 / i) * k; g.fillStyle = i % 2 ? '#a67c52' : '#7209b7';
        g.beginPath(); g.arc(b.x - b.vx * 0.045 * i, b.y - b.vy * 0.045 * i, b.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#7209b7'; g.lineWidth = 3;
      const a0 = s.t * 1.2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(b.x, b.y, b.r + 9, a0 + i * TAU / 4, a0 + i * TAU / 4 + 1); g.stroke(); }
      g.restore();
      if (k > 0.3) keyline(g, b.x, b.y, b.r);
    },

    over(g, e, s) {
      const { C } = s, k = fade(e, 0.4, 0.5);
      g.save();
      g.globalAlpha = 0.08 * k; g.fillStyle = '#a67c52'; g.fillRect(0, 0, C.W, C.H);
      // slow-motion letterbox, outside the pitch (above the ceiling, below the grass)
      g.globalAlpha = 0.5 * k; g.fillStyle = '#5b3a1e';
      g.fillRect(0, 0, C.W, 24 * k); g.fillRect(0, C.H - 24 * k, C.W, 24 * k);
      g.restore();
    },

    tick(e, s) {
      const q = s.M.players[e.target], { fx } = s, hy = s.headY(q), hr = s.headR(q);
      fx.emit({ shape: 'sq', x: q.x + fx.rand(-hr - 30, hr + 30), y: hy - hr - fx.rand(0, 24), vy: fx.rand(25, 45), grav: 50, r: 3, life: 1.3, color: '#e6c88a', color2: '#a67c52' });
      if (Math.random() < 0.3) fx.emit({ shape: 'sq', x: q.x + fx.rand(-hr, hr), y: hy - hr - 10, vy: 30, r: 2, life: 1, color: '#f6ead0' });
      if (Math.random() < 0.03) fx.ring(q.x, (hy + q.y) / 2, { color: '#7209b7', r: 20, r1: 100, life: 1.2, w: 4, alpha: 0.6 });
      fx.emit({ shape: 'sq', x: fx.rand(0, s.C.W), y: s.C.CEIL_Y, vy: fx.rand(30, 60), r: 3, life: 2.4, color: '#e6c88a', color2: '#a67c52', layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s, p = spot(s, ev.x, ev.y - 90);
      fx.rays(ev.x, ev.y, { color: '#7209b7', color2: '#e6c88a', n: 14, r1: 320, life: 1, spin: 0.3 });
      fx.glow(ev.x, ev.y, 140, '#7209b7', { life: 0.8 });
      fx.stamp(p.x, p.y, 'איטי!', { color: '#e6c88a', edge: '#5b3a1e', r: 52, life: 1.3, vy: -12 });
      fx.burst(ev.x, ev.y, 60, { shape: 'sq', speed: 220, r: 4, drag: 1, grav: 80, life: 1.4, color: '#e6c88a', color2: '#a67c52' });
      fx.rays(ev.x, ev.y, { color: '#e6c88a', n: 10, r: 20, r1: 560, life: 1, alpha: 0.28, spin: -0.2 });
      fx.ring(ev.x, ev.y, { color: '#5b3a1e', r: 20, r1: 300, life: 1.1, w: 12, alpha: 0.7 });
      fx.glyph(ev.x, ev.y - 40, '⏳', { r: 44, vy: -30, spin: 0.6, life: 1.4 });
      fx.vignette('#7209b7', 0.45, 1.2);
      fx.ring(ev.x, ev.y, { color: '#7209b7', r1: 150, life: 1, w: 6 });
      fx.tint('#a67c52', 0.12, 0.7);
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e && info.e.target != null ? s.M.players[info.e.target] : s.foe;
      const p = spot(s, q.x, s.headY(q) - 70);
      fx.stamp(p.x, p.y, 'מהר!', { color: '#f6ead0', edge: '#5b3a1e', r: 52, life: 0.8 });
      fx.rays(q.x, q.y - 30, { color: '#e6c88a', color2: '#7209b7', n: 14, r1: 320, life: 0.45, spin: 4 });
      fx.burst(q.x, q.y - 30, 18, { shape: 'streak', speed: 800, r: 12, w: 3, drag: 2, life: 0.35, color: '#f6ead0', blend: 'lighter' });
      fx.burst(q.x, q.y - 30, 30, { shape: 'sq', speed: 120, spread: 1.4, angle: Math.PI / 2, r: 3.5, grav: 900, life: 0.6, color: '#e6c88a' });
      fx.ring(q.x, q.y - 30, { color: '#f6ead0', r1: 130, life: 0.25, w: 4 });
      fx.glow(q.x, q.y - 30, 90, '#e6c88a', { life: 0.5 });
    },
  },

  // ── 42 · clone — hologram keeper ──────────────────────────────────────────
  clone: {
    theme: 'Hologram keeper',
    visual: 'a flickering blue scanline hologram of the champion on a turning wireframe pad, a projector cone from the owner, hologram ripples when it saves',
    palette: ['#4ea0ff', '#9fd4ff', '#16407a', '#e3f3ff', '#2de2ff'],
    doc: {
      fantasy: 'You project a hologram of yourself into your own goal: a light-keeper that walks to the ball, jumps and blocks.',
      purpose: 'A second defender for 6 seconds, so the champion can attack and still be covered. It teaches that a goal can be guarded by something with no head of its own to fake.',
      player: 'Fill the meter, press POWER, then touch the ball: it is struck forward (1.0× kick, 0.9 lift) and a clone appears 60px out from your goal line for 6s. It patrols 26–120px from the line tracking the ball at player speed, jumps (1.02× jump) at balls coming above its head within 150px, and blocks power shots like a defender (no health lost).',
      bot: 'Arms on defence (POWERS.clone.arm = "defend": the ball in its own half) with the keeper style (aggression −0.1, tackle 0.9): it sets the clone up, then pushes forward itself.',
      sequence: {
        anticipation: 'While armed, a flickering holographic double hangs just behind the champion in a blue glow, fed by a thin projector line, on its own small wireframe pad. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant scanline hologram of the keeper stands under the band on a huge turning wireframe pad, lit blue. Then "שכפול!": a blue sunburst and light, a thick energy beam fires from the champion\'s chest to the spot in the goal where the clone will stand, 40 light cells and streaks, blue screen edges and a shake. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'A blue hologram keeper — translucent body and head disc, scanlines scrolling, a bright scan bar running down, visor eyes, random flicker — inside a blue glow and a half-dome force field, standing on a big turning wireframe pad; behind it a hologram grid screens the goal mouth with a scan sweep, and a projector cone from the owner feeds it; pixels drift up off it. The goal mouth is screened by a honeycomb force field whose cells light up in a wave, a light pillar rises off a 96px pad, and the whole pitch is inside the projection: a scan bar sweeps the screen, HUD corner brackets frame it and data readouts tick along the top. The clone has the ball locked — a dashed tracking line from its visor to targeting brackets round the ball, keyline drawn last — and holo pixels float up all over.',
        impact: 'On arrival: a white beam drops from the ceiling onto the pad and the figure materialises in falling light cells. On a save: "הצלה!" — a blue sunburst, hologram ripple rings at the ball, 40 cells, blue confetti, light, and the figure wobbling for 0.4s. A save now throws 60 cells, 26 confetti, a second sunburst, a dark shockwave and a beam to the ceiling.',
        aftermath: 'When its 6s run out it collapses into a horizontal line that streaks out, the cells fall and a blue glow fades.',
        cleanup: 'Cells and streaks live ≤0.8s, confetti ≤1.6s; the figure, grid and dome are drawn only while the record lives.',
      },
      layers: 'Cut-in: giant hologram (scaled holo) on a giant pad, drawGlow. Back: hologram grid over the goal mouth with scan sweep, projector cone (gradient), wireframe pad, drawGlow. Front: hologram figure (fill, clipped scanlines, scan bar, outline, eyes), force-field dome, drawGlow, save ripple. Particles: cells, rings, streaks, beams, rays, glows, stamp, confetti.',
      camera: 'Shake 6 and a 1.2s blue vignette on firing; a 0.12s pale-blue flash as it materialises; shake 7 on a save.',
      hud: 'The figure flickers harder in its last second; no status pill (it targets no one).',
      audio: 'Fire: a projector hum — two square sweeps an octave apart. Impact: a bright deflection zap. End: a descending power-down.',
      counterplay: 'It follows the ball\'s x and jumps late: shoot low along the grass past its feet, or high to the far post just after it lands; it only lasts 6s, so keep the ball until it fades.',
      perf: 'Figure ≈ 35 canvas calls (one clip); pad 11 strokes; grid ≈ 20 strokes; dome 2; 3 drawGlow; ≤1 tick particle a frame; no shadowBlur. Opener ≈ 60 particles, save ≈ 70. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.beam, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(sq/streak/ring), fx.burst, fx.ring, fx.flash, fx.shake, createLinearGradient, s.C (HEAD_R, BODY_W/H).',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 200, to: 600, type: 'square', peak: 0.16, dur: 0.4 }, { k: 'sweep', from: 400, to: 1200, type: 'square', peak: 0.12, dur: 0.4, detune: 6 }],
      impact: [{ k: 'blip', freq: 2600, type: 'sawtooth', peak: 0.3, dur: 0.1 }, { k: 'thud', freq: 1200, q: 2, peak: 0.5, decay: 0.2 }],
      end: [{ k: 'sweep', from: 1200, to: 150, type: 'square', peak: 0.15, dur: 0.45 }],
    },

    aura(g, p, s) {
      const { fx, C } = s;
      const a = Math.random() < 0.1 ? 0.4 : 0.85, x = p.x - p.side * 46;
      beacon(g, s, p, '#4ea0ff', '#16407a');
      fx.drawGlow(g, x, p.y - 40, 90, '#4ea0ff', 0.65);
      holoFloor(g, x, p.y, 1, s.t, 44);
      holo(g, x, p.y, s, a, p.side);
      g.save();
      g.globalAlpha = 0.6; g.strokeStyle = '#2de2ff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x, p.y - C.BODY_H / 2); g.lineTo(x, p.y - C.BODY_H - C.HEAD_R); g.stroke();
      g.restore();
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      const x = C.W / 2 - s.side * 230, y = C.H - 8;
      const grow = 1 - (1 - clamp(k / 0.3, 0, 1)) ** 2;
      fx.drawGlow(g, x, y - 130, 220, '#4ea0ff', 0.6 * a);
      g.save();
      g.translate(x, y);
      g.scale(3 * grow + 0.01, 3);
      holoFloor(g, 0, 0, a, s.t, 40);
      holo(g, 0, 0, s, a * (Math.random() < 0.08 ? 0.5 : 1), s.side);
      g.restore();
    },

    fire(s, at) {
      const { fx, owner: o, C } = s;
      const cx = o.side > 0 ? C.GOAL_W + 60 : C.W - C.GOAL_W - 60;
      const ox = o.x, oy = o.y - C.BODY_H / 2;
      opener(s, { x: ox, y: oy }, { col: '#4ea0ff', col2: '#2de2ff', hot: '#e3f3ff', word: 'שכפול!', wordCol: '#9fd4ff', edge: '#16407a' });
      fx.beam(ox, oy, cx, C.GROUND_Y - 50, { color: '#2de2ff', w: 24, life: 0.55 });
      fx.glow(cx, C.GROUND_Y - 50, 120, '#4ea0ff', { life: 0.7 });
      fx.emit({ shape: 'star', x: ox, y: oy, r: 16, r1: 40, life: 0.25, color: '#e3f3ff', blend: 'lighter' });
      const ang = Math.atan2(C.GROUND_Y - 40 - oy, cx - ox);
      fx.burst(ox, oy, 14, { shape: 'streak', speed: 800, spread: 0.3, angle: ang, r: 10, w: 3, life: 0.35, color: '#4ea0ff', blend: 'lighter' });
      fx.burst(ox, oy, 36, { shape: 'sq', speed: 300, r: 4, drag: 2, life: 0.6, color: '#9fd4ff', color2: '#4ea0ff' });
      fx.ring(at.x, at.y, { color: '#9fd4ff', r1: 100, life: 0.35, w: 4 });
    },

    back(g, e, s) {
      const o = s.owner, { C, fx } = s, k = fade(e, 0.3, 0.5);
      // the hologram grid screening the goal mouth
      const gx = o.side > 0 ? 0 : C.W, w = C.GOAL_W + 170, top = C.GROUND_Y - 220;
      const x0 = o.side > 0 ? gx : gx - w;
      // the whole pitch is inside the projection: a scan bar sweeping the screen, HUD corner
      // brackets, and data readouts ticking along the ceiling
      g.save();
      g.globalCompositeOperation = 'lighter';
      const sy0 = C.CEIL_Y + ((s.t * 140) % (C.GROUND_Y - C.CEIL_Y));
      g.globalAlpha = 0.4 * k; g.fillStyle = '#2de2ff'; g.fillRect(0, sy0, C.W, 3);
      g.globalAlpha = 0.1 * k; g.fillRect(0, sy0 - 26, C.W, 26);
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'square';
      const B = 70, m = 110, y0 = C.CEIL_Y + 60, y1 = C.GROUND_Y - 150;
      for (const [w2, c, al] of [[9, '#16407a', 0.8], [4, '#9fd4ff', 1]]) {
        g.lineWidth = w2; g.strokeStyle = c; g.globalAlpha = al * k;
        g.beginPath();
        g.moveTo(m, y0 + B); g.lineTo(m, y0); g.lineTo(m + B, y0);
        g.moveTo(C.W - m - B, y0); g.lineTo(C.W - m, y0); g.lineTo(C.W - m, y0 + B);
        g.moveTo(m, y1 - B); g.lineTo(m, y1); g.lineTo(m + B, y1);
        g.moveTo(C.W - m - B, y1); g.lineTo(C.W - m, y1); g.lineTo(C.W - m, y1 - B);
        g.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const on = hash(i * 7 + Math.floor(s.t * 6)) > 0.35;
        g.globalAlpha = (on ? 0.85 : 0.25) * k; g.fillStyle = i % 4 ? '#4ea0ff' : '#e3f3ff';
        g.fillRect(C.W / 2 - 18 * 9 + i * 18, y0 + 4, 12, 6);
      }
      g.restore();
      g.save();
      // a honeycomb force field screening the goal mouth, cells lighting up in a wave
      g.lineWidth = 2;
      const HR = 17, seedc = Math.floor(s.t * 5);
      for (let row = 0; row * HR * 1.5 < C.GROUND_Y - top; row++) {
        for (let col = 0; col * HR * 1.73 < w; col++) {
          const hx = x0 + col * HR * 1.73 + (row % 2) * HR * 0.87 + 10, hy2 = C.GROUND_Y - 8 - row * HR * 1.5;
          const wave = 0.5 + 0.5 * Math.sin(s.t * 4 - row * 0.6 - col * 0.4);
          hexPath(g, hx, hy2, HR - 2);
          if (hash(row * 31 + col * 7 + seedc) > 0.8) { g.globalAlpha = 0.35 * k; g.fillStyle = '#4ea0ff'; g.fill(); }
          g.globalAlpha = (0.2 + 0.4 * wave) * k; g.strokeStyle = wave > 0.8 ? '#e3f3ff' : '#2de2ff'; g.stroke();
        }
      }
      const sy = top + ((s.t * 90) % (C.GROUND_Y - top));
      g.globalAlpha = 0.45 * k; g.fillStyle = '#9fd4ff'; g.fillRect(x0, sy, w, 3);
      g.restore();
      fx.drawGlow(g, e.x, C.GROUND_Y, 120, '#2de2ff', 0.55 * k);
      holoFloor(g, e.x, C.GROUND_Y, k, s.t, 96);
      // a light pillar rising off the pad
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pg = g.createLinearGradient(0, C.GROUND_Y, 0, C.GROUND_Y - 200);
      pg.addColorStop(0, '#4ea0ff'); pg.addColorStop(1, 'rgba(78,160,255,0)');
      g.globalAlpha = 0.55 * k; g.fillStyle = pg; g.fillRect(e.x - 50, C.GROUND_Y - 220, 100, 220);
      g.restore();
      const ox = o.x - o.side * (C.BODY_W / 2), oy = o.y - C.BODY_H / 2;
      const hy = e.y - C.BODY_H - C.HEAD_R * 2 + 8;
      if (Math.abs(ox - e.x) > 30) {
        g.save();
        const gr = g.createLinearGradient(ox, oy, e.x, e.y);
        gr.addColorStop(0, '#9fd4ff'); gr.addColorStop(1, '#4ea0ff');
        g.globalAlpha = 0.14 * k; g.fillStyle = gr;
        g.beginPath(); g.moveTo(ox, oy - 4); g.lineTo(e.x, hy); g.lineTo(e.x, e.y); g.lineTo(ox, oy + 4); g.closePath(); g.fill();
        g.globalAlpha = 0.9 * k; g.fillStyle = '#16407a'; g.fillRect(ox - 5, oy - 5, 10, 10);
        g.fillStyle = '#2de2ff'; g.fillRect(ox - 3, oy - 3, 6, 6);
        g.restore();
        fx.drawGlow(g, ox, oy, 30, '#2de2ff', 0.6 * k);
      }
    },

    front(g, e, s) {
      const o = s.owner, k = fade(e, 0.3, 0.5), { C, fx } = s;
      const last = e.life - e.t < 1;
      const fl = Math.random() < (last ? 0.3 : 0.06) ? 0.35 : 1;
      const rip = s.t - cloneRipple;
      const wob = rip >= 0 && rip < 0.4 ? Math.sin(rip * 60) * 5 * (1 - rip / 0.4) : 0;
      const hy = e.y - C.BODY_H - C.HEAD_R + 8;
      fx.drawGlow(g, e.x, (hy + e.y) / 2, 120, '#4ea0ff', 0.55 * k * fl);
      holo(g, e.x + wob, e.y, s, k * fl, o.side);
      // it has the ball locked: a dashed tracking line from its visor and brackets on the ball
      const b = s.M.ball, bd = s.depth(b.x, b.y);
      g.save();
      g.globalAlpha = 0.6 * k; g.strokeStyle = '#2de2ff'; g.lineWidth = 2;
      g.setLineDash([6, 8]); g.lineDashOffset = -s.t * 60;
      g.beginPath(); g.moveTo(e.x, hy); g.lineTo(bd.x, bd.y); g.stroke();
      g.setLineDash([]);
      g.translate(bd.x, bd.y); g.rotate(s.t * 1.5);
      const Q = b.r + 12;
      for (const [w2, c] of [[7, '#16407a'], [3, '#9fd4ff']]) {
        g.globalAlpha = 0.95 * k; g.lineWidth = w2; g.strokeStyle = c;
        for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(Q, Q - 9); g.lineTo(Q, Q); g.lineTo(Q - 9, Q); g.stroke(); }
      }
      g.restore();
      if (k > 0.3) keyline(g, bd.x, bd.y, b.r);
      // the force-field dome
      g.save();
      g.globalAlpha = (0.35 + 0.15 * Math.sin(s.t * 6)) * k * fl; g.strokeStyle = '#2de2ff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(e.x, e.y, C.HEAD_R + 30, e.y - hy + C.HEAD_R + 18, 0, Math.PI, TAU); g.stroke();
      g.globalAlpha *= 0.5; g.lineWidth = 2;
      g.beginPath(); g.ellipse(e.x, e.y, C.HEAD_R + 20, e.y - hy + C.HEAD_R + 8, 0, Math.PI + 0.3, TAU - 1.6); g.stroke();
      g.restore();
      if (wob) {
        g.save();
        g.strokeStyle = '#2de2ff'; g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          g.globalAlpha = 0.65 * (1 - rip / 0.4);
          g.beginPath(); g.ellipse(e.x, (hy + e.y) / 2, 20 + i * 12 + rip * 90, 30 + i * 12 + rip * 90, 0, 0, TAU); g.stroke();
        }
        g.restore();
      }
    },

    tick(e, s) {
      const { fx, C } = s;
      if (Math.random() < 0.6) fx.emit({ shape: 'sq', x: e.x + fx.rand(-C.HEAD_R, C.HEAD_R), y: e.y - fx.rand(0, 80), vy: -60, r: 3.5, life: 0.6, color: '#9fd4ff', color2: '#4ea0ff' });
      const q = anywhere(s);
      fx.emit({ shape: 'sq', x: q.x, y: q.y, vy: -30, r: 4, life: 0.8, color: '#4ea0ff', color2: '#16407a', layer: 'back' });
      if (Math.random() < 0.3) fx.emit({ shape: 'sq', x: e.x + fx.rand(-40, 40), y: C.GROUND_Y, vy: -fx.rand(120, 220), r: 3, life: 0.9, color: '#e3f3ff', blend: 'lighter', layer: 'back' });
    },

    impact(s, ev) {
      const { fx, C } = s;
      if (ev.kind === 'land') {
        const e = ev.e;
        fx.beam(e.x, C.CEIL_Y, e.x, C.GROUND_Y, { color: '#4ea0ff', w: 44, life: 0.45 });
        fx.glow(e.x, C.GROUND_Y - 50, 110, '#2de2ff', { life: 0.6 });
        fx.ring(e.x, C.GROUND_Y, { color: '#2de2ff', r1: 110, life: 0.5, w: 5 });
        for (let i = 0, n = fx.n(20); i < n; i++) {
          fx.emit({ shape: 'sq', x: e.x + fx.rand(-C.HEAD_R, C.HEAD_R), y: e.y - 150 - fx.rand(0, 60), vy: 380, r: 3.5, life: 0.4, color: '#9fd4ff', color2: '#e3f3ff' });
        }
        fx.flash('#9fd4ff', 0.14, 0.12);
        return;
      }
      cloneRipple = s.t;
      const p = spot(s, ev.x, ev.y - 80);
      fx.rays(ev.x, ev.y, { color: '#4ea0ff', color2: '#2de2ff', n: 16, r1: 360, life: 0.7 });
      fx.glow(ev.x, ev.y, 140, '#4ea0ff', { life: 0.6 });
      fx.stamp(p.x, p.y, 'הצלה!', { color: '#9fd4ff', edge: '#16407a', r: 56 });
      for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, { color: i === 1 ? '#2de2ff' : '#9fd4ff', r: 6 + i * 8, r1: 80 + i * 40, life: 0.35 + i * 0.12, w: 5 });
      fx.burst(ev.x, ev.y, 60, { shape: 'sq', speed: 420, r: 5, drag: 2, life: 0.7, color: '#4ea0ff', color2: '#e3f3ff' });
      fx.confetti(ev.x, ev.y, 26, ['#4ea0ff', '#9fd4ff', '#2de2ff', '#e3f3ff']);
      fx.rays(ev.x, ev.y, { color: '#9fd4ff', n: 10, r: 20, r1: 600, life: 0.6, alpha: 0.3, spin: -1 });
      fx.ring(ev.x, ev.y, { color: '#16407a', r: 20, r1: 260, life: 0.6, w: 12, alpha: 0.7 });
      fx.beam(ev.x, ev.y, ev.x, s.C.CEIL_Y, { color: '#2de2ff', w: 26, life: 0.4 });
      fx.vignette('#4ea0ff', 0.45, 0.9);
      fx.shake(7, 0.3);
    },

    end(s, info) {
      const { fx, C } = s, e = info.e || { x: s.owner.x, y: C.GROUND_Y };
      const my = e.y - C.BODY_H;
      fx.emit({ shape: 'streak', x: e.x, y: my, vx: 480, r: 12, w: 4, life: 0.3, color: '#2de2ff', blend: 'lighter' });
      fx.emit({ shape: 'streak', x: e.x, y: my, vx: -480, r: 12, w: 4, life: 0.3, color: '#2de2ff', blend: 'lighter' });
      fx.ring(e.x, my, { color: '#9fd4ff', r: 50, r1: 2, life: 0.35, w: 4 });
      fx.glow(e.x, my, 90, '#4ea0ff', { life: 0.8, alpha: 0.6 });
      for (let i = 0, n = fx.n(16); i < n; i++) fx.emit({ shape: 'sq', x: e.x + fx.rand(-24, 24), y: my + fx.rand(-36, 20), vy: 120, grav: 400, r: 3.5, life: 0.7, color: '#16407a', color2: '#4ea0ff' });
    },
  },

  // ── 43 · split — prism refraction ─────────────────────────────────────────
  split: {
    theme: 'Prism refraction',
    visual: 'a clear crystal ball that refracts through a prism flash into three spectral bands — red high, green straight, violet low — each with its own light trail',
    palette: ['#ff3b5c', '#39ff88', '#a24bff', '#ff006e', '#eef6ff'],
    doc: {
      fantasy: 'Your shot hits a crystal prism in mid-air and fans into three beams of coloured light, each one a real ball.',
      purpose: 'One shot the defender must answer three times: straight, high and low. It is the power that makes a single body in the line not enough.',
      player: 'Fill the meter, press POWER, then touch the ball. It leaves flat at 1.0× (1000 px/s) and 0.15s later splits: the ball carries on straight, and two extra power balls fly out high (climbing at 0.32× speed) and low (dropping at 0.2× speed). The extras live 1.8s; any of the three can score.',
      bot: 'Arms on attack (POWERS.split.arm = "attack") with the striker style (aggression +0.06): it fires from your half so the fan is wide when it reaches the goal.',
      sequence: {
        anticipation: 'While armed, a big crystal prism floats in front of the champion\'s head in white light, turning, throwing three thick coloured rays forward — the three lines the shot will take — each ending in a coloured light pool. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant prism under the band catches a white beam from the champion\'s side and fans it into a six-colour rainbow across the screen. Then "קשת!": a magenta and white sunburst, 36 rainbow splinters, rainbow confetti, a white star and a magenta ring, magenta screen edges. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'For 0.15s a clear crystal ball in a white glow with a turning prism inside and red/green/violet edge arcs; then three balls, each inside a glow of its band, dragging a thick beam tail of its own colour with a white core and trail echoes, each with a white outline drawn last. The shot flies under a rainbow sky: six spectral ribbons wave right across the top of the pitch and five prism triangles turn in it, rainbow shards glinting all over. Each band ball drags a 200px dark-edged comet beam with a white core and star sparkles, and a keyline drawn last.',
        impact: 'At the split ("split"): "x3!" — a white prism triangle flashes, three coloured energy beams fire along the three real trajectories, a rainbow sunburst, three coloured rings open, light and a shake. Blocked or scoring: "וואו!" — a sunburst, a burst in the scoring ball\'s band, rainbow confetti and sparks. The split adds 40 sparkles, 24 rainbow confetti and a dark shockwave; a goal adds 34 confetti and a second sunburst.',
        aftermath: 'Rainbow dust hangs a moment where the shot ended under a fading white glow.',
        cleanup: 'Streaks and sparks die inside 0.6s, confetti ≤1.6s; nothing else lingers.',
      },
      layers: 'Cut-in: white beam, giant prism, six-band rainbow fan, drawGlow. Crystal ball (drawGlow, prism triangle, rainbow arcs), band balls (drawGlow, beam tail, trail echoes, core gradient, outline), streak trails, prism flash, beams, rays, stamps, confetti, rings.',
      camera: 'Shake 6 and a 1.2s magenta vignette on firing; shake 6 at the split with a 0.12s crystal-white flash; shake 8 on impact.',
      hud: 'Nothing extra: three balls are the information.',
      audio: 'Fire: a glassy triad of triangle blips (a crystal chord). Impact: a bright crack with a high ring. End: a soft shimmer.',
      counterplay: 'Read the split point (0.15s after the touch, ~150px out) and cover the straight and low balls — the high one climbs and often clears the bar at range. Counter the straight one early, before it splits, to kill all three.',
      perf: 'Each ball ≈ 25 canvas calls + 1 drawGlow, with lighter halos instead of shadowBlur (three balls, no blur); 1 trail particle per ball per frame (≤3); opener ≈ 60 particles, split ≈ 40. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.beam, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(shard/star/streak), fx.burst, fx.ring, fx.flash, fx.shake, s.depth, createRadialGradient.',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 1318, type: 'triangle', peak: 0.3, dur: 0.3 }, { k: 'blip', freq: 1661, type: 'triangle', peak: 0.25, dur: 0.3, t: 0.03 }, { k: 'blip', freq: 1975, type: 'triangle', peak: 0.22, dur: 0.35, t: 0.06 }],
      impact: [{ k: 'thud', freq: 3000, q: 5, peak: 0.6, decay: 0.12 }, { k: 'blip', freq: 2637, type: 'sine', peak: 0.25, dur: 0.3 }],
      end: [{ k: 'blip', freq: 3951, type: 'sine', peak: 0.08, dur: 0.3 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), R = s.headR(p), { fx } = s;
      const x = p.x + p.side * (R + 24), y = hy - 6 + Math.sin(s.t * 3) * 3;
      const rays = [['#ff3b5c', -0.32], ['#39ff88', 0], ['#a24bff', 0.2]];
      beacon(g, s, p, '#ff006e', '#a24bff');
      fx.drawGlow(g, x, y, 60, '#eef6ff', 0.8);
      g.save();
      g.lineCap = 'round';
      for (const [c, sl] of rays) {
        g.globalAlpha = 0.7; g.strokeStyle = '#1b1030'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + p.side * 150, y + sl * 150); g.stroke();
        g.globalAlpha = 0.75 + 0.25 * Math.sin(s.t * 6);
        g.strokeStyle = c; g.lineWidth = 6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + p.side * 150, y + sl * 150); g.stroke();
      }
      g.restore();
      for (const [c, sl] of rays) fx.drawGlow(g, x + p.side * 150, y + sl * 150, 30, c, 0.9);
      g.save();
      g.translate(x, y); g.rotate(s.t * 2);
      g.globalAlpha = 0.9; g.fillStyle = '#eef6ff';
      g.beginPath(); g.moveTo(0, -15); g.lineTo(13, 9); g.lineTo(-13, 9); g.closePath(); g.fill();
      g.strokeStyle = '#ff006e'; g.lineWidth = 3; g.stroke();
      g.restore();
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      const px = C.W / 2, py = C.H * 0.72, S = 92, side = s.side;
      const x0 = side > 0 ? 0 : C.W, x1 = side > 0 ? C.W : 0;
      const reach = clamp(k * 3, 0, 1), fan = clamp(k * 3 - 0.6, 0, 1);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.9 * a; g.strokeStyle = '#eef6ff'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, py - 40); g.lineTo(x0 + (px - x0) * reach, py - 40 + 40 * reach); g.stroke();
      if (fan > 0) {
        const cols = ['#ff3b5c', '#ff8c2b', '#ffe14a', '#39ff88', '#3bc9ff', '#a24bff'];
        const L = (x1 - px) * fan;
        for (let i = 0; i < 6; i++) {
          g.globalAlpha = 0.55 * a; g.fillStyle = cols[i];
          g.beginPath(); g.moveTo(px, py);
          g.lineTo(px + L, py - 120 + i * 40 * fan); g.lineTo(px + L, py - 120 + (i + 1) * 40 * fan); g.closePath(); g.fill();
        }
      }
      g.restore();
      fx.drawGlow(g, px, py, 180, '#eef6ff', 0.7 * a);
      g.save();
      g.translate(px, py); g.rotate(Math.sin(k * 6) * 0.1);
      g.globalAlpha = 0.9 * a; g.fillStyle = '#eef6ff';
      g.beginPath(); g.moveTo(0, -S); g.lineTo(S * 0.87, S * 0.5); g.lineTo(-S * 0.87, S * 0.5); g.closePath(); g.fill();
      g.strokeStyle = '#ff006e'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#a24bff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -S * 0.6); g.lineTo(S * 0.5, S * 0.3); g.lineTo(-S * 0.5, S * 0.3); g.closePath(); g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      opener(s, at, { col: '#ff006e', col2: '#eef6ff', hot: '#ffffff', word: 'קשת!', wordCol: '#eef6ff', edge: '#a24bff' });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 18, r1: 44, life: 0.25, color: '#eef6ff', blend: 'lighter' });
      fx.ring(at.x, at.y, { color: '#ff006e', r1: 120, life: 0.4, w: 5 });
      const cols = ['#ff3b5c', '#39ff88', '#a24bff'];
      for (let i = 0, n = fx.n(36); i < n; i++) {
        const a = (i / n) * TAU, v = fx.rand(200, 380);
        fx.emit({ shape: 'shard', x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: a, r: 6, drag: 2, life: 0.55, color: cols[i % 3], blend: 'lighter' });
      }
      fx.confetti(at.x, at.y, 16, ['#ff3b5c', '#39ff88', '#a24bff', '#ff006e', '#ffe14a', '#3bc9ff']);
    },

    ball(g, b, s) {
      const pw = b.power, d = s.depth(b.x, b.y), r = b.r * 1.25, { fx } = s;
      if (b === s.M.ball) aurora(g, s, clamp(Math.min((pw.t || 0) / 0.2, ((pw.life || 1.6) - (pw.t || 0)) / 0.4), 0, 1));
      if (!pw.split) {
        fx.drawGlow(g, d.x, d.y, r * 5, '#eef6ff', 0.85);
        fx.drawGlow(g, d.x, d.y, r * 3, '#ff006e', 0.5);
        g.save();
        g.translate(d.x, d.y);
        g.globalAlpha = 0.9; g.fillStyle = '#eef6ff';
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        const cols = ['#ff3b5c', '#39ff88', '#a24bff'];
        g.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const a = s.t * 8 + (i / 3) * TAU;
          g.strokeStyle = cols[i]; g.globalAlpha = 0.95;
          g.beginPath(); g.arc(0, 0, r + 5, a, a + 1.6); g.stroke();
        }
        g.rotate(-s.t * 6);
        g.globalAlpha = 0.95; g.strokeStyle = '#ff006e'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, -r * 0.7); g.lineTo(r * 0.6, r * 0.4); g.lineTo(-r * 0.6, r * 0.4); g.closePath(); g.stroke();
        g.restore();
        g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(d.x, d.y, r, 0, TAU); g.stroke(); g.restore();
        return;
      }
      const col = pw.slope == null ? '#39ff88' : pw.slope < 0 ? '#ff3b5c' : '#a24bff';
      const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      fx.drawGlow(g, d.x, d.y, r * 4.4, col, 0.85);
      g.save();
      g.lineCap = 'round';
      // a long comet beam of its band, dark-edged so it reads over a bright stadium
      g.globalAlpha = 0.55; g.strokeStyle = '#1b1030'; g.lineWidth = r * 1.6 + 6;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - ux * 200, d.y - uy * 200); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.7; g.strokeStyle = col; g.lineWidth = r * 1.6;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - ux * 200, d.y - uy * 200); g.stroke();
      g.globalAlpha = 0.8; g.strokeStyle = '#eef6ff'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - ux * 150, d.y - uy * 150); g.stroke();
      g.fillStyle = col;
      for (let i = 1; i <= 4; i++) {
        g.globalAlpha = 0.35 / i;
        g.beginPath(); g.arc(d.x - ux * i * 15, d.y - uy * i * 15, r * (1 - i * 0.12), 0, TAU); g.fill();
      }
      g.globalAlpha = 0.4;
      g.beginPath(); g.arc(d.x, d.y, r + 9, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      const gr = g.createRadialGradient(d.x - r * 0.3, d.y - r * 0.3, 1, d.x, d.y, r);
      gr.addColorStop(0, '#eef6ff'); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, r, 0, TAU); g.fill();
      g.restore();
      keyline(g, d.x, d.y, r);
    },

    trail(b, s) {
      const pw = b.power, { fx } = s;
      const col = !pw.split ? '#eef6ff' : pw.slope == null ? '#39ff88' : pw.slope < 0 ? '#ff3b5c' : '#a24bff';
      fx.emit({ shape: 'streak', x: b.x, y: b.y, vx: -b.vx * 0.2, vy: -b.vy * 0.2, r: 10, w: 5, life: 0.28, color: col, blend: 'lighter' });
      fx.emit({ shape: 'star', x: b.x - dirOf(b) * 20, y: b.y + fx.rand(-16, 16), vy: fx.rand(-40, 40), r: 7, r1: 1, spin: 8, life: 0.6, color: col, color2: '#eef6ff', blend: 'lighter' });
      if (b === s.M.ball) { const q = anywhere(s); fx.emit({ shape: 'shard', x: q.x, y: q.y, vy: 20, rot: fx.rand(0, TAU), spin: 2, r: 7, life: 1, color: ['#ff3b5c', '#39ff88', '#a24bff', '#ffe14a', '#3bc9ff'][Math.floor(fx.rand(0, 5))], blend: 'lighter', layer: 'back' }); }
    },

    impact(s, ev) {
      const { fx, owner } = s;
      if (ev.kind === 'split') {
        const b = s.M.ball, dir = b.power ? b.power.dir : owner.side;
        const p = spot(s, b.x, b.y - 80);
        fx.rays(b.x, b.y, { color: '#ff3b5c', color2: '#39ff88', n: 18, r1: 320, life: 0.6 });
        fx.glow(b.x, b.y, 130, '#eef6ff', { life: 0.45 });
        fx.stamp(p.x, p.y, 'x3!', { color: '#eef6ff', edge: '#a24bff', r: 60 });
        fx.emit({ shape: 'shard', x: b.x, y: b.y, rot: -Math.PI / 2, r: 30, r1: 44, life: 0.35, color: '#eef6ff', blend: 'lighter' });
        fx.emit({ shape: 'star', x: b.x, y: b.y, r: 24, r1: 60, life: 0.2, color: '#ffffff', blend: 'lighter' });
        const rays = [['#ff3b5c', -0.32], ['#39ff88', 0], ['#a24bff', 0.2]];
        for (const [c, sl] of rays) {
          const a = Math.atan2(sl, dir);
          fx.beam(b.x, b.y, b.x + Math.cos(a) * 280, b.y + Math.sin(a) * 280, { color: c, w: 16, life: 0.35 });
          fx.burst(b.x, b.y, 8, { shape: 'streak', speed: 700, spread: 0.18, angle: a, r: 12, w: 3, life: 0.3, color: c, blend: 'lighter' });
          fx.ring(b.x, b.y, { color: c, r1: 80 + sl * 60 + 30, life: 0.4, w: 4 });
        }
        fx.burst(b.x, b.y, 40, { shape: 'star', speed: 520, r: 7, r1: 2, spin: 9, drag: 1.5, life: 0.7, color: '#eef6ff', color2: '#ff006e', blend: 'lighter' });
        fx.confetti(b.x, b.y, 24, ['#ff3b5c', '#39ff88', '#a24bff', '#ff006e', '#ffe14a', '#3bc9ff']);
        fx.ring(b.x, b.y, { color: '#1b1030', r: 20, r1: 240, life: 0.5, w: 12, alpha: 0.6 });
        fx.flash('#eef6ff', 0.18, 0.12);
        fx.shake(6, 0.25);
        return;
      }
      const pw = s.M.ball.power;
      const col = pw && pw.champ === 'split' && pw.slope != null ? (pw.slope < 0 ? '#ff3b5c' : '#a24bff') : '#39ff88';
      const p = spot(s, ev.x, ev.y - 80);
      fx.rays(ev.x, ev.y, { color: col, color2: '#eef6ff', n: 18, r1: 400, life: 0.75 });
      fx.glow(ev.x, ev.y, 160, col, { life: 0.6 });
      fx.stamp(p.x, p.y, 'וואו!', { color: '#eef6ff', edge: '#a24bff', r: 58 });
      fx.ring(ev.x, ev.y, { color: col, r1: 160, life: 0.5, w: 7 });
      fx.burst(ev.x, ev.y, 26, { shape: 'shard', speed: 440, r: 6, spin: 12, grav: 500, life: 0.7, color: col, color2: '#eef6ff' });
      fx.burst(ev.x, ev.y, 16, { shape: 'star', speed: 300, r: 5, life: 0.55, color: '#ff006e', blend: 'lighter' });
      fx.confetti(ev.x, ev.y, 34, ['#ff3b5c', '#39ff88', '#a24bff', '#ff006e', '#ffe14a', '#3bc9ff']);
      fx.rays(ev.x, ev.y, { color: '#ff006e', color2: '#39ff88', n: 12, r: 20, r1: 620, life: 0.5, alpha: 0.18, spin: -1 });
      fx.ring(ev.x, ev.y, { color: '#a24bff', r: 20, r1: 280, life: 0.6, w: 12, alpha: 0.7 });
      fx.vignette('#ff006e', 0.35, 0.8);
      fx.shake(8, 0.35);
    },

    end(s) {
      const { fx } = s, b = s.M.ball, cols = ['#ff3b5c', '#39ff88', '#a24bff'];
      for (let i = 0, n = fx.n(15); i < n; i++) fx.emit({ shape: 'star', x: b.x + fx.rand(-22, 22), y: b.y + fx.rand(-22, 22), vy: -20, r: 4, life: 0.6, color: cols[i % 3], blend: 'lighter' });
      fx.glow(b.x, b.y, 70, '#eef6ff', { life: 0.6, alpha: 0.6 });
    },
  },

  // ── 44 · tornado — twister storm ──────────────────────────────────────────
  tornado: {
    theme: 'Twister storm',
    visual: 'a dark grey funnel cloud of stacked swirling rings leaning into its path, orbiting planks, leaves and dust clods, a dust skirt on the grass, the ball spun in its wind',
    palette: ['#4a4f58', '#7e858f', '#94d2bd', '#8b5a2b', '#c9b68a', '#2b2e34'],
    doc: {
      fantasy: 'You kick up a twister that tears across the pitch toward their goal, sweeping the ball up and throwing anyone in its way.',
      purpose: 'An attack that is a moving obstacle: the defender has to decide whether to fight the tornado for the ball or get out of its path. It is the most "several moving parts" power in the finale.',
      player: 'Fill the meter, press POWER, then touch the ball: the ball is popped forward (200 px/s, up 150) and a tornado spawns there for up to 3.6s, crossing at 210 px/s toward the goal you attack. It grabs a loose ball within 58px and carries it at ~60% goal height; it throws the opponent (within 50px) away with a 0.9× tackle push and a small hit, at most every 0.5s. It stops 150px from the goal line, and if the ball is within 70px it fires it in as your flat power shot at 0.95× (950 px/s).',
      bot: 'Arms on attack (POWERS.tornado.arm = "attack") with the striker style (aggression +0.06): it fires in your half, then follows the tornado in.',
      sequence: {
        anticipation: 'While armed, a knee-high dust devil of seven swirling rings spins at the champion\'s feet in a sage glow, leaves circling it and grit rising off it. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: storm clouds roll across the top of the screen, a giant funnel sweeps across under the band and a lightning bolt cracks down into it. Then "וווש!": a sage sunburst, a lightning bolt, dust thrown along the grass, gust streaks, leaves and leaf confetti, dark screen edges and a shake. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'The whole pitch turns stormy: a dark sky (0.14) with rolling storm clouds along the ceiling, slanted rain, and lightning now and then striking the funnel top with a small flash. The funnel: 11 stacked rings of storm cloud 330px tall narrowing to the grass and leaning into its path, lit from inside by a sage eye glow and a dust glow at its base, swirl arcs spinning, 14 planks, leaves and clods orbiting (near side in front of bodies), a dust skirt churning. A ball it holds gets wind rings spinning round it. The fired shot is a grey ball in a big spinning vortex and sage glow with a tapered funnel tail and a pale outline drawn last. REWORKED: the funnel is now a towering near-black storm (0.93 opaque, 395px tall, 207px wide at the top) with a thick black outline and sage rim, lightning crackling INSIDE it 12 times a second, a white crown glow behind its top and a churning brown dust skirt at its foot. 24 pieces orbit it — planks, leaves, clods and a flying cow, bucket, tree and chicken — and debris is hurled across the whole pitch; lightning strikes the funnel or the grass anywhere, storm clouds along the ceiling are darker with lit rims. The shot is a ball with a sideways mini-twister for a tail, keyline drawn last.',
        impact: 'Touch-down: "סופה!" — a ground ring, a low dust burst, light, a shake and the pitch darkening. Blown: "עוף!" — planks and dust explode off the thrown player with a heavy shake. The shot blocked or scoring: "בום!" — a sunburst, debris burst, leaf confetti and a gust ring. Touch-down also throws 30 debris shards and a lightning bolt; a blow or impact throws 50 shards with a lightning strike, a dark shockwave and a flash.',
        aftermath: 'The funnel dissipates as puffs of grey cloud spiralling upward; the storm sky fades out with its record.',
        cleanup: 'Cloud puffs ≤1.4s, rain ≤0.45s; the sky, funnel and debris are drawn only while the record lives.',
      },
      layers: 'Cut-in: storm clouds, giant funnel, lightning with drawGlow. Back: storm sky wash (≤0.14) and cloud band, funnel ring fills, back swirl arcs, drawGlow eye and base, far-side debris. Front: front swirl arcs, near-side debris, wind rings on a held ball. Particles: rain streaks, lightning bolts, dust skirt, gust streaks, debris shards, cloud puffs, rays, glows, stamps, confetti.',
      camera: 'Shake 6 and a 1.2s storm vignette on firing; shake 6 at touch-down with a 1.2s storm tint (0.12); small 0.08s lightning flashes; shake 9 on a blow; 8 on the shot\'s impact.',
      hud: 'No status pill (it targets no one); being thrown shows the ordinary hit.',
      audio: 'Fire: a howling gust — a noise roar with a rising and falling sawtooth whistle. Impact: a heavy crashing thud with a gust. End: a fading wind.',
      counterplay: 'It moves at a steady 210 px/s along the ground: jump over it or step behind it and take the ball as it is released near the box; a ball above ~300px of the grass is not grabbed. Being 50px from it gets you thrown.',
      perf: 'Sky + clouds ≈ 20 canvas calls; funnel ≈ 60; 14 debris ≈ 80; 2 drawGlow; ≤4 particles a frame (rain, dust, debris, lightning); no shadowBlur; opener ≈ 75 particles. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.bolt, fx.emit(smoke/shard/streak/sq), fx.burst, fx.ring, fx.shake, fx.tint, fx.flash, s.depth.',
    },
    sounds: {
      fire: [{ k: 'crowd', dur: 0.9, peak: 0.35 }, { k: 'sweep', from: 300, to: 900, type: 'sawtooth', peak: 0.14, dur: 0.45 }, { k: 'sweep', from: 900, to: 400, type: 'sawtooth', peak: 0.12, dur: 0.45, t: 0.45 }],
      impact: [{ k: 'thud', freq: 140, q: 0.6, peak: 0.9, decay: 0.45 }, { k: 'crowd', dur: 0.5, peak: 0.25 }],
      end: [{ k: 'crowd', dur: 0.8, peak: 0.15 }],
    },

    aura(g, p, s) {
      const { fx } = s;
      beacon(g, s, p, '#94d2bd', '#2b2e34');
      fx.drawGlow(g, p.x, p.y - 20, 90, '#94d2bd', 0.6);
      g.save();
      for (let i = 0; i < 9; i++) {
        const f = i / 8, rx = 12 + f * 44, y = p.y - f * 92, cx = p.x + Math.sin(s.t * 4 + i) * 6 * f;
        const a0 = s.t * 10 + i;
        g.globalAlpha = 0.6; g.fillStyle = i % 2 ? '#2b2e34' : '#4a4f58';
        g.beginPath(); g.ellipse(cx, y, rx, rx * 0.25 + 2, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.95; g.lineWidth = 3; g.strokeStyle = i % 2 ? '#e8f4ff' : '#94d2bd';
        g.beginPath(); g.ellipse(cx, y, rx, rx * 0.25 + 2, 0, a0, a0 + 3); g.stroke();
      }
      if (Math.sin(s.t * 13) > 0.9) { g.globalAlpha = 1; g.strokeStyle = '#e8f4ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x + 10, p.y - 92); g.lineTo(p.x - 4, p.y - 60); g.lineTo(p.x + 6, p.y - 54); g.lineTo(p.x - 8, p.y - 24); g.stroke(); }
      for (let i = 0; i < 3; i++) {
        const a = s.t * 6 + (i / 3) * TAU, f = 0.3 + i * 0.25;
        g.save(); g.translate(p.x + Math.cos(a) * (14 + f * 30), p.y - f * 56 + Math.sin(a) * 6); g.rotate(a * 2);
        g.globalAlpha = 0.9; g.fillStyle = i % 2 ? '#94d2bd' : '#5e8c3a';
        g.beginPath(); g.ellipse(0, 0, 5, 2.5, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
      if (Math.random() < 0.4) {
        const a = fx.rand(0, TAU);
        fx.emit({ shape: 'sq', x: p.x + Math.cos(a) * 22, y: p.y - 4, vx: -Math.sin(a) * 90, vy: -80, r: 3, life: 0.5, color: '#c9b68a', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      g.save();
      g.fillStyle = '#2b2e34';
      for (let i = 0; i < 9; i++) {
        const x = ((i / 8) * C.W + k * 120 * s.side) % (C.W + 120) - 60, y = 30 + (i % 2) * 22;
        g.globalAlpha = 0.85 * a; g.fillStyle = i % 2 ? '#4a4f58' : '#2b2e34';
        g.beginPath(); g.ellipse(x, y, 90, 42, 0, 0, TAU); g.fill();
      }
      const bx = s.side > 0 ? 180 + k * 520 : C.W - 180 - k * 520, base = C.H - 10, H = 260;
      for (let i = 0; i < 12; i++) {
        const f = i / 11, rx = 18 + 130 * Math.pow(f, 1.4);
        g.globalAlpha = 0.85 * a; g.fillStyle = i % 2 ? '#1b1d22' : '#3a3f47';
        g.beginPath(); g.ellipse(bx + Math.sin(k * 14 + f * 5) * 16 * f, base - f * H, rx, rx * 0.22 + 4, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.8 * a; g.strokeStyle = '#94d2bd'; g.lineWidth = 3;
        const a0 = k * 30 + i;
        g.beginPath(); g.ellipse(bx + Math.sin(k * 14 + f * 5) * 16 * f, base - f * H, rx, rx * 0.22 + 4, 0, a0 % TAU, (a0 % TAU) + 1.6); g.stroke();
      }
      // a lightning bolt from the clouds into the funnel top
      if (k > 0.25 && k < 0.7) {
        g.globalAlpha = a; g.strokeStyle = '#e8f4ff'; g.lineWidth = 5; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(bx - 30, 60);
        for (let i = 1; i <= 5; i++) g.lineTo(bx - 30 + (hash(i + Math.floor(k * 20)) - 0.5) * 60 + i * 6, 60 + i * ((base - H - 60) / 5));
        g.stroke();
      }
      g.restore();
      if (k > 0.25 && k < 0.7) fx.drawGlow(g, bx, base - H, 150, '#e8f4ff', 0.6 * a);
      fx.drawGlow(g, bx, base - H * 0.4, 160, '#94d2bd', 0.4 * a);
    },

    fire(s, at) {
      const { fx, side, C } = s;
      opener(s, at, { col: '#94d2bd', col2: '#7e858f', hot: '#e8f4ff', word: 'וווש!', wordCol: '#e8f4ff', edge: '#2b2e34' });
      fx.bolt(at.x + fx.rand(-60, 60), C.CEIL_Y, at.x, at.y, { color: '#e8f4ff', w: 5, life: 0.3 });
      fx.ring(at.x, at.y, { color: '#94d2bd', r1: 150, life: 0.45, w: 6 });
      fx.burst(at.x, C.GROUND_Y - 4, 22, { shape: 'smoke', speed: 240, spread: 0.8, angle: side > 0 ? -0.3 : Math.PI + 0.3, r: 6, r1: 20, drag: 2, life: 0.9, color: '#c9b68a', layer: 'back' });
      fx.burst(at.x, at.y, 14, { shape: 'streak', speed: 600, spread: 0.5, angle: side > 0 ? 0 : Math.PI, r: 12, w: 3, life: 0.3, color: '#94d2bd' });
      fx.burst(at.x, at.y, 16, { shape: 'shard', speed: 380, r: 5, spin: 14, grav: 300, drag: 1, life: 0.9, color: '#5e8c3a', color2: '#8b5a2b' });
      fx.confetti(at.x, at.y, 12, ['#94d2bd', '#5e8c3a', '#c9b68a', '#8b5a2b']);
      fx.flash('#e8f4ff', 0.12, 0.08);
    },

    back(g, e, s) {
      const { C, fx } = s, H = funnelH(e), k = fade(e, 0.35, 0.4), N = 11;
      // the storm sky
      g.save();
      g.globalAlpha = 0.2 * k; g.fillStyle = '#2b2e34'; g.fillRect(0, 0, C.W, C.H);
      for (let i = 0; i < 11; i++) {
        const x = ((i / 10) * (C.W + 160) + s.t * 30 * e.dir) % (C.W + 160);
        const cx = (x + C.W + 160) % (C.W + 160) - 80;
        g.globalAlpha = 0.9 * k; g.fillStyle = i % 2 ? '#2b2e34' : '#15171b';
        g.beginPath(); g.ellipse(cx, 16 + (i % 3) * 14, 110, 46, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.6 * k; g.strokeStyle = '#94d2bd'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(cx, 16 + (i % 3) * 14, 110, 46, 0, 0.3, Math.PI - 0.3); g.stroke();
      }
      g.restore();
      fx.drawGlow(g, e.x, C.GROUND_Y - 10, 150, '#c9b68a', 0.6 * k);
      // the funnel's solid body: a dark storm silhouette with a pale lit edge, so it reads on
      // any backdrop, bright fairground included
      const crown = twist(e, s, 1, H);
      fx.drawGlow(g, crown.x, crown.y - 20, 240, '#e8f4ff', (0.35 + 0.25 * Math.sin(s.t * 7)) * k);
      const L = [], R = [];
      for (let i = 0; i < N; i++) { const T = twist(e, s, i / (N - 1), H); L.push([T.x - T.rx, T.y]); R.push([T.x + T.rx, T.y]); }
      g.save();
      const gr = g.createLinearGradient(e.x - 190, 0, e.x + 190, 0);
      gr.addColorStop(0, '#0c0d10'); gr.addColorStop(0.42, '#3a3f47'); gr.addColorStop(0.58, '#262a30'); gr.addColorStop(1, '#08090b');
      g.globalAlpha = 0.93 * k; g.fillStyle = gr;
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (const [x, y] of L) g.lineTo(x, y);
      for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath(); g.fill();
      g.globalAlpha = k; g.strokeStyle = '#050607'; g.lineWidth = 7; g.stroke();
      g.globalAlpha = 0.8 * k; g.strokeStyle = '#94d2bd'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < N; i++) {
        const T = twist(e, s, i / (N - 1), H);
        g.globalAlpha = 0.7 * k; g.fillStyle = i % 2 ? '#2b2e34' : '#15171b';
        g.beginPath(); g.ellipse(T.x, T.y, T.rx, T.ry, 0, 0, TAU); g.fill();
        const a0 = s.t * (9 - i * 0.4) + i * 1.3;
        g.globalAlpha = 0.85 * k; g.strokeStyle = i % 3 ? '#b8c0ca' : '#94d2bd'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(T.x, T.y, T.rx * 0.92, T.ry * 0.92, 0, Math.PI + (a0 % 1), TAU - 0.2); g.stroke();
      }
      // lightning crackling INSIDE the funnel, re-rolled 12 times a second
      const seed = Math.floor(s.t * 12);
      g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
      for (let j = 0; j < 3; j++) {
        if (hash(seed * 5 + j) < 0.35) continue;
        const f0 = 0.15 + hash(seed + j * 9) * 0.3, f1 = f0 + 0.35 + hash(seed * 3 + j) * 0.3;
        g.beginPath();
        for (let q = 0; q <= 6; q++) {
          const f = f0 + (f1 - f0) * (q / 6), T = twist(e, s, Math.min(1, f), H);
          const x = T.x + (hash(seed * 11 + j * 7 + q) - 0.5) * T.rx * 1.2;
          q ? g.lineTo(x, T.y) : g.moveTo(x, T.y);
        }
        g.globalAlpha = 0.9 * k; g.strokeStyle = '#94d2bd'; g.lineWidth = 6; g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.stroke();
      }
      g.restore();
      const eye = twist(e, s, 0.5, H);
      const zap = hash(seed * 5) > 0.35 ? 1 : 0.4;
      fx.drawGlow(g, eye.x, eye.y, 70, '#94d2bd', 0.45 * k * zap);
      // the dust skirt churning where it touches the grass
      g.save();
      for (let i = 0; i < 9; i++) {
        const a = s.t * 5 + (i / 9) * TAU, rr = 40 + (i % 3) * 14;
        g.globalAlpha = 0.8 * k; g.fillStyle = i % 2 ? '#8b5a2b' : '#c9b68a';
        g.beginPath(); g.ellipse(e.x + Math.cos(a) * rr, C.GROUND_Y - 6 + Math.sin(a) * 6, 16, 9, 0, 0, TAU); g.fill();
      }
      g.restore();
      debris(g, e, s, false);
    },

    front(g, e, s) {
      const H = funnelH(e), k = fade(e, 0.35, 0.4), N = 11;
      g.save();
      for (let i = 0; i < N; i += 1) {
        const T = twist(e, s, i / (N - 1), H);
        const a0 = (s.t * (10 - i * 0.5) + i) % TAU;
        g.lineWidth = 8; g.globalAlpha = 0.55 * k; g.strokeStyle = '#1b1d22';
        g.beginPath(); g.ellipse(T.x, T.y, T.rx * 1.04, T.ry * 1.25, 0, a0 * 0.2, a0 * 0.2 + 1.8); g.stroke();
        g.lineWidth = 4; g.globalAlpha = 0.9 * k; g.strokeStyle = i % 3 === 0 ? '#e8f4ff' : i % 2 ? '#c9b68a' : '#94d2bd';
        g.beginPath(); g.ellipse(T.x, T.y, T.rx * 1.04, T.ry * 1.25, 0, a0 * 0.2, a0 * 0.2 + 1.8); g.stroke();
      }
      const b = s.M.ball;
      if (!b.power && Math.abs(b.x - e.x) < 58) {
        g.strokeStyle = '#94d2bd'; g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const a0 = s.t * 14 + i * (TAU / 3);
          g.globalAlpha = 0.85 * k;
          g.beginPath(); g.ellipse(b.x, b.y, b.r + 8 + i * 6, (b.r + 8 + i * 6) * 0.45, 0.3, a0, a0 + 2.4); g.stroke();
        }
        // the ball stays findable inside the storm: a white keyline on it, drawn last
        g.globalAlpha = k; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
        g.beginPath(); g.arc(b.x, b.y, b.r + 2, 0, TAU); g.stroke();
      }
      g.restore();
      debris(g, e, s, true);
    },

    tick(e, s) {
      const { fx, C } = s;
      const a = fx.rand(0, TAU);
      fx.emit({ shape: 'smoke', x: e.x + Math.cos(a) * 20, y: C.GROUND_Y - 4, vx: Math.cos(a) * 80 + e.dir * 60, vy: -40, r: 5, r1: 16, drag: 1, life: 0.7, color: '#c9b68a', layer: 'back' });
      // rain across the pitch
      for (let j = 0; j < 2; j++) fx.emit({ shape: 'streak', x: fx.rand(0, C.W), y: fx.rand(C.CEIL_Y, C.GROUND_Y - 80), vx: e.dir * 140, vy: 760, r: 12, w: 2.5, life: 0.4, color: '#b8c0ca', alpha: 0.75, layer: 'back' });
      if (Math.random() < 0.6) {
        // debris torn off and hurled across the whole pitch
        const fromL = Math.random() < 0.5;
        fx.emit({ shape: 'shard', x: e.x + fx.rand(-60, 60), y: C.GROUND_Y - fx.rand(60, 320), vx: (fromL ? 1 : -1) * fx.rand(300, 600), vy: fx.rand(-180, 40), spin: 14, grav: 300, r: 7, life: 1.3, color: Math.random() < 0.5 ? '#8b5a2b' : '#5e8c3a', color2: '#5e3b1a' });
      }
      if (Math.random() < 0.08 && e.t > 0.25) {
        const top = C.GROUND_Y - funnelH(e);
        if (Math.random() < 0.5) {
          fx.bolt(e.x + fx.rand(-160, 160), 0, e.x, top, { color: '#e8f4ff', w: 6, life: 0.24 });
          fx.glow(e.x, top, 110, '#e8f4ff', { life: 0.25, alpha: 0.9 });
        } else {
          const gx = fx.rand(40, C.W - 40);
          fx.bolt(gx + fx.rand(-60, 60), 0, gx, C.GROUND_Y, { color: '#e8f4ff', w: 5, life: 0.22 });
          fx.glow(gx, C.GROUND_Y - 10, 90, '#94d2bd', { life: 0.3, alpha: 0.9 });
        }
        fx.flash('#e8f4ff', 0.12, 0.08);
      }
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), r = b.r * 1.25, dir = dirOf(b);
      s.fx.drawGlow(g, d.x, d.y, r * 4.5, '#94d2bd', 0.75);
      g.save();
      g.translate(d.x, d.y);
      // a sideways mini-twister for a tail: dark rings shrinking behind it, lit rims
      for (let i = 7; i >= 1; i--) {
        const rr = r * (0.5 + i * 0.28);
        g.globalAlpha = 0.8; g.fillStyle = i % 2 ? '#15171b' : '#2b2e34';
        g.beginPath(); g.ellipse(-dir * i * 16, Math.sin(s.t * 16 + i) * 4, rr * 0.35, rr, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.9; g.strokeStyle = i % 2 ? '#94d2bd' : '#e8f4ff'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(-dir * i * 16, Math.sin(s.t * 16 + i) * 4, rr * 0.35, rr, 0, -1.2 + s.t * 9, 0.8 + s.t * 9); g.stroke();
      }
      for (let i = 1; i <= 5; i++) {
        g.globalAlpha = 0.3; g.fillStyle = i % 2 ? '#4a4f58' : '#7e858f';
        g.beginPath(); g.ellipse(-dir * i * 13, Math.sin(s.t * 20 + i) * 3, r * (1 - i * 0.13) * 0.7, r * (1 - i * 0.13) * 1.2, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
      gr.addColorStop(0, '#c9b68a'); gr.addColorStop(0.5, '#7e858f'); gr.addColorStop(1, '#2b2e34');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.strokeStyle = '#94d2bd'; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a0 = s.t * 18 + (i / 4) * TAU;
        g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(0, 0, r + 6 + i * 6, (r + 6 + i * 6) * 0.5, 0.4, a0, a0 + 2); g.stroke();
      }
      g.restore();
      keyline(g, d.x, d.y, r);
    },

    trail(b, s) {
      const { fx } = s;
      if (Math.random() < 0.5) fx.emit({ shape: 'streak', x: fx.rand(0, s.C.W), y: fx.rand(s.C.CEIL_Y, s.C.GROUND_Y - 60), vx: dirOf(b) * 140, vy: 760, r: 12, w: 2.5, life: 0.4, color: '#b8c0ca', alpha: 0.75, layer: 'back' });
      fx.emit({ shape: 'smoke', x: b.x - dirOf(b) * 18, y: b.y, vx: fx.rand(-30, 30), vy: fx.rand(-50, 50), r: 5, r1: 16, life: 0.5, color: '#7e858f', layer: 'back' });
      if (Math.random() < 0.35) fx.emit({ shape: 'shard', x: b.x, y: b.y, vx: -b.vx * 0.2, vy: fx.rand(-110, 110), spin: 14, r: 5, life: 0.45, color: '#8b5a2b' });
    },

    impact(s, ev) {
      const { fx, C } = s;
      if (ev.kind === 'land') {
        const x = ev.e.x, p = spot(s, x, C.GROUND_Y - 200);
        fx.stamp(p.x, p.y, 'סופה!', { color: '#e8f4ff', edge: '#2b2e34', r: 54 });
        fx.glow(x, C.GROUND_Y - 30, 130, '#94d2bd', { life: 0.6 });
        fx.ring(x, C.GROUND_Y - 4, { color: '#7e858f', r1: 180, life: 0.6, w: 7 });
        fx.burst(x, C.GROUND_Y - 4, 36, { shape: 'smoke', speed: 300, spread: 1.4, angle: -Math.PI / 2, r: 8, r1: 26, drag: 2, life: 1.1, color: '#c9b68a', color2: '#7e858f', layer: 'back' });
        fx.burst(x, C.GROUND_Y - 10, 30, { shape: 'shard', speed: 500, spread: 1.6, angle: -Math.PI / 2, r: 7, spin: 12, grav: 700, life: 1.1, color: '#8b5a2b', color2: '#5e8c3a' });
        fx.bolt(x + fx.rand(-60, 60), 0, x, C.GROUND_Y - 200, { color: '#e8f4ff', w: 7, life: 0.3 });
        fx.rays(x, C.GROUND_Y - 120, { color: '#94d2bd', color2: '#2b2e34', n: 14, r1: 420, life: 0.6, alpha: 0.4 });
        fx.shake(6, 0.4);
        fx.tint('#2b2e34', 0.12, 1.2);
        return;
      }
      const blown = ev.kind === 'blown';
      const at = blown ? { x: s.foe.x, y: s.foe.y - 30 } : ev;
      const p = spot(s, at.x, at.y - 80);
      fx.stamp(p.x, p.y, blown ? 'עוף!' : 'בום!', { color: '#e8f4ff', edge: '#2b2e34', r: blown ? 52 : 58 });
      fx.glow(at.x, at.y, 130, '#94d2bd', { life: 0.5 });
      if (!blown) {
        fx.rays(at.x, at.y, { color: '#94d2bd', color2: '#7e858f', n: 16, r1: 380, life: 0.7 });
        fx.confetti(at.x, at.y, 18, ['#94d2bd', '#5e8c3a', '#c9b68a', '#8b5a2b']);
      }
      fx.burst(at.x, at.y, 50, { shape: 'shard', speed: 560, r: 8, spin: 14, grav: 800, life: 1, color: '#8b5a2b', color2: '#5e3b1a' });
      fx.burst(at.x, at.y, 20, { shape: 'smoke', speed: 240, r: 8, r1: 26, drag: 2, life: 1, color: '#c9b68a' });
      fx.bolt(at.x + fx.rand(-80, 80), 0, at.x, at.y, { color: '#e8f4ff', w: 7, life: 0.3 });
      fx.ring(at.x, at.y, { color: '#15171b', r: 20, r1: 260, life: 0.6, w: 12, alpha: 0.7 });
      fx.flash('#e8f4ff', 0.18, 0.1);
      fx.vignette('#2b2e34', 0.5, 1);
      fx.ring(at.x, at.y, { color: '#94d2bd', r1: 150, life: 0.45, w: 6 });
      fx.shake(blown ? 9 : 8, 0.4);
    },

    end(s, info) {
      const { fx, C } = s;
      if (info.kind === 'effect') {
        const e = info.e;
        for (let i = 0, n = fx.n(12); i < n; i++) {
          fx.emit({ shape: 'smoke', x: e.x + Math.cos(i * 1.3) * (10 + i * 7), y: C.GROUND_Y - i * 26, vx: -Math.sin(i * 1.3) * 70, vy: -60, r: 9, r1: 30, drag: 1, life: 1.4, color: '#4a4f58', layer: 'back' });
        }
        fx.glow(e.x, C.GROUND_Y - 120, 110, '#94d2bd', { life: 1, alpha: 0.5 });
        return;
      }
      const b = s.M.ball;
      for (let i = 0, n = fx.n(8); i < n; i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-16, 16), y: b.y, vy: -40, r: 7, r1: 22, life: 1, color: '#7e858f', layer: 'back' });
      fx.glow(b.x, b.y, 70, '#94d2bd', { life: 0.7, alpha: 0.5 });
    },
  },

  // ── 45 · timestop — clockwork ─────────────────────────────────────────────
  timestop: {
    theme: 'Clockwork time stop',
    visual: 'a giant translucent clock face with roman numerals and sweeping hands, brass gears turning, the world washed grey, a ticking dial round the frozen ball, a clock shatter when time resumes',
    palette: ['#b5893b', '#e9dcb6', '#6d7178', '#f8f9fa', '#3b3f46', '#8c6a2f'],
    doc: {
      fantasy: 'You stop the clock: the world goes grey and still, the ball hangs in the air, and only you move — lining up the strike that lands when time starts again.',
      purpose: 'The last stage\'s power: a free set piece. It rewards the player who uses the stopped seconds to walk up and hit the ball the right way, not just the one who fired it.',
      player: 'Fill the meter, press POWER, then touch the ball: it hangs in front of your face and time stops for 2.2s for the opponent and the ball. You move freely; the hardest strike you give the ball (over 60 px/s) is banked. When time resumes a strike toward the goal you attack leaves as your flat power shot at 1.2× (1200 px/s); any other strike carries on at 1.35×. The opponent then stays frozen 0.5s more.',
      bot: 'Arms anywhere (POWERS.timestop.arm = "any") with the striker style (aggression +0.06); during the stop it keeps playing (activeEffect in powers.js) and walks up to strike the hanging ball.',
      sequence: {
        anticipation: 'While armed, three meshing brass gears turn behind the champion\'s shoulder in a warm brass glow and a watch dial of tick marks circles the head with a second hand sweeping. Round the whole body turns the finale\'s tell: a fat ring of dark-edged dashes in the power\'s colour with a pulse racing out of it and a light pool — unmistakable over the gold armed glow.',
        activation: 'Super cut-in: a giant clock face under the band, its hands spinning wildly and slamming to a stop at twelve with a white shock ring, gears turning either side. Then "עצור!": a brass sunburst and light, a burst of gear teeth, springs and sparks, brass confetti, a brass ring freezing round the ball, a pale flash and brass screen edges. The opener is doubled: two counter-spinning sunbursts, three light blobs, a dark-edged double shockwave, 26 hot sparkles and 18 speed streaks under a 66px comic word.',
        main: 'The clockwork world: behind everyone a giant translucent clock face (185px) — brass rim, roman numerals, tick marks, a glowing hub — whose minute hand sweeps once over the 2.2s and whose second hand ticks 8 times a second; five brass gears turn round it and small gears spin in the corners. Over everything, the world is desaturated grey (≤0.3), with the owner ringed in warm brass and lit by a brass glow — the only thing in colour. Round the frozen ball, a white glow and a dial of 12 ticks lighting one by one; once a strike is banked, a brass arrow shows its direction and strength. A second 0.5s record keeps a slowing gear ring round the opponent as he comes back late. The clock is bolder: 195px, a dark-backed brass rim, all twelve numerals, glass cracks spreading as the stop runs, six brass gears and corner gears at 0.7; forty motes and falling drops hang frozen all over the pitch, twinkling, and frozen sparkles pop in. The frozen ball sits in a big white-and-brass glow inside a slow-turning brass gear, keyline drawn last.',
        impact: 'On the stop: a white ring from the ball, light and a flash. On "timeResumes": "טיק טק!" — the clock shatters into brass and glass shards from the pitch centre in a brass sunburst, brass confetti, a warm ring races out from the ball as colour floods back, and the screen shakes hard. The shatter throws 64 shards, six flying ⚙️ gears, a second sunburst and a dark shockwave.',
        aftermath: 'Brass sparks and a fading glow where the stopped ball was; the banked shot, if any, flies as a clockwork ball in a brass glow — a big brass gear rim, a dial with racing hands, time echoes behind it, a pale outline drawn last.',
        cleanup: 'Shards and sparks live ≤1s, confetti ≤1.6s; the wash and clock are drawn only while the 2.2s record lives.',
      },
      layers: 'Cut-in: giant clock with stopping hands, gears, shock ring, drawGlow. Back: clock face (fill, rim, ticks, numerals, hands, hub) with drawGlow, 5 gears, 4 corner gears. Front: frozen-ball glow and dial, banked-strike arrow, opponent recovery ring. Over: saturation wash, owner brass halo + drawGlow. Particles: suspended motes, tick sparks, shards, rays, glows, stamps, confetti.',
      camera: 'Shake 6, a 1.2s brass vignette and a 0.15s pale flash on firing; shake 3 on the stop; shake 10 and a 0.22s warm flash on the resume; the grey wash is the grade (0.3).',
      hud: 'The engine\'s ⏱️ pill over the opponent counts the 2.2s; the clock\'s minute hand shows the same.',
      audio: 'Fire: a deep clock clack — a low thud and a sharp high tick, then a second tick. Impact: a glassy shatter over a rising sweep (time rushing back). End: a last tick.',
      counterplay: 'None while it runs — it is the finale. Before it: deny the touch, since it fires off any head/body touch. After it: the banked shot is flat at 1.2×, so be back in the line the instant you unfreeze (0.5s late).',
      perf: 'Clock ≈ 75 canvas calls, gears ≈ 9×30; one saturation fill; 4 drawGlow; ≤1 tick particle a frame; opener ≈ 65 particles, the shatter ≈ 95; no shadowBlur. Finale pass: the tell ring + 1 drawGlow, ambient scene objects ≈ 60–200 extra canvas calls and ≤6 extra drawGlow, ≤2 extra ambient particles a frame; no new shadowBlur.',
      helpers: 'fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.emit(shard/sq/star/dot), fx.burst, fx.ring, fx.flash, fx.shake, s.headY, s.headR, s.depth, globalCompositeOperation "saturation".',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 160, q: 2, peak: 0.8, decay: 0.3 }, { k: 'thud', freq: 3400, q: 8, peak: 0.5, decay: 0.05 }, { k: 'thud', freq: 3000, q: 8, peak: 0.4, decay: 0.05, t: 0.25 }],
      impact: [{ k: 'thud', freq: 3800, q: 4, peak: 0.6, decay: 0.3 }, { k: 'sweep', from: 120, to: 1400, type: 'sawtooth', peak: 0.2, dur: 0.35 }],
      end: [{ k: 'thud', freq: 2800, q: 8, peak: 0.25, decay: 0.05 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), R = s.headR(p), { fx } = s;
      const gx = p.x - p.side * (R + 16), gy = hy - R + 2;
      beacon(g, s, p, '#b5893b', '#3b3f46');
      fx.drawGlow(g, gx, gy, 60, '#b5893b', 0.6);
      fx.drawGlow(g, p.x, hy, R + 40, '#e9dcb6', 0.3);
      gear(g, gx, gy, 24, 10, s.t * 2, '#b5893b', '#3b3f46', 1);
      gear(g, gx - p.side * 32, gy + 24, 15, 7, -s.t * 3 + 0.3, '#b5893b', '#3b3f46', 1);
      gear(g, gx + p.side * 6, gy - 32, 11, 6, -s.t * 3.5, '#e9dcb6', '#3b3f46', 1);
      g.save();
      g.strokeStyle = '#e9dcb6'; g.lineWidth = 3; g.globalAlpha = 0.8;
      const DR = R + 16;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.beginPath(); g.moveTo(p.x + Math.cos(a) * DR, hy + Math.sin(a) * DR); g.lineTo(p.x + Math.cos(a) * (DR + (i % 3 ? 5 : 11)), hy + Math.sin(a) * (DR + (i % 3 ? 5 : 11))); g.stroke();
      }
      const a = Math.floor(s.t * 4) / 4 * TAU / 4 - Math.PI / 2;
      g.strokeStyle = '#b5893b'; g.lineWidth = 4; g.globalAlpha = 0.95;
      g.beginPath(); g.moveTo(p.x + Math.cos(a) * DR, hy + Math.sin(a) * DR); g.lineTo(p.x + Math.cos(a) * (DR + 16), hy + Math.sin(a) * (DR + 16)); g.stroke();
      g.restore();
    },

    cutin(g, s, k) {
      const { C, fx } = s, a = cutA(k);
      const cx = C.W / 2 - s.side * 170, cy = C.H * 0.74, R = 130;
      const u = clamp(k / 0.55, 0, 1), turn = 1 - (1 - u) * (1 - u);
      fx.drawGlow(g, cx, cy, 220, '#b5893b', 0.55 * a);
      gear(g, cx - R - 50, cy + 40, 56, 14, k * 6, '#b5893b', '#8c6a2f', 0.8 * a);
      gear(g, cx + R + 44, cy - 10, 44, 11, -k * 8, '#8c6a2f', '#b5893b', 0.8 * a);
      g.save();
      g.globalAlpha = 0.85 * a; g.fillStyle = '#e9dcb6';
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.strokeStyle = '#b5893b'; g.lineWidth = 10; g.stroke();
      g.strokeStyle = '#3b3f46';
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * TAU;
        g.lineWidth = i % 3 ? 3 : 6;
        g.beginPath(); g.moveTo(cx + Math.cos(t) * (R - 10), cy + Math.sin(t) * (R - 10)); g.lineTo(cx + Math.cos(t) * (R - (i % 3 ? 22 : 32)), cy + Math.sin(t) * (R - (i % 3 ? 22 : 32))); g.stroke();
      }
      const h1 = -Math.PI / 2 + TAU * 5 * turn, h2 = -Math.PI / 2 + TAU * 1 * turn;
      g.lineCap = 'round';
      g.strokeStyle = '#3b3f46'; g.lineWidth = 10;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(h2) * R * 0.5, cy + Math.sin(h2) * R * 0.5); g.stroke();
      g.strokeStyle = '#b5893b'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(h1) * R * 0.78, cy + Math.sin(h1) * R * 0.78); g.stroke();
      g.fillStyle = '#8c6a2f'; g.beginPath(); g.arc(cx, cy, 12, 0, TAU); g.fill();
      if (u >= 1) {
        const f = clamp((k - 0.55) / 0.4, 0, 1);
        g.globalAlpha = a * (1 - f); g.strokeStyle = '#f8f9fa'; g.lineWidth = 8;
        g.beginPath(); g.arc(cx, cy, R + 10 + f * 200, 0, TAU); g.stroke();
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      opener(s, at, { col: '#b5893b', col2: '#e9dcb6', hot: '#f8f9fa', word: 'עצור!', wordCol: '#e9dcb6', edge: '#3b3f46' });
      fx.ring(at.x, at.y, { color: '#b5893b', r: 90, r1: 16, life: 0.35, w: 6 });
      fx.burst(at.x, at.y, 26, { shape: 'sq', speed: 300, r: 4, drag: 4, life: 0.6, color: '#e9dcb6', color2: '#b5893b' });
      fx.burst(at.x, at.y, 16, { shape: 'shard', speed: 360, r: 6, spin: 12, drag: 2, life: 0.7, color: '#b5893b', color2: '#8c6a2f' });
      fx.burst(at.x, at.y, 10, { shape: 'star', speed: 240, r: 6, spin: 8, drag: 2, life: 0.6, color: '#f8f9fa', blend: 'lighter' });
      fx.confetti(at.x, at.y, 12, ['#b5893b', '#e9dcb6', '#8c6a2f', '#f8f9fa'], { grav: 200, drag: 3 });
      fx.flash('#f8f9fa', 0.18, 0.15);
    },

    back(g, e, s) {
      if (e.type !== 'timestop') return;
      const { C, fx } = s, k = fade(e, 0.15, 0.2);
      const cx = C.W / 2, cy = (C.CEIL_Y + C.GROUND_Y) / 2 - 20, R = 195;
      fx.drawGlow(g, cx, cy, R * 1.3, '#b5893b', 0.35 * k);
      g.save();
      g.globalAlpha = 0.22 * k; g.fillStyle = '#e9dcb6';
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#3b3f46'; g.lineWidth = 14;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      g.strokeStyle = '#b5893b'; g.lineWidth = 8;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      // cracks in the glass, spreading as the stop runs
      g.strokeStyle = '#f8f9fa'; g.lineWidth = 2; g.globalAlpha = 0.6 * k;
      const cr = clamp(e.t / e.life, 0.2, 1);
      for (let i = 0; i < 5; i++) {
        const a = hash(i + 200) * TAU;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
        g.lineTo(cx + Math.cos(a + 0.12) * R * 0.55 * cr, cy + Math.sin(a + 0.12) * R * 0.55 * cr);
        g.lineTo(cx + Math.cos(a - 0.05) * R * 0.95 * cr, cy + Math.sin(a - 0.05) * R * 0.95 * cr); g.stroke();
      }
      g.strokeStyle = '#8c6a2f'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, R - 12, 0, TAU); g.stroke();
      g.strokeStyle = '#3b3f46';
      for (let i = 0; i < 60; i += 1) {
        const a = (i / 60) * TAU, L = i % 5 ? 6 : 16;
        g.lineWidth = i % 5 ? 2 : 4;
        g.globalAlpha = (i % 5 ? 0.3 : 0.55) * k;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); g.lineTo(cx + Math.cos(a) * (R - 14 - L), cy + Math.sin(a) * (R - 14 - L)); g.stroke();
      }
      g.globalAlpha = 0.75 * k; g.fillStyle = '#3b3f46';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU - Math.PI / 2; g.font = `700 ${i % 3 ? 17 : 26}px Georgia, serif`; g.fillText(nums[i], cx + Math.cos(a) * (R - 48), cy + Math.sin(a) * (R - 48)); }
      const m = (e.t / e.life) * TAU - Math.PI / 2;
      const sc = (Math.floor(e.t * 8) / 8) * TAU * 0.6 - Math.PI / 2;
      g.globalAlpha = 0.7 * k; g.strokeStyle = '#3b3f46'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(m) * (R - 50), cy + Math.sin(m) * (R - 50)); g.stroke();
      g.strokeStyle = '#b5893b'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - Math.cos(sc) * 24, cy - Math.sin(sc) * 24); g.lineTo(cx + Math.cos(sc) * (R - 26), cy + Math.sin(sc) * (R - 26)); g.stroke();
      g.globalAlpha = 0.9 * k; g.fillStyle = '#b5893b';
      g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.fill();
      g.restore();
      fx.drawGlow(g, cx, cy, 40, '#e9dcb6', 0.6 * k);
      gear(g, cx - R - 30, cy + R * 0.5, 54, 12, e.t * 1.5, '#b5893b', '#3b3f46', 0.7 * k);
      gear(g, cx - R + 40, cy + R * 0.9, 32, 9, -e.t * 2.3, '#8c6a2f', '#3b3f46', 0.7 * k);
      gear(g, cx + R + 30, cy - R * 0.45, 46, 10, -e.t * 1.8, '#b5893b', '#3b3f46', 0.7 * k);
      gear(g, cx + R - 20, cy - R * 0.9, 26, 8, e.t * 2.6, '#8c6a2f', '#3b3f46', 0.7 * k);
      gear(g, cx + R + 14, cy + R * 0.7, 32, 9, e.t * 2, '#b5893b', '#3b3f46', 0.7 * k);
      gear(g, cx - R - 10, cy - R * 0.7, 30, 9, -e.t * 2.2, '#e9dcb6', '#3b3f46', 0.6 * k);
      // the clockwork in the corners of the world
      const corners = [[40, C.CEIL_Y + 20], [C.W - 40, C.CEIL_Y + 20], [40, C.GROUND_Y - 40], [C.W - 40, C.GROUND_Y - 40]];
      corners.forEach(([x, y], i) => gear(g, x, y, 30, 8, (i % 2 ? -1 : 1) * e.t * 3, '#8c6a2f', '#3b3f46', 0.7 * k));
      // frozen in mid-air: a field of motes and falling drops hung still all over the pitch
      g.save();
      for (let i = 0; i < 40; i++) {
        const x = hash(i + 300) * C.W, y = C.CEIL_Y + 20 + hash(i + 340) * (C.GROUND_Y - C.CEIL_Y - 40);
        const tw = 0.55 + 0.45 * Math.sin(s.t * 3 + i);
        g.globalAlpha = 0.85 * k * tw;
        if (i % 3 === 0) { g.fillStyle = '#e9dcb6'; g.fillRect(x - 1.5, y - 7, 3, 14); }
        else if (i % 3 === 1) { g.fillStyle = '#f8f9fa'; g.fillRect(x - 2, y - 2, 4, 4); }
        else { g.fillStyle = '#b5893b'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
      }
      g.restore();
    },

    front(g, e, s) {
      const { fx } = s;
      if (e.type !== 'timestop') {
        const q = s.M.players[e.target], hy = s.headY(q), hr = s.headR(q);
        const k = 1 - e.t / e.life;
        g.save();
        g.strokeStyle = '#b5893b'; g.lineWidth = 4; g.globalAlpha = 0.85 * k;
        const a0 = e.t * 12 * k;
        for (let i = 0; i < 6; i++) {
          const a = a0 + (i / 6) * TAU;
          g.beginPath(); g.arc(q.x, hy, hr + 12, a, a + 0.6); g.stroke();
        }
        g.restore();
        return;
      }
      const k = fade(e, 0.15, 0.2), b = s.M.ball;
      const d = s.depth(b.x, b.y), DR = b.r + 10;
      const lit = Math.floor(e.t * 8) % 12;
      fx.drawGlow(g, d.x, d.y, b.r * 5, '#f8f9fa', 0.6 * k);
      fx.drawGlow(g, d.x, d.y, b.r * 3, '#b5893b', 0.5 * k);
      gear(g, d.x, d.y, DR + 30, 16, e.t * 0.4, '#b5893b', '#3b3f46', 0.45 * k);
      g.save();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#3b3f46'; g.lineWidth = 7;
      g.beginPath(); g.arc(d.x, d.y, DR, 0, TAU); g.stroke();
      g.globalAlpha = k; g.strokeStyle = '#b5893b'; g.lineWidth = 4;
      g.beginPath(); g.arc(d.x, d.y, DR, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU - Math.PI / 2, L = i % 3 ? 7 : 11;
        g.globalAlpha = (i === lit ? 1 : 0.85) * k;
        g.strokeStyle = i === lit ? '#f8f9fa' : '#e9dcb6'; g.lineWidth = i === lit ? 5 : 3;
        g.beginPath(); g.moveTo(d.x + Math.cos(a) * (DR + 3), d.y + Math.sin(a) * (DR + 3)); g.lineTo(d.x + Math.cos(a) * (DR + 3 + L), d.y + Math.sin(a) * (DR + 3 + L)); g.stroke();
      }
      const u = (e.t * 1.6) % 1;
      g.globalAlpha = (1 - u) * 0.6 * k; g.strokeStyle = '#e9dcb6'; g.lineWidth = 2;
      g.beginPath(); g.arc(d.x, d.y, DR + 16 + u * 22, 0, TAU); g.stroke();
      if (e.stored) {
        const sp = Math.hypot(e.stored.vx, e.stored.vy) || 1;
        const L = clamp(sp * 0.06, 20, 80), ux = e.stored.vx / sp, uy = e.stored.vy / sp;
        const x0 = d.x + ux * (DR + 16), y0 = d.y + uy * (DR + 16), x1 = x0 + ux * L, y1 = y0 + uy * L;
        g.globalAlpha = (0.7 + 0.3 * Math.sin(s.t * 12)) * k;
        g.strokeStyle = '#b5893b'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.fillStyle = '#b5893b';
        g.beginPath(); g.moveTo(x1 + ux * 12, y1 + uy * 12); g.lineTo(x1 - uy * 8, y1 + ux * 8); g.lineTo(x1 + uy * 8, y1 - ux * 8); g.closePath(); g.fill();
      }
      g.restore();
      keyline(g, d.x, d.y, b.r);
    },

    over(g, e, s) {
      if (e.type !== 'timestop') return;
      const { C, fx } = s, k = fade(e, 0.15, 0.2), o = s.owner;
      g.save();
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = 0.3 * k; g.fillStyle = '#6d7178';
      g.fillRect(0, 0, C.W, C.H);
      g.restore();
      const hy = s.headY(o), hr = s.headR(o);
      fx.drawGlow(g, o.x, (hy + o.y) / 2, hr * 2.6, '#b5893b', 0.4 * k);
      g.save();
      g.globalAlpha = 0.8 * k; g.strokeStyle = '#b5893b'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(o.x, (hy + o.y) / 2 - 4, hr + 14, (o.y - hy) / 2 + hr + 14, 0, 0, TAU); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      if (e.type === 'timestop') {
        if (Math.random() < 0.3) fx.emit({ shape: 'sq', x: e.at.x + fx.rand(-140, 140), y: e.at.y + fx.rand(-90, 90), r: 3, life: 1, color: '#e9dcb6', alpha: 0.75, layer: 'back' });
        const q = anywhere(s);
        fx.emit({ shape: 'star', x: q.x, y: q.y, r: 1, r1: 8, rot: fx.rand(0, TAU), life: 0.9, color: '#f8f9fa', color2: '#b5893b', blend: 'lighter', layer: 'back' });
      } else if (Math.random() < 0.35) {
        const q = s.M.players[e.target];
        fx.emit({ shape: 'sq', x: q.x + fx.rand(-22, 22), y: q.y - fx.rand(10, 60), vy: -40, r: 3.5, life: 0.4, color: '#b5893b' });
      }
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), r = b.r * 1.25, dir = dirOf(b);
      s.fx.drawGlow(g, d.x, d.y, r * 3.3, '#b5893b', 0.7);
      g.save();
      g.fillStyle = '#b5893b';
      for (let i = 1; i <= 4; i++) {
        g.globalAlpha = 0.32 / i;
        g.beginPath(); g.arc(d.x - dir * i * 18, d.y - b.vy * 0.015 * i, r, 0, TAU); g.fill();
      }
      g.restore();
      gear(g, d.x, d.y, r + 8, 12, s.t * 10 * dir, '#b5893b', '#8c6a2f', 1);
      g.save();
      g.translate(d.x, d.y);
      g.fillStyle = '#e9dcb6'; g.beginPath(); g.arc(0, 0, r * 0.85, 0, TAU); g.fill();
      g.strokeStyle = '#3b3f46'; g.lineWidth = 2; g.lineCap = 'round';
      const a1 = s.t * 20, a2 = s.t * 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a1) * r * 0.7, Math.sin(a1) * r * 0.7); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45); g.stroke();
      g.strokeStyle = '#f8f9fa'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, r * 0.85, 0, TAU); g.stroke();
      g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      fx.emit({ shape: 'sq', x: b.x - dirOf(b) * 16, y: b.y + fx.rand(-10, 10), vx: -b.vx * 0.05, vy: fx.rand(-30, 30), r: 4, life: 0.45, color: '#b5893b', color2: '#8c6a2f' });
      if (Math.random() < 0.4) fx.emit({ shape: 'star', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: fx.rand(-60, 60), r: 5, spin: 10, life: 0.35, color: '#e9dcb6' });
    },

    impact(s, ev) {
      const { fx, C } = s;
      if (ev.kind === 'land') {
        const e = ev.e;
        if (e.type === 'timestop') {
          fx.ring(e.at.x, e.at.y, { color: '#f8f9fa', r1: 260, life: 0.55, w: 7 });
          fx.glow(e.at.x, e.at.y, 120, '#f8f9fa', { life: 0.5 });
          fx.flash('#e9dcb6', 0.2, 0.15);
          fx.shake(3, 0.15);
        } else {
          const q = s.M.players[e.target];
          fx.ring(q.x, s.headY(q), { color: '#b5893b', r1: 80, life: 0.35, w: 4 });
        }
        return;
      }
      if (ev.kind === 'timeResumes') {
        const cx = C.W / 2, cy = (C.CEIL_Y + C.GROUND_Y) / 2 - 20, p = spot(s, ev.x, ev.y - 90);
        fx.rays(cx, cy, { color: '#b5893b', color2: '#e9dcb6', n: 20, r1: 460, life: 0.8 });
        fx.glow(cx, cy, 200, '#b5893b', { life: 0.6 });
        fx.glow(ev.x, ev.y, 90, '#f8f9fa', { life: 0.4 });
        fx.stamp(p.x, p.y, 'טיק טק!', { color: '#e9dcb6', edge: '#3b3f46', r: 58 });
        fx.burst(cx, cy, 64, { shape: 'shard', speed: 560, r: 11, spin: 12, grav: 700, life: 1.2, color: '#e9dcb6', color2: '#b5893b', layer: 'back' });
        fx.rays(cx, cy, { color: '#f8f9fa', n: 12, r: 20, r1: 700, life: 0.6, alpha: 0.3, spin: -1.2 });
        fx.ring(cx, cy, { color: '#3b3f46', r: 60, r1: 420, life: 0.6, w: 14, alpha: 0.7 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; fx.emit({ shape: 'glyph', text: '⚙️', x: cx, y: cy, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, drag: 1.2, grav: 300, spin: 6, r: 34, life: 1.2 }); }
        fx.vignette('#b5893b', 0.5, 1);
        fx.burst(cx, cy, 16, { shape: 'star', speed: 340, r: 7, spin: 8, grav: 500, life: 0.9, color: '#b5893b', color2: '#8c6a2f', layer: 'back' });
        fx.confetti(cx, cy, 22, ['#b5893b', '#e9dcb6', '#8c6a2f', '#f8f9fa']);
        fx.ring(ev.x, ev.y, { color: '#b5893b', r1: 320, life: 0.55, w: 8 });
        fx.ring(ev.x, ev.y, { color: '#f8f9fa', r1: 200, life: 0.4, w: 5 });
        fx.flash('#e9dcb6', 0.24, 0.22);
        fx.shake(10, 0.4);
        return;
      }
      const p = spot(s, ev.x, ev.y - 80);
      fx.rays(ev.x, ev.y, { color: '#b5893b', color2: '#e9dcb6', n: 16, r1: 380, life: 0.7 });
      fx.glow(ev.x, ev.y, 150, '#b5893b', { life: 0.6 });
      fx.stamp(p.x, p.y, 'דונג!', { color: '#e9dcb6', edge: '#3b3f46', r: 56 });
      fx.burst(ev.x, ev.y, 30, { shape: 'shard', speed: 440, r: 7, spin: 14, grav: 800, life: 0.9, color: '#b5893b', color2: '#8c6a2f' });
      fx.confetti(ev.x, ev.y, 16, ['#b5893b', '#e9dcb6', '#8c6a2f', '#f8f9fa']);
      fx.ring(ev.x, ev.y, { color: '#e9dcb6', r1: 160, life: 0.5, w: 7 });
      fx.shake(8, 0.35);
    },

    end(s, info) {
      const { fx } = s;
      if (info.kind === 'effect' && info.e.type !== 'timestop') return;
      const at = info.kind === 'effect' ? info.e.at : s.M.ball;
      for (let i = 0, n = fx.n(12); i < n; i++) fx.emit({ shape: 'sq', x: at.x + fx.rand(-18, 18), y: at.y + fx.rand(-18, 18), vy: -fx.rand(20, 60), r: 3.5, life: 0.8, color: '#b5893b', color2: '#e9dcb6' });
      fx.glow(at.x, at.y, 80, '#b5893b', { life: 0.8, alpha: 0.6 });
    },
  },
};
