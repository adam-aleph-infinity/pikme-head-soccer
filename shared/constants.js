// Head-soccer mock — every tunable number lives here.
// Change a value, reload, re-feel. Nothing else in the sim hard-codes a constant.

// ---- World -----------------------------------------------------------------
// Fixed logical pitch. The renderer letterboxes this into whatever the screen is,
// so physics is resolution-independent and a phone plays the same match as a laptop.
export const W = 1060;
// 1060x530 = 2.00:1. Widened from 960 on request — a wider pitch is more room to run a ball
// into, and it costs nothing on a phone: the closer the world gets to a handset's own 2.16:1,
// the less of the screen ends up as letterbox bar.
export const H = 530;
                                      // Was 2.04. The black side bars in that screenshot ARE the game
                                      // letterboxing on a 2.16 phone — matching it means accepting them.
                                      // so the pitch fills the screen instead of letterboxing, and the
                                      // camera sits tight enough that a head reads as a HEAD.
export let GROUND_Y = 435;           // 82% down. Was 445; the extra 10px is grass, on request —
                                     // and grass below the feet is also where the controls sit,
                                     // so a taller apron is a wider berth for a thumb.
export const CEIL_Y = 30;             // invisible ceiling the ball bounces off

export const TICK = 1 / 60;           // sim step (fixed)

// ---- Goals -----------------------------------------------------------------
export let GOAL_W = 69;              // 0.75 x 92, the same three-quarters GOAL_H takes below.
                                     // BOTH axes move by the same factor on purpose: depth:height
                                     // stays 69/144 = 0.479, exactly what 92/192 was, so the box
                                     // the renderer projects is the SAME SHAPE at a smaller size —
                                     // no new proportions, no re-measuring the net, nothing in
                                     // shared/goalbox.js to touch. Depth is not a scoring
                                     // dimension — the line is at the front post — but it is the
                                     // only thing keeping the mesh above a texel at PIXEL 2, and
                                     // 69px still clears that.
export let GOAL_H = 144;             // 0.75 x 192, on request: the 192 was oversized and the cut
                                    // that followed it went too far, so this is the middle — three
                                    // quarters of the big goal, still 1.8x the 79px player, still a
                                    // room you can stand up in (the doorway rule in goalbox.js
                                    // needs GOAL_H > 79 and this clears it by 65px).
                                    //
                                    // JUMP_V is derived FROM this number — see headReach() below.
                                    // Retune the goal and the jump has to follow, or the "you can
                                    // reach the bar but not clear it" rule silently stops holding.             // 2.02x the 79px player — the measured ratio exactly.
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
// DERIVED FROM GOAL_H, not chosen. The rule asked for is "a jump gets you close to the
// crossbar and never over it", and that is an equation, so it is solved rather than guessed:
//
//   headReach() = JUMP_V^2 / (2 * PLAYER_GRAV) + BODY_H + HEAD_R*2 - 8   (see headReach below)
//   want headReach() = GOAL_H - MARGIN = 144 - 10 = 134
//   => JUMP_V = sqrt(2 * 2300 * (134 - 79)) = 503
//
// 505 is that, rounded off the bottom: the top of a jumping head reaches 134.4px against a bar
// at 144, so there are 9.6px of daylight left under it — a margin you can see and cannot fit a
// 24px ball through. It was 830, which put the head 37px ABOVE the old 192 bar; the bar has
// never actually been a ceiling in this game until now.
//
// Ballistic, so PACE does not move it (velocity x k, gravity x k^2 — the apex is invariant),
// which is why the arithmetic above uses the AUTHORED 2300 and still holds at PACE 0.68.
export let JUMP_V = 505;
export const JUMP_CUT = 0.45;         // release jump early → shorter hop
export const MAX_JUMPS = 1;

// ---- Dash (double-tap a direction) ----------------------------------------
export const DASH_WINDOW = 0.24;      // s between the two taps
export let DASH_V = 920;
export let DASH_TIME = 0.16;        // s of locked dash velocity
export const DASH_COOLDOWN = 0.55;

// ---- Kick ------------------------------------------------------------------
export let KICK_TIME = 0.13;        // s the leg stays out. Shorter is SNAPPIER: the swing is
                                     // over sooner, so the next one can start sooner.
