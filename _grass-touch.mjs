// Who hits a ball on the grass, in bot matches, and how does it leave? Each tick the ball's
// velocity jumps while it is low, labelled boot (a 'strike' event that tick) or body/head.
//   TUNE='{"BOOT_BOUNCE":0.68}' node _grass-touch.mjs [matches]
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const R = {};
for (let s = 0; s < (Number(process.argv[2]) || 12); s++) {
  let seed = 1234 + s * 77; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const bots = [createBot(s % 2 ? 3 : 2, rng), createBot(s % 2 ? 1 : 2, rng)];
  for (let i = 0; i < 60 * 200 && m.phase !== 'over'; i++) {
    const b = m.ball, vx0 = b.vx, vy0 = b.vy, h0 = C.GROUND_Y - b.y;
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    const dv = Math.hypot(b.vx - vx0, b.vy - vy0);
    if (m.phase === 'play' && !b.power && h0 < 45 && dv > 250) {
      const strike = m.events.some((e) => e.type === 'strike');
      const p = m.players.reduce((a, c) => (Math.abs(c.x - b.x) < Math.abs(a.x - b.x) ? c : a));
      const k = strike ? (p.dashT > 0 ? 'boot+dash' : 'boot') : (p.dashT > 0 ? 'body+dash' : Math.abs(p.vx) > 50 ? 'body walking' : 'body standing');
      (R[k] ||= []).push([Math.hypot(b.vx, b.vy), Math.atan2(-b.vy, Math.abs(b.vx)) * 180 / Math.PI]);
    }
    m.events.length = 0;
  }
}
for (const [k, v] of Object.entries(R)) console.log(k.padEnd(14), `n=${String(v.length).padStart(4)}  speed med ${med(v.map((x) => x[0])).toFixed(0).padStart(5)}  angle med ${med(v.map((x) => x[1])).toFixed(0).padStart(3)}°`);
