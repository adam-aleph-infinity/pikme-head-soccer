// Card #10 — הענק (The Giant). Card: "fire mufleta": a guy breathing a jet of fire through a
// ring of flame, chilli peppers flying. Power: a giant heads it down from above at a slant
// (Downward), its sign the 🗿 giant head.
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const FI = { red: '#ff3d1f', dred: '#c8200f', orange: '#ff7a1a', yellow: '#ffb627', core: '#fff2a8' };

// A jet of fire leaving (x, y) toward +x: layered tongues, no keyline on the inner ones.
function jet(x, y, len, h) {
  const outer = smooth([[x, y - h * 0.35], [x + len * 0.4, y - h * 0.6], [x + len * 0.75, y - h * 0.9], [x + len, y - h * 0.3, 1], [x + len * 0.86, y], [x + len, y + h * 0.4, 1], [x + len * 0.7, y + h * 0.8], [x + len * 0.35, y + h * 0.55], [x, y + h * 0.35]]);
  const mid = smooth([[x, y - h * 0.22], [x + len * 0.5, y - h * 0.45], [x + len * 0.82, y - h * 0.2, 1], [x + len * 0.7, y + h * 0.1], [x + len * 0.8, y + h * 0.35, 1], [x + len * 0.4, y + h * 0.35], [x, y + h * 0.22]]);
  const core = smooth([[x, y - h * 0.1], [x + len * 0.45, y - h * 0.18], [x + len * 0.6, y, 1], [x + len * 0.4, y + h * 0.16], [x, y + h * 0.1]]);
  return part(outer, FI.orange, 4.6) + fill(mid, FI.yellow) + fill(core, FI.core);
}

// ---- A: a fire spirit, the card's flame with a face ---------------------------------------
function blaze() {
  begin();
  const outer = smooth([[24, 114], [14, 96], [12, 76], [16, 58], [6, 44], [2, 28, 1], [20, 38], [22, 20], [30, 4, 1], [40, 22], [50, 10], [60, 0, 1], [66, 18], [78, 10], [90, 3, 1], [92, 22], [106, 18], [120, 10, 1], [116, 30], [128, 42], [134, 60], [136, 80], [130, 100], [118, 113], [76, 116.5]]);
  const mid = smooth([[30, 110], [22, 92], [22, 72], [28, 56], [20, 40, 1], [36, 46], [40, 28, 1], [50, 38], [60, 18, 1], [68, 34], [82, 24, 1], [86, 38], [104, 30, 1], [104, 44], [120, 56], [126, 78], [120, 100], [104, 112], [70, 114]]);
  const inner = smooth([[44, 108], [36, 92], [38, 72], [48, 56], [58, 44, 1], [64, 52], [78, 40, 1], [82, 52], [100, 46, 1], [104, 58], [114, 74], [112, 96], [98, 108], [70, 111]]);
  let s = keyline(outer) + fill(outer, FI.red);
  s += inside(outer, fill(smooth([[0, 30], [24, 40], [24, 80], [34, 120], [0, 120]]), FI.dred));
  s += fill(mid, FI.orange) + fill(inner, FI.yellow) + fill(ellipse(84, 84, 22, 18), FI.core);
  s += rim(outer, poly([[0, 0], [144, 0], [144, 20], [40, 30], [16, 70], [0, 80]]), 2, '#fff2a8');
  // embers banked at the base
  for (const [x, y, w, h] of [[34, 112, 12, 7], [52, 115, 13, 6], [72, 116, 14, 6], [94, 115, 13, 6], [112, 111, 11, 7]]) {
    const d = ellipse(x, y, w / 2 + 1, h / 2 + 1);
    s += part(d, '#5a1a10', 3) + line(`M${x - w * 0.3} ${y - h * 0.15}l${w * 0.4} 0`, '#ff8a3a', 1.6);
  }
  // hollow eyes with white-hot pupils, slanted into a scowl
  const E = expr();
  for (const [x0, x1, top, bot, nose0, px0, py0, pr] of [[52, 72, 62, 78, 1, 66, 71, 4.2], [86, 110, 58, 77, -1, 102, 68, 4.8]]) {
    if (E === 'happy' || E === 'hurt') { s += eyeE({ x0, x1, top: top + 2, bot, nose: nose0 }); continue; }
    const nose = E === 'sad' ? -nose0 : nose0, k = E === 'kick' ? 0.62 : 0.45, px = px0 + (E === 'kick' ? 1.6 : 0), py = py0 + (E === 'sad' ? 2.5 : 0);
    const h = bot - top, yl = top + (nose > 0 ? 0 : k * h), yr = top + (nose > 0 ? k * h : 0);
    const d = smooth([[x0, yl, 1], [x1, yr, 1], [x1 - 1, bot - 3], [(x0 + x1) / 2, bot + 1], [x0 + 1, bot - 3]]);
    s += fill(d, '#3a0d06') + inside(d, fill(circle(px, py + 1, pr + 2.6), '#ff7a1a') + fill(circle(px, py + 1, pr), FI.core) + fill(circle(px, py + 1, pr * 0.45), '#fff')) + line(d, INK, 1.6);
  }
  // a roar, breathing the card's jet of fire
  const mouth = smooth([[74, 90], [90, 86], [104, 88, 1], [104, 102, 1], [92, 108], [80, 104]]);
  s += mouthE(89, 96, 32, fill(mouth, '#3a0d06') + inside(mouth, fill(poly([[74, 84], [104, 84], [104, 90], [76, 92]]), '#fff6d8')) + line(mouth, INK, 2));
  if (E === 'normal' || E === 'kick') s += jet(102, 95, 40, 22);
  for (const [x, y, r] of [[8, 70, 2.4], [16, 12, 2], [134, 26, 2.6], [128, 6, 1.8], [44, 2, 1.6]]) s += part(circle(x, y, r), FI.yellow, 2.2);
  return end(s);
}

