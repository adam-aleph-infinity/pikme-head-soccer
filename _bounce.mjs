// GRASS BOUNCES, HS vs OURS: sideways speed kept through a clean bounce (nobody within 80 px) and the
// grip it implies (Δ|vx| / Δvy). HS M1–M6: kept 0.84, grip 0.077; constants.js BALL_GRIP.  node _bounce.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { load } from './_hs-match-events.mjs';
import { series, polyfit, median } from './tools/hs-fit-lib.mjs';
function bounces(frames) {
  const b = series(frames, 'ball'), byT = new Map(frames.map((f) => [f.t, f])), out = [];
  for (let k = 4; k + 5 < b.length; k++) {
    const p = b[k];
    if (p.y < C.GROUND_Y - 36) continue;
    if (b[k - 1].y > p.y + 0.5 || b[k + 1].y > p.y + 0.5) continue;      // the lowest frame
    const pre = b.slice(k - 4, k), post = b.slice(k + 1, k + 5);
    if (post[3].t - pre[0].t > 12.5 / 60) continue;
    const f = byT.get(p.t);
    if (!f?.p0 || !f?.p1 || [f.p0, f.p1].some((h) => Math.abs(h.x - p.x) < 80)) continue;   // nobody near: a clean bounce
    const fx0 = polyfit(pre.map((q) => q.t), pre.map((q) => q.x), 1), fx1 = polyfit(post.map((q) => q.t), post.map((q) => q.x), 1);
    const fy0 = polyfit(pre.map((q) => q.t), pre.map((q) => q.y), 2, p.t), fy1 = polyfit(post.map((q) => q.t), post.map((q) => q.y), 2, p.t);
    const vin = fy0.c[1], vout = fy1.c[1];
    if (!(vin > 150 && vout < -60)) continue;
    const ux = fx0.c[1], wx = fx1.c[1];
    if (Math.abs(ux) < 80) continue;
    out.push({ t: p.t, vin, vout, ey: -vout / vin, ux, wx, kx: wx / ux });
  }
  return out;
}
const hs = [];
for (const n of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']) for (const r of bounces(load(n).frames)) hs.push({ n, ...r });
for (const r of hs) console.log(r.n, r.t.toFixed(2), 'vy', r.vin.toFixed(0), '→', r.vout.toFixed(0), 'e', r.ey.toFixed(2), '| vx', r.ux.toFixed(0), '→', r.wx.toFixed(0), 'kept', r.kx.toFixed(2));
console.log('HS grass bounce: n', hs.length, 'vy e median', median(hs.map((r) => r.ey)).toFixed(2), ' vx kept median', median(hs.map((r) => r.kx)).toFixed(2));
// ours
const ours = [];
for (let s = 0; s < 6; s++) {
  let seed = 99 + s; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const bots = [createBot(2, rng), createBot(2, rng)], frames = [];
  for (let i = 0; i < 60 * 70 && m.phase !== 'over'; i++) {
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]); m.events.length = 0;
    const live = m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0);
    frames.push({ t: i / 60, ball: live && !m.ball.power ? { x: m.ball.x, y: m.ball.y } : null, p0: { x: m.players[0].x, y: headY(m.players[0]) }, p1: { x: m.players[1].x, y: headY(m.players[1]) } });
  }
  ours.push(...bounces(frames));
}
console.log('OURS grass bounce: n', ours.length, 'vy e median', median(ours.map((r) => r.ey)).toFixed(2), ' vx kept median', median(ours.map((r) => r.kx)).toFixed(2));
const cleanO = ours.filter((r) => r.ey > 0.2 && r.ey < 1.0); console.log("OURS clean kept", median(cleanO.map((r) => r.kx)).toFixed(2), "mu", median(cleanO.map((r) => (Math.abs(r.ux) - Math.abs(r.wx)) / (r.vin - r.vout))).toFixed(3));
const clean = hs.filter((r) => r.ey > 0.2 && r.ey < 1.0 && r.kx > -0.2 && r.kx < 1.3);
const mu = clean.map((r) => (Math.abs(r.ux) - Math.abs(r.wx)) / (r.vin - r.vout));   // Δ|vx| / Δvy
console.log('clean n', clean.length, 'vy e median', median(clean.map((r) => r.ey)).toFixed(2), 'vx kept median', median(clean.map((r) => r.kx)).toFixed(2));
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * a.length)];
console.log('grip mu = d|vx|/dvy: p25', q(mu, 0.25).toFixed(3), 'median', median(mu).toFixed(3), 'p75', q(mu, 0.75).toFixed(3));
// by impact strength
for (const [lo, hi] of [[0, 400], [400, 700], [700, 2000]]) { const R = clean.filter((r) => r.vin >= lo && r.vin < hi); console.log(`  vy in ${lo}-${hi}: n ${R.length} kept ${median(R.map((r) => r.kx))?.toFixed(2)} |vx| in ${median(R.map((r) => Math.abs(r.ux)))?.toFixed(0)} mu ${median(R.map((r) => (Math.abs(r.ux) - Math.abs(r.wx)) / (r.vin - r.vout)))?.toFixed(3)}`); }
