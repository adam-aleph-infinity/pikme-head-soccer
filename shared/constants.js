// Head-soccer mock — every tunable number lives here.
// Change a value, reload, re-feel. Nothing else in the sim hard-codes a constant.
//
// EVERY NUMBER HERE IS THE NUMBER THE GAME RUNS AT. There used to be a PACE dial (0.68) that
// rescaled the speeds, gravities, drags and durations below on load, so the file said 1180 and
// the ball fell at 546. It is gone: the movement numbers are now measured off Head Soccer
// itself (docs/hs-reference.json, fitted from Idan's recordings, M1–M4) and a measured number
// only means something if it is the one the sim uses. Anything that was not re-measured was
// carried over at its old live value (authored x 0.68, x 0.68², ^0.68 or / 0.68), so it plays
// exactly as it did. Units: world px (the 1060-wide pitch, which is what the HS recordings are
// normalised onto wall-to-wall) and seconds.

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
// THE CEILING IS OFF THE TOP OF THE SCREEN. HS M4: a lofted ball leaves the top of the picture
// and comes back, turning at world y ≈ −130 (its CENTRE, extrapolated from the flights either
// side, n = 3). So the surface is a ball's radius above that. It used to be at +30, inside the
// picture, which is why every high ball here rattled along an invisible roof.
export const CEIL_Y = -130 - 15;      // -145: the ball centre turns at -130 (BALL_R 15)
// HS M4, 3 ceiling bounces: the ceiling is DEAD. It keeps 0.41 of the climb (0.27–0.55, low
// confidence — the contact itself is off-screen) and ALL of the sideways speed: in HS a ball that
// leaves the top keeps travelling the way it was going and comes back down further along, not
// straight down from where it vanished (Idan).
export let CEIL_BOUNCE = 0.41;
export let CEIL_KEEP_X = 1;
// The top of the SKY as drawn — where effects lay out a ceiling, rain from, hang a banner. It
// was the same number as the ball's ceiling until the ceiling moved off-screen; the effects
// are pictures and stay inside the picture.
export const SKY_Y = 30;
// HOW MUCH SKY THE CAMERA SHOWS: world px from the grass to the top edge of the picture. HS
// M3/M4 calibration: the grass line sits at frame y 489 of 590 and the whole screen height is
// the game (the ball flies over the HUD), so 489 x 0.9953 = 487 px of sky. The renderer fits at
// least this much above the ground; with the ceiling at -130 a ball can still leave the top —
// as it does in HS, ~4% of live play (docs/hs-estimates.json ball.offscreenFrac).
export const VIEW_ABOVE_GROUND = 487;

export const TICK = 1 / 60;           // sim step (fixed)

// ---- Goals -----------------------------------------------------------------
// HS M3/M4 calibration (C0 stills): the goal mouth is 56.7px deep, wall to goal line. Depth is
// not a scoring dimension — the line is at the front post — but it is what keeps the net's mesh
// above a texel at PIXEL 2, and 57 still clears that.
export let GOAL_W = 57;
// HS C0 calibration: the TOP of the crossbar stands 138.3px above the grass. Our bar is a
// capsule of radius POST_R centred on GROUND_Y - GOAL_H, so its top is GOAL_H + POST_R up:
// 133 + 5 = 138. (It was 144 — a request, never a measurement.)
//
// JUMP_V is no longer derived from this. It used to be solved so a jump reached "close to the
// bar and never over it"; it is now Head Soccer's own measured jump, and the rule simply holds
// on its own — a jumping crown tops out ~116px up against a bar underside at 128 (headReach()).
export let GOAL_H = 133;
export const POST_R = 5;              // crossbar radius (ball bounces off it)

