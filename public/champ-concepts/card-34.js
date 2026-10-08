// Card #34 — אמן הצמר (The Wool Master). Card: Naveh holding a glass orb with a storm cloud
// and a twister in it, lightning everywhere ("we stole a cloud from the highest place in
// Japan"). Power: woollen shoes, a shot up out of sight that dives back in, with a shock (Aerial, shock).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const zap = (x, y, k = 1, c = '#ffe14a') => part(poly([[x, y], [x - 5 * k, y + 9], [x - 1 * k, y + 8], [x - 4 * k, y + 16], [x + 4 * k, y + 5], [x, y + 6]]), c, 2.2);

// ---- A: a sheep whose wool is the stolen storm cloud --------------------------------------------
function sheep() {
  begin();
  const W = { base: '#e8ecf4', shade: '#b8c0d4', deep: '#8a94b0', light: '#ffffff' };
  let s = '';
  const puffs = [[36, 50, 22], [62, 34, 24], [90, 30, 20], [24, 78, 20], [46, 98, 21], [78, 100, 20], [106, 102, 15], [56, 66, 26]].map(([x, y, r]) => circle(x, y, r));
  // static: the wool frizzed into points round the top
  const frizz = [[30, 26], [52, 10], [78, 8], [104, 12], [14, 54]].map(([x, y]) => poly([[x - 5, y + 8], [x, y - 4], [x + 5, y + 8]]));
  s += keyline([...puffs, ...frizz]) + [...frizz, ...puffs].map((d) => fill(d, W.base)).join('');
  let curls = '';
  for (let i = 0; i < 16; i++) { const x = 20 + ((i * 37) % 90), y = 30 + ((i * 23) % 80); curls += `M${x} ${y}a3 3 0 1 1 3 3`; }
  s += inside([...puffs, ...frizz], fill(smooth([[0, 30], [30, 40], [26, 90], [36, 130], [0, 130]]), W.shade) + fill(smooth([[10, 100], [60, 110], [120, 104], [120, 130], [10, 130]]), W.shade) + line(curls, W.deep, 1.2) +
    fill(circle(64, 28, 14), W.light));
  s += zap(40, 58) + zap(30, 88, -1) + zap(66, 18, 1, '#fff36a');
  s += rim(puffs, poly([[0, 0], [70, 0], [40, 30], [16, 70], [0, 90]]), 2, '#fff36a');
  // the black face pushing out of it, ears out sideways
  s += part(smooth([[118, 52], [136, 44], [144, 50, 1], [132, 60]]), '#2a2a30', 4) + fill(smooth([[124, 52], [136, 48], [138, 50], [130, 56]]), '#e8a0a8');
  const face = smooth([[84, 46], [104, 40], [122, 52], [132, 74], [128, 96], [114, 106], [96, 104], [86, 88], [80, 66]]);
  s += part(face, '#2a2a30') + inside(face, fill(smooth([[100, 42], [120, 50], [128, 66], [112, 60]]), '#4a4a55') + fill(smooth([[96, 90], [126, 88], [126, 110], [96, 110]]), '#3a3a42'));
  // a fringe of wool over its brow
  s += part(smooth([[80, 50], [88, 38], [100, 36], [112, 40], [118, 48], [106, 50], [96, 54], [86, 56]]), W.base, 4);
  // startled white eyes, a nervous wobble of a mouth: it's all charged up
  s += eye({ x0: 92, x1: 106, top: 58, bot: 70, slant: 0.05, nose: 1, px: 101, py: 64, pr: 2.8, r: 2.4 });
  s += eye({ x0: 110, x1: 126, top: 56, bot: 69, slant: 0.05, nose: -1, px: 120, py: 63, pr: 3, r: 2.4 });
  s += line('M102 92q4-3 8 0q4 3 8 0', '#e8ecf4', 2);
  s += fill(ellipse(118, 80, 2, 1.4), '#8a8a95');
  s += zap(138, 92) + sparkle(10, 20, 3.4, '#fff36a');
  return end(s);
}

