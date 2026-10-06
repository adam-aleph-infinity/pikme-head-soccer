# HS stats: levels 0–10, Arcade Points, upgrades

Head Soccer gives every player five stats: speed, jump, kick, dash and power. Each runs from level 0 (a new account) to level 10 (max). Points earned in the arcade buy the levels.

Code:
- `shared/hs-powers.js`: `LEVEL_MULT`, `statsFor` and `meterRateFor`.
- `shared/upgrades.js`: points, prices and the save.
- `docs/hs-champion-map.json`: the CPU levels.
- `test-stats.mjs`: the tests.

## Level 0 is HS's base, measured

`hs-video/M12-base-stats.mp4` (2026-10-06) is Korea vs Korea, with both players on base stats. The numbers are in `docs/hs-clips/M12-base-stats.json`, and `M13-base-kicks.mp4` confirmed the run speed. The constants in `shared/constants.js` *are* level 0.

| | HS level 0 (M12) | Ours, through the same detectors |
|---|---|---|
| Run | 195 px/s (air 210) | 195 (air 210) |
| Jump | 39.3 px, 0.74 s in the air | 39.2 px, 0.73 s |
| Dash | 4 frames at 28 px = 112 px | 4 ticks at 1680 px/s = 112 px |
| Power bar full | 18.5 s; fills on time only | 18.5 s |
| Kick | not measurable (2 clean kicks, M12 + M13) | unchanged |

Before this, the base was Idan's account with about 3 bars bought, measured on M4: run 228, jump 46 px, dash 149 px, power bar 15 s.

## The curve (from the clips, 2026-10-06)

The curve was first ×2.75 on every stat at level 10, taken from the wiki. The clips measured much less, so each stat now takes an even step a level, fitted to level 0 (M12), Idan's 3 bars (M7) and level 8 (M14). M14 came from another phone. Its run, jump and power agree with M12's phone, checked on the same CPU's run, power bar and gravity, but its 120 fps dash does not, so the dash comes from M7's 4 bars.

| L | Speed / kick × | Run px/s | Jump × | Jump px | Dash × | Dash px | Power × | Bar full |
|---|---|---|---|---|---|---|---|---|
| 0 | 1.00 | 195 | 1.00 | 39 | 1.00 | 112 | 1.00 | 18.5 s |
| 1 | 1.075 | 210 | 1.065 | 42 | 1.045 | 117 | 1.175 | 15.7 s |
| 2 | 1.15 | 224 | 1.13 | 44 | 1.09 | 122 | 1.35 | 13.7 s |
| 3 | 1.225 | 239 | 1.195 | 47 | 1.135 | 127 | 1.525 | 12.1 s |
| 4 | 1.30 | 254 | 1.26 | 50 | 1.18 | 132 | 1.70 | 10.9 s |
| 5 | 1.375 | 268 | 1.325 | 52 | 1.225 | 137 | 1.875 | 9.9 s |
| 6 | 1.45 | 283 | 1.39 | 55 | 1.27 | 142 | 2.05 | 9.0 s |
| 7 | 1.525 | 297 | 1.455 | 57 | 1.315 | 147 | 2.225 | 8.3 s |
| 8 | 1.60 | 312 | 1.52 | 60 | 1.36 | 152 | 2.40 | 7.7 s |
| 9 | 1.675 | 327 | 1.585 | 62 | 1.405 | 157 | 2.575 | 7.2 s |
| 10 | 1.75 | 341 | 1.65 | 65 | 1.45 | 162 | 2.75 | 6.7 s |

Against the clips:
- **Speed:** level 3 measured ×1.24, level 8 ×1.59.
- **Jump:** level 3 ×1.17, level 8 ×1.54.
- **Power:** level 3 ×1.51, level 8 ×2.53. The top is held at 2.75 (Idan): the clips' ~2.9 felt too fast.
- **Dash:** level 4 went 132 px.
- **Kick:** not measurable yet, so it follows speed.

How each stat applies its multiplier:
- **Speed:** run and air speed.
- **Jump:** the jump's height, so take-off speed rises by √×.
- **Kick:** the boot's drive.
- **Dash:** the dash's speed over the same 4 ticks, so it goes as much further.
- **Power:** the bar's fill rate.

