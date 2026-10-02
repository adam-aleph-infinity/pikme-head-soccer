// HS: what does the ceiling do to the ball's sideways speed? Every ball in M1–M6 that leaves the
// top of the screen and comes back, measured on whole flights rather than edge frames:
//   - before / after: a line fit to x and a g-fixed parabola to y over up to 0.3 s of clean
//     (non-duplicate) frames each side, so vx is the flight's, not two noisy frames'.
//   - HIT: the before-parabola's apex is above the ceiling (ball centre at -130). A miss is a
//     control: it must come back at keep ≈ 1 and on the same parabola.
//   - WALL: the straight path across the gap meets a side wall (the bounce, not the ceiling).
//   - landing check: where x comes back vs the straight line with keep 1 and with keep 0.63.
//   node _ceil-check.mjs
import { load } from './_hs-match-events.mjs';
import { polyfit } from './tools/hs-fit-lib.mjs';
const G = 583, CEIL = -130, W = 1060, DRAG = 0.099;
const rows = [];
for (const name of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']) {
  let M; try { M = load(name); } catch { continue; }
  const F = M.frames;
  for (let i = 1; i < F.length - 1; i++) {
    if (!F[i].ball || F[i + 1].ball) continue;
    let j = i + 1; while (j < F.length && !F[j].ball) j++;
    if (j >= F.length) continue;
    const t0 = F[i].t, t1 = F[j].t, gap = t1 - t0;
    if (gap < 0.1 || gap > 3 || F[i].ball.y > 80 || F[j].ball.y > 80) continue;   // off the TOP and back
    const pts = (a, b) => F.filter((f) => f.t >= a && f.t <= b && f.ball && !f.dup).map((f) => ({ t: f.t, x: f.ball.x, y: f.ball.y }));
    // the flight either side, stopping at any earlier gap / contact-sized jump
    const take = (P, fromEnd) => { const out = []; const seq = fromEnd ? [...P].reverse() : P;
      for (const p of seq) { if (out.length) { const q = out[out.length - 1]; if (Math.abs(p.t - q.t) > 0.06) break; } out.push(p); }
      return fromEnd ? out.reverse() : out; };
    const B = take(pts(t0 - 0.3, t0), true), A = take(pts(t1, t1 + 0.3), false);
    if (B.length < 6 || A.length < 6) continue;
    const fit = (P, tr) => {
      const fx = polyfit(P.map((p) => p.t), P.map((p) => p.x), 1, tr);
      // y with gravity fixed: fit y - ½g(t-tr)² as a line
      const fy = polyfit(P.map((p) => p.t), P.map((p) => p.y - 0.5 * G * (p.t - tr) ** 2), 1, tr);
      const res = Math.sqrt(P.reduce((s, p) => s + (p.x - (fx.c[0] + fx.c[1] * (p.t - tr))) ** 2, 0) / P.length);
      return { x: fx.c[0], vx: fx.c[1], y: fy.c[0], vy: fy.c[1], res };
    };
    const b = fit(B, t0), a = fit(A, t1);
    const apex = b.vy < 0 ? b.y - (b.vy * b.vy) / (2 * G) : b.y;      // world y of the apex (up is −)
    const hit = apex < CEIL;
    // straight line across the gap (with drag) — does it meet a side wall?
    const travel = (b.vx / DRAG) * (1 - Math.exp(-DRAG * gap));
    const wall = b.x + travel < 15 || b.x + travel > W - 15;
    if (Math.abs(b.vx) < 120) { rows.push({ clip: name, t: +t0.toFixed(2), gap: +gap.toFixed(2), apex: Math.round(apex), hit, wall, vxBefore: Math.round(b.vx), vxAfter: Math.round(a.vx), keep: null, xBack: Math.round(a.x), xIf1: null, xIf063: null }); continue; }
    // landing check: where it would come back with keep 1, and with keep 0.63 applied at the ceiling
    const tHit = hit ? (-b.vy - Math.sqrt(Math.max(0, b.vy * b.vy - 2 * G * (b.y - CEIL)))) / G : null;
    const xKeep = (k) => { if (!hit) return b.x + travel;
      const x1 = b.x + (b.vx / DRAG) * (1 - Math.exp(-DRAG * tHit)), v1 = b.vx * Math.exp(-DRAG * tHit) * k;
      return x1 + (v1 / DRAG) * (1 - Math.exp(-DRAG * (gap - tHit))); };
    rows.push({ clip: name, t: +t0.toFixed(2), gap: +gap.toFixed(2), apex: Math.round(apex), hit, wall,
      vxBefore: Math.round(b.vx), vxAfter: Math.round(a.vx), keep: +(a.vx / (b.vx * Math.exp(-DRAG * gap))).toFixed(2),
      xBack: Math.round(a.x), xIf1: Math.round(xKeep(1)), xIf063: Math.round(xKeep(0.63)), fitErr: +Math.max(b.res, a.res).toFixed(1) });
  }
}
console.table(rows);
for (const [lab, f] of [['CEILING HIT, no wall', (r) => r.hit && !r.wall], ['no ceiling (control), no wall', (r) => !r.hit && !r.wall]]) {
  const R = rows.filter((r) => f(r) && r.keep != null), k = R.map((r) => r.keep).sort((x, y) => x - y);
  const e1 = R.map((r) => Math.abs(r.xBack - r.xIf1)), e2 = R.map((r) => Math.abs(r.xBack - r.xIf063));
  const md = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  console.log(`${lab}: n=${R.length}  keep ${k.join(' ')}  median ${md(k)}  | landing miss: keep 1 → ${md(e1)} px, keep 0.63 → ${md(e2)} px (median)`);
}
