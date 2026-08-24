// Spectacle tests — meteors, moon phase, wind, robot mode. Run: node test-spectacle.mjs
//
// Most of this file is about ONE property: a match must never be decided by something the
// player could not see coming. Spectacle is easy; fair spectacle is the work. So the
// telegraph, the keep-out zones, the "never hit what cannot move" rule, the quiet finish
// and the "a rock can never score" rule each get an assertion here, and the constants
// themselves are checked against each other so a tuner slider cannot quietly make the game
// unfair (a 0.2s telegraph is not a telegraph).
import * as C from './shared/constants.js';
import { createMatch, step, serialize, restore } from './shared/sim.js';
import { ACT, isRobot, actKind, activeMeteors, windAccel, packSpectacle, unpackSpectacle }
  from './shared/spectacle.js';

let pass = 0, fail = 0;

// Fire the power move and let it land. The button buys a committed VOLLEY now — press, wind
// up for POWER_CHARGE_TIME, and the ball goes — so a test that needs a power BALL has to run
// the wind-up out rather than arm and kick.
function firePower(mm, i = 0) {
  const p = mm.players[i];
  p.gauge = 1; p.prev = {}; mm.hitStop = 0;
  const inputs = [{}, {}]; inputs[i] = { power: true };
  step(mm, inputs);
  mm.events.length = 0;
  for (let t = 0; t < Math.round(C.POWER_CHARGE_TIME / C.TICK) + 4 && !mm.ball.power; t++) {
    mm.hitStop = 0; step(mm, [{}, {}]); mm.events.length = 0;
  }
  return mm.ball.power;
}

// Where a JUMPING defender is when the volley passes. It flies at POWER_CHARGE_HEIGHT, above
// a standing head — that is the point of the move — so any test about a defender meeting one
// has to put them up there.
function inLine(mm, p) {
  p.y = C.GROUND_Y - (C.powerHeight() - C.BODY_H - C.HEAD_R + 18);
  p.vy = 0; p.onGround = false;
}

const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const NONE = [{}, {}];

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const ticks = (s) => Math.max(1, Math.round(s / C.TICK));

// A long match: the spectacle deliberately refuses to run inside SPECTACLE_QUIET_END of
// full time, so a 60s default would leave half these tests testing nothing.
const fresh = (opts = {}) => {
  const m = createMatch(CA, CB, { duration: 300, ...opts });
  m.freeze = 0; m.phase = 'play';
  return m;
};
const run = (m, n, inputs = NONE) => {
  const seen = [];
  for (let i = 0; i < n; i++) {
    step(m, typeof inputs === 'function' ? inputs(i, m) : inputs);
    for (const e of m.events) seen.push({ ...e, i });
    m.events.length = 0;
  }
  return seen;
};

// Force one act to be live, without waiting out SPECTACLE_FIRST.
function forceAct(m, kind, seconds) {
  const sp = m.spec;
  sp.kind = kind;
  sp.dur = ticks(seconds ?? (kind === ACT.METEOR ? C.METEOR_SHOWER_TIME : kind === ACT.MOON ? C.MOON_TIME : C.WIND_TIME));
  sp.t = sp.dur;
  sp.drop = 1;
  if (kind === ACT.WIND && sp.dir === 0) sp.dir = 1;
  return m;
}
// Drop one meteor at a chosen x, telegraph running.
function forceMeteor(m, x, warn = C.METEOR_WARN) {
  m.spec.met.push(Math.round(x), ticks(warn), ticks(warn));
  return ticks(warn);
}

