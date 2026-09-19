// THE SPECIAL POWERS — the four that only the good cards carry.
//
// The original six are all buffs on a timer: they change what YOU can do, and they end. These
// put something ON THE PITCH — a dart, a wall across a goal, a dog — and an object in the
// world is a different thing to keep fair than a number on a player.
//
// The rules, and every one of them is asserted in test-skills.mjs:
//
//   1. NOTHING HERE IS UNAVOIDABLE. The dart flies one straight visible line at the height of
//      a head. The dog runs along the ground and a jump clears it — that is the whole game of
//      it. The goal wall goes up on your OWN goal, so it never takes a control or a moment
//      away from the other player; it just makes them find another way in.
//   2. EVERYTHING ENDS, and nothing stacks with itself. One dart, one dog, one wall. A dog
//      that never leaves is not a power, it is a change to the rules of the pitch.
//   3. THEY ARE THE LADDER. Epic and legendary only — see cardPower(). Once every rarity
//      fires the same six powers, "a better card" has to mean something you cannot otherwise
//      do, not just a longer version of the same thing.
//   4. ALL OF IT TRAVELS. Anything that can change a future tick is in the snapshot, in
//      integer ticks, or two clients end up with different dogs.
//
// Leaf module in the same shape as powerups.js and spectacle.js: pure functions over match
// state, no DOM, no timers, no Math.random.
import * as C from './constants.js';

// The kind numbers are repeated here rather than imported from powerups.js, and that is
// deliberate: powerups.js imports THIS module to cast them, so importing PU back would be a
// cycle — and an ES-module cycle does not fail loudly, it hands you an uninitialised binding
// at the exact moment a top-level constant reads it. test-skills.mjs asserts that these four
// numbers still match the PU enum, which is the honest way to keep two copies of a fact.
const DART = 7, GOALWALL = 8, SUPERKICK = 9, DOG = 10;
export const SPECIAL_KINDS = [DART, GOALWALL, SUPERKICK, DOG];

const ticks = (seconds) => Math.max(1, Math.round(seconds / C.TICK));
const headMid = (p) => p.y - C.BODY_H - C.HEAD_R + 8;

export function createSkills() {
  return {
    // One dart in flight: x, y, vx, owner, life. kind 0 = nothing there.
    dart: { on: 0, x: 0, y: 0, vx: 0, by: 0, life: 0 },
    // One dog: runs the ground, bites a player who is standing on it, and then HANGS ON.
    // `on` is 0 gone, 1 running, 2 latched onto a leg — the renderer draws a different animal
    // for each — and `hold` is how much longer it keeps hold.
    dog: { on: 0, x: 0, vx: 0, by: 0, life: 0, hold: 0 },
    // Goal walls, one clock per side, on the goal that player DEFENDS.
    wall: [0, 0],
    // Armed super kicks, one flag per player.
    sup: [0, 0],
    // Head-size clocks: shrunk by a dart, grown by one that found the net.
    size: [0, 0],
    sizeK: [1, 1],
  };
}

// ---------------------------------------------------------------------------
// Readers — the renderer, the bot and the tests all go through these rather than reaching
// into the state, so the shape stays this module's business.
export const activeDart = (m) => (m.sk && m.sk.dart.on ? m.sk.dart : null);
export const activeDog = (m) => (m.sk && m.sk.dog.on ? m.sk.dog : null);
export const goalWallT = (m, i) => (m.sk ? m.sk.wall[i] * C.TICK : 0);
export const hasSuperKick = (m, i) => !!(m.sk && m.sk.sup[i]);
// What the dart did to this player's head, as a multiplier the renderer and the sim share.
export const headScale = (m, i) => (m.sk && m.sk.size[i] > 0 ? m.sk.sizeK[i] : 1);

// ---------------------------------------------------------------------------
// CASTING. Called from applyPower() when a card of one of these kinds is pressed.
export const SK = {
  cast(m, i, kind) {
    if (!m.sk) return false;
    const p = m.players[i];
    const dir = p.facing || (p.side || 1);
    switch (kind) {
      case DART: {
        // Re-firing while one is in flight replaces it rather than adding a second: two
        // darts is twice the pitch covered for one cooldown.
        const d = m.sk.dart;
        d.on = 1; d.by = i; d.life = ticks(C.SKILL_DART_LIFE);
        d.x = p.x + dir * (C.BODY_W * 0.6 + 6);
        d.y = headMid(p);
        d.vx = dir * C.SKILL_DART_SPEED;
        m.events.push({ type: 'dartFired', player: i, x: d.x, y: d.y, dir });
        return true;
      }
      case GOALWALL: {
        m.sk.wall[i] = ticks(C.SKILL_WALL_TIME);
        m.events.push({ type: 'goalWall', player: i, side: p.side });
        return true;
      }
      case SUPERKICK: {
        m.sk.sup[i] = ticks(C.SKILL_SUPER_ARM);
        m.events.push({ type: 'superArm', player: i });
        return true;
      }
      case DOG: {
        const d = m.sk.dog;
        const foe = m.players[1 - i];
        d.on = 1; d.by = i; d.life = ticks(C.SKILL_DOG_LIFE); d.hold = 0;
        d.x = p.x;
        // It runs at whoever it was not sent by, wherever they happen to be standing.
        d.vx = Math.sign(foe.x - p.x || 1) * C.SKILL_DOG_SPEED;
        m.events.push({ type: 'dogOut', player: i, x: d.x });
        return true;
      }
      default: return false;
    }
  },
};

