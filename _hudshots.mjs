// IS THE SCOREBOARD THE SHAPE IT IS SUPPOSED TO BE? Run: node _hudshots.mjs
//
// The HUD was rebuilt from a row of three black panels into a face-over-score board with the
// clock between them, and every requirement it was rebuilt against is a statement about
// PIXELS: the face is above the score and not beside it, the clock is nearer the faces than
// the scores, nothing is inside a black rectangle any more, the meters mirror. None of that
// is provable from the DOM alone — `grid-area: f0` proves nothing about where the browser
// put the box — so this drives the real client in a real browser and measures the boxes the
// layout actually produced, on five screens from a portrait phone to an iPad.
//
// THE TWO MEASUREMENTS THAT ARE NOT GEOMETRY:
//
//   THE BLACK PANELS. "Remove the black backgrounds" is a claim about painted pixels, and a
//   transparent element with a black stage behind it looks identical to a black element. So
//   the check is differential: the page is loaded on a stage whose sky is bright, and the
//   band the scoreboard and the meters live in must come back mostly NOT dark. A board still
//   in its boxes fails that no matter what the CSS says.
//
//   THE FACES. A portrait is right when it is THIS PLAYER'S CARD, so the background-image URL
//   is read off each circle and compared with MATCH.players[i].char — the card the sim is
//   actually playing — rather than with whatever the harness asked for. Then a card is swapped
//   mid-match and both are read again, which is the only way to prove the portrait tracks the
//   character instead of having been painted once at kickoff.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3020, CDP = 9484;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/hud`;
mkdirSync(OUT, { recursive: true });
await ensureServer(PORT);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  · ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  `--user-data-dir=${OUT}/prof`, 'about:blank',
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
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  }
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const shot = async (name, clip) => {
  const s = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

// ── THE PROBE ────────────────────────────────────────────────────────────────
// Every box read in one pass, in stage coordinates, from the page's own layout. Reading them
// one at a time over CDP let the clock tick between two reads, which is how "the score moved"
// gets reported for a board that never moved.
const PROBE = `window.__hud = () => {
  const st = document.getElementById('stage').getBoundingClientRect();
  const box = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height,
             cx: r.left - st.left + r.width / 2, cy: r.top - st.top + r.height / 2,
             right: r.right - st.left, bottom: r.bottom - st.top,
             // The LAYOUT box, which a transform cannot move. The clock pulses under ten
             // seconds, and a painted box that grew by a scale() is not a layout shift.
             lay: { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight } };
  };
  const bg = (sel) => getComputedStyle(document.querySelector(sel)).backgroundImage;
  const el = (sel) => document.querySelector(sel);
  return {
    stage: { w: st.width, h: st.height },
    face0: box('#face0'), face1: box('#face1'),
    s0: box('#s0'), s1: box('#s1'), clock: box('#clock'),
    board: box('.scoreboard'),
    g0: box('.gauge.g0'), g1: box('.gauge.g1'),
    m0: box('.meter.m0'), m1: box('.meter.m1'),
    quit: box('#quit'), gear: box('#gear'), snd: box('#sndBtn'),
    padTop: Math.min(...[...document.querySelectorAll('.pad .btn')].map((b) => b.getBoundingClientRect().top - st.top)),
    art0: bg('#face0 > i'), art1: bg('#face1 > i'),
    clockText: el('#clock').textContent,
    s0Text: el('#s0').textContent, s1Text: el('#s1').textContent,
    fill0: getComputedStyle(el('.gauge.g0 .fill')).clipPath,
    fill1: getComputedStyle(el('.gauge.g1 .fill')).clipPath,
    tx0: getComputedStyle(el('.gauge.g0 .fill')).transform,
    tx1: getComputedStyle(el('.gauge.g1 .fill')).transform,
    // Opacity of the paint an element puts down itself, panel by panel. A scoreboard that is
    // "transparent" has to be transparent HERE, not merely over a dark stage.
    alpha: ['.scoreboard', '.gauge.g0', '.gauge.g1', '.meter.m0', '.meter.m1']
      .map((s) => [s, getComputedStyle(document.querySelector(s)).backgroundColor])
      .concat([['.gauge.g0::before', getComputedStyle(document.querySelector('.gauge.g0'), '::before').backgroundColor]]),
    scrolls: document.body.scrollWidth > innerWidth + 1 || document.body.scrollHeight > innerHeight + 1,
  };
};
// How dark is the band the HUD lives in? Sampled off the PITCH canvas, which is what is
// behind the HUD — anything the HUD paints opaquely lands on top of it in the screenshot, so
// the comparison that matters is made from the screenshot and this only supplies the baseline.
window.__cardOf = (i) => MATCH.players[i].char.rarity + '/' + MATCH.players[i].char.number;`;

const DEVICES = [
  ['desktop',    1000, 620, 1],
  ['wide',       1440, 800, 1],
  ['se-land',     667, 375, 1],
  ['ip13-land',   844, 390, 1],
  ['ip13-port',   390, 844, 1],
];

await send('Page.enable');
await send('Runtime.enable');

for (const [name, w, h, dpr] of DEVICES) {
  console.log(`\n${name}  ${w}x${h}`);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: h < 500 || w < 500 });
  // A BRIGHT stage on purpose: the "no black panels" check below is a difference between what the
  // scoreboard band looks like and what the sky behind it looks like, and a night stage
  // cannot tell a transparent HUD from an opaque one.
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&solo=1&play=1&me=legendary_3&foe=epic_7` });
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break;
  }
  await evalJs(`window.BOT_OFF = true; ${PROBE}`);
  // A settled clock: 0:47 rather than whatever the kickoff freeze left on it.
  await evalJs('MATCH.clock = 47.4; MATCH.score = [2, 1];');
  await sleep(260);
  await shot(`${name}`);
  const d = await evalJs('JSON.stringify(__hud())').then(JSON.parse);

  // Crop of the HUD band, blown up, so a human can judge what the numbers claim.
  await shot(`${name}-band`, { x: 0, y: 0, width: w, height: Math.round(Math.min(h, d.board.bottom + 24)), scale: 2 });

  // ── 1. THE SHAPE ───────────────────────────────────────────────────────────
  // ABOVE, not beside. Both parts are asserted: the face's whole box is over the score's
  // whole box (no vertical overlap), and their centres share a column.
  for (const i of [0, 1]) {
    const f = d[`face${i}`], s = d[`s${i}`];
    ok(`p${i}: the portrait is ABOVE its score, not beside it`, f.bottom <= s.y + 0.5,
       `face ends ${f.bottom.toFixed(0)}, score starts ${s.y.toFixed(0)}`);
    ok(`p${i}: the portrait is centred over its score`, Math.abs(f.cx - s.cx) <= 1.5,
       `${f.cx.toFixed(1)} vs ${s.cx.toFixed(1)}`);
  }
  ok('player 0 is on the left of the board', d.face0.cx < d.face1.cx && d.s0.cx < d.s1.cx,
     `faces ${d.face0.cx.toFixed(0)}/${d.face1.cx.toFixed(0)}`);

  // ── 2. THE CLOCK ───────────────────────────────────────────────────────────
  const mid = d.stage.w / 2;
  ok('the clock is horizontally centred in the HUD', Math.abs(d.clock.cx - mid) <= 1.5,
     `${d.clock.cx.toFixed(1)} vs stage middle ${mid.toFixed(1)}`);
  ok('the clock is between the two portraits',
     d.clock.x > d.face0.right && d.clock.right < d.face1.x,
     `${d.face0.right.toFixed(0)} < ${d.clock.x.toFixed(0)}..${d.clock.right.toFixed(0)} < ${d.face1.x.toFixed(0)}`);
  ok('the clock sits ABOVE the score baseline', d.clock.bottom <= d.s0.y + 0.5,
     `clock ends ${d.clock.bottom.toFixed(0)}, scores start ${d.s0.y.toFixed(0)}`);
  ok('the clock is not on the scores\' baseline', Math.abs(d.clock.cy - d.s0.cy) > d.clock.h * 0.5,
     `clock ${d.clock.cy.toFixed(0)} vs scores ${d.s0.cy.toFixed(0)}`);
  {
    const toFace = Math.abs(d.clock.cy - d.face0.cy), toScore = Math.abs(d.clock.cy - d.s0.cy);
    ok('the clock is nearer the portraits than the scores', toFace < toScore,
       `${toFace.toFixed(0)}px to the faces, ${toScore.toFixed(0)}px to the scores`);
  }
  ok('the clock reads as a football clock', /^\d:[0-5]\d$/.test(d.clockText), d.clockText);

  // ── 3. SYMMETRY ────────────────────────────────────────────────────────────
  ok('the board is centred on the stage', Math.abs(d.board.cx - mid) <= 1.5, `${d.board.cx.toFixed(1)} vs ${mid.toFixed(1)}`);
  ok('the two halves are mirror images',
     Math.abs((d.clock.cx - d.face0.cx) - (d.face1.cx - d.clock.cx)) <= 1.5
     && Math.abs(d.face0.w - d.face1.w) <= 0.5 && Math.abs(d.s0.h - d.s1.h) <= 0.5);
  ok('the scores are on one baseline', Math.abs(d.s0.y - d.s1.y) <= 0.5);

  // ── 4. THE PORTRAITS ARE THE CARDS ─────────────────────────────────────────
  const cards = await evalJs('JSON.stringify([__cardOf(0), __cardOf(1)])').then(JSON.parse);
  ok('portrait 0 is player 0\'s card', d.art0.includes(`/${cards[0]}.webp`), `${cards[0]} vs ${d.art0.slice(-34)}`);
  ok('portrait 1 is player 1\'s card', d.art1.includes(`/${cards[1]}.webp`), `${cards[1]} vs ${d.art1.slice(-34)}`);
  ok('the portraits are circles', await evalJs(`getComputedStyle(document.getElementById('face0')).borderRadius`) === '50%');
  ok('the portraits are flag-sized, not head-sized', d.face0.w >= 28 && d.face0.w <= 56, `${d.face0.w.toFixed(0)}px`);

  // ── 5. THE METERS ──────────────────────────────────────────────────────────
  ok('player 0\'s meter is on player 0\'s side', d.g0.cx < mid && d.g1.cx > mid);
  ok('the meters are mirrored', d.tx0 === 'none' && /matrix\(-1/.test(d.tx1), `${d.tx0} / ${d.tx1}`);
  ok('the meters clear the scoreboard', d.g0.right <= d.board.x + 0.5 && d.g1.x >= d.board.right - 0.5,
     `${d.g0.right.toFixed(0)} | board ${d.board.x.toFixed(0)}..${d.board.right.toFixed(0)} | ${d.g1.x.toFixed(0)}`);
  ok('the meters clear the pitch furniture below', d.g0.bottom < d.quit.y && d.g1.bottom < d.gear.y,
     `meters end ${d.g0.bottom.toFixed(0)}, buttons start ${d.quit.y.toFixed(0)}`);

  // ── 6. NOTHING IS IN A BOX ─────────────────────────────────────────────────
  for (const [sel, col] of d.alpha) {
    const a = /rgba?\(([^)]+)\)/.exec(col);
    const parts = a ? a[1].split(',').map(Number) : [0, 0, 0, 0];
    const alpha = parts.length > 3 ? parts[3] : (col === 'rgba(0, 0, 0, 0)' ? 0 : 1);
    ok(`${sel} is not an opaque panel`, alpha <= 0.45, col);
  }

  // ── 7. IT FITS ─────────────────────────────────────────────────────────────
  ok('nothing in the HUD overflows the stage',
     [d.board, d.m0, d.m1, d.clock, d.s0, d.s1, d.face0, d.face1]
       .every((b) => b.x >= -0.5 && b.right <= d.stage.w + 0.5 && b.y >= -0.5),
     JSON.stringify({ board: [d.board.x.toFixed(0), d.board.right.toFixed(0)], stage: d.stage.w }));
  ok('the page does not scroll', d.scrolls === false);
  ok('the board clears the controls', d.board.bottom < d.padTop, `${d.board.bottom.toFixed(0)} vs ${d.padTop.toFixed(0)}`);
  ok('the ⚙ / 🔊 / ✕ buttons are still there and clear of the board',
     d.gear && d.snd && d.quit && d.quit.right < d.board.x && d.gear.x > d.board.right,
     `quit ends ${d.quit.right.toFixed(0)}, board ${d.board.x.toFixed(0)}..${d.board.right.toFixed(0)}, gear starts ${d.gear.x.toFixed(0)}`);

  // ── 8. NOTHING MOVES WHEN THE NUMBERS DO ───────────────────────────────────
  // The scoreboard is the one thing on screen that changes value while you are looking at
  // it. Every box is re-read after a goal, a two-digit scoreline, a minute rollover and a
  // character swap; the boxes have to be where they were.
  const before = { board: d.board, face0: d.face0, face1: d.face1, s0: d.s0, s1: d.s1, clock: d.clock };
  await evalJs('MATCH.score = [10, 9]; MATCH.clock = 8.2;');
  await sleep(200);
  const after = await evalJs('JSON.stringify(__hud())').then(JSON.parse);
  const moved = Object.entries(before)
    .filter(([k, b]) => Math.abs(b.lay.x - after[k].lay.x) > 1 || Math.abs(b.lay.y - after[k].lay.y) > 1
                     || Math.abs(b.lay.h - after[k].lay.h) > 1)
    .map(([k]) => k);
  ok('a goal and a minute rollover move nothing', moved.length === 0, moved.join(', '));
  ok('two-digit scores still fit inside the board',
     after.s0.x >= after.board.x - 0.5 && after.s1.right <= after.board.right + 0.5,
     `${after.s0.x.toFixed(0)}..${after.s1.right.toFixed(0)} in ${after.board.x.toFixed(0)}..${after.board.right.toFixed(0)}`);
  ok('under ten seconds the clock goes red', await evalJs(`document.getElementById('clock').classList.contains('low')`) === true,
     after.clockText);
  ok('and it still reads M:SS', /^0:0[0-9]$/.test(after.clockText), after.clockText);

  // ── 9. THE PORTRAIT FOLLOWS THE CHARACTER ──────────────────────────────────
  await evalJs(`MATCH.players[1].char = { rarity: 'common', number: 12 };`);
  await sleep(200);
  const swapped = await evalJs('JSON.stringify(__hud())').then(JSON.parse);
  ok('swapping a character repaints that portrait', swapped.art1.includes('/common/12.webp'), swapped.art1.slice(-34));
  ok('and leaves the other one alone', swapped.art0 === d.art0);
  ok('and does not resize the board', Math.abs(swapped.board.w - d.board.w) < 0.5 && Math.abs(swapped.face1.w - d.face1.w) < 0.5);

  // ── 10. THE CARD CALL-OUTS STILL CLEAR IT ──────────────────────────────────
  // They announce under the scoreboard, and the scoreboard got two rows taller — a call-out
  // pinned at the old fixed 74px ran straight through the scores on anything but a phone.
  await evalJs(`callout({ player: 0, name: 'בדיקה', label: 'מגנט', color: '#4ea0ff' });`);
  await sleep(120);
  const co = await evalJs(`(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    const r = document.querySelector('.callout').getBoundingClientRect();
    return JSON.stringify({ top: r.top - st.top });
  })()`).then(JSON.parse);
  ok('a card call-out lands below the scoreboard', co.top >= d.board.bottom - 0.5,
     `callout at ${co.top.toFixed(0)}, board ends ${d.board.bottom.toFixed(0)}`);

  // ── 11. THE FILL STILL FILLS ───────────────────────────────────────────────
  await evalJs('MATCH.players[0].gauge = 0.25; MATCH.players[1].gauge = 0.85;');
  await sleep(200);
  const p = await evalJs(`JSON.stringify([0,1].map(i => document.querySelector('.gauge.g'+i).style.getPropertyValue('--p')))`).then(JSON.parse);
  ok('the meters read the gauge', parseFloat(p[0]) > 20 && parseFloat(p[0]) < 30 && parseFloat(p[1]) > 80,
     p.join(' / '));
  await evalJs('MATCH.players[0].gauge = 1;');
  await sleep(200);
  ok('a full gauge still lights up', await evalJs(`document.querySelector('.gauge.g0').classList.contains('full')`) === true);
  await shot(`${name}-full`);

  // Restore, so the next device starts from a clean board.
  await evalJs('MATCH.players[0].gauge = 0.25; MATCH.score = [2, 1]; MATCH.clock = 47.4;');
}

// ── 12. THE BLACK PANELS ARE GONE ────────────────────────────────────────────
// The one check that has to be made from PIXELS, because "the background is transparent" and
// "the background is the same colour as what is behind it" are the same CSS from the outside.
//
// So: a screenshot, on a stage with a BRIGHT sky, handed back to the page — a browser has a
// PNG decoder and node does not — and the fraction of very dark pixels counted in three
// boxes. The old HUD put an opaque #101018 board and two #0d0d18 tanks up there and would
// have come back near-solid in the first two; a transparent one has to track the open sky
// just below it.
console.log('\npanels');
await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 620, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&solo=1&play=1&me=legendary_3&foe=epic_7` });
for (let i = 0; i < 60; i++) {
  await sleep(200);
  if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break;
}
await evalJs(`window.BOT_OFF = true; ${PROBE}
  window.__darkIn = (url, x, y, w, h) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
      const g = c.getContext('2d');
      g.drawImage(img, Math.round(x), Math.round(y), c.width, c.height, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0, dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        n++;
        if (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 62) dark++;
      }
      res(dark / n);
    };
    img.onerror = () => res(-1);
    img.src = url;
  });`);
