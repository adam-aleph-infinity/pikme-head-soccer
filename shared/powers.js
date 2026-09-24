// THE 45 CHAMPION POWERS — what the ultimate DOES in the arcade.
//
// The trigger is not new, and that is deliberate: it is the ultimate this game already has.
// The meter fills off the opponent, POWER arms it, and the next real touch of the ball by your
// head or torso fires it (fireUltimateOnContact in sim.js). Every rule the README spends pages
// on — the press never fires anything, the glow waits, a goal does not spend the meter — holds
// here untouched. What a champion changes is the one line that used to say launchPowerShot().
//
// So a power is a `fire(ctx)` plus whatever state it leaves behind. There are two kinds of
// state and they are the whole engine:
//
//   • a CHAMPION SHOT — the ball becomes a power ball, exactly like the ordinary one (blockable
//     by a body, counterable by a timed kick, it costs the blocker health), with its own
//     `flight` instead of dead flat, and optionally its own answer to being blocked.
//   • an EFFECT — a timed record in m.champ.effects. Effects bend the rules through a fixed,
//     small set of seams: player MODS (speed, jump, head size, controls…), the ball's FIELD
//     (gravity, bounce, top speed, wind, pulls), BARRIERS the ball bounces off, and a per-tick
//     STEP for anything that moves on its own (coins, a clone, a tornado).
//
// Only arcade matches have m.champ (createMatch(..., { champions: true })). Online 1v1 never
// sets it, and every seam in sim.js is a no-op without it — test-arcade.mjs holds a fingerprint
// of the whole non-arcade sim, recorded before this file existed, to keep that true.
//
// Nothing in here may use Math.random. The sim is deterministic and the tests replay it.

import * as C from './constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Geometry every power asks for. `side` is the player's side: +1 attacks the RIGHT goal.
const attackLine = (side) => (side > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const ownLine = (side) => attackLine(-side);
const barTop = () => C.GROUND_Y - C.GOAL_H;
const headYAt = (y) => y - C.BODY_H - C.HEAD_R + 8;         // same formula as sim.js
const shotSpeed = (k) => C.POWER_SHOT_SPEED * k;

// ---------------------------------------------------------------------------
// MODS: every way an effect can change a player. Numbers multiply, flags OR together, so two
// effects on one player stack instead of the newer silently replacing the older.
export const BASE_MODS = Object.freeze({
  speed: 1, accel: 1, jump: 1, grav: 1, head: 1, kick: 1, time: 1, regen: 1,
  friction: 0,            // 0 = the normal ground friction; anything else replaces it (ice)
  airJumps: 0,            // extra jumps in the air
  reverse: false,         // left and right swapped
  frozen: false,          // no input at all, and no sliding
  stopped: false,         // time has stopped for this player: not stepped at all
  noJump: false, noDash: false, dashFree: false, meterLock: false,
});
export const freshMods = () => ({ ...BASE_MODS });
function resetMods(md) { Object.assign(md, BASE_MODS); }
function applyMods(dst, src) {
  for (const k in src) {
    const v = src[k];
    if (typeof v === 'boolean') dst[k] = dst[k] || v;
    else if (k === 'airJumps') dst[k] = Math.max(dst[k], v);
    else if (k === 'friction' || k === 'bounce') dst[k] = v;
    else dst[k] *= v;
  }
}

// The FIELD: what an effect can change about the ball, recomputed every tick like the mods.
const BASE_FIELD = Object.freeze({
  ballGrav: 1, maxSpeed: 1, bounce: 0, windX: 0,
  pulls: null, carry: null, hold: null,
});
const freshField = () => ({ ...BASE_FIELD, pulls: [] });
function resetField(F) { const p = F.pulls; Object.assign(F, BASE_FIELD); p.length = 0; F.pulls = p; }

export function champState() {
  return { effects: [], balls: [], field: freshField(), seq: 0 };
}

function addEffect(m, e) {
  e.t = 0;
  e.seq = ++m.champ.seq;
  m.champ.effects.push(e);
  return e;
}
const modsOn = (m, power, owner, target, life, mods, field) =>
  addEffect(m, { type: 'mods', power, owner, target, life, mods, field });
const fieldFor = (m, power, owner, life, field) =>
  addEffect(m, { type: 'mods', power, owner, target: null, life, mods: null, field });

// ---------------------------------------------------------------------------
// THE TOUCH. What an effect power does to the ball it was fired off — something, always, so
// the touch that spent a full meter never reads as a fluff.
//   strike: driven at the goal this player attacks, on a lofted line.
//   pop:    straight up, a header's height, for the powers that want the ball in the air.
//
// Both RE-PLACE the ball clear of the head first, the way tryHeader does. The touch that fired
// the power is still an overlap, and a ball left inside the head has its new velocity cancelled
// by the next sub-step's contact response whenever it touched the back of the head.
function clearOfHead(ctx, dx, dy) {
  const { b, p, kit, m } = ctx;
  const hr = kit.headR(m, p);
  b.x = kit.keepOutOfGoal(b.x, b.y, p.x + p.side * dx(hr), kit.headY(p) + dy(hr), b.r);
  b.y = Math.min(kit.headY(p) + dy(hr), C.GROUND_Y - b.r);
}
function strike(ctx, k = 1, lift = 0.75) {
  const { b, p } = ctx;
  clearOfHead(ctx, (hr) => hr + b.r + 2, (hr) => -(hr + b.r) * 0.35);
  b.power = null;
  b.vx = p.side * C.KICK_POWER * 1.15 * k;
  b.vy = -C.KICK_LIFT * lift;
  b.spin = p.side * 14;
}
function pop(ctx, lift = 1.25) {
  const { b, p } = ctx;
  clearOfHead(ctx, (hr) => hr * 0.35, (hr) => -(hr + b.r + 2));
  b.power = null;
  b.vx = p.side * 40;
  b.vy = -C.KICK_LIFT * lift;
}

// A champion shot is the ordinary power ball — same owner, direction, life, same blocking and
// countering — with a flight of its own layered on. `kit.launch` IS launchPowerShot.
function launch(ctx, k, extra = {}) {
  const { b, p, kit, power } = ctx;
  const pw = kit.launch(b, p, p.shot, p.side);
  pw.champ = power.id;
  pw.color = power.color;
  pw.glow = power.glow;
  pw.k = k;
  b.vx = p.side * shotSpeed(k);
  Object.assign(pw, extra);
  return pw;
}
// Relaunch the CURRENT ball as a champion shot for `owner` — the mirror, the tornado and the
// carry all end by handing the ball over like this.
function relaunch(m, b, owner, powerId, k, kit) {
  const P = POWERS[powerId];
  const pw = kit.launch(b, owner, owner.shot, owner.side);
  pw.champ = powerId; pw.color = P.color; pw.glow = P.glow; pw.k = k;
  pw.flat = true;
  b.vx = owner.side * shotSpeed(k);
  return pw;
}

// The flights. Each sets the ball's velocity for this slice of the tick; the sim integrates.
function flatFlight(pw, b, dt) {
  b.vx = pw.dir * shotSpeed(pw.k) * (pw.mult || 1);
  b.vy += C.BALL_GRAV * C.POWER_SHOT_SAG * dt;
}
// Straight at a point, at a speed, with no gravity: the dives and the returns.
function aimAt(b, tx, ty, speed) {
  const dx = tx - b.x, dy = ty - b.y;
  const d = Math.hypot(dx, dy) || 1;
  return { vx: dx / d * speed, vy: dy / d * speed };
}

// A capsule of radius `rad` from (ax, ay) to (bx, by); true on contact. Used by every barrier.
function bounceSeg(b, ax, ay, bx, by, rad, rest) {
  const ex = bx - ax, ey = by - ay;
  const len2 = ex * ex + ey * ey;
  const t = len2 > 0 ? clamp(((b.x - ax) * ex + (b.y - ay) * ey) / len2, 0, 1) : 0;
  const px = ax + ex * t, py = ay + ey * t;
  const dx = b.x - px, dy = b.y - py;
  const d = Math.hypot(dx, dy);
  const min = b.r + rad;
  if (d >= min) return false;
  const nx = d > 1e-4 ? dx / d : 0, ny = d > 1e-4 ? dy / d : -1;
  b.x = px + nx * min; b.y = py + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) { b.vx = (b.vx - 2 * dot * nx) * rest; b.vy = (b.vy - 2 * dot * ny) * rest; }
  return true;
}
// A circle moving at (vx, vy); the ball comes off it with `rest` of its relative speed.
function bounceCircle(b, cx, cy, rad, rest, vx = 0, vy = 0) {
  const dx = b.x - cx, dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  const min = b.r + rad;
  if (d >= min) return false;
  const nx = d > 1e-4 ? dx / d : 0, ny = d > 1e-4 ? dy / d : -1;
  b.x = cx + nx * min; b.y = Math.min(cy + ny * min, C.GROUND_Y - b.r);
  const rvx = b.vx - vx, rvy = b.vy - vy;
  const dot = rvx * nx + rvy * ny;
  if (dot < 0) {
    b.vx = vx + (rvx - (1 + rest) * dot * nx);
    b.vy = vy + (rvy - (1 + rest) * dot * ny);
  }
  return true;
}
// A body the ball can be blocked by, when it is not the body's own side's power ball: the
// clone keeper and the goal wall both stop a shot the way a defender does, minus the health.
function blockPowerBall(m, b, ownerIndex, awayDir, fx, what) {
  if (!b.power || b.power.owner === ownerIndex) return false;
  const color = b.power.color;
  b.power = null;
  b.vx = awayDir * Math.max(120, Math.abs(b.vx) * 0.42);
  b.vy = -Math.abs(b.vy) * 0.4 - 160;
  m.events.push({ type: 'saved', by: what, player: ownerIndex });
  fx.shockwave(b.x, b.y, color);
  return true;
}

