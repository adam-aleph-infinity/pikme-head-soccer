// Authoritative head-soccer physics. Pure JS, no DOM, no timers — step() is the whole game.
// The renderer only reads this state; the bot only writes inputs into it. Same split as
// football-mock's shared/sim.js, so wiring this to a server later is a lift-and-shift.

import * as C from './constants.js';
import { walkBounds, barY, barCeiling, goalBox, ballInGoal, keepOutOfGoal } from './goalbox.js';
import { championFor } from './champions.js';
import {
  shotFor, statsFor, meterRateFor, launch as launchPower, stepPower, contact as powerContact,
  skipContact, earlyBlock, onArm, tickAilment, ailMods, ailInput, headless, EQUAL_STATS,
} from './hs-powers.js';

// A player's geometry, derived (never stored) so nothing can drift out of sync.
// `y` is the FEET line; the body box hangs above it and the head sits on the body.
// Taken from the FEET LINE rather than from the player, so a collision test can ask for the
// geometry at a swept pose — where the player was part-way through the tick — and not only
// at where they ended it. One formula, two callers, nothing to drift apart.
const headYAt = (y) => y - C.BODY_H - C.HEAD_R + C.NECK;
const bodyTopAt = (y) => y - C.BODY_H;
export const headY = (p) => headYAt(p.y);
export const bodyTop = (p) => bodyTopAt(p.y);
// One head size for everybody. It used to be scaled by the big-head pickup and by the dart's
// shrink; both of those systems are gone (see archive/README.md), so this is a constant again
// — but it stays a function of (m, p) because every collision in this file asks through it,
// and that is the seam anything that ever resizes a head should come back through.
//
// (The arcade's head-growing powers went with shared/powers.js: Head Soccer's heads are one size.
// A BEHEADED player keeps the radius and loses the contacts — see resolveBallPlayers.)
export const headR = (m, p) => C.HEAD_R;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Effects are fire-and-forget messages to whatever is drawing. Tests pass NO_FX.
export const NO_FX = { trail() {}, shockwave() {}, grab() {}, hit() {}, goal() {} };

// What a power shot is allowed to reach inside the sim. Passed in rather than imported, so
// hs-powers.js does not import this file back and every knockdown still goes through stun().
const KIT = { stun, headY, keepOutOfGoal, bounds: (p) => applyBounds(p, C.HEAD_R) };

function makePlayer(index, char) {
  const side = index === 0 ? 1 : -1;       // +1 attacks the RIGHT goal
  return {
    index, side, char,
    // The card's Head Soccer power shot (shared/hs-powers.js): its family, ailment and aura.
    shot: shotFor(char),
    // EQUAL for everybody outside the arcade — Head Soccer's online rule.
    stats: EQUAL_STATS,
    x: C.SPAWN_X[index], y: C.GROUND_Y,
    vx: 0, vy: 0,
    onGround: true, facing: side,
    jumps: C.MAX_JUMPS,
    kickT: 0, kickCd: 0, kickDir: 0,
    dashT: 0, dashCd: 0, dashDir: 0,
    tapDir: 0, tapT: 0,
    // Whose body is holding this one up — standing on its head, or pinned against it by a
    // push (resolvePlayers) — or -1 for the grass / the air. Rebuilt every tick.
    stand: -1,
    // THE ULTIMATE, in two numbers and nothing else.
    //   gauge — the power meter, 0..1, filled by the clock (see GAUGE_PASSIVE).
    //   armed — seconds of ARMED left. > 0 means "glowing, waiting for a touch on the ball".
    // There is deliberately no third field for "pending", "activating" or "charging": every
    // one of those was somewhere a previous match's state could hide. Arming sets `armed` and
    // empties the gauge in the same statement (the refill starts there, as in HS), the touch
    // clears `armed`, and clearUltimate() below zeroes both. See clearUltimate.
    gauge: 0, armed: 0,
    shoved: 0,
    coyote: 0, jumpBuf: 0,          // jump forgiveness (see COYOTE_TIME / JUMP_BUFFER)
    // Seconds since the feet last touched down — what makes a HELD jump re-jump JUMP_REJUMP
    // after landing (HS M4). Starts long past it: a player standing at kickoff has been down
    // for ages, so holding JUMP through the banner jumps the moment play starts.
    landT: 1,
    tackleImmune: 0,                // s before the same player can be tackled again
    // `stunned` is the one and only way the controls are ever taken off a player: seconds
    // left on the floor, set by stun() and counted down by tickStun(). There is no health —
    // Head Soccer has none. A blocked shot dazes (POWER_BLOCK_STUN) and the KNOCKOUT does.
    stunned: 0,
    // THE AILMENT a power shot or an aura left on this player ('' = none) and its seconds left.
    // Two scalars rather than an object, so the snapshot copies them by value (P_FIELDS).
    ail: '', ailT: 0,
    // THE KNOCKOUT (KICK_HURT_EVERY, constants.js). `kicked`: connected kicks taken since the
    // last knockout — every KICK_HURT_EVERY-th one hurts, the KICK_HURTS_TO_KO-th hurt knocks
    // you out and zeroes it. Counts boots, never time, and a goal does not clear it (HS M4).
    // `hurt`: the bruise, 0..3 — one tier per hurt this match, for the renderer only. It is
    // NOT reset by the knockout (HS M4 121.3 s: the red nose is still there after the stars).
    kicked: 0, hurt: 0,
    prev: {},
    stats_: null,
  };
}

export function createMatch(charA, charB, opts = {}) {
  const m = {
    t: 0,
    clock: opts.duration ?? C.MATCH_DURATION,
    phase: 'kickoff',        // kickoff → play → goal → (kickoff | over)
    freeze: C.KICKOFF_FREEZE,
    score: [0, 0],
    golden: false,
    lastScorer: null,
    hitStop: 0,
    // THE CUT-IN (see POWER_CUTIN): seconds left of the freeze a fired power shot makes, and
    // whose shot it is. The freeze itself is the hitStop above; these say it is a cut-in, so the
    // renderer can spotlight the shooter and a stun is not run down under it.
    cutin: 0, cutinBy: -1,
    // THE BANNER, as the sim times it: 'kickoff' (KICK OFF) or 'goal' (GOAL!), and seconds
    // left. In the sim rather than the renderer because HS times its restarts off the banner,
    // and an online client has to put it up on the same tick as the server.
    banner: 'kickoff', bannerT: C.KICKOFF_FREEZE,
    // After a goal the ball is not in play for GOAL_BALL_DELAY once the players can move: it
    // drops in at the centre when this runs out. 0 = the ball is there.
    ballWait: 0,
    afterGoal: 0, afterGoalTo: 0,
    // The kickoff's head start on the gauge (GAUGE_LEAD), counted down in play.
    gaugeLead: C.GAUGE_LEAD,
    idle: 0,                 // seconds since a player last touched the ball
    players: [makePlayer(0, charA), makePlayer(1, charB)],
    ball: { x: C.BALL_SPAWN.x, y: C.BALL_SPAWN.y, vx: 0, vy: 0, r: C.BALL_R, spin: 0, power: null },
    // A Multi-Ball's extra balls: real balls, stepped and scored exactly like the match ball.
    xballs: [],
    events: [],              // drained by the renderer each frame
  };
  // THE ARCADE. Champions are an opt-in on the match, and nothing else in the game passes it:
  // not the server, not the online client, not the free-play match. Without it there is no
  // m.champ and every champion seam below is skipped — see the fingerprint in test-arcade.
  if (opts.champions) {
    m.champ = { arcade: true };
    m.players.forEach((p, i) => {
      p.champ = championFor(p.char);             // null for a card that is not a champion
      // A champion's own intensity (and stage 2/6's gentleness) from the approved map.
      p.shot = shotFor(p.char, { arcade: true });
      // HS's 1–10 stats: the stage's champion plays on its own (opts.stats[i]); the player's card
      // stays EQUAL. The POWER level is how fast its gauge fills.
      const lv = opts.stats && opts.stats[i];
      if (lv) p.stats = statsFor(lv);
      p.meterRate = (opts.meterRate && opts.meterRate[i]) || (lv ? meterRateFor(lv.power) : 1);
      const k = opts.statScale && opts.statScale[i];
      if (k) p.stats = { speed: p.stats.speed * k.speed, jump: p.stats.jump * k.jump, kick: p.stats.kick * k.kick };
    });
  }
  // BOTH PLAYERS START WITH THE ULTIMATE OFF, and it is asserted here rather than assumed
  // from makePlayer. A match object can also be built by restoring into an existing one (see
  // restore), and "the fields happen to be zero because the constructor wrote zero" is
  // exactly the assumption that let a previous match's full gauge survive into a new one and
  // fire on the rival's first tick.
  for (const p of m.players) clearUltimate(m, p);
  return m;
}

// THE ONE PLACE THE ULTIMATE IS TORN DOWN — AND THE LIST OF CALLERS IS THE POINT.
//
// It clears ARMED, which is also the glow (the renderer draws the glow off `armed` and
// nothing else), the meter, and any signature effect still sitting on this player.
//
// Exactly three things call it, and they are all "this match, or this player, is over":
//   • createMatch       — a new match inherits nothing.
//   • full time         — the whistle, both branches of it.
// …and that is the whole list.
//
// WHAT DOES NOT CALL IT, deliberately: a goal. A goal is not the end of anything — both
// players are still in the same match with the same earned power — and having resetPositions
// call this was the bug. It meant scoring WIPED both meters: the scorer's to zero and the
// conceder's to zero-plus-the-bonus, so an 80% meter came out of somebody else's goal at 25%.
// It also cancelled an arm that had been paid for and was still waiting for its touch.
//
// So: a goal moves bodies and the ball (resetPositions), and leaves both meters alone. It does
// not come through here.
function clearUltimate(m, p) {
  const wasArmed = p.armed > 0;
  p.armed = 0;
  p.gauge = 0;
  if (wasArmed && m) m.events.push({ type: 'ultimateCleared', player: p.index });
  return p;
}
export { clearUltimate };

// ---------------------------------------------------------------------------
// THE STUN, and the only thing that ever sets it.
//
// This used to be damage(): the tail end of a hidden-health system in which a player who hit 0%
// was stunned for 1.75s. The health is gone (Head Soccer has none), but a timer that takes the
// controls away for a moment is still what the arcade's knockdown powers need, and what HS's own
// ailments will need, so the timer is kept and given a plain name.
//
// One rule, and it is the whole of the anti-stun-lock design: a player who is already down
// cannot be re-stunned or topped up. Its length is always what the caller asked for, never a
// sum of them. Returns whether the stun landed.
function stun(m, p, time) {
  if (p.stunned > 0 || !(time > 0)) return false;
  p.stunned = time;
  m.events.push({ type: 'stunned', player: p.index, time: p.stunned });
  return true;
}
export { stun };

// THE STUN CLOCK, and it runs on WALL TIME.
//
// Pulled out of stepPlayer because stepPlayer is not the only place it has to tick. step()
// returns early for the length of a hit-stop, before any player is stepped, so a stun that
// spanned a few hit-stops used to run long in real seconds — every hit landed anywhere on the
// pitch made it longer. The countdown has to be independent of how eventful the pause is.
//
// Returns true while the player is still down.
function tickStun(m, p, dt) {
  if (p.stunned <= 0) return false;
  p.stunned -= dt;
  if (p.stunned > 0) return true;
  p.stunned = 0;
  // A MOMENT TO GET UP: one tackle-immunity window on the way back, so a player cannot be
  // booted the instant their controls return.
  p.tackleImmune = Math.max(p.tackleImmune, C.TACKLE_IMMUNE);
  m.events.push({ type: 'revive', player: p.index });
  return false;
}

// Bodies and ball back to the spot. Called by a goal, and by nothing else.
//
// Read the list of what is NOT here as carefully as the list of what is: `gauge`, `armed`
// and `prev` are all deliberately untouched. The meters carry (they were earned in this
// match and the match is still going), the arm carries (it was paid for and is still owed a
// touch — a goal is not ball contact), and `prev` carries because it is the EDGE latch:
// clearing it would hand a rising edge to anyone still holding a button through the restart,
// which is the opposite of the safety it looks like.
function resetPositions(m, towards) {
  m.idle = 0;
  for (const p of m.players) {
    p.x = C.SPAWN_X[p.index]; p.y = C.GROUND_Y;
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = p.side; p.stand = -1;
    p.kickT = 0; p.kickCd = 0; p.dashT = 0; p.dashCd = 0;
    p.shoved = 0;
    p.tackleImmune = 0; p.coyote = 0; p.jumpBuf = 0; p.landT = 1;
    p.jumps = C.MAX_JUMPS;
    // The STUN clears, because a kickoff nobody can move for is a bug whoever caused it.
    p.stunned = 0;
  }
  const b = m.ball;
  b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y;
  // Kickoff drifts towards whoever just conceded, so the restart isn't a coin flip — at HS's
  // measured 138 px/s (BALL_SPAWN_DRIFT).
  b.vx = towards ? towards * C.BALL_SPAWN_DRIFT : 0;
  b.vy = 0; b.spin = 0; b.power = null;
  m.idle = 0;
}

