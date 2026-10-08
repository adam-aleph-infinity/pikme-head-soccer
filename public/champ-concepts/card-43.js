// Card #43 — המפצל (The Splitter). Card: Naveh breathing fire after a bite of a Carolina Reaper,
// fireballs flying ("24 hours eating what we're served in the eighth-wonder city"). Power: a split
// shot that is three balls at once (Multi-Ball, stun).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the Carolina Reaper, in a reaper's hood ------------------------------------------------------
function reaper() {
  begin();
  const P = { base: '#d8241a', light: '#ff5a3a', hi: '#ffb4a2', shade: '#9a1410', wrinkle: '#7a0e0a' };
  const HD = { base: '#2a2430', light: '#4a4258', shade: '#16121c' };
  let s = '';
  // the scythe behind
  s += line('M18 117L60 10', INK, 5.4) + line('M18 117L60 10', '#8a5a32', 2.8);
  s += part(smooth([[56, 12], [80, 2], [110, 6], [126, 18, 1], [104, 12], [80, 12], [62, 20]]), '#c9d2da', 3.4);
  // the hood, framing it from behind
  const hood = smooth([[16, 117.5, 1], [12, 80], [18, 46], [38, 22], [68, 12], [98, 16], [118, 30], [110, 38], [92, 30], [68, 30], [48, 44], [40, 70], [44, 117.5, 1]]);
  s += part(hood, HD.base) + inside(hood, fill(smooth([[0, 40], [30, 40], [26, 120], [0, 120]]), HD.shade) + line('M30 40Q44 24 72 20', HD.light, 2.4) + line('M26 80q4 20 0 36', HD.light, 1.4));
  // the wrinkled pepper, its stinger tail curling at the front
  const pts = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, r = 40 + (i % 2 ? 0 : 3.4); pts.push([80 + Math.cos(a) * r * 1.04, 72 + Math.sin(a) * r]); }
  const pepper = smooth(pts);
  const tail = smooth([[110, 100], [126, 108], [138, 102], [140, 92, 1], [132, 100], [118, 96]]);
  s += part(tail, P.base, 4.4) + part(pepper, P.base);
  s += inside(pepper, fill(circle(90, 82, 42), P.shade) + fill(circle(76, 66, 36), P.base) + fill(ellipse(66, 48, 12, 7, -0.5), P.hi) +
    line('M52 60q8 6 4 16M60 88q10-2 14 6M100 50q-2 10 6 14M104 92q-8 4-6 12M80 40q4 8 0 14', P.wrinkle, 1.8));
  // the green cap
  s += part(smooth([[66, 34], [76, 26], [92, 26], [100, 34], [84, 38]]), '#4fae3a', 3.4) + line('M84 28Q84 18 92 14', INK, 3.4) + line('M84 28Q84 18 92 14', '#3e8a30', 1.6);
  s += rim([hood], poly([[0, 0], [70, 0], [36, 30], [14, 80], [0, 120]]), 2, '#a894c8');
  // furious, steaming, a fiery grin
  s += eyeE({ x0: 60, x1: 76, top: 62, bot: 74, slant: 0.55, nose: 1, px: 71, py: 69, pr: 4, white: '#fff4c0' });
  s += eyeE({ x0: 88, x1: 106, top: 60, bot: 73, slant: 0.55, nose: -1, px: 100, py: 67, pr: 4.4, white: '#fff4c0' });
  s += browsE([56, 56, 78, 62], [86, 60, 110, 52], 3.2);
  const mouth = smooth([[66, 86, 1], [86, 88], [106, 84, 1], [102, 96], [86, 100], [70, 96]]);
  s += mouthE(86, 91, 40, fill(mouth, '#3a0a0a') + inside(mouth, fill(poly([[64, 83], [108, 82], [108, 88], [64, 89]]), '#fff') + fill(ellipse(86, 100, 12, 5), '#ff9a3a')) + line(mouth, INK, 2));
  for (const [x, y, r] of [[118, 44, 4], [126, 34, 3], [132, 24, 2.4]]) s += part(circle(x, y, r), '#e8e2dc', 2.2);
  for (const [x, y] of [[136, 70], [10, 30]]) s += part(circle(x, y, 4.4), '#ff9a3a', 2.4) + fill(circle(x - 1, y - 1, 2), '#fff2a8');
  return end(s);
}

