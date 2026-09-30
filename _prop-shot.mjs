// PROPORTIONS vs HS: our match at HS's recording size (2556 x 1180, M4), staged like M4 31.0 s —
// both players at their kickoff spots, the ball at rest mid-pitch. node _prop-shot.mjs [out.png]
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const OUT = process.argv[2] || '.shots/prop-ours.png', CDP = 9531, PROF = '/tmp/prop-prof-' + process.pid;
const server = await ensureServer(); const PORT = server.port || 3020;
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars', `--user-data-dir=${PROF}`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); } };
const send = (m, p = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: m, params: p })); });
const js = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r?.exceptionDetails) console.error(r.exceptionDetails.exception?.description); return r?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.VW) || 1278, height: Number(process.env.VH) || 590, deviceScaleFactor: Number(process.env.DPR) || 2, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${process.env.ME || "legendary_8"}&foe=${process.env.FOE || "legendary_9"}&play=1&solo=1&stage=${process.env.STAGE || 'hs-day'}&nointro=1` });
for (let i = 0; i < 60; i++) { await sleep(250); if (await js(`typeof MATCH !== 'undefined' && !!MATCH && document.readyState === 'complete'`)) break; }
await sleep(800);
const info = await js(`(async () => {
  window.SIM_HOLD = true;
  const S = await import('/shared/sim.js');
  const m = MATCH; m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.clock = 49;
  for (const p of m.players) { p.x = C.SPAWN_X[p.index]; p.y = C.GROUND_Y; p.vx = p.vy = 0; p.onGround = true; p.kickT = 0; }
  m.ball.x = C.W / 2; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = m.ball.vy = 0; m.ball.spin = 0; m.ball.angle = 0;
  for (let i = 0; i < 20; i++) { S.step(m, [{}, {}], C.TICK); m.events.length = 0; }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => +(v * 2).toFixed(1)); };
  return { match: q('#match'), head0: q('#head0') || q('.head'), ball: [m.ball.x, m.ball.y], p: m.players.map((p) => [p.x, p.y]) };
})()`);
console.log(JSON.stringify(info));
const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT, Buffer.from(s.data, 'base64'));
chrome.kill(); server.stop?.(); process.exit(0);
