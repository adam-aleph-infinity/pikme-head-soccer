// STAGE 3 — השף הבוער, THE BURNING CHEF (a flame-grilled burger in the card's yellow Saltiz shirt;
// the card: Naveh as a many-armed chef at a row of blazing grills). An ORIGINAL power
// (docs/CHAMPION-POWERS.md §1d, redesigned with Idan 2026-10-13; it replaces Sizzle Line).
//
// INFERNO SPATULA VOLLEY: pressing POWER turns the burger into the Inferno Chef — six arms with
// spatulas and the card's emblem as his crown (drawn: public/vfx/powers/stage-03.js; the sim does
// not change the arm). His touch is the shared cut-in, under which his top bun swings open like a
// grill lid and the ball drops in. Then (Idan, 2026-10-14, from his own footage of Head Soccer's
// United Kingdom, whose Hawk-Eye Shot champion 12's Moon Shot is built on — "the same timing and the
// same number of shots as Head Soccer, only spatulas"):
//   • the ball goes straight up off the top of the screen (the look: a big glowing spatula, the
//     other ten flung up with it) and waits up there — THE MOON SHOT'S OWN FLIGHT (the aerial
//     family, shared/hs-powers.js: up at AERIAL_UP, AERIAL_WAIT s, the same pace and strength);
//   • while it waits, TEN SPATULAS come back down one every GAP s — and the ball after them, the
//     11th (the look: the biggest, glowing spatula — the hidden ball) — all on parallel lines LINE
//     below horizontal that pass right over WHERE HE TOUCHED IT (Idan, 2026-10-14, his clip: "where
//     the player touched the ball, it goes up there and comes down there"; measured on it: ≈ 32°, the
//     ball's line crossing the touch point's column ≈ Y0, just above the top of the screen). So the
//     distance to the goal decides it all: touched a little inside his own half (the sweet spot), the
//     lines reach a standing head at the goal line — every spatula hits the keeper and the ball comes
//     in at him; too far back, they come down on the grass short of the goal (the ball bounces on in,
//     easier to stop); too close, they meet the crossbar or the wall over the goal (the ball bounces
//     off somewhere). Each spatula flies its WHOLE line — to the grass, the frame or the wall — whatever
//     becomes of the ball (Idan: "further, to the end": the volley is a power zone of its own, kind
//     'cp', stepped every tick until its last spatula has landed). Whoever one meets takes a SMALL
//     HIT — knocked back toward his goal, a moment's stagger, NO STUN (Idan, 2026-10-14: every stun is
//     the same 0.9 s, and a spatula is not one) — that GROWS with every one he takes in the same volley
//     (KNOCK, LIFT, SHOVE by the count, a mark on the face at MARKS): take nearly all ten and the last
//     ones throw him like a power hit and own his body for nearly a stun's length. A boot on the swing
//     up parries one. They never score. The ball is a power shot down its line until it meets the grass, the frame or the
//     wall, and from there a loose ball (the bounce is the pitch's); on the way the family's answers:
//     counter it armed, or take it on the head or the body (the power hit).
// The spatulas are not objects: each is a pure function of the flight's own clock (`spatAt`), so the
// sim and the renderer read the same one, a restore mid-volley plays the same and nothing is left
// behind. No randomness: the lines are the fixed table below.
import * as C from '../constants.js';
import { shellMeets } from '../power-zones.js';
import { addZone } from '../power-zones.js';

