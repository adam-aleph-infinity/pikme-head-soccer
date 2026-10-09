// STAGE 5 — JAPAN, "Ninja Shot" (2.5 stars).
//
// Wiki (Japan): "When activated and when Japan touches the ball, he turns into a log"; "Japan
// rises into the air surrounded by five soccer balls", then "a few streaks of blue light (the fake
// 'balls') will shoot downwards towards the goal with one green streak containing the ball".
// Power_Shot_Guide: "The first ball is always shot in the middle, the second one comes very low,
// the third ball is shot the highest of all, the fourth one is also shot high but just a tiny bit
// lower, and the last ball is in the middle again"; the green one "will always be shot randomly";
// "most of the time Japan shoots the ball high"; "Countering the shot is hard, but blocking is not
// and you can score in Japan's goal by doing this, but you will get knocked out."
// So: the ball goes up over the shooter's head and waits there, hidden among the five, for its turn
// in the volley (one streak every 0.13 s, the fakes are only drawn — public/vfx/powers/stage-05.js);
// then it flies a straight line down to its height at the goal line. A kick blocks it, but the
// blocker is knocked out for 1.2 s; standing in its way is the plain hit.
import * as C from '../constants.js';

export const NINJA = Object.freeze({
  UP: 140,          // px above the head where the five balls circle
  GAP: 0.13,        // s between streaks
  KO: 1.2,          // s a blocker is knocked out
});
// Heights at the goal line, as fractions of GOAL_H above the grass, in firing order.
export const NINJA_HEIGHTS = Object.freeze([0.5, 0.1, 0.9, 0.78, 0.5]);
// Which of the five carries the ball — a fixed deck, weighted high ("most of the time … high").
const DECK = [2, 3, 0, 2, 1, 3, 4, 2, 3, 0, 2, 1];
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);

// Where streak `i` is aimed: the goal line, at its height.
export function ninjaTarget(pw, i) {
  // (never so high that the ball's top meets the bar: it aims INTO the goal)
  return { x: goalLineX(pw.dir) + pw.dir * 20, y: C.GROUND_Y - Math.max(C.BALL_R + 3, Math.min(C.GOAL_H * NINJA_HEIGHTS[i], C.GOAL_H - C.POST_R - C.BALL_R - 3)) };
}

export default Object.freeze({
  stage: 5, id: 'ninja', hs: 'Japan', hsPower: 'Ninja Shot', hsStars: 2.5,
  family: 'downward', speed: 1.1, ailment: null, ailSec: 0,
  name: 'Ninja', icon: '🥷', color: '#3fd07a',
  desc: 'הופך לבול עץ, חמישה כדורים סביבו וחמש קרני אור יורדות לשער. רק הירוקה אמיתית.',
  sources: ['https://headsoccer.wiki.gg/wiki/Japan', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide'],
  diff: { speed: 1.1, decoys: 4, decoyLife: 1, above: 1, blockKO: NINJA.KO },

  launch(m, b, p, pw, S, kit) {
    // up over the shooter's head; the five circle there until the ball leaves the cut-in
    pw.x0 = b.x = Math.max(C.GOAL_W + 20, Math.min(C.W - C.GOAL_W - 20, p.x + pw.dir * 16));
    pw.y0 = b.y = Math.max(C.SKY_Y + 50, kit.headY(p) - NINJA.UP);
    pw.slot = DECK[Math.floor(m.t * 60 + p.index * 5) % DECK.length];
    pw.ph = 'nwait'; pw.k = 0;
    b.vx = 0; b.vy = 0;
  },
  step(m, b, dt, pw, S, kit, api) {
    if (pw.ph === 'nwait') {
      b.x = pw.x0; b.y = pw.y0; b.vx = 0; b.vy = 0;
      pw.k += dt;
      if (pw.k >= pw.slot * NINJA.GAP) {
        const T = ninjaTarget(pw, pw.slot);
        const dx = T.x - b.x, dy = T.y - b.y, d = Math.hypot(dx, dy) || 1;
        pw.vx0 = (dx / d) * S; pw.vy0 = (dy / d) * S;
        pw.ph = 'fly'; pw.t = 0;
        b.vx = pw.vx0; b.vy = pw.vy0;
        m.events.push({ type: 'ninjaGo', player: pw.owner, slot: pw.slot });
      }
      return true;
    }
    if (pw.ph !== 'fly' || pw.rb || pw.hit) return undefined;
    b.vx = pw.vx0; b.vy = pw.vy0;
    // a streak that reaches the grass (the very low one, fired from close in) runs along it
    if (b.y >= C.GROUND_Y - b.r - 0.5 && pw.vy0 > 0) { pw.vy0 = 0; pw.vx0 = pw.dir * S; b.y = C.GROUND_Y - b.r; }
    pw.t += dt;
    if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return api.end(b);
    return true;
  },
  skip: (pw) => pw.ph === 'nwait',
  contact(m, p, b, kit, pw, kicking, api) {
    if (!kicking) return undefined;
    const r = api.block(m, p, b, pw);
    // blocked — "but you will get knocked out"
    p.stunned = 0; kit.stun(m, p, NINJA.KO);
    api.ailment(m, p, 'stars', NINJA.KO);
    return r;
  },
});
