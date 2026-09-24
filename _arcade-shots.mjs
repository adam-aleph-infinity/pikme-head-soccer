// Drive the ARCADE through the real client in headless Chrome, and screenshot it.
//
// The unit tests prove the rules; this proves a thumb can get through them. It plays the flow
// the way a player does — card, «שחק», the mode page, a room, the board, a locked stage that
// refuses to start, a win that unlocks the next, a reload that remembers it, a loss and a retry —
// and fires a spread of champion powers in the live renderer so the effects can be looked at.
//
//   node _arcade-shots.mjs            → PNGs in .shots/arcade, exit 1 on any failed check
//   PORT=3027 node _arcade-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { POWER_ORDER } from './shared/powers.js';

const PORT = process.env.PORT || 3027;
await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/arcade`;
mkdirSync(OUT, { recursive: true });
rmSync(`${OUT}/prof`, { recursive: true, force: true });   // a fresh device: no saved progress
const CDP = 9467;
const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank',
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};
const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};
const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
  const r = e.getBoundingClientRect(); return !e.closest('.hidden') && r.width > 0 && r.height > 0; })()`);
const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
const phone = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
const go = async (q = '') => { await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${q}` }); await sleep(1800); };
// End the running match now, on a chosen score. A decided score at 0.05s left is full time.
const finish = async (a, b) => {
  await js(`MATCH.score = [${a}, ${b}]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.clock = 0.05;`);
  for (let i = 0; i < 20; i++) { await sleep(150); if (await visible('#over')) return true; }
  return false;
};
const tileStates = () => js(`[...document.querySelectorAll('#arcGrid .arc-tile')].map(t => t.classList.contains('done') ? 'D' : t.classList.contains('open') ? 'O' : t.classList.contains('locked') ? 'L' : '?').join('')`);

await send('Page.enable');
await send('Runtime.enable');
await phone(844, 390);

// ── 1. the card menu is where it was ─────────────────────────────────────
await go('?me=legendary_3');
await shot('01-pick');
check('the card menu opens on אגדי', await js(`document.querySelector('#rarityTabs .on').dataset.r === 'legendary' && document.querySelectorAll('#cardGrid .card').length === 45`));
check('its bar has one way forward: שחק', await js(`document.querySelector('#playBtn').textContent.trim() === 'שחק'`) && !(await js(`!!document.querySelector('#modes')`)));

// ── 2. the mode page: exactly two options ────────────────────────────────
await click('#playBtn');
await sleep(200);
await shot('02-modes');
check('שחק opens the mode page', await visible('#modeSel') && !(await visible('#pick')));
check('the mode page has exactly two options', await js(`document.querySelectorAll('#modeSel .mode-card').length`) === 2);
check('…multiplayer and arcade', await js(`[...document.querySelectorAll('#modeSel .mode-card b')].map(b => b.textContent).join('|')`) === 'רב משתתפים|שחקן יחיד');
check('the arcade card says where you are', /שלב 1/.test(await js(`document.querySelector('#modeArcadeSub').textContent`)));

// ── 3. multiplayer is the room flow it always was ────────────────────────
await click('#modeMulti');
await sleep(150);
check('multiplayer offers the two room buttons', await visible('#hostBtn') && await visible('#joinBtn'));
await shot('03-multiplayer');
await click('#hostBtn');
let code = '';
for (let i = 0; i < 30 && !/^[A-Z0-9]{4}$/.test(code); i++) { await sleep(200); code = await js(`document.querySelector('#roomCode').textContent`); }
await shot('04-lobby');
check('create-link opens the existing lobby with a room code', await visible('#lobby') && /^[A-Z0-9]{4}$/.test(code), code);
await click('#lobbyBack');
await sleep(200);
check('back from the lobby returns to the mode page', await visible('#modeSel') && await visible('#hostBtn'));
await click('#modeBack');
await sleep(150);
check('back from the mode page returns to the cards', await visible('#pick'));

// ── 4. the board ─────────────────────────────────────────────────────────
await click('#playBtn'); await sleep(150);
await click('#modeArcade'); await sleep(400);
await shot('05-board');
const s0 = await tileStates();
check('the board shows 45 champions', s0.length === 45, s0);
check('a new campaign: stage 1 open, 2-45 locked', s0 === 'O' + 'L'.repeat(44), s0);
check('progress reads 0 / 45', await js(`document.querySelector('#arcProg').textContent`) === '0 / 45');
const faces = await js(`[...document.querySelectorAll('#arcGrid .f')].filter(f => /supabase/.test(f.style.backgroundImage)).length`);
check('every tile shows its champion\'s card', faces === 45, `${faces}/45`);
const fit = await js(`(() => { const b = document.querySelector('#arcade').getBoundingClientRect(); const els = ['#arcPlay', '#freeBtn', '#arcGrid'].map(s => document.querySelector(s).getBoundingClientRect());
  return els.every(r => r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1) && document.body.scrollWidth <= innerWidth + 1; })()`);
check('the whole board and its buttons fit a landscape phone', fit);

await click('#arcGrid .arc-tile:nth-child(5)'); await sleep(120);
await shot('06-locked-stage');
check('a locked stage says so', (await js(`document.querySelector('#arcStatus').textContent`)).includes('נעול') && await js(`document.querySelector('#arcPlay').disabled`));
check('and cannot be started', (await js(`startArcadeStage(5)`)) === false && (await js(`ARCADE`)) === null && await visible('#arcade'));

await click('#arcGrid .arc-tile:nth-child(1)'); await sleep(120);
check('stage 1 shows its champion and power', await js(`document.querySelector('#arcTitle').textContent`) === 'התותחן' && /תותח/.test(await js(`document.querySelector('#arcPower').textContent`)));
await click('#arcPlay');
await sleep(1600);
await shot('07-stage1-kickoff');
check('stage 1 starts a match against champion 1', await js(`ARCADE && ARCADE.stage === 1 && MATCH.players[1].char.number === 1 && MATCH.players[1].char.rarity === 'legendary'`));
check('it is an arcade match (champion powers on)', await js(`!!MATCH.champ && !!MATCH.players[1].champ && !!MATCH.players[0].champ`));
check('the HUD names the champion powers', await js(`document.querySelector('.gauge.g1 .nm').textContent`) === 'תותח');

// ── 5. a champion power, fired in the live client ────────────────────────
await js(`(() => { const p = MATCH.players[0]; window.BOT_OFF = true; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.hitStop = 0;
  p.gauge = 1; p.armed = 1; MATCH.ball.x = p.x; MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8; MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; EVENTS.length = 0; })()`);
await sleep(250);
check('touching the ball fires my champion power', await js(`EVENTS.some(e => e.type === 'powershot' && e.player === 0 && e.champ === 'blaze')`));
await shot('08-power-blaze');

// ── 6. win → next stage unlocks, and the result says so ──────────────────
await js('window.BOT_OFF = false');
check('a won match reaches the result', await finish(3, 1));
await shot('09-victory');
check('the result is a victory', await js(`document.querySelector('#overTitle').textContent`) === 'ניצחון!');
check('…that names the unlock', /שלב 2 נפתח/.test(await js(`document.querySelector('#overSub').textContent`)));
check('…and offers the next stage', await js(`document.querySelector('#again').textContent`) === 'השלב הבא');
await click('#back'); await sleep(300);
const s1 = await tileStates();
check('stage 1 is completed and ONLY stage 2 unlocked', s1 === 'DO' + 'L'.repeat(43), s1);
check('progress reads 1 / 45', await js(`document.querySelector('#arcProg').textContent`) === '1 / 45');

// ── 7. it survives a reload ──────────────────────────────────────────────
await go('?arcade');
const s2 = await tileStates();
await shot('10-board-after-reload');
check('after a reload: stage 1 still completed, stage 2 still open', s2 === 'DO' + 'L'.repeat(43), s2);
check('the saved record is under its own key', await js(`JSON.parse(localStorage.getItem('hs.arcade.v1')).cleared`) === 1);

// ── 8. lose → retry the same stage, nothing unlocked ─────────────────────
check('stage 2 starts from the board', await js(`startArcadeStage(2)`) === true);
await sleep(1500);
check('a lost match reaches the result', await finish(0, 2));
await shot('11-defeat');
check('the result is a defeat with a retry', await js(`document.querySelector('#overTitle').textContent`) === 'הפסדת' && await js(`document.querySelector('#again').textContent`) === 'נסה שוב');
await click('#again'); await sleep(1500);
check('retry replays the same stage', await js(`ARCADE && ARCADE.stage === 2 && MATCH.players[1].char.number === 2`));
await click('#quit'); await sleep(300);
const s3 = await tileStates();
check('the loss unlocked nothing, and quitting recorded nothing', s3 === 'DO' + 'L'.repeat(43), s3);

// ── 9. the powers, looked at ─────────────────────────────────────────────
// Unlock the board by hand so any stage can be opened, then fire a spread of powers from the
// player's seat and photograph what each one leaves on the pitch.
await js(`localStorage.setItem('hs.arcade.v1', JSON.stringify({ v: 1, cleared: 44, record: {} }))`);
// All 45: each champion's power fired from the player's seat, photographed three times — the
// super cut-in, the burst just after it, and the main effect a beat later — with the armed tell photographed on
// the way in. The VFX review reads these.
const early = { meteor: 450, split: 330, tornado: 700, stutter: 380, boomerang: 420 };
for (const [k, power] of POWER_ORDER.entries()) {
  const n = k + 1, tag = `${String(n).padStart(2, '0')}-${power}`;
  await go(`?me=legendary_${n}&solo=1&arcade=${n}`);
  await sleep(700);
  await js(`(() => { const p = MATCH.players[0]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.hitStop = 0;
    p.x = 330; p.gauge = 1; p.armed = 1; MATCH.ball.x = 530; MATCH.ball.y = 120; MATCH.ball.vx = MATCH.ball.vy = 0; })()`);
  await sleep(250);
  if (n % 5 === 1) await shot(`20-power-${tag}-0armed`);
  await js(`(() => { const p = MATCH.players[0]; MATCH.hitStop = 0; MATCH.ball.x = p.x; MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8;
    MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; EVENTS.length = 0; })()`);
  await sleep(220);
  await shot(`20-power-${tag}-0cut`);                 // the super cut-in, holding the match
  await sleep(240 + (early[power] || 260));           // …past the hold, into the power itself
  await shot(`20-power-${tag}-1`);
  await sleep(650);
  await shot(`20-power-${tag}-2`);
  check(`${power}: fires in the live client`, await js(`EVENTS.some(e => e.type === 'powershot' && e.champ === '${power}')`));
}

// ── 10. the smallest phone, and an album ─────────────────────────────────
await phone(667, 375);
await go('?arcade');
await shot('30-board-se');
check('on a 667x375 phone the board still fits', await js(`['#arcPlay', '#freeBtn', '#arcGrid'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1; })`));
await go(''); await click('#playBtn'); await sleep(200);
await shot('31-modes-se');
check('and so does the mode page', await js(`[...document.querySelectorAll('.mode-card')].every(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; })`));

// Inside the app the album gates YOUR card; the arcade must play whatever you own.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.SALTIZ_CARDS = [{ r: 'epic', n: 4 }, { r: 'rare', n: 9 }, { r: 'legendary', n: 12 }];` });
await phone(844, 390);
await go('?arcade');
check('with an album, the arcade plays a card you own', await js(`pick.me.rarity === 'legendary' && pick.me.number === 12 && /האסטרונאוט/.test(document.querySelector('#arcYou').textContent)`));
check('and a stage still starts', await js(`startArcadeStage(1)`) === true);
await sleep(1200);
check('as the owned card', await js(`MATCH.players[0].char.number === 12 && MATCH.players[0].champ.power === 'lowgrav'`));

const errs = logs.filter((l) => /EXCEPTION|error/i.test(l));
check('no page exceptions', errs.length === 0, errs.slice(0, 3).join(' | '));

ws.close();
chrome.kill();
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_arcade-shots: ${fails.length} FAILED: ${fails.join(', ')}` : '_arcade-shots: all checks passed');
process.exit(fails.length ? 1 : 0);
