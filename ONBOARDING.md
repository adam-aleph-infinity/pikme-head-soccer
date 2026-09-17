# Onboarding — סלטיז ראשים (head soccer)

You own this game. Not a ticket in it — the whole thing.

`README.md` explains what the game *is* and why every number in it is what it is. Read it once,
properly; it is long because the answers to "why is the goal 160 tall" are all in there and you
will otherwise re-derive them. This file is the other half: how to run it, what you are allowed
to break, and how your change reaches a phone.

---

## 1. The one rule

**This repository is your whole world.** Change anything in it, ship it whenever you like, break
it in production if that is what learning costs — nobody will be angry, and there is a rollback
button that takes thirty seconds.

What is *not* yours, and what you have no access to:

| | |
|---|---|
| `pikmeTV-app` / `pikmeTV-saltiz` | the React Native app on the App Store |
| `pikme-server` | the production backend, real users, real money |
| `saltiz-cards` | the card/album system |
| the Render workspace | one API key there can restart the production backend |

You do not need any of them to do this job, and you will not be given them. If a change seems to
require one, that is the signal to stop and ask — not to go looking for credentials.

**Why the game can be broken freely and the rest cannot:** this game is a self-contained static
page plus a small WebSocket server. It holds no user data, no secrets, and no database. Its only
dependency is `ws`. The worst outage you can cause is "one mini-game does not load", and today it
is not even shipped in the app build yet — it is a URL. That is exactly why it is the good thing
to hand to someone new.

---

## 2. Get it running (5 minutes)

Requires **Node 20 or newer** (`node -v`). Nothing else — no database, no env file, no account.

```bash
git clone https://github.com/adam-aleph-infinity/pikme-head-soccer.git
cd pikme-head-soccer
npm install
npm test          # ~1500 assertions, all green. If they are not, say so before you change anything.
npm start         # → http://localhost:3020
```

`npm start` prints two URLs. The second is your LAN IP — open **that** on your actual phone,
on the same wifi, and you are playing the real thing with real thumbs. Do this on day one. It is
the only way to feel what you are building.

---

## 3. The phone simulator

The desktop browser is a liar for this game: it is played in landscape, inside a WebView, with
thumbs. A 1440px window with a mouse will not show you that the pitch is under the buttons or
that a tap misses.

```bash
npm run sim                      # iPhone 14 landscape, touch events, iOS user agent
npm run sim -- --list            # every device preset
npm run sim -- --device=se       # the smallest screen we support — break it here first
npm run sim -- --duo             # two phones side by side: open a room on the left, join on the right
npm run sim -- --album=8         # pretend the player owns only 8 cards (see below)
npm run sim -- --devtools        # with DevTools open
```

It starts the server if one is not already running, sizes a Chrome window to the device, turns on
real touch emulation, and mirrors any page error into your terminal — a boot exception in a
chromeless window is otherwise a black screen with no clue.

**`--album` is the flag worth understanding.** Inside the app, the player's card collection is
injected as `window.SALTIZ_CARDS` before the page boots, and it decides which heads they may
play. Outside the app there is no album, and that deliberately means *no gate at all* so the game
stays testable in a browser. Those are two different code paths and only `--album` reaches the
second one without a real app build. If you touch the pick screen, test both.

---

## 4. The instruments

Balance here was measured, not argued about. The throwaway scripts in the repo root are how:

| | |
|---|---|
| `node _why.mjs` | **run this first.** A census of goals by cause — power shots, lobs, a defender out of position. Each of those has a different fix, and guessing which one you have is how a day disappears |
| `node _feel.mjs` | goals per match over many bot-vs-bot matches — the headline number |
| `node _wall.mjs` | can a correctly positioned defender stop a shot at all? Separates a physics hole from a bot that is standing in the wrong place |
| `node _sweep.mjs` | isolate one dial and watch the outcome move |
| `node _pace.mjs` | the `PACE` table in the README, regenerated |
| `node _shot.mjs` | drives the real client in headless Chrome and screenshots it. Screenshots land in `.shots/` |

They found a ball-tunnelling bug worth 52% of all goals that no unit test ever saw. A number like
"the score was 15-12" reads as broken without telling you which of twenty constants did it.

