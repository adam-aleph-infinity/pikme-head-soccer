---
name: check-analytics
description: Summarize The Salties' gameplay analytics from PostHog: players, sessions and session length, modes and time in each mode, matches, quits, where and why players left, arena matchmaking and trophies, unlocks, retention, platforms and data health. Use whenever Idan asks to check, summarize or report analytics in any wording, e.g. "check analytics", "summarize analytics", "analytics report", "how are players doing", "what did players do this week", "סכם אנליטיקס", "תבדוק אנליטיקס", or asks about sessions, session time, modes, matches, quits, leaving mid-game, matchmaking or trophies.
---

# Check analytics: The Salties

You produce a short, plain-language report of how players use the game. The data is in PostHog (EU cloud). docs/ANALYTICS.md defines every event and property; read it if anything below is unclear.

## Rules

- **Read-only.** Never create, edit or delete anything in PostHog. No dashboards or insights unless Idan asks.
- **Tool:** `mcp__posthog__exec`.
  - Pass `conversation_id` from the first response on every later call.
  - Send each query as `call execute-sql {"query": "<SQL on ONE line>"}`. Write the SQL on one line, so the JSON stays valid.
  - This skill's queries are already checked against the schema. You don't need `info` or `read-data-schema` before them. Use those only for a question this skill doesn't cover.
  - PostHog prints "taxonomy warnings" for allowlisted events the game hasn't sent yet, such as `match_quit` before anyone has quit. Ignore warnings about the events in GAME below.
- **Range.** Default: the last 7 days. If Idan names a range ("today", "this month", "since Sunday"), change `RANGE` to match and say which range the report covers.
- **Test traffic.** Every query keeps only real traffic (`REAL`). Events with `app_version = 'dev'` are tests from a dev machine. Say how many were left out.
- **Who a player is.** A player is one anonymous `distinct_id`: one phone, not one person. A reinstall counts as a new player. Say this once, in a footnote.
- **Personal data.** Never show anonymous ids, session ids or raw properties.
- **Inferences.** Section 6 is a guess, not a fact. Label it that way.
- **Missing data.** If a question can't be answered from these events, don't guess. Name the event or property that would be needed. Offer to add it to `shared/analytics.js` (SCHEMA) and `public/analytics.js`, allowlisted and with no personal data. Don't add it until Idan says yes.

## Placeholders (substitute before sending)

```
RANGE = timestamp >= now() - INTERVAL 7 DAY
REAL  = coalesce(toString(properties.app_version), '') != 'dev'
GAME  = ('session_start','session_end','mode_enter','mode_exit','matchmaking_start','matchmaking_found','matchmaking_cancel','match_start','match_end','match_quit','disconnect','item_unlock','trophy_milestone')
```

## Step 1: is there real data? (always first)

```sql
SELECT countIf(coalesce(toString(properties.app_version), '') != 'dev') AS real_events, countIf(toString(properties.app_version) = 'dev') AS test_events, uniqIf(distinct_id, coalesce(toString(properties.app_version), '') != 'dev') AS real_players FROM events WHERE RANGE AND event IN GAME
```

What to do with the result:
- **`real_events > 0`:** carry on with real data only.
- **`real_events = 0` and `test_events > 0`:**
  1. Say in one line that there are no real players yet, and why. The game isn't deployed with analytics, or the Saltiz app isn't setting `window.SALTIZ_ANALYTICS = true` (see docs/ANALYTICS.md).
  2. Still run the queries with `REAL = 1 = 1`, so the dashboard shows the test data with its "test data" banner (`data_kind: "test"`).
  3. Keep the chat report to that one line plus the dashboard link.
- **Both are 0:** say so. Refresh the dashboard with `data_kind: "none"` and empty sections.

## Step 2: the queries

Run them, in parallel where you can. Q2–Q4 share the session table `c`, built by the prefix below. Paste the prefix in front of each of those queries.

**SESSIONS PREFIX:** one row per session. `ended_how` is the last thing the player did before leaving.

