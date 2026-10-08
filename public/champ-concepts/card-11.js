// Card #11 — המכווץ (The Shrinker). Card: Ori screaming in a haunted forest at night, ghosts
// reaching for her ("24 hours in the most haunted place in the world"). Power: a curse shot
// that takes the hit player's head off for a moment (Ailment: beheaded).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, sparkle, def, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the banshee, the card's ghost with Ori's long hair --------------------------------
function banshee() {
  begin();
  const G = { base: '#dcfbff', light: '#ffffff', shade: '#a6e6f0', deep: '#62c4d8', glow: 'rgba(120,235,255,.22)' };
  // her hair streams back in long wavy locks, each tip curling
  const body = smooth([[84, 14], [110, 20], [126, 40], [133, 66], [132, 92], [126, 116, 1], [114, 106], [104, 117, 1], [92, 108], [80, 117, 1], [68, 108], [56, 116, 1], [46, 106],
    [38, 102], [26, 108], [12, 104], [4, 96, 1], [14, 98], [26, 92], [34, 86], [24, 80], [10, 76], [2, 66, 1], [12, 70], [26, 66], [32, 58], [22, 50], [10, 42], [6, 30, 1], [14, 36], [28, 36], [36, 30], [30, 20], [22, 8, 1], [36, 14], [50, 14], [62, 11]]);
  def('<radialGradient id="aura" cx=".55" cy=".5" r=".5"><stop offset=".55" stop-color="#78ebff" stop-opacity=".28"/><stop offset="1" stop-color="#78ebff" stop-opacity="0"/></radialGradient>');
  let s = fill(ellipse(76, 64, 74, 66), 'url(#aura)');
  s += part(body, G.base);
  s += inside(body, fill(smooth([[0, 20], [40, 30], [44, 60], [40, 100], [50, 130], [0, 130]]), G.shade) +
    line('M40 30Q24 36 14 34M40 58Q24 70 8 70M44 84Q30 98 10 100M50 20Q40 14 28 12', G.deep, 1.6) +
    fill(smooth([[90, 20], [118, 30], [128, 56], [114, 50], [96, 34]]), G.light) +
    fill(smooth([[40, 104], [80, 100], [130, 98], [140, 130], [40, 130]]), G.shade));
  s += rim(body, poly([[0, 0], [100, 0], [60, 20], [30, 50], [10, 100], [0, 100]]), 2.2, '#ffffff');
  // hollow, sorrowful eyes with cold little lights in them, the brows knitted up
  const E = expr();
  for (const [cx, cy, rx, ry0, a0, nose] of [[68, 62, 9, 12, 0.25, 1], [101, 58, 11, 14.5, -0.2, -1]]) {
    if (E === 'happy' || E === 'hurt') { s += eyeE({ x0: cx - rx, x1: cx + rx, top: cy - ry0 * 0.6, bot: cy + ry0 * 0.6, nose }); continue; }
    const ry = E === 'kick' ? ry0 * 0.7 : ry0, a = E === 'kick' ? a0 * 1.8 : a0, ly = E === 'sad' ? 0.45 : 0.15, lx = E === 'kick' ? 0.45 : 0.3;
    const d = ellipse(cx, cy, rx, ry, a);
    s += fill(d, '#13232b') + inside(d, fill(circle(cx + rx * lx, cy + ry * ly, rx * 0.36), '#bff8ff') + fill(circle(cx + rx * lx, cy + ry * ly, rx * 0.16), '#fff')) + line(d, INK, 1.8);
  }
  s += E === 'normal' ? line('M56 46Q64 44 76 48', INK, 2.6) + line('M90 44Q100 38 114 40', INK, 2.6) : browsE([56, 46, 76, 47], [90, 43, 114, 40], 2.6);
  // the wail
  const mouth = ellipse(98, 92, 10, 15, -0.1);
  s += mouthE(98, 92, 26, fill(mouth, '#13232b') + inside(mouth, fill(ellipse(100, 106, 8, 6), '#4fa9bd')) + line(mouth, INK, 2));
  s += line('M120 84l8 -2M121 92l8 2M118 100l7 5', G.deep, 1.8);
  // will-o'-wisps
  for (const [x, y, r] of [[136, 30, 3.6], [8, 118, 2.6], [124, 6, 2.4]]) s += fill(circle(x, y, r * 2.2), G.glow) + part(circle(x, y, r), '#bff8ff', 2.2);
  return end(s);
}

