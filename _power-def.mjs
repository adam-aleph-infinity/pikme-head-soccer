// How each CPU tier answers a power shot fired at it: goal / block / counter / hit / miss, per defender tier.
//   node _power-def.mjs [seeds] [shooterTier]
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const n = Number(process.argv[2]) || 8, shooterTier = Number(process.argv[3] ?? 3);
for (let L = 0; L <= 5; L++) {
  const o = { goal: 0, block: 0, counter: 0, hit: 0, miss: 0 }; const how = {}; let shots = 0, jumps = 0, dashes = 0, mins = 0, goalsFor = 0, goalsAg = 0;
  for (let s = 0; s < n; s++) {
    const m = createMatch({ rarity: 'legendary', number: Number(process.env.CARD || 3) }, { rarity: 'legendary', number: 2 }, process.env.CHAMP ? { champions: true } : {});
    const bots = [createBot(shooterTier, rng(11 + 101 * s)), createBot(L, rng(23 + 101 * s))];
    let pend = false, i = 0;
    for (; i < 60 * 200 && m.phase !== 'over'; i++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      for (const e of m.events) {
        if (e.type === 'jump' && e.player === 1) jumps++;
        if (e.type === 'dash' && e.player === 1) dashes++;
        if (e.type === 'goal') e.player === 1 ? goalsFor++ : goalsAg++;
        if (e.type === 'powershot' && e.player === 0 && !e.rebound && !e.countered) { shots++; pend = true; continue; }
        if (!pend) continue;
        const r = e.type === 'goal' && e.player === 0 ? 'goal' : e.type === 'blocked' && e.player === 1 ? 'block' + (process.env.HOW ? ':' + (e.how || 'kick') : '')
          : e.type === 'powershot' && e.player === 1 ? 'counter' : e.type === 'powerHit' && e.player === 1 ? 'hit' : null;
        if (r) { const k = r.startsWith('block') ? 'block' : r; o[k]++; if (r.includes(':')) how[r] = (how[r] || 0) + 1; pend = false; }
      }
      m.events.length = 0;
      if (pend && !m.ball.power && !(m.cutin > 0)) { o.miss++; pend = false; }
    }
    mins += i * C.TICK / 60;
  }
  const pc = (k) => `${k} ${(100 * o[k] / Math.max(1, shots)).toFixed(0)}%`;
  console.log(`tier ${L}: ${(shots / n).toFixed(1)} shots/match | ${['goal', 'block', 'counter', 'hit', 'miss'].map(pc).join(' ')} | jumps ${(jumps / mins).toFixed(0)}/min dashes ${(dashes / mins).toFixed(1)}/min | score ${(goalsFor / n).toFixed(1)}-${(goalsAg / n).toFixed(1)}${Object.keys(how).length ? ' | ' + JSON.stringify(how) : ''}`);
}
