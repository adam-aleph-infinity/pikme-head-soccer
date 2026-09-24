// THE FITS. Pure functions from a track to a number — no DOM, no fs.
//
// One library, two callers, and that is the whole reason it exists: `_hs-fit.mjs` runs it on
// tracks clicked out of Head Soccer recordings, and the parity harness runs the SAME functions
// on tracks recorded from our own sim. A number is only comparable with another number that
// was measured the same way — "gravity" fitted from a parabola over eight noisy video frames
// and "gravity" read from constants.js are not the same quantity, however similar they look.
//
// Conventions, both sides:
//   a point is {t, x, y}: seconds, world pixels, y DOWN (shared/sim.js's convention)
//   every metric returns {value, sd, n} — value null and n 0 when it cannot be measured
//   n counts the independent things measured (flights, bounces, jumps, kicks), not frames
//
// Units follow: px, s, px/s, px/s². A gravity of +1500 means the ball accelerates DOWN.

export const NONE = Object.freeze({ value: null, sd: null, n: 0 });

// ─── small statistics ─────────────────────────────────────────────────────────────────────────

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function sampleSd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((p, q) => p - q);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

// Many estimates of one thing → one. Spread across estimates beats any single estimate's own
// error bar once there are two or more, because it includes what the error bar cannot (a
// misclicked frame, a take that was played slightly differently).
export function combine(results) {
  const ok = results.filter((r) => r && r.value != null && Number.isFinite(r.value));
  if (!ok.length) return NONE;
  if (ok.length === 1) return { value: ok[0].value, sd: ok[0].sd ?? 0, n: ok[0].n ?? 1 };
  const vals = ok.map((r) => r.value);
  return { value: mean(vals), sd: sampleSd(vals), n: ok.reduce((s, r) => s + (r.n ?? 1), 0) };
}

// ─── least squares ────────────────────────────────────────────────────────────────────────────

// Polynomial fit of degree 1 or 2 in (t − t0), with the coefficients' standard errors.
// t0 is the first sample's time so the normal equations stay well conditioned.
export function polyfit(ts, ys, deg = 2, t0 = ts[0]) {
  const n = ts.length, m = deg + 1;
  if (n < m) return null;
  const X = ts.map((t) => { const u = t - t0; return deg === 2 ? [1, u, u * u] : [1, u]; });
  const XtX = Array.from({ length: m }, () => new Array(m).fill(0));
  const Xty = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < m; a++) {
      Xty[a] += X[i][a] * ys[i];
      for (let b = 0; b < m; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const inv = invert(XtX);
  if (!inv) return null;
  const c = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  let rss = 0;
  for (let i = 0; i < n; i++) rss += (ys[i] - X[i].reduce((s, v, j) => s + v * c[j], 0)) ** 2;
  const dof = n - m;
  const s2 = dof > 0 ? rss / dof : 0;
  const se = inv.map((row, j) => Math.sqrt(Math.max(0, row[j] * s2)));
  // cov(c1, c2) is needed to put an error bar on a velocity evaluated away from t0.
  const cov = inv.map((row) => row.map((v) => v * s2));
  return { deg, t0, c, se, cov, rmse: Math.sqrt(rss / n), n };
}

function invert(M) {
  const m = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-15) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * m; j++) A[c][j] /= d;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const k = A[r][c];
      for (let j = 0; j < 2 * m; j++) A[r][j] -= k * A[c][j];
    }
  }
  return A.map((row) => row.slice(m));
}

export const evalPos = (f, t) => { const u = t - f.t0; return f.c[0] + f.c[1] * u + (f.deg === 2 ? f.c[2] * u * u : 0); };
export const evalVel = (f, t) => { const u = t - f.t0; return f.c[1] + (f.deg === 2 ? 2 * f.c[2] * u : 0); };
export function velSd(f, t) {
  const u = t - f.t0;
  if (f.deg === 1) return f.se[1];
  // var(c1 + 2u·c2) = var c1 + 4u² var c2 + 4u cov(c1,c2)
  return Math.sqrt(Math.max(0, f.cov[1][1] + 4 * u * u * f.cov[2][2] + 4 * u * f.cov[1][2]));
}

// ─── tracks → points ──────────────────────────────────────────────────────────────────────────

// frames: the .tracks.json `frames` array (or a sim recording shaped the same). Duplicate
// frames are skipped: a repeated frame is the same instant shown twice, and fitting it as a
// second sample at a later time invents a pause in the motion.
export function series(frames, obj) {
  const out = [];
  for (const f of frames) {
    if (f.dup) continue;
    const p = f[obj];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push({ t: f.t, x: p.x, y: p.y, i: f.i });
  }
  return out;
}

const velocities = (pts, axis) => {
  const v = [];
  for (let k = 0; k + 1 < pts.length; k++) v.push((pts[k + 1][axis] - pts[k][axis]) / (pts[k + 1].t - pts[k].t));
  return v;
};

// Contacts nobody tagged: an abrupt jump in frame-to-frame velocity along `axis`. Gravity
// changes vy by g·dt per frame, click noise by a few tens of px/s; a bounce reverses it by
// hundreds. The threshold is 6× the typical frame-to-frame change, floored at minDv.
// Returns contact TIMES (the time of the frame the change happens across).
export function detectContacts(pts, { axis = 'y', minDv = 150 } = {}) {
  const v = velocities(pts, axis);
  const dv = [];
  for (let k = 0; k + 1 < v.length; k++) dv.push(v[k + 1] - v[k]);
  if (!dv.length) return [];
  const typical = median(dv.map(Math.abs));
  const thr = Math.max(minDv, 6 * typical);
  const out = [];
  for (let k = 0; k < dv.length; k++) {
    if (Math.abs(dv[k]) <= thr) continue;
    // One contact smears over two velocity changes when it lands between frames; keep the bigger.
    if (out.length && k - out[out.length - 1].k <= 1) {
      if (Math.abs(dv[k]) > out[out.length - 1].mag) out[out.length - 1] = { k, mag: Math.abs(dv[k]) };
      continue;
    }
    out.push({ k, mag: Math.abs(dv[k]) });
  }
  return out.map(({ k }) => pts[k + 1].t);
}

