# Head Soccer gap audit: full evidence (2026-09-25)

> Evidence snapshot from 2026-09-25, not updated. For what is fixed and what is still open, see [HS-GAP-AUDIT.md](HS-GAP-AUDIT.md) (status updated 2026-10-02, §8).

The complete per-area audits behind [HS-GAP-AUDIT.md](HS-GAP-AUDIT.md), which is the merged summary with IDs and the fix order. Each section below is one audit, unedited. It covers every gap with its evidence and file:line, what already matches, and what is unverified or dropped.

**Sections:**
1. Physics and movement
2. Kicking, powers, gauge and ailments
3. Rules, flow, modes and CPU
4. Controls, HUD and screens
5. Visuals, animation and audio



---

## Physics and movement audit: Head Soccer parity (branch head-soccer-parity, 2026-09-25)

### How each finding was checked
- **Harness**: `node test-hs-parity.mjs` gave 88 rows, 82 ok, 6 OFF. Two of the OFF rows are physics.
- **Sim probes**: every "Ours" behaviour below was re-run in the shipped sim (scratchpad/simprobe.mjs, simprobe2.mjs), not just read off constants.
- **HS probes on the M4 raw tracks**: u1/u2.json and flights.json from the earlier measuring session (…/8aea9291…/scratchpad/m4/). Script: scratchpad/hsprobe.mjs, hs2.mjs, air.mjs. Same calibration as hs-reference: x0 107, ground 489, s 0.9953.
- **HS frames by eye** (ffmpeg on hs-video/M4-gaps.mp4): the kick swing at 29.64 s (scratchpad/kickstrip.jpg, kickzoom.jpg), the dash strips at 52.3 / 55.0 / 70.7 s, the 49.5 s touch, and a still at 30.5 s.
- **Wiki**: headsoccer.wiki.gg/wiki/Controls, plus one tip seen only in a search snippet.

"Measured" = a row in docs/hs-reference.json. "Probe" = my own measurement on the M4 tracks or frames this session.

### Gaps (verified)

| # | Item | Real HS | Ours (file:line + value) | Gap | Severity | Confidence |
|---|------|---------|--------------------------|-----|----------|------------|
| 1 | KICK with a ball at your feet fires the aimed header, not the boot | HS has no header move. The kick is only the leg. | sim.js:574 checks tryHeader before the swing. The header radius is HEAD_R+BALL_R+HEADER_R = 58.9 px from the head centre (43 px up), so it covers a ground ball up to ~50 px in front. **Probe: ground ball at dx 31/40/50 → 524 px/s @ 60° "header". At dx 60/70/85 → boot, 480-515 px/s @ 28/20/9°.** | The ball you dribble sits ~30 px out, so every close-range KICK is a 60° pop-up from the forehead | High | High (sim probe + code) |
| 2 | Aimed header into a falling ball | **Measured**: ball.launchSpeed.header 626 px/s, ball.headerApex 311 px (M4 n=12, effectively passive) | sim.js:1229-1230: vy = −(272·1.7 + drop·0.62) + p.vy·0.6. **Harness: 811 px/s, apex 547 (OFF, +29% / +76%)** | Skies the ball to the cap, above the camera top (475) and close to the ceiling | High | High (harness OFF) |
| 3 | Where the boot is during the kick | **Probe (frames, M4 29.64 s)**: the boot is at knee height for only ~2 frames. For most of the 0.26 s it sits ~51 px ahead of the body centre and ~52 px up (forehead level), boot ~20×25 px, then comes back down. | sim.js:1421-1427: one static circle, r 22, at (62 ahead, 16.5 up), live for all of KICK_TIME. **Probe: a still ball at (62,70), (70,80) or (55,90) is MISSED. (62,55) and (40,60) are struck.** | HS's kick is a raised boot that meets balls at chest/face height. Ours is a ground sweeper with a hole where the HS boot spends most of its swing. | High | High (frames + probe) |
| 4 | Rolling friction | **Probe (M4 tracks)**: 111.01 s, a ground roll of 6.64 s, 82 → 40 px/s over 404 px, k = 0.11 /s. 145.47 s: 1.08 s, 199 → 160, k = 0.21 /s. | constants.js:78-79 air 0.99694 + ground 0.99182 per tick. **Probe: k = 0.73 /s. An 80 px/s ball stops after 111 px (4.1 s). A 300 px/s ball stops after ~330 px.** | ~4-6× too sticky. HS's ball is still rolling after 400 px where ours has stopped at 111. | High | Med (n = 2 rolls, one long and clean) |
| 5 | Horizontal air drag | **Probe (M4, 17 free flights ≥ 36 frames, \|vx\| > 150)**: k = 0.099 /s (IQR 0.095-0.105). Consistent with Box2D linearDamping ≈ 0.1. M3 probe: ~0.07, noisy. | constants.js:78 BALL_AIR 0.99694/tick = **0.184 /s** (sim.js:900) | 1.9× HS. A 400 px/s ball over a 1.5 s flight falls ~40 px short of HS's. | Med | High |
| 6 | Speed cap | **Probe (M4 flights.json)**: non-power launches of 1013 (102.2 s, head touch, 44°), 1071 (49.64 s), 1091 (66.78 s), 1001 (129.26 s) px/s, none near a cut-in. Measured passive headers reach 845. | constants.js:91 BALL_MAX_SPEED 816 (sim.js:907-909) | HS's hardest ordinary touches are ~25-35% faster than our ceiling | Med | Med-High |
| 7 | Ball against the body | Wiki tip (search snippet): "receive the ball with your body, the ball will go up diagonally quickly". No clean body-height contact found in M4 to measure. | constants.js:215 BODY_DEADEN 0.18; sim.js:1560-1562, 1655. **Probe: 400 px/s into the body at 30 px up → 102 px/s out. Walking into a resting ball → ball at exactly 226 px/s (pushed, never bounced).** | HS's body sends the ball up and away. Ours kills it at the feet. | Med | Med (sim verified; HS side = wiki text) |
| 8 | Dash + kick | Wiki: "If you kick after dashing … the ball will go up diagonally quickly". No clean dash-kick in M4 (the 49.64 s fast ball is a head touch by the wall, per the frames). | sim.js:1489 adds p.vx·0.4. **Probe: 1264 px/s at 1°, capped to 816 next tick.** | HS's dash shot rises. Ours is a dead-flat line drive. | Med | Med (sim verified; HS side = wiki text) |
| 9 | Header re-places the ball | HS never teleports the ball | sim.js:1242-1243 snaps the ball to (head ± 45, head − 15). From the top of the header radius that is a ~60 px jump in one tick (geometry). My probe case moved it 7 px. | Visible snap on aimed headers | Low-Med | High (code) |
| 10 | Idle reset | **Probe**: the M4 111.01 s ball rolled untouched for 6.64 s and HS did nothing | constants.js:513 6 s; sim.js:378-386. **Probe: a resting untouched ball is teleported to centre at 6.02 s.** | A non-HS event. Mostly triggered by #4's dead balls. | Low | High |
| 11 | Body box width | **Probe (still, 30.5 s)**: shorts+boots ~35 px wide, ~15 px showing below the head (art, not collider) | constants.js:104-106 BODY_W 28, BODY_H 24 (17 px below the head) | Ours may be ~20% narrower, if the HS collider follows the art | Low | Low-Med |
| 12 | Frame pacing | 60 fps | game.js:1170-1208: fixed 60 Hz, vsync snap, no render interpolation | Judder on 90/144 Hz screens only | Low | High (code) |

