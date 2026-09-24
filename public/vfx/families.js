// THE ELEVEN POWER-SHOT FAMILIES, DRAWN — Head Soccer's look, our own canvas paths.
//
// Idan's rule: the shots look EXACTLY like Head Soccer, and nothing is drawn that the footage does
// not show. So there is one shot picture — the comet filmed in M4 (docs/HS-POWER-SHOTS.md §3) —
// and the families differ only by the PATH it flies and its colour, plus the two pieces HS itself
// adds to a family we filmed: the Aerial's warning streaks (§3 M2 43.2–44.2 s) and the Grab's claw
// (§3 M3 73.9–74.3 s). No particles, shakes, flashes or rings.
//
// THE COMET, measured off M4 43.05–43.25 s (full-res crops):
//   • the ball, drawn as itself, at the nose of a WHITE-HOT CORE ≈ 80 px tall and ≈ 230 px long;
//   • round it a CYAN body, a teardrop ≈ 95 px tall at the ball tapering to ≈ 50 px over ≈ 360 px,
//     deep blue at the edges, fading out toward the back (side-by-side with M4 43.07–43.13 s);
//   • full size while the screen is still dark (0.2 s after release: 43.07, 43.13 s), then fading
//     over ~0.1 s, as the dark lifts, to a faint streak (43.24 s);
//   • 4–5 faded AFTER-IMAGES of the ball behind it once the tail has faded (43.25 s).
// All in world px (the footage's pitch is our 1060 at scale 0.995; its heads are ours).
//
// Each entry: palette [core, body, edge], and draw(g, b, s) — s = { t (s since release), hist
// (screen path, newest first), x, y, pw, groundY }.

const TAU = Math.PI * 2;
export const COMET = { CORE_W: 40, CORE_L: 230, BODY_W0: 47, BODY_W1: 26, BODY_L: 360, FULL: 0.2, FADE: 0.12, FLOOR: 0.2 };

// How bright the tail is `t` seconds after release (§3: full, then faint by ~0.25 s).
export const cometAlpha = (t) => (t < COMET.FULL ? 1 : Math.max(COMET.FLOOR, 1 - ((t - COMET.FULL) / COMET.FADE) * (1 - COMET.FLOOR)));

// The path back from the ball, `len` px long; extended straight back along the heading when the
// ball has not flown that far yet (the filmed comet is full length on its first frame).
function spine(hist, len, x, y, dir) {
  const pts = [{ x, y }];
  let acc = 0, hx = -dir, hy = 0;
  for (let i = 1; hist && i < hist.length && acc < len; i++) {
    const a = pts[pts.length - 1], b = hist[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 0.5) continue;
    hx = (b.x - a.x) / d; hy = (b.y - a.y) / d;
    if (acc + d >= len) { const f = (len - acc) / d; pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }); acc = len; break; }
    acc += d; pts.push({ x: b.x, y: b.y });
  }
  if (acc < len) { const a = pts[pts.length - 1]; pts.push({ x: a.x + hx * (len - acc), y: a.y + hy * (len - acc) }); }
  return pts;
}

// One tapered layer along the spine: half-width w0 at the ball, w1 at the far end, fading out
// toward the far end (one linear gradient a layer — the filmed tail has no hard back edge).
function layer(g, pts, w0, w1, col, alpha) {
  let total = 0;
  const run = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); run.push(total); }
  if (total < 1) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const o = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
    let dx = q.x - o.x, dy = q.y - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const f = run[i] / total, w = w0 + (w1 - w0) * f;
    L.push(pts[i].x - dy * w, pts[i].y + dx * w); R.push(pts[i].x + dy * w, pts[i].y - dx * w);
  }
  const end = pts[pts.length - 1];
  const lg = g.createLinearGradient(pts[0].x, pts[0].y, end.x, end.y);
  lg.addColorStop(0, col); lg.addColorStop(0.55, col); lg.addColorStop(1, transparent(col));
  g.globalAlpha = alpha; g.fillStyle = lg;
  g.beginPath();
  for (let i = 0; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
  g.closePath(); g.fill();
  // the round nose, just ahead of the ball
  g.fillStyle = col;
  g.beginPath(); g.arc(pts[0].x, pts[0].y, w0, 0, TAU); g.fill();
}
const transparent = (c) => (c[0] === '#' && c.length === 7 ? c + '00' : 'rgba(0,0,0,0)');

