// Head-soccer mock — every tunable number lives here.
// Change a value, reload, re-feel. Nothing else in the sim hard-codes a constant.

// ---- World -----------------------------------------------------------------
// Fixed logical pitch. The renderer letterboxes this into whatever the screen is,
// so physics is resolution-independent and a phone plays the same match as a laptop.
export const W = 960;
export const H = 530;                 // 960x530 = 1.81:1, measured off a real kickoff screenshot.
                                      // Was 2.04. The black side bars in that screenshot ARE the game
                                      // letterboxing on a 2.16 phone — matching it means accepting them.
                                      // so the pitch fills the screen instead of letterboxing, and the
                                      // camera sits tight enough that a head reads as a HEAD.
export let GROUND_Y = 445;           // 84% down the screen, as measured
export const CEIL_Y = 30;             // invisible ceiling the ball bounces off

export const TICK = 1 / 60;           // sim step (fixed)

// ---- Goals -----------------------------------------------------------------
export let GOAL_W = 53;              // depth:height 0.33, as measured (was 0.29).
export let GOAL_H = 160;             // 2.02x the 79px player — the measured ratio exactly.
                                      // 160 -> 4.7 goals and 7:4, 180 -> 4.9 and 9:2, 200 -> 8.5 and 8:3.
                                      // 180 is both the closest to the reference AND the best gradient.
                                      // Swept against bot-vs-bot outcomes: at 146 the game gave
                                      // 2.6 goals a match and the legendary bot LOST 4-6 to the
                                      // very-easy one — too few goals for skill to show. At 170 it
                                      // is 4.7 goals and 9-2. Bigger than that just adds goals
                                      // without adding skill (230 -> 7.1 goals, 5-3).
                                      // covers most of it but never all of it — you still have to be in position.
export const POST_R = 5;              // crossbar radius (ball bounces off it)

// ---- Ball ------------------------------------------------------------------
export const BALL_R = 12;
export let BALL_GRAV = 1180;
export let BALL_AIR = 0.9955;       // per-tick horizontal air drag
export let BALL_GROUND_FRICTION = 0.988;
export let BALL_BOUNCE = 0.74;      // restitution off the grass
export const BALL_WALL_BOUNCE = 0.86;
export let BALL_MAX_SPEED = 1050;    // hard ceiling on a loose ball
export const BALL_SPIN_DECAY = 0.985;

// ---- Player ----------------------------------------------------------------
// The single most important ratio in the whole game: PLAYER_SPEED vs how fast a struck
// ball crosses the pitch. At 3-4x the bot could never recover and matches finished 15-12;
// keeping the ball to roughly 2x a running player is what makes defending possible at all.
export let HEAD_R = 30;              // head diameter 60 = 6.3% of pitch width; measured 5.8%.
                                      // Still held slightly over the reference: the head is a Saltiz
                                      // card face and the hook dies when you cannot tell who it is.
                                      // Held at 40 on purpose: the head is a SALTIZ card face, and the
                                      // whole hook stops working when you cannot tell who it is.
export const BODY_W = 32;
export const BODY_H = 27;             // leaves 19px of visible body under the head -> 3.2:1,
                                      // against a measured 2.9:1. Character stands 79px = 15% of screen
                                      // height; the reference is 14.1%.
                                      // their characters are ~80% head, head:body about 3.9:1, and a
                                      // stubby body under a big head IS the silhouette. This was 54,
                                      // which read as an ordinary chibi rather than a head-with-legs.
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
export let KICK_REACH = 48;          // from body centre. Scaled with the smaller body (was 62/48 wide).
export let KICK_R = 22;              // kick hitbox radius
export let KICK_POWER = 520;         // Ball-only slowdown (Adam, 2026-08-21: "make ball slower").
                                      // 640 put a kicked ball at 1.49x the player, crossing the pitch
                                      // in 1.67s against the player's 2.48s — you could not get there.
                                      // 520 makes it 1.21x, which is a chase you can actually win.
export let KICK_LIFT = 620;         // upward component — deliberately > half of KICK_POWER, so a
                                      // clean kick LOBS. Flat rockets made every clearance a goal.
