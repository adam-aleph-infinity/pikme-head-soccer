# Teams and the Trophy Arena

Built 2026-10-08 for Idan. The approved plan is at `~/.claude/plans/pasted-content-id-a61c-i-want-prancy-bear.md`.

Two connected systems:
- **Teams**, modelled on Pokémon GO's: four teams, each led by one of the Mythic starters.
- **A trophy arena**, modelled on Clash Royale's: PLAY starts a multiplayer battle. Players climb arenas and a Trophy Road, and the four teams compete every week on the trophies their players win.

## Idan's decisions

| Area | Decision |
|---|---|
| Teams | Four: קבוצת שובל (red), קבוצת אורי (pink), קבוצת נוה (yellow), קבוצת פז (green). The champion נווה was renamed נוה. שובל's kit is now red. |
| Joining | Picking the Mythic starter picks the team. The starter screen says so and asks before saving. |
| Switching | One free switch. After that it costs gems, which aren't built yet. **The champion switches with the team.** |
| Tutorial | After the shop, your own team leader explains the teams in three cards. |
| Server | A SQLite file on a Render disk. The server decides every trophy, team and result. |
| Player identity | A random device ID for now; the app's user ID later. |
| Trophies | Elo style: the amount depends on the opponent's trophies. A loss costs some. |
| No human opponent within ~10 s | A CPU with a made-up player's name. |
| Upgrades | Not counted in the arena. Everyone plays with equal stats. |
| Loops | Trophy Road, arenas that unlock, a daily wins bonus. |
| PLAY | Starts an arena battle. The other modes are behind the "מצבים" button. |
| Friend rooms | No trophies. |
| Leaderboard | The four teams plus your own rank. No other player's name. |
| Prizes | Arcade Points and a 🏅 badge. Champion boxes come later. |
| Week | Sunday 00:00 → Saturday 20:00, Israel time. |

## Files

| File | What it is |
|---|---|
| `shared/teams.js` | Team rules: the teams, the Israel week clock, the score formula, prizes, the device's own record, the device ID. |
| `shared/arena.js` | Arena rules: arenas, trophies, floors, the Trophy Road, the daily bonus, matchmaking, the CPU. |
| `server/store.js` | The SQLite file: players, `week_stats`, `daily`, `weeks`, `claims`. No names are stored. |
| `server/league.js` | The referee: queue, pairing, a CPU after the wait, arena rooms, results, forfeits, the road, switches, finalising the week, prizes, dev tools. |
| `server.js` | Hooks only: new message types, `startMatch(room, opts)`, arena rooms hand their end and their leavers to the league. |
| `public/team.js` + `team.css` | The badge, the leader's three cards, the Team screen, the switch, the prize popup, the team marks on the starter and home screens. |
| `public/arena.js` + `arena.css` | Searching and VS, trophies on the result, the new-arena reveal, the Trophy Road, the leaderboard, the home screen's arena marks. |
| `public/net.js` | League messages (`onLeague`), and a hello on every connect (`onOpen`). |
| `public/game.js` | The wiring: `MODE = 'arena'`, the profile, PLAY, prizes paid once, the switch. |
| `public/starter.js`, `tutorial.js`, `menus.js` | The team ribbons and shuffled order; the team step; the home chip, PLAY, modes and the trophies → road link. |
| `render.yaml`, `package.json` | The 1 GB disk at `/var/data` with `DATA_DIR`, and Node ≥ 22.13 (for `node:sqlite`). |

## The fair weekly score

Each player counts for the team they were on when the week started. A switch counts from the next Sunday.

- **won** — trophies gained in arena **wins** that week. A loss costs your own trophies but never lowers your team's score, so playing more can only help.
- **active** — at least 3 arena matches that week. Inactive players are not counted.
- **capped** — `min(won, 300)`, about ten wins. Past that, the way to help your team is to get a teammate playing.
- **The score:** `(Σ capped + K·μ) ÷ (active + K)`
  - μ is the average of every active player.
  - K = (all active players) ÷ 8.
  - This is the team's average, pulled slightly toward everyone's average.
- **Rank:** ranked to one decimal. Tied teams share the place and the higher prize. A team where nobody played comes last.

Why the pull: with a plain average, four equally keen teams of very different sizes do not each win a quarter of the weeks. A small team's average is noisier, so it tops the table more often by luck.

`test-teams.mjs` simulates 2,500 weeks per setup:

| Setup | Plain average | This formula |
|---|---|---|
| Teams at 60/25/10/5 % of 400 players | 16 % … 34 % | 20 % … 29 % |
| Teams at 40/25/20/15 % | 21 % … 30 % | 24 % … 27 % |
| Only 60 players, 60/25/10/5 % | — | 23 % … 27 % |
| One team plays 20 % more | — | that team wins 40–51 % (big) / 40 % (small) |

**Prizes** go to active players only:

| Place | Prize |
|---|---|
| 1st | 2,000 Arcade Points + 🏅 |
| 2nd | 1,000 |
| 3rd–4th | 500 |

Everyone else is told how to take part next week. A player who was offline at the end sees the result on their next launch, and it is paid once: the server keeps `claims` and the device keeps `claimed`.

## The arena

**Trophies**

d = the opponent's trophies minus yours, clamped to ±400.

| Result | Trophies |
|---|---|
| Win | 30 + d/40 (20…40) |
| Loss | 0.8 × the other player's win (16…32) |
| Draw | 0 |

You never drop below 0 or below the arena you are in. A kid who wins half their matches still climbs: 200 matches take them to 500+.

**Arenas** (each on a stadium the game already draws; names and backdrops are one-line edits in `shared/arena.js`)

| Arena | From | Name |
|---|---|---|
| 1 | 0 | אצטדיון השכונה |
| 2 | 300 | הנמל |
| 3 | 600 | הג'ונגל |
| 4 | 1,000 | העיר הסינית |
| 5 | 1,400 | המקדש |
| 6 | 1,900 | יפן |
| 7 | 2,400 | המפעל |
| 8 | 3,000 | בסיס האוויר |
| 9 | 3,700 | אצטדיון הלילה |
| 10 | 4,500 | אולם האלופים |

**Trophy Road:** a node every 100 trophies, 50 in all. A node pays 150 + 50 × the arena; a gate pays 500 × the arena number. Nodes are claimed in order. The whole road pays 46,500 points.

**Daily bonus:** the first three wins of each Israel day pay +200, +200, +500.

**Matchmaking:** players are paired within ±(100 + 40 × seconds waited) trophies. After 10 s with no human, the player gets a CPU:
- It has a nickname from `BOT_NAMES` and a random Mythic.
- Its trophies are within ±30 of yours.
- Its level is set by your arena, and after three losses in a row it is one level easier.

**Leaving:** a player who leaves mid-match loses it, and the other player wins at once. Leaving during the VS card plays no match, and the other player goes back to searching.

## Cheating and privacy

The server runs every arena match, so it pays trophies from its own score. The client never says how a match went.

- The team, the switch, road claims and week prizes are all checked on the server.
- A Mythic is only accepted as your arena card if it is your own.

Known gaps:
- **The device ID.** A reinstall makes a new player, and a kid could make several. The app's user ID fixes this.
- **Arcade Points** are still kept on the phone.

Privacy: no chat, and no other player's name anywhere except the opponent's nickname during a match. Nothing personal is stored on the server.

## Notifications

The page cannot send push notifications. For now everything is in the game itself:
- The team chip's status line ("מקום 2 · נשאר יום אחד", "היום הסיום!").
- The daily stars on PLAY.
- The "!" on the trophies when a road prize is waiting.
- The week's result popup.

Push would come through the Saltiz app.

## Testing

| What | Command |
|---|---|
| Team rules and fairness | `node test-teams.mjs` (`-v` prints the simulation) |
| Arena rules | `node test-arena.mjs` |
| The league on a real server (restart included) | `node test-league.mjs` |
| Whole flow in Chrome, with screenshots | `node _arena-shots.mjs` (shots in `.shots/arena`; `SIZE=667x375` for a small phone) |
| Tutorial with the team step | `node _tutorial-shots.mjs` |

**A week in a minute.** Run `DEV_TOOLS=1 npm start`, then open `http://localhost:3020/?teamsim`. The Team screen gets dev buttons:

| Button | What it does |
|---|---|
| קבוצות מזויפות | Adds fake teams with a believable week. |
| סיים שבוע | Ends the week now. |
| +100 גביעים | Adds 100 trophies to you. |
| איפוס יומי | Resets today's daily bonus. |
| מחק הכל | Wipes the league. |

`?fresh` (dev hosts only) also forgets the device ID, so the server sees a new player.

## Left for later

- Champion boxes on the road gates and as weekly prizes.
- Gems, so a second team switch can be bought.
- The app's user ID.
- Push notifications.
- A recorded voice for the new arena line (`SAY.arena`), with `tools/voice` and `--only arena`.
- The loading screen's key art still shows שובל in black (it is the artist's image).
