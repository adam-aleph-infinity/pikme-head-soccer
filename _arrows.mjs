// THE WALK ARROWS: can you turn round without lifting your thumb? Run: node _arrows.mjs
//
// Three claims, none of which the unit tests can reach — two are about what a real finger
// does to a real DOM, and one is about pixels.
//
//   1. SLIDING. Holding ▶ and dragging the same finger onto ◀ has to become "left" at the
//      moment the finger crosses, with no lift in between. The pointer is CAPTURED on the
//      button it started on (that is what stops a drifting thumb from dropping a direction),
//      so this is the one interaction where the capture has to be argued with rather than
//      trusted. Driven with real CDP touch events, not by poking the input object.
//   2. THE HIT AREA. Bigger than the artwork on three sides, and — the other half of the
//      requirement, and the easier one to get wrong — still not overlapping the other arrow.
//      A thumb that lands between them must pick NEITHER.
//   3. THE OUTLINE. Every visible edge of the gold has brown around it. Measured as a
//      dilation: over a flat magenta backdrop, no gold pixel may have a background pixel
//      within three pixels of it, in any direction. The old build failed that at the two
//      step edges either side of the arrowhead, where the outline was half a pixel thick,
//      and the canary at the end of this file re-breaks it on purpose to prove the detector
//      is not vacuous.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3020, CDP = 9487;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/arrows`;
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
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

// REAL touch events, through the browser's own pointer-event plumbing — the whole question
// here is what capture does to a drag, and an injected `held.left = true` answers none of it.
const touch = (type, points) => send('Input.dispatchTouchEvent', {
  type, touchPoints: points.map(([x, y], i) => ({ x: Math.round(x), y: Math.round(y), id: i + 1 })),
});
const KEYCODE = { ArrowLeft: 37, ArrowRight: 39 };
const key = (type, code) => send('Input.dispatchKeyEvent', {
  type, code, key: code, windowsVirtualKeyCode: KEYCODE[code], nativeVirtualKeyCode: KEYCODE[code],
});
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', {
  type, x: Math.round(x), y: Math.round(y), button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1,
});
const walk = async () => evalJs('JSON.stringify({ left: HELD.left, right: HELD.right })').then(JSON.parse);
const dir = (w) => (w.left && w.right ? 'both' : w.left ? 'left' : w.right ? 'right' : 'none');

await send('Page.enable');
await send('Runtime.enable');
// A landscape phone, the screen this pad was drawn for and the smallest one it ships on.
await send('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=harbor&solo=1&play=1&me=legendary_3&foe=epic_7` });
for (let i = 0; i < 60; i++) {
  await sleep(200);
  if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break;
}
await evalJs('C.tune({ SPECTACLE_ON: 0, PICKUPS_ON: 0 }); window.BOT_OFF = true;');
await sleep(300);
await shot('01-pad');

// ── THE BOXES ────────────────────────────────────────────────────────────────
// The HIT box is the button's border box; the ART box is the pseudo-elements the arrow is
// painted into, which is inset from it by the hit margin. Both are read from the page.
const geo = await evalJs(`(() => {
  const out = {};
  for (const b of document.querySelectorAll('.pad-l .btn')) {
    const r = b.getBoundingClientRect();
    // The margin is read off the LAYER the arrow is painted into, not off the --hx/--hy that
    // sized it: an unregistered custom property comes back as the calc() that was written,
    // and the question here is where the artwork actually landed.
    const cs = getComputedStyle(b, '::before');
    const hy = parseFloat(cs.top);
    const hx = Math.max(parseFloat(cs.left) || 0, parseFloat(cs.right) || 0);
    const left = b.dataset.k === 'left';
    out[b.dataset.k] = {
      hit: { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
      art: { x: r.left + (left ? hx : 0), y: r.top + hy,
             w: r.width - hx, h: r.height - 2 * hy,
             right: r.right - (left ? 0 : hx), bottom: r.bottom - hy },
      hx, hy,
    };
  }
  out.pitch = { w: innerWidth, h: innerHeight };
  return JSON.stringify(out);
})()`).then(JSON.parse);
const L = geo.left, R = geo.right;
const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];

