# Head Soccer gap audit (2026-09-25)

Every place where our game is not exactly like real Head Soccer (HS). Duplicates found by more than one audit are merged.

**Severity:** H = a player notices within seconds, M = noticeable, L = small.
**Source:** **meas** = measured from HS footage (`docs/hs-reference.json`, `hs-estimates.json`, `hs-video/`), **wiki** = HS wiki, **know** = from knowledge (not measured).

Already decided, so not listed as gaps: no in-match items, HS-style power shots, HS stats in the arcade only, the custom sim, exact head size.

✅ = fixed on branch `hs/gap-fixes`. 🎥 = waiting for a new HS recording (Idan's rule: every feel number traces to a measurement). ❓ = needs Idan's decision. Parity was 82/88 at the audit; after stage 1 it is 87–88/88 (only `cpu.rangeConv` still wobbles at the edge of its tolerance).

At the audit, `node test-hs-parity.mjs` passed 82 of 88 rows. The 6 failures are the headers (×2), the goal-restart timing, the 5★ CPU's position, the 5★ CPU's touch rate, and the kick repeat rate.

---

## 1. Kicking and headers

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| K1 ✅ | H | Kicking a ball that's at your feet heads it up instead. The head check runs before the kick check, and the head's reach covers a ball resting 30–50 px out | `sim.js:574`, `HEADER_R` 16 `constants.js:332` | There is no header button; KICK always swings the leg | meas + probe |
| K2 ✅ | H | An aimed header is far too strong | 811 px/s, 547 px apex (off screen), `sim.js:1229-1230` | 626 px/s, 311 px apex (n=12) | meas |
| K3 ✅ | M | A header teleports the ball 40–60 px up in one frame | `sim.js:1242-1243` | No teleport | code |
| K4 ✅ | H | The kick is a fixed circle at ground height that stays live for the whole 0.26 s. A ball 70–90 px up in front is missed completely | `KICK_REACH` 62, `KICK_R` 22, `sim.js:1421-1491` | The boot is at knee height for ~2 frames, then ~51 px ahead and ~52 px up for the rest of the swing | meas (M4 frames) |
| K5 ✅ | M | Holding jump while kicking lobs, a modifier HS doesn't have. A jumping kick without it only peaks at 101 px | `sim.js:584`, `LOB_LIFT` 1.9 | A jump kick peaks around 340 px, with no modifier | 1 sample + know |
| K6 🎥 | M | A ground kick is probably too flat | 478 px/s at 32°, 57 px apex | Arcs higher | know (unmeasured) |
| K7 🎥 | M | A dash kick goes out as a flat 14° drive | `sim.js:1489` | "Up diagonally quickly" | wiki |
| K8 | L | The kick repeats slightly slower than HS | 0.367 s | 0.349 s | meas |
| K9 | L | Kick contact may reach too far | up to ~100 px from the body's centre | unmeasured | — |

## 2. Physics and movement

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| P1 ❓ | M | **Needs Idan:** `BODY_DEADEN` was Adam's explicit request ("the ball kinda stops and rolls"). HS bounces it. The body kills the ball instead of bouncing it | `BODY_DEADEN` 0.18 `constants.js:215`; walking into the ball pushes it at 228 px/s | Bounces off the chest and shins at roughly 390 px/s | wiki + Box2D |
| P2 ✅ | M | Walls and posts bounce too much | walls 0.86 `constants.js:81`, post 0.78 `sim.js:1163` | every measured surface is 0.63–0.79 (our crossbar is 0.67) | meas (other surfaces) |
| P3 ✅ | M | Air drag is too strong, so long balls land ~40 px short | 0.184/s `constants.js:78` | 0.099/s (17 M4 flights, IQR 0.095–0.105) | meas |
| P4 ✅ | H | A rolling ball stops far too soon | decays at 0.73/s: an 80 px/s ball stops after 111 px | 0.11–0.21/s: a roll lasted 6.6 s over 404 px | meas (n=2) |
| P5 ✅ | M | The speed cap is too low | 816 `constants.js:91` | ordinary touches reach 1001–1091 px/s (4 in M4) | meas |
| P7 ✅ | L | A ball left untouched for 6 s teleports to the centre | `sim.js:378-386`, `constants.js:513` | No such rule; none of the 4 clips show it | meas |
| P10 🎥 | L | The body box may be narrow | 28 px | ~35 px in the HS art | meas (art) |
| P9 ✅ | L | No smoothing between frames, so it judders on 90/144 Hz screens | — | — | code |

## 3. Powers, gauge and ailments

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| W1 ✂️ | M | **Scoped by Idan: only the first 5 champions' powers** (built and painted in the earlier HQ passes). Only 6 of 45 champion powers are built (stages 1–6); the other 39 fire their family's generic shot, drawn as one comet in different colours | `shared/champion-powers/`, `vfx/families.js:134` | Each character has its own shot and look | spec |
| W2 ✅ | M | Burn has the wrong effect | Blocks kicking and slows to 0.8× `hs-powers.js:591` | Reverses your walk | wiki |
| W3 ✅ | L | Freezes are too short | 1.2–2.1 s | 2–3 s | wiki |
| W4 ✅ | L | A frozen or dazed player can't arm their power | `sim.js:487` | Can still arm | wiki |
| W5 🎥 | L | The block window is probably too forgiving: the whole 0.26 s, and a head touch counts too | `hs-powers.js:430, 529` | unmeasured | — |
| W6 🎥 | L | 7 of the 11 families' speeds and paths are guesses, and Critical flies faster (2795 px/s) than anything filmed | — | Only Straight, Aerial and Grab were filmed | meas |
| W7 ✅ | L | Korea's shot is 8% slow | 1978 px/s | 2150 | meas |
| W8 ❓ | L | Online, stages 1–6 fire their family's shot, not the champion's own power | — | — | code |
| W9 🎥 | L | Critical is a fixed family | — | A random trigger with a cutscene | know |
| W10 ✅ | L | A block pushes the defender back 32 px | — | "A few px" | meas |
| W11 ✅ | L | An armed player's boot doesn't counter an incoming power shot (only the head or body does) | — | — | code |

## 4. Rules, flow, modes and CPU

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| R1 ✅ | H | No pause. ✕ quits the match at once with no confirm, and ⚙ opens the developer tuner (~60 sliders) while play continues | `game.js:1062, 2757`, `index.html:249` | A gold pause button at the top right opens resume/retry/quit | meas + know |
| R2 ✅ | M | The goal restart is ~0.8 s too slow. `GOAL_RESUME` is defined but never used, and there's no short hold on the kickoff spots | Ball lands at 3.58 s `constants.js:530` | Players move at 2.24 s, the ball drops at 2.795 s | meas |
| R3 ✅ | M | Sudden death doesn't restart play; it only sets a flag | `sim.js:321` | Red wipe and banner, both players reset, the ball drops at the centre ~2.5 s later | meas (M2) |
| R4 ✅ | M | The clock stops during power cut-ins, so matches run 5–11 s long | `sim.js:262-280` | The clock keeps ticking | meas (M4) |
| R5 ✅ | M | The 5★ CPU plays too far forward, from a fixed waiting spot | 511 px avg, `bot.js:445` | 427 px | meas |
| R6 ⏳ | M | **Still open** (0.46–0.51; two tuning tries either did nothing or flattened the difficulty ladder, so they were reverted). The 5★ CPU lets too many balls go | plays 49% of balls in reach | 70% | meas |
| R7 | M | Missing modes | Arcade (45 stages) + private online rooms only | Tournament, League, Survival, Head Cup, Death Mode, Fight, 2P on one device | wiki |
| R8 | M | No points economy | — | 100 pts for the first win, 50 after; some modes cost 5,000 to enter | wiki |
| R9 | M | No stat upgrades | Base stats forever | 5 stats × 10 levels, 500–256,000 points per step | wiki |
| R10 | L | Arcade progress is one counter shared by every card | `arcade.js:4` | Per character | wiki |
| R11 | L | No costumes and no achievements (card unlocks may be a deliberate product choice) | — | Yes | wiki |
| R12 🎥 | L | The CPU is never fooled by delayed shots, because it reads the power ball's real path | `bot.js:189` | Jumps too early | know |
| R13 ✅ | L | The weak CPU dashes too rarely | 0.4/min | 2.2/min | meas |
| R14 ✅ | L | The clock pause after a goal is tied to the wrong moment; once R2 is fixed, the clock must stay stopped until the ball drops | — | Stopped until the drop (3.0–3.8 s) | meas |
| R15 ✅ | L | The comment at `sim.js:1760` is wrong: the code does give the conceding side the gauge bonus | — | — | code |

## 5. Controls, HUD and screens

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| U1 ✅ | H | The action buttons are in the wrong order. Checked on a screenshot | JUMP, KICK (POWER) | POWER, KICK, JUMP, with JUMP in the corner | meas |
| U2 ✅ | H | KICK OFF is wrong. Ours dims the pitch 70%, uses flat system-font text, and shows a key-binding table (also on phones). The ball just appears (`ballDrop` isn't handled) | `game.js:2362-2402` | No dim; gold-chrome KICK OFF slides in and out; a giant ball flies in from the camera | meas |
| U3 ✅ | H | GOAL! is wrong: a 64 px system font with a pop and 60 pieces of confetti | `game.js:2337-2360, 810` | Huge gold-chrome letters fly in one by one, sweep across and drop out; no confetti | meas |
| U4 ✅ | M | No VS intro | Cuts straight to the match `game.js:984` | ~1.5 s of both heads with a gold VS on a red band | meas |
| U5 ✅ | M | Buttons are the wrong shape: ~1:1 squares | 78×78 `game.js:1340` | Wide ~3:1 plaques, ~17% of the width × 11% of the height | meas |
| U6 ✅ | M | The gauge fills backwards | From the screen edge inward, red next to the score `style.css:351-363` | From the flag outward, green → red | meas |
| U7 ✅❓ | M | Gold RESULT + spelled YOU WIN/LOSE + slide-in done. **Loser portrait left as is: the two audits disagree** (black silhouette vs dark grey with readable features; the code's own note says the latter). The result screen differs | Instant blur, plain text | A panel slides in; gold RESULT, YOU WIN spelled letter by letter, loser as a black silhouette, one NEXT MATCH button | meas |
| U8 | M | The menu flow differs | Card album → 2 modes → arcade board | Title → main menu (8 modes) → PLAYER SELECT → match | wiki |
| U9 ✅ | M | Wrong fonts: `-apple-system`/Arial everywhere | — | A gold-chrome italic display face | meas |
| U10 ✅ | M | Portrait mode is playable (tiny pitch, no rotate prompt) | — | Landscape only | know |
| U11 ✅ | L | The clock turns red and pulses at ≤10 s; it's yellow, with no TIME pill | `style.css:251` | White digits under a dark "TIME" label, white to the end | meas |
| U12 ✅ | L | Extra text HS doesn't have: "פגיעה!" with a yellow ring on each tackle, "כדור חדש", "מוות פתאומי", sparks on every kick | `game.js:1120-1138` | None (a hurt is only a red spray) | meas |
| U13 ✅ | L | Pinch-zoom isn't blocked | `touch-action: manipulation` `style.css:39` | — | code |
| U14 ✅ | L | No fullscreen, manifest or orientation lock | — | — | code |
| U15 ✅ | L | The POWER button vanishes instantly when pressed | — | Flashes yellow, fades over ~0.15 s | meas |
| U16 ✅ | L | The gauge glows when full | — | No glow | meas |
| U17 ✅ | L | The YOU bubble is the player's colour | — | Purple | meas |
| U18 ✅ | L | The side bars are sky-coloured and the meters stick out over them | — | Black | meas |

## 6. Visuals, animation and audio

| # | Sev | Gap | Ours | HS | Source |
|---|---|---|---|---|---|
| V1 | H | Only 4 of 180 characters have HS-style art; the other 176 are photo crops | `characters.js:24-29`, `game.js:2510` | All are painted cartoons | meas |
| V2 | H | The pitch renders at half resolution as pixel art, with gradients banned on purpose. The HD heads and effects on top give the picture two different sharpness levels | `PIXEL=2` `game.js:1238`, `art-directions.js:30` | Smooth painted HD | meas |
| V3 | H | No stadium: all 11 backdrops are fantasy pixel scenes | `stages.js` | Packed stands, floodlights, day or night, a floor that changes per stage | meas |
| V4 | H | No music: the game has no audio files at all | — | Continuous music with a steady beat | meas (audio) |
| V5 | M | No crowd ambience; only a 1.8 s noise burst on a goal | `audio.js:96` | Ambient crowd sound | meas |
| V6 | M | All sound is chiptune synth | `audio.js:118-158` | Sampled sounds | meas |
| V7 | M | Missing sounds: no floor bounce (no event exists), `SFX.post` is never fired, no sound for knockout, stun, hurt, power hit or ailments, and `synth()` (per-power sounds) is never called | `audio.js` | All present | meas |
| V8 | M | Flat pitch floor: stripes, a centre line, half a circle | `game.js:1738` | Perspective floor with penalty boxes | meas |
| V9 | L | The crowd bobs, redrawn 12 times a second | — | Completely still | meas |
| V10 | L | The ad boards scroll one repeated SALTIZ strip | — | Still and varied | meas |
| V11 ✅ | L | The ball turns ~5× too slowly for how fast it moves | `game.js:2236` | Rolls properly | physics |
| V12 | L | The 20 small pitch sprites (`px-*.webp`) are built but never used; `CHARACTERS.md` wrongly says the characters change expression | — | — | code |

## 7. Code hygiene found on the way

- `style.css` has ~758 lines duplicated (roughly 391–1148 repeated at 1261–2018). The later copy wins, so edits to the first copy silently do nothing. **Fix this before any UI work.**

## Already matches HS (don't touch)

- **Walking and jumping:** walk speed, jump, gravity, and the passive head bounce (747 vs 717).
- **The power system:** gauge fill rate, the conceder's bonus, the cut-in, arming, counters, blocks, and the Straight, Aerial and Grab shots.
- **Match rules:** the 60 s clock, the 2.17 s KICK OFF freeze, the restart ball's spawn height and drift, the 2.05 s GOAL banner, and sudden death's bars and first-goal-wins rule.
- **Arcade and CPU:** the ladder's order and difficulty curve, and most CPU numbers.
- **Controls:** sliding between the walk arrows, multitouch, POWER showing only when the gauge is full, and the HUD's overall layout.
- **Look:** head size, the painted character quality, faces staying on the normal expression (HS does too), shadows, the dash trail, the power-armed glow, the fixed camera, the static net, and 60 fps.

## Suggested fix order

1. **Quick wins that fix the feel (small code):** K1, K2, K3, U1, R1, R2+R14, R3, R4, P2, P6, P7, U12, U13, the CSS duplication, and R15.
2. **Kick rework:** K4, K5, K7, P1, then re-tune against the parity test.
3. **Presentation:** U2, U3, U4, U6, U7, U9, U11, U15–U18, and U5 (with the fonts and gold-chrome letters).
4. **CPU:** R5, R6, R12, R13.
5. **Audio:** V4, V5, V6, V7.
6. **Art (big):** V2 (HD painted pitch), V3 (stadium), V8, V9–V11, V1 (176 characters), and W1 (39 powers).
7. **Content and meta (big product decisions):** R7, R8, R9, R10, R11, U8, U10, U14.
8. **Needs a new HS recording to settle:** K6, K9, P3, P4, P8, W5, W6 (ground and jump kick speed and angle, wall and bar bounce, rolling slowdown, air drag, dash in mid-air, the block window).

Full per-area tables with evidence, probes and file:line are in [HS-GAP-AUDIT-FULL.md](HS-GAP-AUDIT-FULL.md).
