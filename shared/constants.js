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
export let GOAL_W = 84;              // depth of the goal mouth
export let GOAL_H = 170;             // mouth height, ~1.2x a standing player (138).
                                      // Swept against bot-vs-bot outcomes: at 146 the game gave
                                      // 2.6 goals a match and the legendary bot LOST 4-6 to the
                                      // very-easy one — too few goals for skill to show. At 170 it
                                      // is 4.7 goals and 9-2. Bigger than that just adds goals
                                      // without adding skill (230 -> 7.1 goals, 5-3).
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
export let LOB_LIFT = 1.62;           // hold JUMP while kicking: more air, less drive
export let LOB_DRIVE = 0.62;
// Body contact KILLS the ball's pace (Adam: 'if it dosnt kick, the ball kinda stops and
// rolles'). The head still bounces — that is the aerial tool — but your torso deadens.
export let BODY_DEADEN = 0.18;
export let HEAD_POWER = 1.14;       // head hits multiply the bounce-out speed

// ---- Jump feel -------------------------------------------------------------
// The three things that separate a jump that feels good from one that feels broken.
// COYOTE: you may still jump for this long after walking off a ledge or being bumped —
// it forgives the frame you were airborne without meaning to be.
// BUFFER: a jump pressed this long BEFORE landing still fires on touchdown, so mashing at
// the ground never eats an input.
// FALL_MULT: gravity is heavier on the way down than the way up. Symmetric arcs read as
// floaty; this is the single biggest feel win in a platformer jump.
export let COYOTE_TIME = 0.10;
export let JUMP_BUFFER = 0.12;
export let FALL_MULT = 1.55;

// ---- Tackling --------------------------------------------------------------
// Kicking the OPPONENT rather than the ball: a real risk/reward move. It pays a slice of
// power gauge and slows them, so pressing is worth something even when the ball is gone.
// IMMUNE exists so a faster player cannot simply stand next to a slower one and stun-lock
// them out of the match.
export let TACKLE_GAUGE = 0.11;      // gauge gifted to the tackler
export let TACKLE_SLOW = 0.55;       // victim's speed multiplier while slowed
export let TACKLE_SLOW_TIME = 1.7;   // s of slow
export let TACKLE_STUN = 0.22;       // s of "cannot act" — short, it is a nudge not a knockdown
export let TACKLE_PUSH = 340;        // knockback
export let TACKLE_LIFT = 200;
export let TACKLE_IMMUNE = 1.1;      // s before the same player can be tackled again

// ---- Impact ----------------------------------------------------------------
// Hit-stop: freeze the whole sim for a few frames on a heavy connect. Costs nothing and is
// most of what makes a hit feel like it has weight.
export let HIT_STOP_KICK = 0.035;
export let HIT_STOP_POWER = 0.085;
export let HIT_STOP_TACKLE = 0.06;

// ---- Power shots -----------------------------------------------------------
export let GAUGE_FULL = 28;         // s to fill an empty gauge. At 13s each player got ~7 power
                                      // shots a match and nearly all of them scored — matches ended 10-6.
                                      // ~2-3 per side is what makes arming feel like a moment.
export const GAUGE_CONCEDE_BONUS = 0.22; // conceding a goal gifts this fraction back
// POWER MODE. Pressing POWER with a full gauge buys a few seconds of being dangerous — it
// fires nothing by itself. While it lasts, KICKING the ball launches a power shot and
// kicking the OPPONENT lands your signature effect on them. Two buttons, two distinct jobs:
// kick strikes, power decides what the strike is.
export let POWER_MODE_TIME = 4.5;
export let POWER_SHOT_SPEED = 2100;   // much faster than a normal kick — that IS the threat
export let POWER_SHOT_LIFE = 1.6;     // s before a power ball reverts to an ordinary one
export let POWER_SHOT_SAG = 0.12;     // a touch of gravity so a high shot still comes down
export let POWER_BLOCK_REBOUND = 0.42; // pace a blocked shot keeps as it comes back off you
export let POWER_TACKLE_SCALE = 0.55;  // effect strength when you kick the PLAYER, not the ball
export let POWER_STUN = 1.25;         // plain knockdown length (non-signature knockdowns)
export let COUNTER_WINDOW = 130;    // px: kick within this of an incoming power ball to counter

// ---- Anti-stall ------------------------------------------------------------
// A ball nobody has touched for this long is returned to the centre spot. This exists
// because a ball CAN come to rest somewhere unreachable — it was found sitting on top of
// the crossbar at (939, 215) with vy -8, where neither player could reach it, and the match
// ran out its clock into a golden goal that could never be settled.
export let BALL_IDLE_RESET = 6;

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
  BODY_DEADEN: (v) => { BODY_DEADEN = v; },
  LOB_LIFT: (v) => { LOB_LIFT = v; },
  LOB_DRIVE: (v) => { LOB_DRIVE = v; },
  BALL_IDLE_RESET: (v) => { BALL_IDLE_RESET = v; },
  COYOTE_TIME: (v) => { COYOTE_TIME = v; },
  JUMP_BUFFER: (v) => { JUMP_BUFFER = v; },
  FALL_MULT: (v) => { FALL_MULT = v; },
  TACKLE_GAUGE: (v) => { TACKLE_GAUGE = v; },
  TACKLE_SLOW: (v) => { TACKLE_SLOW = v; },
  TACKLE_SLOW_TIME: (v) => { TACKLE_SLOW_TIME = v; },
  TACKLE_STUN: (v) => { TACKLE_STUN = v; },
  TACKLE_PUSH: (v) => { TACKLE_PUSH = v; },
  TACKLE_LIFT: (v) => { TACKLE_LIFT = v; },
  TACKLE_IMMUNE: (v) => { TACKLE_IMMUNE = v; },
  HIT_STOP_KICK: (v) => { HIT_STOP_KICK = v; },
  HIT_STOP_POWER: (v) => { HIT_STOP_POWER = v; },
  HIT_STOP_TACKLE: (v) => { HIT_STOP_TACKLE = v; },
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
  POWER_MODE_TIME: (v) => { POWER_MODE_TIME = v; },
  POWER_SHOT_LIFE: (v) => { POWER_SHOT_LIFE = v; },
  POWER_SHOT_SAG: (v) => { POWER_SHOT_SAG = v; },
  POWER_BLOCK_REBOUND: (v) => { POWER_BLOCK_REBOUND = v; },
  POWER_TACKLE_SCALE: (v) => { POWER_TACKLE_SCALE = v; },
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
    BODY_DEADEN,
    LOB_LIFT,
    LOB_DRIVE,
    BALL_IDLE_RESET,
    COYOTE_TIME,
    JUMP_BUFFER,
    FALL_MULT,
    TACKLE_GAUGE,
    TACKLE_SLOW,
    TACKLE_SLOW_TIME,
    TACKLE_STUN,
    TACKLE_PUSH,
    TACKLE_LIFT,
    TACKLE_IMMUNE,
    HIT_STOP_KICK,
    HIT_STOP_POWER,
    HIT_STOP_TACKLE,
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
    POWER_MODE_TIME,
    POWER_SHOT_LIFE,
    POWER_SHOT_SAG,
    POWER_BLOCK_REBOUND,
    POWER_TACKLE_SCALE,
    POWER_SHOT_SPEED,
    POWER_STUN,
    COUNTER_WINDOW,
    MATCH_DURATION,
  };
}
