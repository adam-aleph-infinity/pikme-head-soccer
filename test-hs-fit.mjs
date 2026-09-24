// THE MEASURING TAPE IS MEASURED. Run: node test-hs-fit.mjs
//
// Every Head Soccer number in docs/hs-reference.json comes out of tools/hs-fit-lib.mjs, and so
// will every number the parity harness reads off our own sim. If the fits are biased, both
// sides are biased the same way and nothing will ever look wrong — so they are checked here
// against motion whose answer is known: exact parabolas, bounces, runs and jumps, sampled at
// 60fps with a little click noise, and the fit has to give the answer back within 1–2%.
//
// Also the two other pure pieces the measuring page relies on: the pixel→world calibration and
// the blob tracker / duplicate-frame detector.
import * as C from './shared/constants.js';
import * as F from './tools/hs-fit-lib.mjs';
import { makeCalib, pxToWorld, worldToPx, pxLen } from './tools/hs-calib.mjs';
import { findBlob, fitCircle, markDuplicates, effectiveFps, medianBackground, predict } from './tools/hs-track.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const near = (name, got, want, rel) =>
  ok(name, got != null && Math.abs(got - want) <= rel * Math.abs(want), `got ${got}, want ${want} ±${rel * 100}%`);

// Seeded noise so a failure is reproducible.
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const noise = (amp) => (rnd() * 2 - 1) * amp;
const DT = 1 / 60;

// ─── a ball dropped onto the ground, bouncing ────────────────────────────────────────────────
// Solved event to event, so the samples are exact apart from the added noise.
function dropTrack({ g = 1500, e = 0.7, y0 = 100, floor = 410, vx = 0, T = 3, amp = 0.3 }) {
  const events = [];          // [tStart, yStart, vyStart]
  let t = 0, y = y0, vy = 0;
  while (t < T && events.length < 30) {
    events.push([t, y, vy]);
    // time to reach the floor from (y, vy): y + vy τ + ½gτ² = floor
    const tau = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - y))) / g;
    const vHit = vy + g * tau;
    t += tau; y = floor; vy = -e * vHit;
    if (Math.abs(vy) < 60) break;
  }
  const pts = [], bounces = events.slice(1).map((ev) => ev[0]);
  for (let k = 0; k * DT < T; k++) {
    const tk = k * DT;
    let ev = events[0];
    for (const cand of events) if (cand[0] <= tk) ev = cand;
    const u = tk - ev[0];
    const yy = Math.min(floor, ev[1] + ev[2] * u + 0.5 * g * u * u);
    pts.push({ t: tk, x: 200 + vx * tk + noise(amp), y: yy + noise(amp) });
  }
  return { pts, bounces };
}

{
  const { pts, bounces } = dropTrack({});
  near('gravity from tagged bounces', F.fitGravity(pts, bounces).value, 1500, 0.01);
  near('gravity from DETECTED bounces', F.fitGravity(pts).value, 1500, 0.01);
  const det = F.detectContacts(pts);
  ok('bounce detector finds the first three bounces', det.length >= 3 &&
     bounces.slice(0, 3).every((b) => det.some((d) => Math.abs(d - b) < 1.5 * DT)), `detected ${det.map((d) => d.toFixed(3))}`);
  const r = F.fitRestitution(pts, bounces.slice(0, 3));
  near('ground restitution 0.7', r.value, 0.7, 0.02);
  ok('restitution counts its bounces', r.n === 3, `n=${r.n}`);
  const r2 = F.fitRestitution(dropTrack({ e: 0.45 }).pts);
  near('restitution 0.45, bounces detected', r2.value, 0.45, 0.02);
}

// A wall bounce is the same fit on x.
{
  const pts = [];
  const tWall = 0.5, vx = 700, e = 0.6, wall = 1040;
  for (let k = 0; k * DT < 1.2; k++) {
    const t = k * DT;
    const x = t < tWall ? wall - vx * (tWall - t) : wall - e * vx * (t - tWall);
    pts.push({ t, x: x + noise(0.3), y: 200 + 300 * t + 750 * t * t });
  }
  near('wall restitution on x', F.fitRestitution(pts, [tWall], { axis: 'x' }).value, 0.6, 0.02);
}

