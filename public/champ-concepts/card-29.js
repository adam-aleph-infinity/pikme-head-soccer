// Card #29 — הכורה (The Miner). Card: Ori toasting champagne in an underwater luxury suite,
// turtles and dolphins behind the glass, a chandelier, a steak ("the strangest, most expensive
// hotels in the world"). Power: a drill that bores through the first blocker (Destructive, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const bubble = (x, y, r) => line(circle(x, y, r), '#bfe8ff', 1.4) + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.3), '#ffffff');

// ---- A: a narwhal, its tusk the drill ---------------------------------------------------------------
function narwhal() {
  begin();
  const N = { base: '#c9d3dc', light: '#e6edf2', hi: '#ffffff', shade: '#96a4b0', spot: '#7a8894' };
  let s = '';
  // the spiral tusk, drilling up and forward, chips flying off its tip
  const tusk = smooth([[118, 66], [143, 18, 1], [126, 72]]);
  s += part(tusk, '#f4ead2', 4.6) + inside(tusk, Array.from({ length: 8 }, (_, i) => line(`M${119 + i * 2.8} ${62 - i * 5.4}l6 1`, '#c9b88a', 1.2)).join('') + fill(poly([[124, 70], [144, 16], [148, 20], [130, 74]]), '#d8c8a2', 'opacity=".7"'));
  for (const [x, y, r] of [[136, 10, 2.4], [142, 4, 2], [130, 14, 1.6]]) s += part(poly([[x - r, y], [x, y - r], [x + r, y + r * 0.4]]), '#8a7a6a', 1.6);
  const head = smooth([[20, 92], [18, 64], [30, 42], [56, 30], [88, 30], [112, 40], [126, 58], [130, 80], [122, 98], [100, 112], [70, 116.5], [38, 112]]);
  s += part(head, N.base);
  s += inside(head, fill(smooth([[0, 30], [36, 40], [30, 80], [40, 130], [0, 130]]), N.shade) + fill(smooth([[56, 32], [96, 34], [116, 50], [84, 46]]), N.light) + line('M60 32q28-2 46 14', N.hi, 2.4) +
    [[30, 52, 3], [40, 70, 2.4], [26, 82, 2.6], [50, 46, 2], [42, 94, 2.2], [60, 102, 1.8], [36, 60, 1.6]].map(([x, y, r]) => fill(ellipse(x, y, r * 1.3, r), N.spot)).join('') +
    fill(smooth([[30, 100], [76, 108], [128, 92], [128, 130], [30, 130]]), N.light));
  s += rim(head, poly([[0, 0], [70, 0], [40, 36], [20, 80], [0, 90]]), 2.2, '#bfe8ff');
  // a determined face, a small smile under the tusk
  s += eyeE({ x0: 62, x1: 78, top: 56, bot: 68, slant: 0.4, nose: 1, px: 73, py: 63, pr: 4 });
  s += eyeE({ x0: 92, x1: 110, top: 54, bot: 67, slant: 0.4, nose: -1, px: 104, py: 61, pr: 4.4 });
  s += browsE([58, 50, 80, 54], [90, 52, 112, 46], 2.8);
  s += mouthE(110, 87, 28, line('M96 86Q110 92 124 84', INK, 2.4) + line('M124 84l3-2', INK, 1.8));
  s += bubble(12, 30, 4) + bubble(20, 16, 2.6) + bubble(8, 104, 3) + bubble(140, 100, 2.4);
  return end(s);
}

// ---- B: the card's champagne, the cork going off -------------------------------------------------
function champagne() {
  begin();
  const GL = { base: '#1f5a3a', light: '#3e8a5a', hi: '#8fd6a8', shade: '#133a26' };
  const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0' };
  let s = '';
  // the foam erupting out of the neck, and the cork flying off
  const foam = smooth([[58, 30], [52, 18], [44, 8], [52, 4], [58, 10], [64, 0], [74, 6], [82, 0], [90, 8], [98, 4], [104, 12], [96, 20], [90, 30]]);
  s += part(foam, '#fffaf0', 4.4) + inside(foam, fill(smooth([[50, 20], [100, 18], [100, 34], [50, 34]]), '#f2e6c8'));
  for (const [x, y, r] of [[40, 22, 3], [110, 22, 3], [34, 34, 2], [118, 36, 2]]) s += part(circle(x, y, r), '#fffaf0', 2.2);
  s += `<g transform="rotate(30 124 10)">` + part(smooth([[116, 4, 1], [132, 4, 1], [130, 18, 1], [118, 18, 1]], true, 0.4), '#d9b07a', 3.4) + line('M118 8h12', '#b08a50', 1.2) + '</g>' + line('M108 22l8-6M112 28l10-2', '#ffffff', 1.6);
  // the bottle: a neck in gold foil, round shoulders, the body
  const bottle = smooth([[58, 30, 1], [90, 30, 1], [90, 46], [104, 58], [114, 74], [114, 112], [108, 117.5, 1], [40, 117.5, 1], [34, 112], [34, 74], [44, 58], [58, 46]]);
  s += part(bottle, GL.base);
  s += inside(bottle, fill(poly([[0, 0], [48, 0], [48, 130], [0, 130]]), GL.shade) + fill(poly([[96, 60], [104, 60], [104, 118], [96, 118]]), GL.light, 'opacity=".6"') + line('M100 70V110', GL.hi, 2) +
    fill(poly([[40, 28], [108, 28], [108, 50], [40, 50]]), G.base) + fill(poly([[40, 28], [62, 28], [62, 50], [40, 50]]), G.shade) + line('M56 44h36', G.light, 1.4));
  s += rim(bottle, poly([[0, 0], [60, 0], [44, 50], [34, 120], [0, 120]]), 2);
  // the label is its face
  const label = ellipse(74, 88, 32, 20);
  s += part(label, '#fbf1dc', 3.4) + line(ellipse(74, 88, 29, 17), G.base, 1.4);
  s += eye({ x0: 54, x1: 68, top: 78, bot: 88, slant: 0.1, nose: 1, px: 64, py: 84, pr: 3.4, r: 2.4 });
  s += eye({ x0: 78, x1: 94, top: 77, bot: 87, slant: 0.1, nose: -1, px: 89, py: 83, pr: 3.6, r: 2.4 });
  const mouth = smooth([[62, 94, 1], [74, 95], [88, 93, 1], [84, 101], [74, 104], [66, 101]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(74, 104, 7, 3), '#ff7a96')) + line(mouth, INK, 1.6);
  s += sparkle(20, 60, 4) + sparkle(130, 70, 3.4) + sparkle(16, 100, 3);
  return end(s);
}

