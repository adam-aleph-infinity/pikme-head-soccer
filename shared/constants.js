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
export const CEIL_Y = -130 - 12;      // -142: the ball centre turns at -130 (BALL_R 12)
// HS M4, 3 ceiling bounces: the ceiling is DEAD. It keeps 0.41 of the climb (0.27–0.55, low
// confidence — the contact itself is off-screen) and none of the sideways speed: the ball comes
// back down almost vertically, so a skied clearance falls where it went up rather than
// carrying on down the pitch.
export let CEIL_BOUNCE = 0.41;
export let CEIL_KEEP_X = 0;
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
export const BALL_R = 12;
// HS M4, 86 clean free flights across two matches: 583 px/s² (sd 15); M3's 8 falls straight after
// a respawn read 561 (sd 10). 580 is inside both — 0.2 sd off the number to fit, and the one
// value neither measurement rejects. Measured SEPARATELY from the player's 595 (PLAYER_GRAV) and
// the two agree within error — Box2D almost certainly runs one world gravity. They stay two
// constants because they were two measurements, and because the arcade bends the ball's
// without touching the bodies'.
export let BALL_GRAV = 580;
export let BALL_AIR = 0.99694;      // per-tick horizontal air drag (0.9955 ^ the old PACE 0.68)
export let BALL_GROUND_FRICTION = 0.99182;
export let BALL_BOUNCE = 0.65;      // HS M3, 5 ground bounces: 0.58–0.70 (low confidence)
export const BALL_WALL_BOUNCE = 0.86;
// HS M4, the ball dropped onto the goal's roof: 0.67. Every bar segment (the near rail, the
// roof, the roof's edge) shares it; the front bar alone has not been measured.
export let BAR_BOUNCE = 0.67;
// Hard ceiling on a loose ball. Raised from 1050 when the strike became a collision: at 1050
// an ordinary lofted kick already arrived AT the ceiling (382 across, 597 up, 709 of a paced
// 714), so every "better contact" was clipped straight back off and a well-met ball felt
// exactly like a scuffed one. The headroom is what makes meeting the ball worth doing.
// It is still the budget a shot SPENDS: a lofted kick puts most of it into climbing, which is
// why the flat drive off the toe is the fastest shot in the game.
export let BALL_MAX_SPEED = 816;    // 1200 x the old PACE 0.68; HS C12 (hardest kick) unmeasured
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
// HS M4 21.05–29.4 s, 10 standstill jumps: the head's path is ONE parabola, 595 px/s² on the
// way up and the way down alike (fit rmse < 0.8px). There is no heavier fall — the FALL_MULT
// 1.55 that sat here was a platformer's trick, and HS does not use it.
export let PLAYER_GRAV = 595;
// HS M4 32.3–33.9 s and 85.4–88.4 s: 228 px/s flat out.
export let PLAYER_SPEED = 228;
// AND THERE IS NO ACCELERATION. HS M4: full speed within 3 frames of the arrow lighting, stopped
// within 3 frames of it going dark, and a reversal at full speed turns in the same 3 — so the
// body takes the stick's velocity on the tick it is pressed. The air is ASSUMED to be the same:
// no clip isolates air control yet (jump.airSpeed, C4, is unmeasured), and nothing in M4 shows a
// jumping body keeping speed the stick has let go of.
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
// From body centre. The drawn boot is three times longer than it was on request, and the
// reach follows it: a foot that looks like it can touch the ball and cannot is the reason the
// kick "did not kick so good". FOOT_LEN is the drawn length; the two are kept in step by
// deriving the reach from it.
// Was 3, which put a 33px boot on an 8px leg — longer than the body is wide, and the reason
// the foot read as a plank rather than as a shoe. A real boot is a bit under three times the
// ankle's width; 2.1 lands it at 23px, and the toe still arrives inside the kick circle the
// sim strikes from, so nothing about the reach is being lied about.
export let FOOT_LEN = 2.1;           // multiples of the original 3px boot plate
export let KICK_REACH = 62;
export let KICK_R = 22;              // kick hitbox radius
export let KICK_POWER = 367;         // 540 at the old PACE 0.68 — the kick contact model is a later
                                      // pass, so the boot is carried over at its live value.
                                      // Ball-only slowdown (Adam, 2026-08-21: "make ball slower").
                                      // 640 put a kicked ball at 1.49x the player, crossing the pitch
                                      // in 1.67s against the player's 2.48s — you could not get there.
                                      // 520 makes it 1.21x, which is a chase you can actually win.
