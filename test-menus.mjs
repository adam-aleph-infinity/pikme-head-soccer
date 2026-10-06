// The menus' rules, in node. Run: node test-menus.mjs
//
// What a screen looks like is checked in a real browser (_menu-shots.mjs); this is the part
// that is a decision — where the carousel loops, where a released reel lands, which cards your
// reel offers, what the result screen's buttons say and where Player Select reopens.
import * as M from './shared/menu.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// ── the carousel ──
ok('three modes, arcade first', M.MODES.map((m) => m.id).join() === 'arcade,multi,practice');
ok('wrap keeps an index on the ring', M.wrap(-1, 3) === 2 && M.wrap(3, 3) === 0 && M.wrap(7, 3) === 1);
ok('arcade centred: multi to its right, practice to its left', M.carouselOffsets(0, 3).join() === '0,1,-1');
ok('multi centred: practice right, arcade left', M.carouselOffsets(1, 3).join() === '-1,0,1');
ok('every mode is somewhere, one of them in the middle', [0, 1, 2].every((c) => M.carouselOffsets(c, 3).filter((d) => d === 0).length === 1));
ok('five modes spread two either side', M.carouselOffsets(0, 5).join() === '0,1,2,-2,-1');

// ── the reels ──
const mid = M.reelLook(0), one = M.reelLook(1), far = M.reelLook(3.5);
ok('the middle item is full size and opaque', mid.scale === 1 && mid.opacity === 1);
ok('a neighbour is smaller and still shows', one.scale < 1 && one.scale > 0.4 && one.opacity > 0.5);
ok('far away is gone', far.hidden && far.opacity === 0);
ok('looks are symmetric', JSON.stringify(M.reelLook(-1.5)) === JSON.stringify(M.reelLook(1.5)));
ok('nearer is drawn on top', M.reelLook(0).z > M.reelLook(1).z && M.reelLook(1).z > M.reelLook(2).z);
ok('a drag inside the ends is untouched', M.rubber(7.3, 1, 45) === 7.3);
ok('past the ends it only gives a little', M.rubber(0, 1, 45) === 0.7 && Math.abs(M.rubber(46, 1, 45) - 45.3) < 1e-9);
ok('a nudge under a quarter step stays', M.reelSnap(5, 5.2, 1, 45) === 5 && M.reelSnap(5, 4.8, 1, 45) === 5);
ok('a quarter step is the next one', M.reelSnap(5, 5.26, 1, 45) === 6 && M.reelSnap(5, 4.74, 1, 45) === 4);
ok('a long throw rounds to where it got', M.reelSnap(5, 8.4, 1, 45) === 8 && M.reelSnap(5, 1.6, 1, 45) === 2);
ok('never past the ends', M.reelSnap(45, 46.4, 1, 45) === 45 && M.reelSnap(1, -3, 1, 45) === 1);

// ── your cards ──
const all = () => true, some = (r, n) => r === 'epic' && (n === 7 || n === 12);
const reel = M.cardReel('epic', some);
ok('a rarity reel holds all 45 cards, in number order', reel.length === 45 && reel.every((c, i) => c.number === i + 1 && c.rarity === 'epic'));
ok('…the ones you do not own shown, marked', reel.filter((c) => c.owned).map((c) => c.number).join() === '7,12');
ok('no album means every card is yours', M.cardReel('rare', all).every((c) => c.owned));
ok('switching rarity lands on your first card of it', M.firstOwned('epic', some) === 7 && M.firstOwned('rare', some) === null);
ok('the rarity pill steps rarest-first and loops', M.nextRarity('legendary') === 'epic' && M.nextRarity('common') === 'legendary');
ok('every rarity has a name and a colour', M.RARITY_ORDER.every((r) => M.RARITY_NAME[r] && M.RARITY_COLOR[r]));

// ── stars ──
ok('five stars, halves allowed', M.starRow(3.5).join() === 'full,full,full,half,empty' && M.starRow(0.5).join() === 'half,empty,empty,empty,empty');
ok('five is five', M.starRow(5).every((s) => s === 'full'));
ok('practice levels 0..5 climb from half a star to five', [0, 1, 2, 3, 4, 5].map(M.levelStars).join() === '0.5,1,2,3,4,5');
ok('out-of-range levels clamp', M.levelStars(-2) === 0.5 && M.levelStars(9) === 5);

// ── after the result (HS: one button back to Player Select; online two) ──
const aw = M.afterResult({ mode: 'arcade', won: true, stage: 12 });
ok('an arcade win: one button, NEXT MATCH', aw.buttons.length === 1 && aw.buttons[0].label === 'המשחק הבא');
ok('…and Player Select opens on the next champion', aw.select === 13);
const al = M.afterResult({ mode: 'arcade', won: false, stage: 12 });
ok('an arcade loss: NEXT, back to the same champion', al.buttons[0].label === 'הבא' && al.select === 12);
ok('beating the last champion stays on it', M.afterResult({ mode: 'arcade', won: true, stage: 45 }).select === 45);
const pr = M.afterResult({ mode: 'practice', won: false });
ok('practice: one button, no stage', pr.buttons.length === 1 && pr.select === null);
const on = M.afterResult({ mode: 'online', won: true });
ok('online keeps two: play again (the room) and leave', on.buttons.map((b) => b.id).join() === 'again,leave');

// ── sound and music ──
ok('a new device has both on', JSON.stringify(M.parseAudio(null)) === '{"sfx":true,"music":true}');
ok('each switch is remembered on its own', JSON.stringify(M.parseAudio('{"sfx":true,"music":false}')) === '{"sfx":true,"music":false}');
ok('a broken save is both on, not an error', JSON.stringify(M.parseAudio('{x')) === '{"sfx":true,"music":true}');

// ── your name ──
ok('ten characters at most (HS: MAX 10)', M.cleanName('אבגדהוזחטיכלמ') === 'אבגדהוזחטי');
ok('spaces trimmed and squeezed', M.cleanName('  דני   כהן ') === 'דני כהן');
ok('no markup gets through', M.cleanName('<b>x</b>') === 'bx/b');
ok('an empty name falls back', M.cleanName('   ') === 'שחקן' && M.cleanName(null, 'X') === 'X');
ok('an emoji counts as one', [...M.cleanName('😀'.repeat(12))].length === 10 && M.cleanName('😀'.repeat(12)).length === 20);

console.log(`test-menus: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
