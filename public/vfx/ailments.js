// WHAT A POWER SHOT LEAVES ON THE PLAYER IT HIT — one plain shape over the head, nothing more.
//
// Drawn on the canvas ABOVE the DOM heads (game.js's net layer), because each sits on a face.
// The stars are filmed (docs/HS-POWER-SHOTS.md §4: three gold stars orbiting a flat ellipse over
// the crown, M4 80.85 s, M3 74.1 s). The other five are not in our footage; each is the single
// shape the brief names for it — `???` for reversed controls, an ice block, sparks, flames, a
// missing head — with no particles and no extra motion.
//
// draw(g, p, s): s = { t, hx, hy (head centre on screen), r (head radius), fy (feet line) }.

import { drawStars, headPath, blit, auraTex, bolts, boltBlit, rng } from './fx-kit.js';

const TAU = Math.PI * 2;

function star5(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

export const AILMENT_VFX = {
  // §4: three gold stars on a flat orbit over the crown.
  stars: {
    draw(g, p, s) { drawStars(g, s.hx, s.hy - s.r * 1.12, s.r, s.t); },
  },
  // Thrown by the Grab (§3 M3 75.0–75.5 s): coming back down inside a blue whirlwind — four flat
  // light-blue rings stacked round him from the feet to over the head, spinning. Only on the way
  // down (on the way up he is a blur off the top of the screen).
  thrown: {
    draw(g, p, s) {
      if (p.vy < -500) return;
      g.save(); g.lineCap = 'round';
      const top = s.hy - s.r * 1.6, bot = s.fy + 4, n = 4;
      for (let i = 0; i < n; i++) {
        const y = top + (bot - top) * (i / (n - 1)), rx = s.r * (1.35 + 0.35 * (i % 2)), ry = s.r * 0.28;
        const a0 = s.t * 14 + i * 1.9;
        g.globalAlpha = 0.45; g.strokeStyle = '#1f5cff'; g.lineWidth = 7;
        g.beginPath(); g.ellipse(s.hx, y, rx, ry, 0, a0, a0 + 4.4); g.stroke();
        g.globalAlpha = 0.9; g.strokeStyle = '#9fdcff'; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(s.hx, y, rx, ry, 0, a0 + 0.3, a0 + 3.6); g.stroke();
      }
      g.restore();
    },
  },
  // Caught in Nigeria's tornado (wiki: "they fly and spin in the air"): a small sandy whirlwind
  // spinning round him for the flight (game.js spins his head); the stars take over on landing.
  twister: {
    draw(g, p, s) {
      g.save(); g.lineCap = 'round';
      const top = s.hy - s.r * 1.5, bot = s.fy + 6, n = 5;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1), y = bot + (top - bot) * f, rx = s.r * (0.7 + 0.9 * f), ry = 3 + rx * 0.22;
        const a0 = s.t * 16 + i * 1.4;
        g.globalAlpha = 0.5; g.strokeStyle = '#8a7654'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(s.hx, y, rx, ry, 0, a0 + 3.3, a0 + 5.6); g.stroke();
        g.globalAlpha = 0.95; g.strokeStyle = i % 2 ? '#f4ecd8' : '#dccfae'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(s.hx, y, rx, ry, 0, a0, a0 + 2.4); g.stroke();
      }
      g.restore();
    },
  },
  // Frozen in Russia's block of ice (wiki: "frozen in a block of ice"): a translucent blue cube
  // round the head and body, the head showing through it, a bevel, glints, a crack, frost at the foot.
  iced: {
    draw(g, p, s) {
      const w = s.r * 1.3, top = s.hy - s.r * 1.25, bot = s.fy + 3, x0 = s.hx - w, x1 = s.hx + w;
      g.save(); g.lineJoin = 'round';
      const ig = g.createLinearGradient(x0, top, x1, bot);
      ig.addColorStop(0, 'rgba(225,250,255,0.62)'); ig.addColorStop(0.5, 'rgba(150,215,245,0.45)'); ig.addColorStop(1, 'rgba(90,170,225,0.6)');
      g.fillStyle = ig;
      g.beginPath(); g.roundRect ? g.roundRect(x0, top, w * 2, bot - top, 6) : g.rect(x0, top, w * 2, bot - top); g.fill();
      g.strokeStyle = '#e9fbff'; g.lineWidth = 2.5; g.stroke();
      g.strokeStyle = '#3f8fc4'; g.lineWidth = 1; g.stroke();
      // the bevel: a lighter top face and a darker side face
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.moveTo(x0 + 3, top + 3); g.lineTo(x1 - 3, top + 3); g.lineTo(x1 - 10, top + 11); g.lineTo(x0 + 10, top + 11); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,110,170,0.25)';
      g.beginPath(); g.moveTo(x1 - 3, top + 3); g.lineTo(x1 - 3, bot - 3); g.lineTo(x1 - 10, bot - 10); g.lineTo(x1 - 10, top + 11); g.closePath(); g.fill();
      // glints and cracks
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0 + 7, top + 18); g.lineTo(x0 + 7, top + 18 + s.r * 0.9); g.moveTo(x0 + 12, top + 16); g.lineTo(x0 + 12, top + 26); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x1 - 14, bot - 6); g.lineTo(x1 - 22, bot - 18); g.lineTo(x1 - 18, bot - 26); g.lineTo(x1 - 28, bot - 36); g.stroke();
      // frost at the foot
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 6; i++) { const fx = x0 + 4 + i * ((w * 2 - 8) / 5); g.beginPath(); g.arc(fx, bot - 1, 3 + (i % 2) * 2, Math.PI, TAU); g.fill(); }
      g.restore();
    },
  },
  // Reversed controls: ??? over the head.
  reverse: {
    draw(g, p, s) {
      g.save();
      g.font = `900 ${Math.round(s.r * 0.9)}px -apple-system, Arial`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const y = s.hy - s.r - 14;
      g.lineWidth = 5; g.strokeStyle = '#2a0636'; g.strokeText('???', s.hx, y);
      g.fillStyle = '#f07cff'; g.fillText('???', s.hx, y);
      g.restore();
    },
  },
  // Frozen: turned into a snowman (wiki, Switzerland's Snowman Shot: "you'll also get turned into a
  // snowman") — a big snowball for the body, a smaller one over the head, coal eyes, a carrot.
  freeze: {
    draw(g, p, s) {
      const R = s.r, by = s.fy - R * 0.95, hy = s.hy - R * 0.1, d = p.side || 1;
      g.save(); g.lineWidth = 2; g.strokeStyle = '#8fb4d8';
      for (const [y, rr] of [[by, R * 1.15], [hy, R * 1.02]]) {
        const sg = g.createRadialGradient(s.hx - rr * 0.35, y - rr * 0.35, rr * 0.1, s.hx, y, rr);
        sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#d4e6f7');
        g.fillStyle = sg; g.beginPath(); g.arc(s.hx, y, rr, 0, TAU); g.fill(); g.stroke();
      }
      g.fillStyle = '#1b1f2a';
      for (const e of [-0.35, 0.35]) { g.beginPath(); g.arc(s.hx + e * R, hy - R * 0.2, R * 0.1, 0, TAU); g.fill(); }
      g.fillStyle = '#ff8a1c';
      g.beginPath(); g.moveTo(s.hx, hy); g.lineTo(s.hx + d * R * 0.7, hy + R * 0.08); g.lineTo(s.hx, hy + R * 0.18); g.closePath(); g.fill();
      for (const k of [-0.3, 0.1]) { g.fillStyle = '#1b1f2a'; g.beginPath(); g.arc(s.hx, by + k * R, R * 0.09, 0, TAU); g.fill(); }
      g.restore();
    },
  },
  // Shocked (wiki, Cameroon: "the opponent turns blue and is surrounded in electricity"): a blue
  // wash over the head and body, sparks round them.
  shock: {
    // Painted (fx-kit.js): the head and body washed electric blue in their own outline, a cold
    // blue glow hugging them, and blue-white bolts crawling over them, re-picked at 20 Hz.
    draw(g, p, s) {
      const fr = Math.floor(s.t * 20), R = rng(fr * 613 + (p.index || 0) * 71);
      const bh = Math.max(0, s.fy - (s.hy + s.r * 0.85));
      g.save();
      g.globalAlpha = 0.42 + 0.1 * R(); g.fillStyle = '#2f7dff';
      headPath(g, s.hx, s.hy, s.r); g.fill();
      if (bh > 2) { g.beginPath(); g.rect(s.hx - s.r * 0.58, s.hy + s.r * 0.85, s.r * 1.16, bh); g.fill(); }
      g.restore();
      blit(g, auraTex('#3f9bff'), s.hx, s.hy, s.r * 4.8, s.r * 4.8, 0, 0.75 + 0.25 * R(), true);
      const bk = bolts('#7cc4ff', '#ffffff', 8, 33);
      for (let i = 0; i < 4; i++) {
        const a = R() * TAU, a2 = a + 0.9 + R() * 1.4, r1 = s.r * (1.05 + R() * 0.2), r2 = s.r * (1.0 + R() * 0.3);
        const lowY = i === 3 ? s.fy - bh * 0.5 : 0;
        const x1 = s.hx + Math.cos(a) * r1 * 1.1, y1 = (lowY || s.hy) + Math.sin(a) * r1 * (lowY ? 0.4 : 1);
        const x2 = s.hx + Math.cos(a2) * r2 * 1.1, y2 = (lowY || s.hy) + Math.sin(a2) * r2 * (lowY ? 0.4 : 1);
        boltBlit(g, bk, x1, y1, x2, y2, 20 + R() * 8, 0.95, R());
      }
    },
  },
  // Burning: flames on the crown.
  burn: {
    draw(g, p, s) {
      g.save();
      for (let i = 0; i < 3; i++) {
        const f = i - 1, bx = s.hx + f * s.r * 0.55, by = s.hy - s.r * 0.6 + Math.abs(f) * 6;
        const h = s.r * (0.85 + 0.2 * Math.sin(s.t * 14 + i * 2.1)) * (f ? 0.75 : 1);
        flame(g, bx, by, s.r * 0.3, h, '#ff5a14'); flame(g, bx, by, s.r * 0.17, h * 0.6, '#ffd166');
      }
      g.restore();
    },
  },
  // Beheaded: the head is gone (game.js hides it); a dashed ring where it was.
  beheaded: {
    draw(g, p, s) {
      g.save();
      g.globalAlpha = 0.7; g.strokeStyle = '#d9ccff'; g.lineWidth = 2; g.setLineDash([5, 5]);
      g.beginPath(); g.arc(s.hx, s.hy, s.r, 0, TAU); g.stroke();
      g.restore();
    },
  },
};

function zig(g, x1, y1, x2, y2, seed, amp) {
  g.beginPath(); g.moveTo(x1, y1);
  for (let i = 1; i < 4; i++) {
    const f = i / 4, j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453, o = ((j - Math.floor(j)) - 0.5) * 2 * amp;
    g.lineTo(x1 + (x2 - x1) * f + o, y1 + (y2 - y1) * f - o * 0.5);
  }
  g.lineTo(x2, y2); g.stroke();
}
function flame(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.beginPath(); g.moveTo(x - w, y);
  g.quadraticCurveTo(x - w * 1.1, y - h * 0.55, x, y - h);
  g.quadraticCurveTo(x + w * 1.1, y - h * 0.55, x + w, y);
  g.quadraticCurveTo(x, y + w * 0.6, x - w, y);
  g.fill();
}