// ── 1. THE HIT AREA IS BIGGER THAN THE ARROW ─────────────────────────────────
console.log('\nthe hit area');
ok('the target reaches past the artwork', L.hx > 4 && L.hy > 4, `${L.hx.toFixed(1)}px out, ${L.hy.toFixed(1)}px up and down`);
for (const [k, b] of [['left', L], ['right', R]]) {
  ok(`${k}: the hit box contains the whole arrow`,
     b.hit.x <= b.art.x + 0.5 && b.hit.y <= b.art.y + 0.5
     && b.hit.right >= b.art.right - 0.5 && b.hit.bottom >= b.art.bottom - 0.5);
  ok(`${k}: and is bigger than it`, b.hit.w > b.art.w + 3 && b.hit.h > b.art.h + 8,
     `hit ${b.hit.w.toFixed(0)}x${b.hit.h.toFixed(0)} vs art ${b.art.w.toFixed(0)}x${b.art.h.toFixed(0)}`);
  ok(`${k}: still a real touch target`, Math.min(b.hit.w, b.hit.h) >= 44, `${Math.min(b.hit.w, b.hit.h).toFixed(0)}px`);
}
// The other half of "bigger", and the half that makes a bigger target safe.
const gap = R.hit.x - L.hit.right;
ok('the two hit boxes do not overlap', gap > 0, `${gap.toFixed(1)}px between them`);
ok('and the gap between them is wide enough to mean something', gap >= 6, `${gap.toFixed(1)}px`);
ok('the arrows did not move apart to get it',
   Math.abs((R.art.x - L.art.right) - gap) < L.hx * 2 + 1,
   `art gap ${(R.art.x - L.art.right).toFixed(1)}px, hit gap ${gap.toFixed(1)}px`);

// A press in the margin — beside, above and below each arrow — must still walk.
const beside = {
  'left, outside edge':  [L.hit.x + 2, L.art.y + L.art.h / 2],
  'left, below':         [L.art.x + L.art.w / 2, L.hit.bottom - 2],
  'left, above':         [L.art.x + L.art.w / 2, L.hit.y + 2],
  'right, outside edge': [R.hit.right - 2, R.art.y + R.art.h / 2],
  'right, below':        [R.art.x + R.art.w / 2, R.hit.bottom - 2],
  'right, above':        [R.art.x + R.art.w / 2, R.hit.y + 2],
};
for (const [name, pt] of Object.entries(beside)) {
  await touch('touchStart', [pt]);
  await sleep(60);
  const w = await walk();
  await touch('touchEnd', []);
  await sleep(60);
  ok(`pressing ${name} still walks`, dir(w) === name.split(',')[0], dir(w));
}
// …and the boundary between them is sharp. (Not "the midline picks neither": Chrome does
// touch adjustment on a tap and snaps an ambiguous one to the nearer target, which is the
// browser being helpful and is also what a real phone does. What must never happen is a
// press on one arrow's own side of the gap coming out as the other direction.)
for (const [name, pt, want] of [
  ['just inside ◀', [L.hit.right - 1, L.art.y + L.art.h / 2], 'left'],
  ['just inside ▶', [R.hit.x + 1, R.art.y + R.art.h / 2], 'right'],
]) {
  await touch('touchStart', [pt]);
  await sleep(60);
  const w = await walk();
  await touch('touchEnd', []);
  await sleep(60);
  ok(`a press ${name} is unambiguous`, dir(w) === want, dir(w));
}

