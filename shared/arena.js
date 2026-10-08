// THE ARENA — Clash Royale's trophy ladder, ours (Idan, 2026-10-08; docs/TEAMS-ARENA.md). Pure, so the
// server (server/league.js), which decides every number here, and the client (public/arena.js), which
// only draws them, read the same rules.
//
//   PLAY is a battle against another player, found by trophies (Idan: "PLAY = arena battle"). A win
//   takes trophies, a loss gives some back, and how many depends on who you met (Elo, Idan's pick):
//   beating someone above you is worth more. Climb past a gate and a new arena opens — its own
//   stadium, its own name — and you never fall back below it (Clash Royale's floors). The Trophy
//   Road pays at every hundred, more at every gate, and the first three wins of every day pay a
//   bonus (Idan: road, arenas, daily wins). Upgrades never come into it: everyone plays with equal
//   bodies (Idan), so trophies are skill and play, never what you bought.

// ── THE ARENAS: every ~300–800 trophies, each on a stadium the game already draws ──────────────
// `stage` is a backdrop id (public/hs-stadium.js HS_STAGES, public/stages.js STAGES).
export const ARENAS = Object.freeze([
  { n: 1, from: 0, name: 'אצטדיון השכונה', stage: 'hs-day' },
  { n: 2, from: 300, name: 'הנמל', stage: 'harbor' },
  { n: 3, from: 600, name: "הג'ונגל", stage: 'jungle' },
  { n: 4, from: 1000, name: 'העיר הסינית', stage: 'china' },
  { n: 5, from: 1400, name: 'המקדש', stage: 'temple' },
  { n: 6, from: 1900, name: 'יפן', stage: 'japan' },
  { n: 7, from: 2400, name: 'המפעל', stage: 'factory' },
  { n: 8, from: 3000, name: 'בסיס האוויר', stage: 'airbase' },
  { n: 9, from: 3700, name: 'אצטדיון הלילה', stage: 'hs-night' },
  { n: 10, from: 4500, name: 'אולם האלופים', stage: 'hs-arena' },
].map((a) => Object.freeze(a)));
export const ARENA_COUNT = ARENAS.length;
// the arena a trophy count is in
export const arenaOf = (t) => { let a = ARENAS[0]; for (const x of ARENAS) if ((t | 0) >= x.from) a = x; return a; };
// the next gate up, or null at the top
export const nextArena = (t) => ARENAS.find((x) => x.from > (t | 0)) || null;
// how far into this arena (0..1) — the home screen's bar
export function arenaProgress(t) {
  const a = arenaOf(t), b = nextArena(t);
  return b ? Math.max(0, Math.min(1, ((t | 0) - a.from) / (b.from - a.from))) : 1;
}

// ── TROPHIES ─────────────────────────────────────────────────────────────────────────────────
// d = how far above you the other player is (−400…400). A win is 30 + d/40 (20…40); a loss costs
// four fifths of what the other player would have won (16…32), so a kid who plays a lot climbs. A
// draw moves nothing. Never below 0, and never below the floor of the arena you are in.
export const WIN_BASE = 30, SPREAD = 400, LOSS_SHARE = 0.8;
const gap = (me, opp) => Math.max(-SPREAD, Math.min(SPREAD, (opp | 0) - (me | 0)));
export const winTrophies = (me, opp) => Math.round(WIN_BASE + gap(me, opp) / 40);
export const lossTrophies = (me, opp) => Math.round(LOSS_SHARE * (WIN_BASE - gap(me, opp) / 40));
// result: 'win' | 'loss' | 'draw'. Returns { trophies, delta, arena, newArena } — newArena is the
// arena just reached for the first time this match (the reveal), or null.
export function applyResult(me, opp, result) {
  const t0 = Math.max(0, me | 0);
  let t1 = t0;
  if (result === 'win') t1 = t0 + winTrophies(t0, opp);
  else if (result === 'loss') t1 = Math.max(arenaOf(t0).from, t0 - lossTrophies(t0, opp));
  const a0 = arenaOf(t0), a1 = arenaOf(t1);
  return { trophies: t1, delta: t1 - t0, arena: a1.n, newArena: a1.n > a0.n ? a1.n : null };
}

