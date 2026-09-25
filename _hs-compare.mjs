// SIDE BY SIDE WITH HEAD SOCCER: every power shot in our footage, re-staged in the live client and
// laid under the real frames at the same moments — press, cut-in, flight, impact, after.
//
//   node _hs-compare.mjs            → .shots/compare/<id>.png (HS on top, ours below), one per shot
//   node _hs-compare.mjs m4-60      → just the shots whose id starts with that
//   HS_VIDEO=/path/to/hs-video …    → where the recordings are (default: ./hs-video, then the main
//                                     checkout's hs-video when run from a worktree)
//
// Each shot is staged from what the frames show (docs/HS-POWER-SHOTS.md §5): who shoots from
// where, whether he jumped for it, and what the other player did — armed (counter), kicking
// (block), jumping, or standing. The match is held (window.SIM_HOLD) and stepped tick by tick, so
// our moments are exact: press = the armed rim, cut = 0.5s into the cut-in, fly = 0.12s after the
// ball leaves (0.97s in), impact = the tick the shot meets the other player, after = the same
// gap past impact as the HS frame. HS moments are the video seconds read off the footage.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const W = 1060;
// id, video, HS seconds [press, cut, fly, impact, after], shooter seat / x / jumps, family,
// the other player's x and what he does. x is world px (the pitch is 1060 wall to wall).
export const SHOTS = [
  { id: 'm4-40.40', video: 'M4-gaps', hs: [40.15, 40.9, 41.52, 41.8, 42.3], shooter: 1, sx: 850, jump: true, fam: 'straight', dx: 120, does: 'armedJump',
    note: 'CPU comet; the armed player jumps into it and counters (own cut-in)' },
  { id: 'm4-41.93', video: 'M4-gaps', hs: [41.75, 42.5, 43.07, 43.33, 43.6], shooter: 0, sx: 140, jump: false, fam: 'straight', dx: 960, does: 'jump',
    note: 'the counter shot grazes the jumping CPU and goes in' },
  { id: 'm4-60.16', video: 'M4-gaps', hs: [59.95, 60.8, 61.3, 61.5, 62.85], shooter: 1, sx: 830, jump: true, fam: 'straight', dx: 270, does: 'kick',
    note: 'kick-block: grind, dead ball, fires back at the CPU' },
  { id: 'm4-78.36', video: 'M4-gaps', hs: [78.15, 79.0, 79.45, 79.6, 80.9], shooter: 1, sx: 600, jump: true, fam: 'straight', dx: 260, does: 'kick',
    note: 'kick-block; the rebound hits the CPU (stars)' },
  { id: 'm4-122.89', video: 'M4-gaps', hs: [122.65, 123.5, 124.0, 124.15, 124.6], shooter: 1, sx: 480, jump: true, fam: 'straight', dx: 100, does: 'stand',
    note: 'over the standing keeper, goal' },
  { id: 'm4-150.59', video: 'M4-gaps', hs: [150.35, 151.2, 151.72, 151.85, 152.2], shooter: 1, sx: 560, jump: true, fam: 'straight', dx: 100, does: 'stand',
    note: 'over the standing keeper, goal' },
  { id: 'm4-171.91', video: 'M4-gaps', hs: [171.7, 172.5, 173.02, 173.2, 173.5], shooter: 1, sx: 560, jump: true, fam: 'straight', dx: 190, does: 'kick',
    note: 'kick-block at the goal line, grind' },
  { id: 'm3-37.2', video: 'M3-airdrop-full', hs: [36.95, 37.6, 38.28, 38.33, 38.5], shooter: 0, sx: 800, jump: false, fam: 'straight', dx: 930, does: 'stand',
    note: 'hits the standing keeper square on, bounces straight back' },
  { id: 'm3-71.5', video: 'M3-airdrop-full', hs: [71.0, 71.8, 72.6, 72.75, 73.3], shooter: 0, sx: 330, jump: true, fam: 'straight', dx: 660, does: 'armedJump', dfam: 'grab',
    note: 'the armed Mexico CPU counters (its own cut-in)' },
  { id: 'm3-mexico', video: 'M3-airdrop-full', hs: [72.6, 73.3, 73.93, 74.12, 74.5], shooter: 1, sx: 660, jump: false, fam: 'grab', dx: 200, does: 'stand',
    note: 'the Mexico counter: the claw seizes the player (stars)' },
  { id: 'm2-0-05', video: 'M2-arcade-kor-uk', hs: [102.25, 103.0, 103.72, 103.8, 104.1], shooter: 0, sx: 220, jump: false, fam: 'straight', dx: 630, does: 'stand',
    note: 'game clock 0:05: hits the UK player, bounces back to the shooter' },
  { id: 'm2-aerial', video: 'M2-arcade-kor-uk', hs: [41.7, 42.3, 43.7, 44.35, 44.6], shooter: 1, sx: 560, jump: false, fam: 'aerial', dx: 45, does: 'stand', aerial: true,
    note: 'game clock 0:43: the UK meteor — up, warning streaks, dive' },
];

