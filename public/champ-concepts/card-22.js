// Card #22 — הגנב (The Thief). Card: Shoval holding the world's smallest woman in the palm of
// his hand inside a golden swirl ("a day of fun for the smallest woman in the world"). Power: a
// curse that drains the hit player's power (Ailment: shock).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const bolt = (x, y, k = 1, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})">` + part(poly([[x, y], [x + 6 * k, y - 10 * k], [x + 4 * k, y - 3 * k], [x + 12 * k, y - 6 * k], [x + 4 * k, y + 8 * k], [x + 6 * k, y + 1 * k]]), '#ffe14a', 2.4) + '</g>';

// ---- A: a raccoon bandit with stolen lightning in its teeth -----------------------------------
function raccoon() {
  begin();
  const F = { base: '#9aa0a8', light: '#c6cad0', shade: '#6e747e', deep: '#4a4f58' };
  const WH = '#f4f4f2', BK = '#26262e';
  let s = '';
  const earB = smooth([[30, 50], [26, 26], [34, 14, 1], [48, 24], [54, 40]]), earF = smooth([[84, 36], [94, 18], [108, 12, 1], [112, 28], [108, 46]]);
  for (const d of [earB, earF]) s += part(d, F.base) + inside(d, fill(smooth([[30, 30], [36, 18], [46, 28], [44, 42]]), BK) + fill(smooth([[94, 26], [106, 18], [108, 30], [100, 40]]), BK));
  const head = smooth([[22, 100], [14, 90, 1], [20, 84], [16, 72, 1], [22, 64], [26, 50], [40, 34], [64, 26], [88, 26], [108, 34], [120, 52], [130, 68], [134, 80, 1], [128, 90], [124, 102], [116, 110], [96, 117.5], [56, 117.5], [32, 112]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 80], [44, 130], [0, 130]]), F.shade) + fill(smooth([[60, 36], [100, 38], [112, 50], [84, 46]]), F.light) +
    // white cheeks and muzzle, white brows, and the black mask
    fill(smooth([[10, 78], [34, 70], [44, 90], [36, 110], [10, 110]]), WH) + fill(smooth([[90, 72], [124, 66], [142, 78], [130, 96], [104, 100], [92, 90]]), WH) +
    fill(smooth([[40, 54], [60, 48], [76, 52], [94, 46], [118, 50], [116, 56], [94, 54], [76, 58], [58, 56], [42, 60]]), WH) +
    fill(smooth([[32, 66], [54, 56], [76, 60], [96, 54], [120, 58], [126, 68], [112, 76], [92, 72], [78, 76], [60, 78], [38, 76]]), BK) +
    fill(smooth([[30, 100], [80, 108], [130, 100], [130, 130], [30, 130]]), F.shade, 'opacity=".6"'));
  s += rim(head, poly([[0, 0], [70, 0], [40, 40], [20, 80], [0, 90]]), 2.2);
  // sly eyes inside the mask
  s += eyeE({ x0: 52, x1: 68, top: 62, bot: 73, slant: 0.5, nose: 1, px: 64, py: 69, pr: 3.8, r: 2.4, ink: '#ffffff' });
  s += eyeE({ x0: 86, x1: 104, top: 60, bot: 71, slant: 0.5, nose: -1, px: 99, py: 67, pr: 4, r: 2.4, ink: '#ffffff' });
  s += part(ellipse(132, 79, 4.4, 3.4), BK, 2.4) + fill(circle(131, 77.6, 1.2), '#8a8f9a');
  // the stolen bolt clamped in a sly grin
  s += bolt(112, 94, 1.6, -8);
  s += mouthE(114, 93, 28, line('M100 92Q114 98 128 90', INK, 2.4) + line('M100 92l-3-2', INK, 1.8));
  s += sparkle(130, 34, 3.4, '#ffe14a');
  return end(s);
}