// ---- Ball ------------------------------------------------------------------
// HS M4 31.0 s, the ball at rest mid-pitch: 72 x 60 px = 35.9 x 29.9 world — an oval, because HS is
// stretched 1.2x sideways (below). BALL_R is its VERTICAL (native) radius; sideways it is
// BALL_R x HS_STRETCH = 18. (It was one round 16.5, and before that 12.)
export const BALL_R = 15;
// HS IS STRETCHED 1.2x SIDEWAYS. It draws a 3:2 (480x320) picture and widens it to its 1.8:1 box,
// so on the phone every round thing is an oval: the ball 72 x 60 screen px (M4 31.0 s at rest,
// M3 6.0 s falling — the same in both, so it is the screen, not the sprite), the pause ring
// 116 x 95, the score coins alike. The sim solves every round contact in that native space
// (shared/sim.js SX); the renderer draws the ball OVAL_X wider. Photo faces are not stretched.
export const HS_STRETCH = 1.2;
export const OVAL_X = HS_STRETCH, OVAL_Y = 1;
// HS M4, 86 clean free flights across two matches: 583 px/s² (sd 15); M3's 8 falls straight after
// a respawn read 561 (sd 10). 580 is inside both — 0.2 sd off the number to fit, and the one
// value neither measurement rejects. Measured SEPARATELY from the player's 595 (PLAYER_GRAV) and
// the two agree within error — Box2D almost certainly runs one world gravity. They stay two
// constants because they were two measurements, and because the arcade bends the ball's
// without touching the bodies'.
export let BALL_GRAV = 580;
// HS M4, 17 free flights of 36+ frames: horizontal drag 0.099 /s (IQR 0.095–0.105) — Box2D's
// linearDamping ~0.1. Was 0.184 /s, which landed long balls ~40 px short.
export let BALL_AIR = 0.998351;     // per tick = exp(-0.099 / 60)
// HS M4 ground rolls decay at 0.11–0.21 /s in all (111.0 s: 6.6 s and 404 px, 82 → 40 px/s).
// This plus BALL_AIR is ~0.15 /s. Was 0.73 /s in all: an 80 px/s ball stopped after 111 px.
export let BALL_GROUND_FRICTION = 0.99915;   // per tick = exp(-0.051 / 60)
export let BALL_BOUNCE = 0.65;      // HS M3, 5 ground bounces: 0.58–0.70 (low confidence); M1–M6, 52 clean: 0.64
// THE GRASS GRIPS. HS M1–M6, 52 clean bounces with nobody within 80 px: the ball keeps a median
// 0.84 of its sideways speed through a bounce, and what it loses is 0.07 of the landing's impulse
// (Δ|vx| / Δvy: 0.071 for soft landings, 0.058 medium, 0.085 hard, so one Coulomb friction, Box2D's).
// A hard landing (vy 700+) keeps only ~0.4. Ours kept 0.99, which is why our ball skated across the
// pitch where HS's lands, checks and hangs (sideways speed p25 HS 67 px/s, ours 129; _phys-compare.mjs).
// The side walls show the same grip on the up-and-down speed (0.06–0.10, 3 bounces).
export let BALL_GRIP = 0.07;
// Unmeasured in HS, but every surface that is (grass 0.65, goal roof 0.67, head 0.70–0.79) sits
// at 0.63–0.79 — one Box2D restitution. Was 0.86, livelier than everything else on the pitch.
export const BALL_WALL_BOUNCE = 0.67;
// HS M4, the ball dropped onto the goal's roof: 0.67. Every bar segment (the near rail, the
// roof, the roof's edge) shares it; the front bar alone has not been measured.
export let BAR_BOUNCE = 0.67;
// Hard ceiling on a loose ball. Raised from 1050 when the strike became a collision: at 1050
// an ordinary lofted kick already arrived AT the ceiling (382 across, 597 up, 709 of a paced
// 714), so every "better contact" was clipped straight back off and a well-met ball felt
// exactly like a scuffed one. The headroom is what makes meeting the ball worth doing.
// It is still the budget a shot SPENDS: a lofted kick puts most of it into climbing, which is
// why the flat drive off the toe is the fastest shot in the game.
// HS M5 29.09–29.36 s: a dash into a slowly rolling ball sent it along the grass at ~1970 px/s,
// and it KEPT that speed — 1980 → 1950 over the next 15 frames, which is the air drag and
// nothing else. So HS has no cap anywhere near the 1100 that sat here (M4's fastest ordinary
// touches, 1001–1091, were only the fastest seen, not a ceiling): a dash-fired ball was clipped
// back to 1100 the tick the dash ended. The dash-fired ball is the fastest ordinary ball HS
// shows, so the ceiling sits exactly on it: a body dashed into the ball can hand it no more
// than this, and a shot met cleanly off the boot (~1050) is nowhere near it.
export let BALL_MAX_SPEED = 1970;
// …and while a dash is pushing it, the ball may run ahead of the dasher by this factor: HS M5
// 29.12–29.16 s, the dash-touched ball's first three frames at ~2240 px/s = 1.25 x the 1790 dash,
// then 1970 the frame the dash ended. The same ~2250 off every other dash touch in M5 (42.09,
// 65.30, 69.89 s). A ball held just ahead of the body is pushed, not pumped.
export let DASH_BALL_CAP = 1.25;
export const BALL_SPIN_DECAY = 0.985;

