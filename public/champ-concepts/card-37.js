// Card #37 — אדון המראות (The Mirror Master). Card: Shoval smashing a sledgehammer through a
// wall into a secret purple gaming room ("we built a secret gaming room inside a huge army base").
// Power: the mirror returns everything reversed (Critical, reverse).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };

// ---- A: a magic mirror, cracked by the card's sledgehammer -------------------------------------------
function mirror() {
  begin();
  const GL = { base: '#cfe3f0', light: '#eef8ff', shade: '#9fb8cc' };
  let s = '';
  // the stand at the bottom, the scrolled crest on top
  s += part(smooth([[40, 104, 1], [108, 104, 1], [118, 117.5, 1], [30, 117.5, 1]], true, 0.4), G.shade, 5);
  s += part(smooth([[58, 14], [64, 2], [74, 8], [84, 2], [90, 14], [74, 18]]), G.base, 4.4) + fill(circle(74, 9, 3), '#e5262e');
  const frame = ellipse(75, 60, 54, 52), glass = ellipse(75, 60, 45, 43);
  s += part(frame, G.base) + inside(frame, fill(ellipse(81, 66, 54, 52), G.shade) + fill(ellipse(71, 56, 50, 48), G.base) + line('M40 30q14-20 40-20', G.light, 2.4));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s += fill(circle(75 + Math.cos(a) * 49.5, 60 + Math.sin(a) * 47.5, 2), G.deep); }
  s += fill(glass, GL.base) + inside(glass, fill(ellipse(67, 52, 36, 36), GL.light) + fill(smooth([[40, 80], [74, 100], [112, 76], [112, 110], [40, 110]]), GL.shade));
  // the face in the glass
  const face = eyeE({ x0: 52, x1: 68, top: 46, bot: 58, slant: 0.4, nose: 1, px: 63, py: 53, pr: 4 }) + eyeE({ x0: 78, x1: 96, top: 45, bot: 57, slant: 0.4, nose: -1, px: 90, py: 52, pr: 4.4 }) +
    browsE([50, 40, 70, 44], [78, 42, 100, 36], 2.6) + mouthE(75, 73, 28, line('M62 72Q74 78 88 70', INK, 2.4) + line('M88 70l3-2', INK, 1.8));
  s += inside(glass, face);
  // the crack: shards knocked out of line, radiating from the hammer's hit
  const shard = poly([[94, 34], [112, 40], [110, 70], [96, 56]]);
  s += inside(shard, fill(shard, GL.light) + `<g transform="translate(2 -2)">${face}</g>`);
  s += line('M98 40L82 50L70 46M82 50L86 64L78 80M86 64L104 70M82 50L94 34M86 64L70 70L56 66M70 70L66 86', '#ffffff', 1.4) + line('M98 40L82 50L86 64L104 70M82 50L94 34', '#5a7a90', 0.6);
  s += line(glass, G.deep, 1.2);
  s += rim(frame, poly([[0, 0], [70, 0], [40, 20], [24, 70], [0, 90]]), 2);
  // shards flying off
  for (const [x, y, r] of [[122, 30, 4], [132, 46, 3], [126, 14, 2.6]]) s += part(poly([[x - r, y], [x, y - r * 1.4], [x + r, y + r * 0.4]]), GL.light, 2);
  s += sparkle(16, 20, 4) + sparkle(130, 96, 3.4);
  return end(s);
}

// ---- B: a gaming controller, its thumbsticks for eyes ------------------------------------------------
function pad() {
  begin();
  const P = { base: '#5a3fc0', light: '#8a6af0', hi: '#c8b8ff', shade: '#3a2888', deep: '#24185a' };
  let s = '';
  // the cable
  s += line('M74 104Q76 116 70 124', INK, 7) + line('M74 104Q76 116 70 124', '#3a3d46', 3.6);
  const body = smooth([[14, 64], [22, 44], [44, 36], [104, 36], [126, 44], [134, 64], [140, 96], [136, 114], [122, 117.5], [108, 108], [98, 100], [50, 100], [40, 108], [26, 117.5], [12, 114], [8, 96]]);
  s += part(body, P.base);
  s += inside(body, fill(smooth([[0, 30], [30, 40], [26, 80], [34, 130], [0, 130]]), P.shade) + fill(smooth([[40, 38], [104, 38], [120, 48], [80, 46]]), P.light) + line('M44 40q30-4 60 0', P.hi, 2) +
    fill(smooth([[10, 100], [40, 106], [50, 120], [10, 120]]), P.deep) + fill(smooth([[138, 100], [108, 106], [98, 120], [138, 120]]), P.deep) +
    // RGB light strip
    line('M24 50Q74 40 124 50', '#5ff2ff', 2, 'opacity=".9"') + line('M24 54Q74 44 124 54', '#ff5ad8', 1.4, 'opacity=".8"'));
  s += rim(body, poly([[0, 0], [60, 0], [30, 40], [10, 90], [0, 100]]), 2, '#5ff2ff');
  // d-pad and buttons for ears
  s += part(poly([[20, 62], [26, 62], [26, 56], [32, 56], [32, 62], [38, 62], [38, 68], [32, 68], [32, 74], [26, 74], [26, 68], [20, 68]]), '#2a2440', 2.4);
  for (const [x, y, c] of [[118, 56, '#3fe06a'], [126, 64, '#e5262e'], [110, 64, '#2f8fe0'], [118, 72, '#ffd23a']]) s += part(circle(x, y, 3.6), c, 2) + fill(circle(x - 1, y - 1, 1), '#ffffff');
  // the thumbsticks are its eyes
  for (const [cx, cy, r, px] of [[54, 64, 12, 58], [94, 63, 12.6, 99]]) {
    s += part(circle(cx, cy, r + 2.6), '#2a2440', 3) + fill(circle(cx, cy, r), '#ffffff') + inside(circle(cx, cy, r), fill(circle(px, cy + 1.4, r * 0.48), '#0d0a0c') + fill(circle(px + r * 0.2, cy - r * 0.18, r * 0.16), '#ffffff') + fill(poly([[cx - r - 2, cy - r - 2], [cx + r + 2, cy - r - 2], [cx + r + 2, cy - r * 0.35 + (cx < 74 ? r * 0.3 : -r * 0.1)], [cx - r - 2, cy - r * 0.35 + (cx < 74 ? -r * 0.1 : r * 0.3)]]), P.base));
    s += line(circle(cx, cy, r), INK, 1.6);
  }
  // the touch pad for a grinning mouth
  const mouth = smooth([[58, 84, 1], [90, 84, 1], [88, 94], [74, 98], [60, 94]]);
  s += fill(mouth, '#1a1430') + inside(mouth, fill(poly([[56, 82], [92, 82], [92, 88], [56, 88]]), '#ffffff')) + line(mouth, INK, 1.8);
  s += sparkle(132, 24, 3.6, '#5ff2ff') + sparkle(14, 28, 3, '#ff5ad8');
  return end(s);
}

