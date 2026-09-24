// The drawn characters (public/characters.js, docs/CHARACTERS.md): every registered card has
// every expression on disk, each file is small and WKWebView-safe, and the face follows the
// match state the way the renderer expects.
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CHARACTERS, EXPRESSIONS, CHAR_BOX, characterFor, charUrl, expressionFor } from './public/characters.js';

let n = 0;
for (const [key, ch] of Object.entries(CHARACTERS)) {
  const [r, num] = key.split(':');
  assert.equal(characterFor(r, +num), ch, `${key} resolves`);
  for (const e of EXPRESSIONS) {
    const file = `${import.meta.dirname}/public/${charUrl(ch, e)}`;
    assert.ok(existsSync(file), `${file} exists`);
    const svg = readFileSync(file, 'utf8');
    assert.ok(svg.length < 15 * 1024, `${file} under 15 KB (${svg.length})`);
    assert.ok(!/<filter|<foreignObject|<image|<script|mask=/.test(svg), `${file}: plain paths only`);
    assert.ok(svg.includes(`viewBox="${-CHAR_BOX.x} ${-CHAR_BOX.y} ${CHAR_BOX.w} ${CHAR_BOX.h}"`), `${file}: shared frame`);
    n++;
  }
}
assert.equal(characterFor('common', 1), null, 'other cards keep their photo');
assert.equal(charUrl(CHARACTERS['legendary:1'], 'nope'), 'img/chars/legendary-1/normal.svg');

const p = (o = {}) => ({ index: 0, stunned: 0, kickT: 0, ...o });
assert.equal(expressionFor({}, p()), 'normal');
assert.equal(expressionFor({}, p({ kickT: 0.1 })), 'kick');
assert.equal(expressionFor({}, p({ stunned: 0.5 })), 'hurt');
assert.equal(expressionFor({}, p({ hurt: 0.5 })), 'hurt');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 0 }, p()), 'happy');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 1 }, p()), 'sad');
assert.equal(expressionFor({ banner: 'goal', lastScorer: 1 }, p({ stunned: 1 })), 'hurt');
console.log(`characters: ${Object.keys(CHARACTERS).length} characters, ${n} faces OK`);
