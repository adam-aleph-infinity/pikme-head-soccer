// THE MENUS, WALKED. Drives the real client in headless Chrome through the whole navigation map
// of docs/HS-MENUS.md / the Phase 2 plan — title, menu, Player Select, shop, options, how to,
// multiplayer, lobby, a match, pause, give up, the result and back — asserting which screen is
// up at every hop, that it fits the glass, and that nothing threw. Then it photographs every
// screen at four sizes for a side-by-side with HS. Run: node _menu-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT || 3033), CDP = 9433;
const OUT = `${import.meta.dirname}/.shots/menus`;
rmSync(`${OUT}/prof`, { recursive: true, force: true });
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
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`console.${m.params.type} ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64')); };
const fails = [];
const check = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); if (!cond) fails.push(name); };
const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
  const r = e.getBoundingClientRect(); return !e.closest('.hidden') && r.width > 0 && r.height > 0; })()`);
const screen = () => js(`MENU.screen`);
const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.click(), 1`);
const until = async (f, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await sleep(60); } return false; };
const on = (id) => until(async () => (await screen()) === id && (await visible('#' + id)));
const KEYS = { Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32 };
const key = async (code) => {
  const k = code === 'Space' ? ' ' : code;
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: k, windowsVirtualKeyCode: KEYS[code] });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: KEYS[code] });
  await sleep(60);
};
const size = (w, h, touch = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: touch });
const go = async (q = '') => { await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${q}` }); await sleep(1600); };
// Everything inside the glass: no visible element of the screen sticks out past the viewport.
const fits = (sel) => js(`(() => { const root = document.querySelector(${JSON.stringify(sel)}); const bad = [];
  for (const e of root.querySelectorAll('button, .m-title, .m-panel, .m-pill, .m-chip, .sel-stats, .m-points')) {
    if (e.closest('.hidden') || e.closest('.rl-item') || e.closest('.mn-mode:not(.on)') || e.closest('.how-page:not(.on)')) continue;
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push((e.id || e.className).toString().slice(0, 30));
  } return bad; })()`);
const finish = async (a, b) => {
  await js(`MATCH.score = [${a}, ${b}]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.clock = 0.05;`);
  return until(() => visible('#over'), 4000);
};

await send('Page.enable');
await send('Runtime.enable');
await size(844, 390);

// ── THE WALK (an iPhone held sideways) ──────────────────────────────────────
console.log('· the walk, 844×390');
await go('?nointro');
check('boot opens on the title', (await screen()) === 'title' && await visible('#title'));
check('…and nothing else is showing', (await js(`MENU && ['menu','select','shop','howto','lobby','match'].every(s => document.getElementById(s).classList.contains('hidden'))`)));
await sleep(1500);
await shot('01-title');
await click('#title');
check('a tap on the title opens the main menu', await on('menu'));
await sleep(700);
check('the menu fits the glass', (await fits('#menu')).length === 0, (await fits('#menu')).join(','));
await shot('02-menu');
check('arcade is in the middle of the carousel', (await js(`document.querySelector('.mn-mode.on').dataset.mode`)) === 'arcade');
await key('ArrowRight');
check('→ turns the carousel to the tournament (HS\'s order)', (await js(`document.querySelector('.mn-mode.on').dataset.mode`)) === 'tournament');
await sleep(400); await shot('02b-menu-multi');
await key('ArrowLeft'); await key('ArrowLeft');
check('←← turns it round to practice (it loops)', (await js(`document.querySelector('.mn-mode.on').dataset.mode`)) === 'practice');
await key('ArrowRight');
await key('Enter');
check('Enter on arcade opens Player Select', await on('select'));
await sleep(700);
check('Player Select fits the glass', (await fits('#select')).length === 0, (await fits('#select')).join(','));
await shot('03-select');
check('a new campaign opens on stage 1', (await js(`document.querySelector('#selTabV').textContent`)) === '1/45');
check('stage 1 can be played', !(await js(`document.querySelector('#selPlay').disabled`)));
check('the last score reads 0 : 0', (await js(`document.querySelector('#selScore').textContent`)) === '0 : 0');
await key('ArrowDown'); await sleep(350);
check('↓ rolls the champions: stage 2 is locked', (await js(`document.querySelector('#selTabV').textContent`)) === '2/45' && await js(`document.querySelector('#selPlay').disabled`));
check('…and the tooltip says what it takes', await visible('#selTip'));
await shot('04-select-locked');
await key('ArrowUp'); await sleep(300);
await click('#selShop');
check('SHOP opens the shop', await on('shop'));
await sleep(500);
check('the shop fits the glass', (await fits('#shop')).length === 0, (await fits('#shop')).join(','));
await shot('05-shop');
check('five stats, each with a buy button', (await js(`document.querySelectorAll('#upgRows .upg-row .upg-buy').length`)) === 5);
await key('Escape');
check('Esc goes back to Player Select', await on('select'));
await click('#selRar'); await sleep(200);
check('the rarity pill steps to the next rarity', /אדיר/.test(await js(`document.querySelector('#selRar').textContent`)));
await click('#reelMe .rl-item.sel'); await sleep(250);
check('a tap on your frame opens the card popup', await visible('#cardsPop'));
await shot('06-cards');
await key('Escape');
check('Esc closes it', !(await visible('#cardsPop')));
await click('#selBack');
check('BACK goes to the main menu', await on('menu'));

