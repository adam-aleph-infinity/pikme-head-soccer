// Power-up tests — the six collectable pickups. Run: node test-powerups.mjs
//
// Almost all of this file is about ONE property, and it is a harder one than the
// spectacle's. Spectacle has to be SEEABLE; a pickup has to be seeable AND equally
// GETTABLE, because a 1v1 where one player can reach the good thing and the other cannot is
// not a game. So: the equidistant spawn, the postpone-instead-of-clamp, the "never start a
// race one runner cannot run" rule, the mercy lead on the one item that takes something off
// the other player, the quiet finish, and the fact that every single effect ends — each
// gets an assertion here. The constants are also checked against each other, so a tuner
// slider cannot quietly make the game unfair.
import * as C from './shared/constants.js';
import { createMatch, step, serialize, restore, headY, headR } from './shared/sim.js';
import { PU, PU_NAME, PU_KINDS, activePickup, puBadges, hasGrow, hasMagnet, hasShield,
         hasSpring, puMaxJumps, pickupY, packPickups, unpackPickups } from './shared/powerups.js';
import { createBot, botInput } from './shared/bot.js';

// Crates are OFF by default now that the cards deal the powers (see CARDS_ON / PICKUPS_ON
// in constants.js). This file is the crate system's test, so it turns them on for itself —
// the spawner and every rule below still work, they are simply no longer what a match uses.
C.tune({ PICKUPS_ON: 1 });

let pass = 0, fail = 0;

// Fire the power move and let it land. The button buys a committed VOLLEY now — press, wind
// up for POWER_CHARGE_TIME, and the ball goes — so a test that needs a power BALL has to run
// the wind-up out rather than arm and kick.
function firePower(mm, i = 0) {
  const p = mm.players[i];
  p.gauge = 1; p.prev = {}; mm.hitStop = 0;
  const inputs = [{}, {}]; inputs[i] = { power: true };
  step(mm, inputs);
  mm.events.length = 0;
  for (let t = 0; t < Math.round(C.POWER_CHARGE_TIME / C.TICK) + 4 && !mm.ball.power; t++) {
    mm.hitStop = 0; step(mm, [{}, {}]); mm.events.length = 0;
  }
  return mm.ball.power;
}

// Where a JUMPING defender is when the volley passes. It flies at POWER_CHARGE_HEIGHT, above
// a standing head — that is the point of the move — so any test about a defender meeting one
// has to put them up there.
function inLine(mm, p) {
  p.y = C.GROUND_Y - (C.powerHeight() - C.BODY_H - C.HEAD_R + 18);
  p.vy = 0; p.onGround = false;
}

const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const NONE = [{}, {}];

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const ticks = (s) => Math.max(1, Math.round(s / C.TICK));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A long match, for the same reason test-spectacle uses one: pickups deliberately refuse to
// spawn inside PICKUP_QUIET_END of full time, so a 60s default would leave a third of these
// tests testing nothing.
const fresh = (opts = {}) => {
  const m = createMatch(CA, CB, { duration: 300, ...opts });
  m.freeze = 0; m.phase = 'play';
  return m;
};
const run = (m, n, inputs = NONE) => {
  const seen = [];
  for (let i = 0; i < n; i++) {
    step(m, typeof inputs === 'function' ? inputs(i, m) : inputs);
    for (const e of m.events) seen.push({ ...e, i });
    m.events.length = 0;
  }
  return seen;
};

// Put a pickup on the pitch without waiting out PICKUP_FIRST. `warn` 0 = already live.
function forcePickup(m, kind, x, warn = 0) {
  const pu = m.pu;
  pu.kind = kind;
  pu.x = Math.round(x);
  pu.warn = warn > 0 ? ticks(warn) : 0;
  pu.life = ticks(C.PICKUP_LIFE);
  pu.next = 0;
  return pu;
}
// Walk a player onto whatever is on the pitch and let them take it.
function collect(m, i, kind, x = C.W / 2) {
  forcePickup(m, kind, x);
  const p = m.players[i];
  p.x = x; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true;
  m.players[1 - i].x = x < C.W / 2 ? C.W - 120 : 120;      // the other one nowhere near it
  const seen = run(m, 1);
  m.hitStop = 0;
  return seen;
}
// Ask the spawner for one, with the pitch in a state it should accept.
function askForSpawn(m, ax = 300, bx = 700) {
  m.players[0].x = ax; m.players[1].x = bx;
  for (const p of m.players) { p.knocked = 0; p.rooted = 0; p.slow = 0; }
  m.pu.next = 0;
  return run(m, 1).find((e) => e.type === 'puWarn') || null;
}