export let LOB_LIFT = 1.62;           // hold JUMP while kicking: more air, less drive
export let LOB_DRIVE = 0.62;
// Body contact KILLS the ball's pace (Adam: 'if it dosnt kick, the ball kinda stops and
// rolles'). The head still bounces — that is the aerial tool — but your torso deadens.
export let BODY_DEADEN = 0.18;
// Where the header ends and the chest begins, as the vertical component of the contact
// normal. 0.35 puts the split a bit below the head's equator.
export let DEADEN_ZONE = 0.35;
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
export let GAUGE_FULL = 21;          // Cut with PACE 0.68. The match is still 60 REAL seconds, so a
                                      // slower game does not change how often the gauge fills — but it
                                      // does mean far fewer ball contacts to spend it on, and power
                                      // shots per match fell to 1.9 with one bot match hitting zero.
                                      // Shorter fill keeps arming a moment that actually happens.         // s to fill an empty gauge. At 13s each player got ~7 power
                                      // shots a match and nearly all of them scored — matches ended 10-6.
                                      // ~2-3 per side is what makes arming feel like a moment.
export const GAUGE_CONCEDE_BONUS = 0.22; // conceding a goal gifts this fraction back
// POWER MODE. Pressing POWER with a full gauge buys a few seconds of being dangerous — it
// fires nothing by itself. While it lasts, KICKING the ball launches a power shot and
// kicking the OPPONENT lands your signature effect on them. Two buttons, two distinct jobs:
// kick strikes, power decides what the strike is.
export let POWER_MODE_TIME = 4.5;
export let POWER_SHOT_SPEED = 1000;   // Ball-only slowdown pass. NOTE the reference here had ALREADY
                                      // been cut 2100 -> 1250 by another session before I touched it;
                                      // I briefly raised it to 1750 while "slowing the ball down",
                                      // which is what happens when you tune against a number you
                                      // remember instead of the one in the file. Still roughly 2x a
                                      // normal kick, so it stays the threat — but blockable.
export let POWER_SHOT_LIFE = 1.6;     // s before a power ball reverts to an ordinary one
export let POWER_SHOT_SAG = 0.12;     // a touch of gravity so a high shot still comes down
export let POWER_BLOCK_REBOUND = 0.42; // pace a blocked shot keeps as it comes back off you
export let POWER_TACKLE_SCALE = 0.55;  // effect strength when you kick the PLAYER, not the ball
export let POWER_STUN = 1.25;         // plain knockdown length (non-signature knockdowns)
export let COUNTER_WINDOW = 130;    // px: kick within this of an incoming power ball to counter

// ---- SPECTACLE -------------------------------------------------------------
// Events that happen TO the match: meteors, moon gravity, wind, and a losing player turning
// into a robot. The rules live in shared/spectacle.js; these are the dials.
//
// The single constraint every number here answers to: a match must never be decided by
// something the player could not see coming. That is why the telegraph times are the first
// four values, why there is a keep-out band in front of both goals, and why the whole system
// switches itself off for the last SPECTACLE_QUIET_END seconds.
export let SPECTACLE_ON = 1;         // 0 turns the entire system off, live, mid-match
export let SPECTACLE_FIRST = 9;      // s of ordinary football before the first act
export let SPECTACLE_GAP = 12;       // s between acts. One thing at a time; chaos with no
                                      // gaps stops being an event and becomes the weather.
export let SPECTACLE_QUIET_END = 8;  // s at the end of the match where nothing may fire and
                                      // anything pending is cancelled. The finish is theirs.