```sql
WITH s AS (SELECT toString(properties.session_id) AS sid, any(distinct_id) AS player, min(timestamp) AS t_start, maxIf(timestamp, event = 'session_end') AS t_end, maxIf(toInt(properties.duration_s), event = 'session_end') AS secs, groupUniqArrayIf(toString(properties.mode), event = 'mode_enter') AS modes, countIf(event = 'match_start') AS matches, argMaxIf(event, timestamp, event IN ('match_start','match_end','match_quit','disconnect','matchmaking_start','matchmaking_found','matchmaking_cancel','mode_enter','item_unlock','trophy_milestone')) AS last_action, argMaxIf(toString(properties.mode), timestamp, event IN ('match_start','match_end','match_quit','disconnect','mode_enter')) AS last_mode, maxIf(timestamp, event = 'mode_enter') AS t_enter, maxIf(timestamp, event = 'mode_exit') AS t_exit, arraySlice(arrayMap(x -> x.2, arraySort(groupArrayIf(tuple(timestamp, toString(properties.result)), event = 'match_end'))), -2) AS last_results FROM events WHERE RANGE AND REAL AND event IN GAME GROUP BY sid), c AS (SELECT *, multiIf(t_end < t_start, 'no end yet (still playing, or the app was killed)', last_action = 'match_start', 'mid-match: closed the app', last_action = 'match_quit', 'mid-match: gave up', last_action = 'disconnect', 'mid-match: connection lost', last_action IN ('matchmaking_start', 'matchmaking_found'), 'waiting for an opponent', t_exit > t_enter AND t_exit < t_end - INTERVAL 1 SECOND, 'home menu', length(modes) > 0, 'inside a mode, between matches', 'home menu') AS ended_how FROM s)
```

How `ended_how` works:
- When the app is hidden, the game sends `mode_exit` and `session_end` at the same moment.
- A `mode_exit` at least 1 second *before* `session_end` means the player went back to the home menu first.

**Q2 Overview, plus why-signals per session:**
```sql
<PREFIX> SELECT count() AS sessions, uniq(player) AS players, round(count() / uniq(player), 1) AS sessions_per_player, round(avgIf(secs, secs > 0)) AS avg_secs, medianIf(secs, secs > 0) AS median_secs, sumIf(secs, secs > 0) AS total_secs, sum(matches) AS matches, countIf(length(last_results) > 0 AND arrayElement(last_results, -1) = 'loss') AS left_after_a_loss, countIf(last_results = ['loss', 'loss']) AS left_after_two_losses, countIf(has(modes, 'tutorial') AND length(modes) = 1) AS only_tutorial_sessions FROM c
```

**Q3 Recent sessions** (times in Israel):
```sql
<PREFIX> SELECT toTimeZone(t_start, 'Asia/Jerusalem') AS started, secs, arrayStringConcat(modes, ', ') AS modes_played, matches, ended_how FROM c ORDER BY t_start DESC LIMIT 20
```

**Q4 Where players left:**
```sql
<PREFIX> SELECT ended_how, if(ended_how LIKE 'mid-match%' OR ended_how LIKE 'inside a mode%', last_mode, '') AS in_mode, count() AS sessions FROM c GROUP BY ended_how, in_mode ORDER BY sessions DESC
```

**Q5 Players: new, returning, retention.** A player's first day is looked up over 90 days.
```sql
SELECT countIf(d0 >= toDate(now() - INTERVAL 7 DAY)) AS new_players, countIf(d0 < toDate(now() - INTERVAL 7 DAY) AND last_seen >= now() - INTERVAL 7 DAY) AS returning_players, countIf(d0 >= today() - 30 AND d0 <= today() - 1) AS cohort_1d, countIf(d0 >= today() - 30 AND d0 <= today() - 1 AND has(days, addDays(d0, 1))) AS back_next_day, countIf(d0 >= today() - 37 AND d0 <= today() - 7) AS cohort_7d, countIf(d0 >= today() - 37 AND d0 <= today() - 7 AND arrayExists(x -> x > d0 AND x <= addDays(d0, 7), days)) AS back_within_7_days, countIf(d0 >= today() - 30 AND sessions = 1) AS played_once_only FROM (SELECT distinct_id, min(toDate(timestamp)) AS d0, max(timestamp) AS last_seen, groupUniqArray(toDate(timestamp)) AS days, count() AS sessions FROM events WHERE event = 'session_start' AND timestamp >= now() - INTERVAL 90 DAY AND REAL GROUP BY distinct_id)
```

