// THE CARTOON HEADS — builds public/img/chars/<id>/<expression>.svg from hand-placed paths.
//
// Each character is a caricature of the person on a Saltiz card, drawn in Head Soccer's style
// language (docs/CHARACTERS.md): one wide head silhouette with a thick near-black keyline, flat
// cel colour + ONE shade tone + a thin rim light on the back edge, hair as bold shapes that break
// the outline, big eyes under thick brows, a simple mouth. Nothing here is traced from HS.
//
// The paths are written by hand, in HEAD-BOX units: the drawn head box (HEAD_W x HEAD_H of the
// hitbox in game.js) is 100 wide and 91.5 tall, top-left at 0,0. Every file shares one viewBox
// that leaves room round the box for hair breaking the outline:
//
//   viewBox "-22 -26 144 142"  →  the box sits 22 in from the left and 26 down from the top.
//
// game.js (charPaint) relies on exactly those numbers (CHAR_BOX in public/characters.js) to line
// the drawn head up with the hitbox. Characters face RIGHT (towards the opponent of player one);
// the client mirrors them for player two.
//
//   node tools/chars/build.mjs        → rewrites every SVG, prints the sizes
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHAR_BOX } from '../../public/characters.js';

const ROOT = new URL('../../public/img/chars/', import.meta.url).pathname;
const OL = '#1c0f08';                      // the keyline: near-black warm brown, as HS's
const W = 100, H = 91.5;
const f = (n) => +n.toFixed(1);

// The silhouette — the same superellipse as HEAD_SHAPE in game.js (dome on top, fuller and
// squarer below, widest under the middle, jaw pulled in), as a smooth closed curve.
function headPts(n = 64, grow = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    const e = s < 0 ? 2.1 : 2.9;
    let x = Math.sign(c) * Math.abs(c) ** (2 / e);
    const y = Math.sign(s) * Math.abs(s) ** (2 / e);
    x *= 1 - 0.1 * Math.max(0, y) ** 2;
    pts.push([(0.5 + x / 2) * W + x * grow, (0.56 + y * (y < 0 ? 0.56 : 0.44)) * H + y * grow]);
  }
  return pts;
}
// Catmull-Rom through closed points → cubic Béziers.
function smooth(pts) {
  const n = pts.length, P = (i) => pts[(i + n) % n];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}
const HEAD = smooth(headPts());

// ---- small builders ---------------------------------------------------------------------
const path = (d, fill, sw = 0, extra = '') =>
  `<path d="${d}" fill="${fill}"${sw ? ` stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : ''}${extra}/>`;
const line = (d, sw, col = OL) =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const ellipse = (x, y, rx, ry, fill, sw = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${sw ? ` stroke="${OL}" stroke-width="${sw}"` : ''}/>`;