// Cut a track into free flights at the given contact times (tagged, detected, or both). The
// frame AT a contact belongs to neither side — the ball is mid-squash there.
export function freeFlights(pts, contactTimes, { minPts = 5, eps = 1e-6 } = {}) {
  const cuts = [...new Set(contactTimes)].sort((a, b) => a - b);
  const segs = [];
  let cur = [];
  let ci = 0;
  for (const p of pts) {
    while (ci < cuts.length && cuts[ci] < p.t - eps) { if (cur.length) segs.push(cur); cur = []; ci++; }
    if (ci < cuts.length && Math.abs(cuts[ci] - p.t) <= eps) { if (cur.length) segs.push(cur); cur = []; ci++; continue; }
    cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs.filter((s) => s.length >= minPts);
}

// ─── gravity ──────────────────────────────────────────────────────────────────────────────────

// One parabola per free flight; g = 2·c2 of y(t). Combined weighted by each flight's own error
// bar, reported with the spread across flights.
export function fitGravity(pts, contactTimes = null, { minPts = 6, axis = 'y' } = {}) {
  const cuts = contactTimes ?? detectContacts(pts, { axis });
  const per = [];
  for (const seg of freeFlights(pts, cuts, { minPts })) {
    // A ball lying still is not a flight: its parabola is a flat line with a tiny error bar,
    // and weighted in with the real flights it drags the gravity to zero.
    const ys = seg.map((p) => p[axis]);
    if (Math.max(...ys) - Math.min(...ys) < 3) continue;
    const f = polyfit(seg.map((p) => p.t), ys, 2);
    if (f) per.push({ value: 2 * f.c[2], sd: 2 * f.se[2], n: 1 });
  }
  return weighted(per);
}

function weighted(per) {
  if (!per.length) return NONE;
  if (per.length === 1) return per[0];
  let sw = 0, sv = 0;
  for (const r of per) { const w = 1 / Math.max(r.sd, 1e-9) ** 2; sw += w; sv += w * r.value; }
  return { value: sv / sw, sd: sampleSd(per.map((r) => r.value)), n: per.length };
}

// ─── restitution ──────────────────────────────────────────────────────────────────────────────

// e = −v_after / v_before along `axis`, each velocity taken from a fit to the free flight on
// that side of the contact, evaluated AT the contact. The contact time is where the two fitted
// curves meet (the ball can't be in two places), which lands between frames; the tagged frame
// is only the fallback.
//
//   axis 'y' for ground / crossbar / ceiling / head, 'x' for walls.
//   win: at most this many points either side (local, so drag and spin matter less).
//   at:  evaluate only these contacts (say, the ones tagged "wall"), while every contact in
//        contactTimes still bounds the flights — a ground bounce next to a wall bounce must
//        not leak into the wall bounce's fit.
//   surface: (t) => the struck surface's own velocity along `axis` at t — a head rising from
//        its jump, say. e is then RELATIVE to it: −(v_after − v_s) / (v_before − v_s).
export function fitRestitution(pts, contactTimes = null, { axis = 'y', win = 10, minPts = 3, at = null, surface = null } = {}) {
  // A contact the track shows a frame away from where it was TAGGED is the same contact (the
  // bounce lands between frames, and the eye and the velocity jump pick neighbouring ones), so
  // a cut within 1.5 frames of an evaluated contact is dropped rather than left to starve it.
  const near = 1.5 * (median(pts.slice(1).map((p, k) => p.t - pts[k].t)) || 1 / 60);
  const cuts = [...new Set([...(contactTimes ?? detectContacts(pts, { axis })), ...(at ?? [])])]
    .filter((t) => !at || at.some((s) => Math.abs(s - t) < 1e-6) || !at.some((s) => Math.abs(s - t) < near))
    .sort((a, b) => a - b);
  const per = [];
  for (let c = 0; c < cuts.length; c++) {
    const tc0 = cuts[c];
    if (at && !at.some((t) => Math.abs(t - tc0) < 1e-6)) continue;
    const lo = c > 0 ? cuts[c - 1] : -Infinity, hi = c + 1 < cuts.length ? cuts[c + 1] : Infinity;
    const before = pts.filter((p) => p.t < tc0 - 1e-6 && p.t > lo + 1e-6).slice(-win);
    const after = pts.filter((p) => p.t > tc0 + 1e-6 && p.t < hi - 1e-6).slice(0, win);
    if (before.length < minPts || after.length < minPts) continue;
    const fit = (s) => polyfit(s.map((p) => p.t), s.map((p) => p[axis]), s.length >= 4 ? 2 : 1);
    const fb = fit(before), fa = fit(after);
    if (!fb || !fa) continue;
    const tc = meetTime(fb, fa, before[before.length - 1].t, after[0].t) ?? tc0;
    const vs = surface ? surface(tc) : 0;
    const vb = evalVel(fb, tc) - vs, va = evalVel(fa, tc) - vs;
    if (Math.abs(vb) < 1e-6 || Math.sign(va) === Math.sign(vb)) continue;
    const e = -va / vb;
    const sd = Math.abs(e) * Math.hypot(velSd(fa, tc) / va, velSd(fb, tc) / vb);
    per.push({ value: e, sd, n: 1, t: tc });
  }
  const out = combine(per);
  return per.length ? { ...out, n: per.length, each: per.map((r) => r.value) } : NONE;
}

// Where two fitted position curves cross, inside [ta, tb]. null if they don't.
function meetTime(f1, f2, ta, tb) {
  const d = (t) => evalPos(f1, t) - evalPos(f2, t);
  const N = 40;
  let prevT = ta, prevD = d(ta);
  if (prevD === 0) return ta;
  for (let k = 1; k <= N; k++) {
    const t = ta + ((tb - ta) * k) / N;
    const dt = d(t);
    if (Math.sign(dt) !== Math.sign(prevD)) {
      let a = prevT, b = t;
      for (let it = 0; it < 40; it++) { const m = (a + b) / 2; if (Math.sign(d(m)) === Math.sign(d(a))) a = m; else b = m; }
      return (a + b) / 2;
    }
    prevT = t; prevD = dt;
  }
  return null;
}

// ─── running ──────────────────────────────────────────────────────────────────────────────────

// Speed at each point from a local linear fit over `half` points either side — frame-to-frame
// differences are too noisy to threshold at 10%.
export function speeds(pts, axis = 'x', half = 2) {
  return pts.map((p, k) => {
    const s = pts.slice(Math.max(0, k - half), k + half + 1);
    const f = polyfit(s.map((q) => q.t), s.map((q) => q[axis]), 1);
    return { t: p.t, v: f ? f.c[1] : 0 };
  });
}

// Top speed: the longest stretch at ≥ 90% of the peak speed, and a straight line through the
// positions there. The line, not the peak: a peak is one noisy sample, a plateau's slope is
// all of them.
export function fitTopSpeed(pts, { axis = 'x', frac = 0.9 } = {}) {
  if (pts.length < 6) return NONE;
  const sp = speeds(pts, axis);
  const vmax = Math.max(...sp.map((s) => Math.abs(s.v)));
  if (!(vmax > 0)) return NONE;
  let best = [0, -1], a = -1;
  for (let k = 0; k <= sp.length; k++) {
    const on = k < sp.length && Math.abs(sp[k].v) >= frac * vmax;
    if (on && a < 0) a = k;
    if (!on && a >= 0) { if (k - a > best[1] - best[0] + 1) best = [a, k - 1]; a = -1; }
  }
  const plat = pts.slice(best[0], best[1] + 1);
  if (plat.length < 3) return { value: vmax, sd: vmax * 0.1, n: 1 };
  const f = polyfit(plat.map((p) => p.t), plat.map((p) => p[axis]), 1);
  return { value: Math.abs(f.c[1]), sd: f.se[1], n: 1, t0: plat[0].t, t1: plat[plat.length - 1].t };
}

// The time the speed first crosses `level`, interpolated between samples, searching from k0
// in direction dir (+1 rising, −1 falling-after).
function crossing(sp, level, k0, rising) {
  for (let k = Math.max(1, k0); k < sp.length; k++) {
    const a = Math.abs(sp[k - 1].v), b = Math.abs(sp[k].v);
    if (rising ? (a < level && b >= level) : (a > level && b <= level)) {
      return sp[k - 1].t + ((level - a) / (b - a)) * (sp[k].t - sp[k - 1].t);
    }
  }
  return null;
}

const frameDt = (pts) => median(pts.slice(1).map((p, k) => p.t - pts[k].t)) || 1 / 60;

// Acceleration from standstill: 10–90% rise of the top speed. Returns the acceleration;
// `rise` (seconds) rides along for whoever wants the time instead.
export function fitAccel(pts, { axis = 'x' } = {}) {
  const top = fitTopSpeed(pts, { axis });
  if (top.value == null) return NONE;
  const sp = speeds(pts, axis, 1);
  const t90 = crossing(sp, 0.9 * top.value, 1, true);
  if (t90 == null) return NONE;
  // The last 10% crossing BEFORE the 90% one — a twitch at the start is not the run.
  let t10 = null;
  for (let k = 1; k < sp.length && sp[k].t <= t90; k++) {
    const a = Math.abs(sp[k - 1].v), b = Math.abs(sp[k].v), l = 0.1 * top.value;
    if (a < l && b >= l) t10 = sp[k - 1].t + ((l - a) / (b - a)) * (sp[k].t - sp[k - 1].t);
  }
  if (t10 == null || !(t90 > t10)) return NONE;
  const rise = t90 - t10;
  const value = (0.8 * top.value) / rise;
  const sdRise = frameDt(pts) / 2;           // each crossing is good to about half a frame
  return { value, sd: value * Math.hypot(sdRise / rise, top.sd / top.value), n: 1, rise };
}

// Stopping after release: 90–10% fall after the plateau.
export function fitDecel(pts, { axis = 'x' } = {}) {
  const top = fitTopSpeed(pts, { axis });
  if (top.value == null) return NONE;
  const sp = speeds(pts, axis, 1);
  const k0 = sp.findIndex((s) => s.t >= (top.t1 ?? 0));
  const t90 = crossing(sp, 0.9 * top.value, k0, false);
  const k1 = sp.findIndex((s) => s.t >= (t90 ?? Infinity));
  const t10 = k1 >= 0 ? crossing(sp, 0.1 * top.value, k1, false) : null;
  if (t90 == null || t10 == null || !(t10 > t90)) return NONE;
  const fall = t10 - t90;
  const value = (0.8 * top.value) / fall;
  return { value, sd: value * (frameDt(pts) / 2) / fall, n: 1, fall };
}

// ─── jumping ──────────────────────────────────────────────────────────────────────────────────

// The standing height: median y of the first `k` points (the clip's standstill).
export const baseline = (pts, k = 10, axis = 'y') => median(pts.slice(0, k).map((p) => p[axis]));

// Every airborne stretch — consecutive points more than `eps` above the baseline — as a jump:
//   takeoff / land  where the fitted parabola crosses the baseline (so between frames)
//   apex            baseline − the parabola's vertex (positive = up)
//   g               2·c2 of that parabola
// startTimes (optional): only jumps that take off within `within` s after one of them, so a
// clip's tap jumps and held jumps can be told apart by their tags.
export function jumps(pts, { base = baseline(pts), eps = 3, startTimes = null, within = 0.35 } = {}) {
  const runs = [];
  let cur = null;
  pts.forEach((p, k) => {
    if (base - p.y > eps) { if (!cur) cur = { a: k, b: k }; else cur.b = k; }
    else if (cur) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);
  const out = [];
  const dt = frameDt(pts);
  for (const { a, b } of runs) {
    const seg = pts.slice(a, b + 1);
    if (seg.length < 4) continue;
    const f = polyfit(seg.map((p) => p.t), seg.map((p) => p.y), 2);
    if (!f || !(f.c[2] > 0)) continue;
    // Roots of c0 + c1 u + c2 u² = base.
    const A = f.c[2], B = f.c[1], Cc = f.c[0] - base;
    const disc = B * B - 4 * A * Cc;
    const lastGround = pts[a - 1], nextGround = pts[b + 1];
    let takeoff, land;
    if (disc >= 0) {
      takeoff = f.t0 + (-B - Math.sqrt(disc)) / (2 * A);
      land = f.t0 + (-B + Math.sqrt(disc)) / (2 * A);
    }
    // A fitted root outside the frames that bracket it means the parabola is a poor model
    // (a held jump, say); fall back to the bracketing frames' midpoints.
    // (Three frames of slack: the frames just above the grass but under `eps` count as ground.)
    const slack = 3 * dt;
    if (!(takeoff >= seg[0].t - slack && takeoff <= seg[0].t + 1e-9)) takeoff = lastGround ? (lastGround.t + seg[0].t) / 2 : seg[0].t;
    const tl = seg[seg.length - 1].t;
    if (!(land <= tl + slack && land >= tl - 1e-9)) land = nextGround ? (nextGround.t + tl) / 2 : tl;
    const tv = f.t0 - B / (2 * A);
    const apexY = tv >= seg[0].t && tv <= seg[seg.length - 1].t ? evalPos(f, tv) : Math.min(...seg.map((p) => p.y));
    if (startTimes && !startTimes.some((s) => takeoff >= s - 0.05 && takeoff <= s + within)) continue;
    out.push({ takeoff, land, airtime: land - takeoff, apex: base - apexY, g: 2 * A, gSd: 2 * f.se[2] });
  }
  return out;
}

const summarise = (vals, sdEach) => (vals.length ? { value: mean(vals), sd: vals.length > 1 ? sampleSd(vals) : sdEach, n: vals.length } : NONE);

export function fitApex(pts, opts = {}) {
  const js = jumps(pts, opts);
  return summarise(js.map((j) => j.apex), 1);
}
export function fitAirtime(pts, opts = {}) {
  const js = jumps(pts, opts);
  return summarise(js.map((j) => j.airtime), frameDt(pts) / 2);
}
export function fitJumpGravity(pts, opts = {}) {
  return weighted(jumps(pts, opts).map((j) => ({ value: j.g, sd: j.gSd, n: 1 })));
}

// ─── kicks ────────────────────────────────────────────────────────────────────────────────────

// Launch velocity from the first `n` frames after a kick: x linear, y a parabola (or a line
// under a known gravity g, which needs fewer frames). Evaluated at the kick time.
//   speed  px/s          angle  degrees ABOVE horizontal, whichever way the ball goes
export function launch(pts, tKick, { n = 5, g = null } = {}) {
  // A hit-stop holds the ball where it was struck for a few frames (on video and in our sim
  // alike); the launch is the motion AFTER it, so leading frames that have not moved are skipped
  // and the fit is evaluated where the ball starts to move.
  let after = pts.filter((p) => p.t > tKick + 1e-6);
  const k = after.findIndex((p, j) => j > 0 && Math.hypot(p.x - after[j - 1].x, p.y - after[j - 1].y) > 0.5);
  if (k > 1) { tKick = after[k - 1].t; after = after.slice(k); }
  const s = after.slice(0, n);
  if (s.length < 3) return null;
  const fx = polyfit(s.map((p) => p.t), s.map((p) => p.x), 1, tKick);
  let fy;
  if (g != null) {
    fy = polyfit(s.map((p) => p.t), s.map((p) => p.y - 0.5 * g * (p.t - tKick) ** 2), 1, tKick);
  } else {
    fy = polyfit(s.map((p) => p.t), s.map((p) => p.y), s.length >= 5 ? 2 : 1, tKick);
  }
  if (!fx || !fy) return null;
  const vx = fx.c[1], vy = fy.c[1];
  const sx = fx.se[1], sy = fy.se[1];
  const speed = Math.hypot(vx, vy);
  const angle = (Math.atan2(-vy, Math.abs(vx)) * 180) / Math.PI;
  const speedSd = speed > 0 ? Math.hypot((vx * sx) / speed, (vy * sy) / speed) : 0;
  const angleSd = speed > 0 ? ((Math.hypot(vy * sx, vx * sy) / (speed * speed)) * 180) / Math.PI : 0;
  return { vx, vy, speed, angle, speedSd, angleSd };
}

export function fitLaunchSpeed(pts, kickTimes, opts = {}) {
  const ls = kickTimes.map((t) => launch(pts, t, opts)).filter(Boolean);
  return summarise(ls.map((l) => l.speed), ls[0]?.speedSd ?? 0);
}
export function fitLaunchAngle(pts, kickTimes, opts = {}) {
  const ls = kickTimes.map((t) => launch(pts, t, opts)).filter(Boolean);
  return summarise(ls.map((l) => l.angle), ls[0]?.angleSd ?? 0);
}

// ─── timings between tags ─────────────────────────────────────────────────────────────────────

// tags: [{t, type, note}]. For each tag of type `a`, the time to the next tag of type `b`.
// sd for a single pair is a frame (each end is good to half a frame).
export function duration(tags, a, b, { dt = 1 / 60, noteA = null } = {}) {
  const sorted = [...tags].sort((p, q) => p.t - q.t);
  const vals = [];
  for (const s of sorted) {
    if (s.type !== a || (noteA && !(s.note || '').includes(noteA))) continue;
    const e = sorted.find((q) => q.type === b && q.t > s.t);
    if (e) vals.push(e.t - s.t);
  }
  return summarise(vals, dt);
}

// Median spacing between consecutive tags of one type — a cooldown, when the tags are the
// successes of someone mashing the button.
export function spacing(tags, type, { dt = 1 / 60 } = {}) {
  const ts = tags.filter((q) => q.type === type).map((q) => q.t).sort((p, q) => p - q);
  const gaps = ts.slice(1).map((t, k) => t - ts[k]);
  if (!gaps.length) return NONE;
  return { value: median(gaps), sd: gaps.length > 1 ? sampleSd(gaps) : dt, n: gaps.length };
}

// Peak speed in a window after a tag (a dash), and how long the speed stays above the
// midpoint between that peak and `baseSpeed` (the dash's duration).
export function burst(pts, tStart, { axis = 'x', window = 0.8, baseSpeed = 0 } = {}) {
  const s = pts.filter((p) => p.t >= tStart - 1e-6 && p.t <= tStart + window);
  if (s.length < 5) return null;
  const sp = speeds(s, axis, 1);
  const peak = Math.max(...sp.map((q) => Math.abs(q.v)));
  const mid = (peak + baseSpeed) / 2;
  const up = crossing(sp, mid, 1, true) ?? s[0].t;
  const k = sp.findIndex((q) => q.t >= up);
  const down = crossing(sp, mid, Math.max(1, k), false);
  return { peak, duration: down != null ? down - up : null, up, down };
}

// Position along `axis` at time t, linearly interpolated between the samples either side.
export function posAt(pts, t, axis = 'x') {
  if (!pts.length) return null;
  if (t <= pts[0].t) return pts[0][axis];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k].t >= t) {
      const a = pts[k - 1], b = pts[k];
      return a[axis] + ((t - a.t) / (b.t - a.t || 1)) * (b[axis] - a[axis]);
    }
  }
  return pts[pts.length - 1][axis];
}

