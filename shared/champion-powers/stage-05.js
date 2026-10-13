// STAGE 5 — בונה החומות, THE WALL BUILDER (a red-orange ice pop with a bite out of it; the card: Paz
// in a straw fedora and a lei bursting out of an ice pool, ice pops flying). An ORIGINAL power
// (docs/CHAMPION-POWERS.md, Idan 2026-10-11).
//
// ICE POP WALL: a plain, dead-flat shot at the goal — and, the moment it goes, a fence of three
// giant ice pops sprouts in front of the shooter's OWN goal for WALL s (a power zone,
// shared/power-zones.js): any ball coming at that goal lower than the pops (H px) bounces off them.
// So the shot's answer — the block's fire-back, a counter — has to go over the top. Players walk
// through the pops. A hit leaves a `brainfreeze`: slow and stiff for FREEZE s.
// Look: public/vfx/powers/stage-05.js (the frosty ball, the fence, the brain freeze).
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const ICEPOP = Object.freeze({
  SPEED: 1.0,
  H: 92,            // px tall from the grass (the goal is 133): a ball at head height is turned back
  OUT: 34,          // px out in front of the goal line
  WALL: 4.0,        // s it stands, from the release
  FREEZE: 2.4,      // s of brain freeze after a hit: frozen stiff, then its last 1.4 s a shiver (hs-powers SHIVER)
  BOUNCE: 0.42,      // × its pace the ball bounces back off the frozen defender (a dead, icy rebound)
});

export default Object.freeze({
  stage: 5, id: 'icepop', everywhere: true,
  family: 'straight', speed: ICEPOP.SPEED, ailment: 'brainfreeze', ailSec: ICEPOP.FREEZE,
  name: 'Ice Pop Wall', icon: '🍭', color: '#ff6a3d',
  desc: 'בעיטה ישרה לשער, וגדר קרטיבים ענקית צומחת מול השער שלך ל־4 שניות.',
  diff: { speed: ICEPOP.SPEED, disable: ICEPOP.FREEZE * 0.5, zone: 1 },

  launch(m, b, p, pw) {
    const own = pw.dir > 0 ? C.GOAL_W : C.W - C.GOAL_W;            // the shooter's own goal line
    const x = own + pw.dir * ICEPOP.OUT;
    addZone(m, { k: 'fence', cp: 'icepop', own: pw.owner, x0: x, x1: x, h: ICEPOP.H, life: ICEPOP.WALL, dir: -pw.dir });
  },
  contact(m, p, b, kit, pw, kicking, api) {
    if (kicking) return undefined;                         // the plain block
    if (!p.onGround && Math.abs(b.x - pw.x0) < 170) return undefined;   // the early header
    // frozen stiff where he stands (the brain freeze), and the ball comes off the ice dead
    const r = api.hit(m, p, b, pw, 'freeze');
    p.vx = 0; p.koSlide = 0; if (p.vy < 0) p.vy = 0;
    b.power = null;
    b.vx = -pw.dir * Math.abs(b.vx) * ICEPOP.BOUNCE; b.vy = -650;
    b.x = kit.keepOutOfGoal(b.x, b.y, p.x - pw.dir * (C.BODY_W / 2 + b.r + 2), Math.min(b.y, C.GROUND_Y - b.r), b.r);
    m.events.push({ type: 'brainFreeze', player: p.index, by: pw.owner, x: b.x, y: b.y });
    return r;
  },
});