// ── 2. SLIDING ───────────────────────────────────────────────────────────────
console.log('\nsliding');
{
  await touch('touchStart', [mid(R.art)]);
  await sleep(70);
  ok('holding ▶ walks right', dir(await walk()) === 'right');
  await shot('02-holding-right');

  // The same finger, never lifted, dragged across the gap onto the other arrow.
  for (const x of [R.art.x + R.art.w * 0.2, (L.art.right + R.art.x) / 2, L.art.right - 4, ...[0.6, 0.4].map((f) => L.art.x + L.art.w * f)]) {
    await touch('touchMove', [[x, mid(R.art)[1]]]);
    await sleep(30);
  }
  await sleep(60);
  ok('sliding that finger onto ◀ switches to left, with no lift', dir(await walk()) === 'left', dir(await walk()));
  // The lit state is the only feedback the player gets that the game heard the slide, so it
  // has to move with the direction rather than stay on the button the press started on.
  const lit = await evalJs(`JSON.stringify([...document.querySelectorAll('.pad-l .btn')]
    .filter((b) => b.classList.contains('on')).map((b) => b.dataset.k))`).then(JSON.parse);
  ok('and the arrow that lights up moves with it', lit.length === 1 && lit[0] === 'left', lit.join(',') || 'neither');
  await shot('03-slid-to-left');

  // …and back again, which is the same journey with the roles swapped.
  for (const x of [L.art.right - 4, (L.art.right + R.art.x) / 2, R.art.x + 4, mid(R.art)[0]]) {
    await touch('touchMove', [[x, mid(R.art)[1]]]);
    await sleep(30);
  }
  await sleep(60);
  ok('sliding back onto ▶ switches to right', dir(await walk()) === 'right', dir(await walk()));

  // Off both of them entirely: that is a thumb that has wandered onto the pitch.
  await touch('touchMove', [[geo.pitch.w * 0.5, geo.pitch.h * 0.35]]);
  await sleep(80);
  ok('dragging off both arrows stops the walk', dir(await walk()) === 'none', dir(await walk()));
  // Back on, without ever having lifted.
  await touch('touchMove', [mid(L.art)]);
  await sleep(80);
  ok('dragging back on picks it up again', dir(await walk()) === 'left', dir(await walk()));
  await touch('touchEnd', []);
  await sleep(80);
  ok('lifting stops the walk', dir(await walk()) === 'none', dir(await walk()));
}
// The mirror journey, started on the other arrow.
{
  await touch('touchStart', [mid(L.art)]);
  await sleep(70);
  ok('holding ◀ walks left', dir(await walk()) === 'left');
  for (const x of [L.art.right - 4, (L.art.right + R.art.x) / 2, R.art.x + 4, mid(R.art)[0]]) {
    await touch('touchMove', [[x, mid(L.art)[1]]]);
    await sleep(30);
  }
  await sleep(60);
  ok('sliding it onto ▶ switches to right, with no lift', dir(await walk()) === 'right', dir(await walk()));
  await touch('touchEnd', []);
  await sleep(70);
  ok('and lifting stops it', dir(await walk()) === 'none', dir(await walk()));
}

// ── 3. NOTHING GETS STUCK ────────────────────────────────────────────────────
console.log('\nnothing gets stuck');
{
  await touch('touchStart', [mid(R.art)]);
  await sleep(70);
  await touch('touchCancel', []);
  await sleep(90);
  ok('a cancelled touch releases the walk', dir(await walk()) === 'none', dir(await walk()));
}
{
  // Slid onto the other arrow and THEN cancelled — the direction it ends up holding is not
  // the button it was captured by, which is exactly where a release can go missing.
  await touch('touchStart', [mid(R.art)]);
  await sleep(60);
  await touch('touchMove', [mid(L.art)]);
  await sleep(80);
  await touch('touchCancel', []);
  await sleep(90);
  ok('cancelling after a slide releases the NEW direction', dir(await walk()) === 'none', dir(await walk()));
}
{
  await touch('touchStart', [mid(L.art)]);
  await sleep(60);
  await evalJs('dispatchEvent(new Event("blur"))');
  await sleep(80);
  ok('losing focus releases the walk', dir(await walk()) === 'none', dir(await walk()));
  await touch('touchEnd', []);
  await sleep(60);
}
{
  // Two thumbs. Only the one that lifts should stop; the other keeps its own direction.
  await touch('touchStart', [mid(L.art)]);
  await sleep(50);
  await touch('touchStart', [mid(L.art), mid(R.art)]);
  await sleep(70);
  const both = await walk();
  ok('two fingers hold two directions', both.left === true && both.right === true, dir(both));
  // Lift ONE of them. Which one CDP ends for a partial touchEnd is not worth pinning down;
  // what this is testing is that a lift is per-finger at all, so the assertion is that
  // exactly one direction survives it.
  await touch('touchEnd', [mid(L.art)]);
  await sleep(80);
  const one = await walk();
  ok('lifting one finger leaves the other holding', one.left !== one.right, dir(one));
  await touch('touchEnd', []);
  await sleep(80);
  ok('and lifting the last one stops everything', dir(await walk()) === 'none', dir(await walk()));
}