// ─── THE METRIC TABLE ─────────────────────────────────────────────────────────────────────────
//
// Every number the reference holds, as a function of ONE track document — the .tracks.json
// shape: {frames, tags, fps, calib}. `_hs-fit.mjs` runs these over the video tracks; the parity
// harness (test-hs-parity.mjs) runs the very same entries, through measureTracks(), over tracks
// recorded from our sim by hs-scenarios.mjs. The id is the one name both sides use.
//
// Tag vocabulary (video: tagged in tools/hs-measure; sim: emitted by hs-scenarios.mjs):
//   ready_on ready_off resume goal gauge_full power_press cutin_on cutin_off armed armed_end
//   jump_tap jump_hold land dash release reverse kick kick_end touch bounce blocked counter
//   stun_on stun_off stand_on stand_off attempt
// `note` carries the variant: a bounce's surface (ground wall bar top ceiling), a kick's
// contact (feet knee head jump run), a touch made jumping ('jump'), and for `attempt` the
// name of the thing tried — a yes/no metric is only answered on a track that says it tried.

const hasWord = (note, word) => (note || '').toLowerCase().split(/[\s,;/]+/).includes(word);
// Tag times of one type, optionally only those whose note has / lacks a word.
export const tagT = (doc, type, { note = null, not = null } = {}) =>
  doc.tags.filter((t) => t.type === type && (!note || hasWord(t.note, note)) && (!not || !hasWord(t.note, not))).map((t) => t.t);
