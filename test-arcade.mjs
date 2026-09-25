// Arcade tests — the 45 champions, their Head Soccer power shots, the ladder and the save.
// Run: node test-arcade.mjs
//
// Every champion is a family + ailment + aura + 1–10 stats from the approved map
// (docs/HS-CHAMPION-MAP.md). The checks are behavioural: each champion's shot is fired in the sim,
// once from player 0's seat and once from player 1's, and followed to the other player.
import { createHash } from 'node:crypto';
import * as C from './shared/constants.js';
import { createMatch, step, serialize, headY, headR } from './shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from './shared/bot.js';
import { FAMILIES, FAMILY_ORDER, AILMENT_ORDER, AURA_ORDER, shotById } from './shared/hs-powers.js';
import { HS_MAP } from './shared/hs-champion-map.js';
import {
  CHAMPIONS, ARCADE_STAGES, CHAMPION_COUNT, TIERS, championFor, championForStage, botProfile,
  stageConfig, stageDifficulty,
} from './shared/champions.js';
import * as A from './shared/arcade.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TICKS = (s) => Math.round(s / C.TICK);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// ═══ 1. THE ROSTER ══════════════════════════════════════════════════════════
{
  ok('there are exactly 45 champions', CHAMPIONS.length === 45 && CHAMPION_COUNT === 45, `${CHAMPIONS.length}`);
  ok('there are exactly 45 arcade stages', ARCADE_STAGES.length === 45, `${ARCADE_STAGES.length}`);
  ok('and exactly 45 rows in the approved map', HS_MAP.length === 45);
  const ids = new Set(CHAMPIONS.map((c) => c.id));
  ok('champion ids are unique', ids.size === 45);
  ok('champion titles are unique', new Set(CHAMPIONS.map((c) => c.title)).size === 45);
  ok('every champion has its own power', new Set(CHAMPIONS.map((c) => c.power)).size === 45);
  for (const [i, s] of ARCADE_STAGES.entries()) {
    const c = CHAMPIONS.find((x) => x.id === s.champion);
    ok(`stage ${i + 1} is numbered in order`, s.stage === i + 1);
    ok(`stage ${s.stage} references a real champion`, !!c && c.stage === s.stage, s.champion);
    ok(`stage ${s.stage} is legendary card ${s.stage}`, c && c.card.rarity === 'legendary' && c.card.number === s.stage);
    ok(`champion ${s.stage} has its HS shot`, c && !!c.hs && !!FAMILIES[c.hs.family], c?.power);
    ok(`champion ${s.stage} resolves from its card`, championFor({ rarity: 'legendary', number: s.stage }) === c);
    ok(`champion ${s.stage} has a title and a tier`, c && c.title.length > 1 && c.tier >= 0 && c.tier < TIERS.length);
  }
  ok('a card that is not legendary is not a champion', championFor({ rarity: 'epic', number: 3 }) === null);
  // Deterministic: the order is a pure function of the data, identical on every load.
  const again = await import('./shared/champions.js?again');
  ok('stage order is deterministic across loads',
     JSON.stringify(again.ARCADE_STAGES) === JSON.stringify(ARCADE_STAGES) &&
     JSON.stringify(again.CHAMPIONS.map((c) => c.power)) === JSON.stringify(CHAMPIONS.map((c) => c.power)));
  ok('the map order is the champion order', CHAMPIONS.every((c, i) => c.power === HS_MAP[i].power.id));
  // The featured cards keep the theme their art already is — and the family that theme maps to.
  ok('the grill card still throws fire', championForStage(3).power === 'blaze' && championForStage(3).hs.ailment === 'burn');
  ok('the tentacle card still grabs you', championForStage(2).power === 'tentacles' && championForStage(2).hs.family === 'grab');
  ok('the coin card still rains coins', championForStage(6).power === 'coins');
  ok('the red-wave card still rides a wave', championForStage(9).power === 'wave');
  ok('the strike card still strikes', championForStage(18).power === 'strike');
}

