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

// ── 2026-10-14: hours, peak online, retention, the new player's journey, friends' rooms, crashes ──
{
  const P = await import('./shared/play-stats.js');
  const t = Date.parse('2026-10-14T11:10:00Z');                       // 14:10 in Israel
  ok('hour: Israel time', P.hourOf(t) === '14' && P.hourOf(Date.parse('2026-10-14T21:30:00Z')) === '00');
  const fresh = P.openFlags(null, t, { fresh: true });
  ok('a fresh device starts a first day (cohort) with a journey', fresh.flags.cohort && fresh.seen.first === '2026-10-14' && fresh.seen.steps === '');
  ok('an old player keeps no first day', !P.openFlags(null, t).seen.first && !P.openFlags(null, t).flags.cohort);
  ok('same hour again: no hour flag', !P.openFlags(fresh.seen, t + 600e3).flags.hour && P.openFlags(fresh.seen, t + 3600e3).flags.hour);
  const next = P.openFlags(fresh.seen, t + 86400e3);
  ok('next day: back (played yesterday) and day-1 retention', next.flags.back && next.flags.ret === 1 && next.seen.first === '2026-10-14', next.flags);
  const week = P.openFlags({ ...fresh.seen, day: '2026-10-19' }, Date.parse('2026-10-21T11:00:00Z'));
  ok('a week later: day-7 retention, not back', week.flags.ret === 7 && !week.flags.back, week.flags);
  ok('day 4 is not a retention day', P.openFlags(fresh.seen, t + 4 * 86400e3).flags.ret === undefined);
  ok('a second open the same day reports no retention', P.openFlags(next.seen, t + 86400e3 + 60e3).flags.ret === undefined);
  // the journey
  let s = fresh.seen;
  ok('journey: starter is due', P.stepDue(s, 'starter'));
  s = P.stepDone(s, 'starter');
  ok('journey: each step once', !P.stepDue(s, 'starter') && P.stepDue(s, 'tut_start'));
  ok('journey: no first day, no journey', !P.stepDue({ day: '2026-10-14' }, 'starter'));
  ok('journey: an unknown step is never due', !P.stepDue(fresh.seen, 'hacked'));
  // the counters
  const oc = P.countersFor({ k: 'open', day: true, hour: true, back: true, cohort: true, ret: 7 });
  ok('open counts hour players, back, cohort, ret_7', oc.hour_players === 1 && oc.back === 1 && oc.cohort === 1 && oc.ret_7 === 1, oc);
  ok('ret must be a retention day', !Object.keys(P.countersFor({ k: 'open', day: true, ret: 5 })).some((k) => k.startsWith('ret_')));
  ok('step counts a known step only', P.countersFor({ k: 'step', s: 'tut_done' })['step:tut_done'] === 1 && P.countersFor({ k: 'step', s: 'x' }) === null);
  ok('err: a page, and in a match', P.countersFor({ k: 'err', m: true }).err_in_match === 1 && !('err_in_match' in P.countersFor({ k: 'err' })));
  const h = P.hourly(P.countBatch({ ev: [{ k: 'open', day: true, hour: true, fresh: true }, { k: 'start', mode: 'arena' }, { k: 'start', mode: 'arcade' }, { k: 'time', s: 120 }] }), '14');
  ok('the hour mirrors players, opens, new, minutes, matches', h['h:14:players'] === 1 && h['h:14:open'] === 1 && h['h:14:new'] === 1 && h['h:14:secs'] === 120 && h['h:14:matches'] === 2, h);
  // the report
  const rep = P.summarize([
    { day: '2026-10-13', key: 'cohort', n: 10 }, { day: '2026-10-13', key: 'fresh', n: 10 }, { day: '2026-10-13', key: 'peak', n: 9 },
    { day: '2026-10-14', key: 'ret_1', n: 3 }, { day: '2026-10-14', key: 'back', n: 4 }, { day: '2026-10-14', key: 'peak', n: 12 },
    { day: '2026-10-14', key: 'h:14:players', n: 5 }, { day: '2026-10-14', key: 'h:14:peak', n: 12 }, { day: '2026-10-14', key: 'step:tut_done', n: 6 },
    { day: '2026-10-14', key: 'room:create', n: 4 }, { day: '2026-10-14', key: 'room:fail:not-found', n: 2 }, { day: '2026-10-14', key: 'err_pages', n: 1 },
  ]);
  const d14 = rep.days[0];
  ok('report: peak online per day, max over the week (not summed)', d14.peakOnline === 12 && rep.weeks[0].peakOnline === 12 && rep.allTime.peakOnline === 12, rep.weeks[0].peakOnline);
  ok('report: hours', d14.hours.length === 1 && d14.hours[0].hour === '14' && d14.hours[0].players === 5 && d14.hours[0].peakOnline === 12, d14.hours);
  ok('report: no hours in weeks', !('hours' in rep.weeks[0]));
  ok('report: retention by first day', rep.retention[0].day === '2026-10-13' && rep.retention[0].newPlayers === 10 && rep.retention[0].day1 === 3 && rep.retention[0].day7 === null, rep.retention);
  ok('report: the journey, rooms and errors', d14.newPlayerSteps.tut_done === 6 && d14.friendRooms.created === 4 && d14.friendRooms.failed['not-found'] === 2 && d14.errors.pages === 1 && d14.alsoPlayedDayBefore === 4);
  // the server's own counters: peak online and rooms
  const { DatabaseSync } = await import('node:sqlite');
  const { createPlayStats } = await import('./server/play-stats.js');
  const ps = createPlayStats(new DatabaseSync(':memory:'), { now: () => t });
  ps.online(5); ps.online(9); ps.online(3);
  ps.room('create'); ps.room('join'); ps.room('fail', 'full'); ps.room('fail', 'weird'); ps.room('nonsense');
  ps.add({ ev: [{ k: 'open', day: true, hour: true }] });
  const sv = ps.history().days[0];
  ok('server: peak online keeps the highest', sv.peakOnline === 9 && sv.hours.find((x) => x.hour === '14').peakOnline === 9, sv.peakOnline);
  ok('server: rooms counted, unknown failures as other', sv.friendRooms.created === 1 && sv.friendRooms.joined === 1 && sv.friendRooms.failed.full === 1 && sv.friendRooms.failed.other === 1, sv.friendRooms);
  ok('server: a batch also lands in its hour', sv.hours.find((x) => x.hour === '14').players === 1);
}

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
  // a real socket: the peak online, a friend's room made, and a stale page turned away (counted as such)
  const { PROTOCOL } = await import('./shared/net.js');
  const sock = (v) => new Promise((resolve) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'hello', name: 'x', v })); ws.send(JSON.stringify({ type: 'create' })); setTimeout(() => resolve(ws), 400); };
  });
  const s1 = await sock(PROTOCOL), s2 = await sock(PROTOCOL - 1);
  const h2 = (await (await fetch(base + '/stats/history')).json()).days[0];
  ok('history: peak online seen by the server', h2.peakOnline >= 2, h2.peakOnline);
  ok('history: a room made, a stale page counted as a failure', h2.friendRooms.created === 1 && h2.friendRooms.failed.stale === 1, h2.friendRooms);
  s1.close(); s2.close();
} finally { srv.kill(); }

console.log(`play stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
