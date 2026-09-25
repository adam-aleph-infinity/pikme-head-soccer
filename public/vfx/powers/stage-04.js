// STAGE 4 — USA'S ILLUSION SHOT.
//
// Wiki (USA): "The ball multiplies into eight balls, which all aim for the goal. 7/8 balls are
// fake, but after the shot has travelled a small distance, there will only be one ball left that
// is real. For a short time after the shot, the ball becomes invisible to the opponent and
// translucent to whoever uses the shot." Power_Shot_Guide: it "travels slightly downward", "you
// can see it when the ball bounces", and close in it goes "through your opponent".
// Not in our footage, so painted at the filmed effects' quality (fx-kit.js): eight identical balls
// fanning out toward the goal, each at the nose of a slim painted streak of white-blue light (the
// comet's anatomy, fx-kit beam) with a soft glow on it; after ≈ 260 px seven POP — a white flash,
// a soft shockwave ring and a burst of sparkles where each was; the real one fades out — a faint
// refracted shimmer for the defender, a ghost of itself for the shooter — and flashes back into
// sight, with a puff of light, each time it bounces.
// Armed: Head Soccer's own yellow flame licks (fx-kit drawArmedGlow) — the same for everyone.

import { beam, glow, ring, spark, smoke, blit, rng, TAU } from '../fx-kit.js';
import { ball } from './common.js';
import { ILLUSION } from '../../../shared/champion-powers/stage-04.js';
import * as C from '../../../shared/constants.js';

const SLOPES = [-0.46, -0.31, -0.17, -0.05, 0.2, 0.34, 0.5];        // the seven fakes (vy / vx)
const COLS = ['#ffffff', '#cfe6ff', '#6fa8ff'];
const STREAK = () => beam('illusion', { L: 220, H: 46, mid: '#d6ecff', edge: '#5f9dff', core: 0.22, fan: 1.35, streak: 0.8, head: 0.36 });
const NOSE = 10;

// a straight line from (x0, y0) at slope k, mirrored off the grass and the sky like the real one
function along(x0, y0, dir, S, k, t, r) {
  const floor = C.GROUND_Y - r, sky = C.SKY_Y + r;
  let y = y0 + k * S * t;
  for (let i = 0; i < 3; i++) { if (y > floor) y = 2 * floor - y; else if (y < sky) y = 2 * sky - y; }
  return { x: x0 + dir * S * t, y };
}
// one ball of the eight in flight: its streak (as long as it has flown, ≤ 220 px) and a glow
function flier(g, s, x, y, ux, uy, run, fr) {
  const L = Math.min(220, run + 20);
  blit(g, STREAK()[fr & 1], x, y, L, 34, Math.atan2(uy, ux), 0.55, true, (L - NOSE) / L, 0.5);
  blit(g, glow('#bfe0ff', 0.3), x, y, 40, 40, 0, 0.45, true);
  ball(g, s, x, y, 1);
}
// the pop: a flash, a puff of white smoke, a faint ring going out, sparkles thrown off
const POP = 0.16;
function pop(g, x, y, tp, seed) {
  const f = tp / POP, R = rng(seed);
  if (f >= 1) return;
  blit(g, glow('#ffffff', 0.5), x, y, 64 * (0.7 + f), 64 * (0.7 + f), 0, 1 - f, true);
  blit(g, smoke(seed, '#f2f6ff'), x, y, 34 + f * 30, 34 + f * 30, seed + f, (1 - f) * 0.85, false);
  blit(g, ring('#cfe6ff'), x, y, 26 + f * 56, 26 + f * 56, 0, (1 - f) * (1 - f) * 0.45, true);
  const sp = spark('#dcefff');
  for (let i = 0; i < 6; i++) {
    const a = R() * TAU, d = 8 + f * (40 + R() * 30);
    blit(g, sp, x + Math.cos(a) * d, y + Math.sin(a) * d, 18 * (1 - f * 0.5), 6, a, (1 - f), true, 1, 0.5);
  }
}

export default {
  id: 'illusion',
  palette: COLS,
  warm() { STREAK(); glow('#bfe0ff', 0.3); glow('#ffffff', 0.5); ring('#cfe6ff'); spark('#dcefff'); smoke(0, '#f2f6ff'); },
  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, S = Math.abs(pw.vx0) || C.POWER_SHOT_SPEED, t = s.t;
    const v = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / v || dir, uy = b.vy / v || 0;
    const fr = Math.floor(s.now * 30);
    // 1. the eight: the seven fakes beside the real one, all alike
    if (t < ILLUSION.FAKES) {
      for (const k of SLOPES) {
        const q = along(s.fx, s.fy, dir, S, k, t, s.r), d = Math.hypot(1, k);
        flier(g, s, q.x, q.y, dir / d, k / d, S * t * d, fr);
      }
      flier(g, s, s.x, s.y, ux, uy, S * t, fr);
      return true;                                               // (drawn with the others)
    }
    // 2. seven pop where each one was
    const tp = t - ILLUSION.FAKES;
    if (tp < POP) SLOPES.forEach((k, i) => { const q = along(s.fx, s.fy, dir, S, k, ILLUSION.FAKES, s.r); pop(g, q.x, q.y, tp, 50 + i * 7); });
    // 3. invisible: to the defender a faint refracted shimmer, to the shooter a ghost — but a
    //    bounce shows it
    if (pw.inv || tp < ILLUSION.INV) {
      const bounce = s.y > C.GROUND_Y - s.r - 6;
      const mine = s.me === pw.owner;
      if (bounce) {
        blit(g, glow('#ffffff', 0.5), s.x, s.y, 60, 60, 0, 0.9, true);
        blit(g, smoke(fr, '#f2f6ff'), s.x, C.GROUND_Y - 6, 50, 26, 0, 0.6, false);
        ball(g, s, s.x, s.y, 1);
        return true;
      }
      const sh = 0.5 + 0.5 * Math.sin(s.now * 38);
      blit(g, ring('#e8f4ff'), s.x + Math.sin(s.now * 40) * 1.5, s.y, s.r * 3.2, s.r * 3.2, 0, mine ? 0.35 : 0.12 + 0.1 * sh, true);
      blit(g, STREAK()[fr & 1], s.x, s.y, 120, 30, Math.atan2(uy, ux), mine ? 0.3 : 0.08, true, (120 - NOSE) / 120, 0.5);
      ball(g, s, s.x, s.y, mine ? 0.35 : 0.08);
      return true;
    }
    // 4. back in sight: the plain ball with its pale streak
    blit(g, STREAK()[fr & 1], s.x, s.y, 150, 40, Math.atan2(uy, ux), 0.75, true, (150 - NOSE) / 150, 0.5);
    return false;
  },
};
