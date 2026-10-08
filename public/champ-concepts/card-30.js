// Card #30 — אדון המשיכה (The Lord of Pull). Card: Naveh at a Tokyo yakiniku feast, wagyu held
// up in chopsticks, golden dragons, Tokyo Tower behind ("strangers in Japan control what we eat
// for 24 hours"). Power: a goal magnet that pulls the ball down into the net at a slant (Downward).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const steam = (x, y, k = 1) => line(`M${x} ${y}q${-6 * k} -8 0 -14q${6 * k} -6 0 -14`, '#ffffff', 2.4, 'opacity=".75"');

// ---- A: a slab of wagyu, chopsticks stuck in it ------------------------------------------------------
function wagyu() {
  begin();
  const M = { base: '#e8586a', light: '#ff8a96', shade: '#b83a4c', deep: '#8a2436', marble: '#fbe6e6', fat: '#fbf1e2' };
  let s = steam(30, 26) + steam(118, 22, -1);
  // chopsticks stuck in the top
  s += line('M80 34L104 0', INK, 5.6) + line('M80 34L104 0', '#c98a4a', 3) + line('M92 36L124 6', INK, 5.6) + line('M92 36L124 6', '#b07a42', 3);
  const slab = smooth([[16, 66], [24, 36], [54, 18], [98, 18], [126, 34], [134, 66], [130, 92], [108, 110], [70, 117.5], [36, 110], [18, 92]]);
  s += part(slab, M.base);
  let marble = '';
  for (let i = 0; i < 9; i++) { const x = 24 + ((i * 41) % 100), y = 44 + ((i * 29) % 60); marble += `M${x} ${y}q${6 + (i % 3) * 3} ${-4 + (i % 2) * 6} ${14 + (i % 4) * 3} ${2 - (i % 3) * 2}`; }
  s += inside(slab, line(marble, M.marble, 2.2, 'opacity=".9"') + fill(smooth([[0, 40], [34, 50], [30, 90], [40, 130], [0, 130]]), M.shade, 'opacity=".7"') +
    fill(smooth([[20, 100], [70, 110], [134, 92], [134, 130], [20, 130]]), M.deep) +
    // the fat cap along the top, like a hairline
    fill(smooth([[10, 70], [20, 34], [56, 14], [100, 14], [130, 32], [140, 64], [126, 48], [98, 28], [56, 28], [30, 46]]), M.fat) +
    // grill marks
    line('M40 60l18-14M58 76l26-22M80 92l28-24M104 100l20-16', '#5a2418', 3.4, 'opacity=".8"'));
  s += rim(slab, poly([[0, 0], [70, 0], [40, 30], [16, 70], [0, 90]]), 2);
  // delighted, like the card
  s += eyeE({ x0: 50, x1: 66, top: 56, bot: 69, slant: 0.1, nose: 1, px: 61, py: 63, pr: 4.4 });
  s += eyeE({ x0: 82, x1: 100, top: 54, bot: 68, slant: 0.1, nose: -1, px: 94, py: 61, pr: 4.8 });
  s += expr() === 'normal' ? line('M48 50q8-4 18-1M82 48q9-5 20-1', INK, 2.4) : browsE([48, 50, 66, 49], [82, 48, 102, 47], 2.4);
  const mouth = smooth([[60, 80, 1], [78, 82], [96, 78, 1], [92, 90], [78, 96], [64, 90]]);
  s += mouthE(78, 86, 36, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[58, 77], [98, 76], [98, 82], [58, 83]]), '#fff') + fill(ellipse(78, 96, 8, 4), '#ff7a96')) + line(mouth, INK, 1.8));
  s += sparkle(134, 40, 3.4);
  return end(s);
}

