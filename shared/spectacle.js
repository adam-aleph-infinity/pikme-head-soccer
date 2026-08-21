// SPECTACLE — the things that happen TO a match rather than in it.
//
// Adam asked for "in game action like flying meteors, players changing to robots". So the
// pitch itself is now an actor: rocks fall on it, gravity drops away, a wind gets up, and a
// player who is being beaten turns into a machine. Four acts, one at a time, on a schedule
// the sim owns.
//
// Same shape as shared/powershots.js: pure functions over sim state, no DOM, no timers, no
// Math.random. sim.js calls in; everything this module can change about a future step lives
// in `m.spec`, which travels in serialize()/restore().
//
// ── THE ONE RULE ───────────────────────────────────────────────────────────────
// A match may never be decided by something the player could not see coming. Every
// mechanism here obeys it, and each rule below is asserted in test-spectacle.mjs:
//
//   1. TELEGRAPH. A meteor is a marker on the grass for METEOR_WARN seconds BEFORE it is a
//      meteor. The telegraph is long enough that a player standing dead centre of the
//      marker — at the slowest speed the game can put them at, a common card that has just
//      been tackled — can still walk out of the blast. That is a test, not a vibe.
//   2. NEVER HIT WHAT CANNOT MOVE. A meteor is never aimed at a player who is knocked down
//      or rooted, because they cannot answer the telegraph. (Get rooted AFTER the marker
//      appears and you eat it — but that was your opponent's power shot, i.e. earned play,
//      not a dice roll.)
//   3. NEVER SCORE FOR ANYONE. Meteors keep out of both goalmouths, the blast pops the ball
//      UP rather than sideways (METEOR_BALL_POP >> METEOR_BALL_PUSH), and a live power
//      shot is immune — that shot was earned and a rock does not get to eat it.
//   4. NOTHING IN THE CLOSING SECONDS. Every act is over and every pending meteor is
//      cancelled once the clock reaches SPECTACLE_QUIET_END, and nothing fires in sudden
//      death — overtime is decided by football, exactly like the frozen power gauges.
//   5. SYMMETRY OR COMEBACK, NEVER A SNOWBALL. Moon phase and wind hit both players
//      equally (and wind alternates direction, so nobody gets it twice running). Robot mode
//      only ever arms the player who is BEHIND.

import * as C from './constants.js';

// The four acts. 0 is "nothing is happening", which is most of a match.
export const ACT = { NONE: 0, METEOR: 1, MOON: 2, WIND: 3 };
export const ACT_NAME = { 1: 'meteor', 2: 'moon', 3: 'wind' };

