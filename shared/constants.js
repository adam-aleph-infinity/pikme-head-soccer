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
export let GOAL_W = 92;              // depth:height 0.33 against GOAL_H 192, which is the
                                     // ratio measured off the reference shot. It read 0.28
                                     // while GOAL_W sat at 53 through the goal's +20% — the
                                     // net got shallower than anyone asked for. 64 restores
                                     // the measured ratio AND buys the net room: the canvas
                                     // renders at half resolution (PIXEL 2), so a mesh drawn
                                     // into 53px had cords thinner than a texel and turned
                                     // to mush. Depth is not a scoring dimension — the line
                                     // is at the front post — so this is paint, not balance.
export let GOAL_H = 192;             // +20% on request (was 160). The volley's launch height
                                    // rides this (0.9 of it), so a taller goal also raises the
                                    // line a defender has to jump to — one number, both.             // 2.02x the 79px player — the measured ratio exactly.
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
export const GAUGE_CONCEDE_BONUS = 0.22; // conceding a goal gifts this fraction back
// POWER MODE. Pressing POWER with a full gauge buys a few seconds of being dangerous — it
// fires nothing by itself. While it lasts, KICKING the ball launches a power shot and
// kicking the OPPONENT lands your signature effect on them. Two buttons, two distinct jobs:
// kick strikes, power decides what the strike is.
// ── THE POWER MOVE ───────────────────────────────────────────────────────────
// It used to be a MODE: press power, get 4.5 seconds in which your next kick was a special
// shot. That made the gauge a thing you spent on an ordinary touch, and it never read as a
// super move — the shot came off the same boot as everything else.
//
// Now it is a COMMITTED VOLLEY. Press power with a full gauge and the player winds up for
// half a second while the ball is drawn up above their head and lights up; then it fires
// dead flat at three times a normal power shot, at a height a standing player cannot reach.
// The only answer is to jump into its line at the right moment.
// How long a wind-up can be knocked out of. At a 0.5s wind-up "a tackle cancels it" was a
// fair read; at 3 seconds it is a certainty — anyone can cross the pitch in three seconds, so
// bots stopped landing volleys ENTIRELY (measured: 4.8 a match down to 0). So the punish is a
// WINDOW: get to them in the first second and the shot is gone, miss it and the shot is
// coming and you had better be on the line. Both players know which phase they are in, which
// is what makes a three-second commitment playable rather than merely long.
export let POWER_CANCEL_WINDOW = 1.0;
export let POWER_CHARGE_TIME = 3;     // s of wind-up. Three seconds is a very long time to
                                      // stand still in the open — it is a fifth of the match —
                                      // which makes this the most committed thing either
                                      // player can do, and gives the other one time to choose
                                      // between running at you to cancel it and setting up on
                                      // the line to jump.
// The volley always leaves at the SAME height — 0.9 of the goal — so a defender learns one
// height to jump for instead of guessing per shot. Derived from GOAL_H rather than typed, or
// the two drift apart the first time the goal is retuned.
export let POWER_CHARGE_GOAL_FRAC = 0.9;

// How high the top of a jumping head gets. Ballistic, so it is invariant under the PACE dial
// (velocity x k, gravity x k^2 — the apex is the same), which is why it can be derived rather
// than measured per tuning.
export const headReach = () => (JUMP_V * JUMP_V) / (2 * PLAYER_GRAV) + BODY_H + HEAD_R * 2 - 8;

// THE VOLLEY'S LINE. 0.9 of the goal, as asked — but never higher than a jump can meet.
//
// Those two requirements collided the moment the goal went up 20%: 0.9 of a 192px goal is
// 173px and the top of a jumping head reaches 146px, so the shot became unblockable and the
// rule it was built around ("the only way to stop it is to jump at the right time") stopped
// being true. The clamp keeps the intent when the arithmetic cannot: high enough that standing
// there is useless, low enough that a jump is not.
export const powerHeight = () => Math.min(GOAL_H * POWER_CHARGE_GOAL_FRAC, headReach() - 14);
export let POWER_VOLLEY_SPEED = 3;    // multiples of POWER_SHOT_SPEED. Powered balls are
                                      // exempt from BALL_MAX_SPEED, so this actually lands.
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
export let PICKUPS_ON = 0;           // 0 turns the whole system off, live, mid-match. OFF by
                                     // default since the cards landed: the powers come out of
                                     // your hand now, and crates on top of them is two of the
                                     // same system. `?pickups=1` brings them back to A/B.
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

// ── CARDS — the hand of three ────────────────────────────────────────────────
// You hold three cards; each is one of the six powers above, on its own cooldown. The
// rarity of the card is the ladder: strength up, cooldown down, both geometric so the
// ordering cannot invert wherever a slider is dragged. Rules in shared/cards.js.
// ── THE FOUR SPECIALS ────────────────────────────────────────────────────────
// Epic and legendary cards only. Rules in shared/skills.js; these are the numbers.
export let SKILL_DART_SPEED = 780;   // px/s — fast enough to be a shot, slow enough to dodge
export let SKILL_DART_LIFE = 2.2;    // s before it fizzles out
export let SKILL_DART_R = 9;
export let SKILL_SHRINK = 0.62;      // head multiplier on a hit
export let SKILL_SHRINK_TIME = 5;    // s
export let SKILL_GROW = 1.45;        // and what a dart in the NET pays its shooter instead
export let SKILL_GROW_TIME = 5;

export let SKILL_WALL_BOUNCE = 0.8;  // how hard the wall throws a saved ball back out
export let SKILL_WALL_TIME = 1.6;    // s your own goal is shut. Under two on purpose: long
                                     // enough to survive one attack, too short to defend with.
