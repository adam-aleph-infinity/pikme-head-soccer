// Do the backdrops animate IN A MATCH? The preview page proving it is not the same claim:
// the real game draws through a different path, at half resolution, with the sim running.
// Frames are captured from a live match with the bot and spectacle frozen, so anything that
// changes between them is the BACKDROP moving and not the football.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = process.env.PORT || 3020, CDP = 9491;
const OUT = `${import.meta.dirname}/.shots/motion-live`;
mkdirSync(OUT, { recursive: true });
const IDS = ['neon', 'reef', 'orbit', 'luna', 'japan', 'china'];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let tgt; for (let i = 0; i < 60 && !tgt; i++) { await sleep(200); try { tgt = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true }))?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });
const fails = [];
console.log('backdrop    live-match frame diffs (%)');
for (const did of IDS) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=${did}&solo=1&play=1&me=legendary_3&foe=legendary_2` });
  await sleep(2600);
  const got = await ev('STAGE && STAGE.id');
  const shots = [];
  for (let i = 0; i < 4; i++) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = `${OUT}/${did}-${i}.png`; writeFileSync(f, Buffer.from(s.data, 'base64')); shots.push(f);
    await sleep(700);
  }
  const pcts = [];
  for (let i = 1; i < shots.length; i++) {
    let n = 0;
    try { execSync(`magick compare -metric AE -fuzz 2% "${shots[i-1]}" "${shots[i]}" null: 2>&1`, { encoding: 'utf8' }); }
    catch (e) { n = parseInt(String(e.stdout || e.stderr || '0').trim(), 10) || 0; }
    pcts.push((n / (900 * 500)) * 100);
  }
  const min = Math.min(...pcts);
  const ok = got === did && min > 0.5;
  console.log(`${did.padEnd(10)} ${pcts.map(p=>p.toFixed(1).padStart(5)).join(' ')}   min ${min.toFixed(1)}%  loaded=${got}  ${ok ? '✓' : '✗'}`);
  if (!ok) fails.push(did);
}
ws.close(); chrome.kill();
console.log(fails.length ? `\n_motion-live: FAILED ${fails.join(', ')}` : '\n_motion-live: all backdrops animate inside a real match');
process.exit(fails.length ? 1 : 0);