// ── 4. THE OLD WAYS IN STILL WORK ────────────────────────────────────────────
console.log('\nkeyboard and mouse');
{
  await key('keyDown', 'ArrowRight');
  await sleep(60);
  ok('the → key still walks right', dir(await walk()) === 'right', dir(await walk()));
  await key('keyUp', 'ArrowRight');
  await sleep(60);
  ok('and releasing it stops', dir(await walk()) === 'none', dir(await walk()));
  await key('keyDown', 'ArrowLeft');
  await sleep(60);
  ok('the ← key still walks left', dir(await walk()) === 'left', dir(await walk()));
  await key('keyUp', 'ArrowLeft');
  await sleep(60);
}
{
  const [x, y] = mid(R.art);
  await mouse('mousePressed', x, y);
  await sleep(70);
  ok('a mouse press on ▶ walks right', dir(await walk()) === 'right', dir(await walk()));
  // A mouse can drag between them too, and desktop is where this gets argued about.
  const [lx, ly] = mid(L.art);
  await mouse('mouseMoved', (x + lx) / 2, y);
  await mouse('mouseMoved', lx, ly);
  await sleep(80);
  ok('and dragging it onto ◀ switches to left', dir(await walk()) === 'left', dir(await walk()));
  await mouse('mouseReleased', lx, ly);
  await sleep(70);
  ok('releasing the mouse stops the walk', dir(await walk()) === 'none', dir(await walk()));
}

// ── 5. THE OUTLINE ───────────────────────────────────────────────────────────
// A DILATION, over a backdrop nothing in the artwork is near: no gold pixel may have a
// background pixel within three of it, in any of eight directions. That is what "the brown
// goes all the way round" means in pixels, and it is a claim about the whole silhouette
// rather than about the edges someone thought to look at.
console.log('\nthe outline');
await evalJs(`(() => {
  for (const id of ['cv', 'cvnet']) document.getElementById(id).style.visibility = 'hidden';
  for (const sel of ['.hud', '.pad-c', '.pad-r', '#quit', '#gear', '#sndBtn']) {
    const e = document.querySelector(sel); if (e) e.style.visibility = 'hidden';
  }
  for (const i of [0, 1]) document.getElementById('head' + i).style.visibility = 'hidden';
  // A backdrop nothing in the artwork is near, so the three colour classes below cannot be
  // confused. !important, because applyBars() paints the stage's letterbox as an INLINE
  // background and an inline style beats an ordinary rule — the first version of this quietly
  // left the pitch behind the arrows, which made the whole check vacuous.
  const st = document.createElement('style');
  st.textContent = '#stage{background:#ff00ff !important}';
  document.head.appendChild(st);
  document.getElementById('pad').style.setProperty('--ctl-op', '1');
  window.__ring = (url, box, d) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(box.w); c.height = Math.round(box.h);
      const g = c.getContext('2d');
      g.drawImage(img, Math.round(box.x), Math.round(box.y), c.width, c.height, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const at = (x, y) => { const i = (y * c.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
      // Three classes, each deliberately strict so an antialiased edge pixel is none of them.
      const gold = ([r, gg, b]) => r > 200 && gg > 120 && b < 120 && r - b > 90;
      const back = ([r, gg, b]) => r > 180 && b > 180 && gg < 90;
      let goldN = 0, backN = 0, bad = 0; const where = [];
      for (let i = 0; i < px.length; i += 4) if (back([px[i], px[i + 1], px[i + 2]])) backN++;
      const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (!gold(at(x, y))) continue;
        goldN++;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx * d, ny = y + dy * d;
          if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue;
          if (back(at(nx, ny))) { bad++; if (where.length < 8) where.push(x + ',' + y); break; }
        }
      }
      res(JSON.stringify({ goldN, backN, bad, where }));
    };
    img.onerror = () => res(JSON.stringify({ goldN: 0, bad: -1, where: [] }));
    img.src = url;
  });
})()`);
await sleep(300);
await shot('04-outline');

