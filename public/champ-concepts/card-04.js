// Card #4 — מלך הבוץ (King of Mud). Card: Naveh in a crate of marshmallows, rare snacks flying
// round him, a glowing "?" ("we bought the rarest sweets in the world"). Power: a mud ball that
// rolls along the turf; the blocker is stuck in the bog (Ground, shock).
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, eye, sparkle, INK, eyeE, browsE, mouthE, expr } from './kit.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
const MD = { base: '#6e4a2a', light: '#8e6a42', hi: '#b08a5a', shade: '#4a3018' };
// A marshmallow: a soft white cylinder seen at a tilt.
const mallow = (x, y, r, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})">` +
  part(smooth([[x - r, y - r * 0.5, 1], [x + r, y - r * 0.5, 1], [x + r, y + r * 0.6, 1], [x - r, y + r * 0.6, 1]], true, 0.5), '#fbf6f0', 2.4) +
  fill(ellipse(x, y - r * 0.5, r * 0.92, r * 0.34), '#ffffff') + fill(poly([[x - r, y + r * 0.2], [x + r, y + r * 0.2], [x + r, y + r * 0.6], [x - r, y + r * 0.6]]), '#e6dcd2', 'opacity=".7"') + '</g>';

// ---- A: a crowned hippo, wallowing --------------------------------------------------------------------
function hippo() {
  begin();
  const HP = { base: '#8e7ea6', light: '#b2a2c8', hi: '#d8ccec', shade: '#665a80', deep: '#463c5c' };
  let s = '';
  // the ear at the back, the eye bumps, the head
  const ear = smooth([[34, 36], [28, 22], [38, 16], [48, 28]]);
  const bumps = [circle(60, 34, 13), circle(88, 32, 13)];
  const head = smooth([[18, 76], [22, 52], [40, 36], [70, 30], [100, 36], [126, 44], [140, 60], [142, 84], [130, 104], [100, 115], [62, 116], [32, 108], [18, 94]]);
  s += keyline([ear, ...bumps, head]);
  s += fill(ear, HP.base) + fill(ellipse(38, 24, 3.4, 5, -0.4), '#c87a96');
  for (const d of [...bumps, head]) s += fill(d, HP.base);
  s += inside([...bumps, head], fill(smooth([[0, 40], [36, 50], [40, 120], [0, 120]]), HP.shade) + fill(smooth([[46, 24], [70, 22], [98, 22], [100, 30], [70, 32]]), HP.light) +
    line('M50 24q10-6 20 0M78 22q10-6 20 0', HP.hi, 2) + fill(smooth([[100, 40], [124, 42], [138, 56], [120, 52]]), HP.light) + line('M106 38Q96 52 102 68', HP.shade, 2));
  // mud caked over its jowls, dripping
  const mud = smooth([[0, 84], [18, 80], [30, 90], [44, 82], [58, 94], [72, 86], [88, 96], [104, 88], [118, 96], [132, 88], [150, 92], [150, 130], [0, 130]]);
  s += inside(head, fill(mud, MD.base) + inside(mud, fill(poly([[0, 104], [144, 104], [144, 130], [0, 130]]), MD.shade) + fill(ellipse(60, 92, 6, 2.4), MD.hi) + fill(ellipse(112, 98, 5, 2), MD.hi)));
  s += rim([ear, ...bumps, head], poly([[0, 0], [80, 0], [40, 40], [16, 80], [0, 90]]), 2);
  // eyes up on their bumps
  s += eye({ x0: 52, x1: 66, top: 32, bot: 42, slant: 0.45, nose: 1, px: 62, py: 38, pr: 3.4, r: 2 });
  s += eye({ x0: 80, x1: 96, top: 30, bot: 41, slant: 0.45, nose: -1, px: 91, py: 36, pr: 3.6, r: 2 });
  s += line('M48 28L68 33M78 31L100 25', INK, 2.8);
  // nostrils on the muzzle, a pink cheek, the long grin with two little tusks
  s += fill(ellipse(118, 50, 4, 2.6, 0.3), HP.deep) + fill(ellipse(133, 56, 3.4, 2.4, 0.5), HP.deep);
  s += fill(ellipse(92, 66, 8, 4.4), '#e88aa0', 'opacity=".55"');
  s += line('M76 74Q108 88 140 72', INK, 2.6);
  for (const [x, y] of [[118, 80], [132, 76]]) s += part(poly([[x - 3, y + 1], [x + 3, y], [x + 1, y - 8]]), '#fbf6e8', 2);
  // drips under it, mud bubbles
  for (const [x, y] of [[48, 116], [96, 116]]) s += part(smooth([[x - 4, y - 2], [x + 4, y - 2], [x + 2, y + 5], [x, y + 7, 1], [x - 2, y + 5]]), MD.base, 2.4);
  s += part(circle(14, 112, 4), MD.light, 2.2) + part(circle(134, 110, 3), MD.light, 2);
  // the crown, a marshmallow on each point, mud running off it
  const crown = poly([[56, 30], [54, 15], [64, 22], [72, 11], [80, 21], [90, 14], [88, 30]]);
  s += `<g transform="translate(75 23) rotate(-10) scale(0.8) translate(-72 -30)">${part(crown, '#ffc92e', 4) + inside(crown, fill(poly([[50, 25], [94, 25], [94, 34], [50, 34]]), '#d48a0c') + fill(smooth([[60, 22], [68, 22], [66, 30], [62, 34], [58, 30]]), MD.base)) +
    mallow(54, 11, 5, 8) + mallow(72, 7, 5.4, -4) + mallow(90, 10, 5, 10)}</g>`;
  return end(s);
}

