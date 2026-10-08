// Card #39 — מלך הכדרור (The Dribble King). Card: Shoval behind a big desk in a dark suit,
// flags, papers flying ("living like the prime minister for 24 hours"). Power: glue — the ball
// sticks to the blocker and carries him into his own goal (Grab, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const H = { base: '#ffb627', light: '#ffd86a', shade: '#e08a12' };

// ---- A: the honey pot: the glue power's own icon ------------------------------------------------------
function honeyPot() {
  begin();
  const P = { base: '#3f7fd6', light: '#6fa8f0', hi: '#bfe0ff', shade: '#2a5aa8', deep: '#1a3e7a' };
  let s = '';
  // the dipper stuck in at an angle
  s += line('M96 28L130 2', INK, 6) + line('M96 28L130 2', '#c98a4a', 3) + part(ellipse(132, 4, 6, 4, -0.7), '#c98a4a', 3) + line('M128 2l8 4M130 0l8 4', '#8a5a32', 1);
  const pot = smooth([[24, 66], [30, 46], [44, 38], [104, 38], [118, 46], [124, 66], [124, 94], [114, 110], [90, 117.5], [58, 117.5], [34, 110], [24, 94]]);
  const rimD = smooth([[34, 26, 1], [114, 26, 1], [116, 40, 1], [32, 40, 1]], true, 0.4);
  s += part(pot, P.base);
  s += inside(pot, fill(smooth([[0, 30], [40, 40], [34, 90], [40, 130], [0, 130]]), P.shade) + fill(smooth([[60, 40], [104, 42], [118, 56], [88, 52]]), P.light) + line('M64 42q28-2 48 12', P.hi, 2.4) +
    fill(smooth([[20, 100], [74, 112], [130, 98], [130, 130], [20, 130]]), P.deep) + line('M24 92Q74 104 124 92', '#ffffff', 1.4, 'opacity=".5"'));
  s += part(rimD, P.light, 4.4);
  // honey overflowing the rim and dripping down
  const honey = smooth([[30, 24], [74, 20], [118, 24], [120, 34], [114, 52], [110, 56], [106, 40], [96, 44], [92, 64], [86, 66], [84, 44], [66, 44], [62, 54], [56, 56], [54, 42], [42, 44], [40, 60], [34, 62], [32, 40]]);
  s += part(honey, H.base, 4) + inside(honey, fill(smooth([[30, 20], [118, 20], [118, 28], [30, 28]]), H.light) + line('M40 26q30-6 70 0', '#fff6c8', 1.6));
  s += rim(pot, poly([[0, 0], [70, 0], [40, 40], [20, 90], [0, 100]]), 2);
  // a sticky-sweet grin
  s += eye({ x0: 50, x1: 66, top: 70, bot: 82, slant: 0.3, nose: 1, px: 61, py: 77, pr: 4 });
  s += eye({ x0: 80, x1: 98, top: 69, bot: 81, slant: 0.3, nose: -1, px: 92, py: 76, pr: 4.4 });
  s += line('M48 64q8-4 18 0M80 62q9-4 20 0', INK, 2.4);
  const mouth = smooth([[60, 92, 1], [76, 94], [92, 90, 1], [88, 100], [76, 104], [64, 100]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(76, 104, 8, 4), '#ff7a96')) + line(mouth, INK, 1.8) + line('M66 100v6', H.base, 2.4);
  // a bee on patrol
  s += part(ellipse(20, 28, 6, 4.4), '#ffd23a', 2.4) + line('M18 25v6M22 25v6', INK, 1.4) + fill(ellipse(18, 22, 4, 2.6, -0.4), 'rgba(220,240,255,.85)') + line('M28 30q6 2 10-2', INK, 1, 'stroke-dasharray="1.6 1.6"');
  return end(s);
}

