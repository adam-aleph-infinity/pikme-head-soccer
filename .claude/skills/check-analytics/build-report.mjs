// Builds the dashboard's report file from the game server's play stats, so no number is copied by hand.
//   node build-report.mjs <history.json> <out.json> [--extra extra.json] [--now "14:10"] [--since-time "18:53"] [--range "Last 7 days"]
// history.json  what GET /stats/history returned
// extra.json    rows to add or replace by key: the three findings (f1–f3), PostHog's rows, health-events …
// --now         the Israel time the numbers run to (today is partial until midnight)
// --since-time  when counting started on its first day (a deploy restarts it): that day is partial too
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const h = JSON.parse(readFileSync(args[0], 'utf8'));
const extra = opt('--extra') ? JSON.parse(readFileSync(opt('--extra'), 'utf8')) : [];
const nowTime = opt('--now'), sinceTime = opt('--since-time');

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const ofPct = (a, b) => `${fmt(a)} of ${fmt(b)}${b ? ` (${pct(a, b)})` : ''}`;
const dur = (mins) => { const s = Math.round(mins * 60), hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return hh ? `${hh}h ${m}m` : m ? `${m}m ${r}s` : `${r}s`; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
const MODE_NAME = { arena: 'Arena', tournament: 'Tournament', arcade: 'Arcade', tutorial: 'Tutorial', practice: 'Practice', online: 'Friend room' };
const STEP_NAME = { opened: 'Opened the game', starter: 'Picked a champion', tut_start: 'Started the tutorial match', tut_done: 'Finished the tutorial match', first_match: 'Played a first real match', first_finish: 'Finished it' };

const a = h.allTime, days = [...h.days].reverse();             // oldest first
const today = h.days[0], yesterday = h.days[1];
const since = a.since, label = (d) => dayLabel(d) + (d === since && sinceTime ? ` (from ${sinceTime})` : d === today?.day && nowTime ? ` (to ${nowTime})` : '');
const rows = [];
const row = (section, key, fields) => rows.push({ section, key, ...fields });

row('meta', 'meta', {
  range: opt('--range', 'Last 7 days'), generated: `${dayLabel(today.day)}, ${today.day.slice(0, 4)}${nowTime ? `, ${nowTime}` : ''} Israel time`, data_kind: 'real',
  ps_since: `${dayLabel(since)}, ${since.slice(0, 4)}${sinceTime ? `, ${sinceTime}` : ''}`,
  status: `Live: ${fmt(a.players)} players counted by the game server since ${dayLabel(since)}${sinceTime ? ` ${sinceTime}` : ''}.`,
  ph_note: "From PostHog, only for players whose parents allowed analytics in the Saltiz app. The app hasn't switched it on yet.",
});
row('kpi', 'kpi-players', { label: 'Players', value: a.players, display: fmt(a.players) });
row('kpi', 'kpi-new', { label: 'New players', value: a.newPlayers, display: fmt(a.newPlayers) });
row('kpi', 'kpi-sessions', { label: 'Game opens', value: a.opens, display: fmt(a.opens) });
row('kpi', 'kpi-avg', { label: 'Avg time per player', value: Math.round((a.minutesPlayed * 60) / (a.players || 1)), display: dur(a.minutesPlayed / (a.players || 1)) });
row('kpi', 'kpi-total', { label: 'Total play time', value: a.minutesPlayed * 60, display: dur(a.minutesPlayed) });
row('kpi', 'kpi-matches', { label: 'Matches', value: a.matches, display: fmt(a.matches) });
row('kpi', 'kpi-peak', { label: 'Most online at once', value: a.peakOnline || 0, display: a.peakOnline ? fmt(a.peakOnline) : 'Not counted yet' });

for (const d of days) row('psday', `day-${d.day}`, { day: label(d.day), players: d.players, new_players: d.newPlayers, opens: d.opens, minutes: d.minutesPlayed, matches: d.matches });

const order = Object.entries(a.modes).sort((x, y) => y[1].started - x[1].started);
for (const [m, v] of order) {
  const closed = Math.max(0, v.started - v.finished - v.quit - v.dropped);
  row('psmode', `ps-${m}`, { mode: MODE_NAME[m] || m, entered: v.entered, started: v.started, finished: v.finished, quit: v.quit, dropped: v.dropped, closed_app: closed, finish_rate: v.started ? pct(v.finished, v.started) : '—', minutes: v.minutes });
}

// by hour: today against yesterday, up to the last hour with anything today
if (today?.hours?.length) {
  const y = Object.fromEntries((yesterday?.hours || []).map((x) => [x.hour, x]));
  const t = Object.fromEntries(today.hours.map((x) => [x.hour, x]));
  const last = Math.max(...today.hours.map((x) => +x.hour));
  for (let i = 0; i <= last; i++) {
    const hh = String(i).padStart(2, '0');
    if (!t[hh] && !y[hh]) continue;
    row('pshour', `hour-${hh}`, { hour: `${hh}:00`, today: t[hh]?.players || 0, yesterday: y[hh]?.players || 0, peak: t[hh]?.peakOnline || 0 });
  }
}

// the new player's journey: over the days it has been counted (the days that started first days)
const cohortNew = (h.retention || []).reduce((s, r) => s + r.newPlayers, 0);
if (cohortNew) {
  const sum = (k) => h.days.reduce((s, d) => s + (d.newPlayerSteps?.[k] || 0), 0);
  row('journey', 'step-opened', { step: STEP_NAME.opened, players: cohortNew, share: '100%' });
  for (const k of ['starter', 'tut_start', 'tut_done', 'first_match', 'first_finish']) row('journey', `step-${k}`, { step: STEP_NAME[k], players: sum(k), share: pct(sum(k), cohortNew) });
}
for (const r of h.retention || []) {
  const cell = (n) => (r[n] == null ? '—' : `${fmt(r[n])} (${pct(r[n], r.newPlayers)})`);
  row('cohort', `cohort-${r.day}`, { day: label(r.day), new_players: r.newPlayers, d1: cell('day1'), d7: cell('day7'), d30: cell('day30') });
}

const fr = a.friendRooms || {};
if (fr.created || fr.joined || Object.keys(fr.failed || {}).length) {
  row('rooms', 'room-created', { label: 'Rooms made', display: fmt(fr.created) });
  row('rooms', 'room-joined', { label: 'A friend joined', display: fmt(fr.joined) });
  row('rooms', 'room-matches', { label: 'Matches started', display: fmt(fr.matches) });
  const FAIL = { 'not-found': 'Join failed: no room with that code', full: 'Join failed: room full', 'in-match': 'Join failed: match already on', 'no-codes': 'Make failed: no free codes', stale: 'Refused: an old cached version of the game', other: 'Failed: other' };
  for (const [k, n] of Object.entries(fr.failed || {})) row('rooms', `room-fail-${k}`, { label: FAIL[k] || k, display: fmt(n) });
}

// signals of why players stop (the server's counts; PostHog adds per-player ones)
const on = a.modes.online;
if (on?.entered) row('why', 'why-friend', { label: 'Opened a friend room but never played a match', display: on.started ? ofPct(on.entered - on.started, on.entered) : `${fmt(on.entered)} of ${fmt(on.entered)}` });
if (a.modes.tournament?.started) row('why', 'why-tour-quits', { label: 'Tournament matches given up', display: ofPct(a.modes.tournament.quit, a.modes.tournament.started) });
for (const [m, v] of order) {
  if (m === 'online' || v.started < 10) continue;
  const closed = Math.max(0, v.started - v.finished - v.quit - v.dropped);
  row('why', `why-closed-${m}`, { label: `${MODE_NAME[m]} matches left by closing the app`, display: ofPct(closed, v.started) });
}
if (a.errors?.pages) row('why', 'why-errors', { label: 'Game visits that hit an error', display: `${ofPct(a.errors.pages, a.opens)}, ${fmt(a.errors.inMatch)} mid-match` });
row('why', 'why-detail', { label: 'Losing when they quit, quitting early, loss streaks', display: 'Needs PostHog' });

const ar = a.modes.arena;
if (ar) {
  row('arena', 'arena-matches', { label: 'Arena matches (all players)', display: fmt(ar.started) });
  row('arena', 'arena-finished', { label: 'Finished', display: `${fmt(ar.finished)} (${pct(ar.finished, ar.started)})` });
  row('arena', 'arena-minutes', { label: 'Minutes in the arena', display: fmt(ar.minutes) });
  row('arena', 'arena-trophies', { label: 'Trophies won / lost', display: 'Not live yet' });
  row('arena', 'arena-wait', { label: 'Matchmaking waits, vs CPU share', display: 'Needs PostHog' });
}

if (today && yesterday) row('retention', 'ret-next', { label: `${dayLabel(yesterday.day)}'s players back on ${dayLabel(today.day)}`, display: today.alsoPlayedDayBefore ? ofPct(today.alsoPlayedDayBefore, yesterday.players) : 'Counted from the next update' });
row('retention', 'ret-new', { label: 'New players', display: `${fmt(a.newPlayers)} of ${fmt(a.players)}` });

row('platform', 'platform-app', { platform: 'Saltiz app', version: 'live', sessions: a.opens, players: a.players });

row('health', 'health-events', { label: 'PostHog events this month', value: 0, display: '—' });
row('health', 'health-server', { label: 'Server counts kept since', display: `${dayLabel(since)}${sinceTime ? ` ${sinceTime}` : ''} (a deploy resets them)` });
if (a.errors) row('health', 'health-errors', { label: 'Game visits with an error', display: a.errors.pages ? ofPct(a.errors.pages, a.opens) : 'None' });

// the findings and PostHog's part, by key: a row in extra replaces the same key here, or is added
const byKey = new Map(rows.map((r) => [r.key, r]));
for (const r of extra) byKey.set(r.key, { ...(byKey.get(r.key) || {}), ...r });
writeFileSync(args[1], JSON.stringify([...byKey.values()], null, 0));
console.log(`wrote ${byKey.size} rows`);
