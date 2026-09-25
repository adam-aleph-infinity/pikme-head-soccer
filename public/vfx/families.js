// THE ELEVEN POWER-SHOT FAMILIES, DRAWN — Head Soccer's look, our own canvas paths.
//
// Idan's rule: the shots look EXACTLY like Head Soccer, and nothing is drawn that the footage does
// not show. So there is one shot picture — the comet filmed in M4 (docs/HS-POWER-SHOTS.md §3) —
// and the families differ only by the PATH it flies and its colour, plus the two pieces HS itself
// adds to a family we filmed: the Aerial's red laser lances (§3 M2 42.65–44.3 s) and the Grab's
// giant hand and fist (§3 M3 73.88–74.30 s). No particles, shakes, flashes or rings.
//
// THE COMET, measured off M4 43.05–43.25 s (full-res crops):
//   • the ball, drawn as itself, at the nose of a soft WHITE-HOT CORE ≈ 70 px tall, ≈ 230 px long;
//   • round it a CYAN body fanning OUT to ≈ 130 px tall ≈ 130 px behind the ball, thinning to
//     streaks ≈ 330 px back, blue at the edges (COMET below; side-by-side with M4 43.07 s);
//   • full size while the screen is still dark (0.2 s after release: 43.07, 43.13 s), then fading
//     over ~0.1 s, as the dark lifts, to a faint streak (43.24 s);
//   • 4–5 faded AFTER-IMAGES of the ball behind it once the tail has faded (43.25 s).
// All in world px (the footage's pitch is our 1060 at scale 0.995; its heads are ours).
//
// Each entry: palette [core, body, edge, seam?], and draw(g, b, s) — s = { t (s since release),
// hist (screen path, newest first), x, y, pw, groundY, fx/fy (where it was fired, on screen) }.

const TAU = Math.PI * 2;
// Re-measured off M4 43.07 s at full resolution (1 world px a frame px): the nose sits only ≈ 30 px
// ahead of the ball's centre; the white-hot core is ≈ 60–70 px tall and ≈ 150 px long, soft-edged;
// the cyan body is NOT widest at the ball — it fans out to ≈ 130 px tall ≈ 130 px behind it and
// thins to streaks ≈ 330 px back. Half-widths: [at the ball, where the widest is (0–1), widest, end].
export const COMET = { CORE: [30, 0.25, 36, 0], CORE_L: 230, BODY: [36, 0.4, 64, 16], BODY_L: 330, FULL: 0.2, FADE: 0.12, FLOOR: 0.2 };
const halfW = (P, f, k) => k * (f < P[1] ? P[0] + (P[2] - P[0]) * (f / P[1]) * (2 - f / P[1]) : P[2] + (P[3] - P[2]) * ((f - P[1]) / (1 - P[1])));

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