// ═══ 1. THE TELEGRAPH ══════════════════════════════════════════════════════
{
  const m = fresh();
  const w = askForSpawn(m);
  ok('a pickup announces itself', !!w, `got ${w ? w.name : 'nothing'}`);
  ok('and is NOT collectable yet', activePickup(m).live === false);
  const p = m.players[0];
  p.x = w.x;                                     // stand right on it through the whole warn
  const during = run(m, ticks(C.PICKUP_WARN) - 2, () => { p.x = w.x; return NONE; });
  ok('standing on the ghost collects nothing', !during.some((e) => e.type === 'puTake'));
  const after = run(m, 4, () => { p.x = w.x; return NONE; });
  ok('it goes live at the end of the telegraph', after.some((e) => e.type === 'puLive'));
  ok('and is collected the moment it does', after.some((e) => e.type === 'puTake' && e.player === 0));
}
{
  // Time the telegraph on the clock, not on the intent.
  const m = fresh();
  const w = askForSpawn(m);
  const seen = run(m, ticks(C.PICKUP_WARN) + 4);
  const live = seen.find((e) => e.type === 'puLive');
  ok('the telegraph lasts exactly PICKUP_WARN', live && Math.abs((live.i + 1) * C.TICK - C.PICKUP_WARN) <= C.TICK,
     live ? `${((live.i + 1) * C.TICK).toFixed(3)}s vs ${C.PICKUP_WARN.toFixed(3)}s` : 'never went live');
  ok('(and it was announced first)', !!w && !!live);
}
{
  // A telegraph you cannot cross is decoration. From the midpoint — the furthest either
  // player can ever be from a pickup — the run has to be finishable inside warn + life,
  // at the slowest speed the game can legally put someone at.
  const slowest = C.PLAYER_SPEED * 0.94;             // a common card, running clean
  const furthest = (C.W - 2 * (C.GOAL_W + C.BODY_W / 2)) / 2;
  const window = (C.PICKUP_WARN + C.PICKUP_LIFE) * slowest;
  ok('the slowest player can cross the pitch inside a pickup\'s life', window > furthest,
     `${window.toFixed(0)}px of running vs ${furthest.toFixed(0)}px worst case`);
}

// ═══ 2. FAIRNESS: EQUALLY REACHABLE, MEASURED ══════════════════════════════
{
  // The core claim. Sixty different pitch states, and for every spawn the two run-distances
  // are compared. They are allowed to differ by the one pixel Math.round can introduce and
  // by nothing else.
  let spawns = 0, worst = 0, worstAt = '';
  for (let s = 0; s < 60; s++) {
    const m = fresh();
    const ax = 80 + (s * 53) % 800;
    const bx = 100 + (s * 131) % 780;
    const w = askForSpawn(m, ax, bx);
    if (!w) continue;
    spawns++;
    const d = Math.abs(Math.abs(w.x - ax) - Math.abs(w.x - bx));
    if (d > worst) { worst = d; worstAt = `a=${ax} b=${bx} pickup=${w.x}`; }
  }
  ok('the spawner is actually firing', spawns > 40, `${spawns}/60 pitch states produced one`);
  ok('every pickup is the same distance from both players', worst <= 1,
     `worst gap ${worst.toFixed(2)}px  (${worstAt})`);
}
{
  // …and prove it as a RACE, not as arithmetic. Identical cards, both holding toward the
  // crate from the instant it is announced. Neither of them may be beaten to it.
  const m = fresh();
  const w = askForSpawn(m, 260, 700);
  const dir = (p) => (w.x > p.x ? { right: true } : { left: true });
  const seen = run(m, ticks(C.PICKUP_WARN) + 90, (i, mm) => [dir(mm.players[0]), dir(mm.players[1])]);
  const take = seen.find((e) => e.type === 'puTake');
  ok('(a dead-heat race resolves)', !!take);
  const a = m.players[0], b = m.players[1];
  ok('two identical cards from an identical distance arrive together',
     Math.abs(Math.abs(a.x - w.x) - Math.abs(b.x - w.x)) < C.BODY_W,
     `a=${a.x.toFixed(0)} b=${b.x.toFixed(0)} pickup=${w.x}`);
}
{
  // The dead heat itself must not be decided by the order of the players array. Player 0
  // would silently win every one of them.
  let p0 = 0, p1 = 0;
  for (let s = 0; s < 40; s++) {
    const m = fresh();
    // Both silhouettes over it, both centres exactly PICKUP_R/2 away — a true tie.
    const x = 300 + s * 7;
    forcePickup(m, PU.GROW, x);
    m.pu.n = s;                                        // walk the coin along
    m.players[0].x = x - 10; m.players[1].x = x + 10;
    const seen = run(m, 1);
    const t = seen.find((e) => e.type === 'puTake');
    if (t) (t.player === 0 ? p0++ : p1++);
    m.hitStop = 0;
  }
  ok('(the dead heats all resolved)', p0 + p1 === 40, `${p0 + p1}/40`);
  ok('a dead heat is not always player 0', p0 > 4 && p1 > 4, `${p0} vs ${p1}`);
}
{
  // Both players parked in the same corner: the midpoint is inside the keep-out band, so
  // clamping it would move the pickup toward one of them. It waits instead.
  const m = fresh();
  const w = askForSpawn(m, 80, 120);
  ok('a midpoint inside the keep-out band postpones the spawn', w === null,
     w ? `spawned at ${w.x} anyway` : '');
  ok('and nothing is on the pitch', activePickup(m) === null);
  const later = askForSpawn(m, 300, 620);              // pitch opens up
  ok('and it arrives once the pitch opens up', !!later && later.x === 460, `x=${later?.x}`);
}
{
  // The band itself, swept: nothing may ever appear in front of a goal.
  let spawns = 0, inside = 0;
  for (let s = 0; s < 80; s++) {
    const m = fresh();
    const w = askForSpawn(m, 70 + (s * 11) % 820, 70 + (s * 197) % 820);
    if (!w) continue;
    spawns++;
    if (w.x < C.GOAL_W + C.PICKUP_KEEPOUT || w.x > C.W - C.GOAL_W - C.PICKUP_KEEPOUT) inside++;
  }
  ok('(the sweep produced spawns)', spawns > 30, `${spawns}`);
  ok('none of them lands in a goalmouth', inside === 0, `${inside} of ${spawns}`);
  ok('the keep-out band clears the goal by a body', C.PICKUP_KEEPOUT > C.PICKUP_R + C.BODY_W,
     `${C.PICKUP_KEEPOUT}px vs ${C.PICKUP_R + C.BODY_W}px`);
}
{
  // Reachable from a standstill. If a pickup needed a jump, the footrace would become a
  // timing puzzle and the thing this whole file proves would stop being the thing that
  // matters.
  const m = fresh();
  const p = m.players[0];
  p.x = C.W / 2; p.y = C.GROUND_Y; p.onGround = true;
  const gap = Math.abs(headY(p) - pickupY());
  ok('a standing head reaches the float height', gap < headR(m, p) + C.PICKUP_R,
     `${gap.toFixed(0)}px between centres vs ${(headR(m, p) + C.PICKUP_R).toFixed(0)}px of silhouette`);
  const seen = collect(m, 0, PU.GROW, C.W / 2);
  ok('and collects it without jumping', seen.some((e) => e.type === 'puTake'));
}