// ---- B: a dragon cut from a chilli pepper ---------------------------------------------------
function dragon() {
  begin();
  const C = { base: '#e3261f', light: '#ff5e45', hi: '#ffc0b0', shade: '#a8150f', deep: '#740c08' };
  const G = { base: '#4fae3a', shade: '#2e7a22', light: '#8fdc5a' };
  const Y = { base: '#ffc23a', shade: '#e08a12', light: '#ffe48a' };
  let s = '';
  // a chilli: a fat pod from its green cap at (bx, by), curving through `bend` to the tip
  const chilli = (bx, by, tx, ty, bend, w) => {
    const mx = (bx + tx) / 2 + bend[0], my = (by + ty) / 2 + bend[1], a = [], b = [];
    const P = (t) => [(1 - t) ** 2 * bx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) ** 2 * by + 2 * (1 - t) * t * my + t * t * ty];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, [x, y] = P(t), [x2, y2] = P(Math.min(1, t + 0.01)), l = Math.hypot(x2 - x, y2 - y) || 1;
      const nx = -(y2 - y) / l, ny = (x2 - x) / l, ww = w * (1 - t ** 1.6) * (t < 0.15 ? 0.85 + t : 1);
      a.push([x + nx * ww, y + ny * ww]); b.unshift([x - nx * ww, y - ny * ww]);
    }
    a[a.length - 1].push(1);
    return smooth([...a, ...b.slice(1)]);
  };
  const h1 = chilli(46, 40, 8, 6, [-8, 12], 8.5), h2 = chilli(68, 34, 46, -2, [-12, 6], 8);
  const horns = () => [h1, h2].map((d) => part(d, C.base, 5) + inside(d, fill(poly([[0, 24], [90, 6], [90, 60], [0, 60]]), C.shade) + line(d, C.light, 2, 'stroke-dasharray="14 200" stroke-dashoffset="-34"'))).join('') +
    part(smooth([[38, 44], [44, 34], [54, 38], [50, 46]]), G.base, 4) + line('M46 38l-4-6', G.shade, 2) +
    part(smooth([[60, 38], [66, 28], [76, 32], [72, 40]]), G.base, 4) + line('M68 32l-3-6', G.shade, 2);
  // leafy green spines down the back of the neck
  const spines = smooth([[30, 50], [6, 44, 1], [20, 58], [2, 62, 1], [18, 70], [2, 82, 1], [20, 86], [8, 102, 1], [28, 98]]);
  s += part(spines, G.base, 4.6) + inside(spines, fill(poly([[0, 70], [40, 70], [40, 110], [0, 110]]), G.shade));
  // the head: a cranium, a long snout to the right, a heavy jaw
  const head = smooth([[22, 98], [18, 74], [26, 52], [44, 38], [70, 34], [92, 40], [112, 50], [128, 58], [139, 68, 1], [138, 82], [128, 88], [124, 100], [108, 112], [74, 116.5], [42, 114]]);
  s += part(head, C.base);
  s += inside(head, fill(smooth([[0, 40], [36, 46], [30, 80], [40, 120], [0, 120]]), C.shade) +
    fill('M30 98Q80 92 126 90L140 86V130H30Z', Y.base) + fill('M30 108Q80 104 130 100V130H30Z', Y.shade) +
    line('M44 104h10M58 102h10M72 101h10M86 100h10M100 98h10', Y.shade, 1.2) +
    fill(smooth([[70, 38], [104, 44], [130, 60], [118, 62], [90, 52]]), C.light) + line('M76 40q30 2 52 18', C.hi, 2.4));
  s += rim(head, poly([[0, 30], [90, 30], [40, 46], [20, 80], [10, 110], [0, 110]]), 2.2);
  s += horns();
  // nostrils puffing smoke
  s += fill(ellipse(130, 64, 2.6, 1.6, -0.4), C.deep) + fill(ellipse(122, 60, 2.2, 1.4, -0.4), C.deep);
  for (const [x, y, r] of [[134, 50, 4.5], [140, 40, 3.5], [128, 42, 3]]) s += part(circle(x, y, r), '#d8d0cc', 2.6);
  // reptile eyes: yellow, slit pupils, brows hooded into a scowl
  for (const [x0, x1, top, bot, nose, px, py] of [[56, 74, 56, 70, 1, 67, 64], [86, 108, 52, 69, -1, 100, 61]]) {
    s += eye({ x0, x1, top, bot, slant: 0.42, nose, px, py, pr: 0.01, white: '#ffe27a', glint: false, shadow: '#e8b03a' });
    s += fill(ellipse(px, py + 1, 1.8, 5.2), '#0d0a0c') + fill(circle(px + 2.6, py - 1.6, 1.3), '#fff');
  }
  s += line('M52 50L76 58M84 56L112 46', INK, 4);
  // a toothy grin with a flame licking out of the corner
  const jaw = 'M66 92Q100 96 136 84';
  s += line(jaw, INK, 2.6);
  for (const [x, y, d] of [[84, 93.5, 1], [98, 94.5, 1], [112, 92.5, 1], [126, 88.5, 1], [92, 94, -1], [118, 91, -1]]) s += part(poly([[x - 2.6, y], [x + 2.6, y - 0.4], [x, y + 6 * d]]), '#ffffff', 2);
  s += jet(130, 88, 13, 12);
  s += sparkle(100, 18, 3.5, '#ffd27a') + sparkle(10, 116, 3, '#ffd27a');
  return end(s);
}

