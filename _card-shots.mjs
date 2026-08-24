// Drive the REAL client in real Chrome and prove the hand works as a control surface.
//
// test-cards.mjs proves the sim: the deal is fair, the ladder is monotonic, a held button
// fires once. None of that says the three cards are ON SCREEN, that they show the right
// faces, that pressing one does anything, or that a player can drag them somewhere their
// thumb reaches. Those are claims about a browser, so they get checked in a browser.
//
// The three things this catches that a node test cannot:
//   • the row rendering blank — card art is CSS background-image on purpose (a canvas blit
//     comes out empty inside a WKWebView), and only a real layout says whether it painted
//   • a card that cannot be pressed — pointer-events, z-order, the edit-mode guard
//   • a layout that does not survive a reload, which is the whole point of saving it
//
//   node _card-shots.mjs            → PNGs + checks
//   PORT=3020 node _card-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT || 3020;
const OUT = process.env.SHOT_OUT || '/tmp/hs-cards';
const ME = process.argv[2] || 'legendary_3';
const FOE = process.argv[3] || 'legendary_2';
const CDP = 9467;
mkdirSync(OUT, { recursive: true });

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
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
const fails = [];
const check = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) fails.push(name);
};
// A real key, through the real listener — not a synthetic held[] poke. The point is to test
// the path a player uses, including the KEYMAP lookup that a rebind screen can break.
const key = async (code, down = true) => {
  await send('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', code,
    windowsVirtualKeyCode: code.startsWith('Digit') ? 48 + Number(code.slice(5)) : 0,
    key: code.startsWith('Digit') ? code.slice(5) : code,
  });
};
const dragBy = async (x, y, dx, dy) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (dx * i) / 6, y: y + (dy * i) / 6, button: 'left', buttons: 1 });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', buttons: 0, clickCount: 1 });
};

await send('Page.enable');
await send('Runtime.enable');
// A harness that lets Chrome serve a cached module is a harness that tests yesterday's
// build. This cost an hour once: the page ran a copy of game.js from an earlier edit while
// every check below was written against the file on disk, and the two disagreed silently.
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
// A DESKTOP pointer on purpose, and no ?pad=1: the row has to be there without being asked.
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&solo=1&play=1&stage=neon` });
await sleep(2800);

await evalJs(`
  window.__cards = () => [...document.querySelectorAll('#cardRow .card')].map((b) => {
    const r = b.getBoundingClientRect();
    const art = getComputedStyle(b.querySelector('.card-art'));
    return {
      k: b.dataset.k, slot: +b.dataset.slot,
      x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
      onScreen: r.width > 0 && r.bottom <= innerHeight + 1 && r.top >= 0,
      art: art.backgroundImage, colour: getComputedStyle(b).getPropertyValue('--pc').trim(),
      fill: +getComputedStyle(b).getPropertyValue('--f'),
      ready: b.classList.contains('ready'), live: b.classList.contains('live'),
      xf: getComputedStyle(b).transform, size: getComputedStyle(b).getPropertyValue('--s').trim(),
      label: b.querySelector('.card-key').textContent,
    };
  });
  window.__hand = () => MATCH.cards.hands[0].map((c) => c.rarity + '_' + c.number);
  true;
