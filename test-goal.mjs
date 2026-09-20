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
         ballInGoal, keepOutOfGoal, NEAR_Z, FAR_Z, INSIDE_Z } from './shared/goalbox.js';

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

// ═══ 7. A SLOW BALL DOES NOT GET LAUNCHED OFF THE CROSSBAR ═════════════════
//
// Reported: a ball drifting down onto the roof of the net would, for a slow ball only,
// eventually behave as if the crossbar were not there — a fast ball always bounced fine,
// which is what points at the "settle" branch rather than the collision test itself.
//
// bounceOffCrossbar will not let a ball come to REST on the bar: anything slow enough to
// settle gets a sideways nudge so it rolls off (the comment above it tells the story of the
// match that hung on a ball parked at (939, 215)). That nudge fires on every tick the ball is
// still touching the bar, and it used to ADD 70px/s each time rather than topping the ball up
// to that speed. A ball weakly bouncing on the bar — restitution 0.72 bleeding a little energy
// out of it on each contact — calls that nudge on every one of ten-odd consecutive ticks
// before it finally clears bar height, and `+=` stacked all of them: a ball that should roll
// off at a sedate 70px/s instead left carrying a hundred-plus, fast enough to cross the whole
// depth of the goal and reach the post before its own capture radius (b.r + POST_R) could
// still catch it. From the outside that reads exactly as reported: the ball was near the bar,
// and then it was just gone, as if there were no collider — not a straight fall through the
// roof (the ball is still above bar height when it escapes; PART 2 below is the direct check
// for that), but a launch no real collision ever produces.
//
// This is independent of goal size — it reproduces identically against the goal's own current
// GOAL_W/GOAL_H, because it was never about how wide the goal is, only about how many ticks a
// settling ball spends touching the bar, which every goal size produces.
{
  // PART 1 — THE SYMPTOM. Measure the fastest sideways speed the ball is EVER carrying while
  // still in contact with the bar. One nudge tops it up to 70px/s; anything meaningfully past
  // that is the old bug's accumulation showing up again.
  const contactSpeeds = (x, vy0, ticks = 80) => {
    const m = noWhistle();
    clearThePitch(m);
    const b = m.ball;
    b.x = x; b.y = barY() - 40; b.vx = 0; b.vy = vy0;
    const min = C.BALL_R + C.POST_R;
    let sawContact = false, worst = 0;
    for (let i = 0; i < ticks; i++) {
      m.hitStop = 0;
      step(m, [{}, {}], C.TICK, NO_FX);
      const nearestLeft = Math.max(0, Math.min(b.x, C.GOAL_W));
      const nearestRight = Math.max(C.W - C.GOAL_W, Math.min(b.x, C.W));
      const d = Math.min(Math.hypot(b.x - nearestLeft, b.y - barY()),
                          Math.hypot(b.x - nearestRight, b.y - barY()));
      if (d < min + 0.5) { sawContact = true; worst = Math.max(worst, Math.abs(b.vx)); }
    }
    return { sawContact, worst };
  };
  for (const [label, x, vy0] of [
    ['centre of the left goal', C.GOAL_W / 2, 40],
    ['barely reaching the bar at all', C.GOAL_W / 2, 5],
    ['settling close to the post', C.GOAL_W - 10, 40],
    ['the mirrored right goal', C.W - C.GOAL_W / 2, 40],
  ]) {
    const r = contactSpeeds(x, vy0);
    ok(`(the ball actually touched the bar — ${label})`, r.sawContact);
    ok(`a slow ball settling on the bar is never launched sideways — ${label}`, r.worst < 90,
       `fastest sideways speed seen at the bar: ${r.worst.toFixed(1)}px/s`);
  }
  // The fast case is the control: it never had this problem (one hard bounce, gone), and it
  // stays here so a future change that breaks it shows up in the same section as the fix.
  const fastCase = contactSpeeds(C.GOAL_W / 2, 900, 20);
  ok('a fast ball is unaffected, as it always was', fastCase.worst < 90,
     `fastest sideways speed seen at the bar: ${fastCase.worst.toFixed(1)}px/s`);
}
{
  // PART 2 — THE INVARIANT ITSELF, whatever ends up producing a fast ball near the bar: no
  // ball may end up BELOW the roof while still squarely under the SPAN of the bar (clear of
  // either post's own corner, which is a doorway and is supposed to be open — see sections
  // 1-6). If this ever fails, a ball is going through solid roof rather than around a post.
  const staysAboveTheRoof = (x, vy0, ticks = 500) => {
    const m = noWhistle();
    clearThePitch(m);
    const b = m.ball;
    b.x = x; b.y = barY() - 60; b.vx = 0; b.vy = vy0;
    const min = C.BALL_R + C.POST_R;
    let breached = false;
    for (let i = 0; i < ticks; i++) {
      m.hitStop = 0;
      step(m, [{}, {}], C.TICK, NO_FX);
      const underLeftSpan = b.x > C.POST_R + 1 && b.x < C.GOAL_W - C.POST_R - 1;
      const underRightSpan = b.x > C.W - C.GOAL_W + C.POST_R + 1 && b.x < C.W - C.POST_R - 1;
      if ((underLeftSpan || underRightSpan) && b.y > barY() + min + 2) breached = true;
    }
    return { breached, x: b.x, y: b.y };
  };
  for (const [label, x, vy0] of [
    ['slow, centre of mouth', C.GOAL_W / 2, 40],
    ['very slow, centre of mouth', C.GOAL_W / 2, 5],
    ['slow, near the post', C.GOAL_W - 10, 40],
    ['fast, centre of mouth', C.GOAL_W / 2, 900],
  ]) {
    const r = staysAboveTheRoof(x, vy0);
    ok(`no ball ends up under the roof of the net — ${label}`, !r.breached,
       `ended at x=${r.x.toFixed(1)} y=${r.y.toFixed(1)}`);
  }
}