// ---- Player ----------------------------------------------------------------
// The single most important ratio in the whole game: PLAYER_SPEED vs how fast a struck
// ball crosses the pitch. At 3-4x the bot could never recover and matches finished 15-12;
// keeping the ball to roughly 2x a running player is what makes defending possible at all.
// HS C0 calibration, chosen by Idan as the exact Head Soccer size: a 52.8px head (diameter),
// 5.0% of the pitch. It was 60, held over the reference so a Saltiz card face stayed readable;
// parity won that argument.
export let HEAD_R = 26.4;
// The body is not measured, so it keeps its old proportion to the head: 32 x 27 under a 30px
// head, x 0.88 for the 26.4 one. The head still overlaps the torso by NECK (was 8, same 0.88).
export const BODY_W = 28;
export const BODY_H = 24;
export const NECK = 7;
// PLAYERS ARE SOLID TO EACH OTHER (HS M4): head circle + body box against head circle + body
// box, so a player can stand on the other's head, lean on its shoulder, and be pinned there.
// Standing on a crown puts the boots BODY_H + 2·HEAD_R − NECK = 69.8px up, which is HS's own
// (M4 52.95–53.43 s: the upper head sits 70px above a standing one), so the shapes need no fudge.
//   BODY_GRIP  friction between two bodies, one way only: it can hold an airborne body UP
//              against the one pushing into it (HS M4 66.40–66.78 s, the CPU hung on the
//              dasher's shoulder while he kept pushing; 53.75 and 159.3 s the same). It never
//              slows a body going up, and it never carries anybody sideways — a player
//              standing on a head stays put while the head walks away under it (M4
//              53.00–53.40 s). Unmeasured as a number; 0.5 holds a walk-speed push.
export let BODY_GRIP = 0.5;
//   CLIMB_V    an airborne body whose boots are up past the other's head centre, and that is
//              pushing into it, climbs the curve of that head at this speed instead of hanging
//              on the shoulder — up until the crown is under its boots and it stands there.
//              HS M4 51.76–52.45 s: the human jumped beside the CPU holding R; past the top of
//              the jump (boots ~45px up, the CPU's head centre is 43) the head kept rising, a
//              steady 60–66px/s (head top 370 → 348 over 52.10–52.43 s), until he stood on the
//              crown 70px up. M4 160.0–160.1 s the same off the shoulder hang.
export let CLIMB_V = 64;
// HS M4 21.05–29.4 s, 10 standstill jumps: the head's path is ONE parabola, 595 px/s² on the
// way up and the way down alike (fit rmse < 0.8px). There is no heavier fall — the FALL_MULT
// 1.55 that sat here was a platformer's trick, and HS does not use it.
export let PLAYER_GRAV = 595;
// HS M4 32.3–33.9 s and 85.4–88.4 s: 228 px/s flat out.
export let PLAYER_SPEED = 228;
// IN THE AIR, 241. HS M5 6.46–15.81 s, Idan's jump tests: 8 airborne runs with an arrow held,
// 229–252 px/s (median 241), against 224–228 on the grass in the same takes (9 runs) and M4's
// 228. The steering is still instant — let go of the arrow at the top and the body stops dead
// mid-air, press the other and it reverses that frame. Box2D would do exactly this: the stick
// sets the velocity, and the grass's friction takes a few percent back off it every step.
export let PLAYER_AIR_SPEED = 241;
// AND THERE IS NO ACCELERATION. HS M4: full speed within 3 frames of the arrow lighting, stopped
// within 3 frames of it going dark, and a reversal at full speed turns in the same 3 — so the
// body takes the stick's velocity on the tick it is pressed. The air is the same (HS M5's jump
// tests, 6.46–15.81 s): no momentum kept once the arrow is let go, only the speed is higher.
//
// Two things still slide. A SHOVE (a tackle) owns the body for TACKLE_SHOVE and bleeds off at
// PLAYER_FRICTION a tick on the grass. And the arcade's grip powers (ice, mud) take the instant
// grip away and accelerate at SLIP_ACCEL x their own factor — the old ground grip, kept as the
// TIME it took to reach top speed (1572 px/s² to the old 292 px/s: 0.19s) rather than as the raw
// number, so against HS's 228 it is 1226, and ice still takes as long to get going as it did.
export const PLAYER_FRICTION = 0.80;
export let SLIP_ACCEL = 1226;
// HS M4 21.05–29.4 s: every jump 45.8px, hold or tap — one fixed impulse, no variable height.
// Takeoff 235 px/s against 595 px/s² gives the 46px apex (v²/2g = 46.4). The constant is 240
// because the sim steps velocity before position (semi-implicit), and that puts every sampled
// frame on a parabola launched at JUMP_V − g·dt/2 = 235 — which is what a camera on this sim
// measures, and what the parity harness does.
//
// The same parabola lands 2·235/595 = 0.79s after takeoff. HS's own tracker read 0.74s off the
// same jumps (0.70 in M3), which no single parabola with that apex and that gravity can do:
// the three HS numbers disagree with each other, and apex and gravity are the two with the
// tighter fits. See the airtime rows in test-hs-parity.
export let JUMP_V = 240;
export const MAX_JUMPS = 1;          // HS: no double jump
// HOLD JUMP AND YOU KEEP JUMPING. HS M4 23.81–26.25 s: with JUMP held the head leaves the grass
// again 0.05s (3 frames) after every landing, on its own. A fresh press still takes off on the
// very frame it is pressed.
export let JUMP_REJUMP = 0.05;

// ---- Dash (double-tap a direction) ----------------------------------------
export const DASH_WINDOW = 0.24;      // s between the two taps
// HS M4 dash-mash, 45.84–47.08 s and 57.71–58.72 s: a burst, not a sprint — 1790 px/s peak,
// 0.067s (4 frames) and ~120px above the half-way speed, then straight back to a walk. Those are
// what the tracker READS, and it reads speed off a 3-frame fit that smears each edge of a burst
// by half a frame. Run through the same fit, a burst of 5 ticks at 1790 reads exactly 4 frames
// and 120px (4 x 29.8), and 4 ticks reads 3 frames and 95px — so the dash is 5 ticks, 0.083s,
// 149px end to end. Written a hair under 5/60 so the countdown cannot round up into a sixth.
export let DASH_V = 1790;
export let DASH_TIME = 0.082;
// HS M4 57.93 → 58.34 s, the two closest dashes while mashing: at least 0.42s apart.
export const DASH_COOLDOWN = 0.42;

