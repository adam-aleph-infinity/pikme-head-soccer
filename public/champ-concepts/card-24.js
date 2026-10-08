// Card #24 — האקרובט (The Acrobat). Card: Naveh grinning in a golden treasure cave, a genie's
// lamp crackling with lightning, gold everywhere ("24 hours in a giant toy-brick city"). Power:
// trampoline bounces, a shot that rises and falls as it flies (Up-and-Down).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, coin, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };

// ---- A: the card's lamp, its spout for a nose ----------------------------------------------------
function lamp() {
  begin();
  let s = '';
  // the genie's smoke curling out of the spout
  const smoke = 'M138 40Q142 28 132 24Q122 20 126 12';
  s += line(smoke, INK, 9) + line(smoke, '#b47bff', 5.6) + line('M137 34Q138 28 132 27', '#e6d2ff', 1.6) + part(circle(126, 10, 4), '#b47bff', 2.4);
  // the handle loop at the back
  const handle = 'M32 64Q12 60 10 76Q8 92 28 94';
  s += line(handle, INK, 11) + line(handle, G.base, 6.4) + line('M28 63Q16 62 13 72', G.light, 1.6);
  const foot = smooth([[52, 104, 1], [92, 104, 1], [100, 117.5, 1], [44, 117.5, 1]], true, 0.4);
  const bowl = smooth([[20, 86], [20, 64], [32, 50], [60, 44], [90, 44], [112, 50], [122, 58], [130, 50], [138, 40, 1], [142, 50], [136, 68], [128, 84], [118, 98], [96, 110], [60, 112], [34, 104]]);
  const lid = smooth([[32, 50, 1], [36, 32], [54, 18], [90, 18], [108, 32], [112, 50, 1]]);
  s += keyline([foot, bowl, lid]);
  s += fill(foot, G.shade) + fill(bowl, G.base) + fill(lid, G.base);
  s += inside(bowl, fill(smooth([[10, 60], [40, 62], [36, 100], [10, 110]]), G.shade) + fill(smooth([[30, 96], [80, 104], [130, 88], [130, 120], [30, 120]]), G.shade) +
    line('M36 56Q76 48 116 56', G.light, 2.4) + line('M34 80Q76 92 120 78', G.deep, 1.2) + line('M40 86l6 4l6-4l6 4l6-4l6 4l6-4l6 4l6-4l6 4l6-4', G.deep, 1));
  s += inside(lid, fill(poly([[30, 14], [54, 14], [54, 52], [30, 52]]), G.shade) + line('M60 24q16-4 34 4', G.light, 2));
  s += line('M32 50H112', INK, 1.6);
  s += part(circle(72, 12, 6), G.base, 4) + fill(circle(70, 10, 1.8), G.light) + part(ellipse(72, 36, 6, 4.6), '#e5262e', 2.4) + fill(ellipse(70.4, 34.6, 1.8, 1.2), '#ffb4a8');
  s += rim([bowl, lid], poly([[0, 0], [70, 0], [44, 40], [24, 70], [20, 110], [0, 110]]), 2);
  // a wily grin on the bowl
  s += eyeE({ x0: 50, x1: 66, top: 66, bot: 78, slant: 0.45, nose: 1, px: 62, py: 73, pr: 4 });
  s += eyeE({ x0: 80, x1: 98, top: 64, bot: 77, slant: 0.45, nose: -1, px: 93, py: 71, pr: 4.4 });
  s += browsE([48, 60, 68, 64], [80, 62, 100, 56], 2.8);
  const mouth = smooth([[62, 86, 1], [80, 88], [98, 84, 1], [94, 94], [80, 98], [68, 94]]);
  s += mouthE(80, 90, 36, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[60, 83], [100, 82], [100, 88], [60, 89]]), '#fff')) + line(mouth, INK, 1.8));
  // the card's lightning
  for (const [x, y] of [[20, 30]]) s += part(poly([[x, y], [x - 6, y + 10], [x - 1, y + 9], [x - 5, y + 18], [x + 4, y + 6], [x - 1, y + 7]]), '#ffe14a', 2.2);
  s += sparkle(122, 28, 3.4);
  return end(s);
}

