// FRIEND ROOMS, END TO END — three phones (isolated browser contexts) on a server of our own.
// 2026-10-22: the host's dropped connection takes its seat back.
// 2026-11-20: a join that finds no room is said once, plainly, counted once by why (never / closed / expired /
// retry), and never sent again by itself. The live stats had 282 not-found joins against 240 rooms: one kid made
// many (a host's phone retrying its swept room on every return, JOIN tapped again and again, ?room= left in the URL).
// Run: node _room-rejoin-check.mjs
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';

const PORT = 3035, CDP = 9435, PROF = `${import.meta.dirname}/.shots/rejoin-prof`, BASE = `http://127.0.0.1:${PORT}`;
// a server or Chrome left on these ports would be tested instead of ours: say so rather than test the wrong thing
const busy = async (port) => { try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) }); return true; } catch { return false; } };
for (const p of [PORT, CDP]) if (await busy(p)) { console.log(`✗ port ${p} is already in use — stop what holds it (lsof -i :${p}) and run again`); process.exit(1); }
rmSync(PROF, { recursive: true, force: true });
// our own server: nothing kept (DATA_DIR=:memory:), so the room counts start at 0; a 2 s grace for the swept room
const server = spawn(process.execPath, ['server.js'], { cwd: import.meta.dirname, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATA_DIR: ':memory:', TEST_ROOM_GRACE_MS: '2000' } });
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', `--user-data-dir=${PROF}`, 'about:blank'], { stdio: 'ignore' });
let ver;
for (let i = 0; i < 60 && !ver; i++) { await sleep(200); try { ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json(); } catch {} }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails?.exception?.description); };
const cdp = (method, params = {}, sessionId) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(100); } return false; };
const fails = []; const check = (n, c, e = '') => { console.log(`  ${c ? '✓' : '✗'} ${n}${e ? '  — ' + e : ''}`); if (!c) fails.push(n); };

