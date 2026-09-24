// THE CHARACTERS, POSED — for holding up against a Head Soccer crop.
//
// Loads the real client on an 844x390 phone, freezes the sim (a hit-stop that never ends —
// flagged as a cut-in by nobody, so the renderer does not shake it — so
// no tick moves anyone between one pose and the next) and stages each pose by writing the
// player's state directly: standing, running, a kick at three points of the swing, a jump,
// a dash, stunned, and the kickoff with its YOU marker. Every pose is saved twice — the
// whole phone screen, and a zoomed crop around player one that is the same framing as the
// HS crops in docs/HS-CHARACTER-LOOK.md.
//
//   node _charshots.mjs                → .shots/chars/<pose>.png, <pose>-zoom.png
//   HS_VIDEO_DIR=../../hs-video node _charshots.mjs   …and side_by_side.png, HS over ours
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const CHROME = chromePath();
const PORT = process.env.PORT || 3047, CDP = 9533;
await ensureServer(PORT);
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/chars`;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME,
  [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio', '--hide-scrollbars',
   `--user-data-dir=${OUT}/prof`, 'about:blank'], { stdio: 'ignore' });
let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(x => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const send = (M, p = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method: M, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }))?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?diff=3&solo=1` });
await sleep(2200);
await ev('window.BOT_OFF = true; startMatch()');
await sleep(1500);

// [name, player-one state, player-two state, match state]. Anything not given is reset to a
// player standing still on the grass.
const G = await ev('C.GROUND_Y'), KT = await ev('C.KICK_TIME');
const POSES = [
  ['kickoff', {}, {}, { phase: 'kickoff', freeze: 1.5, banner: 'kickoff', bannerT: 1.5 }],
  ['stand', {}, {}],
  ['run', { vx: 228 }, { vx: -228 }],
  ['kick1', { kickT: KT * 0.85 }, {}],
  ['kick2', { kickT: KT * 0.6 }, {}],
  ['kick3', { kickT: KT * 0.25 }, {}],
  ['jump', { y: G - 70, onGround: false, vy: -150 }, {}],
  ['dash', {}, {}],
  ['stunned', {}, { stunned: 1 }],
];

const shots = [];
for (const [name, a, b, m = {}] of POSES) {
  await ev(`(() => {
    const M = MATCH, base = { vx: 0, vy: 0, onGround: true, kickT: 0, dashT: 0, stunned: 0, y: ${G} };
    Object.assign(M, { phase: 'play', freeze: 0, banner: null, bannerT: 0, hitStop: 1e9, cutin: 1e9, cutinBy: -1 }, ${JSON.stringify(m)});
    Object.assign(M.players[0], base, { x: 330 }, ${JSON.stringify(a)});
    Object.assign(M.players[1], base, { x: 610 }, ${JSON.stringify(b)});
    M.ball.x = 480; M.ball.y = 200; M.ball.vx = M.ball.vy = 0;
    window.__POSE = ${JSON.stringify(name)};
  })()`);
  await sleep(350);
  // A dash is the one pose that needs history (its afterimages): let the sim run it for a few
  // frames, then freeze — the trail runs on a clock that stops with the hit-stop.
  if (name === 'dash') {
    await ev(`(() => { const p = MATCH.players[0]; p.x = 230; p.dashT = 0.3; p.dashDir = 1; p.vx = 1790;
      MATCH.hitStop = 0; MATCH.cutin = 0; })()`);
    await sleep(90);
    await ev(`MATCH.hitStop = 1e9; MATCH.cutin = 1e9;`);
    await sleep(100);
  }
  const full = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(full.data, 'base64'));
  const r = await ev(`(() => { const e = document.getElementById('head${name === 'stunned' ? 1 : 0}').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; })()`);
  // HS framing: a square 2.6 HITBOX diameters wide, centred on the head — the drawn head is
  // HEAD_W of the hitbox wide, so that is divided back out.
  const s = (r.w / (await ev('HEAD_W'))) * 2.6;
  const clip = { x: r.x + r.w / 2 - s / 2, y: r.y + r.h / 2 - s / 2, width: s, height: s, scale: 400 / s };
  const zoom = await send('Page.captureScreenshot', { format: 'png', clip });
  writeFileSync(`${OUT}/${name}-zoom.png`, Buffer.from(zoom.data, 'base64'));
  shots.push(name);
}
console.log('poses:', shots.join(' '), '→', OUT);

