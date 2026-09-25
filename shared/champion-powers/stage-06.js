// STAGE 6 — RUSSIA, "Ice Shot" (3 stars).
//
// Wiki (Russia): "A ball of ice is shot through the air towards the other player's goal. The ball
// doesn't travel completely horizontally but makes a little downward curve"; it "dips down after a
// certain distance allowing the player to counter it easier"; "If the opponent blocks the shot, he
// will be frozen in a block of ice for a short period of time, able to be kicked and dashed into
// the goal." Power_Shot_Guide: "starts high but curves downward"; "If you are hit by the power
// shot, you will get frozen. You can't do anything but activate your power shot"; "Blocking is
// difficult; countering recommended."
// So: level off the touch at the comet's pace for the first stretch, then a late dip (a steady
// downward pull) that ends low in the mouth. Blocked OR hit, the defender is frozen solid in an ice
// block (`iced`: no control, and on the grass he slides like ice, so a kick or a dash carries him
// toward his goal); a block leaves the ball loose in front of him for the shooter.
// Look: public/vfx/powers/stage-06.js (the ice ball, the frost trail, the ice block).
import * as C from '../constants.js';

export const ICE = Object.freeze({
  FLAT: 300,        // px of level flight before the dip ("after a certain distance")
  DIP: 2600,        // px/s² the dip pulls down with: ≈ 40 px of drop by the goal ("a little curve")
  FREEZE: 2.5,      // s in the ice block, blocked or hit ("a short period of time")
  SLIDE: 0.975,     // the ice block's grip on the grass per tick (a player's is a dead stop)
});

export default Object.freeze({
  stage: 6, id: 'iceshot', hs: 'Russia', hsPower: 'Ice Shot', hsStars: 3,
  family: 'straight', speed: 1.0, ailment: 'iced', ailSec: ICE.FREEZE,
  name: 'כדור קרח', icon: '🧊', color: '#9fe8ff',
  desc: 'כדור קרח טס גבוה וצולל בסוף. חסמת או נפגעת? אתה קופא בגוש קרח — ואפשר לבעוט אותך לשער.',
  sources: ['https://headsoccer.wiki.gg/wiki/Russia', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide'],
  diff: { speed: 1.0, disable: ICE.FREEZE, blockKO: ICE.FREEZE, above: 1 },

  launch(m, b, p, pw) { pw.vy0 = 0; },

  step(m, b, dt, pw, S, kit, api) {
    if (pw.ph !== 'fly' || pw.rb || pw.hit) return undefined;
    b.vx = pw.dir * S;
    if ((b.x - pw.x0) * pw.dir >= ICE.FLAT) pw.vy0 += ICE.DIP * dt;       // the late dip
    const floor = C.GROUND_Y - b.r;
    if (b.y >= floor - 0.5 && pw.vy0 > 0) { pw.vy0 = 0; b.y = floor; }  // on the grass it skims along
    b.vy = pw.vy0;
    pw.t += dt;
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },

  contact(m, p, b, kit, pw, kicking, api) {
    if (!kicking) return undefined;           // hit: the family's knock-back, then `iced` lands (ailment)
    // Blocked: frozen in a block of ice where he stands; the ball drops loose in front of him.
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
    p.vx = 0; p.dashT = 0;
    p.ail = ''; p.ailT = 0;
    api.ailment(m, p, 'iced', ICE.FREEZE);
    m.events.push({ type: 'blocked', player: p.index, by: pw.owner, fam: pw.fam, shot: pw.fam, cp: pw.cp, how: 'iced', x: b.x, y: b.y });
    b.power = null;
    b.x = kit.keepOutOfGoal(b.x, b.y, p.x - pw.dir * (C.BODY_W / 2 + b.r + 4), b.y, b.r);
    b.vx = -pw.dir * 140; b.vy = -260;
    return 'block';
  },
});
