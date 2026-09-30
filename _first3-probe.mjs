// The wiki's counter-plays against arcade stages 1-3 (docs/HS-FIRST-3-POWERS.md §3), run in our sim. node _first3-probe.mjs
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
const NONE = [{}, {}];
const headY = (p) => p.y - C.BODY_H - C.HEAD_R + C.NECK;
function run(stage, { gap, act, jumpAt = 0 }) {
  const m = createMatch({ rarity: 'epic', number: 1 }, { rarity: 'legendary', number: stage }, { champions: true, duration: 600 });
  m.freeze = 0; m.phase = 'play'; m.gaugeLead = 0; m.banner = null; m.bannerT = 0;
  const a = m.players[1], z = m.players[0];
  a.x = 700; z.x = 700 - gap;
  a.gauge = 1; a.prev = {}; m.hitStop = 0; step(m, [{}, { power: true }]); m.events.length = 0;
  m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = m.ball.vy = 0; step(m, NONE);
  const ev = []; let t = 0, pressed = false, jumped = false, rel = null, hit = null, maxUp = 0;
  const z0y = z.y;
  for (let i = 0; i < 60 * 6 && m.phase === 'play'; i++) {
    const b = m.ball, inp = [{}, {}];
    // 'jumpEarly': he jumps under the cut-in (it does not freeze him) so he is in the air as it fires
    if (act === 'jumpEarly' && !jumped && m.hitStop > 0 && m.hitStop < jumpAt) { inp[0] = { jump: true }; jumped = true; }
    if (act === 'kick' && !pressed && b.power && Math.abs(b.x - z.x) < 130 && m.hitStop <= 0) { inp[0] = { kick: true }; pressed = true; }
    if (act === 'jump' && !jumped && b.power && Math.abs(b.x - z.x) < 220 && m.hitStop <= 0) { inp[0] = { jump: true }; jumped = true; }
    step(m, inp); t += C.TICK;
    if (rel === null && m.hitStop <= 0 && b.power) rel = t;
    maxUp = Math.max(maxUp, z0y - z.y);
    for (const e of m.events) { ev.push(e.type + (e.how ? ':' + e.how : '') + (e.ail ? ':' + e.ail : '') + (e.type === 'goal' ? ':' + e.side + '/scorer' + e.scorer : '')); if (!hit && e.type === 'powerHit') hit = t; }
    m.events.length = 0;
  }
  const goals = m.score.join('-');
  return { stage, gap, act, rel: rel && +rel.toFixed(2), hit: hit && +hit.toFixed(2), flight: hit && rel ? +(hit - rel).toFixed(3) : null, zUp: Math.round(maxUp), score: `seat0 ${m.score[0]} : champion ${m.score[1]}`, ev: [...new Set(ev)].filter((x) => !/kick$|^step|touch|bounce/.test(x)).slice(0, 12).join(' ') };
}
for (const st of [1, 2, 3]) {
  for (const o of [{ gap: 500, act: 'stand' }, { gap: 500, act: 'kick' }, { gap: 500, act: 'jump' }, { gap: 90, act: 'jumpEarly', jumpAt: 0.3 }, { gap: 150, act: 'jumpEarly', jumpAt: 0.3 }, { gap: 70, act: 'stand' }]) {
    console.log(JSON.stringify(run(st, o)));
  }
}
