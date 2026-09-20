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
// Kept apart from test-sim.mjs deliberately: that file is the physics, this file is one
// mechanic and one deletion, and it should be readable as the answer to the report.
import * as C from './shared/constants.js';
import { createMatch, step, headY, resetPositions, clearUltimate } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';

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
  ok('the rival meter is still empty', m.players[1].gauge === 0, `gauge=${m.players[1].gauge}`);
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
  ok('the press does NOT spend the meter', p.gauge >= 1, `gauge=${p.gauge}`);
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
  ok('and does not spend the meter', a.gauge >= 1, `gauge=${a.gauge}`);
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

// ═══ 6. THE METER IS SPENT AT ACTIVATION, AND ONLY THERE ═════════════════════
{
  const m = fresh();
  const p = m.players[0];
  arm(m, 0);
  ok('armed, the meter is still full', p.gauge >= 1, `gauge=${p.gauge}`);
  run(m, 30);
  ok('waiting does not spend it', p.gauge >= 1, `gauge=${p.gauge}`);
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('the activation spends it', p.gauge === 0, `gauge=${p.gauge}`);
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
  ok('and the meter is still full', p.gauge >= 1, `gauge=${p.gauge}`);
  ok('and nothing fired while it waited', !m.ball.power);
  // …and it still pays out when the ball finally arrives.
  for (let t = 0; t < 30 && !m.ball.power; t++) touchBall(m, p);
  ok('the touch after the wait still fires it', !!m.ball.power);
  ok('and spends the meter then, not before', p.gauge === 0, `gauge=${p.gauge}`);
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
  resetPositions(m, 0);
  ok('a goal restart does NOT disarm', p.armed > 0, `armed=${p.armed}`);
  ok('a goal restart does NOT clear the glow', glowing(p));
  ok('a goal restart does NOT clear the meter', p.gauge >= 1, `gauge=${p.gauge}`);
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
  // Ride out the whole goal freeze. The arm has no clock, so none of this costs it anything.
  for (let i = 0; i < 200 && m.phase !== 'play'; i++) { m.hitStop = 0; step(m, NONE); }
  ok('(play has resumed)', m.phase === 'play');
  ok('still armed after the restart', p.armed > 0);
  ok('and the meter is still full', p.gauge >= 1, `gauge=${p.gauge}`);
  let shots = 0;
  for (let i = 0; i < 30; i++) {
    m.hitStop = 0;
    m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
    step(m, NONE);
    shots += m.events.filter((e) => e.type === 'powershot').length;
    m.events.length = 0;
  }
  ok('and the touch after the goal fires it, exactly once', shots === 1, `${shots} shots`);
  ok('and NOW the meter is spent', p.gauge === 0, `gauge=${p.gauge}`);
}
// ═══ 7b. WHAT A GOAL DOES TO THE METERS: IT ADDS, AND ONLY TO THE CONCEDER ═══
//
// Scoring a goal, in normal play, with both meters part-filled. Driven through a real goal
// rather than by calling awardConcedeMeter directly, so the DIRECTION is tested end to end —
// a reversed scorer/recipient is the one mistake here that still looks normal from outside.
{
  const goalBy = (who, meters) => {
    const m = fresh();
    m.players[0].gauge = meters[0];
    m.players[1].gauge = meters[1];
    // who = 0 scores into the RIGHT net, who = 1 into the LEFT one.
    m.ball.y = C.GROUND_Y - 30;
    if (who === 0) { m.ball.x = C.W - C.GOAL_W - C.BALL_R - 2; m.ball.vx = 700; }
    else { m.ball.x = C.GOAL_W + C.BALL_R + 2; m.ball.vx = -700; }
    for (let i = 0; i < 20 && m.score[who] === 0; i++) { m.hitStop = 0; step(m, NONE); }
    return { scored: m.score[who] === 1, g: [m.players[0].gauge, m.players[1].gauge] };
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  // Player 1 (index 0) scores → player 2 (index 1) gains 25 points, player 1 is untouched.
  {
    const r = goalBy(0, [0.40, 0.40]);
    ok('(player 1 scored)', r.scored, r.g.join(' / '));
    ok('P1 scoring adds 25 points to P2', near(r.g[1], 0.65), `P2 = ${r.g[1]}`);
    ok('and leaves P1 exactly where it was', near(r.g[0], 0.40), `P1 = ${r.g[0]}`);
  }
  // …and the other way round, which is NOT implied by the first.
  {
    const r = goalBy(1, [0.40, 0.40]);
    ok('(player 2 scored)', r.scored, r.g.join(' / '));
    ok('P2 scoring adds 25 points to P1', near(r.g[0], 0.65), `P1 = ${r.g[0]}`);
    ok('and leaves P2 exactly where it was', near(r.g[1], 0.40), `P2 = ${r.g[1]}`);
  }
  // The brief's three worked examples, verbatim.
  {
    const r = goalBy(1, [0.80, 0.30]);
    ok('P1 at 80% + a P2 goal clamps to 100%', near(r.g[0], 1), `P1 = ${r.g[0]}`);
    ok('and P2 stays at its own value', near(r.g[1], 0.30), `P2 = ${r.g[1]}`);
  }
  {
    const r = goalBy(1, [1, 0.30]);
    ok('P1 already at 100% stays at 100%', near(r.g[0], 1), `P1 = ${r.g[0]}`);
  }
  {
    const r = goalBy(0, [0.55, 0.40]);
    ok('P2 at 40% + a P1 goal becomes 65%', near(r.g[1], 0.65), `P2 = ${r.g[1]}`);
    ok('and P1 stays at its own value', near(r.g[0], 0.55), `P1 = ${r.g[0]}`);
  }
  // NOTHING is ever zeroed by a goal, from any starting pair.
  {
    let zeroed = 0;
    for (const who of [0, 1]) {
      for (const pair of [[0.1, 0.9], [0.9, 0.1], [1, 1], [0.5, 0], [0, 0.5], [0.25, 0.75]]) {
        const r = goalBy(who, pair);
        if (!r.scored) continue;
        // A meter may only be >= what it started at. Never zero, never assigned.
        if (r.g[0] < pair[0] - 1e-9 || r.g[1] < pair[1] - 1e-9) zeroed++;
      }
    }
    ok('no goal, from any starting pair, ever lowers a meter', zeroed === 0, `${zeroed} did`);
  }
  // …and the bonus really is 25 points, not whatever the constant drifts to.
  ok('the concede bonus is 25 percentage points',
     near(C.GAUGE_CONCEDE_BONUS, 0.25), String(C.GAUGE_CONCEDE_BONUS));
}
{
  // A FULL METER STAYS FULL ACROSS A GOAL — for the scorer, who gets nothing added, and for
  // the conceder, whose addition is clamped rather than wrapped.
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
  // THE METER IS SPENT BY THE ULTIMATE AND BY NOTHING ELSE. Play a long stretch and assert
  // that every single drop in either meter is accounted for by a powershot on that tick.
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
    const fired = new Set(m.events.filter((e) => e.type === 'powershot').map((e) => e.player));
    for (let k = 0; k < 2; k++) {
      if (m.players[k].gauge < before[k] - 1e-9 && !fired.has(k)) unexplained++;
    }
    m.events.length = 0;
  }
  ok('over a whole match, a meter only ever falls on an activation',
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
  if (sawShot) ok('and when it fires, the meter is spent', p.gauge === 0, `gauge=${p.gauge}`);
  else ok('and when it fires, the meter is spent', true, '(no shot inside the window)');
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

console.log(`test-ultimate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
