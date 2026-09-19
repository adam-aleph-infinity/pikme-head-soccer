// Authoritative head-soccer physics. Pure JS, no DOM, no timers — step() is the whole game.
// The renderer only reads this state; the bot only writes inputs into it. Same split as
// football-mock's shared/sim.js, so wiring this to a server later is a lift-and-shift.

import * as C from './constants.js';
import { launchPowerShot, stepPowerShot, counterPowerShot, applyEffect, shotFor, statsFor, SHOTS } from './powershots.js';
import { createSpectacle, stepSpectacle, packSpectacle, unpackSpectacle,
         spSpeed, spKick, spJump, ballGrav, playerGrav, windAccel } from './spectacle.js';
import { createCards, stepCards, useCard, chargeCards, packCards, unpackCards,
         CARD_KEYS, CARD_SLOTS } from './cards.js';
import { createSkills, stepSkills, wipeSkills, wallUp, spendSuperKick, headScale,
         packSkills, unpackSkills } from './skills.js';
import { createPickups, stepPickups, collectPickups, wipePickups, applyMagnet, spendShield,
         packPickups, unpackPickups, puHeadScale, puJump, puMaxJumps } from './powerups.js';
import { walkBounds, barY, barCeiling } from './goalbox.js';

// A player's geometry, derived (never stored) so nothing can drift out of sync.
// `y` is the FEET line; the body box hangs above it and the head sits on the body.
// Taken from the FEET LINE rather than from the player, so a collision test can ask for the
// geometry at a swept pose — where the player was part-way through the tick — and not only
// at where they ended it. One formula, two callers, nothing to drift apart.
const headYAt = (y) => y - C.BODY_H - C.HEAD_R + 8;
const bodyTopAt = (y) => y - C.BODY_H;
export const headY = (p) => headYAt(p.y);
export const bodyTop = (p) => bodyTopAt(p.y);
// The head's RADIUS is not constant any more: the big-head pickup grows it. It grows around
// the existing centre — headY above is deliberately untouched — so a player who collects one
// gets bigger without moving. Everything that collides with a head goes through this.
export const headR = (m, p) => C.HEAD_R * puHeadScale(m, p.index) * headScale(m, p.index);

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
    gauge: 0, armed: 0, charge: 0,     // `charge` is the power move's wind-up
    knocked: 0, rooted: 0, shoved: 0,
    coyote: 0, jumpBuf: 0,          // jump forgiveness (see COYOTE_TIME / JUMP_BUFFER)
    slow: 0, tackleImmune: 0,       // set by a tackle; slow scales speed, immune blocks re-tackles
    effectId: null, effectT: 0,     // which signature effect is on me, and for how long
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
    // Meteors, moon gravity, wind and robot mode. Every field of it travels in serialize().
    spec: createSpectacle(charA, charB),
    // Collectable power-ups: what is on the pitch and what is running on each player.
    // Every field of it travels in serialize() too.
    pu: createPickups(charA, charB),
    // The hand of three. Dealt from the two cards, so it never travels; only the six
    // cooldown clocks inside it do.
    cards: createCards(charA, charB),
    // Darts, dogs, goal walls, armed super kicks — everything the four special powers put on
    // the pitch. Every field of it travels in serialize() too.
    sk: createSkills(),
    events: [],              // drained by the renderer each frame
  };
  return m;
}

