// Arcade tests — the 45 champions, their powers, the ladder and the save. Run: node test-arcade.mjs
//
// The power checks are behavioural on purpose. "Every power is registered" is one line; what
// matters is that each one DOES its own thing in the sim, for whichever side fires it — so each
// gets a scenario and a measurement, run once with the champion as player 0 (the human's seat)
// and once as player 1 (the bot's).
import { createHash } from 'node:crypto';
import * as C from './shared/constants.js';
import { createMatch, step, serialize, headY, headR } from './shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from './shared/bot.js';
import { launchPowerShot } from './shared/powershots.js';
import { POWERS, POWER_ORDER, EFFECT_TYPES } from './shared/powers.js';
import {
  CHAMPIONS, ARCADE_STAGES, CHAMPION_COUNT, TIERS, championFor, championForStage, botProfile,
  stageConfig, stageDifficulty,
} from './shared/champions.js';
import * as A from './shared/arcade.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TICKS = (s) => Math.round(s / C.TICK);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// ═══ 1. THE ROSTER ══════════════════════════════════════════════════════════
{
  ok('there are exactly 45 champions', CHAMPIONS.length === 45 && CHAMPION_COUNT === 45, `${CHAMPIONS.length}`);
  ok('there are exactly 45 arcade stages', ARCADE_STAGES.length === 45, `${ARCADE_STAGES.length}`);
  ok('and exactly 45 powers in the order', POWER_ORDER.length === 45 && Object.keys(POWERS).length === 45);
  const ids = new Set(CHAMPIONS.map((c) => c.id));
  ok('champion ids are unique', ids.size === 45);
  ok('champion titles are unique', new Set(CHAMPIONS.map((c) => c.title)).size === 45);
  ok('every champion has its own power', new Set(CHAMPIONS.map((c) => c.power)).size === 45);
  for (const [i, s] of ARCADE_STAGES.entries()) {
    const c = CHAMPIONS.find((x) => x.id === s.champion);
    ok(`stage ${i + 1} is numbered in order`, s.stage === i + 1);
    ok(`stage ${s.stage} references a real champion`, !!c && c.stage === s.stage, s.champion);
    ok(`stage ${s.stage} is legendary card ${s.stage}`, c && c.card.rarity === 'legendary' && c.card.number === s.stage);
    ok(`champion ${s.stage} has a registered power`, c && !!POWERS[c.power] && typeof POWERS[c.power].fire === 'function', c?.power);
    ok(`champion ${s.stage} resolves from its card`, championFor({ rarity: 'legendary', number: s.stage }) === c);
    ok(`champion ${s.stage} has a title and a tier`, c && c.title.length > 1 && c.tier >= 0 && c.tier < TIERS.length);
  }
  ok('a card that is not legendary is not a champion', championFor({ rarity: 'epic', number: 3 }) === null);
  // Deterministic: the order is a pure function of the data, identical on every load.
  const again = await import('./shared/champions.js?again');
  ok('stage order is deterministic across loads',
     JSON.stringify(again.ARCADE_STAGES) === JSON.stringify(ARCADE_STAGES) &&
     JSON.stringify(again.CHAMPIONS.map((c) => c.power)) === JSON.stringify(CHAMPIONS.map((c) => c.power)));
  ok('the power order is the champion order', CHAMPIONS.every((c, i) => c.power === POWER_ORDER[i]));
  // The featured cards keep the power their art already is (powershots.js FEATURED).
  ok('the grill card still throws fire', championForStage(3).power === 'blaze');
  ok('the tentacle card still grabs you', championForStage(2).power === 'tentacles');
  ok('the coin card still rains coins', championForStage(6).power === 'coins');
  ok('the red-wave card still rides a wave', championForStage(9).power === 'wave');
  ok('the strike card still strikes', championForStage(18).power === 'strike');
}