// ---------------------------------------------------------------------------
// EFFECT TYPES — the reusable behaviours. A power names one and fills in its numbers.
//
//   mods(e)                          e.mods on player e.target, e.field on the ball, per tick
//   field(e, F, m)                   add to the ball's field
//   step(e, m, dt, kit, fx)          once a tick, before the players move
//   barrier(e, b, m, kit, fx, fx0, fy0)   once per ball sub-step, before the goal is tested
//   end(e, m, kit, fx)               the tick it runs out
const EFFECTS = {
  mods: {},

  // The ball is pulled toward a point. `to` is 'boot' (the owner's own boot: the magnet) or
  // 'goal' (the net the owner attacks).
  pull: {
    field(e, F, m) {
      const o = m.players[e.owner];
      const pt = e.to === 'boot'
        ? { x: o.x + o.side * 40, y: C.GROUND_Y - 22 }
        : { x: attackLine(o.side) + o.side * 18, y: C.GROUND_Y - C.GOAL_H * 0.45 };
      F.pulls.push({ x: pt.x, y: pt.y, k: e.k, range: e.range, hold: e.to === 'boot' });
    },
  },

  // Wind across the whole pitch, toward the goal the owner attacks.
  wind: { field(e, F) { F.windX += e.ax; } },

  // A conveyor under the target's feet, toward the middle of the pitch: the keeper is dragged
  // off their line. Moved by position, not velocity, so walking against it still gets you
  // somewhere — just slowly.
  drag: {
    step(e, m, dt) {
      const q = m.players[e.target];
      const toMid = Math.sign(C.W / 2 - q.x);
      q.x += toMid * e.rate * dt;
    },
  },

  // Health lost a little at a time. Through kit.damage, which is the only thing that writes hp.
  burn: {
    step(e, m, dt, kit) {
      while (e.t >= e.next && e.next < e.life) {
        kit.damage(m, m.players[e.target], e.dmg);
        e.next += e.every;
      }
    },
  },

  // A wall across the mouth of the owner's own goal.
  wall: {
    barrier(e, b, m, kit, fx) {
      if (!bounceSeg(b, e.x, C.GROUND_Y + 20, e.x, e.top, 7, 0.82)) return;
      const away = Math.sign(C.W / 2 - e.x);
      blockPowerBall(m, b, e.owner, away, fx, 'wall');
      if (b.vx * away < 60) b.vx = away * 60;            // never parks against its own wall
      m.events.push({ type: 'wallHit', player: e.owner });
    },
  },

  // A ONE-WAY mirror on the owner's side of halfway. The first ball to cross it toward the
  // owner's goal comes back as the owner's power shot, and the mirror is gone.
  mirror: {
    barrier(e, b, m, kit, fx, fromX) {
      if (e.used) return;
      const o = m.players[e.owner];
      const was = (fromX - e.x) * o.side, now = (b.x - e.x) * o.side;
      if (!(was > 0 && now <= 0 && b.vx * o.side < 0)) return;
      b.x = e.x + (e.x - b.x) + o.side * 2;
      relaunch(m, b, o, 'mirror', 1.1, kit);
      b.vy = Math.min(b.vy, 0) * 0.3;
      e.used = true;
      e.life = e.t;                                         // ends on the next tick
      m.events.push({ type: 'mirrored', player: e.owner });
      fx.shockwave(b.x, b.y, POWERS.mirror.color);
    },
  },

  // Coins rain over the target. Where they fall is a fixed sequence around wherever the target
  // is standing — deterministic, and you can dodge it by moving.
  coins: {
    step(e, m, dt, kit, fx) {
      const q = m.players[e.target];
      const half = q.side > 0 ? [C.GOAL_W + 20, C.W / 2] : [C.W / 2, C.W - C.GOAL_W - 20];
      while (e.t >= e.next && e.next < e.life - 0.5) {
        const x = clamp(q.x + COIN_OFFSETS[e.n++ % COIN_OFFSETS.length], half[0], half[1]);
        e.coins.push({ x, y: C.CEIL_Y + 10, vy: 40 });
        e.next += e.every;
      }
      const hr = kit.headR(m, q), hy = kit.headY(q);
      for (let i = e.coins.length - 1; i >= 0; i--) {
        const c = e.coins[i];
        c.vy += C.BALL_GRAV * 0.9 * dt;
        c.y += c.vy * dt;
        const onHead = Math.hypot(c.x - q.x, c.y - hy) < hr + 7;
        const onBody = Math.abs(c.x - q.x) < C.BODY_W / 2 + 7 && c.y > q.y - C.BODY_H && c.y < q.y;
        if (onHead || onBody) {
          kit.damage(m, q, e.dmg);
          q.vx += (Math.sign(q.x - c.x) || 1) * 70;
          m.events.push({ type: 'coinHit', player: q.index });
          fx.hit(c.x, c.y, POWERS.coins.color, 0.8);
          e.coins.splice(i, 1);
        } else if (c.y > C.GROUND_Y) e.coins.splice(i, 1);
      }
    },
  },

  // The ball glued to the owner's boot. Kick to let it go as a power shot; a tackle, the other
  // player's body, or running out of time frees it as a plain ball.
  carry: {
    field(e, F) { F.carry = e; F.ballGrav = 0; },
  },

  // Time stops for the target, and for the ball. The owner can still strike the ball; the
  // strike is banked and lands when time starts again.
  timestop: {
    field(e, F) { F.hold = e; F.ballGrav = 0; },
    end(e, m, kit) {
      const b = m.ball;
      const o = m.players[e.owner];
      // Struck toward their goal, it comes out of the stopped second as the owner's power shot;
      // any other strike just carries on, harder.
      if (e.stored && e.stored.vx * o.side > 0) relaunch(m, b, o, 'timestop', 1.2, kit);
      else if (e.stored) { b.vx = e.stored.vx * 1.35; b.vy = e.stored.vy * 1.35; }
      // …and whoever time stopped for comes back to it half a second late.
      modsOn(m, 'timestop', e.owner, e.target, 0.5, { frozen: true });
      m.events.push({ type: 'timeResumes', player: e.owner });
    },
  },

  // A second keeper made of light, in front of the owner's goal. It walks to the ball, jumps
  // at anything above its head, and blocks a power shot like a defender does.
  clone: {
    step(e, m, dt, kit) {
      const o = m.players[e.owner], b = m.ball;
      const line = ownLine(o.side);
      const lo = Math.min(line + o.side * 26, line + o.side * 120);
      const hi = Math.max(line + o.side * 26, line + o.side * 120);
      const want = clamp(b.x, lo, hi);
      const sp = C.PLAYER_SPEED;
      e.vx = clamp((want - e.x) * 8, -sp, sp);
      e.x = clamp(e.x + e.vx * dt, lo, hi);
      const hy = headYAt(e.y);
      const coming = b.vx * o.side < 0 || b.power;
      if (e.onGround && coming && Math.abs(b.x - e.x) < 150 && b.y < hy - 14) {
        e.vy = -C.JUMP_V * 1.02; e.onGround = false;
      }
      e.vy += C.PLAYER_GRAV * (e.vy > 0 ? C.FALL_MULT : 1) * dt;
      e.y += e.vy * dt;
      if (e.y >= C.GROUND_Y) { e.y = C.GROUND_Y; e.vy = 0; e.onGround = true; }
    },
    barrier(e, b, m, kit, fx) {
      const o = m.players[e.owner];
      const hit = bounceCircle(b, e.x, headYAt(e.y), C.HEAD_R, 0.5, e.vx, e.vy);
      const nx = clamp(b.x, e.x - C.BODY_W / 2, e.x + C.BODY_W / 2);
      const ny = clamp(b.y, e.y - C.BODY_H, e.y);
      const body = !hit && bounceCircle(b, nx, ny, 0, 0.3, e.vx, e.vy);
      if (hit || body) blockPowerBall(m, b, e.owner, o.side, fx, 'clone');
    },
  },

  // A tornado crossing the pitch toward the owner's attacking goal. It lifts the ball and
  // carries it, throws the other player out of its way, and at the goal it fires the ball in.
  tornado: {
    step(e, m, dt, kit) {
      const o = m.players[e.owner], q = m.players[1 - e.owner], b = m.ball;
      e.x += e.dir * e.speed * dt;
      e.hitCd = Math.max(0, e.hitCd - dt);
      if (!b.power && Math.abs(b.x - e.x) < 58 && b.y > C.GROUND_Y - 300) {
        const ty = C.GROUND_Y - C.GOAL_H * 0.6 + Math.sin(e.t * 8) * 14;
        b.vx = lerp(b.vx, e.dir * e.speed * 1.2 + (e.x - b.x) * 4, 0.25);
        b.vy = lerp(b.vy, (ty - b.y) * 4, 0.25);
        e.caught = true;
      }
      if (e.hitCd <= 0 && Math.abs(q.x - e.x) < 50 && q.stunned <= 0) {
        q.vx = (Math.sign(q.x - e.x) || -e.dir) * C.TACKLE_PUSH * 0.9;
        q.vy = Math.min(q.vy, -C.TACKLE_LIFT * 1.4);
        q.onGround = false;
        kit.damage(m, q, 0.05);
        e.hitCd = 0.5;
        m.events.push({ type: 'blown', player: q.index });
      }
      if ((attackLine(o.side) - e.x) * e.dir < 150) e.life = Math.min(e.life, e.t);
    },
    end(e, m, kit) {
      const b = m.ball;
      if (!b.power && Math.abs(b.x - e.x) < 70) relaunch(m, b, m.players[e.owner], 'tornado', 0.95, kit);
    },
  },
};
const COIN_OFFSETS = [-96, 38, -18, 112, 4, -64, 74, 22, -118, 56, -40, 90, 0, -80, 48];