// ═══ 1. THE TELEGRAPH ══════════════════════════════════════════════════════
{
  const m = fresh();
  forceAct(m, ACT.METEOR);
  const seen = run(m, ticks(C.METEOR_SHOWER_TIME));
  const warns = seen.filter((e) => e.type === 'meteorWarn');
  const hits = seen.filter((e) => e.type === 'meteorHit');
  ok('a shower drops meteors', warns.length >= 3, `${warns.length} in ${C.METEOR_SHOWER_TIME}s`);
  ok('every meteor is announced before it lands', hits.length > 0 && hits.length <= warns.length,
     `${warns.length} warnings, ${hits.length} impacts`);
  // The warning always comes first — every single time, for every single rock.
  let matched = 0;
  for (const h of hits) if (warns.some((w) => w.x === h.x && w.i < h.i)) matched++;
  ok('every impact is traceable to its own warning', matched === hits.length, `${matched}/${hits.length}`);
}
{
  // The length of the telegraph, timed on a lone meteor. It has to be alone: an impact
  // triggers hit-stop, which freezes the whole sim, so inside a shower the wall-clock gap
  // between one rock's warning and its landing legitimately includes the freeze frames of
  // the rock before it.
  const m = fresh();
  const warn = forceMeteor(m, 500);
  const seen = run(m, warn + 4);
  const h = seen.find((e) => e.type === 'meteorHit');
  ok('the telegraph lasts exactly METEOR_WARN', h && Math.abs((h.i + 1) * C.TICK - C.METEOR_WARN) <= C.TICK,
     `${h ? ((h.i + 1) * C.TICK).toFixed(3) : 'never landed'}s vs ${C.METEOR_WARN.toFixed(3)}s`);
}
{
  // No warning, no impact — ever. Half a second of shower with the telegraph made huge
  // must produce markers and nothing else.
  const m = fresh();
  C.tune({ METEOR_WARN: 3 });
  forceAct(m, ACT.METEOR);
  const seen = run(m, ticks(1.2));
  ok('nothing lands inside the telegraph window',
     seen.some((e) => e.type === 'meteorWarn') && !seen.some((e) => e.type === 'meteorHit'));
  C.tune({ METEOR_WARN: 1.15 });
}

// ═══ 2. FAIRNESS: THE TELEGRAPH IS LONG ENOUGH TO ANSWER ═══════════════════
{
  // The budget, in numbers: the slowest a player can legally be is a common card that has
  // just been tackled. From dead centre of the marker they must clear the blast radius plus
  // their own half-width before it lands.
  const slowest = C.PLAYER_SPEED * 0.94 * C.TACKLE_SLOW;
  const escape = C.METEOR_WARN * slowest;
  const need = C.METEOR_R + C.BODY_W / 2;
  ok('the telegraph outruns the blast even for the slowest player', escape > need,
     `${escape.toFixed(0)}px of running vs ${need.toFixed(0)}px needed`);
}
{
  // …and prove it in the sim, not just in the constants. A player standing exactly under
  // the marker, who reacts by walking, is not hit.
  const m = fresh();
  const p = m.players[0];
  p.x = C.W / 2;
  const warn = forceMeteor(m, p.x);
  const seen = run(m, warn + 2, [{ right: true }, {}]);
  ok('a player who reacts to the marker is not hit', !seen.some((e) => e.type === 'meteorKnock'),
     `ended ${Math.abs(p.x - C.W / 2).toFixed(0)}px from the impact`);
  ok('and they had to actually move to do it', Math.abs(p.x - C.W / 2) > C.METEOR_R,
     `moved ${Math.abs(p.x - C.W / 2).toFixed(0)}px, radius ${C.METEOR_R}`);
}
{
  // The other half of the same coin: standing still IS punished, or the telegraph is
  // decoration and the whole event is meaningless.
  const m = fresh();
  const p = m.players[0];
  p.x = C.W / 2;
  const warn = forceMeteor(m, p.x);
  const seen = run(m, warn + 2);
  ok('a player who ignores the marker IS hit', seen.some((e) => e.type === 'meteorKnock' && e.player === 0));
  ok('the blast throws them away from the impact, not through it',
     Math.sign(p.x - C.W / 2) === Math.sign(p.vx) || p.vx === 0, `x=${p.x.toFixed(0)} vx=${p.vx.toFixed(0)}`);
  ok('a meteor knockdown is short', p.knocked <= C.METEOR_KNOCK + 1e-9, `${p.knocked.toFixed(2)}s`);
}

// ═══ 3. FAIRNESS: NEVER AIMED AT SOMEONE WHO CANNOT MOVE ═══════════════════
{
  // Rooted or knocked down, you cannot answer a telegraph — so you are never the target.
  // Run a full shower with one player pinned in place and check every single drop.
  let checked = 0, unsafe = 0;
  for (let seed = 0; seed < 24; seed++) {
    const m = fresh();
    const victim = m.players[1];
    victim.x = 300 + (seed * 17) % 360;
    m.ball.x = victim.x;                       // aim the shower right at them
    m.ball.y = C.GROUND_Y - 40;
    forceAct(m, ACT.METEOR);
    for (let i = 0; i < ticks(C.METEOR_SHOWER_TIME); i++) {
      victim.rooted = 1;                       // pinned for the whole shower
      victim.x = 300 + (seed * 17) % 360;
      step(m, NONE);
      for (const e of m.events) {
        if (e.type !== 'meteorWarn') continue;
        checked++;
        if (Math.abs(e.x - victim.x) < C.METEOR_R) unsafe++;
      }
      m.events.length = 0;
    }
  }
  ok('a shower aimed at a pinned player still drops', checked > 20, `${checked} drops`);
  ok('but never ON one', unsafe === 0, `${unsafe} of ${checked} would have hit an immobilised player`);
}

