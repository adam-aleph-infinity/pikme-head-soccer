// Card #12 — האסטרונאוט (The Astronaut). Card: a bearded guy in glasses standing on the globe,
// a toy airliner in his hand ("wherever the finger stops, you fly there" — Japan). Power: moon
// gravity, the shot floats up out of sight and dives in (Aerial).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const f1 = (n) => +n.toFixed(1);

// A crescent: circle 1 with circle 2 bitten out of it (they must cross).
function crescent(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
  const bx = x1 + (a * dx) / d, by = y1 + (a * dy) / d, px = -dy / d, py = dx / d;
  const top = [bx + h * px, by + h * py], bot = [bx - h * px, by - h * py];
  const [t, b] = top[1] < bot[1] ? [top, bot] : [bot, top];
  return { d: `M${f1(t[0])} ${f1(t[1])}A${r1} ${r1} 0 1 0 ${f1(b[0])} ${f1(b[1])}A${r2} ${r2} 0 0 1 ${f1(t[0])} ${f1(t[1])}Z`, top: t, bot: b };
}
// A little airliner seen from the side, nose toward +x, centred on (x, y).
function plane(x, y, k = 1, rot = 0) {
  const P = (pts) => poly(pts.map(([a, b]) => [x + a * k, y + b * k]));
  const body = smooth([[-9, -1.6], [6, -2.2], [10, 0, 1], [6, 2.2], [-9, 1.8], [-11, 0]].map(([a, b, c]) => [x + a * k, y + b * k, c]));
  return `<g transform="rotate(${rot} ${x} ${y})">` + part(P([[-8, -1], [-12, -6], [-9, -6], [-4, -1]]), '#e5352c', 2.4) + part(body, '#ffffff', 2.4) + part(P([[-2, 0], [-6, 6], [-3, 6], [3, 0]]), '#c9d3df', 2.4) + fill(P([[4, -1.6], [7, -1.2], [7, 0], [4, 0]]), '#2f6fe0') + '</g>';
}

// ---- A: the man in the moon ----------------------------------------------------------------
function moon() {
  begin();
  const M = { base: '#fbe9a6', light: '#fff7d6', shade: '#e2c06a', deep: '#b8913c' };
  const c = crescent(70, 62, 55, 112, 46, 41);
  let s = '';
  // a flag planted in the back of it
  s += line('M26 44L8 18', INK, 4) + line('M26 44L8 18', '#d8d0c0', 1.8) + part(poly([[8, 18], [26, 10], [16, 28]]), '#ffffff', 2.4) + fill(circle(16.5, 19, 2.6), '#2f6fe0');
  // the nose sits on the inner curve, part of the silhouette
  const nose = smooth([[70, 52], [84, 60], [90, 70, 1], [80, 72], [72, 70]]);
  const lip = smooth([[84, 86], [94, 86], [98, 92], [90, 96], [82, 94]]);
  s += keyline([c.d, nose, lip]);
  s += fill(c.d, M.base) + fill(nose, M.base) + fill(lip, M.base);
  const all = [c.d, nose, lip];
  s += inside(all, fill(smooth([[0, 0], [40, 20], [30, 60], [44, 110], [0, 130]]), M.shade) + fill(smooth([[50, 6], [96, 8], [80, 30], [60, 22]]), M.light) +
    fill(smooth([[30, 100], [70, 106], [120, 96], [120, 130], [30, 130]]), M.shade) + line('M74 56q10 4 12 12', M.light, 2));
  // craters on the dark side
  for (const [x, y, r] of [[34, 40, 7], [24, 72, 5], [42, 96, 6.5], [52, 22, 4], [60, 106, 3.4]]) s += fill(circle(x, y, r), M.deep) + inside(circle(x, y, r), fill(circle(x + r * 0.35, y + r * 0.35, r), M.shade)) + line(circle(x, y, r), INK, 0.9);
  s += rim(all, poly([[0, 0], [70, 0], [30, 30], [16, 100], [0, 110]]), 2.4);
  // one profile eye behind round glasses (the card's), half-lidded and pleased with itself
  s += eye({ x0: 50, x1: 68, top: 38, bot: 52, slant: 0.38, nose: 1, px: 63, py: 47, pr: 4.6, lidW: 2.4 });
  s += line(circle(59, 45, 11), INK, 4.4) + line(circle(59, 45, 11), '#8a5a2a', 2) + line('M70 43q4-2 6-1', INK, 2.4) + line('M48 41q-6 -2 -10 2', INK, 2);
  s += line('M47 33L68 36', INK, 3.2);
  s += line('M76 82q6 4 12 2', INK, 2) + line('M80 96q2 4 0 8', M.deep, 1.6);
  s += fill(ellipse(62, 74, 7, 4.4), '#ffb3a0');
  // its plane, orbiting the gap in front of its face
  s += line('M100 106Q140 90 132 56', '#ffffff', 1.4, 'stroke-dasharray="2 3" opacity=".8"') + plane(126, 48, 1.1, -70);
  s += sparkle(118, 22, 4.5) + sparkle(138, 96, 3.5) + sparkle(98, 6, 3) + sparkle(8, 106, 3);
  return end(s);
}

