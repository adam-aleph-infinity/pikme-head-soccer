// Card #16 — מקפיץ האבנים (The Stone Skipper). Card: Ori eating only green for 24 hours at a
// Japanese convenience store: green drinks, green food, neon green. Power: a stone skipped
// along the turf, low and counter-only (Ground).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: a kappa, the river imp who skips stones and lives on cucumbers -----------------------
function kappa() {
  begin();
  const K = { base: '#4fb06a', light: '#86d890', hi: '#c8f2c8', shade: '#2f7a48', deep: '#1e5532' };
  const Y = { base: '#ffc23a', shade: '#e08a12', light: '#ffe48a' };
  let s = '';
  const head = smooth([[22, 96], [18, 70], [28, 48], [50, 36], [80, 34], [106, 40], [122, 54], [128, 72], [126, 92], [114, 108], [80, 116.5], [44, 114], [28, 108]]);
  s += part(head, K.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 80], [44, 130], [0, 130]]), K.shade) + fill(smooth([[30, 100], [80, 106], [130, 96], [130, 130], [30, 130]]), K.shade) +
    fill(smooth([[84, 60], [116, 58], [124, 76], [104, 74]]), K.light) +
    [[40, 84], [48, 92], [36, 96], [56, 100]].map(([x, y]) => fill(circle(x, y, 1.8), K.deep)).join(''));
  s += rim(head, poly([[0, 30], [60, 30], [30, 60], [16, 100], [0, 110]]), 2.2);
  // the shaggy fringe round the dish
  const hair = smooth([[18, 66], [22, 44], [40, 28], [76, 22], [110, 28], [128, 46], [130, 62, 1], [122, 54], [118, 62, 1], [110, 50], [102, 58, 1], [94, 46], [86, 54, 1], [76, 44], [66, 54, 1], [58, 44], [48, 56, 1], [40, 48], [30, 62, 1], [28, 52]]);
  s += part(hair, '#1f3a3a') + inside(hair, line('M30 40q20-14 46-14M84 26q24 2 38 18', '#3e6464', 2));
  // the dish of water on its crown
  s += part(ellipse(76, 26, 30, 9), '#f1e6c8', 4.4) + fill(ellipse(76, 24, 25, 6.4), '#bfe8ff') + line('M62 22q8-3 16-1', '#ffffff', 1.6) + fill(ellipse(76, 31, 26, 3.4), '#d6c8a2', 'opacity=".6"');
  for (const [x, y] of [[44, 34], [110, 34]]) s += part(smooth([[x, y, 1], [x + 2.6, y + 5], [x, y + 7.4], [x - 2.6, y + 5]]), '#bfe8ff', 2);
  // round mischievous eyes
  s += eye({ x0: 56, x1: 74, top: 62, bot: 78, slant: 0.22, nose: 1, px: 68, py: 71, pr: 5.6 });
  s += eye({ x0: 88, x1: 108, top: 59, bot: 76, slant: 0.22, nose: -1, px: 102, py: 68, pr: 6 });
  // the beak, grinning round a cucumber
  s += line('M120 88L142 100', INK, 9.6) + line('M120 88L142 100', '#3e8a30', 6.4) + line('M124 88L140 97', '#8fdc5a', 1.6) + part(ellipse(142, 100, 2.4, 3.4, 0.5), '#e9f7c8', 2);
  const beak = smooth([[88, 80], [118, 76], [134, 84, 1], [120, 94], [92, 96]]);
  s += part(beak, Y.base) + inside(beak, fill(poly([[80, 88], [140, 84], [140, 100], [80, 100]]), Y.shade) + line('M96 82q14-3 26-1', Y.light, 1.6)) + line('M92 89Q112 91 132 85', INK, 2);
  s += sparkle(136, 26, 3.6) + sparkle(10, 40, 3);
  return end(s);
}

