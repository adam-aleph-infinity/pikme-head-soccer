// THE ULTIMATE, and the things that are no longer in the game. Run: node test-ultimate.mjs
//
// Two bugs and one removal are the reason this file exists, and every block below names the
// one it is guarding:
//
//   1. "Sometimes the rival activates the ultimate automatically when the match starts."
//      The press WAS the move, so anything that produced a press produced a goal-bound shot
//      — including a full meter that had survived from a previous match, and a bot writing a
//      LEVEL into a button the sim reads as an EDGE. Both halves are tested here.
//   2. The ultimate now ARMS on the button and ACTIVATES on a touch of the ball, so "a full
//      meter does nothing", "a press does nothing to the ball" and "one contact fires once"
//      are the three properties that replace the old wind-up's.
//   3. Wind, low gravity, meteors, robot mode and the crates are gone. A removal is only
//      real if nothing can bring it back, so the last section plays whole matches out and
//      asserts nothing spawns, nothing bends the ball, and no dial exists to switch one on.
//
//   4. ARM → FIRE → THE FAMILY'S FLIGHT → THE DEFENDER → THE AILMENT (sections 11–15): Head
//      Soccer's power shots as filmed (docs/HS-POWER-SHOTS.md) — eleven families, a kick that
//      blocks, a stand that gets you hit, an armed touch that counters, the ailments, the arming
//      aura, and all of it surviving a snapshot.
//
// Kept apart from test-sim.mjs deliberately: that file is the physics, this file is one
// mechanic and one deletion, and it should be readable as the answer to the report.
import { readFileSync } from 'node:fs';
import * as C from './shared/constants.js';
import { createMatch, step, headY, resetPositions, clearUltimate, serialize, restore } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { shotById, applyAilment, wave, FAMILY_ORDER, ailMods } from './shared/hs-powers.js';
import { CHAMPION_POWERS, BUILT_STAGES } from './shared/champion-powers.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const NONE = [{}, {}];
const fresh = (opts) => {
  const m = createMatch(CA, CB, opts);
  m.freeze = 0; m.phase = 'play';
  return m;
};
const run = (m, ticks, inputs = NONE) => {
  for (let i = 0; i < ticks; i++) step(m, inputs);
  return m;
};

// THE GLOW, as the renderer defines it. drawHeads toggles the `.armed` class and drawAura
// draws the ring off exactly this expression and nothing else, so testing it here is testing
// the glow — there is no second flag that could disagree with it.
const glowing = (p) => p.armed > 0;

// Hold the ball against a player's body for one tick, which is a contact.
function touchBall(m, p) {
  m.hitStop = 0;
  m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE);
}

// Arm a player: fill the meter, press POWER once.
function arm(m, i) {
  const p = m.players[i];
  p.gauge = 1; p.prev = {}; m.hitStop = 0;
  const inputs = [{}, {}]; inputs[i] = { power: true };
  step(m, inputs);
  m.events.length = 0;
  return p;
}

// ═══ 1. BOTH PLAYERS START WITH IT OFF ═══════════════════════════════════════
{
  const m = createMatch(CA, CB, {});
  for (let i = 0; i < 2; i++) {
    const p = m.players[i];
    ok(`player ${i} starts with an empty meter`, p.gauge === 0, `gauge=${p.gauge}`);
    ok(`player ${i} starts unarmed`, p.armed === 0, `armed=${p.armed}`);
    ok(`player ${i} starts without the glow`, !glowing(p));
  }
  ok('and no power ball exists at kickoff', !m.ball.power);
}
{
  // STALE STATE FROM A PREVIOUS MATCH. This is the actual root cause: the fields are only
  // zero because something zeroed them, so a match built on top of dirtied players has to
  // come out clean too. createMatch tears the ultimate down explicitly for this reason.
  const dirty = createMatch(CA, CB, {});
  dirty.players[0].gauge = 1; dirty.players[0].armed = 1;
  dirty.players[1].gauge = 1; dirty.players[1].armed = 1;
  for (const p of dirty.players) clearUltimate(dirty, p);
  ok('a hard clear empties both meters',
     dirty.players[0].gauge === 0 && dirty.players[1].gauge === 0);
  ok('and disarms both players',
     dirty.players[0].armed === 0 && dirty.players[1].armed === 0);
  ok('and takes the glow with it',
     !glowing(dirty.players[0]) && !glowing(dirty.players[1]));
}

// ═══ 2. THE RIVAL CANNOT ACTIVATE AT THE START ═══════════════════════════════
{
  // The whole first stretch of a match, played by two real bots at the hardest tier — the
  // one that reacts fastest and therefore had the most chances to press early. Nothing may
  // arm and nothing may fire inside the opening seconds.
  const m = createMatch(CA, CB, {});
  const bots = [createBot(5, () => 0.5), createBot(5, () => 0.5)];
  let armedEarly = false, firedEarly = false;
  for (let i = 0; i < 90; i++) {                      // 1.5s, through the kickoff freeze
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    if (m.players[1].armed > 0) armedEarly = true;
    if (m.events.some((e) => e.type === 'powershot')) firedEarly = true;
    m.events.length = 0;
  }
  ok('the rival does not arm in the first second and a half', !armedEarly);
  ok('and fires no ultimate there', !firedEarly);
  // The meter fills on the clock now (Head Soccer), so after 1.5s it holds exactly the clock's
  // share and not a hair more — and that is nowhere near a full one.
  ok('the rival meter holds only what the clock gave it',
     m.players[1].gauge <= 90 * C.TICK * C.GAUGE_PASSIVE + 1e-9 && m.players[1].gauge < 0.5,
     `gauge=${m.players[1].gauge}`);
}
{
  // A REUSED BOT OBJECT. `bot.t` is never reset by a new match, so every gate the bot keeps
  // on its OWN clock is already satisfied on tick 1 of the next one. The gate that matters
  // has to be on the MATCH, and this is the test that says so.
  const old = createBot(5, () => 0.5);
  old.t = 999;                                        // as if it had played a whole match
  const m = createMatch(CA, CB, {});
  m.players[1].gauge = 1;                             // …and as if a meter had survived too
  const out = botInput(old, m, 1, C.TICK);
  ok('a reused bot with a full meter does not press at kickoff', out.power === false);
  step(m, [{}, out]);
  ok('so nothing arms on the first tick', m.players[1].armed === 0);
  ok('and nothing is fired', !m.ball.power);
}
{
  // THE EDGE, not the level. A bot writes `power: true` every tick it wants the move; the
  // sim must read that as ONE press. Held down for a full second, it may arm at most once.
  const m = fresh();
  const p = m.players[1];
  p.gauge = 1;
  let arms = 0;
  for (let i = 0; i < 60; i++) {
    m.hitStop = 0;
    step(m, [{}, { power: true }]);
    arms += m.events.filter((e) => e.type === 'armed').length;
    m.events.length = 0;
    p.gauge = 1;                                      // keep it full, so only the edge gates
  }
  ok('a held power button arms exactly once', arms === 1, `${arms} arms`);
}

// ═══ 3. A FULL METER ALONE DOES NOTHING ══════════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1;
  run(m, 120);                                        // two seconds of a full meter, no press
  ok('a full meter does not arm by itself', p.armed === 0);
  ok('a full meter does not glow', !glowing(p));
  ok('a full meter fires nothing', !m.ball.power);
  ok('and it is still full', p.gauge >= 1, `gauge=${p.gauge}`);
}
{
  // …and it is not enough even WITH the ball sitting on the player. Contact only means
  // something to someone who armed.
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1;
  for (let i = 0; i < 20; i++) touchBall(m, p);
  ok('touching the ball on a full meter fires nothing', !m.ball.power);
  ok('and does not spend the meter', p.gauge >= 1, `gauge=${p.gauge}`);
}

// ═══ 4. THE BUTTON ARMS, AND THE PLAYER GLOWS ════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 1; p.prev = {}; m.hitStop = 0;
  const ballBefore = { x: m.ball.x, y: m.ball.y };
  step(m, [{ power: true }, {}]);
  ok('the press arms', p.armed > 0, `armed=${p.armed}`);
  ok('and the player glows', glowing(p));
  ok('the press is announced', m.events.some((e) => e.type === 'armed'));
  ok('the press does NOT fire', !m.ball.power);
  ok('the press empties the meter (HS M4 36.49 s)', p.gauge === 0, `gauge=${p.gauge}`);
  ok('the press does not pull the ball sideways', m.ball.x === ballBefore.x,
     `${ballBefore.x.toFixed(1)} -> ${m.ball.x.toFixed(1)}`);
  ok('nor lift it toward the player', m.ball.y >= ballBefore.y,
     `${ballBefore.y.toFixed(1)} -> ${m.ball.y.toFixed(1)}`);
}
{
  // NO ATTRACTION AT DISTANCE. The old wind-up swept the ball to the player; nothing may.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  m.ball.x = p.x + 260; m.ball.y = C.GROUND_Y - C.BALL_R; m.ball.vx = 0; m.ball.vy = 0;
  const x0 = m.ball.x;
  run(m, 45);
  ok('an armed player does not attract the ball', Math.abs(m.ball.x - x0) < 12,
     `ball ${x0.toFixed(0)} -> ${m.ball.x.toFixed(0)}, player at ${p.x.toFixed(0)}`);
  ok('and nothing fires from 260px away', !m.ball.power);
  ok('still armed and still glowing', p.armed > 0 && glowing(p));
}
{
  // NOR FROM AN UNRELATED COLLISION. Booting the opponent is a contact, and it used to spend
  // the ultimate on them. It must not any more: only the ball spends it.
  const m = fresh();
  const [a, b] = m.players;
  a.x = 500; a.facing = 1;
  arm(m, 0);
  b.x = 534; b.y = a.y; b.facing = -1; b.tackleImmune = 0;
  a.kickCd = 0; a.prev = {}; m.hitStop = 0;
  m.ball.x = 100; m.ball.y = C.GROUND_Y - C.BALL_R;    // the ball is nowhere near
  step(m, [{ kick: true }, {}]);
  const tackled = m.events.some((e) => e.type === 'tackle');
  ok('(the tackle landed)', tackled, m.events.map((e) => e.type).join(','));
  ok('tackling the opponent does not fire the ultimate', !m.ball.power);
  ok('and does not disarm', a.armed > 0, `armed=${a.armed}`);
  ok('and does not touch the refill', a.gauge > 0 && a.gauge < 0.01, `gauge=${a.gauge}`);
}

// ═══ 5. BALL CONTACT ACTIVATES — EXACTLY ONCE ════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  let shots = 0;
  for (let i = 0; i < 30; i++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    shots += m.events.filter((e) => e.type === 'powershot').length;
    m.events.length = 0;
  }
  ok('the touch fires exactly one ultimate', shots === 1, `${shots} shots`);
  ok('the arm is spent', p.armed === 0);
  ok('the glow is gone', !glowing(p));
}
{
  // TOWARD THE OPPONENT'S GOAL, from both sides of the pitch — "toward the goal" has to be
  // the player's own side and not a hardcoded direction.
  for (const i of [0, 1]) {
    const m = fresh();
    const p = m.players[i];
    arm(m, i);
    for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
    ok(`player ${i}'s ultimate fires`, !!m.ball.power);
    ok(`player ${i}'s ultimate goes at the opponent's goal`,
       !!m.ball.power && Math.sign(m.ball.vx) === Math.sign(p.side),
       `vx=${m.ball.vx.toFixed(0)} side=${p.side}`);
    ok(`player ${i}'s ultimate is a power ball`, !!m.ball.power && m.ball.power.owner === i);
  }
}
{
  // THE BODY, not only the head. Barging into the ball at chest height is a contact too.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  for (let t = 0; t < 30 && !m.ball.power; t++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = p.y - C.BODY_H * 0.4; m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    m.events.length = 0;
  }
  ok('a torso contact fires it too', !!m.ball.power);
}
{
  // ONE PRESS IS ONE SHOT. After it has gone off, the button is dead until the meter is
  // earned again — pressing through the whole follow-through may not produce a second.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('(the first ultimate is away)', !!m.ball.power);
  m.events.length = 0;                                 // …and its own event is not "a second"
  let more = 0;
  for (let i = 0; i < 60; i++) {
    m.hitStop = 0;
    p.prev = {};                                       // a fresh edge every single tick
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, [{ power: true }, {}]);
    more += m.events.filter((e) => e.type === 'powershot').length;
    m.events.length = 0;
  }
  ok('an empty meter cannot produce a second one', more === 0, `${more} more`);
}