// ---- Meteors ---------------------------------------------------------------
// A marker on the grass FIRST, the rock second. METEOR_WARN is the whole fairness budget:
// test-spectacle asserts a player standing dead centre of the marker, at the slowest speed
// the game can produce (common card, freshly tackled), still clears the blast in time.
export let METEOR_WARN = 1.15;       // s of telegraph before impact
export let METEOR_SHOWER_TIME = 5.4; // s the shower lasts
export let METEOR_INTERVAL = 0.9;    // s between rocks
export let METEOR_SPREAD = 260;      // px either side of the ball a rock may aim
export let METEOR_KEEPOUT = 120;     // px in front of each goal where none may ever land
export let METEOR_R = 64;            // blast radius on a player
export let METEOR_BALL_R = 76;       // and on the ball
export let METEOR_PUSH = 470;        // knockback
export let METEOR_LIFT = 380;
export let METEOR_KNOCK = 0.34;      // s on the floor — a lost beat, not a stun-lock
export let METEOR_BALL_POP = 780;    // the ball goes UP…
export let METEOR_BALL_PUSH = 210;   // …far more than sideways, so a rock cannot score
export const METEOR_FALL = 40;       // px above the ceiling the rock starts its fall (art).
                                      // Was 140 with a squared fall curve, which kept the rock
                                      // off-screen for the first HALF of its own telegraph —
                                      // the marker was doing all the work alone.
export let HIT_STOP_METEOR = 0.07;

// ---- Moon phase ------------------------------------------------------------
// Gravity drops away for both players at once — symmetric, so it is fair by construction.
// The ball is lightened much more than the players: a floating ball is spectacle, a
// floating player is somebody who has lost control of their own jump.
export let MOON_TIME = 6.5;
export let MOON_GRAV_BALL = 0.42;
export let MOON_GRAV_PLAYER = 0.72;

// ---- Wind ------------------------------------------------------------------
// Pushes the ball only, never a player, so it can never take the controls off you. The
// direction ALTERNATES every time it fires, so nobody gets it twice running.
export let WIND_TIME = 6;
export let WIND_FORCE = 560;         // px/s² on a loose ball (a live power shot ignores it)

// ---- Robot mode ------------------------------------------------------------
// Triggered by being ROBOT_DEFICIT goals BEHIND — see the long note in spectacle.js for why
// that trigger and not a pickup. A trade, not a buff: quicker and a much harder boot, but
// heavier, so a robot wins races and loses headers.
export let ROBOT_DEFICIT = 2;        // goals behind before it arms
export let ROBOT_WARN = 1;           // s of windup, announced, before the stats change
export let ROBOT_TIME = 9;           // s it lasts. It ALWAYS ends.
export let ROBOT_COOLDOWN = 12;      // s before the same player can turn again
export let ROBOT_SPEED = 1.22;
export let ROBOT_KICK = 1.3;
export let ROBOT_JUMP = 0.94;        // with ROBOT_GRAV that is a ~30% lower jump
export let ROBOT_GRAV = 1.25;

// ---- POWER-UPS -------------------------------------------------------------
// Collectable pickups: a thing appears on the pitch, you go and get it, and for a few
// seconds you can do something you could not do before. Rules in shared/powerups.js.
//
// The constraint every number here answers to is not the spectacle's ("could the player see
// it coming") but the one a 1v1 adds to it: could BOTH players have got it? That is why a
// pickup spawns at the exact midpoint between the two of them, why there is a keep-out band
// so the midpoint is never inside a goalmouth, and why the mercy lead exists.
export let PICKUPS_ON = 1;           // 0 turns the whole system off, live, mid-match
export let PICKUP_FIRST = 7;         // s of ordinary football before the first one
export let PICKUP_GAP = 9;           // s from one leaving the pitch to the next attempt
export let PICKUP_WARN = 1.1;        // s of telegraph before it can be collected
export let PICKUP_LIFE = 5.5;        // s it stays collectable, then it expires on its own
export let PICKUP_QUIET_END = 10;    // s at the end where none spawns and any live one is
                                      // removed. Must stay ABOVE the longest effect below,
                                      // so nothing collected at the last legal moment is
                                      // still running at the whistle — test-powerups checks
                                      // that relation against the LIVE (paced) values.
export let PICKUP_KEEPOUT = 96;      // px in front of each goal where none may appear
export let PICKUP_R = 22;            // collect radius, and the drawn size
export let PICKUP_Y = 86;            // px above the ground line it floats at. Low enough
                                      // that a STANDING head touches it (head centre sits
                                      // 49px up, head radius 30, pickup radius 22) — making
                                      // you jump for it would turn a footrace into a timing
                                      // puzzle, and the footrace IS the mechanic.
