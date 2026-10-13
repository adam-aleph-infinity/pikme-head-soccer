// PLAY STATS (docs/PLAY-STATS.md): the flags a device sends, the counters the server adds, the report,
// and the real server end to end. Run: node test-play-stats.mjs
import { spawn } from 'node:child_process';
import { openFlags, weekOf, dayOf, countersFor, countBatch, summarize } from './shared/play-stats.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + JSON.stringify(extra) : ''}`); }
};

// ISO weeks, Israel days
ok('week: mid-October', weekOf('2026-10-13') === '2026-W42', weekOf('2026-10-13'));
ok('week: Jan 1 2027 is still 2026-W53', weekOf('2027-01-01') === '2026-W53', weekOf('2027-01-01'));
ok('week: Monday starts it', weekOf('2026-10-12') === '2026-W42' && weekOf('2026-10-11') === '2026-W41');
ok('day: 22:30 UTC is already tomorrow in Israel', dayOf(Date.parse('2026-10-13T22:30:00Z')) === '2026-10-14');

// the device's flags
const t0 = Date.parse('2026-10-13T09:00:00Z');
const a = openFlags(null, t0);
ok('first ever open: every flag', a.flags.new && a.flags.day && a.flags.week && a.flags.month);
const b = openFlags(a.seen, t0 + 3600e3);
ok('same day again: no flag', !b.flags.new && !b.flags.day && !b.flags.week && !b.flags.month, b.flags);
const c = openFlags(a.seen, t0 + 86400e3);
ok('next day, same week: only day', c.flags.day && !c.flags.week && !c.flags.month && !c.flags.new, c.flags);
const d = openFlags(a.seen, Date.parse('2026-11-02T09:00:00Z'));
ok('next month: day + week + month', d.flags.day && d.flags.week && d.flags.month && !d.flags.new);

// what the server counts
ok('open counts players only with the day flag', JSON.stringify(countersFor({ k: 'open', day: true, app: true, new: true, fresh: false }))
  === JSON.stringify({ open: 1, players: 1, players_app: 1, new: 1 }));
ok('an unknown mode counts nothing', countersFor({ k: 'start', mode: 'hacked' }) === null);
ok('an unknown kind counts nothing', countersFor({ k: 'name', v: 'dan' }) === null);
ok('end adds seconds, clamped to 4h', countersFor({ k: 'end', mode: 'arcade', s: 1e9 })['secs:arcade'] === 14400);
ok('a string is not true', !countersFor({ k: 'open', day: 'true' }).players);
ok('no extra field survives', Object.keys(countersFor({ k: 'end', mode: 'online', s: 60, name: 'x', score: [3, 1] })).join() === 'end:online,secs:online');
const batch = countBatch({ ev: [{ k: 'start', mode: 'arcade' }, { k: 'start', mode: 'arcade' }, { k: 'end', mode: 'arcade', s: 70 }, { k: 'bogus' }] });
ok('a batch sums, skipping the bad event', batch['start:arcade'] === 2 && batch['end:arcade'] === 1 && batch['secs:arcade'] === 70, batch);
ok('a non-batch is refused', countBatch({ ev: 'x' }) === null && countBatch(null) === null);
ok('a batch is capped at 50 events', countBatch({ ev: Array(80).fill({ k: 'enter', mode: 'arena' }) })['enter:arena'] === 50);

// the report
const rows = [
  { day: '2026-10-12', key: 'players', n: 5 }, { day: '2026-10-12', key: 'week_players', n: 5 }, { day: '2026-10-12', key: 'new', n: 5 },
  { day: '2026-10-13', key: 'players', n: 4 }, { day: '2026-10-13', key: 'week_players', n: 2 }, { day: '2026-10-13', key: 'new', n: 1 },
  { day: '2026-10-13', key: 'start:arcade', n: 9 }, { day: '2026-10-13', key: 'start:online', n: 3 }, { day: '2026-10-13', key: 'secs:arcade', n: 600 },
];
const r = summarize(rows);
ok('report: newest day first', r.days[0].day === '2026-10-13' && r.days[0].players === 4);
ok('report: a week sums its week flags, not its daily players', r.weeks[0].week === '2026-W42' && r.weeks[0].players === 7, r.weeks[0]);
ok('report: all-time players = devices ever counted', r.allTime.players === 6 && r.allTime.since === '2026-10-12', r.allTime);
ok('report: matches by mode', r.days[0].matches === 12 && r.days[0].modes.arcade.minutes === 10);

// the real server
// PORT=0: the OS picks a free port (a fixed one can land on another agent's server); the log names it
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0', DATA_DIR: ':memory:' }, stdio: 'pipe' });
const base = await new Promise((resolve, reject) => {
  let out = '';
  srv.stdout.on('data', (b) => { out += b; const m = out.match(/localhost:(\d+)/); if (m) resolve(`http://127.0.0.1:${m[1]}`); });
  srv.on('exit', (code) => reject(new Error(`server exited ${code}`)));
});
try {
  const post = (ev) => fetch(base + '/play', { method: 'POST', body: JSON.stringify({ ev }), headers: { 'content-type': 'text/plain' } });
  const p1 = await post([{ k: 'open', day: true, new: true, fresh: true, week: true, month: true, app: true }, { k: 'enter', mode: 'arcade' }, { k: 'start', mode: 'arcade' }, { k: 'end', mode: 'arcade', s: 65 }]);
  ok('POST /play → 204', p1.status === 204, p1.status);
  await post([{ k: 'open', day: false }, { k: 'start', mode: 'online' }, { k: 'quit', mode: 'online', s: 20 }, { k: 'time', s: 300 }]);
  const junk = await fetch(base + '/play', { method: 'POST', body: 'not json' });
  ok('junk → still 204', junk.status === 204);
  const h = await (await fetch(base + '/stats/history')).json();
  const today = h.days[0];
  ok('history: today has 1 player, 2 opens', today?.players === 1 && today.opens === 2, today);
  ok('history: arcade finished, online quit', today.modes.arcade.finished === 1 && today.modes.online.quit === 1, today.modes);
  ok('history: minutes played', today.minutesPlayed === 5, today.minutesPlayed);
  ok('history: one new player, one in the app', today.newPlayers === 1 && today.inAppPlayers === 1);
  const stats = await (await fetch(base + '/stats')).json();
  ok('/stats still answers', typeof stats.online === 'number');
} finally { srv.kill(); }

console.log(`play stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
