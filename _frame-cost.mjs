// WHAT A FRAME COSTS ON A PHONE — the game's own per-frame work (every requestAnimationFrame
// callback, timed) in a live match at 844x390, DPR 3 (an iPhone 14), 4x CPU throttle, in four
// moments: open play, a head in the goal (the net mask), a full power bar (its filters), and
// a power armed (the press glow).   node _frame-cost.mjs   → p50 / p95 / max ms and long frames
// Real touch through CDP Input.dispatchTouchEvent on a mobile-emulated 844x390 page, so the
// browser's own touch → pointer plumbing runs. Exit code 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3022, CDP = Number(process.env.CDP) || 9495;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/frame-cost`;
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '·' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=3', `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { chrome.kill(); throw new Error('chrome never came up'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;

// Fingers: a map of CDP touch id -> [x, y]. Every event carries every finger still down.
const fingers = new Map();
const pts = () => [...fingers].map(([i, [x, y]]) => ({ id: i, x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8 }));
const down = async (fid, p) => { fingers.set(fid, p); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() }); };
const move = async (fid, p) => { fingers.set(fid, p); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() }); };
// A touchEnd lists the finger(s) that LIFT, not the ones that stay (listing the survivors lifts
// them instead, and a touchMove that omits a finger does not lift it at all).
const up = async (fid) => {
  const [x, y] = fingers.get(fid);
  fingers.delete(fid);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id: fid, x: Math.round(x), y: Math.round(y) }] });
};
// A thumb's slide: `steps` moves over `ms`, bowing up by `arc` px in the middle.
const slide = async (fid, from, to, { steps = 8, ms = 120, arc = 0 } = {}) => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await move(fid, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - arc * Math.sin(Math.PI * t)]);
    await sleep(ms / steps);
  }
};
const KEYCODE = { ArrowLeft: 37, ArrowRight: 39 };
const key = (type, code) => send('Input.dispatchKeyEvent', {
  type, code, key: code, windowsVirtualKeyCode: KEYCODE[code], nativeVirtualKeyCode: KEYCODE[code],
});

const px = async () => evalJs('MATCH.players[0].x');
const heldDir = async () => evalJs('HELD.left && HELD.right ? "both" : HELD.left ? "left" : HELD.right ? "right" : "none"');
// Samples x every `every` ms for `ms`; returns the per-sample deltas.
const track = async (ms, every = 100) => {
  const xs = [await px()];
  for (let t = 0; t < ms; t += every) { await sleep(every); xs.push(await px()); }
  return xs.slice(1).map((x, i) => x - xs[i]);
};
const fmt = (ds) => ds.map((d) => d.toFixed(0)).join(' ');
const allUp = (ds, min = 3) => ds.length > 0 && ds.every((d) => d > min);
const allDown = (ds, min = 3) => ds.length > 0 && ds.every((d) => d < -min);
const still = (ds) => ds.every((d) => Math.abs(d) < 1);
// Park the player mid-left with the ball and the (idle) opponent out of the way, so the body
// has room to walk both ways and nothing scores, knocks or blocks it.
const park = () => evalJs(`(() => {
  const m = MATCH, p = m.players[0], q = m.players[1];
  p.x = 360; p.vx = 0; q.x = 1000; q.vx = 0;
  m.ball.x = 820; m.ball.vx = 0; m.ball.vy = 0;
  return m.phase;
})()`);
const settle = async () => {
  for (let i = 0; i < 80; i++) {
    if (await evalJs('MATCH && MATCH.phase === "play" && !(MATCH.freeze > 0) ? 1 : 0')) return true;
    await sleep(100);
  }
  return false;
};

async function load(layout) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&solo=1&play=1&me=legendary_3&foe=epic_7` });
  for (let i = 0; i < 60; i++) { await sleep(200); if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break; }
  if (layout !== undefined) {
    await evalJs(`localStorage.setItem('hs.padlayout.v1', ${JSON.stringify(JSON.stringify(layout))}); 1`);
    await send('Page.reload');
    await sleep(400);
    for (let i = 0; i < 60; i++) { await sleep(200); if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break; }
  }
  await evalJs('window.BOT_OFF = true; 1');
  ok('match reaches open play', await settle());
  return JSON.parse(await evalJs(`JSON.stringify(Object.fromEntries([...document.querySelectorAll('.pad .btn')].map((b) => {
    const r = b.getBoundingClientRect(); return [b.dataset.k, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom }];
  })))`));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const raf = window.requestAnimationFrame.bind(window), T = (window.__ft = []);
  window.requestAnimationFrame = (cb) => raf((ts) => { const a = performance.now(); cb(ts); T.push(performance.now() - a); });
})();` });
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&play=1&me=legendary_3&foe=epic_7` });
for (let i = 0; i < 60; i++) { await sleep(200); if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break; }
await sleep(3000);
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
const SCEN = {
  'open play': '',
  'head in the goal': 'const p = MATCH.players[0]; p.x = 40; p.vx = 0;',
  'full power bar': 'MATCH.players[0].gauge = 1; MATCH.players[0].armed = 0;',
  'power armed': 'MATCH.players[0].gauge = 1; MATCH.players[0].armed = 9;',
};
const rows = [];
for (const [name, js] of Object.entries(SCEN)) {
  await evalJs('window.__ft.length = 0; 1');
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) { if (js) await evalJs(`(() => { ${js} })(); 1`); await sleep(100); }
  const ft = (await evalJs('window.__ft.slice()')).filter((x) => x > 0).sort((a, b) => a - b);
  const q = (f) => ft[Math.min(ft.length - 1, Math.floor(ft.length * f))] || 0;
  rows.push(`  ${name.padEnd(18)} frames ${String(ft.length).padStart(4)}  p50 ${q(0.5).toFixed(1).padStart(5)} ms  p95 ${q(0.95).toFixed(1).padStart(5)} ms  max ${q(1).toFixed(1).padStart(5)} ms  over 16.7 ms: ${(100 * ft.filter((x) => x > 16.7).length / Math.max(1, ft.length)).toFixed(0)}%`);
}
console.log(rows.join('\n'));
if (errors.length) console.log('page errors:', errors.slice(0, 3));
chrome.kill();
process.exit(0);