// ---- B: a battery fat on everyone else's power -------------------------------------------------
function battery() {
  begin();
  const V = { base: '#6a3fd0', light: '#9a74ff', shade: '#4a2a9a', deep: '#301a6a' };
  const SI = { base: '#c9d2da', light: '#f1f5f8', shade: '#8a96a2' };
  let s = '';
  const nub = smooth([[62, 10, 1], [86, 10, 1], [86, 24, 1], [62, 24, 1]], true, 0.4);
  s += part(nub, SI.base) + fill(ellipse(74, 11, 12, 3), SI.light) + `<text x="68" y="22" font-family="Arial Black, Arial" font-weight="900" font-size="9" fill="${SI.shade}">+</text>`;
  const body = smooth([[34, 26, 1], [114, 26, 1], [114, 112], [108, 117.5, 1], [40, 117.5, 1], [34, 112]], true, 0.4);
  s += part(body, V.base);
  s += inside(body, fill(poly([[0, 20], [46, 20], [46, 130], [0, 130]]), V.shade) + fill(poly([[96, 20], [104, 20], [104, 130], [96, 130]]), V.light, 'opacity=".6"') +
    fill(ellipse(74, 26, 40, 8), SI.base) + fill(ellipse(74, 27, 34, 5), SI.light) + line('M34 34Q74 42 114 34', SI.shade, 2) +
    // a lime bolt down its wrap
    fill(poly([[40, 104], [52, 84], [46, 84], [58, 64], [52, 64], [62, 48], [56, 70], [62, 70], [50, 92], [56, 92]]), '#9cf54a', 'opacity=".9"'));
  s += rim(body, poly([[0, 0], [60, 0], [44, 30], [40, 120], [0, 120]]), 2);
  // the charge window, full and overflowing
  const win = smooth([[96, 44, 1], [108, 44, 1], [108, 104, 1], [96, 104, 1]], true, 0.4);
  s += part(win, '#16102a', 3) + [0, 1, 2, 3, 4].map((i) => fill(poly([[98, 94 - i * 11], [106, 94 - i * 11], [106, 102 - i * 11], [98, 102 - i * 11]]), i > 3 ? '#ffe14a' : '#5cff7a')).join('');
  // a smug, overcharged face
  s += eye({ x0: 50, x1: 66, top: 56, bot: 68, slant: 0.42, nose: 1, px: 62, py: 63, pr: 4 });
  s += eye({ x0: 72, x1: 90, top: 54, bot: 67, slant: 0.42, nose: -1, px: 85, py: 61, pr: 4.4 });
  s += line('M48 50L68 54M72 52L92 46', INK, 3);
  s += line('M58 80Q74 88 90 78', INK, 2.4) + line('M90 78l3-3', INK, 1.8);
  // power crackling off it
  s += bolt(122, 40, 1.2, 20) + bolt(20, 70, -1.2, -10) + bolt(128, 92, 1, -20) + line('M118 60l8-4M20 50l-8-4', '#9ff0ff', 1.6);
  return end(s);
}