// ---------------------------------------------------------------------------
// THE 45. Order is the arcade order: stage n is legendary_n and fights with POWER_ORDER[n-1].
// They get harder to play against in that order — one plain effect at the start, trajectories
// and control in the middle, several moving parts at the end.
//
//   arm   — when a bot should arm it: 'attack' (ball ahead, their half), 'defend' (ball in my
//           half), 'any'. The trigger is still the touch; this only picks the moment.
//   style — how that champion's bot plays the rest of the match: 'striker' presses more,
//           'keeper' holds its line, 'brawler' goes for the man to earn the meter.
const mk = (id, name, desc, color, glow, icon, kind, arm, style, duration, def) =>
  ({ id, name, desc, color, glow, icon, kind, arm, style, duration, ...def });

export const POWERS = {
  // ── שכונה (1-9): one clean effect each ────────────────────────────────────
  cannon: mk('cannon', 'תותח', 'בעיטה ישרה ועוצמתית לשער. מי שחוסם אותה נהדף אחורה בכוח.',
    '#ff8a3d', '#ffd8a8', '💥', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.0); },
      flight: flatFlight,
      afterBlock(pw, q) {
        q.vx = pw.dir * C.TACKLE_PUSH * 1.9;
        q.vy = -C.TACKLE_LIFT * 1.6;
        q.onGround = false; q.dashT = 0;
      },
    }),
  tentacles: mk('tentacles', 'תולעים', 'תולעים נכרכות סביב רגלי היריב: 3 שניות בלי קפיצה ובהליכה איטית.',
    '#5ce15c', '#c8ffb0', '🪱', 'effect', 'any', 'brawler', 3, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'tentacles', p.index, foe.index, 3, { noJump: true, speed: 0.8 }); },
    }),
  blaze: mk('blaze', 'מנגל בוער', 'כדור אש ישר לשער. מי שחוסם אותו נשרף ומאבד בריאות לאורך 2.5 שניות.',
    '#ff7a18', '#ffd166', '🔥', 'shot', 'attack', 'striker', 2.5, {
      fire(ctx) { launch(ctx, 1.02); },
      flight: flatFlight,
      afterBlock(pw, q, m) {
        addEffect(m, { type: 'burn', power: 'blaze', owner: pw.owner, target: q.index, life: 2.5, every: 0.25, next: 0.25, dmg: 0.03 });
      },
    }),
  mud: mk('mud', 'בוץ', 'היריב שוקע בבוץ: 4 שניות של חצי מהירות ובלי ריצה.',
    '#8a5a2b', '#d9b48a', '🟤', 'effect', 'any', 'brawler', 4, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'mud', p.index, foe.index, 4, { speed: 0.5, accel: 0.6, noDash: true }); },
    }),
  goalwall: mk('goalwall', 'חומת שער', 'חומה סוגרת את השער שלך ל-3.5 שניות ומחזירה כל כדור, גם כדור כוח.',
    '#8fb3ff', '#e0ebff', '🧱', 'effect', 'defend', 'keeper', 3.5, {
      fire(ctx) {
        const { m, p, b } = ctx;
        strike(ctx, 1.1, 0.95);
        const x = ownLine(p.side) + p.side * 8;
        addEffect(m, { type: 'wall', power: 'goalwall', owner: p.index, target: null, life: 3.5, x, top: barTop() - 2 });
      },
    }),
  coins: mk('coins', 'גשם מטבעות', 'מטבעות נופלים על היריב 4.5 שניות. כל מטבע שפוגע כואב — זוז!',
    '#ffc400', '#fff3b0', '🪙', 'effect', 'any', 'brawler', 4.5, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        strike(ctx);
        addEffect(m, { type: 'coins', power: 'coins', owner: p.index, target: foe.index, life: 4.5, every: 0.26, next: 0, n: 0, dmg: 0.06, coins: [] });
      },
    }),
  spring: mk('spring', 'קפיץ', 'קפיצה גבוהה יותר וקפיצה נוספת באוויר ל-7 שניות. הכדור מוקפץ אליך.',
    '#46e0c8', '#c2fff4', '🌀', 'effect', 'any', 'striker', 7, {
      fire(ctx) { const { m, p, b } = ctx; pop(ctx); modsOn(m, 'spring', p.index, p.index, 7, { jump: 1.35, airJumps: 1 }); },
    }),
  magnet: mk('magnet', 'מגנט', 'ל-4 שניות הכדור נמשך אל הנעל שלך — שליטה מלאה בכדור.',
    '#ff4d6d', '#ffc2cf', '🧲', 'effect', 'any', 'striker', 4, {
      fire(ctx) { const { m, p } = ctx; addEffect(m, { type: 'pull', power: 'magnet', owner: p.index, target: null, life: 4, to: 'boot', k: C.BALL_GRAV * 1.3, range: 380 }); },
    }),
  wave: mk('wave', 'גל אדום', 'בעיטת גל שעולה ויורדת בדרך לשער — צריך לתזמן את החסימה.',
    '#e01e4f', '#ff9ab5', '🌊', 'shot', 'attack', 'striker', 0, {
      fire(ctx) {
        const { b } = ctx;
        b.y = Math.min(b.y, C.GROUND_Y - b.r - 60);
        launch(ctx, 0.95, { y0: b.y, amp: 55, w: Math.PI * 3 });
      },
      flight(pw, b) {
        b.vx = pw.dir * shotSpeed(pw.k);
        b.vy = pw.amp * pw.w * Math.cos(pw.w * pw.t);
      },
    }),

  // ── ליגה (10-18): the body and the ball start to change ──────────────────
  giant: mk('giant', 'ראש ענק', 'הראש שלך גדל פי 1.55 ל-7 שניות: שוער ענק וחלוץ ענק.',
    '#ffb000', '#ffe39a', '🗿', 'effect', 'any', 'keeper', 7, {
      fire(ctx) { const { m, p, b } = ctx; pop(ctx); modsOn(m, 'giant', p.index, p.index, 7, { head: 1.55 }); },
    }),
  shrink: mk('shrink', 'מכווץ', 'הראש של היריב מתכווץ ל-60% ל-7 שניות — הרבה יותר קשה לו לחסום.',
    '#b46bff', '#e6ccff', '🔻', 'effect', 'any', 'striker', 7, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'shrink', p.index, foe.index, 7, { head: 0.6 }); },
    }),
  lowgrav: mk('lowgrav', 'ירח', 'כוח משיכה של ירח לכדור ל-6 שניות: הכדור מרחף ונופל לאט.',
    '#c9d6ff', '#ffffff', '🌙', 'effect', 'any', 'striker', 6, {
      fire(ctx) { const { m, p, b } = ctx; pop(ctx, 1.5); fieldFor(m, 'lowgrav', p.index, 6, { ballGrav: 0.35 }); },
    }),
  rising: mk('rising', 'טיל עולה', 'הכדור נוחת על הדשא ומשם טס בקו עולה עד מתחת למשקוף.',
    '#ff5ea8', '#ffc4e1', '🚀', 'shot', 'attack', 'striker', 0, {
      fire(ctx) {
        const { b, p } = ctx;
        b.y = C.GROUND_Y - b.r - 1;
        const pw = launch(ctx, 1.0);
        const dist = Math.max(80, Math.abs(attackLine(p.side) - b.x));
        pw.climb = Math.max(-shotSpeed(1) * 0.8, (barTop() + b.r + 10 - b.y) / (dist / shotSpeed(1)));
      },
      flight(pw, b) { b.vx = pw.dir * shotSpeed(pw.k); b.vy = pw.climb; },
    }),
  turbo: mk('turbo', 'טורבו', 'מהירות פי 1.5 וריצה בלי המתנה ל-4.5 שניות.',
    '#00e5ff', '#b8f7ff', '⚡', 'effect', 'any', 'striker', 4.5, {
      fire(ctx) { const { m, p, b } = ctx; strike(ctx); modsOn(m, 'turbo', p.index, p.index, 4.5, { speed: 1.5, accel: 1.6, dashFree: true }); },
    }),
  heavy: mk('heavy', 'משקולות', 'משקולות על היריב ל-5 שניות: הוא כבד, והקפיצה שלו נמוכה וקצרה.',
    '#9aa3b2', '#e3e7ee', '🏋️', 'effect', 'any', 'brawler', 5, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'heavy', p.index, foe.index, 5, { grav: 1.9, jump: 0.85 }); },
    }),
  skip: mk('skip', 'אבן מקפצת', 'הכדור מקפץ על הדשא בקפיצות נמוכות וגבוהות לסירוגין.',
    '#7fd4ff', '#dff4ff', '🪨', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.05, { hop: 0, falling: false }); },
      flight(pw, b, dt) {
        const g = C.BALL_GRAV * 1.5;
        b.vx = pw.dir * shotSpeed(pw.k);
        // A hop is owed once per landing. Landing is read as "was falling, now at the grass",
        // not as an exact height: the grass bounce happens inside stepBall's own sub-steps, so by
        // the next flight call the ball may already be a few pixels back up.
        if (b.vy > 0) pw.falling = true;
        if (pw.falling && b.y >= C.GROUND_Y - b.r - 6) {
          pw.falling = false;
          const h = pw.hop++ % 2 ? 118 : 26;                 // low, high, low, high
          b.vy = -Math.sqrt(2 * g * h);
        }
        b.vy += g * dt;
      },
    }),
  wind: mk('wind', 'סופה', 'רוח חזקה נושבת לעבר שער היריב ל-4 שניות. היריב הולך נגד הרוח.',
    '#a8e6cf', '#e8fff4', '🌬️', 'effect', 'attack', 'striker', 4, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        strike(ctx);
        addEffect(m, { type: 'wind', power: 'wind', owner: p.index, target: foe.index, life: 4, ax: p.side * C.BALL_GRAV * 0.42, mods: { speed: 0.85 } });
      },
    }),
  strike: mk('strike', 'סטרייק', 'הבעיטה המהירה במשחק. מי שחוסם אותה משותק ל-0.9 שניות.',
    '#7b5cff', '#d9c9ff', '⚡', 'shot', 'attack', 'striker', 0.9, {
      fire(ctx) { launch(ctx, 1.3); },
      flight: flatFlight,
      afterBlock(pw, q, m) { modsOn(m, 'strike', pw.owner, q.index, 0.9, { frozen: true }); },
    }),

  // ── נבחרת (19-27): control of the other player ───────────────────────────
  reverse: mk('reverse', 'בלבול', 'השליטה של היריב מתהפכת ל-3.5 שניות: ימין הוא שמאל.',
    '#ff66ff', '#ffd1ff', '🔄', 'effect', 'any', 'brawler', 3.5, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'reverse', p.index, foe.index, 3.5, { reverse: true }); },
    }),
  freeze: mk('freeze', 'הקפאה', 'היריב קופא במקום ל-0.75 שניות — לא זז, לא קופץ, לא בועט — והכדור מוקפץ אליך.',
    '#8fe9ff', '#e6fbff', '❄️', 'effect', 'any', 'striker', 0.75, {
      fire(ctx) { const { m, p, foe, b } = ctx; pop(ctx); modsOn(m, 'freeze', p.index, foe.index, 0.75, { frozen: true }); },
    }),
  meteor: mk('meteor', 'מטאור', 'הכדור עף עד השמיים וצולל משם ישר לתוך השער.',
    '#ff5a1f', '#ffc49a', '☄️', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.0, { phase: 0, life: C.POWER_SHOT_LIFE + 0.6 }); },
      flight(pw, b) {
        const S = shotSpeed(pw.k);
        if (pw.phase === 0) {
          b.vx = pw.dir * S * 0.3; b.vy = -S * 1.25;
          if (b.y <= C.CEIL_Y + 60 || pw.t > 0.55) {
            pw.phase = 1;
            const v = aimAt(b, attackLine(pw.dir) + pw.dir * 16, C.GROUND_Y - C.GOAL_H * 0.45, S * 1.1);
            pw.dvx = v.vx; pw.dvy = v.vy;
          }
        } else { b.vx = pw.dvx; b.vy = pw.dvy; }
      },
    }),
  drain: mk('drain', 'גניבת כוח', 'גונב את כל מד הכוח של היריב (60% ממנו עובר אליך), מבטל לו כוחות פעילים וחוסם לו טעינה ל-5 שניות.',
    '#00d68f', '#b3ffe3', '🫳', 'effect', 'any', 'brawler', 5, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        const stolen = foe.gauge;
        foe.gauge = 0;
        if (foe.armed > 0) { foe.armed = 0; m.events.push({ type: 'ultimateCleared', player: foe.index }); }
        p.gauge = Math.min(1, p.gauge + stolen * 0.6);
        const fx = m.champ.effects;
        for (let i = fx.length - 1; i >= 0; i--) if (fx[i].owner === foe.index) fx.splice(i, 1);
        modsOn(m, 'drain', p.index, foe.index, 5, { meterLock: true });
        m.events.push({ type: 'drained', player: p.index, amount: stolen });
        strike(ctx);
      },
    }),
  quake: mk('quake', 'רעידת אדמה', 'האדמה רועדת: היריב נזרק לאוויר בלי שליטה, והכדור קופץ קדימה.',
    '#c08b5c', '#f0d2b4', '🌋', 'effect', 'any', 'brawler', 0.9, {
      fire(ctx) {
        const { m, p, foe, b, kit } = ctx;
        foe.vy = -C.JUMP_V * 1.25;
        foe.vx = (Math.sign(foe.x - b.x) || foe.side) * C.TACKLE_PUSH * 0.6;
        foe.onGround = false; foe.dashT = 0;
        kit.damage(m, foe, 0.1);
        modsOn(m, 'quake', p.index, foe.index, 0.9, { frozen: true });
        b.power = null;
        b.vx = p.side * C.KICK_POWER * 0.6;
        b.vy = -C.KICK_LIFT * 1.5;
        m.events.push({ type: 'quake', player: p.index });
      },
    }),
  trampoline: mk('trampoline', 'טרמפולינה', 'ל-6 שניות הכדור קופץ מהדשא בלי לאבד גובה — קשה מאוד לשלוט בו.',
    '#ffe14a', '#fff6c2', '🤸', 'effect', 'any', 'striker', 6, {
      fire(ctx) { const { m, p, b } = ctx; pop(ctx, 1.4); fieldFor(m, 'trampoline', p.index, 6, { bounce: 1.0 }); },
    }),
  stutter: mk('stutter', 'עצור וסע', 'הבעיטה נעצרת באוויר לחצי שנייה — ואז מזנקת במהירות כפולה כמעט.',
    '#ff9f1c', '#ffe0b0', '⏯️', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.0, { life: C.POWER_SHOT_LIFE + 0.44 }); },
      flight(pw, b, dt) {
        const S = shotSpeed(pw.k);
        if (pw.t < 0.28) { b.vx = pw.dir * S; b.vy = 0; }
        else if (pw.t < 0.72) { b.vx = 0; b.vy = 0; }
        else { b.vx = pw.dir * S * 1.5; b.vy += C.BALL_GRAV * C.POWER_SHOT_SAG * dt; }
      },
    }),
  ice: mk('ice', 'רצפת קרח', 'הרצפה של היריב הופכת לקרח ל-3 שניות: קשה לו להתחיל לזוז וקשה לו לעצור.',
    '#b8f0ff', '#ffffff', '🧊', 'effect', 'any', 'brawler', 3, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'ice', p.index, foe.index, 3, { accel: 0.3, friction: 0.992, noDash: true }); },
    }),
  portal: mk('portal', 'פורטל', 'היריב נשאב לפורטל ומופיע בקו האמצע — והשער שלו נשאר ריק.',
    '#6a5cff', '#cfc9ff', '🌀', 'effect', 'attack', 'striker', 0, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        // A short record of the jump, for the renderer: it changes no rule (no mods, no field),
        // but without it the rift has nothing to draw from once the foe has already moved.
        addEffect(m, { type: 'mods', power: 'portal', owner: p.index, target: null, life: 0.6, mods: null, field: null,
          fromX: foe.x, fromY: foe.y });
        foe.x = C.W / 2 - p.side * 40;
        foe.y = C.GROUND_Y; foe.vx = 0; foe.vy = 0; foe.onGround = true; foe.dashT = 0;
        // …and the pose the rest of this tick's ball sub-steps sweep from. Left at the old
        // spot, they would sweep the body clean across the pitch and through the ball.
        foe.x0 = foe.x; foe.y0 = foe.y;
        m.events.push({ type: 'teleport', player: foe.index });
        strike(ctx);
      },
    }),

  // ── אלופים (28-36): shots with a second phase, and the rules of the pitch ─
  boomerang: mk('boomerang', 'בומרנג', 'הכדור עף אחורה וגבוה, מסתובב, וחוזר לשער במהירות גבוהה.',
    '#ffcf5c', '#fff0c4', '🪃', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.0, { life: C.POWER_SHOT_LIFE + 0.9 }); },
      flight(pw, b) {
        const S = shotSpeed(pw.k);
        const out = { vx: -pw.dir * S * 0.55, vy: -S * 0.85 };
        if (pw.t < 0.34) { b.vx = out.vx; b.vy = out.vy; return; }
        // Aimed from where the ball IS, every tick of the swing, then locked. Aimed once at its
        // start, the swing's blend of the two velocities carried the ball off that line and
        // over the bar — the return never scored.
        // Mid-mouth, where a keeper who read the swing can meet it with his head — under the bar
        // it was unanswerable, and stage 28 measured as the hardest stage in its tier by far.
        if (pw.ty == null) pw.ty = C.GROUND_Y - C.GOAL_H * 0.42;
        const k = clamp((pw.t - 0.34) / 0.16, 0, 1);         // the swing round
        if (!pw.locked) {
          pw.ret = aimAt(b, attackLine(pw.dir) + pw.dir * 16, pw.ty, S * 1.5);
          if (k >= 1) pw.locked = true;
        }
        b.vx = lerp(out.vx, pw.ret.vx, k); b.vy = lerp(out.vy, pw.ret.vy, k);
      },
    }),
  drill: mk('drill', 'מקדחה', 'בעיטה שקודחת דרך החסימה הראשונה: החוסם נפגע והכדור ממשיך לשער.',
    '#c0c7d6', '#ffffff', '🔩', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.05, { drill: 1 }); },
      flight: flatFlight,
      block(pw, q, b, m, kit, fx) {
        if (!(pw.drill > 0)) return false;
        pw.drill--;
        kit.damage(m, q, C.POWER_DAMAGE * 0.8);
        q.vy = -C.TACKLE_LIFT * 1.2; q.vx = pw.dir * C.TACKLE_PUSH * 0.5; q.onGround = false;
        const to = q.x + pw.dir * (kit.headR(m, q) + b.r + 6);
        b.x = kit.keepOutOfGoal(b.x, b.y, to, b.y, b.r);
        pw.k *= 0.75;
        pw.ghostOf = q.index; pw.ghostT = pw.t + 0.14;     // through them, not into them again
        m.events.push({ type: 'drilled', player: pw.owner, on: q.index });
        fx.shockwave(b.x, b.y, pw.color);
        return true;
      },
    }),
  goalmagnet: mk('goalmagnet', 'מגנט שער', 'השער של היריב מושך אליו את הכדור ל-3.5 שניות.',
    '#ff3b3b', '#ffb3b3', '🥅', 'effect', 'attack', 'striker', 3.5, {
      fire(ctx) {
        const { m, p, b } = ctx;
        strike(ctx, 0.9, 0.6);
        addEffect(m, { type: 'pull', power: 'goalmagnet', owner: p.index, target: null, life: 3.5, to: 'goal', k: C.BALL_GRAV * 0.9, range: 560 });
      },
    }),
  keeperpull: mk('keeperpull', 'שאיבה', 'היריב נגרר אל מרכז המגרש ל-2.5 שניות, רחוק מהשער שלו.',
    '#5dd39e', '#c9f5e1', '🌪️', 'effect', 'attack', 'striker', 2.5, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        strike(ctx);
        addEffect(m, { type: 'drag', power: 'keeperpull', owner: p.index, target: foe.index, life: 2.5, rate: 175, mods: { speed: 0.8 } });
      },
    }),
  vampire: mk('vampire', 'ערפד', 'שואב 45% מהבריאות של היריב אליך, וההחלמה שלו נעצרת ל-5 שניות.',
    '#b3001b', '#ff8fa3', '🧛', 'effect', 'any', 'brawler', 5, {
      fire(ctx) {
        const { m, p, foe, b, kit } = ctx;
        const dealt = kit.damage(m, foe, 0.45);
        p.hp = Math.min(1, p.hp + dealt);
        modsOn(m, 'vampire', p.index, foe.index, 5, { regen: 0 });
        strike(ctx);
      },
    }),
  superboot: mk('superboot', 'בעיטת על', 'ל-6 שניות כל בעיטה ונגיחה שלך חזקה פי 1.5, והכדור טס מהר יותר.',
    '#ffd700', '#fff5b3', '👟', 'effect', 'attack', 'striker', 6, {
      fire(ctx) { const { m, p, b } = ctx; strike(ctx, 1.3, 0.7); modsOn(m, 'superboot', p.index, p.index, 6, { kick: 1.5 }, { maxSpeed: 1.35 }); },
    }),
  woolshoes: mk('woolshoes', 'נעלי צמר', 'ל-6 שניות הבעיטות והנגיחות של היריב חלשות פי שניים.',
    '#e8c8ff', '#faf0ff', '🧶', 'effect', 'defend', 'keeper', 6, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'woolshoes', p.index, foe.index, 6, { kick: 0.45 }); },
    }),
  homing: mk('homing', 'טיל מונחה', 'טיל שמתביית על החלק בשער שהשוער הכי רחוק ממנו: גבוה אם הוא על הרצפה, נמוך אם קפץ.',
    '#ff2e63', '#ffb3c7', '🎯', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.1); },
      flight(pw, b, dt, m, kit) {
        const S = shotSpeed(pw.k);
        const q = m.players[1 - pw.owner];
        const airborne = kit.headY(q) < headYAt(C.GROUND_Y) - 10;
        const ty = airborne ? C.GROUND_Y - b.r - 6 : barTop() + b.r + 14;
        const want = Math.atan2(ty - b.y, attackLine(pw.dir) + pw.dir * 20 - b.x);
        let cur = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : want;
        let d = want - cur;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        cur += clamp(d, -3.4 * dt, 3.4 * dt);
        b.vx = Math.cos(cur) * S; b.vy = Math.sin(cur) * S;
      },
    }),
  gravflip: mk('gravflip', 'היפוך כבידה', 'ל-2.5 שניות הכדור נופל למעלה — עד התקרה, ומשם חזרה למטה.',
    '#9d4edd', '#e0c3fc', '🙃', 'effect', 'any', 'keeper', 2.5, {
      fire(ctx) { const { m, p, b } = ctx; pop(ctx, 0.8); fieldFor(m, 'gravflip', p.index, 2.5, { ballGrav: -1 }); },
    }),

  // ── אגדות (37-45): several moving parts at once ──────────────────────────
  mirror: mk('mirror', 'מראה', 'מראה חד-כיוונית בחצי שלך ל-6 שניות. הכדור הראשון שחוצה אותה לכיוון השער שלך חוזר כבעיטת כוח שלך.',
    '#d0f4ff', '#ffffff', '🪞', 'effect', 'defend', 'keeper', 6, {
      fire(ctx) {
        const { m, p, b } = ctx;
        strike(ctx, 1.05, 0.8);
        addEffect(m, { type: 'mirror', power: 'mirror', owner: p.index, target: null, life: 6, x: C.W / 2 - p.side * 130 });
      },
      flight: flatFlight,
    }),
  teleport: mk('teleport', 'שיגור', 'הכדור נעלם ומופיע מול השער של היריב, כבר בדרך פנימה.',
    '#00f5d4', '#b8fff4', '🛸', 'shot', 'attack', 'striker', 0, {
      fire(ctx) {
        const { b, p } = ctx;
        const dest = { x: attackLine(p.side) - p.side * 190, y: C.GROUND_Y - C.GOAL_H * 0.5 - 6 };
        launch(ctx, 1.05, { hidden: true, life: C.POWER_SHOT_LIFE + 0.38, src: { x: b.x, y: b.y } });
        b.x = dest.x; b.y = dest.y; b.vx = 0; b.vy = 0;
      },
      flight(pw, b, dt) {
        if (pw.t < 0.38) { b.vx = 0; b.vy = 0; return; }
        pw.hidden = false;
        flatFlight(pw, b, dt);
      },
    }),
  carry: mk('carry', 'דבק', 'הכדור נדבק לנעל שלך עד 3 שניות ואתה רץ מהר יותר. בעיטה משחררת אותו כבעיטת כוח; תיקול או מגע של היריב משחררים אותו.',
    '#ff85a1', '#ffd6e0', '🍯', 'effect', 'attack', 'striker', 3, {
      fire(ctx) { const { m, p, b } = ctx; b.power = null; addEffect(m, { type: 'carry', power: 'carry', owner: p.index, target: p.index, life: 3, mods: { speed: 1.2 } }); },
      flight: flatFlight,
    }),
  phantom: mk('phantom', 'רוח רפאים', 'בעיטה שעוברת דרך הגוף של היריב. רק בעיטת קאונטר בזמן יכולה לעצור אותה.',
    '#e0e0ff', '#ffffff', '👻', 'shot', 'attack', 'striker', 0, {
      fire(ctx) { launch(ctx, 1.05, { phantom: true }); },
      flight: flatFlight,
    }),
  timeslow: mk('timeslow', 'הילוך איטי', 'היריב נכנס להילוך איטי ל-3.5 שניות: הכול אצלו קורה בחצי מהירות.',
    '#7209b7', '#d7a8f5', '🐢', 'effect', 'any', 'striker', 3.5, {
      fire(ctx) { const { m, p, foe, b } = ctx; strike(ctx); modsOn(m, 'timeslow', p.index, foe.index, 3.5, { time: 0.45 }); },
    }),
  clone: mk('clone', 'שכפול', 'שכפול שלך שומר על השער שלך 6 שניות: זז, קופץ וחוסם גם כדורי כוח.',
    '#4ea0ff', '#c9e2ff', '👥', 'effect', 'defend', 'keeper', 6, {
      fire(ctx) {
        const { m, p, b } = ctx;
        strike(ctx, 1.0, 0.9);
        addEffect(m, { type: 'clone', power: 'clone', owner: p.index, target: null, life: 6,
          x: ownLine(p.side) + p.side * 60, y: C.GROUND_Y, vx: 0, vy: 0, onGround: true });
      },
    }),
  split: mk('split', 'פיצול', 'הבעיטה מתפצלת לשלושה כדורי כוח: ישר, גבוה ונמוך. כל אחד מהם יכול להבקיע.',
    '#ff006e', '#ffb3d1', '🔱', 'shot', 'attack', 'striker', 1.8, {
      fire(ctx) { launch(ctx, 1.0); },
      flight(pw, b, dt, m) {
        const S = shotSpeed(pw.k);
        if (pw.slope != null) { b.vx = pw.dir * S; b.vy = pw.slope; return; }
        flatFlight(pw, b, dt);
        if (!pw.split && pw.t >= 0.15) {
          pw.split = true;
          for (const slope of [-0.32 * S, 0.2 * S]) {
            m.champ.balls.push({ x: b.x, y: b.y, vx: b.vx, vy: slope, r: b.r, spin: b.spin,
              power: { ...pw, t: 0, life: 1.8, slope, split: true, extra: true } });
          }
          m.events.push({ type: 'split', player: pw.owner });
        }
      },
    }),
  tornado: mk('tornado', 'טורנדו', 'טורנדו חוצה את המגרש לשער היריב: מרים ונושא את הכדור, זורק את היריב, ובשער יורה את הכדור פנימה.',
    '#94d2bd', '#e9f5f2', '🌪', 'effect', 'attack', 'striker', 3.6, {
      fire(ctx) {
        const { m, p, b } = ctx;
        b.power = null;
        b.vx = p.side * 200; b.vy = -150;
        addEffect(m, { type: 'tornado', power: 'tornado', owner: p.index, target: null, life: 3.6,
          x: b.x, dir: p.side, speed: 210, hitCd: 0, caught: false });
      },
      flight: flatFlight,
    }),
  timestop: mk('timestop', 'עצירת זמן', 'הזמן נעצר ל-2.2 שניות ליריב ולכדור. אתה חופשי לזוז ולבעוט — וכשהזמן חוזר, הבעיטה יוצאת כבעיטת כוח והיריב מתעשת באיחור.',
    '#f8f9fa', '#ffffff', '⏱️', 'effect', 'any', 'striker', 2.2, {
      fire(ctx) {
        const { m, p, foe, b } = ctx;
        // Hung in the air just in front of the face — clear of it, so the ball is something to
        // walk up to and strike rather than a contact the head resolves on every held tick.
        clearOfHead(ctx, (hr) => hr + b.r + 6, () => -6);
        b.power = null; b.vx = 0; b.vy = 0;
        addEffect(m, { type: 'timestop', power: 'timestop', owner: p.index, target: foe.index, life: 2.2,
          mods: { stopped: true }, at: { x: b.x, y: b.y }, stored: null });
      },
      flight: flatFlight,
    }),
};

