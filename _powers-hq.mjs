// THE POWERS' QUALITY LOOP — photograph and film the first five champions' powers (and the shared
// press glow, cut-in, block, hit and stars) in the live client, frame-exactly, on a fake clock.
//
//   node _powers-hq.mjs stills [1 2 …] [--dpr 3]   → .shots/powers-hq/<dpr>x/stage-NN-<moment>.png
//   node _powers-hq.mjs video  [1 2 …] [--dpr 2]   → .shots/powers-hq/video/stage-NN.mp4 (60 fps)
//                                                   + stage-NN-strip.png (every 4th frame)
//   node _powers-hq.mjs block                      → the kick-block burst and the rebound's stars
//   node _powers-hq.mjs perf   [--cpu 4]           → FX ms per frame under CPU throttle
//
// The match is held (window.SIM_HOLD) and stepped from here; performance.now is replaced by a
// clock that advances 1/60 s a tick, so flicker, spin and fades run at their real rates in the
// frames even though each takes ~0.1 s to capture. The champion is on the right (player 1),
// firing at the player on the left, as in the arcade.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { CHAMPION_POWERS } from './shared/champion-powers.js';

const args = process.argv.slice(2);
const MODE = ['stills', 'video', 'block', 'perf'].includes(args[0]) ? args.shift() : 'stills';
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const DPR = Number(opt('--dpr', MODE === 'video' ? 2 : 2));
const CPU = Number(opt('--cpu', 4));
const FF = '/opt/homebrew/bin/ffmpeg';
const want = args.map(Number).filter(Boolean);
const STAGES = want.length ? want : [1, 2, 3, 4, 5];
const PORT = Number(process.env.PORT) || 3097, CDP = Number(process.env.CDP) || 9597;
const server = await ensureServer(PORT);
const ROOT = `${import.meta.dirname}/.shots/powers-hq`;
const OUT = MODE === 'video' ? `${ROOT}/video` : MODE === 'stills' ? `${ROOT}/${DPR}x` : `${ROOT}/${MODE}`;
mkdirSync(OUT, { recursive: true });
rmSync(`${ROOT}/prof${CDP}`, { recursive: true, force: true });
const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${ROOT}/prof${CDP}`, 'about:blank',
], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); server.stop(); throw new Error('chrome never came up'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map(), errs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) errs.push(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r?.result?.value;
};
// where things are on each picture, in device px (for the comparison sheets' crops)
const POS = {};
const shot = async (file) => {
  await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(file, Buffer.from(s.data, 'base64'));
  POS[file.split('/').pop()] = await js(`(async () => {
    const { headY } = await import('/shared/sim.js');
    const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect(), k = rc.width / C.W, D = devicePixelRatio;
    const T = document.getElementById('cvfx1').getContext('2d').getTransform(), top = T.f / T.a;
    const at = (x, y) => ({ x: Math.round((rc.left + x * k) * D), y: Math.round((rc.top + (y + top) * k) * D) });
    const [z, a] = MATCH.players;
    return { k: k * D, shooter: at(a.x, headY(a)), defender: at(z.x, headY(z)), ball: at(MATCH.ball.x, MATCH.ball.y) };
  })()`);
};
const savePos = () => writeFileSync(`${OUT}/pos.json`, JSON.stringify(POS, null, 1));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: DPR, mobile: true });
// the fake clock, before any page script runs
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const real = performance.now.bind(performance); window.__realNow = real; window.__clock = null; performance.now = () => (window.__clock == null ? real() : window.__clock * 1000); })();` });

