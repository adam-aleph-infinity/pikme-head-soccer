// THE FIRST LAUNCH — the rules of it, in node (test-tutorial.mjs) and the browser (public/tutorial.js).
//
// Idan's model is Head Ball 2's first launch (uploaded-images/ScreenRecording_10-07-2026
// 16-43-33_1.mov, read frame by frame on 2026-10-07):
//   • a loading screen: key art, a status line and "Loading n%"
//   • drills with a coach in a speech bubble — move to the marked area (right, then left), jump,
//     a high shot, a shot from the ground. Each button shows up only when it is needed, with a
//     pulsing ring, plus a green arrow at the ball and a ✓ for each step
//   • "Let's have a practice match" → Finding An Opponent → VS → the match. At kick-off the
//     screen dims round the power button: "Tap the button to use your super powers"
//   • Final Whistle → You Won + the rewards → the main menu
// Ours teaches our own game on top of that: the DASH (a double tap) and, after the match, a
// guided first UPGRADE in the shop with the points it paid.
//
// Idan's choices: the guide is a champion as coach; the loading screen IS the title; the
// first upgrade is bought with the coach watching. There is no skip button, but OPTIONS can
// replay the tutorial.
//
// 2026-10-08 (the Mythic starters, shared/mythics.js): EVERY player does it once from now on,
// new or not, with the Mythic they pick right before it (Idan: "every player from now no matter
// what will have to do the tutorial and choose one mythic for free"). So it has a new key, and
// what was saved under the old one (v1, which marked anyone with progress as done) is not read.
// Progress, points and upgrades are untouched. The key holds:
//   null   — not done        'paid' — the practice match has paid its reward (closing the game
//   'done' — finished          after that and running it again never pays twice)

export const TUT_KEY = 'hs.tutorial.v2';
export const owesReward = (flag) => flag !== 'paid' && flag !== 'done';
// The coach: Paz (legendary 5), glasses and a beard, the nearest of ours to HB2's commentator.
export const COACH = 5;

// The practice match pays exactly one level-1 upgrade (upgrades.js costOf(1)), win or lose:
// the shop lesson needs something to buy with.
export const REWARD = 500;
// HB2's practice match ran 38 s on its clock. Ours is a little longer: the power lesson stops
// the clock for a moment, and nobody should finish their first match without a goal in it.
export const MATCH_SECONDS = 45;
// How close to a marker counts as "on it", in world px (a head is 53 px across).
export const MARK_REACH = 30;
// A shot drill hands out a fresh ball after this long with nothing happening, and after
// MAX_TRIES balls any clean strike passes the drill: a first-timer is never stuck on one.
export const RETRY_IDLE = 2.6;
export const MAX_TRIES = 3;

// Should this launch run the tutorial?
//   flag   — what TUT_KEY holds ('done' once it has run, or been skipped as not needed)
//   prog   — arcade progress ({ cleared }), stats — { points, lv }
//   params — the page's URLSearchParams (or anything with .has)
// ?tutorial forces it (the harness, and the way to see it again). ?nointro / ?notutorial and the
// testing links (?play, ?arcade…) skip it. A friend's ROOM link does not: a player who has not done
// it does the whole tutorial first and is taken to the room after (Idan). Progress does not skip
// it any more (see TUT_KEY); only having finished it does.
export function shouldRun({ flag = null, params = null } = {}) {
  const has = (k) => !!(params && params.has && params.has(k));
  if (has('tutorial')) return true;
  if (['nointro', 'notutorial', 'play', 'arcade', 'unlockall', 'resetarcade'].some(has)) return false;
  return flag !== 'done';
}

// THE DRILLS, in order. Each says what the coach says, which buttons are on the pad (`pad`),
// which one gets the pulsing ring (`ring`), the marker's world x (`mark`), the ball (`ball`:
// 'drop' falls from the sky in front of you, 'ground' sits on the grass), and what passes it:
//   'mark'  — standing on the marker      'jump' / 'dash' — the sim's own event for you
//   'goal'  — a goal in the far net (or, after MAX_TRIES balls, a clean strike)
export const DRILLS = Object.freeze([
  { id: 'right', say: 'זוזו לאזור המסומן!', pad: ['left', 'right'], ring: 'right', mark: 760, pass: 'mark' },
  { id: 'left', say: 'זוזו לאזור המסומן!', pad: ['left', 'right'], ring: 'left', mark: 300, pass: 'mark' },
  { id: 'jump', say: 'יופי! עכשיו, קפצו!', pad: ['left', 'right', 'jump'], ring: 'jump', pass: 'jump' },
  { id: 'dash', say: 'ועכשיו דאש! לחצו פעמיים, מהר, על החץ!', pad: ['left', 'right', 'jump'], ring: 'right', mark: 800, pass: 'dash' },
  { id: 'high', say: 'הנה כדור! קפצו, ובעטו באוויר. בעיטה גבוהה, לשער!', pad: ['left', 'right', 'jump', 'kick'], ring: 'kick', ball: 'drop', pass: 'goal' },
  { id: 'ground', say: 'וואו! עכשיו, בעטו מהקרקע!', pad: ['left', 'right', 'jump', 'kick'], ring: 'kick', ball: 'ground', pass: 'goal' },
]);

