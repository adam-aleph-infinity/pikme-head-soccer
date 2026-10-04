// HS's OWN TOUCHES, REPLAYED IN OUR SIM. Every passive touch in the footage (M1–M6: no KICK press by
// the human in the 0.3 s before; the CPU's presses are not on screen, so its touches are kept only
// when the ball meets the head above the boot's reach) is re-staged: our player put where HS's
// head was, moving as it moved (on the grass or in the air), the ball put 3 frames before the
// touch where HS's was, moving as it moved. Then our sim runs and the out angle and speed are
// compared with HS's — same input, so the difference is the physics, not the bots.
//   node _touch-replay.mjs [--list]      TUNE='{"HEAD_BOUNCE":0.8}' node _touch-replay.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { series, detectContacts, launch } from './tools/hs-fit-lib.mjs';
import { load } from './_hs-match-events.mjs';
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
const LIST = process.argv.includes('--list');
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const HEAD0 = headY({ y: C.GROUND_Y });                   // our standing head centre
const deg = (vx, vy) => Math.atan2(-vy, Math.abs(vx)) * 180 / Math.PI;   // up from the horizontal, either way

function hsTouches(name, M = load(name)) {
  const ball = series(M.frames, 'ball');
  const byT = new Map(M.frames.map((f) => [f.t, f]));
  const cs = [...new Set([...detectContacts(ball, { axis: 'y', minDv: 200 }), ...detectContacts(ball, { axis: 'x', minDv: 200 })])].sort((a, b) => a - b);
  const out = []; let last = -1;
  for (const tc of cs) {
    if (tc - last < 0.05) continue; last = tc;
    const k = ball.findIndex((p) => p.t >= tc);
    if (k < 4 || k + 7 >= ball.length) continue;
    if (ball[k + 6].t - ball[k - 4].t > 11.5 / 60) continue;           // a gap in the track
    const b = ball[k - 1], f = byT.get(b.t);
    if (!f?.p0 || !f?.p1) continue;
    const who = Math.hypot(f.p0.x - b.x, f.p0.y - b.y) < Math.hypot(f.p1.x - b.x, f.p1.y - b.y) ? 'p0' : 'p1';
    const h = f[who];
    const near = M.frames.filter((g) => g[who] && Math.abs(g.t - b.t) <= 3.5 / 60 && !g.dup);
    if (near.length < 3) continue;
    const t0 = near[0], t1 = near[near.length - 1], dt = t1.t - t0.t;
    const pvx = (t1[who].x - t0[who].x) / dt, pvy = (t1[who].y - t0[who].y) / dt;
    if (Math.abs(pvx) > 400) continue;                                  // a dash: the push, not a bounce
    const kicked = (who === 'p0' ? M.presses.K : M.presses.K1 || []).some((p) => p.t <= tc + 0.02 && p.t > tc - 0.3);
    if (kicked) continue;
    const hy = h.y - M.standY + HEAD0;                                   // HS's face → our head centre
    const dy = b.y - hy, dx = b.x - h.x, d = Math.hypot(dx / C.HS_STRETCH, dy);
    if (d > 75) continue;                                                // not this player's touch
    if (who === 'p1' && !M.allKicks && dy > -5) continue;                // the CPU's boot may be in it (its presses are not on screen)
    const air = M.standY - h.y > 15;
    const bi = ball[k - 4], vin = { x: (b.x - bi.x) / (b.t - bi.t), y: (b.y - bi.y) / (b.t - bi.t) };
    const l = launch(ball, tc, { n: 7 });
    if (!l || l.speed < 80) continue;
    out.push({ clip: name, t: tc, who, air, zone: dy < -8 ? 'top' : dy < 12 ? 'side' : 'low', hx: h.x, hy, pvx, pvy, bx: b.x, by: b.y, vin, hs: { speed: l.speed, angle: l.angle } });
  }
  return out;
}

