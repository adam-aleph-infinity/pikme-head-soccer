// Card #44 — עין הסערה (The Eye of the Storm). Card: Naveh riding a raging rodeo bull in a
// Wild West arena, a cowboy flying off, fireworks ("24 hours in the wildest west in the USA").
// Power: a tornado carries the ball up and down across the pitch and throws the opponent (Up-and-Down, stars, push).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };
const hat = (x, y, rot, k = 1) => `<g transform="rotate(${rot} ${x} ${y}) scale(${k}) translate(${x / k - x} ${y / k - y})">` +
  part(smooth([[x - 22, y + 4], [x - 14, y + 1], [x - 10, y - 12], [x - 2, y - 16], [x, y - 12], [x + 2, y - 16], [x + 10, y - 12], [x + 14, y + 1], [x + 22, y + 4], [x + 18, y + 8], [x, y + 6], [x - 18, y + 8]]), '#a8642e', 4) +
  fill(poly([[x - 11, y - 4], [x + 11, y - 4], [x + 12, y - 1], [x - 12, y - 1]]), '#4e2a0e') + '</g>';

// ---- A: a twister, its face in the calm eye at its centre -------------------------------------------
function twister() {
  begin();
  const T = { base: '#8a94a8', light: '#b8c0d0', hi: '#e2e6ee', shade: '#5e6880', deep: '#3e4660' };
  const D = { base: '#c9a878', shade: '#a8845a' };
  let s = '';
  // the dust it kicks up along the ground
  for (const [x, y, r] of [[18, 104, 12], [40, 110, 13], [66, 108, 14], [92, 110, 13], [116, 106, 12], [132, 110, 9]]) s += part(circle(x, y, r), D.base, 3.4);
  s += inside([circle(40, 110, 13), circle(92, 110, 13)], fill(poly([[0, 112], [144, 112], [144, 130], [0, 130]]), D.shade));
  const funnel = smooth([[6, 8], [40, 3], [74, 2], [108, 3], [140, 10], [132, 28], [116, 44], [104, 62], [98, 82], [96, 98], [52, 98], [50, 82], [44, 62], [32, 44], [16, 26]]);
  s += part(funnel, T.base);
  let bands = '';
  for (let i = 0; i < 8; i++) { const y = 10 + i * 11, w = 66 - i * 6; bands += `M${74 - w} ${y + 4}Q74 ${y + 12} ${74 + w} ${y - 2}`; }
  s += inside(funnel, fill(smooth([[0, 0], [30, 8], [44, 60], [50, 110], [0, 110]]), T.shade) + line(bands, T.light, 3, 'opacity=".8"') + line(bands, T.deep, 1.2, 'transform="translate(0 4)" opacity=".6"'));
  s += rim(funnel, poly([[0, 0], [80, 0], [40, 20], [30, 60], [0, 80]]), 2, '#e2e6ee');
  // the calm eye: clear sky, and the face in it
  const calm = circle(74, 50, 23);
  s += line(calm, T.hi, 6) + fill(calm, '#bfe8ff') + inside(calm, fill(circle(80, 56, 23), '#9fd4f4') + fill(ellipse(66, 40, 8, 4, -0.5), '#ffffff', 'opacity=".7"'));
  s += eye({ x0: 58, x1: 72, top: 42, bot: 52, slant: 0.4, nose: 1, px: 68, py: 48, pr: 3.4, r: 2 });
  s += eye({ x0: 78, x1: 92, top: 41, bot: 51, slant: 0.4, nose: -1, px: 88, py: 47, pr: 3.6, r: 2 });
  s += line('M64 60Q74 64 86 58', INK, 2);
  // what it's carrying round: the cowboy's hat, a fence plank, stars for whoever it hits
  s += hat(126, 26, 30, 0.7) + part(poly([[10, 54], [30, 46], [32, 50], [12, 58]]), '#b07a42', 2.4);
  for (const [x, y, r] of [[22, 78, 5], [128, 70, 4.4]]) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } s += part(poly(p), '#ffd24a', 2.2); }
  return end(s);
}

