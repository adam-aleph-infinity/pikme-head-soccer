// THE MYTHIC GEM — the four Mythic starters' one power (Idan, 2026-10-08: "one power for
// everyone", unique, above the arcade's average, high-quality visuals, each in its own colour:
// Shoval red, Ori pink, Naveh yellow, Paz green — shared/mythics.js).
//
// Not a Head Soccer character's: ours. The ball turns into a big gem and flies fast and dead flat
// at the goal. A kick into it is the plain block (grind, then fired back as the blocker's), and an
// armed player counters it as any power. Meet it with the head or the body (or just stand in its
// way) and it SHATTERS — a stop, as any hit is, but a costly one: whoever it met is stuck in a gem
// crust (`gem`: no control) for longer than any daze, and the ball pops up over him and drops loose
// behind him, for the shooter to race onto while he stands there.
// (The first version flew three shards on through him at the goal: every shot it shattered on
// went in, 100% against every CPU — Idan, 2026-10-08: "OP, you can't block it". Any piece flying
// on at the goal beats a defender who met it out in the field, so the break is a stop now — his
// choice of the three fixes.)
// Look: public/vfx/powers/mythic.js (the gem, its shards, the shatter, the crust).
//
// ROLLBACK RULES, as in hs-powers.js: no Math.random / sin / cos; state is plain scalars.
import * as C from '../constants.js';

export const GEM = Object.freeze({
  SPEED: 1.1,       // × the comet, as Japan's
  CRUST: 1.3,       // s the one it shattered on is stuck in the gem (a hit's daze is 0.3, Russia's ice 2.5)
  DROP_VX: 220,     // px/s the loose ball pops on past him, toward his goal…
  DROP_VY: 420,     // …and up
});

export default Object.freeze({
  id: 'mythicgem',
  family: 'straight', speed: GEM.SPEED, ailment: null, ailSec: 0,
  name: 'אבן מיתית', icon: '💎',
  desc: 'הכדור הופך לאבן חן ועף מהר לשער. עצרת אותה עם הראש או הגוף? היא מתנפצת, אתה תקוע בגבישים לרגע והכדור קופץ מעליך. בעיטה בזמן מחזירה אותה.',
  diff: { speed: GEM.SPEED, disable: GEM.CRUST, blockKO: 0 },

  launch(m, b, p, pw) { pw.vx0 = 0; pw.vy0 = 0; },

  contact(m, p, b, kit, pw, kicking, api) {
    if (kicking) return undefined;              // the boot: the plain block, fired back as the blocker's
    // SHATTERED: the one it met is stuck in the gem where he is…
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
    p.vx = 0; p.dashT = 0;
    if (p.vy < 0) p.vy = 0;
    // (not a daze: he stands upright in it, as in Russia's ice — the ailment alone holds him)
    p.ail = ''; p.ailT = 0; p.stunned = 0;
    api.ailment(m, p, 'gem', GEM.CRUST);
    m.events.push({ type: 'powerHit', player: p.index, by: pw.owner, fam: pw.fam, cp: pw.cp, how: 'shatter', x: b.x, y: b.y });
    m.events.push({ type: 'gemShatter', player: p.index, by: pw.owner, x: b.x, y: b.y, dir: pw.dir, color: pw.color });
    // …and the ball pops up over him and drops loose behind him: a race for it, him frozen.
    b.power = null;
    b.vx = pw.dir * GEM.DROP_VX; b.vy = -GEM.DROP_VY;
    return 'shatter';
  },
});
