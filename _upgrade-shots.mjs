// Drive the UPGRADE SHOP through the real client in headless Chrome, and screenshot it: the points
// on the board, the shop, buying, the prices, the save, the levels reaching the match, the +N on a
// win, and that it all fits a small phone.   node _upgrade-shots.mjs  → PNGs in .shots/upgrade
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = process.env.PORT || 3029;
await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/upgrade`;
mkdirSync(OUT, { recursive: true });
rmSync(`${OUT}/prof`, { recursive: true, force: true });   // a fresh device: no saved progress
const CDP = 9469;
const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); throw new Error('chrome never came up'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};
const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};
const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
  const r = e.getBoundingClientRect(); return !e.closest('.hidden') && r.width > 0 && r.height > 0; })()`);
const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
const phone = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
const go = async (q = '') => { await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${q}` }); await sleep(1800); };
// End the running match now, on a chosen score. A decided score at 0.05s left is full time.
const finish = async (a, b) => {
  await js(`MATCH.score = [${a}, ${b}]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.clock = 0.05;`);
  for (let i = 0; i < 20; i++) { await sleep(150); if (await visible('#over')) return true; }
  return false;
};

await send('Page.enable');
await send('Runtime.enable');
await phone(844, 390);
const txt = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).textContent`);
// One row of the shop: its stat, the lit segments, the level and multiplier it reads, the price
// on it (or MAX) and whether its buy button is live.
const rows = () => js(`[...document.querySelectorAll('#upgRows .upg-row')].map(r => { const m = r.querySelector('.sh-mult').textContent;
  return { k: r.dataset.k, on: r.querySelectorAll('.sh-bars i.on').length, lv: (m.match(/רמה (\\d+)/) || [])[1], mult: '×' + (m.match(/×([\\d.]+)/) || [])[1],
    btn: r.querySelector('.sh-price b').textContent, dis: r.querySelector('.upg-buy').disabled }; })`);
const openShop = async () => { await click('#selShop'); await sleep(350); };
const key = async (code) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 27 }); await sleep(200); };

// ── 1. a fresh player: no points, level 0, nothing to buy ───────────────────
await go('?resetstats&unlockall&arcade');
await shot('01-select');
check('Player Select has the SHOP button (HS: bottom-left)', await visible('#selShop'));
check('…and shows your stats, all empty for a new player', await js(`document.querySelectorAll('#selStats .m-bars i.on').length`) === 0);
await openShop();
await shot('02-shop-empty');
let r = await rows();
check('the shop opens with five stats, all on level 0 (x1)', await visible('#shop') && r.length === 5 && r.every((x) => x.on === 0 && x.lv === '0' && x.mult === '×1'), JSON.stringify(r.map((x) => x.lv + x.mult)));
check('…every first level 500, none affordable', r.every((x) => x.btn === '500' && x.dis));
check('MY POINT reads 0', await txt('#upgPts') === '0');
await key('Enter');
check('Enter in the shop does not start a match', await visible('#shop') && !(await visible('#match')));
await key('Escape');
check('Esc goes back to Player Select', !(await visible('#shop')) && await visible('#select'));

// ── 2. points to spend: buy, and the prices climb ───────────────────────────
await go('?points=4000&arcade');
await openShop();
check('?points=4000 shows 4,000', await txt('#upgPts') === '4,000');
await click('#upgRows .upg-row[data-k="speed"] .upg-buy'); await sleep(80);
await click('#upgRows .upg-row[data-k="speed"] .upg-buy'); await sleep(80);
await click('#upgRows .upg-row[data-k="kick"] .upg-buy'); await sleep(80);
r = await rows();
const sp = r.find((x) => x.k === 'speed'), ki = r.find((x) => x.k === 'kick');
await sleep(500);                     // the counter runs down
const MULT = await js(`import('/shared/hs-powers.js').then((m) => ({ s2: m.statMult('speed', 2), s3: m.statMult('speed', 3), k1: m.statMult('kick', 1) }))`);
check('two speed levels and one kick bought: 500 + 1,000 + 500', sp.on === 2 && sp.lv === '2' && sp.mult === '×' + MULT.s2 && ki.on === 1 && await txt('#upgPts') === '2,000', `speed ${sp.lv} ${sp.mult} kick ${ki.lv} points ${await txt('#upgPts')}`);
check('…the next speed level costs 2,000, the next kick 1,000, both affordable', sp.btn === '2,000' && ki.btn === '1,000' && !sp.dis && !ki.dis);
await shot('03-shop-bought');
await click('#upgRows .upg-row[data-k="speed"] .upg-buy'); await sleep(500);
r = await rows();
check('2,000 buys speed level 3 and leaves 0; nothing affordable now', r.find((x) => x.k === 'speed').lv === '3' && await txt('#upgPts') === '0' && r.every((x) => x.dis));
await click('#shopBack'); await sleep(300);
check('BACK: Player Select shows the new levels', await js(`document.querySelectorAll('#selStats .m-bars i.on').length`) === 4);

// ── 3. it is saved, and the arcade plays the player on it ───────────────────
await go('?arcade');
check('a reload keeps the points and the levels', (await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).points`)) === 0 && (await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).lv.speed`)) === 3);
await go('?arcade=1'); await sleep(500);
const st = await js(`({ speed: MATCH.players[0].stats.speed, kick: MATCH.players[0].stats.kick, jump: MATCH.players[0].stats.jump, rate: MATCH.players[0].meterRate })`);
check(`in the match the player runs on speed level 3 (${MULT.s3}x) and kicks on level 1 (${MULT.k1}x)`, st && st.speed === MULT.s3 && st.kick === MULT.k1 && st.jump === 1 && st.rate === 1, JSON.stringify(st));
const ok = await finish(3, 0);
await sleep(1600);
await shot('04-win-points');
check('a win over champion 1: REWARD 100, TOTAL 100', ok && await txt('#ovReward') === '100' && await txt('#ovTotal') === '100', `${await txt('#ovReward')} / ${await txt('#ovTotal')}`);
await click('#again'); await sleep(500);
await openShop();
check('…and the shop has them', await txt('#upgPts') === '100');

// ── 4. it fits a small phone ────────────────────────────────────────────────
await phone(667, 375); await go('?arcade'); await sleep(300);
await openShop();
await shot('06-shop-667x375');
check('667x375: every buy button and BACK are on screen', await js(`[...document.querySelectorAll('#upgRows .upg-buy'), document.querySelector('#shopBack')].every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1; })`));

const played = await js(`import('/audio.js').then((a) => { a.SFX.buy(false); a.SFX.buy(true); return true; }).catch((e) => String(e))`);
check('the purchase chime plays (both the plain and the level-10 one)', played === true, String(played));
await phone(844, 390); await go('?points=inf&arcade');
await openShop();
check('?points=inf gives 9,999,999,999', await txt('#upgPts') === '9,999,999,999');
for (let i = 0; i < 10; i++) await click('#upgRows .upg-row[data-k="power"] .upg-buy');
await sleep(500);
r = await rows();
check('…enough to take a stat to 10: MAX, and 511,500 spent', r.find((x) => x.k === 'power').lv === '10' && r.find((x) => x.k === 'power').btn === 'MAX' && await txt('#upgPts') === '9,999,488,499');
await shot('07-shop-inf');
check('no exceptions or console errors', logs.length === 0, logs.join(' | '));
ws.close(); chrome.kill();
console.log(fails.length ? `upgrade-shots: ${fails.length} failed` : 'upgrade-shots: all passed');
process.exit(fails.length ? 1 : 0);