const contactsOf = (doc) => doc.tags.filter((t) => ['kick', 'bounce', 'touch'].includes(t.type)).map((t) => t.t);
const dtOf = (doc) => 1 / (doc.fps || 60);
const ball = (doc) => series(doc.frames, 'ball');
const p0 = (doc) => series(doc.frames, 'p0');
const p1 = (doc) => series(doc.frames, 'p1');
const attempted = (doc, what) => doc.tags.some((t) => t.type === 'attempt' && hasWord(t.note, what));
const yesNo = (what, type) => (doc) => (attempted(doc, what) ? { value: doc.tags.some((t) => t.type === type) ? 1 : 0, sd: 0, n: 1 } : NONE);
const endT = (doc) => doc.frames.length ? doc.frames[doc.frames.length - 1].t : null;

// Every contact that bounds a ball flight: all tagged ones plus the ones the track shows.
const allCuts = (doc, pts, axis = 'y') => [...contactsOf(doc), ...detectContacts(pts, { axis })];

// Restitution at the bounces tagged with `note` (e.g. 'wall'); for the ground, untagged-note
// bounces too, and when nothing is tagged at all, every detected bounce.
function restitution(doc, note, axis = 'y') {
  const pts = ball(doc);
  let at = note === 'ground'
    ? doc.tags.filter((t) => t.type === 'bounce' && (!t.note || hasWord(t.note, 'ground'))).map((t) => t.t)
    : tagT(doc, 'bounce', { note });
  if (!at.length && note === 'ground') at = detectContacts(pts, { axis });
  if (!at.length) return NONE;
  return fitRestitution(pts, allCuts(doc, pts, axis), { axis, at });
}