**For taste-level tuning, do not edit `shared/constants.js` blind.** The in-game **⚙** menu has a
live tuner over 28 constants, and **העתק JSON** copies the diff of what you changed. Feel it
first, paste the diff second.

---

## 5. Five traps that will each cost you an afternoon

1. **Restart the server after editing `shared/constants.js`.** Node holds the constants from load;
   a browser refresh picks up the new file. An old server and a fresh client then disagree about
   the pitch and online play desyncs. It looks exactly like a netcode bug and is not one.
2. **The heads are DOM elements, never canvas.** Card art blitted into a canvas renders *blank*
   inside WKWebView while Chrome shows it fine — a day lost on the sibling football game. Pitch,
   ball, bodies and effects are canvas; the two heads are `<div>`s with a background image.
3. **`RARITIES` in `public/game.js` is rarest-first** (legendary → common) while `shared/cards.js`
   orders its own list common-first, because the rarity ladder indexes off it. Making one match
   the other opened every player on the *worst* card they own.
4. **The WebSocket path is `/ws`.** A probe at the bare origin fails and means nothing.
5. **Never index server-side inputs by client tick.** It assumes synchronised clocks; under real
   latency every input arrives "already past" and is dropped, so the player simply never moves.
   The tick is a sequence number; drain an ordered queue. `test-net.mjs` asserts this — dash (a
   double-tap, so two rising edges) is the canary for the whole input chain.

---

## 6. Shipping

Production is one URL: **https://pikme-headsoccer.onrender.com** — a single Render web service in
Frankfurt, paid plan (a free one sleeps for 30-50s, which kills a game whose entire feature is
"send a friend a link").

**Push to `main` and it ships.** A GitHub Action runs `npm test` and then redeploys; the whole
thing takes 2-4 minutes. There is no review gate and no staging, on purpose — this is a mock and
the point is to iterate fast. The test suite is the only gate, and it is there to catch "the page
does not boot", not "the feel got worse".

Watch it: the **Actions** tab on GitHub. Verify it: open the URL on your phone.

**If you break it:** either push a fix, or `git revert` and push — same 3 minutes either way. If
the service itself is wedged, ask Adam to roll back the deploy in the Render dashboard; previous
builds are one click away.

Two things not to change without asking, because something outside this repo points at them:
- the Render service **name** (`pikme-headsoccer`) and therefore the URL — the app hard-codes it
- the WebSocket **path** (`/ws`) and the shape of what crosses it, while a released build is live

---

## 7. Where things are

```
server.js                 static server + the authoritative 1v1 host. ~300 lines, read it all
shared/                   everything both sides run — this is the game
  constants.js            every dial. The tuner edits these live
  sim.js                  the physics and the match state machine
  bot.js                  the AI opponent, difficulty 0-9
  cards.js                which card gives which power (number = which, rarity = how good)
  powerups.js             what each power does
  powershots.js           the five shot families
  skills.js  spectacle.js the flashy layer
  net.js  rooms.js        wire format and lobby
public/
  game.js                 the client: pick screen, rendering, input. The biggest file here
  head-crop.js            the card-art → face-circle maths, the single copy of it
  stages.js  audio.js     backgrounds and sound
  data/head-anchors.json  where the face sits on each of the 180 cards, measured offline
test-*.mjs                the suite npm test runs
_*.mjs                    the instruments and the simulator. Throwaway by design
docs/ONLINE-DESIGN.md     how the netcode was meant to work
AGENT_PROMPT.md           the brief to hand your coding agent
```

---

## 8. First week, suggested

1. Play it on your phone over LAN, and play a 1v1 against someone with `--duo` or a share link.
2. Run `npm test`, then `node _why.mjs`, and read what it says about where goals come from.
3. Change one constant in the ⚙ tuner until something feels better, then land that diff in
   `shared/constants.js` with a commit message saying what it felt like before and after.
4. Push it. Watch the Action. Open the URL on your phone.
5. Then pick something real: the anchors list `test-heads.mjs` prints is a standing to-do —
   37 cards claim a head bigger than the code will allow and are being silently capped.

Questions about the game: the README almost certainly answers it. Questions about access,
production, or anything outside this repo: ask Adam first, every time.
