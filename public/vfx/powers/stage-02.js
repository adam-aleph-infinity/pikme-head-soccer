// STAGE 2 — CAMEROON'S THUNDERBOLT SHOT.
//
// Wiki (Cameroon): "the ball is covered in lightning, and it shoots straight across the field";
// the one it hits "turns blue and is surrounded in electricity and is stunned, unable to jump or
// move fast" (the shock ailment — public/vfx/ailments.js draws the blue wash and sparks).
// So: the ball inside a crackling yellow-white electric sphere, bolts jumping off it, and a trail
// of forked lightning behind it instead of the comet's flame — re-rolled every frame so it
// crackles, the same flicker language as HS's arming rim. Few strokes, no particles.
// Armed: HS's gold rim, with two little sparks crackling over the body (ours).

import { TAU, bolt } from './common.js';

export default {
  id: 'thunderbolt',
  palette: ['#fffbe0', '#ffe23a', '#5fb0ff'],
  draw(g, b, s) {
    const dir = s.pw.dir || 1, x = s.x, y = s.y, r = s.r;
    const full = s.t < 0.3 ? 1 : 0.75;
    // heading, from the ball's own velocity (screen space is world space here)
    const v = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / v || dir, uy = b.vy / v || 0;
    g.save(); g.globalCompositeOperation = 'lighter';
    // a faint blue-white haze along the path
    const L = 270;
    const hg = g.createLinearGradient(x, y, x - ux * L, y - uy * L);
    hg.addColorStop(0, 'rgba(150,210,255,0.55)'); hg.addColorStop(1, 'rgba(60,120,255,0)');
    g.globalAlpha = full; g.fillStyle = hg;
    g.beginPath();
    g.moveTo(x - uy * r * 2.6, y + ux * r * 2.6); g.lineTo(x - ux * L - uy * 8, y - uy * L + ux * 8);
    g.lineTo(x - ux * L + uy * 8, y - uy * L - ux * 8); g.lineTo(x + uy * r * 2.6, y - ux * r * 2.6);
    g.closePath(); g.fill();
    // the forked lightning trail: three bolts back along the path
    for (let i = 0; i < 3; i++) {
      const len = L * (0.55 + 0.45 * Math.random()), off = (i - 1) * r * 0.7;
      bolt(g, x - ux * r * 0.8 - uy * off, y - uy * r * 0.8 + ux * off, x - ux * len - uy * off * 1.8, y - uy * len + ux * off * 1.8, 7, 16, '#58a8ff', '#fff6b0', i === 1 ? 1.7 : 1.2);
    }
    // the electric sphere round the ball
    const R = r * 3.2;
    const rg = g.createRadialGradient(x, y, r * 0.6, x, y, R);
    rg.addColorStop(0, 'rgba(255,255,230,0.95)'); rg.addColorStop(0.5, 'rgba(255,230,90,0.6)'); rg.addColorStop(1, 'rgba(80,160,255,0)');
    g.globalAlpha = 1; g.fillStyle = rg; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    // bolts jumping off it
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * TAU, l = r * (2.4 + Math.random() * 1.8);
      bolt(g, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * l, y + Math.sin(a) * l, 4, 7, '#7cc4ff', '#ffffff', 1.1);
    }
    g.restore();
    return false;
  },
  armed(g, p, s) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * TAU, x0 = s.hx + Math.cos(a) * s.r * 1.1, y0 = s.hy + Math.sin(a) * s.r * 1.1;
      bolt(g, x0, y0, x0 + Math.cos(a) * s.r * 0.7, y0 + Math.sin(a) * s.r * 0.7 + s.r * 0.3, 3, 4, '#6fb8ff', '#fff6b0', 0.7);
    }
    g.restore();
  },
};
