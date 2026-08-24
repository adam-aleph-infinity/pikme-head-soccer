// The four SPECIAL powers — the ones only the good cards carry. Run: node test-skills.mjs
//
// The six original powers are all buffs on a timer: they change what YOU can do and end.
// These four put something on the pitch — a dart, a wall, a dog — and that is a different
// class of thing to keep fair. The rules they answer to, all asserted below:
//
//   1. EVERY ONE OF THEM ENDS, and none can be stacked with itself. A dog that never leaves
//      or a goal wall you can hold up permanently is not a power, it is a new rule of the
//      game.
//   2. NOTHING IS UNAVOIDABLE. The dart flies a straight visible line, the dog runs along the
//      ground and can be jumped, the goal wall is on your OWN goal so it takes nothing away
//      from the other player's control. Anything that lands on you can be answered.
//   3. THE LADDER IS THE POINT. These live on epic and legendary cards only — that is what
//      "a better card" has to mean once every rarity already fires the same six.
//   4. THEY TRAVEL. Anything that can change a future tick is in the snapshot, or two clients
//      disagree about a dog.
import * as C from './shared/constants.js';
import { createMatch, step, serialize, restore } from './shared/sim.js';
import { PU } from './shared/powerups.js';
import { SK, SPECIAL_KINDS, activeDart, activeDog, goalWallT, hasSuperKick, headScale } from './shared/skills.js';
import { cardPower, RARITIES, CARDS_PER_RARITY, dealHand } from './shared/cards.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// skills.js keeps its own copies of these four numbers to avoid an import cycle with
// powerups.js (see the note at the top of that file). Two copies of a fact need a test.
const okEnum = SPECIAL_KINDS.join(',') === [PU.DART, PU.GOALWALL, PU.SUPERKICK, PU.DOG].join(',');

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const fresh = () => {
  const m = createMatch(CA, CB, { duration: 300 });
  m.freeze = 0; m.phase = 'play'; m.hitStop = 0;
  return m;
};
const run = (m, n, inputs = [{}, {}]) => {
  const seen = [];
  for (let i = 0; i < n; i++) {
    m.hitStop = 0;
    step(m, inputs);
    for (const e of m.events) seen.push(e);
    m.events.length = 0;
  }
  return seen;
};
const fire = (m, i, kind) => { SK.cast(m, i, kind); m.hitStop = 0; };

// ── 3. Only the good cards carry them ──────────────────────────────────────────
{
  ok('skills.js and the PU enum agree on the four kind numbers', okEnum, SPECIAL_KINDS.join(','));
  const SPECIALS = [PU.DART, PU.GOALWALL, PU.SUPERKICK, PU.DOG];
  const poolOf = (rarity) => {
    const out = new Set();
    for (let n = 1; n <= CARDS_PER_RARITY; n++) out.add(cardPower(rarity, n));
    return out;
  };
  const common = poolOf('common'), rare = poolOf('rare');
  const epic = poolOf('epic'), legendary = poolOf('legendary');

  ok('a common card never carries a special', SPECIALS.every((k) => !common.has(k)),
    [...common].join(','));
  ok('nor does a rare', SPECIALS.every((k) => !rare.has(k)));
  ok('an epic carries some of them', SPECIALS.some((k) => epic.has(k)),
    [...epic].join(','));
  ok('a legendary carries all four', SPECIALS.every((k) => legendary.has(k)),
    [...legendary].join(','));
  // The six originals must survive at every rarity, or a legendary loses the magnet.
  ok('and every rarity still has all six of the originals',
    [PU.GROW, PU.MAGNET, PU.CHARGE, PU.SHIELD, PU.SPRING, PU.ICE]
      .every((k) => common.has(k) && legendary.has(k)));

  // A hand is still three DIFFERENT powers, on every card in the album.
  const bad = [];
  for (const r of RARITIES) for (let n = 1; n <= CARDS_PER_RARITY; n++) {
    const h = dealHand({ rarity: r, number: n }, CB, 0);
    if (new Set(h.map((c) => cardPower(c.rarity, c.number))).size !== 3) bad.push(`${r}_${n}`);
  }
  ok('every card in the album still deals three different powers', bad.length === 0, bad.slice(0, 4).join(' '));
}

