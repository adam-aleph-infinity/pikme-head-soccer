// The boots through a power's cut-in: node _bootbug.mjs [fire|block] → .shots/bootbug/<mode>-NN.png
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const MODE = (process.argv[2] || "fire"), OUT = `${import.meta.dirname}/.shots/bootbug`; mkdirSync(OUT, { recursive: true });
const server = await ensureServer(); const PORT = server.port || 3020, CDP = 9561;
const ch = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', `--user-data-dir=/tmp/bb${Date.now()}`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); } };
const send = (m, p = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: m, params: p })); });
const js = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r?.exceptionDetails) console.error(r.exceptionDetails.exception?.description); return r?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 852, height: 393, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_1&foe=legendary_3&play=1&solo=1&stage=hs-day&nointro=1` });
for (let i = 0; i < 60; i++) { await sleep(250); if (await js(`typeof MATCH !== 'undefined' && !!MATCH && document.readyState === 'complete'`)) break; }
await sleep(800);
await js(`(async () => {
  window.SIM_HOLD = true; const S = await import('/shared/sim.js'); window.__S = S;
  const m = MATCH; m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.clock = 50; m.gaugeLead = 0;
  const [a, z] = m.players; a.x = 400; z.x = 700;
  for (const p of m.players) { p.y = C.GROUND_Y; p.vx = p.vy = 0; p.onGround = true; }
  window.__tick = (n, inp) => { for (let i = 0; i < n; i++) { __S.step(MATCH, inp || [{}, {}], C.TICK); for (const e of MATCH.events) VFXR.onEvent(e); MATCH.events.length = 0; VFXR.update(C.TICK); } };
})()`);
const shot = async (k) => { await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${MODE}-${String(k).padStart(2, '0')}.png`, Buffer.from(s.data, 'base64')); };
if (MODE === 'fire') {
  // I arm, then touch the ball WITH THE BOOT
  await js(`(() => { const a = MATCH.players[0]; a.gauge = 1; __tick(1, [{ power: true }, {}]); __tick(2);
    MATCH.ball.x = a.x + 34; MATCH.ball.y = C.GROUND_Y - C.BALL_R - 4; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1, [{ kick: true }, {}]);
    let g = 0; while (!(MATCH.cutin > 0) && g++ < 30) { MATCH.ball.x = a.x + 30; MATCH.ball.vx = 0; __tick(1); } return MATCH.cutin; })()`);
} else {
  // the CPU fires at me; I kick into it
  await js(`(() => { const z = MATCH.players[1]; z.gauge = 1; __tick(1, [{}, { power: true }]); if (${!!process.env.ARMED}) { MATCH.players[0].gauge = 1; __tick(1, [{ power: true }, {}]); } MATCH.ball.x = z.x; MATCH.ball.y = z.y - C.BODY_H - C.HEAD_R + C.NECK; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1);
    let g = 0; while (g++ < 200) { const b = MATCH.ball, a = MATCH.players[0]; if (MATCH.hitStop <= 0 && b.power && b.x - a.x < 130) { __tick(1, [{ kick: true }, {}]); break; } __tick(1); } })()`);
}
for (let k = 0; k < 24; k++) { await shot(k); await js('__tick(4)'); }
console.log(await js(`JSON.stringify({ cut: MATCH.cutin, ph: MATCH.ball.power && MATCH.ball.power.ph })`));
ch.kill(); server.stop?.(); process.exit(0);