// ---- B: a konbini onigiri, a bite out of it --------------------------------------------------
function onigiri() {
  begin();
  const RC = { base: '#fbfaf6', shade: '#e4e2da', deep: '#c9c6ba' };
  const tri = smooth([[74, 6], [86, 14], [112, 58], [136, 100], [132, 114], [108, 116.5], [40, 116.5], [16, 114], [12, 100], [36, 58], [62, 14]]);
  const bite = smooth([[84, 10], [98, 16], [104, 30], [94, 36], [86, 30], [80, 20]]);
  let s = keyline(tri) + fill(tri, RC.base);
  let grains = '';
  for (let i = 0; i < 40; i++) { const x = 20 + ((i * 37) % 104), y = 20 + ((i * 53) % 74); grains += ellipse(x, y, 2.4, 1.2, ((i * 47) % 180) / 57); }
  s += inside(tri, fill(grains, RC.deep, 'opacity=".55"') + fill(smooth([[0, 40], [40, 50], [30, 90], [40, 130], [0, 130]]), RC.shade, 'opacity=".9"'));
  // the bite, showing the salmon filling
  s += fill(bite, '#ff9a6a') + inside(bite, fill(circle(96, 30, 6), '#ffb894') + line('M86 22l6 4M92 18l4 6', '#e8774a', 1.2)) + line('M84 10Q80 20 86 30Q94 36 104 30', INK, 2);
  s += line('M84 12q4-2 6 0M98 16q3 2 3 6', INK, 1.4);
  // the nori wrap, with its convenience-store price sticker in green
  const nori = smooth([[24, 84, 1], [124, 84, 1], [132, 114], [108, 116.5], [40, 116.5], [16, 114]], true, 0.4);
  s += fill(nori, '#1f2a22') + inside(nori, line('M30 92h80M28 102h90', '#3c4a3c', 1.2)) + line(nori, INK, 1.6);
  s += part(smooth([[94, 96, 1], [118, 94, 1], [119, 104, 1], [95, 106, 1]], true, 0.3), '#3fe06a', 2.4) + `<text x="98" y="103" font-family="Arial Black, Arial" font-weight="900" font-size="7" fill="#0e5a2e">¥120</text>`;
  s += rim(tri, poly([[0, 0], [70, 0], [50, 30], [24, 80], [10, 110], [0, 110]]), 2.2);
  // a delighted face (the card's laugh)
  s += eye({ x0: 50, x1: 66, top: 52, bot: 66, slant: 0.14, nose: 1, px: 61, py: 60, pr: 4.6 });
  s += eye({ x0: 78, x1: 96, top: 50, bot: 65, slant: 0.14, nose: -1, px: 91, py: 58, pr: 5 });
  s += line('M48 46q8-5 18-2M78 44q9-5 20-1', INK, 2.4);
  const mouth = smooth([[62, 70, 1], [76, 72], [92, 69, 1], [88, 78], [76, 82], [66, 78]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(77, 82, 8, 4), '#ff7a96') + fill(poly([[60, 68], [94, 67], [94, 72], [60, 73]]), '#fff')) + line(mouth, INK, 1.8);
  s += fill(ellipse(46, 72, 5, 3.4), '#ffb3c0') + fill(ellipse(100, 70, 4, 3), '#ffb3c0');
  s += sparkle(124, 30, 4) + sparkle(18, 30, 3);
  return end(s);
}