// What the coach says between the steps, so the words live in one place.
export const SAY = Object.freeze({
  hello: 'היי, אלופים! ברוכים הבאים לסולטיז ראשים!\nבואו נלמד לשחק!',
  good: ['יפה מאוד!', 'מעולה!', 'בדיוק ככה!', 'אתם אלופים!'],
  again: 'כמעט! עוד פעם, אתם יכולים!',
  match: 'אתם מוכנים? בואו נשחק משחק אימון,\nונראה כמה אתם טובים!',
  power: 'וואו, מד הכוח מלא!\nלחצו על POWER, ותפעילו כוח-על!',
  powerGo: 'הראש שלכם זוהר! עכשיו, געו בכדור!',
  powerAfter: 'המד מתמלא שוב עם הזמן.\nושימו לב, גם ליריב יש מד!',
  counter: 'זהירות! עכשיו היריב יירה עליכם כוח-על.\nבעטו בכדור לפני שהוא פוגע בכם, וחסמתם אותו!',
  counterNow: 'עכשיו! בעטו!',
  counterOk: 'יש! חסמתם!\nוהכוח שלו טס בחזרה לשער שלו!',
  counterMiss: 'אוי, זה פגע בכם... לא נורא, ננסה שוב!',
  won: 'ניצחון ראשון! כל הכבוד!\nקיבלתם 500 נקודות סולטיז!',
  lost: 'לא נורא, אתם משתפרים!\nעל האימון קיבלתם 500 נקודות סולטיז!',
  draw: 'תיקו! לא רע בכלל!\nעל האימון קיבלתם 500 נקודות סולטיז!',
  toShop: 'עם הנקודות קונים שדרוגים בחנות.\nבואו נקנה את הראשון!',
  shop: 'כל שדרוג משפר את כל הקלפים שלכם.\nלחצו "קנה", על מהירות!',
  stats: 'מהירות, בעיטה, קפיצה, דאש, וכוח.\nהכוח ממלא את מד ה-POWER מהר יותר!',
  bought: 'מעולה! עכשיו אתם מהירים יותר!',
  arcade: 'ועכשיו, לארקייד! נצחו את 45 האלופים,\nוכל ניצחון שווה עוד נקודות. בהצלחה!',
  // PLAY is the arena once it is live (Idan, 2026-10-08: Clash Royale's Battle button); until
  // then PLAY opens the modes and the coach says the arcade line above. A new line, so a new
  // clip id: the old arcade clip says the old words. No clip yet: it shows, silent, until
  // tools/voice makes one.
  arena: 'ועכשיו, לזירה! לחצו "שחק",\nנצחו, ואספו גביעים לקבוצה שלכם!',
  // …and until the trophies count, the arena is practice (Idan, 2026-10-09)
  practice: 'ועכשיו, לזירה! לחצו "שחק",\nושחקו נגד ילדים אחרים!',
});

// The drill after this one, or null when the drills are done.
export const nextDrill = (i) => (i + 1 < DRILLS.length ? i + 1 : null);
// Is a player at x on the marker?
export const onMark = (x, mark) => Math.abs(x - mark) <= MARK_REACH;
// Where a shot drill puts its ball: in front of you, inside the pitch, and never so close to
// the far goal that the shot is a tap-in.
export function ballSpot(kind, px, W = 1060) {
  const x = Math.max(360, Math.min(W - 330, px + (kind === 'drop' ? 150 : 170)));
  return { x, kind };
}

