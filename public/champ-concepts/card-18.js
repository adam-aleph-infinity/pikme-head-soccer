// Card #18 — הסטרייקר (The Striker). Card: Shoval alone in a hotel run by robots, red-eyed
// staff closing in ("24 hours in a robot hotel with no humans"). Power: a destructive strike
// that knocks the blocker aside to see stars; arming it stuns (Destructive, stars, stun).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, headShape, expr, browMove } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const star = (x, y, r, c = '#ffd24a') => {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  return part(poly(p), c, 2.6);
};

// ---- A: the robot-hotel raptor at the front desk -----------------------------------------------
function raptor() {
  begin();
  const M = { base: '#7fa3a6', light: '#b5d3d4', hi: '#e4f4f4', shade: '#4f7377', deep: '#31494d' };
  let s = '';
  // the neck in segments down to the collar, a bow tie on it
  const neck = smooth([[26, 80, 1], [96, 84, 1], [104, 117, 1], [28, 117, 1]], true, 0.3);
  s += part(neck, M.shade) + inside(neck, line('M26 96h80M26 108h80', M.deep, 2) + line('M82 90v24', M.deep, 1.4));
  // the skull: cranium, a long snout to the right
  const skull = smooth([[22, 72], [24, 46], [40, 30], [66, 26], [92, 34], [116, 46], [136, 54], [140, 64, 1], [132, 72], [104, 74], [80, 82], [52, 90], [30, 88]]);
  const jaw = smooth([[50, 88], [80, 82], [106, 78], [130, 76, 1], [124, 88], [100, 96], [70, 102], [52, 100]]);
  s += part(jaw, M.shade) + inside(jaw, line('M60 94l60-10', M.deep, 1.6) + fill(circle(56, 92, 3), '#e5352c'));
  // teeth along both jaws
  for (let i = 0; i < 7; i++) { const x = 78 + i * 8, y = 74 - i * 0.6; s += part(poly([[x, y], [x + 4, y], [x + 2, y + 6]]), '#f1f5f8', 2); s += part(poly([[x + 2, y + 8 - i * 0.2], [x + 6, y + 8 - i * 0.2], [x + 4, y + 2]]), '#f1f5f8', 2); }
  s += part(skull, M.base);
  s += inside(skull, fill(smooth([[0, 30], [40, 40], [34, 100], [0, 100]]), M.shade) + fill(smooth([[60, 28], [110, 40], [136, 54], [110, 54], [80, 44]]), M.light) +
    line('M60 30q30 2 60 18', M.hi, 2) + line('M50 34l-6 40M84 38l-4 30', M.deep, 1.4) +
    [[32, 54], [32, 72], [56, 40], [96, 46], [120, 56]].map(([x, y]) => fill(circle(x, y, 1.8), M.deep)).join(''));
  s += rim(skull, poly([[0, 0], [70, 0], [36, 34], [20, 80], [0, 80]]), 2.2);
  // a bellhop's pillbox cap
  const cap = smooth([[50, 30, 1], [54, 14, 1], [80, 12, 1], [82, 30, 1]], true, 0.3);
  s += `<g transform="rotate(-10 66 22)">` + part(cap, '#c8282e', 5) + inside(cap, fill(poly([[40, 22], [90, 22], [90, 28], [40, 28]]), '#ffd24a') + fill(poly([[72, 10], [90, 10], [90, 34], [72, 34]]), '#951a1e')) + part(ellipse(66, 14, 14, 3), '#c8282e', 3) + '</g>';
  // red LED eyes: the hotel staff's
  for (const [x, y, w, a] of [[62, 52, 14, -6], [96, 50, 16, -12]]) {
    s += `<g transform="rotate(${a} ${x} ${y})">` + fill(ellipse(x, y, w * 0.9, 7), 'rgba(255,40,60,.25)') + part(smooth([[x - w / 2, y - 3, 1], [x + w / 2, y - 3, 1], [x + w / 2, y + 3, 1], [x - w / 2, y + 3, 1]], true, 0.4), '#1a0d10', 3) + fill(poly([[x - w / 2 + 2, y - 1.4], [x + w / 2 - 2, y - 1.4], [x + w / 2 - 2, y + 1.4], [x - w / 2 + 2, y + 1.4]]), '#ff2a3a') + fill(circle(x + w / 4, y - 0.4, 1), '#ffd0d4') + '</g>';
  }
  s += part(ellipse(132, 58, 2.6, 1.6), M.deep, 1.4);
  // the bow tie on its collar
  s += part(poly([[52, 106], [38, 100], [38, 114]]), '#1a1a20', 3) + part(poly([[52, 106], [66, 100], [66, 114]]), '#1a1a20', 3) + part(circle(52, 106, 3.6), '#c8282e', 2.4);
  s += sparkle(136, 26, 3.6, '#ffb0b8') + sparkle(10, 20, 3, '#ffb0b8');
  return end(s);
}

