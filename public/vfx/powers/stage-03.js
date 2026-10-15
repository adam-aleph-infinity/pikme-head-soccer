// INFERNO SPATULA VOLLEY, drawn — the Burning Chef's power (what it does:
// shared/champion-powers/stage-03.js; spec: docs/CHAMPION-POWERS.md §1d).
// The champion is a flame-grilled burger (an angry face on the top bun, cheese, lettuce, a grilled
// patty) in the card's yellow shirt with the red Saltiz emblem; the card, Naveh as a many-armed chef
// at a row of blazing grills. Our own art, painted in the fx-kit's way: cached sprites, soft
// additive light, his own face from the game's head (champ-vfx headArt).
//
//   the press     IGNITION (`head`, worn from the press to just after the ball leaves): he squashes
//                 down, embers and heat lift off his boots, a ring of small flames climbs him to the
//                 bun; SIX ARMS unfold from behind the patty (yellow sleeves, the shirt's), each
//                 flipping a spatula into its hand; the card's red-and-yellow emblem drops onto the
//                 bun as his chef's crown; a "fwoomp" of flame behind him. Armed: the arms twirl
//                 their spatulas in turn, the crown wobbles in the heat, flames breathe behind him
//                 (never over the face), a warm pool of light on the grass.
//   the cut-in    his own move instead of the shared nod: he plants, his top bun swings up on its
//                 back hinge like a grill lid (his face riding it) over a glowing grill inside; the
//                 ball pops up off the touch and drops in; the arms rack up and tap a drum-roll.
//   the volley    (Idan, from his footage of Head Soccer: the same shots and timing, only spatulas)
//                 at the release his bun flings the ball up off the screen as a big glowing spatula,
//                 the other ten flung up after it; then, one every 0.1 s, the ten come back down out
//                 of the sky on the Moon Shot's lines onto the goal, tumbling on fire streaks, each
//                 bursting in sparks where it meets the wall; whoever one meets is thrown (the power
//                 hit); a parry, a clang. His arms up, then pointing at the goal.
//   the ball      the 11th: the biggest, glowing gold spatula dives in on its line — the hidden ball
//                 (the ball itself shows once it is in, or blocked). He closes his lid, folds the
//                 arms away, the crown pops off in sparks and the flames go to smoke.
//   kick-blocked  the blocker throws the whole volley back (no chef form for him): the same golden
//                 spatula up, the same rain, the same dive.
// Client only: Math.random / sin / cos are fine here — nothing drawn feeds back into the sim.

import { TAU, hash, streak, flame } from './common.js';
import { blit, glow, smoke, spark, ring, tex, book } from '../fx-kit.js';
// (the engine first: the stage file is part of its registry's import cycle)
import '../../../shared/hs-powers.js';
import { VOLLEY, spatAt, volleyClock } from '../../../shared/champion-powers/stage-03.js';
import { depthPoint } from '../../../shared/goalbox.js';
import * as C from '../../../shared/constants.js';

const V = VOLLEY;
// THE LOOK'S OWN CLOCK (the flight's: s from the release, `pw.vk`): the golden 11th whipped up at the
// release by the front top arm, the other ten flung up after it, the arms up and pointing at the goal
// while the rain falls, the thrust as it dives
const L = Object.freeze({
  UP: [0.02, 0.045, 0.07, 0.095, 0.12, 0.145, 0.17, 0.195, 0.22, 0.245],
  ARM: [0, 4, 1, 5, 2, 0, 4, 1, 5, 2],
  HAND_X: [-0.55, -0.35, -0.15, 0.15, 0.35, 0.55], HAND_Y: 1.35,
  BALL_UP: 0, TELL: 0.3, BALL_AT: V.BALL_AT,
});
const INK = '#1b1418';                                   // the art's keyline
const SLEEVE = '#f5c518', SLEEVE_SH = '#c99a0c';         // the shirt's yellow (characters.js KITS)
const SKIN = '#f3c29b';
const RED = '#e2231a', DARK_RED = '#a8150f', GOLD = '#ffd21a';
const FIRE = ['#fff2b0', '#ffa21a', '#ff4a12'];
const GOLD_FIRE = ['#fffbe0', '#ffd34a', '#ff9a1a'];
const HEAD_IN = 0.65, HEAD_OUT = 0.45;                   // s: the ignition, and back to the burger
const BACK_AFTER = 0.35;                                 // s after the ball leaves before he changes back
const STICK = 0.35, BURN = 0.3;                          // s a spatula stands in the turf, then burns away
const SPAT_K = 1.8;                                      // the spatulas' size, drawn (Idan: bigger, readable)
const K = 3.5;                                           // sprite texels per world px
// the burger in its art frame (fractions of its width forward, of its height down): the top bun's
// lower edge (the lid's seam), its back edge (the hinge), its middle; the bottom bun's lower edge
const ART = { seam: 0.47, hinge: 0.12, mid: 0.48, top: 0.06, base: 0.84, patty: 0.62 };
const OPEN = 0.85;                                       // rad the lid stands open
const RELEASE = C.POWER_CUTIN - C.POWER_RELEASE;         // s into the cut-in the volley's clock starts

