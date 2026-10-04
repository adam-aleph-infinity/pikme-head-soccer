// THE COUNTER BY KICK, its timing window: a straight power shot at a standing defender ~900 px away,
// KICK pressed `lead` seconds before the ball would reach him (and JUMP `jump` s before, if given);
// which leads block it, which get him hit. HS: all three of the human's kick-blocks in M4 were a jump
// 0.3–0.5 s before the ball arrived and the kick 0.0–0.17 s before.
//   node _block-window.mjs [jump=none] [up=0]   (up: the shot leaves that many px higher)
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { shotById } from './shared/hs-powers.js';
const jumpLead = process.argv[2] && process.argv[2] !== 'none' ? Number(process.argv[2]) : null, up = Number(process.argv[3] || 0);
const row = [];
for (let lead = 0; lead <= 0.4001; lead += 1 / 60) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  m.freeze = 0; m.phase = 'play'; m.banner = null; m.gaugeLead = 0;
  const a = m.players[0], d = m.players[1];
  a.shot = shotById("straight"); d.x = Math.min(C.W - C.GOAL_W - 60, a.x + 900);
  a.gauge = 1; step(m, [{ power: true }, {}]); m.events.length = 0;
  for (let t = 0; t < 40 && !m.ball.power; t++) { m.hitStop = 0; m.ball.x = a.x; m.ball.y = headY(a); m.ball.vx = m.ball.vy = 0; step(m, [{}, {}]); m.events.length = 0; }
  m.hitStop = 0; m.cutin = 0; m.cutinBy = -1;
  m.ball.y -= up;
  let res = 'goal/miss', pressed = false, jumped = false;
  for (let t = 0; t < 90; t++) {
    const tArr = (d.x - m.ball.x - 20) / Math.abs(m.ball.vx || 1);
    const press = !pressed && m.ball.power && tArr <= lead + 1e-6;
    if (press) pressed = true;
    const jump = jumpLead != null && !jumped && m.ball.power && tArr <= jumpLead + 1e-6;
    if (jump) jumped = true;
    step(m, [{}, { kick: press, jump }]);
    const e = m.events.find((e) => (e.type === 'blocked' || e.type === 'powerHit') && e.player === 1);
    m.events.length = 0;
    if (e) { res = e.type === 'blocked' ? 'BLOCK' : 'hit'; break; }
  }
  row.push(`${(lead * 1000).toFixed(0).padStart(3)}ms ${res}`);
}
const ok = row.filter((r) => r.includes('BLOCK')).map((r) => parseInt(r));
console.log(`jump ${jumpLead ?? 'none'}, shot +${up}px: ` + (ok.length ? `BLOCK for a kick ${ok[0]}–${ok[ok.length - 1]} ms before (${ok.length} of ${row.length} leads)` : 'no lead blocks') + `  [${row.map((r) => r.includes('BLOCK') ? 'B' : r.includes('hit') ? 'h' : '.').join('')}]`);