const IDLE = {};
const FOE_CARD = { rarity: 'epic', number: 1 };            // not a champion: nothing of its own

// ═══ 2. EVERY CHAMPION IS A HEAD SOCCER POWER SHOT ══════════════════════════
// The approved map (docs/HS-CHAMPION-MAP.md → shared/hs-champion-map.js): each champion is a
// family, an ailment, an aura, five 1–10 stats and a star rating — and nothing else.
{
  for (const c of CHAMPIONS) {
    const h = c.hs, row = HS_MAP[c.stage - 1];
    ok(`champion ${c.stage} maps to a valid family`, FAMILY_ORDER.includes(h.family) && !!FAMILIES[h.family], h.family);
    ok(`champion ${c.stage}: ailment and aura are real`, (h.ailment === null || AILMENT_ORDER.includes(h.ailment)) && AURA_ORDER.includes(h.aura));
    ok(`champion ${c.stage}: exactly the approved row`, row.stage === c.stage && row.family === h.family && row.ailment === h.ailment &&
       row.aura === h.aura && row.auraRadius === h.auraRadius && row.intensity === h.intensity && row.stars === h.stars);
    ok(`champion ${c.stage}: five 1–10 stats`, ['speed', 'jump', 'kick', 'dash', 'power'].every((k) => Number.isInteger(h.stats[k]) && h.stats[k] >= 1 && h.stats[k] <= 10));
    ok(`champion ${c.stage}: a Hebrew description of its shot`, /[֐-׿]/.test(c.desc) && c.desc.includes(FAMILIES[h.family].name));
    // …and the card fires exactly that shot in an arcade match.
    const m = createMatch({ rarity: 'legendary', number: c.stage }, FOE_CARD, { champions: true });
    const s = m.players[0].shot;
    ok(`champion ${c.stage}: its card fires its mapped shot in the arcade`, s.family === h.family && s.ailment === h.ailment && s.aura === h.aura &&
       s.intensity === h.intensity && s.gentle === !!h.gentle);
  }
  const fams = new Set(CHAMPIONS.map((c) => c.hs.family));
  ok('all eleven families are in the campaign', FAMILY_ORDER.every((f) => fams.has(f)), [...fams].join(','));
  ok('the gentle Grab and Multi-Ball are stages 2 and 6 (Idan\'s decision 1)', CHAMPIONS.filter((c) => c.hs.gentle).map((c) => c.stage).join() === '2,6');
  ok('the stat total climbs from 12 to 45', (() => { const t = (c) => Object.values(c.hs.stats).reduce((a, b) => a + b, 0); return t(CHAMPIONS[0]) === 12 && t(CHAMPIONS[44]) === 45; })());
}

// ═══ 3. EVERY CHAMPION'S SHOT, FIRED, FLIES ITS FAMILY — FOR EITHER SEAT ══════

