// Drive the ARCADE through the real client in headless Chrome, and screenshot it.
//
// The unit tests prove the rules; this proves a thumb can get through them. It plays the flow
// the way a player does — card, «שחק», the mode page, a room, the board, a locked stage that
// refuses to start, a win that unlocks the next, a reload that remembers it, a loss and a retry —
// and fires one champion of every Head Soccer shot family in the live renderer so the shots can be
// looked at (_vfx-shots.mjs photographs each family frame-exactly).
//
//   node _arcade-shots.mjs            → PNGs in .shots/arcade, exit 1 on any failed check
//   PORT=3027 node _arcade-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { CHAMPIONS } from './shared/champions.js';

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

await send('Page.enable');
await send('Runtime.enable');
await phone(844, 390);

// ── 1–4. Player Select (the menus themselves are walked by _menu-shots.mjs) ─
await go('?me=legendary_3&arcade');
await shot('05-select');
check('?arcade opens Player Select', await visible('#select') && (await js(`MENU.screen`)) === 'select');
check('the champion reel holds all 45', await js(`document.querySelectorAll('#reelFoe .rl-item').length`) === 45);
check('a new campaign: stage 1 open, nothing beaten', await js(`ARCADE_PROGRESS.cleared === 0 && !document.querySelector('#selPlay').disabled`));
check('the selected champion shows its face', await js(`(() => { const f = document.querySelector('#reelFoe .rl-item.sel .m-face'); return !!f && (/supabase|char/.test(f.style.backgroundImage) || f.classList.contains('char-face')); })()`));

await js(`MENU.selectStage(5)`); await sleep(300);
await shot('06-locked-stage');
check('a locked stage says so', await js(`document.querySelector('#selPlay').disabled && !document.querySelector('#selTip').classList.contains('hidden')`));
check('and cannot be started', (await js(`startArcadeStage(5)`)) === false && (await js(`ARCADE`)) === null && await visible('#select'));

await js(`MENU.selectStage(1)`); await sleep(300);
check('stage 1 shows its champion and power', await js(`document.querySelector('#selPower').textContent.includes(CHAMPIONS[0].powerName)`));
await click('#selPlay');
await sleep(2400);                       // HS's VS is ~2 s (M16)
await shot('07-stage1-kickoff');
check('stage 1 starts a match against champion 1', await js(`ARCADE && ARCADE.stage === 1 && MATCH.players[1].char.number === 1 && MATCH.players[1].char.rarity === 'legendary'`));
check('it is an arcade match (champion powers on)', await js(`!!MATCH.champ && !!MATCH.players[1].champ && !!MATCH.players[0].champ`));
check('the HUD letters its bars POWER, as HS does', await js(`document.querySelector('.gauge.g1 .nm').textContent`) === 'POWER');

// ── 5. a champion power, fired in the live client ────────────────────────
await js(`(() => { const p = MATCH.players[0]; window.BOT_OFF = true; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.hitStop = 0;
  p.gauge = 1; p.armed = 1; MATCH.ball.x = p.x; MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8; MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; EVENTS.length = 0; })()`);
await sleep(250);
check('touching the ball fires my champion power', await js(`EVENTS.some(e => e.type === 'powershot' && e.player === 0 && e.champ === 'legendary_3')`));
await shot('08-power-blaze');

// ── 6. win → next stage unlocks, and the result says so ──────────────────
await js('window.BOT_OFF = false');
check('a won match reaches the result', await finish(3, 1));
await sleep(1500);
await shot('09-victory');
check('the result is a victory', /\bwin\b/.test(await js(`document.querySelector('#ovSpell').className`)));
check('…that names the unlock', /שלב 2/.test(await js(`document.querySelector('#ovNews').textContent`)));
check('…and offers the next match', await js(`document.querySelector('#again').textContent`) === 'המשחק הבא');
await click('#again'); await sleep(500);
check('NEXT MATCH: Player Select on stage 2', (await js(`MENU.screen`)) === 'select' && (await js(`document.querySelector('#selTabV').textContent`)) === '2/45');
check('stage 1 completed and ONLY stage 2 unlocked', await js(`ARCADE_PROGRESS.cleared === 1`));

