// Head Soccer's stadium, painted (Idan, 2026-09-26: "do everything like HS") — and, since
// 2026-10-08, painted at a 2026 game's quality, like Head Ball 2 (Idan: "more 2026 game with
// higher quality"). The layout is still HS's, off its own frames (hs-video/M4 30.2 s): sky with
// clouds and a floodlight mast at each end, a roof edge, two tiers of stands packed with a still
// crowd split by a strip of banners and cut by stair aisles, a tunnel mouth up the middle aisle,
// then the hoardings and the floor with HS's markings. What changed is the finish: everything is
// painted at the screen's full resolution (the crowd used to be painted at a third of it and
// scaled up, to sit soft like HS's), in full colour (no warm grey veils over the crowd and the
// boards), with lit volumetric clouds, a sun or a night glow, glowing floodlights, red seats,
// and a pitch with light, shade and texture instead of flat stripes.
//
// Same contract as a stage in stages.js: `draw(g, s)` with s = { W, horizon, crowdTop, crowdBot,
// gy, t } in world units. `static: true` tells game.js the picture never changes, so it is drawn
// once per canvas size. `ground(g, s)` paints the boards and the floor into the same baked layer
// (game.js stageLayer), so their texture and light cost nothing per frame.
import * as C from '../shared/constants.js';

// A tiny seeded PRNG, so a stadium's crowd is the same crowd every match.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SKIN = ['#f6d2b0', '#eebd96', '#dca577', '#c48a5c', '#a06a42', '#7a4c2c', '#5a3620'];
const HAIR = ['#1f1510', '#3b2616', '#5e3b1e', '#141414', '#9a5a26', '#e0bd72', '#8a8a8a', '#b8432a'];
const SHIRT = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#00acc1', '#f06292', '#3949ab', '#c0ca33', '#222831'];
const BANNER = ['#d7263d', '#f4c20d', '#1bb3a6', '#8a3ffc', '#2e86de', '#e84393'];
const TAU = 6.2832;

// A GLOW: a light's halo, faded out the way light falls off (fast near the middle, a long faint
// tail), never linearly — a linear fade shows its own edge as a ring or, where two overlap, a box.
// `rgb` is 'r,g,b'; `a` the alpha at the middle; `sy` squashes it into an ellipse.
function glow(g, x, y, R, rgb, a, sy = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, R);
  for (const [k, f] of [[0, 1], [0.06, 0.7], [0.15, 0.4], [0.3, 0.18], [0.5, 0.07], [0.72, 0.02], [1, 0]]) gr.addColorStop(k, `rgba(${rgb},${a * f})`);
  g.save();
  if (sy !== 1) { g.translate(x, y); g.scale(1, sy); g.translate(-x, -y); }
  g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R);
  g.restore();
}

// ── THE SKY ──────────────────────────────────────────────────────────────
function sky(g, W, top, bot, night) {
  const gr = g.createLinearGradient(0, top, 0, bot);
  if (night) { gr.addColorStop(0, '#02061c'); gr.addColorStop(0.55, '#0b1844'); gr.addColorStop(1, '#1e3778'); }
  else { gr.addColorStop(0, '#0f7fe6'); gr.addColorStop(0.55, '#3db4f7'); gr.addColorStop(1, '#a6e4ff'); }
  g.fillStyle = gr; g.fillRect(0, top - 60, W, bot - top + 60);
  const r = rng(7);
  if (night) {
    // the city's glow on the horizon, behind the roof
    const hg = g.createLinearGradient(0, bot - 40, 0, bot);
    hg.addColorStop(0, 'rgba(120,150,255,0)'); hg.addColorStop(1, 'rgba(140,170,255,0.35)');
    g.fillStyle = hg; g.fillRect(0, bot - 40, W, 40);
    // stars, round and of different sizes, a few with a sparkle cross
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = top + r() * (bot - top) * 0.85, s = 0.4 + r() * r() * 1.4, a = 0.35 + r() * 0.65;
      g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
      if (s > 1.2) {
        g.strokeStyle = `rgba(200,220,255,${a * 0.5})`; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(x - s * 3, y); g.lineTo(x + s * 3, y); g.moveTo(x, y - s * 3); g.lineTo(x, y + s * 3); g.stroke();
      }
    }
    // the moon, with its glow
    const mx = W * 0.36, my = top + 22;
    glow(g, mx, my, 70, '210,225,255', 0.5);
    const md = g.createRadialGradient(mx - 3, my - 3, 1, mx, my, 10);
    md.addColorStop(0, '#ffffff'); md.addColorStop(1, '#d7def0');
    g.fillStyle = md; g.beginPath(); g.arc(mx, my, 10, 0, TAU); g.fill();
    g.fillStyle = 'rgba(150,160,190,0.35)';
    for (const [dx, dy, rr] of [[-3, -2, 2.4], [3, 3, 1.8], [2, -5, 1.2]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, TAU); g.fill(); }
    return;
  }
  // the sun up in the corner: a warm glow and a few soft rays
  const sx = W * 0.82, sy = top - 14;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = 1.75 + i * 0.16, len = 260 + (i % 3) * 60;
    const rg = g.createRadialGradient(sx, sy, 10, sx, sy, len);
    rg.addColorStop(0, 'rgba(255,250,215,0.16)'); rg.addColorStop(1, 'rgba(255,250,215,0)');
    g.fillStyle = rg; g.beginPath(); g.moveTo(sx, sy);
    g.arc(sx, sy, len, a - 0.045, a + 0.045); g.closePath(); g.fill();
  }
  glow(g, sx, sy, 190, '255,248,215', 1);
  g.restore();
  // far clouds: small, pale and low, half lost in the haze
  for (let i = 0; i < 6; i++) cloud(g, r() * W, bot - 12 - r() * 16, 7 + r() * 6, r, 0.55);
  // near clouds: big lit cumulus
  for (let i = 0; i < 6; i++) cloud(g, (i + 0.15 + r() * 0.7) * W / 6, top + 16 + r() * (bot - top) * 0.42, 15 + r() * 13, r, 1);
}

