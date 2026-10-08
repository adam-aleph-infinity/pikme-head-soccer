// Card #13 — המטפס (The Climber). Card: Ori dressed by strangers in Japan for 24 hours: a black
// kimono embroidered with gold dragons, gold jewellery, paper lanterns. Power: a rising rocket
// that lands on the grass and skims in low (Ground).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: a daruma in the kimono's black and gold — the doll that always gets back up --------
function daruma() {
  begin();
  const K = { base: '#26222e', light: '#4a4658', hi: '#8a86a0', shade: '#121016' };
  const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0' };
  const IV = { base: '#fbf1e2', shade: '#e6d2b8' };
  const body = smooth([[74, 6], [104, 10], [124, 28], [134, 56], [134, 86], [126, 106], [106, 116.5], [74, 117.5], [42, 116.5], [22, 106], [14, 86], [14, 56], [24, 28], [44, 10]]);
  let s = part(body, K.base);
  // gold waves (seigaiha) round the base, a gold cloud on the crown
  let waves = '';
  for (let row = 0; row < 2; row++) for (let i = -1; i < 12; i++) {
    const x = 10 + i * 12 + (row ? 6 : 0), y = 110 - row * 6;
    waves += line(`M${x - 6} ${y}a6 6 0 0 1 12 0`, G.base, 1.6) + line(`M${x - 3} ${y}a3 3 0 0 1 6 0`, G.shade, 1.2);
  }
  s += inside(body, fill(smooth([[0, 10], [44, 20], [34, 70], [44, 130], [0, 130]]), K.shade) + fill(smooth([[70, 10], [110, 14], [128, 40], [104, 30]]), K.light) + line('M80 12q26 2 42 22', K.hi, 2.4) +
    fill('M0 98Q74 88 144 98V130H0Z', K.shade) + waves +
    line('M34 26q8-10 20-6q6-8 14-2', G.base, 2.2) + line('M30 36q10-6 18 0', G.shade, 1.6));
  s += rim(body, poly([[0, 0], [70, 0], [36, 30], [18, 80], [10, 110], [0, 110]]), 2.4);
  // 福, fortune, in gold on its side, as a daruma wears it
  s += `<text x="22" y="92" font-family="Hiragino Mincho ProN, Yu Mincho, serif" font-weight="700" font-size="22" fill="${G.base}" stroke="${G.shade}" stroke-width=".6">福</text>`;
  // the face window, framed in gold
  const face = smooth([[56, 40], [80, 32], [110, 36], [126, 54], [126, 80], [114, 96], [90, 101], [66, 97], [52, 80], [50, 58]]);
  s += line(face, INK, 7.4) + line(face, G.base, 4.2) + fill(face, IV.base);
  s += inside(face, fill(smooth([[40, 30], [62, 40], [56, 80], [70, 110], [40, 110]]), IV.shade));
  // crane brows, turtle beard: the daruma's own marks
  s += part(smooth([[52, 52, 1], [58, 40], [70, 40], [80, 52, 1], [68, 47], [58, 49]]), K.base, 2.6);
  s += part(smooth([[86, 52, 1], [96, 37], [114, 34], [126, 46, 1], [110, 42], [96, 47]]), K.base, 2.6);
  for (const [x, y, k] of [[66, 88, -1], [112, 86, 1]]) s += line(`M${x} ${y}q${k * 8} -2 ${k * 8} 6q0 6 ${-k * 6} 6q${-k * 4} 0 ${-k * 4} -4`, G.shade, 2.6);
  // one eye painted, one left blank: the wish is still to come
  const E = expr();
  if (E === 'happy' || E === 'hurt') s += eyeE({ x0: 58, x1: 76, top: 58, bot: 70, nose: 1 }) + eyeE({ x0: 92, x1: 114, top: 55, bot: 69, nose: -1 });
  else {
    const ox = E === 'kick' ? 2 : 0, oy = E === 'sad' ? 3 : 0;
    s += fill(circle(67, 64, 9.5), '#fff') + line(circle(67, 64, 9.5), INK, 2.2);
    s += fill(circle(103, 62, 11.5), '#fff') + inside(circle(103, 62, 11.5), fill(circle(107 + ox, 63 + oy, 7.4), '#0d0a0c') + fill(circle(109.5 + ox, 60 + oy, 2.2), '#fff')) + line(circle(103, 62, 11.5), INK, 2.2);
  }
  s += line('M84 74q4 4 0 8', IV.shade, 2);
  s += mouthE(91, 90, 24, fill(smooth([[82, 88, 1], [100, 86, 1], [96, 92], [86, 92]]), '#d8283a') + line('M82 88Q91 85 100 86', INK, 2));
  s += sparkle(134, 20, 4.5, G.light) + sparkle(12, 18, 3.5, G.light);
  return end(s);
}

