// Scripted scenarios for the Head Soccer parity harness (test-hs-parity.mjs).
//
// Each scenario is one of the clips on the shot list (docs/HS-RECORDING.md), re-enacted in OUR
// sim: build a match with createMatch, put the ball and bodies where the clip starts, feed a
// scripted input per tick, and record what a camera would have seen.
//
// The output is deliberately the SAME document the video tracker (tools/hs-measure) writes to
// docs/hs-clips/*.tracks.json:
//   { clip, fps, calib: {groundY, checks}, frames: [{ i, t, ball: {x, y, r}, p0: {x, y}, p1: {x, y} }],
//     tags: [{ i, t, type, note? }] }
// y down, world units, t in seconds. The player point is the HEAD CENTRE, because the head is
// what the tracker follows on video. Keeping one shape is the point of the exercise: the SAME
// fit (tools/hs-fit-lib.mjs, measureTracks) then runs over both sides, so "sim vs reference" is
// never "our number vs a number computed some other way".
//
// Tags use the video vocabulary (see THE METRIC TABLE in hs-fit-lib.mjs). They come from the
// sim's own events where it has one (jump, dash, kick, strike, goal, armed, powershot, blocked,
// stunned) plus ones a person would tag by eye from the picture (ready, bounce + surface, land,
// release, reverse, standing on a head). Nothing here changes gameplay: every scenario reads the
// sim exactly as it ships, so every number is the sim's real per-second behaviour off its own
// per-tick state, and never a constant read out of constants.js.

import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { launchPowerShot } from './shared/powershots.js';
import { createBot, botInput } from './shared/bot.js';

const CHAR_A = { rarity: 'legendary', number: 3 };
const CHAR_B = { rarity: 'legendary', number: 2 };
const BAR_Y = () => C.GROUND_Y - C.GOAL_H;

// Past the kickoff freeze, ball still, both players parked at spawn. Most clips begin from a
// standstill in open play; the kickoff clips want the real kickoff and skip this.
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
  b.x = C.W - b.r - C.POST_R - 1; b.y = C.GROUND_Y - b.r; b.vx = 0; b.vy = 0;
}

const place = (b, x, y, vx = 0, vy = 0) => { b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.spin = 0; b.power = null; };
const armP0 = (m) => { m.players[0].gauge = 1; };
// Toggling a key: pressed on the first half of every `period` ticks — a mash.
const mash = (i, period, from = 0, to = Infinity) => i >= from && i < to && i % period < period / 2;
// Park player 1 out of the way (for scenarios about player 0 alone near the middle).
const parkP1 = (m) => { m.players[1].x = C.W - C.GOAL_W - 40; };

