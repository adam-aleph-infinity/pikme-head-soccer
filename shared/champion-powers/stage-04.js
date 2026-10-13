// STAGE 4 — מלך הבוץ, KING OF MUD (the new Saltiz chocolate bar, about to burst; the card: Naveh in
// a crate of marshmallows, rare snacks flying, a glowing "?"). An ORIGINAL power
// (docs/CHAMPION-POWERS.md, Idan 2026-10-11).
//
// CHOCO BURST: the ball flies dead flat at the goal wrapped as the chocolate bar, shaking harder as
// it goes; BURST_AT px short of the goal line the wrapper bursts and a splat of melted chocolate is
// thrown AHEAD px on, landing on the grass in front of the goal (a power zone, shared/power-zones.js)
// for SPLAT s. Feet in it are `sticky`: slow, half-height jumps, no dash. The ball flies on.
//   • the splat lands on a SPOT, not on a player: step off it as the bar shakes;
//   • a HIT bursts the bar ON him (if it has not burst yet): glued where he stands (the daze, then
//     sticky for COAT s) instead of thrown, and the ball bounces back off him, slowed;
//   • a kick blocks the ball as any shot; a standing block does not need a jump at all.
// Look: public/vfx/powers/stage-04.js (the wrapper, the burst, the splat, chocolate feet).
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const CHOCO = Object.freeze({
  SPEED: 1.0,       // × the comet: the tutorial's counter lesson is timed to it (shared/tutorial.js)
  BURST_AT: 430,    // px short of the goal line the wrapper bursts
  AHEAD: 240,       // px on from the burst the splat's middle lands (kept off the goal line)
  HALF: 95,         // px half-width of the splat
  LAND: 0.12,       // s from the burst to the splat on the grass
  SPLAT: 2.2,       // s the splat stays
  STICK: 0.35,      // s sticky after stepping out of it
  COAT: 2.4,        // s sticky after the bar bursts ON him (a hit): chocolate head to toe
  BOUNCE: 0.65,      // …and the ball bounces back off him at this × its pace, slowed by the mess
  DROP_VY: 260,     //   (px/s up)
});
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);

export function chocoBurst(m, b, pw) {
  pw.burst = 1;
  const gx = goalLineX(pw.dir);
  // ahead of the ball, but its far edge short of the goal line
  let cx = b.x + pw.dir * CHOCO.AHEAD;
  if ((gx - cx) * pw.dir < CHOCO.HALF + 6) cx = gx - pw.dir * (CHOCO.HALF + 6);
  addZone(m, { k: 'splat', cp: 'chocoburst', own: pw.owner, x0: cx - CHOCO.HALF, x1: cx + CHOCO.HALF, life: CHOCO.SPLAT, land: CHOCO.LAND, ail: 'sticky', ailS: CHOCO.STICK });
  m.events.push({ type: 'chocoBurst', player: pw.owner, x: b.x, y: b.y, cx, dir: pw.dir });
}

export default Object.freeze({
  stage: 4, id: 'chocoburst', everywhere: true,
  family: 'straight', speed: CHOCO.SPEED, ailment: null, ailSec: 0,
  name: 'Choco Burst', icon: '🍫', color: '#c0262d',
  desc: 'חטיף השוקולד טס לשער ומתפוצץ בדרך: שלולית דביקה נוחתת מול השער.',
  diff: { speed: CHOCO.SPEED, disable: 0.6, zone: 1 },

  contact(m, p, b, kit, pw, kicking, api) {
    if (kicking) return undefined;                         // the plain block
    if (!p.onGround && Math.abs(b.x - pw.x0) < 170) return undefined;   // the early header
    // glued where he stands — not thrown: a daze inside a chocolate coat
    const r = api.hit(m, p, b, pw, 'choco');
    p.vx = 0; p.koSlide = 0; if (p.vy < 0) p.vy = 0;
    if (!pw.burst) chocoBurst(m, b, pw);
    p.ail = ''; p.ailT = 0;
    api.ailment(m, p, 'sticky', CHOCO.COAT);
    m.events.push({ type: 'chocoCoat', player: p.index, by: pw.owner, x: b.x, y: b.y });
    // …and the ball bounces back off him, as off any body, slowed by the chocolate
    b.power = null;
    b.vx = -pw.dir * Math.abs(b.vx) * CHOCO.BOUNCE; b.vy = -CHOCO.DROP_VY;
    b.x = kit.keepOutOfGoal(b.x, b.y, p.x - pw.dir * (C.BODY_W / 2 + b.r + 2), Math.min(b.y, C.GROUND_Y - b.r), b.r);
    return r;
  },
  step(m, b, dt, pw) {
    if (pw.burst || pw.rb || pw.hit || pw.ph !== 'fly') return undefined;
    if ((goalLineX(pw.dir) - b.x) * pw.dir <= CHOCO.BURST_AT) chocoBurst(m, b, pw);
    return undefined;                                      // the straight family flies it on
  },
});
