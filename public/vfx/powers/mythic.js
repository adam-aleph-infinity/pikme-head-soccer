// THE MYTHIC GEM, drawn (what it does: shared/champion-powers/mythic.js). One look for the four
// Mythic starters, in each one's own gem (shared/mythics.js MYTHIC_GEMS: Shoval's ruby, Ori's
// pink diamond, Naveh's topaz, Paz's emerald) — every colour here comes from the ball's own
// `pw.color`, so the same picture is red, pink, yellow or green.
//
//   the cut-in   the gem crystallises where the ball will leave: light rays turning, a ring of
//                facets closing in, sparkles drawn into it
//   the flight   a cut brilliant (eight-sided, table and star facets catching the light as it
//                spins and tumbles), a halo and turning rays round it, a ribbon of its colour
//                behind with twinkling sparkles; a ring of light bursts off it as it leaves
//   the shatter  a flash of its colour, a ring of light, a star of rays, the gem's fragments thrown
//                out and falling, twinkles where it broke
//   the crust    whoever it shattered on, stuck inside a cluster of its crystals (ailments.js `gem`)
//   armed        a little gem circling the head, trailing sparkles
// Client only: Math.random is fine here — nothing drawn feeds back into the sim.

import { TAU, streak, puff } from './common.js';

// ── colour: the gem's base and the shades cut from it ─────────────────────────
const rgb = (hex) => { const n = parseInt(String(hex).slice(1, 7), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (hex, to, k) => { const a = rgb(hex), b = rgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const PALS = new Map();
export function gemPalette(col = '#ff4fc8') {
  let p = PALS.get(col);
  if (!p) {
    p = { base: mix(col, '#000000', 0), light: mix(col, '#ffffff', 0.5), pale: mix(col, '#ffffff', 0.8),
      dark: mix(col, '#000000', 0.4), deep: mix(col, '#000000', 0.68) };
    PALS.set(col, p);
  }
  return p;
}

// A four-pointed twinkle at (x, y), arm length r.
export function sparkle(g, x, y, r, rot = 0) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU, rr = i % 2 ? r * 0.22 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// THE GEM: a round brilliant seen from above, radius R — an octagonal table, star facets round
// it, the girdle facets out to the edge. The light comes from the upper left and stays put while
// the gem turns, so the facets flash bright and dark as it spins. `tilt` squashes it across
// (0..1), for the tumble.
export function gem(g, x, y, R, rot, col, tilt = 1) {
  const P = gemPalette(col);
  const n = 8, L = -2.35;                              // the light's direction
  const G = [], T = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, b = rot + ((i + 0.5) / n) * TAU;
    G.push([Math.cos(a) * R, Math.sin(a) * R]);
    T.push([Math.cos(b) * R * 0.52, Math.sin(b) * R * 0.52]);
  }
  const shade = (ang, k) => {                          // facet brightness from its facing
    const f = 0.5 + 0.5 * Math.cos(ang - L);
    return f * k > 0.72 ? P.pale : f * k > 0.5 ? P.light : f * k > 0.3 ? P.base : f * k > 0.14 ? P.dark : P.deep;
  };
  g.save();
  g.translate(x, y); g.scale(tilt, 1);
  g.lineJoin = 'round';
  // the girdle facets (G_i, G_i+1, T_i) and the star facets (T_i-1, G_i, T_i)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, h = (i + n - 1) % n;
    const ga = rot + ((i + 0.5) / n) * TAU, sa = rot + (i / n) * TAU;
    g.fillStyle = shade(ga, 0.95);
    g.beginPath(); g.moveTo(G[i][0], G[i][1]); g.lineTo(G[j][0], G[j][1]); g.lineTo(T[i][0], T[i][1]); g.closePath(); g.fill();
    g.fillStyle = shade(sa + Math.PI * 0.12, 1.15);
    g.beginPath(); g.moveTo(T[h][0], T[h][1]); g.lineTo(G[i][0], G[i][1]); g.lineTo(T[i][0], T[i][1]); g.closePath(); g.fill();
  }
  // the table: lit from the corner, a shine across it
  const tg = g.createLinearGradient(-R * 0.5, -R * 0.5, R * 0.5, R * 0.5);
  tg.addColorStop(0, P.pale); tg.addColorStop(0.45, P.light); tg.addColorStop(1, P.base);
  g.fillStyle = tg;
  g.beginPath(); for (const p of T) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
  // facet edges, then the outline
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(0.8, R * 0.05);
  g.beginPath();
  for (let i = 0; i < n; i++) { const h = (i + n - 1) % n; g.moveTo(T[h][0], T[h][1]); g.lineTo(G[i][0], G[i][1]); g.lineTo(T[i][0], T[i][1]); }
  g.stroke();
  g.strokeStyle = P.deep; g.lineWidth = Math.max(1.2, R * 0.09);
  g.beginPath(); for (const p of G) g.lineTo(p[0], p[1]); g.closePath(); g.stroke();
  // the glint: a white sheen on the table and a twinkle at its corner
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath(); g.ellipse(-R * 0.22, -R * 0.26, R * 0.26, R * 0.1, -0.75, 0, TAU); g.fill();
  g.restore();
  g.fillStyle = '#ffffff';
  sparkle(g, x - R * 0.42 * tilt, y - R * 0.46, R * 0.42, 0.2);
}

// A long crystal shard pointing along (ux, uy): a ridge down the middle, one face lit, one dark.
export function shard(g, x, y, R, ux, uy, col) {
  const P = gemPalette(col), px = -uy, py = ux;
  const tip = [x + ux * R * 1.9, y + uy * R * 1.9], back = [x - ux * R * 1.15, y - uy * R * 1.15];
  const l = [x + ux * R * 0.15 + px * R * 0.58, y + uy * R * 0.15 + py * R * 0.58];
  const rr = [x + ux * R * 0.15 - px * R * 0.58, y + uy * R * 0.15 - py * R * 0.58];
  g.save(); g.lineJoin = 'round';
  g.fillStyle = py < 0 || (py === 0 && px < 0) ? P.light : P.dark;
  g.beginPath(); g.moveTo(...tip); g.lineTo(...l); g.lineTo(...back); g.closePath(); g.fill();
  g.fillStyle = py < 0 || (py === 0 && px < 0) ? P.dark : P.light;
  g.beginPath(); g.moveTo(...tip); g.lineTo(...rr); g.lineTo(...back); g.closePath(); g.fill();
  g.strokeStyle = P.pale; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(...tip); g.lineTo(...back); g.stroke();
  g.strokeStyle = P.deep; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(...tip); g.lineTo(...l); g.lineTo(...back); g.lineTo(...rr); g.closePath(); g.stroke();
  g.restore();
}

// A soft halo and turning rays round (x, y), in the gem's colours, additive.
function halo(g, x, y, R, P, t, k = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  puff(g, x, y, R * 2.7, P.base, 0.55 * k);
  puff(g, x, y, R * 1.5, P.pale, 0.45 * k);
  // the rays: six long, six short, turning against the gem
  for (let i = 0; i < 12; i++) {
    const a = -t * 1.6 + (i / 12) * TAU, len = R * (i % 2 ? 2.2 : 3.4) * (0.85 + 0.15 * Math.sin(t * 9 + i)), w = R * (i % 2 ? 0.1 : 0.16);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, px = -Math.sin(a) * w, py = Math.cos(a) * w;
    const lg = g.createLinearGradient(x, y, ex, ey);
    lg.addColorStop(0, P.pale); lg.addColorStop(1, P.light + '00');
    g.globalAlpha = 0.5 * k; g.fillStyle = lg;
    g.beginPath(); g.moveTo(x + px, y + py); g.lineTo(ex, ey); g.lineTo(x - px, y - py); g.closePath(); g.fill();
  }
  g.restore();
}

// ── the shatter: a one-off burst, run by champ-vfx (event → burst → update/draw) ──────────
function shatterBurst(x, y, col, dir) {
  const P = gemPalette(col);
  const bits = [];
  for (let i = 0; i < 18; i++) {
    // thrown out every way, most of them on toward the goal and up
    const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.6 * (i % 3 ? 1 : 2.2), v = 260 + Math.random() * 520;
    bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, s: 4 + Math.random() * 7, rot: Math.random() * TAU, w: (Math.random() - 0.5) * 22, c: i % 3 });
  }
  const twinkles = [];
  for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, d = 20 + Math.random() * 90; twinkles.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, at: Math.random() * 0.25, s: 5 + Math.random() * 7 }); }
  return {
    t: 0, life: 0.95,
    step(dt) {
      for (const b of bits) { b.vy += 1100 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.985; b.rot += b.w * dt; }
    },
    draw(g, t) {
      g.save();
      // the flash: the whole screen in its colour, for a blink
      if (t < 0.2) {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 0.45 * (1 - t / 0.2); g.fillStyle = P.light;
        g.fillRect(0, 0, g.canvas.width, g.canvas.height);
        g.restore();
      }
      g.globalCompositeOperation = 'lighter';
      // the core flash and the ring
      if (t < 0.22) puff(g, x, y, 80 + t * 360, P.pale, 1 - t / 0.22);
      // a star of light bursting out of the break
      if (t < 0.3) halo(g, x, y, 34 + t * 120, P, t * 2, 1 - t / 0.3);
      if (t < 0.4) {
        const f = t / 0.4;
        g.globalAlpha = 1 - f; g.strokeStyle = P.pale; g.lineWidth = 10 * (1 - f) + 1;
        g.beginPath(); g.arc(x, y, 24 + f * 190, 0, TAU); g.stroke();
        g.globalAlpha = 0.6 * (1 - f); g.strokeStyle = P.base; g.lineWidth = 16 * (1 - f) + 1;
        g.beginPath(); g.arc(x, y, 18 + f * 120, 0, TAU); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      // the fragments: little cut triangles, lit face and dark face
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.35 : 1;
      for (const b of bits) {
        g.globalAlpha = Math.max(0, fade);
        const c = Math.cos(b.rot), s = Math.sin(b.rot), S = b.s;
        g.fillStyle = b.c === 0 ? P.pale : b.c === 1 ? P.light : P.base;
        g.beginPath(); g.moveTo(b.x + c * S, b.y + s * S); g.lineTo(b.x - s * S * 0.6, b.y + c * S * 0.6); g.lineTo(b.x - c * S * 0.8, b.y - s * S * 0.8); g.closePath(); g.fill();
        g.fillStyle = P.dark;
        g.beginPath(); g.moveTo(b.x + c * S, b.y + s * S); g.lineTo(b.x - c * S * 0.8, b.y - s * S * 0.8); g.lineTo(b.x + s * S * 0.5, b.y - c * S * 0.5); g.closePath(); g.fill();
      }
      // twinkles popping round where it broke
      g.fillStyle = '#ffffff';
      for (const w of twinkles) {
        const k = (t - w.at) / 0.35;
        if (k <= 0 || k >= 1) continue;
        g.globalAlpha = Math.sin(k * Math.PI);
        sparkle(g, w.x, w.y, w.s * Math.sin(k * Math.PI), k * 2);
      }
      g.restore();
    },
  };
}

