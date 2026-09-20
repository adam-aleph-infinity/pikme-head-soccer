// Drive the REAL client in headless Chrome, press real keys, and screenshot it.
// A mock gets judged on what it looks like, and "the sim says the ball is at x=300" proves
// nothing about whether a head rendered. Node 22+ has a global WebSocket, so no ws dependency.
//
//   node _shot.mjs                     → default matchup, writes PNGs + a state dump
//   node _shot.mjs legendary_9 epic_7  → pick the two cards
//   PORT=3020 node _shot.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs

const PORT = process.env.PORT || 3020;
await ensureServer(PORT);   // starts one only if nothing is listening
const OUT = process.env.SHOT_OUT ||
  `${import.meta.dirname}/.shots/hs`;
const ME = process.argv[2] || 'legendary_3';
const FOE = process.argv[3] || 'legendary_2';
const CDP = 9455;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); throw new Error('chrome never came up'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64')); return true; }
  return false;
};
// Real key events, so the client's own listeners run — not a poke at the input object.
const key = async (type, code, keyCode) =>
  send('Input.dispatchKeyEvent', { type, code, key: code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
const KEYCODE = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Space: 32, KeyJ: 74, KeyG: 71 };
const hold = async (code, ms) => {
  await key('keyDown', code, KEYCODE[code]);
  await sleep(ms);
  await key('keyUp', code, KEYCODE[code]);
};

// Input is ignored while the match is frozen (kickoff / post-goal), so if the chase above
// happened to end in a goal, every key press here lands in a dead window.
const waitForPlay = async () => {
  for (let i = 0; i < 40; i++) {
    if (await evalJs('MATCH.phase === "play" && MATCH.freeze <= 0')) return true;
    await sleep(150);
  }
  return false;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3` });
await sleep(2600);

const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};

// ---- 1. pick screen --------------------------------------------------------
await shot('01-pick');
const pickState = await evalJs(`(() => {
  const cards = [...document.querySelectorAll('#cardGrid .card')];
  const me = getComputedStyle(document.querySelector('#slotMe .slot-art')).backgroundImage;
  return { cards: cards.length, meArt: me, gridH: document.querySelector('#cardGrid').clientHeight };
})()`);
check('card grid renders', pickState.cards === 45, `${pickState.cards} cards`);
check('my slot shows card art', /supabase/.test(pickState.meArt || ''), pickState.meArt?.slice(0, 60));

// Card art must actually decode — a 404 still yields a background-image string.
const artOk = await evalJs(`new Promise((res) => {
  const i = new Image();
  i.onload = () => res(i.naturalWidth + 'x' + i.naturalHeight);
  i.onerror = () => res('ERROR');
  i.src = 'https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards/${ME.split('_')[0]}/${ME.split('_')[1]}.webp';
})`);
check('card art loads over the network', artOk === '400x545', String(artOk));

// The keyboard REBINDING SCREEN is gone — it was a desktop feature sitting in the menu of a
// phone game. The keys themselves still work, and section 4 below proves that by pressing
// them; there is simply no UI left to test.

// ---- 2. kick off -----------------------------------------------------------
// Freeze the opponent for the rest of this file. Every probe below was racing a live bot
// that could score, freeze the match and reset both players between one await and the
// next — which made a different check fail on each run. Bot behaviour has its own coverage
// in test-bot.mjs and _duo.mjs; what THIS file tests is rendering and input.
await evalJs('window.BOT_OFF = true; startMatch();');
await sleep(1600);                       // ride out the kickoff freeze
await shot('02-kickoff');

const geo = await evalJs(`(() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const hs = [0,1].map(i => { const r = document.getElementById('head'+i).getBoundingClientRect();
    return { x: Math.round(r.x - st.x), y: Math.round(r.y - st.y), w: Math.round(r.width) }; });
  return { stage: { w: Math.round(st.width), h: Math.round(st.height) }, heads: hs,
           bg: getComputedStyle(document.querySelector('#head0 i')).backgroundImage };
})()`);
// The STAGE is the viewport now — it has to be, because the HUD and the controls hang off it
// while the pitch is lifted above the control band. So the thing to check is that the PITCH is
// not stretched: the canvas must scale x and y by the same number. (It is taller than the
// world by the decorative grass bleed, so its own aspect is not the world's.)
const scaleXY = await evalJs(`(() => {
  const r = document.getElementById('cv').getBoundingClientRect();
  const cv = document.getElementById('cv');
  return { sx: r.width / C.W, sy: r.height / (cv.height * 2) };   // backing is half-res (PIXEL 2)
})()`);
// The ⌨ button was removed from this row. Its neighbours have to close ranks — a 34px hole
// in a row of three buttons reads as a missing button, which is exactly what it is.
const topRow = await evalJs(`(() => {
  const b = ['quit','sndBtn','gear'].map(id => document.getElementById(id)).filter(Boolean)
    .map(e => e.getBoundingClientRect());
  const right = b.filter(r => r.left > innerWidth / 2).sort((x, y) => x.left - y.left);
  return { n: b.length, gaps: right.slice(1).map((r, i) => Math.round(r.left - right[i].right)) };
})()`);
check('the in-game buttons sit together', topRow.gaps.every((g) => g >= 0 && g <= 12),
      `gaps ${topRow.gaps.join(', ')}px`);

check('the pitch is drawn at a uniform scale', Math.abs(scaleXY.sx - scaleXY.sy) < 0.01,
      `x${scaleXY.sx.toFixed(3)} vs y${scaleXY.sy.toFixed(3)}`);
check('both heads are inside the stage', geo.heads.every((h) => h.x > -h.w && h.x < geo.stage.w && h.y > -h.w && h.y < geo.stage.h),
      JSON.stringify(geo.heads));
check('heads are painted with card art', /supabase/.test(geo.bg || ''));
check('the two heads are apart', Math.abs(geo.heads[0].x - geo.heads[1].x) > 100,
      `${geo.heads[0].x} vs ${geo.heads[1].x}`);

// ---- 3. actually play it ---------------------------------------------------
const before = await evalJs('({x: MATCH.players[0].x, bx: MATCH.ball.x, by: MATCH.ball.y})');
await hold('ArrowRight', 700);
const moved = await evalJs('MATCH.players[0].x');
check('holding → moves the player right', moved > before.x + 40, `${before.x.toFixed(0)} → ${moved.toFixed(0)}`);

await hold('ArrowUp', 200);
await sleep(60);
const airborne = await evalJs('MATCH.players[0].y < 469 || MATCH.players[0].vy < 0');
check('jump leaves the ground', airborne === true);

// Chase the ball and boot it. Sample as we go: comparing only start-vs-end reads as
// "the ball never moved" whenever a goal happens to reset it back to the centre spot.
let travelled = 0;
for (let i = 0; i < 22; i++) {
  const s = await evalJs('({px: MATCH.players[0].x, bx: MATCH.ball.x})');
  travelled = Math.max(travelled, Math.abs(s.bx - before.bx));
  await hold(s.bx > s.px ? 'ArrowRight' : 'ArrowLeft', 110);
  await hold('ArrowDown', 60);
}
await sleep(300);
await shot('03-play');
check('the ball got moved by play', travelled > 60, `ball wandered ${travelled.toFixed(0)}px from the spot`);

// ---- 4. power shot ---------------------------------------------------------
check('play resumes after the chase', await waitForPlay());
await evalJs('MATCH.players[0].gauge = 1');
await sleep(120);
const gaugeUi = await evalJs(`document.querySelector('.gauge.g0').classList.contains('full')`);
check('a full gauge lights the HUD', gaugeUi === true);
// POWER only ARMS now. Press it and the player glows; nothing is spent, nothing is fired,
// and the ball is not touched. The shot comes on the next contact between their body and
// the ball — so this section checks the two halves separately, which is the point of it.
await hold('KeyJ', 90);
await sleep(90);
const armedState = await evalJs('JSON.stringify({ armed: +MATCH.players[0].armed.toFixed(2), gauge: +MATCH.players[0].gauge.toFixed(2), power: !!MATCH.ball.power })');
check('POWER arms the player', JSON.parse(armedState).armed > 0, armedState);
check('and does not fire on the press', JSON.parse(armedState).power === false, armedState);
check('and does not spend the meter', JSON.parse(armedState).gauge >= 1, armedState);
const glowUi = await evalJs(`document.getElementById('head0').classList.contains('armed')`);
check('the head glows while armed', glowUi === true);
const btnUi = await evalJs(`document.getElementById('powerBtn').classList.contains('live')`);
check('and the button shows it is loaded', btnUi === true);

await waitForPlay();
// Now the contact. Put the ball ON the body — not on the boot: the ultimate fires off the
// silhouette (head circle or torso), which is what stops it going off at a distance.
await evalJs(`(() => {
  const p = MATCH.players[0];
  if (p.armed <= 0) { p.gauge = 1; p.armed = 1; }
  MATCH.ball.x = p.x;
  MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8;
  MATCH.ball.vx = 0; MATCH.ball.vy = 0; MATCH.ball.power = null;
  MATCH.hitStop = 0;
  EVENTS.length = 0;
})()`);
// Read the EVENT LOG rather than ball.power — an ultimate fired near the opponent's goal
// scores within a fifth of a second, and the goal reset wipes ball.power before any poll
// can see it.
await sleep(600);
const fired = await evalJs(`EVENTS.filter(e => e.type === 'powershot' && e.player === 0).map(e => e.shot)[0] || null`);
check('the touch fires the ultimate', !!fired, String(fired));
const spent = await evalJs('+MATCH.players[0].gauge.toFixed(2)');
check('and the meter is spent at activation', spent === 0, String(spent));
await sleep(160);
await shot('04-powershot');

// (4b was "a rebound key really drives the game" — it drove the rebinding screen, which no
// longer exists. The DEFAULT keys are exercised throughout section 4.)

// ---- 5. a whole match, fast-forwarded -------------------------------------
// A level scoreline is NOT full time — it is sudden death. Both endings get checked,
// because the first version of this harness read golden goal as "the match never ends".
await evalJs('C.tune({ MATCH_DURATION: 5 }); startMatch(); MATCH.score = [2, 0];');
// Poll rather than sleep a fixed span: every goal freezes the clock for ~2s, so the wall
// time a 5-second match takes depends on how many goals it happens to contain.
let done = null;
for (let i = 0; i < 30; i++) {
  await sleep(600);
  done = await evalJs('({phase: MATCH.phase, score: MATCH.score, over: !document.getElementById("over").classList.contains("hidden"), title: document.getElementById("overTitle").textContent})');
  if (done.over) break;
}
check('a decided match reaches full time', done.over === true && done.phase === 'over', `phase=${done.phase} score=${done.score.join('-')}`);
// Don't assume WHO wins: the bot plays on while the clock runs, so a 2-0 head start is not
// a guaranteed win. Assert the announcement AGREES with the final score instead.
const expected = done.score[0] > done.score[1] ? 'ניצחת!' : 'הפסדת';
check('the winner announcement matches the score', done.title === expected,
      `${done.score.join('-')} → "${done.title}" (expected "${expected}")`);
await shot('05-fulltime');

// Setting 0-0 once was not enough: the bot can score inside the five seconds, and then the
// match ends decided instead of going to sudden death. Hold the scoreline level until the
// clock runs out, so the branch under test is the one that actually runs.
await evalJs('startMatch();');
let gg = null;
for (let i = 0; i < 30; i++) {
  await evalJs('if (MATCH.phase !== "over") MATCH.score = [0, 0];');
  await sleep(400);
  gg = await evalJs('({golden: MATCH.golden, phase: MATCH.phase, clockUi: document.getElementById("clock").textContent})');
  if (gg.golden) break;
}
check('a draw goes to sudden death instead of ending', gg.golden === true && gg.phase !== 'over', JSON.stringify(gg));
check('the clock shows sudden death', gg.clockUi === 'גול מכריע', gg.clockUi);

// ---- 6. phone shape --------------------------------------------------------
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
// Headless Chrome still reports `pointer: fine`, so the touch pad stays hidden and every
// measurement of it returns a 0x0 rect — a check that passes without testing anything.
// ?pad=1 forces the real layout on.
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&pad=1&play=1` });
await sleep(2600);
await shot('06-phone');
const phone = await evalJs(`(() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const pads = [...document.querySelectorAll('.pad .btn')].map(b => b.getBoundingClientRect());
  return { stage: { w: Math.round(st.width), h: Math.round(st.height) },
           padCount: pads.length,
           padVisible: pads.every(r => r.width > 30 && r.height > 30),
           padsInside: pads.every(r => r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1),
           bodyScroll: document.body.scrollWidth > innerWidth + 1 };
})()`);
check('the touch pad is actually rendered', phone.padCount === 8 && phone.padVisible === true,
      `${phone.padCount} buttons, visible=${phone.padVisible}`);

