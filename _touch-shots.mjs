// The controls, driven by real touches — the two things Adam reported on his phone: the walk
// buttons "seem to get stuck", and they "sometimes open a magnifier".
//
// Both came from treating a thumb like a mouse. A thumb drifts while it holds, and the old
// handler released on pointerleave, so the direction died mid-hold; the magnifier is iOS
// deciding a long press on a ◀ glyph means "select this text". Neither is reproducible by
// clicking, which is why this file dispatches touch sequences instead.
//
//   node _touch-shots.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const CDP = 9515, OUT = process.env.SHOT_OUT || '/tmp/hs-touch';
const BASE = process.env.BASE || 'http://127.0.0.1:3020';
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars',`--user-data-dir=${OUT}/prof`,'about:blank'],{stdio:'ignore'});
let t;for(let i=0;i<60&&!t;i++){await sleep(200);try{t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page');}catch{}}
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r;});
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);} if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||'');};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
const fails=[];const ok=(n,c,e='')=>{console.log(`  ${c?'✓':'✗'} ${n}${e?'  — '+e:''}`);if(!c)fails.push(n);};
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts });

await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:3,mobile:true});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate',{url:`${BASE}/?me=legendary_3&foe=legendary_2&diff=3&solo=1&play=1`});
await sleep(2800);

const centre = async (k) => await ev(`(() => { const b = document.querySelector('.pad .btn[data-k="${k}"]').getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; })()`);
const heldKeys = async () => await ev(`JSON.stringify(Object.entries(HELD).filter(([, v]) => v).map(([k]) => k))`);

const left = await centre('left'), jump = await centre('jump');

// ── 1. A HELD DIRECTION SURVIVES A DRIFTING THUMB ────────────────────────────
await touch('touchStart', [{ x: left.x, y: left.y, id: 1 }]);
await sleep(80);
ok('a press holds the direction', (await heldKeys()).includes('left'), await heldKeys());
// Roll the thumb off the edge of the button — this is what a thumb does, and what used to
// release the key while the finger was still down.
await touch('touchMove', [{ x: left.x + left.w * 0.9, y: left.y - left.h * 0.9, id: 1 }]);
await sleep(120);
ok('and keeps it when the thumb rolls off the button',
   (await heldKeys()).includes('left'), await heldKeys());
await touch('touchEnd', []);
await sleep(120);
ok('lifting releases it', !(await heldKeys()).includes('left'), await heldKeys());

// ── 2. A SECOND THUMB CANNOT STEAL THE FIRST ─────────────────────────────────
await touch('touchStart', [{ x: left.x, y: left.y, id: 1 }]);
await sleep(60);
await touch('touchStart', [{ x: left.x, y: left.y, id: 1 }, { x: jump.x, y: jump.y, id: 2 }]);
await sleep(80);
const both = await heldKeys();
ok('two thumbs hold two buttons', both.includes('left') && both.includes('jump'), both);
// Lift only the jump finger. CDP's touchEnd takes the points that ENDED, not the ones still
// down — passing the survivor lifts the wrong finger, which is how this check first "failed".
await touch('touchEnd', [{ x: jump.x, y: jump.y, id: 2 }]);
await sleep(100);
const after = await heldKeys();
ok('lifting one leaves the other held', after.includes('left') && !after.includes('jump'), after);
await touch('touchEnd', []);
await sleep(100);
ok('and nothing is left held', (await heldKeys()) === '[]', await heldKeys());

// ── 3. A CANCELLED TOUCH DOES NOT STICK ──────────────────────────────────────
await touch('touchStart', [{ x: left.x, y: left.y, id: 7 }]);
await sleep(60);
await touch('touchCancel', []);
await sleep(120);
ok('a cancelled touch releases the key', (await heldKeys()) === '[]', await heldKeys());

// ── 4. NO TEXT SELECTION TO MAGNIFY ──────────────────────────────────────────
const css = await ev(`(() => { const b = document.querySelector('.pad .btn[data-k="left"]');
  const s = getComputedStyle(b);
  return { callout: s.webkitTouchCallout || s.getPropertyValue('-webkit-touch-callout'),
           select: s.webkitUserSelect || s.userSelect, touch: s.touchAction }; })()`);
// -webkit-touch-callout is a WebKit property. Chrome does not implement it, so it computes
// to "" here no matter what the stylesheet says — the RULE is what ships to an iPhone, so the
// rule is what gets checked. (Chrome running this file cannot prove iOS behaviour; it can
// prove the declaration is present and not typo'd.)
// …and it cannot be read out of the CSSOM either: Blink drops declarations it does not
// implement, so `cssText` has no trace of it. So the SHIPPED FILE is what gets checked —
// fetched from the same server the phone loads it from. (Escaping a regex through a template
// string into an evaluate is its own small trap: the first version of this silently matched
// nothing and read as a missing declaration.)
const cssDebug = await ev(`fetch('style.css').then(r => r.text()).then((css) => {
  const block = css.match(/\\.pad \\.btn \\{[^}]*\\}/);
  return JSON.stringify({ len: css.length, matched: !!block,
    hasCallout: !!block && block[0].includes('-webkit-touch-callout') });
})`);
ok('the shipped CSS declares -webkit-touch-callout: none (the iOS loupe)',
   /"hasCallout":true/.test(String(cssDebug)), String(cssDebug));
ok('and cannot be text-selected', css.select === 'none', JSON.stringify(css));
ok('and swallows browser gestures', css.touch === 'none', JSON.stringify(css));
// A long press must not select anything anywhere on the pad.
await touch('touchStart', [{ x: left.x, y: left.y, id: 9 }]);
await sleep(900);
const sel = await ev(`String(getSelection()).length`);
await touch('touchEnd', []);
ok('a long press selects no text', sel === 0, `${sel} characters selected`);
ok('and still releases afterwards', (await heldKeys()) === '[]', await heldKeys());

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(fails.length ? `_touch-shots: ${fails.length} FAILED — ${fails.join('; ')}` : '_touch-shots: all checks passed');
ch.kill();
process.exit(fails.length ? 1 : 0);
