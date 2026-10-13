// ICE POP WALL, drawn — the Wall Builder's power (what it does: shared/champion-powers/stage-05.js).
// The champion is a red-orange ice pop with a bite out of it; the card, Paz in a straw fedora and a
// lei bursting out of an ice pool, ice pops flying.
//
//   the cut-in   frost bursting out round where the ball will leave, three little ice pops spinning
//                in it — while, back at his own goal, the fence starts to grow (its zone, below)
//   the flight   the ball trailing cold mist, snowflake sparkles and a ribbon of ice-pop colours
//   the fence    (a zone) three giant ice pops sprouting out of the grass in front of his goal on their
//                sticks, frosted, a bite out of one, dripping; a ball that hits them throws ice chips;
//                at the end they melt down into a puddle
//   a hit        brain freeze: an ice block round him, then a shiver (ailments.js `brainfreeze`)
//   armed        snowflakes circling the head
// Client only: Math.random is fine here.

import { TAU, ball, hash, puff, rrect } from './common.js';
import { blit, glow, tex } from '../fx-kit.js';

const POPS = [
  { body: '#ff4a4a', dark: '#b81e2a', light: '#ff9a9a' },      // strawberry (the champion's red)
  { body: '#ff9a3d', dark: '#c4601a', light: '#ffc890' },      // orange
  { body: '#ffd84a', dark: '#c49a12', light: '#fff0a0' },      // lemon
];
const FROST = '#dff6ff';

// a six-armed snowflake, painted once into a texture and blitted (one draw call, not thirty)
function flakeTex() {
  return tex('icepop-flake', 48, 48, (g, w) => {
    const r = w * 0.42, c = w / 2;
    g.translate(c, c);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0);
      g.moveTo(r * 0.55, 0); g.lineTo(r * 0.8, -r * 0.25); g.moveTo(r * 0.55, 0); g.lineTo(r * 0.8, r * 0.25);
      g.moveTo(-r * 0.55, 0); g.lineTo(-r * 0.8, -r * 0.25); g.moveTo(-r * 0.55, 0); g.lineTo(-r * 0.8, r * 0.25);
      g.stroke();
    }
  });
}
export function snowflake(g, x, y, r, rot, a = 1) {
  blit(g, flakeTex(), x, y, r * 2.3, r * 2.3, rot, a, false);
}

// one giant ice pop standing on its stick in the grass: bottom of the pop at `top + h`, `w` wide,
// `bite` 1 to take a bite out of its top corner, `melt` 0..1 shrinking it into a drip
export function icePop(g, cx, gy, w, h, col, bite, melt, now, i) {
  const stick = 18, ph = h * (1 - 0.75 * melt);
  const top = gy - stick - ph;
  g.save();
  // a white outline under everything, so the pop reads against the stands
  g.fillStyle = 'rgba(255,255,255,0.85)';
  rrect(g, cx - w / 2 - 2.5, gy - stick - ph - 2.5, w + 5, ph + 5, w * 0.5); g.fill();
  // the stick, in the grass
  g.fillStyle = '#e8c890'; g.strokeStyle = '#a07a40'; g.lineWidth = 1.2;
  rrect(g, cx - 4, gy - stick - 4, 8, stick + 6, 3); g.fill(); g.stroke();
  // the bite out of its top corner: everything of the pop below is clipped round it
  const bitten = bite && melt < 0.5;
  if (bitten) { g.save(); g.beginPath(); g.rect(cx - w, top - 12, w * 2, ph + 24); g.arc(cx + w * 0.5, top + w * 0.3, w * 0.34, 0, TAU); g.clip('evenodd'); }
  // the pop: a rounded slab, lit from the left, its colour darker down the right
  const lg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  lg.addColorStop(0, col.light); lg.addColorStop(0.35, col.body); lg.addColorStop(1, col.dark);
  g.fillStyle = lg; g.strokeStyle = col.dark; g.lineWidth = 2;
  rrect(g, cx - w / 2, top, w, ph, w * 0.45); g.fill(); g.stroke();
  // frost: a pale sheen down the lit side and sparkles twinkling on it
  g.fillStyle = 'rgba(255,255,255,0.42)';
  rrect(g, cx - w * 0.36, top + ph * 0.1, w * 0.16, ph * 0.72, w * 0.08); g.fill();
  for (let k = 0; k < 3; k++) {
    const f = (now * 1.2 + k * 0.33 + i * 0.21) % 1;
    g.globalAlpha = Math.sin(f * Math.PI);
    snowflake(g, cx + (hash(k, i) - 0.5) * w * 0.7, top + ph * (0.15 + 0.6 * hash(k + 5, i)), 3, f * 2);
  }
  g.globalAlpha = 1;
  if (bitten) {
    g.restore();
    // the bite's edge, a darker scallop
    g.strokeStyle = col.dark; g.lineWidth = 2;
    g.beginPath(); g.arc(cx + w * 0.5, top + w * 0.3, w * 0.34, Math.PI * 0.55, Math.PI * 1.5); g.stroke();
  }
  // drips running down and off the bottom edge
  g.fillStyle = col.body;
  for (let k = 0; k < 2; k++) {
    const f = (now * (0.7 + 0.2 * k) + i * 0.4 + k * 0.5) % 1, dx = cx + (k ? 0.25 : -0.2) * w;
    g.globalAlpha = 1 - f;
    g.beginPath(); g.ellipse(dx, top + ph + f * (stick + 6), 2.2, 3.2, 0, 0, TAU); g.fill();
  }
  g.restore();
}

