// DRAWING KIT FOR THE CHAMPION CONCEPTS (cards #6-#10, public/_champions.html).
//
// Proposals only: nothing in the game reads these. Each concept is an SVG string in the
// characters' own frame (public/characters.js CHAR_BOX): 144 x 142 units, the head box at
// (22, 26) 100 x 91.5, the chin on y 117.5, facing right (three-quarter view toward the
// opponent). The game lays a head out so its drawn mass is ~128 x 114 units centred on x 75
// (CHAR_FIT in game.js), so every concept keeps roughly to x 11-139, y 4-118.
//
// The style is Head Soccer's (docs/HS-ART-STYLE.md): one warm near-black keyline round the
// whole silhouette, flat cel tones with hard edges lit from the front-top, a gold rim along
// the back/top edge, thin inner lines. A chosen design gets rasterised into the real pipeline
// (public/img/chars/<dir>/*.webp) later.

export const INK = '#1c120d';
export const RIM = '#ffd24a';
export const W = 144, H = 142;

const f = (n) => +n.toFixed(1);
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

let DEFS = [], N = 0;
export function begin() { DEFS = []; N = 0; }
export function end(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">` +
    `<defs>${DEFS.join('')}</defs>${body}</svg>`;
}
export const def = (s) => { DEFS.push(s); };
export const uid = (p = 'k') => `${p}${++N}`;