// name -> { clip, ticks, setup(m, ctx), input(i, m, ctx) -> input0 | [input0, input1], ...options }
//   jumpKind   'tap' | 'hold' — which tag player 0's takeoffs get (default tap)
//   kickTag    'swing' (the press, C6) | 'strike' (the contact, C7) — when a 'kick' tag lands
//   kickNote   the kick's contact variant (feet knee head jump run)
//   surface    note for a bounce off the goal frame ('bar' or 'top')
//   attempt    note for an 'attempt' tag at tick 0: the yes/no metrics answer only when tried
//   stand      [upper, lower] player indices watched for standing on a head (default [0, 1])
//   calib      extra calibration checks (the geometry scenario)
export const SCENARIOS = {
  // C0 — the picture's proportions, as the calibration cross-checks read them.
  geometry: { clip: 'C0', ticks: 1, setup: openPlay, input: () => ({}),
    calib: () => ({ goalHeight: C.GOAL_H + C.POST_R, headDiameter: 2 * C.HEAD_R, goalMouthX: C.GOAL_W }) },
  // C1 — the real kickoff, touch nothing: Ready time, spawn height; then the ball drops and
  // bounces until it stops (gravity, bounce decay).
  kickoff: { clip: 'C1', ticks: 180, setup: () => {}, input: () => ({}) },
  drop: { clip: 'C1', ticks: 480, setup: () => {}, input: () => ({}) },

  // C2 — run from standstill, release. And a reversal at full speed. The run starts from a
  // standstill of 10 ticks, as the shot list asks of the clip (1s still at the start): the
  // 10–90% rise needs frames at rest to rise FROM, and an instant start has none otherwise.
  run: { clip: 'C2', ticks: 160, setup: (m) => { openPlay(m); parkBall(m); }, input: (i) => (i >= 10 && i < 70 ? { right: true } : {}) },
  runReverse: { clip: 'C2', ticks: 120, setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i < 50 ? { right: true } : i < 100 ? { left: true } : {}) },

  // C3 — tap jumps (one tick of JUMP) and a held one (held through the landing). Both after 15
  // ticks standing: the fit's standing line is the median of the first 10 frames, and a jump
  // inside them lifts that line 2px and shaves every height and time measured from it.
  jumpTap: { clip: 'C3', ticks: 165, jumpKind: 'tap', setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i === 15 || i === 85 ? { jump: true } : {}) },
  jumpHold: { clip: 'C3', ticks: 170, jumpKind: 'hold', setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (i >= 15 && i < 160 ? { jump: true } : {}) },
  // C4 — a running jump.
  runJump: { clip: 'C4', ticks: 110, setup: (m) => { openPlay(m); parkBall(m); m.players[0].x = 150; parkP1(m); },
    input: (i) => ({ right: i < 100, jump: i === 40 }) },

  // C5 — double-tap right (down, up, down inside DASH_WINDOW), then hold. Then dash-mash.
  dash: { clip: 'C5', ticks: 90, setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => ((i >= 5 && i < 7) || (i >= 10 && i < 40) ? { right: true } : {}) },
  dashSpam: { clip: 'C5', ticks: 240, setup: (m) => { openPlay(m); parkBall(m); m.players[0].x = 120; parkP1(m); },
    input: (i) => (mash(i, 4, 5, 200) ? { right: true } : {}) },

  // C6 — mash kick with the ball far away.
  kickMash: { clip: 'C6', ticks: 240, kickTag: 'swing', setup: (m) => { openPlay(m); parkBall(m); },
    input: (i) => (mash(i, 2, 5, 200) ? { kick: true } : {}) },

  // C7 — kick the ball five ways.
  // Ball resting on the grass 45px out from the body's centre: any closer (~35 and in) and
  // today's sim reads the press as a header off the body rather than a kick.
  kickFeet: { clip: 'C7', ticks: 120, kickTag: 'strike', kickNote: 'feet',
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x + p.facing * 45, C.GROUND_Y - C.BALL_R); },
    input: (i) => (i === 5 ? { kick: true } : {}) },
  kickKnee: { clip: 'C7', ticks: 120, kickTag: 'strike', kickNote: 'knee',
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x + p.facing * 50, C.GROUND_Y - 30); },
    input: (i) => (i === 1 ? { kick: true } : {}) },
  kickHead: { clip: 'C7', ticks: 120, kickTag: 'strike', kickNote: 'head',
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x + p.facing * 40, headY(p)); },
    input: (i) => (i === 1 ? { kick: true } : {}) },
  kickJump: { clip: 'C7', ticks: 120, kickTag: 'strike', kickNote: 'jump', setup: (m) => { openPlay(m); parkBall(m); },
    during: (m, i) => { if (i === 12) { const p = m.players[0]; place(m.ball, p.x + p.facing * 50, p.y - C.BODY_H * 0.45); } },
    input: (i) => ({ jump: i === 1, kick: i === 12 }) },
  // Our lob (not an HS move): KICK with JUMP held, from the halfway line, ball at the feet.
  kickLob: { clip: 'C7', ticks: 180, kickTag: 'strike', kickNote: 'lob',
    setup: (m) => { openPlay(m); const p = m.players[0]; p.x = C.W / 2 - 45; parkP1(m); place(m.ball, p.x + p.facing * 45, C.GROUND_Y - C.BALL_R); },
    input: (i) => ({ jump: i >= 5 && i < 12, kick: i === 5 }) },
  kickRun: { clip: 'C7', ticks: 120, kickTag: 'strike', kickNote: 'run',
    setup: (m) => { openPlay(m); m.players[0].x = 120; parkP1(m); place(m.ball, 420, C.GROUND_Y - C.BALL_R); },
    input: (i, m, ctx) => {
      const p = m.players[0], b = m.ball;
      let kick = false;
      if (ctx.kickAt == null && b.x - p.x < 75) { ctx.kickAt = i; kick = true; }
      return { right: ctx.kickAt == null || i < ctx.kickAt + 5, kick };
    } },
  // C12 — the hardest kick: a running kick at a ball rolling toward the boot (a volley).
  kickMax: { clip: 'C12', ticks: 120, kickTag: 'strike',
    setup: (m) => { openPlay(m); m.players[0].x = 150; parkP1(m); place(m.ball, 560, C.GROUND_Y - C.BALL_R, -250, 0); },
    input: (i, m, ctx) => {
      const p = m.players[0], b = m.ball;
      const k = !ctx.kicked && b.x - p.x < 75; if (k) ctx.kicked = true;
      return { right: true, kick: k };
    } },

  // C8 — stand under a dropping ball, touch nothing (head springiness); then jump into one.
  headDrop: { clip: 'C8', ticks: 150,
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x, headY(p) - 220); },
    input: () => ({}) },
  header: { clip: 'C8', ticks: 150,
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x + 6, headY(p) - 260); },
    input: (i, m, ctx) => {
      const p = m.players[0], b = m.ball;
      const j = !ctx.jumped && headY(p) - b.y < 150; if (j) ctx.jumped = true;
      return { jump: j };
    } },

  // The same drop, headed on purpose: jump into it and press KICK as it reaches the head (our
  // aimed header, tryHeader). The ball arrives falling at ~490 px/s, the median of the HS M4
  // jumping headers it is compared with (ball.launchSpeed.header, ball.headerApex).
  headerKick: { clip: 'C8', ticks: 150, kickTag: 'strike', kickNote: 'header',
    setup: (m) => { openPlay(m); const p = m.players[0]; place(m.ball, p.x + 6, headY(p) - 260); },
    input: (i, m, ctx) => {
      const p = m.players[0], b = m.ball;
      const j = !ctx.jumped && headY(p) - b.y < 150; if (j) ctx.jumped = true;
      const k = ctx.jumped && !ctx.kicked && Math.hypot(b.x - p.x, b.y - headY(p)) < C.HEAD_R + b.r + 8;
      if (k) ctx.kicked = true;
      return { jump: j, kick: k };
    } },

  // C9 — the ball off each surface.
  wallBounce: { clip: 'C9', ticks: 90, setup: (m) => { openPlay(m); place(m.ball, C.W - 220, BAR_Y() - 140, 700, 0); }, input: () => ({}) },
  // The front end of the crossbar, and the goal's top (the middle of the rail), from above.
  barBounce: { clip: 'C9', ticks: 150, surface: 'bar',
    setup: (m) => { openPlay(m); place(m.ball, C.GOAL_W - 2, BAR_Y() - 160); }, input: () => ({}) },
  goalTopBounce: { clip: 'C9', ticks: 240, surface: 'top', attempt: 'goaltop',
    setup: (m) => { openPlay(m); place(m.ball, C.GOAL_W * 0.5, BAR_Y() - 160); }, input: () => ({}) },
  ceilingBounce: { clip: 'C9', ticks: 120, setup: (m) => { openPlay(m); place(m.ball, C.W / 2 - 60, 380, 150, -2000); }, input: () => ({}) },

  // C10 — drop player 0 onto player 1's head, then player 1 walks away under it.
  headStand: { clip: 'C10', ticks: 150, attempt: 'headstand',
    setup: (m) => {
      openPlay(m); parkBall(m);
      const [a, z] = m.players;
      z.x = 500; a.x = 500; a.y = C.GROUND_Y - 160; a.vy = 0; a.onGround = false;
    },
    input: (i) => [{}, i > 60 && i < 120 ? { right: true } : {}] },
  // C10 — player 1 jumps once undisturbed, then again while player 0 dashes under it.
  dashUnder: { clip: 'C10', ticks: 170, attempt: 'dashunder', stand: [1, 0],
    setup: (m) => { openPlay(m); parkBall(m); m.players[0].x = 380; m.players[1].x = 560; },
    input: (i) => [
      (i >= 72 && i < 74) || (i >= 76 && i < 92) ? { right: true } : {},
      i === 5 || i === 75 ? { jump: true } : {},
    ] },

  // C13 — the gauge from the real kickoff: fills, is armed and fired at once (ball on the
  // head), refills. And a full gauge left alone.
  gauge: { clip: 'C13', ticks: 60 * 44,
    setup: () => {},
    during: (m, i, ctx) => {
      const p = m.players[0];
      if (!ctx.fired && p.gauge >= 1 && !ctx.armAt) ctx.armAt = i + 2;
      if (i === ctx.armAt) { place(m.ball, p.x, headY(p) - C.HEAD_R - C.BALL_R + 3); ctx.fired = true; }
    },
    input: (i, m, ctx) => ({ power: i === ctx.armAt }) },
  gaugeHold: { clip: 'C13', ticks: 60 * 92, setup: () => {}, input: () => ({}) },
  // C14 — arm, then touch the ball: the pause a power shot's launch makes.
  powerCutin: { clip: 'C14', ticks: 150,
    setup: (m) => { openPlay(m); armP0(m); parkBall(m); },
    during: (m, i) => { if (i === 4) { const p = m.players[0]; place(m.ball, p.x, headY(p) - C.HEAD_R - C.BALL_R + 3); } },
    input: (i) => ({ power: i === 2 }) },
  // C14 — arm and wait, touching nothing.
  armWait: { clip: 'C14', ticks: 60 * 7, setup: (m) => { openPlay(m); armP0(m); parkBall(m); }, input: (i) => ({ power: i === 2 }) },
  // C15 — player 1's power shot flies at player 0: armed (the counter), and unarmed (the block).
  armedCounter: { clip: 'C15', ticks: 60, attempt: 'armedcounter',
    setup: (m) => { openPlay(m); armP0(m); },
    during: (m, i) => { if (i === 4) { const [a, z] = m.players; place(m.ball, a.x + 220, headY(a)); launchPowerShot(m.ball, z, z.shot, -1); } },
    input: (i) => ({ power: i === 2 }) },
  powerBlock: { clip: 'C15', ticks: 120, attempt: 'powerblock',
    setup: (m) => openPlay(m),
    during: (m, i) => { if (i === 4) { const [a, z] = m.players; place(m.ball, a.x + 220, headY(a)); launchPowerShot(m.ball, z, z.shot, -1); } },
    input: () => ({}) },

  // C17 — a goal and the restart after it.
  goalReset: { clip: 'C17', ticks: 60 * 5, setup: (m) => { openPlay(m); place(m.ball, C.W - 150, C.GROUND_Y - 60, 600, 0); }, input: () => ({}) },
  // C19 — a whole bot-vs-bot match.
  botMatch: { clip: 'M', ticks: 60 * 200, setup: () => {},
    input: (i, m, ctx) => {
      ctx.bots ??= [createBot(2, rng(11)), createBot(2, rng(23))];
      return [botInput(ctx.bots[0], m, 0, C.TICK), botInput(ctx.bots[1], m, 1, C.TICK)];
    } },
  // Ten minutes of bot-vs-bot on one clock, for shares of play time (a 60 s match is a handful
  // of high balls; ten minutes is enough of them to be a share).
  botLong: { clip: 'M', ticks: 60 * 600, setup: (m) => { m.clock = 600; },
    input: (i, m, ctx) => {
      ctx.bots ??= [createBot(2, rng(11)), createBot(2, rng(23))];
      return [botInput(ctx.bots[0], m, 0, C.TICK), botInput(ctx.bots[1], m, 1, C.TICK)];
    } },
};

