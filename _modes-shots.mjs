// THE GAME MODES, walked: home → the mode button → five big picture cards in a row that scrolls sideways,
// the mode you have in a gold frame → swipe → pick the tournament → home says so → back: it is the chosen
// one, the row starts at the arena, and the scroll is free. Photographs each step at phone sizes. Run: node _modes-shots.mjs   (shots in .shots/modes)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT || 3037), CDP = 9437;
const OUT = `${import.meta.dirname}/.shots/modes`;
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

await send('Page.enable'); await send('Runtime.enable');
const go = async (qs) => { await send('Page.navigate', { url: `http://localhost:${PORT}/${qs}` }); await until(() => js('!!window.MENU'), 8000); await sleep(500); };

for (const [w, h, tag] of [[844, 390, 'iphone'], [740, 360, 'android'], [1024, 768, 'ipad']]) {
  console.log(`· ${w}×${h}`);
  await size(w, h);
  await go('?nointro');
  await js(`localStorage.clear(), localStorage.setItem('hs.mythic.v1', '{"v":1,"starter":2}'), 1`);
  await go('?nointro');
  await js(`document.querySelector('#title').click(), 1`);
  check('home', await on('menu'));
  await sleep(700);
  // (the home screen's entrance runs a moment: tap again until the modes are up)
  check('the mode button opens the modes', await until(async () => { await tapAt('#hmModes'); return on('modes'); }, 8000));
  await sleep(900);
  await shot(`${tag}-1-modes`);
  check('five cards, in order', (await js(`[...document.querySelectorAll('#mdRow .mn-mode')].map(b => b.dataset.mode).join()`)) === 'arena,arcade,tournament,multi,practice');
  check('every picture loaded', await until(() => js(`Promise.all([...document.querySelectorAll('#mdRow .mn-mode')].map(b => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = 'img/modes/' + b.dataset.mode + '.webp'; }))).then(a => a.every(Boolean))`)));
  const fit = await js(`(() => { const r = document.querySelector('#mdRow'), b = r.querySelector('.mn-mode').getBoundingClientRect(); return [r.scrollWidth > r.clientWidth + 10, +(r.clientWidth / b.width).toFixed(2), b.bottom <= innerHeight, b.top >= 0]; })()`);
  check('the row scrolls sideways; about 3 cards on the screen; the cards fit top to bottom', fit[0] && fit[1] >= 2.9 && fit[1] <= 3.7 && fit[2] && fit[3], JSON.stringify(fit));
  // the backdrop's symbols drift down-right
  const at = () => js(`new DOMMatrix(getComputedStyle(document.querySelector('#modes .md-sym')).transform).m41`);
  const d0 = await at(); await sleep(600); const d1 = await at();
  check('the symbols drift', d1 !== d0, `${d0} → ${d1}`);
  check('the arena (the mode you have) is the chosen one', (await js(`[...document.querySelectorAll('#mdRow .mn-mode.sel')].map(b => b.dataset.mode).join()`)) === 'arena');
  check('every card has its name', (await js(`[...document.querySelectorAll('#mdRow .mn-name')].every(n => n.textContent && n.getBoundingClientRect().width > 0)`)));
  // swipe to the tournament and pick it
  // a swipe moves the row only (scrollIntoView would also scroll the screen under it)
  await js(`(() => { const r = document.querySelector('#mdRow'), b = r.querySelector('[data-mode="tournament"]'); r.scrollLeft = b.offsetLeft - (r.clientWidth - b.offsetWidth) / 2; })(), 1`);
  await sleep(500);
  await shot(`${tag}-2-scrolled`);
  check('tapping a card picks it and goes home', (await tapAt('[data-mode="tournament"]')) && await on('menu'));
  check('…and the home button says so', (await js(`document.querySelector('#hmModes').dataset.mode`)) === 'tournament');
  await sleep(600);
  await tapAt('#hmModes'); await on('modes'); await sleep(900);
  check('back on the modes: the tournament is chosen', (await js(`document.querySelector('#mdRow .mn-mode.sel')?.dataset.mode`)) === 'tournament');
  check('…and the row starts from the left, at the arena', (await js(`document.querySelector('#mdRow').scrollLeft`)) === 0);
  // free scrolling: a stop between two cards stays there (no snapping)
  await js(`document.querySelector('#mdRow').scrollLeft = 137, 1`); await sleep(700);
  check('the scroll is free: it stays between two cards', Math.abs((await js(`document.querySelector('#mdRow').scrollLeft`)) - 137) <= 1);
  await shot(`${tag}-3-chosen`);
  await js(`document.querySelector('#mdBack').click(), 1`);
  check('back goes home', await on('menu'));
}
if (logs.length) console.log(logs.join('\n'));
check('no errors in the page', !logs.length);
ws.close(); chrome.kill();
console.log(fails.length ? `\n${fails.length} failed` : '\nall good');
process.exit(fails.length ? 1 : 0);
