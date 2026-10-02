// HOW FAR THE CPU GOES — its depth from its own wall (px; the pitch is 1060, halfway 530) over a
// long CPU match, as quartiles and p10/p90, against HS (docs/hs-reference.json cpu.meanDepth note:
// the five-star CPU's p10-p90 26-796, quartiles 166-660, mean 427; the weak ones mean 325).
// The frames are every tick of play (kickoff freezes and goal restarts left out).
//   node _cpu-depth.mjs
import { runTakes } from './hs-scenarios.mjs';
import * as C from './shared/constants.js';
for (const [name, hs] of [['cpuStrong', 'HS mean 427, p10-p90 26-796, quartiles 166-660'], ['cpuWeak', 'HS mean 325']]) {
  const xs = [];
  let deepHalf = 0;
  for (const doc of runTakes(name)) for (const f of doc.frames) if (f.p1) { const d = C.W - f.p1.x; xs.push(d); if (d > C.W / 2) deepHalf++; }
  xs.sort((a, b) => a - b);
  const q = (f) => Math.round(xs[Math.floor(xs.length * f)]);
  const mean = Math.round(xs.reduce((s, v) => s + v, 0) / xs.length);
  console.log(`${name.padEnd(9)} mean ${mean}  p10 ${q(0.1)}  p25 ${q(0.25)}  p50 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${q(0.999)}  in the other half ${(100 * deepHalf / xs.length).toFixed(1)}%   (${hs})`);
}
