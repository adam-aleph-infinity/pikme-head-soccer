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
import { gemPalette, sparkle } from './powers/mythic.js';
import { GEM } from '../../shared/champion-powers/mythic.js';
import { SHIVER } from '../../shared/hs-powers.js';
import { WORM_COL, wormTube } from './powers/stage-02.js';
import { CHOC } from './powers/stage-04.js';
import { snowflake } from './powers/stage-05.js';
import { flame as flameTongue } from './powers/common.js';

// The Mythic Gem's crust: [x off, height, half width, lean] in head radii, tallest first.
// The tall ones stand at his sides and the ones in front stay under the chin, so the face shows.
const GEM_CRUST = [[-1.25, 2.7, 0.4, -0.1], [1.25, 2.5, 0.38, 0.1], [-0.78, 1.55, 0.3, -0.18], [0.82, 1.65, 0.3, 0.2], [-1.75, 1.3, 0.26, -0.3], [1.75, 1.15, 0.26, 0.3], [0.05, 0.42, 0.3, 0], [-0.42, 0.5, 0.22, -0.12], [0.46, 0.38, 0.22, 0.12]];

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
  // Caught in Nigeria's tornado (wiki: "they fly and spin in the air"; Nigeria.gif): he tumbles
  // (game.js spins him) with the gold stars round his head from the catch, in the air and on the
  // grass after — HS's own daze, not a whirlwind of his own.
  twister: {
    draw(g, p, s) { drawStars(g, s.hx, s.hy - s.r * 1.12, s.r, s.t); },
  },
  // Stuck in the Mythic Gem's crust (shared/champion-powers/mythic.js): a cluster of its crystals
  // grown up round him from the grass — two tall ones at his sides to the crown, smaller ones at
  // his feet and shoulders — over a faint shell of its colour, glints twinkling on them. In the
  // colour of the gem that broke on him (s.col); it grows in fast and fades as he breaks out.
  gem: {
    draw(g, p, s) {
      const P = gemPalette(s.col || '#ff4fc8'), r = s.r;
      const age = Number.isFinite(p.ailT) ? Math.max(0, GEM.CRUST - p.ailT) : 0.5;
      const grow = Math.min(1, age / 0.12), out = Number.isFinite(p.ailT) ? Math.min(1, p.ailT / 0.12) : 1;
      const top = s.hy - r * 1.15, bot = s.fy + 3;
      g.save(); g.lineJoin = 'round';
      // the shell
      g.globalAlpha = 0.24 * out;
      const sg = g.createLinearGradient(s.hx - r, top, s.hx + r, bot);
      sg.addColorStop(0, P.pale); sg.addColorStop(1, P.base);
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(s.hx, (top + bot) / 2, r * 1.25, (bot - top) / 2, 0, 0, TAU); g.fill();
      // the crystals: [x off, height, width, lean] in head radii, tallest first
      for (const [dx, hh, w, lean] of GEM_CRUST) {
        const h = hh * r * grow, bx = s.hx + dx * r, W = w * r;
        if (h < 2) continue;
        const tx = bx + lean * h, ty = bot - h;
        g.globalAlpha = 0.82 * out;
        // the lit face and the dark face, a ridge between
        g.fillStyle = P.light;
        g.beginPath(); g.moveTo(bx - W, bot); g.lineTo(bx - W + lean * h * 0.85, bot - h * 0.82); g.lineTo(tx, ty); g.lineTo(bx + lean * h * 0.1, bot); g.closePath(); g.fill();
        g.fillStyle = P.dark;
        g.beginPath(); g.moveTo(bx + lean * h * 0.1, bot); g.lineTo(tx, ty); g.lineTo(bx + W + lean * h * 0.85, bot - h * 0.82); g.lineTo(bx + W, bot); g.closePath(); g.fill();
        g.strokeStyle = P.pale; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(bx + lean * h * 0.1, bot); g.lineTo(tx, ty); g.stroke();
        g.strokeStyle = P.deep; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(bx - W, bot); g.lineTo(bx - W + lean * h * 0.85, bot - h * 0.82); g.lineTo(tx, ty); g.lineTo(bx + W + lean * h * 0.85, bot - h * 0.82); g.lineTo(bx + W, bot); g.stroke();
      }
      // the glints
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const k = (s.t * 2.2 + i * 0.27) % 1;
        g.globalAlpha = Math.sin(k * Math.PI) * out;
        const [dx, hh] = GEM_CRUST[i];
        sparkle(g, s.hx + dx * r, bot - hh * r * grow * 0.8, 3 + 5 * Math.sin(k * Math.PI), k * 2);
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
  // ── the champions' original powers (docs/CHAMPION-POWERS.md) ──
  // COILED (the Worm Tunnel Ambush): brown worms wound round his ankles, one red-eyed head poking out.
  coiled: {
    draw(g, p, s) {
      const r = s.r, fy = s.fy, x = s.hx, t = s.t;
      for (let i = 0; i < 3; i++) {
        const y = fy - 4 - i * 7, rx = r * (0.62 - i * 0.06), a0 = t * 5 + i * 2;
        const pts = [];
        for (let k = 0; k <= 14; k++) { const a = a0 + (k / 14) * TAU * 0.9; pts.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * rx * 0.3 }); }
        wormTube(g, pts, 4.6, t, 0.5);
      }
      const hx = x + r * 0.66, hy = fy - 21 + Math.sin(t * 6) * 1.5;
      g.fillStyle = WORM_COL.mid; g.strokeStyle = '#1b120d'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(hx, hy, 3.6, 3, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = WORM_COL.eye; g.beginPath(); g.arc(hx + 1, hy - 0.6, 1.4, 0, TAU); g.fill();
    },
  },
  // SINGED (stood on the Sizzle Line's grill): the boots smoking, little flames licking the heels.
  singed: {
    draw(g, p, s) {
      const fy = s.fy, x = s.hx, t = s.t;
      for (let i = 0; i < 4; i++) {
        const f = 0.5 + 0.5 * Math.sin(t * 21 + i * 1.7);
        flameTongue(g, x + (i - 1.5) * 7, fy, 8 + 9 * f, 4, (i - 1.5) * 1.2, f);
      }
      g.save();
      for (let i = 0; i < 3; i++) {
        const f = (t * 1.4 + i / 3) % 1;
        g.globalAlpha = 0.45 * (1 - f); g.fillStyle = '#7a7470';
        g.beginPath(); g.arc(x + (i - 1) * 9 + Math.sin(t * 3 + i) * 4, fy - 12 - f * 34, 4 + f * 8, 0, TAU); g.fill();
      }
      g.restore();
    },
  },
  // STICKY (the Choco Burst): chocolate up over his boots, and — coated by a hit — a drip down his
  // head and blobs on his shoulders.
  sticky: {
    draw(g, p, s) {
      const fy = s.fy, x = s.hx, r = s.r, t = s.t;
      const blob = (bx, by, rx, ry) => {
        g.fillStyle = CHOC.mid; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = CHOC.hi; g.beginPath(); g.ellipse(bx - rx * 0.2, by - ry * 0.25, rx * 0.55, ry * 0.45, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,230,200,0.7)'; g.beginPath(); g.ellipse(bx - rx * 0.35, by - ry * 0.45, rx * 0.2, ry * 0.15, -0.3, 0, TAU); g.fill();
      };
      g.save();
      blob(x, fy - 2, r * 0.85, 7);
      blob(x - r * 0.45, fy - 8, 7, 6); blob(x + r * 0.5, fy - 7, 6, 5);
      if (p.ailT > 0.6) {
        // coated: a drip down the head, swelling and stretching
        const k = 0.5 + 0.5 * Math.sin(t * 3);
        blob(x - r * 0.5, s.hy - r * 0.85, r * 0.42, r * 0.22);
        g.fillStyle = CHOC.mid; g.beginPath(); g.ellipse(x - r * 0.62, s.hy - r * 0.5 + k * 4, 3.4, 6 + k * 4, 0, 0, TAU); g.fill();
      }
      g.restore();
    },
  },
  // BRAIN FREEZE (the Ice Pop Wall's hit): an ice block round him while he is frozen stiff, frost
  // creeping over it; then a shiver — snowflakes and shiver lines either side of the head.
  brainfreeze: {
    draw(g, p, s) {
      const r = s.r, x = s.hx, t = s.t, top = s.hy - r * 1.15, bot = s.fy + 3;
      const stiff = !Number.isFinite(p.ailT) || p.ailT > SHIVER;
      g.save();
      if (stiff) {
        const lg = g.createLinearGradient(x - r, top, x + r, bot);
        lg.addColorStop(0, 'rgba(235,250,255,0.55)'); lg.addColorStop(1, 'rgba(140,210,240,0.45)');
        g.fillStyle = lg; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - r * 1.25, bot); g.lineTo(x - r * 1.3, top + r * 0.3); g.lineTo(x - r * 0.9, top - 4); g.lineTo(x + r * 1.0, top); g.lineTo(x + r * 1.3, top + r * 0.4); g.lineTo(x + r * 1.2, bot); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x - r * 1.0, top + 4); g.lineTo(x - r * 0.65, top + 2); g.lineTo(x - r * 0.95, bot - r); g.lineTo(x - r * 1.12, bot - r * 1.1); g.closePath(); g.fill();
        for (let i = 0; i < 3; i++) snowflake(g, x + (i - 1) * r * 0.8, top + r * (0.3 + 0.5 * i), 3.5, t + i, 0.9);
      } else {
        for (const sgn of [-1, 1]) {
          g.strokeStyle = '#bfefff'; g.lineWidth = 2; g.lineCap = 'round';
          for (let k = 0; k < 2; k++) {
            const ox = x + sgn * (r * 1.25 + k * 6), j = Math.sin(t * 40 + k + sgn) * 2;
            g.beginPath(); g.moveTo(ox + j, s.hy - 8); g.lineTo(ox - j, s.hy); g.lineTo(ox + j, s.hy + 8); g.stroke();
          }
        }
        for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; snowflake(g, x + Math.cos(a) * r * 1.3, s.hy - r * 1.1 + Math.sin(a) * 5, 3, a, 0.9); }
      }
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
