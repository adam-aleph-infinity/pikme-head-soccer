// Card #17 — רוכב הסערה (The Storm Rider). Card: Shoval in a space suit, yelling inside a sleep
// pod with red alarm lights flashing ("testing public sleep pods for 24 hours"). Power: a
// straight gust of storm wind; arming it pushes the opponent away (Straight, push aura).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
// A gust: curling wind lines streaming toward +x from (x, y).
const gust = (x, y, c = '#ffffff') =>
  line(`M${x} ${y}q14 -6 26 0t20 -4`, c, 2.4) + line(`M${x + 2} ${y + 8}q12 -4 24 0q6 4 2 8q-4 2 -6 -2`, c, 2) + line(`M${x} ${y - 9}q10 -4 20 -1`, c, 1.6);

// ---- A: a thundercloud blowing a gale -------------------------------------------------------
function cloud() {
  begin();
  const C = { base: '#5d6a8a', light: '#8a97b8', hi: '#c3cce2', shade: '#3e4866', deep: '#2a3150' };
  const puffs = [[40, 58, 26], [70, 38, 30], [104, 46, 27], [122, 72, 18], [28, 90, 22], [58, 92, 25], [92, 92, 25], [114, 98, 17]].map(([x, y, r]) => circle(x, y, r));
  let s = '';
  // a bolt crackling out of the bottom
  const bolt = poly([[36, 104], [28, 120], [36, 118], [26, 138], [46, 112], [38, 114], [44, 104]]);
  s += part(bolt, '#ffe14a', 4) + fill(poly([[38, 108], [33, 118], [37, 117]]), '#fff6c0');
  s += keyline(puffs);
  s += puffs.map((d) => fill(d, C.base)).join('');
  s += inside(puffs, fill(smooth([[0, 30], [36, 40], [30, 80], [40, 130], [0, 130]]), C.shade) + fill(smooth([[10, 104], [70, 106], [140, 96], [140, 130], [10, 130]]), C.deep) +
    fill(circle(76, 30, 22), C.light) + fill(circle(108, 40, 16), C.light) + line('M58 18q16-8 32 0M96 28q12-4 20 4', C.hi, 2.4) +
    line('M40 82q8 6 16 0M74 84q8 6 16 0', C.shade, 1.6));
  s += rim(puffs, poly([[0, 0], [80, 0], [50, 20], [20, 50], [8, 100], [0, 100]]), 2.2);
  // stormy glare, cheeks puffed, blowing a gale out of the front
  s += eye({ x0: 52, x1: 70, top: 52, bot: 66, slant: 0.45, nose: 1, px: 65, py: 60, pr: 4.6 });
  s += eye({ x0: 84, x1: 104, top: 50, bot: 65, slant: 0.45, nose: -1, px: 98, py: 58, pr: 5 });
  s += line('M48 46L72 54M82 52L108 42', INK, 3.4);
  s += fill(circle(108, 82, 8), C.light) + fill(circle(66, 82, 7), C.light);
  s += part(ellipse(118, 80, 5.4, 6.4), '#1a1f33', 2.6);
  s += gust(124, 76) + gust(118, 96, '#d8e4ff');
  for (const [x, y] of [[132, 22], [12, 30]]) s += part(poly([[x, y], [x - 6, y + 10], [x - 1, y + 9], [x - 5, y + 18], [x + 4, y + 6], [x - 1, y + 7]]), '#ffe14a', 2.4);
  return end(s);
}