// An HS eye: a white shape with a thick lid line along its top, a big dark pupil pressed up
// under the lid and looking at the opponent (right), one white catch-light.
function eye({ x, y, w, h, lidTilt = 0, look = 0.35, pupil = 0.62, iris = null, lash = 0, lower = 0 }) {
  // lidTilt > 0 drops the INNER corner (towards the nose) — the angry/determined look; the
  // eye is mirrored per side by the caller passing a signed w.
  const s = Math.sign(w), aw = Math.abs(w);
  const x0 = x - aw / 2, x1 = x + aw / 2;
  const inner = s > 0 ? x1 : x0;          // w>0: the nose is to the right of this eye
  const tl = y - h / 2 + (inner === x0 ? lidTilt : 0), tr = y - h / 2 + (inner === x1 ? lidTilt : 0);
  const b = y + h / 2 - lower;
  const white = `M${f(x0)} ${f(y)}C${f(x0)} ${f(tl - 1)} ${f(x1)} ${f(tr - 1)} ${f(x1)} ${f(y)}C${f(x1 + 0.5)} ${f(b + 1)} ${f(x0 - 0.5)} ${f(b + 1)} ${f(x0)} ${f(y)}Z`;
  const id = `e${Math.round(x)}${Math.round(y)}`;
  const pr = aw * pupil / 2;
  const px = x + look * aw * 0.3, py = y - h * 0.02 + (lidTilt ? lidTilt * 0.25 : 0);
  let out = `<clipPath id="${id}"><path d="${white}"/></clipPath>`;
  out += path(white, '#fff');
  out += `<g clip-path="url(#${id})">`;
  if (iris) out += ellipse(f(px), f(py), f(pr), f(pr * 1.12), iris) + ellipse(f(px), f(py), f(pr * 0.55), f(pr * 0.62), OL);
  else out += ellipse(f(px), f(py), f(pr), f(pr * 1.12), OL);
  out += circle(f(px + pr * 0.35), f(py - pr * 0.4), f(Math.max(1.1, pr * 0.32)), '#fff');
  out += `</g>`;
  out += path(white, 'none', 2.2);
  // the lid: the heaviest line on the face after the brows
  out += line(`M${f(x0 - 1)} ${f(y + 0.5)}C${f(x0)} ${f(tl - 1)} ${f(x1)} ${f(tr - 1)} ${f(x1 + 1)} ${f(y + 0.5)}`, 3.4);
  if (lash) {                              // an outer-corner flick (the women's eye)
    const ox = s > 0 ? x0 : x1, dir = s > 0 ? -1 : 1;
    out += path(`M${f(ox)} ${f(y - 1)}L${f(ox + dir * lash)} ${f(y - h / 2 - lash * 0.4)}L${f(ox - dir * 1)} ${f(y - h / 2 + 1)}Z`, OL, 1);
  }
  return out;
}
// A shut eye: a thick arc. up=true is the happy ^, false the squeezed-in-pain > <.
const shutEye = (x, y, w, kind) => {
  const aw = Math.abs(w), x0 = x - aw / 2, x1 = x + aw / 2;
  if (kind === 'happy') return line(`M${f(x0)} ${f(y + 3)}Q${f(x)} ${f(y - 6)} ${f(x1)} ${f(y + 3)}`, 3.6);
  if (kind === 'sad') return line(`M${f(x0)} ${f(y - 1)}Q${f(x)} ${f(y + 5)} ${f(x1)} ${f(y - 1)}`, 3.4);
  // squeeze: a chevron pointing at the nose
  const tip = w > 0 ? x1 : x0, back = w > 0 ? x0 : x1;
  return line(`M${f(back)} ${f(y - 5)}L${f(tip)} ${f(y)}L${f(back)} ${f(y + 5)}`, 3.6);
};
// A brow as a thick tapered wedge from (ax,ay) to (bx,by): `t` thick at the inner end (b).
function brow(ax, ay, bx, by, t, col = OL, arch = 0) {
  const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny);
  const ux = (nx / L) * (ny < 0 ? 1 : -1), uy = (ny / L) * (ny < 0 ? 1 : -1);   // upward normal
  const mx = (ax + bx) / 2 + ux * arch, my = (ay + by) / 2 + uy * arch;
  const ta = t * 0.55;
  return path(`M${f(ax)} ${f(ay)}Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}L${f(bx - ux * t)} ${f(by - uy * t)}Q${f(mx - ux * t * 0.9)} ${f(my - uy * t * 0.9)} ${f(ax - ux * ta)} ${f(ay - uy * ta)}Z`, col, col === OL ? 0 : 1.6);
}

// The shared skin pass: the silhouette in the base tone, the back of the head and the jaw in
// ONE shade tone, a lit patch on the cheek towards the light, a thin rim light down the back.
function skinPass(c, id) {
  let s = `<clipPath id="h${id}"><path d="${HEAD}"/></clipPath>`;
  s += path(HEAD, c.skin);
  s += `<g clip-path="url(#h${id})">`;
  // shade: a crescent on the back (left) side and under the jaw
  s += path('M-5 20C12 34 14 62 30 80C44 92 70 96 104 84L104 100L-5 100Z', c.skinSh);
  if (c.stubble) s += path('M20 70C30 79 44 76 50 74C56 76 66 76 72 74C78 76 84 76 90 70C92 82 84 92 60 94C36 94 22 86 20 70Z', c.stubble);
  s += path('M66 58C74 54 88 56 90 66C88 72 78 72 70 68Z', c.skinHi);                // lit cheek
  s += line('M3 34C1 50 5 70 20 84', 2.6, c.rim);                                    // rim light
  s += `</g>`;
  s += path(HEAD, 'none', 4.6);
  return s;
}

