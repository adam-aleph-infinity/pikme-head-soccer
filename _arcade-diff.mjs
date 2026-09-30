// HOW HARD ARE THE FIRST ARCADE STAGES, AGAINST HS'S? node _arcade-diff.mjs [stages…]
// Each stage's champion exactly as the arcade fields it (hs-scenarios arcadeMatch: its card, HS
// stats, power and bot profile) against the parity's level-3 stand-in, measured by the very fits
// that measured HS's weakest CPU off Idan's footage (docs/hs-reference.json cpu.*.weak: M4, M5),
// and by the ones that measured the parity's own weakest bot (cpuWeak) for scale.
import { SCENARIOS, arcadeMatch, runTakes } from './hs-scenarios.mjs';
import { measureTracks } from './tools/hs-fit-lib.mjs';
import { readFileSync } from 'node:fs';
const ref = JSON.parse(readFileSync(new URL('./docs/hs-reference.json', import.meta.url)));
const hs = (id) => ref.find((e) => e.id === id)?.value;
const IDS = ['touchesPerMin', 'kicksPerMin', 'jumpsPerMin', 'dashesPerMin', 'meanDepth', 'rangeConv', 'powerDelay', 'goals'];
const STAGES = process.argv.slice(2).map(Number).filter(Boolean);
const mean = (docs, id) => { const v = docs.map((d) => measureTracks(d, [id])[id].value).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const row = (name, docs) => IDS.map((k) => mean(docs, `cpu.${k}`).toFixed(k === 'rangeConv' ? 2 : 1).padStart(7)).join('') + `   ${name}`;
console.log(IDS.map((k) => k.replace('PerMin', '/min').padStart(7).slice(-7)).join(''));
console.log(IDS.map((k) => String(hs(`cpu.${k}.weak`) ?? '').slice(0, 6).padStart(7)).join('') + '   HS weakest CPU (M4, M5)');
console.log(row('ours, parity cpuWeak (DIFFICULTIES[0])', runTakes('cpuWeak')));
for (const n of STAGES.length ? STAGES : [1, 2, 3]) {
  SCENARIOS[`arcade${n}`] = arcadeMatch(n);
  console.log(row(`ours, arcade stage ${n}`, runTakes(`arcade${n}`)));
}
