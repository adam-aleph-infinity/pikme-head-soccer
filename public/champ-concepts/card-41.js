// Card #41 — שומר הזמן (The Time Keeper). Card: Ori between two supercars with chequered flags
// ("the last one out of the Lamborghini wins 5,000"). Power: slow motion — the ball hangs in
// mid-air and the hit player stays slow (Delay, shock; the aura freezes).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: a sloth, hanging off a branch, taking its time --------------------------------------------------
function sloth() {
  begin();
  const F = { base: '#c9b08a', light: '#e2cca8', hi: '#f4e6c8', shade: '#9a8460', deep: '#6e5a40' };
  let s = '';
  // the branch across the top, the arms hooked over it
  const branch = smooth([[0, 4, 1], [144, 2, 1], [144, 14, 1], [0, 16, 1]], true, 0.3);
  for (const [x0, x1] of [[26, 30], [122, 114]]) { const arm = smooth([[x0 - 7, 70], [x1 - 6, 10], [x1 + 6, 10], [x0 + 7, 70]]); s += part(arm, F.shade, 5) + inside(arm, line(`M${x0} 64L${x1} 14`, F.deep, 1.2, 'stroke-dasharray="3 4"')); }
  s += part(branch, '#8a5a32', 5) + inside(branch, line('M10 9h40M70 8h30M110 7h24', '#6a4222', 1.4));
  s += part(smooth([[120, 4], [130, -4], [138, 4, 1], [128, 6]]), '#5bb84a', 3);
  for (const x of [26, 32, 110, 116]) s += line(`M${x} 14Q${x + 2} 0 ${x + 7} 4`, INK, 3.6) + line(`M${x} 14Q${x + 2} 0 ${x + 7} 4`, '#f4ead2', 1.8);
  // the fuzzy head
  const pts = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 1 : 1.06; pts.push([74 + Math.cos(a) * 52 * r, 74 + Math.sin(a) * 44 * r, i % 2 ? 0 : 1]); }
  const head = smooth(pts);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [40, 40], [34, 90], [40, 130], [0, 130]]), F.shade) + fill(smooth([[56, 32], [96, 34], [112, 48], [84, 44]]), F.light) +
    fill(ellipse(78, 78, 38, 28), F.hi));
  s += rim(head, poly([[0, 20], [70, 20], [40, 40], [20, 80], [0, 100]]), 2);
  // the dark mask stripes running back from its eyes
  s += fill(smooth([[50, 64], [64, 60], [74, 70], [62, 80], [36, 84], [30, 78]]), F.deep) + fill(smooth([[86, 62], [100, 58], [126, 70], [120, 78], [100, 76], [86, 70]]), F.deep);
  // sleepy half-shut eyes, a small dark nose, its permanent gentle smile
  s += eye({ x0: 56, x1: 70, top: 64, bot: 74, slant: -0.6, nose: 1, px: 66, py: 71, pr: 3.4, r: 2.2 });
  s += eye({ x0: 90, x1: 104, top: 62, bot: 72, slant: -0.6, nose: -1, px: 100, py: 69, pr: 3.6, r: 2.2 });
  s += part(ellipse(84, 84, 5, 3.4), '#3a2a1e', 2);
  s += line('M72 94Q84 100 96 94', INK, 2.2);
  // z z z, and the blur of slow motion behind it
  s += `<text x="118" y="34" font-family="Arial Black, Arial" font-weight="900" font-size="9" fill="#bfe8ff">z</text><text x="128" y="26" font-family="Arial Black, Arial" font-weight="900" font-size="11" fill="#bfe8ff">z</text>`;
  s += line('M10 60q-6 20 0 40M16 54q-6 24 0 52', '#ffffff', 1.6, 'opacity=".45"');
  return end(s);
}

// ---- B: a supercar from the card, its headlights for eyes ---------------------------------------------
function supercar() {
  begin();
  const Y = { base: '#ffd23a', light: '#ffe88a', hi: '#fff6c8', shade: '#d4a012', deep: '#9a7206' };
  const BK = '#1c1a22';
  let s = line('M32 22V60M56 20V40', INK, 4) + line('M32 22V60M56 20V40', '#5a5e6a', 1.6);
  s += part(poly([[22, 12], [74, 8], [76, 18], [24, 24]]), BK, 4) + line('M28 16l44-4', '#5a5e6a', 1.4);
  const body = smooth([[18, 98], [18, 70], [32, 54], [52, 34], [84, 24], [116, 30], [134, 48], [138, 64], [138, 86], [132, 104], [116, 112], [34, 112]]);
  s += part(body, Y.base);
  s += inside(body, fill(smooth([[0, 50], [40, 60], [40, 110], [0, 110]]), Y.shade) + fill(smooth([[56, 32], [92, 24], [118, 36], [90, 34]]), Y.light) + line('M60 32q30-12 54 0', Y.hi, 2.4) +
    // side intake, the windshield, the lower lip
    fill(poly([[22, 76], [52, 68], [46, 88], [24, 92]]), BK) + fill(smooth([[54, 38, 1], [86, 27, 1], [110, 33, 1], [120, 50, 1], [70, 54, 1]], true, 0.4), '#2a3a4a') + fill(poly([[62, 40], [76, 34], [70, 50]]), '#5a7a9a') +
    fill(poly([[60, 98], [144, 92], [144, 110], [60, 110]]), BK));
  s += rim(body, poly([[0, 0], [70, 0], [40, 50], [16, 90], [0, 100]]), 2);
  // the headlights are its eyes, the grille its grin
  for (const [x0, x1, top, bot, nose, px, py] of [[78, 100, 64, 74, 1, 94, 70], [108, 134, 62, 73, -1, 127, 68]]) {
    s += eyeE({ x0, x1, top, bot, slant: 0.55, nose, px, py, pr: 3.6, r: 2, white: '#f2fbff', lidW: 3.4 });
  }
  const grille = smooth([[86, 82, 1], [134, 80, 1], [130, 94, 1], [92, 96, 1]], true, 0.3);
  s += mouthE(110, 88, 40, fill(grille, '#0d0d12') + inside(grille, line('M90 84l6 10M98 84l6 10M106 83l6 10M114 83l6 10M122 82l6 10', '#5a5e6a', 1.4)) + line(grille, INK, 1.8));
  // wheels
  for (const x of [44, 106]) s += part(circle(x, 105, 12.5), '#26262e', 4) + fill(circle(x, 105, 7.4), '#c9d2da') + line(`M${x - 5.6} ${105}h11.2M${x} ${99.4}v11.2`, '#8a96a2', 1.6) + fill(circle(x, 105, 2.4), Y.base);
  s += sparkle(128, 22, 3.6);
  return end(s);
}

