// OUR KICK, controlled: ball placed ahead of a standing kicker at 0–100 px up, KICK pressed at 0–10 ticks.
//   node _kickgrid.mjs  → per height: median, fastest, fastest flat (<35°) launch
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
const out = [];
for (const up of [0, 20, 40, 60, 80, 100]) for (const dx of [35, 45, 55, 65]) for (const vy of [0, 300]) for (const p of [0, 2, 4, 6, 8, 10]) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  m.freeze = 0; m.phase = 'play';
  const P = m.players[0]; P.x = 300; m.players[1].x = 900;
  const b = m.ball; b.x = P.x + dx; b.y = C.GROUND_Y - b.r - up; b.vx = up === 0 ? -60 : 0; b.vy = up === 0 ? 0 : vy; b.spin = 0;
  let hit = null;
  for (let i = 0; i < 40; i++) {
    step(m, [i === p ? { kick: true } : {}, {}]);
    if (hit == null && m.events.some((e) => e.type === 'strike' && e.player === 0)) hit = i;
    m.events.length = 0;
    if (hit != null && i === hit + 4) break;
  }
  if (hit == null) continue;
  out.push({ up, sp: Math.hypot(b.vx, b.vy), ang: Math.atan2(-b.vy, b.vx) * 180 / Math.PI });
}
for (const up of [0, 20, 40, 60, 80, 100]) {
  const R = out.filter((o) => o.up === up); if (!R.length) continue;
  const best = R.reduce((a, c) => (c.sp > a.sp ? c : a));
  const flat = R.filter((o) => o.ang < 35);
  const bf = flat.length ? flat.reduce((a, c) => (c.sp > a.sp ? c : a)) : null;
  const med = R.map((o) => o.sp).sort((a, c) => a - c)[R.length >> 1];
  console.log(`ball ${String(up).padStart(3)}px up: n=${R.length} median ${med.toFixed(0)}  fastest ${best.sp.toFixed(0)} @${best.ang.toFixed(0)}°  fastest under 35°: ${bf ? bf.sp.toFixed(0) + ' @' + bf.ang.toFixed(0) + '°' : '-'}`);
}
