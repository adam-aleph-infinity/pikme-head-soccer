// Two REAL browser clients playing each other through the real server.
//
// `test-online.mjs` proves the protocol with hand-written node clients; this proves the
// thing a person will actually touch — the lobby, the share link, the rollback client, the
// renderer — and screenshots both halves so the result can be looked at rather than asserted.
//
//   node _duo.mjs            (expects a server already on PORT, default 3020)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT || 3020;
const OUT = process.env.SHOT_OUT ||
  '/private/tmp/claude-501/-Users-adamleeperelman-Documents-pikeme/09ade469-cc19-4722-96c1-c6973e0f4a82/scratchpad/duo';
const CDP = 9466;
mkdirSync(OUT, { recursive: true });

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });

const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};

async function newTab(url) {
  const res = await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}

function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pend = new Map();
  const logs = [];
  let id = 0;
  const ready = new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    }
  };
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
  };
  const KEYCODE = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, KeyJ: 74 };
  const hold = async (code, ms) => {
    const k = { code, key: code, windowsVirtualKeyCode: KEYCODE[code], nativeVirtualKeyCode: KEYCODE[code] };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
    await sleep(ms);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
  };
  return { ws, send, evalJs, shot, hold, ready, logs };
}

const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); }
  return null;
};

// --- boot two tabs ----------------------------------------------------------
let ok = false;
for (let i = 0; i < 60 && !ok; i++) {
  await sleep(200);
  try { await fetch(`http://127.0.0.1:${CDP}/json/list`); ok = true; } catch {}
}
const base = `http://127.0.0.1:${PORT}`;
const tA = attach(await newTab(`${base}/?me=legendary_3`));
await tA.ready;
await tA.send('Page.enable'); await tA.send('Runtime.enable');
await tA.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });
await sleep(2200);

// --- host creates a room ----------------------------------------------------
await tA.evalJs(`document.getElementById('hostBtn').click()`);
const code = await until(async () => {
  const c = await tA.evalJs(`document.getElementById('roomCode').textContent`);
  return c && c !== '····' ? c : null;
});
check('the host gets a room code', !!code && code.length === 4, String(code));
await tA.shot('01-host-lobby');

const link = await tA.evalJs(`location.origin + '/?room=' + document.getElementById('roomCode').textContent`);
check('the share link carries the code', !!link && link.includes(`room=${code}`), link);

// --- the guest opens the SHARE LINK ----------------------------------------
const tB = attach(await newTab(link.replace('127.0.0.1', '127.0.0.1').replace(/^http:\/\/[^/]+/, base) + '&me=epic_7'));
await tB.ready;
await tB.send('Page.enable'); await tB.send('Runtime.enable');
await tB.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 500, deviceScaleFactor: 1, mobile: false });

const joined = await until(async () => {
  const n = await tA.evalJs(`(MATCH ? 2 : document.querySelectorAll('#seats .seat:not(.empty)').length)`);
  return n >= 2 ? n : null;
});
check('opening the share link joins the room', joined >= 2, `${joined} seats filled`);
await tB.shot('02-guest-lobby');

const seatsB = await tB.evalJs(`document.querySelectorAll('#seats .seat:not(.empty)').length`);
check('the guest sees both players too', seatsB >= 2, `${seatsB}`);

// --- both ready → match -----------------------------------------------------
await tA.evalJs(`document.getElementById('readyBtn').click()`);
await tB.evalJs(`document.getElementById('readyBtn').click()`);
const started = await until(async () => (await tA.evalJs(`!!MATCH && !document.getElementById('match').classList.contains('hidden')`)) || null);
check('both ready starts the match on the host', !!started);
const startedB = await until(async () => (await tB.evalJs(`!!MATCH && !document.getElementById('match').classList.contains('hidden')`)) || null);
check('and on the guest', !!startedB);

// --- play -------------------------------------------------------------------
await until(async () => (await tA.evalJs(`MATCH.phase === 'play'`)) || null, 8000);
// Key events go to the page's focused document. With two tabs open, the SECOND one holds
// focus, so every keystroke aimed at the host vanished and read as "the client is broken".
await tA.send('Page.bringToFront');
await tA.evalJs(`window.focus(); document.body.focus();`);
await sleep(200);
const beforeA = await tA.evalJs(`MATCH.players[0].x`);
for (let i = 0; i < 10; i++) { await tA.hold('ArrowRight', 120); await tA.hold('ArrowDown', 60); }
await sleep(600);

const afterA = await tA.evalJs(`MATCH.players[0].x`);
check('the host moves its own player', afterA > beforeA + 30, `${beforeA.toFixed(0)} → ${afterA.toFixed(0)}`);
const seenByB = await tB.evalJs(`MATCH.players[0].x`);
check('the guest sees the host move', Math.abs(seenByB - afterA) < 160, `A=${afterA.toFixed(0)} B=${seenByB.toFixed(0)}`);

// dash is the canary: two rising edges must survive the whole round trip
await tA.hold('ArrowRight', 60); await sleep(30); await tA.hold('ArrowRight', 200);
const dashed = await tA.evalJs(`EVENTS.some(e => e.type === 'dash' && e.player === 0)`);
check('DASH works over the wire', dashed === true, dashed ? '' : 'double-tap lost in transport');

await tA.shot('03-host-play');
await tB.shot('04-guest-play');

// --- the two clients agree --------------------------------------------------
const st = async (t) => t.evalJs(`({score: MATCH.score.join('-'), clock: Math.round(MATCH.clock), you: typeof NETYOU !== 'undefined' ? NETYOU : null})`);
const sA = await st(tA), sB = await st(tB);
check('both clients show the same score', sA.score === sB.score, `${sA.score} vs ${sB.score}`);
check('both clients are on the same clock', Math.abs(sA.clock - sB.clock) <= 2, `${sA.clock}s vs ${sB.clock}s`);

const rttA = await tA.evalJs(`document.getElementById('rtt').textContent`);
check('the host shows a ping readout', /ms$/.test(rttA || ''), rttA);

const errs = [...tA.logs, ...tB.logs].filter(Boolean);
check('no page exceptions on either client', errs.length === 0, errs.slice(0, 2).join(' | '));

tA.ws.close(); tB.ws.close();
chrome.kill();
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_duo: ${fails.length} FAILED: ${fails.join(', ')}` : '_duo: all checks passed');
process.exit(fails.length ? 1 : 0);