// ── THE DART: shrink them, or hit the net and grow ─────────────────────────────
{
  const m = fresh();
  const [me, foe] = m.players;
  me.x = 400; foe.x = 700; foe.y = me.y;
  fire(m, 0, PU.DART);
  ok('firing a dart puts one on the pitch', !!activeDart(m));
  ok('and it flies towards the player who fired it faces',
    Math.sign(activeDart(m).vx) === Math.sign(me.facing || 1));

  const seen = run(m, 90);
  const hit = seen.find((e) => e.type === 'dartHit');
  ok('it reaches the opponent', !!hit, seen.map((e) => e.type).join(','));
  ok('and shrinks them', headScale(m, 1) < 1, `scale ${headScale(m, 1).toFixed(2)}`);
  ok('it is spent on the hit', !activeDart(m));
  ok('the shrink wears off', (() => { run(m, 3000); return headScale(m, 1) === 1; })());
}
{
  // Same dart, no opponent in the way: it carries on into the goal and pays the shooter.
  const m = fresh();
  const [me, foe] = m.players;
  me.x = 700; me.facing = 1; foe.x = 200; foe.y = me.y;
  fire(m, 0, PU.DART);
  const seen = run(m, 120);
  ok('a dart that misses can still reach the net', seen.some((e) => e.type === 'dartGoal'),
    seen.map((e) => e.type).join(','));
  ok('and that makes the SHOOTER bigger', headScale(m, 0) > 1, `scale ${headScale(m, 0).toFixed(2)}`);
  ok('it never scores', m.score[0] === 0 && m.score[1] === 0, m.score.join('-'));
}
{
  const m = fresh();
  fire(m, 0, PU.DART);
  fire(m, 0, PU.DART);
  ok('only one dart at a time', typeof activeDart(m) === 'object' && !Array.isArray(activeDart(m)));
  run(m, 600);
  ok('a dart that hits nothing expires', !activeDart(m));
}

// ── THE GOAL WALL: your own net, briefly shut ──────────────────────────────────
{
  const m = fresh();
  fire(m, 0, PU.GOALWALL);
  ok('the wall goes up', goalWallT(m, 0) > 0);
  ok('and only on your own goal', goalWallT(m, 1) === 0);

  // A ball rolling in is turned away while it is up.
  m.ball.x = C.GOAL_W + 6; m.ball.y = C.GROUND_Y - 40; m.ball.vx = -600; m.ball.vy = 0;
  run(m, 20);
  ok('a ball that would have gone in does not', m.score[1] === 0, m.score.join('-'));
  ok('it comes back out', m.ball.vx > 0, `vx ${m.ball.vx.toFixed(0)}`);

  run(m, 400);
  ok('the wall comes down on its own', goalWallT(m, 0) === 0);
  const m2 = fresh();
  m2.ball.x = C.GOAL_W + 6; m2.ball.y = C.GROUND_Y - 40; m2.ball.vx = -600;
  run(m2, 40);
  ok('(and without it, that ball scores)', m2.score[1] === 1, m2.score.join('-'));
}

// ── THE SUPER KICK: the ball and the man ───────────────────────────────────────
{
  const m = fresh();
  const [me, foe] = m.players;
  fire(m, 0, PU.SUPERKICK);
  ok('it arms rather than fires', hasSuperKick(m, 0));

  // The BALL, measured with nobody in its way. A defender standing on the ball deadens it —
  // that is the body-deadens rule working, and measuring the shot through a body measures
  // the wrong thing.
  me.x = 500; me.facing = 1; me.kickCd = 0; me.prev = {};
  foe.x = 900; foe.y = me.y;
  m.ball.x = me.x + C.KICK_REACH; m.ball.y = me.y - C.BODY_H * 0.45; m.ball.vx = 0; m.ball.vy = 0;
  run(m, 2, [{ kick: true }, {}]);
  ok('the ball goes further than a normal kick', m.ball.vx > C.KICK_POWER * 1.5,
    `${m.ball.vx.toFixed(0)} vs a normal ${C.KICK_POWER.toFixed(0)}`);
  ok('it is spent', !hasSuperKick(m, 0));

  // And the MAN, with someone standing next to the ball where a defender actually stands.
  const m2 = fresh();
  const [me2, foe2] = m2.players;
  fire(m2, 0, PU.SUPERKICK);
  me2.x = 500; me2.facing = 1; me2.kickCd = 0; me2.prev = {};
  foe2.x = 560; foe2.y = me2.y; foe2.vx = 0;
  m2.ball.x = me2.x + C.KICK_REACH; m2.ball.y = me2.y - C.BODY_H * 0.45; m2.ball.vx = 0; m2.ball.vy = 0;
  run(m2, 2, [{ kick: true }, {}]);
  ok('and the opponent standing over it is thrown back', foe2.vx > 100, `foe vx ${foe2.vx.toFixed(0)}`);
}

