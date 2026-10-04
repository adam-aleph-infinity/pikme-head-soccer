# HEAD SOCCER CLONE — ARCADE CPU/AI HANDOFF

## HOW THE HS ARCADE CPU WORKS

1. **[VERIFIED]** Arcade is a one-on-one, single-match mode: the player chooses an unlocked character and fights an unlocked opponent; beating an opponent unlocks the next opponent for that player character. (Head Soccer Fandom Arcade page)  
2. **[VERIFIED]** Normal matches last 60 seconds; a tie enters sudden death, where the first goal wins. (Head Soccer Fandom Beginners Guide)  
3. **[VERIFIED]** In sudden death, power gauges stop charging, but a power already ready at the transition may still be used. (Head Soccer Fandom Beginners Guide)  
4. **[VERIFIED]** The CPU uses the same core action set as the player: horizontal movement, jump, kick, directional dash, power arm, and power-button effects. (Head Soccer wiki / game store descriptions)  
5. **[VERIFIED]** Power gauges fill over time; a full gauge is armed with the power button, and conventional power shots trigger on ball contact. (NamuWiki Head Soccer)  
6. **[VERIFIED]** Some power-button effects work without ball contact and directly pressure or disable the opponent. (NamuWiki Head Soccer)  
7. **[VERIFIED]** A normal kick timed immediately before an incoming power shot can counter/return it. (Head Soccer Power Shot Guide)  
8. **[INFERRED]** The Arcade CPU is best built as one shared reactive state machine, with per-character stats, power geometry, and a few documented personality modifiers. Reason: wiki pages document distinct CPU tendencies for champions such as USA, Chile, Spain, and Devil, but no source documents separate full AI scripts.  
9. **[INFERRED]** Difficulty should be implemented through reaction time, prediction error, counter chance, aggression, and power-use timing—not hidden teleportation, perfect prediction, or undocumented Arcade-only stat boosts. Reason: no Arcade-specific datamine or official AI values were found.  
10. **[VERIFIED]** Character stats include speed, dash distance, kick power, power-gauge charge speed, and jump height; these are explicit upgrade categories. (NamuWiki Head Soccer)  

---

## 1. ARCADE LADDER

### Structure

- **[VERIFIED]** Arcade starts with South Korea as the first opponent. (Head Soccer wiki Game Modes)  
- **[VERIFIED]** Beating the first opponent awards 100 points; beating later opponents awards more points. (Head Soccer Fandom Arcade)  
- **[VERIFIED]** Arcade progression is per selected player character: defeating an opponent unlocks the next opponent for that character only. (Head Soccer wiki Game Modes)  
- **[VERIFIED]** Unlocking an Arcade opponent means the character becomes selectable as an opponent; it does not automatically make that character playable. (Head Soccer wiki Game Modes)  
- **[INFERRED]** Do not hard-code a fixed Arcade ladder length. The roster changed across updates and public sources do not agree on one stable total. Reason: Arcade pages/videos show many opponents, including later characters, while the roster is version-dependent.  
- **[VERIFIED]** Characters have Arcade opponent star ratings; examples include USA at 2 stars, Chile at 5 stars, Spain at 5 stars, Devil at 5 stars, China at 5 stars, and Colombia at 5 stars. (Head Soccer wiki character pages)  

### Match rules

| Rule | Value / behavior | Label / source |
|---|---|---|
| Match length | 60 seconds | **[VERIFIED]** Head Soccer Fandom Beginners Guide |
| Win condition | Higher score at time expiry | **[VERIFIED]** Head Soccer Fandom Beginners Guide |
| Tie rule | Golden-goal sudden death | **[VERIFIED]** Head Soccer Fandom Beginners Guide |
| Sudden-death gauge | No new gauge charging | **[VERIFIED]** Head Soccer Fandom Beginners Guide |
| Ready power in sudden death | Can be used once | **[VERIFIED]** Head Soccer Fandom Beginners Guide |
| Loss consequence | No documented campaign-life, health, or permanent ladder penalty | **[INFERRED]** Arcade unlock description; reason: no source found for a loss penalty |

### Difficulty rise per stage

