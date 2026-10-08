// Card #28 — זורק הבומרנג (The Boomerang Thrower). Card: Naveh and a hired bride in gold, a
// cupid overhead, a diamond ring, hearts falling ("we hired a partner in Japan"). Power: a
// boomerang, a high looping arc back into the goal (Aerial).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };
const heart = (x, y, r, c = '#ff6a8a') => part(smooth([[x, y + r, 1], [x - r, y], [x - r * 0.9, y - r * 0.6], [x - r * 0.4, y - r * 0.8], [x, y - r * 0.4, 1], [x + r * 0.4, y - r * 0.8], [x + r * 0.9, y - r * 0.6], [x + r, y]]), c, 2.4);
// A boomerang centred on (x, y), turned `rot` degrees.
const boomerang = (x, y, rot) => {
  const d = smooth([[x - 16, y + 4], [x - 4, y - 8], [x, y - 10, 1], [x + 4, y - 8], [x + 16, y + 4], [x + 14, y + 7], [x + 2, y - 2], [x - 2, y - 2], [x - 14, y + 7]]);
  return `<g transform="rotate(${rot} ${x} ${y})">` + part(d, '#c98a4a', 3.4) + line(`M${x - 12} ${y + 3}l10 -9M${x + 12} ${y + 3}l-10 -9`, '#e5262e', 1.6) + '</g>';
};

// ---- A: the card's diamond, set in its ring -------------------------------------------------------
function diamond() {
  begin();
  const D = { a: '#ffffff', b: '#e6f7ff', c: '#bfe8ff', d: '#8fd6ff', e: '#5fb0e6' };
  let s = '';
  // the gold band, below
  // the band's back half, behind the stone (its front half is drawn after)
  const back = 'M24 96A50 18 0 0 1 124 96', front = 'M24 96A50 18 0 0 0 124 96';
  s += line(back, INK, 15) + line(back, G.shade, 9);
  // the stone: table, crown, girdle, pavilion
  const P = { t1: [56, 8], t2: [92, 8], gl: [22, 34], gr: [126, 34], c1: [40, 20], c2: [108, 20], bot: [74, 92] };
  // the red velvet cushion it sits on
  const cushion = smooth([[18, 104], [30, 90], [74, 86], [118, 90], [130, 104], [122, 117.5], [74, 117.5], [26, 117.5]]);
  s += part(cushion, '#c8283a') + inside(cushion, fill(poly([[0, 108], [144, 108], [144, 120], [0, 120]]), '#951a2a') + line('M30 94Q74 88 118 94', '#ff6a7a', 1.6));
  P.bot = [74, 98];
  const out = poly([P.t1, P.t2, P.c2, P.gr, [126, 58], [104, 84], P.bot, [44, 84], [22, 58], P.gl, P.c1]);
  s += keyline(out) + fill(out, D.d);
  const f = (pts, c) => fill(poly(pts), c) + line(poly(pts), 'rgba(40,90,140,.4)', 0.7);
  s += f([P.t1, P.t2, [100, 18], [48, 18]], D.b) + f([P.c1, P.t1, [48, 18], [40, 32], P.gl], D.c) + f([[48, 18], [100, 18], [108, 32], [40, 32]], D.a) + f([P.t2, P.c2, P.gr, [108, 32], [100, 18]], D.b);
  s += f([P.gl, [22, 58], [44, 84], P.bot], D.c) + f([P.gr, [126, 58], [104, 84], P.bot], D.e) + f([P.gl, [40, 32], [56, 60], P.bot], D.d) + f([[40, 32], [108, 32], [92, 60], [56, 60]], D.b) + f([[56, 60], [92, 60], P.bot], D.c) + f([[108, 32], P.gr, P.bot, [92, 60]], D.e);
  s += line(`M${P.gl[0]} ${P.gl[1]}H${P.gr[0]}`, '#ffffff', 1.4);
  // four gold claws holding it
  for (const [x, y, k] of [[26, 34, -1], [122, 34, 1], [52, 72, -1], [96, 72, 1]]) s += part(smooth([[x - 3, y + 6], [x, y - 4, 1], [x + 3, y + 6]]), G.base, 3);
  s += rim(out, poly([[0, 0], [60, 0], [30, 30], [10, 60], [0, 60]]), 1.8, '#ffffff');
  s += line(front, INK, 15) + line(front, G.base, 9) + line('M34 104Q74 120 114 104', G.light, 2);
  // a face in the stone, lovestruck
  s += eyeE({ x0: 52, x1: 68, top: 38, bot: 50, slant: 0.1, nose: 1, px: 63, py: 45, pr: 4, white: '#ffffff' });
  s += eyeE({ x0: 80, x1: 98, top: 37, bot: 50, slant: 0.1, nose: -1, px: 92, py: 44, pr: 4.4, white: '#ffffff' });
  s += expr() === 'normal' ? line('M50 32q8-4 18-1M80 31q9-4 20 0', INK, 2.2) : browsE([50, 32, 68, 31], [80, 31, 100, 31], 2.2);
  s += mouthE(77, 61, 24, line('M66 60Q76 66 88 58', INK, 2.2)) + fill(ellipse(54, 56, 5, 3), '#ffb3c8') + fill(ellipse(98, 54, 4, 3), '#ffb3c8');
  s += sparkle(30, 12, 4) + heart(20, 70, 5) + heart(128, 86, 4.4, '#ff8ab0');
  return end(s);
}

