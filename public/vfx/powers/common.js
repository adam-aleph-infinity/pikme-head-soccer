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

// A stable pseudo-random number in [0, 1) for an integer `i` (and an optional salt): the same every
// frame, so a particle laid out from it does not jump about the way Math.random's would.
export function hash(i, salt = 0) {
  let h = (Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A flame tongue standing on (x, y), `h` tall and `w` wide, leaning `lean` (px at the tip),
// flickering with `k` (0..1): a soft orange body round a yellow core, drawn additively.
export function flame(g, x, y, h, w, lean = 0, k = 0.5, cols = ['#ff4a12', '#ff9a1a', '#fff2a0']) {
  if (h < 2) return;
  const tip = [x + lean, y - h * (0.85 + 0.3 * k)];
  const shape = (s) => {
    g.beginPath();
    g.moveTo(x - w * s, y);
    g.bezierCurveTo(x - w * s * 1.1, y - h * 0.45 * s, tip[0] - w * 0.25 * s, tip[1] + h * 0.35, tip[0], tip[1] + h * (1 - s) * 0.6);
    g.bezierCurveTo(tip[0] + w * 0.35 * s, tip[1] + h * 0.4, x + w * s * 1.1, y - h * 0.4 * s, x + w * s, y);
    g.closePath();
  };
  g.save(); g.globalCompositeOperation = 'lighter';
  const lg = g.createLinearGradient(x, y, tip[0], tip[1]);
  lg.addColorStop(0, cols[1]); lg.addColorStop(1, cols[0] + '00');
  g.globalAlpha = 0.75; g.fillStyle = lg; shape(1); g.fill();
  const cg = g.createLinearGradient(x, y, tip[0], tip[1]);
  cg.addColorStop(0, cols[2]); cg.addColorStop(0.7, cols[1] + '00');
  g.globalAlpha = 0.9; g.fillStyle = cg; shape(0.5); g.fill();
  g.restore();
}

// A rounded rectangle path (ctx.roundRect is missing on older iOS WebViews).
export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