// One layer along the spine, its half-width following the profile P (scaled by k), fading out
// toward the far end (one linear gradient a layer — the filmed tail has no hard back edge).
function layer(g, pts, P, k, col, alpha, hold = 0.55) {
  let total = 0;
  const run = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); run.push(total); }
  if (total < 1) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const o = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
    let dx = q.x - o.x, dy = q.y - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = halfW(P, run[i] / total, k);
    L.push(pts[i].x - dy * w, pts[i].y + dx * w); R.push(pts[i].x + dy * w, pts[i].y - dx * w);
  }
  const end = pts[pts.length - 1], w0 = halfW(P, 0, k);
  const lg = g.createLinearGradient(pts[0].x, pts[0].y, end.x, end.y);
  lg.addColorStop(0, col); lg.addColorStop(hold, col); lg.addColorStop(1, transparent(col));
  g.globalAlpha = alpha; g.fillStyle = lg;
  g.beginPath();
  for (let i = 0; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
  g.closePath(); g.fill();
  // the round nose, centred on the ball: it reaches only ≈ 30 px ahead of it
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
  // soft edges: every layer twice, a wider faint pass under a narrower full one
  layer(g, body, COMET.BODY, k * 1.25, pal[2], 0.22 * a, 0.4);                 // blue haze
  layer(g, body, COMET.BODY, k * 1.05, pal[2], 0.35 * a, 0.45);                // blue edge
  layer(g, body, COMET.BODY, k * 0.85, pal[1], 0.6 * a);                       // the cyan body, fanning out
  grain(g, body, COMET.BODY[2] * k * 0.55, pal[0], 0.3 * a);
  if (pal[3]) layer(g, core, COMET.CORE, k * 1.5, pal[3], 0.3 * a, 0.4);      // (M4: a green-yellow seam round the core)
  layer(g, core, COMET.CORE, k * 1.25, pal[0], 0.35 * a, 0.3);                 // the white-hot core's glow…
  layer(g, core, COMET.CORE, k * 0.9, pal[0], 0.9 * a, 0.35);                  // …and the core
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
  straight: comet(['#ffffff', '#3fe0ff', '#1a8cff', '#c8ff8a']), // §3 M4 43.07: white core, green-yellow seam, cyan body, blue edge
  ground: comet(['#ffffff', '#ffb45a', '#b8621c']),
  downward: comet(['#ffffff', '#c996ff', '#6a2cff']),
  destructive: comet(['#ffffff', '#ff8a3a', '#e0200a']),
  // AERIAL (§3 M2 42.6–44.5 s and 96.3–97.9 s; wiki: the UK's "Hawk-Eye Shot" — "11 red
  // laser-arrows vertically in the air, and then they come back diagonally at the goal", the 11th
  // carrying the ball). Going up: red laser lances; while it is off the top: ten lances raining down
  // diagonally toward the goal (warn(), over the pitch); coming down: the ball in a big fire tail.
  aerial: {
    palette: ['#ffd860', '#ff9a20', '#ff3a08'],                 // §3 M2 44.3 s: yellow core, orange fire, red edge
    draw(g, b, s) {
      const pw = s.pw;
      if (pw.ph === 'up') {
        // M2 42.65, 96.35 s: a vertical lance on the ball, and a second one beside it coming up
        laser(g, s.x, s.y - 4, 0, -1, 250);
        const y2 = s.y + 230;
        if (s.fy == null || y2 < s.fy - 10) laser(g, s.x - (pw.dir || 1) * 30, y2, 0, -1, 200);
      } else if (pw.ph === 'dive') drawComet(g, s, this.palette, 0.62, 0.85);
    },
    // THE LANCES (M2 43.05–44.3 s, full-res): ten, one every 0.1 s, at ≈ 32° below horizontal,
    // ≈ 2600 px/s, each ≈ 300 px long — a hot yellow-white core in a red body with a red glow,
    // pointed at the front, fading to the back — two or three on screen at once, on parallel lines
    // that end on the wall over and in the mouth of the goal (where they vanish).
    warn(g, s) {
      const pw = s.pw, dir = pw.dir || 1;
      const ux = dir * 0.848, uy = 0.53;                          // cos, sin 32°
      const wallX = pw.tx - dir * 30;                             // the goal line
      for (let i = 0; i < LANCE_END.length; i++) {
        // (the last ones are still coming down beside the ball as it dives, M2 44.3 s)
        const run = ((pw.ph === 'dive' ? pw.k + pw.t : pw.k) - i * 0.1) * 2600;
        if (run <= 0) break;
        const ye = LANCE_END[i], track = (ye + 120) / uy;          // from above the top of the screen
        const sx = wallX - ux * track, sy = ye - uy * track;
        const head = Math.min(run, track), tail = Math.max(0, run - 300);
        if (tail >= track) continue;
        laser(g, sx + ux * head, sy + uy * head, ux, uy, head - tail);
      }
    },
  },

  delay: comet(['#ffffff', '#a58cff', '#4a2cff']),
  // GRAB (§3 M3 73.88–74.30 s): a giant dark-blue hand on a long arm reaching out of the
  // shooter, the ball at the heel of its palm; no comet. Holding a player it is a fist (drawFist,
  // champ-vfx drawOver), dragging him back.
  grab: {
    palette: ['#dfe8ff', '#3b5bdc', '#10206e'],
    draw(g, b, s) { if (s.pw.ph === 'fly') drawHand(g, s.x, s.y, s.pw.dir || 1, s.fx, s.fy, s.now); },
  },
  multiball: comet(['#ffffff', '#ffe05a', '#ffa200']),
  updown: comet(['#ffffff', '#5cf09a', '#0aa050']),
  ailment: comet(['#ffffff', '#f07cff', '#a01cff']),
  critical: comet(['#ffffff', '#ff6a82', '#ff0a3a']),
};

