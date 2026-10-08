// Card #40 — רוח הרפאים (The Phantom). Card: Shoval with a giant glowing rainbow gummy snake
// coiled round him in a candy store at night ("whoever gets fattest in a candy store overnight
// wins 10,000"). Power: ghost balls fly alongside the real one, and any may score (Multi-Ball, stun).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const sugar = (n, x0, y0, w, h) => Array.from({ length: n }, (_, i) => fill(poly([[0, 0], [1.6, 0], [1.6, 1.6], [0, 1.6]].map(([a, b]) => [x0 + ((i * 37) % w) + a, y0 + ((i * 23) % h) + b])), '#ffffff', 'opacity=".8"')).join('');

// ---- A: the card's rainbow gummy snake ---------------------------------------------------------------
function snake() {
  begin();
  const bands = ['#ff4a5a', '#ff9a3a', '#ffe14a', '#5ae05a', '#4ab8ff'];
  let s = '';
  // its body coiled at the bottom, in rainbow bands, sugared
  const coil = 'M60 70Q20 70 14 92Q10 114 56 116Q110 118 132 104Q142 94 128 86';
  s += line(coil, INK, 26) + bands.map((c, i) => line(coil, c, 20, `stroke-dasharray="9 36" stroke-dashoffset="${-i * 9}"`)).join('') + line(coil, '#ffffff', 2, 'opacity=".45"') + sugar(16, 16, 92, 116, 22);
  // the head rearing up, fangs out
  const head = smooth([[40, 74], [44, 46], [62, 26], [92, 20], [118, 30], [134, 48], [138, 64], [128, 76], [100, 82], [70, 84], [50, 82]]);
  s += part(head, '#5ae05a');
  s += inside(head, fill(poly([[0, 0], [70, 0], [70, 120], [0, 120]]), '#4ab8ff', 'opacity=".9"') + fill(poly([[40, 0], [70, 0], [70, 120], [40, 120]]), '#3ac8a8', 'opacity=".8"') +
    fill(smooth([[70, 22], [110, 24], [130, 42], [100, 38]]), '#b8ff9a') + line('M74 24q30-4 50 16', '#ffffff', 2.4, 'opacity=".8"') + sugar(14, 46, 30, 84, 44));
  s += rim(head, poly([[0, 0], [80, 0], [50, 30], [36, 80], [0, 90]]), 2, '#ffffff');
  // big gleaming eyes, an open mouth with two fangs and a forked tongue
  s += eye({ x0: 66, x1: 84, top: 38, bot: 52, slant: 0.35, nose: 1, px: 79, py: 46, pr: 4.8 });
  s += eye({ x0: 96, x1: 116, top: 36, bot: 51, slant: 0.35, nose: -1, px: 110, py: 44, pr: 5.2 });
  s += line('M62 32L86 38M94 36L120 28', INK, 3);
  const mouth = smooth([[84, 62, 1], [112, 60], [136, 58, 1], [128, 70], [108, 74], [92, 72]]);
  s += fill(mouth, '#5a0a2a') + inside(mouth, fill(ellipse(110, 74, 16, 5), '#ff7aa8')) + line(mouth, INK, 2);
  s += part(poly([[100, 61], [105, 61], [102.5, 69]]), '#ffffff', 1.8) + part(poly([[120, 59.5], [125, 59], [122.5, 67]]), '#ffffff', 1.8);
  s += line('M134 64L142 68L146 64M142 68L146 72', '#ff4a7a', 2);
  s += sparkle(20, 24, 4, '#ff9ad8') + sparkle(130, 10, 3.4, '#9ff0ff');
  return end(s);
}

// ---- B: a see-through gummy bear, its ghosts trailing it --------------------------------------------------
function bear() {
  begin();
  const shape = (dx) => [circle(40 + dx, 30, 13), circle(96 + dx, 26, 13), smooth([[24 + dx, 76], [28 + dx, 46], [48 + dx, 30], [80 + dx, 28], [104 + dx, 36], [118 + dx, 56], [126 + dx, 74], [118 + dx, 98], [94 + dx, 112], [64 + dx, 116.5], [38 + dx, 110], [26 + dx, 96]])];
  let s = '';
  // two ghost copies behind it: the phantom balls
  for (const [dx, c, o] of [[-16, '#ff4a5a', 0.28], [-8, '#ff9a3a', 0.4]]) s += `<g opacity="${o}">` + shape(dx).map((d) => fill(d, c)).join('') + '</g>';
  const ds = shape(0);
  s += keyline(ds) + ds.map((d) => fill(d, 'rgba(106,224,90,.92)')).join('');
  s += inside(ds, fill(smooth([[0, 20], [40, 34], [34, 80], [40, 130], [0, 130]]), 'rgba(58,168,58,.8)') + fill(ellipse(76, 72, 30, 26), 'rgba(184,255,154,.55)') +
    fill(smooth([[60, 30], [96, 32], [112, 46], [84, 42]]), '#d8ffc8') + line('M62 32q24-4 42 12', '#ffffff', 2.6) + fill(circle(34, 26, 4), '#d8ffc8') + sugar(10, 30, 40, 90, 70));
  s += rim(ds, poly([[0, 0], [70, 0], [40, 40], [20, 80], [0, 90]]), 2, '#ffffff');
  // a moulded little face
  s += eyeE({ x0: 56, x1: 72, top: 60, bot: 72, slant: 0.15, nose: 1, px: 67, py: 67, pr: 4.2 });
  s += eyeE({ x0: 86, x1: 104, top: 59, bot: 71, slant: 0.15, nose: -1, px: 98, py: 66, pr: 4.6 });
  s += part(ellipse(84, 80, 6, 4), '#2a8a2a', 2.4);
  s += mouthE(85, 90, 22, line('M76 88q8 8 18 0', INK, 2.2) + line('M84 84v4', INK, 1.8));
  s += sparkle(132, 30, 3.6) + sparkle(12, 60, 3);
  return end(s);
}

