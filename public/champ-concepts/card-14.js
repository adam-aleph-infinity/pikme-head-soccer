// Card #14 — נהג המרוצים (The Racer). Card: Shoval at Disney in Japan, green in the face on a
// roller coaster, a fairytale castle and balloons behind ("last one to fall asleep wins
// 10,000"). Power: turbo, the fastest plain straight shot of the early game (Straight).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);

// ---- A: the fairytale castle, amazed --------------------------------------------------------
function castle() {
  begin();
  const ST = { base: '#f5ead6', light: '#fffaf0', shade: '#d9c6a3', deep: '#b39e78' };
  const PK = { base: '#ff7eb6', shade: '#d94c8e', light: '#ffc2dd' };
  const BU = { base: '#4aa3ff', shade: '#2a6fc8', light: '#a8d8ff' };
  let s = '';
  const towerL = smooth([[16, 38, 1], [42, 38, 1], [42, 96, 1], [16, 96, 1]], true, 0.3), towerR = smooth([[106, 34, 1], [132, 34, 1], [132, 94, 1], [106, 94, 1]], true, 0.3);
  const towerC = smooth([[60, 24, 1], [94, 24, 1], [94, 52, 1], [60, 52, 1]], true, 0.3);
  for (const d of [towerL, towerR, towerC]) s += part(d, ST.base) + inside(d, fill(poly([[0, 0], [30, 0], [30, 130], [0, 130]]), ST.shade) + fill(poly([[56, 0], [70, 0], [70, 60], [56, 60]]), ST.shade) + fill(poly([[102, 0], [116, 0], [116, 100], [102, 100]]), ST.shade));
  const coneL = smooth([[29, 4, 1], [36, 22], [47, 39, 1], [11, 39, 1], [22, 22]]), coneR = smooth([[119, 2, 1], [126, 20], [137, 35, 1], [101, 35, 1], [112, 20]]), coneC = smooth([[77, 1, 1], [86, 14], [99, 25, 1], [55, 25, 1], [68, 14]]);
  for (const [d, C] of [[coneL, PK], [coneR, BU], [coneC, PK]]) s += part(d, C.base) + inside(d, fill(poly([[0, 0], [24, 0], [24, 40], [0, 40]]), C.shade) + fill(poly([[54, 0], [72, 0], [72, 30], [54, 30]]), C.shade) + fill(poly([[100, 0], [114, 0], [114, 40], [100, 40]]), C.shade) + line(d, C.light, 1.2, 'stroke-dasharray="6 60"'));
  // the clock from the card, on the middle tower
  s += part(circle(77, 38, 7.4), '#ffffff', 3.4) + line(circle(77, 38, 7.4), '#ffd24a', 1.6) + line('M77 38V33.5M77 38l3.4 1.6', INK, 1.4);
  // the keep, crenellated: the face
  let merlons = '';
  for (let i = 0; i < 8; i++) merlons += `M${27 + i * 12.6} 40h8v8h-8Z`;
  const keep = smooth([[26, 48, 1], [122, 48, 1], [122, 110], [116, 116.5, 1], [32, 116.5, 1], [26, 110]], true, 0.4);
  s += keyline([keep, merlons]) + fill(keep, ST.base) + fill(merlons, ST.base);
  let bricks = '';
  for (let r = 0; r < 7; r++) for (let c = 0; c < 9; c++) bricks += `M${26 + c * 12 + (r % 2) * 6} ${52 + r * 9}h7`;
  s += inside([keep, merlons], line(bricks, ST.deep, 1, 'opacity=".55"') + fill(poly([[0, 40], [40, 40], [40, 130], [0, 130]]), 'rgba(160,130,90,.35)') + fill(poly([[0, 104], [144, 100], [144, 130], [0, 130]]), 'rgba(160,130,90,.3)'));
  s += rim([keep, towerL, coneL, towerC], poly([[0, 0], [70, 0], [40, 30], [20, 60], [10, 100], [0, 100]]), 2);
  // pennants on the towers
  s += part(poly([[20, 46], [38, 46], [29, 62]]), PK.base, 2.4) + part(poly([[110, 42], [128, 42], [119, 58]]), BU.base, 2.4);
  // arched windows for eyes, wide with wonder
  const E = expr();
  for (const [x0, x1, top, bot, px0, py0, nose] of [[42, 62, 60, 82, 56, 73, 1], [82, 106, 56, 82, 99, 70, -1]]) {
    const r = (x1 - x0) / 2, d = `M${x0} ${bot}V${top + r}A${r} ${r} 0 0 1 ${x1} ${top + r}V${bot}Z`;
    const px = px0 + (E === 'kick' ? 2 : 0), py = py0 + (E === 'sad' ? 4 : 0);
    const look = E === 'happy' || E === 'hurt' ? eyeE({ x0: x0 + 3, x1: x1 - 3, top: top + r * 0.6, bot: bot - 4, nose }) : fill(circle(px, py, r * 0.55), '#0d0a0c') + fill(circle(px + r * 0.2, py - r * 0.2, r * 0.17), '#fff');
    s += keyline(d, 5) + fill(d, '#ffffff') + inside(d, look) + line(`M${x0 - 3} ${bot + 2.4}H${x1 + 3}`, ST.deep, 2.4);
  }
  s += E === 'normal' ? line('M40 52q12-6 24-2M80 48q14-6 28-1', INK, 2.6) : browsE([40, 52, 64, 50], [80, 48, 108, 47], 2.6);
  // the gate for a mouth, the drawbridge for a tongue
  const gate = `M66 114V98A15 15 0 0 1 96 98V114Z`;
  s += fill(gate, '#2a1a12') + inside(gate, poly([[64, 86], [98, 86]]) && line('M68 88v6M74 85v7M80 84v8M86 84v8M92 86v6', '#8a96a2', 2.2) + line('M64 92H98', '#8a96a2', 1.6)) + line(gate, INK, 2.2);
  const bridge = poly([[66, 113], [96, 113], [102, 121], [60, 121]]);
  s += part(bridge, '#b07a42', 3) + line('M68 117h26', '#7a4e24', 1.2);
  s += sparkle(136, 52, 4) + sparkle(8, 22, 3) + sparkle(54, 8, 3);
  return end(s);
}