// ═══ 8. THE ROOF IS SOLID EVERYWHERE IT IS DRAWN ═══════════════════════════
//
// Reported, twice, and the second time after a fix that was not this one: "you can see the top
// right of the goal but the ball falls down through it like it's nothing."
//
// The goal is DRAWN as a box. Its far frame steps `wx` toward the middle of the pitch and `wy`
// up the screen, so the crossbar leaves the near post and recedes — the roof reaches 40% of the
// goal's own depth further out over the pitch than the near rail does. The sim had only the
// near rail: flat, ending dead on the goal line. Every pixel of roof past that line was a
// picture with nothing behind it, an 18px-wide hole once the ball's radius is taken off, and a
// ball dropped into it fell through the frame.
//
// These sweep the band the renderer actually draws, taken from the renderer's own goalBox, so
// the fence moves if the projection ever does.
const overhang = (left) => {
  const box = goalBox(left);
  return { box, from: box.lineX, to: box.lineX + box.wx, topY: box.top + box.wy };
};
// Straight down from well above the roof. Something has to turn it back before it is clear
// under the bar line — that "something" is the only thing being asserted.
const dropAt = (sx, fromY) => {
  const m = noWhistle();
  clearThePitch(m);
  const b = m.ball;
  b.x = sx; b.y = fromY; b.vx = 0; b.vy = 80;
  for (let i = 0; i < 120; i++) {
    m.hitStop = 0;
    step(m, [{}, {}], C.TICK, NO_FX);
    if (b.vy < 0) return true;                                   // turned back: the roof held
    if (b.y - b.r > barY() + C.POST_R + 4) return false;         // clear under the bar: a hole
  }
  return false;
};
{
  for (const left of [true, false]) {
    const { from, to, topY } = overhang(left);
    const lo = Math.min(from, to), hi = Math.max(from, to);
    const holes = [];
    for (let sx = lo; sx <= hi; sx += 1) if (!dropAt(sx, topY - 70)) holes.push(Math.round(sx));
    ok(`${left ? 'left' : 'right'}: the ball cannot fall through the roof the renderer draws`,
       holes.length === 0,
       holes.length ? `falls through at screen x ${holes[0]}..${holes[holes.length - 1]} (${holes.length}px)` : `swept x ${Math.round(lo)}..${Math.round(hi)}`);
  }
}
{
  // …AND THE ROOF IS OPEN FROM UNDERNEATH, which is the half that is easy to get wrong. Made
  // two-sided, this segment is a ramp leaning out over the pitch whose underside slopes down
  // toward the goal: a shot driven flat along bar height met it ~20px BEFORE the post and was
  // steered in. The ball is played on the near plane and the segment is the bar receding away
  // from that plane, so a ball level with it passes in FRONT of it and goes on to meet the
  // post, exactly as it did before any of this. Both goals, right through the overhang band.
  for (const left of [true, false]) {
    const { from, to } = overhang(left);
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    const outside = left ? Math.max(from, to) + 60 : Math.min(from, to) - 60;
    b.x = outside; b.y = barY(); b.vx = left ? -900 : 900; b.vy = 0;
    run(m, 25);
    ok(`${left ? 'left' : 'right'}: a flat shot at bar height is still turned away, not funnelled in`,
       m.score[left ? 1 : 0] === 0, `score ${m.score}`);
  }
}
{
  // THE MOUTH IS EXACTLY AS BIG AS IT WAS. The roof edge lives entirely above the crossbar
  // (wy is negative — the far side steps UP), and the mouth is everything below it, so adding
  // it must not cost a single pixel of opening. Every height from the grass to the underside
  // of the bar, both goals, has to still score.
  const scoresAt = (left, y) => {
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = left ? C.GOAL_W + 200 : C.W - C.GOAL_W - 200;
    b.y = y; b.vx = left ? -700 : 700; b.vy = 0; b.spin = 0;
    run(m, 200);
    return m.score[0] + m.score[1] > 0;
  };
  for (const left of [true, false]) {
    const missed = [];
    for (let y = C.GROUND_Y - C.BALL_R; y >= barY() + C.BALL_R; y -= 3) {
      if (!scoresAt(left, y)) missed.push(Math.round(y));
    }
    ok(`${left ? 'left' : 'right'}: every height under the bar still scores`, missed.length === 0,
       missed.length ? `${missed.length} heights blocked: ${missed.slice(0, 8).join(', ')}` : 'nothing blocked');
  }
}

