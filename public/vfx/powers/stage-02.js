// WORM TUNNEL AMBUSH, drawn — the Lord of the Worms' power (what it does:
// shared/champion-powers/stage-02.js). The champion is a coiled green snake (a big hooded arch over a
// round head, two heavy-lidded yellow eyes, a smirk and a forked red tongue, a coil under her and a
// curl of tail); the card, Ori screaming in a pit of glossy brown worms with glowing red eyes, in
// green light, dirt flying. Our own art, painted in the fx-kit's way: cached sprites, soft light.
//
//   the press     SHE TURNS INTO HER WORM FORM (`head`, worn from the press to just after the burst
//                 — champ-vfx wornHead): her own face squashes down, her coils winding tight; a ripple
//                 runs up her from the coil to the crown, dirt spraying off its edge, and behind it she
//                 is a glossy brown earthworm — the same arch over the same head, the same coil and the
//                 same tail curl, now in rings with a pink saddle band, her smirk and her heavy lids
//                 kept, her eyes lit RED; she stretches tall, the rings jiggle one after another, mud
//                 drops off. Armed, the rings breathe (a wave rolling up them) and two little red-eyed
//                 worms poke out of the turf by her feet.
//   the cut-in    her own move instead of the shared wind-up's nod: she rears back and whips her head
//                 down at the turf in front of her — it cracks, and a GIANT WORM bursts up out of it,
//                 climbs and winds two coils round the ball (its white face always showing between
//                 them), squeezing, and rears back
//   the dive      at the release it plunges back into its hole with the ball, dirt fountaining
//   the tunnel    a mound of turf runs along the pitch toward the goal, the grass parting over it, a
//                 crack of soil left behind it (the zone: under the players, like the grass)
//   the ring      it stops: the mound heaves, cracks run out, a red-and-green ring glows on the grass
//                 where it will come up, red eyes glinting through the cracks
//   a stomp       KICK on the ring as it bursts smothers it (a muffled burst of dirt); only standing
//                 there, the burst throws him aside
//   the burst     the worm erupts straight up, spits THE BALL in a high arc (the real ball, a dark red
//                 rim and crumbs of soil falling off it) and sinks back into the ground
//   after         she shakes herself off like a wet dog and the ripple runs back down: the snake again
//   a fire-back   the worm comes up under the BLOCKER (no form for him), takes the ball and dives
// Client only: Math.random is fine here — nothing drawn feeds back into the sim.

import { TAU, hash, puff } from './common.js';
import { blit, glow, spark, tex } from '../fx-kit.js';
// (the engine first: the stage file is part of its registry's import cycle)
import '../../../shared/hs-powers.js';
import { WORM } from '../../../shared/champion-powers/stage-02.js';
import * as C from '../../../shared/constants.js';

