// STAGE 3 — NIGERIA, "Tornado Shot" (1.5 stars).
//
// Wiki (Nigeria): "Nigeria unleashes a tornado whirlwind on the ground towards the opponent";
// "the shot bounces up and down very quickly"; "if the tornado touches the opponent, they fly and
// spin in the air and they stay unconscious for 3 seconds"; it "can be deflected easily when you
// watch for it or you have your Power Shot activated". Power_Shot_Guide: "one of the biggest
// misconceptions is that Nigeria's shot has a ball that stays on the ground … you can also get hit
// by the power shot when you jump"; "counter … Stay on the ground while doing so".
// So: down onto the grass (the ground family's drop), then along it at ≈ 0.68 × the comet (Nigeria.gif,
// docs/HS-FIRST-3-POWERS.md), the ball hopping quickly, a tall whirlwind round it that also catches a
// player jumping over it. A kick blocks it (the grind). Standing right beside Nigeria as it leaves,
// the ball comes off you and falls behind him. Anyone else is flung up out of the top of the screen
// tumbling (the `twister` ailment: 5× gravity in the air, stars all the way) and out for 3 s, while
// the ball drops out of the whirlwind for the shooter to chase.
// Look: public/vfx/powers/stage-03.js (and ailments.js `twister`).
import * as C from '../constants.js';

export const TORNADO = Object.freeze({
  HOP: 12,          // px the ball bounces inside the funnel
  HOPS: 7,          // bounces a second ("up and down very quickly")
  H: 150,           // px tall: a jumping player's feet are well inside it
  W: 34,            // px half-width round the ball, where a jumper's feet are
  UP: 1850,         // px/s he is flung up, at 5× gravity (the twister ailment): out of the top of the
                    // screen and back in ≈ 1.25 s, as the Grab's throw (Nigeria.gif: gone ≈ 0.7 s)
  OUT: 3.0,         // s unconscious in all ("unconscious for 3 seconds")
  CLOSE: 0.1,       // s after it leaves: a defender standing right there sends it back behind Nigeria
  NEAR: 150,        // px from where it left that counts as "right there" (Power_Shot_Guide: "get very close")
});

export default Object.freeze({
  stage: 3, id: 'tornado', hs: 'Nigeria', hsPower: 'Tornado Shot', hsStars: 1.5,
  family: 'ground', speed: 0.68, ailment: null, ailSec: 0,
  name: 'טורנדו', icon: '🌪️', color: '#e8eef4',
  desc: 'טורנדו רץ על הדשא עם הכדור ופוגע גם בקופץ. נפגעת? עף מסתחרר, 3 שניות מעולף.',
  sources: ['https://headsoccer.wiki.gg/wiki/Nigeria', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide', 'https://headsoccer.wiki.gg/wiki/Power_Shots'],
  diff: { speed: 0.68, disable: TORNADO.OUT, jumpers: 1 },
  // How a defender answers it (shared/bot.js reads this over the ground family's "a boot cannot
  // stop it, jump it"): a kick blocks it, and a jump over it is caught in the funnel.
  answer: { kick: true, jump: false },

  step(m, b, dt, pw, S, kit, api) {
    if (pw.ph !== 'roll') return undefined;                    // the drop is the ground family's
    pw.k += dt;
    // bouncing quickly up and down inside the funnel (|wave| is hs-powers' literal sine table)
    const hop = TORNADO.HOP * Math.abs(api.wave(pw.k * TORNADO.HOPS * 0.5));
    const ty = C.GROUND_Y - b.r - hop;
    b.vx = pw.dir * S; b.vy = (ty - b.y) / dt;
    // the funnel is tall: a player in the air over the ball is still inside it
    for (const q of m.players) {
      if (q.index === pw.owner || (pw.pass & (1 << q.index)) || q.armed > 0) continue;
      if (q.y >= C.GROUND_Y - 1) continue;                      // on the grass: the ball's own contact
      if (Math.abs(q.x - b.x) < C.BODY_W / 2 + TORNADO.W && q.y > C.GROUND_Y - TORNADO.H) {
        api.contact(m, q, b);
        return !!b.power;
      }
    }
    pw.t += dt;
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },

  contact(m, p, b, kit, pw, kicking, api) {
    if (kicking) return api.block(m, p, b, pw);                 // "deflected easily when you watch for it"
    // Standing right next to Nigeria as he fires, the ball comes off you and falls behind HIM
    // (Power_Shot_Guide: "get very close … the ball may fall behind Nigeria") — a plain ball.
    // (only right by him: the drop phase alone used to count, so a defender 300 px away on the
    // grass sent every Tornado back while it was still coming down)
    if (p.onGround && Math.abs(b.x - pw.x0) < TORNADO.NEAR && (pw.ph === 'drop' || pw.k < TORNADO.CLOSE)) {
      b.power = null;
      b.vx = -pw.dir * 420; b.vy = -520;
      m.events.push({ type: 'blocked', player: p.index, by: pw.owner, fam: pw.fam, how: 'close', cp: pw.cp });
      return 'deflect';
    }
    // caught: thrown up spinning, out for 3 s, and the ball drops out of the whirlwind
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
    pw.pass |= 1 << p.index;
    p.stunned = 0; kit.stun(m, p, TORNADO.OUT);
    p.ail = 'twister'; p.ailT = TORNADO.OUT;
    m.events.push({ type: 'ailment', player: p.index, ail: 'twister', time: p.ailT });
    p.vx = pw.dir * 90; p.vy = -TORNADO.UP; p.onGround = false;
    m.events.push({ type: 'powerHit', player: p.index, by: pw.owner, fam: pw.fam, cp: pw.cp, how: 'twister', x: b.x, y: b.y });
    b.power = null;
    b.vx = pw.dir * 170; b.vy = -460;
    return 'twister';
  },
});