export const POWER_ORDER = [
  'cannon', 'tentacles', 'blaze', 'mud', 'goalwall', 'coins', 'spring', 'magnet', 'wave',
  'giant', 'shrink', 'lowgrav', 'rising', 'turbo', 'heavy', 'skip', 'wind', 'strike',
  'reverse', 'freeze', 'meteor', 'drain', 'quake', 'trampoline', 'stutter', 'ice', 'portal',
  'boomerang', 'drill', 'goalmagnet', 'keeperpull', 'vampire', 'superboot', 'woolshoes', 'homing', 'gravflip',
  'mirror', 'teleport', 'carry', 'phantom', 'timeslow', 'clone', 'split', 'tornado', 'timestop',
];

// The effect types a power can leave behind, for the tests and the renderer.
export const EFFECT_TYPES = Object.keys(EFFECTS);

// ═══════════════════════════════════════════════════════════════════════════
// THE ENGINE — called by sim.js, and only when m.champ exists.
// ═══════════════════════════════════════════════════════════════════════════

// The touch. sim.js has already cleared `armed` and the gauge, exactly as for the ordinary
// ultimate, so this cannot run twice for one arm.
export function firePower(m, p, b, kit, fx) {
  const power = POWERS[p.champ.power];
  const foe = m.players[1 - p.index];
  const countered = !!b.power;
  b.power = null;                                   // an incoming shot is converted, not absorbed
  power.fire({ m, p, foe, b, kit, fx, power });
  m.events.push({ type: 'powershot', player: p.index, shot: p.shot.id, ultimate: true, countered, champ: power.id });
  fx.shockwave(b.x, b.y, power.color);
}

