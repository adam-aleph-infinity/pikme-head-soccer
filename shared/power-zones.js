// POWER ZONES — what a champion's power leaves ON THE PITCH: a grill strip burning on the grass, a
// splat of melted chocolate, a fence of giant ice pops in front of a goal. A zone outlives the shot
// that made it (the shot can be blocked, or score) and acts on its own: it marks whoever stands in
// it with an ailment, or it stops a ball.
//
// Zones live on the match (m.zones), every field a plain scalar, so serialize() copies them whole
// and an online client restored mid-zone plays the same pitch. A goal, a restart or full time
// clears them, as it clears a Multi-Ball's extra balls.
//
// ROLLBACK RULES, as in hs-powers.js: this is sim code — no Math.random / sin / cos / tan.
//
// A zone: { k: kind, cp: the power that made it (its renderer draws it), own: the shooter's index,
//   x0, x1 (its span on the pitch, px), y (a height where the kind needs one), t (s alive),
//   life (s it lasts), grow (1 while it still follows its ball), and the kind's own numbers }.
//   kinds: 'strip'  — on the grass from x0 to x1: an opponent standing on it gets `ail` for `ailS`
//          'splat'  — the same, landing `land` s after it is made (nothing sticks before then)
//          'fence'  — a wall at x0, `h` px tall from the grass, that turns back any ball moving
//                     toward the goal behind it (`dir`: the way that goal lies); players pass through
//          'shell'  — a cannon shell in flight at (x0, y), `spd` px/s along `dir`: not a ball (it
//                     never scores, nothing kicks it about); the opponent it meets is hit by it —
//                     the power hit (its daze cut to `daze` s if set) — unless his boot meets it
//                     on the swing up, which parries it.
//                     It bursts on the goal line. (The Cannoneer's barrage, champion-powers/stage-01.js)

import * as C from './constants.js';
import { applyAilment, hitBody, headless } from './hs-powers.js';
import { bootPose } from './kick.js';

const SX = C.HS_STRETCH;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// A parried shell's kick back on the boot: a nudge toward his own goal (≈ 40 px), no daze.
export const SHELL = Object.freeze({ PARRY_V: 330, PARRY_T: 0.15 });

export const MAX_ZONES = 6;

export function addZone(m, z) {
  if (!m || !m.zones) return null;          // the bot's look-ahead runs flights on a fake match
  const o = { k: 'strip', cp: '', own: 0, x0: 0, x1: 0, y: 0, t: 0, life: 1, grow: 0, ail: '', ailS: 0, land: 0, h: 0, dir: 1, hits: 0, ...z };
  m.zones.push(o);
  if (m.zones.length > MAX_ZONES) m.zones.shift();
  m.events.push({ type: 'zone', k: o.k, cp: o.cp, own: o.own, x0: o.x0, x1: o.x1 });
  return o;
}

export const clearZones = (m) => { if (m.zones) m.zones.length = 0; };

// Is player p standing on the grass inside the zone's span?
const onIt = (z, p) => {
  const lo = Math.min(z.x0, z.x1), hi = Math.max(z.x0, z.x1);
  return p.onGround && p.y >= C.GROUND_Y - 1 && p.x + C.BODY_W / 2 > lo && p.x - C.BODY_W / 2 < hi;
};

// What of player p a shell of radius r at (x, y) meets, as the ball's contacts judge it (sim.js
// resolveBallPlayers, in HS's stretched space): 'parry' — the boot, on the swing up (BLOCK_SWING);
// 'hit' — the head, the body, or the boot held out at the top; '' — nothing.
function shellMeets(p, x, y, r, kit) {
  if (p.kickT > C.KICK_TIME * 0.08) {
    const dir = p.kickDir || p.side, k = (C.KICK_TIME - p.kickT) / C.KICK_TIME, pose = bootPose(k);
    const br = r * (1 + SX) / 2, bx = p.x + dir * pose[0] * C.HEAD_R, by = p.y - pose[1] * C.HEAD_R;
    if (Math.hypot(x - bx, y - (br - r) - by) < C.BOOT_R + br && dir * (x - p.x) > C.BODY_W / 2) return k <= C.BLOCK_SWING ? 'parry' : 'hit';
  }
  if (!headless(p) && Math.hypot((x - p.x) / SX, y - kit.headY(p)) < C.HEAD_R + r) return 'hit';
  const hw = C.BODY_W / 2, cx = x / SX;
  const nx = clamp(cx, (p.x - hw) / SX, (p.x + hw) / SX), ny = clamp(y, p.y - C.BODY_H, p.y);
  return Math.hypot(cx - nx, y - ny) < r ? 'hit' : '';
}

