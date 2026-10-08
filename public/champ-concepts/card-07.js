// Card #7 — הקפצן (The Bouncer). Card: Shoval yelling inside a glass box knee-deep in gold
// coins under a spotlight ("lift as many agorot as you can, get them back in notes"). Power: a
// pogo spring that boings the shot straight up and drops it in (Aerial).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, coin, sparkle, def, INK, fitted, eyeE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the money toad, the jumper that brings luck ------------------------------------
function toad() {
  begin();
  const J = { base: '#3fae7a', light: '#6fd39b', hi: '#c3f2cf', shade: '#23774f', deep: '#155238', belly: '#d9efb2', bellyS: '#a9cf86' };
  const body = smooth([[14, 110], [8, 92], [12, 74], [26, 58], [46, 48], [76, 45], [106, 47], [126, 56], [138, 72], [139, 94], [132, 109], [112, 115], [74, 116], [34, 115]]);
  const domeB = circle(48, 36, 17), domeF = circle(101, 29, 20);
  let s = keyline([body, domeB, domeF]);
  s += fill(body, J.base) + fill(domeB, J.base) + fill(domeF, J.base);
  const all = [body, domeB, domeF];
  // the mouth line splits the head: the pale throat under it
  const mouthD = 'M28 86Q60 92 96 86T138 72';
  s += inside(all,
    fill(smooth([[0, 30], [40, 48], [30, 80], [40, 130], [0, 130]]), J.shade) +
    fill(smooth([[70, 50], [118, 52], [134, 66], [116, 74], [84, 68]]), J.light) +
    fill(`M20 88Q60 94 96 88T144 74V140H20Z`, J.belly) + fill('M20 104Q70 112 144 100V140H20Z', J.bellyS) +
    line('M78 52q22-4 40 6', J.hi, 2.4) + line(ellipse(48, 36, 15, 15), J.light, 2, 'stroke-dasharray="18 80" stroke-dashoffset="-48"'));
  s += rim(all, poly([[0, 0], [80, 0], [60, 46], [24, 62], [6, 110], [0, 110]]), 2.4);
  // gold warts down the back
  for (const [x, y, r] of [[28, 70, 4.2], [40, 60, 3], [62, 55, 3.4], [83, 53, 2.6], [20, 86, 3.2], [36, 79, 2.4], [52, 68, 2.2], [16, 100, 2.4]]) {
    s += fill(circle(x, y, r), '#ffc92e') + line(circle(x, y, r), '#8a5406', 0.9) + fill(circle(x - r * 0.3, y - r * 0.3, r * 0.35), '#fff2b0');
  }
  // the eyes on top: gold-lidded, half shut, greedy
  for (const [cx, cy, r, px, nose] of [[49, 35, 11.5, 55, 1], [102, 28, 14, 109, -1]]) {
    const ball = circle(cx, cy, r);
    const yl = cy - r * (nose > 0 ? 0.5 : 0.05), yr = cy - r * (nose > 0 ? 0.05 : 0.5);
    s += fill(ball, '#fff') + inside(ball, fill(circle(px, cy + 2.5, r * 0.56), '#0d0a0c') + fill(circle(px + r * 0.2, cy, r * 0.17), '#fff') +
      fill(poly([[cx - r - 2, cy - r - 3], [cx + r + 2, cy - r - 3], [cx + r + 2, yr], [cx - r - 2, yl]]), '#ffc92e') +
      line(`M${cx - r} ${yl - 3}L${cx + r} ${yr - 3}`, '#fff0a0', 2) + line(`M${cx - r - 2} ${yl + 1.6}L${cx + r + 2} ${yr + 1.6}`, '#b9b4c4', 1.6));
    s += line(ball, INK, 1.4) + line(`M${cx - r - 1} ${yl}L${cx + r + 1} ${yr}`, INK, 2.8);
  }
  s += fill(circle(124, 62, 1.6), J.deep) + fill(circle(132, 59, 1.6), J.deep);
  // the long grin, curled up at the back corner
  s += line(mouthD, INK, 2.6) + line('M28 86q-6-2-6-8', INK, 2.4) + line('M34 92q20 6 50 2', J.bellyS, 1.6);
  // the cash coin in its lips, a red cord and tassel through the square hole
  s += line('M112 86Q118 100 116 110', '#c81e2e', 2.4) + fill(smooth([[112, 106], [121, 106], [123, 120, 1], [117, 116], [110, 120, 1]]), '#d8283a') + line('M110 120L113 108M117 118V108M122 120L120 108', '#8e1420', 1) + fill(ellipse(116.5, 106, 5, 2.6), '#e8b52a') + line(ellipse(116.5, 106, 5, 2.6), INK, 1);
  s += coin(112, 82, 14, { rot: -12, mark: 'hole', edge: 2 });
  s += line('M100 84q8 4 22-2', J.base, 3) + line('M100 84q8 4 22-2', INK, 1.4);
  s += sparkle(130, 10, 4.5) + sparkle(20, 22, 3.5) + sparkle(134, 98, 3);
  return end(s);
}