- **[VERIFIED]** Arcade opponents have documented star ratings, but the wiki does not document a fixed numeric formula that converts stars into AI reaction, accuracy, or stat boosts. (Head Soccer wiki character pages)  
- **[INFERRED]** Treat star rating as an opponent difficulty/tier label, not as a direct AI-skill multiplier. Reason: USA is only 2 stars but is documented as kicking/dashing frequently, while higher-star characters differ mainly through stronger powers and loadouts. (USA wiki page)  
- **[VERIFIED]** In Head Cup—not Arcade—later CPU opponents can receive upgraded dash, kick, power, jump, and speed, plus strong costumes. (Head Soccer Fandom Beginners Guide)  
- **[INFERRED]** Do not apply Head Cup’s automatic CPU stat upgrades to Arcade by default. Reason: that evidence is explicitly Head Cup-specific.  
- **[INFERRED]** For Arcade, create a `difficultyTier` from the opponent’s Arcade star rating and use it only to scale AI reaction/error/counter parameters. Reason: it reproduces the ladder feel without inventing undocumented stat cheats.  

### CPU cheats

- **[INFERRED]** No hidden Arcade CPU cheats should be implemented by default: no teleporting, no guaranteed interception, no automatic faster gauge, and no guaranteed counter. Reason: no Arcade-specific evidence supports them, while the game is documented as physics-based.  
- **[VERIFIED]** CPU power/stat advantages are documented in Head Cup, not Arcade. (Head Soccer Fandom Beginners Guide)  

---

## 2. CPU STATE MACHINE

### States

| State | Trigger | CPU behavior | Exit condition |
|---|---|---|---|
| `HOME` | Ball is neutral, far away, or not immediately dangerous | Stand in a goal-side home zone; face ball | Ball enters CPU half or becomes reachable |
| `DEFEND` | Ball/player threatens CPU goal | Move between ball and own goal; prioritize clearance; avoid crossing ball | CPU gains possession, clears ball, or danger ends |
| `CHASE` | Loose ball is reachable before player | Move/dash toward noisy predicted ball landing point | Kick/jump contact becomes possible, or ball becomes unreachable |
| `ATTACK` | CPU has best ball access in opponent half | Advance with ball; select kick/header/lob/power | Ball lost, shot made, or own-goal danger rises |
| `JUMP` | Ball will enter CPU’s aerial reach | Jump and maintain horizontal correction | CPU lands or contact window ends |
| `HEADER` | Airborne CPU is under/near ball and opponent goal is exposed | Use body/head collision to direct ball toward goal | Contact occurs or CPU lands |
| `KICK` | Ball enters forward foot-hit arc | Kick toward goal, clearance direction, or lob direction | Kick animation/contact ends |
| `POWER_ARM` | Gauge full and power requires ball contact | Arm power while approaching a likely ball contact | Power fires, timeout, or arm canceled |
| `POWER_FIRE` | Armed ball contact occurs, or button-effect geometry is satisfied | Trigger champion-specific power | Effect/animation ends |
| `BLOCK` | Player power is incoming and CPU cannot counter | Jump, dash, or position body/projectile blocker in path | Power passes, is blocked, or CPU is hit |
| `COUNTER` | Counterable incoming power is within kick-counter timing | Time a normal kick to return/stop power | Counter succeeds/fails |
| `DODGE_POWER` | Counter is unlikely but escape is possible | Dash/jump outside projectile/effect hitbox | Projectile passes or CPU is hit |
| `RECOVER` | CPU lands, misses an aerial play, or is briefly knocked back | Limit actions; bias movement back toward own goal | Recovery timer ends |
| `STUNNED` | Power effect disables, freezes, reverses, or immobilizes CPU | Apply configured status effect; no/limited input | Effect duration ends |

### State priority

```text
1. STUNNED / RECOVER
2. COUNTER / DODGE_POWER / BLOCK
3. DEFEND
4. CHASE
5. ATTACK
6. JUMP / HEADER
7. KICK / POWER_ARM / POWER_FIRE
8. HOME
```

- **[INFERRED]** This order gives special handling to disruption and incoming powers before ordinary ball play. Reason: powers can disable or reverse control, so they must override normal movement logic. (Chile, Spain, Devil wiki pages)  

---

## 3. POSITIONING

### Ball tracking

- **[INFERRED]** Predict ball position 350–1,000 ms ahead, including floor bounce, wall bounce, and current velocity. Reason: a purely current-position chaser cannot handle Head Soccer’s fast bouncing ball convincingly.  
- **[INFERRED]** Add horizontal landing error once per decision cycle, not every frame. Reason: prevents jitter and creates believable imperfect tracking.  
- **[INFERRED]** Do not let the CPU know the result of an unresolved random bounce before it happens. Reason: this would look like cheating and is unsupported by evidence.  

