# ⚽🗣 סלטיז ראשים — head-soccer mock

Throwaway prototype in the mould of **Head Soccer (D&D Dream)**: 1v1, big heads, five
buttons, and a power shot that decides matches. The hook: **the big head is one of your
Saltiz cards**, cropped to the face automatically.

> Same "mock" status as `football-mock` and `voxel-mock` — built to be *felt*, argued with,
> and thrown away or promoted. Nothing here is wired to the app yet.

> **New here?** Start with [`ONBOARDING.md`](ONBOARDING.md) — how to run it, what you may break,
> and how a push reaches a phone. Hand [`AGENT_PROMPT.md`](AGENT_PROMPT.md) to your coding agent.

## Run

```bash
cd head-soccer-mock
npm install
npm start          # PORT=3020 by default (3010-3019 belong to other agents)
npm run sim        # a Chrome window the size of a phone, in landscape, with touch — see below
```

Then open the **phone URL** the server prints (the LAN IP), not `localhost`.

> ⚠️ **Restart the server after changing `shared/constants.js`.** Node holds the sim
> constants in memory from load, while a browser refresh picks up the new file — so an old
> server process and a fresh client disagree about the pitch, and online play desyncs. It
> looks like a netcode bug and is not one.

```bash
npm test           # sim + bot tests, headless
npm start          # in another shell — _shot and _duo do not start a server themselves
node _shot.mjs     # drives the real client in Chrome and screenshots it
```

The simulator and every screenshot harness drive a **Chrome-family browser** over the DevTools
Protocol, which Safari does not speak: `brew install --cask google-chrome`, or point
`CHROME_BIN` at Chromium/Edge/Brave.

## The phone simulator

A desktop browser is a liar for this game: it ships in landscape, inside a WKWebView, played with
thumbs. `npm run sim` opens a Chrome window the exact size of a phone with real touch emulation,
an iOS user agent, and the album injected at the same moment the app injects it.

```bash
npm run sim -- --list            # every device preset
npm run sim -- --device=se       # 667x375 — the floor. Break it here first
npm run sim -- --duo             # two phones side by side: host a room on the left, join on the right
npm run sim -- --album=8         # pretend the player owns 8 cards, so the head gate is ON
npm run sim -- --devtools
```

The album flag is the one worth knowing. Inside the app `window.SALTIZ_CARDS` decides which heads
are playable; outside it there is deliberately no gate at all, so the browser stays testable.
Those are two code paths, and only `--album` reaches the second one without a real build.

## The pitch sits above your thumbs

The controls used to sit ON the pitch — players stood inside the buttons. The ground line is
now placed at the top of the band the controls occupy, so the whole playable half of the world
is clear of them. It costs width: on a 390px-tall phone the pitch renders at about 83% of the
screen with bars at the sides, and those bars are painted to match the pitch at that height —
sky above the ground line, grass below. A bar at the edge costs you nothing; a thumb over the
six-yard box costs you the goal.

Grass is drawn 170px past the bottom of the world (`BLEED`) purely so the strip behind the
buttons is green rather than a hole. Nothing down there is simulated or reachable.

## The faces

Every head — the two on the pitch, the three cards under it, the slots on the pick screen — is
the card art as a background, scaled so the face fills a circle. The offsets come from
`public/data/head-anchors.json`, which was measured **automatically**, and one card in five was
measured wrong: twenty ask for a window that runs off the edge of the card (a browser obliges,
and shows blank space beside the face), and thirty-seven claim a head more than half the card
wide — one of them wider than the card itself.

`public/head-crop.js` is the repair and the single copy of the maths: it clamps the window onto
the card and caps the head size, so a bad anchor can make a face slightly off-centre but can
never show something that is not card. `node test-heads.mjs` runs it over all 180 and prints
the list of anchors it had to fix — that list is the to-do for measuring them properly.
`node _face-shots.mjs` photographs any card before and after.

## Two ways to play

The pick screen asks which, rather than leaving it implicit: **🤖 נגד המחשב** (difficulty slider
+ שחק) or **👥 1 על 1** (a share link, or join a 4-char code). The choice is remembered per
device. In 1v1 the opponent brings their own card, so the יריב slot goes inert.

## Play with someone else

Tap **🔗 שחק עם חבר** → you get a 4-char code and a share link. Send the link; opening it
drops your friend straight into your lobby. Both tap מוכן and the match starts. If they
never show, play the bot. If they drop mid-match, a bot takes the seat so your match finishes.

