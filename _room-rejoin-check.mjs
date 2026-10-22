// A FRIEND'S ROOM AFTER THE HOST'S CONNECTION DROPS (2026-10-22): the lobby on screen takes its seat back.
// Run: node _room-rejoin-check.mjs
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = 3035, CDP = 9435, PROF = `${import.meta.dirname}/.shots/rejoin-prof`;
rmSync(PROF, { recursive: true, force: true });
await ensureServer(PORT);
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', `--user-data-dir=${PROF}`, 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(), logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails?.exception?.description); };
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(100); } return false; };
const fails = []; const check = (n, c, e = '') => { console.log(`  ${c ? '✓' : '✗'} ${n}${e ? '  — ' + e : ''}`); if (!c) fails.push(n); };
await send('Runtime.enable');
// a player who has done the first launch, opening a room as host
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?nointro` });
await until(() => js(`typeof MENU !== 'undefined' && !!MENU.screen`), 8000);
await js(`(() => { localStorage.setItem('hs.mythic.v1', JSON.stringify({ v: 1, starter: 2 })); localStorage.setItem('hs.tutorial.v2', 'done'); return 1; })()`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?nointro` });
await until(() => js(`typeof MENU !== 'undefined' && !!MENU.screen`), 8000);
await js(`MENU.openMp(), 1`); await sleep(200); await js(`document.querySelector('#hostBtn').click(), 1`);
check('the host has a room', await until(() => js(`!!(NET && NET.room && NET.room.code)`), 8000));
const code = await js(`NET.room.code`), id0 = await js(`NET.id`);
// the phone goes to the background: its socket drops
await js(`NET.ws.close(); 1`);
check('…the connection dropped', await until(() => js(`!NET.connected`), 3000));
check('…comes back by itself', await until(() => js(`NET.connected`), 8000));
check('…and is back in the same room, on its new connection', await until(() => js(`NET.room && NET.room.code === ${JSON.stringify(code)} && NET.id !== ${JSON.stringify(id0)} && NET.room.members.some(m => m.id === NET.id)`), 4000), await js(`JSON.stringify([NET.room?.code, NET.id, NET.room?.members?.map(m=>m.id)])`));
check('…the lobby still shows its code, with no error', (await js(`document.querySelector('#roomCode').textContent`)) === code && !(await js(`/לא נמצא/.test(document.querySelector('#lobbyHint').textContent)`)));
check('nothing threw', logs.length === 0, logs.join(' | '));
ws.close(); chrome.kill();
console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
process.exit(fails.length ? 1 : 0);
