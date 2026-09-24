// Tier 4 — אלופים (stages 28-36) champion VFX. See public/champ-vfx.js for the contract: every
// hook only DRAWS, reading the match it is handed (s.M) and never writing to it.
//
// Every entry is a super move: a bold tell while armed, its own drawing in the super cut-in, a
// screen-filling touch, a big themed shot or a scene that changes the pitch, a payoff, and an
// aftermath that fades rather than snaps.

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// The VFX's own notebook, keyed by a sim object (a shot's power record, an effect record). A
// WeakMap never touches the key, so the match stays byte-for-byte what the sim left it.
const notes = new WeakMap();
const note = (o) => { let n = notes.get(o); if (!n) notes.set(o, (n = {})); return n; };

// How strongly an effect shows at its age: eases in over `a`s, holds, eases out over its last `z`s.
const fade = (e, a = 0.25, z = 0.4) => clamp(Math.min(e.t / a, (e.life - e.t) / z), 0, 1);

// Same lines powers.js aims at, read here rather than imported so this file stays draw-only.
const attackLine = (C, side) => (side > 0 ? C.W - C.GOAL_W : C.GOAL_W);

// ── the spectacle kit, as this tier uses it ─────────────────────────────────
// The cut-in's own layer: in over its first 0.1, out over its last 0.3.
const cutFade = (k) => clamp(Math.min(k / 0.1, (1 - k) / 0.3), 0, 1);
// The side the cut-in band comes in from (-1 = the left), and an ease-in to rest.
const cutFrom = (s) => (s.owner.side > 0 ? -1 : 1);
const cutEase = (k) => (k < 0.3 ? 1 - (1 - k / 0.3) ** 3 : 1);
// A comic word kept on screen, clear of the edges.
const stampAt = (s, x, y, text, o) => s.fx.stamp(clamp(x, 120, s.C.W - 120), clamp(y, 70, s.C.H - 60), text, o);
// The light of a touch: a big coloured bloom, a white-hot core, a sunburst and glowing edges.
function lightUp(s, x, y, o) {
  const { fx } = s, r = o.r || 150;
  fx.glow(x, y, r, o.c1, { life: 0.7, alpha: 0.95 });
  fx.glow(x, y, r * 0.42, o.core || '#ffffff', { life: 0.32, alpha: 0.9, layer: 'front' });
  fx.rays(x, y, { color: o.c1, color2: o.c2, n: o.n || 14, r1: o.reach || 340, life: 0.8, spin: o.spin ?? 1.4, alpha: 0.5 });
  if (o.vig) fx.vignette(o.vig, 0.55, 1);
}

// Where the front boot is, following the sprite's own swing in game.js (the leg pivots at the
// hip and extends through the kick), so a glow or a yarn wrap stays on the foot mid-kick.
function bootAt(p, s) {
  const KT = s.C.KICK_TIME || 0.13;
  const kp = p.kickT > 0 ? 1 - p.kickT / KT : 0;
  const sw = p.kickT > 0 ? Math.sin(kp * Math.PI) : 0;
  const ang = 1.25 * sw, shin = 10 + 14 * sw;
  const x = p.x + p.side * (5 + Math.sin(ang) * shin + 7);
  const y = p.y - 17 + Math.cos(ang) * shin + 3;
  return s.depth(x, y);
}

// A kick that just started: kickT jumps back up to KICK_TIME. Tracked per effect record.
function kickStarted(n, key, p) {
  const was = n[key] ?? 0;
  n[key] = p.kickT || 0;
  return (p.kickT || 0) > was + 1e-4;
}

// The goal mouth point the goal magnet pulls to — EFFECTS.pull in powers.js, to: 'goal'.
function holePoint(s, e) {
  const o = s.M.players[e.owner];
  return { x: attackLine(s.C, o.side) + o.side * 18, y: s.C.GROUND_Y - s.C.GOAL_H * 0.45 };
}

// The point the homing missile steers at — the flight in powers.js: high if the keeper is on
// the grass, low if he has jumped.
function homingPoint(s, dir, ownerIndex, r) {
  const C = s.C, q = s.M.players[1 - ownerIndex];
  const air = s.headY(q) < C.GROUND_Y - C.BODY_H - C.HEAD_R + 8 - 10;
  const ty = air ? C.GROUND_Y - r - 6 : C.GROUND_Y - C.GOAL_H + r + 14;
  return { x: attackLine(C, dir) + dir * 20, y: ty, air };
}

// ── shapes ────────────────────────────────────────────────────────────────
// A carved boomerang, elbow near the origin, arms swept back; R is the arm length.
function drawBoomerang(g, R) {
  const arms = () => {
    g.beginPath();
    g.moveTo(-R, R * 0.55); g.quadraticCurveTo(-R * 0.55, -R * 0.1, 0, 0);
    g.quadraticCurveTo(R * 0.55, -R * 0.1, R, R * 0.55);
  };
  g.translate(0, -R * 0.18);
  g.lineCap = 'round'; g.lineJoin = 'round';
  arms(); g.strokeStyle = '#5c3a1e'; g.lineWidth = R * 0.46 + 3; g.stroke();
  arms(); g.strokeStyle = '#8b5a2b'; g.lineWidth = R * 0.46; g.stroke();
  arms(); g.strokeStyle = '#d9a066'; g.lineWidth = Math.max(2, R * 0.12); g.stroke();
  // painted bands mid-arm and red tips — the hand-painted look, not a plain stick
  for (const sg of [-1, 1]) {
    g.fillStyle = '#1f8a70';
    g.beginPath(); g.arc(sg * R * 0.52, R * 0.09, Math.max(2, R * 0.15), 0, TAU); g.fill();
    g.fillStyle = '#b33a3a';
    g.beginPath(); g.arc(sg * R * 0.86, R * 0.37, Math.max(2, R * 0.12), 0, TAU); g.fill();
  }
}

// A steel spiral drill bit along +x from the origin: length L, base radius R, thread phase ph.
function drawDrillBit(g, L, R, ph) {
  g.fillStyle = '#3b4252';
  g.fillRect(-6, -R * 0.55, 8, R * 1.1);                           // the chuck collar
  g.beginPath(); g.moveTo(0, -R); g.lineTo(L, 0); g.lineTo(0, R); g.closePath();
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = Math.max(3, R * 0.2); g.stroke();
  g.fillStyle = '#8a94a6'; g.fill();
  g.fillStyle = '#dfe6ee'; g.globalAlpha *= 0.8;                  // the lit upper flank
  g.beginPath(); g.moveTo(0, -R); g.lineTo(L, 0); g.lineTo(0, -R * 0.3); g.closePath(); g.fill();
  g.globalAlpha /= 0.8;
  // the thread: diagonal flutes marching toward the tip — the spin is read off them
  g.strokeStyle = '#3b4252'; g.lineWidth = Math.max(2, R * 0.16);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const u = ((i + ph) % n) / n, u2 = Math.min(1, u + 0.16);
    g.beginPath();
    g.moveTo(u * L, -R * (1 - u)); g.lineTo(u2 * L, R * (1 - u2));
    g.stroke();
  }
}

// A bat, wings spread by `flap` (-1 … 1).
function drawBat(g, x, y, sz, flap, col) {
  g.save();
  g.translate(x, y);
  g.fillStyle = col;
  const w = sz, h = sz * 0.5 * flap;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(-w * 0.5, -h - sz * 0.2, -w, -h);
  g.lineTo(-w * 0.7, -h * 0.3 + sz * 0.1); g.lineTo(-w * 0.45, sz * 0.12); g.lineTo(-w * 0.2, sz * 0.05);
  g.lineTo(0, sz * 0.25);
  g.lineTo(w * 0.2, sz * 0.05); g.lineTo(w * 0.45, sz * 0.12); g.lineTo(w * 0.7, -h * 0.3 + sz * 0.1);
  g.lineTo(w, -h);
  g.quadraticCurveTo(w * 0.5, -h - sz * 0.2, 0, 0);
  g.fill();
  g.beginPath(); g.arc(0, -sz * 0.05, sz * 0.22, 0, TAU); g.fill();
  g.restore();
}

// The Midas boot's outline, toe along +x, sole on y = 2.
function bootPath(g) {
  g.beginPath();
  g.moveTo(-8, -9); g.lineTo(0, -9); g.lineTo(3, -5); g.lineTo(11, -3);
  g.quadraticCurveTo(14, -1, 12, 2); g.lineTo(-8, 2); g.closePath();
}

// The Midas boot: a gold-plated boot over the real one, with the trophy glint sweeping it.
function drawGoldBoot(g, p, s, k, sc = 1) {
  const d = bootAt(p, s);
  g.save();
  g.translate(d.x, d.y);
  g.scale(p.side * sc, sc);
  const gr = g.createLinearGradient(0, -9, 0, 2);
  gr.addColorStop(0, '#fff6cc'); gr.addColorStop(0.5, '#ffd700'); gr.addColorStop(1, '#b8860b');
  g.globalAlpha = k;
  g.shadowColor = '#ffd700'; g.shadowBlur = 16;
  g.fillStyle = gr;
  bootPath(g); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#7a5c12'; g.lineWidth = 2 / sc; g.stroke();
  // the glint: a white bar crossing the boot once every 1.4s
  const u = (s.t % 1.4) / 0.35;
  if (u < 1) {
    const gx = -8 + u * 22;
    g.strokeStyle = '#ffffff'; g.lineWidth = 3 / sc; g.globalAlpha = k * (1 - Math.abs(u - 0.5) * 1.6);
    g.beginPath(); g.moveTo(gx - 3, 2); g.lineTo(gx + 3, -9); g.stroke();
  }
  g.restore();
  return d;
}

// A lock-on reticle: four corner brackets, cross ticks and a pip.
function drawReticle(g, x, y, r, rot, col, a) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'square';
  for (let i = 0; i < 4; i++) {
    g.rotate(TAU / 4);
    g.beginPath(); g.moveTo(r, r * 0.45); g.lineTo(r, r); g.lineTo(r * 0.45, r); g.stroke();
  }
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const c = Math.cos(i * TAU / 4), sn = Math.sin(i * TAU / 4);
    g.beginPath(); g.moveTo(c * r * 0.25, sn * r * 0.25); g.lineTo(c * r * 0.6, sn * r * 0.6); g.stroke();
  }
  g.fillStyle = col; g.fillRect(-2, -2, 4, 4);
  g.restore();
}

// A yarn ball: a coloured disc wound with arcs.
function drawYarnBall(g, x, y, r, col, rot) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#a77fcf'; g.lineWidth = Math.max(2, r * 0.12);
  for (let i = 0; i < 3; i++) {
    g.beginPath(); g.ellipse(0, 0, r * 0.85, r * (0.3 + i * 0.22), i * 1.1, 0, Math.PI); g.stroke();
  }
  g.restore();
}

// A missile along +x, nose at the origin: body length L, half-height h.
function drawMissile(g, L, h, flame) {
  g.fillStyle = '#ff2e63';
  g.beginPath(); g.moveTo(-L, -h * 0.7); g.lineTo(-L - flame, 0); g.lineTo(-L, h * 0.7); g.closePath(); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(-L, -h * 0.35); g.lineTo(-L - flame * 0.5, 0); g.lineTo(-L, h * 0.35); g.closePath(); g.fill();
  g.fillStyle = '#9aa1ab';
  g.beginPath(); g.moveTo(-L + h * 1.6, -h); g.lineTo(-L - h * 0.4, -h * 2.4); g.lineTo(-L - h * 0.4, -h); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-L + h * 1.6, h); g.lineTo(-L - h * 0.4, h * 2.4); g.lineTo(-L - h * 0.4, h); g.closePath(); g.fill();
  g.fillStyle = '#d7dde5'; g.fillRect(-L, -h, L, h * 2);
  g.fillStyle = '#ff2e63'; g.fillRect(-L * 0.45, -h, Math.max(3, h * 0.7), h * 2);
  g.fillStyle = '#9aa1ab'; g.fillRect(-L, h * 0.5, L, h * 0.5);
}

// ── the super-move kit (this tier's own) ────────────────────────────────────
const INK = '#140a1e';     // the keyline every bright shape sits on, so it reads on any backdrop

// A path stroked twice: a dark keyline, then the colour on top.
function keyline(g, path, col, w, edge = INK) {
  path(); g.strokeStyle = edge; g.lineWidth = w + 4; g.stroke();
  path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
}

// The armed tell: a thick, keylined ring round the head in the power's colours, spinning in
// dashes, pulsing — the gold armed glow is round the BODY, this is round the HEAD, so both read.
function haloRing(g, s, p, cols, o = {}) {
  const d = s.depth(p.x, s.headY(p)), r = (s.headR(p) + (o.gap ?? 12)) * (1 + Math.sin(s.t * 8) * 0.05);
  s.fx.drawGlow(g, d.x, d.y, r * 1.9, o.glow || cols[0], 0.55 + Math.sin(s.t * 6) * 0.15);
  g.save(); g.lineCap = 'butt';
  g.globalAlpha = 0.85; g.strokeStyle = o.edge || INK; g.lineWidth = 14;
  g.beginPath(); g.arc(d.x, d.y, r, 0, TAU); g.stroke();
  const n = cols.length * 2, rot = s.t * (o.spin ?? 3);
  g.globalAlpha = 1; g.lineWidth = 8;
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    g.strokeStyle = cols[i % cols.length];
    g.beginPath(); g.arc(d.x, d.y, r, a, a + (TAU / n) * 0.72); g.stroke();
  }
  // an outer ring of ticks turning the other way, so it reads as a charged-up super
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = -rot * 0.7 + i * TAU / 12, r0 = r + 11, r1 = r + 19 + (i % 2) * 5;
    g.strokeStyle = o.edge || INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(d.x + Math.cos(a) * r0, d.y + Math.sin(a) * r0); g.lineTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1); g.stroke();
    g.strokeStyle = cols[i % cols.length]; g.lineWidth = 3;
    g.beginPath(); g.moveTo(d.x + Math.cos(a) * r0, d.y + Math.sin(a) * r0); g.lineTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1); g.stroke();
  }
  g.restore();
  return { x: d.x, y: d.y, r };
}

// A four-point twinkle.
function twinkle(g, x, y, r, col) {
  const q = r * 0.22;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y - r); g.lineTo(x + q, y - q); g.lineTo(x + r, y); g.lineTo(x + q, y + q);
  g.lineTo(x, y + r); g.lineTo(x - q, y + q); g.lineTo(x - r, y); g.lineTo(x - q, y - q);
  g.closePath(); g.fill();
}

// The sky over the stands taken over in a colour: dark at the top, gone by `h`. A band, not a
// full-screen fill — the pitch and the goals below it keep their light.
function skyShade(g, C, col, a, h = C.GROUND_Y * 0.62) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, C.W, h);
}

// Dot painting: concentric rings of keylined dots, counter-rotating — the boomerang's own art.
function dotRings(g, x, y, R, rot, cols, a) {
  g.globalAlpha = a;
  for (let j = 0; j < 3; j++) {
    const r = R * (0.36 + j * 0.32), n = 8 + j * 6, sz = Math.max(3, R * 0.1);
    for (let i = 0; i < n; i++) {
      const an = rot * (j % 2 ? -1 : 1) + i * TAU / n;
      const px = x + Math.cos(an) * r, py = y + Math.sin(an) * r;
      g.fillStyle = INK; g.fillRect(px - sz / 2 - 1.5, py - sz / 2 - 1.5, sz + 3, sz + 3);
      g.fillStyle = cols[(i + j) % cols.length]; g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
  }
}

// A gear: n teeth round a hub, keylined. For the mine.
function drawGear(g, x, y, R, n, rot, col) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n, w = TAU / n / 4;
    g.lineTo(Math.cos(a - w * 1.4) * R * 0.8, Math.sin(a - w * 1.4) * R * 0.8);
    g.lineTo(Math.cos(a - w) * R, Math.sin(a - w) * R);
    g.lineTo(Math.cos(a + w) * R, Math.sin(a + w) * R);
    g.lineTo(Math.cos(a + w * 1.4) * R * 0.8, Math.sin(a + w * 1.4) * R * 0.8);
  }
  g.closePath();
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.fillStyle = col; g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(0, 0, R * 0.32, 0, TAU); g.fill();
  g.fillStyle = '#dfe6ee'; g.beginPath(); g.arc(0, 0, R * 0.14, 0, TAU); g.fill();
  g.restore();
}

// Yellow-and-black hazard tape along a band: the drill site.
function hazardBand(g, C, y, h, off, a) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = '#ffc861'; g.fillRect(0, y, C.W, h);
  g.fillStyle = '#1d1a16';
  g.beginPath();
  for (let x = -h * 2 + (off % (h * 2)); x < C.W + h; x += h * 2) {
    g.moveTo(x, y + h); g.lineTo(x + h, y); g.lineTo(x + h * 1.8, y); g.lineTo(x + h * 0.8, y + h); g.closePath();
  }
  g.fill();
  g.fillStyle = INK; g.fillRect(0, y - 2, C.W, 3); g.fillRect(0, y + h - 1, C.W, 3);
  g.restore();
}

// A gold coin, spinning edge-on and back.
function drawCoin(g, x, y, r, spin) {
  const w = Math.max(1.5, Math.abs(Math.cos(spin)) * r);
  g.fillStyle = '#7a5c12'; g.beginPath(); g.ellipse(x, y, w + 2, r + 2, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffd700'; g.beginPath(); g.ellipse(x, y, w, r, 0, 0, TAU); g.fill();
  if (w > r * 0.45) { g.fillStyle = '#fff6cc'; g.fillRect(x - w * 0.3, y - r * 0.5, Math.max(2, w * 0.25), r); }
}

// A crown: five points and three jewels.
function drawCrown(g, x, y, w, col) {
  const h = w * 0.62;
  g.beginPath();
  g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h * 0.7); g.lineTo(x - w * 0.27, y - h * 0.35);
  g.lineTo(x, y - h); g.lineTo(x + w * 0.27, y - h * 0.35); g.lineTo(x + w / 2, y - h * 0.7); g.lineTo(x + w / 2, y);
  g.closePath();
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.fillStyle = col; g.fill();
  g.fillStyle = '#c1121f'; g.fillRect(x - 3, y - h * 0.3, 6, 6);
  g.fillStyle = '#3a86ff'; g.fillRect(x - w * 0.3, y - h * 0.22, 5, 5); g.fillRect(x + w * 0.3 - 5, y - h * 0.22, 5, 5);
}

// A castle skyline for the vampire's night: towers, spires and lit windows, all one silhouette.
function drawCastle(g, x, y, sc, col, win) {
  g.save();
  g.translate(x, y); g.scale(sc, sc);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-120, 0); g.lineTo(-120, -40); g.lineTo(-100, -40); g.lineTo(-100, -70); g.lineTo(-110, -70);
  g.lineTo(-92, -110); g.lineTo(-74, -70); g.lineTo(-84, -70); g.lineTo(-84, -48); g.lineTo(-40, -48);
  g.lineTo(-40, -96); g.lineTo(-50, -96); g.lineTo(-28, -150); g.lineTo(-6, -96); g.lineTo(-16, -96);
  g.lineTo(-16, -60); g.lineTo(20, -60); g.lineTo(20, -120); g.lineTo(10, -120); g.lineTo(34, -178);
  g.lineTo(58, -120); g.lineTo(48, -120); g.lineTo(48, -56); g.lineTo(84, -56); g.lineTo(84, -84);
  g.lineTo(76, -84); g.lineTo(94, -118); g.lineTo(112, -84); g.lineTo(104, -84); g.lineTo(104, -36);
  g.lineTo(124, -36); g.lineTo(124, 0); g.closePath(); g.fill();
  g.fillStyle = win;
  for (const [wx, wy] of [[-92, -60], [-28, -80], [-28, -110], [34, -100], [34, -140], [94, -70], [0, -34], [64, -30]]) g.fillRect(wx - 3, wy - 5, 6, 10);
  g.restore();
}

// A fluffy wool cloud: overlapping keylined puffs.
function drawCloud(g, x, y, w, col) {
  const puffs = [[-0.36, 0.1, 0.26], [-0.12, -0.12, 0.32], [0.16, -0.08, 0.3], [0.38, 0.1, 0.22], [0.02, 0.14, 0.28]];
  g.fillStyle = INK;
  for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(x + px * w, y + py * w, pr * w + 3, 0, TAU); g.fill(); }
  g.fillStyle = col;
  for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(x + px * w, y + py * w, pr * w, 0, TAU); g.fill(); }
}

// A planet with a lit side and a dark keyline.
function drawPlanet(g, x, y, r, lit, mid, dark) {
  const pg = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  pg.addColorStop(0, lit); pg.addColorStop(0.6, mid); pg.addColorStop(1, dark);
  g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
}

// The galaxy: stars for the inverted sky, placed once so no frame allocates them.
const STARS = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), v: 0.4 + Math.random() * 0.9, s: Math.random() < 0.25 ? 3 : 2 }));

