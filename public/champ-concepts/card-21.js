// Card #21 — צייד המטאורים (The Meteor Hunter). Card: Shoval split down the middle, half
// samurai with a katana, half bather at a hot spring with a wooden bucket ("the oldest hotel
// in the world"): a pagoda, misty mountains. Power: a meteor that dives into the goal and burns
// (Downward, burn).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const steam = (x, y, k = 1) => line(`M${x} ${y}q${-6 * k} -8 0 -14q${6 * k} -6 0 -14`, '#ffffff', 2.6, 'opacity=".8"');

// ---- A: a snow monkey soaking in the onsen ---------------------------------------------------
function monkey() {
  begin();
  const F = { base: '#a89482', light: '#cbb9a6', hi: '#e8dccc', shade: '#7e6a58' };
  const P = { base: '#e8857a', light: '#f4a59a', shade: '#c86458' };
  let s = steam(18, 40) + steam(130, 36, -1) + steam(122, 70);
  // the fluffy head, tufts all round
  const pts = [];
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = i % 2 ? 1 : 1.08; pts.push([74 + Math.cos(a) * 54 * r, 64 + Math.sin(a) * 50 * r, i % 2 ? 0 : 1]); }
  const head = smooth(pts);
  s += part(circle(22, 66, 9), P.shade, 4.4) + fill(circle(21, 66, 4.4), P.light);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 10], [40, 26], [30, 80], [40, 130], [0, 130]]), F.shade) + fill(smooth([[50, 14], [100, 14], [118, 30], [80, 26]]), F.light) +
    [[46, 22], [60, 16], [96, 18], [112, 28], [32, 36]].map(([x, y]) => fill(circle(x, y, 2.4), '#ffffff')).join(''));
  s += rim(head, poly([[0, 0], [70, 0], [36, 30], [20, 80], [0, 90]]), 2.2);
  // the pink face, blissed out
  const face = smooth([[66, 58], [80, 52], [94, 56], [110, 52], [122, 62], [122, 82], [114, 96], [98, 102], [80, 98], [68, 88], [62, 72]]);
  s += part(face, P.base, 4) + inside(face, fill(smooth([[50, 80], [80, 96], [130, 86], [130, 120], [50, 120]]), P.shade) + fill(smooth([[70, 50], [96, 52], [100, 64], [74, 62]]), P.light));
  s += line('M70 64Q82 56 94 62Q104 56 118 62', P.shade, 3.4);
  s += line('M72 72q6-6 12 0M98 70q7-6 14 0', INK, 2.8);
  s += fill(ellipse(104, 84, 2, 1.4), '#7a3a32') + fill(ellipse(111, 83, 2, 1.4), '#7a3a32');
  s += line('M94 92q9 5 18-1', INK, 2.2);
  s += fill(ellipse(76, 84, 5, 3.4), '#ff6a6a', 'opacity=".55"') + fill(ellipse(120, 78, 3.4, 2.6), '#ff6a6a', 'opacity=".55"');
  // the folded towel on its head
  const towel = smooth([[48, 24, 1], [96, 16, 1], [100, 30, 1], [52, 36, 1]], true, 0.3);
  s += `<g transform="rotate(-6 74 26)">` + part(towel, '#ffffff', 4.4) + inside(towel, line('M48 28L98 20M50 32L99 25', '#5aa0e6', 1.6) + fill(poly([[40, 32], [110, 24], [110, 40], [40, 40]]), '#e2e8ee')) + '</g>';
  // the hot water up to its chin
  const water = smooth([[4, 106], [30, 102], [56, 106], [84, 102], [112, 106], [140, 102], [142, 117.5, 1], [4, 117.5, 1]]);
  s += part(water, '#7fd0e8', 4.4) + inside(water, line('M10 110q10-4 20 0M60 111q10-4 20 0M104 110q10-4 20 0', '#e6faff', 1.6));
  s += sparkle(136, 12, 3.4) + sparkle(8, 14, 3);
  return end(s);
}

