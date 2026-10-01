// HS: does the ceiling keep the ball's sideways speed? Every ball that leaves the top of the
// screen in M1–M6 and comes back: sideways speed just before it left vs just after it returned.
//   node _ceil-check.mjs
import { load } from './_hs-match-events.mjs';
const vyAt = (pts) => (pts[pts.length - 1].y - pts[0].y) / (pts[pts.length - 1].t - pts[0].t);
const vxAt = (pts) => (pts[pts.length - 1].x - pts[0].x) / (pts[pts.length - 1].t - pts[0].t);
const rows = [];
for (const name of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']) {
  let M; try { M = load(name); } catch { continue; }
  const F = M.frames;
  for (let i = 4; i < F.length - 1; i++) {
    const b = F[i].ball;
    if (!b || F[i + 1].ball || b.y > 60) continue;                     // last sighting, near the top
    let j = i + 1; while (j < F.length && !F[j].ball) j++;
    if (j + 4 >= F.length) continue;
    const gap = F[j].t - F[i].t, back = F[j].ball;
    if (gap < 0.15 || gap > 2.5 || back.y > 60) continue;              // came back through the top
    const before = F.slice(i - 4, i + 1).map((f) => f.ball && { ...f.ball, t: f.t }).filter(Boolean);
    const after = F.slice(j, j + 5).map((f) => f.ball && { ...f.ball, t: f.t }).filter(Boolean);
    if (before.length < 4 || after.length < 4) continue;
    const a = vxAt(before), c = vxAt(after);
    // Would it reach the ceiling (130 px above the screen's top, HS M4)? Rise left = vy² / 2g.
    const vy = -vyAt(before), rise = vy > 0 ? vy * vy / (2 * 583) : 0, room = 130 + b.y;
    if (Math.sign(a) !== Math.sign(c) && Math.abs(a) > 60) continue;    // met a side wall up there
    rows.push({ clip: name, t: F[i].t.toFixed(2), gap: gap.toFixed(2), vxOut: a.toFixed(0), vxBack: c.toFixed(0), keep: Math.abs(a) > 60 ? (c / a).toFixed(2) : '—', ceiling: rise > room ? 'HIT' : 'no' });
  }
}
console.table(rows);
for (const hit of ['HIT', 'no']) { const k = rows.filter((r) => r.keep !== '—' && r.ceiling === hit).map((r) => +r.keep).sort((x, y) => x - y);
  console.log(`ceiling ${hit}: n=${k.length}  keep ${k.join(' ')}  median ${k[k.length >> 1]}`); }
const k = rows.filter((r) => r.keep !== '—').map((r) => +r.keep).sort((x, y) => x - y);
console.log(`n=${k.length}  median keep ${k[k.length >> 1]}`);
