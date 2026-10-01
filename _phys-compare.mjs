// PHYSICS SIDE BY SIDE: every ball touch in the HS footage (M1–M5) vs bot matches in our sim,
// through the SAME detector (tools/hs-fit-lib.mjs detectContacts + launch) and the SAME
// geometric classifier (where the ball was against the nearest head when it changed course).
//   node _phys-compare.mjs [matches=6]
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { series, detectContacts, launch, median } from './tools/hs-fit-lib.mjs';
import { load } from './_hs-match-events.mjs';
import { readFileSync } from 'node:fs';
// TUNE='{"BOOT_BOUNCE":0.68}' node _phys-compare.mjs 20 — try constants without editing them
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
// the power shots in the footage (the list _hs-compare.mjs stages), read as text: importing it runs it
const SHOTS = [...readFileSync('./_hs-compare.mjs', 'utf8').matchAll(/video: '([^']+)', hs: \[([^\]]+)\]/g)]
  .map(([, video, hs]) => ({ video, hs: hs.split(',').map(Number) }));

const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function analyse(frames, standY, presses = null, skip = []) {
  const ball = series(frames, 'ball');
  const byT = new Map(frames.map((f) => [f.t, f]));
  const cs = [...new Set([...detectContacts(ball, { axis: 'y', minDv: 200 }), ...detectContacts(ball, { axis: 'x', minDv: 200 })])].sort((a, b) => a - b);
  const out = [];
  let last = -1;
  for (const tc of cs) {
    if (tc - last < 0.05) continue; last = tc;
    if (skip.some(([a, z]) => tc >= a && tc <= z)) continue;   // a power shot on screen
    const k = ball.findIndex((p) => p.t >= tc);
    if (k < 2 || k + 6 >= ball.length) continue;
    if (ball[k + 6].t - ball[k - 2].t > 8.5 / 60) continue;          // a gap in the track, not a touch
    const b = ball[k - 1], f = byT.get(b.t);
    const heads = [f?.p0, f?.p1].filter(Boolean);
    if (heads.length < 2) continue;                       // one player lost by the tracker: the touch could be his
    const h = heads.reduce((a, c) => (Math.hypot(c.x - b.x, c.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? c : a));
    const d = Math.hypot(h.x - b.x, h.y - b.y), dy = b.y - h.y, hdx = b.x - h.x;
    const l = launch(ball, tc, { n: 7 });
    if (!l || l.speed < 80) continue;
    let kind;
    if (d > 110) kind = b.y > C.GROUND_Y - 30 ? 'grass' : 'frame/wall';
    else if (dy < 8 && d < 75) kind = 'head';
    else kind = 'low';                                    // boot, body, dash
    const air = standY - h.y > 15;
    const who = h === f.p0 ? 'p0' : 'p1';
    const near = frames.filter((g) => g[who] && Math.abs(g.t - b.t) <= 3.5 / 60);
    const pvx = near.length > 1 ? (near[near.length - 1][who].x - near[0][who].x) / (near[near.length - 1].t - near[0].t) : 0;
    const dash = Math.abs(pvx) > 600;
    const kicked = presses ? presses.some((p) => p.t <= tc + 0.02 && p.t > tc - 0.3) : null;
    out.push({ t: tc, bx: b.x, dy, hdx, hy: h.y, kind, air, dash, pvx, bh: C.GROUND_Y - b.y, bvx: (b.x - ball[k - 2].x) / (b.t - ball[k - 2].t), kicked, speed: l.speed, angle: l.angle, vin: Math.hypot(b.x - ball[k - 2].x, b.y - ball[k - 2].y) / (b.t - ball[k - 2].t) });
  }
  // live-ball speed, frame to frame (3-frame span), and how high it lives
  const sp = [], ht = [], vxs = [], vys = [], calm = { under: 0, free: 0, grass: 0 };
  for (let i = 1; i + 1 < ball.length; i++) {
    const dt = ball[i + 1].t - ball[i - 1].t;
    if (dt > 3.5 / 60) continue;
    sp.push(Math.hypot(ball[i + 1].x - ball[i - 1].x, ball[i + 1].y - ball[i - 1].y) / dt);
    ht.push(C.GROUND_Y - ball[i].y);
    { const vx = Math.abs(ball[i + 1].x - ball[i - 1].x) / dt; const f = byT.get(ball[i].t);
      if (!f?.p0 || !f?.p1) { /* a player lost: cannot tell */ } else if (vx < 80 && process.env.MID !== "0" || vx < 80 && Math.abs(ball[i].x - C.W / 2) > 70) { if (C.GROUND_Y - ball[i].y < 30) calm.grass++; else if ([f?.p0, f?.p1].some((h) => h && Math.abs(h.x - ball[i].x) < 70 && h.y > ball[i].y)) calm.under++; else { calm.free++; (calm.where ||= []).push([ball[i].x, C.GROUND_Y - ball[i].y, Math.abs(ball[i + 1].y - ball[i - 1].y) / dt]); } } }
    vxs.push(Math.abs(ball[i + 1].x - ball[i - 1].x) / dt); vys.push(Math.abs(ball[i + 1].y - ball[i - 1].y) / dt);
  }
  const secs = ball.length / 60;
  return { touches: out, sp, ht, vxs, vys, calm, secs };
}

function ours(n) {
  const all = { touches: [], sp: [], ht: [], vxs: [], vys: [], calm: { under: 0, free: 0, grass: 0 }, secs: 0, goals: 0 };
  const CH = { rarity: 'legendary', number: 3 };
  for (let s = 0; s < n; s++) {
    let seed = 1234 + s * 77;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const m = createMatch(CH, { rarity: 'legendary', number: 2 }, {});
    const bots = [createBot(s % 2 ? 3 : 2, rng), createBot(s % 2 ? 1 : 2, rng)];
    const frames = [];
    let i = 0;
    while (m.phase !== 'over' && i < 60 * 200) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      const live = m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0) && !(m.freeze > 0);
      const b = m.ball;
      frames.push({ t: i / 60, ball: live && !b.power ? { x: b.x, y: b.y } : null,
        p0: { x: m.players[0].x, y: headY(m.players[0]) }, p1: { x: m.players[1].x, y: headY(m.players[1]) } });
      m.events.length = 0; i++;
    }
    const r = analyse(frames, headY({ y: C.GROUND_Y }));
    all.touches.push(...r.touches); all.sp.push(...r.sp); all.ht.push(...r.ht); all.vxs.push(...r.vxs); all.vys.push(...r.vys); for (const k in r.calm) if (k === 'where') (all.calm.where ||= []).push(...r.calm.where); else all.calm[k] += r.calm[k]; all.secs += r.secs;
    all.goals += m.score[0] + m.score[1];
  }
  return all;
}

