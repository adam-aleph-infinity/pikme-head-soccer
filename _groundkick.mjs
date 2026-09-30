// A BALL ON THE GRASS, STRUCK: kick / walk+kick / dash / dash+kick into a still ball, in our sim,
// measured the way the HS footage is (tools/hs-fit-lib.mjs detectContacts + launch, 7 frames).
//   node _groundkick.mjs         → per case: speed and angle spread
//   node _groundkick.mjs -v      → every take
// HS (docs/HS-PHYSICS.md, M1–M5): kicks on a grass ball 440–1600 px/s at 0–20° (median ~10°);
// dash touches 1600–2300 px/s at −7…17° (mostly 0–10°).
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { detectContacts, launch, median } from './tools/hs-fit-lib.mjs';

function take({ dx, vx0 = 0, walk = false, dash = false, kickAt = null }) {
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  m.freeze = 0; m.phase = 'play';
  const P = m.players[0]; P.x = 300; m.players[1].x = 950;
  const b = m.ball; b.x = P.x + dx; b.y = C.GROUND_Y - b.r; b.vx = vx0; b.vy = 0; b.spin = 0;
  const pts = [];
  for (let i = 0; i < 60; i++) {
    let inp = {};
    if (walk) inp.right = true;
    if (dash) inp = { right: i === 0 || i === 3 || (i > 3 && i < 12) };   // double tap → dash
    if (kickAt != null && i === kickAt) inp.kick = true;
    step(m, [inp, {}]);
    m.events.length = 0;
    pts.push({ t: (i + 1) / 60, x: b.x, y: b.y });
  }
  const cs = [...detectContacts(pts, { axis: 'x', minDv: 150 }), ...detectContacts(pts, { axis: 'y', minDv: 150 })].sort((a, c) => a - c);
  if (!cs.length) return null;
  const l = launch(pts, cs[0], { n: 7 });
  return l && l.speed > 150 ? { speed: l.speed, angle: l.angle } : null;
}

const CASES = {
  'kick, standing':   () => [30, 40, 50, 60].flatMap((dx) => [0, 1, 2, 3, 4, 5, 6].map((k) => ({ dx, kickAt: k }))),
  'kick, ball rolling in': () => [50, 60, 70, 80].flatMap((dx) => [0, 2, 4, 6, 8].map((k) => ({ dx, vx0: -80, kickAt: k }))),
  'walk + kick':      () => [60, 80, 100].flatMap((dx) => [0, 3, 6, 9, 12, 15, 18].map((k) => ({ dx, walk: true, kickAt: k }))),
  'dash':             () => [60, 90, 120, 150].map((dx) => ({ dx, dash: true })),
  'dash + kick':      () => [80, 110, 140].flatMap((dx) => [2, 3, 4, 5, 6].map((k) => ({ dx, dash: true, kickAt: k }))),
};
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
for (const [name, gen] of Object.entries(CASES)) {
  const R = gen().map(take).filter(Boolean);
  if (!R.length) { console.log(name.padEnd(22), 'no contact'); continue; }
  const s = R.map((r) => r.speed), a = R.map((r) => r.angle);
  console.log(`${name.padEnd(22)} n=${String(R.length).padStart(2)}  speed ${q(s, 0.1).toFixed(0)}–${q(s, 0.9).toFixed(0)} (med ${median(s).toFixed(0)})  angle ${q(a, 0.1).toFixed(0)}…${q(a, 0.9).toFixed(0)}° (med ${median(a).toFixed(0)}°)  ≥5°: ${(100 * a.filter((x) => x >= 5).length / a.length).toFixed(0)}%`);
  if (process.argv.includes('-v')) console.log('   ', R.map((r) => `${r.speed.toFixed(0)}@${r.angle.toFixed(0)}`).join(' '));
}