// ── THE DOG: jump it or lose a second ──────────────────────────────────────────
{
  const m = fresh();
  const [me, foe] = m.players;
  me.x = 300; foe.x = 800; foe.y = me.y;
  fire(m, 0, PU.DOG);
  ok('a dog appears', !!activeDog(m));
  ok('and it runs at the opponent', Math.sign(activeDog(m).vx) === Math.sign(foe.x - me.x));

  // Stop AT the bite: the hold is a second, so running 300 ticks first and then asking
  // whether they are still held measures the hold having correctly expired.
  let bit = false, rootedAtBite = 0;
  for (let i = 0; i < 300 && !bit; i++) {
    m.hitStop = 0;
    step(m, [{}, {}]);
    bit = m.events.some((e) => e.type === 'dogBite');
    if (bit) rootedAtBite = foe.rooted;
    m.events.length = 0;
  }
  ok('it catches a player standing still', bit);
  ok('and holds them', rootedAtBite > 0.5, `rooted ${rootedAtBite.toFixed(2)}s`);

  // It LATCHES rather than vanishing. The old version deleted the dog on the frame it bit,
  // so the one second it holds you happened with nothing on screen — a player was frozen by
  // an animal that had already disappeared.
  const dog = activeDog(m);
  ok('the dog is still there, holding on', !!dog, 'the dog vanished at the moment it bit');
  ok('and it is on the player it caught', !!dog && Math.abs(dog.x - foe.x) < 40,
    dog ? `dog ${dog.x.toFixed(0)} vs foe ${foe.x.toFixed(0)}` : '');
  ok('the renderer can tell it is biting', !!dog && dog.on === 2, dog ? `on=${dog.on}` : '');

  // It follows them while it holds, rather than being left behind if they slide.
  foe.x += 25;
  run(m, 4);
  const still = activeDog(m);
  ok('it goes with them', !still || Math.abs(still.x - foe.x) < 40,
    still ? `dog ${still.x.toFixed(0)} vs foe ${foe.x.toFixed(0)}` : 'gone');

  run(m, 200);
  ok('then it lets go and leaves', !activeDog(m));
  ok('and the player is free', m.players[1].rooted <= 0);
}
{
  // THE WHOLE PROMISE: a jump clears it. Rather than hardcoding one reaction distance — which
  // silently became wrong the moment the dog's reach went from 24 to 32 — this looks for the
  // WINDOW: jump too early and you have landed again before it arrives, too late and it is
  // already on you. What has to be true is that a timing exists, and that it is wide enough
  // for a person rather than a frame-perfect input.
  const cleared = [];
  for (const at of [200, 170, 140, 120, 100, 85, 70, 58]) {
    const m = fresh();
    const [me, foe] = m.players;
    me.x = 300; foe.x = 760; foe.y = me.y;
    fire(m, 0, PU.DOG);
    let jumped = false, bitten = false;
    for (let i = 0; i < 300 && !bitten; i++) {
      const dog = activeDog(m);
      const jump = !jumped && dog && Math.abs(dog.x - foe.x) < at;
      if (jump) jumped = true;
      m.hitStop = 0;
      step(m, [{}, jump ? { jump: true } : {}]);
      bitten = m.events.some((e) => e.type === 'dogBite');
      m.events.length = 0;
      if (!activeDog(m)) break;
    }
    if (jumped && !bitten) cleared.push(at);
  }
  ok('a jump clears the dog', cleared.length > 0, 'no reaction distance escaped it');
  ok('and the window is wide enough for a person', cleared.length >= 3,
    `cleared when jumping at ${cleared.join(', ')}px`);
}

// ── 4. All of it travels ───────────────────────────────────────────────────────
{
  const m = fresh();
  fire(m, 0, PU.DART);
  fire(m, 1, PU.DOG);
  fire(m, 0, PU.GOALWALL);
  fire(m, 1, PU.SUPERKICK);
  run(m, 10);

  const clone = createMatch(CA, CB, { duration: 300 });
  restore(clone, serialize(m));
  // Within a pixel, not within a float: positions are rounded to integers on the wire on
  // purpose, the same discipline the pickups and the spectacle use.
  ok('the dart travels', !!activeDart(clone) &&
    Math.abs(activeDart(clone).x - activeDart(m).x) <= 1,
    activeDart(clone) ? `${activeDart(m).x.toFixed(1)} vs ${activeDart(clone).x}` : 'no dart');
  ok('the dog travels', !!activeDog(clone) && Math.abs(activeDog(clone).x - activeDog(m).x) <= 1);
  ok('the goal wall travels', Math.abs(goalWallT(clone, 0) - goalWallT(m, 0)) < 1e-6);
  ok('the armed super kick travels', hasSuperKick(clone, 1) === hasSuperKick(m, 1));

  // And a restored client must count down the SAME schedule, not restart it.
  run(m, 30); run(clone, 30);
  ok('and both ends then agree', Math.abs(goalWallT(clone, 0) - goalWallT(m, 0)) < 1e-6,
    `${goalWallT(m, 0).toFixed(3)} vs ${goalWallT(clone, 0).toFixed(3)}`);
}

// ── 1. A goal wipes them, like every other effect ──────────────────────────────
{
  const m = fresh();
  fire(m, 0, PU.DART);
  fire(m, 1, PU.DOG);
  m.ball.x = C.W - 40; m.ball.y = C.GROUND_Y - 60; m.ball.vx = 200;
  run(m, 30);
  ok('(a goal was scored)', m.score[0] === 1, m.score.join('-'));
  ok('a goal clears the pitch of darts and dogs', !activeDart(m) && !activeDog(m));
}

console.log(`test-skills: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
