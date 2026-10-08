// Card #25 — המטעה (The Trickster). Card: Shoval in scuba gear playing a grand piano on the sea
// floor, music notes and bubbles ("we tried to play the anthem on a piano under water"). Power:
// stop-and-go, a shot that hangs dead in the air, then bursts on (Delay).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, eyeE, browsE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const bubble = (x, y, r) => line(circle(x, y, r), '#bfe8ff', 1.4) + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.3), '#ffffff');
const note = (x, y, c = '#ffd24a') => part(ellipse(x, y, 3.6, 2.8, -0.4), c, 2.2) + line(`M${x + 3} ${y - 1}V${y - 13}l6 3`, INK, 3.4) + line(`M${x + 3} ${y - 1}V${y - 13}l6 3`, c, 1.6);

// ---- A: an anglerfish, the deep sea's trickster, its lure dangling ---------------------------------
function angler() {
  begin();
  const N = { base: '#2a2f5a', light: '#474e8a', hi: '#7a82c0', shade: '#1a1d3a' };
  let s = '';
  // the lure: a rod off its brow, the glowing bait hanging in front
  s += line('M84 30Q104 -2 130 10Q138 14 134 22', INK, 5) + line('M84 30Q104 -2 130 10Q138 14 134 22', N.light, 2.4);
  s += fill(circle(134, 27, 11), 'rgba(255,243,106,.25)') + part(circle(134, 27, 5.4), '#fff36a', 2.6) + fill(circle(132.6, 25.6, 2), '#ffffff');
  // spiny fins
  s += part(smooth([[40, 34], [30, 16, 1], [40, 26], [44, 10, 1], [52, 24], [58, 12, 1], [62, 30]]), N.shade, 4);
  s += part(smooth([[30, 86], [8, 78], [4, 92, 1], [10, 100], [30, 98]]), N.light, 4) + line('M10 84l18 6M8 94l20 0', N.shade, 1.2);
  const body = smooth([[22, 90], [18, 62], [30, 40], [54, 26], [86, 24], [110, 34], [124, 52], [132, 70], [138, 92, 1], [126, 96], [118, 106], [96, 116.5], [64, 117.5], [38, 110]]);
  s += part(body, N.base);
  s += inside(body, fill(smooth([[0, 20], [40, 30], [34, 80], [44, 130], [0, 130]]), N.shade) + fill(smooth([[56, 28], [100, 32], [118, 48], [84, 44]]), N.light) + line('M62 28q28-2 48 14', N.hi, 2) +
    [[40, 60], [50, 46], [36, 76], [62, 40], [44, 96]].map(([x, y]) => fill(circle(x, y, 1.8), '#9ff0ff')).join(''));
  s += rim(body, poly([[0, 0], [70, 0], [40, 30], [20, 70], [0, 90]]), 2, '#9ff0ff');
  // a huge underbite full of needle teeth
  const maw = smooth([[66, 78, 1], [100, 72], [134, 74, 1], [138, 92, 1], [114, 102], [86, 100], [70, 90]]);
  s += fill(maw, '#0d0a14') + inside(maw, fill(ellipse(104, 100, 26, 8), '#3a1a3a'));
  for (let i = 0; i < 7; i++) { const x = 72 + i * 9, y = 76 - i * 0.6 + (i ? 0 : 2); s += part(poly([[x, y], [x + 4, y], [x + 2, y + 9 - (i % 2) * 3]]), '#f4f1ea', 1.6); }
  for (let i = 0; i < 7; i++) { const x = 80 + i * 8.6, y = 96 - i * 1; s += part(poly([[x, y], [x + 4, y], [x + 2, y - 11 + (i % 2) * 3]]), '#f4f1ea', 1.6); }
  s += line(maw, INK, 2);
  // small mean eyes
  s += eye({ x0: 60, x1: 74, top: 52, bot: 62, slant: 0.55, nose: 1, px: 70, py: 59, pr: 3, r: 2.2, white: '#fff6c0' });
  s += eye({ x0: 88, x1: 104, top: 50, bot: 61, slant: 0.55, nose: -1, px: 99, py: 57, pr: 3.2, r: 2.2, white: '#fff6c0' });
  s += line('M56 46L76 52M86 50L108 42', INK, 3);
  s += bubble(12, 30, 4) + bubble(20, 16, 2.6) + bubble(140, 104, 3) + note(16, 116, '#9ff0ff');
  return end(s);
}