// ═══ 2. POWER IDENTITY ══════════════════════════════════════════════════════
{
  const P = POWER_ORDER.map((id) => POWERS[id]);
  ok('power ids match their keys', P.every((p, i) => p.id === POWER_ORDER[i]));
  ok('power names are unique', new Set(P.map((p) => p.name)).size === 45);
  ok('power descriptions are unique', new Set(P.map((p) => p.desc)).size === 45);
  ok('every power has its own fire()', new Set(P.map((p) => p.fire)).size === 45);
  for (const p of P) {
    ok(`${p.id}: has a Hebrew name and description`, /[֐-׿]/.test(p.name) && /[֐-׿]/.test(p.desc));
    ok(`${p.id}: has a kind, a bot arm moment and a style`,
       ['shot', 'effect'].includes(p.kind) && ['attack', 'defend', 'any'].includes(p.arm) && ['striker', 'keeper', 'brawler'].includes(p.style));
    ok(`${p.id}: has colours`, /^#[0-9a-f]{6}$/i.test(p.color) && /^#[0-9a-f]{6}$/i.test(p.glow));
    ok(`${p.id}: a shot has a flight`, p.kind !== 'shot' || typeof p.flight === 'function');
  }
}

// ═══ 3. EVERY POWER, FIRED, DOES ITS OWN THING — FOR EITHER SEAT ════════════
const IDLE = {};
const FOE_CARD = { rarity: 'epic', number: 1 };            // not a champion: nothing of its own

// A scenario: the champion for `stage` in seat `i`, an ordinary card opposite, play running.
// Positions are given as distance from the CHAMPION's own goal side, so one scenario serves
// both seats. The ball is parked out of the way unless a check needs it.
function setup(stage, i, o = {}) {
  const cards = [];
  cards[i] = { rarity: 'legendary', number: stage };
  cards[1 - i] = o.foeCard || FOE_CARD;
  const m = createMatch(cards[0], cards[1], { champions: o.champions ?? true, duration: 600 });
  m.phase = 'play'; m.freeze = 0;
  const p = m.players[i], q = m.players[1 - i];
  const X = (x) => (i === 0 ? x : C.W - x);
  for (const [pl, x] of [[p, o.px ?? 380], [q, o.qx ?? 760]]) {
    pl.x = X(x); pl.y = C.GROUND_Y; pl.vx = pl.vy = 0; pl.onGround = true; pl.facing = pl.side;
  }
  return { m, p, q, X, side: p.side, i, log: [], stage };
}
const b0 = (c) => c.m.ball;
// Park the ball high over halfway, still. Called every tick by checks that are about players.
function park(c) { const b = c.m.ball; b.x = C.W / 2; b.y = C.CEIL_Y + 60; b.vx = 0; b.vy = 0; b.power = null; }

function fire(c) {
  const { m, p } = c;
  p.gauge = 1; p.armed = 1;
  const b = m.ball;
  b.x = p.x + p.side * 4; b.y = headY(p); b.vx = 0; b.vy = 0; b.power = null;
  m.hitStop = 0;
  m.events.length = 0;
  step(m, [IDLE, IDLE]);
  c.log.push(...m.events);
  c.fired = m.events.find((e) => e.type === 'powershot' && e.player === p.index) || null;
  m.events.length = 0;
  m.hitStop = 0;                     // the checks time the power, not the impact pause before it
  return c.fired;
}
// Run `secs` of match. `pIn`/`qIn` are inputs (or functions of elapsed time) for the champion
// and the other player; `each` runs after every tick.
function run(c, secs, { pIn = IDLE, qIn = IDLE, each, parkBall = false } = {}) {
  const { m, p } = c;
  for (let k = 0, n = TICKS(secs); k < n; k++) {
    const t = k * C.TICK;
    if (parkBall) park(c);
    const a = typeof pIn === 'function' ? pIn(t) : pIn;
    const d = typeof qIn === 'function' ? qIn(t) : qIn;
    const inputs = p.index === 0 ? [a, d] : [d, a];
    step(m, inputs);
    c.log.push(...m.events);
    if (each) each(t, m.events);
    m.events.length = 0;
    if (m.phase === 'over') break;
  }
}
const settle = (c) => { c.m.hitStop = 0; };
const has = (c, type, pred = () => true) => c.log.some((e) => e.type === type && pred(e));
const toward = (c, dir) => (c.side * dir > 0 ? { right: true } : { left: true });   // dir +1 = at their goal
// The kick speed a player's boot gives a ball set on the toe, with the ball's own pace zero.
function kickSpeed(c, who) {
  const pl = who === 'p' ? c.p : c.q;
  settle(c);
  let v = null;
  const b = c.m.ball;
  b.power = null; b.vx = 0; b.vy = 0;
  b.x = pl.x + pl.side * C.KICK_REACH; b.y = pl.y - C.BODY_H * 0.45;
  run(c, 0.3, {
    [who === 'p' ? 'pIn' : 'qIn']: (t) => (t < 0.05 ? { kick: true } : IDLE),
    each(t, ev) { if (v === null && ev.some((e) => e.type === 'strike' && e.player === pl.index)) v = Math.abs(b.vx); },
  });
  return v ?? 0;
}
function apex(c, who) {
  const pl = who === 'p' ? c.p : c.q;
  let top = pl.y;
  run(c, 0.9, { parkBall: true, [who === 'p' ? 'pIn' : 'qIn']: { jump: true }, each() { top = Math.min(top, pl.y); } });
  return C.GROUND_Y - top;
}
function runDistance(c, who, secs, dir = 1) {
  const pl = who === 'p' ? c.p : c.q;
  const x0 = pl.x; let vmax = 0;
  run(c, secs, { parkBall: true, [who === 'p' ? 'pIn' : 'qIn']: dir > 0 ? { right: true } : { left: true },
    each() { vmax = Math.max(vmax, Math.abs(pl.vx)); } });
  return { dx: pl.x - x0, vmax };
}
const S = () => C.POWER_SHOT_SPEED;
const attackLine = (side) => (side > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const barTop = () => C.GROUND_Y - C.GOAL_H;

// Each check returns [passed, detail]. `n` is the stage, `i` the champion's seat.
const CHECKS = {
  cannon(n, i) {
    const c = setup(n, i, { qx: 700 }); fire(c);
    let shove = null;
    run(c, 1.2, { each(t, ev) { if (shove === null && ev.some((e) => e.type === 'blocked' && e.player === c.q.index)) shove = c.q.vx * c.side; } });
    return [shove > C.TACKLE_PUSH * 1.5, `blocker thrown back at ${shove?.toFixed(0)}px/s`];
  },
  tentacles(n, i) {
    const c = setup(n, i); fire(c);
    const hop = (t) => ({ jump: Math.floor(t * 10) % 2 === 0 });
    let during = 0, after = 0;
    run(c, 2.6, { parkBall: true, qIn: hop, each() { if (c.q.y < C.GROUND_Y - 2) during++; } });
    run(c, 1.2, { parkBall: true, qIn: hop, each() { if (c.q.y < C.GROUND_Y - 2) after++; } });
    return [during === 0 && after > 0, `airborne ticks during ${during}, after ${after}`];
  },
  blaze(n, i) {
    const c = setup(n, i, { qx: 700 }); fire(c);
    let hpAt = null;
    run(c, 2.6, { each(t, ev) { if (hpAt === null && ev.some((e) => e.type === 'blocked')) hpAt = c.q.hp; } });
    return [hpAt !== null && c.q.hp < hpAt - 0.08, `hp at block ${hpAt?.toFixed(2)} → ${c.q.hp.toFixed(2)} later`];
  },
  mud(n, i) {
    const c = setup(n, i, { qx: 600 }); fire(c);
    let dashes = 0;
    const tap = (t) => (t < 0.05 || t > 0.1 ? { right: true } : IDLE);
    let vmax = 0;
    run(c, 1.0, { parkBall: true, qIn: tap, each(t, ev) { vmax = Math.max(vmax, Math.abs(c.q.vx)); dashes += ev.filter((e) => e.type === 'dash').length; } });
    const normal = C.PLAYER_SPEED * c.q.stats.speed;
    return [vmax < normal * 0.6 && dashes === 0, `top speed ${vmax.toFixed(0)} of ${normal.toFixed(0)}, dashes ${dashes}`];
  },
  goalwall(n, i) {
    const c = setup(n, i); fire(c); settle(c);
    c.p.x = c.X(600); c.q.x = c.X(720);
    const b = b0(c);
    b.power = null; b.x = c.X(260); b.y = C.GROUND_Y - 60; b.vx = -c.side * 700; b.vy = 0;
    run(c, 1.0);
    return [!has(c, 'goal') && has(c, 'wallHit'), `goal ${has(c, 'goal')}, wall ${has(c, 'wallHit')}`];
  },
  coins(n, i) {
    const c = setup(n, i); fire(c);
    run(c, 4.6, { parkBall: true });
    const hits = c.log.filter((e) => e.type === 'coinHit').length;
    return [hits > 0 && c.q.hp < 1, `${hits} coins landed, hp ${c.q.hp.toFixed(2)}`];
  },
  spring(n, i) {
    const ctl = setup(n, i, { champions: false });
    const jumpIn = (t) => ({ jump: t < 0.25 || (t > 0.3 && t < 0.6) });
    let topC = C.GROUND_Y;
    run(ctl, 1.2, { parkBall: true, pIn: jumpIn, each() { topC = Math.min(topC, ctl.p.y); } });
    const c = setup(n, i); fire(c);
    let top = C.GROUND_Y;
    run(c, 1.2, { parkBall: true, pIn: jumpIn, each() { top = Math.min(top, c.p.y); } });
    const jumps = c.log.filter((e) => e.type === 'jump' && e.player === c.p.index).length;
    return [jumps >= 2 && (C.GROUND_Y - top) > (C.GROUND_Y - topC) * 1.25, `${jumps} jumps, apex ${(C.GROUND_Y - top).toFixed(0)} vs ${(C.GROUND_Y - topC).toFixed(0)}`];
  },
  magnet(n, i) {
    const c = setup(n, i, { qx: 900 }); fire(c); settle(c);
    const b = b0(c);
    b.power = null; b.x = c.p.x + c.side * 200; b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
    run(c, 2.0);
    const d = Math.abs(b.x - (c.p.x + c.side * 40));
    return [d < 80, `ball ${d.toFixed(0)}px from the boot`];
  },
  wave(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let lo = Infinity, hi = -Infinity, flips = 0, last = 0;
    run(c, 0.8, { each() { const b = b0(c); if (!b.power) return; lo = Math.min(lo, b.y); hi = Math.max(hi, b.y);
      const s = Math.sign(b.vy); if (s && last && s !== last) flips++; if (s) last = s; } });
    return [hi - lo > 70 && flips >= 2, `swing ${(hi - lo).toFixed(0)}px, ${flips} turns`];
  },
  giant(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true });
    const k = headR(c.m, c.p) / C.HEAD_R;
    return [Math.abs(k - 1.55) < 1e-9, `head ×${k.toFixed(2)}`];
  },
  shrink(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true });
    const k = headR(c.m, c.q) / C.HEAD_R;
    return [Math.abs(k - 0.6) < 1e-9, `their head ×${k.toFixed(2)}`];
  },
  lowgrav(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true }); settle(c);
    const b = b0(c); b.x = C.W / 2; b.y = 150; b.vx = 0; b.vy = 0;
    step(c.m, [IDLE, IDLE]);
    const k = b.vy / (C.BALL_GRAV * C.TICK);
    return [k > 0.3 && k < 0.4, `gravity ×${k.toFixed(2)}`];
  },
  rising(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    const y0 = b0(c).y;
    let rising = true, prev = y0;
    run(c, 0.4, { each() { const b = b0(c); if (b.power) { if (b.y > prev + 0.5) rising = false; prev = b.y; } } });
    return [y0 > C.GROUND_Y - b0(c).r - 14 && rising && prev < y0 - 20, `from y ${y0.toFixed(0)} to ${prev.toFixed(0)}`];
  },
  turbo(n, i) {
    const c = setup(n, i, { qx: 900 }); fire(c);
    const r = runDistance(c, 'p', 0.8, c.side);
    const normal = C.PLAYER_SPEED * c.p.stats.speed;
    return [r.vmax > normal * 1.35, `top speed ${r.vmax.toFixed(0)} vs ${normal.toFixed(0)}`];
  },
  heavy(n, i) {
    const ctl = setup(n, i); const h0 = apex(ctl, 'q');
    const c = setup(n, i); fire(c); const h = apex(c, 'q');
    return [h < h0 * 0.7, `their jump ${h.toFixed(0)}px vs ${h0.toFixed(0)}px`];
  },
  skip(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    // A landing is the flight turning round at the grass: falling one tick, climbing the next.
    // The hop it is sent back up with alternates, low then high, which is the whole shot.
    let prevVy = 0; const hops = [];
    run(c, 1.2, { each() { const b = b0(c); if (!b.power) return;
      if (prevVy > 0 && b.vy < 0 && b.y > C.GROUND_Y - b.r - 20) hops.push(-b.vy);
      prevVy = b.vy; } });
    return [hops.length >= 2 && hops[1] > hops[0] * 1.8,
            `${hops.length} landings, sent back up at ${hops.map((v) => v.toFixed(0)).join(' / ')}px/s`];
  },
  wind(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true }); settle(c);
    const b = b0(c); b.x = C.W / 2; b.y = 150; b.vx = 0; b.vy = 0;
    run(c, 0.3);
    return [b.vx * c.side > 40, `ball blown to ${(b.vx * c.side).toFixed(0)}px/s toward their goal`];
  },
  strike(n, i) {
    const c = setup(n, i, { qx: 700 }); fire(c);
    const v = Math.abs(b0(c).vx) / S();
    let x0 = null;
    run(c, 1.0, { each(t, ev) { if (x0 === null && ev.some((e) => e.type === 'blocked')) x0 = c.q.x; } });
    // …and right after the block the blocker cannot move. Measure from the block, holding a key.
    const c2 = setup(n, i, { qx: 700 }); fire(c2);
    let at = null, moved = null;
    run(c2, 1.4, { qIn: { right: true }, each(t, ev) {
      if (at === null && ev.some((e) => e.type === 'blocked')) at = { t, x: c2.q.x };
      else if (at && moved === null && t - at.t > 0.6) moved = Math.abs(c2.q.x - at.x); } });
    return [v > 1.29 && at !== null && moved !== null && moved < 12, `speed ×${v.toFixed(2)}, moved ${moved?.toFixed(1)}px while paralysed`];
  },
  reverse(n, i) {
    const c = setup(n, i); fire(c);
    const r = runDistance(c, 'q', 0.6, +1);             // holds RIGHT
    return [r.dx < -30, `held right, moved ${r.dx.toFixed(0)}px`];
  },
  freeze(n, i) {
    const c = setup(n, i); fire(c);
    const x0 = c.q.x;
    let air = 0;
    run(c, 0.7, { parkBall: true, qIn: { right: true, jump: true, kick: true }, each() { if (c.q.y < C.GROUND_Y - 1) air++; } });
    return [Math.abs(c.q.x - x0) < 5 && air === 0 && !has(c, 'kick', (e) => e.player === c.q.index), `moved ${(c.q.x - x0).toFixed(1)}px`];
  },
  meteor(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let top = C.GROUND_Y, dived = false;
    run(c, 1.6, { each() { const b = b0(c); if (!b.power) return; top = Math.min(top, b.y); if (top < C.CEIL_Y + 90 && b.vy > 100 && b.vx * c.side > 0) dived = true; } });
    return [top < C.CEIL_Y + 90 && dived, `climbed to y ${top.toFixed(0)}, dived ${dived}`];
  },
  drain(n, i) {
    const c = setup(n, i);
    c.q.gauge = 0.9;
    fire(c); run(c, 0.1, { parkBall: true });
    return [c.q.gauge === 0 && Math.abs(c.p.gauge - 0.54) < 1e-9 && c.q.mods.meterLock === true,
            `their meter ${c.q.gauge}, mine ${c.p.gauge.toFixed(2)}, lock ${c.q.mods.meterLock}`];
  },
  quake(n, i) {
    const c = setup(n, i); fire(c);
    const up = c.q.vy < 0 && !c.q.onGround && b0(c).vy < 0;
    let top = C.GROUND_Y;
    run(c, 0.4, { each() { top = Math.min(top, c.q.y); } });
    return [up && C.GROUND_Y - top > 30, `thrown ${(C.GROUND_Y - top).toFixed(0)}px up`];
  },
  trampoline(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true }); settle(c);
    const b = b0(c); b.x = C.W / 2; b.y = 200; b.vx = 0; b.vy = 0;
    let before = null, ratio = null;
    run(c, 1.5, { each() { if (ratio !== null) return; if (b.vy > 0) before = b.vy; else if (before && b.vy < 0) ratio = -b.vy / before; } });
    return [ratio > 0.95, `rebound ×${ratio?.toFixed(2)} (the ordinary ball keeps ${C.BALL_BOUNCE})`];
  },
  stutter(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let still = 0, maxStill = 0, fast = 0;
    run(c, 1.2, { each() { const b = b0(c); if (!b.power) return; const v = Math.hypot(b.vx, b.vy);
      if (v < 1) { still++; maxStill = Math.max(maxStill, still); } else still = 0; fast = Math.max(fast, v); } });
    return [maxStill * C.TICK > 0.3 && fast > S() * 1.4, `hung ${(maxStill * C.TICK).toFixed(2)}s, then ×${(fast / S()).toFixed(2)}`];
  },
  ice(n, i) {
    // They run toward the champion's goal, which is where the room is.
    const c = setup(n, i, { px: 950, qx: 820 }); fire(c);
    const normal = C.PLAYER_SPEED * c.q.stats.speed;
    const at = c.side > 0 ? { left: true } : { right: true };
    run(c, 0.25, { parkBall: true, qIn: at });
    const early = Math.abs(c.q.vx);
    run(c, 1.6, { parkBall: true, qIn: at });
    const top = Math.abs(c.q.vx);
    run(c, 0.3, { parkBall: true });
    const slide = Math.abs(c.q.vx);
    return [early < normal * 0.45 && slide > top * 0.6, `0.25s in ${early.toFixed(0)}, top ${top.toFixed(0)}, still sliding ${slide.toFixed(0)}`];
  },
  portal(n, i) {
    const c = setup(n, i); fire(c);
    const home = Math.abs(c.q.x - attackLine(c.side));   // how far they now are from their own goal
    return [home > 400 && Math.abs(c.q.x - C.W / 2) < 60 && has(c, 'teleport'), `they landed at halfway, ${home.toFixed(0)}px from their goal`];
  },
  boomerang(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let back = false, fwd = 0;
    run(c, 1.4, { each() { const b = b0(c); if (!b.power) return; if (b.vx * c.side < -50) back = true; fwd = Math.max(fwd, b.vx * c.side); } });
    // …and the return goes IN: the goal is open (the other player is behind the champion).
    run(c, 1.6);
    const scored = has(c, 'goal', (e) => e.player === c.p.index);
    return [back && fwd > S() * 1.3 && scored, `went back ${back}, returned at ×${(fwd / S()).toFixed(2)}, scored ${scored}`];
  },
  drill(n, i) {
    const c = setup(n, i, { qx: 700 }); fire(c);
    let through = false;
    run(c, 1.2, { each() { const b = b0(c); if (b.power && (b.x - c.q.x) * c.side > 20 && has(c, 'drilled')) through = true; } });
    return [has(c, 'drilled') && through && c.q.hp < 1 && !has(c, 'blocked'), `drilled ${has(c, 'drilled')}, through ${through}, hp ${c.q.hp.toFixed(2)}`];
  },
  goalmagnet(n, i) {
    const c = setup(n, i, { px: 200, qx: 300 }); fire(c); settle(c);
    const b = b0(c); b.power = null; b.x = c.X(760); b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
    const x0 = b.x;
    run(c, 1.2);
    const moved = (b.x - x0) * c.side;
    return [has(c, 'goal', (e) => e.player === c.p.index) || moved > 100, `ball pulled ${moved.toFixed(0)}px`];
  },
  keeperpull(n, i) {
    const c = setup(n, i, { qx: 950 }); fire(c);
    const x0 = c.q.x;
    run(c, 2.4, { parkBall: true });
    const pulled = (x0 - c.q.x) * c.side;               // toward the middle = toward the champion
    return [pulled > 250, `dragged ${pulled.toFixed(0)}px off their line`];
  },
  vampire(n, i) {
    const c = setup(n, i);
    c.p.hp = 0.5;
    fire(c);
    const [mine, theirs] = [c.p.hp, c.q.hp];
    run(c, 2.0, { parkBall: true });
    return [Math.abs(theirs - 0.55) < 1e-9 && Math.abs(mine - 0.95) < 0.005 && c.q.hp <= theirs + 1e-9,
            `mine 0.5 → ${mine.toFixed(2)}, theirs 1 → ${theirs.toFixed(2)} → ${c.q.hp.toFixed(2)} (no regen)`];
  },
  superboot(n, i) {
    const v0 = kickSpeed(setup(n, i, { qx: 900 }), 'p');
    const c = setup(n, i, { qx: 900 }); fire(c); run(c, 0.1, { parkBall: true });
    const v = kickSpeed(c, 'p');
    return [v > v0 * 1.3, `kick ${v.toFixed(0)} vs ${v0.toFixed(0)}px/s`];
  },
  woolshoes(n, i) {
    const v0 = kickSpeed(setup(n, i, { qx: 600 }), 'q');
    const c = setup(n, i, { qx: 600 }); fire(c); run(c, 0.1, { parkBall: true });
    const v = kickSpeed(c, 'q');
    return [v < v0 * 0.6, `their kick ${v.toFixed(0)} vs ${v0.toFixed(0)}px/s`];
  },
  homing(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let yAt = null;
    const line = attackLine(c.side);
    run(c, 1.6, { each() { const b = b0(c); if (yAt === null && b.power && (b.x - (line - c.side * 40)) * c.side > 0) yAt = b.y; } });
    return [yAt !== null && yAt < barTop() + 40, `arrived at y ${yAt?.toFixed(0)} (bar ${barTop()}, standing head top ${C.GROUND_Y - 79})`];
  },
  gravflip(n, i) {
    const c = setup(n, i); fire(c); run(c, 0.1, { parkBall: true }); settle(c);
    const b = b0(c); b.x = C.W / 2; b.y = 300; b.vx = 0; b.vy = 0;
    run(c, 0.25);
    return [b.y < 290 && b.vy < 0, `ball rose to y ${b.y.toFixed(0)}`];
  },
  mirror(n, i) {
    const c = setup(n, i, { px: 200, qx: 900 }); fire(c); settle(c);
    const b = b0(c); b.power = null; b.x = c.X(700); b.y = 380; b.vx = -c.side * 600; b.vy = 0;
    let mine = false;
    run(c, 0.8, { each() { if (b.power && b.power.owner === c.p.index && b.vx * c.side > 0) mine = true; } });
    return [has(c, 'mirrored') && mine, `mirrored ${has(c, 'mirrored')}, came back as mine ${mine}`];
  },
  teleport(n, i) {
    const c = setup(n, i, { qx: 500 }); fire(c);
    const b = b0(c);
    const dest = attackLine(c.side) - c.side * 190;
    const hid = !!b.power?.hidden && Math.abs(b.x - dest) < 1;
    run(c, 0.45);
    return [hid && b.power && !b.power.hidden && b.vx * c.side > S(), `appeared at ${dest}, flying ${(b.vx * c.side).toFixed(0)}px/s`];
  },
  carry(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    let far = 0;
    run(c, 0.8, { pIn: toward(c, 1), each() { if (Math.abs(b0(c).x - c.p.x) > 50) far++; } });
    run(c, 0.2, { pIn: (t) => (t < 0.05 ? { ...toward(c, 1), kick: true } : IDLE) });
    const b = b0(c);
    return [far <= 1 && has(c, 'released') && b.power && b.power.owner === c.p.index,
            `stuck ${far === 0}, released as a shot ${!!b.power}`];
  },
  phantom(n, i) {
    const c = setup(n, i, { qx: 700 }); fire(c);
    let past = false;
    run(c, 1.2, { each() { const b = b0(c); if (b.power && (b.x - c.q.x) * c.side > 30) past = true; } });
    return [past && !has(c, 'blocked'), `passed the body ${past}, blocked ${has(c, 'blocked')}`];
  },
  timeslow(n, i) {
    const d0 = runDistance(setup(n, i, { qx: 600 }), 'q', 1.0, +1).dx;
    const c = setup(n, i, { qx: 600 }); fire(c);
    const d = runDistance(c, 'q', 1.0, +1).dx;
    return [Math.abs(d) < Math.abs(d0) * 0.6, `moved ${d.toFixed(0)} vs ${d0.toFixed(0)}px in a second`];
  },
  clone(n, i) {
    const c = setup(n, i); fire(c); settle(c);
    c.p.x = c.X(600); c.q.x = c.X(720);
    const b = b0(c);
    b.x = c.X(300); b.y = headY({ y: C.GROUND_Y }); b.vx = 0; b.vy = 0;
    launchPowerShot(b, c.q, c.q.shot, c.q.side);       // THEIR power shot, at the champion's goal
    run(c, 1.2);
    return [has(c, 'saved', (e) => e.by === 'clone') && !has(c, 'goal'), `saved ${has(c, 'saved')}, goal ${has(c, 'goal')}`];
  },
  split(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    run(c, 0.3);
    const balls = c.m.champ.balls;
    const ups = balls.filter((x) => x.power && x.vy < 0).length, downs = balls.filter((x) => x.power && x.vy > 0).length;
    return [balls.length === 2 && ups === 1 && downs === 1 && b0(c).power, `${balls.length} extra balls (${ups} up, ${downs} down)`];
  },
  tornado(n, i) {
    const c = setup(n, i, { qx: 150 }); fire(c);
    const b = b0(c), x0 = b.x;
    let lifted = false;
    run(c, 1.0, { each() { if (b.y < C.GROUND_Y - 80) lifted = true; } });
    const e = c.m.champ.effects.find((x) => x.type === 'tornado');
    return [!!e && lifted && (b.x - x0) * c.side > 120, `carried ${((b.x - x0) * c.side).toFixed(0)}px, lifted ${lifted}`];
  },
  timestop(n, i) {
    const c = setup(n, i); fire(c);
    const b = b0(c);
    const at = { x: b.x, y: b.y }, q0 = { x: c.q.x, y: c.q.y };
    run(c, 1.0, { qIn: { right: true, jump: true }, pIn: (t) => (t > 0.3 && t < 0.35 ? { kick: true } : IDLE) });
    const held = Math.hypot(b.x - at.x, b.y - at.y) < 0.5 && Math.hypot(c.q.x - q0.x, c.q.y - q0.y) < 0.5;
    run(c, 2.0);                                          // time starts again at 2.2s
    return [held && has(c, 'timeResumes') && Math.hypot(b.x - at.x, b.y - at.y) > 60,
            `held ${held}, then the banked header flew ${Math.hypot(b.x - at.x, b.y - at.y).toFixed(0)}px`];
  },
};

