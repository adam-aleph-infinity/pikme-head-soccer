// Card #19 — הג'וקר (The Joker). Card: the Saltiz crew standing on a giant warty toad with
// burning eyes and a nose ring, ninja stars and lightning flying ("the most dangerous ride in
// the world"). Power: a curse that swaps left and right (Ailment: reverse; the aura reverses too).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, mouthE, expr, eyeE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the Joker card itself — its face printed twice, one upside down ----------------------
function card() {
  begin();
  const RD = '#d8283a', BK = '#1c1a22', GD = '#ffc92e', PU = '#7a3fc8';
  const body = smooth([[34, 6, 1], [112, 6, 1], [116, 10], [116, 110], [112, 114, 1], [34, 114, 1], [30, 110], [30, 10]], true, 0.35);
  let face = '';
  // one half of the court card: a grinning face under a band of purple and gold
  face += fill(smooth([[38, 10], [108, 10], [108, 22], [92, 26], [74, 22], [54, 26], [38, 22]]), PU) + line('M38 22Q56 28 74 22T108 22', GD, 1.6) +
    fill(poly([[70, 12], [74, 6], [78, 12], [74, 18]]), GD);
  face += eye({ x0: 50, x1: 66, top: 30, bot: 42, slant: 0.4, nose: 1, px: 61, py: 37, pr: 4 }) + eye({ x0: 80, x1: 98, top: 29, bot: 42, slant: 0.4, nose: -1, px: 92, py: 36, pr: 4.4 });
  face += line('M48 26L66 30M80 28L100 24', INK, 2.6);
  const grin = smooth([[52, 46, 1], [74, 52], [98, 45, 1], [92, 54], [74, 58], [58, 54]]);
  face += fill(grin, '#3a1612') + inside(grin, fill(poly([[50, 44], [100, 43], [100, 49], [50, 50]]), '#fff')) + line(grin, INK, 1.8) + line('M50 44q-4-2-4-6M100 43q4-2 4-6', INK, 1.6);
  let s = `<g transform="rotate(-6 73 60)">`;
  s += keyline(body) + fill(body, '#fbf7ee');
  s += inside(body, fill(poly([[30, 6], [44, 6], [44, 120], [30, 120]]), '#ece4d2') + line(smooth([[38, 12, 1], [108, 12, 1], [110, 14], [110, 106], [108, 108, 1], [38, 108, 1], [36, 106], [36, 14]], true, 0.35), RD, 1.2) +
    face + `<g transform="rotate(180 73 60)">${face}</g>` + line('M38 64L108 56', BK, 1.4));
  s += `<text x="38" y="20" font-family="Arial Black, Arial" font-weight="900" font-size="9" fill="${RD}">J</text>` + `<text x="38" y="20" font-family="Arial Black, Arial" font-weight="900" font-size="9" fill="${RD}" transform="rotate(180 73 60)">J</text>`;
  s += rim(body, poly([[0, 0], [60, 0], [36, 20], [32, 120], [0, 120]]), 2);
  s += '</g>';
  // the swap: arrows round it
  s += line('M128 30q12 30 0 60', '#ffd24a', 2.6) + part(poly([[128, 90], [122, 82], [132, 82]]), '#ffd24a', 2) + line('M16 90q-12-30 0-60', '#ffd24a', 2.6) + part(poly([[16, 30], [22, 38], [12, 38]]), '#ffd24a', 2);
  return end(s);
}

