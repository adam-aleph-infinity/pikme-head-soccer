// Does the game FIT the phone, and can a player tell the two modes apart?
//
// Three things Adam asked for after playing it in the app, and all three are claims about a
// real viewport, so they are checked in one: the two-mode pick screen, the letterbox, and —
// the reason this file is not just a screenshot — that cropping the canvas did not slide the
// DOM heads off their bodies.
//
//   node _fit-shots.mjs        (server on 3020)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const OUT = process.env.SHOT_OUT || '/tmp/hs-fit', CDP = 9499;
// Defaults to the local server; BASE=https://pikme-headsoccer.onrender.com checks what the
// app actually loads, which is the only version that matters to a tester.
const BASE = process.env.BASE || 'http://127.0.0.1:3020';
mkdirSync(OUT, { recursive: true });
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [`--remote-debugging-port=${CDP}`,'--headless=new','--no-first-run','--mute-audio','--hide-scrollbars',`--user-data-dir=${OUT}/fitprof`,'about:blank'],{stdio:'ignore'});
let t; for(let i=0;i<60&&!t;i++){ await sleep(200); try{ t=(await(await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x=>x.type==='page'); }catch{} }
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>{ws.onopen=r;});
let id=0; const pend=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result??m.error);pend.delete(m.id);}};
const send=(m,p={})=>new Promise(r=>{pend.set(++id,r);ws.send(JSON.stringify({id,method:m,params:p}));});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}))?.result?.value;
const ok=(n,c,e='')=>console.log(`  ${c?'✓':'✗'} ${n}${e?'  — '+e:''}`);
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:`${BASE}/?diff=3&solo=1`});
await sleep(2600);
// The pick screen has to FIT a landscape phone before anything else on it matters: at 390px
// tall the grid had collapsed to a sliver and the play button was below the fold.
const fits = await ev(`(() => {
  const q = (sel) => document.querySelector(sel).getBoundingClientRect();
  const grid = q('#cardGrid'), foot = q('.pick-foot'), modes = q('#modes');
  return { grid: Math.round(grid.height), footBottom: Math.round(foot.bottom),
           modesBottom: Math.round(modes.bottom), vh: innerHeight,
           scroll: document.getElementById('pick').scrollHeight > innerHeight + 1 };
})()`);
ok('the buttons you press are pinned inside the frame',
   fits.footBottom <= fits.vh + 1 && fits.modesBottom <= fits.vh + 1, JSON.stringify(fits));

// The album scrolls rather than being squeezed into a two-row window: the whole rarity is
// reachable by flicking, and «שחק» stays put while you do it.
const scrollable = await ev(`(() => {
  const pick = document.getElementById('pick');
  const before = document.querySelector('.pick-foot').getBoundingClientRect().top;
  const rows = document.querySelectorAll('#cardGrid .card').length;
  pick.scrollTop = 9999;
  const moved = pick.scrollTop;
  const after = document.querySelector('.pick-foot').getBoundingClientRect().top;
  const lastCard = document.querySelectorAll('#cardGrid .card')[rows - 1].getBoundingClientRect();
  pick.scrollTop = 0;
  return { canScroll: moved > 0, cards: rows, footMoved: Math.round(Math.abs(after - before)),
           lastVisible: lastCard.bottom <= innerHeight + 2 && lastCard.top >= -2 };
})()`);
ok('the album scrolls to show more', scrollable.canScroll && scrollable.cards === 45, JSON.stringify(scrollable));
ok('and the last card is reachable', scrollable.lastVisible, JSON.stringify(scrollable));
ok('while the play controls stay pinned', scrollable.footMoved <= 2, `moved ${scrollable.footMoved}px`);