export const VOLLEY = Object.freeze({
  SPATS: 10,        // spatulas, then the ball: 11 shots, as the Hawk-Eye Shot's 11 laser arrows
  GAP: 0.1,         // s between them (the Moon Shot's lances: one every 0.1 s from the wait's start)
  SPEED: 2600,      // px/s down their lines
  UX: 0.8423, UY: 0.539,   // their heading: cos, sin 32.6° — tan 0.64 (literals: no Math.cos in sim code)
  TAN: 0.64,
  Y0: -30,          // px: where the ball's line crosses the touch point's column (just over the view's top, ≈ −52)
  // px each spatula's line runs below (+) or above (−) the ball's: a band round it — from the sweet
  // spot, a standing keeper's head and body at the goal line
  DY: Object.freeze([-30, 10, -10, 30, -20, 20, 0, -35, 35, 5]),
  TOP: -140,        // px: the line above the screen they come in from
  PARK: -110,       // px: where the ball waits above the screen (the Moon Shot's)
  DIVE: 1.05,       // × the flight's pace: the ball down its line (the Moon Shot's dive)
  R: 0.45,          // × HEAD_R: a spatula's reach (its blade) for what it meets — as big as it is drawn
  UP_MAX: 0.6,      // s at most going up (a ball under a crossbar is let up there all the same)
  // a spatula's hit, by how many he has taken this volley (n = 1…10): no stun — a knock toward his
  // goal (px/s), a lift (px/s), a stagger (s, the body the hit's: sim.js `shoved`) that grow with n,
  // so nearly all ten end in a power-hit throw and nearly a stun's loss of control (≤ SHOVE_MAX)
  KNOCK: 140, KNOCK_N: 95,   // n = 1: 140 px/s … n = 10: ≈ 1000 (the power hit's throw)
  LIFT: 60, LIFT_N: 25,
  SHOVE: 0.06, SHOVE_N: 0.06, SHOVE_MAX: 0.6,
  MARKS: Object.freeze([4, 8]),   // the hits that leave a mark on his face
  LIFE: 3.4,        // s the volley lives from the touch: past the last spatula's landing and its burn
  BALL_AT: 1.29,    // s from the release to the dive, for the tools (up ≈ 0.29 s + the 1 s wait)
});
const V = VOLLEY;
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const BAR_Y = () => C.GROUND_Y - C.GOAL_H;

// The volley's clock the spatulas run on: from the start of the ball's wait (the Moon Shot's warn()),
// on the volley's own zone (`w0` its age then; < 0 until the ball has got up there).
export const volleyClock = (z) => (z && z.w0 >= 0 ? z.t - z.w0 : -1);
// the volley zone of power `pw`, or of thrower `own` (the newest)
export function volleyZone(m, pw, own = -1) {
  if (!m || !m.zones) return null;
  for (let i = m.zones.length - 1; i >= 0; i--) {
    const z = m.zones[i];
    if (z.k === 'cp' && z.cp === 'volley' && (pw ? z.vid === pw.vid : own < 0 || z.own === own)) return z;
  }
  return null;
}

// Where a line coming down at (dir, TAN) through (xs, yc) ends: on the grass short of the goal; over
// the crossbar, on over the goal — down onto its roof ('roof'), or on to the side wall at the edge of
// the screen ('wall') (Idan: no invisible wall at the goal line, "to the end"); or in the net (under
// the bar: on to the back of the goal). Returns { x, y, kind }.
export function lineEnd(dir, xs, yc) {
  const gx = goalLineX(dir), gy = C.GROUND_Y - 4;
  const xg = xs + (dir * (gy - yc)) / V.TAN;                          // where it meets the grass
  if ((xg - gx) * dir <= 0) return { x: xg, y: gy, kind: 'grass' };
  const yl = yc + V.TAN * (gx - xs) * dir;                            // its height at the goal line
  if (yl < BAR_Y() + 4) {
    const wall = dir > 0 ? C.W - 2 : 2, xr = xs + (dir * (BAR_Y() - 2 - yc)) / V.TAN;
    if ((xr - wall) * dir < 0) return { x: xr, y: BAR_Y() - 2, kind: 'roof' };
    return { x: wall, y: yc + V.TAN * (wall - xs) * dir, kind: 'wall' };
  }
  const back = dir > 0 ? C.W - 6 : 6, yb = yc + V.TAN * (back - xs) * dir;
  return yb < gy ? { x: back, y: yb, kind: 'net' } : { x: xg, y: gy, kind: 'net' };
}