await evalJs('MATCH.clock = 47.4; MATCH.score = [2, 1]; MATCH.players[0].gauge = 0.55; MATCH.players[1].gauge = 0.3;');
await sleep(500);
const b = await evalJs('JSON.stringify(__hud())').then(JSON.parse);

// THE DIFFERENTIAL. The same two boxes, shot twice: once with the HUD on the screen and once
// with it taken off. If the board and the meters are transparent the stage behind them comes
// through both times and the dark count barely moves; the old opaque #101018 board and
// #0d0d18 tanks would have driven their own boxes to solid on the first shot alone.
const darkIn = async (url, box) => evalJs(`__darkIn(${JSON.stringify(url)}, ${box.x}, ${box.y}, ${box.w}, ${box.h})`);
const frame = async (label) => {
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/panels-${label}.png`, Buffer.from(png.data, 'base64'));
  const url = `data:image/png;base64,${png.data}`;
  return { board: await darkIn(url, b.board), meter: await darkIn(url, b.m0) };
};
const withHud = await frame('with-hud');
await evalJs(`document.querySelector('.hud').style.visibility = 'hidden';`);
await sleep(300);
const bare = await frame('bare-stage');
await evalJs(`document.querySelector('.hud').style.visibility = '';`);

console.log(`  · dark pixels — board ${(withHud.board * 100).toFixed(0)}% with the HUD, ${(bare.board * 100).toFixed(0)}% without`
  + `; meter ${(withHud.meter * 100).toFixed(0)}% / ${(bare.meter * 100).toFixed(0)}%`);
ok('the samples decoded at all', withHud.board >= 0 && bare.board >= 0 && withHud.meter >= 0 && bare.meter >= 0);
// The lettering is allowed to add some: the scores and the clock carry a fat black keyline,
// which is the thing that replaced the box. A PANEL would add most of its box.
ok('the scoreboard does not black out what is behind it', withHud.board - bare.board < 0.25,
   `+${((withHud.board - bare.board) * 100).toFixed(0)} points of dark`);
ok('neither does the power meter', withHud.meter - bare.meter < 0.2,
   `+${((withHud.meter - bare.meter) * 100).toFixed(0)} points of dark`);
ok('and the stage is genuinely visible up there', withHud.board < 0.45 && withHud.meter < 0.4,
   `board ${(withHud.board * 100).toFixed(0)}%, meter ${(withHud.meter * 100).toFixed(0)}% dark`);

// And nothing inside the HUD paints an opaque rectangle of its own. The pixel check above is
// the claim; this is the mechanism, and it is the one that will fail first if a panel ever
// creeps back in behind something that happens to be bright that day.
const panels = await evalJs(`JSON.stringify([...document.querySelectorAll('.hud, .hud *')]
  // The meter fill and the two portraits are CONTENT — a power bar you cannot see is not a
  // power bar, and a card is an opaque photograph. Everything else in here is furniture.
  .filter((e) => !e.matches('.fill, .face, .face > i'))
  .map((e) => {
    const cs = getComputedStyle(e);
    const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
    const parts = m ? m[1].split(',').map(Number) : [0, 0, 0, 0];
    const a = parts.length > 3 ? parts[3] : 1;
    return { sel: e.className || e.tagName, a, bg: cs.backgroundColor, img: cs.backgroundImage };
  })
  .filter((r) => r.a > 0.45 || r.img !== 'none'))`).then(JSON.parse);
ok('no element in the HUD is an opaque panel', panels.length === 0,
   panels.map((r) => `${r.sel}: ${r.bg} ${r.img}`).join(' | '));

console.log(`\nhud shots: ${pass} passed, ${fail} failed  → ${OUT}`);
if (logs.length) console.log('page errors:\n  ' + logs.join('\n  '));
ws.close();
chrome.kill();
if (fail || logs.length) process.exit(1);