// A restart: everyone on their spots, frozen for `hold`, then GOAL_BALL_DELAY with no ball before
// it drops in. The goal restart and the sudden-death one share it.
function restartAtSpots(m, towards, hold) {
  resetPositions(m, towards);
  m.freeze = hold;
  m.phase = 'goal';
  m.ballWait = C.GOAL_BALL_DELAY;
}

// ---------------------------------------------------------------------------
// step(): one fixed tick. `inputs` is [inputA, inputB], each {left,right,jump,kick,power}.
export function step(m, inputs, dt = C.TICK, fx = NO_FX) {
  m.t += dt;

  if (m.phase === 'over') return m;

  // The banner is presentation on a wall clock: it runs down through every kind of pause.
  if (m.bannerT > 0) {
    m.bannerT -= dt;
    if (m.bannerT <= 0) { m.bannerT = 0; m.banner = null; m.events.push({ type: 'bannerOff' }); }
  }

  // Hit-stop. A few frozen frames on a heavy connect is most of what makes a hit read as
  // an impact rather than a teleport. Timers still tick so nothing can wedge here.
  //
  // A fired power shot's CUT-IN is the same freeze, 1.34s long (POWER_CUTIN): the whole match
  // holds while the shooter is spotlit, exactly as HS does.
  if (m.hitStop > 0) {
    m.hitStop -= dt;
    const cut = m.cutin > 0;
    if (cut) { m.cutin -= dt; if (m.cutin <= 0) { m.cutin = 0; m.cutinBy = -1; } }
    latchReleases(m, inputs);
    // The stun is the one timer that keeps running through a pause. Everything else here is
    // frozen on purpose — that is what hit-stop is — but a player's 1.75 seconds on the floor
    // has to be 1.75 seconds of the match clock, not 1.75 seconds plus however many heavy
    // connects happened to land while they were down. See tickStun.
    //
    // …EXCEPT under a cut-in. That is not a heavy connect three frames long but the whole game
    // stopping for a second and a third, and HS's dazed player is still dazed when it lifts —
    // run the stun down under it and a 0.5s daze from the shot before would simply vanish.
    if (!cut) for (const p of m.players) { tickStun(m, p, dt); tickAilment(m, p, dt); }
    // The gauge runs through a cut-in (HS M4 40.44 s and 41.97 s: the bar climbs at the same
    // rate under both). It is the goal restart that stops it — see chargeGauge.
    for (const p of m.players) chargeGauge(m, p, dt);
    // …and so does the match clock (HS M4: the timer ticks on through the 40.44 s and 60.19 s
    // cut-ins). It stops just short of 0 — the whistle is blown in play, below.
    if (cut && m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0)) m.clock = Math.max(1e-6, m.clock - dt);
    return m;
  }

  if (m.freeze > 0) {
    m.freeze -= dt;
    // a cut-in's dark that a goal landed under runs out over the goal's freeze (M4 151.85 s)
    if (m.cutin > 0) { m.cutin -= dt; if (m.cutin <= 0) { m.cutin = 0; m.cutinBy = -1; } }
    if (m.freeze <= 0 && (m.phase === 'kickoff' || m.phase === 'goal')) m.phase = 'play';
    // Frozen: no physics, no clock, and no gauge — not under the KICK OFF banner (M4 times the
    // first fill from its end) and not through a GOAL's restart (M4: the bar stands still from
    // the goal at 43.40 s until the ball drops in at 46.59 s). See chargeGauge.
    latchReleases(m, inputs);
    return m;
  }

  // THE DARK OUTLASTS THE FREEZE. The cut-in's last POWER_RELEASE (0.2s) is played: the ball is
  // away and both players can move and kick while the screen is still dark — the block at M4
  // 61.45 s is a kick pressed under it (docs/HS-POWER-SHOTS.md §2, §4). `cutin` runs down here.
  if (m.cutin > 0) {
    m.cutin -= dt;
    if (m.cutin <= 0 || m.cutin > C.POWER_RELEASE + 1e-9) { m.cutin = 0; m.cutinBy = -1; }
  }

  // The match's head start on the gauge: GAUGE_LEAD of play before the first fill begins.
  if (m.gaugeLead > 0) m.gaugeLead = Math.max(0, m.gaugeLead - dt);

  // FREE PLAY AFTER A GOAL, under the GOAL! banner (AFTER_GOAL = GOAL_BANNER, 2.05 s). Then HS
  // puts both players on their spots and holds them until GOAL_RESUME (2.24 s), and the ball
  // drops in GOAL_BALL_DELAY later (2.795 s) — HS M3/M4, 7–8 goals each.
  if (m.afterGoal > 0) {
    m.afterGoal -= dt;
    if (m.afterGoal <= 0) {
      m.afterGoal = 0;
      // less the two ticks that are not hold: this one (spent putting them there) and the one
      // the freeze lifts on, before a body can move
      restartAtSpots(m, m.afterGoalTo, C.GOAL_RESUME - C.AFTER_GOAL - 2 * C.TICK);
      return m;
    }
  }

  // The clock stands still from the goal until the ball is back in (HS M4 timer: goal 43.68 s →
  // next tick 47.50 s), so it waits out the no-ball gap too.
  if (m.phase === 'play' && !m.afterGoal && !(m.ballWait > 0)) {
    m.clock -= dt;
    if (m.clock <= 0) {
      m.clock = 0;
      if (m.score[0] === m.score[1] && C.GOLDEN_GOAL) {
        // SUDDEN DEATH is a restart (HS M2, 5–5 at 0:00, 111.0 s): the banner, both players back
        // on their spots, and the ball dropped in at the centre ~2.5 s after the whistle.
        if (!m.golden) {
          m.golden = true;
          m.events.push({ type: 'golden' });
          m.xballs.length = 0;
          restartAtSpots(m, 0, C.GOLDEN_HOLD);
          return m;
        }
      } else {
        m.phase = 'over';
        m.events.push({ type: 'fulltime', winner: m.score[0] > m.score[1] ? 0 : 1 });
        // The whistle clears the ultimate on both players. `over` is a terminal phase that
        // step() returns out of immediately, so an arm left standing here is an arm that sits
        // on the match object for as long as the results screen is up — and this object is
        // what an "again" button is most tempted to reuse.
        for (const p of m.players) clearUltimate(m, p);
        m.xballs.length = 0;
        return m;
      }
    }
  }

  // Where each player STARTED this tick. The players move once, in full, before the ball
  // moves at all, so a contact tested only against where they ENDED is a contact tested
  // against a body that teleported: a player running onto the ball crosses it between
  // frames, and the push-out then fires from whichever side it happens to land on — often
  // the back one, which is the ball "passing through" the player. resolveBallPlayers sweeps
  // the pose from here to there across the ball's sub-steps, so the contact is continuous
  // for BOTH bodies. The ball already had this half; the player never did.
  for (const p of m.players) { p.x0 = p.x; p.y0 = p.y; }
  for (let i = 0; i < 2; i++) stepPlayer(m, m.players[i], inputs[i] || {}, dt, fx);
  resolvePlayers(m);

  // NO BALL YET. After a goal the players get GOAL_BALL_DELAY of play before the ball drops in
  // at the centre (HS: players move 2.24s after the goal, the ball appears at 2.795s). It is
  // parked at the spot the whole time — resetPositions put it there — and nothing touches it.
  if (m.ballWait > 0) {
    m.ballWait -= dt;
    m.idle = 0;
    if (m.ballWait > 0) return m;
    m.ballWait = 0;
    m.events.push({ type: 'ballDrop', x: m.ball.x, y: m.ball.y });
    // THE CONCEDER'S BONUS: HS tops up the power bar of whoever just let one in, on the frame
    // the ball drops (M4 43.5 s goal → CPU bar 20% → 52% at 46.6 s, the scorer's bar untouched;
    // M3 restarts 14.5 s / 41.5 s / 62.5 s the same). Idan confirmed: "if I score, my opponent
    // gets plus to the power bar". The only non-clock gain there is.
    const conceder = m.players[1 - m.lastScorer];
    if (conceder && m.lastScorer != null && !m.golden) conceder.gauge = Math.min(1, conceder.gauge + C.GAUGE_CONCEDE);
  }

  // SUB-STEP THE BALL when it is moving faster than the things it can hit. The power volley
  // travels 34px in a tick and a head is 30px across, so at one step per frame the ball
  // simply skipped PAST defenders between frames — measured: only one reaction distance in
  // eight could block it, and the ones that failed failed by tunnelling rather than by
  // timing. Splitting the tick into slices no longer than a head keeps "get in the way" a
  // thing the geometry can actually see.
  const speed = Math.hypot(m.ball.vx, m.ball.vy);
  const slices = Math.max(1, Math.min(6, Math.ceil((speed * dt) / (C.HEAD_R * 0.8))));
  for (let i = 0; i < slices; i++) stepBall(m, dt / slices, fx, i / slices, 1 / slices);
  if (m.xballs.length && m.phase === 'play') stepExtraBalls(m, dt, fx);

  // Backstop for the one place a ball can end up that nobody can reach: parked on top of a
  // goal. HS has no idle rule — a ball left alone on the open grass rolls on and stays in play
  // (M4 111.0 s rolled untouched for 6.6 s) — so this only fires over a goal, at bar height.
  m.idle += dt;
  const overGoal = (b) => (b.x < C.GOAL_W + C.POST_R + b.r || b.x > C.W - C.GOAL_W - C.POST_R - b.r)
    && b.y <= C.GROUND_Y - C.GOAL_H;
  if (m.phase === 'play' && m.idle > C.BALL_IDLE_RESET && overGoal(m.ball)) {
    const b = m.ball;
    b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y;
    b.vx = 0; b.vy = 0; b.spin = 0; b.power = null;
    m.idle = 0;
    m.events.push({ type: 'ballReset' });
    fx.shockwave(b.x, b.y, '#ffffff');
  }
  return m;
}

// A PAUSE STILL HAS TO WATCH THE BUTTONS.
//
// hitStop and freeze both return out of step() before stepPlayer runs, so for the length of
// the pause nothing updated `p.prev` — the latch the sim reads edges against. It therefore
// still held whatever was true when the pause STARTED, and a release that happened during the
// pause was never seen. Two ways that came out, both measured:
//
//   • Score while holding JUMP (which is how most headers are scored), let go during the
//     two-second restart, press again as play resumes: input.jump is true and the stale
//     prev.jump is also true, so there is no rising edge and the jump is swallowed. It takes
//     another release-and-press to get moving — one dead press, exactly the "stuck input"
//     complaint.
//   • Press JUMP during a hit-stop and keep holding: the press lands entirely inside the
//     pause, and when the pause lifts prev has not moved, so it never becomes an edge at all.
//
// So a pause watches for RELEASES and only releases. Clearing a key that is up records "the
// button came back up", which is what makes the next press an edge; NOT setting a key that is
// down is what stops the pause from eating that press. The two halves together give:
//
//   held right through   prev stays true  -> no free jump on the restart  (the old worry, kept)
//   released during it   prev goes false  -> the next press fires          (the bug, fixed)
//   pressed during it    prev stays false -> it fires the moment play resumes (buffered)
//
// Deterministic from the inputs alone, so a rollback client replaying the same ticks lands on
// the same latch — `prev` already travels in the snapshot (see PREV_KEYS).
function latchReleases(m, inputs) {
  for (let i = 0; i < m.players.length; i++) {
    const p = m.players[i];
    const input = inputs[i] || {};
    if (!p.prev) { p.prev = {}; continue; }
    for (const k of PREV_KEYS) if (!input[k]) p.prev[k] = false;
  }
}
// THE SECOND AND THIRD BALL. Only a Multi-Ball shot makes them, and they are real: they move,
// hit bodies and score through the very same stepBall as the match ball. stepBall only knows
// `m.ball`, so each extra is swapped in for its turn and swapped back out.
function stepExtraBalls(m, dt, fx) {
  const main = m.ball;
  for (const eb of [...m.xballs]) {
    m.ball = eb;
    const n = Math.max(1, Math.min(6, Math.ceil((Math.hypot(eb.vx, eb.vy) * dt) / (C.HEAD_R * 0.8))));
    for (let i = 0; i < n && m.phase === 'play'; i++) stepBall(m, dt / n, fx, i / n, 1 / n);
    m.ball = main;
    if (m.phase !== 'play') {
      // This one scored, and the restart was written onto IT (resetPositions resets m.ball),
      // so the kickoff ball is copied back onto the real one.
      if (m.phase === 'goal') {
        main.x = eb.x; main.y = eb.y; main.vx = eb.vx; main.vy = eb.vy; main.spin = eb.spin; main.power = null;
      }
      m.xballs.length = 0;
      return;
    }
    // An extra lives exactly as long as it is a power ball: blocked, or out of flight, it goes.
    if (!eb.power) m.xballs.splice(m.xballs.indexOf(eb), 1);
  }
}

