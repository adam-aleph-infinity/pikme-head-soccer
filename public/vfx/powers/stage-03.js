// SIZZLE LINE, drawn — the Burning Chef's power (what it does: shared/champion-powers/stage-03.js).
// The champion is a flame-grilled burger; the card, Naveh as a many-armed chef at a row of grills.
//
//   the cut-in   grill flames bursting up in a ring round where the ball will leave, sesame seeds
//                spinning in the heat
//   the flight   the ball skimming low with flames licking back off it and sesame seeds flicked out
//   the strip    (a zone) the grill seared into the grass behind it: charred bars glowing orange at
//                their edges, flame tongues dancing up along it, smoke curling off; it cools and fades
//   singed       (ailments.js) the boots smoking, little flames at the heels
//   armed        flames flickering up round the head
// Client only: Math.random is fine here.

import { TAU, flame, hash, streak } from './common.js';
import { blit, glow, smoke } from '../fx-kit.js';

const SESAME = '#f5e6b8';
function seed(g, x, y, rot, a = 1) {
  g.save(); g.globalAlpha = a; g.fillStyle = SESAME; g.strokeStyle = '#b89a5a'; g.lineWidth = 0.8;
  g.beginPath(); g.ellipse(x, y, 3.2, 1.7, rot, 0, TAU); g.fill(); g.stroke(); g.restore();
}

// THE SET PIECE (cutBack): the grill lights up under the shooter — a row of glowing bars on the
// grass and a wall of flames roaring up round him, higher and higher, sesame seeds whirling in it.
function grillSet(g, s) {
  const { hr, px, py, el, now } = s;
  const k = Math.min(1, el / 0.45), e = 1 - Math.pow(1 - k, 2);
  const a = Math.min(1, el / 0.1) * (s.out ?? 1);
  const W = hr * 9;
  g.save(); g.globalAlpha = a;
  blit(g, glow('#ff5a12', 0.15), px, py - hr * 1.5, W * 1.3, hr * 6 * e, 0, 0.8);
  // the bars
  for (let i = -5; i <= 5; i++) {
    const x = px + i * hr * 0.8;
    g.fillStyle = '#1b0f08'; g.fillRect(x - 4, py - 3, 8, 8);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ff7a1a'; g.globalAlpha = a * (0.5 + 0.4 * Math.sin(now * 9 + i)); g.fillRect(x - 4, py - 3, 8, 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
  }
  g.restore();
  // the wall of flames, tallest at the ends, flickering
  for (let i = 0; i < 14; i++) {
    const t = i / 13 - 0.5, x = px + t * W, f = 0.5 + 0.5 * Math.sin(now * 23 + i * 1.9);
    const h = hr * (2.2 + 2.8 * Math.abs(t) * 2 + 1.2 * f) * e;
    g.save(); g.globalAlpha = a; flame(g, x, py + 2, h, hr * 0.8, (hash(i, Math.floor(now * 10)) - 0.5) * hr, f); g.restore();
  }
  for (let i = 0; i < 8; i++) { const ang = now * 3 + i * 0.8, d = hr * (2 + i * 0.3); seed(g, px + Math.cos(ang) * d, py - hr * 2 - Math.sin(ang) * d * 0.6, ang * 2, a); }
}

