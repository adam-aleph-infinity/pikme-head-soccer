# Head Soccer arcade CPU: research (2026-10-03)

Research only. No code changed. Branch `hs/cpu-research`.

**Labels**
- **[VERIFIED]** documented. In practice this is the fan wiki: no official D&D Dream text on the AI exists, and no datamine was found.
- **[MEASURED]** from our clips (`docs/hs-clips/`, `docs/hs-reference.json`).
- **[REPORTED]** players say so.
- **[INFERRED]** my guess, with the reason.

**Units:** world px (1060 wall to wall, grass at y 435) and seconds, as in `docs/HS-PHYSICS.md`.

**Source key** (cited in brackets after each claim):

| key | source |
|---|---|
| W:Page | `https://headsoccer.wiki.gg/wiki/Page`: the HS wiki (wiki.gg mirror of the Fandom wiki; Fandom itself returned HTTP 402). I re-read **Playing_styles**, **Stars** and **Power_Shot_Guide** myself on 2026-10-03. |
| F:TSR | https://headsoccer.fandom.com/wiki/Teh_Sweggurboi/CPU_Opponents_Ranking (one user's ranking) |
| F:ARG | https://headsoccer.fandom.com/wiki/Character_Rankings/Argly902 (one user's ranking) |
| F:CUG | https://headsoccer.fandom.com/wiki/Characters_Unlock_Guide |
| AS-xx "title", date | App Store reviews, https://apps.apple.com/xx/app/head-soccer/id487119327 (xx = us/gb/au/ca) |
| GP | https://play.google.com/store/apps/details?id=com.dnddream.headsoccer.android |
| TA | http://web.archive.org/web/20150712055709/http://forums.toucharcade.com/showthread.php?t=121673 |
| BS | http://all-iphones-tips.blogspot.com/2013/01/head-soccer-tips-and-cheats-iphone.html |
| CC | https://www.chaptercheats.com/cheats/iphone-ipod/103927/Head-Soccer-Cheats.htm |
| NW / NWC | namu.wiki "Head Soccer" / "Head Soccer/캐릭터". Blocked (403), so only search-engine snippets were seen, and these are always [REPORTED]. |
| DC | https://gall.dcinside.com/mgallery/board/view/?id=headsoccer&no=741 |
| REF:id | `docs/hs-reference.json` row `id` (measured off `hs-video/M1–M11`) |
| PHYS / AUDIT / PWR | `docs/HS-PHYSICS.md` / `docs/HS-GAP-AUDIT.md` / `docs/HS-POWER-SHOTS.md` |
| PROBE | my run of `_hs-cpu-style.mjs` plus a static-lock-filtered depth probe on M3–M11 (2026-10-03). Low confidence: only 4–33 s of clean live play per clip. |

---

## HOW THE HS ARCADE CPU WORKS

