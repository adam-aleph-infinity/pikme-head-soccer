// Card #33 — רגל הזהב (The Golden Foot). Card: Naveh in a yellow racing suit at a go-kart race
// through Tokyo, a glowing mystery box with the Saltiz logo, coins flying ("the million-shekel
// vacation of the biggest YouTuber"). Power: the fastest shot of all, straight through a block (Critical).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, coin, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06', hi: '#fffbe0' };

// ---- A: the golden boot itself ---------------------------------------------------------------------
function boot() {
  begin();
  let s = line('M2 60h14M0 74h12M4 88h12', '#ffffff', 2, 'opacity=".55"');
  // studs under the sole
  for (const x of [30, 52, 98, 120]) s += part(poly([[x - 5, 104], [x + 5, 104], [x + 3, 117.5], [x - 3, 117.5]]), G.shade, 3);
  // the tongue standing up out of the ankle like a quiff
  const tongue = smooth([[44, 28], [46, 10], [56, 2, 1], [64, 10], [66, 30]]);
  s += part(tongue, G.base) + inside(tongue, fill(poly([[40, 0], [52, 0], [52, 30], [40, 30]]), G.shade) + line('M56 8v16', G.light, 1.6));
  const shoe = smooth([[18, 106, 1], [16, 80], [20, 56], [26, 32], [32, 22, 1], [68, 24, 1], [72, 36], [92, 50], [114, 62], [134, 72], [142, 88], [138, 102], [126, 106, 1]]);
  s += part(shoe, G.base);
  s += inside(shoe, fill(smooth([[0, 20], [34, 26], [30, 80], [34, 120], [0, 120]]), G.shade) + fill(smooth([[70, 40], [110, 60], [134, 72], [120, 76], [90, 62]]), G.light) + line('M72 40q34 14 60 32', G.hi, 2.4) +
    fill(poly([[0, 96], [144, 96], [144, 120], [0, 120]]), G.deep) + line('M16 96H140', G.light, 1.4) +
    // a lightning stripe down its side
    fill(poly([[34, 50], [58, 46], [50, 64], [68, 62], [40, 90], [48, 70], [32, 72]]), '#2f6fe0', 'opacity=".9"'));
  s += fill(ellipse(50, 25, 17, 4.4), '#3a2414');
  // laces across the instep
  s += line('M70 32L80 46M78 36L72 46M86 42L94 54M94 46L86 56M102 50L108 62M110 54L100 62', '#ffffff', 2.4);
  s += rim(shoe, poly([[0, 0], [60, 0], [30, 30], [18, 80], [0, 110]]), 2.2, G.hi);
  // its face on the side
  s += eye({ x0: 52, x1: 68, top: 56, bot: 68, slant: 0.45, nose: 1, px: 63, py: 63, pr: 4 });
  s += eye({ x0: 78, x1: 96, top: 60, bot: 73, slant: 0.45, nose: -1, px: 90, py: 67, pr: 4.4 });
  s += line('M48 50L70 54M78 54L100 52', INK, 2.8);
  const mouth = smooth([[70, 82, 1], [88, 84], [106, 82, 1], [100, 92], [86, 94], [74, 90]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[66, 80], [110, 80], [110, 86], [66, 86]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(132, 30, 5) + sparkle(110, 12, 3.6) + sparkle(14, 20, 3.4);
  return end(s);
}

// ---- B: a banana peel, the go-kart's oldest trick ---------------------------------------------------
function banana() {
  begin();
  const P = { base: '#ffd23a', shade: '#e0a812', light: '#ffe88a', tip: '#6a4222' };
  const FL = { base: '#fff2b0', shade: '#f2d880' };
  let s = line('M20 117l30-4M96 116l28-6', '#3a3a40', 2.4, 'opacity=".55"');
  // the peel flaps behind
  const flapB = smooth([[50, 62], [30, 76], [14, 96], [6, 112], [12, 118, 1], [24, 108], [40, 92], [56, 82]]);
  const flapF = smooth([[96, 60], [118, 74], [134, 94], [142, 110], [136, 118, 1], [126, 106], [110, 90], [94, 80]]);
  for (const d of [flapB, flapF]) s += part(d, P.base) + inside(d, fill(poly([[0, 100], [144, 100], [144, 120], [0, 120]]), P.tip, 'opacity=".85"') + line(d, P.light, 1.4, 'stroke-dasharray="12 60"'));
  // the fruit standing up out of it: the face
  const fruit = smooth([[54, 40], [58, 18], [72, 8], [88, 12], [96, 32], [100, 66], [98, 96], [86, 110], [64, 110], [52, 94], [50, 66]]);
  s += part(fruit, FL.base) + inside(fruit, fill(smooth([[40, 20], [60, 22], [56, 70], [62, 120], [40, 120]]), FL.shade) + line('M80 14q10 6 12 22', '#ffffff', 2.4) + line('M76 22q-4 40 2 80', FL.shade, 1.2));
  // the front flap folding down over its middle
  const flapM = smooth([[60, 76], [84, 72], [104, 84], [112, 104], [108, 117.5, 1], [50, 117.5, 1], [46, 100], [52, 86]]);
  s += part(flapM, P.base) + inside(flapM, fill(smooth([[40, 100], [80, 104], [120, 98], [120, 130], [40, 130]]), P.shade) + line('M64 80q20-4 36 6', P.light, 2));
  s += part(smooth([[70, 110, 1], [84, 110, 1], [82, 117.5, 1], [72, 117.5, 1]], true, 0.3), P.tip, 2.4);
  s += rim([fruit, flapB], poly([[0, 0], [62, 0], [52, 40], [20, 90], [0, 110]]), 2);
  // a sneaky grin: it is waiting for you to step on it
  s += eye({ x0: 58, x1: 72, top: 36, bot: 46, slant: 0.45, nose: 1, px: 68, py: 42, pr: 3.4, r: 2.2 });
  s += eye({ x0: 78, x1: 94, top: 34, bot: 45, slant: 0.45, nose: -1, px: 89, py: 40, pr: 3.6, r: 2.2 });
  s += line('M56 30L74 34M78 32L96 26', INK, 2.4);
  s += line('M64 56Q76 62 90 54', INK, 2.2) + line('M90 54l3-2', INK, 1.6);
  s += sparkle(124, 30, 4) + sparkle(18, 40, 3.4);
  return end(s);
}

// ---- C: an ostrich, the kick of the animal kingdom ---------------------------------------------------
function ostrich() {
  begin();
  const N = { base: '#e8b8a8', shade: '#c08a7a', light: '#f6d6ca' };
  let s = line('M2 40h14M0 54h12M4 68h10', '#ffffff', 2, 'opacity=".55"');
  // the long neck rising out of the plumes
  const neck = smooth([[60, 92], [64, 60], [72, 40], [88, 38], [92, 56], [86, 92]]);
  s += part(neck, N.base) + inside(neck, fill(poly([[50, 30], [72, 30], [72, 100], [50, 100]]), N.shade) + line('M66 80q-2-6 2-10M76 70q-2-6 2-10M70 56q-2-6 2-10', N.light, 1.4));
  // its head: a big eye, sparse fluff on top, a flat wide beak
  const head = ellipse(82, 28, 22, 18);
  for (const [x, y] of [[70, 12], [78, 8], [86, 9], [74, 6]]) s += line(`M${x} ${y + 4}l${(x - 78) * 0.3} -8`, INK, 3.4) + line(`M${x} ${y + 4}l${(x - 78) * 0.3} -8`, '#8a7a6a', 1.6);
  const beak = smooth([[98, 24], [128, 26], [142, 34, 1], [126, 40], [100, 38]]);
  s += keyline([head, beak]) + fill(head, N.base) + inside(head, fill(ellipse(76, 34, 20, 16), N.shade)) + fill(beak, '#f2c69a') + line('M100 32Q120 34 140 34', '#a8784a', 1.6) + fill(ellipse(118, 28, 2.6, 1.2), '#a8784a');
  s += rim([head, neck], poly([[0, 0], [70, 0], [62, 30], [56, 100], [0, 100]]), 2);
  s += eye({ x0: 78, x1: 96, top: 18, bot: 34, slant: 0.2, nose: -1, px: 90, py: 27, pr: 5.2 });
  s += line('M78 18l-4-4M80 16l-2-5M84 15l-1-5M96 18l4-3', INK, 1.6) + line('M76 14Q88 8 100 14', INK, 2.6);
  // the black-and-white plumes, its feet's power hidden underneath
  const plume = smooth([[4, 117.5, 1], [6, 96], [16, 82], [32, 76], [50, 82], [62, 76], [86, 78], [104, 74], [122, 80], [136, 90], [140, 117.5, 1]]);
  s += part(plume, '#26262e');
  // soft white plume ends, curling, not points
  let tips = '';
  for (let i = 0; i < 6; i++) { const x = 18 + i * 22, y = 100 + (i % 2) * 6; tips += ellipse(x, y, 11, 7, -0.5) ; }
  s += inside(plume, fill(tips, '#f4f4f2') + line(Array.from({ length: 6 }, (_, i) => `M${10 + i * 22} ${104 + (i % 2) * 6}q8-6 16-2`).join(''), '#c9c6ce', 1.2) + line('M20 88q20-8 40 0M80 86q24-10 48 0', '#4a4a55', 1.6));
  s += line('M64 90h18', INK, 2) + sparkle(130, 56, 4, '#ffd24a') + sparkle(16, 66, 3.4, '#ffd24a');
  return end(s);
}

// ---- D (your request): a rich tycoon in the Monopoly spirit -------------------------------------------------
function tycoon33() {
  begin();
  const S = { base: '#f6c6a2', light: '#ffdcc2', shade: '#dc9a78' };
  const WH = { base: '#f4f2ee', shade: '#cdc8c0', light: '#ffffff' };
  const HT = { base: '#26222a', light: '#3e3846', hi: '#5e566a' };
  let s = '';
  // the card's coins flying round him
  s += coin(132, 62, 6.4, { squash: 0.8, rot: 20, edge: 1.4 }) + coin(10, 96, 5.4, { squash: 0.7, rot: -20, edge: 1.2 }) + coin(130, 104, 5, { squash: 0.6, rot: 30 });
  // the head, the ear, a white tuft above it
  const ear = smooth([[34, 70], [22, 66], [16, 78], [22, 92], [34, 94]]);
  const head = headShape();
  const tuft = smooth([[22, 70], [16, 58], [20, 46], [30, 44], [40, 52], [42, 64], [32, 70]]);
  s += keyline([ear, head, tuft]);
  s += fill(ear, S.base) + line('M27 74q-5 6 0 13', S.shade, 1.6) + fill(head, S.base);
  s += inside(head, fill(smooth([[0, 40], [40, 50], [44, 130], [0, 130]]), S.shade) + fill(smooth([[60, 40], [100, 40], [118, 54], [90, 50]]), S.light));
  s += fill(tuft, WH.base) + inside(tuft, line('M22 56q8 2 14 8M24 64q6 0 10 4', WH.shade, 1.4));
  s += rim([ear, head, tuft], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // smug half-shut eyes, bushy white brows, rosy cheeks, a round red nose
  s += eyeE({ x0: 56, x1: 72, top: 60, bot: 71, slant: 0.7, nose: 1, px: 67, py: 67, pr: 3.8 });
  s += eyeE({ x0: 84, x1: 102, top: 58, bot: 70, slant: 0.7, nose: -1, px: 97, py: 65, pr: 4.2 });
  for (const d of [smooth([[50, 58], [54, 50], [64, 48], [74, 52], [76, 58], [64, 58]]), smooth([[82, 56], [88, 48], [100, 46], [110, 46], [112, 52], [98, 56]])]) s += part(d, WH.base, 3.4) + inside(d, line('M52 56q10-4 22 0M86 54q12-6 24-4', WH.shade, 1.2));
  s += fill(ellipse(66, 84, 8, 5), '#ff8a8a', 'opacity=".5"') + fill(ellipse(116, 82, 5, 4), '#ff8a8a', 'opacity=".5"');
  s += part(ellipse(108, 80, 7.4, 6.4), '#f2907e', 3) + fill(ellipse(106, 77, 2.6, 1.8), '#ffd0c4');
  // a grin with one gold tooth, under a big white walrus moustache
  const mouth = smooth([[76, 100, 1], [94, 103], [110, 98, 1], [106, 108], [94, 112], [80, 108]]);
  s += mouthE(93, 104, 32, fill(mouth, '#3a120c') + inside(mouth, fill(poly([[74, 97], [112, 95], [112, 103], [74, 105]]), '#fff') + fill(poly([[96, 96], [102, 96], [102, 104], [96, 104]]), '#ffc92e')) + line(mouth, INK, 1.8));
  const mus = smooth([[70, 92], [84, 86], [100, 88], [112, 84], [124, 88], [130, 98, 1], [120, 94], [110, 100], [96, 98], [84, 102], [72, 100], [60, 104, 1], [62, 96]]);
  s += part(mus, WH.base, 4) + inside(mus, fill(poly([[50, 98], [140, 94], [140, 110], [50, 110]]), WH.shade) + line('M76 92q10-4 22-2M100 90q10-4 20 0', WH.light, 1.4));
  // the tall top hat, tipped back: a gold band, a coin for a pin
  let h = '';
  const crown = smooth([[42, 38, 1], [44, 8, 1], [98, 4, 1], [100, 34, 1]], true, 0.15);
  h += part(crown, HT.base) + inside(crown, fill(poly([[40, 0], [56, 0], [56, 44], [40, 44]]), '#16121a') + line('M62 10Q80 6 92 8', HT.hi, 2) +
    fill(poly([[40, 22], [104, 20], [104, 30], [40, 32]]), '#ffc92e') + line('M40 23L104 21', '#fff0a0', 1.2));
  const brim = smooth([[22, 36, 1], [42, 36], [72, 34], [104, 30], [124, 26, 1], [118, 36], [100, 42], [72, 44], [42, 46], [26, 44]]);
  h += part(brim, HT.light, 5) + inside(brim, fill(poly([[0, 40], [144, 36], [144, 60], [0, 60]]), HT.base));
  h += coin(90, 26, 5);
  s += `<g transform="rotate(-6 72 40)">${h}</g>`;
  s += sparkle(124, 14, 4) + sparkle(16, 22, 3.4);
  return end(s);
}

export default {
  card: 33, champion: 'רגל הזהב', en: 'The Golden Foot', theme: 'Card: a go-kart race through Tokyo, coins, a mystery box · Power: the fastest shot, through a block (Critical)',
  options: [
    { letter: 'A', name: 'Golden Boot', draw: boot,
      blurb: 'The champion\'s own name, taken literally: a solid-gold football boot with a face on its side, the tongue standing up out of the ankle like a quiff, white laces, a blue lightning stripe, studs underneath. <i>Silhouette: a boot, toe to the opponent.</i>' },
    { letter: 'B', name: 'Banana Peel', draw: banana,
      blurb: 'The go-kart race\'s oldest trick: a banana half out of its peel, the flaps spread round it like a skirt, a sneaky grin because it is waiting for you to step on it. <i>Silhouette: a tall fruit in a burst of peel.</i>' },
    { letter: 'C', name: 'Ostrich', draw: ostrich,
      blurb: 'The strongest kick in the animal kingdom and the fastest runner on two legs: an ostrich with a huge lashed eye and a flat beak on top of a long neck, rising out of black-and-white plumes. <i>Silhouette: a small head high on a neck over a big plume.</i>' },
    { letter: 'D', name: 'Tycoon', draw: fitted(tycoon33, [1.05, 1, 0, 0]), marks: { eyes: [[64, 65.5], [93, 64]], nose: [108, 80] }, request: true,
      blurb: 'Your request: a rich tycoon in the Monopoly spirit (his own man, not the board game\'s mascot). A tall black top hat with a gold band and a coin for a pin, a big white walrus moustache over a grin with one gold tooth, bushy white brows, a round red nose, the card\'s coins flying. No monocle, so he doesn\'t repeat the Coin Tycoon you picked for #36. <i>Silhouette: a head under a tall top hat.</i>' },
  ],
};
