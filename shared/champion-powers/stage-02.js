// STAGE 2 — אדון התולעים, LORD OF THE WORMS (a coiled green snake; the card: Ori screaming in a pit
// of red-eyed brown worms). An ORIGINAL power (docs/CHAMPION-POWERS.md §1c, redesigned with Idan
// 2026-10-13).
//
// WORM TUNNEL AMBUSH: pressing POWER turns the snake into her worm form (drawn:
// public/vfx/powers/stage-02.js — the sim does not change the arm). Her touch is the shared cut-in,
// under which a giant worm bursts up beside her and coils round the ball; when it lets go:
//   • DIVE    the worm plunges into the turf with the ball (DIVE s);
//   • TUNNEL  under the pitch toward the other goal, a mound in the grass, its pace winding (TUNNEL s);
//   • WARN    it stops under the spot it will come up — the ring (WARN s): the ball cannot be touched
//             in any of these three, and nobody can score with it;
//   • the LOB the worm bursts out and spits THE BALL up in a high arc that drops into the mouth — from
//             here a straight power shot: counter it armed, kick-block it (the blocker sends the whole
//             tunnel back, Idan), head it right off the ring (the early header), or take the hit
//             (thrown, dazed, coiled: half speed, no dash, COIL s from the hit).
//   • STOMP   on the ring with KICK pressed in the STOMP s before it bursts: smothered, the ball pops
//             up loose — no hit, no shot. Only standing there is no answer (Idan, 2026-10-13: too easy):
//             the burst shoves him aside (no daze) and the lob goes on through.
// Where it comes up is fixed at the touch, from where she touched it (no randomness: the same on
// every screen), NEAR–FAR px out from the goal line, never nearer than MIN_LINE.
// The shooter is free to move (no `holds`); a fire-back (src ≠ owner) starts with GRAB s of the worm
// taking the ball off the blocker, there being no cut-in for it.
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const WORM = Object.freeze({
  GRAB: 0.3,        // s a fire-back's worm takes the ball (the touch's own grab is under the cut-in)
  DIVE: 0.28,       // s down into the turf
  TUNNEL: 0.9,      // s under the pitch, whatever the distance
  WARN: 0.45,       // s held under the ring before it bursts (the telegraph rule: 0.2–0.7)
  AHEAD: 24,        // px past the release point it goes down
  NEAR: 260, FAR: 380,   // px from the goal line it comes up (by where she touched it)
  MIN_LINE: 220,    // …never nearer the line than this
  MIN_RUN: 160,     // px it tunnels at least, when there is room
  WEAVE: 0.07,      // the tunnel's winding pace (a fraction of the run, back and forth)
  APEX: 1.15,       // × a jumping head's reach: the lob's top (the ball's centre above the grass)
  APEX_AT: 0.32,    // …reached this far along: spat up fast, then a longer, floatier fall into the mouth
  LOB_T: 0.6,       // s from the burst to the goal line
  CROSS: 0.3,      // × the goal's height it crosses the line at (a standing head on the line meets it)
  RING: 1.7,        // × HEAD_R: the ring's radius round where it comes up
  STOMP: 0.15,      // s before the burst a kick pressed on the ring stomps it (smothers it)
  SMOTHER_VY: 420,  // px/s the smothered ball pops up
  SHOVE_V: 380, SHOVE_UP: 260, SHOVE_T: 0.3,   // the burst under a defender who only stood there: thrown aside, no daze
  OVER_VX: 180,     // the lob met by a crown on its way down: the power hit, and the ball pops on OVER
  OVER_VY: 195,     //   him toward the goal (px/s on, px/s up) — its pace sets the power's strength
  COIL: 1.5,        // s coiled from the hit (the daze's 0.9 s inside it: it has to outlast it to land)
});
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const UNDER = { wgrab: 1, wdive: 1, tunnel: 1, warn: 1 };
export const underground = (pw) => !!(pw && pw.wk && UNDER[pw.ph]);
// the lob's top, the ball's centre above the grass
const apexH = () => WORM.APEX * ((C.JUMP_V * C.JUMP_V) / (2 * C.PLAYER_GRAV) + C.BODY_H + 2 * C.HEAD_R - C.NECK);

// Where it comes up, from the dive point: NEAR–FAR px out by the whole px it went down at (a fixed
// spread, the same on every screen), at least MIN_RUN on from the dive, never nearer than MIN_LINE.
export function emergeX(dx, dir) {
  const gx = goalLineX(dir), D = (gx - dx) * dir;
  const f = ((Math.floor(Math.abs(dx)) * 37) % 100) / 100;
  let E = WORM.NEAR + (WORM.FAR - WORM.NEAR) * f;
  E = Math.max(WORM.MIN_LINE, Math.min(E, D - WORM.MIN_RUN));
  if (E > D) E = D;                                        // already that near: up where it went down
  return gx - dir * E;
}