{
  ok('every power has a behaviour check', POWER_ORDER.every((id) => typeof CHECKS[id] === 'function'),
     POWER_ORDER.filter((id) => !CHECKS[id]).join(','));
  for (const champ of CHAMPIONS) {
    for (const seat of [0, 1]) {
      const who = `${champ.stage} ${champ.power} (seat ${seat})`;
      // Fires AS ITSELF: the powershot event names this champion's power, and the ball is either
      // free or this power's own shot — never the generic launchPowerShot ball.
      const c = setup(champ.stage, seat);
      const ev = fire(c);
      ok(`${who}: the touch fires it`, !!ev && ev.champ === champ.power, JSON.stringify(ev));
      ok(`${who}: the meter is spent`, c.p.gauge === 0 && c.p.armed === 0 || champ.power === 'drain');
      const b = c.m.ball;
      ok(`${who}: no generic fallback`, !b.power || b.power.champ === champ.power);
      let res;
      try { res = CHECKS[champ.power](champ.stage, seat); } catch (err) { res = [false, 'threw ' + err.stack]; }
      ok(`${who}: ${POWERS[champ.power].name} does what it says`, res[0], res[1]);
    }
  }
}

// A behavioural fingerprint per power: what firing it leaves in the sim. Two powers that left
// the same thing behind would be one power with two names.
{
  const sig = (id) => {
    const champ = CHAMPIONS.find((c) => c.power === id);
    const c = setup(champ.stage, 0);
    fire(c);
    const b = c.m.ball, pw = b.power;
    const P = POWERS[id];
    const q = c.q;
    return JSON.stringify({
      touch: { ball: [Math.round(b.vx), Math.round(b.vy), !!pw], foe: [Math.round(q.x), Math.round(q.vy), +q.hp.toFixed(3), q.gauge] },
      shot: pw ? { k: pw.k, flags: Object.keys(pw).filter((k) => !['id', 'owner', 'dir', 't', 'life', 'mult', 'color', 'glow', 'shot', 'champ', 'k'].includes(k)).sort(),
        flight: String(P.flight), block: String(P.block), afterBlock: String(P.afterBlock) } : null,
      effects: c.m.champ.effects.map((e) => [e.type, e.life, e.mods, e.field, Object.keys(e).sort()]),
    });
  };
  const sigs = POWER_ORDER.map(sig);
  const dup = sigs.findIndex((s, i) => sigs.indexOf(s) !== i);
  ok('no two powers leave the same thing behind', dup === -1, dup >= 0 ? POWER_ORDER[dup] : '');
  ok('every effect type is used by some power', EFFECT_TYPES.every((t) => sigs.some((s) => s.includes(`"${t}"`)) || ['burn'].includes(t)));
}