// ── THE TROPHY ROAD: a prize every 100, a bigger one at every gate ──────────────────────────
// Node i (1-based) is at i × 100 trophies. Prizes are Arcade Points for now (champion boxes go on
// the gates later, Idan). Nodes are claimed in order, each once, once your BEST has reached them.
export const ROAD_STEP = 100;
export const ROAD_NODES = 50;                      // 100 … 5,000
export const roadAt = (i) => i * ROAD_STEP;
export function roadPrize(i) {
  const at = roadAt(i), gate = ARENAS.find((a) => a.from === at);
  return gate ? { points: 500 * gate.n, gate: gate.n } : { points: 150 + 50 * arenaOf(at).n, gate: null };
}
// may node i be claimed by a player whose best is `best` and who has claimed up to `claimed`?
export const canClaim = (i, best, claimed) => Number.isInteger(i) && i === (claimed | 0) + 1 && i <= ROAD_NODES && roadAt(i) <= (best | 0);
// how many are waiting
export const roadWaiting = (best, claimed) => Math.max(0, Math.min(ROAD_NODES, Math.floor((best | 0) / ROAD_STEP)) - (claimed | 0));

// ── THE DAILY BONUS: the first three wins of every day (Israel's day, shared/teams.js dayOf) ──
export const DAILY = Object.freeze([200, 200, 500]);
export const dailyBonus = (winsBefore) => DAILY[winsBefore | 0] || 0;

// ── FINDING AN OPPONENT ─────────────────────────────────────────────────────────────────────
// Two players waiting are a match when their trophies are within the window of the one who has
// waited longer; it widens every second. After BOT_AFTER nobody human came: a CPU (Idan), named and
// dressed like a player, at your trophies and your arena's level.
export const BOT_AFTER = 10000;
export const VS_MS = 2600;                         // the VS card before kick-off
export const windowFor = (waitedMs) => 100 + 40 * Math.max(0, waitedMs) / 1000;
export const canPair = (a, b, now) => Math.abs((a.trophies | 0) - (b.trophies | 0)) <= windowFor(now - Math.min(a.since, b.since));
// Made-up nicknames, never a real player's: what the CPU is called.
export const BOT_NAMES = Object.freeze([
  'טיל_הגולים', 'שוער_על', 'נמר7', 'הבועט', 'מלך_השער', 'ברק99', 'גולר', 'כוכב_על', 'דרקון', 'פלפל',
  'סופה', 'זיקוק', 'קפטן_גול', 'אריה12', 'ראש_גדול', 'בומבה', 'רקטה', 'נינג׳ה', 'צ׳יטה', 'הטורנדו',
  'סלטה', 'קוביה', 'ברווז9', 'מסטיק', 'הענק', 'גלגל', 'שוקו', 'ירח', 'פצצה', 'זריז',
]);
// The CPU's level (shared/bot.js DIFFICULTIES 0–5) by arena: arena 1 is gentle — a first-timer wins
// there — and the top arenas play like the arcade's hardest. Three losses in a row and the next one
// is a level kinder, so nobody is stuck.
const LEVEL_BY_ARENA = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5];
export const botLevel = (trophies, lossStreak = 0) => Math.max(0, LEVEL_BY_ARENA[arenaOf(trophies).n - 1] - ((lossStreak | 0) >= 3 ? 1 : 0));
// A CPU opponent for a player on `trophies`: { name, starter, trophies, level }.
export function botFor(trophies, lossStreak, rnd = Math.random) {
  const t = Math.max(0, (trophies | 0) + Math.round((rnd() * 2 - 1) * 30));
  return {
    name: BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length) % BOT_NAMES.length],
    starter: 1 + (Math.floor(rnd() * 4) % 4),
    trophies: t,
    level: botLevel(trophies, lossStreak),
  };
}