// ─── a run: accelerate, cruise, release ──────────────────────────────────────────────────────
{
  const a = 2400, vmax = 480, d = 3000;
  const tUp = vmax / a, tRel = 1.2;
  const pts = [];
  for (let k = 0; k * DT < 1.8; k++) {
    const t = k * DT;
    let x;
    const xUp = 0.5 * a * tUp * tUp;
    if (t < 0.2) x = 0;
    else if (t < 0.2 + tUp) x = 0.5 * a * (t - 0.2) ** 2;
    else if (t < tRel) x = xUp + vmax * (t - 0.2 - tUp);
    else {
      const u = Math.min(t - tRel, vmax / d);
      x = xUp + vmax * (tRel - 0.2 - tUp) + vmax * u - 0.5 * d * u * u;
    }
    pts.push({ t, x: 100 + x + noise(0.3), y: 400 + noise(0.3) });
  }
  near('top speed', F.fitTopSpeed(pts).value, vmax, 0.01);
  near('acceleration (10–90%)', F.fitAccel(pts).value, a, 0.02);
  near('rise time', F.fitAccel(pts).rise, 0.8 * vmax / a, 0.02);
  near('deceleration after release', F.fitDecel(pts).value, d, 0.05);
}

// ─── jumps: stand, jump, land, repeat ────────────────────────────────────────────────────────
{
  const g = 2000, base = 380;
  const v0s = [800, 800, 800, 1000, 1000];
  const starts = [0.5, 1.6, 2.7, 3.8, 4.9];
  const pts = [];
  for (let k = 0; k * DT < 6; k++) {
    const t = k * DT;
    let y = base;
    starts.forEach((s, j) => {
      const u = t - s;
      if (u > 0 && u < (2 * v0s[j]) / g) y = base - (v0s[j] * u - 0.5 * g * u * u);
    });
    pts.push({ t, x: 300, y: y + noise(0.3) });
  }
  const js = F.jumps(pts);
  ok('five jumps found', js.length === 5, `found ${js.length}`);
  near('tap apex = v0²/2g', F.fitApex(pts, { startTimes: starts.slice(0, 3) }).value, 800 ** 2 / (2 * g), 0.01);
  near('held apex, told apart by tag', F.fitApex(pts, { startTimes: starts.slice(3) }).value, 1000 ** 2 / (2 * g), 0.01);
  near('airtime = 2v0/g', F.fitAirtime(pts, { startTimes: starts.slice(0, 3) }).value, (2 * 800) / g, 0.01);
  near('player gravity', F.fitJumpGravity(pts).value, g, 0.01);
}

// ─── a kick ──────────────────────────────────────────────────────────────────────────────────
{
  const g = 1500, vx = -650, vy = -420, tk = 0.3;
  const pts = [];
  for (let k = 0; k * DT < 1; k++) {
    const t = k * DT, u = Math.max(0, t - tk);
    pts.push({ t, x: 600 + vx * u + noise(0.2), y: 350 + vy * u + 0.5 * g * u * u + noise(0.2) });
  }
  const L = F.launch(pts, tk, { n: 6 });
  near('launch speed', L.speed, Math.hypot(vx, vy), 0.02);
  near('launch angle, above horizontal, either direction', L.angle, (Math.atan2(420, 650) * 180) / Math.PI, 0.02);
  near('launch speed with gravity known', F.fitLaunchSpeed(pts, [tk], { n: 4, g }).value, Math.hypot(vx, vy), 0.02);
}

// ─── durations between tags ──────────────────────────────────────────────────────────────────
{
  const tags = [
    { t: 1.0, type: 'ready_on' }, { t: 2.5, type: 'ready_off' },
    { t: 10, type: 'ready_on' }, { t: 11.52, type: 'ready_off' },
    { t: 20, type: 'dash' }, { t: 20.8, type: 'dash' }, { t: 21.6, type: 'dash' },
  ];
  near('duration ready_on → ready_off', F.duration(tags, 'ready_on', 'ready_off').value, 1.51, 0.001);
  ok('duration counts pairs', F.duration(tags, 'ready_on', 'ready_off').n === 2);
  near('spacing (cooldown)', F.spacing(tags, 'dash').value, 0.8, 0.001);
  ok('nothing to measure → NONE', F.duration(tags, 'goal', 'ready_on').value === null);
}

// ─── series() skips duplicates and gaps ──────────────────────────────────────────────────────
{
  const frames = [
    { i: 0, t: 0, ball: { x: 1, y: 2, r: 5 } },
    { i: 1, t: 1 / 60, dup: true, ball: { x: 1, y: 2, r: 5 } },
    { i: 2, t: 2 / 60, ball: null },
    { i: 3, t: 3 / 60, ball: { x: 3, y: 4, r: 5 } },
  ];
  const s = F.series(frames, 'ball');
  ok('series keeps unique, tracked frames only', s.length === 2 && s[1].i === 3);
}