// ---- C: the giant — a moai of cooling lava ------------------------------------------------
function moai() {
  begin();
  const S = { base: '#6b5e5a', light: '#8f817a', hi: '#b5a79d', shade: '#4a3f3c', deep: '#2e2624' };
  const crack = (d) => line(d, '#ff6a1a', 3.6) + line(d, '#ffd23a', 1.4);
  let s = '';
  // the long ear at the back
  const ear = smooth([[34, 48], [22, 50], [18, 70], [22, 94], [32, 100], [38, 96]]);
  s += part(ear, S.shade) + inside(ear, line('M28 58q-4 16 2 34', S.deep, 2.4));
  // the head: flat-topped, a jutting brow, a long nose, a forward chin
  const head = smooth([[34, 30, 1], [108, 24, 1], [114, 40], [118, 50, 1], [112, 56], [116, 66], [128, 82, 1], [114, 86], [116, 96], [122, 106, 1], [112, 116.5], [44, 116.5, 1], [38, 96], [32, 60]]);
  s += part(head, S.base);
  s += inside(head, fill(smooth([[20, 20], [52, 28], [48, 70], [56, 120], [20, 120]]), S.shade) +
    fill(smooth([[60, 26], [108, 22], [114, 40], [80, 42], [62, 40]]), S.light) +
    // the brow's shadow and the sockets under it
    fill(smooth([[50, 54, 1], [118, 50, 1], [110, 60], [80, 64], [56, 62]]), S.deep) +
    fill(smooth([[96, 64], [116, 66], [128, 82, 1], [112, 84], [100, 76]]), S.light) + line('M100 64L114 66', S.hi, 2) +
    fill(smooth([[60, 104], [116, 100], [124, 120], [60, 120]]), S.shade) +
    crack('M40 40l10 8l-4 10l8 6') + crack('M70 30l-4 8l6 4') + crack('M108 92l-6 6l4 6l-6 8') + crack('M48 84l8 4l-2 8'));
  s += rim(head, poly([[0, 0], [60, 0], [44, 30], [34, 70], [30, 120], [0, 120]]), 2.2);
  // glowing eyes deep under the brow
  for (const [x0, x1, y0, nose] of [[58, 76, 56, 1], [86, 108, 54, -1]]) {
    const d = smooth([[x0, y0 + (nose > 0 ? 0 : 4), 1], [x1, y0 + (nose > 0 ? 4 : 0), 1], [x1 - 2, y0 + 10], [(x0 + x1) / 2, y0 + 12], [x0 + 2, y0 + 10]]);
    s += fill(d, '#1a1210') + inside(d, fill(ellipse((x0 + x1) / 2 + 3, y0 + 7, (x1 - x0) / 2 - 3, 3.6), FI.orange) + fill(ellipse((x0 + x1) / 2 + 4, y0 + 7, (x1 - x0) / 2 - 7, 1.8), FI.core));
  }
  s += line('M48 52L118 48', INK, 3);
  // thin, pressed lips
  s += line('M86 98L118 96', INK, 2.6) + line('M88 102q14 2 26-1', S.deep, 2);
  s += line('M112 84q-4 4-12 2', INK, 1.6);
  // the topknot: a molten pukao, dripping
  const knot = smooth([[38, 26, 1], [42, 8], [56, 2], [92, 2], [104, 8], [106, 26, 1], [72, 30]]);
  s += part(knot, FI.red);
  s += inside(knot, fill(smooth([[36, 14], [70, 6], [110, 12], [110, 30], [36, 30]]), FI.orange) + fill(ellipse(76, 12, 20, 5), FI.yellow) + fill(ellipse(80, 11, 9, 2.4), FI.core) +
    line('M48 22q10-4 20 0M80 24q12-4 22 0', FI.dred, 1.6));
  for (const [x, y, h] of [[46, 28, 10], [96, 26, 14], [62, 30, 6]]) {
    const d = smooth([[x - 3, y - 2], [x + 3, y - 2], [x + 2.6, y + h], [x, y + h + 3], [x - 2.6, y + h]]);
    s += part(d, FI.orange, 3.4) + line(`M${x - 0.6} ${y}v${h - 2}`, FI.core, 1.2);
  }
  for (const [x, y, r] of [[30, 10, 2.2], [118, 8, 2.6], [124, 30, 1.8], [20, 30, 1.6]]) s += part(circle(x, y, r), FI.yellow, 2.2);
  return end(s);
}

