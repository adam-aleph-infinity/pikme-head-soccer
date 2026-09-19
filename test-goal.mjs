// THE GOAL IS A ROOM. Run: node test-goal.mjs
//
// Two bugs wearing one coat, and this file is the fence around both of them.
//
//   THE PICTURE. The goal was drawn in ONE pass, before the bodies, so the ball and the
//   players were painted over the front of the net — every part of it, including the near
//   side you are supposed to look through. A goal nothing can ever be behind is a flat
//   sticker on the backdrop, which is what it looked like and what it was reported as.
//
//   THE PHYSICS. Both players were clamped at the goal LINE, so the mouth of the goal was an
//   invisible pane of glass. Nobody could walk into the net because there was no net to walk
//   into — just a line and a wall somewhere behind it.
//
// Both halves now read the same box out of shared/goalbox.js, so this file can test them
// together: the SIM half by stepping real matches, and the RENDER half by asking the same
// projection the renderer draws with where a body in the net lands. The pixels themselves are
// checked separately, in a browser, by _goalshots.mjs — geometry can prove the ball is at the
// depth of the middle of the net, but only a screenshot can prove you can see it there.
import * as C from './shared/constants.js';
import { createMatch, step, headY, NO_FX } from './shared/sim.js';
import { goalBox, goalAt, depthPoint, depthZ, project, walkBounds, barY, barCeiling,
         NEAR_Z, FAR_Z, INSIDE_Z } from './shared/goalbox.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const CA = { rarity: 'legendary', number: 3 };
const CB = { rarity: 'legendary', number: 2 };
const NONE = [{}, {}];
const ticks = (s) => Math.max(1, Math.round(s / C.TICK));

// A match already in play. `freeze` is cleared because a frozen step is no step at all.
const fresh = () => {
  const m = createMatch(CA, CB, {});
  m.freeze = 0; m.phase = 'play';
  return m;
};
// …and one where the ball can sit in the net without the scoreline ending the experiment.
// checkGoal only fires in 'play', so a match held at kickoff is the whole of the goal's
// physics — gravity, bounce, roll, the posts, the back — with the whistle switched off.
const noWhistle = () => {
  const m = createMatch(CA, CB, {});
  m.freeze = 0; m.phase = 'kickoff';
  return m;
};
const run = (m, n, inputs = NONE) => {
  const seen = [];
  for (let i = 0; i < n; i++) {
    m.hitStop = 0;
    step(m, typeof inputs === 'function' ? inputs(i, m) : inputs, C.TICK, NO_FX);
    for (const e of m.events) seen.push({ ...e, i });
    m.events.length = 0;
  }
  return seen;
};
// Park both players in the other half so they cannot touch the experiment.
const clearThePitch = (m) => { m.players[0].x = C.W * 0.45; m.players[1].x = C.W * 0.55; };

const LEFT = goalBox(true);
const RIGHT = goalBox(false);
const BAR = barY();

// ═══ 1. THE BOX ITSELF ═════════════════════════════════════════════════════
{
  ok('the left goal runs from the line back to the wall', LEFT.lineX === C.GOAL_W && LEFT.wallX === C.POST_R);
  ok('the right goal is its mirror', RIGHT.lineX === C.W - C.GOAL_W && RIGHT.wallX === C.W - C.POST_R);
  ok('both boxes step INWARD across the screen', LEFT.wx > 0 && RIGHT.wx < 0, `${LEFT.wx} / ${RIGHT.wx}`);
  ok('…and UP it', LEFT.wy < 0 && RIGHT.wy === LEFT.wy);
  ok('the bar is the top of the mouth', BAR === C.GROUND_Y - C.GOAL_H);
  ok('a point on the pitch is in neither goal', goalAt(C.W / 2, C.GROUND_Y) === null);
  ok('a point in the left net is in the left goal', goalAt(40, C.GROUND_Y - 20).left === true);
  ok('a point in the right net is in the right goal', goalAt(C.W - 40, C.GROUND_Y - 20).left === false);
  // Over the bar is OVER the goal, not in it: a lob clearing the frame has to keep drawing in
  // front of the frame it is clearing.
  ok('a ball above the bar is not inside the goal', goalAt(40, BAR - 30) === null);
}