// The champion for `stage` in seat `i` fires off its head; the opponent stands `gap` px away.
function fireChampion(stage, i, gap = 460) {
  const cards = [];
  cards[i] = { rarity: 'legendary', number: stage };
  cards[1 - i] = FOE_CARD;
  const m = createMatch(cards[0], cards[1], { champions: true, duration: 600 });
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.gaugeLead = 0;
  const p = m.players[i], q = m.players[1 - i];
  const X = (x) => (i === 0 ? x : C.W - x);
  p.x = X(300); q.x = X(300 + gap);
  const log = [];
  p.gauge = 1; p.prev = {};
  const press = [IDLE, IDLE]; press[i] = { power: true };
  step(m, press); log.push(...m.events); m.events.length = 0;
  m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
  step(m, [IDLE, IDLE]); log.push(...m.events); m.events.length = 0;
  return { m, p, q, log };
}
{
  const fleeing = new Set();
  for (const c of CHAMPIONS) {
    for (const seat of [0, 1]) {
      const { m, p, q, log } = fireChampion(c.stage, seat);
      const shot = log.find((e) => e.type === 'powershot' && e.player === seat);
      ok(`stage ${c.stage} (seat ${seat}): fires its ${c.hs.family} shot`, shot && shot.fam === c.hs.family && shot.champ === c.id && m.ball.power && m.ball.power.fam === c.hs.family);
      ok(`stage ${c.stage} (seat ${seat}): toward the other goal, with the cut-in`, m.ball.power && m.ball.power.dir === p.side && m.cutinBy === seat);
      // The aura's press: a close opponent gets it, a far one does not (both ways measured in test-ultimate).
      const au = log.find((e) => e.type === 'aura');
      ok(`stage ${c.stage} (seat ${seat}): an aura exactly when the map has one`, c.hs.aura === 'none' ? !au : !!au && au.aura === c.hs.aura && au.r === c.hs.auraRadius);
      // Play it out: the shot reaches the other player (or the net), and the numbers stay numbers.
      let met = null, bad = false;
      for (let k = 0; k < 60 * 4 && m.phase === 'play' && !met; k++) {
        step(m, [IDLE, IDLE]);
        met = m.events.find((e) => ['powerHit', 'grabbed', 'blocked', 'goal'].includes(e.type)) || null;
        if (![m.ball.x, m.ball.y, m.ball.vx, m.ball.vy, q.x, q.y].every(Number.isFinite)) bad = true;
        m.events.length = 0;
      }
      ok(`stage ${c.stage} (seat ${seat}): the shot reaches the other player or the net`, !!met || m.phase !== 'play', 'never arrived');
      ok(`stage ${c.stage} (seat ${seat}): everything stays finite`, !bad);
      if (met && met.type === 'powerHit' && c.hs.ailment && q.ail !== c.hs.ailment && q.ail !== 'stars') fleeing.add(c.stage);
    }
  }
  ok('a champion\'s ailment lands on the player its shot hits', fleeing.size === 0, [...fleeing].join(','));
}

// Champion powers that were not shots are gone (Idan's decision 2): no effect records, no
// per-champion mods, no field — an arcade match carries only the HS state.
{
  const m = createMatch({ rarity: 'legendary', number: 45 }, { rarity: 'legendary', number: 1 }, { champions: true });
  ok('no champion effects, mods or field survive', !m.champ.effects && !m.champ.field && m.players.every((p) => p.mods === undefined));
  ok('a champion plays on its HS stats; the player on equal ones', (() => {
    const cfg = stageConfig(45);
    const g = createMatch({ rarity: 'epic', number: 3 }, cfg.champ.card, cfg.matchOpts);
    return g.players[0].stats.speed === 1 && g.players[1].stats.speed > 1.05 && g.players[1].meterRate > 1;
  })());
}

// ═══ 4. THE BOTS USE THEIR OWN POWERS ═══════════════════════════════════════
{
  for (const champ of CHAMPIONS) {
    for (const seat of [0, 1]) {
      const rng = mulberry32(champ.stage * 7 + seat);
      const cards = [];
      cards[seat] = champ.card;
      cards[1 - seat] = { rarity: 'legendary', number: champ.stage === 1 ? 2 : 1 };
      const m = createMatch(cards[0], cards[1], { champions: true });
      const bots = [];
      bots[seat] = createBot(0, rng, botProfile(champ));
      bots[1 - seat] = createBot(2, rng);
      let fired = null, t = 0;
      for (let k = 0; k < TICKS(40) && !fired && m.phase !== 'over'; k++) {
        const me = m.players[seat];
        // Hand it a meter once play is under way, as five tackles would.
        if (m.phase === 'play' && me.armed <= 0 && me.gauge < 1 && m.t > 3) me.gauge = 1;
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        fired = m.events.find((e) => e.type === 'powershot' && e.player === seat) || null;
        m.events.length = 0;
        t = m.t;
      }
      ok(`bot ${champ.stage} (${champ.hs.family}, seat ${seat}) arms and fires its own shot`,
         !!fired && fired.champ === champ.id && fired.fam === champ.hs.family, fired ? `${fired.fam} at ${t.toFixed(1)}s` : 'never fired');
    }
  }
}