// ---- B: a tin bank-robot whose skull is the card's glass box of coins ------------------
function bot() {
  begin();
  const T = { base: '#f1e4c3', light: '#fff6dd', shade: '#cdb68a', deep: '#a48b5e' };
  const TE = { base: '#2fa39a', shade: '#1f746e', light: '#5fd0c4' };
  const RD = { base: '#d8402e', shade: '#a12a1d', light: '#f27a62' };
  const CH = { base: '#c9d2da', shade: '#8a96a2', light: '#f1f5f8' };
  // spring ears with red knobs, behind everything
  let s = '';
  const coil = (x0, x1, y, dir) => {
    let o = '';
    const n = 5, step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + step * (i + 0.5);
      o += line(ellipse(x, y, Math.abs(step) * 0.75, 7.5), INK, 4.6) + line(ellipse(x, y, Math.abs(step) * 0.75, 7.5), i % 2 ? CH.shade : CH.base, 2.2);
    }
    return o;
  };
  s += coil(22, 6, 82, -1) + coil(124, 138, 80, 1);
  for (const [x, y] of [[5, 82], [139, 80]]) s += part(circle(x, y, 5.6), RD.base, 5) + fill(circle(x - 1.5, y - 2, 1.8), RD.light);
  // the tin face
  const head = smooth([[20, 66, 1], [22, 56], [32, 52, 1], [118, 52, 1], [127, 56], [129, 66, 1], [129, 104], [124, 113], [112, 115.5, 1], [36, 115.5, 1], [24, 113], [20, 104]]);
  s += part(head, T.base);
  s += inside(head, fill(poly([[0, 40], [40, 40], [40, 130], [0, 130]]), TE.base) + fill(poly([[0, 40], [28, 40], [28, 130], [0, 130]]), TE.shade) +
    fill(poly([[0, 102], [144, 100], [144, 130], [0, 130]]), RD.base) + fill(poly([[0, 110], [144, 108], [144, 130], [0, 130]]), RD.shade) +
    fill(poly([[96, 58], [124, 58], [124, 98], [110, 98]]), T.light) + line('M40 52V102', INK, 1.2) + line('M0 101H144', INK, 1.2));
  for (const [x, y] of [[30, 60], [30, 94], [46, 108], [72, 109], [98, 109], [120, 106], [122, 62]]) s += fill(circle(x, y, 1.6), x < 40 ? TE.light : y > 100 ? RD.light : T.deep) + line(circle(x, y, 1.6), INK, 0.6);
  // a jackpot meter on the cheek
  s += fill(circle(30, 78, 6.5), '#fff') + line(circle(30, 78, 6.5), INK, 1.4) + line('M30 78l3.5-4', RD.base, 1.6) + line('M25 76a5.5 5.5 0 0 1 8-3.5', '#e2a63a', 1.1);
  // porthole eyes with metal shutters slanted into a glare
  const E = expr();
  for (const [cx, cy, r, px0, nose] of [[64, 76, 11.5, 69, 1], [101, 74, 13.5, 107, -1]]) {
    const ball = circle(cx, cy, r);
    s += part(circle(cx, cy, r + 3.4), CH.base, 4) + inside(circle(cx, cy, r + 3.4), fill(circle(cx + 2, cy + 2.5, r + 3.4), CH.shade) + fill(circle(cx, cy, r + 0.5), CH.light));
    if (E === 'happy' || E === 'hurt') { s += fill(ball, '#fff') + inside(ball, eyeE({ x0: cx - r * 0.62, x1: cx + r * 0.62, top: cy - r * 0.42, bot: cy + r * 0.42, nose })) + line(ball, INK, 1.4); continue; }
    // the shutters: lower at the nose (a glare), lower still for a kick, lower at the outside when sad
    const hi = E === 'kick' ? 1.0 : 0.9, lo = E === 'kick' ? 0.05 : 0.3, inner = E === 'sad' ? -nose : nose;
    const yl = cy - r * (inner > 0 ? hi : lo), yr = cy - r * (inner > 0 ? lo : hi);
    const px = px0 + (E === 'kick' ? 2 : 0), py = cy + 1.5 + (E === 'sad' ? 3 : 0);
    s += fill(ball, '#fff') + inside(ball, fill(circle(px, py, r * 0.55), '#0d0a0c') + fill(circle(px + r * 0.22, py - r * 0.1 - 1.5, r * 0.17), '#fff') +
      fill(poly([[cx - r - 2, cy - r - 3], [cx + r + 2, cy - r - 3], [cx + r + 2, yr], [cx - r - 2, yl]]), TE.base) + line(`M${cx - r} ${yl - 2.5}L${cx + r} ${yr - 2.5}`, TE.light, 1.6));
    s += line(ball, INK, 1.4) + line(`M${cx - r - 1} ${yl}L${cx + r + 1} ${yr}`, INK, 2.6);
  }
  // a yelling grille mouth (the card's scream), a coin on the tongue
  const mouth = smooth([[70, 88, 1], [114, 86, 1], [113, 102], [104, 106, 1], [80, 107, 1], [72, 102]]);
  s += mouthE(92, 96, 44, fill(mouth, '#3a1612') + inside(mouth, fill(ellipse(92, 108, 16, 7), RD.light) + coin(92, 104, 5.5, { squash: 0.55, mark: 'none' }) +
    line('M78 86v8M86 86v8M94 86v8M102 86v8M110 86v8', CH.base, 2.6)) + line(mouth, INK, 1.8));
  // the chrome band and the glass box of coins on top
  const band = smooth([[24, 49, 1], [124, 49, 1], [124, 56, 1], [24, 56, 1]]);
  const glass = poly([[34, 50], [34, 12], [24, 6], [108, 6], [118, 12], [118, 50]]);
  s += keyline(glass, 5.4);
  s += fill(glass, '#20323c');
  const pile = [];
  for (let i = 0; i < 22; i++) { const x = 30 + ((i * 37) % 88), y = 50 - ((i * 13) % 22) * 0.9 - (Math.abs(x - 74) < 26 ? 4 : 0); pile.push(coin(x, y, 6.2, { squash: 0.45 + ((i * 7) % 5) * 0.08, rot: ((i * 29) % 40) - 20, mark: 'none' })); }
  s += inside(glass, fill('M20 54V36Q50 26 74 28T124 32V54Z', '#b4780a') + pile.join('') +
    coin(52, 22, 5, { rot: 30, squash: 0.7 }) + coin(96, 18, 4.5, { rot: -20, squash: 0.8, mark: 'none' }) +
    fill(poly([[24, 6], [34, 12], [34, 50], [24, 44]]), 'rgba(170,230,245,.38)') + fill(poly([[24, 6], [108, 6], [118, 12], [34, 12]]), 'rgba(200,240,250,.55)') +
    fill(poly([[34, 12], [118, 12], [118, 50], [34, 50]]), 'rgba(150,220,240,.18)') +
    fill(poly([[46, 12], [58, 12], [42, 50], [30, 50]]), 'rgba(255,255,255,.35)') + fill(poly([[62, 12], [66, 12], [50, 50], [46, 50]]), 'rgba(255,255,255,.3)'));
  s += line('M34 50V12L24 6M34 12H118M118 12L108 6', '#effbff', 1.4) + line(glass, '#e6f7fb', 0.8);
  // the coin slot on the lid, a coin dropping in
  s += fill(poly([[62, 7.5], [80, 7.5], [82, 10], [60, 10]]), INK);
  s += coin(71, 2.5, 6.5, { squash: 0.5, rot: 90, mark: 'none' });
  s += part(band, CH.base, 4.6) + inside(band, fill(poly([[0, 53], [144, 53], [144, 60], [0, 60]]), CH.shade) + line('M30 51H120', CH.light, 1.2));
  s += rim([head], poly([[0, 50], [60, 50], [30, 70], [10, 120], [0, 120]]), 2.2);
  s += sparkle(130, 30, 4.5) + sparkle(14, 34, 3.5);
  return end(s);
}

