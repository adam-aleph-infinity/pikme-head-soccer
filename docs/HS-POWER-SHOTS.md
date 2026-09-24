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
| +0.2 → +1.2 s | the rays **rotate slowly** (≈ 0.5 rad/s) and flicker in length; the darkening deepens a little; the ball hangs just above and in front of the head |
| +1.27 s | the ball is released while the screen is still dark |
| +1.34 s | the dark lifts over ~0.1 s, with the shot already in flight |

- **No text, no banner, no name, no zoom.** The camera does not move; the shooter stays where they were
  (mid-air if they jumped) and switches to a wind-up pose (head turned up, profile).
- Both players and the ball are frozen for the whole 1.34 s (already in the sim as `POWER_CUTIN`).
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

- During the cut-in the ball is flicked **straight up** in an orange flame column and leaves the top of
  the screen (M2 42.7 s).
- For ~1.0 s (43.2–44.2 s) nothing but **thin red warning streaks** slide down diagonally from the top
  corner toward the defending goal: the ball is coming back.
- Then the ball dives out of the sky at ~30° below horizontal as a **meteor with a big orange fire tail**,
  in about 0.25 s, straight at the mouth of the goal (M2 44.25–44.5 s). It lands in front of the keeper and
  bounces; here the armed keeper got to it and M2's player scored the rebound.

### Grab (dark claw) — M3's CPU (Mexico), counter at 72.8 s, flight 73.9–74.3 s

- The ball is carried by a **giant dark-blue ghostly hand** (fingers spread, blue speed streaks behind it)
  at head height, at roughly the comet's speed.
- On reaching the other player the hand **seizes him**: three **gold stars** appear over his head, a puff of
  dark smoke at his feet, and the ball pops away up-field. The seized player is then flung high into the
  air (74.3–74.7 s) and comes back down spinning inside a **blue whirlwind of rings** (75.1–75.7 s), dazed
  on landing.

## 4. What happens to the defender

Three different outcomes, depending on what the defender is doing when the ball arrives:

| defender | seen at | what happens |
|---|---|---|
| **armed** — touches it | M4 41.77 s, M3 72.75 s | **counter**: their own cut-in, and the ball flies back as *their* power shot (M4: scored at 43.68 s) |
| **kicking** into it (Kick lit) | M4 61.45 s, 79.55 s, 171.9 s | **block**: a crackling **yellow-white spark burst** at the contact point; the ball **grinds** against the boot for **≈ 0.8 s** (61.45–62.25, 79.55–80.25) while the defender is pushed back a few pixels; the ball then sits **dead at the defender's feet ≈ 0.4 s** (62.35–62.7, 80.35–80.7); then it **fires back as a power shot** — full comet tail, no cut-in — at the shooter's side (62.75 s, 80.75 s), about **1.2–1.3 s** after contact |
| **not kicking** (in the air) | M4 43.33 s | **hit**: **red spark droplets** burst at the impact, the head **snaps back** (~60°, face up) and the defender is **carried backwards with the ball** (into his own goal here: GOAL); 4–5 faded after-images trail the ball |

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
| M3 37.2 | — | straight comet | straight in → **goal** 38.4 |
| M3 71.5 | player | straight comet | countered by the CPU at 72.75 (claw) → CPU's grab dazes the player, ball cleared |
| M2 41.8 | CPU | aerial meteor | lands in front of the keeper; rebound scored by the player |

## 6. What we took into the game

| rule | number | source |
|---|---|---|
| arming aura | electric rim + flicker, instant, never expires | §1 |
| cut-in | 1.34 s freeze, no text, 55–60% dim, white disc 1.4 r, 8+8 rotating rays | §2 |
| straight speed | `POWER_SHOT_SPEED` 2150 px/s, flat | §3 |
| aerial | up and out, ~1.0 s of warning streaks, 0.25 s dive at ~30° into the mouth | §3 |
| grab | the ball carries the defender toward his goal, stars on release | §3 |
| counter | armed touch → own shot + own cut-in | §4 |
| block | kick into it → 0.8 s grind + 0.4 s dead → fires back as the blocker's shot | §4 |
| hit | unarmed, not kicking → knocked back with the ball, dazed 0.5 s (stars) | §4 |

The other families (Ground, Downward, Destructive, Delay, Multi-Ball, Up-and-Down, Ailment, Critical)
and the ailments (reverse `???`, shock, freeze, beheaded, burn) are not in our footage. They follow the
approved champion map (`docs/HS-CHAMPION-MAP.md`) and the HS wiki's family descriptions, flown at the
measured comet speed scaled per family, and are marked `estimated` in `shared/hs-powers.js`.