// ---- Kick ------------------------------------------------------------------
// HS M4 29.67–31.96 s, kick mashed with no ball near: the leg is out 0.25–0.27s…
export let KICK_TIME = 0.26;
// …and a mashed kick comes round every 0.349s (median of 11; shortest 0.317). The leg-out time
// and the repeat are two different clocks — the swing ends, and there is still a beat before
// the next can start. (Only the timing is HS's so far: what the boot does to the ball is the
// kick contact model, a later pass.)
export const KICK_COOLDOWN = 0.349;
// THE BOOT IS A BODY (HS: Box2D). The swing's path is shared/kick.js — the drawing and the sim
// read the same keyframes — and the ball bounces off the boot like off any other surface:
// relative to the boot's own motion, along the contact normal, with these two numbers.
//
// M5 80.59–80.71 s, the one clean kick filmed frame by frame: the ball, rising off a bounce
// (~260 px/s by the time they met), sat right on top of the boot as it climbed at ~730 px/s, and
// left straight up at ~1050 px/s (horizontal ~0). v_out = v_boot + e·(v_boot − v_in) →
// e = (1050 − 730) / (730 − 260) = 0.68. Re-staged in this sim (ball 48 px ahead, rising
// through the boot's climb) it leaves at 1050 px/s, 87°. 0.68 also sits with every other HS
// surface (head 0.70–0.79, goal top 0.67, grass 0.65): Box2D mixes restitution as the larger of
// the pair, so everything the ball touches reads alike.
// The boot is drawn 24 x 13.5 px; its collision is a disc of the boot's mean half-size.
export let BOOT_R = 9;
export let BOOT_BOUNCE = 0.5;
// Grip across the contact (Box2D friction): how much of the ball's sliding speed across the
// boot's face the strike takes with it, as a fraction of the normal impulse, Coulomb-capped.
// Small: the M5 kick left with no sideways speed although the boot was still inching forward.
export let BOOT_GRIP = 0.1;
// How much of the boot's path speed the ball feels (fitted: see below).
export let BOOT_DRIVE = 1;
// …and how much of the BODY's speed rides on the boot (fitted: see below).
export let BOOT_BODY = 0;
// The kick stat (1–10, arcade only) swings the boot faster, not further: HS "the higher the
// Kick, the further the ball travels and the faster it goes" (wiki, Stats).
//
// The REACH numbers below are not the boot. They are the summary of where it can be that
// the CPU (shared/bot.js), the early power-shot block and the tests use to stand things in
// range: KICK_REACH ahead of the body, a ball on the grass that the boot strikes on the very
// first frame of the swing (f1 sits 0.9 R out; a ball centre up to ~48 px out still touches
// it), KICK_REACH_HI / KICK_HI_Y the held boot, KICK_R the slack around both.
export let KICK_REACH = 45;
export let KICK_R = 22;
export let KICK_REACH_HI = 50;
export let KICK_HI_Y = 58;
// A HEAD IS SPRINGY (HS M4). The passive touch — no KICK — is a restitution bounce off the
// head, measured RELATIVE to the head: the ball leaves along the normal at HEAD_BOUNCE times
// the speed it closed at, plus the head's own speed. So a standing head sends a 466px/s drop
// back up at ~0.75 of it, and a head still rising from its jump sends it back FASTER than it
// came — M4's passive jumping headers leave at a median ~720px/s off a ~580px/s arrival.
//   standing   M4 52.76 s (a player standing on the other's head, still): 466 in, 367 out = 0.79
//   jumping    M4 84.96 / 86.98 / 99.71 / 131.85 / 133.94 / 167.89 s: 0.78 0.62 0.64 0.68 0.74 0.71
//              (head speed from the jump's own kinematics — takeoff 235, g 595 — off the frame
//              the jump started; the human's KICK button was dark on every one of his touches)
// One number for both, 0.75 — between the two, and near the ball's own off the grass (0.65) and
// the goal top (0.67): Box2D mixes restitution as the max of the pair, so a ball of ~0.7 reads
// ~0.7 off everything. Measured back off our sim the way the video was (hs-scenarios headDrop,
// headerPassive): 0.74 standing, 0.70 jumping, a passive header leaving at 735px/s (HS 717).
// It replaced HEAD_DEADEN (0.58 of the pace kept, approach cancelled — a dead cushion: a jump
// into a falling ball left at ~170px/s where HS's leaves at ~700).
export let HEAD_BOUNCE = 0.75;
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


// ---- Jump feel -------------------------------------------------------------
// Two forgiveness windows, both cut to 3 frames. HS shows no input lag at all — a jump press
// is visible on the takeoff frame — and a window that is invisible on video can only be kept
// small, not measured:
// COYOTE: you may still jump for this long after being bumped off the grass.
// BUFFER: a jump TAPPED this long before landing still fires on touchdown. (A jump HELD
// through the landing needs no buffer — it re-jumps on its own, see JUMP_REJUMP.)
// There is no FALL_MULT any more: HS's jump is one symmetric parabola (PLAYER_GRAV).
export let COYOTE_TIME = 0.05;
export let JUMP_BUFFER = 0.05;

