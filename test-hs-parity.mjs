// Head Soccer parity — REPORT-ONLY until the switch-over (see the plan, Phase B/Verification).
//
// Two tables:
//   1. "before": for every scenario in hs-scenarios.mjs, what OUR sim measures today (apex,
//      airtime, top speed, ball gravity, bounce ratio, kick launch speed/angle). This is the
//      column the migration moves.
//   2. parity: for each entry in docs/hs-reference.json (when that file exists) whose status
//      is measured/estimated and whose scenario we can run, |sim - ref| <= tol.
//
// Always exits 0, so it can sit in `npm test` while the numbers are still being measured.
// HS_PARITY_STRICT=1 turns a failed or unrunnable entry into exit 1 — that is the switch CI
// flips once parity is green.
import fs from 'node:fs';
import * as C from './shared/constants.js';
import { runScenario, SCENARIO_NAMES } from './hs-scenarios.mjs';

const STRICT = process.env.HS_PARITY_STRICT === '1';
const REF_PATH = new URL('./docs/hs-reference.json', import.meta.url);

// ---------------------------------------------------------------------------
// THE FIT SEAM. The video side and the sim side must run the SAME fit, or a parity number
// compares two methods rather than two games. That shared fit is tools/hs-fit-lib.mjs
// (written separately). If it is present and exports `measureTracks(tracks) -> {metric: value}`
// it is used; otherwise the crude inline measurements below stand in. Swap by making the lib
// export that one function — nothing else in this file needs to change.
let measure = measureInline;
let fitSource = 'inline fallback';
try {
  const lib = await import('./tools/hs-fit-lib.mjs');
  if (typeof lib.measureTracks === 'function') { measure = lib.measureTracks; fitSource = 'tools/hs-fit-lib.mjs'; }
  else fitSource = 'inline fallback (hs-fit-lib has no measureTracks)';
} catch { /* not written yet — the fallback is the point */ }

// Inline measurements: finite differences over the tracked points, nothing fitted. Units are
// world px, seconds, px/s, px/s^2, degrees above horizontal.
function measureInline({ frames, tags }) {
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : C.TICK;
  const tag = (type) => tags.find((g) => g.type === type);
  const out = {};

  // Player 0: apex (head rise above its start), airtime (jump to land), top speed.
  const y0 = frames[0].p0.y;
  const rise = Math.max(...frames.map((f) => y0 - f.p0.y));
  if (rise > 1) out.apex = rise;
  const jump = tag('jump'), land = jump && tags.find((g) => g.type === 'land' && g.i > jump.i);
  if (jump && land) out.airtime = land.t - jump.t;
  let top = 0;
  for (let i = 1; i < frames.length; i++) top = Math.max(top, Math.abs(frames[i].p0.x - frames[i - 1].p0.x) / dt);
  if (top > 1) out.topSpeed = top;

  // Ball gravity: median second difference of y over free flight — well above the grass,
  // below the ceiling, and away from any tagged contact.
  const near = (i) => tags.some((g) => ['bounce', 'touch', 'header', 'kick'].includes(g.type) && Math.abs(g.i - i) <= 2);
  const floor = C.GROUND_Y - C.BALL_R - 3, ceil = C.CEIL_Y + C.BALL_R + 3;
  const acc = [];
  for (let i = 1; i < frames.length - 1; i++) {
    const [a, b, c] = [frames[i - 1].ball, frames[i].ball, frames[i + 1].ball];
    if ([a, b, c].some((q) => q.y > floor || q.y < ceil) || near(i)) continue;
    const g = (a.y - 2 * b.y + c.y) / (dt * dt);
    if (g !== 0) acc.push(g);
  }
  if (acc.length >= 5) { acc.sort((p, q) => p - q); out.ballGravity = acc[acc.length >> 1]; }

  // First ground bounce: vertical speed out / speed in.
  const bounce = tag('bounce');
  if (bounce && bounce.i >= 2 && bounce.i + 1 < frames.length) {
    const vin = (frames[bounce.i - 1].ball.y - frames[bounce.i - 2].ball.y) / dt;
    const vout = (frames[bounce.i + 1].ball.y - frames[bounce.i].ball.y) / dt;
    if (vin > 0) out.bounceRatio = -vout / vin;
  }

  // Kick / header launch: ball velocity over the first two frames it MOVES after the first
  // contact. Not simply hit.i+1: a kick's hit-stop holds the ball still for a few frames, and
  // on video that is equally a run of identical positions.
  const hit = tags.find((g) => g.type === 'touch' || g.type === 'header');
  let j = hit ? hit.i : Infinity;
  while (j + 1 < frames.length && frames[j + 1].ball.x === frames[j].ball.x && frames[j + 1].ball.y === frames[j].ball.y) j++;
  if (hit && j + 1 < frames.length) {
    const [a, b] = [frames[j].ball, frames[j + 1].ball];
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    out.launchSpeed = Math.hypot(vx, vy);
    out.launchAngle = Math.atan2(-vy, Math.abs(vx)) * 180 / Math.PI;
  }

  const ready = tag('ready');
  if (ready) out.readyTime = ready.t;
  return out;
}

