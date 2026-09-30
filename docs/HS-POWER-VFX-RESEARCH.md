# HS power shots — how the effects are built, and where ours falls short

Research pass, 2026-09-29. It adds to docs/HS-POWER-SHOTS.md, which already covers timing and geometry.
This file covers **how** HS draws its effects and **where our picture and motion differ**. The web
sources and their URLs are in the last section.

## 1. How HS builds a power effect (read off the M4, M3 and M2 footage at 60 fps)

- **Painted bitmap sprites with additive blending.** The rays, the halo ring, the comet, the flames
  and the Grab hand are all soft, hand-painted textures. They brighten whatever lies under them
  instead of painting over it, so where two sprites overlap the result goes white-hot. There are no
  vector shapes and no hard outlines.
- **Soft, low-resolution art scaled up.** The effects are as soft as the characters. Edges feather
  out and bloom into the stadium.
- **Flipbooks, not rigid transforms.** The armed flame is a new drawing every 2–3 frames at 60 fps
  (≈ 20–30 Hz): thin white-cored wisps that curl differently every time (M4 36.6 s, 8 consecutive
  frames). The cut-in rays change length, width and softness from one sample to the next.
- **The engine is unconfirmed.** It is probably cocos2d(-x) or a custom engine. No ripped sprites,
  atlas names or frame counts exist online (see §4).

## 2. The cut-in choreography (M4 40.30–40.85 s, every 3rd frame)

| time | HS |
|---|---|
| 0–0.1 s | a white disc behind the head, **thin sharp rays shoot out**, the stadium starts to darken and blur |
| 0.1–0.3 s | the rays **widen and go soft**, each one flickering in length and width |
| ≈ 0.35 s | the **halo ring fades in** (radial striations, star-spike sparkles) |
| 0.3–0.9 s | the **ball rises** from behind the head, up and forward; the shooter holds the **wind-up pose** (head tipped back) |

Ours (`node _powers-hq.mjs video 1`): the rays are a **rigid wheel**, the same 16 spokes turning
slowly, identical from frame to frame. There is no sharp→soft burst, the ring is there from the start,
there is no wind-up pose, and the ball does not rise behind the head.

## 3. Element by element: HS vs ours

| element | HS | ours | gap |
|---|---|---|---|
| armed aura | curling flame-wisp flipbook, different every 2–3 frames | a crown/antler shape that looks alike from frame to frame | shape variety, curl |
| cut-in rays | burst, then soften; a fresh set every frame | rigid rotating wheel | **animation** |
| cut-in ring | fades in late | there from frame 1 | timing |
| shooter | wind-up pose, the ball lifts | static | **missing** |
| comet | a huge soft volumetric blob, white core → cyan/green-yellow → blue wisps, bleeds light into the stands | a hard-edged shape with visible gradient bands | **texture softness, bloom, size** |
| Grab hand | painterly, motion-blurred, glowing dark navy | a flat vector glove with a clean outline | **texture** |
| Aerial lances | red spears with a hot core | close | small |

Our rendering technique is already right: fx-kit.js pre-bakes textures and blits them with
`'lighter'`. So the fix is **the art in the textures** (softer, painterly, more bloom) plus the
**choreography over time** (burst curves, flipbook variety, the wind-up pose, the ball lift). The
engine does not need to change.

Tooling bug found: `_hs-compare.mjs` captures our press and cut-in frames behind the match-intro "VS"
banner, so those two columns of `.shots/compare/*.png` show the intro, not the power.
`_powers-hq.mjs` is not affected.

## 4. Web sources

- **Catalogue in arcade order**, from https://headsoccer.wiki.gg/wiki/Power_Shots. GIFs are at
  `https://headsoccer.wiki.gg/images/<file>`. They are about 320×180 video captures, not sprite rips.
  1 Korea, Blue Aura (South_Corea.gif) · 2 Cameroon, Thunderbolt (QqqGYR.gif) · 3 Nigeria, Tornado (Nigeria.gif) ·
  4 USA, Illusion (United_States.gif) · 5 Japan, Ninja (O3AuHc.gif) · 6 Russia, Ice (Power_Shot_Russia.gif) ·
  7 Argentina, Dragon (4q511A.gif) · 8 Italy, Giant (Italy.gif) · 9 Brazil, Firebird (5aXBR8.gif) ·
  10 Germany, Dark (4-e-AJ.gif) · 11 Spain, Laser (BfI9Ze.gif) · 12 France, Underground (PapyfH.gif) ·
  13 UK, Hawk-Eye (Ukshot.gif) · 14 Mexico, Hand (CeVDhV.gif) · 15 Netherlands, Black Hole (1w43r.gif).
- Effect GIFs: Electrocution_Cameroon.gif, Mexico's_Hand.gif, Brazil's_Bird.gif, Italy_Power_Shot.gif,
  `{Czech,Georgia,Nepal}_Power_{Activate,Air,Ground,Counter,Effect}.GIF` (480×360, the best clips for
  the arming and the cut-in). Full index:
  https://headsoccer.wiki.gg/api.php?action=query&list=allimages&aimime=image/gif&aiprop=url|size&ailimit=500&format=json
