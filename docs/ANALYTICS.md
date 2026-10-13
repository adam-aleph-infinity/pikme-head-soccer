# Gameplay analytics

The Salties counts how the game is played (modes, matches, trophies, unlocks) through PostHog's EU cloud. It never counts who is playing.

**Decisions (Idan, 2026-10-13)**
- **Who gives consent:** the Saltiz app decides.
- **Identity:** a separate anonymous id.
- **Region:** EU.
- **Match events:** cover every mode.

## How it is built

| File | What it does |
|---|---|
| `shared/analytics.js` | The rules. Pure and tested in Node (`test-analytics.mjs`). Covers the allowlist, consent, the queue, sessions, modes, matches ending once, and the per-session cap. |
| `public/analytics.js` | The page side. Holds the provider key, sends to PostHog, handles the page lifecycle, consent sources, debug logging, and the typed calls the game uses. |
| `public/game.js`, `public/menus.js` | One-line hooks. Search for `AN.` and `ctx.onScreen` / `ctx.onMode`. |

**No PostHog SDK.** Events go out as one `fetch` to `https://eu.i.posthog.com/batch/`. Because the SDK is never loaded:
- Autocapture, session replay, heatmaps, surveys, cookies and text capture **cannot** run.
- Every event carries `$process_person_profile: false` (no person profiles) and `$geoip_disable: true` (no location lookup).

**Never blocks a match.**
- Events wait in memory and are sent every 15 s, at 20 events, or when the page is hidden.
- The body is `text/plain`, so no CORS preflight is needed. On hide it is sent with `sendBeacon`.
- A failed send is retried once, then dropped.
- No call can throw into the game.

## Switches

| Switch | Effect |
|---|---|
| `KEY` in `public/analytics.js` empty | **Analytics fully off.** This is the default; nothing is created or stored. |
| Dev host (localhost, LAN) | Off, even with a key, unless the URL has `?analytics=send`. |
| `?analytics=debug` | Logs every event and every dropped property to the console and to `window.__ANALYTICS_LOG`. **Sends nothing.** Works without a key. |
| `?analytics=send` | Sends, and logs as `debug` does, failures included. |
| `window.SALTIZ_ANALYTICS = true / false` | **Consent, from the Saltiz app**, set before `game.js` runs. If absent, nothing is kept. The app can change it later with `window.saltizSetAnalytics(bool)`. |
| `?consent=1` | Stands in for the app's `true`. Dev hosts only. |
| Options → "נתוני שימוש אנונימיים" | Shown only when the app said yes. Lets the player turn it off (`hs.analytics.off = 1`) and on again. The player can never turn it on unless the app has said yes. |

**Consent states**

| State | What happens |
|---|---|
| unknown | Calls are dropped, not queued. |
| granted | An anonymous id is made if there is none, and `session_start` is sent. |
| denied | The queue is emptied and the id is deleted. |

**The anonymous id** (`hs.analytics.id.v1`)
- A random `crypto.randomUUID()`, separate from the league's `hs.device.v1`, so analytics can't be joined to league data.
- Made only after consent.
- Deleted on opt-out. A new one is made if the player opts back in.
- Clearing site data or reinstalling resets it.

## Events (the allowlist)

**On every event.** Added at send time, outside the allowlist:
- `session_id`
- `platform`: `saltiz_ios`, `pwa` or `web`
- `app_version`: short git SHA from `/version`, or `dev`
- `protocol`

**Validation rules**
- Every value must be a whole number in range, a boolean, or one of a fixed list.
- A property that fails is dropped (and logged in debug). An unknown event is dropped.
- A session sends at most **80** events.

