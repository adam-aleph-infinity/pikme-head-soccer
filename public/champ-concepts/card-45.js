// Card #45 — אדון הזמן (The Time Lord). Card: Naveh turned to cracked stone, light shining out
// of the cracks, in the world's biggest nuclear bunker ("hiding in the bunker for 10,000").
// Power: time stops: ball and opponent freeze, then the shot resumes — the final Delay (freeze).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const glowCrack = (d) => line(d, '#ffb627', 3.4, 'opacity=".7"') + line(d, '#fff2a8', 1.4);

// ---- A: a stone gargoyle, frozen mid-snarl, light in its cracks ----------------------------------------
function gargoyle() {
  begin();
  const S = { base: '#9a9890', light: '#c4c2b8', hi: '#e2e0d8', shade: '#6e6c64', deep: '#4a4842' };
  let s = '';
  // folded wings behind, horns, ears
  const wingL = smooth([[44, 74], [16, 50], [6, 22, 1], [20, 34], [26, 22, 1], [34, 40], [50, 52]]), wingR = smooth([[104, 70], [128, 46], [140, 18, 1], [126, 30], [122, 18, 1], [112, 36], [98, 48]]);
  for (const d of [wingL, wingR]) s += part(d, S.shade) + inside(d, line('M10 26L40 60M24 26L44 56M136 22L108 56M124 22L104 52', S.deep, 1.4));
  // ram horns, thick at the root, curling back and up
  for (const [d, c] of [[smooth([[44, 44], [34, 26], [22, 16], [12, 20], [10, 30, 1], [16, 26], [26, 28], [36, 40], [56, 44]]), S.light], [smooth([[92, 40], [104, 22], [118, 12], [130, 14], [134, 24, 1], [126, 20], [116, 24], [106, 38], [102, 46]]), S.base]])
    s += part(d, c, 5) + inside(d, line('M20 22l6 4M26 30l4-4M120 18l4 6M112 26l6-2', S.deep, 1.2));
  s += part(poly([[34, 62], [18, 52], [36, 72]]), S.shade, 4) + part(poly([[112, 58], [130, 48], [112, 70]]), S.base, 4);
  const head = smooth([[34, 90], [30, 62], [40, 42], [60, 32], [88, 32], [108, 42], [118, 62], [120, 84], [110, 98], [86, 104], [60, 104], [44, 98]]);
  s += part(head, S.base);
  s += inside(head, fill(smooth([[10, 30], [46, 40], [40, 80], [44, 120], [10, 120]]), S.shade) + fill(smooth([[60, 34], [96, 36], [110, 50], [84, 46]]), S.light) + line('M64 36q22-4 38 10', S.hi, 2) +
    [[50, 54], [44, 80], [98, 44]].map(([x, y]) => fill(circle(x, y, 1.6), S.deep)).join(''));
  // the ledge it crouches on, claws over the edge
  const ledge = smooth([[4, 102, 1], [140, 100, 1], [142, 117.5, 1], [2, 117.5, 1]], true, 0.2);
  s += part(ledge, S.shade) + inside(ledge, fill(poly([[0, 100], [144, 98], [144, 106], [0, 108]]), S.light) + line('M30 104v14M80 102v16M120 102v16', S.deep, 1.2));
  for (const x of [52, 96]) for (let i = 0; i < 3; i++) s += part(smooth([[x - 6 + i * 5, 98], [x - 4 + i * 5, 108, 1], [x - 1 + i * 5, 98]]), S.light, 2.4);
  s += rim([head, wingL], poly([[0, 0], [70, 0], [40, 30], [20, 80], [0, 90]]), 2, '#fff2a8');
  // a heavy brow, a snarl full of fangs
  s += eye({ x0: 56, x1: 72, top: 56, bot: 67, slant: 0.55, nose: 1, px: 67, py: 63, pr: 3.8, white: '#fff2a8' });
  s += eye({ x0: 84, x1: 102, top: 54, bot: 66, slant: 0.55, nose: -1, px: 96, py: 61, pr: 4, white: '#fff2a8' });
  s += part(smooth([[50, 52, 1], [76, 56, 1], [74, 50], [52, 46]]), S.light, 3) + part(smooth([[82, 54, 1], [108, 46, 1], [106, 42], [84, 48]]), S.light, 3);
  const mouth = smooth([[60, 82, 1], [80, 84], [102, 80, 1], [98, 94], [80, 98], [64, 94]]);
  s += fill(mouth, '#2a2420') + inside(mouth, fill(poly([[58, 79], [104, 78], [104, 84], [58, 85]]), S.hi)) + line(mouth, INK, 2);
  s += part(poly([[66, 84], [72, 84], [69, 92]]), S.hi, 1.6) + part(poly([[90, 83], [96, 83], [93, 91]]), S.hi, 1.6);
  // the cracks, the card's light shining out of them
  s += glowCrack('M44 52l8 8l-4 8l6 6') + glowCrack('M104 70l-6 8l4 6l-6 8') + glowCrack('M76 34l-4 8l6 4');
  return end(s);
}