export const WORM_COL = {
  hi: '#e3a37c', mid: '#a05a37', dark: '#5c2c17', deep: '#2e1308', crease: '#4a2010',
  saddle: '#e8a993', saddleD: '#a85e4f', belly: '#efc0a2',
  eye: '#ff2a1a', soil: '#4a2c18', soilL: '#7a5232', soilD: '#2a170b', grass: '#4c9636', grassL: '#8bd05e', green: '#7dff6a',
};
const INK = '#1b120d';                                   // the art's keyline
const HEAD_IN = 0.6, HEAD_OUT = 0.45;                    // s: snake → worm, worm → snake
const BACK_AFTER = 0.3;                                  // s after the burst before she changes back
const K = 3.5;                                           // sprite texels per world px
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
const outBack = (u) => { u = clamp01(u); const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

// ── the sprites (painted once) ─────────────────────────────────────────────────────────────────
// ONE RING of a worm's body: a glossy brown bead, lit from the upper left, a crease round its front
// edge (where the next ring tucks in), the keyline round it. Drawn stretched along the body.
function paintSeg(g, S, saddle) {
  const c = S / 2, R = S * 0.46;
  const rg = g.createRadialGradient(c - R * 0.32, c - R * 0.42, R * 0.08, c, c, R);
  rg.addColorStop(0, saddle ? '#ffd9c8' : WORM_COL.hi); rg.addColorStop(0.5, saddle ? WORM_COL.saddle : WORM_COL.mid); rg.addColorStop(1, saddle ? WORM_COL.saddleD : WORM_COL.dark);
  g.fillStyle = rg; g.beginPath(); g.ellipse(c, c, R, R, 0, 0, TAU); g.fill();
  // the keyline only along the body's two edges (the rings overlap into one body, scalloped)
  g.strokeStyle = INK; g.lineWidth = S * 0.06; g.lineCap = 'round';
  g.beginPath(); g.ellipse(c, c, R, R, 0, Math.PI + 0.75, TAU - 0.75); g.stroke();
  g.beginPath(); g.ellipse(c, c, R, R, 0, 0.75, Math.PI - 0.75); g.stroke();
  // the crease on the leading edge, and its lit lip
  g.strokeStyle = 'rgba(40,14,6,0.55)'; g.lineWidth = S * 0.05;
  g.beginPath(); g.ellipse(c + R * 0.42, c, R * 0.38, R * 0.86, 0, -1.25, 1.25); g.stroke();
  g.strokeStyle = 'rgba(255,220,190,0.35)'; g.lineWidth = S * 0.025;
  g.beginPath(); g.ellipse(c + R * 0.3, c, R * 0.38, R * 0.8, 0, -1.1, 0.2); g.stroke();
  // the wet shine
  g.fillStyle = 'rgba(255,255,255,0.42)';
  g.beginPath(); g.ellipse(c - R * 0.2, c - R * 0.5, R * 0.36, R * 0.13, -0.15, 0, TAU); g.fill();
}
const segTex = (v) => tex(`wmSeg${v}`, 96, 96, (g) => paintSeg(g, 96, v === 1));
// A BIG WORM'S HEAD (the card's worms), facing +x: a blunt glossy snout, rings at the back, a mouth
// slit, two eye pits (their red light is drawn live on top).
const WH = { w: 1.5, h: 1.0 };                           // in body widths
function paintWormHead(g, S) {
  const U = S / WH.w, cx = U * 0.66, cy = S * WH.h / WH.w / 2, rx = U * 0.68, ry = U * 0.46;
  const rg = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.55, U * 0.04, cx, cy, rx);
  rg.addColorStop(0, WORM_COL.hi); rg.addColorStop(0.55, WORM_COL.mid); rg.addColorStop(1, WORM_COL.dark);
  g.fillStyle = rg; g.strokeStyle = INK; g.lineWidth = U * 0.06;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(40,14,6,0.55)'; g.lineWidth = U * 0.045;
  for (const k of [-0.42, -0.2]) { g.beginPath(); g.ellipse(cx + rx * k, cy, rx * 0.22, ry * 0.92, 0, -1.3, 1.3); g.stroke(); }
  // the mouth: a dark slit round the snout's tip, lips catching the light
  g.strokeStyle = WORM_COL.deep; g.lineWidth = U * 0.07; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx + rx * 0.35, cy + ry * 0.32); g.quadraticCurveTo(cx + rx * 0.82, cy + ry * 0.36, cx + rx * 0.97, cy + ry * 0.05); g.stroke();
  // two eye pits
  g.fillStyle = WORM_COL.deep;
  for (const [ex, ey] of [[0.38, -0.36], [0.64, -0.3]]) { g.beginPath(); g.ellipse(cx + rx * ex, cy + ry * ey, U * 0.1, U * 0.08, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.ellipse(cx - rx * 0.1, cy - ry * 0.62, rx * 0.32, ry * 0.12, -0.1, 0, TAU); g.fill();
}
const wormHeadTex = () => tex('wmHead', 144, 96, (g) => paintWormHead(g, 144));
// the two red eyes of a big worm's head at (x, y), facing angle a, w its body width
function wormEyes(g, x, y, a, w, k = 1, now = 0) {
  const ca = Math.cos(a), sa = Math.sin(a), f = 0.85 + 0.15 * Math.sin(now * 13);
  for (const [ex, ey] of [[0.38, -0.36], [0.64, -0.3]]) {
    const lx = (0.66 - 0.75 + ex * 0.68) * w, ly = ey * 0.46 * w;
    const px = x + ca * lx - sa * ly, py = y + sa * lx + ca * ly;
    blit(g, glow(WORM_COL.eye, 0.3), px, py, w * 0.9 * f, w * 0.9 * f, 0, 0.75 * k);
    blit(g, glow('#ffd8b0', 0.6), px, py, w * 0.22, w * 0.22, 0, k);
  }
}
// a soil clod (a rough dark lump with a lit top)
function paintClod(g, S) {
  g.fillStyle = WORM_COL.soilD;
  g.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = S * (0.36 + 0.1 * hash(i, 5)); g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.fillStyle = WORM_COL.soilL; g.beginPath(); g.ellipse(S * 0.45, S * 0.4, S * 0.2, S * 0.11, -0.3, 0, TAU); g.fill();
}
const clodTex = () => tex('wmClod', 32, 32, (g) => paintClod(g, 32));

// ── a worm body: rings blitted along a spine ───────────────────────────────────────────────────
// Catmull–Rom through `P` ({x, y}), `n` points evenly in the parameter, each with its heading
function spline(P, n) {
  const out = [];
  const m = P.length - 1;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * m, k = Math.min(m - 1, Math.floor(u)), t = u - k;
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(m, k + 2)];
    const t2 = t * t, t3 = t2 * t;
    const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    out.push({ x, y, a: 0 });
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    out[i].a = Math.atan2(b.y - a.y, b.x - a.x);
  }
  return out;
}
// points every `step` px along the polyline `pts` (each with its heading) — so a body has as many
// rings as its length, whatever its control points
function along(pts, step) {
  const out = [];
  if (pts.length < 2) return pts.slice();
  let carry = 0;
  out.push({ x: pts[0].x, y: pts[0].y, a: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), z: pts[0].z });
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < 1e-6) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    let t = step - carry;
    while (t <= d) { const f = t / d; out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, a, z: f < 0.5 ? p.z : q.z, f: (i - 1 + f) / (pts.length - 1) }); t += step; }
    carry = d - (t - step);
  }
  return out;
}
// the rings along `pts` (tail first → head last), w(f) its width at f (0 tail → 1 head), `sad` the
// saddle band's f: a dark underbody first (the body's outline, unbroken), the glossy rings over it
function rings(g, pts, w, sad = -1, alpha = 1) {
  const s0 = segTex(0), s1 = segTex(1);
  const n = pts.length;
  if (!n) return;
  g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  // (one path, two strokes: the outline and the shade between the rings)
  const wm = w(0.5);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokeStyle = INK; g.lineWidth = wm * 1.02; g.stroke();
  g.strokeStyle = WORM_COL.dark; g.lineWidth = wm * 0.84; g.stroke();
  for (let i = 0; i < n; i++) {
    const p = pts[i], f = p.f ?? i / Math.max(1, n - 1), W = w(f);
    if (!(W > 0.5)) continue;
    const L = W * 0.78, c = Math.cos(p.a), sn = Math.sin(p.a);
    g.save(); g.transform(c, sn, -sn, c, p.x, p.y);
    g.drawImage(sad >= 0 && Math.abs(f - sad) < 0.06 ? s1 : s0, -L / 2, -W / 2, L, W);
    g.restore();
  }
  g.restore();
}
// a small worm as one path (the ailment's coils, the armed worms): the body, its rings, its shine
export function wormTube(g, pts, w0, now, amp = 0) {
  if (pts.length < 2) return;
  const P = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], c = pts[Math.max(0, i - 1)];
    let ux = b.x - c.x, uy = b.y - c.y; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
    const off = amp ? Math.sin(i * 0.9 - now * 12) * amp * Math.min(1, i / 3) : 0;
    P.push({ x: a.x - uy * off, y: a.y + ux * off, nx: -uy, ny: ux });
  }
  const W = (i) => w0 * (1 - 0.45 * (i / (P.length - 1))) / 2;
  const outline = (k) => {
    g.beginPath();
    for (let i = 0; i < P.length; i++) g.lineTo(P[i].x + P[i].nx * W(i) * k, P[i].y + P[i].ny * W(i) * k);
    for (let i = P.length - 1; i >= 0; i--) g.lineTo(P[i].x - P[i].nx * W(i) * k, P[i].y - P[i].ny * W(i) * k);
    g.closePath();
  };
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = INK; outline(1.3); g.fill();
  g.fillStyle = WORM_COL.mid; outline(1); g.fill();
  g.strokeStyle = WORM_COL.hi; g.lineWidth = Math.max(1, w0 * 0.22);
  g.beginPath(); for (let i = 0; i < P.length; i++) g.lineTo(P[i].x - P[i].nx * W(i) * 0.4, P[i].y - P[i].ny * W(i) * 0.4); g.stroke();
  g.strokeStyle = 'rgba(40,14,6,0.6)'; g.lineWidth = Math.max(0.8, w0 * 0.1);
  g.beginPath();
  for (let i = 1; i < P.length - 1; i++) { const q = P[i]; g.moveTo(q.x + q.nx * W(i) * 0.9, q.y + q.ny * W(i) * 0.9); g.lineTo(q.x - q.nx * W(i) * 0.9, q.y - q.ny * W(i) * 0.9); }
  g.stroke();
  g.restore();
}
// a little red-eyed worm standing out of the turf at (x, gy): `k` how far out, `sway` its lean
function littleWorm(g, x, gy, h, w, k, sway, now) {
  if (k <= 0.02) return;
  const H = h * k, pts = [];
  for (let i = 0; i <= 6; i++) { const f = i / 6; pts.push({ x: x + sway * f * f + Math.sin(now * 5 + f * 3) * w * 0.25 * f, y: gy - H * f }); }
  pts.reverse();
  wormTube(g, pts, w, now, 0);
  const t = pts[0];
  // its blunt head
  g.fillStyle = WORM_COL.mid; g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.14);
  g.beginPath(); g.ellipse(t.x, t.y, w * 0.62, w * 0.52, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,230,210,0.5)'; g.beginPath(); g.ellipse(t.x - w * 0.15, t.y - w * 0.22, w * 0.25, w * 0.1, 0, 0, TAU); g.fill();
  blit(g, glow(WORM_COL.eye, 0.3), t.x + sway * 0.05, t.y + w * 0.05, w * 1.6, w * 1.6, 0, 0.85 * k);
  g.fillStyle = '#ffcfb0'; g.beginPath(); g.arc(t.x + Math.sign(sway || 1) * w * 0.12, t.y, Math.max(0.8, w * 0.13), 0, TAU); g.fill();
  // the crack it came out of
  g.strokeStyle = WORM_COL.soilD; g.lineWidth = 1.4; g.globalAlpha = 0.9;
  g.beginPath(); g.moveTo(x - w * 1.3, gy + 1); g.lineTo(x - w * 0.4, gy - 0.5); g.lineTo(x + w * 0.5, gy + 0.6); g.lineTo(x + w * 1.4, gy); g.stroke();
  g.globalAlpha = 1;
}