// ---- B: a balloon let go, zooming off like a rocket ----------------------------------------
function balloon() {
  begin();
  const L = { base: '#8fe03a', light: '#c4f57a', hi: '#f2ffd9', shade: '#5aae1e', deep: '#3a7a10' };
  let s = '';
  // speed lines, the string, the air jet out of the nozzle
  s += line('M2 40H14M0 56H10M4 72H14', '#ffffff', 2, 'opacity=".55"');
  s += line('M16 114q-6 6 0 10q6 4 0 10q-4 4-2 8', INK, 2.6) + line('M16 114q-6 6 0 10q6 4 0 10q-4 4-2 8', '#f4f4f4', 1);
  for (const [x, y, r] of [[8, 120, 4], [4, 130, 3]]) s += part(circle(x, y, r), '#ffffff', 2.4);
  const nozzle = smooth([[30, 94], [22, 102], [12, 106, 1], [12, 112], [20, 116], [28, 110], [38, 104]]);
  const body = smooth([[136, 62], [126, 32], [104, 13], [74, 8], [46, 15], [26, 34], [17, 60], [20, 84], [28, 98], [40, 107], [66, 115.5], [98, 114], [120, 100], [134, 82]]);
  s += keyline([body, nozzle]) + fill(nozzle, L.shade) + fill(body, L.base);
  s += inside([body, nozzle], fill(smooth([[0, 20], [40, 26], [30, 60], [40, 130], [0, 130]]), L.shade) + fill(smooth([[30, 100], [80, 108], [140, 86], [140, 130], [30, 130]]), L.shade) +
    fill(ellipse(48, 34, 14, 7, -0.6), L.hi) + fill(ellipse(36, 52, 4, 2.6, -0.8), L.hi) + line('M100 20q22 10 28 34', L.light, 2.6) + line(ellipse(16, 111, 5, 3), L.deep, 1.6));
  s += rim(body, poly([[0, 0], [90, 0], [40, 20], [20, 60], [16, 90], [0, 90]]), 2.2);
  // a queasy face: eyes rolling apart, cheeks puffed, lips pressed shut
  s += eye({ x0: 56, x1: 74, top: 52, bot: 66, slant: 0.12, nose: 1, px: 62, py: 56, pr: 3.8 });
  s += eye({ x0: 90, x1: 110, top: 48, bot: 64, slant: 0.12, nose: -1, px: 104, py: 60, pr: 4.2 });
  s += line('M54 46q8 4 20 0M90 42q10 6 22 0', INK, 2.4);
  for (const [x, y, r] of [[66, 84, 9], [114, 80, 8]]) s += fill(circle(x, y, r), L.light) + line(`M${x - r * 0.8} ${y + r * 0.5}q${r * 0.8} ${r * 0.8} ${r * 1.6} 0`, L.deep, 1.6);
  s += line('M84 86q4-3 8 0q4 3 8 0q4-3 8 0', INK, 2.6);
  s += part(smooth([[126, 34, 1], [130, 42], [127, 46], [122, 42]]), '#8fd6ff', 2) + line('M84 30q4-6 10-2q4 4-2 6', L.deep, 1.6);
  s += sparkle(132, 104, 3.5) + sparkle(76, 128, 3);
  return end(s);
}

