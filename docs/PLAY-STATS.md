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