// ---- B: a ninja star from the card, spinning ---------------------------------------------------
function shuriken() {
  begin();
  const ST = { base: '#c9d2da', light: '#f1f5f8', shade: '#8a96a2', deep: '#5a6470' };
  const cx = 74, cy = 62;
  let s = fill(circle(cx, cy, 55.5), 'rgba(42,49,64,.55)') + line(circle(cx, cy, 55.5), 'rgba(160,190,220,.6)', 1.4);
  s += line(`M${cx - 50} ${cy - 20}A54 54 0 0 1 ${cx + 10} ${cy - 54}`, '#ffffff', 2, 'opacity=".6"') + line(`M${cx + 50} ${cy + 22}A54 54 0 0 1 ${cx - 12} ${cy + 54}`, '#ffffff', 2, 'opacity=".6"');
  // the headband's tails streaming behind
  s += part(smooth([[52, 46], [30, 36], [10, 34, 1], [26, 42], [14, 52, 1], [34, 50], [50, 54]]), '#e5262e', 4.4);
  const P = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const blades = [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4].map((a) => smooth([P(24, a - 0.55), P(40, a - 0.12), [...P(56, a + 0.16), 1], P(36, a + 0.42), P(24, a + 0.62)]));
  const hub = circle(cx, cy, 30);
  s += keyline([...blades, hub]);
  for (const d of blades) s += fill(d, ST.base) + inside(d, fill(poly([[cx, cy], [cx + 80, cy - 80], [cx + 80, cy + 80]]), ST.shade, 'opacity=".5"'));
  s += fill(hub, ST.base) + inside(hub, fill(circle(cx + 6, cy + 6, 30), ST.shade) + fill(circle(cx - 2, cy - 2, 26), ST.light));
  s += line(circle(cx, cy, 26.5), ST.deep, 1.2);
  s += rim([...blades, hub], poly([[0, 0], [70, 0], [40, 40], [20, 80], [0, 80]]), 2);
  // the headband across the hub, the face under it
  const band = smooth([[44, 44, 1], [104, 40, 1], [104, 50, 1], [44, 54, 1]], true, 0.3);
  s += inside(hub, fill(band, '#e5262e') + line('M44 47l60-4', '#ff7a7a', 1.2)) + line('M46 44L102 40M46 54L102 50', INK, 1.6);
  s += eye({ x0: 56, x1: 70, top: 56, bot: 66, slant: 0.5, nose: 1, px: 66, py: 62, pr: 3.6, r: 2.4 });
  s += eye({ x0: 78, x1: 94, top: 55, bot: 65, slant: 0.5, nose: -1, px: 89, py: 61, pr: 3.8, r: 2.4 });
  s += line('M64 76Q74 80 88 74', INK, 2.4) + line('M88 74l3-3', INK, 1.8);
  // lightning from the card
  for (const [x, y, k] of [[132, 20, 1], [10, 98, -1]]) s += part(poly([[x, y], [x - 6 * k, y + 10], [x - 1 * k, y + 9], [x - 5 * k, y + 18], [x + 4 * k, y + 6], [x - 1 * k, y + 7]]), '#ffe14a', 2.4);
  return end(s);
}