// ═══ 4. THE BOTS USE THEIR OWN POWERS ═══════════════════════════════════════
{
  for (const champ of CHAMPIONS) {
    for (const seat of [0, 1]) {
      const rng = mulberry32(champ.stage * 7 + seat);
      const cards = [];
      cards[seat] = champ.card;
      cards[1 - seat] = { rarity: 'legendary', number: champ.stage === 1 ? 2 : 1 };
      const m = createMatch(cards[0], cards[1], { champions: true });
      const bots = [];
      bots[seat] = createBot(0, rng, botProfile(champ));
      bots[1 - seat] = createBot(2, rng);
      let fired = null, t = 0;
      for (let k = 0; k < TICKS(40) && !fired && m.phase !== 'over'; k++) {
        const me = m.players[seat];
        // Hand it a meter once play is under way, as five tackles would.
        if (m.phase === 'play' && me.armed <= 0 && me.gauge < 1 && m.t > 3) me.gauge = 1;
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        fired = m.events.find((e) => e.type === 'powershot' && e.player === seat) || null;
        m.events.length = 0;
        t = m.t;
      }
      ok(`bot ${champ.stage} (${champ.power}, seat ${seat}) arms and fires its own power`,
         !!fired && fired.champ === champ.power, fired ? `${fired.champ} at ${t.toFixed(1)}s` : 'never fired');
    }
  }
}

