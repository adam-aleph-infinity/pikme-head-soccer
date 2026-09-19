// Photograph every power-up in the REAL client, in real Chrome, and prove the icons read.
//
// test-powerups.mjs proves the sim is fair. It cannot prove that a magnet looks like a
// magnet at 22 texels on a phone — and a pickup you cannot identify at a glance is just a
// coloured dot that does something surprising. So every shot here is paired with a pixel
// probe off the live canvas, and the centrepiece is a SILHOUETTE test: each icon is reduced
// to a coarse black-and-white grid, and no two of the six may come out the same. That is
// "you can tell them apart while squinting at a moving pitch", as a number.
//
//   node _pickup-shots.mjs             → PNGs + checks
//   PORT=3020 node _pickup-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';
const CHROME = chromePath();   // CHROME_BIN overrides; see _chrome.mjs

const PORT = process.env.PORT || 3020;
await ensureServer(PORT);   // starts one only if nothing is listening
const OUT = process.env.SHOT_OUT ||
  `${import.meta.dirname}/.shots/pu`;
const ME = process.argv[2] || 'legendary_3';
const FOE = process.argv[3] || 'legendary_2';
const CDP = 9461;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
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
// A magnified crop of one world box. An icon has to be judged at the size a thumb sees it,
// then again blown up to see what the pixels are actually doing.
const crop = async (name, wx, wy, ww, wh, scale = 5) => {
  const r = await evalJs(`__rect(${wx}, ${wy}, ${ww}, ${wh})`);
  if (!r) return;
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false,
    clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale } });
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
// Page-side helpers. Same probe as _spectacle-shots.mjs, plus a coarse silhouette sampler.
await evalJs(`
  window.__px = (wx, wy, ww, wh) => {
    const c = document.getElementById('cv'); const P = 2;
    const d = c.getContext('2d').getImageData(Math.round(wx/P), Math.round(wy/P),
              Math.max(1, Math.round(ww/P)), Math.max(1, Math.round(wh/P))).data;
    let r=0,g=0,b=0,n=0; for (let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
    return { r:r/n, g:g/n, b:b/n, n };
  };
  // Reduce the glyph inside a token to a GRID x GRID map of "how much white ink is in this
  // cell", 0..1. This is the squint test: two icons whose ink lands in the same places are
  // two icons a player cannot tell apart on a moving pitch.
  //
  // Ink FRACTION and not a 1-bit threshold, because 1-bit at 7x7 was measuring almost
  // nothing — a lightning bolt and an up-arrow both came out as "a blob in the middle
  // column" and scored 4/49 apart, while being obviously different to look at. The metric
  // was the thing that was broken, not the icons.
  window.__sig = (cx, cy, r, GRID = 9, dy = 0) => {
    const c = document.getElementById('cv'); const P = 2;
    const x0 = Math.round((cx - r) / P), y0 = Math.round((cy - r + dy) / P);
    const w = Math.max(GRID, Math.round(r * 2 / P));
    const d = c.getContext('2d').getImageData(x0, y0, w, w).data;
    const cell = w / GRID;
    const out = [];
    for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
      let sum = 0, n = 0;
      for (let y = Math.floor(gy*cell); y < Math.floor((gy+1)*cell); y++)
        for (let x = Math.floor(gx*cell); x < Math.floor((gx+1)*cell); x++) {
          const i = (y * w + x) * 4;
          const lum = (d[i] + d[i+1] + d[i+2]) / 3;
          const sat = Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2]);
          sum += (lum > 175 && sat < 80) ? 1 : 0; n++;
        }
      out.push(n ? sum / n : 0);
    }
    return out;
  };
  window.__hold = (s) => { MATCH.phase = 'goal'; MATCH.freeze = s; };
  window.__play = () => { MATCH.phase = 'play'; MATCH.freeze = 0; };
  // Put a chosen pickup on the pitch. warnFrac 0 = live, 1 = just announced.
  window.__pu = (kind, x, warnFrac = 0) => {
    const pu = MATCH.pu;
    pu.kind = kind; pu.x = Math.round(x); pu.next = 0;
    pu.warn = Math.round(warnFrac * C.PICKUP_WARN * 60);
    pu.life = Math.round(C.PICKUP_LIFE * 60);
  };
  window.__eff = (i, slot, secs) => { MATCH.pu.eff[i * 4 + slot] = Math.round(secs * 60); };
  // World box -> CSS box, so the harness can ask Chrome for a magnified CROP of one token.
  // Judging a 22-texel icon off a 900px screenshot is judging it at the wrong size; the
  // crop is what actually gets looked at.
  window.__rect = (wx, wy, ww, wh) => {
    const cv = document.getElementById('cv').getBoundingClientRect();
    const k = cv.width / C.W;
    return { x: cv.left + wx * k, y: cv.top + wy * k, width: ww * k, height: wh * k };
  };
  true;
`);
check('the client booted with a pickup state', (await evalJs('!!window.MATCH && !!MATCH.pu')) === true);