// ---- Tackling --------------------------------------------------------------
// Kicking the OPPONENT rather than the ball. In Head Soccer that is a SHOVE and nothing else:
// the victim is knocked back toward their OWN goal, which is the whole of the risk/reward —
// you clear a keeper off the ball, or you push him into his own net with the ball in front of
// him. It pays no power gauge and takes no health (there is no health: see the note below).
// IMMUNE exists so a faster player cannot simply stand next to a slower one and juggle them.
//
// Kicking someone in the back is the one hit they could not see coming, and it shoves LESS —
// kept from the old model because nothing in HS contradicts it yet; measured values replace it.
export let TACKLE_PUSH_BACK = 0.45;  // the shove, scaled down when it lands from behind
export let TACKLE_PUSH = 343;        // knockback from the front: 292 carried an airborne victim 102 px, 343 the measured 120
export let TACKLE_LIFT = 136;        // (200 x old PACE)
// How long the shove OWNS the body. Movement is instant now (PLAYER_SPEED), so without this the
// victim's own stick — or letting go of it — would cancel the knockback on the very next tick.
// About the flight time of the lift (2 x 136 / 595 = 0.46s) less the landing, so the shove
// carries through the air and a short slide, and then the controls are theirs again.
export let TACKLE_SHOVE = 0.35;
// …BUT ONLY WHEN THE VICTIM IS ALREADY IN THE AIR. HS M4 102–121 s (Idan booting the CPU over
// and over, docs/hs-estimates.json kick.knockback.*): a player kicked while STANDING stays on
// his feet, rocks back ~25° for KICK_REEL and slides ~20–60 px toward his own goal; only one
// kicked mid-jump is carried off, ~110–140 px and up (6299/6345). So the push/lift above is the
// airborne shove, and a grounded one is this slide — TACKLE_GROUND_PUSH px/s bled off by
// PLAYER_FRICTION every tick, which comes to ~40 px — with no lift at all.
export let TACKLE_GROUND_PUSH = 644;   // 820 slid 51 px in this sim; 644 slides the measured 40
export let KICK_REEL = 0.2;          // s a grounded victim is rocked back (HS: 8–12 frames a kick)
// HS lands boots on the same player 0.17–0.6 s apart (M4 6201/6211/6221, 7121/7131/7148), so
// the old 1.1 s of immunity swallowed most of the kicks Head Soccer counts. It is now only the
// guard against one swing landing twice; a single kicker's KICK_COOLDOWN (0.349) is the real
// rate, and the knockout below is what stops a juggle.
export let TACKLE_IMMUNE = 0.3;      // s before the same player can be tackled again

// ---- THE KNOCKOUT: stars after enough kicks --------------------------------
// Head Soccer's one "damage" rule (wiki, Power Shot Guide: "if you get damaged three times you
// will get knocked out, and it resets the three times"), counted off the footage:
//   * every kick that connects rocks the victim back; most do nothing else;
//   * every KICK_HURT_EVERY-th one HURTS: red drops fly off the head and the face bruises a tier
//     (HS M4 106.0 s / 116.7 s on the CPU, the bruise still there after the goal at 117.5 s);
//   * the KICK_HURTS_TO_KO-th hurt knocks him out: three stars, head tipped back, no controls,
//     for KICK_KO_TIME (M3 82.60–84.57 s = 1.97 s; M4 119.3 s ran until the goal reset cut it).
// M4 match 2 took 15 connected kicks from the first to the stars (hurts on the 6th, 9th, 15th):
// 5 x 3 = 15 is that total as a fixed rule, and HS shows no clock on it — the gap between the 1st
// and 2nd hurt was 9 s with only three kicks in it. It is not reset by a goal (M4 117.5 s) and
// is reset by the knockout. The count is kicks, never time, so it is fully deterministic.
export let KICK_HURT_EVERY = 5;
export let KICK_HURTS_TO_KO = 3;
export let KICK_KO_TIME = 2.0;
// A kick on a player already knocked out (Idan): he slides back fast toward his own goal —
// KO_KICK_SLIDE px/s bled off by KO_SLIDE_FRICTION a tick on the grass, ~470 px in ~1 s.
export let KO_KICK_SLIDE = 1500;
export let KO_SLIDE_FRICTION = 0.95;
export let KO_SLIDE_TIME = 1.0;

// ---- REMOVED: hidden health ------------------------------------------------
// There used to be an invisible health bar here (HP_*, KICK_DAMAGE, POWER_DAMAGE): every boot
// and every blocked power shot took a slice, the face reddened and bruised through four tiers,
// and bottoming out stunned you for 1.75s. Head Soccer has none of that — a hit shoves you and
// a blocked power shot bounces off you, and that is all — so it is gone. (What came back is not
// health: the KNOCKOUT above counts kicks, and its bruise is a tier per hurt, off the footage.)
// What survives is the generic STUN TIMER (`p.stunned`, stun()/tickStun() in shared/sim.js),
// because arcade powers still knock people down with it and HS's own ailments will too.
export let STUN_TIME = 1.25;         // s a power that "knocks down" takes the controls away for

// ---- Impact ----------------------------------------------------------------
// Hit-stop: freeze the whole sim for a few frames on a heavy connect.
//
// NOT ON AN ORDINARY TOUCH ANY MORE — Head Soccer has none. Kicks and headers used to freeze the
// whole game for 0.035s, which on 60Hz ticks is THREE frozen frames (50ms), and a boot into the
// opponent froze it for 0.06s (four frames). A bot match makes ~85 ball touches, so the game
// stopped dead ~85 times a match, and the kick cooldown did not run under those stops (0.349s
// became ~0.40s after every touch). That is the "the game feels a little bit stuck" report. HS M3's
// ball track (docs/hs-clips/M3-*.tracks.json) has 93 contact impulses and only 5 with a still
// frame anywhere in the 3 frames before them; with the old hit-stop every one of ours had three.
// A tackle has no footage; it goes to zero with the kick, the same engine with no reason to differ.
// A BLOCKED power shot keeps its short stop (rare, ~0.3 a match) and a fired one is POWER_CUTIN.
export let HIT_STOP_KICK = 0;
export let HIT_STOP_POWER = 0.085;  // a BLOCKED power shot; a fired one is POWER_CUTIN
export let HIT_STOP_TACKLE = 0;

