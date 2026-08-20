// Headless bot-vs-bot sampler: is the goal rate anywhere near a real Head Soccer match?
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const L = process.argv[2] ? process.argv[2].split(',').map(Number) : [3,3];
let tot=0, ps=0, ctr=0, kn=0, n=12, wall=[];
for (let s=0;s<n;s++){
  const rng=mulberry32(1000+s*13);
  const m=createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{});
  const bots=[createBot(L[0],rng),createBot(L[1],rng)];
  let t=0;
  while(m.phase!=='over'&&t<12000){
    step(m,[botInput(bots[0],m,0,C.TICK),botInput(bots[1],m,1,C.TICK)]);
    for(const e of m.events){if(e.type==='powershot')ps++;if(e.type==='counter')ctr++;if(e.type==='knocked')kn++;}
    m.events.length=0;t++;
  }
  tot+=m.score[0]+m.score[1]; wall.push((t*C.TICK).toFixed(0));
  if(s<4) console.log(`  seed${s}: ${m.score.join('-')} phase=${m.phase} wall=${(t*C.TICK).toFixed(0)}s`);
}
console.log(`levels ${L.join(' vs ')}: avg goals/match ${(tot/n).toFixed(1)} | powershots/match ${(ps/n).toFixed(1)} | counters ${(ctr/n).toFixed(1)} | knockdowns ${(kn/n).toFixed(1)} | wall ${wall.join(',')}`);