// ---------------------------------------------------------------------------
const fmt = (v) => (v === undefined ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3));
const pad = (s, n) => String(s).padEnd(n);
const COLS = ['readyTime', 'apex', 'airtime', 'topSpeed', 'ballGravity', 'bounceRatio', 'launchSpeed', 'launchAngle'];

const measured = {};
for (const name of SCENARIO_NAMES) measured[name] = measure(runScenario(name));

console.log(`test-hs-parity: current sim ("before"), fit: ${fitSource}, HS=${C.HS}`);
console.log('  ' + pad('scenario', 10) + COLS.map((c) => pad(c, 12)).join(''));
for (const name of SCENARIO_NAMES) {
  console.log('  ' + pad(name, 10) + COLS.map((c) => pad(fmt(measured[name][c]), 12)).join(''));
}

// ---------------------------------------------------------------------------
let fail = 0, checked = 0, skipped = 0;
if (!fs.existsSync(REF_PATH)) {
  console.log('  (no docs/hs-reference.json yet — nothing to compare)');
} else {
  // A reference file mid-edit must not break `npm test` while this is report-only.
  let ref = [];
  try { ref = JSON.parse(fs.readFileSync(REF_PATH, 'utf8')); }
  catch (err) { console.log(`  (docs/hs-reference.json unreadable: ${err.message})`); fail++; }
  if (!Array.isArray(ref)) ref = ref.entries || Object.values(ref);
  const rows = [];
  for (const e of ref) {
    if (e.status !== 'measured' && e.status !== 'estimated') { skipped++; continue; }
    // The metric an entry names: its `metric` field, else the last segment of its id
    // ('jump.tap.apex' -> 'apex').
    const metric = e.metric || String(e.id).split('.').pop();
    const sim = measured[e.scenario]?.[metric];
    if (sim === undefined) { rows.push([e.id, e.scenario, '—', fmt(e.value), fmt(e.tol), 'NO SCENARIO/METRIC']); fail++; continue; }
    checked++;
    const good = Math.abs(sim - e.value) <= e.tol;
    if (!good) fail++;
    rows.push([e.id, e.scenario, fmt(sim), fmt(e.value), fmt(e.tol), good ? 'ok' : 'OFF']);
  }
  console.log('  ' + ['id', 'scenario', 'sim', 'ref', 'tol', ''].map((c, k) => pad(c, k ? 12 : 26)).join(''));
  for (const r of rows) console.log('  ' + r.map((c, k) => pad(c, k ? 12 : 26)).join(''));
}
console.log(`test-hs-parity: ${checked} compared, ${fail} off or unrunnable, ${skipped} unmeasured skipped` +
            (STRICT ? ' (STRICT)' : ' (report-only)'));
process.exit(STRICT && fail ? 1 : 0);
