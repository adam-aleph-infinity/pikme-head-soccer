// THE MENUS' RULES — the parts of the menus that are decisions rather than pixels, kept pure so
// test-menus.mjs can hold them to account in node. public/menus.js draws them.
//
// docs/HS-MENUS.md is the reference: HS's main menu is a looping carousel of modes, Player
// Select is two vertical reels, the result screen has one button that goes back to Player
// Select, and online keeps two (play again / leave).

// ── THE CAROUSEL ──────────────────────────────────────────────────────────
// The modes on the main menu, in HS's order (ARCADE first, MULTIPLAYER after the single-player
// modes). Practice is ours: HS has no free match against the computer outside its modes.
export const MODES = [
  { id: 'arcade', name: 'ארקייד' },
  { id: 'multi', name: 'רב משתתפים' },
  { id: 'practice', name: 'אימון' },
];
export const wrap = (i, n) => ((i % n) + n) % n;
// Where each mode sits around the centred one: -1 left, 0 centre, +1 right. The carousel
// loops (HS M15: ARCADE … MORE GAMES → ARCADE), so with three modes each neighbour is
// the other two, one either side.
export function carouselOffsets(center, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let d = wrap(i - center, n);
    if (d > n / 2) d -= n;
    out.push(d);
  }
  return out;
}

// ── THE REELS ─────────────────────────────────────────────────────────────
// How an item `d` steps from the middle looks: full size in the middle, smaller and fainter
// further away, gone past ±3. (The arcade reel's own curve, game.js placeReel, before.)
export function reelLook(d) {
  const a = Math.abs(d);
  return {
    scale: a < 1 ? 1 - 0.38 * a : Math.max(0.3, 0.62 - 0.16 * (a - 1)),
    opacity: a > 2.4 ? 0 : a < 1 ? 1 : Math.max(0, 0.8 - 0.35 * (a - 1)),
    z: 10 - Math.round(a),
    hidden: a > 3,
  };
}
// Past either end a drag only gives a little.
export function rubber(pos, min, max, k = 0.3) {
  if (pos < min) return min - (min - pos) * k;
  if (pos > max) return max + (pos - max) * k;
  return pos;
}
// Where a released drag lands: a quarter of a step is enough to mean "the next one", further
// than that rounds as usual — never back past where it started.
export function reelSnap(from, pos, min, max) {
  const off = pos - from;
  const to = Math.abs(off) < 0.25 ? from : off > 0 ? Math.max(from + 1, Math.round(pos)) : Math.min(from - 1, Math.round(pos));
  return Math.max(min, Math.min(max, to));
}

// ── YOUR CARDS ────────────────────────────────────────────────────────────
// Rarest first, the order the app's album is in.
export const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];
export const RARITY_NAME = { legendary: 'אגדי', epic: 'אדיר', rare: 'נדיר', common: 'רגיל' };
export const RARITY_COLOR = { legendary: '#ffb800', epic: '#b46bff', rare: '#4ea0ff', common: '#9ab0c5' };
// The rarity pill (HS's HERO pill) steps through the rarities.
export const nextRarity = (r) => RARITY_ORDER[wrap(RARITY_ORDER.indexOf(r) + 1, RARITY_ORDER.length)];
// One rarity's reel: every card of it, in number order, with whether you own it — a card you
// do not own is SHOWN, caged (HS shows its locked characters the same way), never hidden.
export function cardReel(rarity, owns, perRarity = 45) {
  const out = [];
  for (let n = 1; n <= perRarity; n++) out.push({ rarity, number: n, owned: !!owns(rarity, n) });
  return out;
}
// The first card of a rarity you can play: the one to land on after switching to it.
export function firstOwned(rarity, owns, perRarity = 45) {
  for (let n = 1; n <= perRarity; n++) if (owns(rarity, n)) return n;
  return null;
}

// ── STARS ─────────────────────────────────────────────────────────────────
// Five stars, halves allowed (a champion's hs.stars is 0.5 to 5): 'full' | 'half' | 'empty'.
export function starRow(n) {
  const out = [];
  for (let i = 1; i <= 5; i++) out.push(n >= i ? 'full' : n >= i - 0.5 ? 'half' : 'empty');
  return out;
}
// Practice has no champion, so its stars are the bot's difficulty (shared/bot.js DIFFICULTIES,
// 0..5): level 0 is half a star, then one more half per level… up to five at the top.
export const levelStars = (level) => [0.5, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, level | 0))];

// ── AFTER THE RESULT ──────────────────────────────────────────────────────
// HS has one button on its result screen — NEXT MATCH after a win, NEXT after a loss — and both
// go back to Player Select (M4 90-93 s). Online there is no Player Select to go back to: the
// room is, so it keeps two.
//   mode: 'arcade' | 'practice' | 'online'; stage: the arcade stage just played (1..45)
//   → { buttons: [{ id, label }], select: the stage Player Select opens on (arcade), or null }
export function afterResult({ mode, won, stage = 1, last = 45 }) {
  if (mode === 'online') {
    return { buttons: [{ id: 'again', label: 'משחק חוזר' }, { id: 'leave', label: 'יציאה' }], select: null };
  }
  if (mode === 'arcade') {
    const next = won && stage < last ? stage + 1 : stage;
    return { buttons: [{ id: 'next', label: won ? 'המשחק הבא' : 'הבא' }], select: next };
  }
  return { buttons: [{ id: 'next', label: won ? 'המשחק הבא' : 'הבא' }], select: null };
}

// ── SOUND AND MUSIC ───────────────────────────────────────────────────────
// Two switches, as in HS's pause menu, remembered on the device.
export const AUDIO_KEY = 'hs.audio.v1';
export function parseAudio(raw) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { o = null; }
  return {
    sfx: !(o && o.sfx === false),
    music: !(o && o.music === false),
  };
}

// ── YOUR NAME ─────────────────────────────────────────────────────────────
// HS's multiplayer box: "NAME · MAX 10 · AUTO SAVE".
export const NAME_KEY = 'hs.name.v1';
export const NAME_MAX = 10;
export function cleanName(s, fallback = 'שחקן') {
  const t = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  return [...t].slice(0, NAME_MAX).join('') || fallback;
}