// Jumps by tag: tap jumps are tagged jump_tap, held ones jump_hold. With no jump tags at all
// every jump counts as a tap.
function jumpOpts(doc, kind) {
  const taps = tagT(doc, 'jump_tap'), holds = tagT(doc, 'jump_hold');
  if (!taps.length && !holds.length) return kind === 'tap' ? {} : null;
  const st = kind === 'tap' ? taps : holds;
  return st.length ? { startTimes: st } : null;
}
const jumpMetric = (fn, kind) => (doc) => { const o = jumpOpts(doc, kind); return o ? fn(p0(doc), o) : NONE; };

// Takeoff speed: a parabola through the RISING half only (a game may fall faster than it
// rises), its velocity where it leaves the standing line.
function takeoffSpeed(doc) {
  const o = jumpOpts(doc, 'tap'); if (!o) return NONE;
  const pts = p0(doc), base = baseline(pts);
  const vals = [];
  for (const j of jumps(pts, o)) {
    const rise = pts.filter((p) => p.t > j.takeoff && p.t < j.land && base - p.y > 1);
    const k = rise.reduce((b, p, i) => (p.y < rise[b].y ? i : b), 0);
    const up = rise.slice(0, k + 1);
    if (up.length < 4) continue;
    const f = polyfit(up.map((p) => p.t), up.map((p) => p.y), 2);
    if (f) vals.push(Math.abs(evalVel(f, j.takeoff)));
  }
  return summarise(vals, 5);
}

const kickMetric = (note, what) => (doc) => {
  const ts = note ? tagT(doc, 'kick', { note }) : tagT(doc, 'kick');
  return what === 'speed' ? fitLaunchSpeed(ball(doc), ts) : fitLaunchAngle(ball(doc), ts);
};

const dur = (a, b, opts) => (doc) => duration(doc.tags, a, b, { dt: dtOf(doc), ...opts });

// The first ready_off of the clip to the first gauge_full: a gauge filling from empty at kickoff.
function firstFill(doc) {
  const a = tagT(doc, 'ready_off')[0], b = tagT(doc, 'gauge_full').find((t) => t > (a ?? Infinity));
  return a != null && b != null ? { value: b - a, sd: dtOf(doc), n: 1 } : NONE;
}

// How long something held, from its start tag to its end tag — or to the end of the track
// when it never ended (a LOWER BOUND, which is what the reference row's `bound: 'min'` says).
// Every stretch counts and the LONGEST is reported: each one is itself a lower bound on how long
// the thing can hold, and a stretch cut short by the player (a press) says nothing more.
const heldFor = (a, b, { cancel = null } = {}) => (doc) => {
  const starts = tagT(doc, a);
  if (!starts.length) return NONE;
  const ends = [b, ...(cancel ? [cancel] : [])].flatMap((ty) => tagT(doc, ty)).sort((x, y) => x - y);
  const spans = starts.map((s) => { const e = ends.find((t) => t > s); return { v: (e ?? endT(doc)) - s, open: e == null }; });
  const best = spans.reduce((p, q) => (q.v > p.v ? q : p));
  return { value: best.v, sd: dtOf(doc), n: spans.length, open: best.open };
};

function dash(doc, what) {
  const pts = p0(doc);
  const run = fitTopSpeed(pts.filter((p) => p.t < (tagT(doc, 'dash')[0] ?? Infinity)));
  const bs = tagT(doc, 'dash').map((t) => burst(pts, t, { baseSpeed: run.value ?? 0 })).filter(Boolean);
  const vals = bs.map((b) => {
    if (what === 'speed') return b.peak;
    if (what === 'duration') return b.duration;
    return b.down != null ? Math.abs(posAt(pts, b.down) - posAt(pts, b.up)) : null;   // distance
  }).filter((v) => v != null);
  const sd0 = what === 'duration' ? dtOf(doc) : 0.05 * (vals[0] ?? 0);
  return vals.length ? { value: mean(vals), sd: vals.length > 1 ? sampleSd(vals) : sd0, n: vals.length } : NONE;
}

// After a tagged release: how long, and how far, the body slides to a stop (speed < 10% top).
function stopping(doc, what) {
  const pts = p0(doc), rel = tagT(doc, 'release')[0];
  const top = fitTopSpeed(pts.filter((p) => p.t <= (rel ?? Infinity)));
  if (rel == null || top.value == null) return NONE;
  const sp = speeds(pts, 'x', 1);
  const k = sp.findIndex((s) => s.t >= rel && Math.abs(s.v) <= 0.1 * top.value);
  if (k < 0) return NONE;
  const tStop = sp[k].t;
  const value = what === 'time' ? tStop - rel : Math.abs(posAt(pts, tStop) - posAt(pts, rel));
  return { value, sd: what === 'time' ? dtOf(doc) : top.value * dtOf(doc) / 2, n: 1 };
}

// A tagged reversal: from the press the other way to 90% of top speed in the new direction.
function reverseTime(doc) {
  const pts = p0(doc), rv = tagT(doc, 'reverse')[0];
  if (rv == null) return NONE;
  const top = fitTopSpeed(pts.filter((p) => p.t <= rv));
  if (top.value == null) return NONE;
  const sp = speeds(pts, 'x', 1);
  // The direction BEFORE the press: the last sample strictly ahead of it. A body that turns on
  // the very frame the button lights (a sim with no input lag) already reads the NEW direction
  // at the tag's own frame, and taking that as "before" looked for a turn that had happened.
  const before = Math.sign(sp.filter((s) => s.t < rv - 1e-9).pop()?.v || 0);
  const hit = sp.find((s) => s.t > rv && Math.sign(s.v) === -before && Math.abs(s.v) >= 0.9 * top.value);
  return hit ? { value: hit.t - rv, sd: dtOf(doc), n: 1 } : NONE;
}

// The upper player's own drift while standing on the other's head (stand_on … stand_off).
function carrySpeed(doc) {
  const a = tagT(doc, 'stand_on')[0];
  if (a == null) return NONE;                 // never stood: there is no carry to measure
  const b = tagT(doc, 'stand_off').find((t) => t > a) ?? endT(doc);
  const s = p0(doc).filter((p) => p.t >= a && p.t <= b);
  if (s.length < 4) return NONE;
  const f = polyfit(s.map((p) => p.t), s.map((p) => p.x), 1);
  return f ? { value: Math.abs(f.c[1]), sd: f.se[1], n: 1 } : NONE;
}

// Dash under an airborne opponent: how much HIGHER p1's second jump (the one dashed under)
// peaks than its first (undisturbed) one. 0 = no launch.
function dashUnderLaunch(doc) {
  const js = jumps(p1(doc));
  return js.length >= 2 ? { value: js[1].apex - js[0].apex, sd: 1, n: 1 } : NONE;
}

