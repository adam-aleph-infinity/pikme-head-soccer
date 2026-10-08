// Card #15 — מרים המשקולות (The Weightlifter). Card: Paz as Santa, arms full of presents ("the
// day I'll be the best friend in Japan"). Power: a heavy weight that drops in at a slant and
// leaves whoever it hits heavy (Downward, shock).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the present itself — suspiciously heavy ----------------------------------------------
function gift() {
  begin();
  const E = { base: '#22a35a', shade: '#157a40', light: '#4fd07f', deep: '#0e5a2e', dot: '#e9fff0' };
  const RB = { base: '#e5262e', shade: '#a8141a', light: '#ff6a6a' };
  let s = '';
  const front = poly([[48, 46], [128, 46], [128, 116.5], [48, 116.5]]), side = poly([[20, 40], [48, 46], [48, 116.5], [20, 110]]);
  const lidF = poly([[44, 30], [132, 30], [132, 48], [44, 48]]), lidS = poly([[16, 24], [44, 30], [44, 48], [16, 42]]), lidT = poly([[16, 24], [104, 24], [132, 30], [44, 30]]);
  const box = [front, side, lidF, lidS, lidT];
  s += keyline(box);
  let dots = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) dots += circle(18 + c * 14 + (r % 2) * 7, 28 + r * 12, 2);
  s += fill(side, E.shade) + fill(front, E.base) + fill(lidS, E.deep) + fill(lidF, E.light) + fill(lidT, E.light);
  s += inside(box, fill(dots, E.dot, 'opacity=".55"'));
  s += inside(front, fill(poly([[48, 46], [128, 46], [128, 52], [48, 52]]), E.deep) + fill(poly([[100, 50], [128, 50], [128, 117], [120, 117]]), E.shade));
  // the ribbon round it, the bow on top, a tag on a string
  s += inside(box, fill(poly([[82, 24], [94, 24], [94, 120], [82, 120]]), RB.base) + fill(poly([[90, 24], [94, 24], [94, 120], [90, 120]]), RB.shade) +
    fill(poly([[16, 34], [44, 40], [44, 46], [16, 40]]), RB.shade) + fill(poly([[54, 24], [64, 24], [94, 30], [82, 30]]), RB.base) + line('M18 40l26 6M44 40l0 6', INK, 1));
  for (const d of box) s += line(d, INK, 1.4);
  const loopL = smooth([[86, 22], [70, 6], [56, 4], [52, 14], [64, 22], [84, 26]]), loopR = smooth([[90, 22], [104, 4], [120, 2], [124, 12], [110, 22], [92, 26]]);
  const tailL = smooth([[84, 26], [72, 36], [66, 44, 1], [76, 40], [86, 30]]), tailR = smooth([[90, 26], [104, 36], [112, 42, 1], [100, 40], [88, 30]]);
  for (const d of [tailL, tailR, loopL, loopR]) s += part(d, RB.base, 5) + inside(d, fill(poly([[40, 14], [140, 10], [140, 50], [40, 50]]), RB.shade) + line(d, RB.light, 1.4, 'stroke-dasharray="10 60"'));
  s += part(ellipse(88, 23, 7, 5.6), RB.base, 4.4) + line('M84 21q4-2 8 0', RB.light, 1.4);
  s += line('M60 10Q40 14 30 28', INK, 1.6) + part(poly([[22, 26, 1], [34, 24], [38, 34], [26, 38]]), '#f6ead2', 2.6) + fill(circle(31, 28, 1.4), INK);
  s += `<text x="25.5" y="35.5" font-family="Arial Black, Arial" font-weight="900" font-size="4.6" fill="#a8141a" transform="rotate(-12 30 32)">99kg</text>`;
  s += rim(box, poly([[0, 0], [100, 0], [40, 26], [18, 60], [16, 110], [0, 110]]), 2);
  // a face bursting to be opened, the ribbon running down its middle
  s += eyeE({ x0: 56, x1: 76, top: 62, bot: 78, slant: 0.18, nose: 1, px: 70, py: 70, pr: 5.4 });
  s += eyeE({ x0: 100, x1: 122, top: 60, bot: 77, slant: 0.18, nose: -1, px: 115, py: 68, pr: 5.8 });
  s += expr() === 'normal' ? line('M54 56q10-6 22-2M100 54q12-6 24-1', INK, 2.8) : browsE([54, 56, 76, 54], [100, 54, 124, 53], 2.8);
  const mouth = smooth([[64, 90, 1], [90, 92], [120, 88, 1], [114, 104], [90, 110], [70, 104]]);
  s += mouthE(92, 98, 50, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[60, 86], [124, 84], [124, 94], [60, 96]]), '#fff') + fill(ellipse(92, 110, 14, 6), '#ff7a96')) + line(mouth, INK, 2.2));
  s += fill(ellipse(60, 92, 5, 3.4), '#ff9cbc') + fill(ellipse(124, 88, 4, 3), '#ff9cbc');
  s += sparkle(134, 16, 4) + sparkle(8, 70, 3.4) + sparkle(138, 100, 3);
  return end(s);
}