// Was 0.26. A quarter of a second between kicks is a quarter of a second of a dead button,
// and in a game this fast that reads as the kick not registering rather than as a cooldown.
export const KICK_COOLDOWN = 0.14;
// From body centre. The drawn boot is three times longer than it was on request, and the
// reach follows it: a foot that looks like it can touch the ball and cannot is the reason the
// kick "did not kick so good". FOOT_LEN is the drawn length; the two are kept in step by
// deriving the reach from it.
export let FOOT_LEN = 3;             // multiples of the original 3px boot plate
export let KICK_REACH = 62;
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
// A HEAD is a body part, not a trampoline. It now deadens the ball the same way the chest
// does — cancel the approach, keep a fraction of the pace — just a little more of it, so a
// header is still the livelier touch of the two without being a bounce. Anything that hits
// the ball HARD is now a deliberate act: the boot, or the kick button pressed at head height.
export let HEAD_DEADEN = 0.58;       // vs the body's 0.18. Started at 0.34, which read as dead
                                     // rather than as a touch; at 0.58 a header keeps most of
                                     // the pace and still cannot be used as a trampoline.
// Where the header ends and the chest begins, as the vertical component of the contact
// normal. 0.35 puts the split a bit below the head's equator.
export let DEADEN_ZONE = 0.35;
// How hard the ball has to be going INTO a player, along the contact normal, for the touch
// to count as a strike and take the deaden. Below it the ball is merely resting or sliding
// on the surface and only gets pushed out, with its pace left alone.
//
// This threshold is the difference between a touch and a state. On a curved surface — the
// side of a head — gravity shows up as motion INTO the surface every single tick, so a
// deaden with no floor under it re-scrubbed the ball's speed sixty times a second and the
// ball simply hung on the player instead of rolling off. Same shape of cutoff as the ones
// on the grass bounce (60) and the crossbar (90), and the same reason.
export let CONTACT_IMPACT_V = 60;
// ── THE BOOT, AIMED ──────────────────────────────────────────────────────────
// A kick used to fire dead flat along the way you were facing, which meant the only way to
// put the ball in the net was to be standing in exactly the right place. Now it BOWS toward
// the far goal: the horizontal keeps the facing, and the loft is chosen so the arc comes
// down around the goal mouth rather than flying over it.
export let KICK_AIM = 0.55;          // 0 = dead flat as before, 1 = fully aimed at the goal
export let KICK_BOW = 1.35;          // how much extra loft the aimed kick gets
export let KICK_BOW_MIN = 260;       // px — below this range to the goal, do not loft at all,
                                     // or a tap from the six-yard box sails over the bar

// ── THE HEADER ───────────────────────────────────────────────────────────────
// Pressing kick with the ball at head height is now a HEADER rather than a boot that misses.
// It is the aerial tool: less power than a kick, more loft, and it is the only way to hit a
// ball you cannot reach with your foot.
export let HEADER_POWER = 0.72;      // of a kick, horizontally
export let HEADER_LIFT = 1.35;       // and more of the lift
export let HEADER_R = 16;            // px of slack around the head circle that still counts

export let HEAD_POWER = 0.52;       // head hits multiply the bounce-out speed. Was 1.14: a head
                                     // was springier than a boot, so the ball pinged off a jump
                                     // harder than off a kick and heading beat playing. At 0.80
                                     // a header is a touch — it redirects, the boot is what
                                     // sends it. Then 0.80 was still too lively, so 0.52:
                                     // a head is now a CONTROL surface — it cushions and
                                     // redirects — and the boot is the only thing on the
                                     // pitch that hits the ball hard.

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
// The gauge is now EARNED OFF THE OPPONENT and nothing else: a third of it per tackle, so
// three hits buy a volley. It used to fill on a clock whether you played or not, which made
// the super move a thing that happened TO a match rather than something a player did.
export let TACKLE_GAUGE = 0.2;       // gauge gifted to the tackler — FIVE hits for a volley.
                                     // Three (0.34) was cheap enough that two bots produced
                                     // ten volleys and eleven goals a match once the cancel
                                     // window let the shots through. Five keeps it a thing you
                                     // work towards.