// ── HER WORM FORM, in her picture's own frame (u across, v down, 0–1; facing +u) ────────────────
// Read off the drawn snake (public/img/chars/legendary-2): the arch of her hood over the head, the
// head (its eyes and smirk where hers are), the coil under her, the tail curling up at the front.
const ARCH = [[0.24, 0.7], [0.12, 0.5], [0.15, 0.27], [0.3, 0.12], [0.5, 0.085], [0.68, 0.13], [0.79, 0.24]];
const ARCH_W0 = 0.27, ARCH_W1 = 0.22, SADDLE = 0.38;
const HEADF = { cx: 0.64, cy: 0.395, rx: 0.33, ry: 0.205 };
const COILF = { cx: 0.52, cy: 0.745, rx: 0.43, ry: 0.098 };
const EYES = [[0.512, 0.36], [0.72, 0.348]];

// The coil she sits on and her head with her face, each painted once at the frame's size (W × H px)
function paintCoil(g, W, H, k) {
  g.scale(k, k);
  const cx = COILF.cx * W, cy = COILF.cy * H, rx = COILF.rx * W, ry = COILF.ry * H;
  const rg = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  rg.addColorStop(0, WORM_COL.hi); rg.addColorStop(0.45, WORM_COL.mid); rg.addColorStop(1, WORM_COL.dark);
  g.fillStyle = rg; g.strokeStyle = INK; g.lineWidth = W * 0.022;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
  // ring creases round its front, bending with the coil
  g.strokeStyle = 'rgba(40,14,6,0.55)'; g.lineWidth = W * 0.012;
  for (let i = 1; i < 9; i++) {
    const x = cx - rx + (i / 9) * 2 * rx, f = Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    g.beginPath(); g.moveTo(x - W * 0.008, cy - ry * 0.15 * f); g.quadraticCurveTo(x + W * 0.018, cy + ry * 0.4 * f, x - W * 0.004, cy + ry * 0.92 * f); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath(); g.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.35, ry * 0.18, 0, 0, TAU); g.fill();
}
function paintFace(g, W, H, k) {
  g.scale(k, k);
  const cx = HEADF.cx * W, cy = HEADF.cy * H, rx = HEADF.rx * W, ry = HEADF.ry * H;
  // the head: a blunt glossy worm's head where hers is, its snout to the front
  const rg = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.6, W * 0.02, cx, cy, rx * 1.05);
  rg.addColorStop(0, WORM_COL.hi); rg.addColorStop(0.55, WORM_COL.mid); rg.addColorStop(1, WORM_COL.dark);
  g.fillStyle = rg; g.strokeStyle = INK; g.lineWidth = W * 0.024;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
  // her pale underside (the art's light jaw), pink now
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx - W * 0.012, ry - W * 0.012, 0, 0, TAU); g.clip();
  g.fillStyle = WORM_COL.belly; g.beginPath(); g.ellipse(cx + rx * 0.08, cy + ry * 0.95, rx * 0.95, ry * 0.5, 0, 0, TAU); g.fill();
  // rings round the back of the head
  g.strokeStyle = 'rgba(40,14,6,0.5)'; g.lineWidth = W * 0.014;
  for (const kx of [-0.78, -0.6]) { g.beginPath(); g.ellipse(cx + rx * kx, cy, rx * 0.16, ry * 1.05, 0, -1.4, 1.4); g.stroke(); }
  // mud caked on her crown, a few crumbs in it
  g.fillStyle = WORM_COL.soil;
  g.beginPath(); g.moveTo(cx - rx * 0.55, cy - ry * 0.85);
  g.quadraticCurveTo(cx - rx * 0.1, cy - ry * 1.25, cx + rx * 0.3, cy - ry * 0.95);
  g.quadraticCurveTo(cx + rx * 0.15, cy - ry * 0.7, cx - rx * 0.05, cy - ry * 0.78);
  g.quadraticCurveTo(cx - rx * 0.3, cy - ry * 0.62, cx - rx * 0.55, cy - ry * 0.85); g.fill();
  g.fillStyle = WORM_COL.soilL;
  for (const [x, y] of [[-0.3, -0.88], [-0.05, -0.92], [0.15, -0.88]]) { g.beginPath(); g.arc(cx + rx * x, cy + ry * y, W * 0.009, 0, TAU); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.38)';
  g.beginPath(); g.ellipse(cx - rx * 0.15, cy - ry * 0.55, rx * 0.3, ry * 0.08, -0.05, 0, TAU); g.fill();
  // HER FACE, where it is on her art: the heavy lids and brows, the smirk, the two nostrils
  for (const [i, [u, v]] of EYES.entries()) {
    const ex = u * W, ey = v * H, ew = W * 0.075, eh = H * 0.058;
    g.fillStyle = '#fff1d6'; g.strokeStyle = INK; g.lineWidth = W * 0.012;
    g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, TAU); g.fill(); g.stroke();
    // the red iris and its slit (lit live: wormForm)
    g.fillStyle = '#c4140c'; g.beginPath(); g.ellipse(ex + W * 0.012, ey + eh * 0.12, ew * 0.55, eh * 0.78, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(ex + W * 0.014, ey + eh * 0.15, ew * 0.13, eh * 0.66, 0, 0, TAU); g.fill();
    // the sly lid over its top half (her own look), its rim, and the brow over it
    g.fillStyle = WORM_COL.dark; g.beginPath(); g.ellipse(ex, ey, ew * 1.02, eh * 1.02, 0, Math.PI + 0.05, TAU - 0.05); g.lineTo(ex + ew, ey - eh * 0.1); g.lineTo(ex - ew, ey - eh * 0.05); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = W * 0.013; g.beginPath(); g.moveTo(ex - ew, ey - eh * 0.05); g.lineTo(ex + ew, ey - eh * 0.12); g.stroke();
    g.lineWidth = W * 0.026; g.lineCap = 'round';
    g.beginPath(); if (i === 0) { g.moveTo(ex - ew * 1.2, ey - eh * 1.55); g.lineTo(ex + ew * 0.9, ey - eh * 1.05); } else { g.moveTo(ex - ew * 0.9, ey - eh * 1.0); g.lineTo(ex + ew * 1.15, ey - eh * 1.6); } g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + W * 0.022, ey - eh * 0.0, W * 0.009, 0, TAU); g.fill();
  }
  g.strokeStyle = INK; g.lineWidth = W * 0.018; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0.565 * W, 0.462 * H); g.quadraticCurveTo(0.6 * W, 0.49 * H, 0.7 * W, 0.488 * H); g.quadraticCurveTo(0.84 * W, 0.483 * H, 0.95 * W, 0.468 * H); g.stroke();
  g.fillStyle = INK;
  for (const [u, v] of [[0.85, 0.372], [0.885, 0.39]]) { g.beginPath(); g.ellipse(u * W, v * H, W * 0.011, H * 0.008, 0.3, 0, TAU); g.fill(); }
}
const formTex = (W, H) => ({
  coil: tex(`wmCoil${Math.round(W)}x${Math.round(H)}`, W * K, H * K, (g) => paintCoil(g, W, H, K)),
  face: tex(`wmFace${Math.round(W)}x${Math.round(H)}`, W * K, H * K, (g) => paintFace(g, W, H, K)),
});

