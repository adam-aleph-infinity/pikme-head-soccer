// Card #35 — הנווט (The Navigator). Card: Shoval as a caveman tearing into a huge flaming joint
// of meat, tiger-stripe paint, fire behind ("whoever wastes the most at a buffet wins 5,000").
// Power: a guided missile, the fastest kind of shot, straight through a block (Critical).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const steam = (x, y, k = 1) => line(`M${x} ${y}q${-6 * k} -8 0 -14q${6 * k} -6 0 -14`, '#ffffff', 2.4, 'opacity=".75"');

// ---- A: the caveman's joint of meat, on the bone ------------------------------------------------------
function meat() {
  begin();
  const M = { base: '#a8542a', light: '#d47a3a', hi: '#f2a868', shade: '#7a3418', char: '#4e200c' };
  const BN = { base: '#fbf4e4', shade: '#ddd0b4' };
  let s = steam(40, 22) + steam(70, 14, -1);
  // the bone through it, knobs at both ends
  const knob = (x, y) => [circle(x - 4, y - 4, 7), circle(x + 4, y + 4, 7)];
  const bone = [poly([[26, 98], [34, 104], [118, 28], [110, 20]]), ...knob(116, 22), ...knob(26, 104)];
  s += keyline(bone) + bone.map((d) => fill(d, BN.base)).join('') + inside(bone, fill(poly([[0, 120], [10, 120], [144, 10], [144, 30], [30, 130]]), BN.shade));
  const joint = ellipse(74, 64, 58, 50, -0.25);
  s += part(joint, M.base);
  s += inside(joint, fill(ellipse(82, 72, 58, 50, -0.25), M.shade) + fill(ellipse(68, 56, 48, 40, -0.25), M.base) + fill(smooth([[40, 40], [70, 26], [90, 28], [64, 44]]), M.light) + line('M44 40q20-14 40-12', M.hi, 3) +
    // char marks from the fire
    line('M42 82l14-10M60 96l18-12M86 100l14-10M104 84l10-8', M.char, 3.4, 'opacity=".8"'));
  // a bite taken out of it
  s += fill(smooth([[104, 30], [116, 36], [118, 50], [110, 48], [104, 40]]), '#f2c09a') + line('M104 30Q102 40 110 48Q116 50 118 50', INK, 2);
  s += rim(joint, poly([[0, 0], [70, 0], [36, 40], [20, 80], [0, 90]]), 2.2, '#ffd27a');
  // gleefully greedy
  s += eyeE({ x0: 48, x1: 64, top: 54, bot: 66, slant: 0.18, nose: 1, px: 59, py: 61, pr: 4.2 });
  s += eyeE({ x0: 76, x1: 94, top: 52, bot: 65, slant: 0.18, nose: -1, px: 88, py: 59, pr: 4.6 });
  s += expr() === 'normal' ? line('M46 48q8-4 18-1M76 46q9-5 20-1', INK, 2.4) : browsE([46, 48, 64, 47], [76, 46, 96, 45], 2.4);
  const mouth = smooth([[56, 76, 1], [74, 78], [92, 74, 1], [88, 86], [74, 92], [62, 86]]);
  s += mouthE(74, 82, 36, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[54, 73], [94, 72], [94, 78], [54, 79]]), '#fff') + fill(ellipse(74, 92, 8, 4), '#ff7a96')) + line(mouth, INK, 1.8));
  // small flames licking up from under it
  for (const [x, h] of [[46, 12], [82, 16], [108, 10]]) s += part(smooth([[x - 6, 118], [x - 4, 110], [x, 118 - h, 1], [x + 4, 110], [x + 6, 118]]), '#ff7a1a', 2.6) + fill(smooth([[x - 2.6, 118], [x, 112 - h * 0.3, 1], [x + 2.6, 118]]), '#fff2a8');
  return end(s);
}

// ---- B: a woolly mammoth from the caveman's world -------------------------------------------------------
function mammoth() {
  begin();
  const H = { base: '#7a4a2a', light: '#a8703e', hi: '#c99058', shade: '#4e2c14' };
  const TK = { base: '#f4ead2', shade: '#d8c8a2' };
  let s = '';
  // the far tusk, curling up behind
  const tuskB = 'M44 100Q6 112 4 82Q4 70 12 64';
  s += line(tuskB, INK, 13) + line(tuskB, TK.shade, 7.6);
  // the domed, shaggy head
  const head = smooth([[24, 98], [20, 60], [30, 30], [52, 12], [78, 8], [100, 16], [114, 36], [120, 60], [118, 84], [108, 98], [104, 112, 1], [96, 104], [86, 117.5, 1], [76, 106], [66, 117.5, 1], [56, 106], [46, 116, 1], [36, 104], [28, 112, 1]]);
  s += part(head, H.base);
  let hair = '';
  for (let i = 0; i < 12; i++) { const x = 28 + i * 7.4; hair += `M${x} ${20 + (i % 3) * 4}q${-4} 30 ${2} 60`; }
  s += inside(head, fill(smooth([[0, 10], [40, 20], [34, 80], [40, 130], [0, 130]]), H.shade) + line(hair, H.shade, 1.4, 'opacity=".6"') + fill(smooth([[56, 12], [92, 14], [108, 32], [78, 26]]), H.light) + line('M60 14q24-4 40 14', H.hi, 2.4) +
    // the caveman's red ochre stripes on its brow
    line('M56 30l10 10M66 26l10 10M76 24l10 10', '#c8341e', 3.2));
  s += rim(head, poly([[0, 0], [70, 0], [36, 30], [20, 80], [0, 100]]), 2.2);
  // small eyes under a shaggy brow
  s += eye({ x0: 60, x1: 74, top: 54, bot: 64, slant: 0.4, nose: 1, px: 70, py: 60, pr: 3.4, r: 2.2 });
  s += eye({ x0: 84, x1: 100, top: 52, bot: 63, slant: 0.4, nose: -1, px: 95, py: 58, pr: 3.6, r: 2.2 });
  s += part(smooth([[54, 50], [64, 44], [78, 50], [70, 52]]), H.light, 3) + part(smooth([[80, 50], [92, 42], [104, 46], [94, 50]]), H.light, 3);
  // the trunk swinging down, the near tusk curving up and forward
  const trunk = 'M88 66Q104 86 98 104Q94 116 82 112';
  s += line(trunk, INK, 17) + line(trunk, H.base, 11) + line('M96 76q4 8 4 16M96 98q-2 6-6 8', H.shade, 1.4);
  const tuskF = 'M100 84Q134 96 140 66Q142 56 136 50';
  s += line(tuskF, INK, 14) + line(tuskF, TK.base, 8.4) + line('M104 86Q128 92 134 72', '#ffffff', 1.6, 'opacity=".7"');
  s += sparkle(132, 22, 3.6) + sparkle(12, 26, 3);
  return end(s);
}