// ---- B: an acrobatic dolphin, balancing a gold coin from the treasure -----------------------------
function dolphin() {
  begin();
  const D = { base: '#7f9bb5', light: '#a9c2d8', hi: '#d6e4f0', shade: '#5a7690', deep: '#3e5670', belly: '#eef3f7' };
  let s = '';
  // the blowhole's spout, a plume of water for hair
  const spout = smooth([[54, 34], [48, 16], [56, 4], [64, 12], [70, 2], [78, 10], [84, 4], [86, 18], [74, 34]]);
  s += part(spout, '#bfe8ff', 4) + inside(spout, line('M60 30Q58 18 64 12M72 30Q74 18 78 10', '#ffffff', 1.6));
  for (const [x, y, r] of [[44, 10, 2.4], [92, 8, 2], [38, 22, 1.6]]) s += part(circle(x, y, r), '#bfe8ff', 2);
  // the fin peeking over its back
  s += part(smooth([[30, 50], [16, 30], [10, 18, 1], [28, 28], [46, 42]]), D.shade);
  const head = smooth([[26, 96], [22, 70], [32, 46], [54, 32], [82, 30], [104, 38], [118, 54], [124, 66], [142, 72, 1], [140, 80], [120, 84], [104, 94], [96, 108], [70, 116.5], [40, 112]]);
  s += part(head, D.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 80], [44, 130], [0, 130]]), D.shade) + fill(smooth([[60, 34], [100, 38], [118, 54], [90, 50]]), D.light) + line('M64 34q26-4 46 14', D.hi, 2.6) +
    fill('M60 82Q100 90 144 78V140H60Z', D.belly) + fill(smooth([[60, 106], [100, 110], [130, 100], [130, 130], [60, 130]]), '#d6e0ea'));
  s += line('M96 82Q118 86 140 78', INK, 2) + line('M96 82q-4-2-4-6', INK, 1.8);
  s += rim(head, poly([[0, 0], [70, 0], [40, 40], [24, 80], [0, 90]]), 2.2);
  // a big friendly eye-smile
  s += eye({ x0: 64, x1: 80, top: 54, bot: 66, slant: 0.18, nose: 1, px: 75, py: 61, pr: 4.4 });
  s += eye({ x0: 92, x1: 110, top: 52, bot: 65, slant: 0.18, nose: -1, px: 104, py: 59, pr: 4.8 });
  s += line('M62 48q8-4 18-1M92 46q9-5 20-1', INK, 2.4);
  s += fill(ellipse(90, 74, 5, 3.4), '#ffb3c0');
  // the trick: a gold coin spinning on the tip of its beak
  s += coin(136, 56, 10, { squash: 0.35, edge: 2, mark: 'none' }) + sparkle(144, 44, 3) + line('M126 40q10-6 20 0', '#ffffff', 1.4, 'opacity=".6"');
  s += line('M8 70q10-10 20 0M6 84q10-10 20 0', '#bfe8ff', 2, 'opacity=".6"');
  return end(s);
}

