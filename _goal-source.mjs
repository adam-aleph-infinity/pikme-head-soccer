// Where bot-vs-bot goals come from: power shots vs open play, and how fast the open-play ones go in.
//   node _goal-source.mjs [seeds]
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const n = Number(process.argv[2]) || 8; let fired = 0, power = 0, open = 0, dashed = 0, kickoff = 0; const sp = [];
for (let s = 0; s < n; s++) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const bots = [createBot(3, rng(11 + 101 * s)), createBot(3, rng(23 + 101 * s))];
  let lastDash = -1e9, lastKickoff = 0, i = 0;
  for (; i < 60 * 200 && m.phase !== 'over'; i++) {
    const v = Math.hypot(m.ball.vx, m.ball.vy);
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    if (m.players.some((p) => p.dashT > 0 && Math.hypot(p.x - m.ball.x, p.y - m.ball.y) < 120)) lastDash = i;
    for (const e of m.events) {
      if (e.type === 'armed') fired++;
      if (e.type === 'ballDrop' || e.type === 'ballReset') lastKickoff = i;
      if (e.type !== 'goal') continue;
      if (e.power) power++; else { open++; sp.push(v); if (i - lastDash < 90) dashed++; if (i - lastKickoff < 240) kickoff++; }
    }
    m.events.length = 0;
  }
}
sp.sort((a, b) => a - b);
console.log(`power shots armed ${(fired / n).toFixed(1)}/match, scored ${(100 * power / Math.max(1, fired)).toFixed(0)}%`);
console.log(`${n} matches: ${((power + open) / n).toFixed(1)} goals/match — power ${(power / n).toFixed(1)}, open play ${(open / n).toFixed(1)} (dash within 1.5 s: ${(dashed / n).toFixed(1)}, within 4 s of a restart: ${(kickoff / n).toFixed(1)}) | open-play speed into the net med ${sp[sp.length >> 1]?.toFixed(0)}`);
