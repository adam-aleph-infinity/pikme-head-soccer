// Shoot each art direction twice, two seconds apart, so the motion is provable rather than
// asserted. The time is pinned via ?t= instead of "wait 2 real seconds", because a dropped
// frame or a slow paint would otherwise silently make the two shots identical.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = process.env.PORT || 3020, CDP = 9479;
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-adamleeperelman-Documents-pikeme/09ade469-cc19-4722-96c1-c6973e0f4a82/scratchpad/artdir';
mkdirSync(OUT, { recursive: true });
const IDS = (process.env.IDS || 'neon,reef,orbit,luna').split(',');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push(m.params.entry.text);
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
await send('Page.enable'); await send('Log.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });
for (const dirId of IDS) {
  for (const [when, suffix] of [[8, ''], [10, '-b']]) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/_art.html?only=${dirId}&t=${when}` });
    await sleep(900);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    if (s?.data) writeFileSync(`${OUT}/${dirId}${suffix}.png`, Buffer.from(s.data, 'base64'));
    else console.log('NO DATA', dirId, suffix);
  }
  console.log('shot', dirId);
}
if (errs.length) console.log('CONSOLE ERRORS:\n' + [...new Set(errs)].join('\n'));
ws.close(); chrome.kill();
