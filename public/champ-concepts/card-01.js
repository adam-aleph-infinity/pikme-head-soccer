// Card #1 — התותחן (The Cannoneer). Card: Shoval in front of the SpongeBob-movie hut he built
// in his backyard, nautical flags, gold coins and bubbles flying. Power: a cannonball, straight
// and heavy, the blocker knocked back (Destructive, blue aura).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, coin, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const bubble = (x, y, r) => line(circle(x, y, r), '#bfe8ff', 1.6) + fill(circle(x - r * 0.35, y - r * 0.35, r * 0.28), '#ffffff');

// ---- A: a pirate parrot, the cannon's captain ---------------------------------------------------
function parrot() {
  begin();
  const P = { base: '#e0282e', light: '#ff5a4a', hi: '#ffa08a', shade: '#a8141e', deep: '#780c14' };
  const BL = '#2f7ae0', YL = '#ffcc33';
  let s = '';
  // crest feathers streaming back: blue, yellow, blue
  s += part(smooth([[32, 50], [14, 42], [0, 44, 1], [12, 56], [30, 64]]), BL, 4.4);
  s += part(smooth([[28, 66], [8, 66], [0, 76, 1], [12, 82], [28, 82]]), YL, 4.4);
  s += part(smooth([[30, 84], [12, 92], [8, 104, 1], [22, 102], [36, 96]]), BL, 4.4);
  // the head
  const head = smooth([[24, 58], [34, 40], [56, 30], [84, 30], [104, 40], [114, 58], [116, 80], [106, 100], [84, 114], [56, 116], [34, 106], [20, 84]]);
  s += part(head, P.base);
  s += inside(head, fill(smooth([[0, 60], [30, 72], [44, 112], [90, 130], [0, 130]]), P.shade) + fill(smooth([[40, 38], [80, 32], [106, 46], [70, 46]]), P.light) +
    line('M32 76q6 4 12 0M28 92q6 4 12 0M42 104q6 4 12 0M60 108q6 4 12 0', P.deep, 1.4));
  s += rim(head, poly([[0, 0], [80, 0], [40, 40], [16, 80], [0, 100]]), 2);
  // the bare white face patch round the front eye, feather lines in it
  const patch = smooth([[72, 50], [94, 44], [108, 54], [108, 72], [94, 82], [76, 78], [68, 64]]);
  s += fill(patch, '#f6efe6') + inside(patch, line('M76 72h10M80 77h14M98 72h8', '#e0a8a0', 1.2)) + line(patch, INK, 1.2);
  // the hooked beak: dark lower, pale upper
  const lower = smooth([[102, 76], [120, 78], [126, 88], [118, 100], [104, 98], [98, 88]]);
  s += part(lower, '#2e2a30', 4.4) + inside(lower, line('M104 92q8 4 16 0', '#5a5660', 1.4));
  const upper = smooth([[98, 54], [116, 46], [132, 52], [140, 66], [140, 82], [134, 98, 1], [130, 84], [120, 76], [104, 76], [96, 66]]);
  s += part(upper, '#f2e6c8', 5);
  s += inside(upper, fill(smooth([[96, 70], [128, 74], [142, 104], [96, 104]]), '#c8b48e') + fill(smooth([[126, 84], [144, 80], [144, 104], [130, 104]]), '#2e2a30') + line('M106 54q18-4 28 10', '#ffffff', 2));
  s += fill(ellipse(108, 58, 2.4, 1.6), INK);
  // the patch over its back eye, a scowl, and the front eye in its white face
  s += line('M48 60L22 48M66 56L86 36', INK, 2.6);
  s += part(ellipse(58, 64, 11, 10, -0.2), '#1c1a22', 3) + fill(ellipse(55, 60, 4, 2.4, -0.5), '#3a3644');
  s += eyeE({ x0: 80, x1: 98, top: 54, bot: 68, slant: 0.5, nose: -1, px: 91, py: 62, pr: 4.4 });
  s += browsE([44, 50, 68, 54], [76, 50, 102, 43], 3.2);
  // the bicorne, with a gold doubloon on it
  const hat = smooth([[14, 42, 1], [24, 22], [46, 10], [74, 6], [102, 10], [124, 22], [134, 38, 1], [112, 32], [74, 30], [36, 36]]);
  s += part(hat, '#26222c') + inside(hat, fill(smooth([[0, 0], [56, 0], [36, 44], [0, 44]]), '#3a3442') + line('M18 40Q74 26 130 36', YL, 2.6));
  s += rim(hat, poly([[0, 0], [70, 0], [30, 44], [0, 44]]), 1.6);
  s += coin(74, 18, 7.4, { squash: 0.9 });
  // bubbles off the card
  s += bubble(132, 24, 5) + bubble(124, 8, 3) + bubble(8, 24, 4) + bubble(16, 12, 2.4) + sparkle(12, 116, 3.4);
  return end(s);
}