// ─── calibration ─────────────────────────────────────────────────────────────────────────────
{
  const world = { W: C.W, groundY: C.GROUND_Y };
  ok('no calibration without walls and ground', makeCalib({ wallL: { x: 10, y: 0 } }, world) === null);
  // A recording where the pitch spans 2·W pixels, starting at x=140, grass at y=900.
  const clicks = {
    wallL: { x: 140, y: 500 }, wallR: { x: 140 + 2 * C.W, y: 510 }, ground: { x: 800, y: 900 },
    crossbar: { x: 200, y: 900 - 2 * 150 }, headTop: { x: 500, y: 700 }, headBottom: { x: 500, y: 820 },
    goalFront: { x: 140 + 2 * 70, y: 700 },
  };
  const cal = makeCalib(clicks, world);
  near('scale is W / wall span', cal.scale, 0.5, 1e-9);
  const o = pxToWorld(cal, { x: 140, y: 900 });
  ok('left wall on the grass → (0, GROUND_Y)', Math.abs(o.x) < 1e-9 && Math.abs(o.y - C.GROUND_Y) < 1e-9);
  const r = pxToWorld(cal, { x: 140 + 2 * C.W, y: 900 - 200 });
  ok('right wall, 200px up → (W, GROUND_Y − 100)', Math.abs(r.x - C.W) < 1e-9 && Math.abs(r.y - (C.GROUND_Y - 100)) < 1e-9);
  const back = worldToPx(cal, pxToWorld(cal, { x: 777, y: 333 }));
  ok('worldToPx inverts pxToWorld', Math.abs(back.x - 777) < 1e-9 && Math.abs(back.y - 333) < 1e-9);
  near('goal height cross-check', cal.checks.goalHeight, 150, 1e-9);
  near('head diameter cross-check', cal.checks.headDiameter, 60, 1e-9);
  near('goal mouth x cross-check', cal.checks.goalMouthX, 70, 1e-9);
  near('lengths use the same scale', pxLen(cal, 40), 20, 1e-9);
}

// ─── tracker ─────────────────────────────────────────────────────────────────────────────────
{
  const w = 200, h = 120;
  const frame = (cx, cy, r, extra = []) => {
    const data = new Uint8Array(w * h).fill(60);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) data[y * w + x] = 230;
      for (const [ex, ey, er] of extra) if ((x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= er * er) data[y * w + x] = 200;
    }
    return { w, h, f: 1, data };
  };
  const bg = { w, h, f: 1, data: new Uint8Array(w * h).fill(60) };
  const c = findBlob(frame(83.3, 51.7, 9), bg, { at: { x: 80, y: 50 } });
  ok('blob centre within half a pixel', c && Math.hypot(c.x - 83.3, c.y - 51.7) < 0.5, JSON.stringify(c));
  near('blob radius', c?.r, 9, 0.08);
  const two = findBlob(frame(60, 60, 8, [[140, 60, 14]]), bg, { at: { x: 100, y: 60 }, searchR: 90, expectR: 8 });
  ok('of two blobs, the right-sized one near the prediction', two && Math.abs(two.x - 60) < 1 && Math.abs(two.r - 8) < 1, JSON.stringify(two));
  const edge = []; for (let a = 0; a < 20; a++) edge.push([10 + 5 * Math.cos(a), 20 + 5 * Math.sin(a)]);
  const fc = fitCircle(edge);
  ok('circle fit is exact on a circle', Math.abs(fc.x - 10) < 1e-6 && Math.abs(fc.r - 5) < 1e-6);
  const med = medianBackground([frame(20, 20, 5), bg, bg, frame(100, 50, 5), bg]);
  ok('median background drops what moves', med.data.every((v) => v === 60));
  const p = predict([{ t: 0, x: 0, y: 0 }, { t: 1, x: 10, y: 5 }], 2);
  ok('constant-velocity prediction', p.x === 20 && p.y === 10);

  // A game at 30fps recorded at 60: every other frame repeats.
  const grays = [], times = [];
  for (let k = 0; k < 40; k++) { grays.push(frame(20 + 4 * Math.floor(k / 2), 60, 6)); times.push(k / 60); }
  const dup = markDuplicates(grays);
  ok('duplicates: every second frame', dup.filter(Boolean).length === 20 && dup[1] && !dup[2]);
  near('effective fps 30', effectiveFps(times, dup), 30, 0.001);
  near('container fps 60', effectiveFps(times, null), 60, 0.001);
}

console.log(`test-hs-fit: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