export default {
  id: 'mythicgem',
  palette: ['#ffffff', '#ff4fc8', '#19d873'],

  draw(g, b, s) {
    const pw = s.pw, col = pw.color, P = gemPalette(col), x = s.x, y = s.y, r = s.r, now = s.now || 0;
    const dir = pw.dir || 1;
    // ── the GEM in flight ──
    const R = r * 1.5;
    // the ribbon behind it: the recorded path, straight back along the heading when short
    const pts = [{ x, y }];
    const h = s.hist || [];
    for (let i = 1; i < h.length && pts.length < 12; i++) pts.push(h[i]);
    while (pts.length < 8) { const q = pts[pts.length - 1]; pts.push({ x: q.x - dir * 34, y: q.y }); }
    const last = Math.min(pts.length - 1, 10);
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c, a] of [[R * 2.6, P.deep, 0.5], [R * 1.6, P.base, 0.7], [R * 0.75, P.light, 0.9], [R * 0.28, '#ffffff', 1]]) {
      const lg = g.createLinearGradient(x, y, pts[last].x, pts[last].y);
      lg.addColorStop(0, c); lg.addColorStop(1, c + '00');
      g.strokeStyle = lg; g.globalAlpha = a; g.lineWidth = w;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= last; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
    g.restore();
    // sparkles flaking off along the ribbon, twinkling
    g.save(); g.fillStyle = '#ffffff';
    const seed = Math.floor(now * 24);
    for (let i = 0; i < 10; i++) {
      const j = 2 + ((i * 7 + seed) % 9), p = pts[Math.min(pts.length - 1, j)];
      const ox = ((i * 37 + seed * 13) % 31) - 15, oy = ((i * 53 + seed * 7) % 35) - 17;
      g.globalAlpha = Math.max(0, 1 - j * 0.09);
      g.fillStyle = i % 3 ? '#ffffff' : P.pale;
      sparkle(g, p.x + ox, p.y + oy, 3 + ((i * 5 + seed) % 5), i + seed * 0.3);
    }
    g.restore();
    // the halo and its rays, the gem turning and tumbling in it
    halo(g, x, y, R, P, now);
    gem(g, x, y, R, now * 7 * dir, col, 0.72 + 0.28 * Math.abs(Math.cos(now * 5.5)));
    // the release: a ring of light bursts off it as it leaves the cut-in
    if (s.t < 0.2) {
      const f = s.t / 0.2;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 1 - f; g.strokeStyle = P.pale; g.lineWidth = 6 * (1 - f) + 1;
      g.beginPath(); g.arc(s.fx, s.fy, R * (1.2 + f * 4), 0, TAU); g.stroke();
      puff(g, s.fx, s.fy, R * (2 + f * 3), P.light, 0.7 * (1 - f));
      g.restore();
    }
    return true;
  },

  // Under the cut-in: the gem crystallising where the ball will leave — rays turning faster and
  // brighter, eight facets closing in from a wide ring, sparkles drawn into the middle.
  cutin(g, s) {
    const P = gemPalette(s.pw.color), x = s.fx, y = s.fy, R = s.r * 1.5, t = s.now || 0;
    const k = Math.max(0, Math.min(1, (s.cut ?? 0.6) / 0.9));       // 0 → 1 over the cut-in's build
    halo(g, x, y, R * (0.6 + 0.6 * k), P, t * (1 + k), 0.4 + 0.6 * k);
    g.save();
    const ring = R * (3.4 - 2.4 * k);
    for (let i = 0; i < 8; i++) {
      const a = t * 2.5 + (i / 8) * TAU, px = x + Math.cos(a) * ring, py = y + Math.sin(a) * ring;
      g.globalAlpha = 0.35 + 0.65 * k;
      shard(g, px, py, R * 0.32, -Math.cos(a), -Math.sin(a), s.pw.color);
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const f = ((t * 1.4 + i / 6) % 1), a = i * 2.4 + 0.5, d = R * 3 * (1 - f);
      g.globalAlpha = Math.sin(f * Math.PI);
      sparkle(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 4 + 4 * f, f * 3);
    }
    g.restore();
  },

  // Armed: a little gem of its colour circling the head, a trail of twinkles behind it.
  armed(g, p, s) {
    const col = (p.shot && p.shot.color) || '#ff4fc8', P = gemPalette(col);
    const t = s.t, rx = s.r * 1.55, ry = s.r * 0.5, cy = s.hy - s.r * 0.35;
    g.save();
    for (let i = 5; i >= 1; i--) {
      const a = t * 3 - i * 0.22;
      g.globalAlpha = 0.6 - i * 0.1; g.fillStyle = i % 2 ? '#ffffff' : P.pale;
      sparkle(g, s.hx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 3.5 - i * 0.4, a * 2);
    }
    g.globalAlpha = 1;
    const a = t * 3, x = s.hx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    g.globalCompositeOperation = 'lighter'; puff(g, x, y, s.r * 0.7, P.base, 0.7); g.globalCompositeOperation = 'source-over';
    gem(g, x, y, s.r * 0.32, t * 4, col, 0.75 + 0.25 * Math.abs(Math.cos(t * 4)));
    g.restore();
  },

  // The shatter's burst (champ-vfx runs it): at the screen point where the gem broke.
  event(e, at) {
    if (e.type !== 'gemShatter') return null;
    const d = at(e.x, e.y);
    return shatterBurst(d.x, d.y, e.color || '#ff4fc8', e.dir || 1);
  },
};
