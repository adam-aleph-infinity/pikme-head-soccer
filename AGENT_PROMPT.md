# The brief for your coding agent

Paste everything below the line into your agent (Claude Code, Cursor, Codex — it does not
matter) as its standing instructions for this repository. Or, if your agent reads project files,
just tell it: *"read AGENT_PROMPT.md and ONBOARDING.md before you touch anything."*

---

You are working on **סלטיז ראשים / head-soccer** — a 1v1 Head Soccer-style mini-game where the
players' heads are Saltiz trading cards. It is a browser game: a static page plus a small
WebSocket server, written in plain ES modules with exactly one dependency (`ws`). No build step,
no framework, no database, no secrets. It runs inside a WKWebView in the Saltiz iOS app, locked
to landscape, played with thumbs.

Your developer owns this game outright. Move fast, ship often, and break it if that is what
learning it costs — there is a revert and a rollback.

## Scope — the hard boundary

Everything you do happens inside **this repository**. Nothing else exists for you.

- Do not look for, ask for, or use credentials for: the Saltiz iOS app repos, the production
  backend, the cards/album system, Render, Supabase, MongoDB, App Store Connect.
- Do not add a dependency that needs an API key, and do not introduce environment variables. The
  only one this project has is `PORT`, and that is the way it should stay.
- If a task appears to need something outside this repo, **stop and say so**. Do not work around
  it, do not scaffold a substitute, do not go hunting for a token on the machine.

The reason is not distrust, it is blast radius: this game holds no user data and can be
redeployed in three minutes, which is why it can be handed over freely. The moment a change
reaches past it, that stops being true.

## Read before writing

1. `README.md` — what the game is and *why every number is what it is*. It is long on purpose.
   Almost every "should this be higher?" question is already answered there, with the measurement
   that answered it.
2. `ONBOARDING.md` — how to run it, the traps, how shipping works.
3. `shared/constants.js` — every dial in the game, commented.

Do not restate these files back at the user. Read them and act.

## Run it

```bash
npm install
npm test                    # ~1500 assertions across 10 suites. Must be green before and after.
npm start                   # http://localhost:3020 — prints a LAN URL for a real phone too
npm run sim                 # the phone simulator, below
```

Node 20+, plus a Chrome-family browser for the visual harnesses — they speak the DevTools
Protocol and Safari does not. `brew install --cask google-chrome`, or set `CHROME_BIN`.
`npm test` takes well under a minute; run it, do not assume it.

## Verification — the part that matters most

**A claim about this game is worthless without a picture or a number.** It is a game: "it should
feel better now" and "the layout looks fine" are not results. The specific failure to avoid is
fixing something in a way that is correct in the code and wrong on the device.

Before you tell anyone a change works:

- **Render it at the size it ships at.** `npm run sim -- --device=se` is the smallest screen we
  support and the one that breaks. `node _shot.mjs` drives the real client in headless Chrome and
  writes PNGs to `.shots/` — look at them.
- **Measure balance, never assert it.** `node _why.mjs` classifies goals by cause (from one
  fixed matchup — an A/B instrument, not a population census);
  `node _feel.mjs` gives goals per match; `node _wall.mjs` says whether a correctly positioned
  defender can stop a shot at all. A tuning change with no before/after number is not finished.
- **Test both album paths.** `npm run sim -- --album=8` simulates the app injecting a real card
  collection, which gates which heads are playable. With no album there is deliberately no gate.
  A pick-screen change that was only tested in a plain browser has been tested once, not twice.
- **Play the actual flow.** If you changed the 1v1 lobby, open `npm run sim -- --duo` and join a
  room from the second window. A unit test that calls `joinRoom()` has not proven a player can
  join a room.

If you could not verify something, say which part you could not verify. Never round a partial
check up to "done".

## The phone simulator

```bash
npm run sim                      # iPhone 14, landscape, touch events, iOS user agent
npm run sim -- --list            # all device presets
npm run sim -- --device=se       # the floor: 667x375 @2x
npm run sim -- --duo             # two phones side by side, for 1v1
npm run sim -- --album=8         # with a fake card collection injected, like the app does
npm run sim -- --devtools        # DevTools open
```

It starts the server if needed, applies real device metrics plus touch emulation plus an iOS user
agent (all three — metrics alone give you a phone-shaped mouse), injects the album exactly when
the app injects it, and mirrors page errors into the terminal. Ctrl-C cleans up.

## Traps that have already cost days

1. **Restart the server after editing `shared/constants.js`.** Node holds them from load while the
   browser refetches the file, so the server and client disagree about the pitch and online play
   desyncs. It presents as a netcode bug. It is not one.
2. **Heads are DOM, never canvas.** Card art blitted into a canvas renders blank inside WKWebView
   and perfectly in Chrome. Pitch, ball, bodies, effects: canvas. The two heads: `<div>`s with a
   background image. Do not "simplify" that.
3. **`RARITIES` in `public/game.js` is rarest-first; `shared/cards.js` orders common-first.** The
   mismatch is deliberate — the rarity ladder indexes off the second one. Aligning them opened
   every player on the worst card they own.
4. **The WebSocket path is `/ws`.** A probe at the bare origin proves nothing.
5. **Never key server-side inputs by client tick.** Clocks are not synchronised; under latency
   every input looks "already past" and gets dropped, and the player never moves. Treat the tick
   as a sequence number and drain an ordered FIFO. Rollback snapshots must also carry `prev`, the
   previous frame's input, or a held key re-fires on every reconcile — the sim finds actions on
   edges. `test-net.mjs` covers this; dash is the canary because a double-tap is two rising edges.
6. **The pitch must clear the buttons.** Controls sit in a band at the bottom and the ground line
   is placed at the top of it. A change that moves either one needs a screenshot at `--device=se`.

## Working style

- **Small, complete changes.** One behaviour per commit, tests green, verified at phone size.
- **Tune with the in-game ⚙ tuner first** (28 live constants; **העתק JSON** copies your diff),
  then land the diff in `shared/constants.js`. Editing constants blind and reloading is slower and
  tells you less.
- **Add a test when you fix a bug**, next to the suite that should have caught it. The suites are
  plain Node scripts — no framework, copy the shape of the neighbours.
- **The UI is Hebrew and right-to-left.** Keep strings in Hebrew, matching the existing voice.
- **Commit messages** follow the repo: a conventional prefix and then a sentence that says what
  changed in human terms, e.g.
  `feat(power): a three-second wind-up, and the cancel window that makes it playable`.
  Put the reasoning in the body. The git log here is the design history and is expected to read
  like one.
- **Comments explain why, not what.** This codebase is heavily commented with the reason a number
  is that number. Match that; it is what makes it maintainable by one person.

## Shipping

Push to `main` → a GitHub Action runs `npm test` → Render redeploys
**https://pikme-headsoccer.onrender.com** in 2-4 minutes. No review gate, by design.

Never claim a deploy succeeded from the fact that you pushed. Check the Actions run, then check
the URL answers, then look at it on a phone.

Do not change the Render service name, the production URL, or the `/ws` path — things outside this
repo point at them.

## Definition of done

- [ ] `npm test` green
- [ ] rendered and looked at, at `--device=se` and one large device
- [ ] if it touches balance: a before/after number from `_why.mjs` / `_feel.mjs` / `_wall.mjs`
- [ ] if it touches the pick screen: tested with and without `--album`
- [ ] if it touches 1v1: joined a real room with `--duo`
- [ ] committed with a message that explains the change and the reason
- [ ] anything you could not verify is stated plainly, not omitted