await click('#mnOpt'); await sleep(300);
check('⚙ opens the options', await visible('#optPop'));
await shot('07-options');
await click('#oMus'); await sleep(50);
check('MUSIC switches off, and says so', (await js(`document.querySelector('#oMus .m-orb').classList.contains('off')`)) && !(await js(`MENU && localStorage.getItem('hs.audio.v1').includes('"music":true')`)));
await click('#oMus');
await click('#oStats'); await sleep(250);
check('STATS opens', await visible('#statsPop'));
await shot('08-stats');
await key('Escape');
await click('#oHow');
check('How to opens', await on('howto'));
await sleep(500);
await shot('09-howto');
await key('ArrowRight'); await sleep(450);
check('→ turns the page', (await js(`getComputedStyle(document.querySelector('#howTrack')).getPropertyValue('--p').trim()`)) === '1');
await shot('09b-howto-2');
await key('Escape');
check('BACK from how to returns to the menu, options open', (await on('menu')) && await visible('#optPop'));
await key('Escape');

await js(`MENU.openMenu()`); await key('ArrowRight'); await key('ArrowRight'); await key('Enter'); await sleep(300);
check('multiplayer opens its popup', await visible('#mpPop'));
await shot('10-multi');
await click('#hostBtn');
check('"make a room" opens the lobby', await on('lobby'));
await sleep(1200);
await shot('11-lobby');
check('the room gets a code', /^[A-Z0-9]{4}$/.test(await js(`document.querySelector('#roomCode').textContent`)));
await click('#lobbyBack');
check('BACK leaves the room for the menu', await on('menu'));

// practice → a match → pause → how to → give up → result → Player Select
await key('ArrowRight'); await key('Enter');
check('practice opens Player Select, practice flavour', (await on('select')) && await visible('#selDiff'));
await click('#diffUp'); await sleep(100);
check('the difficulty arrows move the bot', (await js(`pick.level`)) === 4);
await shot('12-select-practice');
await click('#selPlay');
check('PLAY starts the match', await until(() => visible('#match'), 2500));
await sleep(2600);
await key('Escape'); await sleep(300);
check('Esc pauses: HS\'s pause ring', await visible('#pause'));
await shot('13-pause');
await click('#pHow');
check('How to from the pause', await on('howto'));
await key('Escape');
check('…and back to the paused match', (await on('match')) && await visible('#pause'));
await click('#pGive'); await sleep(60);
await shot('13b-pause-closing');
check('GIVE UP: no result screen, straight back to Player Select (HS M16)', (await on('select')) && await visible('#selDiff') && !(await visible('#over')));
// a lost practice match: HS's LOSE, the "?!", NEXT bottom-right
await click('#selPlay');
await until(() => visible('#match'), 2500);
await sleep(2400);
check('a lost match reaches the result', await finish(0, 2));
await sleep(2300);
await shot('14-result-lose');
check('…YOU LOSE', /lose/.test(await js(`document.querySelector('#ovSpell').className`)));
check('one button, like HS: NEXT', (await js(`document.querySelector('#back').classList.contains('hidden')`)) && (await js(`document.querySelector('#again').textContent`)) === 'הבא');
check('…at the bottom-right, and the loser says "?!"', (await js(`document.querySelector('.ov-btns').classList.contains('lost')`)) && await visible('.ov-side.lost .ov-bub'));
await click('#again');
check('NEXT goes back to Player Select (practice)', (await on('select')) && await visible('#selDiff'));

