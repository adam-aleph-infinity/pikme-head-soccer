// THE 45 CHAMPIONS — the arcade's opponents, one per legendary card, in card-number order.
//
// The pick screen already shows the אגדי row as legendary 1..45 and that is the only order the
// repo has ever given them, so it is the arcade's order too: stage n is legendary_n. What a
// champion DOES is its power (shared/powers.js, POWER_ORDER[n-1]); this file adds who they are
// on the arcade board and how hard their bot plays.
//
// Difficulty is a straight line from stage 1 to stage 45, so there is no stage where it jumps,
// on two sets of dials — and the reason there are two is a measurement, not a preference.
//
//   the bot's own dials — reaction time, misread, aim, counters, how long it sits on a full
//     meter. Stage 1 is the bot's easiest tier (קל מאוד) and stage 45 just short of its hardest
//     (אגדי). This is what a PERSON feels: a bot that turns up late and misreads the ball.
//   the champion's body and nerve — jump, run and boot, and how often it commits forward.
//     Bot against bot, the dials above barely move a scoreline (test-bot says as much: the
//     legendary tier does not reliably beat the very-easy one), while these do: 10% off the
//     jump cost 50 goals over 64 matches, because most goals go over the defender's head, and
//     aggression was the biggest single term the README ever measured. So the ladder climbs on
//     both — early champions are a step slow and a little earthbound, late ones are not.
//
// The powers climb alongside it: one clean effect in the first tier, several moving parts in
// the last. Hard at 45, still beatable: every number stays inside what a human player's own
// legendary card already has.

import { POWERS, POWER_ORDER } from './powers.js';

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

// How each bot style bends the base ladder. Small on purpose: aggression was measured as the
// single biggest term in the scoreline (see bot.js), so a style nudges it rather than owns it.
const STYLES = {
  striker: { aggression: 0.06, tackle: 1.0 },
  keeper: { aggression: -0.1, tackle: 0.9 },
  brawler: { aggression: 0, tackle: 1.35 },
};

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

// The ladder. t runs 0 (stage 1) → 1 (stage 45).
export function stageDifficulty(stage) {
  const t = (stage - 1) / (CHAMPION_COUNT - 1);
  return {
    react: round(0.34 - 0.29 * t, 4),       // s between thinks        0.34 → 0.05
    error: round(78 - 70 * t, 2),            // px of misread           78   → 8
    counter: round(0.02 + 0.6 * t, 4),       // chance to counter       0.02 → 0.62
    aim: round(0.35 + 0.61 * t, 4),          // the main skill axis     0.35 → 0.96
    powerHold: round(2.2 - 1.95 * t, 4),     // s before it will arm    2.2  → 0.25
    // These two are power-independent, so they are bent (t^1.5) to give the late stages more of
    // the climb: the middle tier's powers already take the opponent's controls away, the last
    // tiers' mostly do not, and the scoreline showed it — measured, _ladder in the README.
    aggression: round(0.16 + 0.5 * t ** 1.5, 4),   // how often it presses    0.16 → 0.66
    meterRate: round(1 + 0.9 * t ** 1.5, 4),       // its tackles fill        1.0  → 1.9 of a meter slice
    // The body, as a multiple of its legendary card's own stats (1.05 jump, 1.06 run, 1.08
    // boot). Stage 45 tops out just past parity with a legendary card of the player's.
    body: {
      speed: round(0.9 + 0.14 * t, 4),       // 0.90 → 1.04
      jump: round(0.84 + 0.2 * t, 4),        // 0.84 → 1.04 — the one that matters most
      kick: round(0.88 + 0.16 * t, 4),       // 0.88 → 1.04
    },
    stars: 1 + Math.round(t * 8) / 2,        // 1 → 5, in halves
    t,
  };
}

export const CHAMPIONS = Object.freeze(POWER_ORDER.map((powerId, i) => {
  const stage = i + 1;
  return Object.freeze({
    id: `legendary_${stage}`,
    stage,
    card: Object.freeze({ rarity: 'legendary', number: stage }),
    title: TITLES[i],
    power: powerId,
    tier: Math.floor(i / PER_TIER),
    style: POWERS[powerId].style,
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
  const s = STYLES[champ.style] || STYLES.striker;
  return {
    name: champ.title,
    react: d.react, error: d.error, counter: d.counter, aim: d.aim, powerHold: d.powerHold,
    aggression: round(d.aggression + s.aggression, 4),
    tackle: s.tackle,
    arm: POWERS[champ.power].arm,
    smart: d.aim >= 0.55,
    adapt: d.t >= 0.5,                       // reads its own reversed controls and corrects them
  };
}

// Everything the client needs to start a stage.
export function stageConfig(stage) {
  const champ = championForStage(stage);
  if (!champ) return null;
  return {
    stage, champ,
    bot: botProfile(champ),
    // Player 0 is the human (1.0, always); player 1 is the champion.
    matchOpts: {
      champions: true,
      meterRate: [1, champ.difficulty.meterRate],
      statScale: [null, champ.difficulty.body],
    },
  };
}