// THE LINEUP: different Saltiz faces in the pitch head's shape and crop, big enough to judge —
// including the cards whose anchors were mis-measured (common_1 sits far left, common_13 and
// legendary_34 claimed heads wider than half the card). LINEUP_ZOOMS=1,1.35,1.6 adds a row per
// crop zoom, for choosing HEAD_CROP; by default one row at the live setting.
const CARDS = (process.env.LINEUP || 'legendary_3,legendary_2,common_1,common_13,legendary_34,epic_10,rare_20,common_31').split(',');
const ZOOMS = (process.env.LINEUP_ZOOMS || '').split(',').filter(Boolean).map(Number);
await ev(`(() => {
  document.querySelectorAll('.lineup').forEach((e) => e.remove());
  const wrap = document.createElement('div');
  wrap.className = 'lineup';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#2c8a4e;display:flex;flex-direction:column;gap:14px;padding:14px;';
  const zooms = ${JSON.stringify(ZOOMS)}.length ? ${JSON.stringify(ZOOMS)} : [HEAD_CROP.zoom];
  for (const z of zooms) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:14px;align-items:flex-end';
    for (const id of ${JSON.stringify(CARDS)}) {
      const [r, n] = id.split('_');
      const h = 78, w = h * HEAD_W / HEAD_H, ol = h * 0.05;
      const el = document.createElement('div');
      el.className = 'head p0';
      el.style.cssText = 'position:relative;transform:none;width:' + w + 'px;height:' + h + 'px;--ol:' + ol + 'px';
      el.appendChild(document.createElement('i'));
      paintHead(el.firstChild, r, +n, w - 2 * ol, { ...HEAD_CROP, zoom: z, h: h - 2 * ol });
      row.appendChild(el);
    }
    wrap.appendChild(row);
  }
  document.body.appendChild(wrap);
})()`);
await sleep(600);
writeFileSync(`${OUT}/heads-lineup.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
console.log('lineup →', `${OUT}/heads-lineup.png`);

// THE SIDE BY SIDE: the same poses cut out of the HS recording (M4-gaps.mp4, which is not in
// git — point HS_VIDEO_DIR at the folder holding it), framed the same way — a square 2.6 heads
// across with the head centred, HS's head being 105 px at full resolution — HS on the top row,
// ours under it. Skipped quietly when the video or ffmpeg is not there.
const VID = `${process.env.HS_VIDEO_DIR || `${import.meta.dirname}/hs-video`}/M4-gaps.mp4`;
const FF = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find((p) => existsSync(p));
if (existsSync(VID) && FF) {
  // [pose, s into M4, head centre x, y at full resolution]
  const HS = [['stand', 29.98, 660, 892], ['run', 32.75, 904, 899], ['kick1', 29.713, 660, 892],
    ['kick2', 29.747, 660, 892], ['kick3', 29.813, 660, 892], ['jump', 21.25, 661, 830],
    ['dash', 57.967, 1909, 905], ['stunned', 62.5, 1010, 816]];
  const S = 273;
  for (const [n, ts, x, y] of HS) {
    execFileSync(FF, ['-v', 'error', '-y', '-ss', String(ts), '-i', VID, '-frames:v', '1', '-vf',
      `crop=${S}:${S}:${x - S / 2 | 0}:${y - S / 2 | 0},scale=260:260`, `${OUT}/hs-${n}.png`]);
  }
  const row = (pre, suf) => HS.map(([n]) => ['-i', `${OUT}/${pre}${n}${suf}.png`]).flat();
  const k = HS.length;
  const f = HS.map((_, i) => `[${i}]scale=260:260[a${i}];[${i + k}]scale=260:260[b${i}];`).join('')
    + HS.map((_, i) => `[a${i}]`).join('') + `hstack=${k}[top];`
    + HS.map((_, i) => `[b${i}]`).join('') + `hstack=${k}[bot];[top][bot]vstack`;
  execFileSync(FF, ['-v', 'error', '-y', ...row('hs-', ''), ...row('', '-zoom'), '-filter_complex', f, `${OUT}/side_by_side.png`]);
  console.log('side by side (HS top, ours below) →', `${OUT}/side_by_side.png`);
}
if (errs.length) console.log('page errors:', errs.slice(0, 5));
chrome.kill();
process.exit(0);