// Once a tick, before the players move: age the effects, rebuild the mods and the field from
// what is left, then let the moving effects move.
export function champPreStep(m, dt, kit, fx) {
  const S = m.champ;
  for (let i = S.effects.length - 1; i >= 0; i--) {
    const e = S.effects[i];
    e.t += dt;
    if (e.t < e.life) continue;
    S.effects.splice(i, 1);
    const T = EFFECTS[e.type];
    if (T.end) T.end(e, m, kit, fx);
    m.events.push({ type: 'effectEnd', power: e.power, player: e.owner });
  }
  for (const p of m.players) resetMods(p.mods);
  resetField(S.field);
  for (const e of S.effects) {
    if (e.mods && e.target != null) applyMods(m.players[e.target].mods, e.mods);
    if (e.field) applyMods(S.field, e.field);
    const T = EFFECTS[e.type];
    if (T.field) T.field(e, S.field, m);
  }
  // An extra jump granted while standing is usable on THIS jump, not only after a landing.
  for (const p of m.players) {
    if (p.mods.airJumps > 0 && p.onGround) p.jumps = Math.max(p.jumps, C.MAX_JUMPS + p.mods.airJumps);
  }
  for (const e of [...S.effects]) {
    const T = EFFECTS[e.type];
    if (T.step) T.step(e, m, dt, kit, fx);
  }
}

