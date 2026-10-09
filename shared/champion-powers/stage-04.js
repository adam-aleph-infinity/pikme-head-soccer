// STAGE 4 — USA, "Illusion Shot" (2 stars).
//
// Wiki (USA): "The ball multiplies into eight balls, which all aim for the goal. 7/8 balls are
// fake, but after the shot has travelled a small distance, there will only be one ball left that
// is real. For a short time after the shot, the ball becomes invisible to the opponent and
// translucent to whoever uses the shot"; "the shot is a 100% goal when used close to the goal, as
// the ball will go through the defender". Power_Shot_Guide: "The ball in USA's power shot travels
// slightly downward"; "you can see it when the ball bounces"; "you can both counter or block the
// shot; but countering works better".
// So: one real ball (the seven fakes are only drawn — public/vfx/powers/stage-04.js), slightly
// downward and bouncing off the grass; invisible from 0.12 s to 0.67 s, and while it is it goes
// through whoever it meets — only the counter (an armed touch) answers it then. Visible again, it
// is the straight family: a kick blocks it, standing in its way gets you knocked back.
import * as C from '../constants.js';

export const ILLUSION = Object.freeze({
  FAKES: 0.12,      // s the seven fakes fly beside it (≈ 260 px, "a small distance")
  INV: 0.55,        // s it is then invisible — and passes through anyone ("go through the defender")
  DOWN: 0.15,       // its slope, vy / vx ("slightly downward", ≈ 8.5°): from the head-height release
                    // (constants.js POWER_RELEASE_UP) it first bounces ≈ 400 px out, where the wiki's
                    // "you can see it when it bounces" needs it (0.075 did that from a head-centre touch)
});

export default Object.freeze({
  stage: 4, id: 'illusion', hs: 'USA', hsPower: 'Illusion Shot', hsStars: 2,
  family: 'straight', speed: 1.0, ailment: null, ailSec: 0,
  name: 'Illusion', icon: '🎩', color: '#9fd0ff',
  desc: 'הכדור מתפצל לשמונה, רק אחד אמיתי — והוא נעלם באוויר ועובר דרך השוער.',
  sources: ['https://headsoccer.wiki.gg/wiki/USA', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide'],
  diff: { speed: 1.0, decoys: 7, decoyLife: ILLUSION.FAKES, invisible: ILLUSION.INV, through: 1 },

  launch(m, b, p, pw, S) {
    pw.vx0 = pw.dir * S; pw.vy0 = S * ILLUSION.DOWN;
    b.vx = pw.vx0; b.vy = pw.vy0;
  },
  step(m, b, dt, pw, S, kit, api) {
    if (pw.ph !== 'fly' || pw.rb || pw.hit) return undefined;
    // slightly downward, and it bounces off the grass (and the sky)
    const floor = C.GROUND_Y - b.r;
    if (b.y >= floor - 0.5 && pw.vy0 > 0) { pw.vy0 = -pw.vy0; m.events.push({ type: 'illusionBounce', x: b.x, y: floor }); }
    if (b.y <= C.SKY_Y + b.r && pw.vy0 < 0) pw.vy0 = -pw.vy0;
    b.vx = pw.vx0; b.vy = pw.vy0;
    pw.inv = pw.t >= ILLUSION.FAKES && pw.t < ILLUSION.FAKES + ILLUSION.INV ? 1 : 0;
    pw.t += dt;
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },
  contact(m, p, b, kit, pw) {
    if (!pw.inv) return undefined;
    pw.pass |= 1 << p.index;
    m.events.push({ type: 'powerHit', player: p.index, by: pw.owner, fam: pw.fam, cp: pw.cp, how: 'pass' });
    return 'pass';
  },
});