export default {
  // ── 28 · boomerang — the carved wooden boomerang ─────────────────────────
  boomerang: {
    theme: 'Carved wooden boomerang',
    visual: 'spinning painted hardwood boomerang, curved whirr-arc trail, red-ochre tips, dust kicked up at the turn-around',
    palette: ['#8b5a2b', '#d9a066', '#1f8a70', '#b33a3a', '#e8d3b0', '#5c3a1e'],
    doc: {
      fantasy: 'The champion throws the ball like a hunting boomerang: it whirls away backwards and high, bites the air, and comes screaming back at the goal.',
      purpose: 'The first shot of the tier with a second phase: it starts by going the WRONG way (back and up at 0.55×/0.85× shot speed for 0.34s), swings round over 0.16s — re-aimed every tick of the swing from where the ball is — and returns at 1.5× shot speed at mid-mouth height (42% of the goal height, 16px inside the line), so the defender has to read a shot that is not coming yet.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The shot lives POWER_SHOT_LIFE + 0.9s (2.5s); it can still be blocked by a body or countered by a timed kick like any power shot.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it presses up and fires from range, trusting the return leg.",
      sequence: {
        anticipation: 'While armed a thick keylined halo in ochre, teal, cream and red spins round the champion\'s head with an outer ring of ticks, and a painted boomerang whirls round it on a spinning dot-painting disc with two whirr arcs, flicking painted chips.',
        activation: 'Cut-in: a giant dot painting wheels behind a giant boomerang that flies out across the screen and back. Then a crack of the wrist: ochre-teal and red-cream sunbursts, a warm bloom, three rings of painted dots exploding outward, 60+ splinters, chips and dust, three whirr rings, a big "שוווש!" stamp, a red vignette and a shake.',
        main: 'DREAMTIME SKY for the whole flight: the sky goes dusk-brown, a keylined ochre sun ringed in counter-rotating dot painting blazes over the stands with red-and-ochre rays wheeling out of it, two more dot paintings spin beside it and three ghost boomerangs loop the sky; dust devils and painted dots blow across the pitch. The ball is a 3.4× boomerang in a whirr disc with ghost after-images, on a thick keylined four-colour flight arc; the turn-around gets a teal sunburst, dust swirl and "חוזר!". A cream ring and dark hub stay on the true ball.',
        impact: 'On a block, a goal or the woodwork: a huge "טראח!", an ochre sunburst and bloom, 34 splinters, painted chips, two rings of painted dots, wood confetti, three 🪃 flung off spinning, three rings, a cream flash, an ochre vignette and a heavy shake.',
        aftermath: 'Two rings spread from where it ended, the sun\'s glow and a warm bloom fade out slowly, dust settles and wood chips tumble to the grass.',
        cleanup: 'Splinters and dust run out within 1.6s; the sky fades with the shot and the trail history is dropped with the shot record.',
      },
      layers: 'Aura halo, glow, dot disc, whirr arcs and boomerang; cut-in dot painting and boomerang out-and-back; touch sunbursts, blooms, stamp, dot rings, splinters; flight: sky shade, sun rays, sun, dot paintings, ghost boomerangs, keylined arc, whirr disc, boomerang, ball ring (last); back-layer dust and dots; impact sunburst, dots, 🪃, confetti; lingering rings and glows.',
      camera: 'Shake 10 and a red vignette on the throw, 13 on the hit (16 on a goal) with a 0.22s cream flash (α 0.3) and an ochre vignette.',
      hud: 'The ordinary meter and armed glow, and the super cut-in on firing. No status icon: the power is the shot.',
      audio: 'Fire: a rising whirr (sawtooth sweep up with detune) over a soft wooden knock. Impact: a dry wooden thwack. End: a short fading whirr.',
      counterplay: 'Do not chase it backwards — it is coming back. Hold the middle of the mouth at head height where it returns, or time a kick on the return leg to counter it.',
      perf: '≈110 particles on the throw, ≤115 on the hit, ≤4 per frame from the trail, ≤4 drawGlow per frame in flight, ~150 fillRects of dot painting, one linear gradient, an 18-point path history, no shadowBlur.',
      helpers: 'fx.glow, fx.rays, fx.stamp, fx.glyph, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.shake, fx.flash; haloRing(), dotRings(), skyShade(), keyline(); note() WeakMap for the flight history.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 180, to: 900, type: 'sawtooth', peak: 0.35, dur: 0.45, detune: 25 }, { k: 'thud', freq: 420, q: 3, peak: 0.5, decay: 0.08 }],
      impact: [{ k: 'thud', freq: 520, q: 5, peak: 0.8, decay: 0.1 }, { k: 'thud', freq: 150, q: 1, peak: 0.6, decay: 0.25 }],
      end: [{ k: 'sweep', from: 600, to: 200, type: 'triangle', peak: 0.12, dur: 0.3 }],
    },

    aura(g, p, s) {
      const h = haloRing(g, s, p, ['#d9a066', '#1f8a70', '#e8d3b0', '#b33a3a'], { spin: 4 });
      // a boomerang whirling round the head on the halo, a dot-painted disc spinning behind it
      const a = s.t * 3.2 * p.side;
      const x = h.x + Math.cos(a) * (h.r + 26), y = h.y + Math.sin(a) * (h.r + 14);
      s.fx.drawGlow(g, x, y, 70, '#d9a066', 0.7);
      g.save();
      dotRings(g, x, y, 34, s.t * 2, ['#d9a066', '#e8d3b0', '#1f8a70', '#b33a3a'], 0.9);
      g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const w = s.t * (9 - i * 4) * (i ? -1 : 1);
        g.globalAlpha = 0.9 - i * 0.2;
        keyline(g, () => { g.beginPath(); g.arc(x, y, 40 + i * 10, w, w + 2.2); }, i ? '#1f8a70' : '#e8d3b0', 4);
      }
      g.globalAlpha = 1;
      g.translate(x, y); g.rotate(s.t * 14 * p.side);
      drawBoomerang(g, 28);
      g.restore();
      if (Math.random() < 0.35) s.fx.emit({ shape: 'sq', x: x + s.fx.rand(-20, 20), y, vx: s.fx.rand(-40, 40), vy: s.fx.rand(-60, -10), grav: 200, spin: 8, r: 3, life: 0.7, color: Math.random() < 0.5 ? '#d9a066' : '#1f8a70' });
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      // out and back, like the real thing: across the screen and home again
      const x = C.W / 2 + from * Math.cos(k * TAU) * C.W * 0.36, y = C.H * 0.74 - Math.sin(k * TAU) * 40;
      s.fx.drawGlow(g, x, y, 220, '#d9a066', 0.7 * f);
      g.save();
      // a giant dot painting wheeling behind it, and the ochre sun it flies across
      dotRings(g, C.W / 2 - from * 260, C.H * 0.72, 150, k * 4, ['#d9a066', '#e8d3b0', '#1f8a70', '#b33a3a'], 0.85 * f);
      g.globalAlpha = 0.18 * f; g.fillStyle = '#e8d3b0';
      g.beginPath(); g.arc(x, y, 150, 0, TAU); g.fill();
      g.globalAlpha = 0.7 * f; g.strokeStyle = '#1f8a70'; g.lineWidth = 8; g.lineCap = 'round';
      const rot = k * 26;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x, y, 160, rot + i * TAU / 3, rot + i * TAU / 3 + 1.1); g.stroke(); }
      g.globalAlpha = f;
      g.translate(x, y); g.rotate(rot);
      drawBoomerang(g, 120);
      g.restore();
    },

    fire(s, at) {
      const { fx, side } = s;
      lightUp(s, at.x, at.y, { c1: '#d9a066', c2: '#1f8a70', r: 170, vig: '#e8d3b0', n: 16 });
      fx.burst(at.x, at.y, 24, { shape: 'shard', speed: 320, r: 6, spin: 18, grav: 700, life: 0.8, color: '#8b5a2b', color2: '#d9a066' });
      fx.burst(at.x, at.y, 14, { shape: 'sq', speed: 260, r: 5, spin: 10, grav: 500, life: 0.9, color: '#1f8a70', color2: '#b33a3a' });
      fx.burst(at.x, at.y, 12, { shape: 'smoke', speed: 80, r: 8, r1: 26, life: 0.9, drag: 2, color: '#e8d3b0', layer: 'back' });
      fx.burst(at.x, at.y, 14, { shape: 'streak', speed: 460, spread: 1.2, angle: side > 0 ? Math.PI * 1.2 : -Math.PI * 0.2, color: '#e8d3b0', life: 0.3, w: 3 });
      fx.ring(at.x, at.y, { color: '#d9a066', r1: 130, life: 0.45, w: 6 });
      fx.ring(at.x, at.y, { color: '#1f8a70', r: 20, r1: 200, life: 0.6, w: 4 });
      fx.ring(at.x, at.y, { color: '#b33a3a', r: 30, r1: 300, life: 0.8, w: 6 });
      // the dot painting explodes out of the touch: three rings of painted dots
      for (let j = 0; j < 3; j++) {
        fx.burst(at.x, at.y, 12, { shape: 'sq', speed: 180 + j * 130, jitter: 0.05, r: 5, drag: 1.2, life: 1, layer: 'back', color: ['#d9a066', '#e8d3b0', '#1f8a70'][j], color2: '#b33a3a' });
      }
      fx.rays(at.x, at.y, { color: '#b33a3a', color2: '#e8d3b0', n: 10, r: 60, r1: 520, life: 1, spin: -0.8, alpha: 0.35 });
      stampAt(s, at.x - side * 40, at.y - 110, 'שוווש!', { r: 64, color: '#ffe0a8', edge: '#5c3a1e' });
      fx.vignette('#b33a3a', 0.5, 1.2);
      fx.shake(10, 0.35);
    },

    ball(g, b, s) {
      const pw = b.power, n = note(pw);
      const d = s.depth(b.x, b.y);
      const R = b.r * 3.4, C = s.C;
      const k = clamp(pw.t / 0.3, 0, 1) * clamp((2.5 - pw.t) / 0.4, 0, 1);
      // DREAMTIME SKY for the whole flight: an ochre sun ringed in dot painting over the stands,
      // two more dot paintings wheeling beside it, and giant ghost boomerangs looping the sky.
      const sx = C.W / 2, sy = 150;
      s.fx.drawGlow(g, sx, sy, 230, '#d9a066', 0.75 * k);
      s.fx.drawGlow(g, sx, sy, 110, '#ffe0a8', 0.6 * k);
      g.save();
      skyShade(g, C, '#2a1206', 0.7 * k, 300);
      g.globalCompositeOperation = 'lighter';
      g.translate(sx, sy); g.rotate(s.t * 0.6);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        g.globalAlpha = (i % 2 ? 0.26 : 0.2) * k; g.fillStyle = i % 2 ? '#f0a44a' : '#b33a3a';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.1) * 460, Math.sin(a - 0.1) * 460); g.lineTo(Math.cos(a + 0.1) * 460, Math.sin(a + 0.1) * 460); g.closePath(); g.fill();
      }
      g.restore();
      g.save();
      g.globalAlpha = 0.9 * k; g.fillStyle = INK;
      g.beginPath(); g.arc(sx, sy, 50, 0, TAU); g.fill();
      g.fillStyle = '#f0a44a'; g.beginPath(); g.arc(sx, sy, 46, 0, TAU); g.fill();
      g.fillStyle = '#ffe0a8'; g.beginPath(); g.arc(sx - 10, sy - 10, 22, 0, TAU); g.fill();
      dotRings(g, sx, sy, 100, s.t * 0.8, ['#d9a066', '#e8d3b0', '#1f8a70', '#b33a3a'], 0.95 * k);
      dotRings(g, C.W * 0.16, 150, 62, -s.t * 1.2, ['#1f8a70', '#e8d3b0', '#b33a3a'], 0.85 * k);
      dotRings(g, C.W * 0.84, 150, 62, s.t * 1.2, ['#b33a3a', '#e8d3b0', '#d9a066'], 0.85 * k);
      for (let i = 0; i < 3; i++) {
        const a = s.t * 1.7 + i * TAU / 3;
        g.save();
        g.globalAlpha = 0.75 * k;
        g.translate(C.W / 2 + Math.cos(a) * C.W * 0.36, 170 + Math.sin(a) * 70);
        g.rotate(s.t * 9 + i);
        drawBoomerang(g, 30);
        g.restore();
      }
      g.restore();
      s.fx.drawGlow(g, d.x, d.y, R * 2.6, '#d9a066', 0.7);
      g.save();
      // the real path it has flown: a thick keylined arc fading into the past
      const h = n.h || [];
      g.lineCap = 'round';
      for (let i = 1; i < h.length; i++) {
        const u = i / h.length;
        g.globalAlpha = u * 0.5; g.strokeStyle = INK; g.lineWidth = 6 + u * 12;
        g.beginPath(); g.moveTo(h[i - 1].x, h[i - 1].y); g.lineTo(h[i].x, h[i].y); g.stroke();
      }
      for (let i = 1; i < h.length; i++) {
        const u = i / h.length;
        g.globalAlpha = u * 0.9; g.strokeStyle = ['#1f8a70', '#e8d3b0', '#d9a066', '#b33a3a'][i % 4]; g.lineWidth = 2 + u * 9;
        g.beginPath(); g.moveTo(h[i - 1].x, h[i - 1].y); g.lineTo(h[i].x, h[i].y); g.stroke();
      }
      // the turn-around, marked by a dust swirl that unwinds
      if (n.turn) {
        const k = clamp((pw.t - 0.34) / 0.8, 0, 1);
        g.globalAlpha = (1 - k) * 0.7; g.strokeStyle = '#d9a066'; g.lineWidth = 4;
        g.beginPath(); g.arc(n.turn.x, n.turn.y, 14 + k * 40, k * 6, k * 6 + 4.2); g.stroke();
        if (k < 1) s.fx.drawGlow(g, n.turn.x, n.turn.y, 60, '#1f8a70', (1 - k) * 0.5);
      }
      // the whirr disc, ghost after-images, then the boomerang itself
      const rot = s.t * 24 * (pw.dir || 1);
      g.translate(d.x, d.y);
      g.globalAlpha = 0.16; g.fillStyle = '#e8d3b0';
      g.beginPath(); g.arc(0, 0, R + 8, 0, TAU); g.fill();
      g.globalAlpha = 0.55; g.strokeStyle = '#e8d3b0'; g.lineWidth = 4;
      for (let i = 0; i < 3; i++) { const a = rot + i * TAU / 3; g.beginPath(); g.arc(0, 0, R + 8, a - 1.2, a - 0.2); g.stroke(); }
      for (let j = 2; j >= 1; j--) {
        g.save(); g.globalAlpha = 0.14 * (3 - j); g.rotate(rot - j * 0.55 * (pw.dir || 1)); drawBoomerang(g, R); g.restore();
      }
      g.globalAlpha = 1;
      g.rotate(rot);
      drawBoomerang(g, R);
      g.restore();
      // the ball's true centre, drawn last: a cream ring and a dark hub
      g.save();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.arc(d.x, d.y, b.r * 0.75, 0, TAU); g.stroke();
      g.fillStyle = '#5c3a1e'; g.beginPath(); g.arc(d.x, d.y, 5, 0, TAU); g.fill();
      g.restore();
    },

    trail(b, s) {
      const pw = b.power, n = note(pw), { fx } = s;
      const d = s.depth(b.x, b.y);
      (n.h || (n.h = [])).push({ x: d.x, y: d.y });
      if (n.h.length > 18) n.h.shift();
      // Off the woodwork: the runtime only calls impact on a block or a goal, but a return that
      // meets the frame reverses the ball — that is where the boomerang lands, so thwack it there.
      const pv = n.pv;
      n.pv = { vx: b.vx, vy: b.vy };
      if (pv && !n.hit && pw.t > 0.52 && b.vx * pv.vx + b.vy * pv.vy < 0) {
        n.hit = true;
        s.V.impact(s, { kind: 'frame', x: b.x, y: b.y });
        fx.sound(s.V.sounds.impact);
      }
      // the swing round: a teal sunburst and "it's coming back!", then dust off the turn
      if (pw.t >= 0.32 && pw.t < 0.52) {
        if (!n.turn) {
          n.turn = { x: d.x, y: d.y };
          fx.rays(b.x, b.y, { color: '#1f8a70', color2: '#e8d3b0', n: 10, r1: 220, life: 0.55 });
          fx.glow(b.x, b.y, 110, '#1f8a70', { life: 0.5 });
          fx.ring(b.x, b.y, { color: '#e8d3b0', r1: 120, life: 0.4, w: 5 });
          stampAt(s, b.x, b.y - 70, 'חוזר!', { r: 40, color: '#8fe0c8', edge: '#5c3a1e', life: 0.8 });
        }
        for (let i = 0; i < 3; i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-10, 10), y: b.y + fx.rand(-10, 10), vx: fx.rand(-80, 80), vy: fx.rand(-60, 40), drag: 2, r: 4, r1: 16, life: 0.8, color: '#e8d3b0', layer: 'back' });
        return;
      }
      if (Math.random() < 0.7) fx.emit({ shape: 'streak', x: b.x, y: b.y, vx: -b.vx * 0.2 + fx.rand(-40, 40), vy: -b.vy * 0.2 + fx.rand(-40, 40), r: 3, w: 3, life: 0.25, color: '#d9a066' });
      if (Math.random() < 0.3) fx.emit({ shape: 'shard', x: b.x, y: b.y, vx: fx.rand(-60, 60), vy: fx.rand(-100, -20), grav: 700, spin: 14, r: 5, life: 0.6, color: '#8b5a2b', color2: '#d9a066' });
      // the outback wind across the whole pitch: dust devils and painted dots blowing by
      if (Math.random() < 0.6) fx.emit({ shape: 'smoke', x: fx.rand(0, s.C.W), y: s.C.GROUND_Y - fx.rand(0, 30), vx: fx.rand(-60, 60), vy: -fx.rand(20, 60), r: 6, r1: 26, life: 1, color: '#e8d3b0', alpha: 0.7, layer: 'back' });
      if (Math.random() < 0.7) fx.emit({ shape: 'sq', x: fx.rand(0, s.C.W), y: fx.rand(40, s.C.GROUND_Y - 40), vx: (pw.dir || 1) * fx.rand(80, 200), vy: fx.rand(-20, 20), spin: 6, r: 4, life: 0.9, color: ['#d9a066', '#1f8a70', '#b33a3a', '#e8d3b0'][Math.floor(Math.random() * 4)], layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      lightUp(s, ev.x, ev.y, { c1: '#d9a066', c2: '#b33a3a', r: 190, reach: 380, n: 18 });
      fx.burst(ev.x, ev.y, 34, { shape: 'shard', speed: 440, r: 7, spin: 20, grav: 900, life: 0.9, color: '#8b5a2b', color2: '#5c3a1e' });
      fx.burst(ev.x, ev.y, 16, { shape: 'sq', speed: 300, r: 5, grav: 700, life: 0.8, color: '#1f8a70', color2: '#b33a3a' });
      fx.confetti(ev.x, ev.y, 30, ['#d9a066', '#1f8a70', '#b33a3a', '#e8d3b0']);
      fx.ring(ev.x, ev.y, { color: '#d9a066', r1: 170, life: 0.5, w: 8 });
      fx.ring(ev.x, ev.y, { color: '#1f8a70', r: 30, r1: 240, life: 0.7, w: 4 });
      fx.ring(ev.x, ev.y, { color: '#b33a3a', r: 40, r1: 360, life: 0.9, w: 6 });
      // painted dots blown out in rings, and three spinning boomerangs flung off it
      for (let j = 0; j < 2; j++) fx.burst(ev.x, ev.y, 12, { shape: 'sq', speed: 260 + j * 200, jitter: 0.05, r: 6, drag: 1, life: 1.1, layer: 'back', color: j ? '#e8d3b0' : '#b33a3a', color2: '#d9a066' });
      for (let i = 0; i < 3; i++) fx.glyph(ev.x, ev.y, '🪃', { r: 40, vx: fx.rand(-320, 320), vy: fx.rand(-420, -220), grav: 700, spin: fx.rand(-14, 14), life: 1.1 });
      stampAt(s, ev.x, ev.y - 80, 'טראח!', { r: 70, color: '#ffe0a8', edge: '#5c3a1e' });
      fx.flash('#e8d3b0', 0.3, 0.22);
      fx.vignette('#d9a066', 0.6, 1.2);
      fx.shake(ev.kind === 'goal' ? 16 : 13, 0.45);
    },

    end(s) {
      const b = s.M.ball, { fx } = s;
      fx.glow(b.x, b.y, 150, '#d9a066', { life: 1.6, alpha: 0.6 });
      fx.ring(b.x, b.y, { color: '#e8d3b0', r: 10, r1: 160, life: 1.2, w: 5 });
      fx.ring(b.x, b.y, { color: '#1f8a70', r: 10, r1: 110, life: 1, w: 4 });
      fx.glow(s.C.W / 2, 150, 200, '#d9a066', { life: 1.4, alpha: 0.45 });
      for (let i = 0; i < fx.n(6); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-18, 18), y: b.y, vy: -30 - i * 6, r: 6, r1: 22, life: 1.2, color: '#e8d3b0', layer: 'back' });
      for (let i = 0; i < fx.n(6); i++) fx.emit({ shape: 'shard', x: b.x, y: b.y, vx: fx.rand(-90, 90), vy: fx.rand(-160, -60), grav: 800, spin: 10, r: 4, life: 1, color: '#8b5a2b' });
    },
  },

  // ── 29 · drill — the mining drill ─────────────────────────────────────────
  drill: {
    theme: 'Mining drill',
    visual: 'steel spiral drill bit with a turning thread, grinding sparks, rock grit and curled metal shavings',
    palette: ['#8a94a6', '#dfe6ee', '#3b4252', '#ffc861', '#7a6a58'],
    doc: {
      fantasy: 'The ball is chucked into a mining drill: whatever stands in its way gets bored straight through.',
      purpose: 'A flat shot at 1.05× power-shot speed that ignores the FIRST block: the blocker takes 0.8× power damage and is lifted and pushed aside, the ball is placed through them and keeps going at 75% of its speed. The second block stops it as normal.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. Flies flat for POWER_SHOT_LIFE (1.6s); one drill-through per shot.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it shoots straight at a keeper on the line, because the keeper is the one it drills through.",
      sequence: {
        anticipation: 'While armed two keylined gears (steel and amber) grind behind the head under a spinning hazard-coloured halo, and a big keylined drill bit vibrates at the champion\'s chest aimed at the far goal, thread turning, its white-hot tip spraying sparks inside keylined motion arcs.',
        activation: 'Cut-in: hazard tape slides in across the top and bottom, two giant gears grind and a giant drill bit slides in, thread whirling, tip white-hot. Then the motor bites: an amber bore beam, a steel-and-amber sunburst plus a black-and-amber one, 70 sparks, grit and shavings, rock bursting out of the grass, two ⚙️ flying off, a big "זזזט!", an amber flash and a shake.',
        main: 'THE DRILL SITE for the whole flight: the sky goes dark, hazard tape runs across the sky and the grass line, four keylined gears grind in the top corners, two amber work-lamps swing their beams onto the drill, rocks rain off the ceiling across the pitch, and the rock tunnel it bores trails behind it — keylined, cracked, a hot amber seam running down it. The ball rides as the chuck of a keylined drill bit 5× its size along its real velocity, air-tunnel rings behind, a white-hot tip throwing sparks, the steel chuck ring on the true ball.',
        impact: "'drilled': a beam straight through the blocker, a white sunburst and a black-amber one, 100+ sparks, shavings, steel confetti and rock chunks, six amber cracks forking out, a huge \"קראנץ׳!\", an amber vignette, a steel flash and a heavy shake. A second block or a goal: \"בום!\", rock chunks, ⚙️ and a ring.",
        aftermath: 'The spent bit smokes: grey fumes, cooling sparks, a steel ring, a gear floating up and a big amber glow fading where it ended.',
        cleanup: 'Sparks die within half a second, fumes and the gear within 1.5s; the site fades with the shot.',
      },
      layers: 'Aura gears, halo, glow, motion arcs and bit; cut-in hazard tape, gears and giant bit; bore beam, sunbursts, stamp, spark cone, rock, ⚙️; flight: sky shade, hazard tape, gears, lamp beams, rock tunnel with cracks, tip and ball glow, tunnel rings, bit, spark fan, chuck (last); back-layer falling rock; drill-through beam, sunbursts, cracks, confetti, rock; fumes and fading glow.',
      camera: 'Shake 11 and an amber flash and vignette on firing; 15 on the drill-through with a 0.15s steel-white flash (α 0.32) and an amber vignette; 12 on a normal block or goal with an amber flash.',
      hud: 'The ordinary meter, armed glow and the super cut-in. No status icon: the power is the shot.',
      audio: 'Fire: a high whining square-wave sweep over a low motor thud. Impact: a harsh grinding sawtooth sweep down with a metallic crack. End: a winding-down whine.',
      counterplay: 'Blocking it costs 0.8× damage and does not stop it, so do not stand in the line: jump it, step off the line, or counter it with a timed kick. A second body in the way still stops it.',
      perf: '≈100 particles on firing, ≤112 on the drill-through, ≤4 per frame in flight, 2 drawGlow per frame, a 22-point path history, one linear gradient, one shadowBlur on the tip.',
      helpers: 'fx.beam, fx.rays, fx.bolt, fx.glow, fx.glyph, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.shake, fx.flash, s.depth; drawGear(), hazardBand(), haloRing(), skyShade(), keyline().',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 300, to: 1400, type: 'square', peak: 0.22, dur: 0.35 }, { k: 'thud', freq: 70, q: 1.2, peak: 0.7, decay: 0.3 }],
      impact: [{ k: 'sweep', from: 1800, to: 500, type: 'sawtooth', peak: 0.4, dur: 0.3, detune: 40 }, { k: 'thud', freq: 3200, q: 6, peak: 0.4, decay: 0.1 }],
      end: [{ k: 'sweep', from: 900, to: 120, type: 'square', peak: 0.1, dur: 0.5 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      // two meshing gears grinding behind the head, then the steel-and-amber halo on top
      const hd = s.depth(p.x, s.headY(p)), hr = s.headR(p);
      g.save();
      drawGear(g, hd.x - p.side * (hr + 8), hd.y - hr * 0.5, 28, 10, s.t * 3, '#8a94a6');
      drawGear(g, hd.x - p.side * (hr + 30), hd.y + hr * 0.5, 18, 8, -s.t * 4.6 + 0.2, '#ffc861');
      g.restore();
      haloRing(g, s, p, ['#ffc861', '#3b4252', '#dfe6ee', '#1d1a16'], { spin: 7, glow: '#ffc861' });
      const x = d.x + p.side * 22, y = d.y - 40 + Math.sin(s.t * 40) * 1.5;   // it vibrates
      const tipX = x + p.side * 72;
      s.fx.drawGlow(g, tipX, y, 46 + Math.sin(s.t * 14) * 8, '#ffc861', 1);
      g.save();
      g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const a = s.t * 12 + i * Math.PI;
        g.globalAlpha = 0.8;
        keyline(g, () => { g.beginPath(); g.ellipse(x + p.side * 30, y, 44, 22, 0, a, a + 1.4); }, '#dfe6ee', 3);
      }
      g.globalAlpha = 1;
      g.translate(x, y); g.scale(p.side, 1);
      drawDrillBit(g, 72, 17, s.t * 10);
      g.restore();
      for (let i = 0; i < 2; i++) if (Math.random() < 0.6) s.fx.emit({ shape: 'streak', x: tipX, y, vx: p.side * s.fx.rand(60, 240), vy: s.fx.rand(-200, 20), grav: 600, w: 3, r: 3, life: 0.35, color: i ? '#ffffff' : '#ffc861', blend: 'lighter' });
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s), side = s.owner.side;
      const x = C.W / 2 - side * 210 + from * (1 - cutEase(k)) * C.W * 0.8, y = C.H * 0.74;
      const tip = x + side * 420;
      // the drill site: hazard tape slides across top and bottom, a giant gear grinds behind
      hazardBand(g, C, 8 + (1 - cutEase(k)) * -40, 26, k * 600, 0.95 * f);
      hazardBand(g, C, C.H - 34 + (1 - cutEase(k)) * 40, 26, -k * 600, 0.95 * f);
      g.save(); g.globalAlpha = f;
      drawGear(g, C.W / 2 + side * 330, C.H * 0.7, 120, 14, k * 5, '#8a94a6');
      drawGear(g, C.W / 2 + side * 170, C.H * 0.9, 70, 10, -k * 8.6, '#ffc861');
      g.restore();
      s.fx.drawGlow(g, tip, y, 140, '#ffc861', 0.9 * f);
      g.save();
      g.globalAlpha = f;
      g.translate(x, y); g.scale(side, 1);
      drawDrillBit(g, 420, 80, k * 40);
      g.fillStyle = '#3b4252'; g.fillRect(-90, -54, 90, 108);
      g.fillStyle = '#ffc861'; g.fillRect(-80, -8, 70, 16);
      // sparks fanning off the tip
      g.strokeStyle = '#ffc861'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.3 + Math.sin(k * 60 + i) * 0.1, L = 60 + (i % 3) * 30;
        g.beginPath(); g.moveTo(420, 0); g.lineTo(420 + Math.cos(a) * L, Math.sin(a) * L); g.stroke();
      }
      g.restore();
    },

    fire(s, at) {
      const { fx, side } = s;
      const fwd = side > 0 ? 0 : Math.PI;
      lightUp(s, at.x, at.y, { c1: '#ffc861', c2: '#dfe6ee', r: 160, vig: '#ffc861', n: 12, spin: 3 });
      fx.beam(at.x, at.y, at.x + side * 380, at.y, { color: '#ffc861', w: 26, life: 0.4 });
      fx.burst(at.x, at.y, 34, { shape: 'streak', speed: 620, spread: 1.0, angle: fwd, grav: 500, color: '#ffc861', color2: '#ffffff', life: 0.4, w: 3, blend: 'lighter' });
      fx.burst(at.x, at.y, 20, { shape: 'sq', speed: 240, spread: 1.6, angle: fwd + Math.PI, grav: 800, r: 4, color: '#7a6a58', life: 0.7 });
      fx.burst(at.x, at.y, 14, { shape: 'shard', speed: 300, grav: 900, spin: 30, r: 5, color: '#dfe6ee', color2: '#8a94a6', life: 0.7 });
      fx.ring(at.x, at.y, { color: '#dfe6ee', r1: 120, life: 0.35, w: 6 });
      fx.ring(at.x, at.y, { color: '#ffc861', r: 20, r1: 260, life: 0.6, w: 8 });
      fx.rays(at.x, at.y, { color: '#1d1a16', color2: '#ffc861', n: 16, r: 50, r1: 480, life: 0.9, spin: 4, alpha: 0.4, blend: null });
      // rock bursts out of the ground under it, and two gears fly off the motor
      fx.burst(at.x, s.C.GROUND_Y - 4, 18, { shape: 'shard', speed: 360, spread: 1.6, angle: -Math.PI / 2, grav: 1100, spin: 18, r: 8, life: 1, color: '#7a6a58', color2: '#3b4252' });
      for (let i = 0; i < 2; i++) fx.glyph(at.x, at.y, '⚙️', { r: 38, vx: fx.rand(-300, 300), vy: fx.rand(-420, -260), grav: 900, spin: fx.rand(-10, 10), life: 1 });
      stampAt(s, at.x, at.y - 110, 'זזזט!', { r: 64, color: '#ffc861', edge: '#3b4252' });
      fx.flash('#ffc861', 0.22, 0.15);
      fx.shake(11, 0.4);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y);
      const pw = b.power;
      const ang = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : (pw.dir > 0 ? 0 : Math.PI);
      const L = b.r * 5, R = b.r * 1.8, off = b.r * 0.5;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const tx = d.x + ca * (off + L), ty = d.y + sa * (off + L);
      const C = s.C, k = clamp(pw.t / 0.25, 0, 1), n = note(pw);
      // THE DRILL SITE for the whole flight: hazard tape across the sky and the grass line,
      // giant gears grinding in both top corners, two amber work-lamps swinging onto the drill,
      // and the rock tunnel it bores left behind it, cracked and glowing hot at the mouth.
      g.save();
      skyShade(g, C, '#1d1a16', 0.55 * k, 230);
      g.restore();
      hazardBand(g, C, 40, 18, s.t * 160, 0.9 * k);
      hazardBand(g, C, C.GROUND_Y + 4, 14, -s.t * 160, 0.85 * k);
      g.save(); g.globalAlpha = k;
      drawGear(g, 40, 110, 64, 12, s.t * 2.4, '#8a94a6');
      drawGear(g, 128, 76, 36, 8, -s.t * 4.3, '#ffc861');
      drawGear(g, C.W - 40, 110, 64, 12, -s.t * 2.4, '#8a94a6');
      drawGear(g, C.W - 128, 76, 36, 8, s.t * 4.3, '#ffc861');
      g.globalCompositeOperation = 'lighter';
      for (const lx of [150, C.W - 150]) {
        const la = Math.atan2(d.y - 60, d.x - lx), w = 0.16;
        g.globalAlpha = 0.24 * k; g.fillStyle = '#ffc861';
        g.beginPath(); g.moveTo(lx, 60); g.lineTo(lx + Math.cos(la - w) * 900, 60 + Math.sin(la - w) * 900); g.lineTo(lx + Math.cos(la + w) * 900, 60 + Math.sin(la + w) * 900); g.closePath(); g.fill();
      }
      g.restore();
      const h = n.h || [];
      if (h.length > 1) {
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        const path = () => { g.beginPath(); g.moveTo(h[0].x, h[0].y); for (let i = 1; i < h.length; i++) g.lineTo(h[i].x, h[i].y); g.lineTo(d.x, d.y); };
        g.globalAlpha = 0.85 * k; path(); g.strokeStyle = INK; g.lineWidth = R * 2.6 + 6; g.stroke();
        path(); g.strokeStyle = '#7a6a58'; g.lineWidth = R * 2.6; g.stroke();
        path(); g.strokeStyle = '#3b4252'; g.lineWidth = R * 1.6; g.stroke();
        g.setLineDash([6, 14]); g.lineDashOffset = -s.t * 300;
        path(); g.strokeStyle = '#ffc861'; g.lineWidth = 3; g.stroke();
        g.setLineDash([]);
        // cracks off the tunnel wall
        g.strokeStyle = INK; g.lineWidth = 2;
        for (let i = 2; i < h.length; i += 3) {
          const sg = i % 2 ? 1 : -1, cx = h[i].x, cy = h[i].y + sg * R * 1.3;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 8, cy + sg * 12); g.lineTo(cx + 2, cy + sg * 22); g.stroke();
        }
        g.restore();
      }
      s.fx.drawGlow(g, d.x, d.y, b.r * 5, '#8a94a6', 0.55);
      s.fx.drawGlow(g, tx, ty, 50 + Math.random() * 10, '#ffc861', 1);
      g.save();
      g.translate(d.x, d.y); g.rotate(ang);
      // the air tunnel it bores, rings spinning away behind it
      g.strokeStyle = '#8a94a6'; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const u = ((s.t * 4 + i / 3) % 1);
        g.globalAlpha = (1 - u) * 0.6;
        g.beginPath(); g.ellipse(-b.r - 8 - u * 50, 0, 4 + u * 3, R * (1.1 - u * 0.4), 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      g.save(); g.translate(off, 0); drawDrillBit(g, L, R, s.t * 26); g.restore();
      // the white-hot tip and a fan of sparks off it
      g.strokeStyle = '#ffc861'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * 0.75 + i * 0.18 + Math.random() * 0.2, len = 10 + Math.random() * 14;
        g.beginPath(); g.moveTo(off + L, 0); g.lineTo(off + L + Math.cos(a) * len, (i % 2 ? 1 : -1) * Math.sin(a) * len); g.stroke();
      }
      g.shadowColor = '#ffc861'; g.shadowBlur = 12; g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(off + L - 2, 0, 4, 0, TAU); g.fill();
      g.shadowBlur = 0;
      // the ball as the steel chuck, drawn last so it is always found
      g.fillStyle = '#3b4252'; g.beginPath(); g.arc(0, 0, b.r + 1, 0, TAU); g.fill();
      g.fillStyle = '#8a94a6'; g.beginPath(); g.arc(0, 0, b.r - 1, 0, TAU); g.fill();
      g.fillStyle = '#dfe6ee'; g.beginPath(); g.arc(-b.r * 0.3, -b.r * 0.35, b.r * 0.35, 0, TAU); g.fill();
      g.fillStyle = '#3b4252';
      for (let i = 0; i < 3; i++) { const a = s.t * 20 + i * TAU / 3; g.fillRect(Math.cos(a) * b.r * 0.6 - 2, Math.sin(a) * b.r * 0.6 - 2, 4, 4); }
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, b.r + 2, 0, TAU); g.stroke();
      g.restore();
    },

    trail(b, s) {
      const { fx } = s, n = note(b.power);
      const d = s.depth(b.x, b.y);
      (n.h || (n.h = [])).push({ x: d.x, y: d.y });
      if (n.h.length > 22) n.h.shift();
      const sp = Math.hypot(b.vx, b.vy) || 1;
      fx.emit({ shape: 'sq', x: b.x - Math.sign(b.vx) * 10, y: b.y + fx.rand(-6, 6), vx: -b.vx * 0.08 + fx.rand(-30, 30), vy: fx.rand(-80, 20), grav: 900, r: 4, life: 0.5, color: '#7a6a58', color2: '#3b4252' });
      fx.emit({ shape: 'streak', x: b.x + b.vx / sp * 66, y: b.y + b.vy / sp * 66, vx: fx.rand(-240, 240), vy: fx.rand(-300, 40), grav: 700, w: 3, r: 3, life: 0.32, color: '#ffc861', color2: '#ffffff', blend: 'lighter' });
      if (Math.random() < 0.5) fx.emit({ shape: 'shard', x: b.x, y: b.y, vx: fx.rand(-60, 60), vy: fx.rand(-140, -40), grav: 900, spin: 25, r: 5, life: 0.5, color: '#dfe6ee' });
      // the mine shakes: rocks rain off the ceiling across the whole pitch
      if (Math.random() < 0.7) fx.emit({ shape: 'shard', x: fx.rand(0, s.C.W), y: s.C.CEIL_Y + 30, vx: fx.rand(-20, 20), vy: fx.rand(40, 140), grav: 900, spin: fx.rand(-12, 12), r: fx.rand(4, 8), life: 0.9, color: '#7a6a58', color2: '#1d1a16', layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      const b = s.M.ball;
      const through = ev.kind === 'drilled';
      const dir = (b.vx || 1) > 0 ? 1 : -1, fwd = dir > 0 ? 0 : Math.PI;
      if (through) {
        lightUp(s, ev.x, ev.y, { c1: '#dfe6ee', c2: '#ffc861', r: 200, reach: 400, n: 16 });
        fx.beam(ev.x - dir * 90, ev.y, ev.x + dir * 240, ev.y, { color: '#ffc861', w: 30, life: 0.35 });
        fx.burst(ev.x, ev.y, 40, { shape: 'streak', speed: 700, spread: 1.8, angle: fwd, grav: 700, color: '#ffc861', color2: '#ffffff', life: 0.4, w: 3, blend: 'lighter' });
        fx.burst(ev.x, ev.y, 20, { shape: 'shard', speed: 340, grav: 900, spin: 30, r: 6, color: '#dfe6ee', color2: '#8a94a6', life: 0.8 });
        fx.confetti(ev.x, ev.y, 24, ['#dfe6ee', '#8a94a6', '#ffc861']);
        fx.ring(ev.x, ev.y, { color: '#dfe6ee', r1: 150, life: 0.35, w: 7 });
        fx.emit({ shape: 'star', x: ev.x, y: ev.y, r: 20, r1: 60, life: 0.2, color: '#ffffff', color2: '#ffc861', blend: 'lighter' });
        // the rock splits: cracks forking out of the hole, chunks thrown off
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + fx.rand(-0.3, 0.3), L = fx.rand(90, 170); fx.bolt(ev.x, ev.y, ev.x + Math.cos(a) * L, ev.y + Math.sin(a) * L, { color: '#ffc861', w: 4, life: 0.35 }); }
        fx.burst(ev.x, ev.y, 12, { shape: 'shard', speed: 420, grav: 1100, spin: 20, r: 9, color: '#7a6a58', color2: '#1d1a16', life: 1 });
        fx.rays(ev.x, ev.y, { color: '#1d1a16', color2: '#ffc861', n: 12, r: 40, r1: 420, life: 0.7, spin: 5, alpha: 0.45, blend: null });
        stampAt(s, ev.x, ev.y - 90, 'קראנץ׳!', { r: 70, color: '#dfe6ee', edge: '#3b4252' });
        fx.vignette('#ffc861', 0.6, 1);
        fx.shake(15, 0.45);
        fx.flash('#dfe6ee', 0.32, 0.15);
      } else {
        lightUp(s, ev.x, ev.y, { c1: '#ffc861', c2: '#8a94a6', r: 170, reach: 340, n: 14 });
        fx.burst(ev.x, ev.y, 30, { shape: 'sq', speed: 360, grav: 900, r: 5, color: '#7a6a58', color2: '#3b4252', life: 0.8 });
        fx.burst(ev.x, ev.y, 26, { shape: 'streak', speed: 520, grav: 600, color: '#ffc861', life: 0.35, w: 3, blend: 'lighter' });
        fx.confetti(ev.x, ev.y, 20, ['#8a94a6', '#ffc861', '#7a6a58']);
        fx.ring(ev.x, ev.y, { color: '#8a94a6', r1: 160, life: 0.45, w: 7 });
        fx.burst(ev.x, ev.y, 16, { shape: 'shard', speed: 380, grav: 1100, spin: 20, r: 8, color: '#7a6a58', color2: '#1d1a16', life: 1 });
        for (let i = 0; i < 2; i++) fx.glyph(ev.x, ev.y, '⚙️', { r: 36, vx: fx.rand(-300, 300), vy: fx.rand(-400, -240), grav: 900, spin: fx.rand(-10, 10), life: 1 });
        fx.ring(ev.x, ev.y, { color: '#ffc861', r: 20, r1: 280, life: 0.6, w: 6 });
        stampAt(s, ev.x, ev.y - 90, 'בום!', { r: 68, color: '#ffc861', edge: '#3b4252' });
        fx.flash('#ffc861', 0.25, 0.15);
        fx.shake(12, 0.4);
      }
    },

    end(s) {
      const b = s.M.ball, { fx } = s;
      fx.glow(b.x, b.y, 130, '#ffc861', { life: 1.5, alpha: 0.6 });
      fx.ring(b.x, b.y, { color: '#8a94a6', r: 10, r1: 130, life: 1, w: 5 });
      fx.glyph(b.x, b.y - 10, '⚙️', { r: 30, vy: -60, spin: 3, life: 1.3 });
      for (let i = 0; i < fx.n(6); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-10, 10), y: b.y, vy: -40 - i * 8, vx: fx.rand(-8, 8), r: 5, r1: 22, life: 1.4, color: '#3b4252', layer: 'back' });
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'dot', x: b.x, y: b.y, vx: fx.rand(-80, 80), vy: fx.rand(-140, 0), grav: 800, r: 2, life: 0.7, color: '#ffc861', blend: 'lighter' });
    },
  },

  // ── 30 · goalmagnet — the black hole ──────────────────────────────────────
  goalmagnet: {
    theme: 'Black hole',
    visual: 'accretion-disk swirl in the goal mouth, a see-through event horizon, spaghettified streaks and gravitational-lensing rings',
    palette: ['#12061f', '#ff5e3a', '#ffc29a', '#3fa7d6', '#ecf6ff'],
    doc: {
      fantasy: 'A black hole opens in the goal the champion attacks, and everything nearby is falling into it — the ball first.',
      purpose: 'A struck shot (0.9× kick, lift 0.6) plus 3.5s of pull: the ball is drawn toward a point 18px inside the attacked goal line at 45% of the goal height, with 0.9× ball-gravity strength, anywhere within 560px.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The pull lasts 3.5s whatever happens to the ball; it ends early only on a goal.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it fires it close to the goal so the 560px pull has the whole 3.5s to work.",
      sequence: {
        anticipation: 'While armed a spinning orange-blue halo rings the champion\'s head, a mini event horizon with a keylined hot disk orbits it in an orange glow, and a big blue lensing glow and rings already pulse in the goal it attacks.',
        activation: 'Cut-in: a giant accretion disk swirls under the band round a dark core and a photon ring. Then an implosion: 30 streaks falling INTO the ball and 28 more pouring from all over the pitch into the goal, an orange pull beam, a big orange bloom and an inward white ring at the hole, a reverse-spinning sunburst, a "שלורפ!" stamp, a dark grade (α 0.3, 0.6s), an orange vignette and a shake.',
        main: 'THE SKY FALLS IN for 3.5s: the pitch darkens (α 0.16) and the sky goes to deep space; 36 stars are torn off it on shrinking orbits; four giant keylined spiral arms of orange and blue gas wind across the pitch into the goal, dashes streaming inward; a blue-white relativistic jet shoots from the hole to the top of the screen; a huge tilted accretion disk circles it; a dark event-horizon shadow sits behind the net; over the net a blazing keylined Einstein ring, the dashed inner disk and photon ring — strokes only, so the mouth stays see-through. The ball is stretched toward the hole while in range.',
        impact: "'land': a reverse sunburst and a big ring out of the hole, lensing rings, a blue bloom, 24 streaks falling in, 24 stars, a \"חור שחור!\" stamp, a blue vignette and a shake.",
        aftermath: 'The hole evaporates: white and blue blooms, two spreading rings and 30 stars — or, cut short by a goal, it goes supernova: a sunburst, star confetti and a "בום!" stamp.',
        cleanup: 'The drawn hole, spiral and jet fade over the last 0.4s; particles run out within 1.5s.',
      },
      layers: 'Aura halo, glow and orbiting horizon, goal glow and rings; cut-in disk; implosion streaks, beam, sunburst, stamp; back: scene darkening, sky shade, infalling stars, spiral arms, jet, outer disk, warped grid, hole glows, event-horizon shadow (behind the net, the ball and bodies — so it hides only the backdrop), spaghetti tether; over the net: lensing rings, disk dashes, photon ring, lensed arc, Einstein ring — strokes only; infalling streaks.',
      camera: 'Shake 9, a 0.6s dark-violet grade (α 0.3) and an orange vignette on firing, shake 7 and a blue vignette as it lands; only the α 0.16 darkening while it holds, so the goal stays readable.',
      hud: 'The engine\'s status pill does not show (no target player); the disk itself fading out is the time-left.',
      audio: 'Fire: a deep falling sine sweep with a sub thud. Impact: a reversed-sounding rising sweep. End: a thin high blip as it evaporates.',
      counterplay: 'Stand between the ball and the hole: the pull only moves the ball, not you, so a body on the line still blocks, and a clearance AWAY hard enough beats 0.9g. It stops after 3.5s.',
      perf: "≈95 particles on firing, ≤60 on landing, ≤3 per frame while held, 4 drawGlow per frame, one radial and two linear gradients per frame, 36 star strokes, no shadowBlur.",
      helpers: "fx.beam, fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.ring (inward with r1<r), fx.burst, fx.tint, fx.shake, s.depth; haloRing(), skyShade(), keyline(); holePoint() mirrors EFFECTS.pull.",
    },
    sounds: {
      fire: [{ k: 'sweep', from: 220, to: 40, type: 'sine', peak: 0.7, dur: 0.8 }, { k: 'thud', freq: 50, q: 0.6, peak: 0.8, decay: 0.7 }],
      impact: [{ k: 'sweep', from: 60, to: 320, type: 'triangle', peak: 0.35, dur: 0.5 }],
      end: [{ k: 'blip', freq: 1800, type: 'sine', peak: 0.12, dur: 0.18 }, { k: 'sweep', from: 1200, to: 2600, type: 'sine', peak: 0.08, dur: 0.25 }],
    },

    aura(g, p, s) {
      const hh = haloRing(g, s, p, ['#ff5e3a', '#12061f', '#3fa7d6', '#ffc29a'], { spin: -5 });
      const a = s.t * 3;
      const x = hh.x + Math.cos(a) * (hh.r + 28), y = hh.y + Math.sin(a) * (hh.r + 10);
      s.fx.drawGlow(g, x, y, 60, '#ff5e3a', 0.9);
      // the hole-to-be, already bending light in the target goal
      const hx = attackLine(s.C, p.side) + p.side * 18, hy = s.C.GROUND_Y - s.C.GOAL_H * 0.45;
      s.fx.drawGlow(g, hx, hy, 90 + Math.sin(s.t * 5) * 14, '#3fa7d6', 0.6);
      g.save();
      g.globalAlpha = 1; g.fillStyle = '#12061f';
      g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill();
      keyline(g, () => { g.beginPath(); g.ellipse(x, y, 30, 9, 0.3, s.t * 8, s.t * 8 + 4.5); }, '#ff5e3a', 4);
      g.strokeStyle = '#ffc29a'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 15, 0, TAU); g.stroke();
      for (let i = 0; i < 2; i++) {
        const k = (s.t * 1.5 + i * 0.5) % 1;
        g.globalAlpha = (1 - k) * 0.5; g.strokeStyle = '#3fa7d6'; g.lineWidth = 3;
        g.beginPath(); g.arc(hx, hy, 10 + k * 40, 0, TAU); g.stroke();
      }
      g.restore();
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      const x = C.W / 2 + from * (1 - cutEase(k)) * C.W * 0.7, y = C.H * 0.75;
      s.fx.drawGlow(g, x, y, 260, '#ff5e3a', 0.7 * f);
      s.fx.drawGlow(g, x, y, 150, '#3fa7d6', 0.4 * f);
      g.save();
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        g.setLineDash([40, 26]); g.lineDashOffset = -k * (900 + i * 300);
        g.globalAlpha = (0.95 - i * 0.15) * f; g.strokeStyle = i % 2 ? '#ffc29a' : '#ff5e3a'; g.lineWidth = 10 - i * 2;
        g.beginPath(); g.ellipse(x, y, 330 - i * 60, 60 - i * 10, -0.12, 0, TAU); g.stroke();
      }
      g.setLineDash([]);
      g.globalAlpha = 0.95 * f; g.fillStyle = '#12061f';
      g.beginPath(); g.arc(x, y, 62, 0, TAU); g.fill();
      g.strokeStyle = '#ecf6ff'; g.lineWidth = 5;
      g.beginPath(); g.arc(x, y, 66, 0, TAU); g.stroke();
      g.strokeStyle = '#ff5e3a'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(x, y - 8, 90, 80, -0.12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      const o = s.owner, hx = attackLine(s.C, o.side) + o.side * 18, hy = s.C.GROUND_Y - s.C.GOAL_H * 0.45;
      lightUp(s, at.x, at.y, { c1: '#ff5e3a', c2: '#3fa7d6', r: 170, core: '#ffc29a', vig: '#ff5e3a', n: 16, spin: -2.5 });
      fx.beam(at.x, at.y, hx, hy, { color: '#ff5e3a', color2: '#ffc29a', w: 16, life: 0.5 });
      // an implosion: everything round the ball falls in
      for (let i = 0, n = fx.n(30); i < n; i++) {
        const a = (i / n) * TAU, r = fx.rand(120, 190);
        fx.emit({ shape: 'streak', x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, w: 3, r: 4, life: 0.32, color: i % 2 ? '#ffc29a' : '#ff5e3a', blend: 'lighter' });
      }
      fx.burst(at.x, at.y, 16, { shape: 'dot', speed: 200, r: 3, life: 0.6, drag: 1.5, color: '#3fa7d6', color2: '#ecf6ff', blend: 'lighter' });
      fx.burst(at.x, at.y, 12, { shape: 'sq', speed: 160, r: 4, spin: 8, life: 0.6, drag: 1, color: '#ffc29a', color2: '#12061f' });
      fx.ring(at.x, at.y, { color: '#ff5e3a', r: 140, r1: 4, life: 0.4, w: 6, layer: 'front' });
      fx.ring(at.x, at.y, { color: '#3fa7d6', r: 10, r1: 110, life: 0.55, w: 4 });
      fx.emit({ shape: 'dot', x: at.x, y: at.y, r: 20, r1: 2, life: 0.35, color: '#12061f' });
      // the sky tears open: light from all over the pitch falls into the goal it opened in
      for (let i = 0, n = fx.n(28); i < n; i++) {
        const x = fx.rand(0, s.C.W), y = fx.rand(40, s.C.GROUND_Y), dx = hx - x, dy = hy - y, L = Math.hypot(dx, dy) || 1;
        fx.emit({ shape: 'streak', x, y, vx: dx / L * 900, vy: dy / L * 900, w: 4, r: 5, life: Math.min(0.9, L / 900), color: i % 2 ? '#3fa7d6' : '#ffc29a', blend: 'lighter' });
      }
      fx.glow(hx, hy, 220, '#ff5e3a', { life: 0.9, alpha: 0.9 });
      fx.ring(hx, hy, { color: '#ecf6ff', r: 240, r1: 10, life: 0.6, w: 8, layer: 'front' });
      stampAt(s, at.x, at.y - 110, 'שלורפ!', { r: 64, color: '#ffc29a', edge: '#12061f' });
      fx.tint('#12061f', 0.3, 0.6);
      fx.shake(9, 0.4);
    },

    back(g, e, s) {
      const k = fade(e, 0.35, 0.4);
      const h = holePoint(s, e), C = s.C;
      const o = s.M.players[e.owner];
      g.save();
      // the whole pitch darkens under the hole's pull, the sky goes to deep space
      g.globalAlpha = 0.16 * k; g.fillStyle = '#12061f'; g.fillRect(0, 0, C.W, C.H);
      skyShade(g, C, '#12061f', 0.6 * k, 280);
      // stars torn off the sky, spiralling in: each on its own shrinking orbit
      g.lineCap = 'round';
      for (let i = 0; i < STARS.length; i++) {
        const st = STARS[i], u = (st.y + s.t * 0.28 * st.v) % 1, r = 40 + (1 - u) * 620;
        const a = st.x * TAU + u * 5;
        const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * 0.55;
        const x2 = h.x + Math.cos(a - 0.12) * (r + 26), y2 = h.y + Math.sin(a - 0.12) * (r + 26) * 0.55;
        g.globalAlpha = Math.min(1, u * 1.6) * k; g.strokeStyle = st.s > 2 ? '#ffc29a' : '#ecf6ff'; g.lineWidth = st.s;
        g.beginPath(); g.moveTo(x2, y2); g.lineTo(x, y); g.stroke();
      }
      // four giant spiral arms of infalling gas, keylined, their dashes streaming inward
      for (let arm = 0; arm < 4; arm++) {
        const path = () => {
          g.beginPath();
          for (let j = 0; j <= 22; j++) {
            const f = j / 22, a = arm * TAU / 4 + s.t * 0.9 + f * 4.4, r = 560 * (1 - f) + 30;
            const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * 0.5;
            j ? g.lineTo(x, y) : g.moveTo(x, y);
          }
        };
        g.setLineDash([]); g.globalAlpha = 0.45 * k; path(); g.strokeStyle = INK; g.lineWidth = 18; g.stroke();
        g.globalAlpha = 0.3 * k; path(); g.strokeStyle = arm % 2 ? '#3fa7d6' : '#ff5e3a'; g.lineWidth = 14; g.stroke();
        g.setLineDash([26, 14]); g.lineDashOffset = -s.t * 260;
        g.globalAlpha = 0.9 * k; path(); g.strokeStyle = arm % 2 ? '#3fa7d6' : '#ffc29a'; g.lineWidth = 6; g.stroke();
      }
      g.setLineDash([]);
      // the relativistic jet: a pillar of blue-white light shot straight up out of the hole
      g.globalCompositeOperation = 'lighter';
      const jw = 22 + Math.sin(s.t * 20) * 4;
      const jg = g.createLinearGradient(0, h.y, 0, 0);
      jg.addColorStop(0, 'rgba(63,167,214,0)'); jg.addColorStop(0.25, 'rgba(63,167,214,0.9)'); jg.addColorStop(1, 'rgba(236,246,255,0.1)');
      g.globalAlpha = 0.75 * k; g.fillStyle = jg;
      g.beginPath(); g.moveTo(h.x - 4, h.y - 30); g.lineTo(h.x - jw, 0); g.lineTo(h.x + jw, 0); g.lineTo(h.x + 4, h.y - 30); g.closePath(); g.fill();
      g.globalAlpha = 0.9 * k; g.fillStyle = '#ecf6ff'; g.fillRect(h.x - 2, 0, 4, h.y - 40);
      g.globalCompositeOperation = 'source-over';
      // the outer accretion disk, huge and tilted, reaching out over the pitch
      for (let i = 0; i < 2; i++) {
        const rx = 230 - i * 70, ry = 52 - i * 14;
        g.globalAlpha = 0.5 * k; g.strokeStyle = INK; g.lineWidth = 12;
        g.beginPath(); g.ellipse(h.x, h.y, rx, ry, -o.side * 0.2, 0, TAU); g.stroke();
        g.setLineDash([30, 12]); g.lineDashOffset = -s.t * (220 + i * 140);
        g.globalAlpha = 0.85 * k; g.strokeStyle = i ? '#ffc29a' : '#ff5e3a'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(h.x, h.y, rx, ry, -o.side * 0.2, 0, TAU); g.stroke();
        g.setLineDash([]);
      }
      // spacetime bending: spokes and rings of a grid all sagging into the hole
      g.strokeStyle = '#3fa7d6'; g.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10 + s.t * 0.4;
        g.globalAlpha = 0.18 * k;
        g.beginPath(); g.moveTo(h.x + Math.cos(a) * 460, h.y + Math.sin(a) * 280);
        g.quadraticCurveTo(h.x + Math.cos(a + 0.6) * 160, h.y + Math.sin(a + 0.6) * 100, h.x + Math.cos(a + 1.2) * 40, h.y + Math.sin(a + 1.2) * 26);
        g.stroke();
      }
      for (let j = 0; j < 4; j++) {
        const u = (s.t * 0.35 + j / 4) % 1, r = 400 * (1 - u) + 36;
        g.globalAlpha = 0.22 * u * k;
        g.beginPath(); g.ellipse(h.x, h.y, r, r * 0.6, 0, 0, TAU); g.stroke();
      }
      g.restore();
      s.fx.drawGlow(g, h.x, h.y, 320, '#3fa7d6', 0.4 * k);
      s.fx.drawGlow(g, h.x, h.y, 160, '#ff5e3a', (0.75 + Math.sin(s.t * 4) * 0.15) * k);
      s.fx.drawGlow(g, h.x, 40, 120, '#ecf6ff', 0.5 * k);
      g.save();
      // the event horizon: dark but see-through, so a ball inside it still reads
      const gr = g.createRadialGradient(h.x, h.y, 2, h.x, h.y, 70);
      gr.addColorStop(0, '#12061f'); gr.addColorStop(0.6, '#12061f'); gr.addColorStop(1, 'rgba(18,6,31,0)');
      g.globalAlpha = 0.88 * k; g.fillStyle = gr;
      g.beginPath(); g.arc(h.x, h.y, 70, 0, TAU); g.fill();
      // (the accretion disk and photon ring are drawn in over(): behind the net they vanished)
      // spaghettification: the ball stretched toward the hole while it is in range
      const b = s.M.ball;
      const dx = h.x - b.x, dy = h.y - b.y, dist = Math.hypot(dx, dy);
      if (dist < e.range && dist > 1) {
        const pull = 1 - dist / e.range, ux = dx / dist, uy = dy / dist;
        const bd = s.depth(b.x, b.y);
        g.globalAlpha = 0.6 * pull * k; g.strokeStyle = '#ffc29a'; g.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          const ox = -uy * i * 7, oy = ux * i * 7;
          g.lineWidth = i ? 3 : 5;
          g.beginPath(); g.moveTo(bd.x + ox, bd.y + oy); g.lineTo(bd.x + ox + ux * (24 + pull * 90), bd.y + oy + uy * (24 + pull * 90)); g.stroke();
        }
      }
      g.restore();
    },

    over(g, e, s) {
      const k = fade(e, 0.35, 0.4);
      const h = holePoint(s, e);
      const o = s.M.players[e.owner];
      g.save();
      // lensing: rings breathing outward over the net — rings only, the mouth stays clear
      g.strokeStyle = '#3fa7d6'; g.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const u = (s.t * 0.8 + i * 0.5) % 1;
        g.globalAlpha = (1 - u) * 0.6 * k;
        g.beginPath(); g.arc(h.x, h.y, 26 + u * 60, 0, TAU); g.stroke();
      }
      // the accretion disk, IN FRONT of the net: flowing dashes on a tilted ellipse over a dark
      // keyline, hot outside, pale inside. Thin strokes only, so a ball in the mouth still reads.
      const tilt = -o.side * 0.25;
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const rx = 60 - i * 13, ry = 13 - i * 2.5;
        g.setLineDash([]);
        g.globalAlpha = 0.45 * k; g.strokeStyle = '#12061f'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(h.x, h.y, rx, ry, tilt, 0, TAU); g.stroke();
        g.setLineDash([10, 8]);
        g.lineDashOffset = -s.t * (90 + i * 50);
        g.globalAlpha = (0.95 - i * 0.15) * k;
        g.strokeStyle = i === 2 ? '#ffc29a' : '#ff5e3a';
        g.lineWidth = 3;
        g.beginPath(); g.ellipse(h.x, h.y, rx, ry, tilt, 0, TAU); g.stroke();
      }
      g.setLineDash([]);
      // the photon ring and the lensed far side of the disk arcing over the top
      g.globalAlpha = 0.85 * k; g.strokeStyle = '#ffc29a'; g.lineWidth = 3;
      g.beginPath(); g.arc(h.x, h.y, 22, 0, TAU); g.stroke();
      g.globalAlpha = 0.6 * k; g.strokeStyle = '#ff5e3a'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(h.x, h.y - 4, 32, 28, tilt, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      // the Einstein ring: the whole sky's light bent into one blazing hoop round the hole —
      // a stroke, so the mouth inside it stays see-through
      const er = 74 + Math.sin(s.t * 3) * 4;
      g.globalAlpha = 0.6 * k; g.strokeStyle = INK; g.lineWidth = 12;
      g.beginPath(); g.arc(h.x, h.y, er, 0, TAU); g.stroke();
      g.setLineDash([34, 10]); g.lineDashOffset = s.t * 120;
      g.globalAlpha = 0.95 * k; g.strokeStyle = '#ff5e3a'; g.lineWidth = 6;
      g.beginPath(); g.arc(h.x, h.y, er, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = '#ecf6ff'; g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, er, 0, TAU); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx } = s, h = holePoint(s, e), b = s.M.ball;
      // matter spiralling in from all round
      for (let i = 0; i < 2; i++) {
        if (Math.random() > 0.9) continue;
        const a = fx.rand(0, TAU), r = fx.rand(120, 420);
        const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * 0.6;
        const tx = h.x - x, ty = h.y - y, L = Math.hypot(tx, ty) || 1;
        fx.emit({ shape: i ? 'dot' : 'streak', x, y, vx: tx / L * 280 - ty / L * 90, vy: ty / L * 280 + tx / L * 90, w: 2, r: i ? 2 : 3, life: L / 320, color: i ? '#ecf6ff' : '#ffc29a', color2: '#ff5e3a', blend: 'lighter', layer: 'back' });
      }
      // …and off the ball, while the pull has it
      const dx = h.x - b.x, dy = h.y - b.y, dist = Math.hypot(dx, dy);
      if (dist < e.range && dist > 1 && Math.random() < 0.6) {
        fx.emit({ shape: 'streak', x: b.x, y: b.y, vx: dx / dist * 340, vy: dy / dist * 340, w: 3, r: 3, life: 0.3, color: '#3fa7d6', layer: 'back' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const h = ev.e ? holePoint(s, ev.e) : { x: ev.x, y: ev.y };
      fx.glow(h.x, h.y, 160, '#3fa7d6', { life: 0.8, alpha: 0.7 });
      fx.ring(h.x, h.y, { color: '#3fa7d6', r: 20, r1: 180, life: 0.7, w: 5, layer: 'front' });
      fx.ring(h.x, h.y, { color: '#ffc29a', r: 160, r1: 10, life: 0.5, w: 4 });
      for (let i = 0, n = fx.n(24); i < n; i++) {
        const a = (i / n) * TAU, r = 140;
        fx.emit({ shape: 'streak', x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * 380, vy: -Math.sin(a) * 266, w: 3, r: 3, life: 0.36, color: i % 3 ? '#ff5e3a' : '#ecf6ff', blend: 'lighter' });
      }
      fx.emit({ shape: 'dot', x: h.x, y: h.y, r: 34, r1: 8, life: 0.4, color: '#12061f', alpha: 0.5, layer: 'back' });
      fx.rays(h.x, h.y, { color: '#3fa7d6', color2: '#ff5e3a', n: 18, r: 40, r1: 520, life: 1, spin: -3, alpha: 0.45 });
      fx.ring(h.x, h.y, { color: '#ff5e3a', r: 30, r1: 320, life: 0.9, w: 7 });
      fx.burst(h.x, h.y, 24, { shape: 'star', speed: 240, r: 6, spin: 6, drag: 1.4, life: 0.9, color: '#ecf6ff', color2: '#3fa7d6', blend: 'lighter' });
      stampAt(s, h.x - s.owner.side * 150, h.y - 150, 'חור שחור!', { r: 50, color: '#3fa7d6', edge: '#12061f', life: 1.1 });
      fx.vignette('#3fa7d6', 0.55, 1.4);
      fx.shake(7, 0.35);
    },

    end(s, info) {
      const { fx } = s;
      const e = info && info.e;
      const h = e ? holePoint(s, e) : { x: s.M.ball.x, y: s.M.ball.y };
      fx.glow(h.x, h.y, 180, '#ecf6ff', { life: 1.5, alpha: 0.7 });
      fx.glow(h.x, h.y, 260, '#3fa7d6', { life: 1.2, alpha: 0.5 });
      fx.ring(h.x, h.y, { color: '#ecf6ff', r: 6, r1: 160, life: 0.8, w: 5 });
      fx.ring(h.x, h.y, { color: '#ff5e3a', r: 6, r1: 240, life: 1.1, w: 4 });
      fx.burst(h.x, h.y, 30, { shape: 'star', speed: 260, r: 5, life: 1.2, drag: 1.5, spin: 5, color: '#ecf6ff', color2: '#3fa7d6', blend: 'lighter' });
      // cut short (a goal swallowed it): the hole goes supernova
      if (e && e.t < e.life - 0.1) {
        lightUp(s, h.x, h.y, { c1: '#ff5e3a', c2: '#ecf6ff', r: 200, reach: 420, n: 18 });
        fx.confetti(h.x, h.y, 36, ['#ff5e3a', '#ffc29a', '#3fa7d6', '#ecf6ff']);
        stampAt(s, h.x - (s.owner.side) * 80, h.y - 110, 'בום!', { r: 58, color: '#ffc29a', edge: '#12061f' });
        fx.shake(10, 0.4);
      }
    },
  },

  // ── 31 · keeperpull — the industrial vacuum ───────────────────────────────
  keeperpull: {
    theme: 'Industrial vacuum',
    visual: 'suction nozzle at midfield, an airflow cone of flowing streamlines, dust bunnies and loose papers sucked along',
    palette: ['#9fd8cb', '#394648', '#8d8472', '#f2efe6', '#5dd39e'],
    doc: {
      fantasy: 'The champion switches on a giant shop vacuum at the halfway line and the keeper is hoovered off his line.',
      purpose: 'A struck shot plus 2.5s of drag: the foe is moved 175px/s toward the middle of the pitch by position (so walking against it still makes slow progress) and runs at 0.8× speed, leaving his goal open.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The drag lasts 2.5s on the other player.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it fires it when the keeper is parked on his line, then shoots at the empty net.",
      sequence: {
        anticipation: "While armed a spinning mint-and-steel halo rings the champion's head with keylined air arcs spiralling into it, a vacuum canister rides on his back with a spinning fan and a blinking light, and its hose nozzle is held forward in a mint glow with intake streaks curling in.",
        activation: "Cut-in: a giant nozzle roars at the band's side with ten streamlines and dust bunnies pouring into it. Then the motor kicks in: a mint suction beam from midfield to the foe, mint sunbursts on him and at the nozzle, an inward white ring, 30 gust streaks plus 16 more, dust, 24 flying papers, 🧦📄🍂🧸 blown off him, a big \"שווווּק!\", a cream flash, a mint vignette and a shake.",
        main: "A HURRICANE INDOORS for 2.5s: the sky over the stands goes dark teal, eight keylined dashed wind lines bend across the whole half into a 1.9× steel nozzle at the halfway line, three spiral arms of air whirlpool into its mouth in a big mint glow, a translucent cone and streamlines run from behind the foe, a suction vortex wraps his body, and socks, papers, leaves, cans and teddies (🧦📄🍂🥫🧸) are hoovered across the sky into the mouth, tumbling, with dust and skid marks dragged along with him.",
        impact: "'land' on the foe: two suction rings cinch round his body, a big mint glow, gust streaks, a puff of dust and a flurry of paper confetti.",
        aftermath: "The motor cuts out and the bag bursts: a big \"פלופ!\", a cough of dust and a mint ring from the nozzle, everything it swallowed (🧦📄🍂🥫🧸) spat back out, a fading glow and papers fluttering down.",
        cleanup: "The wind, whirlpool, cone, vortex and nozzle fade over the last 0.4s of the 2.5s; junk and papers settle within 1.6s.",
      },
      layers: "Aura halo, air arcs, glow, canister, fan, hose and nozzle; cut-in giant nozzle and streamlines; suction beam, sunbursts, stamp, gust, papers, junk glyphs; back: sky shade, keylined wind, whirlpool, nozzle and foe glows, suction cone gradient (α≤0.22), streamlines, vortex, nozzle, skid marks; hoovered junk (back layer), dust bunnies, papers, cinch rings; motor-off burst.",
      camera: "Shake 8, a cream flash and a mint vignette on firing; no tint — the pitch has to stay clear for the open-goal shot.",
      hud: 'The engine\'s status pill over the foe with its 2.5s ring; nothing duplicated here.',
      audio: 'Fire: a rising filtered noise roar (crowd noise body) with a motor square sweep. Impact: a suction thud. End: a descending whine as the motor spins down.',
      counterplay: 'Walk against it: it moves you by position, so you still get 25-30% of your speed back toward goal; jump to stay in the air nearer your line. It lasts only 2.5s.',
      perf: "≈100 particles on firing, ≤50 on landing, ≤3 per frame while held (one junk glyph every ~8 frames), 5 drawGlow per frame, two linear gradients per frame, no shadowBlur.",
      helpers: "fx.beam, fx.rays, fx.glow, fx.glyph, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.flash, fx.shake, g.setLineDash/lineDashOffset, s.depth; haloRing(), skyShade(), keyline().",
    },
    sounds: {
      fire: [{ k: 'crowd', dur: 0.8, peak: 0.35 }, { k: 'sweep', from: 90, to: 420, type: 'square', peak: 0.18, dur: 0.6 }],
      impact: [{ k: 'thud', freq: 180, q: 2, peak: 0.6, decay: 0.2 }],
      end: [{ k: 'sweep', from: 420, to: 60, type: 'square', peak: 0.15, dur: 0.7 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const tx = d.x - p.side * 24, ty = d.y - 54;
      const nx = d.x + p.side * 32, ny = d.y - 18;
      const hh = haloRing(g, s, p, ['#5dd39e', '#394648', '#f2efe6', '#9fd8cb'], { spin: 9 });
      // the air round the head already spiralling into the hose
      g.save(); g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = -s.t * 7 * p.side + i * TAU / 3;
        g.globalAlpha = 0.85;
        keyline(g, () => { g.beginPath(); g.arc(hh.x, hh.y, hh.r + 16 + i * 5, a, a + 1.3); }, i % 2 ? '#9fd8cb' : '#f2efe6', 3, '#1e3a36');
      }
      g.restore();
      s.fx.drawGlow(g, nx + p.side * 16, ny, 60 + Math.sin(s.t * 10) * 8, '#5dd39e', 0.85);
      g.save();
      g.globalAlpha = 1;
      // the canister on the back, keylined in mint so it reads on a dark stand
      g.fillStyle = '#394648'; g.fillRect(tx - 10, ty, 20, 36);
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 3; g.strokeRect(tx - 10, ty, 20, 36);
      g.fillStyle = '#9fd8cb'; g.fillRect(tx - 10, ty + 5, 20, 3);
      g.fillStyle = (s.t * 4) % 1 < 0.5 ? '#5dd39e' : '#f2efe6'; g.fillRect(tx - 3, ty - 4, 6, 4);
      // the motor fan, spinning
      g.strokeStyle = '#f2efe6'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = s.t * 20 + i * TAU / 3;
        g.beginPath(); g.moveTo(tx, ty + 22); g.lineTo(tx + Math.cos(a) * 7, ty + 22 + Math.sin(a) * 7); g.stroke();
      }
      // the hose round to the nozzle
      g.strokeStyle = '#8d8472'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(tx, ty + 34); g.quadraticCurveTo(d.x, d.y + 2, nx, ny); g.stroke();
      g.fillStyle = '#394648';
      g.beginPath(); g.moveTo(nx, ny - 5); g.lineTo(nx + p.side * 18, ny - 13); g.lineTo(nx + p.side * 18, ny + 13); g.lineTo(nx, ny + 5); g.closePath(); g.fill();
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 2; g.stroke();
      // intake streaks curling into the mouth
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const u = (s.t * 2.4 + i / 5) % 1, r = 44 * (1 - u);
        g.globalAlpha = u * 0.8;
        g.beginPath(); g.moveTo(nx + p.side * (14 + r), ny + (i - 2) * r * 0.4); g.lineTo(nx + p.side * (20 + r * 0.6), ny + (i - 2) * r * 0.25); g.stroke();
      }
      g.restore();
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      const x = C.W / 2 + from * 250 + from * (1 - cutEase(k)) * C.W * 0.5, y = C.H * 0.75;
      const face = -from;                                            // the mouth faces the far side
      s.fx.drawGlow(g, x + face * 90, y, 170, '#5dd39e', 0.75 * f);
      g.save();
      // streamlines pouring in from the far side
      g.setLineDash([30, 20]); g.lineDashOffset = k * 1400;
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 6; g.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const sy = y - 150 + i * 33;
        g.globalAlpha = 0.65 * f;
        g.beginPath(); g.moveTo(x + face * 700, sy); g.quadraticCurveTo(x + face * 300, sy, x + face * 90, y + (i - 4.5) * 8); g.stroke();
      }
      g.setLineDash([]);
      // dust bunnies riding the stream
      g.fillStyle = '#8d8472';
      for (let i = 0; i < 6; i++) {
        const u = (k * 2 + i / 6) % 1;
        g.globalAlpha = 0.9 * f;
        g.beginPath(); g.arc(x + face * (620 - u * 520), y - 110 + i * 42 + (1 - u) * 0, 12 - u * 6, 0, TAU); g.fill();
      }
      // the nozzle
      g.globalAlpha = f;
      g.fillStyle = '#394648';
      g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x + face * 100, y - 120); g.lineTo(x + face * 100, y + 120); g.lineTo(x, y + 60); g.closePath(); g.fill();
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#5dd39e'; g.fillRect(x + face * 100 - 6, y - 120, 12, 240);
      g.fillStyle = '#8d8472'; g.fillRect(x - face * 200 - 100, y - 24, 200, 48);
      g.restore();
    },

    fire(s, at) {
      const { fx } = s, q = s.foe;
      const dir = Math.sign(s.C.W / 2 - q.x) || -q.side;
      const mx = s.C.W / 2 - dir * 14, my = s.C.GROUND_Y - 26;
      lightUp(s, q.x, q.y - 40, { c1: '#5dd39e', c2: '#9fd8cb', r: 160, core: '#f2efe6', vig: '#5dd39e', n: 14 });
      fx.glow(mx, my, 120, '#9fd8cb', { life: 0.8 });
      fx.beam(mx, my, q.x, q.y - 30, { color: '#5dd39e', color2: '#f2efe6', w: 30, life: 0.5 });
      fx.burst(q.x, q.y - 30, 30, { shape: 'streak', speed: 480, spread: 0.7, angle: dir > 0 ? 0 : Math.PI, color: '#9fd8cb', life: 0.4, w: 3 });
      fx.burst(q.x, q.y - 2, 14, { shape: 'smoke', speed: 110, spread: 1.4, angle: dir > 0 ? 0 : Math.PI, r: 6, r1: 20, life: 0.8, color: '#8d8472', layer: 'back' });
      fx.confetti(q.x, q.y - 40, 24, ['#f2efe6', '#9fd8cb', '#5dd39e', '#8d8472'], { vx: dir * 300 });
      fx.ring(at.x, at.y, { color: '#5dd39e', r1: 110, life: 0.4, w: 5 });
      fx.ring(q.x, q.y - 30, { color: '#9fd8cb', r: 110, r1: 20, life: 0.4, w: 5, layer: 'front' });
      fx.rays(mx, my - 30, { color: '#5dd39e', color2: '#f2efe6', n: 16, r: 50, r1: 520, life: 0.9, spin: -dir * 4, alpha: 0.45 });
      fx.ring(mx, my - 30, { color: '#f2efe6', r: 280, r1: 10, life: 0.6, w: 8, layer: 'front' });
      fx.burst(mx, my - 30, 16, { shape: 'streak', speed: 520, r: 5, w: 4, life: 0.35, color: '#9fd8cb', color2: '#f2efe6' });
      for (let i = 0; i < 4; i++) fx.glyph(q.x, q.y - 40, ['🧦', '📄', '🍂', '🧸'][i], { r: 34, vx: dir * fx.rand(200, 420), vy: fx.rand(-360, -140), grav: 500, spin: fx.rand(-10, 10), life: 1 });
      stampAt(s, q.x, q.y - 150, 'שווווּק!', { r: 64, color: '#9fd8cb', edge: '#394648' });
      fx.flash('#f2efe6', 0.2, 0.15);
      fx.shake(8, 0.35);
    },

    back(g, e, s) {
      const k = fade(e, 0.2, 0.4);
      const q = s.M.players[e.target];
      const dir = Math.sign(s.C.W / 2 - q.x) || 1;
      const G = s.C.GROUND_Y;
      const mx = s.C.W / 2 - dir * 14, my = G - 30;                 // the nozzle mouth, facing the foe
      const fd = s.depth(q.x, q.y);
      const far = fd.x - dir * 80;
      const edge = dir > 0 ? 0 : s.C.W;
      s.fx.drawGlow(g, mx - dir * 30, my, 170, '#5dd39e', 0.8 * k);
      s.fx.drawGlow(g, fd.x, fd.y - 40, 110, '#9fd8cb', 0.55 * k);
      s.fx.drawGlow(g, (fd.x + mx) / 2, G - 70, 200, '#9fd8cb', 0.35 * k);
      g.save();
      // A HURRICANE INDOORS: the sky over the foe's half tinted mint and every line of air in it
      // bent into the mouth — keylined dashes, so the wind reads on a bright stand too.
      skyShade(g, s.C, '#1e3a36', 0.45 * k, 300);
      g.lineCap = 'round';
      g.setLineDash([22, 18]); g.lineDashOffset = s.t * 420 * dir;
      for (let i = 0; i < 8; i++) {
        const y = s.C.CEIL_Y + 40 + i * 44;
        const path = () => { g.beginPath(); g.moveTo(edge, y); g.bezierCurveTo((edge + mx) / 2, y + Math.sin(s.t * 3 + i) * 20, mx - dir * 120, my + (i - 3.5) * 30, mx - dir * 20, my + (i - 3.5) * 5); };
        g.globalAlpha = 0.35 * k; path(); g.strokeStyle = '#1e3a36'; g.lineWidth = 7; g.stroke();
        g.globalAlpha = 0.75 * k; path(); g.strokeStyle = i % 2 ? '#f2efe6' : '#9fd8cb'; g.lineWidth = 3; g.stroke();
      }
      // the whirlpool at the mouth: spiral arms of air wound into it
      g.setLineDash([16, 10]); g.lineDashOffset = -s.t * 300;
      for (let arm = 0; arm < 3; arm++) {
        g.globalAlpha = 0.8 * k; g.strokeStyle = arm % 2 ? '#5dd39e' : '#f2efe6'; g.lineWidth = 4;
        g.beginPath();
        for (let j = 0; j <= 16; j++) {
          const f = j / 16, a = arm * TAU / 3 - s.t * 6 * dir + f * 5 * dir, r = 150 * (1 - f) + 10;
          const x = mx - dir * 30 + Math.cos(a) * r, y = my - 30 + Math.sin(a) * r * 0.7;
          j ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      // the suction cone from the mouth out past the foe
      g.setLineDash([]);
      const gr = g.createLinearGradient(mx, 0, far, 0);
      gr.addColorStop(0, '#9fd8cb'); gr.addColorStop(1, 'rgba(159,216,203,0)');
      g.globalAlpha = 0.22 * k; g.fillStyle = gr;
      g.beginPath(); g.moveTo(mx, my - 16); g.lineTo(far, G - 140); g.lineTo(far, G); g.lineTo(mx, my + 16); g.closePath(); g.fill();
      // streamlines, their dashes flowing into the mouth
      g.setLineDash([12, 10]);
      g.lineDashOffset = s.t * 200;
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const sy = G - 8 - i * 28;
        g.globalAlpha = (0.6 - Math.abs(i - 2) * 0.1) * k;
        g.beginPath(); g.moveTo(mx, my + (i - 2) * 4);
        g.quadraticCurveTo((mx + fd.x) / 2, sy + (my - sy) * 0.3, far, sy);
        g.stroke();
      }
      // the suction vortex wrapped round his body
      g.setLineDash([14, 10]); g.lineDashOffset = -s.t * 240;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 0.55 * k; g.strokeStyle = i % 2 ? '#5dd39e' : '#9fd8cb';
        g.beginPath(); g.ellipse(fd.x, fd.y - 12 - i * 18, 34 + i * 6, 9, 0, 0, TAU); g.stroke();
      }
      g.setLineDash([]);
      // the nozzle: a big steel funnel on a stand at the halfway line
      g.globalAlpha = 0.95 * k;
      g.save(); g.translate(mx, G); g.scale(1.9, 1.9); g.translate(-mx, -G);
      g.fillStyle = '#394648';
      g.beginPath(); g.moveTo(mx, my - 26); g.lineTo(mx + dir * 40, my - 11); g.lineTo(mx + dir * 40, my + 11); g.lineTo(mx, my + 26); g.closePath(); g.fill();
      g.strokeStyle = '#9fd8cb'; g.lineWidth = 3; g.stroke();
      g.fillRect(Math.min(mx + dir * 40, mx + dir * 68), my - 8, 28, 16);
      g.fillStyle = '#5dd39e'; g.fillRect(mx - 3, my - 26, 6, 52);
      g.fillStyle = (s.t * 5) % 1 < 0.5 ? '#5dd39e' : '#f2efe6'; g.fillRect(mx + dir * 52 - 3, my - 16, 6, 6);
      g.fillStyle = '#8d8472'; g.fillRect(mx + dir * 54 - 3, my + 8, 6, G - my - 8);
      g.restore();
      // skid marks where he is dragged
      g.globalAlpha = 0.55 * k; g.strokeStyle = '#8d8472'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(fd.x, G - 1); g.lineTo(fd.x - dir * 44, G - 1); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx } = s, q = s.M.players[e.target];
      const dir = Math.sign(s.C.W / 2 - q.x) || 1;
      const G = s.C.GROUND_Y;
      if (Math.random() < 0.6) fx.emit({ shape: 'smoke', x: q.x - dir * 8, y: G - 3, vx: dir * 70, vy: -20, r: 3, r1: 11, life: 0.5, color: '#8d8472', layer: 'back' });
      if (Math.random() < 0.5) {
        const paper = Math.random() < 0.5;
        fx.emit({ shape: paper ? 'confetti' : 'smoke', x: q.x - dir * fx.rand(40, 110), y: G - fx.rand(10, 130), vx: dir * fx.rand(280, 380), vy: fx.rand(-20, 20), spin: 12, r: paper ? 6 : 6, r1: paper ? null : 3, life: 0.9, color: paper ? '#f2efe6' : '#8d8472', layer: 'back' });
      }
      if (Math.random() < 0.3) fx.emit({ shape: 'streak', x: q.x - dir * 60, y: q.y - fx.rand(10, 90), vx: dir * 420, vy: 0, w: 3, r: 4, life: 0.3, color: '#9fd8cb' });
      // junk off the whole half, hoovered across the sky into the mouth, tumbling
      if (Math.random() < 0.12) {
        const mx = s.C.W / 2 - dir * 40, my = G - 60;
        const x = dir > 0 ? fx.rand(-20, 120) : s.C.W - fx.rand(-20, 120), y = fx.rand(60, G - 40), T = fx.rand(0.9, 1.3);
        fx.glyph(x, y, ['🧦', '📄', '🍂', '🥫', '🧸'][Math.floor(Math.random() * 5)], { r: fx.rand(26, 38), vx: (mx - x) / T, vy: (my - y) / T, spin: fx.rand(-8, 8), life: T, layer: 'back' });
      }
    },

    impact(s, ev) {
      const { fx } = s, q = s.M.players[ev.on ?? s.foe.index];
      fx.glow(q.x, q.y - 30, 160, '#5dd39e', { life: 0.8 });
      fx.ring(q.x, q.y - 22, { color: '#9fd8cb', r: 70, r1: 18, life: 0.4, w: 5, layer: 'front' });
      fx.ring(q.x, q.y - 22, { color: '#f2efe6', r: 160, r1: 20, life: 0.6, w: 6, layer: 'front' });
      fx.burst(q.x, q.y - 40, 14, { shape: 'streak', speed: 380, w: 3, r: 5, life: 0.35, color: '#f2efe6' });
      fx.burst(q.x, q.y - 2, 16, { shape: 'smoke', speed: 130, spread: 1.6, angle: -Math.PI / 2, r: 5, r1: 16, life: 0.8, drag: 2, color: '#8d8472', layer: 'back' });
      fx.confetti(q.x, q.y - 30, 20, ['#f2efe6', '#9fd8cb', '#5dd39e']);
    },

    end(s) {
      const { fx } = s, G = s.C.GROUND_Y, x = s.C.W / 2;
      fx.glow(x, G - 50, 160, '#9fd8cb', { life: 1.5, alpha: 0.7 });
      fx.burst(x, G - 50, 24, { shape: 'smoke', speed: 160, r: 8, r1: 30, life: 1.3, drag: 2, color: '#8d8472', layer: 'back' });
      fx.ring(x, G - 50, { color: '#5dd39e', r: 10, r1: 200, life: 0.9, w: 6 });
      // the bag bursts: everything it swallowed spat back out
      for (let i = 0; i < fx.n(5); i++) fx.glyph(x, G - 60, ['🧦', '📄', '🍂', '🥫', '🧸'][i % 5], { r: 32, vx: fx.rand(-300, 300), vy: fx.rand(-460, -240), grav: 800, spin: fx.rand(-10, 10), life: 1.3 });
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'confetti', x: x + fx.rand(-80, 80), y: G - fx.rand(80, 160), vx: fx.rand(-30, 30), vy: 10, grav: 60, spin: fx.rand(-6, 6), r: 6, life: 1.6, color: '#f2efe6' });
      stampAt(s, x, G - 120, 'פלופ!', { r: 58, color: '#f2efe6', edge: '#394648', life: 0.9 });
    },
  },

  // ── 32 · vampire — gothic blood ───────────────────────────────────────────
  vampire: {
    theme: 'Gothic vampire',
    visual: 'crimson mist, circling bats, blood droplets flying foe to owner, a fang bite and a pale moon over a withered victim',
    palette: ['#7a0010', '#c1121f', '#2b0a12', '#efe8f5', '#5a1a3a'],
    doc: {
      fantasy: 'The champion is a vampire: one touch and he feeds, draining the rival\'s blood into his own veins under a blood moon.',
      purpose: 'Takes 45% health off the foe and heals the champion by what was actually dealt, then stops the foe\'s health regen (regen 0) for 5s — the only power that swings health both ways at once. Also strikes the ball goalward.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The drain is instant; the regen block lasts 5s.',
      bot: "Arms on 'any' moment and plays as a 'brawler' — it goes for the man to earn the meter, then fires it whenever it gets the touch.",
      sequence: {
        anticipation: "While armed a spinning blood-red halo rings the champion's head with eight white fangs bristling off it, a dark cape with a crimson lining flares behind him, a crimson glow pools at his feet, a pale moon halo rims his head and five bats circle him.",
        activation: "Cut-in: a giant blood moon rises under the band with a flock of bats crossing it. Then the bite: a crimson drain beam from the foe to the champion, a crimson sunburst plus a black-crimson one, a big ring off the foe and an inward white ring on the champion, 36 blood drops, stars, scattering bats (shards and 🦇), a huge \"ביס!\", a crimson flash (α 0.3), a night grade (α 0.3, 0.6s), a crimson vignette and a sharp shake.",
        main: "BLOOD MOON NIGHT for the 5s: the pitch darkens (α 0.2) and the sky goes black-red; a huge keylined crimson moon with craters and a double glow hangs over two castle silhouettes with lit windows on the skyline, a swarm of nine bats wheels round it, blood drips stretch and fall off the top of the screen, and fog rolls across the grass; glowing pulses run the leech line from the foe to the champion; big fangs flash at the foe, eight droplets fly the arc foe → owner and light him red, and the foe stands withered in mist with a cracked halo and two bats.",
        impact: "'land' on the foe: a big crimson glow, two rings, a spray of droplets and four 🦇 bursting off him.",
        aftermath: "Dawn breaks: a \"בוקר!\" stamp, a pale sunburst, ring and glow off the foe, the moon's glow fading, bats (🦇) flitting away and the last mist.",
        cleanup: "Night, moon, castles, drips, fog, mist and bats fade over the last 0.5s; droplets fall and die within a second.",
      },
      layers: "Aura halo and fangs, cape, glow, moon halo and bats; cut-in blood moon and bats; drain beam, sunbursts, rings, stamp, blood, bats; back: night fill, sky shade, moon glows, castles, moon, bat swarm, blood drips, fog, withered mist, leech line and its glowing pulses, cracked halo; front: droplets (one shadowBlur), owner glow, fangs, circling bats; mist/drip particles, crossing 🦇.",
      camera: "Shake 8, a 0.2s crimson flash, a 0.6s night grade and a crimson vignette on the bite; the α 0.2 night and the sky shade while it holds.",
      hud: 'The engine\'s status pill over the foe with its 5s ring; the health bars show the 45% themselves.',
      audio: 'Fire: a dark detuned sawtooth sweep down over a wet thud. Impact: a high shriek blip pair (the bats). End: a soft falling triangle sigh.',
      counterplay: 'It is a touch, not a shot — deny the champion the ball when he is armed, or stay at high health so 45% is not a kill. For 5s you do not heal: avoid body blocks until it runs out.',
      perf: "≈95 particles on the bite, ≤40 on landing, ≤3 per frame while held, ≤8 drawGlow per frame, one shadowBlur on the lead droplet, one radial and one linear gradient per frame, 18 drips.",
      helpers: "fx.beam, fx.rays, fx.glow, fx.stamp, fx.glyph, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.flash, fx.tint, fx.shake; drawBat(), drawCastle(), haloRing(), skyShade().",
    },
    sounds: {
      fire: [{ k: 'sweep', from: 500, to: 70, type: 'sawtooth', peak: 0.4, dur: 0.6, detune: 60 }, { k: 'thud', freq: 110, q: 2, peak: 0.6, decay: 0.2 }],
      impact: [{ k: 'blip', freq: 2600, type: 'square', peak: 0.12, dur: 0.06 }, { k: 'blip', freq: 3100, type: 'square', peak: 0.1, dur: 0.05, t: 0.08 }],
      end: [{ k: 'sweep', from: 700, to: 250, type: 'triangle', peak: 0.12, dur: 0.6 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, s.headY(p)), fd = s.depth(p.x, p.y);
      const hr = s.headR(p);
      // a blood-red halo of fangs round the head: the ring, and eight fangs biting in off it
      const hh = haloRing(g, s, p, ['#c1121f', '#12030a', '#ff4d5e', '#5a1a3a'], { spin: -2.5, glow: '#c1121f' });
      g.save();
      for (let i = 0; i < 8; i++) {
        const a = -s.t * 2.5 + i * TAU / 8, r0 = hh.r + 4, L = 14 + Math.sin(s.t * 10 + i) * 3;
        const c = Math.cos(a), sn = Math.sin(a), px = -sn * 5, py = c * 5;
        g.fillStyle = INK;
        g.beginPath(); g.moveTo(hh.x + c * r0 + px * 1.4, hh.y + sn * r0 + py * 1.4); g.lineTo(hh.x + c * (r0 + L + 3), hh.y + sn * (r0 + L + 3)); g.lineTo(hh.x + c * r0 - px * 1.4, hh.y + sn * r0 - py * 1.4); g.closePath(); g.fill();
        g.fillStyle = '#efe8f5';
        g.beginPath(); g.moveTo(hh.x + c * r0 + px, hh.y + sn * r0 + py); g.lineTo(hh.x + c * (r0 + L), hh.y + sn * (r0 + L)); g.lineTo(hh.x + c * r0 - px, hh.y + sn * r0 - py); g.closePath(); g.fill();
      }
      g.restore();
      s.fx.drawGlow(g, fd.x, fd.y - 6, 60, '#c1121f', 0.6 + Math.sin(s.t * 4) * 0.15);
      g.save();
      // the cape, flaring behind the body
      const top = d.y + hr * 0.7, wave = Math.sin(s.t * 5) * 6;
      g.globalAlpha = 0.95; g.fillStyle = '#2b0a12';
      g.beginPath();
      g.moveTo(fd.x - 12, top); g.lineTo(fd.x + 12, top);
      g.quadraticCurveTo(fd.x - p.side * 10, (top + fd.y) / 2, fd.x - p.side * (34 + wave), fd.y - 4);
      g.lineTo(fd.x - p.side * (14 + wave * 0.5), fd.y - 12); g.lineTo(fd.x + p.side * 6, fd.y - 4);
      g.closePath(); g.fill();
      g.strokeStyle = '#c1121f'; g.lineWidth = 3; g.stroke();
      // the pale moon halo, behind the head so only its rim shows
      g.globalAlpha = 0.4 + Math.sin(s.t * 3) * 0.08; g.fillStyle = '#efe8f5';
      g.beginPath(); g.arc(d.x - p.side * 6, d.y - 6, hr + 14, 0, TAU); g.fill();
      g.globalAlpha = 0.5; g.fillStyle = '#5a1a3a';
      g.beginPath(); g.ellipse(p.x, p.y - 2, 36, 8, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.95;
      for (let i = 0; i < 5; i++) {
        const a = s.t * 2.4 + i * TAU / 5;
        drawBat(g, d.x + Math.cos(a) * (hr + 32), d.y + Math.sin(a) * (hr + 14), 12, Math.sin(s.t * 18 + i), '#2b0a12');
      }
      g.restore();
      if (Math.random() < 0.35) s.fx.emit({ shape: 'smoke', x: p.x + s.fx.rand(-24, 24), y: p.y - 2, vy: -18, r: 4, r1: 14, life: 0.8, color: '#7a0010', layer: 'back' });
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      const x = C.W / 2 - from * 180, y = C.H * 0.78 - cutEase(k) * 30;
      s.fx.drawGlow(g, x, y, 260, '#c1121f', 0.85 * f);
      g.save();
      g.globalAlpha = 0.95 * f; g.fillStyle = '#c1121f';
      g.beginPath(); g.arc(x, y, 105, 0, TAU); g.fill();
      g.fillStyle = '#7a0010';
      for (const [cx, cy, r] of [[-30, -20, 20], [35, 25, 14], [10, -50, 10], [-45, 40, 12]]) { g.beginPath(); g.arc(x + cx, y + cy, r, 0, TAU); g.fill(); }
      g.globalAlpha = 0.35 * f; g.strokeStyle = '#efe8f5'; g.lineWidth = 8;
      g.beginPath(); g.arc(x, y, 96, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
      // a flock of bats flying across the moon
      g.globalAlpha = f;
      for (let i = 0; i < 9; i++) {
        const u = (k * 1.3 + i / 9) % 1;
        const bx = x + from * (u - 0.5) * 700, by = y - 60 + Math.sin(u * 9 + i) * 50 + (i % 3) * 25;
        drawBat(g, bx, by, 22 + (i % 3) * 8, Math.sin(k * 60 + i * 2), '#2b0a12');
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s, q = s.foe, o = s.owner;
      lightUp(s, q.x, q.y - 30, { c1: '#c1121f', c2: '#5a1a3a', r: 160, core: '#efe8f5', vig: '#c1121f', n: 14 });
      fx.beam(q.x, q.y - 24, o.x, o.y - 24, { color: '#c1121f', color2: '#efe8f5', w: 22, life: 0.55 });
      fx.burst(q.x, q.y - 20, 36, { shape: 'dot', speed: 300, grav: 900, r: 4, life: 0.8, color: '#c1121f', color2: '#7a0010' });
      fx.burst(o.x, s.headY(o), 16, { shape: 'shard', speed: 300, spread: 2.2, angle: -Math.PI / 2, spin: 20, r: 8, life: 0.7, color: '#2b0a12' });
      for (let i = 0; i < fx.n(6); i++) fx.glyph(o.x + fx.rand(-30, 30), s.headY(o) - 20, '🦇', { r: 26, vx: fx.rand(-220, 220), vy: fx.rand(-240, -120), life: 0.9 });
      fx.burst(q.x, q.y - 10, 12, { shape: 'smoke', speed: 80, r: 6, r1: 22, life: 0.9, drag: 2, color: '#5a1a3a', layer: 'back' });
      fx.ring(at.x, at.y, { color: '#c1121f', r1: 120, life: 0.4, w: 6 });
      fx.rays(q.x, q.y - 30, { color: '#12030a', color2: '#c1121f', n: 14, r: 40, r1: 520, life: 1, spin: -1.5, alpha: 0.5, blend: null });
      fx.ring(q.x, q.y - 30, { color: '#ff4d5e', r: 20, r1: 300, life: 0.8, w: 8 });
      fx.ring(o.x, o.y - 30, { color: '#efe8f5', r: 180, r1: 20, life: 0.6, w: 5, layer: 'front' });
      fx.burst(o.x, o.y - 30, 14, { shape: 'star', speed: 200, r: 6, spin: 6, drag: 1.5, life: 0.9, color: '#ff4d5e', color2: '#efe8f5', blend: 'lighter' });
      stampAt(s, q.x, q.y - 150, 'ביס!', { r: 70, color: '#ff4d5e', edge: '#2b0a12' });
      fx.flash('#c1121f', 0.3, 0.2);
      fx.tint('#2b0a12', 0.3, 0.6);
      fx.shake(8, 0.3);
    },

    back(g, e, s) {
      const k = fade(e, 0.2, 0.5);
      const q = s.M.players[e.target], o = s.M.players[e.owner];
      const qd = s.depth(q.x, q.y), od = s.depth(o.x, o.y);
      const C = s.C;
      // blood-moon night over the whole pitch
      g.save();
      g.globalAlpha = 0.2 * k; g.fillStyle = '#2b0a12'; g.fillRect(0, 0, C.W, C.H);
      skyShade(g, C, '#1a0408', 0.75 * k, 320);
      g.restore();
      // BLOOD MOON NIGHT: a huge moon over two castle silhouettes on the skyline, a swarm of
      // bats wheeling round it, blood dripping off the top of the screen, fog rolling on the grass.
      const mx = C.W / 2, my = 150;
      s.fx.drawGlow(g, mx, my, 280, '#c1121f', 0.8 * k);
      s.fx.drawGlow(g, mx, my, 150, '#ff4d5e', 0.5 * k);
      g.save();
      g.globalAlpha = 0.95 * k;
      drawCastle(g, C.W * 0.2, C.GROUND_Y - 100, 1.05, '#12030a', '#ff4d5e');
      drawCastle(g, C.W * 0.8, C.GROUND_Y - 100, 0.85, '#12030a', '#ffcf5a');
      g.fillStyle = INK; g.beginPath(); g.arc(mx, my, 84, 0, TAU); g.fill();
      g.fillStyle = '#c1121f'; g.beginPath(); g.arc(mx, my, 80, 0, TAU); g.fill();
      g.fillStyle = '#7a0010';
      for (const [cx, cy, r] of [[-24, -18, 16], [28, 22, 11], [8, -46, 8], [-38, 32, 10], [40, -20, 7]]) { g.beginPath(); g.arc(mx + cx, my + cy, r, 0, TAU); g.fill(); }
      g.globalAlpha = 0.5 * k; g.strokeStyle = '#efe8f5'; g.lineWidth = 5;
      g.beginPath(); g.arc(mx, my, 72, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
      // the swarm, wheeling round the moon
      g.globalAlpha = 0.95 * k;
      for (let i = 0; i < 9; i++) {
        const a = s.t * (0.8 + (i % 3) * 0.25) + i * TAU / 9, rr = 110 + (i % 3) * 36;
        drawBat(g, mx + Math.cos(a) * rr * 1.6, my + Math.sin(a) * rr * 0.55, 14 + (i % 3) * 4, Math.sin(s.t * 16 + i), '#12030a');
      }
      // blood dripping off the top of the screen, each drip stretching and falling
      for (let i = 0; i < 18; i++) {
        const x = (i + 0.5) * C.W / 18 + Math.sin(i * 7.3) * 12, sp = 0.5 + ((i * 37) % 10) / 14;
        const u = (s.t * sp + i * 0.31) % 1, L = 14 + ((i * 53) % 30) + u * 26;
        g.fillStyle = INK; g.fillRect(x - 6, 0, 12, L + 2);
        g.beginPath(); g.arc(x, L + 2, 8, 0, TAU); g.fill();
        g.fillStyle = '#c1121f'; g.fillRect(x - 4, 0, 8, L);
        g.beginPath(); g.arc(x, L, 6, 0, TAU); g.fill();
        if (u > 0.55) { const fy = L + (u - 0.55) * 700; g.beginPath(); g.arc(x, fy, 4, 0, TAU); g.fill(); }
      }
      g.fillStyle = '#7a0010'; g.fillRect(0, 0, C.W, 8);
      // fog rolling across the grass
      for (let i = 0; i < 7; i++) {
        const fx0 = ((i * 170 + s.t * (30 + i * 6)) % (C.W + 300)) - 150;
        g.globalAlpha = 0.45 * k; g.fillStyle = i % 2 ? '#5a1a3a' : '#3a0d1d';
        g.beginPath(); g.ellipse(fx0, C.GROUND_Y - 6 - (i % 3) * 8, 150, 26, 0, 0, TAU); g.fill();
      }
      // withered: dark crimson mist pooled round the victim
      const gr = g.createRadialGradient(qd.x, qd.y - 20, 4, qd.x, qd.y - 20, 56);
      gr.addColorStop(0, '#2b0a12'); gr.addColorStop(1, 'rgba(43,10,18,0)');
      g.globalAlpha = 0.5 * k; g.fillStyle = gr;
      g.beginPath(); g.arc(qd.x, qd.y - 20, 56, 0, TAU); g.fill();
      // the leech line: mist flowing from him to the champion for the whole 5s
      const x0 = qd.x, y0 = qd.y - 20, x1 = od.x, y1 = od.y - 20;
      const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 90 + Math.sin(s.t * 3) * 10;
      g.setLineDash([8, 10]); g.lineDashOffset = -s.t * 70 * Math.sign(od.x - qd.x || 1);
      g.globalAlpha = 0.5 * k; g.strokeStyle = '#c1121f'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
      g.setLineDash([]);
      // the cracked halo: a broken dark ring round the head, bigger than it
      const hd = s.depth(q.x, s.headY(q)), hr = s.headR(q);
      g.globalAlpha = 0.75 * k; g.strokeStyle = '#5a1a3a'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; g.beginPath(); g.arc(hd.x, hd.y, hr + 7, a, a + 0.9); g.stroke(); }
      g.restore();
      // glowing pulses of blood running the leech line to him
      for (let i = 0; i < 3; i++) {
        const u = (s.t * 0.7 + i / 3) % 1, w = 1 - u;
        s.fx.drawGlow(g, w * w * x0 + 2 * w * u * cx + u * u * x1, w * w * y0 + 2 * w * u * cy + u * u * y1, 22, '#c1121f', 0.8 * k);
      }
    },

    front(g, e, s) {
      const q = s.M.players[e.target], o = s.M.players[e.owner];
      const k = fade(e, 0.2, 0.5);
      g.save();
      // the feeding: droplets flying the arc foe → owner in the first second
      if (e.t < 1) {
        const x0 = q.x, y0 = q.y - 20, x1 = o.x, y1 = o.y - 20;
        const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 120;
        for (let i = 0; i < 8; i++) {
          const u = clamp((e.t - i * 0.05) / 0.55, 0, 1);
          if (u <= 0 || u >= 1) continue;
          const w = 1 - u;
          const x = w * w * x0 + 2 * w * u * cx + u * u * x1, y = w * w * y0 + 2 * w * u * cy + u * u * y1;
          const tx = 2 * w * (cx - x0) + 2 * u * (x1 - cx), ty = 2 * w * (cy - y0) + 2 * u * (y1 - cy);
          g.save();
          g.translate(x, y); g.rotate(Math.atan2(ty, tx));
          if (i === 0) { g.shadowColor = '#c1121f'; g.shadowBlur = 12; }
          g.fillStyle = '#c1121f';
          g.beginPath(); g.arc(0, 0, 7, Math.PI / 2, -Math.PI / 2, true); g.lineTo(-15, 0); g.closePath(); g.fill();
          g.shadowBlur = 0;
          g.fillStyle = '#efe8f5'; g.fillRect(1, -4, 3, 3);
          g.restore();
        }
        // the champion lit red as the blood arrives
        const lit = clamp((e.t - 0.5) / 0.2, 0, 1) * clamp((1 - e.t) / 0.3, 0, 1);
        if (lit > 0) {
          s.fx.drawGlow(g, o.x, o.y - 24, 70, '#c1121f', lit * 0.9);
          g.globalAlpha = lit * 0.6; g.strokeStyle = '#c1121f'; g.lineWidth = 4;
          g.beginPath(); g.ellipse(o.x, o.y - 14, 28, 22, 0, 0, TAU); g.stroke();
        }
      }
      // the bite: two big fangs on his body, popping in and fading
      if (e.t < 0.8) {
        const pk = Math.min(1, e.t / 0.1) * (1 - e.t / 0.8);
        const bx = q.x, by = q.y - 34, sc = 1.2 + pk * 0.6;
        g.globalAlpha = pk; g.fillStyle = '#efe8f5';
        for (const sg of [-1, 1]) {
          g.beginPath(); g.moveTo(bx + sg * 9 * sc, by); g.lineTo(bx + sg * 3 * sc, by); g.lineTo(bx + sg * 6 * sc, by + 12 * sc); g.closePath(); g.fill();
        }
        g.fillStyle = '#c1121f'; g.fillRect(bx - 7 * sc, by + 12 * sc, 3, 7); g.fillRect(bx + 5 * sc, by + 12 * sc, 3, 7);
      }
      // two bats keep circling the withered victim
      const hd = s.depth(q.x, s.headY(q)), hr = s.headR(q);
      g.globalAlpha = 0.9 * k;
      for (let i = 0; i < 2; i++) {
        const a = -s.t * 2 + i * Math.PI;
        drawBat(g, hd.x + Math.cos(a) * (hr + 24), hd.y - 8 + Math.sin(a) * 12, 10, Math.sin(s.t * 20 + i * 2), '#2b0a12');
      }
      g.restore();
    },

    tick(e, s) {
      const { fx } = s, q = s.M.players[e.target];
      if (Math.random() < 0.5) fx.emit({ shape: 'smoke', x: q.x + fx.rand(-18, 18), y: q.y - fx.rand(0, 20), vy: -24, r: 4, r1: 15, life: 0.9, color: '#5a1a3a', layer: 'back' });
      if (Math.random() < 0.15) fx.emit({ shape: 'dot', x: q.x + fx.rand(-10, 10), y: q.y - 22, vy: 20, grav: 700, r: 3, life: 0.5, color: '#c1121f' });
      // now and then a bat crosses the night sky
      if (Math.random() < 0.012) { const L = Math.random() < 0.5; fx.glyph(L ? -20 : s.C.W + 20, fx.rand(60, 170), '🦇', { r: 24, vx: L ? 260 : -260, vy: fx.rand(-20, 20), life: 4.5, layer: 'back' }); }
    },

    impact(s, ev) {
      const { fx } = s;
      const q = s.M.players[ev.on ?? s.foe.index];
      fx.glow(q.x, q.y - 30, 170, '#c1121f', { life: 0.8 });
      fx.ring(q.x, q.y - 26, { color: '#c1121f', r: 10, r1: 100, life: 0.45, w: 5, layer: 'front' });
      fx.ring(q.x, q.y - 26, { color: '#efe8f5', r: 10, r1: 200, life: 0.7, w: 4, layer: 'front' });
      for (let i = 0; i < 4; i++) fx.glyph(q.x, q.y - 50, '🦇', { r: 30, vx: fx.rand(-260, 260), vy: fx.rand(-300, -140), life: 1 });
      fx.burst(q.x, q.y - 30, 20, { shape: 'dot', speed: 220, spread: 1.8, angle: -Math.PI / 2, grav: 800, r: 3, life: 0.8, color: '#7a0010', color2: '#c1121f' });
    },

    end(s, info) {
      const { fx } = s;
      const q = info && info.e ? s.M.players[info.e.target] : s.foe;
      fx.glow(q.x, q.y - 30, 150, '#efe8f5', { life: 1.4, alpha: 0.55 });
      fx.glow(s.C.W / 2, 150, 240, '#c1121f', { life: 1.4, alpha: 0.5 });
      fx.ring(q.x, q.y - 22, { color: '#efe8f5', r: 16, r1: 160, life: 0.8, w: 5 });
      fx.rays(q.x, q.y - 30, { color: '#efe8f5', color2: '#ff4d5e', n: 12, r: 30, r1: 300, life: 0.9, spin: 1, alpha: 0.35 });
      stampAt(s, q.x, q.y - 150, 'בוקר!', { r: 50, color: '#efe8f5', edge: '#2b0a12', life: 0.9 });
      fx.burst(q.x, s.headY(q), 8, { shape: 'shard', speed: 240, spread: 1.6, angle: -Math.PI / 2, spin: 16, r: 7, life: 0.8, color: '#2b0a12' });
      for (let i = 0; i < fx.n(4); i++) fx.glyph(q.x, s.headY(q) - 20, '🦇', { r: 22, vx: fx.rand(-200, 200), vy: fx.rand(-200, -100), life: 1 });
      fx.burst(q.x, q.y - 10, 6, { shape: 'smoke', speed: 50, r: 6, r1: 20, life: 1.1, drag: 2, color: '#5a1a3a', layer: 'back' });
    },
  },

  // ── 33 · superboot — the Midas golden boot ────────────────────────────────
  superboot: {
    theme: 'Midas golden boot',
    visual: 'gold-plated boot with a trophy-shine glint, drifting gold leaf, a golden starburst on every strong kick',
    palette: ['#ffd700', '#b8860b', '#fff6cc', '#f5c542', '#7a5c12'],
    doc: {
      fantasy: 'King Midas laces up: the champion\'s boot turns to solid gold and everything it kicks flies like a trophy shot.',
      purpose: 'A hard struck shot (1.3× kick, lift 0.7) and then 6s of kicks and headers at 1.5× strength, with the ball allowed to fly 1.35× faster — a window of pure attacking power.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The golden boot lasts 6s on the champion himself.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it fires near the goal and keeps shooting through the 6s.",
      sequence: {
        anticipation: "While armed a spinning gold halo rings the champion's head with a glinting keylined crown hovering on top, and the boot glows gold in a big golden light with spinning rays, a sweeping trophy glint and six gold leaves circling the foot.",
        activation: "Cut-in: a giant golden boot shines under the band, rays spinning behind it and a glint crossing it. Then a golden starburst: two gold sunbursts and a bloom, two rings, 30 gold confetti, 24 gold leaves, sparkle stars and streaks, 👑🏆💰 flung up, a huge \"זהב!\", a pale-gold flash (α 0.3), a gold vignette and a shake.",
        main: "THE MIDAS TOUCH for 6s: the pitch warmed (α 0.08) and the sky turned to a brown-gold treasure vault; fourteen god-rays wheel out from behind the champion, a giant keylined golden crown with jewels and twinkles hangs over his half, 26 gold coins rain across the whole pitch spinning edge-on, and he stands in a tall pillar of rising light with a halo at his feet; his front boot is plated in gold at 1.7× size following the real swing with a glint and a glow; every kick start throws a golden sunburst, glow and stars, and a hard header adds a \"בום!\" stamp (at most one a second).",
        impact: "'land' on the champion: a big golden glow, two rings and stars pulse round him and gold leaf and confetti shower his feet.",
        aftermath: "The plating flakes away: a \"דינג!\" stamp, a gold ring and big fading glow, gold confetti and crumbling gold leaf from the boot, a last glint.",
        cleanup: "The vault, rays, crown, coins, pillar and boot fade over their last 0.4s; leaves fall and die within 1.2s.",
      },
      layers: "Aura halo, crown, glow, rays, boot and leaves; cut-in giant boot and rays; touch sunbursts, stamp, confetti, leaf, glyphs; back: warm fill, sky shade, god-rays, crown and its glow, coin rain, pillar glow, halo, rising streaks; front: golden boot with one shadowBlur, boot glow, glint, kick starburst rays; kick sunburst particles; gold leaf, rings.",
      camera: "Shake 10, a 0.2s pale-gold flash and a gold vignette on firing; shake 4 on each golden kick, 7 on a golden header.",
      hud: 'The engine\'s status pill over the champion with its 6s ring.',
      audio: 'Fire: a bright bell-like rising triangle sweep with a sparkle blip. Impact: a coin-like blip chord. End: a falling sparkle blip.',
      counterplay: 'Every touch he makes is 1.5× — stay goal-side and block rather than tackle, jump into the lane of his shots, and give him nothing to kick for 6s.',
      perf: "≈100 particles on firing, ≤60 on landing, ≤3 per frame from leaf plus a ≤12-particle kick burst, 5 drawGlow per frame, 26 drawn coins, one shadowBlur on the boot.",
      helpers: "fx.rays, fx.glow, fx.glyph, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.flash, fx.shake; bootAt() follows the sprite's swing; note() tracks kick starts; haloRing(), drawCrown(), drawCoin(), twinkle(), skyShade().",
    },
    sounds: {
      fire: [{ k: 'sweep', from: 660, to: 1760, type: 'triangle', peak: 0.3, dur: 0.4 }, { k: 'blip', freq: 2640, type: 'sine', peak: 0.2, dur: 0.15, t: 0.12 }],
      impact: [{ k: 'blip', freq: 1320, type: 'triangle', peak: 0.2, dur: 0.12 }, { k: 'blip', freq: 1980, type: 'triangle', peak: 0.15, dur: 0.12, t: 0.05 }],
      end: [{ k: 'sweep', from: 2400, to: 800, type: 'sine', peak: 0.1, dur: 0.4 }],
    },

    aura(g, p, s) {
      const hh = haloRing(g, s, p, ['#ffd700', '#7a5c12', '#fff6cc', '#b8860b'], { spin: 2.5 });
      // a crown hovering on the halo, glinting
      g.save();
      const cy = hh.y - hh.r - 6 + Math.sin(s.t * 4) * 3;
      drawCrown(g, hh.x, cy, 42, '#ffd700');
      twinkle(g, hh.x + 16, cy - 22, 5 + Math.sin(s.t * 9) * 3, '#ffffff');
      g.restore();
      const b = bootAt(p, s);
      s.fx.drawGlow(g, b.x, b.y - 4, 60 + Math.sin(s.t * 6) * 8, '#ffd700', 0.9);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#fff6cc'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = s.t * 2 + i * TAU / 8, r0 = 16, r1 = 30 + (i % 2) * 10;
        g.globalAlpha = 0.5;
        g.beginPath(); g.moveTo(b.x + Math.cos(a) * r0, b.y - 4 + Math.sin(a) * r0); g.lineTo(b.x + Math.cos(a) * r1, b.y - 4 + Math.sin(a) * r1); g.stroke();
      }
      g.restore();
      const d = drawGoldBoot(g, p, s, 0.95, 1.3);
      g.save();
      g.fillStyle = '#f5c542';
      for (let i = 0; i < 6; i++) {
        const a = s.t * 3 + i * TAU / 6;
        g.globalAlpha = 0.85;
        g.save(); g.translate(d.x + Math.cos(a) * 26, d.y - 4 + Math.sin(a) * 10); g.rotate(a * 2); g.fillRect(-4, -2, 8, 4); g.restore();
      }
      g.restore();
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s), side = s.owner.side;
      const x = C.W / 2 + from * (1 - cutEase(k)) * C.W * 0.7, y = C.H * 0.78;
      s.fx.drawGlow(g, x, y - 50, 260, '#ffd700', 0.8 * f);
      g.save();
      g.translate(x, y - 50);
      g.globalCompositeOperation = 'lighter';
      g.rotate(k * 2);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        g.globalAlpha = 0.3 * f; g.fillStyle = i % 2 ? '#fff6cc' : '#f5c542';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.12) * 320, Math.sin(a - 0.12) * 320); g.lineTo(Math.cos(a + 0.12) * 320, Math.sin(a + 0.12) * 320); g.closePath(); g.fill();
      }
      g.restore();
      g.save();
      g.translate(x - side * 20, y);
      g.scale(side * 14, 14);
      const gr = g.createLinearGradient(0, -9, 0, 2);
      gr.addColorStop(0, '#fff6cc'); gr.addColorStop(0.5, '#ffd700'); gr.addColorStop(1, '#b8860b');
      g.globalAlpha = f; g.fillStyle = gr;
      bootPath(g); g.fill();
      g.strokeStyle = '#7a5c12'; g.lineWidth = 0.5; g.stroke();
      const u = (k * 1.6) % 1, gx = -8 + u * 22;
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.globalAlpha = f * 0.9;
      g.beginPath(); g.moveTo(gx - 3, 2); g.lineTo(gx + 3, -9); g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      lightUp(s, at.x, at.y, { c1: '#ffd700', c2: '#fff6cc', r: 180, vig: '#ffd700', n: 16 });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 24, r1: 70, life: 0.25, color: '#fff6cc', color2: '#ffd700', blend: 'lighter' });
      fx.burst(at.x, at.y, 24, { shape: 'sq', speed: 340, r: 5, spin: 12, grav: 300, drag: 1.5, life: 1, color: '#ffd700', color2: '#b8860b' });
      fx.confetti(at.x, at.y, 30, ['#ffd700', '#fff6cc', '#f5c542', '#b8860b']);
      fx.burst(at.x, at.y, 14, { shape: 'streak', speed: 540, color: '#fff6cc', life: 0.3, w: 3, blend: 'lighter' });
      fx.burst(at.x, at.y, 10, { shape: 'star', speed: 200, r: 6, spin: 6, drag: 1.5, life: 0.8, color: '#fff6cc', color2: '#ffd700', blend: 'lighter' });
      fx.ring(at.x, at.y, { color: '#f5c542', r1: 150, life: 0.45, w: 7 });
      fx.rays(at.x, at.y, { color: '#fff6cc', color2: '#b8860b', n: 20, r: 60, r1: 560, life: 1.1, spin: -0.8, alpha: 0.4 });
      fx.ring(at.x, at.y, { color: '#fff6cc', r: 30, r1: 320, life: 0.9, w: 6 });
      for (let i = 0; i < 3; i++) fx.glyph(at.x, at.y, ['👑', '🏆', '💰'][i], { r: 40, vx: fx.rand(-280, 280), vy: fx.rand(-440, -260), grav: 800, spin: fx.rand(-6, 6), life: 1.1 });
      stampAt(s, at.x, at.y - 110, 'זהב!', { r: 72, color: '#ffd700', edge: '#7a5c12' });
      fx.flash('#fff6cc', 0.3, 0.2);
      fx.shake(10, 0.35);
    },

    back(g, e, s) {
      const k = fade(e, 0.2, 0.4);
      const o = s.M.players[e.target];
      const d = s.depth(o.x, o.y);
      const C = s.C;
      g.save();
      // THE MIDAS TOUCH: the pitch warmed, the sky turned to a treasure vault — a giant golden
      // crown over the champion's half, god-rays wheeling out from behind him, and gold coins
      // raining across the whole pitch, spinning as they fall.
      g.globalAlpha = 0.08 * k; g.fillStyle = '#ffd700'; g.fillRect(0, 0, C.W, C.H);
      skyShade(g, C, '#3d2a02', 0.6 * k, 300);
      g.globalCompositeOperation = 'lighter';
      g.translate(d.x, d.y - 60); g.rotate(s.t * 0.5);
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14;
        g.globalAlpha = (i % 2 ? 0.12 : 0.2) * k; g.fillStyle = i % 2 ? '#fff6cc' : '#ffd700';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.09) * 700, Math.sin(a - 0.09) * 700); g.lineTo(Math.cos(a + 0.09) * 700, Math.sin(a + 0.09) * 700); g.closePath(); g.fill();
      }
      g.restore();
      const cx = clamp(d.x, 140, C.W - 140), cy = 120 + Math.sin(s.t * 2) * 6;
      s.fx.drawGlow(g, cx, cy - 20, 200, '#ffd700', 0.75 * k);
      g.save();
      g.globalAlpha = k;
      drawCrown(g, cx, cy + 20, 130, '#ffd700');
      g.fillStyle = '#fff6cc'; g.fillRect(cx - 58, cy + 8, 116, 6);
      for (let i = 0; i < 3; i++) twinkle(g, cx - 50 + i * 50, cy - 60 + (i % 2) * 34, 8 + Math.sin(s.t * 8 + i * 2) * 4, '#ffffff');
      // coin rain: the pre-placed stars, reused as coins
      for (let i = 0; i < 26; i++) {
        const st = STARS[i], y = C.CEIL_Y + ((st.y * 420 + s.t * 150 * st.v) % 420);
        drawCoin(g, st.x * C.W, y, 7 + st.v * 3, s.t * 6 * st.v + i);
      }
      g.restore();
      s.fx.drawGlow(g, d.x, d.y - 50, 170, '#ffd700', (0.55 + Math.sin(s.t * 4) * 0.1) * k);
      g.save();
      const gr = g.createRadialGradient(d.x, d.y - 4, 2, d.x, d.y - 4, 54);
      gr.addColorStop(0, '#f5c542'); gr.addColorStop(1, 'rgba(245,197,66,0)');
      g.globalAlpha = 0.45 * k; g.fillStyle = gr;
      g.beginPath(); g.ellipse(d.x, d.y - 4, 54, 18, 0, 0, TAU); g.fill();
      // the pillar: light streaks rising round him
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#fff6cc'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const u = (s.t * 1.2 + i / 10) % 1;
        const x = d.x + (i - 4.5) * 11, y = d.y - 6 - u * 190;
        g.globalAlpha = (1 - u) * 0.85 * k;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 34); g.stroke();
      }
      g.restore();
    },

    front(g, e, s) {
      const k = fade(e, 0.2, 0.4);
      const o = s.M.players[e.target];
      const b = bootAt(o, s);
      s.fx.drawGlow(g, b.x, b.y - 4, 64, '#ffd700', 0.9 * k);
      const d = drawGoldBoot(g, o, s, k, 1.7);
      // the golden starburst of the latest strong kick, drawn as rays so it costs no particles
      const n = note(e);
      if (n.burstAt != null && s.t - n.burstAt < 0.32) {
        const u = (s.t - n.burstAt) / 0.32;
        s.fx.drawGlow(g, n.bx, n.by, 70, '#fff6cc', (1 - u) * 0.9);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = (1 - u) * 0.95; g.strokeStyle = '#ffd700'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12 + n.burstRot;
          const r0 = 10 + u * 14, r1 = 24 + u * 56 * (i % 2 ? 0.6 : 1);
          g.beginPath(); g.moveTo(n.bx + Math.cos(a) * r0, n.by + Math.sin(a) * r0); g.lineTo(n.bx + Math.cos(a) * r1, n.by + Math.sin(a) * r1); g.stroke();
        }
        g.restore();
      }
      return d;
    },

    tick(e, s) {
      const { fx } = s, o = s.M.players[e.target], n = note(e), b = s.M.ball;
      const d = bootAt(o, s);
      // a kick starting, or a header that just made the ball jump, is a golden strike
      const sp = Math.hypot(b.vx, b.vy);
      const header = n.sp != null && sp > n.sp + 400 && Math.hypot(b.x - o.x, b.y - s.headY(o)) < 70;
      n.sp = sp;
      if (kickStarted(n, 'kt', o) || header) {
        n.burstAt = s.t; n.burstRot = Math.random() * TAU;
        n.bx = header ? b.x : d.x; n.by = header ? b.y : d.y;
        fx.emit({ shape: 'star', x: n.bx, y: n.by, r: 14, r1: 36, life: 0.22, color: '#fff6cc', color2: '#ffd700', blend: 'lighter' });
        fx.ring(n.bx, n.by, { color: '#f5c542', r1: 90, life: 0.35, w: 4, layer: 'front' });
        fx.burst(n.bx, n.by, 10, { shape: 'star', speed: 220, r: 4, drag: 2, life: 0.5, color: '#ffd700', color2: '#fff6cc', blend: 'lighter' });
        if (header && !(n.stampAt > s.t - 1)) {
          n.stampAt = s.t;
          fx.rays(n.bx, n.by, { color: '#ffd700', color2: '#fff6cc', n: 12, r1: 200, life: 0.45 });
          stampAt(s, n.bx, n.by - 70, 'בום!', { r: 42, color: '#ffd700', edge: '#7a5c12', life: 0.7 });
          fx.shake(7, 0.2);
        } else fx.shake(4, 0.15);
        return;
      }
      if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: d.x + fx.rand(-10, 10), y: d.y - 4, vx: fx.rand(-30, 30), vy: fx.rand(-60, -20), grav: 120, spin: fx.rand(-10, 10), r: 4, life: 1.1, color: '#f5c542', color2: '#b8860b' });
      if (Math.random() < 0.2) fx.emit({ shape: 'star', x: o.x + fx.rand(-30, 30), y: o.y - fx.rand(10, 100), r: 4, life: 0.5, spin: 4, color: '#fff6cc', blend: 'lighter' });
    },

    impact(s, ev) {
      const { fx } = s;
      const o = s.M.players[ev.on ?? s.owner.index];
      fx.glow(o.x, o.y - 30, 180, '#ffd700', { life: 0.9 });
      fx.ring(o.x, o.y - 20, { color: '#ffd700', r: 14, r1: 110, life: 0.5, w: 5, layer: 'front' });
      fx.ring(o.x, o.y - 20, { color: '#fff6cc', r: 14, r1: 220, life: 0.8, w: 4, layer: 'front' });
      fx.burst(o.x, o.y - 30, 12, { shape: 'star', speed: 260, r: 6, spin: 6, drag: 1.5, life: 0.9, color: '#fff6cc', color2: '#ffd700', blend: 'lighter' });
      fx.burst(o.x, o.y - 60, 16, { shape: 'sq', speed: 140, spread: 1.4, angle: Math.PI / 2, r: 4, spin: 10, grav: 300, life: 1, color: '#ffd700', color2: '#fff6cc' });
      fx.confetti(o.x, o.y - 40, 20, ['#ffd700', '#fff6cc', '#b8860b']);
    },

    end(s, info) {
      const { fx } = s;
      const o = info && info.e ? s.M.players[info.e.target] : s.owner;
      const d = bootAt(o, s);
      fx.glow(d.x, d.y - 10, 150, '#ffd700', { life: 1.5, alpha: 0.65 });
      fx.ring(d.x, d.y - 10, { color: '#ffd700', r: 10, r1: 170, life: 1, w: 5 });
      fx.confetti(o.x, o.y - 60, 24, ['#ffd700', '#b8860b', '#fff6cc']);
      stampAt(s, o.x, o.y - 160, 'דינג!', { r: 46, color: '#ffd700', edge: '#7a5c12', life: 0.9 });
      for (let i = 0; i < fx.n(12); i++) fx.emit({ shape: 'sq', x: d.x + fx.rand(-10, 10), y: d.y - 4, vx: fx.rand(-70, 70), vy: fx.rand(-90, -10), grav: 400, spin: fx.rand(-12, 12), r: 4, life: 1.2, color: '#b8860b', color2: '#7a5c12' });
      fx.emit({ shape: 'star', x: d.x, y: d.y - 4, r: 10, r1: 26, life: 0.3, color: '#ffffff', blend: 'lighter' });
    },
  },

  // ── 34 · woolshoes — knitting yarn ────────────────────────────────────────
  woolshoes: {
    theme: 'Knitting yarn',
    visual: 'pastel yarn loops wound round the rival\'s boots, a tethered ball of wool, knit stitches and fluffy wool puffs on each kick',
    palette: ['#e8c8ff', '#ff9ec7', '#8fd6d0', '#fffaf0', '#a77fcf'],
    doc: {
      fantasy: 'Grandma\'s revenge: the rival\'s boots are knitted into woolly slippers and his shots come off like pillows.',
      purpose: 'A struck shot plus 6s of weak kicking for the foe: his kicks and headers are at 0.45× strength, so a keeper champion can defend a lead without having to win the ball clean.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The woollen shoes last 6s on the other player.',
      bot: "Arms on 'defend' (ball in its own half) and plays as a 'keeper' — it holds its line and fires it to blunt the rival's attack.",
      sequence: {
        anticipation: "While armed a spinning pastel halo rings the champion's head wound round with a wobbling pink strand, and a big ball of lilac yarn with two knitting needles bobs beside it in a soft pink glow, a loose strand curling off it and pastel loops orbiting.",
        activation: "Cut-in: a giant ball of yarn rolls in under the band unspooling a thick pink strand, knitting needles crossed behind it. Then a lob: two pastel sunbursts and a pink bloom, two rings, a pink yarn beam to his feet, 30 pastel yarn confetti, wool puffs at both ends, 🧵💗🎀 tossed up, the thrown yarn ball arcing to his boots, a huge \"פוּף!\", a cream flash, a pink vignette and a soft shake.",
        main: "GRANDMA'S LIVING ROOM for 6s: the sky goes plum, a giant knitted scarf of four stitch rows is strung waving across the top of the screen, four fat keylined wool clouds drift across on strands hung from it, two giant needles knit away crossed behind the rival, and fluff, hearts and bows (💗🎀) float up all over the pitch. His feet glow pink and are wound in three thick keylined loops of pastel yarn with knit stitches, loose strands and a tethered yarn ball; a wobbly yarn thread runs from the champion's feet to his; knit hearts float round him; every kick he starts coughs out wool puffs and yarn confetti from the real boot, with a small \"פוּף\" (at most one a second).",
        impact: "'land' on the rival: the loops cinch — a big pink glow and two rings at his feet, a \"נסרג!\" stamp, a burst of fluff and yarn confetti.",
        aftermath: "The knitting unravels: loose coloured strands and yarn confetti fly off, a lilac ring spreads, 🧵 tumble away, a last puff of wool and a big fading pink glow.",
        cleanup: "Scarf, clouds, needles, loops, thread and hearts fade over the last 0.4s; fluff drifts out within 1.4s.",
      },
      layers: "Aura halo, strand, glow, yarn ball, needles and orbiting loops; cut-in giant yarn ball and strand; touch sunbursts, beam, stamp, confetti, puffs, glyphs; back: rival glow, sky shade, knitted scarf, clouds and strands, giant needles; front: foot glow, cross-pitch thread, keylined loops and stitches (strokes only so the ball stays visible), tether, strands, yarn ball, floating hearts; wool puffs, fluff and floating glyphs.",
      camera: "A soft shake 4, a 0.2s cream flash (α 0.2) and a pink vignette on firing — soft is the joke; no shake after.",
      hud: 'The engine\'s status pill over the rival with its 6s ring.',
      audio: 'Fire: a soft wobbling triangle sweep (a ball of wool tossed) with a muffled thud. Impact: a soft pillowy thud. End: a quick descending blip.',
      counterplay: 'Do not try to shoot for 6s — 0.45× kicks do not score; dribble and body the ball instead, or defend and wait it out.',
      perf: "≈95 particles on firing, ≤45 on landing, ≤12 on a kick cough, otherwise ≤3 per frame, 3 drawGlow per frame, one linear gradient per frame, no shadowBlur.",
      helpers: "fx.beam, fx.rays, fx.glow, fx.glyph, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.shake; bootAt(), kickStarted(), drawYarnBall(), drawCloud(), haloRing(), skyShade(), keyline().",
    },
    sounds: {
      fire: [{ k: 'sweep', from: 520, to: 340, type: 'triangle', peak: 0.25, dur: 0.35, detune: 15 }, { k: 'thud', freq: 240, q: 0.6, peak: 0.4, decay: 0.15 }],
      impact: [{ k: 'thud', freq: 200, q: 0.5, peak: 0.5, decay: 0.2 }],
      end: [{ k: 'blip', freq: 880, type: 'triangle', peak: 0.12, dur: 0.1 }, { k: 'blip', freq: 660, type: 'triangle', peak: 0.1, dur: 0.12, t: 0.1 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const hh = haloRing(g, s, p, ['#ff9ec7', '#8fd6d0', '#e8c8ff', '#fffaf0'], { spin: 2, edge: '#a77fcf' });
      const x = hh.x - p.side * (hh.r + 26), y = hh.y + 10 + Math.sin(s.t * 3) * 4;
      s.fx.drawGlow(g, x, y, 70, '#ff9ec7', 0.7 + Math.sin(s.t * 4) * 0.12);
      g.save();
      // a strand of yarn wound round and round the halo
      g.lineCap = 'round';
      keyline(g, () => { g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 2 + s.t * 2, r = hh.r + 8 + Math.sin(i * 1.3 + s.t * 5) * 5; i ? g.lineTo(hh.x + Math.cos(a) * r, hh.y + Math.sin(a) * r) : g.moveTo(hh.x + Math.cos(a) * r, hh.y + Math.sin(a) * r); } }, '#ff9ec7', 3, '#a77fcf');
      g.translate(x, y); g.scale(1.5, 1.5); g.translate(-x, -y);
      g.strokeStyle = '#a77fcf'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 18, y - 20); g.lineTo(x + 12, y + 14); g.stroke();
      g.beginPath(); g.moveTo(x + 18, y - 20); g.lineTo(x - 12, y + 14); g.stroke();
      g.fillStyle = '#ff9ec7';
      g.beginPath(); g.arc(x - 18, y - 20, 4, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + 18, y - 20, 4, 0, TAU); g.fill();
      drawYarnBall(g, x, y, 14, '#e8c8ff', s.t);
      g.strokeStyle = '#ff9ec7'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y + 14);
      g.bezierCurveTo(x + 12, y + 26, x - 12 + Math.sin(s.t * 4) * 8, y + 34, x + p.side * 10, y + 48); g.stroke();
      // pastel loops orbiting it
      const cols = ['#8fd6d0', '#ff9ec7', '#e8c8ff'];
      for (let i = 0; i < 3; i++) {
        const a = s.t * 2.5 + i * TAU / 3;
        g.strokeStyle = cols[i]; g.lineWidth = 3; g.globalAlpha = 0.85;
        g.beginPath(); g.arc(x + Math.cos(a) * 28, y + Math.sin(a) * 14, 5, 0, TAU); g.stroke();
      }
      g.restore();
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      const x = C.W / 2 + from * (1 - cutEase(k)) * C.W * 0.75, y = C.H * 0.76;
      s.fx.drawGlow(g, x, y, 220, '#ff9ec7', 0.6 * f);
      g.save();
      g.globalAlpha = f; g.lineCap = 'round';
      // the needles crossed behind it
      g.strokeStyle = '#a77fcf'; g.lineWidth = 14;
      g.beginPath(); g.moveTo(x - 170, y - 150); g.lineTo(x + 110, y + 90); g.stroke();
      g.beginPath(); g.moveTo(x + 170, y - 150); g.lineTo(x - 110, y + 90); g.stroke();
      g.fillStyle = '#ff9ec7';
      g.beginPath(); g.arc(x - 170, y - 150, 16, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + 170, y - 150, 16, 0, TAU); g.fill();
      // the strand it unspools as it rolls in
      g.strokeStyle = '#ff9ec7'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(x, y + 90);
      g.bezierCurveTo(x + from * 150, y + 130, x + from * 260, y - 40, x + from * 700, y + 60); g.stroke();
      g.restore();
      g.save(); g.globalAlpha = f;
      drawYarnBall(g, x, y, 100, '#e8c8ff', -from * k * 8);
      g.restore();
    },

    fire(s, at) {
      const { fx } = s, q = s.foe;
      lightUp(s, at.x, at.y, { c1: '#ff9ec7', c2: '#8fd6d0', r: 150, core: '#fffaf0', vig: '#ff9ec7', n: 12, spin: 0.8 });
      fx.beam(at.x, at.y, q.x, q.y - 8, { color: '#ff9ec7', color2: '#fffaf0', w: 12, life: 0.5 });
      fx.burst(at.x, at.y, 20, { shape: 'smoke', speed: 150, r: 6, r1: 18, drag: 2, life: 0.9, color: '#fffaf0', color2: '#e8c8ff' });
      fx.confetti(at.x, at.y, 30, ['#e8c8ff', '#ff9ec7', '#8fd6d0', '#fffaf0']);
      fx.burst(at.x, at.y, 10, { shape: 'dot', speed: 220, r: 4, drag: 1.5, life: 0.7, color: '#8fd6d0', color2: '#a77fcf' });
      fx.ring(at.x, at.y, { color: '#ff9ec7', r1: 110, life: 0.45, w: 6 });
      // the thrown yarn ball, arcing into his feet in ~0.4s
      const T = 0.4, dx = q.x - at.x, dy = q.y - 10 - at.y;
      fx.emit({ shape: 'dot', x: at.x, y: at.y, vx: dx / T, vy: dy / T - 0.5 * 900 * T, grav: 900, r: 11, life: T, color: '#ff9ec7' });
      fx.emit({ shape: 'streak', x: at.x, y: at.y, vx: dx / T, vy: dy / T - 0.5 * 900 * T, grav: 900, r: 8, w: 3, life: T, color: '#8fd6d0' });
      fx.rays(at.x, at.y, { color: '#8fd6d0', color2: '#e8c8ff', n: 18, r: 50, r1: 480, life: 1, spin: -0.6, alpha: 0.4 });
      fx.ring(at.x, at.y, { color: '#8fd6d0', r: 20, r1: 280, life: 0.8, w: 7 });
      fx.burst(q.x, q.y - 20, 18, { shape: 'smoke', speed: 200, r: 8, r1: 24, drag: 2, life: 1, color: '#e8c8ff', color2: '#fffaf0' });
      for (let i = 0; i < 4; i++) fx.glyph(at.x, at.y, ['🧵', '💗', '🎀', '💗'][i], { r: 36, vx: fx.rand(-260, 260), vy: fx.rand(-400, -220), grav: 600, spin: fx.rand(-5, 5), life: 1.2 });
      stampAt(s, at.x, at.y - 110, 'פוּף!', { r: 70, color: '#ff9ec7', edge: '#a77fcf' });
      fx.flash('#fffaf0', 0.2, 0.2);
      fx.shake(4, 0.25);
    },

    // GRANDMA'S LIVING ROOM: a plum dusk over the stands, a giant knitted scarf strung across
    // the sky and waving, fat wool clouds drifting on their strands, and two giant needles
    // knitting away behind the rival.
    back(g, e, s) {
      const k = fade(e, 0.25, 0.4);
      const C = s.C, q = s.M.players[e.target], d = s.depth(q.x, q.y);
      const cols = ['#e8c8ff', '#ff9ec7', '#8fd6d0', '#fffaf0'];
      s.fx.drawGlow(g, d.x, d.y - 60, 170, '#ff9ec7', 0.6 * k);
      g.save();
      skyShade(g, C, '#3b2150', 0.6 * k, 300);
      // the scarf: rows of knit stitches along a waving band
      g.globalAlpha = k;
      const rowY = (x, j) => 58 + j * 12 + Math.sin(x * 0.012 + s.t * 2.4) * 16;
      g.fillStyle = INK;
      g.beginPath(); for (let x = -20; x <= C.W + 20; x += 20) g.lineTo(x, rowY(x, 0) - 9); for (let x = C.W + 20; x >= -20; x -= 20) g.lineTo(x, rowY(x, 3) + 9); g.closePath(); g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 4;
      for (let j = 0; j < 4; j++) {
        g.strokeStyle = cols[j % 4];
        g.beginPath();
        for (let x = -20; x <= C.W + 20; x += 20) {
          const y = rowY(x, j);
          g.moveTo(x - 7, y - 5); g.lineTo(x, y + 4); g.lineTo(x + 7, y - 5);
        }
        g.stroke();
      }
      // wool clouds drifting, each hung on a strand from the scarf
      for (let i = 0; i < 4; i++) {
        const x = ((i * 290 + s.t * (22 + i * 7)) % (C.W + 240)) - 120, y = 170 + (i % 2) * 50 + Math.sin(s.t * 1.5 + i) * 8;
        keyline(g, () => { g.beginPath(); g.moveTo(x, rowY(x, 3) + 8); g.quadraticCurveTo(x + 14, (y + rowY(x, 3)) / 2, x, y - 30); }, cols[(i + 1) % 3], 3);
        drawCloud(g, x, y, 78 + (i % 2) * 20, cols[i % 4]);
      }
      // the giant needles, knitting behind the rival
      const wig = Math.sin(s.t * 9) * 0.25;
      for (const sg of [-1, 1]) {
        g.save();
        g.translate(d.x - sg * 40, d.y - 10); g.rotate(sg * (0.5 + wig * sg));
        keyline(g, () => { g.beginPath(); g.moveTo(0, 60); g.lineTo(0, -120); }, '#a77fcf', 8);
        g.fillStyle = INK; g.beginPath(); g.arc(0, -124, 14, 0, TAU); g.fill();
        g.fillStyle = '#ff9ec7'; g.beginPath(); g.arc(0, -124, 11, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
    },

    front(g, e, s) {
      const k = fade(e, 0.25, 0.4);
      const q = s.M.players[e.target], o = s.M.players[e.owner];
      const d = s.depth(q.x, q.y), od = s.depth(o.x, o.y);
      const cols = ['#e8c8ff', '#ff9ec7', '#8fd6d0'];
      s.fx.drawGlow(g, d.x, d.y - 8, 56, '#ff9ec7', 0.5 * k);
      g.save();
      g.lineCap = 'round';
      // the knitting thread, wobbling across the pitch from the champion to his feet
      g.globalAlpha = 0.6 * k; g.strokeStyle = '#ff9ec7'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(od.x, od.y - 6);
      g.bezierCurveTo(od.x + (d.x - od.x) * 0.3, od.y - 40 + Math.sin(s.t * 3) * 14, od.x + (d.x - od.x) * 0.7, d.y + 10 + Math.cos(s.t * 3) * 10, d.x, d.y - 6);
      g.stroke();
      g.globalAlpha = 0.9 * k;
      // three thick loops wound round both boots, wobbling like loose wool
      for (let i = 0; i < 3; i++) {
        const y = d.y - 3 - i * 7, wob = Math.sin(s.t * 5 + i * 2) * 0.12;
        keyline(g, () => { g.beginPath(); g.ellipse(d.x + q.side * 3, y, 30 - i * 2, 7, wob, 0, TAU); }, cols[i], 5);
      }
      // knit stitches: little v's along the middle band
      g.strokeStyle = '#fffaf0'; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const x = d.x + q.side * 3 + i * 7, y = d.y - 10;
        g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x, y + 1); g.lineTo(x + 2, y - 2); g.stroke();
      }
      // the yarn ball at his heel on its tether, and two loose strands trailing
      const bx = d.x - q.side * 30, by = d.y - 9;
      g.strokeStyle = '#a77fcf'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo((bx + d.x) / 2, d.y + 2 + Math.sin(s.t * 6) * 3, d.x, d.y - 6); g.stroke();
      for (let i = 0; i < 2; i++) {
        const sx = d.x + q.side * (16 + i * 4), sy = d.y - 4 - i * 6;
        g.strokeStyle = cols[i + 1];
        g.beginPath(); g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + q.side * 10, sy + 4 + Math.sin(s.t * 7 + i) * 4, sx + q.side * 18, sy + 2); g.stroke();
      }
      // knit hearts floating up round him
      for (let i = 0; i < 4; i++) {
        const u = (s.t * 0.6 + i / 4) % 1;
        const hx = d.x + (i - 1.5) * 22 + Math.sin(s.t * 2 + i) * 6, hy = d.y - 20 - u * 90;
        g.globalAlpha = Math.sin(u * Math.PI) * 0.8 * k; g.fillStyle = cols[i % 3];
        g.beginPath(); g.arc(hx - 3, hy, 3.5, 0, TAU); g.arc(hx + 3, hy, 3.5, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(hx - 6.5, hy + 1); g.lineTo(hx, hy + 8); g.lineTo(hx + 6.5, hy + 1); g.closePath(); g.fill();
      }
      g.globalAlpha = k;
      drawYarnBall(g, bx, by, 9, '#ff9ec7', s.t * 2);
      g.restore();
    },

    tick(e, s) {
      const { fx } = s, q = s.M.players[e.target], n = note(e);
      // his kick comes out as a cough of wool
      if (kickStarted(n, 'kt', q)) {
        const d = bootAt(q, s);
        for (let i = 0; i < 4; i++) fx.emit({ shape: 'smoke', x: d.x + q.side * 6, y: d.y - 4, vx: q.side * fx.rand(20, 90), vy: fx.rand(-70, -10), drag: 2, r: 6, r1: 18, life: 0.9, color: i ? '#fffaf0' : '#ff9ec7' });
        fx.confetti(d.x, d.y - 6, 8, ['#e8c8ff', '#ff9ec7', '#8fd6d0'], { life: 0.8 });
        if (!(n.stampAt > s.t - 1)) { n.stampAt = s.t; stampAt(s, d.x, d.y - 70, 'פוּף', { r: 32, color: '#fffaf0', edge: '#a77fcf', life: 0.6 }); }
        return;
      }
      if (Math.random() < 0.2) fx.emit({ shape: 'dot', x: q.x + fx.rand(-16, 16), y: q.y - 6, vx: fx.rand(-10, 10), vy: -20, r: 2, life: 1, color: '#fffaf0' });
      // lint and wool fluff drifting all over the pitch, and now and then a heart floating up
      if (Math.random() < 0.5) fx.emit({ shape: 'smoke', x: fx.rand(0, s.C.W), y: fx.rand(80, s.C.GROUND_Y), vx: fx.rand(-30, 30), vy: -fx.rand(10, 40), r: 4, r1: 14, life: 1.4, color: ['#e8c8ff', '#ff9ec7', '#8fd6d0', '#fffaf0'][Math.floor(Math.random() * 4)], layer: 'back' });
      if (Math.random() < 0.05) fx.glyph(fx.rand(40, s.C.W - 40), s.C.GROUND_Y - 20, Math.random() < 0.5 ? '💗' : '🎀', { r: 30, vy: -fx.rand(60, 110), vx: fx.rand(-20, 20), spin: fx.rand(-1, 1), life: 2.2, layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      const q = s.M.players[ev.on ?? s.foe.index];
      fx.glow(q.x, q.y - 10, 160, '#ff9ec7', { life: 0.8 });
      fx.ring(q.x, q.y - 8, { color: '#ff9ec7', r: 60, r1: 14, life: 0.4, w: 5, layer: 'front' });
      fx.ring(q.x, q.y - 8, { color: '#8fd6d0', r: 150, r1: 20, life: 0.6, w: 6, layer: 'front' });
      stampAt(s, q.x, q.y - 150, 'נסרג!', { r: 52, color: '#8fd6d0', edge: '#a77fcf', life: 0.9 });
      fx.burst(q.x, q.y - 8, 16, { shape: 'smoke', speed: 120, r: 5, r1: 15, drag: 2, life: 0.8, color: '#e8c8ff', color2: '#fffaf0' });
      fx.confetti(q.x, q.y - 10, 20, ['#e8c8ff', '#ff9ec7', '#8fd6d0']);
    },

    end(s, info) {
      const { fx } = s;
      const q = info && info.e ? s.M.players[info.e.target] : s.foe;
      const cols = ['#e8c8ff', '#ff9ec7', '#8fd6d0'];
      fx.glow(q.x, q.y - 10, 140, '#ff9ec7', { life: 1.5, alpha: 0.6 });
      fx.ring(q.x, q.y - 10, { color: '#e8c8ff', r: 10, r1: 170, life: 1, w: 5 });
      fx.confetti(q.x, q.y - 30, 24, ['#e8c8ff', '#ff9ec7', '#8fd6d0', '#fffaf0']);
      for (let i = 0; i < fx.n(3); i++) fx.glyph(q.x, q.y - 30, '🧵', { r: 30, vx: fx.rand(-240, 240), vy: fx.rand(-360, -200), grav: 700, spin: fx.rand(-6, 6), life: 1.2 });
      for (let i = 0; i < fx.n(9); i++) fx.emit({ shape: 'streak', x: q.x + fx.rand(-16, 16), y: q.y - 8, vx: fx.rand(-130, 130), vy: fx.rand(-170, -60), grav: 500, r: 6, w: 3, life: 1, color: cols[i % 3] });
      fx.emit({ shape: 'smoke', x: q.x, y: q.y - 6, vy: -20, r: 10, r1: 30, life: 1, color: '#fffaf0' });
    },
  },

  // ── 35 · homing — the guided missile ──────────────────────────────────────
  homing: {
    theme: 'Guided missile',
    visual: 'finned missile with exhaust smoke, a radar sweep scope, and a red lock-on reticle on the real target point in the goal',
    palette: ['#ff2e63', '#39ff88', '#0d2b1c', '#d7dde5', '#9aa1ab'],
    doc: {
      fantasy: 'Fire and forget: the champion\'s radar paints the corner the keeper cannot cover and the ball flies there as a guided missile.',
      purpose: 'A 1.1× power shot that steers at up to 3.4 rad/s toward the part of the goal farthest from the keeper — top corner (bar-top+14) while he is on the grass, bottom (grass-6) the moment he jumps — so reading the keeper is done for you.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. Guided for POWER_SHOT_LIFE (1.6s); blockable and counterable like any power shot.',
      bot: "Arms on 'attack' (ball ahead of it, in the opponent half) and plays as a 'striker' — it fires from range and lets the guidance pick the corner.",
      sequence: {
        anticipation: "While armed a spinning red-and-green halo rings the champion's head outside a big green radar scope sweeping round it with blips, and a red-glowing reticle hunts over the real target point in the goal — it jumps from high to low when the keeper jumps.",
        activation: "Cut-in: a giant finned missile streaks across under the band, flame blazing, while a huge reticle locks on the far side. Then launch: a red laser lock beam from the ball to the target, a red-and-green sunburst plus a green-black one, a white bloom, two rings, 20 exhaust puffs, 20 sparks, 14 embers and 22 green data bits, a red glow on the target, \"נעול!\" by the goal and \"שיגור!\" at the ball, a white flash, a red vignette and a shake.",
        main: "TARGETING MODE for the whole flight: the sky goes to a green radar night, a scrolling green range grid lies over the pitch, keylined red crosshairs with range ticks run edge to edge through the lock, a giant radar scope sweeps over the champion's half with the ball and target blips on it, and \"נעול\" blinks by the goal. The ball flies as the warhead of a finned missile 4.4× its size along its real velocity, a thick keylined grey contrail laid along the real curve it steers, a glowing flickering flame behind; the lock reticle glows red with spinning brackets and green ping rings. A white ring stays on the true ball.",
        impact: "On a block or a goal: a huge \"בום!\", an orange-red sunburst and a black-orange one, white and red blooms, 30 shrapnel, 24 sparks, smoke and a dark mushroom cloud, debris confetti, three shock rings, a red flash (α 0.35), an orange vignette and a big shake.",
        aftermath: 'A column of exhaust smoke drifts up, a last green radar ping and a fading red glow.',
        cleanup: 'Smoke runs out within 1.4s; the reticle disappears with the shot.',
      },
      layers: "Aura halo, glows, radar scope with sweep and blips, hunting reticle; cut-in giant missile and reticle; lock beam, sunbursts, stamps, exhaust, data bits; flight: sky shade, range grid, crosshairs, radar scope and blips, LOCKED text, contrail, target glow, bracket arcs, guidance line, ping rings, lock reticle, flame glow, missile body/fins/flame, warhead ball and ring (last); smoke trail; detonation.",
      camera: "Shake 9, a white flash and a red vignette on launch; 16 on detonation with a 0.18s red flash (α 0.35) and an orange vignette.",
      hud: 'The ordinary meter and the super cut-in; the reticle doubles as the lock indicator. No status icon: the power is the shot.',
      audio: 'Fire: a radar double-beep then a roaring noise-sweep launch. Impact: a deep explosion with a crack. End: a single radar ping.',
      counterplay: 'You choose where it goes: stay grounded and it goes high, jump and it goes low — jump LATE, as it arrives, and cover the corner it was steering to; or block the line early before it curves.',
      perf: "≈95 particles on launch, ≤120 on detonation, ≤3 per frame in flight, 4 drawGlow per frame, a 24-point contrail history, one linear gradient, one shadowBlur on the flame.",
      helpers: 'fx.beam, fx.rays, fx.glow, fx.stamp, fx.confetti, fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.flash, fx.shake; homingPoint() mirrors the flight in powers.js; drawReticle(), drawMissile(), haloRing(), skyShade(), keyline(); note() keeps the contrail.',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 1400, type: 'square', peak: 0.14, dur: 0.06 }, { k: 'blip', freq: 1400, type: 'square', peak: 0.14, dur: 0.06, t: 0.1 }, { k: 'sweep', from: 200, to: 900, type: 'sawtooth', peak: 0.3, dur: 0.5, t: 0.18 }],
      impact: [{ k: 'thud', freq: 70, q: 0.8, peak: 1, decay: 0.55 }, { k: 'thud', freq: 1800, q: 3, peak: 0.4, decay: 0.1 }],
      end: [{ k: 'blip', freq: 1200, type: 'sine', peak: 0.12, dur: 0.2 }],
    },

    aura(g, p, s) {
      haloRing(g, s, p, ['#ff2e63', '#0d2b1c', '#39ff88', '#d7dde5'], { spin: 6, gap: 44 });
      const d = s.depth(p.x, s.headY(p));
      const R = s.headR(p) + 30;
      const cx = d.x - p.side * 8, cy = d.y + 8;
      const sw = s.t * 4;
      s.fx.drawGlow(g, cx, cy, R * 1.5, '#39ff88', 0.4);
      g.save();
      g.globalAlpha = 0.45; g.fillStyle = '#0d2b1c';
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.globalAlpha = 0.8; g.strokeStyle = '#39ff88'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R * 0.6, 0, TAU); g.stroke();
      // the sweep, and its fading wake
      g.fillStyle = '#39ff88';
      for (let i = 0; i < 4; i++) {
        g.globalAlpha = 0.34 - i * 0.07;
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sw - (i + 1) * 0.25, sw - i * 0.25); g.closePath(); g.fill();
      }
      // a blip where the target is, relative to the scope
      const tp = homingPoint(s, p.side, p.index, 12);
      const ba = Math.atan2(tp.y - cy, tp.x - cx);
      g.globalAlpha = 0.5 + 0.5 * Math.cos(sw - ba);
      g.fillRect(cx + Math.cos(ba) * R * 0.8 - 3, cy + Math.sin(ba) * R * 0.8 - 3, 6, 6);
      g.restore();
      // …and the reticle hunting on the goal
      const rx = tp.x + Math.sin(s.t * 7) * 5, ry = tp.y + Math.cos(s.t * 5) * 5;
      s.fx.drawGlow(g, rx, ry, 36, '#ff2e63', 0.5);
      drawReticle(g, rx, ry, 18, s.t, '#ff2e63', 0.75);
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s), dir = -from;
      // it streaks across the screen, from the band's side to the far one
      const x = C.W / 2 + from * C.W * 0.62 * (1 - 2 * Math.min(1, k * 1.25)), y = C.H * 0.76;
      s.fx.drawGlow(g, x - dir * 300, y, 150, '#ff2e63', 0.9 * f);
      g.save();
      g.globalAlpha = f;
      g.translate(x, y); g.scale(dir, 1);
      drawMissile(g, 300, 30, 110 + Math.sin(k * 80) * 25);
      g.fillStyle = '#d7dde5'; g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(70, 0, 0, 30); g.closePath(); g.fill();
      g.restore();
      // the lock on the far side, closing in
      const lk = clamp(k / 0.6, 0, 1);
      drawReticle(g, C.W / 2 + dir * C.W * 0.33, y - 20, 110 - lk * 50, (1 - lk) * 3, '#ff2e63', f);
      if (lk >= 1) drawReticle(g, C.W / 2 + dir * C.W * 0.33, y - 20, 60, 0, '#39ff88', f * 0.8);
    },

    fire(s, at) {
      const { fx, side } = s;
      const tp = homingPoint(s, side, s.owner.index, 12);
      lightUp(s, at.x, at.y, { c1: '#ff2e63', c2: '#39ff88', r: 150, vig: '#ff2e63', n: 14, spin: 2 });
      fx.beam(at.x, at.y, tp.x, tp.y, { color: '#ff2e63', color2: '#ffffff', w: 8, life: 0.55 });
      fx.burst(at.x - side * 8, at.y, 20, { shape: 'smoke', speed: 130, spread: 1.4, angle: side > 0 ? Math.PI : 0, r: 7, r1: 24, drag: 1.5, life: 1.1, color: '#9aa1ab', layer: 'back' });
      fx.burst(at.x, at.y, 20, { shape: 'streak', speed: 500, spread: 1.2, angle: side > 0 ? Math.PI : 0, color: '#ff2e63', color2: '#ffffff', life: 0.35, w: 3, blend: 'lighter' });
      fx.burst(at.x, at.y, 14, { shape: 'dot', speed: 260, r: 3, drag: 1.5, life: 0.6, color: '#ffffff', color2: '#ff2e63', blend: 'lighter' });
      fx.ring(at.x, at.y, { color: '#39ff88', r1: 160, life: 0.55, w: 4 });
      fx.ring(tp.x, tp.y, { color: '#39ff88', r: 70, r1: 14, life: 0.5, w: 4, layer: 'front' });
      fx.rays(at.x, at.y, { color: '#39ff88', color2: '#0d2b1c', n: 16, r: 40, r1: 500, life: 0.9, spin: 3, alpha: 0.4, blend: null });
      fx.ring(at.x, at.y, { color: '#ff2e63', r: 20, r1: 300, life: 0.7, w: 7 });
      fx.burst(at.x, at.y, 22, { shape: 'sq', speed: 340, r: 4, drag: 1.5, life: 0.9, color: '#39ff88', color2: '#0d2b1c' });
      fx.glow(tp.x, tp.y, 120, '#ff2e63', { life: 0.8, alpha: 0.9 });
      stampAt(s, tp.x - side * 60, tp.y - 90, 'נעול!', { r: 64, color: '#39ff88', edge: '#0d2b1c' });
      stampAt(s, at.x, at.y - 120, 'שיגור!', { r: 52, color: '#ff2e63', edge: '#0d2b1c', life: 0.8 });
      fx.flash('#ffffff', 0.25, 0.15);
      fx.shake(9, 0.3);
    },

    ball(g, b, s) {
      const pw = b.power;
      const d = s.depth(b.x, b.y);
      const ang = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : (pw.dir > 0 ? 0 : Math.PI);
      const tp = homingPoint(s, pw.dir, pw.owner, b.r);
      const L = b.r * 4.4, hh = b.r * 0.8;
      const C = s.C, k = clamp(pw.t / 0.25, 0, 1), n = note(pw);
      // TARGETING MODE for the whole flight: the sky goes to a green radar night, a range grid
      // lies over the pitch, crosshairs run edge to edge through the lock, a giant radar scope
      // sweeps over the champion's half with both blips on it, and "LOCKED" blinks by the goal.
      g.save();
      skyShade(g, C, '#0d2b1c', 0.6 * k, 300);
      g.globalAlpha = 0.2 * k; g.strokeStyle = '#39ff88'; g.lineWidth = 2;
      g.beginPath();
      for (let x = ((s.t * 40) % 53); x < C.W; x += 53) { g.moveTo(x, 0); g.lineTo(x, C.GROUND_Y); }
      for (let y = 26; y < C.GROUND_Y; y += 53) { g.moveTo(0, y); g.lineTo(C.W, y); }
      g.stroke();
      g.globalAlpha = 0.75 * k;
      keyline(g, () => { g.beginPath(); g.moveTo(0, tp.y); g.lineTo(C.W, tp.y); g.moveTo(tp.x, 0); g.lineTo(tp.x, C.GROUND_Y); }, '#ff2e63', 2, '#0d2b1c');
      g.fillStyle = '#ff2e63';
      for (let x = tp.x % 40; x < C.W; x += 40) g.fillRect(x - 1, tp.y - 6, 3, 12);
      const rx = C.W / 2 - pw.dir * 300, ry = 130, RR = 88, sw = s.t * 5;
      s.fx.drawGlow(g, rx, ry, 160, '#39ff88', 0.45 * k);
      g.globalAlpha = 0.85 * k; g.fillStyle = '#0d2b1c';
      g.beginPath(); g.arc(rx, ry, RR, 0, TAU); g.fill();
      g.strokeStyle = '#39ff88'; g.lineWidth = 3;
      for (const f of [1, 0.66, 0.33]) { g.beginPath(); g.arc(rx, ry, RR * f, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(rx - RR, ry); g.lineTo(rx + RR, ry); g.moveTo(rx, ry - RR); g.lineTo(rx, ry + RR); g.stroke();
      g.fillStyle = '#39ff88';
      for (let i = 0; i < 5; i++) {
        g.globalAlpha = (0.5 - i * 0.09) * k;
        g.beginPath(); g.moveTo(rx, ry); g.arc(rx, ry, RR, sw - (i + 1) * 0.2, sw - i * 0.2); g.closePath(); g.fill();
      }
      const bl = (x, y, col) => {
        const dx = (x - C.W / 2) / (C.W / 2), dy = (y - C.H / 2) / (C.H / 2);
        g.globalAlpha = k; g.fillStyle = col; g.fillRect(rx + dx * RR * 0.8 - 5, ry + dy * RR * 0.6 - 5, 10, 10);
      };
      bl(b.x, b.y, '#ffffff'); bl(tp.x, tp.y, '#ff2e63');
      if ((s.t * 3) % 1 < 0.6) {
        g.globalAlpha = k;
        g.font = '900 30px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        const lx = clamp(tp.x - pw.dir * 90, 90, C.W - 90), ly = tp.y - 70;
        g.lineWidth = 7; g.strokeStyle = '#0d2b1c'; g.strokeText('נעול', lx, ly);
        g.fillStyle = '#39ff88'; g.fillText('נעול', lx, ly);
      }
      // the smoke it has laid: a thick keylined contrail along the real curve it steered
      const h = n.h || [];
      for (let i = 0; i < h.length; i++) {
        const u = i / h.length, r = 5 + (1 - u) * 16;
        g.globalAlpha = u * 0.9 * k; g.fillStyle = '#0d2b1c';
        g.beginPath(); g.arc(h[i].x, h[i].y, r + 3, 0, TAU); g.fill();
      }
      for (let i = 0; i < h.length; i++) {
        const u = i / h.length, r = 5 + (1 - u) * 16;
        g.globalAlpha = u * 0.95 * k; g.fillStyle = i % 3 ? '#b8bfc9' : '#9aa1ab';
        g.beginPath(); g.arc(h[i].x, h[i].y, r, 0, TAU); g.fill();
      }
      g.restore();
      // the guidance line and the lock, glowing and pinging
      s.fx.drawGlow(g, tp.x, tp.y, 70, '#ff2e63', 0.8);
      g.save();
      g.lineWidth = 4; g.strokeStyle = '#ff2e63';
      g.beginPath(); g.arc(tp.x, tp.y, 40, s.t * 4, s.t * 4 + 1.6); g.stroke();
      g.beginPath(); g.arc(tp.x, tp.y, 40, s.t * 4 + Math.PI, s.t * 4 + Math.PI + 1.6); g.stroke();
      g.setLineDash([8, 8]); g.lineDashOffset = -s.t * 90;
      g.globalAlpha = 0.45; g.strokeStyle = '#ff2e63'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(tp.x, tp.y); g.stroke();
      g.setLineDash([]);
      const u = (s.t * 2) % 1;
      g.globalAlpha = (1 - u) * 0.8; g.strokeStyle = '#39ff88'; g.lineWidth = 3;
      g.beginPath(); g.arc(tp.x, tp.y, 8 + u * 36, 0, TAU); g.stroke();
      g.restore();
      drawReticle(g, tp.x, tp.y, 28 + Math.sin(s.t * 18) * 3, 0, '#ff2e63', 1);
      // the flame's light, then the missile: body behind the ball, fins at the tail
      const ca = Math.cos(ang), sa = Math.sin(ang);
      s.fx.drawGlow(g, d.x - ca * (L + 14), d.y - sa * (L + 14), 40, '#ff2e63', 0.85);
      g.save();
      g.translate(d.x, d.y); g.rotate(ang);
      const fl = 18 + Math.random() * 12;
      g.shadowColor = '#ff2e63'; g.shadowBlur = 12;
      drawMissile(g, L, hh, fl);
      g.shadowBlur = 0;
      // the ball as the warhead, drawn last and ringed so it is always found
      g.fillStyle = '#d7dde5'; g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.fill();
      g.strokeStyle = '#ff2e63'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, b.r - 1, -1.1, 1.1); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, b.r + 2, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(-b.r * 0.4, -b.r * 0.55, 4, 3);
      g.restore();
    },

    trail(b, s) {
      const { fx } = s, n = note(b.power);
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const tx = b.x - b.vx / sp * 70, ty = b.y - b.vy / sp * 70;
      const td = s.depth(tx, ty);
      (n.h || (n.h = [])).push({ x: td.x, y: td.y });
      if (n.h.length > 24) n.h.shift();
      fx.emit({ shape: 'smoke', x: tx, y: ty, vx: fx.rand(-10, 10), vy: -12, r: 5, r1: 20, life: 0.9, color: '#9aa1ab', layer: 'back' });
      fx.emit({ shape: 'dot', x: tx, y: ty, vx: -b.vx * 0.15 + fx.rand(-40, 40), vy: -b.vy * 0.15 + fx.rand(-40, 40), r: 3, life: 0.22, color: '#ff2e63', blend: 'lighter' });
      if (Math.random() < 0.4) fx.emit({ shape: 'streak', x: tx, y: ty, vx: -b.vx * 0.3, vy: -b.vy * 0.3, r: 3, w: 2, life: 0.2, color: '#ffffff', blend: 'lighter' });
    },

    impact(s, ev) {
      const { fx } = s;
      lightUp(s, ev.x, ev.y, { c1: '#ff2e63', c2: '#ffb347', r: 220, reach: 420, n: 18, spin: 2 });
      fx.emit({ shape: 'dot', x: ev.x, y: ev.y, r: 20, r1: 80, life: 0.28, color: '#ffffff', color2: '#ff2e63', blend: 'lighter' });
      fx.ring(ev.x, ev.y, { color: '#ff2e63', r1: 200, life: 0.5, w: 9 });
      fx.ring(ev.x, ev.y, { color: '#39ff88', r: 4, r1: 130, life: 0.65, w: 3, layer: 'front' });
      fx.burst(ev.x, ev.y, 30, { shape: 'shard', speed: 500, r: 6, spin: 16, grav: 900, life: 0.85, color: '#9aa1ab', color2: '#d7dde5' });
      fx.burst(ev.x, ev.y, 24, { shape: 'streak', speed: 620, color: '#ffb347', color2: '#ff2e63', life: 0.4, w: 3, blend: 'lighter' });
      fx.burst(ev.x, ev.y, 14, { shape: 'smoke', speed: 110, r: 9, r1: 30, drag: 2, life: 1.2, color: '#9aa1ab', layer: 'back' });
      fx.confetti(ev.x, ev.y, 20, ['#d7dde5', '#9aa1ab', '#ff2e63']);
      fx.rays(ev.x, ev.y, { color: '#0d2b1c', color2: '#ffb347', n: 14, r: 40, r1: 520, life: 0.8, spin: -2, alpha: 0.4, blend: null });
      fx.ring(ev.x, ev.y, { color: '#ffb347', r: 40, r1: 380, life: 0.9, w: 6 });
      fx.burst(ev.x, ev.y - 20, 10, { shape: 'smoke', speed: 60, spread: 1, angle: -Math.PI / 2, r: 14, r1: 44, drag: 1, life: 1.4, color: '#3b3f46', layer: 'back' });
      stampAt(s, ev.x, ev.y - 90, 'בום!', { r: 80, color: '#ffb347', edge: '#0d2b1c' });
      fx.vignette('#ffb347', 0.6, 1.2);
      fx.shake(16, 0.5);
      fx.flash('#ff2e63', 0.35, 0.18);
    },

    end(s) {
      const b = s.M.ball, { fx } = s;
      fx.glow(b.x, b.y, 100, '#ff2e63', { life: 1.1, alpha: 0.5 });
      for (let i = 0; i < fx.n(7); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-14, 14), y: b.y, vy: -45 - i * 7, vx: fx.rand(-10, 10), r: 7, r1: 26, life: 1.4, color: '#9aa1ab', layer: 'back' });
      fx.ring(b.x, b.y, { color: '#39ff88', r: 6, r1: 100, life: 0.7, w: 3 });
    },
  },

  // ── 36 · gravflip — the galaxy ────────────────────────────────────────────
  gravflip: {
    theme: 'Inverted galaxy',
    visual: 'cosmic nebula tint, a starfield streaming upward, planets orbiting the ball as it falls up through inverted space',
    palette: ['#1a1147', '#7b4ddb', '#3a86ff', '#f3ecff', '#ff8fc8'],
    doc: {
      fantasy: 'The champion turns the pitch into deep space and space is upside down: the ball falls UP into the stars.',
      purpose: 'A header-height pop (lift 0.8) and then 2.5s of inverted ball gravity (ballGrav -1): the ball rises to the ceiling and rolls along it, then drops back when gravity returns — the rival\'s read of every bounce is wrong for 2.5s.',
      player: 'Fill the meter, press POWER to arm, then touch the ball with head or body. The flip lasts 2.5s for the ball only; players keep normal gravity.',
      bot: "Arms at 'any' moment and plays as a 'keeper' — it holds its line and flips the ball when it needs the ball out of its own box.",
      sequence: {
        anticipation: "While armed a spinning violet-blue-pink halo rings the champion's head with twinkles falling UP off it, a big spiral galaxy turns at his feet in a violet glow, and a pink ringed planet orbits outside the halo.",
        activation: "Cut-in: a giant spiral galaxy wheels under the band round a glowing core, a ringed planet beside it. Then a cosmic burst: two sunbursts (violet-blue and white-blue), two rings, 30 stars, 20 rising sparks, 16 streaks shooting up and 20 confetti that fall UP, 🪐🌙⭐ floating upward, a huge upside-down \"הפוך!\", a deep-indigo grade (α 0.3, 0.6s), a violet vignette and a shake.",
        main: "DEEP SPACE for 2.5s: a night fill (α 0.22) and, above the ad boards, near-black space; three big nebula clouds (pink, blue, violet); two rivers of stars streaming UP the sky and a starfield of rising streaks; a giant backwards-turning spiral galaxy; a huge keylined blue ringed planet with bands, a cratered pink planet and a small green world; twinkling glows and a shooting star; the ball glows violet with two planets on a tilted orbit (far half behind it, near half in front), rising chevrons point the way it falls, and stars peel off upward.",
        impact: "'land': a big violet glow, two rings, an upward starburst and a violet vignette held for the whole flip.",
        aftermath: "Gravity snaps back: a \"נופל!\" stamp, a pale ring, white and blue glows fading, and a shower of stars falling DOWN out of the sky.",
        cleanup: "The space, nebulae, star streams and planets fade over the last 0.4s; stars fall and die within 1.2s.",
      },
      layers: "Aura halo, rising twinkles, glow, galaxy spiral and ringed planet; cut-in giant galaxy and planet; touch sunbursts, stamp, stars, streaks, glyphs, up-falling confetti; back: night fill, space gradient, nebulae, star streams, galaxy, planets, upward starfield, ringed planet, shooting star, twinkle glows, ball glow, far orbit half; front: near orbit half, planets with glows, chevrons, ball ring; star particles.",
      camera: "A 0.6s indigo grade (α 0.3), a violet vignette and shake 8 on firing; the night fill (α 0.22 full-screen) and the space band over the sky while it holds.",
      hud: 'No status pill (no target player); the nebula fading out is the time-left.',
      audio: 'Fire: a shimmering rising sine sweep with a detuned triangle layer. Impact: a soft chime blip. End: a falling sweep as gravity returns.',
      counterplay: 'Do not jump for the header it looks like — it is going up. Wait under the ceiling roll and be where it drops after 2.5s.',
      perf: "≈100 particles on firing, 36 pre-placed stars reused for the streams and the starfield, ≤12 drawGlow per frame, four radial and one linear gradient per frame plus one per planet, ≤2 particles per frame, no shadowBlur, no per-frame allocation of the starfield.",
      helpers: "fx.rays, fx.glow, fx.glyph, fx.stamp, fx.confetti (negative grav), fx.vignette, fx.drawGlow, fx.burst, fx.ring, fx.tint, fx.shake, s.depth; STARS precomputed at load; drawPlanet(), twinkle(), haloRing().",
    },
    sounds: {
      fire: [{ k: 'sweep', from: 300, to: 1500, type: 'sine', peak: 0.3, dur: 0.7 }, { k: 'sweep', from: 310, to: 1520, type: 'triangle', peak: 0.12, dur: 0.7, detune: 30 }],
      impact: [{ k: 'blip', freq: 1560, type: 'sine', peak: 0.15, dur: 0.25 }],
      end: [{ k: 'sweep', from: 1200, to: 180, type: 'sine', peak: 0.2, dur: 0.5 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const hd = s.depth(p.x, s.headY(p)), hr = s.headR(p) + 14;
      const hh = haloRing(g, s, p, ['#7b4ddb', '#3a86ff', '#ff8fc8', '#f3ecff'], { spin: -3, edge: '#1a1147' });
      // stars twinkling round the halo, falling UP off it
      g.save();
      for (let i = 0; i < 6; i++) {
        const u = (s.t * 0.9 + i / 6) % 1, a = i * 1.7;
        g.globalAlpha = 1 - u;
        twinkle(g, hh.x + Math.cos(a) * (hh.r + 10), hh.y + Math.sin(a) * hh.r * 0.6 - u * 60, 6, i % 2 ? '#ff8fc8' : '#f3ecff');
      }
      g.restore();
      s.fx.drawGlow(g, d.x, d.y - 4, 80, '#7b4ddb', 0.8);
      g.save();
      // a spiral galaxy turning at his feet
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 10; i++) {
          const a = s.t * 2 + arm * Math.PI + i * 0.45, r = 5 + i * 4.5;
          g.globalAlpha = 0.9 - i * 0.07;
          g.fillStyle = i < 2 ? '#f3ecff' : i % 2 ? '#7b4ddb' : '#3a86ff';
          g.fillRect(d.x + Math.cos(a) * r - 2, d.y - 3 + Math.sin(a) * r * 0.35 - 2, 4, 4);
        }
      }
      // a ringed planet orbiting his head
      const a = s.t * 2.2;
      const px = hd.x + Math.cos(a) * (hr + 22), py = hd.y + Math.sin(a) * 12;
      g.globalAlpha = 1; g.fillStyle = '#ff8fc8';
      g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill();
      g.strokeStyle = '#f3ecff'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(px, py, 13, 4, -0.4, 0, TAU); g.stroke();
      g.restore();
    },

    cutin(g, s, k) {
      const f = cutFade(k), C = s.C, from = cutFrom(s);
      const x = C.W / 2 + from * (1 - cutEase(k)) * C.W * 0.7, y = C.H * 0.76;
      s.fx.drawGlow(g, x, y, 200, '#7b4ddb', 0.8 * f);
      s.fx.drawGlow(g, x, y, 70, '#f3ecff', 0.8 * f);
      g.save();
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 16; i++) {
          const a = -k * 5 + arm * TAU / 3 + i * 0.32, r = 20 + i * 15;
          g.globalAlpha = (1 - i / 20) * f;
          g.fillStyle = i < 3 ? '#f3ecff' : i % 3 === 0 ? '#ff8fc8' : i % 2 ? '#7b4ddb' : '#3a86ff';
          const sz = 12 - i * 0.5;
          g.fillRect(x + Math.cos(a) * r - sz / 2, y + Math.sin(a) * r * 0.45 - sz / 2, sz, sz);
        }
      }
      // a ringed planet beside it
      const px = x - from * 330, py = y - 30;
      g.globalAlpha = f; g.fillStyle = '#ff8fc8';
      g.beginPath(); g.arc(px, py, 48, 0, TAU); g.fill();
      g.strokeStyle = '#f3ecff'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(px, py, 90, 22, -0.35, 0, TAU); g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      lightUp(s, at.x, at.y, { c1: '#7b4ddb', c2: '#3a86ff', r: 170, core: '#f3ecff', vig: '#7b4ddb', n: 16 });
      fx.burst(at.x, at.y, 30, { shape: 'star', speed: 300, r: 6, spin: 6, drag: 1.5, life: 0.9, color: '#f3ecff', color2: '#7b4ddb' });
      fx.burst(at.x, at.y, 20, { shape: 'dot', speed: 160, spread: 1.4, angle: -Math.PI / 2, r: 3, grav: -300, life: 1, color: '#3a86ff', color2: '#ff8fc8', blend: 'lighter' });
      fx.confetti(at.x, at.y, 20, ['#7b4ddb', '#3a86ff', '#ff8fc8', '#f3ecff'], { grav: -420 });
      fx.ring(at.x, at.y, { color: '#7b4ddb', r1: 160, life: 0.55, w: 6 });
      fx.ring(at.x, at.y, { color: '#3a86ff', r: 4, r1: 90, life: 0.45, w: 4, layer: 'front' });
      // upside down, because that is what it does
      fx.rays(at.x, at.y, { color: '#f3ecff', color2: '#3a86ff', n: 20, r: 50, r1: 560, life: 1.1, spin: -1.2, alpha: 0.4 });
      fx.ring(at.x, at.y, { color: '#ff8fc8', r: 20, r1: 320, life: 0.9, w: 7 });
      fx.burst(at.x, at.y, 16, { shape: 'streak', speed: 520, spread: 1.2, angle: -Math.PI / 2, w: 3, r: 5, life: 0.45, color: '#f3ecff', color2: '#b89cff', blend: 'lighter' });
      for (let i = 0; i < 3; i++) fx.glyph(at.x, at.y, ['🪐', '🌙', '⭐'][i], { r: 40, vx: fx.rand(-240, 240), vy: fx.rand(-200, -80), grav: -300, spin: fx.rand(-4, 4), life: 1.2 });
      stampAt(s, at.x, at.y - 110, 'הפוך!', { r: 70, color: '#ff8fc8', edge: '#1a1147', rot: Math.PI + fx.rand(-0.15, 0.15) });
      fx.tint('#1a1147', 0.3, 0.6);
      fx.shake(8, 0.35);
    },

    back(g, e, s) {
      const k = fade(e, 0.3, 0.4);
      const C = s.C, b = s.M.ball;
      const bd = s.depth(b.x, b.y);
      g.save();
      // DEEP SPACE. The whole pitch under a night fill, and everything above the ad boards gone
      // to black space — near-opaque at the top, so a sunny carnival cannot wash it out.
      g.globalAlpha = 0.22 * k; g.fillStyle = '#1a1147';
      g.fillRect(0, 0, C.W, C.H);
      const skyH = C.GROUND_Y * 0.82;
      const sky = g.createLinearGradient(0, 0, 0, skyH);
      sky.addColorStop(0, '#05021a'); sky.addColorStop(0.55, 'rgba(13,8,38,0.85)'); sky.addColorStop(1, 'rgba(26,17,71,0)');
      g.globalAlpha = 0.92 * k; g.fillStyle = sky; g.fillRect(0, 0, C.W, skyH);
      // three nebula clouds, drifting: pink, blue and violet gas lit from inside
      for (let i = 0; i < 3; i++) {
        const x = C.W * (0.18 + i * 0.32) + Math.sin(s.t * 0.5 + i * 2) * 40, y = 130 + (i % 2) * 70, R = 230;
        const gr = g.createRadialGradient(x, y, 10, x, y, R);
        gr.addColorStop(0, ['#ff8fc8', '#3a86ff', '#b89cff'][i]); gr.addColorStop(0.45, i === 1 ? '#1f3f9e' : '#5a2fb0'); gr.addColorStop(1, 'rgba(26,17,71,0)');
        g.globalAlpha = 0.62 * k; g.fillStyle = gr;
        g.fillRect(x - R, y - R, R * 2, R * 2);
      }
      // star streams: two rivers of stars flowing UP the sky in long diagonal bands
      g.lineCap = 'round';
      for (let band = 0; band < 2; band++) {
        for (let i = 0; i < 18; i++) {
          const st = STARS[i + band * 18], u = (st.y + s.t * 0.35 * st.v) % 1;
          const x = C.W * (band ? 0.62 : 0.08) + u * -160 + st.x * 260, y = C.GROUND_Y - u * (C.GROUND_Y + 40);
          g.globalAlpha = Math.sin(u * Math.PI) * k; g.strokeStyle = i % 4 ? '#f3ecff' : '#ff8fc8'; g.lineWidth = st.s;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 24); g.stroke();
        }
      }
      // a giant spiral galaxy wheeling in the sky (turning backwards: space has flipped)
      const gx = C.W * 0.42, gy = 130;
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 18; i++) {
          const a = -s.t * 0.9 + arm * TAU / 3 + i * 0.3, r = 14 + i * 15;
          g.globalAlpha = (1 - i / 22) * k;
          g.fillStyle = i < 3 ? '#ffffff' : i % 3 === 0 ? '#ff8fc8' : i % 2 ? '#b89cff' : '#6fa8ff';
          const sz = 11 - i * 0.4;
          g.fillRect(gx + Math.cos(a) * r - sz / 2, gy + Math.sin(a) * r * 0.42 - sz / 2, sz, sz);
        }
      }
      // more worlds: a cratered pink planet on the left, a little green one drifting, a moon
      g.globalAlpha = k;
      const p1x = C.W * 0.1, p1y = 96 + Math.sin(s.t * 0.8) * 6;
      drawPlanet(g, p1x, p1y, 44, '#ffd0e6', '#ff8fc8', '#8a2f6a');
      g.fillStyle = '#c45a98';
      for (const [cx, cy, r] of [[-14, -8, 8], [12, 12, 6], [16, -16, 4]]) { g.beginPath(); g.arc(p1x + cx, p1y + cy, r, 0, TAU); g.fill(); }
      const p2a = s.t * 0.6;
      drawPlanet(g, C.W * 0.62 + Math.cos(p2a) * 40, 70 + Math.sin(p2a) * 12, 18, '#d6ffe0', '#5fd38a', '#1d6b45');
      // a violet gravity column rising from the ball to the ceiling: "it falls UP"
      const col = g.createLinearGradient(0, C.CEIL_Y, 0, bd.y);
      col.addColorStop(0, 'rgba(123,77,219,0)'); col.addColorStop(1, 'rgba(184,156,255,0.9)');
      g.globalAlpha = 0.45 * k; g.fillStyle = col;
      g.fillRect(bd.x - b.r * 1.6, C.CEIL_Y, b.r * 3.2, Math.max(0, bd.y - C.CEIL_Y));
      // the starfield, streaming upward: space has turned over. Streaks, not specks — a speck
      // is lost in the crowd; a rising streak reads as "everything is falling up".
      const H = C.GROUND_Y - C.CEIL_Y;
      for (const st of STARS) {
        const y = C.CEIL_Y + (((st.y * H - s.t * 120 * st.v) % H) + H) % H;
        g.globalAlpha = Math.min(1, 0.9 * st.v + 0.2) * k;
        g.fillStyle = st.s > 2 ? '#ff8fc8' : '#f3ecff';
        g.fillRect(st.x * C.W, y, st.s + 2, 14 + st.v * 16);
      }
      // a big ringed planet hanging in the sky, dark-outlined so it reads on a bright stage
      const px = C.W * 0.8, py = 128 + Math.sin(s.t) * 5;
      g.globalAlpha = k; g.strokeStyle = '#1a1147'; g.lineWidth = 14;
      g.beginPath(); g.ellipse(px, py, 118, 26, -0.3, Math.PI, TAU); g.stroke();
      g.strokeStyle = '#ff8fc8'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(px, py, 118, 26, -0.3, Math.PI, TAU); g.stroke();
      g.strokeStyle = '#f3ecff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(px, py, 104, 21, -0.3, Math.PI, TAU); g.stroke();
      drawPlanet(g, px, py, 60, '#9cc4ff', '#3a86ff', '#1a3a8a');
      g.globalAlpha = 0.5 * k; g.fillStyle = '#1a3a8a';
      g.fillRect(px - 52, py - 8, 104, 8); g.fillRect(px - 44, py + 20, 88, 6);
      g.globalAlpha = k;
      g.strokeStyle = '#1a1147'; g.lineWidth = 14;
      g.beginPath(); g.ellipse(px, py, 118, 26, -0.3, 0, Math.PI); g.stroke();
      g.strokeStyle = '#ff8fc8'; g.lineWidth = 8;
      g.beginPath(); g.ellipse(px, py, 118, 26, -0.3, 0, Math.PI); g.stroke();
      g.strokeStyle = '#f3ecff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(px, py, 104, 21, -0.3, 0, Math.PI); g.stroke();
      // a shooting star, streaking UP every 1.2s
      const u = (s.t / 1.2) % 1;
      if (u < 0.35) {
        const sx = C.W * (0.15 + ((Math.floor(s.t / 1.2) * 0.37) % 0.7)), sy = C.GROUND_Y - 40 - (u / 0.35) * 320;
        g.globalAlpha = (1 - u / 0.35) * k; g.strokeStyle = '#f3ecff'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx + 30, sy + 60); g.lineTo(sx, sy); g.stroke();
      }
      // the far half of the planets' orbit, behind the ball
      g.globalAlpha = 0.75 * k; g.strokeStyle = '#7b4ddb'; g.lineWidth = 3;
      g.lineWidth = 4;
      g.beginPath(); g.ellipse(bd.x, bd.y, b.r * 4.4, b.r * 1.5, -0.35, Math.PI, TAU); g.stroke();
      g.restore();
      // big stars twinkling, and the ball glowing violet
      for (let i = 0; i < 8; i++) {
        const st = STARS[i];
        s.fx.drawGlow(g, st.x * C.W, C.CEIL_Y + st.y * (H * 0.6), 26, '#f3ecff', (0.5 + 0.4 * Math.sin(s.t * 4 + i * 1.7)) * k);
      }
      s.fx.drawGlow(g, gx, gy, 150, '#b89cff', 0.5 * k);
      s.fx.drawGlow(g, gx, gy, 34, '#ffffff', 0.6 * k);
      s.fx.drawGlow(g, bd.x, bd.y, 120, '#7b4ddb', 0.9 * k);
    },

    front(g, e, s) {
      const k = fade(e, 0.3, 0.4);
      const b = s.M.ball, bd = s.depth(b.x, b.y);
      const rx = b.r * 4.4, ry = b.r * 1.5, tilt = -0.35;
      g.save();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#7b4ddb'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(bd.x, bd.y, rx, ry, tilt, 0, Math.PI); g.stroke();
      // two planets on the ring; the one on the far side is drawn small and dim
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      [['#ff8fc8', 0, 11], ['#3a86ff', Math.PI, 10]].forEach(([col, ph, r]) => {
        const a = s.t * 3 + ph;
        const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        const near = Math.sin(a) > 0;
        const x = bd.x + ex * ct - ey * st, y = bd.y + ex * st + ey * ct;
        if (near) s.fx.drawGlow(g, x, y, 30, col, 0.9 * k);
        g.globalAlpha = (near ? 1 : 0.55) * k; g.fillStyle = col;
        g.beginPath(); g.arc(x, y, near ? r : r * 0.7, 0, TAU); g.fill();
        g.strokeStyle = '#1a1147'; g.lineWidth = 2; g.stroke();
      });
      // chevrons above it: this ball is falling UP
      const up = b.vy < 0 ? 1 : 0.4;
      g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const u = (s.t * 2 + i / 3) % 1;
        const y = bd.y - b.r * 1.3 - 12 - u * 40;
        g.globalAlpha = (1 - u) * k * up;
        g.strokeStyle = i % 2 ? '#ff8fc8' : '#f3ecff';
        g.beginPath(); g.moveTo(bd.x - 12, y + 8); g.lineTo(bd.x, y); g.lineTo(bd.x + 12, y + 8); g.stroke();
      }
      // a pale ring on the ball itself, so it is found in the stars
      g.globalAlpha = k; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.arc(bd.x, bd.y, b.r + 3, 0, TAU); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx } = s, b = s.M.ball;
      if (Math.random() < 0.7) fx.emit({ shape: 'star', x: b.x + fx.rand(-22, 22), y: b.y + fx.rand(0, 20), vx: fx.rand(-15, 15), vy: -fx.rand(80, 170), spin: 4, r: 4, life: 0.75, color: '#f3ecff', color2: '#ff8fc8' });
      if (Math.random() < 0.35) fx.emit({ shape: 'dot', x: fx.rand(0, s.C.W), y: s.C.GROUND_Y - 4, vy: -fx.rand(160, 260), r: 2, life: 1.2, color: '#3a86ff', layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      fx.glow(ev.x, ev.y, 180, '#7b4ddb', { life: 0.8 });
      fx.ring(ev.x, ev.y, { color: '#7b4ddb', r: 8, r1: 130, life: 0.55, w: 5, layer: 'front' });
      fx.ring(ev.x, ev.y, { color: '#3a86ff', r: 8, r1: 240, life: 0.8, w: 4, layer: 'front' });
      fx.vignette('#7b4ddb', 0.55, 2.5);
      fx.burst(ev.x, ev.y, 20, { shape: 'star', speed: 240, spread: 1.6, angle: -Math.PI / 2, r: 5, spin: 5, life: 0.9, color: '#ff8fc8', color2: '#f3ecff' });
    },

    end(s) {
      const b = s.M.ball, { fx } = s;
      fx.glow(b.x, b.y, 150, '#f3ecff', { life: 1.4, alpha: 0.55 });
      fx.glow(s.C.W * 0.8, 128, 160, '#3a86ff', { life: 1.4, alpha: 0.5 });
      fx.ring(b.x, b.y, { color: '#f3ecff', r: 6, r1: 160, life: 0.8, w: 5 });
      stampAt(s, b.x, b.y - 90, 'נופל!', { r: 48, color: '#b89cff', edge: '#1a1147', life: 0.8 });
      for (let i = 0; i < fx.n(14); i++) fx.emit({ shape: 'star', x: fx.rand(80, s.C.W - 80), y: s.C.CEIL_Y + fx.rand(0, 80), vy: fx.rand(60, 140), grav: 400, spin: 4, r: 5, life: 1.2, color: '#f3ecff', color2: '#7b4ddb' });
    },
  },
};
