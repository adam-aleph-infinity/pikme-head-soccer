// Card #26 — המחליק (The Slider). Card: Naveh in Tokyo's neon streets, his belly blown up from
// the vending machines, a trophy held high ("whoever gets fattest from vending machines wins
// 5,000"). Power: an ice puck that slides along the floor and freezes whoever it meets (Ground, freeze).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const ICE = '#bfeeff';

// ---- A: a walrus, belly-sliding across the ice ---------------------------------------------------
function walrus() {
  begin();
  const F = { base: '#b07a5e', light: '#d29c7e', hi: '#ecc4a8', shade: '#8a5640', deep: '#5e3624' };
  let s = line('M2 70h14M4 86h12M0 100h14', '#ffffff', 2, 'opacity=".55"');
  const head = smooth([[18, 90], [16, 64], [28, 44], [52, 32], [84, 30], [108, 38], [124, 54], [130, 74], [126, 94], [112, 108], [80, 116.5], [44, 114], [26, 106]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [36, 40], [30, 80], [40, 130], [0, 130]]), F.shade) + fill(smooth([[60, 32], [100, 36], [116, 50], [86, 46]]), F.light) + line('M64 34q26-4 44 12', F.hi, 2.4) +
    line('M24 90q8 6 20 4M22 100q10 6 24 4', F.deep, 1.6) + [[48, 50], [40, 62], [56, 44]].map(([x, y]) => fill(circle(x, y, 1.4), F.deep)).join(''));
  s += rim(head, poly([[0, 0], [70, 0], [40, 36], [22, 80], [0, 90]]), 2.2, ICE);
  // tusks, then the whiskered muzzle over their roots
  for (const [x0, x1] of [[90, 86], [114, 118]]) { const t = smooth([[x0 - 4, 92], [x0 + 4, 92], [x1 + 2, 120], [x1 - 1, 125, 1], [x1 - 4, 120]]); s += part(t, '#fbf4e4', 4.4) + inside(t, fill(poly([[x0, 90], [x0 + 8, 90], [x1 + 4, 126], [x1, 126]]), '#e2d6bc')); }
  const muz = [ellipse(92, 84, 17, 13), ellipse(115, 82, 15, 12)];
  s += keyline(muz, 5) + muz.map((d) => fill(d, '#e0b49a')).join('') + inside(muz, fill(ellipse(104, 92, 30, 8), '#c99a7e'));
  for (const [x, y] of [[84, 80], [90, 86], [98, 80], [110, 78], [116, 84], [122, 78], [96, 90], [118, 90]]) s += fill(circle(x, y, 1.2), F.deep);
  s += line('M76 82l-10-2M76 88l-10 2M130 78l10-3M130 84l10 1', F.deep, 1.2);
  s += fill(ellipse(104, 72, 6, 3.4), '#3a2420');
  // a fat, happy face
  s += eye({ x0: 60, x1: 76, top: 52, bot: 64, slant: 0.18, nose: 1, px: 71, py: 59, pr: 4 });
  s += eye({ x0: 92, x1: 110, top: 50, bot: 63, slant: 0.18, nose: -1, px: 104, py: 57, pr: 4.4 });
  s += line('M58 46q8-4 18-1M92 44q9-5 20-1', INK, 2.4);
  // the ice it slides on
  const ice = smooth([[0, 112, 1], [144, 108, 1], [144, 120, 1], [0, 120, 1]], true, 0.3);
  s += fill(ice, 'rgba(191,238,255,.8)') + line('M0 112L144 108', '#ffffff', 1.6) + line('M20 116h18M70 115h14', '#ffffff', 1.2);
  s += sparkle(136, 20, 4, ICE) + sparkle(14, 30, 3.4, ICE) + sparkle(140, 96, 3, ICE);
  return end(s);
}

