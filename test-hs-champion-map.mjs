// Validates docs/hs-champion-map.json, the Phase D draft that maps each arcade champion onto a
// Head Soccer power-shot family. Nothing in the game reads it yet; this keeps it well-formed.
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
let prevTotal = null, prevStars = -Infinity;
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
  prevTotal = total; prevStars = r.stars;
  counts[r.family] = (counts[r.family] || 0) + 1;
}
assert.ok(rows[44].statTotal > rows[0].statTotal, 'totals climb overall');
for (const f of FAMILIES) assert.ok(counts[f] >= 3 && counts[f] <= 6, `family ${f}: ${counts[f]}`);

console.log('test-hs-champion-map: ok');
