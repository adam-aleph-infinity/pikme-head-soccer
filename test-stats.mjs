// The stats system — HS's five stats at levels 0–10 (docs/HS-STATS.md). Run: node test-stats.mjs
//
// The body is read the way the HS clips were read (docs/hs-clips/M12-base-stats.json): a straight
// line through 12 frames of a run, the jump's parabola (hs-fit-lib jumps), the dash as the ground
// covered while the body moves faster than 700 px/s, the gauge from empty to full. Level 0 has to
// read as HS's level 0 did on M12, and every level as its CURVES entry times it.
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { CURVES, MAX_LEVEL, statsFor, meterRateFor, EQUAL_STATS } from './shared/hs-powers.js';
import { jumps, polyfit } from './tools/hs-fit-lib.mjs';
import * as U from './shared/upgrades.js';
import { stageConfig } from './shared/champions.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const near = (v, want, tol) => Math.abs(v - want) <= tol * want;

// ═══ 1. THE CURVE ═══════════════════════════════════════════════════════════
const { speed: SP, jump: JP, kick: KK, dash: DS, power: PW } = CURVES;
ok('eleven levels, all 1 at 0; at 10: speed 1.75, jump 1.65, kick 1.75, dash 1.45, power 2.75 (HS-STATS.md)', MAX_LEVEL === 10 && Object.values(CURVES).every((c) => c.length === 11 && c[0] === 1) && SP[10] === 1.75 && JP[10] === 1.65 && KK[10] === 1.75 && DS[10] === 1.45 && PW[10] === 2.75);
ok('…the clips\' points: L3 speed 1.225 (HS 1.24), jump 1.195 (1.17), power 1.525 (1.51); L8 speed 1.6 (1.59), jump 1.52 (1.54)', SP[3] === 1.225 && JP[3] === 1.195 && PW[3] === 1.525 && SP[8] === 1.6 && JP[8] === 1.52);
ok('…and every level is more than the one under it', Object.values(CURVES).every((c) => c.every((m, i) => i === 0 || m > c[i - 1])));
const zero = { speed: 0, jump: 0, kick: 0, dash: 0, power: 0 };
ok('level 0 is the base body exactly (EQUAL_STATS)', Object.keys(EQUAL_STATS).every((k) => statsFor(zero)[k] === EQUAL_STATS[k]) && meterRateFor(0) === 1);
ok('a missing or out-of-range level reads as 0 or 10', statsFor({}).speed === 1 && statsFor({ speed: 14 }).speed === 1.75 && statsFor({ speed: -3 }).speed === 1);

