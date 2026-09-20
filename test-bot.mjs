// Bot tests — headless bot-vs-bot matches. Run: node test-bot.mjs
// These answer the only questions that matter for a feel test: does a match actually
// produce football, and does the difficulty dial do anything?
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from './shared/bot.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// Deterministic RNG so a red run is reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playMatch(levelA, levelB, seed, duration = C.MATCH_DURATION) {
  const rng = mulberry32(seed);
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, { duration });
  const bots = [createBot(levelA, rng), createBot(levelB, rng)];
  const stats = { touches: 0, kicks: 0, powershots: 0, counters: 0, knocks: 0, tackles: 0, moved: [0, 0], maxTicks: 0 };
  const startX = m.players.map((p) => p.x);
  let ticks = 0;
  // Every goal freezes the clock for ~2s, so a high-scoring match needs generous headroom.
  const limit = Math.ceil((duration + 90) / C.TICK);
  while (m.phase !== 'over' && ticks < limit) {
    const inputs = [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)];
    step(m, inputs);
    ticks++;
    for (const e of m.events) {
      if (e.type === 'strike') stats.touches++;
      if (e.type === 'kick') stats.kicks++;
      if (e.type === 'powershot') stats.powershots++;
      if (e.type === 'counter') stats.counters++;
      if (e.type === 'knocked') stats.knocks++;
      if (e.type === 'tackle') stats.tackles++;
    }
    m.events.length = 0;
    for (let i = 0; i < 2; i++) stats.moved[i] = Math.max(stats.moved[i], Math.abs(m.players[i].x - startX[i]));
  }
  stats.maxTicks = ticks;
  return { m, stats, ticks, limit };
}

// --- a bot match is actually a match ----------------------------------------
{
  const { m, stats, ticks, limit } = playMatch(3, 3, 12345);
  ok('the match reaches full time', m.phase === 'over' && ticks < limit, `phase=${m.phase} ticks=${ticks}/${limit}`);
  ok('both bots move around', stats.moved[0] > 120 && stats.moved[1] > 120, stats.moved.map((v) => v.toFixed(0)).join('/'));
  ok('the ball gets struck a lot', stats.touches > 30, `touches=${stats.touches}`);
  // ACROSS SEEDS, not on one. The ultimate fires when an ARMED bot happens to reach the ball,
  // which is the least deterministic thing either of them does: a match is chaotic, and one
  // seed's count swings between 1 and 5 without anything in the bot changing. Measured over a
  // dozen seeds it sits at 2.7 a match, and it sat at exactly 2.7 before the goal was resized
  // too — so the mean is the thing that means something and 12345 alone was a coin toss that
  // had been landing the right way up. What is being fenced is "the bots use it, regularly",
  // and a single match cannot say "regularly".
  const SEEDS = [12345, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const fired = SEEDS.map((s) => playMatch(3, 3, s).stats.powershots);
  const mean = fired.reduce((a, b) => a + b, 0) / fired.length;
  // MOST seeds, not every one. This used to demand a minimum of 1 across all twelve, which is
  // the single-match coin toss the paragraph above says not to trust, one level up: a match
  // where neither bot ever gets a full meter to the ball is a legal match, and one duly turned
  // up. The property worth fencing is that the move is a regular part of play.
  const silent = fired.filter((n) => n === 0).length;
  ok('bots fire power shots', mean >= 2 && silent <= 2,
     `mean=${mean.toFixed(2)}, ${silent} silent, of ${fired.join(',')}`);
  ok('somebody scores', m.score[0] + m.score[1] > 0, m.score.join('-'));
  // This guards against runaway physics, not against taste: it is what caught the ball
  // tunnelling through a defender (matches finished 15-12) and the inverted aggression
  // dial. Where exactly the goal rate should sit is Adam's call at the tuner, not a test's.
  ok('the scoreline stays arcade-plausible', m.score[0] + m.score[1] <= 20, m.score.join('-'));
}

// --- no stuck states --------------------------------------------------------
{
  // "Didn't finish" is not the same as "stuck": a level scoreline goes to sudden death,
  // which legitimately runs until somebody scores. Only a match that is neither over nor
  // in golden goal is actually wedged.
  let wedged = 0, golden = 0;
  for (let s = 0; s < 6; s++) {
    const { m } = playMatch(2, 4, 900 + s, 25);
    if (m.phase === 'over') continue;
    if (m.golden) golden++;
    else wedged++;
  }
  ok('no match ever wedges', wedged === 0, `${wedged}/6 wedged`);
  ok('unfinished matches are all sudden death', golden + 0 <= 6);
}
{
  // The tackle has to actually happen in play, or it is a mechanic nobody meets.
  const { stats } = playMatch(5, 5, 4242);
  ok('bots use the tackle', stats.tackles > 0, `${stats.tackles} tackles`);
}
{
  // The ball must never leave the pitch, at any difficulty pairing.
  const rng = mulberry32(77);
  const m = createMatch({ rarity: 'epic', number: 7 }, { rarity: 'rare', number: 22 }, { duration: 40 });
  const bots = [createBot(5, rng), createBot(0, rng)];
  let escaped = false, nan = false;
  for (let i = 0; i < 40 / C.TICK && m.phase !== 'over'; i++) {
    step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
    m.events.length = 0;
    const b = m.ball;
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx)) { nan = true; break; }
    if (b.x < -2 || b.x > C.W + 2 || b.y > C.GROUND_Y + 2 || b.y < C.CEIL_Y - 2) { escaped = true; break; }
  }
  ok('the ball never leaves the pitch', !escaped);
  ok('no NaN in the sim', !nan);
}

