// HOLD AND SLIDE ON THE WALK ARROWS, judged by where the PLAYER goes.  Run: node _touch-slide.mjs
//
// The complaint (Idan, iPhone): "I can hold right, slide to the left arrow, but when I slide
// back to the right arrow it's stuck." _arrows.mjs asks the pad which key is held; this asks
// the match whether the body actually moved, tick after tick, the way a thumb drives it:
//
//   · hold ▶ for a second: x climbs at every sample, not just once
//   · slide to ◀ and back to ▶, five times fast and five times slow, with the arc a real
//     thumb draws (it rolls up off the row mid-slide and lands a little high on the way back)
//   · slide off the pad onto the pitch and back on without lifting
//   · start the touch in the gap between the arrows (HS's big L/R plate: nearer arrow wins)
//   · hold ▶ while a second finger taps Jump and Kick
//   · keyboard: hold →, press ← on top (most recent wins), let go of ← (→ again)
//   · all of it again on an edit-mode layout where the arrows were moved and resized
//
// Real touch through CDP Input.dispatchTouchEvent on a mobile-emulated 844x390 page, so the
// browser's own touch → pointer plumbing runs. Exit code 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3020, CDP = Number(process.env.CDP) || 9491;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/touch-slide`;
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '·' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { chrome.kill(); throw new Error('chrome never came up'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;

// Fingers: a map of CDP touch id -> [x, y]. Every event carries every finger still down.
const fingers = new Map();
const pts = () => [...fingers].map(([i, [x, y]]) => ({ id: i, x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8 }));
const down = async (fid, p) => { fingers.set(fid, p); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() }); };
const move = async (fid, p) => { fingers.set(fid, p); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() }); };
// A touchEnd lists the finger(s) that LIFT, not the ones that stay (listing the survivors lifts
// them instead, and a touchMove that omits a finger does not lift it at all).
const up = async (fid) => {
  const [x, y] = fingers.get(fid);
  fingers.delete(fid);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id: fid, x: Math.round(x), y: Math.round(y) }] });
};
// A thumb's slide: `steps` moves over `ms`, bowing up by `arc` px in the middle.
const slide = async (fid, from, to, { steps = 8, ms = 120, arc = 0 } = {}) => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await move(fid, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - arc * Math.sin(Math.PI * t)]);
    await sleep(ms / steps);
  }
};
const KEYCODE = { ArrowLeft: 37, ArrowRight: 39 };
const key = (type, code) => send('Input.dispatchKeyEvent', {
  type, code, key: code, windowsVirtualKeyCode: KEYCODE[code], nativeVirtualKeyCode: KEYCODE[code],
});

const px = async () => evalJs('MATCH.players[0].x');
const heldDir = async () => evalJs('HELD.left && HELD.right ? "both" : HELD.left ? "left" : HELD.right ? "right" : "none"');
// Samples x every `every` ms for `ms`; returns the per-sample deltas.
const track = async (ms, every = 100) => {
  const xs = [await px()];
  for (let t = 0; t < ms; t += every) { await sleep(every); xs.push(await px()); }
  return xs.slice(1).map((x, i) => x - xs[i]);
};
const fmt = (ds) => ds.map((d) => d.toFixed(0)).join(' ');
const allUp = (ds, min = 3) => ds.length > 0 && ds.every((d) => d > min);
const allDown = (ds, min = 3) => ds.length > 0 && ds.every((d) => d < -min);
const still = (ds) => ds.every((d) => Math.abs(d) < 1);
// Park the player mid-left with the ball and the (idle) opponent out of the way, so the body
// has room to walk both ways and nothing scores, knocks or blocks it.
const park = () => evalJs(`(() => {
  const m = MATCH, p = m.players[0], q = m.players[1];
  p.x = 360; p.vx = 0; q.x = 1000; q.vx = 0;
  m.ball.x = 820; m.ball.vx = 0; m.ball.vy = 0;
  return m.phase;
})()`);
const settle = async () => {
  for (let i = 0; i < 80; i++) {
    if (await evalJs('MATCH && MATCH.phase === "play" && !(MATCH.freeze > 0) ? 1 : 0')) return true;
    await sleep(100);
  }
  return false;
};