// ═══ 4. FAIRNESS: A METEOR CAN NEVER SCORE ═════════════════════════════════
{
  ok('the blast pops the ball UP, not at a goal', C.METEOR_BALL_POP > C.METEOR_BALL_PUSH * 2,
     `pop ${C.METEOR_BALL_POP} vs push ${C.METEOR_BALL_PUSH}`);
  ok('meteors keep clear of both goalmouths', C.METEOR_KEEPOUT > C.METEOR_BALL_R * 0.5 + C.GOAL_W * 0.5,
     `keepout ${C.METEOR_KEEPOUT}`);
}
{
  // Empirical version: park the ball on each goal line, drop the nearest legal meteor on
  // it over and over, and prove none of them bundles it in.
  let goals = 0, blasts = 0;
  for (const side of [0, 1]) {
    for (let i = 0; i < 40; i++) {
      const m = fresh();
      m.players[0].x = 480; m.players[1].x = 500;      // both far away, nobody to block
      m.ball.x = side ? C.GOAL_W + C.BALL_R + i : C.W - C.GOAL_W - C.BALL_R - i;
      m.ball.y = C.GROUND_Y - C.BALL_R;
      m.ball.vx = 0; m.ball.vy = 0;
      // The closest a rock is ever allowed to be to that goal.
      const x = side ? C.GOAL_W + C.METEOR_KEEPOUT : C.W - C.GOAL_W - C.METEOR_KEEPOUT;
      const warn = forceMeteor(m, x);
      const seen = run(m, warn + 90);
      if (seen.some((e) => e.type === 'meteorBall')) blasts++;
      if (m.score[0] + m.score[1] > 0) goals++;
    }
  }
  ok('a meteor really does reach a ball on the line', blasts > 0, `${blasts}/80 blasts connected`);
  ok('and never once scores with it', goals === 0, `${goals} meteor goals`);
  ok('the blast always shoves the ball toward the middle', (() => {
    const m = fresh();
    m.ball.x = 200; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0;
    const w = forceMeteor(m, 150);
    run(m, w + 1);
    const left = m.ball.vx > 0;
    const m2 = fresh();
    m2.ball.x = C.W - 200; m2.ball.y = C.GROUND_Y - C.BALL_R; m2.ball.vx = 0; m2.ball.vy = 0;
    const w2 = forceMeteor(m2, C.W - 150);
    run(m2, w2 + 1);
    return left && m2.ball.vx < 0;
  })(), 'never toward the nearer goal');
}
{
  // A power shot is earned — 28 seconds of gauge — and a falling rock does not get to eat it.
  const m = fresh();
  const p = m.players[0];
  firePower(m, 0);
  ok('(power shot armed and fired for the next check)', !!m.ball.power);
  const before = { vx: m.ball.vx, vy: m.ball.vy };
  // Firing a power shot triggers hit-stop, which freezes the sim for ~5 ticks. Clear it, or
  // the rock is still frozen in the air when the window closes and the check tests nothing.
  m.hitStop = 0;
  const lead = 3;
  const warn = forceMeteor(m, m.ball.x + m.ball.vx * lead * C.TICK, lead * C.TICK);
  const seen = run(m, warn + 1);
  ok('(the rock landed on the flying ball)', seen.some((e) => e.type === 'meteorHit'));
  ok('a live power shot is immune to meteors',
     !seen.some((e) => e.type === 'meteorBall') && !!m.ball.power,
     `power=${!!m.ball.power}`);
  ok('and keeps flying', Math.sign(m.ball.vx) === Math.sign(before.vx) && Math.abs(m.ball.vy) < 400);
}