// ---- B: a pea pod split open: three peas, three balls ---------------------------------------------------
function peapod() {
  begin();
  const PD = { base: '#5fb83a', light: '#8fdc5a', shade: '#3e8a26', inner: '#c4f07a' };
  const PE = { base: '#7ed957', light: '#b8f08a', shade: '#4fa830' };
  let s = '';
  // the pod's open top flap behind, and the curly tendril
  const flap = smooth([[10, 70], [30, 40], [74, 28], [118, 40], [136, 66], [118, 56], [74, 46], [30, 56]]);
  s += part(flap, PD.shade) + inside(flap, fill(smooth([[20, 64], [74, 40], [128, 62], [74, 54]]), PD.inner, 'opacity=".6"'));
  s += line('M128 50Q140 40 134 30Q128 24 134 18', INK, 3.4) + line('M128 50Q140 40 134 30Q128 24 134 18', PD.base, 1.6);
  // three peas in a row: the middle one is the face
  for (const [x, y, r] of [[30, 78, 17], [118, 78, 17]]) {
    const d = circle(x, y, r);
    s += part(d, PE.base, 4.4) + inside(d, fill(circle(x + 4, y + 4, r), PE.shade) + fill(ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.2, -0.6), PE.light));
    s += eye({ x0: x - 8, x1: x - 1, top: y - 4, bot: y + 2, slant: 0.3, nose: 1, px: x - 3, py: y - 1, pr: 1.8, r: 1.2, outline: 0.8, lidW: 1.4 }) +
      eye({ x0: x + 2, x1: x + 9, top: y - 5, bot: y + 1, slant: 0.3, nose: -1, px: x + 7, py: y - 2, pr: 2, r: 1.2, outline: 0.8, lidW: 1.4 }) + line(`M${x - 4} ${y + 7}q4 3 8 0`, INK, 1.4);
  }
  const mid = circle(74, 70, 28);
  s += part(mid, PE.base) + inside(mid, fill(circle(80, 76, 28), PE.shade) + fill(circle(72, 68, 24), PE.base) + fill(ellipse(62, 54, 8, 5, -0.6), PE.light));
  // the pod cradling them
  const pod = smooth([[2, 66, 1], [16, 90], [40, 106], [74, 112], [108, 106], [132, 90], [144, 66, 1], [136, 100], [112, 116], [74, 117.5], [36, 116], [12, 100]]);
  s += part(pod, PD.base) + inside(pod, fill(smooth([[0, 100], [74, 118], [144, 100], [144, 130], [0, 130]]), PD.shade) + line('M14 86Q74 120 134 86', PD.light, 2));
  s += rim([mid, flap], poly([[0, 0], [60, 0], [40, 40], [20, 70], [0, 80]]), 2);
  s += eye({ x0: 60, x1: 72, top: 62, bot: 72, slant: 0.4, nose: 1, px: 68, py: 68, pr: 3.4, r: 2 });
  s += eye({ x0: 78, x1: 92, top: 61, bot: 71, slant: 0.4, nose: -1, px: 88, py: 67, pr: 3.6, r: 2 });
  s += line('M56 56L74 60M76 58L96 52', INK, 2.6);
  s += line('M64 82Q74 88 86 80', INK, 2.2);
  s += sparkle(130, 16, 3.6) + sparkle(12, 30, 3);
  return end(s);
}

