// Card #8 — האיש המגנטי (The Magnet Man). Card: "Naveh hits the 10": William Tell in a
// medieval tournament, an arrow splitting the apple over his wincing face. Power: a magnet-true
// shot, dead straight at the goal as if on a rail (Straight).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const rad = (a) => (a * Math.PI) / 180;

// An arrow stuck in something at (x, y), its shaft leaving at angle `a` (degrees), `len` long.
function arrow(x, y, a, len, { fl = '#e5352c', fl2 = '#f4efe2', head = false } = {}) {
  const c = Math.cos(rad(a)), s = Math.sin(rad(a)), nx = -s, ny = c;
  const ex = x + c * len, ey = y + s * len;
  let o = line(`M${x} ${y}L${ex} ${ey}`, INK, 5) + line(`M${x} ${y}L${ex} ${ey}`, '#9a6432', 2.4) + line(`M${x + nx * 0.6} ${y + ny * 0.6}L${ex + nx * 0.6} ${ey + ny * 0.6}`, '#c98d52', 0.8);
  if (head) {
    const hd = poly([[x - c * 7, y - s * 7], [x + nx * 3.4, y + ny * 3.4], [x - nx * 3.4, y - ny * 3.4]]);
    o = keyline(hd, 2.6) + fill(hd, '#d6dde4') + o;
  }
  for (const [k, col] of [[-1, fl], [1, fl2]]) {
    const b0 = [ex - c * 12, ey - s * 12], tip = [ex - c * 2 + nx * 5.5 * k, ey - s * 2 + ny * 5.5 * k], back = [ex - c * 15 + nx * 5.5 * k, ey - s * 15 + ny * 5.5 * k];
    const d = poly([[ex, ey], tip, back, b0]);
    o += keyline(d, 2.6) + fill(d, col);
  }
  return o;
}

// ---- A: the target itself, hit -----------------------------------------------------------
function target() {
  begin();
  const ST = { base: '#d9b45a', shade: '#a8822f', light: '#ecd28a', line: '#8a6420' };
  const cx = 84, cy = 68;
  const side = ellipse(cx - 12, cy, 49, 48), face = ellipse(cx, cy, 49, 48);
  let s = '';
  // arrows that landed in the top, shot from the right
  s += arrow(58, 26, -58, 30) + arrow(40, 36, -70, 26, { fl: '#2f7fd6' });
  s += keyline([side, face]);
  s += fill(side, ST.shade) + inside(side, Array.from({ length: 22 }, (_, i) => line(`M${20 + i * 1.7} ${22 + (i % 3) * 2}Q${16 + i * 1.7} 70 ${21 + i * 1.7} ${116 - (i % 4) * 2}`, i % 2 ? ST.line : ST.light, 0.8)).join(''));
  // the painted rings: white, blue, red, gold
  const rings = [[56, '#f4efe2'], [44, '#2f7fd6'], [31, '#e5352c'], [11, '#ffd23a']];
  s += fill(face, ST.base);
  s += inside(face, rings.map(([r, c], i) => fill(ellipse(92, 77, r, r * 0.98), c) + line(ellipse(92, 77, r, r * 0.98), INK, 0.9)).join('') +
    // the lit top-front and the shaded bottom, as flat overlays
    fill(smooth([[30, 120], [60, 96], [100, 104], [140, 90], [140, 130]]), 'rgba(60,20,40,.22)') +
    fill(smooth([[70, 16], [120, 24], [134, 48], [118, 40], [90, 28]]), 'rgba(255,255,255,.28)') +
    line(face, ST.base, 5));
  s += line('M36 40q-4 6-6 14M34 92q4 8 10 14', ST.line, 1);
  s += rim([side, face], poly([[0, 0], [90, 0], [60, 24], [24, 50], [14, 110], [0, 110]]), 2.4);
  // the face: the back eye squeezed shut, the front one popping, gritted teeth
  if (expr() === 'normal') {
    s += line('M54 54L70 60L56 66', INK, 3) + line('M50 46L72 54', INK, 3.4);
    s += eye({ x0: 90, x1: 112, top: 50, bot: 68, slant: 0, nose: -1, px: 100, py: 60, pr: 3.6, lidW: 2.2, glint: true });
    s += line('M90 44Q101 36 114 42', INK, 3.4);
  } else {
    s += eyeE({ x0: 52, x1: 72, top: 52, bot: 66, slant: 0.3, nose: 1, px: 64, py: 60, pr: 3.4 }) + eyeE({ x0: 90, x1: 112, top: 50, bot: 68, slant: 0.3, nose: -1, px: 102, py: 60, pr: 3.6 });
    s += browsE([50, 44, 72, 50], [90, 46, 114, 40], 3.4);
  }
  s += line(circle(92, 77, 6), INK, 1.6) + fill(circle(90, 74.5, 2), '#fff6c0') + line('M89 81q3 2 6 0', '#b8860b', 1.2);
  const mouth = smooth([[66, 90, 1], [90, 92], [116, 87, 1], [114, 101, 1], [92, 104], [68, 102, 1]]);
  s += mouthE(91, 96, 50, fill(mouth, '#fff') + inside(mouth, line('M74 88v18M82 88v18M90 88v18M98 88v18M106 88v18', '#b9b4c4', 1.1) + line('M60 96Q90 99 120 94', '#b9b4c4', 1.2)) + line(mouth, INK, 2.4));
  s += line('M64 88l-4-2M118 85l4-2', INK, 1.6);
  s += fill(smooth([[122, 40], [126, 48], [124, 53], [119, 49]]), '#8fd6ff') + line(smooth([[122, 40], [126, 48], [124, 53], [119, 49]]), INK, 1.1);
  // the apple on top with the winning arrow through it
  const apple = smooth([[78, 14], [84, 6], [92, 8], [98, 4], [106, 8], [108, 18], [100, 26], [86, 26], [78, 20]]);
  s += part(apple, '#e23b2e', 5) + inside(apple, fill(smooth([[70, 14], [86, 30], [70, 30]]), '#a8231b') + line('M84 12q4-4 8-3', '#ff9a86', 2));
  s += part(smooth([[93, 6], [96, 0], [104, -1], [99, 4]]), '#5fb53a', 3) + line('M93 7l-1-5', INK, 1.6);
  s += arrow(66, 18, 182, -50, { fl: '#ffd23a' });
  s += sparkle(130, 18, 4) + sparkle(20, 112, 3);
  return end(s);
}