function ear(c, x = 1, y = 55) {
  return path(`M${x + 6} ${y - 9}C${x - 4} ${y - 12} ${x - 8} ${y - 2} ${x - 5} ${y + 5}C${x - 3} ${y + 10} ${x + 3} ${y + 11} ${x + 7} ${y + 8}Z`, c.skin, 3) +
    line(`M${x + 3} ${y - 4}C${x - 2} ${y - 4} ${x - 3} ${y + 2} ${x + 1} ${y + 4}`, 2, c.skinSh);
}

// ---- mouths -------------------------------------------------------------------------------
const M = {
  flat: (x, y, w, c) => line(`M${x - w / 2} ${y + 1}Q${x} ${y - 1.5} ${x + w / 2} ${y + 1.5}`, 3) +
    line(`M${x - w / 4} ${y + 4.5}Q${x} ${y + 6} ${x + w / 4} ${y + 4.5}`, 2.4, c.skinSh),
  grit: (x, y, w) => path(`M${x - w / 2} ${y - 3}Q${x} ${y - 5} ${x + w / 2} ${y - 3}L${x + w / 2 - 1} ${y + 3}Q${x} ${y + 5} ${x - w / 2 + 1} ${y + 3}Z`, '#fff', 2.6) +
    line(`M${x - w / 2 + 1} ${y}L${x + w / 2 - 1} ${y}`, 1.6) + line(`M${x} ${y - 4}L${x} ${y + 4}M${x - w / 4} ${y - 3.5}L${x - w / 4} ${y + 3.5}M${x + w / 4} ${y - 3.5}L${x + w / 4} ${y + 3.5}`, 1.2),
  o: (x, y, rx, ry, c) => ellipse(x, y, rx, ry, c.mouth, 2.8) + path(`M${x - rx * 0.6} ${y + ry * 0.45}Q${x} ${y + ry * 0.1} ${x + rx * 0.6} ${y + ry * 0.45}Q${x} ${y + ry * 0.95} ${x - rx * 0.6} ${y + ry * 0.45}Z`, c.tongue),
  grin: (x, y, w, h, c) => {
    const d = `M${x - w / 2} ${y - h * 0.25}Q${x} ${y - h * 0.4} ${x + w / 2} ${y - h * 0.3}Q${x + w * 0.35} ${y + h * 0.75} ${x} ${y + h * 0.75}Q${x - w * 0.4} ${y + h * 0.7} ${x - w / 2} ${y - h * 0.25}Z`;
    return `<clipPath id="g${x}"><path d="${d}"/></clipPath>` + path(d, c.mouth) +
      `<g clip-path="url(#g${x})">` + path(`M${x - w / 2} ${y - h}L${x + w / 2} ${y - h}L${x + w / 2} ${y + h * 0.02}Q${x} ${y + h * 0.12} ${x - w / 2} ${y + h * 0.05}Z`, '#fff') +
      ellipse(x + w * 0.05, y + h * 0.75, w * 0.3, h * 0.35, c.tongue) + `</g>` + path(d, 'none', 2.8);
  },
  frown: (x, y, w, c) => line(`M${x - w / 2} ${y + 2.5}Q${x} ${y - 3.5} ${x + w / 2} ${y + 2}`, 3) +
    line(`M${x - w / 5} ${y + 6}Q${x} ${y + 5} ${x + w / 5} ${y + 6}`, 2.2, c.skinSh),
  // the scream: a tall rounded trapezoid, top teeth, tongue — card #2's face
  scream: (x, y, w, h, c) => {
    const d = `M${x - w / 2} ${y - h / 2 + 1}Q${x} ${y - h / 2 - 2} ${x + w / 2} ${y - h / 2}Q${x + w * 0.42} ${y + h / 2 + 1} ${x} ${y + h / 2 + 1}Q${x - w * 0.45} ${y + h / 2} ${x - w / 2} ${y - h / 2 + 1}Z`;
    return `<clipPath id="s${x}"><path d="${d}"/></clipPath>` + path(d, c.mouth) + `<g clip-path="url(#s${x})">` +
      path(`M${x - w} ${y - h}L${x + w} ${y - h}L${x + w} ${y - h / 2 + h * 0.2}Q${x} ${y - h / 2 + h * 0.28} ${x - w} ${y - h / 2 + h * 0.2}Z`, '#fff') +
      ellipse(x + 1, y + h / 2, w * 0.33, h * 0.3, c.tongue) + `</g>` + path(d, 'none', 2.8);
  },
};
// A bruise / bloody nose — HS's hurt mark (a red blotch that stays on the face for a moment).
const bruise = (x, y, r) => ellipse(x, y, r, r * 0.8, '#e8434b') + ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, '#ff9a9a');
const tear = (x, y, s = 1) => path(`M${x} ${y}C${x - 3 * s} ${y + 5 * s} ${x - 3 * s} ${y + 8 * s} ${x} ${y + 8 * s}C${x + 3 * s} ${y + 8 * s} ${x + 3 * s} ${y + 5 * s} ${x} ${y}Z`, '#8fd3ff', 1.8);
const sweat = (x, y) => path(`M${x} ${y}C${x + 4} ${y + 6} ${x + 5} ${y + 9} ${x + 1} ${y + 11}C${x - 3} ${y + 11} ${x - 3} ${y + 7} ${x} ${y}Z`, '#bfe9ff', 1.8);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE CHARACTERS
// ═══════════════════════════════════════════════════════════════════════════════════════════
const CHARS = {};

