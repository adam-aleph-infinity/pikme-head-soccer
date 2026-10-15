// STAGE 2 — אדון התולעים, LORD OF THE WORMS (a coiled green snake; the card: Ori screaming in a pit
// of red-eyed brown worms). An ORIGINAL power (docs/CHAMPION-POWERS.md §1c, redesigned with Idan
// 2026-10-13).
//
// WORM TUNNEL AMBUSH (Idan 2026-10-14: like France's in his Head Soccer clip): pressing POWER turns the
// snake into her worm form (drawn: public/vfx/powers/stage-02.js — the sim does not change the arm).
// Her touch is the shared cut-in, under which a giant worm bursts up beside her and coils round the
// ball; when it lets go:
//   • DIVE    the worm drives down at a steep slant into the turf ahead of her with the ball (DIVE s);
//   • TUNNEL  on under the pitch a FIXED distance (UNDER px) from where it went in — a mound running
//             in the grass (TUNNEL s). Where it comes up is only where she fired from:
//               – on the pitch: WARN s held under a ring, then it bursts up and SHOOTS THE BALL straight
//                 and slanting up into the goal's mouth — a straight power shot from there: counter it
//                 armed, kick-block it (the blocker sends the whole tunnel back), head it right off the
//                 ring, or take the hit (thrown, dazed, coiled: half speed, no dash, COIL s);
//               – inside the goal: it bursts at the goal's mouth and shoots it into the net — a goal;
//               – past the back wall: it hits the wall — no shot, no goal, the ball dropped back in at
//                 the centre spot as at a restart (Idan);
//   • STOMP   on the ring with KICK pressed in the STOMP s before it bursts: smothered, the ball pops
//             up loose — no hit, no shot. Only standing there is no answer: the burst shoves him aside
//             (no daze) and the shot goes on through.
// Underground the ball cannot be touched and nobody can score with it. All of it fixed at the touch,
// the same on every screen. The shooter is free to move (no `holds`); a fire-back (src ≠ owner)
// starts with GRAB s of the worm taking the ball off the blocker, there being no cut-in for it.
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const WORM = Object.freeze({
  GRAB: 0.3,        // s a fire-back's worm takes the ball (the touch's own grab is under the cut-in)
  DIVE: 0.28,       // s down into the turf
  DIVE_RUN: 0.6,    // px on per px down: the dive's slant (~60° below level, as in the clip)
  UNDER: 250,       // px it tunnels from where it went in (the clip: ~200–260)
  TUNNEL: 0.65,     // s under the pitch (Idan: between the clip's ~0.4 and the old 0.9)
  WARN: 0.25,       // s held under the ring before it bursts (the telegraph rule: 0.2–0.7)
  WEAVE: 0.07,      // the tunnel's winding pace (a fraction of the run, back and forth)
  BURST_STOP: 0.05, // s of hit-stop at the burst (the ground's jolt: game.js shakes the pitch with it)
  SPEED: 1.2,       // × the comet: the shot out of the ground
  IN: 30,           // px inside the goal line it is aimed at…
  CROSS: 0.42,      // …at this fraction of the goal's height
  RING: 1.7,        // × HEAD_R: the ring's radius round where it comes up
  STOMP: 0.15,      // s before the burst a kick pressed on the ring stomps it (smothers it)
  SMOTHER_VY: 420,  // px/s the smothered ball pops up
  SHOVE_V: 380, SHOVE_UP: 260, SHOVE_T: 0.3,   // the burst under a defender who only stood there: thrown aside, no daze
  THROUGH: 142, THROUGH_UP: 160,   // the shot met by a head or a body: the power hit, and the ball goes on past
                    //   him toward his goal at THROUGH px/s, popped up THROUGH_UP (0: it bounces off him)
  COIL: 1.5,        // s coiled from the hit (the daze's 0.9 s inside it: it has to outlast it to land)
});
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const backX = (dir) => (dir > 0 ? C.W : 0);                // the wall behind the goal
const UNDER = { wgrab: 1, wdive: 1, tunnel: 1, warn: 1 };
export const underground = (pw) => !!(pw && pw.wk && UNDER[pw.ph]);

