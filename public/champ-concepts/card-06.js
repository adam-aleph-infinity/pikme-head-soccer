// Card #6 — איל ההון (The Tycoon). Card: Naveh the fighter on a beach, a burlap sack of gold
// coins tipped over his head ("50 fighters compete for 10,000 shekels"). Power: a coin shower
// that splits into coin-balls (Multi-Ball).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, coin, sparkle, def, INK, fitted, eyeE, mouthE, expr, browMove } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// A torn hole: an ellipse with a ragged edge, its top cut on a slant (lower at the nose side).
function ragged(cx, cy, rx, ry, slant, nose, n = 14, seed = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, j = 1 + (((i * 7 + seed * 3) % 5) - 2) * 0.06;
    let x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
    if (y < cy) y = Math.max(y, cy - ry + slant * ry * (nose > 0 ? (x - cx + rx) / (2 * rx) : (cx + rx - x) / (2 * rx)) * 1.4);
    pts.push([x, y, i % 2]);
  }
  return smooth(pts);
}

// ---- A: the sack itself is the fighter -------------------------------------------------
function sack() {
  begin();
  const S = { base: '#c99a5b', light: '#dfb878', hi: '#f1d7a0', shade: '#a2723d', deep: '#7a5128', thread: '#4a2c14' };
  def(`<pattern id="weave" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 .7h1.8M1.5 1.6v1.4" stroke="#6e4a22" stroke-width=".55" opacity=".35"/></pattern>`);
  const tuft = smooth([[52, 40], [36, 30], [22, 14, 1], [42, 20], [46, 3, 1], [61, 17], [74, 1, 1], [83, 16], [100, 5, 1], [99, 21], [118, 15, 1], [104, 36], [96, 42]]);
  const body = smooth([[54, 34], [34, 48], [18, 70], [11, 92], [15, 108], [30, 115], [75, 116.5], [120, 115], [134, 106], [138, 86], [132, 63], [117, 45], [98, 34]]);
  const rope = smooth([[46, 29, 1], [75, 25], [106, 30, 1], [107, 40, 1], [75, 36], [45, 40, 1]]);
  const knot = ellipse(104, 37, 6.5, 5.2);
  const endA = smooth([[99, 41], [100, 50], [102, 60, 1], [105, 50], [104, 41]]);
  const endB = smooth([[105, 41], [110, 48], [115, 57, 1], [113, 46], [109, 39]]);
  let s = '';
  s += part(tuft, S.shade);
  s += inside(tuft, fill(smooth([[60, 40], [58, 20], [74, 1], [84, 18], [100, 5], [96, 40]]), S.base) + fill(smooth([[70, 38], [72, 16], [76, 6], [80, 20], [82, 38]]), S.light));
  s += line('M46 26L58 36M62 18L66 34M83 16L80 34M99 21L92 36', S.deep, 1.1);
  s += part(body, S.base);
  s += inside(body,
    // the back side in shade, the face side lit, the sagging bottom shaded
    fill(smooth([[0, 30], [40, 40], [34, 70], [36, 100], [50, 130], [0, 130]]), S.shade) +
    fill(smooth([[78, 42], [118, 50], [130, 74], [124, 96], [96, 96], [76, 70]]), S.light) +
    fill(smooth([[10, 108], [60, 106], [100, 108], [140, 100], [140, 130], [10, 130]]), S.shade) +
    fill('M0 0H144V142H0Z', 'url(#weave)') +
    // folds gathered up into the neck
    line('M58 38Q46 52 40 70M68 40Q64 50 63 56M88 40Q94 48 100 54', S.deep, 1.3) +
    line('M84 46Q104 52 116 62', S.hi, 2.2));
  s += rim(body, poly([[0, 0], [70, 0], [62, 40], [30, 60], [16, 100], [0, 110]]), 2.4);
  // a sewn patch on the back of the head
  const patch = poly([[30, 56], [46, 52], [49, 66], [33, 70]]);
  s += fill(patch, '#b48a52') + line(patch, S.thread, 1) + line('M31 60l2-1M33 67l2-1M44 54l2 1M46 63l2 1', S.thread, 0.9);
  // the shekel sign stencilled on the cheek
  s += `<text x="40" y="100" font-family="Arial Black, Arial" font-weight="900" font-size="22" fill="#7a3b1c" opacity=".55" transform="rotate(-8 40 100)">₪</text>`;
  // the rope tie and its knot
  s += part(rope, '#d8b56a', 4.4) + inside(rope, line('M50 27l-3 13M56 26l-3 13M62 26l-3 12M68 25l-3 12M74 25l-3 12M80 25l-3 12M86 26l-3 12M92 27l-3 12M98 28l-3 12', '#9b7838', 1.4) + fill(poly([[40, 34], [110, 34], [110, 44], [40, 44]]), '#b8954f'));
  s += part(endA, '#d8b56a', 4.4) + part(endB, '#c9a55c', 4.4) + part(knot, '#e2c27c', 4.4) + line('M100 35q4 5 9 0M101 39q3 2 6 0', '#9b7838', 1.2);
  // the face: torn eye holes with gold coins glowing in them, stitched brows
  const eb = ragged(64, 66, 11, 9, 0.7, 1, 14, 1), ef = ragged(99, 63, 13, 11, 0.7, -1, 14, 2);
  const E = expr();
  if (E === 'happy' || E === 'hurt') s += eyeE({ x0: 55, x1: 74, top: 60, bot: 72, nose: 1 }) + eyeE({ x0: 88, x1: 111, top: 56, bot: 70, nose: -1 });
  else for (const [d, cx, cy, r] of [[eb, 68, 68, 5.2], [ef, 104, 65, 6.2]]) {
    const ox = E === 'kick' ? 2 : 0, oy = E === 'sad' ? 2.4 : 0;
    s += fill(d, '#2a170b') + line(d, INK, 2.2);
    s += inside(d, fill(circle(cx + ox, cy + oy, r + 3.5), '#6b3e10') + coin(cx + ox, cy + oy, r, { mark: 'none' }));
  }
  const [ib, ob] = browMove();
  const stitched = (x0, y0, x1, y1, w) => line(`M${x0} ${y0}L${x1} ${y1}`, S.thread, w) +
    line([0.14, 0.36, 0.58, 0.8].map((t) => `M${x0 + (x1 - x0) * t} ${y0 + (y1 - y0) * t - 2.5}l1 5`).join(''), '#e6cf9c', 1.1);
  s += stitched(48, 51 + ob, 76, 59 + ib, 4.4) + stitched(84, 57 + ib, 116, 46 + ob, 4.6);
  // the mouth: a rip full of coins, stitched at the corners
  const mouth = smooth([[70, 88, 1], [82, 84], [96, 86], [108, 82], [120, 83, 1], [114, 92], [100, 97], [84, 96]]);
  s += mouthE(95, 90, 44, fill(mouth, '#2a170b') + inside(mouth, coin(84, 96, 6, { squash: 0.6, mark: 'none' }) + coin(97, 95, 6, { squash: 0.6, mark: 'none' }) + coin(110, 91, 5.5, { squash: 0.6, mark: 'none' }) +
    fill(poly([[76, 86], [80, 91], [84, 85], [89, 91], [93, 86]]), '#f3ead2')) + line(mouth, INK, 2.2));
  s += line('M68 84l5 6M71 82l5 6M118 79l4 7M121 80l3 6', S.thread, 1.3);
  // a tear at the back, spilling coins
  const tear = ragged(34, 100, 8, 6.5, 0, 1, 12, 3);
  s += fill(tear, '#2a170b') + inside(tear, coin(36, 104, 6, { squash: 0.7, mark: 'none' })) + line(tear, INK, 1.8);
  s += coin(22, 113, 6.5, { rot: -25, squash: 0.8 }) + coin(10, 122, 5, { rot: 30, squash: 0.6, mark: 'none' });
  s += sparkle(116, 102, 4) + sparkle(14, 100, 3);
  return end(s);
}

