# Head Soccer champion map — Phase D draft (for approval)

_Draft for Idan to approve before any code changes. The same data is in `docs/hs-champion-map.json` (checked by `test-hs-champion-map.mjs`). Nothing in the game reads it yet._

Ids, titles, tiers and stages stay exactly as they are in `shared/champions.js`, so `hs.arcade.v1` progress survives. Each champion gets one of Head Soccer's 11 power-shot families, picked by the theme of its current power, plus an optional ailment on the player it hits, an arming aura, five 1–10 stats and a 0.5–5 star rating for its CPU.

**How to read it.** *Family* = how the ball flies (see [Power Shots](https://headsoccer.wiki.gg/wiki/Power_Shots)). *Ailment* = what happens to the player the shot hits (— = nothing beyond the family's own effect). *Aura* = what pressing POWER does to an opponent standing close by. *Stats* are speed / jump / kick / dash / power. The stat total climbs from 12 (stage 1) to 45 (stage 45) of a possible 50; each champion's spread follows its theme (profile in brackets). *Stars* climb 0.5 → 5.

## The 45 champions

| # | Tier | Champion | Current power | → HS family | Ailment | Aura | Stats S/J/K/D/P (Σ) | ★ | Why |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 שכונה | התותחן | 💥 תותח (`cannon`) | **Destructive** | — | none | 2/2/3/2/3 (12) _power_ | 0.5 | A cannonball: straight and heavy, the blocker is knocked back — HS Destructive in its plainest form. |
| 2 | 1 שכונה | אדון התולעים | 🪱 תולעים (`tentacles`) | **Grab** | shock | none | 3/3/2/3/2 (13) _tricky_ | 0.5 | Worms wrap the legs and pull — a Grab; the current slow/no-jump effect is exactly the shock ailment. |
| 3 | 1 שכונה | השף הבוער | 🔥 מנגל בוער (`blaze`) | **Straight Line** | burn | none | 2/2/4/2/4 (14) _kicker_ | 0.5 | Fireball down a straight line; the blocker burns, as the current blaze already does. |
| 4 | 1 שכונה | מלך הבוץ | 🟤 בוץ (`mud`) | **Ground** | shock | none | 2/3/3/2/4 (14) _tank_ | 1 | A mud ball that rolls along the turf; being stuck in the bog = shock (slow, no jump). |
| 5 | 1 שכונה | בונה החומות | 🧱 חומת שער (`goalwall`) | **Ground** | — | none | 2/4/3/2/4 (15) _tank_ | 1 | A brick wall slides along the ground: can only be countered, never deflected. |
| 6 | 1 שכונה | איל ההון | 🪙 גשם מטבעות (`coins`) | **Multi-Ball** | — | none | 4/3/3/3/3 (16) _balanced_ | 1 | Coin shower becomes a few coin-balls, any of which may score (light early version). |
| 7 | 1 שכונה | הקפצן | 🌀 קפיץ (`spring`) | **Aerial** | — | none | 3/5/3/3/3 (17) _jumper_ | 1 | Pogo spring: the shot boings up in a high arc. |
| 8 | 1 שכונה | האיש המגנטי | 🧲 מגנט (`magnet`) | **Straight Line** | — | none | 3/2/5/2/5 (17) _kicker_ | 1 | Magnet-true: the ball flies dead straight at the goal as if on a rail. |
| 9 | 1 שכונה | גולש הגלים | 🌊 גל אדום (`wave`) | **Up-and-Down** | — | none | 4/4/4/3/3 (18) _balanced_ | 1.5 | The current red wave already rises and falls — the textbook Up-and-Down. |
| 10 | 2 ליגה | הענק | 🗿 ראש ענק (`giant`) | **Downward Slanting** | — | none | 3/4/4/3/5 (19) _tank_ | 1.5 | A giant heads it down from above — Downward Slanting. |
| 11 | 2 ליגה | המכווץ | 🔻 מכווץ (`shrink`) | **Ailment** | beheaded | none | 5/4/3/4/4 (20) _tricky_ | 1.5 | Shrinking the head, taken to its end: the hit player is briefly beheaded. |
| 12 | 2 ליגה | האסטרונאוט | 🌙 ירח (`lowgrav`) | **Aerial** | — | none | 4/6/4/3/3 (20) _jumper_ | 1.5 | Moon gravity: the ball floats up in a long, slow arc. |
| 13 | 2 ליגה | המטפס | 🚀 טיל עולה (`rising`) | **Ground** | — | none | 4/3/6/3/5 (21) _kicker_ | 1.5 | The rocket lands on the grass first and skims in low. |
| 14 | 2 ליגה | נהג המרוצים | ⚡ טורבו (`turbo`) | **Straight Line** | — | none | 6/4/3/6/3 (22) _fast_ | 2 | Turbo: the fastest plain straight shot of the early game. |
| 15 | 2 ליגה | מרים המשקולות | 🏋️ משקולות (`heavy`) | **Downward Slanting** | shock | none | 3/3/6/3/8 (23) _power_ | 2 | A weight drops at a slant; whoever it hits is heavy (shock). |
| 16 | 2 ליגה | מקפיץ האבנים | 🪨 אבן מקפצת (`skip`) | **Ground** | — | none | 4/3/7/3/6 (23) _kicker_ | 2 | A skipping stone along the turf — low, grounded, counter-only. |
| 17 | 2 ליגה | רוכב הסערה | 🌬️ סופה (`wind`) | **Straight Line** | — | push | 7/4/4/6/3 (24) _fast_ | 2 | Storm wind: a straight gust, and arming pushes the opponent away. |
| 18 | 2 ליגה | הסטרייקר | ⚡ סטרייק (`strike`) | **Destructive** | stars | stun | 4/3/8/3/7 (25) _kicker_ | 2 | The strike already paralyses the blocker: knockback + stars; the arm aura stuns. |
| 19 | 3 נבחרת | הג'וקר | 🔄 בלבול (`reverse`) | **Ailment** | reverse | reverse | 7/5/4/5/5 (26) _tricky_ | 2.5 | The joker: controls flip (???) on hit, and on arming. |
| 20 | 3 נבחרת | איש השלג | ❄️ הקפאה (`freeze`) | **Ailment** | freeze | freeze | 7/5/4/5/5 (26) _tricky_ | 2.5 | Snowman: the hit player freezes; arming freezes anyone close. |
| 21 | 3 נבחרת | צייד המטאורים | ☄️ מטאור (`meteor`) | **Downward Slanting** | burn | none | 5/9/5/3/5 (27) _jumper_ | 2.5 | A meteor dives down into the goal and burns on impact. |
| 22 | 3 נבחרת | הגנב | 🫳 גניבת כוח (`drain`) | **Ailment** | shock | none | 7/6/4/6/5 (28) _tricky_ | 2.5 | Power drain as an ailment: the hit player is sapped (shock). |
| 23 | 3 נבחרת | רעם האדמה | 🌋 רעידת אדמה (`quake`) | **Destructive** | stars | push | 4/4/7/4/10 (29) _power_ | 3 | Earthquake: the blocker is thrown and sees stars; arming shakes the ground (push). |
| 24 | 3 נבחרת | האקרובט | 🤸 טרמפולינה (`trampoline`) | **Up-and-Down** | — | none | 5/10/5/4/5 (29) _jumper_ | 3 | Trampoline bounces: a wavy up-down flight. |
| 25 | 3 נבחרת | המטעה | ⏯️ עצור וסע (`stutter`) | **Delay** | — | none | 5/4/9/4/8 (30) _kicker_ | 3 | Stop-and-go is already a Delay shot: freeze mid-air, then burst on. |
| 26 | 3 נבחרת | המחליק | 🧊 רצפת קרח (`ice`) | **Ground** | freeze | none | 9/5/5/9/3 (31) _fast_ | 3 | An ice puck sliding on the floor; whoever touches it freezes. |
| 27 | 3 נבחרת | שומר הפורטל | 🌀 פורטל (`portal`) | **Delay** | — | none | 8/7/5/6/6 (32) _tricky_ | 3 | The ball enters a portal, hangs, and comes out still flying — a Delay. |
| 28 | 4 אלופים | זורק הבומרנג | 🪃 בומרנג (`boomerang`) | **Aerial** | — | none | 5/4/10/4/9 (32) _kicker_ | 3.5 | Boomerang: a high arcing loop back into the goal. |
| 29 | 4 אלופים | הכורה | 🔩 מקדחה (`drill`) | **Destructive** | — | push | 5/5/8/5/10 (33) _power_ | 3.5 | The drill bores through the first blocker, knocking him aside. |
| 30 | 4 אלופים | אדון המשיכה | 🥅 מגנט שער (`goalmagnet`) | **Downward Slanting** | — | none | 6/5/10/4/9 (34) _kicker_ | 3.5 | The goal magnet pulls the ball down into the net at a slant. |
| 31 | 4 אלופים | השואב | 🌪️ שאיבה (`keeperpull`) | **Grab** | — | push | 5/5/10/5/10 (35) _power_ | 3.5 | The vacuum already drags the keeper around — now it drags him into his own goal. |
| 32 | 4 אלופים | הרוזן האפל | 🧛 ערפד (`vampire`) | **Grab** | burn | stun | 9/7/5/7/7 (35) _tricky_ | 3.5 | The vampire bites the blocker and drags him in; drained health = burn. |
| 33 | 4 אלופים | רגל הזהב | 👟 בעיטת על (`superboot`) | **Critical** | — | push | 6/5/10/5/10 (36) _kicker_ | 4 | Golden boot: the faster, harder-to-counter shot — Critical. |
| 34 | 4 אלופים | אמן הצמר | 🧶 נעלי צמר (`woolshoes`) | **Aerial** | shock | none | 8/8/7/7/7 (37) _balanced_ | 4 | A soft woolly lob; whoever touches it goes limp (shock). |
| 35 | 4 אלופים | הנווט | 🎯 טיל מונחה (`homing`) | **Critical** | — | none | 8/5/10/5/10 (38) _kicker_ | 4 | Guided missile: locks onto the open corner — Critical. |
| 36 | 4 אלופים | הופך העולמות | 🙃 היפוך כבידה (`gravflip`) | **Up-and-Down** | reverse | reverse | 8/10/8/5/7 (38) _jumper_ | 4 | Gravity flip: the ball falls up and back down, and the world turns upside down (???). |
| 37 | 5 אגדות | אדון המראות | 🪞 מראה (`mirror`) | **Critical** | reverse | reverse | 8/8/8/8/7 (39) _balanced_ | 4 | The mirror returns everything reversed: a Critical that leaves ??? on the blocker. |
| 38 | 5 אגדות | המשגר | 🛸 שיגור (`teleport`) | **Critical** | — | stun | 10/8/7/10/5 (40) _fast_ | 4.5 | Teleport: the ball blinks to the goal mouth — the hardest to counter. |
| 39 | 5 אגדות | מלך הכדרור | 🍯 דבק (`carry`) | **Grab** | — | push | 10/8/8/10/5 (41) _fast_ | 4.5 | Glue: the ball sticks to the blocker and carries him into the goal. |
| 40 | 5 אגדות | רוח הרפאים | 👻 רוח רפאים (`phantom`) | **Multi-Ball** | — | stun | 10/8/8/10/5 (41) _fast_ | 4.5 | Phantom: ghost balls fly alongside the real one, and any may score. |
| 41 | 5 אגדות | שומר הזמן | 🐢 הילוך איטי (`timeslow`) | **Delay** | shock | freeze | 10/9/7/8/8 (42) _tricky_ | 4.5 | Slow motion: the ball hangs mid-air; the hit player stays slow (shock). |
| 42 | 5 אגדות | התאום | 👥 שכפול (`clone`) | **Multi-Ball** | — | push | 9/9/9/8/8 (43) _balanced_ | 4.5 | The twin kicks a second ball at the same time. |
| 43 | 5 אגדות | המפצל | 🔱 פיצול (`split`) | **Multi-Ball** | — | stun | 10/7/10/7/10 (44) _kicker_ | 5 | The split shot is already three balls — full Multi-Ball. |
| 44 | 5 אגדות | עין הסערה | 🌪 טורנדו (`tornado`) | **Up-and-Down** | stars | push | 8/8/10/8/10 (44) _power_ | 5 | The tornado carries the ball up and down across the pitch and throws the opponent (stars). |
| 45 | 5 אגדות | אדון הזמן | ⏱️ עצירת זמן (`timestop`) | **Delay** | freeze | freeze | 9/9/9/9/9 (45) _balanced_ | 5 | Time stop: ball and opponent freeze, then the shot resumes — the final Delay. |

## Summary

### Per family

| Family | Count | Stages | Tiers 1–2 | Tier 5 |
|---|---|---|---|---|
| Straight Line | 4 | 3, 8, 14, 17 | 4 | 0 |
| Ground | 5 | 4, 5, 13, 16, 26 | 4 | 0 |
| Downward Slanting | 4 | 10, 15, 21, 30 | 2 | 0 |
| Destructive | 4 | 1, 18, 23, 29 | 2 | 0 |
| Aerial | 4 | 7, 12, 28, 34 | 2 | 0 |
| Delay | 4 | 25, 27, 41, 45 | 0 | 2 |
| Grab | 4 | 2, 31, 32, 39 | 1 | 1 |
| Multi-Ball | 4 | 6, 40, 42, 43 | 1 | 3 |
| Up-and-Down | 4 | 9, 24, 36, 44 | 1 | 1 |
| Ailment | 4 | 11, 19, 20, 22 | 1 | 0 |
| Critical | 4 | 33, 35, 37, 38 | 0 | 2 |

### Per tier

| Tier | Families | Auras not none | Ailments |
|---|---|---|---|
| 1 שכונה | Destructive ×1, Grab ×1, Straight Line ×2, Ground ×2, Multi-Ball ×1, Aerial ×1, Up-and-Down ×1 | 0/9 | 3/9 |
| 2 ליגה | Downward Slanting ×2, Ailment ×1, Aerial ×1, Ground ×2, Straight Line ×2, Destructive ×1 | 2/9 | 3/9 |
| 3 נבחרת | Ailment ×3, Downward Slanting ×1, Destructive ×1, Up-and-Down ×1, Delay ×2, Ground ×1 | 3/9 | 6/9 |
| 4 אלופים | Aerial ×2, Destructive ×1, Downward Slanting ×1, Grab ×2, Critical ×2, Up-and-Down ×1 | 5/9 | 3/9 |
| 5 אגדות | Critical ×2, Grab ×1, Multi-Ball ×3, Delay ×2, Up-and-Down ×1 | 9/9 | 4/9 |

### Stat total and stars per stage

Total = round(12 + 0.75·(stage−1)); stars = 0.5 + 4.5·(stage−1)/44, rounded to the nearest half star.

- Tier 1: 1→12 (0.5★), 2→13 (0.5★), 3→14 (0.5★), 4→14 (1★), 5→15 (1★), 6→16 (1★), 7→17 (1★), 8→17 (1★), 9→18 (1.5★)
- Tier 2: 10→19 (1.5★), 11→20 (1.5★), 12→20 (1.5★), 13→21 (1.5★), 14→22 (2★), 15→23 (2★), 16→23 (2★), 17→24 (2★), 18→25 (2★)
- Tier 3: 19→26 (2.5★), 20→26 (2.5★), 21→27 (2.5★), 22→28 (2.5★), 23→29 (3★), 24→29 (3★), 25→30 (3★), 26→31 (3★), 27→32 (3★)
- Tier 4: 28→32 (3.5★), 29→33 (3.5★), 30→34 (3.5★), 31→35 (3.5★), 32→35 (3.5★), 33→36 (4★), 34→37 (4★), 35→38 (4★), 36→38 (4★)
- Tier 5: 37→39 (4★), 38→40 (4.5★), 39→41 (4.5★), 40→41 (4.5★), 41→42 (4.5★), 42→43 (4.5★), 43→44 (5★), 44→44 (5★), 45→45 (5★)

### Compromises

- **Grab and Multi-Ball appear in tier 1.** The plan fixes tentacles (stage 2) → Grab and coins (stage 6) → Multi-Ball by theme, and both are stage-1-tier champions. They should ship as the gentle version (slow drag, two balls, no aura) so tier 1 still plays simple. Grab is the least tier-5-heavy of the "late" families (stages 2, 31, 32, 39).
- **Delay at 25 and 27.** Stop-and-go (25) is literally a Delay shot today, and the portal (27) reads best as "vanishes, hangs, comes back". The other two Delays (41, 45) are in tier 5.
- **Some current powers are not shots at all** (giant, shrink, turbo, heavy, wind, drain, woolshoes, lowgrav, clone, teleport…). They keep their theme through the ball's flight or the ailment, but the current effect itself (a big head, a slow opponent, a wind field) goes away when the power becomes a power shot.
- **Mirror → reverse** is done with the ailment, not the family: the mirror is a Critical that leaves ??? on the blocker, so tier 5 gets another hard shot.
- **Ground has 5**, every other family 4 (45 = 10×4 + 5).
- **Stats are generated**, not hand-tuned: the total is fixed by stage and a theme profile splits it. At stage 1 (total 12) every spread is 2–3, so early champions only differ by one point; the differences show from tier 2 on.

## Open questions for Idan

1. **Two early exceptions:** OK that tentacles (2) stays Grab and coins (6) stays Multi-Ball in tier 1, as long as they are the gentle version? The other choice is Ailment+shock for tentacles and Straight for coins, which keeps tier 1 simpler but loses the theme.
2. **Powers that are not shots:** may giant, shrink, turbo, clone, teleport etc. lose their current field effect (big head, clone keeper…) and become pure power shots? Or should a few keep it as an extra on top of the shot?
3. **Aura radius:** this draft only says which aura. Should the radius climb with the tier too (small in tier 2, large in tier 5), or be one fixed radius?
4. **Stat ceiling:** stage 45 reaches 45/50 (spreads up to 10). OK, or cap the last champion lower so the player's own card can still out-stat it?
5. **Stars:** half-star steps give runs of about 5 stages at the same rating. Fine, or would you rather show quarter stars / a rating per stage?
