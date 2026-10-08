// Card #20 — איש השלג (The Snowman). Card: Paz as a king on a golden toilet in a golden
// palace, crown, ermine and sceptre ("I tried the strangest toilets in the world"). Power: a
// curse that freezes the hit player into a snowman; arming freezes anyone close (freeze).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, fitted, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const G = { base: '#ffc92e', shade: '#d48a0c', light: '#fff0a0', deep: '#9a5a06' };
// A small crown: band from x0 to x1 at y, `h` tall, ice-blue gems.
function crown(x0, x1, y, h, rot = 0) {
  const w = x1 - x0, n = 5, pts = [[x0, y]];
  for (let i = 0; i <= n - 1; i++) pts.push([x0 + (w * (i + 0.5)) / n, y - h + (i % 2 ? h * 0.35 : 0)], [x0 + (w * (i + 1)) / n, y - h * 0.45]);
  pts[pts.length - 1] = [x1, y - h * 0.45];
  pts.push([x1, y]);
  const d = poly(pts);
  let s = part(d, G.base, 4.4) + inside(d, fill(poly([[x0, y - h * 0.22], [x1, y - h * 0.22], [x1, y + 2], [x0, y + 2]]), G.shade) + line(`M${x0 + 3} ${y - h * 0.5}l${w * 0.3} -${h * 0.2}`, G.light, 1.4));
  for (let i = 0; i < n; i += 2) s += part(circle(x0 + (w * (i + 0.5)) / n, y - h - 1, 2.2), '#9fe8ff', 1.8);
  s += part(ellipse(x0 + w / 2, y - h * 0.15, 2.6, 2), '#5fc8ff', 1.6);
  return rot ? `<g transform="rotate(${rot} ${x0 + w / 2} ${y})">${s}</g>` : s;
}

// ---- A: an emperor penguin in the king's ermine ----------------------------------------------
function penguin() {
  begin();
  const K = { base: '#23252e', light: '#45495a', hi: '#7a8096' };
  let s = '';
  const head = smooth([[24, 96], [22, 64], [34, 38], [60, 22], [90, 22], [112, 34], [122, 54], [124, 76], [118, 96], [100, 112], [70, 117], [40, 112]]);
  const beak = smooth([[104, 56], [128, 60], [144, 70, 1], [128, 72], [106, 70]]);
  s += keyline([head, beak]);
  s += fill(head, K.base) + inside(head, fill(smooth([[60, 24], [100, 30], [116, 48], [92, 40]]), K.light) + line('M66 26q24-2 40 14', K.hi, 2.2) +
    fill(smooth([[50, 98], [80, 88], [112, 82], [126, 90], [124, 120], [50, 120]]), '#eef2f6') +
    // the gold ear patches fading into the chest
    fill(smooth([[104, 70], [118, 66], [124, 80], [116, 94], [106, 86]]), '#ffb627') + fill(smooth([[26, 66], [36, 64], [40, 80], [34, 94], [26, 86]]), '#ff9a1a'));
  s += fill(beak, '#2a2a30') + line('M108 68L134 71', '#ff9a3a', 2.6) + line('M108 60q14 0 24 4', '#5a5e6a', 1.4);
  s += rim(head, poly([[0, 0], [70, 0], [40, 30], [24, 70], [20, 110], [0, 110]]), 2.2, '#9fe8ff');
  s += eye({ x0: 52, x1: 68, top: 48, bot: 60, slant: 0.35, nose: 1, px: 63, py: 55, pr: 4.2 });
  s += eye({ x0: 80, x1: 98, top: 46, bot: 59, slant: 0.35, nose: -1, px: 93, py: 53, pr: 4.6 });
  s += line('M48 42L70 48M78 46L100 38', '#9fe8ff', 2.6);
  // the ermine cape round its chest, a gold clasp
  const ermine = smooth([[22, 104], [40, 100], [56, 106], [74, 100], [92, 106], [110, 100], [126, 104], [128, 117.5, 1], [22, 117.5, 1]]);
  s += part(ermine, '#ffffff', 5) + [[34, 110], [56, 112], [80, 110], [104, 112], [120, 110]].map(([x, y]) => fill(smooth([[x, y - 3, 1], [x + 2, y + 2], [x, y + 4, 1], [x - 2, y + 2]]), '#1c1a22')).join('');
  s += part(circle(76, 104, 4.4), G.base, 2.6);
  s += crown(60, 94, 24, 14, -10);
  s += sparkle(134, 30, 4, '#bfeeff') + sparkle(12, 30, 3.4, '#bfeeff') + sparkle(138, 100, 3, '#bfeeff');
  return end(s);
}