function resetPositions(m, towards) {
  m.idle = 0;
  for (const p of m.players) {
    p.x = C.SPAWN_X[p.index]; p.y = C.GROUND_Y;
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = p.side;
    p.kickT = 0; p.kickCd = 0; p.dashT = 0; p.dashCd = 0;
    p.knocked = 0; p.rooted = 0; p.shoved = 0;
    p.slow = 0; p.tackleImmune = 0; p.coyote = 0; p.jumpBuf = 0;
    p.effectId = null; p.effectT = 0; p.charge = 0;
    p.jumps = C.MAX_JUMPS;
  }
  const b = m.ball;
  b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y;
  // Kickoff drifts towards whoever just conceded, so the restart isn't a coin flip.
  b.vx = towards ? towards * 90 : 0;
  b.vy = 0; b.spin = 0; b.power = null;
  m.idle = 0;
  // Any rock still in the air belongs to the passage of play that just ended. Landing one
  // on a player who has just been teleported back to the spawn spot is the definition of
  // an unavoidable hit, so a goal cancels the shower's pending drops.
  if (m.spec) m.spec.met.length = 0;
  // Same argument for pickups, one step further. A crate sitting at x=700 was equidistant
  // from two players who are no longer there, and every live effect belongs to the passage
  // of play that just ended — so a goal wipes the pitch AND every running power-up.
  wipePickups(m, 'goal');
  wipeSkills(m);
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
    return m;
  }

  if (m.freeze > 0) {
    m.freeze -= dt;
    if (m.freeze <= 0 && (m.phase === 'kickoff' || m.phase === 'goal')) m.phase = 'play';
    // Frozen: no physics, no clock, but gauges still tick so a restart isn't dead time.
    for (const p of m.players) chargeGauge(m, p, dt);
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
        return m;
      }
    }
  }

  // Before the players move, so a blast lands in the same tick it is drawn in. Everything
  // it can change lives in m.spec and travels in serialize().
  stepSpectacle(m, fx);
  // Spawning and the effect clocks run here for the same reason: the spawn decision reads
  // the positions the telegraph will be drawn against. Collection is the other half and has
  // to wait until after the players have moved — see below.
  stepCharge(m, fx);                 // the wind-up owns the ball while it runs
  stepCards(m);
  stepSkills(m, fx);
  stepPickups(m, fx);

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
  // After the move and after separation, so the frame you touch a pickup is the frame you
  // get it, and so a player shoved onto one by the separator still collects it.
  collectPickups(m, fx);
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

  if (p.armed > 0) p.armed = Math.max(0, p.armed - dt);   // `armed` IS power mode
  if (p.kickT > 0) p.kickT -= dt;
  if (p.kickCd > 0) p.kickCd -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.shoved > 0) p.shoved -= dt;
  if (p.rooted > 0) p.rooted -= dt;
  if (p.slow > 0) p.slow -= dt;
  if (p.tackleImmune > 0) p.tackleImmune -= dt;
  if (p.effectT > 0) { p.effectT -= dt; if (p.effectT <= 0) p.effectId = null; }
  if (p.knocked > 0) {
    p.knocked -= dt;
    p.vx *= 0.86;
    integrate(p, dt, playerGrav(m, p.index), puMaxJumps(m, p.index), headR(m, p));
    p.prev = { ...input };
    return;                             // knocked down = no input at all
  }

  const prev = p.prev || {};
  const canAct = p.rooted <= 0;
  const dir = canAct ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;

  // ---- dash: two taps of the same direction inside DASH_WINDOW ----
  if (p.tapT > 0) p.tapT -= dt;
  for (const [key, d] of [['left', -1], ['right', 1]]) {
    if (canAct && input[key] && !prev[key]) {
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
    p.vx = p.dashDir * C.DASH_V * p.stats.speed * spSpeed(m, p.index) * (p.slow > 0 ? C.TACKLE_SLOW : 1);
  } else {
    const target = dir * C.PLAYER_SPEED * p.stats.speed * spSpeed(m, p.index) * (p.slow > 0 ? C.TACKLE_SLOW : 1);
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
  p.jumpBuf = (canAct && input.jump && !prev.jump) ? C.JUMP_BUFFER : Math.max(0, p.jumpBuf - dt);

  if (canAct && p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && p.jumps > 0) {
    // Spring boots multiply the launch AND hand out an extra air jump (see puMaxJumps in
    // integrate). Both end together, and endEffect claws the spare jump back.
    p.vy = -C.JUMP_V * p.stats.jump * spJump(m, p.index) * puJump(m, p.index);
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumps--;
    m.events.push({ type: 'jump', player: p.index });
  }
  if (!input.jump && p.vy < 0) p.vy *= 1 - (1 - C.JUMP_CUT) * dt * 12;   // variable height

  // ---- kick ----
  if (canAct && input.kick && !prev.kick && p.kickCd <= 0) {
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
    // AND THE DIRECTION. The leg is out for a sixth of a second and the ball is often struck
    // several ticks after the press, so reading `facing` at CONTACT meant turning during the
    // swing sent the ball backwards — "sometimes it kicks the other way". Football shipped
    // this exact bug as "shoots wrong direction"; the fix is the same, latch the aim to the
    // fire edge and use the latch for everything the swing does.
    p.kickDir = p.facing;
    m.events.push({ type: 'kick', player: p.index, lob: p.kickLob });
    tryCounter(m, p, fx);
    tryTackle(m, p, fx);
  }

  // ---- POWER MODE ----
  // Its own button and its own job: it does not touch the ball, it changes what your next
  // kick means. Kick the ball -> power shot. Kick the opponent -> your signature effect.
  // THE POWER MOVE. A full gauge buys a WIND-UP, not a mode: half a second in which the ball
  // is drawn up over this player's head and lights up, and then it goes. Pressing it again
  // mid-wind-up does nothing — it is a commitment, and that is what makes it readable by the
  // player who has to jump.
  if (canAct && input.power && !prev.power && p.gauge >= 1 && p.charge <= 0) {
    p.gauge = 0;
    p.charge = C.POWER_CHARGE_TIME;
    m.events.push({ type: 'charging', player: p.index, shot: p.shot.id });
  }

  // ---- THE THREE CARDS ----
  // Rising edge ONLY, and this latch is the whole reason the block exists as its own loop
  // rather than three lines inside the input reader: a card read as LEVEL rather than EDGE
  // fires every tick the button is down, which on a rollback client means the ability
  // machine-guns during every replayed frame. That is the football "shoots the wrong
  // direction" bug wearing a different hat, and test-cards asserts both halves of it —
  // held-does-not-refire, and still-held-after-a-restore-does-not-refire.
  if (C.CARDS_ON) {
    for (let s = 0; s < CARD_SLOTS; s++) {
      const key = CARD_KEYS[s];
      if (canAct && input[key] && !prev[key]) useCard(m, p, s, fx);
    }
  }

  integrate(p, dt, playerGrav(m, p.index), puMaxJumps(m, p.index), headR(m, p));
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

// ---------------------------------------------------------------------------
// THE WIND-UP. For half a second the ball belongs to the player charging: it is swept up over
// their head, held there, and lit up (the renderer reads `charge` for the colour). Then it
// goes, dead flat, at three times a normal power shot and at a height only a jump reaches.
//
// The ball is TAKEN wherever it is, deliberately. Requiring you to be standing on it would
// make the move fail silently half the time — "I pressed power and nothing happened" — and
// the gauge that buys it already costs three tackles.
function stepCharge(m, fx) {
  for (const p of m.players) {
    if (p.charge <= 0) continue;
    const b = m.ball;

    // A WIND-UP CAN BE PUNISHED. Half a second rooted in the open is the price of the move,
    // and reading it should be worth something: a tackle that lands on a charging player
    // cancels the whole thing, and the gauge is already spent. Without this the volley was
    // strictly better the more often you could charge, which inverted the skill ladder —
    // measured over twenty matches, a level-2 bot beat a level-5 bot by charging nine times
    // as often.
    // …but only inside the CANCEL WINDOW. The elapsed time is the charge counting down, so
    // "still in the first second" is charge > total - window.
    const elapsed = C.POWER_CHARGE_TIME - p.charge;
    if ((p.knocked > 0 || p.rooted > 0) && elapsed <= C.POWER_CANCEL_WINDOW) {
      p.charge = 0;
      m.events.push({ type: 'chargeLost', player: p.index });
      continue;
    }

    const wasCharging = p.charge;
    p.charge = Math.max(0, p.charge - C.TICK);

    const top = C.GROUND_Y - C.powerHeight();
    if (p.charge > 0) {
      // Swept up over the head at a rate that gets it there before the wind-up ends, so the
      // shot always leaves from the same place no matter where the ball started.
      const k = Math.min(1, C.TICK / Math.max(C.TICK, p.charge));
      b.x += (p.x - b.x) * k;
      b.y += (top - b.y) * k;
      b.vx = 0; b.vy = 0; b.spin = 0;
      b.power = null;
      // Rooted while winding up: it is a commitment, and a player who can run during it is a
      // player the defender cannot read.
      p.vx = 0;
      continue;
    }

    // ---- FIRE ----
    b.x = p.x + p.side * (C.BODY_W * 0.6);
    b.y = top;
    launchPowerShot(b, p, p.shot, p.side);
    // The multiplier lives ON the shot, because the flight re-drives the ball every tick —
    // setting vx here alone was undone on the very next one.
    b.power.mult = C.POWER_VOLLEY_SPEED;
    b.vx = p.side * C.POWER_SHOT_SPEED * (p.shot.speed || 1) * C.POWER_VOLLEY_SPEED;
    b.vy = 0;
    m.idle = 0;
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
    m.events.push({ type: 'powershot', player: p.index, shot: p.shot.id, volley: true });
    fx.shockwave(b.x, b.y, p.shot.color);
    void wasCharging;
  }
}

// `a0`/`aSpan` are this call's slice of the tick, as a fraction: the swept player pose in
// resolveBallPlayers is read at a0 + aSpan * (progress through the sub-steps).
function stepBall(m, dt, fx, a0 = 0, aSpan = 1) {
  const b = m.ball;

  const powered = stepPowerShot(b, m.players, dt, fx);
  if (!powered) {
    b.vy += C.BALL_GRAV * ballGrav(m) * dt;
    b.vx *= C.BALL_AIR;
    // Wind. Only ever on a LOOSE ball — a power shot flies the same dead-flat line every
    // time on purpose, and bending it would turn "get in the way" back into a guess.
    b.vx += windAccel(m) * dt;
    // The magnet pickup, under exactly the same rule and for exactly the same reason.
    applyMagnet(m, b, dt);
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
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    collideBounds(m, b, fx);
    resolveBallPlayers(m, fx, a0 + aSpan * ((i + 1) / sub));
    if (checkGoal(m, fx)) return;
  }
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

  // crossbars: a full bar over each net, plus the front post it hangs off
  const barY = C.GROUND_Y - C.GOAL_H;
  bounceOffCrossbar(b, 0, C.GOAL_W, barY, fx);
  bounceOffCrossbar(b, C.W - C.GOAL_W, C.W, barY, fx);
  bounceOffPost(b, C.GOAL_W, barY, fx);
  bounceOffPost(b, C.W - C.GOAL_W, barY, fx);
}

// The crossbar is a horizontal BAR across the goal's whole depth, not the single corner
// point it used to be. Without it a ball could drop straight through the roof of the net,
// and "score" meant "the centre got past the line at roughly bar height" — which is what
// made shots that visibly clipped the top of the goal count.
function bounceOffCrossbar(b, x0, x1, barY, fx) {
  const nearestX = clamp(b.x, x0, x1);
  const dx = b.x - nearestX, dy = b.y - barY;
  const d = Math.hypot(dx, dy);
  const min = b.r + C.POST_R;
  if (d >= min) return;
  if (d < 0.0001) { b.y = barY - min; b.vy = -Math.abs(b.vy) * 0.7; return; }
  const nx = dx / d, ny = dy / d;
  b.x = nearestX + nx * min;
  b.y = barY + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx = (b.vx - 2 * dot * nx) * 0.72;
    b.vy = (b.vy - 2 * dot * ny) * 0.72;
  }
  // Nothing may come to REST on the bar. A ball that lands flat on top has no horizontal
  // velocity to roll it off and the bar keeps pushing it back up, so it sits there — which
  // is exactly what happened at (939, 215) and hung a whole match. Anything slow enough to
  // settle gets nudged off toward the pitch.
  if (b.y < barY && Math.hypot(b.vx, b.vy) < 90) {
    const towardPitch = nearestX < C.W / 2 ? 1 : -1;
    b.vx += towardPitch * 70;
  }
  fx.hit(nearestX, barY, '#ffe08a', 1);
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
  // ARMED means the next contact is the power shot, and this game has always fired that off
  // the BOOT only (see the note in stepBall). A header that swallowed the press would eat the
  // shot you spent a full gauge on.
  if (p.armed > 0) return false;
  const hy = headY(p);
  const d = Math.hypot(b.x - p.x, b.y - hy);
  if (d > headR(m, p) + b.r + C.HEADER_R) return false;

  const mult = p.stats.kick * spKick(m, p.index);
  const dir = p.facing;
  b.vx = dir * C.KICK_POWER * C.HEADER_POWER * mult + p.vx * 0.3;
  b.vy = -C.KICK_LIFT * C.HEADER_LIFT * mult + p.vy * 0.3;
  b.spin = dir * 10;
  // Push the ball clear of the head, the way a block does. Without this the ball is still
  // inside the head circle on the same tick, the PASSIVE head branch in stepBall runs, and it
  // deadens the header it was supposed to be — measured as a 188px/s "shot" instead of 570.
  b.x = p.x + dir * (headR(m, p) + b.r + 2);
  b.y = hy - (headR(m, p) + b.r) * 0.35;
  m.idle = 0;
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_KICK);
  m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, power: false, head: true, aimed: true });
  fx.hit(b.x, b.y, '#ffffff', 1);
  return true;
}