// ═══ 2. DEPTH: BETWEEN THE NEAR NET AND THE FAR ONE ════════════════════════
//
// The requirement in one line — camera → near net → ball → far net — is the claim that a body
// in the goal sits strictly between the two side planes. z is the number the whole draw order
// is sorted on, so this is that requirement, tested.
{
  const deep = depthZ(30, C.GROUND_Y - 40);              // well inside the left net
  ok('a ball in the net is BEHIND the near net', deep > NEAR_Z, `z=${deep}`);
  ok('a ball in the net is IN FRONT of the far net', deep < FAR_Z, `z=${deep}`);
  ok('…and it is at the middle of the goal', Math.abs(deep - INSIDE_Z) < 1e-9, `z=${deep}`);
  ok('a ball on the pitch is on the near plane', depthZ(C.W / 2, C.GROUND_Y - 40) === NEAR_Z);
  ok('a ball over the bar is on the near plane', depthZ(30, BAR - 40) === NEAR_Z);
  const right = depthZ(C.W - 30, C.GROUND_Y - 40);
  ok('both goals have an interior', right > NEAR_Z && right < FAR_Z, `z=${right}`);
}
{
  // …and the DRAWN point has to land between the two side nets, which at a given depth are
  // the same x one step of the width axis apart. This is the picture the requirement asks
  // for, in coordinates: never on the near face, never past the far one.
  for (const box of [LEFT, RIGHT]) {
    const side = box.left ? 'left' : 'right';
    const x = box.lineX - box.inward * C.GOAL_W * 0.6;   // 60% of the way into the net
    const y = C.GROUND_Y - 60;
    const p = depthPoint(x, y);
    const near = x, far = x + box.wx;                    // the two side nets at this depth
    const lo = Math.min(near, far), hi = Math.max(near, far);
    ok(`${side}: a ball in the net draws between the two side nets`, p.x > lo && p.x < hi,
       `x=${p.x.toFixed(1)} nets ${lo.toFixed(1)}..${hi.toFixed(1)}`);
    ok(`${side}: …and never beyond the back of the net`,
       (box.left ? p.x > box.wallX : p.x < box.wallX), `x=${p.x.toFixed(1)}`);
  }
}
{
  // NO POP ON THE WAY IN. The projection moves a point sideways by up to 37px, so a switch at
  // the line would throw the ball backwards out of the goal it had just entered. Walk the ball
  // in a pixel at a time and watch the DRAWN x: it may only ever keep going in.
  for (const box of [LEFT, RIGHT]) {
    const side = box.left ? 'left' : 'right';
    let prev = null, back = 0, biggest = 0;
    for (let d = -20; d <= C.GOAL_W - C.POST_R; d += 1) {
      const x = box.lineX - box.inward * d;
      const p = depthPoint(x, C.GROUND_Y - 60);
      if (prev !== null) {
        const stepped = (prev - p.x) * box.inward;       // + is deeper into the net
        if (stepped < 0) back++;
        biggest = Math.max(biggest, Math.abs(p.x - prev));
      }
      prev = p.x;
    }
    ok(`${side}: the ball never jumps backwards going in`, back === 0, `${back} reversals`);
    ok(`${side}: and never teleports`, biggest < 2, `biggest step ${biggest.toFixed(2)}px`);
  }
}
{
  // The feet do not recede: this pitch draws near and far touchline on the same ground line,
  // so a ball resting in the back of the net must not be lifted off the floor — its shadow is
  // painted at GROUND_Y and would be left behind.
  const rest = depthPoint(30, C.GROUND_Y - C.BALL_R);
  ok('a ball on the floor of the net stays on the floor', Math.abs(rest.y - (C.GROUND_Y - C.BALL_R)) < 1.5,
     `y=${rest.y.toFixed(1)} vs ${(C.GROUND_Y - C.BALL_R).toFixed(1)}`);
  // …while the top of the box does, exactly as much as the frame drawn there.
  const high = project(30, BAR, INSIDE_Z, LEFT);
  ok('a ball at the bar rides the frame up', Math.abs(high.y - (BAR + LEFT.wy * INSIDE_Z)) < 1e-9,
     `y=${high.y.toFixed(1)}`);
}