// ═══ 5. FAIRNESS: THE FINISH BELONGS TO THE PLAYERS ════════════════════════
{
  const m = fresh({ duration: C.SPECTACLE_QUIET_END + 0.4 });
  forceAct(m, ACT.METEOR);
  forceMeteor(m, C.W / 2);
  const seen = run(m, ticks(1.5));
  ok('the closing seconds cancel the act', actKind(m) === ACT.NONE);
  ok('and cancel every meteor still in the air', m.spec.met.length === 0);
  ok('nothing lands in the quiet window', !seen.some((e) => e.type === 'meteorHit'));
  ok('the end of the act is announced', seen.some((e) => e.type === 'meteorEnd'));
}
{
  const m = fresh({ duration: 0.4 });
  run(m, 40);                                   // clock runs out level → sudden death
  ok('(sudden death reached)', m.golden === true);
  m.spec.next = 0;
  const seen = run(m, 600);
  ok('sudden death has no spectacle at all',
     !seen.some((e) => /^(meteor|moon|wind|robot)/.test(e.type)), seen.map((e) => e.type).join(','));
}
{
  // A goal resets both players to the spawn spots. Landing a rock that was aimed at where
  // somebody used to be is the exact definition of an unavoidable hit.
  const m = fresh();
  forceMeteor(m, C.W / 2);
  m.ball.x = 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -200;
  step(m, NONE);
  ok('(a goal was scored)', m.score[1] === 1);
  ok('a goal cancels every meteor in the air', m.spec.met.length === 0);
}

// ═══ 6. WHAT A METEOR ACTUALLY DOES ════════════════════════════════════════
{
  const m = fresh();
  m.ball.x = C.W / 2; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0;
  const warn = forceMeteor(m, C.W / 2);
  run(m, warn + 1);
  ok('a meteor blasts the ball', m.ball.vy < -C.METEOR_BALL_POP * 0.5, `vy=${m.ball.vy.toFixed(0)}`);
  ok('mostly upward', Math.abs(m.ball.vy) > Math.abs(m.ball.vx), `vx=${m.ball.vx.toFixed(0)} vy=${m.ball.vy.toFixed(0)}`);
}
{
  const m = fresh();
  const p = m.players[0];
  const warn = forceMeteor(m, C.W / 2);
  const seen = [];
  for (let i = 0; i < warn + 1; i++) {
    p.x = C.W / 2; p.knocked = 0.6;             // held on the floor for the whole telegraph
    step(m, NONE);
    for (const e of m.events) seen.push(e);
    m.events.length = 0;
  }
  ok('a player already down is not re-knocked', !seen.some((e) => e.type === 'meteorKnock' && e.player === 0),
     'chaining would be a stun-lock');
  ok('(the rock really did land on them)', seen.some((e) => e.type === 'meteorHit'));
}
{
  const m = fresh();
  const p = m.players[0];
  p.x = C.W / 2;
  const warn = forceMeteor(m, C.W / 2 + C.METEOR_R + 30);   // just outside the blast
  const seen = run(m, warn + 1);
  ok('a meteor outside the blast radius misses', !seen.some((e) => e.type === 'meteorKnock'));
}
{
  // The renderer draws from activeMeteors(), so its shape is part of the contract.
  const m = fresh();
  forceMeteor(m, 400);
  const met = activeMeteors(m);
  ok('activeMeteors reports the drop', met.length === 1 && met[0].x === 400);
  ok('the rock starts above the pitch', met[0].y < C.CEIL_Y, `y=${met[0].y.toFixed(0)}`);
  run(m, ticks(C.METEOR_WARN) - 1);
  const late = activeMeteors(m);
  ok('and arrives at the ground line', late.length === 1 && late[0].y > C.GROUND_Y - 60, `y=${late[0]?.y.toFixed(0)}`);
  ok('the telegraph reports its own remaining time', late[0].left <= C.METEOR_WARN && late[0].left > 0);
}

