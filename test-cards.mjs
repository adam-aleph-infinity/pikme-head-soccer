// Card tests — the hand of three, and the ladder that makes a legendary worth having.
// Run: node test-cards.mjs
//
// The pickups asked "is the race fair?". Cards ask a harder question, because a hand is
// dealt rather than raced for: is a hand you did not choose still a hand you can play? The
// rules that answer it, each asserted below:
//
//   1. A CARD'S POWER IS PART OF THE CARD. cardPower() is a pure function of the card, so
//      the same card is the same power forever — in the lobby, in the match, next week.
//      Nothing rolls at match start except WHICH cards you hold.
//   2. YOUR HEAD CARD IS ALWAYS IN YOUR HAND, in slot 0. You picked that face; it should
//      mean something beyond the portrait.
//   3. THREE DIFFERENT POWERS. A hand of three magnets is one power and two dead buttons.
//   4. THE LADDER IS MONOTONIC. Every step up in rarity is stronger AND cools faster —
//      never one at the cost of the other, or a rare would beat a legendary at something.
//   5. BOTH ENDS DEAL THE SAME HAND. The deal is derived from the two cards, which are
//      match-constant, so it never travels and can never disagree.
import * as C from './shared/constants.js';
import { PU, PU_NAME } from './shared/powerups.js';
import { RARITIES, CARDS_PER_RARITY, cardPower, cardTier, cardCooldown, cardStrength,
         dealHand, handOf, cardCd, chargeCards, liveKind } from './shared/cards.js';
import { createMatch, step, serialize, restore } from './shared/sim.js';
import { effT } from './shared/powerups.js';
import { createBot, botInput } from './shared/bot.js';
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const every = (fn) => {
  const out = [];
  for (const r of RARITIES) for (let n = 1; n <= CARDS_PER_RARITY; n++) out.push(fn(r, n));
  return out;
};

// ── 1. A card's power is part of the card ──────────────────────────────────────
{
  const kinds = every((r, n) => cardPower(r, n));
  // 1..10 now: 1..6 are the originals every rarity fires, 7..10 the specials that only epic
  // and legendary carry (see test-skills.mjs for which rarity gets which).
  ok('every card in the album has a power',
    kinds.every((k) => k >= 1 && k <= 10),
    `bad: ${kinds.filter((k) => !(k >= 1 && k <= 10)).length}`);

  ok('and asking twice gives the same answer',
    every((r, n) => cardPower(r, n)).every((k, i) => k === kinds[i]));

  // This used to assert that a number meant the same power in EVERY rarity. It no longer
  // does, and that is the deliberate change that made rarity worth something: an epic and a
  // legendary draw from bigger pools (see test-skills.mjs), so number 12 lands on a different
  // power there. What survives is the half that a player actually learns:
  //
  //   • within a rarity, the number always picks the same power, forever;
  //   • the two rarities that share a pool — common and rare — still agree card for card.
  ok('a number always means the same power within its rarity',
    RARITIES.every((r) => cardPower(r, 12) === cardPower(r, 12) && cardPower(r, 12) === every((rr, n) => (rr === r && n === 12 ? cardPower(rr, n) : cardPower(r, 12)))[0]));
  ok('common and rare agree card for card',
    Array.from({ length: CARDS_PER_RARITY }, (_, i) => i + 1)
      .every((n) => cardPower('common', n) === cardPower('rare', n)),
    `${PU_NAME[cardPower('common', 12)]} vs ${PU_NAME[cardPower('rare', 12)]}`);

  const spread = {};
  for (let n = 1; n <= CARDS_PER_RARITY; n++) spread[cardPower('common', n)] = (spread[cardPower('common', n)] || 0) + 1;
  ok('all six of a common\'s powers are reachable', Object.keys(spread).length === 6,
    JSON.stringify(spread));
  // Not a cosmetic point: 45 cards over 6 powers is 7.5 each, and a spread of 20/5/5/5/5/5
  // would mean a third of all album cards are the same button.
  const counts = Object.values(spread);
  ok('and no power hogs the album', Math.max(...counts) - Math.min(...counts) <= 1,
    `${Math.min(...counts)}..${Math.max(...counts)}`);
}

