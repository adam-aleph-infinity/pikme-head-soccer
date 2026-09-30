// STAGE 5 — JAPAN'S NINJA SHOT.
//
// Wiki (Japan): "When activated and when Japan touches the ball, he turns into a log"; he "rises
// into the air surrounded by five soccer balls", then "a few streaks of blue light (the fake
// 'balls') will shoot downwards towards the goal with one green streak containing the ball".
// Power_Shot_Guide: the order is always middle, very low, the highest, a little lower, middle; the
// green one is "always in a random place"; "the blue balls are all completely fake".
// Not in our footage, so painted at the filmed effects' quality (fx-kit.js): from the touch the
// shooter is a LOG (a painted, lit cylinder of bark with a ringed cut top), swapped in and out
// with a burst of billowing white ninja smoke; five balls circle in a cold blue glow over where he
// stood; then, one every 0.13 s, STREAKS OF BLUE LIGHT — the comet's anatomy (fx-kit beam), slim,
// white-hot nosed, streaky — shoot down at the goal at those five heights; the one that carries
// the ball is green, the ball at its nose.
// Armed: Head Soccer's own yellow glow and wisps (fx-kit drawArmedGlow) — the same for everyone.

import { beam, glow, smoke, blit, tex, pix, noise2, fbm, sstep, mix, clamp01, TAU } from '../fx-kit.js';
import { ball } from './common.js';
import { NINJA, ninjaTarget } from '../../../shared/champion-powers/stage-05.js';
import * as C from '../../../shared/constants.js';

const BLUE = ['#e6f6ff', '#5cb8ff', '#1f6bff'];
const GREEN = ['#eaffe6', '#52e07a', '#12a04a'];
const ORBIT = 38;
const BLUE_BEAM = () => beam('ninja-blue', { L: 260, H: 40, mid: '#6cc8ff', edge: '#1c56ff', core: 0.26, fan: 1.4, streak: 0.85, head: 0.34 });
const GREEN_BEAM = () => beam('ninja-green', { L: 280, H: 50, mid: '#78ffa4', edge: '#0c9a44', core: 0.3, fan: 1.45, streak: 0.85, head: 0.34 });

// seconds into the volley (0 = the ball has just left the cut-in)
const volleyT = (pw) => (pw.ph === 'nwait' ? pw.k : pw.slot * NINJA.GAP + pw.t);
const logLeft = (pw) => pw.cp === 'ninja' && !pw.rb && (pw.ph === 'nwait' || volleyT(pw) < 4 * NINJA.GAP + 0.45);

// the five circling over the spot he rose from; `fired(i)` says which have gone
function orbit(g, s, ox, oy, now, fired) {
  blit(g, glow('#4aa8ff', 0.1), ox, oy, (ORBIT + 30) * 2.4, (ORBIT + 30) * 2.1, 0, 0.55, true);
  for (let i = 0; i < 5; i++) {
    if (fired(i)) continue;
    const a = now * 7 + (i / 5) * TAU;
    const x = ox + Math.cos(a) * ORBIT, y = oy + Math.sin(a) * ORBIT * 0.8;
    blit(g, glow('#8fd4ff', 0.3), x, y, 44, 44, 0, 0.7, true);
    ball(g, s, x, y, 1);
  }
}

