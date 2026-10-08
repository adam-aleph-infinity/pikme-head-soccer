// Card #3 — השף הבוער (The Burning Chef). Card: Naveh as a many-armed chef at a row of blazing
// grills, spatulas and tongs in every hand ("we fed soldiers for 24 hours"). Power: a fireball down
// a straight line; the blocker burns (Straight Line, burn).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const flame = (x, y, h, lean = 0.3, k = 1) => smooth([[x - 7 * k, y], [x - 8 * k, y - h * 0.4], [x + lean * h * 0.5, y - h * 0.7], [x + lean * h, y - h, 1], [x + 6 * k, y - h * 0.45], [x + 7 * k, y]]);
const fire = (x, y, h, lean, k = 1) => part(flame(x, y, h, lean, k), '#ff7a1a', 3) + fill(flame(x + 1, y, h * 0.6, lean, k * 0.55), '#ffd23a');

// ---- A: a kettle grill, lid lifted on a grin of coals ----------------------------------------------
function kettle() {
  begin();
  const RD = { base: '#d8282e', light: '#ff5a50', hi: '#ffb0a0', shade: '#9a141c', deep: '#6a0a12' };
  const ST = '#c9d2da';
  let s = '';
  // the card's tongs and spatula, held up either side like extra arms
  s += line('M22 84L8 34', INK, 6) + line('M22 84L8 34', ST, 2.6);
  s += line('M8 36L2 18M8 36L14 18', INK, 5) + line('M8 36L2 18M8 36L14 18', ST, 2.2);
  s += line('M124 82L134 40', INK, 6) + line('M124 82L134 40', '#8a5a32', 2.8);
  const spat = poly([[126, 40], [142, 38], [143, 14], [129, 16]]);
  s += part(spat, ST, 3.4) + line('M133 20v14M138 19v14', '#7e8a96', 1.4);
  // the legs
  for (const [x0, x1] of [[38, 28], [108, 118], [74, 74]]) s += line(`M${x0} 98L${x1} 117`, INK, 6.4) + line(`M${x0} 98L${x1} 117`, '#4a4e58', 2.8);
  // the bowl, the handles on it
  for (const [x, y] of [[16, 82], [128, 80]]) s += part(smooth([[x - 6, y - 3, 1], [x + 6, y - 3, 1], [x + 6, y + 3, 1], [x - 6, y + 3, 1]], true, 0.4), '#2a2a30', 3);
  const bowl = 'M20 72Q22 112 72 112Q122 112 126 70Z';
  s += part(bowl, RD.base) + inside(bowl, fill(poly([[0, 92], [144, 88], [144, 120], [0, 120]]), RD.shade) + line('M30 80Q72 92 116 78', RD.light, 2));
  // the glow in the gap: coals for a grin, flames licking out the front
  const glow = smooth([[22, 72, 1], [72, 64], [128, 56, 1], [124, 74], [72, 80], [26, 78]], true, 0.6);
  s += fill(glow, '#ffb627') + inside(glow, fill(poly([[0, 78], [144, 66], [144, 90], [0, 90]]), '#e05a12') +
    [36, 50, 64, 78, 92, 106, 118].map((x, i) => fill(circle(x, 76 - i * 1.6, 6.4), i % 2 ? '#3a1a0e' : '#5a2a14') + fill(circle(x - 1.4, 72 - i * 1.6, 2), '#ff9a3a')).join('') +
    fill(ellipse(80, 66, 40, 4), '#fff2a8'));
  s += line(glow, INK, 1.6);
  s += fire(130, 68, 22, 0.5) + fire(118, 64, 14, 0.4, 0.8);
  // the lid, tilted up at the front
  const lid = smooth([[16, 70, 1], [18, 44], [34, 22], [66, 12], [98, 14], [120, 28], [130, 44], [132, 58, 1], [74, 64]]);
  s += part(lid, RD.base);
  s += inside(lid, fill(smooth([[0, 20], [40, 30], [36, 70], [0, 70]]), RD.shade) + fill(smooth([[56, 18], [100, 16], [122, 34], [92, 30]]), RD.light) + line('M60 16Q96 12 118 30', RD.hi, 2.2) +
    fill(poly([[0, 60], [144, 50], [144, 70], [0, 72]]), RD.deep, 'opacity=".5"'));
  s += rim(lid, poly([[0, 0], [80, 0], [40, 30], [16, 70], [0, 80]]), 2);
  // the handle bar and the vent on top, smoking
  s += line('M58 13V8M86 13V8', INK, 3);
  s += part(smooth([[50, 4, 1], [94, 4, 1], [94, 10, 1], [50, 10, 1]], true, 0.4), '#8a5a32', 3.4);
  s += part(ellipse(36, 28, 7, 4, -0.7), '#c9d2da', 2.4) + fill(circle(35, 28, 1.2), INK) + fill(circle(38, 26, 1.2), INK);
  for (const [x, y, r] of [[26, 16, 4.4], [20, 6, 3.4]]) s += part(circle(x, y, r), '#d8d2c8', 2.2);
  // proud eyes on the lid
  s += eye({ x0: 60, x1: 76, top: 36, bot: 48, slant: 0.5, nose: 1, px: 71, py: 43, pr: 4 });
  s += eye({ x0: 86, x1: 104, top: 34, bot: 47, slant: 0.5, nose: -1, px: 98, py: 41, pr: 4.4 });
  s += line('M56 30L78 37M84 35L108 27', INK, 3.2);
  s += sparkle(112, 4, 3) + fill(circle(140, 56, 1.6), '#ffb627') + fill(circle(136, 46, 1.2), '#ffd23a');
  return end(s);
}

