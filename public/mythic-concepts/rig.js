// MYTHIC CONCEPTS: ONE MODEL, ANY SIDE (Idan, 2026-10-08).
//
// Proposals only: nothing in the game reads this file. It draws the four Mythic starters from the
// artist's sheets (uploaded-images/champ_A–D) in the style of champions #1–#5: one warm
// near-black keyline round the silhouette, flat cel tones lit from the front, a rim light along
// the top and back (docs/HS-ART-STYLE.md).
//
// Why a model and not a drawing per view: each sheet shows its character from the front, a side,
// three-quarters and the back, and every option has to agree with itself in all of them. So each
// part (the head, each lock of hair, the beard, the glasses, the kit) is placed once on the
// surface of a rounded box, and a view only turns it (`yaw`) and projects it. Two views cannot
// disagree: they are the same model.
//
// Surface coordinates: θ round the body (0 the nose, +π/2 the character's LEFT side, π the back),
// v down it (head: 0 the crown, 1 the chin) and `out` off the skin. Lateral front positions are
// given as `u`, the x a point has in the front view, so a face is laid out the way it is drawn.
// yaw 0 faces the viewer; +π/2 faces the right of the picture (showing the character's right side).
import { INK, smooth, fill, line, inside, circle, ellipse, poly, def, uid, begin, end } from '../champ-concepts/kit.js';

export const VW = 200, VH = 250;
let RENDERS = 0;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const f1 = (n) => +n.toFixed(1);
export const tbl = (t, x) => {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
};

// THE HEADS. `hs` is the roster's: a wide rounded box, a dome, full jowls and a flat jaw (the
// head every one of #1–#5 is traced on). `soft` is rounder and a little taller, the artist's.
export const HEADS = {
  hs: { Rx: 58, Rz: 50, H: 100, n: 3.2, r: [[0, 0.3], [0.05, 0.58], [0.12, 0.77], [0.22, 0.89], [0.35, 0.96], [0.5, 1], [0.65, 1.03], [0.78, 1.03], [0.88, 0.98], [0.95, 0.88], [1, 0.7], [1.14, 0.3]] },
  soft: { Rx: 55, Rz: 49, H: 104, n: 2.5, r: [[0, 0.22], [0.05, 0.52], [0.12, 0.73], [0.22, 0.87], [0.35, 0.96], [0.5, 1], [0.65, 1], [0.78, 0.96], [0.88, 0.88], [0.95, 0.76], [1, 0.58], [1.14, 0.26]] },
};

// A solid of revolution-ish: superellipse sections (n) of half-width Rx·r(v) and depth Rz·r(v).
function solid(o) {
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), e = 2 / o.n, ox = o.ox || 0;
  const S = {
    ...o,
    P(th, v, out = 0) {
      const k = tbl(o.r, v), s = Math.sin(th), c = Math.cos(th);
      const x = ox + (o.Rx * k + out) * Math.sign(s) * Math.abs(s) ** e;
      const z = (o.Rz * k + out) * Math.sign(c) * Math.abs(c) ** e;
      const lift = o.crown ? out * Math.max(0, 1 - v / 0.3) * 0.9 : 0;
      return [o.cx + x * cy + z * sy, o.y0 + v * (o.y1 - o.y0) - lift, -x * sy + z * cy];
    },
    th(u, v) { const R = o.Rx * tbl(o.r, v); return Math.sign(u) * Math.asin(clamp(Math.abs(u) / R, 0, 1) ** (o.n / 2)); },
    U(u, v, out = 0) { return S.P(S.th(u, v), v, out); },
    // The face's own surface: a little rounder than the head (nf), so the features stay readable
    // when the head turns side-on instead of vanishing edge-on with its flat front.
    F(u, v, out = 0) {
      const nf = o.nf || o.n, k = tbl(o.r, v), R = o.Rx * k, th = Math.sign(u) * Math.asin(clamp(Math.abs(u) / R, 0, 1) ** (nf / 2));
      const s = Math.sin(th), c = Math.cos(th), ef = 2 / nf;
      const x = ox + (R + out) * Math.sign(s) * Math.abs(s) ** ef, z = (o.Rz * k + out) * Math.sign(c) * Math.abs(c) ** ef;
      return [o.cx + x * cy + z * sy, o.y0 + v * (o.y1 - o.y0), -x * sy + z * cy];
    },
    fc: (th) => Math.cos(th + o.yaw),
    vis: [-Math.PI / 2 - o.yaw + 0.02, Math.PI / 2 - o.yaw - 0.02],
  };
  return S;
}
const xy = (p, corner) => (corner ? [p[0], p[1], 1] : [p[0], p[1]]);

