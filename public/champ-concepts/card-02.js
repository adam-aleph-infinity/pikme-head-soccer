// Card #2 — אדון התולעים (Lord of the Worms). Card: Ori screaming in a pit of red-eyed worms
// ("don't choose the wrong button"). Power: worms wrap the blocker's legs and drag him a short
// way (gentle Grab, shock).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const WM = { base: '#ec8a92', light: '#ffc0c4', shade: '#b85a66' };
// A worm: a fat round-capped stroke along the points, ring creases across it, the card's red eyes at its tip.
function worm(pts, w = 8, eyes = true) {
  const d = smooth(pts, false);
  let s = line(d, INK, w + 4.4) + line(d, WM.base, w) + line(d, WM.light, w * 0.26, 'transform="translate(-0.8 -1)"');
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1], [x, y] = pts[i];
    const l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * w * 0.46, ny = (bx - ax) / l * w * 0.46;
    s += line(`M${x - nx} ${y - ny}L${x + nx} ${y + ny}`, WM.shade, 1.2);
  }
  if (eyes) {
    const [x, y] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
    const l = Math.hypot(x - px, y - py) || 1, ux = (x - px) / l, uy = (y - py) / l;
    for (const k of [-1, 1]) {
      const ex = x - ux * 2 + -uy * k * w * 0.26, ey = y - uy * 2 + ux * k * w * 0.26;
      s += fill(circle(ex, ey, w * 0.2), '#e0202a') + fill(circle(ex + 0.4, ey - 0.4, w * 0.07), '#ffffff');
    }
  }
  return s;
}

// ---- A: a can of worms, opened ---------------------------------------------------------------------
function can() {
  begin();
  const M = { base: '#b8c2cc', light: '#e2e8ee', shade: '#7e8a96', deep: '#56606a' };
  const LB = { base: '#3fae4a', light: '#7ad46a', shade: '#2a7e34' };
  let s = '';
  // the lid, peeled back behind it
  const lid = ellipse(40, 26, 28, 12, -0.6);
  s += part(lid, M.base, 4.4) + inside(lid, fill(ellipse(44, 30, 24, 9, -0.6), M.light) + line(ellipse(40, 26, 21, 8, -0.6), M.shade, 1.2));
  // worms behind the rim
  s += worm([[40, 46], [34, 30], [24, 20], [26, 10], [36, 6]], 8.4);
  s += worm([[62, 44], [60, 26], [70, 12], [84, 8], [92, 14]], 9);
  s += worm([[88, 46], [98, 32], [112, 24], [124, 26], [128, 36]], 8.4);
  // the can
  const body = 'M22 44L22 104Q73 124 124 104L124 44Z';
  s += part(body, M.base);
  s += inside(body, fill(poly([[0, 0], [38, 0], [38, 130], [0, 130]]), M.shade) + fill(poly([[104, 0], [112, 0], [112, 130], [104, 130]]), M.light) +
    line('M22 50Q73 64 124 50M22 104Q73 120 124 104', M.deep, 1.2));
  // the green label, the face on it
  const label = 'M10 56Q73 72 136 56L136 96Q73 112 10 96Z';
  s += inside(body, fill(label, LB.base) + inside(label, fill(poly([[0, 0], [38, 0], [38, 130], [0, 130]]), LB.shade) + fill(poly([[100, 0], [108, 0], [108, 130], [100, 130]]), LB.light, 'opacity=".6"')) +
    line('M10 58Q73 74 136 58M10 94Q73 110 136 94', '#ffcc33', 2.4));
  s += rim(body, poly([[0, 0], [60, 0], [36, 40], [30, 120], [0, 120]]), 2);
  // the rim on top and the soil in it
  s += part(ellipse(73, 44, 51, 12), M.light, 4.4) + fill(ellipse(73, 44, 45, 9), '#3a2414') + fill(ellipse(76, 46, 38, 6), '#5a3a22');
  // worms spilling over the front, down past the label
  s += worm([[100, 44], [114, 44], [126, 52], [128, 64], [122, 72]], 8.4);
  s += worm([[46, 42], [36, 40], [26, 46], [24, 56]], 7.4, false);
  s += eye({ x0: 44, x1: 62, top: 70, bot: 82, slant: 0.5, nose: 1, px: 57, py: 77, pr: 4.2 });
  s += eye({ x0: 72, x1: 92, top: 68, bot: 81, slant: 0.5, nose: -1, px: 86, py: 75, pr: 4.6 });
  s += line('M40 64L64 70M70 68L96 60', INK, 3);
  const mouth = smooth([[54, 90, 1], [72, 92], [90, 88, 1], [86, 98], [72, 101], [58, 98]]);
  s += fill(mouth, '#2a1408') + inside(mouth, fill(poly([[52, 87], [92, 85], [92, 91], [52, 93]]), '#fff') + fill(ellipse(76, 101, 9, 4), '#ff7a8a')) + line(mouth, INK, 1.8);
  s += sparkle(136, 12, 3.6) + sparkle(8, 70, 3);
  return end(s);
}