// ---- B: Iron Claus — a kettlebell with Santa's beard ------------------------------------------
function kettlebell() {
  begin();
  const IR = { base: '#3a3d46', light: '#5a5e6a', hi: '#9aa0ad', shade: '#22242a' };
  const WH = { base: '#f7f4f0', shade: '#d9d2c8', deep: '#b9b0a2' };
  const RD = { base: '#e5262e', shade: '#a8141a', light: '#ff6a6a' };
  let s = '';
  // the handle, then the hat flopped over it
  const handle = 'M42 60C40 26 56 12 76 12S112 26 110 60';
  s += line(handle, INK, 20) + line(handle, IR.base, 13.6) + line('M48 44C50 26 62 18 76 18', IR.hi, 2.4);
  const hat = smooth([[50, 22], [62, 6], [80, 2], [96, 8], [102, 22], [90, 16], [74, 12], [50, 24], [34, 20], [22, 22], [16, 12, 1], [30, 12], [46, 14]]);
  s += part(hat, RD.base) + inside(hat, fill(poly([[0, 0], [60, 0], [60, 30], [0, 30]]), RD.shade) + line('M66 8q14-4 26 4', RD.light, 2));
  s += part(smooth([[46, 22], [60, 14], [80, 12], [100, 16], [106, 26], [96, 30], [76, 26], [56, 30], [44, 30]]), WH.base, 5) + part(circle(15, 15, 7.4), WH.base, 5);
  // the iron bell: round, flat-bottomed, "32" cast in its side
  const bell = smooth([[34, 70], [44, 50], [62, 42], [90, 42], [110, 50], [120, 70], [122, 94], [114, 110], [96, 116.5], [56, 116.5], [38, 110], [30, 94]]);
  s += part(bell, IR.base);
  s += inside(bell, fill(smooth([[20, 40], [50, 46], [44, 80], [50, 130], [20, 130]]), IR.shade) + fill(smooth([[78, 44], [108, 48], [118, 66], [100, 62], [86, 52]]), IR.light) + line('M84 46q22 2 30 18', IR.hi, 2.4));
  s += `<text x="38" y="76" font-family="Arial Black, Arial" font-weight="900" font-size="11" fill="${IR.light}" transform="rotate(-8 44 72)">32</text>`;
  s += rim(bell, poly([[0, 30], [70, 30], [44, 50], [30, 80], [26, 116], [0, 116]]), 2.2);
  // stern eyes under white bushy brows, a red nose
  s += eye({ x0: 60, x1: 78, top: 60, bot: 72, slant: 0.4, nose: 1, px: 72, py: 67, pr: 4.4 });
  s += eye({ x0: 92, x1: 112, top: 58, bot: 71, slant: 0.4, nose: -1, px: 106, py: 65, pr: 4.8 });
  s += part(smooth([[56, 56], [66, 50], [80, 58, 1], [66, 58]]), WH.base, 3.2) + part(smooth([[90, 58, 1], [104, 48], [116, 52], [104, 56]]), WH.base, 3.2);
  // the beard: a cloud from cheek to cheek and over the chin
  const beard = smooth([[40, 86], [52, 80], [66, 86], [84, 82], [100, 84], [114, 80], [126, 84], [128, 98], [122, 110], [110, 117, 1], [100, 110], [88, 119, 1], [76, 110], [64, 119, 1], [54, 110], [42, 114, 1], [34, 102]]);
  s += part(beard, WH.base) + inside(beard, fill(smooth([[30, 100], [80, 108], [130, 100], [130, 130], [30, 130]]), WH.shade) + line('M60 96q4 6 2 12M84 98q4 6 2 12M108 96q4 6 2 12', WH.deep, 1.4));
  const mus = smooth([[70, 86], [82, 80], [94, 84], [106, 80], [118, 84], [112, 92], [96, 90], [86, 94], [74, 92]]);
  s += part(mus, WH.base, 3.6) + inside(mus, fill(poly([[60, 89], [130, 89], [130, 100], [60, 100]]), WH.shade));
  s += part(circle(96, 78, 5.6), RD.base, 3.2) + fill(circle(94.6, 76.4, 1.6), RD.light);
  s += sparkle(132, 30, 4) + sparkle(12, 60, 3);
  return end(s);
}

