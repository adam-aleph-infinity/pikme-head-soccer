// Does the game FIT the phone, and can a player tell the two modes apart?
//
// Three things Adam asked for after playing it in the app, and all three are claims about a
// real viewport, so they are checked in one: the two-mode pick screen, the letterbox, and —
// the reason this file is not just a screenshot — that cropping the canvas did not slide the
// DOM heads off their bodies.
//
//   node _fit-shots.mjs        (server on 3020)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const OUT = process.env.SHOT_OUT || '/tmp/hs-fit', CDP = 9499;
// Defaults to the local server; BASE=https://pikme-headsoccer.onrender.com checks what the
// app actually loads, which is the only version that matters to a tester.
const BASE = process.env.BASE || 'http://127.0.0.1:3020';
mkdirSync(OUT, { recursive: true });
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars',`--user-data-dir=${OUT}/fitprof`,'about:blank'],{stdio:'ignore'});
let t; for(let i=0;i<60&&!t;i++){ await sleep(200); try{ t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page'); }catch{} }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>{ws.onopen=r;});
let id=0; const pend=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);}};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
const ok=(n,c,e='')=>console.log(`  ${c?'✓':'✗'} ${n}${e?'  — '+e:''}`);
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:`${BASE}/?diff=3&solo=1`});
await sleep(2600);
ok('the pick screen offers two modes',
   (await ev(`[...document.querySelectorAll('#modes button')].map(b=>b.dataset.mode).join(',')`)) === 'bot,duo');
ok('bot mode shows difficulty and hides the link buttons',
   (await ev(`getComputedStyle(document.getElementById('hostBtn')).display === 'none' && getComputedStyle(document.querySelector('.diff')).display !== 'none'`)) === true);
await ev(`document.querySelector('#modes [data-mode="duo"]').click()`);
await sleep(200);
ok('1v1 mode swaps to the link buttons',
   (await ev(`getComputedStyle(document.getElementById('hostBtn')).display !== 'none' && getComputedStyle(document.querySelector('.diff')).display === 'none'`)) === true);
ok('and stops you picking a card for the opponent',
   (await ev(`getComputedStyle(document.getElementById('slotFoe')).pointerEvents === 'none'`)) === true);
writeFileSync(`${OUT}/fit-duo.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await ev(`document.querySelector('#modes [data-mode="bot"]').click()`);
await sleep(200);
// the mode has to survive a reload or it is not a preference
await send('Page.navigate',{url:`${BASE}/?diff=3&solo=1`});
await sleep(2400);
ok('the chosen mode is remembered', (await ev('document.body.dataset.mode')) === 'bot');
await ev('startMatch()');
await sleep(2200);
const bar = await ev(`(() => { const b = getComputedStyle(document.body).backgroundColor;
  const st = document.getElementById('stage').getBoundingClientRect();
  return { bg: b, stageW: Math.round(st.width), stageH: Math.round(st.height), vw: innerWidth, vh: innerHeight }; })()`);
ok('the bars are painted with the backdrop, not black',
   bar.bg !== 'rgb(9, 12, 20)' && bar.bg !== 'rgba(0, 0, 0, 0)', `body ${bar.bg}, stage ${bar.stageW}x${bar.stageH} in ${bar.vw}x${bar.vh}`);
// THE OVERLAY TRAP. The heads are DOM nodes over the canvas, so cropping the canvas without
// threading the same offset through them silently slides both faces off their bodies. Checked
// against the canvas's REAL rect rather than against the page's own OX/OY, so the check
// cannot agree with the bug.
const align = await ev(`(() => {
  const cv = document.getElementById('cv').getBoundingClientRect();
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p = MATCH.players[i];
    const el = document.getElementById('head' + i).getBoundingClientRect();
    const wantX = cv.left + (p.x / C.W) * cv.width;
    const wantY = cv.top + ((p.y - 40 - 30 + 8) / C.H) * cv.height;   // headY(p), same formula
    out.push({ dx: (el.left + el.width / 2) - wantX, dy: (el.top + el.height / 2) - wantY });
  }
  return out;
})()`);
ok('both heads sit on their bodies after the crop',
   align.every((a) => Math.abs(a.dx) < 6 && Math.abs(a.dy) < 12),
   align.map((a) => `dx=${a.dx.toFixed(1)} dy=${a.dy.toFixed(1)}`).join('  '));
// And the pad has to still be inside the frame, not pushed off with the canvas.
const padFit = await ev(`(() => { const r = [...document.querySelectorAll('.pad .btn')].map(b => b.getBoundingClientRect());
  return { inside: r.every(x => x.bottom <= innerHeight + 1 && x.left >= -1 && x.right <= innerWidth + 1), n: r.length }; })()`);
ok('every control is still inside the screen', padFit.inside && padFit.n === 8, JSON.stringify(padFit));
writeFileSync(`${OUT}/fit-match.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
ch.kill();
console.log(`\nshots → ${OUT}`);