// ---- B: a fox folded from indigo paper, a kitsune's red marks -------------------------------
function origami() {
  begin();
  const IN = { dark: '#1f2c6b', base: '#2d3f8f', mid: '#3e57b8', light: '#6f8be0' };
  const PA = { base: '#f4f1e8', shade: '#d9d2c0', deep: '#bdb49e' };
  const P = { A: [30, 4], N: [48, 30], M: [66, 26], L: [86, 30], K: [112, 2], J: [114, 42], I: [118, 56], H: [124, 72], G: [140, 88], F: [104, 110], E: [60, 117], D: [22, 104], C: [8, 72], B: [16, 42],
    p1: [56, 54], p2: [98, 52], p3: [82, 80], p4: [110, 90], p5: [40, 88] };
  const tri = (keys, c) => { const d = poly(keys.map((k) => P[k])); return fill(d, c) + line(d, 'rgba(20,24,60,.35)', 0.7); };
  const out = poly(['A', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B'].map((k) => P[k]));
  let s = keyline(out, 6.2);
  s += tri(['A', 'N', 'B'], IN.dark) + tri(['K', 'L', 'J'], IN.mid) + tri(['N', 'M', 'p1'], IN.mid) + tri(['M', 'L', 'p2'], IN.light) + tri(['M', 'p1', 'p2'], IN.base) +
    tri(['L', 'J', 'I', 'p2'], IN.base) + tri(['B', 'N', 'p1'], IN.base) + tri(['B', 'C', 'p5', 'p1'], IN.dark) +
    tri(['p1', 'p3', 'p5'], PA.shade) + tri(['p1', 'p2', 'p3'], PA.base) + tri(['p2', 'I', 'H', 'p4', 'p3'], '#fffdf6') + tri(['C', 'D', 'p5'], PA.deep) +
    tri(['D', 'E', 'p5'], PA.shade) + tri(['p5', 'p3', 'E'], PA.base) + tri(['E', 'F', 'p4', 'p3'], PA.shade) + tri(['H', 'G', 'p4'], PA.base) + tri(['p4', 'G', 'F'], PA.deep);
  // the ears' paper inner folds
  s += fill(poly([[30, 12], [44, 30], [28, 36]]), '#e9c9c4') + line(poly([[30, 12], [44, 30], [28, 36]]), 'rgba(20,24,60,.35)', 0.7);
  s += fill(poly([[110, 10], [90, 30], [108, 38]]), '#f2d6d0') + line(poly([[110, 10], [90, 30], [108, 38]]), 'rgba(20,24,60,.35)', 0.7);
  s += rim(out, poly([[0, 0], [60, 0], [40, 30], [14, 60], [8, 100], [0, 100]]), 2.2);
  // kitsune marks in red, sly slanted eyes
  s += fill(poly([[46, 70], [58, 66], [52, 74]]), '#e5352c') + fill(poly([[98, 66], [118, 60], [108, 70]]), '#e5352c') + fill(poly([[74, 40], [80, 30], [84, 42]]), '#e5352c');
  s += eye({ x0: 50, x1: 68, top: 54, bot: 64, slant: 0.55, nose: 1, px: 63, py: 61, pr: 3.8, r: 2.4 });
  s += eye({ x0: 92, x1: 114, top: 50, bot: 61, slant: 0.55, nose: -1, px: 107, py: 57, pr: 4, r: 2.4 });
  s += part(poly([[132, 80], [142, 86], [136, 94]]), '#1c120d', 2.4);
  s += line('M106 100L126 96L136 92', INK, 2.2) + line('M126 96l2 4', INK, 1.6);
  s += sparkle(132, 30, 4) + sparkle(14, 116, 3);
  return end(s);
}

// ---- C: a tancho koi, the fish that climbs the waterfall to become a dragon -----------------
function koi() {
  begin();
  const W = { base: '#fbf7f0', shade: '#ddd3c4', deep: '#b9ab96', light: '#ffffff' };
  const R = { base: '#ff4a1f', shade: '#c8300e', light: '#ff8a5a' };
  let s = '';
  const dorsal = smooth([[40, 36], [44, 16], [58, 4, 1], [68, 14], [82, 6, 1], [90, 20], [98, 34]]);
  const finB = smooth([[30, 98], [10, 104], [2, 116, 1], [20, 116], [40, 108]]);
  s += part(dorsal, R.light) + inside(dorsal, line('M50 34L54 10M62 34L66 12M74 34L80 10M86 34L88 18', R.base, 1.4) + fill(poly([[30, 30], [110, 30], [110, 40], [30, 40]]), R.base));
  s += part(finB, W.shade) + inside(finB, line('M8 108L32 102M10 114L34 106', W.deep, 1.2));
  const head = smooth([[20, 92], [16, 68], [26, 46], [48, 32], [78, 28], [104, 33], [122, 46], [134, 64], [138, 80], [130, 98], [110, 111], [76, 116.5], [42, 114], [24, 104]]);
  s += part(head, W.base);
  // scales on the body behind the gill line
  let scales = '';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) scales += line(`M${12 + c * 10 + (r % 2) * 5} ${40 + r * 11}a5.5 5.5 0 0 0 0 11`, W.deep, 1.1);
  s += inside(head, fill(smooth([[0, 30], [50, 34], [44, 70], [50, 130], [0, 130]]), W.shade) + scales +
    // the tancho: one round red crown, like the flag
    fill(ellipse(84, 40, 22, 14, -0.15), R.base) + fill(ellipse(80, 36, 12, 6, -0.2), R.light) +
    fill(circle(30, 60, 4), '#1d1a1e') + fill(circle(40, 92, 3), '#1d1a1e') +
    fill(smooth([[30, 104], [80, 110], [140, 94], [140, 130], [30, 130]]), W.shade) +
    line('M90 46q24 4 40 26', W.light, 2.4));
  s += line('M56 38Q46 70 56 108', INK, 1.8) + line('M60 40Q52 70 60 104', W.deep, 1.2);
  s += rim(head, poly([[0, 0], [70, 0], [40, 30], [20, 60], [12, 110], [0, 110]]), 2.2);
  // eyes set on the sides, a gold ring round the pupils
  for (const [x0, x1, top, bot, nose, px, py, pr] of [[66, 80, 54, 66, 1, 75, 61, 4.4], [98, 116, 50, 64, -1, 110, 58, 5]]) {
    s += eye({ x0, x1, top, bot, slant: 0.28, nose, px, py, pr, ring: '#d9a020' });
  }
  // the round gaping mouth and its barbels
  const lips = ellipse(130, 84, 8, 9.5, -0.2);
  s += part(lips, '#ffb4a8', 4) + fill(ellipse(131, 85, 4.4, 6, -0.2), '#5a1414');
  s += line('M124 92Q128 104 120 112', INK, 3.6) + line('M124 92Q128 104 120 112', '#ffd2a8', 1.6) + line('M134 92Q140 102 136 110', INK, 3.6) + line('M134 92Q140 102 136 110', '#ffd2a8', 1.6);
  // the near pectoral fin
  const finF = smooth([[96, 104], [120, 112], [130, 122, 1], [110, 122], [90, 114]]);
  s += part(finF, W.base) + inside(finF, line('M100 108L126 120M96 112L118 122', W.deep, 1.2));
  for (const [x, y, r] of [[140, 64, 3.2], [134, 50, 2.2], [142, 42, 1.6]]) s += line(circle(x, y, r), '#bfe8ff', 1.4) + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.3), '#fff');
  return end(s);
}