**Q6 Modes.** Time in a mode comes from `mode_exit.duration_s`. Coming back to the app re-enters the mode, so `entries` slightly overcounts visits.
```sql
SELECT toString(properties.mode) AS mode, uniq(distinct_id) AS players, countIf(event = 'mode_enter') AS entries, sumIf(toInt(properties.duration_s), event = 'mode_exit') AS total_secs, round(avgIf(toInt(properties.duration_s), event = 'mode_exit')) AS avg_secs_per_visit FROM events WHERE RANGE AND REAL AND event IN ('mode_enter', 'mode_exit') GROUP BY mode ORDER BY total_secs DESC
```

**Q7 Matches per mode, with quit signals:**
```sql
SELECT toString(properties.mode) AS mode, countIf(event = 'match_start') AS started, countIf(event = 'match_end') AS finished, countIf(event = 'match_quit') AS quit, countIf(event = 'disconnect') AS dropped, countIf(event = 'match_end' AND toString(properties.result) = 'win') AS wins, countIf(event = 'match_end' AND toString(properties.result) = 'loss') AS losses, countIf(event = 'match_end' AND toString(properties.result) = 'draw') AS draws, round(avgIf(toInt(properties.duration_s), event = 'match_end')) AS avg_match_secs, round(avgIf(toInt(properties.score_me), event = 'match_end'), 1) AS avg_goals_for, round(avgIf(toInt(properties.score_opp), event = 'match_end'), 1) AS avg_goals_against, countIf(event = 'match_quit' AND toInt(properties.score_me) < toInt(properties.score_opp)) AS quit_while_losing, countIf(event = 'match_quit' AND toInt(properties.elapsed_s) < 20) AS quit_in_first_20s, round(avgIf(toInt(properties.elapsed_s), event = 'match_quit')) AS avg_secs_before_quit FROM events WHERE RANGE AND REAL AND event IN ('match_start', 'match_end', 'match_quit', 'disconnect') GROUP BY mode ORDER BY started DESC
```

Matches where the player closed the app mid-match = `started - finished - quit - dropped`. This also includes matches still being played.

**Q8 Champions players pick:**
```sql
SELECT toString(properties.champ) AS champ, count() AS matches, uniq(distinct_id) AS players FROM events WHERE RANGE AND REAL AND event = 'match_start' GROUP BY champ ORDER BY matches DESC LIMIT 15
```

**Q9 Arena:**
```sql
SELECT countIf(event = 'matchmaking_start') AS searches, countIf(event = 'matchmaking_found') AS found, countIf(event = 'matchmaking_cancel') AS cancelled, round(avgIf(toInt(properties.wait_s), event = 'matchmaking_found')) AS avg_wait_found, maxIf(toInt(properties.wait_s), event = 'matchmaking_found') AS longest_wait_found, round(avgIf(toInt(properties.wait_s), event = 'matchmaking_cancel')) AS avg_wait_before_cancel, countIf(event = 'match_start' AND toString(properties.mode) = 'arena') AS arena_matches, countIf(event = 'match_start' AND toString(properties.vs_cpu) = 'true') AS vs_cpu, countIf(event = 'match_end' AND toString(properties.ranked) = 'true') AS ranked_results, sumIf(toInt(properties.trophy_delta), event = 'match_end' AND toInt(properties.trophy_delta) > 0) AS trophies_won, sumIf(toInt(properties.trophy_delta), event = 'match_end' AND toInt(properties.trophy_delta) < 0) AS trophies_lost, arraySort(groupUniqArrayIf(toInt(properties.arena), event = 'trophy_milestone')) AS arenas_reached, countIf(event = 'trophy_milestone') AS milestones FROM events WHERE RANGE AND REAL AND event IN ('matchmaking_start', 'matchmaking_found', 'matchmaking_cancel', 'match_start', 'match_end', 'trophy_milestone')
```

If `ranked_results = 0`, trophies aren't live yet: the server has `ARENA_LIVE` off. Say so instead of reporting zero trophies.