The link is the whole invite — no accounts, no matchmaking, no friend list. Works inside the
app and out of it.

## Controls

| | walk | dash | jump | kick | power | cards |
|---|---|---|---|---|---|---|
| **touch** | ◀ ▶ (left thumb) | double-tap | קפיצה | בעיטה | POWER | the three cards |

**The buttons are on screen on every device**, mouse or thumb — they hold your hand of
cards, and an ability you cannot see is an ability nobody presses. Keys still work on a
desktop, but there is no rebinding screen: this game is played in the app, on a phone, and a
keyboard-remapping page in a phone game's menu is a setting for someone else's device.

**⚙ → 🎛️ עריכת בקרות** opens the layout editor, the same shape as football's: drag any
button to move it, pull its corner to resize it, and a **שקיפות** slider for how much pitch
the pad is allowed to hide. **שמירה / ביטול / איפוס** — a draft with a way back, because the
first thing anyone does in a layout editor is drag something somewhere worse. Saved per
device as fractions of the stage, so a layout dragged in landscape survives the rotation.

**POWER is a committed volley, and you earn it by kicking people.** The gauge fills off the
OPPONENT and nothing else — five tackles buy one — so it is something you go and take rather
than something the clock hands you.

Press it with a full gauge and the game **focuses on the striker for three seconds** —
the pitch dims to two pools of light, one on them and one on the ball as it is drawn up and
lights up in their shot's colour, with a ring closing as a clock. Then it fires **dead flat at
three times a normal power shot**, always from **0.9 of the goal height** (capped at what a
jump can actually reach), so a defender learns one height to jump for. **The only way to stop it is to jump into its line, early — and to HOLD the jump**: jump
height is variable here, a tap tops out at 146px and a held jump reaches 239, and the shot
flies above the tap.

The wind-up is the price. You are rooted for that half second in the open, and **a tackle
landed on you during it cancels the whole thing** — the gauge is already spent. That is what
keeps the move honest: reading it is worth as much as throwing it.

**Why there is a clamp on the launch height.** "0.9 of the goal height" and "a 20% taller
goal" are two requests that collide: 0.9 × 192 = **173px**, and a *tapped* jump does not get
a head near that. The move's entire rule — *the only way to stop it is to jump* — would have
quietly become false. It did not, because jump height here is variable: a held jump puts the
top of the head at **237px**, well over the shot.

So `powerHeight()` is `min(0.9 × GOAL_H, headReach() − 14)`, derived from `JUMP_V` and
`PLAYER_GRAV` rather than typed:

- Today it honours the 0.9 — 173 is under the 215 ceiling, so **the clamp is not binding**.
- It starts binding above `GOAL_H` ≈ **239**. That is the guard rail: no future goal retune
  can make the volley unanswerable without someone noticing.
- Because apex is ballistic (`v²/2a`), it is **invariant under `PACE`** — the dial cannot
  move a defender out of reach of a shot. `_pace.mjs` measures 1.9% apex drift across the
  whole sweep, which is that claim being checked rather than asserted.

**Known and not fixed:** bots only block 1–3 volleys per sixteen matches. They mostly take the
other answer — running at the charger to cancel the wind-up — which is legitimate and the
skill ladder is healthy, but a defending bot that jumped more often would make solo play read
better. Filed rather than fudged.

<details><summary>The old power mode (superseded)</summary>

**POWER is a mode, not a shot.** With a full gauge, press POWER and you are *powered up*
for ~4.5s. While it lasts:
- **kick the ball** → it flies flat and fast at the goal. The defender's answer is to get a
  body in the way, usually by jumping into it. A block saves the goal but lands the
  shooter's effect on you.
- **kick the opponent** → your signature effect instead, at reduced strength.

Every shot flies the *same* way on purpose — if trajectories differed per character,
"get in the way" would mean something different each time and blocking would be a guess.
What differs is the consequence: מנגל בוער burns you down, תולעים roots you, סטרייק freezes
you for half a second, גל אדום launches you, גשם מטבעות leaves you wading.

**Press kick with the ball at your head and you HEAD it** — less power than a boot, more
loft, and the only way to hit a ball your foot cannot reach. A head you did NOT press with
cushions the ball instead: heading used to beat playing, so a passive head touch is now a
control surface and the boot is the only thing that hits it hard.

