# The champions' own powers — ORIGINAL, one per champion

_Idan, 2026-10-11: every one of the 45 legendary champions gets an original power fitted to its head
and its card. Head Soccer is the benchmark for how a power looks, lands and reads — never the thing
copied (no HS powers, characters, art, animation or names). This replaces the HS-copy plan
(docs/HS-45-POWERS.md) power by power, in batches of five. Approved plan:
~/.claude/plans/pasted-content-id-f939-use-plan-iridescent-parnas.md._

**Idan's decisions (2026-10-11)**
- The Head Soccer copies already built (stages 1–6) are replaced too.
- An original power fires **everywhere** — arcade, online, free play — at one strength: a player
  plays the cards they own, so owning one must not be an advantage.
- "For now don't touch the hardness": no per-stage power scaling, no change to the CPU ladder. The
  arcade still climbs on the CPU's smartness and stats (shared/champions.js).
- On the details: whatever looks best — cool and inviting for kids, more visual effect, HS-like look.

## 1. Built so far

| # | Champion | Power | What it does (as built) | Measured goal % |
|---|---|---|---|---|
| 1 | התותחן (pirate parrot) | **Broadside** 🦜 | Redesigned 2026-10-12 (§1b): pressing POWER turns the parrot into his own cannon; his touch loads the ball and the cannon fires three times, 1 s apart — two iron shells (a kick parries one, anything else is the power hit with a 0.4 s daze; never a goal), then the ball itself, a straight power shot (counter, kick-block — which fires the whole barrage back from the blocker — or the heavy thud on a body). | 32% |
| 2 | אדון התולעים (green snake) | **Worm Tunnel Ambush** 🪱 | Redesigned 2026-10-13 (§1c): pressing POWER turns the snake into her worm form; her touch calls up a giant worm that coils round the ball, dives with it, tunnels under the pitch (a mound), holds under a glowing ring (0.45 s) and spits the real ball in a lob at the goal. Stomp it (KICK on the ring as it bursts — only standing there, the burst shoves you aside), head it off the ring, kick it as it drops (the whole tunnel comes back), counter it — or take it on the crown: the hit, coiled, and the ball pops on over you. | 34% |
| 3 | השף הבוער (burger) | **Sizzle Line** 🍔 | Dives to knee height and flies flat as a fireball, searing a burning grill strip into the grass behind it (2.2 s). Standing on the strip = singed (no kick, 1.4 s); its shooter is immune. | 32% |
| 4 | מלך הבוץ (Saltiz chocolate bar) | **Choco Burst** 🍫 | The wrapped bar flies flat, shaking harder until it bursts 430 px short of the goal line: foil confetti, marshmallows and a chocolate splat on the grass ahead (2.2 s, sticky: slow, half-height jumps, no dash). A hit glues him in chocolate where he stands (sticky 2.4 s) and the ball bounces off him slowed. | 35% |
| 5 | בונה החומות (ice pop) | **Ice Pop Wall** 🍭 | A flat shot trailing a three-flavour ribbon — and three giant ice pops sprout in front of the shooter's OWN goal for 4 s, turning back any ball lower than 92 px (fire-backs and counters must go over). A hit freezes him stiff in an ice block, then he shivers (2.4 s); the ball pings up off the ice. | 30% |

Goal % = `node _power-balance.mjs 240` (below): references on the same scale — a plain straight comet
8%, the Mythic Gem 61% (Idan: above the arcade's average). The five sit in a 30–36% band.

Unbuilt stages still fire their map family (stage 6 its HS copy, arcade only) until their batch.

### 1b. Broadside, redesigned (Idan, 2026-10-12)

Idan's brief: the parrot turns into a pirate cannon that is still him; the touch fires three shots
1.5 s apart (then, the same day: **1 s apart**) — two blasts that hit and knock back but never score, then the real ball disguised as the
third, still answerable with the counter and the kick-block. His answers: Shot 1 at the shared
cut-in's release (the cut-in stays); the barrage cannot be interrupted (the cannon is planted and
tackle-proof); a timed kick parries a shell, anything else is the hit, an armed player keeps his arm;
the tutorial's practice opponent is no longer champion 1.

| When | What happens (sim) | What you see (public/vfx/powers/stage-01.js) |
|---|---|---|
| Press POWER | arms, as every power | his own face squashes, a glint on the star coin; a half-turn flip in a pop of light, feathers and bubbles; he comes round as the cannon (his red head the breech, his beak the muzzle's lip, hat, patch, eye and tail plume kept), the barrel sliding out, two gold bands pinging on, a "ka-chunk" (0.55 s). Armed, the fuse fizzes |
| Touch | the shared cut-in; the ball → `load` (sealed in the barrel, `skip`), the shooter held (`holds` → sim.js takes his input; tackle-proof) | his own loading move instead of the shared wind-up's nod: the barrel tips up, the ball drops in, it comes down level for the first shot (no set piece: Idan dropped the flags, they looked pasted on) |
| +1.27 s, then +1, +2 | shells 1 and 2 (power-zones.js `shell`): flat at the ball's height and pace from the muzzle; a boot on the swing up = parry (no daze, nudged back), head / body / boot held out = the power hit (thrown, a mark) with a 0.4 s daze (`DAZE`); they burst on the goal line | recoil, a muzzle flash that lights the grass, a smoke ring, feathers and coins; an iron shell with a fire comet; the fuse burns down to the next shot. Each shot is drawn a size up on the one before (×1, ×1.3, ×1.65: shell, fire, smoke, blast, recoil, boom — the sim's sizes unchanged) |
| +3.27 s | the ball leaves the same muzzle as a straight power shot: counter (armed), kick-block (Idan 2026-10-13: the blocker fires THE WHOLE BARRAGE back — two shells, then the ball, held where he stands; no cannon for him, its charge glowing in front of his head between shots), early header, or a body — the hit, and the cannonball thuds down and rolls on at THUD_VX | the same flash and the same iron look; 0.09 s out its iron skin bursts off (light, a ring, shards) and the real ball flies on in a gold comet; 0.3 s later he flips back into the parrot and ruffles |