const ringOf = async (label) => {
  const png = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/outline-${label}.png`, Buffer.from(png.data, 'base64'));
  const url = `data:image/png;base64,${png.data}`;
  const out = {};
  for (const [k, b] of [['left', L], ['right', R]]) {
    const pad = 10;
    const box = { x: b.art.x - pad, y: b.art.y - pad, w: b.art.w + pad * 2, h: b.art.h + pad * 2 };
    out[k] = await evalJs(`__ring(${JSON.stringify(url)}, ${JSON.stringify(box)}, 3)`).then(JSON.parse);
  }
  return out;
};
const ring = await ringOf('now');
for (const k of ['left', 'right']) {
  ok(`${k}: the gold rendered at all`, ring[k].goldN > 400, `${ring[k].goldN} gold pixels`);
  // Without backdrop in the frame there is nothing for the gold to be touching, and the
  // check below would pass on anything at all.
  ok(`${k}: and the backdrop is in the sample`, ring[k].backN > 400, `${ring[k].backN} backdrop pixels`);
  ok(`${k}: the brown outline is unbroken all the way round`, ring[k].bad === 0,
     ring[k].bad === 0 ? `${ring[k].goldN} gold pixels, none within 3px of the backdrop`
                       : `${ring[k].bad} gold pixels sit on the edge — e.g. ${ring[k].where.join(' ')}`);
}

// THE CANARIES. A check that nothing can fail is not a check, so the arrow is re-broken two
// ways and the detector has to catch both.
//
// FIRST, the actual historical bug: the gold polygon the OLD build produced. It applied the
// same percentage polygon to a box inset by i on every side, which puts vertex (px, py) at
// (i + px(w−2i), i + py(h−2i)) — so with i = 0.075h and w = 1.08h the notch edges at 46%
// land at 46.56%, half a pixel PAST the brown instead of five inside it. Those numbers are
// where the missing outline was.
{
  const OLD_LEFT = 'polygon(6.94% 50%, 46.56% 7.5%, 46.56% 29.6%, 93.06% 29.6%, '
                 + '93.06% 70.4%, 46.56% 70.4%, 46.56% 92.5%)';
  await evalJs(`document.querySelector('.pad-l .btn[data-k="left"]').style.setProperty('--gold', ${JSON.stringify(OLD_LEFT)});`);
  await sleep(200);
  const was = await ringOf('canary-old');
  ok('the outline the old build drew would have been caught', was.left.bad > 8,
     `${was.left.bad} gold pixels on the edge — the two steps either side of the head`);
}

// SECOND, the degenerate case: give the gold the outline's own polygon, so there is no
// outline anywhere at all.
await evalJs(`document.querySelector('.pad-l .btn[data-k="left"]').style.setProperty('--gold', getComputedStyle(document.querySelector('.pad-l .btn[data-k="left"]')).getPropertyValue('--arrow'));`);
await sleep(200);
const broken = await ringOf('canary');
ok('and the check would have caught it being broken', broken.left.bad > 20,
   `${broken.left.bad} edge pixels on a deliberately outline-less arrow`);
ok('without flagging the arrow that was left alone', broken.right.bad === 0, `${broken.right.bad}`);

console.log(`\narrows: ${pass} passed, ${fail} failed  → ${OUT}`);
if (logs.length) console.log('page errors:\n  ' + logs.join('\n  '));
ws.close();
chrome.kill();
if (fail || logs.length) process.exit(1);