// ---- B: Tokyo Tower, its main deck a face ----------------------------------------------------------
function tower() {
  begin();
  const O = { base: '#ff5a1f', shade: '#c83a10', light: '#ff9a6a' };
  const WH = '#f4f1ea';
  let s = '';
  // the lattice: legs flaring to the base, the body tapering to the antenna
  const legs = poly([[56, 84], [92, 84], [128, 112], [20, 112]]);
  const upper = poly([[60, 50], [88, 50], [80, 26], [68, 26]]);
  const mast = poly([[71, 26], [77, 26], [75.5, 2], [72.5, 2]]);
  const top = smooth([[62, 20, 1], [86, 20, 1], [86, 28, 1], [62, 28, 1]], true, 0.3);
  const deck = smooth([[34, 50, 1], [114, 50, 1], [118, 88, 1], [30, 88, 1]], true, 0.25);
  const base = smooth([[16, 104, 1], [132, 104, 1], [132, 117.5, 1], [16, 117.5, 1]], true, 0.2);
  s += keyline([legs, upper, mast, top, deck, base]);
  let lattice = '';
  for (let i = 0; i < 4; i++) { const y = 86 + i * 6, k = (y - 84) / 28; lattice += `M${56 - k * 36} ${y}L${92 + k * 36} ${y}`; }
  s += fill(legs, O.base) + inside(legs, line(lattice, WH, 1.4) + line('M56 84L36 104M92 84L112 104M64 84L52 104M84 84L96 104', O.shade, 1.4) + fill(ellipse(74, 112, 18, 14), '#2a1a2a'));
  s += fill(upper, O.base) + inside(upper, fill(poly([[60, 36], [90, 36], [90, 42], [60, 42]]), WH) + line('M64 48L80 28M84 48L68 28', O.shade, 1.2));
  s += fill(mast, WH) + fill(top, WH) + inside(top, line('M64 24h20', O.base, 1.6));
  s += fill(base, '#c9d2da') + inside(base, line('M20 110h108', '#8a96a2', 1.2) + Array.from({ length: 10 }, (_, i) => fill(poly([[22 + i * 11, 106], [28 + i * 11, 106], [28 + i * 11, 110], [22 + i * 11, 110]]), '#7ff0ff')).join(''));
  // the main deck, wrapped in windows, its face
  s += fill(deck, WH) + inside(deck, fill(poly([[30, 50], [118, 50], [118, 58], [30, 58]]), O.base) + fill(poly([[30, 82], [118, 82], [118, 90], [30, 90]]), O.base) + fill(poly([[30, 58], [44, 58], [44, 82], [30, 82]]), '#d8d2c4'));
  s += eye({ x0: 46, x1: 66, top: 61, bot: 74, slant: 0.2, nose: 1, px: 60, py: 68, pr: 4.4, white: '#e6fbff' });
  s += eye({ x0: 80, x1: 102, top: 60, bot: 74, slant: 0.2, nose: -1, px: 95, py: 67, pr: 4.8, white: '#e6fbff' });
  s += line('M44 56q10-3 22 1M80 56q11-4 24 0', INK, 2.2);
  s += line('M66 78Q76 82 88 77', INK, 2.2);
  s += rim([deck, legs, base], poly([[0, 0], [50, 0], [30, 50], [16, 120], [0, 120]]), 1.8);
  // the antenna's light, and the night around it
  s += fill(circle(74, 2, 4), 'rgba(255,90,60,.4)') + fill(circle(74, 2, 1.6), '#ff5a3a');
  s += sparkle(20, 24, 3.6, '#ffd24a') + sparkle(128, 30, 3.4, '#ffd24a') + sparkle(136, 76, 3, '#ffd24a');
  return end(s);
}