// WHERE IT GOES IN AND COMES UP, from the release point (bx, by): in at the dive's slant, up UNDER px on.
// → { dx, ex, end }: end 0 on the pitch, 1 inside the goal (it comes up at the mouth), 2 past the
// wall (it stops at the wall). `r` the ball's radius.
export function tunnelOf(bx, by, dir, r = C.BALL_R) {
  const gx = goalLineX(dir), bk = backX(dir);
  const dx = Math.min(C.W - r - 2, Math.max(r + 2, bx + dir * Math.max(0, C.GROUND_Y - r - by) * WORM.DIVE_RUN));
  const raw = dx + dir * WORM.UNDER;
  if ((bk - raw) * dir <= r + 2) return { dx, ex: bk - dir * (r + 2), end: 2 };
  if ((gx - raw) * dir < r + 1) return { dx, ex: gx - dir * (r + 1), end: 1 };
  return { dx, ex: raw, end: 0 };
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
  // the ball unseen for the tunnel (a mound to read), then a straight shot up out of the ground; a hit coils
  diff: { speed: WORM.SPEED, disable: WORM.COIL * 0.5, jumpers: 1 },
  answer: { kick: true, jump: true },
  ballAt: WORM.DIVE + WORM.TUNNEL + WORM.WARN,             // s after the release the ball comes up

  launch(m, b, p, pw) {
    const fb = pw.src !== pw.owner;
    pw.wk = 1; pw.ph = fb ? 'wgrab' : 'wdive'; pw.k = 0;
    pw.bx = b.x; pw.by = b.y;
    const tn = tunnelOf(b.x, b.y, pw.dir, b.r);
    pw.dx = tn.dx; pw.ex = tn.ex; pw.end = tn.end;
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
        // a straight slant down into the turf, gathering pace
        const u = Math.min(1, pw.k / WORM.DIVE), e = u * u;
        b.x = pw.bx + (pw.dx - pw.bx) * e; b.y = pw.by + (gy - pw.by) * e;
        if (pw.k >= WORM.DIVE) {
          pw.ph = 'tunnel'; pw.k = 0; b.x = pw.dx; b.y = gy; stage(m, pw, 2, pw.dx);
          m.events.push({ type: 'wormDive', player: pw.owner, cp: pw.cp, x: b.x, y: C.GROUND_Y, dir: pw.dir });
        }
      } else if (pw.ph === 'tunnel') {
        // (a winding pace; the same TUNNEL s whatever the distance, a wall included)
        const u = Math.min(1, pw.k / WORM.TUNNEL), s = u + WORM.WEAVE * api.wave(2 * u);
        b.x = pw.dx + (pw.ex - pw.dx) * s; b.y = gy;
        if (z) z.x1 = b.x;
        if (pw.k >= WORM.TUNNEL && pw.end === 2) {
          // PAST THE GOAL: it hits the wall — no shot; the ball back in at the centre spot (Idan)
          stage(m, pw, 5, pw.ex);
          m.events.push({ type: 'wormLost', player: pw.owner, cp: pw.cp, x: pw.ex, y: C.GROUND_Y, dir: pw.dir });
          b.x = C.BALL_SPAWN.x; b.y = C.BALL_SPAWN.y; b.vx = 0; b.vy = 0; b.spin = 0;
          return api.end(b);
        }
        if (pw.k >= WORM.TUNNEL) {
          pw.ph = 'warn'; pw.k = 0; b.x = pw.ex; stage(m, pw, 3, pw.ex);
          m.events.push({ type: 'wormWarn', player: pw.owner, cp: pw.cp, x: pw.ex, y: C.GROUND_Y, dir: pw.dir });
        }
      } else if (pw.k >= WORM.WARN) {
        // THE BURST: straight up out of the ground and slanting into the goal's mouth (from inside
        // the goal, at its mouth: straight into the net)
        b.x = pw.ex; b.y = gy;
        const gx = goalLineX(pw.dir), tx = gx + pw.dir * WORM.IN, ty = C.GROUND_Y - C.GOAL_H * WORM.CROSS;
        const ddx = tx - b.x, ddy = ty - b.y, d = Math.hypot(ddx, ddy) || 1, v = C.POWER_SHOT_SPEED * WORM.SPEED;
        pw.avx = (ddx / d) * v; pw.avy = (ddy / d) * v;
        pw.ph = 'fly'; pw.t = 0; pw.k = 0; pw.x0 = pw.ex; pw.y0 = b.y;
        b.vx = pw.avx; b.vy = pw.avy;
        stage(m, pw, 4, pw.ex);
        { const z4 = burrow(m, pw); if (z4) z4.ig = pw.end === 1 ? 1 : 0; }
        // (`ig`: up inside the goal — the goal clears the burrow the next tick, so the renderer draws
        // that worm off this event instead)
        m.events.push({ type: 'wormBurst', player: pw.owner, cp: pw.cp, x: pw.ex, y: C.GROUND_Y, dir: pw.dir, ig: pw.end === 1 ? 1 : 0 });
        // WHO IS ON THE RING (the match only: the bot's look-ahead flies a copy over the real players)
        if (m.zones) {
          m.hitStop = Math.max(m.hitStop, WORM.BURST_STOP);
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
            // only standing there: the burst throws him aside, and the shot goes on through him
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
    // THE SHOT: dead straight along its slant (the frame, a body or a boot ends it — the family's rules)
    b.vx = pw.avx; b.vy = pw.avy;
    pw.t += dt;
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },

  // (the ring is settled at the burst, in `step`: the stomp, or the shove)
  // THE SHOT ON A BODY (not a boot, not in the air off the ring — the family's block and early
  // header): the power hit, and it goes on past him toward the goal, a loose ball at THROUGH px/s,
  // popped up THROUGH_UP px/s (its pace sets the power's strength)
  contact(m, p, b, kit, pw, kicking, api) {
    if (!WORM.THROUGH || !pw.wk || pw.ph !== 'fly' || kicking) return undefined;
    if (!p.onGround && Math.abs(b.x - pw.x0) < 170) return undefined;
    const r = api.hit(m, p, b, pw, 'through');
    // (a loose ball from here, carried on past him: its own gravity, his goal behind him)
    b.power = null;
    b.vx = pw.dir * WORM.THROUGH; b.vy = -WORM.THROUGH_UP;
    b.x = kit.keepOutOfGoal(b.x, b.y, p.x - pw.dir * (C.BODY_W / 2 + b.r + 2), b.y, b.r);
    return r;
  },
  skip: (pw) => underground(pw),
});