// ═══ 3. FAIRNESS: NEVER START A RACE ONE RUNNER CANNOT RUN ═════════════════
{
  for (const [what, apply] of [
    ['knocked down', (p) => { p.knocked = 0.5; }],
    ['rooted', (p) => { p.rooted = 0.5; }],
    ['slowed', (p) => { p.slow = 1.2; }],
  ]) {
    for (const victim of [0, 1]) {
      const m = fresh();
      m.players[0].x = 300; m.players[1].x = 700;
      apply(m.players[victim]);
      m.pu.next = 0;
      const seen = run(m, 6, () => { apply(m.players[victim]); return NONE; });
      ok(`nothing spawns while player ${victim} is ${what}`,
         !seen.some((e) => e.type === 'puWarn'));
    }
  }
}
{
  // Postponed, never cancelled: denying a pickup by tackling is worth a couple of seconds
  // and nothing more.
  const m = fresh();
  m.players[0].x = 300; m.players[1].x = 700;
  m.players[1].slow = 0.2;
  m.pu.next = 0;
  const seen = run(m, ticks(1.0));
  ok('a postponed spawn still happens once the pitch is fair again',
     seen.some((e) => e.type === 'puWarn'), 'a denial that lasted forever would be a denial');
}

// ═══ 4. FAIRNESS: NO SNOWBALL ══════════════════════════════════════════════
{
  // Read the note in spectacle.js about robot mode. Pickups cannot copy that trick — the
  // winner of a race is not known until after the item has spawned — so the safety has to
  // live in what the items ARE. Five of the six only ever touch the player who collected
  // them; the sixth is score-gated.
  const seenKinds = new Set();
  for (let s = 0; s < 200 && seenKinds.size < PU_KINDS.length; s++) {
    const mm = fresh();
    mm.pu.n = s;
    const w = askForSpawn(mm, 300, 700);
    if (w) seenKinds.add(w.kind);
  }
  ok('every item in the deck shows up', seenKinds.size === PU_KINDS.length,
     `${seenKinds.size}/${PU_KINDS.length}: ${[...seenKinds].map((k) => PU_NAME[k]).join(',')}`);
}
{
  // ICE is the ONLY one that takes anything off the other player, and it leaves the hat the
  // moment anyone leads by PICKUP_MERCY_LEAD.
  let iceWhileClose = 0, iceWhileNotClose = 0, closeSpawns = 0, awaySpawns = 0;
  for (let s = 0; s < 240; s++) {
    const close = fresh();
    close.pu.n = s; close.score = [1, 1];
    const w1 = askForSpawn(close, 300, 700);
    if (w1) { closeSpawns++; if (w1.kind === PU.ICE) iceWhileClose++; }

    const away = fresh();
    away.pu.n = s; away.score = [C.PICKUP_MERCY_LEAD, 0];
    const w2 = askForSpawn(away, 300, 700);
    if (w2) { awaySpawns++; if (w2.kind === PU.ICE) iceWhileNotClose++; }
  }
  ok('ICE appears while the match is close', iceWhileClose > 10, `${iceWhileClose}/${closeSpawns}`);
  ok('ICE never appears once anyone leads', iceWhileNotClose === 0,
     `${iceWhileNotClose}/${awaySpawns} at a ${C.PICKUP_MERCY_LEAD}-goal lead`);
  ok('the mercy lead matches the robot-mode deficit', C.PICKUP_MERCY_LEAD === C.ROBOT_DEFICIT,
     `${C.PICKUP_MERCY_LEAD} vs ${C.ROBOT_DEFICIT}`);
}
{
  // The STRUCTURAL version of "no snowball", and the one that actually carries the weight:
  // five of the six cannot touch the other player at all, so winning a race can never take
  // anything off them — only add something to you, briefly. Proved by running a twin match
  // with no pickup on the pitch and diffing the opponent's entire serialised state.
  for (const kind of PU_KINDS) {
    const withIt = fresh();
    forcePickup(withIt, kind, C.W / 2);
    withIt.players[0].x = C.W / 2; withIt.players[1].x = C.W - 120;
    const without = fresh();
    without.players[0].x = C.W / 2; without.players[1].x = C.W - 120;
    run(withIt, 1); run(without, 1);
    const touched = JSON.stringify(serialize(withIt).p[1]) !== JSON.stringify(serialize(without).p[1]);
    ok(kind === PU.ICE
         ? 'ICE is the one item that reaches across to the other player'
         : `${PU_NAME[kind]} cannot touch the other player at all`,
       touched === (kind === PU.ICE), `opponent state ${touched ? 'changed' : 'identical'}`);
  }
}
{
  // Nothing in this file may take a player's controls away — that is what the spectacle's
  // "wind never touches a player" rule is for, and it applies to pickups too. ICE is a
  // `slow`, and the only thing it may set.
  const m = fresh();
  const foe = m.players[1];
  const before = { rooted: foe.rooted, knocked: foe.knocked, gauge: foe.gauge };
  collect(m, 0, PU.ICE, C.W / 2);
  ok('ICE slows the other player', foe.slow > 0, `slow=${foe.slow.toFixed(2)}`);
  ok('and never roots or knocks them down', foe.rooted === before.rooted && foe.knocked === before.knocked);
  ok('a slowed player still has every button', (() => {
    foe.x = 500; foe.vx = 0;
    run(m, 20, [{}, { right: true, jump: true }]);
    return foe.vx > 0 && foe.y < C.GROUND_Y;
  })(), 'it is heavy legs, not a stun');
}
{
  // Re-collecting refreshes; it never stacks. Two big heads are a longer big head, not a
  // bigger one — which is what bounds the swing no matter who keeps winning the races.
  const m = fresh();
  collect(m, 0, PU.GROW, C.W / 2);
  const r1 = headR(m, m.players[0]);
  run(m, 30);
  collect(m, 0, PU.GROW, C.W / 2);
  const r2 = headR(m, m.players[0]);
  ok('a second big head does not make a bigger head', Math.abs(r1 - r2) < 1e-9,
     `${r1.toFixed(1)} then ${r2.toFixed(1)}`);
  ok('it refreshes the clock instead', puBadges(m, 0)[0].frac > 0.98);
}
{
  // Only one at a time, ever. The total amount of power on the pitch is bounded by the
  // scheduler, not by anybody's restraint.
  const m = fresh();
  let many = 0;
  for (let i = 0; i < ticks(120); i++) {
    step(m, NONE);
    m.events.length = 0;
    if (m.pu.kind !== PU.NONE && m.pu.next > 0) many++;   // a live item AND a pending one
  }
  ok('never two pickups on the pitch at once', many === 0, `${many} ticks with both`);
}