Our sim through the same detectors lands on the table: level 8 runs 312 px/s, jumps 59.6 px, dashes 152 px and fills the bar in 7.7 s.

**Still to confirm:** a clip on M12's phone at level 8, with about 10 dashes from standing, running kicks at a still ball, and the power bar filling once.

A ball touched by a dash still travels no faster than a level-0 dash could send it (sim.js, `DASH_BALL_CAP` over the dash stat).


## Who is on which level

**The player:** one set of five levels for every card, starting at 0. It applies in the arcade only. Online and 2-player play everyone on level 0.

**Arcade CPUs:**
- Champion n is on level n for speed, jump, kick and dash: level 1 at stage 1 (0.5★), up to level 10 at stage 10 (5★) and every stage after.
- Power is held low, as HS's "safeguard": level 1 for stages 1–5, 2 for 6–9, 3 for 10–23 and 4 from stage 24 (Asura) on.
- Stars are still how smart the CPU plays, and nothing else.

## Points and prices

- **Pay:** a win over champion n pays 100 × n points (stage 1 = 100 … stage 45 = 4,500), replays included. A loss pays nothing. Only the arcade pays.
- **Prices:** level L costs 500 × 2^(L−1): 500, 1,000, 2,000 … 256,000. Taking one stat from 0 to 10 costs 511,500.
- **Save:** the key is `hs.stats.v1`, holding `{ v, points, lv: { speed, jump, kick, dash, power } }`.
- **Dev only:** on a dev machine or the local network, `?points=N` and `?resetstats` work.

## The CPU brain on a level-10 body

The bot was tuned on a 195–260 px/s body. At 536 px/s it played worse than at level 5. These are bot-vs-bot results for the five-star brain against the reference bot, 60 matches each, in goals a match:

| Body | Before the fixes | After |
|---|---|---|
| L0 | +0.67 | +0.67 |
| L5 | +1.32 | +1.32 |
| L10 | −0.85 | about +0.3 to +0.5 |

The fixes in `shared/bot.js` touch only an upgraded body, so level-0 play is bit-for-bit the same:
- **Over the ball, not through it (`chase`/`overTheBall`/`holdShort`):** running home behind a ball, it jumps over the ball when it can clear it, and otherwise holds short instead of running into it. This counts in open play and when denying an armed opponent.
- **An early release of an arrow:** the 0.2 s minimum press was 107 px at 536 px/s. The arrow then stays off for the dash window.
- **Headers and hops only for a ball in front of the head:** a 108 px jump's crown comes up so fast that a ball met behind it is fired back over the shoulder into its own goal.

The sim also sub-steps the ball for a body faster than the base dash (sim.js), so a level-10 dash can't pass through a ball.

Ladder (`test-arcade`), against the reference bot: stages 1–3 −1.13, tier 5 +0.31, and stage 45 vs stage 1 219 : 61. Open: the five-star brain still gets less out of a level-10 body than out of level 5.

## Level 8, measured (M14, 2026-10-06)

`hs-video/M14-level8.mp4` is Idan on level 8 against the stage-1 Korea CPU. The numbers are in `docs/hs-clips/M14-level8-stats.json`. Both clips were read with the same body tracker.

| | Level 0 (M12) | Level 8 (M14) | × |
|---|---|---|---|
| Run px/s | 197 | 314 | 1.59 |
| Jump height (feet) | 42.3 | 65.2 | 1.54 |
| Jump airtime | 0.76 s | 0.95 s | 1.25 |
| Dash | 112 px in 67 ms | 112–117 px in 50 ms | distance 1.0, speed 1.33 |
| Power bar | 8.8 px/s (18.5 s) | 22.3 px/s (7.5 s) | 2.53 |

At level 8 our curve has ×2.25 for everything. In HS, speed and jump are about ×1.55, power about ×2.5, and the dash covers the same ground, only quicker. With Idan's 3-bar numbers this looks linear: about +7%/level for speed and jump height, and +19%/level for power.