// ---- B: the alarm clock from the sleep pod, ringing its head off -------------------------------
function clock() {
  begin();
  const R = { base: '#e5352c', shade: '#a8201a', light: '#ff7a62', hi: '#ffc0b0' };
  const CH = { base: '#ffd24a', shade: '#d4920c', light: '#fff0a0' };
  let s = '';
  // the bells and the hammer between them, shaking
  s += line('M76 26V12', INK, 4.6) + line('M76 26V12', '#c9d2da', 2.2) + part(circle(76, 9, 4.4), '#c9d2da', 3);
  for (const [x, y, a] of [[44, 26, -24], [108, 24, 24]]) {
    const bell = `<g transform="rotate(${a} ${x} ${y})">` + part(`M${x - 17} ${y + 8}A17 17 0 0 1 ${x + 17} ${y + 8}Z`, CH.base, 5) + fill(`M${x - 12} ${y + 2}A13 13 0 0 1 ${x - 2} ${y - 7}`, CH.light) + part(ellipse(x, y - 9, 3, 2.4), CH.shade, 2.4) + '</g>';
    s += bell;
  }
  s += line('M22 6l-6-6M30 2l-2-8M120 4l4-8M128 10l8-4M10 20l-8-2M136 26l8 0', '#ffe14a', 2);
  // the feet and the winding key
  for (const x of [50, 102]) s += part(smooth([[x - 7, 108, 1], [x + 7, 108, 1], [x + 9, 117, 1], [x - 9, 117, 1]], true, 0.4), R.shade, 4.4);
  s += part(smooth([[16, 66, 1], [4, 58, 1], [2, 74, 1], [16, 72, 1]], true, 0.3), CH.base, 4) + line('M16 69H28', INK, 4) + line('M16 69H28', CH.shade, 2);
  // the case and the dial: the face
  const body = ellipse(76, 72, 48, 44);
  s += part(body, R.base);
  s += inside(body, fill(ellipse(70, 66, 46, 42), R.light) + fill(ellipse(80, 76, 46, 42), R.shade) + line('M44 40q20-14 44-12', R.hi, 2.6));
  const dial = ellipse(78, 72, 37, 34);
  s += part(dial, '#fffaf0', 4.4) + inside(dial, fill(smooth([[30, 80], [80, 96], [130, 80], [130, 120], [30, 120]]), '#ece2cc'));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r0 = i % 3 ? 31 : 28; s += line(`M${78 + Math.cos(a) * r0} ${72 + Math.sin(a) * r0 * 0.92}L${78 + Math.cos(a) * 33} ${72 + Math.sin(a) * 33 * 0.92}`, '#8a7a62', i % 3 ? 1 : 2); }
  s += rim(body, poly([[0, 0], [70, 0], [40, 40], [28, 80], [20, 110], [0, 110]]), 2.2);
  // the hands at ten to two are its angry brows
  s += line('M78 54L52 44M78 54L106 42', INK, 4.4) + line('M78 54L52 44M78 54L106 42', '#3a3f48', 2) + part(circle(78, 54, 3), '#3a3f48', 2);
  s += eye({ x0: 54, x1: 72, top: 58, bot: 72, slant: 0.35, nose: 1, px: 67, py: 66, pr: 4.6 });
  s += eye({ x0: 84, x1: 104, top: 57, bot: 72, slant: 0.35, nose: -1, px: 98, py: 65, pr: 5 });
  // yelling, like Shoval in the pod
  const mouth = smooth([[66, 82, 1], [80, 80], [96, 82, 1], [94, 96], [82, 102], [70, 96]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(82, 102, 9, 5), '#ff7a96') + fill(poly([[64, 79], [98, 79], [98, 84], [64, 85]]), '#fff')) + line(mouth, INK, 2);
  return end(s);
}