// THE AERIAL'S LANCE (M2 43.55–44.05 s, 1.5 world px a frame px): core ≈ 7 px across, red body
// ≈ 18, glow ≈ 36; pointed at the head (hx, hy), heading (ux, uy), fading over its length L.
const LANCE_END = [300, 190, 250, 160, 330, 215, 270, 180, 310, 235];   // where each meets the wall (world y)
function laser(g, hx, hy, ux, uy, L) {
  if (L < 4) return;
  const px = -uy, py = ux;
  const spear = (w, col, a, len) => {
    const k = Math.min(len * 0.12, 30);
    const ex = hx - ux * len, ey = hy - uy * len, nx = hx - ux * k, ny = hy - uy * k;
    const lg = g.createLinearGradient(hx, hy, ex, ey);
    lg.addColorStop(0, col); lg.addColorStop(0.5, col); lg.addColorStop(1, transparent(col));
    g.globalAlpha = a; g.fillStyle = lg;
    g.beginPath();
    g.moveTo(hx + ux * w * 0.8, hy + uy * w * 0.8);
    g.lineTo(nx + px * w, ny + py * w);
    g.lineTo(ex + px * w * 0.15, ey + py * w * 0.15);
    g.lineTo(ex - px * w * 0.15, ey - py * w * 0.15);
    g.lineTo(nx - px * w, ny - py * w);
    g.closePath(); g.fill();
  };
  g.save();
  spear(22, '#ff2a0a', 0.45, L);
  spear(11, '#ff3a10', 0.95, L);
  spear(6, '#ffb040', 0.9, L * 0.85);
  spear(3, '#fff6c8', 1, L * 0.7);
  g.restore();
}

// THE HAND (§3 M3 73.88–74.08 s, full-res crops): a giant dark-navy hand, ≈ 300 px from the
// fingertips to the ball and ≈ 200 px tall — a third of the screen's height — the ball at the heel
// of its palm; four thick fingers fanned forward and up, a thumb down, light-blue highlights on
// their upper edges, blurred behind; a thick arm, lighter along its middle, runs back from the palm
// toward where the shot was fired. Local frame: +x along the flight, y down; `dir` mirrors it.
const PALM = { x: 77, y: -38, rx: 58, ry: 52 };
// [angle in degrees (0 = straight ahead, −90 = up), palm centre → tip px, half-width at the base]
const FINGERS = [[-20, 222, 20], [-36, 200, 20], [-52, 170, 19], [-69, 132, 17]];
const THUMB = [28, 118, 20];
const rad = (d) => (d * Math.PI) / 180;

