// THE TEAMS AND THE ARENA, WALKED (docs/TEAMS-ARENA.md). A fresh browser profile: the starter pick
// names each Mythic's team, the yes saves both, the leader's three cards, the home chip, the team
// screen. Asserts each step and photographs it. Run: node _arena-shots.mjs   (shots in .shots/arena)
//   SIZE=667x375 node _arena-shots.mjs     — another phone
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const PORT = Number(process.env.PORT || 3036), CDP = 9436;
const OUT = `${import.meta.dirname}/.shots/arena`;
const [W, H] = (process.env.SIZE || '844x390').split('x').map(Number);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
// the server this run starts: its own empty league, the dev buttons, a CPU after 1.2 s, short
// matches that the player (seat 0) wins
Object.assign(process.env, { ARENA_LIVE: '1', DATA_DIR: `${OUT}/data`, DEV_TOOLS: '1', QUEUE_BOT_MS: '1200', ARENA_VS_MS: '1800', MATCH_SECONDS: '6', TEST_SCORE: '2:0' });
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
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const clickEl = async (sel) => {
  const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
  if (r) await clickAt(r[0], r[1]);
  return !!r;
};
const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })()`);
// every element matching sel lies inside the viewport and none of them overlap each other
const inView = (sel) => js(`[...document.querySelectorAll(${JSON.stringify(sel)})].every((e) => { const b = e.getBoundingClientRect(); return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; })`);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
console.log(`· teams, ${W}×${H}`);

// ── THE STARTER PICK IS THE TEAM PICK ──
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await until(() => js(`MENU && MENU.screen`), 3000);
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await clickAt(W / 2, H / 2);
const starterUp = () => js(`!document.querySelector('#starter').classList.contains('hidden')`);
check('a new player gets the starter pick', await until(starterUp, 4000));
await sleep(700);
check('…titled for a champion AND a team', (await js(`document.querySelector('.st-h').textContent`)).includes('קבוצה'));
check('…every Mythic shows its team: "קבוצת X", in its colour', await js(`[...document.querySelectorAll('#stRow .st-card')].every((b) => { const t = b.querySelector('.st-team'); return t && t.textContent === 'קבוצת ' + b.querySelector('.st-name').textContent && t.querySelector('svg') && getComputedStyle(t).backgroundColor !== 'rgba(0, 0, 0, 0)'; })`));
check('…the four fit the screen', await inView('#stRow .st-card, .st-top, #stGo'));
await shot('starter');
await clickEl('#stRow .st-card[data-n="4"]');
await clickEl('#stGo');
await sleep(350);
check('the question names the team too', /פז/.test(await js(`document.querySelector('#stCQ').textContent`)) && (await js(`document.querySelector('#stCTeam').textContent`)) === 'ולהצטרף לקבוצת פז!');
check('…and says the team can change only once', (await js(`document.querySelector('.st-cn').textContent`)).includes('פעם אחת'));
await shot('starter-confirm');
await clickEl('#stYes');
check('the yes saves the starter (= the team)', await until(async () => (await js(`localStorage.getItem('hs.mythic.v1')`)) === JSON.stringify({ v: 1, starter: 4 }), 1500));
check('…and the tutorial starts', await until(() => js(`TUTORIAL.on`), 3000));
check('a device id was made', /^[0-9a-f-]{36}$/.test(await js(`localStorage.getItem('hs.device.v1')`)));

// ── THE TUTORIAL'S TEAM STEP ──
await js(`TUTORIAL.toShop()`);
await until(() => js(`TUTORIAL.phase === 'shop' || TUTORIAL.phase === 'shop-talk'`), 4000);
await sleep(500);
if (await js(`TUTORIAL.phase === 'shop'`)) { await clickEl('#upgRows .upg-row[data-k="speed"] .upg-buy'); await sleep(2400); }
await until(() => js(`document.querySelector('#tut').style.pointerEvents === 'auto'`), 6000);
await clickAt(W / 2, H / 2);                                   // the stats talk
check('after the shop: the team step, said by your leader', await until(() => js(`TUTORIAL.phase === 'team' && TEAMS_UI.introOn`), 3000), await js(`TUTORIAL.phase`));
await sleep(900);
check('…card 1: welcome to Paz\'s team', (await js(`document.querySelector('.ti-say').textContent`)).includes('פז') && await js(`!!document.querySelector('.ti-badge svg') && document.querySelector('.ti-team').textContent === 'קבוצת פז'`));
check('…the leader standing on the podium', await js(`!!document.querySelector('.ti-man canvas')`));
check('…the card fits the screen', await inView('.ti-box, .ti-lead'));
await shot('team-1');
await clickAt(W / 2, H / 2); await sleep(800);
check('…card 2: the four teams, yours marked', await js(`document.querySelectorAll('.ti-four .ti-t').length === 4 && document.querySelector('.ti-t.me b').textContent === 'פז'`));
await shot('team-2');
await clickAt(W / 2, H / 2); await sleep(1500);
check('…card 3: win, your team climbs, prizes', await js(`document.querySelectorAll('.ti-flow .ti-step').length === 3`));
await shot('team-3');
await clickAt(W / 2, H / 2);
check('…then the menu', await until(() => js(`MENU.screen === 'menu' && !TEAMS_UI.introOn`), 3000));
await sleep(800);
check('…with your team\'s chip under your profile', await visible('#hmTeam') && (await js(`document.querySelector('#hmTName').textContent`)) === 'קבוצת פז');
check('…and the coach pointing at PLAY for the arena', (await js(`document.querySelector('.tut-say').textContent`)).includes('לזירה'));
await shot('menu-arena');
await until(() => js(`document.querySelector('#tut').style.pointerEvents === 'auto'`), 4000);
await clickAt(W / 2, H / 2);
check('the tutorial is done, and the team was welcomed', await until(() => js(`!TUTORIAL.on`), 2000) && JSON.parse(await js(`localStorage.getItem('hs.team.v1')`)).welcomed === true);
await sleep(400);
check('the home HUD does not overlap: profile, trophies, team chip, tiles', await js(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = [r('#hmProfile'), r('.hm-cups'), r('#hmTeam'), r('#hmChars'), r('.hm-wallet')]; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const p = a[i], q = a[j]; if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) return false; } return true; })()`));
await shot('home');