// ---------------------------------------------------------------------------
// One tick of everything on the pitch. Called from step() while the ball is live.
export function stepSkills(m, fx) {
  const sk = m.sk;
  if (!sk) return;

  // Head-size clocks first and unconditionally, for the same reason powerups.js ticks its
  // effects before any gate: a size that stops counting down is a size that never comes back.
  for (let i = 0; i < 2; i++) {
    if (sk.size[i] > 0 && --sk.size[i] <= 0) {
      sk.sizeK[i] = 1;
      m.events.push({ type: 'sizeEnd', player: i });
    }
  }
  for (let i = 0; i < 2; i++) {
    if (sk.wall[i] > 0 && --sk.wall[i] <= 0) m.events.push({ type: 'goalWallEnd', player: i });
    if (sk.sup[i] > 0) sk.sup[i]--;
  }

  if (m.phase !== 'play' || m.freeze > 0) return;
  stepDart(m, fx);
  stepDog(m, fx);
}

// THE DART. One straight line at head height, and the two things it can find are the two
// things worth aiming at: a player, or the net behind them.
function stepDart(m, fx) {
  const d = m.sk.dart;
  if (!d.on) return;
  d.x += d.vx * C.TICK;

  const foe = m.players[1 - d.by];
  const me = m.players[d.by];
  if (Math.hypot(d.x - foe.x, d.y - headMid(foe)) < C.HEAD_R + C.SKILL_DART_R) {
    shrink(m, foe.index, C.SKILL_SHRINK, C.SKILL_SHRINK_TIME);
    m.events.push({ type: 'dartHit', player: d.by, on: foe.index, x: d.x, y: d.y });
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_PICKUP);
    if (fx) fx.hit(d.x, d.y, '#ff4d6d', 3);
    retire(d);
    return;
  }

  // The other end of the same shot: a dart that misses carries on into the goal mouth, and
  // paying for a MISS is what makes it worth firing at an empty net on purpose. It never
  // scores — a dart in the net is a dart, not a goal.
  const inMouth = d.y > C.GROUND_Y - C.GOAL_H && d.y < C.GROUND_Y;
  if (inMouth && (d.x < C.GOAL_W || d.x > C.W - C.GOAL_W)) {
    grow(m, me.index, C.SKILL_GROW, C.SKILL_GROW_TIME);
    m.events.push({ type: 'dartGoal', player: me.index, x: d.x, y: d.y });
    if (fx) fx.shockwave(d.x, d.y, '#ffd54a');
    retire(d);
    return;
  }

  if (d.x < -30 || d.x > C.W + 30 || --d.life <= 0) retire(d);
}

// THE DOG. Runs the ground line, bites a player who is standing on it, and can be jumped —
// which is the entire game of it, and the reason it is fair.
function stepDog(m, fx) {
  const d = m.sk.dog;
  if (!d.on) return;

  // Hanging off a leg: it goes where the leg goes, and the player stays held for exactly as
  // long as it is there rather than for a timer that runs independently of the animal.
  if (d.on === 2) {
    const held = m.players[1 - d.by];
    d.x = held.x;
    held.rooted = Math.max(held.rooted, 2 * C.TICK);
    held.vx = 0;
    if (--d.hold <= 0) { d.on = 0; d.hold = 0; d.life = 0; m.events.push({ type: 'dogLetGo', on: held.index }); }
    return;
  }

  d.x += d.vx * C.TICK;

  const foe = m.players[1 - d.by];
  if (foe.onGround && Math.abs(d.x - foe.x) < C.BODY_W / 2 + C.SKILL_DOG_R) {
    // It LATCHES rather than vanishing. The first version deleted the dog on the frame it
    // bit, so the whole second it holds you happened with nothing on screen — a player
    // frozen by an animal that was no longer in the game.
    d.on = 2;
    d.hold = ticks(C.SKILL_DOG_HOLD);
    d.x = foe.x;
    foe.rooted = Math.max(foe.rooted, C.SKILL_DOG_HOLD);
    foe.vx = 0;
    m.events.push({ type: 'dogBite', player: d.by, on: foe.index, x: d.x });
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_TACKLE);
    if (fx) fx.hit(d.x, C.GROUND_Y - 14, '#c98b3a', 3);
    return;
  }

  if (d.x < -40 || d.x > C.W + 40 || --d.life <= 0) { d.on = 0; d.life = 0; m.events.push({ type: 'dogGone' }); }
}

