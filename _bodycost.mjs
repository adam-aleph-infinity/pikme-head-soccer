// WHAT THE PAINTED BODY COSTS — a live match on an 844x390 phone at 4x CPU throttle.
//
// The body and boots are sprites painted once (public/body-art.js) and blitted onto #cvbody at
// the screen's resolution. This measures what that costs: rAF frame intervals of a live match
// with player one running back and forth and kicking (5 s), and drawBody alone — 2000 calls
// across the poses (stand, run, jump, kick) on the body layer — in microseconds per call.
//
//   node _bodycost.mjs      (PORT / CDP env to move off the defaults)
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const PORT = process.env.PORT || 3047, CDP = +(process.env.CDP || 9535);
await ensureServer(PORT);
const chrome = spawn(chromePath(),
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   `--user-data-dir=${import.meta.dirname}/.shots/bodycost-prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }))?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?diff=3&solo=1` });
await sleep(2200);
await ev('window.BOT_OFF = true; startMatch()');
await sleep(2500);
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
await ev(`MATCH.phase = 'play'; MATCH.freeze = 0;`);
await sleep(800);
const f = await ev(`new Promise((res) => {
  const f = []; let last = performance.now(); const end = last + 5000;
  const tick = (now) => {
    f.push(now - last); last = now;
    HELD.left = Math.sin(now / 400) < 0; HELD.right = !HELD.left;
    const p = MATCH.players[0]; if (p.kickT <= 0 && Math.sin(now / 150) > 0.9) p.kickT = C.KICK_TIME;
    if (now < end) requestAnimationFrame(tick); else { HELD.left = HELD.right = false; res(f.slice(5)); }
  };
  requestAnimationFrame(tick);
})`);
const s = [...f].sort((a, b) => a - b);
const us = await ev(`(() => {
  const g = document.getElementById('cvbody').getContext('2d'), p0 = MATCH.players[0];
  const poses = [{ vx: 0, onGround: true, kickT: 0 }, { vx: 228, onGround: true, kickT: 0 }, { vx: 0, onGround: false, kickT: 0 }, { vx: 0, onGround: true, kickT: C.KICK_TIME * 0.5 }];
  const q = poses.map((o) => ({ ...p0, ...o, stunned: 0, shoved: 0 }));
  for (let i = 0; i < 200; i++) drawBody(g, q[i & 3]);   // warm
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) drawBody(g, q[i & 3]);
  return ((performance.now() - t0) / 2000) * 1000;
})()`);
console.table([{ frames: s.length, median: s[s.length >> 1].toFixed(1), p95: s[Math.floor(s.length * 0.95)].toFixed(1),
  over20: ((100 * s.filter((x) => x > 20).length) / s.length).toFixed(1) + '%', drawBody_us: us.toFixed(1) }]);
chrome.kill();
process.exit(0);
