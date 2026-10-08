// THE LEAGUE (server/league.js + server/store.js) against a REAL server: arena matchmaking, a CPU when
// nobody comes, trophies paid from the server's own score, leaving loses, friend rooms pay nothing, the
// Trophy Road, the one free team switch (champion and all), the week decided and its prize paid once,
// and all of it still there after a restart. Run: node test-league.mjs   (~40 s)
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROTOCOL } from './shared/net.js';
import * as A from './shared/arena.js';
import * as T from './shared/teams.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const DATA = mkdtempSync(path.join(tmpdir(), 'league-'));
let srv, PORT;
function boot({ live = true } = {}) {
  srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: '0', DATA_DIR: DATA, DEV_TOOLS: '1', ARENA_LIVE: live ? '1' : '0', MATCH_SECONDS: '1', TEST_SCORE: '3:0', QUEUE_BOT_MS: '500', ARENA_VS_MS: '150' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start')), 10000);
    let out = '';
    srv.stdout.on('data', (c) => { out += c; const m = out.match(/local\s+http:\/\/localhost:(\d+)/); if (m) { PORT = Number(m[1]); clearTimeout(timer); resolve(); } });
    srv.once('exit', () => { clearTimeout(timer); reject(new Error('Test server exited')); });
  });
}
const die = (code) => { try { srv.kill(); } catch {} rmSync(DATA, { recursive: true, force: true }); process.exit(code); };
process.on('uncaughtException', (e) => { console.log('  ✗ threw:', e.stack); die(1); });

let n = 0;
const ID = () => `test-device-${String(++n).padStart(4, '0')}-abcdef`;
function client(starter, { id = ID(), name = 'kid' + n, card } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const c = { ws, id, starter, card: card || { rarity: 'mythic', number: starter }, got: {}, all: [], prizes: [] };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (!m.type) return;
    c.got[m.type] = m; c.all.push(m);
    if (m.type === 'prize') c.prizes.push(m);
  };
  c.send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  c.hello = () => c.send({ type: 'hello', name, card: c.card, v: PROTOCOL, id: c.id, starter: c.starter });
  c.open = new Promise((r) => { ws.onopen = r; }).then(() => c.hello());
  c.wait = (type, f = () => true, ms = 9000) => until(() => c.all.some((m) => m.type === type && f(m)), ms);
  c.clear = () => { c.all.length = 0; c.got = {}; };
  return c;
}
const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); } return false; };
const last = (c, type) => [...c.all].reverse().find((m) => m.type === type);

await boot();

// ── who you are ──
const a = client(1), b = client(2);
await Promise.all([a.open, b.open]);
a.send({ type: 'dev', op: 'toPlay' });              // run on a Saturday night: into next week's play first
await sleep(200);
ok('hello → your profile: 0 trophies, arena 1, your starter\'s team', await a.wait('profile') && a.got.profile.trophies === 0 && a.got.profile.arena === 1 && a.got.profile.team === 1 && a.got.profile.starter === 1, JSON.stringify(a.got.profile));
ok('…with this week\'s standings and the time it ends', T.isWeekId(a.got.profile.week.id) && a.got.profile.week.standings.length === 4 && a.got.profile.week.end > Date.now());

// ── two players, matched ──
a.clear(); b.clear();
a.send({ type: 'queue' }); await sleep(60); b.send({ type: 'queue' });
ok('two players searching are matched', await a.wait('found') && await b.wait('found'));
ok('…the VS card: the other\'s nickname, team and trophies', a.got.found.opp.name === 'kid2' && a.got.found.opp.team === 2 && b.got.found.opp.team === 1 && a.got.found.opp.trophies === 0, JSON.stringify(a.got.found));
ok('…in the arena of the better one, on its stadium', a.got.found.arena === 1 && a.got.found.stage === 'hs-day');
ok('…then the match, which says it is an arena match', await a.wait('start') && a.got.start.arena?.stage === 'hs-day');
ok('the end: the server pays from its own score', await a.wait('arenaResult') && await b.wait('arenaResult'));
const ra = a.got.arenaResult, rb = b.got.arenaResult;
const [win, lose, wc, lc] = ra.result === 'win' ? [ra, rb, a, b] : [rb, ra, b, a];
ok('…the winner takes 30 (equal trophies)', win.result === 'win' && win.delta === 30 && win.trophies === 30, JSON.stringify(win));
ok('…the loser at 0 loses nothing (the floor)', lose.result === 'loss' && lose.delta === 0 && lose.trophies === 0, JSON.stringify(lose));
ok('…the first win of the day pays the daily bonus', win.bonus === A.DAILY[0] && win.dailyWins === 1 && lose.bonus === 0);
ok('…and counts for the team\'s week', win.counted === 30);
await wc.wait('profile', (p) => p.trophies === 30);
const wp = last(wc, 'profile');
ok('the new profile: 30 trophies, best 30, a week of 1 match and 1 win', wp.trophies === 30 && wp.best === 30 && wp.week.me.played === 1 && wp.week.me.wins === 1 && wp.week.me.counted === 30, JSON.stringify(wp.week.me));
ok('…ranked first of the two who played', wp.rank === 1 && wp.total === 2);
ok('…and the team\'s standings moved', wp.week.standings.find((s) => s.team === wp.team).members === 1);