```ts
predictedBall = simulateBall(
  lookAheadMs,
  includeFloorBounce = true,
  includeWallBounce = true
);

cpuTargetX =
  predictedBall.x
  + randomRange(-landingErrorPx, landingErrorPx)
  + goalSideBias;
```

### Defensive positioning

| Situation | CPU target | Forward limit |
|---|---|---|
| Ball near own goal | Between ball and own-goal center | Stay goal-side of ball |
| Ball in own half | Slightly goal-side of predicted ball X | Do not cross ball unless intercept is clear |
| Ball at midfield | Predicted landing point | May advance to midfield |
| Ball in opponent half | Advance only if CPU has possession edge | Do not go beyond 60–75% field distance from own goal |
| Ball behind CPU | Own-goal-side intercept point | Emergency recovery allowed |
| Ball airborne above own half | Predicted landing X plus goal-side bias | Jump only when contact is reachable |

- **[INFERRED]** Keep a goal-side offset of roughly 0.4–0.8 character widths when defending. Reason: this creates a believable defensive body position without pure goal camping.  
- **[INFERRED]** Cap normal forward movement at 60–75% of the field from the CPU’s own goal. Reason: this preserves the exploitable overcommit behavior associated with simple arcade CPUs.  

### Movement rules

```text
IF ball is in CPU half AND player has better access:
    targetX = point between ball and own goal;

IF ball is behind CPU AND moving toward CPU goal:
    dash toward own-goal-side intercept if dash is available;

IF CPU just missed a kick:
    enter RECOVER for 120–220 ms;

IF CPU is in ATTACK and loses ball:
    immediately evaluate DEFEND before re-attacking.
```

- **[VERIFIED]** Dash is a faster directional movement input triggered by double-clicking a direction. (Head Soccer Fandom Beginners Guide)  
- **[INFERRED]** Use dash for emergency saves, post-whiff recovery, and power dodges—not as constant movement. Reason: dash is a discrete input in the documented control set.  

---

## 4. ATTACKING AND SCORING

### Attack entry

```text
IF CPU reaches ball first
AND ball is not moving dangerously toward CPU goal:
    enter ATTACK;

IF player is stunned / frozen / control-reversed:
    increase ATTACK urgency;

IF player is behind the ball:
    push ball forward toward player goal.
```

- **[VERIFIED]** Chile’s Snake Shot can immobilize the opponent and drag them toward their own goal, creating an easier chance to score. (Chile wiki page)  
- **[INFERRED]** After successfully disrupting the player, CPU should raise attack priority for the disruption duration. Reason: the documented power directly creates a scoring opportunity.  

### Shot selection

| Situation | CPU action | Priority |
|---|---|---|
| Own goal in danger | Low/forward clearance kick | Highest |
| Player goal open and ball in foot arc | Low drive toward goal | High |
| Player airborne or displaced | Upward/lob contact | High |
| CPU airborne under ball and goal exposed | Header toward goal | Medium-high |
| Player close behind/above ball | Upward kick/lob to create bounce | Medium |
| Armed power and favorable geometry | Power shot | High |
| Armed power and bad geometry | Delay or cancel arm | Medium |

- **[INFERRED]** Treat headers as passive airborne body/head collisions, not a separate command. Reason: sources document kick and jump controls but not a dedicated header button.  
- **[INFERRED]** Do not implement deliberate wall-bank planning in the first version. Reason: no source documents CPU bank-shot strategy; rebounds should emerge from physics.  

### Goal patterns, ranked

| Rank | Pattern | Build treatment | Label |
|---|---|---|---|
| 1 | Direct low kick into exposed goal | Primary normal-goal source | **[INFERRED]** |
| 2 | Power shot into goal | Use champion-specific projectile/effect model | **[VERIFIED]** Power shots are a core scoring mechanic. (Google Play / NamuWiki) |
| 3 | High bounce/lob over displaced player | Emergent from upward kick/header | **[INFERRED]** |
| 4 | Goal after power disruption | Raise attack urgency during disable/recovery | **[VERIFIED]** Chile Snake Shot creates easier scoring. (Chile wiki page) |
| 5 | Crossbar/wall rebound | Physics-generated; no special planner | **[INFERRED]** |
| 6 | Dribble-push / body carry | Use for possession-heavy CPU profiles | **[INFERRED]** |