// The ball at a surface tagged `note`: its centre height there, and what share of its
// horizontal speed survives the touch.
function atSurface(doc, note, what) {
  const t = tagT(doc, 'bounce', { note })[0];
  if (t == null) return NONE;
  const pts = ball(doc);
  if (what === 'y') {
    const near = pts.filter((p) => Math.abs(p.t - t) <= 2.5 * dtOf(doc));
    if (!near.length) return NONE;
    const y = note === 'ceiling' ? Math.min(...near.map((p) => p.y)) : Math.max(...near.map((p) => p.y));
    const r = doc.frames.find((f) => f.ball)?.ball.r ?? 0;
    // Ceiling: the ball-centre y (world). Goal top: the surface height above the grass.
    return { value: note === 'ceiling' ? y : doc.calib.groundY - (y + r), sd: 1, n: 1 };
  }
  const before = pts.filter((p) => p.t < t - 1e-6).slice(-6), after = pts.filter((p) => p.t > t + 1e-6).slice(0, 6);
  if (before.length < 3 || after.length < 3) return NONE;
  const fb = polyfit(before.map((p) => p.t), before.map((p) => p.x), 1), fa = polyfit(after.map((p) => p.t), after.map((p) => p.x), 1);
  if (!fb || !fa || Math.abs(fb.c[1]) < 1) return NONE;
  return { value: Math.abs(fa.c[1]) / Math.abs(fb.c[1]), sd: 0.05, n: 1 };
}

// Does the ball come to rest on the goal top? 1 if it stays within 3px of where it landed for
// half a second after a 'top' bounce.
function restsOnBar(doc) {
  const t = tagT(doc, 'bounce', { note: 'top' })[0];
  if (t == null) return attempted(doc, 'goaltop') ? { value: 0, sd: 0, n: 1 } : NONE;
  const pts = ball(doc).filter((p) => p.t >= t);
  if (!pts.length) return NONE;
  const y0 = pts[0].y;
  const stay = pts.findIndex((p) => Math.abs(p.y - y0) > 3);
  const held = (stay < 0 ? pts[pts.length - 1].t : pts[stay].t) - t;
  return { value: held >= 0.5 ? 1 : 0, sd: 0, n: 1 };
}

// A power shot blocked by an unarmed body: how long the blocker is stunned (0 = not at all),
// and whether the ball comes back off them.
function blockStun(doc) {
  const b = tagT(doc, 'blocked')[0];
  if (b == null) return NONE;
  const on = tagT(doc, 'stun_on').find((t) => t >= b - 0.05);
  if (on == null) return { value: 0, sd: 0, n: 1 };
  const off = tagT(doc, 'stun_off').find((t) => t > on) ?? endT(doc);
  return { value: off - on, sd: dtOf(doc), n: 1 };
}
function blockRebound(doc) {
  const b = tagT(doc, 'blocked')[0];
  if (b == null) return NONE;
  const pts = ball(doc);
  const v = (s) => { const f = s.length >= 2 ? polyfit(s.map((p) => p.t), s.map((p) => p.x), 1) : null; return f ? f.c[1] : 0; };
  const vb = v(pts.filter((p) => p.t < b).slice(-4)), va = v(pts.filter((p) => p.t > b + 0.1).slice(0, 4));
  return { value: vb && va && Math.sign(va) !== Math.sign(vb) ? 1 : 0, sd: 0, n: 1 };
}

// How HIGH a struck ball goes: the top of the flight after the first contact tagged `type`
// (with `note`), as the ball centre's rise above a ball resting on the grass. The flight ends
// at the next contact the track shows, so a ball stopped by the ceiling reads the ceiling.
function apexAfter(doc, type, note = null) {
  const t = tagT(doc, type, note ? { note } : {})[0];
  if (t == null || !doc.calib) return NONE;
  const pts = ball(doc);
  const next = allCuts(doc, pts).filter((c) => c > t + 0.05).sort((a, b) => a - b)[0] ?? Infinity;
  const fl = pts.filter((p) => p.t > t && p.t <= Math.min(next, t + 3));
  if (fl.length < 3) return NONE;
  const r = doc.frames.find((f) => f.ball)?.ball.r ?? 0;
  return { value: doc.calib.groundY - r - Math.min(...fl.map((p) => p.y)), sd: 2, n: 1 };
}

// Share of LIVE play (percent) the ball's centre is above the top edge of the picture. Live:
// from each ball-in (ready_off) to the next goal, less the power-shot cut-ins. The top edge is
// calib.viewTop (world y), or for a video calibration the frame's own top (groundY - y0·scale).
function offscreenFrac(doc) {
  const c = doc.calib || {};
  const top = c.viewTop ?? (c.y0 != null && c.scale != null ? c.groundY - c.y0 * c.scale : null);
  const starts = tagT(doc, 'ready_off');
  if (top == null || !starts.length) return NONE;
  const goals = tagT(doc, 'goal'), cutOn = tagT(doc, 'cutin_on'), cutOff = tagT(doc, 'cutin_off');
  const end = endT(doc) ?? 0;
  const live = starts.map((s) => [s, goals.find((g) => g > s) ?? end + 1]);
  const cuts = cutOn.map((s) => [s, cutOff.find((e) => e > s) ?? end + 1]);
  const inAny = (t, iv) => iv.some(([a, b]) => t >= a && t < b);
  let n = 0, off = 0;
  for (const f of doc.frames) {
    if (f.dup || !inAny(f.t, live) || inAny(f.t, cuts)) continue;
    n++;
    if (f.ball && f.ball.y < top) off++;
  }
  return n ? { value: (100 * off) / n, sd: 0.5, n: 1 } : NONE;
}

const calibCheck = (key) => (doc) => {
  const v = doc.calib?.checks?.[key];
  return v != null ? { value: v, sd: 0, n: 1 } : NONE;
};