// ═══ 2. THE BODY AT A LEVEL, THROUGH THE CLIP DETECTORS ═════════════════════
const lv = (L) => ({ speed: L, jump: L, kick: L, dash: L, power: L });
function body(L) {
  const fresh = () => {
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, { champions: true, stats: [lv(L), null] });
    for (let i = 0; i < 600 && m.phase !== 'play'; i++) step(m, [{}, {}]);
    m.players[1].x = 1000;
    return m;
  };
  const park = (m) => { m.ball.x = 950; m.ball.y = 200; m.ball.vx = 0; m.ball.vy = 0; m.players[1].x = 1000; };
  const record = (m, input, n) => {
    const rec = [];
    for (let k = 0; k < n; k++) { park(m); step(m, [input(k), {}]); const p = m.players[0]; rec.push({ t: k / 60, x: p.x, y: headY(p) }); }
    return rec;
  };
  // run: 12 frames of a steady run
  let m = fresh(); m.players[0].x = 100;
  let rec = record(m, () => ({ right: true }), 60);
  const w = rec.slice(20, 32), run = polyfit(w.map((p) => p.t), w.map((p) => p.x), 1).c[1];
  // jump: one tap from standing
  m = fresh(); m.players[0].x = 300;
  rec = record(m, (k) => ({ jump: k < 2 }), 110);
  const j = jumps(rec, { base: rec[rec.length - 1].y, eps: 3 })[0];
  // dash: tap, release, tap; the ground covered above 700 px/s, a frame either side
  m = fresh(); m.players[0].x = 200;
  rec = record(m, (k) => ({ right: (k >= 10 && k < 13) || (k >= 16 && k < 18) }), 60);
  const sp = rec.map((p, k) => (rec[Math.min(rec.length - 1, k + 1)].x - rec[Math.max(0, k - 1)].x) * 30);
  const a = sp.findIndex((v) => v > 700), b = sp.findIndex((v, k) => k > a && v <= 700);
  const dash = rec[b].x - rec[a - 1].x;
  return { run, apex: j.apex, dash, dashPeak: Math.max(...sp), gauge: 1 / (C.GAUGE_PASSIVE * meterRateFor(L)) };
}
const b0 = body(0);
// HS M12 (level 0): run 195, jump 39.3 px, dash 112 px, the bar full in 18.5 s
ok('level 0 runs HS\'s 195 px/s (M12)', near(b0.run, 195, 0.02), b0.run.toFixed(1));
ok('level 0 jumps HS\'s 39 px (M12 39.3)', near(b0.apex, 39.3, 0.03), b0.apex.toFixed(1));
ok('level 0 dashes HS\'s 112 px (M12)', near(b0.dash, 112, 0.03), b0.dash.toFixed(1));
ok('level 0 fills the gauge in HS\'s 18.5 s (M12)', near(b0.gauge, 18.5, 0.001), b0.gauge.toFixed(2));
for (const L of [1, 3, 5, 7, 10]) {
  const b = body(L), k = SP[L], kj = JP[L], kd = DS[L], kp = PW[L];
  ok(`level ${L} runs ${k}x level 0`, near(b.run, k * b0.run, 0.02), `${b.run.toFixed(1)} vs ${(k * b0.run).toFixed(1)}`);
  ok(`level ${L} jumps ${kj}x as high`, near(b.apex, kj * b0.apex, 0.03), `${b.apex.toFixed(1)} vs ${(kj * b0.apex).toFixed(1)}`);
  ok(`level ${L} dashes ${kd}x as far, in the same 4 ticks`, near(b.dash, kd * b0.dash, 0.03), `${b.dash.toFixed(1)} vs ${(kd * b0.dash).toFixed(1)}`);
  ok(`level ${L} fills the gauge ${kp}x as fast`, near(b.gauge, b0.gauge / kp, 0.001), `${b.gauge.toFixed(2)} s`);
}

// ═══ 3. A LEVEL-10 DASH STILL MEETS THE BALL ════════════════════════════════
// 41 px a tick, 162 px in all: wherever the ball sits along the dash, the body must not pass
// through it (it used to come out behind, dead), and once the dash is over the ball travels no
// faster than a level-0 dash could send it (DASH_BALL_CAP of the BASE dash).
for (const gap of [10, 30, 60, 75, 100, 130, 150]) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, { champions: true, stats: [lv(10), null] });
  for (let i = 0; i < 600 && m.phase !== 'play'; i++) step(m, [{}, {}]);
  const p = m.players[0]; m.players[1].x = 1000; p.x = 200;
  let x0 = 0, after = 0;
  for (let k = 0; k < 30; k++) {
    if (k < 16) { m.ball.x = 227 + gap; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0; }
    x0 = m.ball.x;
    step(m, [{ right: (k >= 10 && k < 13) || (k >= 16 && k < 18) }, {}]);
    if (k >= 22) after = Math.max(after, Math.abs(m.ball.x - x0) * 60);
  }
  ok(`a level-10 dash into a ball ${gap}px ahead sends it on ahead (no tunnelling)`, m.ball.x > p.x && m.ball.vx > 200, `ball ${m.ball.x.toFixed(0)} body ${p.x.toFixed(0)} vx ${m.ball.vx.toFixed(0)}`);
  ok(`…and it travels no faster than a level-0 dash could send it`, after <= C.DASH_BALL_CAP * C.DASH_V + 1, `${after.toFixed(0)} px/s`);
}

