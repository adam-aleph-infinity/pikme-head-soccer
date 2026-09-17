// THE PHONE SIMULATOR.
//
// This game is never played in a desktop browser. It is played inside a WKWebView, locked to
// landscape, on a phone, with thumbs. A desktop Chrome window at 1440x900 with a mouse tells
// you almost nothing about whether the pitch clears the buttons or whether a tap lands — and
// those are the two things that go wrong.
//
// So: a Chrome window the exact size of a phone in landscape, with touch events instead of a
// mouse, an iOS user agent, and the album injected before the page boots exactly the way
// `app/pages/head-soccer.jsx` injects it. What you see here is what ships.
//
//   npm run sim                    → iPhone 14, landscape, no album (everything unlocked)
//   npm run sim -- --device=se     → the smallest screen we support; break it here first
//   npm run sim -- --album=8       → pretend the player owns 8 cards, like the app would say
//   npm run sim -- --duo           → two phones side by side, for testing 1v1 rooms
//   npm run sim -- --devtools      → open DevTools docked to the window
//   npm run sim -- --list          → print the device table and exit
//
// Ctrl-C closes the windows and the server it started. If a server is already listening on
// the port it is reused and left running.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath } from './_chrome.mjs';

const PORT = Number(process.env.PORT) || 3020;
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs

// Landscape, because the app pins this screen to landscape. Width is the LONG edge.
// dpr matters: the heads are background-positioned card art, and a half-pixel window offset
// looks like a badly measured face anchor on a 3x screen and like nothing at all on a 1x one.
const DEVICES = {
  se:     { w: 667,  h: 375, dpr: 2, label: 'iPhone SE / 8 — the floor, test here first' },
  mini:   { w: 780,  h: 360, dpr: 3, label: 'iPhone 13 mini — the shortest screen' },
  iphone: { w: 844,  h: 390, dpr: 3, label: 'iPhone 14 / 15 (default)' },
  promax: { w: 932,  h: 430, dpr: 3, label: 'iPhone 14/15 Pro Max' },
  ipad:   { w: 1180, h: 820, dpr: 2, label: 'iPad Air' },
};
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Mobile/15E148';

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

if (flag('list')) {
  console.log('devices (landscape, width = long edge):');
  for (const [k, d] of Object.entries(DEVICES)) console.log(`  --device=${k.padEnd(6)} ${d.w}x${d.h} @${d.dpr}x   ${d.label}`);
  process.exit(0);
}

const key = String(flag('device', 'iphone'));
const dev = DEVICES[key];
if (!dev) { console.error(`unknown --device=${key}. try --list`); process.exit(1); }
const duo = !!flag('duo');
const devtools = !!flag('devtools');
const albumN = flag('album') === true ? 8 : Number(flag('album', 0)) || 0;

// ── the album, exactly as the app builds it ─────────────────────────────────
// app/pages/head-soccer.jsx injects `window.SALTIZ_CARDS` — a compact [{ r, n }] of the cards
// the player has actually claimed — and `window.SALTIZ_NAME`, BEFORE the page's scripts run.
// An ABSENT album is a full deck (that is the browser's deliberate escape hatch); a PRESENT
// one locks your head to what you own. Both paths need testing, and only this flag reaches
// the second one outside a real build.
function fakeAlbum(n) {
  if (!n) return null;
  const spread = [                          // one of each rarity early, so the gate is visible
    ['common', 4], ['common', 17], ['rare', 9], ['rare', 31],
    ['epic', 2], ['epic', 22], ['legendary', 7], ['legendary', 40],
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [r, base] = spread[i % spread.length];
    out.push({ r, n: ((base + Math.floor(i / spread.length) * 5 - 1) % 45) + 1 });
  }
  return out;
}
const bootJs = (() => {
  const cards = fakeAlbum(albumN);
  const name = String(flag('name', 'עידן'));
  let js = `window.SALTIZ_NAME = ${JSON.stringify(name)};`;
  if (cards) js += `window.SALTIZ_CARDS = ${JSON.stringify(cards)};`;
  return js;
})();