**Q10 Progression: unlocks this range.**
```sql
SELECT toString(properties.item_type) AS type, toString(properties.item_id) AS item, uniq(distinct_id) AS players, count() AS times, max(toInt(properties.level)) AS top_level FROM events WHERE RANGE AND REAL AND event = 'item_unlock' GROUP BY type, item ORDER BY type, players DESC LIMIT 100
```
- `mythic` items are the starters picked (`mythic_1` … `mythic_4`).
- `stat_level` items are shop buys, per stat.
- `arcade_stage` is stages opened.

**Q11 How far players got in the arcade** (over 90 days):
```sql
SELECT top_stage, count() AS players FROM (SELECT distinct_id, max(toInt(properties.level)) AS top_stage FROM events WHERE event = 'item_unlock' AND toString(properties.item_type) = 'arcade_stage' AND timestamp >= now() - INTERVAL 90 DAY AND REAL GROUP BY distinct_id) GROUP BY top_stage ORDER BY top_stage
```

Players who never cleared stage 1 don't appear here. They are `players − sum(players)`, using the Q2 player count.

**Q12 Platform and version:**
```sql
SELECT toString(properties.platform) AS platform, toString(properties.app_version) AS version, uniq(toString(properties.session_id)) AS sessions, uniq(distinct_id) AS players FROM events WHERE RANGE AND REAL AND event = 'session_start' GROUP BY platform, version ORDER BY sessions DESC
```

**Q13 Data health and cost.** Every event counts toward the bill, test events included.
```sql
SELECT count() AS events_this_month, uniqIf(toString(properties.session_id), event = 'session_start') AS sessions_this_month, countIf(event = 'session_start') AS starts, countIf(event = 'session_end') AS ends FROM events WHERE timestamp >= toStartOfMonth(now()) AND event IN GAME
```

From Q13, report:
- `events_this_month` against the free **1,000,000/month**.
- Events per session.
- The projected month-end total: `events_this_month / day_of_month × days_in_month`.
- Sessions with no `session_end`: the app was killed, or the session is still open.

## Step 3: the report

The sections below are what the dashboard shows (Step 4). In chat, give only the Top 3 findings, the headline numbers and the dashboard link. Give the full sections in chat only when Idan asks for them there.

- Write for someone who isn't a data person: short sentences, rounded numbers, minutes and seconds instead of raw seconds, tables where they help.
- It should be readable in about 2 minutes.
- Leave out a section that has no data, with one line saying why. For example: "no arena matches this week".

Order:
1. **Top 3 findings.** What stands out and what to look at next. This goes first.
2. **Overview:**
   - players (new vs returning), sessions, sessions per player
   - average and median session length, total play time, matches
3. **Sessions:** the 20 most recent (Q3), as a table: started, length, modes, matches, how it ended.
4. **Modes:**
   - per mode: players, visits, total time, average time per visit
   - each mode's share of all mode time
5. **Matches:**
   - per mode: started, finished, quit, connection lost, closed the app mid-match
   - completion %, win/loss/draw %, average length, average score
   - most-picked champions
6. **Where players left (Q4):** counts per category. Break the mid-match ones down by mode.
7. **Why they might have left: a guess, not a fact.** Use:
   - quit while losing
   - quit in the first 20 s
   - left after a loss / after two losses in a row
   - long matchmaking waits before cancelling
   - sessions with only the tutorial
   - players who played only once

   Point out a mode with an unusually high quit or close rate.
8. **Arena:**
   - searches, wait times, cancel rate, share of matches vs CPU
   - trophies won and lost, arenas reached
9. **Progression:** starters picked, stat levels bought per stat, arcade stage distribution.
10. **Retention:**
    - players back the next day, as `back_next_day / cohort_1d`
    - players back within 7 days, as `back_within_7_days / cohort_7d`
    - give "too early to tell" if a cohort is under 5 players
11. **Platform and version.**
12. **Data health:**
    - test events left out
    - events this month against 1M free, with the projection
    - anything odd: sessions without an end, matches without an ending event, missing properties

**Footnote:** a "player" is one phone (anonymous, reinstall = new); session length is time in the foreground; "why" is inferred.

## Step 4: refresh the dashboard (every time)

