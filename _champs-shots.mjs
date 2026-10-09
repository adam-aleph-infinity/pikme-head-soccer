// THE CHAMPION PICKER, walked: home → tap the hero on the podium → the picker → preview a champion
// → choose it → back home with them on the podium, and it survives a reload. Photographs each step
// at phone sizes. Run: node _champs-shots.mjs   (shots in .shots/champs)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT || 3034), CDP = 9434;
const OUT = `${import.meta.dirname}/.shots/champs`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map(), logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64')); };
const fails = [];
const check = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails.push(name); };
const until = async (f, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(60); } return false; };
const on = (s) => until(async () => (await js('MENU.screen')) === s);
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
// a real tap at the centre of an element (so pointer-events and overlap count)
const tapAt = async (sel) => {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (!r) return false;
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 });
  return true;
};
const offGlass = (scr) => js(`(() => { const bad = []; for (const e of document.querySelectorAll('#${scr} button, #${scr} .ch-info, #${scr} .ch-head')) {
    const r = e.getBoundingClientRect(); if (!r.width || e.closest('.ch-grid')) continue;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push((e.id || e.className).toString().slice(0, 30)); } return bad; })()`);

await send('Page.enable'); await send('Runtime.enable');
const go = async (qs) => { await send('Page.navigate', { url: `http://localhost:${PORT}/${qs}` }); await until(() => js('!!window.MENU'), 8000); await sleep(500); };
const album = 'window.SALTIZ_CARDS = [1,2,3,5,8,13,21].map(n => ({ r: "legendary", n }));';
await send('Page.addScriptToEvaluateOnNewDocument', { source: album });

for (const [w, h, tag] of [[844, 390, 'iphone'], [740, 360, 'android'], [1024, 768, 'ipad']]) {
  console.log(`· ${w}×${h}`);
  await size(w, h);
  await go('?nointro');
  await js(`localStorage.removeItem('hs.me.v1'), localStorage.setItem('hs.mythic.v1', '{"v":1,"starter":2}'), 1`);
  await go('?nointro');
  await js(`document.querySelector('#title').click(), 1`);
  check('home', await on('menu'));
  await sleep(900);
  await shot(`${tag}-1-home`);
  check('tapping the hero opens the picker', (await tapAt('#hmHero')) && await on('champs'));
  await sleep(900);
  await shot(`${tag}-2-picker`);
  check('fits the glass', !(await offGlass('champs')).length, String(await offGlass('champs')));
  const counts = await js(`[document.querySelectorAll('#chGrid .ch-tile').length, document.querySelectorAll('#chGrid .ch-tile.locked').length, document.querySelector('#chN').textContent]`);
  check('grid: 46 tiles, 38 locked, 8 collected', counts?.[0] === 46 && counts[1] === 38 && counts[2] === '8', JSON.stringify(counts));
  await js(`document.querySelector('#chGrid .ch-tile.locked').click(), 1`); await sleep(500);
  check('a locked champion cannot be chosen', await js(`document.querySelector('#chGo').disabled`));
  await shot(`${tag}-3-locked`);
  await js(`[...document.querySelectorAll('#chGrid .ch-tile')].find(t => t.dataset.k === 'legendary_8').click(), 1`); await sleep(500);
  await shot(`${tag}-4-preview`);
  if (process.env.PROBE) console.log(await js(process.env.PROBE));
  check('an owned one can', !(await js(`document.querySelector('#chGo').disabled`)));
  await tapAt('#chGo'); await sleep(250);
  await shot(`${tag}-5-chosen`);
  check('…and it goes home with them', await on('menu') && (await js(`JSON.stringify(pick.me)`)) === '{"rarity":"legendary","number":8}', await js(`JSON.stringify(pick.me)`));
  await sleep(900);
  await shot(`${tag}-6-home-after`);
  await go('?nointro');
  check('the choice survives a reload', (await js(`JSON.stringify(pick.me)`)) === '{"rarity":"legendary","number":8}', await js(`JSON.stringify(pick.me)`));
}
check('nothing threw', !logs.length, logs.join(' | '));
ws.close(); chrome.kill();
console.log(fails.length ? `\n✗ ${fails.length} failed: ${fails.join(', ')}` : '\n✓ all good');
process.exit(fails.length ? 1 : 0);