// The silhouette of a band of a solid, v0..v1, `out(th, v)` off it.
function hull(S, out, v0, v1, nv = 30, nth = 120) {
  const L = [], R = [];
  for (let i = 0; i <= nv; i++) {
    const v = lerp(v0, v1, i / nv);
    let mn = null, mx = null;
    for (let j = 0; j < nth; j++) {
      const th = (j / nth) * Math.PI * 2, p = S.P(th, v, out(th, v));
      if (!mn || p[0] < mn[0]) mn = p;
      if (!mx || p[0] > mx[0]) mx = p;
    }
    L.push(xy(mn)); R.push(xy(mx));
  }
  return smooth([...R, ...L.reverse()]);
}
// A patch of a surface over θ a..b, from vTop(θ) to vBot(θ).
function region(S, a, b, vTop, vBot, out = () => 0, n = 30, m = 6) {
  if (!(b > a)) return null;
  const pts = [];
  for (let i = 0; i <= n; i++) { const th = lerp(a, b, i / n), v = vTop(th); pts.push(xy(S.P(th, v, out(th, v)))); }
  for (let j = 1; j < m; j++) { const v = lerp(vTop(b), vBot(b), j / m); pts.push(xy(S.P(b, v, out(b, v)))); }
  for (let i = n; i >= 0; i--) { const th = lerp(a, b, i / n), v = vBot(th); pts.push(xy(S.P(th, v, out(th, v)))); }
  for (let j = m - 1; j > 0; j--) { const v = lerp(vTop(a), vBot(a), j / m); pts.push(xy(S.P(a, v, out(a, v)))); }
  return smooth(pts);
}
// The part of θ c..d (any turn) that is inside a..b.
function cut([a, b], c, d) {
  let best = null;
  for (const k of [-2, -1, 0, 1, 2]) {
    const lo = Math.max(a, c + k * 2 * Math.PI), hi = Math.min(b, d + k * 2 * Math.PI);
    if (hi > lo && (!best || hi - lo > best[1] - best[0])) best = [lo, hi];
  }
  return best;
}
// A shape laid out in front-view units round (u0, v0) on a solid, `out` off it.
const local = (S, u0, v0, pts, out = 0.5, vs = 1) =>
  smooth(pts.map(([du, dv, c]) => xy(S.F(u0 + du, v0 + (dv / (S.y1 - S.y0)) * vs, out), c)));