// ---- B: a horseshoe magnet, red north and blue south ------------------------------------
function magnet() {
  begin();
  const RD = { base: '#e0312b', light: '#ff6a55', hi: '#ffb4a2', shade: '#a51d1c' };
  const BL = { base: '#2f6fe0', light: '#5f9bff', hi: '#b9d4ff', shade: '#1d47a0' };
  const SI = { base: '#dfe6ee', shade: '#9aa7b5', deep: '#6b7786', hi: '#ffffff' };
  const U = smooth([[14, 14, 1], [48, 14, 1], [48, 42], [56, 56], [74, 60], [92, 56], [100, 42], [100, 14, 1], [134, 14, 1], [134, 62], [128, 98], [110, 113], [76, 116.5], [42, 113], [22, 100], [13, 62]]);
  let s = '';
  // field lines arcing between the poles
  for (const [k, op] of [[0, 0.9], [1, 0.55]]) s += line(`M${44 - k * 4} ${12 - k * 2}Q74 ${-6 - k * 4} ${104 + k * 4} ${12 - k * 2}`, '#9ff0ff', 1.6, `opacity="${op}" stroke-dasharray="4 3"`);
  s += part(U, RD.base);
  s += inside(U, fill(poly([[0, 0], [74, 0], [74, 58], [66, 120], [0, 120]]), BL.base) +
    fill(smooth([[0, 10], [26, 10], [24, 70], [34, 100], [60, 118], [0, 118]]), BL.shade) +
    fill(smooth([[108, 10], [126, 10], [128, 60], [116, 70], [108, 50]]), RD.light) + line('M118 30V60', RD.hi, 2.4) +
    fill(smooth([[70, 104], [110, 100], [134, 86], [134, 130], [70, 130]]), RD.shade) +
    line('M74 58L66 120', INK, 1.4) +
    // the silver poles
    fill(poly([[0, 0], [144, 0], [144, 33], [0, 33]]), SI.base) + fill(poly([[0, 0], [24, 0], [24, 33], [0, 33]]), SI.shade) + fill(poly([[100, 0], [108, 0], [108, 33], [100, 33]]), SI.shade) +
    line('M0 33H144', INK, 1.6) + line('M116 18V29', SI.hi, 2.2));
  s += `<text x="27" y="29" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="${BL.shade}">S</text><text x="112" y="29" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="${RD.shade}">N</text>`;
  s += rim(U, poly([[0, 0], [60, 0], [30, 30], [18, 100], [0, 110]]), 2.4);
  // what it has pulled in: filings on the north pole, a bolt and the card's arrow on the south
  for (let i = 0; i < 9; i++) { const x = 104 + i * 3.4, h = 4 + ((i * 5) % 4); s += line(`M${x} 11L${x + ((i % 3) - 1) * 1.5} ${11 - h}`, '#3a3f48', 1.5); }
  s += arrow(48, 10, 194, 42, { fl: '#ffd23a', head: true });
  const bolt = poly([[18, 5], [26, 5], [26, 11], [18, 11]]);
  s += line('M22 8V0', INK, 3.6) + line('M22 8V0', SI.base, 1.6) + keyline(bolt, 2.4) + fill(bolt, SI.shade);
  // a fierce, pulling face on the bend
  s += line('M50 66L72 72', INK, 4) + line('M84 70L110 62', INK, 4.2);
  s += eye({ x0: 52, x1: 72, top: 72, bot: 86, slant: 0.32, nose: 1, px: 66, py: 80, pr: 5.2 });
  s += eye({ x0: 84, x1: 108, top: 69, bot: 86, slant: 0.32, nose: -1, px: 101, py: 78, pr: 5.8 });
  s += line('M98 88q4 5 0 8', INK, 1.6, 'opacity=".7"');
  s += line('M76 103Q92 100 108 98', INK, 2.6) + line('M108 98l4-3', INK, 2) + line('M82 108q10 1 20-2', RD.shade, 1.6);
  // sparks
  for (const [x, y, c] of [[8, 36, '#fff36a'], [140, 40, '#9ff0ff'], [138, 82, '#fff36a']]) s += line(`M${x} ${y}l3 -4l-1 4l4 -3`, c, 1.6);
  return end(s);
}

