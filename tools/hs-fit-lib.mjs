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
    const f = polyfit(seg.map((p) => p.t), seg.map((p) => p[axis]), 2);
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
export function fitRestitution(pts, contactTimes = null, { axis = 'y', win = 10, minPts = 3, at = null } = {}) {
  const cuts = [...new Set([...(contactTimes ?? detectContacts(pts, { axis })), ...(at ?? [])])].sort((a, b) => a - b);
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
    const vb = evalVel(fb, tc), va = evalVel(fa, tc);
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
  const s = pts.filter((p) => p.t > tKick + 1e-6).slice(0, n);
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
  return { peak, duration: down != null ? down - up : null };
}
