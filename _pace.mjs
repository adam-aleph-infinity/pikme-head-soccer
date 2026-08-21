// How slow can the game get before it stops being a game?
// PACE (shared/constants.js) is a true slow-motion scale, not a speed nerf. This sweep is
// the evidence behind the shipped default: it re-plays bot-vs-bot at each k and reports the
// three things that decide it — goal rate, whether skill still beats no-skill, and how long
// a struck ball takes to cross the pitch (the number a player feels as "no time to react").
// It also asserts the geometry is genuinely unchanged, which is what separates slow-motion
// from a nerf.
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

function play(la, lb, seed) {
  const rng = mulberry32(seed);
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const bots = [createBot(la, rng), createBot(lb, rng)];
  let t = 0, sum = 0, n = 0;
  while (m.phase !== 'over' && t < 30000) {
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    sum += Math.hypot(m.ball.vx, m.ball.vy); n++;
    m.events.length = 0; t++;
  }
  return { m, avg: sum / n };
}

// A free jump, simulated straight off the constants: apex height and hang time. Apex must
// not move with k (that is the whole claim); hang time must stretch by exactly 1/k.
function jumpArc() {
  let y = 0, vy = -C.JUMP_V, t = 0, apex = 0;
  while (y <= 0) {
    vy += C.PLAYER_GRAV * (vy > 0 ? C.FALL_MULT : 1) * C.TICK;
    y += vy * C.TICK; t += C.TICK;
    apex = Math.min(apex, y);
  }
  return { apex: -apex, hang: t };
}

const KS = process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 0.9, 0.8, 0.7, 0.6];
const N = Number(process.env.N || 20), G = Number(process.env.G || 24);
const shipped = C.PACE;
console.log(`shipped PACE = ${shipped}   (${N} matches per row, ${G} skill matches)`);
console.log('k     goals  ball avg  cross-pitch  jump apex  hang   legendary:very-easy');
for (const k of KS) {
  C.setPace(k);
  const arc = jumpArc();
  let goals = 0, avg = 0;
  for (let s = 0; s < N; s++) { const r = play(3, 3, 1000 + s * 13); goals += r.m.score[0] + r.m.score[1]; avg += r.avg; }
  let hard = 0, easy = 0, draw = 0;
  for (let s = 0; s < G; s++) { const { m } = play(5, 0, 4000 + s * 37); if (m.score[0] > m.score[1]) hard++; else if (m.score[1] > m.score[0]) easy++; else draw++; }
  const cross = C.W / (avg / N);
  console.log(`${k.toFixed(2)}  ${(goals / N).toFixed(1).padStart(5)}  ${(avg / N).toFixed(0).padStart(8)}  ${cross.toFixed(2)}s${' '.repeat(8)}${arc.apex.toFixed(0).padStart(4)}px  ${arc.hang.toFixed(2)}s  ${hard}:${easy} (${draw} draws)`);
}
C.setPace(shipped);

// Geometry invariance: the apex of a jump is v²/2g, so k on v and k² on g must cancel.
const a1 = (C.setPace(1), jumpArc()), a2 = (C.setPace(0.6), jumpArc());
C.setPace(shipped);
const drift = Math.abs(a1.apex - a2.apex) / a1.apex;
const stretch = a2.hang / a1.hang;
console.log(`\ngeometry: apex ${a1.apex.toFixed(1)} vs ${a2.apex.toFixed(1)} (${(drift * 100).toFixed(1)}% drift), hang x${stretch.toFixed(2)} (want x1.67)`);
if (drift > 0.02 || Math.abs(stretch - 1 / 0.6) > 0.05) { console.log('FAIL — pace is nerfing the game, not slowing it'); process.exit(1); }
console.log('ok — pace changes the clock, not the shapes');