// ---- B: a wobbling chocolate pudding ------------------------------------------------------------------
function pudding() {
  begin();
  const PD = { base: '#8a4e2a', light: '#ac6a3e', hi: '#d29466', shade: '#5e3216', deep: '#3a1a08' };
  let s = '';
  // the plate
  const plate = ellipse(72, 112, 64, 8);
  s += part(plate, '#f4f6fa', 4) + line(ellipse(72, 112, 56, 5), '#6aa8e0', 1.6);
  // the spoon stuck in its back
  s += line('M30 70L6 30', INK, 7) + line('M30 70L6 30', '#c9d2da', 3.4) + part(ellipse(6, 26, 6, 9, -0.5), '#c9d2da', 3) + fill(ellipse(5, 24, 2.4, 4, -0.5), '#ffffff');
  // the pudding
  const body = smooth([[16, 108, 1], [22, 84], [28, 56], [40, 36], [72, 30], [104, 36], [116, 56], [122, 84], [128, 108, 1], [72, 114]]);
  s += part(body, PD.base);
  s += inside(body, fill(smooth([[0, 30], [36, 50], [34, 120], [0, 120]]), PD.shade) + fill(smooth([[100, 50], [118, 60], [124, 110], [110, 110]]), PD.light) + line('M108 60q6 20 8 44', PD.hi, 2.2) +
    fill(poly([[0, 100], [144, 100], [144, 120], [0, 120]]), PD.deep, 'opacity=".4"'));
  // the fudge sauce running down from the top
  const sauce = smooth([[34, 46], [40, 36], [72, 28], [104, 36], [112, 48], [108, 60, 1], [100, 52], [94, 66, 1], [86, 54], [76, 70, 1], [66, 54], [58, 62, 1], [50, 52], [42, 60, 1], [36, 52]]);
  s += fill(sauce, PD.deep) + inside(sauce, line('M46 40Q72 30 98 38', '#7a4a2a', 2.4)) + line(sauce, INK, 1.6);
  s += rim(body, poly([[0, 0], [70, 0], [40, 40], [20, 100], [0, 110]]), 2);
  // the swirl of cream on top, a marshmallow crowning it
  const cream = smooth([[46, 36, 1], [50, 24], [62, 18], [58, 12], [70, 6], [86, 10], [84, 16], [96, 22], [100, 36, 1], [72, 40]]);
  s += part(cream, '#fffaf0', 4.4) + inside(cream, line('M52 28Q72 34 96 28M62 18Q74 22 86 16', '#e8dccb', 1.6) + fill(poly([[40, 32], [104, 32], [104, 42], [40, 42]]), '#efe4d2'));
  s += mallow(76, 2, 5.4, -10);
  // a wobbly grin, wide eyes, jiggle lines
  s += eye({ x0: 46, x1: 64, top: 64, bot: 77, slant: 0.4, nose: 1, px: 58, py: 72, pr: 4.4 });
  s += eye({ x0: 76, x1: 96, top: 62, bot: 76, slant: 0.4, nose: -1, px: 89, py: 70, pr: 4.8 });
  s += line('M42 58L66 64M72 62L100 55', INK, 3);
  const mouth = smooth([[54, 86, 1], [64, 90], [74, 86], [84, 90], [94, 85, 1], [90, 96], [74, 100], [58, 96]]);
  s += fill(mouth, '#2a0e04') + inside(mouth, fill(poly([[52, 84], [96, 82], [96, 89], [52, 91]]), '#fff') + fill(ellipse(76, 100, 10, 4.4), '#ff7a8a')) + line(mouth, INK, 1.8);
  s += line('M134 60q6 10 0 20M140 54q8 16 0 32M10 84q-4 8 0 16', '#ffffff', 1.6, 'opacity=".5"');
  return end(s);
}