// ---- C: a wrapped bonbon, floating on a wisp of mist -------------------------------------------------------
function bonbon() {
  begin();
  let s = '';
  // the ghostly mist it floats on
  for (const [x, y, r] of [[30, 108, 12], [52, 112, 14], [76, 110, 15], [100, 112, 13], [120, 108, 11]]) s += fill(circle(x, y, r), 'rgba(200,180,255,.55)');
  s += line('M18 112q8-6 16 0M60 116q8-6 16 0M104 114q8-6 16 0', '#ffffff', 1.4, 'opacity=".7"');
  // the twisted wrapper ends, like wings
  const endL = smooth([[44, 56], [24, 40], [6, 34, 1], [14, 52], [4, 62, 1], [16, 70], [6, 86, 1], [26, 82], [44, 70]]);
  const endR = smooth([[104, 56], [124, 40], [142, 34, 1], [134, 52], [144, 62, 1], [132, 70], [142, 86, 1], [122, 82], [104, 70]]);
  for (const d of [endL, endR]) s += part(d, 'rgba(220,210,255,.9)', 4.4) + inside(d, line('M10 44l30 14M8 66l34 0M10 80l30-12M138 44l-30 14M140 66l-34 0M138 80l-30-12', '#ffd24a', 1, 'opacity=".8"'));
  s += line('M44 52v22M104 52v22', INK, 3) + line('M44 52v22M104 52v22', '#ffd24a', 1.4);
  const candy = ellipse(74, 64, 34, 32);
  s += part(candy, '#e84aa8');
  let stripes = '';
  for (let i = -3; i <= 3; i++) stripes += `M${60 + i * 14} 30Q${74 + i * 14} 64 ${60 + i * 14} 98`;
  s += inside(candy, line(stripes, '#ffffff', 4, 'opacity=".85"') + fill(circle(82, 72, 34), 'rgba(140,20,90,.35)') + fill(ellipse(62, 46, 12, 7, -0.5), 'rgba(255,255,255,.75)') +
    // the clear wrapper over it
    fill(candy, 'rgba(220,210,255,.18)'));
  s += rim(candy, poly([[0, 0], [70, 0], [44, 40], [30, 90], [0, 90]]), 2, '#ffffff');
  // a spooky-sweet face
  s += eye({ x0: 56, x1: 70, top: 56, bot: 67, slant: 0.4, nose: 1, px: 66, py: 63, pr: 3.8, white: '#fff6fb' });
  s += eye({ x0: 80, x1: 96, top: 55, bot: 66, slant: 0.4, nose: -1, px: 91, py: 62, pr: 4, white: '#fff6fb' });
  const mouth = smooth([[62, 76, 1], [74, 78], [88, 74, 1], [84, 84], [74, 88], [66, 84]]);
  s += fill(mouth, '#3a0a2a') + inside(mouth, fill(poly([[60, 73], [90, 72], [90, 78], [60, 79]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(130, 18, 3.6, '#c8b8ff') + sparkle(16, 18, 3, '#c8b8ff');
  return end(s);
}

export default {
  card: 40, champion: 'רוח הרפאים', en: 'The Phantom', theme: 'Card: a giant gummy snake in a candy store at night · Power: ghost balls fly with the real one (Multi-Ball)',
  options: [
    { letter: 'A', name: 'Gummy Serpent', draw: snake,
      blurb: 'The card\'s giant gummy snake: rainbow bands, sugar crystals glinting, its coils piled underneath, its head rearing with two gummy fangs and a forked tongue. <i>Silhouette: a rearing head over a thick coil.</i>' },
    { letter: 'B', name: 'Ghost Gummy', draw: fitted(bear, [1.05, 1.03, 2, -4]), marks: { eyes: [[64, 66], [95, 65]], nose: [84, 80] },
      blurb: 'A gummy bear you can see right through, and the phantom shot as a picture: a lime-green see-through bear trailing two ghostly copies of itself in red and orange, any of which could be the real one. <i>Silhouette: a round head, two round ears, ghosts behind.</i>' },
    { letter: 'C', name: 'Phantom Bonbon', draw: bonbon,
      blurb: 'A wrapped candy that haunts the store at night: a striped bonbon in clear cellophane, its twisted ends spread like wings, floating on a wisp of lilac mist. <i>Silhouette: a ball with a wing-like twist each side.</i>' },
  ],
};