### Kick rules

```text
IF ball is in forward kick arc:
    IF own goal danger is high:
        kick as clearance;
    ELSE IF player goal is exposed:
        kick toward player goal;
    ELSE IF player is close:
        kick upward/forward;
    ELSE:
        kick toward attacking half;

IF ball is inside own danger zone:
    choose any clearance direction that exits the goal mouth,
    even if it is not an attacking shot.
```

- **[VERIFIED]** Kicking can injure an opponent when it connects. (NamuWiki Head Soccer)  
- **[INFERRED]** Normal CPU kicks should target ball/goal first; player damage should usually be incidental. Reason: no Arcade source documents a dedicated “hurt player” normal-kick objective.  

---

## 5. POWER SHOTS

### Gauge and arming

- **[VERIFIED]** The gauge fills gradually over time. (NamuWiki Head Soccer)  
- **[VERIFIED]** When full, pressing the power button arms the power and creates a flame effect around the character. (NamuWiki Head Soccer)  
- **[VERIFIED]** Conventional power shots activate when the armed character touches the ball. (NamuWiki Head Soccer)  
- **[VERIFIED]** Some advanced characters have power-button effects that activate without ball contact. (NamuWiki Head Soccer)  
- **[VERIFIED]** In sudden death, no new gauge charging occurs, but a ready power may be used. (Head Soccer Fandom Beginners Guide)  
- **[INFERRED]** Do not give Arcade CPU a faster gauge by default. Reason: no Arcade-specific source supports it.  

### CPU firing rules

```text
IF gaugeFull AND power.requiresBallContact:
    IF predictedBallContact is 150–500 ms away
    AND expectedGoalChance + disruptionValue > normalKickValue:
        armPower();

IF power.triggerType == "button_effect":
    IF player is inside configured effect geometry
    AND effectValue > saveForLaterThreshold:
        firePower();

IF armedPower AND contact becomes unlikely for maxHoldMs:
    cancelArmOrAllowTimeout();
```

- **[INFERRED]** Use `maxHoldMs = 750–1,500 ms`. Reason: prevents indefinite hoarding while allowing tactical waiting.  
- **[INFERRED]** Fire immediately if player is disabled, ball is aligned toward goal, CPU is losing late, or sudden death begins with a ready power. Reason: these are high-value windows consistent with documented power mechanics.  

### Power range and safety

- **[VERIFIED]** Spain’s Laser Shot launches three balls and is most effective around the semicircle; poor distances can miss or even become own goals. (Spain wiki page)  
- **[VERIFIED]** Devil’s power-button state increases movement speed and jump height; Vampire Shot lasts 3 seconds and can stuff the opponent into the ground. (Devil wiki page)  
- **[INFERRED]** Every power needs `preferredMinDistance`, `preferredMaxDistance`, `unsafePowerRange`, and `targetBias`. Reason: documented powers are position-sensitive.  

### CPU defense against player powers

| Defense option | Trigger | Success treatment |
|---|---|---|
| `COUNTER` | Power is counterable and CPU can kick within counter window | Roll against `counterSkill`; success returns/stops power |
| `DODGE_POWER` | Counter unlikely but dash/jump can escape hitbox | Move outside predicted hitbox |
| `BLOCK` | CPU has body/projectile blocker or power-specific block option | Use configured block behavior |
| `ACCEPT_HIT` | No counter/dodge/block possible | Enter configured disruption/recovery |

- **[VERIFIED]** A normal kick immediately before impact can counter a power shot. (Head Soccer Power Shot Guide)  
- **[VERIFIED]** Devil’s shot can be countered, but its up-and-down movement makes timing harder. (Power Shot Guide)  
- **[VERIFIED]** South Africa’s air shot can be stopped by consecutive jump-and-kick timing. (Power Shot Guide)  
- **[INFERRED]** Use a base counter window of 60–110 ms, modified by power speed and CPU tier. Reason: no measured original value was found.  

### Hit effects and durations

| Power / effect | Documented effect | Duration |
|---|---|---|
| Chile Snake Shot | Wraps opponent, prevents movement, drags them toward own goal | 2 seconds **[VERIFIED]** (Chile wiki page) |
| Devil Vampire Shot | Can stuff opponent into ground | 3 seconds **[VERIFIED]** (Devil wiki page) |
| Colombia Electric Costume | Electrocutes on contact | 2 seconds **[VERIFIED]** (Colombia wiki page) |
| China Buddha Shot | Sucks opponent into bottle and returns them to same spot | 2 seconds **[VERIFIED]** (China wiki page) |
| General kick damage | Can injure opponent | Not documented **[UNVERIFIED]** |
| Generic stun / freeze / knockback | Power-dependent | Not documented **[UNVERIFIED]** |

