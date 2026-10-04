// HOW THE CPU PLAYS, BY STAR RATING: Idan's M7–M11 (Korea against Cameroon 1★, Russia 3★, Italy 4★,
// UK 5★, Germany 5★) beside our arcade champion at the same stars, through the SAME reader: the CPU
// (right side) face track and the ball, live play only (both faces and the ball on screen, no
// cut-in dark).
//   node _hs-cpu-style.mjs [matches=8]
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { stageConfig } from './shared/champions.js';
import { series, detectContacts } from './tools/hs-fit-lib.mjs';
import { load } from './_hs-match-events.mjs';

const N = Number(process.argv[2]) || 8;
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

function style(frames, standY, darks = []) {
  const live = frames.filter((f) => f.ball && f.p0 && f.p1 && !darks.some(([a, z]) => f.t >= a && f.t <= z));
  if (live.length < 100) return null;
  const secs = live.length / 60;
  const depth = live.map((f) => C.W - f.p1.x);
  // in the air: the face more than 15 px over its standing height; a jump is a take-off
  let jumps = 0, air = 0, was = false;
  for (const f of live) { const up = standY - f.p1.y > 15; if (up) air++; if (up && !was) jumps++; was = up; }
  // a dash: the face moving sideways faster than 600 px/s over 3 frames, counted once per burst
  let dashes = 0, inDash = false;
  for (let i = 3; i < live.length; i++) {
    const a = live[i - 3], b = live[i];
    if (b.t - a.t > 0.08) { inDash = false; continue; }
    const v = Math.abs(b.p1.x - a.p1.x) / (b.t - a.t);
    if (v > 600 && !inDash) dashes++;
    inDash = v > 450;
  }
  // touches: a change in the ball's course within 75 px of the CPU's face (and nearer it than the human)
  const ball = series(live, 'ball'), byT = new Map(live.map((f) => [f.t, f]));
  const cs = [...new Set([...detectContacts(ball, { axis: 'y', minDv: 200 }), ...detectContacts(ball, { axis: 'x', minDv: 200 })])].sort((a, b) => a - b);
  let touches = 0, last = -1;
  for (const tc of cs) {
    if (tc - last < 0.1) continue;
    const k = ball.findIndex((p) => p.t >= tc); if (k < 1) continue;
    const f = byT.get(ball[k - 1].t); if (!f) continue;
    const d1 = Math.hypot(f.p1.x - f.ball.x, f.p1.y - f.ball.y), d0 = Math.hypot(f.p0.x - f.ball.x, f.p0.y - f.ball.y);
    if (d1 < 75 && d1 < d0) { touches++; last = tc; }
  }
  // where it stands against the ball: goal-side (between the ball and its own goal) and how far off it
  const inMyHalf = live.filter((f) => f.ball.x > C.W / 2);
  const goalSide = inMyHalf.filter((f) => f.p1.x > f.ball.x).length / Math.max(1, inMyHalf.length);
  const gap = inMyHalf.map((f) => Math.abs(f.p1.x - f.ball.x));
  return {
    min: secs / 60, depth: mean(depth), d25: q(depth, 0.25), d50: q(depth, 0.5), d75: q(depth, 0.75), d90: q(depth, 0.9),
    otherHalf: depth.filter((d) => d > C.W / 2).length / depth.length, air: air / live.length,
    jumps: jumps / (secs / 60), dashes: dashes / (secs / 60), touches: touches / (secs / 60), goalSide, gap: q(gap, 0.5),
  };
}

const row = (name, s) => s ? console.log(`${name.padEnd(26)} ${s.min.toFixed(1)}min | depth mean ${s.depth.toFixed(0).padStart(3)} (p25 ${s.d25.toFixed(0).padStart(3)} p50 ${s.d50.toFixed(0).padStart(3)} p75 ${s.d75.toFixed(0).padStart(3)} p90 ${s.d90.toFixed(0).padStart(3)}) other half ${(100 * s.otherHalf).toFixed(0).padStart(2)}% | in air ${(100 * s.air).toFixed(0).padStart(2)}% jumps ${s.jumps.toFixed(0).padStart(2)}/min dashes ${s.dashes.toFixed(1).padStart(4)}/min touches ${s.touches.toFixed(1).padStart(4)}/min | ball in its half: goal-side ${(100 * s.goalSide).toFixed(0)}%, ${s.gap.toFixed(0)} px off it`) : console.log(name, '—');

// the cut-in darks (screen brightness, measured 2026-10-03): 1.3 s each, plus the 1.2 s after (the shot's flight)
const DARK = {
  M7: [42.8, 46.98, 66.08, 67.71, 86.16, 91.97, 105.8], M8: [23.78, 31.55, 42.15, 48.71, 60.92, 73.88, 80.74, 95.9],
  M9: [28.39, 30.25, 46.01, 51.77, 65.9, 67.84, 83.25, 89.08, 97.27], M10: [28.37, 32.08, 38.29, 46.54, 63.08, 64.67, 84.25],
  M11: [22.71, 27.04, 60.37, 61.9, 81.31, 82.87],
};
console.log('=== HEAD SOCCER (Idan as Korea against the arcade CPU)');
for (const [clip, who] of [['M11', 'Cameroon 1★'], ['M10', 'Russia 3★'], ['M7', 'Italy 4★'], ['M8', 'UK 5★'], ['M9', 'Germany 5★']]) {
  const M = load(clip);
  row(`${clip} ${who}`, style(M.frames, M.standY, DARK[clip].map((t) => [t - 0.1, t + 2.6])));
}

console.log(`=== OURS (the stage's champion against the tier-3 bot standing in for the player, ${N} matches)`);
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const stage of [2, 6, 8, 10, 12, 20]) {
  const cfg = stageConfig(stage), frames = [];
  for (let s = 0; s < N; s++) {
    const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, { ...cfg.matchOpts });
    const bots = [createBot(3, rng(900 + s * 13)), createBot(0, rng(77 + s * 31), cfg.bot)];
    for (let k = 0; k < 60 * 200 && m.phase !== 'over'; k++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      m.events.length = 0;
      const live = m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0) && !(m.freeze > 0) && !(m.cutin > 0) && !m.ball.power;
      frames.push({ t: (s * 60 * 200 + k) / 60, ball: live ? { x: m.ball.x, y: m.ball.y } : null,
        p0: { x: m.players[0].x, y: headY(m.players[0]) }, p1: { x: m.players[1].x, y: headY(m.players[1]) } });
    }
  }
  row(`stage ${stage} ${cfg.champ.hs.stars}★ ${cfg.bot.archetype || ''}`, style(frames, headY({ y: C.GROUND_Y })));
}
