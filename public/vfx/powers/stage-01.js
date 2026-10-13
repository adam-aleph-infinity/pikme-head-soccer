// BROADSIDE, drawn — the Cannoneer's power (what it does: shared/champion-powers/stage-01.js).
// The champion is a pirate-parrot captain (a round red head, a black tricorn with a gold star coin,
// an eye patch, one scowling eye, an ivory-and-black beak, blue and yellow tail feathers); the card,
// Shoval's backyard ship hut with nautical flags, gold coins and bubbles. Our own art, painted in
// the fx-kit's way: cached sprites and soft additive light.
//
//   the press     THE PARROT TURNS INTO HIS CANNON (`head`, worn from the press to the last shot —
//                 champ-vfx wornHead): his own face squashes, a glint on the star coin; he flips half
//                 a turn in a burst of feathers, smoke and bubbles and comes round as the cannon —
//                 his red head the breech, his beak the muzzle's lip, the hat, the patch and the eye
//                 kept, the tail a plume — the barrel sliding out, two gold bands clamping on; he
//                 settles with a bounce, a "ka-chunk" puff from the muzzle, and the fuse lights.
//   the cut-in    his own loading move instead of the shared wind-up's nod: the barrel tips up, the
//                 ball drops into the muzzle (gone from sight till shot 3), and it comes down level
//                 for the first shot (Idan: no face-down-then-up)
//   the barrage   each shot: recoil, a muzzle flash that lights the barrel and the grass, a smoke
//                 ring, feathers and coins; the fuse burns down between them (the timing cue)
//   the shells    iron cannonballs, white-hot on the nose, a fire comet and a smoke trail (no shadow,
//                 like the ball); a hit — a boom of smoke and iron; a parry — a clang of sparks, the
//                 shell batted up and away; on the goal line — a puff of smoke
//   the ball      out of the same flash looking just like a shell; a beat later its iron skin bursts
//                 off in shards and the real ball flies on in a gold comet
//   after         he flips back into the parrot in a pop of smoke and feathers, and ruffles
//   kick-blocked  the blocker fires the same barrage back — shells, sizes, flashes, the reveal —
//                 with no cannon: its charge builds in the air in front of his head
// Client only: Math.random is fine here — nothing drawn feeds back into the sim.

import { TAU, hash, streak } from './common.js';
import { blit, glow, smoke, spark, bubble, tex } from '../fx-kit.js';
// (the engine first: the stage file is part of its registry's import cycle)
import '../../../shared/hs-powers.js';
import { BROADSIDE } from '../../../shared/champion-powers/stage-01.js';
import * as C from '../../../shared/constants.js';

const IRON = { hi: '#8e97aa', mid: '#3a404c', dark: '#14171d' };
const FEATHERS = ['#e0282e', '#2f7ae0', '#ffcc33'];
const INK = '#1b1418';                                   // the art's keyline
const HEAD_IN = 0.55, HEAD_OUT = 0.42;                   // s: parrot → cannon, cannon → parrot
const REVEAL = 0.09;                                     // s out of the muzzle before the ball sheds its iron
const BACK_AFTER = 0.3;
// EVERY SHOT BIGGER THAN THE ONE BEFORE (Idan): the shell, its fire and smoke, the blast and the
// recoil, by shot number — the drawing only (the sim's shells and the ball keep their size)
const SIZE = [1, 1, 1.3, 1.65];
const sizeOf = (n) => SIZE[Math.max(1, Math.min(3, n | 0))];
// THE LOADING MOVE (s into the cut-in → radians tipped back, barrel up): up to take the ball, held
// while it drops in, then down level — a touch past it and back — well before the release (1.27 s)
function loadTilt(c) {
  if (c < 0.18) { const u = c / 0.18; return 0.6 * u * (2 - u); }
  if (c < 0.72) return 0.6;
  if (c < 1.02) { const u = (c - 0.72) / 0.3, e = u * u * (3 - 2 * u); return 0.6 * (1 - e) - 0.07 * Math.sin(Math.PI * e); }
  return 0;
}                                  // s after the ball leaves before he flips back
const K = 3.5;                                           // sprite texels per world px
const BIG = 1.15;                                        // the cannon against the head radius: as big as his drawn head

// ── the parrot cannon, painted once (r-units: one head radius = 1) ───────────────────────────
// The body: the breech (his round red head), the hat, the patch and the eye, the tail as a plume.
const BODY = { x0: -1.62, x1: 1.3, y0: -1.62, y1: 1.08 };
// The barrel, from its root at the front of the breech, along +x: iron, two gold bands, the beak's
// ivory and black round the mouth and its hook over the bore.
// (its mouth, sized up by BIG about the chin, lands on the sim's MUZZLE_X/_Y — where every shot leaves)
const BARREL = { x0: -0.08, x1: 1.76, y0: -0.62, y1: 0.62, rx: 0.5, ry: -0.02, rot: -0.12, len: 1.5 };