// ---- B: the card's airliner with a face -----------------------------------------------------
function jumbo() {
  begin();
  const W = { base: '#f6f8fb', shade: '#c9d3df', deep: '#9aa8b8', light: '#ffffff' };
  const BL = '#2f6fe0', RD = '#e5352c';
  let s = '';
  const fin = smooth([[22, 50], [14, 22], [8, 3, 1], [26, 5], [46, 40]]);
  const wingB = poly([[30, 84], [2, 104], [8, 110], [48, 94]]);
  s += part(wingB, W.shade, 5) + part(fin, W.base);
  s += inside(fin, fill(poly([[0, 0], [40, 0], [40, 18], [0, 30]]), BL) + fill(poly([[0, 22], [40, 12], [40, 18], [0, 30]]), RD));
  const body = smooth([[14, 74], [18, 54], [36, 41], [70, 35], [100, 37], [122, 46], [134, 60], [139, 74, 1], [132, 90], [112, 104], [78, 112.5], [42, 110], [20, 98]]);
  s += part(body, W.base);
  s += inside(body, fill(smooth([[0, 30], [36, 44], [30, 80], [40, 130], [0, 130]]), W.shade) +
    fill('M0 78Q70 84 144 70V82Q70 96 0 90Z', BL) + fill('M0 92Q70 98 144 84V87Q70 101 0 95Z', RD) +
    fill(smooth([[20, 100], [80, 104], [140, 86], [140, 130], [20, 130]]), W.shade) +
    fill(smooth([[70, 38], [112, 42], [128, 54], [100, 50]]), W.light) + line('M74 40q34 0 52 14', W.light, 2.4) +
    fill(smooth([[128, 56], [144, 60], [144, 92], [130, 86]]), '#3a3f48') + line('M131 62q6 2 8 8', '#7d8292', 1.6));
  s += rim(body, poly([[0, 0], [80, 0], [40, 40], [16, 60], [12, 110], [0, 110]]), 2.2);
  // passenger windows down the side
  for (let i = 0; i < 6; i++) s += fill(smooth([[26 + i * 8, 62 - i * 0.8, 1], [30 + i * 8, 62 - i * 0.8, 1], [30 + i * 8, 67 - i * 0.8, 1], [26 + i * 8, 67 - i * 0.8, 1]], true, 0.4), '#3a4a66');
  // the cockpit windows are its eyes
  s += eye({ x0: 80, x1: 102, top: 48, bot: 62, slant: 0.3, nose: 1, px: 96, py: 57, pr: 5, white: '#e8f6ff', lidW: 3.4, lid: '#2a3140' });
  s += eye({ x0: 106, x1: 126, top: 50, bot: 64, slant: 0.3, nose: -1, px: 120, py: 58, pr: 5, white: '#e8f6ff', lidW: 3.4, lid: '#2a3140' });
  s += line('M104 50v14', '#2a3140', 2.4);
  // an eager grin under the nose
  const mouth = smooth([[100, 96, 1], [116, 94], [130, 88, 1], [124, 100], [112, 104]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[96, 90], [134, 84], [134, 94], [96, 98]]), '#fff')) + line(mouth, INK, 1.8);
  // the near wing and its engine
  const wingF = poly([[78, 100], [126, 120], [138, 116], [100, 96]]);
  s += part(wingF, W.base, 5) + inside(wingF, fill(poly([[70, 108], [140, 118], [140, 130], [70, 130]]), W.shade));
  s += part(ellipse(104, 116, 9, 6), W.shade, 4) + fill(ellipse(106, 116, 5, 4), '#2a3140') + fill(circle(107, 116, 1.6), W.base);
  s += line('M8 60h-6M10 70h-8M12 80h-7', '#ffffff', 1.6, 'opacity=".6"');
  s += sparkle(132, 18, 4) + sparkle(60, 12, 3);
  return end(s);
}