// ═══ 6. THE METER IS SPENT ON THE PRESS, AND THE REFILL STARTS THERE ══════════
// "When you use the power it's not resetting the bar." HS M4: POWER at 36.49 s, the bar empty
// by 36.56 s and climbing at 36.67 s — 5.4 s before the touch that fires the shot (41.93 s).
{
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  ok('armed, the meter is empty', p.gauge === 0, `gauge=${p.gauge}`);
  ok('and the glow stays on', p.armed > 0 && glowing(p));
  run(m, 30);
  ok('the refill starts at the press, not at the shot',
     Math.abs(p.gauge - 30 * C.TICK * C.GAUGE_PASSIVE) < 1e-9, `gauge=${p.gauge}`);
  ok('still armed while it refills', p.armed > 0);
  const g = p.gauge;
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('the touch fires it', !!m.ball.power && p.armed === 0);
  ok('and does not zero the refill again', p.gauge >= g, `${g} -> ${p.gauge}`);
}
{
  // A REFILL THAT COMPLETES WHILE STILL ARMED does not buy a second arm: no HS footage shows
  // two stacked, so the first has to fire before the button works again.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  p.gauge = 1; p.prev = {}; m.events.length = 0;
  m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ power: true }, {}]);
  ok('a second press while armed does not re-arm', !m.events.some((e) => e.type === 'armed'));
  ok('and does not spend the new full meter', p.gauge === 1, `gauge=${p.gauge}`);
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('the first arm fires on the touch', !!m.ball.power && p.armed === 0);
  ok('and leaves the full meter full', p.gauge === 1, `gauge=${p.gauge}`);
  m.ball.power = null; p.prev = {}; m.hitStop = 0; m.cutin = 0;
  m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0;
  step(m, [{ power: true }, {}]);
  ok('after which the full meter arms again', p.armed > 0 && p.gauge === 0);
}
{
  // THE ARM WAITS. It used to be a 4.5s countdown that lapsed on its own; it has no clock
  // now, because "you must touch the ball" is not a requirement if waiting also resolves it.
  // Ten seconds with the ball pinned out of reach, and the arm is exactly where it was.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  for (let i = 0; i < 600; i++) {
    m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, NONE);
  }
  ok('ten seconds later the arm is still there', p.armed > 0, `armed=${p.armed}`);
  ok('and still glowing', glowing(p));
  ok('and the meter has refilled ten seconds of it', Math.abs(p.gauge - 600 * C.TICK * C.GAUGE_PASSIVE) < 1e-9, `gauge=${p.gauge}`);
  ok('and nothing fired while it waited', !m.ball.power);
  // …and it still pays out when the ball finally arrives.
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('the touch after the wait still fires it', !!m.ball.power);
  ok('and keeps the refill it has made', p.gauge > 600 * C.TICK * C.GAUGE_PASSIVE - 1e-9, `gauge=${p.gauge}`);
}

// ═══ 7. A GOAL LEAVES THE ULTIMATE ALONE ═════════════════════════════════════
//
// The opposite of what this section used to assert, and the bug it is now guarding: a goal
// used to run both players through clearUltimate, so scoring destroyed every point of power
// either of them had earned AND cancelled an arm that had already been paid for.
{
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  ok('(armed and glowing)', p.armed > 0 && glowing(p));
  p.gauge = 0.6;                                     // part-way through the refill
  resetPositions(m, 0);
  ok('a goal restart does NOT disarm', p.armed > 0, `armed=${p.armed}`);
  ok('a goal restart does NOT clear the glow', glowing(p));
  ok('a goal restart does NOT clear the meter', p.gauge === 0.6, `gauge=${p.gauge}`);
  // The EDGE latch stays too. Clearing it looks like a safety and is the opposite of one:
  // it hands a rising edge to anyone still holding a button through the restart.
  p.prev = { power: true };
  resetPositions(m, 0);
  ok('and does not clear the edge latch', p.prev.power === true);
}
{
  // BOTH PLAYERS, through a real goal in real play.
  const m = fresh();
  arm(m, 0);
  arm(m, 1);
  m.players[0].gauge = 1; m.players[1].gauge = 1;
  ok('(both armed)', m.players[0].armed > 0 && m.players[1].armed > 0);
  m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.y = C.GROUND_Y - 30; m.ball.vx = 700;
  for (let i = 0; i < 20 && m.score[0] === 0; i++) { m.hitStop = 0; step(m, NONE); }
  ok('(a goal was scored)', m.score[0] === 1, `score ${m.score.join('-')}`);
  ok('the scorer stays armed through their own goal', m.players[0].armed > 0);
  ok('the conceder stays armed through it too', m.players[1].armed > 0);
  ok('both are still glowing', glowing(m.players[0]) && glowing(m.players[1]));
  ok('the scorer meter is NOT reset', m.players[0].gauge >= 1, `gauge=${m.players[0].gauge}`);
  ok('the conceder meter is NOT reset', m.players[1].gauge >= 1, `gauge=${m.players[1].gauge}`);
  ok('and the goal fired no ultimate', !m.ball.power);
}
{
  // AND THE ARM SURVIVES INTO THE NEXT PASSAGE OF PLAY, which is the part that actually
  // matters: it is no good keeping the flag through the restart if the touch afterwards
  // does not still pay out.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.y = C.GROUND_Y - 30; m.ball.vx = 700;
  for (let i = 0; i < 20 && m.score[0] === 0; i++) { m.hitStop = 0; step(m, NONE); }
  ok('(scored, still armed)', m.score[0] === 1 && p.armed > 0);
  // Ride out the whole goal freeze — and the beat after it before the ball drops back in at the
  // centre (GOAL_BALL_DELAY, HS). The arm has no clock, so none of this costs it anything.
  for (let i = 0; i < 700 && (m.phase !== 'play' || m.ballWait > 0 || m.afterGoal > 0); i++) { m.hitStop = 0; step(m, NONE); }
  ok('(play has resumed, with a ball)', m.phase === 'play' && m.ballWait === 0);
  ok('still armed after the restart', p.armed > 0);
  ok('and the meter is refilling, not reset', p.gauge > 0 && p.gauge < 1, `gauge=${p.gauge}`);
  const g = p.gauge;
  let shots = 0;
  for (let i = 0; i < 30; i++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    shots += m.events.filter((e) => e.type === 'powershot').length;
    m.events.length = 0;
  }
  ok('and the touch after the goal fires it, exactly once', shots === 1, `${shots} shots`);
  // The touch spends the arm, not the meter: that went on the press and has been refilling since.
  ok('and the touch does not reset the refill', p.gauge >= g, `${g} -> ${p.gauge}`);
}
// ═══ 7b. WHAT A GOAL DOES TO THE METERS: NOTHING ═══════════════════════════════
//
// It used to pay the CONCEDER a quarter of a meter (awardConcedeMeter, GAUGE_CONCEDE_BONUS).
// Head Soccer's meter is a clock and nothing else, so a goal now leaves both meters exactly
// where they were. Driven through a real goal, both directions, with the clock itself stopped
// (GAUGE_PASSIVE 0) for the few ticks it takes — so the only thing that could move a meter
// here is the goal, and it must not.
{
  const goalBy = (who, meters) => {
    const passive = C.GAUGE_PASSIVE;
    C.tune({ GAUGE_PASSIVE: 0 });
    try {
      const m = fresh();
      m.players[0].gauge = meters[0];
      m.players[1].gauge = meters[1];
      // who = 0 scores into the RIGHT net, who = 1 into the LEFT one.
      m.ball.y = C.GROUND_Y - 30;
      if (who === 0) { m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.vx = 700; }
      else { m.ball.x = C.GOAL_W + C.BALL_R + 2; m.ball.vx = -700; }
      for (let i = 0; i < 20 && m.score[who] === 0; i++) { m.hitStop = 0; step(m, NONE); }
      return { scored: m.score[who] === 1, g: [m.players[0].gauge, m.players[1].gauge] };
    } finally { C.tune({ GAUGE_PASSIVE: passive }); }
  };
  let moved = 0, scored = 0;
  for (const who of [0, 1]) {
    for (const pair of [[0.4, 0.4], [0.8, 0.3], [1, 0.3], [0.55, 0.4], [0.1, 0.9], [0, 0.5], [1, 1]]) {
      const r = goalBy(who, pair);
      if (!r.scored) continue;
      scored++;
      if (r.g[0] !== pair[0] || r.g[1] !== pair[1]) moved++;
    }
  }
  ok('(the goals were scored)', scored === 14, `${scored}/14`);
  ok('no goal, by either player from any starting pair, moves either meter', moved === 0, `${moved} did`);
  ok('the concede bonus is gone', !('GAUGE_CONCEDE_BONUS' in C), String(C.GAUGE_CONCEDE_BONUS));
}
{
  // A FULL METER STAYS FULL ACROSS A GOAL — for the scorer, who gets nothing added, and for
  // the conceder, and the clock's clamp at 1 is what keeps both there.
  const m = fresh();
  m.players[0].gauge = 1; m.players[1].gauge = 1;
  m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.y = C.GROUND_Y - 30; m.ball.vx = 700;
  for (let i = 0; i < 20 && m.score[0] === 0; i++) { m.hitStop = 0; step(m, NONE); }
  ok('(a goal was scored)', m.score[0] === 1);
  ok('the scorer full meter is still full', m.players[0].gauge === 1, `${m.players[0].gauge}`);
  ok('the conceder full meter is still full', m.players[1].gauge === 1, `${m.players[1].gauge}`);
  ok('and neither exceeds the maximum',
     m.players[0].gauge <= 1 && m.players[1].gauge <= 1);
}
{
  // THE METER IS SPENT BY THE POWER PRESS AND BY NOTHING ELSE. Play a long stretch and assert
  // that every single drop in either meter is accounted for by an arm on that tick.
  const m = fresh();
  const bots = [createBot(4, () => 0.5), createBot(3, () => 0.5)];
  let unexplained = 0;
  for (let i = 0; i < 4000 && m.phase !== 'over'; i++) {
    const before = [m.players[0].gauge, m.players[1].gauge];
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    // FULL TIME clears both meters on purpose (clearUltimate), so nobody is left glowing on the
    // results screen. That is an explained drop, and it only shows up here when the match
    // actually finishes inside the 4000 ticks — which it does now that there are fewer goals
    // and so fewer goal freezes to push it past the whistle.
    if (m.events.some((e) => e.type === 'fulltime')) { m.events.length = 0; break; }
    const fired = new Set(m.events.filter((e) => e.type === 'armed').map((e) => e.player));
    for (let k = 0; k < 2; k++) {
      if (m.players[k].gauge < before[k] - 1e-9 && !fired.has(k)) unexplained++;
    }
    m.events.length = 0;
  }
  ok('over a whole match, a meter only ever falls on a press',
     unexplained === 0, `${unexplained} unexplained drops`);
}
{
  // FULL TIME. Nobody is left glowing on the results screen, and nothing survives onto the
  // match object an "again" button might reuse.
  const m = fresh({ duration: 0.5 });
  m.score = [2, 1];
  arm(m, 0); arm(m, 1);
  run(m, 60);
  ok('(the match is over)', m.phase === 'over');
  ok('full time disarms both', m.players[0].armed === 0 && m.players[1].armed === 0);
  ok('and clears both meters', m.players[0].gauge === 0 && m.players[1].gauge === 0);
}
{
  // A RESTART is a new match, and it must not inherit anything — even when the object it is
  // built from is the one that just finished glowing.
  const done = fresh();
  arm(done, 0); arm(done, 1);
  const next = createMatch(CA, CB, {});
  ok('a restart starts unarmed', next.players[0].armed === 0 && next.players[1].armed === 0);
  ok('a restart starts with empty meters',
     next.players[0].gauge === 0 && next.players[1].gauge === 0);
  ok('and the old match is not what the new one reads', done !== next);
}