// ---- B: a flame-grilled burger --------------------------------------------------------------------------
function burger() {
  begin();
  const BN = { base: '#e89a42', light: '#ffc070', hi: '#ffe0a8', shade: '#b86a22', deep: '#8a4a14' };
  const PT = { base: '#6a3a1e', light: '#8e5230', shade: '#4a2412', mark: '#2e160a' };
  let s = '';
  // flames licking up the sides from behind
  s += fire(14, 108, 34, -0.3, 1.1) + fire(132, 104, 38, 0.3, 1.1) + fire(124, 100, 22, 0.2, 0.8);
  // bottom bun
  const bot = smooth([[18, 96, 1], [128, 96, 1], [126, 110], [110, 117.5], [36, 117.5], [20, 110]], true, 0.6);
  s += part(bot, BN.base) + inside(bot, fill(poly([[0, 108], [144, 106], [144, 120], [0, 120]]), BN.shade) + line('M26 100h94', BN.light, 1.6));
  // the patty: charred, grill-striped
  const patty = smooth([[12, 84], [20, 74], [72, 70], [126, 72], [136, 84], [128, 98], [72, 102], [18, 98]]);
  s += part(patty, PT.base) + inside(patty, fill(poly([[0, 90], [144, 88], [144, 110], [0, 110]]), PT.shade) + fill(smooth([[30, 76], [110, 74], [100, 80], [40, 80]]), PT.light) +
    line('M26 96L40 76M44 98L58 74M62 100L76 72M80 100L94 72M98 100L112 74M116 98L128 78', PT.mark, 2.6));
  // the lettuce frills and the cheese dripping
  const lettuce = smooth([[10, 70], [20, 64], [30, 72], [42, 64], [54, 72], [68, 64], [82, 72], [96, 64], [110, 72], [124, 64], [136, 72], [130, 78], [72, 76], [14, 78]]);
  s += part(lettuce, '#6ec43a', 4.4) + inside(lettuce, line('M14 74Q72 70 130 74', '#3e8a26', 1.4));
  const cheese = poly([[18, 64], [128, 62], [124, 72], [116, 86], [110, 72], [56, 74], [48, 88], [40, 74], [22, 72]]);
  s += part(cheese, '#ffcc22', 4) + inside(cheese, fill(poly([[0, 70], [144, 68], [144, 90], [0, 90]]), '#e8a40a'));
  // the top bun: its head
  const bun = smooth([[14, 64, 1], [18, 38], [40, 18], [72, 10], [104, 16], [126, 34], [132, 62, 1], [72, 68]]);
  s += part(bun, BN.base);
  s += inside(bun, fill(smooth([[0, 30], [30, 36], [30, 70], [0, 70]]), BN.shade) + fill(smooth([[46, 20], [96, 16], [122, 34], [84, 28]]), BN.light) + line('M50 18Q84 10 112 22', BN.hi, 2.4) +
    fill(poly([[0, 58], [144, 56], [144, 70], [0, 70]]), BN.deep, 'opacity=".45"'));
  s += rim(bun, poly([[0, 0], [80, 0], [40, 24], [16, 64], [0, 70]]), 2);
  for (const [x, y, a] of [[38, 30, -0.6], [54, 20, -0.2], [74, 16, 0.2], [96, 20, 0.5], [112, 28, 0.8], [30, 46, -0.9], [120, 46, 1.1], [44, 40, 0]]) s += part(ellipse(x, y, 3, 1.6, a), '#fff4d8', 1.2);
  // its face on the bun
  s += eyeE({ x0: 56, x1: 72, top: 34, bot: 46, slant: 0.5, nose: 1, px: 67, py: 41, pr: 4 });
  s += eyeE({ x0: 82, x1: 100, top: 32, bot: 45, slant: 0.5, nose: -1, px: 94, py: 39, pr: 4.4 });
  s += browsE([52, 28, 74, 34], [80, 32, 104, 25], 3);
  const mouth = smooth([[64, 50, 1], [80, 52], [96, 48, 1], [92, 57], [80, 60], [68, 57]]);
  s += mouthE(80, 54, 32, fill(mouth, '#3a140a') + inside(mouth, fill(poly([[62, 47], [98, 46], [98, 52], [62, 53]]), '#fff')) + line(mouth, INK, 1.8));
  // steam off the top
  s += line('M66 6q-4-4 0-8M80 4q-4-4 0-8', '#ffffff', 1.6, 'opacity=".7"');
  return end(s);
}

