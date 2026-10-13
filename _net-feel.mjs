// HOW A MATCH FEELS ON A PHONE, ONLINE AND OFF. Mobile-emulated 844x390 pages with a 4x CPU
// throttle, a fake network between them and a local server — a one-way delay, jitter, and now and
// then a stall (a phone's radio, Wi-Fi handing over), in order, as TCP delivers — and scripted
// thumbs that walk, turn, jump and kick. Every drawn frame of player A is read (game.js
// window.ON_FRAME) and scored:
//   fps        frames over 20 ms (a dropped frame at 60 Hz), and the p95 frame time
//   jumps      frames where a body's drawn motion changes by more than JERK px in one frame
//              (|p[i] - 2p[i-1] + p[i-2]|): a teleport, a snap, a stutter. The offline arcade
//              is the baseline — kicks and bounces are real jerks too.
//   ahead      how many ticks the phone predicts past the server's state (net.js), and
//   corr       the median / p95 / max correction a snapshot made, per body
// Runs:  offline   the arcade (no network: the baseline)
//        arena     PLAY with no human about: the CPU (played on the phone since 2026-10-11)
//        lan wifi mobile bad   two players in a friend room, through that network
// node _net-feel.mjs [run ...]      ROOT=<another checkout> runs that code instead (a before/after)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocketServer, WebSocket as WS } from 'ws';
import { chromePath } from './_chrome.mjs';

const ROOT = process.env.ROOT || import.meta.dirname;
const OUT = `${import.meta.dirname}/.shots/net-feel`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/data`, { recursive: true });
const SRV = 3091, PROXY = 3092, CDP = 9491, PLAY_S = Number(process.env.PLAY_S || 14), JERK = 7;
// one-way delay in ms: base + jitter (uniform) + a stall now and then
const NETS = {
  lan:    { base: 1,  jitter: 0,  stallP: 0,     stall: 0 },
  wifi:   { base: 33, jitter: 6,  stallP: 0.002, stall: 60 },
  mobile: { base: 50, jitter: 30, stallP: 0.01,  stall: 160 },
  bad:    { base: 90, jitter: 70, stallP: 0.02,  stall: 320 },
};
const RUNS = ['offline', 'arena', ...Object.keys(NETS)];
const which = process.argv.slice(2).length ? process.argv.slice(2) : RUNS;
let NETP = NETS.lan;

// ── the server, and the fake network in front of it ─────────────────────────
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(SRV), DATA_DIR: `${OUT}/data`, QUEUE_BOT_MS: '600', ARENA_VS_MS: '600', MATCH_SECONDS: String(PLAY_S + 8) }, stdio: 'ignore' });
const delay = () => NETP.base + Math.random() * NETP.jitter + (Math.random() < NETP.stallP ? NETP.stall : 0);
function pipe(send) {                     // delays each message, keeps them in order (a late one holds up the rest)
  let at = 0;
  return (data) => { const t = Math.max(Date.now() + delay(), at); at = t; setTimeout(() => send(data), t - Date.now()); };
}
const proxy = http.createServer((req, res) => {
  const up = http.request({ host: '127.0.0.1', port: SRV, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => res.end());
  req.pipe(up);
});
new WebSocketServer({ server: proxy, path: '/ws' }).on('connection', (client) => {
  const upstream = new WS(`ws://127.0.0.1:${SRV}/ws`), pending = [];
  const toServer = pipe((d) => (upstream.readyState === 1 ? upstream.send(d) : pending.push(d)));
  const toClient = pipe((d) => client.readyState === 1 && client.send(d));
  upstream.on('open', () => { for (const d of pending.splice(0)) upstream.send(d); });
  upstream.on('message', (d) => toClient(d.toString()));
  client.on('message', (d) => toServer(d.toString()));
  client.on('close', () => upstream.close());
  upstream.on('close', () => client.close());
});
proxy.listen(PROXY);
await sleep(1200);

