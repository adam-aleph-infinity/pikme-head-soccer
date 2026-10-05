// THE 45 CHAMPIONS — the arcade's opponents, one per legendary card, in card-number order.
//
// The pick screen already shows the אגדי row as legendary 1..45 and that is the only order the
// repo has ever given them, so it is the arcade's order too: stage n is legendary_n. What a
// champion DOES is its Head Soccer power shot — family, ailment, aura, 1–10 stats and stars, from
// the approved map (docs/HS-CHAMPION-MAP.md → shared/hs-champion-map.js); this file adds who they
// are on the arcade board and how hard their bot plays.
//
// Difficulty is a straight line from stage 1 to stage 45, so there is no stage where it jumps,
// on two sets of dials — and the reason there are two is a measurement, not a preference.
//
//   the bot's own dials — reaction time, misread, aim, counters, how long it sits on a full
//     meter. Stage 1 is the bot's easiest tier (קל מאוד) and stage 45 just short of its hardest
//     (אגדי). This is what a PERSON feels: a bot that turns up late and misreads the ball.
//   the champion's body — Head Soccer's five 1–10 stats (speed, jump, kick, dash, power), which
//     climb a little every stage from level 1 at stage 1 to the five-star body at stage 10, and stay
//     there (the map; Idan, 2026-10-05). Bot against bot the dials
//     above barely move a scoreline while the body does — 10% off the jump cost 50 goals over 64
//     matches — so the body is the ladder's other half. The POWER stat is how fast the gauge fills.
//
// The shots climb alongside it: the plain families first, Critical, Grab, Multi-Ball and Delay
// late. The player's own card always plays on equal stats.

import { HS_MAP } from './hs-champion-map.js';
import { FAMILIES, AILMENTS } from './hs-powers.js';
import { championPower } from './champion-powers.js';

export const CHAMPION_COUNT = 45;

export const TIERS = ['שכונה', 'ליגה', 'נבחרת', 'אלופים', 'אגדות'];
const PER_TIER = CHAMPION_COUNT / TIERS.length;              // 9

const TITLES = [
  'התותחן', 'אדון התולעים', 'השף הבוער', 'מלך הבוץ', 'בונה החומות', 'איל ההון', 'הקפצן', 'האיש המגנטי', 'גולש הגלים',
  'הענק', 'המכווץ', 'האסטרונאוט', 'המטפס', 'נהג המרוצים', 'מרים המשקולות', 'מקפיץ האבנים', 'רוכב הסערה', 'הסטרייקר',
  "הג'וקר", 'איש השלג', 'צייד המטאורים', 'הגנב', 'רעם האדמה', 'האקרובט', 'המטעה', 'המחליק', 'שומר הפורטל',
  'זורק הבומרנג', 'הכורה', 'אדון המשיכה', 'השואב', 'הרוזן האפל', 'רגל הזהב', 'אמן הצמר', 'הנווט', 'הופך העולמות',
  'אדון המראות', 'המשגר', 'מלך הכדרור', 'רוח הרפאים', 'שומר הזמן', 'התאום', 'המפצל', 'עין הסערה', 'אדון הזמן',
];

// Which five-star plan a champion's HS profile plays: the keepers and the tricky counter-strikers
// defend, everyone else attacks.
const ARCHETYPE = { tank: 'defense', tricky: 'defense' };

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

// The ladder: HS's stars, and stars are ONLY how smart the CPU plays (Idan, 2026-10-02). The first
// nine climb half a star each — South Korea 0.5★, Cameroon 1★ … Brazil 4.5★ — and from the tenth
// (Germany, 5★) on, every champion plays exactly as smart. What still differs after that is its
// stats and its power. t runs 0 (stage 1) → 1 (stage FIVE_STAR and every one after).
export const FIVE_STAR = 10;
// From the 24th champion on the CPU KICKS the player's power shot back (HS: "every character
// starting at Asura will counter it", Asura being the 24th; before him none do — wiki
// Power_Shot_Guide, Asura). How often the counter comes off: 40% at the 24th, 80% at the last (Idan).
export const COUNTER_STAGE = 24;
export function stageDifficulty(stage) {
  const t = Math.min(1, (stage - 1) / (FIVE_STAR - 1));
  return {
    react: round(0.34 - 0.29 * t, 4),       // s between thinks        0.34 → 0.05
    error: round(78 - 70 * t, 2),            // px of misread           78   → 8
    counter: round(0.02 + 0.6 * t, 4),       // chance to counter       0.02 → 0.62
    aim: round(0.35 + 0.61 * t, 4),          // the main skill axis     0.35 → 0.96
    powerHold: round(2.2 - 1.95 * t, 4),     // s before it will arm    2.2  → 0.25
    aggression: round(0.16 + 0.5 * t ** 1.5, 4),   // how often it presses    0.16 → 0.66
    stars: Math.min(5, stage * 0.5),         // 0.5 → 5, in halves, 5 from stage FIVE_STAR on
    t,
  };
}

