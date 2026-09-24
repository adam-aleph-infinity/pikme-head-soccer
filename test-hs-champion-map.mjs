// Validates docs/hs-champion-map.json, the approved map of each arcade champion onto a Head Soccer
// power-shot family — and that shared/hs-champion-map.js, the copy the game reads, is exactly it.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const rows = JSON.parse(fs.readFileSync(new URL('./docs/hs-champion-map.json', import.meta.url), 'utf8'));
const FAMILIES = ['straight', 'ground', 'downward', 'destructive', 'aerial', 'delay', 'grab', 'multiball', 'updown', 'ailment', 'critical'];
const AILMENTS = [null, 'reverse', 'shock', 'freeze', 'beheaded', 'burn', 'stars'];
const AURAS = ['none', 'stun', 'push', 'reverse', 'freeze'];
const STATS = ['speed', 'jump', 'kick', 'dash', 'power'];

assert.equal(rows.length, 45, '45 rows');
assert.deepEqual(rows.map((r) => r.stage).sort((a, b) => a - b), Array.from({ length: 45 }, (_, i) => i + 1), 'stages 1..45 unique');
rows.sort((a, b) => a.stage - b.stage);

const counts = {};
let prevTotal = null, prevStars = -Infinity, prevIntensity = 0, prevRadius = 0;
const radiusByTier = {};
for (const r of rows) {
  const at = `stage ${r.stage}`;
  assert.ok(FAMILIES.includes(r.family), `${at}: family ${r.family}`);
  assert.ok(AILMENTS.includes(r.ailment), `${at}: ailment ${r.ailment}`);
  assert.ok(AURAS.includes(r.aura), `${at}: aura ${r.aura}`);
  let total = 0;
  for (const k of STATS) {
    const v = r.stats[k];
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 10, `${at}: ${k}=${v}`);
    total += v;
  }
  assert.equal(r.statTotal, total, `${at}: statTotal`);
  if (prevTotal !== null) assert.ok(Math.abs(total - prevTotal) <= 2 && total >= prevTotal - 2, `${at}: total ${prevTotal}→${total}`);
  assert.ok(r.stars >= 0.5 && r.stars <= 5 && r.stars >= prevStars, `${at}: stars ${r.stars}`);
  assert.ok(typeof r.intensity === 'number' && r.intensity >= 0 && r.intensity <= 1, `${at}: intensity ${r.intensity}`);
  if (r.gentle) assert.ok(r.intensity <= 0.15, `${at}: gentle but intensity ${r.intensity}`);
  else { assert.ok(r.intensity >= prevIntensity, `${at}: intensity ${prevIntensity}→${r.intensity}`); prevIntensity = r.intensity; }
  if (r.aura === 'none') assert.equal(r.auraRadius, 0, `${at}: no aura, radius ${r.auraRadius}`);
  else {
    assert.ok(r.auraRadius > 0 && r.auraRadius >= prevRadius, `${at}: aura radius ${prevRadius}→${r.auraRadius}`);
    radiusByTier[r.tier] = radiusByTier[r.tier] ?? r.auraRadius;
    assert.equal(r.auraRadius, radiusByTier[r.tier], `${at}: one radius per tier`);
    prevRadius = r.auraRadius;
  }
  prevTotal = total; prevStars = r.stars;
  counts[r.family] = (counts[r.family] || 0) + 1;
}
assert.ok(rows[44].statTotal > rows[0].statTotal, 'totals climb overall');
assert.deepEqual(rows.filter((r) => r.gentle).map((r) => r.stage), [2, 6], 'gentle rows are stages 2 and 6');
for (const f of FAMILIES) assert.ok(counts[f] >= 3 && counts[f] <= 6, `family ${f}: ${counts[f]}`);

// The game reads the module, not the JSON (a phone cannot fetch docs/): it must be the JSON's copy.
const { renderMap, MAP_MODULE } = await import('./scripts/champions-doc.mjs');
assert.equal(fs.readFileSync(MAP_MODULE, 'utf8'), renderMap(), 'shared/hs-champion-map.js is stale — run node scripts/champions-doc.mjs');
const { HS_MAP } = await import('./shared/hs-champion-map.js');
for (const r of rows) {
  const g = HS_MAP[r.stage - 1];
  assert.ok(g && g.family === r.family && g.ailment === r.ailment && g.aura === r.aura && g.intensity === r.intensity, `module row ${r.stage}`);
}

console.log('test-hs-champion-map: ok');
