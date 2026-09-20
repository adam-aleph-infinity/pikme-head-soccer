// Goal census: classify every goal in N bot matches so tuning targets the real cause.
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const L=(process.argv[2]||'3,3').split(',').map(Number), N=+(process.argv[3]||8);
const rows=[];
for(let s=0;s<N;s++){
  const rng=mulberry32(1000+s*13);
  const m=createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{});
  const bots=[createBot(L[0],rng),createBot(L[1],rng)];
  let t=0,prev=null;
  while(m.phase!=='over'&&t<12000){
    prev={by:m.ball.y,vx:m.ball.vx,px:[m.players[0].x,m.players[1].x],kn:[m.players[0].stunned,m.players[1].stunned]};
    step(m,[botInput(bots[0],m,0,C.TICK),botInput(bots[1],m,1,C.TICK)]);
    for(const e of m.events) if(e.type==='goal'){
      const c=1-e.player, goalX=c===0?C.GOAL_W:C.W-C.GOAL_W;
      const headTop=C.GROUND_Y-C.BODY_H-2*C.HEAD_R+8;
      rows.push({pw:!!e.power, dist:Math.abs(prev.px[c]-goalX), lob:prev.by<headTop, stunned:prev.kn[c]>0, spd:Math.abs(prev.vx)});
    }
    m.events.length=0;t++;
  }
}
const n=rows.length, pct=(f)=>`${(100*rows.filter(f).length/n).toFixed(0)}%`;
const med=(f)=>{const a=rows.map(f).sort((x,y)=>x-y);return a[Math.floor(a.length/2)].toFixed(0);};
console.log(`levels ${L.join('v')} — ${n} goals in ${N} matches (${(n/N).toFixed(1)}/match)`);
console.log(`  power shot .......... ${pct(r=>r.pw)}`);
console.log(`  defender stunned .... ${pct(r=>r.stunned)}`);
console.log(`  lobbed over the head. ${pct(r=>r.lob)}`);
console.log(`  defender AT the line  ${pct(r=>r.dist<45)}   |  out of position (>200px): ${pct(r=>r.dist>200)}`);
console.log(`  median conceder dist  ${med(r=>r.dist)}px   |  median ball speed ${med(r=>r.spd)}px/s`);

// --- how long after a restart do goals arrive? ---
{
  const rng=mulberry32(1000);
  const m=createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{});
  const bots=[createBot(3,rng),createBot(3,rng)];
  let t=0,sinceRestart=0; const gaps=[]; let touchesSince=0;
  while(m.phase!=='over'&&t<12000){
    const wasFrozen=m.freeze>0;
    step(m,[botInput(bots[0],m,0,C.TICK),botInput(bots[1],m,1,C.TICK)]);
    if(m.freeze<=0&&!wasFrozen) sinceRestart+=C.TICK; else if(m.freeze>0&&!wasFrozen) {} 
    if(m.phase==='play') sinceRestart+=C.TICK;
    for(const e of m.events){
      if(e.type==='strike') touchesSince++;
      if(e.type==='goal'){ gaps.push({s:+sinceRestart.toFixed(1),touches:touchesSince}); sinceRestart=0; touchesSince=0; }
    }
    m.events.length=0;t++;
  }
  const s=gaps.map(g=>g.s).sort((a,b)=>a-b), tc=gaps.map(g=>g.touches).sort((a,b)=>a-b);
  console.log(`  time between goals: median ${s[Math.floor(s.length/2)]}s  (min ${s[0]}s, max ${s[s.length-1]}s)`);
  console.log(`  ball touches between goals: median ${tc[Math.floor(tc.length/2)]}`);
  console.log(`  goals within 3s of a restart: ${gaps.filter(g=>g.s<3).length}/${gaps.length}`);
}