// ---- B: the pin at the end of the lane, the one that hands out stars -----------------------------
function pin() {
  begin();
  const W = { base: '#fbfaf6', shade: '#d8d6cc', light: '#ffffff', deep: '#b9b6aa' };
  const pinD = smooth([[74, 4], [92, 10], [98, 26], [94, 42], [88, 54], [104, 66], [120, 82], [124, 100], [118, 114], [100, 117.5, 1], [48, 117.5, 1], [30, 114], [24, 100], [28, 82], [44, 66], [60, 54], [54, 42], [50, 26], [56, 10]]);
  let s = '';
  // stars ringing it, behind and in front
  s += line(ellipse(74, 36, 40, 9, -0.12), '#ffd24a', 1.4, 'stroke-dasharray="3 4" opacity=".7"');
  s += star(30, 44, 6.4);
  s += part(pinD, W.base);
  s += inside(pinD, fill(smooth([[0, 0], [62, 6], [52, 40], [40, 70], [36, 130], [0, 130]]), W.shade) + fill(smooth([[30, 104], [80, 110], [130, 100], [130, 130], [30, 130]]), W.shade) +
    // two red bands round the neck
    fill('M40 44Q74 50 108 44V50Q74 56 40 50Z', '#e5262e') + fill('M40 54Q74 60 108 54V58Q74 64 40 58Z', '#e5262e') +
    line('M84 12q8 6 8 18', W.light, 3) + line('M104 72q12 12 14 30', W.light, 3));
  s += rim(pinD, poly([[0, 0], [70, 0], [54, 30], [34, 70], [22, 110], [0, 110]]), 2.2);
  // a striker's glare and a cocky grin, a scuff where the ball hit
  s += eye({ x0: 52, x1: 70, top: 72, bot: 86, slant: 0.4, nose: 1, px: 65, py: 80, pr: 4.6 });
  s += eye({ x0: 82, x1: 102, top: 70, bot: 85, slant: 0.4, nose: -1, px: 96, py: 78, pr: 5 });
  s += line('M48 66L72 72M80 70L106 62', INK, 3.4);
  const mouth = smooth([[68, 94, 1], [86, 96], [104, 90, 1], [100, 100], [86, 106], [74, 102]]);
  s += fill(mouth, '#3a1612') + inside(mouth, fill(poly([[64, 90], [106, 88], [106, 96], [64, 97]]), '#fff')) + line(mouth, INK, 2);
  s += line('M70 20l6 4l-2 5l5 3', W.deep, 1.4);
  s += star(122, 30, 7.4) + star(106, 8, 5) + star(132, 64, 5.4);
  return end(s);
}

// ---- C: a charging bull, steam out of its nostrils ---------------------------------------------
function bull() {
  begin();
  const F = { base: '#4a3428', light: '#6e5040', hi: '#9a7a62', shade: '#2e2018' };
  const MZ = { base: '#c9a898', shade: '#a8847a' };
  const HN = { base: '#f2e6cc', shade: '#c9b48a', tip: '#3a2a20' };
  let s = '';
  // horns sweeping out and forward
  const hornB = smooth([[42, 46], [24, 40], [10, 26], [6, 10, 1], [16, 22], [30, 30], [50, 36]]), hornF = smooth([[92, 40], [112, 30], [128, 16], [136, 2, 1], [138, 18], [124, 36], [100, 50]]);
  for (const d of [hornB, hornF]) s += part(d, HN.base) + inside(d, fill(poly([[0, 0], [20, 0], [20, 30], [0, 30]]), HN.tip) + fill(poly([[124, 0], [144, 0], [144, 22], [124, 22]]), HN.tip) + fill(poly([[0, 34], [144, 30], [144, 60], [0, 60]]), HN.shade));
  // ears under the horns
  s += part(smooth([[34, 58], [12, 54], [6, 62, 1], [18, 68], [36, 68]]), F.shade) + part(smooth([[108, 54], [128, 50], [136, 56, 1], [124, 64], [108, 64]]), F.base);
  const head = smooth([[30, 92], [28, 66], [40, 46], [64, 38], [92, 40], [110, 52], [116, 70], [128, 82], [132, 98], [124, 112], [96, 116.5], [56, 116.5], [36, 108]]);
  s += part(head, F.base);
  s += inside(head, fill(smooth([[0, 30], [44, 44], [40, 80], [50, 130], [0, 130]]), F.shade) + fill(smooth([[64, 40], [100, 44], [112, 60], [86, 54]]), F.light) + line('M70 42q22 0 34 12', F.hi, 2.2) +
    fill(smooth([[70, 86], [100, 78], [132, 86], [134, 120], [70, 120]]), MZ.base) + fill(smooth([[70, 106], [134, 102], [134, 120], [70, 120]]), MZ.shade));
  // a forelock between the horns
  s += part(smooth([[56, 42], [62, 26, 1], [70, 36], [78, 24, 1], [84, 38], [92, 30, 1], [94, 44], [72, 50]]), F.shade, 4.4);
  s += rim(head, poly([[0, 0], [70, 0], [44, 40], [30, 70], [26, 110], [0, 110]]), 2.2);
  // furious eyes, flaring nostrils, a gold ring
  s += eye({ x0: 52, x1: 70, top: 60, bot: 74, slant: 0.5, nose: 1, px: 65, py: 68, pr: 4.6, white: '#fff1ec' });
  s += eye({ x0: 82, x1: 102, top: 58, bot: 73, slant: 0.5, nose: -1, px: 96, py: 66, pr: 5, white: '#fff1ec' });
  s += line('M46 52L74 62M78 60L106 48', INK, 4);
  s += fill(ellipse(104, 94, 4, 3, 0.3), '#3a2420') + fill(ellipse(124, 92, 4, 3, -0.3), '#3a2420');
  s += line('M108 104q6 8 14 0', INK, 5.4) + line('M108 104q6 8 14 0', '#ffc92e', 2.6);
  for (const [x, y, r] of [[136, 80, 5], [142, 70, 3.6], [96, 80, 3]]) s += part(circle(x, y, r), '#e8e2dc', 2.4);
  s += line('M86 108q4 2 8 0', INK, 1.6);
  return end(s);
}

