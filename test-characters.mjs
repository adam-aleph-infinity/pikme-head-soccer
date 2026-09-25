// The real-face characters (public/characters.js, docs/CHARACTERS.md): every registered card has
// every expression on disk as a small WebP with alpha in the shared frame, and the face follows
// the match state the way the renderer expects.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CHARACTERS, EXPRESSIONS, CHAR_BOX, CHAR_PX, characterFor, charUrl, expressionFor } from './public/characters.js';

// WebP header: RIFF....WEBP then either VP8X (canvas size 24-bit minus one, alpha flag) or, for
// the lossless pitch sprites, VP8L (14-bit width/height minus one, then the alpha-used bit).
function webpInfo(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff), alpha: !!((b >> 28) & 1) };
  }
  assert.equal(kind, 'VP8X', 'extended WebP (alpha)');
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
    assert.equal(w, CHAR_BOX.w * 4, `${file}: frame width (4 px per unit)`);
    assert.equal(h, CHAR_BOX.h * 4, `${file}: frame height`);
    // the pitch sprite: the same face at HS's in-match pixel density, same frame
    const pxFile = `${import.meta.dirname}/public/${charUrl(ch, e, true)}`;
    assert.ok(existsSync(pxFile), `${pxFile} exists`);
    const pbuf = readFileSync(pxFile);
    total += pbuf.length;
    const pi = webpInfo(pbuf);
    assert.ok(pi.alpha, `${pxFile} has alpha`);
    assert.deepEqual([pi.w, pi.h], [CHAR_PX.w, CHAR_PX.h], `${pxFile}: pitch sprite size`);
    n++;
  }
  assert.ok(total < 250 * 1024, `${key}: all faces under 250 KB (${total})`);   // the card props (worms, coins, tools) are the detail
  assert.ok(Array.isArray(ch.nose) && ch.nose.every((v) => v > 0.3 && v < 0.8), `${key}: nose for the bruise`);
  // nothing left over from the drawn-cartoon era
  assert.deepEqual(readdirSync(`${import.meta.dirname}/public/img/chars/${ch.dir}`).filter((f) => !f.endsWith('.webp')), []);
}
assert.equal(characterFor('common', 1), null, 'other cards keep their photo');
assert.equal(charUrl(CHARACTERS['legendary:1'], 'nope'), 'img/chars/legendary-1/normal.webp');
assert.equal(charUrl(CHARACTERS['legendary:1'], 'kick', true), 'img/chars/legendary-1/px-kick.webp');

const p = (o = {}) => ({ index: 0, stunned: 0, kickT: 0, ...o });
assert.equal(expressionFor({}, p()), 'normal');
// No expressions at all: kicking, stunned, after a goal — always the normal face.
for (const st of [{ kickT: 0.1 }, { stunned: 0.5 }, { hurt: 2 }]) assert.equal(expressionFor({ banner: 'goal', lastScorer: 0 }, p(st)), 'normal');
console.log(`characters: ${Object.keys(CHARACTERS).length} characters, ${n} faces OK`);