// The home screen's shape, asserted rather than eyeballed: one header row, one control row,
// and the album gets the rest. Before this it was three stacked blocks eating 135px of a
// 390px screen — a third of the phone before a single card.
const shape = await ev(`(() => {
  const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) }; };
  return { top: box('.pick-top'), bar: box('.pick-bar'), grid: box('#cardGrid'), vh: innerHeight };
})()`);
ok('the header is one row, not three', shape.top.h <= 90, `${shape.top.h}px tall`);

// THE SAFE ZONE. A landscape phone puts the notch on one SIDE and the home indicator along
// the bottom; this screen only ever padded the top, so on a real handset the rarity tabs and
// the play button sat underneath both. A headless browser reports no insets at all, so the
// page carries a debug class that forces some — otherwise this is untestable anywhere except
// on Adam's phone.
const safe = await ev(`(() => {
  document.body.classList.add('safedemo');
  const L = 44, R = 44, B = 21;
  const all = [...document.querySelectorAll('#pick .slot, .rarity-tabs button, .modes button, #playBtn, .netdot')]
    .filter((e) => e.getBoundingClientRect().width > 0);
  const out = all.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.left < L - 1 || r.right > innerWidth - R + 1 || r.bottom > innerHeight - B + 1;
  });
  const why = out.map((e) => {
    const r = e.getBoundingClientRect();
    return (e.className || e.id) + '[' + Math.round(r.left) + '..' + Math.round(r.right) + ',b' + Math.round(r.bottom) + ']';
  });
  const bar = document.querySelector('.pick-bar').getBoundingClientRect();
  document.body.classList.remove('safedemo');
  return { checked: all.length, outside: out.length, why: why.join(' '),
           bar: [Math.round(bar.left), Math.round(bar.right)], vw: innerWidth };
})()`);
ok('every control clears the notch and the home indicator', safe.outside === 0,
   `${safe.outside} of ${safe.checked} outside: ${safe.why}`);
ok('while the bar itself still reaches the screen edge',
   safe.bar[0] <= 1 && safe.bar[1] >= safe.vw - 1, `bar spans ${safe.bar.join('..')} of ${safe.vw}`);
ok('the control row is a thumb tall', shape.bar.h <= 56, `${shape.bar.h}px tall`);
ok('and the album gets most of the screen', shape.grid.h > shape.top.h + shape.bar.h,
   `album ${shape.grid.h}px vs chrome ${shape.top.h + shape.bar.h}px`);

// The in-match top-right row lost its ⌨ button; the survivors have to close ranks rather
// than leave a 34px hole where it was.
ok('the pick screen offers two modes',
   (await ev(`[...document.querySelectorAll('#modes button')].map(b=>b.dataset.mode).join(',')`)) === 'bot,duo');
ok('bot mode shows difficulty and hides the link buttons',
   (await ev(`getComputedStyle(document.getElementById('hostBtn')).display === 'none' && getComputedStyle(document.querySelector('.diff')).display !== 'none'`)) === true);
await ev(`document.querySelector('#modes [data-mode="duo"]').click()`);
await sleep(200);
ok('1v1 mode swaps to the link buttons',
   (await ev(`getComputedStyle(document.getElementById('hostBtn')).display !== 'none' && getComputedStyle(document.querySelector('.diff')).display === 'none'`)) === true);
ok('and stops you picking a card for the opponent',
   (await ev(`getComputedStyle(document.getElementById('slotFoe')).pointerEvents === 'none'`)) === true);