// ── nobody comes: a CPU with a player's name ──
const c = client(3);
await c.open; c.clear();
c.send({ type: 'queue' });
ok('alone: a CPU after the wait', await c.wait('found', () => true, 4000) && A.BOT_NAMES.includes(c.got.found.opp.name), JSON.stringify(c.got.found));
ok('…dressed as a Mythic of a team, near your trophies', c.got.found.opp.card.rarity === 'mythic' && T.isTeam(c.got.found.opp.team) && Math.abs(c.got.found.opp.trophies) <= 30);
ok('…and it plays the match out', await c.wait('arenaResult') && c.got.arenaResult.result === 'win' && c.got.arenaResult.delta >= 20);

// ── leaving loses ──
const d = client(4), e = client(1);
await Promise.all([d.open, e.open]);
d.send({ type: 'queue' }); await sleep(30); e.send({ type: 'queue' });
await d.wait('start'); await e.wait('start');
await sleep(400);
d.send({ type: 'leave' });
ok('a player who leaves mid-match loses it', await d.wait('arenaResult') && d.got.arenaResult.result === 'loss' && d.got.arenaResult.forfeit === true);
ok('…and the other wins at once', await e.wait('arenaResult') && e.got.arenaResult.result === 'win' && e.got.arenaResult.forfeit === true && e.got.arenaResult.delta === 30);

// ── leaving during the VS card is no match ──
const f = client(2), g = client(3);
await Promise.all([f.open, g.open]);
f.send({ type: 'queue' }); await sleep(30); g.send({ type: 'queue' });
await f.wait('found'); f.send({ type: 'leave' });
ok('leaving during the VS card: the other is told, and searches again', await g.wait('oppLeft') && await g.wait('found', (m) => A.BOT_NAMES.includes(m.opp.name), 4000));
await sleep(300);
ok('…the one who left lost nothing (no match was played)', !f.all.some((m) => m.type === 'arenaResult'));
await g.wait('arenaResult');

// ── a friend's room pays no trophies ──
const h = client(1), i = client(2);
await Promise.all([h.open, i.open]);
h.send({ type: 'create' });
await h.wait('room');
i.send({ type: 'join', code: h.got.room.code });
await i.wait('room', (r) => r.members.length === 2);
h.send({ type: 'ready', v: true }); i.send({ type: 'ready', v: true });
ok('friend room: the match runs', await h.wait('over', () => true, 12000));
await sleep(300);
h.clear(); h.send({ type: 'profile' }); await h.wait('profile');
ok('…and pays no trophies', h.got.profile.trophies === 0 && !h.all.some((m) => m.type === 'arenaResult'));

// ── the Trophy Road ──
wc.clear(); wc.send({ type: 'road', i: 1 }); await wc.wait('road');
ok('the road: node 1 (100) is not yours at 30', wc.got.road.ok === false);
wc.send({ type: 'dev', op: 'trophies' }); await wc.wait('profile', (p) => p.trophies === 130);
wc.clear(); wc.send({ type: 'road', i: 1 }); await wc.wait('road');
ok('…at 130 it is, and pays', wc.got.road.ok === true && wc.got.road.prize.points === A.roadPrize(1).points);
wc.clear(); wc.send({ type: 'road', i: 1 }); await wc.wait('road');
ok('…once', wc.got.road.ok === false);
wc.clear(); wc.send({ type: 'road', i: 3 }); await wc.wait('road');
ok('…and in order', wc.got.road.ok === false);