// Power-shot cut-ins the list above does not have, found as the screen darkening for 0.8–2 s
// (ffmpeg signalstats YAVG < 0.7 × the clip's median); the shot is on screen ~3 s from there.
const DARK = { M1: [24.42, 33.20, 39.71, 49.13, 60.98, 73.75, 78.98], M2: [41.92, 50.26, 63.55, 70.87, 79.83, 102.61],
  M5: [21.69, 52.70, 71.76], M6: [19.64, 39.24, 56.13] };
const TAIL = { M6: 79.5 };   // M6 ends on the phone's notification centre
function hs() {
  const all = { touches: [], sp: [], ht: [], vxs: [], vys: [], calm: { under: 0, free: 0, grass: 0 }, secs: 0 };
  for (const name of (process.env.CLIPS || 'M1,M2,M3,M4,M5,M6').split(',')) {
    const M = load(name);
    const skip = SHOTS.filter((x) => x.video.startsWith(name + '-')).map((x) => [x.hs[0] - 0.2, x.hs[4] + 1.0])
      .concat((DARK[name] || []).map((t) => [t - 0.3, t + 3.2]), TAIL[name] ? [[TAIL[name], 1e9]] : []);
    // after a goal the ball rattles in the net until the restart (2.8 s): not play, and ours skips it too
    let until = -1;
    const frames = M.frames.map((f) => {
      const b = f.ball;
      if (b && b.y > C.GROUND_Y - C.GOAL_H && (b.x < C.GOAL_W - 8 || b.x > C.W - C.GOAL_W + 8) && f.t > until) until = f.t + 2.8;
      return f.t <= until ? { ...f, ball: null } : f;
    });
    const r = analyse(frames, M.standY, M.presses.K, skip);
    for (const t of r.touches) t.clip = name;
    all.touches.push(...r.touches); all.sp.push(...r.sp); all.ht.push(...r.ht); all.vxs.push(...r.vxs); all.vys.push(...r.vys); for (const k in r.calm) if (k === 'where') (all.calm.where ||= []).push(...r.calm.where); else all.calm[k] += r.calm[k]; all.secs += r.secs;
  }
  return all;
}

