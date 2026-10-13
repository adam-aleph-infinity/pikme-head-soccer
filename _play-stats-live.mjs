// PLAY STATS IN A REAL BROWSER: open the game, leave it, read /stats/history. Muted, headless.
// Run: node _play-stats-live.mjs   (spawns its own server on a free port with an in-memory store)
import { spawn } from 'node:child_process';
import { chromePath } from './_chrome.mjs';
import os from 'node:os';
import path from 'node:path';

const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0', DATA_DIR: ':memory:' }, stdio: 'pipe' });
const base = await new Promise((ok) => { let o = ''; srv.stdout.on('data', (b) => { o += b; const m = o.match(/localhost:(\d+)/); if (m) ok(`http://localhost:${m[1]}`); }); });
const prof = path.join(os.tmpdir(), `ps-live-${process.pid}`);
const chrome = spawn(chromePath(), ['--headless=new', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--window-size=874,402', 'about:blank'], { stdio: 'pipe' });
const wsUrl = await new Promise((ok) => { let e = ''; chrome.stderr.on('data', (b) => { e += b; const m = e.match(/ws:\/\/\S+/); if (m) ok(m[0]); }); });
const sock = new WebSocket(wsUrl);
await new Promise((ok) => sock.addEventListener('open', ok));
let id = 0; const wait = new Map();
sock.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d.result); wait.delete(d.id); } });
const cdp = (method, params = {}, sessionId) => new Promise((ok) => { const i = ++id; wait.set(i, ok); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
await cdp('Page.enable', {}, sessionId);
await cdp('Page.navigate', { url: `${base}/?playstats=send` }, sessionId);
await sleep(5000);
await cdp('Page.navigate', { url: 'about:blank' }, sessionId);   // pagehide → the beacon
await sleep(1500);
await cdp('Page.navigate', { url: `${base}/?playstats=send` }, sessionId);   // the same device, again today
await sleep(3000);
await cdp('Page.navigate', { url: 'about:blank' }, sessionId);
await sleep(1500);
const h = await (await fetch(`${base}/stats/history`)).json();
const t = h.days[0] || {};
console.log(JSON.stringify(t));
const good = t.opens === 2 && t.players === 1 && t.newPlayers === 1 && h.allTime.players === 1;
console.log(good ? '✓ two opens, one player, one new player' : '✗ unexpected numbers');
chrome.kill(); srv.kill(); sock.close();
process.exit(good ? 0 : 1);