// The HUD is pinned to the pitch, not to the reading direction — under dir=rtl these all
// came out mirrored, so player 0's blue score sat above the red player.
const sides = await evalJs(`(() => {
  const mid = innerWidth / 2;
  const x = (sel) => document.querySelector(sel).getBoundingClientRect();
  const btn = (k) => document.querySelector('.pad .btn[data-k="' + k + '"]').getBoundingClientRect();
  return {
    g0Left: x('.gauge.g0').left < x('.gauge.g1').left,
    s0Left: x('#s0').left < x('#s1').left,
    walkLeft: btn('left').left < mid && btn('right').left < mid,
    actRight: btn('kick').left > mid && btn('power').left > mid,
    arrowOrder: btn('left').left < btn('right').left,
  };
})()`);
check('player 0 gauge sits on player 0 side', sides.g0Left === true);
check('the score reads left-to-right like the pitch', sides.s0Left === true);
check('walk buttons are under the left thumb', sides.walkLeft === true);
check('action buttons are under the right thumb', sides.actRight === true);
check('◀ is left of ▶', sides.arrowOrder === true);
check('the pitch fits the phone viewport', phone.stage.w <= 844 && phone.stage.h <= 390, JSON.stringify(phone.stage));
check('touch buttons stay on screen', phone.padsInside === true);
check('nothing scrolls horizontally', phone.bodyScroll === false);

const errs = logs.filter((l) => /EXCEPTION|Error|error/i.test(l));
check('no page exceptions', errs.length === 0, errs.slice(0, 3).join(' | '));

ws.close();
chrome.kill();
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_shot: ${fails.length} FAILED: ${fails.join(', ')}` : '_shot: all checks passed');
process.exit(fails.length ? 1 : 0);
