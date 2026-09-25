// STAGE 3 — NIGERIA'S TORNADO SHOT.
//
// Wiki (Nigeria): "Nigeria unleashes a tornado whirlwind on the ground towards the opponent";
// "the shot bounces up and down very quickly"; "if the tornado touches the opponent, they fly and
// spin in the air and they stay unconscious for 3 seconds". Power_Shot_Guide: "you can also get
// hit by the power shot when you jump" — the whirlwind is tall.
// So: a sandy grey funnel standing on the grass round the ball — narrow at the foot, wide at the
// top, ≈ 150 px tall (twice a player), its rings spinning, swaying a little, dust kicked up at its
// base and a short dust wake behind; the ball hopping inside near the bottom. The one it catches
// spins up inside a small whirl (ailments.js `twister`).
// Armed: HS's gold rim, with a little dust devil circling the feet (ours).

import { TAU, puff } from './common.js';
import * as C from '../../../shared/constants.js';

const H = 150;                          // funnel height, world px (champion-powers CP.TORNADO_H)

// the funnel with its foot at (x, gy), `sway` px of lean at the top, `spin` the ring phase
export function funnel(g, x, gy, h, spin, sway, a = 1, wTop = 70, wBot = 16) {
  const top = gy - h;
  g.save();
  // the body: a translucent sandy silhouette
  const lg = g.createLinearGradient(0, top, 0, gy);
  lg.addColorStop(0, 'rgba(224,212,186,0.72)'); lg.addColorStop(0.6, 'rgba(190,172,138,0.78)'); lg.addColorStop(1, 'rgba(150,130,96,0.85)');
  g.globalAlpha = a; g.fillStyle = lg;
  g.beginPath();
  g.moveTo(x - wBot, gy);
  g.quadraticCurveTo(x - wBot * 1.4 + sway * 0.3, gy - h * 0.55, x - wTop + sway, top);
  g.lineTo(x + wTop + sway, top);
  g.quadraticCurveTo(x + wBot * 1.4 + sway * 0.3, gy - h * 0.55, x + wBot, gy);
  g.closePath(); g.fill();
  // the spinning rings: flat ellipses up the funnel, each a bright front arc over a darker back
  g.lineCap = 'round';
  const n = 8;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), y = gy - 6 - f * (h - 10);
    const w = wBot + (wTop - wBot) * f * f * 0.85 + (wTop - wBot) * f * 0.15, cx = x + sway * f * f;
    const ry = 3 + w * 0.2, ph = spin * (1.4 - f * 0.5) + i * 1.3;
    g.globalAlpha = 0.55 * a; g.strokeStyle = '#8a7654'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, y, w, ry, 0, Math.PI + ph % 1, TAU - 0.2); g.stroke();
    g.globalAlpha = 0.95 * a; g.strokeStyle = i % 2 ? '#f4ecd8' : '#e2d6b8'; g.lineWidth = i % 2 ? 2.2 : 3;
    const s0 = (ph % TAU);
    g.beginPath(); g.ellipse(cx, y, w, ry, 0, s0, s0 + 2.2); g.stroke();
  }
  // streak lines running up it
  g.globalAlpha = 0.5 * a; g.strokeStyle = '#fff8e6'; g.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const o = Math.sin(spin * 2 + k * 2.1);
    g.beginPath(); g.moveTo(x + o * wBot, gy - 4); g.quadraticCurveTo(x + o * wTop * 0.5 + sway * 0.3, gy - h * 0.5, x + o * wTop * 0.9 + sway, top + 4); g.stroke();
  }
  g.restore();
}

export default {
  id: 'tornado',
  palette: ['#f4ecd8', '#c9b48a', '#8a7654'],
  draw(g, b, s) {
    const dir = s.pw.dir || 1, gy = C.GROUND_Y;
    const spin = s.now * 16, sway = -dir * 16 + Math.sin(s.now * 5) * 8;
    if (s.pw.ph === 'drop') {
      // coming down onto the grass: the funnel already spinning up under it
      funnel(g, s.x, gy, H * 0.6, spin, sway * 0.5, 0.7);
      return false;
    }
    // the dust wake behind it
    if (s.hist) {
      for (let i = 3; i < s.hist.length; i += 4) {
        const h = s.hist[i];
        puff(g, h.x, gy - 8, 16 + i, '#b9a57e', 0.28 * (1 - i / s.hist.length));
      }
    }
    funnel(g, s.x, gy, H, spin, sway);
    // dust kicked up at its foot
    g.save();
    for (let k = 0; k < 3; k++) {
      const o = ((s.now * 3 + k / 3) % 1);
      puff(g, s.x - dir * (10 + o * 30) + (k - 1) * 10, gy - 6 - o * 10, 14 + o * 10, '#c2ad84', 0.55 * (1 - o));
    }
    g.restore();
    return false;
  },
  armed(g, p, s) {
    // a little dust devil circling the feet
    g.save();
    const spin = s.t * 12;
    for (let i = 0; i < 3; i++) {
      const y = s.fy - 4 - i * 9, w = 16 + i * 6;
      g.globalAlpha = 0.7; g.strokeStyle = i % 2 ? '#efe4c8' : '#c9b48a'; g.lineWidth = 2.5; g.lineCap = 'round';
      const a0 = spin + i * 1.7;
      g.beginPath(); g.ellipse(s.fx, y, w, 4 + i, 0, a0, a0 + 2.4); g.stroke();
    }
    g.restore();
  },
};
