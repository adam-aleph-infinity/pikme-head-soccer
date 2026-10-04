// Each arcade stage, exactly as the arcade builds it (bot, HS stats, gauge rate), against the tier-3
// bot standing in for the player on equal stats: goals for and against a match.
//   node _stage-ladder.mjs [matches=12] [stages=1,2,3,...]
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { stageConfig } from './shared/champions.js';
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const n = Number(process.argv[2]) || 12;
const stages = (process.argv[3] || '1,2,3,4,5,6,7,8,9,10,15,20,30,45').split(',').map(Number);
for (const st of stages) {
  const cfg = stageConfig(st); let f = 0, a = 0, w = 0; const pg = [0, 0], ps = [0, 0];
  if (process.env.NOARCH) delete cfg.bot.archetype;
  for (let s = 0; s < n; s++) {
    const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, { ...cfg.matchOpts });
    const bots = [createBot(3, rng(900 + s * 13)), createBot(0, rng(77 + s * 31), cfg.bot)];
    for (let k = 0; k < 60 * 200 && m.phase !== "over"; k++) { step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]); for (const e of m.events) { if (e.type === "goal" && e.power) pg[e.player]++; if (e.type === "powershot" && !e.rebound && !e.countered) ps[e.player]++; } m.events.length = 0; }
    f += m.score[1]; a += m.score[0]; if (m.score[1] > m.score[0]) w++;
  }
  console.log(`stage ${String(st).padStart(2)} ${String(cfg.champ.hs.stars).padStart(3)}★ stats ${Object.values(cfg.champ.hs.stats).join('/')} | CPU ${(f / n).toFixed(1)} - ${(a / n).toFixed(1)} you | CPU wins ${Math.round(100 * w / n)}% | power shots CPU ${(ps[1] / n).toFixed(1)} (goals ${(pg[1] / n).toFixed(1)}) you ${(ps[0] / n).toFixed(1)} (goals ${(pg[0] / n).toFixed(1)})`);
}
