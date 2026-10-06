// One page, one screenshot: node _page-shot.mjs <path-on-server> <out.png> [width] [height] [wait-ms]
// For the dev pages (public/_symbol.html, public/_kit.html) and any quick look at a screen.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const [path = '/', out = '.shots/page.png', w = '1280', h = '720', wait = '1200'] = process.argv.slice(2);
const PORT = Number(process.env.PORT || 3031), CDP = 9431;
await ensureServer(PORT);
const prof = `${import.meta.dirname}/.shots/page-prof`;
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
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
await sleep(+wait);
const shot = await send('Page.captureScreenshot', { format: 'png' });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`${out}${errs.length ? '  — page errors: ' + errs.join(' | ') : ''}`);
chrome.kill(); process.exit(errs.length ? 1 : 0);