`);

check('the client booted into a match with a hand',
  (await evalJs('!!window.MATCH && !!MATCH.cards')) === true);

// ── 1. The row is simply there, on a desktop pointer, unasked ─────────────────
let cards = await evalJs('__cards()');
check('three cards are on screen without ?pad=1',
  cards.length === 3 && cards.every((c) => c.onScreen), JSON.stringify(cards.map((c) => c.onScreen)));
check('and so are the walk and act buttons',
  (await evalJs(`[...document.querySelectorAll('.pad .btn')].filter(b=>b.getBoundingClientRect().width>0).length`)) === 8);

check('every card painted its face',
  cards.every((c) => /url\(/.test(c.art)), cards.map((c) => c.art.slice(0, 40)).join(' | '));
check('the faces are three DIFFERENT cards',
  new Set(cards.map((c) => c.art)).size === 3);
check('slot 0 is the card you are playing as',
  (await evalJs('__hand()'))[0] === ME, (await evalJs('__hand()')).join(', '));
check('each card is keyed to its power colour',
  new Set(cards.map((c) => c.colour)).size === 3, cards.map((c) => c.colour).join(' '));
await shot('01-row');

// ── 2. Pressing one, with a real key ─────────────────────────────────────────
const before = await evalJs('JSON.stringify(MATCH.cards.cd)');
await key('Digit1', true); await sleep(120); await key('Digit1', false);
await sleep(120);
const after = await evalJs('JSON.stringify(MATCH.cards.cd)');
check('pressing 1 spends the first card', before !== after, `${before} → ${after}`);
cards = await evalJs('__cards()');
check('and that card starts cooling', cards[0].fill < 0.98 && !cards[0].ready,
  `fill ${cards[0].fill.toFixed(2)} ready=${cards[0].ready}`);
check('the other two are still ready', cards[1].ready && cards[2].ready);
check('a cooling card counts itself down', /^\d+$/.test(cards[0].label), `label "${cards[0].label}"`);

// The other half of pressing one: everybody is told. Before this the only feedback was your
// own button greying out, and the opponent got no signal that the reason they were suddenly
// heavy was a card rather than the game.
const shout = await evalJs(`(() => {
  const el = document.querySelector('#callouts .callout');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { who: el.querySelector('.who').textContent, what: el.querySelector('.what').textContent,
           side: el.className, colour: cs.getPropertyValue('--cc').trim(), anim: cs.animationName };
})()`);
check('using a card announces it on screen', !!shout && !!shout.what, JSON.stringify(shout));
check('and says which player, in that power\'s colour',
  !!shout && /p0/.test(shout.side) && shout.colour.length > 0, JSON.stringify(shout));
await shot('02-pressed');

// Holding it down must not machine-gun it — the edge latch, seen from the outside.
await key('Digit2', true);
await sleep(700);
const cd2 = await evalJs('MATCH.cards.cd[1]');
await sleep(600);
const cd2b = await evalJs('MATCH.cards.cd[1]');
await key('Digit2', false);
check('holding a card fires it once and then cools normally', cd2b < cd2 && cd2b > 0,
  `${cd2} → ${cd2b} ticks`);

// And the ring actually unwinds.
const f0 = (await evalJs('__cards()'))[0].fill;
await sleep(1500);
const f1 = (await evalJs('__cards()'))[0].fill;
check('the cooldown ring fills as it recharges', f1 > f0, `${f0.toFixed(2)} → ${f1.toFixed(2)}`);
await shot('03-cooling');

// ── 3. A live power greys its own card ───────────────────────────────────────
// Whichever of this hand's three powers happens to be a timed one — the hand is dealt, so
// hard-coding GROW here tested nothing on a hand that holds none of it.
const slotted = await evalJs(`(() => {
  const SLOT = { 1: 0, 2: 1, 4: 2, 5: 3 };
  for (let s = 0; s < 3; s++) {
    const c = MATCH.cards.hands[0][s];
    const k = window.cardKind(MATCH, 0, s);
    if (SLOT[k] !== undefined) { MATCH.pu.eff[SLOT[k]] = 300; return { s, k }; }
  }
  return null;
})()`);
await sleep(150);
const liveCard = (await evalJs('__cards()')).find((c) => c.live);
check('a card whose power is already running is marked live',
  !slotted || (!!liveCard && liveCard.slot === slotted.s),
  slotted ? `slot ${slotted.s} kind ${slotted.k} eff=${await evalJs('JSON.stringify([...MATCH.pu.eff])')} live=${(await evalJs('__cards()')).map((c) => c.live).join(',')}` : 'no timed power');
await evalJs('MATCH.pu.eff.fill(0)');

// ── 4. EDIT MODE ─────────────────────────────────────────────────────────────
// The editor is reached from SETTINGS now, the way football's is. Going through the gear is
// the point of the check: an editor only reachable from a button I remember to keep on the
// top bar is an editor a player never finds.
await evalJs(`document.getElementById('gear').click()`);
await sleep(150);
check('settings has a row that opens the controls editor',
  (await evalJs(`!!document.getElementById('editCtlBtn') && document.getElementById('editCtlBtn').getBoundingClientRect().width > 0`)) === true);
await evalJs(`document.getElementById('editCtlBtn').click()`);
await sleep(200);
check('the edit bar opens', (await evalJs(`!document.getElementById('editBar').classList.contains('hidden')`)) === true);
check('and settings closes behind it',
  (await evalJs(`document.getElementById('tuner').classList.contains('hidden')`)) === true);
await shot('10-edit-open');

cards = await evalJs('__cards()');
const c0 = cards[0];
const cdBefore = await evalJs('JSON.stringify(MATCH.cards.cd)');
await dragBy(c0.x, c0.y, -120, -70);
await sleep(200);
let moved = (await evalJs('__cards()'))[0];
check('dragging a card moves it', Math.abs(moved.x - c0.x) > 60 && Math.abs(moved.y - c0.y) > 30,
  `(${c0.x.toFixed(0)},${c0.y.toFixed(0)}) → (${moved.x.toFixed(0)},${moved.y.toFixed(0)})`);
check('and dragging it did NOT fire it',
  (await evalJs('JSON.stringify(MATCH.cards.cd)')) === cdBefore ||
  (await evalJs('MATCH.cards.cd[0]')) <= JSON.parse(cdBefore)[0], 'a drag spent a card');

// The grip: same button, different corner, different meaning.
const gripAt = await evalJs(`(() => {
  const b = document.querySelector('#cardRow .card .grip'); if (!b) return null;
  const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 };
})()`);
check('every button grew a resize grip', !!gripAt);
if (gripAt) {
  const wBefore = moved.w;
  await dragBy(gripAt.x, gripAt.y, 34, 34);
  await sleep(250);
  const bigger = (await evalJs('__cards()'))[0];
  check('pulling the corner resizes it', bigger.w > wBefore + 8, `${wBefore.toFixed(0)}px → ${bigger.w.toFixed(0)}px`);
  check('and the face was repainted at the new size', /url\(/.test(bigger.art));
}
await shot('11-edited');

check('a saved layout is written to this device',
  (await evalJs(`!!localStorage.getItem('hs.padlayout.v1')`)) === true);

// The opacity preference — football's «שקיפות בקרות», the one control-feel setting here.
await evalJs(`(() => { const s = document.getElementById('editOpacity'); s.value = '0.35';
  s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(150);
check('the opacity slider dims the pad',
  Math.abs((await evalJs(`parseFloat(getComputedStyle(document.querySelector('.pad .jump')).opacity)`)) - 0.35) < 0.02,
  `jump opacity ${await evalJs(`getComputedStyle(document.querySelector('.pad .jump')).opacity`)}`);
await evalJs(`(() => { const s = document.getElementById('editOpacity'); s.value = '0.72';
  s.dispatchEvent(new Event('input', { bubbles: true })); })()`);

await evalJs(`document.getElementById('editDone').click()`);
await sleep(200);
check('closing edit mode leaves no key stuck down',
  (await evalJs(`Object.values(HELD).every(v => v === false)`)) === true);
check('and the button is still where it was dragged to',
  Math.abs((await evalJs('__cards()'))[0].x - moved.x) < 40);

// ── 5. It has to survive a reload, or it was never saved ─────────────────────
const savedX = (await evalJs('__cards()'))[0].x;
const savedS = (await evalJs('__cards()'))[0].size;
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&solo=1&play=1&stage=neon` });
await sleep(2800);
await evalJs(`
  window.__cards = () => [...document.querySelectorAll('#cardRow .card')].map((b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width,
             size: getComputedStyle(b).getPropertyValue('--s').trim(),
             art: getComputedStyle(b.querySelector('.card-art')).backgroundImage };
  });
  true;
`);
const reloaded = (await evalJs('__cards()'))[0];
check('the layout survives a reload', Math.abs(reloaded.x - savedX) < 25 && reloaded.size === savedS,
  `x ${savedX.toFixed(0)} → ${reloaded.x.toFixed(0)}, size ${savedS} → ${reloaded.size}`);
check('and the card is still painted after the reload', /url\(/.test(reloaded.art));
await shot('12-after-reload');

// CANCEL is the way back. A layout editor without one leaves dragging-it-home-by-eye as the
// only escape, which is how football's got its ביטול too.
const keepX = (await evalJs('__cards()'))[0].x;
await evalJs(`document.getElementById('gear').click(); document.getElementById('editCtlBtn').click();`);
await sleep(200);
const cCards = await evalJs('__cards()');
await dragBy(cCards[0].x, cCards[0].y, 90, -40);
await sleep(200);
const nudged = (await evalJs('__cards()'))[0].x;
check('(a drag moved it)', Math.abs(nudged - keepX) > 40, `${keepX.toFixed(0)} → ${nudged.toFixed(0)}`);
await evalJs(`document.getElementById('editCancel').click()`);
await sleep(250);
check('cancel puts the layout back where it was',
  Math.abs((await evalJs('__cards()'))[0].x - keepX) < 6,
  `${nudged.toFixed(0)} → ${(await evalJs('__cards()'))[0].x.toFixed(0)}, wanted ${keepX.toFixed(0)}`);
check('and leaves edit mode', (await evalJs(`document.getElementById('editBar').classList.contains('hidden')`)) === true);

// Reset puts it back where the designer left it.
await evalJs(`document.getElementById('gear').click(); document.getElementById('editCtlBtn').click();`);
await sleep(150);
await evalJs(`document.getElementById('editReset').click()`);
await sleep(250);
check('reset restores the authored layout',
  (await evalJs('__cards()'))[0].size === '1', (await evalJs('__cards()'))[0].size);
await evalJs(`document.getElementById('editDone').click()`);
await shot('13-reset');

// ── 6. The phone, which is what this is really for ───────────────────────────
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await sleep(900);
await evalJs(`
  window.__fit = () => {
    const row = document.getElementById('cardRow').getBoundingClientRect();
    const l = document.querySelector('.pad-l').getBoundingClientRect();
    const r = document.querySelector('.pad-r').getBoundingClientRect();
    return { rowW: row.width, gapL: row.left - l.right, gapR: r.left - row.right,
             inside: row.bottom <= innerHeight + 1 && row.top >= 0 };
  };
  true;
`);
const fit = await evalJs('__fit()');
check('on a phone the row sits inside the frame', fit.inside, JSON.stringify(fit));
check('and does not collide with either thumb', fit.gapL > 4 && fit.gapR > 4,
  `left gap ${fit.gapL.toFixed(0)}px, right gap ${fit.gapR.toFixed(0)}px`);
await shot('20-phone');

// ── 7. The album the app injects ─────────────────────────────────────────────
// Inside the app the player's own cards ARE the roster — window.SALTIZ_CARDS is injected
// before the page boots. The game ignored it until this was written, which let a player walk
// in with a legendary they do not own (and, since the hand landed, with its powers).
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.SALTIZ_CARDS = [{ r: 'rare', n: 7, c: 2, w: 40 }, { r: 'common', n: 12, c: 1, w: 5 }];`,
});
// No ?me= here, deliberately: this is the URL the APP loads (name + cache-bust only), so the
// opening card has to come from the album rather than from a query string.
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?diff=3&solo=1` });
await sleep(2600);
const album = await evalJs(`(() => {
  const tab = [...document.querySelectorAll('#rarityTabs button')].find((b) => b.dataset.r === 'rare');
  tab.click();
  const cards = [...document.querySelectorAll('#cardGrid .card')];
  return {
    rarity: pick.rarity, me: pick.me,
    lockedCount: cards.filter((c) => c.classList.contains('locked')).length,
    total: cards.length,
    sevenLocked: cards[6].classList.contains('locked'),
  };
})()`);
check('an injected album opens on the best card the player owns',
  album.me.rarity === 'rare' && album.me.number === 7, JSON.stringify(album.me));
check('and locks every card outside it',
  album.lockedCount === album.total - 1 && album.sevenLocked === false,
  `${album.lockedCount} of ${album.total} locked`);
// Clicking a locked card must do nothing at all — greying it out is not a guard.
await evalJs(`document.querySelectorAll('#cardGrid .card')[3].click()`);
await sleep(120);
check('and a locked card cannot be picked',
  (await evalJs('JSON.stringify(pick.me)')) === JSON.stringify({ rarity: 'rare', number: 7 }),
  await evalJs('JSON.stringify(pick.me)'));
// The opponent slot is not a claim of ownership, so it stays open.
await evalJs(`document.getElementById('slotFoe').click()`);
await sleep(150);
check('but the opponent slot is still free to choose',
  (await evalJs(`[...document.querySelectorAll('#cardGrid .card')].every((c) => !c.classList.contains('locked'))`)) === true);

// And the query string cannot walk past the album either — in a WebView that URL is one
// inspector away, so a picker-only guard is not a guard.
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_1&foe=${FOE}&diff=3&solo=1` });
await sleep(2500);
check('?me= cannot hand you a card you do not own',
  (await evalJs('JSON.stringify(pick.me)')) === JSON.stringify({ rarity: 'rare', number: 7 }),
  await evalJs('JSON.stringify(pick.me)'));

check('no page exceptions', logs.length === 0, logs.slice(0, 2).join(' | '));

console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_card-shots: ${fails.length} FAILED — ${fails.join('; ')}` : '_card-shots: all checks passed');
chrome.kill();
process.exit(fails.length ? 1 : 0);