// ---- B: an octopus, every sucker a dribble -------------------------------------------------------------
function octopus() {
  begin();
  const O = { base: '#ff7a62', light: '#ffa48e', hi: '#ffd6c8', shade: '#d8503e', deep: '#a8322a' };
  let s = '';
  // tentacles curling out along the bottom, one curled round a ball
  const tent = (pts, c) => line(smooth(pts, false), INK, 13) + line(smooth(pts, false), c, 8.4);
  s += tent([[44, 80], [20, 92], [8, 108], [16, 116], [24, 110]], O.shade) + tent([[56, 86], [44, 106], [40, 117]], O.shade);
  s += tent([[94, 86], [104, 106], [96, 117]], O.base) + tent([[104, 80], [128, 88], [138, 106], [130, 116], [122, 110]], O.base);
  // suckers
  for (const [x, y] of [[14, 104], [24, 96], [44, 110], [102, 104], [132, 98], [136, 108]]) s += fill(circle(x, y, 2.2), O.hi) + line(circle(x, y, 2.2), O.deep, 0.8);
  const ball = circle(28, 116, 6);
  s += part(ball, '#ffffff', 2.6) + inside(ball, fill(poly([[26, 112], [31, 112], [33, 116], [29, 119], [25, 116]]), INK));
  const head = smooth([[30, 70], [30, 40], [44, 16], [74, 6], [104, 16], [118, 40], [118, 70], [108, 90], [74, 96], [40, 90]]);
  s += part(head, O.base);
  s += inside(head, fill(smooth([[10, 20], [44, 26], [40, 70], [44, 100], [10, 100]]), O.shade) + fill(smooth([[60, 10], [96, 14], [112, 34], [84, 26]]), O.light) + line('M64 12q24-4 40 14', O.hi, 2.6) +
    [[50, 30], [60, 22], [46, 46], [96, 26], [104, 44]].map(([x, y]) => fill(circle(x, y, 2), O.deep)).join(''));
  s += rim(head, poly([[0, 0], [70, 0], [44, 20], [30, 70], [0, 90]]), 2);
  // a sly, sure-footed look, a small smile
  s += eye({ x0: 50, x1: 68, top: 52, bot: 66, slant: 0.4, nose: 1, px: 63, py: 60, pr: 4.6 });
  s += eye({ x0: 80, x1: 100, top: 51, bot: 66, slant: 0.4, nose: -1, px: 94, py: 59, pr: 5 });
  s += line('M46 46L70 52M78 50L104 44', INK, 3);
  s += line('M64 78Q76 84 90 76', INK, 2.4) + line('M90 76l3-2', INK, 1.8);
  s += sparkle(132, 30, 3.6) + sparkle(12, 30, 3);
  return end(s);
}

// ---- C: a lion, the king of the pitch ---------------------------------------------------------------------
function lion() {
  begin();
  const M = { base: '#c8742a', light: '#e8984a', shade: '#9a5418', deep: '#6a3410' };
  const F = { base: '#f2c27a', light: '#ffe0a8', shade: '#d8a05a' };
  let s = '';
  // the mane: a ring of flame-like locks
  const pts = [];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 46 : 58; pts.push([72 + Math.cos(a) * r, 62 + Math.sin(a) * r * 0.95, i % 2 ? 0 : 1]); }
  const mane = smooth(pts);
  s += part(mane, M.base) + inside(mane, fill(circle(80, 70, 58), M.shade) + fill(circle(66, 54, 50), M.base) + line(Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2; return `M${72 + Math.cos(a) * 34} ${62 + Math.sin(a) * 32}L${72 + Math.cos(a) * 52} ${62 + Math.sin(a) * 50}`; }).join(''), M.deep, 1.6) +
    line('M28 30q20-18 46-20', M.light, 3));
  // ears, then the face
  s += part(circle(48, 32, 8), F.shade, 4) + part(circle(100, 30, 8), F.base, 4);
  const face = smooth([[40, 66], [44, 44], [60, 32], [86, 30], [104, 40], [112, 58], [116, 78], [106, 96], [86, 104], [64, 104], [46, 94]]);
  s += part(face, F.base);
  s += inside(face, fill(smooth([[30, 40], [54, 46], [50, 80], [56, 110], [30, 110]]), F.shade) + fill(smooth([[64, 32], [96, 34], [106, 48], [84, 44]]), F.light) +
    fill(smooth([[70, 78], [92, 72], [118, 80], [112, 98], [86, 104], [70, 96]]), '#fff0d0'));
  s += rim([mane], poly([[0, 0], [70, 0], [36, 30], [14, 80], [0, 100]]), 2);
  // a regal glare, a broad nose, a proud set mouth
  s += eye({ x0: 54, x1: 70, top: 54, bot: 66, slant: 0.42, nose: 1, px: 65, py: 61, pr: 4.2, white: '#fff4c0' });
  s += eye({ x0: 82, x1: 100, top: 52, bot: 65, slant: 0.42, nose: -1, px: 94, py: 59, pr: 4.6, white: '#fff4c0' });
  s += line('M50 48L72 54M80 52L104 46', M.deep, 3.4);
  s += part(smooth([[82, 72, 1], [100, 70, 1], [94, 80], [88, 80]]), '#6a3a2a', 2.6);
  s += line('M91 80V88M80 92Q91 96 102 90', INK, 2.2);
  for (const [x, y] of [[80, 86], [84, 90], [100, 86], [104, 84]]) s += fill(circle(x, y, 0.9), '#6a3a2a');
  return end(s);
}