// ── the one free switch: the team and the champion ──
wc.clear(); wc.send({ type: 'profile' }); await wc.wait('profile');
const team0 = last(wc, 'profile').team;
const to = team0 === 4 ? 3 : 4;
wc.clear(); wc.send({ type: 'switchTeam', team: to }); await wc.wait('switched');
ok('the free switch: allowed, and the champion goes with it', wc.got.switched.ok === true && wc.got.switched.starter === to);
await wc.wait('profile');
ok('…your team now, but this week still counts for the old one', last(wc, 'profile').team === to && last(wc, 'profile').week.me.team === team0, JSON.stringify(last(wc, 'profile').week.me));
wc.clear(); wc.send({ type: 'switchTeam', team: team0 }); await wc.wait('switched');
ok('…and only once', wc.got.switched.ok === false && wc.got.switched.err === 'used');
wc.clear(); wc.card = { rarity: 'mythic', number: team0 }; wc.hello(); await wc.wait('profile');
wc.send({ type: 'queue', card: { rarity: 'mythic', number: team0 } });
await wc.wait('start', () => true, 6000);
const seat = wc.got.found.you;
ok('the arena plays only your own Mythic: a link to the old one is ignored', wc.got.start.chars[seat].rarity === 'mythic' && wc.got.start.chars[seat].number === to, JSON.stringify(wc.got.start.chars));
await wc.wait('arenaResult');

// ── the week: three matches make you active; the end pays your team's place once ──
for (let k = 0; k < 2; k++) { c.clear(); c.send({ type: 'queue' }); await c.wait('arenaResult', () => true, 12000); }
c.clear(); c.send({ type: 'profile' }); await c.wait('profile');
ok('three arena matches: active this week', c.got.profile.week.me.played === 3 && c.got.profile.week.me.wins === 3, JSON.stringify(c.got.profile.week.me));
const weekId = c.got.profile.week.id;
c.clear(); a.clear();
c.send({ type: 'dev', op: 'endWeek' });
ok('the week ends (dev): every player connected hears how it went', await c.wait('prize') && await a.wait('prize'));
const pc = c.got.prize;
ok('…your team\'s place, decided by the formula', pc.week === weekId && pc.myTeam === 3 && pc.rank === 1 && pc.winner === 3, JSON.stringify(pc));
ok('…an active player of the winners: 2,000 and the badge', pc.active === true && pc.prize?.points === 2000 && pc.prize.badge === true);
ok('…a player who played less than 3: told, not paid', a.got.prize.active === false && a.got.prize.prize === null);
c.send({ type: 'ack', week: weekId });
await sleep(300);
const c2 = client(3, { id: c.id });
await c2.open; await c2.wait('profile'); await sleep(400);
ok('…and once: the same player back again hears nothing more', c2.prizes.length === 0);
const a2 = client(1, { id: a.id });
await a2.open; await a2.wait('profile'); await sleep(400);
ok('…while one who never said "seen" is told again', a2.prizes.length === 1);
ok('in the results break the profile says so', last(c2, 'profile').week.phase === 'break');

// ── a restart keeps everything ──
const keep = { id: wc.id, trophies: last(wc, 'profile').trophies, team: last(wc, 'profile').team };
srv.kill(); await sleep(300);
await boot();
const back = client(to, { id: keep.id });
await back.open;
ok('after a restart: the same trophies, the same team, the switch still used', await back.wait('profile') && back.got.profile.trophies === keep.trophies && back.got.profile.team === keep.team && back.got.profile.switched === true, JSON.stringify(back.got.profile));
const noid = client(1, { id: 'x' });
await noid.open; await sleep(300);
ok('a client without a proper id is no league player', !noid.got.profile);
noid.send({ type: 'queue' }); await noid.wait('error');
ok('…and cannot queue', noid.got.error.code === 'no-id');

// ── NOT LIVE (the default until the arenas are done, Idan): nobody gets a trophy ──
srv.kill(); await sleep(300);
await boot({ live: false });
const off = client(2);
await off.open; await off.wait('profile');
ok('not live: the profile says so, and has no week', off.got.profile.live === false && off.got.profile.week === null);
const t0 = off.got.profile.trophies;
off.send({ type: 'queue' });
ok('…the arena still plays: practice, said so on the VS card', await off.wait('found') && off.got.found.practice === true);
ok('…a practice result: no trophies, no bonus, nothing for the team', await off.wait('arenaResult') && off.got.arenaResult.practice === true && off.got.arenaResult.delta === 0 && off.got.arenaResult.bonus === 0 && off.got.arenaResult.trophies === t0);
await off.wait('profile', (p) => p.trophies === t0);
ok('…and the profile is unchanged', last(off, 'profile').trophies === t0 && last(off, 'profile').daily.wins === 0);
off.send({ type: 'dev', op: 'trophies' }); await off.wait('profile', (p) => p.trophies === 100);
off.clear(); off.send({ type: 'road', i: 1 }); await off.wait('road');
ok('…and the road pays nothing', off.got.road.ok === false);
off.clear(); off.send({ type: 'dev', op: 'endWeek' }); await sleep(600);
ok('…and no week is decided or paid', !off.all.some((m) => m.type === 'prize'));

console.log(`league: ${pass} passed, ${fail} failed`);
die(fail ? 1 : 0);