// THE SHOT DRILLS' BALL WAITS FOR YOU (Idan, 2026-10-08: "freeze the ball somewhere, then I jump
// and kick and it scores, and it won't run away or I miss"). The ball is held still where it is
// put: in the air for the jump-and-kick ('drop'), on the grass for the ground kick. A header, a
// bump or a kick from too far moves nothing. A kick from close enough lets it go, and the shot
// is guided into the far goal: the drill teaches the buttons, not the aim.
//
// HOLD_HIGH is the held ball's height (its centre, above the ground): over a standing player's
// head (the head's top is ~70 up), so you walk under it, and in reach of a jump (the head climbs
// another 41).
export const HOLD_HIGH = 95;
// Does a kick pressed with the ball `dx` ahead of you (ball x − your x) count? The real boot
// reaches 20–60 px ahead (measured in the sim on a held ball); these windows are wider on purpose.
// The air ball needs you in the air.
export function kickReaches(kind, dx, airborne) {
  if (kind === 'drop' && !airborne) return false;
  return dx >= -30 && dx <= 140;
}
// The guided shot: where it goes (well inside the far net, under the bar) and how long it flies.
export const aimTarget = (W, gy) => ({ x: W - 26, y: gy - 50 });
export const aimTime = (x, W) => Math.max(0.5, Math.min(1, (W - 26 - x) / 650));
// The velocity that lands a ball at (x, y) on (tx, ty) in `t` seconds under gravity `grav`.
// Re-solved every tick with the time left, so drag and bounces never pull it off line.
export function aimVelocity(x, y, tx, ty, t, grav) {
  return { vx: (tx - x) / t, vy: (ty - y - 0.5 * grav * t * t) / t };
}

// THE COUNTER LESSON (Idan, 2026-10-07): after your own power, the opponent fires one at you and
// you kick it back. Our kick-block (hs-powers.js block): a boot that meets their power ball blocks
// it, and THEIR shot goes back out at their goal as yours. The stage-2 Thunderbolt the practice
// opponent fires crosses ~2150 px/s at head height and the kick swings from the knee to the face
// in 0.26 s, but only the swing UP blocks (constants.js BLOCK_SWING, Idan 2026-10-08: "good
// timing, like HS"; then "way too hard", so the first 0.65 of it), so a press with the ball 280–480
// px away is a block and anything earlier or later a hit (measured in the sim, test-tutorial.mjs;
// it was 300–520 while the leg held out at the top blocked too). The lesson freezes the shot COUNTER_GAP away and the press lets it go —
// right in the middle of that.
export const COUNTER_GAP = 380;
// WHO THE PRACTICE OPPONENT CAN BE: a drawn champion whose power a kick blocks. Measured in the
// sim (test-tutorial.mjs): champions 1 and 2 fire a straight shot a timed kick blocks;
// 3's ground twister and 4's shot cannot be kicked back at all (HS: a Ground shot is only
// countered). So the opponent is 2 — or 1, when your own card is 2.
export const FOES = Object.freeze([2, 1]);
export const foeFor = (me) => ({ rarity: 'legendary', number: FOES.find((n) => !(me && me.rarity === 'legendary' && me.number === n)) });
export const COUNTER_SPOTS = Object.freeze({ me: 170, foe: 860 });

// THE NARRATION: every line the coach says, by id. The bubble shows the text and the game plays
// audio/voice/<id>.mp3 — Idan's own voice, made once by tools/voice/make-voice.py from his
// recording. A line with no clip just shows.
export const LINES = Object.freeze({
  hello: SAY.hello,
  ...Object.fromEntries(DRILLS.map((d) => [d.id === 'left' ? 'right' : d.id, d.say])),
  ...Object.fromEntries(SAY.good.map((t, i) => ['good' + i, t])),
  again: SAY.again, kick: 'קדימה, בעטו בכדור!',
  match: SAY.match, power: SAY.power, powerGo: SAY.powerGo, powerAfter: SAY.powerAfter,
  counter: SAY.counter, counterNow: SAY.counterNow, counterOk: SAY.counterOk, counterMiss: SAY.counterMiss,
  won: SAY.won, lost: SAY.lost, draw: SAY.draw, toShop: SAY.toShop,
  shop: SAY.shop, stats: SAY.stats, bought: SAY.bought, arcade: SAY.arcade, arena: SAY.arena, practice: SAY.practice,
});
// The clip for a line of text (the drills share their words, so they share a clip).
const BY_TEXT = new Map(Object.entries(LINES).map(([id, t]) => [t, id]));
export const voiceFor = (text) => BY_TEXT.get(text) || null;