export let SKILL_SUPER_ARM = 5;      // s the super kick stays armed waiting for a touch
export let SKILL_SUPER_BALL = 1.9;   // ball speed multiplier on that touch
export let SKILL_SUPER_PUSH = 620;   // and what it does to anyone standing by the ball
export let SKILL_SUPER_LIFT = 260;
export let SKILL_SUPER_RANGE = 120;  // px from the ball to catch the shove

// px/s along the ground. Raised from 300 (204 after PACE) because at that speed a jump did
// not clear it: a jump is airborne for about 0.47s and the dog covered only 96px in that
// time, so you rose, the dog kept coming, and you landed on top of it. A hurdle you cannot
// hurdle is just a delayed hit. At 480 it covers ~155px while you are in the air, which is
// what makes "jump it" the answer rather than a suggestion.
export let SKILL_DOG_SPEED = 480;
export let SKILL_DOG_LIFE = 6;       // s before it gets bored and leaves
export let SKILL_DOG_R = 32;         // was 24. The drawn dog got bigger, so its reach did too —
                                     // an animal that looks like it can reach you and cannot is
                                     // a lie the player pays for.
export let SKILL_DOG_HOLD = 1.0;     // s it holds whoever it caught

export let CARDS_ON = 1;             // 0 hides the row and takes the buttons out of the sim
export let CARD_CD_BASE = 26;        // s — a COMMON card's cooldown, the slowest in the game.
                                     // 18 first, and two bots then played 34 cards between
                                     // them in a 60s match (measured): with three cards each
                                     // on an 11s clock, somebody's power was live almost
                                     // permanently and a card stopped being a moment. At 26
                                     // a legendary comes round about three times a match.
export let CARD_CD_STEP = 0.86;      // each rarity step multiplies it: 26 → 22.4 → 19.2 → 16.5
// A card's effect is SHORTER than a crate's, and it has to be. The PU_*_TIME numbers were
// authored for an object you race for and get maybe three times a match; a card is in your
// hand and comes round on a clock. At full crate length a legendary hand kept a power live
// for 81% of the playing time (measured, two level-5 bots) — which is not a power any more,
// it is the baseline. At 0.55 a legendary card is live for about half its own cooldown.
export let CARD_POWER_SCALE = 0.55;
export let CARD_STR_BASE = 1;        // a common's effect is the authored PU_*_TIME × the scale
export let CARD_STR_STEP = 1.18;     // and each step up stretches it: ×1 → 1.18 → 1.39 → 1.64

// Two ways a card comes back, and the second one is the reason this is not just a timer.
// A cooldown that only ticks rewards standing still; one that fills on CONTACT rewards
// playing. So both: it ticks, and every touch knocks time off it — a little for kicking the
// ball, a lot for landing a tackle on the opponent.
export let CARD_CHARGE_KICK = 0.5;   // s off every card's cooldown when you kick the ball
export let CARD_CHARGE_HIT = 2.5;    // s off when you tackle the opponent. Five kicks' worth.
export let CARD_CHARGE_GOAL = 4;     // s off for scoring, so a goal restarts the exchange

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
          // The specials are trajectories too: a dart and a dog that did not ride the pace
          // dial would cross a slowed pitch in half the time everything else takes.
          SKILL_DART_SPEED, SKILL_DOG_SPEED, SKILL_SUPER_PUSH, SKILL_SUPER_LIFT,
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
          SKILL_DART_LIFE, SKILL_SHRINK_TIME, SKILL_GROW_TIME, SKILL_WALL_TIME,
          SKILL_DOG_LIFE, SKILL_DOG_HOLD,
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
  POWER_MODE_TIME: (v) => { POWER_MODE_TIME = v; },
  POWER_CHARGE_TIME: (v) => { POWER_CHARGE_TIME = v; },
  POWER_CANCEL_WINDOW: (v) => { POWER_CANCEL_WINDOW = v; },
  POWER_CHARGE_GOAL_FRAC: (v) => { POWER_CHARGE_GOAL_FRAC = v; },
  POWER_VOLLEY_SPEED: (v) => { POWER_VOLLEY_SPEED = v; },
  GAUGE_PASSIVE: (v) => { GAUGE_PASSIVE = v; },
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
  CARDS_ON: (v) => { CARDS_ON = v; },
  SKILL_DART_SPEED: (v) => { SKILL_DART_SPEED = v; },
  SKILL_SHRINK: (v) => { SKILL_SHRINK = v; },
  SKILL_GROW: (v) => { SKILL_GROW = v; },
  SKILL_WALL_TIME: (v) => { SKILL_WALL_TIME = v; },
  SKILL_SUPER_BALL: (v) => { SKILL_SUPER_BALL = v; },
  SKILL_SUPER_PUSH: (v) => { SKILL_SUPER_PUSH = v; },
  SKILL_DOG_SPEED: (v) => { SKILL_DOG_SPEED = v; },
  SKILL_DOG_HOLD: (v) => { SKILL_DOG_HOLD = v; },
  CARD_CD_BASE: (v) => { CARD_CD_BASE = v; },
  CARD_CD_STEP: (v) => { CARD_CD_STEP = v; },
  CARD_POWER_SCALE: (v) => { CARD_POWER_SCALE = v; },
  CARD_STR_STEP: (v) => { CARD_STR_STEP = v; },
  CARD_CHARGE_KICK: (v) => { CARD_CHARGE_KICK = v; },
  CARD_CHARGE_HIT: (v) => { CARD_CHARGE_HIT = v; },
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