// ---- C: three sticks of dynamite, fuse lit: about to split three ways ------------------------------------
function dynamite() {
  begin();
  const R = { base: '#d8283a', light: '#ff5a6a', hi: '#ffb4bc', shade: '#9a1424' };
  let s = '';
  const stick = (x0, x1, top) => smooth([[x0, top + 4, 1], [x1, top + 4, 1], [x1, 117.5, 1], [x0, 117.5, 1]], true, 0.25);
  // fuses with sparks
  for (const [x, y] of [[36, 32], [112, 30]]) s += line(`M${x} ${y}q-4-10 4-16`, INK, 3.4) + line(`M${x} ${y}q-4-10 4-16`, '#c9a85a', 1.6);
  s += line('M74 24q6-12-2-20', INK, 3.6) + line('M74 24q6-12-2-20', '#c9a85a', 1.8);
  s += part(poly([[72, 6], [76, 0], [78, 6], [86, 4], [80, 9], [84, 14], [76, 11], [70, 16], [72, 9], [64, 6]]), '#ffe14a', 2) + fill(circle(75, 8, 2.4), '#ffffff');
  for (const [x, y] of [[62, 0], [88, 2], [66, 16], [90, 14]]) s += fill(circle(x, y, 1.4), '#ffb627');
  const sL = stick(18, 54, 28), sR = stick(94, 130, 26), sM = stick(48, 100, 20);
  for (const [d, x0, x1] of [[sL, 18, 54], [sR, 94, 130]]) s += part(d, R.shade) + inside(d, fill(poly([[x0, 0], [x0 + 8, 0], [x0 + 8, 130], [x0, 130]]), '#7a0a18') + line(`M${x1 - 8} 40V110`, R.light, 2));
  s += part(sM, R.base) + inside(sM, fill(poly([[48, 0], [60, 0], [60, 130], [48, 130]]), R.shade) + line('M90 34V110', R.hi, 2.4));
  // the tape binding them
  for (const y of [56, 98]) s += part(smooth([[16, y, 1], [132, y, 1], [132, y + 8, 1], [16, y + 8, 1]], true, 0.3), '#3a3d46', 3) + line(`M20 ${y + 2}h108`, '#6a6e78', 1);
  s += rim([sL, sM], poly([[0, 0], [60, 0], [30, 30], [20, 120], [0, 120]]), 2);
  // a gleeful, manic face on the middle stick
  s += eye({ x0: 54, x1: 70, top: 34, bot: 46, slant: 0.3, nose: 1, px: 65, py: 41, pr: 4 });
  s += eye({ x0: 76, x1: 94, top: 33, bot: 46, slant: 0.3, nose: -1, px: 88, py: 40, pr: 4.4 });
  s += line('M52 28L72 32M76 30L96 24', INK, 2.6);
  const mouth = smooth([[58, 70, 1], [74, 72], [92, 68, 1], [88, 80], [74, 84], [62, 80]]);
  s += fill(mouth, '#3a0a14') + inside(mouth, fill(poly([[56, 67], [94, 66], [94, 72], [56, 73]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(130, 12, 3.6, '#ffe14a') + sparkle(10, 18, 3, '#ffe14a');
  return end(s);
}

export default {
  card: 43, champion: 'המפצל', en: 'The Splitter', theme: 'Card: a bite of the Carolina Reaper, fire breath · Power: the shot splits into three balls (Multi-Ball, stun)',
  options: [
    { letter: 'A', name: 'The Reaper', draw: reaper, marks: { eyes: [[68, 68], [97, 66.5]], nose: [90, 78] },
      blurb: 'The card\'s Carolina Reaper as its namesake: a wrinkled red pepper with its little stinger tail, peering furiously out of a reaper\'s black hood, scythe behind, steaming. <i>Silhouette: a lumpy pepper in a hood, a scythe over it.</i>' },
    { letter: 'B', name: 'Pea Pod', draw: peapod,
      blurb: 'The split shot is three balls; this is three peas: a pod split open, two little peas either side of the middle one, all three pulling the same face. <i>Silhouette: three balls in a curved pod.</i>' },
    { letter: 'C', name: 'Dynamite', draw: dynamite,
      blurb: 'Three sticks taped together, the middle one\'s fuse fizzing, grinning like a maniac: about to split three ways, like the shot. <i>Silhouette: three upright sticks and a spark.</i>' },
  ],
};