// ═══ 3. THE BALL GOES IN, AND STAYS IN ═════════════════════════════════════
{
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W + 60; b.y = C.GROUND_Y - 40; b.vx = -600; b.vy = 0;
  const seen = run(m, 40);
  ok('a ball driven at the mouth scores', m.score[1] === 1, `score ${m.score}`);
  ok('…and says so', seen.some((e) => e.type === 'goal' && e.player === 1));
}
{
  // Where the ball WAS at the moment the whistle went: past the line, under the bar, inside
  // the box. The sim resets it to the spot on the same tick, so this is caught from the event
  // rather than from the ball, and it is the one that matters — that position is what the
  // renderer had to draw inside the goal.
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W + 60; b.y = C.GROUND_Y - 40; b.vx = -600; b.vy = 0;
  let at = null;
  for (let i = 0; i < 40 && !at; i++) {
    m.hitStop = 0;
    const before = { x: b.x, y: b.y };
    step(m, NONE, C.TICK, NO_FX);
    if (m.events.some((e) => e.type === 'goal')) at = before;
    m.events.length = 0;
  }
  ok('the ball crossed the line before it scored', at && at.x < C.GOAL_W + C.BALL_R * 2, `x=${at && at.x.toFixed(1)}`);
  ok('…under the bar', at && at.y - C.BALL_R > BAR, `y=${at && at.y.toFixed(1)}`);
}
{
  // THE INTERIOR AS A ROOM. No whistle, so the ball simply lives in the net: it falls, it
  // bounces, it rolls, it hits the back — and it never leaves through a wall.
  const m = noWhistle();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W - 30; b.y = BAR + 40; b.vx = 0; b.vy = 0;
  let minX = Infinity, maxY = -Infinity, everBounced = false;
  let lastVy = 0;
  for (let i = 0; i < 240; i++) {
    m.hitStop = 0;
    step(m, NONE, C.TICK, NO_FX);
    m.events.length = 0;
    minX = Math.min(minX, b.x);
    maxY = Math.max(maxY, b.y);
    if (lastVy > 40 && b.vy < -40) everBounced = true;
    lastVy = b.vy;
  }
  ok('the ball stays in the net it went into', b.x < C.GOAL_W, `x=${b.x.toFixed(1)}`);
  ok('it never gets behind the back of the net', minX >= C.BALL_R + C.POST_R - 0.01, `deepest x=${minX.toFixed(1)}`);
  ok('it obeys gravity down to the grass', maxY >= C.GROUND_Y - C.BALL_R - 0.5, `lowest y=${maxY.toFixed(1)}`);
  ok('it bounces on the floor of the net', everBounced);
  ok('it comes to rest ON the floor', Math.abs(b.y - (C.GROUND_Y - C.BALL_R)) < 1.5, `y=${b.y.toFixed(1)}`);
  ok('and it is still drawn between the nets while it sits there',
     depthZ(b.x, b.y) > NEAR_Z && depthZ(b.x, b.y) < FAR_Z, `z=${depthZ(b.x, b.y)}`);
}
{
  // The back of the room, hit hard, from both sides. It comes off the net and rolls back out
  // of the goal eventually — that is a ball, not a bug — so what is asserted is that it got
  // deep and that nothing ever let it through the rail.
  for (const left of [true, false]) {
    const m = noWhistle();
    clearThePitch(m);
    const b = m.ball;
    const box = goalBox(left);
    b.x = box.lineX - box.inward * 10; b.y = BAR + 30;
    b.vx = -box.inward * 900; b.vy = -200;
    let deepest = 0, through = 0;
    for (let i = 0; i < 200; i++) {
      m.hitStop = 0;
      step(m, NONE, C.TICK, NO_FX);
      m.events.length = 0;
      const depth = (box.lineX - b.x) * box.inward;                 // + is into the net
      deepest = Math.max(deepest, depth);
      if (depth > C.GOAL_W - C.POST_R - C.BALL_R + 0.01) through++;  // behind the back rail
    }
    const side = left ? 'left' : 'right';
    ok(`${side}: a ball fired at the back reaches it`, deepest > C.GOAL_W * 0.6, `${deepest.toFixed(1)}px in`);
    ok(`${side}: …and never gets through the back rail`, through === 0, `${through} ticks behind it`);
  }
}