// ---- B: a saguaro in the card's cowboy hat --------------------------------------------------------------
function cactus() {
  begin();
  const C = { base: '#4fa85a', light: '#7ed08a', hi: '#b8f0c0', shade: '#2e7a3a', deep: '#1e5a28' };
  let s = '';
  const sand = smooth([[2, 108], [30, 102], [74, 104], [118, 100], [142, 108], [142, 117.5, 1], [2, 117.5, 1]]);
  const armL = smooth([[50, 76], [26, 76], [16, 66], [16, 40], [24, 32], [32, 40], [32, 60], [50, 60]]);
  const armR = smooth([[98, 66], [120, 66], [128, 56], [128, 28], [120, 20], [112, 28], [112, 50], [98, 50]]);
  const trunk = smooth([[46, 117.5, 1], [44, 40], [52, 24], [74, 18], [96, 24], [104, 40], [102, 117.5, 1]]);
  s += keyline([armL, armR, trunk]);
  for (const d of [armL, armR, trunk]) s += fill(d, C.base);
  s += inside([armL, armR, trunk], fill(poly([[0, 0], [56, 0], [56, 130], [0, 130]]), C.shade) + line('M60 26V116M74 20V116M88 26V116M24 40V70M120 28V60', C.deep, 1.4) + line('M80 24q12 2 16 14', C.hi, 2.2) +
    line(Array.from({ length: 22 }, (_, i) => { const x = [46, 58, 70, 82, 94, 102][i % 6], y = 30 + Math.floor(i / 6) * 22 + (i % 2) * 6; return `M${x} ${y}l-2-2M${x} ${y}l2-2`; }).join(''), '#fff4c8', 1));
  s += rim([armL, trunk], poly([[0, 0], [60, 0], [44, 30], [40, 120], [0, 120]]), 2);
  s += part(sand, '#e8c48a') + inside(sand, fill(poly([[0, 110], [144, 110], [144, 120], [0, 120]]), '#c9a060'));
  // the card's cowboy hat on top
  s += hat(74, 20, -8, 1.2);
  // a squint, a big handlebar moustache, a grin under it
  s += eye({ x0: 52, x1: 68, top: 46, bot: 58, slant: 0.5, nose: 1, px: 63, py: 53, pr: 4 });
  s += eye({ x0: 78, x1: 96, top: 45, bot: 57, slant: 0.5, nose: -1, px: 90, py: 52, pr: 4.4 });
  s += line('M48 40L70 46M76 44L100 38', INK, 2.8);
  const mus = smooth([[74, 66], [84, 64], [94, 68], [104, 62, 1], [102, 70], [92, 74], [74, 72], [56, 74], [46, 70], [44, 62, 1], [54, 68], [64, 64]]);
  s += part(mus, '#5a3418', 3);
  s += line('M62 80Q74 86 88 80', INK, 2.2);
  s += part(circle(32, 32, 4), '#ff7eb6', 2.2) + sparkle(134, 90, 3.4) + sparkle(10, 90, 3);
  return end(s);
}