// ---------------------------------------------------------------------------
function chargeGauge(m, p, dt) {
  // Sudden death freezes the gauges — the wiki's rule, and it stops overtime becoming
  // a power-shot slugfest where positioning stops mattering.
  if (m.golden) return;
  // …and it has not started yet: the kickoff's lead (GAUGE_LEAD).
  if (m.gaugeLead > 0) return;
  // …and a goal's restart is not over until the ball is back. HS M4 stops the bar at the goal
  // (43.40 s) and restarts it with the ball drop (46.59 s); M3 does the same at 39.0 s and
  // 45.7 s. The freeze half never calls this; this is the no-ball half (GOAL_BALL_DELAY).
  if (m.ballWait > 0 || m.afterGoal > 0) return;
  // THE CLOCK IS THE ONLY SOURCE, as in Head Soccer: no tackle, touch or goal adds to it.
  // An arcade champion's meter runs at its POWER stat (meterRate). Everywhere else it is 1x.
  const rate = m.champ ? p.meterRate || 1 : 1;
  if (p.gauge < 1 && C.GAUGE_PASSIVE > 0) p.gauge = Math.min(1, p.gauge + dt * C.GAUGE_PASSIVE * rate);
}

function stepPlayer(m, p, input, dt, fx) {
  // What an AILMENT does to this body (shared/hs-powers.js ailMods), or null. Every use below is
  // `md ? … : <what it always was>`: reverse swaps the stick, shock slows and grounds, freeze and
  // stars take the controls, burn takes the boot.
  tickAilment(m, p, dt);
  const md = ailMods(p);
  if (md) { input = ailInput(md, input); dt *= md.time; }
  chargeGauge(m, p, dt);

  // NOTE there is no `p.armed -= dt` here. The arm used to be a 4.5s countdown that lapsed
  // on its own; it is a flag now and it waits. "You must touch the ball" is only a rule if
  // waiting is not also an answer — and an arm that expires on a clock is an arm a goal's
  // two-second restart can eat the rest of, which is the complaint this came from.
  if (p.kickT > 0) p.kickT -= dt;
  if (p.kickCd > 0) p.kickCd -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.shoved > 0) p.shoved -= dt;
  if (p.tackleImmune > 0) p.tackleImmune -= dt;

  // KNOCKED DOWN. The only place in the sim that takes a player's controls away, and it is
  // always the same length and always ends: `stunned` counts down in real seconds. Nothing can
  // extend it — stun() refuses to touch a player who is already down — so there is no
  // stun-lock to walk into.
  if (p.stunned > 0) {
    tickStun(m, p, dt);
    p.vx *= 0.86;
    // Dazed AND frozen by an arcade power (a strike's paralysis, landing on the same block as
    // the HS daze): frozen means no sliding either, whichever timer took the controls.
    if (md && md.frozen && p.onGround) p.vx *= 0.5;
    integrate(p, dt, md ? md.grav : 1, C.MAX_JUMPS + (md ? md.airJumps : 0), headR(m, p));
    p.prev = { ...input };
    return;                             // out on your feet = no input at all
  }

  const prev = p.prev || {};
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // ---- dash: two taps of the same direction inside DASH_WINDOW ----
  if (p.tapT > 0) p.tapT -= dt;
  for (const [key, d] of [['left', -1], ['right', 1]]) {
    if (input[key] && !prev[key]) {
      // on the ground only: no dashing in the air (Idan, 2026-09-26)
      if (p.tapDir === d && p.tapT > 0 && p.dashCd <= 0 && p.onGround && !(md && md.noDash)) {
        p.dashT = C.DASH_TIME; p.dashDir = d; p.dashCd = md && md.dashFree ? 0.12 : C.DASH_COOLDOWN;
        p.tapT = 0; p.tapDir = 0;
        m.events.push({ type: 'dash', player: p.index, dir: d });
      } else {
        p.tapDir = d; p.tapT = C.DASH_WINDOW;
      }
    }
  }

  if (dir !== 0) p.facing = dir;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * C.DASH_V * p.stats.speed * (md ? md.speed : 1);
  } else if (p.shoved > 0) {
    // A SHOVE OWNS THE BODY for TACKLE_SHOVE: ballistic in the air, a short slide on the grass.
    // With instant steering below, anything less and the knockback would last one tick.
    if (p.onGround) p.vx *= C.PLAYER_FRICTION;
  } else {
    const target = dir * C.PLAYER_SPEED * p.stats.speed * (md ? md.speed : 1);
    if (md && (md.accel < 1 || md.friction)) {
      // The arcade's grip powers (ice, mud) are the one place a body still has to get going
      // and slide to a stop — that is what they ARE. SLIP_ACCEL is the old ground grip.
      const accel = C.SLIP_ACCEL * dt * md.accel;
      if (dir !== 0) p.vx += clamp(target - p.vx, -accel, accel);
      else if (p.onGround) p.vx *= md.friction || C.PLAYER_FRICTION;
    } else {
      // HS M4: full speed, a dead stop and a reversal each inside 3 frames — the body simply
      // takes the stick's velocity. Ground and air alike (the air is an assumption: see
      // PLAYER_SPEED).
      p.vx = target;
    }
  }
  // Frozen solid: no sliding on the ground — but a body in the air stays ballistic, which is
  // how the arcade's רעידת אדמה throws somebody who cannot do anything about it.
  if (md && md.frozen && p.onGround) p.vx *= 0.5;

  // ---- jump ----
  // Two forgiveness windows, because a jump that eats your input feels broken even when
  // it is technically correct: COYOTE lets you jump just after leaving the ground, BUFFER
  // lets a press just before landing fire on touchdown. Both are 3 frames (see COYOTE_TIME).
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuf = (input.jump && !prev.jump) ? C.JUMP_BUFFER : Math.max(0, p.jumpBuf - dt);
  if (p.onGround) p.landT += dt;
  // HOLDING JUMP JUMPS AGAIN, JUMP_REJUMP after every landing (HS M4 23.81–26.25 s). A held
  // button is a level, not an edge, so this is the one jump that does not need a fresh press.
  const rejump = input.jump && p.onGround && p.landT >= C.JUMP_REJUMP - 1e-9;

  // `air` is a champion's extra jump in the air; zero everywhere else, which leaves this the
  // ground-or-coyote test it always was.
  const air = md ? md.airJumps : 0;
  if ((p.jumpBuf > 0 || rejump) && (p.onGround || p.coyote > 0 || air > 0) && p.jumps > 0 && !(md && md.noJump)) {
    p.vy = -C.JUMP_V * p.stats.jump * (md ? md.jump : 1);
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumps--;
    m.events.push({ type: 'jump', player: p.index });
  }
  // NO VARIABLE HEIGHT. A jump let go of early used to be cut short (JUMP_CUT); HS M4's jumps
  // are 45.8px whether JUMP is tapped or held, so the impulse above is the whole jump.

  // ---- kick ----
  if (input.kick && !prev.kick && p.kickCd <= 0) {
    // NO HEADER BUTTON. HS's KICK only ever swings the leg — the boot rises to head height
    // (see the kick hitbox) and a ball on the head is played by the head's own bounce. The
    // aimed header that used to be checked here headed balls resting at the feet (HS-GAP-AUDIT
    // K1) and launched at 811 px/s against HS's 626 (K2), so it is gone.
    p.kickT = C.KICK_TIME;
    p.kickCd = C.KICK_COOLDOWN;
    // AND THE DIRECTION, WHICH IS NOT THE FACING ANY MORE.
    //
    // This was `p.facing`, latched at the swing so that turning mid-kick could not steal the
    // aim. The latch fixed the mid-swing turn and left the other half standing: walk BACKWARDS
    // — away from the goal you are attacking — and the boot swung backwards with you, so a
    // retreating player who pressed kick drove the ball at his OWN net. That is never the shot
    // anybody meant, and the leg you could see was pointing the wrong way while it happened.
    //
    // The boot now always swings toward the goal this player attacks, which is what `side` is,
    // whatever the body is doing. The sprite is drawn off the same rule (drawBody), so the leg
    // you see out in front is the leg that can touch the ball. Facing is the walk, not the aim.
    p.kickDir = p.side;
    m.events.push({ type: 'kick', player: p.index });
    tryCounter(m, p, fx);
    tryTackle(m, p, fx);
  }

  // ---- THE ULTIMATE: THE BUTTON ONLY ARMS ----
  //
  // Three gates, and every one of them is the answer to a way the ultimate used to go off on
  // its own. (There used to be a fourth — "you are not rooted" — from the days when a hit
  // could lock you out of acting. Nothing roots anybody now, and a stunned player has already
  // returned out of this function long before here.)
  //
  //   RISING EDGE   — `input.power && !prev.power`. Read as a LEVEL this fires on every tick
  //                   the button is down, and on a rollback client on every replayed tick
  //                   too. `prev` is {} on the first tick of a match, so a controller (or a
  //                   bot) holding power at kickoff gets exactly one arm out of it, not sixty.
  //   gauge >= 1    — a full meter, and nothing less.
  //   armed <= 0    — already armed is already armed. Pressing again is not a second arm and
  //                   is certainly not an activation.
  //
  // THE PRESS SPENDS THE METER. HS M4 36.49 s: POWER pressed, the bar is empty by 36.56 s
  // and already refilling at 36.67 s, 5.4 s before the touch that fires the shot (41.93 s)
  // — and in M3 the bar climbs straight through the player's cut-in at 71.5 s without a
  // blink. So the gauge goes to zero HERE and chargeGauge starts the refill on the next
  // tick; the arm (the glow) is what waits for the ball. A refill that reaches full again
  // while still armed does not buy a second arm: `armed <= 0` above holds it until the
  // first one has fired (no footage shows HS stacking them).
  //
  // What it still does NOT do: touch the ball, create an attraction or fire a shot. The
  // press is a promise; the ball is what collects on it. See fireUltimateOnContact.
  if (input.power && !prev.power && p.gauge >= 1 && p.armed <= 0) {
    p.armed = 1;                       // a flag, not a clock — see the note in constants.js
    p.gauge = 0;                       // spent on the press; the refill starts now
    m.events.push({ type: 'armed', player: p.index, shot: p.shot.id, aura: p.shot.aura });
    // …and a character with an AURA hits a nearby opponent with it on the press (hs-powers onArm).
    onArm(m, p, KIT, fx);
  }

  integrate(p, dt, md ? md.grav : 1, C.MAX_JUMPS + (md ? md.airJumps : 0), headR(m, p));
  p.prev = { ...input };
}

// `gm` is the spectacle's gravity multiplier for this player: lighter under a moon phase,
// heavier as a robot. `jumps` is how many the pickups say they get back on landing. Both
// are arguments rather than lookups so integrate() stays a pure function of the player.
function integrate(p, dt, gm = 1, maxJumps = C.MAX_JUMPS, hr = C.HEAD_R) {
  // One gravity, up and down alike: HS's jump is a single parabola (PLAYER_GRAV).
  p.vy += C.PLAYER_GRAV * gm * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.y >= C.GROUND_Y) {
    p.y = C.GROUND_Y;
    if (p.vy > 0) p.vy = 0;
    if (!p.onGround) { p.jumps = maxJumps; p.landT = 0; }
    p.onGround = true;
  } else if (p.stand < 0) {
    p.onGround = false;
  }
  // …else STANDING ON A HEAD: the support is the other body, not GROUND_Y, and it is only known
  // once both bodies have moved — resolvePlayers() puts this body back on the crown it sank
  // into by a tick of gravity, stops its fall, and decides whether it is still standing. Until
  // then it keeps its footing (a jump has already cleared `onGround` above, in stepPlayer).
  applyBounds(p, hr);
}

// THE GOAL IS A ROOM, NOT A WALL — AND IT HAS A CEILING.
//
// Both players used to be clamped at the goal LINE, which put an invisible pane of glass
// across the mouth of a goal you can see straight into: you could stand on the line and never
// in the net, and the net you could never reach was drawn in front of you anyway. The mouth
// is a doorway now. The back of the net is the wall, and the CROSSBAR is the ceiling.
//
// The bar is the same one the ball has always bounced off — `bounceOffCrossbar` below and
// `barCeiling` in goalbox.js are the same capsule, radius POST_R, laid along y = barY across
// the goal's depth. A head meets it exactly where a ball does, which is the only way the two
// can agree about where the roof of the net is.
//
// IT IS RESOLVED STRAIGHT DOWN, not out along the contact normal the way the ball is. A normal
// push would also shove the player sideways — up to 16px in a frame for a head clipping the
// bar's end — and a body that slides sideways when you jump is a worse bug than the one this
// fixes. Down is the only direction a ceiling needs.
//
// `hr` is the player's REAL head radius, so a big-head pickup meets the bar where its own head
// is rather than where a nominal one would be. It is an argument rather than a lookup so this
// stays a pure function of the player.
function applyBounds(p, hr = C.HEAD_R) {
  const hOff = p.y - headYAt(p.y);              // feet line to head centre; a constant 49px
  const ceil = barCeiling(p.x, hr) + hOff;      // …as a feet line. -Infinity out on the pitch
  // The guard is for a mouth tuned shorter than a player is tall: a ceiling under the grass
  // would fight the ground clamp forever. Such a goal is simply one nobody can stand in, and
  // the bounds below are what keep them out of it.
  if (ceil <= C.GROUND_Y && p.y < ceil) {
    p.y = ceil;
    if (p.vy < 0) p.vy = 0;                     // the bump: the rise stops, gravity does the rest
  }
  // …and now, standing where they ended up: is there room to be IN the goal? The test is the
  // crown against the underside of the bar, and under the bar it is the same number the
  // ceiling just produced, so a player pinned against the bar inside the net reads as "under
  // it" and keeps the doorway. Miss that and they would be flung out sideways mid-jump.
  const crown = p.y - hOff - hr;
  const { lo, hi } = walkBounds(C.BODY_W, crown >= barY() + C.POST_R - 1e-6);
  if (p.x < lo) { p.x = lo; if (p.vx < 0) p.vx = 0; }
  if (p.x > hi) { p.x = hi; if (p.vx > 0) p.vx = 0; }
}

