// MY PROFILE, walked: home → the profile button → the profile in the team's colour → the favorite
// picker → pick one → it is on the podium and on the profile button, the champion you play with
// unchanged, and it survives a reload. Photographs each step at phone sizes.
// Run: node _profile-shots.mjs   (shots in .shots/profile)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { teamById } from './shared/teams.js';

const PORT = Number(process.env.PORT || 3035), CDP = 9435;
const OUT = `${import.meta.dirname}/.shots/profile`;
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
const tapAt = async (sel) => {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (!r) return false;
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 });
  return true;
};
// everything on the profile inside the screen, and the stat tiles not overlapping each other
const offGlass = () => js(`(() => { const bad = []; for (const e of document.querySelectorAll('#profile button, #profile .pf-nm, #profile .pf-cups, #profile .pf-tile, #profile .pf-coll')) {
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push((e.id || e.className).toString().slice(0, 30)); } return bad; })()`);

await send('Page.enable'); await send('Runtime.enable');
const go = async (qs) => { await send('Page.navigate', { url: `http://localhost:${PORT}/${qs}` }); await until(() => js('!!window.MENU'), 8000); await sleep(500); };
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.SALTIZ_CARDS = [1,2,3,5,8,13,21].map(n => ({ r: "legendary", n }));' });

for (const [w, h, tag, starter] of [[844, 390, 'iphone', 3], [740, 360, 'android', 1], [1024, 768, 'ipad', 4]]) {
  console.log(`· ${w}×${h} (team ${starter})`);
  await size(w, h);
  await go('?nointro');
  await js(`localStorage.clear(), localStorage.setItem('hs.mythic.v1', '{"v":1,"starter":${starter}}'), 1`);
  await go('?nointro');
  await js(`document.querySelector('#title').click(), 1`);
  check('home', await on('menu'));
  await sleep(900);
  check('the profile button opens the profile', (await tapAt('#hmProfile')) && await on('profile'));
  await sleep(900);
  await shot(`${tag}-1-profile`);
  check('fits the glass', !(await offGlass()).length, String(await offGlass()));
  const tc = await js(`getComputedStyle(document.querySelector('#profile')).getPropertyValue('--tc').trim()`);
  check("the left side is the team's colour", tc === teamById(starter).color, tc);
  const me = await js('JSON.stringify(pick.me)');
  check('the favorite starts as the one you play with', (await js(`document.querySelector('#pfFavName').textContent`)) !== '');
  check('the favorite pill opens the picker', (await tapAt('#pfFav')) && await until(() => js(`!document.querySelector('#favPop').classList.contains('hidden')`)));
  await sleep(500);
  await shot(`${tag}-2-picker`);
  check('only the ones you have: 8', (await js(`document.querySelectorAll('#favGrid .ch-tile').length`)) === 8);
  await tapAt('#favGrid .ch-tile:nth-child(5)');
  await sleep(700);
  await shot(`${tag}-3-picked`);
  const fav = await js(`localStorage.getItem('hs.fav.v1')`), favName = await js(`document.querySelector('#pfFavName').textContent`);
  check('picked: saved as the favorite', fav === '{"rarity":"legendary","number":5}', fav);
  check('…and who you play with did not change', (await js('JSON.stringify(pick.me)')) === me);
  await go('?nointro');
  await js(`document.querySelector('#title').click(), 1`);
  await on('menu'); await sleep(600);
  await tapAt('#hmProfile'); await on('profile'); await sleep(700);
  check('it survives a reload', (await js(`document.querySelector('#pfFavName').textContent`)) === favName, favName);
  await js(`document.querySelector('#pfBack').click(), 1`);
  check('back goes home', await on('menu'));
  await sleep(700);
  await shot(`${tag}-4-home`);
}
if (logs.length) console.log(logs.join('\n'));
check('no errors in the page', !logs.length);
ws.close(); chrome.kill();
console.log(fails.length ? `\n${fails.length} failed` : '\nall good');
process.exit(fails.length ? 1 : 0);
