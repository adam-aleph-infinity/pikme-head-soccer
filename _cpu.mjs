// THE BOT AGAINST THE HEAD SOCCER CPU. Run: node _cpu.mjs [scenario,scenario]
//
// Prints the cpu.* metrics (tools/hs-fit-lib.mjs) for the whole-match scenarios in
// hs-scenarios.mjs — cpuStrong (tier-5 bot on the right vs the tier-3 stand-in), cpuWeak (tier 0),
// botMatch — as the mean over each scenario's seeded takes, next to the HS values measured
// off Idan's footage (docs/hs-estimates.json cpu.*). The tuning loop for shared/bot.js.
import { runTakes, SCENARIOS } from './hs-scenarios.mjs';
import { measureTracks } from './tools/hs-fit-lib.mjs';

const ids = ['cpu.touchesPerMin', 'cpu.jumpsPerMin', 'cpu.kicksPerMin', 'cpu.dashesPerMin', 'cpu.meanDepth', 'cpu.rangeConv', 'cpu.powerDelay', 'match.goals'];
for (const sc of (process.argv[2] || 'cpuStrong,cpuWeak,botMatch').split(',')) {
  // SEEDS=24 for a steadier number while tuning; the parity harness always runs the scenario's own.
  if (process.env.SEEDS) SCENARIOS[sc].seeds = +process.env.SEEDS;
  const docs = runTakes(sc);
  const per = docs.map((d) => measureTracks(d, ids));
  const row = ids.map((id) => {
    const v = per.map((p) => p[id].value).filter((x) => x != null && Number.isFinite(x));
    return `${id.replace('cpu.', '').replace('PerMin', '')} ${v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(id === 'cpu.rangeConv' ? 2 : 1) : '-'}`;
  });
  const cg = docs.map((d) => d.tags.filter((t) => t.type === 'goal' && t.note === 'cpu').length);
  console.log(sc.padEnd(10), row.join(' | '), '| cpuGoals', (cg.reduce((a, b) => a + b, 0) / cg.length).toFixed(2));
}
