// Card #27 — שומר הפורטל (The Portal Keeper). Card: three of the crew screaming on a golden
// roller coaster that loops through the clouds ("stuck in Japan's biggest theme park until I've
// ridden everything"). Power: the ball enters a portal, hangs, and comes out still flying (Delay).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };

// ---- A: a torii gate whose opening is a portal ----------------------------------------------------
function torii() {
  begin();
  const V = { base: '#e5452c', shade: '#a82a18', light: '#ff7a5a' };
  let s = '';
  // the portal inside the gate: a vortex with a face
  const portal = smooth([[38, 40, 1], [110, 40, 1], [110, 117.5, 1], [38, 117.5, 1]], true, 0.2);
  s += keyline(portal) + fill(portal, '#2a1458');
  let swirl = '';
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let t = 0; t < 9; t += 0.4) { const r = 4 + t * 4.6, a = t + (k * Math.PI * 2) / 3; pts.push([74 + Math.cos(a) * r * 1.1, 80 + Math.sin(a) * r * 1.05]); }
    swirl += line(smooth(pts, false), ['#8a5aff', '#4fd0ff', '#c88aff'][k], 3.2, 'opacity=".9"');
  }
  s += inside(portal, swirl + fill(circle(74, 80, 14), 'rgba(255,255,255,.35)') + fill(circle(74, 80, 7), 'rgba(255,255,255,.6)'));
  // its face in the swirl: glowing eyes, a knowing smile
  for (const [x, y, w] of [[60, 70, 8], [90, 68, 9]]) s += fill(ellipse(x, y, w + 3, 6), 'rgba(160,240,255,.4)') + part(ellipse(x, y, w, 4.6, -0.12), '#e6fbff', 2.4) + fill(circle(x + 2, y, 2.4), '#2a1458');
  s += line('M62 96Q76 102 92 94', '#e6fbff', 2.6);
  // the pillars and the beams
  const pL = poly([[24, 30], [38, 30], [40, 117.5], [22, 117.5]]), pR = poly([[110, 30], [124, 30], [126, 117.5], [108, 117.5]]);
  const nuki = poly([[14, 34], [134, 34], [134, 42], [14, 42]]);
  const kasagi = smooth([[2, 6, 1], [20, 14], [74, 16], [128, 14], [142, 6, 1], [140, 22], [124, 26], [74, 28], [24, 26], [4, 22]]);
  for (const d of [pL, pR]) s += part(d, V.base) + inside(d, fill(poly([[0, 0], [30, 0], [30, 130], [0, 130]]), V.shade, 'opacity=".6"') + fill(poly([[100, 0], [114, 0], [114, 130], [100, 130]]), V.shade, 'opacity=".6"'));
  s += part(nuki, V.base, 5) + inside(nuki, fill(poly([[0, 39], [144, 39], [144, 44], [0, 44]]), V.shade));
  s += part(kasagi, '#26262e') + inside(kasagi, fill(poly([[0, 18], [144, 18], [144, 30], [0, 30]]), V.base) + line('M20 12q54 6 108 0', '#5a5e6a', 1.6));
  // the plaque at its centre
  s += part(smooth([[66, 24, 1], [82, 24, 1], [82, 40, 1], [66, 40, 1]], true, 0.3), '#26262e', 3) + fill(poly([[69, 27], [79, 27], [79, 37], [69, 37]]), G.base);
  s += rim([pL, kasagi], poly([[0, 0], [60, 0], [30, 20], [24, 120], [0, 120]]), 2);
  s += sparkle(130, 60, 4, '#c88aff') + sparkle(12, 80, 3.4, '#4fd0ff');
  return end(s);
}

// ---- B: a Ferris wheel with a face at its hub ------------------------------------------------------
function wheel() {
  begin();
  const cx = 74, cy = 52, R = 45;
  const cab = ['#e5262e', '#2f8fe0', '#3fe06a', '#ffd23a', '#b47bff', '#ff8a3a', '#4fd0ff', '#ff7eb6'];
  let s = '';
  // the A-frame and the platform
  s += line(`M${cx} ${cy}L42 112M${cx} ${cy}L106 112`, INK, 9) + line(`M${cx} ${cy}L42 112M${cx} ${cy}L106 112`, '#e8e2d0', 4.6);
  const plat = smooth([[28, 106, 1], [120, 106, 1], [124, 117.5, 1], [24, 117.5, 1]], true, 0.3);
  s += part(plat, G.base, 5) + inside(plat, fill(poly([[20, 112], [130, 112], [130, 120], [20, 120]]), G.shade));
  // the rim and the spokes, bulbs round it
  s += line(circle(cx, cy, R), INK, 8.4) + line(circle(cx, cy, R), G.base, 4.4);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; s += line(`M${cx} ${cy}L${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R}`, '#e8e2d0', 1.6); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; s += fill(circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1.2), '#fff6c0'); }
  // gondolas hanging off it
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    const g = smooth([[x - 6, y + 3, 1], [x + 6, y + 3, 1], [x + 7, y + 12], [x, y + 14], [x - 7, y + 12]]);
    s += line(`M${x} ${y}v3`, INK, 2) + part(g, cab[i], 3) + fill(poly([[x - 4, y + 5], [x + 4, y + 5], [x + 4, y + 8], [x - 4, y + 8]]), '#e6f7ff');
  }
  // the hub: its face, yelling with joy like the card's riders
  const hub = circle(cx, cy, 21);
  s += part(hub, '#fffaf0', 5) + inside(hub, fill(circle(cx + 4, cy + 4, 21), '#ece2cc')) + line(circle(cx, cy, 18), G.base, 1.6);
  s += eye({ x0: 60, x1: 72, top: 42, bot: 52, slant: 0.1, nose: 1, px: 68, py: 47, pr: 3.4, r: 2.4 });
  s += eye({ x0: 78, x1: 91, top: 41, bot: 51, slant: 0.1, nose: -1, px: 87, py: 46, pr: 3.6, r: 2.4 });
  s += line('M58 37q6-4 14-1M78 36q7-4 14 0', INK, 2);
  const mouth = smooth([[66, 56, 1], [76, 57], [86, 55, 1], [83, 64], [76, 67], [69, 64]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(76, 67, 6, 3), '#ff7a96')) + line(mouth, INK, 1.6);
  // clouds round its base, like the card's
  for (const [x, y, r] of [[18, 98, 9], [30, 104, 7], [126, 100, 9], [114, 106, 6]]) s += part(circle(x, y, r), '#ffffff', 3);
  s += sparkle(136, 20, 4) + sparkle(10, 24, 3.4);
  return end(s);
}