// ═══ 4. THE FRAME IS STILL SOLID ═══════════════════════════════════════════
{
  // Straight down onto the crossbar: it may not drop through the roof of the net.
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W - 30; b.y = BAR - 80; b.vx = 0; b.vy = 700;
  run(m, 30);
  ok('a ball dropped on the crossbar does not fall through it', m.score[1] === 0, `score ${m.score}`);
  ok('…it is turned back above the bar', b.y < BAR, `y=${b.y.toFixed(1)}`);
}
{
  // The post is the corner of the mouth, and it is where a shot at bar height meets it.
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W + 120; b.y = BAR; b.vx = -900; b.vy = 0;
  run(m, 20);
  ok('a shot at bar height hits the frame instead of scoring', m.score[1] === 0, `score ${m.score}`);
}
{
  // And the ground is still the ground inside the net.
  const m = noWhistle();
  clearThePitch(m);
  const b = m.ball;
  b.x = 40; b.y = BAR + 20; b.vx = 0; b.vy = 0;
  run(m, 200);
  ok('the floor of the net holds the ball up', b.y <= C.GROUND_Y - C.BALL_R + 0.01, `y=${b.y.toFixed(1)}`);
}

// ═══ 5. A PLAYER CAN WALK IN ═══════════════════════════════════════════════
{
  const m = fresh();
  const p = m.players[0];
  run(m, 200, [{ left: true }, {}]);
  ok('a player crosses their own goal line', p.x < C.GOAL_W, `x=${p.x.toFixed(1)}`);
  ok('…and is stopped by the back of the net', p.x >= walkBounds(C.BODY_W, true).lo - 0.01, `x=${p.x.toFixed(1)}`);
  ok('…standing in the goal, not at it', p.x + C.BODY_W / 2 < C.GOAL_W, `x=${p.x.toFixed(1)}`);
  ok('a player in the net is drawn between the nets',
     depthZ(p.x, p.y) > NEAR_Z && depthZ(p.x, p.y) < FAR_Z, `z=${depthZ(p.x, p.y)}`);
  ok('…and their head is too', depthZ(p.x, headY(p)) > NEAR_Z);
}
{
  const m = fresh();
  const p = m.players[1];
  run(m, 200, [{}, { right: true }]);
  ok('the other goal is a room as well', p.x > C.W - C.GOAL_W, `x=${p.x.toFixed(1)}`);
  ok('…with a back to it', p.x <= walkBounds(C.BODY_W, true).hi + 0.01, `x=${p.x.toFixed(1)}`);
}
{
  // IN AND OUT, and no teleports anywhere along the way. A player who is walked into the net
  // and straight back out again must move in continuous steps: the old clamp plus the new
  // interior is exactly the shape of bug that shows up as a body jumping 80px sideways.
  //
  // No whistle for this one. A goal sends both players back to the spawn spots, which is a
  // 657px jump that is entirely correct and would swamp the thing being measured.
  const m = noWhistle();
  const p = m.players[0];
  let biggest = 0, last = p.x, deepest = Infinity;
  for (let i = 0; i < 400; i++) {
    const go = i < 200 ? { left: true } : { right: true };
    m.hitStop = 0;
    step(m, [go, {}], C.TICK, NO_FX);
    m.events.length = 0;
    biggest = Math.max(biggest, Math.abs(p.x - last));
    deepest = Math.min(deepest, p.x);
    last = p.x;
  }
  ok('the walk went all the way into the net', deepest < C.GOAL_W, `deepest x=${deepest.toFixed(1)}`);
  ok('walking in and out never teleports a player', biggest < C.PLAYER_SPEED * C.TICK * 2.6,
     `biggest step ${biggest.toFixed(1)}px`);
  ok('…and they end up back out on the pitch', p.x > C.GOAL_W + C.BODY_W / 2 - 0.01, `x=${p.x.toFixed(1)}`);
}
{
  // THE CROSSBAR IS A CEILING. Inside the net a jump stops at the bar instead of rising
  // through the frame — and this is the test that catches the teleport it would otherwise
  // cause, because a crown above the bar means the goal is solid again and the player would
  // be flung back out onto the pitch mid-jump.
  //
  // Held, not tapped. A tapped jump is cut short by JUMP_CUT and tops out 60px below the bar,
  // which is how the first version of this test passed while the bar was made of nothing.
  const m = fresh();
  const p = m.players[0];
  run(m, 200, [{ left: true }, {}]);
  const wentIn = p.x;
  let highest = p.y, escaped = 0;
  for (let i = 0; i < 120; i++) {
    m.hitStop = 0;
    step(m, [{ jump: true, left: true }, {}], C.TICK, NO_FX);
    m.events.length = 0;
    highest = Math.min(highest, p.y);
    if (p.x > C.GOAL_W) escaped++;
  }
  const crown = headY({ y: highest }) - C.HEAD_R;
  ok('a player jumping in the net stays under the bar', crown >= BAR + C.POST_R - 0.01,
     `crown ${crown.toFixed(1)} vs the bar's underside ${BAR + C.POST_R}`);
  ok('…and is never flung back out of the goal', escaped === 0, `${escaped} ticks outside`);
  ok('…and is still standing in the net afterwards', p.x < C.GOAL_W, `${wentIn.toFixed(1)} → ${p.x.toFixed(1)}`);
}
{
  // The roof is solid from the outside too: you cannot jump in over the post. Held at the apex
  // of a jump, level with the frame, driving at the goal.
  const m = fresh();
  const p = m.players[0];
  p.x = C.GOAL_W + C.BODY_W / 2 + 4;
  let inside = 0;
  for (let i = 0; i < 90; i++) {
    p.y = BAR + 10;                                     // crown well above the bar, held there
    p.vy = 0; p.onGround = false;
    m.hitStop = 0;
    step(m, [{ left: true }, {}], C.TICK, NO_FX);
    m.events.length = 0;
    if (p.x < C.GOAL_W + C.BODY_W / 2 - 0.01) inside++;
  }
  ok('a player above the bar cannot enter through the frame', inside === 0, `${inside} ticks inside`);
}
{
  // A mouth shorter than a player is not a room, and must not become one — the tuner can take
  // GOAL_H down to 90 against an 79px body, and a ceiling below the floor would wedge someone
  // under the pitch.
  C.tune({ GOAL_H: 90 });
  const m = fresh();
  const p = m.players[0];
  run(m, 200, [{ left: true }, {}]);
  const tall = C.GROUND_Y - (headY({ y: C.GROUND_Y }) - C.HEAD_R);
  const fits = barY() + tall <= C.GROUND_Y;
  ok('a goal too short to stand in is not entered', fits || p.x >= C.GOAL_W + C.BODY_W / 2 - 0.01,
     `x=${p.x.toFixed(1)} mouth ${C.GOAL_H} vs body ${tall}`);
  ok('…and nobody ends up under the pitch', p.y <= C.GROUND_Y + 0.01, `y=${p.y.toFixed(1)}`);
  C.tune({ GOAL_H: 144 });
}

