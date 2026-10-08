// Card #36 — הופך העולמות (The World Flipper). Card: Ori with a gold iPhone and gold coins ("a
// day as my girlfriend's best friend, but I may only pay in agorot"). Power: gravity flips, the
// ball falls up and back down and the world turns upside down (Up-and-Down, reverse).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, coin, sparkle, INK, fitted } from './kit.js';
import card06 from './card-06.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };
const upCoin = (x, y, r, rot) => coin(x, y, r, { rot, squash: 0.8 }) + line(`M${x - r * 0.6} ${y + r + 3}v6M${x + r * 0.6} ${y + r + 3}v6`, '#ffffff', 1.4, 'opacity=".6"');

// ---- A: the card's gold phone, hanging upside down — its face still the right way up -----------
function phone() {
  begin();
  let s = upCoin(16, 22, 6, 20) + upCoin(130, 14, 5, -30) + upCoin(136, 60, 4, 10);
  // upside down: the side button on the left, the notch at the bottom
  s += part(smooth([[26, 40, 1], [32, 40, 1], [32, 58, 1], [26, 58, 1]], true, 0.3), G.shade, 3);
  const body = smooth([[32, 4, 1], [116, 4, 1], [116, 117.5, 1], [32, 117.5, 1]], true, 0.25);
  s += part(body, G.base) + inside(body, fill(poly([[100, 0], [120, 0], [120, 120], [100, 120]]), G.light, 'opacity=".5"') + fill(poly([[28, 0], [44, 0], [44, 120], [28, 120]]), G.shade, 'opacity=".6"'));
  const screen = smooth([[38, 10, 1], [110, 10, 1], [110, 111.5, 1], [38, 111.5, 1]], true, 0.2);
  s += fill(screen, '#1a1a2e') + inside(screen, fill(smooth([[30, 0], [120, 0], [120, 70], [70, 50], [30, 70]]), '#3a2a6a', 'opacity=".8"') + fill(poly([[40, 10], [62, 10], [40, 60]]), '#ffffff', 'opacity=".12"'));
  s += line(screen, INK, 1.6);
  // the notch and the status bar, upside down
  s += fill(smooth([[62, 101, 1], [86, 101, 1], [86, 107, 1], [62, 107, 1]], true, 0.5), '#05050a');
  s += `<g transform="rotate(180 74 106)">` + fill(poly([[96, 104], [106, 104], [106, 108], [96, 108]]), '#ffffff', 'opacity=".8"') + fill(poly([[42, 105], [44, 105], [44, 108], [42, 108], [46, 104], [48, 104], [48, 108], [46, 108], [50, 103], [52, 103], [52, 108], [50, 108]]), '#ffffff', 'opacity=".8"') + '</g>';
  s += rim(body, poly([[0, 0], [60, 0], [36, 20], [32, 120], [0, 120]]), 2, G.light);
  // its face on the screen, auto-rotated, grinning about it
  s += eye({ x0: 48, x1: 68, top: 40, bot: 55, slant: 0.25, nose: 1, px: 62, py: 48, pr: 5 });
  s += eye({ x0: 80, x1: 100, top: 39, bot: 54, slant: 0.25, nose: -1, px: 94, py: 47, pr: 5.2 });
  s += line('M46 34q10-5 22-2M80 33q10-5 22-1', '#ffffff', 2.2);
  const mouth = smooth([[56, 66, 1], [74, 68], [92, 64, 1], [88, 76], [74, 80], [60, 76]]);
  s += fill(mouth, '#ff5a8a') + inside(mouth, fill(poly([[54, 63], [94, 62], [94, 68], [54, 69]]), '#fff')) + line(mouth, '#ffffff', 1.6);
  s += line('M54 88l6-4l6 4M82 88l6-4l6 4', '#ffd24a', 1.6, 'opacity=".8"');
  return end(s);
}

// ---- B: a lava lamp, blobs rising and sinking ---------------------------------------------------
function lavaLamp() {
  begin();
  const L = { liquid: '#5a2aa8', liquid2: '#7a4ad0', blob: '#ff6a9a', blobL: '#ffb0c8' };
  let s = '';
  const cap = poly([[58, 22], [90, 22], [84, 4], [64, 4]]), base = poly([[50, 92], [98, 92], [116, 117.5], [32, 117.5]]);
  const glass = smooth([[58, 22, 1], [90, 22, 1], [102, 44], [108, 62], [102, 80], [98, 92, 1], [50, 92, 1], [46, 80], [40, 62], [46, 44]]);
  s += keyline([cap, base, glass]);
  s += fill(glass, L.liquid) + inside(glass, fill(smooth([[30, 20], [60, 30], [50, 80], [60, 100], [30, 100]]), '#3e1a7a') +
    // the blobs: one rising at the top like hair, one tearing off, one sinking
    fill(smooth([[58, 24], [90, 24], [94, 34], [84, 42], [70, 40], [60, 34]]), L.blob) + fill(smooth([[60, 28], [74, 28], [68, 32]]), L.blobL) +
    fill(ellipse(96, 50, 6, 7), L.blob) + fill(ellipse(52, 84, 9, 6), L.blob) + fill(ellipse(88, 86, 10, 5), L.blob) +
    fill(poly([[46, 30], [52, 30], [46, 84], [42, 84]]), '#ffffff', 'opacity=".25"'));
  s += line(glass, INK, 1.2);
  s += fill(cap, G.base) + inside(cap, fill(poly([[56, 0], [70, 0], [66, 30], [56, 30]]), G.shade)) + line(cap, INK, 1.2);
  s += fill(base, G.base) + inside(base, fill(poly([[30, 92], [56, 92], [48, 120], [30, 120]]), G.shade) + line('M44 104h60', G.light, 1.4)) + line(base, INK, 1.2);
  s += rim([glass, base], poly([[0, 0], [70, 0], [48, 30], [40, 80], [30, 120], [0, 120]]), 2, '#ffb0c8');
  // its face floating in the wax
  s += eye({ x0: 52, x1: 68, top: 52, bot: 64, slant: 0.2, nose: 1, px: 63, py: 59, pr: 4, white: '#fff0f6' });
  s += eye({ x0: 78, x1: 96, top: 51, bot: 63, slant: 0.2, nose: -1, px: 90, py: 58, pr: 4.4, white: '#fff0f6' });
  s += line('M64 72Q74 78 86 70', '#fff0f6', 2.4);
  s += line('M18 30v-10l-4 4M18 20l4 4M130 90v10l-4-4M130 100l4-4', '#ffb0c8', 1.6);
  return end(s);
}