// ═══ 5. EVERY CHAMPION, A WHOLE MATCH, NOTHING BREAKS ═══════════════════════
//
// Full arcade matches, the champion's own bot against a player-side bot on another champion,
// with both meters topped up every few seconds so powers overlap and collide as often as they
// possibly can. Every number in the state has to stay a number, and the match has to end.
{
  const numbersIn = (m) => {
    const bad = [];
    const scan = (o, path) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path + k);
        else if (v && typeof v === 'object' && k !== 'shot' && k !== 'char' && k !== 'champ' && k !== 'stats') scan(v, path + k + '.');
      }
    };
    scan({ ball: m.ball, players: m.players, extra: m.champ.balls, effects: m.champ.effects }, '');
    return bad;
  };
  let powers = 0;
  for (const champ of CHAMPIONS) {
    const cfg = stageConfig(champ.stage);
    const rng = mulberry32(1000 + champ.stage);
    const opp = CHAMPIONS[(champ.stage + 21) % 45];
    const m = createMatch(opp.card, champ.card, { ...cfg.matchOpts });
    const bots = [createBot(0, rng, botProfile(opp)), createBot(0, rng, cfg.bot)];
    let bad = [], ticks = 0;
    while (m.phase !== 'over' && ticks < TICKS(C.MATCH_DURATION + 120)) {
      if (ticks % TICKS(7) === 0) for (const p of m.players) if (p.armed <= 0) p.gauge = 1;
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      powers += m.events.filter((e) => e.type === 'powershot' && e.champ).length;
      m.events.length = 0;
      ticks++;
      if (ticks % 30 === 0 && !bad.length) bad = numbersIn(m);
    }
    ok(`stage ${champ.stage}: a full match stays finite`, bad.length === 0, bad.slice(0, 4).join(', '));
    ok(`stage ${champ.stage}: the match reaches full time`, m.phase === 'over', `${m.phase} after ${ticks} ticks`);
    ok(`stage ${champ.stage}: and has a winner`, m.score[0] !== m.score[1], m.score.join('-'));
  }
  ok('powers were really used across those matches', powers > 45 * 3, `${powers} champion powers fired`);
}