// ---------------------------------------------------------------------------
// PLAYERS ARE SOLID TO EACH OTHER (HS M4). Each is a head circle on a body box — the same two
// shapes the ball meets — and all four pairs collide. That replaces separatePlayers, which only
// ever pushed two feet lines apart sideways: a player could not stand on a head, lean on one,
// or be anywhere but beside the other.
//
// Contacts come in two kinds, by the contact normal:
//
//   ON TOP   the normal is within 45° of vertical. The UPPER body takes the whole correction —
//            the lower one has the grass under it — and may not move INTO the lower one (only
//            the approach along the normal is removed, so on a slope it slides). It is standing:
//            `stand` = the lower one's index, `onGround` so it can jump off, jumps back.
//            Nothing carries it sideways: HS M4 53.00–53.40 s, the CPU walked ~30px under a
//            player standing on its head and the player stayed where he was (x 886–888).
//   BESIDE   anything shallower. Split half and half, as the old push was; a body walking into
//            the other shoves it. BODY_GRIP then lets the push hold an airborne body UP (never
//            down, never sideways): HS M4 66.40–66.78 s, the dasher kept pushing and the CPU
//            hung on his shoulder instead of falling. `stand` marks that too; `onGround` not.
//
// Swept, like the ball: both bodies are walked along their tick in slices no longer than 4px
// of relative motion, so a 30px-a-tick dash meets the other body where it first touches it
// (the side of the box) rather than 20px deep, where the shortest way out can point straight
// up — which would be the dash-under launch HS does not have (M4 66.36 s: no launch).
//
// applyBounds() runs after every push, so no correction can put a body through the back of
// the net or up through the crossbar; when the bar stops the upper body going up, it goes
// sideways instead, out of the mouth (see the ceiling fallback below), so two players can
// never wedge under the bar.
const STACK_SLICE = 4;

// Deepest overlap of circle (cx,cy,r) with box [l,rt]×[t,bt]: {d, nx, ny}, n out of the box.
function circleBox(cx, cy, r, l, rt, t, bt) {
  const qx = clamp(cx, l, rt), qy = clamp(cy, t, bt);
  const dx = cx - qx, dy = cy - qy, dist = Math.hypot(dx, dy);
  if (dist > 1e-9) return dist < r ? { d: r - dist, nx: dx / dist, ny: dy / dist } : null;
  // Centre inside the box: out through the nearest face.
  const fl = cx - l, fr = rt - cx, ft = cy - t, fb = bt - cy, f = Math.min(fl, fr, ft, fb);
  if (f === ft) return { d: r + ft, nx: 0, ny: -1 };
  if (f === fb) return { d: r + fb, nx: 0, ny: 1 };
  return f === fl ? { d: r + fl, nx: -1, ny: 0 } : { d: r + fr, nx: 1, ny: 0 };
}

// The deepest of the four shape pairs between players a and b, n pointing from b toward a
// (the way to move a). `skin` counts a gap that small as touching. null when apart.
export function playerContact(m, a, b, skin = 0) {
  const ra = headR(m, a), rb = headR(m, b);
  const ahx = a.x, ahy = headYAt(a.y), bhx = b.x, bhy = headYAt(b.y);
  const hw = C.BODY_W / 2;
  // The box's top sits under the head (they overlap by NECK); its bottom is the boots.
  const aT = bodyTopAt(a.y), aB = a.y, bT = bodyTopAt(b.y), bB = b.y;
  let best = null;
  const take = (c) => { if (c && (!best || c.d > best.d)) best = c; };
  { // head – head
    const dx = ahx - bhx, dy = ahy - bhy, dist = Math.hypot(dx, dy);
    if (dist < ra + rb + skin) take(dist > 1e-9 ? { d: ra + rb - dist, nx: dx / dist, ny: dy / dist } : { d: ra + rb, nx: 0, ny: -1 });
  }
  { // a's head – b's body
    const c = circleBox(ahx, ahy, ra + skin, bhx - hw, bhx + hw, bT, bB);
    if (c) take({ ...c, d: c.d - skin });
  }
  { // a's body – b's head (flip the normal: it came out pointing at b)
    const c = circleBox(bhx, bhy, rb + skin, ahx - hw, ahx + hw, aT, aB);
    if (c) take({ d: c.d - skin, nx: -c.nx, ny: -c.ny });
  }
  { // body – body
    const ox = Math.min(ahx, bhx) + hw - (Math.max(ahx, bhx) - hw) + skin;
    const oy = Math.min(aB, bB) - Math.max(aT, bT) + skin;
    if (ox > 0 && oy > 0) {
      take(ox < oy ? { d: ox - skin, nx: ahx >= bhx ? 1 : -1, ny: 0 } : { d: oy - skin, nx: 0, ny: a.y <= b.y ? -1 : 1 });
    }
  }
  return best && best.d > -skin ? best : null;
}

// |ny| at or past this: one body is ON TOP of the other — within 45° of vertical — and standing
// on it. Anything steeper is the side of a head: pushed apart sideways, falling freely, so a body
// that ends up there slides off rather than creeping down the curve.
const ON_TOP = Math.SQRT1_2;

// One positional push apart along the contact, then both bodies back inside their bounds.
function pushApart(m, a, b, c) {
  let wa = 0.5, wb = 0.5;
  if (Math.abs(c.ny) >= ON_TOP) { if (c.ny < 0) { wa = 1; wb = 0; } else { wa = 0; wb = 1; } }
  const ay = a.y, by = b.y;
  if (wa === 0.5) {
    // BESIDE: straight apart, sideways only — as far sideways as clears the overlap along n.
    // A shove never lifts: a body walked into the side of an airborne one (a dash under it)
    // must not ride it up the curve of a head, which is the launch HS does not have.
    const sx = (c.d / Math.max(Math.abs(c.nx), 0.5)) * Math.sign(c.nx) * 0.5;
    a.x += sx; b.x -= sx;
  } else {
    a.x += c.nx * c.d * wa; a.y += c.ny * c.d * wa;
    b.x -= c.nx * c.d * wb; b.y -= c.ny * c.d * wb;
  }
  // Never below the grass (the lower body takes no share of an on-top push, but a sideways one
  // with a sliver of down in it must not sink a boot).
  if (a.y > C.GROUND_Y) a.y = C.GROUND_Y;
  if (b.y > C.GROUND_Y) b.y = C.GROUND_Y;
  applyBounds(a, headR(m, a)); applyBounds(b, headR(m, b));
  // THE CEILING FALLBACK. The bar stopped the upper body going up (applyBounds pulled it back
  // down), so the stack cannot resolve upward: slide the upper body out sideways instead, away
  // from the goal it is under. Without this the push up and the bar's push down cancel every
  // tick and the two bodies stay wedged inside each other under the crossbar.
  const up = wa === 1 ? a : wb === 1 ? b : null;
  if (up) {
    const wanted = up === a ? ay + c.ny * c.d : by - c.ny * c.d;
    if (up.y > wanted + 0.5) {
      const dir = up.x < C.W / 2 ? 1 : -1;
      up.x += dir * (up.y - wanted);
      applyBounds(up, headR(m, up));
    }
  }
}

function resolvePlayers(m) {
  const [a, b] = m.players;
  const was = [a.stand, b.stand];
  a.stand = -1; b.stand = -1;
  contactPlayers(m, a, b);
  // Stepped off, or the head walked away: in the air again (integrate() kept `onGround` for a
  // body that was standing on a head — see there — so it is cleared here, where it is known).
  for (const p of m.players) {
    if (was[p.index] >= 0 && p.stand < 0 && p.y < C.GROUND_Y) p.onGround = false;
  }
}

function contactPlayers(m, a, b) {
  const ax0 = a.x0 ?? a.x, ay0 = a.y0 ?? a.y, bx0 = b.x0 ?? b.x, by0 = b.y0 ?? b.y;
  const reach = headR(m, a) + headR(m, b) + 4;
  // Far apart for the whole tick (and never crossed): nothing to do.
  if (Math.min(Math.abs(a.x - b.x), Math.abs(ax0 - bx0)) > reach && Math.sign(a.x - b.x) === Math.sign(ax0 - bx0)) return;

  // Walk both along their tick. `dA`/`dB` are the corrections so far, carried into every
  // later slice so a body pushed at slice k stays pushed.
  const ax1 = a.x, ay1 = a.y, bx1 = b.x, by1 = b.y;
  const rel = Math.hypot((ax1 - ax0) - (bx1 - bx0), (ay1 - ay0) - (by1 - by0));
  const slices = Math.max(1, Math.min(12, Math.ceil(rel / STACK_SLICE)));
  let dAx = 0, dAy = 0, dBx = 0, dBy = 0;
  for (let k = 1; k <= slices; k++) {
    const f = k / slices;
    a.x = ax0 + (ax1 - ax0) * f + dAx; a.y = Math.min(C.GROUND_Y, ay0 + (ay1 - ay0) * f + dAy);
    b.x = bx0 + (bx1 - bx0) * f + dBx; b.y = Math.min(C.GROUND_Y, by0 + (by1 - by0) * f + dBy);
    const pax = a.x, pay = a.y, pbx = b.x, pby = b.y;
    for (let it = 0; it < 3; it++) {
      const c = playerContact(m, a, b);
      if (!c || c.d < 1e-3) break;
      pushApart(m, a, b, c);
    }
    dAx += a.x - pax; dAy += a.y - pay; dBx += b.x - pbx; dBy += b.y - pby;
  }

  // Velocities, off the contact they end the tick in (touching within half a pixel).
  const c = playerContact(m, a, b, 0.5);
  if (!c) return;
  if (Math.abs(c.ny) >= ON_TOP) {
    const up = c.ny < 0 ? a : b, lo = up === a ? b : a;
    const ux = up === a ? c.nx : -c.nx, uy = up === a ? c.ny : -c.ny;   // n, lower -> upper
    // Its motion INTO the lower body stops; along the surface it keeps going, so a body on the
    // steep side of a head slides off it rather than hanging there.
    const vn = (up.vx - lo.vx) * ux + (up.vy - lo.vy) * uy;
    if (vn < 0) { up.vx -= vn * ux; up.vy -= vn * uy; }
    if (!up.onGround) {                             // a landing, as on the grass
      up.jumps = C.MAX_JUMPS;
      up.landT = 0;
    }
    up.onGround = true;
    up.stand = lo.index;
    return;
  }
  // Beside: the approach along the normal is cancelled, half each (the walk re-sets vx next
  // tick anyway — this is what a shove IS for that one tick).
  const vn = (a.vx - b.vx) * c.nx + (a.vy - b.vy) * c.ny;
  if (vn >= 0) return;
  a.vx -= 0.5 * vn * c.nx; b.vx += 0.5 * vn * c.nx;
  // BODY_GRIP: the push can hold an airborne body up against the one pushing it. One way —
  // it only ever slows a body FALLING relative to the other, so a jump beside somebody is never
  // damped, and nothing here moves anybody sideways.
  const grip = C.BODY_GRIP * -vn;
  for (const [p, q] of [[a, b], [b, a]]) {
    if (p.onGround || p.y >= C.GROUND_Y - 0.5) continue;
    const fall = p.vy - q.vy;
    if (fall > 0) { p.vy -= Math.min(fall, grip); if (p.vy - q.vy < 1e-6) p.stand = q.index; }
  }
}