// ═══ 5. EVERY CHAMPION, A WHOLE MATCH, NOTHING BREAKS ═══════════════════════
//
// Full arcade matches, the champion's own bot against a player-side bot on another champion,
// with both meters topped up every few seconds so powers overlap and collide as often as they
// possibly can. Every number in the state has to stay a number, and the match has to end.
{
  const numbersIn = (m) => {
    const bad = [];
    const scan = (o, path) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path + k);
        else if (v && typeof v === 'object' && k !== 'shot' && k !== 'char' && k !== 'champ' && k !== 'stats') scan(v, path + k + '.');
      }
    };
    scan({ ball: m.ball, players: m.players, extra: m.xballs }, '');
    return bad;
  };
  let powers = 0;
  for (const champ of CHAMPIONS) {
    const cfg = stageConfig(champ.stage);
    const rng = mulberry32(1000 + champ.stage);
    const opp = CHAMPIONS[(champ.stage + 21) % 45];
    const m = createMatch(opp.card, champ.card, { ...cfg.matchOpts });
    const bots = [createBot(0, rng, botProfile(opp)), createBot(0, rng, cfg.bot)];
    let bad = [], ticks = 0;
    while (m.phase !== 'over' && ticks < TICKS(C.MATCH_DURATION + 120)) {
      if (ticks % TICKS(7) === 0) for (const p of m.players) if (p.armed <= 0) p.gauge = 1;
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      powers += m.events.filter((e) => e.type === 'powershot').length;
      m.events.length = 0;
      ticks++;
      if (ticks % 30 === 0 && !bad.length) bad = numbersIn(m);
    }
    ok(`stage ${champ.stage}: a full match stays finite`, bad.length === 0, bad.slice(0, 4).join(', '));
    ok(`stage ${champ.stage}: the match reaches full time`, m.phase === 'over', `${m.phase} after ${ticks} ticks`);
    ok(`stage ${champ.stage}: and has a winner`, m.score[0] !== m.score[1], m.score.join('-'));
  }
  ok('powers were really used across those matches', powers > 45 * 3, `${powers} champion powers fired`);
}