// ── the server ──────────────────────────────────────────────────────────────
const listening = (port) => new Promise((r) => {
  const s = net.connect({ port, host: '127.0.0.1' });
  s.on('connect', () => { s.destroy(); r(true); });
  s.on('error', () => r(false));
  setTimeout(() => { s.destroy(); r(false); }, 800);
});

let server = null;
if (await listening(PORT)) {
  console.log(`· reusing the server already on :${PORT}`);
} else {
  console.log(`· starting server on :${PORT}`);
  server = spawn(process.execPath, ['server.js'], {
    cwd: import.meta.dirname, stdio: 'inherit', env: { ...process.env, PORT: String(PORT) },
  });
  for (let i = 0; i < 50; i++) { if (await listening(PORT)) break; await sleep(100); }
  if (!(await listening(PORT))) { console.error('server never came up'); process.exit(1); }
}

// ── one emulated phone ──────────────────────────────────────────────────────
const profiles = [];
async function phone({ cdp, x, label }) {
  const profile = mkdtempSync(join(tmpdir(), 'hs-sim-'));
  profiles.push(profile);
  const args = [
    `--remote-debugging-port=${cdp}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check',
    // A real phone plays sound without a tap and has no scrollbars. Match it, or you will
    // chase an audio bug that only exists in the simulator.
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
    `--window-size=${dev.w},${dev.h}`, `--window-position=${x},80`,
    ...(devtools ? ['--auto-open-devtools-for-tabs'] : []),
    `--app=http://localhost:${PORT}/`,
  ];
  const ch = spawn(CHROME, args, { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(150);
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes(`:${PORT}`));
    } catch { /* chrome not up yet */ }
  }
  if (!target) { console.error(`${label}: chrome never came up`); return { ch, ws: null }; }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
    // The one thing a headful window hides: an exception that kills the boot leaves a black
    // screen and no clue. Mirror the page's console into this terminal.
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      console.error(`  ✗ ${label}`, d?.exception?.description || d?.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      console.error(`  ✗ ${label}`, m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  await send('Runtime.enable');
  await send('Page.enable');
  // Device metrics + touch + UA together. Any one of them alone is a lie: metrics without
  // touch gives you a phone-shaped mouse, and touch without the UA can take a desktop branch.
  await send('Emulation.setDeviceMetricsOverride', {
    width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, mobile: true,
    screenOrientation: { type: 'landscapePrimary', angle: 90 },
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  await send('Emulation.setUserAgentOverride', { userAgent: IOS_UA, platform: 'iPhone' });
  // Before the page boots — the same moment the app uses. After it boots is too late: the
  // pick screen reads the album once, at module scope.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: bootJs });
  await send('Page.reload', { ignoreCache: true });

  return { ch, ws };
}

const phones = [await phone({ cdp: 9520, x: 60, label: 'phone-1' })];
if (duo) phones.push(await phone({ cdp: 9521, x: 60 + dev.w + 24, label: 'phone-2' }));

console.log('');
console.log(`  📱 ${dev.label} — ${dev.w}x${dev.h} @${dev.dpr}x, touch on, iOS UA`);
console.log(`  album: ${albumN ? `${albumN} cards injected (gate ON)` : 'none (gate OFF — full deck)'}`);
if (duo) console.log('  two windows: open a room on the left, join the code on the right');
console.log(`  url:  http://localhost:${PORT}/`);
console.log('  Ctrl-C to close everything.');
console.log('');

let closing = false;
const shutdown = () => {
  if (closing) return; closing = true;
  for (const p of phones) { try { p.ws?.close(); } catch {} try { p.ch.kill(); } catch {} }
  if (server) { try { server.kill(); } catch {} }
  for (const d of profiles) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Chrome is the session: close the window, end the run.
for (const p of phones) p.ch.on('exit', shutdown);
