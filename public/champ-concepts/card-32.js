// Card #32 — הרוזן האפל (The Dark Count). Card: Ori as Alice falling down the rabbit hole, the
// white rabbit with its pocket watch, cards and clocks spinning ("an upside-down restaurant").
// Power: a vampire that bites the blocker and drags him in; arming it stuns (Grab, burn, stun).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const fangs = (x0, y0, x1, y1) => part(poly([[x0 - 2.6, y0], [x0 + 2.6, y0], [x0, y0 + 7]]), '#ffffff', 1.8) + part(poly([[x1 - 2.6, y1], [x1 + 2.6, y1], [x1, y1 + 7]]), '#ffffff', 1.8);
const redEye = (o) => eyeE({ ...o, pupil: '#c8102a', ring: '#5a0a14' });

// ---- A: a vampire bat, its wings wrapped round it for a cape ---------------------------------------
function bat() {
  begin();
  const F = { base: '#5a4a6a', light: '#7e6a90', hi: '#a894b8', shade: '#3a2e48' };
  const WG = { base: '#3a2a48', light: '#54406a', bone: '#2a1e36' };
  let s = '';
  // the cape: wings folded round its chest, the red-lined collar standing up behind the head
  s += part(poly([[30, 72], [16, 40], [50, 58]]), '#a8141a', 4) + part(poly([[118, 70], [132, 36], [98, 56]]), '#a8141a', 4);
  // huge ears
  const earB = smooth([[44, 40], [30, 16], [24, 2, 1], [42, 10], [60, 30]]), earF = smooth([[86, 30], [104, 10], [120, 2, 1], [116, 20], [106, 42]]);
  for (const d of [earB, earF]) s += part(d, F.base) + inside(d, fill(smooth([[32, 10], [40, 14], [52, 30], [46, 34]]), '#c87aa0') + fill(smooth([[106, 12], [114, 8], [110, 24], [100, 34]]), '#c87aa0'));
  const head = smooth([[38, 70], [40, 48], [56, 34], [80, 30], [102, 36], [114, 52], [114, 74], [104, 90], [80, 96], [56, 92], [42, 84]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[20, 40], [52, 44], [48, 80], [20, 100]]), F.shade) + fill(smooth([[64, 34], [96, 36], [108, 50], [84, 46]]), F.light) +
    // the count's widow's peak
    fill(poly([[56, 30], [104, 30], [84, 54], [78, 46]]), F.shade));
  const cape = smooth([[4, 84], [14, 74], [28, 80], [40, 74], [56, 84], [74, 80], [92, 84], [108, 74], [122, 80], [134, 72], [142, 84], [138, 104], [130, 117.5, 1], [16, 117.5, 1], [8, 104]]);
  s += part(cape, WG.base) + inside(cape, fill(smooth([[0, 70], [40, 80], [34, 130], [0, 130]]), WG.bone) + line('M74 82L40 117M74 82L74 117M74 82L108 117M28 80L16 117M120 78L132 117', WG.light, 1.8) + fill(poly([[66, 82], [82, 82], [80, 117], [68, 117]]), WG.light, 'opacity=".5"'));
  s += rim([head, earB], poly([[0, 0], [70, 0], [44, 40], [30, 80], [0, 90]]), 2, '#c87aa0');
  // red eyes, a pug leaf-nose, a fanged grin
  s += redEye({ x0: 56, x1: 72, top: 54, bot: 65, slant: 0.5, nose: 1, px: 67, py: 61, pr: 3.8, r: 2.4 });
  s += redEye({ x0: 84, x1: 102, top: 52, bot: 64, slant: 0.5, nose: -1, px: 96, py: 59, pr: 4, r: 2.4 });
  s += part(smooth([[74, 64], [82, 62], [84, 72], [78, 76], [72, 72]]), F.shade, 2.4) + fill(ellipse(76, 72, 1.4, 1), INK) + fill(ellipse(81, 71, 1.4, 1), INK);
  s += line('M64 80Q78 88 96 78', INK, 2.4) + fangs(70, 81, 90, 80);
  s += sparkle(136, 16, 3.4, '#ff8aa0') + sparkle(10, 20, 3, '#ff8aa0');
  return end(s);
}

