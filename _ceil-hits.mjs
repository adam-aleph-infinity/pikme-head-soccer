// HS CEILING HITS, all clips: every ball that leaves the top of the picture and comes back.
//   node _ceil-hits.mjs
// The flight before (x a line with HS's air drag, y a parabola with g fixed) and after are fitted
// and INTERSECTED: where the two paths cross is when and how high it hit, so the ceiling height is
// read off the footage, not assumed. Then the velocities in and out at that moment: e (vertical
// bounce), keep (sideways vx out / in) and the friction that keep would need (mu).
// A clean hit: hitY near -118 for every one (the paths cross at the ceiling) and xGap ~0 (the two
// x lines meet there too — a large xGap means a side wall was also in the gap).
// Results 2026-10-04: e 0.64 (0.55-0.71, n 9); hitY -118; keep 0.71 / 0.35 / 0.34 / ~0 / ~0.
import { load } from './_hs-match-events.mjs';
import { polyfit } from './tools/hs-fit-lib.mjs';
const G = 583, DRAG = 0.099, W = 1060;
const out = [];
for (const name of ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11']) {
  let M; try { M = load(name); } catch { continue; }
  const F = M.frames;
  for (let i = 1; i < F.length - 1; i++) {
    if (!F[i].ball || F[i + 1].ball) continue;
    let j = i + 1; while (j < F.length && !F[j].ball) j++;
    if (j >= F.length) continue;
    const t0 = F[i].t, t1 = F[j].t, gap = t1 - t0;
    if (gap < 0.12 || gap > 3 || F[i].ball.y > 60 || F[j].ball.y > 60) continue;      // off the TOP and back
    const pts = (a, b) => F.filter((f) => f.t >= a && f.t <= b && f.ball && !f.dup).map((f) => ({ t: f.t, x: f.ball.x, y: f.ball.y }));
    const take = (P, fromEnd) => { const o = []; const seq = fromEnd ? [...P].reverse() : P;
      for (const p of seq) { if (o.length) { const q = o[o.length - 1]; if (Math.abs(p.t - q.t) > 0.06) break;
        // stop at a contact: a jump off the running parabola
        if (o.length >= 4) { const f = fit(fromEnd ? [...o].reverse() : o, q.t); const px = f.x + f.vx * (p.t - q.t), py = f.y + f.vy * (p.t - q.t) + 0.5 * G * (p.t - q.t) ** 2; if (Math.hypot(px - p.x, py - p.y) > 12) break; } }
        o.push(p); }
      return fromEnd ? o.reverse() : o; };
    function fit(P, tr) {
      const fx = polyfit(P.map((p) => p.t), P.map((p) => p.x), 1, tr);
      const fy = polyfit(P.map((p) => p.t), P.map((p) => p.y - 0.5 * G * (p.t - tr) ** 2), 1, tr);
      const res = Math.sqrt(P.reduce((s, p) => s + (p.x - (fx.c[0] + fx.c[1] * (p.t - tr))) ** 2 + (p.y - (fy.c[0] + fy.c[1] * (p.t - tr) + 0.5 * G * (p.t - tr) ** 2)) ** 2, 0) / P.length);
      return { x: fx.c[0], vx: fx.c[1], y: fy.c[0], vy: fy.c[1], res };
    }
    const B = take(pts(t0 - 0.35, t0), true), A = take(pts(t1, t1 + 0.35), false);
    if (B.length < 6 || A.length < 6) continue;
    const b = fit(B, t0), a = fit(A, t1);
    if (b.vy > -200 || a.vy < -50) continue;                    // must leave climbing and come back falling
    const yb = (t) => b.y + b.vy * (t - t0) + 0.5 * G * (t - t0) ** 2, ya = (t) => a.y + a.vy * (t - t1) + 0.5 * G * (t - t1) ** 2;
    const xb = (t) => b.x + (b.vx / DRAG) * (1 - Math.exp(-DRAG * (t - t0))), xa = (t) => a.x - (a.vx / DRAG) * (Math.exp(DRAG * (t1 - t)) - 1);
    const apexB = b.y - (b.vy * b.vy) / (2 * G), tApexB = t0 - b.vy / G;
    // the two paths cross (y) at the hit: scan the gap for where yb = ya while both still climbing/falling right
    let best = null;
    for (let t = t0; t <= t1; t += 0.001) { const d = Math.abs(yb(t) - ya(t)); if (!best || d < best.d) best = { t, d }; }
    // without a ceiling the after-path is the same parabola: then yb≈ya over the whole gap (a control)
    const sameParabola = Math.abs(yb(t1) - a.y) < 20 && Math.abs((b.vy + G * gap) - a.vy) < 60;
    const tH = best.t;
    const vyIn = b.vy + G * (tH - t0), vyOut = a.vy - G * (t1 - tH);
    const vxIn = b.vx * Math.exp(-DRAG * (tH - t0)), vxOut = a.vx * Math.exp(DRAG * (t1 - tH));
    const wall = (xb(tH) < 12 || xb(tH) > W - 12);
    out.push({ clip: name, t: +t0.toFixed(2), gap: +gap.toFixed(2), nB: B.length, nA: A.length, res: +Math.max(b.res, a.res).toFixed(1),
      control: sameParabola, apexB: Math.round(apexB), hitY: Math.round(yb(tH)), cross: +best.d.toFixed(0), xGap: Math.round(xb(tH) - xa(tH)),
      vyIn: Math.round(vyIn), vyOut: Math.round(vyOut), e: +(-vyOut / vyIn).toFixed(2),
      vxIn: Math.round(vxIn), vxOut: Math.round(vxOut), keep: Math.abs(vxIn) > 60 ? +(vxOut / vxIn).toFixed(2) : null,
      mu: Math.abs(vxIn) > 60 ? +((Math.abs(vxIn) - Math.abs(vxOut)) / (Math.abs(vyIn) + Math.abs(vyOut))).toFixed(3) : null, wall });
  }
}
console.table(out.map(({ nB, nA, ...r }) => r));