// A tapered stroke along screen points.
function taper(cl, w0, w1, wm = null) {
  const n = cl.length, A = [], B = [];
  const wAt = (t) => (wm == null ? lerp(w0, w1, t) : t < 0.4 ? lerp(w0, wm, Math.sin((t / 0.4) * Math.PI / 2)) : lerp(wm, w1, (t - 0.4) / 0.6));
  for (let i = 0; i < n; i++) {
    const p = cl[Math.max(0, i - 1)], q = cl[Math.min(n - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = wAt(i / (n - 1)) / 2;
    A.push([cl[i][0] - dy * w, cl[i][1] + dx * w]); B.push([cl[i][0] + dy * w, cl[i][1] - dx * w]);
  }
  const t = cl[n - 1];
  return smooth([...A, [t[0], t[1], 1], ...B.reverse()]);
}
// A centreline on the surface ([θ, v, out] keys), densified and projected.
function along(S, keys, sub = 6) {
  const cl = [];
  for (let i = 0; i < keys.length - 1; i++) for (let j = 0; j < sub; j++) {
    const a = keys[i], b = keys[i + 1], t = j / sub;
    cl.push(S.P(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)));
  }
  const l = keys[keys.length - 1];
  cl.push(S.P(l[0], l[1], l[2]));
  return cl;
}
const meanZ = (cl) => cl.reduce((s, p) => s + p[2], 0) / cl.length;

// ---- THE FACE PARTS ---------------------------------------------------------------
// HS's eye (the roster's): a white quad, flat bottom, its top cut on a slant by a heavy lid
// (lower at the nose: determined). `ns` points to the nose. The artist's eye (`round`) is an
// almond with a coloured iris, a lash line and two glints.
function eyeSvg(S, st, ch, ue, ve) {
  const ns = ue > 0 ? -1 : 1, th = S.th(ue, ve), fcv = S.fc(th);
  if (fcv < 0.1) return '';
  const vv = (dv) => dv;
  let out = '';
  if (st.eye === 'hs') {
    const w = 9, top = -8.5, slant = ch.female ? 2.5 : 5;
    const d = local(S, ue, ve, [[-ns * w, vv(top), 1], [ns * w, vv(top + slant), 1], [ns * w, 4], [ns * (w - 3), 7], [0, 7.8], [-ns * (w - 3), 7], [-ns * w, 4]]);
    const iris = st.iris ? ch.eyes.iris : '#4a4550';
    const pr = 5.6, pc = [ns * 1.6, 1.4];
    out += fill(d, '#ffffff');
    out += inside(d,
      line(local(S, ue, ve, [[-ns * (w + 2), top + 2.6], [ns * (w + 2), top + slant + 2.6]], 0.5), '#b9b4c4', 3) +
      fill(local(S, ue + pc[0], ve, circ(0, pc[1], pr * 1.1)), iris) +
      fill(local(S, ue + pc[0], ve, circ(0, pc[1], st.iris ? pr * 0.62 : pr)), '#0d0a0c'));
    const g = S.F(ue + pc[0] + 2, ve + (pc[1] - 2.4) / (S.y1 - S.y0), 0.5);
    out += fill(circle(g[0], g[1], 1.6), '#ffffff');
    out += line(d, INK, 1.1);
    out += line(local(S, ue, ve, [[-ns * (w + 1.5), top - 0.6], [ns * (w + 0.4), top + slant]]), INK, 2.8);
    if (ch.female) out += lashes(S, ue, ve, ns, top);
  } else {
    const w = 8.6;
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, x = Math.cos(a) * w, y = Math.sin(a) > 0 ? Math.sin(a) * 6.6 : Math.sin(a) * 8.6;
      pts.push([x, y]);
    }
    const d = local(S, ue, ve, pts);
    out += fill(d, '#ffffff');
    out += inside(d,
      fill(local(S, ue + ns * 0.8, ve, circ(0, 0.4, 6.2)), ch.eyes.iris) +
      fill(local(S, ue + ns * 0.8, ve, circ(0, 0.8, 3.4)), '#140c0a') +
      line(local(S, ue, ve, pts.slice(7).concat([pts[0]]).map(([x, y]) => [x, y + 1.6])), 'rgba(80,60,70,0.28)', 2.4));
    const g = S.F(ue + ns * 0.8 + 2.2, ve - 2.4 / (S.y1 - S.y0), 0.5), g2 = S.F(ue + ns * 0.8 - 2, ve + 2.6 / (S.y1 - S.y0), 0.5);
    out += fill(circle(g[0], g[1], 1.9), '#ffffff') + fill(circle(g2[0], g2[1], 0.9), '#ffffff');
    out += line(d, INK, 1);
    out += line(local(S, ue, ve, pts.slice(7).concat([pts[0]])), INK, 2.6);
    if (ch.female) out += lashes(S, ue, ve, ns, -7.5);
  }
  return out;
}
const circ = (x, y, r, n = 16) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r]);
function lashes(S, ue, ve, ns, top) {
  let s = '';
  for (const [a, b, c, d] of [[-ns * 8.5, top + 1, -ns * 12.5, top - 2.2], [-ns * 7, top + 0.2, -ns * 10, top - 3.8]]) {
    s += line(smooth([xy(S.F(ue + a, ve + b / (S.y1 - S.y0), 0.6)), xy(S.F(ue + c, ve + d / (S.y1 - S.y0), 0.6))], false), INK, 1.8);
  }
  return s;
}
function browSvg(S, st, ch, ue, ve) {
  const ns = ue > 0 ? -1 : 1, b = ch.brows, t = b.w;
  if (S.fc(S.th(ue, ve)) < 0.08) return '';
  let pts;
  if (st.brow === 'wedge' && !ch.female) {
    pts = [[ns * 11, -11.5, 1], [-ns * 10.5, -16.5], [-ns * 11.5, -16.5 + t * 0.55, 1], [ns * 11, -11.5 + t]];
  } else {
    const arc = [[ns * 10, -12.5], [ns * 3, -16.6], [-ns * 5, -17.4], [-ns * 11.5, -14.2]];
    pts = [...arc.map(([x, y], i) => [x, y - (i === 0 ? 0 : 0.2), i === 0 || i === 3 ? 1 : 0]),
      ...arc.slice().reverse().map(([x, y], i) => [x, y + t * (i === 0 ? 0.25 : i === 3 ? 0.85 : 0.75)])];
  }
  const d = local(S, ue, ve, pts, 0.8);
  return fill(d, b.c) + line(d, INK, 0.9);
}
function mouthSvg(S, kind, ch, vm) {
  if (S.fc(0) < -0.15) return '';
  const lips = ch.lips;
  if (kind === 'smirk') {
    const d = smooth([[-9, 0.6], [-3, 1.6], [4, 0.6], [9.5, -2.4]].map(([u, dv]) => xy(S.F(u, vm + dv / (S.y1 - S.y0), 0.6))), false);
    return line(d, INK, 2) + line(local(S, 0.5, vm, [[-4, 4.4], [0.5, 5.2], [4, 4.4]]), 'rgba(90,40,30,0.45)', 1.4);
  }
  if (kind === 'smile') {
    const up = [[-10, -1.2, 1], [-5, 0.6], [0, 1.2], [5, 0.6], [10, -1.2, 1]], lo = [[10, -1.2], [5, 3.6], [0, 4.6], [-5, 3.6]];
    const d = local(S, 0, vm, [...up, ...lo]);
    return fill(d, lips || '#c8615a') + line(local(S, 0, vm, up.map(([a, b]) => [a, b])), INK, 1.6) + line(d, INK, 0.9);
  }
  // grin: open, top teeth, a tongue
  const W = kind === 'big' ? 15 : 13;
  const up = [[-W, -3, 1], [-W * 0.5, 0], [0, 0.6], [W * 0.5, 0], [W, -3, 1]];
  const lo = [[W * 0.66, 4.5], [0, kind === 'big' ? 10.5 : 9], [-W * 0.66, 4.5]];
  const d = local(S, 0, vm, [...up, ...lo]);
  const teeth = local(S, 0, vm, [[-W - 2, -6], [W + 2, -6], [W + 2, 3.2], [0, 4], [-W - 2, 3.2]]);
  const tongue = local(S, 0, vm, circ(0, 10.5, 6.5));
  return fill(d, '#5c1a16') + inside(d, fill(teeth, '#ffffff') + fill(tongue, '#d9616a')) +
    (lips ? line(d, lips, 2.6) : '') + line(d, INK, 1.4);
}

