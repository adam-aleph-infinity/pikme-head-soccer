// Card #38 — המשגר (The Launcher). Card: Naveh lounging in the bucket of an excavator dumping
// sand, a palm tree behind ("we built a beach inside our house"). Power: teleport, the ball
// blinks to the goal mouth, the hardest shot to counter (Critical, stun).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const SAND = { base: '#f2d08a', shade: '#d8aa5a', light: '#fff0c4' };

// ---- A: the excavator's bucket, its teeth for a grin ---------------------------------------------------
function bucket() {
  begin();
  const Y = { base: '#ffc22e', shade: '#d48a0c', light: '#ffe48a', deep: '#9a5a06' };
  let s = '';
  // the arm and its piston, up behind
  const arm = poly([[54, 34], [20, 2], [36, 0], [72, 30]]);
  s += part(arm, Y.shade) + line('M76 32L56 4', INK, 6) + line('M76 32L56 4', '#c9d2da', 3) + part(circle(62, 32, 5), '#3a3d46', 3);
  // sand pouring out of the teeth
  const pour = smooth([[60, 106], [128, 102], [136, 117.5, 1], [52, 117.5, 1]]);
  s += part(pour, SAND.base, 4) + inside(pour, fill(poly([[50, 112], [140, 110], [140, 120], [50, 120]]), SAND.shade));
  const bk = smooth([[30, 38], [60, 28], [96, 32], [126, 44], [138, 64], [136, 84], [128, 100, 1], [40, 104, 1], [26, 86], [22, 60]]);
  s += part(bk, Y.base);
  s += inside(bk, fill(smooth([[0, 30], [40, 40], [34, 80], [40, 130], [0, 130]]), Y.shade) + fill(smooth([[60, 30], [100, 36], [122, 50], [90, 46]]), Y.light) + line('M64 32q30-2 52 14', '#fff6c8', 2.4) +
    line('M30 48L132 60M28 76L136 84', Y.deep, 2) + fill(smooth([[20, 92], [80, 96], [140, 90], [140, 120], [20, 120]]), Y.deep));
  s += rim(bk, poly([[0, 0], [70, 0], [40, 36], [20, 80], [0, 90]]), 2.2);
  // the steel teeth along its lip: its grin
  for (let i = 0; i < 6; i++) { const x = 44 + i * 15; s += part(poly([[x, 100], [x + 11, 99], [x + 6, 112]]), '#5a5f68', 3) + line(`M${x + 2} 101l3 6`, '#a8b0bc', 1); }
  // a palm frond stuck in the sand, and the eyes on its side plate
  s += line('M132 104Q136 88 128 76', INK, 3.6) + line('M132 104Q136 88 128 76', '#8a5a32', 1.6) + part(smooth([[128, 76], [114, 70], [104, 76, 1], [118, 74], [124, 80]]), '#4fae3a', 2.4) + part(smooth([[128, 76], [138, 66], [144, 70, 1], [136, 72], [130, 80]]), '#4fae3a', 2.4);
  s += eye({ x0: 52, x1: 70, top: 60, bot: 74, slant: 0.4, nose: 1, px: 65, py: 68, pr: 4.6 });
  s += eye({ x0: 82, x1: 102, top: 60, bot: 75, slant: 0.4, nose: -1, px: 96, py: 68, pr: 5 });
  s += line('M48 54L72 60M80 58L106 52', INK, 3);
  s += sparkle(132, 26, 3.6) + sparkle(12, 60, 3);
  return end(s);
}

// ---- B: a coconut, sprouting, launched off its palm ----------------------------------------------------
function coconut() {
  begin();
  const H = { base: '#8a5a32', light: '#a87444', shade: '#6a4222', fiber: '#c49a6a' };
  let s = line('M60 117v-6M74 117v-8M88 117v-6', '#ffffff', 2, 'opacity=".55"');
  // palm leaves sprouting from its top
  for (const [a, L] of [[-2.6, 40], [-2.1, 44], [-1.6, 40], [-1.1, 44], [-0.6, 38]]) {
    const bx = 74, by = 26, tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L * 0.62;
    const d = smooth([[bx, by], [(bx + tx) / 2 + Math.sin(a) * 6, (by + ty) / 2 - 6], [tx, ty, 1], [(bx + tx) / 2 - Math.sin(a) * 4, (by + ty) / 2 + 2]]);
    s += part(d, a < -1.6 ? '#3e8a30' : '#5bb84a', 3.4) + line(`M${bx} ${by}L${tx} ${ty}`, '#2e6a22', 1);
  }
  const nut = smooth([[16, 72], [22, 44], [46, 26], [80, 22], [112, 30], [130, 52], [134, 80], [124, 102], [98, 116], [62, 117.5], [32, 110], [18, 94]]);
  s += part(nut, H.base);
  let fib = '';
  for (let i = 0; i < 24; i++) { const x = 26 + ((i * 41) % 100), y = 36 + ((i * 29) % 72); fib += `M${x} ${y}l${4 + (i % 3)} ${2 - (i % 4)}`; }
  s += inside(nut, fill(smooth([[0, 30], [40, 40], [34, 80], [40, 130], [0, 130]]), H.shade) + line(fib, H.fiber, 1.2) + fill(smooth([[56, 32], [96, 34], [114, 48], [84, 44]]), H.light));
  s += rim(nut, poly([[0, 0], [70, 0], [40, 36], [20, 80], [0, 90]]), 2);
  // a coconut's three eyes, made into a face
  for (const [x0, x1, top, bot, nose, px, py] of [[54, 72, 56, 70, 1, 66, 64], [84, 104, 54, 69, -1, 98, 62]]) {
    s += part(ellipse((x0 + x1) / 2, (top + bot) / 2, (x1 - x0) / 2 + 3, (bot - top) / 2 + 3), '#4a2e14', 2) + eyeE({ x0, x1, top, bot, slant: 0.3, nose, px, py, pr: 4.4 });
  }
  const mouth = ellipse(80, 90, 9, 7);
  s += mouthE(80, 90, 24, part(mouth, '#4a2e14', 2.4) + fill(ellipse(80, 91, 6, 4.4), '#fbf7f0'));
  s += part(smooth([[112, 40, 1], [116, 48], [113, 52], [108, 48]]), '#8fd6ff', 2);
  s += sparkle(132, 28, 3.6) + sparkle(12, 36, 3);
  return end(s);
}