export let TACKLE_SLOW = 0.55;       // victim's speed multiplier while slowed
export let TACKLE_SLOW_TIME = 1.7;   // s of slow
export let TACKLE_STUN = 0.22;       // s of "cannot act" from the FRONT — a nudge, not a knockdown
// Kicking someone in the back is the one hit they could not see coming, so it is the one that
// stops them dead rather than shoving them. Front tackles push (TACKLE_PUSH below), back
// tackles freeze — same button, and which one you get is decided by where you are standing.
export let TACKLE_STUN_BACK = 0.75;  // s of "cannot act" when hit from behind
export let TACKLE_PUSH_BACK = 0.45;  // and the shove is scaled DOWN to this, so a freeze is a
                                     // freeze rather than a freeze that also slides you away
export let TACKLE_PUSH = 430;        // knockback from the front — a real shove
export let TACKLE_LIFT = 200;
export let TACKLE_IMMUNE = 1.1;      // s before the same player can be tackled again

// ---- Impact ----------------------------------------------------------------
// Hit-stop: freeze the whole sim for a few frames on a heavy connect. Costs nothing and is
// most of what makes a hit feel like it has weight.
export let HIT_STOP_KICK = 0.035;
export let HIT_STOP_POWER = 0.085;
export let HIT_STOP_TACKLE = 0.06;

// ---- Power shots -----------------------------------------------------------
// 0 = no passive fill at all. Kept as a dial rather than deleted, because "how much of the
// gauge should the clock give you" is exactly the kind of thing worth arguing about with a
// slider — but it starts at nothing, because the brief is that you earn it by kicking them.
export let GAUGE_PASSIVE = 0;        // fraction of the gauge per second, 0 = none
export let GAUGE_FULL = 21;          // Cut with PACE 0.68. The match is still 60 REAL seconds, so a
                                      // slower game does not change how often the gauge fills — but it
                                      // does mean far fewer ball contacts to spend it on, and power
                                      // shots per match fell to 1.9 with one bot match hitting zero.
                                      // Shorter fill keeps arming a moment that actually happens.         // s to fill an empty gauge. At 13s each player got ~7 power
                                      // shots a match and nearly all of them scored — matches ended 10-6.
                                      // ~2-3 per side is what makes arming feel like a moment.
// WHAT A GOAL PAYS THE PLAYER WHO CONCEDED IT. Twenty-five points ON TOP of whatever their
// meter already held, clamped at full — an ADDITION, never an assignment and never a reset.
//
// The distinction is the whole of the bug this number was caught in. A goal used to wipe both
// meters back to zero at the restart and then hand this to the conceder, so "conceding gifts
// you a quarter of a meter" was true and "scoring costs you everything you had earned" was
// true with it: an 80% meter came out of a goal at 25%, and the scorer's came out at 0. Both
// players lost a match's worth of tackles every time anybody scored.
//
// The one place it is applied is awardConcedeMeter() in shared/sim.js, and that function is
// the only thing in the sim a goal is allowed to do to a meter.
export const GAUGE_CONCEDE_BONUS = 0.25;

// ── THE ULTIMATE: ARM, THEN TOUCH THE BALL ───────────────────────────────────
// Three shapes, and the third is the one that is in the game.
//
// It was a MODE: press power with a full gauge, get a few seconds in which your next kick
// was a special shot. Then it was a COMMITTED VOLLEY: the press spent the gauge and started
// a wind-up that SUCKED the ball up over your head and fired it. That second one is what
// made "the rival used its ultimate on its own" possible at all — the press was the whole
// move, so anything that produced a press produced a goal-bound shot, and a stale full gauge
// at kickoff was enough.
//
// Now the press only ARMS you. Nothing is spent, nothing moves, the ball is not touched:
// you glow, and the next time your body reaches the ball the ultimate goes off. So the move
// has a cost the other player can see and answer (you have to get to the ball), the button
// can never fire anything by itself, and the gauge is spent only when the shot really exists.
//
// AND THE ARM HAS NO CLOCK ON IT. There was a POWER_MODE_TIME here — 4.5s, after which an
// unused arm lapsed — and it is gone, because "you must touch the ball" and "…or wait 4.5
// seconds and you needn't" are not the same rule. An arm now ends exactly three ways: the
// touch that spends it, full time, or a new match. Nothing else, and a goal least of all.
//
// `p.armed` is therefore a FLAG (0 or 1) rather than a countdown. It stays a number and it
// stays in P_FIELDS so the wire and the renderer are unchanged — everything that reads it
// asks `armed > 0`, which was true of the countdown too.