// one phone = one isolated browser context, with its own localStorage
async function phone() {
  const { browserContextId } = await cdp('Target.createBrowserContext');
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  for (const d of ['Runtime', 'Page', 'Network']) await cdp(`${d}.enable`, {}, sessionId);
  const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId))?.result?.value;
  const booted = () => until(() => js(`typeof MENU !== 'undefined' && !!MENU.screen`), 8000);
  const go = async (path) => { await cdp('Page.navigate', { url: BASE + path }, sessionId); await sleep(300); await booted(); };
  const reload = async () => { await cdp('Page.reload', {}, sessionId); await sleep(300); await booted(); };
  const offline = (on) => cdp('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
  const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); };
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click(), 1`);
  const hint = () => js(`document.querySelector('#lobbyHint').textContent`);
  const newRoomShown = () => js(`!document.querySelector('#newRoomBtn').classList.contains('hidden')`);
  return { js, go, reload, offline, tap, click, hint, newRoomShown };
}
async function onboarded(p) {
  await p.go('/?nointro');
  await p.js(`localStorage.setItem('hs.mythic.v1', JSON.stringify({ v: 1, starter: 2 })); localStorage.setItem('hs.tutorial.v2', 'done'); 1`);
  await p.go('/?nointro');
}
async function host(p) {
  await p.js(`MENU.openMp(), 1`); await sleep(200); await p.click('#hostBtn');
  await until(() => p.js(`!!(NET && NET.room && NET.room.code)`), 8000);
  return p.js(`NET.room.code`);
}
async function typeJoin(p, code, taps = 1) {
  await p.js(`MENU.openMp(), 1`); await sleep(200); await p.click('#joinBtn');
  // the menu opens the lobby a beat after the tap (menus.js press): type only once it is up
  await until(() => p.js(`MENU.screen === 'lobby' && typeof NET !== 'undefined' && NET && NET.connected && /הכנס/.test(document.querySelector('#lobbyHint').textContent)`), 8000);
  await sleep(300);
  await p.js(`(() => { const i = document.querySelector('#codeInput'); i.value = ${JSON.stringify(code)}; i.dispatchEvent(new Event('input')); return 1; })()`);
  for (let i = 0; i < taps; i++) { await p.click('#joinGo'); await sleep(300); }
}
// the server's room counts for today (shared/play-stats.js friendRooms): counts only, nothing names anyone
const rooms = async () => (await (await fetch(`${BASE}/stats/history`)).json()).days?.[0]?.friendRooms || {};
const failed = async () => (await rooms()).failed || {};
const delta = (a, b) => Object.fromEntries(Object.keys({ ...a, ...b }).map((k) => [k, (b[k] || 0) - (a[k] || 0)]).filter(([, n]) => n));
const same = (d, want) => JSON.stringify(Object.entries(d).sort()) === JSON.stringify(Object.entries(want).sort());

await until(async () => { try { await fetch(BASE + '/version'); return true; } catch { return false; } }, 8000);
const A = await phone(), B = await phone(), C = await phone();
await onboarded(A); await onboarded(C);

// ── 1. the host's connection drops and comes back within the grace: same room, new connection (2026-10-22) ──
console.log('the host drops and comes back within the grace');
let code = await host(A);
check('the host has a room', !!code);
const id0 = await A.js(`NET.id`);
await A.js(`NET.ws.close(); 1`);
check('…the connection dropped', await until(() => A.js(`!NET.connected`), 3000));
check('…comes back by itself', await until(() => A.js(`NET.connected`), 8000));
check('…and is back in the same room, on its new connection', await until(() => A.js(`NET.room && NET.room.code === ${JSON.stringify(code)} && NET.id !== ${JSON.stringify(id0)} && NET.room.members.some(m => m.id === NET.id)`), 4000));
check('…the lobby still shows its code, with no error', (await A.js(`document.querySelector('#roomCode').textContent`)) === code && !(await A.newRoomShown()));

// ── 2. the share link, and a brand-new friend who opens it: starter, tutorial, then the room ──
console.log('a brand-new friend opens the link');
await A.click('#copyLink'); await sleep(300);
const link = await A.hint();
check('the share link is this server + ?room=CODE', !/room=/.test(link) || link === `${BASE}/?room=${code}`, link);
let f0 = await failed();
await B.go(`/?room=${code}`);
await until(() => B.js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await B.tap(200, 300);
check('…the starter pick first', await until(() => B.js(`!document.querySelector('#starter').classList.contains('hidden')`), 4000));
await B.click('#stRow .st-card[data-n="2"]'); await sleep(200); await B.click('#stGo'); await sleep(250); await B.click('#stYes');
check('…then the tutorial, and the link is kept while it plays', await until(() => B.js(`TUTORIAL.on`), 4000) && /room=/.test(await B.js(`location.search`)));
await B.js(`TUTORIAL.toPlay(), 1`);
check('…then the room: the friend is in it', await until(() => A.js(`NET.room.members.length === 2`), 6000));
check('…the link left the URL once the join was sent', !/room=/.test(await B.js(`location.search`)), await B.js(`location.search`));
check('…no failure counted', same(delta(f0, await failed()), {}));
await B.click('#lobbyBack'); await sleep(300);

// ── 3. the host's phone is away past the grace: told once, the room cleared, never retried ──
console.log('the host is away past the grace');
f0 = await failed();
await A.offline(true); await A.js(`NET.ws.close(), 1`);
await sleep(9000);                                       // the 2 s grace + the 5 s sweep
await A.offline(false);
check('the phone comes back', await until(() => A.js(`NET.connected`), 40000));
check('…the lobby says the room is closed, with a "new room" button', await until(() => A.newRoomShown(), 4000) && /נסגר/.test(await A.hint()), await A.hint());
check('…the dead code is gone from the screen and from NET', (await A.js(`document.querySelector('#roomCode').textContent`)) === '····' && (await A.js(`NET.room`)) === null);
for (let i = 0; i < 2; i++) { await A.js(`NET.ws.close(), 1`); await until(() => A.js(`!NET.connected`), 3000); await until(() => A.js(`NET.connected`), 10000); await sleep(800); }
check('…two more app switches send nothing: one failure, counted as "expired"', same(delta(f0, await failed()), { 'not-found:expired': 1 }), JSON.stringify(delta(f0, await failed())));
await A.click('#newRoomBtn');
check('…"new room" opens a fresh room', await until(async () => { const c = await A.js(`NET.room && NET.room.code`); return c && c !== code; }, 6000) && !(await A.newRoomShown()));
code = await A.js(`NET.room.code`);

// ── 4. a wrong code, JOIN tapped five times ──
console.log('a wrong code, JOIN tapped five times');
f0 = await failed();
await typeJoin(C, 'ZZZZ', 5);
check('…one message: check the code (no "new room" for a typo)', /בדקו את הקוד/.test(await C.hint()) && !(await C.newRoomShown()), await C.hint());
check('…one failure, counted as "never"', same(delta(f0, await failed()), { 'not-found:never': 1 }), JSON.stringify(delta(f0, await failed())));
await C.js(`(() => { const i = document.querySelector('#codeInput'); i.value = 'שדגכ'; i.dispatchEvent(new Event('input')); return i.value; })()`);
check('a Hebrew keyboard types the Latin letter on the same key (שדגכ → ASDF)', (await C.js(`document.querySelector('#codeInput').value`)) === 'ASDF');

// ── 5. the host presses back; the friend types the right code ──
console.log('the host leaves; the friend types the code');
await A.click('#lobbyBack'); await sleep(400);
f0 = await failed();
await C.go('/?nointro'); await typeJoin(C, code, 2);
check('…"the room is closed", with a "new room" button', /נסגר/.test(await C.hint()) && (await C.newRoomShown()), await C.hint());
check('…one failure, counted as "closed"', same(delta(f0, await failed()), { 'not-found:closed': 1 }), JSON.stringify(delta(f0, await failed())));

// ── 6. a page on the dead link, reloaded (a restored tab, a WebView reload) ──
console.log('a dead link, then reloads');
await onboarded(B);
f0 = await failed();
await B.go(`/?room=${code}`); await sleep(1500);
check('…the link is tried once and leaves the URL', !/room=/.test(await B.js(`location.search`)), await B.js(`location.search`));
await B.reload(); await sleep(1200); await B.reload(); await sleep(1200);
check('…two reloads try nothing: one failure, "closed"', same(delta(f0, await failed()), { 'not-found:closed': 1 }), JSON.stringify(delta(f0, await failed())));
f0 = await failed();
await B.go(`/?room=${code}`); await sleep(1500);
check('…the same phone opening the same dead link again is a "retry"', same(delta(f0, await failed()), { 'not-found:retry': 1 }), JSON.stringify(delta(f0, await failed())));

console.log('\n  rooms today:', JSON.stringify(await rooms()));
check('nothing threw', logs.length === 0, logs.join(' | '));
console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
ws.close(); chrome.kill(); server.kill();
process.exit(fails.length ? 1 : 0);
