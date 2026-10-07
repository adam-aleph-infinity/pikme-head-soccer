// THE TOURNAMENT (Head Soccer's: 8 players, 3 knockout rounds, a bracket between the matches,
// one loss and you are out — docs/HS-MENUS.md §3.3, M15 44–47 s). Pure: no DOM, the storage and
// the dice are passed in, so test-tournament.mjs plays it in node.
//
// Eight slots along the bottom of the bracket; you are slot 6 (HS M15 puts its YOU tag
// second from the right). The other seven are champions, drawn so the road gets harder: your
// quarter-final against an early champion, the semi from the middle of the ladder, the final
// from its top half. The matches you are not in are decided by the dice, the stronger champion
// (higher on the ladder) more likely to go through, with a plausible score.
//
// Prizes, HS's own (wiki: 100 / 700 / 1,700): נקודות סולטיז for each round you WIN.

export const TOUR_KEY = 'hs.tour.v1';
export const ROUNDS = ['רבע גמר', 'חצי גמר', 'גמר'];
export const PRIZE = [100, 700, 1700];
export const YOU = 6;                                    // your slot
// The pools each slot's champion is drawn from (stages, inclusive): slot 7 meets you first.
const POOLS = [[20, 45], [20, 45], [20, 45], [20, 45], [10, 30], [10, 30], null, [1, 15]];

const roll = (rng, [a, b], taken) => {
  for (let k = 0; k < 200; k++) { const n = a + Math.floor(rng() * (b - a + 1)); if (!taken.has(n)) { taken.add(n); return n; } }
  for (let n = a; n <= b; n++) if (!taken.has(n)) { taken.add(n); return n; }
  return a;
};

/** A new tournament. `me` is your card ({rarity, number}). */
export function createTournament(me, rng = Math.random) {
  const taken = new Set();
  // your own card, if it is a champion's, is not also drawn as an opponent
  if (me && me.rarity === 'legendary') taken.add(me.number);
  const entrants = POOLS.map((p, i) => (i === YOU ? { you: true, card: { rarity: me.rarity, number: me.number } } : { stage: roll(rng, p, taken) }));
  // rounds[r] = the matches of round r, each { a, b, winner, score } (a, b: slot numbers)
  const rounds = [[0, 1], [2, 3], [4, 5], [6, 7]].map(([a, b]) => ({ a, b, winner: null, score: null }));
  const t = { v: 1, entrants, rounds: [rounds, [], []], round: 0, out: false, champion: false, earned: 0 };
  playOthers(t, rng);
  return t;
}

// How strong a slot is, for the dice: its place on the 45-champion ladder (stars stop at 5 by
// stage 10, so they cannot tell two finalists apart), scaled to 0–5. You count as about stage 36.
const strength = (t, slot) => (t.entrants[slot].you ? 4 : t.entrants[slot].stage / 9);

// A match you are not in: the stronger side wins about two times in three, by a goal or three.
function decide(t, m, rng) {
  const sa = strength(t, m.a), sb = strength(t, m.b);
  const pA = 0.5 + Math.max(-0.2, Math.min(0.2, (sa - sb) * 0.08));
  const aWins = rng() < pA;
  const w = 1 + Math.floor(rng() * 4), l = Math.floor(rng() * w);
  m.winner = aWins ? m.a : m.b;
  m.score = aWins ? [w, l] : [l, w];
}

// HS: the round's other matches are already played when you reach the bracket — their winners
// climb, their scores show — and only yours waits for PLAY.
function playOthers(t, rng) {
  for (const x of t.rounds[t.round]) if (x.winner === null && x.a !== YOU && x.b !== YOU) decide(t, x, rng);
}

/** The match you play this round: { a, b, foe (slot), stage (the champion's) } — or null. */
export function yourMatch(t) {
  if (t.out || t.champion) return null;
  const m = t.rounds[t.round].find((x) => x.a === YOU || x.b === YOU);
  if (!m) return null;
  const foe = m.a === YOU ? m.b : m.a;
  return { match: m, foe, stage: t.entrants[foe].stage };
}

/**
 * Your match ended. `score` is [yours, theirs]. Returns a NEW tournament and what happened:
 * { t, won, prize, out, champion }. The round's other matches are decided, the next round is
 * drawn up from the winners — the bracket is always complete up to where you are.
 */
export function recordMatch(t0, won, score, rng = Math.random) {
  const t = structuredClone(t0);
  const ym = yourMatch(t);
  if (!ym) return { t: t0, won: false, prize: 0, out: t0.out, champion: t0.champion };
  const m = t.rounds[t.round].find((x) => x === ym.match || (x.a === ym.match.a && x.b === ym.match.b));
  m.winner = won ? YOU : ym.foe;
  m.score = m.a === YOU ? [score[0], score[1]] : [score[1], score[0]];
  for (const x of t.rounds[t.round]) if (x.winner === null) decide(t, x, rng);
  const prize = won ? PRIZE[t.round] : 0;
  t.earned += prize;
  if (!won) t.out = true;
  else if (t.round === 2) t.champion = true;
  else {
    const w = t.rounds[t.round].map((x) => x.winner);
    t.rounds[t.round + 1] = [];
    for (let i = 0; i < w.length; i += 2) t.rounds[t.round + 1].push({ a: w[i], b: w[i + 1], winner: null, score: null });
    t.round++;
    playOthers(t, rng);
  }
  // once you are out, the rest of the bracket plays itself out to its champion
  if (t.out) {
    for (let r = t.round; r < 3; r++) {
      if (r > t.round) {
        const w = t.rounds[r - 1].map((x) => x.winner);
        t.rounds[r] = [];
        for (let i = 0; i < w.length; i += 2) t.rounds[r].push({ a: w[i], b: w[i + 1], winner: null, score: null });
      }
      for (const x of t.rounds[r]) if (x.winner === null) decide(t, x, rng);
    }
  }
  return { t, won, prize, out: t.out, champion: t.champion };
}

/** Is it over (you are out, or you won it)? */
export const finished = (t) => !!(t && (t.out || t.champion));

/** How far a slot got: the last round it is still in (0..3; 3 = won the whole thing). */
export function reached(t, slot) {
  let r = 0;
  for (let k = 0; k < 3; k++) {
    const m = t.rounds[k].find((x) => x.a === slot || x.b === slot);
    if (!m) break;
    if (m.winner === slot) r = k + 1; else break;
  }
  return r;
}

// ── saved on the device, so a tournament survives closing the app ──
export function parseTournament(raw) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!o || o.v !== 1 || !Array.isArray(o.entrants) || o.entrants.length !== 8 || !Array.isArray(o.rounds) || o.rounds.length !== 3) return null;
  if (!o.entrants[YOU] || !o.entrants[YOU].you) return null;
  if (!Number.isInteger(o.round) || o.round < 0 || o.round > 2) return null;
  for (let i = 0; i < 8; i++) if (i !== YOU && !(Number.isInteger(o.entrants[i].stage) && o.entrants[i].stage >= 1 && o.entrants[i].stage <= 45)) return null;
  return o;
}
export function loadTournament(storage) { try { return parseTournament(storage ? storage.getItem(TOUR_KEY) : null); } catch { return null; } }
export function saveTournament(storage, t) {
  try { if (t) storage.setItem(TOUR_KEY, JSON.stringify(t)); else storage.removeItem(TOUR_KEY); return true; } catch { return false; }
}