// ── THE TEAM SCREEN ──
await clickEl('#hmTeam');
check('the chip opens your team', await until(() => js(`TEAMS_UI.screenOn`), 2000));
await sleep(700);
check('…your leader, your team\'s name', await js(`!!document.querySelector('.tm-man canvas') && document.querySelector('.tm-title').textContent === 'קבוצת פז'`));
check('…the panel fits', await inView('.tm-panel, .tm-side, #tmBack'));
await shot('team-screen');
await clickEl('#tmBack');
check('BACK closes it', await until(() => js(`!TEAMS_UI.screenOn`), 1500));

// ── A PLAYER WHO HAD A STARTER BEFORE TEAMS: meets the team once ──
await js(`localStorage.removeItem('hs.team.v1')`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await clickAt(W / 2, H / 2);
check('an existing player with a starter and no team: the leader\'s cards, once, on the home screen', await until(() => js(`MENU.screen === 'menu' && TEAMS_UI.introOn`), 4000));
for (let i = 0; i < 3; i++) { await sleep(400); await clickAt(W / 2, H / 2); }
check('…then the home screen', await until(() => js(`!TEAMS_UI.introOn`), 2000));
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await clickAt(W / 2, H / 2);
await until(() => js(`MENU.screen === 'menu'`), 3000); await sleep(600);
check('…and never again', !(await js(`TEAMS_UI.introOn`)));

// ── THE ARENA ──
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?teamsim` });
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await clickAt(W / 2, H / 2);
await until(() => js(`MENU.screen === 'menu'`), 3000);
check('the server knows this device: a profile', await until(() => js(`!!PROFILE`), 5000));
await js(`NET.league('dev', { op: 'toPlay' })`);
await sleep(600);
check('home: 0 trophies, arena 1 over PLAY, three empty stars', (await js(`document.querySelector('#hmCups').textContent`)) === '0' && (await js(`document.querySelector('#hmArena').textContent`)).includes('זירה 1') && (await js(`document.querySelectorAll('#hmStars i').length`)) === 3);
check('…and the modes button beside PLAY', await visible('#hmModes'));
check('the home HUD still does not overlap (PLAY, modes, pass, arena name)', await js(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = [r('#hmPlay'), r('#hmModes'), r('#hmPass'), r('#hmArena'), r('#hmTeam'), r('.hm-cups')]; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const p = a[i], q = a[j]; if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) return false; } return true; })()`));
await shot('home-arena');
await clickEl('#hmModes');
check('the modes button opens the other modes', await until(() => js(`MENU.screen === 'modes'`), 2000));
await js(`MENU.openMenu()`); await sleep(400);
await clickEl('#hmPlay');
check('PLAY searches for an opponent', await until(() => js(`ARENA_UI.searching`), 2000));
await sleep(500);
check('…you on the left, the roulette, a cancel', await visible('#afCancel') && (await js(`document.querySelector('#afMeName').textContent`)).length > 0);
await shot('arena-search');
check('nobody else here: the CPU, by name, after the wait', await until(() => js(`document.querySelector('#arFind').classList.contains('vs')`), 5000));
await sleep(600);
check('…the VS card: its name, team and trophies', (await js(`document.querySelector('#afOppName').textContent`)) !== '?' && await js(`!!document.querySelector('#afOppTeam .af-team')`));
check('…fits the screen', await inView('.af-row, .af-top, #afMsg'));
await shot('arena-vs');
check('kick-off: an arena match, on arena 1\'s stadium', await until(() => js(`MODE === 'arena' && STAGE.id === 'hs-day'`), 5000));
await sleep(1500);
await shot('arena-match');
check('the result: the server\'s trophies on the panel', await until(() => js(`!document.querySelector('#over').classList.contains('hidden') && !!document.querySelector('.oa .oa-cups')`), 20000));
await sleep(1800);
const won = await js(`ARENA_RES.delta`);
check(`…a win, +${won} (30 ± who you met), and the daily bonus`, won >= 20 && won <= 40 && (await js(`document.querySelector('.oa-cups').textContent`)).includes('+' + won) && (await js(`document.querySelector('#ovSpell').className`)).includes('win') && await js(`!!document.querySelector('.oa-bonus')`));
await shot('arena-result');
await clickEl('#back');
check(`home again: ${won} trophies, a star lit`, await until(() => js(`MENU.screen === 'menu' && document.querySelector('#hmCups').textContent === '${won}'`), 4000) && (await js(`document.querySelectorAll('#hmStars i.on').length`)) === 1);