// ---- B: the Headless Horseman's pumpkin: the head that comes off ---------------------------
function pumpkin() {
  begin();
  const P = { base: '#ff8a1c', light: '#ffb04a', hi: '#ffd89a', shade: '#d0600e', deep: '#9a3e06' };
  const GL = { base: '#ffe14a', hot: '#fff6c0', edge: '#ff9e1a' };
  const lobes = [[34, 78, 20, 36], [120, 76, 17, 36], [55, 74, 26, 42], [101, 72, 25, 42], [78, 71, 27, 45]];
  const ds = lobes.map(([x, y, rx, ry]) => ellipse(x, y, rx, ry));
  let s = '';
  // the stem and a curl of vine
  const stem = smooth([[70, 30], [72, 18], [80, 8], [90, 4, 1], [88, 12], [84, 20], [84, 32]]);
  s += line('M84 22Q100 10 108 18Q114 26 104 28Q98 28 100 22', INK, 4.4) + line('M84 22Q100 10 108 18Q114 26 104 28Q98 28 100 22', '#5f8a26', 2);
  s += part(smooth([[58, 26], [44, 16], [36, 20, 1], [44, 28], [56, 32]]), '#5f8a26', 4) + line('M56 28L42 20', '#3f5a16', 1.2);
  s += keyline(ds);
  lobes.forEach(([x, y, rx, ry], i) => {
    const d = ds[i];
    s += fill(d, i === 0 ? P.shade : P.base) + inside(d, fill(ellipse(x + rx * 0.5, y + ry * 0.2, rx, ry), i === 0 ? P.deep : P.shade) +
      (i >= 2 ? line(`M${x - rx * 0.35} ${y - ry * 0.7}Q${x - rx * 0.55} ${y} ${x - rx * 0.35} ${y + ry * 0.6}`, P.light, 2.6) : '')) + line(d, INK, 1.4);
  });
  s += rim(ds, poly([[0, 0], [80, 0], [50, 30], [20, 60], [12, 110], [0, 110]]), 2.2);
  s += part(stem, '#6b8a2a', 4.6) + inside(stem, fill(poly([[80, 0], [100, 0], [100, 40], [84, 40]]), '#3f5a16'));
  // carved face, lit from inside: slanted triangle eyes, a jagged grin, a crack
  const cut = (d) => fill(d, GL.edge) + inside(d, fill(d, GL.base) + fill(d, GL.hot, 'transform="translate(2.2 2.2)"')) + line(d, INK, 1.8);
  s += cut(poly([[52, 56], [76, 66], [58, 74]])) + cut(poly([[88, 64], [114, 52], [108, 72]]));
  s += cut(poly([[90, 76], [97, 84], [86, 85]]));
  s += cut(poly([[56, 88], [66, 92], [70, 86], [78, 94], [86, 88], [94, 95], [102, 87], [110, 92], [120, 82], [116, 98], [106, 106], [96, 101], [86, 108], [76, 102], [66, 106], [60, 98]]));
  s += line('M40 52l6 8l-4 6l6 8', P.deep, 1.6);
  for (const [x, y, r] of [[132, 26, 3], [14, 40, 2.4], [126, 112, 2]]) s += fill(circle(x, y, r * 2), 'rgba(255,200,60,.25)') + part(circle(x, y, r), GL.base, 2.2);
  return end(s);
}