function paintBody(g, U) {
  g.scale(U, U); g.translate(-BODY.x0, -BODY.y0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the tail plume: blue, yellow, blue, fanned back from the knob at the breech
  for (const [col, a, L] of [['#2f7ae0', 2.62, 0.78], ['#ffcc33', 3.0, 0.86], ['#2f7ae0', 3.42, 0.74]]) {
    g.save(); g.translate(-0.98, 0.05); g.rotate(a);
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 0.06;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.45, -0.2, L, 0); g.quadraticCurveTo(L * 0.45, 0.2, 0, 0); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.03;
    g.beginPath(); g.moveTo(0.05, 0); g.lineTo(L * 0.85, 0); g.stroke();
    g.restore();
  }
  // the cascabel: an iron knob on a neck at the back
  g.fillStyle = '#2a2e38'; g.strokeStyle = INK; g.lineWidth = 0.06;
  g.beginPath(); g.ellipse(-0.98, 0.06, 0.13, 0.2, 0, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.arc(-1.14, 0.06, 0.13, 0, TAU); g.fill(); g.stroke();
  // the breech: his red head, lit from the upper left
  const rg = g.createRadialGradient(-0.35, -0.4, 0.05, -0.05, 0.05, 1.08);
  rg.addColorStop(0, '#ff6b5c'); rg.addColorStop(0.45, '#e0282e'); rg.addColorStop(1, '#8e161b');
  g.fillStyle = rg; g.strokeStyle = INK; g.lineWidth = 0.075;
  g.beginPath(); g.ellipse(0, 0.06, 1.0, 0.92, 0, 0, TAU); g.fill(); g.stroke();
  // his feather scallops, low on the head as on the art
  g.strokeStyle = '#a01c22'; g.lineWidth = 0.05;
  for (const [x, y] of [[-0.62, 0.38], [-0.3, 0.6], [0.06, 0.66], [0.42, 0.56], [-0.78, 0.0]]) { g.beginPath(); g.arc(x, y, 0.16, 0.2, Math.PI - 0.2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath(); g.ellipse(-0.42, -0.42, 0.3, 0.13, -0.55, 0, TAU); g.fill();
  // the eye patch on its strap
  g.strokeStyle = INK; g.lineWidth = 0.09;
  g.beginPath(); g.moveTo(-0.96, -0.3); g.quadraticCurveTo(-0.3, -0.5, 0.55, -0.66); g.stroke();
  g.fillStyle = INK;
  g.beginPath(); g.ellipse(-0.32, -0.16, 0.27, 0.23, -0.25, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-0.4, -0.24, 0.1, 0.05, -0.4, 0, TAU); g.fill();
  // the one eye, scowling under a heavy brow, a blush under it
  g.fillStyle = '#f7f1e6'; g.strokeStyle = INK; g.lineWidth = 0.05;
  g.beginPath(); g.ellipse(0.4, -0.14, 0.24, 0.19, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#5d6470'; g.beginPath(); g.arc(0.47, -0.13, 0.12, 0, TAU); g.fill();
  g.fillStyle = '#0d0d10'; g.beginPath(); g.arc(0.49, -0.13, 0.065, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.44, -0.18, 0.035, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.11;
  g.beginPath(); g.moveTo(0.12, -0.42); g.lineTo(0.7, -0.27); g.stroke();
  g.strokeStyle = '#f29a9a'; g.lineWidth = 0.035;
  for (const y of [0.12, 0.18]) { g.beginPath(); g.moveTo(0.22, y); g.lineTo(0.5, y); g.stroke(); }
  // the tricorn: the crown, then the brim curling up at both ends, gold-trimmed
  const hg = g.createLinearGradient(0, -1.5, 0, -0.6);
  hg.addColorStop(0, '#3a3848'); hg.addColorStop(1, '#141319');
  g.fillStyle = hg; g.strokeStyle = INK; g.lineWidth = 0.07;
  g.beginPath(); g.moveTo(-0.66, -0.74); g.bezierCurveTo(-0.62, -1.5, 0.62, -1.52, 0.7, -0.76); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-1.22, -1.02); g.quadraticCurveTo(-0.85, -0.6, 0, -0.62); g.quadraticCurveTo(0.9, -0.64, 1.26, -1.06);
  g.quadraticCurveTo(0.95, -0.86, 0, -0.86); g.quadraticCurveTo(-0.9, -0.84, -1.22, -1.02); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#e8b23a'; g.lineWidth = 0.045;
  g.beginPath(); g.moveTo(-1.1, -0.95); g.quadraticCurveTo(-0.8, -0.68, 0, -0.69); g.quadraticCurveTo(0.85, -0.7, 1.14, -0.98); g.stroke();
  // the star coin on the crown
  const cg = g.createRadialGradient(-0.04, -1.16, 0.02, 0.02, -1.1, 0.2);
  cg.addColorStop(0, '#fff3a8'); cg.addColorStop(0.6, '#ffcc33'); cg.addColorStop(1, '#b8860b');
  g.fillStyle = cg; g.strokeStyle = INK; g.lineWidth = 0.05;
  g.beginPath(); g.arc(0.02, -1.1, 0.17, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#8a5f0c'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? 0.045 : 0.1; g.lineTo(0.02 + Math.cos(a) * d, -1.1 + Math.sin(a) * d); }
  g.closePath(); g.fill();
  // the touch-hole the fuse comes out of, on the back of the crown
  g.fillStyle = '#2a2e38'; g.beginPath(); g.ellipse(-0.72, -0.62, 0.1, 0.07, -0.5, 0, TAU); g.fill(); g.stroke();
}

function paintBarrel(g, U) {
  g.scale(U, U); g.translate(-BARREL.x0, -BARREL.y0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const L = BARREL.len;
  const bg = g.createLinearGradient(0, -0.46, 0, 0.46);
  bg.addColorStop(0, '#9aa3b6'); bg.addColorStop(0.28, '#4e5563'); bg.addColorStop(0.7, '#22252d'); bg.addColorStop(1, '#0c0e12');
  g.fillStyle = bg; g.strokeStyle = '#07080b'; g.lineWidth = 0.07;
  g.beginPath(); g.moveTo(0, -0.43); g.lineTo(L - 0.3, -0.35); g.quadraticCurveTo(L - 0.24, -0.47, L - 0.12, -0.47); g.lineTo(L, -0.44);
  g.lineTo(L, 0.44); g.lineTo(L - 0.12, 0.47); g.quadraticCurveTo(L - 0.24, 0.47, L - 0.3, 0.35); g.lineTo(0, 0.43); g.closePath(); g.fill(); g.stroke();
  // a long glint along the top
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath(); g.moveTo(0.06, -0.31); g.lineTo(L - 0.36, -0.25); g.lineTo(L - 0.36, -0.19); g.lineTo(0.06, -0.24); g.closePath(); g.fill();
  // the gold bands (the hat's coin)
  for (const x of [0.22, 0.86]) {
    const h = 0.47 - x * 0.045;
    const gg = g.createLinearGradient(0, -h, 0, h);
    gg.addColorStop(0, '#fff0a0'); gg.addColorStop(0.35, '#ffcc33'); gg.addColorStop(1, '#8a5f0c');
    g.fillStyle = gg; g.strokeStyle = INK; g.lineWidth = 0.05;
    g.beginPath(); g.rect(x, -h, 0.15, 2 * h); g.fill(); g.stroke();
  }
  // the muzzle's lip: his beak — ivory over, black under, and the hook bending down over the bore
  const m0 = L - 0.3;
  g.fillStyle = '#f1e6c8'; g.strokeStyle = INK; g.lineWidth = 0.06;
  g.beginPath(); g.moveTo(m0, -0.35); g.quadraticCurveTo(m0 + 0.06, -0.47, m0 + 0.18, -0.47); g.lineTo(L, -0.44); g.lineTo(L, 0); g.lineTo(m0, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2a2a30';
  g.beginPath(); g.moveTo(m0, 0); g.lineTo(L, 0); g.lineTo(L, 0.44); g.lineTo(m0 + 0.18, 0.47); g.quadraticCurveTo(m0 + 0.06, 0.47, m0, 0.35); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#d2c49c'; g.beginPath(); g.ellipse(m0 + 0.16, -0.12, 0.12, 0.05, 0, 0, TAU); g.fill();
  g.fillStyle = '#f1e6c8';
  g.beginPath(); g.moveTo(L - 0.06, -0.45); g.quadraticCurveTo(L + 0.2, -0.44, L + 0.16, -0.14); g.quadraticCurveTo(L + 0.08, -0.3, L - 0.02, -0.3); g.closePath(); g.fill(); g.stroke();
  // the bore
  g.fillStyle = '#050506'; g.beginPath(); g.ellipse(L + 0.01, 0.04, 0.07, 0.28, 0, 0, TAU); g.fill();
}
const bodyTex = (r) => tex(`bsBody${r}`, (BODY.x1 - BODY.x0) * r * K, (BODY.y1 - BODY.y0) * r * K, (g) => paintBody(g, r * K));
const barrelTex = (r) => tex(`bsBarrel${r}`, (BARREL.x1 - BARREL.x0) * r * K, (BARREL.y1 - BARREL.y0) * r * K, (g) => paintBarrel(g, r * K));

// the cannon at the origin of g (facing +x): its barrel out `ext` of the way, recoiled `rec` r
function drawCannon(g, r, ext, rec, hurt) {
  const bt = barrelTex(r);
  if (ext > 0.02) {
    g.save();
    g.translate((BARREL.rx - rec * 0.5) * r, BARREL.ry * r); g.rotate(BARREL.rot); g.scale(ext, 1);
    g.drawImage(bt, BARREL.x0 * r, BARREL.y0 * r, (BARREL.x1 - BARREL.x0) * r, (BARREL.y1 - BARREL.y0) * r);
    g.restore();
  }
  g.drawImage(bodyTex(r), (BODY.x0 - rec * 0.3) * r, BODY.y0 * r, (BODY.x1 - BODY.x0) * r, (BODY.y1 - BODY.y0) * r);
  // the dents a hit leaves (the DOM head's bruises, while it is a cannon)
  for (let i = 0; i < Math.min(4, hurt | 0); i++) {
    const [x, y] = [[-0.55, 0.3], [0.05, 0.45], [-0.15, -0.45], [0.55, 0.3]][i];
    g.fillStyle = 'rgba(60,8,12,0.55)'; g.beginPath(); g.ellipse((x - rec * 0.3) * r, y * r, 0.11 * r, 0.07 * r, 0.3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,190,180,0.45)'; g.beginPath(); g.ellipse((x - rec * 0.3 - 0.03) * r, (y - 0.04) * r, 0.07 * r, 0.03 * r, 0.3, 0, TAU); g.fill();
  }
}
// the muzzle's mouth (where every shot leaves), in head radii from the head's centre, facing +x
// (in head radii, the cannon's size up included — BIG, below)
const mouth = (ext = 1) => {
  const L = BARREL.len * ext + 0.06, c = Math.cos(BARREL.rot), s = Math.sin(BARREL.rot);
  return { x: (BARREL.rx + c * L) * BIG, y: (BARREL.ry + s * L) * BIG + 0.9 * (1 - BIG) };
};

// his own face from the game's head (champ-vfx headArt), as the DOM head lays it out
// (player two's mirrored about its own frame's middle, as style.css mirrors it)
function drawArt(g, art) {
  if (!art.flip) { g.drawImage(art.img, art.x, art.y, art.w, art.h); return; }
  g.save(); g.translate(art.x + art.w / 2, 0); g.scale(-1, 1);
  g.drawImage(art.img, -art.w / 2, art.y, art.w, art.h);
  g.restore();
}

// the fuse out of the touch-hole, `len` of it left (0–1), its spark at the end
function fuse(g, r, len, now, lit = true) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = (i / 8) * Math.max(0.04, len);
    const x = -0.72 - 0.42 * u + 0.12 * u * u, y = -0.62 - 0.66 * u + 0.1 * Math.sin(u * 5 + now * 3) * u;
    pts.push([x * r, y * r]);
  }
  g.strokeStyle = '#4a3010'; g.lineWidth = 0.09 * r; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) g.lineTo(x, y); g.stroke();
  g.strokeStyle = '#a07a3a'; g.lineWidth = 0.035 * r;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) g.lineTo(x, y - 0.015 * r); g.stroke();
  if (!lit) return;
  const [ex, ey] = pts[pts.length - 1], f = 0.75 + 0.25 * Math.sin(now * 47);
  blit(g, glow('#ffb347', 0.2), ex, ey, r * 1.3 * f, r * 1.3 * f, 0, 0.95);
  for (let i = 0; i < 3; i++) { const a = now * 19 + i * 2.1; blit(g, spark('#ffe14a'), ex, ey, r * (0.55 + 0.4 * hash(i, Math.floor(now * 30))), 7, a, 0.9, true, 0, 0.5); }
}

// feathers, smoke and bubbles bursting off him at the flip, `t` s after it, at the origin
function flipBurst(g, r, t, big = 1) {
  if (t < 0 || t > 0.5) return;
  const f = t / 0.5;
  // the pop: a white flash and a ring of light where the change happens
  if (t < 0.09) { const k = 1 - t / 0.09; blit(g, glow('#fff6c0', 0.5), 0, 0, r * 3 * big * k + r, r * 3 * big * k + r, 0, 0.75 * k); }
  if (t < 0.22) {
    const k = t / 0.22; g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.9 * (1 - k); g.strokeStyle = '#ffe9a8'; g.lineWidth = r * 0.25 * (1 - k) + 1;
    g.beginPath(); g.arc(0, 0, r * (0.8 + 1.6 * k) * big, 0, TAU); g.stroke(); g.restore();
  }
  // a few soft puffs thrown out to the sides (white, thin: they must never hide his face)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.8, d = r * (1.0 + f * 1.4);
    blit(g, smoke(i, SMOKE_L), Math.cos(a) * d, Math.sin(a) * d * 0.7, r * (0.7 + f * 0.9) * big, r * (0.7 + f * 0.9) * big, a, 0.5 * (1 - f) * (1 - f), false);
  }
  const sp = spark('#ffe14a');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2, d = r * (0.7 + f * 2.2); blit(g, sp, Math.cos(a) * d, Math.sin(a) * d, r * 0.9 * (1 - f), 6, a, 1 - f, true, 1, 0.5); }
  for (let i = 0; i < 7; i++) {
    const h1 = hash(i, 41), h2 = hash(i, 57), a = -Math.PI / 2 + (h1 - 0.5) * 3.4, v = r * (5 + h2 * 5);
    const x = Math.cos(a) * v * t, y = Math.sin(a) * v * t + r * 9 * t * t;
    g.globalAlpha = 1 - f; feather(g, x, y, r * (0.28 + 0.12 * h2), t * (8 + h1 * 6) * (i % 2 ? 1 : -1), FEATHERS[i % 3]); g.globalAlpha = 1;
  }
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (hash(i, 77) - 0.5) * 2.6, d = r * (0.8 + f * 1.6);
    blit(g, bubble(), Math.cos(a) * d, Math.sin(a) * d - f * r, r * 0.42, r * 0.42, 0, 0.8 * (1 - f));
  }
}