const want = process.argv.slice(2);
const LIST = want.length ? SHOTS.filter((s) => want.some((w) => s.id.startsWith(w))) : SHOTS;
const VIDEO = [process.env.HS_VIDEO, `${import.meta.dirname}/hs-video`, `${import.meta.dirname}/../../../hs-video`]
  .find((d) => d && existsSync(`${d}/M4-gaps.mp4`));
if (!VIDEO) { console.log('no hs-video/ with the recordings (set HS_VIDEO)'); process.exit(2); }

const PORT = Number(process.env.PORT) || 3133, CDP = PORT + 6400;
const server = await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/compare`;
mkdirSync(OUT, { recursive: true });
rmSync(`${OUT}/prof`, { recursive: true, force: true });
const chrome = spawn(chromePath(), [
  `--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run', '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${OUT}/prof`, 'about:blank',
], { stdio: 'ignore' });
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
}
if (!target) { chrome.kill(); server.stop(); throw new Error('chrome never came up'); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pend = new Map(), errs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m.error); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) errs.push(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r?.result?.value;
};
const shot = async (file) => {
  await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(file, Buffer.from(s.data, 'base64'));
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
const HELPERS = `(async () => {
  window.SIM_HOLD = true;
  const S = await import('/shared/sim.js'), HP = await import('/shared/hs-powers.js');
  window.__HP = HP;
  window.__press = [{}, {}];
  // One tick; the other player's behaviour is decided here from the ball.
  window.__tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const sc = window.__sc, m = MATCH, b = m.ball, d = m.players[sc.d];
      const inputs = [{}, {}];
      const coming = m.hitStop <= 0 && b.power && b.power.owner !== sc.d && (d.x - b.x) * (b.vx || 0) > 0;
      const gap = Math.abs(b.x - d.x);
      // up to meet it (a flat shot off a jumping head passes over a standing one), then the boot
      if (sc.does !== 'stand' && coming && gap < 600 && !sc.jumped) { inputs[sc.d] = { jump: true }; sc.jumped = true; }
      if (sc.does === 'kick' && coming && gap < 150 && !sc.acted) { inputs[sc.d] = { kick: true }; sc.acted = true; }
      Object.assign(inputs[sc.s], window.__press[sc.s]); Object.assign(inputs[sc.d], window.__press[sc.d]);
      window.__press = [{}, {}];
      S.step(m, inputs, C.TICK);
      for (const e of m.events) { VFXR.onEvent(e); EVENTS.push(e); sc.log.push(e); }
      m.events.length = 0;
      VFXR.update(C.TICK);
    }
  };
  return 'ok';
})()`;
// A fresh match for every shot, so nothing one staging leaves behind leaks into the next.
async function freshPage() {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_8&foe=legendary_9&play=1&solo=1&stage=japan` });
  // until the match exists and the canvas has its size (a loaded machine takes longer than 1.6s,
  // and a strip shot before the resize is a tiny canvas in the corner)
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (await js(`typeof MATCH !== 'undefined' && !!MATCH && typeof VFXR !== 'undefined' && document.readyState === 'complete'`)) break;
  }
  await sleep(600);
  await js(HELPERS);
}

