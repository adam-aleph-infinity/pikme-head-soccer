// POWER-UPS — things you go and COLLECT.
//
// Adam asked for "power ups". The gauge is not that: it fills on its own, on a clock, for
// both of you, and there is nothing to go and get. This is the other thing — an object
// appears on the pitch, both of you can see it, one of you gets there first, and for a few
// seconds you can do something you could not do before.
//
// Same shape as shared/spectacle.js and shared/powershots.js: pure functions over sim
// state, no DOM, no timers, no Math.random. sim.js calls in; everything this module can
// change about a future step lives in `m.pu`, which travels in serialize()/restore().
//
// ── THE ONE RULE, AGAIN ────────────────────────────────────────────────────────
// spectacle.js says a match may never be decided by something the player could not see
// coming. A pickup adds a second clause: it may never be decided by something only ONE
// player could go and get. Each rule below is asserted in test-powerups.mjs:
//
//   1. EQUAL AT THE MOMENT IT IS ANNOUNCED. A pickup spawns at the exact MIDPOINT between
//      the two players, so the distance either of them has to run is identical to the
//      pixel. Not "roughly central", not "alternating sides" — literally equidistant, and
//      the test measures both distances and subtracts them. If the midpoint falls outside
//      the legal band (both players parked in the same corner) the spawn is POSTPONED
//      rather than clamped, because a clamped midpoint is a gift to whoever is nearer.
//   2. NEVER START A RACE ONE RUNNER CANNOT RUN. Nothing is announced while either player
//      is knocked down, rooted or slowed. Same reasoning as "a meteor is never aimed at
//      someone who cannot move": a fair contest needs two people able to enter it.
//   3. TELEGRAPHED, THEN LIVE. A pickup is a ghost with a closing ring on it for
//      PICKUP_WARN seconds before it can be collected. You see it, then you race for it.
//   4. SYMMETRY, NOT COMEBACK — AND NEVER A SNOWBALL. Read the long note in spectacle.js
//      about why robot mode triggers on being BEHIND. That argument applies here and it is
//      the reason this system is built the way it is:
//        • Robot mode can afford to be a big swing because only the LOSER can ever arm it.
//          A pickup cannot copy that trick, because the winner of the race is not decided
//          until after the thing has spawned — so the safety has to be in what the item
//          IS, not in who gets it.
//        • So every pickup is a SELF buff on a short clock. Nothing here removes the
//          other player's controls, and nothing here scores for you: the magnet cannot
//          push a ball past its own holder, the big head is also a bigger thing to tackle,
//          the charge only buys you a power shot that is still blockable.
//        • The single exception — ICE, which slows the other player — is removed from the
//          pool entirely whenever anyone leads by PICKUP_MERCY_LEAD. The one item that
//          takes something from you can only ever appear while the match is still close.
//        • One at a time, PICKUP_GAP apart, so the total amount of power on the pitch is
//          bounded no matter who keeps winning the races.
//   5. EVERYTHING ENDS. Every effect is a tick counter that runs to zero and fires a
//      `puEnd`. A goal wipes the pitch AND every live effect. Nothing spawns inside
//      PICKUP_QUIET_END of full time, nothing spawns in sudden death, and the constants
//      are checked against each other so that a pickup taken at the last legal instant has
//      expired before the whistle.

import * as C from './constants.js';
import { SK } from './skills.js';

// The six. Numbered because the wire is integers.
// 1..6 are the originals — buffs on a timer, on every rarity. 7..10 are the SPECIALS: they
// put something on the pitch (a dart, a wall, a dog) and only epic and legendary cards carry
// them. Their rules live in shared/skills.js.
export const PU = { NONE: 0, GROW: 1, MAGNET: 2, CHARGE: 3, SHIELD: 4, SPRING: 5, ICE: 6,
                    DART: 7, GOALWALL: 8, SUPERKICK: 9, DOG: 10 };