// ---- C: a sea turtle from the card's aquarium -----------------------------------------------------
function turtle() {
  begin();
  const SK = { base: '#8aa65a', light: '#b2cc7a', shade: '#5e7a3a', scale: '#e6d27a' };
  const SH = { base: '#6a5a2e', light: '#8a7a3e', scute: '#a08a46', rim: '#c9a85a' };
  let s = '';
  // the shell arching up behind its head
  const shell = smooth([[6, 112], [4, 70], [18, 38], [46, 18], [80, 14], [104, 22], [98, 42], [70, 42], [48, 54], [40, 74], [42, 112]]);
  s += part(shell, SH.base);
  s += inside(shell, line(shell, SH.rim, 6) + fill(poly([[30, 30], [52, 24], [60, 40], [44, 50], [28, 46]]), SH.scute) + fill(poly([[64, 22], [86, 22], [88, 36], [66, 40]]), SH.scute) +
    fill(poly([[14, 56], [30, 52], [34, 72], [16, 78]]), SH.scute) + fill(poly([[12, 86], [32, 84], [34, 104], [14, 106]]), SH.scute) + line('M44 22q30-10 50 0', SH.light, 2));
  // the head, beaked, plated
  const head = smooth([[40, 100], [38, 74], [48, 54], [70, 44], [96, 46], [116, 56], [130, 66], [138, 80, 1], [128, 90], [110, 96], [100, 108], [76, 116.5], [50, 114]]);
  s += part(head, SK.base);
  s += inside(head, fill(smooth([[30, 50], [56, 56], [52, 90], [56, 130], [30, 130]]), SK.shade) + fill(smooth([[70, 48], [104, 50], [120, 62], [94, 60]]), SK.light) +
    line('M64 50l10 8l12-6l12 8l12-4M70 66l12 4M88 62l10 6', SK.scale, 1.4) + fill(smooth([[96, 90], [138, 80], [138, 110], [100, 110]]), '#d8e2a8'));
  s += rim([shell, head], poly([[0, 0], [70, 0], [30, 30], [10, 80], [0, 110]]), 2.2);
  // wise, half-lidded eyes, a calm beak smile
  s += eye({ x0: 68, x1: 84, top: 62, bot: 73, slant: 0.5, nose: 1, px: 79, py: 69, pr: 3.8 });
  s += eye({ x0: 96, x1: 112, top: 60, bot: 71, slant: 0.5, nose: -1, px: 107, py: 67, pr: 4 });
  s += line('M108 88Q122 90 134 82', INK, 2.4) + line('M120 82l14-2', INK, 1.4);
  // its front flipper paddling under it
  const flip = smooth([[90, 108], [116, 104], [140, 110], [132, 118.5, 1], [96, 118.5, 1]]);
  s += part(flip, SK.base, 4.6) + inside(flip, line('M100 112l30-2', SK.scale, 1.2));
  s += bubble(132, 40, 4) + bubble(140, 28, 2.4) + bubble(122, 24, 1.8) + sparkle(110, 8, 3.4);
  return end(s);
}

export default {
  card: 29, champion: 'הכורה', en: 'The Miner', theme: 'Card: an underwater luxury suite, champagne · Power: a drill through the blocker (Destructive, push)',
  options: [
    { letter: 'A', name: 'Narwhal', draw: fitted(narwhal, [1, 1.1, 0, -8]), marks: { eyes: [[70, 62], [101, 60.5]], nose: [114, 74] },
      blurb: 'The drill that swims, from the card\'s underwater suite: a mottled narwhal driving its spiral tusk up and forward, chips flying off the tip, a determined face. <i>Silhouette: a blunt round head and one long spiral spike.</i>' },
    { letter: 'B', name: 'Pop', draw: champagne,
      blurb: 'The card\'s champagne going off, the push of the power as a cork: a green bottle in gold foil, foam bursting out of its neck like hair, the cork flying, a face on the label. <i>Silhouette: a bottle under a burst of foam.</i>' },
    { letter: 'C', name: 'Old Turtle', draw: turtle,
      blurb: 'A sea turtle from behind the card\'s glass: a plated, beaked head with wise half-lidded eyes, its shell arching up behind it, a flipper paddling, bubbles rising. <i>Silhouette: a beaked head in front of a domed shell.</i>' },
  ],
};