// ═══ 6. THE DIFFICULTY LADDER ═══════════════════════════════════════════════
{
  const D = CHAMPIONS.map((c) => c.difficulty);
  for (const [i, d] of D.entries()) {
    const n = i + 1;
    ok(`stage ${n}: difficulty is all numbers`, ['react', 'error', 'counter', 'aim', 'powerHold', 'meterRate', 'stars'].every((k) => finite(d[k])));
    ok(`stage ${n}: in range`, d.react > 0 && d.react <= 0.34 && d.error >= 0 && d.aim > 0 && d.aim < 1 &&
       d.counter >= 0 && d.counter < 1 && d.powerHold > 0 && d.meterRate >= 1 && d.stars >= 1 && d.stars <= 5);
    const bp = botProfile(CHAMPIONS[i]);
    ok(`stage ${n}: bot profile is complete`, ['react', 'error', 'counter', 'aggression', 'aim', 'powerHold', 'tackle'].every((k) => finite(bp[k])) && typeof bp.arm === 'string');
    if (i > 0) {
      const p = D[i - 1];
      ok(`stage ${n}: at least as hard as stage ${n - 1}`,
         d.react < p.react && d.error < p.error && d.aim > p.aim && d.counter > p.counter && d.powerHold < p.powerHold && d.stars >= p.stars);
    }
  }
  const first = D[0], last = D[44];
  ok('stage 1 is the bot\'s easiest tier', first.react === DIFFICULTIES[0].react && first.aim === DIFFICULTIES[0].aim && first.error === DIFFICULTIES[0].error);
  ok('stage 45 is short of its hardest (beatable)', last.react > DIFFICULTIES[5].react && last.aim < DIFFICULTIES[5].aim);
  ok('no step between stages is a spike', D.every((d, i) => i === 0 || (D[i - 1].aim - d.aim) > -0.02));
  ok('the campaign starts at one star and ends at five', first.stars === 1 && last.stars === 5);

  // …and the ladder is real on the pitch. Each stage's champion, exactly as the arcade builds
  // it (bot, body, meter, power), against one fixed opponent standing in for the player: the
  // tier-3 bot on legendary 3, power and all. Bot against bot is noisy — one stage over a
  // handful of matches is mostly coin — so what is asserted is the first tier against the last,
  // and the first and last stage against each other, over fixed seeds.
  const vsRef = (stage, n) => {
    const cfg = stageConfig(stage);
    let gd = 0;
    for (let s = 0; s < n; s++) {
      const rng = mulberry32(900 + s * 13);
      const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, { ...cfg.matchOpts });
      const bots = [createBot(3, rng), createBot(0, rng, cfg.bot)];
      for (let k = 0; k < TICKS(200) && m.phase !== 'over'; k++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        m.events.length = 0;
      }
      gd += m.score[1] - m.score[0];
    }
    return gd / n;
  };
  const tier = (t) => { let g = 0; for (let n = t * 9 + 1; n <= t * 9 + 9; n++) g += vsRef(n, 10); return g / 9; };
  const t1 = tier(0), t5 = tier(4);
  ok('the last tier of champions plays harder than the first', t5 > t1 + 0.4, `champion goal difference a match: tier 1 ${t1.toFixed(2)}, tier 5 ${t5.toFixed(2)}`);
  let hi = 0, lo = 0;
  for (let s = 0; s < 16; s++) {
    for (const flip of [false, true]) {
      const rng = mulberry32(500 + s);
      const [A, B] = [stageConfig(45), stageConfig(1)];
      const cards = flip ? [B.champ.card, A.champ.card] : [A.champ.card, B.champ.card];
      const scale = flip ? [B.champ.difficulty.body, A.champ.difficulty.body] : [A.champ.difficulty.body, B.champ.difficulty.body];
      const meter = flip ? [B.champ.difficulty.meterRate, A.champ.difficulty.meterRate] : [A.champ.difficulty.meterRate, B.champ.difficulty.meterRate];
      const m = createMatch(cards[0], cards[1], { champions: true, statScale: scale, meterRate: meter });
      const strong = createBot(0, rng, A.bot), weak = createBot(0, rng, B.bot);
      const bots = flip ? [weak, strong] : [strong, weak];
      for (let k = 0; k < TICKS(200) && m.phase !== 'over'; k++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        m.events.length = 0;
      }
      hi += flip ? m.score[1] : m.score[0];
      lo += flip ? m.score[0] : m.score[1];
    }
  }
  ok('stage 45\'s champion beats stage 1\'s head to head', hi > lo * 1.2, `${hi} : ${lo} over 32 matches`);
}

