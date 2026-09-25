// STAGE 1 — SOUTH KOREA'S BLUE AURA SHOT.
//
// Wiki (South_Korea): "shoots the ball horizontally towards the opponent at a high speed, which is
// cloaked in a blue aura." It is Head Soccer's starter shot — the comet we filmed eleven times in
// M4/M1 (docs/HS-POWER-SHOTS.md §3): a white-hot core behind the ball inside a long tapering blue
// body, full for 0.2 s then thinning to a streak with after-images. So: that comet, in the deeper
// blue of the aura, and the aura itself — a blue flame cloak hugging the ball.
// Armed: HS's own gold rim (champ-vfx drawArmed) with a faint blue glow round the head (ours).

import { drawComet } from '../families.js';
import { TAU } from './common.js';

const PALETTE = ['#ffffff', '#4f9dff', '#1f45ff', '#bfe4ff'];

// the cloak: a blue glow round the ball and a flickering flame edge (re-rolled every frame)
function aura(g, x, y, r, dir, a) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const rg = g.createRadialGradient(x, y, r * 0.8, x, y, r * 2.8);
  rg.addColorStop(0, 'rgba(120,180,255,0.9)'); rg.addColorStop(0.45, 'rgba(40,100,255,0.55)'); rg.addColorStop(1, 'rgba(20,50,255,0)');
  g.globalAlpha = a; g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 2.8, 0, TAU); g.fill();
  // flame tongues, longer behind the ball (swept back by the flight)
  g.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * TAU;
    const back = Math.max(0, -Math.cos(ang) * dir);           // 1 straight behind
    const rr = r * (1.45 + 0.35 * Math.random() + 1.1 * back * (0.6 + 0.4 * Math.random()));
    const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.9;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  g.globalAlpha = 0.5 * a; g.fillStyle = '#2f6bff'; g.fill();
  g.globalAlpha = 0.9 * a; g.strokeStyle = '#a8d4ff'; g.lineWidth = 2; g.stroke();
  g.restore();
}

export default {
  id: 'blueaura',
  palette: PALETTE,
  draw(g, b, s) {
    drawComet(g, s, PALETTE, 1.05, 1.1);
    aura(g, s.x, s.y, s.r, s.pw.dir || 1, s.t < 0.35 ? 1 : 0.7);
    return false;
  },
  armed(g, p, s) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const k = 0.8 + 0.2 * Math.sin(s.t * 7);
    const rg = g.createRadialGradient(s.hx, s.hy, s.r * 0.95, s.hx, s.hy, s.r * 1.7);
    rg.addColorStop(0, 'rgba(60,130,255,0.55)'); rg.addColorStop(1, 'rgba(40,90,255,0)');
    g.globalAlpha = k; g.fillStyle = rg;
    g.beginPath(); g.arc(s.hx, s.hy, s.r * 1.7, 0, TAU); g.fill();
    g.restore();
  },
};