// ---- B: a snow globe with a throne inside, crowned ---------------------------------------------
function globe() {
  begin();
  let s = '';
  const base = smooth([[30, 98, 1], [118, 98, 1], [124, 108], [122, 117.5, 1], [26, 117.5, 1], [24, 108]], true, 0.5);
  const ball = circle(74, 54, 46);
  s += keyline([base, ball]);
  s += fill(base, G.base) + inside(base, fill(poly([[0, 104], [144, 104], [144, 110], [0, 110]]), '#c8282e') + fill(poly([[0, 112], [144, 112], [144, 130], [0, 130]]), G.shade) + line('M34 101h80', G.light, 1.4));
  s += fill(ball, '#6fb7e6');
  let snow = '';
  for (let i = 0; i < 26; i++) snow += circle(34 + ((i * 41) % 80), 16 + ((i * 29) % 70), 1 + (i % 3) * 0.5);
  s += inside(ball, fill(poly([[0, 0], [144, 0], [144, 40], [0, 40]]), '#9fd8f4') + fill(smooth([[20, 96], [44, 82], [74, 86], [104, 80], [130, 96], [130, 120], [20, 120]]), '#ffffff') +
    // a tiny golden throne on the snow, like the card's
    part(smooth([[66, 84, 1], [66, 70, 1], [70, 66], [74, 70, 1], [74, 76, 1], [82, 76, 1], [82, 84, 1]], true, 0.3), G.base, 2) + fill(poly([[69, 76], [79, 76], [79, 80], [69, 80]]), '#c8282e') +
    fill(snow, '#ffffff') + fill(smooth([[30, 30], [50, 14], [44, 34], [34, 56]]), 'rgba(255,255,255,.55)') + fill(smooth([[28, 70], [40, 90], [60, 98], [30, 98]]), 'rgba(235,250,255,.8)'));
  s += line(ball, '#e6f7ff', 1.4);
  s += rim([ball], poly([[0, 0], [70, 0], [40, 20], [28, 60], [20, 100], [0, 100]]), 2, '#ffffff');
  // a cold, smug face on the glass
  s += eye({ x0: 52, x1: 68, top: 40, bot: 52, slant: 0.4, nose: 1, px: 63, py: 47, pr: 4.2 });
  s += eye({ x0: 80, x1: 98, top: 38, bot: 51, slant: 0.1, nose: -1, px: 93, py: 45, pr: 4.6 });
  s += line('M50 36L70 40M80 32Q90 26 100 30', INK, 2.6);
  s += line('M70 62Q82 66 94 60', INK, 2.4) + line('M94 60l3-2', INK, 1.8);
  s += crown(54, 94, 9, 13);
  s += sparkle(132, 30, 4, '#bfeeff') + sparkle(12, 76, 3, '#bfeeff');
  return end(s);
}