// the burrow (an inert zone: power-zones.js only ages it): the mound's track on the grass, drawn
// under the players — x0 where it went down, x1 the mound, `st` the stage (0 grab/cut-in, 1 dive,
// 2 tunnel, 3 warn, 4 burst), `sk` s into it
function burrow(m, pw) {
  if (!m.zones) return null;
  for (let i = m.zones.length - 1; i >= 0; i--) { const z = m.zones[i]; if (z.k === 'burrow' && z.bid === pw.bid) return z; }
  return null;
}
function stage(m, pw, st, x) {
  const z = burrow(m, pw);
  if (z) { z.st = st; z.sk = 0; if (x != null) z.x1 = x; if (st === 4) z.life = z.t + 1.0; }
}

export default Object.freeze({
  stage: 2, id: 'wormtunnel', everywhere: true,
  family: 'straight', speed: 1, ailment: 'coiled', ailSec: WORM.COIL,
  name: 'Worm Tunnel Ambush', icon: '🪱', color: '#c0703a',
  desc: 'תולעת ענקית חופרת עם הכדור מתחת למגרש ויורקת אותו לשער! עמדו על הטבעת כדי לעצור.',
  // the ball unseen for the tunnel (a mound to read), then a lob from above; a hit coils
  diff: { speed: 0.5, disable: WORM.COIL * 0.5, above: 1 },
  answer: { kick: true, jump: true },
  ballAt: WORM.DIVE + WORM.TUNNEL + WORM.WARN,             // s after the release the ball comes up

  launch(m, b, p, pw) {
    const fb = pw.src !== pw.owner;
    pw.wk = 1; pw.ph = fb ? 'wgrab' : 'wdive'; pw.k = 0;
    pw.bx = b.x; pw.by = b.y;
    pw.dx = Math.min(C.W - C.GOAL_W - b.r, Math.max(C.GOAL_W + b.r, b.x + pw.dir * WORM.AHEAD));
    pw.ex = emergeX(pw.dx, pw.dir);
    pw.bid = (m.t || 0) + pw.owner * 1e-3;                 // its burrow's tag
    b.vx = pw.dir; b.vy = 0;                               // (held: only its heading, toward the goal)
    addZone(m, { k: 'burrow', cp: pw.cp, own: pw.owner, x0: pw.dx, x1: pw.dx, y: C.GROUND_Y, dir: pw.dir, life: 6, bid: pw.bid, ex: pw.ex, st: 0, sk: 0, fb: fb ? 1 : 0 });
  },

  step(m, b, dt, pw, S, kit, api) {
    if (!pw.wk) return undefined;
    const gy = C.GROUND_Y - b.r, z = burrow(m, pw);
    if (z) z.sk += dt;
    if (UNDER[pw.ph]) {
      b.vx = 0; b.vy = 0;
      pw.k += dt;
      if (pw.ph === 'wgrab') {
        b.x = pw.bx; b.y = pw.by;
        if (pw.k >= WORM.GRAB) { pw.ph = 'wdive'; pw.k = 0; stage(m, pw, 1); }
      } else if (pw.ph === 'wdive') {
        if (z && z.st < 1) stage(m, pw, 1);
        const u = Math.min(1, pw.k / WORM.DIVE), e = u * u * (3 - 2 * u);
        b.x = pw.bx + (pw.dx - pw.bx) * e; b.y = pw.by + (gy - pw.by) * u * u;
        if (pw.k >= WORM.DIVE) {
          pw.ph = 'tunnel'; pw.k = 0; b.x = pw.dx; b.y = gy; stage(m, pw, 2, pw.dx);
          m.events.push({ type: 'wormDive', player: pw.owner, cp: pw.cp, x: b.x, y: C.GROUND_Y, dir: pw.dir });
        }
      } else if (pw.ph === 'tunnel') {
        const u = Math.min(1, pw.k / WORM.TUNNEL), s = u + WORM.WEAVE * api.wave(2 * u);
        b.x = pw.dx + (pw.ex - pw.dx) * s; b.y = gy;
        if (z) z.x1 = b.x;
        if (pw.k >= WORM.TUNNEL) {
          pw.ph = 'warn'; pw.k = 0; b.x = pw.ex; stage(m, pw, 3, pw.ex);
          m.events.push({ type: 'wormWarn', player: pw.owner, cp: pw.cp, x: pw.ex, y: C.GROUND_Y, dir: pw.dir });
        }
      } else if (pw.k >= WORM.WARN) {
        // THE BURST: the lob solved from the ring to the goal line — up to its top APEX_AT of the way
        // there on one gravity, down to CROSS of the goal's height at the line on a lighter one, in
        // LOB_T s (a shorter way, a shorter time), at an even pace across
        b.x = pw.ex; b.y = gy;
        const gx = goalLineX(pw.dir), A = apexH(), h0 = C.GROUND_Y - b.y, h1 = C.GOAL_H * WORM.CROSS;
        const T = WORM.LOB_T * Math.min(1, Math.max(0.35, Math.abs(gx - pw.ex) / 300));
        const t1 = T * WORM.APEX_AT, t2 = T - t1;
        pw.ag = (2 * Math.max(1, A - h0)) / (t1 * t1); pw.ag2 = (2 * Math.max(1, A - h1)) / (t2 * t2);
        pw.avx = (gx - pw.ex) / T;
        pw.ph = 'fly'; pw.t = 0; pw.k = 0; pw.x0 = pw.ex; pw.y0 = b.y;
        b.vx = pw.avx; b.vy = -pw.ag * t1;
        stage(m, pw, 4, pw.ex);
        m.events.push({ type: 'wormBurst', player: pw.owner, cp: pw.cp, x: pw.ex, y: C.GROUND_Y, dir: pw.dir });
        // WHO IS ON THE RING (the match only: the bot's look-ahead flies a copy over the real players)
        if (m.zones) {
          for (const q of m.players) {
            if (q.index === pw.owner || Math.abs(q.x - pw.ex) > WORM.RING * C.HEAD_R + C.BODY_W / 2 || q.y < C.GROUND_Y - 30) continue;
            const since = q.kickT > 0 ? C.KICK_TIME - q.kickT : 9;
            if (since <= WORM.STOMP + 1e-9) {
              // THE STOMP: smothered — the ball pops up loose, nobody hit
              b.vx = -pw.dir * 60; b.vy = -WORM.SMOTHER_VY;
              m.events.push({ type: 'wormSmother', player: q.index, by: pw.owner, cp: pw.cp, x: b.x, y: b.y });
              m.events.push({ type: 'blocked', player: q.index, by: pw.owner, fam: pw.fam, how: 'smother', cp: pw.cp });
              return api.end(b);
            }
            // only standing there: the burst throws him aside, and the lob goes on through him
            const away = Math.sign(q.x - pw.ex) || -pw.dir;
            q.vx = away * WORM.SHOVE_V; q.vy = -WORM.SHOVE_UP; q.onGround = false; q.shoved = Math.max(q.shoved || 0, WORM.SHOVE_T);
            pw.pass |= 1 << q.index;
            m.events.push({ type: 'wormShove', player: q.index, by: pw.owner, cp: pw.cp, x: q.x, y: C.GROUND_Y, dir: away });
          }
        }
        return true;
      }
      return true;
    }
    if (pw.ph !== 'fly' || pw.hit) return undefined;
    // THE LOB: on across, falling on its own gravity, until the grass (then a loose ball)
    b.vx = pw.avx; b.vy += (b.vy < 0 ? pw.ag : pw.ag2) * dt;
    pw.t += dt;
    if (pw.t > 0.1 && b.vy > 0 && b.y >= gy - 0.5) return api.end(b);
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },

  // THE DROP BLOCKED: it comes down onto a defender from above, so it meets the crown before the boot
  // can come round — a kick on its swing up (as a cannon shell's parry, power-zones.js) facing it
  // blocks it all the same (the family's block: the grind, then the whole tunnel back).
  // (the ring itself is settled at the burst, in `step`: the stomp, or the shove)
  contact(m, p, b, kit, pw, kicking, api) {
    if (!pw.wk || pw.ph !== 'fly' || kicking || !(b.vy > 0)) return undefined;   // (rising: the family's rules)
    const k = p.kickT > 0 ? (C.KICK_TIME - p.kickT) / C.KICK_TIME : 9;
    if (k <= C.BLOCK_SWING && (b.x - p.x) * (p.kickDir || p.side) > -C.BODY_W / 2) return api.block(m, p, b, pw);
    // (a jump right off the ring is the family's early header: met first, no daze)
    if (!p.onGround && Math.abs(b.x - pw.x0) < 170) return undefined;
    // THE CROWN: dropping onto a head, it is the power hit — and the ball pops on over him
    if (b.y >= p.y - C.BODY_H) return undefined;        // (a body: the family's hit, it bounces off)
    const r = api.hit(m, p, b, pw, 'crown');
    b.power = null;
    b.vx = pw.dir * WORM.OVER_VX; b.vy = -WORM.OVER_VY;
    b.y = Math.min(b.y, kit.headY(p) - C.HEAD_R - b.r - 1);
    return r;
  },
  skip: (pw) => underground(pw),
});
