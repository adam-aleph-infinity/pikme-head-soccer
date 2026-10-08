// Card #23 — רעם האדמה (Earth Thunder). Card: the Saltiz crew in a self-driving car flipping
// through the air, wheels and rocks flying ("24 hours in a car on autopilot in Japan"). Power: an
// earthquake shot that throws the blocker; arming it shakes the ground (Destructive, stars, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const rock = (x, y, r, c = '#9a7448') => part(poly([[x - r, y - r * 0.3], [x - r * 0.3, y - r], [x + r * 0.8, y - r * 0.6], [x + r, y + r * 0.4], [x + r * 0.2, y + r], [x - r * 0.8, y + r * 0.6]]), c, 3);
const dust = (x, y, r) => part(circle(x, y, r), '#d9c6a3', 2.6);

// ---- A: a boulder golem, the ground itself sitting up ---------------------------------------------
function boulder() {
  begin();
  const S = { base: '#c9a06a', light: '#e2c08c', hi: '#f2dcb0', shade: '#9a7448', deep: '#6e5030' };
  let s = rock(10, 36, 6) + rock(134, 22, 5) + rock(140, 74, 4) + line('M18 30l6-4M126 18l-6-2', '#ffffff', 1.4, 'opacity=".6"');
  const body = smooth([[20, 96], [14, 72, 1], [22, 50], [36, 34, 1], [56, 24], [80, 20, 1], [102, 26], [120, 40, 1], [130, 60], [132, 84, 1], [124, 104], [104, 116.5], [70, 117.5], [40, 114]]);
  s += part(body, S.base);
  s += inside(body, fill(poly([[0, 20], [40, 30], [36, 76], [44, 130], [0, 130]]), S.shade) + fill(poly([[56, 24], [80, 20], [102, 26], [96, 40], [66, 40]]), S.light) +
    fill(poly([[102, 26], [120, 40], [130, 60], [114, 54], [96, 40]]), S.hi, 'opacity=".7"') + fill(poly([[20, 100], [70, 110], [132, 92], [132, 130], [20, 130]]), S.deep, 'opacity=".55"') +
    line('M36 34L48 56L40 74M80 20L74 34M120 40L110 54M92 96l10 6l-4 8', S.deep, 1.6));
  // moss and a sprout on top
  s += part(smooth([[54, 26], [66, 18], [80, 22], [74, 30], [58, 32]]), '#6a9a3a', 3.4) + line('M68 20Q66 10 70 4', INK, 3) + line('M68 20Q66 10 70 4', '#5f8a26', 1.4) +
    part(smooth([[70, 6], [80, 2], [78, 8, 1]]), '#8fdc5a', 2) + part(smooth([[68, 8], [58, 4], [62, 10, 1]]), '#8fdc5a', 2);
  s += rim(body, poly([[0, 0], [70, 0], [36, 30], [20, 70], [0, 90]]), 2.2);
  // a crushing brow ledge, small deep eyes, a grim crack of a mouth
  const brow = poly([[44, 52], [118, 46], [120, 54], [46, 60]]);
  s += part(brow, S.light, 3.4) + fill(poly([[46, 60], [120, 54], [118, 60], [48, 66]]), S.deep, 'opacity=".6"');
  s += eye({ x0: 58, x1: 72, top: 62, bot: 72, slant: 0.3, nose: 1, px: 67, py: 68, pr: 3.4, r: 2.4 });
  s += eye({ x0: 88, x1: 104, top: 60, bot: 71, slant: 0.3, nose: -1, px: 98, py: 66, pr: 3.8, r: 2.4 });
  const mouth = poly([[56, 86], [116, 82], [112, 100], [86, 106], [62, 102]]);
  s += fill(mouth, '#3a2414') + inside(mouth, fill(poly([[54, 84], [118, 80], [118, 89], [54, 93]]), S.hi) + line('M66 84v9M76 83v9M86 83v9M96 82v9M106 81v9', S.shade, 1.4) + fill(ellipse(86, 104, 14, 4), '#6e3a2a')) + line(mouth, INK, 2.2);
  s += dust(16, 112, 6) + dust(128, 112, 6) + dust(6, 104, 4) + dust(140, 104, 4);
  return end(s);
}