// ═══ 8. THE RIVAL PLAYS BY THE SAME RULES ════════════════════════════════════
{
  // Every rule above, asserted on player 1 driven by the real bot rather than by a test
  // harness pressing buttons. The bot may not have a path to the shot the player lacks.
  const m = fresh();
  const bot = createBot(5, () => 0.5);
  const p = m.players[1];
  p.gauge = 1;
  let sawArm = false, sawShot = false, shotWhileUnarmed = false;
  for (let i = 0; i < 400; i++) {
    m.hitStop = 0;
    const armedBefore = p.armed > 0;
    step(m, [{}, botInput(bot, m, 1, C.TICK)]);
    for (const e of m.events) {
      if (e.type === 'armed' && e.player === 1) sawArm = true;
      if (e.type === 'powershot' && e.player === 1) {
        sawShot = true;
        if (!armedBefore) shotWhileUnarmed = true;
      }
    }
    m.events.length = 0;
    if (sawShot) break;
  }
  ok('the rival does arm, given a full meter and time', sawArm);
  ok('the rival never fires without having been armed first', !shotWhileUnarmed);
  // The press emptied the meter and the refill started there (HS M4 36.49 s), so at the shot
  // the arm is what has been spent and the meter is on its way back up — never still full.
  if (sawShot) ok('and when it fires, the arm is spent and the meter is refilling', p.armed === 0 && p.gauge < 1, `armed=${p.armed} gauge=${p.gauge}`);
  else ok('and when it fires, the arm is spent and the meter is refilling', true, '(no shot inside the window)');
}
{
  // THE RIVAL CANNOT SHORTCUT THE TOUCH. Armed, with the ball pinned out of reach for ten
  // seconds: the bot has no path to a shot that a player would not have, and the arm simply
  // waits, exactly as it does for a human.
  const m = fresh();
  const bot = createBot(5, () => 0.5);
  const p = m.players[1];
  p.gauge = 1;
  let fired = false;
  for (let i = 0; i < 600; i++) {
    m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0;
    m.hitStop = 0;
    step(m, [{}, botInput(bot, m, 1, C.TICK)]);
    if (m.events.some((e) => e.type === 'powershot')) fired = true;
    m.events.length = 0;
  }
  ok('a rival that never reaches the ball never fires', !fired);
}