**The boot bows toward the far goal.** A kick used to fly dead flat along your facing, so
scoring meant already standing in exactly the right place. The loft now scales with how far
that goal is — lofted from deep, flat from the six-yard box, where a lofted tap would sail
over the bar. The DIRECTION is still yours: facing is the only aiming this game has and
turning the ball toward the net for you would take it away.

</details>

**Hold jump while kicking to LOB it** — higher, shorter. The counter to a defender parked on
their line, and the only aiming the game has.

**Your head deadens the ball too — just less than your body does.** A head keeps 0.58 of the
pace where the chest keeps 0.18, so heading is the livelier touch of the two and neither is a
trampoline. Hitting the ball HARD is always a deliberate act now: the boot, or the kick button
pressed at head height.

<details><summary>What it used to say</summary>

**Your head bounces the ball; your body deadens it.** Barging into the ball kills its pace
and drops it at your feet — only a kick sends it anywhere, so every meaningful touch is a
decision. Heading is still the aerial tool.

## Your hand of three

**The powers come out of your Saltiz cards.** You hold three of them under the pitch; press
one and you get that card's power for a few seconds.

**The number says WHICH power. The rarity says HOW GOOD.**

| | |
|---|---|
| **ראש ענק** grow | a bigger head to meet the ball with — and a bigger thing to tackle |
| **מגנט** magnet | pulls a loose ball toward you. It can pull one into your own net too |
| **טעינה** charge | fills the power gauge instantly. The shot is still blockable |
| **מגן** shield | eats one power shot, then it is gone |
| **קפיצי** spring | a higher jump and one extra jump in the air |
| **קרח** ice | frozen boots on your opponent. They keep every button, they are just heavy |

**And four more that only the good cards carry** — this is what a rarity is for, now that every
card fires the same six otherwise:

| | | |
|---|---|---|
| **חץ מכווץ** dart | epic+ | a bolt at head height. Hits them → their head shrinks. Misses into the net → **yours grows** |
| **בעיטת על** super kick | epic+ | your next touch sends the ball twice as far and throws whoever is standing over it |
| **חומת שער** goal wall | legendary | your own goal is shut for 1.6s. It saves one attack, it cannot hold a lead |
| **כלב!** dog | legendary | a dog runs the pitch and **hangs off your shin** for a second, teeth and gums showing — **jump it** |

Every one of them can be answered: the dart flies one visible line, the dog runs the ground and
a jump clears it, and the wall goes up on your OWN goal so it never takes a control away from
the other player.

**Slot 1 is the card you are playing as** — the face on the pitch is the first thing in your
hand. The other two are dealt from the same rarity, always three different powers, and the
deal is derived from the two cards so both players compute the identical hands with nothing
crossing the wire.

**A card comes back two ways.** It cools on a clock — 26s for a common down to 16.5s for a
legendary — and **contact pays it off**: a touch on the ball takes a little off all three of
your cards, a tackle takes five times as much, a goal more again. A hand you never use is a
hand that recharges slowly.

Crates on the pitch (the older power-up system) are off by default — `?pickups=1` brings
them back to compare. `?cards=0` turns the hand off.

</details>

**Kick the opponent to TACKLE them** — no ball required. Pays you a slice of power gauge and
leaves them slowed for ~1.7s. There is a 1.1s immunity window afterwards so nobody can be
stun-locked out of a match.

**The touch pad scales with the device.** Every dimension derives from one thumb unit,
`--u`, which `resize()` computes from the **stage** box — not the viewport, because the pitch
is letterboxed: `clamp(46, min(stageH·0.20, stageW·0.115), 96)` CSS px. A fixed 62px button
was a tap-target on an iPad and a quarter of the pitch on a portrait phone. Safe-area insets
are added only for the part the letterbox bar does not already cover, so a notched phone in
landscape does not get its pad shoved into the middle of the screen.

`?pad=1` forces the touch pad on in a desktop browser.

## What was taken from the real game

