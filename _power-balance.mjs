// THE POWER BALANCE BAND (docs/CHAMPION-POWERS.md §3): every champion's power, fired in a
// controlled duel at a CPU defender, measured the same way — so "roughly the same strength" is a
// number, not a feeling.
//
// One trial: the shooter stands somewhere between his own box and the half-way line, armed, the
// ball at his head; the defender — a CPU of the given tier, on its own wits from a spot in front
// of its goal — gets the whole cut-in to answer. After the release the shooter is a CPU too (tier
// SHOOTER, a mix), so what a power leaves behind — a defender thrown into his net, stuck in chocolate,
// frozen — is worth what it is worth in a match: the follow-up. For WINDOW s after the release we
// record what became of it:
//   goal     the shooter scored
//   block    the defender kicked it (the grind) — what happens after counts as its own
//   counter  the defender was armed and touched it
//   hit      it met the defender's head or body
//   miss     nothing met it and it did not score
// and how many seconds the defender spent without full control (stunned, or an ailment that takes
// the controls), plus how long he carried any ailment at all.
//
//   node _power-balance.mjs [trials=60] [tiers=1,2,3,4,5]        every built power + the references
//   ONLY=1,2 node _power-balance.mjs                          just those stages
// References: a plain card's straight comet (a common), and the Mythic Gem (Idan: above the arcade's
// average) — the band sits between the two.
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { BUILT_STAGES, CHAMPION_POWERS } from './shared/champion-powers.js';
import { ailMods, shotById, FAMILY_ORDER } from './shared/hs-powers.js';

const trials = Number(process.argv[2]) || 60;
const tiers = (process.argv[3] || '1,2,3,4,5').split(',').map(Number);
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const DEF_CARD = { rarity: 'epic', number: 1 };
const SHOOTERS = (process.env.SHOOTER || '3,4,5').split(',').map(Number);   // the shooter's CPU tier after the release, by trial
const WINDOW = Number(process.env.WINDOW ?? 4);     // s after the release that count

function duel(card, tier, seed, shot = null, win = WINDOW) {
  const r = rng(seed * 7919 + 17);
  const seat = seed % 2;                                        // both seats, alternately
  const cards = []; cards[seat] = card; cards[1 - seat] = DEF_CARD;
  const m = createMatch(cards[0], cards[1], { duration: 600 });
  m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0;
  const a = m.players[seat], z = m.players[1 - seat];
  if (shot) a.shot = shot;
  const X = (v) => (seat === 0 ? v : C.W - v);
  a.x = X(170 + r() * 370);                                    // own box … half-way
  z.x = X(C.W - C.GOAL_W - 70 - r() * 240);                    // in front of its goal
  a.armed = 1; a.gauge = 0; z.gauge = 0;
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0; m.ball.spin = 0;
  const bot = createBot(tier, rng(seed * 31 + tier)), sb = createBot(SHOOTERS[seed % SHOOTERS.length], rng(seed * 53 + 7));
  let released = false;
  const inputs = () => { const o = [{}, {}]; o[1 - seat] = botInput(bot, m, 1 - seat, C.TICK); if (released) o[seat] = botInput(sb, m, seat, C.TICK); return o; };
  step(m, inputs());
  let out = null, lost = 0, ail = 0, scored = false, shells = 0;
  for (let i = 0; i < 60 * (win + 2) && m.phase === 'play'; i++) {
    step(m, inputs());
    if (!(m.cutin > C.POWER_RELEASE)) released = true;
    if (!released) { m.events.length = 0; continue; }
    const md = ailMods(z);
    if (z.stunned > 0 || (md && md.dead)) lost += C.TICK;
    if (z.ail) ail += C.TICK;
    for (const e of m.events) {
      if (e.type === 'goal') { if (e.player === seat) scored = true; else out = out || 'conceded'; break; }
      // a barrage's shells (the Cannoneer's) are counted apart: the outcome is the ball's
      if (e.type === 'powerHit' && e.how === 'shell') { if (e.player === 1 - seat) shells++; continue; }
      if (out) continue;
      if (e.type === 'blocked' && e.player === 1 - seat && !e.extra) out = 'block';
      else if (e.type === 'powershot' && e.player === 1 - seat && e.countered) out = 'counter';
      else if (e.type === 'powerHit' && e.player === 1 - seat) out = 'hit';
    }
    m.events.length = 0;
    if (scored || m.score[1 - seat] > 0) break;
    if (i > 60 * (win + 1.3)) break;
  }
  return { out: scored ? (out === 'conceded' ? 'miss' : out || 'miss') : out || 'miss', goal: scored, lost, ail, shells };
}

// `late`: s after the release before the ball itself leaves (a barrage's shells go first) — the
// window counts from the ball, so every power gets the same WINDOW of follow-up
function row(label, card, shot = null, late = 0) {
  const cells = [];
  for (const t of tiers) {
    const o = { goal: 0, block: 0, counter: 0, hit: 0, miss: 0, conceded: 0 }; let lost = 0, ail = 0, shells = 0;
    for (let s = 0; s < trials; s++) { const d = duel(card, t, s + 1, shot, WINDOW + late); o[d.out] = (o[d.out] || 0) + 1; if (d.goal) o.goal++; lost += d.lost; ail += d.ail; shells += d.shells; }
    cells.push({ t, goal: o.goal / trials, block: o.block / trials, hit: o.hit / trials, counter: o.counter / trials, conc: o.conceded / trials, lost: lost / trials, ail: ail / trials, shells: shells / trials });
  }
  const g = cells.reduce((s, c) => s + c.goal, 0) / cells.length;
  console.log(`${label.padEnd(26)} goal ${(100 * g).toFixed(0).padStart(3)}% | ` + cells.map((c) => `T${c.t} g${(100 * c.goal).toFixed(0).padStart(3)} b${(100 * c.block).toFixed(0).padStart(3)} h${(100 * c.hit).toFixed(0).padStart(3)} c${(100 * c.conc).toFixed(0).padStart(2)} lost ${c.lost.toFixed(2)}s ail ${c.ail.toFixed(1)}s${late ? ` sh ${c.shells.toFixed(2)}` : ''}`).join(' | '));
  return g;
}

console.log(`${trials} duels per tier, defender tiers ${tiers.join(',')}, shooter CPU tiers ${SHOOTERS.join(',')} after the release (goal = scored within ${WINDOW} s)`);
row('ref: plain comet (common)', { rarity: 'common', number: 0 });
row('ref: Mythic Gem', { rarity: 'mythic', number: 1 });
// FAMILIES=1: every engine family as the cards that are not champions fire it (middle intensity)
if (process.env.FAMILIES) for (const f of FAMILY_ORDER) row(`ref family: ${f}`, { rarity: 'epic', number: 1 }, shotById(f));
const goals = [];
for (const n of BUILT_STAGES) {
  if (only && !only.includes(n)) continue;
  const d = CHAMPION_POWERS[n];
  goals.push([n, row(`${n}. ${d.name}${d.everywhere ? '' : ' (HS copy)'}`, { rarity: 'legendary', number: n }, null, d.ballAt || 0)]);
}
if (goals.length > 1) {
  const v = goals.map((g) => g[1]).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)];
  console.log(`median ${(100 * med).toFixed(0)}%  · outside ±6 pts: ${goals.filter(([, g]) => Math.abs(g - med) > 0.06).map(([n, g]) => `${n} (${(100 * g).toFixed(0)}%)`).join(', ') || 'none'}`);
}