// ---- THE HAIR -------------------------------------------------------------------------
// The cap: hair on the skin down to the hairline `hl(|θ|)`, `out` off it, in two halves (the one
// behind the head is drawn before it). Locks, curls and strands are the volume on top.
function capSvg(S, cap, half) {
  const hl = (th) => tbl(cap.line, Math.abs(Math.atan2(Math.sin(th), Math.cos(th))));
  const [a, b] = half === 'front' ? S.vis : [S.vis[1], S.vis[0] + 2 * Math.PI];
  const out = (th, v) => cap.out * (cap.taper ? clamp((hl(th) - v) / 0.12, 0.25, 1) : 1);
  return region(S, a, b, () => 0, hl, out, 48, 8);
}
function hairEls(S, hair, rimC) {
  const els = [];
  for (const h of hair.els) {
    const c = h.c || hair.c;
    if (h.t === 'lock') {
      const cl = along(S, h.k);
      const d = h.w.length === 3 ? taper(cl.map((p) => [p[0], p[1]]), h.w[0], h.w[2], h.w[1]) : taper(cl.map((p) => [p[0], p[1]]), h.w[0], h.w[1]);
      const wm = Math.max(...h.w);
      const hi = cl.slice(1, -2).map((p) => [p[0] - 0.5, p[1] - 1.2]);
      els.push({ z: meanZ(cl), d, svg: fill(d, c.base) + inside(d, line(smooth(hi, false), c.hi, wm * 0.2) + line(smooth(cl.map((p) => [p[0] + wm * 0.12, p[1] + wm * 0.16]), false), c.shade, wm * 0.32)) + line(d, INK, 1) });
    } else if (h.t === 'curl') {
      const p = S.P(...h.at), r = h.r, sp = h.spin;
      const d = circle(p[0], p[1], r);
      const arc = (a0, a1, rr, ox = 0, oy = 0) => smooth([0, 1, 2, 3, 4].map((i) => { const a = a0 + ((a1 - a0) * i) / 4; return [p[0] + ox + Math.cos(a) * rr, p[1] + oy + Math.sin(a) * rr]; }), false);
      els.push({ z: p[2], d, svg: fill(d, c.base) + inside(d, fill(circle(p[0] + r * 0.45, p[1] + r * 0.5, r * 0.95), c.shade) + fill(circle(p[0] - r * 0.08, p[1] - r * 0.06, r * 0.8), c.base)) +
        line(arc(sp, sp + 3.6, r * 0.5), c.shade, 1.4) + line(arc(3.6, 4.9, r * 0.66), c.hi, 1.5) + line(d, INK, 1) });
    } else if (h.t === 'strand') {
      const cl = along(S, h.k, 5);
      // it hangs straight down, flaring a little the way its own side of the head faces
      const last = cl[cl.length - 1], lat = Math.sin(h.k[0][0] + S.yaw), side = Math.sign(lat) || 1;
      for (let i = 1; i <= 4; i++) cl.push([last[0] + lat * h.flare * i, last[1] + (h.hang * i) / 4, last[2]]);
      const d = taper(cl.map((p) => [p[0], p[1]]), h.w[0], h.w[1], h.w[2]);
      const z = S.fc(h.k[0][0]);
      els.push({ z: z * 50, strand: true, d, svg: fill(d, c.base) + inside(d, line(smooth(cl.slice(3).map((p) => [p[0] - side * h.w[0] * 0.3, p[1]]), false), c.shade, h.w[0] * 0.28) + line(smooth(cl.slice(2, -3).map((p) => [p[0] + side * h.w[0] * 0.1, p[1]]), false), c.hi, 1.3)) });
    }
  }
  return els;
}