// ---- C: a flying saucer pulling everything up into its beam ----------------------------------------
function ufo() {
  begin();
  const SI = { base: '#c9d2da', light: '#f1f5f8', shade: '#8a96a2', deep: '#5a6470' };
  let s = '';
  // the tractor beam, and what it's pulling up: a ball and a slice of the card's wagyu
  s += fill(poly([[52, 84], [96, 84], [126, 117.5], [22, 117.5]]), 'rgba(255,243,106,.35)') + line('M52 84L22 117.5M96 84L126 117.5', '#fff36a', 1.4, 'opacity=".8"');
  s += line('M40 108h10M90 104h12M60 96h8', '#fffbd0', 1.4);
  const ball = circle(48, 104, 7);
  s += part(ball, '#ffffff', 3) + inside(ball, fill(poly([[46, 100], [51, 100], [53, 104], [49, 107], [45, 104]]), INK));
  s += `<g transform="rotate(-20 98 106)">` + part(smooth([[88, 102], [108, 100], [110, 108], [90, 110]]), '#e8586a', 2.8) + line('M92 104q6-2 14 0', '#fbe6e6', 1.2) + '</g>';
  // the saucer
  const disc = ellipse(74, 72, 64, 16);
  const dome = `M42 66A32 34 0 0 1 106 66Z`;
  s += keyline([disc, dome]);
  s += fill(disc, SI.base) + inside(disc, fill(ellipse(74, 78, 64, 14), SI.shade) + line('M14 70Q74 80 134 70', SI.light, 1.6) + fill(ellipse(74, 86, 30, 6), SI.deep));
  s += fill(dome, 'rgba(159,240,255,.85)') + inside(dome, fill(smooth([[46, 60], [52, 42], [66, 34], [60, 50]]), 'rgba(255,255,255,.6)'));
  s += line(dome, INK, 1.4);
  const cols = ['#ff5a5a', '#fff36a', '#5aff8a', '#5ac8ff', '#ff8af0'];
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + (i / 8) * 0.84), x = 74 - Math.cos(a) * 58, y = 74 + Math.sin(a) * 9; s += part(circle(x, y, 2.6), cols[i % 5], 1.8); }
  s += rim([disc], poly([[0, 0], [60, 0], [30, 60], [0, 80]]), 2);
  // its face in the dome, pleased with itself
  s += eye({ x0: 56, x1: 70, top: 44, bot: 55, slant: 0.42, nose: 1, px: 66, py: 51, pr: 3.8, r: 2.4 });
  s += eye({ x0: 78, x1: 94, top: 43, bot: 54, slant: 0.42, nose: -1, px: 89, py: 50, pr: 4, r: 2.4 });
  s += line('M66 60Q76 64 88 58', INK, 2.2);
  s += line('M74 32V20', INK, 3.4) + line('M74 32V20', SI.base, 1.6) + part(circle(74, 18, 3.4), '#ff5a5a', 2);
  s += sparkle(130, 26, 4) + sparkle(14, 30, 3.4) + sparkle(136, 106, 3);
  return end(s);
}

export default {
  card: 30, champion: 'אדון המשיכה', en: 'The Lord of Pull', theme: 'Card: wagyu in Tokyo, golden dragons, Tokyo Tower · Power: a goal magnet pulling the ball down (Downward)',
  options: [
    { letter: 'A', name: 'Wagyu', draw: wagyu, marks: { eyes: [[58, 62.5], [91, 61]], nose: [78, 72] },
      blurb: 'The card\'s wagyu, delighted to be eaten: a marbled slab fresh off the grill, its white fat cap for a hairline, grill marks across it, chopsticks stuck in the top, steam rising. <i>Silhouette: a rounded slab with two sticks.</i>' },
    { letter: 'B', name: 'Tokyo Tower', draw: tower,
      blurb: 'The tower behind the card, in its orange and white: the main deck wrapped in windows is its face, the lattice legs flare down to a glowing base, the antenna light blinking on top. <i>Silhouette: a tall lattice spike.</i>' },
    { letter: 'C', name: 'Tractor Beam', draw: ufo,
      blurb: 'The pull itself: a flying saucer with its face in the glass dome, pulling a football and a slice of the card\'s wagyu up into its yellow beam. <i>Silhouette: a domed disc over a cone of light.</i>' },
  ],
};