// The upward component of an ORDINARY kick. It was 620 against a drive of 520 — a 50° launch
// before the bow and the contact point had even been read, which is why every clearance went
// up and almost nothing went at the goal. 400 against a drive of 540 is ~36° before the
// contact point flattens it, and the median strike over 30 bot matches falls from 23° to 15°
// with a fifth fewer balloons above 45°. Going UP is now something you ask for — get under it,
// or hold jump — rather than what the boot does by default.
//
// Measured, because flattening the shot does cost goals: 3.3 a match against the 4.9 the
// 50° kick scored (`_kickprobe` in the 2026-09-22 session; re-measure before moving this).
// Most of the gap is flat shots hitting a defender's body instead of sailing over it, which
// is the trade the flat shot is supposed to make.
export let KICK_LIFT = 272;          // 400 x the old PACE 0.68
// hold JUMP while kicking: more air, less drive. It was 2.5, and from the halfway line (where
// the bow adds its third) that sent the ball 539px up — to within a ball of the ceiling and
// ~0.9s off the top of the picture, every time. On a phone JUMP is often still held when KICK
// goes in, so this was the commonest way to lose the ball upward. Head Soccer has no lob; its
// jumping kick tops out ~340px (HS M4 167.9 s), and 1.9 puts the halfway-line lob at 352 —
// still well over a jumping defender (crown ~116px up), and inside the 475 the camera shows
// (VIEW_ABOVE_GROUND). Measured by ball.kickApex.lob (hs-scenarios kickLob).
export let LOB_LIFT = 1.9;
export let LOB_DRIVE = 0.62;
// Body contact KILLS the ball's pace (Adam: 'if it dosnt kick, the ball kinda stops and
// rolles'). The head still bounces — that is the aerial tool — but your torso deadens.
export let BODY_DEADEN = 0.18;
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
// ── THE BOOT, AIMED ──────────────────────────────────────────────────────────
// A kick used to fire dead flat along the way you were facing, which meant the only way to
// put the ball in the net was to be standing in exactly the right place. Now it BOWS toward
// the far goal: the horizontal keeps the facing, and the loft is chosen so the arc comes
// down around the goal mouth rather than flying over it.
export let KICK_AIM = 0.55;          // 0 = dead flat as before, 1 = fully aimed at the goal
// Was 1.35, which nearly doubled the loft of any strike from range — on top of a base lift
// that was already sending the ball up. The bow is meant to stop a long shot falling short,
// not to turn it into a punt, so it now adds at most a third: 0.55 of aim x 0.6 is 1.33x.
export let KICK_BOW = 0.6;           // how much extra loft the aimed kick gets
export let KICK_BOW_MIN = 260;       // px — below this range to the goal, do not loft at all,
                                     // or a tap from the six-yard box sails over the bar

// ── WHERE ON THE BOOT ────────────────────────────────────────────────────────
// A kick used to be ONE shot: the same speed and the same loft wherever on the foot the ball
// happened to land, so the only choice in it was the lob button. Now the CONTACT POINT is the
// shot. Two axes, both read off the ball's position inside the kick circle at the moment it
// connects:
//
//   along the boot   toe cap → a poke. Flat, fast, no air under it, because the tip of the
//                    foot meets the ball square and there is no instep beneath it to lift.
//                    Ankle end, the whole foot → the boot gets UNDER the ball and scoops it.
//   under the ball   the same story on the other axis. The kick circle sits at the height of a
//                    ball rolling on the grass, so this is ~0 for the ordinary ground kick and
//                    only grows for a ball dropping onto the boot — which is chipped.
//
// WHERE THE ORDINARY KICK SITS ON THAT AXIS. This used to be the middle of the boot, and that
// was the bug behind "it kicks straight up": a ball you are DRIBBLING is pinned against your
// body by the torso collision — half a body plus a ball, about 28px out — and the kick circle
// reaches from 28px to 96px, so the ordinary running kick lands at the very ankle end of it
// every single time. The ankle end is the scoop. Every dribble-and-shoot was a scoop.
//
// So the neutral point is where the ball ACTUALLY is on a normal kick, not the geometric
// middle of the circle. Both loft and drive are measured from here: at the neutral you get the
// plain 1.0 shot, past it toward the toe the ball goes flatter and harder, behind it toward
// the ankle the boot gets under it and scoops.
export let KICK_TOE_NEUTRAL = 0.25;  // 0 = ankle/heel end, 1 = toe cap
// Big enough that the very tip of the boot takes the loft all the way to zero — the dead flat
// shot has to stay REACHABLE, which is (1 - KICK_TOE_NEUTRAL) x this >= 1.
export let KICK_TOE_LOFT = 1.35;     // how far the toe/instep axis swings the loft
export let KICK_UNDER_LOFT = 0.4;    // and how much a boot under the ball adds
export let KICK_TOE_DRIVE = 0.7;     // what does not go up goes forward: the toe-poke's punch
// A ball DROPPING onto the boot brought its whole fall back out as lift, which made every
// volley a balloon. A boot swung forward into a falling ball sends it forward: most of that
// pace joins the drive and only a little of it the loft.
export let KICK_DROP_DRIVE = 0.35;
export let KICK_DROP_LOFT = 0.4;
// The bottom of the range is a DEAD FLAT shot — parallel to the grass, straight at the goal,
// and it has to be reachable or "kick it straight" is not a thing the player can choose. Meet
// the ball on the very tip of the boot and KICK_TOE_LOFT takes the loft to zero: no arc, no
// bow (the aim multiplies the loft, so nothing times nothing is still nothing), and the whole
// of the strike's energy going forward instead of upward. That last part is why the flat shot
// is also the FAST one — see BALL_MAX_SPEED, which a lofted kick spends most of on climbing.
export let KICK_LOFT_MIN = 0;
export let KICK_LOFT_MAX = 1.6;

