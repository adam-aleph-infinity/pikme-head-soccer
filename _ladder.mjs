// IS THE ARCADE A LADDER? Each of the 45 stages, exactly as the arcade builds it — the
// champion's bot, body, meter rate and power — against one fixed opponent standing in for the
// player: the tier-3 bot on legendary 3, with its own champion power. Prints goal difference and
// win rate per tier and per stage, from the champion's side.
//
//   node _ladder.mjs          100 matches a stage (~15s)
//   node _ladder.mjs 300      tighter numbers
//
// Bot against bot is noisy — one stage over 100 matches is good to about ±0.25 goals — so read
// the TIER column. It is the number the curve was tuned on (README, "The arcade").
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { stageConfig } from './shared/champions.js';

const N = Number(process.argv[2]) || 100;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rows = [];
for (let st = 1; st <= 45; st++) {
  const cfg = stageConfig(st);
  let gd = 0, w = 0;
  for (let s = 0; s < N; s++) {
    const rng = mulberry32(7000 + s * 31);
    const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, { ...cfg.matchOpts });
    const bots = [createBot(3, rng), createBot(0, rng, cfg.bot)];
    for (let k = 0; k < 60 * 200 && m.phase !== 'over'; k++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      m.events.length = 0;
    }
    gd += m.score[1] - m.score[0];
    if (m.score[1] > m.score[0]) w++;
  }
  rows.push({ st, power: cfg.champ.power, gd: gd / N, win: w / N });
}
console.log(`champion vs the tier-3 bot on legendary 3, ${N} matches a stage\n`);
for (let t = 0; t < 5; t++) {
  const r = rows.slice(t * 9, t * 9 + 9);
  const gd = r.reduce((a, x) => a + x.gd, 0) / 9, win = r.reduce((a, x) => a + x.win, 0) / 9;
  console.log(`tier ${t + 1}  goal diff ${gd >= 0 ? '+' : ''}${gd.toFixed(2)}  win ${(win * 100).toFixed(0)}%   ` +
    r.map((x) => `${x.st}:${x.gd >= 0 ? '+' : ''}${x.gd.toFixed(2)}`).join(' '));
}