// ---- B: a Venus flytrap, a worm for a tongue ---------------------------------------------------------
function flytrap() {
  begin();
  const G = { base: '#5cb83a', light: '#92dc5a', hi: '#c8f08a', shade: '#3a8a26', deep: '#24601a' };
  const IN = { base: '#e0405a', shade: '#a82038' };
  let s = '';
  // the stem and its leaf
  s += line('M42 96Q36 108 32 117.5', INK, 11) + line('M42 96Q36 108 32 117.5', G.shade, 6.4);
  s += part(smooth([[34, 112], [16, 100], [2, 102, 1], [14, 116], [34, 117.5]]), G.base, 4) + line('M30 112L8 104', G.deep, 1.2);
  // the inside of its mouth
  s += part(smooth([[40, 70], [76, 58], [112, 54], [136, 58], [136, 84], [112, 86], [76, 84]]), '#5a0a1a', 4);
  // the lower lobe: the jaw, its red lining facing up
  const lower = smooth([[30, 72], [32, 94], [52, 110], [88, 116], [118, 106], [138, 86, 1], [112, 80], [78, 78], [48, 76]]);
  s += part(lower, G.base);
  s += inside(lower, fill(smooth([[30, 90], [60, 116], [120, 112], [140, 120], [30, 120]]), G.shade) + fill(smooth([[44, 76], [78, 76], [112, 78], [138, 86], [112, 90], [78, 88], [46, 84]]), IN.base) +
    line('M44 98Q80 112 118 100', G.light, 1.6));
  // the worm, coming out for a tongue
  s += worm([[70, 76], [96, 76], [118, 80], [134, 88], [140, 100], [132, 108]], 9);
  // the upper lobe: the head
  const upper = smooth([[30, 72], [26, 46], [42, 22], [74, 12], [108, 16], [130, 32], [140, 54, 1], [112, 58], [78, 62], [48, 68]]);
  s += part(upper, G.base);
  s += inside(upper, fill(smooth([[0, 30], [40, 40], [44, 80], [0, 80]]), G.shade) + fill(smooth([[50, 22], [96, 16], [124, 32], [90, 30]]), G.light) +
    fill(smooth([[46, 66], [78, 58], [112, 54], [140, 54], [112, 62], [78, 66]]), IN.base) + line('M54 20Q80 12 108 18', G.hi, 2));
  s += rim([upper, lower], poly([[0, 0], [80, 0], [40, 30], [20, 90], [0, 110]]), 2);
  // the spikes along both lips, interlocking like teeth
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    const t = i / 7, x = 52 + t * 84, y = 66 - t * 11;
    teeth += part(poly([[x - 3, y - 1], [x + 3, y - 2], [x + 2, y + 9]]), '#e8f4a8', 2);
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6, x = 58 + t * 76, y = 78 + t * 7;
    teeth += part(poly([[x - 3, y + 1], [x + 3, y + 1], [x - 1, y - 9]]), '#e8f4a8', 2);
  }
  s += teeth;
  // hungry eyes on the top lobe
  s += eye({ x0: 60, x1: 76, top: 30, bot: 42, slant: 0.55, nose: 1, px: 71, py: 37, pr: 4 });
  s += eye({ x0: 86, x1: 104, top: 28, bot: 40, slant: 0.55, nose: -1, px: 98, py: 35, pr: 4.4 });
  s += line('M56 25L78 31M84 29L108 21', INK, 3);
  s += sparkle(12, 30, 3.4) + sparkle(136, 12, 3.6);
  return end(s);
}