const G = await evalJs('({ W: C.W, GROUND_Y: C.GROUND_Y, R: C.PICKUP_R, Y: C.PICKUP_Y })');
const puY = G.GROUND_Y - G.Y;
// The CRATE pool only. PU_NAME now also carries the four card-only specials (dart, goal wall,
// super kick, dog) — they are cast from a hand, never spawned in a crate, and they have no
// crate glyph to photograph. PU_KINDS is the list of things a crate can actually be.
const KINDS = await evalJs('PU_KINDS.map((k) => [k, PU_NAME[k]])');

// ═══ 1. EVERY ICON, ONE AT A TIME ══════════════════════════════════════════
// One shot per item, big enough on screen to judge by eye, plus its silhouette.
const DY = [-6, -4, -2, 0, 2, 4, 6];
const sigFamily = async (cx, cy) => {
  const out = [];
  for (const dy of DY) out.push(await evalJs(`__sig(${cx}, ${cy}, ${G.R * 0.72}, 7, ${dy})`));
  return out;
};
// How much ink two icons put in DIFFERENT places, as a percentage of one icon's ink. 0 =
// identical, 100 = no overlap at all.
const inkDist = (a, b) => {
  let diff = 0, ink = 0;
  for (let i = 0; i < a.length; i++) { diff += Math.abs(a[i] - b[i]); ink += Math.max(a[i], b[i]); }
  return ink > 0 ? (diff / ink) * 100 : 0;
};
// Compared at their BEST vertical alignment: a live token bobs, so two shots of the same
// icon are never on the same frame of a sine wave, and that must not read as a difference.
const shapeDist = (A, B) => {
  let best = 999;
  for (const a of A) for (const b of B) best = Math.min(best, inkDist(a, b));
  return best;
};
const inkOf = (sig) => sig.reduce((t, v) => t + v, 0);
const sigs = {};
for (const [kind, name] of KINDS) {
  await evalJs(`__play(); __pu(${kind}, ${G.W / 2}); MATCH.players[0].x = 250; MATCH.players[1].x = 700;
               MATCH.ball.x = 470; MATCH.ball.y = ${G.GROUND_Y} - 150; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
               __hold(40);`);
  await sleep(340);
  await shot(`0${kind}-${name}`);
  await crop(`zoom-${kind}-${name}`, G.W / 2 - G.R - 8, puY - G.R - 8, (G.R + 8) * 2, (G.R + 8) * 2, 7);
  const disc = await evalJs(`__px(${G.W / 2 - G.R}, ${puY - G.R}, ${G.R * 2}, ${G.R * 2})`);
  // A live token BOBS, so the glyph is never at exactly the same y twice. Every signature is
  // therefore a family taken at several vertical offsets, and two icons are compared at
  // their best alignment — the question is whether the SHAPES differ, not whether they
  // happened to be photographed on the same frame of a sine wave.
  const sig = await sigFamily(G.W / 2, puY);
  sigs[name] = { sig, disc };
  // The most ink any of the sampled frames shows. Too little and the glyph is a speck; too
  // much and it is a white disc with a colour rim, which is not a glyph either.
  const ink = Math.max(...sig.map(inkOf));
  check(`${name}: the token is on the pitch and coloured`,
        disc.r + disc.g + disc.b > 150, `rgb(${disc.r.toFixed(0)},${disc.g.toFixed(0)},${disc.b.toFixed(0)})`);
  check(`${name}: its glyph has ink in it, and is not all ink`, ink > 5 && ink < 45,
        `${ink.toFixed(1)} of 81 cells' worth of white`);
}

