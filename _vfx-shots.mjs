// Photograph every POWER-SHOT FAMILY in the live client at 844×390, frame-exactly.
//
// The match is held (window.SIM_HOLD) and stepped from here tick by tick, so each picture is the
// same moment every run and can be laid next to the Head Soccer frame it is meant to match
// (docs/HS-POWER-SHOTS.md; _hs-compare.mjs builds those strips).
//
//   node _vfx-shots.mjs                    → .shots/vfx/<family>-<moment>.png, all 11 families
//   node _vfx-shots.mjs straight aerial    → just those
//
// Moments per family (player on the left fires at the one on the right):
//   a-armed   the press: the rim and the tongues, before the touch
//   b-cut     0.2s into the cut-in          c-cut2   1.0s into it
//   d-fly     0.12s after the ball leaves     e-fly    0.18s       f-fly    0.29s
//   g-hit     the shot meeting the standing defender (knocked back, stars)
// …and for `straight` also h-block (the defender kicks into it: the grind) and the six ailments
// (ail-<name>) on a standing player.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
import { FAMILY_ORDER, AILMENT_ORDER } from './shared/hs-powers.js';

const want = process.argv.slice(2);
const FAMS = want.length ? FAMILY_ORDER.filter((f) => want.includes(f)) : FAMILY_ORDER;
const PORT = Number(process.env.PORT) || 3131, CDP = PORT + 6400;
const server = await ensureServer(PORT);
const OUT = `${import.meta.dirname}/.shots/vfx`;
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
// Two animation frames so draw() has run on the state we just made, then the picture.
const shot = async (name) => {
  await js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });

// The in-page helpers: step the held match n ticks, feeding the renderer its events.
const HELPERS = `(async () => {
  window.SIM_HOLD = true;
  const S = await import('/shared/sim.js'), HP = await import('/shared/hs-powers.js');
  window.__HP = HP;
  window.__tick = (n, inputs) => {
    for (let i = 0; i < n; i++) {
      S.step(MATCH, typeof inputs === 'function' ? inputs(i) : (inputs || [{}, {}]), C.TICK);
      for (const e of MATCH.events) { VFXR.onEvent(e); EVENTS.push(e); }
      MATCH.events.length = 0;
      VFXR.update(C.TICK);
    }
  };
  window.__open = (fam) => {
    const m = MATCH;
    m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0; m.gaugeLead = 0; m.hitStop = 0; m.cutin = 0;
    m.clock = 60;
    const [a, z] = m.players;
    a.shot = HP.shotById(fam); z.shot = HP.shotById('straight');
    a.x = 290; z.x = 790; a.y = z.y = C.GROUND_Y; a.vx = z.vx = 0; a.vy = z.vy = 0;
    for (const p of m.players) { p.stunned = 0; p.ail = ''; p.ailT = 0; p.kickT = 0; p.kickCd = 0; p.armed = 0; p.gauge = 0; p.prev = {}; }
    m.ball.power = null; m.xballs.length = 0;
    EVENTS.length = 0;
    VFXR.reset();
  };
  return 'ok';
})()`;

async function openMatch() {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=legendary_8&foe=legendary_9&play=1&solo=1&stage=japan` });
  await sleep(1800);
  await js(HELPERS);
}

let bad = 0;
await openMatch();
for (const fam of FAMS) {
  await js(`__open('${fam}')`);
  // the press
  await js(`(() => { const a = MATCH.players[0]; a.gauge = 1; MATCH.ball.x = 530; MATCH.ball.y = 140; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1, [{ power: true }, {}]); MATCH.ball.x = 530; MATCH.ball.y = 140; MATCH.ball.vy = 0; })()`);
  await shot(`${fam}-a-armed`);
  // the touch: the ball on the armed head, then into the cut-in
  await js(`(() => { const a = MATCH.players[0]; MATCH.ball.x = a.x + 8; MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R * 2 + 6; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1); __tick(12); })()`);
  await shot(`${fam}-b-cut`);
  await js('__tick(48)');
  await shot(`${fam}-c-cut2`);
  // The ball leaves POWER_RELEASE before the cut-in lifts and flies under the dark (§2); the three
  // flight pictures are 0.12, 0.18 and 0.29s after it leaves — M4 43.07, 43.13 and 43.24 s.
  await js(`(() => { let g = 0; while (MATCH.cutin > C.POWER_RELEASE && g++ < 200) __tick(1); __tick(7); })()`);
  await shot(`${fam}-d-fly`);
  await js('__tick(4)');
  await shot(`${fam}-e-fly`);
  await js('__tick(7)');
  await shot(`${fam}-f-fly`);
  // the Aerial's own moments: the warning streaks (half way through its wait) and the dive
  if (fam === 'aerial') {
    await js(`(() => { let g = 0; while (g++ < 200 && !(MATCH.ball.power && MATCH.ball.power.ph === 'wait' && MATCH.ball.power.k > 0.5)) __tick(1); })()`);
    await shot('aerial-w-warn');
    await js(`(() => { let g = 0; while (g++ < 200 && !(MATCH.ball.power && MATCH.ball.power.ph === 'dive')) __tick(1); __tick(10); })()`);
    await shot('aerial-x-dive');
  }
  // on to the defender (the Aerial and the Delay take their time), then just after it lands
  const hit = await js(`(() => { let g = 0, seen = null;
    while (g++ < 240 && !seen) { __tick(1); seen = EVENTS.slice(-6).find((e) => e.type === 'powerHit' || e.type === 'grabbed' || e.type === 'blocked' || e.type === 'goal'); }
    __tick(3); return seen ? seen.type : null; })()`);
  await shot(`${fam}-g-hit`);
  if (!hit) { console.log(`  ✗ ${fam}: never reached the defender`); bad++; } else console.log(`  ✓ ${fam}: ${hit}`);
}

// The block, and the ailments, on the straight shot.
if (!want.length || want.includes('straight')) {
  await js(`__open('straight')`);
  await js(`(() => { const a = MATCH.players[0]; a.gauge = 1; __tick(1, [{ power: true }, {}]);
    MATCH.ball.x = a.x + 8; MATCH.ball.y = a.y - C.BODY_H - C.HEAD_R * 2 + 6; MATCH.ball.vx = MATCH.ball.vy = 0; __tick(1);
    let g = 0; while (MATCH.hitStop > 0 && g++ < 200) __tick(1);
    const z = MATCH.players[1]; let pressed = false; g = 0;
    while (g++ < 120 && !EVENTS.slice(-4).some((e) => e.type === 'blocked')) {
      const near = Math.abs(MATCH.ball.x - z.x) < 180 && !pressed; if (near) pressed = true;
      __tick(1, [{}, { kick: near }]);
    }
    __tick(20); })()`);
  await shot('straight-h-block');
  for (const ail of AILMENT_ORDER) {
    await js(`__open('straight'); (() => { const z = MATCH.players[1]; z.ail = '${ail}'; z.ailT = 2; MATCH.ball.x = 530; MATCH.ball.y = 200; __tick(1); MATCH.ball.x = 530; MATCH.ball.y = 200; })()`);
    await shot(`ail-${ail}`);
  }
}
if (errs.length) { console.log('page exceptions:', errs.slice(0, 4).join(' | ')); bad++; }
ws.close(); chrome.kill(); server.stop();
console.log(`_vfx-shots: ${FAMS.length} families → ${OUT}${bad ? `, ${bad} PROBLEMS` : ', all fired, no exceptions'}`);
process.exit(bad ? 1 : 0);
