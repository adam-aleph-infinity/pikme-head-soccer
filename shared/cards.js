// CARDS — where the powers come from.
//
// The crates were the first answer to "power ups": objects on the pitch, raced for. This is
// the second and better one, because this game already has a thing that belongs to you and
// that you chose — your Saltiz card. So the power comes out of the card itself: you hold
// three of them, they sit under the pitch as three buttons, and pressing one spends it.
//
// The division of labour, and it is the whole design in one line:
//
//        THE NUMBER SAYS WHICH POWER.   THE RARITY SAYS HOW GOOD.
//
// A player works the first half out for themselves inside three matches — "the 12 is the
// magnet" — and it stays true across the whole album, which is what makes it worth
// learning. The second half is what makes a legendary worth having without making a common
// worthless: same six powers, stronger and cooling faster as you climb.
//
// Pure functions over card identity, exactly like powershots.js: no DOM, no timers, no
// Math.random, nothing that has to travel. A hand is DERIVED from the two cards, which are
// match-constant and known at both ends, so the deal costs nothing on the wire and cannot
// disagree between two clients. Rules asserted in test-cards.mjs.
import * as C from './constants.js';
import { PU, PU_NAME, PU_COLOR, applyPower, effT, pickupY } from './powerups.js';

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const CARDS_PER_RARITY = 45;

// The cycle the album walks. Not the PU enum order: laid out so that consecutive album
// numbers hand you powers that play differently — a buff, then a ball tool, then a movement
// one — rather than three flavours of the same idea in a row.
const ORDER = [PU.GROW, PU.MAGNET, PU.SPRING, PU.SHIELD, PU.CHARGE, PU.ICE];

// A card's power. Deterministic, total over the album, and deliberately NOT a hash: 45
// cards over 6 powers divides almost evenly this way (eight of three powers, seven of the
// other three), where a hash would leave one power on a fifth of the album and another on a
// fiftieth. An even album is what stops a hand feeling like it was dealt badly.
export function cardPower(rarity, number) {
  const n = Math.max(1, Math.min(CARDS_PER_RARITY, Math.round(number) || 1));
  return ORDER[(n - 1) % ORDER.length];
}

// ---------------------------------------------------------------------------
// THE LADDER. Two dials, both geometric, so the ordering can never invert no matter where a
// tuner drags them — a rare cannot end up cooling faster than a legendary, which a table of
// four hand-typed numbers absolutely could. Read at CALL time so the debug panel lands on
// the next tick, same as everything else.
export const cardTier = (rarity) => Math.max(0, RARITIES.indexOf(rarity));

export const cardCooldown = (rarity) => C.CARD_CD_BASE * Math.pow(C.CARD_CD_STEP, cardTier(rarity));
// How long this card's power runs, as a multiple of the authored crate duration. The scale
// is what separates a card from a crate; the ladder is what separates a legendary from a
// common. Both live here so there is one place to argue with.
export const cardStrength = (rarity) => C.CARD_POWER_SCALE * Math.pow(C.CARD_STR_STEP, cardTier(rarity));

// ---------------------------------------------------------------------------
// THE DEAL. Same trick powerups.js uses for its spawns: a seed derived from the two cards,
// which never travels because both ends already have both cards.
const RARITY_N = { common: 1, rare: 2, epic: 3, legendary: 4 };
const idOf = (c) => (RARITY_N[c?.rarity] || 1) * 64 + (c?.number || 1);

function seedFor(mine, theirs, i) {
  const v = idOf(mine) * 40961 + idOf(theirs) * 577 + i * 21701;
  return Math.imul(v ^ 0x43415244, 0x85EBCA6B) >>> 0;             // 'CARD'
}