// The flame's grain (§3: the filmed tail is streaky, lighter lines running back along it).
function grain(g, pts, w, col, alpha) {
  if (pts.length < 2) return;
  g.lineCap = 'round'; g.strokeStyle = col;
  for (const [off, lw, a] of [[-0.55, 2, 0.8], [-0.2, 1.5, 1], [0.25, 2, 0.9], [0.6, 1.5, 0.7]]) {
    g.globalAlpha = alpha * a; g.lineWidth = lw;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const o = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
      let dx = q.x - o.x, dy = q.y - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const f = i / (pts.length - 1), ww = w * (0.6 + 0.6 * f) * off;
      g.lineTo(pts[i].x - dy * ww, pts[i].y + dx * ww);
    }
    g.stroke();
  }
}

// THE COMET (§3). `k` scales its width and `kl` its length (the Multi-Ball's extras are a size
// down; the Aerial going up is a thin streak).
export function drawComet(g, s, pal, k = 1, kl = k) {
  const a = cometAlpha(s.t);
  const dir = s.pw.dir || 1;
  const body = spine(s.hist, COMET.BODY_L * kl, s.x, s.y, dir);
  const core = spine(s.hist, COMET.CORE_L * kl, s.x, s.y, dir);
  g.save();
  g.globalCompositeOperation = 'lighter';
  layer(g, body, COMET.BODY_W0 * k * 1.12, COMET.BODY_W1 * k * 1.1, pal[2], 0.45 * a);  // soft blue edge
  layer(g, body, COMET.BODY_W0 * k, COMET.BODY_W1 * k * 0.8, pal[1], 0.65 * a);          // the cyan body, fanning out
  grain(g, body, COMET.BODY_W1 * k * 0.8, pal[0], 0.35 * a);
  layer(g, core, COMET.CORE_W * k, 0, pal[0], 0.95 * a);                                 // the white-hot core
  g.restore();
  // After-images once the tail has faded (§3, M4 43.25 s): faded copies of the ball behind it.
  if (s.t > COMET.FULL + COMET.FADE * 0.5 && s.hist && s.hist.length > 8) {
    g.save();
    for (let i = 1; i <= 4; i++) {
      const h = s.hist[i * 2];
      if (!h) break;
      g.globalAlpha = 0.34 - i * 0.07;
      g.fillStyle = '#ffffff'; g.strokeStyle = '#1b2436'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(h.x, h.y, s.r, 0, TAU); g.fill(); g.stroke();
    }
    g.restore();
  }
}

// ── the families: the comet, on each family's path, in its colour ────────────────
// Colours: the straight comet is the filmed cyan; the Aerial is the filmed orange; the Grab the
// filmed dark blue. The families we have no footage of keep the filmed comet and take a colour of
// their own, so two shots in a match can be told apart — nothing else is added to them.
const comet = (palette) => ({ palette, draw(g, b, s) { drawComet(g, s, palette, s.pw.extra ? 0.7 : 1); } });

export const FAMILY_VFX = {
  straight: comet(['#ffffff', '#3fe0ff', '#1a6dff']),         // §3 M4: white core, cyan body, blue edge
  ground: comet(['#ffffff', '#ffb45a', '#b8621c']),
  downward: comet(['#ffffff', '#c996ff', '#6a2cff']),
  destructive: comet(['#ffffff', '#ff8a3a', '#e0200a']),
  // AERIAL (§3 M2): the comet going up and coming down; while it is off the top, the warning
  // streaks are all there is (drawn by warn(), over the pitch).
  aerial: {
    palette: ['#fffbe0', '#ffa030', '#ff3a08'],                 // §3 M2: orange fire tail
    // Going up it is a thin streak of flame (M2 42.75 s); coming down, the full meteor (44.35 s).
    draw(g, b, s) { if (s.pw.ph !== 'wait') drawComet(g, s, this.palette, s.pw.ph === 'up' ? 0.3 : 1.1, s.pw.ph === 'up' ? 0.5 : 1); },
    // THE WARNING (§3 M2 43.2–44.2 s): thin red streaks sliding down the dive line from the top.
    warn(g, s) {
      const pw = s.pw;
      const x0 = pw.x0, y0 = -110, x1 = pw.tx, y1 = pw.ty;
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      g.save(); g.lineCap = 'round';
      // from where the dive line crosses the top of the screen to about half way down it
      const fa = (0 - y0) / dy, fb = (y1 * 0.55 - y0) / dy;
      for (let i = 0; i < 3; i++) {
        const f = fa + ((s.now * 1.1 + i / 3) % 1) * (fb - fa);
        const px = x0 + dx * f, py = y0 + dy * f;
        g.globalAlpha = 0.85; g.strokeStyle = '#ff2a10'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - ux * 90, py - uy * 90); g.stroke();
        g.globalAlpha = 0.9; g.strokeStyle = '#ffd080'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - ux * 60, py - uy * 60); g.stroke();
      }
      g.restore();
    },
  },
  delay: comet(['#ffffff', '#a58cff', '#4a2cff']),
  // GRAB (§3 M3): a dark-blue ghost hand, fingers spread, carries the ball with blue speed streaks
  // behind; holding a player, its fingers close.
  grab: {
    palette: ['#dfe8ff', '#3b5bdc', '#10206e'],
    draw(g, b, s) {
      const [ux, uy] = headingOf(s);
      drawComet(g, s, this.palette, 0.8);
      drawClaw(g, s.x - ux * 4, s.y - uy * 4, ux, uy, s.r, s.now, s.pw.ph === 'grab');
    },
  },
  multiball: comet(['#ffffff', '#ffe05a', '#ffa200']),
  updown: comet(['#ffffff', '#5cf09a', '#0aa050']),
  ailment: comet(['#ffffff', '#f07cff', '#a01cff']),
  critical: comet(['#ffffff', '#ff6a82', '#ff0a3a']),
};

