// THE WELCOME POPUP AND THE BUG-REPORT FORM, WALKED in headless Chrome.
//   · an existing player (starter, tutorial done) meets the welcome popup once on the home screen,
//     in Hebrew right to left; its button closes it and a reload never brings it back
//   · on a small phone it fits; ?welcome (dev host) shows it again; Esc closes it
//   · a match (?play) never shows it, flag unset or not
//   · Options → דווחו על באג או שלחו הצעות: the form, a stand-in Google that says yes, then no —
//     "sent" only on the yes, the text kept on the no; with no form set up the pill is not there
//   (the new player's side is in _tutorial-shots.mjs: welcome right after the tutorial)
// Run: node _welcome-shots.mjs   (shots in .shots/welcome)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = 3035, BARE = 3037, STUB = 3036, CDP = 9435;
const OUT = `${import.meta.dirname}/.shots/welcome`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// a stand-in for Google's formResponse: records each post, answers with STATUS
let STATUS = 200;
const posts = [];
const stub = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { posts.push(new URLSearchParams(b)); res.writeHead(STATUS).end('ok'); });
}).listen(STUB);
const bare = await ensureServer(BARE);                       // no form set up
Object.assign(process.env, { FEEDBACK_FORM_ID: 'TEST', FEEDBACK_ENTRY_KIND: 'entry.1', FEEDBACK_ENTRY_TEXT: 'entry.2', FEEDBACK_ENTRY_VERSION: 'entry.3',
  FEEDBACK_FORM_URL: `http://127.0.0.1:${STUB}/formResponse` });
const srv = await ensureServer(PORT);
if (!srv.started || !bare.started) { console.log(`ports ${PORT}/${BARE} must be free (this harness starts its own servers)`); process.exit(1); }

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
let n = 0;
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s?.data) writeFileSync(`${OUT}/${String(++n).padStart(2, '0')}-${name}.png`, Buffer.from(s.data, 'base64')); };
const fails = [];
const check = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails.push(name); };
const until = async (f, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(50); } return false; };
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const clickEl = async (sel) => {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (r) await clickAt(r[0], r[1]);
  return !!r;
};
let W = 844, H = 390;
const size = (w, h) => { W = w; H = h; return send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); };
const up = (sel) => js(`!document.querySelector('${sel}').classList.contains('hidden')`);
const welcomeUp = () => up('#welcomePop');
const EXISTING = { 'hs.mythic.v1': '{"v":1,"starter":1}', 'hs.tutorial.v2': 'done', 'hs.team.v1': '{"v":1,"welcomed":true,"badges":0,"claimed":[],"switched":false}',
  'hs.stats.v1': '{"v":1,"points":2400,"lv":{"speed":2,"jump":1,"kick":0,"dash":0,"power":3}}' };