// id: dotted name both sides key on · unit · clips it is measured from · scenario the sim side
// builds (hs-scenarios.mjs) · timing: tolerance floor of one frame · fit: (doc) → {value, sd, n}
export const METRICS = [
  // Geometry, from every clip's calibration clicks — the cross-checks of the mapping itself.
  { id: 'geom.goalHeight', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('goalHeight') },
  { id: 'geom.headDiameter', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('headDiameter') },
  { id: 'geom.goalMouthX', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('goalMouthX') },

  // C1 — stand still at kickoff.
  { id: 'kickoff.readyTime', unit: 's', clips: ['C1', 'C17', 'M*'], scenario: 'kickoff', timing: true, fit: dur('ready_on', 'ready_off') },
  { id: 'ball.spawnHeight', unit: 'px', clips: ['C1'], scenario: 'kickoff',
    fit: (d) => { const b = ball(d)[0]; return b ? { value: d.calib.groundY - b.y, sd: 1, n: 1 } : NONE; } },
  { id: 'ball.gravity', unit: 'px/s²', clips: ['C1', 'C8', 'C9'], scenario: 'drop',
    fit: (d) => { const pts = ball(d); return fitGravity(pts, allCuts(d, pts)); } },
  { id: 'ball.groundRestitution', unit: '', clips: ['C1', 'C9'], scenario: 'drop', fit: (d) => restitution(d, 'ground') },

  // C2 — run from standstill and release (tag 'release'); C2/C4 reversal (tag 'reverse').
  { id: 'player.topSpeed', unit: 'px/s', clips: ['C2'], scenario: 'run', fit: (d) => fitTopSpeed(p0(d)) },
  { id: 'player.accel', unit: 'px/s²', clips: ['C2'], scenario: 'run', fit: (d) => fitAccel(p0(d)) },
  { id: 'player.accelTime', unit: 's', clips: ['C2'], scenario: 'run', timing: true,
    fit: (d) => { const a = fitAccel(p0(d)); return a.value != null ? { value: a.rise, sd: dtOf(d), n: 1 } : NONE; } },
  { id: 'player.decel', unit: 'px/s²', clips: ['C2'], scenario: 'run', fit: (d) => fitDecel(p0(d)) },
  { id: 'player.stopTime', unit: 's', clips: ['C2'], scenario: 'run', timing: true, fit: (d) => stopping(d, 'time') },
  { id: 'player.stopDistance', unit: 'px', clips: ['C2'], scenario: 'run', fit: (d) => stopping(d, 'distance') },
  { id: 'player.reverseTime', unit: 's', clips: ['C2', 'C4'], scenario: 'runReverse', timing: true, fit: reverseTime },

  // C3 — tap jumps and held jumps.
  { id: 'jump.apex.tap', unit: 'px', clips: ['C3'], scenario: 'jumpTap', fit: jumpMetric(fitApex, 'tap') },
  { id: 'jump.apex.hold', unit: 'px', clips: ['C3'], scenario: 'jumpHold', fit: jumpMetric(fitApex, 'hold') },
  { id: 'jump.airtime.tap', unit: 's', clips: ['C3'], scenario: 'jumpTap', timing: true, fit: jumpMetric(fitAirtime, 'tap') },
  { id: 'jump.airtime.hold', unit: 's', clips: ['C3'], scenario: 'jumpHold', timing: true, fit: jumpMetric(fitAirtime, 'hold') },
  { id: 'player.gravity', unit: 'px/s²', clips: ['C3'], scenario: 'jumpTap', fit: jumpMetric(fitJumpGravity, 'tap') },
  { id: 'jump.takeoffSpeed', unit: 'px/s', clips: ['C3'], scenario: 'jumpTap', fit: takeoffSpeed },
  // Holding JUMP through a landing: time from touchdown to the next (automatic) takeoff.
  { id: 'jump.holdRejump', unit: 's', clips: ['C3'], scenario: 'jumpHold', timing: true,
    fit: (d) => { const l = tagT(d, 'land')[0]; const n = l != null && tagT(d, 'jump_hold').find((t) => t > l);
      return n != null && n !== false ? { value: n - l, sd: dtOf(d), n: 1 } : NONE; } },

  // C4 — running jump. Horizontal speed kept through the air.
  { id: 'jump.airSpeed', unit: 'px/s', clips: ['C4'], scenario: 'runJump',
    fit: (d) => { const js = jumps(p0(d)); const pts = p0(d).filter((p) => js.some((j) => p.t > j.takeoff && p.t < j.land)); return fitTopSpeed(pts); } },

  // C5 — dash, then dash-spam (tag each dash that actually happened).
  { id: 'dash.speed', unit: 'px/s', clips: ['C5'], scenario: 'dash', fit: (d) => dash(d, 'speed') },
  { id: 'dash.duration', unit: 's', clips: ['C5'], scenario: 'dash', timing: true, fit: (d) => dash(d, 'duration') },
  { id: 'dash.distance', unit: 'px', clips: ['C5'], scenario: 'dash', fit: (d) => dash(d, 'distance') },
  { id: 'dash.cooldown', unit: 's', clips: ['C5'], scenario: 'dashSpam', timing: true, fit: (d) => spacing(d.tags, 'dash', { dt: dtOf(d) }) },

  // C6 — mash kick, no ball: the repeat, and how long the leg stays out (kick → kick_end).
  { id: 'kick.cooldown', unit: 's', clips: ['C6'], scenario: 'kickMash', timing: true, fit: (d) => spacing(d.tags, 'kick', { dt: dtOf(d) }) },
  // A kick re-swung before the leg came back ends the first one there, so each kick is paired
  // with whichever comes first: its kick_end or the next kick.
  { id: 'kick.duration', unit: 's', clips: ['C6'], scenario: 'kickMash', timing: true,
    fit: (d) => { const ks = tagT(d, 'kick'), es = tagT(d, 'kick_end');
      const v = ks.map((t, j) => Math.min(es.find((q) => q > t) ?? Infinity, ks[j + 1] ?? Infinity) - t).filter(Number.isFinite);
      return summarise(v, dtOf(d)); } },

  // C7 — the kick model: tag each kick with where the ball was (feet / knee / head / jump / run).
  ...['feet', 'knee', 'head', 'jump', 'run'].flatMap((w) => {
    const sc = 'kick' + w[0].toUpperCase() + w.slice(1);
    return [
      { id: `kick.${w}.speed`, unit: 'px/s', clips: ['C7'], scenario: sc, fit: kickMetric(w, 'speed') },
      { id: `kick.${w}.angle`, unit: 'deg', clips: ['C7'], scenario: sc, fit: kickMetric(w, 'angle') },
    ];
  }),

  // C8 — ball dropped on a standing head (touch), then jumping into it (touch, note "jump").
  { id: 'ball.headRestitution', unit: '', clips: ['C8'], scenario: 'headDrop',
    fit: (d) => { const pts = ball(d); const at = tagT(d, 'touch', { not: 'jump' }); return at.length ? fitRestitution(pts, allCuts(d, pts), { at }) : NONE; } },
  { id: 'header.speed', unit: 'px/s', clips: ['C8'], scenario: 'header', fit: (d) => fitLaunchSpeed(ball(d), tagT(d, 'touch', { note: 'jump' })) },
  { id: 'header.angle', unit: 'deg', clips: ['C8'], scenario: 'header', fit: (d) => fitLaunchAngle(ball(d), tagT(d, 'touch', { note: 'jump' })) },

  // HS M4 passive heads (no KICK): the bounce off a still head, off a head still rising from its
  // jump (relative to the head — its velocity off the toucher's own track, frame to frame across
  // the contact), and how fast a passive jumping header leaves.
  { id: 'head.restitution.standing', unit: '', clips: ['C8'], scenario: 'headDrop',
    fit: (d) => { const pts = ball(d); const at = tagT(d, 'touch', { not: 'jump' }); return at.length ? fitRestitution(pts, allCuts(d, pts), { at }) : NONE; } },
  { id: 'head.restitution.jumping', unit: '', clips: ['C8'], scenario: 'headerPassive',
    fit: (d) => {
      const pts = ball(d), head = p0(d), at = tagT(d, 'touch', { note: 'jump' });
      if (!at.length || head.length < 2) return NONE;
      const surface = (t) => {
        const k = Math.max(0, Math.min(head.length - 2, head.findIndex((q) => q.t > t) - 1));
        return (head[k + 1].y - head[k].y) / (head[k + 1].t - head[k].t);
      };
      return fitRestitution(pts, allCuts(d, pts), { at, surface });
    } },
  { id: 'header.passive.launch', unit: 'px/s', clips: ['C8'], scenario: 'headerPassive', fit: (d) => fitLaunchSpeed(ball(d), tagT(d, 'touch', { note: 'jump' })) },

  // C8 again, headed ON PURPOSE (jump into the drop, KICK as it reaches the head — tag 'kick',
  // note 'header'): how fast it leaves and how high it goes. These are the numbers that decide
  // whether a header stays in the picture.
  { id: 'ball.launchSpeed.header', unit: 'px/s', clips: ['C8'], scenario: 'headerKick', fit: (d) => fitLaunchSpeed(ball(d), tagT(d, 'kick', { note: 'header' })) },
  { id: 'ball.headerApex', unit: 'px', clips: ['C8'], scenario: 'headerKick', fit: (d) => apexAfter(d, 'kick', 'header') },
  // C7 — how high the plain kick of a ball at the feet goes.
  { id: 'ball.kickApex.feet', unit: 'px', clips: ['C7'], scenario: 'kickFeet', fit: (d) => apexAfter(d, 'kick', 'feet') },
  { id: 'ball.kickApex.head', unit: 'px', clips: ['C7'], scenario: 'kickHead', fit: (d) => apexAfter(d, 'kick', 'head') },
  // The lob is ours, not HS's (HS has no hold-to-lob); HS's nearest thing is the jumping kick.
  { id: 'ball.kickApex.lob', unit: 'px', clips: ['C7'], scenario: 'kickLob', fit: (d) => apexAfter(d, 'kick', 'lob') },

  // C9 — the ball off each surface; tag the bounce with the surface's name.
  { id: 'ball.wallRestitution', unit: '', clips: ['C9'], scenario: 'wallBounce', fit: (d) => restitution(d, 'wall', 'x') },
  { id: 'ball.barRestitution', unit: '', clips: ['C9'], scenario: 'barBounce', fit: (d) => restitution(d, 'bar') },
  { id: 'ball.goalTopRestitution', unit: '', clips: ['C9'], scenario: 'goalTopBounce', fit: (d) => restitution(d, 'top') },
  { id: 'ball.ceilingRestitution', unit: '', clips: ['C9'], scenario: 'ceilingBounce', fit: (d) => restitution(d, 'ceiling') },
  { id: 'ball.ceilingKeepX', unit: '', clips: ['C9'], scenario: 'ceilingBounce', fit: (d) => atSurface(d, 'ceiling', 'vx') },
  { id: 'geom.ceilingY', unit: 'px', clips: ['C9'], scenario: 'ceilingBounce', fit: (d) => atSurface(d, 'ceiling', 'y') },
  { id: 'geom.goalTopY', unit: 'px', clips: ['C9'], scenario: 'goalTopBounce', fit: (d) => atSurface(d, 'top', 'y') },
  { id: 'ball.restsOnBar', unit: 'yes/no', clips: ['C9'], scenario: 'goalTopBounce', fit: restsOnBar },

  // C10 — bodies: standing on the opponent's head, and dashing under them in the air.
  { id: 'headStand.happens', unit: 'yes/no', clips: ['C10'], scenario: 'headStand', fit: yesNo('headstand', 'stand_on') },
  { id: 'headStand.carrySpeed', unit: 'px/s', clips: ['C10'], scenario: 'headStand', fit: carrySpeed },
  { id: 'dashUnder.launch', unit: 'px', clips: ['C10'], scenario: 'dashUnder', fit: dashUnderLaunch },
  { id: 'dashUnder.headLandTime', unit: 's', clips: ['C10'], scenario: 'dashUnder', timing: true,
    fit: (d) => (tagT(d, 'stand_on').length ? dur('stand_on', 'stand_off')(d) : attempted(d, 'dashunder') ? { value: 0, sd: 0, n: 1 } : NONE) },

  // C12 — hardest kick across the pitch: the fastest launch of each take.
  { id: 'ball.maxSpeed', unit: 'px/s', clips: ['C12'], scenario: 'kickMax',
    fit: (d) => { const ls = tagT(d, 'kick').map((t) => launch(ball(d), t)).filter(Boolean); if (!ls.length) return NONE;
      const b = ls.reduce((a, c) => (c.speed > a.speed ? c : a)); return { value: b.speed, sd: b.speedSd, n: 1 }; } },

  // C13 / M — the power gauge.
  { id: 'gauge.fillTime', unit: 's', clips: ['C13', 'M*'], scenario: 'gauge', timing: true, fit: firstFill },
  { id: 'gauge.refillTime', unit: 's', clips: ['C13', 'M*'], scenario: 'gauge', timing: true, fit: dur('power_press', 'gauge_full') },
  // A full gauge left alone: how long it stays full (a lower bound when it never drains).
  { id: 'gauge.fullHold', unit: 's', clips: ['C13', 'M*'], scenario: 'gaugeHold', timing: true, fit: heldFor('gauge_full', 'gauge_drop', { cancel: 'power_press' }) },
  // The darkened spotlight when a power shot FIRES (on the touch after arming — pressing
  // POWER only arms it, so press → cut-in is however long the player took to reach the ball).
  { id: 'power.cutinTime', unit: 's', clips: ['C14', 'M*'], scenario: 'powerCutin', timing: true, fit: dur('cutin_on', 'cutin_off') },

  // C14 / C15 — arming, countering, blocking.
  { id: 'power.armHold', unit: 's', clips: ['C14', 'M*'], scenario: 'armWait', timing: true, fit: heldFor('armed', 'armed_end') },
  { id: 'power.armedCounter', unit: 'yes/no', clips: ['C15', 'M*'], scenario: 'armedCounter', fit: yesNo('armedcounter', 'counter') },
  { id: 'power.blockStun', unit: 's', clips: ['C15', 'M*'], scenario: 'powerBlock', timing: true, fit: blockStun },
  { id: 'power.blockRebound', unit: 'yes/no', clips: ['C15', 'M*'], scenario: 'powerBlock', fit: blockRebound },

  // C17 / M — goals and the reset after them.
  { id: 'goal.resetTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: dur('goal', 'ready_on') },
  { id: 'goal.toPlayTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: dur('goal', 'ready_off') },
  { id: 'goal.resumeTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: dur('goal', 'resume') },
  { id: 'goal.bannerTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: dur('goal', 'banner_off') },

  // M — whole matches.
  { id: 'match.goals', unit: 'goals', clips: ['M*'], scenario: 'botMatch',
    fit: (d) => ({ value: d.tags.filter((t) => t.type === 'goal').length, sd: 0, n: 1 }) },
  // …and how much of the live play the ball spends off the top of the picture.
  { id: 'ball.offscreenFrac', unit: '%', clips: ['M*'], scenario: 'botLong', fit: offscreenFrac },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

// THE SEAM THE PARITY HARNESS USES. One track document in, {id: {value, sd, n}} out, through
// exactly the fit the video side runs for that id. `metricIds` null means every metric; an id
// with no entry in the table comes back NONE rather than throwing, so a reference row naming a
// metric nobody has written yet reads as "unrunnable", not as a crash.
export function measureTracks(tracks, metricIds = null) {
  const doc = { tags: [], frames: [], fps: 60, calib: null, ...tracks };
  const ids = metricIds ?? METRICS.map((m) => m.id);
  const out = {};
  for (const id of ids) {
    const m = METRIC_BY_ID.get(id);
    let r = NONE;
    if (m) { try { r = m.fit(doc) ?? NONE; } catch { r = NONE; } }
    out[id] = r;
  }
  return out;
}