const fmt = (a) => a.length ? `n=${String(a.length).padStart(3)}  med ${median(a).toFixed(0).padStart(4)}  p25 ${q(a, 0.25).toFixed(0).padStart(4)}  p75 ${q(a, 0.75).toFixed(0).padStart(4)}  p90 ${q(a, 0.9).toFixed(0).padStart(4)}` : 'n=0';
function report(label, R) {
  console.log(`\n=== ${label}  (${(R.secs / 60).toFixed(1)} min of live ball${R.goals != null ? `, ${R.goals} goals` : ''})`);
  console.log(`ball speed every frame   ${fmt(R.sp)}`);
  console.log(`ball speed share of time  <150: ${(100 * R.sp.filter((v) => v < 150).length / R.sp.length).toFixed(0)}%  150-400: ${(100 * R.sp.filter((v) => v >= 150 && v < 400).length / R.sp.length).toFixed(0)}%  400-700: ${(100 * R.sp.filter((v) => v >= 400 && v < 700).length / R.sp.length).toFixed(0)}%  700+: ${(100 * R.sp.filter((v) => v >= 700).length / R.sp.length).toFixed(0)}%`);
  console.log(`ball sideways |vx|         ${fmt(R.vxs)}\nball vertical |vy|         ${fmt(R.vys)}`);
  console.log(`calm sideways (<80 px/s), share of all frames: over a player ${(100 * R.calm.under / R.sp.length).toFixed(0)}%  free in the air ${(100 * R.calm.free / R.sp.length).toFixed(0)}%  on the grass ${(100 * R.calm.grass / R.sp.length).toFixed(0)}%`);
  if (process.env.WHERE && R.calm.where) { const W = R.calm.where; const bx = Array(8).fill(0), bh = Array(6).fill(0), bv = Array(5).fill(0);
    for (const [x, h, vy] of W) { bx[Math.min(7, Math.max(0, Math.floor(x / 132.5)))]++; bh[Math.min(5, Math.max(0, Math.floor(h / 70)))]++; bv[Math.min(4, Math.floor(vy / 150))]++; }
    const pc = (a) => a.map((c) => (100 * c / W.length).toFixed(0).padStart(3) + '%').join(' ');
    console.log(`   calm-free by x (8 bins wall→wall): ${pc(bx)}\n   by height (70px bins): ${pc(bh)}\n   by |vy| (150 bins): ${pc(bv)}`); }
  console.log(`ball height every frame  ${fmt(R.ht)}   above head-top(${(C.GROUND_Y - headY({ y: C.GROUND_Y }) + C.HEAD_R).toFixed(0)}): ${(100 * R.ht.filter((h) => h > 85).length / R.ht.length).toFixed(0)}%  above 250: ${(100 * R.ht.filter((h) => h > 250).length / R.ht.length).toFixed(0)}%`);
  console.log(`touches/min (player)     ${(R.touches.filter((t) => t.kind === 'head' || t.kind === 'low').length / (R.secs / 60)).toFixed(1)}`);
  for (const kind of ['head', 'low', 'grass', 'frame/wall']) for (const air of [false, true]) {
    const T = R.touches.filter((t) => !t.dash && t.kind === kind && (kind === 'grass' || kind === 'frame/wall' ? !air : t.air === air));
    if (!T.length || ((kind === 'grass' || kind === 'frame/wall') && air)) continue;
    const tag = kind + (kind === 'head' || kind === 'low' ? (air ? ' (jumping)' : ' (standing)') : '');
    console.log(`${tag.padEnd(22)} out speed ${fmt(T.map((t) => t.speed))} | angle med ${median(T.map((t) => t.angle)).toFixed(0)}° | in ${median(T.map((t) => t.vin)).toFixed(0)}`);
  }
  if (R.touches.some((t) => t.kicked != null)) {
    const K = R.touches.filter((t) => t.kicked && (t.kind === 'low' || t.kind === 'head'));
    console.log(`with human KICK press    out speed ${fmt(K.map((t) => t.speed))} | angle med ${median(K.map((t) => t.angle)).toFixed(0)}°`);
  }
  const D = R.touches.filter((t) => t.dash && (t.kind === 'low' || t.kind === 'head'));
  console.log(`dash touches             out speed ${fmt(D.map((t) => t.speed))} | angle med ${median(D.map((t) => t.angle)).toFixed(0)}° | ${(D.length / (R.secs / 60)).toFixed(1)}/min`);
  if (process.env.LIST && R.touches[0]?.clip) for (const t of R.touches.filter((t) => t.kind === process.env.LIST)) console.log('  ', t.clip, t.t.toFixed(2), t.air ? 'air' : 'gnd', t.dash ? 'DASH' : '', 'pvx', t.pvx.toFixed(0), 'out', t.speed.toFixed(0), t.angle.toFixed(0) + '°', 'in', t.vin.toFixed(0), t.kicked ? 'K' : '');
  const band = (T, lo, hi) => (T.filter((t) => t.speed >= lo && t.speed < hi).length / (R.secs / 60)).toFixed(1).padStart(5);
  for (const [lab, T] of [['player touches', R.touches.filter((t) => t.kind === 'low' || t.kind === 'head')], ['  of them low', R.touches.filter((t) => t.kind === 'low')], ['  of them head', R.touches.filter((t) => t.kind === 'head')]])
    console.log(`${lab.padEnd(16)} per min by out speed:  300-600 ${band(T, 300, 600)}  600-900 ${band(T, 600, 900)}  900-1200 ${band(T, 900, 1200)}  1200+ ${band(T, 1200, 1e9)}`);
  const G = R.touches.filter((t) => t.kind === 'low' && !t.air && t.bh < 40 && t.speed > 250);
  const ang = G.map((t) => t.angle);
  console.log(`BALL ON THE GRASS, struck (n=${G.length}): angle med ${median(ang).toFixed(0)}°  <4°: ${(100 * ang.filter((a) => a < 4).length / (G.length || 1)).toFixed(0)}%  4-12°: ${(100 * ang.filter((a) => a >= 4 && a < 12).length / (G.length || 1)).toFixed(0)}%  12-30°: ${(100 * ang.filter((a) => a >= 12 && a < 30).length / (G.length || 1)).toFixed(0)}%  30+: ${(100 * ang.filter((a) => a >= 30).length / (G.length || 1)).toFixed(0)}% | speed med ${median(G.map((t) => t.speed)).toFixed(0)}`);
  if (process.env.GROUND) for (const t of G) console.log('   g', t.clip || '', t.t.toFixed(2), t.dash ? 'DASH' : '    ', 'pvx', t.pvx.toFixed(0).padStart(5), 'ball h', t.bh.toFixed(0).padStart(3), 'bvx', t.bvx.toFixed(0).padStart(5), '→ out', t.speed.toFixed(0).padStart(5), t.angle.toFixed(0).padStart(3) + '°', t.kicked ? 'K' : '');
  { const P = R.touches.filter((t) => t.kind === 'low' || t.kind === 'head' || t.kind === 'frame/wall' || t.kind === 'grass');
    const F = P.filter((t) => Math.abs(t.speed * Math.cos(t.angle * Math.PI / 180)) > 700);
    const lab = (t) => t.dash ? 'dash' : t.kind === 'low' || t.kind === 'head' ? t.kind + (t.air ? '/air' : '/gnd') : t.kind;
    const cnt = {}; for (const t of F) cnt[lab(t)] = (cnt[lab(t)] || 0) + 1;
    console.log(`touches leaving >700 SIDEWAYS: ${(F.length / (R.secs / 60)).toFixed(1)}/min  ` + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / (R.secs / 60)).toFixed(1)}`).join('  ')); }
  if (process.env.FW && R.touches[0]?.clip) for (const t of R.touches.filter((t) => t.kind === 'frame/wall' && Math.abs(t.speed * Math.cos(t.angle * Math.PI / 180)) > 700)) console.log('   fw', t.clip, t.t.toFixed(2), 'x', t.bx.toFixed(0), 'h', t.bh.toFixed(0), 'in', t.vin.toFixed(0), 'bvx', t.bvx.toFixed(0), '→ out', t.speed.toFixed(0), t.angle.toFixed(0) + '°', 'nearest pvx', t.pvx.toFixed(0), 'hdx', t.hdx.toFixed(0), 'dy', t.dy.toFixed(0));
  if (process.env.LA) { const T = R.touches.filter((t) => t.kind === 'low' && t.air && !t.dash);
    if (R.touches[0]?.clip) for (const t of T) console.log('   la', t.clip, t.t.toFixed(2), 'ball vs head dx', t.hdx.toFixed(0), 'dy', t.dy.toFixed(0), 'in', t.vin.toFixed(0), '→', t.speed.toFixed(0), t.angle.toFixed(0) + '°', t.kicked ? 'K' : '');
    else { const b = {}; for (const t of T) { const k = `dy ${Math.floor(t.dy / 15) * 15}`; (b[k] ||= []).push(t.angle); } console.log('   ours low/air angle by dy:', Object.entries(b).sort().map(([k, a]) => `${k}: ${median(a).toFixed(0)}° n${a.length}`).join('  ')); } }
  const fast = R.touches.filter((t) => t.speed > 1200 && (t.kind === 'low' || t.kind === 'head'));
  console.log(`touches leaving >1200    ${fast.length} (${(fast.length / (R.secs / 60)).toFixed(2)}/min)`);
}

report('HEAD SOCCER (M1–M5 footage)', hs());
report('OURS (bot vs bot)', ours(Number(process.argv[2]) || 6));