// ---- C: a pufferfish blowing the storm ------------------------------------------------------
function fugu() {
  begin();
  const F = { base: '#f2c75c', shade: '#c9962e', light: '#ffe48a', spot: '#8a5a22' };
  const B = { base: '#fbf4e4', shade: '#e2d6bc' };
  const cx = 70, cy = 64, r = 47;
  let s = '';
  // the tail fin behind
  const tail = smooth([[24, 62], [6, 46], [2, 56], [8, 66], [2, 78], [8, 86], [26, 72]]);
  s += part(tail, F.shade) + inside(tail, line('M6 52L22 64M4 68L22 68M6 82L22 72', F.spot, 1.2));
  // the spines all round
  let spikes = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.1, a1 = a - 0.08, a2 = a + 0.08;
    if (Math.sin(a) > 0.8 && Math.abs(Math.cos(a)) < 0.4) continue;
    spikes.push(poly([[cx + Math.cos(a1) * (r - 2), cy + Math.sin(a1) * (r - 2)], [cx + Math.cos(a) * (r + 9), cy + Math.sin(a) * (r + 8)], [cx + Math.cos(a2) * (r - 2), cy + Math.sin(a2) * (r - 2)]]));
  }
  const ball = ellipse(cx, cy + 4, r, r * 0.98);
  s += keyline([...spikes, ball]);
  s += spikes.map((d) => fill(d, F.light)).join('') + fill(ball, F.base);
  s += inside(ball, fill(`M0 74Q70 86 144 70V140H0Z`, B.base) + fill(`M0 98Q70 108 144 94V140H0Z`, B.shade) +
    fill(smooth([[0, 10], [36, 24], [30, 70], [0, 80]]), F.shade) + line('M64 24q24-6 40 10', '#fff6c8', 2.6) +
    [[40, 40], [54, 30], [34, 58], [86, 30], [102, 40], [48, 50]].map(([x, y]) => fill(circle(x, y, 2.6), F.spot)).join(''));
  s += rim(ball, poly([[0, 0], [70, 0], [40, 26], [24, 60], [16, 100], [0, 100]]), 2.2);
  // a fin at the side
  const fin = smooth([[44, 84], [28, 92], [30, 102, 1], [42, 98], [50, 92]]);
  s += part(fin, F.light, 4) + line('M32 96l12-6M34 100l12-6', F.shade, 1);
  // furious puffed face, lips pursed into a blowhole of a mouth
  s += eye({ x0: 62, x1: 82, top: 50, bot: 66, slant: 0.42, nose: 1, px: 76, py: 59, pr: 5.6 });
  s += eye({ x0: 92, x1: 114, top: 48, bot: 65, slant: 0.42, nose: -1, px: 108, py: 57, pr: 6 });
  s += line('M58 44L84 52M90 50L118 40', INK, 3.4);
  s += part(ellipse(116, 82, 7, 6.4), '#ff9a8a', 3.6) + fill(ellipse(117, 82, 3.4, 3), '#5a1414');
  s += gust(122, 78) + gust(118, 98, '#d8f2ff');
  return end(s);
}

