// THE FIRST LAUNCH, WALKED. A fresh browser profile opens the game: the loading screen counts
// up, a tap starts the tutorial, and this plays it through with real key presses — the drills,
// the practice match and its power lesson, the result, the guided first upgrade, the menu —
// asserting each step and photographing it. Then a reload proves it never comes back, and
// OPTIONS can replay it. Run: node _tutorial-shots.mjs   (shots in .shots/tutorial)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT || 3034), CDP = 9434;
const OUT = `${import.meta.dirname}/.shots/tutorial`;
const [W, H] = (process.env.SIZE || '844x390').split('x').map(Number);
rmSync(`${OUT}/prof`, { recursive: true, force: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);
const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map(), logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
let n = 0;
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s?.data) writeFileSync(`${OUT}/${String(++n).padStart(2, '0')}-${name}.png`, Buffer.from(s.data, 'base64')); };
const fails = [];
const check = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails.push(name); };
const until = async (f, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(50); } return false; };
const KEYS = { KeyA: 65, KeyD: 68, KeyS: 83, KeyJ: 74, Space: 32, Enter: 13, ArrowUp: 38 };
const down = (code) => send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: code === 'Space' ? ' ' : code, windowsVirtualKeyCode: KEYS[code] });
const up = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code === 'Space' ? ' ' : code, windowsVirtualKeyCode: KEYS[code] });
const press = async (code, ms = 80) => { await down(code); await sleep(ms); await up(code); };
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const clickEl = async (sel) => {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (r) await clickAt(r[0], r[1]);
  return !!r;
};
const tut = (k) => js(`TUTORIAL.${k}`);
// a "tap to continue": wait for the prompt, then tap
const tapOn = async () => { await until(() => js(`document.querySelector('#tut').style.pointerEvents === 'auto'`), 5000); await clickAt(W / 2, H / 2); };
const say = () => js(`document.querySelector('.tut-say')?.textContent`);
const px = () => js(`MATCH.players[0].x`);
// walk until the player is on x (keys held the way a thumb holds an arrow)
async function walkTo(x) {
  for (let i = 0; i < 80; i++) {
    const p = await px();
    if (Math.abs(p - x) < 18) break;
    const k = p < x ? 'KeyD' : 'KeyA';
    await down(k); await sleep(Math.min(160, Math.abs(p - x) * 0.5)); await up(k); await sleep(30);
  }
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
console.log(`· first launch, ${W}×${H}`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await until(() => js(`MENU && MENU.screen`), 3000);
check('boot opens on the loading screen', (await js(`MENU.screen`)) === 'title' && !(await js(`document.querySelector('#title').classList.contains('ld-done')`)));
await shot('loading-early');
await sleep(900);
const mid = await js(`document.querySelector('#ldPct').textContent`);
check('the bar counts up', /טוען \d+%/.test(mid) && !/טוען 0%/.test(mid), mid);
await shot('loading-mid');
// a tap while loading is kept and goes through when it is done
await clickAt(W / 2, H / 2);
check('loading finishes', await until(() => js(`document.querySelector('#title').classList.contains('ld-done') || TUTORIAL.on`), 6000));
check('…and the early tap starts the tutorial', await until(() => tut('on'), 3000));
await sleep(250);
await shot('drop-in');
check('the coach says hello', await until(async () => (await say())?.includes('ברוכים'), 4000));
check('…out loud, in the narrator\'s voice', await until(() => js('VOICE_LEFT > 0'), 3000));
await shot('hello');

// ── THE DRILLS ──
check('drill 1: walk right to the marker', await until(async () => (await tut('phase')) === 'drill', 12000));
check('…the sound is on', (await js('AUDIO_STATE')) === 'running', await js('AUDIO_STATE'));
check('…and something is playing', await (async () => { let p = 0; for (let i = 0; i < 30; i++) { p = Math.max(p, await js('AUDIO_LEVEL')); await sleep(60); } return p > 0.02; })());
check('…only the arrows are on the pad', await js(`['jump','kick','power'].every(k => document.querySelector('.pad .btn[data-k="' + k + '"]').classList.contains('tut-off')) && !document.querySelector('.pad .btn[data-k="right"]').classList.contains('tut-off')`));
await shot('drill-right');
await walkTo(760);
check('…✓ on the marker', await until(async () => (await tut('drill')) !== 'right', 4000), await tut('drill'));
await shot('drill-right-ok');
await until(async () => (await tut('drill')) === 'left', 3000);
await shot('drill-left');
await walkTo(300);
check('drill 2: walk left to the marker', await until(async () => (await say())?.includes('קפצו'), 4000), await say());
await shot('drill-jump');
await press('Space');
check('drill 3: jump', await until(async () => (await say())?.includes('דאש'), 4000), await say());
await shot('drill-dash');
await press('KeyD', 50); await sleep(60); await press('KeyD', 50);
check('drill 4: dash (a double tap)', await until(async () => (await say())?.includes('באוויר'), 4000), await say());
await sleep(500);
await shot('drill-high');
check('…a ball drops in, with the arrow on it', await js(`MATCH.ballWait <= 0`));
// a real try: walk under it, jump and kick
const bx = await js(`MATCH.ball.x`);
await walkTo(bx - 40);
await down('Space'); await sleep(120); await press('KeyS', 60); await up('Space');
await sleep(1600);
let high = (await say())?.includes('מהקרקע');
console.log(`    (a real jump-kick ${high ? 'scored' : 'missed — the harness puts it in'})`);
if (!high) {
  // the flow, not the aim: put the ball in the far net
  await js(`Object.assign(MATCH.ball, { x: ${1060 - 120}, y: 380, vx: 900, vy: -50 })`);
  high = await until(async () => (await say())?.includes('מהקרקע'), 5000);
}
check('drill 5: a high shot scores', high, await say());
check('…the ground ball comes in, with the arrow on it', await until(() => js(`TUTORIAL.drill === 'ground' && TUTORIAL.ball && MATCH.ballWait <= 0`), 8000));
await sleep(400);
await shot('drill-ground');
const gx = await js(`MATCH.ball.x`);
await walkTo(gx - 45);
await press('KeyS', 60);
await sleep(1500);
let ground = await tut('phase') !== 'drill';
console.log(`    (a real ground kick ${ground ? 'scored' : 'missed — the harness puts it in'})`);
if (!ground) {
  await js(`Object.assign(MATCH.ball, { x: ${1060 - 120}, y: 400, vx: 900, vy: -50 })`);
  ground = await until(async () => (await tut('phase')) !== 'drill', 5000);
}
check('drill 6: a ground shot scores', ground);

// ── THE PRACTICE MATCH ──
check('the coach: a practice match', await until(async () => (await say())?.includes('משחק אימון'), 4000));
await sleep(600);
await shot('practice-talk');
await tapOn();
check('finding an opponent', await until(() => js(`document.querySelector('#vs').classList.contains('tut-find')`), 3000));
await sleep(900);
await shot('finding');
await until(async () => (await js(`document.querySelector('.vs-find')?.textContent`))?.includes('נמצא'), 4000);
await shot('found');
check('the match starts', await until(async () => (await tut('phase')) === 'match' && (await js(`MATCH && MATCH.clock < 60`)), 5000));
await shot('kickoff');
check('the power lesson: play stops at kick-off', await until(() => tut('hold'), 6000));
await sleep(1200);
check('…the power bar is full', await js(`MATCH.players[0].gauge >= 1`));
await shot('power-lesson');
await press('KeyJ');
check('…POWER arms it', await until(() => js(`MATCH.players[0].armed > 0`), 2000));
await sleep(300);
await shot('power-armed');
// ── THE COUNTER LESSON: his power comes at you, a kick sends it back ──
check('the counter lesson: the coach warns you', await until(async () => (await tut('lesson')) === 'talk', 20000), String(await tut('lesson')));
await sleep(700);
await shot('counter-talk');
await tapOn();
check('…his power is fired, and freezes short of you', await until(async () => (await tut('lesson')) === 'hold', 8000), String(await tut('lesson')));
await sleep(500);
check('…a power ball, his, coming at you', await js(`!!MATCH.ball.power && MATCH.ball.power.owner === 1 && MATCH.ball.x > MATCH.players[0].x`));
await shot('counter-freeze');
await press('KeyS');
check('…the kick blocks it', await until(async () => (await tut('lesson')) === 'done', 5000), String(await tut('lesson')));
await sleep(500);
await shot('counter-blocked');
check('…and it goes back as yours', await js(`EVENTS.some(e => e.type === 'blocked' && e.player === 0)`));
await sleep(1500);
await shot('counter-fireback');
// the sparring partner (Idan, 2026-10-08): a weak CPU that hangs back by its goal, never dashes,
// and the goals are open both ways. Watch it for a while with you standing still.
const at = await js(`MATCH.score.slice()`);
const ev0 = await js(`EVENTS.length`);
const xs = [];
for (let i = 0; i < 12; i++) { await sleep(500); xs.push(await js(`MATCH.players[1].x`)); }
await shot('match-play');
check('the sparring partner never dashes', await js(`EVENTS.slice(${ev0}).every(e => !(e.type === 'dash' && e.player === 1))`));
check('…and mostly stays in its own half', xs.filter((x) => x > 530).length >= 9, xs.map(Math.round).join(','));
// your goal: roll the ball into his net — it counts (no invisible wall)
const s0 = await js(`MATCH.score.slice()`);
await js(`Object.assign(MATCH.ball, { x: 1060 - 140, y: 420, vx: 900, vy: -40, power: null })`);
check('a shot into his net is a goal', await until(async () => (await js(`MATCH.score[0]`)) > s0[0], 3000), String(await js(`MATCH.score.join('-')`)));
await sleep(3500);
// …and his way too: the ball into yours counts for him
const s1 = await js(`MATCH.score.slice()`);
await js(`MATCH.players[0].x = 600; Object.assign(MATCH.ball, { x: 140, y: 420, vx: -900, vy: -40, power: null })`);
check('…and one into your net counts for him (both goals are open)', await until(async () => (await js(`MATCH.score[1]`)) > s1[1], 3000), String(await js(`MATCH.score.join('-')`)));
check('the match runs to full time', await until(() => js(`!document.querySelector('#over').classList.contains('hidden')`), 60000));
const fin = await js(`MATCH.score.slice()`);
check('the weak CPU scores little on its own (you stood still the whole match)', fin[1] - 1 <= 2, fin.join('-'));
check('the result', await until(() => js(`!document.querySelector('#over').classList.contains('hidden')`), 4000));
check('…pays 500 points', await until(async () => (await js(`document.querySelector('#ovReward').textContent`)) === '500', 3000));
await sleep(1800);
await shot('result-points');
await tapOn();
await sleep(400);
check('…the button goes to the shop', (await js(`document.querySelector('#again').textContent`)).includes('לחנות'));
await shot('result-to-shop');
// a stray click elsewhere is swallowed
await clickAt(10, 10);
await clickEl('#again');
check('the shop', await until(() => js(`MENU.screen === 'shop'`), 3000));
await sleep(900);
await shot('shop-guide');
check('…a click off the Buy button does nothing', await (async () => { await clickEl('#shopBack'); await sleep(300); return (await js(`MENU.screen`)) === 'shop'; })());
await clickEl('#upgRows .upg-row[data-k="speed"] .upg-buy');
check('…speed bought: level 1, the points spent', await until(() => js(`JSON.parse(localStorage.getItem('hs.stats.v1')).lv.speed === 1`), 2000));
await sleep(400);
await shot('shop-bought');
await sleep(1800);
await until(() => js(`document.querySelector('#tut').style.pointerEvents === 'auto'`), 5000);
await shot('shop-stats');
await tapOn();
check('the menu, pointing at the arcade', await until(() => js(`MENU.screen === 'menu'`), 3000));
await sleep(900);
await shot('menu-arcade');
await tapOn();
check('the tutorial is over and remembered', await until(async () => !(await tut('on')), 2000) && (await js(`localStorage.getItem('hs.tutorial.v1')`)) === 'done');
await sleep(300);
await shot('menu-after');

// ── NEVER AGAIN, BUT ON REQUEST ──
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(300);
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 6000);
await shot('loading-done');
await clickAt(W / 2, H / 2);
check('a second launch goes to the menu', await until(() => js(`MENU.screen === 'menu'`), 3000) && !(await tut('on')));
await js(`MENU.openOptions()`); await sleep(700);
await shot('options');
check('OPTIONS has the tutorial', await js(`!!document.querySelector('#oTut') && document.querySelector('#oTut').getBoundingClientRect().width > 0`));
await clickEl('#oTut');
check('…and replays it', await until(() => tut('on'), 2000));
await sleep(600);

console.log(logs.length ? logs.join('\n') : '  (no errors in the console)');
check('nothing threw', logs.length === 0);
console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
ws.close(); chrome.kill();
process.exit(fails.length ? 1 : 0);
