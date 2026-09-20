// Authoritative head-soccer physics. Pure JS, no DOM, no timers — step() is the whole game.
// The renderer only reads this state; the bot only writes inputs into it. Same split as
// football-mock's shared/sim.js, so wiring this to a server later is a lift-and-shift.

import * as C from './constants.js';
import { launchPowerShot, stepPowerShot, counterPowerShot, shotFor, statsFor, SHOTS } from './powershots.js';
import { walkBounds, barY, barCeiling, goalBox, ballInGoal, keepOutOfGoal } from './goalbox.js';

// A player's geometry, derived (never stored) so nothing can drift out of sync.
// `y` is the FEET line; the body box hangs above it and the head sits on the body.
// Taken from the FEET LINE rather than from the player, so a collision test can ask for the
// geometry at a swept pose — where the player was part-way through the tick — and not only
// at where they ended it. One formula, two callers, nothing to drift apart.
const headYAt = (y) => y - C.BODY_H - C.HEAD_R + 8;
const bodyTopAt = (y) => y - C.BODY_H;
export const headY = (p) => headYAt(p.y);
export const bodyTop = (p) => bodyTopAt(p.y);
// One head size for everybody. It used to be scaled by the big-head pickup and by the dart's
// shrink; both of those systems are gone (see archive/README.md), so this is a constant again
// — but it stays a function of (m, p) because every collision in this file asks through it,
// and that is the seam anything that ever resizes a head should come back through.
export const headR = (m, p) => C.HEAD_R;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Effects are fire-and-forget messages to whatever is drawing. Tests pass NO_FX.
export const NO_FX = { trail() {}, shockwave() {}, grab() {}, hit() {}, goal() {} };

function makePlayer(index, char) {
  const side = index === 0 ? 1 : -1;       // +1 attacks the RIGHT goal
  const st = statsFor(char.rarity);
  return {
    index, side, char,
    shot: shotFor(char.rarity, char.number),
    stats: st,
    x: C.SPAWN_X[index], y: C.GROUND_Y,
    vx: 0, vy: 0,
    onGround: true, facing: side,
    jumps: C.MAX_JUMPS,
    kickT: 0, kickCd: 0, kickLob: false, kickDir: 0,
    dashT: 0, dashCd: 0, dashDir: 0,
    tapDir: 0, tapT: 0,
    // THE ULTIMATE, in two numbers and nothing else.
    //   gauge — the power meter, 0..1, earned off the opponent (see TACKLE_GAUGE).
    //   armed — seconds of ARMED left. > 0 means "glowing, waiting for a touch on the ball".
    // There is deliberately no third field for "pending", "activating" or "charging": every
    // one of those was somewhere a previous match's state could hide. Arming writes `armed`,
    // activating clears it and the gauge in the same statement, and clearUltimate() below
    // zeroes both. See clearUltimate.
    gauge: 0, armed: 0,
    shoved: 0,
    coyote: 0, jumpBuf: 0,          // jump forgiveness (see COYOTE_TIME / JUMP_BUFFER)
    tackleImmune: 0,                // s before the same player can be tackled again
    // CONDITION, in two numbers. `hp` is 1 at full and never shown as a number or a bar —
    // the character's own face is the readout (hurtTier). `stunned` is the one and only way
    // the controls are ever taken off a player, and it only ever happens at hp 0.
    hp: 1, stunned: 0,
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
    idle: 0,                 // seconds since a player last touched the ball
    players: [makePlayer(0, charA), makePlayer(1, charB)],
    ball: { x: C.BALL_SPAWN.x, y: C.BALL_SPAWN.y, vx: 0, vy: 0, r: C.BALL_R, spin: 0, power: null },
    events: [],              // drained by the renderer each frame
  };
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
// So: a goal moves bodies and the ball (resetPositions), and adds to one meter
// (awardConcedeMeter). It does not come through here.
function clearUltimate(m, p) {
  const wasArmed = p.armed > 0;
  p.armed = 0;
  p.gauge = 0;
  if (wasArmed && m) m.events.push({ type: 'ultimateCleared', player: p.index });
  return p;
}
export { clearUltimate };

// ---------------------------------------------------------------------------
// EVERY HIT IN THE GAME COMES THROUGH HERE, and nothing else writes `hp`.
//
// Returns how much was actually taken off, so the caller can put it in its own event without
// re-deriving it. Two rules, and they are the whole of the anti-stun-lock design:
//
//   · a player who is already stunned takes NO damage and cannot be re-stunned. Without this
//     the two hits that land inside one stun would each queue another, and a pair of bots
//     trading boots could hold somebody at 0% for the rest of the match.
//   · hp floors at 0 and the stun is set exactly once, on the transition to 0. It is never
//     topped up, so its length is always HP_STUN_TIME and never a sum of them.
//
// The stun is the ONLY thing in the game that takes a player's controls away. See stepPlayer.
function damage(m, p, amount) {
  if (p.stunned > 0 || amount <= 0) return 0;
  const before = p.hp;
  p.hp = Math.max(0, p.hp - amount);
  const dealt = before - p.hp;
  m.events.push({ type: 'damage', player: p.index, amount: dealt, hp: p.hp });
  if (p.hp <= 0) {
    p.stunned = C.HP_STUN_TIME;
    m.events.push({ type: 'stunned', player: p.index, time: p.stunned });
  }
  return dealt;
}
export { damage };

// THE STUN CLOCK, and it runs on WALL TIME.
//
// Pulled out of stepPlayer because stepPlayer is not the only place it has to tick. step()
// returns early for the length of a hit-stop, before any player is stepped, so a stun that
// spanned a few hit-stops used to run long in real seconds — measured at 1.98s against an
// authored 1.75s, and every hit landed anywhere on the pitch made it longer. The brief asks
// for 1.5-2 seconds, so the countdown has to be independent of how eventful the pause is.
//
// Returns true while the player is still down.
function tickStun(m, p, dt) {
  if (p.stunned <= 0) return false;
  p.stunned -= dt;
  if (p.stunned > 0) return true;
  p.stunned = 0;
  p.hp = C.HP_AFTER_STUN;
  // A MOMENT TO GET UP. Without this, coming back at 40% meant the very next couple of boots
  // — under 1.2s of real time — put you straight back down, which is a stun-lock rather than
  // a knockdown. This does not touch how long the FIRST stun takes (nothing sets it outside a
  // revive), only how long the same player can be chain-stunned afterwards.
  p.tackleImmune = Math.max(p.tackleImmune, C.HP_REVIVE_GRACE);
  m.events.push({ type: 'revive', player: p.index, hp: p.hp });
  return false;
}

// HOW HURT A CHARACTER LOOKS, 0 (untouched) to 4 (bottomed out).
//
// The one place the thresholds are written down, because the renderer and the tests both have
// to agree about them and there is no health bar for either of them to read instead. The
// renderer turns this straight into a class — .head.hurt1..4 in public/style.css — so the
// damage is legible on the CHARACTER and nowhere else on screen.
//
// Deliberately a function of hp ALONE, not of `stunned`: the critical look belongs to being at
// zero, and a player is at zero for exactly as long as they are stunned.
export function hurtTier(hp) {
  if (hp <= 0) return 4;                 // critical
  if (hp <= C.HP_HURT3) return 3;        // red, and bruising blue
  if (hp <= C.HP_HURT2) return 2;        // properly red
  if (hp <= C.HP_HURT1) return 1;        // a flush of red
  return 0;                              // untouched
}

// WHAT A GOAL DOES TO THE METERS. One function, one direction, called once per goal.
//
// The player who CONCEDED gains GAUGE_CONCEDE_BONUS on top of what they already had; the
// player who SCORED is not touched at all. Clamped at a full meter. Nothing here assigns and
// nothing here zeroes — `+=` and a clamp is the entire body, which is the property the whole
// fix rests on.
//
// `scorer` is the index that just scored, so the recipient is `1 - scorer`. Getting that
// inversion backwards turns the comeback mechanic into a runaway one and looks completely
// normal from the outside — the meters still fill, just for the wrong player — so it is
// written once, here, and test-ultimate asserts both directions separately rather than
// assuming one implies the other.
function awardConcedeMeter(m, scorer) {
  const conceded = m.players[1 - scorer];
  conceded.gauge = Math.min(1, conceded.gauge + C.GAUGE_CONCEDE_BONUS);
  return conceded.gauge;
}
export { awardConcedeMeter };

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
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = p.side;
    p.kickT = 0; p.kickCd = 0; p.dashT = 0; p.dashCd = 0;
    p.shoved = 0;
    p.tackleImmune = 0; p.coyote = 0; p.jumpBuf = 0;
    p.jumps = C.MAX_JUMPS;
    // HEALTH CARRIES THROUGH A GOAL — on request: a beating is meant to matter for the whole
    // match, not just until the next restart. Only the STUN clears, because a kickoff nobody
    // can move for is a bug regardless of whose fault the hp is.
    p.stunned = 0;
  }
  const b = m.ball;
  b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y;
  // Kickoff drifts towards whoever just conceded, so the restart isn't a coin flip.
  b.vx = towards ? towards * 90 : 0;
  b.vy = 0; b.spin = 0; b.power = null;
  m.idle = 0;
}

