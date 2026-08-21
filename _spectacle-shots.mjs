// Force every spectacle event in the REAL client, in real Chrome, and photograph it.
//
// The unit tests prove the sim is fair. They cannot prove a meteor marker is VISIBLE, and a
// telegraph nobody can see is not a telegraph — it is an unavoidable hit with extra steps.
// So each shot here is paired with a pixel probe off the live canvas: the marker has to
// turn the grass orange, the moon phase has to turn the pitch blue, the wind has to put
// streaks in the sky. "It renders" is a measurement, not an opinion.
//
//   node _spectacle-shots.mjs            → PNGs + checks
//   PORT=3020 node _spectacle-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.PORT || 3020;
const OUT = process.env.SHOT_OUT ||
  '/private/tmp/claude-501/-Users-adamleeperelman-Documents-pikeme/09ade469-cc19-4722-96c1-c6973e0f4a82/scratchpad/spec';
const ME = process.argv[2] || 'legendary_3';
const FOE = process.argv[3] || 'legendary_2';
const CDP = 9457;
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
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
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

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&solo=1&play=1&stage=japan` });
await sleep(2800);

// ---------------------------------------------------------------------------
// Page-side helpers. The pixel probe reads the LIVE canvas, so a check can say "the grass
// under the marker went orange" rather than "the code that would have drawn it ran".
await evalJs(`
  window.__px = (wx, wy, ww, wh) => {
    const c = document.getElementById('cv');
    const P = 2;                                   // the renderer's PIXEL downscale
    const d = c.getContext('2d').getImageData(Math.round(wx / P), Math.round(wy / P),
                                              Math.max(1, Math.round(ww / P)),
                                              Math.max(1, Math.round(wh / P))).data;
    let r = 0, g = 0, b = 0, n = 0, edges = 0, prev = -1;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      const lum = d[i] + d[i + 1] + d[i + 2];
      if (prev >= 0 && Math.abs(lum - prev) > 90) edges++;
      prev = lum;
    }
    return { r: r / n, g: g / n, b: b / n, edges };
  };
  // Stop the world without dimming it: hit-stop shakes and the kickoff freeze blacks the
  // pitch out, but a 'goal'-phase freeze does neither — drawReady returns early on it.
  window.__hold = (s) => { MATCH.phase = 'goal'; MATCH.freeze = s; };
  window.__play = () => { MATCH.phase = 'play'; MATCH.freeze = 0; };
  window.__act = (kind, secs) => {
    const sp = MATCH.spec;
    sp.kind = kind; sp.dur = Math.round((secs || 20) * 60); sp.t = sp.dur; sp.drop = 1;
    if (kind === ACT.WIND) sp.dir = 1;
  };
  // leftSecs is the time REMAINING before impact, so a big number = high in the sky.
  window.__rock = (x, leftSecs) => {
    const full = Math.round(C.METEOR_WARN * 60);
    const w = Math.max(1, Math.round(leftSecs * 60));
    MATCH.spec.met.push(Math.round(x), Math.min(w, full), full);
  };
  true;
`);
const boot = await evalJs('!!window.MATCH && !!MATCH.spec');
check('the client booted with a spectacle state', boot === true);

const G = await evalJs('({ W: C.W, GROUND_Y: C.GROUND_Y, R: C.METEOR_R })');

// ═══ 1. THE TELEGRAPH ══════════════════════════════════════════════════════
// Three rocks caught at three different points of the same warning, so one frame shows the
// whole tell: marker appears → rock falls → ring closes.
const grass = await evalJs(`__px(${G.W * 0.5 - 40}, ${G.GROUND_Y + 4}, 80, 20)`);
const beamOff = await evalJs(`__px(688, ${G.GROUND_Y - 90}, 24, 70)`);
await evalJs(`
  __play();
  __act(ACT.METEOR, 30);
  MATCH.spec.met.length = 0;
  __rock(250, C.METEOR_WARN * 0.80);      // marker fresh, rock entering the frame
  __rock(480, C.METEOR_WARN * 0.45);      // halfway down, ring closing
  __rock(700, C.METEOR_WARN * 0.10);      // about to land
  MATCH.players[0].x = 250; MATCH.players[1].x = 700;
  __hold(30);
