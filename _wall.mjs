// Wall test: can a defender actually stop shots? Separates "physics has a hole"
// from "the bot is out of position", which the match census can't tell apart.
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const mode = process.argv[2] || 'static';   // static | bot
let shots=0, goals=0; const holes=[];
for (const speed of [400,600,800,1000,1250]) {
  for (const ang of [-50,-35,-20,-8,0,8,20]) {
    for (const fromY of [200,300,400,455]) {
      const m = createMatch({rarity:'legendary',number:3},{rarity:'legendary',number:2},{duration:30});
      m.freeze=0; m.phase='play';
      const d = m.players[0];                       // defends the LEFT goal
      d.x = mode==='static' ? C.GOAL_W + C.BODY_W/2 : 300;
      const rng = mulberry32(7); const bot = createBot(4, rng);
      const b=m.ball; b.x=520; b.y=fromY;
      const r=ang*Math.PI/180; b.vx=-speed*Math.cos(r); b.vy=speed*Math.sin(r);
      m.players[1].x = C.W-C.GOAL_W-C.BODY_W/2;     // attacker parked out of the way
      let scored=false;
      for(let i=0;i<180;i++){
        const inp = mode==='static' ? [{},{}] : [botInput(bot,m,0,C.TICK),{}];
        step(m,inp);
        if (m.events.some(e=>e.type==='goal')) { scored=true; }
        m.events.length=0;
        if (scored || m.ball.x>560) break;
      }
      shots++; if(scored){goals++; holes.push(`${speed}@${ang}°from y${fromY}`);}
    }
  }
}
console.log(`${mode}: ${goals}/${shots} shots scored (${(100*goals/shots).toFixed(0)}%)`);
if (holes.length) console.log('  leaks:', holes.slice(0,18).join('  '), holes.length>18?`… +${holes.length-18}`:'');
