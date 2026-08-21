# ⚽🗣 סלטיז ראשים — head-soccer mock

Throwaway prototype in the mould of **Head Soccer (D&D Dream)**: 1v1, big heads, five
buttons, and a power shot that decides matches. The hook: **the big head is one of your
Saltiz cards**, cropped to the face automatically.

> Same "mock" status as `football-mock` and `voxel-mock` — built to be *felt*, argued with,
> and thrown away or promoted. Nothing here is wired to the app yet.

## Run

```bash
cd head-soccer-mock
npm start          # PORT=3020 by default (3010-3019 belong to other agents)
```

Then open the **phone URL** the server prints (the LAN IP), not `localhost`.

> ⚠️ **Restart the server after changing `shared/constants.js`.** Node holds the sim
> constants in memory from load, while a browser refresh picks up the new file — so an old
> server process and a fresh client disagree about the pitch, and online play desyncs. It
> looks like a netcode bug and is not one.

```bash
npm test           # sim + bot tests, headless
node _shot.mjs     # drives the real client in Chrome and screenshots it
```

## Play with someone else

Tap **🔗 שחק עם חבר** → you get a 4-char code and a share link. Send the link; opening it
drops your friend straight into your lobby. Both tap מוכן and the match starts. If they
never show, play the bot. If they drop mid-match, a bot takes the seat so your match finishes.

The link is the whole invite — no accounts, no matchmaking, no friend list. Works inside the
app and out of it.

## Controls

| | walk | dash | jump | kick | power |
|---|---|---|---|---|---|
| **keys** | `A`/`D` or `←`/`→` | double-tap a direction | `W` `↑` `Space` | `S` `↓` `K` | `J` `L` `Shift` |
| **touch** | ◀ ▶ (left thumb) | double-tap | קפיצה | בעיטה | POWER |

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

**Hold jump while kicking to LOB it** — higher, shorter. The counter to a defender parked on
their line, and the only aiming the game has.

**Your head bounces the ball; your body deadens it.** Barging into the ball kills its pace
and drops it at your feet — only a kick sends it anywhere, so every meaningful touch is a
decision. Heading is still the aerial tool.

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

`PACE` (`shared/constants.js`, shipped at **0.80**) is one dial over how fast the whole match
runs. It is **slow-motion, not a nerf**: velocities scale by *k*, accelerations by *k²*,
per-tick drags by *^k* and action durations by *1/k*, so every trajectory keeps its **shape** —
same jump height, same arc, same reach — and only the clock on it changes. Scaling speeds
alone would flatten every arc instead, which is a different game rather than a slower one.

At *k*=1 a struck ball crossed the pitch in **1.6s**, inside the window a human needs to see
it, decide, and press. Measured over 20 bot-vs-bot matches per row (`node _pace.mjs`):

| k | goals/match | ball avg | cross-pitch | jump apex | legendary : very-easy |
|---|---|---|---|---|---|
| 1.00 | 5.6 | 587 px/s | 1.64s | 143px | 21:3 |
| **0.80** | **4.6** | **471 px/s** | **2.04s** | **144px** | **19:5** |
| 0.60 | 3.5 | 376 px/s | 2.55s | 146px | 16:8 |

0.80 buys **24% more time on every ball** while holding the goal rate at the target and
losing nothing off the skill gradient. Below ~0.7 the goal rate falls away and skill starts
washing out. The apex column is the proof it is a time change and not a physics change.

Live: the `PACE` row in the tuner, or `?pace=0.7` on the URL. Both are client-side — in an
online match the server keeps its own pace, so use them for solo feel-finding.

**A power shot is now as fast as it says it is.** `stepBall` clamped every ball to
`BALL_MAX_SPEED` *after* `stepPowerShot` had set its speed, so `POWER_SHOT_SPEED = 2100`
silently flew at 1250 and the tuner knob above 1250 did nothing. Powered balls now skip that
clamp — their velocity is re-set every tick, so it cannot run away — and the constant is set
to 1250, the speed power shots actually had. Nothing about the balance changed; the number
stopped lying.

## Proportions

Measured off a real Head Soccer gameplay screenshot rather than guessed:

Second pass used a real kickoff screenshot Adam sent, which is a better reference than the
App Store art — and it moved several numbers again.

| | Head Soccer | here |
|---|---|---|
| pitch aspect | 1.81 : 1 | **1.81 : 1** |
| head : body height | 2.9 : 1 | **3.2 : 1** |
| goal height : character height | 2.02 : 1 | **2.03 : 1** |
| goal depth : goal height | 0.33 | **0.33** |
| character height / screen | 14.1% | **14.9%** |
| goal height / screen | 28.5% | **30.2%** |
| ground line | 84% down screen | **84%** |

The black side bars in that screenshot are the real game letterboxing on a 2.16 phone —
matching its 1.81 aspect means accepting them here too.

The one deliberate departure: a strict match puts the head at 5.8% of pitch width
(`HEAD_R` 28); it is held at 30 because the head is a Saltiz card face and the hook stops
working when you cannot tell who it is.

`GOAL_H` 160 is where the measurement and the sweep agree — 2.03x the player, and the best
skill gradient of anything tried (legendary bot 10:1 over very-easy).

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

Mouth height was swept against bot-vs-bot outcomes rather than guessed. At 146 the game gave
2.6 goals a match and the legendary bot *lost* to the very-easy one — too few goals for skill
to show through. 170 gives ~5 goals and a clear skill gradient.

That sweep was run at `PACE` 1.0. Re-run at the shipped 0.80 it reads 146 → 3.3 goals and
170 → 5.1, with the legendary bot at 10:1 over very-easy at **every** mouth height — a
slower ball gives a defender time to be somewhere, so the goal size stopped being the thing
holding the gradient up.

**160 still stands, on the other argument.** The mouth had two independent justifications
and the pace change kills exactly one:

- *the sweep* — 160 was the best skill gradient of the values tried. **Dead.** At 0.80 the
  sweep no longer discriminates between heights, so it has stopped being a measuring
  instrument for this question.
- *the measurement* — 160 is **2.03× the 79px player** (feet to the top of the head:
  `HEAD_R` 30 + `BODY_H` 27, per `headY`), against 2.02× measured off the real Head Soccer
  kickoff screenshot. **Alive, and pace-independent** — it is a ratio between two objects on
  screen, and `PACE` moves no distance in the game, only the clock on it.

So leave 160 alone unless the pace itself moves. If it does, the thing to re-argue is the
ratio against a fresh reference screenshot, *not* the sweep.

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

⚠ Every figure quoted elsewhere in this README, and in the comments in `shared/constants.js`,
was measured at `PACE` 1.0 — before the match was slowed. Re-run the instrument before
trusting a number against the game as it ships.

| | question |
|---|---|
| `node _feel.mjs 3,3` | how many goals does a match actually produce? |
| `node _why.mjs 3,3 8` | *where* do the goals come from — power shot, lob, out of position? |
| `node _wall.mjs static` | can a positioned defender stop shots at all? (physics vs bot) |
| `node _sweep.mjs` | isolate one bot dial and watch the scoreline move |
| `node _shot.mjs` | drive one real Chrome client and screenshot it (`?solo=1` freezes the bot) |
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

1. **Goal rate.** Level 3 bots average ~9-10 goals a 60s match; level 5 about 5. Head
   Soccer is genuinely high-scoring, but this may still be too frantic. The tuner is
   deliberately the answer here rather than another number I picked — `GOAL_H`,
   `KICK_POWER` and `PLAYER_SPEED` are the three that move it most.
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

- `render.yaml` provisions **`pikme-headsoccer`** on the **starter (paid)** plan. Free was
  rejected on purpose: a free instance sleeps after 15 minutes and takes 30-50s to wake, and
  the whole feature is a link you send a friend.
- The app tile lives on branch **`feature/head-soccer-tile`** in `pikmeTV-saltiz`:
  `/pages/head-soccer` plus one entry in the Game Store's `GAMES`. The other dev owns
  TestFlight builds, so it ships in their next one.
- Still to verify on a real device, not asserted: `SALTIZ_CARDS` arriving before the game
  boots on the new screen, dash over real RTT, and whether the feel holds up at non-zero
  latency (all tuning was found at 0ms).