// ---- B: a living gold coin -------------------------------------------------------------
function coinMan() {
  begin();
  const G = { base: '#f7b928', light: '#ffd75a', hi: '#fff4c4', shade: '#dc9a14', deep: '#a8650a', line: '#7a4404' };
  const cx = 78, cy = 70, rx = 54, ry = 46;
  const edge = ellipse(cx - 8, cy, rx, ry), face = ellipse(cx, cy, rx, ry), field = ellipse(cx + 1, cy - 1, rx - 8, ry - 7.5);
  let s = keyline([edge, face]);
  s += fill(edge, G.deep) + inside(edge, Array.from({ length: 26 }, (_, i) => line(`M${16 + i * 1.6} 20V122`, '#7a4404', 0.7)).join(''));
  s += fill(face, G.shade);
  s += inside(face, fill(ellipse(cx - 10, cy - 12, rx, ry), G.light) + line(ellipse(cx, cy, rx - 2.5, ry - 2.5), G.hi, 1.2, 'opacity=".7" stroke-dasharray="40 300" stroke-dashoffset="-170"'));
  s += fill(field, G.base) + inside(field, fill(smooth([[20, 20], [120, 20], [110, 60], [70, 76], [30, 96], [20, 96]]), '#ffc93c') + fill(smooth([[120, 70], [140, 120], [60, 130], [94, 104]]), G.shade));
  s += line(field, G.line, 1.2);
  // the coin's legend: a ring of stamped dots
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    s += fill(circle(cx + 1 + Math.cos(a) * (rx - 12.5), cy - 1 + Math.sin(a) * (ry - 11.5), 1.05), G.deep);
  }
  s += rim([edge, face], poly([[0, 0], [90, 0], [70, 30], [30, 60], [10, 120], [0, 120]]), 2.4);
  // brows, embossed: the monocle one raised (smug), the other low
  s += part(smooth([[44, 55, 1], [56, 52], [70, 55, 1], [56, 58]]), G.light, 3) ;
  s += part(smooth([[82, 46, 1], [96, 40], [111, 42, 1], [97, 45]]), G.light, 3);
  s += eyeE({ x0: 48, x1: 68, top: 58, bot: 72, slant: 0.28, nose: 1, px: 62, py: 66, pr: 5, lidW: 2.4 });
  s += eyeE({ x0: 86, x1: 108, top: 52, bot: 69, slant: 0.12, nose: -1, px: 101, py: 61, pr: 5.6, lidW: 2.4 });
  // the monocle and its chain to the rim
  s += line('M108 70Q122 86 116 104Q112 112 122 110', '#fff1a6', 1.6, 'stroke-dasharray="2 2.2"') + line('M108 70Q122 86 116 104', G.line, 0.5);
  s += fill(circle(97, 60.5, 13), 'rgba(255,255,255,.18)') + line(circle(97, 60.5, 13), INK, 4.6) + line(circle(97, 60.5, 13), '#ffe27a', 2.4);
  s += line('M88 52q4-4 9-4', '#fff', 1.6, 'opacity=".8"');
  // nose and the big embossed handlebar moustache
  s += line('M86 70q5 8-1 11', G.line, 1.6) + fill(smooth([[86, 80], [90, 77], [93, 80], [89, 82]]), G.shade);
  const mus = smooth([[88, 82], [98, 81], [108, 84], [116, 81], [118, 74], [114, 71, 1], [121, 72], [124, 79], [118, 88], [106, 90], [96, 87], [88, 90], [78, 87], [64, 89], [55, 82], [57, 74, 1], [60, 78], [66, 84], [76, 82]]);
  s += part(mus, G.light, 3.4) + inside(mus, fill(smooth([[50, 88], [90, 84], [130, 86], [130, 100], [50, 100]]), G.shade) + line('M66 82q10 2 20-2M92 84q12 2 22-2', G.hi, 1.4));
  s += mouthE(97, 96, 18, line('M90 95q8 2 14-3', INK, 2) + line('M92 98q6 1 9-1', G.deep, 1.2));
  // a small top hat, tipped back
  s += `<g transform="rotate(-14 96 24)">`;
  const crown = smooth([[83, 24, 1], [81, 4, 1], [109, 3, 1], [107, 24, 1]]), brim = ellipse(95, 24, 22, 4.6);
  s += part(crown, '#26222e', 5) + inside(crown, fill(poly([[100, 0], [112, 0], [112, 30], [102, 30]]), '#15131b') + fill(poly([[80, 15.5], [112, 15.5], [112, 21], [80, 21]]), '#c8282e') + line('M86 6V14', '#5a5470', 2));
  s += part(brim, '#26222e', 5) + line('M76 23q19 4 38 0', '#4a4560', 1.2) + `</g>`;
  s += sparkle(24, 34, 5) + sparkle(134, 98, 4) + sparkle(30, 112, 3);
  return end(s);
}