// A shell's tick: on along its line in slices no longer than half a head (it crosses 36 px a tick),
// and the first thing it meets ends it. Returns true when it is gone.
function stepShell(m, z, dt, kit) {
  const n = Math.max(1, Math.ceil((z.spd * dt) / (C.HEAD_R * 0.5))), r = C.BALL_R;
  const line = z.dir > 0 ? C.W - C.GOAL_W + r : C.GOAL_W - r;            // half a ball into the mouth
  for (let s = 0; s < n; s++) {
    z.x0 += (z.dir * z.spd * dt) / n; z.x1 = z.x0;
    for (const p of m.players) {
      if (p.index === z.own) continue;
      const how = shellMeets(p, z.x0, z.y, r, kit);
      if (!how) continue;
      z.hits++;
      if (how === 'parry') {
        m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
        p.vx = z.dir * SHELL.PARRY_V; p.shoved = Math.max(p.shoved || 0, SHELL.PARRY_T);
        m.events.push({ type: 'shellParry', player: p.index, by: z.own, cp: z.cp, x: z.x0, y: z.y, dir: z.dir });
      } else {
        // the power hit, exactly a power ball's: thrown, dazed, the face marked — the arm kept
        hitBody(m, p, { x: z.x0, y: z.y }, { owner: z.own, dir: z.dir, fam: 'straight', cp: z.cp, ail: '', int: 0.5 }, kit, 'shell');
        // (a shell's own daze, shorter than a power ball's, where its power sets one)
        if (z.daze) { p.stunned = Math.min(p.stunned, z.daze); if (p.ail === 'stars') p.ailT = Math.min(p.ailT, z.daze); }
      }
      return true;
    }
    if ((z.x0 - line) * z.dir >= 0 || z.x0 < r || z.x0 > C.W - r) {
      m.events.push({ type: 'shellBurst', cp: z.cp, own: z.own, x: z.x0, y: z.y, dir: z.dir });
      return true;
    }
  }
  return false;
}

// Once a tick, in play: age every zone, drop the spent ones, and let the strips and splats mark
// whoever stands in them. A strip that still `grow`s follows its own power ball's nose; a shell
// flies (`kit`: what the sim lets a power reach — headY, stun).
export function stepZones(m, dt, kit) {
  if (!m.zones || !m.zones.length) return;
  for (let i = m.zones.length - 1; i >= 0; i--) {
    const z = m.zones[i];
    z.t += dt;
    if (z.t >= z.life) { m.zones.splice(i, 1); continue; }
    if (z.k === 'shell') { if (stepShell(m, z, dt, kit)) m.zones.splice(i, 1); continue; }
    if (z.grow) {
      const b = m.ball, pw = b.power;
      if (pw && pw.cp === z.cp && pw.owner === z.own && pw.strip) z.x1 = b.x;
      else z.grow = 0;
    }
    if (z.k !== 'strip' && z.k !== 'splat') continue;
    if (z.t < z.land) continue;
    for (const p of m.players) {
      if (p.index === z.own || !onIt(z, p)) continue;
      // standing in it keeps it on him (a quiet top-up, no event every tick), stepping in puts it on
      if (p.ail === z.ail) { if (p.ailT < z.ailS * 0.5) p.ailT = z.ailS * 0.5; continue; }
      if (applyAilment(m, p, z.ail, z.ailS)) { z.hits++; m.events.push({ type: 'zoneHit', player: p.index, cp: z.cp, k: z.k, ail: z.ail }); }
    }
  }
}

// A ball's slice of travel from (fromX) to where it is now: a fence turns it back if it went
// through the fence's line toward the goal behind it, low enough to meet the pops. Called by
// sim.js stepBall after every slice, for the match ball and the extra balls alike.
export function zoneBall(m, b, fromX) {
  if (!m.zones || !m.zones.length) return false;
  let hit = false;
  for (const z of m.zones) {
    if (z.k !== 'fence') continue;
    const x = z.x0, toward = (b.x - fromX) * z.dir;
    if (!(toward > 0)) continue;
    // crossed (or touched) its line this slice, from the field side
    const before = (x - fromX) * z.dir, after = (x - b.x) * z.dir;
    if (!(before >= -1 && after < b.r)) continue;
    if (b.y < C.GROUND_Y - z.h - b.r * 0.6) continue;      // over the top of the pops
    b.x = x - z.dir * (b.r + 1);
    b.vx = -z.dir * Math.max(260, Math.abs(b.vx) * 0.45);
    b.vy = Math.min(b.vy, -120);
    // a power ball that meets the fence is spent, as one that meets the goal frame is
    if (b.power) b.power = null;
    z.hits++;
    m.events.push({ type: 'fenceHit', cp: z.cp, own: z.own, x: b.x, y: b.y, dir: z.dir });
    hit = true;
  }
  return hit;
}