// ── 2/3. The hand ──────────────────────────────────────────────────────────────
{
  const hand = dealHand(CA, CB, 0);
  ok('a hand is three cards', hand.length === 3);
  ok('slot 0 is the card you are playing as',
    hand[0].rarity === CA.rarity && hand[0].number === CA.number,
    JSON.stringify(hand[0]));
  ok('the other two share its rarity', hand.every((c) => c.rarity === CA.rarity));
  ok('no card is dealt twice', new Set(hand.map((c) => c.number)).size === 3,
    hand.map((c) => c.number).join(','));
  ok('and the three powers are all different',
    new Set(hand.map((c) => cardPower(c.rarity, c.number))).size === 3,
    hand.map((c) => PU_NAME[cardPower(c.rarity, c.number)]).join(','));

  // Every card in the album must be able to lead a legal hand — including a card whose
  // power collides with the two the dealer would otherwise reach for.
  const bad = [];
  for (const r of RARITIES) for (let n = 1; n <= CARDS_PER_RARITY; n++) {
    const h = dealHand({ rarity: r, number: n }, CB, 0);
    const powers = new Set(h.map((c) => cardPower(c.rarity, c.number)));
    if (h.length !== 3 || powers.size !== 3 || new Set(h.map((c) => c.number)).size !== 3
        || h[0].number !== n || !h.every((c) => c.rarity === r)) bad.push(`${r}_${n}`);
  }
  ok('and that holds for all 180 cards in the album', bad.length === 0, bad.slice(0, 5).join(' '));

  const again = dealHand(CA, CB, 0);
  ok('the same match deals the same hand',
    JSON.stringify(again) === JSON.stringify(hand));
  ok('the two players do not get identical hands',
    JSON.stringify(dealHand(CB, CA, 1)) !== JSON.stringify(hand));

  // A different opponent is a different match, so the two spare cards may differ — but the
  // card you chose is yours and must survive any opponent.
  const vsOther = dealHand(CA, { rarity: 'common', number: 40 }, 0);
  ok('your own card is in your hand whoever you play',
    vsOther[0].rarity === CA.rarity && vsOther[0].number === CA.number);
}

// ── 4. The ladder ──────────────────────────────────────────────────────────────
{
  ok('rarity tiers climb in the right order',
    RARITIES.map(cardTier).join(',') === '0,1,2,3', RARITIES.map(cardTier).join(','));

  const cds = RARITIES.map(cardCooldown);
  const str = RARITIES.map(cardStrength);
  ok('every step up cools faster', cds.every((v, i) => i === 0 || v < cds[i - 1]), cds.join(' → '));
  ok('every step up is stronger', str.every((v, i) => i === 0 || v > str[i - 1]), str.join(' → '));
  // A common has to come round at least twice in a match, or its card is a one-shot.
  ok('a common is still worth pressing', cds[0] * 2 < C.MATCH_DURATION && str[0] > 0,
    `cd ${cds[0]}s × 2 vs a ${C.MATCH_DURATION}s match`);
  // The ladder is a ladder, not a cliff: a legendary that cooled four times faster than a
  // common would make every other rarity decoration.
  ok('and a legendary is a better card, not a different game',
    cds[0] / cds[3] <= 2.5 && str[3] / str[0] <= 2, `cd ×${(cds[0] / cds[3]).toFixed(2)} str ×${(str[3] / str[0]).toFixed(2)}`);
  // And a card is a shorter thing than a crate, whatever the rarity: it is on a clock in
  // your hand rather than raced for once a match.
  ok('every card runs shorter than the crate it borrows from', str.every((v) => v < 1),
    str.map((v) => v.toFixed(2)).join(' '));

  // A card you cannot use twice in a match is a card you will not learn.
  ok('every rarity cools inside a match', cds.every((v) => v * 2 < C.MATCH_DURATION),
    `slowest ${cds[0]}s of ${C.MATCH_DURATION}s`);
}

// ── 5. handOf: the match-facing helper ─────────────────────────────────────────
{
  const hands = handOf(CA, CB);
  ok('handOf deals both hands at once', hands.length === 2 && hands[0].length === 3);
  ok('and agrees with dealHand', JSON.stringify(hands[0]) === JSON.stringify(dealHand(CA, CB, 0)));
}

