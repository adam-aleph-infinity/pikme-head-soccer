// THE REAL-FACE CHARACTERS, IN THE GAME — for holding them up against their cards and against HS.
//
// Loads the real client on an 844x390 phone with legendary #1 vs legendary #2 (the two cards
// that have a character, public/characters.js) and shoots every place a head shows:
//   pick.png              the pick screen slots
//   match-<pose>.png      the pitch, frozen, in each expression (stand, kick, hurt, goal, bruised)
//   zoom-<pose>[-p2].png  the same, cropped round each player the way _charshots.mjs frames HS,
//                         at the phone's 3x (zoom-*) and at 1x (zoom1x-*)
//   over.png              the result screen (winner happy, loser sad and greyed)
//   arcade.png            the arcade select (the reel and your face)
// and, with the HS recording at hand (HS_VIDEO_DIR, as _charshots.mjs), sheet.png: per character,
// card photo | every expression (big) | ours in-match 3x | ours 1x | HS in-match (Korea, Mexico)
// at the same framing | HS select and result portraits.
//
//   PORT=3101 CDP=9601 node _charfaces.mjs        → .shots/charfaces/
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
const phone = (dsf) => send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: dsf, mobile: true });
await send('Page.enable'); await send('Runtime.enable');
await phone(3);
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
  ['bruised', { hurt: 2 }, { hurt: 3 }],
];
const headRect = (i) => ev(`(() => { const e = document.getElementById('head${i}').getBoundingClientRect(); return { x: e.left, y: e.top, w: e.width, h: e.height }; })()`);
for (const dsf of [3, 1]) {
  await phone(dsf);
  for (const [name, a, b, m = {}] of POSES) {
    await ev(`(() => {
      const M = MATCH, base = { vx: 0, vy: 0, onGround: true, kickT: 0, dashT: 0, stunned: 0, hurt: 0, y: ${G} };
      Object.assign(M, { phase: 'play', freeze: 0, banner: null, bannerT: 0, hitStop: 1e9, cutin: 1e9, cutinBy: -1 }, ${JSON.stringify(m)});
      Object.assign(M.players[0], base, { x: 360 }, ${JSON.stringify(a)});
      Object.assign(M.players[1], base, { x: 560 }, ${JSON.stringify(b)});
      M.ball.x = 460; M.ball.y = 150; M.ball.vx = M.ball.vy = 0;
    })()`);
    await sleep(450);
    if (dsf === 3) await shot(`match-${name}`);
    // HS framing (as _charshots.mjs): a square 2.6 hitbox diameters wide round each player's head
    const s = ((await headRect(0)).w / (await ev('HEAD_W'))) * 2.6;
    for (const i of [0, 1]) {
      const r = await headRect(i);
      // at 1x the pixels the phone would have are captured, then blown up for the sheet
      await shot(`${dsf === 3 ? 'zoom' : 'zoom1x'}-${name}${i ? '-p2' : ''}`,
        { x: r.x + r.w / 2 - s / 2, y: r.y + r.h / 2 - s / 2, width: s, height: s, scale: dsf === 3 ? 400 / s : 1 });
    }
  }
}
await phone(3);

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
  const cut = (file, at, crop, out) => execFileSync(FF, ['-v', 'error', '-y', '-ss', String(at), '-i', `${VID}/${file}`,
    '-frames:v', '1', '-vf', crop, `${OUT}/${out}`]);
  // HS in-match at the framing above: 2.6 heads = 273 px of the 2556-wide recording
  cut('M4-gaps.mp4', 29.98, 'crop=273:273:523:755,scale=400:400:flags=lanczos', 'hs-stand.png');   // Korea
  cut('M3-airdrop-full.mp4', 40, 'crop=273:273:2059:744,scale=400:400:flags=lanczos', 'hs-mex.png'); // Mexico
  // ... and the same at the phone's 1x: 273 px of 2556 is 90 px of an 844-wide screen
  cut('M4-gaps.mp4', 29.98, 'crop=273:273:523:755,scale=90:90:flags=area', 'hs1x-stand.png');
  cut('M3-airdrop-full.mp4', 40, 'crop=273:273:2059:744,scale=90:90:flags=area', 'hs1x-mex.png');
  cut('M3-airdrop-full.mp4', 0.8, 'crop=520:440:380:370', 'hs-select.png');
  cut('M3-airdrop-full.mp4', 0.8, 'crop=460:480:1790:230', 'hs-select-mex.png');
  cut('M3-airdrop-full.mp4', 92.8, 'crop=460:400:1690:390', 'hs-result-mex.png');
  cut('M3-airdrop-full.mp4', 92.8, 'crop=460:400:400:380', 'hs-result-lose.png');
  // the two card photos, cropped to the face
  const CARD = 'https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards/legendary';
  execFileSync(FF, ['-v', 'error', '-y', '-i', `${CARD}/1.webp`, '-vf', 'crop=110:130:145:190,scale=340:-1', `${OUT}/card-1.png`]);
  execFileSync(FF, ['-v', 'error', '-y', '-i', `${CARD}/2.webp`, '-vf', 'crop=130:170:130:115,scale=300:-1', `${OUT}/card-2.png`]);
  const base = `http://127.0.0.1:${PORT}/img/chars`;
  const f = (p) => `file://${OUT}/${p}`;
  const fig = (src, cls, cap) => `<figure><img class="${cls}" src="${src}"><figcaption>${cap}</figcaption></figure>`;
  const row = (n, dir, sfx) => `<div class="row">
    ${fig(f(`card-${n}.png`), 'c', `card #${n}`)}
    ${['normal', 'kick', 'hurt', 'happy', 'sad'].map((e) => fig(`${base}/${dir}/${e}.webp`, 'b', e)).join('')}
    ${fig(f(`zoom-stand${sfx}.png`), 'z', 'ours in-match 3x')}
    ${fig(f(`zoom1x-stand${sfx}.png`), 'z px', 'ours 1x')}
    ${fig(f('hs-stand.png'), 'z', 'HS Korea in-match')}
    ${fig(f('hs-mex.png'), 'z', 'HS Mexico in-match')}
    ${fig(f('hs1x-mex.png'), 'z px', 'HS Mexico 1x')}</div>`;
  const row3 = `<div class="row">
    ${['kick', 'hurt', 'goal', 'bruised'].map((p) => fig(f(`zoom-${p}.png`), 'z', `#1 ${p}`) + fig(f(`zoom-${p}-p2.png`), 'z', `#2 ${p}`)).join('')}</div>
    <div class="row">${fig(f('hs-select.png'), 'c', 'HS select')}${fig(f('hs-select-mex.png'), 'c', 'HS select')}
    ${fig(f('hs-result-lose.png'), 'c', 'HS result (lost)')}${fig(f('hs-result-mex.png'), 'c', 'HS result')}</div>`;
  writeFileSync(`${OUT}/sheet.html`, `<!doctype html><style>body{margin:0;background:#2c6e3a;font:13px -apple-system,Arial;color:#fff}
    .row{display:flex;gap:8px;padding:8px;align-items:flex-end}figure{margin:0;text-align:center}
    .c{height:250px}.b{width:220px}.z{width:230px}.px{image-rendering:auto}</style>
    ${row(1, 'legendary-1', '')}${row(2, 'legendary-2', '-p2')}${row3}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1130, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `file://${OUT}/sheet.html` });
  await sleep(1500);
  await shot('sheet');
  console.log('sheet →', `${OUT}/sheet.png`);
}
chrome.kill();
srv.stop?.();
process.exit(0);