// ── the sprites ───────────────────────────────────────────────────────────────────────────────
// A SPATULA along +x from its grip end: a dark wooden handle with a steel ferrule, the neck, a
// slotted steel blade, its tip glowing hot. `gold`: the 15th — the ball in disguise.
const SP_L = 1.3, SP_W = 0.5;                            // × HEAD_R
function paintSpatula(g, L, W, gold) {
  const o = Math.max(1.5, W * 0.07);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const hy = W / 2;
  // the handle
  g.fillStyle = gold ? RED : '#3a2416'; g.strokeStyle = INK; g.lineWidth = o;
  g.beginPath(); g.moveTo(o, hy - W * 0.11); g.lineTo(L * 0.48, hy - W * 0.13); g.lineTo(L * 0.48, hy + W * 0.13); g.lineTo(o, hy + W * 0.11);
  g.arc(o, hy, W * 0.11, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = gold ? '#ff6a52' : '#6a4630'; g.fillRect(o * 2, hy - W * 0.07, L * 0.4, W * 0.04);
  // the ferrule and the neck
  g.fillStyle = gold ? '#fff1a0' : '#c9ced8'; g.beginPath(); g.rect(L * 0.46, hy - W * 0.15, L * 0.06, W * 0.3); g.fill(); g.stroke();
  g.fillStyle = gold ? '#e8b83a' : '#8f98a6'; g.beginPath(); g.rect(L * 0.52, hy - W * 0.06, L * 0.08, W * 0.12); g.fill(); g.stroke();
  // the blade: a rounded trapezoid, wider at the tip
  const x0 = L * 0.6, x1 = L - o;
  const bl = () => {
    g.beginPath();
    g.moveTo(x0, hy - W * 0.24); g.lineTo(x1 - W * 0.08, hy - W * 0.44); g.quadraticCurveTo(x1, hy - W * 0.44, x1, hy - W * 0.36);
    g.lineTo(x1, hy + W * 0.36); g.quadraticCurveTo(x1, hy + W * 0.44, x1 - W * 0.08, hy + W * 0.44); g.lineTo(x0, hy + W * 0.24); g.closePath();
  };
  const lg = g.createLinearGradient(0, hy - W * 0.44, 0, hy + W * 0.44);
  if (gold) { lg.addColorStop(0, '#fff6c0'); lg.addColorStop(0.45, '#ffcc33'); lg.addColorStop(1, '#b8780e'); }
  else { lg.addColorStop(0, '#f2f5fa'); lg.addColorStop(0.45, '#a3acba'); lg.addColorStop(1, '#4c535f'); }
  bl(); g.fillStyle = lg; g.fill();
  // the tip red-hot off the grill
  const hg = g.createLinearGradient(x0, 0, x1, 0);
  hg.addColorStop(0, 'rgba(255,120,20,0)'); hg.addColorStop(0.6, gold ? 'rgba(255,250,200,0.35)' : 'rgba(255,120,20,0.35)'); hg.addColorStop(1, gold ? 'rgba(255,255,230,0.85)' : 'rgba(255,150,40,0.9)');
  bl(); g.fillStyle = hg; g.fill();
  // the slots
  g.fillStyle = gold ? '#8a5a0c' : '#262a31';
  for (let i = 0; i < 3; i++) { const y = hy + (i - 1) * W * 0.22; g.beginPath(); g.rect(x0 + (x1 - x0) * 0.22, y - W * 0.035, (x1 - x0) * 0.56, W * 0.07); g.fill(); }
  bl(); g.lineWidth = o; g.strokeStyle = INK; g.stroke();
  // a glint along the top edge
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = o * 0.6;
  g.beginPath(); g.moveTo(x0 + W * 0.05, hy - W * 0.2); g.lineTo(x1 - W * 0.12, hy - W * 0.36); g.stroke();
}
const spatTex = (gold) => tex(`chefSpat${gold ? 'G' : ''}${C.HEAD_R}`, SP_L * C.HEAD_R * K, SP_W * C.HEAD_R * K, (g, w, h) => paintSpatula(g, w, h, gold));
// draw a spatula, its grip at (x, y), turned `rot`, `face` how much of its blade faces us (the
// tumble about its long axis: 1 flat on, ~0 edge on), `s` its size
function spatula(g, x, y, rot, face = 1, s = 1, gold = false, a = 1) {
  const L = SP_L * C.HEAD_R * s, W = SP_W * C.HEAD_R * s;
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(rot); g.scale(1, Math.max(0.16, Math.abs(face)));
  g.drawImage(spatTex(gold), -L * 0.12, -W / 2, L, W);
  g.restore();
}

// THE 11TH — THE HIDDEN BALL: the biggest spatula, gold and glowing, on a gold fire trail along
// (ux, uy), its handle at the back
function bigSpatula(g, x, y, ux, uy, now, k) {
  const pul = 0.85 + 0.15 * Math.sin(now * 30);
  streak(g, x, y, ux, uy, 170, GOLD_FIRE, 0.9 * k / 1.6, 1);
  blit(g, glow('#ffcc33', 0.3), x, y, 46 * k * pul, 46 * k * pul, 0, 0.8);
  blit(g, glow('#fff6c0', 0.5), x, y, 20 * k, 20 * k, 0, 0.7);
  const rot = Math.atan2(uy, ux);
  spatula(g, x - Math.cos(rot) * C.HEAD_R * 0.62 * k, y - Math.sin(rot) * C.HEAD_R * 0.62 * k, rot, 1, k, true);
}

// THE CROWN: the card's emblem as a chef's hat — a pointy-topped isometric cube, its top face
// yellow, its sides red, a yellow geometric bracket on its front faces, the art's thick keyline.
const CR = 1.15;                                         // × HEAD_R, its width
function paintCrown(g, w) {
  const c = w / 2, R = w * 0.46, o = Math.max(2, w * 0.05);
  const P = (k) => [c + Math.cos(-Math.PI / 2 + k * Math.PI / 3) * R, c + Math.sin(-Math.PI / 2 + k * Math.PI / 3) * R];
  const [p0, p1, p2, p3, p4, p5] = [0, 1, 2, 3, 4, 5].map(P);
  const quad = (a, b, d, e, col) => { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...d); g.lineTo(...e); g.closePath(); g.fillStyle = col; g.fill(); };
  const mid = [c, c];
  quad(p5, p0, p1, mid, GOLD);                            // the top face
  quad(mid, p1, p2, p3, RED);                             // the right face
  quad(p5, mid, p3, p4, DARK_RED);                        // the left face
  // the mark: a bracket on each front face, the logo's yellow
  g.strokeStyle = GOLD; g.lineWidth = w * 0.07; g.lineCap = 'square'; g.lineJoin = 'miter';
  const L = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  for (const [A, B, D] of [[mid, p1, p3], [mid, p5, p3]]) {
    const q = (u, v) => { const x = L(A, B, u), y = L(A, D, v); return [x[0] + y[0] - A[0], x[1] + y[1] - A[1]]; };
    g.beginPath(); g.moveTo(...q(0.72, 0.28)); g.lineTo(...q(0.28, 0.28)); g.lineTo(...q(0.28, 0.72)); g.lineTo(...q(0.72, 0.72)); g.stroke();
  }
  // a shine on the top face, the keyline round it all and down its edges
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(c - R * 0.1, c - R * 0.55, R * 0.3, R * 0.1, -0.3, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = o; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(...p0); [p1, p2, p3, p4, p5].forEach((p) => g.lineTo(...p)); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(...p1); g.lineTo(...mid); g.lineTo(...p5); g.moveTo(...mid); g.lineTo(...p3); g.stroke();
}
const crownTex = () => tex(`chefCrown${C.HEAD_R}`, CR * C.HEAD_R * K, CR * C.HEAD_R * K, (g, w) => paintCrown(g, w));

// FIRE: an 8-frame flipbook of one flame tongue (common.js flame, painted once each)
const flameBook = () => book('chefFlame', 8, 48, 96, (g, w, h, i) => flame(g, w / 2, h - 2, h * 0.8, w * 0.3, (hash(i, 3) - 0.5) * w * 0.3, i / 7));
function fire(g, x, y, h, now, i, a = 1) {
  const fb = flameBook(), f = fb[(Math.floor(now * 14 + i * 3) % 8 + 8) % 8];
  blit(g, f, x, y, h * 0.5, h, 0, a, true, 0.5, 1);
}
const WARM = [() => glow('#ff7a1a', 0.2), () => glow('#fff6c0', 0.5), () => glow('#ffcc33', 0.3), () => spark('#ffe14a'), () => spark('#ff9a1a'), () => ring('#ffd34a'), () => smoke(1, '#5a4a40')];

// ── the six arms ──────────────────────────────────────────────────────────────────────────────
// In head radii from the head's centre, `u` forward (× side), `y` down. 0–2 the back arms (top, mid,
// low), 3–5 the front ones. Shoulders hidden behind the patty; hands fanned out like the card's.
const SHOULDER = [[-0.5, 0.2], [-0.55, 0.4], [-0.5, 0.6], [0.5, 0.2], [0.55, 0.4], [0.5, 0.6]];
const REST = [[-1.5, -0.8], [-1.75, 0.0], [-1.45, 0.75], [1.5, -0.8], [1.75, 0.0], [1.45, 0.75]];
const WIND = [[-1.5, -1.25], [-1.65, -0.9], [-1.4, -0.6], [-0.35, -1.75], [-0.1, -1.7], [0.2, -1.55]];
const FOLLOW = [[1.1, 0.0], [1.25, 0.3], [1.2, 0.6], [1.6, 0.15], [1.7, 0.45], [1.5, 0.8]];
const RACK = [[-1.35, -1.25], [-1.6, -0.6], [-1.6, 0.15], [1.35, -1.25], [1.6, -0.6], [1.6, 0.15]];
const UNFOLD = [2, 0, 4, 5, 3, 1];                       // the order they come out in
const ARM_L = 1.0;                                       // × HEAD_R, each segment
const TWIRL = [0, 2, 4, 1, 3, 5];                        // the idle twirl's turn order
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const easeOut = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) * (1 - u));
const easeBack = (u) => { if (u <= 0) return 0; if (u >= 1) return 1; const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The hand of arm `a` at volley clock `kk` (s from the release; negative under the cut-in), in r
// units (u forward, y down), and whether it holds a spatula: rest, the cut-in's rack-up and its
// drum-roll, each throw's quick wind–whip-up–follow, the golden 15th's bigger one, then the arms up
// in a fan while the rain falls, pointing at the goal for the tell, and the dive's thrust.
const THROWS = [0, 1, 2, 3, 4, 5].map((a) => L.UP.map((t, i) => (L.ARM[i] === a ? t : null)).filter((t) => t != null));
const UPF = (a) => [L.HAND_X[a] * 1.3, -L.HAND_Y - 0.75];       // a throw's follow-through: on up
const POINT = [[-0.2, -1.6], [0.2, -1.35], [0.6, -1.0], [1.4, -1.2], [1.75, -0.7], [1.7, -0.2]];
function handPose(a, kk, now) {
  let h = REST[a], hold = 1;
  if (kk < 0) {
    // under the cut-in: up to the rack from 0.75 s in (kk −0.52), a drum-roll on the bun's edge
    const r = ease((kk + 0.52) / 0.3);
    h = lerp2(REST[a], RACK[a], r);
    if (r > 0) h = [h[0], h[1] + 0.06 * r * Math.sin(now * 60 + a * 1.7)];
  }
  // the golden 15th (arm 3): a bigger wind-up, the whip straight up, the follow-through
  const BU = L.BALL_UP;
  if (a === 3 && kk >= BU - 0.1 && kk < BU + 0.25) {
    const R = [0.35, -L.HAND_Y];                          // (where the sim lets the ball go)
    if (kk < BU - 0.03) return { h: lerp2(REST[a], WIND[a], ease((kk - BU + 0.1) / 0.07)), hold, gold: 1 };
    if (kk < BU) return { h: lerp2(WIND[a], R, easeOut((kk - BU + 0.03) / 0.03)), hold, gold: 1 };
    const f = kk - BU;
    if (f < 0.06) return { h: lerp2(R, UPF(a), easeOut(f / 0.06)), hold: 0, gold: 0 };
    return { h: lerp2(UPF(a), RACK[a], ease((f - 0.06) / 0.19)), hold: 0, gold: 0 };
  }
  // after the throws: a fan up while the rain falls, pointing at the goal for the tell, a thrust as
  // it dives, then back down
  if (kk >= BU + (a === 3 ? 0.25 : 0.05)) {
    h = lerp2(REST[a], RACK[a], ease((kk - BU - 0.05) / 0.15));
    if (kk >= L.TELL) h = lerp2(h, POINT[a], ease((kk - L.TELL) / 0.12));
    if (kk >= L.BALL_AT) h = lerp2(h, FOLLOW[a], ease((kk - L.BALL_AT) / 0.1) * (1 - ease((kk - L.BALL_AT - 0.15) / 0.25)));
    return { h: [h[0] + 0.03 * Math.sin(now * 9 + a), h[1]], hold: 0, gold: 0 };
  }
  // each throw of this arm: wind (−0.06 → −0.025), whip straight up to the release (→ 0), on up
  // (→ 0.04), back to rest (→ 0.16); the hand empty from the release until it grabs another
  for (const t of THROWS[a]) {
    const f = kk - t;
    if (f < -0.06 || f > 0.16) continue;
    const R = [L.HAND_X[a], -L.HAND_Y];
    if (f < -0.025) h = lerp2(h, WIND[a], ease((f + 0.06) / 0.035));
    else if (f < 0) h = lerp2(WIND[a], R, easeOut((f + 0.025) / 0.025));
    else if (f < 0.04) { h = lerp2(R, UPF(a), easeOut(f / 0.04)); hold = 0; }
    else { h = lerp2(UPF(a), h, ease((f - 0.04) / 0.12)); hold = f > 0.1 ? 1 : 0; }
    break;
  }
  return { h, hold, gold: 0 };
}

// One arm from its shoulder S to its hand H (px, local): two segments of ARM_L, the elbow bent
// down-outward; the yellow sleeve over the upper arm, a round hand, the spatula along the forearm.
function arm(g, r, S, H, side, sp) {
  const L = ARM_L * r;
  let dx = H[0] - S[0], dy = H[1] - S[1], d = Math.hypot(dx, dy) || 1;
  const dc = Math.min(2 * L - 0.5, Math.max(0.3 * r, d));
  const hx = S[0] + (dx / d) * dc, hy = S[1] + (dy / d) * dc;
  const ang = Math.atan2(dy, dx), bend = Math.acos(Math.min(1, dc / (2 * L)));
  const e1 = [S[0] + Math.cos(ang + bend) * L, S[1] + Math.sin(ang + bend) * L];
  const e2 = [S[0] + Math.cos(ang - bend) * L, S[1] + Math.sin(ang - bend) * L];
  const E = e1[1] > e2[1] ? e1 : e2;                     // the elbow hangs low
  const o = Math.max(1.6, r * 0.075), wA = r * 0.26, wS = r * 0.36;
  const M = [S[0] + (E[0] - S[0]) * 0.6, S[1] + (E[1] - S[1]) * 0.6];
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); g.stroke(); };
  line([S, E, [hx, hy]], wA + 2 * o, INK);
  line([S, E, [hx, hy]], wA, SKIN);
  line([S, M], wS + 2 * o, INK);
  line([S, M], wS, SLEEVE);
  g.strokeStyle = SLEEVE_SH; g.lineWidth = wS * 0.35; g.beginPath(); g.moveTo(S[0], S[1] + wS * 0.2); g.lineTo(M[0], M[1] + wS * 0.2); g.stroke();
  // the spatula in the hand (behind the fingers), pointing on along the forearm and up a little
  if (sp && sp.hold) {
    const fa = Math.atan2(hy - E[1], hx - E[0]);
    const up = -Math.PI / 2, lean = fa + (((up - fa + Math.PI * 3) % TAU) - Math.PI) * 0.35;
    spatula(g, hx, hy, lean + (sp.spin || 0), sp.face ?? 1, sp.s || 0.85, sp.gold);
    if (sp.gold) blit(g, glow('#ffcc33', 0.3), hx + Math.cos(lean) * r * 0.85, hy + Math.sin(lean) * r * 0.85, r * 2.2, r * 2.2, 0, 0.55 + 0.25 * Math.sin(sp.now * 30));
  }
  g.fillStyle = SKIN; g.strokeStyle = INK; g.lineWidth = o;
  g.beginPath(); g.arc(hx, hy, r * 0.19, 0, TAU); g.fill(); g.stroke();
  return [hx, hy];
}