// A CUMULUS: a heap of round puffs filled as ONE shape (so no seams between them), lit from the
// top: a blue-grey shadow under it, a body that fades from white to a cool belly, a bright rim
// along the top of each puff, and a flat-ish base.
function cloud(g, cx, cy, sz, r, alpha) {
  const n = 5 + Math.floor(r() * 3), puffs = [];
  for (let k = 0; k < n; k++) {
    const u = (k / (n - 1)) * 2 - 1;                        // -1 … 1 across the cloud
    const pr = sz * (1.05 - Math.abs(u) * 0.45) * (0.85 + r() * 0.3);
    puffs.push([cx + u * sz * 2.1, cy - pr * 0.55 + Math.abs(u) * sz * 0.25, pr]);
  }
  puffs.push([cx - sz * 0.4, cy - sz * 1.0, sz * 0.9], [cx + sz * 0.5, cy - sz * 0.85, sz * 0.75]);
  const base = cy + sz * 0.35, x0 = cx - sz * 3.4, x1 = cx + sz * 3.4;
  const shape = (dx, dy) => {
    g.beginPath();
    for (const [px, py, pr] of puffs) { g.moveTo(px + dx + pr, py + dy); g.arc(px + dx, py + dy, pr, 0, TAU); }
  };
  g.save();
  g.globalAlpha = alpha;
  // clip to above the base, so the bottom is flat like a real cumulus
  g.beginPath(); g.rect(x0 - 20, cy - sz * 4, x1 - x0 + 40, base - (cy - sz * 4)); g.clip();
  g.fillStyle = 'rgba(70,120,180,0.22)'; shape(sz * 0.25, sz * 0.3); g.fill();
  const body = g.createLinearGradient(0, cy - sz * 2, 0, base);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.55, '#f4f9ff'); body.addColorStop(1, '#c9ddf2');
  g.fillStyle = body; shape(0, 0); g.fill();
  // the lit tops: each puff's upper-left catches the sun
  for (const [px, py, pr] of puffs) {
    const hg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.45, pr * 0.05, px - pr * 0.2, py - pr * 0.3, pr * 0.95);
    hg.addColorStop(0, 'rgba(255,255,255,0.95)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
  }
  // a soft line of shade along the base
  const bs = g.createLinearGradient(0, base - sz * 0.7, 0, base);
  bs.addColorStop(0, 'rgba(160,190,225,0)'); bs.addColorStop(1, 'rgba(150,180,220,0.55)');
  g.fillStyle = bs; shape(0, 0); g.fill();
  g.restore();
}

// ── THE FLOODLIGHTS ──────────────────────────────────────────────────────
function mast(g, x, top, bot, night) {
  // a tapering steel tower: two legs, lit on the side towards the light, cross-braced
  const legL = night ? '#6a768c' : '#a9b6c6', legD = night ? '#3a4254' : '#6f7c8e';
  g.lineCap = 'round';
  g.strokeStyle = legD; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(x + 7, bot); g.lineTo(x + 3.5, top + 22); g.stroke();
  g.strokeStyle = legL;
  g.beginPath(); g.moveTo(x - 7, bot); g.lineTo(x - 3.5, top + 22); g.stroke();
  g.lineWidth = 1; g.strokeStyle = legD; g.beginPath();
  for (let y = bot, i = 0; y > top + 28; y -= 9, i++) {
    const w0 = 7 - (bot - y) * 0.035, w1 = 7 - (bot - y + 9) * 0.035;
    g.moveTo(x - w0, y); g.lineTo(x + w1, y - 9);
    g.moveTo(x - w1, y - 9); g.lineTo(x + w1, y - 9);
  }
  g.stroke();
  // the light bank: a framed panel of lamps, a little tilted down at the pitch
  const fr = g.createLinearGradient(0, top, 0, top + 26);
  fr.addColorStop(0, night ? '#5d6880' : '#9aa7b8'); fr.addColorStop(1, night ? '#2b3242' : '#4f5a6b');
  g.fillStyle = fr; g.beginPath(); g.roundRect(x - 30, top, 60, 26, 4); g.fill();
  g.strokeStyle = night ? '#8792a8' : '#d5dde7'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 27, top + 1); g.lineTo(x + 27, top + 1); g.stroke();
  g.fillStyle = '#1b2029'; g.beginPath(); g.roundRect(x - 27, top + 3, 54, 20, 2); g.fill();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const lx = x - 19.5 + i * 13, ly = top + 8 + j * 9.5;
    const lg = g.createRadialGradient(lx - 1, ly - 1.2, 0.4, lx, ly, 4.4);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.55, night ? '#fff7d2' : '#f2f7ff'); lg.addColorStop(1, night ? '#e9c55c' : '#a9b8cc');
    g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 4.2, 0, TAU); g.fill();
  }
  // the bloom: lamps glow even by day; at night they flare and throw a beam down at the pitch
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, top + 13, night ? 170 : 60, night ? '255,244,205' : '255,255,255', night ? 1 : 0.6);
  if (night) {
    // a lens flare: a thin bright streak across the bank
    const fl = g.createLinearGradient(x - 120, 0, x + 120, 0);
    fl.addColorStop(0, 'rgba(255,245,210,0)'); fl.addColorStop(0.5, 'rgba(255,245,210,0.55)'); fl.addColorStop(1, 'rgba(255,245,210,0)');
    g.fillStyle = fl; g.fillRect(x - 120, top + 12, 240, 2);
  }
  g.restore();
}

