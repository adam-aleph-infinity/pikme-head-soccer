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
  stageConfig, stageDifficulty, FIVE_STAR,
} from './shared/champions.js';
import * as A from './shared/arcade.js';
import { CHAMPION_POWERS, BUILT_STAGES, difficultyScore } from './shared/champion-powers.js';
import { readFileSync } from 'node:fs';

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

// What a champion fires in the arcade: its own HS character's power once that stage is built
// (shared/champion-powers.js), else its family from the approved map.
const famOf = (c) => (c.cp ? c.cp.family : c.hs.family);
const ailOf = (c) => (c.cp ? c.cp.ailment : c.hs.ailment);
const auraOf = (c) => (c.cp ? 'none' : c.hs.aura);

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
    ok(`champion ${c.stage}: a Hebrew description of its shot`, /[֐-׿]/.test(c.desc) && (c.cp ? c.desc === c.cp.desc : c.desc.includes(FAMILIES[h.family].name)));
    // …and the card fires exactly that shot in an arcade match: its own power once built.
    const m = createMatch({ rarity: 'legendary', number: c.stage }, FOE_CARD, { champions: true });
    const s = m.players[0].shot;
    if (c.cp) ok(`champion ${c.stage}: its card fires its own HS power (${c.cp.hs}) in the arcade`, s.cp === c.cp.id && s.family === c.cp.family && s.ailment === c.cp.ailment && s.aura === 'none');
    else ok(`champion ${c.stage}: its card fires its mapped shot in the arcade`, s.family === h.family && s.ailment === h.ailment && s.aura === h.aura &&
       s.intensity === h.intensity && s.gentle === !!h.gentle);
  }
  const fams = new Set(CHAMPIONS.map((c) => c.hs.family));
  ok('all eleven families are in the campaign', FAMILY_ORDER.every((f) => fams.has(f)), [...fams].join(','));
  ok('the gentle Grab and Multi-Ball are stages 2 and 6 (Idan\'s decision 1)', CHAMPIONS.filter((c) => c.hs.gentle).map((c) => c.stage).join() === '2,6');
  // The arcade's stats (Idan, 2026-10-05): champions 1–10 climb a little every stage, every stat
  // from level 1 at the first to the five-star body at the tenth, none ever stepping down (it was
  // HS's 0.5–2.5★ held on level 1, then a leap from 3 to 7 at stage 10). A five-star one (Idan, 2026-10-04: HS's are "fully upgraded", so +2 over the
  // player's equal stats) runs, jumps, kicks and dashes on levels 7–8; its power bar stays on 5–6,
  // the player's own fill.
  const BODY = ['speed', 'jump', 'kick', 'dash'], ALL = [...BODY, 'power'];
  ok('the first champion is on level 1 throughout', ALL.every((k) => CHAMPIONS[0].hs.stats[k] === 1));
  ok('champions 1–10: the total climbs every stage and no stat ever steps down', CHAMPIONS.slice(1, 10).every((c, i) => {
    const prev = CHAMPIONS[i].hs.stats, cur = c.hs.stats;
    return ALL.every((k) => cur[k] >= prev[k]) && ALL.reduce((a, k) => a + cur[k] - prev[k], 0) >= 2;
  }));
  ok('every five-star champion runs, jumps, kicks and dashes on levels 7–8, its power bar on 5–6', CHAMPIONS.filter((c) => c.hs.stars === 5).every((c) => BODY.every((k) => c.hs.stats[k] >= 7 && c.hs.stats[k] <= 8) && c.hs.stats.power >= 5 && c.hs.stats.power <= 6));
  ok('the body stats\' base level never steps down along the ladder', CHAMPIONS.every((c, i) => i === 0 || Math.min(...BODY.map((k) => c.hs.stats[k])) >= Math.min(...BODY.map((k) => CHAMPIONS[i - 1].hs.stats[k]))));
  ok('the stars are HS\'s: half a star a stage to five at stage 10, five after', CHAMPIONS.every((c) => c.hs.stars === Math.min(5, c.stage / 2)));
}

