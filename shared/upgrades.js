// THE STATS — HS's five stats, each a level 0–10, and the Arcade Points that buy them
// (docs/HS-STATS.md). Pure: no DOM, and the storage is passed in, like shared/arcade.js.
//
// EACH CHARACTER HAS ITS OWN LEVELS (2026-10-12; it was one set for every card, Idan
// 2026-10-06 — this needs Idan's OK). The Arcade Points are still one wallet. A character never
// upgraded is on level 0 everywhere — HS's base body, the constants themselves. Only the arcade pays:
// a win over champion n pays 100 × n (stage 1 = 100 … stage 45 = 4,500, replays too), a loss pays
// nothing. Level L costs 500 × 2^(L−1): 500, 1,000 … 256,000 for the tenth — HS's own price list.
//
// A card's levels are kept under its key: "legendary_8", "epic_3"… and "mythic" for whichever Mythic
// is your starter (the levels follow it through a team switch, as hs.me.v1 does).
// The save: { v: 2, points, cards: { [key]: { speed, jump, kick, dash, power } } } under the old key
// (its name predates v2). A v1 save (one set for everyone) gives its levels to the card in use only.
// A save that will not parse, or one from an unknown version, is a fresh start rather than an error.

import { MAX_LEVEL } from './hs-powers.js';

export const STATS_KEY = 'hs.stats.v1';
export const STAT_KEYS = Object.freeze(['speed', 'jump', 'kick', 'dash', 'power']);

const zero = () => ({ speed: 0, jump: 0, kick: 0, dash: 0, power: 0 });
export const freshStats = () => ({ v: 2, points: 0, cards: {} });

const CARD_KEY = /^(mythic|(legendary|epic|rare|common)_\d{1,2})$/;
export const keyOf = (card) => (!card ? '' : card.rarity === 'mythic' ? 'mythic' : `${card.rarity}_${card.number}`);
const cleanLv = (o) => {
  const lv = zero();
  for (const k of STAT_KEYS) { const L = o && o[k]; if (Number.isInteger(L)) lv[k] = Math.max(0, Math.min(MAX_LEVEL, L)); }
  return lv;
};
const isZero = (lv) => STAT_KEYS.every((k) => !lv[k]);

// `card`: the card in use, for a v1 save's levels.
export function parseStats(raw, card = null) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return freshStats(); }
  if (!o || typeof o !== 'object') return freshStats();
  const points = Number.isInteger(o.points) && o.points > 0 ? o.points : 0;
  if (o.v === 1) {
    const lv = cleanLv(o.lv), key = keyOf(card);
    return { v: 2, points, cards: key && !isZero(lv) ? { [key]: lv } : {} };
  }
  if (o.v !== 2) return freshStats();
  const cards = {};
  if (o.cards && typeof o.cards === 'object') {
    for (const [key, lv] of Object.entries(o.cards)) {
      if (!CARD_KEY.test(key)) continue;
      const c = cleanLv(lv);
      if (!isZero(c)) cards[key] = c;
    }
  }
  return { v: 2, points, cards };
}

export function loadStats(storage, card = null) {
  try { return parseStats(storage ? storage.getItem(STATS_KEY) : null, card); } catch { return freshStats(); }
}

export function saveStats(storage, st) {
  try { storage.setItem(STATS_KEY, JSON.stringify(st)); return true; } catch { return false; }
}

// A card's five levels (all 0 for one never upgraded). A new object: change it and nothing else moves.
export const levelsOf = (st, card) => ({ ...zero(), ...((st && st.cards && st.cards[keyOf(card)]) || {}) });

// What it costs to go UP to level L (1–10).
export const costOf = (L) => (Number.isInteger(L) && L >= 1 && L <= MAX_LEVEL ? 500 * 2 ** (L - 1) : Infinity);
// The next level of a card's stat, and what it costs; null once it is at the top.
export const nextOf = (st, card, k) => {
  if (!STAT_KEYS.includes(k) || !keyOf(card)) return null;
  const L = levelsOf(st, card)[k];
  return L < MAX_LEVEL ? { level: L + 1, cost: costOf(L + 1) } : null;
};
export const canBuy = (st, card, k) => { const n = nextOf(st, card, k); return !!n && st.points >= n.cost; };

// Buy one level of a card's stat. Returns a NEW state, or the same one (bought: false) when it is
// maxed or the points are short — the input is never mutated.
export function buy(st, card, k) {
  if (!canBuy(st, card, k)) return { st, bought: false };
  const n = nextOf(st, card, k);
  const key = keyOf(card);
  return { st: { v: 2, points: st.points - n.cost, cards: { ...st.cards, [key]: { ...levelsOf(st, card), [k]: n.level } } }, bought: true };
}

// A card's level set straight (a dev link, ?lv=): clamped, the input never mutated.
export function setLevel(st, card, k, L) {
  if (!STAT_KEYS.includes(k) || !keyOf(card)) return st;
  const v = Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(L)) || 0));
  return { ...st, cards: { ...st.cards, [keyOf(card)]: { ...levelsOf(st, card), [k]: v } } };
}

// An arcade match on stage n just ended.
export const winPoints = (n) => (Number.isInteger(n) && n >= 1 ? 100 * n : 0);
export function award(st, n, won) {
  const gained = won ? winPoints(n) : 0;
  return { st: gained ? { ...st, points: st.points + gained } : st, gained };
}
