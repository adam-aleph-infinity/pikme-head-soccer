// THE TEAMS (shared/teams.js): who leads which, the Israel week, the fairness formula, the prizes, the
// device's own record, and a simulation proving that four equally keen teams of very different sizes
// each win about a quarter of the weeks. Run: node test-teams.mjs
import fs from 'node:fs';
import * as T from './shared/teams.js';
import * as MY from './shared/mythics.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// ── who ──
ok('four teams', T.TEAMS.length === 4 && T.TEAM_COUNT === 4);
ok('led by the four Mythics, in their order (Idan: שובל, אורי, נוה, פז)', T.TEAMS.map((t) => t.name).join() === 'שובל,אורי,נוה,פז' && T.TEAMS.every((t, i) => t.id === i + 1 && t.leader === i + 1));
ok('shown as "קבוצת X" (Idan)', T.TEAMS.every((t) => t.title === 'קבוצת ' + t.name));
ok('red, pink, yellow, green: the Mythic Gem colours', T.TEAMS.map((t) => t.color).join() === [1, 2, 3, 4].map((n) => MY.mythicGem(n).color).join());
ok('your team is your starter\'s', T.teamOf(3).name === 'נוה' && T.teamOf(null) === null && T.teamOf(7) === null);
ok('a team never reaches the match: the sim does not import it', !/teams\.js/.test(fs.readFileSync('shared/sim.js', 'utf8')));

// ── the week (October 2026 is UTC+3 until Sunday the 25th, then UTC+2) ──
const U = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);
let w = T.weekOf(U(2026, 10, 8, 12));
ok('a Thursday is in the week of its Sunday', w.id === '2026-10-04' && w.phase === 'play', JSON.stringify(w));
ok('the week starts on Sunday 00:00 in Israel', w.start === U(2026, 10, 3, 21));
ok('…and ends on Saturday 20:00 in Israel (Idan)', w.end === U(2026, 10, 10, 17));
ok('Saturday 19:59 still counts', T.weekOf(U(2026, 10, 10, 16, 59)).phase === 'play');
ok('Saturday 20:00 is the results break', T.weekOf(U(2026, 10, 10, 17)).phase === 'break' && T.weekOf(U(2026, 10, 10, 17)).id === '2026-10-04');
ok('Sunday 00:00 is a new week', T.weekOf(U(2026, 10, 10, 21)).id === '2026-10-11' && T.weekOf(U(2026, 10, 10, 21)).phase === 'play');
ok('Saturday 23:59 is still the old week\'s break', T.weekOf(U(2026, 10, 10, 20, 59)).id === '2026-10-04');
w = T.weekOf(U(2026, 10, 27, 12));
ok('the autumn clock change (Sunday 25 Oct): starts at 00:00 summer time, ends at 20:00 winter time', w.id === '2026-10-25' && w.start === U(2026, 10, 24, 21) && w.end === U(2026, 10, 31, 18), JSON.stringify(w));
w = T.weekOf(U(2027, 3, 24, 12));
ok('the spring clock change (Friday 26 Mar 2027): starts at 00:00 winter time, ends at 20:00 summer time', w.id === '2027-03-21' && w.start === U(2027, 3, 20, 22) && w.end === U(2027, 3, 27, 17), JSON.stringify(w));
ok('a week is 7 days to the next Sunday, whatever the clocks did', [U(2026, 10, 27, 12), U(2027, 3, 24, 12), U(2026, 12, 30, 12)].every((ms) => { const x = T.weekOf(ms); return T.weekOf(x.next).id === T.weekShift(x.id, 1); }));
ok('week ids step across months and years', T.weekShift('2026-12-27', 1) === '2027-01-03' && T.weekShift('2026-10-11', -1) === '2026-10-04');
ok('only a Sunday is a week id', T.isWeekId('2026-10-11') && !T.isWeekId('2026-10-12') && !T.isWeekId('soon'));
ok('the day is Israel\'s: 00:30 on Sunday is Sunday, though it is Saturday in London', T.dayOf(U(2026, 10, 10, 21, 30)) === '2026-10-11');

// ── the score ──
const P = (team, won, played = 5) => ({ team, won, played });
let s = T.standings([]);
ok('nobody played: no winner, everyone last', s.every((x) => x.rank === 4 && x.score === 0));
s = T.standings([P(1, 100), P(2, 200), P(3, 300), P(4, 50)]);
ok('the best average comes first', s.map((x) => x.team).join() === '3,2,1,4' && s.map((x) => x.rank).join() === '1,2,3,4', JSON.stringify(s));
s = T.standings([P(1, 100), P(1, 0, 2), P(1, 0, 0), P(2, 90)]);
ok('a player with fewer than 3 matches is not counted (never drags the team down)', s.find((x) => x.team === 1).active === 1 && s.find((x) => x.team === 1).members === 3 && s[0].team === 1);
s = T.standings([P(1, 900), P(2, 300)]);
ok('a player counts at most 300 (the cap): one star cannot carry a team', s[0].score === s[1].score && s[0].rank === 1 && s[1].rank === 1);
s = T.standings([P(1, 100), P(2, 100), P(3, 50), P(4, 20)]);
ok('a tie shares the place, and the next one is skipped', s.map((x) => x.rank).join() === '1,1,3,4', JSON.stringify(s));
s = T.standings([P(1, 10), P(2, 10), P(3, 10)]);
ok('a team where nobody played is last, even next to low scores', s[3].team === 4 && s[3].rank === 4 && s[3].score === 0);
s = T.standings([...Array(40)].map(() => P(1, 100)).concat([P(2, 300)]));
ok('one lucky player on a tiny team is pulled toward everyone\'s average', s.find((x) => x.team === 2).score < 300 && s.find((x) => x.team === 2).score > 100);