`);
await sleep(420);
await shot('01-meteor-telegraph');
// Grass is strongly green-dominant (r≈56, g≈135). The marker has to break that: red up by
// a lot, and red at least level with green. "Looks orange" as a number.
const mark = await evalJs(`__px(700 - ${G.R * 0.7}, ${G.GROUND_Y + 6}, ${G.R * 1.4}, 22)`);
check('the marker turns the grass under it hot', mark.r > grass.r + 50 && mark.r >= mark.g,
      `marker rgb(${mark.r.toFixed(0)},${mark.g.toFixed(0)},${mark.b.toFixed(0)}) vs grass rgb(${grass.r.toFixed(0)},${grass.g.toFixed(0)},${grass.b.toFixed(0)})`);
const beam = await evalJs(`__px(688, ${G.GROUND_Y - 90}, 24, 70)`);
check('a column of light points at the impact', beam.r > beamOff.r + 8,
      `same strip, beam r=${beam.r.toFixed(0)} vs no-beam r=${beamOff.r.toFixed(0)}`);
const rock = await evalJs(`(() => {
  const m = activeMeteors(MATCH).find(r => r.x === 700);
  return m ? Object.assign(__px(m.x - 22, m.y - 22, 44, 44), { y: m.y, f: m.f }) : null;
})()`);
check('the rock itself is on screen, burning', !!rock && rock.y > 0 && rock.r > 80 && rock.r > rock.b + 25,
      rock ? `y=${rock.y.toFixed(0)} rgb(${rock.r.toFixed(0)},${rock.g.toFixed(0)},${rock.b.toFixed(0)})` : 'no rock');
const early = await evalJs(`(() => { const m = activeMeteors(MATCH).find(r => r.x === 250); return m ? m.y : null; })()`);
check('and it enters the frame early in its own warning', early > 0, `y=${early?.toFixed(0)} at 20% through the warning`);

// ═══ 2. IMPACT ═════════════════════════════════════════════════════════════
await evalJs(`
  __play();
  MATCH.spec.met.length = 0;
  MATCH.players[0].x = 470; MATCH.players[0].y = C.GROUND_Y; MATCH.players[0].knocked = 0;
  MATCH.ball.x = 500; MATCH.ball.y = C.GROUND_Y - 12; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
  EVENTS.length = 0;
  __rock(480, 0.05);