// ── MEETING THE BALL ─────────────────────────────────────────────────────────
// A strike used to SET the ball's velocity: the same shot off a ball flying at you as off one
// asleep on the grass. It is a COLLISION, so the pace the ball carries INTO the boot or the
// forehead comes back out of it, and a cleanly met ball is the hardest thing on the pitch that
// is not an ultimate. Only the part coming AT the striker counts — a ball running away is
// caught up with, not smashed.
export let KICK_MEET = 0.55;         // of the ball's incoming pace, returned by a boot
export let HEAD_MEET = 0.62;         // …and by a header, which is the flatter, harder surface
export let HEAD_RISE = 0.6;          // of the jump's own rise, added to a header's lift. Heading
                                     // on the way UP is the timing this buys: at the apex the
                                     // rise is zero and it is just a header.

// ── THE HEADER ───────────────────────────────────────────────────────────────
// Pressing kick with the ball at head height is now a HEADER rather than a boot that misses.
// It is the aerial tool: less power than a kick, more loft, and it is the only way to hit a
// ball you cannot reach with your foot.
export let HEADER_POWER = 0.72;      // of a kick, horizontally
// Dropped from 1.35 when the header became a collision. A plain nod used to leave at 606 of a
// 714 ceiling entirely on this number, so a header that MET the ball — driven at you, taken on
// the rise — was clipped back to the same speed as one that did not, and the whole point of
// timing it was invisible. The base is softer now and HEAD_MEET and HEAD_RISE are what fill
// the gap: a lazy header is weak, a well-met one is the hardest strike on the pitch.
// Restated against the flatter boot: this is a multiple of KICK_LIFT, and KICK_LIFT went from
// 620 to 400 to stop the kick going up. The header is the AERIAL tool and wants to keep going
// up, so the multiple rises to hold the same 680 it had. It is now well above 1 because the
// header really is the lofted strike and the kick really is not.
// HS M4 checked it (docs/hs-estimates.json ball.launchSpeed.header / ball.headerApex): a jump
// into a ball falling at ~490 px/s leaves at 587 px/s and tops out 326px up; HS's median over
// 12 such headers is 590 and 310. The header was never what sent the ball off the screen —
// the camera was (see VIEW_ABOVE_GROUND) — so it stays.
export let HEADER_LIFT = 1.7;        // and more of the lift
export let HEADER_R = 16;            // px of slack around the head circle that still counts

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
export let TACKLE_PUSH = 292;        // knockback from the front — a real shove (430 x old PACE)
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
export let TACKLE_GROUND_PUSH = 820;
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