async function load(layout) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&solo=1&play=1&me=legendary_3&foe=epic_7` });
  for (let i = 0; i < 60; i++) { await sleep(200); if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break; }
  if (layout !== undefined) {
    await evalJs(`localStorage.setItem('hs.padlayout.v1', ${JSON.stringify(JSON.stringify(layout))}); 1`);
    await send('Page.reload');
    await sleep(400);
    for (let i = 0; i < 60; i++) { await sleep(200); if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break; }
  }
  await evalJs('window.BOT_OFF = true; 1');
  ok('match reaches open play', await settle());
  return JSON.parse(await evalJs(`JSON.stringify(Object.fromEntries([...document.querySelectorAll('.pad .btn')].map((b) => {
    const r = b.getBoundingClientRect(); return [b.dataset.k, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom }];
  })))`));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

async function suite(label, B) {
  const L = [B.left.x, B.left.y], R = [B.right.x, B.right.y];
  const H = Math.min(B.left.h, B.right.h);
  console.log(`\n${label}  (◀ ${B.left.w.toFixed(0)}x${B.left.h.toFixed(0)} @${L.map(Math.round)}, ▶ @${R.map(Math.round)})`);
  await park();

  // 1. HOLD
  await down(1, R);
  let d = await track(1000);
  ok('holding ▶ for 1 s moves right at every sample', allUp(d), fmt(d));

  // 2/3. THERE AND BACK, with a thumb's arc and a high landing on the return.
  const Rhigh = [R[0], R[1] - H * 0.62];
  await slide(1, R, L, { arc: H * 0.55 });
  d = await track(400);
  ok('slide ▶→◀ (arcing): moves left', allDown(d), fmt(d));
  await slide(1, L, Rhigh, { arc: H * 0.4 });
  d = await track(400);
  ok('slide ◀→▶ (lands high): moves right again', allUp(d), fmt(d));

  // 4. REPEATED, fast and slow.
  for (const [speed, opt, dwell] of [['fast', { steps: 4, ms: 50, arc: H * 0.3 }, 200], ['slow', { steps: 14, ms: 450, arc: H * 0.5 }, 350]]) {
    let bad = [];
    let at = Rhigh;
    for (let i = 0; i < 5; i++) {
      await park();
      await slide(1, at, L, opt); at = L;
      await sleep(40);
      const dl = await track(dwell, dwell / 2);
      if (!allDown(dl, 1)) bad.push(`#${i + 1} ◀ ${fmt(dl)} (${await heldDir()})`);
      const back = i % 2 ? R : Rhigh;
      await slide(1, at, back, opt); at = back;
      await sleep(40);
      const dr = await track(dwell, dwell / 2);
      if (!allUp(dr, 1)) bad.push(`#${i + 1} ▶ ${fmt(dr)} (${await heldDir()})`);
    }
    ok(`5x ◀▶ ${speed}: every leg moves the right way`, !bad.length, bad.join('; '));
  }

  // 5. OFF THE PAD AND BACK ON.
  await park();
  await slide(1, R, [422, 120], { steps: 6, ms: 90 });
  await sleep(60);
  d = await track(300);
  ok('slid off onto the pitch: stops', still(d) && (await heldDir()) === 'none', fmt(d));
  await slide(1, [422, 120], R, { steps: 6, ms: 90 });
  d = await track(300);
  ok('slid back onto ▶ without lifting: moves right', allUp(d), fmt(d));

  // 6. LIFT.
  await up(1);
  await sleep(60);
  d = await track(300);
  ok('lift: stops dead', still(d) && (await heldDir()) === 'none', fmt(d));

  // 7. THE GAP between the arrows is the plate: nearest arrow wins.
  await park();
  const gapY = (B.left.y + B.right.y) / 2;
  const nearL = [B.left.r + (B.right.l - B.left.r) * 0.3, gapY];
  if (B.right.l > B.left.r + 2) {
    await down(1, nearL);
    d = await track(300);
    ok('a touch in the gap, nearer ◀, walks left', allDown(d), `${fmt(d)} (${await heldDir()})`);
    await up(1);
    await sleep(60);
  }

  // 8. SECOND THUMB on Jump and Kick while ▶ is held.
  await park();
  await down(1, R);
  await sleep(150);
  const y0 = await evalJs('MATCH.players[0].y');
  await down(2, [B.jump.x, B.jump.y]);
  await sleep(90);
  const air = await evalJs('!MATCH.players[0].onGround || MATCH.players[0].y < ' + (y0 - 2));
  await up(2);
  d = await track(300);
  ok('second finger taps Jump: jumps', !!air);
  ok('...and ▶ keeps walking through it', allUp(d), fmt(d));
  await sleep(700);                                      // land
  await down(2, [B.kick.x, B.kick.y]);
  await sleep(60);
  const kicked = await evalJs('MATCH.players[0].kickT > 0 || (EVENTS || []).slice(-10).some((e) => e.type === "kick" || e.type === "swing")');
  await up(2);
  d = await track(300);
  ok('second finger taps Kick: kicks', !!kicked);
  ok('...and ▶ keeps walking through it', allUp(d), fmt(d));
  await up(1);
  await sleep(80);
  ok('everything released after both lift', (await heldDir()) === 'none'
     && !(await evalJs('HELD.jump || HELD.kick')), await heldDir());
}

// ── default layout ──────────────────────────────────────────────────────────
let B = await load();
await suite('default pad', B);

// ── keyboard ────────────────────────────────────────────────────────────────
console.log('\nkeyboard');
await park();
await key('keyDown', 'ArrowRight');
let d = await track(1000);
ok('hold → 1 s: moves right at every sample', allUp(d), fmt(d));
await key('keyDown', 'ArrowLeft');
await sleep(40);
d = await track(300);
ok('press ← while holding →: most recent wins, moves left', allDown(d), `${fmt(d)} (${await heldDir()})`);
await key('keyUp', 'ArrowLeft');
await sleep(40);
d = await track(300);
ok('release ←, → still down: moves right again', allUp(d), fmt(d));
await key('keyUp', 'ArrowRight');
await sleep(40);
d = await track(200);
ok('release →: stops', still(d), fmt(d));

// ── an edit-mode layout: arrows moved up/apart and resized ──────────────────
B = await load({ left: { x: 0.03, y: -0.12, s: 1.35 }, right: { x: 0.1, y: -0.05, s: 0.85 } });
await suite('edited pad (moved + resized)', B);
await evalJs("localStorage.removeItem('hs.padlayout.v1'); 1");

if (errors.length) { fail++; console.log('\npage errors:\n  ' + errors.join('\n  ')); }
console.log(`\n${pass} passed, ${fail} failed`);
chrome.kill();
process.exit(fail ? 1 : 0);