// ---- B: the card's white rabbit, turned vampire ---------------------------------------------------
function bunny() {
  begin();
  const W = { base: '#fbfaf6', shade: '#ddd6cc', deep: '#b9b0a2' };
  let s = '';
  // tall ears, the front one flopped
  const earB = smooth([[46, 40], [38, 20], [40, 6, 1], [50, 14], [58, 36]]), earF = smooth([[84, 36], [88, 16], [96, 8], [106, 10, 1], [100, 18], [98, 36]]);
  for (const d of [earB, earF]) s += part(d, W.base) + inside(d, fill(smooth([[40, 12], [46, 16], [52, 38], [46, 40]]), '#ffb0c4') + fill(smooth([[90, 16], [96, 10], [94, 30], [92, 40]]), '#ffb0c4'));
  // a Dracula collar, high at the back
  const collar = smooth([[20, 117.5, 1], [20, 94], [14, 74, 1], [34, 88], [74, 96], [114, 88], [132, 72, 1], [126, 92], [126, 117.5, 1]]);
  s += part(collar, '#1c1a22') + inside(collar, fill(smooth([[16, 76], [34, 90], [28, 110], [20, 110]]), '#a8141a') + fill(smooth([[130, 74], [114, 90], [118, 110], [126, 110]]), '#a8141a'));
  const head = smooth([[26, 92], [24, 62], [34, 40], [58, 26], [92, 26], [114, 38], [126, 62], [126, 88], [112, 102], [86, 108], [58, 108], [40, 102]]);
  s += part(head, W.base);
  s += inside(head, fill(smooth([[0, 30], [42, 42], [36, 80], [44, 130], [0, 130]]), W.shade) + fill(smooth([[30, 92], [76, 100], [122, 90], [122, 130], [30, 130]]), W.shade));
  s += rim(head, poly([[0, 0], [70, 0], [40, 40], [24, 80], [0, 90]]), 2, '#ff9ab0');
  // glowing red eyes, a pink nose, whiskers, fangs
  s += redEye({ x0: 56, x1: 72, top: 60, bot: 72, slant: 0.45, nose: 1, px: 67, py: 67, pr: 4.2 });
  s += redEye({ x0: 86, x1: 104, top: 58, bot: 71, slant: 0.45, nose: -1, px: 98, py: 65, pr: 4.4 });
  s += browsE([52, 54, 74, 60], [84, 58, 108, 50], 2.6);
  s += part(smooth([[84, 76, 1], [94, 76, 1], [89, 82, 1]]), '#ff7a96', 2);
  s += line('M100 80l20-2M100 84l18 4M76 80l-20-2M76 84l-18 4', W.deep, 1.1);
  s += mouthE(89, 90, 26, line('M78 88Q89 94 100 88', INK, 2.2) + fangs(82, 89, 96, 89));
  // its pocket watch on a chain
  s += line('M106 98Q116 104 116 106', '#ffc92e', 1.6, 'stroke-dasharray="2 1.6"') + part(circle(116, 110, 6), '#ffc92e', 3) + fill(circle(116, 110, 4), '#fffaf0') + line('M116 110v-3M116 110l2 1', INK, 1);
  s += sparkle(124, 22, 3.4, '#ff8aa0');
  return end(s);
}