// ---- B: a curling stone, the slider itself -----------------------------------------------------------
function curling() {
  begin();
  const GR = { base: '#9aa0a8', light: '#c6cad0', shade: '#6e747e', deep: '#4a4f58', band: '#5a5f68' };
  const RD = { base: '#d8283a', light: '#ff6a7a', shade: '#9a1424' };
  let s = line('M0 78h14M2 92h10', '#ffffff', 2, 'opacity=".55"');
  // the stone: a squat drum with rounded edges
  const body = smooth([[18, 52], [30, 40], [74, 34], [118, 40], [130, 52], [132, 80], [126, 102], [104, 112], [74, 114.5], [44, 112], [22, 102], [16, 80]]);
  s += part(body, GR.base);
  let speck = '';
  for (let i = 0; i < 40; i++) speck += circle(20 + ((i * 37) % 110), 40 + ((i * 23) % 72), 0.9 + (i % 3) * 0.3);
  s += inside(body, fill(smooth([[0, 30], [40, 40], [34, 80], [40, 130], [0, 130]]), GR.shade) + fill('M0 70Q74 82 144 70V88Q74 100 0 88Z', GR.band) + line('M0 70Q74 82 144 70', GR.light, 1.2) +
    fill(speck, GR.deep, 'opacity=".55"') + fill(ellipse(74, 44, 56, 11), GR.light) + fill(ellipse(76, 44, 30, 7), RD.base) + fill(ellipse(74, 42, 24, 4.6), RD.light) + line('M60 102q14 4 30 0', GR.shade, 1.4));
  s += rim(body, poly([[0, 0], [60, 0], [30, 40], [16, 80], [0, 90]]), 2.2, ICE);
  // the handle on top, like a quiff
  const handle = smooth([[62, 40, 1], [66, 26], [80, 18], [112, 16], [118, 22, 1], [110, 26], [86, 28], [76, 34], [74, 42, 1]]);
  s += part(handle, RD.base, 5) + inside(handle, fill(poly([[60, 24], [120, 14], [120, 20], [60, 30]]), RD.light, 'opacity=".7"') + fill(poly([[60, 34], [80, 30], [80, 44], [60, 44]]), RD.shade));
  // a cool, sliding face on the band
  s += eye({ x0: 52, x1: 68, top: 56, bot: 68, slant: 0.42, nose: 1, px: 64, py: 63, pr: 4 });
  s += eye({ x0: 82, x1: 100, top: 55, bot: 67, slant: 0.42, nose: -1, px: 95, py: 61, pr: 4.4 });
  s += line('M50 50L70 54M80 52L102 46', INK, 2.8);
  s += line('M66 92Q82 98 100 90', INK, 2.4) + line('M100 90l3-3', INK, 1.8);
  // the ice under it, frost spraying
  s += fill(smooth([[0, 112, 1], [144, 110, 1], [144, 120, 1], [0, 120, 1]], true, 0.3), 'rgba(191,238,255,.8)') + line('M0 112L144 110', '#ffffff', 1.6);
  for (const [x, y, r] of [[126, 104, 3], [136, 98, 2.4], [132, 110, 2], [140, 106, 1.6]]) s += part(circle(x, y, r), '#ffffff', 2);
  s += sparkle(130, 26, 4, ICE) + sparkle(12, 44, 3.4, ICE);
  return end(s);
}