// `a0`/`aSpan` are this call's slice of the tick, as a fraction: the swept player pose in
// resolveBallPlayers is read at a0 + aSpan * (progress through the sub-steps).
function stepBall(m, dt, fx, a0 = 0, aSpan = 1) {
  const b = m.ball;

  // A power ball flies its FAMILY's path (shared/hs-powers.js stepPower); a loose one falls.
  const powered = stepPower(m, b, dt, KIT, fx);
  if (!powered) {
    // ONE gravity, and nothing else bends a loose ball. The wind used to add an acceleration
    // here and the magnet another; both are gone (archive/README.md), which is what makes the
    // flight of a kicked ball a thing a player can learn once.
    b.vy += C.BALL_GRAV * dt;
    b.vx *= C.BALL_AIR ** (dt / C.TICK);          // per tick, whatever the sub-step
  }
  b.spin *= C.BALL_SPIN_DECAY;

  // Powered balls are exempt: stepPowerShot re-sets their velocity every tick, so there is
  // nothing to run away, and clamping them here silently pinned POWER_SHOT_SPEED to
  // BALL_MAX_SPEED — the power shot's speed knob did nothing for as long as it existed.
  const sp = Math.hypot(b.vx, b.vy);
  // Never slower than the fastest body on the pitch, though: a dash (1790 px/s) outruns the cap,
  // and a capped ball it kept catching was bounced again every tick — pumped to 2300–3600 px/s
  // off a body that sprang back. Just ahead of the dash it is pushed, not fired, and the cap is
  // the ordinary 1100 again the moment the dash ends.
  const cap = Math.max(C.BALL_MAX_SPEED, 1.1 * Math.max(Math.abs(m.players[0].vx), Math.abs(m.players[1].vx)));
  if (!powered && sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }

  // Sub-step the ball so it can never skip past a body in one tick. Discrete stepping
  // let a 1250px/s shot jump the 40px-wide body box, after which the nearest-point
  // push-out resolved it on the WRONG side — straight into the net. That single bug was
  // half of every bot-vs-bot scoreline (52% of goals came with the defender on the line).
  const travel = Math.hypot(b.vx, b.vy) * dt;
  const sub = Math.max(1, Math.min(8, Math.ceil(travel / (C.BALL_R * 0.5))));
  const sdt = dt / sub;
  for (let i = 0; i < sub; i++) {
    // Where the ball starts this slice of its own travel. A goal is measured from here to
    // where the travel ENDS — see enteredGoal — so that the entry is something the ball did
    // and never something that was done to it.
    const fromX = b.x, fromY = b.y;
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    collideBounds(m, b, fx, sdt);
    // DECIDED BEFORE THE PLAYERS ARE ASKED, and on the ball's own motion. resolveBallPlayers
    // moves the ball — that is what a push-out is — and a ball that is in the net only because
    // a body put it there has not scored. It gets to take a goal AWAY (checkGoal re-tests the
    // final position, so a defender who hooks it back out has still saved it); it does not get
    // to award one.
    const scorer = enteredGoal(fromX, fromY, b);
    resolveBallPlayers(m, fx, a0 + aSpan * ((i + 1) / sub));
    // A player's push comes after the walls, and a player can stand inside a net (the free play
    // after a goal): it never pushes the ball through the side walls or the back of the net.
    const back = b.r + (b.y > C.GROUND_Y - C.GOAL_H ? C.POST_R : 0);
    if (b.x < back) b.x = back; else if (b.x > C.W - back) b.x = C.W - back;
    if (scorer !== null && checkGoal(m, fx, scorer)) return;
  }
}

// A GOAL IS A CROSSING, NOT A PLACE.
//
// Returns the player who scored, or null. The ball must have been outside the opening at
// `from`, be inside it now, and have travelled INTO that net to get there — position, plane
// and direction, all three. Being near a goal, resting in one, or being carried into one are
// all "not a crossing", which is the whole point: the only thing that counts is the ball's own
// passage through the mouth of the correct net.
function enteredGoal(fromX, fromY, b) {
  const into = ballInGoal(b.x, b.y, b.r);
  if (!into) return null;                            // not inside an opening
  if (ballInGoal(fromX, fromY, b.r)) return null;    // already behind the line: nothing crossed
  // …and it went IN. `inward` on the box points towards the middle of the PITCH, so a step
  // along it is a step back out of the net; a goal is the other way (or straight down, which
  // is a ball dropping in under the bar — hence the sign test and not a strict one).
  if ((b.x - fromX) * into.inward > 0) return null;
  return into.left ? 1 : 0;                          // the left net is player 1's goal
}

function collideBounds(m, b, fx, dt = C.TICK) {
  // ground
  if (b.y > C.GROUND_Y - b.r) {
    b.y = C.GROUND_Y - b.r;
    if (b.vy > 0) {
      if (b.power) { b.vy = -Math.abs(b.vy) * 0.45; }
      else {
        const v = b.vy;
        b.vy = -b.vy * C.BALL_BOUNCE;
        if (Math.abs(b.vy) < 60) b.vy = 0;
        else m.events.push({ type: 'bounce', v });   // the thump on the grass (audio)
        fx.hit(b.x, b.y, '#ffffff', 0.4);
      }
    }
    b.vx *= C.BALL_GROUND_FRICTION ** (dt / C.TICK);
  }
  // ceiling
  // ceiling — off the top of the screen, and dead: it keeps 0.41 of the climb and kills the
  // sideways speed (HS M4; CEIL_BOUNCE, CEIL_KEEP_X), so a skied ball drops back almost straight.
  if (b.y < C.CEIL_Y + b.r) {
    b.y = C.CEIL_Y + b.r;
    if (b.vy < 0) { b.vy = -b.vy * C.CEIL_BOUNCE; b.vx *= C.CEIL_KEEP_X; }
  }

  // side walls — only ABOVE the goal mouth; inside the mouth the ball is a goal
  const inMouthY = b.y > C.GROUND_Y - C.GOAL_H;
  if (!inMouthY) {
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * C.BALL_WALL_BOUNCE; }
    if (b.x > C.W - b.r) { b.x = C.W - b.r; b.vx = -Math.abs(b.vx) * C.BALL_WALL_BOUNCE; }
  } else {
    // BACK OF THE NET, and it is the frame's rear post rather than the screen edge. Those are
    // POST_R apart, which is nothing to the physics and everything to the picture: the back
    // rail is drawn at POST_R, so a ball stopping at the edge of the canvas was a ball resting
    // half way THROUGH the back of the goal it had just gone into.
    const back = b.r + C.POST_R;
    if (b.x < back) { b.x = back; b.vx = Math.abs(b.vx) * 0.2; }
    if (b.x > C.W - back) { b.x = C.W - back; b.vx = -Math.abs(b.vx) * 0.2; }
  }

  // crossbars: a full bar over each net, the ROOF EDGE where the drawn box overhangs that bar,
  // and the front post all of it hangs off
  const barY = C.GROUND_Y - C.GOAL_H;
  const v0 = Math.hypot(b.vx, b.vy);
  let rang = bounceOffBar(b, 0, barY, C.GOAL_W, barY, fx);
  rang = bounceOffBar(b, C.W - C.GOAL_W, barY, C.W, barY, fx) || rang;
  bounceOffRoofEdge(b, true, fx);
  bounceOffRoofEdge(b, false, fx);
  bounceOffRoof(b, true, fx);
  bounceOffRoof(b, false, fx);
  rang = bounceOffPost(b, C.GOAL_W, barY, fx) || rang;
  rang = bounceOffPost(b, C.W - C.GOAL_W, barY, fx) || rang;
  if (rang && v0 > 80) m.events.push({ type: 'post', v: v0 });   // the ring of the frame (audio)
}

// THE ROOF EDGE — the half of the crossbar that was drawn and never existed.
//
// Reported, twice: "you can see the top right of the goal but the ball falls straight through
// it like it's nothing." It was not the collider failing to fire. There was no collider there
// at all, and there never had been.
//
// The renderer draws the goal as a BOX: a near frame on the plane the ball is played on, and a
// far frame stepped `wx` toward the middle of the pitch and `wy` up the screen (shared/
// goalbox.js — WIDTH_X 0.40, WIDTH_Y 0.13). The crossbar therefore leaves the near post at
// (lineX, top) and RECEDES to (lineX + wx, top + wy), so the goal's roof reaches 27.6px further
// out over the pitch than its near rail does, and stands 18.7px taller at the far side.
//
// That line is not an inference about the picture. public/game.js strokes it by name:
//
//     // THE CROSSBAR: post to post across the mouth.
//     g.lineWidth = bar * 0.78;
//     line(g, nFT, fFT);
//
// nFT → fFT, the same two points this function asks goalBox for. The renderer has been
// drawing a crossbar there since the goal became a box; the sim just never had one.
//
// bounceOffBar only ever had the near rail: x from the wall to lineX, dead flat at y = top.
// Every pixel of roof past lineX — 40% of the goal's own depth, an 18px-wide hole once the
// ball's radius is taken off it — was painted frame with nothing behind it. A ball dropped
// into that band fell through the picture of a crossbar. Measured before the fix: left goal
// screen x 79..96, right goal 963..981.
//
// So the roof edge is a bar like any other, along the line the renderer already draws it on,
// read out of the SAME goalBox() the renderer reads. That is the point of putting it here
// rather than typing the numbers in: the two cannot drift apart again.
//
// AND IT IS SOLID FROM ABOVE ONLY, which is the whole difficulty of the thing.
//
// Two-sided, it wrecks the game. A shot driven flat along bar height meets this segment out on
// the pitch — 20px before the post, because the segment leans out over the pitch — and the
// face it meets is the UNDERSIDE, which slopes down toward the goal. So the bar it was
// supposed to rattle off instead became a ramp that steered it in. Measured with it two-sided:
// both "a shot at bar height hits the frame instead of scoring" (test-goal) and "a shot at
// crossbar height does NOT score" (test-sim) flipped, and a level-5 bot stopped being able to
// outscore a level-1 one at all — the goal had quietly grown a funnel.
//
// The projection says the same thing the tests do. The ball is played on the NEAR plane, and
// this segment is the crossbar RECEDING away from that plane, so a ball level with it is not
// under it — it is in FRONT of it, and it should sail past exactly as it always did and meet
// the near post instead. What a ball cannot do is come down THROUGH it, because from above the
// roof is the first solid thing in its way. Solid from above, open from below: both halves are
// what the picture already shows, and each is fenced in test-goal section 7.
//
// It therefore cannot narrow the goal either. `wy` is negative — the far side steps UP — so
// the whole segment lies above the crossbar, the mouth is everything below the crossbar, and
// the one-sided test rules out even the corner case near the post.
function bounceOffRoofEdge(b, left, fx) {
  const box = goalBox(left);
  bounceOffBar(b, box.lineX, box.top, box.lineX + box.wx, box.top + box.wy, fx, true);
}

// THE ROOF ITSELF — the far frame's top rail, the one the renderer draws a step up and across
// from the near one (wx, wy). HS M4: a ball dropped onto the goal lands on its ROOF, 154px above
// the grass, not on the front bar (138): the net has a top you can see and the ball sits on it.
// So the rail the picture already draws becomes a surface — solid from above, open from below,
// for the same reasons as the roof edge — and a ball over the net comes to it before it ever
// reaches the near rail 17px lower. It spans the drawn far rail exactly, back post to front.
//
// STRICTLY one-sided, without the roof edge's "climbing straight through" exception: the only
// way to be under this rail is to be on the near rail (17px under it, not the 34 a ball needs to
// fit between them), and a ball bouncing up off that rail must not then be slammed back down
// into it by the roof — that is a crusher, not a goal. Nothing climbs to it from inside the mouth
// anyway: the near rail stops it first, and over the pitch the roof edge does.
function bounceOffRoof(b, left, fx) {
  const box = goalBox(left);
  bounceOffBar(b, box.wallX + box.wx, box.top + box.wy, box.lineX + box.wx, box.top + box.wy, fx, 'strict');
}

// A BAR: any capsule of radius POST_R laid along a segment, and the ball bounces off it.
//
// This was `bounceOffCrossbar(b, x0, x1, barY)` — a horizontal span only, clamped on x — which
// is all the near rail ever needed. It takes two endpoints now because the goal's roof edge
// is the same bar at an ANGLE (see bounceOffRoofEdge), and a crossbar that only knows how to
// be flat is a crossbar that stops existing wherever the drawn one tilts. For a flat segment
// the closest-point solve below reduces exactly to the clamp it replaces, so the near rail
// behaves to the pixel as it did.
//
// Without a bar here at all a ball could drop straight through the roof of the net, and
// "score" meant "the centre got past the line at roughly bar height" — which is what made
// shots that visibly clipped the top of the goal count.
function bounceOffBar(b, ax, ay, bx, by, fx, fromAboveOnly = false) {
  const ex = bx - ax, ey = by - ay;
  const len2 = ex * ex + ey * ey;
  // Where along the bar the ball is closest to, as a fraction, clamped to its ends so the
  // caps are round — a ball past the end of a bar meets its corner, not a wall.
  const t = len2 > 0 ? clamp(((b.x - ax) * ex + (b.y - ay) * ey) / len2, 0, 1) : 0;
  const px = ax + ex * t, py = ay + ey * t;
  const dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = b.r + C.POST_R;
  if (d >= min) return;
  // A ONE-SIDED bar is solid to land on and open to pass under — see bounceOffRoofEdge for
  // why the goal's roof has to be both. The side is decided by position, not by which way the
  // ball happens to be travelling: the ball is stepped in slices no longer than half its own
  // radius, so it is always SEEN on the near side of a surface before it is through it, and a
  // velocity test would instead let a ball that had already sunk into the bar be shoved back
  // out of the wrong face.
  //
  // EXCEPT a ball climbing STRAIGHT THROUGH it. "Open from below" was only ever meant to let a
  // shot driven roughly LEVEL at bar height sail past the receding roof edge and meet the near
  // rail instead — that ball's vy is near zero, gravity if anything pulling it down, never the
  // reason it is under the segment. A ball on a strongly rising path (vy < 0, i.e. still going
  // UP, not just arriving from below on its way down) is not sailing past anything: it is a
  // ball headed straight through the net's roof from underneath, and this was the hole it went
  // through. Reported: the ball could not fall through the roof from above, but shot straight
  // up through it from inside the mouth as if there were nothing there.
  if (fromAboveOnly && (b.vy >= 0 || fromAboveOnly === 'strict')) {
    let upx = ey, upy = -ex;                      // a perpendicular…
    if (upy > 0) { upx = -upx; upy = -upy; }      // …taken on the side the sky is on
    if (dx * upx + dy * upy <= 0) return;         // ball is under the bar: it passes in front
  }
  if (d < 0.0001) { b.y = py - min; b.vy = -Math.abs(b.vy) * 0.7; return; }
  const nx = dx / d, ny = dy / d;
  b.x = px + nx * min;
  b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx = (b.vx - 2 * dot * nx) * C.BAR_BOUNCE;
    b.vy = (b.vy - 2 * dot * ny) * C.BAR_BOUNCE;
  }
  // Nothing may come to REST on the bar. A ball that lands flat on top has no horizontal
  // velocity to roll it off and the bar keeps pushing it back up, so it sits there — which
  // is exactly what happened at (939, 215) and hung a whole match. Anything slow enough to
  // settle gets nudged off toward the pitch.
  //
  // TOPPED UP, never ADDED. A ball settling into a weak bounce cycle here calls this on
  // several consecutive ticks — vy crossing zero slower each time as the 0.72 restitution
  // bleeds it out — and `+=` stacked a fresh 70 onto whatever was already there on every one
  // of them, so the ball left the bar under a hundred-plus px/s it never earned. That is not
  // what "passes through the crossbar" was (that was the missing roof edge, above), but it is
  // its own bug: a collision that hands the ball free energy reads as the bar spitting it
  // away. Topping up to 70 holds the nudge at exactly the speed the comment above asks for —
  // enough to roll off — and calling it again next tick, still resting, does nothing further.
  if (b.y < py && Math.hypot(b.vx, b.vy) < 90) {
    const towardPitch = px < C.W / 2 ? 1 : -1;
    const along = b.vx * towardPitch;               // how fast it's already headed that way
    if (along < 70) b.vx += (70 - along) * towardPitch;
  }
  fx.hit(px, py, '#ffe08a', 1);
  return true;
}