- **Damage**: there is no health in the game; "damage" is the power hit (`hitBody`, exported for
  the shells) — the throw, the daze, the face's mark (a dent on the cannon while he is one).
- **Balance**: `ONLY=1 node _power-balance.mjs 480` → 32% (the harness counts its window from the
  ball, `ballAt`, and shell hits apart). The knobs: THUD_VX (95 px/s 28%, 100 32%) and the shells'
  DAZE; their speed and knock move nothing measurable. Without the thud the CPU body-blocks the ball
  at its goal line (11%). **At 1 s apart the shells' daze is 0.4 s, not the power hit's 0.9:** with
  0.9 a defender a shell put down was up 0.1 s before the next shot reached him — he could never
  parry it or kick-block the ball (99% goals). With 0.4 he has ~0.6 s, as at 1.5 s apart; checked:
  hit by shell 1, he walks back out, parries shell 2 and kick-blocks the ball, both seats.
- **CPU** (shared/bot.js): under a loaded barrage it guards its goal and rolls its answer to the
  ball when the ball leaves; a CPU that kick-blocks (stage 24+) parries shells with its counterRate.
- **Ends safely**: full time and the golden goal clear shells and load (`powerHolds` only in play);
  a goal cannot happen while loaded; serialize/restore mid-barrage plays out the same (PROTOCOL 10).

### 1c. Worm Tunnel Ambush, redesigned (Idan, 2026-10-13)

Idan's brief: the Lord of the Worms transforms when armed (the change in her look, not a glow), and
her touch sends a worm under the pitch that comes up near the goal and spits the real ball at it,
with a readable route and a fair warning. The in-game champion is the drawn green snake (the card is
Ori among red-eyed worms): **Idan chose to transform the snake**, the card giving the worm look. His
answers: the ring's spot varies with where she touched it (no randomness), she is free to move while
it tunnels, the shot is a high lob dropping in, standing on the ring smothers it, a kick-block sends
the whole tunnel back, a hit coils, and only the smarter CPUs (stage 24+) go for the smother.