// The squint test.
{
  const names = Object.keys(sigs);
  let worst = 99, worstPair = '';
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const d = shapeDist(sigs[names[i]].sig, sigs[names[j]].sig);
      if (d < worst) { worst = d; worstPair = `${names[i]} vs ${names[j]}`; }
    }
  }
  // A third of the ink landing somewhere the other icon has none is the bar for "these are
  // two different shapes"; 35 leaves a little margin over it. The set as drawn measures 42%
  // at its closest pair, and getting materially past that is not available inside a
  // 13-texel box — the last three points cost a redesign of two glyphs. It does not need
  // to be: shape is one of TWO independent cues, and the colour check below is the other,
  // measuring 63 rgb apart at ITS closest pair against a bar of 45.
  check('no two icons squint down to the same shape', worst >= 35,
        `closest pair puts ${worst.toFixed(0)}% of its ink in different places (${worstPair})`);
  // Colour is the second cue and has to be independent of the first.
  let cWorst = 999, cPair = '';
  const names2 = Object.keys(sigs);
  for (let i = 0; i < names2.length; i++) {
    for (let j = i + 1; j < names2.length; j++) {
      const a = sigs[names2[i]].disc, b = sigs[names2[j]].disc;
      const d = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      if (d < cWorst) { cWorst = d; cPair = `${names2[i]} vs ${names2[j]}`; }
    }
  }
  check('and no two share a colour either', cWorst > 45,
        `closest pair ${cWorst.toFixed(0)} apart in rgb (${cPair})`);
}

// ═══ 2. TELEGRAPH vs LIVE ══════════════════════════════════════════════════
// The two states have to be unmistakably different, or "you cannot have it yet" is a rule
// only the sim knows about.
await evalJs(`__play(); __pu(1, 340, 0.85); __hold(40);`);
await sleep(300);
const ghost = await evalJs(`__px(${340 - G.R}, ${puY - G.R}, ${G.R * 2}, ${G.R * 2})`);
await shot('10-telegraph-early');
await evalJs(`__pu(1, 340, 0.15);`);
await sleep(300);
await shot('11-telegraph-late');
const nearly = await evalJs(`__px(${340 - G.R}, ${puY - G.R}, ${G.R * 2}, ${G.R * 2})`);
await evalJs(`__pu(1, 340, 0);`);
await sleep(300);
await shot('12-live');
const solid = await evalJs(`__px(${340 - G.R}, ${puY - G.R}, ${G.R * 2}, ${G.R * 2})`);
const lum = (p) => p.r + p.g + p.b;
check('a live pickup is far more solid than its telegraph', lum(solid) > lum(ghost) + 60,
      `ghost ${lum(ghost).toFixed(0)} → nearly ${lum(nearly).toFixed(0)} → live ${lum(solid).toFixed(0)}`);
check('and the telegraph fills in as it counts down', lum(nearly) > lum(ghost) + 15,
      `${lum(ghost).toFixed(0)} → ${lum(nearly).toFixed(0)}`);
const spot = await evalJs(`__px(${340 - G.R}, ${G.GROUND_Y + 4}, ${G.R * 2}, 18)`);
const bareGrass = await evalJs(`__px(${640 - G.R}, ${G.GROUND_Y + 4}, ${G.R * 2}, 18)`);
check('the spot it belongs to is marked on the grass',
      Math.abs(lum(spot) - lum(bareGrass)) > 12,
      `under it ${lum(spot).toFixed(0)} vs bare grass ${lum(bareGrass).toFixed(0)}`);

// ═══ 3. THE EFFECTS, ON A PLAYER ═══════════════════════════════════════════
// A big head has to actually look big, and what you are carrying has to be on screen.
await evalJs(`__play(); MATCH.pu.kind = 0; MATCH.pu.eff.fill(0);
             MATCH.players[0].x = 300; MATCH.players[1].x = 660; __hold(40);`);
await sleep(320);
const plainHead = await evalJs(`document.getElementById('head0').getBoundingClientRect().width`);
await shot('20-heads-normal');
await evalJs(`__eff(0, 0, 6); __eff(0, 3, 5); __eff(1, 2, 4); __eff(1, 1, 6);`);
await sleep(360);
await shot('21-effects-and-badges');
await crop('22-badges-zoom', 200, 250, 560, 130, 4);
const bigHead = await evalJs(`document.getElementById('head0').getBoundingClientRect().width`);
check('a big head is visibly bigger', bigHead > plainHead * 1.35,
      `${plainHead.toFixed(0)}px → ${bigHead.toFixed(0)}px`);