export const PU_KINDS = [PU.GROW, PU.MAGNET, PU.CHARGE, PU.SHIELD, PU.SPRING, PU.ICE];
export const PU_SPECIALS = [PU.DART, PU.GOALWALL, PU.SUPERKICK, PU.DOG];
export const PU_NAME = { 1: 'grow', 2: 'magnet', 3: 'charge', 4: 'shield', 5: 'spring', 6: 'ice',
                         7: 'dart', 8: 'goalwall', 9: 'superkick', 10: 'dog' };

// One flat colour each, so an item is recognisable before you have read its glyph. The
// renderer, the particles and the banner all pull from here — a pickup's identity is one
// colour + one silhouette in exactly one place.
// Six hues, deliberately far apart, and every one dark enough that a WHITE glyph pops off
// it. The first pass had shield on light blue and ice on near-white: the two read as the
// same item at a glance, and the white snowflake on pale ice all but vanished. Shield moved
// to the violet the `strike` power shot already uses, ice to a mid cyan.
export const PU_COLOR = {
  1: '#5ce15c',   // grow   — green
  2: '#e01e4f',   // magnet — red
  3: '#ffc400',   // charge — gold
  4: '#7b5cff',   // shield — violet
  5: '#ff8a1e',   // spring — orange
  6: '#2ec4e8',   // ice    — cyan
  7: '#ff4d6d',   // dart      — hot pink, the only projectile you own
  8: '#9ad0ff',   // goal wall — ice blue, it reads as a barrier
  9: '#ff2f00',   // super kick— furnace red
  10: '#c98b3a',  // dog       — a dog colour, and nothing else here is brown
};
export const PU_LABEL = {
  1: 'ראש ענק', 2: 'מגנט', 3: 'טעינה', 4: 'מגן', 5: 'קפיצי', 6: 'קרח',
  7: 'חץ מכווץ', 8: 'חומת שער', 9: 'בעיטת על', 10: 'כלב!',
};

// Four of the six leave a timer on a player. CHARGE is instant (it just fills the gauge)
// and ICE writes into the player's existing `slow`, which already travels in the snapshot —
// so neither of them costs a byte on the wire.
const EFF_N = 4;
const SLOT = { 1: 0, 2: 1, 4: 2, 5: 3 };            // kind -> slot
const SLOT_KIND = [PU.GROW, PU.MAGNET, PU.SHIELD, PU.SPRING];
// Read at CALL time, never captured: PACE rewrites these at import and on every change.
const SLOT_TIME = [
  () => C.PU_GROW_TIME, () => C.PU_MAGNET_TIME, () => C.PU_SHIELD_TIME, () => C.PU_SPRING_TIME,
];

// Ticks, not seconds — the same argument spectacle.js makes: every number in `m.pu` stays
// an INTEGER, which keeps the snapshot short and keeps a restored client counting down the
// identical schedule instead of drifting a tick out.
const ticks = (seconds) => Math.max(1, Math.round(seconds / C.TICK));

// The head grows around its EXISTING centre, so `headY` never moves and a big head does not
// teleport. Duplicated from sim.js rather than imported, to keep this module a leaf that
// sim.js can import without a cycle; test-powerups asserts the two agree.
const headMid = (p) => p.y - C.BODY_H - C.HEAD_R + 8;

// ---------------------------------------------------------------------------
// Randomness without a random number generator on the state — lifted wholesale from
// spectacle.js, because the constraint is the same one. The seed is match-CONSTANT (both
// ends derive it from the same two cards, so it never goes on the wire) and the state is a
// counter that only moves when a pickup actually spawns — a dozen times a match at most.
const SPECIAL_SET = new Set([PU.DART, PU.GOALWALL, PU.SUPERKICK, PU.DOG]);
const RARITY_N = { common: 1, rare: 2, epic: 3, legendary: 4 };

export function pickupSeed(charA, charB) {
  const v = (RARITY_N[charA?.rarity] || 1) * 40961 + (charA?.number || 1) * 577
          + (RARITY_N[charB?.rarity] || 1) * 21701 + (charB?.number || 1) * 89;
  return Math.imul(v ^ 0x50494b55, 0x85EBCA6B) >>> 0;    // 'PIKU'
}