// ═══ 4. POINTS, PRICES AND THE SAVE (shared/upgrades.js) ════════════════════
{
  const f = U.freshStats();
  ok('a new player: no points, level 0 on all five stats', f.points === 0 && U.STAT_KEYS.every((k) => f.lv[k] === 0));
  ok('a level costs 500 doubling: 500, 1,000 … 256,000 for the tenth (HS)', U.costOf(1) === 500 && U.costOf(2) === 1000 && U.costOf(10) === 256000);
  ok('…511,500 to take one stat from 0 to 10', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, L) => a + U.costOf(L), 0) === 511500);
  ok('a win over champion n pays 100 × n, a loss nothing', U.award(f, 1, true).gained === 100 && U.award(f, 45, true).gained === 4500 && U.award(f, 45, false).gained === 0 && U.award(f, 45, false).st === f);
  const short = U.buy({ ...f, points: 499 }, 'speed');
  ok('no buying on 499 points', !short.bought && short.st.lv.speed === 0 && short.st.points === 499);
  const rich = { v: 1, points: 600, lv: { ...f.lv } };
  const one = U.buy(rich, 'jump');
  ok('500 buys level 1 and leaves 100', one.bought && one.st.lv.jump === 1 && one.st.points === 100);
  ok('…and never touches the state it was given', rich.points === 600 && rich.lv.jump === 0);
  const maxed = { v: 1, points: 1e9, lv: { ...f.lv, kick: 10 } };
  ok('no buying past level 10', !U.buy(maxed, 'kick').bought && U.nextOf(maxed, 'kick') === null);
  ok('no buying a stat that is not one of the five', !U.buy({ ...rich, points: 1e9 }, 'luck').bought);
  // the save: its own key, round-tripped, and anything odd is a fresh start
  const store = new Map(), S = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const st = { v: 1, points: 1234, lv: { speed: 3, jump: 3, kick: 3, dash: 4, power: 3 } };
  ok('saved under hs.stats.v1, and only that', U.saveStats(S, st) && [...store.keys()].join() === 'hs.stats.v1');
  ok('…and loads back the same', JSON.stringify(U.loadStats(S)) === JSON.stringify(st));
  ok('a corrupt or other-version save is a fresh start', U.parseStats('{oops').points === 0 && U.parseStats({ v: 2, points: 9 }).points === 0);
  ok('levels are clamped to 0–10 and points to whole, positive', JSON.stringify(U.parseStats({ v: 1, points: -5, lv: { speed: 14, jump: -1, kick: 2.5 } })) === JSON.stringify({ v: 1, points: 0, lv: { speed: 10, jump: 0, kick: 0, dash: 0, power: 0 } }));
  ok('no storage at all: a fresh player, and the save says it failed', U.loadStats(null).points === 0 && U.saveStats(null, st) === false);
}

// ═══ 5. THE ARCADE PLAYS THE PLAYER ON THEIR LEVELS ═════════════════════════
{
  const lv = { speed: 3, jump: 0, kick: 10, dash: 4, power: 7 };
  const cfg = stageConfig(5, lv);
  const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, cfg.matchOpts);
  const [me, cpu] = m.players;
  ok('the player runs, kicks and dashes on the levels bought', me.stats.speed === SP[3] && me.stats.kick === KK[10] && me.stats.dash === DS[4] && me.stats.jump === 1);
  ok('…and fills the gauge at the POWER level', me.meterRate === PW[7]);
  ok('the champion keeps its own levels', cpu.stats.speed === SP[5] && cpu.meterRate === PW[cfg.champ.hs.stats.power]);
  const fresh = createMatch({ rarity: 'legendary', number: 3 }, stageConfig(5).champ.card, stageConfig(5).matchOpts);
  ok('no levels given: the player is on level 0, HS\'s base', Object.keys(EQUAL_STATS).every((k) => fresh.players[0].stats[k] === 1) && fresh.players[0].meterRate === 1);
}

console.log(`test-stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