// ---- C: armour held together by nothing but magnetism ------------------------------------
function knight() {
  begin();
  const SI = { base: '#b9c4cf', light: '#e2e9f0', shade: '#7c8a99', deep: '#4c5866', hi: '#ffffff' };
  const GL = { base: '#5ff2ff', light: '#bffcff', deep: '#18a8c8' };
  let s = '';
  // the glow the plates hang round
  const core = smooth([[16, 52], [34, 18], [74, 8], [116, 18], [136, 54], [126, 98], [96, 116], [52, 116], [24, 96]]);
  s += fill(core, 'rgba(95,242,255,.25)') + fill(smooth([[26, 50], [40, 22], [74, 14], [110, 22], [126, 52], [120, 92], [96, 110], [56, 110], [32, 92]]), GL.deep) + fill(smooth([[36, 52], [50, 28], [76, 22], [104, 30], [116, 54], [110, 86], [90, 102], [58, 102], [40, 88]]), GL.base) + fill(ellipse(78, 62, 26, 24), GL.light);
  // field arcs and the bits orbiting
  s += line('M8 60Q14 10 70 2', GL.base, 1.4, 'opacity=".7" stroke-dasharray="3 3"') + line('M136 70Q142 118 90 128', GL.base, 1.4, 'opacity=".7" stroke-dasharray="3 3"');
  const nut = poly([[8, 22], [14, 18], [20, 22], [20, 29], [14, 33], [8, 29]]);
  s += part(nut, SI.shade, 3) + fill(circle(14, 25.5, 2.6), INK);
  const shoe = 'M128 96a8 8 0 1 0 14 0';
  s += line(shoe, INK, 7) + line(shoe, '#e0312b', 3.6) + line('M128 96v-2M142 96v-2', INK, 7) + line('M128 96v-2M142 96v-2', SI.light, 3.4);
  const tip = poly([[4, 104], [16, 98], [14, 108]]);
  s += part(tip, SI.light, 3) + line('M14 103L30 96', INK, 4.4) + line('M14 103L30 96', '#9a6432', 2);
  // the crest: iron filings stood up along the field
  const crest = smooth([[46, 18], [38, 8, 1], [50, 10], [54, 2, 1], [62, 8], [70, 1, 1], [76, 7], [88, 2, 1], [90, 9], [104, 6, 1], [100, 14], [112, 15, 1], [104, 22]]);
  s += part(crest, '#3a3f48', 5) + inside(crest, line('M50 18L45 8M58 16L55 4M68 14L70 2M80 14L86 4M92 16L101 9', '#8e98a6', 1.4));
  // the plates, each on its own, a gap of glow between them
  const dome = smooth([[30, 39, 1], [34, 22], [52, 12], [80, 9], [106, 16], [120, 28], [123, 39, 1]]);
  const back = smooth([[12, 50, 1], [33, 48, 1], [35, 98, 1], [20, 92], [12, 74]]);
  const visor = smooth([[44, 47, 1], [118, 47], [138, 57, 1], [118, 69], [46, 71, 1]]);
  const jaw = smooth([[40, 80, 1], [116, 78, 1], [124, 96], [112, 112], [80, 116.5], [50, 112], [42, 100]]);
  for (const [d, rot] of [[dome, 0], [back, 0], [jaw, 0]]) s += part(d, SI.base);
  s += inside(dome, fill(smooth([[20, 20], [56, 16], [44, 44], [20, 50]]), SI.shade) + fill(poly([[70, 0], [82, 0], [84, 50], [72, 50]]), '#c8282e') + line('M70 0L72 50M82 0L84 50', '#ffd23a', 1.4) +
    line('M90 18q16 4 26 18', SI.hi, 2.6) + fill(circle(40, 38, 1.6), SI.deep) + fill(circle(110, 36, 1.6), SI.deep));
  s += inside(back, fill(poly([[0, 40], [30, 40], [30, 110], [0, 110]]), SI.shade) + line('M22 58l12 0M22 66l12 0M22 74l12 0', SI.deep, 1.4));
  s += inside(jaw, fill(smooth([[30, 100], [80, 108], [130, 96], [130, 130], [30, 130]]), SI.shade) + fill(smooth([[30, 80], [60, 84], [50, 120], [30, 120]]), SI.shade) +
    line('M64 88v14M72 88v16M80 88v16M88 88v16M96 88v14M104 87v12', SI.deep, 2) + line('M92 82q14 0 22 4', SI.hi, 1.6));
  s += part(visor, SI.light);
  s += inside(visor, fill(smooth([[40, 66], [90, 68], [138, 60], [140, 80], [40, 80]]), SI.base) + line('M50 54q40-4 80 4', SI.hi, 1.6));
  // the eye slit, two glowing eyes glaring out of it
  const slit = poly([[54, 55], [116, 54], [124, 57], [116, 61], [54, 62]]);
  s += fill(slit, '#0b1c26') + line(slit, INK, 1.4);
  s += fill(poly([[62, 55.5], [78, 58], [76, 61], [62, 61]]), GL.light) + fill(poly([[90, 58], [110, 55], [112, 60], [92, 61]]), GL.light) + line('M60 56L79 58.5M89 58.5L112 55', GL.base, 0.8);
  // sparks jumping the gaps
  for (const [x, y] of [[60, 43], [96, 43], [70, 76], [104, 75], [39, 70]]) s += line(`M${x - 3} ${y - 2}l2 2.5l2-2.5l2 2.5`, '#ffffff', 1.3);
  s += rim([dome, back], poly([[0, 0], [70, 0], [40, 30], [20, 80], [0, 90]]), 2.2);
  s += sparkle(132, 22, 4, GL.light) + sparkle(30, 124, 3, GL.light);
  return end(s);
}

export default {
  card: 8, champion: 'האיש המגנטי', en: 'The Magnet Man', theme: 'Card: William Tell, the arrow and the apple · Power: magnet-true straight shot',
  options: [
    { letter: 'A', name: 'Bullseye', draw: target, marks: { eyes: [[62, 60], [101, 59]], nose: [92, 77] },
      blurb: 'The target from the card\'s tournament, come to life and wincing mid-hit: a straw butt painted in rings with a gold 10 for a nose, arrows sticking out of its head and the split apple on top. <i>Silhouette: a round drum bristling with arrows.</i>' },
    { letter: 'B', name: 'Polarity', draw: magnet,
      blurb: 'The power itself as a head: a horseshoe magnet, south pole blue and north pole red, field lines arcing between its horns. Filings, a bolt and the card\'s arrow stuck to the poles. <i>Silhouette: a U with a hole in the middle.</i>' },
    { letter: 'C', name: 'Ferrous Knight', draw: knight,
      blurb: 'An empty tournament helm held together by magnetism: plates float apart round a glowing core, eyes burning in the visor slit, iron filings stood up for a plume, scrap circling it. <i>Silhouette: a broken helmet with orbiting bits.</i>' },
  ],
};