// How high the top of a jumping head gets. Ballistic, so it is invariant under the PACE dial
// (velocity x k, gravity x k^2 — the apex is the same), which is why it can be derived rather
// than measured per tuning.
export const headReach = () => (JUMP_V * JUMP_V) / (2 * PLAYER_GRAV) + BODY_H + HEAD_R * 2 - 8;
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

// ---- REMOVED: the random match modifiers -----------------------------------
// Wind, low gravity, meteors, robot mode (the SPECTACLE scheduler), the crates that used
// to spawn on the pitch, and the hand of three cards under it all lived here as dials.
// They are gone from the live game — see archive/README.md for the modules and for how to
// put the hand back. Nothing here spawns, activates or bends the ball any more; what is
// left is football, the power meter and the ultimate.

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
          TACKLE_PUSH, TACKLE_LIFT, POWER_SHOT_SPEED },
  acc:  { BALL_GRAV, PLAYER_GRAV, PLAYER_ACCEL, PLAYER_AIR_ACCEL },
  drag: { BALL_AIR, BALL_GROUND_FRICTION },
  time: { KICK_TIME, DASH_TIME, COYOTE_TIME, JUMP_BUFFER, POWER_SHOT_LIFE },
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
  CONTACT_IMPACT_V: (v) => { CONTACT_IMPACT_V = v; },
  BODY_DEADEN: (v) => { BODY_DEADEN = v; },
  HEAD_DEADEN: (v) => { HEAD_DEADEN = v; },
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
  TACKLE_STUN_BACK: (v) => { TACKLE_STUN_BACK = v; },
  TACKLE_PUSH_BACK: (v) => { TACKLE_PUSH_BACK = v; },
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
  FOOT_LEN: (v) => { FOOT_LEN = v; },
  KICK_R: (v) => { KICK_R = v; },
  KICK_POWER: (v) => { KICK_POWER = v; },
  KICK_LIFT: (v) => { KICK_LIFT = v; },
  HEAD_POWER: (v) => { HEAD_POWER = v; },
  KICK_AIM: (v) => { KICK_AIM = v; },
  KICK_BOW: (v) => { KICK_BOW = v; },
  HEADER_POWER: (v) => { HEADER_POWER = v; },
  HEADER_LIFT: (v) => { HEADER_LIFT = v; },
  GAUGE_FULL: (v) => { GAUGE_FULL = v; },
  GAUGE_PASSIVE: (v) => { GAUGE_PASSIVE = v; },
  POWER_SHOT_LIFE: (v) => { POWER_SHOT_LIFE = v; },
  POWER_SHOT_SAG: (v) => { POWER_SHOT_SAG = v; },
  POWER_BLOCK_REBOUND: (v) => { POWER_BLOCK_REBOUND = v; },
  POWER_TACKLE_SCALE: (v) => { POWER_TACKLE_SCALE = v; },
  POWER_SHOT_SPEED: (v) => { POWER_SHOT_SPEED = v; },
  POWER_STUN: (v) => { POWER_STUN = v; },
  COUNTER_WINDOW: (v) => { COUNTER_WINDOW = v; },
  MATCH_DURATION: (v) => { MATCH_DURATION = v; },
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
    CONTACT_IMPACT_V,
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
    POWER_SHOT_LIFE,
    POWER_SHOT_SAG,
    POWER_BLOCK_REBOUND,
    POWER_TACKLE_SCALE,
    POWER_SHOT_SPEED,
    POWER_STUN,
    COUNTER_WINDOW,
    MATCH_DURATION,
    PACE,
  };
}

// Apply the shipped pace to the reference numbers. Everything downstream imports the
// scaled values, so nothing else in the codebase has to know PACE exists.
setPace(PACE);