// ── the phones: a browser each (a tab in the background gets no frames) ─────
const errs = [], browsers = [];
const until = async (f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(80); } return false; };
async function phone(name, port) {
  browsers.push(spawn(chromePath(), [`--remote-debugging-port=${port}`, '--headless=new', '--no-first-run', '--mute-audio', `--user-data-dir=${OUT}/prof-${name}`, 'about:blank'], { stdio: 'ignore' }));
  let t;
  for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(`${name}: ` + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  };
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
  const KEY = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
  const key = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: code, windowsVirtualKeyCode: KEY[code] });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const go = async (qs) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${PROXY}/${qs}` });
    await until(() => js('!!window.MENU && !!window.NET && NET.connected'), 15000);
  };
  // a player past onboarding (a starter), on the home screen
  const home = async () => {
    await go('?nointro');
    if (!(await js(`localStorage.getItem('hs.mythic.v1')`))) { await js(`localStorage.setItem('hs.mythic.v1', '{"v":1,"starter":${name === 'A' ? 1 : 3}}'), 1`); await go('?nointro'); }
    await sleep(500);
  };
  // the thumb: walk one way, a jump and a kick along the way, turn, over and over (B a beat off A)
  async function thumb(ms, phase = 0) {
    const t0 = Date.now();
    const tap = async (k) => { await key('rawKeyDown', k); await sleep(70); await key('keyUp', k); };
    await sleep(phase);
    while (Date.now() - t0 < ms) {
      for (const dir of ['ArrowRight', 'ArrowLeft']) {
        await key('rawKeyDown', dir);
        await sleep(350); await tap('ArrowUp'); await sleep(250); await tap('ArrowDown'); await sleep(250);
        await key('keyUp', dir);
        await sleep(120);
      }
    }
  }
  return { js, go, home, thumb };
}
const A = await phone('A', CDP), B = await phone('B', CDP + 1);

const RECORD = (offline) => `(() => { window.FEEL = []; window.ON_FRAME = (M, dt, now) => {
  if (!M || M.phase !== 'play') return;
  const you = ${offline} || !NET.live ? 0 : NET.you || 0, a = M.players[you], b = M.players[1 - you];
  FEEL.push([now, M.ball.x, M.ball.y, a.x, a.y, b.x, b.y, M.freeze > 0 || M.hitStop > 0 || M.ballWait > 0 ? 1 : 0]);
}; if (window.NET) NET.corrections = []; return 1; })()`;
const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
// a body's jerks (|p[i] - 2p[i-1] + p[i-2]| px) in one picture: per minute over JERK, the p99, and
// how many over 3x JERK (a jump anyone would see)
function jerks(F, j) {
  const a = [];
  for (let i = 2; i < F.length; i++) {
    if (F[i][7] || F[i - 1][7] || F[i - 2][7] || F[i][0] - F[i - 1][0] > 40 || F[i - 1][0] - F[i - 2][0] > 40) continue;
    a.push(Math.hypot(F[i][j] - 2 * F[i - 1][j] + F[i - 2][j], F[i][j + 1] - 2 * F[i - 1][j + 1] + F[i - 2][j + 1]));
  }
  const secs = (F.at(-1)?.[0] - F[0]?.[0]) / 1000 || 1;
  return { perMin: (a.filter((v) => v > JERK).length * 60) / secs, p99: +pct(a, 0.99).toFixed(1), big: a.filter((v) => v > 3 * JERK).length };
}
function score(F, corr) {
  const dts = [], jumps = { ball: 0, you: 0, opp: 0 }, worst = { ball: 0, you: 0, opp: 0 };
  for (let i = 2; i < F.length; i++) {
    const dt = F[i][0] - F[i - 1][0];
    dts.push(dt);
    if (F[i][7] || F[i - 1][7] || F[i - 2][7] || dt > 40 || F[i - 1][0] - F[i - 2][0] > 40) continue;
    [['ball', 1], ['you', 3], ['opp', 5]].forEach(([k, j]) => {
      const a = Math.hypot(F[i][j] - 2 * F[i - 1][j] + F[i - 2][j], F[i][j + 1] - 2 * F[i - 1][j + 1] + F[i - 2][j + 1]);
      if (a > JERK) jumps[k]++;
      worst[k] = Math.max(worst[k], a);
    });
  }
  const secs = (F.at(-1)?.[0] - F[0]?.[0]) / 1000 || 1;
  const c = (k) => corr.map((x) => Math.abs(x[k] ?? 0));
  const tri = (k) => [pct(c(k), 0.5), pct(c(k), 0.95), Math.max(0, ...c(k))].map((v) => +v.toFixed(1));
  return {
    fps: +(F.length / secs).toFixed(1), slow: +((100 * dts.filter((d) => d > 20).length) / (dts.length || 1)).toFixed(1),
    jumps: Object.fromEntries(Object.entries(jumps).map(([k, v]) => [k, +((v * 60) / secs).toFixed(1)])),
    worst: Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(1)])),
    ahead: [pct(corr.map((x) => x.replayed ?? 0), 0.5), pct(corr.map((x) => x.replayed ?? 0), 0.95)],
    corr: { you: tri('you'), opp: tri('opp'), ball: tri('ball') },
  };
}

for (const run of which) {
  NETP = NETS[run] || NETS.mobile;          // the arena's CPU match: through a phone's network
  let r;
  if (run === 'offline') {
    await A.go('?arcade=1&nointro');
    if (!(await until(() => A.js(`!!(window.MATCH && MATCH.phase === 'play' && MENU.screen === 'match')`), 15000))) { console.log('offline: no match'); continue; }
    await A.js(RECORD(true));
    await A.thumb(PLAY_S * 1000);
    r = score(await A.js('FEEL'), []);
  } else if (run === 'arena') {
    await A.home();
    await A.js(`document.querySelector('#title').click(), 1`);
    await until(() => A.js(`MENU.screen === 'menu'`));
    await sleep(400);
    await A.js(`document.querySelector('#hmPlay').click(), 1`);
    if (!(await until(() => A.js(`!!(window.MATCH && MATCH.phase === 'play' && MENU.screen === 'match')`), 20000))) { console.log('arena: no match'); continue; }
    const local = await A.js('!NET.live');
    await A.js(RECORD(false));
    await A.thumb(PLAY_S * 1000);
    r = { ...score(await A.js('FEEL'), await A.js('NET.corrections || []')), local };
    await A.js('NET.leave(), 1');
  } else {
    // two players in a friend room
    await Promise.all([A.home(), B.home()]);
    if (process.env.SMOOTH) for (const P of [A, B]) await P.js(`window.NET_SMOOTH = ${process.env.SMOOTH}, 1`);   // try a glide: SMOOTH='{"you":0.05,"ball":0.07,"opp":0.11}'
    await A.js('NET.create(), 1');
    if (!(await until(() => A.js('!!(NET.room && NET.room.code)')))) { console.log(`${run}: no room`); continue; }
    const code = await A.js('NET.room.code');
    await B.js(`NET.join(${JSON.stringify(code)}), 1`);
    await until(() => A.js('!!(NET.room && NET.room.members.length === 2)'));
    await A.js('NET.ready(true), 1'); await B.js('NET.ready(true), 1');
    if (!(await until(() => A.js(`!!(NET.live && window.MATCH && MATCH.phase === 'play')`), 20000))) { console.log(`${run}: no match`); continue; }
    await sleep(400);
    await A.js(RECORD(false)); await B.js(RECORD(false));
    await Promise.all([A.thumb(PLAY_S * 1000), B.thumb(PLAY_S * 1000, 430)]);
    const FA = await A.js('FEEL'), FB = await B.js('FEEL');
    r = { ...score(FA, await A.js('NET.corrections || []')), rtt: await A.js('NET.rtt') };
    // THE OPPONENT AS IT REALLY MOVED: B's own picture of itself (its thumb, predicted, all but exact)
    // against A's picture of B. What A shows beyond B's own jerks is the network's doing.
    const self = jerks(FB, 3), seen = jerks(FA, 5);
    r.oppExtra = { perMin: +(seen.perMin - self.perMin).toFixed(1), p99: [self.p99, seen.p99], big: [self.big, seen.big] };
    for (const P of [A, B]) await P.js('NET.leave(), 1');
  }
  await A.js('window.ON_FRAME = null, 1');
  const tag = r.rtt != null ? `rtt ${String(r.rtt).padStart(3)}ms` : r.local != null ? (r.local ? 'on-phone ' : 'server   ') : '         ';
  if (r.oppExtra) console.log(`        the opponent, beyond its own moves: +${r.oppExtra.perMin} jerks/min · p99 ${r.oppExtra.p99[0]} → ${r.oppExtra.p99[1]} px · over ${3 * JERK} px: ${r.oppExtra.big[0]} → ${r.oppExtra.big[1]}`);
  console.log(`${run.padEnd(7)} ${tag} · ${r.fps} fps, ${r.slow}% >20ms · jumps/min you ${r.jumps.you} opp ${r.jumps.opp} ball ${r.jumps.ball} · worst px you ${r.worst.you} opp ${r.worst.opp} ball ${r.worst.ball} · ahead ${r.ahead} · corr p50/p95/max you ${r.corr.you} opp ${r.corr.opp} ball ${r.corr.ball}`);
  await sleep(600);
}
if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 3).join(' | '));
for (const b of browsers) b.kill(); srv.kill(); proxy.close();
process.exit(0);