export let PICKUP_MERCY_LEAD = 2;    // goals: at or above this, the one item that takes
                                      // something off the other player stops spawning.
                                      // Same number as ROBOT_DEFICIT on purpose — the
                                      // moment the loser gets a robot is the moment ICE
                                      // leaves the hat.
export let HIT_STOP_PICKUP = 0.045;  // a small punch on collect. Half a power shot.

// Big head. A bigger thing to head the ball with — and a bigger thing to boot, since
// tryTackle tests the same circle. 1.55 puts the bottom of the head at 442 against a
// 445 ground line, so it grows to exactly as big as the pitch allows.
export let PU_GROW_TIME = 6;
export let PU_GROW_SCALE = 1.55;
// Magnet. An acceleration on a LOOSE ball only, falling off linearly to nothing at the rim.
// Deliberately below BALL_GRAV at point-blank (781*k^2 vs 1180*k^2) so it BENDS a ball
// toward you rather than levitating it.
export let PU_MAGNET_TIME = 5;
export let PU_MAGNET_FORCE = 780;    // px/s² at zero distance
export let PU_MAGNET_RANGE = 300;    // px — about a third of the pitch
// Shield. Absorbs exactly one power shot (fired or booted) and is then gone.
export let PU_SHIELD_TIME = 5.5;
// Spring boots: a higher jump AND one extra jump in the air. Both end together.
export let PU_SPRING_TIME = 6;
export let PU_SPRING_JUMP = 1.22;
export let PU_SPRING_JUMPS = 1;      // extra air jumps on top of MAX_JUMPS
// Ice. The ONLY item that touches the other player, and it is a `slow`, never a root: you
// keep every button, you are just heavy. Nothing here takes the controls off anybody.
export let PU_ICE_TIME = 2.2;

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
export const BALL_SPAWN = { x: W / 2, y: 140 };

// ---- Pace ------------------------------------------------------------------
// One dial for how fast the whole match runs. It is a true slow-motion, NOT a speed nerf:
// velocities scale by k, accelerations by k^2, per-tick drags by ^k and action durations by
// 1/k, so every trajectory keeps its SHAPE — same jump height, same arc, same reach — and
// only the clock on it changes. Scaling speeds alone would flatten every arc instead, which
// is a different game rather than a slower one.
//
// Why below 1: at k=1 a struck ball crosses the pitch in 1.6s, which is inside the window a
// human needs to see it, decide and press. 0.80 buys 25% more time on every ball for 4.7
// goals a match (from 5.3) and no loss of skill gradient — measured bot-vs-bot over 20
// matches in `_pace.mjs`, which is also where to re-run the sweep before changing this.
export let PACE = 0.68;

// The authored numbers above are the k=1 reference. Captured once, so repeated PACE changes
// compound against the reference rather than against each other.
const PACE_REF = {
  vel:  { BALL_MAX_SPEED, KICK_POWER, KICK_LIFT, PLAYER_SPEED, DASH_V, JUMP_V,
          TACKLE_PUSH, TACKLE_LIFT, POWER_SHOT_SPEED,
          // The spectacle rides the pace dial too, or a meteor that throws you 470px/s
          // reads as violent next to a 344px/s run and the two systems drift apart.
          METEOR_PUSH, METEOR_LIFT, METEOR_BALL_POP, METEOR_BALL_PUSH },
  acc:  { BALL_GRAV, PLAYER_GRAV, PLAYER_ACCEL, PLAYER_AIR_ACCEL, WIND_FORCE,
          // The magnet is an acceleration on the ball, exactly like the wind.
          PU_MAGNET_FORCE },
  drag: { BALL_AIR, BALL_GROUND_FRICTION },
  // METEOR_WARN is here for a reason worth spelling out: velocities scale by k and this
  // scales by 1/k, so the distance a player can run inside the telegraph — the entire
  // fairness budget — is INVARIANT under the pace dial. Slow the game down and the warning
  // stretches with it. METEOR_KNOCK follows the same logic.
  //
  // Every pickup duration is here for that same reason: how far you can RUN inside a
  // telegraph, how far you can run before a crate expires, and how much pitch you cover
  // while a power-up is live are all things that must not move when the pace dial does.
  // PICKUP_FIRST / PICKUP_GAP / PICKUP_QUIET_END are deliberately NOT here — they are match
  // structure, like SPECTACLE_FIRST, not trajectories.
  time: { KICK_TIME, DASH_TIME, COYOTE_TIME, JUMP_BUFFER, POWER_SHOT_LIFE,
          METEOR_WARN, METEOR_KNOCK,
          PICKUP_WARN, PICKUP_LIFE,
          PU_GROW_TIME, PU_MAGNET_TIME, PU_SHIELD_TIME, PU_SPRING_TIME, PU_ICE_TIME },
};