const HELPERS = (stage) => `(async () => {
  window.SIM_HOLD = true;
  window.__clock = 1000;
  const S = await import('/shared/sim.js'), HP = await import('/shared/hs-powers.js');
  window.__tick = (n, inputs) => {
    for (let i = 0; i < n; i++) {
      S.step(MATCH, typeof inputs === 'function' ? inputs(i) : (inputs || [{}, {}]), C.TICK);
      for (const e of MATCH.events) { VFXR.onEvent(e); EVENTS.push(e); }
      MATCH.events.length = 0;
      window.__clock += C.TICK;
      VFXR.update(C.TICK);
    }
  };
  const m = MATCH;
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.gaugeLead = 0; m.hitStop = 0; m.cutin = 0; m.clock = 60;
  const [z, a] = m.players;
  a.shot = HP.shotFor({ rarity: 'legendary', number: ${stage} }, { arcade: true });
  a.x = 780; z.x = 360; a.y = z.y = C.GROUND_Y; a.vx = z.vx = 0; a.vy = z.vy = 0;
  for (const p of m.players) { p.stunned = 0; p.ail = ''; p.ailT = 0; p.kickT = 0; p.kickCd = 0; p.armed = 0; p.gauge = 0; p.prev = {}; }
  m.ball.power = null; m.xballs.length = 0;
  window.EVENTS = [];
  VFXR.reset();
  return a.shot.cp;
})()`;
const PRESS = `(() => { const a = MATCH.players[1]; a.gauge = 1; MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1, [{}, { power: true }]); MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vy = 0; })()`;
const HOLD_BALL = `MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vx = MATCH.ball.vy = 0;`;
const TOUCH = `(() => { const a = MATCH.players[1]; MATCH.ball.x = a.x - 8; MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R * 2 + 6; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1); })()`;
const HIT = `EVENTS.slice(-6).find((e) => e.type === 'powerHit' || e.type === 'blocked' || e.type === 'goal')`;
const open = async (n) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_8&foe=legendary_${n}&play=1&solo=1&stage=japan` });
  await sleep(1800);
  return js(HELPERS(n));
};

let bad = 0;
if (MODE === 'stills') {
  for (const n of STAGES) {
    const tag = `stage-${String(n).padStart(2, '0')}`;
    const cp = await open(n);
    if (cp !== CHAMPION_POWERS[n].id) { console.log(`  ✗ ${n}: fired ${cp}`); bad++; continue; }
    await js(PRESS);
    for (const [k, f] of [['a1', 3], ['a2', 5]]) { await js(`(() => { __tick(${f}); ${HOLD_BALL} })()`); await shot(`${OUT}/${tag}-${k}-armed.png`); }
    await js(TOUCH);
    for (const [k, f] of [['b1', 3], ['b2', 8], ['b3', 30]]) { await js(`__tick(${f})`); await shot(`${OUT}/${tag}-${k}-cut.png`); }
    await js(`(() => { let g = 0; while (MATCH.cutin > C.POWER_RELEASE && g++ < 200) __tick(1); __tick(3); })()`);
    await shot(`${OUT}/${tag}-c-fly.png`);
    await js('__tick(6)'); await shot(`${OUT}/${tag}-d-fly.png`);
    await js('__tick(9)'); await shot(`${OUT}/${tag}-e-fly.png`);
    const hit = await js(`(() => { let g = 0, seen = null; while (g++ < 240 && !seen) { __tick(1); seen = ${HIT}; } __tick(${n === 3 ? 14 : 4}); return seen ? seen.type + (seen.how ? ':' + seen.how : '') : null; })()`);
    await shot(`${OUT}/${tag}-f-impact.png`);
    if (process.env.DBG) console.log('   dbg:', JSON.stringify(await js(process.env.DBG)));
    await js('__tick(24)'); await shot(`${OUT}/${tag}-g-after.png`);
    console.log(`  ${hit ? '✓' : '✗'} ${n} ${CHAMPION_POWERS[n].hsPower}: ${hit}`);
    if (!hit) bad++;
  }
  savePos();
} else if (MODE === 'video') {
  for (const n of STAGES) {
    const tag = `stage-${String(n).padStart(2, '0')}`, dir = `${OUT}/${tag}`;
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await open(n);
    let f = 0;
    const grab = async () => shot(`${dir}/${String(f++).padStart(4, '0')}.png`);
    await js(PRESS);
    for (let i = 0; i < 36; i++) { await js(`(() => { __tick(1); ${HOLD_BALL} })()`); await grab(); }
    await js(TOUCH); await grab();
    let seen = null, after = 0;
    for (let i = 0; i < 360 && after < 50; i++) {
      await js('__tick(1)');
      await grab();
      if (!seen) seen = await js(HIT); else after++;
    }
    spawnSync(FF, ['-v', 'error', '-y', '-framerate', '60', '-i', `${dir}/%04d.png`, '-vf', 'scale=1688:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `${OUT}/${tag}.mp4`]);
    spawnSync(FF, ['-v', 'error', '-y', '-framerate', '60', '-i', `${dir}/%04d.png`, '-vf', `select='not(mod(n\\,4))',scale=422:-1,tile=8x8:padding=2`, '-frames:v', '1', `${OUT}/${tag}-strip.png`]);
    console.log(`  ${seen ? '✓' : '✗'} ${n}: ${f} frames → ${OUT}/${tag}.mp4 (${seen ? seen.type : 'no hit'})`);
  }
} else if (MODE === 'block') {
  // stage 1 fired at a defender who kicks into it: the grind's burst, the rebound, the stars
  await open(1);
  await js(PRESS); await js(TOUCH);
  await js(`(() => { let g = 0; while (MATCH.cutin > C.POWER_RELEASE && g++ < 200) __tick(1); })()`);
  let k = 0;
  const kicked = await js(`(() => { let g = 0; while (g++ < 120) { const b = MATCH.ball, z = MATCH.players[0]; if (b.x - z.x < 150) { __tick(1, [{ kick: true }, {}]); break; } __tick(1); } let s = 0; while (s++ < 40 && !(MATCH.ball.power && MATCH.ball.power.ph === 'grind')) __tick(1); return MATCH.ball.power ? MATCH.ball.power.ph : 'none'; })()`);
  for (const f of [2, 4, 6, 10, 16, 24, 34, 50]) { await js(`__tick(${f - (k ? [2, 4, 6, 10, 16, 24, 34, 50][[2, 4, 6, 10, 16, 24, 34, 50].indexOf(f) - 1] : 0)})`); await shot(`${OUT}/grind-${String(k++).padStart(2, '0')}.png`); }
  const st = await js(`(() => { let g = 0; while (g++ < 200 && !MATCH.players.some((p) => p.stunned > 0 && !(MATCH.ball.power && MATCH.ball.power.ph === 'grind'))) __tick(1); __tick(6); return MATCH.players.map((p) => p.stunned); })()`);
  await shot(`${OUT}/stars-0.png`); await js('__tick(5)'); await shot(`${OUT}/stars-1.png`);
  console.log(`  block: ${kicked}; stunned ${JSON.stringify(st)}`);
  savePos();
} else if (MODE === 'perf') {
  // Each stage fired live (rAF running, fake clock off), CPU throttled, and the FX layers'
  // draw time measured per frame round VFXR.drawUnder/drawTop.
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  for (const n of STAGES) {
    await open(n);
    // (performance.now is coarsened to 0.1 ms here, so each layer's draw is repeated REP times
    // inside the timer and divided back; the canvas is cleared by the next real draw anyway.
    // A second number: the frame's whole wall time, rAF to rAF, FX frames against plain ones.)
    const r = await js(`(async () => {
      performance.now = window.__realNow;
      const REP = 10, T = [], U = VFXR.drawUnder.bind(VFXR), P = VFXR.drawTop.bind(VFXR);
      let acc = 0;
      VFXR.drawUnder = (g) => { const t0 = performance.now(); for (let i = 0; i < REP; i++) U(g); acc += (performance.now() - t0) / REP; };
      VFXR.drawTop = (g) => { const t0 = performance.now(); for (let i = 0; i < REP; i++) P(g); acc += (performance.now() - t0) / REP; T.push(acc); acc = 0; };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const frameTimes = async (ms, step) => { const out = []; let last = performance.now(); const t0 = last; while (performance.now() - t0 < ms) { if (step) __tick(1); await new Promise((r) => requestAnimationFrame(r)); const now = performance.now(); out.push(now - last); last = now; } return out.sort((a, b) => a - b); };
      const plain = await frameTimes(1000, false);
      ${PRESS}; await wait(300);
      ${TOUCH};
      const frames0 = T.length;
      const fx = await frameTimes(2600, true);
      const s = T.slice(frames0).sort((a, b) => a - b);
      const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
      return { n: s.length, med: q(s, 0.5), p95: q(s, 0.95), max: s[s.length - 1], plain: q(plain, 0.5), fxf: q(fx, 0.5), fx95: q(fx, 0.95) };
    })()`);
    console.log(`  stage ${n} @${CPU}x CPU: FX draw (JS) median ${r.med.toFixed(2)} ms, p95 ${r.p95.toFixed(2)}, max ${r.max.toFixed(2)} (${r.n} frames); frame time plain ${r.plain.toFixed(1)} ms, with FX median ${r.fxf.toFixed(1)} / p95 ${r.fx95.toFixed(1)} ms`);
  }
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 4).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();
console.log(`_powers-hq ${MODE}: → ${OUT}${bad ? `, ${bad} PROBLEMS` : ''}`);
process.exit(bad ? 1 : 0);