// Salted with the TICK as well as the counter, which spectacle.js does not need to be and
// this does. Its seed is match-constant and `n` counts 0,1,2,3 — so with a match only ever
// fitting four or five pickups, the same pair of cards drew the identical four items in the
// identical order every single time they played. Measured over 150 bot matches before this
// line existed: ice came up 131 times and the shield twice.
//
// The tick is a number both ends already agree on to the frame — it is in serialize(), and
// a rollback replays to exactly it — so this buys per-match variety for nothing on the wire
// and nothing in determinism. Two clients replaying the same tick still draw the same item.
function rnd(m, pu) {
  pu.n = (pu.n + 1) | 0;
  const tick = Math.round(m.t / C.TICK) | 0;
  let x = (pu.seed ^ Math.imul(pu.n, 0x9E3779B1) ^ Math.imul(tick, 0x85EBCA6B)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x / 4294967296;
}

// ---------------------------------------------------------------------------
export function createPickups(charA, charB) {
  return {
    seed: pickupSeed(charA, charB),   // derived, never serialised
    n: 0,                             // hash counter — this IS the rng state
    next: ticks(C.PICKUP_FIRST),      // ticks to the next spawn ATTEMPT
    kind: PU.NONE,                    // what is on the pitch (0 = nothing)
    x: 0,
    warn: 0,                          // ticks of telegraph left; 0 = collectable
    life: 0,                          // ticks it stays collectable
    prev: PU.NONE,                    // last kind spawned, so the same one never repeats
    eff: [0, 0, 0, 0, 0, 0, 0, 0],    // [grow,magnet,shield,spring] x 2 players, in ticks
  };
}

// ---------------------------------------------------------------------------
// Read side. Scalar getters rather than an options object, so the 60Hz path allocates
// nothing — same rule as spectacle.js.
export const effT = (m, i, slot) => (m.pu ? m.pu.eff[i * EFF_N + slot] : 0);

export const hasGrow = (m, i) => effT(m, i, 0) > 0;
export const hasMagnet = (m, i) => effT(m, i, 1) > 0;
export const hasShield = (m, i) => effT(m, i, 2) > 0;
export const hasSpring = (m, i) => effT(m, i, 3) > 0;

// The multipliers sim.js reaches for. All 1 when nothing is live, so the pickup system
// costs one array read per call on the overwhelmingly common path.
export const puHeadScale = (m, i) => (hasGrow(m, i) ? C.PU_GROW_SCALE : 1);
export const puJump = (m, i) => (hasSpring(m, i) ? C.PU_SPRING_JUMP : 1);
export const puMaxJumps = (m, i) =>
  C.MAX_JUMPS + (hasSpring(m, i) ? Math.max(0, Math.round(C.PU_SPRING_JUMPS)) : 0);

// The world-space height a pickup floats at. Deliberately low enough that a STANDING player
// collects it by walking into it: making you jump for it would turn a footrace into a
// timing puzzle, and the footrace is the mechanic.
export const pickupY = () => C.GROUND_Y - C.PICKUP_Y;

// What the renderer draws. `f` and `lifeFrac` are recomputed from the live constants rather
// than stored, which costs two integers of wire and is only ever used for a fade — if the
// tuner moves PICKUP_WARN mid-telegraph the ring animates slightly wrong for one item.
export function activePickup(m) {
  const pu = m.pu;
  if (!pu || pu.kind === PU.NONE) return null;
  const w0 = ticks(C.PICKUP_WARN), l0 = ticks(C.PICKUP_LIFE);
  return {
    kind: pu.kind,
    name: PU_NAME[pu.kind],
    color: PU_COLOR[pu.kind],
    label: PU_LABEL[pu.kind],
    x: pu.x,
    y: pickupY(),
    live: pu.warn <= 0,
    f: pu.warn > 0 ? Math.max(0, Math.min(1, 1 - pu.warn / w0)) : 1,   // 0 announced → 1 live
    lifeFrac: pu.warn > 0 ? 1 : Math.max(0, Math.min(1, pu.life / l0)),
    left: (pu.warn > 0 ? pu.warn : pu.life) * C.TICK,
  };
}

// Everything currently running on one player, for the badge strip over their head. A player
// with no effects allocates one empty array a frame, which is the renderer's problem and
// not the sim's.
export function puBadges(m, i) {
  const out = [];
  if (!m.pu) return out;
  for (let s = 0; s < EFF_N; s++) {
    const t = m.pu.eff[i * EFF_N + s];
    if (t <= 0) continue;
    out.push({
      kind: SLOT_KIND[s],
      name: PU_NAME[SLOT_KIND[s]],
      color: PU_COLOR[SLOT_KIND[s]],
      left: t * C.TICK,
      frac: Math.max(0, Math.min(1, t / ticks(SLOT_TIME[s]()))),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// step. One tick, from sim.step(), BEFORE the players move: the spawn decision reads the
// positions the last tick finished on, which is the same frame the telegraph is drawn from.
export function stepPickups(m, fx) {
  const pu = m.pu;
  if (!pu) return;

  if (m.phase !== 'play' || m.freeze > 0) return;

  // FAIRNESS 5. Effect timers tick FIRST and unconditionally, before any of the gates
  // below can return early. An effect that stops counting down is an effect that never
  // ends, which is the one thing this file promises cannot happen.
  stepEffects(m, pu);

  // The two switches, and the line between them is where a real bug lived.
  //
  // PICKUPS_ON governs the CRATES — spawning them, and whether one can be raced for. It
  // used to govern the effects as well, and cancelled every running one the moment it went
  // off. That was correct while a crate was the only way to get a power, and wrong the
  // instant cards became the other way: with crates off by default, a pressed card applied
  // its power and this line erased it on the very next tick. It survived every unit test in
  // test-powerups because they all switch the crates ON.
  //
  // So: crates off takes the crate off the pitch and leaves the effects alone. Effects are
  // only cancelled when NOTHING can produce them — both switches off — which is what the
  // tuner's off switch actually means.
  if (C.PICKUPS_ON < 0.5) {
    if (C.CARDS_ON < 0.5) wipePickups(m, 'off');
    else despawn(m, pu, 'off');
    return;
  }

  // FAIRNESS 5. The end of a match belongs to the players. Sudden death sets clock to 0,
  // so this covers overtime too. An uncollected pickup is taken off the pitch.
  if (m.golden || m.clock <= C.PICKUP_QUIET_END) { despawn(m, pu, 'quiet'); return; }

  if (pu.kind !== PU.NONE) {
    if (pu.warn > 0) {
      if (--pu.warn <= 0) {
        m.events.push({ type: 'puLive', kind: pu.kind, name: PU_NAME[pu.kind], x: pu.x });
        fx.shockwave(pu.x, pickupY(), PU_COLOR[pu.kind]);
      }
    } else if (--pu.life <= 0) {
      // An uncollected pickup ends too. A crate nobody wanted must not sit there all match.
      m.events.push({ type: 'puGone', kind: pu.kind, name: PU_NAME[pu.kind], x: pu.x });
      retire(pu);
    }
    return;
  }

  if (pu.next > 0) { pu.next--; return; }
  trySpawn(m, pu);
}

function stepEffects(m, pu) {
  for (let i = 0; i < 2; i++) {
    for (let s = 0; s < EFF_N; s++) {
      const k = i * EFF_N + s;
      if (pu.eff[k] <= 0) continue;
      if (--pu.eff[k] > 0) continue;
      endEffect(m, i, s);
    }
  }
}

function endEffect(m, i, s) {
  // The spring hands out an extra air jump. When it expires the player may still be holding
  // one, so it is clawed back here — otherwise "the effect ended" is not quite true and a
  // player floats one jump past the end of their own power-up.
  if (SLOT_KIND[s] === PU.SPRING) m.players[i].jumps = Math.min(m.players[i].jumps, C.MAX_JUMPS);
  m.events.push({ type: 'puEnd', player: i, kind: SLOT_KIND[s], name: PU_NAME[SLOT_KIND[s]] });
}

// Take whatever is on the pitch off it and start the gap clock. Effects are untouched:
// they were earned in open play and they run their own timer down.
function despawn(m, pu, why) {
  if (pu.kind === PU.NONE) return;
  m.events.push({ type: 'puGone', kind: pu.kind, name: PU_NAME[pu.kind], x: pu.x, why });
  retire(pu);
}

function retire(pu) {
  pu.prev = pu.kind;
  pu.kind = PU.NONE;
  pu.x = 0; pu.warn = 0; pu.life = 0;
  pu.next = ticks(C.PICKUP_GAP);
}

// The full stop: pitch cleared AND every effect cancelled. Used by a goal (both players
// have just been teleported to the spawn spots, so the passage of play the pickup belonged
// to is over) and by the off switch.
export function wipePickups(m, why = 'reset') {
  const pu = m.pu;
  if (!pu) return;
  despawn(m, pu, why);
  for (let i = 0; i < 2; i++) {
    for (let s = 0; s < EFF_N; s++) {
      if (pu.eff[i * EFF_N + s] <= 0) continue;
      pu.eff[i * EFF_N + s] = 0;
      endEffect(m, i, s);
    }
  }
}

// ---------------------------------------------------------------------------
// SPAWNING — the whole fairness argument, in about twenty lines.
function trySpawn(m, pu) {
  const [a, b] = m.players;

  // FAIRNESS 2. A telegraph is only fair to somebody able to answer it, and a footrace is
  // only fair to two people able to run. Knocked down and rooted are total; `slow` is 45%
  // off the top speed for 1.7s, which loses the race outright, so it counts too. This
  // postpones — it never cancels — so denying a pickup by tackling is worth a couple of
  // seconds and nothing more.
  for (const p of m.players) {
    if (p.knocked > 0 || p.rooted > 0 || p.slow > 0) return false;
  }

  // FAIRNESS 1. The one x on the pitch that is the same distance from both of them.
  //
  // Their SPEEDS still differ a little (rarity is ±6%) and their momentum differs a lot,
  // which is the point: from an identical start, the race is decided by who reacts, who is
  // already moving the right way, and who is willing to leave their goal. That is football.
  // What it can never be decided by is where the thing happened to appear.
  const x = (a.x + b.x) / 2;
  const lo = C.GOAL_W + C.PICKUP_KEEPOUT;
  const hi = C.W - C.GOAL_W - C.PICKUP_KEEPOUT;
  // Both players parked in the same corner. Clamping into the band would move the pickup
  // toward one of them, so wait for the pitch to open up instead — the same "return null
  // and skip the drop" that spectacle.js does when there is nowhere safe for a meteor.
  if (!(x >= lo && x <= hi)) return false;

  // FAIRNESS 4. ICE is the only item that takes something off the other player, so it is
  // the only one that can snowball — and it is in the hat only while the match is close.
  const lead = Math.abs(m.score[0] - m.score[1]);
  const pool = [];
  for (const k of PU_KINDS) {
    if (k === pu.prev) continue;                                   // never twice running
    if (k === PU.ICE && lead >= C.PICKUP_MERCY_LEAD) continue;
    pool.push(k);
  }
  const kind = pool[Math.min(pool.length - 1, Math.floor(rnd(m, pu) * pool.length))];

  pu.kind = kind;
  pu.x = Math.round(x);
  pu.warn = ticks(C.PICKUP_WARN);
  pu.life = ticks(C.PICKUP_LIFE);
  m.events.push({
    type: 'puWarn', kind, name: PU_NAME[kind], x: pu.x, warn: pu.warn * C.TICK,
    // The two distances, on the event, so a replay can be audited without re-deriving them.
    dA: Math.abs(pu.x - a.x), dB: Math.abs(pu.x - b.x),
  });
  return true;
}

// ---------------------------------------------------------------------------
// COLLECTING — called from sim.step() AFTER the players have moved and been separated, so
// the frame you touch it is the frame you get it.
export function collectPickups(m, fx) {
  const pu = m.pu;
  if (!pu || pu.kind === PU.NONE || pu.warn > 0) return;
  const y = pickupY();

  let best = null, bestD = Infinity;
  for (const p of m.players) {
    if (p.knocked > 0) continue;                 // face down on the grass, collecting nothing
    const d = reach(m, p, pu.x, y);
    if (d === null || d >= bestD) continue;
    best = p; bestD = d;
  }
  // A dead heat — both silhouettes over it, centres exactly the same distance away — must
  // not be resolved by the loop order, or player 0 wins every one of them. Two identical
  // cards racing from an identical distance produce exactly this, so it is not a
  // hypothetical. Whoever is BEHIND takes it (the only tiebreak in this file that leans,
  // and rule 4 says which way); if the score is level too it goes to the deterministic coin
  // this module already carries, which is the same on both ends of a rollback.
  if (best) {
    const other = m.players[1 - best.index];
    const od = reach(m, other, pu.x, y);
    if (od !== null && od === bestD) {
      if (m.score[other.index] < m.score[best.index]) best = other;
      else if (m.score[other.index] === m.score[best.index] && rnd(m, pu) < 0.5) best = other;
    }
    take(m, pu, best, fx);
  }
}

// Distance from the pickup to the player's CENTRE if any part of their silhouette — head
// circle or body box — is over it; null if they are not touching it. Same "whole
// silhouette" test tryTackle uses, so what counts as touching is one idea in this game.
function reach(m, p, x, y) {
  const hy = headMid(p);
  const hr = C.HEAD_R * puHeadScale(m, p.index);
  const dHead = Math.hypot(x - p.x, y - hy);
  let hit = dHead < hr + C.PICKUP_R;
  if (!hit) {
    const nx = Math.max(p.x - C.BODY_W / 2, Math.min(x, p.x + C.BODY_W / 2));
    const ny = Math.max(p.y - C.BODY_H, Math.min(y, p.y));
    hit = Math.hypot(x - nx, y - ny) < C.PICKUP_R;
  }
  return hit ? dHead : null;
}

// WHAT A POWER DOES, in one place, with no idea where it came from.
//
// Two things fire these now — a crate you ran into, and a card you pressed — and there must
// be exactly one definition of what "the magnet" means or the two will drift the first time
// anyone tunes one. `mult` is the cards' rarity ladder: 1 for a crate and for a common
// card, up to about 1.64 for a legendary. It stretches DURATIONS only; nothing here gets
// stronger, just longer, which is the same bound the crates already lived inside.
export function applyPower(m, i, kind, mult = 1, fx = null, at = null) {
  const p = m.players[i];
  const foe = m.players[1 - i];
  const slot = SLOT[kind];
  const col = PU_COLOR[kind];
  const x = at ? at.x : p.x, y = at ? at.y : pickupY();

  // The specials are objects on the pitch rather than numbers on a player, so they are cast
  // rather than applied. Same entry point, so a crate could fire one too if it ever carried
  // one — there is exactly one definition of what each power means.
  if (SPECIAL_SET.has(kind)) {
    SK.cast(m, i, kind);
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_PICKUP);
    if (fx) fx.shockwave(x, y, col);
    return kind;
  }

  if (slot !== undefined) {
    // Re-applying REFRESHES, it never stacks: two big-head crates do not make a
    // bigger head, they make a longer big head. That is what bounds the swing.
    m.pu.eff[i * EFF_N + slot] = ticks(SLOT_TIME[slot]() * mult);
  } else if (kind === PU.CHARGE) {
    // The gauge fills on a 28-second clock anyway; this is a shortcut to a shot that is
    // still blockable, not a free goal.
    p.gauge = 1;
  } else if (kind === PU.ICE) {
    // Frozen boots. Deliberately `slow` and not `rooted`: you keep every button, you are
    // just heavy. Nothing in this file takes the controls off a player.
    foe.slow = Math.max(foe.slow, C.PU_ICE_TIME * mult);
  }

  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_PICKUP);
  if (fx) { fx.shockwave(x, y, col); fx.hit(x, y, col, 2); }
  return kind;
}

function take(m, pu, p, fx) {
  const kind = pu.kind;
  const y = pickupY();
  applyPower(m, p.index, kind, 1, fx, { x: pu.x, y });
  m.events.push({ type: 'puTake', kind, name: PU_NAME[kind], player: p.index, x: pu.x, y });
  retire(pu);
}

// ---------------------------------------------------------------------------
// THE MAGNET. Called from stepBall on a LOOSE ball only — a live power shot flies the same
// dead-flat line every time on purpose, and bending it would turn "get in the way" back
// into a guess. Exactly the rule wind already follows.
//
// Why it cannot score for you: the pull is always TOWARD the holder, and a player is
// clamped out of the net. So a magnet can drag the ball to your feet and it can drag it
// into your OWN goal if you stand on your own line — which is the drawback that makes it a
// tool rather than a buff — but it can never carry a ball past its own holder into theirs.
export function applyMagnet(m, b, dt) {
  const pu = m.pu;
  if (!pu) return;
  const range = C.PU_MAGNET_RANGE;
  for (let i = 0; i < 2; i++) {
    if (pu.eff[i * EFF_N + 1] <= 0) continue;
    const p = m.players[i];
    const dx = p.x - b.x, dy = headMid(p) - b.y;
    const d = Math.hypot(dx, dy);
    if (d > range || d < 1) continue;
    // Falls off linearly to nothing at the rim, so the edge of the field is not a cliff.
    const k = (1 - d / range) * C.PU_MAGNET_FORCE * dt;
    b.vx += (dx / d) * k;
    b.vy += (dy / d) * k;
  }
}

// THE SHIELD. Spent by sim.js when a power shot — fired or booted — reaches the holder.
// One shot, then it is gone, which is why it is worth racing for and why it cannot lock a
// match down. Returns true if it absorbed something.
export function spendShield(m, i) {
  const pu = m.pu;
  if (!pu || pu.eff[i * EFF_N + 2] <= 0) return false;
  pu.eff[i * EFF_N + 2] = 0;
  m.events.push({ type: 'puShieldBreak', player: i });
  return true;
}

// ---------------------------------------------------------------------------
// Wire format. All integers (see `ticks`), one flat array, trailing zeros trimmed.
//
// The order is chosen for the TRIM, not for readability: the three fields that are non-zero
// for most of a match come first, and the eleven that are zero unless something is actually
// happening come last. An idle pickup system is `[412]` — about eleven bytes of the
// snapshot — and a live one with two effects running is under fifty.
//
// `seed` is deliberately absent: it is derived from the two cards, which are match-constant
// and known at both ends. Anything else that can affect a future step IS here.
const HEAD = 7;   // next, n, prev, kind, x, warn, life

export function packPickups(pu) {
  const a = [pu.next, pu.n, pu.prev, pu.kind, pu.x, pu.warn, pu.life, ...pu.eff];
  let end = a.length;
  while (end > 0 && a[end - 1] === 0) end--;
  return end === a.length ? a : a.slice(0, end);
}

export function unpackPickups(pu, a) {
  const v = (i) => (i < a.length ? a[i] : 0);
  pu.next = v(0); pu.n = v(1); pu.prev = v(2);
  pu.kind = v(3); pu.x = v(4); pu.warn = v(5); pu.life = v(6);
  for (let i = 0; i < EFF_N * 2; i++) pu.eff[i] = v(HEAD + i);
  return pu;
}