`);
for (let i = 0; i < 40; i++) {
  if (await evalJs(`EVENTS.some(e => e.type === 'meteorHit')`)) break;
  await sleep(40);
}
const hit = await evalJs(`({
  hit: EVENTS.some(e => e.type === 'meteorHit'),
  knocked: EVENTS.some(e => e.type === 'meteorKnock'),
  ball: EVENTS.some(e => e.type === 'meteorBall'),
  vy: MATCH.ball.vy,
})`);
await sleep(70);
await shot('02-meteor-impact');
check('the rock lands', hit.hit === true);
check('it knocks the player standing under it down', hit.knocked === true);
check('and blasts the ball upward', hit.ball === true && hit.vy < -200, `vy=${hit.vy?.toFixed(0)}`);
const crater = await evalJs(`__px(480 - 26, ${G.GROUND_Y + 1}, 52, 12)`);
check('it leaves a scorch mark on the pitch', crater.g < grass.g - 25 && crater.r > crater.b,
      `scorch rgb(${crater.r.toFixed(0)},${crater.g.toFixed(0)},${crater.b.toFixed(0)}) vs grass rgb(${grass.r.toFixed(0)},${grass.g.toFixed(0)},${grass.b.toFixed(0)})`);

// ═══ 3. ROBOT MODE ═════════════════════════════════════════════════════════
await evalJs(`__play(); MATCH.spec.met.length = 0; MATCH.spec.kind = ACT.NONE;
             MATCH.score = [0, 3]; MATCH.spec.rb = [0,0,0,0];`);
for (let i = 0; i < 60; i++) {
  if (await evalJs('isRobot(MATCH, 0)')) break;
  await sleep(60);
}
const charged = await evalJs(`({
  robot: isRobot(MATCH, 0),
  foe: isRobot(MATCH, 1),
  charge: EVENTS.some(e => e.type === 'robotCharge' && e.player === 0),
  on: EVENTS.some(e => e.type === 'robotOn' && e.player === 0),
  chargeFirst: (() => {
    const c = EVENTS.findIndex(e => e.type === 'robotCharge');
    const o = EVENTS.findIndex(e => e.type === 'robotOn');
    return c >= 0 && o > c;
  })(),
})`);
check('being 3 goals down turns you into a robot', charged.robot === true);
check('the leader stays human', charged.foe === false);
check('and the change is announced before it happens', charged.chargeFirst === true);
await evalJs(`MATCH.players[0].x = 330; MATCH.players[0].y = C.GROUND_Y; MATCH.players[0].vx = 200;
             MATCH.players[1].x = 640; MATCH.ball.x = 430; MATCH.ball.y = C.GROUND_Y - 90; __hold(30);`);
await sleep(360);
await shot('03-robot');
const headCss = await evalJs(`(() => { const e = document.getElementById('head0');
  return { filter: e.style.filter, outline: e.style.outlineColor }; })()`);
check('the robot head goes chrome', /grayscale/.test(headCss.filter || ''), headCss.filter || '(none)');
check('and takes the machine outline colour', !!headCss.outline, headCss.outline || '(none)');
const visor = await evalJs(`(() => { const b = document.getElementById('head0').lastElementChild;
  return b && b.tagName === 'B' ? { disp: getComputedStyle(b).display, bg: b.style.background } : null; })()`);
check('the robot gets a lit visor across the card face',
      !!visor && visor.disp !== 'none' && /linear-gradient/.test(visor.bg || ''), JSON.stringify(visor));
const chest = await evalJs(`__px(330 - 14, C.GROUND_Y - 26, 28, 22)`);
check('the chassis and reactor render on the canvas', chest.b > 90 && chest.edges > 2,
      `rgb(${chest.r.toFixed(0)},${chest.g.toFixed(0)},${chest.b.toFixed(0)}) edges=${chest.edges}`);

// The other half of the promise: it ENDS.
await evalJs(`__play(); MATCH.spec.rb[1] = 4;`);      // fast-forward the ON timer to 4 ticks
for (let i = 0; i < 40; i++) {
  if (!(await evalJs('isRobot(MATCH, 0)'))) break;
  await sleep(60);
}
const ended = await evalJs(`({ robot: isRobot(MATCH, 0),
  off: EVENTS.some(e => e.type === 'robotOff'),
  filter: document.getElementById('head0').style.filter })`);
check('robot mode ends', ended.robot === false && ended.off === true);
check('and the head goes back to being a card', !ended.filter, ended.filter || '(cleared)');

// ═══ 4. MOON PHASE ═════════════════════════════════════════════════════════
const pitchBefore = await evalJs(`__px(120, 120, 300, 200)`);
await evalJs(`__play(); MATCH.score = [0,0]; MATCH.spec.rb = [0,0,0,0];
             __act(ACT.MOON, 30);
             MATCH.ball.x = 480; MATCH.ball.y = 200; MATCH.ball.vy = -120;
             MATCH.players[0].x = 300; MATCH.players[1].x = 660;`);
await sleep(500);
await shot('04-moon');
const pitchMoon = await evalJs(`__px(120, 120, 300, 200)`);
check('moon phase washes the pitch cold', pitchMoon.b > pitchBefore.b + 12,
      `blue ${pitchBefore.b.toFixed(0)} → ${pitchMoon.b.toFixed(0)}`);
const moonPhysics = await evalJs(`(() => {
  MATCH.ball.x = 480; MATCH.ball.y = 150; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
  const y0 = MATCH.ball.y;
  return new Promise(r => setTimeout(() => r(MATCH.ball.y - y0), 350));
})()`);
check('and the ball really does fall slower', moonPhysics < 120, `${moonPhysics?.toFixed(0)}px in 350ms`);

// ═══ 5. WIND ═══════════════════════════════════════════════════════════════
await evalJs(`__play(); __act(ACT.WIND, 30); MATCH.spec.dir = 1;
             MATCH.ball.x = 380; MATCH.ball.y = 260; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
             MATCH.players[0].x = 260; MATCH.players[1].x = 700;`);
await sleep(500);
await shot('05-wind');
const sky = await evalJs(`__px(60, 90, 840, 120)`);
check('wind puts streaks across the pitch', sky.edges > 20, `${sky.edges} bright edges`);
const drift = await evalJs(`(() => {
  MATCH.ball.x = 380; MATCH.ball.y = 200; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
  return new Promise(r => setTimeout(() => r(MATCH.ball.vx), 400));
})()`);
check('and pushes the ball the way it is blowing', drift > 40, `vx=${drift?.toFixed(0)}`);

// ═══ 6. THE WHOLE SHOW, ON A PHONE ═════════════════════════════════════════
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&solo=1&play=1&pad=1&stage=temple` });
await sleep(2800);
// A navigate throws the page away, so the probe has to be reinstalled.
await evalJs(`
  window.__px = (wx, wy, ww, wh) => {
    const c = document.getElementById('cv'); const P = 2;
    const d = c.getContext('2d').getImageData(Math.round(wx/P), Math.round(wy/P),
              Math.max(1, Math.round(ww/P)), Math.max(1, Math.round(wh/P))).data;
    let r=0,g=0,b=0,n=0; for (let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
    return { r:r/n, g:g/n, b:b/n };
  };
  MATCH.phase = 'play'; MATCH.freeze = 0;
  MATCH.spec.kind = ACT.METEOR; MATCH.spec.dur = 1800; MATCH.spec.t = 1800; MATCH.spec.drop = 1;
  MATCH.spec.met.length = 0;
  MATCH.spec.met.push(300, Math.round(C.METEOR_WARN * 60 * 0.75), Math.round(C.METEOR_WARN * 60));
  MATCH.spec.met.push(620, Math.round(C.METEOR_WARN * 60 * 0.25), Math.round(C.METEOR_WARN * 60));
  MATCH.score = [0, 3]; MATCH.spec.rb = [2, 600, 0, 0];
  MATCH.players[0].x = 300; MATCH.players[1].x = 620;
  MATCH.ball.x = 470; MATCH.ball.y = C.GROUND_Y - 120;
  MATCH.phase = 'goal'; MATCH.freeze = 30;
  true;
`);
await sleep(500);
await shot('06-phone-meteor-and-robot');
const phone = await evalJs(`(() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  return { w: Math.round(st.width), h: Math.round(st.height),
           scroll: document.body.scrollWidth > innerWidth + 1,
           robot: isRobot(MATCH, 0), rocks: activeMeteors(MATCH).length };
})()`);
check('the phone layout still fits', phone.w <= 844 && phone.h <= 390 && phone.scroll === false,
      `${phone.w}x${phone.h}`);
check('meteors and a robot share the phone frame', phone.rocks === 2 && phone.robot === true,
      `${phone.rocks} rocks, robot=${phone.robot}`);

const errs = logs.filter((l) => /EXCEPTION|Error/i.test(l));
check('no page exceptions', errs.length === 0, errs.slice(0, 3).join(' | '));

ws.close();
chrome.kill();
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_spectacle-shots: ${fails.length} FAILED: ${fails.join(', ')}` : '_spectacle-shots: all checks passed');
process.exit(fails.length ? 1 : 0);