// ═══ 7. PROGRESS ════════════════════════════════════════════════════════════
{
  const store = () => { const d = new Map(); return { getItem: (k) => (d.has(k) ? d.get(k) : null), setItem: (k, v) => d.set(k, String(v)), d }; };
  let prog = A.freshProgress();
  ok('a new campaign: stage 1 is available', A.stageStatus(prog, 1) === 'available');
  ok('a new campaign: stages 2-45 are locked', Array.from({ length: 44 }, (_, i) => A.stageStatus(prog, i + 2)).every((s) => s === 'locked'));
  ok('only stage 1 can be started', A.canStart(prog, 1) && Array.from({ length: 44 }, (_, i) => A.canStart(prog, i + 2)).every((x) => !x));
  ok('nonsense stages are locked', !A.canStart(prog, 0) && !A.canStart(prog, 46) && !A.canStart(prog, 1.5));

  const locked = A.recordResult(prog, 3, true);
  ok('a locked stage cannot be played — its result is refused', !locked.accepted && locked.prog === prog && locked.prog.cleared === 0);

  const lost = A.recordResult(prog, 1, false);
  ok('losing does not unlock the next stage', lost.accepted && lost.prog.cleared === 0 && A.stageStatus(lost.prog, 2) === 'locked' && lost.unlocked === null);
  ok('losing leaves the stage to retry', A.canStart(lost.prog, 1) && A.stageStatus(lost.prog, 1) === 'available');
  ok('a loss is recorded', lost.prog.record[1].l === 1 && lost.prog.record[1].w === 0);
  ok('the input progress is not mutated', prog.cleared === 0 && !prog.record[1]);

  const won = A.recordResult(lost.prog, 1, true);
  ok('winning unlocks the next stage', won.unlocked === 2 && A.stageStatus(won.prog, 2) === 'available');
  ok('…and only the next stage', A.stageStatus(won.prog, 3) === 'locked' && won.prog.cleared === 1);
  ok('the won stage is completed', A.stageStatus(won.prog, 1) === 'completed' && won.firstClear);

  prog = won.prog;
  for (let n = 2; n <= 10; n++) prog = A.recordResult(prog, n, true).prog;
  const replayLose = A.recordResult(prog, 4, false);
  ok('replaying a completed stage and losing keeps it completed', A.stageStatus(replayLose.prog, 4) === 'completed' && replayLose.prog.cleared === 10);
  const replayWin = A.recordResult(prog, 4, true);
  ok('replaying a completed stage and winning unlocks nothing new', replayWin.unlocked === null && replayWin.prog.cleared === 10);
  ok('stages already beaten do not need replaying', A.currentStage(prog) === 11 && A.canStart(prog, 11));

  const s = store();
  A.saveProgress(s, prog);
  const back = A.loadProgress(s);
  ok('progress survives a reload', back.cleared === 10 && A.stageStatus(back, 10) === 'completed' && A.stageStatus(back, 11) === 'available' && A.stageStatus(back, 12) === 'locked');
  ok('the record survives a reload', back.record[1].l === 1 && back.record[1].w === 1);
  ok('it lives under its own key', [...s.d.keys()].join() === A.ARCADE_KEY && A.ARCADE_KEY === 'hs.arcade.v1');

  ok('an empty device starts fresh', A.loadProgress(store()).cleared === 0);
  const junk = store(); junk.setItem(A.ARCADE_KEY, '{not json');
  ok('a corrupt save starts fresh instead of throwing', A.loadProgress(junk).cleared === 0);
  const liar = store(); liar.setItem(A.ARCADE_KEY, JSON.stringify({ v: 1, cleared: 999, record: { 1: { w: -4 }, 99: { w: 1 }, x: 3 } }));
  const lp = A.loadProgress(liar);
  ok('an impossible save is clamped, not trusted', lp.cleared === 45 && !lp.record[1] && !lp.record[99]);
  const wrongV = store(); wrongV.setItem(A.ARCADE_KEY, JSON.stringify({ v: 7, cleared: 30 }));
  ok('an unknown save version is not guessed at', A.loadProgress(wrongV).cleared === 0);
  ok('a storage that throws starts fresh', A.loadProgress({ getItem() { throw new Error('denied'); } }).cleared === 0);
  ok('and saving to one reports failure rather than throwing', A.saveProgress({ setItem() { throw new Error('full'); } }, prog) === false);
  // Keys the game already writes are not touched by the arcade.
  const shared = store(); shared.setItem('hs.mode.v1', 'duo'); shared.setItem('hs-binds', '{"x":1}');
  A.saveProgress(shared, prog);
  ok('existing saved settings are left exactly as they were', shared.getItem('hs.mode.v1') === 'duo' && shared.getItem('hs-binds') === '{"x":1}');

  let all = A.freshProgress();
  for (let n = 1; n <= 45; n++) {
    const r = A.recordResult(all, n, true);
    if (n === 45) ok('the final stage completes the campaign', r.complete && r.unlocked === null && A.campaignComplete(r.prog));
    all = r.prog;
  }
  ok('a finished campaign opens on the last stage', A.currentStage(all) === 45 && A.stageStatus(all, 45) === 'completed');
}