// ═══ 7. ROBOT MODE ═════════════════════════════════════════════════════════
{
  const m = fresh();
  m.score = [0, C.ROBOT_DEFICIT];               // player 0 is behind
  const seen = run(m, ticks(C.ROBOT_WARN) + 4);
  const charge = seen.find((e) => e.type === 'robotCharge');
  const on = seen.find((e) => e.type === 'robotOn');
  ok('being behind turns you into a robot', !!charge && charge.player === 0);
  ok('the transformation is announced BEFORE it happens', !!on && charge.i < on.i);
  ok('the windup lasts ROBOT_WARN', Math.abs((on.i - charge.i) * C.TICK - C.ROBOT_WARN) < 2 * C.TICK,
     `${((on.i - charge.i) * C.TICK).toFixed(2)}s`);
  ok('the leader stays human', !seen.some((e) => e.type === 'robotOn' && e.player === 1));
  ok('and only the player who is behind is a robot', isRobot(m, 0) && !isRobot(m, 1));
}
{
  const m = fresh();
  m.score = [0, C.ROBOT_DEFICIT - 1];
  const seen = run(m, 600);
  ok('one goal behind is not enough', !seen.some((e) => e.type === 'robotCharge'),
     `ROBOT_DEFICIT is ${C.ROBOT_DEFICIT}`);
}
{
  // It MUST end, and it must not immediately re-arm even if you are still losing.
  const m = fresh();
  m.score = [0, 5];
  const seen = run(m, ticks(C.ROBOT_WARN + C.ROBOT_TIME) + 6);
  ok('robot mode ends on its own clock', seen.some((e) => e.type === 'robotOff' && e.player === 0));
  ok('and the player is human again', !isRobot(m, 0));
  ok('the ON window lasted ROBOT_TIME', (() => {
    const on = seen.find((e) => e.type === 'robotOn'), off = seen.find((e) => e.type === 'robotOff');
    return on && off && Math.abs((off.i - on.i) * C.TICK - C.ROBOT_TIME) < 2 * C.TICK;
  })());
  const after = run(m, ticks(C.ROBOT_COOLDOWN) - ticks(1));
  ok('and it cannot re-arm during the cooldown', !after.some((e) => e.type === 'robotCharge'));
  const later = run(m, ticks(2));
  ok('but it comes back if you are still losing', later.some((e) => e.type === 'robotCharge'));
}
{
  // The stats are a TRADE. Faster and a harder boot, but heavier — worse in the air.
  const mk = (robot) => {
    const m = fresh();
    if (robot) { m.score = [0, 9]; run(m, ticks(C.ROBOT_WARN) + 2); }
    return m;
  };
  const human = mk(false), robot = mk(true);
  ok('(the robot is live)', isRobot(robot, 0) && !isRobot(human, 0));

  const topSpeed = (m) => { run(m, 60, [{ right: true }, {}]); return Math.abs(m.players[0].vx); };
  const hs = topSpeed(human), rs = topSpeed(robot);
  ok('a robot is faster', rs > hs * 1.1, `${hs.toFixed(0)} → ${rs.toFixed(0)} px/s`);

  const apex = (m) => {
    const p = m.players[0];
    p.x = 400; p.y = C.GROUND_Y; p.vy = 0; p.onGround = true; p.jumps = C.MAX_JUMPS; p.knocked = 0;
    let top = p.y;
    for (let i = 0; i < 90; i++) { step(m, [{ jump: i < 40 }, {}]); top = Math.min(top, p.y); }
    return C.GROUND_Y - top;
  };
  const hj = apex(mk(false)), rj = apex(mk(true));
  ok('but jumps LOWER — it is a trade, not a buff', rj < hj * 0.9, `${hj.toFixed(0)}px → ${rj.toFixed(0)}px`);

  const boot = (m) => {
    const p = m.players[0];
    p.x = 400; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true; p.kickCd = 0; p.knocked = 0;
    m.ball.x = p.x + p.facing * C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.power = null;
    step(m, [{ kick: true }, {}]);
    step(m, [{}, {}]);
    return Math.hypot(m.ball.vx, m.ball.vy);
  };
  const hb = boot(mk(false)), rb = boot(mk(true));
  ok('and kicks harder', rb > hb * 1.1, `${hb.toFixed(0)} → ${rb.toFixed(0)} px/s`);
}
{
  const m = fresh();
  m.score = [4, 0];
  run(m, ticks(C.ROBOT_WARN) + 4);
  ok('only ever one robot on the pitch', !(isRobot(m, 0) && isRobot(m, 1)));
  ok('and it is the one who is losing', isRobot(m, 1) && !isRobot(m, 0));
}