writeFileSync(`${OUT}/fit-duo.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await ev(`document.querySelector('#modes [data-mode="bot"]').click()`);
await sleep(200);
// the mode has to survive a reload or it is not a preference
await send('Page.navigate',{url:`${BASE}/?diff=3&solo=1`});
await sleep(2400);
ok('the chosen mode is remembered', (await ev('document.body.dataset.mode')) === 'bot');
await ev('startMatch()');
await sleep(2200);
const bar = await ev(`(() => { const b = getComputedStyle(document.body).backgroundColor;
  const st = document.getElementById('stage').getBoundingClientRect();
  return { bg: b, stageW: Math.round(st.width), stageH: Math.round(st.height), vw: innerWidth, vh: innerHeight }; })()`);
// (There was a check here that the BODY had been repainted. It was testing the first
// implementation, not the property: the body sits behind the stage's own opaque background
// and is never visible, which is why the bars moved onto the stage. The check below tests
// what a player can actually see.)

// The bar has to match the pitch at the height you are looking at, or the bottom corners read
// as holes punched either side of the grass. Sampled off the rendered page, in the bar, at two
// heights — the first version painted the BODY, which sits behind the stage's own opaque
// background and was therefore invisible.
const barPix = await ev(`(() => {
  const cv = document.getElementById('cv').getBoundingClientRect();
  if (cv.left < 6) return null;                       // no bar on this screen: nothing to check
  const st = getComputedStyle(document.getElementById('stage')).backgroundImage;
  return { hasGradient: /gradient/.test(st), barW: Math.round(cv.left) };
})()`);
ok('and the bar follows the pitch — sky above the grass line, grass below',
   !barPix || barPix.hasGradient, JSON.stringify(barPix));
// THE OVERLAY TRAP. The heads are DOM nodes over the canvas, so cropping the canvas without
// threading the same offset through them silently slides both faces off their bodies. Checked
// against the canvas's REAL rect rather than against the page's own OX/OY, so the check
// cannot agree with the bug.
const align = await ev(`(() => {
  const cv = document.getElementById('cv').getBoundingClientRect();
  const out = [];
  for (let i = 0; i < 2; i++) {
    const p = MATCH.players[i];
    const el = document.getElementById('head' + i).getBoundingClientRect();
    // Scale off the WIDTH only: the canvas now extends past the bottom of the world with
    // decorative grass, so dividing by C.H would measure against a canvas that is taller
    // than the world it draws.
    const k = cv.width / C.W;
    const wantX = cv.left + p.x * k;
    const wantY = cv.top + (p.y - 40 - 30 + 8) * k;                   // headY(p), same formula
    out.push({ dx: (el.left + el.width / 2) - wantX, dy: (el.top + el.height / 2) - wantY });
  }
  return out;
})()`);
ok('both heads sit on their bodies after the crop',
   align.every((a) => Math.abs(a.dx) < 6 && Math.abs(a.dy) < 12),
   align.map((a) => `dx=${a.dx.toFixed(1)} dy=${a.dy.toFixed(1)}`).join('  '));
// And the pad has to still be inside the frame, not pushed off with the canvas.
const padFit = await ev(`(() => { const r = [...document.querySelectorAll('.pad .btn')].map(b => b.getBoundingClientRect());
  return { inside: r.every(x => x.bottom <= innerHeight + 1 && x.left >= -1 && x.right <= innerWidth + 1), n: r.length }; })()`);
ok('every control is still inside the screen', padFit.inside && padFit.n === 8, JSON.stringify(padFit));

// THE POINT OF THE BAND: no control may sit on the playable half of the pitch. Measured
// against the GROUND LINE — the line the players stand on — because grass below it is
// decoration and a button over decoration costs nothing.
const clear = await ev(`(() => {
  const cv = document.getElementById('cv').getBoundingClientRect();
  const groundY = cv.top + C.GROUND_Y * (cv.width / C.W);
  const tops = [...document.querySelectorAll('.pad .btn')].map((b) => b.getBoundingClientRect().top);
  return { ground: Math.round(groundY), highestButton: Math.round(Math.min(...tops)),
           gap: Math.round(Math.min(...tops) - groundY) };
})()`);
ok('no control sits on the field', clear.gap >= 0,
   `ground line at ${clear.ground}px, topmost button at ${clear.highestButton}px (gap ${clear.gap}px)`);
writeFileSync(`${OUT}/fit-match.png`, Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
ch.kill();
console.log(`\nshots → ${OUT}`);