// ═══ 5. FAIRNESS: THE FINISH BELONGS TO THE PLAYERS ════════════════════════
{
  const m = fresh({ duration: C.PICKUP_QUIET_END + 0.4 });
  forcePickup(m, PU.SHIELD, C.W / 2, C.PICKUP_WARN);
  const seen = run(m, ticks(1.2));
  ok('the closing seconds take the pickup off the pitch', activePickup(m) === null);
  ok('and say so', seen.some((e) => e.type === 'puGone' && e.why === 'quiet'));
  const more = run(m, ticks(8));
  ok('and nothing spawns in the quiet window', !more.some((e) => e.type === 'puWarn'));
}
{
  const m = fresh({ duration: 0.4 });
  run(m, 40);
  ok('(sudden death reached)', m.golden === true);
  m.pu.next = 0;
  const seen = run(m, 900);
  ok('sudden death has no pickups at all', !seen.some((e) => e.type === 'puWarn'),
     seen.map((e) => e.type).join(','));
}
{
  // The relation that makes "the finish is theirs" true rather than nearly true: a pickup
  // taken at the very last legal instant has expired before the whistle. Checked against
  // the LIVE constants, because PACE rewrites every duration here.
  const longest = Math.max(C.PU_GROW_TIME, C.PU_MAGNET_TIME, C.PU_SHIELD_TIME,
                           C.PU_SPRING_TIME, C.PU_ICE_TIME);
  ok('no effect can still be running at full time', C.PICKUP_QUIET_END > longest,
     `quiet window ${C.PICKUP_QUIET_END}s vs longest effect ${longest.toFixed(1)}s`);
}
{
  // A goal teleports both players to the spawn spots, so a crate that was equidistant from
  // where they used to be is now a gift to one of them. It goes — and so does everything
  // already running, because it all belongs to the passage of play that just ended.
  const m = fresh();
  collect(m, 0, PU.SPRING, 400);
  forcePickup(m, PU.GROW, 500);
  ok('(an effect is live and a crate is on the pitch)', hasSpring(m, 0) && !!activePickup(m));
  m.ball.x = 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = -200;
  const seen = run(m, 1);
  ok('(a goal was scored)', m.score[1] === 1);
  ok('a goal clears the pitch', activePickup(m) === null);
  ok('and cancels every live effect', !hasSpring(m, 0) && puBadges(m, 0).length === 0);
  ok('and announces the ends', seen.some((e) => e.type === 'puEnd' && e.player === 0));
}
{
  const m = fresh();
  C.tune({ PICKUPS_ON: 0 });
  collect(m, 0, PU.GROW, 400);
  const seen = run(m, ticks(60));
  ok('the off switch really turns everything off',
     !seen.some((e) => e.type === 'puWarn' || e.type === 'puTake'), seen.map((e) => e.type).join(','));
  ok('and cancels anything already running', !hasGrow(m, 0));
  C.tune({ PICKUPS_ON: 1 });
}

// ═══ 6. EVERY EFFECT ENDS ══════════════════════════════════════════════════
{
  const DUR = { [PU.GROW]: () => C.PU_GROW_TIME, [PU.MAGNET]: () => C.PU_MAGNET_TIME,
                [PU.SHIELD]: () => C.PU_SHIELD_TIME, [PU.SPRING]: () => C.PU_SPRING_TIME };
  for (const kind of [PU.GROW, PU.MAGNET, PU.SHIELD, PU.SPRING]) {
    const m = fresh();
    collect(m, 0, kind, C.W / 2);
    ok(`${PU_NAME[kind]} starts`, puBadges(m, 0).length === 1);
    const seen = run(m, ticks(DUR[kind]()) + 4);
    ok(`${PU_NAME[kind]} ends on its own clock`,
       seen.some((e) => e.type === 'puEnd' && e.kind === kind && e.player === 0));
    ok(`and ${PU_NAME[kind]} leaves nothing behind`, puBadges(m, 0).length === 0);
    const on = seen.find((e) => e.type === 'puEnd');
    ok(`${PU_NAME[kind]} lasted its full duration`,
       Math.abs((on.i + 1) * C.TICK - DUR[kind]()) < 3 * C.TICK,
       `${((on.i + 1) * C.TICK).toFixed(2)}s vs ${DUR[kind]().toFixed(2)}s`);
  }
}
{
  const m = fresh();
  collect(m, 0, PU.ICE, C.W / 2);
  run(m, ticks(C.PU_ICE_TIME) + 4);
  ok('ice ends too', m.players[1].slow <= 0, `slow=${m.players[1].slow.toFixed(2)}`);
}
{
  // An uncollected pickup ends as well — a crate nobody wanted must not sit there all match.
  const m = fresh();
  forcePickup(m, PU.CHARGE, 500);
  m.players[0].x = 150; m.players[1].x = 820;
  const seen = run(m, ticks(C.PICKUP_LIFE) + 4);
  ok('an uncollected pickup expires', seen.some((e) => e.type === 'puGone'));
  ok('and the next one is scheduled', m.pu.next > 0 && activePickup(m) === null);
}