// ---- paths -------------------------------------------------------------------
// A smooth closed (or open) curve through points (Catmull-Rom as cubic Béziers). A point
// [x, y, 1] is a CORNER: the curve arrives and leaves it straight, for tips and notches.
export function smooth(pts, closed = true, t = 1) {
  const n = pts.length;
  const P = (i) => pts[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = p1[2] ? p1 : [p1[0] + ((p2[0] - p0[0]) / 6) * t, p1[1] + ((p2[1] - p0[1]) / 6) * t];
    const c2 = p2[2] ? p2 : [p2[0] - ((p3[0] - p1[0]) / 6) * t, p2[1] - ((p3[1] - p1[1]) / 6) * t];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? d + 'Z' : d;
}
export const poly = (pts, closed = true) => `M${pts.map(pt).join('L')}${closed ? 'Z' : ''}`;
export const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
export function ellipse(cx, cy, rx, ry, rot = 0, n = 0) {
  if (!rot) return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
  const c = Math.cos(rot), s = Math.sin(rot);
  const ps = [];
  for (let i = 0; i < (n || 16); i++) {
    const a = (i / (n || 16)) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    ps.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return smooth(ps);
}
// Points along an ellipse arc (angles in degrees, 0 = +x, 90 = down).
export function arcPts(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// The game's head silhouette (game.js HEAD_SHAPE) laid on the head box (22,26 100 × 91.5),
// optionally scaled about (72,72) and moved: the head of a person, shaped like today's champions.
export function headShape(k = 1, ky = k, dx = 0, dy = 0) {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    const n = s < 0 ? 2.1 : 2.9;
    let x = Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = Math.sign(s) * Math.abs(s) ** (2 / n);
    x *= 1 - 0.1 * Math.max(0, y) ** 2;
    const X = 72 + x * 50, Y = 26 + (0.56 + y * (y < 0 ? 0.56 : 0.44)) * 91.5;
    pts.push([72 + (X - 72) * k + dx, 72 + (Y - 72) * ky + dy]);
  }
  return smooth(pts);
}

// A drawing refitted to the hitbox: the whole picture scaled by (sx, sy) about the hitbox's middle
// (75.2, 61.2) and moved by (dx, dy), so it fills the hitbox like today's champions do. The
// transform rides along as `.fit`, for whoever needs a point of the drawing in the frame.
export const fitted = (draw, t) => {
  const [sx, sy, dx, dy] = t;
  const f = () => draw().replace('</defs>', `</defs><g transform="translate(${75.2 + dx} ${61.2 + dy}) scale(${sx} ${sy}) translate(-75.2 -61.2)">`).replace(/<\/svg>$/, '</g></svg>');
  f.fit = t;
  return f;
};

// ---- expressions ----------------------------------------------------------------
// The game's five faces (characters.js EXPRESSIONS). A drawing reads the current one through
// eyeE / browsE / mouthE; 'normal' draws exactly the design as approved.
let EXPR = 'normal';
export const setExpr = (e) => { EXPR = e || 'normal'; };
export const expr = () => EXPR;
// An eye in the current expression (o as for eye(); o.ink colours the shut eyes, for a dark face).
export function eyeE(o) {
  const { x0, x1, top, bot, nose = 1, ink = INK } = o, mid = (x0 + x1) / 2, h = bot - top, w = Math.max(2.6, (x1 - x0) * 0.17);
  if (EXPR === 'happy') return line(`M${x0} ${bot - h * 0.15}Q${mid} ${top - h * 0.45} ${x1} ${bot - h * 0.15}`, ink, w);
  if (EXPR === 'hurt') {
    const tip = nose > 0 ? x1 : x0, back = nose > 0 ? x0 : x1;
    return line(`M${back} ${top + h * 0.05}L${tip} ${top + h * 0.5}L${back} ${bot - h * 0.05}`, ink, w);
  }
  if (EXPR === 'kick') return eye({ ...o, slant: Math.min(0.8, (o.slant ?? 0.3) + 0.25), px: o.px + (nose > 0 ? 1.6 : 1.2) });
  if (EXPR === 'sad') return eye({ ...o, nose: -nose, slant: 0.35, py: o.py + h * 0.12 });
  return eye(o);
}
// How far a brow's inner and outer end move down in the current expression (negative: up).
export const browMove = () => ({ normal: [0, 0], kick: [3, -0.5], happy: [-5, -1.5], hurt: [-3, 1], sad: [-4.5, 2] }[EXPR] || [0, 0]);
// The two brows, each [x0, y0, x1, y1] (back brow's inner end is x1, the front brow's is x0).
export function browsE(back, front, w = 3) {
  const [ib, ob] = browMove();
  const b = back && `M${back[0]} ${back[1] + ob}L${back[2]} ${back[3] + ib}`;
  const f = front && `M${front[0]} ${front[1] + ib}L${front[2]} ${front[3] + ob}`;
  return line([b, f].filter(Boolean).join(''), INK, w);
}
// The mouth: `normal` (the design's own mouth) for the normal face, else one drawn here,
// centred on (cx, cy) and w wide.
export function mouthE(cx, cy, w, normal) {
  if (EXPR === 'normal') return normal;
  const l = cx - w / 2, r = cx + w / 2;
  if (EXPR === 'sad') return line(`M${l + w * 0.12} ${cy + w * 0.12}Q${cx} ${cy - w * 0.16} ${r - w * 0.12} ${cy + w * 0.1}`, INK, Math.max(2, w * 0.08));
  if (EXPR === 'hurt') {
    const m = smooth([[l + w * 0.08, cy - w * 0.1, 1], [r - w * 0.08, cy - w * 0.14, 1], [r - w * 0.04, cy + w * 0.14, 1], [l + w * 0.04, cy + w * 0.16, 1]], true, 0.3);
    let teeth = `M${l} ${cy + 0.5}H${r}`;
    for (let i = 1; i < 6; i++) teeth += `M${l + (w * i) / 6} ${cy - w * 0.2}V${cy + w * 0.2}`;
    return fill(m, '#ffffff') + inside(m, line(teeth, INK, 1)) + line(m, INK, 1.8);
  }
  // happy: a wide open grin; kick: a shout
  const d = EXPR === 'happy' ? w * 0.42 : w * 0.5, top = EXPR === 'happy' ? cy - w * 0.08 : cy - w * 0.2;
  const m = EXPR === 'happy'
    ? smooth([[l, top, 1], [cx, top + w * 0.04], [r, top - w * 0.02, 1], [r - w * 0.12, top + d * 0.7], [cx, top + d], [l + w * 0.12, top + d * 0.7]])
    : smooth([[l + w * 0.14, top, 1], [r - w * 0.14, top - w * 0.02, 1], [r - w * 0.06, top + d * 0.6], [cx, top + d], [l + w * 0.06, top + d * 0.6]]);
  return fill(m, '#2a0e04') + inside(m, fill(poly([[l - 2, top - 3], [r + 2, top - 3], [r + 2, top + d * 0.22], [l - 2, top + d * 0.24]]), '#ffffff') + fill(ellipse(cx, top + d, w * 0.26, d * 0.32), '#ff7a8a')) + line(m, INK, 1.8);
}

// ---- painting ----------------------------------------------------------------
export const fill = (d, c, extra = '') => `<path d="${d}" fill="${c}"${extra ? ' ' + extra : ''}/>`;
export const line = (d, c = INK, w = 1.4, extra = '') =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`;
// The outer keyline: the silhouette's parts filled in ink and stroked fat, so where they
// overlap they merge into one outline (half the stroke shows outside the fills drawn on top).
export const keyline = (ds, w = 6.4) =>
  `<g fill="${INK}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${[].concat(ds).map((d) => `<path d="${d}"/>`).join('')}</g>`;
export function clipOf(ds) {
  const i = uid('c');
  def(`<clipPath id="${i}">${[].concat(ds).map((d) => `<path d="${d}"/>`).join('')}</clipPath>`);
  return i;
}
// Content clipped to a shape: how every cel tone is laid (sloppy shapes, hard edges).
export const inside = (ds, content) => `<g clip-path="url(#${clipOf(ds)})">${content}</g>`;
// The gold rim: a band just inside the silhouette's edge, kept to `region` (the back/top).
export const rim = (ds, region, w = 2.6, c = RIM) =>
  inside(ds, inside(region, [].concat(ds).map((d) => line(d, c, w * 2)).join('')));

// ---- HS face parts -------------------------------------------------------------
// HS's eye: a white quad with a flat bottom and rounded corners, the top cut on a slant by a
// heavy black lid (lower at the nose side: determined), a big black pupil with a grey ring
// and a glint. `nose` is +1 when the nose is to the right of this eye, -1 to the left.
export function eyeShape({ x0, x1, top, bot, slant = 0.3, nose = 1, r = 3.5, sag = 1.2 }) {
  const h = bot - top, yl = top + (nose > 0 ? 0 : slant * h), yr = top + (nose > 0 ? slant * h : 0);
  return `M${f(x0)} ${f(yl)}L${f(x1)} ${f(yr)}L${f(x1)} ${f(bot - r)}Q${f(x1)} ${f(bot)} ${f(x1 - r)} ${f(bot)}` +
    `Q${f((x0 + x1) / 2)} ${f(bot + sag)} ${f(x0 + r)} ${f(bot)}Q${f(x0)} ${f(bot)} ${f(x0)} ${f(bot - r)}Z`;
}
export function eye(o) {
  const { x0, x1, top, bot, slant = 0.3, nose = 1, px, py, pr, white = '#ffffff', lid = INK, lidW = 2.6,
    shadow = '#b9b4c4', ring = '#4a4550', glint = true, pupil = '#0d0a0c', outline = 1.1 } = o;
  const d = eyeShape(o);
  const h = bot - top, yl = top + (nose > 0 ? 0 : slant * h), yr = top + (nose > 0 ? slant * h : 0);
  const lidD = `M${f(x0 - (nose > 0 ? 1.5 : 0))} ${f(yl + (nose > 0 ? -0.8 : 0))}L${f(x1 + (nose > 0 ? 0 : 1.5))} ${f(yr + (nose > 0 ? 0 : -0.8))}`;
  let s = fill(d, white);
  s += inside(d,
    line(`M${f(x0)} ${f(yl + lidW * 0.9)}L${f(x1)} ${f(yr + lidW * 0.9)}`, shadow, lidW * 1.1) +
    fill(circle(px - pr * 0.12, py + pr * 0.1, pr * 1.08), ring) +
    fill(circle(px, py, pr), pupil) +
    (glint ? fill(circle(px + pr * 0.35, py - pr * 0.38, pr * 0.3), '#ffffff') : ''));
  s += line(d, INK, outline);
  if (lid) s += line(lidD, lid, lidW);
  return s;
}
// A gold coin seen at a tilt: rim, face, a stamped mark, a highlight.
export function coin(cx, cy, r, { squash = 1, rot = 0, mark = 'star', edge = 0 } = {}) {
  const C = { base: '#ffc92e', shade: '#d48a0c', hi: '#fff0a0', deep: '#9a5a06' };
  const tr = `transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"`;
  let s = `<g ${tr}>`;
  if (edge) s += fill(ellipse(cx - edge, cy, r, r * squash), C.deep);
  s += fill(ellipse(cx, cy, r, r * squash), C.shade) + line(ellipse(cx, cy, r, r * squash), INK, 1.1);
  s += fill(ellipse(cx + r * 0.06, cy - r * 0.04 * squash, r * 0.78, r * 0.78 * squash), C.base);
  if (mark === 'star') {
    const st = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.2 : r * 0.46; st.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]); }
    s += fill(poly(st), C.shade);
  } else if (mark === 'hole') {
    s += fill(poly([[cx - r * 0.2, cy - r * 0.2 * squash], [cx + r * 0.2, cy - r * 0.2 * squash], [cx + r * 0.2, cy + r * 0.2 * squash], [cx - r * 0.2, cy + r * 0.2 * squash]]), INK);
  }
  s += line(`M${f(cx - r * 0.55)} ${f(cy - r * 0.35 * squash)}Q${f(cx - r * 0.3)} ${f(cy - r * 0.68 * squash)} ${f(cx + r * 0.1)} ${f(cy - r * 0.66 * squash)}`, C.hi, r * 0.16);
  return s + '</g>';
}
// Little sparkle (4-point star), not keylined.
export const sparkle = (x, y, r, c = '#fff6c8') =>
  fill(poly([[x, y - r], [x + r * 0.22, y - r * 0.22], [x + r, y], [x + r * 0.22, y + r * 0.22], [x, y + r], [x - r * 0.22, y + r * 0.22], [x - r, y], [x - r * 0.22, y - r * 0.22]]), c);
