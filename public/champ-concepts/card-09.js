// Card #9 — גולש הגלים (The Wave Surfer). Card: Ori diving head-first into a pool of
// raspberry syrup on the hottest day of the year, a red wave bursting round her. Power: the red
// wave, a shot that rises and falls as it flies (Up-and-Down).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// Lashes off the outer corner of an eye: `x, y` the corner, `dir` -1 for a back eye (they
// flick left), +1 for a front eye.
const lashes = (x, y, dir, n = 3) =>
  Array.from({ length: n }, (_, i) => line(`M${x} ${y + i * 2.6}l${dir * (4.5 - i * 0.6)} ${-3.2 + i * 1.1}`, INK, 1.8)).join('');

// ---- A: a splash of raspberry syrup, its crest a curling wave ----------------------------
function tide() {
  begin();
  const R = { base: '#d81f4a', shade: '#9c0f35', deep: '#6b0a26', light: '#ff5a7a', hi: '#ffc1cf', foam: '#fff5f7' };
  const body = smooth([[22, 108], [14, 88], [18, 66], [30, 50], [50, 41], [80, 39], [108, 45], [126, 60], [134, 82], [130, 102], [120, 113], [96, 116.5], [60, 116.5], [34, 115]]);
  const crest = smooth([[26, 66], [12, 44], [16, 22], [32, 8], [58, 1], [86, 3], [110, 12], [126, 26], [130, 42, 1], [122, 34], [114, 30], [106, 30], [100, 36, 1], [96, 26], [84, 20], [70, 22], [60, 30], [52, 42]]);
  const drips = [smooth([[36, 112], [42, 112], [42, 121], [39, 125], [36, 121]]), smooth([[100, 113], [107, 113], [107, 124], [103.5, 128], [100, 124]])];
  const straw = poly([[118, 70], [138, 34], [143, 36], [124, 72]]);
  let s = '';
  s += part(straw, '#ffffff', 5) + inside(straw, [0, 1, 2, 3, 4].map((i) => fill(poly([[110, 60 - i * 9], [150, 50 - i * 9], [150, 54 - i * 9], [110, 64 - i * 9]]), '#ff3d6a')).join(''));
  // the tube under the curl is liquid too (left open it read as a jug handle)
  const tube = smooth([[50, 46], [56, 32], [70, 22], [86, 20], [98, 27], [102, 40], [92, 47], [70, 48]]);
  s += keyline([body, crest, tube, ...drips]);
  s += fill(tube, R.deep) + inside(tube, fill(smooth([[62, 46], [68, 32], [82, 28], [94, 34], [94, 44], [76, 48]]), '#8a0f30') + line('M66 40Q74 28 90 30', R.light, 1.6, 'opacity=".7"'));
  s += fill(crest, R.base) + fill(body, R.base);
  for (const d of drips) s += fill(d, R.base) + inside(d, fill(poly([[30, 110], [40, 110], [40, 130], [30, 130]]), R.shade));
  s += inside([body, crest],
    // the barrel inside the curl, the dark back of the wave, the lit face of the splash
    fill(smooth([[54, 40], [64, 26], [84, 20], [98, 26], [100, 38], [80, 40]]), R.deep) +
    line('M22 60Q14 34 34 16Q56 6 84 10', R.light, 2.2, 'opacity=".8"') + line('M30 58Q26 36 44 22Q62 14 88 16', R.light, 1.6, 'opacity=".6"') + line('M40 52Q38 38 54 28', R.hi, 1.4, 'opacity=".6"') +
    fill(smooth([[0, 30], [26, 40], [30, 70], [26, 120], [0, 120]]), R.shade) +
    fill(smooth([[30, 104], [80, 110], [130, 98], [140, 130], [30, 130]]), R.shade) +
    fill(smooth([[84, 46], [118, 52], [130, 74], [118, 80], [96, 60]]), R.light) +
    line('M24 54Q18 30 34 14', R.light, 3) + line('M88 50q24 4 34 22', R.hi, 2.4) +
    // bubbles, and an ice cube floating in it
    [[34, 88, 3], [44, 98, 2], [28, 76, 1.8], [118, 96, 2.4], [62, 106, 1.6]].map(([x, y, r]) => line(circle(x, y, r), R.hi, 1) + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.3), R.hi)).join(''));
  const ice = smooth([[30, 58, 1], [44, 54, 1], [48, 66, 1], [34, 70, 1]], true, 0.6);
  s += fill(ice, 'rgba(225,245,255,.75)') + line(ice, '#ffffff', 1.2) + fill(poly([[33, 59], [41, 57], [42, 60], [34, 62]]), '#ffffff');
  // the foam riding the crest
  const foam = smooth([[18, 20], [28, 10], [40, 6], [48, 1], [58, 4], [68, 0], [78, 3], [88, 1], [96, 7], [106, 7], [114, 14], [124, 20], [130, 30], [131, 42, 1], [126, 36], [124, 44, 1], [120, 34], [116, 40, 1], [113, 31], [104, 22], [86, 13], [60, 12], [36, 18]]);
  s += fill(foam, R.foam) + inside(foam, fill(smooth([[20, 24], [60, 18], [110, 22], [120, 34], [20, 34]]), '#ffd6e0')) + line(foam, INK, 1.2);
  s += [[16, 14, 3], [9, 24, 2], [128, 14, 2.6], [134, 24, 1.8]].map(([x, y, r]) => part(circle(x, y, r), R.foam, 2.6)).join('');
  s += rim([body, crest], poly([[0, 20], [40, 0], [10, 60], [10, 110], [0, 110]]), 2.2);
  // the face: wide, lashed, thrilled — her yell from the card
  s += expr() === 'normal' ? line('M52 60Q62 52 74 58', INK, 2.6) + line('M88 56Q100 47 113 52', INK, 2.6) : browsE([52, 58, 74, 56], [88, 54, 113, 50], 2.6);
  s += eyeE({ x0: 54, x1: 74, top: 64, bot: 81, slant: 0.06, nose: 1, px: 67, py: 73, pr: 6, lidW: 2.4 }) + lashes(54, 64, -1);
  s += eyeE({ x0: 87, x1: 111, top: 61, bot: 80, slant: 0.06, nose: -1, px: 102, py: 70, pr: 6.6, lidW: 2.4 }) + lashes(111, 61, 1);
  s += fill(ellipse(50, 90, 6, 4), '#ff8fae') + fill(ellipse(118, 86, 5, 4), '#ff8fae');
  const mouth = smooth([[84, 90], [96, 87], [106, 92], [104, 104], [94, 108], [86, 102]]);
  s += mouthE(95, 97, 28, fill(mouth, '#4a0816') + inside(mouth, fill(ellipse(95, 108, 10, 6), '#ff7a96') + fill(poly([[82, 86], [108, 86], [106, 91], [84, 92]]), '#fff')) + line(mouth, INK, 2));
  s += sparkle(136, 52, 3.5) + sparkle(8, 96, 3);
  return end(s);
}

