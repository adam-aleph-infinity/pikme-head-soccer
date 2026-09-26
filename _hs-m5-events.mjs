// M5 tracks → events and numbers. Run after _hs-m5.mjs:  node _hs-m5-events.mjs [--list]
//
// Everything in WORLD units (px, px/s, y down) through the M5 calibration. A contact is an
// abrupt change of the ball's velocity (tools/hs-fit-lib.mjs detectContacts on both axes); each
// one is given to the player whose face is nearest, and to the human's KICK if the plaque lit
// up within the swing before it. The launch is fitted on the free flight after the contact.
import { readFileSync } from 'node:fs';
import { series, detectContacts, freeFlights, polyfit, launch, median, mean, sampleSd } from './tools/hs-fit-lib.mjs';

const LIST = process.argv.includes('--list');
const d = JSON.parse(readFileSync('docs/hs-clips/M5-kor-kor-weak.raw.json', 'utf8'));
const c = d.calib;
const wx = (x) => (x - c.wallL) * c.s;
const wy = (y) => c.groundY + (y - c.ground) * c.s;
const frames = d.frames.map((f) => ({
  i: f.i, t: f.t, dup: f.dup,
  ball: f.ball && { x: wx(f.ball.x), y: wy(f.ball.y), m: f.ball.m },
  p0: f.f[0] && { x: wx(f.f[0].x), y: wy(f.f[0].y), top: wy(f.f[0].y0), bot: wy(f.f[0].y1) },
  p1: f.f[1] && { x: wx(f.f[1].x), y: wy(f.f[1].y), top: wy(f.f[1].y0), bot: wy(f.f[1].y1) },
  btn: f.btn,
}));
const lit = {
  K: ([r, g, b]) => (r + g) / 2 > 145 && b < 75, J: ([r, g, b]) => (r + g) / 2 > 170 && b < 70,
  L: ([r, g, b]) => (r + g) / 2 > 190 && b < 60, R: ([r, g, b]) => (r + g) / 2 > 190 && b < 60,
};
export const presses = {};
for (const k in lit) {
  presses[k] = [];
  let prev = false;
  for (const f of frames) { const v = lit[k](f.btn[k]); if (v && !prev) presses[k].push({ t: f.t, i: f.i }); if (!v && prev) presses[k][presses[k].length - 1].up = f.t; prev = v; }
}

// The ball track, split where it was lost for more than 2 frames or teleported.
const ball = series(frames, 'ball');
const contacts = [...new Set([...detectContacts(ball, { axis: 'y', minDv: 250 }), ...detectContacts(ball, { axis: 'x', minDv: 250 })])].sort((a, b) => a - b);
const merged = [];
for (const t of contacts) if (!merged.length || t - merged[merged.length - 1] > 0.05) merged.push(t);
const flights = freeFlights(ball, merged, { minPts: 5 });

const at = (t) => frames.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b), frames[0]);
const faceAt = (t, k) => { for (let dt = 0; dt < 0.1; dt += 1 / 60) { const f = at(t - dt); if (f['p' + k]) return f['p' + k]; } return null; };

// Standing face centroid height above the grass — the reference for "is he in the air".
const standY = median(frames.filter((f) => f.p0).map((f) => f.p0.y).filter((y) => y > 390));
export const events = [];
for (const t of merged) {
  const f = at(t);
  const pre = ball.filter((p) => p.t < t && p.t > t - 0.12);
  if (!f.ball && !pre.length) continue;
  const b = f.ball || pre[pre.length - 1];
  const who = [0, 1].map((k) => ({ k, p: faceAt(t, k) })).filter((o) => o.p)
    .map((o) => ({ ...o, d: Math.hypot(b.x - o.p.x, b.y - o.p.y) })).sort((a, z) => a.d - z.d)[0];
  const kick = presses.K.filter((p) => p.t <= t + 0.02 && p.t > t - 0.30).pop();
  const l = launch(ball, t, { n: 7 });
  const prior = pre.length >= 3 ? polyfit(pre.map((p) => p.t), pre.map((p) => p.x), 1, t) : null;
  const priorY = pre.length >= 3 ? polyfit(pre.map((p) => p.t), pre.map((p) => p.y), pre.length >= 5 ? 2 : 1, t) : null;
  // apex of the flight after
  const fl = flights.find((s) => s[0].t > t && s[0].t < t + 0.1);
  let apex = null;
  if (fl && fl.length >= 8) { const fy = polyfit(fl.map((p) => p.t), fl.map((p) => p.y), 2, fl[0].t); if (fy && fy.c[2] > 0) apex = 435 - (fy.c[0] - fy.c[1] ** 2 / (4 * fy.c[2])); }
  const pf = who?.p;
  events.push({
    t: +t.toFixed(3), who: who?.k, dist: who && +who.d.toFixed(1),
    kick: kick ? +(t - kick.t).toFixed(3) : null,
    bx: +b.x.toFixed(0), bh: +(435 - b.y).toFixed(0),                  // ball height above grass
    rel: pf ? { dx: +(b.x - pf.x).toFixed(0), dy: +(b.y - pf.y).toFixed(0) } : null,
    air: pf ? +(standY - pf.y).toFixed(0) : null,
    vin: prior && priorY ? [+prior.c[1].toFixed(0), +priorY.c[1].toFixed(0)] : null,
    out: l ? [+l.vx.toFixed(0), +l.vy.toFixed(0)] : null, speed: l && +l.speed.toFixed(0), angle: l && +l.angle.toFixed(1),
    apex: apex && +apex.toFixed(0),
  });
}
if (LIST) for (const e of events) console.log(JSON.stringify(e));
console.log(`contacts ${events.length}; standing face y ${standY.toFixed(1)}; flights ${flights.length}`);
export { frames, ball, flights, standY };
