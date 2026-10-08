// Card #31 — השואב (The Vacuum). Card: Naveh in a dungeon of a "one-star hotel", rats on the
// walls, cobwebs, clutching mouldy bread ("a whole day in the scariest places in Japan"). Power:
// a vacuum that seizes the keeper and drags him into his own goal (Grab, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const web = (x, y, k) => line(`M${x} ${y}l${14 * k} 14M${x} ${y}l${20 * k} 4M${x} ${y}l${4 * k} 20M${x + 7 * k} ${y + 2}q${3 * k} 5 ${-4 * k} 6M${x + 13 * k} ${y + 3}q${3 * k} 8 ${-8 * k} 11`, '#d8dce4', 1, 'opacity=".7"');

// ---- A: a rat crowned with the card's mouldy bread -------------------------------------------------
function ratKing() {
  begin();
  const F = { base: '#8a7a6e', light: '#b0a090', hi: '#d0c4b4', shade: '#5e5048' };
  let s = web(2, 2, 1) + web(142, 2, -1);
  for (const [x, y, r] of [[30, 40, 15], [100, 32, 14]]) s += part(circle(x, y, r), F.base) + fill(circle(x + 2, y + 2, r * 0.62), '#ff9ab0') + fill(circle(x + 4, y + 4, r * 0.3), '#e0708a');
  const head = smooth([[24, 94], [20, 70], [30, 50], [52, 40], [80, 38], [102, 46], [118, 60], [134, 70], [142, 80, 1], [134, 88], [118, 94], [106, 106], [80, 116.5], [46, 114], [30, 106]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [40, 42], [34, 80], [44, 130], [0, 130]]), F.shade) + fill(smooth([[60, 40], [100, 44], [116, 58], [86, 54]]), F.light) + line('M64 42q24-2 40 12', F.hi, 2.2) +
    fill(smooth([[90, 80], [140, 80], [130, 96], [108, 104], [92, 96]]), F.hi, 'opacity=".55"'));
  s += rim(head, poly([[0, 30], [70, 30], [40, 50], [24, 80], [0, 90]]), 2.2);
  // the pink nose, long whiskers, buck teeth
  s += part(ellipse(140, 80, 4.4, 3.6), '#ff7a96', 2.4);
  s += line('M128 84l14 6M128 86l12 12M126 80l16-4', '#3a302a', 1);
  s += part(smooth([[118, 92, 1], [126, 91, 1], [126, 102, 1], [118, 102, 1]], true, 0.3), '#f2e2a8', 2) + line('M122 92v10', '#c9b46a', 1);
  // beady, scheming eyes
  s += eyeE({ x0: 62, x1: 76, top: 60, bot: 70, slant: 0.5, nose: 1, px: 72, py: 66, pr: 3.6, r: 2.2 });
  s += eyeE({ x0: 88, x1: 104, top: 58, bot: 69, slant: 0.5, nose: -1, px: 99, py: 64, pr: 3.8, r: 2.2 });
  s += browsE([58, 54, 78, 58], [86, 56, 108, 48], 2.8);
  s += mouthE(109, 100, 22, line('M100 98Q110 104 118 100', INK, 2));
  // its crown: a slice of the card's mouldy bread
  const toast = smooth([[48, 34, 1], [46, 14], [54, 6], [66, 6], [72, 2], [82, 6], [86, 16], [84, 36, 1]]);
  s += `<g transform="rotate(-8 66 22)">` + part(toast, '#a8642e', 5) + fill(smooth([[52, 32, 1], [51, 16], [57, 11], [67, 11], [73, 7], [79, 11], [81, 18], [80, 32, 1]]), '#f2d9a0') +
    [[58, 18, 3], [72, 24, 3.6], [64, 28, 2], [76, 14, 2.2]].map(([x, y, r]) => fill(circle(x, y, r), '#7ab84a') + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.4), '#b8e08a')).join('') + '</g>';
  return end(s);
}