// ---- B: a drop of amber with an ancient bug frozen in it -----------------------------------------------
function amber() {
  begin();
  const A = { base: '#ff9a1a', light: '#ffc85a', hi: '#fff0b0', shade: '#c8640a', deep: '#8a3e06' };
  let s = '';
  const drop = smooth([[74, 4, 1], [92, 24], [114, 50], [124, 76], [118, 100], [98, 114], [74, 117.5], [48, 114], [30, 100], [24, 76], [36, 50], [56, 24]]);
  s += part(drop, A.base);
  s += inside(drop, fill(smooth([[0, 20], [44, 40], [36, 90], [44, 130], [0, 130]]), A.shade) + fill(smooth([[20, 100], [74, 112], [130, 96], [130, 130], [20, 130]]), A.deep, 'opacity=".7"') +
    fill(ellipse(70, 70, 34, 30), A.light, 'opacity=".55"') +
    // an ancient insect, frozen mid-flight
    `<g opacity=".8">` + fill(ellipse(50, 96, 8, 4, -0.4), '#4a2006') + fill(ellipse(40, 99, 4, 3), '#4a2006') + fill(ellipse(52, 88, 8, 3.4, -1.1), 'rgba(255,240,200,.5)') + fill(ellipse(60, 92, 8, 3, -0.6), 'rgba(255,240,200,.5)') +
    line('M46 100l-4 8M50 100l-1 9M54 99l3 8M58 96l6 4M36 98l-6-4', '#4a2006', 1) + '</g>' +
    [[96, 96, 2.4], [104, 86, 1.6], [40, 70, 1.8], [100, 40, 1.4]].map(([x, y, r]) => line(circle(x, y, r), A.hi, 1)).join('') +
    fill(smooth([[50, 30], [62, 18], [58, 40], [46, 56]]), '#ffffff', 'opacity=".55"'));
  s += rim(drop, poly([[0, 0], [70, 0], [44, 30], [26, 80], [0, 90]]), 2, '#fff0b0');
  // a face that's been waiting a very long time
  s += eye({ x0: 52, x1: 68, top: 56, bot: 68, slant: 0.3, nose: 1, px: 63, py: 63, pr: 4, white: '#fff8e0' });
  s += eye({ x0: 80, x1: 98, top: 55, bot: 67, slant: 0.3, nose: -1, px: 92, py: 62, pr: 4.4, white: '#fff8e0' });
  s += line('M50 50q8-4 18 0M80 48q9-4 20 0', A.deep, 2.4);
  s += line('M66 80Q76 86 88 78', A.deep, 2.4);
  s += sparkle(132, 30, 4.4, '#fff0b0') + sparkle(14, 40, 3.4, '#fff0b0') + sparkle(126, 100, 3, '#fff0b0');
  return end(s);
}