// ---- B: a ball of yarn, crackling with static --------------------------------------------------------
function yarn() {
  begin();
  const Y = { base: '#3fb0c8', light: '#7ad8e8', shade: '#2a7a90', deep: '#1a5468' };
  let s = '';
  // knitting needles crossed through its top
  for (const [x0, y0, x1, y1] of [[34, 52, 100, 4], [114, 52, 48, 4]]) s += line(`M${x0} ${y0}L${x1} ${y1}`, INK, 6) + line(`M${x0} ${y0}L${x1} ${y1}`, '#d9b77a', 3) + part(circle(x1, y1, 4), '#e5262e', 2.4);
  const ball = circle(72, 66, 47);
  s += part(ball, Y.base);
  let strands = '';
  for (let i = -3; i <= 3; i++) strands += ellipse(72 + i * 4, 66, 47, 14 + Math.abs(i) * 3, 0.5 + i * 0.08);
  for (let i = -2; i <= 2; i++) strands += ellipse(72, 66 + i * 4, 15 + Math.abs(i) * 4, 47, -0.4 + i * 0.1);
  s += inside(ball, fill(circle(80, 74, 47), Y.shade) + fill(circle(66, 60, 40), Y.base) + line(strands, Y.light, 1.4, 'opacity=".75"') + fill(smooth([[50, 26], [80, 22], [96, 32], [70, 34]]), '#ffffff', 'opacity=".35"'));
  s += rim(ball, poly([[0, 0], [60, 0], [36, 30], [20, 80], [0, 90]]), 2);
  // the loose end trailing off
  s += line('M112 96Q136 100 132 112Q128 120 140 120', INK, 6) + line('M112 96Q136 100 132 112Q128 120 140 120', Y.light, 3);
  // a mischievous face, frizz standing up
  s += eye({ x0: 52, x1: 68, top: 56, bot: 68, slant: 0.4, nose: 1, px: 63, py: 63, pr: 4 });
  s += eye({ x0: 80, x1: 98, top: 54, bot: 67, slant: 0.4, nose: -1, px: 92, py: 61, pr: 4.4 });
  s += line('M48 50L70 54M78 52L100 46', INK, 2.8);
  const mouth = smooth([[60, 80, 1], [76, 82], [92, 78, 1], [88, 88], [76, 92], [64, 88]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[58, 77], [94, 76], [94, 82], [58, 83]]), '#fff')) + line(mouth, INK, 1.8);
  s += line('M30 30l-4-6M24 42l-6-2M122 32l4-6M128 44l6-2', Y.light, 1.6);
  s += zap(20, 70) + zap(128, 62, -1) + zap(18, 98, 1, '#fff36a');
  return end(s);
}

// ---- C: an electric eel, coiled and humming ----------------------------------------------------------
function eel() {
  begin();
  const E = { base: '#2f5a5a', light: '#4a8a86', hi: '#7ac0b8', shade: '#1e3e40', belly: '#ffb627' };
  let s = '';
  // its body coiled along the bottom
  const coil = 'M38 70Q10 84 16 104Q22 118 60 116Q104 114 130 104Q142 96 134 88';
  s += line(coil, INK, 26) + line(coil, E.base, 20) + line('M22 104Q34 114 60 112Q100 110 128 100', E.belly, 5) + line(coil, '#5ff2ff', 3, 'stroke-dasharray="1 9" opacity=".9"');
  const head = smooth([[30, 76], [32, 52], [46, 34], [72, 26], [100, 30], [120, 42], [136, 56], [140, 70, 1], [128, 80], [104, 86], [74, 90], [48, 88]]);
  s += part(head, E.base);
  s += inside(head, fill(smooth([[10, 30], [44, 36], [40, 80], [10, 100]]), E.shade) + fill(smooth([[64, 28], [104, 32], [124, 46], [90, 42]]), E.light) + line('M68 30q30-2 50 14', E.hi, 2.2) +
    fill('M30 78Q80 84 140 70V100H30Z', E.belly) + [[48, 50], [60, 44], [44, 64], [76, 40]].map(([x, y]) => fill(circle(x, y, 2), '#5ff2ff')).join(''));
  s += rim(head, poly([[0, 0], [70, 0], [40, 30], [24, 70], [0, 80]]), 2, '#5ff2ff');
  // small fierce eyes, a wide toothy grin, the nostril tube on its snout
  s += eye({ x0: 78, x1: 92, top: 46, bot: 56, slant: 0.5, nose: 1, px: 88, py: 52, pr: 3.4, r: 2.2 });
  s += eye({ x0: 100, x1: 116, top: 44, bot: 55, slant: 0.5, nose: -1, px: 111, py: 50, pr: 3.6, r: 2.2 });
  s += line('M74 40L94 44M98 42L120 36', INK, 2.6);
  s += line('M126 54l8-4', INK, 4) + line('M126 54l8-4', E.light, 1.8);
  const mouth = smooth([[84, 68, 1], [112, 70], [136, 66, 1], [128, 76], [108, 80], [92, 76]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[82, 66], [138, 64], [138, 70], [82, 72]]), '#fff') + line('M92 66v6M100 66v6M108 66v6M116 66v6M124 65v6', '#c9c2c8', 1)) + line(mouth, INK, 1.8);
  s += zap(132, 12) + zap(14, 30, -1) + zap(140, 96) + line('M20 54l-8-4M24 46l-6-8', '#5ff2ff', 1.6);
  return end(s);
}