- **Videos:** https://www.youtube.com/watch?v=CyWnjdQrDrc (4K 60 fps, 37 min, every power being
  blocked; the best one for frame study) · https://www.youtube.com/watch?v=psElqGI5zsY (1080p, all
  97 characters' shots).
- **Engine:** not documented anywhere. The Android package is `com.dnddream.headsoccer.android`. An
  `unzip -l` of an APK we legally own would settle it.

## 5. THE CUT-IN, EXACT SPEC (the ≈ 1.3 s "sun" before the ball leaves)

Measured 2026-09-29 at 60 fps and full resolution: M4 40.20 s (the main one), checked against M4
59.97, 122.67 and 150.38 s and the left-side counter at 41.78 s. The scratch tools (kymograph,
de-rotation, speed scan) are in the session scratchpad and should be copied into tools/ when we build.
Units: frames at 60 fps from **f0 = the head meets the ball**. 1 world px = 2 video px, and a head
radius r = 26.4 world px.

**It is ONE FIXED ANIMATION.** Every cut-in shows the same rays at the same screen angles on the same
frame (within 1–3°), in all 5 cut-ins. It is **not mirrored** for a shooter on the left: the rays
turn the same way at the same angles. Only the ball's path flips to the shooter's front.

### Timeline
| frame | what happens |
|---|---|
| f0–1 | head meets ball |
| f2 | the ball disappears (hidden until ≈ f30) |
| f3 | first light: a thin rim glow round the head and one faint vertical ray (layer A's 93° ray) |
| f3→f21 | the stadium darkens in a straight line, luma 112 → 24 (keeps ≈ 21 %); a light blur (≈ 1 world px) |
| f4–6 | a small white disc grows; faint rays down-left and down-right (layer A complete) |
| f5–13 | **the head tips back** smoothly to 59° (f13), held ≈ 53° to f52 (measured by matching a rotated head template on every frame) |
| f10–16 | the disc is at its biggest: pure white to ≈ 2.2 r, soft gold falloff to ≈ 2.9 r |
| f15 | layer A starts turning (static before this) |
| f14–18 | the wide soft rays (layers B, C) come in |
| f22 | **the ring** appears at ≈ 2.8 r and expands like a shockwave: 3.8 r at f42, 4.8 r at f56, fading all the way (bump +100 → +60 → +25 luma), gone ≈ f60 |
| f22→f56 | the disc shrinks: 1.9 r (f22) → 1.8 (f42) → 1.5 (f56) and stays ≈ 1.5 r, soft |
| ≈ f30 | the ball reappears above the head (≈ 1.2 r to the front, 1.8 r up) |
| f30→f75 | the ball drifts down to the front side, level with the top of the head (≈ 1.7 r out), drawn stretched sideways |
| f53–59 | **the head WHIPS FORWARD** like a header: upright at f53, ≈ 60° forward at f54–55, springs back to 15° at f57, settles 27° forward at f59; the ball is knocked out in front with it (f52–54) |
| f59–89 | the head holds 27° forward, through the release; it eases upright f90 → f101 |
| f76–77 | **release**: the comet leaves; the rays and disc are gone within 2–4 frames |
| f81→≈f95 | the dark lifts (luma 24 → 65+, a straight line) |

### The three ray layers (all additive, all turning round the disc centre, all fixed)
Angles are maths angles (0° = right, 90° = up), as they are at **f24**.

| layer | rays | angles at f24 | spin | length | width | colour |
|---|---|---|---|---|---|---|
| **A — thin gold** | 3 | 71°, 196°, 318° (f8: 93°, 205°, 333°, static f5→f15) | **clockwise 96°/s** | ≈ 6.5–7 r | a sharp core ≈ 0.5 r wide at 5 r out, glow ± twice that | core #F0EEA5, body #EEE55E, edge #8D8739; white-hot #FCEBAA by the disc |
| **B — wide soft** | 5 (a star, ≈ 72° apart) | 66°, 132°, 211°, 277°, 353° | **clockwise 150°/s** | ≈ 8 r (the longest) | ≈ 20° wide (≈ 1.7 r at 5 r out) | pale cream #C2B67B–#E2D790, about half strength, streaky |
| **C — short soft X** | 4 (90° apart) | 63°, 153°, 241°, 330° | **counter-clockwise 95°/s** | ≈ 5–5.5 r | wide, soft | cream-gold |

Each ray's length and brightness flickers on its own frame to frame (B's rays fade in and out most).
Layer A turns against layer C, and that is the X-crossing "shimmer" the eye reads as a living sun.

### Ours today vs this (public/vfx/cutin.js)
- 16 rays on ONE wheel at 0.5 rad/s (29°/s) with random jitter, vs 3 layers at 96, 150 and −95°/s with fixed angles.
- All light at full strength within 0.06 s, vs the staged burst (f3 → f16) with layers arriving at different times.
- The ring is a fixed halo from the start, vs an expanding, fading shockwave from f22 to f60.
- The disc does not shrink over time.
- No wind-up tilt of the shooter's head.
- The ball is visible the whole time, vs hidden f2–f30, then drifting to the front.
- The dark fades in over 0.2 s, vs a straight 0.3 s ramp (f3 → f21).