- **[INFERRED]** Store every status effect per power, not globally. Reason: documented powers have different mechanics and durations.  

---

## 6. HURTING THE OPPONENT

### Causes

- **[VERIFIED]** Normal kicks can damage an opponent on contact. (NamuWiki Head Soccer)  
- **[VERIFIED]** Power shots and power-button effects can immobilize, stuff, electrocute, or otherwise disable opponents. (Chile, Devil, Colombia, China wiki pages)  
- **[VERIFIED]** Some powers work without ball contact and directly pressure the opponent. (NamuWiki Head Soccer)  

### Does CPU aim at player?

- **[INFERRED]** For normal kicks: no dedicated “aim at player” objective by default; player hits should be incidental when ball and player overlap. Reason: no Arcade source documents deliberate harassment behavior.  
- **[INFERRED]** For opponent-directed power-button effects: yes; fire when player enters the effect geometry. Reason: some powers are explicitly designed to pressure opponents without ball contact. (NamuWiki Head Soccer)  
- **[INFERRED]** For ball-contact powers: choose between goal and player based on `targetGoalBias` and `targetPlayerBias`; do not force all powers toward the goal. Reason: powers such as Chile’s are valuable because they disable/drag the opponent. (Chile wiki page)  

### Punishing a stunned player

```text
IF player.inputLocked OR player.movementMultiplier < 1:
    CPU aggression = max(CPU aggression, 0.85);
    CPU target = ball, then player goal;
    CPU should not retreat unless own goal is immediately threatened;
    CPU should use armed power if its effect benefits from a disabled player.
```

- **[VERIFIED]** Chile’s Snake Shot immobilizes and drags the player toward their own goal, making scoring easier. (Chile wiki page)  
- **[INFERRED]** Set a `punishWindowMs` equal to the specific power’s disruption duration. Reason: each documented effect has its own duration.  

---

## 7. MISTAKES AND HUMANIZING

### Required imperfections

- **[INFERRED]** Add reaction delay before responding to ball direction changes, power cues, and player dashes. Reason: no datamined CPU timing exists, and perfect play would feel artificial.  
- **[INFERRED]** Add landing-point error so CPU does not perfectly intercept every bounce.  
- **[INFERRED]** Add occasional early/late jump timing.  
- **[INFERRED]** Add a 120–220 ms post-whiff kick lockout.  
- **[INFERRED]** Add occasional dash overshoot on low difficulty.  
- **[INFERRED]** Add occasional late or wasted power use.  
- **[INFERRED]** Do not let CPU instantly reverse direction after a bounce.  
- **[INFERRED]** Preserve CPU overcommitment; it should be beatable by lobs and fast counters.  

### Difficulty modifiers

| Parameter | Easy | Mid | Hard | Final boss |
|---|---:|---:|---:|---:|
| Think interval | 220 ms | 130 ms | 65 ms | 35–50 ms |
| Ball prediction horizon | 350 ms | 650 ms | 1,000 ms | 1,200 ms |
| Landing-X error | 10–16% pitch width | 4–9% | 1–4% | 0.5–2% |
| Jump timing error | 80–150 ms | 40–90 ms | 15–50 ms | 0–30 ms |
| Counter chance | 10% | 35% | 65% | 75–85% |
| Power-use delay | 300–700 ms | 120–350 ms | 30–160 ms | 0–100 ms |
| Overcommit chance | 30% | 12% | 4% | 1–3% |
| Defensive goal bias | Weak | Moderate | Strong | Very strong |
| Dash efficiency | Low | Medium | High | Very high |
| Character stat multiplier | 0.85–0.95 | 1.0 | 1.05–1.15 | 1.15–1.25 |

- **[INFERRED]** All numeric difficulty values are implementation targets, not measured Head Soccer values. Reason: no public datamine or official documentation exposes Arcade AI timings or probabilities.  
- **[VERIFIED]** Character stats themselves can differ through upgrades to speed, dash, kick, power charging, and jump. (NamuWiki Head Soccer)  

---