// ---- C: the sheriff's star — and the stars it gives you ----------------------------------------------------
function sheriff() {
  begin();
  const cx = 74, cy = 58;
  let s = '';
  // the ribbon it hangs from, under it
  const ribbon = smooth([[14, 100, 1], [28, 96], [74, 100], [120, 96], [134, 100, 1], [128, 108], [134, 117.5, 1], [120, 114], [74, 117.5], [28, 114], [14, 117.5, 1], [20, 108]]);
  s += part(ribbon, '#c8282e') + inside(ribbon, fill(poly([[0, 108], [144, 108], [144, 120], [0, 120]]), '#951a1e') + line('M30 102Q74 108 118 102', '#ff6a6a', 1.4));
  const pts = [];
  for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 6, r = i % 2 ? 30 : 52; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1]); }
  const star = poly(pts);
  const balls = pts.filter((_, i) => i % 2 === 0).map(([x, y]) => circle(x, y, 5.4));
  s += keyline([star, ...balls]) + fill(star, G.base) + balls.map((d) => fill(d, G.base)).join('');
  s += inside([star, ...balls], fill(poly([[0, 0], [cx, cy], [0, 130]]), G.shade) + fill(poly([[cx, 0], [144, 0], [cx, cy]]), G.light) + fill(poly([[cx, cy], [144, 130], [0, 130]]), G.shade, 'opacity=".6"'));
  s += rim([star, ...balls], poly([[0, 0], [70, 0], [40, 30], [16, 80], [0, 90]]), 2, '#fffbe0');
  // the stamped disc at its heart: the face
  const disc = circle(cx, cy, 25);
  s += part(disc, G.light, 4) + line(circle(cx, cy, 21.5), G.shade, 1.2);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; s += fill(circle(cx + Math.cos(a) * 23.2, cy + Math.sin(a) * 23.2, 0.8), G.deep); }
  s += eye({ x0: 60, x1: 72, top: 50, bot: 60, slant: 0.45, nose: 1, px: 68, py: 56, pr: 3.2, r: 2 });
  s += eye({ x0: 78, x1: 92, top: 49, bot: 59, slant: 0.45, nose: -1, px: 88, py: 55, pr: 3.4, r: 2 });
  s += line('M58 46L74 50M76 48L94 42', INK, 2.4);
  s += line('M64 68Q74 74 86 66', INK, 2.2) + line('M86 66l3-2', INK, 1.6);
  s += sparkle(132, 22, 5) + sparkle(14, 34, 4) + sparkle(136, 80, 3);
  return end(s);
}

// ---- D (your request): the card's rodeo bull -------------------------------------------------------------------
function rodeoBull44() {
  begin();
  const B = { base: '#6a4028', light: '#8a5634', hi: '#b07a4e', shade: '#462a16', deep: '#2a160a' };
  const MZ = { base: '#d0a084', light: '#ecc0a6', shade: '#a87a60' };
  const HN = { base: '#f2e6c8', shade: '#c8b48e', tip: '#4a3a2a' };
  let s = '';
  // dust kicked up behind
    // the long horns, the thrown cowboy's hat flying off behind them
  s += hat(42, 12, -24, 0.6);
  const hornB = smooth([[42, 40], [30, 34], [20, 24], [18, 10, 1], [26, 18], [36, 26], [46, 28]]);
  const hornF = smooth([[98, 30], [112, 24], [120, 16], [124, 4, 1], [130, 18], [122, 34], [104, 42]]);
  for (const [d, tx, ty] of [[hornB, 18, 10], [hornF, 124, 4]]) s += part(d, HN.base) + inside(d, fill(poly([[0, 34], [144, 34], [144, 50], [0, 50]]), HN.shade) + fill(circle(tx, ty, 9), HN.tip));
  // a lasso round the front horn
  s += line(ellipse(118, 22, 7, 3.4, -0.9), INK, 3.6) + line(ellipse(118, 22, 7, 3.4, -0.9), '#d8b47a', 1.8);
  s += line('M122 26Q134 38 130 56', INK, 3.6) + line('M122 26Q134 38 130 56', '#d8b47a', 1.8);
  // ears, the head
  const earB = smooth([[34, 54], [20, 50], [12, 58, 1], [20, 66], [34, 66]]);
  const earF = smooth([[112, 46], [124, 42], [132, 48, 1], [126, 56], [114, 58]]);
  const head = smooth([[24, 62], [32, 40], [56, 26], [84, 24], [106, 30], [118, 48], [122, 64], [128, 80], [130, 98], [120, 112], [100, 117.5], [72, 117.5], [48, 110], [32, 94], [24, 78]]);
  s += keyline([earB, earF, head]);
  for (const d of [earB, earF]) s += fill(d, B.base);
  s += fill(ellipse(22, 58, 6, 3.4, 0.1), '#c87a7a') + fill(ellipse(124, 50, 5, 3, -0.3), '#c87a7a');
  s += fill(head, B.base);
  s += inside(head, fill(smooth([[0, 40], [40, 50], [50, 120], [0, 120]]), B.shade) + fill(smooth([[56, 34], [96, 30], [112, 46], [84, 42]]), B.light) + line('M60 34Q84 28 104 36', B.hi, 2));
  // the pale muzzle
  const muz = smooth([[74, 86], [94, 78], [118, 80], [130, 94], [126, 110], [110, 117.5], [90, 117], [74, 106]]);
  s += inside(head, fill(muz, MZ.base) + inside(muz, fill(poly([[70, 106], [144, 104], [144, 120], [70, 120]]), MZ.shade) + fill(ellipse(104, 86, 14, 4), MZ.light)) + line(muz, B.deep, 1.6));
  s += rim([earB, head], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2);
  // the curly forelock
  const curls = smooth([[56, 32], [62, 24], [70, 30], [76, 20], [84, 28], [92, 22], [98, 32], [92, 40], [80, 38], [68, 42], [58, 40]]);
  s += part(curls, B.shade, 3.4) + inside(curls, line('M62 30q4 4 8 0M76 26q4 4 8 0M88 28q4 4 6 0', B.deep, 1.2));
  // the card's glowing red eyes, a furious brow
  s += fill(circle(64, 64, 10), '#ff3a3a', 'opacity=".22"') + fill(circle(98, 61, 11), '#ff3a3a', 'opacity=".22"');
  s += eyeE({ x0: 54, x1: 72, top: 58, bot: 70, slant: 0.6, nose: 1, px: 66, py: 65, pr: 4, pupil: '#e0202a', ring: '#7a0a10' });
  s += eyeE({ x0: 86, x1: 106, top: 55, bot: 68, slant: 0.6, nose: -1, px: 99, py: 62, pr: 4.4, pupil: '#e0202a', ring: '#7a0a10' });
  s += browsE([50, 50, 74, 58], [82, 56, 110, 44], 3.6);
  // nostrils, the gold nose ring, a snort of steam, its scowl
  s += fill(ellipse(98, 96, 3.6, 5.4, 0.3), B.deep) + fill(ellipse(120, 94, 3, 4.6, 0.2), B.deep);
  s += line(ellipse(109, 108, 6.4, 6), INK, 5) + line(ellipse(109, 108, 6.4, 6), '#ffc92e', 2.4) + line('M105 104a5 5 0 0 1 6-1', '#fff0a0', 1);
  s += mouthE(100, 111, 22, line('M88 112Q102 116 120 110', INK, 1.8));
  // the arena's fireworks
  s += sparkle(70, 10, 4, '#ff9a3a') + sparkle(96, 12, 3, '#ffd24a');
  return end(s);
}