// What a player's buttons mean while their mods say otherwise.
const NO_INPUT = Object.freeze({ left: false, right: false, jump: false, kick: false, power: false });
export function champInput(md, input) {
  if (md.frozen) return NO_INPUT;
  if (md.reverse) return { ...input, left: !!input.right, right: !!input.left };
  return input;
}

// Forces on a loose ball, after gravity. Called from stepBall's unpowered branch.
export function champBallForces(m, b, dt) {
  const F = m.champ.field;
  if (F.windX) b.vx += F.windX * dt;
  for (const q of F.pulls) {
    const dx = q.x - b.x, dy = q.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > q.range || d < 1) continue;
    b.vx += dx / d * q.k * dt;
    b.vy += dy / d * q.k * dt;
    if (q.hold && d < 70) { b.vx *= 0.94; b.vy *= 0.94; }  // settles at the boot instead of orbiting it
  }
}

export function ballGravMul(m) { return m.champ.field.ballGrav; }

// A champion shot's flight, in place of stepPowerShot. True while the shot owns the ball.
export function champFlight(m, b, dt, fx, kit) {
  const pw = b.power;
  pw.t += dt;
  if (pw.t >= pw.life) { b.power = null; return false; }
  const P = POWERS[pw.champ];
  (pw.flat ? flatFlight : P.flight)(pw, b, dt, m, kit);
  if (!pw.hidden) fx.trail(b.x, b.y, pw.color, 3);
  return true;
}

