// The tournament's rules, in node. Run: node test-tournament.mjs
import * as T from './shared/tournament.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); } };
// a seeded die, so every run plays the same tournaments
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const store = () => { const d = new Map(); return { d, getItem: (k) => d.get(k) ?? null, setItem: (k, v) => d.set(k, String(v)), removeItem: (k) => d.delete(k) }; };
const ME = { rarity: 'legendary', number: 3 };

// ── the draw ──
for (let seed = 1; seed <= 200; seed++) {
  const t = T.createTournament(ME, seeded(seed));
  const st = t.entrants.filter((e) => !e.you).map((e) => e.stage);
  if (st.length !== 7 || new Set(st).size !== 7) { ok(`seed ${seed}: seven different champions`, false, st.join()); break; }
  if (st.includes(3)) { ok(`seed ${seed}: your own champion is not drawn against you`, false); break; }
  if (!(t.entrants[7].stage <= 15 && t.entrants[4].stage >= 10 && t.entrants[4].stage <= 30 && t.entrants[0].stage >= 20)) { ok(`seed ${seed}: the road gets harder`, false, st.join()); break; }
}
ok('200 draws: seven different champions each, never your own, the road getting harder', fail === 0);
const t0 = T.createTournament(ME, seeded(7));
ok('eight slots, you in slot 6 (HS: second from the right)', t0.entrants.length === 8 && t0.entrants[6].you && t0.entrants[6].card.number === 3);
ok('round one: four matches, you against slot 7', t0.rounds[0].length === 4 && T.yourMatch(t0).foe === 7);
ok('prizes are HS\'s: 100, 700, 1,700', T.PRIZE.join() === '100,700,1700');

// ── win it all ──
let r = T.recordMatch(t0, true, [3, 1], seeded(11));
ok('a quarter-final won pays 100 and moves you to the semi', r.prize === 100 && r.t.round === 1 && !r.out);
ok('…the other quarter-finals are decided, each with a winner and a score', r.t.rounds[0].every((m) => m.winner !== null && m.score && m.score[0] !== m.score[1]));
ok('…and the winner\'s score is the bigger one', r.t.rounds[0].every((m) => (m.winner === m.a) === (m.score[0] > m.score[1])));
ok('…the semis are drawn up from the winners', r.t.rounds[1].length === 2 && r.t.rounds[1].every((m) => m.winner === null));
ok('your quarter-final shows your score from your side', r.t.rounds[0][3].score.join() === '3,1' && r.t.rounds[0][3].winner === 6);
ok('the input is never changed', t0.round === 0 && t0.rounds[0][3].winner === null);
r = T.recordMatch(r.t, true, [2, 0], seeded(12));
ok('a semi won pays 700, into the final', r.prize === 700 && r.t.round === 2 && r.t.rounds[2].length === 1);
r = T.recordMatch(r.t, true, [4, 2], seeded(13));
ok('the final won pays 1,700: you are the champion', r.prize === 1700 && r.champion && T.finished(r.t));
ok('…2,500 earned in all', r.t.earned === 2500);
ok('…and you reached the top', T.reached(r.t, 6) === 3);
ok('a finished tournament has no next match', T.yourMatch(r.t) === null);
const again = T.recordMatch(r.t, true, [1, 0]);
ok('…and a result after the end changes nothing', again.prize === 0 && again.t === r.t);

// ── lose in the semi ──
let q = T.recordMatch(t0, true, [1, 0], seeded(21));
q = T.recordMatch(q.t, false, [0, 2], seeded(22));
ok('a semi lost pays nothing and you are out', q.prize === 0 && q.out && T.finished(q.t) && !q.champion);
ok('…the rest of the bracket plays itself out to a champion', q.t.rounds[2].length === 1 && q.t.rounds[2][0].winner !== null && q.t.rounds[2][0].winner !== 6);
ok('…you are recorded as reaching the semi', T.reached(q.t, 6) === 1);
ok('…100 earned', q.t.earned === 100);

// ── the stronger side goes through more often ──
let strongWins = 0, n = 0;
for (let s = 1; s <= 400; s++) {
  const t = T.createTournament(ME, seeded(s));
  const rr = T.recordMatch(t, true, [1, 0], seeded(s + 9999));
  const m = rr.t.rounds[0][0], sa = t.entrants[m.a].stage, sb = t.entrants[m.b].stage;
  if (Math.min(5, sa / 2) === Math.min(5, sb / 2)) continue;
  n++; if ((Math.min(5, sa / 2) > Math.min(5, sb / 2)) === (m.winner === m.a)) strongWins++;
}
ok('the stronger champion wins its match more often than not', strongWins / n > 0.5 && strongWins / n < 0.8, `${strongWins}/${n}`);

// ── saved ──
const s1 = store();
T.saveTournament(s1, q.t);
const back = T.loadTournament(s1);
ok('a tournament survives a reload', back && back.out && back.rounds[2][0].winner === q.t.rounds[2][0].winner);
T.saveTournament(s1, null);
ok('clearing it removes the save', T.loadTournament(s1) === null && !s1.d.size);
const bad = store(); bad.setItem(T.TOUR_KEY, '{nope');
ok('a broken save is no tournament, not an error', T.loadTournament(bad) === null);
const liar = store(); liar.setItem(T.TOUR_KEY, JSON.stringify({ ...t0, entrants: t0.entrants.map((e, i) => (i === 2 ? { stage: 99 } : e)) }));
ok('an impossible save is refused', T.loadTournament(liar) === null);

console.log(`test-tournament: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