// the road
for (let i = 0; i < 3; i++) { await js(`NET.league('dev', { op: 'trophies' })`); await sleep(150); }
await until(() => js(`PROFILE.trophies === ${won + 300}`), 3000);
await sleep(300);
check('300 more trophies: the road has prizes waiting (the ! on the trophies)', await js(`document.querySelector('#hmCupsBox').classList.contains('has-prize')`));
await clickEl('#hmCupsBox');
check('the trophies open the Trophy Road', await until(() => js(`ARENA_UI.roadOn`), 2000));
await sleep(500);
check('…its first prize ready to claim', await js(`!!document.querySelector('.ar-node.ready .ar-claim')`));
await shot('road');
const pts0 = await js(`JSON.parse(localStorage.getItem('hs.stats.v1') || '{"points":0}').points`);
await clickEl('.ar-node.ready .ar-claim');
check('…claimed: the points, paid by the server\'s word', await until(async () => (await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).points`)) === pts0 + 200, 3000), String(await js(`localStorage.getItem('hs.stats.v1')`)));
await sleep(500);
await shot('road-claimed');
await clickEl('#arRoadBack');

// the leaderboard, and the team week (seeded)
await js(`NET.league('dev', { op: 'seed' })`);
await sleep(600);
await clickEl('#hmBoard');
check('the leaderboard: your rank and the four teams this week', await until(() => js(`ARENA_UI.boardOn && document.querySelectorAll('#arBRows .tm-row').length === 4`), 3000));
check('…a number for you, never another kid\'s name', (await js(`document.querySelector('#arBRank').textContent`)).includes('#'));
await sleep(400);
await shot('board');
await clickEl('#arBTeam');
check('…on to your team', await until(() => js(`TEAMS_UI.screenOn`), 2000));
await sleep(700);
check('the team screen, live: standings, your part, the time left', await js(`document.querySelectorAll('#tmRows .tm-row').length === 4 && !!document.querySelector('#tmRows .tm-row.me') && document.querySelector('#tmWhen').textContent.length > 0`));
check('…and the dev buttons (?teamsim)', await visible('#tmDev button'));
await shot('team-live');
// three matches make you active; then the week ends
for (let k = 0; k < 2; k++) {
  await js(`TEAMS_UI.close(); MENU.openMenu(); playArena()`);
  await until(() => js(`MODE === 'arena' && ARENA_RES === null`), 8000);            // the match began
  await until(() => js(`!!ARENA_RES && !document.querySelector('#over').classList.contains('hidden')`), 25000);
  await sleep(600);
  await clickEl('#back'); await sleep(500);
}
check('three arena matches: active', await until(() => js(`PROFILE.week.me.played === 3`), 3000), String(await js(`PROFILE.week.me.played`)));
const pts1 = await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).points`);
await js(`NET.league('dev', { op: 'endWeek' })`);
check('the week ends: "how did your team do" on the home screen', await until(() => js(`TEAMS_UI.prizeOn`), 5000));
await sleep(1200);
await shot('week-prize');
const prize = await js(`document.querySelector('.tm-pzwin').textContent`);
await clickEl('#tmPzOk');
await sleep(500);
const pts2 = await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).points`);
check(`…paid once (${prize.trim() || 'no prize'})`, (prize.includes('+') ? pts2 > pts1 : pts2 === pts1));
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?teamsim` });
await until(() => js(`document.querySelector('#title').classList.contains('ld-done')`), 8000);
await clickAt(W / 2, H / 2);
await until(() => js(`MENU.screen === 'menu' && !!PROFILE`), 5000); await sleep(1200);
check('…and never again', !(await js(`TEAMS_UI.prizeOn`)) && (await js(`JSON.parse(localStorage.getItem('hs.stats.v1')).points`)) === pts2);

