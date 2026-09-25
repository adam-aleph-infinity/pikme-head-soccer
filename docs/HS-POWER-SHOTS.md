# Head Soccer power shots — what the footage shows

Notes from frame-by-frame study of our own recordings of the real game (`hs-video/`, not in git).
Every number below was read off frames; the timestamps are video seconds. Positions are fractions
of the pitch wall-to-wall (M4's walls sit at x 107 and 1172 on the 1280-wide frames, which is our
1060-px world at scale 0.995), so "0.14 of the pitch" ≈ 150 px in our world.

Sources: M4-gaps (60 fps, 2556×1180) cut-ins at 40.40, 41.93, 60.16, 78.36, 122.89, 150.59 and 171.91 s;
M3-airdrop-full at 37.2 s and 71.5 s (the CPU's counter at 72.8 s); M2-arcade-kor-uk (848×384) cut-ins at
~41.8, 50, 63, 71, 80, 94 and 102 s; M1 for a cross-check. Each was pulled as a 3–5 s contact sheet at
4 fps, then 10–20 fps crops at full resolution around the press, the release, the hit and the goal.

Our art never copies HS: these notes describe shapes, timing and behaviour; every sprite in the game is
our own canvas drawing.

## 1. The press: arming aura (M4 36.49 s, also 39.95–40.20 s, 122.4 s, 150.1 s)

- **Instant.** The frame after POWER is pressed the player is outlined; no build-up, no burst, no ring.
- **Look:** a thin bright yellow-white rim hugging the whole silhouette (head and body), plus 2–4 jagged
  electric "flame tongues" rising off the crown and shoulders, about half a head tall. They are redrawn
  every frame (random flicker), so the outline crackles rather than pulses.
- **Stays until the shot fires.** M4 36.49 → 41.9 s the glow held for 5.4 s with no touch; the arm never
  expires (`power.armHold` in `hs-estimates.json`).
- The aura does not touch the other player in M4 (the starter character's aura is `none`). Characters
  whose press does something (push, stun, freeze, reverse) are not in our footage: those are from the
  approved champion map and use the same outline plus a ring on the press.

## 2. The cut-in (all 14 cut-ins; 1.34 s, `power.cutinTime`)

Frame by frame at 15 fps, M4 40.22–41.70 s:

| t from touch | what is on screen |
|---|---|
| 0 | the armed head meets the ball; the rim glow goes out on contact |
| +0.07 s | the stadium begins to darken; a white-hot disc appears behind the shooter's head |
| +0.13 s | full effect: backdrop ~55–60% darker (and softened), a **white core disc ≈ 1.4 head radii** with a **gold halo**, and **8 long gold rays alternating with 8 thin white ones**, each ~⅓ of the screen long, widest at the far end |
| +0.2 → +0.9 s | the rays **rotate slowly** (≈ 0.5 rad/s) and flicker in length; the darkening deepens a little; the ball hangs just above and in front of the head |
| +0.97 s | the ball is released (41.41 s; 42.95 s for the 41.97 cut-in); rays and disc go within 0.1 s; the comet flies bright across the still-dark pitch |
| +1.34 s | the dark lifts over ~0.25 s — whatever the shot met: it does **not** lift early on a hit, a block or a goal (review, below) |

**Review (luma traces of the stands band, 60 fps, `dark.mjs`-style half-level crossings).** The dark
fades in over ≈ 0.25 s and out over ≈ 0.25 s. Half-dark to half-lifted: M4 40.40 1.315 s, 60.17
1.315 s, 78.38 1.313 s, 122.87 1.365 s, 150.58 1.347 s, 171.93 1.315 s, M3 37.16 1.332 s — mean 1.33 s,
the same whether the shot was countered, blocked, hit someone or scored (M3 37.2 hits the keeper at
38.25 s and the dark still runs to 38.49 s; M4 150.59 scores at 151.85 s and it runs to 151.93 s).
The ball leaves **1.01–1.10 s after half-dark** (M4 40.40 → 41.41, 60.17 → 61.27, 122.87 → 123.97 s)
and the dark is half-lifted **0.22–0.31 s after it leaves** (41.72, 61.49, 124.24 s). The "+0.97 s"
above was measured from the half-dark point, not the touch. So ours: the sim's cut-in is 1.34 s from
the touch with the release 1.14 s in (`POWER_RELEASE` 0.2 s); the picture fades in over the first 0.2 s
and out over 0.2 s after the sim's cut-in ends, which puts the release 1.04 s after half-dark and the
lift 0.3 s after the release. The backdrop keeps ≈ 32 % of its brightness (M4 60.8 s stands: luma
106 → 36, 123 → 39) with no pool of light round the shooter beyond the disc — ours 0.76–0.8 black.

- **No text, no banner, no name, no zoom.** The camera does not move; the shooter stays where they were
  (mid-air if they jumped) and switches to a wind-up pose (head turned up, profile).
- Both players and the ball are frozen for the first 0.97 s; the last 0.37 s is played under the dark
  (the defender's block at M4 61.45 s is a kick pressed while it is still dark).
- A counter gets its own full cut-in (M4 41.93 s, M3 72.8 s).

## 3. The shot itself

### Straight comet — the starter character (M4, M1: 11 of 14 cut-ins)

- **Speed ≈ 2150 px/s.** Ball x per 1/15 s at M4 41.50 → 41.77 s: 0.62, 0.48, 0.34, 0.21 of the pitch; at
  43.07 → 43.33 s: 0.33, 0.46, 0.60, 0.73, 0.87. That is 0.135 of the pitch per frame = 2.03 pitch widths per
  second. A shot crosses the whole pitch in about half a second — **2.6× our hardest kick**.
- **Dead flat, no gravity.** The ball's height is the same (±2% of the frame) from release to the defender:
  it leaves at the height the shooter touched it and flies level at the goal.
- **Look:** the ball is a white-hot core with a **long tapering cyan-blue energy tail** about 5–6 ball
  diameters long (a quarter of the screen at release), bright white nearest the ball. After ~0.2 s the
  tail thins to a fainter cyan streak with sparkles trailing off it.

### Aerial (flaming meteor) — M2's CPU (England), 41.8–44.5 s

- It is the UK's "Hawk-Eye Shot" (wiki: "shoots a total of 11 red laser-arrows vertically in the
  air, and then they come" back diagonally at the goal; the first ten carry no ball, the 11th does).
  Filmed twice: M2 41.8–44.5 s and 95.8–97.9 s (clock 0:07–0:06, that one scores).
- At the end of the cut-in **red laser lances shoot straight up** off the shooter — two at a time, a
  head's width apart (M2 42.65, 42.75, 96.35 s) — and the ball leaves the top of the screen.
- For ~1.0 s (43.05–44.2 s) **ten red lances rain down diagonally** at ≈ 30–35° toward the defending
  goal, one about every 0.1 s, two or three on screen at once on parallel lines, fast (≈ 2500 px/s).
  Each is a pointed spear ≈ 300 px long (≈ 180–220 px of the 848-wide frame, 1.5 world px a frame px):
  a hot yellow-white core ≈ 7 px, a red body ≈ 18 px, a red glow ≈ 36 px, fading to the back. They end
  on the wall over the goal and in its mouth (M2 43.55, 43.8, 44.05, 97.2–97.65 s full-res).
- Then the ball dives as the **11th, a meteor in a yellow-orange fire tail** ≈ 300 px long and ≈ 55 px
  thick (yellow core, orange flame, red edge), the last lances still beside it, at ≈ 2150 px/s and
  ≈ 35–40° (ball per 1/20 s at M2 44.35 → 44.50 s: (205,105) → (145,145) → (90,190) → (60,225) frame
  px) into the mouth of the goal. It hits the keeper standing in the mouth and bounces; here the
  armed keeper got to it and M2's player scored the rebound.

### Grab (dark claw) — M3's CPU (Mexico), counter at 72.8 s, flight 73.9–74.3 s

- The ball is carried by a **giant dark-navy hand** on a long thick arm reaching out of the shooter
  (M3 73.88–74.02 s, full-res crops, 1 world px a frame px): ≈ 300 px from the fingertips back to the
  ball and ≈ 200 px tall — a third of the screen's height — four thick arched fingers (≈ 35 px across)
  fanned forward and up at ≈ 20–70°, a thumb down, lighter blue rims, soft motion-blurred edges; the
  ball at the heel of the palm, at head height. It flies at the comet's pace (ball 487 → 347 px in
  1/15 s at 73.95 → 74.02 s ≈ 2100 px/s).
- On reaching the other player the hand **closes into a fist round his body** (74.08–74.15 s), three
  **gold stars** over his head, and the ball pops loose, up and on toward his goal. The fist then
  **drags him back to the shooter** — away from his own goal — at ≈ 2400 px/s (x 200 → 300 → 460 →
  600 px at 74.08, 74.15, 74.22, 74.30 s) and lets go just in front of him (wiki, Grab shots: they
  "pull the defender back once it hits them … give you a lot of time … to score in a chance for open
  goal"; Mexico: "grabs the opponent and brings him to Mexico").
- He is flung **straight up out of the top of the screen** (74.3–74.6 s), is off it until ≈ 75.0 s,
  and comes back down spinning inside a **blue whirlwind of rings** (75.0–75.5 s), dazed with stars
  on landing (to ≈ 75.9 s) — ≈ 2 s without control in all (wiki: "immobilized ~2s").

## 4. What happens to the defender

Three different outcomes, depending on what the defender is doing when the ball arrives:

| defender | seen at | what happens |
|---|---|---|
| **armed** — touches it | M4 41.77 s, M3 72.75 s | **counter**: their own cut-in, and the ball flies back as *their* power shot (M4: scored at 43.68 s) |
| **kicking** into it (Kick lit) | M4 61.45 s, 79.55 s, 171.9 s | **block**: a crackling **yellow-white spark burst** at the contact point; the ball **grinds** against the boot for **≈ 0.8 s** (61.45–62.25, 79.55–80.25) while the defender is pushed back a few pixels; the ball then sits **dead at the defender's feet ≈ 0.4 s** (62.35–62.7, 80.35–80.7); then it **fires back as a power shot** — full comet tail, no cut-in — at the shooter's side (62.75 s, 80.75 s), about **1.2–1.3 s** after contact |
| **not kicking** | M4 43.33 s, M3 38.25 s, M2 103.8 s | **hit**: **red spark droplets** burst at the impact, the head **snaps back** (~60°, face up) and the defender is knocked back; the ball **bounces off him** keeping most of its pace — grazing the crown it carries on into the goal behind (M4 43.30–43.40 s), square on it flies straight back (M3 38.25–38.45 s, ≈ 1800 px/s); 4–5 faded after-images trail the ball |

- The block's rebound, when it reaches the original shooter, **hits** him the same way: red splash at
  62.85 s; at 80.85 s **three gold stars spin over his head** and he is carried into his goal (GOAL, M4
  80.9 s). Dazed ≈ 0.5 s (`power.blockStun`).
- **Stars** are the daze's look: three gold five-point stars orbiting a flat ellipse above the head.

## 5. How each one ended

| cut-in | shooter | shot | end |
|---|---|---|---|
| M4 40.40 | CPU | straight comet | countered by the armed player at 41.77 → counter shot hits the CPU in the air → **goal** 43.68 |
| M4 41.93 | player (counter) | straight comet | hits the airborne CPU, carried into the goal → **goal** |
| M4 60.16 | CPU | straight comet | **blocked** by a kick 61.45, grind, rebound 62.75 hits the CPU (red splash), cleared |
| M4 78.36 | CPU | straight comet | **blocked** 79.55, rebound 80.75 hits the CPU (stars) → carried in → **goal** for the player |
| M4 122.89 | CPU | straight comet | straight in → **goal** 124.4 |
| M4 150.59 | CPU | straight comet | straight in → **goal** |
| M4 171.91 | CPU | straight comet | **blocked**, rebound, player scores at 173.8 |
| M3 37.2 | player | straight comet | hits the standing Mexico keeper square on (38.25), bounces straight back up-field |
| M3 71.5 | player | straight comet | countered by the CPU at 72.75 (claw) → CPU's grab dazes the player, ball cleared |
| M2 41.8 (clock 0:43) | CPU | aerial meteor | lands in front of the keeper; rebound scored by the player |
| M2 102.2 (clock 0:05) | player | straight comet | hits the UK player (103.8), bounces back; player clears |

## 6. What we took into the game

| rule | number | source |
|---|---|---|
| arming aura | electric rim + flicker, instant, never expires | §1 |
| cut-in | 1.34 s of dark (fixed), release 1.14 s in, no text, backdrop to ≈ 32 %, white disc 1.8 r + thin gold ring 3.6 r, 8+8 rotating rays ≈ 235 px | §2 |
| straight speed | `POWER_SHOT_SPEED` 2150 px/s, flat | §3 |
| aerial | two red lances up, ten lances raining at 32° for ~1.0 s, the ball the 11th in a fire tail | §3 |
| grab | a giant hand seizes him, drags him back to the shooter, flings him up out of the screen; the ball pops loose | §3 |
| counter | armed touch → own shot + own cut-in | §4 |
| block | kick into it → 0.8 s grind + 0.4 s dead → fires back as the blocker's shot | §4 |
| hit | unarmed, not kicking → knocked back and dazed 0.5 s (stars); the ball bounces off him | §4 |

The other families (Ground, Downward, Destructive, Delay, Multi-Ball, Up-and-Down, Ailment, Critical)
and the ailments (reverse `???`, shock, freeze, beheaded, burn) are not in our footage. They follow the
approved champion map (`docs/HS-CHAMPION-MAP.md`) and the HS wiki's family descriptions, flown at the
measured comet speed scaled per family, and are marked `estimated` in `shared/hs-powers.js`.

## 7. Our picture, element by element → the frame that justifies it

Idan's rule: nothing is drawn that the footage does not show. Every visual element in
`public/champ-vfx.js`, `public/vfx/families.js` and `public/vfx/ailments.js`:

| our element | HS evidence |
|---|---|
| armed: thin bright rim round head and body (static drop-shadow + stroke) | M4 36.49–36.60 s (§1) |
| armed: 2–4 jagged gold/white tongues off crown and shoulders, re-rolled each frame | M4 36.55–36.90 s |
| cut-in: 1.34 s of dark from the touch, fading in over 0.2 s and out over 0.2 s after it; the backdrop to ≈ 22 % black-over (keeps ≈ 32 %), no pool of light beyond the disc | 7 luma traces (§2 review), M4 60.8 s stands luma 106 → 36 |
| cut-in: solid white disc ≈ 1.8 head radii, a gold glow round it, a thin gold ring at ≈ 3.6 radii | M4 40.75 s full-res (disc Ø 195, ring Ø 385 px at 2 px a world px) |
| cut-in: 8 wide soft gold rays (≈ 235 px, ≈ 45 px across at the tip, still visible there) + 8 thin hot yellow-white ones, turning slowly, flickering length | M4 40.6, 40.75, 41.2 s, M3 73.75 s |
| cut-in: no text, no band, no zoom | all 14 cut-ins |
| cut-in: rays + disc gone 0.1 s after the ball leaves, dark stays to 1.34 s | M4 41.50 → 41.57 s |
| ball leaves 1.14 s after the touch (1.04 s after half-dark) and flies under the last of the dark | M4 40.40 → 41.41, 60.17 → 61.27, 122.87 → 123.97 s (§2 review) |
| the dark never lifts early (no lift on impact or goal) | M3 38.25 hit / 38.49 lift, M4 151.85 goal / 151.93 lift |
| the comet, the block's burst, the Grab's fist, the lances and the droplets are painted OVER the dark | M4 43.07 s, 61.5 s |
| comet: the plain ball at the nose; white-hot core ≈ 70 px tall, soft-edged, with a green-yellow seam; cyan body fanning OUT to ≈ 130 px tall ≈ 130 px behind the ball, thinning to streaks ≈ 330 px back; nose only ≈ 30 px ahead of the ball | M4 43.07 s full-res (re-measured) |
| comet: full while dark, faint streak 0.1 s after | M4 43.24 s |
| comet: 4 faded after-images of the ball | M4 43.24 s, 43.33–43.45 s |
| Aerial: two red laser lances straight up off the shooter | M2 42.65, 42.75, 96.35 s |
| Aerial: ten pointed red lances (yellow-white core, red body, red glow, ≈ 300 px) raining at 32°, one every 0.1 s, on parallel lines ending on the wall over the goal and in its mouth | M2 43.05–44.3 s, 97.2–97.65 s; wiki United_Kingdom "11 red laser-arrows" |
| Aerial: the dive, the ball in a yellow-orange fire tail, the last lances beside it | M2 44.3–44.5 s |
| Grab: a giant dark-navy hand on a thick arm out of the shooter, four arched fingers up and forward, thumb down, light rims, motion blur; ball at the heel of the palm; no comet | M3 73.88–74.02 s full-res |
| Grab: the fist round the seized player's body, its arm back to the shooter, dragging him there | M3 74.08–74.30 s |
| Grab: thrown — flung up out of the screen, back down in a blue whirlwind of rings, stars | M3 74.3–75.9 s |
| block: a glowing yellow-white orb round the ball with thin yellow sparks crackling out, for the whole grind, no comet | M4 61.45–62.25 s, 79.55–80.25 s |
| hit: red spark droplets (7, the only particles) | M4 43.33 s |
| hit: after-images following the bounced ball | M4 43.33–43.6 s |
| daze: three gold stars on a flat orbit over the crown | M4 80.85 s, M3 74.1 s |
| other families' colours (Ground brown, Downward violet, Destructive red, Delay indigo, Multi gold, Up-and-Down green, Ailment magenta, Critical red-white) | **not filmed** — the filmed comet on the family's path (§9), recoloured only so two shots can be told apart |
| freeze = a snowman; shock = a blue wash + sparks; reverse `???`; burn flames; beheaded a missing head | **not filmed** — the wiki's descriptions (§9) |


Removed because no frame shows them: the old super cut-in band with name and icon, screen shake,
flashes, colour grades, the stage dim, comic words, confetti, power banners ("נחסם!", "קאונטר!",
"… מוכן!"), per-power particle bursts, the pulsing armed glow.

## 8. Measured numbers, HS against ours

| quantity | HS (footage) | ours |
|---|---|---|
| straight speed | 0.135 pitch / (1/15 s) = 2.03 pitch/s ≈ 2150 px/s (M4 41.50–41.77, 43.07–43.33 s) | 2150 px/s at intensity 0.5 (`POWER_SHOT_SPEED`; 0.85–1.15× by champion intensity) |
| straight path | level ±2 % of frame height, release → defender | dead flat, vy = 0 |
| comet core | ≈ 70 px tall, ≈ 150 px of full white, ≈ 230 px to its tip | 60 → 72 px, 230 px long, soft-edged |
| comet body | ≈ 70 px tall at the ball, ≈ 130 px at its widest ≈ 130 px back, ≈ 330 px long | 72 → 128 px at 0.4 of 330 px → 32 px |
| comet full / faint | full through 43.13 s (0.2 s), faint by 43.24 s | full 0.2 s, fades over 0.1 s to 20 % |
| cut-in (dark, half to half) | 1.33 s (1.31–1.37, n = 7), never shortened | 1.34 s from the touch (parity: 1.35) |
| release | 1.01–1.10 s after half-dark; half-lifted 0.22–0.31 s after | 1.14 s after the touch = 1.04 after half-dark; half-lifted 0.3 s after |
| cut-in darkness | backdrop keeps ≈ 32 % (luma) | 0.76–0.8 black (measured ≈ 34–45 % kept on our strip) |
| cut-in rays | 8 gold + 8 white, ≈ 230 px from the head (M4 40.75 s full-res) | 16 rays, 235 px (white 0.9×) |
| cut-in disc | white Ø ≈ 3.6 head r, thin gold ring Ø ≈ 7.2 r | white to 1.8 r + glow to 2.5 r, ring at 3.6 r |
| arm | instant, never expires (≥ 5.4 s) | instant flag (parity armHold ok) |
| block | 0.8 s grind + 0.4 s dead, fires back ≈ 1.2–1.3 s after contact | 0.8 + 0.4 s (`HS.BLOCK_GRIND`, `BLOCK_REST`) |
| block burst | orb r ≈ 30 px, sparks ≈ 50–100 px | orb r 34, 7 sparks 48–100 px |
| block daze | ≈ 0.5 s | 0.5 s (parity blockStun 0.517) |
| hit bounce | ≈ 1800 of 2150 px/s back off the body (M3 38.30–38.45 s) | 0.84 × pace (`POWER_BLOCK_REBOUND`) |
| Aerial | lances up ≈ 0.3 s, ≈ 1.0 s of 10 lances at 30–35°, dive ≈ 2150 px/s at 35–40° | 1600 px/s up, 1.0 s wait (0.85–1.15 by intensity), 10 lances at 32° / 2600 px/s / 300 px, dive at 40° |
| Grab flight | ≈ 2100 px/s (M3 73.95–74.02 s) | 2150 px/s (speed 1.0; was 0.8) |
| Grab hand | ≈ 300 × 200 px, fingers ≈ 35 px thick | ≈ 290 × 210 px (0.88 × the drawn model), fingers 34–40 px |
| Grab drag | back to the shooter at ≈ 2400 px/s, ≈ 0.22 s | `HS.GRAB_PULL` 2400 px/s to 2 head radii in front of him |
| Grab throw | up off the screen and back ≈ 1.2 s, dazed to ≈ 75.9 s | 1850 px/s up at 5× gravity = 1.24 s (`thrown`), then 0.45 s of stars |
| counter | armed touch → own cut-in, own shot | same (parity armedCounter ok) |

Side-by-side strips, HS frames on top and ours below, press → cut-in → flight → impact → after, for
all 12 moments: `node _hs-compare.mjs` → `.shots/compare/<id>.png`, and every pair stacked in
`.shots/compare/ALL.png`.

## 9. The families we never filmed — what the wiki says, and what ours does

Sources: the Head Soccer wiki — [Power Shots](https://headsoccer.wiki.gg/wiki/Power_Shots) (the family
descriptions) and the character pages [Japan](https://headsoccer.wiki.gg/wiki/Japan),
[Germany](https://headsoccer.wiki.gg/wiki/Germany), [Spain](https://headsoccer.wiki.gg/wiki/Spain),
[Cameroon](https://headsoccer.wiki.gg/wiki/Cameroon), [Switzerland](https://headsoccer.wiki.gg/wiki/Switzerland),
[Saudi Arabia](https://headsoccer.wiki.gg/wiki/Saudi_Arabia), [Mexico](https://headsoccer.wiki.gg/wiki/Mexico),
[United Kingdom](https://headsoccer.wiki.gg/wiki/United_Kingdom), [Italy](https://headsoccer.wiki.gg/wiki/Italy),
[Nigeria](https://headsoccer.wiki.gg/wiki/Nigeria), [Brazil](https://headsoccer.wiki.gg/wiki/Brazil),
[Greece](https://headsoccer.wiki.gg/wiki/Greece), [Argentina](https://headsoccer.wiki.gg/wiki/Argentina),
[Netherlands](https://headsoccer.wiki.gg/wiki/Netherlands), [Devil](https://headsoccer.wiki.gg/wiki/Devil),
[Belgium](https://headsoccer.wiki.gg/wiki/Belgium), [Honduras](https://headsoccer.wiki.gg/wiki/Honduras)
(read 2026-09-25). There is no Ailments or Critical page; both live on Power Shots.

| family | the wiki | ours |
|---|---|---|
| Ground | "shots that go on the ground such as Italy's and Nigeria's … Most of them cannot be deflected … if they don't counter it then it is almost for sure a goal"; Italy's big ball "rolls along the ground … drags the opponent with it into the goal" | drops to the turf and rolls; a kick does not stop it, it trips whoever it meets and rolls on; only a counter answers it (unchanged — consistent) |
| Downward | "start above the character and shoot downward" (Brazil, Chile, Canada); Brazil's firebird "goes up at about a 15 degree angle, then shoots downwards towards the opponent's goal" | **changed**: up at 15° (was a steep 55° hop) for ≤ 0.16 s, then a straight line down into the foot of the goal; down at once inside 260 px of the goal |
| Destructive | "deal heavy damage to the defender … making it harder to jump up and deflect" (Greece, UK) | slower heavy shot that smashes a kick-block aside (unchanged — consistent) |
| Aerial | "start from the top of the screen such as the United Kingdom's shot and Spain's" | filmed — §3 |
| Delay | "either move slowly or don't shoot right away such as Argentina and the Netherlands … a lot of people will jump early" | flies a beat, hangs dead and untouchable 0.35–0.8 s, bursts on (unchanged — consistent) |
| Grab | "pull the defender back once it hits them such as Mexico's … time while the defender is being pulled back to … score in a chance for open goal … won't go directly into the goal" | filmed — §3; **changed** to pull him back to the shooter (it used to carry him toward his own goal) |
| Multi-Ball | "shoot multiple balls all of which are capable of scoring … can't be blocked by a Power Shot"; Germany "3 homing balls", Spain "three balls towards the goal. Only one of them is needed" | **changed**: always three balls (was two below intensity 0.9), every one a power ball that can score, one touch knocks each dead, so all three must be stopped; the gentle first tier keeps two. (Japan's Ninja Shot — five streaks, one real — is a single character's shot, not the family) |
| Up-and-Down | "go up and down as the character shoots them. Devil and Belgium" | the literal sine-table wave (unchanged — consistent) |
| Ailment | Cameroon "Shocked … slowing them down and rendering them unable to jump", "turns blue and is surrounded in electricity"; Honduras "Beheaded … unable to do anything for a moment"; Switzerland "turned into a snowman" | shock: half speed, no jump, no dash, **now drawn** as a blue wash + sparks; beheaded: **now also no control**, 1.5 s base (was 3 s, head gone only); freeze: **now drawn** as a snowman (was an ice block); reverse `???`, burn flames (no wiki text for those) |
| Critical | "a chance to be triggered … signaled by a cutscene … making them last longer, and inflicting an ailment on the opponent in the end" | the approved champion map's Critical (fastest, through a block); the wiki's random trigger is not modelled — noted, not changed |

Not modelled on purpose (one character's shot, not a family): the UK lances' own hits on the
defender ("block jumping/dashing"), Germany's shrink, Japan's decoys and log, Saudi Arabia's oil
barrels, Greece's field items, Switzerland's yeti.