// ---- B: a tyre from the flying car, burning rubber ---------------------------------------------------
function tire() {
  begin();
  const RB = { base: '#2a2b30', light: '#4a4c55', hi: '#7a7d88', shade: '#18191c' };
  const CH = { base: '#c9d2da', light: '#f1f5f8', shade: '#8a96a2', deep: '#5a6470' };
  let s = '';
  const side = ellipse(66, 64, 54, 53), face = ellipse(76, 64, 54, 53);
  s += keyline([side, face]);
  // the tread on the edge we see, then the sidewall
  let tread = '';
  for (let i = 0; i < 18; i++) tread += `M${14 + (i % 2) * 6} ${16 + i * 5.6}h8`;
  s += fill(side, RB.shade) + inside(side, line(tread, RB.hi, 2.4));
  s += fill(face, RB.base) + inside(face, fill(ellipse(70, 58, 54, 53), RB.light) + fill(ellipse(78, 66, 54, 53), RB.base) + line(ellipse(78, 64, 44, 43), RB.hi, 1, 'stroke-dasharray="3 5" opacity=".7"'));
  s += rim([side, face], poly([[0, 0], [80, 0], [40, 20], [20, 60], [10, 110], [0, 110]]), 2.2);
  // the hubcap is its face, the brake caliper peeking red behind it
  s += part(smooth([[52, 40], [62, 32], [70, 36], [60, 46]]), '#e5262e', 3);
  const hub = circle(79, 64, 32);
  s += part(hub, CH.base, 4.4) + inside(hub, fill(circle(84, 69, 32), CH.shade) + fill(circle(77, 62, 27), CH.light) + line('M60 46q12-10 28-8', '#ffffff', 2.4));
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; s += part(circle(79 + Math.cos(a) * 24, 64 + Math.sin(a) * 24, 2.2), CH.deep, 1.6); }
  s += eyeE({ x0: 62, x1: 76, top: 52, bot: 62, slant: 0.5, nose: 1, px: 72, py: 58, pr: 3.6, r: 2.4 });
  s += eyeE({ x0: 82, x1: 98, top: 50, bot: 61, slant: 0.5, nose: -1, px: 93, py: 56, pr: 3.8, r: 2.4 });
  const mouth = smooth([[64, 72, 1], [80, 74], [96, 70, 1], [92, 80], [80, 84], [68, 80]]);
  s += mouthE(80, 77, 32, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[62, 70], [98, 68], [98, 74], [62, 75]]), '#fff') + fill(poly([[62, 80], [98, 78], [98, 86], [62, 86]]), '#fff') + line('M70 70v14M78 70v14M86 70v14', '#c9c2c8', 1)) + line(mouth, INK, 1.8));
  // smoke from the burnout, rocks thrown up
  s += dust(26, 112, 8) + dust(44, 116, 6) + dust(12, 104, 5) + dust(118, 114, 6) + rock(136, 30, 5, '#8a7a6a') + rock(10, 30, 4, '#8a7a6a');
  s += line('M128 50l12-4M130 62l12 0M128 74l10 4', '#ffffff', 1.8, 'opacity=".6"');
  return end(s);
}