Researched from the [Head Soccer wiki](https://headsoccer.wiki.gg/wiki/Controls) — the
mechanics that actually define it, not just the look:

- **Five buttons, nothing else.** Left, right, jump, kick, power. Dash is a double-tap.
- **The power gauge fills with match time**, not with touches. When it's full the POWER
  button lights; pressing it **arms** you, and the *next* ball contact fires your shot.
- **Five shot families** from the wiki's taxonomy — `straight`, `arc`, `trap`, `wave`,
  `homing` — see [`shared/powershots.js`](shared/powershots.js). A shot that connects
  knocks the defender down and punches through.
- **Counter attacks.** Kick a live power ball at the right moment and it reverses *and you
  inherit their shot*. That's the skill ceiling.
- **Sudden death** on a draw, with both gauges frozen — so overtime is decided by play.

## The card → head pipeline

Cards are 400×545 illustrations, and the subject sits somewhere different on every one, so
a fixed crop framed shoulders and bookshelves. Instead, macOS **Vision.framework** detected
the face box on all 180 cards offline; those boxes are expanded to a head circle and baked
into [`public/data/head-anchors.json`](public/data/head-anchors.json) (178 auto, 2 fallbacks).
At runtime the head is just a CSS background window onto the card at the baked anchor.

Every one of the 180 cards is playable, and each gets a deterministic power shot; five
hand-picked cards get a themed one (the grill card throws fire, the tentacle card traps you).

**The heads are DOM, never canvas.** Card art blitted into a canvas renders blank inside
WKWebView — the trap that cost a day on `football-mock`. Pitch, ball, bodies and FX are
canvas; the two heads are `<div>`s with a background image.

## Feel

Three things carry the jump, and they are the difference between a jump that feels good and
one that feels broken: **coyote time** (you can still jump just after leaving the ground),
**input buffering** (a press just before landing fires on touchdown instead of being eaten),
and **asymmetric gravity** (falling is `FALL_MULT` heavier than rising — symmetric arcs read
as floaty).

**Hit-stop** freezes the whole sim for a few frames on a heavy connect, with a couple of
pixels of screen shake underneath. It costs nothing and is most of what makes a hit land.
Input held across the freeze is not lost — the sim's edge detection sees it the moment play
resumes.

## Pace

`PACE` (`shared/constants.js`, shipped at **0.68**) is one dial over how fast the whole match
runs. It is **slow-motion, not a nerf**: velocities scale by *k*, accelerations by *k²*,
per-tick drags by *^k* and action durations by *1/k*, so every trajectory keeps its **shape** —
same jump height, same arc, same reach — and only the clock on it changes. Scaling speeds
alone would flatten every arc instead, which is a different game rather than a slower one.

**It got there in two moves, and they are worth separating.** First the *ball* was slowed on
its own, so the gap between ball and player closed rather than both shrinking together: a
kicked ball went from 1.49× the player's speed to 1.21×, and from crossing the pitch in 1.67s
to 2.05s against the player's 2.48s. That ratio is the whole point — a chase you can
plausibly win instead of one you cannot. Only then did `PACE` go 0.80 → 0.68 for everything
else. The ball-vs-player ratio is untouched by the dial, by design.

Re-measured at the shipped constants, 20 bot-vs-bot matches per row (`node _pace.mjs`):

| k | goals/match | ball avg | cross-pitch | jump apex | hang | legendary : very-easy |
|---|---|---|---|---|---|---|
| 1.00 | 9.0 | 393 px/s | 2.70s | 143px | 0.65s | 23:1 |
| 0.90 | 7.9 | 373 px/s | 2.84s | 144px | 0.72s | 23:1 |
| 0.80 | 7.3 | 339 px/s | 3.12s | 144px | 0.82s | 23:1 |
| **0.70** | **6.0** | **316 px/s** | **3.36s** | **145px** | **0.92s** | **24:0** |
| 0.60 | 5.3 | 287 px/s | 3.69s | 146px | 1.08s | 24:0 |

0.68 sits just under the 0.70 row; `_feel.mjs` puts the shipped game at **6.3 goals a match**.
The apex column is still the proof it is a time change and not a physics change — 1.9% drift
across the whole sweep, while hang time stretches by exactly 1/k.

⚠ **The skill column has stopped being evidence.** It reads 23:1 or better at *every* k, so it
no longer discriminates and cannot be used to defend a pace. What picks 0.68 now is the goal
rate and the ball-to-player ratio above. Two of this README's arguments have died this way
(see the goal mouth, below); when a sweep goes flat, say so rather than keep quoting it.

Live: the `PACE` row in the tuner, or `?pace=0.7` on the URL. Both are client-side — in an
online match the server keeps its own pace, so use them for solo feel-finding.

**A power shot is now as fast as it says it is.** `stepBall` clamped every ball to
`BALL_MAX_SPEED` *after* `stepPowerShot` had set its speed, so `POWER_SHOT_SPEED = 2100`
silently flew at 1250 and the tuner knob above 1250 did nothing. Powered balls now skip that
clamp — their velocity is re-set every tick, so it cannot run away — and the constant was set
to the speed power shots actually had. Nothing about the balance changed; the number stopped
lying. It is **1000** today, cut again with the ball pass above.

> **The speed constants are written pre-`PACE`, and the dial scales them on load.** Shipped,
> `BALL_MAX_SPEED` 1050 and `POWER_SHOT_SPEED` 1000 are **714** and **680** live. So a figure
> read off the source is not the figure the ball flies at, and the two are 32% apart at 0.68 —
> far enough to read as a bug when it is arithmetic. Print the constant, do not trust the file.

## Proportions

Measured off a real Head Soccer gameplay screenshot rather than guessed:

Second pass used a real kickoff screenshot Adam sent, which is a better reference than the
App Store art — and it moved several numbers again.

The "character height" every row below is measured against is the **on-screen silhouette,
79px** — the 60px head plus the 19px of body that shows under it — not `BODY_H + 2·HEAD_R`.
Get that wrong and every ratio here moves.

| | Head Soccer | here |
|---|---|---|
| pitch aspect | 1.81 : 1 | 1.81 : 1 *(see below)* |
| head : body height | 2.9 : 1 | **3.2 : 1** |
| goal height : character height | 2.02 : 1 | **2.43 : 1** ⚠ |
| goal depth : goal height | 0.33 | **0.28** ⚠ |
| character height / screen | 14.1% | **14.9%** |
| goal height / screen | 28.5% | **36.2%** ⚠ |
| ground line | 84% down screen | **82%** |

The black side bars in that screenshot are the real game letterboxing on a 2.16 phone —
matching its 1.81 aspect means accepting them here too.

The three ⚠ rows are all **one deliberate change**: `GOAL_H` 160 → 192, a 20% taller goal
asked for directly. They are the price of it, not separate drift. `GOAL_W` stayed at 53, so
the goal also got *shallower* in proportion — 0.33 → 0.28 — which nobody asked for and which
is the row to revisit first if the net starts looking wrong.

The other deliberate departure: a strict match puts the head at 5.8% of pitch width
(`HEAD_R` 28); it is held at 30 because the head is a Saltiz card face and the hook stops
working when you cannot tell who it is.

> **Unresolved, and not part of the goal change:** `W`/`H` are 1060×530, which is **2.00 : 1**,
> not the 1.81 : 1 the top row claims — and neither has ever been edited since the first
> commit. Either that row measures something other than the world box (the rendered pitch
> region, most likely) or it has been wrong from the start. Left alone rather than quietly
> corrected, because guessing which would put a made-up number in the one table that exists
> to hold measured ones.

A consequence worth knowing: at these proportions the torso is a 12px sliver, so
"head bounces, body deadens" had to become a rule about HEIGHT on the silhouette
(`DEADEN_ZONE`) rather than about which collider you clipped — the box-based version almost
never fired.

## The goal

The whole ball must be **past the line and under the bar** — testing the ball's centre meant
a shot clipping the top of the goal scored. The crossbar is a real bar across the full depth
of the net, so nothing drops in through the roof, and nothing may come to REST on it either:
a ball landing flat on top has no velocity to roll it off and the bar keeps pushing it back
up. One was found parked at (939, 215) with an entire match hung underneath it.

`BALL_IDLE_RESET` is the backstop for every other way a ball can end up somewhere nobody can
reach: untouched for 6s, it returns to the centre spot.

### It is a room, and that is one file

The goal used to be described in two places that had never been introduced. The renderer knew
it was a box drawn in oblique projection; the sim knew it was a vertical line at `GOAL_W` with
a wall behind it. Neither had an INTERIOR, and both bugs that fell out of that were reported
as one: **the ball appeared outside the goal, on the near side of the net**, and a player
could never get into a net you can see straight into.

[`shared/goalbox.js`](shared/goalbox.js) is the floor plan both sides now read. Three axes:
**depth** is the sim's own x (the camera is side on, so front-to-back of the net IS x),
**height** is y, and **width** — post to post, into the screen — is not simulated at all. It
is a depth `z` the renderer projects: 0 at the near side net, 1 at the far one, and
`INSIDE_Z` (0.5) for anything standing in the goal.

That one number is the fix. The draw order falls out of it — [`public/game.js`](public/game.js)
draws the box in **two passes**, `drawGoalBack` before the bodies and `drawGoalFront` after
them, so the order down the screen is *camera → near net → ball and players → far net* — and
so does the small step across the screen that puts a ball visibly inside the box rather than
pasted on its front face. The step ramps in over half the goal's depth, because switching it
on at the line would throw the ball 18px *backwards* out of the goal it had just entered.

Two things follow that are worth knowing before touching either side:

- **A player can stand in their own goal.** The mouth is a doorway under the bar and the back
  of the net is the wall. Bots never walk in (`shared/bot.js` aims at `GOAL_W + 24` and always
  did); for a human it is a keeper's option and a way to get stuck behind your own net.
- **The crossbar is solid, and it is the bar the BALL bounces off.** `barCeiling` and
  `bounceOffCrossbar` are the same capsule — radius `POST_R`, laid along `y = barY` across the
  goal's depth — so a head meets the roof of the net exactly where a ball does. It is resolved
  straight down rather than along the contact normal: a normal would also shove the player up
  to 16px sideways, and a body that slides when you jump is worse than the bug it fixes.

  Two consequences. A jump directly under the bar stops with the crown on its **underside**,
  not on its centre line, so nothing is ever drawn buried in the frame. And because the capsule
  is round, the height you can reach grows smoothly as you step away from the post, arriving at
  a full jump one head-radius past it — **so a defender standing on their own line can no
  longer jump over their own bar**, and has to stand ~38px off it to meet a lob. That is the
  one real gameplay change in this pass: bot-vs-bot goals went **6.2 → 5.8 a match** (`_feel`),
  the ceiling fires on 0.06% of player-ticks, and no body ever overlaps the bar.
- **The heads are DOM nodes and a canvas cannot draw over one.** So the front of the net is
  stroked a second time on `#cvnet`, a canvas above the heads, clipped to the head itself —
  otherwise a player in the goal has their body behind the net and their face in front of it.
  The **frame** is left out of that second pass (`netOnly`): the mesh is honestly in front of a
  head at that depth, but a crossbar stroked across the face of someone standing at the post is
  the very illusion of "my head is inside the bar" that the collider above exists to end.

`node _goalshots.mjs` is the proof in pixels: it parks a ball and a player in each net and
checks that none of the ball's own white survives (everything in there is under the near
panel's wash) while half its disc is still bright enough to see through the cords.

### The mouth is 192, and it is a request, not a measurement

`GOAL_H` shipped at 160 for a long time on two independent arguments. **Both are now gone**,
and it is worth being blunt about that rather than leaving the old reasoning standing over a
number it no longer describes.

- *the sweep* — 160 was the best skill gradient of the values tried, back when the sweep
  discriminated. **Dead.** Slower play gives a defender time to be somewhere, so mouth height
  stopped being what holds the gradient up; `_pace.mjs` now reads 23:1 or better at every k.
- *the measurement* — 160 was **2.03× the 79px silhouette**, against 2.02× measured off a real
  Head Soccer kickoff screenshot. **Dead too, as a defence of the shipped number**: 192 is
  **2.43×**, a deliberate 20% departure from the reference. The measurement is still correct;
  it just no longer describes what is in the file.

**What holds 192 up is that Adam asked for it.** That is a legitimate reason and it is the
real one, so it is written here instead of a retrofitted measurement. The honest status: the
mouth is a taste decision with a known cost, and the cost is below.

**The cost, measured.** The crossbar sits at y=243; the top of a standing head is at y=348.
So **105px of the 192px mouth — 55% — is above a standing defender's head** and can only be
defended by jumping. At 160 the bar was at y=275 and that figure was 73px, or 46%.

That shows up directly in the goal census (`node _why.mjs`): **88% of goals pass over the
defender's head**, while the defender is *at* the line for 50% of them and the median
conceder is 45px from their post. Read those together — the defender is usually in the right
place and simply cannot reach. `_wall.mjs` agrees from the other side: a correctly positioned
**static** defender is beaten by 24% of shots, and the leaks are almost all upward angles.

Two things follow that are easy to misdiagnose:

- **Goals run at 6.3 a match** (`_feel.mjs`), against the ~4.6 the old pace section targeted.
- **Knockdowns never happen — 0%.** That is not a second bug. `applyEffect` only fires when a
  shot *connects with a defender*, and at 88% lobbed the ball rarely touches one. It is the
  same finding wearing a different hat; do not go hunting for it in `powershots.js`.

So: 160 was measured, 192 is chosen. If the goal rate is judged too high, the mouth is the
first dial to reach for and the reference ratio is waiting at 160 — but that is Adam's call,
not a defect to quietly fix.

## Netcode

Server-authoritative at 60Hz, snapshots at 30Hz, **rollback + replay** on the client. The
client runs the *same* `shared/sim.js`; on each snapshot it restores to the authoritative
state and replays its own buffered inputs forward. Interpolating instead would have been
simpler and wrong — your boot touches the ball constantly, and interpolation puts every one
of your own kicks a full round-trip behind your foot. Rollback is cheap here because a 1v1
snapshot is ~600 bytes and the sim is pure and deterministic.

**The input stream is the whole ballgame.** Every input is edge-triggered, and dash is a
double-tap — two rising edges inside 240ms. So the transport's job is not "which keys are
held" but "deliver the per-tick stream without holes or reordering". Packets are sent
redundantly (each carries the last 6 frames) and the server consumes them as an ordered FIFO.

Two design bugs were found and fixed by the tests, both worth knowing about:

1. **Inputs were first indexed by client tick**, which silently assumed the two clocks were
   in sync. Under any latency the client's frame for tick N arrives when the server is past
   N, so every input was dropped as stale and the player never moved. The tick is now a
   *sequence number* and the server drains oldest-first — no clock sync anywhere.
2. **Rollback needs `prev` on the wire.** `prev` is the previous frame's input, which is how
   the sim finds edges. Leave it out of the snapshot and a held key re-fires the instant a
   client reconciles.

`test-net.mjs` proves dash survives the wire *and* proves that the naive collapsing
transport would break it — so the canary is testing something real.

## Layout

```
shared/constants.js    every tunable number, live-bindable (see the tuner below)
shared/sim.js          authoritative physics + rules. Pure, no DOM, no timers.
shared/goalbox.js      the goal as a room: its corners, its walls, and the depth it is drawn at
shared/powershots.js   the five shot behaviours + the card→shot mapping
shared/bot.js          the opponent. Emits the same input a human does.
shared/rooms.js        private-room registry: codes, join, leave. Pure, no sockets.
shared/net.js          wire format + the ordered input FIFO. Pure.
public/                pick screen, lobby, renderer, input, tuner
public/net.js          client socket, prediction, rollback reconciliation
server.js              static host + ws host + one 60Hz loop over all rooms
```

The `shared/` split is what made online cheap: the server and the client run the identical
sim, which is the precondition for rollback.

## Stages

Seven Street Fighter II locales in [`public/stages.js`](public/stages.js), one picked at
random per match: a moonlit castle, a dockyard, a market street, an air base, the Amazon,
a temple, a steel mill. `?stage=japan|harbor|china|airbase|jungle|temple|factory` pins one.

**None of Capcom's art is copied** — what is borrowed is the stage-design *language*, which
is the part that actually matters: a strong silhouette on the horizon, one big readable
landmark, a band of onlookers, and two or three props that move. That is why an SF2 stage is
recognisable from a thumbnail, and it reproduces fine without touching their pixels.

A stage owns sky → horizon → crowd; the hoardings, wall, grass, goals and players are drawn
over it, because that furniture is the same wherever you play. Each stage also supplies its
own grass and wall tints so the pitch belongs to the place.

## The tuner ⚙

Tap the gear in-match for live sliders over all 28 gameplay constants — speed, kick power,
gravity, goal size, gauge fill, everything. Changes land on the **next tick**, mid-match.
"העתק JSON" copies only what you changed, so a feel you like comes back as a paste.

This exists because arguing about `KICK_LIFT` between restarts is not how a feel gets found.

## Instruments

Balance was measured, not guessed. Each of these answers one question:

⚠ The figures in **Pace**, **Proportions** and **The goal** were re-measured at the shipped
constants. Anything quoted elsewhere here, and the comments in `shared/constants.js`, may
still date from `PACE` 1.0 and a 160px mouth. Re-run the instrument before trusting a number.

They also need a Chrome-family browser for the four that drive one (`_shot`, `_duo`, `_pad`,
and the shot harnesses): `brew install --cask google-chrome`, or set `CHROME_BIN`. `_chrome.mjs`
resolves it and says so plainly when there is none. `_shot.mjs` and `_duo.mjs` do **not** start
the server — run `npm start` first or they fail on an empty page.

| | question |
|---|---|
| `node _feel.mjs 3,3` | how many goals does a match actually produce? |
| `node _why.mjs 3,3 8` | *where* do the goals come from — power shot, lob, out of position? **A fixed matchup** (legendary_3 vs legendary_2), so it is an A/B instrument, not a census: its "56% power shots" is two cards, not the game |
| `node _wall.mjs static` | can a positioned defender stop shots at all? (physics vs bot) |
| `node _sweep.mjs` | isolate one bot dial and watch the scoreline move |
| `node _shot.mjs` | drive one real Chrome client and screenshot it (`?solo=1` freezes the bot) |
| `node _goalshots.mjs` | is the ball actually *inside* the goal? Parks one in each net and reads the pixels back — the picture half of the goal box, which geometry cannot prove |
| `node _duo.mjs` | two real Chrome clients playing each other through the real server |
| `node _pace.mjs` | how slow can the match get before it stops being a game? |
| `node _pad.mjs` | is the touch pad thumb-sized, on-pitch and non-overlapping on 5 devices? |

Three real bugs came out of them, all invisible to the unit tests:

1. **A fast ball tunnelled the defender's body box** in one tick, and the nearest-point
   push-out then resolved it on the *wrong side* — straight into the net. That was 52% of
   all goals. Fixed by sub-stepping the ball (`shared/sim.js`).
2. **The `aggression` dial was rolled per think**, so the legendary bot (thinking 25×/s)
   pressed 8× more than the easy one at the same setting — the dial did the opposite of
   its name.
3. **Discipline alone isn't skill.** With difficulty tuned only for positioning, the
   legendary bot held its post beautifully and lost 6-3, because it never aimed a kick.
   `aim` is now the main axis of the ladder.

## Open questions for Adam

1. **Goal rate — the live one.** Level 3 bots average **6.3 goals a 60s match** (`_feel.mjs`,
   at the shipped `PACE` 0.68 and `GOAL_H` 192), against the ~4.6 an earlier pass targeted.
   Head Soccer is genuinely high-scoring, so this may be right; it is above where the game
   used to aim, and the 20% taller goal is most of the difference. `GOAL_H`, `KICK_POWER` and
   `PLAYER_SPEED` move it most, and the tuner is deliberately the answer rather than another
   number picked here. **This is the open decision the goal-mouth section above defers to.**
2. **Is the card the head, or should the card *be* the character?** Right now it's a
   face crop. The alternative — the whole trading card as the body — is a different game.
3. **Rarity stats.** Legendary is ~6% faster / 8% harder-hitting than common. Deliberately
   narrow. Real hook or pay-to-win?
4. **Audio is synthesised, not sampled.** The brief was "sounds from Street Fighter II";
   those samples are Capcom's, so `public/audio.js` builds the same *vocabulary* out of
   WebAudio primitives instead — noise burst through a bandpass for an impact, square sweep
   for a whoosh, detuned pair for a fanfare. No files, nothing to preload, and it survives
   the WebView with no asset pipeline. `../football assets/` has real sounds you own if you
   would rather use those.

## Shipping

For Idan's Mac setup, simulator, and push-to-production workflow, see [ONBOARDING.md](ONBOARDING.md).
The running commit is available at https://pikme-headsoccer.onrender.com/version.

- `render.yaml` provisions **`pikme-headsoccer`** on the **starter (paid)** plan. Free was
  rejected on purpose: a free instance sleeps after 15 minutes and takes 30-50s to wake, and
  the whole feature is a link you send a friend.
- The app tile lives on branch **`feature/head-soccer-tile`** in `pikmeTV-saltiz`:
  `/pages/head-soccer` plus one entry in the Game Store's `GAMES`. The other dev owns
  TestFlight builds, so it ships in their next one.
- Still to verify on a real device, not asserted: `SALTIZ_CARDS` arriving before the game
  boots on the new screen, dash over real RTT, and whether the feel holds up at non-zero
  latency (all tuning was found at 0ms).