// (each part painted on its own: the palm and a finger wind opposite ways, and one path would
// leave holes where they overlap)
function handPath(g, ox, paint) {
  g.beginPath();
  g.ellipse(PALM.x + ox, PALM.y, PALM.rx, PALM.ry, -0.35, 0, TAU);
  paint();
  for (const [deg, len, w] of [...FINGERS, THUMB]) { g.beginPath(); digit(g, PALM.x + ox, PALM.y, rad(deg), len, w); paint(); }
}
// one finger: from inside the palm out to a rounded tip, tapering, the tip curling a little down
function digit(g, cx, cy, a, len, w) {
  const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  const b = PALM.rx * 0.45, tipW = w * 0.72;
  const bx = cx + ux * b, by = cy + uy * b, tx = cx + ux * (len - tipW), ty = cy + uy * (len - tipW) + len * 0.05;
  // arched like a reaching claw: the middle bowed up, the tip hooked a little down
  const up = py < 0 ? 1 : -1, mx = cx + ux * len * 0.55 + px * up * len * 0.09, my = cy + uy * len * 0.55 + py * up * len * 0.09;
  const mw = (w + tipW) / 2;
  g.moveTo(bx + px * w, by + py * w);
  g.quadraticCurveTo(mx + px * mw, my + py * mw, tx + px * tipW, ty + py * tipW);
  g.arc(tx, ty, tipW, a + Math.PI / 2, a - Math.PI / 2, true);
  g.quadraticCurveTo(mx - px * mw, my - py * mw, bx - px * w, by - py * w);
  g.closePath();
}
function armBand(g, x0, y0, x1, y1, w0, w1, a0) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < 4) return;
  const px = -dy / d, py = dx / d;
  const lg = g.createLinearGradient(x0, y0, x1, y1);
  lg.addColorStop(0, `rgba(16,34,110,${a0})`); lg.addColorStop(0.55, `rgba(24,54,160,${a0 * 0.6})`); lg.addColorStop(1, 'rgba(30,70,210,0)');
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(x0 + px * w0, y0 + py * w0); g.lineTo(x1 + px * w1, y1 + py * w1);
  g.lineTo(x1 - px * w1, y1 - py * w1); g.lineTo(x0 - px * w0, y0 - py * w0);
  g.closePath(); g.fill();
  // blurred lighter streaks running back along it (M3 73.95–74.02 s)
  const hl = g.createLinearGradient(x0, y0, x1, y1);
  hl.addColorStop(0, `rgba(80,125,240,${a0 * 0.7})`); hl.addColorStop(1, 'rgba(80,125,240,0)');
  g.strokeStyle = hl; g.lineCap = 'round';
  for (const [o, lw] of [[-0.45, 4], [0.05, 7], [0.5, 3]]) {
    g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0 + px * w0 * o, y0 + py * w0 * o); g.lineTo(x1 + px * w1 * o, y1 + py * w1 * o); g.stroke();
  }
}

export function drawHand(g, x, y, dir, fx, fy, t) {
  const K = 0.88;
  g.save();
  // the arm: a thick wrist out of the palm, back toward the shooter (never longer than 420 px)
  const px = x + dir * PALM.x * 0.7 * K, py = y + PALM.y * 0.6 * K;
  let ax = fx ?? x - dir * 400, ay = fy ?? y;
  const d = Math.hypot(ax - px, ay - py);
  if (d > 420) { ax = px + (ax - px) * 420 / d; ay = py + (ay - py) * 420 / d; }
  armBand(g, px, py, ax, ay, 40, 14, 0.95);
  g.translate(x, y); g.scale(dir * K, K);
  // motion blur: three fainter copies smeared behind (M3 73.95 s: the hand is soft-edged)
  g.fillStyle = '#1a3490';
  const fill = () => g.fill(), stroke = () => g.stroke();
  g.globalAlpha = 0.06; handPath(g, -66, fill);
  g.globalAlpha = 0.1; handPath(g, -44, fill);
  g.globalAlpha = 0.16; handPath(g, -22, fill);
  // a soft blue glow, then a lighter rim stroked UNDER the fill (only its outer half shows, so no
  // lines inside the hand), then the dark navy hand
  g.lineJoin = 'round';
  g.globalAlpha = 0.28; g.strokeStyle = '#2450e0'; g.lineWidth = 11;
  handPath(g, 0, stroke);
  g.globalAlpha = 0.65; g.strokeStyle = '#3a62d8'; g.lineWidth = 6;
  handPath(g, 0, stroke);
  const rg = g.createRadialGradient(PALM.x, PALM.y, 10, PALM.x, PALM.y, 230);
  rg.addColorStop(0, '#08113a'); rg.addColorStop(0.55, '#0f2168'); rg.addColorStop(1, '#1a3890');
  g.globalAlpha = 1; g.fillStyle = rg; handPath(g, 0, fill);
  // blurred lighter streaks along the top of each finger (M3 73.95 s)
  g.strokeStyle = '#3f6ae0'; g.lineWidth = 5; g.lineCap = 'round'; g.globalAlpha = 0.5;
  for (const [deg, len, w] of FINGERS) {
    const a = rad(deg), ux = Math.cos(a), uy = Math.sin(a), o = -w * 0.5;   // the side facing up
    const qx = -uy * o, qy = ux * o;
    g.beginPath();
    g.moveTo(PALM.x + ux * PALM.rx * 0.2 + qx, PALM.y + uy * PALM.rx * 0.2 + qy);
    g.quadraticCurveTo(PALM.x + ux * len * 0.5 + qx * 1.4, PALM.y + uy * len * 0.5 + qy * 1.4, PALM.x + ux * len * 0.78 + qx, PALM.y + uy * len * 0.78 + qy);
    g.stroke();
  }
  g.restore();
}

