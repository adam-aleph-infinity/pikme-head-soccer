// STAGE 2 — CAMEROON'S THUNDERBOLT SHOT.
//
// Wiki (Cameroon): "the ball is covered in lightning, and it shoots straight across the field"; the
// one it hits "turns blue and is surrounded in electricity and is stunned, unable to jump or move
// fast" (the shock ailment — public/vfx/ailments.js). Not in our own footage; read off the wiki's
// GIFs frame by frame (QqqGYR.gif, the whole shot; Electrocution_Cameroon.gif, the power ball's own
// sprite; docs/HS-FIRST-3-POWERS.md §1.2):
//   • NO COMET. Nothing trails the ball but lightning;
//   • the ball sits in a crackling WHITE SHELL of short jagged wisps, lavender-tinted, with a DARK
//     soft halo round it — ≈ 3 ball widths (≈ 100 px) across;
//   • TWO LONG BOLTS reach it from OFF THE SCREEN BEHIND it — one from high behind (the top corner
//     on the shooter's side), one from low behind (below the pitch, trailing ≈ 330 px back) — thin
//     white cores in a violet-lavender glow, 500–900 px long, RE-JAGGED EVERY FRAME, on the ball all
//     the way into the goal;
//   • no sparks, no haze, and not a trace of yellow: every warm colour on screen is the cut-in's.
// The shell is a painted 8-frame flipbook (fx-kit); the long bolts are drawn fresh each frame as
// jagged polylines (seeded by the frame, so a replay draws the same lightning) in three additive
// passes — a wide violet glow, a lavender body, a white core — with a few short forks.
// Armed: Head Soccer's own yellow glow and wisps (fx-kit drawArmedGlow) — the same for everyone.

import { book, tex, pix, blit, glow, rng, sstep, TAU } from '../fx-kit.js';
import * as C from '../../../shared/constants.js';

export const THUNDER = {
  ORB: 116,            // world px across the shell (≈ 3 ball widths; a touch wider than tall)
  HALO: 150,           // world px across its dark halo
  CORE: '#ffffff', BODY: '#dcd2ff', GLOW: '#9a82ff',
  TOP: -120,           // world y the high bolt comes from (off the top of the screen)
  LOW: 640,            // …and the low one (off the bottom)
  LAG: 330,            // px the low bolt's far end trails the ball
  HZ: 30,              // re-jagged this often
};

// The shell: jagged white wisps looping round the ball, lavender bloom — 8 variants.
const shell = () => book('thunder-shell', 8, 160, 160, (g, w, h, k) => {
  const R = rng(4111 + k * 97), c = w / 2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    // a wisp: a jagged arc round the ball at 0.55–0.95 of the shell's radius
    const a0 = R() * TAU, span = 1.1 + R() * 1.8, r0 = (0.2 + R() * 0.28) * w, pts = [];
    for (let j = 0; j <= 9; j++) {
      const a = a0 + (span * j) / 9, rr = r0 * (0.86 + 0.28 * R());
      pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr * 0.92]);
    }
    for (const [lw, col, al] of [[12, THUNDER.GLOW, 0.2], [6, THUNDER.BODY, 0.5], [2.6, THUNDER.CORE, 0.95]]) {
      g.strokeStyle = col; g.globalAlpha = al; g.lineWidth = lw;
      g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
  }
  g.restore();
});
// Its dark soft halo (drawn normally, under the light): the sprite's own dark rim.
const halo = () => tex('thunder-halo', 64, 64, (g, w, h) => pix(g, w, h, (x, y, o) => {
  const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
  o[0] = 26; o[1] = 18; o[2] = 52; o[3] = 0.5 * sstep(0.2, 0.62, d) * (1 - sstep(0.7, 1, d));
}));
// A white-lavender light at the ball's heart.
const heart = () => glow('#e6dcff', 0.35);

// One jagged bolt from (x1, y1) to (x2, y2): midpoint displacement, `amp` px of jag at the top level.
function boltPts(R, x1, y1, x2, y2, amp, levels = 6) {
  let pts = [[x1, y1], [x2, y2]];
  for (let l = 0; l < levels; l++, amp *= 0.55) {
    const nx = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const o = (R() - 0.5) * 2 * amp;
      nx.push(pts[i], [(ax + bx) / 2 - (dy / len) * o, (ay + by) / 2 + (dx / len) * o]);
    }
    nx.push(pts[pts.length - 1]);
    pts = nx;
  }
  return pts;
}
function strokeBolt(g, pts, a, scale = 1) {
  for (const [lw, col, al] of [[24, THUNDER.GLOW, 0.18], [9, THUNDER.BODY, 0.45], [3.6, THUNDER.CORE, 1]]) {
    g.strokeStyle = col; g.globalAlpha = al * a; g.lineWidth = lw * scale;
    g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
}
// A bolt with a couple of short forks off it.
function drawBolt(g, R, x1, y1, x2, y2, a) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const pts = boltPts(R, x1, y1, x2, y2, Math.min(90, len * 0.12), 5);
  strokeBolt(g, pts, a);
  for (let f = 0; f < 2; f++) {
    const i = Math.floor(pts.length * (0.25 + R() * 0.5)), [fx, fy] = pts[i];
    const ang = Math.atan2(y2 - y1, x2 - x1) + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), fl = 40 + R() * 70;
    strokeBolt(g, boltPts(R, fx, fy, fx + Math.cos(ang) * fl, fy + Math.sin(ang) * fl, fl * 0.25, 3), a * 0.7, 0.6);
  }
}

// The whole shot's light round the ball at (x, y), flying `dir`, at time `now`.
export function drawThunder(g, x, y, dir, now, a = 1) {
  const fr = Math.floor(now * THUNDER.HZ), R = rng(fr * 7919 + 13);
  // the halo darkens first (normal blend), then everything else adds light
  blit(g, halo(), x, y, THUNDER.HALO, THUNDER.HALO, 0, 0.9 * a, false);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the two long bolts from off the screen behind it
  const backX = dir > 0 ? -60 : C.W + 60;
  drawBolt(g, R, backX, THUNDER.TOP + (R() - 0.5) * 80, x - dir * 8, y - 6, a);
  drawBolt(g, R, x - dir * (THUNDER.LAG + (R() - 0.5) * 60), THUNDER.LOW, x - dir * 6, y + 8, a);
  g.restore();
  // the crackling shell and the light at its heart
  blit(g, heart(), x, y, 112, 92, 0, a, true);
  blit(g, heart(), x, y, 70, 58, 0, 0.8 * a, true);
  blit(g, shell()[fr & 7], x, y, THUNDER.ORB * 1.12, THUNDER.ORB * 0.9, (fr % 2) * 0.3, a, true);
}

export default {
  id: 'thunderbolt',
  palette: ['#ffffff', '#dcd2ff', '#9a82ff'],
  warm() { shell(); halo(); heart(); glow('#9a82ff', 0.1); },
  draw(g, b, s) {
    drawThunder(g, s.x, s.y, s.pw.dir || 1, s.now);
    return false;
  },
  // …and the ball is INSIDE the crackle, not on top of it (Electrocution_Cameroon.gif: its panels
  // show through the white): a veil of the shell over the ball, above everything.
  over(g, s) {
    if (s.pw.ph !== 'fly' || s.x == null) return;
    const fr = Math.floor(s.now * THUNDER.HZ);
    blit(g, heart(), s.x, s.y, s.r * 3, s.r * 2.6, 0, 0.42, true);
    blit(g, shell()[(fr + 3) & 7], s.x, s.y, s.r * 3.4, s.r * 2.9, 0.8, 0.55, true);
  },
};