// ---- C: a piggy bank, its agorot falling upwards out of the slot -------------------------------------
function piggy() {
  begin();
  const P = { base: '#ff9ac0', light: '#ffc2dd', hi: '#fff0f6', shade: '#e06a98', deep: '#b8487a' };
  let s = upCoin(62, 8, 6, 20) + upCoin(78, 2, 5, -10) + upCoin(48, 18, 4.4, 40);
  // stubby legs, ears
  for (const x of [40, 96]) s += part(smooth([[x - 8, 100, 1], [x + 8, 100, 1], [x + 7, 117.5, 1], [x - 7, 117.5, 1]], true, 0.4), P.shade, 4);
  s += part(poly([[36, 40], [30, 18], [54, 32]]), P.shade) + part(poly([[84, 30], [100, 10], [104, 36]]), P.base);
  const body = smooth([[20, 72], [26, 48], [46, 32], [76, 28], [104, 34], [122, 50], [128, 72], [122, 94], [100, 108], [70, 110], [40, 104], [24, 92]]);
  s += part(body, P.base);
  s += inside(body, fill(smooth([[0, 30], [40, 40], [34, 80], [40, 130], [0, 130]]), P.shade) + fill(smooth([[60, 30], [100, 34], [116, 48], [86, 44]]), P.light) + line('M64 32q26-4 44 12', P.hi, 3) +
    fill(smooth([[20, 96], [70, 106], [130, 92], [130, 130], [20, 130]]), P.shade) +
    // painted flowers on the glaze
    [[36, 64], [46, 86]].map(([x, y]) => [0, 1, 2, 3, 4].map((i) => fill(circle(x + Math.cos(i * 1.256) * 3.4, y + Math.sin(i * 1.256) * 3.4, 2.2), '#ffffff')).join('') + fill(circle(x, y, 1.8), '#ffd24a')).join(''));
  // the slot on top
  s += fill(smooth([[58, 31, 1], [82, 29, 1], [82, 33, 1], [58, 35, 1]], true, 0.4), INK);
  s += rim(body, poly([[0, 0], [70, 0], [40, 36], [20, 80], [0, 90]]), 2, P.hi);
  // the snout and a pleased face
  const snout = ellipse(120, 74, 12, 14);
  s += part(snout, '#ff7aaa', 4.4) + fill(ellipse(117, 70, 2.4, 3.4), P.deep) + fill(ellipse(124, 76, 2.4, 3.4), P.deep);
  s += eye({ x0: 64, x1: 80, top: 54, bot: 66, slant: 0.2, nose: 1, px: 75, py: 61, pr: 4 });
  s += eye({ x0: 90, x1: 106, top: 52, bot: 64, slant: 0.2, nose: -1, px: 101, py: 59, pr: 4.2 });
  s += line('M62 48q8-4 18-1M90 46q8-4 18 0', INK, 2.4);
  s += line('M82 86Q94 92 106 86', INK, 2.2) + fill(ellipse(68, 76, 5, 3.4), '#ff6a9a', 'opacity=".6"');
  return end(s);
}

export default {
  card: 36, champion: 'הופך העולמות', en: 'The World Flipper', theme: 'Card: a gold iPhone, paid for in agorot · Power: gravity flips, the world turns over (Up-and-Down, reverse)',
  options: [
    { letter: 'A', name: 'Flip Phone', draw: phone,
      blurb: 'The card\'s gold phone, hanging upside down (notch at the bottom, status bar flipped, button on the wrong side) while its screen face stays the right way up, coins floating up round it. <i>Silhouette: a tall gold slab.</i>' },
    { letter: 'B', name: 'Lava Lamp', draw: lavaLamp,
      blurb: 'Up and down, forever: a lava lamp in a gold base, pink wax rising to the top like hair, one blob tearing off, another sinking, its face floating in the violet. <i>Silhouette: a waisted glass between a cone cap and a cone base.</i>' },
    { letter: 'C', name: 'Piggy Bank', draw: piggy,
      blurb: 'Where the card\'s agorot live: a glazed pink piggy bank with painted flowers, its coins falling upwards out of the slot because gravity has flipped. <i>Silhouette: a round pig with a snout and stubby legs.</i>' },
    { letter: 'D', name: 'Coin Tycoon (6B)', draw: fitted(card06.options[1].draw, [1.05, 1, 0, -1]), marks: { eyes: [[58, 65], [97, 60.5]], nose: [89, 79] }, request: true,
      blurb: 'Your request: 6B, the Coin Tycoon, moved to this card. <i>Silhouette: a gold coin in a top hat.</i>' },
  ],
};
