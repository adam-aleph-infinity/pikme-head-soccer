// Card #5 — בונה החומות (The Wall Builder). Card: Paz in a straw fedora, lei and Hawaiian shirt,
// bursting out of an ice pool, popsicles flying ("20 people compete in an ice pool for 10,000").
// Power: a brick wall slides along the ground; it can only be countered (Ground).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, arcPts, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: a beaver in a hard hat, the builder of dams ---------------------------------------------------
function beaver() {
  begin();
  const BV = { base: '#a8683a', light: '#c98a52', hi: '#e8b07a', shade: '#7a4a26', deep: '#54301a' };
  const HH = { base: '#ffcc22', light: '#ffe680', shade: '#d89a0a' };
  let s = '';
  // the flat paddle tail behind
  const tail = smooth([[38, 96], [16, 92], [2, 100], [4, 114], [20, 117.5], [42, 110]]);
  s += part(tail, '#5a4a52') + inside(tail, line('M6 100L36 112M4 108L28 117M14 94L40 104M10 104l12-8M16 112l12-10M26 114l10-10', '#7a6a72', 1.2));
  // the ear, the head
  const ear = circle(36, 42, 9);
  const head = smooth([[18, 76], [22, 52], [40, 34], [70, 28], [100, 34], [120, 50], [134, 68], [134, 88], [120, 104], [92, 114], [56, 114], [30, 104]]);
  s += keyline([ear, head]) + fill(ear, BV.base) + fill(circle(36, 42, 4.4), BV.deep) + fill(head, BV.base);
  s += inside(head, fill(smooth([[0, 50], [34, 58], [38, 120], [0, 120]]), BV.shade) + fill(smooth([[48, 34], [96, 34], [118, 52], [88, 46]]), BV.light) +
    line('M30 62q4-2 8 0M28 76q4-2 8 0M34 90q4-2 8 0', BV.deep, 1.2));
  s += rim([ear, head], poly([[0, 0], [80, 0], [40, 40], [16, 80], [0, 90]]), 2);
  // the pale muzzle, the black nose, orange buck teeth, whiskers
  const muz = smooth([[88, 74], [104, 64], [126, 64], [140, 76], [138, 90], [122, 98], [100, 98], [88, 88]]);
  s += part(muz, '#ecd0a4', 4.4) + inside(muz, fill(poly([[80, 90], [144, 88], [144, 104], [80, 104]]), '#cfae80'));
  s += part(smooth([[124, 64], [134, 62], [140, 68], [134, 74], [124, 72]]), '#2a1a14', 3) + fill(ellipse(131, 65, 3, 1.4), '#6a5a54');
  s += line('M100 88Q114 94 130 86', INK, 2.2);
  const teeth = smooth([[108, 92, 1], [126, 90, 1], [125, 108, 1], [109, 109, 1]], true, 0.25);
  s += part(teeth, '#ffa83a', 3.4) + line('M117.5 92v16', INK, 1.4) + line('M111 95v8M119.6 94v8', '#ffd890', 1.4);
  s += line('M128 80l14-4M128 84l15 1M98 78l-12-4M98 82l-13 1', INK, 1);
  // eyes and brows
  s += eye({ x0: 60, x1: 76, top: 52, bot: 64, slant: 0.45, nose: 1, px: 71, py: 59, pr: 4 });
  s += eye({ x0: 88, x1: 104, top: 50, bot: 62, slant: 0.45, nose: -1, px: 99, py: 57, pr: 4.2 });
  s += line('M56 47L78 52M84 50L108 43', INK, 3);
  // the yellow hard hat
  const hat = smooth([[38, 42, 1], [40, 24], [58, 12], [80, 10], [98, 16], [108, 32, 1]]);
  const brim = smooth([[30, 44, 1], [112, 30, 1], [118, 36, 1], [34, 50, 1]], true, 0.4);
  s += part(hat, HH.base) + inside(hat, fill(smooth([[30, 20], [52, 18], [50, 44], [30, 44]]), HH.shade) + fill(poly([[66, 0], [76, 0], [80, 40], [70, 40]]), HH.light) + line('M48 22Q72 8 96 18', '#ffffff', 1.8, 'opacity=".7"'));
  s += part(brim, HH.shade, 4.4) + line('M36 45L112 33', HH.light, 1.4);
  s += rim(hat, poly([[0, 0], [70, 0], [40, 40], [0, 40]]), 1.6, '#fff6c8');
  // the card's lei round its neck
  const cols = ['#ff5aa0', '#ffcc22', '#ff7a3a', '#b06ae0', '#ff5aa0', '#ffcc22', '#ff7a3a'];
  arcPts(70, 80, 50, 34, 165, 55, 6).forEach(([x, y], i) => {
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; s += part(circle(x + Math.cos(a) * 3.8, y + Math.sin(a) * 3.8, 3.4), cols[i], 1.6); }
    s += fill(circle(x, y, 2), '#fff6c8');
  });
  // a splash of the card's ice pool
  s += part(smooth([[126, 110], [136, 100], [142, 108], [138, 117.5, 1], [124, 117.5, 1]]), '#9fe0ff', 2.4) + sparkle(136, 30, 3.6) + sparkle(12, 30, 3);
  return end(s);
}