// ---- D (your request): a robot, one of the robot hotel's staff -----------------------------------------
function android18() {
  begin();
  const ST = { base: '#b4c0cc', light: '#d8e2ea', hi: '#ffffff', shade: '#7e8a98', deep: '#4e5866' };
  const DK = '#1a1d26';
  const rr = (x0, y0, x1, y1, r) => `M${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1 - r}Q${x1} ${y1} ${x1 - r} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`;
  let s = '';
  // the antenna on top, its red light blinking
  s += line('M46 28L40 8', INK, 4.4) + line('M46 28L40 8', '#8a96a2', 2) + fill(circle(40, 6, 9), '#ff3a3a', 'opacity=".3"') + part(circle(40, 6, 4), '#ff3a3a', 2.4) + fill(circle(38.8, 4.8, 1.3), '#ffd0d0');
  // the ear: a round speaker with a bolt
  const ear = circle(20, 74, 13);
  // the boxy steel head
  const head = rr(24, 24, 126, 117.5, 20);
  s += keyline([ear, head]);
  s += fill(ear, ST.shade) + line(circle(20, 74, 8.4), ST.deep, 1.6) + line('M14 74h12M20 68v12', ST.deep, 1.4);
  s += fill(head, ST.base);
  s += inside(head, fill(poly([[0, 0], [42, 0], [42, 130], [0, 130]]), ST.shade) + fill(poly([[104, 0], [144, 0], [144, 130], [104, 130]]), ST.light) +
    line('M110 34V108', ST.hi, 2.4, 'opacity=".8"') + fill(poly([[0, 108], [144, 108], [144, 130], [0, 130]]), ST.deep, 'opacity=".45"') +
    // panel seams and the forehead vents
    line('M24 44H126M42 24V117.5', ST.deep, 1.3) + line('M64 32h28M64 37h28', DK, 2.2));
  s += rim([ear, head], poly([[0, 0], [80, 0], [40, 40], [16, 90], [0, 100]]), 2, '#fff2c0');
  // rivets round the panels
  for (const [x, y] of [[32, 32], [118, 32], [32, 108], [118, 108], [50, 32], [50, 108]]) s += fill(circle(x, y, 2.2), ST.deep) + fill(circle(x - 0.7, y - 0.7, 0.9), ST.hi);
  // the visor, two glowing red LED eyes in it, steel brow plates angled down
  const visor = rr(46, 50, 124, 78, 10);
  s += part(visor, DK, 3.4) + inside(visor, line('M50 54h70', '#3a3f50', 1.4));
  const E = expr();
  for (const [cx, cy, rx, ry0, nose] of [[66, 64, 9, 7, 1], [102, 63, 10.4, 7.6, -1]]) {
    s += fill(ellipse(cx, cy, rx + 5, ry0 + 5), '#ff3a3a', 'opacity=".28"');
    if (E === 'happy') { s += line(`M${cx - rx} ${cy + 3}Q${cx} ${cy - ry0 - 4} ${cx + rx} ${cy + 3}`, '#ff2a2a', 4.4); continue; }
    if (E === 'hurt') { const t = nose > 0 ? cx + rx : cx - rx, b = nose > 0 ? cx - rx : cx + rx; s += line(`M${b} ${cy - ry0}L${t} ${cy}L${b} ${cy + ry0}`, '#ff2a2a', 4); continue; }
    const ry = E === 'kick' ? ry0 * 0.55 : E === 'sad' ? ry0 * 0.7 : ry0, oy = E === 'sad' ? 2 : 0;
    s += fill(ellipse(cx, cy + oy, rx, ry), '#ff2a2a') + fill(ellipse(cx, cy + oy, rx * 0.55, ry * 0.55), '#ffb0a0') + fill(circle(cx + rx * 0.35, cy + oy - ry * 0.4, 1.6), '#ffffff');
  }
  const [ib, ob] = browMove();
  s += part(poly([[50, 42 + ob], [80, 49 + ib], [80, 54 + ib], [50, 48 + ob]]), ST.deep, 2.4) + part(poly([[88, 49 + ib], [122, 40 + ob], [122, 46 + ob], [88, 54 + ib]]), ST.deep, 2.4);
  // a grille mouth, lit red in a grin
  const grille = rr(64, 88, 116, 104, 5);
  s += part(grille, DK, 3) + inside(grille, ({ normal: [[68, 93], [76, 96], [84, 97], [92, 97], [100, 96], [108, 93]], happy: [[68, 91], [76, 95], [84, 98], [92, 98], [100, 95], [108, 91]],
    sad: [[68, 98], [76, 95], [84, 93], [92, 93], [100, 95], [108, 98]], hurt: [[68, 92], [76, 97], [84, 92], [92, 97], [100, 92], [108, 97]],
    kick: [[68, 91], [76, 91], [84, 91], [92, 91], [100, 91], [108, 91], [68, 97], [76, 97], [84, 97], [92, 97], [100, 97], [108, 97]] }[E]).map(([x, y]) => fill(poly([[x, y], [x + 5, y], [x + 5, y + 3], [x, y + 3]]), '#ff4a3a')).join(''));
  // the hotel's red bellhop cap, tipped forward
  const capBody = smooth([[70, 26, 1], [72, 10, 1], [106, 6, 1], [108, 22, 1]], true, 0.2);
  let cap = part(capBody, '#d8282e', 4.4) + inside(capBody, fill(poly([[66, 18], [116, 14], [116, 28], [66, 30]]), '#ffcc33') + fill(poly([[66, 0], [78, 0], [78, 34], [66, 34]]), '#9a141c'));
  cap += part(ellipse(89, 8, 17, 4.4, -0.08), '#e84040', 3) + part(circle(89, 6, 2.6), '#ffcc33', 2);
  s += `<g transform="rotate(8 90 18)">${cap}</g>`;
  // stars for whoever it strikes
  for (const [x, y, r] of [[134, 30, 5]]) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); } s += part(poly(p), '#ffd24a', 2.2); }
  return end(s);
}

