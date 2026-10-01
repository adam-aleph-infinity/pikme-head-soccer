// A human's kick at a ball COMING AT THEM: ball sent toward a standing kicker at 300/600/900 px/s,
// 0–80 px up, KICK pressed at every tick of the approach; the out speed of each strike.
//   TUNE='{"BOOT_BOUNCE":0.5,"BOOT_DRIVE":1}' node _kick-incoming.mjs   (the 2026-09-27 boot)
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
if (process.env.TUNE) C.tune(JSON.parse(process.env.TUNE));
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
for (const vin of [0, 300, 600, 900]) {
  const sp = [], ang = [];
  for (const up of [0, 20, 40, 60, 80]) for (let p = 0; p < 40; p++) {
    const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
    m.freeze = 0; m.phase = 'play';
    const P = m.players[0]; P.x = 300; m.players[1].x = 1000;
    const b = m.ball; b.x = P.x + 50 + vin * 0.35; b.y = C.GROUND_Y - b.r - up; b.vx = -vin; b.vy = 0; b.spin = 0;
    if (vin === 0) b.x = P.x + 50;
    let hit = null;
    for (let i = 0; i < 60; i++) {
      step(m, [i === p ? { kick: true } : {}, {}]);
      if (hit == null && m.events.some((e) => e.type === 'strike' && e.player === 0)) hit = i;
      m.events.length = 0;
      if (hit != null && i === hit + 3) break;
    }
    if (hit != null && b.vx > 0) { sp.push(Math.hypot(b.vx, b.vy)); ang.push(Math.atan2(-b.vy, b.vx) * 180 / Math.PI); }
  }
  if (sp.length) console.log(`ball in at ${String(vin).padStart(3)}: n=${String(sp.length).padStart(3)}  out median ${q(sp, 0.5).toFixed(0).padStart(4)}  p90 ${q(sp, 0.9).toFixed(0).padStart(4)}  angle med ${q(ang, 0.5).toFixed(0)}°`);
}