function rndAt(seed, n) {
  let x = (seed ^ Math.imul(n + 1, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

// Every number of one rarity that carries a given power. Precomputed once: it is the same
// list for all four rarities, and it is what makes the deal a pick rather than a search.
const BY_POWER = (() => {
  const map = new Map(ORDER.map((k) => [k, []]));
  for (let n = 1; n <= CARDS_PER_RARITY; n++) map.get(cardPower('common', n)).push(n);
  return map;
})();

// Your head card, plus two more of its rarity.
//
// Two rules do all the work here. Your OWN card is slot 0 — you picked that face and it
// should mean more than a portrait. And the three powers are all DIFFERENT, which is why
// the deal picks powers first and cards second: dealing three cards at random would hand
// out three magnets often enough to matter, and a hand of three magnets is one power and
// two dead buttons.
export function dealHand(mine, theirs, i = 0) {
  const rarity = RARITIES.includes(mine?.rarity) ? mine.rarity : 'common';
  const number = Math.max(1, Math.min(CARDS_PER_RARITY, Math.round(mine?.number) || 1));
  const seed = seedFor(mine, theirs, i);
  const own = cardPower(rarity, number);

  // The five powers that are not already in the hand, shuffled — a partial Fisher-Yates
  // driven by the seeded stream, so the pick is a permutation and never draws a duplicate.
  const rest = ORDER.filter((k) => k !== own);
  for (let j = rest.length - 1; j > 0; j--) {
    const r = Math.floor(rndAt(seed, j) * (j + 1));
    [rest[j], rest[r]] = [rest[r], rest[j]];
  }

  const hand = [{ rarity, number }];
  for (let s = 0; s < 2; s++) {
    const kind = rest[s];
    const pool = BY_POWER.get(kind);
    hand.push({ rarity, number: pool[Math.floor(rndAt(seed, 8 + s) * pool.length)] });
  }
  return hand;
}

// Both hands at once — what createMatch calls.
export const handOf = (charA, charB) => [dealHand(charA, charB, 0), dealHand(charB, charA, 1)];


// ═══════════════════════════════════════════════════════════════════════════════
// THE HAND IN A MATCH
//
// Three buttons per player, each holding a card, each with its own cooldown. The cooldown
// is the ONLY thing here that can change during a match, so it is the only thing that
// travels: six integers, ticks not seconds, for the same reason powerups.js counts in ticks
// — a restored client counts down the identical schedule instead of drifting a tick out.
//
// The hands themselves never travel. They are dealt from the two cards, which are
// match-constant and known at both ends before the first tick.
export const CARD_SLOTS = 3;
export const CARD_KEYS = ['card1', 'card2', 'card3'];

const ticks = (seconds) => Math.max(1, Math.round(seconds / C.TICK));

export function createCards(charA, charB) {
  return { hands: handOf(charA, charB), cd: new Array(2 * CARD_SLOTS).fill(0) };
}

export const cardAt = (m, i, s) => (m.cards ? m.cards.hands[i][s] : null);
export const cardKind = (m, i, s) => {
  const c = cardAt(m, i, s);
  return c ? cardPower(c.rarity, c.number) : PU.NONE;
};

// Seconds left, for the renderer and the tests. The sim itself works in the raw ticks.
export const cardCd = (m, i, s) => (m.cards ? m.cards.cd[i * CARD_SLOTS + s] * C.TICK : 0);
export const cardReady = (m, i, s) => !!m.cards && m.cards.cd[i * CARD_SLOTS + s] <= 0;
// 0..1 for the filling ring under the card art.
export const cardFill = (m, i, s) => {
  if (!m.cards) return 1;
  const c = cardAt(m, i, s);
  const full = ticks(cardCooldown(c.rarity));
  const left = m.cards.cd[i * CARD_SLOTS + s];
  return left <= 0 ? 1 : Math.max(0, Math.min(1, 1 - left / full));
};

// Is this power running on this player right now? The renderer greys a card whose effect is
// already live, and the sim refuses to re-fire it — pressing GROW while your head is huge
// should not burn the cooldown for nothing.
export function liveKind(m, i, kind) {
  if (kind === PU.CHARGE) return m.players[i].gauge >= 1;
  if (kind === PU.ICE) return m.players[1 - i].slow > 0;
  const SLOTS = { [PU.GROW]: 0, [PU.MAGNET]: 1, [PU.SHIELD]: 2, [PU.SPRING]: 3 };
  const s = SLOTS[kind];
  return s === undefined ? false : effT(m, i, s) > 0;
}

// ---------------------------------------------------------------------------
// PRESSING ONE. Called from sim.js on the button's RISING EDGE only — see the note in
// sim.js about why that latch is where the bug lives.
export function useCard(m, p, s, fx) {
  if (!C.CARDS_ON || !m.cards) return false;
  const i = p.index;
  const idx = i * CARD_SLOTS + s;
  if (m.cards.cd[idx] > 0) return false;

  const card = m.cards.hands[i][s];
  const kind = cardPower(card.rarity, card.number);
  // Already running: refuse rather than refresh. A refresh would make spamming one card
  // strictly better than playing the other two.
  if (liveKind(m, i, kind)) return false;

  applyPower(m, i, kind, cardStrength(card.rarity), fx, { x: p.x, y: pickupY() });
  m.cards.cd[idx] = ticks(cardCooldown(card.rarity));
  m.events.push({
    type: 'cardUse', player: i, slot: s, kind, name: PU_NAME[kind],
    rarity: card.rarity, number: card.number, color: PU_COLOR[kind],
  });
  return true;
}

// Every cooldown ticks. One line, called once per step.
export function stepCards(m) {
  if (!m.cards) return;
  const cd = m.cards.cd;
  for (let k = 0; k < cd.length; k++) if (cd[k] > 0) cd[k]--;
}

// THE OTHER HALF OF THE COOLDOWN. A card that only ticks rewards standing still, and this
// is a game about running at someone. So contact pays: a kick knocks a little off all three
// of your cards, a tackle knocks a lot off, a goal more again.
//
// All three at once, deliberately — paying only the card you last used would teach players
// to hold two cards back, and the point is to make CONTACT the thing you chase.
export function chargeCards(m, i, seconds) {
  if (!m.cards || !(seconds > 0)) return;
  const n = Math.round(seconds / C.TICK);
  const cd = m.cards.cd;
  for (let s = 0; s < CARD_SLOTS; s++) {
    const k = i * CARD_SLOTS + s;
    if (cd[k] > 0) cd[k] = Math.max(0, cd[k] - n);
  }
}

// Wire format. Six integers, trailing zeros trimmed — an untouched hand is `[]`.
export function packCards(cards) {
  const a = cards ? cards.cd.slice() : [];
  let end = a.length;
  while (end > 0 && a[end - 1] === 0) end--;
  return end === a.length ? a : a.slice(0, end);
}

export function unpackCards(cards, a) {
  if (!cards) return cards;
  for (let k = 0; k < cards.cd.length; k++) cards.cd[k] = k < a.length ? a[k] : 0;
  return cards;
}
