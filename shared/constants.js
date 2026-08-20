// Head-soccer mock — every tunable number lives here.
// Change a value, reload, re-feel. Nothing else in the sim hard-codes a constant.

// ---- World -----------------------------------------------------------------
// Fixed logical pitch. The renderer letterboxes this into whatever the screen is,
// so physics is resolution-independent and a phone plays the same match as a laptop.
export const W = 960;
export const H = 470;                 // 960x470 ~ 2.04:1 — close to a phone in landscape (2.16:1),
                                      // so the pitch fills the screen instead of letterboxing, and the
                                      // camera sits tight enough that a head reads as a HEAD.
export let GROUND_Y = 405;            // top surface of the grass
export const CEIL_Y = 30;             // invisible ceiling the ball bounces off

export const TICK = 1 / 60;           // sim step (fixed)

// ---- Goals -----------------------------------------------------------------
export let GOAL_W = 74;             // depth of the goal mouth
export let GOAL_H = 146;            // mouth height. A standing player is ~138 tall, so camping the line
                                      // covers most of it but never all of it — you still have to be in position.
export const POST_R = 5;              // crossbar radius (ball bounces off it)

// ---- Ball ------------------------------------------------------------------
export const BALL_R = 15;
export let BALL_GRAV = 1180;
export let BALL_AIR = 0.9955;       // per-tick horizontal air drag
export let BALL_GROUND_FRICTION = 0.988;
export let BALL_BOUNCE = 0.74;      // restitution off the grass
export const BALL_WALL_BOUNCE = 0.86;
export let BALL_MAX_SPEED = 1250;
export const BALL_SPIN_DECAY = 0.985;

// ---- Player ----------------------------------------------------------------
// The single most important ratio in the whole game: PLAYER_SPEED vs how fast a struck
// ball crosses the pitch. At 3-4x the bot could never recover and matches finished 15-12;
// keeping the ball to roughly 2x a running player is what makes defending possible at all.
export let HEAD_R = 46;             // the big head — the primary ball collider
export const BODY_W = 40;
export const BODY_H = 54;             // torso+legs box that sits under the head
export let PLAYER_GRAV = 2300;
export let PLAYER_SPEED = 430;
export let PLAYER_ACCEL = 3400;     // ground responsiveness
export let PLAYER_AIR_ACCEL = 1150; // reduced air control, so jumps commit
export const PLAYER_FRICTION = 0.80;  // per-tick ground damping when no input
export let JUMP_V = 830;
export const JUMP_CUT = 0.45;         // release jump early → shorter hop
export const MAX_JUMPS = 1;

// ---- Dash (double-tap a direction) ----------------------------------------
export const DASH_WINDOW = 0.24;      // s between the two taps
export let DASH_V = 920;
export let DASH_TIME = 0.16;        // s of locked dash velocity
export const DASH_COOLDOWN = 0.55;

// ---- Kick ------------------------------------------------------------------
export let KICK_TIME = 0.20;        // s the leg stays out
export const KICK_COOLDOWN = 0.26;
export let KICK_REACH = 62;         // from body centre, in the facing direction
export let KICK_R = 26;             // kick hitbox radius
export let KICK_POWER = 640;
export let KICK_LIFT = 620;         // upward component — deliberately > half of KICK_POWER, so a
                                      // clean kick LOBS. Flat rockets made every clearance a goal.
export let HEAD_POWER = 1.14;       // head hits multiply the bounce-out speed

// ---- Power shots -----------------------------------------------------------
export let GAUGE_FULL = 28;         // s to fill an empty gauge. At 13s each player got ~7 power
                                      // shots a match and nearly all of them scored — matches ended 10-6.
                                      // ~2-3 per side is what makes arming feel like a moment.
export const GAUGE_CONCEDE_BONUS = 0.22; // conceding a goal gifts this fraction back
export let ARMED_TIME = 6;          // s the armed state lasts before it burns out
export let POWER_SHOT_SPEED = 1500;
export let POWER_STUN = 1.25;       // s the defender is knocked down for
export let COUNTER_WINDOW = 130;    // px: kick within this of an incoming power ball to counter