// ---- B: the hot-spring bucket from the card, steaming --------------------------------------------
function bucket() {
  begin();
  const W = { base: '#e8c48a', light: '#f6dcaa', shade: '#c09a5e', deep: '#8a6a3a' };
  const CU = { base: '#c87a3a', light: '#e8a060', shade: '#8e4e1e' };
  let s = steam(52, 18) + steam(76, 14, -1) + steam(98, 18);
  // the ladle sticking out
  s += line('M100 34L138 4', INK, 5.4) + line('M100 34L138 4', W.light, 2.6);
  const body = smooth([[20, 30, 1], [128, 30, 1], [118, 112], [108, 117.5, 1], [40, 117.5, 1], [30, 112]], true, 0.4);
  const top = ellipse(74, 30, 54, 12);
  s += keyline([body, top]);
  let staves = '';
  for (let i = 0; i < 12; i++) staves += `M${26 + i * 9} 34L${33 + i * 7.6} 118`;
  s += fill(body, W.base) + inside(body, line(staves, W.shade, 1.2) + fill(poly([[0, 20], [40, 20], [44, 130], [0, 130]]), W.shade, 'opacity=".7"') + fill(poly([[100, 30], [112, 30], [104, 120], [94, 120]]), W.light, 'opacity=".6"') +
    // copper hoops
    line('M18 46Q74 60 130 46', INK, 6) + line('M18 46Q74 60 130 46', CU.base, 3.4) + line('M28 102Q74 114 120 102', INK, 6) + line('M28 102Q74 114 120 102', CU.base, 3.4) + line('M40 50q20 4 40 4', CU.light, 1.2));
  // the water inside, a yuzu floating
  s += fill(top, W.shade) + fill(ellipse(74, 31, 49, 9), '#8fd6e8') + line('M40 30q14-4 28 0', '#e6faff', 1.6) + part(circle(56, 30, 5), '#ffd23a', 2.4) + fill(circle(54.6, 28.6, 1.4), '#fff6c0');
  s += rim([body, top], poly([[0, 0], [60, 0], [30, 30], [24, 120], [0, 120]]), 2);
  // red-hot cheeks, sweating, grinning through the heat
  s += eyeE({ x0: 46, x1: 64, top: 62, bot: 76, slant: 0.3, nose: 1, px: 59, py: 70, pr: 4.6 });
  s += eyeE({ x0: 78, x1: 98, top: 60, bot: 75, slant: 0.3, nose: -1, px: 92, py: 68, pr: 5 });
  s += expr() === 'normal' ? line('M44 58q9-4 20-1M78 56q10-5 22-2', INK, 2.4) : browsE([44, 58, 64, 57], [78, 56, 100, 54], 2.4);
  s += fill(ellipse(46, 84, 8, 5), '#ff5a3a', 'opacity=".55"') + fill(ellipse(104, 82, 7, 5), '#ff5a3a', 'opacity=".55"');
  const mouth = smooth([[60, 84, 1], [76, 86], [92, 82, 1], [88, 92], [76, 96], [64, 92]]);
  s += mouthE(76, 88, 32, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[58, 81], [94, 80], [94, 86], [58, 87]]), '#fff')) + line(mouth, INK, 1.8));
  s += part(smooth([[108, 56, 1], [112, 64], [109, 68], [104, 64]]), '#8fd6ff', 2);
  return end(s);
}