function bounceOffPost(b, px, py, fx) {
  const dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = b.r + C.POST_R;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d;
  b.x = px + nx * min; b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  // the post is the bar's own tube, so it keeps the bar's bounce (was a hard-coded 0.78)
  b.vx = (b.vx - 2 * dot * nx) * C.BAR_BOUNCE;
  b.vy = (b.vy - 2 * dot * ny) * C.BAR_BOUNCE;
  fx.hit(px, py, '#ffe08a', 1);
  return true;
}

// ---------------------------------------------------------------------------
// THE KICK-BLOCK, pressed a hair early. Head Soccer has no unarmed counter — a kick that used to
// flip a power ball back from 130px away was ours. An unarmed kick into the ball BLOCKS it
// (docs/HS-POWER-SHOTS.md §4: it grinds on the boot and fires back); this only lets the boot's
// reach count as well as the body, so the press need not wait for the ball to be in the torso.
// The counter proper is an ARMED touch (fireUltimateOnContact).
function tryCounter(m, p, fx) {
  earlyBlock(m, p, KIT, fx);
}

// Kicking the OPPONENT instead of the ball: knockback, and a count toward the knockout (see
// tryTackle, kickDamage). It pays NO gauge — Head Soccer's meter fills on the clock alone (chargeGauge).
//
// Resolved on the kick's rising edge, not per-frame, so one press is one tackle.
function tryTackle(m, p, fx) {
  const foe = m.players[1 - p.index];
  // Nothing to tackle: they are already down. Without this each boot's hit-stop would stretch
  // the time a stunned player spends on the floor.
  if (foe.tackleImmune > 0 || foe.stunned > 0) return false;

  // Where the boot IS, which is now always out in front of the attacking side — the same
  // place the swing is drawn and the same place the ball can be struck from. A tackle box on
  // `facing` would be a hit landed by a leg that is not there.
  const kx = p.x + p.side * C.KICK_REACH;
  const ky = p.y - C.BODY_H * 0.5;                 // the kick circle's height (resolveBallPlayers)
  // THE WHOLE LEG, NOT JUST THE TOE. This used to test one circle sitting at the tip of the
  // reach, which is exactly wrong for an opponent standing RIGHT ON TOP of you — closer than
  // the tip, so the circle at the tip missed them entirely and the swing reached past their
  // body to hit the ball behind it. A kick that goes through a player standing an inch away to
  // strike a ball beyond them is the one shape of this bug that actually got reported, so the
  // hit test now runs against the nearest point on the swing itself (body to tip), the way a
  // leg that is actually attached to you would.
  const legX = clamp(foe.x, Math.min(p.x, kx), Math.max(p.x, kx));
  // Their whole silhouette counts: head circle or body box.
  const hitHead = Math.hypot(legX - foe.x, ky - headY(foe)) < C.KICK_R + headR(m, foe);
  const nx = clamp(legX, foe.x - C.BODY_W / 2, foe.x + C.BODY_W / 2);
  const ny = clamp(ky, bodyTop(foe), foe.y);
  const hitBody = Math.hypot(legX - nx, ky - ny) < C.KICK_R;
  if (!hitHead && !hitBody) return false;

  // Which way the boot came from — only used to tell a hit in the back from one in the face.
  const from = Math.sign(foe.x - p.x) || p.facing;

  // A TACKLE IS A TACKLE, ARMED OR NOT: the arm survives it untouched, since the ball is the
  // only thing that spends it (fireUltimateOnContact).
  //
  // AND A TACKLE IS KNOCKBACK, NOTHING ELSE — Head Soccer's rule. The victim is shoved toward
  // their OWN goal (-foe.side), whichever side the boot came from; there is no gauge in it for
  // the tackler and no health to take. It used to push AWAY FROM THE TACKLER, pay a fifth of a
  // gauge and take a quarter of a hidden health bar; all three are gone.
  //
  // The front/back distinction survives on the shove alone: a hit you never saw shoves you
  // TACKLE_PUSH_BACK as far. The HS knockout — stars after enough of these — is kickDamage.
  const dir = -foe.side;
  const behind = foe.facing === from;
  const k = behind ? C.TACKLE_PUSH_BACK : 1;
  // AIRBORNE OR STANDING (HS M4 102–121 s). Kicked on your feet you stay on them: rocked back
  // for KICK_REEL and slid ~40 px (TACKLE_GROUND_PUSH through PLAYER_FRICTION), no lift. Kicked
  // in the air you are carried off, the full shove and lift below — the far launches in the
  // footage (6299, 6345) were both of a CPU already off the ground.
  if (foe.onGround) {
    foe.vx = dir * C.TACKLE_GROUND_PUSH * k;
    foe.shoved = C.KICK_REEL;
  } else {
    foe.vx = dir * C.TACKLE_PUSH * k;
    foe.vy = Math.min(foe.vy, -C.TACKLE_LIFT * k);
    foe.shoved = C.TACKLE_SHOVE;             // the knockback owns the body for a moment
  }
  foe.dashT = 0;
  foe.tackleImmune = C.TACKLE_IMMUNE;

  p.kickT = 0;                                   // the boot is spent on them, not the ball
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_TACKLE);
  m.events.push({ type: 'tackle', by: p.index, on: foe.index, x: kx, y: ky,
                 powered: false, behind, shot: null });
  fx.hit(kx, ky, '#ffd166', 1.6);
  kickDamage(m, foe, p);
  return true;
}

// THE KNOCKOUT, counted in boots (KICK_HURT_EVERY, constants.js). Every connected kick counts;
// every KICK_HURT_EVERY-th HURTS — a `hurt` event (the renderer's red drops) and a tier on the
// bruise — and the KICK_HURTS_TO_KO-th hurt knocks the victim out for KICK_KO_TIME and starts
// the count again, as the wiki says HS does. No clock, no randomness: the same kicks give the
// same knockout on the server and on every client. A player already down is never counted —
// tryTackle refuses them — so the stars cannot be topped up or chained into a second knockout.
function kickDamage(m, foe, by) {
  foe.kicked++;
  if (foe.kicked % C.KICK_HURT_EVERY !== 0) return;
  foe.hurt = Math.min(3, foe.hurt + 1);
  const ko = foe.kicked >= C.KICK_HURT_EVERY * C.KICK_HURTS_TO_KO;
  m.events.push({ type: 'hurt', player: foe.index, by: by.index, level: foe.hurt, ko });
  if (!ko) return;
  foe.kicked = 0;
  if (stun(m, foe, C.KICK_KO_TIME)) m.events.push({ type: 'knockout', player: foe.index, by: by.index, time: C.KICK_KO_TIME });
}

// THE PASSIVE HEAD TOUCH IS A BOUNCE (HS M4, see HEAD_BOUNCE). An impulse along the normal on
// the ball's velocity RELATIVE to the head: what closed at `vn` leaves at HEAD_BOUNCE·vn, on top
// of the head's own velocity. That is the whole of it — no deaden, no nudge, no extra lift: a
// head still rising from its jump is simply a surface moving up, so it returns the ball harder,
// and one falling back returns it softer, the way M4's headers do.
//
// Tangentially the touch is frictionless: M4's contacts keep their sideways speed within the
// noise of the head-velocity estimate (99.71 s: 49 → 57 px/s across the normal), so spin stays
// what it was — decoration, damped a little by the knock.
//
// Returns the closing speed (0 when the ball was already leaving), so the caller can tell a
// touch from a ball resting on the crown.
function bounceOffHead(b, p, nx, ny) {
  const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
  if (vn >= 0) return 0;
  const j = -(1 + C.HEAD_BOUNCE) * vn;
  b.vx += j * nx; b.vy += j * ny;
  b.spin *= 0.6;
  return -vn;
}