// ---- C: Jack-Pot — the jack-in-the-box that springs out of the prize box ----------------
function jack() {
  begin();
  const PU = { base: '#7a3fc8', shade: '#52288f', light: '#a274e6', hi: '#d2b8ff' };
  const GO = { base: '#ffc22e', shade: '#d48a0c', light: '#ffe27a', hi: '#fff6c8' };
  const PO = { base: '#fbf1e6', light: '#ffffff', shade: '#ead2c2', deep: '#cfae9c' };
  let s = '';
  // the spring it sits on
  for (const [y, rx] of [[116, 34], [110, 38], [104, 41]]) {
    const d = ellipse(76, y, rx, 5.2);
    s += line(d, INK, 6.6) + line(d, '#c9d2da', 3) + line(`M${76 - rx * 0.7} ${y + 3.6}Q76 ${y + 6.4} ${76 + rx * 0.7} ${y + 3.6}`, '#f1f5f8', 1.2);
  }
  // the two horns of the cap, each ending in a coin for a bell
  const hornB = smooth([[40, 50], [28, 32], [18, 16], [8, 12], [2, 22], [5, 42, 1], [12, 30], [20, 28], [34, 40], [56, 40]]);
  const hornF = smooth([[86, 38], [100, 18], [118, 6], [134, 8], [142, 20], [140, 40, 1], [132, 26], [124, 22], [112, 34], [112, 50]]);
  const face = smooth([[32, 62], [40, 46], [60, 38], [92, 38], [114, 48], [123, 66], [121, 86], [110, 102], [88, 111], [62, 111], [42, 102], [31, 86]]);
  s += part(hornB, PU.base) + inside(hornB, fill(smooth([[0, 20], [20, 30], [44, 46], [30, 60], [0, 50]]), PU.shade) + line('M14 16q10 0 18 14', PU.hi, 2));
  s += part(hornF, GO.base) + inside(hornF, fill(smooth([[110, 30], [126, 26], [144, 30], [144, 60], [110, 60]]), GO.shade) + line('M104 18q14-12 30-8', GO.hi, 2.2));
  s += coin(6, 47, 6.5, { rot: -20 }) + coin(139, 45, 6.5, { rot: 15 });
  s += part(face, PO.base);
  s += inside(face, fill(smooth([[20, 40], [48, 50], [42, 80], [52, 120], [20, 120]]), PO.shade) + fill(smooth([[30, 96], [70, 104], [110, 98], [130, 120], [30, 120]]), PO.shade) +
    line('M92 54q18 4 24 20', PO.light, 3) + line('M100 58q8 2 12 8', '#fff', 1.6));
  // the cap band: harlequin diamonds
  const band = smooth([[30, 56, 1], [44, 42], [74, 34], [104, 40], [122, 54, 1], [120, 62, 1], [100, 50], [74, 45], [48, 52], [32, 64, 1]]);
  let dia = '';
  for (let i = 0; i < 8; i++) { const x = 30 + i * 13; dia += fill(poly([[x, 48], [x + 6.5, 36], [x + 13, 48], [x + 6.5, 60]]), i % 2 ? GO.base : PU.base); }
  s += part(band, PU.base, 5) + inside(band, dia + line('M30 50Q74 34 122 52', '#ffffff', 0.9, 'opacity=".5"'));
  s += rim([hornB, face], poly([[0, 0], [70, 0], [40, 50], [28, 100], [0, 100]]), 2.2);
  // painted face: rosy cheeks, a diamond and a star under the eyes, high arched brows
  s += fill(ellipse(52, 86, 8, 6), '#ff8a96') + fill(ellipse(114, 82, 6, 6), '#ff8a96');
  s += line('M48 60q10-8 22-3', INK, 2.6) + line('M84 56q12-7 24 0', INK, 2.6);
  s += eye({ x0: 50, x1: 70, top: 63, bot: 78, slant: 0.05, nose: 1, px: 64, py: 70, pr: 4.4, lidW: 2.2 });
  s += eye({ x0: 84, x1: 107, top: 60, bot: 77, slant: 0.05, nose: -1, px: 100, py: 68, pr: 4.8, lidW: 2.2 });
  // a red ball nose, and the huge yelling grin
  s += part(circle(110, 80, 5.2), '#e8323e', 3.2) + fill(circle(108.5, 78.5, 1.6), '#ffb0b6');
  const mouth = smooth([[64, 86, 1], [90, 88], [118, 84, 1], [112, 98], [96, 106], [80, 106], [68, 98]]);
  s += fill(mouth, '#5a1014') + inside(mouth, fill(poly([[60, 80], [124, 80], [124, 92], [60, 92]]), '#fff') + line('M74 86v6M84 87v6M94 87v6M104 86v6', '#d8d0d4', 1) + fill(ellipse(92, 106, 13, 6), '#e8506a'));
  s += line(mouth, INK, 2) + line('M62 84q-3 3-1 6M120 82q3 3 1 6', INK, 1.6);
  s += sparkle(64, 18, 4) + sparkle(24, 94, 3) + sparkle(132, 96, 3.5);
  return end(s);
}

