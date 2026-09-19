// IS THE BALL ACTUALLY INSIDE THE GOAL? Run: node _goalshots.mjs
//
// test-goal.mjs can prove the ball is at the depth of the middle of the net. It cannot prove
// you can SEE it there, and "the ball appears outside the goal, on the near side of the net"
// was a report about pixels. So this drives the real client in a real browser, parks a ball
// and a player inside each goal, and reads the canvas back.
//
// THE MEASUREMENT, and why it is not "does it look right":
//
// The near side net is a wash of #0a1220 at 0.10 with 2px white cords over it, and it covers
// the whole panel. So the ball's own white, #f6f9ff, is the tell — it survives only where
// nothing is in front of it:
//
//   ball on the pitch    ~29% of the sample is exactly 246,249,255   nothing in front of it
//   ball in the net      0%                                          ← what we want
//                        every pixel is either washed ball (222,226,233) or a cord over it
//
// Counting an exact colour rather than comparing averages matters: the ball is drawn spinning,
// so its dark panels sit somewhere different in every shot and an average moves with them.
// The second half of the claim is the opposite one — the ball must still be SEEN through the
// net, so half its disc has to come back bright.
//
// It also checks the head layer, which is the one thing a canvas cannot fix: heads are DOM
// nodes above the whole pitch, so the front of the net is stroked again on #cvnet, clipped to
// the head. That layer must be inked over a head standing in the goal and empty otherwise.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromePath } from './_chrome.mjs';
import { ensureServer } from './_serve.mjs';

