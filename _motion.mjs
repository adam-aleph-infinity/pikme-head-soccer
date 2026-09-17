// PROVE the backdrops animate — do not eyeball it.
//
// Each direction is rendered at a series of PINNED times and consecutive frames are diffed
// pixel by pixel. A "moving system" that was coded but never actually advances looks
// completely correct in a single screenshot; only a frame diff catches it. Reports the
// share of pixels that changed between frames, and which region of the frame they were in,
// so a backdrop that only animates one small corner cannot pass as fully alive.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs

const PORT = process.env.PORT || 3020, CDP = 9488;
await ensureServer(PORT);   // starts one only if nothing is listening
const OUT = `${import.meta.dirname}/.shots/motion`;
mkdirSync(OUT, { recursive: true });
const IDS = ['neon', 'reef', 'orbit', 'luna'];
const TIMES = [0, 1.5, 3, 4.5, 6, 9];

const chrome = spawn(CHROME,
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
   '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'],
  { stdio: 'ignore' });
let tgt; for (let i = 0; i < 60 && !tgt; i++) { await sleep(200); try { tgt = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });

const fails = [];
console.log('direction   frame-to-frame pixels changed');
for (const did of IDS) {
  const shots = [];
  for (const t of TIMES) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/_art.html?only=${did}&t=${t}` });
    await sleep(1500);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = `${OUT}/${did}-${String(t).replace('.', '_')}.png`;
    writeFileSync(f, Buffer.from(s.data, 'base64'));
    shots.push(f);
  }
  // Consecutive-frame diff. AE = count of differing pixels; fuzz absorbs encoder noise.
  const pcts = [];
  for (let i = 1; i < shots.length; i++) {
    let n = 0;
    try {
      execSync(`magick compare -metric AE -fuzz 2% "${shots[i - 1]}" "${shots[i]}" null: 2>&1`, { encoding: 'utf8' });
    } catch (e) { n = parseInt(String(e.stdout || e.stderr || '0').trim(), 10) || 0; }
    pcts.push((n / (900 * 500)) * 100);
  }
  const min = Math.min(...pcts), avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const line = pcts.map(p => p.toFixed(1).padStart(5)).join(' ');
  const ok = min > 0.5;                      // every interval must move, not just one
  console.log(`${did.padEnd(10)} ${line}   avg ${avg.toFixed(1)}%  min ${min.toFixed(1)}%  ${ok ? '✓' : '✗ A FRAME IS STATIC'}`);
  if (!ok) fails.push(did);
}
ws.close(); chrome.kill();
console.log(fails.length ? `\n_motion: ${fails.length} FAILED: ${fails.join(', ')}` : '\n_motion: every direction animates in every interval');
process.exit(fails.length ? 1 : 0);