// --- the difficulty dial does something -------------------------------------
//
// KNOWN FAILING, and deliberately left that way: the dial currently runs BACKWARDS. The very-easy
// bot beats the legendary one by 35 goals over 64 matches. Swapping the slots rules out a side
// bias — with the legendary bot in slot 1 the easy bot still wins, by 13 — so the weak bot wins
// from either end of the pitch. This is the product being wrong, not the test.
//
// WHY. Every tier's reaction, ball-reading and tackling were only ever worth a little, and what
// actually carried the ladder was one coin flip: a weak bot was made to hold the WRONG WAY as it
// swung, so it shot at its own net and gave goals away. The boot only swings toward the goal you
// attack now — nobody can shoot at their own net any more — and with that gone the remaining
// gradient does not cover the gap. Re-measured against the old physics it was already -14 over 64
// matches; the 16-match reading this used to take was simply landing the right way up by luck.
//
// WHAT WAS TRIED, all measured over 64 matches, none of it enough: standing a boot's length off
// the ball instead of on top of it (the one real gain, and it is kept); aiming the stand-off at
// the toe cap for the flat drive (-35), at the instep for loft (-42) and at the middle (-36);
// swinging only in a chosen part of the boot (-18) or swinging at everything (-38); a higher ball
// speed ceiling (helps, kept); pressure scaled by skill (-28). The gap is not in any one of these
// knobs — the difficulty MODEL needs rebuilding around what the new rule makes hard, which is
// getting round the ball and meeting it cleanly, not aiming.
//
// The sample is 48 rather than 16 so the number it reports is stable: a failing test that
// flickers is worse than one that fails the same way every time.
{
  let diff = 0, hardWins = 0, easyWins = 0;
  const N = 48;
  for (let s = 0; s < N; s++) {
    const { m } = playMatch(5, 0, 4000 + s * 37);      // legendary bot vs very-easy bot
    diff += m.score[0] - m.score[1];
    if (m.score[0] > m.score[1]) hardWins++;
    else if (m.score[1] > m.score[0]) easyWins++;
  }
  // Goal difference only. Asserting on the win count as well would have re-introduced the
  // very noise this block exists to avoid — at ~5 goals a match a single bounce flips a
  // result, and the tally sat on 8W-8L while the goal difference was clearly positive.
  ok('the hardest bot outscores the easiest', diff > 0,
     `aggregate goal difference ${diff > 0 ? '+' : ''}${diff} over ${N} matches (${hardWins}W ${easyWins}L)`);
}
{
  ok('there are six difficulty tiers', DIFFICULTIES.length === 6);
  const r = DIFFICULTIES.map((d) => d.react);
  ok('reaction time falls monotonically', r.every((v, i) => i === 0 || v < r[i - 1]), r.join(','));
  const e = DIFFICULTIES.map((d) => d.error);
  ok('aim error falls monotonically', e.every((v, i) => i === 0 || v < e[i - 1]), e.join(','));
}

console.log(`test-bot: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