// A bot style per stat profile: the strikers push, the tanks hang back, the tricky ones barge.
const PROFILE_STYLE = { power: 'striker', kicker: 'striker', fast: 'brawler', tricky: 'brawler', tank: 'keeper', jumper: 'striker', balanced: 'striker' };

// What the arcade board says a champion's shot does, in Hebrew: family · ailment · aura.
const AURA_NAME = { stun: 'הלם', push: 'הדיפה', reverse: 'בלבול', freeze: 'הקפאה' };
export function shotText(hs) {
  const parts = [FAMILIES[hs.family].name];
  if (hs.ailment) parts.push(AILMENTS[hs.ailment].name);
  if (hs.aura !== 'none') parts.push(`הילת ${AURA_NAME[hs.aura]}`);
  return parts.join(' · ');
}

export const CHAMPIONS = Object.freeze(HS_MAP.map((row, i) => {
  const stage = i + 1;
  const cp = championPower(stage);
  const hs = Object.freeze({
    family: row.family, ailment: row.ailment, aura: row.aura, auraRadius: row.auraRadius,
    intensity: row.intensity, gentle: row.gentle, stats: row.stats, stars: row.stars, profile: row.profile,
  });
  return Object.freeze({
    id: `legendary_${stage}`,
    stage,
    card: Object.freeze({ rarity: 'legendary', number: stage }),
    title: TITLES[i],
    // The theme the champion is named for (its old power's id, name and icon); what the shot DOES
    // is `hs`. Kept so the board's icons and saved progress read the same as before.
    power: row.power.id, powerName: row.power.name, icon: row.power.icon,
    color: FAMILIES[row.family].color,
    desc: shotText(hs),
    // …unless its own Head Soccer power is built (champion-powers.js): then the board shows that.
    ...(cp ? { powerName: cp.name, icon: cp.icon, color: cp.color, desc: cp.desc } : {}),
    cp,
    hs,
    tier: Math.floor(i / PER_TIER),
    style: PROFILE_STYLE[row.profile] || 'striker',
    difficulty: Object.freeze(stageDifficulty(stage)),
    arena: i,                                // which backdrop; the client wraps it round its pool
  });
}));

export const ARCADE_STAGES = Object.freeze(CHAMPIONS.map((c) => Object.freeze({ stage: c.stage, champion: c.id })));

const BY_ID = new Map(CHAMPIONS.map((c) => [c.id, c]));
export const championById = (id) => BY_ID.get(id) || null;
export const championForStage = (stage) => CHAMPIONS[stage - 1] || null;

// A card → its champion, or null. Only legendary cards are champions; every other card keeps
// the ordinary power shot it has everywhere else.
export function championFor(char) {
  if (!char || char.rarity !== 'legendary') return null;
  return BY_ID.get(`legendary_${char.number}`) || null;
}

// The bot for a champion: the stage's ladder, bent by the champion's style, and told when its
// own power is worth arming. `smart` is part of the ladder too — below it the bot arms the
// moment it can, the way every bot always has; above it, it waits for the moment the power
// was made for.
export function botProfile(champ) {
  const d = champ.difficulty;
  return {
    name: champ.title,
    react: d.react, error: d.error, counter: d.counter, aim: d.aim, powerHold: d.powerHold,
    // One CPU per star level, as HS's: no per-champion style on top (Idan: after the tenth they all
    // play exactly the same) — a champion differs by its stats and its power, not its brain.
    aggression: d.aggression,
    tackle: 1,
    stars: d.stars,                          // how keen it is to boot the other player (bot.js bootOf)
    // …except the one split HS's five-star CPU has (Idan's HS notes): OFFENSIVE presses into the
    // other half, DEFENSIVE camps by its own goal and counters — the same smartness either way.
    ...(d.t >= 1 ? { archetype: ARCHETYPE[champ.hs.profile] || 'offense' } : {}),
    ...(champ.stage >= COUNTER_STAGE ? { counterKick: true, counterRate: round(0.4 + 0.4 * (champ.stage - COUNTER_STAGE) / (CHAMPION_COUNT - COUNTER_STAGE), 3) } : {}),
    arm: 'attack',                           // every Head Soccer power is a shot at the goal
    smart: d.aim >= 0.55,
  };
}

// Everything the client needs to start a stage.
export function stageConfig(stage) {
  const champ = championForStage(stage);
  if (!champ) return null;
  return {
    stage, champ,
    bot: botProfile(champ),
    // Player 0 is the human (equal stats, always); player 1 is the champion on its HS stats.
    matchOpts: {
      champions: true,
      stats: [null, champ.hs.stats],
    },
  };
}