// ═══ 6. THE DIFFICULTY LADDER ═══════════════════════════════════════════════
{
  const D = CHAMPIONS.map((c) => c.difficulty);
  for (const [i, d] of D.entries()) {
    const n = i + 1;
    ok(`stage ${n}: difficulty is all numbers`, ['react', 'error', 'counter', 'aim', 'powerHold', 'stars'].every((k) => finite(d[k])));
    ok(`stage ${n}: in range`, d.react > 0 && d.react <= 0.34 && d.error >= 0 && d.aim > 0 && d.aim < 1 &&
       d.counter >= 0 && d.counter < 1 && d.powerHold > 0 && d.stars >= 1 && d.stars <= 5);
    const bp = botProfile(CHAMPIONS[i]);
    ok(`stage ${n}: bot profile is complete`, ['react', 'error', 'counter', 'aggression', 'aim', 'powerHold', 'tackle'].every((k) => finite(bp[k])) && typeof bp.arm === 'string');
    if (i > 0) {
      const p = D[i - 1];
      ok(`stage ${n}: at least as hard as stage ${n - 1}`,
         d.react < p.react && d.error < p.error && d.aim > p.aim && d.counter > p.counter && d.powerHold < p.powerHold && d.stars >= p.stars);
    }
  }
  const first = D[0], last = D[44];
  ok('stage 1 is the bot\'s easiest tier', first.react === DIFFICULTIES[0].react && first.aim === DIFFICULTIES[0].aim && first.error === DIFFICULTIES[0].error);
  ok('stage 45 is short of its hardest (beatable)', last.react > DIFFICULTIES[5].react && last.aim < DIFFICULTIES[5].aim);
  ok('no step between stages is a spike', D.every((d, i) => i === 0 || (D[i - 1].aim - d.aim) > -0.02));
  ok('the campaign starts at one star and ends at five', first.stars === 1 && last.stars === 5);

  // …and the ladder is real on the pitch. Each stage's champion, exactly as the arcade builds
  // it (bot, HS stats, gauge rate), against one fixed opponent standing in for the player: the
  // tier-3 bot on legendary 3. Bot against bot is noisy — one stage over a handful of matches is
  // mostly coin — so what is asserted is the first tier against the last, and the first and last
  // stage against each other, over fixed seeds.
  //
  // EACH CHAMPION FIRES ITS OWN FAMILY. For a while both sides fired the same plain comet here,
  // because the bot defended a straight shot with a timed kick but had no answer to a Ground
  // (unblockable), an Aerial or a Downward shot (from above), so the family mix of a tier swamped
  // its dials. The Phase E bot defends every family generically — it runs the power ball's own
  // flight forward (hs-powers stepPower) to find where it crosses a body's height, kicks into
  // anything a boot can stop (FAMILIES[fam].block), arms itself when an armed opponent's shot
  // could only be countered, and denies the touch otherwise — so the real families are back.
  // Measured (_ladder.mjs, 30 a stage): tier 1 −1.3, tier 2 −0.2, tier 3 −0.3, tier 4 +0.6,
  // tier 5 +1.3 goals a match against the reference bot.
  const vsRef = (stage, n) => {
    const cfg = stageConfig(stage);
    let gd = 0;
    for (let s = 0; s < n; s++) {
      const rng = mulberry32(900 + s * 13);
      const m = createMatch({ rarity: 'legendary', number: 3 }, cfg.champ.card, { ...cfg.matchOpts });
      const bots = [createBot(3, rng), createBot(0, rng, cfg.bot)];
      for (let k = 0; k < TICKS(200) && m.phase !== 'over'; k++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        m.events.length = 0;
      }
      gd += m.score[1] - m.score[0];
    }
    return gd / n;
  };
  const tier = (t) => { let g = 0; for (let n = t * 9 + 1; n <= t * 9 + 9; n++) g += vsRef(n, 20); return g / 9; };
  const t1 = tier(0), t5 = tier(4);
  console.log(`  (info) champion vs the tier-3 bot, goal difference a match: tier 1 ${t1.toFixed(2)}, tier 5 ${t5.toFixed(2)}`);
  ok('the last tier of champions plays harder than the first', t5 > t1 + 1.5, `champion goal difference a match: tier 1 ${t1.toFixed(2)}, tier 5 ${t5.toFixed(2)}`);
  let hi = 0, lo = 0;
  for (let s = 0; s < 16; s++) {
    for (const flip of [false, true]) {
      const rng = mulberry32(500 + s);
      const [A, B] = [stageConfig(45), stageConfig(1)];
      const cards = flip ? [B.champ.card, A.champ.card] : [A.champ.card, B.champ.card];
      const stats = flip ? [B.champ.hs.stats, A.champ.hs.stats] : [A.champ.hs.stats, B.champ.hs.stats];
      const m = createMatch(cards[0], cards[1], { champions: true, stats });
      const strong = createBot(0, rng, A.bot), weak = createBot(0, rng, B.bot);
      const bots = flip ? [weak, strong] : [strong, weak];
      for (let k = 0; k < TICKS(200) && m.phase !== 'over'; k++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        m.events.length = 0;
      }
      hi += flip ? m.score[1] : m.score[0];
      lo += flip ? m.score[0] : m.score[1];
    }
  }
  // Was `hi > lo * 1.2`, measured when the gauge was earned by tackling; under Head Soccer's
  // clock fill it narrowed to 55 : 51 and was loosened to `hi > lo` until the bot could be tuned
  // on HS movement. With the Phase E bot and every champion on its own family it is 174 : 50 over
  // these 32 matches, so the margin is back, and doubled.
  console.log(`  (info) stage 45 vs stage 1 head to head ${hi} : ${lo} over 32 matches`);
  ok('stage 45\'s champion beats stage 1\'s head to head, by 2 to 1', hi > 2 * lo, `${hi} : ${lo} over 32 matches`);
}

