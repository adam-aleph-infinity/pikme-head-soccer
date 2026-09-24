// Photograph ONE TIER of champion powers in the live client, closely — for working on their looks.
//
// _arcade-shots.mjs plays the whole arcade flow and takes three frames a power; this takes only
// the nine powers of one tier (or the ones you name) and more frames of each, and it runs on its
// own port, browser and folder, so five of them can run side by side — one per tier.
//
//   node _vfx-shots.mjs 3                 → .shots/vfx/tier3/*.png
//   node _vfx-shots.mjs 3 meteor quake    → just those two
//
// Frames per power (player on the left fires; the last one the champion bot on the right does):
//   a-armed  the tell, before the touch      b-cut    the super cut-in, match held
//   c-burst  just after the hold              d-main   0.5s in       e-late   1.3s in
//   f-foe    the champion on the right firing it back at the player
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { POWER_ORDER } from './shared/powers.js';

const TIER = Number(process.argv[2]);
if (!(TIER >= 1 && TIER <= 5)) { console.log('usage: node _vfx-shots.mjs <tier 1-5> [power ...]'); process.exit(2); }
const names = process.argv.slice(3);
const POWERS = POWER_ORDER.map((p, i) => [p, i + 1]).filter(([p, n]) => (names.length ? names.includes(p) : Math.ceil(n / 9) === TIER));

const PORT = 3100 + TIER, CDP = 9500 + TIER;
const server = await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/vfx/tier${TIER}`;
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
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};
const go = async (q) => { await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${q}` }); await sleep(1600); };

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await go('');
await js(`localStorage.setItem('hs.arcade.v1', JSON.stringify({ v: 1, cleared: 44, record: {} }))`);

// Arm player `i` and put the ball on their head: the next tick is the touch.
const arm = (i) => js(`(() => { const p = MATCH.players[${i}]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.hitStop = 0;
  p.gauge = 1; p.armed = 1; MATCH.ball.x = 530; MATCH.ball.y = 120; MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; })()`);
const touch = (i) => js(`(() => { const p = MATCH.players[${i}]; MATCH.hitStop = 0; MATCH.ball.x = p.x; MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8;
  MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; EVENTS.length = 0; })()`);
const fired = (power) => js(`EVENTS.some(e => e.type === 'powershot' && e.champ === '${power}')`);

let bad = 0;
for (const [power, n] of POWERS) {
  const tag = `${String(n).padStart(2, '0')}-${power}`;
  await go(`?me=legendary_${n}&solo=1&arcade=${n}`);
  await sleep(500);
  await js(`MATCH.players[0].x = 330`);
  await arm(0); await sleep(300); await shot(`${tag}-a-armed`);
  await touch(0); await sleep(200); await shot(`${tag}-b-cut`);
  await sleep(330); await shot(`${tag}-c-burst`);
  await sleep(400); await shot(`${tag}-d-main`);
  await sleep(800); await shot(`${tag}-e-late`);
  const ok = await fired(power);
  // Back to kickoff positions, then the champion on the right fires it at the player.
  await go(`?me=legendary_${n}&solo=1&arcade=${n}`);
  await sleep(500);
  await js(`MATCH.players[1].x = 730`);
  await arm(1); await sleep(150); await touch(1); await sleep(1000); await shot(`${tag}-f-foe`);
  const ok2 = await fired(power);
  console.log(`  ${ok && ok2 ? '✓' : '✗'} ${tag}`);
  if (!ok || !ok2) bad++;
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 3).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();
console.log(`_vfx-shots tier ${TIER}: ${POWERS.length} powers → ${OUT}${bad ? `, ${bad} PROBLEMS` : ', all fired, no exceptions'}`);
process.exit(bad ? 1 : 0);