// ═══ 11. FIRE → THE FAMILY'S FLIGHT ═════════════════════════════════════════
//
// The eleven Head Soccer families (shared/hs-powers.js). The straight comet is measured (M4:
// 2150 px/s, dead flat — docs/HS-POWER-SHOTS.md §3); the rest fly a path of their own at a
// multiple of it. Each is fired by a real armed touch and followed with the defender parked out
// of the way, so what is measured is the flight and nothing else.
const TICK_S = (s) => Math.round(s / C.TICK);
function fireFam(fam, o = {}) {
  const m = fresh();
  const a = m.players[0], z = m.players[1];
  a.shot = shotById(fam, o);
  a.x = 260;
  z.x = C.W - 40; z.y = C.GROUND_Y;                     // parked in his own goal mouth, out of the path
  m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  arm(m, 0);
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE);
  const ev = [...m.events]; m.events.length = 0;
  // past the cut-in's hold (the dark outlasts it, and the ball is away under it)
  while (m.hitStop > 0) step(m, NONE);
  return { m, a, z, ev };
}
// The ball's path for `s` seconds, as {t, x, y, vx, vy, ph}.
function track(m, s, inputs = NONE) {
  const out = [];
  for (let i = 0; i < TICK_S(s) && m.phase === 'play'; i++) {
    step(m, inputs);
    const b = m.ball;
    out.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, ph: b.power ? b.power.ph : null, pw: !!b.power });
    m.events.length = 0;
  }
  return out;
}
{
  const { m, ev } = fireFam('straight');
  ok('an armed touch fires the family\'s shot', ev.some((e) => e.type === 'powershot' && e.fam === 'straight') && m.ball.power && m.ball.power.fam === 'straight');
  const p = track(m, 0.2).filter((q) => q.pw);
  const vx = (p[p.length - 1].x - p[0].x) / ((p.length - 1) * C.TICK);
  ok('STRAIGHT: the measured comet, 2150 px/s', Math.abs(vx - 2150) < 2150 * 0.03, `${vx.toFixed(0)} px/s`);
  ok('STRAIGHT: dead flat', p.every((q) => Math.abs(q.y - p[0].y) < 0.5));
}
{
  const { m } = fireFam('ground');
  const p = track(m, 0.4);
  const rolling = p.filter((q) => q.ph === 'roll');
  ok('GROUND: drops to the turf and rolls along it', rolling.length > 5 && rolling.every((q) => Math.abs(q.y - (C.GROUND_Y - C.BALL_R)) < 0.5) &&
     rolling[rolling.length - 1].x > rolling[0].x + 100, `${rolling.length} rolling ticks`);
}
{
  const { m } = fireFam('downward');
  const y0 = m.ball.y;
  const p = track(m, 0.8);
  const top = Math.min(...p.map((q) => q.y));
  ok('DOWNWARD: hops up first', top < y0 - 40, `rose ${(y0 - top).toFixed(0)}px`);
  const fall = p.filter((q) => q.pw && q.ph === 'fly');
  ok('DOWNWARD: then drives straight down at the foot of the goal', fall.length > 3 && fall.slice(0, 4).every((q) => q.vy > 0 && q.vx > 0));
}
{
  const s = fireFam('straight'), d = fireFam('destructive'), c = fireFam('critical'), g = fireFam('grab');
  const speed = (f) => { const p = track(f.m, 0.1).filter((q) => q.pw); return (p[p.length - 1].x - p[0].x) / ((p.length - 1) * C.TICK); };
  const vs = speed(s), vd = speed(d), vc = speed(c), vg = speed(g);
  ok('CRITICAL is the fastest, DESTRUCTIVE slower than the comet, GRAB at its pace (M3 73.95–74.02 s ≈ 2100 px/s)', vc > vs * 1.2 && vd < vs && Math.abs(vg - vs) < vs * 0.05,
     `straight ${vs.toFixed(0)} critical ${vc.toFixed(0)} destructive ${vd.toFixed(0)} grab ${vg.toFixed(0)}`);
}
{
  const { m } = fireFam('aerial');
  const p = track(m, 2.0);
  const up = p.findIndex((q) => q.ph === 'wait');
  const waits = p.filter((q) => q.ph === 'wait');
  const dive = p.filter((q) => q.ph === 'dive');
  ok('AERIAL: straight up and off the top of the screen (M2 42.7 s)', up > 0 && p.slice(0, up).every((q) => q.vx === 0 && q.vy < 0) && waits[0].y < 0);
  ok('AERIAL: waits out of sight about a second (M2 43.2–44.2 s)', waits.length * C.TICK > 0.7 && waits.length * C.TICK < 1.3 && waits.every((q) => q.x === waits[0].x),
     `${(waits.length * C.TICK).toFixed(2)}s`);
  ok('AERIAL: then dives in at the goal mouth', dive.length > 3 && dive.every((q) => q.vx > 0 && q.vy > 0));
}
{
  const { m } = fireFam('delay');
  const p = track(m, 1.6);
  const hold = p.filter((q) => q.ph === 'hold');
  const after = p.slice(p.findIndex((q) => q.ph === 'hold') + hold.length).filter((q) => q.pw);
  ok('DELAY: flies a beat, then hangs dead in the air', hold.length * C.TICK >= 0.35 && hold.every((q) => q.vx === 0 && q.vy === 0 && q.x === hold[0].x));
  ok('DELAY: then bursts on at the goal', after.length > 2 && Math.hypot(after[1].vx, after[1].vy) > C.POWER_SHOT_SPEED);
}
{
  const { m } = fireFam('multiball');
  ok('MULTI-BALL: extra balls on the pitch, each a power ball of the shooter\'s', m.xballs.length >= 1 && m.xballs.every((e) => e.power && e.power.owner === 0 && e.power.extra));
  track(m, 0.15);
  ok('MULTI-BALL: fanned off the first', m.xballs.length === 0 || m.xballs.every((e) => Math.abs(e.y - m.ball.y) > 8));
  const gentle = fireFam('multiball', { gentle: true, intensity: 0.1 });
  ok('MULTI-BALL (gentle, stage 6): exactly one extra, slower than the main shot',
     gentle.m.xballs.length === 1 && Math.abs(gentle.m.xballs[0].power.vx0) < Math.abs(gentle.m.ball.vx) * 0.8);
}
{
  const { m } = fireFam('updown');
  const p = track(m, 0.45).filter((q) => q.pw);
  const ys = p.map((q) => q.y), lo = Math.min(...ys), hi = Math.max(...ys);
  let turns = 0;
  for (let i = 2; i < p.length; i++) if (Math.sign(p[i].vy) !== Math.sign(p[i - 1].vy) && Math.abs(p[i].vy) > 1) turns++;
  ok('UP-AND-DOWN: rises and falls as it goes', hi - lo > 80 && turns >= 2, `${(hi - lo).toFixed(0)}px swing, ${turns} turns`);
}
{
  const { m } = fireFam('ailment', { ailment: 'freeze' });
  ok('AILMENT: the shot carries its ailment', m.ball.power.ail === 'freeze');
}
{
  // ROLLBACK DETERMINISM: no engine-dependent transcendental in the sim's power code — the wave
  // is a literal table — and a family flown twice from the same state lands on the same numbers.
  const src = readFileSync(new URL('./shared/hs-powers.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  ok('hs-powers.js uses no Math.sin / cos / tan / random', !/Math\.(sin|cos|tan|random)\b/.test(src));
  ok('the Up-and-Down table is one period (0 → 1 → 0 → −1)', Math.abs(wave(0)) < 1e-9 && Math.abs(wave(0.25) - 1) < 1e-9 && Math.abs(wave(0.75) + 1) < 1e-9);
  const r = FAMILY_ORDER.map((f) => { const x = fireFam(f), y = fireFam(f); track(x.m, 1.2); track(y.m, 1.2); return JSON.stringify(serialize(x.m)) === JSON.stringify(serialize(y.m)); });
  ok('every family flies the same twice', r.every(Boolean), FAMILY_ORDER.filter((f, i) => !r[i]).join(','));
}

// ═══ 12. THE SHOT MEETS THE DEFENDER: BLOCK, HIT, COUNTER ═════════════════════
// docs/HS-POWER-SHOTS.md §4 — three outcomes, from what the defender is doing when it arrives.
// atY: the height the shot flies at once it leaves (a shot always leaves at the shooter's head
// height, constants.js POWER_RELEASE_UP — this puts it where a test needs it to meet him)
// When KICK goes in for a counter (the boot must meet it — _block-window.mjs): a ball at head height
// ~0.145 s before it arrives (the boot swings up through it 0.12–0.15 s after the press, and only
// the swing up blocks: C.BLOCK_SWING), one on the grass just as it does (the boot is down there only
// for the first frames of the swing).
const KICK_LATE = 3;   // ticks after the release the in-air block test kicks (its jump: 20 before)
const kickLead = (b) => (b.y > C.GROUND_Y - 45 ? 0.07 : 0.145);
function atDefender(fam, o = {}, { kick = false, armed = false, gap = 560, atY = null } = {}) {
  const m = fresh();
  const a = m.players[0], z = m.players[1];
  a.shot = shotById(fam, o); z.shot = shotById('updown');
  a.x = 260; z.x = a.x + gap;
  m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  if (armed) arm(m, 1);
  arm(m, 0);
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE); m.events.length = 0;
  const log = [];
  let pressed = false;
  for (let i = 0; i < 240 && m.phase === 'play'; i++) {
    const b = m.ball;
    if (atY != null && b.power && m.hitStop <= 0 && !b.power.atY) { b.y = atY; b.power.y0 = atY; b.power.atY = 1; }
    const near = kick && !pressed && b.power && b.power.owner === 0 && Math.abs(b.x - z.x) < Math.max(140, Math.abs(b.vx) * kickLead(b)) && m.hitStop <= 0;   // a real counter's timing (_block-window.mjs)
    if (near) pressed = true;
    step(m, [{}, { kick: near }]);
    log.push(...m.events); m.events.length = 0;
    if (log.some((e) => ['blocked', 'powerHit', 'grabbed'].includes(e.type) || (e.type === 'powershot' && e.player === 1))) break;
  }
  return { m, a, z, log };
}
{
  const { m, z, log } = atDefender('straight', {}, { kick: true });
  ok('KICKING into it BLOCKS it: pinned on the boot', log.some((e) => e.type === 'blocked' && e.player === 1) && m.ball.power.ph === 'grind');
  const x0 = z.x;
  track(m, 0.4);
  ok('…grinding, the blocker pushed back a few px', m.ball.power && m.ball.power.ph === 'grind' && z.x * z.side < x0 * z.side + 1 && Math.abs(z.x - x0) < 25);
  track(m, 0.62);
  // (not dead at his feet any more — Idan 2026-10-13: it looked like a teleport — it floats up off
  // the boot toward the spot in front of his head it fires from)
  ok('…then rising off the boot toward his head, never on the grass', m.ball.power && m.ball.power.ph === 'rest' && m.ball.y < C.GROUND_Y - C.BALL_R - 2 && m.ball.y > headY(z) - 3 * C.HEAD_R);
  // (as the power it blocked — the shooter's, now his: Idan, 2026-09-30; tick by tick to the moment
  // it goes back out, since from his head height it is on the shooter fast)
  for (let i = 0; i < TICK_S(0.5) && !(m.ball.power && m.ball.power.owner === 1); i++) { step(m, NONE); m.events.length = 0; }
  ok('…then back out as the shot he blocked, now HIS, at the shooter\'s goal', m.ball.power && m.ball.power.owner === 1 && m.ball.power.src === 0 && m.ball.power.fam === 'straight' && m.ball.vx * z.side > 0);
}
{
  const { m, z, log } = atDefender('straight');
  const hit = log.find((e) => e.type === 'powerHit');
  ok('STANDING in its path is a HIT', hit && hit.player === 1 && hit.how === 'hit');
  ok('…he is thrown back toward his own net, dazed, three stars', z.vx * z.side < 0 && z.stunned > 0 && z.ail === 'stars');
  ok('…and the ball bounces off him, no longer the shot, keeping most of its pace (M3 38.25 s)',
     !m.ball.power && Math.hypot(m.ball.vx, m.ball.vy) > C.POWER_SHOT_SPEED * 0.6);
}
{
  // Square on, it comes straight back (M3 38.25 s); grazing the crown, it carries on past him
  // (M4 43.30 s) — the bounce is off the head's own circle.
  const sq = atDefender('straight', {}, { atY: C.GROUND_Y - C.BODY_H - C.HEAD_R + C.NECK });   // his head's centre
  ok('square on, the hit ball comes back toward the shooter', sq.m.ball.vx < -C.POWER_SHOT_SPEED * 0.5, `vx ${sq.m.ball.vx.toFixed(0)}`);
  const m = fresh();
  const [a, z] = m.players;
  a.shot = shotById('straight'); z.shot = shotById('updown');
  a.x = 260; z.x = 600; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  arm(m, 0);
  m.ball.x = a.x; m.ball.y = headY(z) - C.HEAD_R - C.BALL_R + 6;        // high: it will just catch his crown
  step(m, NONE); m.events.length = 0;
  let hit = null;
  for (let i = 0; i < 200 && !hit; i++) { step(m, NONE); hit = m.events.find((e) => e.type === 'powerHit'); m.events.length = 0; }
  ok('grazing his crown, the hit ball carries on past him', hit && m.ball.vx > 0, `vx ${m.ball.vx.toFixed(0)}`);
}
{
  const { m, log } = atDefender('straight', {}, { armed: true });
  const c = log.find((e) => e.type === 'powershot' && e.player === 1);
  ok('ARMED, touching it COUNTERS it: his own cut-in and his own shot back (M4 41.77 s)',
     c && c.countered && m.ball.power && m.ball.power.owner === 1 && m.ball.power.fam === 'updown' && m.cutinBy === 1);
  ok('…and the counter spends his arm (the press already spent his meter)', m.players[1].armed === 0 && m.players[1].gauge < 0.2);
}
{
  const { m, z, log } = atDefender('ground', {}, { kick: true });
  const h = log.find((e) => e.type === 'powerHit');
  ok('GROUND cannot be blocked: a kick does not stop it, it trips him and rolls on', h && h.how === 'pass' && !log.some((e) => e.type === 'blocked') && m.ball.power && m.ball.power.ph === 'roll');
  track(m, 0.1);
  ok('…through where he stood', m.ball.x > z.x);
}
{
  const { m, log } = atDefender('critical', {}, { kick: true });
  ok('CRITICAL goes THROUGH a block, still the shot at full pace', log.some((e) => e.type === 'powerHit' && e.how === 'through') && m.ball.power && !m.ball.power.hit);
  const d = atDefender('destructive', {}, { kick: true });
  ok('DESTRUCTIVE smashes a block aside', d.log.some((e) => e.type === 'powerHit' && e.how === 'smash'));
}
{
  const { m, z, log } = atDefender('grab');
  ok('GRAB seizes a defender who does not kick it (M3 74.1 s): stars at once', log.some((e) => e.type === 'grabbed' && e.player === 1) && z.ail === 'stars' && m.ball.power.ph === 'grab');
  ok('…and the ball it carried pops loose, up (M3 74.08 s)', m.ball.vy < -300);
  const x0 = z.x, a = m.players[0];
  const rel = [];
  let ticks = 0;
  for (let i = 0; i < 240 && m.phase === 'play' && !rel.length; i++) { step(m, NONE); ticks++; rel.push(...m.events.filter((e) => e.type === 'released')); m.events.length = 0; }
  ok('…drags him BACK to the shooter, away from his own goal, in ≈0.2 s (M3 74.08–74.30 s; wiki "pull the defender back")',
     rel.length && (z.x - x0) * z.side > 150 && Math.abs(z.x - a.x) < C.HEAD_R * 2 + 30 && ticks < 20, `moved ${(z.x - x0).toFixed(0)} in ${ticks} ticks, gap ${Math.abs(z.x - a.x).toFixed(0)}`);
  ok('…and flings him straight up, thrown and dazed, the ball loose again', z.ail === 'thrown' && z.vy < -1000 && z.stunned > 1 && !m.ball.power);
  let top = z.y, air = 0;
  for (let i = 0; i < 120 && !(air > 5 && z.onGround); i++) { step(m, NONE); m.events.length = 0; top = Math.min(top, z.y); air++; }
  ok('…off the top of the screen and back down in ≈1.2 s (M3 74.3–75.5 s), still dazed on landing',
     top < C.GROUND_Y - C.VIEW_ABOVE_GROUND - 40 && Math.abs(air * C.TICK - 1.2) < 0.15 && z.stunned > 0, `apex ${top.toFixed(0)}, ${(air * C.TICK).toFixed(2)} s`);
  const k = atDefender('grab', {}, { kick: true });
  ok('…but a KICK blocks the claw like any other shot', k.log.some((e) => e.type === 'blocked'));
}
{
  // Stage 2's gentle Grab (the approved decision): dragged a third of the way, and a jump breaks it.
  const { m, z } = atDefender('grab', { gentle: true, intensity: 0.1 });
  ok('(gentle grab has hold)', m.ball.power && m.ball.power.ph === 'grab' && z.stunned === 0);
  step(m, [{}, { jump: true }]);
  const log = [...m.events]; m.events.length = 0;
  for (let i = 0; i < 5; i++) { step(m, NONE); log.push(...m.events); m.events.length = 0; }
  ok('a JUMP breaks a gentle grab', log.some((e) => e.type === 'released' && e.broke) && !m.ball.power);
  const g = atDefender('grab', { gentle: true, intensity: 0.1 });
  const x0 = g.z.x, line = g.a.x;
  for (let i = 0; i < 300 && g.m.ball.power; i++) { step(g.m, NONE); g.m.events.length = 0; }
  ok('a gentle grab drags him only about a third of the way back to the shooter', Math.abs(g.z.x - x0) < Math.abs(line - x0) / 3 + 20 && Math.abs(g.z.x - x0) > 20 && g.z.x < x0,
     `${Math.abs(g.z.x - x0).toFixed(0)} of ${Math.abs(line - x0).toFixed(0)}`);
}
{
  const { m, z } = fireFam('multiball');
  const e = m.xballs[0];
  z.x = e.x + 60; z.y = C.GROUND_Y; e.y = headY(z);
  const log = [];
  for (let i = 0; i < 10; i++) { step(m, NONE); log.push(...m.events); m.events.length = 0; }
  ok('a Multi-Ball extra is knocked dead by one touch, and leaves the pitch', log.some((q) => q.type === 'blocked' && q.extra) && !m.xballs.includes(e));
}

// ═══ 13. AILMENTS ════════════════════════════════════════════════════════════
// reverse (???), shock (half speed, no jump), freeze (no control), beheaded (no head), burn (no
// kick), stars (dazed). In player state as two scalars, `ail` and `ailT`, on the wall clock.
{
  const on = (ail) => { const m = fresh(); const p = m.players[0]; applyAilment(m, p, ail, 2); m.events.length = 0; return { m, p }; };
  { const { m, p } = on('reverse'); step(m, [{ right: true }, {}]); ok('REVERSE: right runs left', p.vx < 0, `vx ${p.vx}`); }
  { const { m, p } = on('shock'); step(m, [{ right: true }, {}]); const vx = p.vx; step(m, [{ jump: true }, {}]);
    ok('SHOCK: half speed, and no jump', Math.abs(vx - C.PLAYER_SPEED * 0.5) < 1 && p.onGround, `vx ${vx}`); }
  { const { m, p } = on('freeze'); const x = p.x; run(m, 10, [{ right: true, jump: true }, {}]); ok('FREEZE: frozen solid', Math.abs(p.x - x) < 0.5 && p.onGround); }
  { const { m, p } = on('stars'); const x = p.x; run(m, 10, [{ left: true }, {}]); ok('STARS: dazed, no control', Math.abs(p.x - x) < 0.5); }
  { const { m, p } = on('burn'); step(m, [{ right: true }, {}]); ok('BURN: the walk runs backwards (wiki Power_Button_Damage_Effects)', p.vx < 0, `vx ${p.vx}`); }
  { const { m, p } = on('freeze'); step(m, [{ power: true }, {}]); p.gauge = 1; step(m, NONE); step(m, [{ power: true }, {}]); ok('FREEZE: the frozen player can still arm POWER (wiki, Russia)', p.armed > 0); }
  { const { m, p } = on('beheaded'); m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0; step(m, NONE);
    ok('BEHEADED: the ball passes where the head was', Math.abs(m.ball.x - p.x) < 1 && !m.events.some((e) => e.type === 'strike')); }
  { const { m, p } = on('beheaded'); const x = p.x; run(m, 10, [{ right: true }, {}]); ok('BEHEADED: "unable to do anything for a moment" (wiki, Honduras)', Math.abs(p.x - x) < 0.5); }
  { const { m, p } = on('shock'); run(m, TICK_S(2) + 2);
    ok('an ailment ends on its clock', p.ail === '' && p.ailT === 0); }
  { const { m, p } = on('freeze'); ok('a shorter ailment does not replace a longer one', !applyAilment(m, p, 'reverse', 1) && p.ail === 'freeze'); }
  // …and a shot's ailment lands on the player it hits: a straight shot that BURNS (legendary 3's map
  // family, before its own power — the Sizzle Line — took over).
  const m = fresh();
  const [a, z] = m.players;
  a.shot = shotById('straight', { ailment: 'burn' });
  ok('(a burning straight shot)', a.shot.family === 'straight' && a.shot.ailment === 'burn');
  z.x = a.x + 300; m.gaugeLead = 0;
  arm(m, 0); m.ball.x = a.x; m.ball.y = headY(a); step(m, NONE);
  for (let i = 0; i < 120 && z.ail !== 'burn'; i++) { step(m, NONE); m.events.length = 0; }
  ok('the shot\'s ailment lands on the player it hits', z.ail === 'burn' && z.ailT > 1.5);
}

// ═══ 14. THE PRESS: THE ARMING AURA ═════════════════════════════════════════
{
  const aura = (kind, gap) => {
    const m = fresh();
    const [a, z] = m.players;
    a.shot = shotById('straight', { aura: kind, auraRadius: 105 });
    z.x = a.x + gap;
    a.gauge = 1; a.prev = {};
    step(m, [{ power: true }, {}]);
    return { m, a, z, ev: m.events.find((e) => e.type === 'aura') };
  };
  const push = aura('push', 80);
  ok('PUSH: the press throws a close opponent away', push.ev && push.ev.hit && push.z.vx > 200 && push.a.armed > 0);
  const far = aura('push', 200);
  ok('…not one outside the radius', far.ev && !far.ev.hit && Math.abs(far.z.vx) < 1);
  ok('FREEZE: the press freezes a close opponent', aura('freeze', 80).z.ail === 'freeze');
  ok('REVERSE: …reverses his controls', aura('reverse', 80).z.ail === 'reverse');
  const st = aura('stun', 80);
  ok('STUN: …dazes him (stars)', st.z.stunned > 0 && st.z.ail === 'stars');
  const none = aura('none', 20);
  ok('no aura: the press touches nobody', !none.ev && none.z.vx === 0 && !none.z.ail);
}

// ═══ 15. THE SNAPSHOT CARRIES ALL OF IT ═════════════════════════════════════
// Online resyncs from snapshots, so every live power state has to survive serialize → restore
// and replay identically: a grind, a grab, a Multi-Ball's extras, the Aerial up in the sky, and
// an ailment on a player.
{
  const cases = [
    ['grind', () => { const r = atDefender('straight', {}, { kick: true }); return r.m; }],
    ['grab', () => atDefender('grab').m],
    ['multiball', () => { const r = fireFam('multiball'); track(r.m, 0.05); return r.m; }],
    ['aerial', () => { const r = fireFam('aerial'); track(r.m, 0.5); return r.m; }],
    ['ailment', () => { const r = atDefender('straight'); applyAilment(r.m, r.m.players[0], 'reverse', 2); return r.m; }],
  ];
  for (const [name, make] of cases) {
    const m = make();
    const snap = JSON.parse(JSON.stringify(serialize(m)));
    const r = createMatch(CA, CB, {}); r.players.forEach((p, i) => { p.shot = m.players[i].shot; });
    restore(r, snap);
    const seq = (i) => [{ right: i % 20 < 10, kick: i % 17 === 0 }, { left: i % 25 < 12, jump: i % 31 === 0 }];
    for (let i = 0; i < 90; i++) { step(m, seq(i)); step(r, seq(i)); m.events.length = 0; r.events.length = 0; }
    ok(`a snapshot mid-${name} restores and replays identically`, JSON.stringify(serialize(m)) === JSON.stringify(serialize(r)));
  }
  const m = fireFam('multiball').m;
  const s = serialize(m);
  ok('the snapshot carries the extra balls and the ailment fields', Array.isArray(s.xb) && s.xb.length >= 1 && s.p[0].length >= 27);
}

// ═══ 9. THE RANDOM MATCH MODIFIERS ARE GONE ══════════════════════════════════
{
  // AT THE SOURCE. A match has no state for any of them to live in, so there is nothing to
  // spawn into and nothing to restore from.
  const m = createMatch(CA, CB, {});
  for (const key of ['spec', 'pu', 'cards', 'sk']) {
    ok(`a match carries no ${key} state`, m[key] === undefined, `m.${key} = ${typeof m[key]}`);
  }
}
{
  // AND NO DIAL. The tuner builds itself from C.TUNABLE, so a constant that is still there
  // is a switch somebody can flip mid-match. None of these may exist.
  const gone = ['SPECTACLE_ON', 'WIND_FORCE', 'WIND_TIME', 'MOON_TIME', 'MOON_GRAV_BALL',
                'MOON_GRAV_PLAYER', 'METEOR_WARN', 'METEOR_R', 'ROBOT_DEFICIT', 'ROBOT_TIME',
                'PICKUPS_ON', 'PICKUP_FIRST', 'PU_MAGNET_FORCE', 'PU_MAGNET_RANGE',
                'PU_MAGNET_TIME', 'PU_GROW_SCALE', 'PU_ICE_TIME', 'CARDS_ON'];
  for (const k of gone) {
    ok(`${k} is not a constant any more`, C[k] === undefined, `C.${k} = ${C[k]}`);
    ok(`${k} is not tunable`, !C.TUNABLE.includes(k));
  }
  // …and tune() ignores what it does not know, so an old saved preset cannot resurrect one.
  C.tune({ SPECTACLE_ON: 1, PICKUPS_ON: 1, CARDS_ON: 1, WIND_FORCE: 900 });
  ok('an old preset cannot switch one back on',
     C.SPECTACLE_ON === undefined && C.PICKUPS_ON === undefined && C.WIND_FORCE === undefined);
}
{
  // NOTHING BENDS A LOOSE BALL BUT GRAVITY. Wind was a horizontal acceleration and the
  // magnet another; a ball dropped from rest must fall dead straight down, every time.
  const m = fresh();
  m.players[0].x = 60; m.players[1].x = C.W - 60;     // both far from the ball
  m.ball.x = C.W / 2; m.ball.y = 120; m.ball.vx = 0; m.ball.vy = 0;
  const x0 = m.ball.x;
  run(m, 90);
  ok('a dropped ball does not drift sideways', Math.abs(m.ball.x - x0) < 0.001,
     `drifted ${(m.ball.x - x0).toFixed(3)}px`);
}
{
  // AND GRAVITY IS ALWAYS THE SAME GRAVITY. Low gravity was a phase that lightened the ball
  // for several seconds at a time, so the test is that two drops, minutes apart in match
  // time, fall identically.
  const drop = (warmup) => {
    const m = fresh();
    m.players[0].x = 60; m.players[1].x = C.W - 60;
    run(m, warmup);
    m.ball.x = C.W / 2; m.ball.y = 120; m.ball.vx = 0; m.ball.vy = 0;
    const y0 = m.ball.y;
    run(m, 30);
    return m.ball.y - y0;
  };
  const early = drop(0);
  const late = drop(1500);                             // 25s later: deep into act territory
  ok('the ball falls the same distance 25 seconds apart',
     Math.abs(early - late) < 0.001, `${early.toFixed(2)}px vs ${late.toFixed(2)}px`);
}
{
  // WHOLE MATCHES, AND NOT ONE EVENT FROM A REMOVED SYSTEM. This is the backstop: everything
  // above tests a mechanism, and this tests the outcome over real play.
  const banned = /^(meteor|moon|wind|robot|pu|card|dart|dog|wall|super)/i;
  let seen = new Set();
  for (let s = 0; s < 3; s++) {
    let x = 1000 + s * 77;
    const rng = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
    const m = createMatch(CA, CB, {});
    const bots = [createBot(4, rng), createBot(2, rng)];
    for (let i = 0; i < 6000 && m.phase !== 'over'; i++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      for (const e of m.events) if (banned.test(e.type)) seen.add(e.type);
      m.events.length = 0;
    }
  }
  ok('three full matches produce no modifier events at all', seen.size === 0,
     [...seen].join(', '));
}

// ═══ 10. THE GAME STILL WORKS ════════════════════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  const x0 = p.x;
  run(m, 30, [{ right: true }, {}]);
  const xRight = p.x;
  ok('a player still walks right', xRight > x0 + 20, `moved ${(xRight - x0).toFixed(1)}px`);
  run(m, 30, [{ left: true }, {}]);
  // Measured from where they GOT to, not from where they began: half a second of left after
  // half a second of right does not get you all the way home, and it never did.
  ok('and still walks left', p.x < xRight - 20, `${xRight.toFixed(1)} -> ${p.x.toFixed(1)}`);
}
{
  const m = fresh();
  const p = m.players[0];
  step(m, [{ jump: true }, {}]);
  run(m, 10, [{ jump: true }, {}]);
  ok('a player still jumps', p.y < C.GROUND_Y - 20, `y=${p.y.toFixed(1)}`);
  run(m, 120);
  ok('and still comes down', p.y === C.GROUND_Y && p.onGround);
}
{
  const m = fresh();
  const p = m.players[0];
  p.x = 400; p.facing = 1; p.kickCd = 0; p.prev = {};
  m.ball.x = p.x + C.KICK_REACH; m.ball.y = p.y - C.BODY_H * 0.45;
  m.hitStop = 0;
  step(m, [{ kick: true }, {}]);
  ok('a kick still strikes the ball', m.events.some((e) => e.type === 'strike'),
     m.events.map((e) => e.type).join(','));
  ok('and sends it the way the boot pointed', m.ball.vx > 0, `vx=${m.ball.vx.toFixed(0)}`);
}
{
  const m = fresh();
  m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.y = C.GROUND_Y - 30; m.ball.vx = 700;
  for (let i = 0; i < 20 && m.score[0] === 0; i++) { m.hitStop = 0; step(m, NONE); }
  ok('a goal still counts', m.score[0] === 1, `score ${m.score.join('-')}`);
  for (let i = 0; i < 400 && m.phase !== 'goal'; i++) { m.hitStop = 0; step(m, NONE); }   // play runs on under GOAL!
  ok('and still restarts from the spot',
     Math.abs(m.ball.x - C.BALL_SPAWN.x) < 1 && m.phase === 'goal');
}
{
  const m = fresh();
  const y0 = m.ball.y;
  run(m, 10);
  ok('the ball still falls', m.ball.y > y0);
  // It BOUNCES, so "reaches the grass" is sampled rather than checked at one tick: a fixed
  // count lands mid-bounce, and past BALL_IDLE_RESET the anti-stall has respawned it anyway.
  const floor = C.GROUND_Y - C.BALL_R;
  let touched = false, sank = 0;
  for (let i = 0; i < 300; i++) {
    step(m, NONE);
    if (m.ball.y >= floor - 0.5) touched = true;
    sank = Math.max(sank, m.ball.y - floor);
  }
  ok('and reaches the grass', touched, `y=${m.ball.y.toFixed(1)}`);
  ok('without sinking through it', sank < 1, `${sank.toFixed(2)}px under`);
}