// THE LOG: a painted cylinder of bark — lit from the left, vertical grain and cracks, two knots,
// a stub of a branch — with a pale ringed cut top. 2.5 head radii wide, 3.2 tall.
const logTex = () => tex('ninja-log', 120, 150, (g, w, h) => {
  const nz = noise2(77, 64);
  const topH = 16;                                               // the cut top's ellipse, texels
  pix(g, w, h, (x, y, o) => {
    const u = (x + 0.5) / w * 2 - 1;                              // −1 left … 1 right
    const cy = topH / 2 + 1;
    // the cut top: an ellipse of pale wood with rings
    const ey = (y + 0.5 - cy) / (topH / 2), er = Math.hypot(u / 0.96, ey);
    if (er <= 1) {
      const ring = 0.5 + 0.5 * Math.sin(er * 16 + fbm(nz, x / 6, y / 6, 2) * 3);
      const k = clamp01(0.75 + 0.15 * ring - 0.25 * er);
      o[0] = mix(150, 238, k); o[1] = mix(100, 190, k); o[2] = mix(52, 128, k);
      o[3] = er > 0.9 ? 1 : 1; if (er > 0.9) { o[0] *= 0.55; o[1] *= 0.5; o[2] *= 0.45; }
      return;
    }
    if (y + 0.5 < cy) return;
    // the body, down to a rounded foot
    const footY = h - 5 - 4 * Math.sqrt(Math.max(0, 1 - u * u));
    if (Math.abs(u) > 0.96 || y + 0.5 > footY) return;
    const shade = 0.35 + 0.65 * Math.pow(Math.max(0, Math.cos((u + 0.35) * 1.25)), 1.3);
    const grain = fbm(nz, x / 2.2, y / 16, 4), crack = sstep(0.72, 0.8, fbm(nz, x / 1.4 + 20, y / 26, 3));
    const knot = Math.max(Math.exp(-(((x - w * 0.34) / 5) ** 2 + ((y - h * 0.48) / 7) ** 2)), Math.exp(-(((x - w * 0.66) / 4) ** 2 + ((y - h * 0.76) / 5) ** 2)));
    let k = shade * (0.75 + 0.45 * grain) * (1 - 0.55 * crack) * (1 - 0.45 * knot);
    const rim = sstep(0.82, 0.96, Math.abs(u));
    k *= 1 - 0.55 * rim;
    o[0] = mix(46, 176, k); o[1] = mix(26, 112, k); o[2] = mix(10, 54, k); o[3] = 1;
  });
});
export function drawLog(g, x, fy, r, a = 1, dir = 1) {
  const w = r * 2.5, h = r * 3.2;                               // wide enough to hide the head it replaces
  blit(g, logTex(), x, fy, w * 1.02, h, 0, a, false, 0.5, 0.97);
  // the branch stub
  g.save(); g.globalAlpha = a; g.fillStyle = '#6e4420';
  g.beginPath(); g.ellipse(x + dir * w * 0.52, fy - h * 0.55, w * 0.16, w * 0.1, -0.4 * dir, 0, TAU); g.fill();
  g.fillStyle = '#c89a5c'; g.beginPath(); g.ellipse(x + dir * w * 0.6, fy - h * 0.56, w * 0.07, w * 0.08, -0.4 * dir, 0, TAU); g.fill();
  g.restore();
}
// THE POOF: billowing white ninja smoke, bursting out and thinning (k 0 → 1)
function poof(g, x, y, r, k) {
  const a = 1 - k;
  blit(g, glow('#ffffff', 0.4), x, y, r * 3.5, r * 3.5, 0, 0.5 * a, true);
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * TAU + 0.6, d = r * (0.45 + 1.3 * k), S = r * (1.9 + 1.5 * k) * (0.8 + 0.2 * (i % 3));
    blit(g, smoke(i, '#f4f5fa'), x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8, S, S, an + k * 2, 0.95 * a * (0.7 + 0.3 * (i % 2)), false);
  }
}

export default {
  id: 'ninja',
  palette: GREEN,
  hideInCut: true,
  warm() { BLUE_BEAM(); GREEN_BEAM(); logTex(); glow('#4aa8ff', 0.1); glow('#8fd4ff', 0.3); glow('#ffffff', 0.4); for (let i = 0; i < 4; i++) smoke(i, '#f4f5fa'); },
  // During the cut-in, over the dark: the five circling over him.
  cutin(g, s) {
    orbit(g, s, s.fx, s.fy, s.now, () => false);
  },
  // After release: the balls still circling, the streaks already fired, the green one on the ball.
  draw(g, b, s) {
    const pw = s.pw, vt = volleyT(pw), dir = pw.dir || 1;
    const S = C.POWER_SHOT_SPEED * (pw.spd || 1.1), fr = Math.floor(s.now * 30);
    orbit(g, s, s.fx, s.fy, s.now, (i) => i * NINJA.GAP <= vt);
    for (let i = 0; i < 5; i++) {
      const tf = vt - i * NINJA.GAP;
      if (tf < 0 || i === pw.slot) continue;
      const T = ninjaTarget(pw, i);
      const dx = T.x - s.fx, dy = T.y - s.fy, d = Math.hypot(dx, dy) || 1;
      const run = S * tf;
      if (run > d + 260) continue;                              // gone into the goal
      const hx = s.fx + (dx / d) * Math.min(run, d + 40), hy = s.fy + (dy / d) * Math.min(run, d + 40);
      const L = Math.min(260, run + 30), a = run > d ? Math.max(0, 1 - (run - d) / 260) : 1;
      blit(g, BLUE_BEAM()[(fr + i) & 1], hx, hy, L, 40, Math.atan2(dy, dx), a, true, (L - 12) / L, 0.5);
    }
    if (pw.ph === 'nwait') return true;
    const v = Math.hypot(b.vx, b.vy) || 1, L = Math.min(280, S * pw.t + 40);
    blit(g, GREEN_BEAM()[fr & 1], s.x, s.y, L, 50, Math.atan2(b.vy / v, b.vx / v || dir), 1, true, (L - 14) / L, 0.5);
    blit(g, glow('#8dffb0', 0.3), s.x, s.y, 50, 50, 0, 0.6, true);
    return false;
  },
  // Over the heads: the log where he stands, for as long as the volley lasts.
  over(g, s) {
    const pw = s.pw;
    if (!logLeft(pw)) return;
    const vt = volleyT(pw), end = 4 * NINJA.GAP + 0.45;
    drawLog(g, s.px, s.pfy, s.pr, 1, pw.dir || 1);
    // smoke as he swaps into it (the touch) and back out of it
    const k0 = s.sinceTouch / 0.45;
    if (k0 < 1) poof(g, s.px, s.pfy - s.pr * 1.6, s.pr, k0);
    const k1 = (vt - (end - 0.3)) / 0.3;
    if (k1 > 0 && k1 < 1) poof(g, s.px, s.pfy - s.pr * 1.6, s.pr, 1 - k1);
  },
};

export { logLeft };