function resolveBallPlayers(m, fx, alpha = 1) {
  const b = m.ball;
  for (const p of m.players) {
    // A STUNNED PLAYER IS STILL A BODY. They are out on their feet, not on the floor, so
    // the ball goes on bouncing off them — there is no window here where a player becomes
    // scenery. (There used to be: a knocked-down defender was pass-through, which is how a
    // power shot bought itself an undefended goal.)

    // The pose this sub-step collides against: swept from where the player started the tick
    // to where they finished it. Without it every test runs against the end pose and a
    // running player simply appears on the far side of the ball.
    // A power ball that does not touch this body: its own shooter, anyone while it is pinned in
    // a block, carrying a defender or up in the sky, and whoever it has already gone through.
    if (b.power && skipContact(b, p)) continue;
    const px = p.x0 === undefined ? p.x : p.x0 + (p.x - p.x0) * alpha;
    const py = p.y0 === undefined ? p.y : p.y0 + (p.y - p.y0) * alpha;
    const hy = headYAt(py);

    // ---- kick hitbox (only while the leg is out) ----
    // The boot fires the ultimate too. It used not to (the circle hangs KICK_REACH px out, so
    // a boot touch was called "firing at a distance"), but Head Soccer fires the armed shot on
    // the next touch of ANY kind — kick, header or body (headsoccer.wiki.gg/wiki/Controls; Idan's
    // M3/M4 footage) — and an armed player whose kicks did nothing read as "the power is broken".
    if (p.kickT > 0) {
      const dir = p.kickDir || p.side;              // the aim, as latched at the swing
      // THE SWING (HS M4 29.64 s, frame by frame): the boot is at the height of a ball resting
      // on the grass for the first KICK_LOW_TICKS, then up at KICK_REACH_HI ahead and KICK_HI_Y
      // above the ground — about the middle of the head — for the rest of the swing. A ball
      // at chest or face height in front is the boot's, as it is in HS.
      const low = C.KICK_TIME - p.kickT < C.KICK_LOW_TICKS * C.TICK - 1e-9;
      const kx = px + dir * (low ? C.KICK_REACH : C.KICK_REACH_HI);
      const ky = py - (low ? C.BALL_R : C.KICK_HI_Y);
      if (Math.hypot(b.x - kx, b.y - ky) < C.KICK_R + b.r) {
        // ARMED BEATS INCOMING off the boot too: HS's counter is any touch by an armed player
        // (§4), so a swing that meets their shot fires yours, just as the head and body do.
        if (b.power && b.power.owner !== p.index && p.armed > 0 && fireUltimateOnContact(m, p, b, fx)) { p.kickT = 0; return; }
        if (!b.power) {
          // ARMED: this touch is the one that spends it (see the note above the hitbox).
          if (p.armed > 0 && fireUltimateOnContact(m, p, b, fx)) { p.kickT = 0; return; }
          // The higher up the swing the ball is met, the less of the drive is left and the more
          // it goes up: HS M4's still balls met at head height leave at 391 px/s, 66° up
          // (kick.head.speed / .angle, ball.kickApex.head), against a ground kick's ~480 and
          // ~35°. `high` is 0 for a ball on the grass, 1 for one at head height or above.
          const high = clamp((py - b.y - C.BALL_R) / (py - hy - C.BALL_R), 0, 1);
          const mult = p.stats.kick;
          const drive = 1 - high * (1 - C.KICK_HI_DRIVE);
          // A kick taken in the air goes up more: HS's jumping kick tops out ~340 px (M4 167.9 s,
          // one clean sample), where the same swing off the grass stays under 130.
          const lift = (1 - high * (1 - C.KICK_HI_LIFT)) * (p.onGround ? 1 : C.KICK_AIR_LIFT);
          // THE BOW. A kick used to fly dead flat along your facing, so scoring meant already
          // standing in exactly the right place. It now arcs toward the FAR goal, and by how
          // far away that goal is: from deep it is lofted, from the six-yard box it stays
          // low, because a lofted tap from close in sails over the bar. Aiming the LOFT and
          // not the direction is deliberate — turning the ball toward the goal for you would
          // take the aiming out of the player's hands, and facing is the aiming this game has.
          const goalX = p.side > 0 ? C.W : 0;
          const range = Math.abs(goalX - b.x);
          const towardsGoal = (goalX - b.x) * dir > 0;
          const bow = towardsGoal
            ? Math.max(0, Math.min(1, (range - C.KICK_BOW_MIN) / (C.W - C.KICK_BOW_MIN))) * C.KICK_AIM
            : 0;
          // WHICH PART OF THE BOOT GOT THERE. Until now the kick circle was a switch: touch it
          // anywhere and you got the one shot. The ball's position INSIDE the circle is the
          // whole of the aiming that a kick has, so read it — see KICK_TOE_LOFT for the shape.
          //
          //   along  -1 at the ankle end … +1 at the toe cap
          //   under   how far the boot is beneath the ball's centre. About 0 for a ball rolling
          //           on the grass (the circle sits at that height), positive for one dropping
          //           onto the foot, which is the chip.
          //
          // Normalised by the CONTACT radius, not by KICK_R: the circle the ball is tested
          // against is KICK_R + b.r across, so dividing by KICK_R alone pinned everything in
          // the outer third of the boot to a flat -1 or +1 and threw away the end of the range
          // at both ends.
          const along = clamp(((b.x - kx) * dir) / (C.KICK_R + b.r), -1, 1);
          const toe = (along + 1) / 2;                     // 0 = the whole foot, 1 = the toe cap
          const under = clamp((ky - b.y) / (C.KICK_R + b.r), -1, 1);
          // Measured from where the ball sits on an ORDINARY kick rather than from the middle
          // of the circle — see KICK_TOE_NEUTRAL. A dribbled ball is pinned against the body,
          // which is the ankle end, so a neutral at 0.5 made the everyday running shot a scoop
          // and that is why the ball kept going up instead of at the goal.
          const t = toe - C.KICK_TOE_NEUTRAL;
          let loft = clamp(1 - t * C.KICK_TOE_LOFT + under * C.KICK_UNDER_LOFT,
                           C.KICK_LOFT_MIN, C.KICK_LOFT_MAX);
          // Energy is not created here: the loft a toe-poke gives up comes back as pace, so the
          // flat shot is the hard one and the scoop is the soft one. And the flat one is faster
          // again for a reason that is not in this line at all — BALL_MAX_SPEED is a budget on
          // the whole velocity, and a shot that climbs spends most of it climbing.
          const punch = 1 + t * C.KICK_TOE_DRIVE;

          // MEETING IT. The pace the ball brings INTO the boot comes back out of it: that is
          // the difference between a volley and a tap, and it used to not exist — the strike
          // assigned a velocity and the ball's own was simply discarded. Only what is coming AT
          // the swing counts (a ball running away is caught up with, not struck), and the
          // vertical half rides the LOFT, so a ball dropped onto a toe-poke still goes flat
          // rather than being launched by its own fall.
          const meet = Math.max(0, -b.vx * dir);
          const drop = Math.max(0, b.vy);

          b.vx = dir * (C.KICK_POWER * mult * drive * punch + meet * C.KICK_MEET
                        + drop * C.KICK_DROP_DRIVE) + p.vx * 0.4;
          b.vy = -(C.KICK_LIFT * mult * lift * loft * (1 + C.KICK_BOW * bow)
                   + drop * C.KICK_MEET * loft * C.KICK_DROP_LOFT) + p.vy * 0.3;
          b.spin = dir * 14;
          p.kickT = 0;
          m.hitStop = Math.max(m.hitStop, C.HIT_STOP_KICK);
          m.idle = 0;
          m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, power: false });
          fx.hit(b.x, b.y, '#ffffff', 1);
          return;
        }
      }
    }

    // ---- head (circle) ----
    const dx = b.x - px, dy = b.y - hy;
    const d = Math.hypot(dx, dy);
    const min = headR(m, p) + b.r;
    // BEHEADED: there is no head to meet the ball; it passes where the head was.
    if (d < min && !headless(p)) {
      if (b.power && b.power.owner !== p.index) {
        // ARMED BEATS INCOMING. A touch that would otherwise be a block is instead the trigger
        // for your OWN ultimate when you are already armed for it — their shot is cancelled,
        // not absorbed, and yours goes out from the same spot. See the note above
        // fireUltimateOnContact for why this has to run before hitByPowerShot rather than after.
        if (p.armed > 0 && fireUltimateOnContact(m, p, b, fx)) return;
        hitByPowerShot(m, p, b, fx); return;
      }
      // THE ULTIMATE FIRES HERE. Head-to-ball is a real touch of the silhouette, so an armed
      // player who runs or jumps into the ball spends the arm on it. Checked before the
      // deaden below, or the touch that should have launched a power shot would first be
      // scrubbed into a dead one.
      if (fireUltimateOnContact(m, p, b, fx)) return;
      // A ball sitting exactly ON the head's centre has no direction to be pushed in. Send
      // it back the way it came, or straight up if it is not moving either — anything but
      // the old answer, which was to skip the contact and let it fall through the player.
      let nx, ny;
      if (d > 0.0001) { nx = dx / d; ny = dy / d; }
      else {
        const s = Math.hypot(b.vx, b.vy);
        if (s > 0.0001) { nx = -b.vx / s; ny = -b.vy / s; } else { nx = 0; ny = -1; }
      }
      // Which HEIGHT on the silhouette was struck decides how dead the touch is, and that is
      // the question the raw normal answers. Keep it before the grass may bend the normal.
      const zoneNy = ny;
      // The head's circle reaches 42px from a centre 49px up, so its lower arc dips BELOW the
      // boots: pushing a low ball out along it drives the ball into the pitch, and
      // collideBounds shoves it straight back — a 5px buzz rather than a resolution. Stop at
      // the grass; the torso below is what ejects it sideways, on the fall-through.
      // And stop at the GOAL LINE too, for the same reason: this push-out is 42px long from
      // the head's centre, so a player standing in their own mouth can put the ball down
      // behind the line rather than in front of it. enteredGoal already refuses to score that
      // — it is read before this runs — but refusing is only half an answer: an unscored ball
      // sitting in the net is a match waiting on the idle reset. Measured over 120 bot matches,
      // this is the difference between one such ball (6.9s of nothing) and none.
      const fromX = b.x, fromY = b.y;
      b.x = px + nx * min;
      b.y = hy + ny * min;
      // The grass stops the push (a ball resting on it reaches the jaw): slide it out sideways
      // instead, far enough to clear the circle at the height it is held to.
      if (b.y > C.GROUND_Y - b.r) {
        b.y = C.GROUND_Y - b.r;
        const ddy = b.y - hy;
        b.x = px + (Math.sign(nx) || (fromX >= px ? 1 : -1)) * Math.sqrt(Math.max(0, min * min - ddy * ddy));
      }
      b.x = keepOutOfGoal(fromX, fromY, b.x, b.y, b.r);

      // Chest height and below is a BODY touch. In HS it bounces like everything else on the
      // pitch (Box2D, one restitution; the wiki: "receive the ball with your body, the ball will
      // go up diagonally quickly") — it used to be deadened on request, and Idan chose HS.
      if (zoneNy > C.DEADEN_ZONE) {
        m.idle = 0;
        bounceOffHead(b, p, nx, ny);
        fx.hit(b.x, b.y, '#cfd8ea', 0.4);
      } else if (bounceOffHead(b, p, nx, ny) > C.CONTACT_IMPACT_V) {
        // A real touch, not a ball resting on the crown. Only a touch counts as play for the
        // idle reset, so a ball somehow held on a head nobody moves cannot hold the match.
        m.idle = 0;
        m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, head: true });
        fx.hit(b.x, b.y, '#ffffff', 0.7);
      } else if (nx * nx < 4e-4 && Math.hypot(b.vx - p.vx, b.vy - p.vy) < 20) {
        // Settled DEAD on top of a head — the one point of a round head gravity cannot roll
        // a ball off, and one only a scripted drop ever finds exactly. A float's worth of
        // asymmetry is all a real ball on a real head needs, so it gets that: 4px/s toward the
        // middle of the pitch, and the curve of the head does the rest. (It used to be a
        // 70px/s shove off anything slow on the crown; the bounce made that unnecessary.)
        b.vx += (px < C.W / 2 ? 1 : -1) * 4;
      }
      // NO `continue` HERE. The head's lower arc is narrower than the torso plus the ball —
      // 19.9px of clearance at grass level against the 28px the box wants — so resolving a
      // low contact against the head alone leaves the ball still buried in the chest. The
      // two shapes are one silhouette, and a contact has to come out of BOTH of them.
    }

    // ---- body box ----
    const halfW = C.BODY_W / 2;
    const top = bodyTopAt(py);
    const nearestX = clamp(b.x, px - halfW, px + halfW);
    const nearestY = clamp(b.y, top, py);
    const bx = b.x - nearestX, by = b.y - nearestY;
    const bd = Math.hypot(bx, by);
    let nx, ny, sx, sy;
    if (bd > 0.0001) {
      if (bd >= b.r) continue;                     // no contact with this player
      nx = bx / bd; ny = by / bd; sx = nearestX; sy = nearestY;
    } else {
      // THE BALL'S CENTRE IS INSIDE THE TORSO — the deepest overlap there is, and the one
      // case the old code did nothing about: it needed a non-zero distance to build a normal
      // from, so `bd > 0.0001` silently dropped the contact. That left an unguarded slab
      // about 32px wide and 10px tall at the feet (the head circle reaches 42px from a
      // centre 49px up, so it stops short of the boots) through which a ball simply passed
      // UNDERNEATH the player. Push out along the shallowest face instead — the minimum
      // translation vector, which is what a zero-distance contact actually means.
      //
      // Which way out: for a box the shallower horizontal face is just the side the ball
      // already sits on, but a player who is RUNNING has swept into it, and a ball that
      // leaves behind their heels is a ball that went through them. So a moving player
      // always ejects it the way they are going; only a near-stationary one falls back to
      // the geometric answer.
      const side = Math.abs(p.vx) > 40 ? Math.sign(p.vx) : (Math.sign(b.x - px) || 1);
      const dh = side > 0 ? (px + halfW) - b.x : b.x - (px - halfW);
      // Never eject UP through the torso while the ball is sitting on the grass: standing on
      // a ball does not lift it onto your chest, and the head's lower arc already covers the
      // top of this box anyway (it reaches to within 7px of the boots). And never eject DOWN
      // through the grass, or the ball is left under the pitch and collideBounds puts it
      // straight back inside the torso on the next sub-step — a trap, not a resolution.
      // For a ball at the feet that leaves the way out that is really there: sideways.
      // The down face lands the ball at py + r, so it is only available when THAT clears the
      // grass — otherwise the ball is left sunk in the pitch and shoved back up next
      // sub-step, which is the buzz this whole branch exists to avoid.
      const du = b.y > C.GROUND_Y - b.r - 0.5 ? Infinity : b.y - top;
      const dd = py + b.r > C.GROUND_Y - b.r ? Infinity : py - b.y;
      if (du <= dh && du <= dd) { nx = 0; ny = -1; sx = b.x; sy = top; }
      else if (dd <= dh)        { nx = 0; ny =  1; sx = b.x; sy = py; }
      else                      { nx = side; ny = 0; sx = px + side * halfW; sy = b.y; }
    }
    // A ball caught between the boots and the grass cannot be pushed DOWN — the pitch is
    // there. Send it out of the side of the torso instead. Without this a player landing
    // over the ball drove it up to 18px into the turf, and collideBounds spent the next
    // sub-step shoving it back out.
    if (ny > 0 && sy + ny * b.r > C.GROUND_Y - b.r) {
      const side = Math.abs(p.vx) > 40 ? Math.sign(p.vx) : (Math.sign(b.x - px) || 1);
      nx = side; ny = 0; sx = px + side * halfW; sy = b.y;
    }
    if (b.power && b.power.owner !== p.index) {
      // Same override as the head branch: armed beats incoming, body touch included.
      if (p.armed > 0 && fireUltimateOnContact(m, p, b, fx)) return;
      hitByPowerShot(m, p, b, fx); return;
    }
    // …and the torso is the other half of the silhouette, so it is the other half of the
    // trigger. Barging into the ball while armed fires it exactly as heading it does.
    if (fireUltimateOnContact(m, p, b, fx)) return;
    m.idle = 0;
    // HEAD BOUNCES, BODY DEADENS (Adam, 2026-08-21). Running into the ball used to
    // pinball it away, so most touches were accidents rather than decisions. Now your
    // torso kills it and drops it at your feet, and only a kick sends it anywhere.
    // Clamped at the goal line for the same reason the head is: a defender standing ON their
    // own line has a torso that straddles it, and squeezing the ball out of the back face puts
    // it down behind the line. That was the commonest shape of the reported bug — 526 of the
    // scripted near-goal scenarios in this pass scored off it, from balls that were at rest or
    // moving AWAY from the net — and without the clamp the ball is merely left sitting in a
    // goal it did not score in.
    const fromX = b.x, fromY = b.y;
    b.x = sx + nx * b.r; b.y = sy + ny * b.r;
    b.x = keepOutOfGoal(fromX, fromY, b.x, b.y, b.r);
    bounceOffHead(b, p, nx, ny);                  // the torso bounces it too, as in HS
    fx.hit(b.x, b.y, '#cfd8ea', 0.4);
  }
}