// ---- C: Royal Flush — the card's golden throne, frozen solid ----------------------------------
function flush() {
  begin();
  let s = '';
  const tank = smooth([[22, 20, 1], [112, 16, 1], [114, 62, 1], [24, 66, 1]], true, 0.35);
  const lid = ellipse(80, 82, 54, 26, -0.04);
  const ped = smooth([[50, 96, 1], [108, 94, 1], [104, 110], [112, 117.5, 1], [46, 117.5, 1], [54, 110]], true, 0.5);
  s += keyline([tank, lid, ped]);
  s += fill(ped, G.shade) + fill(tank, G.base) + fill(lid, G.base);
  s += inside(tank, fill(poly([[20, 14], [38, 14], [38, 70], [20, 70]]), G.shade) + line('M44 26h60', G.light, 2) + fill(poly([[20, 56], [116, 52], [116, 70], [20, 70]]), G.deep));
  s += inside(lid, fill(ellipse(84, 86, 54, 26), G.shade) + fill(ellipse(78, 78, 48, 20), G.base) + fill(ellipse(76, 76, 40, 15), '#ffd75a') + line('M44 70q20-10 50-8', G.light, 2.4));
  s += inside(ped, fill(poly([[40, 104], [120, 104], [120, 120], [40, 120]]), G.deep));
  for (const d of [tank, lid, ped]) s += line(d, INK, 1.2);
  // the flush lever for an ear, a crown on the tank
  s += line('M112 28l10-2', INK, 5) + line('M112 28l10-2', G.light, 2.4) + part(circle(124, 26, 3.4), G.base, 2.4);
  s += crown(44, 86, 24, 16, -4);
  s += rim([tank, lid], poly([[0, 0], [70, 0], [36, 30], [26, 80], [0, 100]]), 2.2);
  // a haughty royal face on the lid: lidded eyes, a curled moustache
  s += eyeE({ x0: 56, x1: 72, top: 70, bot: 80, slant: 0.5, nose: 1, px: 68, py: 76, pr: 3.6, r: 2.4 });
  s += eyeE({ x0: 86, x1: 104, top: 68, bot: 79, slant: 0.5, nose: -1, px: 99, py: 74, pr: 4, r: 2.4 });
  s += expr() === 'normal' ? line('M54 64q8-4 18 0M86 62q10-6 20 0', INK, 2.4) : browsE([54, 64, 72, 63], [86, 62, 106, 61], 2.4);
  const mus = smooth([[80, 86], [90, 84], [100, 88], [110, 84], [114, 78, 1], [116, 86], [108, 92], [94, 92], [80, 92], [68, 92], [56, 88], [52, 80, 1], [58, 86], [70, 86]]);
  s += part(mus, '#7a4404', 3) + mouthE(84, 98, 20, line('M76 96q6 2 12 0', INK, 1.8));
  // frozen: icicles off the rim, frost on the gold
  for (const [x, h] of [[38, 6], [52, 10], [66, 8], [94, 10], [112, 10], [124, 5]]) { const y = x < 60 || x > 110 ? 96 : 104; s += part(poly([[x - 3.4, y], [x + 3.4, y], [x, y + h]]), '#cfefff', 2.4) + line(`M${x - 1} ${y + 1}l0.6 ${h * 0.5}`, '#ffffff', 1); }
  s += fill(smooth([[30, 58], [40, 50], [48, 62], [38, 66]]), 'rgba(220,245,255,.85)') + fill(smooth([[118, 74], [130, 72], [132, 86], [122, 84]]), 'rgba(220,245,255,.85)');
  s += sparkle(128, 44, 3.4, '#bfeeff');
  return end(s);
}

export default {
  card: 20, champion: 'איש השלג', en: 'The Snowman', theme: 'Card: a king on a golden toilet · Power: freeze (into a snowman)',
  options: [
    { letter: 'A', name: 'Emperor Penguin', draw: penguin,
      blurb: 'The king of the ice, the card\'s king as a bird: an emperor penguin in the card\'s ermine with a gold clasp, a small crown set with ice, its gold ear patches, a cold royal glare. <i>Silhouette: a round black head with a long beak and a crown.</i>' },
    { letter: 'B', name: 'Snow Globe King', draw: globe,
      blurb: 'A whole frozen kingdom in a glass ball: snow swirling round the card\'s golden throne, a smug face on the glass, a crown on top, a gold base with a red velvet band. <i>Silhouette: a ball on a pedestal, crowned.</i>' },
    { letter: 'C', name: 'Royal Flush', draw: fitted(flush, [1.05, 1.01, 0, 0]), marks: { eyes: [[64, 75], [95, 73.5]], nose: [86, 85] },
      blurb: 'The card taken literally: the golden toilet itself, crowned, its lid a haughty royal face with a curled moustache, the flush lever for an ear, frozen solid, icicles hanging off it. <i>Silhouette: a tank over an oval, crowned.</i>' },
  ],
};
