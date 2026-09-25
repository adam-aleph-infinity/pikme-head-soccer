// Small drawing pieces the champions' power renderers share (public/vfx/powers/stage-NN.js).
// Client only: Math.random is fine here — nothing drawn feeds back into the sim.

export const TAU = Math.PI * 2;

// A plain ball at (x, y): the game's own ball painter when there is one (s.ball), else a disc.
export function ball(g, s, x, y, alpha = 1) {
  if (s.ball && alpha >= 1) { s.ball(g, x, y); return; }
  // (a see-through ball — USA's invisible one — is a plain disc: the game's painter is opaque)
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1b2436'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, s.r || 12, 0, TAU); g.fill(); g.stroke();
  g.restore();
}

// A jagged line from (x1, y1) to (x2, y2): n kinks, each up to `amp` px off the straight line.
export function jagPath(g, x1, y1, x2, y2, n, amp, rnd = Math.random) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d;
  g.beginPath(); g.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const f = i / n, o = (rnd() - 0.5) * 2 * amp;
    g.lineTo(x1 + dx * f + px * o, y1 + dy * f + py * o);
  }
  g.lineTo(x2, y2);
}

// A bolt: a wide soft glow under a thin hot core, along one jagged path.
export function bolt(g, x1, y1, x2, y2, n, amp, glow = '#6fb8ff', core = '#fffbe0', w = 1) {
  const pts = [];
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d;
  pts.push(x1, y1);
  for (let i = 1; i < n; i++) { const f = i / n, o = (Math.random() - 0.5) * 2 * amp; pts.push(x1 + dx * f + px * o, y1 + dy * f + py * o); }
  pts.push(x2, y2);
  const path = () => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = glow; g.globalAlpha = 0.45; g.lineWidth = 7 * w; path(); g.stroke();
  g.strokeStyle = core; g.globalAlpha = 1; g.lineWidth = 2.2 * w; path(); g.stroke();
}

// A streak of light from its head (hx, hy) back along (-ux, -uy), `len` px: glow, body, core.
export function streak(g, hx, hy, ux, uy, len, cols, w = 1, alpha = 1) {
  if (len < 3) return;
  const ex = hx - ux * len, ey = hy - uy * len;
  const px = -uy, py = ux, a0 = Math.atan2(uy, ux);
  const spear = (hw, col, a, L) => {
    const qx = hx - ux * L, qy = hy - uy * L;
    const lg = g.createLinearGradient(hx, hy, qx, qy);
    lg.addColorStop(0, col); lg.addColorStop(0.35, col); lg.addColorStop(1, col + '00');
    g.globalAlpha = a * alpha; g.fillStyle = lg;
    g.beginPath();
    g.arc(hx, hy, hw, a0 + Math.PI / 2, a0 - Math.PI / 2, true);     // the round nose
    g.lineTo(qx - px * hw * 0.2, qy - py * hw * 0.2);
    g.lineTo(qx + px * hw * 0.2, qy + py * hw * 0.2);
    g.closePath(); g.fill();
  };
  g.save(); g.globalCompositeOperation = 'lighter';
  spear(15 * w, cols[2], 0.35, len);
  spear(8 * w, cols[1], 0.8, len * 0.9);
  spear(3.2 * w, cols[0], 1, len * 0.7);
  g.restore();
  return { ex, ey };
}

// A soft round puff (smoke, dust): a radial gradient disc.
export function puff(g, x, y, r, col, a) {
  const rg = g.createRadialGradient(x, y, r * 0.15, x, y, r);
  rg.addColorStop(0, col); rg.addColorStop(1, col + '00');
  g.globalAlpha = a; g.fillStyle = rg;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
