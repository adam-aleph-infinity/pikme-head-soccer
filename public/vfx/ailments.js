// WHAT A POWER SHOT LEAVES ON THE PLAYER IT HIT — one plain shape over the head, nothing more.
//
// Drawn on the canvas ABOVE the DOM heads (game.js's net layer), because each sits on a face.
// The stars are filmed (docs/HS-POWER-SHOTS.md §4: three gold stars orbiting a flat ellipse over
// the crown, M4 80.85 s, M3 74.1 s). The other five are not in our footage; each is the single
// shape the brief names for it — `???` for reversed controls, an ice block, sparks, flames, a
// missing head — with no particles and no extra motion.
//
// draw(g, p, s): s = { t, hx, hy (head centre on screen), r (head radius), fy (feet line) }.

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
    draw(g, p, s) {
      const cy = s.hy - s.r - 6, rx = s.r * 0.9, ry = s.r * 0.26;
      g.save(); g.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const a = s.t * 6 + (i / 3) * TAU;
        const x = s.hx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        star5(g, x, y, 7, 0);
        g.fillStyle = '#ffd23c'; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = '#8a5a00'; g.stroke();
      }
      g.restore();
    },
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
  // Frozen: a block of ice round head and body.
  freeze: {
    draw(g, p, s) {
      const w = s.r * 2.5, top = s.hy - s.r - 6, h = s.fy - top + 3, x = s.hx - w / 2;
      g.save();
      g.globalAlpha = 0.5; g.fillStyle = '#bfefff';
      roundRect(g, x, top, w, h, 8); g.fill();
      g.globalAlpha = 0.95; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
      roundRect(g, x, top, w, h, 8); g.stroke();
      g.lineWidth = 3; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(x + 8, top + 10); g.lineTo(x + 8, top + h * 0.45); g.stroke();
      g.restore();
    },
  },
  // Shocked: sparks over the body.
  shock: {
    draw(g, p, s) {
      g.save(); g.lineJoin = 'round'; g.strokeStyle = '#fff27a'; g.lineWidth = 2.5;
      const seed = Math.floor(s.t * 15);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + seed;
        zig(g, s.hx + Math.cos(a) * s.r * 1.1, s.hy + Math.sin(a) * s.r * 0.9, s.hx + Math.cos(a + 1.2) * s.r * 1.2, s.hy + s.r + Math.sin(a) * s.r * 0.6, seed * 3 + i, 6);
      }
      g.restore();
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

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
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
