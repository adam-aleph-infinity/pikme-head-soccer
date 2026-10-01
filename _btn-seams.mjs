// THE SLANTED BUTTONS' SEAMS: does a touch take the button whose drawn shape is under it?
// Samples a grid over POWER · KICK · JUMP; the truth is the SVG shape (isPointInFill), the
// answer is what the game holds after a real CDP touch there.   node _btn-seams.mjs
// Real touch through CDP Input.dispatchTouchEvent on a mobile-emulated 844x390 page, so the
// browser's own touch → pointer plumbing runs. Exit code 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3021, CDP = Number(process.env.CDP) || 9493;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/btn-seams`;
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '·' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank',
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
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
await load();
await evalJs('MATCH.players[0].gauge = 1; 1'); await sleep(300);
const pts2 = JSON.parse(await evalJs(`JSON.stringify((() => {
  const out = [];
  const btns = [...document.querySelectorAll('.pad .pad-r .btn')];
  const R = btns.map((b) => b.getBoundingClientRect());
  const L = Math.min(...R.map((r) => r.left)), Rt = Math.max(...R.map((r) => r.right)), T = Math.min(...R.map((r) => r.top)), B = Math.max(...R.map((r) => r.bottom));
  for (let y = T + 3; y < B; y += 6) for (let x = L + 2; x < Rt; x += 5) {
    let truth = null;
    for (const b of btns) {
      const path = b.querySelector('svg use.hs-fill'), svg = b.querySelector('svg');
      const geo = svg.querySelector('path');
      const m = svg.getScreenCTM().inverse(), p = new DOMPoint(x, y).matrixTransform(m);
      if (geo.isPointInFill(p)) truth = b.dataset.k;
    }
    if (truth) out.push([x, y, truth]);
  }
  return out;
})())`));
let wrong = 0, none = 0;
const bad = [];
for (const [x, y, truth] of pts2) {
  await evalJs('MATCH.players[0].gauge = 1; MATCH.players[0].armed = 0; 1');
  await sleep(20);
  await down(1, [x, y]);
  const got = await evalJs('["jump","kick","power"].find((k) => HELD[k]) || "none"');
  await up(1);
  await sleep(5);
  if (got === 'none') none++;
  else if (got !== truth) { wrong++; if (bad.length < 6) bad.push(`${Math.round(x)},${Math.round(y)} ${truth}→${got}`); }
}
console.log(`  ${pts2.length} touches on the drawn buttons: ${wrong} took the wrong button, ${none} took none  ${bad.join(' | ')}`);
ok('every touch on a drawn button takes that button', wrong === 0 && none === 0);
console.log(`\n${pass} passed, ${fail} failed`);
chrome.kill();
process.exit(fail ? 1 : 0);