// ---- B: the vacuum cleaner, its hose a trunk -------------------------------------------------------
function vacuum() {
  begin();
  const Y = { base: '#ffcf3a', shade: '#e09a12', light: '#ffe88a', deep: '#a86a08' };
  let s = '';
  // what it's sucking in: a sock, a coin, a dust bunny
  s += line('M140 104q-8-6-14-2M142 92q-10-2-16 4M132 118q-4-6-8-6', '#ffffff', 1.4, 'opacity=".7"');
  s += part(smooth([[136, 74], [142, 72], [144, 82], [140, 86], [134, 82]]), '#e5262e', 2.4) + part(circle(128, 84, 3.4), '#ffc92e', 2) + part(circle(140, 100, 3), '#b9b4c4', 2);
  // wheels for feet
  for (const x of [38, 96]) s += part(circle(x, 110, 7), '#3a3d46', 4) + fill(circle(x, 110, 2.6), '#8a96a2');
  const body = smooth([[22, 62], [30, 40], [54, 30], [86, 30], [104, 40], [112, 60], [114, 92], [106, 106], [74, 110], [40, 108], [26, 98]]);
  s += part(body, Y.base);
  s += inside(body, fill(smooth([[0, 30], [36, 40], [30, 80], [36, 130], [0, 130]]), Y.shade) + fill(smooth([[60, 32], [96, 36], [110, 54], [84, 48]]), Y.light) + line('M64 34q24-2 40 14', '#fff6c8', 2.4) +
    fill(smooth([[20, 96], [74, 104], [120, 94], [120, 130], [20, 130]]), Y.deep));
  // the clear bin on its side, dust spinning in it
  const bin = smooth([[30, 54, 1], [52, 50, 1], [54, 92, 1], [32, 94, 1]], true, 0.4);
  s += fill(bin, '#d8e8f0') + inside(bin, line('M34 60q16 4 16 12q0 8-14 8q-8 0-8 6q0 6 12 8', '#8a8f9a', 2.4) + fill(circle(40, 86, 4), '#a0a4ae')) + line(bin, INK, 1.6);
  // the power button on top
  s += part(ellipse(70, 28, 7, 3.6), '#e5262e', 3) + fill(ellipse(69, 27, 3, 1.4), '#ff9a9a');
  s += rim(body, poly([[0, 0], [70, 0], [40, 30], [24, 70], [0, 90]]), 2.2);
  // a greedy face, the hose coming out where its nose would be
  s += eye({ x0: 62, x1: 78, top: 46, bot: 58, slant: 0.45, nose: 1, px: 73, py: 53, pr: 4 });
  s += eye({ x0: 86, x1: 104, top: 45, bot: 57, slant: 0.45, nose: -1, px: 98, py: 52, pr: 4.4 });
  s += line('M58 40L80 44M84 42L106 36', INK, 2.8);
  s += line('M64 84Q74 90 84 84', INK, 2.2);
  const hose = 'M104 70Q140 62 138 90Q136 108 118 112';
  s += line(hose, INK, 15) + line(hose, '#5a5f68', 10) + line(hose, '#8a8f9a', 10, 'stroke-dasharray="2 4"');
  s += part(smooth([[96, 66, 1], [110, 64, 1], [110, 78, 1], [96, 78, 1]], true, 0.4), '#3a3d46', 3);
  const nozzle = poly([[110, 106], [126, 108], [130, 118], [104, 118]]);
  s += part(nozzle, '#3a3d46', 3.4) + fill(poly([[106, 116], [128, 116], [128, 118], [106, 118]]), '#1c1a22');
  return end(s);
}