1. **One AI for every CPU.** Characters differ by stats, costume, power, and an Offensive/Defensive style. Some behaviour switches on by roster position: from Asura (#24) on, every CPU counters. [VERIFIED W:Playing_styles, W:Asura, W:Stars]
2. **Stars** (0.5★ for Korea up to 5★ for Germany, #10, and 5★ for everyone after) "mainly" mean upgraded stats. Below 5★ the CPU also reacts late to power shots. [VERIFIED W:Stars, W:Playing_styles]
3. **It never stands still.** It jumps 26–38 times a minute, dashes about every third jump at 5★, swings the boot 23–45 times a minute, and runs to meet the ball. [MEASURED REF:cpu.* ; VERIFIED W:Playing_styles]
4. **Depth** (from its own wall): about 325 px for weak CPUs and about 427 px at 5★. Defensive characters stay in front of their goal; offensive ones run at the ball from kickoff. [MEASURED REF:cpu.meanDepth ; VERIFIED W:Playing_styles]
5. **It follows the ball and makes simple mistakes.** It scores own goals with headers, parks the ball on top of a goal, and boots the human repeatedly when close (3 hurts, about 15 boots, means a 2 s knockout). [REPORTED ×5 ; MEASURED REF:kick.stun.*]
6. **Power.** It arms as soon as the bar is full, keeps playing, and fires on its next touch, with no thought for where it is. Bar full to shot: 6.2 s at 5★, 8.5 s for weak CPUs. [VERIFIED W:Power_Shot_Guide ; MEASURED REF:cpu.powerDelay ; REPORTED F:TSR]
7. **Against your power,** Korea through Poland (#1–#23) never kick it back. They put the body in the path (5★ 9 times in 10, 1–4★ 6 in 10) and get hit: thrown about 400 px back, then stars. From Asura (#24) on, CPUs jump and kick to counter. [VERIFIED W:Power_Shot_Guide, W:Asura ; MEASURED PWR §5b]
8. **Flaws:** below 5★ it jumps too late; at every level it jumps too early on long-range or delayed shots; it cannot handle reversed controls and walks into its own goal. **Cheat:** decoy and invisible balls never fool it. [VERIFIED W:Playing_styles, W:Power_Shot_Guide, W:USA]
9. **No difficulty setting** and no stage scaling in arcade beyond each character's own stars, stats, costume and power. Head Cup and Survival do boost CPU stats. [VERIFIED W:Arcade, W:Head_Cup, W:Survival]
10. **Matches:** 60 s, then golden-goal sudden death with no gauge charging. About 8.7 goals per match, and about 58% of power shots score. [VERIFIED W:Beginners_Guide, W:Sudden_Death ; MEASURED REF:match.goals, PHYS §4]

---

## 1. Arcade mode

### Stages and progression
| fact | label / source |
|---|---|
| A single 1-v-1 match: any unlocked character against any unlocked opponent | [VERIFIED W:Arcade] |
| The first character and the first opponent are both South Korea. Beating an opponent unlocks the next one, **only for the character you beat it with**. The chain starts Korea → Cameroon → Nigeria | [VERIFIED W:Arcade] |
| The order follows the character number: 01 Korea, 02 Cameroon, 03 Nigeria, 04 USA, 05 Japan, 06 Russia, 07 Argentina, 08 Italy, 09 Brazil, 10 Germany, 11 Spain, 12 France … 23 Poland, 24 Asura … | [INFERRED] The Stars page lists characters in this order, Korea's infobox says "Next Character = Cameroon", and Cameroon's unlock ("Defeat 12 characters") matches beating everyone up to France (#12). W:Stars, W:Beginners_Guide |
| Roster: 99 characters on the Stars page; the App Store says "103 Avatars" | [VERIFIED W:Stars, App Store page] |
| From The Philippines on, you must clear Fight Mode before you can play those opponents. Asura costs 50,000 points and Pluto 20,000 | [VERIFIED W:Arcade] |
| Reward: 100 points for beating Korea, then 50 per opponent after that; the minimum per match is 10 | [VERIFIED W:Arcade, W:Points] |

### Match rules
| rule | value | label / source |
|---|---|---|
| Length | 60 s; the clock keeps running through power cut-ins | [VERIFIED W:Beginners_Guide ; MEASURED AUDIT R4] |
| Tie | Sudden death: first goal wins, no time limit | [VERIFIED W:Sudden_Death] |
| Sudden-death gauge | Does not charge, and costume fill effects are off too. A full bar carries over and can be used once | [VERIFIED W:Sudden_Death, W:Beginners_Guide] |
| Kickoff | 2.17 s freeze. After a goal, players move 2.24 s later and the ball drops 2.795 s after the goal | [MEASURED REF:goal.resumeTime ; AUDIT "already matches"] |
| Goals per match | ~8.7 (M1–M3) | [MEASURED REF:match.goals] |

### How difficulty rises, boosts and cheats
- Stars rise 0.5 → 5 over the first 10 opponents: Korea 0.5, Cameroon 1, Nigeria 1.5, USA 2, Japan 2.5, Russia 3, Argentina 3.5, Italy 4, Brazil 4.5, Germany 5. Everyone after is 5★. [VERIFIED W:Stars]
- Stars are "mainly about their upgraded Stats, but not always about how strong their Power Shots are". The wiki calls them "obsolete" because later characters have "approximately equal stats". [VERIFIED W:Stars]
- Germany "is the first five star character, which means that his stats are fully upgraded". Below 5★, "Speed, Kicking, Jumping and Dashing" are not at max. [VERIFIED W:Germany, W:Playing_styles]
- There is **no per-stage multiplier** in arcade; difficulty comes from the opponent itself. The first 17–20 opponents are "much easier". After about 40 characters "the powers are stupidly overpowered". [VERIFIED F:CUG ; REPORTED GP (GB)]
- **Costumes:** some arcade CPUs wear stat costumes (Japan Samurai, Mexico Sombrero, Z Fire Flame, Austria Ice, Singapore UFO). The wiki recommends knocking them off. [VERIFIED W:Arcade, W:Costumes]
- **Documented cheat:** against USA's invisible ball, the CPU "will always exactly know where the ball is, because of the coding". It is also never fooled by Japan's decoy beams. [VERIFIED W:USA ; REPORTED F:ARG, AS-us "Penta shot", 2019-03-17]
- **Not arcade:** later Head Cup CPUs "become upgraded a lot (Dash, Kick, Power, Jump and Speed)", with SS costumes. Survival ranks raise opponents' stats and ball count. [VERIFIED W:Head_Cup, W:Survival]
- Players say a CPU's bar refills "every second", or "10x faster" in sudden death. This **contradicts the wiki** (no charge in sudden death; same rate at every star level) and is probably costume fill. [REPORTED AS-gb 2018-05-02, AS-us 2020-02-08 ; INFERRED: costumes such as the Diamond Tiara add 20% every 5 s, W:Costumes_Guide]

---

## 2. How the CPU plays

### Positioning and depth (depth = px out from its own wall, of 1060)
| | weak CPU | 5★ CPU | label / source |
|---|---|---|---|
| Mean depth | 325 | 427 (p10–p90 ≈ 26–796) | [MEASURED REF:cpu.meanDepth(.weak), M3/M4] |
| Plays the balls that come into reach | 47% | 70% | [MEASURED REF:cpu.rangeConv] |
| Touches per minute | 9.2 | 17.4 | [MEASURED REF:cpu.touchesPerMin] |

By character, from the filtered M7–M11 tracks (PROBE, low confidence; the face tracker loses or swaps faces):

| clip | CPU | wiki style | depth p25 / p50 / p75 | time in the human's half |
|---|---|---|---|---|
| M7 | Italy 4★ | Defensive | 277 / 356 / 491 | 20% |
| M9 | Germany 5★ | **Offensive** | 267 / 401 / 522 | 23% |
| M8 | UK 5★ | **Defensive** | 311 / 567 / 757 | 53% |
| M10 | Russia 3★ | Defensive | 357 / 539 / 593 | 51% |
| M11 | Cameroon 1★ | Offensive | (4 s of data) | — |

- **Styles:** "Offensively playing characters run to the ball as soon as the match starts and try to score right away, while defensive characters usually stay in front of their goals". The wiki lists about 26 Offensive and 43 Defensive characters, across **all** star levels. [VERIFIED W:Playing_styles]
  - Offensive includes Cameroon, Japan, Argentina, Germany, France, Netherlands, Devil, Chile …
  - Defensive includes Korea, Nigeria, USA, Russia, Italy, Brazil, Spain, UK, Mexico, Poland, Asura …
- The tracks agree with the wiki for Italy only. Germany plays deep, and UK and Russia play forward. [MEASURED PROBE] This is either tracker identity swaps, or the style only applies at kickoff and "blurs as the match goes on". [INFERRED: the wiki defines the style by the start of the match; the M9 tracks show Germany running about 260–390 px toward the centre within 1 s of two restarts, so it does run at the ball from kickoff]
- Korea "spend[s] most of the match in front of his goal". Cameroon is "often away from his goal, you can easily head the ball over him". Japan "will mostly stay close to you and bother you". Chile and Netherlands are possession-minded and "hard to keep from the ball". [VERIFIED W:Korea, W:Playing_styles ; REPORTED F:TSR]
- Against lobbed power shots, some CPUs defend "too far away from their net", and Luxembourg "walks much too far forward every time". [VERIFIED W:Power_Shot_Guide]

### Walking, jumping, dashing
| | weak | 5★ | label / source |
|---|---|---|---|
| Jumps per minute | 26.3 | 37.7 (one every ~1.6 s) | [MEASURED REF:cpu.jumpsPerMin] |
| Dashes per minute | 2.2 | 13.7 | [MEASURED REF:cpu.dashesPerMin] |
| Dashes per jump | 0.08 | **0.36, about every third jump** | [MEASURED, ratio of the two rows above] |
| Boot swings per minute | 23 | 45 | [MEASURED REF:cpu.kicksPerMin] |

- "CPU players tend to jump a lot, they barely ever just stand on the ground, or it must be at the beginning of the match." "Mostly CPUs Dash every third time they Jump, but this is not always the case." [VERIFIED W:Playing_styles] The 5★ measurement agrees; the weak CPU dashes far less.
- Because the CPU is in the air so much, characters with both an air shot and a ground shot nearly always fire the air one. [VERIFIED W:Playing_styles]
- Movement is the same physics as the human's: 228 px/s run, 1790 px/s dash for about 5 frames, a 45.8 px jump lasting 0.77 s. [MEASURED PHYS §2] Nothing suggests the CPU moves faster than its stats allow. [INFERRED: PHYS fitted these numbers on both players]
- **Dash strike:** HS's fastest balls (~2000 px/s, flat) are dash-throughs on a low ball. Between the two players this happens about 5–6 times a minute. [MEASURED PHYS §4 2026-09-30]

### Reading the ball and choosing the touch
- No source describes how the CPU predicts bounces. The measured "plays 47% → 70% of the balls in reach" is the only number on reading quality. [MEASURED REF:cpu.rangeConv]
- What the clips show for touch types, both players pooled: [MEASURED PHYS §3–4]
  - Standing boot about 914 px/s at 9–23°.
  - Standing header 53°.
  - Jumping header 49°, about 580 px/s.
  - Dash touch about 2000 px/s at 9°.
- There is no lob modifier; a high ball comes off the boot rising under it. [MEASURED REF:kick.head.*, AUDIT K5]
- **Aim:** no source says the CPU aims. [INFERRED] It plays the ball forward with whatever touch is due: its goals in the reports are dashes, headers and power shots, never placed shots, and Uruguay "will probably score sometimes … by shooting your own head" (F:TSR), which is a ricochet, not aim.

### Most common goal patterns
1. **Power shots.** In M3, 3 of 7 goals came within 2 s of a cut-in. The CPU scored 5 of its 16 power shots against Idan in M7–M11 (UK's Aerial 3 of 3, Germany point-blank, Italy's giant ball from the centre). [MEASURED REF:cpu.goals note, PWR §5b]
2. **Dash strikes and runs:** Japan has a "habit of unexpectedly dashing forward to score a goal out of nowhere". [REPORTED F:TSR ; MEASURED PHYS]
3. **Rebounds off a player hit by a power shot.** These can fly the length of the pitch into the shooter's own net. [MEASURED PWR §5b, M10 46.54, M7 46.98]
4. **Own goals by the CPU:** USA walks the ball in when it lands on his head; Germany heads it toward his own goal; Argentina heads it backwards under his crossbar; "bots … score lots of own goals". [VERIFIED W:Playing_styles ; REPORTED F:TSR, AS-gb "Fun but stupid", 2018-02-18 ; NW snippet]
5. **The ball parked on top of a goal:** Netherlands is "the champion 'Heading the ball on top of the goal'", and the AI gets stuck kicking inside its goal under it. [REPORTED F:TSR, AS-gb "Rigged but addicting", 2020-06-15 ; NW snippet]

### Reaction time and mistakes
- Below 5★: "a delayed reaction to power shots, which means they often jump too late". 5★: "a better reaction … and counter them more often". [VERIFIED W:Playing_styles]
- Every level jumps **too early** on long-range or delayed shots. "Your opponent always jumps rather randomly", so Argentina fired at midfield: "he will never block the shot". It "will mostly jump too early" on Poland's, Netherlands', Valentine's and Greece's shots from range, and "always jump[s] to the shot, even if it rolls over the ground". [VERIFIED W:Power_Shot_Guide ; NWC snippet: "jumps immediately after the power shot is used"]
- Reversed controls: "the computer clearly isn't aware" and "will always keep walking into his own goal". [VERIFIED W:Power_Shot_Guide ; REPORTED F:TSR ×2]
- Kickoff: "bots will virtually do nothing until the ball is launched", so you can push them back first. [REPORTED AS-us "TO ANYONE THAT COMPLAINS", 2024-09-02, n = 1]
- When it has the ball at the start, it may "hog it instead of trying to score". [REPORTED AS-us 2019-08-16]
- Open-play reaction time in ms: **not found**. My automatic probe (CPU run change after Idan's kicks, 2–10 per clip) was inconclusive. See UNKNOWNS.

### Known exploits
| exploit | label / source |
|---|---|
| A power shot fired from midfield is "basically unstoppable", "the cpu is ALWAYS dispositioned" | [REPORTED F:ARG, reddit r/headsoccer 10p6iai, CC ; NWC snippet] (4 sources) |
| Fire your power from high in a jump: it goes "over the CPU's head, as they have a bad timing" | [VERIFIED W:Power_Shot_Guide ; REPORTED F:ARG, BS ; NWC] |
| Delayed or slow shots (Argentina, Netherlands): the CPU jumps early and misses | [VERIFIED W:Power_Shot_Guide] |
| Ground shot fired near your own goal: the CPU jumps over it | [VERIFIED W:Power_Shot_Guide] |
| Wait out its power: "All CPUs will immediately activate their power shots … so wait with using you power shot until they have used theirs" | [VERIFIED W:Power_Shot_Guide] |
| Against the CPU's straight power shots, walk up and jump in front of the shooter so it rebounds into his goal | [VERIFIED W:Korea, W:Power_Shot_Guide ; REPORTED F:TSR] (about 8 characters) |
| Reverse its controls: it walks into its own goal | [VERIFIED W:Power_Shot_Guide] |
| Kickoff: jump over Asura before the ball appears and push him into his goal | [VERIFIED F:CUG] |
| Turkey: "keep up the pressure a bit, he gets lost" | [REPORTED F:TSR] |

---

## 3. Power shots

### Gauge
| fact | value | label / source |
|---|---|---|
| Fills on the clock only (no source says touches or goals add to it) | 15.0 s from kickoff, refill 15.2 s (starter character) | [MEASURED REF:gauge.fillTime, gauge.refillTime ; VERIFIED W:Stats "how quickly your power bar refills"] |
| Stands still during the goal restart | 3.19 s in M4 | [MEASURED REF:gauge.refillTime] |
| The conceder's bonus | M4 43.5 s goal: the CPU bar went 20% → 52% on the ball drop | [MEASURED, cited in `shared/sim.js` ballDrop comment] |
| A full bar never drains; an armed power never expires | ≥ 70 s; ≥ 5.4 s | [MEASURED REF:gauge.fullHold, power.armHold] |
| 5★ CPUs' bars do **not** charge faster | — | [VERIFIED W:Playing_styles]. The Hurt page says 5★ bars "charge up quickly": the wiki contradicts itself |
| Costumes add fill (Diamond Tiara: 20% every 5 s) or drain the opponent's (UFO) | — | [VERIFIED W:Costumes_Guide] |

### Arming and firing
- The POWER button appears only when the bar is full. A press arms (glow, also allowed mid-air), and the next touch of the ball fires. [VERIFIED W:Controls]
- The cut-in is 1.33 s of dark, and the ball leaves about 1.0–1.1 s after half-dark. The clock runs on. [MEASURED PWR §8]
- **When the CPU fires:**
  - "All CPUs will immediately activate their power shots as soon as they get it". [VERIFIED W:Power_Shot_Guide]
  - The clips show a delay. The M3 5★ bar was full at 20.0, 45.7 and 65.5 s and emptied (the press) at 23.3, 48.8 and 69.3 s: a **3.1–3.8 s hold**, at 0.5 s sampling. The M4 CPU held 2.7–4.7 s (`bot.js` comment). [MEASURED REF:cpu.powerDelay]
  - Bar full to shot: **6.2 s** at 5★ (n = 3) and **8.45 s** for weak CPUs (5.2–14.7, n = 6). [MEASURED REF:cpu.powerDelay(.weak)]
- **Where it fires:** "not a single CPU knows the best place to use his shot". UK ignores its shot's range; Germany and Devil don't jump first; France "doesn't always seem to care where he uses his power shot". [REPORTED F:TSR ; VERIFIED W:Playing_styles] [INFERRED] So the CPU arms and keeps playing, and fires on whatever touch comes next.

### How the CPU defends against the player's power
| answer | who | label / source |
|---|---|---|
| **Body in the path (gets hit)** | Every CPU up to Poland (#23): it "will only jump and block it". In M7–M11, 18 of Idan's shots met **0 kick-blocks**, 1★ to 5★ | [VERIFIED W:Power_Shot_Guide ; MEASURED PWR §5b] |
| Being in the path at all | 5★: 9 times in 10. 1–4★: caught out of it 4 times in 10 | [MEASURED PWR §5b] |
| **Counter (kick it back)** | "Every character starting at Asura will counter it". Asura "tries to counter every shot by standing in his start off place, and repeatedly jumping and kicking" | [VERIFIED W:Power_Shot_Guide, W:Asura]. namu says counters start at Turkey (#18) [REPORTED NW snippet: conflict] |
| Good counterers | Greece "will counter most of your power shots", plus Valentine, Egypt and South Africa. Italy counters its own shot back | [VERIFIED W:Playing_styles ; REPORTED F:TSR, BS, reddit 10olwzf] |
| Dodge | Against Ireland, CPUs "sometimes they even seem to dodge it!" | [VERIFIED W:Power_Shot_Guide] (the only mention) |
| Its own power as a shield | Never seen. M10 84.25: Russia was armed and out of the path | [MEASURED PWR §5b] |
| Freezing below 5★ | Idan's notes: 0.8 s at the bottom of the ladder, 0.3 s at 4.5★, none at 5★. Consistent with the wiki's "delayed reaction" | [REPORTED: Idan's notes, memory hs-stars-stats ; VERIFIED W:Playing_styles (qualitative)] |

**The human's counter rules** (the CPU's from Asura on): kick "just before the Power shot reaches your Character". Blocking with your own power armed works on "almost every shot". [VERIFIED W:Beginners_Guide, W:Counter_Attacks, W:Power_Shot_Guide]

### What happens to a defender who is hit
| case | effect | duration | label / source |
|---|---|---|---|
| Unarmed, not kicking | Red splash, head snaps back, thrown about 400 px toward its own goal through the air, stars; the ball rebounds at about 0.84× its pace | ~0.5 s flight + ~0.5 s daze | [MEASURED PWR §4, §5b, REF:power.blockStun] |
| Kicking into it (block) | 0.8 s grind on the boot + 0.4 s dead, then it fires back as the blocker's shot | 1.2–1.3 s | [MEASURED PWR §4] |
| Armed and touching it | Counter: your own cut-in and shot | — | [MEASURED REF:power.armedCounter] |
| Generic power effect | You "lose the ability to use the first four buttons [left, right, jump, kick]", but can still arm | per power | [VERIFIED W:Controls] |
| Korea Blue Aura | Pushback | 1.5 s | [VERIFIED W:Blue_Aura_Shot] |
| Cameroon Thunderbolt | Cannot jump or move quickly | 3 s | [VERIFIED W:Thunderbolt_Shot] |
| Nigeria Tornado | Unconscious | 5 s (shot page) or 3 s (Nigeria page): conflict | [VERIFIED W:Tornado_Shot, W:Nigeria] |
| Russia Ice | Frozen; can only dash, kick and walk slowly; can be kicked into the goal | 3 s | [VERIFIED W:Ice_Shot, W:Russia] |
| Brazil Firebird | Walk reversed | 4 s | [VERIFIED W:Firebird_Shot] |
| Germany Dark | Shrunk | 3 s | [VERIFIED W:Dark_Shot] |
| Chile Snake | Wrapped and dragged toward its own goal | 2 s | [VERIFIED W:Chile] |
| Devil Vampire | Stuffed into the ground | 3 s | [VERIFIED W:Devil] |

---

## 4. Hurting the opponent

| fact | value | label / source |
|---|---|---|
| A boot on the opponent: reel | 0.2 s; slides 40 px on the grass, 120 px in the air | [MEASURED REF:kick.reel, kick.knockback.*] |
| Not every boot hurts | About every 5th (gaps of 6, 3 and 6 boots) | [MEASURED REF:kick.hurt.every] |
| 3 hurts → knocked out (stars) | About 15 boots; stars for **1.97 s** | [MEASURED REF:kick.stun.*, M3 82.60–84.57 s ; VERIFIED W:Hurt] |
| The hurt count | Does not decay with time (a 9 s rest) and is not reset by a goal; resets on the knockout | [MEASURED REF:kick.stun.decays, goalResets ; VERIFIED W:Power_Shot_Guide] |
| Kicking a knocked-out player | He "will be launched to his own goal" | [VERIFIED W:Hurt] |
| Other causes of hurt | Every power shot ("every power shot is damaging") and some power-button effects. Hurt is the only way to knock off a costume | [VERIFIED W:Hurt] |
| Head-to-head stun | No source and no clip shows one. Landing on a head is a stand (no carry); a dash under an airborne player does not launch him | [MEASURED REF:headStand.*, dashUnder.*] |

**Does the CPU aim at the player?** Five independent players say it boots you on purpose:
- "the opposing AI always wants to knock you KO by kicking you continuously" [REPORTED TA, 2012]
- "bots just spam kick u until u can't do anything" [REPORTED AS-au, 2019-05-10]
- "CPU acts like a coward and kicks to much" [REPORTED AS-us, 2019-08-16]
- "walk into your opponents goal and kick them unconscious … the AI will abuse this" [REPORTED AS-us, 2026-06-16]
- "computer will pin you into your own goal until it gets power" [REPORTED AS-us, 2018-11-20]

The low stars mostly don't:
- Korea "never kicks the opponent unless … going for the ball or … trying to counter" [VERIFIED W:Korea]
- Nigeria "rarely ever kicks the opponent" [VERIFIED W:Nigeria]
- Devil and the beginners mostly don't kick you up close [REPORTED F:TSR]

**Punishing a stunned player** is inconsistent:
- Serbia, Georgia, Mon-K, Ecuador and Netherlands score on you while you are out.
- Mexico "almost never scores while you're there smashed", Z and Russia mostly don't, and Switzerland "doesn't always kick the snowman into the goal". [REPORTED F:TSR]

[INFERRED] There is no "punish" state. The CPU just keeps chasing the ball, and a disabled player in the way gets booted with it.

---

## 5. How characters differ as CPU

### Stats
| stat | effect | label / source |
|---|---|---|
| Speed | Run speed | [VERIFIED W:Stats] |
| Kick | "the further the ball will travel … and the faster it will go" | [VERIFIED W:Stats] |
| Jump | "higher and further" | [VERIFIED W:Stats] |
| Dash | "the further your character will move" | [VERIFIED W:Stats] |
| Power | "how quickly your power bar refills" | [VERIFIED W:Stats] |
| Survival | Balls in Survival mode (not arcade) | [VERIFIED W:Stats] |
| Levels | 1–10 each; 500 points, doubling, up to 256,000 for the last step. Dash, Power and Survival were added in v1.2.0 | [VERIFIED W:Stats ; hungryapp v1.2.0 notes] |
| Costumes and bodies | Add stats (e.g. Horse +7/+5/+2/+3/+3). Opponents use them too | [VERIFIED W:Costumes, W:Beginners_Guide] |

### One AI, plus a style flag and roster switches
- One AI for everyone, with a two-way style split (Offensive/Defensive) given per character at **every** star level, not just 5★. [VERIFIED W:Playing_styles ; INFERRED: the wiki describes every character's behaviour as the same rules plus style, stats and power]
- Some behaviour switches on by roster position (counters from Asura, #24), and some notes are per character (Germany's own-goal headers, Italy countering its own shot). [VERIFIED W:Asura, W:Playing_styles]
- **What makes a CPU stronger**, by the wiki's own weighting:
  1. Stats (stars ≈ stat level).
  2. The power shot (Colombia is 5★ yet "one of the easiest" because of a weak power).
  3. Costume.
  4. A smaller "smarts" step: reaction to power shots below 5★, and counters from #24.

  [VERIFIED W:Stars, W:Playing_styles ; REPORTED F:TSR]
- Measured activity also rises with stars (touches, dashes, kicks: §6). [MEASURED REF:cpu.*] [INFERRED] Part of that may be speed and jump stats letting it reach more balls, not smarter choices.

### Examples
| CPU | ★ | style | what is documented |
|---|---|---|---|
| South Korea #1 | 0.5 | Defensive | "Slowest", very low jump, "very rarely uses Dash", camps in front of his goal, never kicks the opponent on purpose. Easiest [VERIFIED W:Korea ; REPORTED F:TSR] |
| Cameroon #2 | 1 | Offensive | "Second slowest", "doesn't kick or dash as much", "never tries to counter", often away from his goal so you can head it over him [VERIFIED W:Cameroon ; REPORTED F:TSR] |
| Japan #5 | 2.5 | Offensive | Stays close and bothers you, bad reaction to power shots, sudden dash-forward goals [VERIFIED W:Japan ; REPORTED F:TSR] |
| Germany #10 | 5 | Offensive | First fully upgraded CPU; "when the ball falls on top of his head, he tends to head it towards his own goal" [VERIFIED W:Germany] |
| Asura #24 | 5 | Defensive | First to counter every shot: stands on his kickoff spot, jumping and kicking. Can be pushed into his goal at kickoff [VERIFIED W:Asura, F:CUG] |

---

## 6. Difficulty scaling: what changes from easy to hard

| axis | weak end | strong end | label / source |
|---|---|---|---|
| Difficulty setting | None. Difficulty is the opponent's stars, stats, costume and power | | [INFERRED: no setting on any wiki page or in the store text; the "Difficulties" wiki page is a fan proposal, F:General_Idea/Difficulties] |
| Stats (speed, kick, jump, dash) | Not maxed below 5★; Russia (3★) about "a little bit more than half" of a 5★ | "Fully upgraded" from Germany (#10), about equal after that | [VERIFIED W:Stars, W:Germany, W:Playing_styles] |
| Gauge rate | Same | Same | [VERIFIED W:Playing_styles] (contradicted by W:Hurt) |
| Power use | Arms at once | Arms at once | [VERIFIED W:Power_Shot_Guide] |
| Power, bar full to shot | 8.45 s | 6.2 s | [MEASURED REF:cpu.powerDelay] |
| Reaction to the player's power | Delayed, jumps late; Idan's notes give a 0.8 → 0.3 s freeze | Immediate | [VERIFIED W:Playing_styles ; REPORTED Idan's notes] |
| In the path of the player's power | ~60% (1–4★) | ~90% | [MEASURED PWR §5b] |
| Kicks the power back (counter) | Never, #1–#23 | Always tries, #24 on | [VERIFIED W:Power_Shot_Guide, W:Asura] |
| Touches per minute | 9.2 | 17.4 | [MEASURED REF:cpu.touchesPerMin] |
| Balls in reach it plays | 47% | 70% | [MEASURED REF:cpu.rangeConv] |
| Boot swings per minute | 23 | 45 | [MEASURED REF:cpu.kicksPerMin] |
| Jumps per minute | 26 | 38 | [MEASURED REF:cpu.jumpsPerMin] |
| Dashes per minute | 2.2 | 13.7 | [MEASURED REF:cpu.dashesPerMin] |
| Mean depth | 325 px | 427 px | [MEASURED REF:cpu.meanDepth] |
| Kicks the opponent | Rarely (Korea, Nigeria) | Often | [VERIFIED W:Korea, W:Nigeria ; REPORTED ×5] |
| CPU goals per match vs Idan | 2.7 | 4 (n = 1) | [MEASURED REF:cpu.goals] |
| Accuracy and aim | No data | No data | — |
| Open-play reaction (ms) | No data | No data | — |

---

## IMPLEMENTATION NOTES

States: **KICKOFF · DEFEND · CHASE · ATTACK · JUMP · POWER · BLOCK · RECOVER · STUNNED.** Numbers are HS's: (M) measured, (W) wiki, (I) my inference.

```
KICKOFF   (from the freeze until the ball is in play)
  Kickoff freeze 2.17 s (M). After a goal: players free at 2.24 s, ball drops at 2.795 s (M).
  IF the ball is not in play yet → stand still (REPORTED, n=1: "virtually do nothing until the ball is launched").
  ON the ball drop: style == Offensive → CHASE at once (W); Defensive → DEFEND (W).

DEFEND    (ball in its half, or style Defensive with no reason to go)
  Home ≈ 325 px out (weak) … 427 px (5★) (M). Defensive styles nearer the goal (W).
  Re-pick the spot about every think. Jumps keep coming (26–38/min) even while waiting (M, W "barely ever stand").
  IF a reachable ball is coming → CHASE. Skip it with p = 1 − (0.47 … 0.70) (M rangeConv).

CHASE     (run to where the ball can be met)
  Run 228 px/s, no acceleration (M). Dash p ≈ 1/3 per jump at 5★, ≈ 1/12 when weak (M).
  Follows the ball even when that means heading it backwards: allow own goals (W, REPORTED).
  IF the ball is low and slow 55–175 px ahead → dash through it (a dash strike, ~2000 px/s) (M).
  IF the ball is at its feet or chest → ATTACK. IF it is dropping over the CPU → JUMP.

ATTACK    (ball in front)
  Mash the boot when the ball or the opponent is close: 23–45 swings/min, repeat ≥ 0.349 s (M).
  No aim: the touch decides the direction (I). Boot the opponent when close; low stars rarely do (W, REPORTED).

JUMP      (one height, 45.8 px, 0.77 s in the air; no double jump) (M)
  A header on a dropping ball, a hop-volley, or just because (W "jump a lot").
  Lands on a head → stands on it (no carry) (M).

POWER     (own gauge)
  Gauge 15.0 s (starter; the Power stat scales it), frozen through the goal restart, conceder +~30% on the drop (M).
  Bar full → ARM (W: "immediately"; M: 3.1–3.8 s later in M3).
  Armed → keep playing DEFEND/CHASE/ATTACK; the next touch fires (W). No placement logic (REPORTED).
  Measured full → shot: 6.2 s (5★), 8.45 s (weak) (M).
  Sudden death: no charging; a bar already full is kept (W).

BLOCK     (the opponent's power shot: cut-in 1.33 s, ball out ≈ 1.1 s after the touch) (M)
  IF stars < 5 → do nothing for 0.8 s (0.5★) … 0.3 s (4.5★), then act (Idan's notes; W "delayed reaction").
  IF roster # < 24 → get the BODY into the path; never kick it.
     Be there p ≈ 0.6 (1–4★) / 0.9 (5★) (M). Jump if it passes over the head; timing late below 5★ (W).
  IF roster # ≥ 24 → stand near the kickoff spot, jump and kick repeatedly to counter (W, Asura).
  ALL: delayed or long-range shots → jump too early (W). Ground shots → still jump (W).
       Decoys and invisible balls → read the real ball (W: the coded cheat).
  IF armed → a touch counters (M).

STUNNED   (no left/right/jump/kick; POWER can still be armed) (W)
  Power hit, unarmed: thrown ~400 px toward its own goal (~0.5 s), then stars ~0.5 s (M).
  Block on its own boot: 0.8 s grind + 0.4 s dead (M).
  Boot reel 0.2 s. 3 hurts (~15 boots) → knockout 1.97 s; kicked while out → launched into its own goal (M, W).
  Per-power ailments: 1.5–5 s (§3 table). Reversed controls: the CPU does NOT correct, it walks the wrong way (W).

RECOVER   (stun over)
  Straight back to CHASE/DEFEND. No sign of a catch-up rule or extra caution (I: no source mentions one).
```

---

## VS OUR CPU (shared/bot.js, shared/champions.js): flagged only, nothing fixed

| # | HS finding | ours | status |
|---|---|---|---|
| 1 | One AI for all CPUs | One `botInputRaw` with dials (`bot.js:27`, `champions.js stageDifficulty`) | DONE |
| 2 | Stars rise 0.5★ → 5★ over #1–#10, then flat | `stars: stage*0.5`, `FIVE_STAR = 10` (`champions.js:50,60`) | DONE |
| 3 | Stars "mainly" = stats | Stars = smartness only; stats separate | **CONFLICT** (see C1) |
| 4 | Offensive/Defensive style for **every** character | `archetype` only at 5★, by HS profile (`champions.js:42,133`, `bot.js:501`) | **PARTIAL / CONFLICT** (C2) |
| 5 | Germany is Offensive (wiki); UK and Mexico Defensive | Stage 10 plays `defense` (PROBE output) | **CONFLICT** with the wiki; matches the M9 tracks (C2) |
| 6 | Jumps a lot (26–38/min) | HOP, header, hop-kick and head-stand rules (`bot.js:627–642`); parity rows pass (AUDIT) | DONE |
| 7 | Dashes, about 1 in 3 jumps at 5★ | `DASH_BASE + DASH_SKILL·s²` (`bot.js:550`), fitted to 13.7/min | DONE |
| 8 | Dash strike through low balls | `STRIKE_*` (`bot.js:580`) | DONE (0.5/min vs HS 1.4/min, AUDIT N6) |
| 9 | Depth 325 → 427 px | `home`/`cap` (`bot.js:520,532`); R5 fitted | DONE |
| 10 | Plays 47% → 70% of balls in reach | `LAZY`, `headerGo`, `kickGo` | DONE (parity) |
| 11 | Mashes the boot 23–45/min | `MASH_*` (`bot.js:668`); ours 64–68/min at 5★ | PARTIAL (too many, PHYS 2026-09-30) |
| 12 | Kickoff: idle until the ball drops | No `ballWait` rule in `bot.js`; it plays the parked ball | **CONFLICT?** (not run-checked; one report) |
| 13 | Offensive runs to the ball at kickoff | 5★ offense only, through `press` | PARTIAL |
| 14 | Follows the ball into own goals; parks it on top of goals | Header rule allows any side when defending (`bot.js:623`); no own-goal rate measured | UNKNOWN |
| 15 | Arms the instant the bar is full (wiki) | `wantPower` at `gauge>=1` after 1.5 s of play (`bot.js:332`) | DONE (wiki) / **CONFLICT** with M3's 3.1–3.8 s hold (C3) |
| 16 | Full → shot 6.2 s (5★), 8.45 s (weak) | 3.7 s / 3.9 s (AUDIT N1, left as is by Idan) | PARTIAL |
| 17 | Armed: keeps playing, fires on its next touch, no placement | "ARMED, IT KEEPS PLAYING ITS OWN GAME" (`bot.js:534`) | DONE |
| 18 | Never kicks the player's power back up to #23; body in path | `'body'` plan (`bot.js:202`); kick only when armed | DONE |
| 19 | **From Asura (#24) on: jumps and kicks to counter** | No kick-counter at any stage | **MISSING** (C6) |
| 20 | In the path 60% (1–4★) / 90% (5★) | `cutOnIt = 0.3 + 0.6·s` (`bot.js:181`) | DONE (30% at the very bottom) |
| 21 | Below 5★ freezes on the cut-in, jumps late | `freezeFor` 0.8 → 0.3 s (`bot.js:357`), `powerJumpErr` | DONE |
| 22 | Jumps **too early** on delayed or long-range shots; jumps at ground shots | Reads the real power path (`powerPath`), jumps on time-to-arrival; dodges Ground shots smartly | **CONFLICT** (AUDIT R12, partly done) |
| 23 | Never fooled by decoys or invisible balls (cheat) | Reads the real ball | DONE |
| 24 | Never uses its own power to shield | `shieldArm` can arm on the opponent's glow (`bot.js:108`) | **CONFLICT** (PWR §5b: never seen) |
| 25 | Reversed controls: never corrects, walks into its own goal | `adapt: d.t >= 0.5` corrects from stage 5–6 (`bot.js:59`, `champions.js:136`) | **CONFLICT** (C7) |
| 26 | Boots the opponent a lot (5 reports); low stars rarely | Tackle only on a contested ball, ≤ 1/s, never on a helpless player (`bot.js:563`); scales with `aim` | PARTIAL / **CONFLICT** (C8) |
| 27 | Kicking a knocked-out player launches him to his goal | Sim: `KO_KICK_SLIDE` (`sim.js:1375`); the bot avoids it on purpose | PARTIAL |
| 28 | Hit by a power: thrown ~400 px, 0.5 s stars; can still arm while stunned | Sim (AUDIT W4 ✅); the bot outputs nothing while stunned (`bot.js:81`), so it never arms | PARTIAL (a stunned bot could still arm) |
| 29 | 5★ stats "fully upgraded" (max 10) | 5★ flat level 5 (strong stat 6) (memory hs-stars-stats) | **CONFLICT?** (C4) |
| 30 | Arcade CPUs wear stat costumes | No costumes (product decision, AUDIT R11) | MISSING (by choice) |
| 31 | No easy/normal/hard; difficulty is per opponent | Arcade: per stage. `DIFFICULTIES` 0–5 used outside the arcade | DONE (arcade) |
| 32 | Gauge on the clock, frozen at restarts, conceder bonus, none in sudden death | Sim (AUDIT "already matches") | DONE |
| 33 | ~58% of power shots score | Tier 0 concedes 63%, tier 5 31%, ~48% on average (AUDIT N3) | DONE |

### Conflicts with our decisions (flag only: keep the decision unless Idan says otherwise)
- **C1. Stars = AI smartness only.** The wiki says stars are "mainly about their upgraded Stats" (W:Stars). But it also gives a smartness step: late reactions to power shots below 5★ (W:Playing_styles). So HS's stars are mostly stats plus a little smarts. Our ladder puts all the stars into smarts.
- **C2. "No per-champion bot style" / the 5★-only split.** The wiki gives every character, at every star level, a style (W:Playing_styles). Its labels disagree with our stage 10 (Germany Offensive in the wiki, `defense` in ours). The M8/M9 tracks hint at ours (Germany deep, UK forward), but the tracker is unreliable.
- **C3. "The CPU arms the moment its bar is full."** The wiki agrees. M3's HUD shows a 3.1–3.8 s hold (n = 3), and M4 shows 2.7–4.7 s. Either the HUD read is early or the CPU holds.
- **C4. 5★ stats flat at level 5 (strong 6).** The wiki says Germany's stats are "fully upgraded". If that means 10/10, our 5★ is about half-strength. It depends on how our 1–10 scale maps to HS's.
- **C5. Dash rates as measured, not "every 3rd jump".** No real conflict: the 5★ measurement *is* about 1 in 3 (13.7 / 37.7). The weak CPU is 1 in 12.
- **C6. Body, not boot, on the player's power.** Right for #1–#23 (W + M7–M11). The wiki says every CPU from Asura (#24) on counters with jump + kick, so our stages 24–45 miss it.
- **C7. `adapt`** (the CPU corrects reversed controls from stage ~5). The wiki: CPUs never handle reversed controls.
- **C8. The anti-stun-lock tackle rule.** Five players report the CPU booting them on purpose until they are knocked out. Our bot deliberately won't.

---

## UNKNOWNS: what I couldn't find, and how to measure it

| unknown | how to measure |
|---|---|
| Open-play reaction time (ms) | M3 (5★) and M5 (weakest): frame-count from Idan's KICK lighting up (the button patch is frame-exact) to the CPU's first step that changes its run. Do it by eye on 20+ kicks per clip; my automatic probe was too noisy. |
| How it predicts bounces and lobs | M3/M4: for each lob, take the CPU's x 0.3 s after the touch against the ball's landing x (error in px), by star. Needs a clean head track; check frame sheets. |
| How the style plays out (kickoff run, depth by character) | M7–M11 restarts: frame-count the CPU's x from the ball drop to +1.5 s at every restart (8–10 per clip). That is the wiki's own test of Offensive vs Defensive. My automatic drop detector missed most restarts. |
| Whether the CPU really holds a full bar | M3 20.0–23.3 s, 45.7–48.8 s, 65.5–69.3 s: step frame by frame on the right HUD bar. Is it full and flashing (POWER ready) for 3 s, or still filling? |
| Power delay at each star | M7–M11 HUD (right bar): bar full → empty (the press) → cut-in, for 16 CPU shots. Gives the delay at 1★, 3★, 4★ and 5★. |
| Counter behaviour from #24 | A new clip against Asura (#24) and one CPU just before it (Poland, #23): fire 5+ straight power shots at each and count kick-counters. Check namu's "from Turkey (#18)" with Turkey too. |
| Own-goal rate and the CPU's goal patterns | M7–M11: label each goal (power, dash, header, own goal, rebound) by eye. Count CPU own goals per match. |
| How often it boots the human on purpose | M8/M9 (5★) vs M11 (1★): count CPU boots that land on Idan with no ball within 160 px. |
| Kickoff idle | M7–M11 restarts: does the CPU move in the 0.555 s between "players free" (2.24 s) and the ball drop (2.795 s)? |
| Stat level of each starred CPU | Run each CPU's speed, jump and dash on clips (as REF:player.topSpeed). Compare Korea, Russia and Germany to the human's known levels. |
| Ground-shot jump habit | A clip of Nigeria's or Italy's ground shot against a 5★ CPU: does it jump? |
| Base gauge per Power level | Two clips with a known Power stat (1 vs 5): frame-count kickoff → POWER plaque. |
| Datamine / official AI values | None exist publicly (searched GitHub, forums; Fandom 402, namu 403, Reddit blocked). An APK decompile (Unity/Cocos assets) is the only way. |

*Search notes: Reddit and namu.wiki could not be fetched (only titles and snippets). Google Play's description was truncated. No YouTube transcripts were available. Every [REPORTED] claim above is a player's opinion, not a measurement.*
