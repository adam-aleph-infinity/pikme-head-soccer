// Photograph the champions' own powers (shared/champion-powers/, public/vfx/powers/) in the live
// client at 844×390, frame-exactly — the match is held (window.SIM_HOLD) and stepped from here.
//
//   PORT=3093 CDP=9593 node _powers-shots.mjs 6 7     → .shots/powers-6-10/stage-06-<moment>.png …
//   node _powers-shots.mjs                            → every stage 6–10 that is built, + ALL.png
//
// Moments (the champion on the left fires at the player on the right):
//   a-armed  the press      b-cut   0.2 s into the cut-in
//   c/d/e    three moments of the flight (per-stage spacing: the dragon and the giant ball take longer)
//   f-impact the shot meeting the defender        g-after  what it left on him, a beat later
// ALL.png: every picture, one row a stage (ffmpeg's tile filter).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { championPower } from './shared/champion-powers.js';

const want = process.argv.slice(2).map(Number).filter(Boolean);
const STAGES = (want.length ? want : [6, 7, 8, 9, 10]).filter((s) => championPower(s));
// ticks after the release for the three flight pictures (cumulative), and where the defender stands
const PLAN = {
  6: { fly: [8, 6, 6], gap: 520 },
  7: { fly: [12, 18, 18], gap: 520 },
  8: { fly: [10, 12, 12], gap: 520 },
  9: { fly: [8, 8, 8], gap: 560 },
  10: { fly: [10, 10, 10], gap: 520 },
};
const PORT = Number(process.env.PORT) || 3093, CDP = Number(process.env.CDP) || 9593;
const server = await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/powers-6-10`;
mkdirSync(OUT, { recursive: true });
rmSync(`${OUT}/prof`, { recursive: true, force: true });
const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank',
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
const shot = async (name) => {
  await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });

const HELPERS = `(async () => {
  window.SIM_HOLD = true;
  const S = await import('/shared/sim.js'), HP = await import('/shared/hs-powers.js');
  window.__tick = (n, inputs) => {
    for (let i = 0; i < n; i++) {
      S.step(MATCH, typeof inputs === 'function' ? inputs(i) : (inputs || [{}, {}]), C.TICK);
      for (const e of MATCH.events) { VFXR.onEvent(e); EVENTS.push(e); }
      MATCH.events.length = 0;
      VFXR.update(C.TICK);
    }
  };
  window.__open = (stage, gap) => {
    const m = MATCH;
    m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.gaugeLead = 0; m.hitStop = 0; m.cutin = 0;
    m.clock = 60;
    const [a, z] = m.players;
    a.shot = HP.shotFor({ rarity: 'legendary', number: stage }, { arcade: true }); z.shot = HP.shotById('straight');
    a.x = 250; z.x = 250 + gap; a.y = z.y = C.GROUND_Y; a.vx = z.vx = 0; a.vy = z.vy = 0;
    for (const p of m.players) { p.stunned = 0; p.ail = ''; p.ailT = 0; p.kickT = 0; p.kickCd = 0; p.armed = 0; p.gauge = 0; p.prev = {}; }
    m.ball.power = null; m.xballs.length = 0;
    EVENTS.length = 0;
    VFXR.reset();
  };
  return 'ok';
})()`;

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_8&foe=legendary_9&play=1&solo=1&stage=japan` });
await sleep(1800);
await js(HELPERS);

let bad = 0;
for (const st of STAGES) {
  const P = PLAN[st] || PLAN[6], N = `stage-${String(st).padStart(2, '0')}`;
  await js(`__open(${st}, ${P.gap})`);
  await js(`(() => { const a = MATCH.players[0]; a.gauge = 1; MATCH.ball.x = 530; MATCH.ball.y = 140; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1, [{ power: true }, {}]); MATCH.ball.x = 530; MATCH.ball.y = 140; MATCH.ball.vy = 0; })()`);
  await shot(`${N}-a-armed`);
  await js(`(() => { const a = MATCH.players[0]; MATCH.ball.x = a.x + 8; MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R * 2 + 6; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1); __tick(12); })()`);
  await shot(`${N}-b-cut`);
  await js(`(() => { let g = 0; while (MATCH.cutin > C.POWER_RELEASE && g++ < 200) __tick(1); })()`);
  for (const [i, n] of P.fly.entries()) {
    await js(`__tick(${n})`);
    await shot(`${N}-${'cde'[i]}-fly`);
  }
  const hit = await js(`(() => { let g = 0, seen = null;
    while (g++ < 300 && !seen) { __tick(1); seen = EVENTS.slice(-6).find((e) => e.type === 'powerHit' || e.type === 'blocked' || e.type === 'goal'); }
    __tick(3); return seen ? seen.type : null; })()`);
  await shot(`${N}-f-impact`);
  await js('__tick(30)');
  await shot(`${N}-g-after`);
  if (!hit) { console.log(`  ✗ stage ${st}: never reached the defender`); bad++; } else console.log(`  ✓ stage ${st}: ${hit}`);
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 4).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();

// the contact sheet: one row a stage, 7 moments across
const rows = [6, 7, 8, 9, 10].filter((s) => readdirSync(OUT).some((f) => f.startsWith(`stage-${String(s).padStart(2, '0')}-g`)));
if (rows.length) {
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', `${OUT}/stage-*.png`,
      '-vf', `scale=560:-1,tile=7x${rows.length}:padding=4:color=white`, '-frames:v', '1', `${OUT}/ALL.png`]);
    console.log(`contact sheet: ${OUT}/ALL.png (${rows.length} stages)`);
  } catch (e) { console.log('contact sheet failed:', e.message); }
}
console.log(`_powers-shots: stages ${STAGES.join(',')} → ${OUT}${bad ? `, ${bad} PROBLEMS` : ', no exceptions'}`);
process.exit(bad ? 1 : 0);