// Does this ball pass through this player on this sub-step?
export function champSkipContact(m, b, p) {
  const pw = b.power;
  if (!pw) return false;
  if (pw.hidden) return true;                              // the teleport, between portals
  if (pw.phantom && pw.owner !== p.index) return true;    // the ghost shot
  if (pw.ghostOf === p.index && pw.t < pw.ghostT) return true;   // the drill, just through them
  return false;
}

// A champion shot met a defender. True = the power dealt with it and the ordinary block must
// not run; false = the ordinary block runs (and afterBlock after it).
export function champBlock(m, q, b, kit, fx) {
  const P = POWERS[b.power.champ];
  return !!(P.block && P.block(b.power, q, b, m, kit, fx));
}
export function champAfterBlock(m, pw, q, kit, fx) {
  const P = POWERS[pw.champ];
  if (P.afterBlock) P.afterBlock(pw, q, m, kit, fx);
}

// Every barrier, once per ball sub-step, after the walls of the pitch and before the goal test.
export function champBarriers(m, b, kit, fx, fromX, fromY) {
  for (const e of m.champ.effects) {
    const T = EFFECTS[e.type];
    if (T.barrier) T.barrier(e, b, m, kit, fx, fromX, fromY);
  }
}

// Before the ball's sub-steps: the carry pins the ball to the boot, or lets it go.
export function champBallPre(m, b, kit, fx) {
  const F = m.champ.field;
  const e = F.carry;
  if (!e || b !== m.ball) return;
  const p = m.players[e.owner];
  // Kick pressed: a swing, or — with the ball this close to the head — a header, which is the
  // branch the sim actually takes. Either one is the carrier letting go.
  const kicked = m.events.some((ev) => (ev.type === 'kick' || ev.type === 'strike') && ev.player === e.owner);
  if (kicked || p.stunned > 0) {
    endEffect(m, e);
    if (kicked) {
      relaunch(m, b, p, 'carry', 1.25, kit);
      m.events.push({ type: 'released', player: e.owner });
      fx.shockwave(b.x, b.y, POWERS.carry.color);
    }
    return;
  }
  const toX = clamp(p.x + p.side * (C.BODY_W / 2 + b.r + 8), b.r + C.POST_R, C.W - b.r - C.POST_R);
  const toY = Math.min(p.y - b.r, C.GROUND_Y - b.r);
  b.x = kit.keepOutOfGoal(b.x, b.y, toX, toY, b.r);
  b.y = toY;
  b.vx = p.vx; b.vy = 0; b.power = null;
  m.idle = 0;
}