export function setPace(k) {
  if (!Number.isFinite(k) || k <= 0) return;
  PACE = k;
  const patch = {};
  for (const [n, v] of Object.entries(PACE_REF.vel))  patch[n] = v * k;
  for (const [n, v] of Object.entries(PACE_REF.acc))  patch[n] = v * k * k;
  for (const [n, v] of Object.entries(PACE_REF.drag)) patch[n] = Math.pow(v, k);
  for (const [n, v] of Object.entries(PACE_REF.time)) patch[n] = v / k;
  tune(patch);
}

// ---- Live tuning -----------------------------------------------------------
// The whole point of a feel mock is that the numbers get argued with while playing, not
// between restarts. These are `let` so the debug panel can move them mid-match; `import *`
// gives every module a live binding, so a slider change lands on the very next tick.
const SETTERS = {
  DEADEN_ZONE: (v) => { DEADEN_ZONE = v; },
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
  // ---- spectacle ----
  SPECTACLE_ON: (v) => { SPECTACLE_ON = v; },
  SPECTACLE_FIRST: (v) => { SPECTACLE_FIRST = v; },
  SPECTACLE_GAP: (v) => { SPECTACLE_GAP = v; },
  SPECTACLE_QUIET_END: (v) => { SPECTACLE_QUIET_END = v; },
  METEOR_WARN: (v) => { METEOR_WARN = v; },
  METEOR_SHOWER_TIME: (v) => { METEOR_SHOWER_TIME = v; },
  METEOR_INTERVAL: (v) => { METEOR_INTERVAL = v; },
  METEOR_SPREAD: (v) => { METEOR_SPREAD = v; },
  METEOR_KEEPOUT: (v) => { METEOR_KEEPOUT = v; },
  METEOR_R: (v) => { METEOR_R = v; },
  METEOR_BALL_R: (v) => { METEOR_BALL_R = v; },
  METEOR_PUSH: (v) => { METEOR_PUSH = v; },
  METEOR_LIFT: (v) => { METEOR_LIFT = v; },
  METEOR_KNOCK: (v) => { METEOR_KNOCK = v; },
  METEOR_BALL_POP: (v) => { METEOR_BALL_POP = v; },
  METEOR_BALL_PUSH: (v) => { METEOR_BALL_PUSH = v; },
  HIT_STOP_METEOR: (v) => { HIT_STOP_METEOR = v; },
  MOON_TIME: (v) => { MOON_TIME = v; },
  MOON_GRAV_BALL: (v) => { MOON_GRAV_BALL = v; },
  MOON_GRAV_PLAYER: (v) => { MOON_GRAV_PLAYER = v; },
  WIND_TIME: (v) => { WIND_TIME = v; },
  WIND_FORCE: (v) => { WIND_FORCE = v; },
  ROBOT_DEFICIT: (v) => { ROBOT_DEFICIT = v; },
  ROBOT_WARN: (v) => { ROBOT_WARN = v; },
  ROBOT_TIME: (v) => { ROBOT_TIME = v; },
  ROBOT_COOLDOWN: (v) => { ROBOT_COOLDOWN = v; },
  ROBOT_SPEED: (v) => { ROBOT_SPEED = v; },
  ROBOT_KICK: (v) => { ROBOT_KICK = v; },
  ROBOT_JUMP: (v) => { ROBOT_JUMP = v; },
  ROBOT_GRAV: (v) => { ROBOT_GRAV = v; },
  // ---- power-ups ----
  PICKUPS_ON: (v) => { PICKUPS_ON = v; },
  PICKUP_FIRST: (v) => { PICKUP_FIRST = v; },
  PICKUP_GAP: (v) => { PICKUP_GAP = v; },
  PICKUP_WARN: (v) => { PICKUP_WARN = v; },
  PICKUP_LIFE: (v) => { PICKUP_LIFE = v; },
  PICKUP_QUIET_END: (v) => { PICKUP_QUIET_END = v; },
  PICKUP_KEEPOUT: (v) => { PICKUP_KEEPOUT = v; },
  PICKUP_R: (v) => { PICKUP_R = v; },
  PICKUP_Y: (v) => { PICKUP_Y = v; },
  PICKUP_MERCY_LEAD: (v) => { PICKUP_MERCY_LEAD = v; },
  HIT_STOP_PICKUP: (v) => { HIT_STOP_PICKUP = v; },
  PU_GROW_TIME: (v) => { PU_GROW_TIME = v; },
  PU_GROW_SCALE: (v) => { PU_GROW_SCALE = v; },
  PU_MAGNET_TIME: (v) => { PU_MAGNET_TIME = v; },
  PU_MAGNET_FORCE: (v) => { PU_MAGNET_FORCE = v; },
  PU_MAGNET_RANGE: (v) => { PU_MAGNET_RANGE = v; },
  PU_SHIELD_TIME: (v) => { PU_SHIELD_TIME = v; },
  PU_SPRING_TIME: (v) => { PU_SPRING_TIME = v; },
  PU_SPRING_JUMP: (v) => { PU_SPRING_JUMP = v; },
  PU_SPRING_JUMPS: (v) => { PU_SPRING_JUMPS = v; },
  PU_ICE_TIME: (v) => { PU_ICE_TIME = v; },
  PACE: (v) => { setPace(v); },
};

