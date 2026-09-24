// TRACKS → THE HEAD SOCCER REFERENCE. Run: node _hs-fit.mjs
//
// Step 3 of 4 in docs/HS-RECORDING.md. Reads every docs/hs-clips/*.tracks.json, runs the fits
// in METRICS below on the takes of the clips each metric is measured from, and writes
// docs/hs-reference.json — one row per number the parity harness will hold our sim to:
//
//   {id, value, unit, clips, n, sd, tol, scenario, status}
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
//
// With no tracks at all it still writes every row as 'unmeasured', which is how the schema was
// seeded: the harness has something to read before the first clip exists.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import * as F from './tools/hs-fit-lib.mjs';

const ROOT = import.meta.dirname;
const CLIPS = path.join(ROOT, 'docs', 'hs-clips');
const OUT = path.join(ROOT, 'docs', 'hs-reference.json');
// Hand-entered numbers: [{id, value, unit?, sd?, tol?, clips, source, note?}]. Each becomes an
// 'estimated' row unless tracks measure that id. `source` says where to look to check it
// (clip + timestamp, a YouTube link, a stat screen).
const ESTIMATES = path.join(ROOT, 'docs', 'hs-estimates.json');

// ─── helpers the metric table uses ───────────────────────────────────────────────────────────
// "C07" and "C7" are the same clip; "M1" is full match #1. Prefix letter + number, no padding.
export const clipId = (s) => { const m = /^([A-Za-z])0*(\d+)/.exec(String(s)); return m ? m[1].toUpperCase() + m[2] : String(s); };
// A metric's `clips` entry matches a clip id exactly, or a whole family with 'M*'.
const clipMatches = (pat, id) => (pat.endsWith('*') ? id.startsWith(pat.slice(0, -1)) : pat === id);

const hasWord = (note, word) => (note || '').toLowerCase().split(/[\s,;/]+/).includes(word);
// Tag times of one type, optionally only those whose note has / lacks a word.
const tagT = (doc, type, { note = null, not = null } = {}) =>
  doc.tags.filter((t) => t.type === type && (!note || hasWord(t.note, note)) && (!not || !hasWord(t.note, not))).map((t) => t.t);
const contactsOf = (doc) => doc.tags.filter((t) => ['kick', 'bounce', 'touch'].includes(t.type)).map((t) => t.t);
const dtOf = (doc) => 1 / (doc.fps || 60);
const ball = (doc) => F.series(doc.frames, 'ball');
const p0 = (doc) => F.series(doc.frames, 'p0');

// Every contact that bounds a ball flight: all tagged ones plus the ones the track shows.
const allCuts = (doc, pts, axis = 'y') => [...contactsOf(doc), ...F.detectContacts(pts, { axis })];

// Restitution at the bounces tagged with `note` (e.g. 'wall'); for the ground, untagged-note
// bounces too, and when nothing is tagged at all, every detected bounce.
function restitution(doc, note, axis = 'y') {
  const pts = ball(doc);
  let at = note === 'ground'
    ? doc.tags.filter((t) => t.type === 'bounce' && (!t.note || hasWord(t.note, 'ground'))).map((t) => t.t)
    : tagT(doc, 'bounce', { note });
  if (!at.length && note === 'ground') at = F.detectContacts(pts, { axis });
  if (!at.length) return F.NONE;
  return F.fitRestitution(pts, allCuts(doc, pts, axis), { axis, at });
}

// Jumps by tag: tap jumps are tagged jump_tap, held ones jump_hold. With no jump tags at all
// every jump counts as a tap.
function jumpOpts(doc, kind) {
  const taps = tagT(doc, 'jump_tap'), holds = tagT(doc, 'jump_hold');
  if (!taps.length && !holds.length) return kind === 'tap' ? {} : null;
  const st = kind === 'tap' ? taps : holds;
  return st.length ? { startTimes: st } : null;
}
const jumpMetric = (fn, kind) => (doc) => { const o = jumpOpts(doc, kind); return o ? fn(p0(doc), o) : F.NONE; };

const kickMetric = (note, what) => (doc) => {
  const ts = note ? tagT(doc, 'kick', { note }) : tagT(doc, 'kick');
  return what === 'speed' ? F.fitLaunchSpeed(ball(doc), ts) : F.fitLaunchAngle(ball(doc), ts);
};

const duration = (a, b, opts) => (doc) => F.duration(doc.tags, a, b, { dt: dtOf(doc), ...opts });

// The first ready_off of the clip to the first gauge_full: a gauge filling from empty at kickoff.
function firstFill(doc) {
  const a = tagT(doc, 'ready_off')[0], b = tagT(doc, 'gauge_full').find((t) => t > (a ?? Infinity));
  return a != null && b != null ? { value: b - a, sd: dtOf(doc), n: 1 } : F.NONE;
}