// ---- B: the card's piano, in its diving mask, keys for teeth ---------------------------------------
function piano() {
  begin();
  const K = { base: '#1f1d24', light: '#3c3a48', hi: '#6a6880', shade: '#121116' };
  let s = '';
  // the snorkel up the side
  s += line('M120 50V8Q120 2 128 2', INK, 8) + line('M120 50V8Q120 2 128 2', '#ffd24a', 4.6) + part(smooth([[124, -2, 1], [134, -2, 1], [134, 6, 1], [124, 6, 1]], true, 0.3), '#ff7a1a', 2.4);
  const body = smooth([[22, 30, 1], [126, 30, 1], [126, 117.5, 1], [22, 117.5, 1]], true, 0.2);
  const lid = smooth([[16, 22, 1], [132, 22, 1], [132, 32, 1], [16, 32, 1]], true, 0.3);
  s += keyline([body, lid]) + fill(body, K.base) + fill(lid, K.light);
  s += inside(body, fill(poly([[0, 30], [34, 30], [34, 130], [0, 130]]), K.shade) + line('M40 36q40-4 80 0', K.hi, 1.6) + line('M30 104H118', '#ffc92e', 1.4) + line('M30 36H118', '#ffc92e', 1));
  s += rim([lid, body], poly([[0, 0], [60, 0], [30, 30], [24, 120], [0, 120]]), 2);
  // the diving mask across its eyes
  const mask = smooth([[34, 40, 1], [114, 38, 1], [116, 60, 1], [80, 62], [74, 56], [68, 62], [34, 62, 1]], true, 0.4);
  s += part(mask, '#2a2a30', 4) + line('M26 50H36M112 48H124', '#2a2a30', 5);
  for (const [x0, x1] of [[38, 70], [78, 112]]) { const d = smooth([[x0, 42, 1], [x1, 41, 1], [x1, 58, 1], [x0, 59, 1]], true, 0.4); s += fill(d, '#bfe8ff') + inside(d, fill(poly([[x0, 42], [x0 + 8, 42], [x0, 52]]), '#ffffff', 'opacity=".7"')) + line(d, INK, 1.2); }
  s += eye({ x0: 46, x1: 62, top: 45, bot: 56, slant: 0.32, nose: 1, px: 58, py: 52, pr: 3.8, r: 2.4 });
  s += eye({ x0: 86, x1: 104, top: 44, bot: 55, slant: 0.32, nose: -1, px: 99, py: 50, pr: 4, r: 2.4 });
  // the fallboard lip and the keyboard grin
  const lip = smooth([[28, 70, 1], [120, 66, 1], [120, 74, 1], [28, 78, 1]], true, 0.3);
  s += part(lip, K.light, 3.4);
  const keys = smooth([[30, 78, 1], [118, 74, 1], [114, 90], [100, 96], [48, 98], [34, 92]]);
  s += fill(keys, '#fbfaf6') + inside(keys, Array.from({ length: 12 }, (_, i) => line(`M${34 + i * 7.4} 76V100`, '#b9b6aa', 1)).join('') +
    [0, 1, 3, 4, 5, 7, 8, 10].map((i) => fill(poly([[38 + i * 7.4, 76], [42.6 + i * 7.4, 76], [42.6 + i * 7.4, 87], [38 + i * 7.4, 87]]), '#1a1a1f')).join('')) + line(keys, INK, 2);
  // gold pedals for feet
  for (const x of [58, 74, 90]) s += part(smooth([[x - 4, 106, 1], [x + 4, 106, 1], [x + 3, 112, 1], [x - 3, 112, 1]], true, 0.3), '#ffc92e', 2);
  s += note(10, 30) + note(136, 70, '#9ff0ff') + bubble(8, 80, 3.4) + bubble(138, 100, 2.6) + bubble(14, 98, 2);
  return end(s);
}

