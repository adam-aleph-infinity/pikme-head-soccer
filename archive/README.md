# archive — the systems that were taken out of the match

Nothing in this folder is imported by the game. It is not loaded, not bundled, not stepped
and not tested: `npm test` globs `test-*.mjs` in the repo root, and these files are two
directories down. They are here so a decision can be reversed without archaeology.

Three things were removed, on 2026-09-19:

| what | why it went | file |
|---|---|---|
| **The spectacle** — wind (רוח), low gravity (כוח משיכה נמוך), meteor showers, robot mode | the random match modifiers | `shared/spectacle.js` |
| **The crates** — items that spawned on the pitch: magnet, big head, shield, spring, ice, charge | randomly spawned ball-physics features | `shared/powerups.js` |
| **The hand of three** — the card row under the pitch, and the four specials it could fire | asked for, with a way back | `shared/cards.js`, `shared/skills.js` |

Their tests are in `tests/` and their screenshot harnesses in `shots/`.

---

## Putting the hand of three back

This is the one that was archived rather than deleted, so it gets the full recipe. It is
about twenty minutes of work and every step is additive — nothing below asks you to undo
something else.

The hand needs three modules, because they stack: `cards.js` (the three buttons and the
deal) calls into `powerups.js` (what each power actually DOES), which calls into `skills.js`
(the four specials that put an object on the pitch). Restore all three or none.

### 1. The files

```sh
git mv archive/shared/cards.js archive/shared/powerups.js archive/shared/skills.js shared/
git mv archive/tests/test-cards.mjs archive/tests/test-powerups.mjs archive/tests/test-skills.mjs .
git mv archive/shots/_card-shots.mjs archive/shots/_pickup-shots.mjs archive/shots/_skill-shots.mjs .
```

The tests import `./shared/…`, so they only run from the repo root — which is where the
second line puts them, and where `npm test` will pick them up again.

### 2. The constants

They were cut from `shared/constants.js` as one block; the marker comment
`---- REMOVED: the random match modifiers ----` is still sitting where they were. Take the
block back from git and paste it in there:

```sh
git show <the commit before this one>:shared/constants.js | sed -n '/---- POWER-UPS ---/,/---- Anti-stall ---/p'
```

Then add each name back to three places in the same file, or the tuner will not see it and
`snapshot()` will not round-trip it:

* `SETTERS` — one `NAME: (v) => { NAME = v; },` line per tunable
* `snapshot()` — one `NAME,` line per tunable
* `PACE_REF` — only the ones that are velocities, accelerations or durations. The old
  groupings were: `SKILL_DART_SPEED, SKILL_DOG_SPEED, SKILL_SUPER_PUSH, SKILL_SUPER_LIFT`
  under `vel`; `PU_MAGNET_FORCE` under `acc`; and `PICKUP_WARN, PICKUP_LIFE,
  SKILL_DART_LIFE, SKILL_SHRINK_TIME, SKILL_GROW_TIME, SKILL_WALL_TIME, SKILL_DOG_LIFE,
  SKILL_DOG_HOLD, PU_GROW_TIME, PU_MAGNET_TIME, PU_SHIELD_TIME, PU_SPRING_TIME, PU_ICE_TIME`
  under `time`. `PICKUP_FIRST`/`PICKUP_GAP`/`PICKUP_QUIET_END` were deliberately NOT in it —
  they are match structure, not trajectories.

### 3. The sim

In `shared/sim.js`:

* import `createCards, stepCards, useCard, chargeCards, packCards, unpackCards, CARD_KEYS,
  CARD_SLOTS` from `./cards.js`, and the skills/pickups equivalents
* `createMatch` — add `cards: createCards(charA, charB)`, `pu: createPickups(charA, charB)`,
  `sk: createSkills()` back to the match object
* `step()` — call `stepCards(m)`, `stepSkills(m, fx)`, `stepPickups(m, fx)` before the
  players move, and `collectPickups(m, fx)` after `separatePlayers(m)`
* `stepPlayer()` — the three-card rising-edge loop over `CARD_KEYS`, which must stay an EDGE
  read; there is a long note about why in the git history
* `headR()` — multiply by `puHeadScale(m, p.index) * headScale(m, p.index)` again
* `integrate()` calls — pass `puMaxJumps(m, p.index)` instead of `C.MAX_JUMPS`
* jump velocity — multiply by `puJump(m, p.index)`
* `stepBall()` — call `applyMagnet(m, b, dt)` on a loose ball
* `hitByPowerShot` / `tryTackle` — wrap the effect in `if (!spendShield(m, i))`
* `checkGoal` — the `wallUp(m, defender)` branch
* `resetPositions` — `wipePickups(m, 'goal')` and `wipeSkills(m)`
* `chargeCards(...)` on a kick, a tackle and a goal
* `serialize`/`restore` — the `pk`, `cd`, `sk` fields, and `...CARD_KEYS` in `PREV_KEYS`

`shared/net.js` never lost the three card bits (`card1: 32, card2: 64, card3: 128`), so the
wire needs no change at all — that was left in place on purpose.

### 4. The client

In `public/index.html`, the row between the two thumbs:

```html
<div class="pad-c" id="cardRow">
  <button class="btn card" data-k="card1" data-slot="0"><i class="card-art"></i><b class="card-key">1</b><u class="card-tip"></u></button>
  <button class="btn card" data-k="card2" data-slot="1"><i class="card-art"></i><b class="card-key">2</b><u class="card-tip"></u></button>
  <button class="btn card" data-k="card3" data-slot="2"><i class="card-art"></i><b class="card-key">3</b><u class="card-tip"></u></button>
</div>
```

In `public/game.js`: the imports, `card1..3` in `held` / `ACTIONS` / `DEFAULT_BINDS`
(`Digit1`/`KeyZ` and so on), `paintHand()` and `updateHand()`, the `cardUse` and `puTake`
branches of `drainEvents`, and the draw calls. In `public/style.css`: the `.pad-c` / `.pad
.card` block, which was removed whole and has its own marker comment where it used to be.
In `public/audio.js`: the `pu*` voices.

### 5. Check it

```sh
node test-cards.mjs && node test-powerups.mjs && node test-skills.mjs && npm test
```

---

## Putting the spectacle or the crates back

Same shape, minus the HTML: neither had a control of its own. The spectacle is a single
`m.spec` plus `stepSpectacle(m, fx)` in `step()` and four read-side multipliers
(`spSpeed`, `spKick`, `spJump`, `ballGrav`, `playerGrav`, `windAccel`) at the call sites
listed above. Both were switchable at runtime — `SPECTACLE_ON` and `PICKUPS_ON` — so
restoring the constants and the wiring gets you the off switch back too.

Be aware that `test-ultimate.mjs` asserts that none of this exists: it checks that a match
carries no `spec`/`pu`/`cards`/`sk` state, that the dials are absent from `C.TUNABLE`, that a
dropped ball never drifts sideways, and that three full bot matches emit no event whose name
starts with `meteor`/`moon`/`wind`/`robot`/`pu`/`card`/`dart`/`dog`/`wall`/`super`. Restoring
any of these systems means that section is now wrong and should be deleted along with it —
that is the intended tripwire, not a bug.