// ---- B: a koala who throws boomerangs ------------------------------------------------------------
function koala() {
  begin();
  const F = { base: '#9aa3ac', light: '#c4cad0', hi: '#e2e6ea', shade: '#6e7680' };
  let s = '';
  // big fluffy ears
  const fluff = (x, y, r) => { const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([x + Math.cos(a) * r * (i % 2 ? 1 : 1.12), y + Math.sin(a) * r * (i % 2 ? 1 : 1.12), i % 2 ? 0 : 1]); } return smooth(pts); };
  for (const [x, y, r] of [[26, 40, 21], [120, 36, 20]]) { const d = fluff(x, y, r); s += part(d, F.base) + inside(d, fill(circle(x + 3, y + 3, r * 0.6), '#f2f2ee') + fill(circle(x + 5, y + 6, r * 0.4), '#d8dce0')); }
  const head = smooth([[28, 92], [24, 66], [34, 46], [56, 34], [88, 32], [110, 40], [124, 58], [128, 80], [120, 100], [100, 112], [74, 116.5], [46, 112]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 80], [44, 130], [0, 130]]), F.shade) + fill(smooth([[60, 36], [100, 38], [116, 54], [86, 50]]), F.light) + line('M64 36q24-4 40 12', F.hi, 2.2) +
    fill(smooth([[40, 96], [76, 104], [118, 96], [118, 130], [40, 130]]), F.light));
  s += rim(head, poly([[0, 0], [70, 0], [40, 36], [24, 80], [0, 90]]), 2.2);
  // the big leathery nose, an unbothered half-lidded look, a leaf to chew
  s += eye({ x0: 54, x1: 70, top: 58, bot: 70, slant: 0.5, nose: 1, px: 65, py: 66, pr: 4 });
  s += eye({ x0: 98, x1: 114, top: 56, bot: 68, slant: 0.5, nose: -1, px: 109, py: 64, pr: 4.2 });
  const nose = smooth([[74, 62], [92, 60], [96, 76], [92, 90], [82, 94], [74, 86], [72, 72]]);
  s += part(nose, '#2a2a30', 4) + fill(ellipse(80, 68, 3, 6, 0.2), '#5a5e6a');
  s += line('M76 100q10 4 18-1', INK, 2.2);
  s += line('M94 98L112 108', INK, 3.4) + line('M94 98L112 108', '#5f8a26', 1.4) + part(ellipse(116, 110, 7, 3.4, 0.5), '#6cc94a', 2.4);
  // its boomerang, coming back round
  s += line('M14 112Q4 80 20 58', '#ffffff', 1.4, 'stroke-dasharray="3 3" opacity=".7"') + boomerang(118, 8, 30) + line('M100 10Q80 4 64 10', '#ffffff', 1.4, 'stroke-dasharray="3 3" opacity=".7"');
  return end(s);
}