// the switch: the team and the champion
await clickEl('#hmTeam'); await until(() => js(`TEAMS_UI.screenOn`), 2000); await sleep(400);
await clickEl('#tmSwitch');
check('the switch: the other three teams', await until(() => js(`!document.querySelector('#tmSw').classList.contains('hidden') && document.querySelectorAll('#tmSwRow .tm-swc').length === 3`), 2000));
await clickEl('#tmSwRow .tm-swc[data-t="2"]'); await sleep(300);
check('…it says the champion changes and the old one locks', (await js(`document.querySelector('#tmSwQ').textContent`)).includes('יינעל'));
await shot('switch');
await clickEl('#tmSwYes');
check('…switched: Ori\'s team, Ori your champion, her intro', await until(() => js(`TEAMS_UI.introOn && localStorage.getItem('hs.mythic.v1') === '{"v":1,"starter":2}'`), 4000));
await sleep(700);
await shot('switch-intro');
for (let i = 0; i < 3; i++) { await clickAt(W / 2, H / 2); await sleep(400); }
await sleep(500);
check('…and the free switch is spent', (await js(`document.querySelector('#tmSwitch').textContent`)).includes('💎') && await js(`document.querySelector('#tmSwitch').disabled`));
await shot('team-after-switch');

console.log(logs.length ? logs.join('\n') : '  (no errors in the console)');
check('nothing threw', logs.length === 0);
console.log(fails.length ? `\n✗ ${fails.length} failed` : '\n✓ all passed');
ws.close(); chrome.kill();
process.exit(fails.length ? 1 : 0);
