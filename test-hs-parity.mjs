// Head Soccer parity — REPORT-ONLY until the switch-over (see the plan, Phase B/Verification).
//
// For every row of docs/hs-reference.json whose status is measured or estimated:
//   1. build the row's scenario in OUR sim (hs-scenarios.mjs) and record it as a tracks
//      document — the same shape the video tracker writes;
//   2. measure it with measureTracks() from tools/hs-fit-lib.mjs — the SAME fit, from the same
//      metric table, that turned the Head Soccer recording into the row's value;
//   3. print  id | HS value | our sim | diff % | tol | ok/OFF.
//
// A row's metric is its `metric` field, else its id. `bound: 'min'` rows are lower bounds
// ("stays armed at least 5.4 s"): ok when sim >= value − tol; `bound: 'max'` rows are upper
// bounds ("stops within 3 frames"): ok when sim <= value + tol. A row whose scenario or metric
// cannot be run, or whose metric comes back empty on our sim, is OFF — "we cannot even show
// this" is a parity failure, not a pass.
//
// Nothing here reads a constant: every number is measured off the sim's own per-tick state, so it
// is the per-second behaviour a player actually sees.
//
// Always exits 0, so it can sit in `npm test` while the numbers are still being measured.
// HS_PARITY_STRICT=1 turns any OFF row into exit 1 — that is the switch CI flips once parity
// is green.
import fs from 'node:fs';
import * as C from './shared/constants.js';
import { runScenario, SCENARIOS } from './hs-scenarios.mjs';
import { measureTracks, METRIC_BY_ID } from './tools/hs-fit-lib.mjs';

const STRICT = process.env.HS_PARITY_STRICT === '1';
const REF_PATH = new URL('./docs/hs-reference.json', import.meta.url);

const fmt = (v) => (v == null || !Number.isFinite(v) ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3));
const pad = (s, n) => String(s).padEnd(n);

let ref = [];
if (!fs.existsSync(REF_PATH)) {
  console.log('test-hs-parity: no docs/hs-reference.json yet — nothing to compare');
  process.exit(0);
}
// A reference file mid-edit must not break `npm test` while this is report-only.
try { ref = JSON.parse(fs.readFileSync(REF_PATH, 'utf8')); }
catch (err) { console.log(`test-hs-parity: docs/hs-reference.json unreadable: ${err.message}`); process.exit(STRICT ? 1 : 0); }
if (!Array.isArray(ref)) ref = ref.entries || Object.values(ref);

// One run per scenario, however many rows read it.
const tracks = new Map();
const tracksFor = (name) => {
  if (!tracks.has(name)) {
    let doc = null;
    try { doc = SCENARIOS[name] ? runScenario(name) : null; } catch (err) { console.log(`  scenario ${name}: ${err.message}`); }
    tracks.set(name, doc);
  }
  return tracks.get(name);
};

const rows = [];
let ok = 0, off = 0, skipped = 0;
for (const e of ref) {
  if (e.status !== 'measured' && e.status !== 'estimated') { skipped++; continue; }
  const metric = e.metric || e.id;
  let sim = null, why = '';
  if (!METRIC_BY_ID.has(metric)) why = 'no metric';
  else if (!e.scenario || !SCENARIOS[e.scenario]) why = `no scenario ${e.scenario ?? ''}`.trim();
  else {
    const doc = tracksFor(e.scenario);
    if (!doc) why = 'scenario failed';
    else {
      const r = measureTracks(doc, [metric])[metric];
      if (r.value == null || !Number.isFinite(r.value)) why = 'not seen in sim';
      else sim = Math.abs(r.value) < 1e-6 ? 0 : r.value;
    }
  }
  const hs = e.value, tol = e.tol ?? 0;
  let good = false;
  if (sim != null) {
    if (e.bound === 'min') good = sim >= hs - tol;
    else if (e.bound === 'max') good = sim <= hs + tol;
    else good = Math.abs(sim - hs) <= tol;
  }
  good ? ok++ : off++;
  const diff = sim == null ? '—' : hs === 0 ? (sim === 0 ? '0' : `Δ${fmt(sim)}`) : `${((sim - hs) / Math.abs(hs) * 100).toFixed(0)}%`;
  const hsStr = (e.bound === 'min' ? '≥' : e.bound === 'max' ? '≤' : '') + fmt(hs);
  rows.push([e.id, `${hsStr} ${e.unit ?? ''}`.trim(), fmt(sim), diff, fmt(tol), good ? 'ok' : `OFF${why ? ` (${why})` : ''}`]);
}

const W = [26, 16, 10, 9, 8];
console.log(`test-hs-parity: our sim (HS=${C.HS}) vs docs/hs-reference.json, fit: tools/hs-fit-lib.mjs measureTracks`);
console.log('  ' + ['id', 'HS value', 'our sim', 'diff %', 'tol', 'ok/OFF'].map((c, k) => (k < W.length ? pad(c, W[k]) : c)).join(' | '));
for (const r of rows) console.log('  ' + r.map((c, k) => (k < W.length ? pad(c, W[k]) : c)).join(' | '));
console.log(`test-hs-parity: ${ok + off} compared, ${ok} ok, ${off} OFF, ${skipped} unmeasured skipped` +
            (STRICT ? ' (STRICT)' : ' (report-only)'));
process.exit(STRICT && off ? 1 : 0);