// ---- C: a tengu — in old Japan, the word for a meteor ------------------------------------------
function tengu() {
  begin();
  const R = { base: '#e0332b', light: '#ff6a55', hi: '#ffb4a2', shade: '#a51d1c' };
  const WH = { base: '#f4f1ea', shade: '#d0c8bc' };
  let s = '';
  // a meteor streaking behind
  s += line('M4 4L40 30', '#ffb627', 5, 'opacity=".5"') + line('M10 6L38 28', '#fff2a8', 2) + part(circle(40, 30, 3.4), '#fff2a8', 2.2);
  // the white mane flying back
  const mane = smooth([[62, 28], [40, 14], [18, 16, 1], [30, 26], [6, 34, 1], [26, 42], [2, 58, 1], [24, 64], [6, 82, 1], [28, 86], [14, 104, 1], [36, 104], [60, 110]]);
  s += part(mane, WH.base) + inside(mane, line('M36 22Q22 28 14 32M34 44Q18 52 8 56M32 70Q20 76 10 82M38 94Q28 98 20 102', WH.shade, 1.6));
  const face = smooth([[30, 96], [28, 66], [36, 44], [56, 30], [84, 28], [106, 36], [118, 52], [120, 72], [114, 92], [98, 106], [72, 110], [46, 106]]);
  s += part(face, R.base);
  s += inside(face, fill(smooth([[10, 30], [46, 40], [40, 80], [50, 120], [10, 120]]), R.shade) + fill(smooth([[70, 32], [104, 38], [114, 52], [90, 48]]), R.light) + line('M76 32q20 0 32 14', R.hi, 2.2));
  s += rim(face, poly([[0, 0], [70, 0], [44, 30], [30, 70], [20, 110], [0, 110]]), 2.2);
  // a white beard under the chin
  const beard = smooth([[40, 100], [58, 106], [76, 104], [96, 104], [112, 96], [114, 108], [104, 117.5, 1], [96, 110], [86, 117.5, 1], [76, 110], [66, 117.5, 1], [56, 110], [46, 116, 1], [38, 108]]);
  s += part(beard, WH.base, 5) + inside(beard, line('M60 108v6M80 108v6M98 106v6', WH.shade, 1.4));
  // the tokin cap on its brow, red pompoms
  const cap = poly([[60, 18], [70, 12], [82, 14], [86, 24], [76, 30], [64, 28]]);
  s += part(cap, '#1c1a22', 4) + line('M62 22L84 18', '#3c3a48', 1.4);
  for (const [x, y] of [[58, 30], [88, 26]]) s += part(circle(x, y, 3.2), '#ff4a4a', 2.2);
  // gold eyes under white brows, a clenched grimace
  s += eye({ x0: 56, x1: 74, top: 54, bot: 68, slant: 0.45, nose: 1, px: 68, py: 62, pr: 4.4, white: '#ffd24a', shadow: '#d4920c' });
  s += eye({ x0: 86, x1: 104, top: 52, bot: 66, slant: 0.45, nose: -1, px: 98, py: 60, pr: 4.6, white: '#ffd24a', shadow: '#d4920c' });
  s += part(smooth([[50, 48, 1], [62, 42], [76, 52, 1], [62, 50]]), WH.base, 3) + part(smooth([[84, 50, 1], [98, 40], [110, 44, 1], [98, 47]]), WH.base, 3);
  const mouth = smooth([[66, 88, 1], [86, 90], [104, 84, 1], [100, 94], [84, 98], [70, 96]]);
  s += fill(mouth, '#fff') + inside(mouth, line('M74 88v10M82 89v10M90 88v10M98 86v8', '#d0c8bc', 1)) + line(mouth, INK, 2);
  // the long, long nose
  const nose = smooth([[96, 56], [122, 48], [142, 44, 1], [138, 54], [118, 64], [98, 70]]);
  s += part(nose, R.base) + inside(nose, fill(poly([[90, 62], [144, 50], [144, 74], [90, 74]]), R.shade) + line('M104 56Q122 50 136 47', R.hi, 2));
  return end(s);
}

export default {
  card: 21, champion: 'צייד המטאורים', en: 'The Meteor Hunter', theme: 'Card: the oldest hotel in the world: samurai and hot spring · Power: a burning meteor dive (Downward, burn)',
  options: [
    { letter: 'A', name: 'Onsen Monkey', draw: monkey,
      blurb: 'The card\'s hot spring with its most famous bather: a Japanese snow monkey up to its chin in steaming water, eyes shut in bliss, a folded towel on its head, snow on its fur. <i>Silhouette: a fluffy ball with a towel on top, in the water.</i>' },
    { letter: 'B', name: 'Hot Bucket', draw: fitted(bucket, [1.02, 1.01, 0, 0]), marks: { eyes: [[55, 69], [88, 67.5]], nose: [78, 79] },
      blurb: 'The card\'s wooden bath bucket, red-cheeked and sweating from the heat (the burn): copper hoops, hot water with a yuzu floating in it, a ladle sticking out, steam rising like hair. <i>Silhouette: a steaming tub.</i>' },
    { letter: 'C', name: 'Tengu', draw: tengu,
      blurb: 'The mountain demon of the card\'s Japan, and the right one for a meteor hunter: "tengu" was the old Japanese name for a meteor. A red face with an endless nose, a white mane and beard, gold eyes, a tiny black cap, a meteor streaking past. <i>Silhouette: a long nose out of a white mane.</i>' },
  ],
};