// ---- Power shots -----------------------------------------------------------
// THE GAUGE FILLS OVER TIME, and only over time — Head Soccer's rule. It used to be earned off
// the opponent (a fifth of a gauge per tackle) with a quarter-gauge consolation for conceding;
// both are gone, so the meter is a clock both players can read and neither can farm. It stays
// full until spent and freezes in sudden death (chargeGauge in shared/sim.js).
//
// HOW FAST, measured, HS M4 (the starter character), with the refill timed from the PRESS —
// which is where it starts (M4 36.49 s: empty by 36.56 s, climbing at 36.67 s, 5.4 s before
// the shot fires at 41.93 s; see gauge.emptyOnPress / gauge.refillStart):
//   first fill  15.0s  — the KICK OFF banner going to the POWER plaque (19.57 → 34.56 s)
//   refill      15.2s  — press (36.49 s) → plaque (54.88 s) is 18.4 s, and the bar stands
//                        still for 3.2 s of it: from the goal at 43.40 s until the ball drops
//                        in at 46.59 s. The cut-ins in the window (40.44, 41.97 s) do not
//                        stop it; the bar climbs 17.5 px/s through both.
// The two agree, so it is ONE play-time clock at 1/15 with no head start: it stops under
// the kickoff banner and through a goal's restart (until the ball is back), and runs
// through cut-ins. (It used to be 1/13 of wall clock plus a 2 s lead — a fit to a refill
// timed from the FIRE, 13.0 s, which had the press-to-fire 5.4 s cut off its front.)
// M3 (another character) climbs at the same 17.4 px/s and stops at its goals too.
// Per-character fill (the Power stat) comes with the arcade's stats; this is the starter's.
export let GAUGE_PASSIVE = 1 / 15;   // fraction of the gauge per second of play
// Conceding a goal adds this much to the conceder's gauge when the ball drops (HS M4 43.5 s: +0.32).
export let GAUGE_CONCEDE = 1 / 3;
export let GAUGE_LEAD = 0;           // s of play after the kickoff before the gauge starts

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

// How high the top of a jumping head gets: the jump's apex plus a standing crown. Ballistic, so
// derived rather than measured per tuning. (The sim's sampled apex sits g·dt/2 of speed under
// this — see JUMP_V — so this errs a pixel or two HIGH, which is the safe side for a rule about
// never clearing the bar.)
export const headReach = () => (JUMP_V * JUMP_V) / (2 * PLAYER_GRAV) + BODY_H + HEAD_R * 2 - NECK;

