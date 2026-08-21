// Render one screenshot per stage so the whole set can be judged side by side.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = process.env.PORT || 3020, CDP = 9477;
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-adamleeperelman-Documents-pikeme/09ade469-cc19-4722-96c1-c6973e0f4a82/scratchpad/stages';
mkdirSync(OUT, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });
for (const st of ['japan','harbor','china','airbase','jungle','temple','factory']) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=${st}&solo=1&play=1&me=legendary_3&foe=legendary_2` });
  await sleep(2600);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${st}.png`, Buffer.from(s.data, 'base64'));
  console.log('shot', st);
}
ws.close(); chrome.kill();
