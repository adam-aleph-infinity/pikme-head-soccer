// THE ARENA'S RULES (shared/arena.js): the arenas and their stadiums, trophies won and lost by who you
// met, the floors, the Trophy Road, the daily bonus, finding an opponent and the CPU that stands in.
// Run: node test-arena.mjs
import fs from 'node:fs';
import * as A from './shared/arena.js';
import { HS_STAGES } from './public/hs-stadium.js';
import { STAGES } from './public/stages.js';
import { DIFFICULTIES } from './shared/bot.js';
import { cleanName } from './shared/menu.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// ── the arenas ──
ok('ten arenas, the first from 0, each higher than the last', A.ARENA_COUNT === 10 && A.ARENAS[0].from === 0 && A.ARENAS.every((a, i) => i === 0 || a.from > A.ARENAS[i - 1].from));
const ids = new Set([...HS_STAGES, ...STAGES].map((s) => s.id));
ok('each on a stadium the game draws, none twice', A.ARENAS.every((a) => ids.has(a.stage)) && new Set(A.ARENAS.map((a) => a.stage)).size === 10, A.ARENAS.filter((a) => !ids.has(a.stage)).map((a) => a.stage).join());
ok('each with a Hebrew name', A.ARENAS.every((a) => /[֐-׿]/.test(a.name)));
ok('which arena: 0 → 1, 299 → 1, 300 → 2, 9999 → 10', A.arenaOf(0).n === 1 && A.arenaOf(299).n === 1 && A.arenaOf(300).n === 2 && A.arenaOf(9999).n === 10);
ok('the next gate, and none at the top', A.nextArena(0).from === 300 && A.nextArena(4500) === null);
ok('progress through an arena, 0..1', A.arenaProgress(0) === 0 && A.arenaProgress(150) === 0.5 && A.arenaProgress(5000) === 1);

// ── trophies ──
ok('equal players: a win is 30', A.winTrophies(500, 500) === 30);
ok('beating someone 400 above: 40; 400 below: 20', A.winTrophies(500, 900) === 40 && A.winTrophies(500, 100) === 20);
ok('…no further than that, however far apart', A.winTrophies(0, 5000) === 40 && A.winTrophies(5000, 0) === 20);
ok('a loss costs four fifths of what the other won (24 between equals)', A.lossTrophies(500, 500) === 24);
ok('…less against someone better (16), more against someone worse (32)', A.lossTrophies(500, 900) === 16 && A.lossTrophies(500, 100) === 32);
let r = A.applyResult(280, 280, 'win');
ok('a win across a gate opens the arena (the reveal)', r.trophies === 310 && r.delta === 30 && r.arena === 2 && r.newArena === 2, JSON.stringify(r));
r = A.applyResult(310, 310, 'loss');
ok('…and a loss never takes you back under it (the floor)', r.trophies === 300 && r.delta === -10 && r.arena === 2 && r.newArena === null, JSON.stringify(r));
r = A.applyResult(10, 10, 'loss');
ok('never below 0', r.trophies === 0 && r.delta === -10);
r = A.applyResult(700, 650, 'draw');
ok('a draw moves nothing', r.trophies === 700 && r.delta === 0);
// a kid who wins half against equals still climbs (the loss share is under 1)
let t = 0;
for (let i = 0; i < 200; i++) t = A.applyResult(t, t, i % 2 ? 'loss' : 'win').trophies;
ok(`winning half the time climbs (200 matches → ${t})`, t > 500);

// ── the road ──
ok('a node every 100, 50 of them', A.roadAt(1) === 100 && A.roadAt(50) === 5000 && A.ROAD_NODES === 50);
ok('a gate pays 500 × the arena; any other node 150 + 50 × the arena', A.roadPrize(3).points === 1000 && A.roadPrize(3).gate === 2 && A.roadPrize(1).points === 200 && A.roadPrize(1).gate === null && A.roadPrize(4).points === 250 && A.roadPrize(7).points === 300);
ok('every arena\'s gate is on the road', A.ARENAS.slice(1).every((a) => A.roadPrize(a.from / 100).gate === a.n));
ok('claimed in order, once your best has reached it', A.canClaim(1, 100, 0) && !A.canClaim(1, 99, 0) && !A.canClaim(2, 500, 0) && !A.canClaim(1, 500, 1) && A.canClaim(2, 500, 1));
ok('how many are waiting', A.roadWaiting(530, 2) === 3 && A.roadWaiting(0, 0) === 0 && A.roadWaiting(99999, 0) === 50);
const total = Array.from({ length: A.ROAD_NODES }, (_, i) => A.roadPrize(i + 1).points).reduce((s, v) => s + v, 0);
ok(`the whole road pays ${total.toLocaleString()} points — under a tenth of the upgrades (≈ 1.2 M)`, total < 120000);

// ── the daily bonus ──
ok('the first three wins of the day: 200, 200, 500; then nothing', A.dailyBonus(0) === 200 && A.dailyBonus(1) === 200 && A.dailyBonus(2) === 500 && A.dailyBonus(3) === 0);

// ── finding an opponent ──
ok('the window starts at ±100 and widens 40 a second', A.windowFor(0) === 100 && A.windowFor(5000) === 300);
ok('close trophies match at once; far ones after waiting', A.canPair({ trophies: 100, since: 0 }, { trophies: 180, since: 0 }, 0) && !A.canPair({ trophies: 100, since: 0 }, { trophies: 400, since: 0 }, 0) && A.canPair({ trophies: 100, since: 0 }, { trophies: 400, since: 1000 }, 6000));
ok('a CPU after 10 s (Idan: ~10 s)', A.BOT_AFTER === 10000);
let seed = 5;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const bots = Array.from({ length: 200 }, () => A.botFor(1000, 0, rnd));
ok('the CPU: a made-up nickname, a Mythic, trophies within 30 of yours', bots.every((b) => A.BOT_NAMES.includes(b.name) && b.starter >= 1 && b.starter <= 4 && Math.abs(b.trophies - 1000) <= 30));
ok('…all four Mythics turn up', new Set(bots.map((b) => b.starter)).size === 4);
ok('nicknames are ones a player could have typed (10 letters at most)', A.BOT_NAMES.every((nm) => cleanName(nm) === nm && [...nm].length <= 10), A.BOT_NAMES.filter((nm) => cleanName(nm) !== nm).join());
ok('its level: gentle in arena 1, the hardest at the top', A.botLevel(0) === 0 && A.botLevel(5000) === DIFFICULTIES.length - 1);
ok('three losses in a row: one level kinder', A.botLevel(1500, 3) === A.botLevel(1500, 0) - 1 && A.botLevel(0, 5) === 0);

// ── nothing here touches the match ──
ok('the sim does not import the arena (upgrades and trophies never reach a match)', !/arena\.js|upgrades/.test(fs.readFileSync('shared/sim.js', 'utf8').match(/^import .*$/gm).join('\n')));

console.log(`arena: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