// ── small pieces ──────────────────────────────────────────────────────────────────────────
function cannonball(g, x, y, R, ux, uy, heat = 1) {
  const rg = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  rg.addColorStop(0, IRON.hi); rg.addColorStop(0.45, IRON.mid); rg.addColorStop(1, IRON.dark);
  g.fillStyle = rg;
  g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  if (heat > 0) {
    const a = Math.atan2(uy, ux);
    g.save(); g.globalCompositeOperation = 'lighter';
    const hg = g.createRadialGradient(x + ux * R * 0.7, y + uy * R * 0.7, R * 0.05, x + ux * R * 0.5, y + uy * R * 0.5, R * 0.95);
    hg.addColorStop(0, '#ffe2a0'); hg.addColorStop(0.3, '#ff9a2a'); hg.addColorStop(1, '#ff4a1200');
    g.globalAlpha = 0.75 * heat; g.fillStyle = hg;
    g.beginPath(); g.arc(x, y, R, a - 1.1, a + 1.1); g.closePath(); g.fill();
    g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.ellipse(x - R * 0.38, y - R * 0.42, R * 0.22, R * 0.12, -0.7, 0, TAU); g.fill();
  g.strokeStyle = '#07080b'; g.lineWidth = Math.max(1.2, R * 0.08);
  g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
}
function coin(g, x, y, R, turn) {
  const w = Math.max(0.15, Math.abs(Math.cos(turn)));
  g.save(); g.translate(x, y); g.scale(w, 1);
  g.fillStyle = '#b8860b'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(0, 0, R * 0.78, 0, TAU); g.fill();
  g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(-R * 0.25, -R * 0.25, R * 0.25, 0, TAU); g.fill();
  g.restore();
}
function feather(g, x, y, L, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = col;
  g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(-L * 0.1, -L * 0.32, L, 0); g.quadraticCurveTo(-L * 0.1, L * 0.32, -L, 0); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-L, 0); g.lineTo(L * 0.9, 0); g.stroke();
  g.restore();
}
// the trail a cannon shot drags: smoke laid down behind it and a comet of fire off its nose
function trail(g, x, y, dir, r, travelled, cols, heat, z = 1) {
  const n = 6, L = Math.min(travelled, r * 15 * z);
  for (let i = n; i >= 1; i--) {
    const d = (i / n) * L, k = i / n;
    blit(g, smoke(i, SMOKE_G), x - dir * d, y - k * 8 * z, r * (1.8 + 3.2 * k) * z, r * (1.8 + 3.2 * k) * z, i * 0.9, 0.7 * (1 - k * 0.75), false);
  }
  streak(g, x, y, dir, 0, Math.min(L, r * 9 * z), cols, (r / 13) * z, 0.95);
  blit(g, glow(heat, 0.2), x - dir * r * 0.6 * z, y, r * 5 * z, r * 3.6 * z, 0, 0.55);
}
const FIRE = ['#fff2c0', '#ffb347', '#ff4a12'], GOLD = ['#ffffff', '#ffd34a', '#ff9a1a'];
// The few textures it uses — two smokes, three glows, three sparks — painted ahead (warm).
const SMOKE_L = '#eef0f6', SMOKE_G = '#cfd3db';
const WARM = [() => glow('#fff6c0', 0.5), () => glow('#ffb347', 0.2), () => glow('#ff9a1a', 0.3), () => glow('#ffcc33', 0.2),
  () => spark('#ffe14a'), () => spark('#ffffff'), () => spark('#ffb347'), () => smoke(0, SMOKE_L), () => smoke(0, SMOKE_G), () => bubble()];