// ═══ 7. PROGRESS ════════════════════════════════════════════════════════════
{
  const store = () => { const d = new Map(); return { getItem: (k) => (d.has(k) ? d.get(k) : null), setItem: (k, v) => d.set(k, String(v)), d }; };
  let prog = A.freshProgress();
  ok('a new campaign: stage 1 is available', A.stageStatus(prog, 1) === 'available');
  ok('a new campaign: stages 2-45 are locked', Array.from({ length: 44 }, (_, i) => A.stageStatus(prog, i + 2)).every((s) => s === 'locked'));
  ok('only stage 1 can be started', A.canStart(prog, 1) && Array.from({ length: 44 }, (_, i) => A.canStart(prog, i + 2)).every((x) => !x));
  ok('nonsense stages are locked', !A.canStart(prog, 0) && !A.canStart(prog, 46) && !A.canStart(prog, 1.5));

  const locked = A.recordResult(prog, 3, true);
  ok('a locked stage cannot be played — its result is refused', !locked.accepted && locked.prog === prog && locked.prog.cleared === 0);

  const lost = A.recordResult(prog, 1, false);
  ok('losing does not unlock the next stage', lost.accepted && lost.prog.cleared === 0 && A.stageStatus(lost.prog, 2) === 'locked' && lost.unlocked === null);
  ok('losing leaves the stage to retry', A.canStart(lost.prog, 1) && A.stageStatus(lost.prog, 1) === 'available');
  ok('a loss is recorded', lost.prog.record[1].l === 1 && lost.prog.record[1].w === 0);
  ok('the input progress is not mutated', prog.cleared === 0 && !prog.record[1]);

  const won = A.recordResult(lost.prog, 1, true);
  ok('winning unlocks the next stage', won.unlocked === 2 && A.stageStatus(won.prog, 2) === 'available');
  ok('…and only the next stage', A.stageStatus(won.prog, 3) === 'locked' && won.prog.cleared === 1);
  ok('the won stage is completed', A.stageStatus(won.prog, 1) === 'completed' && won.firstClear);

  prog = won.prog;
  for (let n = 2; n <= 10; n++) prog = A.recordResult(prog, n, true).prog;
  const replayLose = A.recordResult(prog, 4, false);
  ok('replaying a completed stage and losing keeps it completed', A.stageStatus(replayLose.prog, 4) === 'completed' && replayLose.prog.cleared === 10);
  const replayWin = A.recordResult(prog, 4, true);
  ok('replaying a completed stage and winning unlocks nothing new', replayWin.unlocked === null && replayWin.prog.cleared === 10);
  ok('stages already beaten do not need replaying', A.currentStage(prog) === 11 && A.canStart(prog, 11));

  const s = store();
  A.saveProgress(s, prog);
  const back = A.loadProgress(s);
  ok('progress survives a reload', back.cleared === 10 && A.stageStatus(back, 10) === 'completed' && A.stageStatus(back, 11) === 'available' && A.stageStatus(back, 12) === 'locked');
  ok('the record survives a reload', back.record[1].l === 1 && back.record[1].w === 1);
  ok('it lives under its own key', [...s.d.keys()].join() === A.ARCADE_KEY && A.ARCADE_KEY === 'hs.arcade.v1');

  ok('an empty device starts fresh', A.loadProgress(store()).cleared === 0);
  const junk = store(); junk.setItem(A.ARCADE_KEY, '{not json');
  ok('a corrupt save starts fresh instead of throwing', A.loadProgress(junk).cleared === 0);
  const liar = store(); liar.setItem(A.ARCADE_KEY, JSON.stringify({ v: 1, cleared: 999, record: { 1: { w: -4 }, 99: { w: 1 }, x: 3 } }));
  const lp = A.loadProgress(liar);
  ok('an impossible save is clamped, not trusted', lp.cleared === 45 && !lp.record[1] && !lp.record[99]);
  const wrongV = store(); wrongV.setItem(A.ARCADE_KEY, JSON.stringify({ v: 7, cleared: 30 }));
  ok('an unknown save version is not guessed at', A.loadProgress(wrongV).cleared === 0);
  ok('a storage that throws starts fresh', A.loadProgress({ getItem() { throw new Error('denied'); } }).cleared === 0);
  ok('and saving to one reports failure rather than throwing', A.saveProgress({ setItem() { throw new Error('full'); } }, prog) === false);
  // Keys the game already writes are not touched by the arcade.
  const shared = store(); shared.setItem('hs.mode.v1', 'duo'); shared.setItem('hs-binds', '{"x":1}');
  A.saveProgress(shared, prog);
  ok('existing saved settings are left exactly as they were', shared.getItem('hs.mode.v1') === 'duo' && shared.getItem('hs-binds') === '{"x":1}');

  let all = A.freshProgress();
  for (let n = 1; n <= 45; n++) {
    const r = A.recordResult(all, n, true);
    if (n === 45) ok('the final stage completes the campaign', r.complete && r.unlocked === null && A.campaignComplete(r.prog));
    all = r.prog;
  }
  ok('a finished campaign opens on the last stage', A.currentStage(all) === 45 && A.stageStatus(all, 45) === 'completed');
}

