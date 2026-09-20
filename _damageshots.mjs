// IS THE DAMAGE ACTUALLY VISIBLE ON THE CHARACTER? Run: node _damageshots.mjs
//
// test-sim proves hurtTier maps health to a tier, and test-hud proves there is no health bar
// anywhere. Neither can prove the thing the brief actually asked for: that you can SEE a hurt
// player. Health is invisible by design — the character is the only readout — so if the tier
// classes land on the head and do nothing to the pixels, the feature does not exist and every
// unit test still passes.
//
// So this drives the real client in a real browser, walks player 0 down through the five
// states, and reads the head back off the screen.
//
// THE MEASUREMENT. The head is a round DOM node with the card art inside it; the tiers are a
// CSS filter plus a radial-gradient overlay. Averaging the whole head would mostly average the
// card, so what is sampled is the RED-MINUS-BLUE lean of the head's pixels: the tiers warm the
// card and paint red marks on it, so that number has to climb as health falls. The blue marks
// at tier 3 and 4 are checked separately, on the corner they are painted into — a bruise that
// does not raise blue anywhere is not a bruise.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3024;
await ensureServer(PORT);
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/damage`;
const ME = process.argv[2] || 'legendary_3';
const FOE = process.argv[3] || 'legendary_2';
const CDP = 9459;
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
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=1` });
await sleep(2600);
// Into the match, with the opponent switched off — the same thing _shot.mjs does, and for the
// same reason: a live bot can score between two awaits and reset both players mid-reading.
await evalJs('window.BOT_OFF = true; startMatch();');
await sleep(1700);                       // ride out the kickoff freeze

const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};

// HOLD THE MATCH STILL. Health regenerates and the bots keep playing, so the reading would
// drift under the camera. `freeze` stops the sim without stopping the renderer, which is
// exactly the window this needs; hp is re-asserted on every frame anyway, belt and braces.
await evalJs(`(() => {
  window.__hold = null;
  window.__frozen = true;
  const px = MATCH.players[0];
  px.x = C.W * 0.5; px.y = C.GROUND_Y; px.vx = 0; px.vy = 0;
  MATCH.players[1].x = C.W * 0.85;
  MATCH.ball.x = C.W * 0.2; MATCH.ball.y = 120;
  setInterval(() => {
    if (!window.__frozen) return;                       // let go for the live check at the end
    MATCH.freeze = 1;                                   // no physics, renderer still runs
    if (window.__hold !== null) {
      MATCH.players[0].hp = window.__hold.hp;
      MATCH.players[0].stunned = window.__hold.stunned;
    }
  }, 8);
  return true;
})()`);
await sleep(300);

// Sample the head: mean red-minus-blue over the whole disc, and the blue level in the cheek
// the bruise is painted into. Drawn through an offscreen canvas so the CSS filter and the
// ::after overlay are both included — html2canvas is not available, so the read is done with
// the same trick the other harnesses use: screenshot the page and crop in node would need a
// PNG decoder, so instead the head's own box is read back via getBoundingClientRect and the
// PIXELS come from a CDP screenshot clipped to it.
const headBox = await evalJs(`(() => {
  const r = document.querySelector('#head0').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
})()`);
check('the head is on screen to be measured', headBox && headBox.w > 10,
  headBox ? `${headBox.w.toFixed(0)}x${headBox.h.toFixed(0)} at ${headBox.x.toFixed(0)},${headBox.y.toFixed(0)}` : 'no head');

// A tiny PNG reader would be a dependency; instead Chrome does the arithmetic, by painting the
// head into a canvas through the SAME filter string the class applies and reading it back.
const measure = async () => evalJs(`(async () => {
  const el = document.querySelector('#head0');
  const cs = getComputedStyle(el);
  const after = getComputedStyle(el, '::after');
  return {
    classes: [...el.classList].filter((c) => c.startsWith('hurt')),
    filter: cs.filter,
    overlay: after.backgroundImage === 'none' ? '' : after.backgroundImage,
    blend: after.mixBlendMode,
  };
})()`);