export const TUNABLE = Object.keys(SETTERS);

export function tune(patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (SETTERS[k] && Number.isFinite(v)) SETTERS[k](v);
  }
}

export function snapshot() {
  return {
    DEADEN_ZONE,
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
    SPECTACLE_ON,
    SPECTACLE_FIRST,
    SPECTACLE_GAP,
    SPECTACLE_QUIET_END,
    METEOR_WARN,
    METEOR_SHOWER_TIME,
    METEOR_INTERVAL,
    METEOR_SPREAD,
    METEOR_KEEPOUT,
    METEOR_R,
    METEOR_BALL_R,
    METEOR_PUSH,
    METEOR_LIFT,
    METEOR_KNOCK,
    METEOR_BALL_POP,
    METEOR_BALL_PUSH,
    HIT_STOP_METEOR,
    MOON_TIME,
    MOON_GRAV_BALL,
    MOON_GRAV_PLAYER,
    WIND_TIME,
    WIND_FORCE,
    ROBOT_DEFICIT,
    ROBOT_WARN,
    ROBOT_TIME,
    ROBOT_COOLDOWN,
    ROBOT_SPEED,
    ROBOT_KICK,
    ROBOT_JUMP,
    ROBOT_GRAV,
    PICKUPS_ON,
    PICKUP_FIRST,
    PICKUP_GAP,
    PICKUP_WARN,
    PICKUP_LIFE,
    PICKUP_QUIET_END,
    PICKUP_KEEPOUT,
    PICKUP_R,
    PICKUP_Y,
    PICKUP_MERCY_LEAD,
    HIT_STOP_PICKUP,
    PU_GROW_TIME,
    PU_GROW_SCALE,
    PU_MAGNET_TIME,
    PU_MAGNET_FORCE,
    PU_MAGNET_RANGE,
    PU_SHIELD_TIME,
    PU_SPRING_TIME,
    PU_SPRING_JUMP,
    PU_SPRING_JUMPS,
    PU_ICE_TIME,
    PACE,
  };
}

// Apply the shipped pace to the reference numbers. Everything downstream imports the
// scaled values, so nothing else in the codebase has to know PACE exists.
setPace(PACE);