// her picture's frame round the head's centre (headArt), or one like it while it loads
const frameOf = (art, r) => (art ? { x: art.x, y: art.y, w: art.w, h: art.h } : { x: -1.43 * r, y: -1.52 * r, w: 2.86 * r, h: 2.82 * r });
// her own face from the game's head (champ-vfx headArt), as the DOM head lays it out
function drawArt(g, art) {
  if (!art.flip) { g.drawImage(art.img, art.x, art.y, art.w, art.h); return; }
  g.save(); g.translate(art.x + art.w / 2, 0); g.scale(-1, 1);
  g.drawImage(art.img, -art.w / 2, art.y, art.w, art.h);
  g.restore();
}

// THE WORM FORM, drawn in local frame px (origin = the frame's top-left, facing +x), posed by `o`:
//   rip    the peristaltic wave's phase (rad), amp its size; jig the follow-through's jiggle (0–1)
//   eye    how lit her red eyes are (0–1); tongue 0–1; bob the head's own nod (px)
function wormForm(g, W, H, o) {
  const T = formTex(W, H), now = o.now;
  // the tail curling up at the front of the coil (behind the coil's front edge)
  const tail = [{ x: 0.95 * W, y: 0.6 * H }, { x: 0.94 * W, y: 0.68 * H }, { x: 0.88 * W, y: 0.75 * H }, { x: 0.82 * W, y: 0.77 * H }];
  const tw = Math.sin(now * 2.3) * W * 0.01;
  tail[0].x += tw; tail[1].x += tw * 0.6;
  wormTube(g, tail, W * 0.085, now, 0);
  // the arch: her hood, in rings, breathing
  const P = ARCH.map(([u, v], i) => {
    const f = i / (ARCH.length - 1);
    const j = o.jig ? Math.sin(now * 26 - i * 0.9) * o.jig * W * 0.025 * (0.3 + f) : 0;
    return { x: u * W + j, y: v * H - j * 0.6 };
  });
  const pts = along(spline(P, 24), W * 0.1);
  rings(g, pts, (f) => {
    const base = (ARCH_W0 + (ARCH_W1 - ARCH_W0) * f) * W;
    return base * (1 + (o.amp || 0) * Math.sin((o.rip || 0) - f * 9));
  }, SADDLE);
  // the coil, in front of the arch's root
  g.drawImage(T.coil, 0, 0, W, H);
  // the head and her face, nodding on its own
  g.save(); g.translate(0, o.bob || 0);
  g.drawImage(T.face, 0, 0, W, H);
  // her eyes lit red (the card's worms' glow)
  if (o.eye > 0) {
    const f = 0.85 + 0.15 * Math.sin(now * 9);
    for (const [u, v] of EYES) {
      blit(g, glow(WORM_COL.eye, 0.25), u * W + W * 0.012, v * H + H * 0.008, W * 0.24 * f, W * 0.2 * f, 0, 0.7 * o.eye);
      blit(g, glow('#ffb08a', 0.6), u * W + W * 0.012, v * H + H * 0.012, W * 0.06, W * 0.07, 0, 0.8 * o.eye);
    }
  }
  // the forked tongue, flicking out of the smirk's end now and then
  const fl = (o.tongue ?? 1) * Math.max(0, Math.sin(now * 3.1) * 1.6 - 0.6) * W * 0.09;
  if (fl > 0.5) {
    const x0 = 0.95 * W, y0 = 0.47 * H, tx = x0 + fl;
    g.strokeStyle = '#e8203a'; g.lineWidth = W * 0.018; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, y0); g.lineTo(tx + W * 0.025, y0 - H * 0.02); g.moveTo(tx, y0); g.lineTo(tx + W * 0.025, y0 + H * 0.02); g.stroke();
  }
  // the dents a hit leaves (the DOM head's bruises, while she is a worm)
  for (let i = 0; i < Math.min(4, o.hurt | 0); i++) {
    const [u, v] = [[0.47, 0.5], [0.78, 0.25], [0.6, 0.55], [0.86, 0.43]][i];
    g.fillStyle = 'rgba(60,8,12,0.5)'; g.beginPath(); g.ellipse(u * W, v * H, W * 0.03, H * 0.02, 0.3, 0, TAU); g.fill();
  }
  g.restore();
  // the card's green light from below
  blit(g, glow(WORM_COL.green, 0.15), 0.52 * W, 0.86 * H, W * 0.9, H * 0.28, 0, 0.18);
}

// the ripple's edge at frame height y (local px): a band of dirt spraying off it and a green-lit line
function rippleEdge(g, W, y, k, now) {
  const cl = clodTex();
  blit(g, glow(WORM_COL.green, 0.25), W * 0.52, y, W * 1.05, W * 0.16, 0, 0.55 * k);
  for (let i = 0; i < 7; i++) {
    const u = 0.1 + 0.12 * i + 0.03 * Math.sin(now * 20 + i), j = Math.sin(now * 31 + i * 2.3) * W * 0.02;
    const s = W * (0.045 + 0.025 * hash(i, 3));
    g.save(); g.globalAlpha = k; g.translate(u * W, y + j); g.rotate(now * 6 + i);
    g.drawImage(cl, -s / 2, -s / 2, s, s); g.restore();
  }
}

// ── the head (worn) ─────────────────────────────────────────────────────────────────────────────
// her own move under the cut-in instead of the shared nod (s into the cut-in → radians, + = reared
// back): back, a whip down at the turf in front (the worm bursts there at ~0.3 s), held pointing at
// it while the worm climbs and coils, then up level — well before the release (1.27 s)
function cutTiltOf(c) {
  if (c < 0.2) return 0.32 * ease(c / 0.2);
  if (c < 0.31) { const u = ease((c - 0.2) / 0.11); return 0.32 - 0.82 * u; }
  if (c < 0.78) return -0.5 + 0.04 * Math.sin((c - 0.31) * 18) * (1 - (c - 0.31) / 0.47);
  if (c < 1.1) { const u = ease((c - 0.78) / 0.32); return -0.5 * (1 - u) + 0.06 * Math.sin(Math.PI * u); }
  return 0;
}
// per player: the client's own clocks (when the arm was first seen, for the armed worms' rise)
const seen = [{ arm: -9, last: -9 }, { arm: -9, last: -9 }];

