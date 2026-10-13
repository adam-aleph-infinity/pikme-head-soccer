// STAGE 3 — השף הבוער, THE BURNING CHEF (a flame-grilled burger; the card: Naveh as a many-armed
// chef at a row of blazing grills). An ORIGINAL power (docs/CHAMPION-POWERS.md, Idan 2026-10-11).
//
// SIZZLE LINE: the ball dives off the shooter's head to knee height and flies flat at the goal,
// searing a grill strip into the grass behind it (a power zone, shared/power-zones.js). The strip
// burns for STRIP s after the ball leaves: an opponent standing on it — or landing on it from a
// jump over the ball — is `singed` (the boot too hot to kick with) for SINGE s.
//   • a KICK blocks the ball as any shot (it is low, so the boot meets it early in the swing);
//   • jumping it works, if you land clear of the strip.
// Look: public/vfx/powers/stage-03.js (the ball's flames, the strip, the singed feet).
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const SIZZLE = Object.freeze({
  SPEED: 1.0,
  KNEE: 30,         // px above the grass the ball's centre flies at (its bottom ≈ 15 px up)
  DIVE_VY: 1100,    // px/s down off the head to that height
  STRIP: 2.2,       // s the strip burns, counted from the release
  SINGE: 1.4,       // s singed
});

export default Object.freeze({
  stage: 3, id: 'sizzle', everywhere: true,
  family: 'straight', speed: SIZZLE.SPEED, ailment: null, ailSec: 0,
  name: 'Sizzle Line', icon: '🍔', color: '#ff7a1a',
  desc: 'כדור נמוך שחורך פס גריל בוער על הדשא. דרכת עליו? אין בעיטה לרגע.',
  diff: { speed: SIZZLE.SPEED, disable: SIZZLE.SINGE * 0.6, zone: 1 },

  launch(m, b, p, pw) {
    pw.ph = 'sdive'; pw.strip = 1;
    addZone(m, { k: 'strip', cp: 'sizzle', own: pw.owner, x0: b.x, x1: b.x, life: SIZZLE.STRIP, grow: 1, ail: 'singed', ailS: SIZZLE.SINGE });
  },
  step(m, b, dt, pw, S) {
    if (pw.ph !== 'sdive' || pw.rb || pw.hit) return undefined;
    const ky = C.GROUND_Y - SIZZLE.KNEE;
    b.vx = pw.dir * S * 0.92; b.vy = SIZZLE.DIVE_VY;
    if (b.y + b.vy * dt >= ky) { b.vy = (ky - b.y) / dt; pw.ph = 'fly'; }
    pw.t += dt;
    return true;
  },
});