// ── the one-off bursts (champ-vfx event → burst) ──────────────────────────────────────────
// The shot leaving: the flash (lighting the barrel and the grass under it), the smoke ring, sparks,
// feathers and coins. The ball's flash is the same, a size up.
function blast(x, y, gy, dir, n) {
  const S = sizeOf(n), big = n >= 3;
  return {
    t: 0, life: 0.7,
    draw(g, t) {
      if (t < 0.16) {
        const k = 1 - t / 0.16;
        blit(g, glow('#ff9a1a', 0.3), x + dir * 14, y, (200 * k + 60) * S, (150 * k + 40) * S, 0, k);
        blit(g, glow('#fff6c0', 0.5), x + dir * 6, y, (90 * k + 20) * S, (70 * k + 16) * S, 0, k);
        blit(g, glow('#ffb347', 0.2), x, gy, 230 * S * k + 40, 46 * k + 10, 0, 0.7 * k);     // the grass lit
      }
      const ring = 22 + t * 200 * S, ra = Math.max(0, 0.75 - t * 1.2);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, sx = x + dir * (12 + t * 80) + Math.cos(a) * ring * 0.42, sy = y + Math.sin(a) * ring * 0.9 - t * 30;
        blit(g, smoke(i, SMOKE_G), sx, sy, (30 + t * 50) * S, (30 + t * 50) * S, a, ra, false);
      }
      const sp = spark('#ffb347');
      for (let i = 0; i < 7; i++) {
        const a = (hash(i, 3) - 0.5) * 1.3, v = 300 + hash(i, 9) * 500;
        blit(g, sp, x + dir * Math.cos(a) * v * t, y + Math.sin(a) * v * t, 40 * (1 - t / 0.7), 10, dir > 0 ? a : Math.PI - a, Math.max(0, 1 - t / 0.35), true, 1, 0.5);
      }
      for (let i = 0; i < (big ? 9 : 6); i++) {
        const h1 = hash(i, 11), h2 = hash(i, 23);
        const vx = dir * (60 + h1 * 240) * (i % 2 ? 1 : -0.5), vy = -(200 + h2 * 300);
        const px = x + vx * t, py = y + vy * t + 700 * t * t;
        g.globalAlpha = Math.max(0, 1 - t / 0.7);
        if (i % 3 !== 2) feather(g, px, py, 8 + h1 * 5, t * (6 + h2 * 8) * (i % 2 ? 1 : -1), FEATHERS[i % 3]);
        else coin(g, px, py, 5.5 + h2 * 2, t * 18 + i);
        g.globalAlpha = 1;
      }
    },
  };
}
// a shell hits him: a boom of smoke and iron chunks
function shellHit(x, y, dir) {
  return {
    t: 0, life: 0.65,
    draw(g, t) {
      const f = t / 0.65;
      if (t < 0.14) { const k = 1 - t / 0.14; blit(g, glow('#ffb347', 0.2), x, y, 180 * k + 60, 160 * k + 50, 0, k); }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.3, d = 12 + f * 60;
        blit(g, smoke(i, SMOKE_G), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - f * 30, 40 + f * 60, 40 + f * 60, a, 0.7 * (1 - f), false);
      }
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (hash(i, 5) - 0.5) * 2.8, v = 250 + hash(i, 6) * 300;
        const px = x - dir * 30 * t + Math.cos(a) * v * t, py = y + Math.sin(a) * v * t + 900 * t * t;
        g.globalAlpha = Math.max(0, 1 - f * 1.2);
        g.fillStyle = i % 2 ? '#2a2e38' : '#4a515e';
        g.save(); g.translate(px, py); g.rotate(t * 14 + i); g.fillRect(-4, -3, 8, 6); g.restore();
        g.globalAlpha = 1;
      }
    },
  };
}
// a parry: a clang of sparks off the boot and the shell batted up and away, spinning out
function clang(x, y, dir) {
  return {
    t: 0, life: 0.8,
    draw(g, t) {
      const f = t / 0.8;
      if (t < 0.16) { const k = 1 - t / 0.16; blit(g, glow('#fff6c0', 0.5), x, y, 190 * k + 40, 190 * k + 40, 0, k); blit(g, glow('#ffb347', 0.2), x, y, 260 * k, 200 * k, 0, 0.6 * k); }
      if (t < 0.34) {
        const k = t / 0.34; g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - k; g.strokeStyle = '#ffe2a0'; g.lineWidth = 9 * (1 - k) + 1;
        g.beginPath(); g.arc(x, y, 16 + k * 90, 0, TAU); g.stroke(); g.restore();
      }
      const sp = spark('#ffe14a');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + hash(i, 2), v = 300 + hash(i, 4) * 420; blit(g, sp, x + Math.cos(a) * v * t, y + Math.sin(a) * v * t, 56 * (1 - f), 11, a, Math.max(0, 1 - t / 0.34), true, 1, 0.5); }
      // the shell, batted back the way it came and up, still hot, a streak of fire behind it
      const bx = x - dir * 420 * t, by = y - 520 * t + 1100 * t * t, vx = -dir * 420, vy = -520 + 2200 * t, v = Math.hypot(vx, vy);
      const a = Math.max(0, 1 - f * 1.1);
      streak(g, bx, by, vx / v, vy / v, 60 * a, ['#fff2c0', '#ffb347', '#ff4a12'], 0.9, a);
      g.globalAlpha = a;
      cannonball(g, bx, by, 15, vx / v, vy / v, Math.max(0.3, 1 - t * 2));
      g.globalAlpha = 1;
    },
  };
}
// on the goal line: a puff of smoke and a flicker of fire in the net
function puffOut(x, y) {
  return {
    t: 0, life: 0.6,
    draw(g, t) {
      const f = t / 0.6;
      if (t < 0.1) { const k = 1 - t / 0.1; blit(g, glow('#ff9a1a', 0.3), x, y, 110 * k + 30, 90 * k + 30, 0, k); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; blit(g, smoke(i, SMOKE_G), x + Math.cos(a) * (10 + f * 34), y + Math.sin(a) * (8 + f * 24) - f * 24, 36 + f * 46, 36 + f * 46, a, 0.65 * (1 - f), false); }
    },
  };
}
// the ball's thud on a body (the heavy cannonball rolling on): a ring of dust and coins
function thud(x, y, dir) {
  const coins = [];
  for (let i = 0; i < 6; i++) coins.push({ x, y, vx: dir * (40 + Math.random() * 160) * (i % 2 ? 1 : -1), vy: -(260 + Math.random() * 260), r: 5 + Math.random() * 2.5, w: Math.random() * 20 });
  return {
    t: 0, life: 0.7,
    step(dt) { for (const c of coins) { c.vy += 1100 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.w += dt * 16; } },
    draw(g, t) {
      const f = t / 0.7;
      g.save();
      g.globalAlpha = 0.5 * (1 - f); g.strokeStyle = '#e8dcc0'; g.lineWidth = 8 * (1 - f) + 1;
      g.beginPath(); g.ellipse(x, y, 18 + f * 80, 10 + f * 40, 0, 0, TAU); g.stroke();
      g.globalAlpha = Math.max(0, 1 - f * 1.2);
      for (const c of coins) coin(g, c.x, c.y, c.r, c.w);
      g.restore();
    },
  };
}