export default {
  id: 'sizzle',
  palette: ['#ff7a1a', '#ffd34a', '#2a1a10', SESAME],
  cutColor: '#ff5a1a',
  cutBack: grillSet,

  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, x = s.x, y = s.y, r = s.r, now = s.now || 0;
    const h = s.hist || [];
    // the heat round it
    blit(g, glow('#ff7a1a', 0.2), x - dir * r, y, r * 6, r * 3.4, 0, 0.7);
    // a comet of fire streaming back off it…
    streak(g, x, y, dir, 0, r * 10, ['#fff2a0', '#ff9a1a', '#ff3a0a'], r / 11, 1);
    // …and flames licking up off the ball and its wake, flickering, swept back by the speed
    for (let i = 0; i < 6; i++) {
      const p = i === 0 ? { x, y } : h[Math.min(h.length - 1, i * 2)] || { x: x - dir * i * 20, y };
      const k = 0.5 + 0.5 * Math.sin(now * 31 + i * 1.7);
      flame(g, p.x + (hash(i, Math.floor(now * 18)) - 0.5) * 6, p.y + r * 0.5, r * (2.4 - i * 0.3) * (0.8 + 0.3 * k), r * (0.75 - i * 0.08), -dir * r * (1.2 + i * 0.2), k);
    }
    // sesame seeds flicked out behind it, tumbling
    for (let i = 0; i < 5; i++) {
      const j = 2 + ((i * 4 + Math.floor(now * 25)) % 12), p = h[Math.min(h.length - 1, j)];
      if (!p) break;
      seed(g, p.x + (hash(i, j) - 0.5) * 22, p.y - j * 1.4 - hash(i + 3, j) * 10, now * 9 + i, 1 - j / 14);
    }
    return false;                                         // the ball itself, on top
  },

  // The strip: the grill seared into the grass from where it left to where the ball is (or was).
  zone(g, z, s) {
    if (z.k !== 'strip') return;
    const lo = Math.min(s.x0, s.x1), hi = Math.max(s.x0, s.x1), gy = s.gy, now = s.now;
    if (hi - lo < 2) return;
    const left = z.life - z.t, fade = Math.min(1, left / 0.5), cool = Math.min(1, z.t / 0.15);
    g.save();
    // the scorched bed under the bars, and the heat glowing off it
    g.globalAlpha = 0.7 * fade;
    g.fillStyle = '#2a160a';
    g.beginPath(); g.ellipse((lo + hi) / 2, gy - 1, (hi - lo) / 2 + 10, 9, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    const hg = g.createLinearGradient(0, gy - 26, 0, gy + 6);
    hg.addColorStop(0, '#ff5a1200'); hg.addColorStop(0.7, '#ff7a1a'); hg.addColorStop(1, '#ff5a1200');
    g.globalAlpha = (0.35 + 0.1 * Math.sin(now * 7)) * fade; g.fillStyle = hg;
    g.fillRect(lo - 6, gy - 26, hi - lo + 12, 32);
    g.globalCompositeOperation = 'source-over';
    // the bars: slanted charcoal stripes, their edges glowing
    const step = 16;
    for (let x = lo + 6; x < hi - 2; x += step) {
      g.globalAlpha = 0.9 * fade;
      g.fillStyle = '#1b0f08';
      g.beginPath(); g.moveTo(x - 5, gy + 4); g.lineTo(x + 1, gy - 5); g.lineTo(x + 7, gy - 5); g.lineTo(x + 1, gy + 4); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (0.55 + 0.35 * Math.sin(now * 9 + x * 0.3)) * fade;
      g.strokeStyle = '#ff7a1a'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x - 5, gy + 4); g.lineTo(x + 1, gy - 5); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    // the embers' glow along it and flames dancing up out of it
    for (let x = lo + 10, i = 0; x < hi; x += 26, i++) {
      blit(g, glow('#ff5a12', 0.15), x, gy - 4, 46, 22, 0, 0.55 * fade);
      const k = 0.5 + 0.5 * Math.sin(now * 13 + i * 2.1);
      flame(g, x + (hash(i, 5) - 0.5) * 10, gy, (24 + 20 * hash(i, 7)) * fade * cool * (0.7 + 0.5 * k), 9, (hash(i, Math.floor(now * 8)) - 0.5) * 8, k);
    }
    // smoke curling off it
    for (let i = 0; i < 3; i++) {
      const f = (now * 0.8 + i / 3) % 1, x = lo + (hi - lo) * hash(i, Math.floor(now * 0.8 + i / 3));
      blit(g, smoke(i, '#8a8580'), x, gy - 10 - f * 50, 18 + f * 30, 18 + f * 30, f * 2, 0.35 * (1 - f) * fade, false);
    }
  },

  // Under the cut-in: grill flames bursting up round the ball's spot, sesame seeds spinning in them.
  cutin(g, s) {
    const x = s.fx, y = s.fy, R = s.r, t = s.now || 0;
    const k = Math.max(0, Math.min(1, (s.cut ?? 0.6) / 0.8));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.6, fx = x + Math.cos(a) * R * 2.2, fy = y + Math.sin(a) * R * 1.6;
      const f = 0.5 + 0.5 * Math.sin(t * 17 + i * 1.9);
      g.save(); g.translate(fx, fy); g.rotate(a + Math.PI / 2);
      flame(g, 0, 0, R * (1.2 + 1.4 * f) * k, R * 0.45, 0, f);
      g.restore();
    }
    for (let i = 0; i < 6; i++) { const a = -t * 2.4 + i * 1.05, d = R * 1.4; seed(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, a * 2, k); }
  },

  // Armed: flames flickering up round the head.
  armed(g, p, s) {
    const t = s.t;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI, f = 0.5 + 0.5 * Math.sin(t * 19 + i * 2.3);
      flame(g, s.hx + Math.cos(a) * s.r * 1.05, s.hy + Math.sin(a) * s.r * 0.9 + s.r * 0.3, s.r * (0.5 + 0.5 * f), s.r * 0.22, (i - 2.5) * 1.5, f);
    }
  },
};