// ice chips off the fence (a ball hit it), or off a frozen head
function chips(x, y, dir) {
  const bits = [];
  for (let i = 0; i < 14; i++) { const a = (dir > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 2.4, v = 160 + Math.random() * 380; bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, s: 2.5 + Math.random() * 4, r: Math.random() * TAU }); }
  return {
    t: 0, life: 0.6,
    step(dt) { for (const b of bits) { b.vy += 1200 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * 9; } },
    draw(g, t) {
      const f = t / 0.6;
      if (t < 0.2) { blit(g, glow('#bfefff', 0.4), x, y, 110 * (1 - t / 0.2) + 30, 110 * (1 - t / 0.2) + 30, 0, 1 - t / 0.2); }
      g.save(); g.globalAlpha = 1 - f * f;
      for (const b of bits) {
        g.fillStyle = 'rgba(220,246,255,0.95)'; g.strokeStyle = '#7ac8e8'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(b.x + Math.cos(b.r) * b.s, b.y + Math.sin(b.r) * b.s); g.lineTo(b.x + Math.cos(b.r + 2.2) * b.s, b.y + Math.sin(b.r + 2.2) * b.s); g.lineTo(b.x + Math.cos(b.r + 4.1) * b.s, b.y + Math.sin(b.r + 4.1) * b.s); g.closePath(); g.fill(); g.stroke();
      }
      g.restore();
    },
  };
}

// THE SET PIECE (cutBack): a giant red ice pop bursts up out of the turf behind the shooter in a
// spray of frost, a bite out of it, dripping, snowflakes swirling round — the champion itself.
function popSet(g, s) {
  const { hx, hy, hr, px, py, dir, el, now } = s;
  const k = Math.min(1, el / 0.45), e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 8) : 1;
  const a = Math.min(1, el / 0.1) * (s.out ?? 1);
  g.save(); g.globalAlpha = a;
  blit(g, glow('#cfefff', 0.12), px - dir * hr * 2.4, py - hr * 2.5, hr * 7, hr * 7, 0, 0.7);
  icePop(g, px - dir * hr * 2.4, py, hr * 2.2, Math.max(4, hr * 4.6 * e), POPS[0], true, 0, now, 0);
  icePop(g, px + dir * hr * 2.6, py, hr * 1.4, Math.max(4, hr * 3 * Math.max(0, e - 0.2)), POPS[1], false, 0, now, 1);
  // frost bursting where they came up
  for (let i = 0; i < 5; i++) { const ang = Math.PI + (i / 4) * Math.PI, d = hr * (1 + 2 * k); snowflake(g, px - dir * hr * 2.4 + Math.cos(ang) * d, py + Math.sin(ang) * d * 0.6, hr * 0.35, now * 2 + i, 1 - k * 0.6); }
  for (let i = 0; i < 5; i++) { const ang = now * 1.6 + i * 1.257; snowflake(g, hx + Math.cos(ang) * hr * 3, hy - hr * 0.5 + Math.sin(ang) * hr * 1.6, hr * 0.3, ang, 0.9); }
  g.restore();
}