// ---- B: one of the card's ice pops, a bite out of it --------------------------------------------------
function icepop() {
  begin();
  const IP = { base: '#ff4a3a', light: '#ff7a5a', hi: '#ffc0a8', shade: '#c8241e', deep: '#8a1012' };
  const OR = { base: '#ff9a2a', light: '#ffc060', shade: '#d86a0a' };
  let s = '';
  let b = '';
  // the stick
  const stick = smooth([[62, 96, 1], [84, 96, 1], [84, 112], [73, 118], [62, 112]], true, 0.6);
  b += part(stick, '#e8c48a', 4.4) + inside(stick, fill(poly([[62, 96], [68, 96], [68, 120], [62, 120]]), '#c8a066'));
  // the pop, with a bite out of its top-front corner
  const pop = smooth([[20, 40], [26, 16], [50, 8], [86, 8], [96, 10, 1], [98, 18], [104, 22, 1], [108, 28], [116, 28, 1], [120, 34], [126, 38, 1], [128, 64], [124, 92], [100, 102], [46, 102], [22, 92], [18, 64]]);
  b += part(pop, IP.base);
  // orange below, red above, cold glints
  b += inside(pop, fill(smooth([[0, 70], [30, 64], [60, 72], [90, 64], [120, 70], [144, 66], [144, 120], [0, 120]]), OR.base) +
    fill(smooth([[0, 10], [34, 20], [32, 110], [0, 110]]), IP.shade, 'opacity=".75"') + fill(smooth([[104, 40], [126, 44], [124, 96], [110, 90]]), IP.light, 'opacity=".7"') +
    line('M34 18Q60 10 88 14', IP.hi, 2.6) + line('M112 46q6 20 2 40', '#ffffff', 2, 'opacity=".55"'));
  b += rim(pop, poly([[0, 0], [60, 0], [36, 40], [20, 100], [0, 110]]), 2, '#fff2e0');
  // melting drips at the bottom edge
  for (const [x, h] of [[34, 10], [104, 14], [116, 7]]) b += part(smooth([[x - 5, 96], [x + 5, 96], [x + 4, 96 + h], [x, 100 + h, 1], [x - 4, 96 + h]]), OR.base, 2.6);
  // frost speckles
  for (const [x, y] of [[40, 30], [54, 22], [100, 52], [30, 56], [118, 70], [44, 86]]) b += sparkle(x, y, 2.6, '#ffffff');
  // teeth gritted against the cold
  b += eyeE({ x0: 44, x1: 62, top: 40, bot: 53, slant: 0.45, nose: 1, px: 57, py: 48, pr: 4.4 });
  b += eyeE({ x0: 74, x1: 94, top: 38, bot: 52, slant: 0.45, nose: -1, px: 88, py: 46, pr: 4.8 });
  b += browsE([40, 34, 64, 40], [70, 38, 98, 30], 3.2);
  const mouth = smooth([[50, 66, 1], [70, 68], [92, 64, 1], [90, 78, 1], [70, 81], [52, 79, 1]], true, 0.4);
  b += mouthE(71, 73, 42, fill(mouth, '#fff') + inside(mouth, line('M50 72.5L92 70.5', INK, 1.4) + line('M58 64v18M66 64v18M74 64v18M82 64v18', INK, 1.1)) + line(mouth, INK, 2));
  s += `<g transform="rotate(8 72 62)">${b}</g>`;
  // cold steaming off it
  s += line('M10 40q-6-8 0-16M16 30q-6-8 0-16M134 20q6-8 0-16', '#d8f2ff', 1.8, 'opacity=".8"');
  return end(s);
}