// ── the head: per player, what the client saw of his barrage (recoil clocks) ────────────────
const seen = [{ fire: -9, fireN: 0, pend: 0 }, { fire: -9, fireN: 0, pend: 0 }];

export default {
  id: 'broadside',
  palette: ['#ffb347', '#3a404c', '#e0282e', '#ffd34a'],
  cutColor: '#ff8a2a',
  hideInCut: true,
  headIn: HEAD_IN, headOut: HEAD_OUT,

  // worn while armed, while his ball sits loaded in the barrel, and for the ball's first BACK_AFTER s
  // out of it (its recoil and flash play on the cannon before he flips back)
  wears(p, m) {
    if (p.armed > 0) return true;
    const pw = m.ball && m.ball.power;
    if (!pw || pw.cp !== 'broadside' || pw.owner !== p.index) return false;
    // (his own barrage only: a blocker firing it back fires it as himself — no cannon)
    if (pw.src !== pw.owner) return false;
    return pw.ph === 'load' || (pw.ph === 'fly' && pw.t < BACK_AFTER);
  },

  head(g, p, s) {
    const { r, now, form, art } = s;
    const sn = seen[p.index] || (seen[p.index] = { fire: -9, fireN: 0, pend: 0 });
    if (sn.pend) { sn.fire = now; sn.fireN = sn.pend; sn.pend = 0; }
    const T = form.k * (form.st === 'in' ? HEAD_IN : form.st === 'out' ? HEAD_OUT : 0);
    const m = s.m, pw = m.ball && m.ball.power;
    const mine = !!(pw && pw.cp === 'broadside' && pw.owner === p.index && pw.ph === 'load');
    const cut = m.cutin > 0 && m.cutinBy === p.index ? C.POWER_CUTIN - m.cutin : -1;
    g.save();
    // the shared wind-up's nod (back, then whipped face-down, then up) taken out; his own move in
    const tilt = s.tilt - (s.cutTilt || 0) + (cut >= 0 ? -s.side * loadTilt(cut) : 0);
    g.translate(s.hx, s.hy); g.rotate(tilt);
    let showArt = 0, sx = 1, sy = 1, ext = 1, flipX = 1, burstAt = -1;
    const art0 = art;
    if (form.st === 'in') {
      burstAt = 0.26;
      if (T < 0.12) { const a = T / 0.12, e = a * (2 - a); showArt = 1; sx = 1 + 0.1 * e; sy = 1 - 0.13 * e; }
      else if (T < 0.4) {
        const f = (T - 0.12) / 0.28; flipX = Math.max(0.02, Math.abs(Math.cos(Math.PI * f)));
        if (f < 0.5) { showArt = 1; sx = 1 + 0.1 * (1 - f * 2); sy = 1 - 0.13 * (1 - f * 2); }
        else { const u = (f - 0.5) / 0.5; ext = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2); ext = Math.max(0, Math.min(1.15, ext)); }
      } else { const u = (T - 0.4) / 0.15; sy = 1 + 0.1 * Math.sin(u * Math.PI * 2) * (1 - u); sx = 1 - 0.06 * Math.sin(u * Math.PI * 2) * (1 - u); }
    } else if (form.st === 'out') {
      burstAt = 0.12;
      if (T < 0.24) {
        const f = T / 0.24; flipX = Math.max(0.02, Math.abs(Math.cos(Math.PI * f)));
        if (f < 0.5) { ext = 1 - f * 1.6; sx = 1 + 0.08 * f; sy = 1 - 0.12 * f; } else showArt = 1;
      } else { showArt = 1; const u = (T - 0.24) / 0.18; g.rotate(0.12 * Math.sin(u * 22) * (1 - u)); sy = 1 + 0.06 * Math.sin(u * Math.PI) * (1 - u); }
    }
    // the cut-in's wind-up loading: the barrel squashes as the ball goes down it
    if (cut >= 0 && cut < 1.27) { const q = Math.max(0, 1 - Math.abs(cut - 0.62) / 0.12); sx *= 1 - 0.07 * q; sy *= 1 + 0.08 * q; }
    // the recoil of the last shot, and the breathing in between
    const since = now - sn.fire, rec = (since < 0.04 ? since / 0.04 : Math.max(0, 1 - (since - 0.04) / 0.26) ** 2) * sizeOf(sn.fireN);
    if (!showArt && form.st === 'on') { const b = Math.sin(now * 3.1) * 0.012; sy *= 1 + b; sx *= 1 - b; }
    if (since < 0.3) { sx *= 1 - 0.08 * rec; sy *= 1 + 0.05 * rec; }
    // the face (his own) or the cannon, squashed about the chin, turned by the flip
    g.save();
    g.translate(0, r * 0.9); g.scale(flipX * sx, sy); g.translate(0, -r * 0.9);
    if (showArt && art0) drawArt(g, art0);
    else {
      g.translate(0, 0.9 * r); g.scale(s.side * BIG, BIG); g.translate(0, -0.9 * r);
      drawCannon(g, r, ext, since < 0.3 ? rec : 0, p.hurt);
      // the fuse: burning down to the next shot while loaded, fizzing while he waits armed
      if (form.st === 'on' || (form.st === 'in' && T > 0.4)) {
        let len = 1;
        if (mine) {
          if (cut >= 0) len = 1 - Math.min(1, cut / (C.POWER_CUTIN - C.POWER_RELEASE));
          else len = 1 - Math.min(1, (pw.k - (pw.n - 1) * BROADSIDE.GAP) / BROADSIDE.GAP);
          if (since < 0.25) len = Math.min(1, since / 0.12);     // a fresh fuse pops up after a shot
        } else len = 0.92 + 0.08 * Math.sin(now * 2);
        fuse(g, r, Math.max(0.05, len), now);
      }
      // smoke curling off the muzzle while he waits
      if (form.st === 'on' && !(since < 0.6)) {
        const mo = { x: BARREL.rx + Math.cos(BARREL.rot) * (BARREL.len + 0.06), y: BARREL.ry + Math.sin(BARREL.rot) * (BARREL.len + 0.06) };
        for (let i = 0; i < 2; i++) { const f = (now * 0.7 + i / 2) % 1; blit(g, smoke(i + 3, SMOKE_G), mo.x * r + f * r * 0.4, mo.y * r - f * r * 1.6, r * (0.35 + f * 0.6), r * (0.35 + f * 0.6), f * 3, 0.3 * (1 - f), false); }
      }
    }
    g.restore();
    // the flip's burst of feathers, smoke and bubbles
    if (burstAt >= 0) flipBurst(g, r, T - burstAt, form.st === 'in' ? 1 : 0.8);
    // the anticipation's glint on the star coin, and the bands' two pings
    if (form.st === 'in') {
      if (T < 0.16) {
        const q = Math.sin(Math.PI * T / 0.16), gx = art ? art.x + art.w * (art.flip ? 0.49 : 0.51) : 0, gy = art ? art.y + art.h * 0.13 : -1.05 * r;
        blit(g, glow('#fff6c0', 0.5), gx, gy, r * 0.8 * q, r * 0.8 * q, 0, q);
        blit(g, spark('#ffffff'), gx, gy, r * 1.8 * q, 8, 0.6, q); blit(g, spark('#ffffff'), gx, gy, r * 1.2 * q, 6, 0.6 + Math.PI / 2, q);
      }
      for (const [at, bx] of [[0.3, 0.3], [0.36, 0.93]]) {
        const q = 1 - Math.abs(T - at) / 0.06;
        if (q > 0) {
          const c = Math.cos(BARREL.rot), px = s.side * (BARREL.rx + bx * c) * BIG * r, py = ((BARREL.ry - 0.35) * BIG + 0.9 * (1 - BIG)) * r;
          blit(g, glow('#fff6c0', 0.5), px, py, r * 0.9 * q, r * 0.9 * q, 0, q); blit(g, spark('#ffffff'), px, py, r * 1.5 * q, 6, 0.9, q);
        }
      }
      // the "ka-chunk" puff out of the muzzle
      if (T > 0.42) { const f = (T - 0.42) / 0.13, mo = mouth(); blit(g, smoke(2, SMOKE_L), s.side * (mo.x + f * 0.5) * r, (mo.y - f * 0.3) * r, r * (0.5 + f), r * (0.5 + f), f * 2, 0.7 * (1 - f * 0.5), false); }
    }
    // the gulp: a puff out of the touch-hole as it goes down
    if (cut >= 0.7 && cut < 1.1) { const f = (cut - 0.7) / 0.4; blit(g, smoke(5, SMOKE_L), s.side * -0.8 * r, -r * (0.7 + f * 0.8), r * (0.5 + f * 0.8), r * (0.5 + f * 0.8), f * 2, 0.6 * (1 - f), false); }
    g.restore();
    // the cut-in: the ball dropping straight down into the upturned muzzle (the wind-up tips it up)
    if (cut >= 0.1 && cut < 0.72 && s.ball) {
      const f = (cut - 0.1) / 0.62, mo = mouth(), lx = s.side * mo.x * r, ly = mo.y * r;
      const c = Math.cos(tilt), sn2 = Math.sin(tilt);
      const wx = s.hx + lx * c - ly * sn2, wy = s.hy + lx * sn2 + ly * c;
      const drop = (1 - f) * (1 - f) * r * 3.4, sink = Math.max(0, (f - 0.82) / 0.18);
      g.save(); g.globalAlpha = 1 - sink;
      s.ball(g, wx, wy - drop + sink * r * 0.3);
      g.restore();
    }
  },

  // the ball: sealed in the barrel while loaded; out of the muzzle a shell to look at, then itself
  draw(g, b, s) {
    const pw = s.pw;
    if (pw.ph === 'load') {
      // a BLOCKER firing it back has no cannon: the charge builds in the air in front of his head
      // instead — a hot glow swelling to each shot, sparks swirling in, smoke curling off it
      if (pw.src !== pw.owner) {
        const now = s.now || 0, p = Math.max(0, Math.min(1, (pw.k - Math.max(0, pw.n - 1) * BROADSIDE.GAP) / BROADSIDE.GAP)), z = sizeOf(pw.n + 1), r = s.r;
        const f = 0.85 + 0.15 * Math.sin(now * 40);
        blit(g, glow('#ff9a1a', 0.3), s.x, s.y, r * (2.2 + 3 * p) * z * f, r * (2.2 + 3 * p) * z * f, 0, 0.45 + 0.45 * p);
        blit(g, glow('#fff6c0', 0.5), s.x, s.y, r * (0.8 + 1.4 * p) * z, r * (0.8 + 1.4 * p) * z, 0, 0.6 + 0.4 * p);
        const sp = spark('#ffe14a');
        for (let i = 0; i < 6; i++) {
          const a = now * 6 + i * 1.05, d = r * (2.6 - 1.8 * ((now * 1.6 + i / 6) % 1)) * z;
          blit(g, sp, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, r * 1.1, 6, a + Math.PI, 0.5 + 0.5 * p, true, 0, 0.5);
        }
        blit(g, smoke(1, SMOKE_L), s.x - (pw.dir || 1) * r * 0.6, s.y - r * (0.6 + p), r * 1.4 * z, r * 1.4 * z, now, 0.25, false);
      }
      return true;
    }
    const dir = pw.dir || 1, x = s.x, y = s.y, r = s.r, t = s.t || 0;
    const iron = !!pw.brg && t < REVEAL;
    const k = pw.brg ? sizeOf(3) : 1;
    trail(g, x, y, dir, r, t * C.POWER_SHOT_SPEED * BROADSIDE.SPEED, iron ? FIRE : GOLD, iron ? '#ff8a1a' : '#ffcc33', k);
    if (iron) { cannonball(g, x, y, r * 1.08 * k, dir, 0, 1); return true; }
    // the iron skin bursting off it: shards and a ring of light where it shed it
    const q0 = (t - REVEAL) / 0.4;
    if (pw.brg && q0 < 1) {
      const k = q0;
      const rx = s.fx + dir * REVEAL * C.POWER_SHOT_SPEED * BROADSIDE.SPEED, ry = s.fy;
      if (k < 0.35) { const q = 1 - k / 0.35; blit(g, glow('#fff6c0', 0.5), rx, ry, r * 10 * q + r * 2, r * 9 * q + r * 2, 0, q); blit(g, glow('#ffcc33', 0.2), rx, ry, r * 16 * q, r * 12 * q, 0, 0.7 * q); }
      if (k < 0.6) {
        const q = k / 0.6; g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - q; g.strokeStyle = '#ffe9a8'; g.lineWidth = r * 0.5 * (1 - q) + 1;
        g.beginPath(); g.ellipse(rx, ry, r * (1.2 + 5 * q), r * (1.2 + 4 * q), 0, 0, TAU); g.stroke(); g.restore();
      }
      const sp = spark('#ffe14a'), tt = k * 0.4;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.15, v = r * (16 + 8 * hash(i, 7)); blit(g, sp, rx + Math.cos(a) * v * tt, ry + Math.sin(a) * v * tt, r * 2.4 * (1 - k), 9, a, 1 - k, true, 1, 0.5); }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.4, v = r * (8 + hash(i, 31) * 7);
        const px = rx + Math.cos(a) * v * tt - dir * r * 3 * tt, py = ry + Math.sin(a) * v * tt + r * 34 * tt * tt;
        const R = r * (0.45 + 0.25 * hash(i, 13));
        g.globalAlpha = Math.max(0, 1 - k * 1.1);
        g.save(); g.translate(px, py); g.rotate(tt * 16 + i);
        g.fillStyle = i % 2 ? '#4a515e' : '#1d2129'; g.strokeStyle = '#07080b'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-R, 0); g.lineTo(-R * 0.1, -R * 0.62); g.lineTo(R, -R * 0.1); g.lineTo(R * 0.15, R * 0.55); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,170,90,0.9)'; g.beginPath(); g.moveTo(-R * 0.1, -R * 0.62); g.lineTo(R, -R * 0.1); g.lineTo(R * 0.6, -R * 0.15); g.closePath(); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
    }
    return false;                                         // the real ball on top
  },
  hideShadow: (pw) => pw.ph === 'load',

  // a shell in the air (champ-vfx flying): iron, white-hot on the nose, its fire and its smoke
  flying(g, z, s) {
    // (which shell: the one his loaded ball has fired last)
    const pw = s.m && s.m.ball.power, n = pw && pw.cp === 'broadside' && pw.owner === z.own && pw.ph === 'load' ? pw.n : 1, k = sizeOf(n);
    trail(g, s.x, s.y, s.dir, s.r, s.t * s.spd, FIRE, '#ff8a1a', k);
    cannonball(g, s.x, s.y, s.r * 1.08 * k, s.dir, 0, 1);
  },
  // (no shadow on the grass: HS draws none under its ball, nor do we — Idan — and a shell is a ball
  // to look at)

  event(e, at) {
    if (e.type === 'cannonFire') {
      if (seen[e.player]) seen[e.player].pend = e.n;
      const d = at(e.x, e.y), gd = at(e.x, C.GROUND_Y);
      return blast(d.x, d.y, gd.y, e.dir || 1, e.n);
    }
    if (e.type === 'powerHit' && e.cp === 'broadside') { const d = at(e.x, e.y); return e.how === 'shell' ? shellHit(d.x, d.y, e.by === 0 ? 1 : -1) : thud(d.x, d.y, 1); }
    if (e.type === 'shellParry') { const d = at(e.x, e.y); return clang(d.x, d.y, e.dir || 1); }
    if (e.type === 'shellBurst' && e.cp === 'broadside') { const d = at(e.x, e.y); return puffOut(d.x, d.y); }
    return null;
  },

  // paint the cannon's sprites and its textures ahead of the first press, one a slice (champ-vfx
  // warmTextures runs it again while it answers false)
  warm() {
    if (!this._w) this._w = [() => bodyTex(C.HEAD_R), () => barrelTex(C.HEAD_R), ...WARM];
    const j = this._w.shift(); if (j) j();
    return this._w.length === 0;
  },
};