// ---- Match -----------------------------------------------------------------
export let MATCH_DURATION = 60;     // s — arcade length. Live-tunable from the debug panel.
export const KICKOFF_FREEZE = 1.1;    // s of "READY" before play resumes
export const GOLDEN_GOAL = true;      // draw → sudden death (gauges stop charging)

// ---- Spawns ----------------------------------------------------------------
export const SPAWN_X = [250, W - 250];
export const BALL_SPAWN = { x: W / 2, y: 120 };

// ---- Live tuning -----------------------------------------------------------
// The whole point of a feel mock is that the numbers get argued with while playing, not
// between restarts. These are `let` so the debug panel can move them mid-match; `import *`
// gives every module a live binding, so a slider change lands on the very next tick.
const SETTERS = {
  GROUND_Y: (v) => { GROUND_Y = v; },
  BALL_GRAV: (v) => { BALL_GRAV = v; },
  BALL_AIR: (v) => { BALL_AIR = v; },
  BALL_GROUND_FRICTION: (v) => { BALL_GROUND_FRICTION = v; },
  BALL_BOUNCE: (v) => { BALL_BOUNCE = v; },
  BALL_MAX_SPEED: (v) => { BALL_MAX_SPEED = v; },
  GOAL_H: (v) => { GOAL_H = v; },
  GOAL_W: (v) => { GOAL_W = v; },
  HEAD_R: (v) => { HEAD_R = v; },
  PLAYER_GRAV: (v) => { PLAYER_GRAV = v; },
  PLAYER_SPEED: (v) => { PLAYER_SPEED = v; },
  PLAYER_ACCEL: (v) => { PLAYER_ACCEL = v; },
  PLAYER_AIR_ACCEL: (v) => { PLAYER_AIR_ACCEL = v; },
  JUMP_V: (v) => { JUMP_V = v; },
  DASH_V: (v) => { DASH_V = v; },
  DASH_TIME: (v) => { DASH_TIME = v; },
  KICK_TIME: (v) => { KICK_TIME = v; },
  KICK_REACH: (v) => { KICK_REACH = v; },
  KICK_R: (v) => { KICK_R = v; },
  KICK_POWER: (v) => { KICK_POWER = v; },
  KICK_LIFT: (v) => { KICK_LIFT = v; },
  HEAD_POWER: (v) => { HEAD_POWER = v; },
  GAUGE_FULL: (v) => { GAUGE_FULL = v; },
  ARMED_TIME: (v) => { ARMED_TIME = v; },
  POWER_SHOT_SPEED: (v) => { POWER_SHOT_SPEED = v; },
  POWER_STUN: (v) => { POWER_STUN = v; },
  COUNTER_WINDOW: (v) => { COUNTER_WINDOW = v; },
  MATCH_DURATION: (v) => { MATCH_DURATION = v; },
};

export const TUNABLE = Object.keys(SETTERS);

export function tune(patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (SETTERS[k] && Number.isFinite(v)) SETTERS[k](v);
  }
}

export function snapshot() {
  return {
    GROUND_Y,
    BALL_GRAV,
    BALL_AIR,
    BALL_GROUND_FRICTION,
    BALL_BOUNCE,
    BALL_MAX_SPEED,
    GOAL_H,
    GOAL_W,
    HEAD_R,
    PLAYER_GRAV,
    PLAYER_SPEED,
    PLAYER_ACCEL,
    PLAYER_AIR_ACCEL,
    JUMP_V,
    DASH_V,
    DASH_TIME,
    KICK_TIME,
    KICK_REACH,
    KICK_R,
    KICK_POWER,
    KICK_LIFT,
    HEAD_POWER,
    GAUGE_FULL,
    ARMED_TIME,
    POWER_SHOT_SPEED,
    POWER_STUN,
    COUNTER_WINDOW,
    MATCH_DURATION,
  };
}