export default {
  card: 10, champion: 'הענק', en: 'The Giant', theme: 'Card: breathing fire, chilli peppers · Power: giant header, downward slant',
  options: [
    { letter: 'A', name: 'Blaze', draw: fitted(blaze, [0.91, 1, 0, 0]), marks: { eyes: [[62, 70], [98, 67.5]], nose: [90, 83] },
      blurb: 'Not a guy breathing fire: the fire. A head made of flame in four heats, tongues streaming back like hair, hollow eyes with white-hot pupils, roaring the card\'s jet of fire, sitting on a bed of embers. <i>Silhouette: a tall, ragged flame.</i>' },
    { letter: 'B', name: 'Chilli Dragon', draw: dragon,
      blurb: 'A dragon grown from the card\'s chillies: glossy pepper-red skin, chilli horns with green caps, leafy spines down the neck, slit-pupil eyes, smoke from the nostrils and a flame licking out of a fanged grin. <i>Silhouette: a long snout and swept-back horns.</i>' },
    { letter: 'C', name: 'Magma Moai', draw: moai,
      blurb: 'The champion\'s own sign, the 🗿 giant head, carved from cooling lava: a tall basalt moai, cracks glowing, eyes burning under a crushing brow, its topknot a molten crown that drips. <i>Silhouette: tall and narrow, a block with a crown.</i>' },
  ],
};