// ---- C: a matchbox, one match struck ---------------------------------------------------------------------
function matchbox() {
  begin();
  const BX = { base: '#ffcf3a', light: '#ffe68a', shade: '#d89a12', deep: '#a8700a' };
  const RD = '#d8282e';
  let s = '';
  // the drawer pushed up, a crown of matches standing in it
  const sticks = [[34, 30, -0.1], [50, 24, -0.05], [66, 20, 0], [82, 22, 0.05], [98, 26, 0.1]];
  for (const [x, top, a] of sticks) {
    const x2 = x + a * 40;
    s += line(`M${x} 48L${x2} ${top}`, INK, 6.4) + line(`M${x} 48L${x2} ${top}`, '#f2d8a8', 3);
    if (x !== 98) s += part(ellipse(x2, top - 2, 4.4, 6, a), RD, 3) + fill(ellipse(x2 - 1.2, top - 4, 1.4, 2, a), '#ff8a7a');
  }
  // the front one, struck and blazing
  s += part(ellipse(102, 23, 4.4, 6, 0.1), '#3a1a0e', 3);
  s += fire(104, 22, 30, 0.35, 1.3);
  const drawer = smooth([[22, 40, 1], [112, 40, 1], [112, 52, 1], [22, 52, 1]], true, 0.2);
  s += part(drawer, '#e8d4a8', 4.4) + fill(poly([[26, 42], [108, 42], [108, 46], [26, 46]]), '#b89a6a');
  // the box: front face and the striker down its side
  const side = poly([[114, 48], [128, 42], [128, 108], [114, 117.5]]);
  s += part(side, '#7a4a26') + inside(side, line('M118 54v58M122 52v54M125 50v52', '#5a3418', 1.4, 'stroke-dasharray="1.6 2"') + fill(poly([[114, 48], [128, 42], [128, 46], [114, 52]]), '#a8683a'));
  const face = smooth([[18, 48, 1], [116, 48, 1], [116, 117.5, 1], [18, 117.5, 1]], true, 0.15);
  s += part(face, BX.base);
  s += inside(face, fill(poly([[0, 48], [30, 48], [30, 120], [0, 120]]), BX.shade) + fill(poly([[18, 96], [116, 96], [116, 106], [18, 106]]), RD) + fill(poly([[18, 52], [116, 52], [116, 56], [18, 56]]), RD) +
    line('M18 100h98', '#ff7a6a', 1.2) + line('M34 60h70', BX.light, 1.6));
  s += rim([face, drawer], poly([[0, 0], [60, 0], [30, 50], [24, 120], [0, 120]]), 2);
  // its face on the label
  s += eye({ x0: 38, x1: 56, top: 62, bot: 75, slant: 0.5, nose: 1, px: 51, py: 70, pr: 4.4 });
  s += eye({ x0: 70, x1: 90, top: 60, bot: 74, slant: 0.5, nose: -1, px: 84, py: 68, pr: 4.8 });
  s += line('M34 57L58 63M66 61L94 53', INK, 3.2);
  const mouth = smooth([[48, 82, 1], [66, 84], [86, 80, 1], [82, 91], [66, 94], [52, 91]]);
  s += fill(mouth, '#3a140a') + inside(mouth, fill(poly([[46, 79], [88, 77], [88, 84], [46, 86]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(130, 10, 3.6, '#ffe14a') + fill(circle(122, 20, 1.6), '#ffb627') + fill(circle(136, 30, 1.4), '#ffd23a');
  return end(s);
}

export default {
  card: 3, champion: 'השף הבוער', en: 'The Burning Chef', theme: 'Card: a many-armed chef at the grill, feeding soldiers for 24 hours · Power: a fireball down a straight line (burn)',
  options: [
    { letter: 'A', name: 'Kettle Grill', draw: kettle,
      blurb: 'The card\'s grill come alive: a red kettle grill with its lid lifted on a grin of glowing coals, flames licking out the front, smoke from the vent, and the card\'s tongs and spatula held up either side like its extra arms. <i>Silhouette: a dome over a bowl on three legs.</i>' },
    { letter: 'B', name: 'Flame Burger', draw: fitted(burger, [0.98, 0.99, 0, 0]), marks: { eyes: [[64, 40], [91, 38.5]], nose: [88, 47] },
      blurb: 'What the card\'s chef was serving the soldiers: a stacked burger with its face on a sesame bun, cheese dripping over a charred, grill-striped patty, lettuce frills, flames licking up its sides. <i>Silhouette: a dome over a stack of layers.</i>' },
    { letter: 'C', name: 'Matchbox', draw: matchbox,
      blurb: 'The burn, struck: an upright yellow matchbox, its drawer pushed up with a crown of red-headed matches standing in it, the front one blazing, a face on the label and the striker down its side. <i>Silhouette: a box with a crown of sticks, one on fire.</i>' },
  ],
};