// THE FIST (§3 M3 74.15–74.25 s): closed round the seized player's body, ≈ 150 × 90 px, reaching
// back toward the shooter it is dragging him to, the arm a fading blue streak behind it.
export function drawFist(g, x, y, dir, ox, oy, t) {
  g.save();
  // the arm back to the shooter
  armBand(g, x - dir * 50, y - 10, ox, oy, 26, 12, 0.7);
  g.translate(x, y); g.scale(dir, 1);
  const path = () => {
    g.beginPath();
    g.ellipse(-40, 0, 62, 42, 0.1, 0, TAU);
    for (let i = 0; i < 4; i++) g.ellipse(4 + i * 3, -30 + i * 19, 20, 15, 0.4, 0, TAU);   // the knuckles, in front
    g.ellipse(-20, 30, 34, 16, -0.2, 0, TAU);                                          // the thumb, under
  };
  g.globalAlpha = 0.35; g.strokeStyle = '#2450e0'; g.lineWidth = 8; g.lineJoin = 'round'; path(); g.stroke();
  const rg = g.createRadialGradient(-30, -5, 8, -30, -5, 110);
  rg.addColorStop(0, '#08113a'); rg.addColorStop(0.55, '#0f2168'); rg.addColorStop(1, '#1a3890');
  g.globalAlpha = 1; g.fillStyle = rg; path(); g.fill();
  g.strokeStyle = '#5b82ea'; g.lineWidth = 3; g.globalAlpha = 0.75; g.lineCap = 'round';
  g.beginPath(); g.ellipse(-40, 0, 52, 32, 0.1, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
  g.restore();
}


// ── the moments on the defender (§4) ─────────────────────────────────────────────
// THE BLOCK (§4 M4 61.45–62.25 s): a crackling yellow-white spark burst where the ball grinds on
// the boot, re-drawn every frame for as long as the grind lasts. No particles.
export function drawGrind(g, x, y, now) {
  // M4 61.5–62.1 s: the ball glows inside a yellow-white orb ≈ 30 px in radius, thin yellow
  // sparks ≈ 50–100 px long crackling out of it, re-rolled every other frame.
  const seed = Math.floor(now * 30);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const og = g.createRadialGradient(x, y, 4, x, y, 34);
  og.addColorStop(0, 'rgba(255,255,240,0.95)'); og.addColorStop(0.45, 'rgba(255,240,140,0.7)'); og.addColorStop(1, 'rgba(255,220,60,0)');
  g.fillStyle = og; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
  for (let i = 0; i < 7; i++) {
    const j = Math.sin((seed + i * 7) * 12.9898) * 43758.5453, rnd = j - Math.floor(j);
    const a = (i / 7) * TAU + rnd * 0.7, L = 48 + rnd * 52;
    const mx = x + Math.cos(a + 0.12) * L * 0.55, my = y + Math.sin(a + 0.12) * L * 0.55;
    for (const [col, lw, al] of [['#ffd23c', i % 3 ? 6 : 8, 0.45], ['#fff6c0', i % 3 ? 2.2 : 3.2, 1]]) {
      g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.lineTo(mx, my); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }
  g.restore();
}
