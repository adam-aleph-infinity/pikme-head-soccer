// STAGE 4 — USA'S ILLUSION SHOT.
//
// Wiki (USA): "The ball multiplies into eight balls, which all aim for the goal. 7/8 balls are
// fake, but after the shot has travelled a small distance, there will only be one ball left that
// is real. For a short time after the shot, the ball becomes invisible to the opponent and
// translucent to whoever uses the shot." Power_Shot_Guide: it "travels slightly downward", "you
// can see it when the ball bounces", and close in it goes "through your opponent".
// So: eight identical balls fanning out toward the goal, each with a short pale streak; seven pop
// in a little white puff after ≈ 260 px; the real one fades out — a faint shimmer for the
// defender, a ghost of itself for the shooter — and flashes back into sight each time it bounces.
// Armed: HS's gold rim, with the head shimmering into ghost copies either side (ours).

import { TAU, ball, streak, puff } from './common.js';
import { ILLUSION } from '../../../shared/champion-powers/stage-04.js';
import * as C from '../../../shared/constants.js';

const SLOPES = [-0.46, -0.31, -0.17, -0.05, 0.2, 0.34, 0.5];        // the seven fakes (vy / vx)
const COLS = ['#ffffff', '#cfe6ff', '#6fa8ff'];

// a straight line from (x0, y0) at slope k, mirrored off the grass and the sky like the real one
function along(x0, y0, dir, S, k, t, r) {
  const floor = C.GROUND_Y - r, sky = C.SKY_Y + r;
  let y = y0 + k * S * t;
  for (let i = 0; i < 3; i++) { if (y > floor) y = 2 * floor - y; else if (y < sky) y = 2 * sky - y; }
  return { x: x0 + dir * S * t, y };
}

export default {
  id: 'illusion',
  palette: COLS,
  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, S = Math.abs(pw.vx0) || C.POWER_SHOT_SPEED, t = s.t;
    const v = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / v || dir, uy = b.vy / v || 0;
    // 1. the eight: the seven fakes beside the real one, all alike
    if (t < ILLUSION.FAKES) {
      for (const k of SLOPES) {
        const q = along(s.fx, s.fy, dir, S, k, t, s.r);
        const d = Math.hypot(1, k);
        streak(g, q.x, q.y, dir / d, k / d, Math.min(170, S * t * d), COLS, 0.7, 0.9);   // (back to where they split: a fan)
        ball(g, s, q.x, q.y, 1);
      }
      streak(g, s.x, s.y, ux, uy, Math.min(170, S * t), COLS, 0.7, 0.9);
      return false;
    }
    // 2. seven pop — a little white puff where each one was
    const tp = t - ILLUSION.FAKES;
    if (tp < 0.12) {
      g.save();
      for (const k of SLOPES) {
        const q = along(s.fx, s.fy, dir, S, k, ILLUSION.FAKES, s.r);
        puff(g, q.x, q.y, s.r * (1.2 + tp * 14), '#ffffff', 0.8 * (1 - tp / 0.12));
        g.globalAlpha = 0.7 * (1 - tp / 0.12); g.strokeStyle = '#dcecff'; g.lineWidth = 2;
        g.beginPath(); g.arc(q.x, q.y, s.r * (1 + tp * 18), 0, TAU); g.stroke();
      }
      g.restore();
    }
    // 3. invisible: to the defender a faint shimmer, to the shooter a ghost — but a bounce shows it
    if (pw.inv || tp < ILLUSION.INV) {
      const bounce = s.y > C.GROUND_Y - s.r - 6;
      const mine = s.me === pw.owner;
      const a = bounce ? 1 : mine ? 0.35 : 0.08;
      g.save();
      g.globalAlpha = bounce ? 0.8 : 0.22; g.strokeStyle = '#e8f4ff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(s.x + Math.sin(s.now * 40) * 1.5, s.y, s.r * 1.35, 0, TAU); g.stroke();
      if (bounce) puff(g, s.x, C.GROUND_Y - 4, 20, '#ffffff', 0.5);
      g.restore();
      ball(g, s, s.x, s.y, a);
      return true;
    }
    // 4. back in sight: the plain ball with its pale streak
    streak(g, s.x, s.y, ux, uy, 90, COLS, 0.75, 0.8);
    return false;
  },
  armed(g, p, s) {
    const ph = Math.floor(s.t * 8) % 2 ? 1 : -1;
    g.save();
    for (const o of [-1, 1]) {
      g.globalAlpha = o === ph ? 0.4 : 0.18;
      g.strokeStyle = '#dcecff'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(s.hx + o * s.r * 0.55, s.hy, s.r, 0, TAU); g.stroke();
    }
    g.restore();
  },
};