// ---- C: an hourglass with its sand stopped mid-fall --------------------------------------------------
function hourglass() {
  begin();
  const WD = { base: '#8a5a2e', light: '#b07a42', shade: '#5e3a1a' };
  const SD = { base: '#f2c56a', shade: '#d49a3a', light: '#ffe09a' };
  let s = '';
  const glass = smooth([[36, 16, 1], [112, 16, 1], [108, 40], [86, 56], [80, 62], [86, 68], [108, 86], [112, 106, 1], [36, 106, 1], [40, 86], [62, 68], [68, 62], [62, 56], [40, 40]]);
  s += keyline(glass, 5.4) + fill(glass, 'rgba(220,244,255,.35)');
  // sand: the top bulb full like a head of hair, a heap below, the stream between frozen in the air
  s += inside(glass, fill(smooth([[30, 30], [118, 30], [108, 40], [86, 56], [74, 62], [62, 56], [40, 40]]), SD.base) + fill(smooth([[30, 30], [60, 30], [50, 46], [36, 40]]), SD.shade) + line('M44 32q20-4 44 0', SD.light, 1.6) +
    fill(smooth([[30, 106], [44, 98], [64, 94], [74, 90], [84, 94], [104, 98], [118, 106]]), SD.base) + fill(smooth([[30, 106], [50, 100], [60, 106]]), SD.shade) +
    fill(poly([[44, 20], [52, 20], [42, 100], [38, 100]]), '#ffffff', 'opacity=".55"') + fill(poly([[100, 70], [104, 70], [108, 100], [104, 100]]), '#ffffff', 'opacity=".4"'));
  for (const [y, r] of [[66, 1.6], [70, 1.3], [80, 1.4], [86, 1.2]]) s += fill(circle(74 + (y % 3) - 1, y, r), SD.shade);
  s += line(glass, '#e6f7ff', 1.2);
  // the frame: plates and turned posts
  const top = smooth([[20, 6, 1], [128, 6, 1], [128, 16, 1], [20, 16, 1]], true, 0.3), bot = smooth([[20, 106, 1], [128, 106, 1], [128, 117.5, 1], [20, 117.5, 1]], true, 0.3);
  for (const x of [26, 122]) { const p = smooth([[x - 3, 16, 1], [x + 3, 16, 1], [x + 4, 40], [x + 2, 62], [x + 4, 84], [x + 3, 106, 1], [x - 3, 106, 1], [x - 4, 84], [x - 2, 62], [x - 4, 40]]); s += part(p, x < 60 ? WD.shade : WD.base, 4); }
  s += part(top, WD.base, 5) + part(bot, WD.base, 5) + inside(top, line('M24 9H124', WD.light, 1.4)) + inside(bot, fill(poly([[18, 113], [130, 113], [130, 120], [18, 120]]), WD.shade) + line('M24 109H124', WD.light, 1.4));
  s += rim([top, bot], poly([[0, 0], [60, 0], [24, 20], [20, 120], [0, 120]]), 2);
  // a trickster's face on the full top bulb, one eye winking
  s += line('M48 38q7-6 14 0', INK, 2.8);
  s += eye({ x0: 78, x1: 98, top: 30, bot: 43, slant: 0.3, nose: -1, px: 92, py: 37, pr: 4.4 });
  s += line('M46 30l16 2M78 26l22-5', INK, 2.6);
  s += line('M60 48Q72 54 86 46', INK, 2.4) + line('M86 46l3-3', INK, 1.8);
  // pause marks: the stop in stop-and-go
  s += part(smooth([[132, 50, 1], [136, 50, 1], [136, 64, 1], [132, 64, 1]], true, 0.3), '#ffd24a', 2) + part(smooth([[139, 50, 1], [143, 50, 1], [143, 64, 1], [139, 64, 1]], true, 0.3), '#ffd24a', 2);
  s += sparkle(10, 40, 3.4) + sparkle(8, 90, 3);
  return end(s);
}