// ---------------------------------------------------------------------------
// THE ULTIMATE GOING OFF. The only place in the sim that does.
//
// Called from the two branches of resolveBallPlayers that represent a genuine touch between
// this player's silhouette and the ball: the head circle and the torso box. Both callers
// have already established the overlap — this function does not measure distance, and that
// is the point. There is no radius here to be widened into "near enough", so the ultimate
// cannot go off from proximity: if the bodies are not overlapping, this is never reached.
//
// EXACTLY ONCE PER ARM. The ball is sub-stepped up to 48 times a tick and this runs inside
// that loop, so the guard has to be state, not timing: `armed` is zeroed on the first line
// of the activation, so every later sub-step of the same tick sees an unarmed player and
// walks straight past. The caller then returns, which ends this player's contact resolution
// for the sub-step as well.
//
// IT DOES NOT TOUCH THE METER. The press already spent it (stepPlayer) and the refill has
// been running since; zeroing it again here would throw away the seconds refilled while
// the player walked to the ball, which HS does not do (M3: the bar climbs straight through
// the cut-in at 71.5 s).
//
// A live ball can already be someone ELSE's power shot when this runs — the two call sites in
// resolveBallPlayers try this before hitByPowerShot whenever the toucher is armed. Converting
// it is fine: it is still a real touch of the silhouette, the same touch that would otherwise
// have blocked it. Only a shot already flying under this
// player's OWN name is off-limits, since there is nothing left there to spend the arm on.
function fireUltimateOnContact(m, p, b, fx) {
  if (p.armed <= 0) return false;
  if (b.power && b.power.owner === p.index) return false;
  if (p.stunned > 0) return false;                   // not a touch you made
  // The free play after a goal does not count: a touch there is an ordinary touch, and the arm
  // waits for the restart.
  if (m.afterGoal > 0) return false;

  // A Multi-Ball's second and third balls are for scoring with, not for firing off.
  if (b.power && b.power.extra) return false;

  const countered = !!b.power;
  p.armed = 0;
  m.idle = 0;
  // Toward the opponent's goal, along this player's FAMILY's path (shared/hs-powers.js launch).
  // A live enemy shot touched while armed is the COUNTER (docs/HS-POWER-SHOTS.md §4): theirs is
  // cancelled and this one goes out from the same spot, with its own cut-in.
  launchPower(m, b, p, KIT, fx, { countered });
  cutIn(m, p);
  return true;
}

// THE CUT-IN: the screen goes dark round the shooter for POWER_CUTIN (1.34s, HS M4) the moment a
// power shot goes off, and for the first 1.14s of it the whole match holds — then the ball leaves
// and play runs under the last POWER_RELEASE (0.2s) of the dark (constants.js: M4 60.17 → 61.27 →
// 61.49 s against the dark's luma trace). The hold rides the hit-stop, which already freezes everything,
// already travels in the snapshot and already watches the buttons for releases; `cutin`/`cutinBy`
// say that this is the shooter's moment, for the renderer's spotlight and so a stun is not run
// down under the hold.
function cutIn(m, p) {
  m.hitStop = Math.max(m.hitStop, C.POWER_CUTIN - C.POWER_RELEASE);
  m.cutin = C.POWER_CUTIN;
  m.cutinBy = p.index;
}

// A power shot reaching an UNARMED defender. What happens is Head Soccer's, as filmed
// (docs/HS-POWER-SHOTS.md §4) — getting in the way is not enough, you have to kick it: standing in
// its path gets you knocked back into your net with the ball; kicking into it blocks it. There is
// no health: a hit costs the half-second daze and the shot's ailment, if it has one.
function hitByPowerShot(m, p, b, fx) {
  // The family decides (shared/hs-powers.js contact): a KICKING defender blocks it — the grind,
  // the dead ball, the shot back (HS M4 61.45 s, 79.55 s); anyone else is knocked back with the
  // ball and dazed (M4 43.33 s), and the shot's ailment lands. Ground rolls through, a Grab
  // carries him, Destructive and Critical smash a block aside.
  powerContact(m, p, b, KIT, fx);
}

// ---------------------------------------------------------------------------
// Awards the goal `enteredGoal` has already established, and returns true so the ball loop
// stops moving. `scorer` came from a CROSSING; this is the last look at the ball before the
// scoreboard moves.
//
// The phase guard is also what stops one entry being counted twice: the first sub-step through
// the mouth leaves the match in 'goal', and every later one — this tick's remaining slices
// included — walks straight past.
function checkGoal(m, fx, scorer) {
  if (m.phase !== 'play' || m.afterGoal > 0) return false;
  const b = m.ball;
  // STILL IN, after the contacts for this sub-step have had their say. The crossing was the
  // ball's; this is the defender's answer to it — a keeper whose push-out pulled the ball back
  // out of his own net has made a save, not conceded. The WHOLE ball has to be in the opening:
  // testing the centre meant a ball sitting half-on-top of the crossbar scored.
  const into = ballInGoal(b.x, b.y, b.r);
  if (!into || (into.left ? 1 : 0) !== scorer) return false;

  m.score[scorer]++;
  m.lastScorer = scorer;
  // (A goal does not lift a cut-in's dark early: M4 150.59 scores at 151.85 s and the dark still
  // runs its 1.35 s to 151.93 s — docs/HS-POWER-SHOTS.md §2.)
  m.events.push({ type: 'goal', player: scorer, power: !!b.power, shot: b.power?.fam || null });
  fx.goal(b.x, b.y, b.power?.color || '#ffffff');
  // A goal ends a Multi-Ball's extra balls. (Not the arm or the meter — those follow the
  // ordinary rules just below.)
  m.xballs.length = 0;

  // The goal itself does nothing to either meter. The conceder's top-up (GAUGE_CONCEDE, HS M4
  // 43.5 s) is paid when the ball drops back in, in step() — not here.

  if (m.golden) {
    m.phase = 'over';
    m.events.push({ type: 'fulltime', winner: scorer, golden: true });
    // Full time is the one reset that really is one: nobody is left glowing on the results
    // screen, and nothing survives into whatever match is started next.
    for (const q of m.players) clearUltimate(m, q);
    return true;
  }
  // No freeze: play runs on for AFTER_GOAL (no more goals count), then step() does the restart.
  m.banner = 'goal'; m.bannerT = C.GOAL_BANNER;
  m.afterGoal = C.AFTER_GOAL;
  m.afterGoalTo = m.players[1 - scorer].side;
  return false;
}

export { resetPositions };

// ---------------------------------------------------------------------------
// Rollback support. serialize() must capture EVERYTHING that can affect a future step —
// including the cooldown timers, the double-tap window and `prev` (the previous frame's
// input, which is how the sim detects edges). Miss `prev` and a held key re-fires the
// instant a client reconciles; miss `tapT` and dash stops working right after a snapshot.
//
// Deliberately lossless: no rounding. `test-net.mjs` asserts a restored sim stays in
// lockstep, and that property is what makes rollback sound. A few extra bytes on the wire
// is a trivial price for it at 1v1 scale.
// Every button whose EDGE the sim reads has to be here: this array is how a restored client
// remembers that a button was already down. Leave POWER out and a reconciling client re-arms
// on every replayed tick — which, before the arm stopped being the whole move, meant a
// reconnect could fire an ultimate nobody pressed for.
const PREV_KEYS = ['left', 'right', 'jump', 'kick', 'power'];
const P_FIELDS = [
  'x', 'y', 'vx', 'vy', 'onGround', 'facing', 'jumps',
  'kickT', 'kickCd', 'dashT', 'dashCd', 'dashDir', 'tapDir', 'tapT',
  // `armed` is the ultimate AND the glow, so a client that restores without it either glows
  // at nothing or misses the touch that should have fired.
  'gauge', 'armed', 'shoved', 'kickDir',
  // Added with the tackle + jump-feel pass. Anything that can change a future step has to
  // travel, or a reconciling client re-runs the last 30 ticks with the wrong state.
  'tackleImmune', 'coyote', 'jumpBuf',
  // The held-jump clock (JUMP_REJUMP): miss it and a restored client re-jumps a tick early or late.
  'landT',
  // `stunned` has to travel: it decides whether input is read at all, and the renderer draws
  // the slump off it. (`hp` sat next to it until the hidden health was removed.)
  'stunned',
  // The ailment (reverse, shock, freeze, beheaded, burn, stars) and its clock: it changes what
  // the controls do, so a client restored without it plays the wrong body.
  'ail', 'ailT',
  // Whose head (or shoulder) holds this body up, -1 for none (resolvePlayers). Rebuilt every
  // tick from the geometry, but the renderer and the bot read it between ticks.
  'stand',
  // The knockout count decides when a future kick knocks out, and the bruise is drawn off
  // `hurt`: a client restored without them would put the stars on the wrong boot.
  'kicked', 'hurt',
];

export function serialize(m) {
  return {
    t: m.t, clock: m.clock, phase: m.phase, freeze: m.freeze,
    // hitStop and idle are READ by restore() and were never written here — a latent desync
    // that only showed up once the head and the header started producing more hit-stops. A
    // client restored mid-hit-stop skipped the freeze the server was still in and ran two
    // ticks ahead of it: the clocks came apart by exactly 2/60s, then everything else did.
    hitStop: m.hitStop, idle: m.idle,
    // The HS restart and cut-in state: every one of these decides what a future tick does
    // (whether the ball exists, whether a stun runs, whether the gauge has started).
    cutin: m.cutin, cutinBy: m.cutinBy, banner: m.banner, bannerT: m.bannerT,
    ballWait: m.ballWait, gaugeLead: m.gaugeLead, afterGoal: m.afterGoal, afterGoalTo: m.afterGoalTo,
    score: [m.score[0], m.score[1]], golden: m.golden, lastScorer: m.lastScorer,
    // Players travel POSITIONALLY, in P_FIELDS order. Field names were 60% of the whole
    // snapshot — an array halves it at no cost in precision, and P_FIELDS is the schema.
    p: m.players.map((p) => {
      const o = P_FIELDS.map((f) => p[f]);
      // `prev` packed as 0/1 flags: this is how the sim detects edges, so it must travel,
      // but it does not need five object keys per player to do it.
      o.push(PREV_KEYS.map((k) => (p.prev && p.prev[k] ? 1 : 0)));
      return o;
    }),
    b: {
      x: m.ball.x, y: m.ball.y, vx: m.ball.vx, vy: m.ball.vy, spin: m.ball.spin,
      // The whole flight state: every field of a power ball is a scalar (hs-powers freshPower).
      pw: m.ball.power ? { ...m.ball.power } : null,
    },
    // A Multi-Ball's extra balls, when there are any.
    xb: m.xballs.map((e) => ({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, spin: e.spin, pw: e.power ? { ...e.power } : null })),
  };
}

// Restores INTO an existing match built with the same two characters — `char`, `shot`,
// `side` and `stats` are match-constant and never travel.
export function restore(m, s) {
  m.t = s.t; m.clock = s.clock; m.phase = s.phase; m.freeze = s.freeze; m.hitStop = s.hitStop || 0; m.idle = s.idle || 0;
  m.score[0] = s.score[0]; m.score[1] = s.score[1];
  m.golden = s.golden; m.lastScorer = s.lastScorer;
  m.cutin = s.cutin || 0; m.cutinBy = s.cutinBy ?? -1; m.banner = s.banner ?? null; m.bannerT = s.bannerT || 0;
  m.ballWait = s.ballWait || 0; m.gaugeLead = s.gaugeLead || 0;
  m.afterGoal = s.afterGoal || 0; m.afterGoalTo = s.afterGoalTo || 0;
  for (let i = 0; i < 2; i++) {
    const p = m.players[i], o = s.p[i];
    P_FIELDS.forEach((f, j) => { p[f] = o[j]; });
    const pv = o[P_FIELDS.length] || [];
    p.prev = {};
    PREV_KEYS.forEach((k, j) => { p.prev[k] = !!pv[j]; });
  }
  const b = m.ball, o = s.b;
  b.x = o.x; b.y = o.y; b.vx = o.vx; b.vy = o.vy; b.spin = o.spin;
  b.power = o.pw ? { ...o.pw } : null;
  m.xballs.length = 0;
  for (const e of s.xb || []) m.xballs.push({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, r: C.BALL_R, spin: e.spin, power: e.pw ? { ...e.pw } : null });
  m.events.length = 0;
  return m;
}