// ---- C: the new Saltiz chocolate bar, about to burst -------------------------------------------------------
function bag() {
  begin();
  const RD = { base: '#c62a26', light: '#e04a3e', hi: '#ff9a86', shade: '#8e1a18', deep: '#6a1010' };
  const CK = '#2a1a14';
  // a chunk of the dark cookie inside, white crumbs on it
  const chunk = (x, y, r, a = 0) => { const p = []; for (let i = 0; i < 6; i++) { const t = a + (i / 6) * Math.PI * 2, rr = r * (i % 2 ? 0.75 : 1.05); p.push([x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.8]); }
    return part(poly(p), CK, 2.4) + fill(circle(x - r * 0.3, y - r * 0.2, r * 0.16), '#e8e2d8') + fill(circle(x + r * 0.3, y + r * 0.15, r * 0.12), '#e8e2d8'); };
  let s = '';
  let b = '';
  // the crimped seals, top and bottom
  const zig = (y0, y1, up) => { const p = []; for (let i = 0; i <= 12; i++) p.push([24 + i * 8.2, i % 2 ? y0 + (up ? -4 : 4) : y0]); return poly([...p, [122, y1], [24, y1]]); };
  const topSeal = zig(10, 26, true), botSeal = zig(116, 102, false);
  for (const d of [topSeal, botSeal]) b += part(d, RD.light, 4.4) + inside(d, line('M28 0v130M36 0v130M44 0v130M52 0v130M60 0v130M68 0v130M76 0v130M84 0v130M92 0v130M100 0v130M108 0v130M116 0v130', RD.shade, 1));
  // the puffed wrapper, the sunburst rays on it
  const body = smooth([[24, 24], [74, 20], [122, 24], [134, 44], [138, 68], [132, 94], [122, 106], [74, 102], [24, 106], [12, 94], [8, 66], [14, 42]]);
  let rays = '';
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, a2 = a + 0.11; rays += `M72 40L${72 + Math.cos(a) * 110} ${40 + Math.sin(a) * 110}L${72 + Math.cos(a2) * 110} ${40 + Math.sin(a2) * 110}Z`; }
  b += part(body, RD.base);
  b += inside(body, fill(rays, RD.light, 'opacity=".55"') + fill(smooth([[0, 20], [30, 30], [26, 110], [0, 110]]), RD.shade, 'opacity=".85"') + fill(smooth([[100, 30], [132, 46], [134, 90], [116, 70]]), RD.light) +
    line('M110 32Q130 50 128 84', RD.hi, 3) + line('M30 34Q74 26 116 32', RD.hi, 1.6, 'opacity=".7"') + fill(poly([[0, 94], [144, 90], [144, 120], [0, 120]]), RD.deep, 'opacity=".5"'));
  b += rim(body, poly([[0, 0], [60, 0], [30, 40], [16, 100], [0, 110]]), 2);
  // the milk splash with cookie chunks, the yellow logo, the purple flavour label
  const splash = smooth([[38, 40], [42, 30], [50, 32], [52, 22], [62, 28], [70, 18], [78, 26], [88, 20], [92, 30], [102, 28], [104, 38], [112, 42], [104, 48], [106, 56], [94, 52], [84, 58], [74, 52], [62, 58], [54, 50], [42, 54], [44, 46]]);
  b += chunk(36, 32, 6, 0.4) + chunk(110, 30, 5.4, 1) + chunk(40, 54, 5, 0.2) + chunk(108, 54, 5.6, 0.8);
  b += part(splash, '#fbf8f2', 3) + inside(splash, fill(smooth([[30, 50], [70, 44], [114, 50], [114, 60], [30, 60]]), '#e2dcd2'));
  for (const [x, y] of [[50, 36], [58, 46], [92, 34], [98, 46], [66, 26], [84, 50]]) b += fill(circle(x, y, 1.2), CK);
  b += `<text x="73" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="17" fill="#ffd21e" stroke="${INK}" stroke-width="3.4" paint-order="stroke" stroke-linejoin="round">סולטיז</text>`;
  b += part(smooth([[54, 47, 1], [92, 46, 1], [92, 53, 1], [54, 54, 1]], true, 0.3), '#6a2ab0', 2) +
    `<text x="73" y="52.4" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="5.4" fill="#ffffff">קראנץ׳ קוקיז</text>`;
  // its face
  b += eyeE({ x0: 56, x1: 74, top: 62, bot: 74, slant: 0.35, nose: 1, px: 69, py: 69, pr: 4.2 });
  b += eyeE({ x0: 86, x1: 106, top: 60, bot: 73, slant: 0.35, nose: -1, px: 100, py: 67, pr: 4.6 });
  b += browsE([54, 57, 76, 61], [84, 59, 108, 53], 3);
  const mouth = smooth([[66, 82, 1], [84, 84], [104, 79, 1], [100, 91], [84, 96], [70, 92]]);
  b += mouthE(85, 87, 38, fill(mouth, '#2a0e04') + inside(mouth, fill(poly([[64, 79], [106, 76], [106, 83], [64, 86]]), '#fff') + fill(ellipse(86, 97, 11, 5), '#ff7a8a')) + line(mouth, INK, 1.8));
  s += `<g transform="translate(73 62) rotate(-7) scale(0.9) translate(-73 -62)">${b}</g>`;
  // cookie chunks bursting out round it
  s += chunk(128, 16, 5.4, 0.5) + chunk(16, 110, 4.4, 1.2) + chunk(132, 108, 4, 0.2);
  s += sparkle(8, 20, 3.6) + sparkle(120, 4, 3);
  return end(s);
}

