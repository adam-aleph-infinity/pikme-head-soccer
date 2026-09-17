// Card faces, cropped, before and after — the fix for "the head centre is not always right
// on my phone".
//
// Top row (red) is the crop the client used to do: the anchor as measured. Bottom row (green)
// is head-crop.js, the module it uses now. Pass SAMPLE=legendary_3,common_22,... to choose
// which cards; the default is the five worst offenders.
//
//   node _face-shots.mjs                                    the worst five
//   SAMPLE=$(...) node _face-shots.mjs                      any list
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/faces`, CDP = 9511;
mkdirSync(OUT, { recursive: true });
const ch=spawn(CHROME,[`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars',`--user-data-dir=${OUT}/fprof`,'about:blank'],{stdio:'ignore'});
let t;for(let i=0;i<60&&!t;i++){await sleep(200);try{t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page');}catch{}}
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r;});
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);}};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:640,deviceScaleFactor:2,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:3020/?diff=3&solo=1'});
await sleep(2600);
if (process.env.SAMPLE) await ev(`window.__SAMPLE = ${JSON.stringify(process.env.SAMPLE.split(','))}`);
// The five worst offenders, cropped both ways, side by side.
await ev(`(() => {
  const worst = (window.__SAMPLE || ['legendary_34','legendary_24','common_32','common_33','common_22','legendary_3']);
  const box = document.createElement('div');
  box.id = 'facelab';
  box.style.cssText = 'position:fixed;inset:0;background:#0b1020;z-index:99;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:12px;align-content:center';
  document.body.appendChild(box);
  const A = window.__ANCHORS;
  for (const id of worst) {
    const [r, n] = id.split('_');
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;color:#dfe7ff;font:600 11px sans-serif';
    for (const mode of ['before','after']) {
      const el = document.createElement('div');
      el.style.cssText = 'width:96px;height:96px;border-radius:14px;overflow:hidden;background:#000;border:2px solid ' + (mode === 'after' ? '#46d17f' : '#ff5c7a');
      const a = A.heads[id], cw = A.cardW, ch2 = A.cardH, S = 96;
      el.style.backgroundImage = 'url("https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards/' + r + '/' + n + '.webp")';
      if (mode === 'before') {
        // The ORIGINAL maths, kept verbatim, so the comparison is against what shipped.
        const rend = S/a.d;
        el.style.backgroundSize = rend + 'px ' + (rend*(ch2/cw)) + 'px';
        el.style.backgroundPosition = (S/2 - a.cx*rend) + 'px ' + (S/2 - a.cy*rend*(ch2/cw)) + 'px';
      } else {
        // The REAL function the client now uses — not a copy of it, or this compares nothing.
        const c = window.headCrop(a, cw, ch2, S);
        el.style.backgroundSize = c.width + 'px ' + c.height + 'px';
        el.style.backgroundPosition = c.x + 'px ' + c.y + 'px';
      }
      el.style.backgroundRepeat = 'no-repeat';
      cell.appendChild(el);
    }
    const cap = document.createElement('span'); cap.textContent = id; cell.appendChild(cap);
    box.appendChild(cell);
  }
})()`);
await sleep(2500);
writeFileSync(`${OUT}/faces.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('shot written');
ch.kill();