// ---- D (your request): a weather wizard, storms at his command ------------------------------------------------
function wizard34() {
  begin();
  const S = { base: '#f4c49a', light: '#ffdcb8', shade: '#d8956e' };
  const HT = { base: '#3a3aa0', light: '#5c5cd0', shade: '#24246e' };
  const CL = { base: '#c4cad8', light: '#eef0f6', shade: '#8e98ac' };
  const bolt = (x, y, k = 1) => part(poly([[x, y], [x - 5 * k, y + 9 * k], [x - 1 * k, y + 8 * k], [x - 4 * k, y + 16 * k], [x + 4 * k, y + 5 * k], [x, y + 6 * k]]), '#ffe14a', 2.2);
  const cloud = (pts) => pts.map(([x, y, r]) => circle(x, y, r));
  let s = '';
  // the head, the ear
  const ear = smooth([[34, 70], [22, 66], [16, 78], [22, 92], [34, 94]]);
  const head = headShape();
  s += keyline([ear, head]) + fill(ear, S.base) + line('M27 74q-5 6 0 13', S.shade, 1.6) + fill(head, S.base);
  s += inside(head, fill(smooth([[0, 40], [40, 50], [44, 130], [0, 130]]), S.shade) + fill(smooth([[60, 46], [100, 46], [118, 58], [90, 54]]), S.light));
  s += rim([ear, head], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // a beard of storm cloud, lightning crackling in it, the grin inside
  const beard = cloud([[32, 92, 11], [42, 102, 11.4], [56, 108, 11], [74, 110, 11], [92, 109, 11], [106, 104, 11], [118, 95, 9.4], [122, 84, 7]]);
  s += keyline(beard, 5) + beard.map((d) => fill(d, CL.base)).join('') +
    inside(beard, fill(poly([[0, 110], [144, 106], [144, 130], [0, 130]]), CL.shade) + fill(smooth([[40, 92], [80, 100], [118, 90], [100, 100], [60, 104]]), CL.light));
  s += bolt(56, 100, 0.8);
  const mouth = smooth([[84, 92, 1], [100, 94], [114, 88, 1], [110, 98], [98, 102], [88, 100]]);
  s += mouthE(99, 95, 30, fill(mouth, '#2a0e14') + inside(mouth, fill(poly([[82, 89], [116, 86], [116, 92], [82, 95]]), '#fff') + fill(ellipse(100, 103, 8, 4), '#ff7a8a')) + line(mouth, INK, 1.8));
  // electric-blue eyes under brows of cloud
  s += eyeE({ x0: 54, x1: 70, top: 60, bot: 72, slant: 0.5, nose: 1, px: 65, py: 67, pr: 4, ring: '#2a7ae0' });
  s += eyeE({ x0: 82, x1: 100, top: 58, bot: 71, slant: 0.5, nose: -1, px: 95, py: 65, pr: 4.4, ring: '#2a7ae0' });
  const brows = cloud([[52, 54, 5], [60, 52, 6], [70, 54, 5], [82, 52, 5], [92, 49, 6], [102, 48, 5.4]]);
  s += keyline(brows, 3.4) + brows.map((d) => fill(d, CL.light)).join('');
  // the wizard's hat, its tip bent back under a little storm cloud of its own
  const cone = smooth([[30, 40, 1], [44, 22], [54, 12], [42, 10], [28, 12, 1], [42, 2], [66, 0], [86, 12], [102, 26], [116, 38, 1]]);
  s += part(cone, HT.base) + inside(cone, fill(smooth([[0, 0], [52, 8], [54, 50], [0, 50]]), HT.shade) + line('M66 6Q84 18 96 36', HT.light, 2.4) +
    fill(poly([[36, 28], [108, 26], [108, 38], [36, 40]]), '#ffcc33') + sparkle(74, 18, 4, '#ffe14a') + sparkle(60, 22, 2.6, '#ffe14a'));
  const brim = smooth([[22, 44, 1], [40, 36], [72, 34], [104, 32], [124, 38, 1], [106, 46], [72, 46], [38, 48]]);
  s += part(brim, HT.light) + inside(brim, fill(poly([[0, 42], [144, 40], [144, 60], [0, 60]]), HT.base));
  s += rim([cone, brim], poly([[0, 0], [70, 0], [36, 40], [0, 60]]), 1.8, '#ffe9a8');
  const tip = cloud([[14, 12, 6], [22, 7, 7], [31, 10, 5.4]]);
  s += keyline(tip, 3.4) + tip.map((d) => fill(d, CL.base)).join('') + inside(tip, fill(poly([[0, 12], [40, 12], [40, 20], [0, 20]]), CL.shade));
  s += line('M12 21l-2 6M20 21l-2 6M28 19l-2 6', '#7ad4ff', 1.6) + bolt(22, 14, 0.6);
  // bolts flying off him
  s += bolt(130, 60, 0.9) + bolt(18, 70, 0.8);
  return end(s);
}

export default {
  card: 34, champion: 'אמן הצמר', en: 'The Wool Master', theme: 'Card: a stolen storm cloud in a glass orb · Power: woollen shoes, up and down with a shock (Aerial, shock)',
  options: [
    { letter: 'A', name: 'Storm Sheep', draw: sheep,
      blurb: 'Wool and the card\'s stolen cloud in one: a sheep whose fleece is a storm cloud, frizzed with static and crackling with lightning, a black face poking out, eyes wide because it\'s all charged up. <i>Silhouette: a heap of frizzed wool, a black face out front.</i>' },
    { letter: 'B', name: 'Yarn Ball', draw: yarn,
      blurb: 'The wool master\'s weapon: a ball of teal yarn with two knitting needles crossed through its top, a loose end trailing, frizz standing up and static sparks flying. <i>Silhouette: a ball with an X of needles on top.</i>' },
    { letter: 'C', name: 'Electric Eel', draw: eel,
      blurb: 'The shock with no wool at all: an electric eel coiled round the bottom, glowing spots down its body, a wide toothy grin, lightning cracking off it like the card\'s. <i>Silhouette: a long head over a thick coil.</i>' },
    { letter: 'D', name: 'Storm Wizard', draw: fitted(wizard34, [1.05, 0.99, 0, -1]), marks: { eyes: [[62, 66], [91, 64.5]], nose: [100, 82] }, request: true,
      blurb: 'Your request: a wizard of the weather. A blue wizard\'s hat whose bent tip has its own little storm cloud raining on it, a beard and brows made of storm cloud (woolly, like the champion\'s name) with lightning crackling in them, electric-blue eyes, bolts flying off him. <i>Silhouette: a wide wizard hat over a cloud beard.</i>' },
  ],
};