| When | What happens (sim, shared/champion-powers/stage-02.js) | What you see (public/vfx/powers/stage-02.js) |
|---|---|---|
| Press POWER | arms, as every power | her own face squashes down, coils tightening; a ripple runs up her from the coil to the crown (dirt spraying off its edge) and behind it she is a glossy brown ringed worm — the same hood arch, head, coil and tail curl, her lids, smirk and tongue kept, her eyes lit red; she stretches tall, the rings jiggle in turn, mud drops (0.6 s). Armed, the rings breathe and two little red-eyed worms poke out of the turf by her feet |
| Touch | the shared cut-in (1.27 s hold); the ball held where it leaves from | her own move instead of the shared nod: she rears and whips her head down at the turf in front; it cracks, a giant worm bursts out, climbs and winds two coils round the ball (its face showing between them), squeezes, rears |
| release → +0.28 s | `wdive`: the ball goes down into the turf 24 px ahead; no contact | the worm plunges back down its hole with the ball, dirt fountaining |
| +0.28 → +1.18 s | `tunnel`: the ball (on the grass line, unseen, no shadow) runs to the ring spot `ex` at a winding pace (`api.wave`); no contact. A `burrow` zone (inert, `zn`) carries its track | a mound of turf runs along under the players' layer, the grass parting over it, clods popping, a soil crack left behind |
| +1.18 → +1.63 s | `warn`: held under `ex`; no contact | the mound heaves, cracks run out (longer toward the goal), a red-and-green ring glows (r = 1.7 head radii), red eyes glint through the split |
| +1.63 s | `fly`: the burst — a lob from `ex`, up to its top (1.15× a jumping head's reach) a third of the way, then down on a lighter gravity to cross the line at 0.3 of the goal's height, 0.6 s at 300 px | the worm erupts, spits (mouth wide), sinks back; the real ball in a dark red rim, soil crumbs falling off it; her change back 0.3 s later (a wet-dog shake, the ripple running down) |

- **The ring's spot**: 260–380 px from the goal line by the whole px of the dive point (`emergeX`),
  at least 160 px of tunnel, never nearer the line than 220 (already nearer: where it went down).
- **Answers to the lob** (all with the real ball, the family's rules unless said): the **stomp**
  (KICK pressed on the ring in the 0.15 s before it bursts: smothered, the ball pops up loose, no hit.
  Idan, after playing it: only standing on the ring was too easy — now just standing there, the burst
  throws him aside, no daze, and the lob goes on through: `wormShove`); the **early
  header** (in the air within 170 px of the ring: deflected, no daze); the **counter** (armed); the
  **kick-block** — dropping from above it meets the crown before the boot comes round, so a kick on
  its swing up facing it blocks it (as a shell's parry), and the blocker sends the whole tunnel back
  (a 0.3 s `wgrab` first, no form for him); and the **crown**: the power hit (thrown, the 0.9 s daze,
  the face's mark, then `coiled` to 1.5 s) and the ball pops on over him (OVER_VX 180, OVER_VY 195).
  A body below the head: the family's hit, the ball bouncing off.
- **Balance**: `ONLY=2 node _power-balance.mjs 480` → 34% (Broadside 32%). The knob is OVER_VY: 170
  → 61%, 195 → 34%, 200 → 30%, 230 → 19% (a low pop stays under the bar). Without the pop-over (the
  family's bounce) it is 16%: the CPU meets it on its line, under the drop.
- **CPU** (shared/bot.js): under the tunnel it guards, as under the cannon's load (the lob's path is
  `hidden` until it bursts, and is measured from the ring); a counter-kicker (stage 24+) walks onto the
  ring — following the mound from the tunnel on — at its counterRate and stomps (counterRate 1: 38 of 60 stomped).
- **Ends safely**: a goal, a restart and the golden goal clear the burrow and the power; full time
  clears the burrow and the match stops where it is (as for every power) with her form off; serialize
  /restore mid-tunnel plays out the same (PROTOCOL 11). Look check: `_powers-hq.mjs worm` (each beat,
  cropped), `STAGE=2 … swap` (no face jump at the change, both seats).

## 2. How it is built

- **Sim**: shared/champion-powers/stage-NN.js (definition + hooks `launch / step / contact / skip /
  holds`),
  registered in shared/champion-powers.js. `everywhere: true` makes shared/hs-powers.js `shotFor` fire
  it outside the arcade at intensity 0.5. `knock` scales the hit's throw; `api.hit` (contact hook) is
  the hit without the bounce, so a power can decide where the ball goes.
- **Zones** (shared/power-zones.js): what a power leaves on the pitch — `strip` / `splat` (an ailment
  for whoever stands in it), `fence` (a wall for the ball). On `m.zones`, plain scalars, serialized as
  `zn` (online: shared/net.js PROTOCOL 10), cleared by a goal, a restart or full time. `shell`: a
  cannon shell in flight (Broadside) — not a ball, never a goal.
- **Statuses**: new ailments in hs-powers.js `AILMENTS` / `ailMods` — coiled, singed, sticky,
  brainfreeze (frozen stiff, then a shiver for its last `SHIVER` s) — drawn in public/vfx/ailments.js.
- **Look**: public/vfx/powers/stage-NN.js — `draw` (the flight), `cutin`, `armed`, `zone` (the
  pitch pieces, drawn by public/champ-vfx.js under the heads and the cut-in's dark), `event` (one-off
  bursts). Painted in the fx-kit's way: soft additive light, flipbook flicker, cached textures.
- **Sound**: public/audio.js `CP_VOICE` (each power's motif at the release) and `SFX.<event>`.
- **Tutorial**: the counter lesson's practice opponent is champion 4 (or 8 when your card is 4) — a
  dead-flat, head-height shot a timed kick blocks (shared/tutorial.js FOES; 1 fires a barrage now,
  5 is the coach).
- **Worn heads** (Broadside): a renderer's `head` + `wears` (champ-vfx wornHead) paint the whole head
  over the heads while game.js hides the DOM head (`ownsHead`), from the game's own face (`headArt`).
  Shells are drawn by `flying`, over the heads like the ball. `PORT=3197 CDP=9697 node _powers-hq.mjs
  swap` checks the face does not jump at the swap (both seats).

## 3. The tools

- `node _power-balance.mjs [trials] [tiers]` — the band: each power fired in a duel at CPU defenders
  (tiers 1–5), the shooter a CPU after the release (follow-ups count); goal / block / hit %, seconds of
  control lost. `ONLY=1,2` for some stages, `FAMILIES=1` adds every engine family as a reference
  (2026-10-11: ground, destructive and critical score 100% against the CPU, straight 8% — the
  family shots the other cards fire are far apart; the original powers sit in their middle).
- `PORT=3197 CDP=9697 node _powers-hq.mjs stills|video|perf [stages]` — the live client, frame-exact:
  `.shots/powers-hq/`. Perf (4× CPU throttle): every built power's FX draw < 0.35 ms p95.
- Play one: `/?unlockall&arcade=N`, or `/?me=legendary_N&foe=legendary_M&play=1&solo=1&nointro`.
- Tests: test-ultimate §16 (each power's promises, both seats; everywhere), test-arcade §2b, test-vfx
  §3b (drawn, cheap), test-tutorial (the lesson's opponent).

## 4. Visual direction (from the plan)

**Recommended direction: "HS craft, our own shapes"**
1. **Four beats per power, each with a payoff:**
   - **Arm:** the gold crackle, tinted with the champion's colour.
   - **Cut-in:** the shared sun, plus a **champion emblem moment** such as a feather burst, a spinning globe or a vault wheel.
   - **Flight:** a signature ball skin plus trail.
   - **Impact:** hit, block or goal, each with its own ring, particles and sound.
2. **Silhouette first.** Each power should be recognisable at thumbnail size from shape and motion alone, before colour.
3. **True-ball rule.** The real ball always keeps its white core and ball pattern. Decoys, echoes and hazards never do.
4. **Colour language by effect:**
   - fire / no-kick: orange
   - cold / slip: cyan
   - sticky / slow: brown
   - drain / shock: yellow
   - mind effects (reverse, facing, charm): magenta-pink
   - displacement: white wind lines
5. **Telegraph rule.** Every hazard or late change shows 0.2–0.7 s of warning, drawn on the turf or in the air where it will happen.
6. **Screen limits:**
   - at most 3 big moving objects on screen;
   - flashes no longer than 2 frames, at no more than 30% white;
   - shake of 6 px or less for 0.2 s or less;
   - no extra darkening outside the cut-in;
   - all effects gone within 2.5 s of release.
7. **Craft:**
   - fx-kit textures with flipbooks of 8–16 frames;
   - additive light over the stadium and normal blending for solid props;
   - 1–2 frames of hit-stop on impact;
   - layered synth sound: a whoosh on release, a signature motif, and a body thud on impact.
8. **Performance:** about 40 blits per frame per power at most, held by test-vfx §3b and the iPhone frame meter.

## 5. Balance framework (from the plan)

**Shared rules for all 45:**
- Same gauge, same arming, same cut-in, same release.
- Every power **can always be answered by an armed counter**; nothing is uncounterable.
- Extra loss of control on a hit is capped at **≤ 1.5 s** on top of the standard 0.9 s stun.
- Hazards are capped at **≤ 1.6 s**.
- Nothing depends on spending or grinding: cards come from the album, and online stats are equal.

**Budget: each power spends about 4–5 points.**

| Axis | 0 | 1 | 2 |
|---|---|---|---|
| **P** pace | ≤ 0.85× comet | ≈ 1× | ≥ 1.35× or a burst |
| **L** line | flat at head height | low or one bend | from above, multi-segment or wave |
| **R** read | nothing to read | one late change or a mixup with a tell | decoys, hidden or branching |
| **B** block-proofing | normal kick-block | one answer fails or the ball survives a block | kick-block fails |
| **Y** payload | standard hit | ≤ 1 s extra | ≥ 1.2 s, displacement, or resource loss (2.5) |
| **U** utility | none | small hazard or self-buff | big hazard, defence, mobility or safety |
| **−T** tell / risk | none | −0.5 short tell | −1 long tell or real risk to the shooter |

**How the budget maps onto the code:**
- The budget is a design estimate. It extends today's `difficultyScore()` (speed, disable, jumpers, decoys, invisible, through, above, blockKO) with hazard, utility and tell terms.
- **Measured truth wins.** A new harness, built on `_power-def.mjs`, fires each power at intensity 0.5 against every CPU tier and against a fixed reference defender. It reports:
  - goal / block / counter / hit percentages;
  - mean seconds of control lost.
- Every power must land inside one band, proposed as ±6 points of goal % around the median and set **just below the Mythic Gem**.

**Arcade ladder vs. equal strength.**
- At intensity 0.5 (online, free play and the player's own card), all 45 sit in the same band.
- The arcade still climbs through:
  - the existing CPU smartness and stats ladder;
  - each power's own 1–3 dials (speed, seconds, size), scaled 0.6×–1.4× by stage intensity.
- test-arcade §2b would change from "the designs escalate" to "the band holds at 0.5, and the intensity-scaled score never steps down".

## 6. The 45 concepts (as planned — §1 says what is built, where it differs)

All 45 use the standard loop: gauge full → press POWER → the next touch fires → the 1.5 s cut-in → release. "T+" counts from release. One comet crosses midfield → goal in about 0.21 s.

| # | Champion: design · card | Power & core effect | Timing | Visuals (fit) | Counterplay / limits | Budget |
|---|---|---|---|---|---|---|
| 1 | **התותחן** The Cannoneer: pirate parrot captain · backyard ship hut, flags, coins, bubbles | **Broadside**: a heavy iron cannonball, flat at head height. A block holds but the blocker skids back 120 px. A hit throws him 1.3× further. | ~0.22 s from midfield | Iron ball with white-hot rim, muzzle smoke-ring, feather + coin pop, ember smoke trail | The easiest line to read: head it, block it (it costs position), or counter | P1 B1 Y2 = 4 |
| 2 | **אדון התולעים** Lord of the Worms: coiled green snake · Ori in a pit of red-eyed worms | **Snake Strike**: slithers along the turf (0.9×), then rears up to head height 220 px before goal. Hit = *coiled*: half speed, no dash, 1.2 s. | Low ~0.25 s, rise 0.1 s | Scale trail in the grass, the card's red-eyed worms popping up along it, the snake rearing at the rise, a hiss | Kick it low while it slithers, or head it at the rise; jumping early is the trap | P0.5 L2 R1 Y1 = 4.5 |
| 3 | **השף הבוער** The Burning Chef: flame-grilled burger · many-armed chef at blazing grills | **Sizzle Line**: a knee-high shot that sears a grill strip on the turf behind it (1.5 s). Standing or landing on it = *singed*: no kick for 1 s. | Strip follows the ball | Char-marked patty ball, grill-bar decals, flame licks, sesame sparks, sizzle | Kick it low (a normal block), or jump and land clear of the strip, which you can see | P1 L1 Y1 U1.5 = 4.5 |
| 4 | **מלך הבוץ** King of Mud: the Saltiz chocolate bar about to burst · crate of marshmallows, rare sweets | **Choco Burst**: the bar shakes, then bursts at mid-pitch. A sticky splat (r 60 px, 1.6 s) lands on the defender's spot: half-height jumps, no dash. The ball flies on. | Shake 0.2 s, splat lands ~0.15 s before the ball | Foil burst + confetti, glossy chocolate splat, bouncing marshmallows | It targets a spot, not a player: step off during the shake; counter | P1 R1 U2 Y0.5 −T0.5 = 4 |
| 5 | **בונה החומות** The Wall Builder: red-orange ice pop with a bite · Paz in a fedora and lei bursting from an ice pool, popsicles flying | **Ice-Pop Barricade**: a normal shot, plus a fence of 3 giant ice pops sprouts in front of the shooter's **own** goal for 4 s (stops balls up to head height). Hit = *brain-freeze*: slowed 1 s. | Fence rises during the cut-in | Rainbow ice pops with bite marks and drips, frost mist, hibiscus confetti | Chip the fire-back over the fence, or wait 4 s; the shot itself is plain | P1 Y1 U2 = 4 |
| 6 | **איל ההון** The Tycoon: a sack of coins as a fighter · beach fighter under a tipped sack | **Heads or Tails**: a giant coin lob. At its peak it shows a face for 0.35 s. HEADS = dives low to the near post; TAILS = sails into the high far corner. Hit = coin shower, dazed 0.6 s. | Peak ~T+0.45 s; the face comes from a deterministic sequence | Gold coin with the sack/face, flip flipbook, rim glints, "ka-ching" | Read the face, step to its spot; counter | P0.5 L2 R1.5 Y1 −T0.5 = 4.5 |
| 7 | **הקפצן** The Bouncer: tin bank-robot with a glass box of coins for a skull · Shoval in a glass box of coins | **Bank Shot**: hits a glass pane that flashes in at the top of the screen, ricochets onto the turf in front of the defender, then up into the goal. Each bounce point lights 0.25 s ahead. Hit = *tilt*: shocked 1 s. | 2 bounces, ~0.6 s | Glass pings with cracks, pinball bumper rings, "+100" pops, coin drops | Stand at the second bounce point; a normal block works on any segment | P1 L2 R1 Y1 −T0.5 = 4.5 |
| 8 | **האיש המגנטי** The Magnet Man: the target with an arrow in it · William Tell, an arrow through the apple | **Apple Split**: a flat, quick shot (1.15×). A **header or body block splits it**, and the real half carries on low at 0.6×. A kick-block or counter stops it clean. | ~0.18 s | Target rings rippling off the ball, apple halves, arrow fletching, "thwip-thock" | Kick, don't head, or chase the low half with a second touch | P1.5 B1.5 Y1 = 4 |
| 9 | **גולש הגלים** The Wave Surfer: raspberry-syrup blob with a straw · Ori diving into raspberry syrup, a red wave | **Syrup Curl**: a syrup wave rises from the turf ahead of the defender, carries the ball **up and over his head**, and dumps it just in front of the goal. Touching the wave = *drenched*: slippery for 1.2 s. | Wave T+0.25 s, crest 0.3 s | Glossy red wave with foam and droplets, a surf-curl flipbook | Drop back and head the dump, or meet the ball before the wave rises; counter | P0.5 L2 R1 Y1 = 4.5 |
| 10 | **הענק** The Giant: fire spirit · fire-breather through a flaming ring, chillies | **Ring of Fire**: a flaming hoop appears mid-pitch at one of two heights. The ball bends through it and **jumps to 1.6×** afterwards. A kick-block of the fired-up ball singes the blocker (no kick 0.8 s). | Ring visible 0.3 s ahead; 0.8× before, 1.6× after | Heat-shimmer hoop, the ball ignites into a fire streak, chilli sparks | The ring shows the height: get there early, or block before the ring | P2 L1 R0.5 B0.5 Y1 −T0.5 = 4.5 |
| 11 | **המכווץ** The Shrinker: a banshee with Ori's hair · haunted forest, ghosts | **Banshee Wail**: a knee-high scream wave runs 0.3 s ahead of the ball. Caught by it = pushed back 80 px and *spooked*: no jump for 0.6 s. | Wave, then the ball 0.3 s later | Pale blue-white crescent with ghostly hands, a wispy sheet-ghost trail, a wail | Jump the wave and you are free for the ball; counter | P1 R1 Y2.5 −T0.5 = 4 |
| 12 | **האסטרונאוט** The Astronaut: a globe pinned at Japan · "wherever the finger stops, you fly there" | **Pin Drop**: the ball rockets off the top of the screen. A map pin plants at one of 3 spots before the goal, and the ball drops almost straight onto it, then bounces in. A drop from straight above can only be headed. | Pin T+0.3 s, drop T+0.9 s | Spinning mini-globe in the cut-in, the head's dotted flight line traced up the screen, a red pin with a shadow, a landing ripple | Go to the pin and head it; the long wait gives time; counter | P0.5 L2 R1 B1.5 −T1 = 4 |
| 13 | **המטפס** The Climber: black-and-gold daruma · gold-dragon kimono, lanterns | **Daruma Roll**: a weighted, wobbling roll along the turf. A block or header **doesn't fire it back**: it rights itself and rolls home to the shooter. | ~0.3 s | Daruma face on the ball, gold-dragon trail, lantern sparks, a wooden "tok" | Easy to stop, but stopping it wins you nothing; counter still works | P0.5 L1 Y0.5 U2 = 4 |
| 14 | **נהג המרוצים** The Racer: fairytale castle, amazed · Shoval green on a theme-park coaster | **Coaster Run**: a glowing coaster track snaps out across the pitch during the cut-in (a hill, then a drop to knee height at goal). The ball rides it at 1.4×. | The track shows through the whole cut-in; the ride ~0.4 s | Candy rails with bulbs, a tiny cart, castle fireworks on a goal, clack-clack then whoosh | Fully telegraphed: stand at the drop and kick low; counter | P2 L2 B0.5 Y0.5 −T1 = 4 |
| 15 | **מרים המשקולות** The Weightlifter: a suspiciously heavy present · Paz as Santa with presents | **Heavy Delivery**: a gift-wrapped ball, flat just above head height. While it flies, the defender is *weighed down* (gravity ×1.6: short, low jumps). | Weight from release until the ball stops | Ribbon-bow trail, a present-shaped weight icon over the victim, a heavy thud | Stand tall and head it, or kick at the top of a hop; counter | P1 L1 Y2 = 4 |
| 16 | **מקפיץ האבנים** The Stone Skipper: melon cream soda · Ori's green-only konbini day | **Fizz Skip**: skims the turf 3 times, hopping knee / head / knee (0.9×). Hit = *fizzy*: jumps go 30% higher and float for 1.2 s. | ~0.2 s per skip | Green soda ball, cream-foam crest, bubbles bursting at each skip, cherry sparkle | Read the rhythm: block a low hop or head the high one | P0.5 L2 R1 Y1 = 4.5 |
| 17 | **רוכב הסערה** The Storm Rider: astronaut in the card's suit · sleep pod, red alarm lights | **Zero-G**: at release the defender goes weightless (gravity ×0.35, 1.2 s), so jumps float up and come down late. The ball flies flat. | 1.2 s from release | The helmet's red siren spins in the cut-in, a visor glint, a starry bubble round the victim, red alarm beacons, a beep | Don't jump: kick-block on the ground, body-block, or counter | P1 R1 Y2 = 4 |
| 18 | **הסטרייקר** The Striker: a robot-hotel staff robot · alone in a hotel run by robots | **Laser Grid**: two red beams sweep the defender's half at shin height and full-jump height. The ball flies through the gap, just above head height. Touching a beam = *scanned*: shocked 0.8 s. | Beams T+0.1–0.7 s | Scan lines with HUD reticles, robot-eye glow, beeps, sparks on contact | A short hop or a standing kick-block meets it; a full jump hits the beam | P1 R0.5 U2 Y1 = 4.5 |
| 19 | **הג'וקר** The Joker: chameleon, eyes two ways · crew on a giant warty toad | **Two-Way Look**: two ghost lines (high and low) show both possible paths. At half-way it commits, with a colour flash. Hit = reversed controls 1.5 s. | Commit ~T+0.15 s | Camouflage-stripe ball, two dotted eye-lines, a tongue-flick on the commit | Hold the middle and react after the flash; counter | P1 L1 R2 Y1 −T0.5 = 4.5 |
| 20 | **איש השלג** The Snowman: gold throne with a crown and icy drips · Paz as king in a gold palace | **Royal Ice Carpet**: a frozen red carpet unrolls along the turf to the goal (1.6 s). The ball glides just above it at knee height. Anyone on the carpet slides with no grip. | The carpet rolls out ahead of the ball | A gold-trimmed red carpet glazed with ice, icicle drips like the head's, a crown glint on the ball, a fanfare sting | Kick from the carpet's edge or jump onto it late; the slide is predictable | P0.5 L1 U2 Y0.5 = 4 |
| 21 | **צייד המטאורים** The Meteor Hunter: steaming hot-spring bucket · half samurai, half onsen bather | **Geyser Trap**: a steaming crack opens under the defender's feet at release. 0.6 s later a geyser erupts there and lifts him for 1 s (no control). The ball flies flat. | Crack T+0, eruption T+0.6 s | Bucket emblem, a bubbling crack, a white geyser column, a katana-slash streak on the ball | Step off the crack (you give up position) or counter | P1 U2 Y1.5 −T0.5 = 4 |
| 22 | **הגנב** The Thief: raccoon bandit with stolen lightning · golden swirl, the smallest woman | **Power Heist**: a quick comet. If it touches the defender at all, **hit or block**, it moves 35% of his gauge to the shooter. | ~0.2 s | Raccoon-mask streak, the head's stolen bolt, the card's golden swirl siphoning yellow energy between the HUD bars | Counter it, or an empty gauge loses nothing; it is plain to stop otherwise | P1 B0.5 Y2.5 = 4 |
| 23 | **רעם האדמה** Earth Thunder: a tyre with rocks flying round it · self-driving car flipping, wheels and rocks | **Burnout Quake**: the tyre slams the turf at mid-pitch. A ground ripple races to the defender and bounces him off his feet (0.5 s) if he is grounded. The tyre rolls in low 0.25 s behind it. | Ripple T+0.15 s | A tyre ball with tread marks and burnout smoke, scorch skids, a cracked-turf ripple throwing up the card's rocks, a rev + thump | Jump the ripple, then kick the tyre as you land (a two-beat rhythm) | P0.5 L1 R1 Y1 U1 = 4.5 |
| 24 | **האקרובט** The Acrobat: genie's lamp · treasure cave, the lamp crackling | **Genie Blink**: the ball vanishes in a puff and reappears 250 px further on, at another height. A smoke ring marks the exit 0.2 s before. | Blink ~T+0.1 s | Purple-gold puffs joined by a genie wisp, the lamp's lightning crackling at both ends, coin glints, "poof-pling" | Watch the exit ring and reset; block normally after it reappears | P1 L1 R2 Y0.5 −T0.5 = 4 |
| 25 | **המטעה** The Trickster: the scuba diver · playing piano on the sea floor | **Deep Dive**: the ball sinks through a bubble column at 0.45×, falling from head to knee height. When the bubbles stop it surfaces and bursts on at 1.5×. | Slow 0.4 s, then the burst | Bubble trail, mask glint, aqua light shafts, a gulp then a pop | Kick it low while it is slow, or brace for the burst; counter | P1.5 L1 R1.5 = 4 |
| 26 | **המחליק** The Slider: Tokyo vending machine · Tokyo neon, vending-machine belly | **Can Barrage**: three frosty cans tumble along the turf ahead of the ball. Running into one = tripped 0.5 s. The ball flies at head height. | Cans T+0–0.6 s | Neon vending glow, clattering cans with condensation sparkle, clunk sounds | Hop the cans, then head the ball, or block it from behind the cans | P1 R1 U2 Y0.5 = 4.5 |
| 27 | **שומר הפורטל** The Portal Keeper: carousel horse · golden coaster through the clouds | **Carousel Gallop**: the ball gallops through the air in smooth up-and-down beats (2½ waves, 0.8×) without touching the turf. Hit = *dizzy*: spun 0.8 s. | ~0.5 s | A gold pole streak, fairground bulbs blinking along the path, a ribbon tail, an organ sting | Time a header at the bottom of a beat; counter | P0 L2 R1 Y1 = 4 |
| 28 | **זורק הבומרנג** The Boomerang Thrower: diamond ring · hired bride, cupid, hearts | **Heart Loop**: flies out high, loops back in a heart-shaped curl, and swoops in low. Hit = *smitten*: walks toward the shooter for 1 s. | Loop ~0.5 s | Diamond-sparkle ball, a pink heart trail drawing the loop, cupid wings in the cut-in, a chime | The loop is slow: get under its exit and block low | P0.5 L2 R1 Y1.5 −T0.5 = 4.5 |
| 29 | **הכורה** The Miner: narwhal, its tusk the drill · Ori's underwater suite | **Tusk Drill**: a spiralling shot that spins up for 0.2 s, then **bores through a kick-block**. A header, body or counter still stops it. A bored-through blocker spins 0.8 s. | Spin-up 0.2 s | Ice-blue spiral tusk round the ball, a foam corkscrew, a sparking grind on a kick | Meet it standing with your head or body; counter | P1 B2 Y1.5 −T0.5 = 4 |
| 30 | **אדון המשיכה** The Lord of Pull: wagyu slab with chopsticks · Tokyo yakiniku feast | **Chopstick Snap**: giant chopsticks wait in mid-air, visible from release. They pinch the ball and snap it down steeply toward the foot of the goal. Hit = *pinched*: lifted 0.6 s. | Snap at ~60% of the way | Lacquered chopsticks, a marbled-wagyu ball skin, sizzle sparks, a clack | You know where the snap is: stand under the exit and kick low | P1 L2 R0.5 B0.5 Y1 −T0.5 = 4.5 |
| 31 | **השואב** The Vacuum: rat crowned with mouldy bread · a "one-star" dungeon hotel | **Rat Run**: a low, scurrying roll. The first time the defender gets close it **hops over his boot** (once, 0.3 s), then scurries on. | The hop reacts to the defender | Rat-tail streak, crumbs, cobweb wisps, a squeak on the hop | Bait the hop and head it mid-hop, or kick after it lands | P1 L1 R1.5 B1 = 4.5 |
| 32 | **הרוזן האפל** The Dark Count: white rabbit turned vampire · Alice down the rabbit hole, watch, cards | **Drink Me**: the ball (hitbox too) grows to 1.6× and shrinks to 0.6× twice in flight. Hit = *topsy-turvy*: upside down 1 s, no jump. | 2 pulses | A "drink me" tag, card-suit sparkles, a bat-wing shadow, a pocket-watch tick | Touch it while it's big; counter | P1 L0.5 R1.5 Y1.5 = 4.5 |
| 33 | **רגל הזהב** The Golden Foot: a Monopoly-style tycoon · go-kart race through Tokyo, a mystery box | **Golden Express**: the fastest straight shot (1.35×), with no tricks. Hit = *jailed*: barred in place 1.2 s (can still jump). | ~0.15 s | Gold banknote trail, a top-hat glint, cell bars on the victim, a cash-register ring | Pure reaction: be in the line early and block; counter | P2 Y2 = 4 |
| 34 | **אמן הצמר** The Wool Master: weather wizard · a glass orb with a storm cloud | **Gale Force**: a wind lane blows across the defender's half for 1.2 s, pushing him toward his goal (~150 px/s) and drifting his jumps back. The ball rides the tailwind (1.15×). | Wind from release | Swirling wind streaks, wool tufts and leaves, a storm cloud with lightning flickering inside (the card's storm orb), whistling | Walk into the wind to hold your spot (jumping is the trap); kick-block | P1.5 U2 Y0.5 = 4 |
| 35 | **הנווט** The Navigator: caveman's joint of meat · Shoval as a caveman at a fire | **Homing Hunt**: a near-straight shot that, once, at ~200 px from the defender, steers over or under his head, whichever side is further from it. | One steer | A meat-on-bone ball with roast steam, smoke-signal puffs where it steers, a drum hit | Bait the steer: stay low then jump late, or the reverse; counter | P1 L1 R2 = 4 |
| 36 | **הופך העולמות** The World Flipper: a gold coin in a top hat and monocle · Ori with a gold phone, paid in agorot | **Flip Side**: a coin flipping end over end. Hit = **turned round for 1.2 s**: his kicks and headers go toward his own goal. | ~0.21 s | A spinning coin with a top-hat glint on one face, a mirrored shimmer round the victim, a turn-around whoosh | Just block it; the danger is only a clean hit | P1 R0.5 Y2.5 = 4 |
| 37 | **אדון המראות** The Mirror Master: magic mirror cracked by a sledgehammer · a secret purple gaming room | **Hall of Mirrors**: three mirror panes flash up in front of the defender. The ball zig-zags between them (3 quick reflections, ±60 px), then exits into the goal. Hit = *dazzled*: dazed 0.5 s. | Panes 0.2 s before the ball | Purple neon frames, crystal shards, the ball reflected in each pane, glass tings | Hold your spot and block after the last reflection | P1 L2 R1 Y0.5 −T0.5 = 4 |
| 38 | **המשגר** The Launcher: a sprouting coconut launched off its palm · Naveh in an excavator bucket, beach indoors | **Palm Catapult**: a high coconut lob (0.85×) toward the goal mouth, **and the shooter is catapulted forward** to follow it up. | Lob ~0.7 s, leap 0.5 s | A bending palm in the cut-in, a coconut skin, a sand spray on the leap, a boing | Head the lob and clear fast; his goal is open for your quick break | P0 L2 R0.5 U2 Y0.5 −T1 = 4 |
| 39 | **מלך הכדרור** The Dribble King: a prime minister · Shoval behind a big desk, papers flying | **Veto**: a quick shot (1.15×) stamped VETO. While it flies, the defender's arm is suspended (**no counter**). Hit = *red tape*: tangled 1 s (no dash, half speed). | Veto = flight + 0.5 s | A paper-storm trail, a rubber-stamp impact, fluttering flags, a gavel knock | Block or head it; the only answer it takes away is the counter | P1.5 B1.5 Y1 = 4 |
| 40 | **רוח הרפאים** The Phantom: see-through gummy bear with trailing ghosts · candy store at night | **Gummy Echo**: two see-through gummy echoes follow the real ball on the same line, 0.25 s and 0.5 s behind. Echoes can score but break on any touch. | Three beats | Green gummy ball (the head), rainbow echoes linked like the card's gummy snake, sugar sparkle, a boing-boing-boing rhythm | Block the first, then flick the echoes with any touch; a counter stops all | P1 R2 B1 = 4 |
| 41 | **שומר הזמן** The Time Keeper: supercar, headlights for eyes · Lamborghini contest, chequered flags | **Rev Limiter**: the longer the shooter stays armed before the touch (up to 3 s), the faster the shot: 0.8× → 1.4×. A full-rev hit knocks back 1.3×. Headlights brighten and the engine revs, so both players can read the charge. | Arm, rev, touch | Headlight beams, a chequered tail, tyre smoke on release, a rising engine pitch | Tackle or steal the ball while he revs; pre-position at full charge | P1.5 R0.5 Y1 U1 −T0.5 = 3.5–4.5 |
| 42 | **התאום** The Twin: tank, all turret and grin · Ori shot out of a tank's cannon | **Double Barrel**: two real shells at once: one at head height (1.0×), one rolling low at 0.6×. | Both from release | Twin muzzle flashes, olive shells with tracers, track dust, a double boom | Block the high one, then step and kick the low one | P1 L1 R1 B1 = 4 |
| 43 | **המפצל** The Splitter: Carolina Reaper in a black hood with a scythe · Naveh breathing fire after a bite | **Reaper Split**: at ~65% of the way a scythe slash splits the pepper into 3 fireballs (high, mid, low). Only the one with the white ball core is real. Touching a fake = *spicy*: no kick 0.8 s. | The split happens near the defender | A red pepper ball, the hood and scythe in the cut-in, a silver slash arc at the split, fire spray, a sizzle | Look for the white core; counter | P1 R2 Y1 = 4 |
| 44 | **עין הסערה** The Eye of the Storm: the rodeo bull itself (cowboy hat, nose ring, red eyes) · Naveh on a raging bull, a cowboy flying off, fireworks | **Rodeo Charge**: the ball charges low along the turf inside a dust cloud, horns first (0.95×). A kick or body touch gets you **bucked**: tossed high, down again 1 s later, and the ball charges on. Only **landing on top of it** stops it: a header from above, "riding the bull". | ~0.3 s from midfield | A dust-cloud charge with hoof-print stamps, a horn silhouette, red eye glints, a firework pop on a buck, a snort and stomp | Jump early and come down on it; counter | P0.5 L1 R0.5 B1.5 Y1.5 −T0.5 = 4.5 |
| 45 | **אדון הזמן** The Time Lord: vault door frozen shut · Naveh turned to cracked stone in a bunker | **Lockdown**: the vault wheel spins at release. When the ball crosses mid-pitch, the defender is time-locked (greyed, frozen) for 0.7 s. **An armed defender is immune.** | Lock at mid-pitch | A steel wheel in the cut-in, light from cracks, a ticking ring filling round the victim, a heavy clunk | Get into the path **before** the lock and body-block it; or be armed | P1 R1 Y2.5 −T0.5 = 4 |

---

## 7. Originality and overlap check

**Close to an HS mechanic, and how each is made distinct:**

| Ours | Closest HS power | What makes ours different |
|---|---|---|
| #43 Reaper Split | Japan: a real ball among fakes, marked by colour | It splits late near the defender. The real ball is marked by the universal white core, not a colour. The fakes burn rather than just fake. |
| #21 Geyser Trap | New Zealand: telegraphed strike circles | One crack under *you*. It lifts instead of stunning, and the shot is separate. |
| #26 Can Barrage | Austria / Sweden: hazard projectiles | Rolling trip hazards at your feet while the ball comes at head height: a two-height read. |
| #40 Gummy Echo | Spain: 3 real balls | Same-line echoes that break on any touch: a rhythm test, not a spread. |
| #2 Cobra Strike | Chile: snake shot | Low-then-rise path with a green hood flare. No giant black viper and no wrap-and-drag. |

Freeze and ice visuals must not use a snowman or a man in an ice block.

**Internal pairs, and how they stay apart:**

| Pair | Shared lever | How they differ |
|---|---|---|
| #15 Heavy ↔ #17 Zero-G | Both scale the defender's gravity | Heavy: you can't get **up** (high ball). Zero-G: you can't get **down** in time (flat ball). If that is too close, #15 becomes "a present that pops up once when blocked". |
| #8 Apple Split ↔ #43 Reaper Split | Both split | #8 splits **only if you head it**. #43 splits on its own. |
| #7 Bank Shot ↔ #37 Hall of Mirrors | Both bounce | #7 makes 2 big bounces across the pitch off the top and the turf. #37 makes 3 tight zig-zags right in your face. |
| #6 Heads/Tails ↔ #19 Two-Way ↔ #35 Homing | Binary mixups | #6 has a long tell at the peak. #19 shows two lines and commits at half-way. #35 reacts to *your* head. |
| #9 Curl ↔ #12 Pin Drop ↔ #30 Chopsticks | Late drops | #9 goes over your head. #12 drops vertically onto a marked spot. #30 snaps at a visible point in mid-air. |
| #3 Sizzle ↔ #4 Choco ↔ #20 Carpet | Turf hazards | #3 is *behind* the ball (punishes landing). #4 lands *on your spot*. #20 lies *ahead* the whole way (footing). |
| #11 Banshee ↔ #34 Gale | Both push | #11 is one wave you can jump. #34 is a 1.2 s lane you fight by walking. |
| #16 Fizz ↔ #27 Gallop | Rhythmic | #16 touches the turf (low hops you kick). #27 floats mid-air (headers). |
| #33 Jail ↔ #45 Lockdown | Both immobilise | #33 is after a hit, and you can still jump. #45 is before the ball arrives, and arming makes you immune. |
| #29 Drill ↔ #44 Rodeo Charge | A kick doesn't stop either | #29 flies at head height: head or body-block it. #44 runs low: touching it from the side bucks you, so you must come down on top of it. |
| Low rollers: #2, #13, #23, #31, #44 | Five shots along the turf | Each has a different answer: #2 kick it before it rises; #13 is easy to stop but gives no fire-back; #23 jump the ripple, then kick; #31 bait the hop; #44 land on it. |
