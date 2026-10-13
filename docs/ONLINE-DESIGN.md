# Online 1v1 — design

Approved by Adam 2026-08-21. Supersedes nothing; this is the first networked slice.

## Decisions

| | choice | why |
|---|---|---|
| multiplayer scope | **friend code / share link only** | smallest thing that is genuinely playable with others; no population needed for it to work |
| server | **own Render service** (`pikme-headsoccer`) | football's server is 2247 lines, live, and other agents edit it daily |
| plan | **paid (always-on)** | free tier sleeps; a 30-50s cold start on "join my game" kills the whole share flow |
| app delivery | **a real tile in the Game Store** | Adam's call 2026-08-21. The football-WebView hop was dropped with it — it only existed to dodge the build dependency, and it would mean editing live football code |

## Netcode

Server-authoritative, **rollback + replay** on the client. This is the right fit here and not
an indulgence: 1v1 state is ~50 bytes, `shared/sim.js` is pure and deterministic (proven by
`test-sim.mjs`), and re-stepping 30 ticks costs microseconds. Interpolating the ball instead
would put every one of your own kicks a full RTT behind your boot.

```
client                                   server
  ├─ step(localTick) with my input         ├─ 30Hz authoritative step()
  ├─ ring-buffer {tick, myInput} ──────►   ├─ coalesce inputs per tick
  │                                        ├─ apply, step, broadcast snapshot
  ◄──────────── {tick, state, oppInput} ───┤
  ├─ restore(state @ snapshot tick)
  └─ re-step to localTick using my buffered inputs
     + opponent's last known input held constant
```

- Snapshot rate 30Hz; client sim stays at its native 60Hz `TICK`.
- Opponent input prediction is "hold the last one". For a five-button game this is right far
  more often than it is wrong, and a wrong guess self-corrects on the next snapshot.

### Smoothness (2026-10-11) — measured with `_net-feel.mjs`

- **The arena against the CPU is played on the phone**, on the arcade's own loop: the server only
  matches it (the VS card, the CPU's level, the stadium) and settles the score the phone reports
  (`arenaLocal`; ignored before 60% of the match could have been played, or if it is not a score;
  leaving is a loss). No network inside the match, so nothing lags or jumps. Two humans still play
  server-authoritative, as below.
- **The server's input queue sits shallow.** It used to sit 6-7 frames deep on any connection
  (~110 ms of delay nobody needed). It now keeps only what the jitter it has seen needs (the
  shallowest it was over the last half second, less one spare), and drains by skipping a frame only
  when it repeats the one just played — never a held jump — so every tap and dash edge survives.
- **Corrections glide on a spring** (game.js `smoothDamp`, a critically damped spring): a new
  correction leaves the drawn body where it was and moving as it was, then curves in — an
  exponential glide moved fastest the frame it landed, and the other player visibly popped. Settle
  times: you 50 ms, the ball 70 ms, the other player 110 ms. Only a goal's restart snaps.
  Measured against how the other player really moved (their own phone's picture of themselves):
  on Wi-Fi and mobile, no extra jerks and no jump over 21 px (was +15 and +49 a minute, up to 65 px).

Measured (two phones, 4x CPU throttle): Wi-Fi 6-9 ticks predicted (was 11-12), the opponent's
stutters 15/min (was 123); mobile 52/min (was 127); the arena vs CPU 0 corrections (was up to 156 px).

### ⚠️ The trap this design exists to avoid

**Every input in this game is edge-triggered** — jump, kick, power, and dash (which is a
*double-tap*, i.e. two rising edges inside 240ms). A naive server-side coalescer that keeps
"was the key down at tick end" silently destroys all of them. Football hit exactly this as the
"shoots wrong direction" bug.

So the coalescer **latches edges**: if a key went down at any point during the coalesced span,
the tick it is applied to sees the rising edge. `test-net.mjs` asserts dash survives a round
trip — dash is the canary, because it needs *two* edges preserved in order.

## Rooms

- `createRoom` → 4-char code from an unambiguous alphabet (no `0/O`, `1/I`, `5/S`).
- Share link `https://<host>/?room=ABCD`; opening it auto-joins. That link *is* the share
  feature, inside the app and out.
- Host accepts → both pick a card → both ready → match.
- Nobody joins → "play the bot instead" (the existing local mode, untouched).
- Mid-match disconnect → a bot takes the slot so the other player finishes their match.

## Modules

| file | responsibility |
|---|---|
| `shared/rooms.js` | registry, code gen, join/leave/host transfer. Pure — no socket, no timers |
| `shared/net.js` | wire encode/decode + the edge-latching input coalescer. Pure |
| `shared/sim.js` | grows `serialize()` / `restore()` so rollback has something to snap to |
| `server.js` | static host → + ws host, room loop @30Hz, bot backfill |
| `public/net.js` | socket, prediction, reconciliation |
| `public/game.js` | online lobby (create / join / code / share) + online mode in the loop |

Local-vs-bot must keep working with the socket unreachable — the offline game is the fallback
for every failure in this document.

## App tile

Branch on `pikmeTV-saltiz`:
- `app/pages/head-soccer.jsx` — modelled on `football.jsx`: full-screen WebView, injects
  `SALTIZ_CARDS` + profile, passes `?name=&avatar=&v=`.
- `game-store.jsx` — one entry in `GAMES`, replacing a `בקרוב` slot.

The other dev owns TestFlight builds, so this ships as a branch for their next one.

## Gates — verify live, do not assume

1. **Dash over the wire.** Double-tap must still dash with a real RTT.
2. **Cold start.** Paid plan should remove it; confirm the first join after idle is instant.
3. **Card injection on the new screen.** Prove `SALTIZ_CARDS` arrives before the game boots.
4. **Feel under latency.** Current tuning was found at 0ms RTT.
5. **Both clients agree.** Headless 2-client soak: identical score at full time.