// ---- D (your request): the diver from the card ---------------------------------------------------------
function scuba25() {
  begin();
  const S = { base: '#f4c49a', light: '#ffdcb8', shade: '#d8956e' };
  const HR = { base: '#2a2230', light: '#4a4058', shade: '#16121c' };
  const BK = '#1c1c24';
  const bub = (x, y, r) => line(circle(x, y, r), '#bfe8ff', 1.6) + fill(circle(x - r * 0.35, y - r * 0.35, r * 0.28), '#ffffff');
  const note = (x, y, k = 1) => line(`M${x + 3.4 * k} ${y}V${y - 13 * k}q4 2 6 7`, INK, 3.6 * k) + line(`M${x + 3.4 * k} ${y}V${y - 13 * k}q4 2 6 7`, '#ffd24a', 1.6 * k) + part(ellipse(x, y, 4 * k, 3 * k, -0.4), '#ffd24a', 2);
  let s = '';
  // the regulator hose, running back to the tank behind
  const hose = 'M44 108C26 118 6 108 8 84';
  s += line(hose, INK, 9) + line(hose, '#2a2a34', 5) + line(hose, '#4a4a58', 1.6, 'stroke-dasharray="1.4 3"');
  // the head, the ear, the wet spiky hair
  const ear = smooth([[34, 68], [22, 64], [16, 76], [22, 90], [34, 92]]);
  const head = headShape();
  const hair = smooth([[24, 66], [20, 44], [28, 26], [42, 14], [50, 20], [58, 6], [70, 16], [82, 4], [92, 16], [106, 10], [110, 24], [122, 32], [124, 46], [116, 40], [98, 38], [76, 40], [56, 44], [40, 50], [30, 66]]);
  s += keyline([ear, head, hair]);
  s += fill(ear, S.base) + line('M27 72q-5 6 0 13', S.shade, 1.6) + fill(head, S.base);
  s += inside(head, fill(smooth([[0, 40], [40, 50], [44, 130], [0, 130]]), S.shade) + fill(smooth([[100, 90], [118, 84], [122, 104], [108, 108]]), S.light));
  s += fill(hair, HR.base) + inside(hair, fill(smooth([[0, 20], [40, 26], [36, 70], [0, 70]]), HR.shade) + line('M48 22l6-8M66 16l8-8M88 14l8-6M40 36Q70 26 104 30', HR.light, 1.6));
  s += rim([ear, head, hair], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  s += browsE([54, 49, 74, 53], [86, 51, 110, 44], 3.2);
  // the mask: strap round the back, black frame, the eyes behind the glass
  s += part(poly([[20, 56], [52, 60], [52, 70], [20, 66]]), BK, 3);
  const frame = smooth([[48, 58, 1], [80, 54], [112, 52], [120, 58], [120, 78], [112, 84], [104, 92, 1], [92, 86], [80, 86], [56, 86], [46, 78]]);
  s += part(frame, BK) + inside(frame, line('M54 58Q86 52 114 56', '#5a5a6a', 1.6));
  const glass = smooth([[54, 62, 1], [112, 58, 1], [114, 78, 1], [56, 82, 1]], true, 0.35);
  s += fill(glass, '#bfeaf4') + inside(glass, fill(glass, S.base, 'opacity=".55"') +
    eyeE({ x0: 60, x1: 76, top: 64, bot: 77, slant: 0.45, nose: 1, px: 71, py: 71, pr: 4.2 }) +
    eyeE({ x0: 88, x1: 106, top: 62, bot: 76, slant: 0.45, nose: -1, px: 100, py: 69, pr: 4.6 }) +
    fill(glass, '#7ad4f0', 'opacity=".2"') + line('M56 80L68 62M62 82L72 68', '#ffffff', 2.2, 'opacity=".45"'));
  s += line(glass, '#5a5a6a', 1.6);
  // the regulator in his mouth, a puffed cheek, bubbles rising
  s += fill(ellipse(76, 98, 7, 5), '#ff8a8a', 'opacity=".45"');
  const reg = smooth([[84, 94, 1], [112, 92, 1], [114, 108, 1], [86, 110, 1]], true, 0.35);
  s += part(reg, '#2a2a34', 4.4) + part(circle(100, 101, 5.4), '#5a5f68', 2.4) + line('M97 101h6M100 98v6', '#2a2a34', 1.4) +
    part(smooth([[88, 108, 1], [110, 108, 1], [106, 116, 1], [92, 116, 1]], true, 0.3), '#3a3a46', 3);
  s += bub(124, 86, 3.4) + bub(132, 70, 4.4) + bub(126, 54, 3) + bub(136, 40, 5);
  // the card's music notes
  s += note(126, 22) + note(10, 40, 0.8);
  return end(s);
}

export default {
  card: 25, champion: 'המטעה', en: 'The Trickster', theme: 'Card: a piano on the sea floor, a diver playing it · Power: stop-and-go (Delay)',
  options: [
    { letter: 'A', name: 'Lure', draw: angler,
      blurb: 'The trickster of the card\'s deep water: an anglerfish dangling a glowing bait in front of its face, the way its shot hangs in the air to fool you, then a huge underbite of needle teeth. <i>Silhouette: a big jaw under an arching rod.</i>' },
    { letter: 'B', name: 'Deep Keys', draw: piano,
      blurb: 'The card\'s piano itself, gone diving: an upright in black lacquer wearing a dive mask, a snorkel up its side, the keyboard for a grin, gold pedals for feet, notes and bubbles floating off it. <i>Silhouette: a block with a snorkel.</i>' },
    { letter: 'C', name: 'Hourglass', draw: hourglass,
      blurb: 'Stop-and-go as an object: an hourglass with its sand stopped dead mid-fall (the frozen stream hanging under its chin), its face on the full top bulb, one eye winking, pause marks beside it. <i>Silhouette: two bulbs pinched in a wooden frame.</i>' },
    { letter: 'D', name: 'Scuba Diver', draw: scuba25, marks: { eyes: [[68, 70.5], [97, 69]], nose: [100, 86] }, request: true,
      blurb: 'Your request: the diver from the card. Wet spiky hair, a black dive mask with his eyes behind the glass, the regulator in his mouth with its hose running back to the tank, bubbles rising, the card\'s music notes. <i>Silhouette: a person\'s head, spiky hair, a mask and a hose.</i>' },
  ],
};
