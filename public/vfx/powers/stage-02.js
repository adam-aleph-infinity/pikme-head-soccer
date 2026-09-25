// STAGE 2 — CAMEROON'S THUNDERBOLT SHOT.
//
// Wiki (Cameroon): "the ball is covered in lightning, and it shoots straight across the field";
// the one it hits "turns blue and is surrounded in electricity and is stunned, unable to jump or
// move fast" (the shock ailment — public/vfx/ailments.js). Not in our footage, so it is painted in
// the filmed effects' own language (fx-kit.js): the comet's anatomy — a white-hot nose on the
// ball, streaky body behind — in electric yellow; the ball wrapped in a crackling sphere of light
// with bolts crawling over it; three long forked bolts whipping back along the trail; sparks
// shed behind. Bolts are painted, bloomed flipbook frames re-picked at 30 Hz (the same crackle
// rate as HS's armed licks), never re-rolled geometry.
// Armed: Head Soccer's own yellow flame licks (fx-kit drawArmedGlow) — the same for everyone.

import { beam, bolts, boltBlit, glow, spark, blit, rng, auraTex, TAU } from '../fx-kit.js';
import { cometAlpha } from '../families.js';

const TRAIL = () => beam('thunder', { L: 430, H: 124, mid: '#ffe23a', edge: '#ff8a00', core: 0.16, fan: 1.6, streak: 0.95, head: 0.22 });
const BOLTS = () => bolts('#ffe23a', '#fffef4', 10, 21);
const NOSE = 30;

export default {
  id: 'thunderbolt',
  palette: ['#fffbe0', '#ffe23a', '#5fb0ff'],
  warm() { TRAIL(); BOLTS(); glow('#ffe86a', 0.3); glow('#5aa8ff', 0.1); spark('#ffe23a'); bolts('#7cc4ff', '#ffffff', 8, 33); auraTex('#3f9bff'); },
  draw(g, b, s) {
    const dir = s.pw.dir || 1, x = s.x, y = s.y;
    const v = Math.hypot(b.vx, b.vy);
    const ux = v > 1 ? b.vx / v : dir, uy = v > 1 ? b.vy / v : 0, px = -uy, py = ux;
    const k = cometAlpha(s.t), fr = Math.floor(s.now * 30), R = rng(fr * 977 + 3);
    const rot = Math.atan2(uy, ux);
    // the electric comet behind the ball
    const tr = TRAIL();
    blit(g, tr[fr & 1], x, y, 430, 124 * (0.65 + 0.35 * k), rot, 0.5 + 0.35 * k, true, (430 - NOSE) / 430, 0.5);
    // a cold blue haze round it all (the "turns blue" electricity)
    blit(g, glow('#5aa8ff', 0.1), x - ux * 40, y - uy * 40, 190, 150, rot, 0.35, true);
    // three forked bolts whipping back along the trail
    const bk = BOLTS();
    for (let i = 0; i < 3; i++) {
      const L = 150 + R() * 150, o0 = (R() - 0.5) * 16, o1 = (i - 1) * 26 + (R() - 0.5) * 26;
      boltBlit(g, bk, x + px * o0, y + py * o0, x - ux * L + px * o1, y - uy * L + py * o1, 40 + R() * 16, 1, R());
    }
    // the sphere of light the ball sits in, and bolts crawling over it
    blit(g, glow('#ffe86a', 0.3), x, y, 130, 130, 0, 1, true);
    for (let i = 0; i < 6; i++) {
      const a = R() * TAU, l = 30 + R() * 28, a2 = a + (R() - 0.5) * 1.6;
      boltBlit(g, bk, x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a2) * l, y + Math.sin(a2) * l, 30, 1, R());
    }
    // sparks shed behind
    const sp = spark('#ffe23a');
    for (let i = 0; i < 4; i++) {
      const d = 30 + R() * 160, o = (R() - 0.5) * 70;
      blit(g, sp, x - ux * d + px * o, y - uy * d + py * o, 20 + R() * 16, 6, rot + (R() - 0.5) * 0.8, 0.8, true);
    }
    return false;
  },
};
