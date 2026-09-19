// The scoreboard's own arithmetic. Run: node test-hud.mjs
//
// The rest of the HUD is a layout, and a layout is only true in pixels — that half lives in
// _hudshots.mjs, which drives a real browser across five screen sizes. What is left is the
// one thing on the board that is computed rather than positioned: the clock's text. It runs
// here, in node, on every `npm test`, because "0:59" vs "59" is a rule and not a picture.
import { clockText } from './public/hud.js';
import * as C from './shared/constants.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// ── M:SS, THE FOOTBALL FORMAT ────────────────────────────────────────────────
ok('a full minute reads 1:00', clockText(60) === '1:00', clockText(60));
ok('the second below it reads 0:59', clockText(59) === '0:59', clockText(59));
ok('seconds always carry two digits', clockText(9) === '0:09', clockText(9));
ok('and so does the ten-second mark', clockText(10) === '0:10', clockText(10));
ok('full time reads 0:00', clockText(0) === '0:00', clockText(0));
ok('two and a half minutes reads 2:30', clockText(150) === '2:30', clockText(150));

// A clock is a float counting down, and the board shows the second you are IN — the same
// rule the old bare `Math.ceil(clock)` used, kept so a 60s match still opens on its full
// duration and the last whole second on the board is 0:01 rather than a doubled 0:00.
ok('a part-second counts as the second you are in', clockText(46.4) === '0:47', clockText(46.4));
ok('the last tick before the whistle is 0:01', clockText(0.02) === '0:01', clockText(0.02));

// The clock is driven straight off MATCH.clock, which can undershoot zero by a frame between
// `m.clock -= dt` and the clamp on the next line. A negative must never print as -1:59.
ok('a clock past zero never goes negative', clockText(-0.4) === '0:00', clockText(-0.4));
ok('nor does a broken one', clockText(NaN) === '0:00' && clockText(undefined) === '0:00');

// ── SUDDEN DEATH ─────────────────────────────────────────────────────────────
// No number to show, and the two Hebrew letters it always had are what the rest of the game
// (and _shot.mjs) expects to find in #clock.
ok('golden goal keeps its own label', clockText(12, true) === 'ג.ג', clockText(12, true));
ok('and that label wins over whatever the clock says', clockText(0, true) === 'ג.ג');

// ── THE SHIPPED MATCH ────────────────────────────────────────────────────────
// The format has to suit the duration the game actually ships with, not a hypothetical one:
// a board 4.6ch wide holds M:SS and nothing longer.
ok('the shipped match length fits the board', clockText(C.MATCH_DURATION).length <= 4,
   `${C.MATCH_DURATION}s → ${clockText(C.MATCH_DURATION)}`);
ok('every second of it formats to four characters',
   Array.from({ length: Math.ceil(C.MATCH_DURATION) + 1 }, (_, i) => clockText(i))
     .every((t) => /^\d:[0-5]\d$/.test(t)));

console.log(`hud: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