// ---- B: a brass diving helmet, eyes in the dark glass ---------------------------------------------
function diver() {
  begin();
  const B = { base: '#d89a3a', light: '#f2c66a', hi: '#fff0b8', shade: '#a8661e', deep: '#6e3e10' };
  let s = '';
  // the air hose curling off its back
  const hose = 'M36 40C16 32 6 18 20 4';
  s += line(hose, INK, 10) + line(hose, '#4a4440', 6) + line(hose, '#6e6862', 2, 'stroke-dasharray="1.6 3.4"');
  // the shoulder plate, wing nuts round it
  const plate = smooth([[14, 117.5, 1], [20, 98], [48, 88], [100, 88], [128, 98], [134, 117.5, 1]]);
  s += part(plate, B.base) + inside(plate, fill(poly([[0, 106], [144, 106], [144, 120], [0, 120]]), B.shade) + line('M24 98Q74 86 124 98', B.light, 2));
  // the dome
  const dome = circle(72, 54, 44);
  s += part(dome, B.base);
  s += inside(dome, fill(circle(82, 64, 44), B.shade) + fill(circle(68, 50, 40), B.base) + fill(ellipse(48, 28, 14, 8, -0.7), B.light) + line('M36 32Q52 12 80 12', B.hi, 2.4));
  s += rim(dome, poly([[0, 0], [80, 0], [40, 40], [16, 80], [0, 90]]), 2);
  // the neck ring, and the wing nuts on the plate
  const neck = smooth([[34, 90, 1], [110, 90, 1], [112, 100, 1], [32, 100, 1]], true, 0.3);
  s += part(neck, B.shade, 4) + line('M38 93h70', B.light, 1.4);
  for (const x of [28, 54, 94, 120]) s += part(circle(x, 109, 3.6), '#c9d2da', 2.4) + line(`M${x - 5.4} 109h10.8`, INK, 1.6);
  // the fitting where the hose goes in, the top port, the barred side port
  s += part(circle(36, 40, 5.4), B.light, 3);
  const top = ellipse(66, 16, 11, 5);
  s += part(top, B.light, 3.4) + fill(ellipse(66, 16, 7.4, 3), '#1d5a6e');
  const side = ellipse(36, 62, 8, 13);
  s += part(side, B.light, 3.4) + fill(ellipse(36, 62, 5.2, 9.6), '#1d5a6e') + line('M33 54v16M36 52v20M39 54v16', B.deep, 1.4);
  // the big front port: bolted ring, dark glass, two eyes glaring out
  const ring = ellipse(86, 58, 27, 30);
  s += part(ring, B.light, 4.4) + inside(ring, fill(ellipse(94, 66, 27, 30), B.shade));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; s += fill(circle(86 + Math.cos(a) * 24, 58 + Math.sin(a) * 27, 1.8), B.deep); }
  const glass = ellipse(86, 58, 20, 23);
  s += fill(glass, '#1d5a6e') + inside(glass, fill(ellipse(80, 52, 20, 23), '#2a7890') +
    eye({ x0: 72, x1: 84, top: 50, bot: 60, slant: 0.45, nose: 1, px: 80, py: 56, pr: 3.4, r: 2 }) +
    eye({ x0: 88, x1: 101, top: 49, bot: 59, slant: 0.45, nose: -1, px: 97, py: 55, pr: 3.6, r: 2 }) +
    line('M70 45L86 50M88 48L104 42', INK, 2.6) + line('M80 70Q89 75 98 68', INK, 2) +
    line('M72 40q-6 8-5 18', '#ffffff', 2.6, 'opacity=".75"') + line('M100 70l4-6', '#ffffff', 1.6, 'opacity=".6"'));
  s += line(glass, INK, 1.6);
  // the exhaust valve, its bubbles rising
  s += part(smooth([[112, 76, 1], [124, 74, 1], [126, 84, 1], [114, 86, 1]], true, 0.3), B.light, 3.4);
  s += bubble(132, 64, 4) + bubble(136, 48, 3) + bubble(128, 36, 5) + bubble(138, 22, 2.6) + bubble(128, 10, 3.6);
  return end(s);
}