// ---- THE BODY: the roster's small suit and boots, in the kit's colours ---------------------
const BODIES = { full: { tB: 28, sB: 38, lB: 48, bH: 10 }, game: { tB: 6, sB: 11, lB: 13, bH: 10 } };
function bodySvg(V, ch, st, kind, keys) {
  const k = ch.kit, B = BODIES[kind], chin = V.head.y1, yaw = V.yaw;
  const torso = solid({ cx: V.cx, y0: chin - 20, y1: chin + B.tB, Rx: 27, Rz: 18, n: 2.4, r: [[0, 0.84], [0.18, 1], [1, 0.9]], yaw });
  const shorts = solid({ cx: V.cx, y0: chin + B.tB - 1.5, y1: chin + B.sB, Rx: 25, Rz: 17, n: 2.4, r: [[0, 0.98], [1, 1.04]], yaw });
  const legs = [-10, 10].map((ox) => solid({ cx: V.cx, ox, y0: chin + B.sB - 2, y1: chin + B.lB, Rx: 5.6, Rz: 5.6, n: 2, r: [[0, 1], [1, 1]], yaw }));
  let s = '';
  // legs and boots, the far one first
  const order = legs.map((L, i) => ({ L, z: -L.ox * Math.sin(yaw) })).sort((a, b) => a.z - b.z);
  for (const { L } of order) {
    const ld = hull(L, () => 0, 0, 1, 6, 48);
    keys.push(ld);
    s += fill(ld, k.socks.base) + inside(ld, (region(L, ...L.vis, () => 0.3, () => 0.5) ? fill(region(L, ...L.vis, () => 0.3, () => 0.52), k.socks.band) : '')) + line(ld, INK, 1.4);
    const bd = boot(L, yaw, chin + B.lB, B.bH);
    keys.push(bd.d);
    s += fill(bd.d, k.boots.base) + inside(bd.d, fill(bd.sole, k.boots.sole) + bd.stripes.map((d) => line(d, k.boots.stripe, 1.6)).join('')) + line(bd.d, INK, 1.4);
  }
  const sd = hull(shorts, () => 0, 0, 1, 6, 64);
  keys.push(sd);
  s += fill(sd, k.shorts.base) + inside(sd, shadeBands(shorts, k.shorts.shade) + [Math.PI / 2, -Math.PI / 2].map((c) => { const r = cut(shorts.vis, c - 0.13, c + 0.13); return r ? fill(region(shorts, r[0], r[1], () => 0, () => 1, () => 0.3, 8, 4), k.shorts.stripe) : ''; }).join('')) + line(sd, INK, 1.4);
  const td = hull(torso, () => 0, 0, 1, 12, 64);
  keys.push(td);
  let deco = shadeBands(torso, k.shirt.shade);
  const yr = cut(torso.vis, k.yokeBack ? -Math.PI : -Math.PI / 2 - 0.25, k.yokeBack ? Math.PI : Math.PI / 2 + 0.25);
  if (yr) { const yd = region(torso, yr[0], yr[1], () => 0, () => 0.46, () => 0.3); deco += fill(yd, k.yoke) + line(region(torso, yr[0], yr[1], () => 0.46, () => 0.47, () => 0.3, 30, 1), INK, 0.8); }
  if (k.yokeBack && !cut(torso.vis, -Math.PI / 2, Math.PI / 2)) { /* back only: the yoke drew already */ }
  if (torso.fc(0) > -0.1) {
    const vd = local(torso, 0, 0, [[-9, 0, 1], [0, 13], [9, 0, 1], [6, 0, 1], [0, 9.5], [-6, 0, 1]], 0.4);
    deco += fill(vd, k.trim) + line(vd, INK, 0.7);
  }
  if (torso.fc(0) > 0.2) deco += num(torso, 0, 0.72, k, 13);
  if (torso.fc(Math.PI) > 0.2) deco += num(torso, Math.PI, 0.66, k, 19);
  const bth = torso.th(9.5, 0.4);
  if (torso.fc(bth) > 0.15) { const hd = local(torso, 9.5, 0.4, circ(0, 0, 3.6, 6).map(([x, y]) => [x, y, 1]), 0.5); deco += fill(hd, k.badge) + line(hd, INK, 0.8); }
  if (ch.necklace && torso.fc(0) > 0.1) {
    const nd = smooth([[-10, 0.04], [-5, 0.22], [0, 0.3], [5, 0.22], [10, 0.04]].map(([u, t]) => xy(torso.U(u, t, 0.6))), false);
    const pd = torso.U(0, 0.33, 0.7);
    deco += line(nd, '#e8b830', 1.3) + fill(circle(pd[0], pd[1], 1.8), '#f6cf45') + line(circle(pd[0], pd[1], 1.8), INK, 0.6);
  }
  s += fill(td, k.shirt.base) + inside(td, deco) + line(td, INK, 1.4);
  return s;
}
function shadeBands(S, c) {
  const t = Math.acos(0.42);
  return [[S.vis[0], -t - S.yaw], [t - S.yaw, S.vis[1]]].map(([a, b]) => (b > a ? fill(region(S, a, b, () => 0, () => 1, () => 0.2, 10, 4), c) : '')).join('');
}
function num(S, th, t, k, size) {
  const p = S.P(th, t, 0.4), sx = Math.max(0.05, S.fc(th));
  return `<text x="0" y="0" transform="translate(${f1(p[0])} ${f1(p[1] + size * 0.36)}) scale(${sx.toFixed(2)} 1)" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" fill="${k.num}" stroke="${k.numLine || 'none'}" stroke-width="${k.numLine ? 1.4 : 0}" paint-order="stroke">${k.n}</text>`;
}
function boot(L, yaw, y0, h) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const X = (x, z) => L.cx + x * cs + z * sn;
  const xs = [[-5, -6], [5, -6], [-5, 13], [5, 13]].map(([x, z]) => X(L.ox + x, z));
  const mn = Math.min(...xs), mx = Math.max(...xs), toe = Math.abs(sn) < 0.3 ? 0 : Math.sign(sn), yb = y0 + h;
  let d;
  if (!toe) d = smooth([[mn, yb, 1], [mn - 0.5, y0 + 3], [lerp(mn, mx, 0.5), y0 - 1], [mx + 0.5, y0 + 3], [mx, yb, 1]]);
  else {
    const heel = toe > 0 ? mn : mx, tip = toe > 0 ? mx : mn, w = tip - heel;
    d = smooth([[heel, yb, 1], [heel - toe * 0.5, y0 + 1], [heel + w * 0.35, y0 - 1], [heel + w * 0.62, y0 + 3], [tip, y0 + 5.5], [tip + toe * 0.5, yb - 1.2], [tip - toe * 1.5, yb, 1]]);
  }
  const sole = poly([[mn - 3, yb - 2.2], [mx + 3, yb - 2.2], [mx + 3, yb + 3], [mn - 3, yb + 3]]);
  const stripes = [0.34, 0.5].map((t) => { const x = lerp(mn, mx, toe < 0 ? 1 - t : t); return `M${f1(x - 1.4 * (toe || 1))} ${f1(y0 + 1.5)}L${f1(x + 1.4 * (toe || 1))} ${f1(yb - 3)}`; });
  return { d, sole, stripes };
}

