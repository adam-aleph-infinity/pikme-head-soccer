// Photograph the four specials in the real client. A dart you cannot see coming is not a
// dodgeable dart, and a dog that reads as a brown smear is not a hurdle — these four are the
// only powers that put an OBJECT on the pitch, so each one has to be legible in the half
// second you have to react to it.
//
//   node _skill-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const OUT = process.env.SHOT_OUT || '/tmp/hs-skills', CDP = 9509;
const BASE = process.env.BASE || 'http://127.0.0.1:3020';
mkdirSync(OUT, { recursive: true });
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars','--force-device-scale-factor=1',`--user-data-dir=${OUT}/prof`,'about:blank'],{stdio:'ignore'});
let t;for(let i=0;i<60&&!t;i++){await sleep(200);try{t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page');}catch{}}
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r;});
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);}
  if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text);};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
const fails=[];const ok=(n,c,e='')=>{console.log(`  ${c?'✓':'✗'} ${n}${e?'  — '+e:''}`); if(!c) fails.push(n);};
const shot=async(n)=>{const s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(`${OUT}/${n}.png`, Buffer.from(s.data,'base64'));};
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:900,height:620,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:`${BASE}/?me=legendary_3&foe=legendary_2&diff=3&solo=1&play=1&stage=neon`});
await sleep(2800);
// A pixel probe on the canvas, the same one the pickup harness uses.
await ev(`window.__px = (wx, wy, ww, wh) => {
  const c = document.getElementById('cv'); const P = 2;
  const d = c.getContext('2d').getImageData(Math.round(wx/P), Math.round(wy/P), Math.max(1,Math.round(ww/P)), Math.max(1,Math.round(wh/P))).data;
  let r=0,g=0,b=0,n=0; for (let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
  return { r:r/n, g:g/n, b:b/n };
}; window.__hold = () => { MATCH.phase='goal'; MATCH.freeze=9; }; true`);
ok('the client knows about the specials', (await ev('!!(window.MATCH && MATCH.sk)')) === true);

const redness = (p) => p.r - (p.g + p.b) / 2;

// THE DART, parked mid-flight.
await ev(`(() => { const s = MATCH.sk.dart; s.on=1; s.by=0; s.x=520; s.y=MATCH.players[0].y-70; s.vx=500; s.life=200; window.__hold(); })()`);
await sleep(200);
// The dart's OWN box, not a generous window round it: it is 10x8 world px, so a 44x16 probe
// averages it away against the backdrop and reads as "no dart" even when one is drawn.
let px = await ev('__px(515, MATCH.sk.dart.y - 4, 12, 8)');
ok('a dart is on the pitch and it is pink', redness(px) > 25, JSON.stringify(px));
await shot('01-dart');

// THE DOG, on the ground line.
await ev(`(() => { const d = MATCH.sk.dog; d.on=1; d.by=0; d.x=520; d.vx=200; d.life=300; MATCH.sk.dart.on=0; })()`);
await sleep(200);
px = await ev('__px(496, C.GROUND_Y-30, 56, 26)');
ok('a dog is on the ground and it is brown', px.r > px.b + 30 && px.g > px.b, JSON.stringify(px));
await shot('02-dog');

// THE GOAL WALL, across a mouth.
await ev(`(() => { MATCH.sk.dog.on=0; MATCH.sk.wall[0]=90; })()`);
await sleep(200);
const wallPx = await ev('__px(4, C.GROUND_Y-C.GOAL_H+20, C.GOAL_W-8, 60)');
const barePx = await ev('__px(C.W-C.GOAL_W+4, C.GROUND_Y-C.GOAL_H+20, C.GOAL_W-8, 60)');
ok('the defended goal is visibly shut, the other is not',
   wallPx.b > barePx.b + 20, `${JSON.stringify(wallPx)} vs bare ${JSON.stringify(barePx)}`);
await shot('03-goalwall');

// THE ARMED SUPER KICK — a ring on the player about to throw one.
await ev(`(() => { MATCH.sk.wall[0]=0; MATCH.sk.sup[0]=200; })()`);
await sleep(200);
const ring = await ev('__px(MATCH.players[0].x-26, MATCH.players[0].y-30, 52, 34)');
ok('an armed super kick shows on the player', redness(ring) > 8, JSON.stringify(ring));
await shot('04-superkick');

ok('no page exceptions', errs.length === 0, errs.slice(0,2).join(' | '));
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_skill-shots: ${fails.length} FAILED — ${fails.join('; ')}` : '_skill-shots: all checks passed');
ch.kill();
process.exit(fails.length ? 1 : 0);
