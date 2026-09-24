// TRACKS → THE HEAD SOCCER REFERENCE. Run: node _hs-fit.mjs
//
// Step 3 of 4 in docs/HS-RECORDING.md. Reads every docs/hs-clips/*.tracks.json, runs the fits
// in METRICS (tools/hs-fit-lib.mjs) on the takes of the clips each metric is measured from, and writes
// docs/hs-reference.json — one row per number the parity harness will hold our sim to:
//
//   {id, value, unit, clips, n, sd, tol, scenario, status, [metric], [bound]}
//
//   value     mean over takes (each take's own fit first, then across takes)
//   sd        spread across takes (or the single take's error bar)
//   tol       max(2·sd, 3%·|value|); a timing is never tighter than one unique frame
//   scenario  the scripted situation the sim-side harness must build to measure the same thing
//   status    'measured'   fitted from tracks, now
//             'estimated'  typed in by hand (YouTube, a stat screen) — kept, never overwritten
//                          unless tracks now measure it — or fitted only from tracks marked
//                          `provisional: true` (tagged by a script, not yet checked by eye in
//                          the measuring page; saving from the page drops the flag)
//             'unmeasured' no tracks yet; value null. The harness skips these.
//   metric    (estimates only) the METRICS id that measures this row, when the id differs
//   bound     'min': the value is a LOWER bound ("held at least 5.4 s"), parity is sim >= value − tol;
//             'max': an UPPER bound ("stops within 3 frames"), parity is sim <= value + tol
//   prefer    (estimates only) wins over a fit made only from provisional (script-tagged) tracks
//
// With no tracks at all it still writes every row as 'unmeasured', which is how the schema was
// seeded: the harness has something to read before the first clip exists.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import * as F from './tools/hs-fit-lib.mjs';

const ROOT = import.meta.dirname;
const CLIPS = path.join(ROOT, 'docs', 'hs-clips');
const OUT = path.join(ROOT, 'docs', 'hs-reference.json');
// Hand-entered numbers: [{id, value, unit?, sd?, tol?, clips, source, how?, note?, prefer?, bound?, metric?}]. Each becomes an
// 'estimated' row unless tracks measure that id. `source` says where to look to check it
// (clip + timestamp, a YouTube link, a stat screen).
const ESTIMATES = path.join(ROOT, 'docs', 'hs-estimates.json');

// ─── the metric table ────────────────────────────────────────────────────────────────────────
// It lives in tools/hs-fit-lib.mjs now, next to the fits, because the parity harness runs the
// same table over tracks recorded from our sim (measureTracks). Re-exported here for callers
// that always imported it from this file.
export const METRICS = F.METRICS;
// "C07" and "C7" are the same clip; "M1" is full match #1. Prefix letter + number, no padding.
export const clipId = (s) => { const m = /^([A-Za-z])0*(\d+)/.exec(String(s)); return m ? m[1].toUpperCase() + m[2] : String(s); };
// A metric's `clips` entry matches a clip id exactly, or a whole family with 'M*'.
const clipMatches = (pat, id) => (pat.endsWith('*') ? id.startsWith(pat.slice(0, -1)) : pat === id);

// ─── run ─────────────────────────────────────────────────────────────────────────────────────
export function loadTracks(dir = CLIPS) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.tracks.json')).sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(path.join(dir, f), 'utf8')) }))
    .map((d) => ({ ...d, clipId: clipId(d.clip), tags: d.tags ?? [], frames: d.frames ?? [] }));
}

