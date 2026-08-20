// Isolate one dial at a time: how many goals per match as bot aggression varies?
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function run(mut, n=10){
  let g=0, held=0, samples=0;
  for(let s=0;s<n;s++){
    const rng=mulberry32(300+s*17);
    const m=createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{});
    const bots=[createBot(3,rng),createBot(3,rng)];
    bots.forEach(b=>mut(b));
    let t=0;
    while(m.phase!=='over'&&t<14000){
      step(m,[botInput(bots[0],m,0,C.TICK),botInput(bots[1],m,1,C.TICK)]);
      m.events.length=0;t++;
      if(t%10===0){ for(const p of m.players){ const gx=p.side>0?C.GOAL_W:C.W-C.GOAL_W; held+=Math.abs(p.x-gx); samples++; } }
    }
    g+=m.score[0]+m.score[1];
  }
  return {goals:(g/n).toFixed(1), avgDistFromGoal:(held/samples).toFixed(0)};
}
for (const a of [0, 0.15, 0.35, 0.55, 0.7, 0.9]) {
  const r = run(b=>{b.d={...b.d, aggression:a};});
  console.log(`aggression ${a.toFixed(2)} → ${r.goals} goals/match, avg dist from own goal ${r.avgDistFromGoal}px`);
}
