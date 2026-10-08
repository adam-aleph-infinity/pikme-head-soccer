// Card #42 — התאום (The Twin). Card: Ori flying out of a tank's cannon, shells streaking past
// ("we played GTA in real life for a whole day"). Power: the twin kicks a second ball at the same
// time (Multi-Ball, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the card's tank, all turret and grin --------------------------------------------------------
function tank() {
  begin();
  const O = { base: '#6a7a3a', light: '#8fa050', hi: '#b8c87a', shade: '#4a5626', camo: '#3a4420', camo2: '#a8a060' };
  let s = '';
  // the antenna with its pennant
  s += line('M38 40L30 10', INK, 3.4) + line('M38 40L30 10', '#8a96a2', 1.4) + part(poly([[30, 10], [46, 14], [32, 20]]), '#e5262e', 2.2);
  // treads
  const tread = smooth([[16, 94], [24, 82, 1], [124, 82, 1], [132, 94], [124, 117.5, 1], [24, 117.5, 1]], true, 0.6);
  s += part(tread, '#3a3d46') + inside(tread, line('M14 86h120M14 114h120', '#5a5f68', 1.6) + line(Array.from({ length: 14 }, (_, i) => `M${16 + i * 9} 84v4M${16 + i * 9} 112v4`).join(''), '#5a5f68', 1.6));
  for (const x of [34, 55, 76, 97, 116]) s += part(circle(x, 100, 7.4), '#5a5f68', 3) + fill(circle(x, 100, 3), '#8a96a2');
  const hull = smooth([[22, 72, 1], [122, 70, 1], [126, 84, 1], [18, 86, 1]], true, 0.4);
  s += part(hull, O.base) + inside(hull, fill(poly([[0, 78], [144, 76], [144, 90], [0, 90]]), O.shade));
  // the barrel, then the turret over it
  const barrel = smooth([[104, 40, 1], [126, 37, 1], [126, 49, 1], [104, 52, 1]], true, 0.3);
  s += part(barrel, O.base) + part(smooth([[122, 33, 1], [132, 32, 1], [132, 53, 1], [122, 52, 1]], true, 0.3), O.shade, 4) + inside(barrel, line('M108 42l16-2', O.hi, 1.6));
  const turret = smooth([[24, 74], [26, 44], [44, 24], [74, 16], [102, 22], [118, 40], [122, 58], [120, 74]]);
  s += part(turret, O.base);
  s += inside(turret, fill(smooth([[20, 30], [50, 40], [44, 80], [20, 80]]), O.shade) + fill(ellipse(52, 46, 9, 5, -0.4), O.camo) + fill(ellipse(96, 44, 7, 4, 0.3), O.camo2) + fill(ellipse(46, 64, 6, 3.4), O.camo2) +
    fill(smooth([[60, 32], [96, 34], [108, 46], [84, 42]]), O.light) + line('M62 34q24-4 42 10', O.hi, 2));
  s += part(ellipse(70, 16, 14, 4.4), O.shade, 3.4) + fill(ellipse(70, 15, 9, 2.4), O.light);
  s += rim([turret, tread], poly([[0, 0], [70, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // eyes in the turret, a grin along the hull
  s += eyeE({ x0: 58, x1: 74, top: 48, bot: 60, slant: 0.45, nose: 1, px: 69, py: 55, pr: 4 });
  s += eyeE({ x0: 82, x1: 100, top: 47, bot: 59, slant: 0.45, nose: -1, px: 94, py: 54, pr: 4.4 });
  s += browsE([54, 42, 76, 48], [80, 46, 104, 40], 2.8);
  const mouth = smooth([[56, 74, 1], [84, 74], [112, 72, 1], [106, 82], [84, 84], [62, 82]]);
  s += mouthE(84, 78, 44, fill(mouth, '#2a1a12') + inside(mouth, fill(poly([[54, 71], [114, 70], [114, 76], [54, 77]]), '#fff')) + line(mouth, INK, 1.8));
  // the muzzle's blast, and a shell flying
  s += part(circle(136, 30, 3.6), '#d8d2c8', 2.4) + sparkle(116, 10, 3.4);
  return end(s);
}

// ---- B: a fried egg with two yolks: twins -----------------------------------------------------------------
function egg() {
  begin();
  const W = { base: '#fbfaf6', shade: '#e2ddd0', edge: '#e0a850', edgeD: '#b87a30' };
  const Y = { base: '#ffb627', light: '#ffd86a', shade: '#e08a12' };
  let s = '';
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 52 + Math.sin(i * 2.3) * 6; pts.push([74 + Math.cos(a) * r * 1.08, 64 + Math.sin(a) * r * 0.98]); }
  const white = smooth(pts);
  s += part(white, W.base);
  s += inside(white, line(white, W.edge, 9) + line(white, W.edgeD, 3, 'stroke-dasharray="3 5"') + fill(smooth([[10, 70], [60, 96], [140, 80], [140, 130], [10, 130]]), W.shade, 'opacity=".7"') + line('M30 40q20-16 50-16', '#ffffff', 3));
  s += rim(white, poly([[0, 0], [70, 0], [36, 30], [16, 80], [0, 90]]), 2, '#ffd86a');
  // the two yolks are its eyes
  for (const [cx, cy, r, px] of [[54, 56, 15, 59], [94, 52, 17, 100]]) {
    const yolk = circle(cx, cy, r);
    s += part(yolk, Y.base, 4) + inside(yolk, fill(circle(cx + 4, cy + 4, r), Y.shade) + fill(circle(cx - 2, cy - 2, r * 0.9), Y.base)) +
      fill(circle(px, cy + 1, r * 0.42), '#0d0a0c') + fill(circle(px + r * 0.15, cy - r * 0.15, r * 0.14), '#ffffff') + fill(ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.3, r * 0.18, -0.6), '#fff6c8');
  }
  s += line('M40 36L66 42M80 36L108 30', INK, 2.8);
  s += line('M58 88Q76 98 96 86', INK, 2.6) + line('M96 86l3-3', INK, 1.8);
  // the pan sizzling round it
  for (const [x, y, r] of [[18, 96, 2.4], [126, 104, 2], [134, 30, 2.6], [10, 40, 2]]) s += line(circle(x, y, r), '#ffd86a', 1.2);
  s += line('M128 92l8-4M130 100l10 0M8 108l8-4', '#ffffff', 1.4, 'opacity=".6"');
  return end(s);
}

// ---- C: twin cherries on one stem, the little one copying the big one ---------------------------------------
function cherries() {
  begin();
  const C = { base: '#d81f3a', light: '#ff5a6e', hi: '#ffd0d8', shade: '#9c0f28' };
  let s = '';
  // the shared stem and its leaf
  s += line('M84 36Q78 14 66 6M38 54Q48 24 66 6', INK, 5) + line('M84 36Q78 14 66 6M38 54Q48 24 66 6', '#6a8a2a', 2.6);
  s += part(smooth([[66, 6], [86, 2], [100, 10, 1], [82, 12]]), '#4fae3a', 3) + line('M68 7l28 2', '#2e7a22', 1);
  // the little twin behind
  const small = circle(36, 80, 27);
  s += part(small, C.shade) + inside(small, fill(circle(42, 86, 27), '#7a0a20') + fill(ellipse(28, 68, 7, 4.4, -0.6), C.light));
  s += eye({ x0: 30, x1: 40, top: 74, bot: 82, slant: 0.4, nose: 1, px: 37, py: 79, pr: 2.6, r: 1.6 });
  s += eye({ x0: 46, x1: 56, top: 73, bot: 81, slant: 0.4, nose: -1, px: 53, py: 78, pr: 2.8, r: 1.6 });
  s += line('M36 90q6 4 12 0', INK, 1.8);
  // the big one in front
  const big = circle(86, 74, 40);
  s += part(big, C.base);
  s += inside(big, fill(circle(94, 82, 40), C.shade) + fill(circle(82, 70, 34), C.base) + fill(ellipse(70, 50, 12, 7, -0.6), C.hi) + fill(ellipse(62, 62, 3, 2, -0.6), '#ffffff'));
  s += rim([big, small], poly([[0, 0], [70, 0], [40, 40], [10, 80], [0, 90]]), 2);
  s += eye({ x0: 66, x1: 82, top: 64, bot: 76, slant: 0.4, nose: 1, px: 77, py: 71, pr: 4 });
  s += eye({ x0: 94, x1: 112, top: 63, bot: 75, slant: 0.4, nose: -1, px: 106, py: 70, pr: 4.4 });
  s += line('M62 58L84 62M92 60L116 54', INK, 2.8);
  const mouth = smooth([[76, 88, 1], [92, 90], [108, 86, 1], [104, 96], [92, 100], [80, 96]]);
  s += fill(mouth, '#3a0a14') + inside(mouth, fill(poly([[74, 85], [110, 84], [110, 90], [74, 91]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(130, 24, 4) + sparkle(14, 30, 3);
  return end(s);
}

export default {
  card: 42, champion: 'התאום', en: 'The Twin', theme: 'Card: real-life GTA, fired out of a tank · Power: a second ball kicked at the same time (Multi-Ball, push)',
  options: [
    { letter: 'A', name: 'Tank', draw: fitted(tank, [1, 1, 0, -1]), marks: { eyes: [[66, 54], [91, 53]], nose: [84, 64] },
      blurb: 'The card\'s tank, all turret and grin: olive camo, eyes under the hatch, a grin along the hull, its cannon forward and smoking, a pennant flying off the antenna, treads underneath. <i>Silhouette: a dome with a long barrel, on treads.</i>' },
    { letter: 'B', name: 'Double Yolk', draw: egg,
      blurb: 'Twins, the way breakfast does it: a fried egg with two yolks for its two eyes, a crispy golden lace edge, a wide grin in the white, sizzling. <i>Silhouette: a wavy flat blob.</i>' },
    { letter: 'C', name: 'Twin Cherries', draw: cherries,
      blurb: 'Two on one stem: a big glossy cherry with a cocky grin and its little twin hanging beside it, pulling exactly the same face. The second ball, in fruit. <i>Silhouette: two round cherries under one forked stem.</i>' },
  ],
};