The dashboard is **https://claude.ai/artifact/U11p5RhQq5NaTm7GYDc6aj** ("Salties Analytics"). It's a Dashboard-type artifact. Its page is `dashboard.html` in this folder, and it's stored in the artifact as `files/index.html`. It draws everything from one attached JSON file, the dataset `report`.

1. **Write the report file** to the scratchpad as `salties-report.json`.
   - It's one JSON array of rows. Every row has a `section` and a `key` that is unique across the whole file.
   - Show values as text where the page shows text: durations like `"2m 10s"`, rates like `"64%"`.
   - Leave out a row's section entirely when there's nothing in it. The page then says "Nothing in this period".
   - `check-report.mjs` lists every required field.

| section | key | fields | from |
|---|---|---|---|
| meta | `meta` | range ("Last 7 days"), generated ("Oct 13, 2026, 11:30 Israel time"), data_kind (`real` / `test` / `none`), status (one line for the banner) | Step 1 |
| finding | `f1` `f2` `f3` | text (one plain sentence each) | your Top 3 findings |
| kpi | `kpi-players` `kpi-new` `kpi-sessions` `kpi-avg` `kpi-total` `kpi-matches` | label, value (number), display (text shown) | Q2, Q5 |
| mode | `mode-<mode>` | mode, players, visits, total_secs (number, for the chart), total_time, avg_visit | Q6 |
| match | `match-<mode>` | mode, started, finished, quit, dropped, closed_app (all numbers), win_rate, avg_length, goals ("2.1–1.4") | Q7 |
| left | `left-<n>` | category, mode ("" when not mid-match or in a mode), sessions (number) | Q4 |
| why | `why-<n>` | label, display | Q2, Q5, Q7, Q9 |
| session | `s01`… | started ("Oct 13, 10:08"), length, modes, matches, ended | Q3 |
| arena | `arena-<n>` | label, display (e.g. "Not live yet" for trophies when nothing is ranked) | Q9 |
| arcade | `arcade-<stage>` | stage, players (numbers) | Q11 |
| champ | `champ-<id>` | champ ("Mythic 1"), matches, players | Q8 |
| unlock | `unlock-<type>-<item>` | type ("Stat level"), item ("Speed, level 3"), players | Q10 |
| retention | `ret-next` `ret-week` `ret-once` | label, display ("40% (4 of 10)", or "Too early to tell") | Q5 |
| platform | `platform-<p>-<v>` | platform, version, sessions, players | Q12 |
| health | `health-events` (needs `value` = events this month), `health-projected`, `health-per-session`, `health-no-end`, `health-test` | label, display | Q13, Step 1 |

2. **Check it:** `node .claude/skills/check-analytics/check-report.mjs <scratchpad>/salties-report.json`. Fix anything it reports.
3. **Upload it:** use the `Artifact` tool with `action: "publish"`, `url` = the dashboard, `file_path` = the report, and `asset: true`. Keep the `/_blob/<id>` url it returns.
4. **Point the dashboard at it.**
   - `ArtifactData` `get` collection `datasets`, doc_id `report`, to read its `version`.
   - Then `update` the same doc with that `if_version`, and `data`:
     - `source`: `{kind: "file", url: "/_blob/<id>", name: "salties-report.json", format: "json"}`
     - `updated`: `{at: <now ISO>, by: "Claude (check-analytics)"}`
5. **Delete the previous upload** with `Artifact` `action: "delete"`, `url` = the dashboard, `path` = the old blob id. Nothing else uses it.
6. **Don't touch the page** unless Idan asks for a change. If he does:
   - Edit `dashboard.html` here.
   - Write it to `files/index.html` as `{text: <whole file>}`, with `if_version`.
   - Don't render or screenshot the dashboard to check it.

End the chat reply with the dashboard link. The chat summary stays short: the Top 3 findings and the headline numbers. The dashboard holds the detail.

## Known gaps (say so when they matter; don't guess)

- **No match id.** A champion can't be tied to that match's quit or result.
  - To add: a `match_n` counter or `champ` on `match_end` / `match_quit`.
- **No real "why".** The reasons in section 7 are guesses.
  - To add: a one-tap "why are you leaving?" choice, as an allowlisted `leave_reason` event.
- **Menus aren't tracked screen by screen.** "Home menu" covers the whole menu area. No shop or options screen time is recorded.