// ---- C: a pop-up toaster launching its toast -------------------------------------------------------------
function toaster() {
  begin();
  const R = { base: '#e5452c', light: '#ff7a5a', shade: '#a82a18' };
  const CH = { base: '#c9d2da', light: '#f1f5f8', shade: '#8a96a2' };
  const T = { base: '#e8b46a', crust: '#a8642e', shade: '#c8904a' };
  let s = '';
  // the toast, launched: one mid-air, one blinking (teleporting)
  const toast = (x, y, rot, ghost) => {
    const d = smooth([[x - 14, y + 16, 1], [x - 15, y - 6], [x - 10, y - 14], [x, y - 12], [x + 4, y - 16], [x + 12, y - 12], [x + 15, y - 4], [x + 14, y + 16, 1]]);
    return `<g transform="rotate(${rot} ${x} ${y})"${ghost ? ' opacity=".45"' : ''}>` + part(d, T.crust, 4) + fill(smooth([[x - 10, y + 13, 1], [x - 11, y - 4], [x - 7, y - 10], [x, y - 8], [x + 4, y - 12], [x + 10, y - 9], [x + 11, y - 2], [x + 10, y + 13, 1]]), T.base) + line(`M${x - 6} ${y}l12 4`, T.shade, 1.2) + '</g>';
  };
  s += toast(56, 22, -14) + toast(96, 16, 18, true) + line('M50 40v6M62 40v6M90 36v6M102 36v6', '#ffffff', 1.6, 'opacity=".6"');
  const body = smooth([[22, 50], [30, 40], [118, 40], [126, 50], [128, 108], [120, 117.5, 1], [28, 117.5, 1], [20, 108]]);
  s += part(body, R.base);
  s += inside(body, fill(smooth([[0, 30], [40, 40], [36, 120], [0, 120]]), R.shade) + fill(poly([[100, 40], [112, 40], [112, 120], [100, 120]]), R.light, 'opacity=".55"') +
    fill(poly([[0, 40], [144, 40], [144, 50], [0, 50]]), CH.base) + fill(poly([[0, 106], [144, 106], [144, 120], [0, 120]]), CH.base) + line('M24 44h100', CH.light, 1.4));
  s += fill(smooth([[40, 42, 1], [70, 42, 1], [70, 47, 1], [40, 47, 1]], true, 0.5), '#1a1a20') + fill(smooth([[80, 42, 1], [110, 42, 1], [110, 47, 1], [80, 47, 1]], true, 0.5), '#1a1a20');
  s += rim(body, poly([[0, 0], [70, 0], [36, 40], [24, 120], [0, 120]]), 2);
  // the lever and the dial for ears
  s += part(smooth([[126, 64, 1], [140, 62, 1], [140, 70, 1], [126, 72, 1]], true, 0.4), '#1a1a20', 3) + part(circle(18, 84, 5), CH.base, 3) + line('M18 84l2-3', INK, 1.4);
  // a face in the chrome, ready to fire
  s += eye({ x0: 46, x1: 64, top: 62, bot: 76, slant: 0.4, nose: 1, px: 59, py: 70, pr: 4.6 });
  s += eye({ x0: 80, x1: 100, top: 61, bot: 76, slant: 0.4, nose: -1, px: 94, py: 69, pr: 5 });
  s += line('M42 56L66 62M78 60L104 54', INK, 3);
  const mouth = smooth([[58, 88, 1], [76, 90], [94, 86, 1], [90, 98], [76, 102], [62, 98]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[56, 85], [96, 84], [96, 90], [56, 91]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(130, 24, 3.6) + sparkle(14, 30, 3);
  return end(s);
}

export default {
  card: 38, champion: 'המשגר', en: 'The Launcher', theme: 'Card: an excavator dumping sand, a beach built indoors · Power: teleport, the ball blinks to the goal (Critical)',
  options: [
    { letter: 'A', name: 'Digger', draw: bucket,
      blurb: 'The bucket the card\'s Naveh sits in: a yellow excavator scoop with its arm and piston rising behind, a row of steel teeth for a grin, the card\'s sand pouring out of them, a palm frond stuck in. <i>Silhouette: a scoop on an arm.</i>' },
    { letter: 'B', name: 'Coconut', draw: coconut, marks: { eyes: [[63, 63], [94, 61.5]], nose: [82, 78] },
      blurb: 'The card\'s beach, from the palm down: a hairy coconut, its own three dark eyes made into a face, palm leaves sprouting out of its top, launched off its tree. <i>Silhouette: a round husk under a fan of leaves.</i>' },
    { letter: 'C', name: 'Pop-Up', draw: toaster,
      blurb: 'A launcher you already own: a red enamel toaster firing its toast, one slice mid-air, the other half-gone in a blink (teleported), the lever and dial for ears. <i>Silhouette: a box with two slices flying off it.</i>' },
  ],
};