// ═══ 6. THE CROSSBAR IS SOLID ══════════════════════════════════════════════
//
// Reported: "when my player jumps from directly underneath the crossbar, they pass right
// through it or get stuck inside the crossbar instead of bumping into it and falling back
// down." Both halves were true, and they were two sides of ONE boundary at x = 108 — the
// doorway threshold, which was the only place the bar existed at all:
//
//   x ≤ 107   the crown stopped at y=243, the bar's CENTRE, so the top of the head was buried
//             in a bar drawn 238..248            → "stuck inside the crossbar"
//   x ≥ 108   no bar whatsoever: the crown reached y=196, straight through it, and x=108..125
//             is directly under the drawn bar    → "passes right through it"
//
// The bar is now the capsule the ball has always bounced off (barCeiling in goalbox.js), so
// these numbers are the fence around both halves and around the cliff between them.
const UNDER = BAR + C.POST_R;                      // the underside of the bar: y=248
const CLEAR = C.HEAD_R + C.POST_R;                 // head centre to bar axis at contact: 35

// How far a head centre at (x, y) has punched into the bar. Positive means overlapping, and
// it is computed here from the capsule directly rather than from the code under test.
const intoBar = (x, y) => {
  const nl = Math.max(0, Math.min(x, C.GOAL_W));
  const nr = Math.max(C.W - C.GOAL_W, Math.min(x, C.W));
  return CLEAR - Math.min(Math.hypot(x - nl, y - BAR), Math.hypot(x - nr, y - BAR));
};
// Hold jump — not tap it. JUMP_CUT halves a tapped jump and it tops out 60px below the bar,
// which is exactly how a test can "pass" against a bar made of nothing.
const jumpAt = (x, held = 90) => {
  const m = noWhistle();
  const p = m.players[0];
  p.x = x; p.vx = 0;
  m.players[1].x = C.W * 0.55;
  let crown = Infinity, worst = -Infinity, biggest = 0, last = p.y, landed = false, rose = false;
  for (let i = 0; i < held; i++) {
    m.hitStop = 0;
    step(m, [{ jump: true }, {}], C.TICK, NO_FX);
    m.events.length = 0;
    crown = Math.min(crown, headY(p) - C.HEAD_R);
    worst = Math.max(worst, intoBar(p.x, headY(p)));
    biggest = Math.max(biggest, Math.abs(p.y - last));
    last = p.y;
    if (p.y < C.GROUND_Y - 1) rose = true;
    if (rose && i > 30 && p.onGround) landed = true;
  }
  return { crown, worst, biggest, landed, x: p.x };
};