// ═══ 9. A GOAL IS A CROSSING, NOT A PLACE ══════════════════════════════════
//
// Reported: "sometimes when the ball hits a player near the goal it sticks to them for a
// moment and it counts as a goal, even though the ball never went in."
//
// It did not go in. It was PUT in. Every ball-versus-player response in the sim re-places the
// ball, and the biggest of them is the header's: tryHeader snaps the ball to a fixed offset on
// the side of the head the header is aimed at, so a ball 50px in FRONT of a player can be set
// down 44px BEHIND them — a hundred-pixel jump, through the player and through whatever else
// is in the way. Stand a yard off the goal line and head at it and "whatever else" is the post.
//
// (The scenario used to be built the other way round: a defender FACING his own net, heading
// backwards into it. The boot and the header both go toward the goal you attack now, whatever
// direction you are facing, so the geometry is the same picture reflected — an attacker on the
// line heading in — and it fences the same snap.)
// checkGoal only ever asked WHERE the ball was, so the frame after the snap it found a ball
// behind the line and moved the scoreboard. Measured over 120 bot-vs-bot matches before the
// fix: 28 of 453 goals — one in sixteen — arrived that way, some from balls headed UP and away
// from the goal, one of them from a ball set down at x = −19, behind the back of the pitch.
//
// Two halves to the fix, and this section fences both:
//   · enteredGoal (shared/sim.js) makes the goal a CROSSING — outside the opening, then inside
//     it, moving into that net — measured on the ball's own travel and read BEFORE the players
//     are asked, so no contact can award a goal.
//   · keepOutOfGoal (shared/goalbox.js) stops the big re-placements at the line, so a ball
//     cannot be left sitting in a net it is not allowed to have scored in.
//
// Everything here runs on BOTH goals. The two nets are one piece of code reflected, and a rule
// that only holds at one end is a rule that does not hold.
{
  const LINE = (left) => (left ? C.GOAL_W : C.W - C.GOAL_W);
  const OUT = (left) => (left ? 1 : -1);          // from the goal line towards the pitch
  const CONCEDER = (left) => (left ? 0 : 1);      // whose net this is
  const SCORER = (left) => (left ? 1 : 0);        // …and who therefore scores in it
  const side = (left) => (left ? 'left' : 'right');

  // Hold a player at a spot for the whole experiment. Standing still is not the same as being
  // parked: gravity, the ground clamp and separatePlayers all still run, and a player who
  // drifts a pixel a tick is not the player the test placed.
  const pin = (p, x) => { p.x = x; p.y = C.GROUND_Y; p.vx = 0; p.vy = 0; p.onGround = true; };

  // ---- the bug itself: a header from right on top of the goal line --------
  for (const left of [true, false]) {
    // Held at kickoff so the scorer is switched off and the PLACEMENT can be read directly —
    // this asks where the snap put the ball, not what the scoreboard did about it.
    const m = noWhistle();
    const d = m.players[SCORER(left)], other = m.players[CONCEDER(left)];
    pin(other, C.W / 2);
    // 25px out: close enough that the raw snap (headR + BALL_R + 2 = 44px the other way) lands
    // the WHOLE ball behind the line. That is the geometry the bug needed, and it is the
    // geometry a defender clearing their line is actually in.
    pin(d, LINE(left) + OUT(left) * 25);          // on the pitch, a yard off the line
    // No facing is set: it no longer decides anything here. The header goes at the goal this
    // player attacks, which is the one they are standing on top of. The ball sits IN FRONT of
    // that attack, 20px closer to the line than the player — the shape a real turning header
    // near the mouth is actually in — never behind (see the "no teleport" block below for what
    // happens then).
    d.prev = {};
    const b = m.ball;
    b.x = d.x - OUT(left) * 20; b.y = headY(d); b.vx = 0; b.vy = 0;   // at their head
    const raw = d.x - OUT(left) * (C.HEAD_R + b.r + 2);
    ok(`${side(left)}: (the unclamped snap really would have been in the net)`,
       !!ballInGoal(raw, headY(d) - (C.HEAD_R + b.r) * 0.35, b.r), `raw snap x=${raw.toFixed(1)}`);
    // Stepped with a dt of nothing, so the tick is all stepPlayer and no ball travel: what is
    // read below is the SNAP, on its own, before the header's own velocity has moved the ball
    // a pixel. (A full tick cannot answer this. The snap leaves the ball on the line and the
    // shot then carries it over inside the same tick — correctly, because that is a goal the
    // player chose to head — so a full tick shows a ball in the net either way. What the fix
    // changes is whether it got there by crossing the line or by being put behind it.)
    const input = [{}, {}]; input[d.index] = { kick: true };
    m.hitStop = 0;
    step(m, input, 1e-6, NO_FX);
    ok(`${side(left)}: the header fired`, m.events.some((e) => e.type === 'strike' && e.aimed),
       JSON.stringify(m.events));
    ok(`${side(left)}: a header does not snap the ball through the post`,
       !ballInGoal(b.x, b.y, b.r), `ball at ${b.x.toFixed(1)}, line ${LINE(left)}`);
    ok(`${side(left)}: …it is set down exactly on the line`,
       Math.abs((b.x + OUT(left) * b.r) - LINE(left)) < 0.05 && !ballInGoal(b.x, b.y, b.r),
       `ball at ${b.x.toFixed(3)}`);
  }

  // ---- no header ever crosses the body: a ball BEHIND the attack does not fire one ---------
  //
  // Reported: the ball teleporting from behind a player to in front of them, fast, at head
  // height. That was this exact header: it always launches toward `dir` and always re-places
  // the ball out in front of the head on that side, whichever side the ball actually struck
  // from. A ball 20px behind `dir` has nowhere to go but through the player's own silhouette to
  // land there, and that crossing is what read as a teleport. A header may no longer fire on a
  // ball that starts behind the attack at all — the passive head touch two branches down still
  // answers the press with a normal bounce, just without the forward launch or the reach-around.
  for (const left of [true, false]) {
    const m = noWhistle();
    const d = m.players[SCORER(left)], other = m.players[CONCEDER(left)];
    pin(other, C.W / 2);
    pin(d, C.W / 2);
    d.prev = {};
    const b = m.ball;
    // 20px BEHIND the attack direction — the same magnitude the section above puts in front.
    b.x = d.x + OUT(left) * 20; b.y = headY(d); b.vx = 0; b.vy = 0;
    const beforeX = b.x;
    const input = [{}, {}]; input[d.index] = { kick: true };
    m.hitStop = 0;
    step(m, input, 1e-6, NO_FX);
    ok(`${side(left)}: no aimed header fires on a ball behind the attack`,
       !m.events.some((e) => e.type === 'strike' && e.aimed), JSON.stringify(m.events));
    // The passive head touch still answers the contact — a normal bounce off the surface it
    // actually hit, not the header's forward launch — and that alone may move the ball a few
    // px. What it may never do is put the ball down on the OTHER side of the player: that flip
    // is the teleport, whatever pushed it.
    ok(`${side(left)}: …and the ball is not snapped across the player`,
       Math.sign(b.x - d.x) === Math.sign(beforeX - d.x),
       `moved from ${beforeX.toFixed(1)} to ${b.x.toFixed(1)}, player at ${d.x.toFixed(1)}`);
  }
  {
    // keepOutOfGoal itself, at the two ends and in the three cases it distinguishes.
    const y = C.GROUND_Y - 40, r = C.BALL_R;
    const stopL = keepOutOfGoal(C.GOAL_W + 50, y, C.GOAL_W - 50, y, r);
    const stopR = keepOutOfGoal(C.W - C.GOAL_W - 50, y, C.W - C.GOAL_W + 50, y, r);
    ok('a jump into the left net is stopped with the ball ON the line',
       Math.abs((stopL + r) - C.GOAL_W) < 0.05 && !ballInGoal(stopL, y, r), `x=${stopL}`);
    ok('a jump into the right net is stopped with the ball ON the line',
       Math.abs((stopR - r) - (C.W - C.GOAL_W)) < 0.05 && !ballInGoal(stopR, y, r), `x=${stopR}`);
    ok('a jump that stays on the pitch is left alone',
       keepOutOfGoal(400, y, 300, y, r) === 300);
    ok('and a contact INSIDE the net is left alone — a keeper may clear his own line',
       keepOutOfGoal(30, y, 20, y, r) === 20);
    ok('nothing is clamped above the bar, where there is no mouth',
       keepOutOfGoal(C.GOAL_W + 50, barY() - 50, 20, barY() - 50, r) === 20);
  }
  for (const left of [true, false]) {
    // The same header, with the whistle on. It is still a goal — the shot tryHeader just set
    // carries the ball over the line under its own steam — so the fix must not have cost the
    // goal, only the teleport.
    const m = fresh();
    const d = m.players[SCORER(left)];
    pin(m.players[CONCEDER(left)], C.W / 2);
    pin(d, LINE(left) + OUT(left) * 25);
    d.prev = {};
    const b = m.ball;
    b.x = d.x - OUT(left) * 20; b.y = headY(d); b.vx = 0; b.vy = 0;
    run(m, 30, (i) => { const inp = [{}, {}]; if (i === 0) inp[d.index] = { kick: true }; return inp; });
    ok(`${side(left)}: a header from on top of the line still scores`,
       m.score[SCORER(left)] === 1, `score ${m.score}`);
  }

  // ---- 1. touching the ball beside the goal is not scoring ----------------
  for (const left of [true, false]) {
    // A player stood beside the post with the ball driven onto them. The ball is level with
    // the mouth and a body-width from the line: every frame of this is a contact, and not one
    // of them is a goal.
    const m = fresh();
    const keeper = m.players[CONCEDER(left)];
    pin(m.players[SCORER(left)], C.W / 2);
    const at = LINE(left) + OUT(left) * (C.BODY_W / 2 + 6);
    const b = m.ball;
    b.x = at + OUT(left) * 120; b.y = C.GROUND_Y - 40; b.vx = -OUT(left) * 420; b.vy = 0;
    run(m, 90, () => { pin(keeper, at); return NONE; });
    ok(`${side(left)}: a player touching the ball beside the goal does not score`,
       m.score[0] + m.score[1] === 0, `score ${m.score} ball x=${b.x.toFixed(1)}`);
  }

  // ---- 2. a ball that sticks to a player beside the goal is not scoring ---
  for (const left of [true, false]) {
    // The torso DEADENS: a ball run into it drops at the player's feet and stays with them,
    // which is the "sticks to the player" in the report. Three seconds of it, right beside the
    // post, has to leave the scoreboard where it was.
    const m = fresh();
    const keeper = m.players[CONCEDER(left)];
    pin(m.players[SCORER(left)], C.W / 2);
    const at = LINE(left) + OUT(left) * (C.BODY_W / 2 + 2);
    const b = m.ball;
    b.x = at - OUT(left) * (C.BODY_W / 2 + b.r - 3);       // already half inside the torso
    b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
    let touching = 0;
    run(m, ticks(3), () => { pin(keeper, at); return NONE; });
    for (let i = 0; i < ticks(3); i++) {
      pin(keeper, at);
      m.hitStop = 0;
      step(m, NONE, C.TICK, NO_FX);
      if (Math.abs(b.x - keeper.x) < C.BODY_W / 2 + b.r + 1) touching++;
      m.events.length = 0;
    }
    ok(`${side(left)}: a ball stuck to a player beside the goal does not score`,
       m.score[0] + m.score[1] === 0, `score ${m.score} ball x=${b.x.toFixed(1)}`);
    ok(`${side(left)}: (and it really was stuck to them)`, touching > ticks(2),
       `${touching} of ${ticks(3)} ticks in contact`);
  }

  // ---- 3. a ball through the mouth scores, exactly once -------------------
  for (const left of [true, false]) {
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) + OUT(left) * 150; b.y = C.GROUND_Y - 50;
    b.vx = -OUT(left) * 700; b.vy = 0;
    const seen = run(m, 120);
    const goals = seen.filter((e) => e.type === 'goal');
    ok(`${side(left)}: a ball through the mouth scores`, m.score[SCORER(left)] === 1, `score ${m.score}`);
    ok(`${side(left)}: …and scores ONCE`, goals.length === 1 && m.score[0] + m.score[1] === 1,
       `${goals.length} goal events, score ${m.score}`);
  }

  // ---- 4. near the goal but outside the opening is not scoring ------------
  for (const left of [true, false]) {
    // Rolled along the ground straight at the post, at a height that is under the bar but on
    // the wrong side of the line. It rattles, it sits there, it is not a goal.
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) + OUT(left) * (b.r + 1); b.y = C.GROUND_Y - b.r;
    b.vx = OUT(left) * 40; b.vy = 0;                      // drifting AWAY from the net
    run(m, 120);
    ok(`${side(left)}: a ball beside the goal, never in it, does not score`,
       m.score[0] + m.score[1] === 0, `score ${m.score} ball x=${b.x.toFixed(1)}`);
  }
  for (const left of [true, false]) {
    // Over the bar: past the line in x, but above the opening. The arena wall is what it meets.
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) + OUT(left) * 150; b.y = barY() - b.r - 20;
    b.vx = -OUT(left) * 700; b.vy = 0;
    run(m, 60);
    ok(`${side(left)}: a ball over the bar does not score`, m.score[0] + m.score[1] === 0, `score ${m.score}`);
  }

  // ---- 5. the frame is not a way in --------------------------------------
  for (const left of [true, false]) {
    // Driven flat AT bar height: it meets the frame, and the frame is not a doorway. Same
    // geometry test-sim fences at the left goal; here it is both ends.
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) + OUT(left) * 90; b.y = barY();
    b.vx = -OUT(left) * 700; b.vy = 0;
    run(m, 60);
    ok(`${side(left)}: a shot onto the post/bar does not score`, m.score[0] + m.score[1] === 0, `score ${m.score}`);
  }
  for (const left of [true, false]) {
    // Dropped onto the roof of the net, between the post and the back.
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) - OUT(left) * (C.GOAL_W / 2); b.y = barY() - b.r - C.POST_R - 4;
    b.vx = 0; b.vy = 700;
    run(m, 90);
    ok(`${side(left)}: a ball dropped on the crossbar does not score`,
       m.score[0] + m.score[1] === 0, `score ${m.score}`);
  }

  // ---- 6. symmetry -------------------------------------------------------
  {
    // The same shot at each net, mirrored, has to give the same answer at the same moment.
    const when = (left) => {
      const m = fresh();
      clearThePitch(m);
      const b = m.ball;
      b.x = LINE(left) + OUT(left) * 150; b.y = C.GROUND_Y - 50;
      b.vx = -OUT(left) * 700; b.vy = 0;
      const seen = run(m, 120);
      const g = seen.find((e) => e.type === 'goal');
      return g ? { tick: g.i, player: g.player } : null;
    };
    const L = when(true), R = when(false);
    ok('both goals score on the same tick from the mirrored shot',
       L && R && L.tick === R.tick, `left ${JSON.stringify(L)} right ${JSON.stringify(R)}`);
    ok('…and each credits the player attacking that net', L?.player === 1 && R?.player === 0,
       `left ${L?.player} right ${R?.player}`);
  }

  // ---- 7. a goal still restarts the match --------------------------------
  for (const left of [true, false]) {
    const m = fresh();
    clearThePitch(m);
    const b = m.ball;
    b.x = LINE(left) + OUT(left) * 150; b.y = C.GROUND_Y - 50;
    b.vx = -OUT(left) * 700; b.vy = 0;
    run(m, 120);
    ok(`${side(left)}: the goal freezes play`, m.phase === 'goal' && m.freeze > 0, `phase ${m.phase}`);
    ok(`${side(left)}: both players go back to the spot`,
       Math.abs(m.players[0].x - C.SPAWN_X[0]) < 1 && Math.abs(m.players[1].x - C.SPAWN_X[1]) < 1);
    ok(`${side(left)}: and the ball goes back to the middle`,
       Math.abs(b.x - C.BALL_SPAWN.x) < 1 && Math.abs(b.y - C.BALL_SPAWN.y) < 1,
       `ball at ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
  }
}

console.log(`test-goal: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