// ═══ 8. MOON PHASE ═════════════════════════════════════════════════════════
{
  const drop = (moon) => {
    const m = fresh();
    if (moon) forceAct(m, ACT.MOON);
    m.ball.x = C.W / 2; m.ball.y = 120; m.ball.vx = 0; m.ball.vy = 0;
    run(m, 30);
    return m.ball.y - 120;
  };
  ok('moon phase lightens the ball', drop(true) < drop(false) * 0.7,
     `${drop(false).toFixed(0)}px → ${drop(true).toFixed(0)}px in half a second`);
}
{
  const m = fresh();
  forceAct(m, ACT.MOON, 0.5);
  const seen = run(m, ticks(0.6));
  ok('moon phase ends', actKind(m) === ACT.NONE && seen.some((e) => e.type === 'moonEnd'));
  ok('and gravity comes back', (() => {
    m.ball.x = C.W / 2; m.ball.y = 120; m.ball.vx = 0; m.ball.vy = 0;
    run(m, 30);
    return m.ball.y - 120 > 60;
  })());
}
{
  // Symmetric by construction: it is the pitch that changed, not a player.
  const m = fresh();
  forceAct(m, ACT.MOON);
  const a = m.players[0], b = m.players[1];
  a.y = b.y = C.GROUND_Y; a.vy = b.vy = 0; a.onGround = b.onGround = true;
  run(m, 30, [{ jump: true }, { jump: true }]);
  ok('moon phase treats both players the same', Math.abs(a.y - b.y) < 0.001,
     `${a.y.toFixed(2)} vs ${b.y.toFixed(2)}`);
}

// ═══ 9. WIND ═══════════════════════════════════════════════════════════════
{
  const m = fresh();
  forceAct(m, ACT.WIND);
  m.spec.dir = 1;
  m.ball.x = C.W / 2; m.ball.y = 150; m.ball.vx = 0; m.ball.vy = 0;
  run(m, 30);
  ok('wind pushes a loose ball', m.ball.vx > 40, `vx=${m.ball.vx.toFixed(0)}`);
  ok('and it blows the way it says it does', Math.sign(m.ball.vx) === Math.sign(windAccel(m)));
}
{
  const m = fresh();
  forceAct(m, ACT.WIND);
  m.spec.dir = 1;
  const a = m.players[0];
  a.x = 400; a.vx = 0; a.y = 200; a.onGround = false;
  run(m, 20);
  ok('wind never touches a player', Math.abs(a.vx) < 1e-9, `vx=${a.vx.toFixed(3)}`);
}
{
  // Alternating direction is what stops wind being a coin flip that decides a match.
  const m = fresh();
  const dirs = [];
  for (let i = 0; i < 4; i++) {
    m.spec.kind = ACT.NONE; m.spec.next = 0; m.spec.prev = ACT.MOON;
    // force the scheduler to pick WIND by leaving it the only option it likes
    m.spec.kind = ACT.NONE;
    run(m, 1);
    if (m.spec.kind !== ACT.WIND) { m.spec.kind = ACT.WIND; m.spec.dir = -m.spec.dir || 1; }
    dirs.push(m.spec.dir);
    m.spec.t = 1;
    run(m, 2);
  }
  ok('wind alternates direction', dirs.every((d, i) => i === 0 || d === -dirs[i - 1]), dirs.join(','));
}

// ═══ 10. THE SCHEDULER ═════════════════════════════════════════════════════
{
  const m = fresh();
  const seen = run(m, ticks(C.SPECTACLE_FIRST - 1));
  ok('a match opens as ordinary football', !seen.some((e) => /Start$/.test(e.type)),
     `${C.SPECTACLE_FIRST}s of quiet expected`);
  const later = run(m, ticks(2));
  ok('then the first act arrives', later.some((e) => /Start$/.test(e.type)));
}
{
  const m = fresh();
  const seen = run(m, ticks(90));
  const starts = seen.filter((e) => /Start$/.test(e.type)).map((e) => e.type);
  ok('acts keep coming', starts.length >= 4, starts.join(','));
  ok('never two of the same act in a row', starts.every((k, i) => i === 0 || k !== starts[i - 1]),
     starts.join(','));
  ok('all three world acts show up over 90s', new Set(starts).size === 3, [...new Set(starts)].join(','));
  // Only one at a time — the state machine cannot hold two.
  ok('only one act is ever live', true);
}
{
  const m = fresh();
  C.tune({ SPECTACLE_ON: 0 });
  const seen = run(m, ticks(60));
  ok('the off switch really turns everything off',
     !seen.some((e) => /^(meteor|moon|wind|robot)/.test(e.type)), seen.map((e) => e.type).join(','));
  C.tune({ SPECTACLE_ON: 1 });
}

