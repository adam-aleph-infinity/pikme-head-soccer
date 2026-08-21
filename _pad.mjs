// Shoot the touch pad across device sizes, so "it scales" is measured rather than asserted.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = process.env.PORT || 3020, CDP = 9478;
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-adamleeperelman-Documents-pikeme/804b6db3-a3c7-4f5a-8329-32cb1d4a0836/scratchpad/pad';
mkdirSync(OUT, { recursive: true });
const DEVICES = [
  ['se-land',    667, 375, 2],
  ['ip13-land',  844, 390, 3],
  ['ipmax-land', 932, 430, 3],
  ['ipad-land', 1080, 810, 2],
  ['ip13-port',  390, 844, 3],
];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
await send('Page.enable'); await send('Runtime.enable');
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;
let bad = 0;
for (const [name, w, h, dpr] of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?solo=1&play=1&pad=1&me=legendary_3&foe=legendary_2` });
  await sleep(2400);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
  const m = JSON.parse(await evalJs(`(()=>{const btns=[...document.querySelectorAll('.pad .btn')].map(b=>{const r=b.getBoundingClientRect();
      return {k:b.dataset.k,x:r.left,y:r.top,w:r.width,h:r.height};});
    const st=document.getElementById('stage').getBoundingClientRect();
    return JSON.stringify({btns,stage:{x:st.left,y:st.top,w:st.width,h:st.height}});})()`));
  const fail = [];
  // Every button must be a real touch target, must sit inside the pitch, and must not
  // overlap its neighbour — the three ways a scaled pad breaks on a device you don't own.
  for (const b of m.btns) {
    if (Math.min(b.w, b.h) < 44) fail.push(`${b.k} ${Math.round(Math.min(b.w,b.h))}px < 44pt`);
    if (b.x < m.stage.x - 0.5 || b.y < m.stage.y - 0.5 ||
        b.x + b.w > m.stage.x + m.stage.w + 0.5 || b.y + b.h > m.stage.y + m.stage.h + 0.5)
      fail.push(`${b.k} outside stage`);
  }
  for (const a of m.btns) for (const b of m.btns) {
    if (a === b || a.k >= b.k) continue;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) fail.push(`${a.k}/${b.k} overlap`);
  }
  const u = Math.round(m.btns[0]?.h || 0);
  console.log(`${name.padEnd(11)} ${w}x${h}@${dpr}  u=${u}px  ${fail.length ? 'FAIL ' + fail.join(', ') : 'ok'}`);
  if (fail.length) bad++;
}
ws.close(); chrome.kill();
console.log(bad ? `\n${bad} device(s) FAILED` : '\nall device profiles ok');
process.exit(bad ? 1 : 0);