### Checked and dropped
- **Ground friction per sub-step**: the code looked like it would double friction above ~495 px/s, but the probe measured the same k 0.73 at 80, 300 and 600 px/s. Not a gap.
- **Air control**: **probe** on the M4 human's airborne segments. At 99.67 s he goes +239 → −239 px/s mid-air, and at 128.3 s +159 → −239. HS has full, instant air steering, and so do we (sim.js:536). A match.
- **Tap step**: M4 isolated taps move 12-14 px over ~4 frames (C 46.28, 50.15 s; P 131.18 s), which is 228 px/s × the tap length. Ours does the same.
- **Air dash**: the tracker's "airborne dashes" turned out, on the frames (52.3, 70.7 s), to be one player standing on the other's head. No real air dash can be seen, so there is no evidence for or against ours (sim.js:503-519 allows it).
- **Wall and post restitution**: M4 has no clean wall bounce (one candidate, a power shot), so HS is unmeasurable. Internally, ours is inconsistent: wall 0.86 (constants.js:81) and post corner 0.78 hard-coded (sim.js:1163), against 0.63-0.79 on every measured surface. Worth a C9 clip.
- **Player push**: M4 has no episode of a walker pushing a still player, so it cannot be measured.
- **Coyote / jump buffer 0.05 s**: invisible on video either way.

### Already matching
- Gravity: ball 580 (HS 583), player 595 (HS 595).
- Jump: apex 46.4 (45.8), airtime 0.79 (0.772/0.78), takeoff 235. No variable height. Hold re-jumps after 0.05 s. No double jump.
- Walk 228 px/s with instant start, stop and reversal. Air control instant (probe above).
- Dash 1790 px/s, 0.068 s, 120 px, cooldown ≥ 0.42.
- Kick timing: leg out 0.267 (0.26), repeat 0.367 (0.349).
- Head: 52.8 px. Restitution 0.74 standing / 0.70 jumping. Passive header 747 (717). Frictionless across the contact.
- Head-stand: 70 px up, no carry. Dash-under: no launch, and the airborne player hangs.
- Goal: height 138, depth 57, roof 155 (154), roof restitution 0.66 (0.67). Ball never rests on the bar. Players cannot clear the bar.
- Ceiling at −130, restitution 0.43 (0.41), horizontal speed killed.
- Ground restitution 0.63 (0.65). Ball spawn 302 px up with 138 px/s drift. Camera shows 487 px of sky.
- Fixed 60 Hz tick, taps latched. Kick always toward the attacked goal, and players never turn around (facing is not drawn).
- Tunnelling guarded.

### Suggested next measurements
1. A C7 clip (ground, running and jumping kick speed and angle) to fit the raised-boot model in #1 and #3.
2. A C9 wall/post clip.
3. More M4/M5 ground rolls to firm up #4.

---

## Audit: kicking, power shots, gauge, ailments (branch head-soccer-parity, 2026-09-25)

