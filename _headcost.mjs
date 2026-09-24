// WHAT THE CARTOON HEAD COSTS — frame times of a live match at 4x CPU throttle, per head style.
//
// The pitch heads are DOM nodes carrying a photo, and every look we give them is paid for on
// every frame they move: a clip-path, a CSS filter, an SVG filter. This plays a real match
// (the bot on both sides, both heads moving) on an 844x390 phone with the CPU slowed 4x, and
// records rAF frame intervals for each variant, so a look is only kept if it does not drop
// frames. Variants are injected as a <style> over the live stylesheet.
//
//   node _headcost.mjs          → a table: variant, median / p95 frame ms, % frames over 20 ms
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const PORT = process.env.PORT || 3047, CDP = 9534;
await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/headcost`;
mkdirSync(OUT, { recursive: true });
const chrome = spawn(chromePath(),
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }))?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?diff=3` });
await sleep(2200);
await ev(`(() => {
  // the posterize filter, for the variant that uses it
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute';
  svg.innerHTML = '<filter id="hsPoster" color-interpolation-filters="sRGB"><feComponentTransfer>'
    + ['R','G','B'].map(c => '<feFunc' + c + ' type="discrete" tableValues="0 .2 .4 .6 .8 1"/>').join('')
    + '</feComponentTransfer></filter>';
  document.body.appendChild(svg);
  const st = document.createElement('style'); st.id = 'variant'; document.head.appendChild(st);
  startMatch();
})()`);
await sleep(2500);
await send('Emulation.setCPUThrottlingRate', { rate: 4 });

const VARIANTS = [
  ['circle, no filter (before)', '.head::before,.head>i,.head::after{clip-path:circle(50%)!important}.head>i{filter:none!important}'],
  ['shape, no filter', '.head>i{filter:none!important}'],
  ['shape + CSS filter (live)', ''],
  ['shape + CSS + SVG posterize', '.head>i{filter:saturate(1.35) contrast(1.12) brightness(1.04) url(#hsPoster)!important}'],
];
const rows = [];
for (const [name, css] of VARIANTS) {
  await ev(`document.getElementById('variant').textContent = ${JSON.stringify(css)}; MATCH.phase = 'play'; MATCH.freeze = 0;`);
  await sleep(800);
  const r = await ev(`new Promise((res) => {
    const f = []; let last = performance.now(); const end = last + 5000;
    // keep both heads moving: player one runs back and forth under a script
    const tick = (now) => {
      f.push(now - last); last = now;
      const p = MATCH.players[0]; HELD.left = Math.sin(now / 400) < 0; HELD.right = !HELD.left;
      if (now < end) requestAnimationFrame(tick); else { HELD.left = HELD.right = false; res(f.slice(5)); }
    };
    requestAnimationFrame(tick);
  })`);
  const s = [...r].sort((a, b) => a - b);
  rows.push({ variant: name, frames: s.length, median: s[s.length >> 1].toFixed(1), p95: s[Math.floor(s.length * 0.95)].toFixed(1),
    over20: ((100 * s.filter((x) => x > 20).length) / s.length).toFixed(1) + '%' });
}
console.table(rows);
chrome.kill();
process.exit(0);