// ---- C: a turbo snail whose shell is a roller-coaster loop --------------------------------
function snail() {
  begin();
  const B = { base: '#6cc8ff', light: '#b6e6ff', shade: '#3a94d6', deep: '#2a6fa8' };
  const Y = { base: '#ffcf3a', shade: '#e09a12', light: '#ffe88a' };
  let s = '';
  s += line('M0 104H12M2 116H16', '#ffffff', 2, 'opacity=".55"');
  const body = smooth([[16, 100], [40, 94], [72, 90], [86, 70], [92, 50], [104, 38], [120, 38], [132, 50], [137, 72], [134, 96], [122, 110], [96, 116.5], [52, 117], [26, 114], [12, 108]]);
  // antennae
  for (const [x0, y0, x1, y1] of [[106, 42, 100, 18], [122, 42, 130, 20]]) s += line(`M${x0} ${y0}L${x1} ${y1}`, INK, 6) + line(`M${x0} ${y0}L${x1} ${y1}`, B.base, 3) + part(circle(x1, y1, 4.4), B.base, 3);
  s += part(body, B.base);
  let checks = '';
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) checks += `M${30 + i * 5} ${106 + j * 4}h5v4h-5Z`;
  s += inside(body, fill(smooth([[90, 40], [126, 42], [134, 64], [116, 56], [100, 50]]), B.light) + fill(smooth([[10, 104], [80, 104], [140, 94], [140, 130], [10, 130]]), B.shade) +
    fill('M28 105h82v9h-82Z', '#ffffff') + fill(checks, '#1c120d') + line('M100 44q16-4 28 10', '#ffffff', 2.2));
  // the exhaust out the back, then the shell
  s += line('M14 82L2 92', INK, 9) + line('M14 82L2 92', '#c9d2da', 5) + part(smooth([[2, 92], [-4, 100], [0, 104, 1], [4, 98], [8, 104, 1], [8, 96]]), '#ff7a1a', 3);
  const shell = circle(46, 54, 40);
  s += part(shell, Y.base);
  s += inside(shell, fill(circle(52, 60, 40), Y.shade) + fill(circle(42, 48, 34), Y.base) + line('M18 34q10-18 32-20', Y.light, 3));
  // the spiral track, ties and rails, a coaster car on it
  const sp = [];
  for (let t = 0.6; t <= 10.7; t += 0.35) { const r = 2 + 3.15 * t; sp.push([46 + Math.cos(t - 1.6) * r, 54 + Math.sin(t - 1.6) * r]); }
  const track = smooth(sp, false);
  s += line(track, INK, 8.6) + line(track, '#e5352c', 6) + line(track, '#7a1a14', 6, 'stroke-dasharray="1.2 3.4"') + line(track, '#ffd6d0', 1, 'opacity=".9"');
  const car = smooth([[-7, -4, 1], [7, -4, 1], [8, 4, 1], [-8, 4, 1]], true, 0.3);
  s += `<g transform="translate(66 22) rotate(38)">` + part(car, '#2f6fe0', 2.6) + fill(poly([[-4, -4], [2, -4], [2, -7], [-4, -7]]), '#ffd24a') + fill(circle(-5, 5, 1.6), INK) + fill(circle(5, 5, 1.6), INK) + '</g>';
  s += rim([shell, body], poly([[0, 0], [60, 0], [24, 30], [8, 70], [0, 80]]), 2.2);
  // a cocky racer's face
  s += eye({ x0: 96, x1: 110, top: 54, bot: 66, slant: 0.42, nose: 1, px: 106, py: 61, pr: 3.8, r: 2.6 });
  s += eye({ x0: 116, x1: 132, top: 50, bot: 64, slant: 0.42, nose: -1, px: 127, py: 58, pr: 4.2, r: 2.6 });
  s += line('M94 50L110 54M116 50L134 44', INK, 3);
  const mouth = smooth([[104, 82, 1], [118, 84], [132, 76, 1], [128, 88], [116, 92]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[100, 76], [136, 70], [136, 84], [100, 86]]), '#fff')) + line(mouth, INK, 1.8);
  s += sparkle(138, 26, 3.5) + sparkle(90, 20, 3);
  return end(s);
}

export default {
  card: 14, champion: 'נהג המרוצים', en: 'The Racer', theme: 'Card: a roller coaster at Disney in Japan · Power: turbo (Straight)',
  options: [
    { letter: 'A', name: 'Castle Keep', draw: fitted(castle, [0.97, 0.99, 0, 0]), marks: { eyes: [[52, 71], [94, 69]], nose: [81, 88] },
      blurb: 'The fairytale castle from the card, wide-eyed: arched windows for eyes, the gate for a gasping mouth with the drawbridge for a tongue, the card\'s clock on the middle tower, pink and blue spires. <i>Silhouette: three spires over a crenellated block.</i>' },
    { letter: 'B', name: 'Pop Rocket', draw: balloon,
      blurb: 'One of the card\'s balloons, let go and zooming off on its own air like a turbo: lime green like Shoval on the coaster, cheeks puffed and lips pressed shut, eyes rolling, the string whipping behind. <i>Silhouette: a tilted oval with a nozzle trailing.</i>' },
    { letter: 'C', name: 'Turbo Snail', draw: snail,
      blurb: 'The slowest thing alive, built for speed: a snail whose shell is the card\'s roller-coaster loop, a little car riding the spiral, an exhaust pipe on its back, a chequered stripe, a racer\'s cocky grin. <i>Silhouette: a big spiral shell on a long low body.</i>' },
  ],
};