const CHROME = chromePath();
const PORT = process.env.PORT || 3020, CDP = 9481;
const OUT = process.env.SHOT_OUT || `${import.meta.dirname}/.shots/goal`;
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
  `--user-data-dir=${OUT}/prof-shots`, 'about:blank',
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
// A goal is 92 world px wide on a 1060px pitch. At page scale that is a thumbnail nobody can
// judge a net by, so every full frame gets a blown-up crop of the goal beside it.
const zoom = async (name, left) => {
  await shot(name);
  const box = await evalJs(`JSON.stringify(__rect(${left ? 0 : 'C.W - C.GOAL_W * 1.6'}, C.GROUND_Y - C.GOAL_H * 1.25, C.GOAL_W * 1.6, C.GOAL_H * 1.45))`)
    .then(JSON.parse);
  await shot(`${name}-zoom`, { ...box, scale: 4 });
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 560, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?stage=japan&solo=1&play=1&me=legendary_3&foe=legendary_2` });

for (let i = 0; i < 60; i++) {
  await sleep(200);
  if (await evalJs('typeof MATCH === "object" && MATCH && MATCH.ball ? 1 : 0')) break;
}

// THE PROBE. Everything is read out of the page's own canvases, in world units, through the
// page's own projection — the point is to check what the renderer drew, not to re-derive it
// here and compare two guesses.
await evalJs(`
    window.BOT_OFF = true;
  // Luma stats over a world-space box on either canvas. 'cv' is the pitch; 'cvnet' is the
  // strip of near net that is stroked back over the DOM heads.
  window.__probe = (which, cx, cy, r) => {
    const el = document.getElementById(which);
    const s = el.width / C.W;
    const g = el.getContext('2d');
    const x0 = Math.max(0, Math.round((cx - r) * s)), y0 = Math.max(0, Math.round((cy - r) * s));
    const w = Math.max(1, Math.round(2 * r * s)), h = Math.max(1, Math.round(2 * r * s));
    const d = g.getImageData(x0, y0, w, h).data;
    // THE BALL'S OWN WHITE, #f6f9ff, UNTOUCHED. This is the whole measurement. A ball painted
    // over the net keeps that exact colour across most of its disc; a ball behind the net has
    // none of it anywhere, because the near panel's 0.10 wash of #0a1220 lies over every pixel
    // of it (246,249,255 → 222,226,233) and the cords put white back on top at a different
    // value again. Counting an exact colour beats comparing averages: the ball is drawn
    // spinning, so its dark panels move between two shots and an average moves with them.
    let n = 0, sum = 0, max = 0, bright = 0, inked = 0, pure = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a > 8) inked++;
      if (Math.abs(d[i] - 246) <= 2 && Math.abs(d[i + 1] - 249) <= 2 && Math.abs(d[i + 2] - 255) <= 2) pure++;
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (a / 255);
      n++; sum += l; if (l > max) max = l; if (l > 200) bright++;
    }
    return { n, mean: sum / n, max, bright: bright / n, inked: inked / n, pure: pure / n };
  };
  // Park the world. phase 'kickoff' with no freeze runs the full physics — gravity, bounce,
  // roll, the frame — with the whistle switched off, so a ball may sit in the net without the
  // scoreline resetting it to the centre spot half a frame later.
  window.__park = (ball, p0, p1) => {
    MATCH.phase = 'kickoff'; MATCH.freeze = 0; MATCH.hitStop = 0;
    const b = MATCH.ball;
    b.x = ball[0]; b.y = ball[1]; b.vx = 0; b.vy = 0; b.spin = 0; b.power = null;
    MATCH.players[0].x = p0; MATCH.players[1].x = p1;
    for (const p of MATCH.players) { p.vx = 0; p.vy = 0; p.y = C.GROUND_Y; p.onGround = true; }
  };
  // The head's centre, off the sim's own formula rather than a number copied out of it.
  window.HEAD_Y = (p) => p.y - C.BODY_H - C.HEAD_R + 8;
  // Hold a player against the underside of the crossbar: put them where the jump ends rather
  // than driving the key for a second and hoping the shutter catches the apex. The sim is
  // asked where that is — HELD is the client's own input object, so the jump is real.
  // WHICH DRAWN FRAME MEMBER IS OVER A BODY, and the y of its underside. Two can be, and
  // which one depends on where the body is standing:
  //   the ROOF      only over a body that is actually in the box, and only at that body's own
  //                 depth — the near rail is at z=0, in FRONT of a player at mid-width, and a
  //                 head passing behind it is the picture working rather than failing.
  //   the CROSSBAR  the width-axis member across the mouth, over anything whose drawn x falls
  //                 within its screen span, which is where a player standing at the post is.
  window.__frameAbove = (x, z) => {
    const box = goalBox(true), bar = C.GROUND_Y - C.GOAL_H, out = [];
    const lo = Math.min(box.wallX, box.lineX) + box.wx * z;
    const hi = Math.max(box.wallX, box.lineX) + box.wx * z;
    if (x >= lo && x <= hi) out.push({ what: 'the roof', y: bar + box.wy * z + C.POST_R });
    const t = (x - box.lineX) / box.wx;
    if (t >= 0 && t <= 1) out.push({ what: 'the crossbar', y: bar + box.wy * t + C.POST_R * 0.78 });
    return out;
  };
  window.__jamUnderBar = (x) => {
    MATCH.phase = 'kickoff'; MATCH.freeze = 0; MATCH.hitStop = 0;
    const p = MATCH.players[0];
    p.x = x; p.vx = 0; p.vy = -600; p.onGround = false; p.jumps = 0;
    MATCH.players[1].x = C.W * 0.6;
  };
  // A world box in page pixels, taken off the canvas's own rectangle so it follows whatever
  // fit resize() chose.
  window.__rect = (x, y, w, h) => {
    const r = document.getElementById('cv').getBoundingClientRect();
    const s = r.width / C.W;
    return { x: r.left + x * s, y: r.top + y * s, width: w * s, height: h * s };
  };
  1;
