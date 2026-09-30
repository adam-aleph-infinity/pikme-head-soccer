# HS's first 3 power shots against ours — research, comparison, fix roadmap

Research 2026-09-30; fixes built the same day (§7). Idan's choices: build the wiki counter-plays now,
a plain rebound for a blocked Thunderbolt, and no voice line.

## 0. Which powers these are

HS's Arcade orders its characters by star rating, and the first three are
([Arcade](https://headsoccer.wiki.gg/wiki/Arcade) wiki page):

| # | HS character | ★ | HS power | our arcade stage | our champion title | our power |
|---|---|---|---|---|---|---|
| 1 | South Korea | 0.5 | **Blue Aura Shot** | 1 | התותחן | הילה כחולה (`blueaura`) |
| 2 | Cameroon | 1 | **Thunderbolt Shot** | 2 | אדון התולעים | ברק (`thunderbolt`) |
| 3 | Nigeria | 1.5 | **Tornado Shot** | 3 | השף הבוער | טורנדו (`tornado`) |

Our stages 1–3 were already built on these three (`docs/HS-45-POWERS.md`). This document checks how
close we got.

### Evidence, and how much to trust it

| source | covers | quality |
|---|---|---|
| Idan's recordings M1–M4 (`hs-video/`, 60 fps; M3 and M4 at 2556×1180) | **Korea only**: 11 cut-ins, blocks, hits, goals (`docs/HS-POWER-SHOTS.md`) | ground truth |
| Wiki GIF `South_Corea.gif` (640×480, 25 fps, 98 frames) | Korea: a full shot, from the press to the hit | good; it matches the footage, which is how the GIF clock was calibrated |
| Wiki GIF `QqqGYR.gif` (320×180, 12.5 fps, 39 frames) | Cameroon: the cut-in, the flight, a goal | low resolution, but the shapes and colours are clear |
| Wiki GIF `Electrocution_Cameroon.gif` (61×60) | Cameroon's power-ball sprite itself | exact, but only one frame |
| Wiki GIF `Nigeria.gif` (640×480, 25 fps, 90 frames) | Nigeria: the cut-in, the flight, a catch, the aftermath | good |
| Wiki text (the character pages, [Power_Shots](https://headsoccer.wiki.gg/wiki/Power_Shots), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide)) | behaviour, ailments, tips | descriptive; no numbers |
| Ours: `node _powers-hq.mjs video 1 2 3`, and `node _first3-probe.mjs` (the wiki's counter-plays run in our sim) | ours | exact |

All frames used here are copied into `.shots/first3/` (git-ignored): the HS sheets `hs-*.png`, ours
`ours-*.png`, the source GIFs and `korea-comet-hs-vs-ours.png`.

**The GIF clock.** Korea's comet is 2150 px/s in the footage. In `South_Corea.gif` it moves 50 GIF px
a frame, which puts that GIF at ≈ 25.9 real frames a second, so it plays at about real time.
Speeds read off the other GIFs assume the same pipeline and carry about **±15 %**.

**Never filmed by us:** Cameroon's shock on a defender (neither GIF shows it), Nigeria being
blocked, and any of the three powers' sounds. Every claim about those is marked *uncertain* below.

---

## 1. HS's first 3 powers

### What all three share (the HS "grammar")

| stage | HS (identical for all three) |
|---|---|
| press | instant; the whole character sits in a yellow silhouette glow with thin white-cored wisps; it never expires |
| touch → cut-in | 1.27 s frozen, then ≈ 0.23 s played under the dark: the stadium darkens to ≈ 21–32 %, a white disc and three gold ray layers turn behind the shooter, his head tips back 59° and whips forward like a header, and the ball drifts to his front. No text, no zoom, no name. It is one fixed animation, the same for every character (the Cameroon and Nigeria GIFs show the identical sun) |
| release | ≈ 2.5 head radii in front of the shooter, at the height he touched it |
| identity window | **only the flight (≈ 0.2–0.5 s) and what happens to the defender** differ between powers |
| block (kick into it) | a yellow-white spark orb, 0.8 s grind, 0.4 s dead, then it fires back |
| hit | red spark droplets, the head snaps back, the defender is knocked back and dazed with 3 gold stars |
| counter (armed touch) | his own cut-in, and his own shot goes back |

The set **escalates**. Korea is the plain shot. Cameroon is the same flight plus an after-effect.
Nigeria changes the path (along the ground) and the reach (it catches jumpers), and has the biggest
payoff (the defender is launched).

**The colour logic of the set:** every warm colour on screen (gold rays, yellow glow) belongs to the
shared press and cut-in. Each power's own effect is **cool or white**: cyan-blue, white-lavender,
white. So the moment the ball leaves, the colour change itself says "the shot is flying".

### 1.1 South Korea — Blue Aura Shot (filmed)

- **Power fantasy:** the plain cannon, a ball fired faster than anything else in the game. It
  teaches what a power shot is.
- **Flight:** dead flat (± 2 % of the frame height), no gravity, **≈ 2150 px/s**, 2.6× the hardest
  kick, so it crosses the pitch in ≈ 0.5 s.
- **Look:** the ball sits at the nose of a white-hot core ≈ 70 px tall. Round it is a cyan body
  fanning to ≈ 130 px tall ≈ 130 px behind the ball, with a green-yellow seam on the upper side,
  deep blue at the edges, and streaks running out ≈ 330 px back. The upper side of the tail spreads
  more than the lower. It is full for 0.2 s, then thins to a faint cyan streak with sparkles, with
  4 motion-blurred after-images of the ball.
- **Defender:** unarmed and not kicking, he is **hit**: red droplets, knocked back toward his goal,
  dazed ≈ 0.5 s, and the ball bounces off him at ≈ 1800 px/s. Grazing the crown it carries on into
  the goal behind. Kicking, it is **blocked** (see above).
- **Wiki behaviours:** "very easy to block and counter". **Jump right in front of Korea as he fires
  and the ball ends up in his own goal**, though the positioning is critical, or you get knocked into
  your own goal with it. The Power_Shot_Guide adds that it is best jumped from your own half and is
  stronger against weak (under 5★) characters.
- **Sound:** the wiki says "He yells '**Power Shot!**'". The page has "Power Shot" and "Hurt Sound"
  audio sections. *Uncertain:* the M4 audio is mostly music at low level. It has a broadband whoosh
  at the release, but no clear voice can be picked out of it.
- **Iconic because:** it is one huge, simple, cyan shape, the most readable thing in the game.

### 1.2 Cameroon — Thunderbolt Shot (wiki GIFs; not filmed)

- **Power fantasy:** the sky strikes the ball. The same cannon as Korea, but charged, and a hit
  leaves a mark on the defender.
- **Flight:** straight and flat like Korea's. **≈ 2280 px/s** off the GIF (50–60 GIF px a frame on
  a 320-px pitch at 12.5 fps), i.e. Korea's speed within the error.
- **Look (`hs-2-cameroon-flight.png`, `hs-2-cameroon-ball-sprite.png`):**
  - **There is no comet tail at all.**
  - The ball is wrapped in a crackling **white shell of jagged electric wisps with a lavender tint
    and a dark halo**. The wiki's `Electrocution_Cameroon.gif` is that very sprite. In play it is
    ≈ 3 ball widths across (≈ 100 world px).
  - **Two long jagged lightning bolts** reach the ball from **off-screen behind it**: one from the
    top-left corner, one from below the pitch. They are thin white cores in a violet-lavender glow,
    **500–700+ px long**, often longer than half the screen. They are re-drawn with new jags every
    frame and stay on the ball all the way into the goal.
  - The dark of the cut-in lifts during the flight as usual.
- **Defender (wiki):** "the opponent **turns blue and is surrounded in electricity** and is
  **stunned, unable to jump or move fast**". Power_Shots calls it the "Shocked" ailment: "slowing
  them down and rendering them unable to jump". *Uncertain:* its duration, and whether "stunned" means
  a short no-control daze before the slow.
- **Wiki behaviours:** a CPU is "very likely to deflect it". It is countered with a timed jump and
  kick. Jumping right in front of him before he fires puts the ball in his own goal. Coming close and
  jumping makes it "mostly bounce back into his own goal".
- **Sound:** *unknown* (no text, no footage).
- **Iconic because:** screen-spanning white-violet bolts are a completely different silhouette
  from Korea's comet, even at the same speed on the same path.

### 1.3 Nigeria — Tornado Shot (wiki GIF; not filmed)

- **Power fantasy:** a whirlwind unleashed along the grass that sweeps up whoever is in its way and
  throws him into the sky.
- **Release (`hs-3-nigeria-release.png`):** the frame after the cut-in, a **huge white vortex
  erupts from Nigeria himself**. The ball is at grass level in front of it one frame later.
- **Look (`hs-3-nigeria-flight.png`):**
  - A **horizontal corkscrew of translucent white wind ribbons lying on its side** along the pitch:
    6–8 crescent strokes, motion-blurred, with grey shading on their undersides. The stands show
    through it. There is no sand, no dust, no brown.
  - At its back it stands **≈ 200 world px tall (≈ 3.5 heads)**. It unrolls to **≈ 500 px long** and
    narrows forward to a smaller swirl streaming off the ball at its front.
  - It travels with the ball, a little slower, and **dissipates ≈ 0.4–0.5 s after the release**.
- **Ball:** near the grass at the front of the vortex, glowing and motion-smeared. The wiki says it
  "bounces up and down very quickly". **≈ 1420 px/s** off the GIF (33 GIF px a frame on a 640-px
  pitch), i.e. **≈ 0.66× the comet**.
- **Defender (`hs-3-nigeria-after.png`):** caught by the front of the vortex: red droplets burst, and
  he is **flung up and out of the top of the screen**. He is off-screen ≈ 1 s, **tumbling with gold
  stars circling him** from the catch onward, comes back down near his own goal and lands dazed. The
  wiki says "unconscious for 3 seconds" in all. The **ball drops loose**: it carries on a little,
  then hops slowly back toward midfield with motion streaks. No goal in the GIF (the score stays
  1–2).
- **Wiki behaviours:**
  - "Can be deflected easily when you watch for it." Counter it with a kick while staying on the
    ground; it is easy to counter "since they are right on the ground where the defender's foot is".
  - **"You can also get hit by the power shot when you jump!"**, i.e. it catches jumpers.
  - **Standing very close to Nigeria, the ball may fall behind him** for an own goal.
  - From on top of the other goal, "use your power shot and then you'll score".
- **Sound:** *unknown*. The page's audio block is just a "(Korean)" placeholder, which hints that the
  voice lines are Korean.
- **Iconic because:** it is the only one of the three that is not a ball-shaped effect. It is a big
  white **shape on the grass** that tells you instantly "stay on the ground and kick it". And the
  launch off the top of the screen is the biggest payoff of the three.

---

## 2. Our first 3 powers (as built today)

Shared by all three (and matching HS, §1): the silhouette arming glow and wisps (fx-kit
`drawArmedGlow`), the 1.5 s cut-in with the release 1.27 s in (`POWER_CUTIN`, `POWER_RELEASE`,
cutin.js's three ray layers and the head wind-up/whip), the release 2.5 head radii ahead at touch
height, the kick-block (0.8 s grind + 0.4 s dead, then it fires back), and the hit (red droplets,
knockback `HIT_KNOCK` 380 px/s, 0.5 s stars, a rebound at 0.84 × pace).

### 2.1 Stage 1 הילה כחולה (`shared/champion-powers/stage-01.js`, `public/vfx/powers/stage-01.js`)

- **Behaviour:** the straight family as filmed: 2150 px/s, dead flat, grind-blockable.
- **Look:** Korea's comet, painted per pixel into 3 shimmer frames: 560 × 230 world px, the white
  core 36 px ahead of the ball, cyan/blue body with a green-yellow seam, fine streak lines through
  the body and ragged ends. A soft additive bloom under it, 3 random cyan glints a frame, 4
  after-images after the first 0.2 s.
- **Sound:** the shared `powershot` (a 1400 Hz noise thud and a 110 → 38 Hz boom) plus the straight
  family's 1400 → 300 Hz sweep. No voice.
- **Intended read:** "the basic power shot: jump and kick it, or get knocked back".

### 2.2 Stage 2 ברק (`stage-02.js` ×2, the shock look in `public/vfx/ailments.js`)

- **Behaviour:** the straight family at **0.95×** (2040 px/s). A hit adds the **shock** ailment for
  **1.8 s** (half speed, no jump, no dash) on top of the 0.5 s stars.
- **Look:** an **electric-yellow comet** (a 430 × 124 streaked beam, yellow → orange edge, a white
  nose). Three forked **yellow** bolts whip back 150–300 px along it. The ball sits in a **130-px
  yellow glow sphere** with 6 yellow bolt crawlers, under a blue haze, and sheds 4 yellow sparks.
- **Shocked defender:** his head and body washed blue in their own outline, a blue aura, 4 blue-white
  bolts crawling over him at 20 Hz.
- **Sound:** exactly Korea's launch sound (same family), and a 6-blip 110/150 Hz sawtooth buzz for
  the shock.
- **Intended read:** "Korea's shot, electric; it leaves you slow and grounded".

### 2.3 Stage 3 טורנדו (`stage-03.js` ×2, the `twister` look in `ailments.js`)

- **Behaviour:** the ground family: a 0.05 s drop at 1200 px/s, then along the grass at **0.85×**
  (1830 px/s). The ball hops 12 px, 7 times a second. A funnel **150 px tall and 34 px either side
  of the ball** catches airborne players. A kick blocks it (grind). Anyone else is caught: thrown up
  at **480 px/s** (**≈ 190–236 px** up in the probe), `twister` for the flight, out for **3 s** in all.
  The ball pops loose forward (170 across, 460 up).
- **Look:** an **upright grey-sand funnel** 150 × 150 (an 8-frame flipbook, ≈ 3 turns a second)
  leaning back and swaying, dust boiling round its foot, a **sand dust wake** behind, a warm glow on
  the grass. It rides the ball for the ball's whole power life. The caught player spins **inside a
  small copy of the sand funnel**, and the stars come after he lands.
- **Sound:** the shared launch plus the ground family's 300 → 60 Hz sweep, and a 300 → 1400 Hz
  sawtooth rise for the twister.
- **Intended read:** "a tornado along the grass: stay down and kick it, don't jump it".

### 2.4 Inconsistencies inside our own set

1. **Stage 2's colour identity is split.** The ball, trail, sparks and UI colour (`color: '#ffe23a'`,
   and `AILMENTS.shock.color` `#ffe23a`) are yellow, but the ailment it inflicts is drawn **blue**.
   The shot says "yellow" and the victim says "blue".
2. **Stage 2's yellow is the cut-in's yellow.** It flies out of a gold sun in a gold comet, so the
   release is not the colour change that Korea's cyan and HS's white give. It reads as "more cut-in".
3. **Stages 1 and 2 sound identical at launch**, because the launch voice is picked per family and
   both are "straight".
4. **Stage 3's theme is dust and sand** (a sand palette, dust wake, foot dust), and the champion title
   is השף הבוער ("the burning chef"). Neither says "wind". The title clash is already flagged in
   `docs/HS-45-POWERS.md`.
5. **Stage 3's victim is shown in the power's own art** (a mini funnel), while stages 1 and 2 use the
   shared stars. HS uses the stars for all three.

---

## 3. Side by side

### 3.1 Per power

| | HS Korea | ours 1 | HS Cameroon | ours 2 | HS Nigeria | ours 3 |
|---|---|---|---|---|---|---|
| **path** | flat, no gravity | flat ✓ | flat | flat ✓ | along the grass, fast hops | along the grass, 12-px hops ✓ |
| **speed** | 2150 | 2150 ✓ | ≈ 2280 (±15 %) | 2040 (−10 %) | **≈ 1420 (±15 %)** | **1830 (+29 %)** |
| **silhouette** | cyan comet | cyan comet ✓ | **bolts from off-screen onto a crackling orb, no tail** | **yellow comet + short bolts** | **horizontal white corkscrew, ≈ 500 long, ≈ 200 tall at its back** | **upright sand funnel 150 × 150** |
| **colour** | white → cyan → deep blue | same ✓ | white core, lavender-violet glow | electric yellow/orange | translucent white, grey shade | grey-sand, dust brown |
| **effect life** | full 0.2 s → faint streak | same ✓ | bolts until it scores | trail on `cometAlpha`, bolts always | vortex gone ≈ 0.4–0.5 s after release; ball runs on | funnel for the whole power life |
| **particles** | a few sparkles, 4 after-images | 3 glints/frame, 4 after-images ✓ | none but the bolts | 4 yellow sparks, blue haze | none (no dust) | foot dust ring + dust wake |
| **hit** | droplets, knocked back, 0.5 s stars | same ✓ | + "turns blue, surrounded in electricity", no jump, slow | + blue wash & bolts, 1.8 s shock ✓ (colour right; duration unknown) | droplets, **flung out of the top of the screen**, tumbling with stars, ≈ 3 s | thrown **≈ 190 px** up, in a mini sand funnel, stars after landing, 3 s |
| **ball after hit** | bounces off at ≈ 1800 | 0.84 × pace ✓ | (not seen) | same as Korea | drops loose, hops back to midfield | pops loose forward ✓ |
| **block** | grind 0.8 + 0.4, fires back | same ✓ | (not seen) | same; the rebound **shocks the shooter** (HS unknown) | "counter with a kick on the ground" | grind ✓ |
| **jump in front of the shooter** | ball goes into **the shooter's** goal (wiki) | stars on the jumper, no own goal ✗ | same (wiki) | the jumper is hit, and **the shooter scores** ✗ | — | caught |
| **stand very close** | risk of being knocked into your goal (wiki) | conceded ✓ | — | conceded | **ball may fall behind Nigeria** (wiki) | caught ✗ |
| **catches jumpers** | no | no ✓ | no | no ✓ | yes | yes ✓ |
| **sound** | "Power Shot!" yell (wiki; not heard in M4) | synth whoosh, no voice | unknown | Korea's whoosh; shock buzz | unknown | low sweep; rising sawtooth |

The "jump in front" and "stand very close" rows come from `node _first3-probe.mjs`: the champion is at
x 700 and the defender 70–500 px away, standing, kicking, jumping late, or jumping during the cut-in.

### 3.2 As a set

| | HS | ours |
|---|---|---|
| shared press / cut-in / release / block / hit | one grammar | the same grammar ✓ (matched to the frame) |
| escalation | plain → + after-effect → new path + reach + launch | same ✓ |
| palette | cyan / white-lavender / white on a shared gold stage | cyan / **yellow** / **sand**: two of three break the "cool effect out of a gold sun" logic |
| silhouettes | comet / bolts converging on an orb / lying corkscrew: three distinct shapes | comet / comet / funnel: 1 and 2 share a shape |
| payoff size | small (knockback) → medium (shock) → big (off-screen launch) | small → medium → **medium** (a 190 px hop) |
| sound | a voice line per shot (wiki), unknown effects | no voice; 1 and 2 identical at launch |

---

## 4. Everything wrong or missing, by severity

**Major** = a player who knows HS would say "that isn't the power". **Medium** = it plays or reads
differently in a match. **Minor** = only visible side by side.

### Major

| id | power | category | mismatch | why it feels off |
|---|---|---|---|---|
| M1 | Nigeria | visual identity | Ours is an **upright sand funnel**; HS's is a **horizontal white corkscrew lying along the grass, ≈ 500 long and ≈ 200 tall** | It is the single most recognisable image of the power. Ours reads as "dust devil", HS's as "a wind gust rolling at you" |
| M2 | Nigeria | overall satisfaction / impact | Caught, ours rises **≈ 190 px**; HS's is **flung out of the top of the screen**, gone ≈ 1 s | The launch is the 1.5★ payoff and the escalation's peak. Ours lands before it registers |
| M3 | Cameroon | visual identity | **Yellow** where HS is **white core + lavender-violet glow** | It collides with the gold cut-in (§2.4 #2), splits from the blue shock (§2.4 #1), and is not HS's colour |
| M4 | Cameroon | VFX | Ours is a **comet with short bolts**; HS has **no tail**, just **two screen-spanning bolts from off-screen behind** converging on the ball | It turns Cameroon into a recoloured Korea, where HS gives it a whole different shape |

### Medium

| id | power | category | mismatch | why |
|---|---|---|---|---|
| D1 | Nigeria | movement feel | 1830 px/s vs HS ≈ 1420 (0.66×, ±15 %) | Ours arrives too fast to be the watch-it-and-kick-it shot the wiki describes ("easy to counter") |
| D2 | Nigeria | animation timing | Our funnel lives with the ball for its whole power life; HS's vortex **erupts at the shooter** and **dissipates in ≈ 0.4–0.5 s** while the ball runs on | HS's tornado is an eruption plus a loose-ish fast ball, not a travelling object |
| D3 | Nigeria | VFX | The victim spins **inside a mini sand funnel** and the stars come after landing; HS's **tumbles with gold stars circling from the catch** | Inconsistent with the set's shared hit language (§2.4 #5) |
| D4 | Cameroon | VFX | Our ball sits in a yellow glow with yellow crawlers; HS's is a **crackling white-lavender shell with a dark halo** (the wiki sprite), ≈ 3 ball widths | Size is right; colour and texture are not |
| D5 | Korea, Cameroon | gameplay | **Jumping right in front of the shooter doesn't send the ball into his own goal** (the probe: stars on the jumper; for Cameroon the shooter scores). The wiki gives it as the standard answer to both *(not filmed)* | It removes HS's main skill counter to the first two stages |
| D6 | Nigeria | gameplay | **Standing very close doesn't make the ball fall behind Nigeria**; ours catches you *(wiki, not filmed)* | It removes an HS counter-play |
| D7 | Korea, Cameroon | sound | **Same launch sound** for both (family voice) | A thunderbolt needs a crack; the two are indistinguishable with eyes closed |
| D8 | all | sound | **No voice line** ("Power Shot!", wiki) *(unverified: not audible in M4)* | HS's shot has a spoken cue at the release; ours is only synth |
| D9 | Cameroon | gameplay | A **blocked** Thunderbolt's rebound **shocks the shooter** *(HS unknown)* | It may be right, but it is an unverified extra rule; flag it rather than silently keep it |

### Minor

| id | power | category | mismatch |
|---|---|---|---|
| m1 | Korea | VFX | The white nose reaches 36 px ahead of the ball; HS's ≈ 30 (`docs/HS-POWER-SHOTS.md` §7) |
| m2 | Korea | VFX | Ours has crisper, more regular streak lines through the body; HS's is a softer volume with fewer wisps (`korea-comet-hs-vs-ours.png`) |
| m3 | Cameroon | movement feel | 0.95× (2040) vs ≈ 1.0–1.06× |
| m4 | Cameroon | VFX | 4 shed sparks and a blue haze that HS doesn't show |
| m5 | Nigeria | VFX | Foot dust ring, dust wake and a warm glow on the grass; HS has no dust at all |
| m6 | Nigeria | power readability | Ours is 34 px either side of the ball; HS's vortex body is far longer. *Uncertain:* whether HS's vortex tail catches anyone, or only its front (the GIF catch is at the front) |
| m7 | Nigeria | identity | The sand palette `#c9b48a`, and the title השף הבוער (known clash) |
| m8 | Cameroon | readability | `AILMENTS.shock.color` is yellow while the shock is drawn blue |
| m9 | Cameroon | unknown | The shock's 1.8 s: HS's duration isn't documented anywhere |

Verified as **matching HS** (keep): the press glow, the cut-in and wind-up, the release point and
timing, Korea's path, speed, colour and after-images, the flat path of Cameroon's shot, the grind
block, the red droplets, the knockback, the 0.5 s stars, Nigeria's catching of jumpers, the 3 s out,
and the loose ball after a catch.

---

## 5. Fix roadmap

### 5.1 Stage 1 — Blue Aura Shot (polish only)

- **Desired feel:** unchanged. It is already the filmed shot.
- **Visual / FX:** pull the white nose back to ≈ 30 px ahead of the ball (m1). Soften the streak
  lines in the body so it reads as one volume (m2), checking against `korea-comet-hs-vs-ours.png`.
- **Motion / timing:** none.
- **Gameplay:** add HS's **early jump-block**. A defender airborne in front of the shooter as the
  ball leaves, head in the path within ≈ 1 head of the release point, **heads it straight back** (a
  rebound off the head at comet pace toward the shooter's goal, and the shooter, standing behind it,
  isn't the target). Today he eats the stars. Build it on the shared straight family, so stage 2
  gets it too (D5). Verify from footage first (§6).
- **Sound:** its own launch (keep the whoosh) and, if HS's voice is confirmed, a shout cue (D8).
- **Keep:** everything else.
- **Remove:** nothing.

### 5.2 Stage 2 — Thunderbolt Shot (rebuild the look, keep the rules)

- **Desired feel:** Korea's speed and path, but **the sky strikes the ball**: a bright, jagged,
  violent flicker, then a blue, crippled victim.
- **Visual direction:** **white and lavender-violet only.** White bolt cores, a violet-lavender glow
  (≈ #b9a8ff to #e8e0ff), and a dark soft halo round the orb. No yellow, no orange (M3). Recolour
  `color` and `AILMENTS.shock.color` to the blue/violet family, so the UI, the shot and the victim say
  one thing (m8).
- **FX direction:**
  1. **Drop the comet beam entirely** (M4).
  2. **Two long bolts** from off-screen behind the ball, one from high behind (top corner side) and
     one from low behind (below the pitch). Jagged, thin white core, violet bloom, **re-jagged every
     frame** (HS re-draws them; our painted bolt flipbook re-picked at 30 Hz is the right technique).
     Their far ends stay pinned off-screen while the near ends follow the ball, so they swing as it
     crosses.
  3. **The orb:** a crackling white shell ≈ 3 ball widths (≈ 100 px) of short jagged wisps, dark
     halo outside it, re-picked per frame. Use `Electrocution_Cameroon.gif` as the shape reference,
     painted in our own fx-kit texture.
  4. Remove the shed sparks and the blue haze (m4).
- **Motion:** speed 0.95 → **1.0** (m3), inside the error, and it keeps it Korea's twin.
- **Timing:** the bolts stay on until it scores or ends (HS keeps them into the goal). The orb follows
  `cometAlpha` no more than Korea's core does.
- **Gameplay:** keep the shock (half speed, no jump, no dash) and the stars before it (the wiki's
  "stunned, unable to jump or move fast"). Keep 1.8 s unless footage says otherwise (m9). **Decide
  D9:** does a blocked Thunderbolt shock the shooter on the rebound? Default to HS's plain rebound
  (stars only) until footage shows otherwise. Gets the early jump-block from 5.1 (D5).
- **Sound (D7):** its own launch, a **sharp thunder crack** (a bright noise burst with a fast decay
  over a short low rumble) in place of Korea's sweep. Keep the shock buzz.
- **Keep:** the shock's blue wash and crawling bolts on the victim (it matches the wiki); the painted
  bolt technique; the Hebrew name ברק.
- **Remove:** the yellow beam, the yellow sphere, the yellow crawlers, the sparks, the haze.

### 5.3 Stage 3 — Tornado Shot (rebuild the look and the payoff)

- **Desired feel:** a **wind gust erupting from the shooter** and rolling along the grass. It is
  easy to read and easy to kick if you stay down, but get caught and you are **launched into the
  sky**.
- **Visual direction:** **translucent white wind**, grey shading on the undersides of the ribbons,
  the stands visible through it. No sand, no dust, no warm colour (M1, m5, m7).
- **FX direction:**
  1. Replace the upright funnel with a **horizontal corkscrew**: 6–8 crescent wind ribbons wound
     round an axis lying along the pitch just above the grass. ≈ 200 px tall at the back, tapering to
     ≈ 60–80 px at the ball, and **unrolling to ≈ 500 px long** behind the ball. A new ribbon set every
     2–3 frames (the same flipbook rate as HS's other effects), motion-blurred along the flight.
  2. It **erupts at the shooter** on the release frame, big and immediate (`hs-3-nigeria-release.png`).
  3. A **small swirl streaming off the ball** at the front.
  4. Remove the foot dust ring, the dust wake and the warm grass glow.
- **Motion:** the vortex travels a little slower than the ball and **dissipates ≈ 0.4–0.5 s after
  the release** (D2). The ball keeps running along the grass, hopping fast, glowing, with after-images.
- **Timing:** ball speed 0.85 → **≈ 0.66–0.7×** (≈ 1420–1500 px/s) (D1). Measure properly before
  committing (§6).
- **Gameplay:**
  - **The launch (M2):** thrown up hard enough to **leave the top of the screen**. That is ≥ ≈ 500 px
    above the grass; the Grab's `thrown` already does exactly this (1850 px/s at 5× gravity). Off for
    ≈ 1 s, back down near his own goal, stars, 3 s out in all, as today.
  - **Catch area:** keep catching jumpers (the wiki says so explicitly). While the vortex is alive,
    consider its front ≈ 80 px as the catch zone (m6, *uncertain*).
  - **Close-range miss (D6):** a defender standing within ≈ 1 head of Nigeria at the release isn't
    caught: the ball drops behind the shooter (toward the shooter's own goal). Verify first.
  - Keep: the kick-block, the loose ball after a catch.
- **The victim's look (D3):** drop the mini sand funnel. Use the **shared tumble + gold stars from the
  moment of the catch**, plus red droplets at the catch, as HS does.
- **Sound:** a **wind roar** (band-passed noise swelling over ≈ 0.4 s with the vortex, then a hiss
  with the ball) in place of the 300 → 60 Hz sweep. A whoosh up for the launch.
- **Keep:** the ground path, the hops, the jumper catch, 3 s out, the block, the loose ball, the name
  טורנדו.
- **Remove:** the sand funnel, the dust, the sand palette, the mini funnel on the victim.

### 5.4 Priority order

| # | fix | ids | why this order |
|---|---|---|---|
| 1 | Nigeria's horizontal white vortex (erupt → dissipate) | M1, D2, m5, m7 | the biggest identity gap |
| 2 | Nigeria's off-screen launch + shared tumbling stars | M2, D3 | the biggest payoff gap; the sim already has `thrown` |
| 3 | Cameroon's white-violet lightning: no comet, off-screen bolts, crackling orb | M3, M4, D4, m4, m8 | a whole shape and colour change |
| 4 | Nigeria at ≈ 0.66–0.7× | D1 | one number, but measure first |
| 5 | Per-power launch sounds (thunder crack, wind roar) | D7 | cheap, and it separates 1 from 2 |
| 6 | Wiki counter-plays: the early jump-block (1, 2), the close-range miss (3), the rebound rule (2) | D5, D6, D9 | rule changes; each needs footage first |
| 7 | Korea polish; Cameroon at 1.0× | m1, m2, m3 | small |
| 8 | The voice line | D8 | needs HS audio to confirm, and a voice decision (Hebrew? Saltiz's own?) |

---

## 6. Final recommendation

1. **Build 1–5 now.** They rest on clear visual evidence (three wiki GIFs and a sprite) and change
   the look, sound and one speed, not HS's rules. They also fix our own set's inconsistencies (§2.4).
2. **Record before building 6 and 8.** One session in HS against Cameroon and Nigeria on the iPhone
   at 60 fps, the same way as M1–M6:
   - let each shot hit you standing;
   - block each with a kick;
   - jump in front of the shooter as he fires;
   - stand right next to Nigeria as he fires;
   - have the sound on.

   That settles every *uncertain* line in this document: speeds to ±2 %, the shock's look and
   duration, what the rebound carries, the close-range rules, and the voice. The 4K 60 fps YouTube
   compilation of every power being blocked (https://www.youtube.com/watch?v=CyWnjdQrDrc) is the
   fallback if a recording session isn't possible.
3. **Keep our identity where HS's is only a skin.** Our art stays our own canvas painting (no HS
   sprites), with the Saltiz characters and faces, the Hebrew names and titles, and the painted
   fx-kit technique. What should match HS exactly is the **shape, colour family, size, timing and
   rules** of each power, because those are what a player recognises.

---

## 7. What was built (2026-09-30)

Side by side, HS on top and ours below: `.shots/first3/after/`. Re-film them with
`AX=920 ZX=160 BG=hs-arena node _powers-hq.mjs video 1 2 3`, the M4 43.07 s staging (the shooter by his own goal).

| power | change | ids |
|---|---|---|
| Korea | Re-read at 60 fps and full resolution (M4 43.05–43.40 s), then repainted. The ball sits at a slim tip (±30 px), and the comet fattens backward to 80 px up and 43 px down, ≈ 460 long. It has a long soft white core, a diffuse yellow-green seam, and wisps only at the back. Seven baked phases play its death: full to 0.12 s, then it dissolves from the back while the core shrinks, becomes a green-yellow band by 0.30 s, and is gone at 0.38 s. Ghost balls are stamped every 110 px along the path. A blocked shot fires back with a fresh comet | m1, m2, and the animation |
| Cameroon | No comet. Two long bolts come from off the screen behind the ball (high behind, and low behind trailing 330 px), white core in a violet-lavender glow, re-jagged every frame. The ball sits inside a crackling white-lavender shell with a dark halo, with a veil of the shell over the ball itself. No yellow anywhere; the UI and ailment colours are violet and blue. It flies at 1.0× (was 0.95). A blocked Thunderbolt fires back plain, without the shock. The release makes a thunder crack | M3, M4, D4, D7, D9, m3, m4, m8 |
| Nigeria | A white wind corkscrew lying on the grass: fat overlapping ribbons, smeared, grey undersides. It erupts from Nigeria, the ball runs out of its front, and it is gone by 0.48 s, leaving a small swirl on the ball. No sand and no dust. The ball runs at 0.68× (was 0.85). A catch flings the defender out of the top of the screen at 5× gravity, ≈ 1.25 s in the air, with gold stars from the catch through landing, 3 s out in all. A defender standing right beside Nigeria as it leaves sends the ball back behind him. The release makes a wind roar | M1, M2, D1, D2, D3, D6, m5, m7 |
| Korea + Cameroon | The early header: a player in the air within 170 px of where the shot leaves sends it back off him over the shooter into the shooter's goal, with no daze (`HS.EARLY_HEADER`) | D5 |

Still open: the voice line (D8, Idan: none for now), and m6 (does HS's vortex tail catch anyone?).
Every number that came from a GIF (Nigeria's 0.68×, the shock's 1.8 s, the counter-play distances)
should be re-checked against a real recording (§6).