// ═══ 8. MULTIPLAYER IS UNTOUCHED ════════════════════════════════════════════
//
// The digest below was recorded from this exact script BEFORE the arcade existed — before any
// champion seam went into sim.js or bot.js. It covers every serialized field and every event of
// three whole bot-vs-bot matches, legendary and not, which is what the server runs for a room
// (createMatch(a.card, b.card, {})). If it moves, something outside the arcade changed.
{
  const GOLDEN = '5b6eec39b429defc3135647cf1beee85947a83ca362d194b6ed130cdaa9a0635';
  const h = createHash('sha256');
  const cases = [
    [{ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, 3, 3, 11],
    [{ rarity: 'legendary', number: 45 }, { rarity: 'legendary', number: 1 }, 5, 0, 7],
    [{ rarity: 'epic', number: 7 }, { rarity: 'common', number: 30 }, 1, 4, 99],
  ];
  for (const [a, b, la, lb, seed] of cases) {
    const rng = mulberry32(seed);
    const m = createMatch(a, b, {});
    const bots = [createBot(la, rng), createBot(lb, rng)];
    for (let t = 0; t < 60 * 90 && m.phase !== 'over'; t++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      h.update(JSON.stringify(serialize(m)));
      h.update(JSON.stringify(m.events));
      m.events.length = 0;
    }
    h.update(JSON.stringify(m.score));
  }
  ok('the non-arcade sim is bit-for-bit what it was before the arcade', h.digest('hex') === GOLDEN);

  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  ok('a match without the arcade flag has no champions', m.champ === undefined && m.players.every((p) => p.champ === undefined && p.mods === undefined));
  ok('and every head is the constant size', m.players.every((p) => headR(m, p) === C.HEAD_R));
  ok('a legendary card online still fires its ordinary power shot', (() => {
    const p = m.players[0]; m.phase = 'play'; m.freeze = 0;
    p.gauge = 1; p.armed = 1; m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = m.ball.vy = 0;
    step(m, [IDLE, IDLE]);
    return m.ball.power && !m.ball.power.champ && m.events.some((e) => e.type === 'powershot' && !e.champ);
  })());
  ok('the snapshot schema is unchanged', JSON.stringify(Object.keys(serialize(m))) === JSON.stringify(['t', 'clock', 'phase', 'freeze', 'hitStop', 'idle', 'score', 'golden', 'lastScorer', 'p', 'b']) &&
     serialize(m).p[0].length === 25);
  ok('an ordinary bot is still exactly its tier', createBot(3).d === DIFFICULTIES[3]);
}

console.log(`test-arcade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