// After the ball's sub-steps: time stop banks any strike and puts the ball back where time
// left it; the carry lets go if the other player got a body on the ball or tackled the carrier.
export function champBallPost(m, b, kit) {
  const F = m.champ.field;
  if (F.hold && b === m.ball) {
    const e = F.hold;
    // Bank the hardest thing done to it, not the latest: walking into the ball after heading it
    // must not trade the header for a nudge.
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 60 && (!e.stored || sp > Math.hypot(e.stored.vx, e.stored.vy))) e.stored = { vx: b.vx, vy: b.vy };
    b.x = e.at.x; b.y = e.at.y; b.vx = 0; b.vy = 0;
    m.idle = 0;
  }
  const c = F.carry;
  if (c && b === m.ball) {
    const q = m.players[1 - c.owner];
    const tackled = m.events.some((ev) => ev.type === 'tackle' && ev.on === c.owner);
    const nx = clamp(b.x, q.x - C.BODY_W / 2, q.x + C.BODY_W / 2);
    const ny = clamp(b.y, q.y - C.BODY_H, q.y);
    const touched = Math.hypot(b.x - q.x, b.y - kit.headY(q)) < kit.headR(m, q) + b.r + 2 ||
                    Math.hypot(b.x - nx, b.y - ny) < b.r + 2;
    if (tackled || touched) {
      endEffect(m, c);
      if (tackled) b.vy = -220;
      m.events.push({ type: 'stolen', player: q.index });
    }
  }
}

function endEffect(m, e) {
  e.life = e.t;
  const S = m.champ;
  if (S.field.carry === e) S.field.carry = null;
  if (S.field.hold === e) S.field.hold = null;
}

// A goal, or full time: every power in play ends. Arms and meters are NOT touched here — those
// follow the ordinary ultimate's rules in sim.js, which a goal does not reset.
export function champClear(m) {
  const S = m.champ;
  S.effects.length = 0;
  S.balls.length = 0;
  resetField(S.field);
  for (const p of m.players) resetMods(p.mods);
}

// Is `index` carrying the ball right now? The bot asks, so it walks it at the goal.
export function carrying(m, index) {
  const c = m.champ && m.champ.field.carry;
  return !!c && c.owner === index && c.t < c.life;
}
// Is `index` the one who stopped time? The bot keeps playing through it.
export function activeEffect(m, powerId) {
  return m.champ ? m.champ.effects.find((e) => e.power === powerId && e.t < e.life) || null : null;
}