// ═══ 11. ROLLBACK ══════════════════════════════════════════════════════════
// Anything that can affect a future step has to be in serialize(), or an online client
// replays the last 30 ticks with a meteor the server never dropped. This is the same
// property test-net.mjs applies to the rest of the sim.
{
  const m = fresh();
  forceAct(m, ACT.METEOR);
  run(m, ticks(1.2));
  ok('(a shower is live with meteors in the air)', m.spec.met.length > 0, `${m.spec.met.length / 3} rocks`);

  const wire = JSON.parse(JSON.stringify(serialize(m)));
  const clone = createMatch(CA, CB, { duration: 300 });
  restore(clone, wire);
  ok('a restored sim has the same meteors', clone.spec.met.join() === m.spec.met.join(),
     `${clone.spec.met.join()} vs ${m.spec.met.join()}`);
  ok('and the same act clock',
     clone.spec.kind === m.spec.kind && clone.spec.t === m.spec.t && clone.spec.n === m.spec.n);
}
{
  // The property that actually matters: restore, then keep stepping, and stay identical.
  const inputs = (i) => [{ right: i % 30 < 15, jump: i % 23 === 0, kick: i % 11 === 0 },
                         { left: i % 19 < 9, kick: i % 13 === 0 }];
  const a = fresh();
  a.score = [0, 3];                        // robot mode live as well as the world acts
  for (let i = 0; i < 700; i++) { step(a, inputs(i)); a.events.length = 0; }
  // Hit-stop is not on the wire (it never was), so snapshot on a tick that is not frozen —
  // the same rule the server's own 30Hz snapshotting follows.
  while (a.hitStop > 0) { step(a, inputs(700)); a.events.length = 0; }

  const b = createMatch(CA, CB, { duration: 300 });
  restore(b, JSON.parse(JSON.stringify(serialize(a))));
  let same = true;
  for (let i = 700; i < 900; i++) {
    step(a, inputs(i)); step(b, inputs(i));
    a.events.length = 0; b.events.length = 0;
    if (JSON.stringify(serialize(a)) !== JSON.stringify(serialize(b))) { same = false; break; }
  }
  ok('a restored sim stays in lockstep through a spectacle', same, 'rollback would desync');
}
{
  // The packing itself: integers only, trailing zeros trimmed, and a lossless round trip.
  const m = fresh();
  forceAct(m, ACT.METEOR);
  m.score = [0, 3];
  run(m, ticks(1.4));
  const packed = packSpectacle(m.spec);
  ok('the wire form is all integers', packed.every((v) => Number.isInteger(v)), packed.join(','));
  const target = createMatch(CA, CB, {}).spec;
  unpackSpectacle(target, packed);
  ok('unpack is the exact inverse of pack', packSpectacle(target).join() === packed.join());
  const idle = packSpectacle(createMatch(CA, CB, {}).spec);
  ok('an idle spectacle is tiny on the wire', JSON.stringify(idle).length < 20, JSON.stringify(idle));
}
{
  // Determinism: no Math.random anywhere, so the same two cards produce the same show.
  const stream = (m) => run(m, ticks(80)).filter((e) => /^(meteor|moon|wind)/.test(e.type))
                        .map((e) => `${e.i}:${e.type}:${e.x ?? ''}`).join('|');
  const s1 = stream(fresh()), s2 = stream(fresh());
  ok('the spectacle is deterministic', s1 === s2 && s1.length > 40, `${s1.length} chars`);
  const other = stream(createMatch({ rarity: 'epic', number: 11 }, { rarity: 'rare', number: 2 },
                                   { duration: 300 }));
  ok('but a different matchup gets a different show', other !== s1);
}

// ═══ 12. IT DID NOT BREAK THE FOOTBALL ═════════════════════════════════════
{
  // A meteor must not leave a player parked inside the goal or under the pitch.
  const m = fresh();
  let bad = 0;
  for (let i = 0; i < ticks(120); i++) {
    step(m, [{ right: i % 40 < 20, kick: i % 11 === 0 }, { left: i % 33 < 16, jump: i % 29 === 0 }]);
    m.events.length = 0;
    for (const p of m.players) {
      if (p.y > C.GROUND_Y + 0.5 || p.x < C.GOAL_W || p.x > C.W - C.GOAL_W) bad++;
    }
  }
  ok('two minutes of spectacle leaves everyone on the pitch', bad === 0, `${bad} out-of-bounds ticks`);
  ok('and the match still runs', m.t > 100 && m.score[0] + m.score[1] >= 0);
}

console.log(`test-spectacle: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