// ---- legendary #1 — the Saltiz beach-shack card: short dark swept-up hair, thick straight dark
// brows, wide eyes, a broad face and a round shocked "O" mouth, a shadow of stubble.
CHARS['legendary-1'] = (() => {
  const c = {
    skin: '#f0bf93', skinSh: '#cf8e66', skinHi: '#f9d4ae', rim: '#ffe7a8', stubble: '#e2b28f',
    hair: '#4a2c1a', hairSh: '#2a170c', hairHi: '#8a5a3c',
    mouth: '#5c1616', tongue: '#e0666c',
  };
  // Hair: a tall quiff swept up and forward in chunky locks, a messy fringe with three points
  // over the brow, short at the back and sides down to a sideburn in front of the ear.
  // Three big rounded locks rising and curling FORWARD (the quiff), a messy fringe dropping two
  // points onto the forehead, the back and sides cropped short.
  const HAIR = 'M8 50C2 40 0 28 4 18C8 8 14 3 22 0C20 -6 22 -12 28 -14C30 -8 34 -4 40 -3C40 -11 46 -18 56 -19C54 -13 56 -8 62 -5C66 -12 76 -14 84 -10C80 -8 80 -4 82 0C90 0 96 4 98 10C94 11 93 13 94 16C98 21 99 27 97 32L91 33C88 29 86 27 84 25C82 29 78 33 73 35C73 29 71 26 68 24C64 27 58 29 52 29C54 26 54 23 53 20C47 23 40 23 34 22C27 25 21 31 18 39L15 51Z';
  const HAIR_SH = 'M4 18C2 32 3 42 8 50L15 51L18 41C21 31 27 25 34 22C40 23 47 23 53 20C54 23 54 26 52 29C58 29 64 27 68 24C71 26 73 29 73 35C78 33 82 29 84 25L88 18C66 14 40 12 18 14C10 15 6 16 4 18Z';
  const HAIR_HI = 'M28 -9C31 -4 36 0 44 2C38 3 32 1 29 -3ZM54 -14C55 -8 60 -3 68 0C61 1 56 -3 54 -8ZM78 -9C77 -5 79 -1 84 2C80 3 77 0 76 -4Z';
  const hair = `<clipPath id="hr1"><path d="${HAIR}"/></clipPath>` + path(HAIR, c.hair) +
    `<g clip-path="url(#hr1)">` + path(HAIR_SH, c.hairSh) + path(HAIR_HI, c.hairHi) +
    line('M6 12C4 20 4 30 7 40', 2.4, c.rim) + `</g>` + path(HAIR, 'none', 4.2);
  // a broad nose with a round tip, pointing at the opponent
  const nose = path('M59 69C62 72 67 72 70 69C67 73 61 73 59 69Z', c.skinSh) +
    line('M60 68C62 70.5 67 71 70 68.5C71 67.5 71 66 70 65', 2.6);
  const E = (o = {}) => eye({ x: 36, y: 54, w: 24, h: 19, lidTilt: 4, pupil: 0.72, ...o });
  const E2 = (o = {}) => eye({ x: 71, y: 54, w: -20, h: 19, lidTilt: 4, pupil: 0.72, ...o });

  const face = {
    normal: () => E() + E2() + brow(24, 41, 48, 46, 8.5) + brow(83, 42, 60, 46, 8) + nose + M.flat(60, 80, 14, c),
    kick: () => E({ h: 12, lidTilt: 5, y: 55 }) + E2({ h: 12, lidTilt: 5, y: 55 }) +
      brow(24, 41, 49, 49, 9) + brow(83, 42, 59, 49, 8.5) + nose + M.grit(60, 80, 16),
    // one eye screwed shut, the other popping, his card's round "O" of a mouth, a red nose
    hurt: () => shutEye(37, 54, 19, 'squeeze') + E2({ h: 18, lidTilt: 0, pupil: 0.34, look: 0 }) +
      brow(24, 45, 47, 40, 8) + brow(83, 38, 61, 36, 7.5) + nose + bruise(67, 64, 6.5) + M.o(59, 81, 6.5, 7.5, c),
    happy: () => shutEye(37, 54, 19, 'happy') + shutEye(71, 54, 16, 'happy') +
      brow(24, 40, 48, 39, 8) + brow(83, 39, 60, 38, 7.5) + nose + M.grin(59, 79, 24, 14, c),
    sad: () => E({ h: 13, lidTilt: 0, look: -0.3, lower: 1, y: 56 }) + E2({ h: 13, lidTilt: 0, look: -0.3, lower: 1, y: 56 }) +
      brow(25, 46, 47, 39, 7.5) + brow(83, 45, 61, 38, 7) + nose + M.frown(59, 82, 13, c) + sweat(90, 38),
  };
  return { c, back: () => '', ear: () => ear(c), hair: () => hair, face };
})();

