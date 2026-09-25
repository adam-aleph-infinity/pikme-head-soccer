// STAGE 6 — RUSSIA'S ICE SHOT, drawn (what it does: shared/champion-powers/stage-06.js).
//
// Wiki (Russia): "A ball of ice is shot through the air towards the other player's goal"; the one
// who blocks it "will be frozen in a block of ice for a short period of time".
// So: the ball turned to ice — a pale faceted crystal ball with a few short icicle spikes and a
// white glint — trailing a cold white-blue mist with ice shards and snowflakes flaking off it; the
// frozen defender stands inside a translucent blue ice block (public/vfx/ailments.js `iced`).
// Armed: HS's gold rim, with three little snowflakes circling the head (ours).
// Client only: Math.random is fine here — nothing drawn feeds back into the sim.

const TAU = Math.PI * 2;

function flake(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI, c = Math.cos(a) * r, s = Math.sin(a) * r;
    g.moveTo(x - c, y - s); g.lineTo(x + c, y + s);
    // the little barbs near each tip
    for (const e of [1, -1]) {
      const bx = x + c * 0.6 * e, by = y + s * 0.6 * e, ba = a + (e > 0 ? 0 : Math.PI);
      g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba + 0.7) * r * 0.35, by + Math.sin(ba + 0.7) * r * 0.35);
      g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba - 0.7) * r * 0.35, by + Math.sin(ba - 0.7) * r * 0.35);
    }
  }
  g.stroke();
}

// The ice ball: a faceted crystal sphere, a size up from the plain ball.
export function iceBall(g, x, y, r, rot) {
  const R = r * 1.3;
  g.save();
  // cold glow
  const gl = g.createRadialGradient(x, y, R * 0.6, x, y, R * 2.4);
  gl.addColorStop(0, 'rgba(190,240,255,0.7)'); gl.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, R * 2.4, 0, TAU); g.fill();
  // icicle spikes round it
  g.fillStyle = '#e8fbff'; g.strokeStyle = '#6fb8e0'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = rot + (i / 7) * TAU, L = R * (i % 2 ? 1.45 : 1.7);
    g.beginPath();
    g.moveTo(x + Math.cos(a - 0.28) * R * 0.92, y + Math.sin(a - 0.28) * R * 0.92);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.lineTo(x + Math.cos(a + 0.28) * R * 0.92, y + Math.sin(a + 0.28) * R * 0.92);
    g.closePath(); g.fill(); g.stroke();
  }
  // the sphere
  const sg = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.45, '#bff0ff'); sg.addColorStop(1, '#4aa6d8');
  g.fillStyle = sg; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  g.strokeStyle = '#2f7fb4'; g.lineWidth = 1.6; g.stroke();
  // facets: a hexagon inside and its spokes
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i <= 6; i++) { const a = rot * 0.5 + (i / 6) * TAU; g.lineTo(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55); }
  for (let i = 0; i < 6; i++) { const a = rot * 0.5 + (i / 6) * TAU; g.moveTo(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55); g.lineTo(x + Math.cos(a) * R * 0.97, y + Math.sin(a) * R * 0.97); }
  g.stroke();
  // the glint
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.ellipse(x - R * 0.38, y - R * 0.42, R * 0.22, R * 0.12, -0.6, 0, TAU); g.fill();
  g.restore();
}

export default {
  id: 'iceshot',
  palette: ['#ffffff', '#bff0ff', '#4aa6d8'],
  draw(g, b, s) {
    const dir = s.pw.dir || 1, x = s.x, y = s.y, r = s.r;
    // the path back from the ball (the recorded one, straight back along the heading when short)
    const pts = [{ x, y }];
    const h = s.hist || [];
    for (let i = 1; i < h.length && pts.length < 12; i++) pts.push(h[i]);
    while (pts.length < 8) { const q = pts[pts.length - 1]; pts.push({ x: q.x - dir * 30, y: q.y }); }
    const k = s.t < 0.25 ? 1 : 0.8;
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    // the cold mist: three passes along the path, wide and faint to thin and white
    for (const [w, col, a] of [[40, '#3a8fd8', 0.3], [24, '#9fe4ff', 0.5], [9, '#ffffff', 0.85]]) {
      const end = pts[Math.min(pts.length - 1, 9)];
      const lg = g.createLinearGradient(x, y, end.x, end.y);
      lg.addColorStop(0, col); lg.addColorStop(1, col + '00');
      g.strokeStyle = lg; g.globalAlpha = a * k; g.lineWidth = w;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= Math.min(pts.length - 1, 9); i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
    g.restore();
    // shards and snowflakes flaking off behind it
    g.save();
    const seed = Math.floor((s.now || 0) * 20);
    for (let i = 0; i < 9; i++) {
      const j = 2 + ((i * 7 + seed) % 9), p = pts[Math.min(pts.length - 1, j)];
      const ox = (((i * 37 + seed * 13) % 23) - 11), oy = (((i * 53 + seed * 7) % 29) - 14);
      g.globalAlpha = 0.9 - j * 0.07;
      if (i % 3 === 0) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.3; flake(g, p.x + ox, p.y + oy, 5, i + seed * 0.2);
      } else {
        g.fillStyle = i % 2 ? '#dff8ff' : '#9fe4ff';
        g.beginPath(); g.moveTo(p.x + ox, p.y + oy - 4); g.lineTo(p.x + ox + 3, p.y + oy + 2); g.lineTo(p.x + ox - 3, p.y + oy + 3); g.closePath(); g.fill();
      }
    }
    g.restore();
    iceBall(g, x, y, r, (s.now || 0) * 4 * dir);
    return true;
  },
  armed(g, p, s) {
    g.save(); g.strokeStyle = '#e8fbff'; g.lineWidth = 1.8; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = s.t * 2.2 + (i / 3) * TAU;
      flake(g, s.hx + Math.cos(a) * s.r * 1.45, s.hy + Math.sin(a) * s.r * 0.6 - s.r * 0.3, 5.5, s.t * 3 + i);
    }
    g.restore();
  },
};