// ---- D (your request): an astronaut in the card's space suit ------------------------------------------
function astronaut17() {
  begin();
  const WT = { base: '#eef1f6', light: '#ffffff', shade: '#c2c9d6', deep: '#8a94a8' };
  const S = { base: '#f4c49a', light: '#ffdcb8', shade: '#d8956e' };
  let s = '';
  // the gust it rides, behind; the aerial at the back
  s += line('M2 48h14M0 60h10M4 72h12', '#d8f2ff', 2.2, 'opacity=".8"');
  s += line('M36 34L26 10', INK, 3.6) + line('M36 34L26 10', '#8a96a2', 1.4) + part(circle(26, 9, 3), '#ffcc33', 2);
  // the helmet
  const shell = headShape(1.1, 1.08, 0, -4);
  s += part(shell, WT.base);
  s += inside(shell, fill(smooth([[0, 30], [38, 42], [34, 130], [0, 130]]), WT.shade) + fill(smooth([[50, 24], [96, 22], [120, 38], [86, 32]]), WT.light) +
    fill(poly([[0, 104], [144, 104], [144, 130], [0, 130]]), WT.deep, 'opacity=".45"'));
  s += rim(shell, poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // a mission patch on its side: a storm bolt
  s += part(circle(36, 76, 9), '#2f5ac8', 3) + line(circle(36, 76, 6.4), '#ffcc33', 1.2) + fill(poly([[38, 69], [32, 77], [36, 77], [33, 84], [40, 75], [36, 75]]), '#ffe14a');
  // the card's red alarm light, flashing on top
  s += fill(circle(80, 12, 16), '#ff3a3a', 'opacity=".22"');
  s += part(smooth([[68, 20, 1], [92, 20, 1], [92, 25, 1], [68, 25, 1]], true, 0.3), WT.deep, 3);
  s += part(smooth([[72, 20, 1], [72, 12], [80, 6], [88, 12], [88, 20, 1]]), '#ff3a3a', 3.4) + fill(ellipse(77, 11, 2.2, 3.4), '#ffb0b0');
  s += line('M62 8l-6-4M98 8l6-4', '#ff5a5a', 2);
  // the visor ring, and inside it a face yelling like Shoval in the sleep pod
  const ring = ellipse(84, 68, 40, 36), win = ellipse(84, 68, 34, 30);
  s += part(ring, '#9aa4b4', 4.4) + inside(ring, fill(ellipse(90, 74, 40, 36), '#7a8496'));
  const mouth = smooth([[80, 79, 1], [100, 77, 1], [106, 85], [100, 95], [88, 97], [80, 89]]);
  s += fill(win, S.base) + inside(win,
    fill(smooth([[40, 70], [60, 80], [70, 110], [40, 110]]), S.shade) +
    fill(smooth([[46, 30], [124, 30], [124, 50], [108, 46], [92, 52], [76, 46], [60, 52], [48, 56]]), '#3a2a22') +
    eyeE({ x0: 62, x1: 78, top: 56, bot: 69, slant: 0.55, nose: 1, px: 73, py: 63, pr: 4 }) +
    eyeE({ x0: 90, x1: 108, top: 54, bot: 68, slant: 0.55, nose: -1, px: 102, py: 61, pr: 4.4 }) +
    browsE([58, 52, 80, 57], [86, 55, 112, 48], 3) +
    mouthE(92, 86, 26, fill(mouth, '#3a0e10') + inside(mouth, fill(poly([[78, 76], [102, 74], [102, 81], [78, 83]]), '#ffffff') + fill(ellipse(92, 96, 8, 4), '#ff7a8a')) + line(mouth, INK, 1.6)) +
    fill(ellipse(112, 82, 5, 3), '#ff8a8a', 'opacity=".5"') +
    fill(win, '#9fd8ff', 'opacity=".16"') + fill(ellipse(108, 44, 12, 6, -0.5), '#ff5a5a', 'opacity=".3"') +
    line('M58 50Q62 40 74 36', '#ffffff', 3, 'opacity=".85"') + line('M110 92l6-8', '#ffffff', 2, 'opacity=".6"'));
  s += line(win, INK, 2);
  // the neck ring
  const neck = smooth([[30, 108, 1], [114, 108, 1], [118, 117.5, 1], [26, 117.5, 1]], true, 0.3);
  s += part(neck, '#3a5ac0', 4.4) + line('M34 111h80', '#7a9ae8', 1.6);
  return end(s);
}

export default {
  card: 17, champion: 'רוכב הסערה', en: 'The Storm Rider', theme: 'Card: a 24-hour sleep pod, alarms flashing · Power: a gust of storm wind (Straight, push)',
  options: [
    { letter: 'A', name: 'Thunderhead', draw: cloud,
      blurb: 'The storm itself: a navy thundercloud glaring, cheeks puffed, blowing a gale straight out of its mouth the way its power pushes players back, lightning crackling out of it. <i>Silhouette: a heap of puffs with a bolt under it.</i>' },
    { letter: 'B', name: 'Alarm Clock', draw: clock,
      blurb: 'The wake-up call of the card\'s sleep pods, red as its alarm lights: a twin-bell clock ringing itself silly, its hands at ten to two for angry brows, yelling like Shoval in the pod. <i>Silhouette: a round face with two bells for ears.</i>' },
    { letter: 'C', name: 'Puffer Gale', draw: fugu,
      blurb: 'Japan\'s fugu blown up to bursting, every spine out, blowing a storm out of its pursed mouth: the push of the power, as a fish. <i>Silhouette: a spiked ball with a tail.</i>' },
    { letter: 'D', name: 'Astronaut', draw: fitted(astronaut17, [1, 1, 0, -4]), marks: { eyes: [[70, 62.5], [99, 61]], nose: [100, 74] }, request: true,
      blurb: 'Your request: an astronaut in the card\'s space suit. A white helmet with a mission patch, the card\'s red alarm light flashing on top, and inside the visor a face yelling like Shoval in the sleep pod; storm gusts behind. <i>Silhouette: a round helmet with a beacon and an aerial.</i>' },
  ],
};