// ---- legendary #2 — the green worm card: long wavy blonde hair parted in the middle with
// darker roots, arched brows, big lashed eyes, a wide screaming mouth.
CHARS['legendary-2'] = (() => {
  const c = {
    skin: '#f7cfae', skinSh: '#dc9e80', skinHi: '#fde2c8', rim: '#fff0bf',
    hair: '#f0c867', hairSh: '#c4953f', hairHi: '#fff0ae', root: '#8f6a3a', brow: '#6a4527',
    mouth: '#6a1a1e', tongue: '#e56d74', lip: '#d9736f',
  };
  // Behind the head: the long hair, falling past the jaw onto the shoulders in big waves that
  // end in points. Split in the middle — under the chin is her neck, not more hair.
  const BACK = 'M50 -10C20 -10 -2 10 -6 36C-9 50 -4 58 -9 68C-14 80 -6 88 -10 98C-12 106 -6 112 2 110C4 114 12 114 14 108C18 112 26 110 26 102L50 86L74 102C74 110 82 112 86 108C88 114 96 114 98 110C106 112 112 106 110 98C106 88 114 80 109 68C104 58 109 50 106 36C102 10 80 -10 50 -10Z';
  const back = `<clipPath id="bk2"><path d="${BACK}"/></clipPath>` + path(BACK, c.hair) + `<g clip-path="url(#bk2)">` +
    path('M-20 56L120 56L120 120L-20 120Z', c.hairSh) + line('M-2 64C-8 76 0 88 -4 100M8 70C4 84 10 96 6 106M102 64C108 76 100 88 104 100M92 70C96 84 90 96 94 106', 1.8, c.root) +
    `</g>` + path(BACK, 'none', 4.2);
  // In front: the crown with its centre part (the roots darker along it), and two thin curtains
  // framing the face that end in points flicking out at the jaw — they narrow the wide HS
  // silhouette into her long face.
  const CAP = 'M50 -8C22 -8 2 10 0 34C-1 46 2 56 0 66C-2 74 2 80 -3 89C6 88 11 81 13 74C15 64 13 54 16 45C16 30 34 18 49 11C64 18 84 30 84 45C87 54 85 64 87 74C89 81 94 88 103 89C98 80 102 74 100 66C98 56 101 46 100 34C98 10 78 -8 50 -8Z';
  const CAP_SH = 'M-6 30L14 36C12 48 14 60 12 72C10 80 6 86 -3 89L-8 60ZM106 30L86 36C88 48 86 60 88 72C90 80 94 86 103 89L108 60Z';
  const ROOT = 'M49 11C48 4 47 -2 44 -9L50 -9C50 -2 50 4 49 11Z';
  const WAVES = 'M34 -4C22 2 12 14 8 30M26 16C16 26 8 42 8 56M66 -4C80 2 90 14 93 30M74 16C84 26 92 42 92 56M6 64C10 72 8 80 4 86M94 64C90 72 92 80 96 86';
  const HI = 'M40 -5C30 -2 20 6 16 16C24 10 32 6 42 3ZM60 -5C72 -2 82 6 86 16C78 10 70 6 58 3Z';
  const hair = `<clipPath id="cp2"><path d="${CAP}"/></clipPath>` + path(CAP, c.hair) + `<g clip-path="url(#cp2)">` +
    path(CAP_SH, c.hairSh) + path(ROOT, c.root) + line('M49 10C44 0 40 -4 34 -8M49 10C54 0 58 -4 64 -8', 2.2, c.root) + path(HI, c.hairHi) + line(WAVES, 1.8, c.hairSh) + `</g>` + path(CAP, 'none', 4.2);
  const nose = line('M64 60C66 63 66 65 62.5 66', 2.2);
  const lips = (x, y, w) => path(`M${x - w / 2} ${y}Q${x} ${y - 2} ${x + w / 2} ${y}Q${x} ${y + 5.5} ${x - w / 2} ${y}Z`, c.lip) + line(`M${x - w / 2} ${y}Q${x} ${y - 1.5} ${x + w / 2} ${y}`, 2.6);
  const I = '#6b4a2a';
  const E = (o = {}) => eye({ x: 36, y: 54, w: 21, h: 17, lidTilt: 2.5, pupil: 0.66, iris: I, lash: 5, ...o });
  const E2 = (o = {}) => eye({ x: 69, y: 54, w: -18, h: 17, lidTilt: 2.5, pupil: 0.66, iris: I, lash: 4, ...o });
  const B = (lift = 0, knot = 0, arch = 1.8, t = 4.8) =>
    brow(25, 43 - lift + knot, 46, 46 - lift - knot, t, c.brow, arch) + brow(80, 44 - lift + knot, 61, 46 - lift - knot, t - 0.4, c.brow, arch);

  const face = {
    normal: () => E() + E2() + B() + nose + lips(60, 79, 13),
    kick: () => E({ h: 12, lidTilt: 4, y: 55 }) + E2({ h: 12, lidTilt: 4, y: 55 }) + B(-1, -1.5, 1) + nose + M.grit(60, 79, 15),
    // her card: brows knotted up in the middle, eyes wide, the scream — plus HS's red nose
    hurt: () => E({ h: 18, lidTilt: 0, pupil: 0.42, look: 0.1 }) + E2({ h: 18, lidTilt: 0, pupil: 0.42, look: 0.1 }) +
      B(3, 4, -1.5) + nose + bruise(63, 64, 5.5) + M.scream(59, 80, 20, 17, c),
    happy: () => shutEye(36, 54, 18, 'happy') + shutEye(69, 54, 15, 'happy') + line('M26 52L22 49M79 52L83 49', 2.2) +
      B(4, 0, 2.5) + nose + M.grin(59, 78, 21, 13, c),
    sad: () => E({ h: 13, lidTilt: 0, look: -0.3, lower: 1, y: 56 }) + E2({ h: 13, lidTilt: 0, look: -0.3, lower: 1, y: 56 }) +
      B(1, 3.5, -1) + nose + tear(45, 62, 0.9) + M.frown(59, 81, 12, c),
  };
  return { c, back: () => back, ear: () => '', hair: () => hair, face };
})();

// ---- assemble ---------------------------------------------------------------------------
export const EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad'];
const VB = `${-CHAR_BOX.x} ${-CHAR_BOX.y} ${CHAR_BOX.w} ${CHAR_BOX.h}`;
for (const [id, ch] of Object.entries(CHARS)) {
  mkdirSync(ROOT + id, { recursive: true });
  for (const ex of EXPRESSIONS) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}">` +
      ch.back() + ch.ear() + skinPass(ch.c, 'k') + ch.face[ex]() + ch.hair() + `</svg>\n`;
    writeFileSync(`${ROOT}${id}/${ex}.svg`, svg);
    console.log(`${id}/${ex}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