// At night each mast throws a wide soft cone of light down over the stands to the pitch.
// Stacked cones, each narrower than the last, so the beam is bright down its middle and its
// edges melt away instead of being cut.
function beam(g, x, top, toX, bot) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const bg = g.createLinearGradient(0, top, 0, bot);
  bg.addColorStop(0, 'rgba(255,245,210,0.045)'); bg.addColorStop(0.6, 'rgba(255,245,210,0.02)'); bg.addColorStop(1, 'rgba(255,245,210,0)');
  g.fillStyle = bg;
  for (let i = 0; i < 6; i++) {
    const w = 1 - i * 0.15;
    g.beginPath(); g.moveTo(x - 20 * w, top); g.lineTo(x + 20 * w, top); g.lineTo(toX + 260 * w, bot); g.lineTo(toX - 260 * w, bot); g.closePath(); g.fill();
  }
  g.restore();
}

// ONE SPECTATOR, a little cartoon fan in the style of the players: a round shaded head with a
// keyline, eyes and a mouth, one of several haircuts or a hat, shoulders in a shaded shirt and,
// for some, arms up or a scarf held overhead. (x, y) is the seat line; `s` the size for the row's
// depth; `look` which way the eyes point.
function fan(g, x, y, s, r, look, night) {
  const skin = pick(r, SKIN), hair = pick(r, HAIR), shirt = pick(r, SHIRT);
  const ol = night ? 'rgba(0,0,6,0.6)' : 'rgba(28,18,30,0.5)';
  const hr = 5.2 * s, hx = x, hy = y - 10.8 * s;
  const hs = r(), pose = r(), lw = 0.75 * s;
  const style = hs < 0.3 ? 'short' : hs < 0.45 ? 'long' : hs < 0.55 ? 'curly' : hs < 0.65 ? 'bald' : hs < 0.8 ? 'cap' : hs < 0.9 ? 'beanie' : 'spiky';
  const hat = pick(r, SHIRT);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // arms up (behind the shoulders): cheering, or a scarf stretched overhead
  const scarf = pose < 0.07, up = scarf || pose < 0.2 ? 2 : pose < 0.3 ? 1 : 0;
  const side = r() < 0.5 ? -1 : 1;
  for (let k = 0; k < up; k++) {
    const d = up === 2 ? (k ? 1 : -1) : side;
    const sx = hx + d * 5 * s, sy = y - 4 * s, ex = hx + d * (scarf ? 7.5 : 7) * s, ey = hy - (scarf ? 7.5 : 6.5) * s;
    g.strokeStyle = ol; g.lineWidth = 3.4 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = shirt; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(ex, ey, 1.6 * s, 0, TAU); g.fill();
  }
  if (scarf) {
    const c1 = pick(r, BANNER), sw = 7.5 * s, sy = hy - 8.5 * s;
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ffffff' : c1; g.fillRect(hx - sw + (i * 2 * sw) / 5, sy, (2 * sw) / 5 + 0.3, 2.8 * s); }
    g.strokeStyle = ol; g.lineWidth = 0.5 * s; g.strokeRect(hx - sw, sy, 2 * sw, 2.8 * s);
  }
  // long hair and curls sit behind the head
  if (style === 'long') {
    g.fillStyle = hair; g.beginPath(); g.roundRect(hx - hr * 1.12, hy - hr * 0.6, hr * 2.24, hr * 1.95, hr * 0.6); g.fill();
  } else if (style === 'curly') {
    g.fillStyle = hair; g.strokeStyle = ol; g.lineWidth = lw;
    g.beginPath(); g.arc(hx, hy - hr * 0.2, hr * 1.3, 0, TAU); g.fill(); g.stroke();
  }
  // shoulders and chest
  const t = 7 * s;
  g.beginPath();
  g.moveTo(hx - t, y + 6 * s); g.lineTo(hx - t, y - 0.5 * s);
  g.quadraticCurveTo(hx - t, y - 5.8 * s, hx - 2.6 * s, y - 6.2 * s); g.lineTo(hx + 2.6 * s, y - 6.2 * s);
  g.quadraticCurveTo(hx + t, y - 5.8 * s, hx + t, y - 0.5 * s); g.lineTo(hx + t, y + 6 * s); g.closePath();
  g.fillStyle = shirt; g.fill();
  const sg = g.createLinearGradient(hx - t, 0, hx + t, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0.22)'); sg.addColorStop(0.45, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sg; g.fill();
  if (r() < 0.2) {                                   // a striped jersey
    g.save(); g.clip(); g.fillStyle = shirt === '#f5f5f5' ? '#1e88e5' : 'rgba(255,255,255,0.75)';
    for (let i = -2; i <= 2; i++) g.fillRect(hx + i * 3 * s - 0.7 * s, y - 7 * s, 1.4 * s, 14 * s);
    g.restore();
  }
  g.strokeStyle = ol; g.lineWidth = lw; g.stroke();
  // neck and V collar
  g.fillStyle = skin; g.beginPath(); g.moveTo(hx - 2.2 * s, y - 6.3 * s); g.lineTo(hx + 2.2 * s, y - 6.3 * s); g.lineTo(hx, y - 3.2 * s); g.closePath(); g.fill();
  // ears, then the head over them
  g.fillStyle = skin; g.strokeStyle = ol; g.lineWidth = lw;
  for (const d of [-1, 1]) { g.beginPath(); g.arc(hx + d * hr * 0.95, hy + 0.6 * s, 1.5 * s, 0, TAU); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fillStyle = skin; g.fill();
  const hg = g.createRadialGradient(hx - hr * 0.35, hy - hr * 0.45, hr * 0.1, hx, hy, hr * 1.05);
  hg.addColorStop(0, 'rgba(255,255,255,0.3)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(60,20,10,0.22)');
  g.fillStyle = hg; g.fill(); g.stroke();
  // hair / hat on top
  g.fillStyle = hair;
  if (style === 'short' || style === 'long' || style === 'curly') {
    g.beginPath(); g.arc(hx, hy, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0);
    g.quadraticCurveTo(hx + hr * 0.7, hy - hr * 0.55, hx + hr * 0.2 * side, hy - hr * 0.35);
    g.quadraticCurveTo(hx - hr * 0.6, hy - hr * 0.55, hx - hr * 1.04, hy);
    g.fill(); g.stroke();
  } else if (style === 'spiky') {
    g.beginPath(); g.moveTo(hx - hr * 1.02, hy - hr * 0.1);
    for (let i = 0; i <= 5; i++) { const a = Math.PI * (1.05 + i * 0.18); g.lineTo(hx + Math.cos(a) * hr * 1.35, hy + Math.sin(a) * hr * 1.35); g.lineTo(hx + Math.cos(a + 0.28) * hr * 0.95, hy + Math.sin(a + 0.28) * hr * 0.95); }
    g.lineTo(hx + hr * 1.02, hy - hr * 0.1); g.quadraticCurveTo(hx, hy - hr * 0.6, hx - hr * 1.02, hy - hr * 0.1); g.fill(); g.stroke();
  } else if (style === 'cap') {
    g.fillStyle = hat; g.beginPath(); g.arc(hx, hy - hr * 0.12, hr * 1.06, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx + look * hr * 0.9, hy - hr * 0.1, hr * 0.85, hr * 0.26, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(hx - hr * 0.35, hy - hr * 0.7, hr * 0.25, 0, TAU); g.fill();
  } else if (style === 'beanie') {
    g.fillStyle = hat; g.beginPath(); g.arc(hx, hy - hr * 0.1, hr * 1.06, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(hx - hr * 1.06, hy - hr * 0.32, hr * 2.12, hr * 0.32); g.strokeRect(hx - hr * 1.06, hy - hr * 0.32, hr * 2.12, hr * 0.32);
    g.beginPath(); g.arc(hx, hy - hr * 1.18, hr * 0.32, 0, TAU); g.fill(); g.stroke();
  } else {                                           // bald: a shine
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(hx - hr * 0.3, hy - hr * 0.55, hr * 0.35, hr * 0.2, -0.4, 0, TAU); g.fill();
  }
  // the face: eyes towards the play, a mouth — open for the ones cheering
  const ex = hx + look * 1.1 * s, ey = hy + 0.5 * s;
  g.fillStyle = '#1b1320';
  for (const d of [-1, 1]) { g.beginPath(); g.ellipse(ex + d * 1.9 * s, ey, 0.75 * s, 1 * s, 0, 0, TAU); g.fill(); }
  if (up) { g.beginPath(); g.ellipse(ex, ey + 2.6 * s, 1.2 * s, 1 * s, 0, 0, TAU); g.fillStyle = '#6b1d22'; g.fill(); }
  else { g.strokeStyle = '#6b2a24'; g.lineWidth = 0.6 * s; g.beginPath(); g.arc(ex, ey + 1.5 * s, 1.3 * s, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
}


// ── THE STANDS ───────────────────────────────────────────────────────────
// One tier: stepped rows of red seats with the crowd in them, back to front so every row sits in
// front of the one behind; the back rows a little smaller and in a cool haze, so the stand
// recedes. CROWD is the fan's size (HS's fans are big, four rows a tier). Sharp, at the screen's
// own resolution — the soft, out-of-focus HS crowd was the "worse quality" (Idan, 2026-10-08).
const CROWD = 1.9;
function tier(g, W, top, bot, seed, aisles, night) {
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, night ? '#2c2f3c' : '#5d6370'); gr.addColorStop(1, night ? '#4b4f5e' : '#8a909c');
  g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
  const r = rng(seed);
  const rows = [];
  for (let y = top + 13 * CROWD; y < bot + 4 * CROWD; y += 16.5 * CROWD) rows.push(y);
  rows.forEach((y, ri) => {
    const depth = rows.length > 1 ? ri / (rows.length - 1) : 1;
    const s = (0.86 + 0.16 * depth) * CROWD, colW = 13.5 * s;
    // the step: a concrete riser with a lit edge
    const st = g.createLinearGradient(0, y - 2, 0, y + 6);
    st.addColorStop(0, night ? '#7d8190' : '#c3c8d0'); st.addColorStop(1, night ? '#3e4250' : '#7c828e');
    g.fillStyle = st; g.fillRect(0, y - 2, W, 8);
    // the seats: Saltiz red bucket seats, the empty ones showing
    for (let x = 6 + (ri % 2) * colW * 0.5; x < W; x += colW) {
      if (aisles.some((a) => Math.abs(x - a) < 22)) continue;
      const sg = g.createLinearGradient(0, y - 9 * s, 0, y + 2);
      sg.addColorStop(0, night ? '#c22a3a' : '#ef3b4c'); sg.addColorStop(1, night ? '#6a0f1a' : '#9b1424');
      g.fillStyle = sg; g.beginPath(); g.roundRect(x - colW * 0.38, y - 9 * s, colW * 0.76, 9 * s + 2, 2.2 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x - colW * 0.3, y - 8.3 * s, colW * 0.6, 1.1 * s);
    }
    for (let x = 6 + (ri % 2) * colW * 0.5; x < W; x += colW) {
      if (aisles.some((a) => Math.abs(x - a) < 22)) continue;
      if (r() < (night ? 0.3 : 0.1)) continue;            // the odd empty seat (more at night)
      const look = Math.max(-1, Math.min(1, (W / 2 - x) / (W * 0.35))) * 0.7 + (r() - 0.5) * 0.6;
      fan(g, x + (r() - 0.5) * 3, y + (r() - 0.5) * 1.5, s * (0.94 + r() * 0.12), r, look, night);
    }
    // the cool haze of distance over the back rows
    if (depth < 1) { g.fillStyle = night ? `rgba(14,20,50,${0.22 * (1 - depth)})` : `rgba(150,180,215,${0.16 * (1 - depth)})`; g.fillRect(0, y - 20 * CROWD, W, 24 * CROWD); }
  });
  // phones lit up in the night crowd
  if (night) {
    for (let i = 0; i < W / 26; i++) {
      const px = r() * W, py = top + 14 + r() * (bot - top - 18);
      if (aisles.some((a) => Math.abs(px - a) < 22)) continue;
      const pg = g.createRadialGradient(px, py, 0, px, py, 5);
      pg.addColorStop(0, 'rgba(255,255,255,0.95)'); pg.addColorStop(0.3, 'rgba(220,235,255,0.5)'); pg.addColorStop(1, 'rgba(220,235,255,0)');
      g.fillStyle = pg; g.fillRect(px - 5, py - 5, 10, 10);
    }
  }
  // the aisles: concrete stairs with yellow step edges and a handrail
  for (const a of aisles) {
    const ag = g.createLinearGradient(a - 18, 0, a + 18, 0);
    ag.addColorStop(0, night ? '#3a4050' : '#a3a9b3'); ag.addColorStop(0.5, night ? '#5a6274' : '#dfe3e9'); ag.addColorStop(1, night ? '#3a4050' : '#a3a9b3');
    g.fillStyle = ag; g.fillRect(a - 18, top, 36, bot - top);
    for (let y = top + 5; y < bot; y += 8.25) {
      g.fillStyle = night ? '#262b38' : '#878e9a'; g.fillRect(a - 18, y + 1.6, 36, 2.2);
      g.fillStyle = night ? '#c9a63a' : '#ffcc2e'; g.fillRect(a - 18, y, 36, 1.3);
    }
    g.fillStyle = '#00000038'; g.fillRect(a - 0.2, top, 3, bot - top);
    const hr = g.createLinearGradient(a - 1.4, 0, a + 1.4, 0);
    hr.addColorStop(0, '#ffffff'); hr.addColorStop(1, '#9aa3b0');
    g.fillStyle = hr; g.fillRect(a - 1.4, top, 2.8, bot - top);
  }
  // the shade at the top of the tier, under whatever overhangs it
  const sh = g.createLinearGradient(0, top, 0, top + 34);
  sh.addColorStop(0, 'rgba(0,0,12,0.55)'); sh.addColorStop(1, 'rgba(0,0,12,0)');
  g.fillStyle = sh; g.fillRect(0, top, W, 34);
}

function stadium(night, seed) {
  return (g, s) => {
    // placed off HS's screen (M4 30.2 s): the roof ~22% down it, the banner strip ~40%, with the
    // pitch filling the phone's width (game.js resize) — which crops the world above y ≈ 33
    const W = s.W, roofTop = s.gy * 0.215, roofBot = roofTop + 16;
    const midA = s.gy * 0.49, midB = midA + 17, bot = s.crowdBot + 8;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    sky(g, W, 0, roofTop, night);
    mast(g, W * 0.1, 8, roofTop + 4, night);
    mast(g, W * 0.9, 8, roofTop + 4, night);
    const aisles = [W * 0.08, W * 0.5, W * 0.92];
    tier(g, W, roofBot, midA, seed, aisles, night);
    tier(g, W, midB, bot, seed + 11, aisles, night);
    // the roof: a steel fascia with a Saltiz-red stripe, its underside in shadow, and a row of
    // small lamps along it
    const rf = g.createLinearGradient(0, roofTop - 4, 0, roofBot);
    rf.addColorStop(0, night ? '#4a5268' : '#ffffff'); rf.addColorStop(0.35, night ? '#2a3044' : '#e3e8ee');
    rf.addColorStop(0.7, night ? '#1b2030' : '#aeb7c3'); rf.addColorStop(1, night ? '#0d1018' : '#6f7987');
    g.fillStyle = rf; g.fillRect(0, roofTop - 4, W, roofBot - roofTop + 4);
    g.fillStyle = night ? '#a3122a' : '#e11d3a'; g.fillRect(0, roofTop + 3.5, W, 3.2);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, roofTop + 3.5, W, 0.8);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, roofTop - 4, W, 1);
    for (let x = 14; x < W; x += 28) {
      const lg = g.createRadialGradient(x, roofBot - 2.5, 0, x, roofBot - 2.5, night ? 7 : 3.5);
      lg.addColorStop(0, '#fffbe8'); lg.addColorStop(1, 'rgba(255,248,220,0)');
      g.fillStyle = lg; g.fillRect(x - 7, roofBot - 9.5, 14, 14);
    }
    // the banner strip between the tiers: glossy fabric with a sheen and a sharp shadow under it
    for (let i = 0; i < 6; i++) {
      const bx = i * W / 6 + 3, bw = W / 6 - 6, c = BANNER[(i + seed) % BANNER.length];
      g.fillStyle = c; g.fillRect(bx, midA, bw, midB - midA);
      const bg = g.createLinearGradient(0, midA, 0, midB);
      bg.addColorStop(0, 'rgba(255,255,255,0.45)'); bg.addColorStop(0.4, 'rgba(255,255,255,0.06)'); bg.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = bg; g.fillRect(bx, midA, bw, midB - midA);
      g.fillStyle = 'rgba(255,255,255,0.2)';
      for (let k = bx + 8; k < bx + bw - 6; k += 14) { g.beginPath(); g.moveTo(k, midB); g.lineTo(k + 6, midA); g.lineTo(k + 10, midA); g.lineTo(k + 4, midB); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.8; g.strokeRect(bx + 0.4, midA + 0.4, bw - 0.8, midB - midA - 0.8);
    }
    const bsh = g.createLinearGradient(0, midB, 0, midB + 8);
    bsh.addColorStop(0, 'rgba(0,0,0,0.45)'); bsh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bsh; g.fillRect(0, midB, W, 8);
    // the tunnel mouth at the top of the middle aisle (HS: a dark doorway with a white frame)
    const tf = g.createLinearGradient(0, roofBot, 0, roofBot + 30);
    tf.addColorStop(0, '#ffffff'); tf.addColorStop(1, '#c9ced6');
    g.fillStyle = tf; g.fillRect(W * 0.5 - 30, roofBot, 60, 30);
    const ti = g.createLinearGradient(0, roofBot + 4, 0, roofBot + 30);
    ti.addColorStop(0, '#05070c'); ti.addColorStop(1, '#2c3342');
    g.fillStyle = ti; g.fillRect(W * 0.5 - 24, roofBot + 4, 48, 26);
    // the light: at night the masts' beams fall across the stands; by day a soft warm light
    // from the sun's side
    if (night) { beam(g, W * 0.1, 30, W * 0.3, s.gy); beam(g, W * 0.9, 30, W * 0.7, s.gy); }
    else {
      const sl = g.createLinearGradient(W, 0, 0, 0);
      sl.addColorStop(0, 'rgba(255,240,200,0.12)'); sl.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = sl; g.fillRect(0, roofBot, W, bot - roofBot);
    }
  };
}

// ── THE BOARDS AND THE FLOOR ─────────────────────────────────────────────
// HS's hoardings and floor (hs-video/M4 30.2 s): a row of still, different adverts right under
// the stands; the floor starts at their foot and runs forward BEHIND the players' feet, marked in
// perspective. Painted once into the baked stage layer (game.js stageLayer), so the light, the
// shade and the grain are free.
const HS_BOARDS = [
  { bg: ['#2450b8', '#122a6e'], fg: '#ffd23c', txt: 'SALTIZ' },
  { bg: ['#ee3344', '#a1121f'], fg: '#ffffff', txt: 'ראשים' },
  { bg: ['#232831', '#0c0e12'], fg: '#ffb800', txt: 'SALTIZ ★' },
  { bg: ['#ffffff', '#d6d9de'], fg: '#1c3f94', txt: 'ראשים ⚽' },
  { bg: ['#16a35a', '#08643a'], fg: '#ffffff', txt: 'GOAL!' },
  { bg: ['#ff9a1a', '#d46200'], fg: '#1a1000', txt: 'SALTIZ' },
];

// A tile of grain for the floor: a fine scatter of lighter and darker flecks, used as a pattern
// over the floor's colour. Made once.
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const h = c.getContext('2d'), r = rng(42);
  for (let i = 0; i < 1400; i++) {
    const v = r();
    h.fillStyle = v < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.07})` : `rgba(0,30,0,${0.05 + r() * 0.08})`;
    h.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), 1, 1 + Math.floor(r() * 2));
  }
  return (grainTile = c);
}

function ground(stage) {
  return (g, s) => {
    const W = C.W, gy = s.gy, standBot = gy * 0.81, ledTop = gy - 75, ledBot = gy - 40;
    const night = stage.id === 'hs-night';
    // the floor runs down past the world into the bleed under the controls
    const H = g.canvas.height / (g.getTransform().d || 1);
    // the wall under the stands
    const wg = g.createLinearGradient(0, standBot - 2, 0, ledTop);
    wg.addColorStop(0, '#0a0d14'); wg.addColorStop(1, stage.wall);
    g.fillStyle = wg; g.fillRect(0, standBot - 2, W, ledTop - standBot + 2);
    // the boards: glossy panels in a dark frame, each with a light sheen along the top and a
    // reflection band, the text with a drop shadow
    const n = 6, bw = (W - C.GOAL_W * 2) / n, h = ledBot - ledTop;
    g.fillStyle = '#0b0d12'; g.fillRect(0, ledTop - 2, W, h + 4);
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'ltr';   // the page is RTL: '!GOAL'
    g.font = `italic 900 ${Math.round(h * 0.56)}px "Arial Black", Arial, sans-serif`;
    for (let i = 0; i < n; i++) {
      const b = HS_BOARDS[i % HS_BOARDS.length], x = C.GOAL_W + i * bw;
      const gr = g.createLinearGradient(0, ledTop, 0, ledBot);
      gr.addColorStop(0, b.bg[0]); gr.addColorStop(1, b.bg[1]);
      g.fillStyle = gr; g.fillRect(x + 1.5, ledTop, bw - 3, h);
      const gl = g.createLinearGradient(0, ledTop, 0, ledTop + h * 0.5);
      gl.addColorStop(0, 'rgba(255,255,255,0.4)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillRect(x + 1.5, ledTop, bw - 3, h * 0.5);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(b.txt, x + bw / 2 + 1.2, ledTop + h * 0.54 + 1.4);
      g.fillStyle = b.fg; g.fillText(b.txt, x + bw / 2, ledTop + h * 0.54);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath();
      g.moveTo(x + bw * 0.1, ledBot); g.lineTo(x + bw * 0.35, ledTop); g.lineTo(x + bw * 0.5, ledTop); g.lineTo(x + bw * 0.25, ledBot); g.fill();
    }
    // under the goals the boards carry on plain
    for (const x0 of [0, W - C.GOAL_W]) {
      const pg = g.createLinearGradient(0, ledTop, 0, ledBot);
      pg.addColorStop(0, '#3a414e'); pg.addColorStop(1, '#1c2028');
      g.fillStyle = pg; g.fillRect(x0, ledTop, C.GOAL_W, h);
    }
    g.restore();

    // the floor
    const top = ledBot, fh = H - top;
    if (stage.floor === 'wood') {
      // a polished court: deep orange planks, lighter far off, with a gloss reflecting the lights
      const gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, '#e2a456'); gr.addColorStop(0.5, '#cf8a3c'); gr.addColorStop(1, '#b8722c');
      g.fillStyle = gr; g.fillRect(0, top, W, fh);
      const r = rng(11);
      for (let y = top + 5, k = 0; y < H; y += 9 + k * 1.1, k++) {
        g.fillStyle = 'rgba(110,55,15,0.28)'; g.fillRect(0, y, W, 1);
        // staggered plank ends, a touch lighter or darker each
        for (let x = r() * 120; x < W; x += 90 + r() * 110) {
          g.fillStyle = 'rgba(110,55,15,0.3)'; g.fillRect(x, y + 1, 1, 9 + k * 1.1);
          g.fillStyle = r() < 0.5 ? 'rgba(255,220,170,0.08)' : 'rgba(90,40,10,0.08)'; g.fillRect(x + 1, y + 1, 90, 9 + k * 1.1 - 1);
        }
      }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const lx of [W * 0.25, W * 0.75]) {
        const rg = g.createRadialGradient(lx, top + fh * 0.35, 4, lx, top + fh * 0.35, 200);
        rg.addColorStop(0, 'rgba(255,235,200,0.28)'); rg.addColorStop(1, 'rgba(255,235,200,0)');
        g.save(); g.translate(lx, top + fh * 0.35); g.scale(1, 0.25); g.translate(-lx, -(top + fh * 0.35));
        g.fillStyle = rg; g.fillRect(lx - 200, top + fh * 0.35 - 200, 400, 400); g.restore();
      }
      g.restore();
    } else {
      // grass: lit and lighter towards the back, deeper in front; mown stripes fanned for
      // perspective, each stripe shaded; a fine grain over it all
      const gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, stage.grass[2]); gr.addColorStop(0.45, stage.grass[1]); gr.addColorStop(1, stage.grass[0]);
      g.fillStyle = gr; g.fillRect(0, top, W, fh);
      g.fillStyle = 'rgba(255,255,255,0.075)';
      const k = 10;
      for (let i = -k; i <= k; i += 2) {
        const xb = W / 2 + i * 50, xf = W / 2 + i * 70;
        g.beginPath(); g.moveTo(xb, top); g.lineTo(xb + 50, top); g.lineTo(xf + 70, H); g.lineTo(xf, H); g.fill();
      }
      g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, top, W, fh);
      // the light pool: floodlit middle at night, sunlit by day
      g.save(); g.globalCompositeOperation = night ? 'lighter' : 'source-over';
      const cy = top + fh * 0.3, rg = g.createRadialGradient(W / 2, cy, 10, W / 2, cy, W * 0.55);
      rg.addColorStop(0, night ? 'rgba(220,255,230,0.16)' : 'rgba(255,255,220,0.1)'); rg.addColorStop(1, 'rgba(255,255,220,0)');
      g.translate(W / 2, cy); g.scale(1, 0.35); g.translate(-W / 2, -cy);
      g.fillStyle = rg; g.fillRect(0, cy - W * 0.55, W, W * 1.1);
      g.restore();
    }
    // the boards' shadow on the floor, and a darker edge at the very front
    const sh = g.createLinearGradient(0, top, 0, top + 14);
    sh.addColorStop(0, 'rgba(0,0,0,0.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, top, W, 14);
    const fv = g.createLinearGradient(0, H - 90, 0, H);
    fv.addColorStop(0, 'rgba(0,0,0,0)'); fv.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = fv; g.fillRect(0, H - 90, W, 90);

    // THE MARKINGS, white, in perspective — HS's own, measured on the court (M4 29.98 and 31.0 s,
    // 2556 x 1180, world px from the feet line gy and the wall): a far touchline 21.5 behind the
    // feet and a near one 29 in front, the halfway line between them, a centre circle 120 x 10.5
    // around the feet line, and at each end a goal box and a penalty box whose sides slant OUT
    // towards the wall as they come forward, the side touchline doing the same behind the goal.
    // (on HS's court the lines are a faint cream over the wood)
    const back = gy - 21.5, front = gy + 29;
    g.beginPath();
    g.moveTo(0, back); g.lineTo(W, back);                                      // far touchline
    g.moveTo(0, front); g.lineTo(W, front);                                    // near touchline
    g.moveTo(W / 2, back); g.lineTo(W / 2, front);                             // halfway
    g.moveTo(W / 2 + 120, gy + 2);
    g.ellipse(W / 2, gy + 2, 120, 10.5, 0, 0, TAU);                            // the centre circle
    for (const side of [1, -1]) {
      const X = (x) => side > 0 ? x : W - x;
      g.moveTo(X(10), front); g.lineTo(X(77), back);                           // side touchline
      g.moveTo(X(0), gy - 14); g.lineTo(X(170), gy - 14);                      // penalty box
      g.lineTo(X(142), gy + 18); g.lineTo(X(0), gy + 18);
      g.moveTo(X(0), gy - 6.5); g.lineTo(X(102), gy - 6.5);                    // goal box
      g.lineTo(X(86), gy + 9.5); g.lineTo(X(0), gy + 9.5);
      g.moveTo(X(157), gy - 5.5);
      g.ellipse(X(157), gy + 2.5, 23, 8, 0, -Math.PI / 2, Math.PI / 2, side < 0);
    }
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,40,0,0.18)'; g.lineWidth = 4; g.stroke();          // a soft edge, painted into the grass
    g.strokeStyle = stage.floor === 'wood' ? 'rgba(255,240,215,0.6)' : 'rgba(255,255,255,0.9)'; g.lineWidth = 2.6; g.stroke();
    g.fillStyle = stage.floor === 'wood' ? 'rgba(255,240,215,0.7)' : '#ffffff';
    g.beginPath(); g.ellipse(W / 2, gy + 2, 4, 1.6, 0, 0, TAU); g.fill();       // the centre spot
  };
}

// The rotation. `floor` picks the floor; `grass` is [front, middle, back] (front is also the colour
// game.js runs on under the controls); `sky` the colour carried on above the stage's art.
const STAGE_DEFS = [
  { id: 'hs-day', name: 'אצטדיון', hs: true, static: true, floor: 'grass', sky: '#0f7fe6',
    grass: ['#3f9a2c', '#53b03a', '#6cc04c'], wall: '#27313f', seed: 3, night: false },
  { id: 'hs-night', name: 'אצטדיון בלילה', hs: true, static: true, floor: 'grass', sky: '#02061c',
    grass: ['#1f7f4a', '#2b9a5c', '#37ad6c'], wall: '#161b26', seed: 5, night: true },
  { id: 'hs-arena', name: 'אולם', hs: true, static: true, floor: 'wood', sky: '#0f7fe6',
    grass: ['#b8722c', '#cf8a3c', '#e2a456'], wall: '#27313f', seed: 9, night: false },
];
export const HS_STAGES = STAGE_DEFS.map(({ seed, night, ...st }) => {
  const stage = { ...st, draw: stadium(night, seed) };
  stage.ground = ground(stage);
  return stage;
});