// ═══ 2b. THE CHAMPIONS' OWN POWERS (shared/champion-powers.js) ═══════════════
// Each built stage fires one real Head Soccer character's power — the character the spec gives it
// (docs/hs-45-powers.json) — and the ladder of powers never steps down: stage n+1's is at least as
// hard to stop as stage n's, by our own behaviour score and by the spec's.
{
  const spec = JSON.parse(readFileSync(new URL('./docs/hs-45-powers.json', import.meta.url), 'utf8'));
  // (built in batches, in parallel: 1–5 and 6–10 can land in either order, so a gap is allowed)
  ok('the built stages are real stages, in order', BUILT_STAGES.length >= 1 && BUILT_STAGES.every((n, i) => n >= 1 && n <= 45 && (i === 0 || n > BUILT_STAGES[i - 1])), BUILT_STAGES.join(','));
  const ids = new Set();
  for (const n of BUILT_STAGES) {
    const d = CHAMPION_POWERS[n], row = spec[n - 1], c = championForStage(n);
    ok(`power ${n}: is the spec's HS character (${row.hsCharacter} — ${row.powerName})`, d.stage === n && d.hs === row.hsCharacter && d.hsPower === row.powerName && d.hsStars === row.stars);
    ok(`power ${n}: flies a real engine family, carries a real ailment`, FAMILY_ORDER.includes(d.family) && (d.ailment === null || AILMENT_ORDER.includes(d.ailment)));
    ok(`power ${n}: its own id`, !ids.has(d.id)); ids.add(d.id);
    ok(`power ${n}: the board says it in short Hebrew`, /[֐-׿]/.test(d.name) && /[֐-׿]/.test(d.desc) && d.desc.length <= 90 && c.powerName === d.name && c.desc === d.desc, `${d.desc.length} chars`);
    ok(`power ${n}: cites the HS wiki`, d.sources.some((u) => u === row.sources.P));
    ok(`power ${n}: has its renderer (public/vfx/powers/stage-${String(n).padStart(2, '0')}.js)`, (() => { try { return readFileSync(new URL(`./public/vfx/powers/stage-${String(n).padStart(2, '0')}.js`, import.meta.url), 'utf8').includes(`id: '${d.id}'`); } catch { return false; } })());
    const lo = BUILT_STAGES.filter((k) => k < n).pop();            // the nearest built stage below
    if (lo) {
      const a = CHAMPION_POWERS[lo];
      ok(`power ${n} is at least as hard to stop as power ${lo} (behaviour score)`, difficultyScore(d) >= difficultyScore(a), `${difficultyScore(a).toFixed(2)} → ${difficultyScore(d).toFixed(2)}`);
      ok(`power ${n} is at least as hard as power ${lo} (spec score, stars first)`, row.score.total >= spec[lo - 1].score.total && d.hsStars >= a.hsStars);
    }
    // Only the arcade: online and free play the card keeps its map family.
    const free = createMatch({ rarity: 'legendary', number: n }, FOE_CARD, {});
    ok(`power ${n}: not outside the arcade (free play keeps the map family)`, !free.players[0].shot.cp && free.players[0].shot.family === HS_MAP[n - 1].family);
  }
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
  // (`gap` from where the ball leaves: POWER_RELEASE_AT head radii in front of the shooter)
  p.x = X(300); q.x = X(300 + C.POWER_RELEASE_AT * C.HEAD_R + gap);
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
      ok(`stage ${c.stage} (seat ${seat}): fires its ${c.cp ? c.cp.id : c.hs.family} shot`, shot && shot.fam === famOf(c) && shot.champ === c.id && m.ball.power && m.ball.power.fam === famOf(c) &&
         (m.ball.power.cp || null) === (c.cp ? c.cp.id : null));
      ok(`stage ${c.stage} (seat ${seat}): toward the other goal, with the cut-in`, m.ball.power && m.ball.power.dir === p.side && m.cutinBy === seat);
      // The aura's press: a close opponent gets it, a far one does not (both ways measured in test-ultimate).
      const au = log.find((e) => e.type === 'aura');
      ok(`stage ${c.stage} (seat ${seat}): an aura exactly when the map has one`, auraOf(c) === 'none' ? !au : !!au && au.aura === c.hs.aura && au.r === c.hs.auraRadius);
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
      if (met && met.type === 'powerHit' && ailOf(c) && q.ail !== ailOf(c) && q.ail !== 'stars') fleeing.add(c.stage);
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
    const cfg = stageConfig(1);
    const g = createMatch({ rarity: 'epic', number: 3 }, cfg.champ.card, cfg.matchOpts);
    return g.players[0].stats.speed === 1 && g.players[1].stats.speed < 0.8 && g.players[1].stats.kick < 0.7 && g.players[1].meterRate < 1;
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
      ok(`bot ${champ.stage} (${champ.cp ? champ.cp.id : champ.hs.family}, seat ${seat}) arms and fires its own shot`,
         !!fired && fired.champ === champ.id && fired.fam === famOf(champ) && (fired.cp || null) === (champ.cp ? champ.cp.id : null), fired ? `${fired.fam} at ${t.toFixed(1)}s` : 'never fired');
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
       d.counter >= 0 && d.counter < 1 && d.powerHold > 0 && d.stars >= 0.5 && d.stars <= 5);
    const bp = botProfile(CHAMPIONS[i]);
    ok(`stage ${n}: bot profile is complete`, ['react', 'error', 'counter', 'aggression', 'aim', 'powerHold', 'tackle'].every((k) => finite(bp[k])) && typeof bp.arm === 'string');
    // Stars are only how smart it plays (Idan): smarter every stage up to five stars at stage
    // FIVE_STAR, and from there on every champion plays exactly the same.
    if (i > 0 && n <= FIVE_STAR) {
      const p = D[i - 1];
      ok(`stage ${n}: smarter than stage ${n - 1}`,
         d.react < p.react && d.error < p.error && d.aim > p.aim && d.counter > p.counter && d.powerHold < p.powerHold && d.stars > p.stars);
    }
    // (what a five-star CPU varies is its plan, Offensive or Defensive, and — from the 24th, as HS's
    // Asura on — the counter by kick, tested below; nothing else about how smart it is)
    const brain = (q) => { const r = { ...q, name: '', archetype: '' }; delete r.counterKick; delete r.counterRate; return r; };
    ok(`stage ${n}: ${n >= 24 ? 'kicks the power shot back' : 'never kicks the power shot back'}`, n >= 24
      ? bp.counterKick === true && bp.counterRate >= 0.4 && bp.counterRate <= 0.8 && (n === 24 || bp.counterRate > botProfile(CHAMPIONS[n - 2]).counterRate)
      : !bp.counterKick);
    if (n > FIVE_STAR) ok(`stage ${n}: plays exactly as smart as stage ${FIVE_STAR}`, JSON.stringify(d) === JSON.stringify(D[FIVE_STAR - 1]) && JSON.stringify(brain(bp)) === JSON.stringify(brain(botProfile(CHAMPIONS[FIVE_STAR - 1]))));
    ok(`stage ${n}: ${n >= FIVE_STAR ? 'an Offensive or Defensive five-star plan' : 'no five-star plan yet'}`, n >= FIVE_STAR ? ['offense', 'defense'].includes(bp.archetype) : bp.archetype === undefined);
  }
  const first = D[0], last = D[44];
  ok('stage 1 is the bot\'s easiest tier', first.react === DIFFICULTIES[0].react && first.aim === DIFFICULTIES[0].aim && first.error === DIFFICULTIES[0].error);
  ok('stage 45 is short of its hardest (beatable)', last.react > DIFFICULTIES[5].react && last.aim < DIFFICULTIES[5].aim);
  ok('no step between stages is a spike (an even climb to five stars)', D.every((d, i) => i === 0 || d.aim - D[i - 1].aim <= 0.61 / (FIVE_STAR - 1) + 1e-3));
  ok('the campaign starts at half a star and reaches five at stage 10', first.stars === 0.5 && D[FIVE_STAR - 1].stars === 5 && last.stars === 5);

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
  // Stars are how smart it plays (Idan): the low-star stages (1–3, 0.5–1.5★) against the last tier of
  // five-star ones (37–45) — the tiers' 9-stage averages no longer say it, since 4–4.5★ (stages 8–9)
  // play nearly as smart as five stars and a five-star stage differs from the next only by its power.
  const tier = (t) => { let g = 0; for (let n = t * 9 + 1; n <= t * 9 + 9; n++) g += vsRef(n, 20); return g / 9; };
  const t1 = (vsRef(1, 20) + vsRef(2, 20) + vsRef(3, 20)) / 3, t5 = tier(4);
  console.log(`  (info) champion vs the tier-3 bot, goal difference a match: stages 1–3 ${t1.toFixed(2)}, tier 5 ${t5.toFixed(2)}`);
  // (+1.5 until the power shot always left at head height, which helped the early champions'
  // straight shots most — +1.57 → +1.26; Idan kept that balance, 2026-09-30)
  // (measured 2026-10-03, the CPU body-blocking as in Idan's M7–M11: stages 1–3 −1.13, tier 5 −0.15)
  ok('the last tier of champions plays harder than the first', t5 > t1 + 0.75, `champion goal difference a match: tier 1 ${t1.toFixed(2)}, tier 5 ${t5.toFixed(2)}`);
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
  // (2 to 1 until the head-height release: 185 : 82 → 175 : 102; Idan kept that balance, 2026-09-30;
  // 1.4 since HS's power hit, which throws the victim into his goal: 164 : 114)
  ok('stage 45\'s champion beats stage 1\'s head to head, by 7 to 5', hi > 1.4 * lo, `${hi} : ${lo} over 32 matches`);
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
  // AND the conceder's bonus (+1/3 gauge on the ball drop after a goal, HS M4 43.5 s).
  // AND AGAIN for the power-shot review (hs/power-review): the cut-in's dark no longer lifts early
  // on a hit or a goal and the ball leaves 1.27 s in (POWER_RELEASE 0.23, timed from the touch — docs/HS-POWER-VFX-RESEARCH.md §5);
  // the Grab drags the defender back to the shooter and flings him; Multi-Ball is always three
  // balls; Downward rises at 15°; beheaded takes the controls for a moment. All HS-parity changes.
  // AND for the M5 pass (hs/mechanics-m5): the boot is a body (shared/kick.js), the HS M5 speed caps
  // and air speed, knockback fitted, the CPU's dash/hop/mash habits fitted to the cpu.* rows.
  // AND the defender is free under a cut-in, and a skied ball keeps its sideways speed off the ceiling.
  // AND the cut-in timed from the touch (1.27 s hold, 1.5 s dark), the ball fired from 2.5 head radii
  // in front of the shooter (POWER_RELEASE_AT), a block's stop under the dark's tail freezing both.
  const GOLDEN = '41b49db760e3e2bcb60b397617764cfa6de273c2602c238a8c2a67a3cdad8b69';   // re-recorded (2026-10-05): a weak tier's lazy roll never holds it off a ball behind it, between it and its own goal (Idan's playtest: stages 1–5 stood still with the ball at their back); before that (2026-10-04) the bot kicks with the boot it will really have — the live swing only (not the snap back), only when the boot meets the ball before the head or the body, header jumps only for a ball above the head's centre, and it steps into a low ball in front (MEET IT MOVING); before that the ceiling is HS's as measured on every hit in M1–M11 (_ceil-hits.mjs): the ball centre turns at -118 (CEIL_Y -133) and bounces back with 0.64 of the climb (was -130 and 0.41); before that the bot presses KICK when the boot, where it really is in the swing, meets the ball (kick.js bootAt, swept through each tick), keeps the boot for a ball about to arrive (no mash), plans where to meet the ball at the tuned speed and decides who is first by time, and times jumps to its own jump; before that the CPU boots the other player by its stars (bot.js bootOf: 0.03 up to 1.5 stars, every ready boot at five, a knocked-out player too) unless the ball is about to reach its boot; before that no bot moves in the ~0.55 s before a restart's ball drops (sim ballWait; HS's CPU 'does nothing until the ball is launched'); before that the CPU answers a power shot with its BODY in the path, never its boot, a stride or more out from the shooter (Idan's M7–M11: 21 shots, no CPU kick-block), and Nigeria's "close" deflection only right by him; before that the counter by kick is the BOOT meeting the power ball (sim.js bootOn; a head or body with the leg out is hit), and the bot times its kick to the boot's window (0.07 s for a grass ball, 0.19 s at head height); before that the defender freezes 0.8 → 0.3 s below five stars when the other player's power starts, then answers or not (0.3 + 0.6 skill), off by a tier's sloppiness in time and place, and a champion power's own answer (Nigeria: kick it, never jump it) beats its family's (Idan's HS notes); before that during the other player's cut-in the defender times its jump and boot to the release (bot.js tOff), and fewer tiers read it (0.1 + 0.45 skill), and no bot mashes its boot while a blocked shot grinds; before that a strike event carries the speed the ball leaves at (`v`, events only — the bodies and the ball are unchanged); before that the defender gets into the path of an answerable power shot during its cut-in; before that the CPU follows the ball past its pressing depth when it is the nearer player, and waits further out the stronger it is; before that the human double tap (window from the release, buffered second tap) and the bot's tap guard; before that the boot is HS's measured bounce again (BOOT_BOUNCE 0.68, its swing BOOT_DRIVE 0.893 so a still ball leaves as before), the ceiling keeps 0.63 of the sideways speed (CEIL_KEEP_X, HS M1–M4), and the CPU mashes a close ball more at the bottom tiers (bot.js MASH_BASE); before that a kick-block fires back THE POWER IT BLOCKED, now the blocker's (hs-powers fireBack, pw.src; Idan); before that a power shot's HIT throws the victim flat into his goal (1000 px/s), 0.9 s down, a mark on his face (hs-powers HIT_KNOCK / POWER_HIT_STUN, HS M4 62.85 s); before that an armed bot keeps playing its own game and fires on its next touch, instead of dashing and booting at the ball to fire (bot.js ARMED; HS cpu.powerDelay, a friend's 1–9 at stage 1); before that HS's own goal height again, and a power shot never leaves higher than just under the crossbar, so one fired from the top of a full jump goes in (constants.js POWER_RELEASE_BAR_GAP, Idan); before that a power shot always leaves at the shooter's head height, whatever touched it (constants.js POWER_RELEASE_UP, Idan); before that a straight power shot met by a player in the air right where it leaves goes back off him over the shooter (the wiki's early header, HS.EARLY_HEADER), and a blocked shot fires back plain, without the shooter's ailment; before that the CPU dash-strikes a slow grass ball in front of it (bot.js THE DASH STRIKE) and waits DEAD_WAIT before pouncing on a dead ball; before that the grass and the side walls grip the ball (BALL_GRIP 0.07, HS M1–M6) and a bot takes a dead ball past its pressing depth; before that a grass ball kicked leaves with HS's small lift (the boot's ground path rises, shared/kick.js BOOT_PATH); before that HS's proportions — the 1.2x sideways stretch (oval ball and heads, solved in native space), HS's goal box (far post on the line), the 221 kickoff spot; before that the HS cut-in timing and release spot; before that the CPU arms the moment its gauge is full (Idan); before that hit marks (`hurt`) count every hurt but the knockout's, up to four (HS M4 95–187 s); before that a power shot ends when it scores or meets the frame
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
  // knockout's count and the bruise) joined with hs/kick-stun. `kickHit` (the swing has struck the
  // ball once: one strike event and one hit-stop a swing) joined with the physical boot.
  ok('the snapshot schema is the HS one', JSON.stringify(Object.keys(serialize(m))) === JSON.stringify(['t', 'clock', 'phase', 'freeze', 'hitStop', 'idle', 'cutin', 'cutinBy', 'ghost', 'banner', 'bannerT', 'ballWait', 'gaugeLead', 'afterGoal', 'afterGoalTo', 'score', 'golden', 'lastScorer', 'p', 'b', 'xb']) &&
     serialize(m).p[0].length === 34);   // 34: + holdT, dashBuf, dashBufDir (the human double tap)
  ok('an ordinary bot is still exactly its tier', createBot(3).d === DIFFICULTIES[3]);
}

console.log(`test-arcade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