// ── the giant worm (the cut-in's grab, a fire-back's, the dive) ──────────────────────────────────
// a coil wound round the ball at (bx, by): `turns` of it, its points in world px with a depth sign
function coilPts(bx, by, br, dir, turns, squeeze, n) {
  const pts = [], R = br * (1.42 - 0.12 * squeeze);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), a = Math.PI * 0.62 + dir * f * turns * TAU;
    // a helix seen from the side: round the ball, creeping up it as it winds
    pts.push({ x: bx + Math.cos(a) * R * dir, y: by + Math.sin(a) * R * 0.62 + br * (0.55 - 1.1 * f), z: Math.sin(a), a: 0 });
  }
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; pts[i].a = Math.atan2(b.y - a.y, b.x - a.x); }
  return pts;
}
// THE GRAB: the worm out of its hole at (hx, gy), up beside the ball and round it. `k` 0→1: 0–0.45
// it climbs out (the head leading), 0.45–1 it winds round the ball; `sq` its squeeze (0–1); `lean`
// px its column leans back (the rear before the dive); `sink` 0→1 how far into the ground it is
// (the dive: the ball goes with it). `ballFn` paints the ball where it is.
function grabWorm(g, o) {
  const { hx, gy, bx, by, br, dir, k, now } = o, W = br * 1.5;
  const climb = ease(k / 0.45), wind = ease((k - 0.45) / 0.55);
  const coil = wind > 0 ? coilPts(bx, by, br, dir, 1.35 * wind, o.sq || 0, Math.max(2, Math.round(4 + 14 * wind))) : [];
  // the column: from under the grass up to where the coil starts (or, still climbing, to its head)
  const top = coil.length ? coil[0] : { x: bx - dir * br * 1.3, y: by + br * 0.9 };
  const lean = o.lean || 0;
  const colTop = { x: hx + (top.x - hx) * climb - dir * lean, y: gy + (top.y - gy) * climb };
  const C0 = [{ x: hx + dir * 4, y: gy + W }, { x: hx, y: gy - W * 0.2 }, { x: (hx + colTop.x) / 2 - dir * W * 0.5 * climb - dir * lean * 0.5, y: (gy + colTop.y) / 2 }, colTop];
  const ctrl = spline(C0, 10).map((q) => ({ ...q, z: 1 })).concat(coil.slice(1));
  const pts = along(ctrl, W * 0.42);
  if (pts.length < 2) return;
  const wOf = (f) => W * (1 - 0.16 * clamp01((f - 0.5) * 2));
  g.save();
  // nothing of it (nor the ball) shows under the grass
  g.beginPath(); g.rect(-400, -2000, C.W + 800, gy + 2000 + 1); g.clip();
  // the coil's back runs behind the ball, its front runs over it (the ball's face shows between)
  const runs = (front) => { const out = []; let cur = null; for (const q of pts) { const f = !(q.z < 0); if (f === front) { if (!cur) out.push(cur = []); cur.push(q); } else cur = null; } return out; };
  for (const r of runs(false)) rings(g, r, wOf);
  if (o.ballFn) o.ballFn(g, bx, by);
  for (const r of runs(true)) rings(g, r, wOf, 0.2);
  // the head at the end of it, big and blunt, eyes lit, looking along it
  const h = pts[pts.length - 1], hw = W * 1.3;
  g.save(); g.translate(h.x, h.y); g.rotate(h.a);
  g.drawImage(wormHeadTex(), -hw * 0.75, -hw * 0.5, hw * WH.w, hw * WH.h); g.restore();
  wormEyes(g, h.x, h.y, h.a, hw, 1, now);
  g.restore();
  // the hole it came out of, a dirt rim round it (over its root)
  g.fillStyle = WORM_COL.soilD; g.beginPath(); g.ellipse(hx, gy + 1, W * 1.05, W * 0.28, 0, 0, TAU); g.fill();
  g.fillStyle = WORM_COL.soil;
  for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; g.beginPath(); g.arc(hx + Math.cos(a) * W * 1.15, gy + 1 + Math.sin(a) * W * 0.25, W * 0.18, 0, TAU); g.fill(); }
}
// the dirt it throws up as it bursts out of the turf (a fixed spray laid out by hash, `t` s in)
function spray(g, x, gy, t, n, R, up, salt = 0) {
  if (t < 0 || t > 0.7) return;
  const cl = clodTex();
  g.save();
  for (let i = 0; i < n; i++) {
    const h1 = hash(i, 11 + salt), h2 = hash(i, 23 + salt), a = -Math.PI / 2 + (h1 - 0.5) * 2.2, v = up * (0.55 + 0.6 * h2);
    const px = x + Math.cos(a) * v * t, py = gy + Math.sin(a) * v * t + 900 * t * t;
    if (py > gy + 4) continue;
    const s = R * (0.5 + 0.7 * hash(i, 31 + salt));
    g.globalAlpha = Math.max(0, 1 - t / 0.7);
    g.save(); g.translate(px, py); g.rotate(t * (8 + 6 * h1)); g.drawImage(cl, -s / 2, -s / 2, s, s); g.restore();
  }
  g.restore();
  if (t < 0.3) puff(g, x, gy - 4, 14 + t * 90, '#8a6a4a', 0.35 * (1 - t / 0.3));
  g.globalAlpha = 1;
}

// ── the pitch pieces (the burrow zone, under the players) ──────────────────────────────────────
// the mound of turf over the tunnelling worm at (x, gy): `h` its height, `heave` 0–1 its swell
function mound(g, x, gy, w, h, now, heave = 0) {
  const H = h * (1 + 0.12 * Math.sin(now * (14 + 16 * heave)) + 0.5 * heave), Wd = w * (1 + 0.25 * heave);
  blit(g, glow('#000000', 0.2), x, gy + 2, Wd * 1.5, H * 0.9, 0, 0.35, false);
  // the dome: grass over it, its top split, soil showing
  const rg = g.createLinearGradient(0, gy - H, 0, gy);
  rg.addColorStop(0, WORM_COL.grassL); rg.addColorStop(1, WORM_COL.grass);
  g.fillStyle = rg; g.strokeStyle = 'rgba(20,40,10,0.7)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(x - Wd / 2, gy + 1); g.bezierCurveTo(x - Wd * 0.32, gy - H * 1.25, x + Wd * 0.32, gy - H * 1.25, x + Wd / 2, gy + 1); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = WORM_COL.soil;
  g.beginPath(); g.moveTo(x - Wd * 0.26, gy - H * 0.62);
  for (let i = 1; i <= 6; i++) { const f = i / 6; g.lineTo(x - Wd * 0.26 + Wd * 0.52 * f, gy - H * (0.82 + 0.12 * Math.sin(f * 9 + now * 3)) - (i % 2 ? 2 : -1)); }
  g.lineTo(x + Wd * 0.22, gy - H * 0.55); g.quadraticCurveTo(x, gy - H * 0.7, x - Wd * 0.26, gy - H * 0.62); g.fill();
  // grass blades parting off its shoulders
  g.strokeStyle = WORM_COL.grassL; g.lineWidth = 1.4; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, f = (i % 3) / 3, bx = x + s * Wd * (0.28 + 0.2 * f), by = gy - H * (0.7 - 0.5 * f);
    const sw = Math.sin(now * 11 + i) * 1.5;
    g.moveTo(bx, by); g.lineTo(bx + s * (5 + 3 * f) + sw, by - 5 - 2 * f);
  }
  g.stroke();
}
// a crack in the turf from (x0) to (x1) at gy: a soil seam that zigzags, `a` its strength
function seam(g, x0, x1, gy, a, salt, wd = 2.4) {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 14));
  g.save(); g.globalAlpha = a; g.strokeStyle = WORM_COL.soilD; g.lineWidth = wd; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= n; i++) { const f = i / n; g.lineTo(x0 + (x1 - x0) * f, gy - 1 + (hash(i, salt) - 0.5) * 3.5); }
  g.stroke();
  g.strokeStyle = WORM_COL.soilL; g.lineWidth = wd * 0.4;
  g.beginPath();
  for (let i = 0; i <= n; i++) { const f = i / n; g.lineTo(x0 + (x1 - x0) * f, gy - 2 + (hash(i, salt) - 0.5) * 3.5); }
  g.stroke();
  g.restore();
}
// cracks running out from (x, gy), `k` how far they have run, longer toward the goal (dir)
function cracks(g, x, gy, R, k, dir, a = 1) {
  if (k <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = WORM_COL.soilD; g.lineWidth = 2.6; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const s = i < 4 ? dir : -dir, f = i % 4 / 4, L = R * k * (s === dir ? 1.15 + 0.3 * f : 0.75 + 0.2 * f);
    g.moveTo(x + s * R * 0.25, gy);
    for (let j = 1; j <= 3; j++) { const q = j / 3; g.lineTo(x + s * (R * 0.25 + L * q), gy + (f - 0.4) * 5 * q + (hash(i * 3 + j, 61) - 0.5) * 3); }
  }
  g.stroke(); g.restore();
}
// the ring where it will come up: a red rim on the grass in a green glow, quickening
function ringAt(g, x, gy, R, k, now, a = 1) {
  if (a <= 0) return;
  const p = 0.5 + 0.5 * Math.sin(now * (9 + 18 * k)), rx = R, ry = R * 0.3;
  blit(g, glow(WORM_COL.green, 0.2), x, gy, rx * 3.2, ry * 5, 0, (0.5 + 0.35 * p) * a);
  blit(g, glow('#ff3a22', 0.2), x, gy, rx * 2.2, ry * 2.6, 0, (0.25 + 0.2 * p) * a);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = (0.65 + 0.35 * p) * a; g.strokeStyle = '#ff3a22'; g.lineWidth = 3.5 + 1.5 * p;
  g.beginPath(); g.ellipse(x, gy, rx, ry, 0, 0, TAU); g.stroke();
  g.globalAlpha = 0.5 * a; g.strokeStyle = '#ffd0a8'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(x, gy, rx * (0.96 - 0.05 * p), ry * (0.96 - 0.05 * p), 0, 0, TAU); g.stroke();
  g.restore();
}
// THE BURST: the worm shooting up out of the ring (it has spat the ball by 0.06 s), then sinking back
function burstWorm(g, x, gy, sk, dir, now) {
  if (sk > 0.62) return;
  const W = C.HEAD_R * 0.9, Hmax = C.HEAD_R * 3.4;
  const up = sk < 0.07 ? outBack(sk / 0.07) : 1, sink = ease((sk - 0.22) / 0.4);
  const H = Hmax * up * (1 - sink);
  if (H < 2) return;
  const squash = sk > 0.05 && sk < 0.17 ? Math.sin(Math.PI * (sk - 0.05) / 0.12) : 0;
  const lean = dir * W * 0.9 * (1 - sink);
  const P = [{ x, y: gy + W }, { x: x + lean * 0.1, y: gy - H * 0.3 }, { x: x + lean * 0.5, y: gy - H * 0.7 }, { x: x + lean, y: gy - H }];
  const pts = along(spline(P, 10), W * 0.42);
  if (pts.length < 2) return;
  g.save(); g.beginPath(); g.rect(x - 300, gy - 400, 600, 400 + 1); g.clip();
  rings(g, pts, (f) => W * (1 + 0.1 * Math.sin(now * 20 - f * 8)), 0.55);
  const h = pts[pts.length - 1], hw = W * (1.3 + 0.25 * squash);
  g.save(); g.translate(h.x, h.y); g.rotate(h.a); g.scale(1 - 0.2 * squash, 1 + 0.25 * squash);
  g.drawImage(wormHeadTex(), -hw * 0.75, -hw * 0.5, hw * WH.w, hw * WH.h);
  // the mouth wide open at the spit
  if (sk < 0.2) { const o = Math.sin(Math.PI * Math.min(1, sk / 0.2)); g.fillStyle = '#3a0a06'; g.beginPath(); g.ellipse(hw * 0.68, 0, hw * 0.16 * o, hw * 0.3 * o, 0, 0, TAU); g.fill(); }
  g.restore();
  wormEyes(g, h.x, h.y, h.a, hw, 1, now);
  g.restore();
}