// ---- C: a homing missile, its target locked ---------------------------------------------------------------
function missile() {
  begin();
  const N = { base: '#2f4f8f', light: '#4a6ab8', hi: '#8aa6e0', shade: '#1e3466' };
  const Y = { base: '#ffd23a', shade: '#e0a812', light: '#ffe88a' };
  let s = line('M2 40h14M0 56h12M4 72h10', '#ffffff', 2, 'opacity=".55"');
  for (const [x, y, r] of [[30, 112, 7], [16, 108, 5], [118, 112, 7], [132, 108, 5]]) s += part(circle(x, y, r), '#d8d2c8', 2.6);
  // fins
  const finB = poly([[50, 66], [16, 98], [18, 117.5], [52, 104]]), finF = poly([[98, 66], [132, 98], [130, 117.5], [96, 104]]);
  for (const d of [finB, finF]) s += part(d, Y.base) + inside(d, fill(poly([[0, 100], [144, 100], [144, 120], [0, 120]]), Y.shade));
  const body = smooth([[50, 104, 1], [48, 40], [56, 20], [74, 2, 1], [92, 20], [100, 40], [98, 104, 1], [88, 117.5, 1], [60, 117.5, 1]]);
  s += part(body, N.base);
  s += inside(body, fill(poly([[0, 0], [62, 0], [62, 130], [0, 130]]), N.shade) + fill(poly([[86, 30], [94, 30], [94, 104], [86, 104]]), N.light, 'opacity=".6"') + line('M90 40V100', N.hi, 1.6) +
    // the yellow nose cone
    fill(poly([[40, 0], [110, 0], [110, 26], [40, 26]]), Y.base) + fill(poly([[40, 0], [70, 0], [70, 26], [40, 26]]), Y.shade) + line('M48 26Q74 30 100 26', INK, 1.6) +
    fill(poly([[40, 94], [110, 94], [110, 100], [40, 100]]), Y.base));
  s += rim(body, poly([[0, 0], [70, 0], [56, 30], [48, 120], [0, 120]]), 2);
  // a navigator's compass rose on its chest
  const rose = poly([[74, 72], [77, 80], [86, 83], [77, 86], [74, 94], [71, 86], [62, 83], [71, 80]]);
  s += part(rose, Y.base, 2.4) + fill(poly([[74, 72], [77, 80], [74, 83]]), '#e5262e');
  // eyes locked on, a targeting ring over the front one
  s += eye({ x0: 56, x1: 70, top: 40, bot: 51, slant: 0.4, nose: 1, px: 66, py: 47, pr: 3.6, r: 2.2 });
  s += eye({ x0: 78, x1: 94, top: 39, bot: 50, slant: 0.4, nose: -1, px: 89, py: 45, pr: 3.8, r: 2.2 });
  s += line(circle(88, 45, 10), '#ff4a5a', 1.6) + line('M88 31v6M88 53v6M74 45h6M96 45h6', '#ff4a5a', 1.6);
  s += line('M62 60Q74 66 88 58', INK, 2.2) + line('M88 58l3-2', INK, 1.6);
  s += sparkle(124, 30, 4) + sparkle(24, 22, 3);
  return end(s);
}

export default {
  card: 35, champion: 'הנווט', en: 'The Navigator', theme: 'Card: a caveman at a buffet, a flaming joint of meat · Power: a guided missile (Critical)',
  options: [
    { letter: 'A', name: 'Big Meat', draw: meat, marks: { eyes: [[56, 60], [85, 58.5]], nose: [78, 70] },
      blurb: 'The card\'s flaming joint, gleefully greedy: a cartoon roast on the bone, charred stripes, a bite already out of it, small flames licking from underneath, steam rising. <i>Silhouette: an oval roast with a bone through it.</i>' },
    { letter: 'B', name: 'Mammoth', draw: mammoth,
      blurb: 'The caveman\'s world, the big one: a woolly mammoth with a domed shaggy head, the card\'s red ochre stripes on its brow, its trunk swinging, two great tusks curling up either side. <i>Silhouette: a shaggy dome between two curled tusks.</i>' },
    { letter: 'C', name: 'Homing Missile', draw: missile,
      blurb: 'The power itself: a navy missile with a yellow nose and fins, a compass rose on its chest, its eyes locked on and a red targeting ring over one of them. <i>Silhouette: a tall pointed rocket on wide fins.</i>' },
  ],
};