// EVERYTHING BELOW RUNS ON A TUNED-UP JUMP, AND THAT IS THE POINT OF THE LAST BLOCK.
//
// The shipped JUMP_V is derived from GOAL_H now (see shared/constants.js) and deliberately
// stops a few pixels UNDER the bar, so a head never meets it in an ordinary match. Tested with
// that jump, every assertion in this section would pass against a crossbar made of nothing —
// which is exactly the bug the section exists to fence. So the bar is tested with a jump that
// reaches it: the one that would carry the crown a clear head ABOVE the bar if the capsule did
// not stop it. High enough for the bar to bite everywhere along its length, low enough that the
// step at the END of the bar is still a step rather than a cliff.
//
// The tuner can do this live at any time, which is the other reason barCeiling still has to be
// right: JUMP_V is a slider in public/game.js, range 400..1500.
const freeCrownJump = (crown) =>
  Math.sqrt(2 * C.PLAYER_GRAV * (C.GROUND_Y - crown - (C.BODY_H + C.HEAD_R * 2 - 8)));
const SHIPPED_JUMP = C.JUMP_V;
C.tune({ JUMP_V: freeCrownJump(BAR - C.HEAD_R) });
{
  // THE BUMP, from directly underneath. Standing in the middle of the net, holding jump.
  const r = jumpAt(C.GOAL_W - 45);
  ok('a jump under the bar stops AT the bar', Math.abs(r.crown - UNDER) < 0.51,
     `crown ${r.crown.toFixed(1)}, the underside is ${UNDER}`);
  ok('…not inside it', r.worst <= 0.01, `${r.worst.toFixed(2)}px into the bar`);
  ok('…and not through it', r.crown > BAR, `crown ${r.crown.toFixed(1)} vs bar ${BAR}`);
  ok('…then it falls back down to the grass', r.landed);
  ok('…without being teleported', r.biggest < 20, `biggest step ${r.biggest.toFixed(1)}px`);
  ok('…and stays in the goal it jumped in', r.x < C.GOAL_W, `x=${r.x.toFixed(1)}`);
}
{
  // EVERY SPOT UNDER THE BAR, both goals, and the far side of the post as well. The head may
  // never be inside the bar anywhere, and the reachable height has to grow SMOOTHLY as you
  // step away from the post — a cliff is what the old boundary was.
  for (const left of [true, false]) {
    const side = left ? 'left' : 'right';
    const box = goalBox(left);
    let worst = -Infinity, cliff = 0, cliffD = null, prev = null, at = '';
    for (let d = -(C.GOAL_W - C.POST_R); d <= 70; d += 2) {   // back of the net → 70px past the post
      const x = box.lineX + box.inward * d;                   // d > 0 is out on the pitch
      const r = jumpAt(x, 70);
      if (r.worst > worst) { worst = r.worst; at = `x=${x.toFixed(0)}`; }
      if (prev !== null && Math.abs(r.crown - prev) > cliff) { cliff = Math.abs(r.crown - prev); cliffD = d; }
      prev = r.crown;
    }
    ok(`${side}: a head is never inside the crossbar, anywhere along it`, worst <= 0.01,
       `worst ${worst.toFixed(2)}px in, at ${at}`);
    // THE ONE STEP LEFT, and it is the END OF THE BAR rather than an invented threshold. A
    // capsule's underside is still ~R below its axis right up to its last pixel, so clearing
    // the end hands back the whole free jump at once. A real head would slide off the end
    // instead, which this deliberately does not do — sliding means shoving the player
    // sideways mid-jump, a worse bug than the one being fixed. What matters is that the step
    // sits at the post, in a 2px band, and not at the doorway where 1px of ground used to be
    // worth 47px of height.
    ok(`${side}: the only step in reachable height is at the end of the bar`,
       cliffD !== null && Math.abs(cliffD - CLEAR) <= 2, `step at ${cliffD}px past the post, bar ends at ${CLEAR}`);
    ok(`${side}: …and it is smaller than the one that was reported`, cliff < 30,
       `${cliff.toFixed(1)}px, against 47px at the old doorway`);
  }
}
{
  // The two sides of the boundary that was reported. They used to differ by 47px of reachable
  // height across one pixel of ground; now they are neighbours. The boundary is the doorway —
  // where the old clamp put the edge of a body — so it is DERIVED, not the 107/108 it happened
  // to sit at while GOAL_W was 92. Typed in, it walked out onto open pitch the moment the goal
  // was resized and tested nothing at all.
  const DOORWAY = C.GOAL_W + C.BODY_W / 2;
  const inside = jumpAt(DOORWAY - 1), outside = jumpAt(DOORWAY);
  ok('the doorway is no longer a cliff in the ceiling', Math.abs(inside.crown - outside.crown) < 2,
     `x=${DOORWAY - 1} reaches ${inside.crown.toFixed(1)}, x=${DOORWAY} reaches ${outside.crown.toFixed(1)}`);
  ok('…and neither of them is through the bar', inside.crown > BAR && outside.crown > BAR - CLEAR,
     `${inside.crown.toFixed(1)} / ${outside.crown.toFixed(1)}`);
}
{
  // THE BAR ENDS. Past the post a jump is a jump again — this is the guard against "fixed" by
  // nerfing every jump on the pitch, and it is what keeps a defender able to meet a lob.
  const far = jumpAt(C.W / 2);
  const past = jumpAt(C.GOAL_W + CLEAR + 4);
  // "Untouched" means the free jump is well clear of the bar's height, so a clamp would show.
  // A clear head above it, in the game's own units — it used to be a bare 40px, which was a
  // sixth of the old goal and a quarter of this one.
  ok('a jump out on the pitch is untouched', far.crown < BAR - C.HEAD_R, `crown ${far.crown.toFixed(1)}`);
  ok('…and so is one a head clear of the post', Math.abs(past.crown - far.crown) < 0.51,
     `${past.crown.toFixed(1)} vs ${far.crown.toFixed(1)}`);
  ok('the bar reaches exactly a head past the post', barCeiling(C.GOAL_W + CLEAR + 0.01, C.HEAD_R) === -Infinity);
  ok('…and not one pixel further', barCeiling(C.GOAL_W + CLEAR - 0.01, C.HEAD_R) > BAR);
}
{
  // A BIGGER HEAD MEETS IT SOONER, which is only true because the real head radius is passed
  // in rather than the nominal one being assumed.
  const nominal = barCeiling(C.GOAL_W - 20, C.HEAD_R);
  const grown = barCeiling(C.GOAL_W - 20, C.HEAD_R * 1.6);
  ok('a grown head is stopped lower by the bar', grown > nominal, `${grown.toFixed(1)} vs ${nominal.toFixed(1)}`);
  ok('…by exactly how much bigger it is', Math.abs((grown - nominal) - C.HEAD_R * 0.6) < 1e-9);
  ok('the ceiling is the bar underside plus the head', Math.abs(nominal - (BAR + C.POST_R + C.HEAD_R)) < 1e-9,
     `${nominal.toFixed(1)}`);
}
{
  // Jumping under the bar must not become a way THROUGH the goal line either: the doorway and
  // the ceiling have to agree, or a player bounces between them.
  const m = noWhistle();
  const p = m.players[0];
  run(m, 200, [{ left: true }, {}]);
  let out = 0, biggest = 0, last = p.x;
  for (let i = 0; i < 200; i++) {
    m.hitStop = 0;
    step(m, [{ jump: true, left: i % 2 === 0, right: i % 2 === 1 }, {}], C.TICK, NO_FX);
    m.events.length = 0;
    if (p.x > C.GOAL_W + C.BODY_W) out++;
    biggest = Math.max(biggest, Math.abs(p.x - last));
    last = p.x;
  }
  ok('jumping against the bar never flings a player out of the net', out === 0, `${out} ticks outside`);
  ok('…and never teleports them sideways', biggest < C.PLAYER_SPEED * C.TICK * 2.6,
     `biggest step ${biggest.toFixed(1)}px`);
}
C.tune({ JUMP_V: SHIPPED_JUMP });
{
  // AND THE SHIPPED JUMP DOES NOT REACH THE BAR. This is the rule the goal was resized around:
  // a defender can get their head nearly to the crossbar and never over it, so the mouth is
  // never fully covered by standing in it and jumping. Both numbers are derived — JUMP_V from
  // GOAL_H — so if either drifts this is where it shows, and everything above it turns back
  // into a test of gameplay rather than of a guard rail.
  const r = jumpAt(C.GOAL_W - 45);
  ok('the shipped jump stops short of the bar', r.crown > UNDER,
     `crown ${r.crown.toFixed(1)}, the underside is ${UNDER}`);
  ok('…without ever touching it', r.worst <= 0.01, `${r.worst.toFixed(2)}px into the bar`);
  ok('…but close enough to be worth doing', r.crown < BAR + C.HEAD_R,
     `crown ${r.crown.toFixed(1)} vs a bar at ${BAR}`);
}