Method: I read shared/hs-powers.js, shared/sim.js (kick, header, gauge, arm, contact), shared/constants.js, shared/champion-powers/*, shared/hs-champion-map.js and public/champ-vfx.js, plus docs/HS-POWER-SHOTS.md, hs-estimates.json and hs-reference.json. I ran `node test-hs-parity.mjs` and my own probes against the sim, and fetched the wiki pages Power_Button_Damage_Effects and Power_Shot_Guide.
"measured" = read off the HS footage (the file is cited). "knowledge/wiki" = from memory or the wiki, not filmed.

### Gaps

| Item | Real HS | Ours (file:line + value) | Gap | Severity | Confidence |
|---|---|---|---|---|---|
| KICK on a ball at your feet turns into a header | Pressing KICK with the ball on the grass in front of you swings the boot. HS has no header button (measured note, hs-estimates `kick.head.speed`: "HS shows no separate header button") | sim.js:574 runs `tryHeader` before the swing. The head's reach (constants.js:332 `HEADER_R` 16, plus the head radius and ball radius, ≈ 59 px from the head centre) reaches a ball resting on the grass. **Probe: a ball resting 30, 40, 45 or 50 px in front → HEADER** (vx 263, vy −453, 524 px/s at 60°). It only becomes a kick from 55 px out. A dribbled ball sits ≈ 30 px out, so most "kicks" of a ball at the feet pop straight up | Kicking the ball you are dribbling pops it up at 60° instead of driving it | **High** | High (reproduced) |
| Deliberate header strength | Measured (hs-estimates `ball.launchSpeed.header` 626 px/s, `ball.headerApex` 311 px, n 12; `kick.head.speed` 391 px/s at 66°, n 4) | sim.js:1229-1230 (`HEADER_POWER` 0.72, `HEADER_LIFT` 1.7, `HEAD_MEET` 0.62, `HEAD_RISE` 0.6). Parity test: headerKick **811 px/s, apex 547 (OFF, +29% / +76%)**; kickHead 518 px/s (+33%) | Headers fly much harder and higher than HS's, often off the top of the screen. HS has only the passive head bounce, and ours matches that (747 vs 717) | **High** | High (measured, parity OFF) |
| Ordinary ground kick trajectory | Not measured (hs-reference `kick.feet.*`, `kick.run.*` and `ball.kickApex.feet` are null). From memory: HS ground kicks go up in a clear arc of about 35–50° | constants.js:186 `KICK_POWER` 367, :203 `KICK_LIFT` 272, :281-299 toe/under model. Probe: a ball 55 px out → 478 px/s at 32°, apex ≈ 57 px. A running kick → 559 px/s at 16°, **apex 25 px**. From the toe → flat 541 px/s | Tuned deliberately flat for scoring, with no HS number behind it. May read as "too flat". The HS kick needs measuring | Med | Low-Med (no measurement) |
| Jumping kick / lob | HS has no lob button. A jumping kick tops out ≈ 340 px (one sample, cited at constants.js:207-208, M4 167.9 s) | sim.js:584 holding JUMP latches `kickLob` (constants.js:211-212 `LOB_LIFT` 1.9, `LOB_DRIVE` 0.62) → 629 px/s at 65°, apex 354. A jumping kick without JUMP held at the press (scenario kickJump) → 478 px/s at 35°, **apex 101** | The height comes from a button modifier HS doesn't have. A real jump-kick without the modifier is 3× flatter than HS | Med | Med |
| Kick swing has no arc and no timing | Knowledge: HS's boot is a jointed leg sweeping up through ≈ 90°. How hard and how high the ball goes depends on when in the swing and where on the moving shoe it meets | sim.js:1421-1427: a fixed circle (constants.js:184-185 `KICK_REACH` 62, `KICK_R` 22) at ball height, live for the whole 0.26 s. The strike is the same at 0.01 s and at 0.25 s into the swing, and only the ball's position inside the circle matters | No early-vs-late feel, and no ball lifted by the rising foot | Med | Med (knowledge) |
| Kick reach | Not measured. Knowledge: the HS foot reaches about 1 head diameter (≈ 50–60 px) past the body | Contact runs from 23.5 to 100.5 px from the body centre (62 ± 38.5) | The far reach may be generous (the ball edge ≈ 1.6 head diameters out) | Low | Low |
| Burn ailment | Wiki (Power_Button_Damage_Effects): "You'll get burned, and your walk will be reversed" (Brazil's firebird adds reversed controls) | hs-powers.js:60 and :591 burn = can't kick, 0.8× speed, 2.0 s base | The effect differs (HS burn = reversed walk) | Med | Med-Low (wiki only) |
| Freeze duration | Wiki: freeze "2-3 seconds", an ice block | hs-powers.js:56 base 1.5 s × (0.6 + 0.8·intensity), ×1.4 for the Ailment family → 1.5 s (straight family, online), 2.1 s (Ailment family), 1.2 s (aura, :94). Russia iced 2.5 s (stage-06.js) is fine | Most freezes are shorter than HS's 2–3 s | Low-Med | Med-Low (wiki) |
| Stun length by character | Wiki: unconscious "1-4 seconds (varies by character)". Measured: a plain hit gives a 0.5 s daze (`power.blockStun`) | hs-powers.js:61 stars 1.0 s base. Nigeria 3 s, Japan's block KO 1.2 s | Only estimated. No per-character spread except the 6 built powers | Low | Low |
| Pressing POWER while disabled | Wiki (Power_Shot_Guide, Russia): frozen, "You can't do anything **but activate your power shot**" | sim.js:487-496: a stunned player returns before the arm check (:627). hs-powers.js:603 `ailInput` returns `{}` for freeze, stars, iced, beheaded and thrown, so POWER is eaten | A frozen or dazed player can't arm, but HS lets him | Low-Med | Med-Low (wiki) |
| Block window | Measured only that a kick pressed under the last of the dark blocks (HS-POWER-SHOTS §4, M4 61.45 s). The window length isn't measured | hs-powers.js:430: `kicking` = the whole 0.26 s after the press (≈ 560 px of comet travel), plus `earlyBlock` :529-539 reaching ≈ 77 px on the press. Any contact counts while kicking, the head included | Probably more forgiving than HS (you can press early and still block) | Low-Med | Low |
| Block push-back | Measured "pushed back a few pixels" (§4) | hs-powers.js:81 `BLOCK_PUSH` 40 px/s × 0.8 s grind = **32 px** | More than "a few pixels" | Low | Med |
| Power-shot speed per family | Only Straight (2150), Aerial dive (≈ 2150) and Grab (≈ 2100) are measured (HS-POWER-SHOTS §3) | hs-powers.js:37-47: Ground 0.85, Destructive 0.9, Delay 1.15, Up-and-Down 0.8, Ailment 0.9, Critical **1.3 (2795 px/s)**, then 0.85–1.15× by the champion's arcade intensity (:189) | 8 of the 11 families' speeds are guesses. Critical's 2795 px/s is faster than anything filmed | Low-Med | Low (estimated) |
| Korea's shot speed | Measured: the starter's comet flies at 2150 px/s (M4/M1 = Korea, §3) | champion-powers/stage-01.js: `speed: 0.92` → 1978 px/s | 8% slower than the measured shot that stage copies | Low | High |
| Critical family | Wiki: a *random chance* on some characters' power shots, with a special cutscene, a longer effect and an ailment at the end | hs-powers.js:47: a fixed family (fastest, goes through a block), always on | A different mechanic (already noted in HS-POWER-SHOTS §9). The 11-families decision allows it, but the behaviour isn't HS's | Low | Med (wiki) |
| Other families' paths | Wiki text only (§9): Up-and-Down, Delay, Downward, Destructive, Multi-Ball, Ground | hs-powers.js:342-390: Up-and-Down wave amplitude 55–100 px over a 300 px wavelength. Delay goes 0.12 s, holds 0.35–0.8 s. Downward climbs at 15° for 0.16 s, then dives to the foot of the goal. Multi-Ball = 3 balls | Numbers are plausible but none are measured | Low | Low |
| The 45 champion powers: built vs specced | Spec: 45 (docs/HS-45-POWERS.md, hs-45-powers.json) | Built: **6 of 45** (shared/champion-powers/stage-01…06: Korea, Cameroon, Nigeria, USA, Japan, Russia). The other 39 fire their family from the map. HS-45-POWERS-PROGRESS.md lists only 5 (stage 6, Russia, is missing from the doc) | 39 of 45 are specced but not built. The progress doc is out of date | Med (arcade: from stage 7 on, every champion looks alike) | High |
| Online vs arcade family for stages 1–6 | n/a | hs-powers.js:120-126: a built power only in the arcade. Online, the map family is used: stage 1 = Destructive "cannon", stage 2 = Grab + shock (hs-champion-map.js rows 1-2) | The same card fires a different shot online than in the arcade (Korea's comet vs a Destructive cannon) | Low | High |
| Armed boot vs incoming power ball | Measured: an armed touch counters it (§4) | sim.js:1428: the boot circle skips power balls (`if (!b.power)`), and earlyBlock refuses armed players (hs-powers.js:531). Only a head or body overlap counters | An armed player's boot meeting the shot does nothing until the ball reaches his body. It usually does, so this is rarely visible | Low | Med |
| Kick cooldown (repeat) | Measured 0.349 s (hs-estimates `kick.cooldown`, n 11) | constants.js:174 0.349, but the parity test measures **0.367** (+5%, inside tolerance) | About 1 tick slow on mashing | Low | High |

### Already matching (one line each)

- Kick leg-out time: 0.26 s vs 0.267 measured in ours (`kick.duration`, M4).
- The kick always goes toward the opponent's goal (sim.js:596). HS characters always face the opponent (knowledge).
- Passive head bounce: HEAD_BOUNCE 0.75 → 747 px/s vs HS 717 (`header.passive.launch`, measured).
- Kick-knockout rule: 5 kicks per hurt × 3 hurts, a 2 s KO, 0.2 s reel, knockback 40 px on the ground / 120 px in the air (all measured, parity ok).
- The gauge fills on time only: 15.0 s first fill, 15.2 s refill, runs through cut-ins, stops over a goal restart (measured, parity ok).
- The gauge empties on the POWER press and the refill starts right away (measured `gauge.emptyOnPress` / `refillStart`).
- A full gauge never drains, and the max is one bar (measured `gauge.fullHold`).
- Conceding adds 1/3 of the gauge (measured +0.32, M4 43.5 s).
- The gauge freezes in sudden death (wiki).
- Arming: instant, no expiry, one arm at a time (measured `power.armHold` ≥ 5.4 s).
- The power fires on the next touch of any kind: kick, head or body (wiki Controls + footage).
- Cut-in: 1.34 s of dark, the ball released 1.14 s in, play runs under the last 0.2 s (measured, n 7, parity 1.35).
- Counter: an armed touch sends your own shot back with its own cut-in (measured `power.armedCounter`).
- Block: kick into the shot → 0.8 s grind, 0.4 s dead, then it fires back as the blocker's shot at 2150 px/s (measured §4).
- Hit: an unarmed defender who isn't kicking is knocked back with a 0.5 s daze (stars), and the ball bounces off at 0.84 of its pace (measured §4 / `power.blockStun`).
- Straight comet: 2150 px/s, dead flat (measured §3).
- Aerial: straight up, ≈ 1 s wait, dive at ≈ 40°, ≈ 2150 px/s (measured §3, M2).
- Grab: flies at 2150 px/s, drags the defender back to the shooter at 2400 px/s, throws him ≈ 1.25 s, then 0.45 s of stars (measured §3, M3).
- Ailments never stack or chain, and you can't break free except by waiting. The wiki gives no escape method either.
- Shock = slow, no jump (wiki: Cameroon's page). Beheaded = no header and no control (wiki: Honduras).
- Online equal stats and no stat-based gauge rate; the arcade's POWER stat changes the fill rate (the owner's decision; the 0.8–1.25× rate is estimated).

---

## Audit: match rules, flow, modes, progression, CPU AI

Sources: docs/hs-reference.json and docs/hs-estimates.json (measured), `node test-hs-parity.mjs`, run 2026-09-25 (ours vs HS), and my own reads of the timer in hs-video/M4-gaps.mp4. For those reads I diffed the timer digits at 20 fps from 17 s to 186 s. The wiki facts come from headsoccer.wiki.gg (Game_Modes, Arcade, Stats, Achievements) and the fandom page Sudden_Death.

### Gaps

| Item | Real HS | Ours (file:line + value) | Gap | Severity | Confidence |
|---|---|---|---|---|---|
| Goal restart timing | GOAL! banner 2.05 s with free play under it. Players are back on their spots and moving at 2.24 s. The ball drops at 2.795 s. **Measured**: goal.bannerTime (M3, n=7), goal.resumeTime (M4, n=8), goal.toPlayTime (M3, n=7). | constants.js:530 `AFTER_GOAL = 3` of free play, then the reset. The ball drops 0.555 s later (constants.js:529). Parity test: toPlayTime **3.58 s**, 28% over; resumeTime "not seen in sim". GOAL_RESUME (constants.js:528) is never read. | Every restart has about 0.8 s of extra dead time. We also skip HS's 0.19 s hold on the spots before players can move. | Med (felt after 2–3 goals) | High |
| Clock during a power-shot cut-in | The clock keeps running through the 1.34 s cut-in. **Measured by me** from the M4 timer: 1 Hz ticks at 39.65, 40.65, 41.65 and 42.70 s across the 40.44–41.78 cut-in, and at 59.70 and 60.70 s inside the 60.19 cut-in. | sim.js:262-280: hitStop returns before the clock decrement (sim.js:317-318), so the clock **stops** for every cut-in. | A match with 4–8 cut-ins runs about 5–11 s longer than HS. | Med | High (for M4) |
| CPU mean depth (5-star) | 427 px from its own wall. **Measured**: cpu.meanDepth (M3). | Parity test gives **511 px** (OFF). bot.js:445 fixes home at `myGoalX+180` for every tier, and the press cap at bot.js:452 is `W*(0.5+0.15*skill)`. | The strong CPU plays about 85 px too far up the pitch, which leaves room for lobs over it. | Med | High |
| CPU range conversion (5-star) | It plays 70% of the balls that come within reach. **Measured**: cpu.rangeConv (M3). | **0.49** (OFF). The weak CPU is 0.36 against 0.47, which is within tolerance but low. The `lazy` roll is at bot.js:441. | The strong CPU lets too many reachable balls go past. | Med | High |
| CPU dashes (weak) | 2.2 per minute. **Measured**: cpu.dashesPerMin.weak (M4). | 0.41 per minute (−81%, still within tolerance). The strong CPU does 9.6 against HS's 13.7 (−30%). The dash roll is at bot.js:467 (`0.01+0.3*s²`). | Our CPUs almost never dash at the weak end, and dash too little at the top. | Low | Med (n=4) |
| Pause menu | A pause button (the yellow "II", top right) opens a menu: resume, retry, quit. **Knowledge**; the button is visible in the M4 frame. | index.html:249 has a ✕ `#quit` that ends the match at once with no confirm (game.js:1062). There is no pause, and a hidden tab only releases the inputs (game.js:758). | No pause and no resume. One mis-tap on ✕ throws the match away. | High (seen on the first match) | High |
| Game modes | Arcade, Tournament (8 players, 3 knockout rounds), League (10 teams, 18 matches; Amateur/Minor/Major), Survival (a limited number of goals conceded), Head Cup (groups of 4 then finals; the only mode with draws), Death Mode (30 stages with henchmen), Fight Mode (8 opponents plus 4 bosses, KO rules), 2P on one device, multiplayer (local or online). **Wiki** (Game_Modes). | index.html:73-82 offers Multiplayer (private online room by link or code) and Single-player (the 45-stage arcade). A hidden "free training" match against the bot sits at index.html:140. | Missing: Tournament, League, Survival, Head Cup, Death, Fight, and 2P on one device. Online has no matchmaking, only private rooms (rooms.js). | Med (visible on the mode screen, not a feel issue) | High |
| Arcade progression model | Progress belongs to each character: you must beat the ladder with the character you started it with. Wins pay 100 points for the first opponent and 50 for each one after. **Wiki** (Arcade). | arcade.js:4-8 keeps one global `cleared` counter for every card, and a win pays nothing. | Beating the ladder with one card unlocks it for all your cards. There is no reward loop. | Low–Med | High |
| Currency and points | Points come from wins (arcade, multiplayer 200/10, Head Cup 30k+, Death 100k) and are spent on upgrades, costumes and mode entry fees (5,000). **Wiki**. | None. The grep finds no points, coins or currency. | There is no economy. | Med (meta, not feel) | High |
| Stat upgrades | Speed, Jump, Kick, Dash and Power, each upgradable 10 times per character. Costs double each level: 500, 1,000 … 256,000. Power speeds up the gauge refill. **Wiki** (Stats). | None for the player: stats are always equal (champions.js:147-149). Only the arcade champion carries HS stats. | The player never upgrades, while late champions carry a stat total up to 45/50 (docs/HS-CHAMPION-MAP.md). The whole late ladder has to be won on base stats. | Med | High |
| Costumes and accessories | Costumes you buy with points add to stats (for example +3 to all and +5 to two) and some have special effects. **Wiki**. | None. | Missing. | Low | High |
| Achievements and character unlocks | About 10 achievement types unlock characters: win without conceding, by 10+ goals, without a power shot, in sudden death, without dash, kick or jump, without being hurt, with 5 counters, and so on. **Wiki**. | Characters come from the owned Saltiz cards (game.js:101-131, `window.SALTIZ_CARDS`). There are no achievements. | No achievements. The unlock model is external to the game, probably a product decision. | Low | High |
| Idle-ball reset | HS has none that we know of. The ball never rests on the goal (ball.restsOnBar = 0, **measured**). | constants.js:513 `BALL_IDLE_RESET = 6`: an untouched ball jumps back to centre with a "new ball" banner (game.js:1137). | This is a rule HS doesn't have, and in rare cases it can fire on a slow ball that is still live. | Low | Med |
| Tie at full time: the sudden-death restart | At 0:00 with the score tied, a red streak wipes across and a "SUDDEN DEATH" banner shows (about 111.1–112.5 s). Then **both players are reset to the kickoff spots and the ball is dropped at the centre again** (by 113.6 s), about 2.5 s after 0:00. **Measured by me**: hs-video/M2-arcade-kor-uk.mp4, 5–5 at 111.0 s, golden goal at 121.99 s; the M2 tracks note tags the 111.2 s sudden-death banner. | sim.js:321-322 only sets `m.golden` and pushes the 'golden' event. Play carries straight on from wherever the ball and players are, with no pause and no reset. game.js:1138 shows a 1.1 s DOM banner (`מוות פתאומי`). | No sudden-death pause, no reset to the spots, no re-drop. | Med (every tied match) | High |
| Clock pause after a goal | The clock stops at the goal and starts again about 0.2–0.6 s after the ball drop, a pause of 3.0–3.8 s. **Measured by me** on the M4 timer: goal 43.68 → next tick 47.50; goal 74.02 → 77.85; goal 81.31 → 85.15. | The clock stops for `AFTER_GOAL` (3.0 s) and then runs through the 0.555 s no-ball window (sim.js:317 only checks `!m.afterGoal`). | The totals roughly agree today, but the pause is anchored to the wrong event. Once the restart is fixed to 2.24/2.795 s, the clock must stay stopped until the ball drops (`ballWait`) or matches will run short. | Low | Med |
| CPU against Delay shots (a known HS weakness) | The HS CPU jumps too early against delayed shots, for example Argentina's Dragon: "CPU jumps too early". **Wiki**, via docs/HS-45-POWERS.md:56. | bot.js:189 runs the real future path of the power ball (`powerPath`, a copy of stepPower), so when it defends it reads the shot perfectly. Its only weakness is a random 'panic' (bot.js:184, 30–70% on it) where it stands still. | HS's known exploit (bait an early jump) doesn't exist. Our CPU is either perfect or frozen. | Low | High |
| CPU "hides in its goal" | The weak CPU sometimes backs into its own net (M4 135.0–136.8 s, cpu.meanDepth.weak note). | The home spot is always 180 px out (bot.js:445). | A small quirk of HS's weak CPU that we don't copy. | Low | Med |
| Stale comment on the conceder bonus | HS tops up the gauge of the side that conceded when the ball drops. **Measured** (M4 43.5 s). | The behaviour is correct (sim.js:357-362, GAUGE_CONCEDE), but sim.js:1760-1761 says "A goal does NOTHING to either meter". | Only the comment is wrong. | Low | High |

Notes on the other rows' sources: the Tournament, League, Survival, Head Cup, Death and Fight counts, the upgrade costs and the achievement list are **from the wiki** (headsoccer.wiki.gg Game_Modes, Arcade, Stats, Achievements). The pause menu's *contents* (resume, retry, quit) are from knowledge; the pause button itself is visible in M4 frames. For the idle reset, the four clips (about 6 minutes of play) show no ball teleport, including the M4 135–137 s stretch where the CPU sat in its net.

### Already matches (one line each)

- Match length is a 60 s countdown (constants.js:516). Confirmed on the M4 HUD: 0:59 at 21.0 s, last tick 91.2 s.
- A draw goes to sudden death with the gauges frozen and an armed shot carried over (constants.js:531, sim.js:321, sim.js:451). Matches the wiki. The first goal in sudden death wins (sim.js:1763). Only the restart is missing (see the table).
- The timer display shows 1:00 under the KICK OFF banner, then 0:59 (M4 19.4–20.6 s). Ours uses ceil, which also shows 1:00 at the start (hud.js:13).
- Difficulty: the HS arcade has no difficulty setting, only the opponent's stars (League has Amateur/Minor/Major). Our arcade also has none; there is a 6-step slider only in the hidden free match (bot.js:20-26).
- KICK OFF freeze is 2.17 s: ours 2.183, HS 2.163. **Measured**: kickoff.readyTime.
- The ball spawns 302 px up at the centre with vy 0 (constants.js:537). **Measured**, and passes.
- The restart ball drifts 138 px/s toward the side that conceded (constants.js:538). **Measured** in M3.
- The GOAL! banner lasts 2.05 s: ours 2.067. **Measured**.
- Play and kicking continue under the GOAL! banner, and no second goal counts (sim.js:1741). Matches the M4 note.
- The clock stops under the kickoff banner and through the goal restart (sim.js:282-292, sim.js:317).
- The gauge stops through the goal restart and runs through cut-ins (sim.js:276-278, 457). **Measured**.
- A knockout is cleared by the restart (sim.js:233). Matches M4 119.3 s.
- The player's gauge and arm carry over through goals (sim.js:223).
- Goals per match: 6.75 against HS's 8.67 (−22%, within tolerance).
- 5-star CPU per minute: touches 14.1 vs 17.4, jumps 31.5 vs 37.7, kicks 52 vs 45; goals 4.5 vs 4. All within tolerance.
- CPU power-shot delay: 5.4 s vs 6.2 (5-star) and 8.0 s vs 8.45 (weak). Within tolerance.
- Weak CPU: touches, jumps, kicks, depth and goals are all within tolerance (goals 3.75 vs 2.5, the edge of tolerance).
- The arcade ladder is strictly in order with a rising difficulty and star rating (0.5→5★). This matches HS's fixed arcade order.
- Online matches use the same 60 s rules with equal stats, and a bot takes over a seat when a player disconnects (server.js:117-135).

---

## UI / controls / HUD / screens audit vs real Head Soccer

Sources: frames pulled from hs-video/M4-gaps.mp4 (20 s, 26 s, 36.3–36.9 s, 84–92 s, 92.5–98.5 s, 117.3–120.5 s) and M1, the docs, and our own screenshots from `_hudshots.mjs` (844x390, 390x844). The frames are in scratchpad/fr/ and scratchpad/hud/.
HS game area in M4 is 1151x640 (1.8:1), with black bars on a 2.17:1 phone.

| Item | Real HS | Ours (file:line) | Gap | Severity | Confidence |
|---|---|---|---|---|---|
| Action-button order | Left to right: POWER, KICK, JUMP. JUMP is in the bottom-right corner. POWER appears in the slot left of KICK (M4 36.6 s, 117.8 s) | JUMP, KICK, POWER (index.html:233-235, flex row with ltr set at style.css:1818). POWER is in the corner | JUMP and KICK are swapped, and POWER takes JUMP's corner. A player's muscle memory breaks at once | High | High |
| KICK OFF banner | Pitch is not dimmed. Big gold-chrome italic "KICK OFF" on a dark band slides in from the right, a ball zooms in from the camera onto the centre spot, then the banner slides out to the left (M4 95–98 s) | The whole pitch is dimmed with #000000b0. Static 46px flat-yellow system-font text sits on the half-res canvas. On desktop a key-legend table is drawn over the pitch (game.js:2362-2402) | Dimming, look, motion and the missing ball fly-in | High | High |
| Pre-match VS intro | ~1–1.5 s before the HUD appears: two big heads face off with a gold "VS" lightning bolt on a red speed-streak band. Then the HUD and controls come in (M4 93.5–95 s) | beginLocal goes straight into the match with the HUD up (game.js:984-1006) | No intro at all | Med | High |
| GOAL! banner | Gold-chrome letters G-O-A-L-! fly in one by one from the right, hold, then drop out letter by letter. About 2 s, and play continues under it (M4 117.4–120 s) | One canvas text "GOAL!" in the scorer's blue or red with a scale pop, 64px -apple-system on the half-res canvas (game.js:2338-2360) | Look and animation | Med-High | High |
| Button shape and size | Wide, flat plaques, about 200x70 on a 1151x640 area: 17% of width and 11% of height, aspect about 2.9:1, slanted parallelogram ends. Arrows are about 185x70 with "L"/"R" on them and almost touch (M4 20 s) | Buttons are about 1:1. u = min(96, h*.2, w*.115) (game.js:1340), which gives 78x78 at 844x390 (20% of height, ~10% of width). Plaques are rounded rectangles (style.css:1945) | Twice as tall and half as wide as HS. Thumb targets and look both differ | Med | High |
| Pause | Gold circular pause button at the top right of the HUD (every in-match frame) | No pause. ✕ at the top left quits at once with no confirmation (game.js:1062). ⚙ opens the developer tuner with ~60 sliders while the match keeps running (game.js:2757) | No pause screen. One mis-tap loses the match, and players see a dev panel | Med-High | High |
| Power-gauge direction | Fills from the INNER end (by the flag) outward to the screen edge. Fixed ramp: green at the inner end, orange-red at the outer end (M4 26 s, 117.8 s) | p0 fills from the outer edge inward, with red at the scoreboard end (style.css:351-363) | Mirrored fill direction and colour ramp | Med | High |
| Low-time clock | Clock stays white through 0:07…0:01 (M4 84–91 s) | Clock turns red and pulses at ≤10 s (style.css:251, game.js:2666) | Extra effect HS doesn't have | Low-Med | High |
| Clock look | White digits with a dark outline under a dark "TIME" pill | Yellow digits, no label (style.css:240-248) | Look | Low | High |
| Result screen | Panel slides in from the right about 0.2 s after 0:00. Big gold "RESULT" title, green pitch card, two big heads (with the damage they took), flags + gold scores, "VS", "YOU WIN"/"W", points, and one NEXT MATCH button. No blur (M4 90.4–92 s) | Instant full-screen dark overlay with blur. Plain "ניצחת!/הפסדת" h2, small faces, the loser greyed, two buttons (game.js:1011-1031, style.css:2044-2055) | Layout, motion, title treatment | Med | High |
| Text banners on events | No text on tackles or restarts | "פגיעה!" on each of your tackles, "כדור חדש" on a ball reset, "מוות פתאומי" (game.js:1123,1137,1138) | Extra non-HS text | Low-Med | Med |
| Screen flow / main menu | Main menu with 8 modes (Arcade, Tournament, Survival, League, Head Cup, Death, Fight, Awaken; wiki) → PLAYER SELECT → match | Card album (#pick) comes first → a 2-mode screen → arcade board (index.html:16-162; SCREENS game.js:195). No title or main menu | Flow and mode count differ | Med | High |
| Result loser face | Loser's head fades to a black silhouette; "YOU WIN" is spelled out (M4 91.9–92.9 s) | Loser greyed (game.js:1029) | Treatment differs | Low | High |
| Pinch-zoom | None (native app) | touch-action: manipulation allows pinch (style.css:39). No gesture block, so a pinch on the pitch zooms the page in iOS Safari | Page can zoom mid-match | Low-Med | High (code) |
| Player select | Your hero reel on the left, the opponent on the right, flags, VS, match no., SPEED/KICK/JUMP/DASH/POWER/SURVIVAL bars, SHOP/PLAY (M4 3 s) | Arcade board copies it (index.html:102-162), but "you" is not a reel. You pick in the album first | Partial match | Low-Med | High |
| Resolution/DPI | Smooth HD sprites and text | Pitch canvas is half-res (PIXEL=2, 480 texels across) and upscaled pixelated (game.js:1238, style.css:122). KICK OFF, GOAL! and the stadium LED text render on it, so they come out blocky | Visibly pixelated compared with HS. The art team may own this decision | Med | High |
| Fonts | Heavy italic display face with a gold-chrome gradient and dark outline on every banner and title | HUD and canvas text use `-apple-system, Arial` 900 (game.js:2352,2370,2611). Menus use Rubik | Typography doesn't match | Med | High |
| Orientation | Landscape only | Portrait plays with a tiny pitch under a huge sky (hud/ip13-port-full.png). No rotate prompt | Needs a "rotate your phone" gate | Med | High |
| Fullscreen | App is full screen | No Fullscreen API, manifest or orientation lock (index.html:5-7). If the in-app WKWebView doesn't provide it, Safari's toolbars take height | Environment-dependent | Low-Med | Med |
| Letterbox | Black pillarbox bars. HUD stays inside the game area | Bars are painted sky/grass (game.js:1432-1469). HUD meters are pinned to the viewport edges, out over the bars | Cosmetic. Ours is arguably nicer | Low | High |
| POWER button on press | Flashes yellow, then fades out over ~0.15 s (M4 36.4–36.6 s) | Instant `visibility` toggle (style.css:1972-1977) | Small feedback gap | Low | High |
| Gauge shape / full state | Jagged lightning/flame bar labelled "POWER". Full = static fire gradient, no halo | Plain rectangle ("by request", style.css:326), pulsing glow halo + ⚡ at full (style.css:324,383) | Shape may be an owner decision. The halo pulse isn't HS | Low | High |
| YOU bubble | Purple bubble, yellow "YOU" | Bubble in the player's colour (game.js:2593-2615) | Colour | Low | High |
| style.css duplication | — | Lines ~391-1148 are duplicated at ~1261-2018 (758 identical lines). The later copy wins, so edits to the first copy silently do nothing | Maintenance trap (not player-facing) | Low | High |

### Verified after the first pass
- RESULT loser portrait (M4 91.9–92.9 s at 10 fps): the loser's head fades to a **black silhouette** about 0.7 s in, and "YOU WIN" is spelled out letter by letter under a small "YOU". Ours greys the loser (`.lost`, game.js:1029) and shows a static h2, so the Result row's gap stands.
- HS mode list (wiki, headsoccer.fandom.com/wiki/Game_Modes): Arcade, Tournament, Survival, League, Head Cup, Death, Fight, Awaken. Ours has Arcade + private-room multiplayer. The Screen-flow row is verified.
- VS intro + KICK OFF sequence confirmed a second time in M1 0–4 s (PLAYER SELECT → red-band VS heads → KICK OFF with the ball fly-in, HUD in).
- Pinch-zoom: `html, body { touch-action: manipulation }` (style.css:39) allows pinch-zoom. There's no gesturestart handler, and touches are only preventDefault()ed on the pad (game.js:690). iOS Safari ignores user-scalable=no, so a two-finger pinch on the pitch zooms the page. **Low-Med gap, High confidence (from the code).**
- Pause row: the footage only shows HS's pause button (every in-match frame). The row claims only the button, plus our lack of any pause. Menu contents are not claimed.

### Dropped (couldn't be verified from the footage, not claimed as gaps)
- Whether HS lets a finger slide from KICK onto JUMP. Ours treats it as a miss (game.js:607-611).
- Golden goal / draw handling: this is rules, not UI, so it's left to the rules auditor.

### Already matches
- Walk plate: rolling a thumb between ◀/▶ switches direction at once, with hysteresis and a generous reach (walkpad.js, game.js:670-715).
- Multitouch: tracked per touch identifier. preventDefault stops iOS loupe/long-press. Fingers release on blur/visibilitychange.
- POWER plaque shows only when the gauge is full and hides on the press (hud.js gaugeView, game.js:2693).
- Pressed buttons light up brighter, as HS's go yellow.
- Gauge empties on the press and refills from there (hud.js:27-29).
- Clock format is M:SS and counts from 1:00 (hud.js:12-16).
- The arrows are gold and the action plaques stone/gold, the same colour family as HS.
- Scores sit under each side's portrait, clock in the middle, gauges at the top outer edges. This is broadly the HS HUD layout.
- Ground line at ~77-83% of the height, with controls in the strip below it rather than over the players (game.js:1271-1285).
- The power cut-in has no text or banner, per docs/HS-POWER-SHOTS.md §2 (game.js:1116-1118).
- The YOU bubble shows only during kickoff.
- Keyboard: arrows/WASD, Space/↑ jump, ↓/S kick, J/Shift power. Auto-repeat is ignored, and the last-pressed direction wins.
- Safe-area insets are respected. The editor lets players move and resize buttons and set opacity (padlayout.js).

---

## Visual / animation / stage / VFX / audio audit: ours vs Head Soccer

Branch head-soccer-parity, working tree as of 2026-09-25. Reference frames were pulled from hs-video/M3-airdrop-full.mp4 (4.3 s kickoff, 11.2-12.8 s GOAL!, 92.8 s result) and M4-gaps.mp4 (29.98 s in-match, 117.4 s hurt plus goal), then compared with .shots/chars/*.png (today's build), .shots/arcade/*.png and public/img/chars/*/*.webp.