export default {
  card: 4, champion: 'מלך הבוץ', en: 'King of Mud', theme: 'Card: a crate of the rarest sweets in the world, marshmallows, a mystery "?" · Power: a mud ball rolling along the turf (Ground, shock)',
  options: [
    { letter: 'A', name: 'Hippo King', draw: hippo,
      blurb: 'The king of mud, as the animal that lives in it: a lilac hippo wallowing chin-deep, mud caked over its jowls and dripping off, eyes up on their bumps, a long grin with two little tusks, and a gold crown with the card\'s marshmallows on its points. <i>Silhouette: a wide head, a big muzzle, eye bumps and a crown.</i>' },
    { letter: 'B', name: 'Pudding', draw: pudding,
      blurb: 'Mud you can eat, from the card\'s box of sweets: a wobbling chocolate pudding, fudge sauce running down its sides, a swirl of cream and a marshmallow on top for a crown, a spoon stuck in its back, jiggling on a plate. <i>Silhouette: a wobbly dome on a plate.</i>' },
    { letter: 'C', name: 'Saltiz Bar', draw: bag, marks: { eyes: [[65, 68], [96, 66.5]], nose: [90, 77], tf: 'translate(73px, 62px) rotate(-7deg) scale(0.9) translate(-73px, -62px)' },
      blurb: 'The new Saltiz chocolate, as a champion: the red Crunch Cookies wrapper puffed up and about to burst, crimped seals top and bottom, the sunburst, the milk splash with cookie chunks and the yellow Saltiz logo across its forehead, cookie chunks flying off it. <i>Silhouette: a fat crimped pillow, tilted.</i>' },
  ],
};