// his own face from the game's head (champ-vfx headArt), as the DOM head lays it out (player two's
// mirrored about its own frame's middle, as style.css mirrors it)
function drawArt(g, art) {
  if (!art.flip) { g.drawImage(art.img, art.x, art.y, art.w, art.h); return; }
  g.save(); g.translate(art.x + art.w / 2, 0); g.scale(-1, 1);
  g.drawImage(art.img, -art.w / 2, art.y, art.w, art.h);
  g.restore();
}
// the art frame's x for a fraction `f` of its width, measured forward (the art faces right)
const artX = (art, f) => (art.flip ? art.x + art.w * (1 - f) : art.x + art.w * f);

// ── the per-player state the client keeps (what it saw: recoil clocks) ─────────────────────────
const seen = [{ kick: -9 }, { kick: -9 }];
// the spatulas in flight per thrower and index (so a hit or a parry can take one out of the air,
// and a repeated event cannot throw it twice)

// ── the bursts ────────────────────────────────────────────────────────────────────────────────
// a spatula that came down on the grass: stuck in blade-first, quivering, a puff of turf, then burnt
// away in embers (`since` s after it landed)
function stuck(g, x, y, dir, since, i) {
  const q = since < STICK ? 0 : (since - STICK) / BURN;
  if (q >= 1) return;
  const rot = Math.PI / 2 - dir * 0.95 + 0.18 * Math.sin(since * 46) * Math.exp(-since * 9), grip = C.HEAD_R * 1.2;
  if (since < 0.2) blit(g, smoke(2, '#6b5a3a'), x, y - 4, 30 + since * 90, 18 + since * 50, since * 3, 0.5 * (1 - since / 0.2), false);
  g.save(); g.beginPath(); g.rect(x - 80, y - 120, 160, 121); g.clip();
  spatula(g, x - Math.cos(rot) * grip * SPAT_K / 1.2, y - Math.sin(rot) * grip * SPAT_K / 1.2, rot, 1, SPAT_K, false, 1 - q);
  g.restore();
  if (q > 0) {
    const sp = spark('#ffb347');
    for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + (hash(j, i) - 0.5) * 1.6, v = 40 + 70 * hash(j, i + 7); blit(g, sp, x + Math.cos(a) * v * q, y - 14 + Math.sin(a) * v * q, 14 * (1 - q), 4, a, 1 - q, true, 1, 0.5); }
    blit(g, smoke(3, '#5a4a40'), x, y - 18 - q * 22, 26 + q * 20, 26 + q * 20, q * 2, 0.35 * (1 - q), false);
  }
}
// where a spatula meets the crossbar, the wall over the goal or the net: a burst of sparks, a puff, the spatula bouncing
// off and falling (`since` s after it got there)
function wallBurst(g, x, y, dir, since, i) {
  const k = since / 0.3;
  if (k >= 1) return;
  if (since < 0.05) blit(g, glow('#ffb347', 0.3), x, y, 60, 60, 0, 0.7 * (1 - since / 0.05));
  const sp = spark('#ffe14a');
  for (let j = 0; j < 5; j++) { const a = Math.PI + (j / 4 - 0.5) * 2.2 * dir + (dir < 0 ? Math.PI : 0), v = 160 + 120 * hash(j, i); blit(g, sp, x + Math.cos(a) * v * since, y + Math.sin(a) * v * since, 20 * (1 - k), 5, a, 1 - k, true, 1, 0.5); }
  blit(g, smoke(i % 4, '#6a5a50'), x, y - 6 * k, 22 + 30 * k, 22 + 30 * k, k, 0.35 * (1 - k), false);
  spatula(g, x - dir * 60 * since, y + 300 * since * since, -dir * since * 12, 0.8 + 0.2 * Math.cos(since * 20), SPAT_K * 0.9, false, 1 - k);
}
// A SPATULA'S HIT — small damage, growing with how many he has taken (`hits`): a clank, a hot flash,
// sparks, a few red drops, a hiss of steam, the spatula glancing off
function spatHit(x, y, dir, hits = 1) {
  const k = 0.7 + 0.08 * Math.min(10, hits);
  return {
    t: 0, life: 0.6,
    draw(g, t) {
      const f = t / 0.6;
      if (t < 0.4) {
        const gl = glow('#ff2a14', 0.05);
        for (let j = 0; j < 2 + Math.min(6, hits); j++) { const a = -Math.PI / 2 + (hash(j, hits) - 0.5) * 2.2, v = 120 + 120 * hash(j, 7); blit(g, gl, x + Math.cos(a) * v * t, y + Math.sin(a) * v * t + 500 * t * t, 9 * k, 8 * k, 0, 1 - t / 0.4, false); }
      }
      if (t < 0.034) blit(g, glow('#fff6c0', 0.5), x, y, 70 * k, 70 * k, 0, 0.3);
      if (t < 0.25) { const q = t / 0.25; blit(g, ring('#ffd34a'), x, y, (20 + 70 * q) * k, (20 + 70 * q) * k, 0, 0.8 * (1 - q)); }
      const sp = spark('#ffe14a');
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3, v = 200 + hash(i, 3) * 260; blit(g, sp, x + Math.cos(a) * v * t, y + Math.sin(a) * v * t, 30 * (1 - f), 7, a, Math.max(0, 1 - t / 0.3), true, 1, 0.5); }
      blit(g, smoke(0, '#f2f2f2'), x, y - 20 * f, 30 + 40 * f, 30 + 40 * f, f * 2, 0.4 * (1 - f), false);
      const bx = x - dir * 160 * t, by = y - 260 * t + 900 * t * t;
      spatula(g, bx, by, -dir * t * 22, Math.cos(t * 30), 0.9, false, Math.max(0, 1 - f * 1.3));
    },
  };
}
// A PARRY: a bright clang, the spatula batted back up the way it came, spinning
function spatParry(x, y, dir) {
  return {
    t: 0, life: 0.75,
    draw(g, t) {
      const f = t / 0.75;
      if (t < 0.12) { const k = 1 - t / 0.12; blit(g, glow('#fff6c0', 0.5), x, y, 120 * k + 30, 120 * k + 30, 0, 0.3 + 0.5 * k); }
      if (t < 0.3) { const k = t / 0.3; blit(g, ring('#ffe9a8'), x, y, 24 + 110 * k, 24 + 110 * k, 0, 1 - k); }
      const sp = spark('#ffe14a');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + hash(i, 2), v = 280 + hash(i, 4) * 380; blit(g, sp, x + Math.cos(a) * v * t, y + Math.sin(a) * v * t, 44 * (1 - f), 9, a, Math.max(0, 1 - t / 0.32), true, 1, 0.5); }
      const bx = x - dir * 380 * t, by = y - 560 * t + 1300 * t * t;
      streak(g, bx, by, -dir * 0.6, 0.8, 40 * (1 - f), FIRE, 0.4, 1 - f);
      spatula(g, bx, by, -dir * t * 30, Math.cos(t * 26), 0.95, false, Math.max(0, 1 - f * 1.2));
    },
  };
}
// THE TELL: "order up!" — two rings of a bell over him
function bell(x, y) {
  return {
    t: 0, life: 0.5,
    draw(g, t) {
      for (const [at0, s] of [[0, 1], [0.14, 1.25]]) {
        const k = (t - at0) / 0.3;
        if (k < 0 || k > 1) continue;
        blit(g, ring('#ffd34a'), x, y, (30 + 60 * k) * s, (22 + 44 * k) * s, 0, 0.9 * (1 - k));
      }
      if (t < 0.2) blit(g, glow('#ffcc33', 0.3), x, y, 60, 60, 0, 0.6 * (1 - t / 0.2));
    },
  };
}
// THE BALL COMES BACK IN (at the top of the screen, where the glint was): a gold flash (two frames,
// under a third white), a ring, the golden spatula's charred skin flying off in embers and flakes
function reveal(x, y, dir) {
  return {
    t: 0, life: 0.55,
    draw(g, t) {
      const f = t / 0.55;
      if (t < 0.034) blit(g, glow('#fff6c0', 0.5), x, y, 160, 160, 0, 0.3);
      if (t < 0.3) { const k = t / 0.3; blit(g, glow('#ffcc33', 0.2), x, y, 200 * (1 - k) + 40, 160 * (1 - k) + 30, 0, 0.7 * (1 - k)); blit(g, ring('#ffd34a'), x, y, 30 + 150 * k, 30 + 120 * k, 0, 1 - k); }
      const sp = spark('#ffe14a');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + hash(i, 6), v = 260 + hash(i, 8) * 340; blit(g, sp, x + Math.cos(a) * v * t, y + Math.sin(a) * v * t + 300 * t * t, 34 * (1 - f), 8, a, 1 - f, true, 1, 0.5); }
      // the skin's flakes: gold and charred, tumbling off
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.4, v = 140 + hash(i, 31) * 160;
        const px = x + Math.cos(a) * v * t - dir * 80 * t, py = y + Math.sin(a) * v * t + 700 * t * t, R = 5 + 3 * hash(i, 13);
        g.save(); g.globalAlpha = Math.max(0, 1 - f * 1.2); g.translate(px, py); g.rotate(t * 18 + i);
        g.fillStyle = i % 2 ? '#ffcc33' : '#3a2416'; g.strokeStyle = INK; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-R, 0); g.lineTo(0, -R * 0.6); g.lineTo(R, 0); g.lineTo(0, R * 0.5); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    },
  };
}