// ---------------------------------------------------------------------------
// step(): one fixed tick. `inputs` is [inputA, inputB], each {left,right,jump,kick,power}.
export function step(m, inputs, dt = C.TICK, fx = NO_FX) {
  m.t += dt;

  if (m.phase === 'over') return m;

  // Hit-stop. A few frozen frames on a heavy connect is most of what makes a hit read as
  // an impact rather than a teleport. Timers still tick so nothing can wedge here.
  if (m.hitStop > 0) {
    m.hitStop -= dt;
    latchReleases(m, inputs);
    // The stun is the one timer that keeps running through a pause. Everything else here is
    // frozen on purpose — that is what hit-stop is — but a player's 1.75 seconds on the floor
    // has to be 1.75 seconds of the match clock, not 1.75 seconds plus however many heavy
    // connects happened to land while they were down. See tickStun.
    for (const p of m.players) tickStun(m, p, dt);
    return m;
  }

  if (m.freeze > 0) {
    m.freeze -= dt;
    if (m.freeze <= 0 && (m.phase === 'kickoff' || m.phase === 'goal')) m.phase = 'play';
    // Frozen: no physics, no clock, but gauges still tick so a restart isn't dead time.
    for (const p of m.players) chargeGauge(m, p, dt);
    latchReleases(m, inputs);
    return m;
  }

  if (m.phase === 'play') {
    m.clock -= dt;
    if (m.clock <= 0) {
      m.clock = 0;
      if (m.score[0] === m.score[1] && C.GOLDEN_GOAL) {
        if (!m.golden) { m.golden = true; m.events.push({ type: 'golden' }); }
      } else {
        m.phase = 'over';
        m.events.push({ type: 'fulltime', winner: m.score[0] > m.score[1] ? 0 : 1 });
        // The whistle clears the ultimate on both players. `over` is a terminal phase that
        // step() returns out of immediately, so an arm left standing here is an arm that sits
        // on the match object for as long as the results screen is up — and this object is
        // what an "again" button is most tempted to reuse.
        for (const p of m.players) clearUltimate(m, p);
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
  separatePlayers(m);
  // SUB-STEP THE BALL when it is moving faster than the things it can hit. The power volley
  // travels 34px in a tick and a head is 30px across, so at one step per frame the ball
  // simply skipped PAST defenders between frames — measured: only one reaction distance in
  // eight could block it, and the ones that failed failed by tunnelling rather than by
  // timing. Splitting the tick into slices no longer than a head keeps "get in the way" a
  // thing the geometry can actually see.
  const speed = Math.hypot(m.ball.vx, m.ball.vy);
  const slices = Math.max(1, Math.min(6, Math.ceil((speed * dt) / (C.HEAD_R * 0.8))));
  for (let i = 0; i < slices; i++) stepBall(m, dt / slices, fx, i / slices, 1 / slices);

  // Backstop for every way a ball can end up somewhere nobody can reach it. Cheap, and it
  // turns a hung match into a restart nobody even notices.
  m.idle += dt;
  if (m.phase === 'play' && m.idle > C.BALL_IDLE_RESET) {
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

// ---------------------------------------------------------------------------
function chargeGauge(m, p, dt) {
  // Sudden death freezes the gauges — the wiki's rule, and it stops overtime becoming
  // a power-shot slugfest where positioning stops mattering.
  if (m.golden) return;
  // The gauge is earned off the OPPONENT now (see TACKLE_GAUGE). GAUGE_PASSIVE is the old
  // clock, kept as a dial and set to zero: a super move that arrives whether or not you
  // played is a thing that happens to a match rather than something a player did.
  if (p.gauge < 1 && C.GAUGE_PASSIVE > 0) p.gauge = Math.min(1, p.gauge + dt * C.GAUGE_PASSIVE);
}

function stepPlayer(m, p, input, dt, fx) {
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

  // BOTTOMED OUT. The only place in the sim that takes a player's controls away, and it is
  // always the same length and always ends: `stunned` counts down in real seconds and the
  // player is handed back at HP_AFTER_STUN, hurt but playable. Nothing can extend it — damage()
  // refuses to touch a player who is already down — so there is no stun-lock to walk into.
  if (p.stunned > 0) {
    tickStun(m, p, dt);
    p.vx *= 0.86;
    integrate(p, dt, 1, C.MAX_JUMPS, headR(m, p));
    p.prev = { ...input };
    return;                             // out on your feet = no input at all
  }

  // …and otherwise you are always mending. Gradual and unconditional: there is no "out of
  // combat" timer to game, so the only way to keep somebody down is to keep hitting them.
  if (p.hp < 1) p.hp = Math.min(1, p.hp + C.HP_REGEN * dt);

  const prev = p.prev || {};
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // ---- dash: two taps of the same direction inside DASH_WINDOW ----
  if (p.tapT > 0) p.tapT -= dt;
  for (const [key, d] of [['left', -1], ['right', 1]]) {
    if (input[key] && !prev[key]) {
      if (p.tapDir === d && p.tapT > 0 && p.dashCd <= 0) {
        p.dashT = C.DASH_TIME; p.dashDir = d; p.dashCd = C.DASH_COOLDOWN;
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
    p.vx = p.dashDir * C.DASH_V * p.stats.speed;
  } else {
    const target = dir * C.PLAYER_SPEED * p.stats.speed;
    const accel = (p.onGround ? C.PLAYER_ACCEL : C.PLAYER_AIR_ACCEL) * dt;
    if (dir !== 0) {
      p.vx += clamp(target - p.vx, -accel, accel);
    } else if (p.onGround && p.shoved <= 0) {
      p.vx *= C.PLAYER_FRICTION;
    }
  }

  // ---- jump ----
  // Two forgiveness windows, because a jump that eats your input feels broken even when
  // it is technically correct: COYOTE lets you jump just after leaving the ground, BUFFER
  // lets a press just before landing fire on touchdown.
  p.coyote = p.onGround ? C.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuf = (input.jump && !prev.jump) ? C.JUMP_BUFFER : Math.max(0, p.jumpBuf - dt);

  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && p.jumps > 0) {
    p.vy = -C.JUMP_V * p.stats.jump;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumps--;
    m.events.push({ type: 'jump', player: p.index });
  }
  if (!input.jump && p.vy < 0) p.vy *= 1 - (1 - C.JUMP_CUT) * dt * 12;   // variable height

  // ---- kick ----
  if (input.kick && !prev.kick && p.kickCd <= 0) {
    // THE HEADER, first. The boot's hitbox is at hip height, so a ball at head height used to
    // mean pressing kick and watching the leg swing under it. Now the same button heads it:
    // less power than a boot, more loft, and the only way to hit a ball your foot cannot
    // reach. Checked before the swing so a header never also starts one.
    if (tryHeader(m, p, fx)) {
      p.kickCd = C.KICK_COOLDOWN;
      p.prev = { ...input };
      return;
    }
    p.kickT = C.KICK_TIME;
    p.kickCd = C.KICK_COOLDOWN;
    // Holding JUMP as you kick lobs it: the only aiming this game has, and the answer to a
    // defender parked on the line. Latched at the swing, not read at contact, so the shot
    // you committed to is the shot you get.
    p.kickLob = !!input.jump;
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
    m.events.push({ type: 'kick', player: p.index, lob: p.kickLob });
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
  // What it does NOT do is as important: it does not touch the gauge, it does not touch the
  // ball, it creates no attraction and fires no shot. The press is a promise; the ball is
  // what collects on it. See fireUltimateOnContact.
  if (input.power && !prev.power && p.gauge >= 1 && p.armed <= 0) {
    p.armed = 1;                       // a flag, not a clock — see the note in constants.js
    m.events.push({ type: 'armed', player: p.index, shot: p.shot.id });
  }

  integrate(p, dt, 1, C.MAX_JUMPS, headR(m, p));
  p.prev = { ...input };
}

// `gm` is the spectacle's gravity multiplier for this player: lighter under a moon phase,
// heavier as a robot. `jumps` is how many the pickups say they get back on landing. Both
// are arguments rather than lookups so integrate() stays a pure function of the player.
function integrate(p, dt, gm = 1, maxJumps = C.MAX_JUMPS, hr = C.HEAD_R) {
  // Falling faster than you rose is what stops a jump reading as floaty.
  p.vy += C.PLAYER_GRAV * gm * (p.vy > 0 ? C.FALL_MULT : 1) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.y >= C.GROUND_Y) {
    p.y = C.GROUND_Y;
    if (p.vy > 0) p.vy = 0;
    if (!p.onGround) p.jumps = maxJumps;
    p.onGround = true;
  } else {
    p.onGround = false;
  }
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

function separatePlayers(m) {
  const [a, b] = m.players;
  const min = C.BODY_W * 0.92;
  const d = b.x - a.x;
  const ad = Math.abs(d);
  if (ad < min && ad > 0.0001) {
    const push = (min - ad) / 2 * Math.sign(d);
    a.x -= push; b.x += push;
    // …and back inside the world. The push happens after both players have already been
    // bounded, so two bodies jammed into the same corner used to be shoved half a body width
    // THROUGH the back of the net. They stay overlapped for a tick instead, which nobody can
    // see, rather than standing behind the goal, which everybody can.
    applyBounds(a, headR(m, a)); applyBounds(b, headR(m, b));
  }
}

// `a0`/`aSpan` are this call's slice of the tick, as a fraction: the swept player pose in
// resolveBallPlayers is read at a0 + aSpan * (progress through the sub-steps).
function stepBall(m, dt, fx, a0 = 0, aSpan = 1) {
  const b = m.ball;

  const powered = stepPowerShot(b, m.players, dt, fx);
  if (!powered) {
    // ONE gravity, and nothing else bends a loose ball. The wind used to add an acceleration
    // here and the magnet another; both are gone (archive/README.md), which is what makes the
    // flight of a kicked ball a thing a player can learn once.
    b.vy += C.BALL_GRAV * dt;
    b.vx *= C.BALL_AIR;
  }
  b.spin *= C.BALL_SPIN_DECAY;

  // Powered balls are exempt: stepPowerShot re-sets their velocity every tick, so there is
  // nothing to run away, and clamping them here silently pinned POWER_SHOT_SPEED to
  // BALL_MAX_SPEED — the power shot's speed knob did nothing for as long as it existed.
  const sp = Math.hypot(b.vx, b.vy);
  if (!powered && sp > C.BALL_MAX_SPEED) { b.vx *= C.BALL_MAX_SPEED / sp; b.vy *= C.BALL_MAX_SPEED / sp; }

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
    collideBounds(m, b, fx);
    // DECIDED BEFORE THE PLAYERS ARE ASKED, and on the ball's own motion. resolveBallPlayers
    // moves the ball — that is what a push-out is — and a ball that is in the net only because
    // a body put it there has not scored. It gets to take a goal AWAY (checkGoal re-tests the
    // final position, so a defender who hooks it back out has still saved it); it does not get
    // to award one.
    const scorer = enteredGoal(fromX, fromY, b);
    resolveBallPlayers(m, fx, a0 + aSpan * ((i + 1) / sub));
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

function collideBounds(m, b, fx) {
  // ground
  if (b.y > C.GROUND_Y - b.r) {
    b.y = C.GROUND_Y - b.r;
    if (b.vy > 0) {
      if (b.power) { b.vy = -Math.abs(b.vy) * 0.45; }
      else {
        b.vy = -b.vy * C.BALL_BOUNCE;
        if (Math.abs(b.vy) < 60) b.vy = 0;
        fx.hit(b.x, b.y, '#ffffff', 0.4);
      }
    }
    b.vx *= C.BALL_GROUND_FRICTION;
  }
  // ceiling
  if (b.y < C.CEIL_Y + b.r) { b.y = C.CEIL_Y + b.r; if (b.vy < 0) b.vy = -b.vy * C.BALL_WALL_BOUNCE; }

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
  bounceOffBar(b, 0, barY, C.GOAL_W, barY, fx);
  bounceOffBar(b, C.W - C.GOAL_W, barY, C.W, barY, fx);
  bounceOffRoofEdge(b, true, fx);
  bounceOffRoofEdge(b, false, fx);
  bounceOffPost(b, C.GOAL_W, barY, fx);
  bounceOffPost(b, C.W - C.GOAL_W, barY, fx);
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
  if (fromAboveOnly && b.vy >= 0) {
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
    b.vx = (b.vx - 2 * dot * nx) * 0.72;
    b.vy = (b.vy - 2 * dot * ny) * 0.72;
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
}

function bounceOffPost(b, px, py, fx) {
  const dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = b.r + C.POST_R;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d;
  b.x = px + nx * min; b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  b.vx = (b.vx - 2 * dot * nx) * 0.78;
  b.vy = (b.vy - 2 * dot * ny) * 0.78;
  fx.hit(px, py, '#ffe08a', 1);
}

// ---------------------------------------------------------------------------
// Counter window: a kick that lands while a live power ball is close enough
// reverses it and transfers ownership.
function tryCounter(m, p, fx) {
  const b = m.ball;
  if (!b.power || b.power.owner === p.index) return;
  const d = Math.hypot(b.x - p.x, b.y - headY(p));
  if (d > C.COUNTER_WINDOW) return;
  counterPowerShot(b, p);
  m.events.push({ type: 'counter', player: p.index });
  fx.shockwave(b.x, b.y, '#ffffff');
}

// Kicking the OPPONENT instead of the ball. Pays gauge and slows them, so pressing has a
// point even when the ball is nowhere near — and it gives a losing player a way to build
// toward a power shot other than waiting out the clock.
//
// Resolved on the kick's rising edge, not per-frame, so one press is one tackle.
// A deliberate header: the ball is at your head and you pressed kick. Distinct from the
// PASSIVE head touch in stepBall, which cushions — see HEAD_POWER. This one is a shot.
function tryHeader(m, p, fx) {
  const b = m.ball;
  if (b.power) return false;                       // a live power shot is not headable
  // ARMED means the next time this player's body reaches the ball the ULTIMATE goes off, and
  // a header that swallowed that contact would quietly eat a full meter. Stand down: the
  // contact is a tick away in resolveBallPlayers, and it is worth more than a header.
  if (p.armed > 0) return false;
  const hy = headY(p);
  const dx = b.x - p.x, dy = b.y - hy;
  const d = Math.hypot(dx, dy);
  if (d > headR(m, p) + b.r + C.HEADER_R) return false;
  const dir = p.side;
  // NO HEADER MAY SEND THE BALL THROUGH YOUR OWN BODY. A header always launches toward `dir`
  // — the goal this player attacks, whatever way they are facing — and re-places the ball out
  // in front of the head on that same side (below). A ball that was BEHIND `dir` when the
  // button was pressed has nowhere to go but through the player to get there, and that is
  // exactly what used to happen: a full-speed cross-body snap that read as the ball
  // teleporting from behind the player to in front of them, every time a header was thrown at
  // a ball that had drifted onto the wrong side. Reported as happening "really fast" at head
  // height, which is this move and no other — the boot below can never reach that far behind a
  // player (KICK_REACH starts past the body) so this was the only door it went through.
  //
  // This used to only fence the ball's HEIGHT (`dy > headR(m, p) && dx * p.facing < 0`), on the
  // theory that a ball inside the head's own circle is always a real touch, direction be
  // damned. It is a real touch — but heading it still has to leave the ball on the side it
  // came in on, not warp it to the other one, so the fence is now on which side the ball is on,
  // not how far down. A header off a ball that is behind `dir` no longer fires here at all; the
  // passive head bounce two branches down still answers the touch, just without the forward
  // launch or the reach-around re-placement.
  if (dx * dir < 0) return false;

  const mult = p.stats.kick;
  // THE SAME COLLISION THE BOOT MAKES, on the other end of the body. A header used to be one
  // number whatever arrived: a ball driven at your face and a ball rolled gently onto your
  // forehead left at identical speed, which is the least physical thing the sim did.
  //
  //   meet  the pace the ball brings INTO the header, returned
  //   drop  a ball falling onto the crown, turned back upward
  //   rise  the jump itself, and this is the timing the move now has. Meet it on the way UP
  //         and the whole rise is behind the contact; at the apex `p.vy` is zero and it is
  //         just a header; on the way down you are heading it into the ground.
  const meet = Math.max(0, -b.vx * dir);
  const drop = Math.max(0, b.vy);
  b.vx = dir * (C.KICK_POWER * C.HEADER_POWER * mult + meet * C.HEAD_MEET) + p.vx * 0.3;
  b.vy = -(C.KICK_LIFT * C.HEADER_LIFT * mult + drop * C.HEAD_MEET) + p.vy * C.HEAD_RISE;
  b.spin = dir * 10;
  // Push the ball clear of the head, the way a block does. Without this the ball is still
  // inside the head circle on the same tick, the PASSIVE head branch in stepBall runs, and it
  // deadens the header it was supposed to be — measured as a 188px/s "shot" instead of 570.
  //
  // It is the biggest re-placement in the sim — the ball can be in front of the head and end
  // up behind it, a hundred pixels away — which is why it is also the one that most needed
  // keepOutOfGoal. Heading at a net you are standing in front of used to put the ball IN the
  // net, through the post, and score it on the spot. Now the snap stops on the line and the
  // shot this function just set is what carries it over.
  const fromX = b.x, fromY = b.y;
  b.x = p.x + dir * (headR(m, p) + b.r + 2);
  b.y = hy - (headR(m, p) + b.r) * 0.35;
  b.x = keepOutOfGoal(fromX, fromY, b.x, b.y, b.r);
  m.idle = 0;
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_KICK);
  m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, power: false, head: true, aimed: true });
  fx.hit(b.x, b.y, '#ffffff', 1);
  return true;
}

function tryTackle(m, p, fx) {
  const foe = m.players[1 - p.index];
  // Nothing to tackle: they are already down. This is the guard that used to read
  // `foe.knocked > 0`, kept pointed at the state that replaced it — without it, booting a
  // stunned player pays the tackler gauge for free and, worse, each boot's hit-stop stretches
  // the time they spend on the floor.
  if (foe.tackleImmune > 0 || foe.stunned > 0) return false;

  // Where the boot IS, which is now always out in front of the attacking side — the same
  // place the swing is drawn and the same place the ball can be struck from. A tackle box on
  // `facing` would be a hit landed by a leg that is not there.
  const kx = p.x + p.side * C.KICK_REACH;
  const ky = p.y - C.BODY_H * 0.45;
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

  const dir = Math.sign(foe.x - p.x) || p.facing;

  // A TACKLE IS A TACKLE, ARMED OR NOT.
  //
  // Booting the opponent while armed used to spend the ultimate on them — signature effect,
  // arm gone, meter gone, no shot. Under "the ultimate activates on contact with the BALL"
  // that is an activation from an unrelated collision, and it is the one that costs you a
  // full meter without ever producing the shot you armed for. So the arm now survives a
  // tackle untouched: you keep glowing, and the ball is still the only thing that spends it.
  // A HIT COSTS CONDITION, NOT CONTROL.
  //
  // This used to set `slow` and `rooted`: the victim went grey, walked at 55% for 1.7s and
  // could not act at all for a fifth of a second — three quarters of a second if it landed
  // from behind. That is the hit the brief calls "grey, slow, stuck", and the trouble with it
  // is that the punishment for being hit was not being allowed to play. Now the boot takes
  // health, which the player can see on their own face and can play around, and the shove is
  // all that happens to their movement.
  //
  // The front/back distinction survives, moved from the lockout to the damage: a hit you
  // never saw hurts half again as much and shoves you less, so walking round behind somebody
  // is still worth doing.
  const behind = foe.facing === dir;
  foe.vx = dir * C.TACKLE_PUSH * (behind ? C.TACKLE_PUSH_BACK : 1);
  foe.vy = Math.min(foe.vy, -C.TACKLE_LIFT * (behind ? C.TACKLE_PUSH_BACK : 1));
  foe.onGround = false;
  foe.dashT = 0;
  p.gauge = Math.min(1, p.gauge + C.TACKLE_GAUGE);
  foe.tackleImmune = C.TACKLE_IMMUNE;
  const dealt = damage(m, foe, C.KICK_DAMAGE * (behind ? C.KICK_DAMAGE_BACK : 1));

  p.kickT = 0;                                   // the boot is spent on them, not the ball
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_TACKLE);
  m.events.push({ type: 'tackle', by: p.index, on: foe.index, x: kx, y: ky,
                 powered: false, behind, shot: null, damage: dealt, hp: foe.hp });
  fx.hit(kx, ky, '#ffd166', 1.6);
  return true;
}

// ONE contact response for every surface a player has. `nx,ny` is the unit normal pointing
// out of the player toward the ball; `keep` is how much of the ball's pace survives the
// touch (HEAD_DEADEN or BODY_DEADEN) and `carry` how much of the player's run it picks up.
// Returns whether this was an IMPACT, so the caller can add the extras that only belong to
// one (a jump's lift, a strike event).
//
// Three rules here are what stop a ball welding itself to a player:
//
// 1. NEVER SINK. Any approach along the normal is cancelled, on every contact, strike or
//    not. This is the only part that runs unconditionally.
//
// 2. THE DEADEN IS A STRIKE, NOT A STATE. Scrubbing the pace only happens when the ball is
//    actually going INTO the player harder than CONTACT_IMPACT_V. The old code re-scrubbed
//    on every tick of an overlap, and `vy *= 0.18` sixty times a second is a brake that
//    beats gravity — so a ball held against a player hung there with its physics apparently
//    switched off. Note this has to be a SPEED cutoff and not merely "is it approaching":
//    on a curved surface, the side of a head, a ball sliding down under gravity is moving
//    into the surface every tick by definition, and it would never get to roll off.
//
// 3. NON-PENETRATION FLOOR. However dead the touch, the ball may not leave it travelling
//    into the player along the normal SLOWER than the player is travelling along it. The
//    old code handed the ball 0.22 of a 310px/s run, so the player closed on it at 227px/s
//    and the contact walked from the front of the torso, through the middle and out the
//    back — the ball "passed through" the player while touching it the whole way. Matching
//    the player's own normal speed is the deadest response that is still physical: zero
//    restitution, nothing bounced, but the surface can never overtake the ball again.
function contactResponse(b, p, nx, ny, keep, carry, spinKeep) {
  const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
  if (vn < 0) { b.vx -= vn * nx; b.vy -= vn * ny; }      // cancel the approach, never reflect
  const impact = vn < -C.CONTACT_IMPACT_V;
  if (impact) {
    b.vx = b.vx * keep + p.vx * carry;
    b.vy *= keep;
    b.spin *= spinKeep;
  }
  const out = b.vx * nx + b.vy * ny;
  const pn = p.vx * nx + p.vy * ny;
  if (out < pn) { const add = pn - out; b.vx += add * nx; b.vy += add * ny; }
  return impact;
}

function resolveBallPlayers(m, fx, alpha = 1) {
  const b = m.ball;
  for (const p of m.players) {
    // A STUNNED PLAYER IS STILL A BODY. They are out on their feet, not on the floor, so
    // the ball goes on bouncing off them — there is no window here where a player becomes
    // scenery. (There used to be: a knocked-down defender was pass-through, which is how a
    // power shot bought itself an undefended goal. Power shots cost health now, not presence.)

    // The pose this sub-step collides against: swept from where the player started the tick
    // to where they finished it. Without it every test runs against the end pose and a
    // running player simply appears on the far side of the ball.
    const px = p.x0 === undefined ? p.x : p.x0 + (p.x - p.x0) * alpha;
    const py = p.y0 === undefined ? p.y : p.y0 + (p.y - p.y0) * alpha;
    const hy = headYAt(py);

    // ---- kick hitbox (only while the leg is out) ----
    // NOTE the boot does NOT fire the ultimate any more. This circle hangs KICK_REACH px out
    // in front of the body, so firing off it is firing at a distance — the ball is struck by
    // a phantom sphere beside the player rather than by the player. The ultimate wants a real
    // touch, so it lives on the head and torso below, where the silhouette actually is.
    if (p.kickT > 0) {
      const dir = p.kickDir || p.side;              // the aim, as latched at the swing
      const kx = px + dir * C.KICK_REACH;
      const ky = py - C.BODY_H * 0.45;
      if (Math.hypot(b.x - kx, b.y - ky) < C.KICK_R + b.r) {
        if (!b.power) {
          const mult = p.stats.kick;
          const drive = p.kickLob ? C.LOB_DRIVE : 1;
          const lift = p.kickLob ? C.LOB_LIFT : 1;
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
          const along = clamp(((b.x - kx) * dir) / C.KICK_R, -1, 1);
          const toe = (along + 1) / 2;                     // 0 = the whole foot, 1 = the toe cap
          const under = clamp((ky - b.y) / (C.KICK_R + b.r), -1, 1);
          let loft = clamp(1 + (0.5 - toe) * C.KICK_TOE_LOFT + under * C.KICK_UNDER_LOFT,
                           C.KICK_LOFT_MIN, C.KICK_LOFT_MAX);
          // THE LOB IS STILL AN AIM, NOT AN ACCIDENT. Holding jump means you got your foot
          // under it on purpose, so a toe-end contact may not flatten the one shot whose whole
          // job is to go over a defender's head.
          if (p.kickLob) loft = Math.max(loft, 1);
          // Energy is not created here: the loft a toe-poke gives up comes back as pace, so the
          // flat shot is the hard one and the scoop is the soft one. And the flat one is faster
          // again for a reason that is not in this line at all — BALL_MAX_SPEED is a budget on
          // the whole velocity, and a shot that climbs spends most of it climbing.
          const punch = 1 + (toe - 0.5) * C.KICK_TOE_DRIVE;

          // MEETING IT. The pace the ball brings INTO the boot comes back out of it: that is
          // the difference between a volley and a tap, and it used to not exist — the strike
          // assigned a velocity and the ball's own was simply discarded. Only what is coming AT
          // the swing counts (a ball running away is caught up with, not struck), and the
          // vertical half rides the LOFT, so a ball dropped onto a toe-poke still goes flat
          // rather than being launched by its own fall.
          const meet = Math.max(0, -b.vx * dir);
          const drop = Math.max(0, b.vy);

          b.vx = dir * (C.KICK_POWER * mult * drive * punch + meet * C.KICK_MEET) + p.vx * 0.4;
          b.vy = -(C.KICK_LIFT * mult * lift * loft * (1 + C.KICK_BOW * bow)
                   + drop * C.KICK_MEET * loft) + p.vy * 0.3;
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
    if (d < min) {
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
      b.y = Math.min(hy + ny * min, C.GROUND_Y - b.r);
      b.x = keepOutOfGoal(fromX, fromY, b.x, b.y, b.r);

      // "Head bounces, body deadens" has to be a rule about HEIGHT, not about which collider
      // you clipped. At real Head Soccer proportions the character is ~80% head, so the torso
      // is a 12px sliver and a box-based rule almost never fired. Contact on the upper part
      // of the silhouette is a header; chest height and below is a body touch and dies.
      if (zoneNy > C.DEADEN_ZONE) {
        m.idle = 0;
        contactResponse(b, p, nx, ny, C.BODY_DEADEN, 0.22, 0.5);
        fx.hit(b.x, b.y, '#cfd8ea', 0.4);
      } else {
        // A HEAD DEADENS, like the chest, only livelier. It used to REFLECT — (1 + HEAD_POWER)
        // times the approach speed, back out — which made a head the hardest surface on the
        // pitch and heading beat playing. Dropping HEAD_POWER twice (1.14 -> 0.80 -> 0.52)
        // made it a weaker trampoline, not a different thing; this makes it a different thing.
        //
        // Cancel the approach, keep a fraction of the pace. The fraction is HEAD_DEADEN
        // against the body's 0.18 — about twice as lively, and still dead. Hitting the ball
        // hard is now always a deliberate act: the boot, or the kick button pressed at head
        // height (tryHeader).
        if (contactResponse(b, p, nx, ny, C.HEAD_DEADEN, 0.30, 0.6)) {
          b.vy += Math.min(0, p.vy) * 0.35;                  // a jump still lifts it a little
        }
        m.idle = 0;
        m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, head: true });
        fx.hit(b.x, b.y, '#ffffff', 0.7);
      }

      // NOTHING COMES TO REST ON A HEAD. Land a ball dead on the crown and it sits at the one
      // point where the contact normal is straight up: gravity has no sideways component to
      // roll it off with, so it balances there for the rest of the match with its physics
      // apparently switched off. Same hang the crossbar had at (939, 215), same answer —
      // anything slow enough to settle gets nudged off toward the middle of the pitch.
      if (ny < -0.94 && Math.hypot(b.vx - p.vx, b.vy - p.vy) < 60) {
        b.vx += (Math.sign(nx) || (px < C.W / 2 ? 1 : -1)) * 70;
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
    contactResponse(b, p, nx, ny, C.BODY_DEADEN, 0.22, 0.5);
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
// AND IT IS THE ONLY PLACE THE METER IS SPENT. Arming does not spend it, lapsing does not
// spend it, tackling does not spend it. A gauge that went down means a power shot exists.
//
// A live ball can already be someone ELSE's power shot when this runs — the two call sites in
// resolveBallPlayers try this before hitByPowerShot whenever the toucher is armed. Converting
// it is fine: it is still a real touch of the silhouette, the same touch that would otherwise
// have cost this player a block's worth of health. Only a shot already flying under this
// player's OWN name is off-limits, since there is nothing left there to spend the arm on.
function fireUltimateOnContact(m, p, b, fx) {
  if (p.armed <= 0) return false;
  if (b.power && b.power.owner === p.index) return false;
  if (p.stunned > 0) return false;                   // not a touch you made

  const countered = !!b.power;
  p.armed = 0;
  p.gauge = 0;
  m.idle = 0;
  // Toward the opponent's goal, which is what `side` is: +1 attacks the right net. Same
  // launch the armed boot always used, so this is the existing ultimate, moved to a new
  // trigger rather than a second implementation of one.
  launchPowerShot(b, p, p.shot, p.side);
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
  m.events.push({ type: 'powershot', player: p.index, shot: p.shot.id, ultimate: true, countered });
  fx.shockwave(b.x, b.y, p.shot.color);
  return true;
}

// A power shot that reaches a defender is BLOCKED, not a battering ram. It used to punch
// straight through and knock them down, which made every power shot an automatic goal and
// left the defender nothing to do. Now getting in the way — usually by jumping into its
// path — actually saves it. The block still costs you: you take the shot on the body, which
// is the heaviest hit in the game, so you save the goal and pay for it.
//
// What you pay is HEALTH. This used to call applyEffect and hand you the shooter's signature
// consequence — burned, rooted, slowed, shoved — which meant the reward for the best defensive
// act in the game was a second of not being allowed to play. POWER_DAMAGE is more than twice a
// boot, so three blocks still bottom a defender out; they just spend that time playing.
function hitByPowerShot(m, p, b, fx) {
  const pw = b.power;
  const shot = pw.shot;
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);

  const dealt = damage(m, p, C.POWER_DAMAGE);

  // The ball comes off the block, back toward the pitch.
  b.vx = -pw.dir * Math.abs(b.vx) * C.POWER_BLOCK_REBOUND;
  b.vy = -Math.abs(b.vy) * 0.4 - 180;
  b.power = null;
  b.x = keepOutOfGoal(b.x, b.y, p.x - pw.dir * (headR(m, p) + b.r + 4), b.y, b.r);
  m.idle = 0;

  m.events.push({ type: 'blocked', player: p.index, by: pw.owner, shot: shot.id,
                 damage: dealt, hp: p.hp });
  fx.shockwave(p.x, headY(p), shot.color);
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
  if (m.phase !== 'play') return false;
  const b = m.ball;
  // STILL IN, after the contacts for this sub-step have had their say. The crossing was the
  // ball's; this is the defender's answer to it — a keeper whose push-out pulled the ball back
  // out of his own net has made a save, not conceded. The WHOLE ball has to be in the opening:
  // testing the centre meant a ball sitting half-on-top of the crossbar scored.
  const into = ballInGoal(b.x, b.y, b.r);
  if (!into || (into.left ? 1 : 0) !== scorer) return false;

  m.score[scorer]++;
  m.lastScorer = scorer;
  m.events.push({ type: 'goal', player: scorer, power: !!b.power, shot: b.power?.id || null });
  fx.goal(b.x, b.y, b.power?.color || '#ffffff');

  // The only thing a goal does to a meter, and it is an addition to the player who conceded.
  // Ahead of the golden-goal branch so the rule reads the same either way.
  awardConcedeMeter(m, scorer);

  if (m.golden) {
    m.phase = 'over';
    m.events.push({ type: 'fulltime', winner: scorer, golden: true });
    // Full time is the one reset that really is one: nobody is left glowing on the results
    // screen, and nothing survives into whatever match is started next.
    for (const q of m.players) clearUltimate(m, q);
    return true;
  }
  m.phase = 'goal';
  m.freeze = C.KICKOFF_FREEZE + 0.9;
  // Bodies and ball only. Both meters and both arms come through this untouched — see the
  // note on resetPositions for why that is the fix and not an oversight.
  resetPositions(m, m.players[1 - scorer].side);
  return true;
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
  'gauge', 'armed', 'shoved', 'kickLob', 'kickDir',
  // Added with the tackle + jump-feel pass. Anything that can change a future step has to
  // travel, or a reconciling client re-runs the last 30 ticks with the wrong state.
  'tackleImmune', 'coyote', 'jumpBuf',
  // CONDITION. `stunned` obviously has to travel — it decides whether input is read at all —
  // and `hp` does too for two separate reasons: it is what the next hit is subtracted from,
  // so a stale one changes whether that hit stuns, and it is the only thing the character's
  // damaged look is derived from. This is the seat the old `effectId`/`effectT` pair sat in,
  // and it is here for the same reason they were: leave a field the PICTURE reads out of this
  // list and every reconcile flickers it back to healthy a few times a second.
  'hp', 'stunned',
];

export function serialize(m) {
  return {
    t: m.t, clock: m.clock, phase: m.phase, freeze: m.freeze,
    // hitStop and idle are READ by restore() and were never written here — a latent desync
    // that only showed up once the head and the header started producing more hit-stops. A
    // client restored mid-hit-stop skipped the freeze the server was still in and ran two
    // ticks ahead of it: the clocks came apart by exactly 2/60s, then everything else did.
    hitStop: m.hitStop, idle: m.idle,
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
      // The shot itself is static data; only its live flight state travels.
      pw: m.ball.power ? {
        id: m.ball.power.id, kind: m.ball.power.kind, owner: m.ball.power.owner,
        dir: m.ball.power.dir, t: m.ball.power.t, life: m.ball.power.life, phase: m.ball.power.phase,
        mult: m.ball.power.mult,
      } : null,
    },
  };
}

// Restores INTO an existing match built with the same two characters — `char`, `shot`,
// `side` and `stats` are match-constant and never travel.
export function restore(m, s) {
  m.t = s.t; m.clock = s.clock; m.phase = s.phase; m.freeze = s.freeze; m.hitStop = s.hitStop || 0; m.idle = s.idle || 0;
  m.score[0] = s.score[0]; m.score[1] = s.score[1];
  m.golden = s.golden; m.lastScorer = s.lastScorer;
  for (let i = 0; i < 2; i++) {
    const p = m.players[i], o = s.p[i];
    P_FIELDS.forEach((f, j) => { p[f] = o[j]; });
    const pv = o[P_FIELDS.length] || [];
    p.prev = {};
    PREV_KEYS.forEach((k, j) => { p.prev[k] = !!pv[j]; });
  }
  const b = m.ball, o = s.b;
  b.x = o.x; b.y = o.y; b.vx = o.vx; b.vy = o.vy; b.spin = o.spin;
  if (!o.pw) b.power = null;
  else b.power = { ...o.pw, shot: SHOTS[o.pw.id], color: SHOTS[o.pw.id].color, glow: SHOTS[o.pw.id].glow };
  m.events.length = 0;
  return m;
}