// ---- C: an ant making off with a sugar cube many times its size ------------------------------------
function ant() {
  begin();
  const A = { base: '#c2502e', light: '#e07a52', hi: '#ffb08a', shade: '#8a3218', deep: '#5a1e0c' };
  let s = '';
  // antennae, elbowed, out to the sides
  s += line('M54 40L36 26L14 30', INK, 5) + line('M54 40L36 26L14 30', A.shade, 2.6) + part(circle(13, 30, 3.4), A.shade, 2.4);
  s += line('M98 38L114 22L136 24', INK, 5) + line('M98 38L114 22L136 24', A.base, 2.6) + part(circle(137, 24, 3.4), A.base, 2.4);
  // the stolen sugar cube balanced on its head
  const cTop = poly([[48, 10], [86, 4], [100, 12], [62, 18]]), cFront = poly([[62, 18], [100, 12], [100, 36], [62, 42]]), cSide = poly([[48, 10], [62, 18], [62, 42], [48, 34]]);
  s += keyline([cTop, cFront, cSide], 5) + fill(cTop, '#ffffff') + fill(cFront, '#f1f0ea') + fill(cSide, '#d8d6cc');
  s += inside([cTop, cFront, cSide], [[70, 24], [84, 20], [92, 30], [76, 34], [56, 26], [66, 10]].map(([x, y]) => fill(poly([[x, y], [x + 2, y + 1], [x + 1, y + 3], [x - 1, y + 2]]), '#c9c6ba')).join(''));
  s += line(cTop, INK, 1) + line(cFront, INK, 1) + sparkle(96, 6, 3.6);
  // the head
  const head = smooth([[30, 92], [24, 66], [34, 46], [56, 36], [86, 36], [108, 44], [120, 62], [118, 86], [106, 104], [84, 116.5], [56, 116.5], [38, 106]]);
  s += part(head, A.base);
  s += inside(head, fill(smooth([[0, 30], [42, 40], [36, 80], [44, 130], [0, 130]]), A.shade) + fill(smooth([[64, 38], [100, 42], [112, 56], [86, 52]]), A.light) + line('M70 40q22 0 36 12', A.hi, 2.4) +
    fill(smooth([[30, 104], [80, 110], [130, 100], [130, 130], [30, 130]]), A.shade));
  s += rim(head, poly([[0, 0], [70, 0], [40, 40], [24, 80], [0, 90]]), 2.2);
  // big glossy insect eyes
  for (const [cx, cy, rx, ry] of [[58, 66, 10, 12], [94, 62, 12, 14]]) {
    const d = ellipse(cx, cy, rx, ry, 0.15);
    s += part(d, '#1c1216', 3) + inside(d, fill(ellipse(cx + rx * 0.3, cy - ry * 0.35, rx * 0.36, ry * 0.26, 0.4), '#ffffff') + fill(circle(cx - rx * 0.3, cy + ry * 0.4, rx * 0.14), '#8a7a8a'));
  }
  s += line('M46 52L66 56M84 50L106 44', INK, 2.8);
  // mandibles in a sneaky grin
  s += part(smooth([[86, 96], [100, 92], [112, 100, 1], [102, 102], [92, 104]]), A.deep, 3) + part(smooth([[108, 88], [122, 86], [128, 96, 1], [120, 96], [110, 98]]), A.deep, 3);
  s += line('M78 94Q92 100 104 94', INK, 2);
  s += sparkle(132, 104, 3.4) + sparkle(14, 100, 3);
  return end(s);
}

export default {
  card: 22, champion: 'הגנב', en: 'The Thief', theme: 'Card: the smallest woman in the world, in a golden swirl · Power: drains your power (shock)',
  options: [
    { letter: 'A', name: 'Raccoon Bandit', draw: fitted(raccoon, [1, 1.03, 0, -6]), marks: { eyes: [[60, 67.5], [95, 65.5]], nose: [126, 80] },
      blurb: 'The born thief, mask and all: a raccoon with a sly squint, white cheeks and brows, making off with a stolen lightning bolt clamped in its teeth: your power. <i>Silhouette: two ears, a pointed snout, a mask across the eyes.</i>' },
    { letter: 'B', name: 'Power Thief', draw: battery,
      blurb: 'Where your drained power goes: a battery fat and smug on it, its charge window full to overflowing, a lime bolt down its violet wrap, power crackling off it. <i>Silhouette: a can with a nub on top.</i>' },
    { letter: 'C', name: 'Sugar Ant', draw: ant,
      blurb: 'The tiniest thief there is, for the card\'s tiny woman: an ant marching off with a stolen sugar cube many times its size balanced on its head, glossy insect eyes, elbowed antennae, a sneaky grin. <i>Silhouette: a round head under a cube, antennae out.</i>' },
  ],
};