// ---- C: the ship's cannon itself -----------------------------------------------------------------------
function cannon() {
  begin();
  const BR = { base: '#c8843e', light: '#eab06a', hi: '#ffe0a8', shade: '#8e5420', deep: '#5e3410' };
  const WD = { base: '#b0352a', light: '#d8584a', shade: '#7a2018' };
  let s = '';
  // the red carriage under it
  const carriage = smooth([[12, 92, 1], [30, 74, 1], [110, 76, 1], [118, 100, 1], [16, 106, 1]], true, 0.3);
  s += part(carriage, WD.base) + inside(carriage, fill(poly([[0, 96], [144, 92], [144, 120], [0, 120]]), WD.shade) + line('M24 84h80M20 92h92', WD.light, 1.2));
  // the barrel, tilted up toward the front
  let b = '';
  b += part(circle(10, 52, 6.4), BR.base, 4.4);
  const barrel = smooth([[14, 52], [20, 32], [40, 22], [106, 28, 1], [106, 76, 1], [40, 82], [20, 72]]);
  b += part(barrel, BR.base);
  b += inside(barrel, fill(poly([[0, 62], [144, 58], [144, 100], [0, 100]]), BR.shade) + fill(smooth([[30, 28], [100, 30], [100, 38], [40, 36]]), BR.light) +
    fill(poly([[40, 0], [48, 0], [48, 100], [40, 100]]), BR.deep, 'opacity=".55"') + fill(poly([[86, 0], [92, 0], [92, 100], [86, 100]]), BR.deep, 'opacity=".55"') +
    line('M44 24v58M89 26v52', BR.hi, 1.2) + line('M30 30Q60 22 100 30', BR.hi, 2));
  b += rim(barrel, poly([[0, 0], [70, 0], [40, 36], [0, 60]]), 2);
  const muzzle = ellipse(108, 52, 10, 27);
  b += part(muzzle, BR.base, 5) + inside(muzzle, fill(ellipse(112, 58, 10, 27), BR.shade)) + fill(ellipse(111, 52, 5.4, 17), '#1a1210') + fill(ellipse(112, 55, 3, 12), '#3a2a20');
  // the fuse at its breech, fizzing
  b += line('M30 26Q26 18 30 10', INK, 3.4) + line('M30 26Q26 18 30 10', '#c9a85a', 1.6);
  b += part(poly([[30, 2], [33, 7], [39, 6], [34, 11], [37, 17], [30, 13], [24, 17], [26, 10], [21, 6], [28, 7]]), '#ffe14a', 2) + fill(circle(30, 10, 1.8), '#ffffff');
  // its face on the barrel
  b += eye({ x0: 48, x1: 64, top: 42, bot: 54, slant: 0.5, nose: 1, px: 59, py: 49, pr: 4 });
  b += eye({ x0: 72, x1: 90, top: 41, bot: 54, slant: 0.5, nose: -1, px: 84, py: 48, pr: 4.4 });
  b += line('M44 36L66 42M70 40L94 33', INK, 3);
  const mouth = smooth([[54, 62, 1], [72, 64], [90, 59, 1], [86, 70], [72, 73], [58, 70]]);
  b += fill(mouth, '#2a1408') + inside(mouth, fill(poly([[52, 59], [92, 56], [92, 63], [52, 66]]), '#fff')) + line(mouth, INK, 1.8);
  s += `<g transform="rotate(-9 60 56)">${b}</g>`;
  // the iron strap holding it down, then the spoked wheels
  s += part(smooth([[52, 74, 1], [62, 74, 1], [64, 84, 1], [52, 86, 1]], true, 0.3), '#3a3d46', 3);
  for (const x of [36, 98]) {
    s += part(circle(x, 104, 13.5), '#8a5a32', 4) + fill(circle(x, 104, 9.6), WD.shade);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; s += line(`M${x - Math.cos(a) * 9.6} ${104 - Math.sin(a) * 9.6}L${x + Math.cos(a) * 9.6} ${104 + Math.sin(a) * 9.6}`, '#c98a52', 2.2); }
    s += part(circle(x, 104, 3.4), '#3a3d46', 2);
  }
  // smoke at the muzzle, and the cannonball leaving in a blue glow
  for (const [x, y, r] of [[126, 38, 6.4], [132, 50, 4.4]]) s += part(circle(x, y, r), '#e8e4dc', 2.4);
  s += fill(circle(134, 18, 11), '#5ab8ff', 'opacity=".35"') + part(circle(134, 18, 7), '#2a2a34', 3) + fill(circle(131.6, 15.6, 2.2), '#8a96a2');
  s += line('M118 28l-8 6M122 32l-6 6', '#bfe8ff', 1.6);
  return end(s);
}

export default {
  card: 1, champion: 'התותחן', en: 'The Cannoneer', theme: 'Card: a SpongeBob-movie hut in the backyard, nautical flags, coins and bubbles · Power: a cannonball (Destructive, blue aura)',
  options: [
    { letter: 'A', name: 'Pirate Parrot', draw: fitted(parrot, [0.99, 0.99, 0, 0]), marks: { eyes: [[58, 64], [89, 61]], nose: [112, 62] },
      blurb: 'The pirate the hut\'s nautical flags and gold coins call for, and whose ship carries the cannon: a scarlet macaw in a black bicorne with a gold doubloon on it, a patch over its back eye, a heavy hooked beak, blue and yellow crest feathers streaming back. <i>Silhouette: a round red head, a big hooked beak, a wide hat.</i>' },
    { letter: 'B', name: 'Brass Diver', draw: diver,
      blurb: 'The card\'s bubbles, and the sea the hut belongs under: an old brass diving helmet with bolted portholes, two eyes glaring out of the dark glass, a rubber air hose curling off its back, bubbles streaming from its valve. <i>Silhouette: a round brass bell on a shoulder plate.</i>' },
    { letter: 'C', name: 'Broadside', draw: cannon,
      blurb: 'The champion\'s name and power in their plainest form: a fat bronze ship\'s cannon on a red carriage with spoked wheels, eyes on the barrel, the fuse fizzing at its breech, a cannonball leaving the muzzle in a blue glow. <i>Silhouette: a thick barrel tilted up, on two wheels.</i>' },
  ],
};