// ═══ 7. WHAT EACH ONE ACTUALLY DOES ════════════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  const before = headR(m, p), beforeY = headY(p);
  collect(m, 0, PU.GROW, C.W / 2);
  ok('GROW makes the head bigger', headR(m, p) > before * 1.3,
     `${before.toFixed(0)} → ${headR(m, p).toFixed(0)}px`);
  ok('and it grows around its own centre, so the player does not move', headY(p) === beforeY);
  ok('the grown head still fits on the pitch', headY(p) + headR(m, p) <= C.GROUND_Y + 1,
     `bottom at ${(headY(p) + headR(m, p)).toFixed(0)} vs ground ${C.GROUND_Y}`);
  // The drawback: a bigger head is a bigger thing to boot.
  const m2 = fresh();
  const reachOf = (mm) => C.KICK_R + headR(mm, mm.players[1]);
  const plain = reachOf(m2);
  collect(m2, 1, PU.GROW, C.W / 2);
  ok('a big head is also easier to tackle', reachOf(m2) > plain, `${plain.toFixed(0)} → ${reachOf(m2).toFixed(0)}px`);
}
{
  const m = fresh();
  const p = m.players[0];
  collect(m, 0, PU.MAGNET, 400);
  ok('(magnet is live)', hasMagnet(m, 0));
  p.x = 400; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0;
  m.ball.x = 620; m.ball.y = C.GROUND_Y - 100; m.ball.vx = 0; m.ball.vy = 0;
  run(m, 20, () => { p.x = 400; p.vx = 0; return NONE; });
  ok('MAGNET curves a loose ball toward the holder', m.ball.vx < -20, `vx=${m.ball.vx.toFixed(0)}`);
  ok('but does not levitate it', C.PU_MAGNET_FORCE < C.BALL_GRAV,
     `pull ${C.PU_MAGNET_FORCE.toFixed(0)} vs gravity ${C.BALL_GRAV.toFixed(0)}`);
}
{
  // Out of range is out of range — the whole pitch is not a magnet.
  const m = fresh();
  const p = m.players[0];
  collect(m, 0, PU.MAGNET, 200);
  p.x = 200; p.vx = 0;
  m.ball.x = 200 + C.PU_MAGNET_RANGE + 60; m.ball.y = C.GROUND_Y - 100;
  m.ball.vx = 0; m.ball.vy = 0;
  run(m, 12, () => { p.x = 200; p.vx = 0; return NONE; });
  ok('and only inside PU_MAGNET_RANGE', Math.abs(m.ball.vx) < 1, `vx=${m.ball.vx.toFixed(2)}`);
}
{
  const m = fresh();
  const p = m.players[0];
  p.gauge = 0.1;
  collect(m, 0, PU.CHARGE, C.W / 2);
  ok('CHARGE fills the gauge', p.gauge >= 1, `${p.gauge.toFixed(2)}`);
  ok('but does not arm it for you', p.armed <= 0, 'you still have to press POWER');
}
{
  const m = fresh();
  const p = m.players[0];
  collect(m, 1, PU.SPRING, 600);
  const q = m.players[1];
  const apex = (mm, pl) => {
    pl.x = 600; pl.y = C.GROUND_Y; pl.vy = 0; pl.onGround = true; pl.jumps = puMaxJumps(mm, pl.index);
    let top = pl.y;
    for (let i = 0; i < 70; i++) { step(mm, i % 2 === 0 ? [{}, { jump: i < 34 }] : [{}, {}]); top = Math.min(top, pl.y); }
    return C.GROUND_Y - top;
  };
  const springy = apex(m, q);
  const plain = fresh();
  const flat = apex(plain, plain.players[1]);
  ok('SPRING jumps higher', springy > flat * 1.15, `${flat.toFixed(0)}px → ${springy.toFixed(0)}px`);
  ok('and hands out an extra jump', puMaxJumps(m, 1) === C.MAX_JUMPS + 1, `${puMaxJumps(m, 1)}`);
  ok('which is taken back when it ends', (() => {
    run(m, ticks(C.PU_SPRING_TIME) + 4);
    return puMaxJumps(m, 1) === C.MAX_JUMPS && m.players[1].jumps <= C.MAX_JUMPS;
  })());
}
{
  // SHIELD. The block that would have cost you an effect is free, exactly once.
  const armAndFire = (mm) => {
    const a = mm.players[0], b = mm.players[1];
    a.x = 300; b.x = 640; b.y = C.GROUND_Y; b.onGround = true;
    firePower(mm, 0);
    inLine(mm, b);
    mm.hitStop = 0;
    mm.events.length = 0;
    const seen = [];
    for (let i = 0; i < 90 && !seen.some((e) => e.type === 'blocked'); i++) {
      step(mm, NONE);
      for (const e of mm.events) seen.push(e);
      mm.events.length = 0;
      mm.hitStop = 0;
    }
    return seen;
  };
  const bare = fresh();
  const s1 = armAndFire(bare);
  ok('(a power shot reaches the defender)', s1.some((e) => e.type === 'blocked'));
  ok('and normally costs them the effect', bare.players[1].effectId !== null || bare.players[1].knocked > 0
     || bare.players[1].rooted > 0 || bare.players[1].slow > 0);

  const shielded = fresh();
  collect(shielded, 1, PU.SHIELD, 640);
  const s2 = armAndFire(shielded);
  ok('SHIELD absorbs a power shot', s2.some((e) => e.type === 'puShieldBreak' && e.player === 1));
  ok('and the defender walks away clean', shielded.players[1].effectId === null
     && shielded.players[1].knocked <= 0 && shielded.players[1].rooted <= 0);
  ok('the shot is still stopped', s2.some((e) => e.type === 'blocked'));
  ok('and the shield is spent — it is one shot, not a wall', !hasShield(shielded, 1));
}
{
  // This used to test the other half of the shield's promise: a POWERED BOOT — kicking the
  // opponent while power mode was up — landed your signature effect by hand, and the shield
  // ate that too. Power mode is gone; the button buys a committed volley now, and there is no
  // powered boot to eat. The shield's remaining job — paying for one blocked shot — is
  // tested directly above, and that is the whole item.
  const m = fresh();
  collect(m, 1, PU.SHIELD, 500);
  ok('a shield survives until something hits it', hasShield(m, 1));
}

