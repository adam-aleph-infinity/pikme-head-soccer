// An animation, frame by frame: node _frames.mjs <path> <js-to-run> <out.png> [frames=8] [every-ms=150] [w=844] [h=390]
// Loads the page, runs the JS (e.g. "startArcadeStage(1)"), then screenshots every `every` ms
// and tiles the frames into one sheet (4 across) — for checking the VS intro, the title's
// assembly, a transition, against HS's own frame timings (docs/HS-MENUS.md).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const [path = '/', run = '', out = '.shots/frames.png', n = '8', every = '150', w = '844', h = '390'] = process.argv.slice(2);
const PORT = Number(process.env.PORT || 3032), CDP = 9432;
await ensureServer(PORT);
const tmp = `${import.meta.dirname}/.shots/frames-tmp`;
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars', `--user-data-dir=${tmp}/prof`, 'about:blank'], { stdio: 'ignore' });
let t;
for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
await sleep(1800);
if (run) await send('Runtime.evaluate', { expression: run });
const t0 = Date.now();
for (let i = 0; i < +n; i++) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${tmp}/f${String(i).padStart(2, '0')}.png`, Buffer.from(s.data, 'base64'));
  const next = t0 + (i + 1) * +every;
  await sleep(Math.max(0, next - Date.now()));
}
chrome.kill();
mkdirSync(dirname(out), { recursive: true });
const cols = 4, rows = Math.ceil(+n / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${tmp}/f%02d.png`, '-vf', `scale=${Math.round(1688 / cols)}:-1,tile=${cols}x${rows}`, '-frames:v', '1', out]);
console.log(out);
process.exit(0);