// ---- C: the card's globe, the finger's pin stuck in Japan ---------------------------------
function globe() {
  begin();
  const O = { base: '#2f8fe0', shade: '#1d5fa8', light: '#63b6ff', deep: '#164a86' };
  const L = { base: '#5bb84a', shade: '#3e8a30', light: '#8fdc6a' };
  const BR = { base: '#e0b04a', shade: '#a8782a', light: '#ffe08a' };
  const cx = 78, cy = 62, r = 46;
  let s = '';
  // the orbit's back half, a little moon on it
  const ox = 64.04, oy = 15.97, orb = (sweepFront) => `M${cx - ox} ${cy + oy}A66 16 -14 0 1 ${cx + ox} ${cy - oy}`;
  s += line(orb(), '#ffffff', 1.4, 'stroke-dasharray="3 3" opacity=".7"');
  s += part(circle(17, 74, 5), '#e8e2d0', 2.4) + fill(circle(16, 73, 1.4), '#c9bfa6');
  // the brass meridian ring and stand
  const ring = `M${cx - 4} ${cy - 54}A54 54 0 0 0 ${cx - 4} ${cy + 54}`;
  s += line(ring, INK, 10) + line(ring, BR.base, 5) + line(ring, BR.light, 1.4, 'stroke-dasharray="30 200"');
  const stand = smooth([[60, 106, 1], [96, 106, 1], [100, 112], [110, 115.5, 1], [46, 115.5, 1], [56, 112]]);
  s += part(stand, BR.base, 5) + inside(stand, fill(poly([[40, 112], [120, 112], [120, 120], [40, 120]]), BR.shade));
  const ball = circle(cx, cy, r);
  s += part(ball, O.base);
  s += inside(ball,
    // continents, loosely: the Americas on the dark side, Africa and Eurasia facing us, Japan at the edge
    fill(smooth([[30, 30], [46, 36], [44, 56], [52, 70], [44, 90], [36, 96], [30, 70]]), L.base) +
    fill(smooth([[62, 66], [80, 62], [88, 76], [80, 98], [70, 102], [64, 84]]), L.base) +
    fill(smooth([[66, 22], [96, 18], [118, 28], [114, 46], [100, 42], [86, 50], [72, 40]]), L.base) +
    fill(smooth([[114, 44, 1], [120, 38], [124, 46], [118, 58, 1], [116, 50]]), L.light) +
    fill(smooth([[0, 0], [52, 20], [44, 70], [56, 120], [0, 120]]), 'rgba(16,40,90,.35)') +
    fill(smooth([[36, 104], [80, 112], [130, 96], [130, 130], [36, 130]]), 'rgba(16,40,90,.3)') +
    line(ellipse(cx, cy - 20, r * 0.9, 8), O.light, 0.8, 'opacity=".6"') + line(ellipse(cx, cy + 14, r, 9), O.light, 0.8, 'opacity=".6"') +
    line(`M${cx + 10} ${cy - r}Q${cx + 26} ${cy} ${cx + 10} ${cy + r}`, O.light, 0.8, 'opacity=".6"') +
    // clouds
    line('M44 50q6-4 12 0q4-3 8 0', '#ffffff', 2.4) + line('M92 92q6-4 12 0', '#ffffff', 2.4) +
    fill(smooth([[60, 22], [92, 20], [108, 30], [86, 28]]), 'rgba(255,255,255,.45)'));
  s += rim(ball, poly([[0, 0], [80, 0], [50, 30], [34, 70], [30, 110], [0, 110]]), 2.2);
  // the pin, stuck where the finger stopped
  s += line('M118 48L128 30', INK, 3) + line('M118 48L128 30', '#d8d0c0', 1.2) + part(circle(129, 28, 5.2), '#e5352c', 3) + fill(circle(127.5, 26.5, 1.6), '#ffb4a2');
  // a thrilled face
  s += eyeE({ x0: 56, x1: 74, top: 52, bot: 66, slant: 0.1, nose: 1, px: 68, py: 60, pr: 4.8 });
  s += eyeE({ x0: 86, x1: 106, top: 50, bot: 65, slant: 0.1, nose: -1, px: 100, py: 58, pr: 5.2 });
  s += expr() === 'normal' ? line('M54 46q9-6 20-2M86 44q10-6 22-1', INK, 2.6) : browsE([54, 46, 74, 44], [86, 44, 108, 43], 2.6);
  const mouth = smooth([[72, 76, 1], [92, 78], [108, 74, 1], [102, 90], [90, 94], [78, 88]]);
  s += mouthE(90, 84, 34, fill(mouth, '#3a1612') + inside(mouth, fill(poly([[70, 72], [110, 72], [110, 80], [70, 80]]), '#fff') + fill(ellipse(90, 94, 10, 5), '#ff7a96')) + line(mouth, INK, 2));
  // the orbit's front half, the plane riding it
  s += line(`M${cx + ox} ${cy - oy}A66 16 -14 0 1 ${cx - ox} ${cy + oy}`, '#ffffff', 1.4, 'stroke-dasharray="3 3" opacity=".9"');
  s += plane(134, 58, 1.2, 100);
  s += sparkle(20, 20, 4) + sparkle(130, 104, 3);
  return end(s);
}