// Our sim on the same input: player 0 (head at hx, hy, moving pvx, pvy), the ball at its spot
// 1 frame before the touch (back-stepped along vin), then a few ticks; the ball's velocity once it
// has left the body.
function replay(T) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  m.freeze = 0; m.phase = 'play';
  const P = m.players[0]; m.players[1].x = T.hx < C.W / 2 ? C.W - 120 : 120;
  P.x = T.hx; P.y = Math.min(C.GROUND_Y, T.hy + (C.GROUND_Y - HEAD0)); P.vx = T.pvx * +(process.env.PVX_K ?? 1); P.vy = T.air ? (process.env.PVY != null ? +process.env.PVY : T.pvy) : 0;
  P.onGround = P.y >= C.GROUND_Y - 0.5; if (!P.onGround) P.jumps = 1;
  const b = m.ball; const back = 2 / 60;
  b.x = T.bx - T.vin.x * back; b.y = T.by - T.vin.y * back; b.vx = T.vin.x; b.vy = T.vin.y; b.spin = 0;
  const dir = Math.sign(T.pvx * +(process.env.PVX_K ?? 1)) || 0, input = {};
  if (dir > 0) input.right = true; if (dir < 0) input.left = true;
  let hit = -1, pre = { vx: b.vx, vy: b.vy };
  for (let i = 0; i < 30; i++) {
    step(m, [input, {}]);
    m.events.length = 0;
    const dv = Math.hypot(b.vx - pre.vx, b.vy - pre.vy);
    if (hit < 0 && dv > 150) hit = i;
    pre = { vx: b.vx, vy: b.vy };
    if (hit >= 0 && i >= hit + 2) return { speed: Math.hypot(b.vx, b.vy), angle: deg(b.vx, b.vy) };
  }
  return null;
}

const all = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].flatMap((c) => { try { return hsTouches(c); } catch { return []; } });
const groups = {};
for (const T of all) {
  const r = replay(T);
  if (!r) continue;
  const key = `${T.air ? 'jumping' : 'standing'} ${T.zone}`;
  (groups[key] ??= []).push({ T, r });
  if (LIST) console.log(`${T.clip} ${T.t.toFixed(2)} ${T.who} ${key.padEnd(14)} head v(${T.pvx | 0},${T.pvy | 0}) ball in(${T.vin.x | 0},${T.vin.y | 0}) | HS ${T.hs.speed | 0}@${T.hs.angle | 0}° ours ${r.speed | 0}@${r.angle | 0}°`);
}
console.log('touch            n  | HS angle  ours  diff | HS speed  ours');
let wsum = 0, wn = 0;
for (const [k, v] of Object.entries(groups).sort()) {
  const da = med(v.map((x) => x.r.angle - x.T.hs.angle));
  wsum += Math.abs(da) * v.length; wn += v.length;
  console.log(`${k.padEnd(16)} ${String(v.length).padStart(2)} | ${med(v.map((x) => x.T.hs.angle)).toFixed(0).padStart(5)}°  ${med(v.map((x) => x.r.angle)).toFixed(0).padStart(4)}°  ${da.toFixed(0).padStart(4)}° | ${med(v.map((x) => x.T.hs.speed)).toFixed(0).padStart(6)}  ${med(v.map((x) => x.r.speed)).toFixed(0).padStart(5)}`);
}
const d = Object.values(groups).flat().map((x) => x.r.angle - x.T.hs.angle);
const up = Object.values(groups).flat().filter((x) => x.T.hs.angle > 20).map((x) => x.r.angle - x.T.hs.angle);
console.log(`all ${d.length} touches: median miss ${med(d.map(Math.abs)).toFixed(1)}°, bias ${med(d).toFixed(1)}° | the ${up.length} that go up in HS (>20°): bias ${med(up).toFixed(1)}°, miss ${med(up.map(Math.abs)).toFixed(1)}°`);