// ---- C: a screaming mandrake, roots and all ---------------------------------------------------------
function mandrake() {
  begin();
  const RT = { base: '#e6cca2', light: '#f6e4c4', shade: '#bc9a6a', deep: '#8a6a40' };
  const LF = { base: '#3e9a3a', light: '#6ec45a', shade: '#2a6e28', deep: '#1a4a1c' };
  let s = '';
  // the leaves fanning up on top
  const leaf = (bx, by, ang, len, wd) => {
    const c = Math.cos(ang), sn = Math.sin(ang), px = -sn, py = c;
    const at = (t, k) => [bx + c * len * t + px * wd * k, by + sn * len * t + py * wd * k];
    return smooth([[bx, by, 1], at(0.35, 1), at(0.7, 0.8), [bx + c * len, by + sn * len, 1], at(0.7, -0.8), at(0.35, -1)]);
  };
  const leaves = [[64, 34, -2.5, 44, 10], [68, 32, -2.0, 46, 11], [74, 32, -1.55, 34, 10], [80, 32, -1.1, 44, 11], [84, 34, -0.6, 42, 10]].map(([x, y, a, l, w]) => [leaf(x, y, a, l, w), x, y, a, l]);
  for (const [d, x, y, a, l] of leaves) s += part(d, LF.base, 4.4) + inside(d, fill(leaf(x, y, a, l, 4), LF.shade)) + line(`M${x} ${y}L${x + Math.cos(a) * l * 0.85} ${y + Math.sin(a) * l * 0.85}`, LF.deep, 1.2);
  // purple flowers among the leaves
  for (const [x, y] of [[44, 14], [108, 12]]) {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s += part(circle(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 3), '#b06ae0', 1.6); }
    s += fill(circle(x, y, 2.2), '#ffe14a');
  }
  // the roots dangling below, an earthworm wound through them
  for (const d of ['M42 98Q34 110 22 112Q14 112 12 104', 'M60 106Q60 114 52 117.5', 'M96 104Q104 114 118 112', 'M112 92Q126 96 132 108']) s += line(d, INK, 6.4) + line(d, RT.shade, 2.8);
  // the root itself
  const bulb = smooth([[22, 64], [30, 42], [52, 30], [84, 28], [108, 36], [124, 56], [124, 80], [112, 98], [88, 108], [58, 108], [34, 98], [22, 82]]);
  s += part(bulb, RT.base);
  s += inside(bulb, fill(smooth([[0, 50], [34, 60], [40, 110], [0, 110]]), RT.shade) + fill(smooth([[40, 36], [84, 30], [112, 44], [80, 42]]), RT.light) +
    line('M28 70q8 3 14 0M26 86q10 3 16-2M110 46q6 4 12 2M114 88q-6 3-12 0M40 100q8-2 14 2', RT.deep, 1.4));
  s += rim(bulb, poly([[0, 0], [70, 0], [40, 40], [20, 90], [0, 100]]), 2);
  s += worm([[22, 102], [34, 112], [50, 108], [64, 114], [74, 110]], 6.4);
  // the scream that stops you dead
  s += eye({ x0: 52, x1: 68, top: 52, bot: 66, slant: 0.4, nose: 1, px: 62, py: 60, pr: 3.4 });
  s += eye({ x0: 78, x1: 96, top: 50, bot: 65, slant: 0.4, nose: -1, px: 89, py: 58, pr: 3.6 });
  s += line('M48 46L70 53M76 51L100 42', INK, 3);
  const mouth = smooth([[70, 76], [86, 72], [100, 78], [100, 92], [88, 100], [74, 98], [66, 88]]);
  s += fill(mouth, '#3a0e10') + inside(mouth, fill(poly([[66, 70], [104, 70], [104, 77], [66, 79]]), '#fff') + fill(ellipse(84, 100, 12, 6), '#ff7a8a')) + line(mouth, INK, 2);
  s += line('M108 74q6 8 0 16M116 68q10 14 0 28M124 62q14 20 0 40', '#fff6c8', 2.2);
  return end(s);
}