// ---- C: the wedding cake, three tiers of lovestruck --------------------------------------------------
function cake() {
  begin();
  const W = { base: '#fbf7f0', shade: '#e6dccb', light: '#ffffff' };
  let s = '';
  const t1 = smooth([[18, 86, 1], [130, 86, 1], [130, 117.5, 1], [18, 117.5, 1]], true, 0.3), t2 = smooth([[32, 58, 1], [116, 58, 1], [116, 88, 1], [32, 88, 1]], true, 0.3), t3 = smooth([[46, 32, 1], [102, 32, 1], [102, 60, 1], [46, 60, 1]], true, 0.3);
  s += keyline([t1, t2, t3]);
  for (const [d, y0, y1, x0, x1] of [[t1, 86, 118, 18, 130], [t2, 58, 88, 32, 116], [t3, 32, 60, 46, 102]]) {
    s += fill(d, W.base) + inside(d, fill(poly([[0, 0], [x0 + 12, 0], [x0 + 12, 130], [0, 130]]), W.shade) +
      // a drip of icing round the top edge, a string of gold pearls under it
      fill(smooth([[x0, y0], [x1, y0], [x1, y0 + 5], ...Array.from({ length: 7 }, (_, i) => [x1 - (i + 0.5) * ((x1 - x0) / 7), y0 + 5 + (i % 2 ? 4 : 1)]), [x0, y0 + 5]]), W.light) +
      Array.from({ length: Math.floor((x1 - x0) / 8) }, (_, i) => fill(circle(x0 + 4 + i * 8, y1 - 4, 1.6), G.base)).join(''));
    s += line(d, INK, 1.4);
  }
  // pink roses tucked round the tiers
  for (const [x, y, r] of [[26, 86, 5], [122, 86, 5], [40, 58, 4.4], [108, 58, 4.4]]) s += part(circle(x, y, r), '#ff8fae', 2.4) + line(`M${x - r * 0.5} ${y}a${r * 0.5} ${r * 0.5} 0 1 1 ${r * 0.5} ${r * 0.5}`, '#d85a80', 1.2);
  // the topper: two gold rings and a heart
  s += line(circle(66, 24, 7), INK, 6) + line(circle(66, 24, 7), G.base, 3) + line(circle(80, 24, 7), INK, 6) + line(circle(80, 24, 7), G.base, 3) + heart(74, 8, 7, '#ff4a6a');
  s += rim([t1, t2, t3], poly([[0, 0], [60, 0], [40, 40], [24, 90], [0, 110]]), 2);
  // lovestruck: eyes on the middle tier, a blushing grin on the bottom one
  s += eye({ x0: 50, x1: 66, top: 64, bot: 77, slant: 0.08, nose: 1, px: 61, py: 71, pr: 4.4 }) + line('M50 64l-4-3M51 67l-4-1', INK, 1.6);
  s += eye({ x0: 80, x1: 98, top: 63, bot: 76, slant: 0.08, nose: -1, px: 93, py: 70, pr: 4.8 });
  s += fill(ellipse(46, 98, 7, 4), '#ffb3c8') + fill(ellipse(110, 96, 6, 4), '#ffb3c8');
  const mouth = smooth([[62, 94, 1], [78, 96], [94, 92, 1], [90, 102], [78, 106], [66, 102]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(78, 106, 8, 4), '#ff7a96')) + line(mouth, INK, 1.8);
  s += heart(130, 30, 6) + heart(16, 44, 5, '#ff8ab0') + sparkle(126, 60, 3.4) + sparkle(18, 20, 3);
  return end(s);
}

export default {
  card: 28, champion: 'זורק הבומרנג', en: 'The Boomerang Thrower', theme: 'Card: a golden wedding, cupid, a diamond ring · Power: a looping boomerang arc (Aerial)',
  options: [
    { letter: 'A', name: 'Rock', draw: diamond, marks: { eyes: [[60, 44], [89, 43.5]], nose: [77, 53] },
      blurb: 'The card\'s diamond come alive: a brilliant-cut stone in faceted blue-white, lovestruck, gold claws gripping it, its gold band curving under it, sparkles and hearts round it. <i>Silhouette: a gem point-down on a ring.</i>' },
    { letter: 'B', name: 'Koala', draw: koala,
      blurb: 'The boomerang\'s home team: a koala with big fluffy ears and a leathery nose, an unbothered half-lidded look, a gum leaf to chew, its boomerang curving back round its head. <i>Silhouette: a round head between two big fluffy ears.</i>' },
    { letter: 'C', name: 'Wedding Cake', draw: cake,
      blurb: 'The card\'s wedding, served: a three-tier cake, icing dripping, gold pearls and pink roses, two gold rings and a heart for a topper, eyes on the middle tier and a blushing grin on the bottom one. <i>Silhouette: a stepped stack with rings on top.</i>' },
  ],
};