// SPATULA i AT τ s INTO THE WAIT (`o`: the volley — its dir and the touch point xs): null before it
// comes in; else `seg` 'down' (on its line) or 'done' (at its end: `kind` grass / bar / net), where its
// blade is and its heading. Polynomials only.
export function spatAt(o, i, tau) {
  const pw = o;
  const run = (tau - i * V.GAP) * V.SPEED;
  if (!(run > 0)) return null;
  const yc = V.Y0 + V.DY[i], e = lineEnd(pw.dir, pw.xs, yc);
  const sx = pw.xs + (pw.dir * (V.TOP - yc)) / V.TAN;
  const track = (e.y - V.TOP) / V.UY, h = Math.min(run, track);
  return { seg: run < track ? 'down' : 'done', x: sx + pw.dir * V.UX * h, y: V.TOP + V.UY * h, ux: pw.dir * V.UX, uy: V.UY, sx, ex: e.x, ey: e.y, kind: e.kind };
}

// A SPATULA'S HIT on player p — the n-th he has taken this volley: no stun; a knock, a lift and a
// stagger that grow with n; a mark at MARKS.
function spatHit(m, p, z, s) {
  const n = ++z.hits, k = n - 1;
  p.vx = z.dir * (V.KNOCK + V.KNOCK_N * k);
  p.vy = Math.min(p.vy, -(V.LIFT + V.LIFT_N * k));
  p.onGround = false;
  p.shoved = Math.max(p.shoved || 0, Math.min(V.SHOVE_MAX, V.SHOVE + V.SHOVE_N * k));
  p.dashT = 0;
  if (V.MARKS.includes(n)) {
    p.hurt = Math.min(4, (p.hurt | 0) + 1);
    m.events.push({ type: 'hurt', player: p.index, by: z.own, level: p.hurt, ko: false, power: true });
  }
  m.events.push({ type: 'spatHit', player: p.index, by: z.own, cp: z.cp, n: s.n, hits: n, x: s.x, y: s.y, dir: z.dir });
}

// THE VOLLEY'S TICK (power-zones.js stepZones calls it for its 'cp' zone, every tick in play, whatever
// became of the ball): its clock from the ball's wait, each spatula coming in (an event: its sound),
// and what each meets on its whole line — the small hit, or a parry. Swept through the tick (they
// cross ~40 px of it). Returns true when it is done (stepZones drops it).
function volleyTick(m, z, dt, kit) {
  if (z.w0 < 0) {
    const pw = m.ball && m.ball.power;
    if (pw && pw.vid === z.vid && pw.ph === 'wait') z.w0 = z.t - pw.k;
    return false;
  }
  const tau = volleyClock(z), r = V.R * C.HEAD_R;
  for (let i = 0; i < V.SPATS; i++) {
    const t0 = i * V.GAP;
    if (t0 >= tau - dt - 1e-9 && t0 < tau - 1e-9) {
      const s = spatAt(z, i, t0 + 1e-6);
      m.events.push({ type: 'spatRain', player: z.own, cp: z.cp, n: i, x: s.sx, y: V.TOP, tx: s.ex, ty: s.ey, kind: s.kind, dir: z.dir });
    }
    if (z.sp & (1 << i)) continue;
    for (let f = 2; f >= 0; f--) {
      const s = spatAt(z, i, tau - (dt * f) / 3);
      if (!s || s.seg !== 'down') continue;
      let met = false;
      for (const p of m.players) {
        if (p.index === z.own) continue;
        const how = shellMeets(p, s.x, s.y, r, kit);
        if (!how) continue;
        z.sp |= 1 << i;
        if (how === 'parry') m.events.push({ type: 'spatParry', player: p.index, by: z.own, cp: z.cp, n: i, x: s.x, y: s.y, dir: z.dir });
        else spatHit(m, p, z, { n: i, x: s.x, y: s.y });
        met = true;
        break;
      }
      if (met) break;
    }
  }
  return false;
}