// ---- C: the bunker's vault door, frozen shut ----------------------------------------------------------------
function vault() {
  begin();
  const ST = { base: '#a8b0b8', light: '#d0d6dc', hi: '#f1f5f8', shade: '#70787f', deep: '#4a5056' };
  const cx = 74, cy = 62;
  let s = '';
  const frame = circle(cx, cy, 55.5), door = circle(cx, cy, 45);
  s += part(frame, ST.shade) + inside(frame, fill(circle(cx + 6, cy + 6, 56), ST.deep) + line(circle(cx, cy, 51), ST.light, 1.4));
  // the locking bolts round the edge
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, x = cx + Math.cos(a) * 49, y = cy + Math.sin(a) * 49; s += `<g transform="rotate(${(a * 180) / Math.PI} ${x} ${y})">` + part(smooth([[x - 5, y - 3, 1], [x + 5, y - 3, 1], [x + 5, y + 3, 1], [x - 5, y + 3, 1]], true, 0.3), ST.light, 2) + '</g>'; }
  s += part(door, ST.base) + inside(door, fill(circle(cx + 5, cy + 5, 45), ST.shade) + fill(circle(cx - 2, cy - 2, 40), ST.base) + line(circle(cx, cy, 36), ST.light, 1.2) + fill(ellipse(cx - 18, cy - 24, 14, 6, -0.6), ST.hi, 'opacity=".6"') +
    // hazard stripes across its foot
    fill(poly([[0, 90], [144, 90], [144, 130], [0, 130]]), '#ffd23a') + Array.from({ length: 12 }, (_, i) => fill(poly([[i * 14 - 10, 130], [i * 14, 90], [i * 14 + 7, 90], [i * 14 - 3, 130]]), '#1c1a22')).join(''));
  s += rim(frame, poly([[0, 0], [70, 0], [40, 20], [16, 70], [0, 90]]), 2, '#bfeeff');
  // the wheel handle's spokes, and its hub for a nose
  for (const a of [0.4, 1.97, 3.54, 5.11]) { const x = cx + Math.cos(a) * 22, y = cy + 6 + Math.sin(a) * 22; s += line(`M${cx} ${cy + 6}L${x} ${y}`, INK, 6) + line(`M${cx} ${cy + 6}L${x} ${y}`, ST.light, 3) + part(circle(x, y, 3.4), ST.deep, 2.2); }
  s += part(circle(cx, cy + 6, 6), ST.deep, 3) + fill(circle(cx - 1.6, cy + 4.4, 1.6), ST.hi);
  // eyes over it, a tight-lipped line under it
  s += eyeE({ x0: 54, x1: 70, top: 38, bot: 50, slant: 0.4, nose: 1, px: 65, py: 45, pr: 4 });
  s += eyeE({ x0: 78, x1: 96, top: 37, bot: 49, slant: 0.4, nose: -1, px: 90, py: 44, pr: 4.4 });
  s += browsE([50, 32, 72, 36], [76, 34, 100, 28], 2.8);
  s += mouthE(75, 82, 26, line('M64 82H86', INK, 2.4));
  // frost: time has stopped
  s += fill(smooth([[22, 40], [30, 30], [34, 44], [26, 50]]), 'rgba(220,245,255,.9)') + fill(smooth([[120, 74], [128, 66], [130, 82], [122, 84]]), 'rgba(220,245,255,.9)');
  s += sparkle(132, 20, 4, '#bfeeff') + sparkle(12, 20, 3.4, '#bfeeff');
  return end(s);
}

export default {
  card: 45, champion: 'אדון הזמן', en: 'The Time Lord', theme: 'Card: turned to cracked stone in a nuclear bunker · Power: time stops (Delay, freeze)',
  options: [
    { letter: 'A', name: 'Gargoyle', draw: gargoyle,
      blurb: 'The card\'s stone, given a monster to live in: a gargoyle frozen mid-snarl on its ledge, horns and folded wings, the card\'s golden light shining out of its cracks, as if time has just stopped. <i>Silhouette: a horned head between two wing points, on a ledge.</i>' },
    { letter: 'B', name: 'Amber', draw: amber,
      blurb: 'Time stopped for real: a drop of amber with an ancient insect frozen mid-flight inside it, glowing gold, a face that has been waiting a very, very long time. <i>Silhouette: a teardrop, point up.</i>' },
    { letter: 'C', name: 'Vault Door', draw: vault, marks: { eyes: [[62, 44], [87, 43]], nose: [76, 60] },
      blurb: 'The card\'s nuclear bunker, shut: a round steel vault door, locking bolts all round, the wheel handle\'s hub for a nose, hazard stripes across its foot, frost where time has stopped. <i>Silhouette: a heavy round door.</i>' },
  ],
};
