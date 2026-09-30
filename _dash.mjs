// CPU DASHES: dashes and dash strikes (a dash, then the ball off that player at 1400+ px/s) per minute,
// per tier against the tier-3 bot, 30 matches each. HS: 13.7 dashes a minute at five stars, 2.2 weak.  node _dash.mjs
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
for (const lvl of [5, 3, 0]) {
  let secs = 0, dashes = 0, strikes = 0, goals = 0;
  for (let s = 0; s < 30; s++) {
    let seed = 300 + s; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
    const bots = [createBot(3, rng), createBot(lvl, rng)]; let lastDash = -9;
    for (let i = 0; i < 60 * 80 && m.phase !== 'over'; i++) {
      const v0 = Math.hypot(m.ball.vx, m.ball.vy);
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      if (m.phase === 'play' && !m.afterGoal) secs += C.TICK;
      for (const e of m.events) if (e.type === 'dash' && e.player === 1) { dashes++; lastDash = i; }
      const v1 = Math.hypot(m.ball.vx, m.ball.vy);
      if (i - lastDash < 12 && v1 > 1400 && v0 < 900 && !m.ball.power && Math.abs(m.ball.x - m.players[1].x) < 90) { strikes++; lastDash = -9; }
      m.events.length = 0;
    }
    goals += m.score[1] - m.score[0];
  }
  console.log(`CPU level ${lvl}: dashes ${(dashes / (secs / 60)).toFixed(1)}/min  dash strikes ${(strikes / (secs / 60)).toFixed(1)}/min  goal diff vs tier 3: ${(goals / 30).toFixed(2)}/match`);
}