// ---- C: a carousel horse, round and round forever --------------------------------------------------
function horse() {
  begin();
  const W = { base: '#fbf7f0', shade: '#ddd6c8', light: '#ffffff' };
  const PK = { base: '#ff9ac0', shade: '#e06a98' };
  let s = '';
  // the striped brass pole through it
  const pole = smooth([[58, 0, 1], [66, 0, 1], [66, 120, 1], [58, 120, 1]], true, 0.2);
  s += part(pole, G.base, 4) + inside(pole, Array.from({ length: 12 }, (_, i) => fill(poly([[50, i * 11], [74, i * 11 - 6], [74, i * 11 - 2], [50, i * 11 + 4]]), '#ffffff')).join(''));
  // the carved golden mane, flowing back
  const mane = smooth([[60, 22], [44, 18], [30, 26, 1], [40, 34], [22, 44, 1], [36, 50], [18, 64, 1], [34, 70], [20, 86, 1], [38, 90], [30, 106, 1], [50, 104], [56, 70]]);
  s += part(mane, G.base) + inside(mane, line('M48 24Q34 34 30 40M42 46Q30 56 26 62M40 72Q30 82 28 86M46 94Q40 100 36 104', G.shade, 2));
  // ears, then the head: long, the muzzle down at the front
  s += part(smooth([[66, 22], [70, 4, 1], [80, 18]]), W.base, 4.4) + part(smooth([[78, 22], [86, 6, 1], [92, 22]]), W.shade, 4.4);
  const head = smooth([[48, 106], [46, 72], [52, 44], [66, 26], [88, 22], [106, 30], [120, 46], [134, 62], [140, 80], [136, 96], [124, 104], [108, 104], [96, 112], [86, 117.5, 1], [50, 117.5, 1]]);
  s += part(head, W.base);
  s += inside(head, fill(smooth([[30, 40], [60, 48], [58, 90], [64, 130], [30, 130]]), W.shade) + fill(smooth([[100, 84], [140, 82], [140, 110], [110, 110]]), PK.base, 'opacity=".55"') + line('M74 26q24-2 40 18', W.light, 2.6));
  // the painted bridle with jewels
  s += line('M60 54Q98 50 130 70', '#e5262e', 4.4) + line('M100 52Q104 80 120 98', '#e5262e', 4.4) + [[80, 52], [100, 52], [124, 66], [110, 82]].map(([x, y]) => part(circle(x, y, 2.6), G.base, 1.8)).join('');
  s += rim([head, mane], poly([[0, 0], [70, 0], [40, 30], [20, 80], [0, 100]]), 2);
  // bright painted eyes with lashes, a whinnying grin
  s += eyeE({ x0: 72, x1: 88, top: 42, bot: 54, slant: 0.12, nose: 1, px: 83, py: 49, pr: 4 }) + line('M72 42l-4-3M73 45l-4-1', INK, 1.6);
  s += eyeE({ x0: 98, x1: 114, top: 40, bot: 52, slant: 0.12, nose: -1, px: 109, py: 47, pr: 4.2 });
  s += fill(ellipse(134, 84, 2.4, 1.6), '#7a4a4a');
  const mouth = smooth([[110, 94, 1], [126, 92], [138, 90, 1], [132, 100], [120, 102]]);
  s += mouthE(124, 96, 26, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[108, 90], [140, 88], [140, 94], [108, 96]]), '#fff')) + line(mouth, INK, 1.6));
  s += fill(ellipse(96, 70, 6, 4), PK.base, 'opacity=".7"');
  s += sparkle(130, 20, 4) + sparkle(12, 110, 3.4);
  return end(s);
}

export default {
  card: 27, champion: 'שומר הפורטל', en: 'The Portal Keeper', theme: 'Card: a golden roller coaster looping in the clouds · Power: the ball goes through a portal (Delay)',
  options: [
    { letter: 'A', name: 'Torii Portal', draw: torii,
      blurb: 'The keeper and its portal in one: a Japanese torii gate whose opening is a swirling vortex, a face glowing out of it, the ball goes in and comes out late. <i>Silhouette: two red pillars under a sweeping black beam.</i>' },
    { letter: 'B', name: 'Ferris Wheel', draw: wheel,
      blurb: 'The card\'s theme park, ride by ride: a golden Ferris wheel in the clouds, gondolas round its rim, its face at the hub yelling like the card\'s riders. <i>Silhouette: a big wheel on an A-frame.</i>' },
    { letter: 'C', name: 'Carousel Horse', draw: fitted(horse, [1.04, 1.01, -1, -2]), marks: { eyes: [[80, 48], [106, 46]], nose: [126, 84] },
      blurb: 'The ride that goes round and round forever, like a shot stuck in a portal: a painted carousel horse, a carved gold mane, a jewelled bridle, a striped brass pole straight through it. <i>Silhouette: a long horse head on a pole.</i>' },
  ],
};