// ═══ 16. THE CHAMPIONS' OWN POWERS (shared/champion-powers.js) ═════════════════
// Each built arcade champion fires one real Head Soccer character's power. Fired here from its card
// in an arcade match, from either seat, at a defender `gap` px away who stands, kicks or jumps.
function fireCp(stage, seat, { gap = 400, kick = false, jump = false, s = 2.5, preKick = null } = {}) {
  const cards = [];
  cards[seat] = { rarity: 'legendary', number: stage }; cards[1 - seat] = { rarity: 'epic', number: 1 };
  const m = createMatch(cards[0], cards[1], { champions: true, duration: 600 });
  m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  const a = m.players[seat], z = m.players[1 - seat];
  const X = (x) => (seat === 0 ? x : C.W - x);
  a.x = X(300); z.x = X(300 + gap);
  arm(m, seat);
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE);
  const log = [...m.events]; m.events.length = 0;
  const pw0 = m.ball.power ? { ...m.ball.power } : null;
  // `preKick`: KICK goes in that many s before the ball leaves (a shot released close cannot be met
  // by a press after it leaves: the boot is up only 0.12 s after the press).
  let pressed = false;
  while (m.hitStop > 0) {
    const inp = [{}, {}];
    if (preKick != null && !pressed && m.hitStop <= preKick) { pressed = true; inp[1 - seat] = { kick: true }; }
    step(m, inp); log.push(...m.events); m.events.length = 0;
  }
  const path = [];
  for (let i = 0; i < TICK_S(s) && m.phase === 'play'; i++) {
    const b = m.ball, inp = [{}, {}];
    if (kick && !pressed && b.power && b.power.owner === seat && Math.abs(b.x - z.x) < Math.max(40, Math.abs(b.vx) * kickLead(b)) && m.hitStop <= 0) { pressed = true; inp[1 - seat] = { kick: true }; }
    if (jump && b.power && b.power.owner === seat && Math.abs(b.x - z.x) < 220) inp[1 - seat] = { jump: true };
    step(m, inp);
    path.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, ph: b.power ? b.power.ph : null, cp: b.power ? b.power.cp : null, inv: b.power ? b.power.inv : 0, zy: z.y, zx: z.x, zail: z.ail, zst: z.stunned });
    log.push(...m.events.map((e) => ({ ...e, i }))); m.events.length = 0;
  }
  return { m, a, z, log, path, pw0 };
}
const first = (log, type, f = () => true) => log.find((e) => e.type === type && f(e));
{
  // every built one: fires from both seats with its own id, toward the other goal, and flies the
  // same twice (rollback)
  for (const n of BUILT_STAGES) {
    for (const seat of [0, 1]) {
      const r = fireCp(n, seat);
      const d = CHAMPION_POWERS[n];
      ok(`power ${n} ${d.id} (seat ${seat}): fires its own power`, r.pw0 && r.pw0.cp === d.id && r.pw0.dir === r.a.side && !!first(r.log, 'powershot', (e) => e.cp === d.id && e.player === seat));
      const r2 = fireCp(n, seat);
      ok(`power ${n} ${d.id} (seat ${seat}): flies the same twice`, JSON.stringify(serialize(r.m)) === JSON.stringify(serialize(r2.m)));
    }
  }
  const src = readFileSync(new URL('./shared/champion-powers.js', import.meta.url), 'utf8') +
    BUILT_STAGES.map((n) => readFileSync(new URL(`./shared/champion-powers/stage-${String(n).padStart(2, '0')}.js`, import.meta.url), 'utf8')).join('\n');
  ok('champion-powers uses no Math.sin / cos / tan / random', !/Math\.(sin|cos|tan|random)\b/.test(src.replace(/\/\/.*$/gm, '')));
}
{
  // THE ORIGINAL POWERS FIRE EVERYWHERE (Idan, 2026-10-11): a legendary card 1–5 fires its own power
  // in free play and online too, not only in the arcade — at one strength; a Head Soccer copy not
  // yet replaced (stage 6) stays the arcade's.
  for (const n of BUILT_STAGES) {
    const d = CHAMPION_POWERS[n];
    const free = createMatch({ rarity: 'legendary', number: n }, { rarity: 'epic', number: 1 }, {});
    if (d.everywhere) ok(`power ${n} ${d.id}: fires everywhere (free play)`, free.players[0].shot.cp === d.id && free.players[0].shot.intensity === 0.5);
    else ok(`power ${n} ${d.id}: a Head Soccer copy, the arcade's only`, !free.players[0].shot.cp);
  }
}
{
  // POWER 1 — BROADSIDE (the Cannoneer, Idan 2026-10-12): the touch loads the ball down the barrel and
  // the cannon fires three times, GAP s apart from the release — two shells (never a goal: a kick on
  // the swing up parries one, anything else is the power hit, the arm kept) and then the ball itself,
  // a straight power shot (counter, kick-block — fired back as ONE shot — or the heavy thud on a
  // body). Planted and tackle-proof while loaded; full time and the golden goal clean it all up.
  const { BROADSIDE } = await import('./shared/champion-powers/stage-01.js');
  const { SHELL } = await import('./shared/power-zones.js');
  const { powerHolds } = await import('./shared/hs-powers.js');
  // seat fires at a defender `gap` px in front (negative: behind him); `foe(m, i, z)` / `me(m, i, a)`
  // give their inputs tick by tick after the cut-in. Returns the log with tick numbers from the release.
  const barrage = (seat, { gap = 400, s = 4.5, foe = null, me = null, armFoe = false, setup = null } = {}) => {
    const cards = []; cards[seat] = { rarity: 'legendary', number: 1 }; cards[1 - seat] = { rarity: 'epic', number: 1 };
    const m = createMatch(cards[0], cards[1], { duration: 600 });
    m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0;
    const a = m.players[seat], z = m.players[1 - seat];
    const X = (x) => (seat === 0 ? x : C.W - x);
    a.x = X(300); z.x = X(300 + gap);
    if (armFoe) { z.armed = 1; }
    if (setup) setup(m, a, z);
    arm(m, seat);
    m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    const log = m.events.map((e) => ({ ...e, i: -1 })); m.events.length = 0;
    while (m.hitStop > 0) { step(m, NONE); log.push(...m.events.map((e) => ({ ...e, i: -1 }))); m.events.length = 0; }
    const trace = [];
    for (let i = 0; i < TICK_S(s) && m.phase === 'play'; i++) {
      const inp = [{}, {}];
      if (foe) inp[1 - seat] = foe(m, i, z) || {};
      if (me) inp[seat] = me(m, i, a) || {};
      step(m, inp);
      trace.push({ i, ax: a.x, ay: a.y, zx: z.x, zst: z.stunned, ph: m.ball.power ? m.ball.power.ph : null, bx: m.ball.x, vx: m.ball.vx, vy: m.ball.vy, score: m.score[seat], held: powerHolds(m, a) });
      log.push(...m.events.map((e) => ({ ...e, i }))); m.events.length = 0;
    }
    return { m, a, z, log, trace, X };
  };
  const all = (log, type, f = () => true) => log.filter((e) => e.type === type && f(e));
  // a defender who walks back out to his spot (720 px from the shooter's end) whenever a shell has
  // thrown him into his net — what anybody does — and otherwise stands
  const walkBack = (spot = 720) => (m, i, z) => { const x = z.side < 0 ? z.x : C.W - z.x; return x > spot + 4 ? { [z.side < 0 ? 'left' : 'right']: true } : {}; };
  // a kick timed to meet whatever of his is coming: a shell, or the ball once it flies
  const parry = (m, i, z) => {
    const sh = m.zones.find((q) => q.k === 'shell' && q.own !== z.index);
    const bp = m.ball.power, tx = sh ? sh.x0 : bp && bp.ph === 'fly' && bp.owner !== z.index ? m.ball.x : null;
    const d = tx == null ? 9e9 : Math.abs(tx - z.x);
    return { kick: d < 380 && d > 340 && !(z.kickT > 0) };
  };
  for (const seat of [0, 1]) {
    const tag = `BROADSIDE (seat ${seat})`;
    // nobody in the way (the defender behind him): the timeline, the shells, the ball
    const r = barrage(seat, { gap: -200, s: 4 });
    const fires = all(r.log, 'cannonFire');
    const gap = TICK_S(BROADSIDE.GAP);
    ok(`${tag}: three shots — the release, +${BROADSIDE.GAP} s, +${2 * BROADSIDE.GAP} s; shells then the ball`,
      fires.length === 3 && fires[0].i === 0 && Math.abs(fires[1].i - gap) <= 1 && Math.abs(fires[2].i - 2 * gap) <= 1 && !fires[0].real && !fires[1].real && fires[2].real,
      fires.map((e) => `${e.n}@${e.i}`).join(' '));
    const bursts = all(r.log, 'shellBurst'), goals = all(r.log, 'goal');
    ok(`${tag}: the shells burst on the goal line and never score — the ball does`,
      bursts.length === 2 && goals.length === 1 && goals[0].i > fires[2].i && goals[0].player === seat, `${bursts.length} bursts, goals at ${goals.map((g) => g.i)}`);
    const fly = r.trace.filter((q) => q.ph === 'fly');
    ok(`${tag}: the ball leaves dead flat at the comet's pace`, fly.length > 3 && fly.every((q) => Math.abs(q.vy) < 1) && Math.abs(fly[1].vx - r.a.side * C.POWER_SHOT_SPEED * BROADSIDE.SPEED) < 20, fly[1] && `${fly[1].vx.toFixed(0)}`);
    ok(`${tag}: loaded, nobody touches the ball (it sits in the barrel)`, r.trace.filter((q) => q.ph === 'load').every((q, k, a) => k === 0 || q.bx === a[k - 1].bx));

    // planted: his own buttons do nothing while loaded, and a tackle cannot reach him
    const pl = barrage(seat, { gap: 60, s: 2.8, me: (m, i) => ({ right: true, left: i % 40 < 20, jump: i % 30 === 0, kick: i % 20 === 0 }), foe: (m, i) => ({ kick: i % 18 === 0, [seat === 0 ? 'left' : 'right']: i % 60 < 10 }) });
    const held = pl.trace.filter((q) => q.held);
    ok(`${tag}: planted while loaded — his buttons do nothing, a tackle does not touch him`,
      held.length > 100 && held.every((q) => q.ax === held[0].ax && q.ay === held[0].ay) && !all(pl.log, 'tackle', (e) => e.on === seat).length && !(pl.a.stunned > 0),
      `${held.length} held ticks, x ${held[0] && held[0].ax.toFixed(1)} → ${held.at(-1) && held.at(-1).ax.toFixed(1)}`);

    // a shell hit is the power hit — thrown toward his goal, his face marked, his arm kept — dazed DAZE s
    const h = barrage(seat, { gap: 400, s: 0.6, armFoe: true });
    const hit = all(h.log, 'powerHit', (e) => e.how === 'shell' && e.player === 1 - seat)[0];
    const st = h.trace.find((q) => q.i === (hit && hit.i));
    ok(`${tag}: a shell hits a defender in its line — thrown, dazed, marked, still armed`,
      !!hit && st && Math.abs(st.zst - BROADSIDE.DAZE) < 0.05 && h.z.hurt >= 1 && h.z.armed > 0 && (h.X(h.z.x) - 700) > 100,
      hit ? `daze ${st && st.zst.toFixed(2)}, thrown ${(h.X(h.z.x) - 700).toFixed(0)} px` : 'no hit');
    // …and still armed, he counters the ball when it comes (the shells cannot be countered)
    const c = barrage(seat, { gap: 420, s: 4.6, armFoe: true, foe: walkBack() });
    ok(`${tag}: an armed defender hit by the shells still counters the ball`,
      all(c.log, 'powerHit', (e) => e.how === 'shell').length >= 1 && !!first(c.log, 'powershot', (e) => e.player === 1 - seat && e.countered),
      `shell hits ${all(c.log, 'powerHit', (e) => e.how === 'shell').length}`);

    // a kick on the swing up parries a shell: it bursts, he is nudged back, no daze
    const p = barrage(seat, { gap: 450, s: 5.6, foe: parry });
    const parries = all(p.log, 'shellParry', (e) => e.player === 1 - seat);
    ok(`${tag}: a timed kick parries each shell — no hit, no daze`, parries.length === 2 && !all(p.log, 'powerHit', (e) => e.how === 'shell' && e.player === 1 - seat).length && p.trace.every((q) => q.i >= (all(p.log, 'blocked')[0]?.i ?? 9e9) || !(q.zst > 0)),
      `${parries.length} parries`);
    // …and the same kick blocks the ball: the grind, then the blocker fires THE WHOLE BARRAGE back
    // (Idan 2026-10-13) — two shells of his own, then the ball, held where he stands while it plays
    const fb = barrage(seat, { gap: 450, s: 7, foe: parry });
    const blk = first(fb.log, 'blocked', (e) => e.player === 1 - seat && e.cp === 'broadside');
    const back = first(fb.log, 'powershot', (e) => e.player === 1 - seat && e.rebound);
    const his = all(fb.log, 'cannonFire', (e) => e.player === 1 - seat);
    ok(`${tag}: the ball is kick-blocked, and the blocker fires the whole barrage back`,
      !!blk && !!back && his.length === 3 && his.map((e) => e.n).join() === '1,2,3' && his[2].real &&
      all(fb.log, 'zone', (e) => e.own === 1 - seat && e.k === 'shell').length === 2 &&
      Math.abs(his[1].i - his[0].i - TICK_S(BROADSIDE.GAP)) <= 6, his.map((e) => `${e.n}@${e.i}`).join(' '));

    // the ball on a body: the power hit, and the cannonball thuds down and rolls on (not back)
    const t = barrage(seat, { gap: 420, s: 4.6, foe: walkBack() });
    const bh = first(t.log, 'powerHit', (e) => e.how === 'cannon' && e.player === 1 - seat);
    const after = bh && t.trace.find((q) => q.i === bh.i + 2);
    ok(`${tag}: the ball on a body is the hit, and it thuds down rolling on (not back)`, !!bh && after && after.vx * r.a.side > 0 && after.vx * r.a.side <= BROADSIDE.THUD_VX + 5, after && `vx ${after.vx.toFixed(0)}`);
  }
  {
    // FULL TIME under the barrage: the whistle ends it — no shells left, nobody held
    const ft = barrage(0, { gap: -200, s: 2, setup: (m) => { m.clock = 1.9; m.score = [1, 0]; } });
    ok('BROADSIDE: full time mid-barrage clears the shells and the load', ft.m.phase === 'over' && !ft.m.zones.length && !powerHolds(ft.m, ft.a));
    // the GOLDEN GOAL's restart under it: the ball back on the spot, no shells, nobody held
    const gg = barrage(0, { gap: -200, s: 2.2, setup: (m) => { m.clock = 1.9; m.score = [1, 1]; } });
    ok('BROADSIDE: the golden-goal restart mid-barrage clears it too', gg.m.golden && !gg.m.zones.length && !gg.m.ball.power && !powerHolds(gg.m, gg.a));
    // ROLLBACK: restored mid-barrage (a shell in the air, the ball in the barrel), the same future
    const A = barrage(0, { gap: -200, s: BROADSIDE.GAP + 0.05 });
    ok('BROADSIDE: mid-barrage there is a shell in flight and the ball is loaded', A.m.zones.some((z) => z.k === 'shell') && A.m.ball.power && A.m.ball.power.ph === 'load', `${A.m.zones.length} zones`);
    const B = createMatch({ rarity: 'legendary', number: 1 }, { rarity: 'epic', number: 1 }, { duration: 600 });
    restore(B, serialize(A.m));
    for (let i = 0; i < TICK_S(3.5); i++) { step(A.m, NONE); step(B, NONE); }
    A.m.events.length = 0; B.events.length = 0;
    ok('BROADSIDE: restored mid-barrage, it plays out the same', JSON.stringify(serialize(A.m)) === JSON.stringify(serialize(B)));
    // A COUNTER BY THE CANNONEER is his own shot: the barrage, from his barrel
    const m = createMatch({ rarity: 'common', number: 0 }, { rarity: 'legendary', number: 1 }, { duration: 600 });
    m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0; m.ballWait = 0;
    m.players[0].x = 300; m.players[1].x = 700;
    arm(m, 0); arm(m, 1);
    m.ball.x = 300; m.ball.y = headY(m.players[0]); step(m, NONE);
    let loaded = false;
    for (let i = 0; i < TICK_S(3); i++) { step(m, NONE); if (m.ball.power && m.ball.power.owner === 1 && m.ball.power.ph === 'load') loaded = true; }
    ok('BROADSIDE: countered by the Cannoneer, his own barrage loads', loaded);
    ok(`BROADSIDE: a parried shell nudges the kicker back (${SHELL.PARRY_V} px/s), no daze`, SHELL.PARRY_V > 0 && SHELL.PARRY_T > 0);
  }
}
{
  // POWER 2 — WORM TUNNEL AMBUSH (Lord of the Worms, Idan 2026-10-13): the worm dives with the ball,
  // tunnels under the pitch, holds under a ring, and spits it in a lob at the goal. Underground
  // nobody touches it; the lob is a straight power shot with its own answers (the stomp, the early
  // header, the swing block, the crown) and a hit coils.
  const { WORM, emergeX } = await import('./shared/champion-powers/stage-02.js');
  const { powerHolds } = await import('./shared/hs-powers.js');
  // seat fires from X(300); `place(m, z, pw)` puts the defender (after the touch); `inp(m, z, pw)`
  // his input each tick; `setup(m)` before the touch
  function worm(seat, { place = null, inp = null, s = 3.2, setup = null, cardB = { rarity: 'epic', number: 1 } } = {}) {
    const cards = []; cards[seat] = { rarity: 'legendary', number: 2 }; cards[1 - seat] = cardB;
    const m = createMatch(cards[0], cards[1], { champions: true, duration: 600 });
    m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
    const a = m.players[seat], z = m.players[1 - seat];
    a.x = seat === 0 ? 300 : C.W - 300; z.x = seat === 0 ? 120 : C.W - 120;
    if (setup) setup(m, a, z);
    arm(m, seat);
    m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    const pw0 = m.ball.power ? { ...m.ball.power } : null;
    if (place && pw0) place(m, z, pw0);
    const log = [...m.events]; m.events.length = 0;
    const trace = [];
    for (let i = 0; i < TICK_S(1.5 + s) && m.phase === 'play'; i++) {
      const b = m.ball, pw = b.power, ins = [{}, {}];
      if (inp) ins[1 - seat] = inp(m, z, pw) || {};
      step(m, ins);
      trace.push({ i, x: b.x, y: b.y, vx: b.vx, vy: b.vy, ph: b.power ? b.power.ph : null, own: b.power ? b.power.owner : -1, hold: m.hitStop > 0, zst: z.stunned, zail: z.ail });
      log.push(...m.events.map((e) => ({ ...e, i }))); m.events.length = 0;
    }
    return { m, a, z, pw0, log, trace, gx: seat === 0 ? C.W - C.GOAL_W : C.GOAL_W };
  }
  const span = (tr, ph) => tr.filter((q) => q.ph === ph && !q.hold).length * C.TICK;
  for (const seat of [0, 1]) {
    const tag = `WORM TUNNEL (seat ${seat})`;
    const r = worm(seat);
    const order = [...new Set(r.trace.filter((q) => q.ph && !q.hold).map((q) => q.ph))];
    ok(`${tag}: dive, tunnel, ring, lob — in that order`, order.slice(0, 4).join(',') === 'wdive,tunnel,warn,fly', order.join(','));
    ok(`${tag}: the tunnel lasts TUNNEL s and the ring WARN s`, Math.abs(span(r.trace, 'tunnel') - WORM.TUNNEL) < 2.5 * C.TICK && Math.abs(span(r.trace, 'warn') - WORM.WARN) < 2.5 * C.TICK, `${span(r.trace, 'tunnel').toFixed(2)} / ${span(r.trace, 'warn').toFixed(2)}`);
    const D = (r.gx - r.pw0.ex) * r.a.side;
    ok(`${tag}: comes up ${WORM.MIN_LINE}–${WORM.FAR} px out from the goal line`, D >= WORM.MIN_LINE - 0.5 && D <= WORM.FAR + 0.5, `${D.toFixed(0)} px`);
    ok(`${tag}: underground the ball lies on the grass line, unseen`, r.trace.filter((q) => q.ph === 'tunnel').every((q) => Math.abs(q.y - (C.GROUND_Y - C.BALL_R)) < 0.01));
    const w = first(r.log, 'wormWarn'), bu = first(r.log, 'wormBurst');
    ok(`${tag}: the ring is up ≥ 0.4 s before the ball comes out`, !!w && !!bu && (bu.i - w.i) * C.TICK >= 0.4 - 1e-9, w && bu && `${((bu.i - w.i) * C.TICK).toFixed(2)} s`);
    ok(`${tag}: a burrow on the pitch, gone after`, !!first(r.log, 'zone', (e) => e.k === 'burrow'));
    ok(`${tag}: unopposed, the lob scores`, r.m.score[seat] === 1, `${r.m.score}`);
    // standing on the tunnel's way: nothing touches him while it is under him
    const u = worm(seat, { place: (m, z, pw) => { z.x = (pw.dx + pw.ex) / 2; } });
    const under = u.trace.filter((q) => ['wdive', 'tunnel', 'warn'].includes(q.ph));
    ok(`${tag}: underground it touches nobody`, under.length > 60 && under.every((q) => !(q.zst > 0)) && !u.log.some((e) => (e.type === 'powerHit' || e.type === 'blocked') && e.i <= under[under.length - 1].i));
    // ONLY STANDING on the ring is no answer: the burst throws him aside (no daze) and the lob goes on
    const sd = worm(seat, { place: (m, z, pw) => { z.x = pw.ex; } });
    const sv = first(sd.log, 'wormShove');
    ok(`${tag}: standing on the ring, the burst shoves him aside (no daze) and the lob flies on`, !!sv && !first(sd.log, 'wormSmother') && !sd.trace.some((q) => q.zst > 0) && sd.trace.some((q) => q.i > sv.i && q.ph === 'fly'));
    // THE STOMP: KICK on the ring just before it bursts — smothered, the ball loose, he is not hit
    let stomped = false;
    const sm = worm(seat, { place: (m, z, pw) => { z.x = pw.ex; }, inp: (m, z, pw) => (!stomped && pw && pw.ph === 'warn' && pw.k >= WORM.WARN - 0.1 ? (stomped = true, { kick: true }) : {}) });
    ok(`${tag}: a stomp on the ring as it bursts smothers it (no hit, no shot)`, !!first(sm.log, 'wormSmother') && !first(sm.log, 'powerHit') && !sm.z.hurt && sm.m.score[seat] === 0);
    // …too early, and it is only standing there
    let early = false;
    const se = worm(seat, { place: (m, z, pw) => { z.x = pw.ex; }, inp: (m, z, pw) => (!early && pw && pw.ph === 'warn' && pw.k >= 0.05 ? (early = true, { kick: true }) : {}) });
    ok(`${tag}: a stomp too early does not smother it`, !first(se.log, 'wormSmother') && !!first(se.log, 'wormShove'));
    // THE CROWN: in its way near the goal, not kicking — the hit, coiled; the ball pops on over him
    const cr = worm(seat, { place: (m, z) => { z.x = r.gx - r.a.side * 45; } });
    const ch = first(cr.log, 'powerHit', (e) => e.player === 1 - seat);
    ok(`${tag}: met on the crown it is the power hit, and he is coiled`, !!ch && ch.how === 'crown' && !!first(cr.log, 'ailment', (e) => e.ail === 'coiled'), ch && ch.how);
    const after = ch && cr.trace.find((q) => q.i === ch.i);
    ok(`${tag}: …and the ball pops on over him (not back)`, !!after && after.vx * r.a.side > 0 && after.vy < 0, after && `vx ${after.vx.toFixed(0)} vy ${after.vy.toFixed(0)}`);
    // THE SWING BLOCK: a kick on its swing up as it drops onto him — the block, and the WHOLE TUNNEL
    // comes back from him (no cut-in, his worm takes the ball first)
    let pressed = false;
    const kb = worm(seat, { s: 7, place: (m, z) => { z.x = r.gx - r.a.side * 45; }, inp: (m, z, pw) => {
      const b = m.ball;
      if (pressed || !pw || pw.ph !== 'fly' || pw.owner !== 1 - z.index) return {};
      if ((z.x - b.x) / b.vx < 0.16) { pressed = true; return { kick: true }; }
      return {};
    } });
    ok(`${tag}: a kick into it as it drops blocks it`, !!first(kb.log, 'blocked', (e) => e.player === 1 - seat && e.cp === 'wormtunnel'));
    const back = kb.trace.filter((q) => q.own === 1 - seat).map((q) => q.ph);
    // (to the lob — or to her smother, when she happens to stand on its ring: seat 1 does)
    const bk = first(kb.log, 'wormBurst', (e) => e.player === 1 - seat);
    ok(`${tag}: …and the blocker sends the whole tunnel back (grab, dive, tunnel, ring, burst)`, ['wgrab', 'wdive', 'tunnel', 'warn'].every((ph) => back.includes(ph)) && !!bk && (back.includes('fly') || !!first(kb.log, 'wormSmother', (e) => e.player === seat)), [...new Set(back)].join(','));
    // THE COUNTER: armed, any touch of the lob fires his own power back
    const co = worm(seat, { place: (m, z) => { z.x = r.gx - r.a.side * 45; z.gauge = 1; z.prev = {}; z.armed = 9; } });
    ok(`${tag}: an armed defender counters the lob`, !!first(co.log, 'powershot', (e) => e.player === 1 - seat && e.countered));
    // THE EARLY HEADER: in the air at it just off the ring (past the smother) — it comes off his head, no daze
    const eh = worm(seat, { place: () => {}, inp: (m, z, pw) => {
      const b = m.ball;
      if (pw && pw.ph === 'fly' && pw.t > 0.17 && pw.t < 0.19 && !(z.hold)) {
        z.hold = 1; z.x = b.x + r.a.side * (C.HEAD_R + 6); z.y = b.y + C.BODY_H + C.HEAD_R * 0.6; z.vy = 0; z.vx = 0; z.onGround = false;
      }
      return {};
    } });
    ok(`${tag}: headed right off the ring it deflects (no daze)`, !!first(eh.log, 'blocked', (e) => e.how === 'header') && !first(eh.log, 'powerHit'));
  }
  // where it comes up: by the dive point, never nearer than MIN_LINE; already that near, where it went down
  ok('WORM TUNNEL: the ring is always MIN_LINE+ out, or where it went down', (() => {
    for (let x = 100; x < C.W - 100; x += 7) for (const dir of [1, -1]) {
      const gx = dir > 0 ? C.W - C.GOAL_W : C.GOAL_W, D = (gx - x) * dir, E = (gx - emergeX(x, dir)) * dir;
      if (D > 0 && !(E >= Math.min(D, WORM.MIN_LINE) - 1e-9 && E <= Math.max(D, WORM.FAR) + 1e-9 && E <= D + 1e-9)) return false;
    }
    return true;
  })());
  {
    // FULL TIME under the tunnel: the whistle ends it — no burrow left, nobody held (the match is
    // over: the ball stops where it is, as every power's does, and her form is off — champ-vfx)
    const ft = worm(0, { s: 2, setup: (m) => { m.clock = 0.9; m.score = [1, 0]; } });
    ok('WORM TUNNEL: full time mid-tunnel clears the burrow', ft.m.phase === 'over' && !ft.m.zones.length && !powerHolds(ft.m, ft.a));
    const gg = worm(0, { s: 2, setup: (m) => { m.clock = 0.9; m.score = [1, 1]; } });
    ok('WORM TUNNEL: the golden-goal restart mid-tunnel clears it too', gg.m.golden && !gg.m.zones.length && !gg.m.ball.power);
    // ROLLBACK: restored mid-tunnel, the same future
    const A = worm(0, { s: 0.5 });
    ok('WORM TUNNEL: mid-tunnel the ball is under the pitch with its burrow', A.m.ball.power && A.m.ball.power.ph === 'tunnel' && A.m.zones.some((z) => z.k === 'burrow'), A.m.ball.power && A.m.ball.power.ph);
    const B = createMatch({ rarity: 'legendary', number: 2 }, { rarity: 'epic', number: 1 }, { champions: true, duration: 600 });
    restore(B, serialize(A.m));
    for (let i = 0; i < TICK_S(2.5); i++) { step(A.m, NONE); step(B, NONE); }
    A.m.events.length = 0; B.events.length = 0;
    ok('WORM TUNNEL: restored mid-tunnel, it plays out the same', JSON.stringify(serialize(A.m)) === JSON.stringify(serialize(B)));
  }
  ok('coiled: half speed, no dash', (() => { const md = ailMods({ ail: 'coiled', ailT: 1 }); return md.speed === 0.5 && md.noDash; })());
}
{
  // POWER 3 — SIZZLE LINE (the Burning Chef): it dives to knee height and flies flat, searing a grill
  // strip into the grass behind it; a defender standing on the strip is singed (no kick).
  const { SIZZLE } = await import('./shared/champion-powers/stage-03.js');
  for (const seat of [0, 1]) {
    const r = fireCp(3, seat, { gap: 900, s: 0.3 });
    const fl = r.path.filter((q) => q.cp === 'sizzle' && q.ph === 'fly');
    ok(`SIZZLE LINE (seat ${seat}): flies flat at knee height`, fl.length > 3 && fl.every((q) => Math.abs(q.y - (C.GROUND_Y - SIZZLE.KNEE)) < 1.5));
    const zn = r.m.zones.find((z) => z.k === 'strip' && z.cp === 'sizzle');
    ok(`SIZZLE LINE (seat ${seat}): a strip on the grass behind it, following the ball`, !!zn && Math.abs(zn.x1 - zn.x0) > 300 && zn.own === seat, zn && `${Math.abs(zn.x1 - zn.x0).toFixed(0)} px`);
    // the defender steps onto the strip: singed
    const z = r.z; z.x = (zn.x0 + zn.x1) / 2; z.y = C.GROUND_Y; z.onGround = true; z.ail = ''; z.ailT = 0; z.stunned = 0;
    step(r.m, NONE);
    ok(`SIZZLE LINE (seat ${seat}): standing on the strip, he is singed (no kick)`, z.ail === 'singed' && ailMods(z).noKick);
    // …and the shooter is not
    const a = r.a; a.x = z.x; a.y = C.GROUND_Y; a.onGround = true; a.ail = '';
    step(r.m, NONE);
    ok(`SIZZLE LINE (seat ${seat}): its own shooter walks on it unharmed`, a.ail !== 'singed');
  }
}
{
  // POWER 4 — CHOCO BURST (King of Mud): the bar bursts BURST_AT px short of the goal line and a
  // splat of chocolate lands ahead on the grass; feet in it are sticky. A hit glues him where he
  // stands (sticky, not thrown).
  const { CHOCO } = await import('./shared/champion-powers/stage-04.js');
  for (const seat of [0, 1]) {
    const r = fireCp(4, seat, { gap: 900, s: 0.2 });
    const bu = first(r.log, 'chocoBurst');
    const gx = r.a.side > 0 ? C.W - C.GOAL_W : C.GOAL_W;
    ok(`CHOCO BURST (seat ${seat}): the bar bursts ${CHOCO.BURST_AT} px short of the goal line`, !!bu && Math.abs((gx - bu.x) * r.a.side - CHOCO.BURST_AT) < 45, bu && `${((gx - bu.x) * r.a.side).toFixed(0)}`);
    const zn = r.m.zones.find((z) => z.k === 'splat');
    ok(`CHOCO BURST (seat ${seat}): the splat lands ahead, in front of the goal`, !!zn && (gx - Math.max(zn.x0, zn.x1) * (r.a.side > 0 ? 1 : 0) - Math.min(zn.x0, zn.x1) * (r.a.side > 0 ? 0 : 1)) * r.a.side > 0);
    const z = r.z; z.x = (zn.x0 + zn.x1) / 2; z.y = C.GROUND_Y; z.onGround = true; z.ail = ''; z.ailT = 0; z.stunned = 0;
    for (let i = 0; i < 10; i++) step(r.m, NONE);
    ok(`CHOCO BURST (seat ${seat}): feet in the splat are sticky (slow, low jumps, no dash)`, z.ail === 'sticky' && (() => { const md = ailMods(z); return md.speed < 1 && md.jump < 1 && md.noDash; })());
    const h = fireCp(4, seat, { gap: 360, s: 0.4 });
    const hz = h.path.find((q, i) => i > 0 && h.path[i - 1].cp === 'chocoburst' && !q.cp);
    ok(`CHOCO BURST (seat ${seat}): a hit glues him in chocolate where he stands`, !!first(h.log, 'chocoCoat') && h.z.ail === 'sticky' && Math.abs((seat === 0 ? h.z.x : C.W - h.z.x) - 660) < 40, `${(seat === 0 ? h.z.x : C.W - h.z.x).toFixed(0)}`);
  }
}
{
  // POWER 5 — ICE POP WALL (the Wall Builder): a plain flat shot — and a fence of ice pops in front
  // of the shooter's OWN goal for WALL s, turning back any ball coming at it lower than the pops.
  // A hit is a brain freeze: frozen stiff, then a shiver.
  const { ICEPOP } = await import('./shared/champion-powers/stage-05.js');
  for (const seat of [0, 1]) {
    const r = fireCp(5, seat, { gap: 900, s: 0.1 });
    const zn = r.m.zones.find((z) => z.k === 'fence');
    const own = r.a.side > 0 ? C.GOAL_W : C.W - C.GOAL_W;
    ok(`ICE POP WALL (seat ${seat}): a fence in front of his OWN goal`, !!zn && Math.abs(zn.x0 - (own + r.a.side * ICEPOP.OUT)) < 1 && zn.dir === -r.a.side && zn.h === ICEPOP.H);
    // a low ball rolling at his goal is turned back; a high one sails over
    for (const [hy, stops] of [[C.GROUND_Y - 40, true], [C.GROUND_Y - ICEPOP.H - 40, false]]) {
      const m = r.m; m.ball.power = null; m.ball.x = own + r.a.side * 200; m.ball.y = hy; m.ball.vx = -r.a.side * 900; m.ball.vy = 0;
      r.a.x = own + r.a.side * 500; r.z.x = own + r.a.side * 800; m.events.length = 0;
      let hit = false, minIn = 9999;
      for (let i = 0; i < 20; i++) { step(m, NONE); hit = hit || m.events.some((e) => e.type === 'fenceHit'); m.events.length = 0; minIn = Math.min(minIn, (m.ball.x - own) * r.a.side); }
      ok(`ICE POP WALL (seat ${seat}): a ${stops ? 'low' : 'high'} ball at his goal ${stops ? 'bounces off the pops' : 'goes over them'}`, stops ? hit && minIn > ICEPOP.OUT - C.BALL_R - 2 : !hit);
    }
    const h = fireCp(5, seat, { gap: 360, s: 0.4 });
    ok(`ICE POP WALL (seat ${seat}): a hit freezes him stiff (no control), then he shivers`, h.z.ail === 'brainfreeze' && ailMods(h.z).dead && (() => { const md = ailMods({ ail: 'brainfreeze', ailT: 0.5 }); return !md.dead && md.speed < 1 && md.noJump; })());
  }
}

