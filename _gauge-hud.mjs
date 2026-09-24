// DOES THE POWER BAR MOVE WHEN YOU KICK? Run: node _gauge-hud.mjs
//
// Idan, on his phone: "the kicks give power to the power bar". Head Soccer's gauge fills with
// TIME and nothing else (GAUGE_PASSIVE), and the sim half of that is proved in test-sim. This
// is the other half — what the bar on the screen does. It drives the real client in headless
// Chrome, spams kick (at the ball and at the opponent, with the bot kicking back) and samples,
// every animation frame, both the sim's gauge and the width of the fill the player actually
// sees. Then it checks, frame by frame, that neither ever rises faster than the clock allows,
// kick, header, tackle or goal.
//
// PORT (default 3071) and CDP (default 9571) are their own, so a stale harness elsewhere
// cannot answer for this one.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT) || 3071, CDP = Number(process.env.CDP) || 9571;
const OUT = `${import.meta.dirname}/.shots/gauge`;
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);

const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--window-size=844,390', `--user-data-dir=${OUT}/prof`, 'about:blank',
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
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const key = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: code, windowsVirtualKeyCode: { ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38 }[code] });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  · ${name}${extra ? '  — ' + extra : ''}`); } else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&play=1&diff=5&me=legendary_3&foe=epic_7` });
for (let i = 0; i < 100; i++) { await sleep(100); if (await evalJs('MATCH && MATCH.phase === "play" ? 1 : 0')) break; }

// The sampler. Everything in one rAF read so the sim and the bar are the same frame. A reset
// of the gauge (to stay below full, where arming would take over) is flagged and skipped.
await evalJs(`(() => {
  MATCH.gaugeLead = 0; MATCH.players.forEach((p) => { p.gauge = 0.3; });
  const fills = [...document.querySelectorAll('.gauge .fill')];
  const vis = (el) => {
    const w = el.getBoundingClientRect().width;
    const m = getComputedStyle(el).clipPath.match(/inset\\(\\S+ (\\S+)/);
    if (!m || !w) return NaN;
    const r = m[1].endsWith('%') ? parseFloat(m[1]) / 100 * w : parseFloat(m[1]);
    return 1 - r / w;
  };
  window.__g = []; let seen = EVENTS.length;
  const tick = () => {
    const M = MATCH; let reset = false;
    if (M.players.some((p) => p.gauge > 0.85)) { M.players.forEach((p) => { p.gauge = 0.3; }); reset = true; }
    const ev = EVENTS.slice(seen).map((e) => e.type + (e.head ? ':head' : '')); seen = EVENTS.length;
    __g.push({ t: M.t, g: M.players.map((p) => p.gauge), w: fills.map(vis), ev, reset, golden: M.golden, lead: M.gaugeLead });
    if (!window.__stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`);

// Kick, kick, kick: walk at the ball for a while, then at the opponent, pressing kick every
// 120ms and jumping now and then for headers.
const T0 = Date.now();
while (Date.now() - T0 < 9000) {
  const st = await evalJs('JSON.stringify({ px: MATCH.players[0].x, bx: MATCH.ball.x, fx: MATCH.players[1].x })').then(JSON.parse);
  const tgt = ((Date.now() - T0) % 3000) < 1500 ? st.bx : st.fx;
  const dir = tgt > st.px ? 'ArrowRight' : 'ArrowLeft';
  await key('keyDown', dir);
  if (Math.random() < 0.25) { await key('keyDown', 'ArrowUp'); await sleep(30); await key('keyUp', 'ArrowUp'); }
  await key('keyDown', 'ArrowDown'); await sleep(60); await key('keyUp', 'ArrowDown');
  await sleep(60);
  await key('keyUp', dir);
}
await evalJs('window.__stop = true');
const S = JSON.parse(await evalJs('JSON.stringify(__g)'));
chrome.kill();

const RATE = await (async () => 1 / 13)();
let simBad = 0, barBad = 0, kicks = 0, tackles = 0, heads = 0, goals = 0, worst = 0, lag = 0;
const around = [];
// The harness's own writes (the start at 0.3, each reset back down) are jumps it made itself;
// the bar's 80ms transition catches up on them, so the 0.3s after each one is not judged.
let settle = S[0].t + 0.3;
for (let k = 1; k < S.length; k++) {
  const a = S[k - 1], b = S[k];
  for (const e of b.ev) { if (e === 'kick') kicks++; if (e === 'tackle') tackles++; if (e === 'strike:head') heads++; if (e === 'goal') goals++; }
  if (b.reset) settle = b.t + 0.3;
  if (b.t < settle) continue;
  const allow = Math.max(0, b.t - a.t) * RATE + 1e-6;
  for (let i = 0; i < 2; i++) {
    if (b.g[i] - a.g[i] > allow) { simBad++; console.log('   sim jump', i, a.g[i].toFixed(4), '->', b.g[i].toFixed(4), b.ev.join(',')); }
    // The bar may trail the sim by its 80ms transition, never leap past it; it may read a frame
    // ahead of this sample (the sampler and the game loop share a vsync), hence 1%.
    const dw = b.w[i] - a.w[i];
    if (dw > allow + 0.004) { barBad++; console.log('   bar jump', i, a.w[i].toFixed(4), '->', b.w[i].toFixed(4), b.ev.join(',')); }
    if (b.w[i] > b.g[i] + 0.01) lag = Math.max(lag, b.w[i] - b.g[i]);
    worst = Math.max(worst, dw);
    if (b.ev.length && i === 0) around.push(`${b.ev.join('+')}: bar ${a.w[0].toFixed(3)}→${b.w[0].toFixed(3)}`);
  }
}
console.log(`  ${S.length} frames; ${kicks} kicks, ${heads} headers, ${tackles} tackles, ${goals} goals`);
console.log('  first few event frames (P1 bar width before→after):', around.slice(0, 6).join(' | '));
ok('the harness actually kicked', kicks >= 20, `${kicks}`);
ok('the sim gauge never rose faster than the clock', simBad === 0, `${simBad} frames`);
ok('the HUD bar never rose faster than the clock', barBad === 0, `${barBad} frames; biggest frame step ${(worst * 100).toFixed(2)}%`);
ok('the HUD bar never shows more than the sim has', lag === 0, `${(lag * 100).toFixed(2)}%`);
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