export default {
  card: 13, champion: 'המטפס', en: 'The Climber', theme: 'Card: a black-and-gold kimono in Japan · Power: rising rocket (Ground)',
  options: [
    { letter: 'A', name: 'Daruma', draw: fitted(daruma, [1, 0.99, 0, 0]), marks: { eyes: [[67, 64], [103, 62]], nose: [86, 78] },
      blurb: 'The Japanese doll that always gets back up, a climber\'s charm, lacquered in the kimono\'s black and gold. Crane brows, a turtle beard, gold waves round its base, and one eye painted and one still blank until the wish comes true. <i>Silhouette: a round-bottomed egg.</i>' },
    { letter: 'B', name: 'Origami Kitsune', draw: origami,
      blurb: 'A fox spirit folded out of indigo paper: every plane a flat facet, tall paper ears, a white folded muzzle, red kitsune marks and narrow sly eyes. <i>Silhouette: all angles, two sharp ears and a pointed snout.</i>' },
    { letter: 'C', name: 'Tancho Koi', draw: koi,
      blurb: 'The koi that climbs the waterfall and becomes a dragon. A white tancho with one red crown like the flag, a gaping round mouth with barbels, scales behind the gill, fins fanned out. <i>Silhouette: a blunt fish head under a sail fin.</i>' },
  ],
};
