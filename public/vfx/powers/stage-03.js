// STAGE 3 — NIGERIA'S TORNADO SHOT.
//
// Wiki (Nigeria): "Nigeria unleashes a tornado whirlwind on the ground towards the opponent";
// "the shot bounces up and down very quickly"; "if the tornado touches the opponent, they fly and
// spin in the air and they stay unconscious for 3 seconds". Power_Shot_Guide: "you can also get
// hit by the power shot when you jump" — the whirlwind is tall.
// Not in our footage, so painted at the filmed effects' quality (fx-kit.js whirl): a translucent
// spinning funnel of grey-sand dust ≈ 150 px tall (twice a player), narrow at the foot and flaring
// to ≈ 140 px across at the top — helical bands and turbulent grain turning round it (an 8-frame
// flipbook, ≈ 3 turns a second), its silhouette denser than its middle, leaning back from where it
// runs and swaying; a ring of dust kicked up round its foot, a dust wake behind, the ball hopping
// inside near the bottom. The one it catches spins up inside a smaller one (ailments.js twister).
// Armed: Head Soccer's own yellow flame licks (fx-kit drawArmedGlow) — the same for everyone.

import { whirl, smoke, blit, glow, TAU } from '../fx-kit.js';
import * as C from '../../../shared/constants.js';

const H = 150;                          // funnel height, world px (champion-powers TORNADO.H)
const W = 150;                          // its drawn width (the texture flares to ≈ 0.98 of it at the top)
export const SAND = () => whirl('sand', '#f1e8d4', '#7a6a50');

// The funnel with its foot at (x, gy): `h` tall, `lean` px the top is carried back, `t` the clock.
export function drawFunnel(g, x, gy, h, lean, t, a = 1, w = W * (h / H)) {
  const bk = SAND(), f = Math.floor(t * 24) % bk.length;
  g.save();
  g.globalAlpha = a;
  g.translate(x, gy);
  g.transform(1, 0, -lean / h, 1, 0, 0);                      // lean: the top trails the foot
  g.drawImage(bk[f], -w / 2, -h, w, h * 1.02);
  g.restore();
}
// Dust boiling round the foot: puffs orbiting a flat ellipse, the near ones in front.
function footDust(g, x, gy, t, dir, a = 1) {
  for (let i = 0; i < 6; i++) {
    const an = t * 9 + (i / 6) * TAU, z = Math.sin(an);
    const r = 16 + 10 * ((i * 37) % 5) / 5;
    blit(g, smoke(i, '#d9ccb0'), x + Math.cos(an) * 30 - dir * 6, gy - 8 + z * 6, r * 2, r * 1.6, an, (0.45 + 0.25 * z) * a, false);
  }
}

export default {
  id: 'tornado',
  palette: ['#f4ecd8', '#c9b48a', '#8a7654'],
  warm() { SAND(); smoke(0, '#d9ccb0'); smoke(0, '#cbbd9e'); glow('#e8d6a8', 0.05); },
  draw(g, b, s) {
    const dir = s.pw.dir || 1, gy = C.GROUND_Y, t = s.now;
    const sway = Math.sin(t * 5) * 10;
    if (s.pw.ph === 'drop') {
      // coming down onto the grass: the funnel already spinning up under it
      drawFunnel(g, s.x, gy, H * 0.6, -dir * 10 + sway * 0.5, t, 0.75);
      footDust(g, s.x, gy, t, dir, 0.6);
      return false;
    }
    // the dust wake behind it
    if (s.hist) {
      for (let i = 2; i < s.hist.length; i += 3) {
        const h = s.hist[i], f = i / s.hist.length;
        blit(g, smoke(i, '#cbbd9e'), h.x - dir * 10, gy - 10 - f * 14, 44 + i * 2.5, 34 + i * 2, i * 0.7 + t, 0.42 * (1 - f), false);
      }
    }
    footDust(g, s.x, gy, t, dir);
    drawFunnel(g, s.x, gy, H, -dir * 22 + sway, t);
    // a faint warm light where it scours the grass
    blit(g, glow('#e8d6a8', 0.05), s.x, gy - 4, 110, 26, 0, 0.35, true);
    return false;
  },
};