export default {
  id: 'icepop',
  palette: [POPS[0].body, POPS[1].body, POPS[2].body, FROST],
  cutColor: '#7fdcff',
  cutBack: popSet,

  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, x = s.x, y = s.y, r = s.r, now = s.now || 0;
    const h = s.hist || [];
    // a ribbon of the three flavours streaming behind it
    if (h.length > 2) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = POPS[k].body; g.globalAlpha = 0.9; g.lineWidth = r * 0.5;
        g.beginPath();
        for (let i = 0; i < Math.min(h.length, 14); i++) g.lineTo(h[i].x, h[i].y + (k - 1) * r * 0.42 + Math.sin(i * 0.8 - now * 12 + k) * 2);
        g.stroke();
      }
      g.restore();
    }
    // cold mist and snowflakes shed along the path
    for (let i = 2; i < Math.min(h.length, 16); i += 3) blit(g, glow('#cfefff', 0.1), h[i].x, h[i].y, r * (2.5 + i * 0.25), r * (2 + i * 0.2), 0, 0.5 - i * 0.025);
    for (let i = 0; i < 5; i++) {
      const j = 2 + ((i * 3 + Math.floor(now * 22)) % 12), p = h[Math.min(h.length - 1, j)];
      if (!p) break;
      snowflake(g, p.x + (hash(i, j) - 0.5) * 24, p.y + (hash(i + 4, j) - 0.5) * 24, 3 + hash(i, 2) * 3, now * 3 + i, 1 - j / 14);
    }
    blit(g, glow('#9fe0ff', 0.25), x, y, r * 4, r * 4, 0, 0.6);
    ball(g, s, x, y);
    // a frosting of white on the ball
    g.save(); g.globalAlpha = 0.5; g.fillStyle = FROST;
    g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU); g.fill(); g.restore();
    return true;
  },

  // The fence: three giant ice pops on their sticks in front of his own goal. They grow out of the
  // grass through his cut-in (s.cut), stand WALL s, and melt into a puddle over the last half second.
  zone(g, z, s) {
    if (z.k !== 'fence') return;
    const gy = s.gy, now = s.now, H = z.h;
    const grow = s.cut >= 0 ? Math.min(1, s.cut / 0.9) : Math.min(1, 0.55 + z.t / 0.25);
    const e = grow < 1 ? 1 - Math.pow(1 - grow, 3) * Math.cos(grow * 9) : 1;     // a springy rise: 0 → a little over → 1
    const left = z.life - z.t, melt = Math.max(0, 1 - left / 0.5);
    // cold mist pooling at its foot
    blit(g, glow('#dff6ff', 0.1), s.x0, gy - 6, 120, 34, 0, 0.55 * (1 - melt));
    // the meltwater puddle
    if (melt > 0) { g.save(); g.globalAlpha = 0.6 * melt; g.fillStyle = '#ff9a9a'; g.beginPath(); g.ellipse(s.x0, gy, 26 + 30 * melt, 5, 0, 0, TAU); g.fill(); g.restore(); }
    // back to front: the pops stand in a short staggered row across the goal mouth
    const w = 25, offs = [-22, 0, 22], heights = [0.9, 1, 0.84];
    // a cold glow round the whole fence
    blit(g, glow('#bfefff', 0.15), s.x0, gy - H * 0.55 * e, 130, H * 1.3 * e, 0, 0.5 * (1 - melt));
    for (let i = 0; i < 3; i++) {
      const h = Math.max(0, (H - 18) * heights[i] * e);
      if (h < 3) continue;
      icePop(g, s.x0 + offs[i] * (z.dir < 0 ? 1 : -1), gy, w, h, POPS[i], i === 0, melt, now, i);
    }
    // frost sparkles round the whole fence
    for (let k = 0; k < 4; k++) {
      const f = (now * 0.9 + k * 0.25) % 1;
      snowflake(g, s.x0 + (hash(k, 3) - 0.5) * 60, gy - H * (0.2 + 0.7 * hash(k, 9)) * e, 4, f * 3, Math.sin(f * Math.PI) * (1 - melt));
    }
  },

  // Under the cut-in: a burst of frost round the ball's spot (the giant pop is the set piece, cutBack).
  cutin(g, s) {
    const x = s.fx, y = s.fy, R = s.r, t = s.now || 0;
    const k = Math.max(0, Math.min(1, (s.cut ?? 0.6) / 0.9));
    blit(g, glow('#cfefff', 0.25), x, y, R * 6 * k, R * 6 * k, 0, 0.7 * k);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + t * 0.8; snowflake(g, x + Math.cos(a) * R * 2.4, y + Math.sin(a) * R * 1.8, R * 0.35, t * 2 + i, k); }
  },

  // Armed: snowflakes circling the head, a cold breath of mist.
  armed(g, p, s) {
    const t = s.t, rx = s.r * 1.5, ry = s.r * 0.5, cy = s.hy - s.r * 0.25;
    for (let i = 0; i < 4; i++) { const a = t * 2.4 + i * 1.57; snowflake(g, s.hx + Math.cos(a) * rx, cy + Math.sin(a) * ry, s.r * 0.22, t * 3 + i, 0.95); }
    blit(g, glow('#cfefff', 0.1), s.hx, s.hy, s.r * 3.2, s.r * 2.6, 0, 0.35);
  },

  event(e, at) {
    if (e.type === 'fenceHit' && e.cp === 'icepop') { const d = at(e.x, e.y); return chips(d.x, d.y, e.dir || 1); }
    if (e.type === 'brainFreeze') { const d = at(e.x, e.y); return chips(d.x, d.y, 0); }
    return null;
  },
};
