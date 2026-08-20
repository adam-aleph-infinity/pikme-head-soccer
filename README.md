# ⚽🗣 סלטיז ראשים — head-soccer mock

Throwaway prototype in the mould of **Head Soccer (D&D Dream)**: 1v1, big heads, five
buttons, and a power shot that decides matches. The hook: **the big head is one of your
Saltiz cards**, cropped to the face automatically.

> Same "mock" status as `football-mock` and `voxel-mock` — built to be *felt*, argued with,
> and thrown away or promoted. Nothing here is wired to the app yet.

## Run

```bash
cd head-soccer-mock
npm start          # PORT=3020 by default (3010-3019 belong to other agents)
```

Then open the **phone URL** the server prints (the LAN IP), not `localhost`.

```bash
npm test           # sim + bot tests, headless
node _shot.mjs     # drives the real client in Chrome and screenshots it
```

## Controls

| | walk | dash | jump | kick | power |
|---|---|---|---|---|---|
| **keys** | `A`/`D` or `←`/`→` | double-tap a direction | `W` `↑` `Space` | `S` `↓` `K` | `J` `L` `Shift` |
| **touch** | ◀ ▶ (left thumb) | double-tap | קפיצה | בעיטה | POWER |

`?pad=1` forces the touch pad on in a desktop browser.

## What was taken from the real game

Researched from the [Head Soccer wiki](https://headsoccer.wiki.gg/wiki/Controls) — the
mechanics that actually define it, not just the look:

- **Five buttons, nothing else.** Left, right, jump, kick, power. Dash is a double-tap.
- **The power gauge fills with match time**, not with touches. When it's full the POWER
  button lights; pressing it **arms** you, and the *next* ball contact fires your shot.
- **Five shot families** from the wiki's taxonomy — `straight`, `arc`, `trap`, `wave`,
  `homing` — see [`shared/powershots.js`](shared/powershots.js). A shot that connects
  knocks the defender down and punches through.
- **Counter attacks.** Kick a live power ball at the right moment and it reverses *and you
  inherit their shot*. That's the skill ceiling.
- **Sudden death** on a draw, with both gauges frozen — so overtime is decided by play.

## The card → head pipeline

Cards are 400×545 illustrations, and the subject sits somewhere different on every one, so
a fixed crop framed shoulders and bookshelves. Instead, macOS **Vision.framework** detected
the face box on all 180 cards offline; those boxes are expanded to a head circle and baked
into [`public/data/head-anchors.json`](public/data/head-anchors.json) (178 auto, 2 fallbacks).
At runtime the head is just a CSS background window onto the card at the baked anchor.

Every one of the 180 cards is playable, and each gets a deterministic power shot; five
hand-picked cards get a themed one (the grill card throws fire, the tentacle card traps you).

**The heads are DOM, never canvas.** Card art blitted into a canvas renders blank inside
WKWebView — the trap that cost a day on `football-mock`. Pitch, ball, bodies and FX are
canvas; the two heads are `<div>`s with a background image.

## Layout

```
shared/constants.js    every tunable number, live-bindable (see the tuner below)
shared/sim.js          authoritative physics + rules. Pure, no DOM, no timers.
shared/powershots.js   the five shot behaviours + the card→shot mapping
shared/bot.js          the opponent. Emits the same input a human does.
public/                pick screen, renderer, input, tuner
server.js              static host. Becomes the authoritative server if this graduates.
```

The `shared/` split is deliberate: it's the same shape as `football-mock`, so making this
a real networked 1v1 is a lift-and-shift rather than a rewrite.

## The tuner ⚙

Tap the gear in-match for live sliders over all 28 gameplay constants — speed, kick power,
gravity, goal size, gauge fill, everything. Changes land on the **next tick**, mid-match.
"העתק JSON" copies only what you changed, so a feel you like comes back as a paste.

This exists because arguing about `KICK_LIFT` between restarts is not how a feel gets found.

## Instruments

Balance was measured, not guessed. Each of these answers one question:

| | question |
|---|---|
| `node _feel.mjs 3,3` | how many goals does a match actually produce? |
| `node _why.mjs 3,3 8` | *where* do the goals come from — power shot, lob, out of position? |
| `node _wall.mjs static` | can a positioned defender stop shots at all? (physics vs bot) |
| `node _sweep.mjs` | isolate one bot dial and watch the scoreline move |

Three real bugs came out of them, all invisible to the unit tests:

1. **A fast ball tunnelled the defender's body box** in one tick, and the nearest-point
   push-out then resolved it on the *wrong side* — straight into the net. That was 52% of
   all goals. Fixed by sub-stepping the ball (`shared/sim.js`).
2. **The `aggression` dial was rolled per think**, so the legendary bot (thinking 25×/s)
   pressed 8× more than the easy one at the same setting — the dial did the opposite of
   its name.
3. **Discipline alone isn't skill.** With difficulty tuned only for positioning, the
   legendary bot held its post beautifully and lost 6-3, because it never aimed a kick.
   `aim` is now the main axis of the ladder.

## Open questions for Adam

1. **Goal rate.** Level 3 bots average ~9-10 goals a 60s match; level 5 about 5. Head
   Soccer is genuinely high-scoring, but this may still be too frantic. The tuner is
   deliberately the answer here rather than another number I picked — `GOAL_H`,
   `KICK_POWER` and `PLAYER_SPEED` are the three that move it most.
2. **Is the card the head, or should the card *be* the character?** Right now it's a
   face crop. The alternative — the whole trading card as the body — is a different game.
3. **Rarity stats.** Legendary is ~6% faster / 8% harder-hitting than common. Deliberately
   narrow. Real hook or pay-to-win?
4. **Networked 1v1** was explicitly deferred; the `shared/` split keeps it cheap.
5. **No audio.** `../football assets/` has usable sounds if this goes further.