// ── 7. it survives a reload ──────────────────────────────────────────────
await go('?arcade');
await shot('10-select-after-reload');
check('after a reload: Player Select opens on stage 2', (await js(`document.querySelector('#selTabV').textContent`)) === '2/45');
check('the saved record is under its own key', await js(`JSON.parse(localStorage.getItem('hs.arcade.v1')).cleared`) === 1);

// ── 8. lose → back to the same stage, nothing unlocked ───────────────────
check('stage 2 starts', await js(`startArcadeStage(2)`) === true);
await sleep(1500);
check('a lost match reaches the result', await finish(0, 2));
await sleep(1200);
await shot('11-defeat');
check('the result is a defeat with NEXT', /\blose\b/.test(await js(`document.querySelector('#ovSpell').className`)) && await js(`document.querySelector('#again').textContent`) === 'הבא');
await click('#again'); await sleep(500);
check('NEXT goes back to the same champion', (await js(`document.querySelector('#selTabV').textContent`)) === '2/45');
await js(`startArcadeStage(2)`); await sleep(1300);
await js(`document.querySelector('#pauseBtn').click()`); await sleep(150);
await click('#quit'); await sleep(300);
check('the loss unlocked nothing, and quitting recorded nothing', await js(`ARCADE_PROGRESS.cleared === 1 && ARCADE_PROGRESS.record[2].l === 1 && ARCADE_PROGRESS.record[2].w === 0`));

// ── 9. the power shots, looked at ────────────────────────────────────────
// Unlock the board by hand so any stage can be opened, then fire the first champion of each of
// the eleven families from the player's seat and photograph it: armed, under the cut-in, in flight.
await js(`localStorage.setItem('hs.arcade.v1', JSON.stringify({ v: 1, cleared: 44, record: {} }))`);
const firstOfFamily = [...new Map(CHAMPIONS.map((c) => [c.hs.family, c])).values()];
for (const c of firstOfFamily) {
  const n = c.stage, tag = `${String(n).padStart(2, '0')}-${c.hs.family}`;
  await go(`?me=legendary_${n}&solo=1&nointro&arcade=${n}`);
  await sleep(700);
  await js(`(() => { const p = MATCH.players[0]; MATCH.phase = 'play'; MATCH.freeze = 0; MATCH.hitStop = 0;
    p.x = 330; p.gauge = 1; p.armed = 1; MATCH.ball.x = 530; MATCH.ball.y = 120; MATCH.ball.vx = MATCH.ball.vy = 0; })()`);
  await sleep(250);
  await shot(`20-power-${tag}-0armed`);
  await js(`(() => { const p = MATCH.players[0]; MATCH.hitStop = 0; MATCH.ball.x = p.x; MATCH.ball.y = p.y - C.BODY_H - C.HEAD_R + 8;
    MATCH.ball.vx = MATCH.ball.vy = 0; MATCH.ball.power = null; EVENTS.length = 0; })()`);
  await sleep(400);
  await shot(`20-power-${tag}-0cut`);                 // the cut-in, holding the match
  await sleep(700);                                    // …past the 0.97s hold, the shot in flight
  await shot(`20-power-${tag}-1`);
  await sleep(500);
  await shot(`20-power-${tag}-2`);
  check(`${c.hs.family} (stage ${n}): fires in the live client`, await js(`EVENTS.some(e => e.type === 'powershot' && e.champ === '${c.id}' && e.fam === '${c.hs.family}')`));
}

// ── 10. the smallest phone, and an album ─────────────────────────────────
await phone(667, 375);
await go('?arcade');
await shot('30-select-se');
check('on a 667x375 phone Player Select still fits', await js(`['#selPlay', '#selShop', '#selBack', '.sel-panel'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1; })`));

// Inside the app the album gates YOUR card; the arcade must play whatever you own.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.SALTIZ_CARDS = [{ r: 'epic', n: 4 }, { r: 'rare', n: 9 }, { r: 'legendary', n: 12 }];` });
await phone(844, 390);
await go('?arcade');
check('with an album, the arcade plays a card you own', await js(`pick.me.rarity === 'legendary' && pick.me.number === 12 && document.querySelector('#reelMe .rl-item.sel .m-cage') === null`));
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
