// A ROOM, PLAYED THROUGH. Two real tabs on one server: the host opens a room, the guest TYPES
// its code, both get ready, the match runs to its result, and then each result button has to
// go where it says. Run: node _online-flow.mjs
//
// What it guards (docs/HS-MENUS.md §6, the online bugs):
//   · a code with A, D or J in it can be typed (the game keys used to eat those letters);
//   · each side reads its OWN result — the guest is player 1, and used to be told player 0's;
//   · "play again" goes back to the room, not into an offline bot match;
//   · "leave" leaves the room, so the friend is not left waiting on a ghost.
// The server runs 5-second matches that kick off at 0:2 (MATCH_SECONDS, TEST_SCORE).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';

const PORT = Number(process.env.PORT || 3078), CDP = 9478;
const OUT = `${import.meta.dirname}/.shots/online`;
for (const i of [0, 1]) rmSync(`${OUT}/prof${i}`, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Every selector the flow touches, in one place: the menus are being rebuilt (hs/menus).
const S = {
  toMulti: [],                             // MENU.openMp() opens the multiplayer popup (below)
  host: '#hostBtn', join: '#joinBtn', code: '#roomCode', codeInput: '#codeInput', joinGo: '#joinGo',
  ready: '#readyBtn', lobby: '#lobby', seats: '#seats .seat:not(.empty)',
  match: '#match', over: '#over', spell: '#ovSpell', again: '#again', back: '#back', menu: '#menu',
};

const srv = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), MATCH_SECONDS: '5', TEST_SCORE: '0:2' }, stdio: 'ignore',
});
// One Chrome per player: a background tab's frames are throttled, and the host would stop
// sending its inputs the moment the guest's tab opened in front of it.
const chromes = [0, 1].map((i) => spawn(chromePath(), [`--remote-debugging-port=${CDP + i}`, '--headless=new',
  '--no-first-run', '--mute-audio', `--user-data-dir=${OUT}/prof${i}`, 'about:blank'], { stdio: 'ignore' }));
const bye = (code) => { for (const c of chromes) c.kill(); srv.kill(); process.exit(code); };
for (const i of [0, 1]) for (let k = 0; k < 60; k++) { await sleep(200); try { await fetch(`http://127.0.0.1:${CDP + i}/json/version`); break; } catch {} }
for (let i = 0; i < 60; i++) { await sleep(200); try { await fetch(`http://127.0.0.1:${PORT}/version`); break; } catch {} }

const errors = [];
async function tab(name, url, port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(`${name}: ${m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text}`);
  };
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 520, deviceScaleFactor: 1, mobile: false });
  const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.closest('.hidden')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.click(), 1`);
  const text = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);
  // A real key, the way a keyboard sends it: keydown (with its text) then keyup.
  const key = async (code, k, type = 'both') => {
    const vk = k.length === 1 ? k.toUpperCase().charCodeAt(0) : { ArrowRight: 39, ArrowDown: 40, ArrowUp: 38, Space: 32 }[code] || 0;
    if (type !== 'up') await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk });
    if (type !== 'down') await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk });
  };
  const shot = async (n) => writeFileSync(`${OUT}/${name}-${n}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  return { send, js, visible, click, text, key, shot };
}
const until = async (f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(100); } return false; };

let fails = 0;
const check = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails++; };

const A = await tab('host', `http://127.0.0.1:${PORT}/?nointro`, CDP);
const B = await tab('guest', `http://127.0.0.1:${PORT}/?nointro`, CDP + 1);
await sleep(1500);

for (const T of [A, B]) await T.js('MENU.openMp(), 1');
await sleep(150);
await A.click(S.host);
check('the host gets a room code', await until(async () => /^[A-Z0-9]{4}$/.test(await A.text(S.code))));
const code = await A.text(S.code);

await sleep(200);
await B.click(S.join);
await sleep(200);
await B.js(`document.querySelector('${S.codeInput}').focus(), 1`);
for (const c of 'adj') await B.key('Key' + c.toUpperCase(), c);
check('A, D and J can be typed into the code', (await B.js(`document.querySelector('${S.codeInput}').value`)) === 'ADJ',
  await B.js(`document.querySelector('${S.codeInput}').value`));
await B.js(`document.querySelector('${S.codeInput}').value = '', 1`);
for (const c of code) await B.key(/\d/.test(c) ? 'Digit' + c : 'Key' + c, c.toLowerCase());
await B.click(S.joinGo);
check('both seats fill', await until(async () => (await A.js(`document.querySelectorAll('${S.seats}').length`)) === 2));

for (const T of [A, B]) await until(async () => !(await T.js(`document.querySelector('${S.ready}').disabled`)));
await A.click(S.ready); await B.click(S.ready);
check('the match starts for both', await until(async () => (await A.visible(S.match)) && (await B.visible(S.match))));

// The server kicks off at 0:2 (TEST_SCORE), so the guest wins without anyone having to score.
const done = until(async () => (await A.visible(S.over)) && (await B.visible(S.over)), 30000);
check('both reach the result', await done);
await A.shot('result'); await B.shot('result');

const score = await A.js(`MATCH ? [...MATCH.score] : null`);
const aWord = await A.js(`document.querySelector('${S.spell}').className`);
const bWord = await B.js(`document.querySelector('${S.spell}').className`);
check('the host reads its own result', score && /\bwin\b/.test(aWord) === (score[0] > score[1]), `${score} host:${aWord}`);
check('the guest reads ITS own result, not the host\'s', score && /\bwin\b/.test(bWord) === (score[1] > score[0]), `${score} guest:${bWord}`);
check('the guest won 2-0 and is told so; the host is told it lost', /\bwin\b/.test(bWord) && /\blose\b/.test(aWord), `host:${aWord} guest:${bWord}`);
check('the buttons say "play again" and "leave"', (await A.text(S.again)) === 'משחק חוזר' && (await A.text(S.back)) === 'יציאה',
  `${await A.text(S.again)} / ${await A.text(S.back)}`);

await B.click(S.again);
check('"play again" goes back to the room', await until(() => B.visible(S.lobby), 3000));
check('…not into a match against the bot', !(await B.js(`!!(MATCH && !document.querySelector('#match').classList.contains('hidden'))`)));

await A.click(S.back);
check('"leave" goes to the menu', await until(() => A.visible(S.menu), 3000));
check('…and leaves the room: the guest sees an empty seat', await until(async () => (await B.js(`document.querySelectorAll('${S.seats}').length`)) === 1, 5000));
await B.shot('lobby-after');

check('no page exceptions', errors.length === 0, errors.join(' | '));
console.log(`\n_online-flow: ${fails ? fails + ' FAILED' : 'all passed'}  (shots → ${OUT})`);
bye(fails ? 1 : 0);
