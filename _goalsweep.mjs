// How goal size trades off against scoring rate AND whether skill can express itself.
// A game with 2 goals a match is decided by one bounce, so "hard beats easy" is the real
// health check, not the goal count alone.
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function play(la,lb,seed){
  const rng=mulberry32(seed);
  const m=createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{});
  const bots=[createBot(la,rng),createBot(lb,rng)];
  let t=0; while(m.phase!=='over'&&t<20000){ step(m,[botInput(bots[0],m,0,C.TICK),botInput(bots[1],m,1,C.TICK)]); m.events.length=0; t++; }
  return m;
}
const H = process.argv[2] ? process.argv[2].split(',').map(Number) : [146,170,190,210,230];
for (const h of H) {
  C.tune({ GOAL_H: h });
  let goals=0, N=10;
  for(let s=0;s<N;s++){ const m=play(3,3,1000+s*13); goals+=m.score[0]+m.score[1]; }
  let hard=0, easy=0, draw=0;
  for(let s=0;s<11;s++){ const m=play(5,0,4000+s*37); if(m.score[0]>m.score[1])hard++; else if(m.score[1]>m.score[0])easy++; else draw++; }
  console.log(`GOAL_H ${String(h).padStart(3)} (player is ~138 tall) → ${(goals/N).toFixed(1)} goals/match | legendary ${hard} : ${easy} very-easy (${draw} draws)`);
}
