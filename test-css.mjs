// The stylesheet's own grammar. Run: node test-css.mjs
//
// Nothing else parses public/style.css: the browser forgives a stray `}` by quietly eating the
// NEXT rule, so a broken brace shows up as some unrelated thing losing its style (the arcade
// result's subtitle went back to 20px dim text that way, 2026-10-06). Braces are counted with
// comments and strings taken out, and every block has to close where it opened.
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// Each stylesheet, and rules it cannot do without: if one of these goes, a brace above it ate it.
const FILES = {
  'public/style.css': ['#vs.vs', '.screen', '.hidden', '.banner'],
  'public/menus.css': ['.m-pill', '.m-panel', '.m-result', '.rl-item', '.m-pop'],
};
const blank = (m) => m.replace(/[^\n]/g, ' ');
for (const [FILE, must] of Object.entries(FILES)) {
  const src = readFileSync(new URL(FILE, import.meta.url), 'utf8');
  // Comments and strings out, newlines kept so line numbers still point at the right place.
  const bare = src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank);
  ok(`${FILE}: every comment is closed`, !/\/\*(?![\s\S]*\*\/)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  let depth = 0, line = 1, firstBad = 0;
  for (const ch of bare) {
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0 && !firstBad) { firstBad = line; depth = 0; }
  }
  ok(`${FILE}: no \`}\` closes a block that was never opened`, !firstBad, `${FILE}:${firstBad}`);
  ok(`${FILE}: every \`{\` is closed by the end of the file`, depth === 0, `${depth} still open`);
  for (const sel of must) {
    ok(`${FILE}: ${sel} is a rule of its own`, new RegExp(`(^|[}\\s,])${sel.replace(/[.#]/g, '\\$&')}\\s*[{,]`, 'm').test(bare));
  }
}

console.log(`test-css: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