// ---- C: a Cheshire cat, its grin full of fangs, fading at the edges -------------------------------
function cheshire() {
  begin();
  const C = { base: '#5a4ab0', light: '#8a7ae0', hi: '#b8acff', stripe: '#2e2470' };
  let s = '';
  // it is disappearing from the back
  for (const [x, y, r] of [[12, 40, 4], [6, 58, 3], [14, 74, 3.6], [4, 86, 2.4], [16, 98, 2.8], [8, 30, 2]]) s += fill(circle(x, y, r), C.base, 'opacity=".55"');
  const earB = poly([[36, 46], [34, 16], [58, 32]]), earF = poly([[92, 30], [112, 10], [116, 42]]);
  for (const d of [earB, earF]) s += part(d, C.base) + inside(d, fill(poly([[38, 40], [38, 22], [52, 34], [100, 32], [110, 18], [112, 38]]), '#ff9ad8'));
  const head = smooth([[24, 82], [26, 58], [40, 40], [66, 32], [94, 32], [118, 42], [130, 62], [130, 86], [118, 104], [92, 114], [56, 114], [34, 104]]);
  s += part(head, C.base);
  let stripes = '';
  for (let i = 0; i < 7; i++) stripes += `M${20 + i * 18} 20q${-6} 20 ${2} 40q${8} 20 ${-4} 60`;
  s += inside(head, line(stripes, C.stripe, 6.4) + fill(smooth([[60, 34], [100, 36], [120, 50], [90, 46]]), C.light, 'opacity=".7"') + line('M64 36q26-4 44 10', C.hi, 2));
  s += rim(head, poly([[0, 0], [70, 0], [40, 36], [24, 80], [0, 90]]), 2, '#ff9ad8');
  // yellow slit eyes
  for (const [x0, x1, top, bot, nose, px, py] of [[52, 70, 52, 64, 1, 63, 58], [84, 104, 50, 63, -1, 96, 56]]) {
    s += eye({ x0, x1, top, bot, slant: 0.35, nose, px, py, pr: 0.01, white: '#ffe14a', glint: false, shadow: '#e0b02a' });
    s += fill(ellipse(px, py + 0.5, 1.6, 5), '#0d0a0c');
  }
  // the grin: a huge crescent of teeth, two of them fangs
  const grin = smooth([[36, 74, 1], [80, 84], [124, 68, 1], [116, 90], [82, 102], [48, 92]]);
  s += fill(grin, '#3a0e28') + inside(grin, fill('M30 70Q80 84 130 66V80Q80 96 30 84Z', '#ffffff') + line('M44 76v10M54 79v10M64 81v10M76 83v10M88 83v10M100 80v10M110 76v10', '#d8d0dc', 1) + fill(ellipse(82, 100, 18, 5), '#ff7aa8')) + line(grin, INK, 2.2);
  s += fangs(58, 90, 104, 86);
  s += line('M30 70l-14-4M30 76l-14 2M126 64l14-6M126 70l14 0', '#d8d0ff', 1.1);
  s += sparkle(132, 22, 3.4, '#ff9ad8') + sparkle(138, 100, 3, '#ff9ad8');
  return end(s);
}

export default {
  card: 32, champion: 'הרוזן האפל', en: 'The Dark Count', theme: 'Card: Alice down the rabbit hole, the white rabbit · Power: a vampire bite that drags you in (Grab, burn)',
  options: [
    { letter: 'A', name: 'Count Bat', draw: bat,
      blurb: 'The count in his other form: a vampire bat with towering ears and a widow\'s peak, its wings wrapped round its chest for a cape with the red lining showing at the collar, red eyes, a fanged grin. <i>Silhouette: two huge ears over a scalloped cape.</i>' },
    { letter: 'B', name: 'Count Bunny', draw: fitted(bunny, [1.07, 1.01, 0, -4]), marks: { eyes: [[64, 66], [95, 64.5]], nose: [89, 79] },
      blurb: 'The card\'s white rabbit gone over to the dark side: glowing red eyes, two fangs, one ear flopped, a Dracula collar standing up behind it, still carrying its pocket watch. <i>Silhouette: two tall ears and a high collar.</i>' },
    { letter: 'C', name: 'Cheshire Fang', draw: cheshire,
      blurb: 'Wonderland\'s other resident: a striped cat fading away from the back, nothing left but yellow slit eyes and a huge crescent grin, two of its teeth fangs. <i>Silhouette: a pointed-eared head, a grin across it, dissolving at the edge.</i>' },
  ],
};