// ---- B: a raspberry with attitude, the leaves for a crown --------------------------------
function berry() {
  begin();
  const B = { base: '#e8336d', light: '#ff6f99', hi: '#ffd0dd', shade: '#b01e52', deep: '#85123c' };
  const G = { base: '#4fae3a', shade: '#2e7a22', light: '#8fdc5a' };
  const cx = 76, cy = 72, rx = 56, ry = 44;
  const cells = [];
  for (let row = 0; row < 9; row++) {
    const y = cy - ry + 6 + row * 10.6, off = row % 2 ? 6.5 : 0;
    for (let x = cx - rx; x <= cx + rx; x += 13) {
      const X = x + off, k = ((X - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (k < 1.02) cells.push([X, y, 7.6 - Math.max(0, k - 0.7) * 3]);
    }
  }
  const ds = cells.map(([x, y, r]) => circle(x, y, r));
  let s = keyline(ds, 6.2) + fill(ellipse(cx, cy, rx - 4, ry - 4), B.deep);
  for (const [x, y, r] of cells) {
    const back = x < 50, low = y > 100, face = x > 52 && x < 118 && y > 58 && y < 108;
    s += fill(circle(x, y, r), back || low ? B.shade : B.base);
    s += inside(circle(x, y, r), fill(circle(x + r * 0.35, y + r * 0.4, r * 0.9), back || low ? B.deep : B.shade));
    if (!face) s += fill(circle(x - r * 0.32, y - r * 0.34, r * 0.28), back ? B.base : B.hi);
    s += line(circle(x, y, r), B.deep, 0.7);
  }
  s += rim(ds, poly([[0, 0], [70, 0], [40, 40], [20, 90], [0, 100]]), 1.3);
  // the crown of sepals and a curl of stem
  const leaves = [[-150, 30], [-120, 34], [-90, 30], [-60, 34], [-30, 30], [-5, 26]].map(([a, L]) => {
    const r = (a * Math.PI) / 180, bx = 74, by = 30, c = Math.cos(r), sn = Math.sin(r);
    const tip = [bx + c * L, by + sn * L * 0.62 + 8], n = [-sn, c];
    return smooth([[bx - n[0] * 6, by - n[1] * 4], [bx + c * L * 0.5 + n[0] * 5, by + sn * L * 0.31 + 4 + n[1] * 4], [tip[0], tip[1], 1], [bx + c * L * 0.5 - n[0] * 5, by + sn * L * 0.31 + 4 - n[1] * 4], [bx + n[0] * 6, by + n[1] * 4]]);
  });
  for (const d of leaves) s += part(d, G.base, 4.6) + inside(d, fill(poly([[0, 30], [144, 30], [144, 60], [0, 60]]), G.shade));
  s += line('M74 26Q72 12 80 6Q86 2 88 8', INK, 6) + line('M74 26Q72 12 80 6Q86 2 88 8', G.shade, 3);
  s += part(ellipse(74, 28, 10, 5), G.light, 4) + line('M66 27q8 3 16 0', G.shade, 1.2);
  // the face: smug lidded eyes, lashes, a smirk
  s += line('M50 58L72 62', INK, 3.2) + line('M86 60L110 52', INK, 3.2);
  s += eye({ x0: 52, x1: 72, top: 64, bot: 79, slant: 0.42, nose: 1, px: 66, py: 73, pr: 5.4 }) + lashes(52, 64, -1);
  s += eye({ x0: 86, x1: 110, top: 61, bot: 78, slant: 0.42, nose: -1, px: 102, py: 71, pr: 6 }) + lashes(110, 61, 1);
  s += fill(ellipse(50, 88, 6, 4), '#ff9cbc') + fill(ellipse(116, 84, 5, 3.6), '#ff9cbc');
  s += line('M80 96Q94 100 106 92', INK, 2.6) + line('M106 92q4-1 5-5', INK, 2) + line('M88 101q6 2 12 0', B.deep, 1.4);
  s += sparkle(130, 20, 4.5) + sparkle(16, 30, 3.5) + sparkle(136, 104, 3);
  return end(s);
}

// ---- C: an axolotl surfer, raspberry gills streaming --------------------------------------
function lotl() {
  begin();
  const L = { base: '#b7a6ff', light: '#d6ccff', hi: '#f1edff', shade: '#8d7ae0', deep: '#6a58c0', belly: '#e6e0ff' };
  const GI = { base: '#e8325f', shade: '#a8163f', light: '#ff7a98' };
  // a gill frond: a tapered stalk from base to tip, feathered along one side
  const frond = (x0, y0, x1, y1, bend, w = 6) => {
    const mx = (x0 + x1) / 2 + bend[0], my = (y0 + y1) / 2 + bend[1];
    const P = (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1];
    const top = [], bot = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, [x, y] = P(t), [x2, y2] = P(Math.min(1, t + 0.01)), dx = x2 - x || 0.01, dy = y2 - y, l = Math.hypot(dx, dy);
      const nx = -dy / l, ny = dx / l, ww = w * (1 - t * 0.75), fe = i % 2 && i < 8 ? 3.4 : 0;
      top.push([x + nx * (ww + fe), y + ny * (ww + fe)]);
      bot.unshift([x - nx * ww * 0.7, y - ny * ww * 0.7]);
    }
    top[top.length - 1].push(1);
    return smooth([...top, ...bot]);
  };
  const gills = [frond(30, 56, 6, 20, [-8, 4]), frond(24, 70, 2, 50, [-6, 6]), frond(24, 84, 4, 84, [-4, 6], 5),
    frond(112, 48, 128, 12, [10, 0]), frond(122, 56, 142, 32, [8, 4]), frond(128, 66, 143, 58, [6, 0], 5)];
  let s = '';
  for (const d of gills) s += part(d, GI.base, 5) + inside(d, fill(poly([[0, 0], [144, 0], [144, 30], [0, 30]]), GI.light) + line(d, GI.shade, 2.4));
  const head = smooth([[20, 100], [16, 80], [24, 60], [44, 46], [76, 42], [106, 45], [124, 56], [133, 76], [130, 98], [117, 112], [76, 116.5], [36, 113]]);
  s += part(head, L.base);
  s += inside(head, fill(smooth([[0, 40], [36, 50], [30, 80], [40, 120], [0, 120]]), L.shade) + fill(smooth([[30, 92], [80, 96], [134, 86], [134, 130], [30, 130]]), L.belly) +
    fill(smooth([[30, 108], [80, 112], [134, 102], [134, 130], [30, 130]]), L.light) +
    fill(smooth([[70, 46], [112, 48], [126, 62], [104, 64], [80, 58]]), L.light) + line('M76 48q26-2 42 10', L.hi, 2.6));
  s += rim(head, poly([[0, 30], [80, 30], [40, 52], [20, 80], [10, 110], [0, 110]]), 2.2);
  // freckles across the brow
  for (const [x, y] of [[60, 54], [66, 50], [72, 55], [84, 52], [90, 56], [50, 60]]) s += fill(circle(x, y, 1.4), L.deep);
  // bead eyes set wide, the way an axolotl's are
  for (const [x, y, r] of [[48, 72, 5.6], [110, 68, 6.6]]) s += part(circle(x, y, r), '#1a1020', 2.4) + fill(circle(x + r * 0.3, y - r * 0.35, r * 0.34), '#fff') + fill(circle(x - r * 0.35, y + r * 0.3, r * 0.15), '#fff');
  s += line('M40 62q8-5 15-1M102 58q9-6 17-1', INK, 2.2);
  // the long, easy grin
  s += line('M58 90Q90 102 124 84', INK, 2.6) + line('M58 90q-3-1-4-4M124 84q3 0 4-3', INK, 2) + line('M96 97q4 6 10 2', INK, 1.8) + fill('M97 97.5q4 5 9 1.5', '#ff7a98');
  s += fill(ellipse(40, 86, 6, 4), '#ff9cbc') + fill(ellipse(122, 80, 5, 3.6), '#ff9cbc');
  // a splash of red wave curling at its chin
  for (const [x, y, r] of [[10, 104, 3], [138, 96, 2.6], [20, 114, 2]]) { const d = smooth([[x, y - r * 1.9, 1], [x + r, y], [x, y + r], [x - r, y]]); s += part(d, '#bfe8ff', 2.4) + fill(circle(x - r * 0.3, y, r * 0.3), '#fff'); }
  s += sparkle(72, 26, 4) + sparkle(138, 76, 3);
  return end(s);
}

export default {
  card: 9, champion: 'גולש הגלים', en: 'The Wave Surfer', theme: 'Card: a dive into raspberry syrup · Power: the red wave (Up-and-Down)',
  options: [
    { letter: 'A', name: 'Red Tide', draw: fitted(tide, [0.96, 0.94, 0, 0]), marks: { eyes: [[64, 72.5], [99, 70.5]], nose: [96, 87] },
      blurb: 'The card\'s raspberry pool stood up as a girl: a body of syrup whose hair is the wave itself, curling over with foam on the lip. An ice cube floating in her brow, a straw stuck in, drips at the chin, her yell from the card. <i>Silhouette: a blob under a breaking wave.</i>' },
    { letter: 'B', name: 'Berry Bomb', draw: berry,
      blurb: 'The raspberry the syrup is made from, with attitude: a head of glossy drupelets, a crown of sepals and a curl of stem, smug lashed eyes and a smirk. <i>Silhouette: a lumpy dome under a leafy crown.</i>' },
    { letter: 'C', name: 'Lotl', draw: lotl,
      blurb: 'A surfer who lives in the water: a lavender axolotl, raspberry gills streaming back like hair, bead eyes set wide, freckles and an easy, dripping-wet grin. <i>Silhouette: a wide flat head between two fans of gills.</i>' },
  ],
};
