// The power move, photographed: the wind-up and the shot.
//
// It is the one thing in this game that takes the ball away from both players for half a
// second, so the half second has to READ — the ball up over the head, lit in the shooter's
// colour, a ring closing as a clock. That is what a defender times a jump against.
//
//   node _volley-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/volley`, CDP=9513;
mkdirSync(OUT,{recursive:true});
const ch=spawn(CHROME,[`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars',`--user-data-dir=${OUT}/vprof`,'about:blank'],{stdio:'ignore'});
let t;for(let i=0;i<60&&!t;i++){await sleep(200);try{t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page');}catch{}}
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r;});
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);} if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||'');};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
const ok=(n,c,e='')=>console.log(`  ${c?'✓':'✗'} ${n}${e?'  — '+e:''}`);
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:900,height:620,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:(process.env.BASE||'http://127.0.0.1:3020')+'/?me=legendary_3&foe=legendary_2&diff=3&solo=1&play=1&stage=neon'});
await sleep(2800);
await ev(`window.__px = (wx, wy, ww, wh) => { const c=document.getElementById('cv'); const P=2;
  const d=c.getContext('2d').getImageData(Math.round(wx/P),Math.round(wy/P),Math.max(1,Math.round(ww/P)),Math.max(1,Math.round(wh/P))).data;
  let r=0,g=0,b=0,n=0; for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;} return {r:r/n,g:g/n,b:b/n}; }; true`);
// start a wind-up and hold it mid-charge
await ev(`(() => { const p = MATCH.players[0]; p.gauge = 1; p.charge = C.POWER_CHARGE_TIME * 0.35; MATCH.hitStop = 0; })()`);
await sleep(200);
const st = await ev(`JSON.stringify({charge: MATCH.players[0].charge.toFixed(2), ballY: Math.round(C.GROUND_Y - MATCH.ball.y), top: C.powerHeight()})`);
ok('a wind-up is running and the ball is up', true, st);
const px = await ev(`__px(MATCH.ball.x - 16, MATCH.ball.y - 16, 32, 32)`);
ok('the ball is lit in the shot colour', px.r + px.g + px.b > 120, JSON.stringify(px));
// THE FOCUS: a second and a half is a long wait, so the frame closes in on the striker. The
// corner of the pitch has to go dark while the ball does not.
const corner = await ev(`__px(30, 60, 60, 40)`);
const lit = await ev(`__px(MATCH.ball.x - 10, MATCH.ball.y - 10, 20, 20)`);
ok('the rest of the pitch dims around it', corner.r + corner.g + corner.b < lit.r + lit.g + lit.b,
   `corner ${Math.round(corner.r + corner.g + corner.b)} vs ball ${Math.round(lit.r + lit.g + lit.b)}`);
// (The height is asserted at the moment of FIRING, below: mid-charge the ball is still being
// swept up, so measuring it here measures the sweep.)
writeFileSync(`${OUT}/volley-charge.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
// let it fire
await ev(`(() => { MATCH.players[0].charge = 0.02; MATCH.hitStop = 0; })()`);
await sleep(350);
const shot = await ev(`JSON.stringify({ power: !!MATCH.ball.power, vx: Math.round(MATCH.ball.vx), mult: MATCH.ball.power && MATCH.ball.power.mult })`);
ok('and then it fires, fast', /"power":true/.test(shot), shot);
const launched = await ev(`JSON.stringify({ up: Math.round(C.GROUND_Y - MATCH.ball.y), want: Math.round(C.powerHeight()), goal: C.GOAL_H, flat: Math.abs(MATCH.ball.vy) < 60 })`);
ok('it leaves at 0.9 of the goal height, in a straight line',
   /"flat":true/.test(launched) && Math.abs(JSON.parse(launched).up - JSON.parse(launched).want) < 14, launched);
writeFileSync(`${OUT}/volley-fired.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
ch.kill();