// arcade: win stage 1 → points, NEXT MATCH → stage 2 selected
await click('#selBack'); await on('menu');
await key('ArrowRight'); await key('Enter');
await on('select');
await go('?arcade');
await click('#selPlay');
await until(() => visible('#match'), 2500);
for (const t of [250, 250, 250, 250, 250]) { await sleep(t); await shot(`15a-vs-${Date.now() % 100000}`); }
check('the VS says TOUCH TO KICK OFF (HS M16)', (await visible('#vs')) && await visible('#vs .vs-hint'));
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 420, y: 200, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 420, y: 200, button: 'left', clickCount: 1 });
check('…and a tap kicks off at once', await until(async () => !(await visible('#vs')), 600));
await sleep(800);
check('a won arcade match reaches the result', await finish(3, 0));
await sleep(2200);
await shot('15-result-win');
check('…and says YOU WIN', /win/.test(await js(`document.querySelector('#ovSpell').className`)));
check('the points strip shows the reward and the total', (await js(`document.querySelector('#ovReward').textContent`)) === '100' && (await js(`document.querySelector('#ovTotal').textContent`)) === (await js(`ARCADE_PROGRESS && JSON.parse(localStorage.getItem('hs.stats.v1')).points.toLocaleString('en-US')`)));
check('it names the unlock', /שלב 2/.test(await js(`document.querySelector('#ovNews').textContent`)));
check('the button is NEXT MATCH', (await js(`document.querySelector('#again').textContent`)) === 'המשחק הבא');
await click('#again');
check('NEXT MATCH opens Player Select on champion 2', (await on('select')) && (await js(`document.querySelector('#selTabV').textContent`)) === '2/45');
check('stage 1 now shows its last score, 3 : 0', await js(`ARCADE_PROGRESS.record[1].last.join() === '3,0'`));
await click('#selPlay');
await until(() => visible('#match'), 2500);
await sleep(2600);
await key('Escape'); await sleep(200);
await click('#quit');
check('TITLE (main menu) from the pause goes to the menu', await on('menu'));
check('…and quitting recorded nothing', await js(`!ARCADE_PROGRESS.record[2]`));
await js(`startArcadeStage(2)`); await sleep(2600);
await key('Escape'); await sleep(200);
await click('#pGive');
check('GIVE UP in the arcade records the loss', (await on('select')) && await js(`ARCADE_PROGRESS.record[2] && ARCADE_PROGRESS.record[2].l === 1`));
check('…and Player Select stays on that champion', (await js(`document.querySelector('#selTabV').textContent`)) === '2/45');

// ── the tournament: enter it, win the bracket, lift the cup; then a new one, knocked out ──
await js(`localStorage.removeItem('hs.tour.v1'); MENU.openMenu()`); await sleep(300);
await click('.mn-mode[data-mode="tournament"]'); await sleep(350);
await click('.mn-mode[data-mode="tournament"] .mn-pill'); await sleep(400);
check('the tournament opens its Player Select (HS: NEXT)', (await on('select')) && await visible('#selCup') && (await js(`document.querySelector('#selPlay').textContent`)) === 'הבא');
await shot('17-tour-select');
check('HS: you pick yourself from a SIDEWAYS reel', (await visible('#reelCup')) && !(await visible('#reelMe')) && await js(`document.querySelector('#reelCup').classList.contains('rl-x')`));
const card0 = await js(`pick.me.number`);
await key('ArrowRight'); await sleep(300);
check('→ moves it to the next card', (await js(`pick.me.number`)) === card0 + 1);
await key('ArrowLeft'); await sleep(300);
await click('#selPlay');
check('NEXT draws the bracket: eight players, you among them', (await on('bracket')) && (await js(`document.querySelectorAll('#brNodes .br-leaf').length`)) === 8 && await visible('.br-leaf.you'));
check('HS: the other three quarter-finals are already played — their winners climb', (await js(`document.querySelectorAll('#brNodes .br-node.won.fly').length`)) === 3);
check('…and PLAY waits while they do', await js(`document.querySelector('#brGo').disabled`));
await sleep(900);
await shot('18a-bracket-climbing');
check('each shows its score under the winner: loser red, winner blue', await js(`[...document.querySelectorAll('.br-node.won .br-score')].every(e => e.querySelector('.l') && e.querySelector('.w') && getComputedStyle(e.querySelector('.l')).color === 'rgb(232, 16, 46)' && getComputedStyle(e.querySelector('.w')).color === 'rgb(27, 95, 224)')`));
const brReady = () => until(async () => !(await js(`document.querySelector('#brGo').disabled`)), 6000);
check('then PLAY is ready', await brReady());
check('the bracket fits the glass', (await fits('#bracket')).length === 0, (await fits('#bracket')).join(','));
await shot('18-bracket');
for (const [k, round] of [[1, 'רבע גמר'], [2, 'חצי גמר'], [3, 'גמר']]) {
  await brReady();
  check(`round ${k}: ${round}, and the button plays it`, (await js(`document.querySelector('#brRound').textContent`)) === round);
  await click('#brGo');
  await until(() => visible('#match'), 2500);
  check(`round ${k}: a match against the drawn champion`, await js(`MATCH.players[1].char.number === TOURNEY.entrants[(() => { const m = TOURNEY.rounds[TOURNEY.round].find(x => x.a === 6 || x.b === 6); return m.a === 6 ? m.b : m.a; })()].stage`));
  await sleep(2500);
  await finish(2, 0);
  await sleep(1600);
  if (k === 1) await shot('19-tour-result');
  check(`round ${k}: the prize is paid`, (await js(`document.querySelector('#ovReward').textContent`)) === ['100', '700', '1,700'][k - 1]);
  await click('#again');
  await on('bracket');
  await sleep(k === 3 ? 2600 : 1300);
  if (k === 1) await shot('20-bracket-after-1');
}
check('the final won: the champion\'s trophy screen', await visible('#brWin'));
await shot('21-tour-champion');
check('…2,500 earned', (await js(`TOURNEY.earned`)) === 2500);
await click('#brWinOk'); await sleep(200);
check('the button now offers a new tournament', (await js(`document.querySelector('#brGo').textContent`)) === 'טורניר חדש');
await click('#brGo');
check('a new tournament starts from its Player Select', (await on('select')) && (await js(`TOURNEY === null`)));
await click('#selPlay'); await on('bracket'); await brReady();
await click('#brGo'); await until(() => visible('#match'), 2500); await sleep(2500);
await finish(0, 1); await sleep(1500);
check('a loss: the result says you are out', /הודחתם/.test(await js(`document.querySelector('#ovNews').textContent`)));
await click('#again'); await on('bracket'); await brReady();
check('…the bracket shows you out, the rest played to a winner', (await js(`TOURNEY.out && TOURNEY.rounds[2][0].winner !== null`)) && await visible('.br-leaf.you.out'));
await shot('22-bracket-out');
await click('#brBack');
check('BACK goes to the menu', await on('menu'));