// A small seeded generator, so the bot match is the same match on every run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUND_BALL_Y = () => C.GROUND_Y - C.BALL_R;
const dirOf = (inp) => (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

// Upper player's feet resting on the lower player's crown.
function standing(up, lo) {
  const crown = headY(lo) - C.HEAD_R;
  return !up.onGround && Math.abs(up.y - crown) < 4 && Math.abs(up.vy) < 40 && Math.abs(up.x - lo.x) < C.HEAD_R;
}

// Run one scenario and return its tracks document.
export function runScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) throw new Error(`unknown scenario '${name}'`);
  const m = createMatch(CHAR_A, CHAR_B, {});
  // THE STARTER'S STATS. Every HS number was measured on the starter character, and the
  // constants are fitted as that baseline; our rarity spread (legendary +6% speed, +5% jump…)
  // is the arcade's stat ladder, which Phase D maps onto HS's. So both bodies play at 1x here.
  for (const p of m.players) p.stats = { speed: 1, jump: 1, kick: 1 };
  const ctx = {};
  sc.setup(m, ctx);
  const frames = [], tags = [];
  const T = (i) => +(i * C.TICK).toFixed(6);
  const tag = (i, type, note) => tags.push(note ? { i, t: T(i), type, note } : { i, t: T(i), type });
  const snap = (i) => {
    const b = m.ball, [a, z] = m.players;
    frames.push({ i, t: T(i), ball: { x: b.x, y: b.y, r: b.r }, p0: { x: a.x, y: headY(a) }, p1: { x: z.x, y: headY(z) } });
  };
  snap(0);
  if (sc.attempt) tag(0, 'attempt', sc.attempt);
  if (m.phase === 'kickoff' && m.freeze > 0) tag(0, 'ready_on');
  const [up, lo] = sc.stand ?? [0, 1];
  const st = {
    phase: m.phase, vy: m.ball.vy, vx: m.ball.vx, air: !m.players[0].onGround, dir: 0,
    gauge: m.players[0].gauge, armed: m.players[0].armed, kickT: 0, stand: false, stuck: 0, cut: false, lastStrike: {},
  };
  for (let i = 1; i <= sc.ticks; i++) {
    m.events.length = 0;
    if (sc.during) sc.during(m, i, ctx);
    let inp = sc.input(i, m, ctx);
    if (!Array.isArray(inp)) inp = [inp, {}];
    step(m, inp, C.TICK);
    snap(i);
    const a = m.players[0], b = m.ball;

    // The restart: kickoff or goal freeze over, the players move again ('resume'). The ball is
    // live then too after a kickoff; after a goal it drops in a beat later (m.ballWait), and
    // 'ready_off' is the ball appearing — which is what a person tags it from on video.
    if (st.phase !== 'play' && m.phase === 'play') { tag(i, 'resume'); if (!(m.ballWait > 0)) tag(i, 'ready_off'); }
    st.phase = m.phase;

    for (const e of m.events) {
      const who = e.player ?? e.by;
      if (e.type === 'goal') { tag(i, 'goal'); continue; }
      if (e.type === 'ballDrop') { tag(i, 'ready_off'); continue; }
      if (e.type === 'bannerOff') { tag(i, 'banner_off'); continue; }
      if (e.type === 'powershot') { tag(i, 'cutin_on'); st.cut = true; if (who === 0 && e.countered) tag(i, 'counter'); continue; }
      if (who !== 0) continue;
      if (e.type === 'jump') tag(i, sc.jumpKind === 'hold' ? 'jump_hold' : 'jump_tap');
      else if (e.type === 'dash') tag(i, 'dash');
      else if (e.type === 'armed') { tag(i, 'power_press'); tag(i, 'armed'); }
      else if (e.type === 'counter') tag(i, 'counter');
      else if (e.type === 'blocked') tag(i, 'blocked');
      else if (e.type === 'stunned') tag(i, 'stun_on');
      else if (e.type === 'revive') tag(i, 'stun_off');
      else if (e.type === 'kick' && sc.kickTag !== 'strike') tag(i, 'kick', sc.kickNote);
      else if (e.type === 'strike') {
        // A kick, or an aimed header off the kick button, is the 'kick' of C7; a passive head
        // contact is a 'touch' (note 'jump' when made in the air). A ball resting on a head
        // strikes every tick; a person tags the contact once, when it starts.
        const kick = !e.head || e.aimed;
        if (kick && sc.kickTag === 'strike') tag(i, 'kick', sc.kickNote);
        else if (!kick) {
          if (st.lastStrike.touch !== i - 1) tag(i, 'touch', a.onGround ? undefined : 'jump');
          st.lastStrike.touch = i;
        }
      }
    }
    // The leg back in.
    if (st.kickT > 0 && a.kickT <= 0) tag(i, 'kick_end');
    st.kickT = a.kickT;
    // The cut-in (the power shot's pause) ends when play moves again.
    if (st.cut && m.hitStop <= 0) { tag(i, 'cutin_off'); st.cut = false; }
    // The gauge and the arm, as the HUD shows them.
    if (st.gauge < 1 && a.gauge >= 1) tag(i, 'gauge_full');
    if (st.gauge >= 1 && a.gauge < 1 && a.armed <= 0 && st.armed <= 0) tag(i, 'gauge_drop');
    if (st.armed > 0 && a.armed <= 0) tag(i, 'armed_end');
    st.gauge = a.gauge; st.armed = a.armed;
    // Buttons, as a person reads them off the thumbs: letting go, turning round.
    const d = dirOf(inp[0]);
    if (st.dir !== 0 && d === 0) tag(i, 'release');
    if (st.dir !== 0 && d === -st.dir) tag(i, 'reverse');
    st.dir = d;
    // Bounces, as a person tags them: the ball's travel reverses against a surface — and visibly.
    // A ball arriving under 60 px/s rises back 3px at most, which nobody tags off a video (and is
    // the sim's own settle cutoff on the grass); counting those put a settling ball's last
    // twitches into a restitution fit as bounces of 0.2.
    const nearBar = (b.x < C.GOAL_W + C.POST_R + b.r || b.x > C.W - C.GOAL_W - C.POST_R - b.r) && b.y < BAR_Y();
    if (st.vy > 60 && b.vy <= 0) {
      if (b.y >= GROUND_BALL_Y() - 2) tag(i, 'bounce', 'ground');
      else if (nearBar) tag(i, 'bounce', sc.surface ?? 'top');
    }
    if (st.vy < -30 && b.vy >= 0 && b.y <= C.CEIL_Y + b.r + 2) tag(i, 'bounce', 'ceiling');
    if (Math.abs(st.vx) > 30 && Math.sign(b.vx) !== Math.sign(st.vx) && (b.x <= b.r + C.POST_R + 2 || b.x >= C.W - b.r - C.POST_R - 2)) tag(i, 'bounce', 'wall');
    st.vy = b.vy; st.vx = b.vx;
    // Landing, and standing on a head (held three ticks before it counts, as a person would).
    const air = !a.onGround;
    if (st.air && !air) tag(i, 'land');
    st.air = air;
    const s = standing(m.players[up], m.players[lo]);
    st.stuck = s ? st.stuck + 1 : 0;
    if (!st.stand && st.stuck === 3) { tag(i - 2, 'stand_on'); st.stand = true; }
    if (st.stand && !s) { tag(i, 'stand_off'); st.stand = false; }
    if (m.phase === 'over') break;
  }
  tags.sort((p, q) => p.t - q.t);
  return {
    scenario: name, clip: sc.clip, fps: 1 / C.TICK, frames, tags,
    // viewTop: the world y of the picture's top edge, as the HS camera frames it.
    calib: { groundY: C.GROUND_Y, W: C.W, viewTop: C.GROUND_Y - C.VIEW_ABOVE_GROUND, checks: sc.calib ? sc.calib() : {} },
  };
}

export const SCENARIO_NAMES = Object.keys(SCENARIOS);