export default Object.freeze({
  stage: 3, id: 'volley', everywhere: true,
  // the Moon Shot's family and pace (the aerial family at the middle strength: 1.05 × the comet)
  family: 'aerial', speed: 1.05, ailment: null, ailSec: 0,
  name: 'Inferno Spatula Volley', icon: '🍔', color: '#ff7a1a',
  desc: 'השף זורק את המריות לשמיים והן נוחתות על השער ומעיפות! המרית ה־11 הזוהרת היא הכדור.',
  // the ball hidden off the screen, ten real hits raining on the goal mouth, a dive from above
  diff: { speed: 1.1, disable: 0.6, decoys: 2, decoyLife: 0.5, above: 1, invisible: 0.3 },
  ballAt: V.BALL_AT,

  launch(m, b, p, pw) {
    // (a block's fire-back too — `src` someone else's: the same volley from the blocker, no cut-in)
    pw.vl = 1; pw.vk = 0; pw.dv = 0;
    pw.xs = b.x;                                             // WHERE HE TOUCHED IT: it goes up, and comes down, here
    // the volley: a zone of its own, so every spatula flies its whole line whatever becomes of the ball
    pw.vid = (m.t || 0) + pw.owner * 1e-3;
    addZone(m, { k: 'cp', cp: pw.cp, own: pw.owner, dir: pw.dir, xs: pw.xs, x0: pw.xs, x1: pw.xs, life: V.LIFE, vid: pw.vid, w0: -1, sp: 0, hits: 0 });
    if (m.zones) m.events.push({ type: 'volleyUp', player: pw.owner, cp: pw.cp, x: b.x, y: b.y, dir: pw.dir, chef: pw.src === pw.owner ? 1 : 0 });
  },
  // up and the wait are the Moon Shot's (the aerial family's step); the spatulas ride its clock; the
  // dive is our own: down the ball's line over the touch point, to the grass, the frame or the wall
  step(m, b, dt, pw, S, kit, api) {
    if (!pw.vl) return undefined;
    pw.vk += dt;
    // (going up under a crossbar it would never get there: let it up all the same)
    if (pw.ph === 'up' && pw.vk > V.UP_MAX && b.y > -100) b.y = -101;
    if (pw.ph !== 'dive' || pw.hit || pw.rb) return undefined;
    const v = S * V.DIVE, r = b.r;
    if (!pw.dv) {
      // in from above the screen on its line through (xs, Y0)
      pw.dv = 1; pw.t = 0;
      let x = pw.xs + (pw.dir * (V.PARK - V.Y0)) / V.TAN, y = V.PARK;
      if (x < r + 2 || x > C.W - r - 2) { const xc = x < r + 2 ? r + 2 : C.W - r - 2; y += V.TAN * (xc - x) * pw.dir; x = xc; }
      b.x = x; b.y = y; pw.x0 = x; pw.y0 = y;
      if (m.zones) m.events.push({ type: 'volleyBall', player: pw.owner, cp: pw.cp, x, y, dir: pw.dir, chef: pw.src === pw.owner ? 1 : 0 });
      const z = volleyZone(m, pw);
      if (z && z.w0 < 0) z.w0 = z.t - pw.k;                  // (a zone stepped before the ball got up there)
    }
    b.vx = pw.dir * V.UX * v; b.vy = V.UY * v;
    pw.t += dt;
    // the end of its line, a step ahead: the grass, the crossbar or the wall over the goal, the side
    // wall, or in past the goal line — from there it is a loose ball, the pitch's bounce
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, gx = goalLineX(pw.dir);
    const past = (nx - gx) * pw.dir;
    if (ny + r >= C.GROUND_Y - 1 || (past > -r && ny - r < BAR_Y() + 2 && b.y > -60) || past > r || nx < r + 2 || nx > C.W - r - 2 || pw.t >= pw.life) return api.end(b);
    return true;
  },
  // the volley's zone, every tick in play (power-zones.js stepZones, kind 'cp')
  zoneStep: (m, z, dt, kit) => volleyTick(m, z, dt, kit),
});
