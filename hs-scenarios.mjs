// Scripted scenarios for the Head Soccer parity harness (test-hs-parity.mjs).
//
// Each scenario is one of the clips on the shot list (C1, C2, C3, C5, C7, C8 — see the plan),
// re-enacted in OUR sim: build a match with createMatch, put the ball and bodies where the
// clip starts, feed a scripted input per tick, and record what a camera would have seen.
//
// The output is deliberately the SAME shape the video tracker (tools/hs-measure) writes to
// docs/hs-clips/*.tracks.json:
//   { frames: [{ i, t, ball: {x, y, r}, p0: {x, y}, p1: {x, y} }], tags: [{ i, t, type }] }
// y down, world units, t in seconds. The player point is the HEAD CENTRE, because the head
// is what the tracker follows on video. Keeping one shape is the point of the exercise: the
// same fit then runs over both sides, and "sim vs reference" is never "our number vs a
// number computed some other way".
//
// Tags come from the sim's own events where it has one (jump, dash, kick, strike) plus
// ones a tracker would tag by eye (ready, bounce, land). Nothing here changes gameplay:
// every scenario reads the sim exactly as it ships, at whatever C.HS says.

import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';

const CHAR_A = { rarity: 'legendary', number: 3 };
const CHAR_B = { rarity: 'legendary', number: 2 };

// Past the kickoff freeze, ball still, both players parked at spawn. Most clips begin from a
// standstill in open play; C1 ('drop') is the one that wants the real kickoff and skips this.
function openPlay(m) {
  m.freeze = 0; m.phase = 'play';
  const b = m.ball;
  b.vx = 0; b.vy = 0; b.spin = 0;
  return m;
}

// Park the ball where it cannot interfere: resting on the grass against the right wall,
// behind player 1. For scenarios that are about a body, not the ball.
function parkBall(m) {
  const b = m.ball;
  b.x = C.W - b.r - 1; b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
}

// The ball resting on the grass right at player 0's boot, where a kick meets it. 45px out
// from the body's centre: any closer (~35 and in) and today's sim reads the press as a
// header off the body rather than a kick — itself a finding for C7.
function ballAtBoot(m) {
  const p = m.players[0], b = m.ball;
  b.x = p.x + p.facing * 45;
  b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
}

// name -> { clip, ticks, setup(m), input(tick) -> player 0's input }
export const SCENARIOS = {
  // C1: stand still at kickoff, touch nothing. Ready time, ball spawn and drift, gravity,
  // bounce decay, roll.
  drop: { clip: 'C1', ticks: 360, setup: () => {}, input: () => ({}) },
  // C2: run across from standstill, then release. Accel, top speed, stopping.
  run: {
    clip: 'C2', ticks: 150,
    setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i < 60 ? { right: true } : {}),
  },
  // C3: a tap jump (one tick of JUMP) and a held one (held to landing).
  jumpTap: {
    clip: 'C3', ticks: 90,
    setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i === 5 ? { jump: true } : {}),
  },
  jumpHold: {
    clip: 'C3', ticks: 110,
    setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i >= 5 && i < 95 ? { jump: true } : {}),
  },
  // C5: double-tap right (down, up, down inside DASH_WINDOW), then hold.
  dash: {
    clip: 'C5', ticks: 90,
    setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i >= 5 && i < 7) || (i >= 10 && i < 40) ? { right: true } : {},
  },
  // C7a: ball resting at the boot, press kick once.
  kickFeet: {
    clip: 'C7', ticks: 120,
    setup: (m) => { openPlay(m); ballAtBoot(m); },
    input: (i) => (i === 5 ? { kick: true } : {}),
  },
  // C8: stand under a dropping ball, touch nothing. Head springiness.
  headDrop: {
    clip: 'C8', ticks: 150,
    setup: (m) => {
      openPlay(m);
      const p = m.players[0], b = m.ball;
      b.x = p.x; b.y = headY(p) - 220; b.vx = 0; b.vy = 0;
    },
    input: () => ({}),
  },
};

const GROUND_BALL_Y = () => C.GROUND_Y - C.BALL_R;

// Run one scenario and return its tracks.
export function runScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) throw new Error(`unknown scenario '${name}'`);
  const m = createMatch(CHAR_A, CHAR_B, {});
  sc.setup(m);
  const frames = [], tags = [];
  const snap = (i) => {
    const b = m.ball, [a, z] = m.players;
    frames.push({ i, t: +(i * C.TICK).toFixed(6), ball: { x: b.x, y: b.y, r: b.r },
                  p0: { x: a.x, y: headY(a) }, p1: { x: z.x, y: headY(z) } });
  };
  snap(0);
  const lastStrike = {};
  let phase = m.phase, vyPrev = m.ball.vy, air0 = !m.players[0].onGround;
  for (let i = 1; i <= sc.ticks; i++) {
    m.events.length = 0;
    step(m, [sc.input(i), {}]);
    snap(i);
    const t = frames[i].t;
    if (phase !== 'play' && m.phase === 'play') tags.push({ i, t, type: 'ready' });
    phase = m.phase;
    for (const e of m.events) {
      if ((e.player ?? e.by) !== 0) continue;
      if (e.type === 'jump' || e.type === 'dash' || e.type === 'kick') tags.push({ i, t, type: e.type });
      else if (e.type === 'strike') {
        // A ball resting on a head strikes every tick; a tracker tags the contact once, when
        // it starts, so a run of consecutive strikes collapses to its first tick.
        const type = e.head ? 'header' : 'touch';
        if (lastStrike[type] !== i - 1) tags.push({ i, t, type });
        lastStrike[type] = i;
      }
    }
    // A ground bounce, as a tracker tags it: the ball was falling and now is not, on the grass.
    const b = m.ball;
    if (vyPrev > 30 && b.vy <= 0 && b.y >= GROUND_BALL_Y() - 2) tags.push({ i, t, type: 'bounce' });
    vyPrev = b.vy;
    const air = !m.players[0].onGround;
    if (air0 && !air) tags.push({ i, t, type: 'land' });
    air0 = air;
  }
  return { scenario: name, clip: sc.clip, frames, tags };
}

export const SCENARIO_NAMES = Object.keys(SCENARIOS);