// THE CUT-IN. HS M4: when a power shot FIRES the screen darkens round the shooter and the whole
// game stops — both players, the ball, the clock. It is a sim pause (m.hitStop, and m.cutin says
// whose), not a client effect, so an online match freezes on the same tick on both phones; the
// renderer only draws the spotlight over it. Timed from THE TOUCH, frame by frame at 60 fps
// (docs/HS-POWER-VFX-RESEARCH.md §5; M4 40.20, 59.97, 122.67, 150.38 s, identical to a frame):
// the dark starts 3 frames after the touch, the ball leaves 1.27 s after it (f76) and the dark
// is half-lifted 1.50 s after it (f90–91). POWER_CUTIN is touch → half-lifted.
export let POWER_CUTIN = 1.5;
// …but only the first 1.27 s of it is a freeze: the ball leaves then and play runs under the last
// 0.23 s of the dark — the defender at M4 61.45 s kicks and blocks before it lifts.
export const POWER_RELEASE = 0.23;
// Where the ball leaves from: out in front of the shooter's head centre, in head radii (M4 40.20 s
// f56–f75 and the left-side counter at 41.78 s — it drifts there during the cut-in).
export const POWER_RELEASE_AT = 2.5;
// …and its HEIGHT is always the shooter's HEAD, never the touch's: the cut-in lifts the ball up
// over the head and the head whips it out in front like a header (docs/HS-POWER-VFX-RESEARCH.md §5),
// so it leaves level with the top of the head — 30–45 px above the head's centre at every release
// (M4 41.38, 61.25/61.30, 123.95 s), standing or in the air. It used to keep the touch's height, so a
// power fired off the boot or the body flew along the grass (Idan). Head radii above the centre.
export const POWER_RELEASE_UP = 1.35;
// …but NEVER HIGHER THAN UNDER THE CROSSBAR. HS's ball leaves 99–111px above the grass at every
// release we measured (M4 41.38, 61.30, 123.95 s), shooters up to 36px in the air — never over
// ≈ 111, which is exactly where it still clears the bar (its underside is 128 up). So a shot fired
// from the top of a full jump (its head would put it 125px up, into the bar) flies just under the
// bar and goes in (Idan: "if I jump highest with the Korean power I will score"). Px of daylight
// between the ball and the bar's underside.
export const POWER_RELEASE_BAR_GAP = 3;
// HS M4 43.33 s and 80.85 s: a power shot that hits a player who is NOT armed dazes them for
// ~0.5s (three gold stars over the head).
export let POWER_BLOCK_STUN = 0.5;
// …and a power shot that HITS a player (not a block) puts him down for 0.9 s — HS M4 62.85 s: hit,
// thrown into his goal, his first move of his own at ≈ 63.75 s. (M4 80.85 s's 0.5 s ended in a goal
// and a restart, which cut it short.) Idan: "in HS he is stunned for much longer".
export let POWER_HIT_STUN = 0.9;
// THE COMET: HS M4 41.50–41.77 s and 43.07–43.33 s, 0.135 of the pitch per 1/15 s — 2.03 pitch
// widths a second, dead flat (docs/HS-POWER-SHOTS.md §3). A power shot crosses the whole pitch in
// half a second, 2.6x the hardest kick. Each family flies a multiple of it (shared/hs-powers.js).
export let POWER_SHOT_SPEED = 2150;
export let POWER_SHOT_LIFE = 2.0;     // s of flight before a power ball reverts to an ordinary one
// The pace a power ball keeps as it bounces off a player it HITS (not a kick-block): M3
// 38.30–38.45 s, ~1800 px/s back off the Mexico keeper from a 2150 px/s shot.
export let POWER_BLOCK_REBOUND = 0.84;
// The bot's reach for a kick-block (shared/bot.js). HS has no unarmed counter, so this is no
// longer a counter radius in the sim: a kick BLOCKS (hs-powers contact / earlyBlock).
export let COUNTER_WINDOW = 130;

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
// HS M4 kickoffs at 18.0 s and 95.2 s (and M1–M3's 2.16): the KICK OFF banner stands for 2.17s
// and nobody moves under it.
export const KICKOFF_FREEZE = 2.17;
// AFTER A GOAL there is no KICK OFF banner — a GOAL! one instead, and three clocks run from it
// (HS M3/M4, 7–8 goals each):
//   GOAL_BANNER      2.05s  the banner is up
//   GOAL_RESUME      2.24s  the players move again, at their spots
//   + GOAL_BALL_DELAY        and the ball drops in at the centre 2.795s after the goal — so for
//                            the first 0.555s of play there is no ball, and both players run to
//                            where it will be.
export const GOAL_BANNER = 2.05;
export const GOAL_RESUME = 2.24;
export const GOAL_BALL_DELAY = 2.795 - 2.24;
export const AFTER_GOAL = GOAL_BANNER; // free play under the GOAL! banner, then the spots (was 3 s)
// Sudden death's hold on the spots: the ball drops GOLDEN_HOLD + GOAL_BALL_DELAY = 2.5 s after the
// 0:00 whistle (HS M2 111.0 → 113.6 s). How long of that the players stand is an estimate.
export const GOLDEN_HOLD = 1.95;
export const GOLDEN_GOAL = true;      // draw → sudden death (gauges stop charging)

// ---- Spawns ----------------------------------------------------------------
// HS M3 and M5, the KICK OFF freeze: both players stand 221px from their own wall (250 was the
// first mock's guess, never measured).
export const SPAWN_X = [221, W - 221];
// HS M3, every respawn after a goal (n = 7): the ball appears 302px above the grass with no fall
// speed, drifting 138 px/s sideways — toward whoever conceded, so a restart is not a coin flip.
export const BALL_SPAWN = { x: W / 2, y: GROUND_Y - 302 };
export const BALL_SPAWN_DRIFT = 138;

// ---- Head Soccer ruleset switch ----------------------------------------------
// The migration flag for the Head Soccer parity work: off is today's game, on will be the
// measured HS rules. NOTHING reads it yet — it exists first so the switch can ship (and be
// flipped on a dev box) before any behaviour hangs off it. Flipped by `?hs=1` on a dev host
// (public/game.js) or `HS_RULES=1` for the server (server.js); always at boot, before a
// match exists. A boolean, so it sits outside tune(), whose setters are numeric sliders.
export let HS = false;
export function setHS(on) { HS = !!on; }