// ---- C: a blue crab boxer clutching a coin ---------------------------------------------
function crab() {
  begin();
  const B = { base: '#2e8fb4', light: '#58bfdc', hi: '#b6f0f7', shade: '#1b5f7e', deep: '#0f3f57' };
  const O = { base: '#ff6a2b', shade: '#c03f12', hi: '#ffb27d' };
  const U = { base: '#f3e6c8', shade: '#cdb88f' };
  // legs, then the back claw, both behind the body
  const legs = [smooth([[32, 98], [16, 106], [6, 116, 1], [18, 102], [30, 92]]), smooth([[38, 106], [24, 114], [14, 124, 1], [26, 108], [36, 100]]),
    smooth([[114, 98], [128, 104], [140, 114, 1], [128, 100], [112, 92]]), smooth([[108, 106], [122, 112], [132, 122, 1], [120, 106], [106, 100]])];
  let s = '';
  for (const d of legs) s += part(d, B.shade, 5) + inside(d, line('M0 108H144', B.deep, 2));
  const armB = smooth([[26, 76], [18, 66], [16, 56], [24, 56], [30, 68], [36, 74]]);
  const clawB = smooth([[9, 60], [4, 44], [7, 28], [13, 11, 1], [19, 24], [21, 31], [27, 17, 1], [33, 30], [33, 48], [26, 60]]);
  s += part(armB, B.shade, 5) + part(clawB, B.base, 5.6);
  s += inside(clawB, fill(smooth([[0, 34], [16, 34], [36, 40], [36, 70], [0, 70]]), B.shade) + fill(smooth([[0, 0], [40, 0], [40, 26], [24, 28], [16, 30], [0, 26]]), O.base) + line('M8 22q3-8 5-10', O.hi, 1.6));
  // the shell: wide, with a spine at each side, and a scar from the fights
  const shell = smooth([[6, 58, 1], [22, 48], [40, 37], [62, 32], [86, 31], [108, 35], [124, 43], [139, 50, 1], [126, 58], [119, 70], [104, 80], [86, 84], [64, 84], [44, 80], [28, 70], [22, 63]]);
  // the face plate under it (the crab's front)
  const plate = smooth([[34, 76], [56, 82], [92, 82], [118, 72], [120, 94], [112, 110], [92, 115.5], [60, 115.5], [40, 110], [32, 94]]);
  s += part(plate, U.base) + inside(plate, fill(smooth([[20, 70], [52, 80], [48, 100], [62, 120], [20, 120]]), U.shade) + line('M60 112q16 3 36 0', U.shade, 2));
  s += part(shell, B.base);
  s += inside(shell, fill(smooth([[0, 40], [44, 50], [56, 70], [70, 90], [0, 90]]), B.shade) + fill(smooth([[70, 34], [120, 40], [134, 52], [112, 60], [80, 56]]), B.light) +
    line('M74 38q26-2 44 6', B.hi, 2.4) + fill(smooth([[30, 76], [70, 86], [110, 80], [130, 70], [130, 100], [30, 100]]), B.deep));
  s += line('M44 46l14 10M57 45l-12 12', '#d9f6fb', 1.8);
  s += rim(shell, poly([[0, 0], [80, 0], [60, 36], [20, 56], [0, 70]]), 2.2);
  // eye stalks and the eyes on them
  const stB = smooth([[63, 42], [58, 28], [62, 26], [69, 40]]), stF = smooth([[92, 40], [97, 24], [103, 25], [98, 41]]);
  s += part(stB, B.shade, 5) + part(stF, B.base, 5);
  for (const [cx, cy, r, px, nose] of [[58, 19, 10, 62, 1], [101, 15, 11.5, 106, -1]]) {
    const ball = circle(cx, cy, r);
    // the lid cuts lower at the inner side: an angry glare, not a sleepy one
    const yl = cy - r * (nose > 0 ? 0.95 : 0.25), yr = cy - r * (nose > 0 ? 0.25 : 0.95);
    s += keyline(ball, 5.4) + fill(ball, '#ffffff');
    s += inside(ball, fill(circle(px, cy + 1.8, r * 0.6), '#0d0a0c') + fill(circle(px + r * 0.22, cy - r * 0.05, r * 0.18), '#fff') +
      fill(poly([[cx - r - 2, cy - r - 3], [cx + r + 2, cy - r - 3], [cx + r + 2, yr], [cx - r - 2, yl]]), B.base));
    s += line(`M${cx - r - 1.5} ${yl}L${cx + r + 1.5} ${yr}`, INK, 2.8);
  }
  // a fierce, toothy grimace
  const mouth = smooth([[66, 94, 1], [84, 90], [104, 88], [116, 86, 1], [110, 100], [88, 104], [72, 102]]);
  s += fill(mouth, '#5a1414') + inside(mouth, fill(poly([[66, 86], [118, 82], [118, 94], [66, 97]]), '#fff') + line('M76 88v10M85 87v12M94 86v12M103 85v11M111 85v8', '#c9c2c8', 1) + fill(ellipse(92, 106, 12, 4), '#c44a4a'));
  s += line(mouth, INK, 1.8);
  // the front arm and claw, pinching a coin
  const armF = smooth([[118, 72], [126, 62], [128, 54], [122, 52], [116, 62], [110, 70]]);
  const clawF = smooth([[118, 62], [112, 44], [116, 27], [121, 10, 1], [128, 22], [132, 27], [139, 13, 1], [143, 30], [141, 48], [132, 61]]);
  s += part(armF, B.base, 5);
  s += coin(131, 14, 8, { rot: 12 });
  s += part(clawF, B.base, 5.6);
  s += inside(clawF, fill(smooth([[110, 40], [126, 40], [146, 44], [146, 70], [110, 70]]), B.shade) + fill(smooth([[110, 0], [150, 0], [150, 30], [134, 32], [124, 32], [110, 30]]), O.base) +
    fill(smooth([[112, 30], [124, 30], [124, 40], [112, 44]]), B.light) + line('M118 22q2-8 4-10', O.hi, 1.6));
  s += sparkle(138, 2, 3.5);
  return end(s);
}