// ---- C: a Tokyo vending machine, cold drinks behind frosted glass ---------------------------------
function vending() {
  begin();
  const B = { base: '#f4f6f8', shade: '#c9d3df', deep: '#9aa8b8' };
  let s = '';
  const side = poly([[16, 14], [34, 8], [34, 117.5], [16, 112]]), front = smooth([[34, 8, 1], [124, 8, 1], [124, 117.5, 1], [34, 117.5, 1]], true, 0.15);
  s += fill(poly([[10, 4], [130, 2], [134, 120], [10, 120]]), 'rgba(127,240,255,.12)');
  s += keyline([side, front]) + fill(side, B.shade) + fill(front, B.base);
  s += inside(side, line('M18 30l14-4M18 60l14-4M18 90l14-4', B.deep, 1.2));
  // the drinks display along the top, lit
  const disp = smooth([[40, 14, 1], [118, 14, 1], [118, 46, 1], [40, 46, 1]], true, 0.2);
  s += fill(disp, '#1a2a3a');
  const cans = ['#e5262e', '#3fe06a', '#ffd23a', '#2f8fe0', '#ff8a3a', '#b47bff', '#ffffff'];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { const x = 44 + i * 10.6, y = 18 + r * 14; s += fill(smooth([[x, y, 1], [x + 7, y, 1], [x + 7, y + 10, 1], [x, y + 10, 1]], true, 0.3), cans[(i + r * 3) % 7]) + fill(poly([[x + 1, y + 1], [x + 2.4, y + 1], [x + 2.4, y + 9], [x + 1, y + 9]]), '#ffffff', 'opacity=".5"'); }
  s += inside(disp, fill(poly([[40, 14], [60, 14], [44, 46], [40, 46]]), 'rgba(255,255,255,.25)')) + line(disp, INK, 1.6);
  s += line('M40 49h78', B.deep, 1) + [0, 1, 2, 3, 4, 5, 6].map((i) => fill(circle(47.5 + i * 10.6, 50, 1.4), '#e5262e')).join('');
  // the face on the panel: coin slot for a nose, the drop flap for a mouth
  s += eyeE({ x0: 48, x1: 66, top: 58, bot: 72, slant: 0.18, nose: 1, px: 61, py: 66, pr: 4.6 });
  s += eyeE({ x0: 82, x1: 102, top: 57, bot: 71, slant: 0.18, nose: -1, px: 96, py: 64, pr: 5 });
  s += part(smooth([[106, 60, 1], [112, 60, 1], [112, 74, 1], [106, 74, 1]], true, 0.3), '#5a6470', 2.4) + fill(poly([[108, 62], [110, 62], [110, 72], [108, 72]]), INK);
  const flap = smooth([[50, 88, 1], [110, 88, 1], [110, 106, 1], [50, 106, 1]], true, 0.3);
  s += mouthE(80, 97, 34, fill(flap, '#1a2a3a') + inside(flap, fill(smooth([[70, 96, 1], [96, 92, 1], [98, 104, 1], [72, 108, 1]], true, 0.3), '#e5262e') + line('M74 98l20-4', '#ff9a9a', 1.4)) + line(flap, INK, 2) + line('M50 88h60', '#ffffff', 1.2));
  // frost creeping round the cold corners
  s += fill(smooth([[34, 112], [44, 104], [56, 110], [60, 117.5], [34, 117.5]]), 'rgba(220,245,255,.9)') + fill(smooth([[124, 10], [114, 14], [118, 24], [124, 28]]), 'rgba(220,245,255,.9)');
  s += rim([side, front], poly([[0, 0], [60, 0], [36, 20], [30, 120], [0, 120]]), 2, '#7ff0ff');
  s += sparkle(136, 40, 4, ICE) + sparkle(8, 60, 3.4, ICE) + sparkle(138, 100, 3, ICE);
  return end(s);
}

export default {
  card: 26, champion: 'המחליק', en: 'The Slider', theme: 'Card: a vending-machine belly contest in Tokyo · Power: an ice puck sliding along the floor (Ground, freeze)',
  options: [
    { letter: 'A', name: 'Belly Walrus', draw: walrus,
      blurb: 'The card\'s belly contest won, and taken onto the ice: a fat, happy walrus belly-sliding along the floor like the power\'s puck, ivory tusks, a puffy whiskered muzzle, frost on its edges. <i>Silhouette: a round head over two long tusks.</i>' },
    { letter: 'B', name: 'Curling Stone', draw: curling,
      blurb: 'The ice puck of the power as a sport: a granite curling stone gliding with a cool face on its band, a red handle swept over its top like a quiff, frost spraying behind. <i>Silhouette: a squat drum with a handle.</i>' },
    { letter: 'C', name: 'Vending Machine', draw: fitted(vending, [0.97, 0.97, 0, 0]), marks: { eyes: [[57, 65], [92, 64]], nose: [109, 67] },
      blurb: 'Where the card\'s belly came from: a Tokyo vending machine, cold drinks lit up for its hairline, the coin slot for a nose, the drop flap for a mouth with a can on its tongue, frost on its corners. <i>Silhouette: a tall glowing box.</i>' },
  ],
};