// ---- C: a disco ball, every tile a little mirror ------------------------------------------------------
function disco() {
  begin();
  const cx = 74, cy = 66, R = 50;
  let s = '';
  // light beams thrown off it
  for (const [a, c] of [[-2.4, '#ff5ad8'], [-0.7, '#5ff2ff'], [-1.6, '#fff36a']]) s += fill(poly([[cx, cy], [cx + Math.cos(a - 0.08) * 90, cy + Math.sin(a - 0.08) * 90], [cx + Math.cos(a + 0.08) * 90, cy + Math.sin(a + 0.08) * 90]]), c, 'opacity=".18"');
  s += line(`M${cx} 0V${cy - R}`, INK, 3.6) + line(`M${cx} 0V${cy - R}`, '#c9d2da', 1.6);
  const ball = circle(cx, cy, R);
  s += part(ball, '#a8b0bc');
  const tones = ['#e6ecf4', '#c9d2da', '#8a96a2', '#f4f8ff', '#b8c0cc', '#ff9ad8', '#9ff0ff', '#d0c4ff'];
  let tiles = '';
  for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) {
    const y = cy - R + r * 8.6, x = cx - R + c * 7.4 + (r % 2) * 3.7;
    tiles += fill(poly([[x, y], [x + 6.6, y], [x + 6.6, y + 7.8], [x, y + 7.8]]), tones[(r * 7 + c * 3) % 8]);
  }
  s += inside(ball, tiles + fill(circle(cx + 14, cy + 14, R), 'rgba(40,40,70,.35)') + fill(ellipse(cx - 18, cy - 22, 16, 10, -0.5), 'rgba(255,255,255,.5)'));
  s += line(ball, INK, 1.2);
  s += rim(ball, poly([[0, 0], [70, 0], [40, 30], [20, 80], [0, 90]]), 2, '#ffffff');
  // its face, mirrored in its own tiles
  s += eye({ x0: 52, x1: 68, top: 56, bot: 68, slant: 0.35, nose: 1, px: 63, py: 63, pr: 4 });
  s += eye({ x0: 80, x1: 98, top: 55, bot: 67, slant: 0.35, nose: -1, px: 92, py: 62, pr: 4.4 });
  s += line('M48 50L70 54M78 52L102 46', INK, 2.8);
  const mouth = smooth([[60, 80, 1], [76, 82], [94, 78, 1], [90, 90], [76, 94], [64, 90]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[58, 77], [96, 76], [96, 82], [58, 83]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(28, 30, 5) + sparkle(118, 44, 4.4) + sparkle(110, 96, 3.6) + sparkle(36, 96, 3);
  return end(s);
}

export default {
  card: 37, champion: 'אדון המראות', en: 'The Mirror Master', theme: 'Card: a sledgehammer through the wall into a secret gaming room · Power: the mirror returns everything reversed (Critical, reverse)',
  options: [
    { letter: 'A', name: 'Cracked Mirror', draw: mirror, marks: { eyes: [[60, 52], [87, 51]], nose: [75, 62] },
      blurb: 'A magic mirror in a gold baroque frame, the face in its glass, cracked by the card\'s sledgehammer so a shard of the face sits knocked out of line, splinters flying. <i>Silhouette: an oval frame on a stand, a crest on top.</i>' },
    { letter: 'B', name: 'Controller', draw: pad,
      blurb: 'The card\'s secret gaming room as a head: a purple controller with RGB light strips, its two thumbsticks for eyes, the d-pad and buttons for ears, the touch pad for a grin. <i>Silhouette: a wide body with two grips.</i>' },
    { letter: 'C', name: 'Disco Ball', draw: disco,
      blurb: 'A thousand little mirrors in one: a mirror ball hanging from its chain, every tile throwing the room\'s neon back, beams of light off it, its own face among the tiles. <i>Silhouette: a tiled ball on a chain.</i>' },
  ],
};