function tryTackle(m, p, fx) {
  const foe = m.players[1 - p.index];
  if (foe.tackleImmune > 0 || foe.knocked > 0) return false;

  const kx = p.x + p.facing * C.KICK_REACH;
  const ky = p.y - C.BODY_H * 0.45;
  // Their whole silhouette counts: head circle or body box.
  // Their whole silhouette, at whatever size it currently is: a big-head pickup makes you a
  // bigger thing to head the ball with AND a bigger thing to boot, which is the drawback
  // that keeps it from being a free buff.
  const hitHead = Math.hypot(kx - foe.x, ky - headY(foe)) < C.KICK_R + headR(m, foe);
  const nx = clamp(kx, foe.x - C.BODY_W / 2, foe.x + C.BODY_W / 2);
  const ny = clamp(ky, bodyTop(foe), foe.y);
  const hitBody = Math.hypot(kx - nx, ky - ny) < C.KICK_R;
  if (!hitHead && !hitBody) return false;

  const dir = Math.sign(foe.x - p.x) || p.facing;
  const powered = p.armed > 0;

  if (powered) {
    // Kicking the OPPONENT while powered spends the mode on them instead of the ball and
    // lands your character's signature effect — Adam's "freeze them for half a second".
    // A SHIELD pickup eats it: the item's promise is "blocks one power shot", and a powered
    // boot IS the power shot, just delivered by hand. The mode is still spent either way.
    if (!spendShield(m, foe.index)) applyEffect(p.shot, foe, dir, C.POWER_TACKLE_SCALE);
    p.armed = 0;
  } else {
    // FRONT or BACK, and it is the same button either way — which one you get is decided by
    // where you are standing when you swing. A hit to the chest shoves them off the ball; a
    // hit to the back, the one thing they could not read, stops them dead instead. The freeze
    // deliberately comes with LESS shove: a stun that also slides you across the pitch is
    // just a knockback with extra steps.
    const behind = foe.facing === dir;
    foe.slow = C.TACKLE_SLOW_TIME;
    foe.rooted = Math.max(foe.rooted, behind ? C.TACKLE_STUN_BACK : C.TACKLE_STUN);
    foe.vx = dir * C.TACKLE_PUSH * (behind ? C.TACKLE_PUSH_BACK : 1);
    foe.vy = Math.min(foe.vy, -C.TACKLE_LIFT * (behind ? C.TACKLE_PUSH_BACK : 1));
    foe.onGround = false;
    foe.dashT = 0;
    p.gauge = Math.min(1, p.gauge + C.TACKLE_GAUGE);
  }
  foe.tackleImmune = C.TACKLE_IMMUNE;

  // A landed tackle is the biggest thing you can do to someone without the ball, so it is
  // the biggest payment into your hand — five kicks' worth. This is what makes the cards a
  // reward for going at your opponent rather than a clock you wait out.
  chargeCards(m, p.index, C.CARD_CHARGE_HIT);

  p.kickT = 0;                                   // the boot is spent on them, not the ball
  m.hitStop = Math.max(m.hitStop, powered ? C.HIT_STOP_POWER : C.HIT_STOP_TACKLE);
  m.events.push({ type: 'tackle', by: p.index, on: foe.index, x: kx, y: ky,
                 powered, behind: !powered && foe.facing === dir,
                 shot: powered ? p.shot.id : null });
  fx.hit(kx, ky, powered ? p.shot.color : '#ffd166', powered ? 2.4 : 1.6);
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
    // A knocked-down player is on the floor: nothing collides with them. That IS the payoff
    // of landing a power shot — the goal is briefly undefended.
    if (p.knocked > 0) continue;
    // Rooted (tentacles) still blocks normal play, but never the shot that rooted them —
    // otherwise a trapping shot would trap the defender and then bounce off their face.
    if (b.power && b.power.owner !== p.index && p.rooted > 0) continue;

    // The pose this sub-step collides against: swept from where the player started the tick
    // to where they finished it. Without it every test runs against the end pose and a
    // running player simply appears on the far side of the ball.
    const px = p.x0 === undefined ? p.x : p.x0 + (p.x - p.x0) * alpha;
    const py = p.y0 === undefined ? p.y : p.y0 + (p.y - p.y0) * alpha;
    const hy = headYAt(py);

    // ---- kick hitbox (only while the leg is out) ----
    if (p.kickT > 0) {
      const dir = p.kickDir || p.facing;            // the aim, as latched at the swing
      const kx = px + dir * C.KICK_REACH;
      const ky = py - C.BODY_H * 0.45;
      if (Math.hypot(b.x - kx, b.y - ky) < C.KICK_R + b.r) {
        if (firePowerIfArmed(m, p, b, fx)) return;
        if (!b.power) {
          // An armed SUPER KICK spends itself here, on the ordinary boot: the ball goes twice
          // as far and anyone standing near it goes with it. Same contact, bigger consequence.
          if (spendSuperKick(m, p.index, b, dir)) {
            p.kickT = 0;
            m.idle = 0;
            m.events.push({ type: 'strike', player: p.index, x: b.x, y: b.y, power: true });
            fx.hit(b.x, b.y, '#ff2f00', 3);
            return;
          }
          const mult = p.stats.kick * spKick(m, p.index);
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
          b.vx = dir * C.KICK_POWER * mult * drive + p.vx * 0.4;
          b.vy = -C.KICK_LIFT * mult * lift * (1 + C.KICK_BOW * bow) + p.vy * 0.3;
          b.spin = dir * 14;
          p.kickT = 0;
          m.hitStop = Math.max(m.hitStop, C.HIT_STOP_KICK);
          m.idle = 0;
          // A TOUCH pays into the hand, a swing at air does not. The first version paid for
          // the swing, and a bot that swings on a hair trigger recharged its whole hand
          // three times a match on thin air — 37 card uses a match between two of them,
          // measured, which is not a moment any more, it is weather.
          chargeCards(m, p.index, C.CARD_CHARGE_KICK);
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
      // No firing from the head: the power shot comes off the BOOT only. Firing on any
      // touch is what made the POWER button feel dead — the shot went off on a stray
      // header seconds after you pressed it.
      if (b.power && b.power.owner !== p.index) { hitByPowerShot(m, p, b, fx); return; }
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
      b.x = px + nx * min;
      b.y = Math.min(hy + ny * min, C.GROUND_Y - b.r);

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
    if (b.power && b.power.owner !== p.index) { hitByPowerShot(m, p, b, fx); return; }
    m.idle = 0;
    // HEAD BOUNCES, BODY DEADENS (Adam, 2026-08-21). Running into the ball used to
    // pinball it away, so most touches were accidents rather than decisions. Now your
    // torso kills it and drops it at your feet, and only a kick sends it anywhere.
    b.x = sx + nx * b.r; b.y = sy + ny * b.r;
    contactResponse(b, p, nx, ny, C.BODY_DEADEN, 0.22, 0.5);
    fx.hit(b.x, b.y, '#cfd8ea', 0.4);
  }
}

function firePowerIfArmed(m, p, b, fx) {
  if (p.armed <= 0 || b.power) return false;
  p.armed = 0;
  m.idle = 0;
  launchPowerShot(b, p, p.shot, p.side);
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
  m.events.push({ type: 'powershot', player: p.index, shot: p.shot.id });
  fx.shockwave(b.x, b.y, p.shot.color);
  return true;
}

// A power shot that reaches a defender is BLOCKED, not a battering ram. It used to punch
// straight through and knock them down, which made every power shot an automatic goal and
// left the defender nothing to do. Now getting in the way — usually by jumping into its
// path — actually saves it. The block still costs you: you eat the shooter's signature
// effect, so you save the goal and pay for it.
function hitByPowerShot(m, p, b, fx) {
  const pw = b.power;
  const shot = pw.shot;
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);

  // …unless you are carrying a SHIELD, in which case the block is free this once and the
  // shield is gone. That is the whole item: it does not stop shots, it pays for one.
  if (!spendShield(m, p.index)) applyEffect(shot, p, pw.dir);

  // The ball comes off the block, back toward the pitch.
  b.vx = -pw.dir * Math.abs(b.vx) * C.POWER_BLOCK_REBOUND;
  b.vy = -Math.abs(b.vy) * 0.4 - 180;
  b.power = null;
  b.x = p.x - pw.dir * (headR(m, p) + b.r + 4);
  m.idle = 0;

  m.events.push({ type: 'blocked', player: p.index, by: pw.owner, shot: shot.id, effect: shot.effect.kind });
  fx.shockwave(p.x, headY(p), shot.color);
}

// ---------------------------------------------------------------------------
// Returns true when a goal was scored this sub-step, so the ball loop stops moving.
function checkGoal(m, fx) {
  if (m.phase !== 'play') return false;
  const b = m.ball;
  // The WHOLE ball has to be in the net — past the line AND under the bar. Testing the
  // centre meant a ball sitting half-on-top of the crossbar scored.
  if (b.y - b.r <= C.GROUND_Y - C.GOAL_H) return false;    // any part still above the bar
  let scorer = null;
  if (b.x + b.r < C.GOAL_W) scorer = 1;                    // fully into the LEFT net
  else if (b.x - b.r > C.W - C.GOAL_W) scorer = 0;
  if (scorer === null) return false;

  // A GOAL WALL over that net turns the ball away instead. Checked here rather than in the
  // ball step so there is exactly one place that decides whether a ball in the net is a goal.
  // Whoever is about to concede is the one whose wall could stop it.
  const defender = 1 - scorer;
  if (wallUp(m, defender)) {
    const left = b.x < C.W / 2;
    b.x = left ? C.GOAL_W + b.r + 2 : C.W - C.GOAL_W - b.r - 2;
    b.vx = Math.abs(b.vx) * C.SKILL_WALL_BOUNCE * (left ? 1 : -1);
    b.vy *= 0.7;
    m.events.push({ type: 'wallSave', player: defender, x: b.x, y: b.y });
    fx.shockwave(b.x, b.y, '#9ad0ff');
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_KICK);
    return false;
  }

  m.score[scorer]++;
  m.lastScorer = scorer;
  // A goal restarts the exchange, and the scorer walks back to the spot with their hand
  // part-refilled. The player who conceded gets nothing: this pays for what you DID.
  chargeCards(m, scorer, C.CARD_CHARGE_GOAL);
  m.events.push({ type: 'goal', player: scorer, power: !!b.power, shot: b.power?.id || null });
  fx.goal(b.x, b.y, b.power?.color || '#ffffff');

  const conceded = m.players[1 - scorer];
  conceded.gauge = Math.min(1, conceded.gauge + C.GAUGE_CONCEDE_BONUS);

  if (m.golden) {
    m.phase = 'over';
    m.events.push({ type: 'fulltime', winner: scorer, golden: true });
    return true;
  }
  m.phase = 'goal';
  m.freeze = C.KICKOFF_FREEZE + 0.9;
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
// Every button whose EDGE the sim reads has to be here, cards included: this array is how a
// restored client remembers that a button was already down. Leave a card out and a
// reconciling client re-fires it on every replayed tick.
const PREV_KEYS = ['left', 'right', 'jump', 'kick', 'power', ...CARD_KEYS];
const P_FIELDS = [
  'x', 'y', 'vx', 'vy', 'onGround', 'facing', 'jumps',
  'kickT', 'kickCd', 'dashT', 'dashCd', 'dashDir', 'tapDir', 'tapT',
  'gauge', 'armed', 'charge', 'knocked', 'rooted', 'shoved', 'kickLob', 'kickDir',
  // Added with the tackle + jump-feel pass. Anything that can change a future step has to
  // travel, or a reconciling client re-runs the last 30 ticks with the wrong state.
  'slow', 'tackleImmune', 'coyote', 'jumpBuf',
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
    // The spectacle: meteors in flight, the act clock, robot mode. All integers, trailing
    // zeros trimmed — about a dozen bytes when nothing is happening (see spectacle.js).
    sp: packSpectacle(m.spec),
    // The pickups: what is on the pitch, and the effect clocks on both players. Same
    // packing discipline — all integers, trailing zeros trimmed, about eleven bytes idle.
    // If this were left out, a reconciling client would replay the last 30 ticks with a
    // crate the server never spawned and a big head the server has never seen.
    pk: packPickups(m.pu),
    // Six cooldown clocks. The hands themselves are dealt from the two cards at both ends
    // and never travel.
    cd: packCards(m.cards),
    sk: packSkills(m.sk),
    b: {
      x: m.ball.x, y: m.ball.y, vx: m.ball.vx, vy: m.ball.vy, spin: m.ball.spin,
      // The shot itself is static data; only its live flight state travels.
      pw: m.ball.power ? {
        id: m.ball.power.id, kind: m.ball.power.kind, owner: m.ball.power.owner,
        dir: m.ball.power.dir, t: m.ball.power.t, life: m.ball.power.life, phase: m.ball.power.phase,
        // The volley multiplier drives the ball every tick, so a client without it watches a
        // three-speed shot travel at one.
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
  if (m.spec) unpackSpectacle(m.spec, s.sp || []);
  if (m.pu) unpackPickups(m.pu, s.pk || []);
  if (m.cards) unpackCards(m.cards, s.cd || []);
  if (m.sk) unpackSkills(m.sk, s.sk || []);
  const b = m.ball, o = s.b;
  b.x = o.x; b.y = o.y; b.vx = o.vx; b.vy = o.vy; b.spin = o.spin;
  if (!o.pw) b.power = null;
  else b.power = { ...o.pw, shot: SHOTS[o.pw.id], color: SHOTS[o.pw.id].color, glow: SHOTS[o.pw.id].glow };
  m.events.length = 0;
  return m;
}