// ---- C: a hollow stump from the haunted forest --------------------------------------------
function stump() {
  begin();
  const B = { base: '#6e5a4a', light: '#8f7a66', hi: '#b39c84', shade: '#4a3a2e', deep: '#2e231b' };
  const M = { base: '#6a9a3a', light: '#9cc95a' };
  let s = '';
  // bare branches clawing up and back
  const br = [smooth([[44, 30], [30, 14], [14, 8, 1], [28, 10], [22, 2, 1], [34, 8], [52, 26]]), smooth([[90, 24], [104, 8], [112, 0, 1], [112, 10], [124, 6, 1], [110, 18], [96, 30]]), smooth([[60, 22], [58, 8], [52, 0, 1], [64, 6], [68, 22]])];
  for (const d of br) s += part(d, B.shade, 5) + inside(d, line(d, B.light, 1.2, 'stroke-dasharray="10 40"'));
  // the trunk: a broken jagged top, roots splaying at the bottom
  const trunk = smooth([[30, 32, 1], [40, 22, 1], [50, 30, 1], [62, 18, 1], [72, 28, 1], [86, 16, 1], [96, 26, 1], [110, 20, 1], [118, 32, 1], [120, 60], [124, 90], [134, 108], [142, 116, 1], [118, 113], [104, 117], [76, 116.5], [50, 117], [34, 113], [6, 117, 1], [18, 104], [26, 86], [28, 58]]);
  s += part(trunk, B.base);
  s += inside(trunk, fill(smooth([[0, 20], [44, 30], [44, 80], [40, 130], [0, 130]]), B.shade) + fill(smooth([[84, 30], [116, 30], [122, 70], [104, 60], [92, 40]]), B.light) +
    // bark grooves
    line('M40 40Q36 70 42 100M52 50Q50 64 54 76M116 40Q120 70 116 98M64 104Q66 110 62 116M98 100Q96 108 100 116', B.deep, 1.6) +
    fill(smooth([[20, 106], [76, 108], [140, 104], [140, 130], [20, 130]]), B.shade));
  // the broken top's pale heartwood
  s += fill(smooth([[42, 26, 1], [50, 33, 1], [62, 22, 1], [72, 31, 1], [86, 20, 1], [96, 29, 1], [108, 24, 1], [104, 34], [76, 36], [48, 34]]), B.hi);
  // moss and three glowing mushrooms
  s += part(smooth([[28, 70], [40, 64], [46, 74], [36, 82], [26, 80]]), M.base, 3.6) + fill(circle(36, 70, 2.4), M.light);
  for (const [x, y, r] of [[118, 84, 6], [126, 92, 4.4], [112, 94, 3.6]]) s += fill(circle(x, y - 2, r * 1.8), 'rgba(200,255,120,.18)') + line(`M${x} ${y}v${r + 2}`, INK, 3) + line(`M${x} ${y}v${r + 2}`, '#e8f0d0', 1.4) + part(`M${x - r} ${y}a${r} ${r * 0.8} 0 0 1 ${2 * r} 0Z`, '#d9ff5a', 2.4);
  s += rim(trunk, poly([[0, 0], [60, 0], [36, 40], [28, 80], [10, 110], [0, 110]]), 2.2);
  // knothole eyes glowing sickly green-gold, a gaping hollow mouth
  for (const [d, cx, cy] of [[smooth([[52, 54, 1], [74, 62, 1], [70, 72], [58, 74], [50, 66]]), 63, 65], [smooth([[88, 60, 1], [112, 50, 1], [114, 64], [104, 72], [92, 70]]), 103, 62]]) {
    s += fill(d, B.deep) + line(d, INK, 2.2) + inside(d, fill(circle(cx + 2, cy + 1, 5), 'rgba(217,255,90,.4)') + fill(circle(cx + 2, cy + 1, 3), '#eaff8a'));
  }
  s += line('M46 50L74 58M88 56L116 44', B.deep, 3.2);
  const mouth = smooth([[66, 86, 1], [86, 82], [110, 84, 1], [106, 100], [92, 108], [80, 106], [70, 98]]);
  s += fill(mouth, B.deep) + inside(mouth, fill(poly([[70, 84], [76, 92], [82, 83], [96, 83], [100, 90], [106, 82]]), B.light)) + line(mouth, INK, 2.2);
  s += sparkle(132, 40, 3, '#eaff8a') + sparkle(8, 60, 2.6, '#eaff8a');
  return end(s);
}

export default {
  card: 11, champion: 'המכווץ', en: 'The Shrinker', theme: 'Card: a night in a haunted forest · Power: a curse that takes your head off (beheaded)',
  options: [
    { letter: 'A', name: 'Banshee', draw: banshee, marks: { eyes: [[68, 62], [101, 58]], nose: [92, 76] },
      blurb: 'One of the card\'s ghosts, with Ori\'s long hair turned to ectoplasm streaming back. Hollow eyes with cold little lights in them, a wail, a tattered hem, wisps floating round her. <i>Silhouette: a glowing teardrop trailing ragged tendrils.</i>' },
    { letter: 'B', name: 'Hollow Jack', draw: pumpkin,
      blurb: 'The Headless Horseman\'s head, the one that comes off: a carved pumpkin lit from inside, slanted eyes and a jagged grin, a cracked rind, a curl of vine. Its power is taking your head. <i>Silhouette: a wide ribbed pumpkin with a crooked stem.</i>' },
    { letter: 'C', name: 'Hollow Stump', draw: stump,
      blurb: 'The forest itself: a broken, hollow stump with bare branches clawing up, knothole eyes glowing sickly green, a gaping hollow mouth, moss and glowing mushrooms, roots gripping the ground. <i>Silhouette: a jagged trunk under twisted branches.</i>' },
  ],
};