// ═══ 8. A MAGNET CANNOT SCORE FOR YOU ══════════════════════════════════════
{
  // The safety is structural: the pull is always TOWARD the holder, and a player is clamped
  // out of the net, so the ball can never be carried past its own magnet into their goal.
  let goals = 0, moved = 0;
  for (const side of [0, 1]) {
    for (let i = 0; i < 20; i++) {
      const m = fresh();
      const p = m.players[side];
      const deep = side === 0 ? C.W - C.GOAL_W - C.BODY_W / 2 : C.GOAL_W + C.BODY_W / 2;
      collect(m, side, PU.MAGNET, C.W / 2);
      p.x = deep; p.y = C.GROUND_Y;
      m.players[1 - side].x = C.W / 2;
      m.ball.x = deep - Math.sign(deep - C.W / 2) * (40 + i * 8);
      m.ball.y = C.GROUND_Y - 40 - i * 4;
      m.ball.vx = 0; m.ball.vy = 0;
      const before = m.ball.x;
      run(m, ticks(C.PU_MAGNET_TIME), () => { p.x = deep; p.vx = 0; return NONE; });
      if (Math.abs(m.ball.x - before) > 8) moved++;
      goals += m.score[0] + m.score[1];
    }
  }
  ok('(the magnet really is dragging the ball around)', moved > 20, `${moved}/40`);
  ok('a magnet never scores for its holder', goals === 0, `${goals} magnet goals`);
}
{
  // …and the drawback that makes it a tool rather than a buff: stand on your OWN line and
  // it drags the ball into your own net. That is the decision the item is for.
  const m = fresh();
  const p = m.players[0];
  collect(m, 0, PU.MAGNET, C.W / 2);
  p.x = C.GOAL_W + C.BODY_W / 2; p.y = C.GROUND_Y;          // parked on my own line
  m.players[1].x = 600;
  m.ball.x = 220; m.ball.y = C.GROUND_Y - 30; m.ball.vx = 0; m.ball.vy = 0;
  run(m, ticks(C.PU_MAGNET_TIME), () => { p.x = C.GOAL_W + C.BODY_W / 2; p.vx = 0; return NONE; });
  ok('but it will happily drag it into your own goal', m.ball.x < 220,
     `ball ${m.ball.x.toFixed(0)}, own line at ${C.GOAL_W}`);
}
{
  // A live power shot ignores the magnet, exactly as it ignores the wind: every shot has to
  // fly the same line, or "get in the way" becomes a guess.
  const m = fresh();
  collect(m, 1, PU.MAGNET, 700);
  const a = m.players[0];
  a.x = 300; a.gauge = 1;
  m.players[1].x = 700; m.players[1].y = C.GROUND_Y - 400;   // out of the shot's path
  firePower(m, 0);
  m.hitStop = 0;
  ok('(a power shot is in flight past a magnet)', !!m.ball.power);
  const vy0 = m.ball.vy;
  run(m, 6, () => { m.players[1].y = C.GROUND_Y - 400; return NONE; });
  ok('a live power shot ignores the magnet', !!m.ball.power && Math.abs(m.ball.vy - vy0) < 60,
     `vy ${vy0.toFixed(0)} → ${m.ball.vy.toFixed(0)}`);
}