{
  // THE FREE PLAY AFTER A GOAL DOES NOT COUNT: an armed player's touch in those seconds is an
  // ordinary touch, and the arm is still there for the restart.
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  m.afterGoal = C.AFTER_GOAL; m.afterGoalTo = 1;
  let shots = 0;
  for (let i = 0; i < 30; i++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    shots += m.events.filter((e) => e.type === 'powershot').length;
    m.events.length = 0;
  }
  ok('an armed touch in the free play after a goal fires nothing', shots === 0 && !m.ball.power, `${shots} shots`);
  ok('and the arm waits for the restart', p.armed > 0);
}

{
  // THE COUNTER UNDER THE HOLD (Idan): while a shot hangs by its shooter's head, the other player
  // moves — and jumping into it ARMED counters it on the spot. He holds there, in the air, until
  // his own shot leaves him; then he is free again.
  const m = fresh();
  const [z, a] = m.players;
  a.shot = shotById('straight'); z.shot = shotById('updown');
  // (the held ball sits POWER_RELEASE_AT head radii in front of its shooter — 66 px toward him)
  a.x = 700; z.x = 560 - C.POWER_RELEASE_AT * C.HEAD_R; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  arm(m, 0); arm(m, 1);
  m.ball.x = a.x - 8; m.ball.y = headY(a) - C.HEAD_R - C.BALL_R + 6; m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE);
  ok('(setup) his shot is held under its cut-in', m.cutinBy === 1 && m.hitStop > 0);
  let c = null, pos = null, ball = null, moved = false, left = false;
  for (let t = 0; t < 200; t++) {
    step(m, [{ right: t < 50, jump: t === 12 }, {}]);
    const e = m.events.find((x) => x.type === 'powershot' && x.player === 0); m.events.length = 0;
    if (e && !c) { c = e; pos = [z.x, z.y]; ball = [m.ball.x, m.ball.y]; continue; }
    if (c && !left) {
      if (Math.hypot(m.ball.x - ball[0], m.ball.y - ball[1]) > 0.5) left = true;
      else if (z.x !== pos[0] || z.y !== pos[1]) moved = true;
    }
  }
  ok('armed, jumping into the held shot COUNTERS it', c && c.countered && m.cutinBy !== 1);
  ok('…up in the air', pos && pos[1] < C.GROUND_Y - 20, pos && `y ${pos[1].toFixed(0)}`);
  ok('…and he holds there until his shot leaves him', left && !moved);
  ok('…then he is free again (back on the grass)', z.y === C.GROUND_Y);
}