export default {
  id: 'volley',
  palette: ['#ff7a1a', '#ffd21a', '#e2231a', '#a3acba'],
  cutColor: '#ff6a1a',
  hideInCut: true,
  headIn: HEAD_IN, headOut: HEAD_OUT,

  // worn while armed, while his ball sits in the bun, and for the ball's first BACK_AFTER s out of it
  wears(p, m) {
    if (p.armed > 0) return true;
    const pw = m.ball && m.ball.power;
    if (!pw || pw.cp !== 'volley' || !pw.vl || pw.owner !== p.index) return false;
    if (pw.src !== pw.owner) return false;                // (a blocker throws it back as himself)
    return pw.ph === 'up' || pw.ph === 'wait' || (pw.ph === 'dive' && pw.t < BACK_AFTER);
  },

  head(g, p, s) {
    const { r, now, form, art } = s;
    if (!art) return;
    const side = s.side || 1, m = s.m, pw = m.ball && m.ball.power;
    const mine = !!(pw && pw.cp === 'volley' && pw.vl && pw.owner === p.index && pw.src === pw.owner);
    const cut = m.cutin > 0 && m.cutinBy === p.index ? C.POWER_CUTIN - m.cutin : -1;
    // the volley's clock: under the cut-in it runs up to 0 at the release
    let kk = null;
    if (form.st === 'out') kk = null;                     // (changing back: the lid shuts, the arms fold)
    else if (cut >= 0 && mine) kk = cut - RELEASE;
    else if (mine && (pw.ph === 'up' || pw.ph === 'wait' || pw.ph === 'dive')) kk = pw.vk;
    const T = form.k * (form.st === 'in' ? HEAD_IN : form.st === 'out' ? HEAD_OUT : 0);
    const sn = seen[p.index] || (seen[p.index] = { kick: -9 });

    // ── how far each part is in ──
    let armIn = 1, crownIn = 1, fireIn = 1, lid = 0, sx = 1, sy = 1, crownDrop = 0;
    if (form.st === 'in') {
      armIn = -1;                                           // per arm, below
      crownIn = clamp01((T - 0.45) / 0.12); crownDrop = 1 - easeOut(crownIn);
      fireIn = clamp01((T - 0.12) / 0.3);
      if (T < 0.15) { const e = easeOut(T / 0.15); sx = 1 + 0.08 * e; sy = 1 - 0.1 * e; }
      else if (T < 0.32) { const e = ease((T - 0.15) / 0.17); sx = 1.08 - 0.08 * e; sy = 0.9 + 0.1 * e; }
      else if (T > 0.56) { const u = (T - 0.56) / 0.09; sy = 1 + 0.06 * Math.sin(u * Math.PI); sx = 1 - 0.04 * Math.sin(u * Math.PI); }
    } else if (form.st === 'out') {
      armIn = 1 - ease((T - 0.05) / 0.25);
      crownIn = T < 0.1 ? 1 : 0;
      fireIn = 1 - ease(T / 0.3);
      lid = OPEN * (1 - easeBack(T / 0.16)) * (sn.open ? 1 : 0);
      if (T > 0.12 && T < 0.3) { const u = (T - 0.12) / 0.18; sy = 1 - 0.05 * Math.sin(u * Math.PI); }
    } else sn.open = 0;
    if (kk != null) {
      // the lid: shut while he plants, up on its hinge with an overshoot, kicked by every throw,
      // higher for the tell; open from then until he changes back
      if (kk < -1.07) lid = 0;
      else if (kk < -0.72) lid = OPEN * easeBack((kk + 1.07) / 0.35);
      else lid = OPEN;
      for (const t of L.UP) { const f = kk - t; if (f >= 0 && f < 0.08) lid += 0.06 * Math.sin((f / 0.08) * Math.PI); }
      if (kk >= L.TELL) lid += 0.16 * ease((kk - L.TELL) / 0.15);
      sn.open = 1;
      if (kk < -1.07) { const e = Math.sin(clamp01((kk + RELEASE) / 0.2) * Math.PI); sx *= 1 + 0.06 * e; sy *= 1 - 0.08 * e; }
      // the throw's recoil on the body
      for (const t of [...L.UP, L.BALL_UP]) { const f = kk - t; if (f >= 0 && f < 0.08) { const e = Math.sin((f / 0.08) * Math.PI); sy *= 1 - 0.025 * e; sx *= 1 + 0.02 * e; } }
      if (kk >= L.BALL_AT && kk < L.BALL_AT + 0.15) { const e = Math.sin(((kk - L.BALL_AT) / 0.15) * Math.PI); sy *= 1 - 0.07 * e; sx *= 1 + 0.06 * e; }
    }
    const tell = kk != null && kk >= L.TELL && kk < L.BALL_AT + 0.1 ? ease((kk - L.TELL) / 0.12) : 0;

    g.save();
    // the shared wind-up's nod taken out (the lid is his move); a small lean back as it opens
    const tilt = s.tilt - (s.cutTilt || 0) + (cut >= 0 ? -side * 0.08 * (lid / OPEN) : 0);
    g.translate(s.hx, s.hy); g.rotate(tilt);
    const feet = (C.BODY_H + C.HEAD_R - C.NECK) / C.HEAD_R * r;
    const ax = art.x, ay = art.y, aw = art.w, ah = art.h;
    const cx = artX(art, ART.mid), seamY = ay + ah * ART.seam, baseY = ay + ah * ART.base;

    // ── BEHIND HIM: the warm light, the pool on the grass, the flames breathing up his back ──
    if (fireIn > 0) {
      const br = 0.85 + 0.15 * Math.sin(now * 7.3);
      blit(g, glow('#ff7a1a', 0.2), cx, seamY, aw * 1.35 * br, ah * 1.15 * br, 0, 0.5 * fireIn + 0.25 * tell);
      blit(g, glow('#ff9a1a', 0.2), cx, feet, r * 3.6, r * 0.8, 0, 0.55 * fireIn);
      // (they stand round his outline — out past his sides and up over the bun — so they show
      // behind him rather than hide behind the burger)
      for (let i = 0; i < 7; i++) {
        const f = i / 6, x = artX(art, -0.14 + 1.28 * f), edge = Math.abs(f - 0.5) * 2;
        const h = r * (1.5 + 1.0 * (1 - edge) + 0.3 * Math.sin(now * 9 + i * 2.1)) * fireIn * (1 + 0.3 * tell);
        fire(g, x, baseY + ah * 0.04 * edge, h * (edge > 0.9 ? 0.75 : 1), now, i, 0.95);
      }
    }
    // the ignition: embers off the boots, a ring of small flames climbing to the bun
    if (form.st === 'in') {
      const sp = spark('#ffb347');
      for (let i = 0; i < 10; i++) {
        const q = clamp01((T - hash(i, 4) * 0.25) / 0.45);
        if (q <= 0 || q >= 1) continue;
        const x = (hash(i, 1) - 0.5) * r * 1.8, y = feet - q * (feet - ay * 0.6);
        blit(g, sp, x, y, r * 0.5 * (1 - q), 4, -Math.PI / 2, 1 - q, true, 1, 0.5);
      }
      const climb = ease((T - 0.15) / 0.22);
      if (T > 0.15 && T < 0.5) for (let i = 0; i < 5; i++) {
        const x = (i / 4 - 0.5) * r * 1.9, y = feet + (baseY - feet) * climb;
        fire(g, x, y, r * 0.6 * (1 - Math.max(0, (T - 0.38) / 0.12)), now, i + 3, 0.85);
      }
    }

    // ── THE ARMS (behind the burger) ──
    const arms = [];
    for (let a = 0; a < 6; a++) {
      let k = armIn;
      if (k < 0) k = easeBack(clamp01((T - 0.3 - UNFOLD.indexOf(a) * 0.035) / 0.16));
      if (k <= 0.01) continue;
      const S = [SHOULDER[a][0] * side * r, SHOULDER[a][1] * r];
      let pose;
      if (kk != null) pose = handPose(a, kk, now);
      else {
        // armed: the rest fan, a breathing bob; one at a time twirls its spatula
        const bob = Math.sin(now * 3.4 + a * 1.3) * 0.06;
        pose = { h: [REST[a][0], REST[a][1] + bob], hold: 1, gold: 0 };
      }
      const H = lerp2([SHOULDER[a][0], SHOULDER[a][1] + 0.35], pose.h, k);
      const tw = ((now * 0.9) % 6), mineTw = TWIRL[Math.floor(tw)] === a && kk == null ? (tw % 1) : 0;
      const spIn = form.st === 'in' ? clamp01((k - 0.5) / 0.5) : 1;
      arms.push({ S, H: [H[0] * side * r, H[1] * r], sp: { hold: pose.hold && spIn > 0, gold: pose.gold, spin: mineTw * TAU * side + (1 - spIn) * TAU * 1.5 * side, face: Math.cos(mineTw * TAU), s: 1.0 * (0.5 + 0.5 * spIn), now } });
    }
    for (const A of arms) arm(g, r, A.S, A.H, side, A.sp);

    // ── THE BURGER: the bottom (cheese, lettuce, patty, bun) fixed, the top bun a lid on its hinge ──
    g.save();
    g.translate(0, r * 0.9); g.scale(sx, sy); g.translate(0, -r * 0.9);
    g.save(); g.beginPath(); g.rect(ax - aw, seamY - 1, aw * 3, ah * 2); g.clip(); drawArt(g, art); g.restore();
    const open = clamp01(Math.sin(Math.max(0, lid)) / Math.sin(OPEN));
    const hx = artX(art, ART.hinge);
    if (lid > 0.02) {
      // INSIDE: a deep red hollow, the grill bars red-hot, fire licking up and lighting the lid
      const rx = aw * 0.38, ry = ah * 0.07 * (0.4 + 0.6 * open);
      g.save();
      g.fillStyle = '#2a0804'; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.06);
      g.beginPath(); g.ellipse(cx, seamY, rx, ry, 0, 0, TAU); g.fill();
      g.clip();
      g.globalCompositeOperation = 'lighter';
      blit(g, glow(tell > 0.3 ? '#ffcc33' : '#ff7a1a', 0.3), cx, seamY, rx * 2.2, ry * 3, 0, 0.9);
      g.strokeStyle = tell > 0.3 ? '#fff1a0' : '#ff8a2a'; g.lineWidth = Math.max(1.2, r * 0.05); g.globalAlpha = 0.85;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * rx * 0.36 - rx * 0.12, seamY + ry * 0.6); g.lineTo(cx + i * rx * 0.36 + rx * 0.12, seamY - ry * 0.6); g.stroke(); }
      g.restore();
      g.save(); g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.06); g.beginPath(); g.ellipse(cx, seamY, rx, ry, 0, 0, TAU); g.stroke(); g.restore();
      for (let i = 0; i < 4; i++) fire(g, cx + (i / 3 - 0.5) * rx * 1.3, seamY + ry * 0.3, r * (0.55 + 0.35 * Math.sin(now * 11 + i)) * open * (1 + 0.5 * tell), now, i + 7, 0.95);
    }
    // the lid (the top bun and his face), turned up about the back of its seam
    g.save();
    g.translate(hx, seamY); g.rotate(-side * lid); g.translate(-hx, -seamY);
    if (lid > 0.02) {
      // its underside, toasted, lit by the fire under it
      g.save();
      g.fillStyle = '#c98a4a'; g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.06);
      g.beginPath(); g.ellipse(cx, seamY, aw * 0.38, ah * 0.1 * open, 0, 0, Math.PI); g.fill(); g.stroke();
      g.globalCompositeOperation = 'lighter';
      blit(g, glow(tell > 0.3 ? '#ffcc33' : '#ff7a1a', 0.3), cx, seamY + ah * 0.04 * open, aw * 0.7, ah * 0.16 * open, 0, 0.8);
      g.restore();
    }
    g.save(); g.beginPath(); g.rect(ax - aw, ay - ah, aw * 3, seamY - (ay - ah)); g.clip(); drawArt(g, art); g.restore();
    // THE CROWN: the card's emblem, on top of the bun, wobbling in the heat
    if (crownIn > 0) {
      const cw = CR * r, wob = 0.05 * Math.sin(now * 5.3) - side * 0.1;
      const ccx = artX(art, ART.mid - 0.02), ccy = ay + ah * ART.top - cw * 0.3 - crownDrop * r * 1.3;
      const sq = form.st === 'in' && crownIn >= 1 && T < 0.62 ? Math.sin(((T - 0.57) / 0.05) * Math.PI) * 0.12 : 0;
      g.save(); g.globalAlpha = Math.min(1, crownIn * 2); g.translate(ccx, ccy + cw * 0.4); g.rotate(wob); g.scale(1 + sq, 1 - sq);
      g.drawImage(crownTex(), -cw / 2, -cw * 0.9, cw, cw);
      g.restore();
    }
    g.restore();
    g.restore();

    // ── IN FRONT: a few flame licks at his collar (never over the face), the tell's glow ──
    if (fireIn > 0) for (let i = 0; i < 3; i++) fire(g, artX(art, 0.25 + i * 0.25), baseY + ah * 0.06, r * (0.35 + 0.12 * Math.sin(now * 13 + i * 2)) * fireIn, now, i + 11, 0.7);
    // the ignition's finishing "fwoomp", the crown's landing sparks
    if (form.st === 'in' && T > 0.55) {
      const q = (T - 0.55) / 0.1;
      blit(g, glow('#ffb347', 0.25), cx, seamY, aw * (1.2 + 0.8 * q), ah * (1 + 0.6 * q), 0, 0.55 * (1 - q));
      const sp = spark('#ffe14a'), ccy = ay + ah * ART.top - CR * r * 0.1;
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 7 - 0.5) * 2.6; blit(g, sp, cx + Math.cos(a) * r * 1.3 * q, ccy + Math.sin(a) * r * 1.1 * q, r * 0.9 * (1 - q), 6, a, 1 - q, true, 1, 0.5); }
    }
    // changing back: the crown pops off in sparks, the fire goes to smoke
    if (form.st === 'out') {
      if (T > 0.08 && T < 0.35) {
        const q = (T - 0.08) / 0.27, cw = CR * r;
        g.save(); g.globalAlpha = 1 - q; g.translate(cx - side * r * 0.6 * q, ay - cw * 0.3 - r * 1.6 * q + r * 2.2 * q * q); g.rotate(-side * q * 4);
        g.drawImage(crownTex(), -cw / 2, -cw / 2, cw, cw); g.restore();
        const sp = spark('#ffe14a');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; blit(g, sp, cx + Math.cos(a) * r * q * 1.4, ay + Math.sin(a) * r * q, r * 0.8 * (1 - q), 5, a, 1 - q, true, 1, 0.5); }
      }
      if (T > 0.18) { const q = (T - 0.18) / 0.27; blit(g, smoke(1, '#5a4a40'), cx, baseY - q * r * 1.4, r * (1.4 + q * 1.4), r * (1.2 + q * 1.2), q, 0.45 * (1 - q), false); }
    }
    g.restore();

    // the cut-in: the ball popped up off the touch and dropped into the open bun
    const cutK = cut;
    if (mine && cutK >= 0.1 && cutK < 0.78 && s.ball) {
      const f = (cutK - 0.1) / 0.68, c = Math.cos(tilt), sn2 = Math.sin(tilt);
      const P0 = [side * r * 1.1, -r * 0.2], P1 = [side * r * 0.6, -r * 3.2], P2 = [cx, seamY];
      const u = ease(f), lx = (1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * P1[0] + u * u * P2[0], ly = (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * P1[1] + u * u * P2[1];
      const wx = s.hx + lx * c - ly * sn2, wy = s.hy + lx * sn2 + ly * c;
      g.save(); g.globalAlpha = 1 - clamp01((f - 0.88) / 0.12); s.ball(g, wx, wy); g.restore();
    }
  },

  // the ball, hidden all the way: going up, the big glowing spatula with the ten flung up round it;
  // above the screen, nothing; diving, the biggest glowing spatula. And the ten raining on their lines
  // (the sim's own spatAt — what is drawn is what hits), each bursting where it meets the wall.
  draw(g, b, s) {
    const pw = s.pw, now = s.now || 0;
    if (!pw.vl) return false;
    const dir = pw.dir || 1;
    if (pw.ph === 'up') {
      // the ten flung up after it, a loose column under it on fire streaks
      for (let j = 0; j < V.SPATS; j++) {
        const lag = pw.vk - L.UP[j];
        if (lag <= 0) continue;
        const x = s.x + dir * (hash(j, 3) - 0.5) * 80, y = s.y + 40 + j * 24 + 30 * (1 - Math.min(1, lag * 6));
        streak(g, x, y, 0, -1, 70, FIRE, 0.45, 0.9);
        const rot = -Math.PI / 2 + now * (18 + j);
        spatula(g, x, y, rot, 0.8 + 0.2 * Math.cos(now * 20 + j), SPAT_K * 0.85);
      }
      bigSpatula(g, s.x, s.y, 0, -1, now, 2.4);
      return true;
    }
    if (pw.ph === 'wait') return true;
    if (pw.ph === 'dive') {
      const v = Math.hypot(b.vx, b.vy) || 1;
      bigSpatula(g, s.x, s.y, b.vx / v, b.vy / v, now, 2.8);
      return true;
    }
    return false;
  },
  // THE VOLLEY (its own zone, power-zones 'cp'): the ten on their lines — the sim's own spatAt, so what
  // is drawn is what hits — each to the end of its line whatever became of the ball: stuck in the
  // grass, or a burst on the frame
  flying(g, z, s) {
    const tau = volleyClock(z), now = s.now || 0, dir = z.dir || 1;
    if (tau < 0) return;
    for (let i = 0; i < V.SPATS; i++) {
      const q = spatAt(z, i, tau);
      if (!q) continue;
      if (q.seg === 'down') {
        if (z.sp & (1 << i)) continue;                      // (it met somebody: its burst is the hit's)
        // BIG AND READABLE (Idan): blade first along its line, flat to us with a gentle wobble, a warm
        // halo and a shorter fire tail behind, so the spatula's shape reads at a glance
        const d = depthPoint(q.x, q.y), run = tau - i * V.GAP, hd = Math.atan2(q.uy, q.ux);
        streak(g, d.x - q.ux * 28, d.y - q.uy * 28, q.ux, q.uy, 150, FIRE, 0.45, 0.85);
        blit(g, glow('#ffb347', 0.25), d.x, d.y, 70, 70, 0, 0.5);
        const rot = hd + 0.35 * Math.sin(run * 18 + i * 1.7), face = 0.8 + 0.2 * Math.cos(run * 12 + i);
        spatula(g, d.x - Math.cos(rot) * C.HEAD_R * 0.95, d.y - Math.sin(rot) * C.HEAD_R * 0.95, rot, face, SPAT_K);
      } else if (!(z.sp & (1 << i))) {
        const since = tau - i * V.GAP - (q.ey - V.TOP) / V.UY / V.SPEED, d = depthPoint(q.ex, q.ey);
        if (q.kind === 'grass') stuck(g, d.x, d.y, dir, since, i); else wallBurst(g, d.x, d.y, dir, since, i);
      }
    }
    void now;
  },
  hideShadow: (pw) => !!pw.vl && (pw.ph === 'up' || pw.ph === 'wait' || pw.ph === 'dive'),

  event(e, at) {
    if (e.type === 'spatHit' || e.type === 'spatParry') {
      const d = at(e.x, e.y);
      return e.type === 'spatHit' ? spatHit(d.x, d.y, e.dir || 1, e.hits || 1) : spatParry(d.x, d.y, e.dir || 1);
    }
    if (e.type === 'volleyUp') { const d = at(e.x, e.y); return bell(d.x, d.y); }
    if (e.type === 'volleyBall') { const y = -30, d = at(e.x + (e.dir || 1) * (y - e.y) / V.TAN, y); return reveal(d.x, d.y, e.dir || 1); }
    return null;
  },

  // paint the sprites and the textures ahead of the first press, one a slice (champ-vfx
  // warmTextures runs it again while it answers false)
  warm() {
    if (!this._w) this._w = [() => spatTex(false), () => spatTex(true), () => crownTex(), () => flameBook(), ...WARM];
    const j = this._w.shift(); if (j) j();
    return this._w.length === 0;
  },
};
