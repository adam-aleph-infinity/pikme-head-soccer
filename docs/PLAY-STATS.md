# Play stats (how many play, which modes)

Added 2026-10-13 (Adam's agent, for Idan). **Daily totals on our own server. No ids, no names, no PostHog.**
Nothing stored can tell one child from another, so it needs no consent flag and is always on.
PostHog analytics (`docs/ANALYTICS.md`) is separate and still waits for the app's `SALTIZ_ANALYTICS`.

## Read the numbers

```bash
curl https://pikme-headsoccer.onrender.com/stats/history            # everything so far
curl 'https://pikme-headsoccer.onrender.com/stats/history?days=7'   # the last 7 days
```

Each row of `days` / `weeks` / `months`, plus `allTime`:

| Field | Meaning |
|---|---|
| `players` | Devices that opened the game in that day / week / month (all-time: devices ever counted) |
| `newPlayers` | Devices that had never played (no tutorial, no starter) |
| `inAppPlayers` | Of the day's players, those inside the Saltiz app (days only) |
| `opens` | Game opens |
| `minutesPlayed` | Foreground time |
| `matches` | Matches started, all modes |
| `modes.<mode>` | `entered`, `started`, `finished`, `quit`, `dropped`, `minutes`. Modes: practice, arcade, tournament, tutorial, online, arena |

Days are Israel days; weeks are ISO weeks (Monday start).

### Added 2026-10-14 (Idan: peak, per hour, the tutorial, "what else is critical")

Still only counters: the device remembers a little more about itself, the server adds 1, no row names anyone.

| Field | Meaning |
|---|---|
| `peakOnline` | Most phones with the game open at the same moment that day (the server's socket count). Weeks, months and all-time take the highest, not the sum |
| `hours[]` (days only) | Per Israel hour: `players` (phones that opened the game in that hour), `opens`, `newPlayers`, `minutes`, `matches`, `peakOnline`. Compares two days at the same time of day |
| `alsoPlayedDayBefore` | Of the day's players, those who played the day before too |
| `newPlayerSteps` | The new player's journey, each step once per phone, on the day it happens: `opened` (= newPlayers), `starter` (picked a Mythic), `tut_start` / `tut_done` (the tutorial match), `first_match` / `first_finish` (the first real match) |
| `retention[]` (top level) | Per day that new players first played: `newPlayers`, and `day1` `day2` `day3` `day7` `day14` `day30` = how many of them came back that many days later (`null` = that day hasn't come yet) |
| `friendRooms` | Counted by the server as it happens: `created`, `joined`, `matches` (both ready, kick-off), `failed` by the error the player saw (`not-found`, `full`, `in-match`, `no-codes`, `stale` = an old cached page, `other`) |
| `errors` | `pages`: game visits that hit an error nothing caught (once per visit); `inMatch`: of those, during a match |

Retention and the journey only follow phones that were new to the game after this went live; older players have no "first day".

**A team phone isn't counted.** In Options, tap the logo in the middle 7 times quickly: the title says "טלפון צוות" and that phone sends nothing from then on (`localStorage['hs.playstats.team'] = '1'`). 7 more taps: "נספר שוב". For anyone who opens the game all day to check it.

## How "players" works without an id

The device keeps `localStorage['hs.playstats.v1'] = {day, week, month}` — the last time it said hello.
On open it sends "first time today / this week / this month / ever" flags. The server adds them up.
So a day's `players` is exact per device; a reinstall or cleared storage counts as a new device.

## Files

| File | What |
|---|---|
| `shared/play-stats.js` | The rules: flags, the counters each event adds, the report. Pure. |
| `public/play-stats.js` | The page: queues events, POSTs `/play` every 20 s and on hide (beacon). `withPlayStats(AN, PS)` tees the existing `AN.` calls, so `game.js` has no new hooks. |
| `server/play-stats.js` | `POST /play` (always 204; 60/min per address; 8 KB; 50 events) and `GET /stats/history`. Table `play_daily(day, key, n)` in the league's SQLite file. |
| `test-play-stats.mjs` | Unit + real server end to end (in `npm test`). |
| `_play-stats-live.mjs` | Real headless Chrome: two opens → 1 player, 1 new player. |

Dev hosts (localhost, LAN) send nothing unless the URL has `?playstats=send`.

## ⚠️ The data is wiped on every deploy until a disk is added

The live service has **no Render disk and no `DATA_DIR`** (checked 2026-10-13 via the Render API).
So `./data/league.sqlite` sits on the instance's temporary filesystem and every deploy or restart
wipes it — the play stats **and the league's trophies/teams**. `docs/TEAMS-ARENA.md` says there is a
1 GB disk at `/var/data`; there is not, and `render.yaml` never had one.

Fix (Adam's call — it is billable, about $0.25/month for 1 GB): in the Render dashboard add a disk to
`pikme-headsoccer` mounted at `/var/data`, and set env `DATA_DIR=/var/data`. Note a service with a
disk restarts instead of doing zero-downtime deploys (a few seconds offline per deploy).