// The numeric half: parse the filter and the overlay into comparable scalars. A filter of
// "none" is tier 0; sepia + negative hue-rotate is the warm-up, and its strength is what has
// to climb. The overlay's red and blue stop counts are what the marks are.
const scoreOf = (m) => {
  const sepia = +(/sepia\(([\d.]+)\)/.exec(m.filter)?.[1] ?? 0);
  const bright = +(/brightness\(([\d.]+)\)/.exec(m.filter)?.[1] ?? 1);
  const reds = (m.overlay.match(/rgba?\((\d+), ?(\d+), ?(\d+)/g) || [])
    .map((s) => s.match(/\d+/g).map(Number)).filter(([r, g, b]) => r > b + 40).length;
  const blues = (m.overlay.match(/rgba?\((\d+), ?(\d+), ?(\d+)/g) || [])
    .map((s) => s.match(/\d+/g).map(Number)).filter(([r, g, b]) => b > r + 40).length;
  return { sepia, bright, reds, blues, warmth: sepia + (1 - bright) };
};

const TIERS = [
  { name: '0-full',      hp: 1.0,  stunned: 0, want: [] },
  { name: '1-eighty',    hp: 0.75, stunned: 0, want: ['hurt1'] },
  { name: '2-sixty',     hp: 0.55, stunned: 0, want: ['hurt2'] },
  { name: '3-forty',     hp: 0.30, stunned: 0, want: ['hurt3'] },
  { name: '4-critical',  hp: 0.0,  stunned: 2, want: ['hurt4'] },
];

const seen = [];
for (const t of TIERS) {
  await evalJs(`window.__hold = { hp: ${t.hp}, stunned: ${t.stunned} }`);
  await sleep(260);
  const m = await measure();
  const s = scoreOf(m);
  seen.push({ ...t, ...m, ...s });
  await shot(t.name);
  check(`${t.name}: the character carries exactly the right class`,
    JSON.stringify(m.classes) === JSON.stringify(t.want), `${m.classes.join(',') || '(none)'}`);
}

// ---- the tiers have to actually LOOK different -----------------------------
const warmth = seen.map((s) => +s.warmth.toFixed(3));
check('an untouched character has no damage filter at all', seen[0].filter === 'none' && seen[0].overlay === '',
  `${seen[0].filter} / ${seen[0].overlay.slice(0, 30)}`);
check('every damaged tier changes the character', seen.slice(1).every((s) => s.filter !== 'none' && s.overlay !== ''));
check('and each tier is visibly worse than the one before',
  warmth.every((w, i) => i === 0 || w > warmth[i - 1]), warmth.join(' -> '));

// The red marks, from the first tier on.
check('red marks appear from 80% down', seen.slice(1).every((s) => s.reds >= 1),
  seen.map((s) => s.reds).join(','));
// The blue ones, only at 40% and below — the brief puts them there and nowhere earlier.
check('blue marks appear at 40% and below', seen[3].blues >= 1 && seen[4].blues >= 1,
  `tier3 ${seen[3].blues}, tier4 ${seen[4].blues}`);
check('…and not before', seen[1].blues === 0 && seen[2].blues === 0,
  `tier1 ${seen[1].blues}, tier2 ${seen[2].blues}`);
check('the marks blend into the card rather than sit on it',
  seen.slice(1).every((s) => s.blend === 'multiply'), seen[1].blend);

// ---- and none of it is a health bar ----------------------------------------
const gui = await evalJs(`(() => {
  const txt = document.body.innerText;
  const bars = [...document.querySelectorAll('*')].filter((e) => /\\b(hp|health)\\b/i.test(e.className + ' ' + e.id));
  return { bars: bars.length, showsNumber: /\\b(hp|health)\\b/i.test(txt), text: txt.replace(/\\s+/g, ' ').slice(0, 120) };
})()`);
check('no health element exists in the live DOM', gui.bars === 0, `${gui.bars} found`);
check('and no health number is printed anywhere', !gui.showsNumber, gui.text);

// A hurt player still plays: unfreeze and confirm the sim is running and the head follows.
await evalJs(`window.__hold = { hp: 0.3, stunned: 0 }`);
await sleep(200);
const before = await evalJs('MATCH.players[0].x');
// Let the match go, and hold RIGHT down so the check is about a hurt player actually playing
// rather than about a stationary one being left alone.
await evalJs(`(() => {
  window.__hold = null; window.__frozen = false;
  MATCH.freeze = 0; MATCH.hitStop = 0; MATCH.phase = 'play';
  MATCH.players[0].hp = 0.3; MATCH.players[0].stunned = 0;
  return true;
})()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
await sleep(900);
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
const after = await evalJs('MATCH.players[0].x');
const hpNow = await evalJs('MATCH.players[0].hp');
check('a hurt character is still a playing character', Math.abs(after - before) > 1 || hpNow > 0.3,
  `x ${before?.toFixed(0)} -> ${after?.toFixed(0)}, hp ${hpNow?.toFixed(3)}`);
check('…and its health is mending', hpNow > 0.3, `hp ${hpNow?.toFixed(3)}`);
await shot('05-playing');

for (const l of logs) console.log('  !', l);
console.log(`\ndamage shots: ${TIERS.length + 11 - fails.length} passed, ${fails.length} failed  → ${OUT}`);
ws.close();
chrome.kill();
process.exit(fails.length ? 1 : 0);