const retire = (d) => { d.on = 0; d.life = 0; d.vx = 0; };

function shrink(m, i, k, seconds) {
  m.sk.sizeK[i] = k;
  m.sk.size[i] = ticks(seconds);
}
function grow(m, i, k, seconds) {
  m.sk.sizeK[i] = k;
  m.sk.size[i] = ticks(seconds);
}

// THE GOAL WALL. Asked by sim.js at the moment it is about to award a goal.
//
// Takes the DEFENDER'S INDEX, not a side. The first version took a side and compared it to
// `player.side`, which is the direction a player FACES, not the net they defend — so the wall
// never matched and a ball rolled straight through it. sim.js already knows who conceded
// (it is 1 - scorer), so it hands that over and there is nothing to derive.
export const wallUp = (m, defender) => !!(m.sk && m.sk.wall[defender] > 0);

// THE SUPER KICK. sim.js asks on contact; a yes multiplies the ball and throws whoever is
// standing near it, which is the "pushes the enemy back with the ball" of the brief.
export function spendSuperKick(m, i, b, dir) {
  if (!m.sk || !m.sk.sup[i]) return false;
  m.sk.sup[i] = 0;
  b.vx = dir * C.KICK_POWER * C.SKILL_SUPER_BALL;
  b.vy = -C.KICK_LIFT * 0.8;
  const foe = m.players[1 - i];
  if (Math.abs(foe.x - b.x) < C.SKILL_SUPER_RANGE) {
    foe.vx = dir * C.SKILL_SUPER_PUSH;
    foe.vy = Math.min(foe.vy, -C.SKILL_SUPER_LIFT);
    foe.onGround = false;
    foe.rooted = Math.max(foe.rooted, C.TACKLE_STUN);
  }
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
  m.events.push({ type: 'superKick', player: i, x: b.x, y: b.y });
  return true;
}

// Everything a goal has to take off the pitch. Same argument as wipePickups: a dart in
// flight belongs to the passage of play that just ended.
export function wipeSkills(m) {
  if (!m.sk) return;
  retire(m.sk.dart);
  m.sk.dog.on = 0; m.sk.dog.life = 0; m.sk.dog.hold = 0;
  m.sk.wall[0] = m.sk.wall[1] = 0;
  m.sk.size[0] = m.sk.size[1] = 0;
  m.sk.sizeK[0] = m.sk.sizeK[1] = 1;
}

// ---------------------------------------------------------------------------
// Wire format. All integers except the two positions, trailing zeros trimmed — an idle
// skill system is a handful of bytes.
export function packSkills(sk) {
  if (!sk) return [];
  const a = [
    sk.dart.on, Math.round(sk.dart.x), Math.round(sk.dart.y), Math.round(sk.dart.vx), sk.dart.by, sk.dart.life,
    sk.dog.on, Math.round(sk.dog.x), Math.round(sk.dog.vx), sk.dog.by, sk.dog.life, sk.dog.hold,
    sk.wall[0], sk.wall[1], sk.sup[0], sk.sup[1],
    sk.size[0], sk.size[1], Math.round(sk.sizeK[0] * 100), Math.round(sk.sizeK[1] * 100),
  ];
  let end = a.length;
  while (end > 0 && a[end - 1] === 0) end--;
  return end === a.length ? a : a.slice(0, end);
}

export function unpackSkills(sk, a) {
  if (!sk) return sk;
  const v = (i) => (i < a.length ? a[i] : 0);
  sk.dart.on = v(0); sk.dart.x = v(1); sk.dart.y = v(2); sk.dart.vx = v(3); sk.dart.by = v(4); sk.dart.life = v(5);
  sk.dog.on = v(6); sk.dog.x = v(7); sk.dog.vx = v(8); sk.dog.by = v(9); sk.dog.life = v(10);
  // The latch clock. Without it a reconciling client shows a dog that has already let go —
  // or, worse, one that never does.
  sk.dog.hold = v(11);
  sk.wall[0] = v(12); sk.wall[1] = v(13);
  sk.sup[0] = v(14); sk.sup[1] = v(15);
  sk.size[0] = v(16); sk.size[1] = v(17);
  // The multipliers are packed x100; a zero means "not shrunk", which is a scale of 1.
  sk.sizeK[0] = v(18) ? v(18) / 100 : 1;
  sk.sizeK[1] = v(19) ? v(19) / 100 : 1;
  return sk;
}
