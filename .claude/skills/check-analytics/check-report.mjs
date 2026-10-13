// Checks a dashboard report file before it is uploaded: node check-report.mjs <report.json>
// The dashboard (dashboard.html) reads one array of rows; every row has `section` and a unique `key`.
import { readFileSync } from 'node:fs';

const SECTIONS = {
  meta: ['range', 'generated', 'status', 'data_kind'],
  finding: ['text'],
  kpi: ['label', 'value', 'display'],
  mode: ['mode', 'players', 'visits', 'total_secs', 'total_time', 'avg_visit'],
  match: ['mode', 'started', 'finished', 'quit', 'dropped', 'closed_app', 'win_rate', 'avg_length', 'goals'],
  left: ['category', 'mode', 'sessions'],
  why: ['label', 'display'],
  session: ['started', 'length', 'modes', 'matches', 'ended'],
  arena: ['label', 'display'],
  arcade: ['stage', 'players'],
  champ: ['champ', 'matches', 'players'],
  unlock: ['type', 'item', 'players'],
  retention: ['label', 'display'],
  platform: ['platform', 'version', 'sessions', 'players'],
  health: ['label', 'display'],
};
const REQUIRED_KEYS = ['meta', 'f1', 'f2', 'f3', 'kpi-players', 'kpi-new', 'kpi-sessions', 'kpi-avg', 'kpi-total', 'kpi-matches', 'health-events'];
const NUMERIC = new Set(['value', 'players', 'visits', 'total_secs', 'started', 'finished', 'quit', 'dropped', 'closed_app', 'sessions', 'stage', 'matches']);

const errs = [];
let rows;
try { rows = JSON.parse(readFileSync(process.argv[2], 'utf8')); } catch (e) { console.error('not valid JSON:', e.message); process.exit(1); }
if (!Array.isArray(rows)) errs.push('the file must be one JSON array of rows');
const seen = new Set();
for (const [i, r] of (rows || []).entries()) {
  if (!SECTIONS[r.section]) { errs.push(`row ${i}: unknown section "${r.section}"`); continue; }
  if (typeof r.key !== 'string' || !r.key) errs.push(`row ${i}: no key`);
  else if (seen.has(r.key)) errs.push(`row ${i}: key "${r.key}" used twice`);
  seen.add(r.key);
  for (const f of SECTIONS[r.section]) if (!(f in r)) errs.push(`${r.key}: missing "${f}"`);
  for (const [f, v] of Object.entries(r)) if (NUMERIC.has(f) && r.section !== 'session' && typeof v !== 'number') errs.push(`${r.key}: "${f}" must be a number`);
  if (r.section === 'meta' && !['real', 'test', 'none'].includes(r.data_kind)) errs.push('meta: data_kind must be real, test or none');
}
for (const k of REQUIRED_KEYS) if (!seen.has(k)) errs.push(`missing row "${k}"`);
const size = Buffer.byteLength(JSON.stringify(rows));
if (size > 8e6) errs.push(`file is ${size} bytes; the limit is 8 MB`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`ok: ${rows.length} rows, ${size} bytes`);