// ---- C: a star-nosed mole bursting out through the turf -------------------------------------------
function mole() {
  begin();
  const F = { base: '#3e3240', light: '#5e5062', hi: '#8a7a8c', shade: '#261e28' };
  const N = { base: '#ff8aa8', shade: '#e05a80', light: '#ffc0d0' };
  const D = { base: '#8a5a32', shade: '#6a4222', light: '#a87444' };
  let s = '';
  const head = smooth([[24, 90], [22, 64], [34, 42], [56, 30], [84, 30], [106, 40], [118, 56], [124, 74], [118, 92], [100, 104], [70, 108], [42, 104]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 80], [40, 120], [0, 120]]), F.shade) + fill(smooth([[56, 32], [96, 36], [110, 50], [80, 46]]), F.light) + line('M62 34q24-2 40 10', F.hi, 2.2));
  s += rim(head, poly([[0, 0], [70, 0], [40, 30], [24, 70], [0, 90]]), 2.2);
  // the star nose: a ring of pink fingers
  const cx = 126, cy = 70;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, x = cx + Math.cos(a) * 11, y = cy + Math.sin(a) * 11;
    s += part(ellipse(x, y, 5.4, 2.6, a), N.base, 2.4);
  }
  s += part(circle(cx, cy, 7), N.shade, 2.4) + fill(circle(cx - 2, cy - 1, 1.6), '#7a2a40') + fill(circle(cx + 2, cy + 1, 1.6), '#7a2a40') + fill(circle(cx - 2, cy - 4, 1.4), N.light);
  // squinting little eyes (it can barely see), buck teeth
  s += eye({ x0: 62, x1: 76, top: 60, bot: 68, slant: 0.55, nose: 1, px: 71, py: 66, pr: 2.8, r: 2 });
  s += eye({ x0: 90, x1: 106, top: 57, bot: 66, slant: 0.55, nose: -1, px: 100, py: 63, pr: 3, r: 2 });
  s += line('M58 54L78 60M88 56L110 48', F.hi, 3);
  s += line('M98 88Q108 92 116 86', INK, 2) + part(smooth([[102, 90, 1], [110, 89, 1], [110, 96, 1], [102, 96, 1]], true, 0.3), '#fffaf0', 2);
  // bursting through the ground, big pink digging claws out
  const dirt = smooth([[2, 104], [20, 96], [40, 102], [60, 96], [84, 100], [108, 94], [128, 100], [142, 96], [142, 117.5, 1], [2, 117.5, 1]]);
  s += part(dirt, D.base) + inside(dirt, fill(poly([[0, 108], [144, 104], [144, 130], [0, 130]]), D.shade) + [[16, 104], [48, 108], [88, 106], [124, 108]].map(([x, y]) => fill(circle(x, y, 2.4), D.light)).join(''));
  for (const [x, y] of [[44, 96], [100, 92]]) {
    let claw = '';
    for (let i = 0; i < 4; i++) claw += part(smooth([[x - 6 + i * 5, y], [x - 4 + i * 5, y + 9], [x - 3 + i * 5, y + 13, 1], [x - 1 + i * 5, y + 8], [x - 2 + i * 5, y]]), '#f2c6a0', 2.2);
    s += part(ellipse(x + 2, y - 2, 12, 7), '#d8a07a', 3.4) + claw;
  }
  s += rock(18, 86, 5, '#6a4222') + rock(136, 84, 4, '#6a4222') + line('M30 104l-8 10M112 100l10 12', D.shade, 1.6);
  return end(s);
}

export default {
  card: 23, champion: 'רעם האדמה', en: 'Earth Thunder', theme: 'Card: a self-driving car flipping, wheels and rocks flying · Power: an earthquake shot (Destructive, push)',
  options: [
    { letter: 'A', name: 'Boulder', draw: boulder,
      blurb: 'The ground itself, sat up: a lumpy sandstone golem under a crushing brow, moss and a sprout on its crown, the card\'s rocks flying round it, dust where it lands. <i>Silhouette: a wide, lumpy rock.</i>' },
    { letter: 'B', name: 'Burnout', draw: tire, marks: { eyes: [[69, 57], [90, 55.5]], nose: [80, 66] },
      blurb: 'A wheel off the card\'s flying car, still screeching: its chrome hubcap a gritted face, the brake caliper peeking red, smoke from the burnout, rocks thrown up. <i>Silhouette: a fat ring, tread on the edge.</i>' },
    { letter: 'C', name: 'Star-Nosed Mole', draw: mole,
      blurb: 'What really shakes the ground: a star-nosed mole bursting up through the turf, a pink star of fingers for a nose, eyes squinting, big pink digging claws out on the dirt. <i>Silhouette: a dark dome with a pink star, rising out of a mound.</i>' },
  ],
};