// ---- C: an igloo built from ice bricks ------------------------------------------------------------------
function igloo() {
  begin();
  const IC = { base: '#eaf6fc', light: '#ffffff', shade: '#bcdcef', deep: '#86b8da', ln: '#9ccbe6' };
  let s = '';
  // the trowel stuck in its top
  s += line('M80 20L94 2', INK, 6) + line('M80 20L94 2', '#8a5a32', 2.8);
  s += part(poly([[72, 30], [80, 14], [90, 22]]), '#c9d2da', 3) + line('M80 18L82 26', '#7e8a96', 1.2);
  // the dome of ice bricks
  const dome = smooth([[16, 117.5, 1], [16, 84], [24, 50], [42, 26], [68, 16], [94, 26], [112, 50], [120, 84], [120, 117.5, 1]]);
  s += part(dome, IC.base);
  let bricks = '';
  const rows = [102, 86, 70, 54, 38];
  rows.forEach((y, i) => {
    const hw = 54 * Math.sqrt(Math.max(0, 1 - ((117.5 - y) / 104) ** 1.6));
    bricks += `M${68 - hw} ${y}Q68 ${y + 6} ${68 + hw} ${y}`;
    const yb = y + 16 > 117.5 ? 117.5 : y + 16, n = 4 - Math.floor(i / 2);
    for (let k = 0; k <= n; k++) { const x = 68 - hw + ((k + (i % 2 ? 0.5 : 0.25)) * 2 * hw) / (n + 0.5); bricks += `M${x} ${y + 3}L${x} ${yb}`; }
  });
  s += inside(dome, fill(poly([[0, 0], [40, 0], [30, 120], [0, 120]]), IC.shade) + fill(smooth([[84, 24], [110, 50], [118, 110], [100, 110], [96, 50]]), IC.light) + line(bricks, IC.ln, 1.6) +
    fill(smooth([[30, 34], [50, 20], [80, 16], [100, 26], [96, 34], [82, 30], [70, 38], [56, 30], [44, 40]]), '#ffffff'));
  s += rim(dome, poly([[0, 0], [70, 0], [36, 40], [14, 100], [0, 120]]), 2, '#ffffff');
  // the little tunnel at the front: its door is the mouth, icicles for teeth
  const tunnel = smooth([[88, 117.5, 1], [90, 90], [102, 78], [120, 76], [131, 86], [134, 117.5, 1]]);
  s += part(tunnel, IC.base) + inside(tunnel, fill(poly([[90, 100], [144, 100], [144, 120], [90, 120]]), IC.shade) + line('M92 98Q112 102 132 96', IC.ln, 1.4));
  const door = smooth([[100, 117.5, 1], [100, 100], [108, 90], [119, 90], [125, 100], [125, 117.5, 1]]);
  s += fill(door, '#1e3a5a') + inside(door, fill(ellipse(113, 117.5, 10, 8), '#2e5a80') + line('M104 94l2 7M110 91l1.4 9M116 91l-1 8M122 95l-2 6', '#eaf6fc', 2.6)) + line(door, INK, 2);
  // eyes in the dome
  s += eye({ x0: 50, x1: 68, top: 56, bot: 70, slant: 0.45, nose: 1, px: 63, py: 64, pr: 4.4 });
  s += eye({ x0: 80, x1: 100, top: 54, bot: 69, slant: 0.45, nose: -1, px: 94, py: 62, pr: 4.8 });
  s += line('M46 50L70 56M76 54L104 46', INK, 3.2);
  // snow at its base
  const snow = smooth([[16, 117.5, 1], [18, 110], [32, 106], [52, 110], [68, 107], [82, 112], [88, 117.5, 1]]);
  s += part(snow, '#ffffff', 4) + sparkle(130, 40, 4, '#ffffff') + sparkle(16, 40, 3, '#ffffff') + sparkle(126, 60, 2.4, '#ffffff');
  return end(s);
}

export default {
  card: 5, champion: 'בונה החומות', en: 'The Wall Builder', theme: 'Card: an ice pool, 20 people, popsicles flying, a lei and a Hawaiian shirt · Power: a brick wall slides along the ground (Ground)',
  options: [
    { letter: 'A', name: 'Dam Boss', draw: beaver,
      blurb: 'The animal that builds walls for a living: a beaver in a yellow hard hat, orange buck teeth bared in a grin, its flat paddle tail behind, the card\'s Hawaiian lei round its neck, a splash of the ice pool. Off to dam the goal. <i>Silhouette: a round head in a hard hat, buck teeth, a paddle tail.</i>' },
    { letter: 'B', name: 'Ice Pop', draw: icepop, marks: { eyes: [[53, 46.5], [84, 45]], nose: [80, 58], tf: 'translate(72px, 62px) rotate(8deg) translate(-72px, -62px)' },
      blurb: 'One of the card\'s flying popsicles: a red-and-orange ice pop with a bite out of its corner, frosted, steaming cold and dripping, teeth gritted against the chill, on its wooden stick. A slab, like the wall it puts up. <i>Silhouette: a rounded slab on a stick, a bite out of the top.</i>' },
    { letter: 'C', name: 'Igloo', draw: igloo,
      blurb: 'A wall builder\'s house made of the card\'s ice: an igloo of ice bricks, its door the mouth with icicles for teeth, eyes in its snowy dome, the builder\'s trowel stuck in the top. <i>Silhouette: a tall dome with a little tunnel at the front.</i>' },
  ],
};