export function fitAll(docs, previous = [], estimates = []) {
  const prev = new Map(previous.map((r) => [r.id, r]));
  const est = new Map(estimates.map((e) => [e.id, e]));
  return METRICS.map((m) => {
    const takes = docs.filter((d) => m.clips.some((c) => c === '*' || clipMatches(c, d.clipId)));
    const per = [];
    for (const d of takes) {
      let r;
      try { r = m.fit(d); } catch (e) { console.warn(`  ${m.id} on ${d.file}: ${e.message}`); r = F.NONE; }
      if (r && r.value != null && Number.isFinite(r.value)) per.push({ ...r, clip: d.clipId, fps: d.fps || 60, provisional: !!d.provisional });
    }
    const clips = [...new Set(per.map((r) => r.clip))];
    const provisional = per.length && takes.filter((d) => per.some((r) => r.clip === d.clipId)).every((d) => d.provisional);
    const row = { id: m.id, value: null, unit: m.unit, clips: m.clips, n: 0, sd: null, tol: null, scenario: m.scenario, status: 'unmeasured' };
    const e = est.get(m.id);
    // A hand estimate marked `prefer` beats a fit made only from PROVISIONAL (script-tagged)
    // tracks — a clip measured by eye for exactly this number is better evidence than a
    // side-effect of a script pass. It never beats a 'measured' fit.
    if (per.length && !(e?.prefer && provisional)) {
      const c = F.combine(per);
      const fps = Math.min(...per.map((r) => r.fps));
      let tol = Math.max(2 * c.sd, 0.03 * Math.abs(c.value));
      if (m.timing) tol = Math.max(tol, 1 / fps);
      Object.assign(row, { value: round(c.value), n: c.n, sd: round(c.sd), tol: round(tol), clips, takes: per.length,
        status: provisional ? 'estimated' : 'measured' });
    } else if (e) {
      const tol = e.tol ?? Math.max(2 * (e.sd ?? 0), 0.03 * Math.abs(e.value), m.timing ? 1 / 60 : 0);
      Object.assign(row, { value: e.value, n: e.n ?? 1, sd: e.sd ?? null, tol: round(tol), clips: e.clips, status: 'estimated', source: e.source,
        ...(e.bound ? { bound: e.bound } : {}), ...(e.how ? { how: e.how } : {}), ...(e.note ? { note: e.note } : {}) });
      // What the provisional tracks said, kept beside the preferred estimate so it stays visible.
      if (per.length) { const c = F.combine(per); row.tracksValue = round(c.value); row.tracksClips = clips; }
    } else {
      const old = prev.get(m.id);
      if (old && old.status === 'estimated') return old;
    }
    return row;
  });
}

// Estimates for ids no metric defines (a yes/no observation, say) still belong in the
// reference, so they are appended as rows of their own.
export function extraEstimates(estimates) {
  const known = new Set(METRICS.map((m) => m.id));
  return estimates.filter((e) => !known.has(e.id)).map((e) => ({
    id: e.id, value: e.value, unit: e.unit ?? '', clips: e.clips, n: e.n ?? 1, sd: e.sd ?? null,
    tol: e.tol ?? (typeof e.value === 'number' ? round(Math.max(2 * (e.sd ?? 0), 0.03 * Math.abs(e.value))) : null),
    // `metric`: the METRICS id this row is measured by, when the row's own id is a variant of
    // it (a number from a different clip, say) — the scenario then defaults to that metric's.
    ...(e.metric ? { metric: e.metric } : {}), ...(e.bound ? { bound: e.bound } : {}),
    scenario: e.scenario ?? F.METRIC_BY_ID.get(e.metric)?.scenario ?? null, status: 'estimated', source: e.source,
    ...(e.how ? { how: e.how } : {}), ...(e.note ? { note: e.note } : {}),
  }));
}

const round = (v) => (v == null ? v : Math.round(v * 1e4) / 1e4);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const docs = loadTracks();
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const estimates = existsSync(ESTIMATES) ? JSON.parse(readFileSync(ESTIMATES, 'utf8')) : [];
  const rows = [...fitAll(docs, previous, estimates), ...extraEstimates(estimates)];
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n');
  console.log(`${docs.length} track file(s) → ${path.relative(ROOT, OUT)}`);
  for (const r of rows) {
    const v = r.value == null ? '—' : typeof r.value === 'number' ? `${r.value} ±${r.tol} ${r.unit}`.trim() : String(r.value);
    console.log(`  ${r.status.padEnd(10)} ${r.id.padEnd(26)} ${v}${r.n ? `  (n=${r.n}, ${r.clips.join(' ')})` : ''}`);
  }
}
