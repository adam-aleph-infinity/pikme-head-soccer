// The real-face characters (public/characters.js, docs/CHARACTERS.md): every registered card has
// every expression on disk as a small WebP with alpha in the shared frame, and the face follows
// the match state the way the renderer expects.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CHARACTERS, EXPRESSIONS, CHAR_BOX, characterFor, charUrl, expressionFor } from './public/characters.js';

// WebP header: RIFF....WEBPVP8X, canvas size in the VP8X chunk (24-bit, minus one), alpha flag.
function webpInfo(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buf.toString('ascii', 12, 16), 'VP8X', 'extended WebP (alpha)');
  const w = 1 + buf.readUIntLE(24, 3), h = 1 + buf.readUIntLE(27, 3);
  return { w, h, alpha: !!(buf[20] & 0x10) };
}

let n = 0;
for (const [key, ch] of Object.entries(CHARACTERS)) {
  const [r, num] = key.split(':');
  assert.equal(characterFor(r, +num), ch, `${key} resolves`);
  let total = 0;
  for (const e of EXPRESSIONS) {
    const file = `${import.meta.dirname}/public/${charUrl(ch, e)}`;
    assert.ok(existsSync(file), `${file} exists`);
    const buf = readFileSync(file);
    total += buf.length;
    const { w, h, alpha } = webpInfo(buf);
    assert.ok(alpha, `${file} has alpha`);
    assert.equal(w, CHAR_BOX.w * 3, `${file}: frame width (3 px per unit)`);
    assert.equal(h, CHAR_BOX.h * 3, `${file}: frame height`);
    n++;
  }
  assert.ok(total < 150 * 1024, `${key}: all faces under 150 KB (${total})`);
  assert.ok(Array.isArray(ch.nose) && ch.nose.every((v) => v > 0.3 && v < 0.8), `${key}: nose for the bruise`);
  // nothing left over from the drawn-cartoon era
  assert.deepEqual(readdirSync(`${import.meta.dirname}/public/img/chars/${ch.dir}`).filter((f) => !f.endsWith('.webp')), []);
}
assert.equal(characterFor('common', 1), null, 'other cards keep their photo');
assert.equal(charUrl(CHARACTERS['legendary:1'], 'nope'), 'img/chars/legendary-1/normal.webp');

const p = (o = {}) => ({ index: 0, stunned: 0, kickT: 0, ...o });
assert.equal(expressionFor({}, p()), 'normal');
assert.equal(expressionFor({}, p({ kickT: 0.1 })), 'kick');
assert.equal(expressionFor({}, p({ stunned: 0.5 })), 'hurt');
// The bruise tier (`hurt`, kept all match) is a mark on the face, not a face held all match.
assert.equal(expressionFor({}, p({ hurt: 2 })), 'normal');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 0 }, p()), 'happy');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 1 }, p()), 'sad');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 1 }, p({ stunned: 1 })), 'hurt');
console.log(`characters: ${Object.keys(CHARACTERS).length} characters, ${n} faces OK`);