async function open(port, qs = '') {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/${qs}` });
  await until(() => js(`!!(window.MENU && MENU.screen)`), 4000);
}
async function home() {
  await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
  await clickAt(W / 2, H / 2);
  return until(() => js(`MENU.screen === 'menu'`), 4000);
}
const seed = (port) => open(port).then(() => js(`(() => { localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(EXISTING)})) localStorage.setItem(k, v); })()`));

await send('Page.enable');
await send('Runtime.enable');
await size(844, 390);

// ── AN EXISTING PLAYER ──
console.log('· an existing player, 844×390');
await seed(PORT);
await open(PORT, '?analytics=debug&consent=1');
check('the home screen opens', await home());
check('the welcome popup is up, once the menu is', await until(welcomeUp, 2500));
await sleep(500);
await shot('welcome-existing');
check('title, body and button as written', await js(`document.querySelector('#wcTitle').textContent === 'ברוכים הבאים לסולטיז!' && document.querySelector('.wc-body').textContent.includes('המשחק בפיתוח מוקדם') && document.querySelector('#welcomeGo').textContent.trim() === 'יאללה, בואו נשחק!'`));
check('the words run right to left', await js(`getComputedStyle(document.querySelector('.wc-body')).direction === 'rtl'`));
check('seen is kept as it opens', (await js(`localStorage.getItem('hs.welcome.v1')`)) === '1');
check('analytics: welcome_popup_seen', await js(`(window.__ANALYTICS_LOG || []).some(a => JSON.stringify(a).includes('welcome_popup_seen'))`));
await clickEl('#welcomeGo');
check('the button closes it', await until(async () => !(await welcomeUp()), 1500));
await open(PORT);
check('a reload: the home screen…', await home());
await sleep(1200);
check('…and no welcome popup', !(await welcomeUp()));

// ── A SMALL PHONE · ?welcome · Esc ──
console.log('· a small phone, 640×360');
await size(640, 360);
await open(PORT, '?welcome');
await home();
check('?welcome on a dev host shows it again', await until(welcomeUp, 2500));
await sleep(500);
await shot('welcome-small-phone');
check('it fits the screen, its ✕ too', await js(`(() => { const b = document.querySelector('.wc-panel').getBoundingClientRect(), x = document.querySelector('#welcomeX').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && x.top >= 0 && x.right <= innerWidth; })()`));
check('the ✕ is not cut off by the panel', await js(`(() => { const x = document.querySelector('#welcomeX').getBoundingClientRect(); return document.elementFromPoint(x.right - 3, x.top + x.height / 2)?.closest('#welcomeX') != null; })()`));
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
check('Esc closes it', await until(async () => !(await welcomeUp()), 1500));
await size(844, 390);

// ── NEVER IN A MATCH ──
console.log('· a match, the flag unset');
await js(`localStorage.removeItem('hs.welcome.v1')`);
await open(PORT, '?play');
check('?play is a match', await until(() => js(`MENU.screen === 'match'`), 4000));
let seenInMatch = false;
for (let i = 0; i < 30; i++) { if (await welcomeUp()) seenInMatch = true; await sleep(100); }
await shot('match-no-welcome');
check('no welcome popup over the match', !seenInMatch && !(await js(`localStorage.getItem('hs.welcome.v1')`)));

// ── THE BUG-REPORT FORM ──
console.log('· Options → report a bug');
await js(`localStorage.setItem('hs.welcome.v1', '1')`);
await open(PORT, '?analytics=debug&consent=1');
await home();
await js(`MENU.openOptions()`);
check('the pill is there when a form is set up', await until(() => js(`!document.querySelector('#oFb').hidden && document.querySelector('#oFb').getBoundingClientRect().width > 0`), 2500));
await sleep(600);
await shot('options-with-feedback');
await clickEl('#oFb');
check('it opens the form', await until(() => up('#fbPop'), 1500));
check('analytics: feedback_clicked from settings', await js(`(window.__ANALYTICS_LOG || []).some(a => JSON.stringify(a).includes('feedback_clicked') && JSON.stringify(a).includes('settings'))`));
check('send is off until a kind and some words', await js(`document.querySelector('#fbSend').disabled`));
check('the reminder: no personal details', await js(`document.querySelector('.fb-note').textContent.includes('אל תכתבו שם, טלפון, מייל')`));
check('no field asks for a name, an email or a phone', await js(`document.querySelectorAll('#fbPop input').length === 0 && document.querySelectorAll('#fbPop textarea').length === 1`));
await clickEl('.fb-kind[data-kind="bug"]');
await clickEl('#fbText');
await send('Input.insertText', { text: 'הכדור נתקע בקורה' });
check('typing reaches the box (no game key eats it)', (await js(`document.querySelector('#fbText').value`)) === 'הכדור נתקע בקורה');
check('send is on', await until(() => js(`!document.querySelector('#fbSend').disabled`), 1000));
await shot('feedback-form');
STATUS = 200;
await js(`document.activeElement.blur()`);
await clickEl('#fbSend');
check('Google says yes → "תודה! קיבלנו"', await until(() => js(`document.querySelector('#fbMsg').textContent.includes('תודה')`), 4000));
const p = posts.at(-1);
check('…and it got the kind, the words and the version, nothing else', p?.get('entry.1') === 'באג' && p?.get('entry.2') === 'הכדור נתקע בקורה' && p?.has('entry.3') && [...p.keys()].length === 3);
await shot('feedback-sent');
check('…the form closes itself', await until(async () => !(await up('#fbPop')), 3000));

STATUS = 500;
await clickEl('#oFb');
await until(() => up('#fbPop'), 1500);
check('opened again, it is empty', (await js(`document.querySelector('#fbText').value`)) === '' && (await js(`document.querySelector('#fbMsg').textContent`)) === '');
await clickEl('.fb-kind[data-kind="idea"]');
await clickEl('#fbText');
await send('Input.insertText', { text: 'עוד אלופים בבקשה' });
await js(`document.activeElement.blur()`);
await clickEl('#fbSend');
check('Google says no → the error, never "sent"', await until(() => js(`document.querySelector('#fbMsg').textContent.includes('לא הצלחנו')`), 4000) && !(await js(`document.querySelector('#fbMsg').textContent.includes('תודה')`)));
check('…the words are kept to try again', (await js(`document.querySelector('#fbText').value`)) === 'עוד אלופים בבקשה' && !(await js(`document.querySelector('#fbSend').disabled`)));
await shot('feedback-failed');
await size(640, 360); await sleep(400);
check('the form fits a small phone, its ✕ too', await js(`(() => { const b = document.querySelector('.fb-panel').getBoundingClientRect(), x = document.querySelector('#fbX').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && x.top >= 0 && x.right <= innerWidth; })()`));
await shot('feedback-small-phone');
await size(844, 390);

console.log('· no form set up');
await open(BARE);
await js(`localStorage.setItem('hs.welcome.v1', '1')`);
await home();
await js(`MENU.openOptions()`);
await sleep(1200);
check('the pill is not there', await js(`document.querySelector('#oFb').hidden`));
await shot('options-no-feedback');

console.log(logs.length ? logs.join('\n') : '  (no errors in the console)');
check('nothing threw', logs.length === 0);
console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
ws.close(); chrome.kill(); stub.close(); srv.stop(); bare.stop();
process.exit(fails.length ? 1 : 0);