// Robot mode is a small state machine per player: idle → windup → live → locked out.
export const RB = { OFF: 0, CHARGE: 1, ON: 2, COOL: 3 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// The spectacle clock counts TICKS, not seconds.
//
// Two reasons, both load-bearing. It keeps every number in `m.spec` an INTEGER, and a
// snapshot is JSON — `0.2878571428571427` is 19 bytes and `17` is 2, on a wire with a
// hard 700-byte budget that test-net.mjs enforces. And integers are exactly representable,
// so a restored client counts down the identical schedule instead of drifting a tick out
// and spawning a meteor the server never spawned.
const ticks = (seconds) => Math.max(1, Math.round(seconds / C.TICK));

// ---------------------------------------------------------------------------
// Randomness, without a random number generator on the state.
//
// The sim is deterministic and rollback replays it, so Math.random is out. A classic PRNG
// would work but its cursor is a full uint32 that has to travel every snapshot. Instead the
// seed is match-CONSTANT (both ends build it from the same two cards, so it never goes on
// the wire) and the state is a small counter. hash(seed, n) is pure, and n stays under a
// hundred for a whole match.
const RARITY_N = { common: 1, rare: 2, epic: 3, legendary: 4 };

export function seedFor(charA, charB) {
  const v = (RARITY_N[charA?.rarity] || 1) * 7919 + (charA?.number || 1) * 131
          + (RARITY_N[charB?.rarity] || 1) * 104729 + (charB?.number || 1) * 31;
  return Math.imul(v ^ 0x5bf03635, 0x9E3779B1) >>> 0;
}

function rnd(sp) {
  sp.n = (sp.n + 1) | 0;
  let x = (sp.seed ^ Math.imul(sp.n, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x / 4294967296;
}

// ---------------------------------------------------------------------------
export function createSpectacle(charA, charB) {
  return {
    seed: seedFor(charA, charB),   // match-constant: derived, never serialised
    n: 0,                          // hash counter — this IS the rng state
    next: ticks(C.SPECTACLE_FIRST),
    kind: ACT.NONE,
    t: 0,                          // ticks left in the current act
    dur: 0,                        // ticks the current act started with (for the renderer)
    dir: 0,                        // wind direction, kept between acts so it can alternate
    drop: 0,                       // ticks to the next meteor of a shower
    prev: ACT.NONE,                // last act, so the same one never runs twice running
    rb: [RB.OFF, 0, RB.OFF, 0],    // per player: [state, ticks]
    met: [],                       // live meteors, flat triples: x, warnTicks, warnTicks0
  };
}

// ---------------------------------------------------------------------------
// Read-side helpers. sim.js multiplies by these; the renderer draws from them. Kept as
// scalar getters rather than an options object so the 60Hz path allocates nothing.
export const robotState = (m, i) => (m.spec ? m.spec.rb[i * 2] : RB.OFF);
export const isRobot = (m, i) => robotState(m, i) === RB.ON;
export const robotCharging = (m, i) => robotState(m, i) === RB.CHARGE;

export const spSpeed = (m, i) => (isRobot(m, i) ? C.ROBOT_SPEED : 1);
export const spKick = (m, i) => (isRobot(m, i) ? C.ROBOT_KICK : 1);
export const spJump = (m, i) => (isRobot(m, i) ? C.ROBOT_JUMP : 1);

export const actKind = (m) => (m.spec ? m.spec.kind : ACT.NONE);
// 0 → 1 across the act, for a renderer that wants to fade something in and out.
export const actFrac = (m) => (m.spec && m.spec.dur > 0 ? 1 - m.spec.t / m.spec.dur : 0);

// Moon phase lightens the BALL much more than the players. A ball that hangs is spectacle;
// a player who hangs is a player who has lost control of their own jump.
export const ballGrav = (m) => (actKind(m) === ACT.MOON ? C.MOON_GRAV_BALL : 1);
export const playerGrav = (m, i) =>
  (actKind(m) === ACT.MOON ? C.MOON_GRAV_PLAYER : 1) * (isRobot(m, i) ? C.ROBOT_GRAV : 1);

// Wind pushes the BALL only. It never touches a player, so it can never take the controls
// off you — it changes what a kick is worth, which is the interesting half anyway.
export const windAccel = (m) => (actKind(m) === ACT.WIND ? m.spec.dir * C.WIND_FORCE : 0);

// The renderer needs world-space meteors, and the packed triples are none of its business.
// `y` is DERIVED from the telegraph clock, so the rock is exactly on the marker at impact
// and the falling animation survives a rollback with no extra state on the wire.
export function activeMeteors(m) {
  const out = [];
  const sp = m.spec;
  if (!sp) return out;
  for (let i = 0; i < sp.met.length; i += 3) {
    const warn = sp.met[i + 1], warn0 = sp.met[i + 2];
    const f = 1 - warn / warn0;                       // 0 at the marker, 1 at impact
    out.push({
      x: sp.met[i],
      // f^1.8, not f^2: the rock has to be visible for most of its warning or the marker is
      // the only tell, and a rock you can watch coming is a better one than a ring alone.
      y: C.CEIL_Y - C.METEOR_FALL + Math.pow(f, 1.8) * (C.GROUND_Y - C.CEIL_Y + C.METEOR_FALL),
      f,
      left: warn * C.TICK,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// step. One tick. Called from sim.step() while the match is in open play.
export function stepSpectacle(m, fx) {
  const sp = m.spec;
  if (!sp) return;

  // The tuner can switch the whole system off mid-match; that has to take effect at once,
  // not whenever the current act happens to expire.
  if (C.SPECTACLE_ON < 0.5) { calm(m, sp, fx); return; }
  if (m.phase !== 'play' || m.freeze > 0) return;

  // FAIRNESS 4. The end of a match belongs to the players. Sudden death sets clock to 0,
  // so this covers overtime too.
  if (m.golden || m.clock <= C.SPECTACLE_QUIET_END) { calm(m, sp, fx); return; }

  stepRobots(m, sp);
  stepAct(m, sp, fx);
  stepMeteors(m, sp, fx);
}

// Wind everything down and cancel anything pending. Used by the quiet window, by sudden
// death, and by the off switch.
function calm(m, sp, fx) {
  if (sp.kind !== ACT.NONE) {
    m.events.push({ type: ACT_NAME[sp.kind] + 'End' });
    sp.prev = sp.kind;
    sp.kind = ACT.NONE;
    sp.t = 0; sp.dur = 0; sp.drop = 0;
    sp.next = ticks(C.SPECTACLE_GAP);
  }
  if (sp.met.length) sp.met.length = 0;
  for (let i = 0; i < 2; i++) {
    if (sp.rb[i * 2] === RB.CHARGE) { sp.rb[i * 2] = RB.OFF; sp.rb[i * 2 + 1] = 0; }
    else if (sp.rb[i * 2] === RB.ON) {
      sp.rb[i * 2] = RB.COOL; sp.rb[i * 2 + 1] = ticks(C.ROBOT_COOLDOWN);
      m.events.push({ type: 'robotOff', player: i });
    }
  }
}

// ---------------------------------------------------------------------------
// The act scheduler. One act at a time with a gap between, because constant chaos stops
// being an event and starts being the weather.
function stepAct(m, sp, fx) {
  if (sp.kind !== ACT.NONE) {
    sp.t--;
    if (sp.kind === ACT.METEOR) {
      if (sp.drop > 0) sp.drop--;
      // Stop dropping early enough that the last rock still lands inside the shower — a
      // meteor whose telegraph outlives its own act would land during quiet play.
      if (sp.drop <= 0 && sp.t > ticks(C.METEOR_WARN)) {
        if (spawnMeteor(m, sp, fx)) sp.drop = ticks(C.METEOR_INTERVAL);
        else sp.drop = ticks(C.METEOR_INTERVAL * 0.5);   // nowhere safe — try again shortly
      }
    }
    if (sp.t <= 0) {
      m.events.push({ type: ACT_NAME[sp.kind] + 'End' });
      sp.prev = sp.kind;
      sp.kind = ACT.NONE;
      sp.dur = 0; sp.drop = 0;
      sp.next = ticks(C.SPECTACLE_GAP);
    }
    return;
  }

  if (sp.next > 0) { sp.next--; return; }

  // Never the same act twice running: a 60s match fits three or four of these, and two
  // meteor showers in a row is the difference between "a thing happened" and "this game
  // has meteors in it".
  const pool = [ACT.METEOR, ACT.MOON, ACT.WIND].filter((k) => k !== sp.prev);
  // The meteor shower is the headline act, so it gets a second ticket in the hat.
  if (sp.prev !== ACT.METEOR) pool.push(ACT.METEOR);
  const kind = pool[Math.min(pool.length - 1, Math.floor(rnd(sp) * pool.length))];

  sp.kind = kind;
  if (kind === ACT.METEOR) {
    sp.dur = ticks(C.METEOR_SHOWER_TIME);
    sp.drop = ticks(C.METEOR_INTERVAL * 0.35);      // first rock lands early, not instantly
  } else if (kind === ACT.MOON) {
    sp.dur = ticks(C.MOON_TIME);
  } else {
    sp.dur = ticks(C.WIND_TIME);
    // FAIRNESS 5. Wind blows the other way each time, so over a match it is even money.
    // The very first one picks a side from the seed.
    sp.dir = sp.dir === 0 ? (rnd(sp) < 0.5 ? -1 : 1) : -sp.dir;
  }
  sp.t = sp.dur;
  m.events.push({ type: ACT_NAME[kind] + 'Start', dur: sp.dur * C.TICK, dir: sp.dir });
}

// ---------------------------------------------------------------------------
// Meteors.
function spawnMeteor(m, sp, fx) {
  // Rocks chase the ACTION. One that always lands in a random corner is scenery; one that
  // lands near the ball forces a decision, which is the whole point of an event.
  const x = safeX(m, m.ball.x + (rnd(sp) * 2 - 1) * C.METEOR_SPREAD);
  if (x === null) return false;

  const warn = ticks(C.METEOR_WARN);
  sp.met.push(Math.round(x), warn, warn);
  m.events.push({ type: 'meteorWarn', x: Math.round(x), warn: warn * C.TICK });
  return true;
}

// Where a meteor is ALLOWED to land. Two hard exclusions:
//   • FAIRNESS 3 — a band in front of each goal, so a blast can never be point-blank on the
//     line and can never bundle a ball over it.
//   • FAIRNESS 2 — anywhere a player who cannot move would be caught by it. A telegraph is
//     only fair to someone able to act on it.
// Returns null when the pitch genuinely has nowhere left, and the drop is skipped.
function safeX(m, want) {
  const lo = C.GOAL_W + C.METEOR_KEEPOUT;
  const hi = C.W - C.GOAL_W - C.METEOR_KEEPOUT;
  if (hi <= lo) return null;
  let x = clamp(want, lo, hi);

  const need = C.METEOR_R + C.BODY_W;
  // Two passes: shoving clear of one pinned player can walk into the other.
  for (let pass = 0; pass < 2; pass++) {
    for (const p of m.players) {
      if (p.knocked <= 0 && p.rooted <= 0) continue;
      if (Math.abs(x - p.x) >= need) continue;
      const a = p.x - need, b = p.x + need;
      const ca = a >= lo ? a : null;
      const cb = b <= hi ? b : null;
      if (ca === null && cb === null) return null;
      if (ca === null) x = cb;
      else if (cb === null) x = ca;
      else x = Math.abs(x - ca) <= Math.abs(x - cb) ? ca : cb;
    }
  }
  for (const p of m.players) {
    if ((p.knocked > 0 || p.rooted > 0) && Math.abs(x - p.x) < need) return null;
  }
  return x;
}

function stepMeteors(m, sp, fx) {
  const met = sp.met;
  for (let i = met.length - 3; i >= 0; i -= 3) {
    if (--met[i + 1] > 0) continue;
    const x = met[i];
    met.splice(i, 3);
    detonate(m, x, fx);
  }
}

function detonate(m, x, fx) {
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_METEOR);
  m.events.push({ type: 'meteorHit', x });
  fx.shockwave(x, C.GROUND_Y, '#ff8a3c');
  fx.hit(x, C.GROUND_Y, '#ffd166', 3);

  for (const p of m.players) {
    const d = Math.abs(p.x - x);
    if (d > C.METEOR_R) continue;
    if (p.knocked > 0) continue;                       // no chaining a player on the floor
    const fall = 0.5 + 0.5 * (1 - d / C.METEOR_R);     // a graze costs less than a direct hit
    const dir = Math.sign(p.x - x) || (x < C.W / 2 ? 1 : -1);
    p.vx = dir * C.METEOR_PUSH * fall;
    p.vy = Math.min(p.vy, -C.METEOR_LIFT * fall);
    p.onGround = false;
    p.dashT = 0;
    // A short knockdown, not a stun. You saw it coming and stood there; you lose a beat.
    p.knocked = Math.max(p.knocked, C.METEOR_KNOCK);
    m.events.push({ type: 'meteorKnock', player: p.index, x });
  }

  const b = m.ball;
  // FAIRNESS 3. A live power shot is untouchable — the gauge took 28 seconds to fill and a
  // falling rock does not get to delete it.
  if (b.power) return;
  if (Math.abs(b.x - x) > C.METEOR_BALL_R) return;
  // The sideways component always shoves the ball toward the CENTRE of the pitch, never
  // "away from the impact". That is a fairness rule, not physics: the honest version blew a
  // ball that was sitting in the goalmouth the last hundred pixels over the line, and
  // test-spectacle caught it doing exactly that twice in eighty tries. Since the blast is
  // ~4x more vertical than horizontal, nobody reads the difference — and the keep-out band
  // means a rock is always further from the goal than a ball it can reach, so "toward the
  // centre" and "away from the crater" only ever disagree deep in open play.
  const dir = b.x < C.W / 2 ? 1 : -1;
  // Overwhelmingly UP. The blast has to be spectacular without ever being a shot on goal,
  // and test-spectacle asserts POP is more than twice PUSH for exactly that reason.
  b.vy = -C.METEOR_BALL_POP;
  b.vx = b.vx * 0.3 + dir * C.METEOR_BALL_PUSH;
  b.spin = dir * 30;
  m.idle = 0;
  m.events.push({ type: 'meteorBall', x: b.x, y: b.y });
  fx.shockwave(b.x, b.y, '#ffffff');
}

// ---------------------------------------------------------------------------
// ROBOT MODE.
//
// WHY THE TRIGGER IS "TWO GOALS BEHIND", and not a pickup, a streak or a timer:
//
//   • It can never snowball. A pickup or a streak hands the extra power to whoever is
//     already on top, which is the one thing an arcade 1v1 must not do — the loser stops
//     playing. This arms only the player who is LOSING, so the spectacle is also the
//     comeback mechanic, and a 5-0 stays watchable.
//   • It is on screen already. The scoreline is the biggest thing in the HUD, so both
//     players can see it coming: go two up and you KNOW you are about to be chased by a
//     machine. A pickup that spawns at a random moment is exactly the "could not see it
//     coming" this whole file is written against.
//   • It is self-limiting. Score twice and the deficit closes, so it does not re-arm. The
//     mode ends on its own clock regardless, then locks out for ROBOT_COOLDOWN.
//   • Only one player can ever qualify — being two behind and two ahead at once is not a
//     thing — so there is never a robot derby.
//
// And it is a TRADE, not a buff: faster and a much harder boot, but heavier (ROBOT_GRAV)
// with a weaker jump, so a robot is worse in the air. It wins races and loses headers.
function stepRobots(m, sp) {
  for (let i = 0; i < 2; i++) {
    const s = sp.rb[i * 2];
    let t = sp.rb[i * 2 + 1];

    if (s === RB.CHARGE) {
      if (--t <= 0) {
        sp.rb[i * 2] = RB.ON;
        sp.rb[i * 2 + 1] = ticks(C.ROBOT_TIME);
        m.events.push({ type: 'robotOn', player: i, time: C.ROBOT_TIME });
      } else sp.rb[i * 2 + 1] = t;
      continue;
    }
    if (s === RB.ON) {
      if (--t <= 0) {
        sp.rb[i * 2] = RB.COOL;
        sp.rb[i * 2 + 1] = ticks(C.ROBOT_COOLDOWN);
        m.events.push({ type: 'robotOff', player: i });
      } else sp.rb[i * 2 + 1] = t;
      continue;
    }
    if (s === RB.COOL) {
      if (--t <= 0) { sp.rb[i * 2] = RB.OFF; sp.rb[i * 2 + 1] = 0; }
      else sp.rb[i * 2 + 1] = t;
      continue;
    }

    // OFF: the only place the trigger is read.
    if (m.score[1 - i] - m.score[i] >= C.ROBOT_DEFICIT) {
      sp.rb[i * 2] = RB.CHARGE;
      sp.rb[i * 2 + 1] = ticks(C.ROBOT_WARN);
      // The windup is the telegraph: the transformation is announced, then it happens.
      m.events.push({ type: 'robotCharge', player: i, warn: C.ROBOT_WARN });
    }
  }
}

// ---------------------------------------------------------------------------
// Wire format. Everything here is an integer on purpose (see `ticks` above), packed into
// one flat array with the trailing zeros trimmed — an idle spectacle costs about twelve
// bytes of the 700-byte snapshot budget, and a live meteor shower about seventy.
//
// `seed` is deliberately absent: it is derived from the two cards, which are match-constant
// and already known at both ends. Anything else that can affect a future step IS here.
const HEAD = 12;   // n, next, kind, t, dur, dir, drop, prev, rb0, rbt0, rb1, rbt1

export function packSpectacle(sp) {
  const a = [sp.n, sp.next, sp.kind, sp.t, sp.dur, sp.dir, sp.drop, sp.prev,
             sp.rb[0], sp.rb[1], sp.rb[2], sp.rb[3], ...sp.met];
  let end = a.length;
  while (end > 1 && a[end - 1] === 0) end--;    // meteor triples always end on warn0 > 0
  return end === a.length ? a : a.slice(0, end);
}

export function unpackSpectacle(sp, a) {
  const v = (i) => (i < a.length ? a[i] : 0);
  sp.n = v(0); sp.next = v(1); sp.kind = v(2); sp.t = v(3); sp.dur = v(4);
  sp.dir = v(5); sp.drop = v(6); sp.prev = v(7);
  sp.rb[0] = v(8); sp.rb[1] = v(9); sp.rb[2] = v(10); sp.rb[3] = v(11);
  sp.met.length = 0;
  for (let i = HEAD; i + 2 < a.length; i += 3) sp.met.push(a[i], a[i + 1], a[i + 2]);
  return sp;
}