// ---- C: a jumping spider dropping in on its thread -------------------------------------------------
function spider() {
  begin();
  const B = { base: '#26222e', light: '#4a4458', hi: '#7a7290', shade: '#16131c' };
  let s = web(2, 2, 1) + line('M74 0V30', '#d8dce4', 1.4);
  // legs, bent, four a side
  const leg = (pts, c) => line(smooth(pts, false), INK, 7) + line(smooth(pts, false), c, 4);
  s += leg([[34, 70], [16, 46], [6, 62]], B.light) + leg([[30, 82], [8, 74], [2, 96]], B.light) + leg([[36, 96], [14, 104], [10, 118]], B.light);
  s += leg([[112, 60], [132, 26], [142, 40]], B.hi) + leg([[118, 74], [140, 64], [144, 86]], B.light) + leg([[112, 94], [134, 104], [138, 118]], B.light);
  const head = smooth([[24, 92], [22, 64], [34, 42], [58, 30], [90, 30], [112, 42], [124, 62], [124, 86], [112, 104], [86, 114], [54, 114], [34, 106]]);
  // fuzz round its edge
  let fuzz = '';
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2, x = 74 + Math.cos(a) * 50, y = 72 + Math.sin(a) * 41; fuzz += `M${x} ${y}l${Math.cos(a) * 4} ${Math.sin(a) * 4}`; }
  s += line(fuzz, INK, 2.4);
  s += part(head, B.base);
  s += inside(head, fill(smooth([[60, 32], [98, 34], [116, 48], [86, 46]]), B.light) + line('M64 34q24-2 40 12', B.hi, 2) +
    // white spots and an orange band across its back
    fill('M24 52Q74 40 124 52V58Q74 46 24 58Z', '#ff8a3a') + [[46, 44], [100, 42], [38, 70], [114, 66]].map(([x, y]) => fill(circle(x, y, 2.6), '#ffffff')).join(''));
  s += rim(head, poly([[0, 0], [70, 0], [40, 36], [24, 80], [0, 90]]), 2, '#ff8a3a');
  // two huge front eyes, four little ones above
  for (const [cx, cy, r] of [[64, 70, 12], [98, 68, 13]]) s += part(circle(cx, cy, r), '#0d0a0c', 3) + line(circle(cx, cy, r - 1.4), '#3fc0a0', 1.2) + fill(circle(cx + r * 0.35, cy - r * 0.35, r * 0.28), '#ffffff') + fill(circle(cx - r * 0.3, cy + r * 0.4, r * 0.12), '#ffffff');
  for (const [x, y, r] of [[44, 58, 4], [118, 56, 4.4], [58, 48, 3], [96, 46, 3.2]]) s += part(circle(x, y, r), '#0d0a0c', 2) + fill(circle(x + r * 0.3, y - r * 0.3, r * 0.3), '#fff');
  // iridescent fangs, fuzzy palps
  for (const x of [72, 90]) s += part(ellipse(x, 100, 8, 9), '#2a6a6a', 3) + fill(ellipse(x - 2, 97, 3, 4), '#5fe0c8');
  s += part(circle(56, 98, 6), B.light, 3) + part(circle(108, 96, 6), B.light, 3);
  return end(s);
}

export default {
  card: 31, champion: 'השואב', en: 'The Vacuum', theme: 'Card: a dungeon of a hotel, rats, cobwebs, mouldy bread · Power: a vacuum that drags the keeper in (Grab, push)',
  options: [
    { letter: 'A', name: 'Rat King', draw: fitted(ratKing, [1.01, 1.01, 0, -1]), marks: { eyes: [[69, 65], [96, 63.5]], nose: [114, 88] },
      blurb: 'The card\'s dungeon rat, risen to the throne: big pink ears, beady scheming eyes, long whiskers, buck teeth, and for a crown a slice of the mouldy bread from the card. <i>Silhouette: two round ears and a pointed snout under a toast crown.</i>' },
    { letter: 'B', name: 'Hoover', draw: vacuum,
      blurb: 'The power as a machine: a canister vacuum with a greedy face, its hose coming out where a nose would be like a trunk, dust spinning in its see-through bin, sucking in a sock and a coin. <i>Silhouette: a round canister with a trunk curling round.</i>' },
    { letter: 'C', name: 'Jumping Spider', draw: spider,
      blurb: 'The card\'s cobwebs have an owner: a fuzzy jumping spider dropping in on its thread, two huge front eyes and four little ones, an orange band, teal fangs, legs up. It grabs, like the power. <i>Silhouette: a fuzzy dome with bent legs out each side.</i>' },
  ],
};