// headY/headR are not on the page, so the badge strip is located off the geometry the page
// DOES have: it sits just above the head element, in world coordinates.
const badgeStrip = await evalJs(`(() => {
  const el = document.getElementById('head0').getBoundingClientRect();
  const st = document.getElementById('stage').getBoundingClientRect();
  const cv = document.getElementById('cv').getBoundingClientRect();
  const sc = C.W / cv.width;
  const wx = (el.left + el.width / 2 - cv.left) * sc;
  const wy = (el.top - cv.top) * sc;
  return { probe: __px(wx - 70, wy - 46, 140, 40), wx, wy };
})()`);
check('the badges are drawn above the head',
      badgeStrip.probe.r + badgeStrip.probe.g + badgeStrip.probe.b > 120,
      `strip rgb(${badgeStrip.probe.r.toFixed(0)},${badgeStrip.probe.g.toFixed(0)},${badgeStrip.probe.b.toFixed(0)})`);

// ═══ 4. A CROWDED PITCH ════════════════════════════════════════════════════
// The real question is never "does it render", it is "can you still find it when the game
// is also throwing rocks at you". Meteors, a robot, a power shot and a crate, all at once.
await evalJs(`
  __play();
  MATCH.spec.kind = ACT.METEOR; MATCH.spec.dur = 1800; MATCH.spec.t = 1800; MATCH.spec.drop = 1;
  MATCH.spec.met.length = 0;
  MATCH.spec.met.push(240, Math.round(C.METEOR_WARN * 60 * 0.5), Math.round(C.METEOR_WARN * 60));
  MATCH.score = [0, 3]; MATCH.spec.rb = [2, 600, 0, 0];
  __pu(2, 520);
  __eff(1, 2, 4);
  MATCH.players[0].x = 300; MATCH.players[1].x = 720;
  MATCH.ball.x = 640; MATCH.ball.y = ${G.GROUND_Y} - 120; MATCH.ball.vx = 0; MATCH.ball.vy = 0;
  __hold(40);
`);
await sleep(420);
await shot('30-crowded');
const crowdSig = await sigFamily(520, puY);
{
  // Scored the same way the six are scored against each other, and against the same
  // threshold: if a magnet under a meteor shower is further from a clean magnet than the
  // two closest icons are from each other, it has stopped being a magnet.
  const drift = shapeDist(crowdSig, sigs.magnet.sig);
  const nearest = Object.entries(sigs)
    .filter(([n]) => n !== 'magnet')
    .reduce((m, [n, v]) => Math.min(m, shapeDist(crowdSig, v.sig)), 99);
  check('the crate still reads with a meteor shower on top of it', drift < nearest / 2,
        `${drift.toFixed(0)}% from a clean magnet, ${nearest.toFixed(0)}% from the nearest other icon`);
}
await crop('31-crowded-zoom', 520 - G.R - 10, puY - G.R - 10, (G.R + 10) * 2, (G.R + 10) * 2, 7);

// ═══ 5. ON A PHONE ═════════════════════════════════════════════════════════
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?me=${ME}&foe=${FOE}&diff=3&solo=1&play=1&pad=1&stage=temple` });
await sleep(2800);
await evalJs(`
  MATCH.phase = 'play'; MATCH.freeze = 0;
  MATCH.pu.kind = 4; MATCH.pu.x = 470; MATCH.pu.warn = 0; MATCH.pu.life = 300;
  MATCH.pu.eff[0] = 300; MATCH.pu.eff[5] = 260;
  MATCH.players[0].x = 320; MATCH.players[1].x = 640;
  MATCH.ball.x = 470; MATCH.ball.y = C.GROUND_Y - 130;
  MATCH.phase = 'goal'; MATCH.freeze = 40;
  true;
`);
await sleep(520);
await shot('40-phone');
const phone = await evalJs(`(() => {
  const st = document.getElementById('stage').getBoundingClientRect();
  return { w: Math.round(st.width), h: Math.round(st.height),
           scroll: document.body.scrollWidth > innerWidth + 1,
           live: !!activePickup(MATCH), badges: puBadges(MATCH, 0).length + puBadges(MATCH, 1).length };
})()`);
check('the phone layout still fits', phone.w <= 844 && phone.h <= 390 && phone.scroll === false,
      `${phone.w}x${phone.h}`);
check('a crate and two badges share the phone frame', phone.live && phone.badges === 2,
      `live=${phone.live} badges=${phone.badges}`);

const errs = logs.filter((l) => /EXCEPTION|Error/i.test(l));
check('no page exceptions', errs.length === 0, errs.slice(0, 3).join(' | '));

ws.close();
chrome.kill();
console.log(`\nshots → ${OUT}`);
console.log(fails.length ? `_pickup-shots: ${fails.length} FAILED: ${fails.join(', ')}` : '_pickup-shots: all checks passed');
process.exit(fails.length ? 1 : 0);