`);

const GEO = await evalJs(`(() => ({
  W: C.W, GOAL_W: C.GOAL_W, GOAL_H: C.GOAL_H, GROUND_Y: C.GROUND_Y, BALL_R: C.BALL_R, POST_R: C.POST_R,
}))()`);
const BAR = GEO.GROUND_Y - GEO.GOAL_H;

// Hold a pose for a few frames so the loop has actually drawn it, then read it back.
const pose = async (js, frames = 8) => {
  await evalJs(js);
  for (let i = 0; i < frames; i++) { await evalJs(js); await sleep(34); }
};
const probe = (which, cx, cy, r) => evalJs(`JSON.stringify(__probe(${JSON.stringify(which)}, ${cx}, ${cy}, ${r}))`).then(JSON.parse);
// Where the ball IS and where the renderer put it, read in one go so the two cannot be a
// frame apart — the loop keeps stepping between evaluations.
const drawnBall = () => evalJs(`(() => { const b = MATCH.ball, d = depthPoint(b.x, b.y);
  return JSON.stringify({ bx: b.x, by: b.y, x: d.x, y: d.y, z: d.z }); })()`).then(JSON.parse);
// A square that stays INSIDE the ball's disc, so the sample is ball and not the grass behind it.
const BALL_BOX = GEO.BALL_R * 0.58;

console.log('\nTHE BALL, OUT ON THE PITCH — the control');
await pose(`__park([${GEO.W / 2}, ${GEO.GROUND_Y - GEO.BALL_R}], 300, 760)`);
await shot('control-pitch');
const cb = await drawnBall();
const control = await probe('cv', cb.x, cb.y, BALL_BOX);
ok('a ball on the open pitch is its own white', control.pure > 0.2, `${(control.pure * 100).toFixed(0)}% untouched`);
ok('…and nothing is drawn in front of it', cb.z === 0, `z=${cb.z}`);
const netOverPitch = await probe('cvnet', GEO.W / 2, GEO.GROUND_Y - GEO.BALL_R, 60);
ok('and the head-net layer is not touching the pitch', netOverPitch.inked === 0, `${(netOverPitch.inked * 100).toFixed(1)}% inked`);

for (const side of ['left', 'right']) {
  const left = side === 'left';
  const deep = left ? GEO.GOAL_W - 50 : GEO.W - GEO.GOAL_W + 50;     // well inside the net
  console.log(`\nTHE ${side.toUpperCase()} GOAL`);

  // 1. A ball resting on the floor of the net.
  await pose(`__park([${deep}, ${GEO.GROUND_Y - GEO.BALL_R}], ${left ? 300 : 300}, 760)`);
  await zoom(`${side}-ball-resting`, left);
  const d = await drawnBall();
  const step = (d.x - d.bx) * (left ? 1 : -1);            // + is a step towards the far net
  ok(`${side}: the ball is drawn off the near plane, into the box`, step > 1,
     `world ${d.bx.toFixed(1)} → drawn ${d.x.toFixed(1)}`);
  ok(`${side}: …and not past the far one`, step < GEO.GOAL_W * 0.40,
     `${step.toFixed(1)}px of the ${(GEO.GOAL_W * 0.4).toFixed(1)}px width`);
  const rest = await probe('cv', d.x, d.y, BALL_BOX);
  ok(`${side}: the ball in the net is BEHIND the near net`, rest.pure < 0.02,
     `${(rest.pure * 100).toFixed(1)}% untouched, against ${(control.pure * 100).toFixed(0)}% in the open`);
  ok(`${side}: …and still clearly visible through it`, rest.bright > 0.25 && rest.max > 200,
     `${(rest.bright * 100).toFixed(0)}% of it is bright, peak ${rest.max.toFixed(0)}`);

  // 2. A ball up in the top corner — the lob, which is how 88% of goals arrive.
  await pose(`__park([${deep}, ${BAR + 50}], 300, 760)`);
  await zoom(`${side}-ball-high`, left);
  const dh = await drawnBall();
  ok(`${side}: a ball under the bar rides the box up`, dh.y < dh.by - 1, `y ${dh.by.toFixed(1)} → ${dh.y.toFixed(1)}`);
  const high = await probe('cv', dh.x, dh.y, BALL_BOX);
  ok(`${side}: …and is behind the near net up there too`, high.pure < 0.02,
     `${(high.pure * 100).toFixed(1)}% untouched`);
  ok(`${side}: …and visible`, high.bright > 0.25, `${(high.bright * 100).toFixed(0)}% bright`);

  // 3. A PLAYER standing in the goal. The body is canvas and goes behind the net with
  //    everything else; the head is a DOM node and needs #cvnet stroked over it.
  const stand = left ? GEO.GOAL_W - 40 : GEO.W - GEO.GOAL_W + 40;
  await pose(`__park([${GEO.W / 2}, ${GEO.GROUND_Y - GEO.BALL_R}], ${left ? stand : 300}, ${left ? 760 : stand})`);
  await zoom(`${side}-player-inside`, left);
  const who = left ? 0 : 1;
  const px = await evalJs(`MATCH.players[${who}].x`);
  const head = await evalJs(`JSON.stringify(depthPoint(MATCH.players[${who}].x, HEAD_Y(MATCH.players[${who}])))`)
    .then(JSON.parse);
  ok(`${side}: the player is standing in the net`,
     left ? px < GEO.GOAL_W : px > GEO.W - GEO.GOAL_W, `x=${px.toFixed(1)}`);
  const overHead = await probe('cvnet', head.x, head.y, 22);
  ok(`${side}: the net is stroked over the head in the goal`, overHead.inked > 0.9,
     `${(overHead.inked * 100).toFixed(1)}% of the head window is netted`);
  const away = await probe('cvnet', GEO.W / 2, GEO.GROUND_Y - 80, 60);
  ok(`${side}: …and nowhere else`, away.inked === 0, `${(away.inked * 100).toFixed(1)}% inked mid-pitch`);

  // 4. …and a defender standing ON the line, which is where a keeper actually stands. The net
  //    has to arrive over the head the way it arrives over the body — the part of it that is
  //    inside the mouth and no more — or a head pops from clean to netted in one frame the
  //    moment its middle crosses.
  const online = left ? GEO.GOAL_W + 18 : GEO.W - GEO.GOAL_W - 18;
  await pose(`__park([${GEO.W / 2}, ${GEO.GROUND_Y - GEO.BALL_R}], ${left ? online : 300}, ${left ? 760 : online})`);
  await zoom(`${side}-player-on-the-line`, left);
  const onLine = await evalJs(`JSON.stringify(depthPoint(MATCH.players[${who}].x, HEAD_Y(MATCH.players[${who}])))`)
    .then(JSON.parse);
  const edge = await probe('cvnet', onLine.x, onLine.y, 22);
  ok(`${side}: a head on the line is netted in part, not in whole`, edge.inked > 0 && edge.inked < 0.6,
     `${(edge.inked * 100).toFixed(1)}% netted`);
}

// ═══ THE CROSSBAR ═════════════════════════════════════════════════════════
//
// Reported: a jump from directly underneath went through the bar, or ended with the head
// buried in it. test-goal.mjs fences off the sim; this is the half only the renderer can get
// wrong — the projection lifts a body inside the net UP the screen, and lifting it into the
// roof would put the head back in the bar with the physics perfectly correct underneath.
//
// Two places, because the bar behaves differently at each and both were broken:
//   inside the net   the bar is overhead, and a jump has to stop against its underside
//   at the post      the bar has ENDED, so the head may rise past its height beside it —
//                    what it may not do is be inside it, which is the capsule's claim
console.log('\nTHE CROSSBAR');
{
  for (const [name, xExpr] of [['inside the net', 'C.GOAL_W - 45'], ['at the post', 'C.GOAL_W + 16']]) {
    for (let i = 0; i < 14; i++) { await evalJs(`__jamUnderBar(${xExpr})`); await sleep(34); }
    const st = await evalJs(`(() => {
      const p = MATCH.players[0], hy = HEAD_Y(p), d = depthPoint(p.x, hy);
      const bar = C.GROUND_Y - C.GOAL_H;
      // How far the head has punched into the bar the BALL bounces off: the capsule laid along
      // y = bar across the goal's depth, radius POST_R. Positive is overlap.
      const nx = Math.max(0, Math.min(p.x, C.GOAL_W));
      return JSON.stringify({
        x: p.x, z: d.z,
        into: (C.HEAD_R + C.POST_R) - Math.hypot(p.x - nx, hy - bar),
        drawnCrown: d.y - C.HEAD_R,
        above: __frameAbove(d.x, d.z),
      });
    })()`).then(JSON.parse);
    await zoom(`crossbar-${name.replace(/ /g, '-')}`, true);
    ok(`crossbar, ${name}: the head is not inside the bar`, st.into <= 0.01,
       `${st.into > 0 ? st.into.toFixed(2) + 'px in' : (-st.into).toFixed(1) + 'px clear'}`);
    ok(`crossbar, ${name}: something is drawn overhead to have stopped it`, st.above.length > 0,
       st.above.map((a) => a.what).join(' + ') || 'nothing');
    for (const a of st.above) {
      ok(`crossbar, ${name}: the head is drawn below ${a.what}`, st.drawnCrown > a.y + 1,
         `crown ${st.drawnCrown.toFixed(1)}, its underside ${a.y.toFixed(1)} → ${(st.drawnCrown - a.y).toFixed(1)}px of daylight`);
    }
  }
}

console.log(`\ngoal shots: ${pass} passed, ${fail} failed  → ${OUT}`);
if (logs.length) console.log('page errors:\n  ' + logs.join('\n  '));
ws.close();
chrome.kill();
if (fail || logs.length) process.exit(1);