function dash(doc, what) {
  const pts = p0(doc);
  const run = F.fitTopSpeed(pts.filter((p) => p.t < (tagT(doc, 'dash')[0] ?? Infinity)));
  const bs = tagT(doc, 'dash').map((t) => F.burst(pts, t, { baseSpeed: run.value ?? 0 })).filter(Boolean);
  const vals = bs.map((b) => (what === 'speed' ? b.peak : b.duration)).filter((v) => v != null);
  return vals.length ? { value: F.mean(vals), sd: vals.length > 1 ? F.sampleSd(vals) : (what === 'speed' ? 0.05 * vals[0] : dtOf(doc)), n: vals.length } : F.NONE;
}

const calibCheck = (key) => (doc) => {
  const v = doc.calib?.checks?.[key];
  return v != null ? { value: v, sd: 0, n: 1 } : F.NONE;
};

// ─── THE TABLE ───────────────────────────────────────────────────────────────────────────────
// id: dotted name the harness keys on · unit · clips it is measured from · scenario the sim
// side will build · timing: tolerance floor of one frame · fit: (takeDoc) → {value, sd, n}
// `agg: 'max'` takes each take's max instead of mean (not used by default — see ball.maxSpeed).
export const METRICS = [
  // Geometry, from every clip's calibration clicks — the cross-checks of the mapping itself.
  { id: 'geom.goalHeight', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('goalHeight') },
  { id: 'geom.headDiameter', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('headDiameter') },
  { id: 'geom.goalMouthX', unit: 'px', clips: ['*'], scenario: 'geometry', fit: calibCheck('goalMouthX') },

  // C1 — stand still at kickoff.
  { id: 'kickoff.readyTime', unit: 's', clips: ['C1', 'C17', 'M*'], scenario: 'kickoff', timing: true, fit: duration('ready_on', 'ready_off') },
  { id: 'ball.spawnHeight', unit: 'px', clips: ['C1'], scenario: 'kickoff',
    fit: (d) => { const b = ball(d)[0]; return b ? { value: d.calib.groundY - b.y, sd: 1, n: 1 } : F.NONE; } },
  { id: 'ball.gravity', unit: 'px/s²', clips: ['C1', 'C8', 'C9'], scenario: 'drop',
    fit: (d) => { const pts = ball(d); return F.fitGravity(pts, allCuts(d, pts)); } },
  { id: 'ball.groundRestitution', unit: '', clips: ['C1', 'C9'], scenario: 'drop', fit: (d) => restitution(d, 'ground') },

  // C2 — run from standstill and release. One run per take.
  { id: 'player.topSpeed', unit: 'px/s', clips: ['C2'], scenario: 'run', fit: (d) => F.fitTopSpeed(p0(d)) },
  { id: 'player.accel', unit: 'px/s²', clips: ['C2'], scenario: 'run', fit: (d) => F.fitAccel(p0(d)) },
  { id: 'player.accelTime', unit: 's', clips: ['C2'], scenario: 'run', timing: true,
    fit: (d) => { const a = F.fitAccel(p0(d)); return a.value != null ? { value: a.rise, sd: dtOf(d), n: 1 } : F.NONE; } },
  { id: 'player.decel', unit: 'px/s²', clips: ['C2'], scenario: 'run', fit: (d) => F.fitDecel(p0(d)) },

  // C3 — tap jumps and held jumps.
  { id: 'jump.apex.tap', unit: 'px', clips: ['C3'], scenario: 'jumpTap', fit: jumpMetric(F.fitApex, 'tap') },
  { id: 'jump.apex.hold', unit: 'px', clips: ['C3'], scenario: 'jumpHold', fit: jumpMetric(F.fitApex, 'hold') },
  { id: 'jump.airtime.tap', unit: 's', clips: ['C3'], scenario: 'jumpTap', timing: true, fit: jumpMetric(F.fitAirtime, 'tap') },
  { id: 'jump.airtime.hold', unit: 's', clips: ['C3'], scenario: 'jumpHold', timing: true, fit: jumpMetric(F.fitAirtime, 'hold') },
  { id: 'player.gravity', unit: 'px/s²', clips: ['C3'], scenario: 'jumpTap', fit: jumpMetric(F.fitJumpGravity, 'tap') },

  // C4 — running jump. Horizontal speed kept through the air.
  { id: 'jump.airSpeed', unit: 'px/s', clips: ['C4'], scenario: 'runJump',
    fit: (d) => { const js = F.jumps(p0(d)); const pts = p0(d).filter((p) => js.some((j) => p.t > j.takeoff && p.t < j.land)); return F.fitTopSpeed(pts); } },

  // C5 — dash, then dash-spam (tag each dash that actually happened).
  { id: 'dash.speed', unit: 'px/s', clips: ['C5'], scenario: 'dash', fit: (d) => dash(d, 'speed') },
  { id: 'dash.duration', unit: 's', clips: ['C5'], scenario: 'dash', timing: true, fit: (d) => dash(d, 'duration') },
  { id: 'dash.cooldown', unit: 's', clips: ['C5'], scenario: 'dashSpam', timing: true, fit: (d) => F.spacing(d.tags, 'dash', { dt: dtOf(d) }) },

  // C6 — mash kick, no ball.
  { id: 'kick.cooldown', unit: 's', clips: ['C6'], scenario: 'kickMash', timing: true, fit: (d) => F.spacing(d.tags, 'kick', { dt: dtOf(d) }) },

  // C7 — the kick model: tag each kick with where the ball was (feet / knee / head / jump / run).
  ...['feet', 'knee', 'head', 'jump', 'run'].flatMap((w) => {
    const sc = 'kick' + w[0].toUpperCase() + w.slice(1);
    return [
      { id: `kick.${w}.speed`, unit: 'px/s', clips: ['C7'], scenario: sc, fit: kickMetric(w, 'speed') },
      { id: `kick.${w}.angle`, unit: 'deg', clips: ['C7'], scenario: sc, fit: kickMetric(w, 'angle') },
    ];
  }),

  // C8 — ball dropped on a standing head (touch), then jumping into it (touch, note "jump").
  { id: 'ball.headRestitution', unit: '', clips: ['C8'], scenario: 'headDrop',
    fit: (d) => { const pts = ball(d); const at = tagT(d, 'touch', { not: 'jump' }); return at.length ? F.fitRestitution(pts, allCuts(d, pts), { at }) : F.NONE; } },
  { id: 'header.speed', unit: 'px/s', clips: ['C8'], scenario: 'header', fit: (d) => F.fitLaunchSpeed(ball(d), tagT(d, 'touch', { note: 'jump' })) },
  { id: 'header.angle', unit: 'deg', clips: ['C8'], scenario: 'header', fit: (d) => F.fitLaunchAngle(ball(d), tagT(d, 'touch', { note: 'jump' })) },

  // C9 — the ball off each surface; tag the bounce with the surface's name.
  { id: 'ball.wallRestitution', unit: '', clips: ['C9'], scenario: 'wallBounce', fit: (d) => restitution(d, 'wall', 'x') },
  { id: 'ball.barRestitution', unit: '', clips: ['C9'], scenario: 'barBounce', fit: (d) => restitution(d, 'bar') },
  { id: 'ball.goalTopRestitution', unit: '', clips: ['C9'], scenario: 'goalTopBounce', fit: (d) => restitution(d, 'top') },
  { id: 'ball.ceilingRestitution', unit: '', clips: ['C9'], scenario: 'ceilingBounce', fit: (d) => restitution(d, 'ceiling') },

  // C12 — hardest kick across the pitch: the fastest launch of each take.
  { id: 'ball.maxSpeed', unit: 'px/s', clips: ['C12'], scenario: 'kickMax',
    fit: (d) => { const ls = tagT(d, 'kick').map((t) => F.launch(ball(d), t)).filter(Boolean); if (!ls.length) return F.NONE;
      const b = ls.reduce((a, c) => (c.speed > a.speed ? c : a)); return { value: b.speed, sd: b.speedSd, n: 1 }; } },

  // C13 / M — the power gauge.
  { id: 'gauge.fillTime', unit: 's', clips: ['C13', 'M*'], scenario: 'gauge', timing: true, fit: firstFill },
  { id: 'gauge.refillTime', unit: 's', clips: ['C13', 'M*'], scenario: 'gauge', timing: true, fit: duration('power_press', 'gauge_full') },
  // The darkened spotlight when a power shot FIRES (on the touch after arming — pressing
  // POWER only arms it, so press → cut-in is however long the player took to reach the ball).
  { id: 'power.cutinTime', unit: 's', clips: ['C14', 'M*'], scenario: 'powerCutin', timing: true, fit: duration('cutin_on', 'cutin_off') },

  // C17 / M — goals and the reset after them.
  { id: 'goal.resetTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: duration('goal', 'ready_on') },
  { id: 'goal.toPlayTime', unit: 's', clips: ['C17', 'M*'], scenario: 'goalReset', timing: true, fit: duration('goal', 'ready_off') },

  // M — whole matches.
  { id: 'match.goals', unit: 'goals', clips: ['M*'], scenario: 'botMatch',
    fit: (d) => ({ value: d.tags.filter((t) => t.type === 'goal').length, sd: 0, n: 1 }) },
];

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
    if (per.length) {
      const c = F.combine(per);
      const fps = Math.min(...per.map((r) => r.fps));
      let tol = Math.max(2 * c.sd, 0.03 * Math.abs(c.value));
      if (m.timing) tol = Math.max(tol, 1 / fps);
      Object.assign(row, { value: round(c.value), n: c.n, sd: round(c.sd), tol: round(tol), clips, takes: per.length,
        status: provisional ? 'estimated' : 'measured' });
    } else if (est.has(m.id)) {
      const e = est.get(m.id);
      const tol = e.tol ?? Math.max(2 * (e.sd ?? 0), 0.03 * Math.abs(e.value), m.timing ? 1 / 60 : 0);
      Object.assign(row, { value: e.value, n: e.n ?? 1, sd: e.sd ?? null, tol: round(tol), clips: e.clips, status: 'estimated', source: e.source, ...(e.note ? { note: e.note } : {}) });
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
    scenario: e.scenario ?? null, status: 'estimated', source: e.source, ...(e.note ? { note: e.note } : {}),
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