// THE INPUTS: how the ball arrives at these touches in HS and in bot-vs-bot matches (the same
// extraction run on our frames), so a difference in the angles that is not the physics shows where it is.
function botFrames(seed) {
  let s = 1234 + seed * 77; const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const bots = [createBot(seed % 2 ? 3 : 2, rng), createBot(seed % 2 ? 1 : 2, rng)];
  const frames = [], K = [], K1 = [];
  for (let i = 0; m.phase !== 'over' && i < 60 * 200; i++) {
    const ins = [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)];
    if (ins[0].kick) K.push({ t: i / 60 }); if (ins[1].kick) K1.push({ t: i / 60 });
    step(m, ins);
    const live = m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0) && !(m.freeze > 0) && !m.ball.power;
    frames.push({ i, t: i / 60, ball: live ? { x: m.ball.x, y: m.ball.y } : null, p0: { x: m.players[0].x, y: headY(m.players[0]) }, p1: { x: m.players[1].x, y: headY(m.players[1]) } });
    m.events.length = 0;
  }
  return { frames, presses: { K, K1 }, allKicks: true, standY: HEAD0 };
}
if (process.argv.includes('--inputs')) {
  const ours = Array.from({ length: 8 }, (_, i) => hsTouches('ours', botFrames(i))).flat();
  const row = (lab, a) => {
    const g = {};
    for (const T of a) (g[`${T.air ? 'jumping' : 'standing'} ${T.zone}`] ??= []).push(T);
    console.log(lab);
    for (const [k, v] of Object.entries(g).sort()) console.log(`  ${k.padEnd(14)} n${String(v.length).padStart(3)} | ball in |vx| ${med(v.map((T) => Math.abs(T.vin.x))).toFixed(0).padStart(4)} vy ${med(v.map((T) => T.vin.y)).toFixed(0).padStart(4)} | head vy ${med(v.map((T) => T.pvy)).toFixed(0).padStart(5)} |vx| ${med(v.map((T) => Math.abs(T.pvx))).toFixed(0).padStart(4)} | ball-head dx ${med(v.map((T) => Math.abs(T.bx - T.hx))).toFixed(0).padStart(3)} dy ${med(v.map((T) => T.by - T.hy)).toFixed(0).padStart(4)} | out ${med(v.map((T) => T.hs.angle)).toFixed(0)}° ${med(v.map((T) => T.hs.speed)).toFixed(0)} | running INTO it ${Math.round(100 * v.filter((T) => Math.abs(T.pvx) > 100 && Math.sign(T.pvx) === Math.sign(T.bx - T.hx)).length / v.length)}% away ${Math.round(100 * v.filter((T) => Math.abs(T.pvx) > 100 && Math.sign(T.pvx) !== Math.sign(T.bx - T.hx)).length / v.length)}% | ball comes from the front ${Math.round(100 * v.filter((T) => Math.sign(T.vin.x) !== Math.sign(T.bx - T.hx) && Math.abs(T.vin.x) > 60).length / v.length)}%`);
  };
  row('HS', all); row('HS: human only', all.filter((T) => T.who === 'p0')); row('HS: CPU only', all.filter((T) => T.who === 'p1')); row('OURS (bot vs bot, same extraction)', ours);
}
if (process.argv.includes('--self')) {
  // Our bot touches put back through replay(): the tool must give our own angles back (a check of
  // the tool), and then the same with the head moving as HS's CPU's does (what the bots change).
  const ours = Array.from({ length: 8 }, (_, i) => hsTouches('ours', botFrames(i))).flat().filter((T) => T.air && T.zone === 'top');
  const rr = ours.map((T) => [T, replay(T)]).filter(([, r]) => r);
  console.log(`self-check, jumping top n${rr.length}: bots ${med(rr.map(([T]) => T.hs.angle)).toFixed(0)}°, replayed ${med(rr.map(([, r]) => r.angle)).toFixed(0)}°, bias ${med(rr.map(([T, r]) => r.angle - T.hs.angle)).toFixed(1)}°`);
}