// ═══ 6. THE RULES STILL WORK WITH SOMEONE STANDING IN THE NET ══════════════
{
  // A keeper standing in their goal saves — the ball has to hit them, not pass through the
  // room they are in.
  const m = fresh();
  const p = m.players[1];
  p.x = C.W - C.GOAL_W - 4; p.y = C.GROUND_Y;
  m.players[0].x = C.W * 0.5;
  const b = m.ball;
  b.x = C.W - C.GOAL_W - 140; b.y = C.GROUND_Y - 30; b.vx = 700; b.vy = 0;
  run(m, 40);
  ok('a body in the mouth still blocks a shot', m.score[0] === 0, `score ${m.score}`);
}
{
  // …and a ball that gets past one still counts. Same shot, keeper out of the way.
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.W - C.GOAL_W - 140; b.y = C.GROUND_Y - 30; b.vx = 700; b.vy = 0;
  run(m, 40);
  ok('and a shot nobody blocks is a goal', m.score[0] === 1, `score ${m.score}`);
  ok('a goal still restarts the match', m.phase === 'goal' && Math.abs(m.players[0].x - C.SPAWN_X[0]) < 1);
}
{
  // Half over the line is still not a goal, with the room open. This is the assertion the
  // interior is most likely to have broken — if the ball could be "in" by being in the box
  // rather than by being past the line, every scramble on the line would score.
  const m = fresh();
  clearThePitch(m);
  const b = m.ball;
  b.x = C.GOAL_W - C.BALL_R + 2; b.y = C.GROUND_Y - C.BALL_R; b.vx = 0; b.vy = 0;
  run(m, 10);
  ok('a ball straddling the line still does NOT score', m.score[1] === 0,
     `x=${b.x.toFixed(1)} line=${C.GOAL_W}`);
}

console.log(`test-goal: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