export default {
  card: 44, champion: 'עין הסערה', en: 'The Eye of the Storm', theme: 'Card: a rodeo in the wildest West · Power: a tornado carries the ball and throws you (Up-and-Down, stars)',
  options: [
    { letter: 'A', name: 'Twister', draw: twister,
      blurb: 'The champion\'s name, literally: a Wild West twister whose face sits calm in the clear eye at its centre, the cowboy\'s hat and a fence plank whirling round it, stars for whoever it throws, dust boiling at its base. <i>Silhouette: a funnel on a cloud of dust.</i>' },
    { letter: 'B', name: 'Cowboy Cactus', draw: cactus,
      blurb: 'The card\'s Wild West in one plant: a saguaro with its arms up, the card\'s cowboy hat on top, a squint and a big handlebar moustache, spines, a pink flower, desert sand. <i>Silhouette: a column with two raised arms.</i>' },
    { letter: 'C', name: 'Sheriff Star', draw: sheriff,
      blurb: 'The law of the Wild West, and the stars its shot hands out: a six-pointed gold sheriff\'s badge with ball tips, its face stamped on the disc at its heart, on a red ribbon. <i>Silhouette: a six-point star on a ribbon.</i>' },
    { letter: 'D', name: 'Rodeo Bull', draw: fitted(rodeoBull44, [1.07, 1, 0, -4]), marks: { eyes: [[63, 64], [96, 61.5]], nose: [109, 100] }, request: true,
      blurb: 'Your request: the card\'s rodeo bull. Dark brown, long ivory horns, the card\'s glowing red eyes, a curly forelock, a gold nose ring, a snort of steam, a lasso round one horn and the thrown cowboy\'s hat flying off. <i>Silhouette: a wide head between two long horns.</i>' },
  ],
};