// ── the ball's own burst bursts ─────────────────────────────────────────────────────────────────
function clodBurst(x, gy, { n = 12, up = 520, R = 8, life = 0.7, flash = 0, salt = 0 } = {}) {
  const bits = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = up * (0.5 + 0.6 * Math.random());
    bits.push({ x, y: gy - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: R * (0.5 + 0.8 * Math.random()), r: Math.random() * TAU, w: (Math.random() - 0.5) * 18, grass: i % 4 === 0 });
  }
  return {
    t: 0, life,
    step(dt) { for (const q of bits) { q.vy += 1300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.w * dt; if (q.y > gy) { q.y = gy; q.vy *= -0.25; q.vx *= 0.6; } } },
    draw(g, t) {
      const f = t / life, cl = clodTex();
      if (flash && t < 2 / 60) blit(g, glow('#fff0d8', 0.5), x, gy - 10, flash * 2.2, flash, 0, 0.3);
      if (t < 0.35) puff(g, x, gy - 6, 18 + t * 150 * (R / 8), '#8a6a4a', 0.45 * (1 - t / 0.35));
      g.save();
      g.globalAlpha = Math.max(0, 1 - f * f);
      for (const q of bits) {
        if (q.grass) { g.strokeStyle = WORM_COL.grassL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + Math.cos(q.r) * q.s, q.y + Math.sin(q.r) * q.s); g.stroke(); continue; }
        g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.drawImage(cl, -q.s / 2, -q.s / 2, q.s, q.s); g.restore();
      }
      g.restore(); g.globalAlpha = 1;
    },
  };
}