export default {
  card: 6, champion: 'איל ההון', en: 'The Tycoon', theme: 'Card: a sack of coins on a beach · Power: coin shower (Multi-Ball)',
  options: [
    { letter: 'A', name: 'Sack Brute', draw: fitted(sack, [1, 0.99, 0, -3]), marks: { eyes: [[68, 68], [104, 65]], nose: [96, 77] },
      blurb: 'The card\'s sack of coins is the fighter. A tied-off burlap head with a rope topknot, gold coins burning in torn eye holes, a mouth ripped open and full of money, coins spilling from a tear at the back. <i>Silhouette: a pear-shaped sack with a spiky knot on top.</i>' },
    { letter: 'B', name: 'Coin Tycoon', draw: coinMan,
      blurb: 'A living gold coin, the tycoon himself: a stamped coin face with a reeded edge, a smug raised brow behind a monocle, an embossed handlebar moustache and a small top hat tipped back. <i>Silhouette: a perfect disc with a hat.</i>' },
    { letter: 'C', name: 'Coin-Claw Crab', draw: crab,
      blurb: 'A beach fighter from the card\'s shore: a blue crab with its guard up, one claw pinching a gold coin. Eyes on stalks, a spiked wide shell with a fight scar, a toothy grimace. <i>Silhouette: wide and low, claws and eye-stalks breaking out.</i>' },
  ],
};