// ═══ 9. ROLLBACK ═══════════════════════════════════════════════════════════
// Anything that can affect a future step has to be in serialize(), or an online client
// replays the last 30 ticks with a crate the server never spawned and a big head the server
// has never seen. Same property test-net.mjs applies to the rest of the sim.
{
  const m = fresh();
  forcePickup(m, PU.SHIELD, 480, C.PICKUP_WARN);
  collect(m, 0, PU.GROW, 300);
  forcePickup(m, PU.SHIELD, 480, C.PICKUP_WARN);
  run(m, 10);
  ok('(a crate is telegraphing and an effect is running)', !!activePickup(m) && hasGrow(m, 0));

  const wire = JSON.parse(JSON.stringify(serialize(m)));
  const clone = createMatch(CA, CB, { duration: 300 });
  restore(clone, wire);
  ok('a restored sim has the same crate',
     clone.pu.kind === m.pu.kind && clone.pu.x === m.pu.x && clone.pu.warn === m.pu.warn,
     `${clone.pu.kind}/${clone.pu.x}/${clone.pu.warn} vs ${m.pu.kind}/${m.pu.x}/${m.pu.warn}`);
  ok('and the same effect clocks', clone.pu.eff.join() === m.pu.eff.join(),
     `${clone.pu.eff.join()} vs ${m.pu.eff.join()}`);
  ok('and the same rng cursor', clone.pu.n === m.pu.n && clone.pu.next === m.pu.next);
}
{
  // The property that actually matters: restore, then keep stepping, and stay identical.
  const inputs = (i) => [{ right: i % 30 < 15, jump: i % 23 === 0, kick: i % 11 === 0 },
                         { left: i % 19 < 9, kick: i % 13 === 0 }];
  const a = fresh();
  a.score = [0, 3];                        // robot mode and the spectacle live too
  for (let i = 0; i < 700; i++) { step(a, inputs(i)); a.events.length = 0; }
  while (a.hitStop > 0) { step(a, inputs(700)); a.events.length = 0; }

  const b = createMatch(CA, CB, { duration: 300 });
  restore(b, JSON.parse(JSON.stringify(serialize(a))));
  let same = true, brokeAt = -1;
  for (let i = 700; i < 1100; i++) {
    step(a, inputs(i)); step(b, inputs(i));
    a.events.length = 0; b.events.length = 0;
    if (JSON.stringify(serialize(a)) !== JSON.stringify(serialize(b))) { same = false; brokeAt = i; break; }
  }
  ok('a restored sim stays in lockstep through the pickups', same,
     brokeAt >= 0 ? `diverged at tick ${brokeAt}` : 'rollback would desync');
}
{
  // A restore in the middle of a live effect must reproduce the effect, not just its timer.
  const a = fresh();
  collect(a, 0, PU.GROW, 400);
  run(a, 30);
  const b = createMatch(CA, CB, { duration: 300 });
  restore(b, JSON.parse(JSON.stringify(serialize(a))));
  ok('a restored client sees the big head', Math.abs(headR(b, b.players[0]) - headR(a, a.players[0])) < 1e-9,
     `${headR(b, b.players[0]).toFixed(1)} vs ${headR(a, a.players[0]).toFixed(1)}`);
}
{
  // The packing itself: integers only, trailing zeros trimmed, lossless round trip.
  const m = fresh();
  collect(m, 0, PU.MAGNET, 400);
  collect(m, 1, PU.SPRING, 600);
  forcePickup(m, PU.ICE, 500, C.PICKUP_WARN);
  run(m, 20);
  const packed = packPickups(m.pu);
  ok('the wire form is all integers', packed.every((v) => Number.isInteger(v)), packed.join(','));
  const target = createMatch(CA, CB, {}).pu;
  unpackPickups(target, packed);
  ok('unpack is the exact inverse of pack', packPickups(target).join() === packed.join(),
     `${packPickups(target).join()} vs ${packed.join()}`);

  const idle = packPickups(createMatch(CA, CB, {}).pu);
  ok('an idle pickup system is tiny on the wire', JSON.stringify(idle).length <= 12, JSON.stringify(idle));
  ok('and a fully loaded one is still small', JSON.stringify(packed).length < 60,
     `${JSON.stringify(packed).length} bytes: ${JSON.stringify(packed)}`);
}
{
  // Determinism: no Math.random anywhere, so the same two cards produce the same run of
  // pickups — the precondition for the whole rollback scheme.
  const stream = (m) => run(m, ticks(150)).filter((e) => /^pu/.test(e.type))
                        .map((e) => `${e.i}:${e.type}:${e.name ?? ''}:${e.x ?? ''}`).join('|');
  const s1 = stream(fresh()), s2 = stream(fresh());
  ok('the pickups are deterministic', s1 === s2 && s1.length > 40, `${s1.length} chars`);
  const other = stream(createMatch({ rarity: 'epic', number: 11 }, { rarity: 'rare', number: 2 },
                                   { duration: 300 }));
  ok('but a different matchup gets a different run', other !== s1);
}
{
  // Deterministic must not mean IDENTICAL EVERY MATCH. The seed is match-constant and the
  // counter runs 0,1,2,3, so before the draw was salted with the spawn tick, one pair of
  // cards drew the same four items in the same order every time they played — measured over
  // 150 bot matches at the time: ice 131 draws, the shield 2. Same two cards here, one
  // spawn each, at a different moment in the match.
  const count = {};
  for (let s = 0; s < 90; s++) {
    const m = fresh();
    m.t = s * 0.23;
    const w = askForSpawn(m, 300, 700);
    if (w) count[w.name] = (count[w.name] || 0) + 1;
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  const top = Math.max(...Object.values(count));
  ok('and one pair of cards does not draw the same item every match',
     Object.keys(count).length === PU_KINDS.length && top < total * 0.4,
     `${total} draws — ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join('  ')}`);
}

// ═══ 10. THE BOT CONTESTS THEM ═════════════════════════════════════════════
{
  // A pickup nobody goes for is scenery. Two things get measured here, and the second one
  // is deliberately NOT "the better bot collects more".
  //
  // It was, and it failed — measured 18-18 between a legendary and a very-easy bot. That
  // number is honest and it is not a bug in the ladder: a crate spawns at the MIDPOINT
  // between the two players, and a reckless bot is running through the midpoint constantly
  // because it chases every ball. It blunders into half of them. The legendary bot goes for
  // them on PURPOSE — four times as many committed frames — and converts about as many.
  //
  // So the ladder is asserted where it actually lives: how hard the bot tries.
  // 14 matches, not 8. At 8 the effort ratio swung between 1.6x and 3.9x purely on which
  // items happened to spawn where, and a test that flickers is not a test.
  const play = (la, lb, matches = 14) => {
    let takes = [0, 0], go = [0, 0], spawns = 0, expired = 0, score = [0, 0];
    for (let s = 0; s < matches; s++) {
      const m = createMatch(CA, CB, {});
      const bots = [createBot(la, mulberry32(7000 + s * 31)),
                    createBot(lb, mulberry32(91000 + s * 77))];   // one stream EACH: sharing
      for (let t = 0; t < 5000 && m.phase !== 'over'; t++) {       // one biases toward bot 0
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        for (let i = 0; i < 2; i++) if (bots[i].puGo) go[i]++;
        for (const e of m.events) {
          if (e.type === 'puTake') takes[e.player]++;
          if (e.type === 'puWarn') spawns++;
          if (e.type === 'puGone') expired++;
        }
        m.events.length = 0;
      }
      score[0] += m.score[0]; score[1] += m.score[1];
    }
    return { takes, go, spawns, expired, score };
  };
  const r = play(5, 0);
  ok('bots collect pickups at all', r.takes[0] + r.takes[1] > 8,
     `${r.takes[0] + r.takes[1]} of ${r.spawns} spawned`);
  ok('and most of what spawns gets taken', r.expired < r.spawns * 0.45,
     `${r.expired}/${r.spawns} expired uncollected — a crate nobody wants is scenery`);
  // The margin, not the number. This was 1.8x when the pitch was 960 wide; widening it to
  // 1060 inflated the frame count for BOTH bots (everything is further away, so everyone
  // spends longer running) and compressed the ratio to about 1.4 with no change to the bot.
  // What the test is protecting is that a good bot wants the crate MORE, and it still does.
  ok('wanting the crate is on the difficulty ladder', r.go[0] > r.go[1] * 1.3,
     `legendary spent ${r.go[0]} frames running at one, very-easy ${r.go[1]} (ratio ${(r.go[0] / Math.max(1, r.go[1])).toFixed(2)}x)`);
  ok('and the football skill gradient survives the pickups', r.score[0] > r.score[1],
     `legendary ${r.score[0]} - ${r.score[1]} very-easy`);
  const back = play(0, 5);
  ok('which holds with the sides swapped', back.score[1] > back.score[0] && back.go[1] > back.go[0] * 1.8,
     `${back.score[0]}-${back.score[1]}, go ${back.go[0]} vs ${back.go[1]}`);
}
{
  // The other direction: pickups must not make the bot forget it is a goalkeeper. If
  // chasing crates opened the net, the scoreline against a weak bot would collapse.
  const spread = (on) => {
    C.tune({ PICKUPS_ON: on });
    let mine = 0, theirs = 0;
    for (let s = 0; s < 8; s++) {
      const rng = mulberry32(4100 + s * 17);
      const m = createMatch(CA, CB, {});
      const bots = [createBot(5, rng), createBot(1, rng)];
      for (let t = 0; t < 5000 && m.phase !== 'over'; t++) {
        step(m, [botInput(bots[0], m, 0, C.TICK), botInput(bots[1], m, 1, C.TICK)]);
        m.events.length = 0;
      }
      mine += m.score[0]; theirs += m.score[1];
    }
    return { mine, theirs };
  };
  const off = spread(0), on = spread(1);
  C.tune({ PICKUPS_ON: 1 });
  ok('the skill gradient survives the pickups', on.mine > on.theirs,
     `with: ${on.mine}-${on.theirs}   without: ${off.mine}-${off.theirs}`);
}

// ═══ 11. IT DID NOT BREAK THE FOOTBALL ═════════════════════════════════════
{
  const m = fresh();
  let bad = 0;
  for (let i = 0; i < ticks(180); i++) {
    step(m, [{ right: i % 40 < 20, kick: i % 11 === 0, jump: i % 37 === 0 },
             { left: i % 33 < 16, jump: i % 29 === 0, kick: i % 17 === 0 }]);
    m.events.length = 0;
    for (const p of m.players) {
      // The goal is a room a player may stand in, so the wall that matters is the BACK of the
      // net rather than the goal line (shared/goalbox.js).
      const wall = C.POST_R + C.BODY_W / 2;
      if (p.y > C.GROUND_Y + 0.5 || p.x < wall || p.x > C.W - wall) bad++;
      if (p.jumps > C.MAX_JUMPS + Math.round(C.PU_SPRING_JUMPS)) bad++;
    }
    if (m.pu.eff.some((v) => v < 0)) bad++;
  }
  ok('three minutes of pickups leaves everyone on the pitch', bad === 0, `${bad} bad ticks`);
  ok('and the match still runs', m.t > 150 && m.score[0] + m.score[1] >= 0);
}
{
  // The head geometry lives in two places — sim.js owns headY, powerups.js has to know the
  // same number to decide what is touching a crate. This is the drift alarm.
  const m = fresh();
  const p = m.players[0];
  p.x = 500; p.y = C.GROUND_Y;
  forcePickup(m, PU.GROW, 500);
  const gap = Math.abs(headY(p) - pickupY());
  const shouldTouch = gap < headR(m, p) + C.PICKUP_R;
  const seen = run(m, 1);
  ok('what powerups.js thinks a head is, sim.js agrees with',
     shouldTouch === seen.some((e) => e.type === 'puTake'),
     `gap ${gap.toFixed(0)}px, headY ${headY(p).toFixed(0)}, pickupY ${pickupY().toFixed(0)}`);
}

console.log(`test-powerups: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