// ---- C: a Japanese melon cream soda: the green drink from the card -------------------------
function soda() {
  begin();
  const GR = { base: '#3fe06a', shade: '#22a84a', deep: '#167a36', light: '#9cf5a8' };
  let s = '';
  // the long soda spoon behind
  s += line('M100 50L136 6', INK, 5) + line('M100 50L136 6', '#d8dee6', 2.6) + part(ellipse(137, 5, 4, 2.4, -0.9), '#d8dee6', 2.4);
  const glass = smooth([[20, 42, 1], [124, 42, 1], [116, 112], [108, 116.5, 1], [36, 116.5, 1], [28, 112]], true, 0.5);
  s += keyline(glass);
  s += fill(glass, GR.base);
  s += inside(glass, fill(smooth([[0, 40], [36, 44], [34, 120], [0, 120]]), GR.shade) + fill(smooth([[30, 104], [80, 108], [130, 100], [130, 130], [30, 130]]), GR.deep) +
    [[40, 96, 2.4], [48, 84, 1.6], [104, 100, 2], [110, 86, 1.4], [36, 70, 1.8], [118, 66, 1.6]].map(([x, y, r]) => line(circle(x, y, r), GR.light, 1)).join('') +
    // ice cubes at the top, the glass's own shine
    fill(smooth([[30, 46, 1], [48, 44, 1], [50, 58, 1], [32, 60, 1]], true, 0.5), 'rgba(230,255,240,.7)') + fill(smooth([[96, 46, 1], [114, 46, 1], [112, 60, 1], [94, 58, 1]], true, 0.5), 'rgba(230,255,240,.7)') +
    fill(poly([[28, 46], [36, 46], [42, 112], [36, 112]]), 'rgba(255,255,255,.45)') + fill(poly([[110, 50], [114, 50], [110, 108], [106, 108]]), 'rgba(255,255,255,.35)'));
  s += line('M20 42H124', '#e6fff0', 1.6);
  // the scoop of vanilla ice cream on top, dripping, a cherry on it
  const scoop = smooth([[30, 46], [32, 30], [46, 18], [72, 13], [98, 18], [112, 30], [116, 46], [108, 52], [104, 60], [98, 50], [86, 54], [80, 64], [74, 52], [56, 54], [48, 62], [44, 52]]);
  s += part(scoop, '#fff6e0') + inside(scoop, fill(smooth([[20, 30], [50, 34], [44, 70], [20, 70]]), '#f1dcb4') + line('M58 20q20-6 36 2', '#ffffff', 2.6));
  s += line('M76 12Q78 2 88 0', INK, 3.4) + line('M76 12Q78 2 88 0', '#5f8a26', 1.6) + part(circle(74, 12, 7), '#e5262e', 4) + fill(circle(71.6, 9.6, 2), '#ff9a9a');
  s += rim([glass, scoop], poly([[0, 0], [60, 0], [34, 30], [24, 80], [20, 120], [0, 120]]), 2);
  // the face, through the glass
  s += eyeE({ x0: 46, x1: 64, top: 68, bot: 82, slant: 0.18, nose: 1, px: 58, py: 76, pr: 4.8, white: '#f2fff4' });
  s += eyeE({ x0: 78, x1: 98, top: 66, bot: 81, slant: 0.18, nose: -1, px: 92, py: 74, pr: 5.2, white: '#f2fff4' });
  s += expr() === 'normal' ? line('M44 62q9-5 20-1M78 60q10-5 22-1', INK, 2.4) : browsE([44, 62, 64, 61], [78, 60, 100, 59], 2.4);
  const mouth = smooth([[62, 90, 1], [78, 92], [94, 88, 1], [90, 98], [78, 102], [66, 98]]);
  s += mouthE(78, 94, 32, fill(mouth, '#0e3a1a') + inside(mouth, fill(poly([[60, 86], [96, 85], [96, 91], [60, 92]]), '#fff') + fill(ellipse(78, 102, 8, 4), '#ff7a96')) + line(mouth, INK, 1.8));
  s += sparkle(134, 40, 3.6) + sparkle(12, 28, 3);
  return end(s);
}

export default {
  card: 16, champion: 'מקפיץ האבנים', en: 'The Stone Skipper', theme: 'Card: 24 hours of green food at a Japanese konbini · Power: a skipped stone along the turf (Ground)',
  options: [
    { letter: 'A', name: 'Kappa', draw: kappa,
      blurb: 'The green river imp of Japanese legend, who skips stones down the river and lives on cucumbers: a dish of water on its crown, a shaggy fringe round it, a yellow beak chomping a cucumber. <i>Silhouette: a round head under a dish and a fringe.</i>' },
    { letter: 'B', name: 'Onigiri', draw: onigiri,
      blurb: 'The konbini rice ball, the card\'s 24-hour diet: a triangle of rice with a bite out of the corner showing the salmon inside, a nori wrap with a green price sticker, and Ori\'s laugh. <i>Silhouette: a rounded triangle with a bite.</i>' },
    { letter: 'C', name: 'Melon Float', draw: fitted(soda, [1.03, 1, 0, 0]), marks: { eyes: [[55, 75], [88, 73.5]], nose: [76, 85] },
      blurb: 'The card\'s green drink, Japan\'s melon cream soda: a glass of fizzing green with a face through it, ice cubes, a scoop of vanilla dripping down, a cherry on top and a long soda spoon. <i>Silhouette: a tumbler under a scoop.</i>' },
  ],
};