**Mode names:** `practice`, `arcade`, `tournament`, `tutorial`, `online` (a friend's room), `arena`.

| Event | Properties | Fires at |
|---|---|---|
| `session_start` | (none) | Consent granted on load; back after more than 30 min away |
| `session_end` | `duration_s` (foreground time) | Page hidden / closed |
| `mode_enter` | `mode` | Mode carousel (`menus.js enterMode`); `playArena()`; `openLobby()`; tutorial start; any match start |
| `mode_exit` | `mode`, `duration_s` | Home or title screen (after a 2 s grace); another mode; page hidden |
| `matchmaking_start` | `trophies` | `playArena()` |
| `matchmaking_found` | `wait_s` | League `found` |
| `matchmaking_cancel` | `wait_s` | Arena search Cancel |
| `match_start` | `mode`, `champ` (`mythic_1` …), `trophies`, `opp_trophies`\*, `vs_cpu`\* | `beginLocal()` (not the tutorial drills), `startOnlineMatch()` |
| `match_end` | `mode`, `result`, `score_me`, `score_opp`, `duration_s`, `trophy_delta`\*, `trophies`\*, `ranked`\* | `endMatch()`. For the arena, when `arenaResult` arrives, or 8 s later without trophies |
| `match_quit` | `mode`, `elapsed_s`, `score_me`, `score_opp` | GIVE UP; TITLE from the pause menu |
| `disconnect` | `mode`, `elapsed_s` | Socket drops during a server-run match (online or arena vs a human) |
| `item_unlock` | `item_type` (`mythic`, `stat_level`, `arcade_stage`), `item_id`, `level` | Starter pick; team switch; shop level bought; arcade stage unlocked |
| `trophy_milestone` | `arena` (1–10) | `arenaResult.newArena` |

\* Arena only.

**Rules behind the table**
- **One ending per match.** Each match ends once: `match_end`, `match_quit` or `disconnect`, whichever comes first. A GIVE UP is not also counted as a `match_end` when the server's result arrives late.
- **Not tracked:** per frame, per kick, per goal, nicknames, typed text, chat, location.
- **Reserved, not built:** `ad_watched` and `purchase`. The game has no ads and no real-money purchases. Stat-shop buys use Saltiz points, so they are `item_unlock`.

**Limits of `session_end`**
- It fires when the page is hidden.
- If the player returns within 30 minutes, the same session continues. The next `session_end` carries the longer duration, so **use the max `duration_s` per `session_id`**.
- A killed app or a crash can lose the last batch.
- `mode_exit` on hide is matched by a fresh `mode_enter` on return.

**Volume:** about 2 session events, 4–6 mode events and 2–4 per match. That is roughly 20–40 for a session of 6–10 matches.

## Verifying

**Tests**
- `node test-analytics.mjs`
- The whole suite: `npm test`

**Local debug**
1. Run `npm start`.
2. Open `http://localhost:3020/?analytics=debug&consent=1`.
3. Play, and watch `[analytics]` lines in the console. `window.__ANALYTICS_LOG` holds them all.
4. `window.__ANALYTICS.core` shows the consent, the queue and the session.
5. The Network tab shows no request to posthog.

**Live**
1. With the key set, open the production URL inside the app (consent true), or `localhost:3020/?analytics=send&consent=1`.
2. In PostHog, open **Activity → Live events**.
3. Events should arrive within about 15 s, or at once when the tab is hidden.
4. Check that none has `$ip`, a GeoIP property or a person profile.

## PostHog setup (owner's checklist; not legal advice)

**Create the project**
- Create it in the **EU** cloud.
- Put the project API key (`phc_…`, public by design) in `KEY` in `public/analytics.js`.

**Project settings**
- Turn **on** *Discard client IP data*.
- Turn **off** autocapture, session replay, heatmaps, web vitals, exception autocapture and surveys. The page can't use them, but turning them off keeps it that way if an SDK is ever added.
- Leave the toolbar unauthorised.
- Set the timezone to Asia/Jerusalem.

**Cost**
- The free plan includes 1M events a month, about 33k sessions at ~30 events each.
- With **no card on file**, events past the quota are dropped, not billed. That is the $0 ceiling.
- If a card is ever added, set a per-product **billing limit** in Billing, and check whether your plan allows a $0 limit.
- Watch **Billing → Usage**, and an Insights trend of event count broken down by event name.

**Retention:** keep the plan default. Check the current retention period for your plan in PostHog before quoting it in a policy.

**Saltiz app**
- Set `window.SALTIZ_ANALYTICS` from its parental consent before the game loads.
- Allow `eu.i.posthog.com` if the WebView restricts outside hosts.

**Privacy policy / parental notice**
- It probably needs to cover:
  - anonymous gameplay statistics
  - PostHog (EU) as processor
  - what is and isn't collected
  - retention
  - how to turn it off
- Children's privacy rules (COPPA, GDPR-K, Israel's Privacy Protection Law, Amendment 13) depend on how Saltiz gets parental consent. **Ask a privacy lawyer.** Nothing in this code makes the game compliant by itself.