// ---- C: a treasure chest that bites ---------------------------------------------------------------
function mimic() {
  begin();
  const WD = { base: '#a8642e', light: '#c98a4a', shade: '#7a4418', deep: '#4e2a0e' };
  const IR = { base: '#4a4f5a', light: '#7a808c', shade: '#2e3238' };
  let s = '';
  // the open lid, swung up like a jaw
  const lidF = smooth([[40, 54, 1], [128, 48, 1], [128, 34], [118, 18], [84, 10], [50, 16], [40, 30]]), lidS = poly([[14, 46], [40, 54], [40, 22], [16, 16]]);
  // the mouth inside, the box below
  const maw = poly([[40, 54], [128, 48], [128, 70], [40, 74]]);
  const front = poly([[40, 70], [128, 66], [128, 117.5], [40, 117.5]]), side = poly([[14, 62], [40, 70], [40, 117.5], [14, 110]]);
  s += keyline([lidF, lidS, maw, front, side]);
  s += fill(maw, '#3a0e1e') + inside(maw, fill(ellipse(84, 70, 40, 12), '#ffc92e', 'opacity=".55"') + coin(64, 68, 6, { squash: 0.5, mark: 'none' }) + coin(100, 66, 6, { squash: 0.5, mark: 'none' }));
  for (const [d, c] of [[lidS, WD.shade], [side, WD.shade], [lidF, WD.base], [front, WD.base]]) s += fill(d, c);
  s += inside([lidF, front], fill(poly([[40, 0], [52, 0], [52, 130], [40, 130]]), WD.shade, 'opacity=".5"') + line('M44 84h80M44 98h80', WD.deep, 1.2) + line('M60 20q30-8 60 4', WD.light, 2.4));
  // iron bands and corner plates
  s += inside([lidF, lidS, front, side], fill(poly([[64, 0], [74, 0], [74, 130], [64, 130]]), IR.base) + fill(poly([[104, 0], [114, 0], [114, 130], [104, 130]]), IR.base) + fill(poly([[24, 0], [32, 0], [32, 130], [24, 130]]), IR.shade) +
    line('M66 0v130M106 0v130', IR.light, 1));
  for (const d of [lidF, lidS, front, side]) s += line(d, INK, 1.4);
  // teeth top and bottom, a tongue lolling out over the front
  for (let i = 0; i < 8; i++) { const x = 46 + i * 10.6, y = 53.6 - i * 0.7; s += part(poly([[x, y], [x + 7, y - 0.4], [x + 3.6, y + 8]]), '#fff6e0', 1.8); }
  for (let i = 0; i < 7; i++) { const x = 52 + i * 10.6, y = 71.6 - i * 0.6; s += part(poly([[x, y], [x + 7, y - 0.4], [x + 3.6, y - 7]]), '#fff6e0', 1.8); }
  const tongue = smooth([[70, 66], [94, 64], [100, 78], [96, 96], [86, 104], [78, 98], [74, 80]]);
  s += part(tongue, '#c8508a', 3.4) + inside(tongue, line('M86 70v26', '#8a2a5a', 1.4) + line('M76 76q4-4 8-2', '#e87ab0', 1.4)) + coin(88, 92, 5, { squash: 0.7, rot: 20 });
  // the lock for a nose, eyes on the lid
  s += part(smooth([[78, 76, 1], [90, 75, 1], [90, 86, 1], [78, 87, 1]], true, 0.3), G.base, 2.4);
  s += eye({ x0: 56, x1: 72, top: 28, bot: 40, slant: 0.5, nose: 1, px: 67, py: 35, pr: 4, white: '#fff6c0' });
  s += eye({ x0: 86, x1: 104, top: 25, bot: 38, slant: 0.5, nose: -1, px: 98, py: 32, pr: 4.4, white: '#fff6c0' });
  s += line('M54 22L74 26M84 22L106 16', INK, 2.8);
  s += rim([lidF, lidS, side], poly([[0, 0], [60, 0], [36, 20], [20, 60], [16, 110], [0, 110]]), 2);
  s += sparkle(136, 30, 4) + sparkle(8, 30, 3);
  return end(s);
}

export default {
  card: 24, champion: 'האקרובט', en: 'The Acrobat', theme: 'Card: a treasure cave, a genie\'s lamp, lightning · Power: trampoline bounces (Up-and-Down)',
  options: [
    { letter: 'A', name: 'Genie Lamp', draw: fitted(lamp, [1, 1.01, 0, -4]), marks: { eyes: [[58, 72], [89, 70.5]], nose: [82, 80] },
      blurb: 'The card\'s magic lamp come alive: a gold oil lamp with its spout for a nose, a ruby on its lid, a wily grin, the genie\'s violet smoke curling out of the spout, the card\'s lightning crackling. <i>Silhouette: a squat lamp, a long spout, a handle loop.</i>' },
    { letter: 'B', name: 'Flip', draw: dolphin,
      blurb: 'The born acrobat: a dolphin leaping up and down like the power\'s shot, its blowhole spouting a plume of water for hair, a gold coin from the treasure spinning on the tip of its beak. <i>Silhouette: a domed head, a long beak, a water plume.</i>' },
    { letter: 'C', name: 'Mimic', draw: mimic,
      blurb: 'The cave\'s treasure chest, which bites: iron-banded wood, its lid swung open like a jaw full of teeth, gold glowing inside, a tongue lolling out with a coin stuck to it, eyes on the lid. <i>Silhouette: an open chest, the lid up.</i>' },
  ],
};
