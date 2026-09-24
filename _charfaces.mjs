// THE DRAWN CHARACTERS, IN THE GAME — for holding them up against their cards and against HS.
//
// Loads the real client on an 844x390 phone with legendary #1 vs legendary #2 (the two cards
// that have a cartoon, public/characters.js) and shoots every place a head shows:
//   pick.png          the pick screen slots
//   match-<pose>.png  the pitch, frozen, in each expression (stand, kick, hurt, goal)
//   zoom-<pose>.png   the same, cropped round player one the way _charshots.mjs frames HS
//   over.png          the result screen (winner happy, loser sad and greyed)
//   arcade.png        the arcade select (the reel and your face)
// and, with the HS recording at hand (HS_VIDEO_DIR, as _charshots.mjs), sheet.png: for each
// character, card photo | cartoon (big) | ours in-match | HS in-match | HS select portrait.
//
//   PORT=3081 node _charfaces.mjs        → .shots/charfaces/
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const PORT = process.env.PORT || 3081, CDP = process.env.CDP || 9581;
const srv = await ensureServer(PORT);
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/charfaces`;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(chromePath(),
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
const shot = async (name, clip) => writeFileSync(`${OUT}/${name}.png`,
  Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })).data, 'base64'));
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?diff=3&solo=1` });
await sleep(2200);

// ---- the pick screen ----
await ev(`(() => { pick.me = { rarity: 'legendary', number: 1 }; pick.foe = { rarity: 'legendary', number: 2 }; renderSlots(); })()`);
await sleep(500);
await shot('pick');

// ---- the pitch, frozen per pose (the _charshots.mjs trick: a hit-stop that never ends) ----
await ev('window.BOT_OFF = true; startMatch()');
await sleep(1500);
const G = await ev('C.GROUND_Y'), KT = await ev('C.KICK_TIME');
const POSES = [
  ['stand', {}, {}],
  ['kick', { kickT: KT * 0.6 }, { kickT: KT * 0.6 }],
  ['hurt', { stunned: 1 }, { stunned: 1 }],
  ['goal', {}, {}, { banner: 'goal', bannerT: 1.5, lastScorer: 0 }],
];
for (const [name, a, b, m = {}] of POSES) {
  await ev(`(() => {
    const M = MATCH, base = { vx: 0, vy: 0, onGround: true, kickT: 0, dashT: 0, stunned: 0, y: ${G} };
    Object.assign(M, { phase: 'play', freeze: 0, banner: null, bannerT: 0, hitStop: 1e9, cutin: 1e9, cutinBy: -1 }, ${JSON.stringify(m)});
    Object.assign(M.players[0], base, { x: 360 }, ${JSON.stringify(a)});
    Object.assign(M.players[1], base, { x: 560 }, ${JSON.stringify(b)});
    M.ball.x = 460; M.ball.y = 150; M.ball.vx = M.ball.vy = 0;
  })()`);
  await sleep(450);
  await shot(`match-${name}`);
  // HS framing (as _charshots.mjs): a square 2.6 hitbox diameters wide round player one's head
  const r = await ev(`(() => { const e = document.getElementById('head0').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; })()`);
  const s = (r.w / (await ev('HEAD_W'))) * 2.6;
  await shot(`zoom-${name}`, { x: r.x + r.w / 2 - s / 2, y: r.y + r.h / 2 - s / 2, width: s, height: s, scale: 400 / s });
  if (name === 'stand') {
    const r2 = await ev(`(() => { const e = document.getElementById('head1').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; })()`);
    await shot('zoom-stand-p2', { x: r2.x + r2.w / 2 - s / 2, y: r2.y + r2.h / 2 - s / 2, width: s, height: s, scale: 400 / s });
  }
}

// ---- the result screen ----
await ev(`(() => { MATCH.score = [3, 1]; endMatch(); })()`);
await sleep(500);
await shot('over');

// ---- the arcade select, on stage 1 (legendary #1 is its champion) with you as legendary #2 ----
await ev(`(() => { pick.me = { rarity: 'legendary', number: 2 }; openArcade(); selectStage(1); })()`);
await sleep(1200);
await shot('arcade');
console.log('shots →', OUT, errs.length ? `\nERRORS:\n${errs.join('\n')}` : '');

// ---- the comparison sheet ----
const VID = process.env.HS_VIDEO_DIR || `${import.meta.dirname}/hs-video`;
const FF = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find((p) => existsSync(p));
if (FF && existsSync(`${VID}/M4-gaps.mp4`)) {
  // HS in-match: the stand pose _charshots.mjs uses (M4 29.98, head at 660,892, 2.6 heads = 273 px)
  execFileSync(FF, ['-v', 'error', '-y', '-ss', '29.98', '-i', `${VID}/M4-gaps.mp4`, '-frames:v', '1', '-vf',
    'crop=273:273:523:755,scale=400:400', `${OUT}/hs-stand.png`]);
  execFileSync(FF, ['-v', 'error', '-y', '-ss', '0.8', '-i', `${VID}/M3-airdrop-full.mp4`, '-frames:v', '1', '-vf',
    'crop=520:440:380:370', `${OUT}/hs-select.png`]);
  // the two card photos, cropped to the face
  const CARD = 'https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards/legendary';
  execFileSync(FF, ['-v', 'error', '-y', '-i', `${CARD}/1.webp`, '-vf', 'crop=110:130:145:190,scale=340:-1', `${OUT}/card-1.png`]);
  execFileSync(FF, ['-v', 'error', '-y', '-i', `${CARD}/2.webp`, '-vf', 'crop=130:170:130:115,scale=300:-1', `${OUT}/card-2.png`]);
  const base = `http://127.0.0.1:${PORT}/img/chars`;
  const f = (p) => `file://${OUT}/${p}`;
  const row = (n, dir, zoom) => `<div class="row">
    <figure><img class="c" src="${f(`card-${n}.png`)}"><figcaption>card #${n}</figcaption></figure>
    ${['normal', 'hurt', 'happy', 'sad'].map((e) => `<figure><img class="b" src="${base}/${dir}/${e}.svg"><figcaption>${e}</figcaption></figure>`).join('')}
    <figure><img class="z" src="${f(zoom)}"><figcaption>ours in-match</figcaption></figure>
    <figure><img class="z" src="${f('hs-stand.png')}"><figcaption>HS in-match</figcaption></figure>
    <figure><img class="c" src="${f('hs-select.png')}"><figcaption>HS select</figcaption></figure></div>`;
  writeFileSync(`${OUT}/sheet.html`, `<!doctype html><style>body{margin:0;background:#2c6e3a;font:13px -apple-system,Arial;color:#fff}
    .row{display:flex;gap:8px;padding:8px;align-items:flex-end}figure{margin:0;text-align:center}
    .c{height:250px}.b{width:230px}.z{width:250px}</style>${row(1, 'legendary-1', 'zoom-stand.png')}${row(2, 'legendary-2', 'zoom-stand-p2.png')}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 2150, height: 560, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `file://${OUT}/sheet.html` });
  await sleep(1200);
  await shot('sheet');
  console.log('sheet →', `${OUT}/sheet.png`);
}
chrome.kill();
srv.stop?.();
process.exit(0);