// THE CUT-IN. HS M4, 7 cut-ins: when a power shot FIRES the screen darkens round the shooter and
// the whole game stops for 1.34s (1.33–1.35) — both players, the ball, the clock. It is a sim
// pause (m.hitStop, and m.cutin says whose), not a client effect, so an online match freezes on
// the same tick on both phones; the renderer only draws the spotlight over it.
export let POWER_CUTIN = 1.34;
// …but only the first 1.14s of it is a freeze: the ball leaves then and play runs under the last
// 0.2s of the dark — the defender at M4 61.45 s kicks and blocks before it lifts. Measured against
// the dark itself (luma traces, docs/HS-POWER-SHOTS.md §2): the ball leaves 1.01–1.10 s after the
// half-dark point and the dark is half-lifted 0.22–0.31 s after it leaves (M4 40.40 → 41.41 →
// 41.72 s, 60.17 → 61.27 → 61.49 s, 122.87 → 123.97 → 124.24 s). The picture's dark is half-down
// 0.1 s after the touch and half-up 0.1 s after the sim's cut-in ends (champ-vfx drawCutin), so
// this puts the release 1.04 s after half-dark and the lift 0.3 s after the release.
export const POWER_RELEASE = 0.2;
// HS M4 43.33 s and 80.85 s: a power shot that hits a player who is NOT armed dazes them for
// ~0.5s (three gold stars over the head).
export let POWER_BLOCK_STUN = 0.5;
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
export const GOLDEN_GOAL = true;      // draw → sudden death (gauges stop charging)

// ---- Spawns ----------------------------------------------------------------
export const SPAWN_X = [250, W - 250];
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
  BODY_DEADEN: (v) => { BODY_DEADEN = v; },
  HEAD_BOUNCE: (v) => { HEAD_BOUNCE = v; },
  BODY_GRIP: (v) => { BODY_GRIP = v; },
  LOB_LIFT: (v) => { LOB_LIFT = v; },
  LOB_DRIVE: (v) => { LOB_DRIVE = v; },
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
  BAR_BOUNCE: (v) => { BAR_BOUNCE = v; },
  CEIL_BOUNCE: (v) => { CEIL_BOUNCE = v; },
  CEIL_KEEP_X: (v) => { CEIL_KEEP_X = v; },
  BALL_MAX_SPEED: (v) => { BALL_MAX_SPEED = v; },
  GOAL_H: (v) => { GOAL_H = v; },
  GOAL_W: (v) => { GOAL_W = v; },
  HEAD_R: (v) => { HEAD_R = v; },
  PLAYER_GRAV: (v) => { PLAYER_GRAV = v; },
  PLAYER_SPEED: (v) => { PLAYER_SPEED = v; },
  SLIP_ACCEL: (v) => { SLIP_ACCEL = v; },
  JUMP_V: (v) => { JUMP_V = v; },
  DASH_V: (v) => { DASH_V = v; },
  DASH_TIME: (v) => { DASH_TIME = v; },
  KICK_TIME: (v) => { KICK_TIME = v; },
  KICK_REACH: (v) => { KICK_REACH = v; },
  FOOT_LEN: (v) => { FOOT_LEN = v; },
  KICK_R: (v) => { KICK_R = v; },
  KICK_POWER: (v) => { KICK_POWER = v; },
  KICK_LIFT: (v) => { KICK_LIFT = v; },
  KICK_AIM: (v) => { KICK_AIM = v; },
  KICK_BOW: (v) => { KICK_BOW = v; },
  KICK_TOE_NEUTRAL: (v) => { KICK_TOE_NEUTRAL = v; },
  KICK_TOE_LOFT: (v) => { KICK_TOE_LOFT = v; },
  KICK_UNDER_LOFT: (v) => { KICK_UNDER_LOFT = v; },
  KICK_TOE_DRIVE: (v) => { KICK_TOE_DRIVE = v; },
  KICK_DROP_DRIVE: (v) => { KICK_DROP_DRIVE = v; },
  KICK_DROP_LOFT: (v) => { KICK_DROP_LOFT = v; },
  KICK_LOFT_MIN: (v) => { KICK_LOFT_MIN = v; },
  KICK_LOFT_MAX: (v) => { KICK_LOFT_MAX = v; },
  KICK_MEET: (v) => { KICK_MEET = v; },
  HEAD_MEET: (v) => { HEAD_MEET = v; },
  HEAD_RISE: (v) => { HEAD_RISE = v; },
  HEADER_POWER: (v) => { HEADER_POWER = v; },
  HEADER_LIFT: (v) => { HEADER_LIFT = v; },
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
    BODY_DEADEN,
    HEAD_BOUNCE,
    BODY_GRIP,
    LOB_LIFT,
    LOB_DRIVE,
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
    KICK_POWER,
    KICK_LIFT,
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