## 8. CHARACTER DIFFERENCES

### Stats

| Stat | Effect on CPU play |
|---|---|
| Speed | **[VERIFIED]** Upgradeable. **[INFERRED]** Increases reachable-ball radius and reduces dash dependence |
| Dash distance | **[VERIFIED]** Upgradeable. **[INFERRED]** Improves emergency saves and recovery |
| Kick power | **[VERIFIED]** Upgradeable. **[INFERRED]** Increases clearance/shot travel and long-kick threat |
| Power charge speed | **[VERIFIED]** Upgradeable. **[INFERRED]** Reduces time before `POWER_ARM` is available |
| Jump height | **[VERIFIED]** Upgradeable. **[INFERRED]** Increases aerial interception and high-ball defense |
| Power geometry | **[VERIFIED]** Powers differ by character. **[INFERRED]** Determines firing zone, target choice, and disruption value |

Source for stat categories: NamuWiki Head Soccer.  
Source for power variation: Google Play description, NamuWiki, and character pages.  

### Shared AI versus personalities

- **[VERIFIED]** USA’s CPU is described as defensive but still kicks and dashes frequently. (USA wiki page)  
- **[VERIFIED]** Chile’s CPU is described as offensive and possession-oriented. (Chile wiki page)  
- **[VERIFIED]** Spain’s CPU is described as quite defensive. (Spain wiki page)  
- **[VERIFIED]** Devil’s CPU is described as very offensive. (Devil wiki page)  
- **[INFERRED]** Implement these as behavior modifiers on a shared AI, not entirely separate AI scripts. Reason: documented differences are tendencies and power mechanics, not full source-code AI trees.  

### What makes a CPU stronger

- **[VERIFIED]** Stronger stats/loadouts can make CPUs stronger; Head Cup later opponents can receive upgraded dash, kick, power, jump, and speed plus strong costumes. (Head Soccer Fandom Beginners Guide)  
- **[VERIFIED]** Strong powers matter: Chile’s immobilization, Spain’s three-ball laser, Devil’s mobility/disruption, and USA’s eight-ball illusion shot are all mechanically distinct. (Character wiki pages)  
- **[INFERRED]** Arcade strength should come from: power quality, stats/loadout, and a modest AI-tier modifier. Reason: no Arcade-only evidence supports a separate “smartness” stat.  
- **[VERIFIED]** Star rating is an Arcade opponent label, but no source documents a direct star-to-AI-skill formula. (Character wiki pages)  

### Example champion profiles

| Champion | Arcade CPU behavior | Implementation profile |
|---|---|---|
| USA | **[VERIFIED]** Defensive but kicks/dashes frequently; never tries to counter shots. (USA wiki page) | `aggression = 0.35`, `counterSkill = 0`, high kick/dash usage, Illusion Shot uses one real ball among eight fakes |
| Chile | **[VERIFIED]** Offensive, possession-oriented; Snake Shot immobilizes/drag player for 2 seconds. (Chile wiki page) | `aggression = 0.85`, `possessionBias = 0.90`, midfield Snake Shot, high punish priority |
| Spain | **[VERIFIED]** Quite defensive; Laser Shot has three balls and is best around semicircle. (Spain wiki page) | `aggression = 0.35`, `homeGoalBias = 0.80`, strict power range, high counter-defense priority |
| Devil | **[VERIFIED]** Very offensive; power-button state raises speed/jump; Vampire Shot lasts 3 seconds and can ground-stuff player. (Devil wiki page) | `aggression = 0.95`, early power use, high aerial/dash bias, strong post-power pressure |
| Kepler-22b | **[VERIFIED]** Uses power shots of 16 earlier characters. (Kepler-22b wiki page) | Randomly select one legacy power per use; dynamically apply that power’s firing profile |

---

## 9. DIFFICULTY TABLE

