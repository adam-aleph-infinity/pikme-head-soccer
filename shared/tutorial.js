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
// replay the tutorial. Anyone who has already played never sees it.

export const TUT_KEY = 'hs.tutorial.v1';
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
// ?tutorial forces it (the harness, and the way to see it again). ?nointro / ?notutorial and
// every deep link (a room, ?play, ?arcade) skip it. So does any progress at all.
export function shouldRun({ flag = null, prog = null, stats = null, params = null } = {}) {
  const has = (k) => !!(params && params.has && params.has(k));
  if (has('tutorial')) return true;
  if (['nointro', 'notutorial', 'room', 'play', 'arcade', 'unlockall', 'resetarcade'].some(has)) return false;
  if (flag === 'done') return false;
  return !playedBefore(prog, stats);
}
export function playedBefore(prog, stats) {
  if (prog && prog.cleared > 0) return true;
  if (prog && prog.record && Object.keys(prog.record).length) return true;
  if (stats && stats.points > 0) return true;
  if (stats && stats.lv && Object.values(stats.lv).some((v) => v > 0)) return true;
  return false;
}

// THE DRILLS, in order. Each says what the coach says, which buttons are on the pad (`pad`),
// which one gets the pulsing ring (`ring`), the marker's world x (`mark`), the ball (`ball`:
// 'drop' falls from the sky in front of you, 'ground' sits on the grass), and what passes it:
//   'mark'  — standing on the marker      'jump' / 'dash' — the sim's own event for you
//   'goal'  — a goal in the far net (or, after MAX_TRIES balls, a clean strike)
// `keys` is the desktop line under the bubble.
export const DRILLS = Object.freeze([
  { id: 'right', say: 'זוזו לאזור המסומן!', pad: ['left', 'right'], ring: 'right', mark: 760, pass: 'mark', keys: '→ / D' },
  { id: 'left', say: 'זוזו לאזור המסומן!', pad: ['left', 'right'], ring: 'left', mark: 300, pass: 'mark', keys: '← / A' },
  { id: 'jump', say: 'יופי! עכשיו, קפצו!', pad: ['left', 'right', 'jump'], ring: 'jump', pass: 'jump', keys: 'רווח / ↑' },
  { id: 'dash', say: 'ועכשיו דאש! לחצו פעמיים, מהר, על החץ!', pad: ['left', 'right', 'jump'], ring: 'right', mark: 800, pass: 'dash', keys: '→ → / D D' },
  { id: 'high', say: 'הנה כדור! קפצו, ובעטו באוויר. בעיטה גבוהה, לשער!', pad: ['left', 'right', 'jump', 'kick'], ring: 'kick', ball: 'drop', pass: 'goal', keys: 'רווח ואז ↓ / S' },
  { id: 'ground', say: 'וואו! עכשיו, בעטו מהקרקע!', pad: ['left', 'right', 'jump', 'kick'], ring: 'kick', ball: 'ground', pass: 'goal', keys: '↓ / S' },
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

// THE COUNTER LESSON (Idan, 2026-10-07): after your own power, the opponent fires one at you and
// you kick it back. Our kick-block (hs-powers.js block): a boot that meets their power ball blocks
// it, and THEIR shot goes back out at their goal as yours. The stage-2 Thunderbolt the practice
// opponent fires crosses ~2150 px/s at head height and the kick swings from the knee to the face
// in 0.26 s, so a press with the ball 300–520 px away is a block and anything later a hit
// (measured in the sim: every gap from 300 to 520 blocks, 260 and under is hit). The lesson
// freezes the shot COUNTER_GAP away and the press lets it go — right in the middle of that.
export const COUNTER_GAP = 400;
// WHO THE PRACTICE OPPONENT CAN BE: a drawn champion whose power a kick blocks. Measured in the
// sim (test-tutorial.mjs): champions 1 and 2 fire a straight shot, blocked from 300 to 600 px;
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
  shop: SAY.shop, stats: SAY.stats, bought: SAY.bought, arcade: SAY.arcade,
});
// The clip for a line of text (the drills share their words, so they share a clip).
const BY_TEXT = new Map(Object.entries(LINES).map(([id, t]) => [t, id]));
export const voiceFor = (text) => BY_TEXT.get(text) || null;