// ---- D (your request): a green snake, a cobra with its hood spread -----------------------------------------
function snake2() {
  begin();
  const G = { base: '#4cb84a', light: '#86e070', hi: '#c4f7a0', shade: '#2e8a34', deep: '#1c5e24' };
  const BE = { base: '#e2f4a8', shade: '#b8d47a', band: '#9ec05a' };
  let s = '';
  // the coils it rests on
  const coil = smooth([[14, 104], [30, 92], [74, 88], [118, 92], [134, 104], [124, 116], [74, 117.5], [24, 116]]);
  s += part(coil, G.base) + inside(coil, fill(poly([[0, 108], [144, 108], [144, 130], [0, 130]]), G.shade) + line('M22 100Q74 90 126 100', G.light, 2) + line('M30 108q8-4 16 0M60 110q8-4 16 0M92 110q8-4 16 0', G.deep, 1.3));
  // the hood, spread wide
  const hood = smooth([[40, 100], [22, 76], [20, 46], [36, 22], [62, 12], [90, 14], [112, 28], [124, 52], [120, 80], [104, 100]]);
  s += part(hood, G.base);
  s += inside(hood, fill(smooth([[0, 10], [34, 22], [30, 110], [0, 110]]), G.shade) + fill(smooth([[36, 30], [70, 18], [104, 30], [110, 70], [90, 100], [52, 100], [32, 70]]), BE.base) +
    line('M44 50Q72 42 100 50M40 64Q72 56 104 64M42 78Q72 70 102 78M50 90Q72 84 94 90', BE.band, 2.2) + line('M44 22Q70 12 98 20', G.hi, 2));
  s += rim(hood, poly([[0, 0], [70, 0], [36, 30], [16, 80], [0, 100]]), 2);
  // the head, out in front of the hood
  const head = smooth([[46, 54], [54, 36], [78, 28], [104, 32], [124, 44], [136, 58], [132, 72], [112, 80], [82, 82], [58, 76]]);
  s += part(head, G.base);
  s += inside(head, fill(smooth([[40, 66], [80, 74], [136, 62], [136, 90], [40, 90]]), BE.base) + fill(smooth([[40, 30], [60, 36], [56, 80], [40, 80]]), G.shade) +
    line('M70 36q6-4 12 0M86 34q6-4 12 0M102 38q6-4 12 0M78 44q6-4 12 0M94 44q6-4 12 0', G.deep, 1.2) + line('M64 36Q92 26 118 42', G.hi, 2));
  // nostrils, the long smirk, the forked tongue flicking out
  s += fill(ellipse(128, 56, 2, 1.3, 0.3), G.deep) + fill(ellipse(122, 54, 1.8, 1.2, 0.3), G.deep);
  s += mouthE(106, 72, 30, line('M84 70Q108 76 132 66', INK, 2.2) + line('M84 70l-3-3', INK, 1.6));
  s += line('M130 68L136 70', INK, 4.4) + line('M130 68L136 70', '#e5262e', 2.2) + line('M136 70l3.6-3.4M136 70l3.6 3', INK, 3.4) + line('M136 70l3.6-3.4M136 70l3.6 3', '#e5262e', 1.6);
  // yellow snake eyes with slit pupils, a sly brow
  for (const [x0, x1, top, bot, nose, cx, cy] of [[66, 82, 44, 56, 1, 76, 51], [94, 112, 42, 55, -1, 105, 49]]) {
    s += eyeE({ x0, x1, top, bot, slant: 0.5, nose, px: cx, py: cy, pr: 0.1, white: '#ffe14a', pupil: '#ffe14a', ring: '#ffe14a', glint: false });
    if (expr() !== 'happy' && expr() !== 'hurt') s += fill(ellipse(cx + (expr() === 'kick' ? 1.4 : 0), cy + (expr() === 'sad' ? 2 : 0.6), 1.8, 4.6), '#0d0a0c') + fill(circle(cx + 2.4, cy - 2, 1.1), '#ffffff');
  }
  s += browsE([62, 40, 84, 44], [92, 42, 116, 34], 3);
  // the tail tip curling up at the front
  s += line('M120 104Q140 100 136 86', INK, 9) + line('M120 104Q140 100 136 86', G.base, 5);
  s += sparkle(130, 18, 3.6) + sparkle(12, 30, 3);
  return end(s);
}

export default {
  card: 2, champion: 'אדון התולעים', en: 'Lord of the Worms', theme: 'Card: a pit of red-eyed worms, "don\'t choose the wrong button" · Power: worms wrap your legs and pull (gentle Grab, shock)',
  options: [
    { letter: 'A', name: 'Can of Worms', draw: can,
      blurb: 'The card\'s wrong button, pressed: a can of worms, literally opened, its lid peeled back and its pink worms wriggling over the rim like a head of hair, the card\'s little red eyes on every one, a sly face on the green label. <i>Silhouette: a squat can crowned with curling worms.</i>' },
    { letter: 'B', name: 'Flytrap', draw: flytrap,
      blurb: 'The Grab as a plant: a Venus flytrap whose jaws snap on whatever comes close, a fringe of spikes for teeth, hungry eyes on its top lobe, and for a tongue one of the card\'s red-eyed worms, reaching out to wrap your legs. <i>Silhouette: a big open jaw on a short stem.</i>' },
    { letter: 'C', name: 'Mandrake', draw: mandrake,
      blurb: 'Pulled up out of the card\'s soil: a mandrake root whose scream stops you dead (the shock), a crown of dark leaves with purple flowers, wrinkled pale skin, roots trailing below with an earthworm wound through them. <i>Silhouette: a fat root under a fan of leaves, roots dangling.</i>' },
    { letter: 'D', name: 'Green Snake', draw: snake2, marks: { eyes: [[74, 50], [103, 48.5]], nose: [124, 56] }, request: true,
      blurb: 'Your request: a green snake. A cobra rearing up with its hood spread wide, pale banded belly scales inside it, sly yellow eyes with slit pupils, a long smirk and a forked red tongue flicking out, resting on its own coils, the tail tip curling up in front. <i>Silhouette: a round hood with a head in front, on coils.</i>' },
  ],
};