// ── 6. THE BUTTONS: pressing a card in a real match ────────────────────────────
{
  const press = (s) => { const o = {}; o[`card${s + 1}`] = true; return [o, {}]; };
  const fresh = () => { const m = createMatch(CA, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play'; return m; };
  const run = (m, n, inputs = [{}, {}]) => { for (let i = 0; i < n; i++) { step(m, inputs); m.events.length = 0; } return m; };

  const m = fresh();
  ok('a match deals both hands', !!m.cards && m.cards.hands.length === 2 && m.cards.hands[0].length === 3);
  ok('and every card starts ready', cardCd(m, 0, 0) === 0 && cardCd(m, 0, 2) === 0);
  ok('your hand is the one cards.js dealt',
    JSON.stringify(m.cards.hands[0]) === JSON.stringify(dealHand(CA, CB, 0)));

  // legendary_3 is the spring, and slots 1 and 2 are whatever the deal gave it.
  const mine = m.cards.hands[0];
  const kind0 = cardPower(mine[0].rarity, mine[0].number);
  step(m, press(0));
  const used = m.events.filter((e) => e.type === 'cardUse');
  ok('pressing a card fires it', used.length === 1 && used[0].kind === kind0 && used[0].player === 0,
    JSON.stringify(used[0] || null));
  ok('and the power it fired is the card its number says', liveKind(m, 0, kind0),
    `${PU_NAME[kind0]} not live`);
  ok('the card goes on cooldown', cardCd(m, 0, 0) > 0);

  // The edge trap, written as a test because this is the exact class of bug that made the
  // football build shoot the wrong way: a held button must fire ONCE.
  m.events.length = 0;
  run(m, 30, press(0));
  ok('holding the button does not fire it again',
    m.events.filter((e) => e.type === 'cardUse').length === 0);

  // And the other side of it: a press while cooling is simply ignored.
  m.events.length = 0;
  step(m, [{}, {}]); step(m, press(0));
  ok('and neither does pressing again while it cools',
    m.events.filter((e) => e.type === 'cardUse').length === 0, `cd=${cardCd(m, 0, 0)}`);

  ok('the other two cards are still ready', cardCd(m, 0, 1) === 0 && cardCd(m, 0, 2) === 0);
  ok('and pressing a card does nothing to the opponent hand',
    cardCd(m, 1, 0) === 0 && cardCd(m, 1, 1) === 0);
}

// ── 7. Cooling down, and earning it back ───────────────────────────────────────
{
  const m2 = createMatch(CA, CB, { duration: 300 }); m2.freeze = 0; m2.phase = 'play';
  step(m2, [{ card1: true }, {}]);
  const full = cardCd(m2, 0, 0);
  ok('a legendary cools in about the ladder time',
    Math.abs(full - cardCooldown('legendary')) < 0.2, `${full.toFixed(1)}s vs ${cardCooldown('legendary').toFixed(1)}s`);

  for (let i = 0; i < 60; i++) { step(m2, [{}, {}]); m2.events.length = 0; }
  const after = cardCd(m2, 0, 0);
  ok('and it ticks down on its own', after < full && after > 0, `${full.toFixed(1)} → ${after.toFixed(1)}`);

  // Contact is the other half. Written as "a kick is worth less than a tackle" rather than
  // exact seconds, because that ordering is the design and the seconds are a slider.
  const before = cardCd(m2, 0, 0);
  chargeCards(m2, 0, C.CARD_CHARGE_KICK);
  const kicked = cardCd(m2, 0, 0);
  chargeCards(m2, 0, C.CARD_CHARGE_HIT);
  const hit = cardCd(m2, 0, 0);
  ok('kicking the ball knocks time off the cooldown', kicked < before, `${before.toFixed(1)} → ${kicked.toFixed(1)}`);
  ok('and tackling the opponent is worth more than a kick',
    (before - kicked) < (kicked - hit), `kick ${(before - kicked).toFixed(1)}s vs hit ${(kicked - hit).toFixed(1)}s`);

  // Charge cannot bank: a cooldown at zero is ready, not minus four.
  for (let i = 0; i < 20; i++) chargeCards(m2, 0, C.CARD_CHARGE_HIT);
  ok('and a cooldown never goes below ready', cardCd(m2, 0, 0) === 0);
}

// ── 7b. Contact in an actual match, not through the helper ─────────────────────
{
  // The helper test above proves chargeCards() does arithmetic. This proves the sim
  // actually CALLS it, which is the part that can silently go missing.
  const m = createMatch(CA, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play';
  step(m, [{ card1: true }, {}]);
  m.hitStop = 0;                       // the press's own punch; a match spends it in 3 ticks
  const spent = () => cardCd(m, 0, 0);

  // A swing at AIR pays nothing — see the note at the strike site. Only a touch does.
  const beforeAir = spent();
  step(m, [{ kick: true }, {}]); m.events.length = 0;
  ok('swinging at nothing does not charge the hand', Math.abs(spent() - (beforeAir - C.TICK)) < 1e-6,
    `${beforeAir.toFixed(2)} → ${spent().toFixed(2)}`);

  // A kick that CONNECTS does. Put the ball on the boot and swing.
  const p0 = m.players[0];
  p0.kickCd = 0; p0.prev = {}; m.hitStop = 0; p0.facing = 1;
  m.ball.x = p0.x + C.KICK_REACH; m.ball.y = p0.y - C.BODY_H * 0.45;
  m.ball.vx = 0; m.ball.vy = 0;
  const beforeKick = spent();
  for (let i = 0; i < 3; i++) { step(m, [{ kick: true }, {}]); m.events.length = 0; }
  ok('the sim pays a real touch into the cooldown', spent() < beforeKick - C.TICK * 3,
    `${beforeKick.toFixed(2)} → ${spent().toFixed(2)}`);

  // Now a tackle: stand them on top of each other and swing.
  const [me, foe] = m.players;
  me.x = 600; foe.x = 600 + 20; foe.y = me.y;
  me.kickCd = 0; me.prev = {}; m.hitStop = 0;
  const beforeHit = spent();
  const seen = [];
  step(m, [{ kick: true }, {}]);
  for (const e of m.events) seen.push(e.type);
  m.events.length = 0;
  ok('and a tackle lands', seen.includes('tackle') || foe.knocked > 0, seen.join(','));
  ok('a tackle is worth much more than the swing alone',
    beforeHit - spent() > C.CARD_CHARGE_KICK * 2,
    `${(beforeHit - spent()).toFixed(2)}s off`);
}

// ── 7c. A goal ─────────────────────────────────────────────────────────────────
{
  const m = createMatch(CA, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play';
  step(m, [{ card1: true }, {}]); m.events.length = 0;
  const before = cardCd(m, 0, 0);
  // Put the ball in their net.
  m.hitStop = 0;
  m.ball.x = C.W - 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = 200;
  for (let i = 0; i < 30 && m.score[0] === 0; i++) { step(m, [{}, {}]); m.events.length = 0; }
  ok('a goal went in', m.score[0] === 1, m.score.join('-'));
  ok('and scoring pays the scorer cooldown', cardCd(m, 0, 0) < before - C.CARD_CHARGE_KICK,
    `${before.toFixed(2)} → ${cardCd(m, 0, 0).toFixed(2)}`);
  ok('but not the player who conceded', cardCd(m, 1, 0) === 0);
}

// ── 8. The rarity ladder, felt rather than tabulated ───────────────────────────
{
  // The same card number in two rarities: same power, longer on the legendary.
  const dur = (rarity) => {
    const c = { rarity, number: 1 };                    // number 1 = GROW, a timed effect
    const m = createMatch(c, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play';
    step(m, [{ card1: true }, {}]);
    return effT(m, 0, 0);
  };
  const common = dur('common'), legendary = dur('legendary');
  ok('a legendary power runs longer than a common one', legendary > common,
    `${common} vs ${legendary} ticks`);
  const ladder = cardStrength('legendary') / cardStrength('common');
  ok('by about the ladder factor',
    Math.abs(legendary / common - ladder) < 0.05,
    `×${(legendary / common).toFixed(2)} vs ×${ladder.toFixed(2)}`);
}

// ── 8b. A card's power has to actually RUN ─────────────────────────────────────
{
  // The bug this test exists for: the crate spawner is off by default now, and its step
  // function used to read "system off → cancel every running effect" — which was correct
  // when crates were the only source of an effect and catastrophic the moment cards became
  // the other one. A pressed card applied its power and the very next tick erased it. It
  // passed every unit test in this file, because they all measured the tick of the press.
  const m = createMatch({ rarity: 'legendary', number: 1 }, CB, { duration: 300 });
  m.freeze = 0; m.phase = 'play';
  step(m, [{ card1: true }, {}]);          // number 1 = GROW, a timed effect
  m.hitStop = 0;
  const t0 = effT(m, 0, 0);
  ok('(the power went on)', t0 > 0);

  for (let i = 0; i < 60; i++) { step(m, [{}, {}]); m.events.length = 0; }
  const t1 = effT(m, 0, 0);
  ok('a card power survives with the crates switched off', t1 > 0, `${t0} → ${t1} ticks`);
  ok('and it is counting down, not frozen', t1 < t0, `${t0} → ${t1}`);

  // ...and it still ENDS. The other half of the promise.
  for (let i = 0; i < 1200 && effT(m, 0, 0) > 0; i++) { step(m, [{}, {}]); m.events.length = 0; }
  ok('and it ends on its own', effT(m, 0, 0) === 0);

  // Both systems off is still an off switch.
  const m2 = createMatch({ rarity: 'legendary', number: 1 }, CB, { duration: 300 });
  m2.freeze = 0; m2.phase = 'play';
  step(m2, [{ card1: true }, {}]);
  m2.hitStop = 0;                       // the press's own punch, which freezes the tick
  C.tune({ CARDS_ON: 0 });
  step(m2, [{}, {}]);
  ok('turning BOTH systems off cancels what is running', effT(m2, 0, 0) === 0);
  C.tune({ CARDS_ON: 1 });
}

// ── 9. It has to survive the wire ──────────────────────────────────────────────
{
  const m = createMatch(CA, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play';
  step(m, [{ card1: true }, {}]);
  for (let i = 0; i < 10; i++) { step(m, [{ card1: true }, {}]); m.events.length = 0; }

  const clone = createMatch(CA, CB, { duration: 300 });
  restore(clone, serialize(m));
  ok('cooldowns travel in the snapshot',
    Math.abs(cardCd(clone, 0, 0) - cardCd(m, 0, 0)) < 1e-6,
    `${cardCd(m, 0, 0).toFixed(2)} vs ${cardCd(clone, 0, 0).toFixed(2)}`);

  // The trap this test exists for: `prev` is how the sim knows a button is HELD. If the
  // card bits are missing from it, a restored client sees a fresh press every single tick
  // it replays with the button down, and a rollback machine-guns the ability.
  clone.events.length = 0;
  step(clone, [{ card1: true }, {}]);
  ok('and a held button is still held after a restore',
    clone.events.filter((e) => e.type === 'cardUse').length === 0,
    'the restored client re-fired a held card');

  ok('a restored hand is the same hand',
    JSON.stringify(clone.cards.hands) === JSON.stringify(m.cards.hands));
}

// ── 10. The off switch ─────────────────────────────────────────────────────────
{
  C.tune({ CARDS_ON: 0 });
  const m = createMatch(CA, CB, { duration: 300 }); m.freeze = 0; m.phase = 'play';
  step(m, [{ card1: true }, {}]);
  ok('CARDS_ON=0 takes the buttons out of the sim',
    m.events.filter((e) => e.type === 'cardUse').length === 0);
  C.tune({ CARDS_ON: 1 });
}

// ── 11. The bot has a hand too ─────────────────────────────────────────────────
{
  // A hand only the human can press is not a mechanic, it is a handicap. The bot gets the
  // same three cards and the same rules, and — like every other thing it does — it gets
  // better at using them as the difficulty climbs.
  const play = (level, seeds = 6) => {
    let used = 0, matches = 0;
    for (let s = 0; s < seeds; s++) {
      const rng = mulberry32(7000 + s * 31);
      const m = createMatch(CA, CB, {});
      const bots = [createBot(level, rng), createBot(level, rng)];
      for (let t = 0; t < 5000 && m.phase !== 'over'; t++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        for (const e of m.events) if (e.type === 'cardUse') used++;
        m.events.length = 0;
      }
      matches++;
    }
    return used / matches;
  };
  const legendary = play(5);
  const easiest = play(0);
  ok('a legendary bot plays its cards', legendary >= 2, `${legendary.toFixed(1)} per match`);
  ok('and does it more than the easiest one does', legendary > easiest,
    `level 5: ${legendary.toFixed(1)}/match   level 0: ${easiest.toFixed(1)}/match`);
  // Both hands, not just the one the bot in seat 0 holds.
  ok('the easiest bot still presses something occasionally', easiest > 0,
    `${easiest.toFixed(1)} per match`);
}

console.log(`test-cards: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