// ---- C: a Japanese-style horizontal traffic light, its countdown frozen ---------------------------------
function traffic() {
  begin();
  const H = { base: '#2a2d34', light: '#4a4e58', shade: '#1a1c20' };
  let s = '';
  // the bracket and the countdown box below: its mouth
  s += line('M74 80V88', INK, 8) + line('M74 80V88', '#5a5e6a', 4);
  const box = smooth([[36, 86, 1], [112, 86, 1], [112, 117.5, 1], [36, 117.5, 1]], true, 0.25);
  s += part(box, H.base) + fill(smooth([[44, 92, 1], [104, 92, 1], [104, 112, 1], [44, 112, 1]], true, 0.25), '#0a0a0e');
  // an LED grin and a frozen "3"
  for (const [x, y] of [[54, 100], [58, 104], [62, 106], [66, 107], [70, 107], [74, 107], [78, 106], [82, 104], [86, 100]]) s += fill(poly([[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]]), '#ff4a3a');
  s += `<text x="92" y="108" font-family="Arial Black, Arial" font-weight="900" font-size="12" fill="#ff4a3a">3</text>`;
  // the housing
  const housing = smooth([[8, 34, 1], [140, 34, 1], [140, 80, 1], [8, 80, 1]], true, 0.25);
  s += part(housing, H.base) + inside(housing, fill(poly([[0, 34], [144, 34], [144, 42], [0, 42]]), H.light) + line('M14 38h120', '#7a7e88', 1.2) + fill(poly([[0, 72], [144, 72], [144, 82], [0, 82]]), H.shade));
  s += rim(housing, poly([[0, 0], [60, 0], [30, 40], [10, 90], [0, 90]]), 2);
  // three lights, the red and the green are its eyes; their hoods its brows
  const lamps = [[36, '#ff3a3a', '#ff9a9a', true], [74, '#5a4a10', '#7a6a20', false], [112, '#3aff6a', '#a8ffc0', true]];
  for (const [x, c, l, lit] of lamps) {
    if (lit) s += fill(circle(x, 57, 19), lit ? c : 'none', 'opacity=".25"');
    s += part(circle(x, 57, 14), c, 3.4) + fill(circle(x - 4, 53, 5), l, 'opacity=".7"');
  }
  for (const [x, px] of [[36, 41], [112, 117]]) s += fill(circle(px, 59, 6), '#0d0a0c') + fill(circle(px + 2, 57, 2), '#ffffff');
  for (const [x, k] of [[36, 1], [74, 0], [112, -1]]) s += part(`M${x - 17} ${46 + 4 * k}Q${x} ${36} ${x + 17} ${46 - 4 * k}L${x + 15} ${48 - 4 * k}Q${x} ${42} ${x - 15} ${48 + 4 * k}Z`, H.light, 3);
  // electric crackle
  for (const [x, y] of [[132, 18], [12, 22]]) s += part(poly([[x, y], [x - 5, y + 9], [x - 1, y + 8], [x - 4, y + 16], [x + 4, y + 5], [x, y + 6]]), '#ffe14a', 2.2);
  return end(s);
}

export default {
  card: 41, champion: 'שומר הזמן', en: 'The Time Keeper', theme: 'Card: a supercar endurance race, chequered flags · Power: slow motion (Delay, shock)',
  options: [
    { letter: 'A', name: 'Sloth', draw: sloth,
      blurb: 'Slow motion as an animal: a sloth hanging off a branch by its long claws, the dark mask stripes running back from its half-shut eyes, its permanent gentle smile, z\'s drifting off it. <i>Silhouette: a fuzzy round head under a branch, arms up.</i>' },
    { letter: 'B', name: 'Supercar', draw: fitted(supercar, [1, 1.06, -1, -5]), marks: { eyes: [[89, 69], [121, 67.5]], nose: [112, 78] },
      blurb: 'One of the card\'s supercars: a yellow wedge with slanted headlights for eyes, a black grille for a grin, a spoiler at its back, wheels under it. <i>Silhouette: a low wedge on two wheels.</i>' },
    { letter: 'C', name: 'Red Light', draw: traffic,
      blurb: 'The thing that stops you dead: a Japanese-style sideways traffic light, its red and green lamps for eyes under their hoods, its pedestrian countdown frozen on 3 with an LED grin. <i>Silhouette: a wide bar over a small box.</i>' },
  ],
};