| Parameter | Easy | Mid | Hard | Final boss |
|---|---:|---:|---:|---:|
| Reaction time | 180–280 ms | 90–160 ms | 45–90 ms | 30–60 ms |
| Think interval | 220 ms | 130 ms | 65 ms | 40 ms |
| Ball prediction horizon | 350 ms | 650 ms | 1,000 ms | 1,200 ms |
| Landing-X accuracy | 10–16% pitch width error | 4–9% error | 1–4% error | 0.5–2% error |
| Jump timing | Frequent early/late errors | Occasional errors | Rare errors | Near-optimal |
| Dash usage | Emergency only | Regular | Efficient/early | Optimal |
| Power-use delay | 300–700 ms | 120–350 ms | 30–160 ms | 0–100 ms |
| Power counter chance | 10% | 35% | 65% | 75–85% |
| Aggression | 0.35 | 0.55 | 0.75 | 0.85–0.95 |
| Defense bias | Weak | Moderate | Strong | Very strong |
| Overcommit chance | 30% | 12% | 4% | 1–3% |
| Stat multiplier | 0.85–0.95 | 1.0 | 1.05–1.15 | 1.15–1.25 |
| Hidden cheats | None | None | None | None |

- **[INFERRED]** All values are design targets, not measured original-game constants. Reason: no Arcade datamine or official AI documentation was found.  
- **[VERIFIED]** Keep character stat differences available through the documented upgrade categories. (NamuWiki Head Soccer)  

---

## 10. KNOWN EXPLOITS

| Exploit | Evidence | CPU behavior to preserve |
|---|---|---|
| Bait CPU forward, then lob over it | **[INFERRED]** Natural weakness of a predicted-landing chaser | Allow CPU to overcommit; do not give perfect recovery |
| Counter incoming power with a normal kick | **[VERIFIED]** Power Shot Guide | CPU must have imperfect counter timing, not automatic counters |
| Jump over Colombia’s mob and move close to goal | **[VERIFIED]** Colombia wiki page | CPU should not magically avoid this vulnerability |
| Run forward, jump, and kick to counter China’s Buddha Shot | **[VERIFIED]** China wiki page | Keep Buddha Shot counterable |
| Stay grounded and kick to counter certain slow/straight shots | **[VERIFIED]** Power Shot Guide | Implement power-specific counter windows |
| Use jump plus kick consecutively against South Africa’s air shot | **[VERIFIED]** Power Shot Guide | Implement aerial counter timing |
| Exploit Portugal’s close-range power-shot miss | **[VERIFIED]** Glitches page: shot can miss near goal and Portugal leaves screen until a goal is scored | Do not silently fix documented power-specific failure cases |
| Block USA’s Illusion Shot with a special counter or power block | **[VERIFIED]** USA wiki page | Model one real ball and seven fakes; do not make all eight real |

- **[INFERRED]** Preserve flaws that emerge from imperfect CPU reaction and overcommitment. Reason: they make the CPU feel like the original arcade opponent rather than an unbeatable solver.  

---

## 11. UNKNOWNS

| Unknown | Current status | How to measure |
|---|---|---|
| Exact Arcade ladder length/order for a target version | **[UNVERIFIED]** | Record the Arcade opponent-select screen in the exact game version; enumerate opponents in order for multiple player characters |
| CPU reaction time | **[UNVERIFIED]** | Record 60 fps video; count frames from ball direction change or power visual cue to first CPU movement/jump/kick; repeat 30+ times per opponent |
| Ball prediction accuracy | **[UNVERIFIED]** | Frame-track high lobs; compare CPU committed X with actual first reachable bounce/contact X in pixels |
| CPU power-gauge rate | **[UNVERIFIED]** | Start mirrored matches with identical characters and no ball contact; frame-count kickoff-to-full-gauge time for each side |
| CPU power-use logic | **[UNVERIFIED]** | Log every full-gauge event: ball distance, time until firing, player position, score state, and whether a ball-contact opportunity existed |
| Counter window / success rate | **[UNVERIFIED]** | Fire the same counterable power from fixed distance 100+ times; measure power-impact frame, CPU kick-start frame, and return rate |
| Generic stun/knockback duration | **[UNVERIFIED]** | Record 60 fps from effect collision to restored movement/control for each power |
| Whether CPU deliberately targets player with normal kicks | **[UNVERIFIED]** | Create scenarios where shooting at goal and hitting player conflict; test whether CPU repeatedly chooses player contact when goal is open |
| Character-specific AI scripts | **[UNVERIFIED]** | Compare normalized scenarios across characters with controlled upgrades; measure approach distance, jump timing, power hold time, and dash frequency |
| Arcade-only CPU stat boosts | **[UNVERIFIED]** | Compare player and CPU horizontal speed, jump apex, kick travel, and gauge fill using the same character/configuration in Arcade |
| Exact final-boss behavior | **[UNVERIFIED]** | Identify the last Arcade opponent in the target version; run the same reaction/prediction/power tests against it |