export default {
  card: 7, champion: 'הקפצן', en: 'The Bouncer', theme: 'Card: a glass box of coins · Power: pogo spring (Aerial)',
  options: [
    { letter: 'A', name: 'Jackpot Toad', draw: toad,
      blurb: 'The lucky money toad of the old legends: a jumper by nature, a gold coin held in its grin with a red tassel, gold warts down its jade back, gold-lidded greedy eyes on top. <i>Silhouette: very wide and flat, two eye domes.</i>' },
    { letter: 'B', name: 'Coin-Brain Bot', draw: fitted(bot, [0.99, 0.98, 0, 0]), marks: { eyes: [[64, 76], [101, 74]], nose: [88, 85] },
      blurb: 'A tin money-box robot whose skull is the card\'s glass box, heaped with coins, a coin dropping into the slot on top. Coil-spring ears, porthole eyes with metal shutters, a yelling grille mouth. <i>Silhouette: a box on a box with springs at the sides.</i>' },
    { letter: 'C', name: 'Jack-Pot', draw: jack,
      blurb: 'The jack-in-the-box from the prize box, bouncing on its spring. A lacquered toy face in a manic yell, a two-horned jester cap with gold coins for bells. <i>Silhouette: two curling horns over a round face on a coil.</i>' },
  ],
};