function headingOf(s) {
  const h = s.hist;
  if (h && h.length > 1) {
    const a = h[0], b = h[Math.min(3, h.length - 1)];
    const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d > 0.5) return [dx / d, dy / d];
  }
  return [s.pw.dir || 1, 0];
}

// THE CLAW (§3 M3): palm behind the ball, four long spread fingers and a thumb reaching along the
// flight, dark blue edged light; closed round whoever it holds.
function drawClaw(g, x, y, ux, uy, r, t, closed) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.atan2(uy, ux));
  // Big: the filmed hand is about four heads long, the ball in its palm, the fingers reaching on
  // ahead of it (M3 73.93 s).
  const R = r * 2.6;
  g.translate(R * 1.6, 0);
  g.globalAlpha = 0.9;
  g.fillStyle = '#16266e'; g.strokeStyle = '#8fb0ff'; g.lineWidth = 2; g.lineJoin = 'round';
  // the speed streaks behind it (§3: "blue speed streaks behind it")
  g.save(); g.strokeStyle = '#3b6bff'; g.lineWidth = 3; g.globalAlpha = 0.6;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-R * 3.2, i * R * 0.5); g.lineTo(-R * 5.5 - (i & 1) * R, i * R * 0.5); g.stroke(); }
  g.restore();
  g.beginPath(); g.ellipse(-R * 1.9, 0, R * 1.45, R * 1.2, 0, 0, TAU); g.fill(); g.stroke();
  const fingers = [-0.95, -0.42, 0.08, 0.55];                  // spread wide, like the filmed hand
  for (let i = 0; i < 4; i++) {
    const a = fingers[i] * (closed ? 0.5 : 1);
    const len = R * (closed ? 2.0 : 2.8) * (i === 1 || i === 2 ? 1 : 0.85);
    const bx = -R * 1.2 + Math.cos(a) * R * 0.4, by = Math.sin(a) * R * 1.1;
    const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
    const curl = closed ? -Math.sign(a || 1) * R * 1.1 : 0;
    g.beginPath();
    g.moveTo(bx - Math.sin(a) * R * 0.38, by + Math.cos(a) * R * 0.38);
    g.quadraticCurveTo(tx - Math.sin(a) * R * 0.2, ty + Math.cos(a) * R * 0.2 + curl * 0.3, tx + Math.cos(a) * R * 0.5, ty + curl);
    g.quadraticCurveTo(tx + Math.sin(a) * R * 0.2, ty - Math.cos(a) * R * 0.2 + curl * 0.3, bx + Math.sin(a) * R * 0.38, by - Math.cos(a) * R * 0.38);
    g.closePath(); g.fill(); g.stroke();
  }
  g.beginPath(); g.moveTo(-R * 1.6, R * 0.9); g.quadraticCurveTo(-R * 0.3, R * 2.0, R * 0.4, R * (closed ? 0.9 : 1.6)); g.lineTo(-R * 0.9, R * 0.6); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

// ── the moments on the defender (§4) ─────────────────────────────────────────────
// THE BLOCK (§4 M4 61.45–62.25 s): a crackling yellow-white spark burst where the ball grinds on
// the boot, re-drawn every frame for as long as the grind lasts. No particles.
export function drawGrind(g, x, y, now) {
  const seed = Math.floor(now * 30);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const j = Math.sin((seed + i * 7) * 12.9898) * 43758.5453, rnd = j - Math.floor(j);
    const a = (i / 10) * TAU + rnd * 0.5, L = 22 + rnd * 30;
    g.globalAlpha = 0.9; g.strokeStyle = i % 2 ? '#fff6b0' : '#ffffff'; g.lineWidth = i % 2 ? 4 : 2.5;
    g.beginPath(); g.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  g.globalAlpha = 0.85; g.fillStyle = '#fffbe0';
  g.beginPath(); g.arc(x, y, 14 + (seed % 3) * 2, 0, TAU); g.fill();
  g.restore();
}