export default {
  card: 18, champion: 'הסטרייקר', en: 'The Striker', theme: 'Card: a hotel run by robots · Power: a destructive strike, stars for the blocker',
  options: [
    { letter: 'A', name: 'Robo-Raptor', draw: raptor,
      blurb: 'The card\'s robot hotel, at its most real: Japan\'s robot hotel famously had dinosaur robots at the front desk. A metal raptor in a bellhop\'s cap and bow tie, red LED eyes like the card\'s staff, a jaw full of steel teeth. <i>Silhouette: a long-snouted skull on a jointed neck.</i>' },
    { letter: 'B', name: 'Strike Pin', draw: pin,
      blurb: 'The striker\'s strike: a bowling pin with a glare and a cocky grin, two red bands round its neck, the stars its shot hands out already spinning round it. <i>Silhouette: a tall pin, narrow neck, wide belly.</i>' },
    { letter: 'C', name: 'Raging Bull', draw: bull,
      blurb: 'A destructive shot that smashes through a block, as an animal: a black bull mid-charge, horns swept forward, steam blasting from its nostrils, a gold ring through its nose. <i>Silhouette: a broad head under wide horns.</i>' },
    { letter: 'D', name: 'Robot', draw: android18, marks: { eyes: [[66, 64], [102, 63]], nose: [90, 82] }, request: true,
      blurb: 'Your request, made more of a robot: a boxy steel head with panel seams, rivets and forehead vents, a black visor with two glowing red LED eyes (the card\'s robot staff), steel brow plates, a red-lit grille grin, a speaker for an ear, an antenna blinking on top and the hotel\'s red bellhop cap. <i>Silhouette: a box head with an antenna and a cap.</i>' },
  ],
};