// ---- C: a chameleon whose eyes look two ways at once ------------------------------------------
function chameleon() {
  begin();
  const C = { base: '#8ad84a', light: '#c4f57a', shade: '#4f8a2a', deep: '#2f5a18', teal: '#3fc0a0', violet: '#a070ff' };
  let s = '';
  // the tail curled behind
  s += line('M30 104Q12 110 12 96Q12 86 22 88Q28 92 22 98', INK, 9) + line('M30 104Q12 110 12 96Q12 86 22 88Q28 92 22 98', C.base, 5);
  // the far eye turret peeking over, pointed backwards
  const farEye = circle(104, 24, 11);
  s += part(farEye, C.base) + inside(farEye, line(circle(104, 24, 7), C.shade, 1.4) + line(circle(104, 24, 3.6), C.shade, 1.4)) + part(circle(97, 19, 3.6), '#ffffff', 2.4) + fill(circle(96, 18, 2), '#0d0a0c');
  const head = smooth([[22, 96], [20, 66], [28, 38], [42, 16, 1], [62, 14], [86, 20], [108, 32], [126, 48], [136, 66], [134, 80], [118, 84], [96, 90], [104, 100], [92, 112], [64, 117], [36, 114]]);
  s += part(head, C.base);
  s += inside(head, fill(poly([[50, 0], [64, 0], [24, 130], [10, 130]]), C.teal) + fill(poly([[74, 0], [90, 0], [50, 130], [34, 130]]), C.violet, 'opacity=".85"') +
    fill(poly([[102, 0], [112, 0], [72, 130], [62, 130]]), C.teal, 'opacity=".8"') +
    fill(smooth([[0, 20], [34, 30], [30, 80], [40, 130], [0, 130]]), C.shade, 'opacity=".6"') + fill(smooth([[30, 104], [80, 110], [130, 96], [130, 130], [30, 130]]), C.shade, 'opacity=".7"') +
    line('M48 20Q84 18 122 46', C.light, 2.2));
  // bumps down the casque and along the jaw (the card's warty toad)
  for (const [x, y] of [[44, 22], [54, 20], [64, 20], [74, 22], [100, 92], [88, 100], [76, 106], [62, 110]]) s += fill(circle(x, y, 2.2), '#ffd24a') + line(circle(x, y, 2.2), INK, 0.8);
  s += rim(head, poly([[0, 0], [60, 0], [34, 30], [22, 80], [0, 100]]), 2.2);
  // the near turret, looking forward, while the far one looks back
  const nearEye = circle(80, 62, 16);
  s += part(nearEye, C.base) + inside(nearEye, fill(circle(86, 66, 16), C.shade) + line(circle(80, 62, 11.5), C.deep, 1.4) + line(circle(80, 62, 7.5), C.deep, 1.4));
  const E = expr();
  s += part(circle(90, 62, 5.2), '#ffffff', 2.6);
  if (E === 'happy' || E === 'hurt') s += part(circle(84, 62, 11), C.base, 3) + eyeE({ x0: 75, x1: 93, top: 56, bot: 68, nose: -1 });
  else s += fill(circle(91.6 + (E === 'kick' ? 0.8 : 0), 62 + (E === 'sad' ? 1.6 : 0), 3), '#0d0a0c') + fill(circle(92.6, 60.6 + (E === 'sad' ? 1.6 : 0), 1), '#fff');
  // a smirk, and the tongue shot out in a curl
  s += mouthE(114, 80, 30, line('M96 78Q116 82 134 74', INK, 2.4));
  if (E === 'normal' || E === 'kick') s += line('M132 76Q142 80 140 92Q138 100 130 98Q124 94 130 90', INK, 6) + line('M132 76Q142 80 140 92Q138 100 130 98Q124 94 130 90', '#ff7a96', 3.4) + part(circle(130, 90, 3.4), '#ff7a96', 2.4);
  s += sparkle(130, 30, 3.6) + sparkle(14, 50, 3);
  return end(s);
}

export default {
  card: 19, champion: 'הג\'וקר', en: 'The Joker', theme: 'Card: a giant warty toad, ninja stars, lightning · Power: a curse that swaps left and right (reverse)',
  options: [
    { letter: 'A', name: 'Joker Card', draw: card,
      blurb: 'The joker in the deck, and the power\'s swap as a picture: a playing card whose face is printed twice, once the right way up and once upside down, so you never know which way is which. <i>Silhouette: a tilted card.</i>' },
    { letter: 'B', name: 'Shuriken', draw: shuriken,
      blurb: 'A ninja star from the card, mid-spin: four curved steel blades in a blur, a red headband tied round its hub with the tails streaming, a narrow-eyed smirk, the card\'s lightning crackling. <i>Silhouette: an X of blades in a spinning disc.</i>' },
    { letter: 'C', name: 'Two-Way Chameleon', draw: fitted(chameleon, [1.01, 1.03, 0, 0]), marks: { eyes: [[97, 19], [90, 62]], nose: [120, 70] },
      blurb: 'The card\'s warty reptile, as a trickster: a chameleon in shifting bands of green, teal and violet, one turret eye looking forward and the other looking back, its tongue shot out in a curl. <i>Silhouette: a pointed casque and a curled tail.</i>' },
  ],
};