// ---- THE BODY ALONE, for the heads traced from the sheets (tools/chars/mythic_trace.py) ----------
// Its collar sits under a chin at y = `chin`; the page lays the head image over it.
export function renderBody(ch, yawDeg, kind = 'full', chin = 134) {
  begin();
  const V = { cx: 100, yaw: (yawDeg * Math.PI) / 180, head: { y1: chin } };
  const keys = [];
  const b = bodySvg(V, ch, {}, kind, keys);
  const s = `<g fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round">${keys.map((d) => `<path d="${d}"/>`).join('')}</g>` + b;
  const pre = `m${++RENDERS}`;
  return end(s).replace(/viewBox="[^"]*" width="\d+" height="\d+"/, `x="0" y="0" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}"`)
    .replace(/id="([a-z]+\d+)"/g, `id="${pre}$1"`).replace(/url\(#([a-z]+\d+)\)/g, `url(#${pre}$1)`);
}

// ---- THE WHOLE CHARACTER (the first, all-model version: superseded by the traced heads) ---------------------------------------------------------------
// render(character, option style, yaw in degrees, 'full' | 'game') -> an SVG string.
export function render(ch, st, yawDeg, kind = 'full') {
  begin();
  const yaw = (yawDeg * Math.PI) / 180, cx = 100, top = 34;
  const H = HEADS[st.head];
  const head = solid({ cx, y0: top, y1: top + H.H, Rx: H.Rx, Rz: H.Rz, n: H.n, nf: 2.3, r: H.r, yaw, crown: true });
  const V = { cx, yaw, head };
  const sil = hull(head, () => 0, 0, 1);
  const keys = [sil];
  const capD = { front: capSvg(head, ch.hair.cap, 'front'), back: capSvg(head, ch.hair.cap, 'back') };
  const els = hairEls(head, ch.hair, st.rim);
  const layer = { back: [], mid: [], front: [] };
  for (const e of els) {
    keys.push(e.d);
    const zn = e.z / 50;
    (e.strand ? (zn < -0.08 ? layer.back : zn < 0.05 ? layer.mid : layer.front) : (zn < -0.45 ? layer.back : zn < -0.02 ? layer.mid : layer.front)).push(e);
  }
  for (const L of Object.values(layer)) L.sort((a, b) => a.z - b.z);
  if (capD.front) keys.push(capD.front);
  if (capD.back) keys.push(capD.back);
  const capC = ch.hair.cap.c || ch.hair.c;

  // ears: behind the head when turned away, on it when turned toward us
  const ears = [-1, 1].map((sd) => {
    const th = sd * 1.5, f = head.fc(th), p = head.P(th, 0.56, 2.5), o = Math.sign(p[0] - cx) || sd;
    const rx = 3.2 + 4.6 * Math.abs(f), x = p[0] + o * (1 - Math.abs(f)) * 4.2;
    const d = ellipse(x, p[1], rx, 10);
    const inner = Math.abs(f) > 0.35 ? fill(ellipse(x + o * 0.6, p[1] + 0.6, rx * 0.55, 6.4), ch.skin.mid) + line(smooth([[x - o * rx * 0.1, p[1] - 5.5], [x + o * rx * 0.45, p[1] - 1], [x + o * rx * 0.1, p[1] + 4.5]], false), ch.skin.dark, 1.4) : '';
    return { f, d, svg: fill(d, ch.skin.base) + inside(d, inner) + line(d, INK, 1.1) };
  });
  if (!ch.hair.hideEars) ears.forEach((e) => keys.push(e.d));

  // beard / stubble region
  const beard = ch.beard ? beardRegion(head, ch.beard) : null;
  if (beard && ch.beard.kind === 'full') keys.push(beard);

  // the nose: a bulb from the skin to its tip, which turns with the head
  const nb = head.F(0, 0.645, 0), nt = head.F(0, 0.645, 8);
  const nose = ellipse((nb[0] + nt[0]) / 2, nb[1] + 0.5, 5.2 + Math.abs(nt[0] - nb[0]) * 0.5, 6.4);
  keys.push(nose);

  let s = '';
  if (st.aura) s += auraSvg();
  if (st.sticker) s += `<g fill="#ffffff" stroke="#ffffff" stroke-width="15" stroke-linejoin="round">${keys.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  // keyline: body parts are added to keys inside bodySvg, so paint the body into a buffer first
  const bodyKeys = [];
  const bodyS = bodySvg(V, ch, st, kind, bodyKeys);
  if (st.sticker) s += `<g fill="#ffffff" stroke="#ffffff" stroke-width="15" stroke-linejoin="round">${bodyKeys.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  s += `<g fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round">${[...keys, ...bodyKeys].map((d) => `<path d="${d}"/>`).join('')}</g>`;

  s += layer.back.map((e) => e.svg).join('');
  s += bodyS;
  if (capD.back) s += fill(capD.back, capC.base) + line(capD.back, INK, 1);
  s += layer.mid.map((e) => e.svg).join('');
  if (!ch.hair.hideEars) s += ears.filter((e) => e.f < 0.25).map((e) => e.svg).join('');

  // the skin, lit from the front: the back side and the edges in the mid tone, a pale muzzle
  let face = fill(sil, ch.skin.base);
  let shade = shadeBands(head, ch.skin.mid);
  if (st.muzzle && head.fc(0) > -0.2) shade += fill(local(head, 0, 0.86, circ(0, 0, 1, 24).map(([x, y]) => [x * 38, y * 21]), 0), ch.skin.light, 'opacity="0.6"');
  shade += fill(region(head, ...head.vis, () => 0.95, () => 1.02, () => 0, 30, 2), ch.skin.mid);
  if ((st.blush || ch.blush) && head.fc(0) > 0) for (const u of [-25, 25]) if (head.fc(head.th(u, 0.68)) > 0.15) shade += fill(local(head, u, 0.69, circ(0, 0, 1).map(([x, y]) => [x * 7, y * 4]), 0.3), 'rgba(240,110,120,0.4)');
  if (beard && ch.beard.kind !== 'full') shade += fill(beard, ch.beard.c, `opacity="${ch.beard.alpha}"`);
  face += inside(sil, shade);
  const ue = ch.eyes.u || 22, ve = 0.5;
  let feat = '';
  for (const u of [-ue, ue]) feat += browSvg(head, st, ch, u, ve) + eyeSvg(head, st, ch, u, ve);
  face += inside(sil, feat);
  s += face + line(sil, INK, 1.2);
  if (beard && ch.beard.kind === 'full') s += beardSvg(head, beard, ch.beard);
  const vm = st.head === 'soft' ? 0.8 : 0.81;
  s += inside(beard && ch.beard.kind === 'full' ? `${sil} ${beard}` : sil, mouthSvg(head, ch.mouth[st.key], ch, vm));
  if (head.fc(0) > -0.35) {
    const ncx = (nb[0] + nt[0]) / 2, nrx = 5.2 + Math.abs(nt[0] - nb[0]) * 0.5, tw = Math.sign(nt[0] - nb[0]);
    const under = smooth([[ncx - nrx * (tw > 0 ? 0.55 : 1), nb[1] + 3.2], [ncx, nb[1] + 6.6], [ncx + nrx * (tw < 0 ? 0.55 : 1), nb[1] + 3.2], [ncx + tw * nrx * 0.9, nb[1] - 3.5]].slice(0, tw ? 4 : 3), false);
    s += fill(nose, ch.skin.base) + inside(nose, fill(ellipse(ncx - tw * nrx * 0.45, nb[1] + 1.5, nrx * 0.7, 5.6), ch.skin.mid) + fill(ellipse(ncx + tw * 1.2, nb[1] - 1.2, 2.6, 2.2), ch.skin.light)) + line(under, INK, 1.3);
    if (Math.abs(tw) < 1 || Math.abs(nt[0] - nb[0]) < 4) for (const sd of [-1, 1]) s += fill(ellipse(ncx + sd * 2.6, nb[1] + 3.6, 1.1, 0.8), ch.skin.dark);
    else s += fill(ellipse(ncx - tw * 1.2, nb[1] + 3.8, 1.3, 0.9), ch.skin.dark);
  }
  if (!ch.hair.hideEars) s += ears.filter((e) => e.f >= 0.25).map((e) => e.svg).join('');
  if (ch.glasses) s += glassesSvg(head, ch.glasses, ue, ve);
  if (capD.front) s += fill(capD.front, capC.base) + inside(capD.front, ch.hair.cap.root ? fill(region(head, ...head.vis, () => 0, () => ch.hair.cap.root.v, () => ch.hair.cap.out, 40, 4), ch.hair.cap.root.c) : '') + line(capD.front, INK, 1);
  s += layer.front.map((e) => e.svg).join('');
  s += rimSvg(head, [sil, capD.front, capD.back, ...els.map((e) => e.d)].filter(Boolean), st);
  // Many of these sit inline in one page, and kit.js numbers its clip ids from 1 in each: give
  // every drawing its own, or one drawing clips to another's shapes.
  const pre = `m${++RENDERS}`;
  return end(s).replace(/viewBox="[^"]*" width="\d+" height="\d+"/, `viewBox="0 0 ${VW} ${VH}"`)
    .replace(/id="([a-z]+\d+)"/g, `id="${pre}$1"`).replace(/url\(#([a-z]+\d+)\)/g, `url(#${pre}$1)`);
}

function beardRegion(S, b) {
  const top = (th) => tbl(b.top, Math.abs(th)), bot = (th) => tbl(b.bot, Math.abs(th));
  const r = cut(S.vis, -b.span, b.span);
  if (!r) return null;
  const out = (th, v) => (b.kind === 'full' ? lerp(b.out[0], b.out[1], clamp((v - 0.7) / 0.4, 0, 1)) : 0.3);
  return region(S, r[0], r[1], top, bot, out, 40, 6);
}
function beardSvg(S, d, b) {
  const c = b.c;
  let tex = '';
  for (let i = -5; i <= 5; i++) {
    const th = i * 0.2;
    if (S.fc(th) < 0.15) continue;
    const a = S.P(th, 0.86, b.out[1] * 0.6), z = S.P(th * 0.92, 1.0, b.out[1] * 0.8);
    tex += line(`M${f1(a[0])} ${f1(a[1])}L${f1(z[0])} ${f1(z[1])}`, c.shade, 1.5);
  }
  const hi = [];
  for (let i = -4; i <= 4; i++) { const p = S.P(i * 0.17, 0.92, b.out[1] * 0.7); if (S.fc(i * 0.17) > 0.1) hi.push(xy(p)); }
  if (hi.length > 1) tex += line(smooth(hi, false), c.hi, 1.6);
  return fill(d, c.base) + inside(d, tex) + line(d, INK, 1.1);
}
function glassesSvg(S, g, ue, ve) {
  let s = '';
  const rims = [];
  for (const u of [-ue, ue]) {
    if (S.fc(S.th(u, ve)) < -0.05) continue;
    const pts = [[-12, -8.5, 0], [12, -8.5, 0], [12.8, 0], [12, 7.5], [-12, 7.5], [-12.8, 0]];
    const d = local(S, u, ve + 0.005, pts, 4);
    rims.push(d);
    s += fill(d, 'rgba(220,240,255,0.16)');
  }
  // the bridge, and each arm back to the ear (only what faces us)
  const br = smooth([xy(S.F(-ue + 12.4, ve - 0.02, 4)), xy(S.F(0, ve - 0.035, 5)), xy(S.F(ue - 12.4, ve - 0.02, 4))], false);
  if (S.fc(0) > -0.2) { s += line(br, INK, 4.2) + line(br, g.c, 2.2); }
  for (const sd of [-1, 1]) {
    const t0 = S.th(sd * (ue + 12.6), ve), arm = [];
    for (let i = 0; i <= 10; i++) { const th = lerp(t0, sd * 1.5, i / 10); if (S.fc(th) > 0.02) arm.push(xy(S.P(th, ve - 0.02 + i * 0.004, 3.5))); }
    if (arm.length > 1) { const d = smooth(arm, false); s += line(d, INK, 4) + line(d, g.c, 2); }
  }
  for (const d of rims) s += line(d, INK, 4.6) + line(d, g.c, 2.6) + line(d, g.hi, 0.8, 'opacity="0.7"');
  return s;
}
// The rim light: the hair-and-head silhouette minus a copy of itself nudged down and toward the
// face leaves a crescent along the top and back edges only, wherever those edges are (hair tips
// included), the way HS lights its heads from behind.
function rimSvg(S, ds, st) {
  const c = st.rim === 'mythic' ? `url(#${mythicGrad()})` : '#ffd24a';
  const sn = Math.sin(S.yaw), dx = Math.abs(sn) > 0.3 ? Math.sign(sn) * 2.8 : 0, dy = st.rim === 'mythic' ? 3.6 : 3;
  const id = uid('rm'), all = ds.map((d) => `<path d="${d}"/>`).join('');
  def(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${VW}" height="${VH}"><g fill="#fff">${all}</g><g fill="#000" transform="translate(${dx} ${dy})">${all}</g></mask>`);
  return `<rect x="0" y="0" width="${VW}" height="${VH}" fill="${c}" mask="url(#${id})"/>`;
}
function mythicGrad() {
  const id = uid('my');
  def(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6ad5"/><stop offset=".4" stop-color="#8b7bff"/><stop offset=".7" stop-color="#4ff0ff"/><stop offset="1" stop-color="#ffe46a"/></linearGradient>`);
  return id;
}
function auraSvg() {
  const id = uid('au');
  def(`<radialGradient id="${id}" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#b48cff" stop-opacity=".55"/><stop offset=".55" stop-color="#6ad8ff" stop-opacity=".18"/><stop offset="1" stop-color="#6ad8ff" stop-opacity="0"/></radialGradient>`);
  return `<rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#${id})"/>`;
}
