import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
const PORT = 3077, CDP = 9477, OUT = '/private/tmp/claude-502/-Users-worker-Documents-GitHub-pikme-head-soccer/c548f449-86e7-4dfa-a8ab-69ed2bde3183/scratchpad';
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(1200);
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let up; for (let i = 0; i < 60 && !up; i++) { await sleep(200); try { up = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); } catch {} }
async function tab(url) {
  const t = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 1, mobile: false });
  return { send, ev };
}
const A = await tab(`http://127.0.0.1:${PORT}/?arcade`);
const B = await tab(`http://127.0.0.1:${PORT}/`);
await sleep(3000);
console.log('stats', JSON.stringify(await (await fetch(`http://127.0.0.1:${PORT}/stats`)).json()));
await B.ev("document.querySelector('#playBtn').click(); document.querySelector('#modeMulti').click(); 1");
await sleep(500);
console.log('B card text:', await B.ev("document.querySelector('#modeSel .online-count').textContent"));
console.log('A arcade visible:', await A.ev("!document.querySelector('#arcade').classList.contains('hidden')"));
const s = await B.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/online.png`, Buffer.from(s.data, 'base64'));
chrome.kill(); srv.kill(); process.exit(0);