// ═══ 8. MULTIPLAYER IS UNTOUCHED ════════════════════════════════════════════
//
// The digest below was recorded from this exact script BEFORE the arcade existed — before any
// champion seam went into sim.js or bot.js. It covers every serialized field and every event of
// three whole bot-vs-bot matches, legendary and not, which is what the server runs for a room
// (createMatch(a.card, b.card, {})). If it moves, something outside the arcade changed.
{
  // RE-RECORDED once, deliberately, for the Head Soccer parity pass (hs-parity, Phase C1): the
  // hidden health (`hp` left the snapshot), tackle/concede gauge fill (the gauge is a clock now)
  // and push-away-from-the-tackler (a tackle now shoves toward the victim's own goal) were all
  // removed from the NON-arcade sim, so this digest had to move. Nothing arcade-only did.
  //
  // RE-RECORDED again for the HS movement/timing pass (hs/fit-movement, Phase C 5/6/10/11): the
  // PACE layer is gone and every movement, gravity, geometry and restart number is Head Soccer's
  // measured one, the cut-in freezes the sim, and a blocked shot dazes — all non-arcade changes,
  // so the digest had to move. The arcade's own powers were touched only where they read a
  // removed constant (FALL_MULT, and CEIL_Y for effects, now SKY_Y).
  //
  // AND AGAIN for "the game feels a little bit stuck" (hs/fix-stuck): no hit-stop on a kick,
  // header or tackle (HS has none), and the bot holds a full gauge before arming it (FULL_HOLD
  // in bot.js) instead of arming the tick it fills. Both non-arcade; no arcade power changed.
  //
  // AND AGAIN for "the power doesn't reset the bar" (hs/gauge-reset-on-press): the POWER press
  // empties the gauge and the refill starts there (HS M4 36.49 s), the fill is 1/15 of PLAY time
  // with no head start, and it stops through a goal's restart. A gauge change, so every bot's
  // arming moves; no arcade power changed.
  // AND AGAIN for the contact bodies (hs/contact-bodies, Phase C2/C3): the passive head touch is
  // a springy bounce (HEAD_BOUNCE) instead of a dead cushion, players are solid to each other
  // (head + body against head + body, standing on heads; `stand` joined the snapshot), and the
  // bot only jumps into a ball on the goal side of its head. All non-arcade.
  // AND the merge of both (plus the boot firing an armed ultimate, as HS's does): re-recorded.
  //
  // AND for the HS power-shot pass (hs/power-shots): every card now fires its Head Soccer family
  // at the filmed comet's speed, a kick blocks and a stand gets you hit, the cut-in's dark
  // outlasts its hold, and online stats are EQUAL — all non-arcade changes by design.
  // AND AGAIN for the kick knockout (hs/kick-stun): every 5th boot on a player hurts, the 3rd
  // hurt knocks him out for 2 s (`kicked`, `hurt` joined the snapshot); a standing victim slides
  // instead of being lifted, and TACKLE_IMMUNE is 0.3 s. All non-arcade; no arcade power changed.
  // AND the merge of the two (power shots + kick knockout): re-recorded on the combined sim.
  // AND AGAIN for the Phase E bot (hs/bot-like-hs): the bot is rebuilt to play like the HS CPU
  // (meets the ball, mashes the boot, dashes, defends every power family) — a bot change, which
  // is what these three bot-vs-bot matches are made of. The sim itself did not change.
  const GOLDEN = '7a2b4f57149267e6da326a7b02e10872b6f46478eb34cb35dde79194534feac3';
  const h = createHash('sha256');
  const cases = [
    [{ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, 3, 3, 11],
    [{ rarity: 'legendary', number: 45 }, { rarity: 'legendary', number: 1 }, 5, 0, 7],
    [{ rarity: 'epic', number: 7 }, { rarity: 'common', number: 30 }, 1, 4, 99],
  ];
  for (const [a, b, la, lb, seed] of cases) {
    const rng = mulberry32(seed);
    const m = createMatch(a, b, {});
    const bots = [createBot(la, rng), createBot(lb, rng)];
    for (let t = 0; t < 60 * 90 && m.phase !== 'over'; t++) {
      step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
      h.update(JSON.stringify(serialize(m)));
      h.update(JSON.stringify(m.events));
      m.events.length = 0;
    }
    h.update(JSON.stringify(m.score));
  }
  const digest = h.digest('hex');
  ok('the non-arcade sim is bit-for-bit what it was before the arcade', digest === GOLDEN, digest);

  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  ok('a match without the arcade flag has no champions', m.champ === undefined && m.players.every((p) => p.champ === undefined && p.mods === undefined));
  ok('and every head is the constant size', m.players.every((p) => headR(m, p) === C.HEAD_R));
  ok('online, every card plays on EQUAL stats (HS\'s online rule)', m.players.every((p) => p.stats.speed === 1 && p.stats.jump === 1 && p.stats.kick === 1));
  ok('a legendary card online fires its family at the middle intensity, never gentle', (() => {
    const p = m.players[0]; m.phase = 'play'; m.freeze = 0;
    p.gauge = 1; p.armed = 1; m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = m.ball.vy = 0;
    step(m, [IDLE, IDLE]);
    return m.ball.power && m.ball.power.fam === 'straight' && m.ball.power.int === 0.5 && !m.ball.power.gentle &&
      createMatch({ rarity: 'legendary', number: 2 }, { rarity: 'epic', number: 1 }, {}).players[0].shot.gentle === false;
  })());
  // The HS restart and cut-in state joined the snapshot in one pass (cutin … gaugeLead, landT),
  // `stand` (whose head holds this player up) with the contact bodies, and the HS power shots
  // added the ailment to each player (ail, ailT) and the Multi-Ball's extra balls (xb): every one
  // of them decides what a future tick does. `kicked` and `hurt` (the kick
  // knockout's count and the bruise) joined with hs/kick-stun.
  ok('the snapshot schema is the HS one', JSON.stringify(Object.keys(serialize(m))) === JSON.stringify(['t', 'clock', 'phase', 'freeze', 'hitStop', 'idle', 'cutin', 'cutinBy', 'banner', 'bannerT', 'ballWait', 'gaugeLead', 'score', 'golden', 'lastScorer', 'p', 'b', 'xb']) &&
     serialize(m).p[0].length === 30);
  ok('an ordinary bot is still exactly its tier', createBot(3).d === DIFFICULTIES[3]);
}

console.log(`test-arcade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
