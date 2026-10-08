// The three HS stadiums in a live match, for a look at the scenery: node _stadium-shots.mjs [tag]
// → .shots/stadium/<tag>-<stage>-<size>.png (a phone at 3x and a desktop at 1x)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const tag = process.argv[2] || 'now';
const PORT = Number(process.env.PORT || 3034), CDP = 9434;
await ensureServer(PORT);
const prof = `${import.meta.dirname}/.shots/stadium-prof`;
rmSync(prof, { recursive: true, force: true });
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
let t;
for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description); };
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Runtime.enable');
const out = `${import.meta.dirname}/.shots/stadium`;
mkdirSync(out, { recursive: true });
for (const [size, w, h, dpr] of [['phone', 844, 390, 3], ['desk', 1440, 800, 1]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: dpr > 1 });
  for (const st of ['hs-day', 'hs-night', 'hs-arena']) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?play=1&solo=1&nointro&stage=${st}` });
    await sleep(3500);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${out}/${tag}-${st}-${size}.png`, Buffer.from(s.data, 'base64'));
  }
}
console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no errors', '→', out);
chrome.kill(); process.exit(0);