// ---- C: a reindeer pressing a barbell on its antlers --------------------------------------
function reindeer() {
  begin();
  const F = { base: '#9a6232', light: '#c58a50', hi: '#e2b07a', shade: '#6e4120', deep: '#4e2c14' };
  const MZ = { base: '#ecd2ae', shade: '#cfae84' };
  const AN = { base: '#e3c48a', shade: '#b08a50', light: '#f6e2b4' };
  let s = '';
  // the barbell, resting in the antlers' top forks
  s += line('M8 15L136 9', INK, 6) + line('M8 15L136 9', '#c9d2da', 3) + line('M8 14L136 8', '#f1f5f8', 0.8);
  for (const [x, y] of [[8, 15], [136, 9]]) s += part(smooth([[x - 5, y - 13, 1], [x + 5, y - 13, 1], [x + 5, y + 13, 1], [x - 5, y + 13, 1]], true, 0.3), '#2f3038', 4.4) + line(`M${x - 1} ${y - 10}v20`, '#5a5e6a', 1.6);
  // antlers, branching
  const antB = smooth([[46, 46], [40, 30], [30, 14], [26, 10, 1], [34, 12], [40, 24], [44, 18], [42, 8, 1], [48, 12], [50, 28], [56, 44]]);
  const antF = smooth([[86, 42], [96, 26], [104, 12], [108, 6, 1], [112, 12], [104, 26], [114, 22], [122, 12, 1], [120, 22], [106, 34], [96, 46]]);
  s += part(smooth([[30, 22], [18, 16, 1], [26, 28]]), AN.shade, 4.4);
  for (const d of [antB, antF]) s += part(d, AN.base, 5.4) + inside(d, fill(poly([[0, 30], [144, 30], [144, 60], [0, 60]]), AN.shade) + line(d, AN.light, 1.2, 'stroke-dasharray="8 40"'));
  // ears out to the sides
  const earB = smooth([[38, 60], [18, 52], [6, 56, 1], [18, 64], [36, 68]]), earF = smooth([[110, 54], [126, 44], [138, 44, 1], [128, 54], [114, 62]]);
  s += part(earB, F.shade) + fill(smooth([[30, 61], [16, 57], [12, 58], [18, 62], [30, 64]]), '#e2a0a0');
  s += part(earF, F.base) + fill(smooth([[116, 54], [128, 48], [132, 48], [126, 54], [118, 58]]), '#e2a0a0');
  // the head, the long muzzle forward, the red nose
  const head = smooth([[30, 96], [26, 72], [36, 52], [58, 42], [86, 42], [106, 48], [118, 62], [132, 72], [138, 88], [132, 102], [116, 111], [86, 116.5], [54, 116], [36, 110]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[10, 40], [44, 50], [40, 80], [50, 130], [10, 130]]), F.shade) + fill(smooth([[80, 78], [112, 72], [140, 84], [140, 130], [80, 130]]), MZ.base) +
    fill(smooth([[80, 104], [140, 98], [140, 130], [80, 130]]), MZ.shade) + fill(smooth([[70, 44], [104, 48], [114, 60], [90, 58]]), F.light) + line('M76 46q22 0 34 12', F.hi, 2.2) +
    fill(smooth([[40, 92], [76, 100], [96, 116], [40, 120]]), F.shade));
  s += rim(head, poly([[0, 0], [70, 0], [44, 44], [28, 70], [24, 110], [0, 110]]), 2.2);
  s += fill(circle(138, 84, 13), 'rgba(255,90,90,.25)') + part(circle(134, 84, 8.6), '#e5262e', 4) + fill(circle(131.5, 81, 2.6), '#ff9a9a');
  // straining but grinning: brows down, eyes wide, gritted teeth
  s += eye({ x0: 56, x1: 74, top: 60, bot: 74, slant: 0.32, nose: 1, px: 68, py: 68, pr: 4.8 });
  s += eye({ x0: 86, x1: 106, top: 56, bot: 72, slant: 0.32, nose: -1, px: 100, py: 65, pr: 5.2 });
  s += line('M52 54L76 60M84 56L108 48', INK, 3.4);
  const mouth = smooth([[92, 96, 1], [112, 98], [128, 96, 1], [124, 104], [108, 106], [96, 104]]);
  s += fill(mouth, '#fff') + inside(mouth, line('M100 96v10M108 96v10M116 96v10M122 96v8', '#b9b4c4', 1)) + line(mouth, INK, 2);
  s += part(smooth([[46, 40, 1], [50, 48], [47, 52], [42, 48]]), '#8fd6ff', 2) + part(smooth([[116, 34, 1], [120, 42], [117, 46], [112, 42]]), '#8fd6ff', 2);
  return end(s);
}

export default {
  card: 15, champion: 'מרים המשקולות', en: 'The Weightlifter', theme: 'Card: Santa with an armful of presents · Power: a heavy weight dropping in (Downward)',
  options: [
    { letter: 'A', name: 'Heavy Present', draw: gift, marks: { eyes: [[66, 70], [111, 68.5]], nose: [95, 84] },
      blurb: 'One of the card\'s presents, and the heaviest one: an emerald polka-dot box with the red ribbon running down its face, a big bow for hair, a tag that says 99 kg, a face bursting to be opened. <i>Silhouette: a box under a bow.</i>' },
    { letter: 'B', name: 'Iron Claus', draw: kettlebell,
      blurb: 'The weight itself, dressed for the card: a cast-iron 32 kettlebell with Santa\'s hat flopped over its handle, a cloud of white beard and moustache, bushy brows, a red nose. <i>Silhouette: a bell under a handle loop, a hat flopping back.</i>' },
    { letter: 'C', name: 'Rudolph Press', draw: reindeer,
      blurb: 'Santa\'s strongest reindeer, pressing a barbell on its antlers: a red nose glowing, ears out, teeth gritted in a grin, sweat flying. <i>Silhouette: antlers holding a bar across the top.</i>' },
  ],
};