export default {
  card: 12, champion: 'האסטרונאוט', en: 'The Astronaut', theme: 'Card: a globe and an airliner, off to Japan · Power: moon gravity (Aerial)',
  options: [
    { letter: 'A', name: 'Moonface', draw: moon,
      blurb: 'The man in the moon himself, the astronaut\'s destination: a crescent with a profile face on its inner curve, the card guy\'s round glasses, craters on its dark side, a flag planted in its back, its little plane orbiting. <i>Silhouette: a C, open to the opponent.</i>' },
    { letter: 'B', name: 'Jumbo', draw: jumbo,
      blurb: 'The card\'s airliner come alive: the cockpit windows are its eyes, the dark radome its nose, an eager grin underneath, a tail fin for a crest, wings and an engine sticking out. <i>Silhouette: a bullet nose with a fin and wings.</i>' },
    { letter: 'C', name: 'Globetrotter', draw: fitted(globe, [1.04, 1.05, 3, 0]), marks: { eyes: [[65, 59], [96, 57.5]], nose: [90, 70] },
      blurb: 'The globe the card guy stands on, thrilled to go: oceans and continents for a face, a red pin stuck in Japan where the finger stopped, a brass meridian ring and stand, a plane and a moon on its orbit. <i>Silhouette: a ball in a brass ring.</i>' },
  ],
};
