// STAGE 5 — JAPAN'S NINJA SHOT.
//
// Wiki (Japan): "When activated and when Japan touches the ball, he turns into a log"; he "rises
// into the air surrounded by five soccer balls", then "a few streaks of blue light (the fake
// 'balls') will shoot downwards towards the goal with one green streak containing the ball".
// Power_Shot_Guide: the order is always middle, very low, the highest, a little lower, middle; the
// green one is "always in a random place"; "the blue balls are all completely fake".
// So: from the touch the shooter is a log (a puff of smoke as he swaps); five balls circle over
// where he stood; then, one every 0.13 s, streaks of blue light shoot down at the goal at those
// five heights — the one that carries the ball is green, with the ball at its nose.
// Armed: HS's gold rim, with a wisp of ninja smoke curling round the feet (ours).

import { TAU, ball, streak, puff } from './common.js';
import { NINJA, ninjaTarget } from '../../../shared/champion-powers/stage-05.js';
import * as C from '../../../shared/constants.js';

const BLUE = ['#e6f6ff', '#5cb8ff', '#1f6bff'];
const GREEN = ['#eaffe6', '#52e07a', '#12a04a'];
const ORBIT = 38;

// seconds into the volley (0 = the ball has just left the cut-in)
const volleyT = (pw) => (pw.ph === 'nwait' ? pw.k : pw.slot * NINJA.GAP + pw.t);
const logLeft = (pw) => pw.cp === 'ninja' && !pw.rb && (pw.ph === 'nwait' || volleyT(pw) < 4 * NINJA.GAP + 0.45);

// the five circling over the spot he rose from; `fired(i)` says which have gone
function orbit(g, s, ox, oy, now, fired) {
  g.save(); g.globalCompositeOperation = 'lighter';
  puff(g, ox, oy, ORBIT + 22, '#5cb8ff', 0.35);
  g.restore();
  for (let i = 0; i < 5; i++) {
    if (fired(i)) continue;
    const a = now * 7 + (i / 5) * TAU;
    ball(g, s, ox + Math.cos(a) * ORBIT, oy + Math.sin(a) * ORBIT * 0.8, 1);
  }
}

// THE LOG: upright, head-and-body tall, where the shooter stands — bark, rings on top, a stub.
export function drawLog(g, x, fy, r, a = 1, dir = 1) {
  const w = r * 1.5, h = r * 3.1, top = fy - h;
  g.save(); g.globalAlpha = a; g.lineJoin = 'round';
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  lg.addColorStop(0, '#5a3616'); lg.addColorStop(0.35, '#9a6430'); lg.addColorStop(0.7, '#7f4f22'); lg.addColorStop(1, '#4a2c12');
  g.fillStyle = lg; g.strokeStyle = '#2e1a08'; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x - w / 2, top); g.lineTo(x - w / 2, fy - 4);
  g.ellipse(x, fy - 4, w / 2, w * 0.14, 0, Math.PI, 0, true);
  g.lineTo(x + w / 2, top);
  g.closePath(); g.fill(); g.stroke();
  // bark grooves
  g.strokeStyle = 'rgba(40,22,8,0.7)'; g.lineWidth = 1.6;
  for (const [fx, y0, y1] of [[-0.28, 0.12, 0.55], [0.05, 0.3, 0.85], [0.3, 0.1, 0.45], [-0.1, 0.62, 0.95], [0.25, 0.6, 0.9]]) {
    g.beginPath(); g.moveTo(x + fx * w, top + y0 * h); g.quadraticCurveTo(x + fx * w + 3, top + (y0 + y1) / 2 * h, x + fx * w - 1, top + y1 * h); g.stroke();
  }
  // a branch stub
  g.fillStyle = '#7a4a1e'; g.strokeStyle = '#2e1a08'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(x + dir * w * 0.55, top + h * 0.42, w * 0.18, w * 0.11, -0.4 * dir, 0, TAU); g.fill(); g.stroke();
  // the cut top: rings
  g.fillStyle = '#e0b378'; g.strokeStyle = '#2e1a08'; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(x, top, w / 2, w * 0.16, 0, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = '#a8753e'; g.lineWidth = 1.2;
  for (const k of [0.66, 0.38]) { g.beginPath(); g.ellipse(x, top, w / 2 * k, w * 0.16 * k, 0, 0, TAU); g.stroke(); }
  g.restore();
}
function smoke(g, x, y, r, k) {
  g.save();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.6;
    puff(g, x + Math.cos(a) * r * (0.6 + k), y + Math.sin(a) * r * (0.5 + k * 0.8), r * (0.7 + k * 0.6), '#e8e8f0', 0.85 * (1 - k));
  }
  g.restore();
}

export default {
  id: 'ninja',
  palette: GREEN,
  hideInCut: true,
  // During the cut-in, over the dark: the five circling over him.
  cutin(g, s) {
    orbit(g, s, s.fx, s.fy, s.now, () => false);
  },
  // After release: the balls still circling, the streaks already fired, the green one on the ball.
  draw(g, b, s) {
    const pw = s.pw, vt = volleyT(pw), dir = pw.dir || 1;
    const S = C.POWER_SHOT_SPEED * (pw.spd || 1.1);
    orbit(g, s, s.fx, s.fy, s.now, (i) => i * NINJA.GAP <= vt);
    for (let i = 0; i < 5; i++) {
      const tf = vt - i * NINJA.GAP;
      if (tf < 0 || i === pw.slot) continue;
      const T = ninjaTarget(pw, i);
      const dx = T.x - s.fx, dy = T.y - s.fy, d = Math.hypot(dx, dy) || 1;
      const run = S * tf;
      if (run > d + 260) continue;                              // gone into the goal
      const hx = s.fx + (dx / d) * Math.min(run, d + 40), hy = s.fy + (dy / d) * Math.min(run, d + 40);
      streak(g, hx, hy, dx / d, dy / d, Math.min(240, run), BLUE, 0.9, run > d ? Math.max(0, 1 - (run - d) / 260) : 1);
    }
    if (pw.ph === 'nwait') return true;
    const v = Math.hypot(b.vx, b.vy) || 1;
    streak(g, s.x, s.y, b.vx / v || dir, b.vy / v, Math.min(250, S * pw.t + 10), GREEN, 1.1, 1);
    return false;
  },
  // Over the heads: the log where he stands, for as long as the volley lasts.
  over(g, s) {
    const pw = s.pw;
    if (!logLeft(pw)) return;
    const vt = volleyT(pw), end = 4 * NINJA.GAP + 0.45;
    drawLog(g, s.px, s.pfy, s.pr, 1, pw.dir || 1);
    // smoke as he swaps into it (the touch) and back out of it
    const k0 = s.sinceTouch / 0.4;
    if (k0 < 1) smoke(g, s.px, s.pfy - s.pr * 1.6, s.pr, k0);
    const k1 = (vt - (end - 0.25)) / 0.25;
    if (k1 > 0 && k1 < 1) smoke(g, s.px, s.pfy - s.pr * 1.6, s.pr, 1 - k1);
  },
  armed(g, p, s) {
    g.save();
    for (let i = 0; i < 3; i++) {
      const a = s.t * 3 + (i / 3) * TAU;
      puff(g, s.fx + Math.cos(a) * 22, s.fy - 6 + Math.sin(a) * 4, 12, '#d8d8e4', 0.45);
    }
    g.restore();
  },
};

export { logLeft };