// ---- Live tuning -----------------------------------------------------------
// The whole point of a feel mock is that the numbers get argued with while playing, not
// between restarts. These are `let` so the debug panel can move them mid-match; `import *`
// gives every module a live binding, so a slider change lands on the very next tick.
const SETTERS = {
  DEADEN_ZONE: (v) => { DEADEN_ZONE = v; },
  CONTACT_IMPACT_V: (v) => { CONTACT_IMPACT_V = v; },
  HEAD_BOUNCE: (v) => { HEAD_BOUNCE = v; },
  BODY_GRIP: (v) => { BODY_GRIP = v; },
  CLIMB_V: (v) => { CLIMB_V = v; },
  BALL_IDLE_RESET: (v) => { BALL_IDLE_RESET = v; },
  COYOTE_TIME: (v) => { COYOTE_TIME = v; },
  JUMP_BUFFER: (v) => { JUMP_BUFFER = v; },
  JUMP_REJUMP: (v) => { JUMP_REJUMP = v; },
  TACKLE_SHOVE: (v) => { TACKLE_SHOVE = v; },
  TACKLE_PUSH: (v) => { TACKLE_PUSH = v; },
  TACKLE_PUSH_BACK: (v) => { TACKLE_PUSH_BACK = v; },
  TACKLE_LIFT: (v) => { TACKLE_LIFT = v; },
  TACKLE_IMMUNE: (v) => { TACKLE_IMMUNE = v; },
  TACKLE_GROUND_PUSH: (v) => { TACKLE_GROUND_PUSH = v; },
  KICK_REEL: (v) => { KICK_REEL = v; },
  KICK_HURT_EVERY: (v) => { KICK_HURT_EVERY = v; },
  KICK_HURTS_TO_KO: (v) => { KICK_HURTS_TO_KO = v; },
  KICK_KO_TIME: (v) => { KICK_KO_TIME = v; },
  STUN_TIME: (v) => { STUN_TIME = v; },
  HIT_STOP_KICK: (v) => { HIT_STOP_KICK = v; },
  HIT_STOP_POWER: (v) => { HIT_STOP_POWER = v; },
  HIT_STOP_TACKLE: (v) => { HIT_STOP_TACKLE = v; },
  GROUND_Y: (v) => { GROUND_Y = v; },
  BALL_GRAV: (v) => { BALL_GRAV = v; },
  BALL_AIR: (v) => { BALL_AIR = v; },
  BALL_GROUND_FRICTION: (v) => { BALL_GROUND_FRICTION = v; },
  BALL_BOUNCE: (v) => { BALL_BOUNCE = v; },
  BALL_GRIP: (v) => { BALL_GRIP = v; },
  BAR_BOUNCE: (v) => { BAR_BOUNCE = v; },
  CEIL_BOUNCE: (v) => { CEIL_BOUNCE = v; },
  CEIL_KEEP_X: (v) => { CEIL_KEEP_X = v; },
  BALL_MAX_SPEED: (v) => { BALL_MAX_SPEED = v; },
  GOAL_H: (v) => { GOAL_H = v; },
  GOAL_W: (v) => { GOAL_W = v; },
  HEAD_R: (v) => { HEAD_R = v; },
  PLAYER_GRAV: (v) => { PLAYER_GRAV = v; },
  PLAYER_SPEED: (v) => { PLAYER_SPEED = v; },
  PLAYER_AIR_SPEED: (v) => { PLAYER_AIR_SPEED = v; },
  SLIP_ACCEL: (v) => { SLIP_ACCEL = v; },
  JUMP_V: (v) => { JUMP_V = v; },
  DASH_V: (v) => { DASH_V = v; },
  DASH_TIME: (v) => { DASH_TIME = v; },
  KICK_TIME: (v) => { KICK_TIME = v; },
  KICK_REACH: (v) => { KICK_REACH = v; },
  KICK_R: (v) => { KICK_R = v; },
  BOOT_R: (v) => { BOOT_R = v; },
  BOOT_BOUNCE: (v) => { BOOT_BOUNCE = v; },
  BOOT_GRIP: (v) => { BOOT_GRIP = v; },
  GAUGE_PASSIVE: (v) => { GAUGE_PASSIVE = v; },
  GAUGE_CONCEDE: (v) => { GAUGE_CONCEDE = v; },
  GAUGE_LEAD: (v) => { GAUGE_LEAD = v; },
  POWER_CUTIN: (v) => { POWER_CUTIN = v; },
  POWER_BLOCK_STUN: (v) => { POWER_BLOCK_STUN = v; },
  POWER_SHOT_LIFE: (v) => { POWER_SHOT_LIFE = v; },
  POWER_BLOCK_REBOUND: (v) => { POWER_BLOCK_REBOUND = v; },
  POWER_SHOT_SPEED: (v) => { POWER_SHOT_SPEED = v; },
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
    DEADEN_ZONE,
    CONTACT_IMPACT_V,
    HEAD_BOUNCE,
    BODY_GRIP,
    BALL_IDLE_RESET,
    COYOTE_TIME,
    JUMP_BUFFER,
    JUMP_REJUMP,
    TACKLE_SHOVE,
    TACKLE_PUSH,
    TACKLE_PUSH_BACK,
    TACKLE_LIFT,
    TACKLE_IMMUNE,
    TACKLE_GROUND_PUSH,
    KICK_REEL,
    KICK_HURT_EVERY,
    KICK_HURTS_TO_KO,
    KICK_KO_TIME,
    STUN_TIME,
    HIT_STOP_KICK,
    HIT_STOP_POWER,
    HIT_STOP_TACKLE,
    GROUND_Y,
    BALL_GRAV,
    BALL_AIR,
    BALL_GROUND_FRICTION,
    BALL_BOUNCE,
    BAR_BOUNCE,
    CEIL_BOUNCE,
    CEIL_KEEP_X,
    BALL_MAX_SPEED,
    GOAL_H,
    GOAL_W,
    HEAD_R,
    PLAYER_GRAV,
    PLAYER_SPEED,
    SLIP_ACCEL,
    JUMP_V,
    DASH_V,
    DASH_TIME,
    KICK_TIME,
    KICK_REACH,
    KICK_R,
    BOOT_R,
    BOOT_BOUNCE,
    BOOT_GRIP,
    POWER_SHOT_LIFE,
    POWER_BLOCK_REBOUND,
    POWER_SHOT_SPEED,
    GAUGE_PASSIVE,
    GAUGE_LEAD,
    POWER_CUTIN,
    POWER_BLOCK_STUN,
    COUNTER_WINDOW,
    MATCH_DURATION,
  };
}