let bad = 0;
const T = (s) => Math.round(s * 60);
for (const sc of LIST) {
  await freshPage();
  const d = 1 - sc.shooter;
  await js(`(() => {
    const sc = window.__sc = ${JSON.stringify({ s: sc.shooter, d, does: sc.does })}; sc.log = []; sc.acted = false;
    const m = MATCH;
    m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.gaugeLead = 0; m.hitStop = 0; m.cutin = 0; m.clock = 60;
    m.score[0] = m.score[1] = 0;
    const a = m.players[sc.s], z = m.players[sc.d];
    a.shot = __HP.shotById('${sc.fam}'); z.shot = __HP.shotById('${sc.dfam || 'straight'}');
    a.x = ${sc.sx}; z.x = ${sc.dx};
    for (const p of m.players) { p.y = C.GROUND_Y; p.vx = p.vy = 0; p.onGround = true; p.stunned = 0; p.ail = ''; p.ailT = 0; p.kickT = 0; p.kickCd = 0; p.armed = 0; p.gauge = 0; p.prev = {}; }
    m.ball.power = null; m.xballs.length = 0; m.ball.x = C.W / 2; m.ball.y = C.SKY_Y + 40; m.ball.vx = m.ball.vy = 0;
    EVENTS.length = 0; VFXR.reset();
    // the other player armed first, if he is going to counter
    if (sc.does.startsWith('armed')) { z.gauge = 1; __press[sc.d] = { power: true }; __tick(1); }
    a.gauge = 1; __press[sc.s] = { power: true }; __tick(1);
    m.ball.x = C.W / 2; m.ball.y = C.SKY_Y + 40; m.ball.vy = 0;
  })()`);
  await shot(`${OUT}/${sc.id}-ours-0.png`);                                       // press: the rim
  // the touch — at the top of a jump if he jumped for it
  await js(`(() => { const sc = window.__sc, a = MATCH.players[sc.s];
    ${sc.jump ? "__press[sc.s] = { jump: true }; __tick(1); let g = 0; while (a.vy < 0 && g++ < 60) { MATCH.ball.x = C.W / 2; MATCH.ball.y = C.SKY_Y + 40; MATCH.ball.vy = 0; __tick(1); }" : ''}
    // the ball meets the front of his head, at its centre height (a flat shot leaves at that height)
    MATCH.ball.x = a.x + a.side * (C.HEAD_R + C.BALL_R - 4); MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R + C.NECK; MATCH.ball.vx = MATCH.ball.vy = 0;
    __tick(1); })()`);
  await js(`__tick(${T(0.5)})`);
  await shot(`${OUT}/${sc.id}-ours-1.png`);                                       // cut-in
  await js(`(() => { let g = 0; while (MATCH.hitStop > 0 && g++ < 200) __tick(1); __tick(${T(0.12)}); })()`);
  let flyAt = 2;
  if (sc.aerial) {                                                                // the Aerial's own middle: the warning
    await js(`(() => { let g = 0; while (g++ < 200 && !(MATCH.ball.power && MATCH.ball.power.ph === 'wait' && MATCH.ball.power.k > 0.5)) __tick(1); })()`);
    flyAt = 2;
  }
  await shot(`${OUT}/${sc.id}-ours-${flyAt}.png`);                                // flight
  // The Aerial's HS "impact" frame (M2 44.35 s) is the meteor mid-dive, 0.1 s before it meets
  // the keeper: take ours at the same point of the dive, then 'after' past the meeting.
  if (sc.aerial) {
    await js(`(() => { let g = 0; while (g++ < 200 && !(MATCH.ball.power && MATCH.ball.power.ph === 'dive' && MATCH.ball.power.t >= 0.1)) __tick(1); })()`);
    await shot(`${OUT}/${sc.id}-ours-3.png`);
  }
  const met = await js(`(() => { const sc = window.__sc; let g = 0, seen = null;
    // from the shot itself: a close one can land before the flight picture was taken
    const from = sc.log.findIndex((e) => e.type === 'powershot') + 1;
    while (g++ < 300 && !seen) { __tick(1); seen = sc.log.slice(from).find((e) => ['powerHit', 'blocked', 'grabbed', 'goal'].includes(e.type) || (e.type === 'powershot' && e.countered)); }
    __tick(2); return seen ? seen.type + (seen.how ? ':' + seen.how : '') + (seen.y ? ' @' + seen.x.toFixed(0) + ',' + seen.y.toFixed(0) : '') : null; })()`);
  if (!sc.aerial) await shot(`${OUT}/${sc.id}-ours-3.png`);                       // impact
  await js(`__tick(${T(Math.max(0.1, sc.hs[4] - sc.hs[3] - (sc.aerial ? 0.15 : 0)))})`);
  await shot(`${OUT}/${sc.id}-ours-4.png`);                                       // after
  const log = await js(`window.__sc.log.map((e) => e.type).filter((t) => !['jump', 'stunned', 'ailment', 'ailmentEnd', 'revive'].includes(t)).join(' ')`);
  console.log(`  ${met ? '✓' : '✗'} ${sc.id}: ${met || 'never met'} — ${sc.note}\n      ours: ${log}`);
  if (!met) bad++;

  // HS frames, and the strip: HS over ours, five moments across.
  const cols = [];
  sc.hs.forEach((t, k) => {
    const hs = `${OUT}/${sc.id}-hs-${k}.png`;
    spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', String(t), '-i', `${VIDEO}/${sc.video}.mp4`, '-frames:v', '1', '-vf', 'scale=480:222,setsar=1', hs]);
    const col = `${OUT}/${sc.id}-col-${k}.png`;
    spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', hs, '-i', `${OUT}/${sc.id}-ours-${k}.png`, '-filter_complex',
      '[0:v]scale=480:222,setsar=1[a];[1:v]scale=480:222,setsar=1[b];[a][b]vstack=inputs=2,pad=iw+6:ih+6:3:3:white', col]);
    cols.push('-i', col);
  });
  spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...cols, '-filter_complex', `hstack=inputs=${sc.hs.length}`, `${OUT}/${sc.id}.png`]);
}
// The contact sheet: every strip stacked, in SHOTS order (from whatever strips are on disk).
{
  const have = SHOTS.map((s) => `${OUT}/${s.id}.png`).filter((f) => existsSync(f));
  if (have.length > 1) spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...have.flatMap((f) => ['-i', f]), '-filter_complex', `vstack=inputs=${have.length}`, `${OUT}/ALL.png`]);
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 4).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();
console.log(`_hs-compare: ${LIST.length} shots → ${OUT}/<id>.png (HS top, ours bottom: press, cut-in, flight, impact, after)${bad ? `, ${bad} PROBLEMS` : ''}`);
process.exit(bad ? 1 : 0);
