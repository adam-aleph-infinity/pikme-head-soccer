# Head Soccer physics: research and comparison (2026-09-29)

This covers ball speed, kicks, headers, dashes, jumps and bounces. Units are world px (1060 wall to wall, grass at y 435) and seconds. HS numbers come from Idan's recordings (hs-video/M1–M5) unless marked otherwise.

Re-run the comparison:
- `node _phys-compare.mjs 12`: every ball touch in the HS footage vs 12 bot matches, same detector.
- `node _kickgrid.mjs`: our kick, controlled.
- `node test-hs-parity.mjs`: every single measured number.

## 1. What is public

- HS is built on **Box2D**. Every surface is a restitution bounce, the boot is a moving body, and the stick sets velocity directly. [wiki](https://headsoccer.fandom.com/wiki/Stats)
- There are 5 stats, each upgraded 1–10. [wiki.gg](https://headsoccer.wiki.gg/wiki/Stats)
  - **Kick:** "the further the ball will travel when you kick it, and the faster it will go".
  - **Speed:** run speed.
  - **Jump:** "higher and further".
  - **Dash:** dash distance.
  - **Power:** gauge refill.
- No numbers are published anywhere. Everything below is measured.

## 2. HS physics, measured

### Ball
| | HS | n / clip |
|---|---|---|
| gravity | 583 px/s² | 86 flights, M4 |
| air drag | 0.099 /s | 17 flights, M4 |
| rolling slow-down | ~0.15 /s total | M4 |
| bounce off grass | 0.65 | 5, M3 (low confidence) |
| bounce off goal roof | 0.67 | 2, M4 |
| ceiling | 130 px above the top of the screen, bounce 0.41, keeps sideways speed (Idan) | M4 |
| rests on the crossbar? | never | M4 |
| respawn | 302 px up, drifts ±138 px/s | 7, M3 |
| fastest ordinary ball | ~2240 while a dash pushes it, then **1970 kept** (only drag slows it) | M5 29.1 s and 3 more |

### Player
| | HS |
|---|---|
| run | 228 px/s, with no acceleration: full speed, stop and reverse each take ≤ 3 frames |
| in the air | 241 px/s, steering still instant |
| jump | 45.8 px apex, takeoff 235 px/s, gravity 595, 0.77 s in the air, one height for tap or hold, no double jump |
| hold jump | jumps again 0.05 s after landing |
| dash | 1790 px/s for ~5 frames (~120–150 px), then back to a walk; ≥ 0.42 s between dashes |

### Kick
- Swing is 0.26 s, repeat every 0.349 s. The boot rises to face height by frame 6, holds, then snaps back.
- The ball bounces off the boot (restitution ~0.68). There is no fixed kick velocity.

| kick (what the frames show) | ball leaves at | clip |
|---|---|---|
| ball rolling at the feet, standing | 439 px/s, flat (1°) | M1 60.21 s |
| ball on top of the rising boot | 1048 px/s, straight up (90°) | M5 80.68 s |
| chest-high dropping ball, CPU standing (checked frame by frame) | **~1250–1280 px/s, 19°** | M5 13.05 s |
| other ground touches, walking | 857 @17°, 1582 @−2° | M5 42.01, 45.55 s |
| dash into the ball | 1614–2286 px/s, flat (~9°) | M5, 8 touches |

### Head
- Bounce off a standing head: 0.79. Off a jumping head: 0.70.
- A passive jumping header leaves at ~717 px/s (it gains speed from the rising head). Header apex is ~311 px.

### Kicking the other player
- A standing player slides back 40 px. One in the air flies 120 px.
- The kicked player reels for 0.2 s. Every 5th kick hurts, and 3 hurts knock them out for 2 s.

### Match-level (5.7 min of live ball, M1–M5)
- Ball speed per frame: median 333, p25 149, p90 941 px/s.
- Ball height: median 145 px. Above head-top 69% of the time, above 250 px 26%.

| touch type | out speed median (p25–p75) | angle | n |
|---|---|---|---|
| boot/body, standing | **914** (673–1325) | 23° | 12 |
| boot/body, jumping | 446 (263–710) | **70°** | 16 |
| head, standing | 684 (540–1506) | **70°** | 11 |
| head, jumping | 581 (453–792) | 49° | 24 |
| dash touch | 2026 (1718–2286) | 9° | 8 |
| grass bounce | 413 | 56° | 52 |

### Still unmeasured
The existing footage has too few clean samples for these:
- knee-height kick
- jumping kick
- running kick
- header with KICK pressed
- side wall and front crossbar bounce
- hardest possible kick
- what one stat level is worth

These are clips C7, C8, C9 and C12 in docs/HS-RECORDING.md.

## 3. Ours vs HS

**Same as HS:** 86 of 89 numbers in test-hs-parity pass. That covers ball gravity, drag, bounces, run, jump, dash, kick timing, head bounce, the head-height kick (1197 vs 1050) and the passive header (757 vs 717).

The 3 misses are not physics (re-run 2026-10-02):
- The CPU's power-shot delay is two rows, one per difficulty. That is AI.
- The weak CPU's goals a match (5.6 vs 2.7), since the CPU comes forward (a8127fe). Also AI.
- (The ceiling row passes since 98bd2e7: it keeps 0.63 of the sideways speed, HS's measured keep.)

**Different.** These are corrected on 2026-09-29, second pass:
- Only touches where the tracker has both players count.
- Real matches (M1–M3) are compared on their own. M4 and M5 are weak-CPU and test footage, and they made HS look calmer and lower than it is.

| # | what | HS (M1–M3) | ours (bot vs bot) |
|---|---|---|---|
| 1 | **sideways ball speed**, p25 / median / p90 | **45 / 164 / 893** | **129 / 219 / 630** |
| 2 | ball free in the air, barely moving sideways (<80 px/s), players tracked, away from mid-pitch | 7% of frames, mostly near the top of the screen | 2% |
| 3 | ball height: median / % above head-top / % above 250 px | 173 / 78% / 30% | 181 / 77% / 33%: **the same** |
| 4 | a grass ball kicked | 1–9° (clean kicks), dashes −7…17° | **always 0°** (fixed, §4) |
| 5 | standing header angle | 67–75° (n = 4–10) | 57° |
| 6 | jumping body touch angle | 56–65° (n = 6–12) | 31° |
| 7 | dash touches | 1.4/min, ~2000 px/s | 0.5/min. The sim does 2000 at 5–6°; the bots rarely try |

The "fast overall" feel is #1. HS's ball either hangs almost vertically (steep, high balls; the restart drop) or rockets across. Ours drifts sideways at a steady medium speed. The top speed is not higher.

#5 and #6 point to the cause, steeper touches in HS, but the old footage has too few clean samples (4–12) to fit them. #7 is the CPU, not physics.

Our boot is not too weak. The kick speed was fitted on 2026-09-27, after Idan said "the kicks feel way too hard". HS's boot kicks are 445 / 792 / 1469 px/s (median / p75 / p90).

## 4. Changes made

### 2026-09-29: a grass ball kicked leaves with a small lift
**What changed:** `shared/kick.js` BOOT_PATH. The boot's first 3 frames along the grass now rise slightly, from 0.60 R to 0.66 R. Before, the path was dead level at 0.66 R, the ball's centre height, so every grass ball was struck through its middle and went out flat.

`_groundkick.mjs` (ours) vs HS:

| case | before | after | HS |
|---|---|---|---|
| standing kick, still ball | 0–3° mostly (median 2°), ~434 px/s | 2–25° (median 8°), ~496 px/s | 1°, 9° (~440) |
| ball rolling in | median 1° | 1–19° (median 6°) | — |
| dash + kick | median 4°, ~2040 | 0–14° (median 8°), ~2040 | 3°, 10° (~2280) |
| dash only | 5–6°, ~2020 | unchanged | −7…17°, 1600–2300 |

**Tests:**
- test-sim 523/523. The random-play test now also skips a ball pinned in the goal box or at the wall, which the kick change started reaching.
- test-goal, test-ultimate, test-vfx and test-characters pass.
- Parity is 85/89. `cpu.rangeConv` went 0.54 → 0.44 (HS 0.70 ± 0.19). The CPU reaches slightly lifted balls less often.
- test-arcade: the golden digest was re-recorded. Two tests fail:
  - The tier ladder was already failing before this change.
  - Stage 45 vs stage 1 moved from 178:88 (2.02) to 186:97 (1.92) against a 2:1 bar.

### 2026-09-30: the grass and the walls grip the ball (M6 added)
**New footage.** M6 (`hs-video/M6-headers.mp4`) is a full match, Korea vs Cameroon, in the day stadium.
- Tracked with `_hs-track-match.mjs M6`. There is a brown-skin rule for the Cameroon face, and a background test in the crowd rows only.
- 3,368 frames have both faces.
- Power-shot cut-ins in M1, M2, M5 and M6 were found by screen darkening and are skipped. Post-goal frames are skipped too.

**Re-measured with M6.** Touch angles, real matches M1, M2, M3 and M6, both players tracked:
- Standing header 53° (ours 57°). Jumping header 49° (46°). Standing boot 9° (8°). Grass ball struck 8° (9°).
- **Headers match.** The earlier 67–75° was noise.
- "Jumping body touch 60°" is mostly grass bounces under a jumping player, a classifier artifact.

**The cause of "fast overall": grip.** `_bounce.mjs`, 52 clean HS grass bounces:
- The ball keeps 0.84 of its sideways speed.
- It loses **0.07 × the landing impulse**: 0.071 soft, 0.058 medium, 0.085 hard. That is one Coulomb friction, Box2D's.
- Ours kept 0.99.
- Side wall: restitution **0.67** (0.66–0.68, 4 bounces, first measurement; ours was already 0.67), with the same grip on the vertical speed.

**Changes:**
- `BALL_GRIP = 0.07` in `shared/constants.js`, applied in `shared/sim.js` `grip()`. The grass takes sideways speed and the side walls take vertical speed, never past zero.
- The bot's ball predictor knows the grip.

**Result** (`_phys-compare.mjs`, HS real matches vs 12 bot matches):

| | HS | before | after |
|---|---|---|---|
| sideways p25 / median | 45–67 / 157–179 | 129 / 219 | **89 / 154** |
| slow ball share (<150) | 22–23% | 10% | **18%** |
| vertical p25 / median / p90 | 50 / 179 / 515 | 86 / 210 / 560 | **57 / 176 / 487** |
| height median / above 250 | 165–171 / 28% | 181 / 33% | **163 / 28%** |
| grass grip | 0.077 | 0 | **0.072** |

**A bug the grip exposed: stuck matches.** In 10-minute bot matches the ball came to rest at x 665. That was past both bots' pressing depth, so both bots stood off it for the rest of the match. It had already happened once without grip, at minute 7. Fix in `shared/bot.js`: a ball lying still on the grass is anybody's, so no pressing cap and no lazy roll applies to it. Now 51–63 goals per 10 minutes, and the ball is off the top of the screen 2.6–3.8% of the time (HS 4%). The parity `botLong` scenario now runs 4 seeds; one match swung from 0% to 11%.

**Still different:**
- **HS's fastest sideways balls.** Sideways p90: HS 745, ours 560. They are dash strikes (the tracker loses the face in the dash blur), about 5–6 a minute in HS against under 1 from our bots. Our dash strike itself matches (~2000 px/s).
- **CPU conversion is inconclusive.** The parity camera-fit reads 0.46 against HS 0.70 (M3, n = 23). The same simple method on both sides reads ours 0.84 against HS 0.59 (M1, M2, M3 and M6, n = 51; M3 alone 0.72). Left alone.

**Tests:**
- test-sim, test-goal, test-ultimate and test-vfx pass.
- Parity is 85/89: ceilingKeepX (Idan's call), rangeConv (above), and powerDelay ×2 (Idan's call, the CPU fires at a full gauge).
- test-arcade: the golden digest was re-recorded. The ladder test was already failing. 45 vs 1 is 156:81 (1.93) against a 2:1 bar.

### 2026-09-30: the CPU dash-strikes like HS's
**What changed:** `shared/bot.js`, THE DASH STRIKE. A slow ball on or just off the grass, 55–175 px ahead on the side the CPU attacks, gets one roll per chance, and on a hit the CPU dashes through it. The chance is `STRIKE_BASE 0.05 + STRIKE_SKILL 0.9 × skill²`, so the 5-star CPU nearly always goes and the weak one rarely does.

The dead-ball rule now waits `DEAD_WAIT` 4 s before pouncing, like HS (M4 111.0 s: a ball untouched for 6.6 s). There are still no stuck matches: 53–69 goals per 10 minutes.

`_dash.mjs`, 30 matches per tier against tier 3:

| | before | after | HS |
|---|---|---|---|
| 5-star dashes | 13.1 /min | 15.0 | 13.7 |
| 5-star dash strikes | 0.8 /min | **1.9** | (dash strikes are most of HS's rockets) |
| weak dashes | 1.3 | 1.9 | 2.2 |

**Tests:**
- test-arcade: 45 vs 1 is back over 2:1 (173:86). The golden digest was re-recorded. Only the tier ladder (already failing) fails.
- Parity: cpu.kicksPerMin reads 64–68 against HS 45 ± 18. HS's figure is 26 kicks in ~35 s of M3. Halving the CPU's mash moved it only to 63.5 and cost the 2:1, so the mash stays at 0.3.

**Slow-ball share: a lesson.** In bot-vs-bot play the share of time the ball is slow mostly measures how active the bots are, not physics:
- The grip took it from 10% to 18%.
- The CPU learning about the grip (a better predictor) took it back to 13–14%.
- The dash strike and the dead-ball wait barely move it.

HS's 22% is a human against the CPU, so this number cannot be matched exactly. Match the per-bounce grip instead (0.072 vs 0.077).

### 2026-10-01: the boot's HS bounce back, the ceiling's real keep, a busier weak CPU
A friend said the ball feels slower than HS. Idan: "exactly HS", the CPU too, and the ceiling keeps the sideways speed (check it).

| change | before | after | HS |
|---|---|---|---|
| boot bounce (`BOOT_BOUNCE`) / swing (`BOOT_DRIVE`) | 0.5 / 1 | 0.68 / 0.893 | 0.68 (M5 80.6 s) |
| still ball at the feet, head-height kick (`_kickgrid`) | 532, 1197 | 533, 1152 | 439, 1050 |
| kick at a ball coming in at 900, p90 (`_kick-incoming`) | 1038 | 1165 | — |
| ceiling sideways keep (`CEIL_KEEP_X`, `_ceil-check`) | 1 | 0.63 | 0.60–0.64 (4 clear hits); the old "0" was wrong |
| weak CPU kicks/min, touches/min (`MASH_BASE` 0.02 → 0.06) | 9.9, 10.1 | 16.2, 7.3 | 23, 9.2 |

Corrections to §3:
- The "touches 50/min vs 13" is the geometric detector on two bots. The per-CPU counts match HS (strong 19.4 vs 17.4, weak 7.3 vs 9.2).
- HS's fast "frame/wall" touches are not walls. They are mid-pitch with no player within 150 px (`FW=1`): tracker glitches and power-shot tails. Without them, HS has ~5.3 fast sideways touches/min and ours ~7.
- Our bots hit grass balls with the body 10× more than with the boot (`_grass-touch`), so bot-vs-bot frame speeds say little about a human's kicks.

Open: power shots. Bot vs bot arms 10.1/match and 81% score, which is 8.2 of the 11.8 goals (`_goal-source`). HS converts ~58% (M3/M4), and its matches have ~8.7 goals in all.
