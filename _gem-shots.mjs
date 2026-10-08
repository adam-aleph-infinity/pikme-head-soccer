// Photograph the MYTHIC GEM (shared/champion-powers/mythic.js) in the live client, 844×390, for each
// Mythic's colour: node _gem-shots.mjs [1 2 3 4] → .shots/mythic-gem/
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const want = process.argv.slice(2).map(Number).filter(Boolean);
const GEMS = want.length ? want : [1, 2, 3, 4];
const PORT = Number(process.env.PORT) || 3091, CDP = Number(process.env.CDP) || 9591;
const server = await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/mythic-gem`;
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

const HELPERS = (n) => `(async () => {
  window.SIM_HOLD = true;
  const S = await import('/shared/sim.js'), HP = await import('/shared/hs-powers.js');
  // the page's own frames must not age the effects between photographs: only __tick runs them
  if (!window.__upd) { window.__upd = VFXR.update.bind(VFXR); VFXR.update = () => {}; }
  window.__tick = (k, inputs) => {
    for (let i = 0; i < k; i++) {
      S.step(MATCH, typeof inputs === 'function' ? inputs(i) : (inputs || [{}, {}]), C.TICK);
      for (const e of MATCH.events) { VFXR.onEvent(e); EVENTS.push(e); }
      MATCH.events.length = 0;
      __upd(C.TICK);
    }
  };
  const m = MATCH;
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.gaugeLead = 0; m.hitStop = 0; m.cutin = 0; m.clock = 60;
  const [z, a] = m.players;
  a.shot = HP.shotFor({ rarity: 'mythic', number: ${n} });
  a.x = 780; z.x = 360; a.y = z.y = C.GROUND_Y; a.vx = z.vx = 0; a.vy = z.vy = 0;
  for (const p of m.players) { p.stunned = 0; p.ail = ''; p.ailT = 0; p.kickT = 0; p.kickCd = 0; p.armed = 0; p.gauge = 0; p.prev = {}; }
  m.ball.power = null; m.xballs.length = 0;
  window.EVENTS = [];
  VFXR.reset();
  return a.shot.cp + ' ' + a.shot.color + ' ' + (a.char ? a.char.id || a.char.name : '');
})()`;

let bad = 0;
for (const n of GEMS) {
  const tag = `gem-${n}`;
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_8&foe=mythic_${n}&play=1&solo=1&stage=japan&nointro` });
  await sleep(1800);
  const cp = await js(HELPERS(n));
  console.log('  fired', n, cp);
  await js(`(() => { const a = MATCH.players[1]; a.gauge = 1; MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1, [{}, { power: true }]); MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vy = 0; __tick(8); MATCH.ball.x = 560; MATCH.ball.y = 150; MATCH.ball.vx = MATCH.ball.vy = 0; })()`);
  await shot(`${tag}-a-armed`);
  await js(`(() => { const a = MATCH.players[1]; MATCH.ball.x = a.x - 8; MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R * 2 + 6; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1); __tick(45); })()`);
  await shot(`${tag}-b-cut`);
  await js(`(() => { let g = 0; while (MATCH.cutin > C.POWER_RELEASE && g++ < 200) __tick(1); __tick(3); })()`);
  await shot(`${tag}-c-fly`);
  await js('__tick(5)');
  await shot(`${tag}-d-fly`);
  const hit = await js(`(() => { let g = 0, seen = null;
    while (g++ < 240 && !seen) { __tick(1); seen = EVENTS.slice(-6).find((e) => e.type === 'gemShatter' || e.type === 'blocked' || e.type === 'goal'); }
    __tick(1); return seen ? seen.type : null; })()`);
  await shot(`${tag}-e-shatter`);
  await js('__tick(4)');
  await shot(`${tag}-e2-shatter`);
  await js('__tick(3)');
  await shot(`${tag}-f-shards`);
  await js('__tick(14)');
  await shot(`${tag}-g-crust`);
  console.log(`  ${hit === 'gemShatter' ? '✓' : '✗'} gem ${n}: ${hit}`);
  if (hit !== 'gemShatter') bad++;
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 4).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();
const MOMENTS = ['a-armed', 'b-cut', 'c-fly', 'd-fly', 'e-shatter', 'f-shards', 'g-crust'];
const rows = [];
for (const n of GEMS) {
  const files = MOMENTS.map((k) => `${OUT}/gem-${n}-${k}.png`);
  if (!files.every(existsSync)) continue;
  const row = `${OUT}/gem-${n}-row.png`;
  spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex',
    `${files.map((f, i) => `[${i}:v]scale=560:259,pad=566:265:3:3:white[v${i}]`).join(';')};${files.map((f, i) => `[v${i}]`).join('')}hstack=inputs=${files.length}`, row]);
  rows.push(row);
}
if (rows.length > 1) spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...rows.flatMap((f) => ['-i', f]), '-filter_complex', `vstack=inputs=${rows.length}`, `${OUT}/ALL.png`]);
console.log(`_gem-shots: ${GEMS.length} gems → ${OUT}${bad ? `, ${bad} PROBLEMS` : ', all shattered, no exceptions'}`);
process.exit(bad ? 1 : 0);