// ---- D (your request): a prime minister, like Shoval on the card -----------------------------------------------
function premier39() {
  begin();
  const S = { base: '#f0c09a', light: '#ffd8b8', shade: '#d4926c' };
  const HR = { base: '#2a2024', light: '#4a3a40', hi: '#8a7a82', shade: '#160e12' };
  const paper = (x, y, rot) => `<g transform="rotate(${rot} ${x} ${y})">` + part(poly([[x - 8, y - 10], [x + 8, y - 10], [x + 8, y + 10], [x - 8, y + 10]]), '#ffffff', 2.4) +
    line(`M${x - 5} ${y - 5}h10M${x - 5} ${y - 1}h10M${x - 5} ${y + 3}h7`, '#8a96a2', 1.2) + '</g>';
  let s = '';
  // the flag from the card's desk, behind him
  s += line('M8 117.5V6', INK, 3.6) + line('M8 117.5V6', '#c9a85a', 1.6) + part(circle(8, 4, 2.6), '#ffcc33', 1.8);
  const flag = poly([[9, 7], [36, 10], [36, 32], [9, 29]]);
  s += part(flag, '#ffffff', 3) + inside(flag, fill(poly([[9, 10], [36, 13], [36, 16], [9, 13]]), '#2a5ac8') + fill(poly([[9, 24], [36, 27], [36, 30], [9, 27]]), '#2a5ac8'));
  const star = (cx, cy, r, a0) => poly([0, 1, 2].map((i) => [cx + Math.cos(a0 + (i * 2 * Math.PI) / 3) * r, cy + Math.sin(a0 + (i * 2 * Math.PI) / 3) * r]));
  s += line(star(22.5, 20.5, 4, -Math.PI / 2), '#2a5ac8', 1.2) + line(star(22.5, 20.5, 4, Math.PI / 2), '#2a5ac8', 1.2);
  // the head, the ear, neatly combed dark hair with a side part
  const ear = smooth([[34, 70], [22, 66], [16, 78], [22, 92], [34, 94]]);
  const head = headShape();
  const hair = smooth([[24, 72], [20, 48], [28, 30], [48, 16], [78, 12], [104, 16], [120, 30], [124, 46], [116, 44], [104, 34], [84, 32], [64, 36], [48, 44], [36, 54], [30, 72]]);
  s += keyline([ear, head, hair]);
  s += fill(ear, S.base) + line('M27 74q-5 6 0 13', S.shade, 1.6) + fill(head, S.base);
  s += inside(head, fill(smooth([[0, 40], [40, 50], [44, 130], [0, 130]]), S.shade) + fill(smooth([[70, 42], [104, 42], [120, 56], [94, 52]]), S.light));
  s += fill(hair, HR.base) + inside(hair, fill(smooth([[0, 20], [36, 30], [34, 80], [0, 80]]), HR.shade) + line('M40 30Q48 22 60 18', HR.hi, 1.6) +
    line('M58 22Q86 14 112 26M50 32Q76 24 104 30', HR.light, 1.8) + line('M66 18Q88 14 106 22', HR.hi, 1.4));
  s += rim([ear, head, hair], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // steady eyes, a confident smile
  s += eyeE({ x0: 54, x1: 72, top: 60, bot: 73, slant: 0.35, nose: 1, px: 67, py: 67, pr: 4.2 });
  s += eyeE({ x0: 84, x1: 104, top: 58, bot: 72, slant: 0.35, nose: -1, px: 98, py: 65, pr: 4.6 });
  s += browsE([50, 54, 74, 56], [82, 54, 108, 49], 3.2);
  s += line('M108 80q5 4 1 9', S.shade, 1.8) + fill(ellipse(112, 94, 5, 3), '#ff8a8a', 'opacity=".35"');
  s += mouthE(94, 99, 26, line('M82 98Q94 105 106 96', INK, 2.4) + line('M106 96l2.4-2', INK, 1.6));
  // the podium microphone in front of him, papers flying
  s += line('M134 117.5Q138 98 124 90', INK, 5) + line('M134 117.5Q138 98 124 90', '#3a3d46', 2.4);
  s += part(ellipse(120, 88, 5, 7.4, 0.6), '#26262e', 2.6) + line('M117 84l6 6M115 88l5 5', '#5a5f68', 1);
  s += paper(128, 26, 18) + paper(134, 60, -14);
  return end(s);
}

export default {
  card: 39, champion: 'מלך הכדרור', en: 'The Dribble King', theme: 'Card: a day running the country, desk, flags · Power: glue, the ball sticks to you (Grab, push)',
  options: [
    { letter: 'A', name: 'Honey Pot', draw: honeyPot,
      blurb: 'The glue power\'s own icon 🍯: a blue glazed pot with honey overflowing the rim and dripping down like hair, a dipper stuck in it, a sticky-sweet grin, a bee on patrol. <i>Silhouette: a round pot under a dripping rim.</i>' },
    { letter: 'B', name: 'Octopus', draw: octopus,
      blurb: 'The best dribbler in the sea: a coral octopus with eight arms\' worth of sticky suckers, one curled round a ball, a sly sure-footed look. <i>Silhouette: a domed head over curling tentacles.</i>' },
    { letter: 'C', name: 'Lion King', draw: lion,
      blurb: 'The card\'s top job as an animal, the king who runs the place (no politics): a lion with a blazing ring of mane, a regal glare, a broad nose, a proud set mouth. <i>Silhouette: a face inside a spiked ring of mane.</i>' },
    { letter: 'D', name: 'Prime Minister', draw: fitted(premier39, [1, 0.99, 0, 0]), marks: { eyes: [[63, 66.5], [94, 65]], nose: [108, 84] }, request: true,
      blurb: 'Your request: a prime minister, like Shoval on the card (a made-up face, not any real politician). Neatly combed dark hair with a side part, steady eyes and a confident smile, the flag from the card\'s desk behind him, a podium microphone in front, papers flying. <i>Silhouette: a person\'s head, a flag and a microphone.</i>' },
  ],
};
