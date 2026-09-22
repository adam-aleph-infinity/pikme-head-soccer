// THE SPRITE, BIG ENOUGH TO ARGUE ABOUT.
//
// A body is 79px tall and its boot 23px long, so a match screenshot cannot settle whether a
// foot reads as a football boot or as a plank. This loads the real client, calls the real
// drawBody (exported on window for exactly this), and paints it at 8x onto a strip: both
// teams, both facings, standing and mid-kick.
//
//   node _bootshots.mjs            → .shots/boots/boots.png
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const CHROME = chromePath();
const PORT = process.env.PORT || 3020, CDP = 9481;
await ensureServer(PORT);
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/boots`;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME,
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1260, height: 744, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?solo=1` });
await sleep(1500);

// The poses: [team, facing, how far through a kick]. drawBody reads kickT off the player, so
// a kick is staged by handing it one rather than by waiting for the bot to swing.
const strip = `(() => {
  const Z = 6, CW = 70, CH = 62, COLS = 3;
  const POSES = [[0,1,0],[0,1,.5],[0,-1,0],[1,-1,0],[1,-1,.5],[1,1,0]];
  const cv = document.createElement('canvas');
  cv.width = CW * Z * COLS; cv.height = CH * Z * Math.ceil(POSES.length / COLS);
  cv.style.cssText = 'position:fixed;inset:0;z-index:99999;image-rendering:pixelated';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#2f7d4a'; g.fillRect(0, 0, cv.width, cv.height);
  POSES.forEach((pose, i) => {
    const [index, side, kick] = pose;
    g.save();
    g.scale(Z, Z);
    // drawBody projects off depthPoint and pins the feet to GROUND_Y, so the cell is moved
    // under the sprite rather than the sprite into the cell.
    const col = i % COLS, row = (i / COLS) | 0;
    g.translate(col * CW - 200 + CW / 2, row * CH - window.C.GROUND_Y + CH - 8);
    window.drawBody(g, {
      index, side, x: 200, y: window.C.GROUND_Y, vx: 0, vy: 0, onGround: true,
      stunned: 0, hp: 1, kickT: kick * window.C.KICK_TIME, gauge: 0, stats: { kick: 1 },
    });
    g.restore();
  });
  return cv.width + 'x' + cv.height;
})()`;
console.log('strip', await evalJs(strip));
await sleep(300);
const s = await send('Page.captureScreenshot', { format: 'png' });
if (s?.data) { writeFileSync(`${OUT}/boots.png`, Buffer.from(s.data, 'base64')); console.log(`shot → ${OUT}/boots.png`); }
else console.log('NO DATA');
if (errs.length) console.log('ERRORS:\n' + [...new Set(errs)].join('\n'));
ws.close(); chrome.kill();