{
  // THE BLOCK IN THE AIR (Idan): jump and kick into their shot and he hangs where the boot met it
  // while it grinds, then it goes straight back out off the boot — and only then does he fall.
  const m = fresh();
  const [a, z] = m.players;
  a.shot = shotById('straight'); z.shot = shotById('updown');
  a.x = 260; z.x = 700; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  arm(m, 0);
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = 0; m.ball.vy = 0;
  step(m, NONE); m.events.length = 0;
  let bt = -1, y0 = 0, air = false, moved = false, reb = null, held = 0;
  for (let t = 0; t < 260 && !reb; t++) {
    // (kick KICK_AT ticks after the shot leaves the cut-in's hold — on the swing's timing, C.BLOCK_SWING
    // — and jump 20 ticks before that)
    const HOLD = Math.round((C.POWER_CUTIN - C.POWER_RELEASE) / C.TICK), KICK_AT = HOLD + KICK_LATE;
    step(m, [{}, { jump: t === KICK_AT - 20, kick: t === KICK_AT }]);
    const ev = m.events.splice(0);
    if (bt < 0) { if (ev.some((e) => e.type === 'blocked' && e.player === 1)) { bt = t; y0 = z.y; air = !z.onGround; } continue; }
    reb = ev.find((e) => e.type === 'rebound');
    if (!reb) { held++; if (Math.abs(z.y - y0) > 0.01) moved = true; }
  }
  ok('(setup) kicked into it in the air: a block', bt >= 0 && air, `y ${y0.toFixed(0)}`);
  ok('…he hangs there while it grinds', !moved && held >= Math.round(0.8 / C.TICK) - 1, `${held} ticks`);
  ok('…it goes back out off his boot, up where he is, as his shot', reb && reb.y < C.GROUND_Y - C.BALL_R - 20 && m.ball.power && m.ball.power.owner === 1 && m.ball.vx < 0);
  const yr = z.y;
  run(m, 10);
  ok('…and then he falls', z.y > yr + 3, `${yr.toFixed(0)} → ${z.y.toFixed(0)}`);
}

console.log(`test-ultimate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