export default {
  id: 'wormtunnel',
  palette: [WORM_COL.mid, WORM_COL.eye, WORM_COL.green, WORM_COL.soil],
  cutColor: '#8cff5a',
  hideInCut: true,
  headIn: HEAD_IN, headOut: HEAD_OUT,

  // worn while armed, while her worm has the ball (her own; a blocker sending it back has no form),
  // and for BACK_AFTER s after it spits it
  wears(p, m) {
    if (p.armed > 0) return true;
    const pw = m.ball && m.ball.power;
    if (!pw || pw.cp !== 'wormtunnel' || pw.owner !== p.index || pw.src !== pw.owner) return false;
    return pw.ph !== 'fly' || pw.t < BACK_AFTER;
  },

  head(g, p, s) {
    const { r, now, form, art } = s;
    const T = form.k * (form.st === 'in' ? HEAD_IN : form.st === 'out' ? HEAD_OUT : 0);
    const m = s.m, cut = m.cutin > 0 && m.cutinBy === p.index ? C.POWER_CUTIN - m.cutin : -1;
    const F = frameOf(art, r), W = F.w, H = F.h, flip = s.side < 0;
    g.save();
    // the shared wind-up's nod taken out; her own move in — about the coil's foot
    const tilt = s.tilt - (s.cutTilt || 0) + (cut >= 0 ? -s.side * cutTiltOf(cut) : 0);
    g.translate(s.hx, s.hy);
    const foot = { x: F.x + W * 0.5, y: F.y + H * 0.84 };
    g.translate(foot.x, foot.y); g.rotate(tilt);
    // the pose: squash and stretch about the foot, the ripple's edge (v, frame fractions: below it
    // she is a worm, above it still herself), the follow-through's jiggle, her eyes, the shake
    let sx = 1, sy = 1, edge = -1, jig = 0, eye = 1, shake = 0, showArt = 0, showWorm = 1, edgeK = 0;
    if (form.st === 'in') {
      if (T < 0.15) { const e = ease(T / 0.15); showArt = 1; showWorm = 0; sx = 1 + 0.09 * e; sy = 1 - 0.12 * e; shake = 0.02 * Math.sin(T * 90) * e; }
      else if (T < 0.42) {
        const u = (T - 0.15) / 0.27; showArt = 1; edge = 0.86 - 0.84 * ease(u); edgeK = Math.sin(Math.PI * Math.min(1, u * 1.1));
        sx = 1.09 - 0.13 * ease(u); sy = 0.88 + 0.24 * outBack(u); eye = 0;
      } else { const u = (T - 0.42) / 0.18; sy = 1.12 - 0.12 * ease(u) + 0.04 * Math.sin(u * TAU) * (1 - u); sx = 0.96 + 0.04 * ease(u); jig = 1 - u; eye = Math.min(1, u * 2.5); }
    } else if (form.st === 'out') {
      if (T < 0.2) { const u = T / 0.2; shake = 0.24 * Math.sin(u * 22) * (1 - u); jig = 1 - u; }
      else if (T < 0.38) { const u = (T - 0.2) / 0.18; showArt = 1; edge = 0.02 + 0.84 * ease(u); edgeK = Math.sin(Math.PI * u); eye = 1 - u; sy = 1 - 0.06 * Math.sin(Math.PI * u); }
      else { const u = (T - 0.38) / 0.07; showArt = 1; showWorm = 0; sy = 1 - 0.07 * Math.sin(Math.PI * u); sx = 1 + 0.05 * Math.sin(Math.PI * u); }
    } else {
      // on: the rings breathe; standing tall
      sy = 1 + 0.02 * Math.sin(now * 3.4); sx = 1 - 0.012 * Math.sin(now * 3.4);
    }
    g.rotate(shake); g.scale(sx, sy);
    g.translate(-foot.x, -foot.y);
    // the worm (below the ripple's edge), in her frame's local px; mirrored as her art is
    if (showWorm) {
      g.save();
      if (edge >= 0) { g.beginPath(); g.rect(F.x - W, F.y + edge * H, W * 3, H * 2); g.clip(); }
      g.translate(F.x + (flip ? W : 0), F.y); g.scale(flip ? -1 : 1, 1);
      const breathe = form.st === 'on' ? 0.07 : 0.03;
      wormForm(g, W, H, { now, rip: now * 7, amp: breathe, jig, eye, bob: form.st === 'on' ? Math.sin(now * 3.4 + 0.6) * H * 0.008 : 0, hurt: p.hurt, tongue: form.st === 'on' ? 1 : 0 });
      g.restore();
    }
    // herself (above it)
    if (showArt && art) {
      g.save();
      if (edge >= 0) { g.beginPath(); g.rect(F.x - W, F.y - H, W * 3, H + edge * H); g.clip(); }
      drawArt(g, art);
      g.restore();
    }
    if (edge >= 0 && edgeK > 0) {
      g.save(); g.translate(F.x + (flip ? W : 0), F.y); g.scale(flip ? -1 : 1, 1);
      rippleEdge(g, W, edge * H, edgeK, now);
      g.restore();
    }
    g.restore();
    // mud flung off her as she shakes herself back (out), and dropping off her as she settles (in)
    const fling = form.st === 'out' && T < 0.3 ? T / 0.3 : form.st === 'in' && T > 0.4 ? (T - 0.4) / 0.2 : -1;
    if (fling >= 0 && fling <= 1) {
      const cl = clodTex(), out = form.st === 'out';
      g.save(); g.globalAlpha = 1 - fling;
      for (let i = 0; i < (out ? 8 : 5); i++) {
        const a = out ? (i / 8) * TAU + 0.3 : Math.PI / 2 + (hash(i, 7) - 0.5) * 1.6, v = r * (out ? 2.6 : 0.8) * (0.7 + 0.5 * hash(i, 9));
        const px = s.hx + Math.cos(a) * v * fling * (out ? 1 : 0.4) + (out ? 0 : (hash(i, 4) - 0.5) * r * 1.6);
        const py = s.hy + Math.sin(a) * v * fling + r * (out ? 3 : 4) * fling * fling + (out ? 0 : -r * 0.3);
        const z = r * (0.22 + 0.12 * hash(i, 2));
        g.save(); g.translate(px, py); g.rotate(fling * 9 + i); g.drawImage(cl, -z / 2, -z / 2, z, z); g.restore();
      }
      g.restore();
    }
  },

  // the ball: in the worm's coils (a fire-back's grab, the dive), hidden under the grass, then itself
  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, now = s.now || 0, gy = s.groundY;
    if (pw.ph === 'wgrab') {
      const k = Math.min(1, (pw.k || 0) / WORM.GRAB);
      grabWorm(g, { hx: pw.dx, gy, bx: s.x, by: s.y, br: s.r, dir, k, now, sq: k > 0.7 ? Math.sin((k - 0.7) / 0.3 * Math.PI) : 0, ballFn: (gg, x, y) => s.ball && s.ball(gg, x, y) });
      if (k < 0.5) spray(g, pw.dx, gy, k * WORM.GRAB, 8, s.r * 0.6, 420, 3);
      return true;
    }
    if (pw.ph === 'wdive') {
      // the plunge: the head already down its hole, the body after it, the ball in its coils
      const k = Math.min(1, (pw.k || 0) / WORM.DIVE);
      grabWorm(g, { hx: pw.dx, gy, bx: s.x, by: s.y, br: s.r, dir, k: 1 - 0.55 * k, now, sq: 1, ballFn: (gg, x, y) => s.ball && s.ball(gg, x, y) });
      spray(g, pw.dx, gy, k * WORM.DIVE, 7, s.r * 0.55, 380, 9);
      return true;
    }
    if (pw.ph !== 'fly') return true;                       // under the pitch: the mound shows it
    // THE LOB: the real ball (drawn on top by the game) — a dark red rim of light behind it, soil
    // crumbs dropping off it down its path, a green glint off its burst for a moment
    const x = s.x, y = s.y, r = s.r, t = s.t || 0, h = s.hist || [];
    blit(g, glow('#ff3a1a', 0.2), x, y, r * 3.4, r * 3.4, 0, 0.42);
    if (t < 0.2) blit(g, glow(WORM_COL.green, 0.3), x, y, r * 5, r * 5, 0, 0.5 * (1 - t / 0.2));
    const cl = clodTex();
    g.save();
    for (let i = 2; i < Math.min(h.length, 16); i += 2) {
      const q = h[i], age = i / 60, z = r * (0.34 - i * 0.012);
      if (!(z > 0.5)) continue;
      g.globalAlpha = Math.max(0, 0.9 - i * 0.055);
      const dx = (hash(i, Math.floor(now * 2)) - 0.5) * r * 0.8;
      g.save(); g.translate(q.x + dx, q.y + r * 0.5 + 900 * age * age); g.rotate(i + now * 5); g.drawImage(cl, -z / 2, -z / 2, z, z); g.restore();
    }
    g.restore();
    return false;
  },
  // no shadow while it is under the grass (or in the worm's coils, going down)
  hideShadow: (pw) => !!pw.wk && pw.ph !== 'fly',

  // THE CUT-IN (over its dark): the giant worm bursting out of the turf in front of her, up beside
  // the ball and round it, squeezing, rearing back for the dive
  cutin(g, s) {
    const pw = s.pw, c = s.cut ?? 0, gy = C.GROUND_Y, dir = s.dir || 1, now = s.now || 0;
    const k = c < 0.3 ? 0 : Math.min(1, (c - 0.3) / 0.7);
    const sq = c > 0.68 ? Math.max(Math.sin(Math.min(1, (c - 0.68) / 0.16) * Math.PI), c > 0.84 ? Math.sin(Math.min(1, (c - 0.84) / 0.16) * Math.PI) : 0) : 0;
    const lean = c > 1.0 ? Math.sin(Math.min(1, (c - 1.0) / 0.27) * Math.PI * 0.5) * s.r * 0.6 : 0;
    // (its hole cracks open as she whips down at it)
    if (c > 0.22) cracks(g, pw.dx, gy, C.HEAD_R * 1.3, ease((c - 0.22) / 0.15), dir);
    if (k > 0) grabWorm(g, { hx: pw.dx, gy, bx: s.fx, by: s.fy, br: s.r, dir, k, now, sq, lean, ballFn: s.ball });
    else if (s.ball) s.ball(g, s.fx, s.fy);
    spray(g, pw.dx, gy, c - 0.3, 10, s.r * 0.7, 520, 1);
  },

  // ARMED: two little red-eyed worms poking up out of the turf by her feet, swaying
  armed(g, p, s) {
    // (their clock starts the first frame she is seen armed — again after any gap)
    const sn = seen[p.index] || (seen[p.index] = { arm: -9, last: -9 });
    if (!(s.t - sn.last < 0.25) || s.t < sn.arm) sn.arm = s.t;
    sn.last = s.t;
    const el = s.t - sn.arm, side = p.side || 1, r = s.r;
    for (let i = 0; i < 2; i++) {
      const k = outBack((el - 0.35 - i * 0.12) / 0.3);
      const x = s.fx + (i ? side * r * 1.75 : -side * r * 1.6);
      littleWorm(g, x, s.fy, r * (1.05 - 0.15 * i), r * 0.36, Math.max(0, Math.min(1.1, k)), (i ? 1 : -1) * side * r * 0.25, s.t + i * 1.7);
    }
  },

  // THE BURROW (zone, on the grass under the players): its hole, the crack it leaves, the mound,
  // the ring and the cracks round it, and the worm bursting up through it
  zone(g, z, s) {
    if (z.k !== 'burrow') return;
    const gy = s.gy, dir = z.dir || 1, now = s.now, st = z.st | 0, sk = z.sk || 0, R = WORM.RING * C.HEAD_R;
    const hole = s.x0, at = s.x1;
    // the hole it went down (from the cut-in's crack on), closing over after it
    const holeA = st === 0 ? (s.cut >= 0 ? ease((s.cut - 0.3) / 0.12) : z.fb ? ease(sk / 0.1) : 0) : st === 1 ? 1 : Math.max(0, 1 - ((st === 2 ? sk : 1) / 1.1));
    if (holeA > 0) {
      g.save(); g.globalAlpha = holeA;
      g.fillStyle = WORM_COL.soilD; g.beginPath(); g.ellipse(hole, gy + 1, C.HEAD_R * 0.7, C.HEAD_R * 0.2, 0, 0, TAU); g.fill();
      g.fillStyle = WORM_COL.soil; for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; g.beginPath(); g.arc(hole + Math.cos(a) * C.HEAD_R * 0.78, gy + 1 + Math.sin(a) * C.HEAD_R * 0.18, 2.6, 0, TAU); g.fill(); }
      g.restore();
      cracks(g, hole, gy, C.HEAD_R * 1.3, 1, dir, holeA);
    }
    if (st < 2) return;
    // the crack the tunnel leaves behind the mound, fading back from it
    const fade = st === 4 ? Math.max(0, 1 - sk / 0.9) : 1;
    if (Math.abs(at - hole) > 6) seam(g, hole, at - dir * C.HEAD_R * 0.8, gy, 0.9 * fade, 17, 3.4);
    if (st === 2) {
      // the mound, running; its depth weave (a visual sway on the grass, from the same clock both screens run)
      const wv = Math.sin(sk * 9.5) * 1.6;
      mound(g, at, gy + wv, C.HEAD_R * 2.6, C.HEAD_R * 0.72, now);
      // clods popping off its front
      const cl = clodTex();
      for (let i = 0; i < 3; i++) {
        const f = (now * 2.6 + i / 3) % 1, px = at + dir * C.HEAD_R * (0.6 + 0.6 * f), py = gy - C.HEAD_R * 0.5 - 40 * f + 70 * f * f, zz = 3.5 + 2 * hash(i, 5);
        g.save(); g.globalAlpha = 1 - f; g.translate(px, py); g.rotate(f * 8 + i); g.drawImage(cl, -zz / 2, -zz / 2, zz, zz); g.restore();
      }
      return;
    }
    if (st === 3) {
      const k = clamp01(sk / WORM.WARN);
      cracks(g, at, gy, R * 1.05, ease(k * 1.4), dir);
      ringAt(g, at, gy, R, k, now, Math.min(1, sk / 0.08));
      mound(g, at, gy, C.HEAD_R * 2.6, C.HEAD_R * 0.72, now, k);
      // red eyes glinting up through the split in its top
      if (sk > 0.25) { const q = Math.min(1, (sk - 0.25) / 0.06) * (0.8 + 0.2 * Math.sin(now * 30)); for (const ex of [-4, 4]) blit(g, glow(WORM_COL.eye, 0.4), at + ex + dir * 2, gy - C.HEAD_R * (0.75 + 0.3 * k), 12, 9, 0, q); }
      return;
    }
    // the burst: a crater where it came up, the ring flaring out, the worm up and back down
    const a = Math.max(0, 1 - sk / 0.9);
    g.save(); g.globalAlpha = a; g.fillStyle = WORM_COL.soilD; g.beginPath(); g.ellipse(at, gy + 1, C.HEAD_R * 0.95, C.HEAD_R * 0.26, 0, 0, TAU); g.fill(); g.restore();
    cracks(g, at, gy, R * 1.05, 1, dir, a);
    if (sk < 0.3) ringAt(g, at, gy, R * (1 + sk * 1.6), 1, now, 1 - sk / 0.3);
    burstWorm(g, at, gy, sk, dir, now);
  },

  event(e, at) {
    if (e.type === 'wormDive') { const d = at(e.x, e.y); return clodBurst(d.x, d.y, { n: 10, up: 460, R: 7, life: 0.65, salt: 1 }); }
    if (e.type === 'wormWarn') { const d = at(e.x, e.y); return clodBurst(d.x, d.y, { n: 5, up: 240, R: 5, life: 0.45, salt: 2 }); }
    if (e.type === 'wormBurst') { const d = at(e.x, e.y); return clodBurst(d.x, d.y, { n: 16, up: 640, R: 9, life: 0.85, flash: C.HEAD_R * 3, salt: 3 }); }
    if (e.type === 'wormShove') { const d = at(e.x, C.GROUND_Y); return clodBurst(d.x, d.y, { n: 7, up: 380, R: 6, life: 0.55, salt: 6 }); }
    if (e.type === 'wormSmother') { const d = at(e.x, C.GROUND_Y); return clodBurst(d.x, d.y, { n: 9, up: 300, R: 7, life: 0.6, salt: 4 }); }
    if (e.type === 'powerHit' && e.cp === 'wormtunnel') { const d = at(e.x, e.y); return clodBurst(d.x, d.y + 10, { n: 8, up: 360, R: 6, life: 0.6, salt: 5 }); }
    return null;
  },

  // paint the sprites ahead of the first press, one a slice (champ-vfx warmTextures runs it again
  // while it answers false)
  warm() {
    if (!this._w) {
      const W = 2 * C.HEAD_R * 1.28 * 1.05, H = W * 0.99;
      this._w = [() => segTex(0), () => segTex(1), () => wormHeadTex(), () => clodTex(), () => glow(WORM_COL.eye, 0.25), () => glow(WORM_COL.eye, 0.3), () => glow(WORM_COL.green, 0.2), () => glow(WORM_COL.green, 0.15), () => formTex(W, H)];
    }
    const j = this._w.shift(); if (j) j();
    return this._w.length === 0;
  },
};