// deep links skip the title
await go('?arcade');
check('?arcade opens Player Select, no title', (await screen()) === 'select');
await go('?room=ABCD');
check('?room=ABCD opens the lobby, joining', (await screen()) === 'lobby' && (await js(`document.querySelector('#codeInput').value`)) === 'ABCD');

// a phone held upright is asked to turn
await size(390, 844, true);
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await go('?nointro');
check('upright on a phone: the turn-the-phone card', await visible('#rotateMenu'));
await shot('16-portrait');
await send('Emulation.setTouchEmulationEnabled', { enabled: false });

// ── EVERY SCREEN AT FOUR SIZES ────────────────────────────────────────────
for (const [w, h] of [[667, 375], [844, 390], [1000, 620], [1440, 800]]) {
  console.log(`· ${w}×${h}`);
  await size(w, h);
  await go('?nointro');
  await sleep(1300);
  await shot(`s${w}-1-title`);
  await click('#title'); await on('menu'); await sleep(600);
  await shot(`s${w}-2-menu`);
  check(`${w}: the menu fits`, (await fits('#menu')).length === 0, (await fits('#menu')).join(','));
  await js(`MENU.openSelect('arcade')`); await sleep(600);
  await shot(`s${w}-3-select`);
  check(`${w}: Player Select fits`, (await fits('#select')).length === 0, (await fits('#select')).join(','));
  await js(`MENU.openShop()`); await sleep(500);
  await shot(`s${w}-4-shop`);
  check(`${w}: the shop fits`, (await fits('#shop')).length === 0, (await fits('#shop')).join(','));
  await js(`MENU.openMenu(); MENU.openOptions()`); await sleep(400);
  await shot(`s${w}-5-options`);
  await js(`MENU.closePops(); MENU.openMp()`); await sleep(400);
  await shot(`s${w}-6-multi`);
  await js(`MENU.closePops(); MENU.openHowTo('menu')`); await sleep(500);
  await shot(`s${w}-7-howto`);
}

const errs = logs.filter((l) => !/favicon|Failed to load resource/.test(l));
check('no page exceptions or console errors', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(`\n_menu-shots: ${fails.length ? fails.length + ' FAILED: ' + fails.join(' · ') : 'all passed'}  (shots → ${OUT})`);
chrome.kill();
process.exit(fails.length ? 1 : 0);
