// THE MYTHIC STARTERS — four cards of a rarity of their own (Idan, 2026-10-08).
//
// Four characters drawn by Idan's artist (uploaded-images/champ_A–D; the art: tools/chars/
// mythic_trace.py and mythic_build.py, docs/CHARACTERS.md "The Mythic starters"). They are not in
// the Saltiz app's album and never were: a new player picks ONE of them, free, before the tutorial,
// and keeps it. The other three cannot be won in the game; buying them is for later.
//
// Like every card they play on the player's own upgrade levels (no stats of their own: Idan, "no
// bonus"), and the four share ONE power, the Mythic power (Idan: "one Mythic power") — so the
// choice is about who you are, never about strength. The hitbox is everyone's (sim.js headR).

export const MYTHIC = 'mythic';
export const MYTHIC_COUNT = 4;

// number → who. `sheet` is the artist's folder; `name` is what the game shows.
// `role` is the line under them on the starter screen: who they are, not what they do (they all
// play the same: Idan, one power and no stats of their own).
export const MYTHICS = Object.freeze([
  Object.freeze({ number: 1, sheet: 'champ_A', name: 'שובל', en: 'Shoval', shirt: 24, role: 'הקפטן: שקט, חד, תמיד בשליטה' }),
  Object.freeze({ number: 2, sheet: 'champ_B', name: 'אורי', en: 'Ori', shirt: 28, role: 'הכוכבת: חיוך אחד, וגול בדרך' }),
  Object.freeze({ number: 3, sheet: 'champ_C', name: 'נוה', en: 'Naveh', shirt: 10, role: 'האנרגיה: רץ בלי לעצור' }),
  Object.freeze({ number: 4, sheet: 'champ_D', name: 'פז', en: 'Paz', shirt: 5, role: 'המוח: רואה את המשחק לפני כולם' }),
]);

// THE MYTHIC POWER: the Mythic Gem (Idan, 2026-10-08: one power for all four, unique, above the
// arcade's average). The ball turns into a gem and flies fast at the goal; met with the head or
// the body it shatters into three shards that fly on, and only a timed kick stops it — what it
// does: shared/champion-powers/mythic.js, its look: public/vfx/powers/mythic.js. Each Mythic fires
// it in their own gem's colour (Idan): Shoval red, Ori pink, Naveh yellow, Paz green.
export const MYTHIC_POWER = Object.freeze({ cp: 'mythicgem', family: 'straight', speed: 1.1, name: 'Gem Strike', icon: '💎' });
export const MYTHIC_GEMS = Object.freeze({
  1: Object.freeze({ gem: 'ruby', name: 'רובי', color: '#ff2b45', glow: '#ffc2ca' }),
  2: Object.freeze({ gem: 'pink diamond', name: 'יהלום ורוד', color: '#ff4fc8', glow: '#ffd3f1' }),
  3: Object.freeze({ gem: 'topaz', name: 'טופז', color: '#ffc61a', glow: '#fff1b8' }),
  4: Object.freeze({ gem: 'emerald', name: 'אמרלד', color: '#19d873', glow: '#c4ffdc' }),
});
export const mythicGem = (n) => MYTHIC_GEMS[+n] || MYTHIC_GEMS[1];

export const isMythic = (card) => !!card && card.rarity === MYTHIC && Number.isInteger(+card.number) && +card.number >= 1 && +card.number <= MYTHIC_COUNT;
export const mythicOf = (card) => (isMythic(card) ? MYTHICS[+card.number - 1] : null);

// ── THE STARTER: chosen once, kept for good ──────────────────────────────────────────────────
// Its own key; nothing already saved on a device is read or rewritten (arcade progress, points and
// upgrades are untouched). Written the moment the choice is confirmed, before the tutorial, so a
// game closed mid-tutorial comes back with the same Mythic and never offers the choice again.
// A value that will not parse is no choice at all, so the player is asked again rather than stuck.
export const STARTER_KEY = 'hs.mythic.v1';
export function parseStarter(raw) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const n = o && o.v === 1 ? o.starter : null;
    return Number.isInteger(n) && n >= 1 && n <= MYTHIC_COUNT ? n : null;
  } catch { return null; }
}
export function loadStarter(storage) {
  try { return parseStarter(storage ? storage.getItem(STARTER_KEY) : null); } catch { return null; }
}
// Saves the choice — unless one is already saved, which is kept: the choice is made once. Returns
// the starter the device now has.
export function saveStarter(storage, n) {
  const had = loadStarter(storage);
  if (had) return had;
  if (!(Number.isInteger(n) && n >= 1 && n <= MYTHIC_COUNT)) return null;
  try { storage.setItem(STARTER_KEY, JSON.stringify({ v: 1, starter: n })); } catch { return null; }
  return loadStarter(storage) || n;
}
// The one way to change it after that: a team switch (shared/teams.js), which switches the champion
// with the team (Idan, 2026-10-08). The server decides whether the switch is allowed; this only
// writes what it allowed. Returns the starter the device now has.
export function switchStarter(storage, n) {
  if (!(Number.isInteger(n) && n >= 1 && n <= MYTHIC_COUNT)) return loadStarter(storage);
  try { storage.setItem(STARTER_KEY, JSON.stringify({ v: 1, starter: n })); } catch { return loadStarter(storage); }
  return loadStarter(storage) || n;
}
// Which Mythic a player may play: their starter, and only it. The other three are locked for good
// in the game (buying them is for later), whatever the app's album says.
export const ownsMythic = (starter, n) => !!starter && +n === starter;
// Does this launch have to ask for a starter first? Always, until one is chosen — whatever else
// happens (Idan: "require a choice even if the player skips the tutorial"). ?nointro is the
// harnesses' way past the whole first launch.
export const needsStarter = ({ starter = null, params = null } = {}) => !starter && !(params && params.has && params.has('nointro'));
