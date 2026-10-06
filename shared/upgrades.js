// THE PLAYER'S STATS — HS's five stats, each a level 0–10, and the Arcade Points that buy them
// (docs/HS-STATS.md). Pure: no DOM, and the storage is passed in, like shared/arcade.js.
//
// One set of levels for the player, shared by every card (Idan, 2026-10-06). A new player is on
// level 0 everywhere — HS's base body, the constants themselves. Only the arcade pays: a win over
// champion n pays 100 × n (stage 1 = 100 … stage 45 = 4,500, replays too), a loss pays nothing.
// Level L costs 500 × 2^(L−1): 500, 1,000 … 256,000 for the tenth — HS's own price list.
//
// Its own key. A save that will not parse, or one from another version, is a fresh start rather
// than an error.

import { MAX_LEVEL } from './hs-powers.js';

export const STATS_KEY = 'hs.stats.v1';
export const STAT_KEYS = Object.freeze(['speed', 'jump', 'kick', 'dash', 'power']);

const zero = () => ({ speed: 0, jump: 0, kick: 0, dash: 0, power: 0 });
export const freshStats = () => ({ v: 1, points: 0, lv: zero() });

export function parseStats(raw) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return freshStats(); }
  if (!o || typeof o !== 'object' || o.v !== 1) return freshStats();
  const points = Number.isInteger(o.points) && o.points > 0 ? o.points : 0;
  const lv = zero();
  for (const k of STAT_KEYS) {
    const L = o.lv && o.lv[k];
    if (Number.isInteger(L)) lv[k] = Math.max(0, Math.min(MAX_LEVEL, L));
  }
  return { v: 1, points, lv };
}

export function loadStats(storage) {
  try { return parseStats(storage ? storage.getItem(STATS_KEY) : null); } catch { return freshStats(); }
}

export function saveStats(storage, st) {
  try { storage.setItem(STATS_KEY, JSON.stringify(st)); return true; } catch { return false; }
}

// What it costs to go UP to level L (1–10).
export const costOf = (L) => (Number.isInteger(L) && L >= 1 && L <= MAX_LEVEL ? 500 * 2 ** (L - 1) : Infinity);
// The next level of a stat, and what it costs; null once it is at the top.
export const nextOf = (st, k) => (STAT_KEYS.includes(k) && st.lv[k] < MAX_LEVEL ? { level: st.lv[k] + 1, cost: costOf(st.lv[k] + 1) } : null);
export const canBuy = (st, k) => { const n = nextOf(st, k); return !!n && st.points >= n.cost; };

// Buy one level of a stat. Returns a NEW state, or the same one (bought: false) when it is maxed
// or the points are short — the input is never mutated.
export function buy(st, k) {
  if (!canBuy(st, k)) return { st, bought: false };
  const n = nextOf(st, k);
  return { st: { v: 1, points: st.points - n.cost, lv: { ...st.lv, [k]: n.level } }, bought: true };
}

// An arcade match on stage n just ended.
export const winPoints = (n) => (Number.isInteger(n) && n >= 1 ? 100 * n : 0);
export function award(st, n, won) {
  const gained = won ? winPoints(n) : 0;
  return { st: gained ? { ...st, points: st.points + gained } : st, gained };
}