// ── the prizes ──
ok('1st: 2,000 points and the badge', JSON.stringify(T.prizeFor(1, true)) === '{"points":2000,"badge":true}');
ok('2nd: 1,000; 3rd and 4th: 500 for taking part', T.prizeFor(2, true).points === 1000 && T.prizeFor(3, true).points === 500 && T.prizeFor(4, true).points === 500 && !T.prizeFor(2, true).badge);
ok('a player who did not play wins nothing', T.prizeFor(1, false) === null);

// ── the device ──
const st = mem();
let rec = T.loadTeamRec(st);
ok('a fresh device: not welcomed, no badges, nothing claimed', !rec.welcomed && rec.badges === 0 && rec.claimed.length === 0 && !rec.switched);
ok('a save that will not parse is a fresh start', T.parseTeamRec('{nope').v === 1 && T.parseTeamRec({ v: 9 }).badges === 0);
let r = T.claimPrize(rec, '2026-10-04', { points: 2000, badge: true });
ok('a prize is paid…', r.paid?.points === 2000 && r.rec.badges === 1 && r.rec.claimed.includes('2026-10-04'));
r = T.claimPrize(r.rec, '2026-10-04', { points: 2000, badge: true });
ok('…once: the same week sent again pays nothing', r.paid === null && r.rec.badges === 1);
T.saveTeamRec(st, r.rec);
ok('the record survives a reload', T.loadTeamRec(st).badges === 1 && T.loadTeamRec(st).claimed[0] === '2026-10-04');
let many = rec;
for (let i = 0; i < 20; i++) many = T.claimPrize(many, T.weekShift('2026-01-04', i), { points: 500 }).rec;
ok('it keeps the last 12 weeks only', many.claimed.length === 12 && many.claimed[11] === T.weekShift('2026-01-04', 19));
let n = 0;
const id1 = T.deviceId(st, () => 'device-' + (++n) + '-abcdefghijkl');
ok('the device id is made once and kept', id1 === 'device-1-abcdefghijkl' && T.deviceId(st, () => 'other-abcdefghijklmn') === id1);
st.setItem(T.DEVICE_KEY, 'x');
ok('a broken device id is replaced', T.deviceId(st, () => 'fresh-abcdefghijklmnop') === 'fresh-abcdefghijklmnop');
ok('a real one is a UUID', T.isDeviceId(T.deviceId(mem())));

// ── switching ──
ok('the first switch is free; the next is not', T.canSwitchFree(false) && !T.canSwitchFree(true));
ok('a switch counts for the new team from next Sunday', T.switchCountsFrom(U(2026, 10, 8, 12)) === '2026-10-11' && T.switchCountsFrom(U(2026, 10, 10, 18)) === '2026-10-11');
const sm = mem();
MY.saveStarter(sm, 2);
ok('the starter is still chosen once…', MY.saveStarter(sm, 4) === 2);
ok('…and a team switch is the one way to change it, champion and all (Idan)', MY.switchStarter(sm, 4) === 4 && MY.loadStarter(sm) === 4 && MY.switchStarter(sm, 9) === 4);

// ── fairness, simulated (docs/TEAMS-ARENA.md) ──
// Every player is equally keen: 40% don't play that week, the rest play an exponential number of
// matches (8 on average) and win half, at 20–40 trophies a win.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pois = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
function week(sizes, keen = -1) {
  const rows = [];
  sizes.forEach((size, i) => {
    for (let k = 0; k < size; k++) {
      const lam = rnd() < 0.4 ? 0 : -Math.log(1 - rnd()) * 8 * (i === keen ? 1.2 : 1);
      const m = pois(lam);
      let won = 0;
      for (let j = 0; j < m; j++) if (rnd() < 0.5) won += 20 + Math.floor(rnd() * 21);
      rows.push({ team: i + 1, won, played: m });
    }
  });
  return rows;
}
const WEEKS = 2500;
function shares(sizes, keen) {
  const wins = [0, 0, 0, 0];
  for (let i = 0; i < WEEKS; i++) for (const x of T.standings(week(sizes, keen))) if (x.rank === 1) wins[x.team - 1]++;
  return wins.map((v) => (100 * v) / WEEKS);
}
const fmt = (a) => a.map((v) => v.toFixed(1) + '%').join(' ');
for (const [label, sizes] of [['400 players, 60/25/10/5%', [240, 100, 40, 20]], ['400 players, 40/25/20/15%', [160, 100, 80, 60]], ['60 players, 60/25/10/5%', [36, 15, 6, 3]], ['400 players, equal', [100, 100, 100, 100]]]) {
  const sh = shares(sizes);
  ok(`equally keen teams each win about a quarter of the weeks (${label}): ${fmt(sh)}`, sh.every((v) => v >= 19 && v <= 31), fmt(sh));
  if (process.argv.includes('-v')) console.log('  ', label.padEnd(26), fmt(sh));
}
const big = shares([240, 100, 40, 20], 0), small = shares([240, 100, 40, 20], 3);
ok(`a team that plays 20% more wins most weeks, big (${big[0].toFixed(0)}%) or small (${small[3].toFixed(0)}%)`, big[0] > 40 && small[3] > 33, fmt(big) + ' / ' + fmt(small));
if (process.argv.includes('-v')) console.log('   keen big team:', fmt(big), ' keen small team:', fmt(small));

console.log(`teams: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