### Gaps

| Item | Real HS | Ours (file:line) | Gap | Severity | Confidence |
|---|---|---|---|---|---|
| Heads for most cards | Every player is a painted cartoon head | 4 of 180 cards (legendary 1-4) have a character (public/characters.js:24-29). The other 176 play a photo crop in a head-shaped clip with a CSS saturate/contrast filter (game.js:2510, style.css:149-155) | A real photo face on the pitch reads as a different game at once | High | High |
| Overall render style | Smooth painted cartoon art at about 480x320, upscaled soft. Gradient skies, clouds, soft edges | The pitch canvas renders at half resolution and upscales nearest-neighbour ("pixel art", game.js:1238, style.css:121-123). Stage code bans gradients on purpose ("16-bit", art-directions.js:30, stages.js:17) | Reads as SF2 / 16-bit pixel art, not HS. Blocky texels sit next to HD heads, bodies and VFX (#cvbody, #cvfx at device res, game.js:1310), so the picture mixes two pixel densities | High | High |
| Stages / backgrounds | A football stadium: tiered stands packed with cartoon fans, coloured tier bands, floodlights, blue sky and clouds (or night). Floor varies per stage (wood, pink, grass) | 11 backdrops, none a stadium: 7 SF2 homages (castle, harbor, market, airbase, jungle, temple, factory; stages.js:56-239) and 4 fantasy scenes (neon, reef, orbit, luna park; art-directions.js:151-888). Every one is pixel-art with a strip of 1-texel "crowd" | HS's defining setting is missing. No day/night stadium pair | High | High |
| GOAL! effect | Huge gold-chrome italic "GOAL!" with torn edges and a blue drop outline, about a third of the screen tall. The letters fly in one by one from the right, sweep across and leave left (about 2 s). No confetti, no dimming | A 64px system-font "GOAL!" in team colour, a scale pop, drawn on the half-res canvas (game.js:2337-2360). Plus a 60-piece confetti burst and a ring (game.js:810-818, fired from sim.js:1755) | The wrong look, the wrong motion, and confetti HS doesn't have. It shows on every goal | High | High |
| KICK OFF | Gold-chrome "KICK OFF" on a dark streak band, no dimming. A giant ball zooms in from the camera and drops onto the pitch. Purple "YOU" bubble | Pitch dimmed 70% black, system-font text, a table of key bindings (desktop) (game.js:2362-2410). On a new ball the ball just appears (game.js:2215; `ballDrop` is not handled anywhere) | Wrong look. The ball-zoom intro is missing | High | High |
| Power VFX breadth | Every character has its own distinct power look | 6 of 45 champion powers have their own renderer (vfx/powers/stage-01..06; 1-5 painted HQ, 6 path-drawn). The other 39, plus every non-arcade match, use the same comet recoloured per family (vfx/families.js:134-140) | Most power shots look alike. (Note: .shots/arcade shows stage-44 art, so this may exist on another branch, hs/45-powers-*, but not here) | High | High (on this branch) |
| Music | Continuous music under play. The M3 audio track has no silence longer than 1.5 s in 90 s, and a spectrogram of 18-28 s shows a steady beat and tonal lines | None. No audio files at all; everything is WebAudio synthesis (audio.js:1-10) | Silence under play | High | High |
| Crowd ambience | A continuous audio bed (the recording can't separate crowd from music) | Only a 1.8 s filtered-noise burst on a goal or a win (audio.js:96-114, 146-153). No loop | An empty-sounding stadium between goals | Med | Med |
| SFX character | Sampled sounds: a thumpy kick, a head "pok", a ball bounce, a whistle, a crowd cheer | Chiptune synth "SF2 vocabulary": square/saw sweeps and noise thuds (audio.js:118-158) | Sounds like a retro arcade game, not HS | Med | Med |
| Missing SFX | Ball bounce on the floor, post/crossbar clang, knockout/stun sounds, hit and ailment sounds, a sound for each power | No bounce event exists. `SFX.post` is defined but no sim event fires `post`. No sounds for `knockout`, `stunned`, `hurt`, `powerHit`, `ailment` or `ballDrop`. `synth()` (per-power sounds) is imported (game.js:15) but never called, so every power plays the same `powershot` (audio.js:131) | The ball hitting the floor or the woodwork is silent. Every power sounds alike | Med | High |
| Pitch floor | A perspective floor with full markings: centre circle, both penalty boxes and goal areas, touchline. Material changes per stage | Flat vertical mown stripes, a centre line and half an ellipse (game.js:1738-1750) | Plain; no penalty-box markings | Med | High |
| Hoardings | Static, varied ad boards (several sponsors per stage) | One looping SALTIZ/ראשים LED strip scrolling at 60 px/s (game.js:1717-1733) | Motion and uniformity HS doesn't have | Low | Med |
| Tackle / hit effect | No text and no ring. In M4 117 s a hurt shows only the red drop spray | A 150px expanding yellow ring (game.js:802, 1120) plus a "פגיעה!" text banner (game.js:1123). White spark bursts on every kick (sim.js:1248, 1313) | Big rings and text read as a fighting game. HS "has no words" (the project's own rule, game.js:1113) | Med | Med |
| Other text banners | None mid-play | "כדור חדש" on a ball reset, "מוות פתאומי" in golden goal (game.js:1136-1137), drawn in the system font | Different style from HS's chrome lettering | Low | Med |
| Result screen | Gold-chrome "RESULT" and "YOU LOSE/WIN" lettering, a green pitch panel, both heads (loser darkened) with flags, VS, points, a gold NEXT button | Plain Hebrew title, a score, two buttons. Heads are drawn and the loser is greyed (game.js:1011-1032), so that part matches | Chrome lettering and panel missing | Med | High |
| Crowd animation | A static painted crowd. In M3 11.0-12.3 s, through a goal, the fans are identical in every frame | Crowd sprites bob, redrawn at 12 Hz (game.js:1664); on the pixel stages other props animate too | Motion HS doesn't have, and at a choppy 12 Hz | Low | High |
| Ball rotation | (HS not measured frame by frame) | angle = spin·0.12 + x·0.012 (game.js:2236). True rolling for r=16.5 is x/16.5 = 0.06 rad/px, about 5x faster | Physically, the ball turns about 5x too slowly for its roll, so it looks like it slides | Low | Med (physics; not checked against HS) |
| Letterbox bars | Black side bars (every HS frame) | Bars painted in a sampled sky colour (paintLetterbox, game.js:1432-1440) | Cosmetic | Low | High |
| Docs drift | n/a | docs/CHARACTERS.md:87-99 says kick/hurt/happy/sad faces show; code always returns normal (characters.js:51-53); the endMatch comment says happy/sad but passes 'normal' (game.js:1024-1027). px-*.webp are built but unused (characters.js:43-46) | Stale docs; 20 dead assets | Low | High |
| style.css | n/a | The whole HUD block appears twice (e.g. @keyframes gaugeReady at :399 and :1269). Doubled in HEAD, not on main | Bloat; later rules silently override earlier ones | Low | High |
| Names | n/a | legendary-3 and legendary-4 are both named "Naveh" (characters.js:27-28); both folders are untracked | Possible copy-paste slip | Low | Med |

### Already matches HS (one line each)

- Head size and shape: box 1.17 x 1.07 of 2R (≈1.09:1) against HS's 62x57 (≈1.09:1); dome top, full cheeks, flat chin (game.js:2436-2453).
- Painted characters (legendary 1-4): cel-shaded flat tones, warm near-black keyline, gold rim, angry/determined eyes, hair breaking the outline, three-quarter view; HD portrait quality is at HS level.
- Faces stay normal in-match, including when hit or at a goal: HS does the same (M4 117 s, M3 11-13 s), and the red-nose bruise tiers copy HS's (game.js:2536-2544).
- Body: small black suit, team-colour collar, chunky boots with gold rim, no legs (body-art.js).
- Kick: the boot rides up to face height and holds, toe up, with a faint swoosh; keyframes taken from M4 frame by frame (game.js:2073-2094, 2147-2160).
- Run: feet paddle under a head that doesn't bob or lean; knockback tips head and body back about 25° (game.js:2121-2143).
- Ground shadow under players shrinks and fades with jump height (game.js:2096-2111).
- Dash afterimages, two fading copies (game.js:2176-2200).
- Power-shot press glow (yellow flame licks), the 1.34 s cut-in (darken, disc, halo, rays, background blur) and block grind / hit droplets / daze stars all follow HS (champ-vfx.js).
- Camera fixed, with HS's 487 px of sky; no screen shake except about 5 px on a blocked power (HIT_STOP_KICK and HIT_STOP_TACKLE = 0).
- Goals: white frame with mesh, drawn as a 3D box the players enter. The net is static, as in HS (M3 10.8-11.8 s: no ripple when the ball goes in).
- Sim at a fixed 60 Hz with vsync snapping; the foreground renders at 60 fps.
- Loser's result portrait greyed like HS's.
