// Validates docs/hs-45-powers.json, the spec giving each of the 45 champions its own Head Soccer
// character's power shot (docs/HS-45-POWERS.md): 45 unique stages and characters, every field
// present ("unknown" allowed and counted), escalating difficulty, and 4 balanced batches.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const rows = JSON.parse(fs.readFileSync(new URL('./docs/hs-45-powers.json', import.meta.url), 'utf8'));
const map = JSON.parse(fs.readFileSync(new URL('./docs/hs-champion-map.json', import.meta.url), 'utf8'));
const FAMILIES = ['straight', 'ground', 'downward', 'destructive', 'aerial', 'delay', 'grab', 'multiball', 'updown', 'ailment', 'critical'];
const TEXT = ['ourTitle', 'hsCharacter', 'powerName', 'flight', 'visual', 'defenderEffect', 'blockCounter', 'powerButtonEffect', 'titleClash', 'whyHarderThanPrevious'];
const RESEARCH = ['flight', 'visual', 'defenderEffect', 'blockCounter', 'powerButtonEffect'];

assert.equal(rows.length, 45, '45 rows');
assert.deepEqual(rows.map((r) => r.stage), Array.from({ length: 45 }, (_, i) => i + 1), 'stages 1..45, unique, in order');
assert.equal(new Set(rows.map((r) => r.hsCharacter)).size, 45, '45 unique HS characters');

const titles = new Map(map.map((r) => [r.stage, r]));
let unknown = 0, prev = -Infinity;
for (const r of rows) {
  const at = `stage ${r.stage} (${r.hsCharacter})`;
  for (const f of TEXT) assert.ok(typeof r[f] === 'string' && r[f].trim(), `${at}: ${f} present`);
  unknown += RESEARCH.filter((f) => /^unknown/.test(r[f])).length;
  assert.equal(r.ourTitle, titles.get(r.stage).title, `${at}: keeps its Hebrew title`);
  assert.equal(r.id, titles.get(r.stage).id, `${at}: id`);
  assert.equal(r.rank, r.stage, `${at}: rank`);
  assert.ok(r.stars >= 0.5 && r.stars <= 5 && Number.isInteger(r.stars * 2), `${at}: stars 0.5..5`);
  assert.ok(r.sources && /^https:\/\/headsoccer\.wiki\.gg\/wiki\//.test(r.sources.P), `${at}: character page cited`);
  assert.ok(FAMILIES.includes(r.engine?.family), `${at}: engine family`);
  assert.ok(r.engine.ailment && r.engine.needs, `${at}: engine ailment + needs`);
  assert.ok([1, 2, 3, 4].includes(r.batch), `${at}: batch 1..4`);
  const s = r.score;
  assert.equal(s.stars, r.stars, `${at}: score uses the stars`);
  assert.ok(s.defend >= 1 && s.defend <= 9 && s.spectacle >= 0 && s.spectacle <= 9, `${at}: score parts in range`);
  assert.equal(s.total, s.stars * 100 + s.defend * 10 + s.spectacle, `${at}: score total`);
  assert.ok(s.total >= prev, `${at}: difficulty ${s.total} not below the previous ${prev}`);
  prev = s.total;
}
for (let b = 1; b <= 4; b++) {
  const n = rows.filter((r) => r.batch === b).length;
  assert.ok(n >= 10 && n <= 12, `batch ${b} has ${n} (10-12)`);
}
console.log(`hs-45-powers ok: 45 characters, ${unknown}/${rows.length * RESEARCH.length} research fields unknown`);
