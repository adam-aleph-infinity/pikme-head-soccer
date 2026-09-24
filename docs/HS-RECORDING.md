# Recording Head Soccer for measurement

We are matching our game's feel to the real Head Soccer (D&D Dream, 2012) by measuring it.
The measurements come from **your iPhone screen recordings** of the real game. This page says
how to record them, what to record, and the four commands that turn a recording into numbers.

## Before you record (once)

- **Fresh install** of Head Soccer. Use the **starter character** for every clip. Play against
  the **weakest CPU** you can pick.
- Take a screenshot of the starter's **stat screen**. It goes in `hs-video/` with the clips.
- **Screen Recording in Control Centre:** Settings → Control Centre → add *Screen Recording*.
- **Low Power Mode off.** It drops the game and the recorder to 30fps.
- Hold the phone **landscape** and keep it landscape for the whole clip.
- **Check it is 60fps:** record 5 seconds and run step 1 below on it. It prints
  `recorder 60.0 fps`. If it says 30, check Low Power Mode and try again.

## Every clip

1. Start recording, open the game, and get to the moment the clip is about.
2. **Stand still for one full second** before doing anything. The tracker learns the empty
   pitch from that second.
3. Do the thing **once per take**. Stop the recording between takes.
4. **Takes:** at least 3 per clip, and 5 where the clip measures a single number
   (C1, C3, C5, C9, C12).
5. **File names:** `C07-3.mov` means clip 7, take 3. A whole match is `M5-anything.mp4`.
6. **Where the files go:** the `hs-video/` folder in the repo root. It is gitignored, so
   recordings never reach GitHub. Only the tracks (small JSON files) are committed.

Send the file from the phone with AirDrop. A WhatsApp copy is re-encoded: it still works, but
its timing is worse.

## The clips

| # | Do this |
|---|---|
| C0 | Take stills (screenshots, not video): the kickoff, the starter's stat screen, the HUD in mid-match. |
| C1 | At kickoff, touch nothing for 10 s. Let the ball drop and bounce until it stops. |
| C2 | From a standstill, hold one arrow and run wall to wall, then let go. One direction per take; do both directions across the takes. |
| C3 | From a standstill: 5 quick tap jumps, then 3 jumps holding the button. Wait for each landing. |
| C4 | Run and jump, and reverse direction at the top. Then tap jump again in the air, to show whether a double jump exists. |
| C5 | One dash from a standstill. Then mash dash for 5 s. |
| C6 | Mash kick for 5 s with the ball far away. |
| C7 | Kick the ball five ways, one per take: at your feet, at knee height, at head height, while jumping, and while running. |
| C8 | Stand still under a dropping ball and let it bounce off your head. Then jump into a dropping ball without kicking. |
| C9 | Hit the ball into the side wall, the crossbar, the top of the goal, and the ceiling. One surface per take. |
| C10 | Walk into the CPU. Jump onto its head and stand there. Dash under it while it is in the air. |
| C11 | Kick the CPU repeatedly until something happens to it (stars, a stun). |
| C12 | Your hardest kick across the whole pitch. |
| C13 | Play a whole match and touch the ball as little as you can. Don't use the power. |
| C14 | When POWER is full: arm it, then fire it by a kick, a header, and a body touch (one per take). Also arm it and wait 10 s without touching the ball. |
| C15 | Counter the CPU's power shots, one timing per take: early, just in time, late. |
| C16 | Get hit by every ailment you can: freeze, shock, reverse, and so on. |
| C17 | Score 3 goals and concede 3. |
| C18 | Stand in your own goal for 10 s. |
| C19 | Two full matches each against a weak, a medium, and a strong CPU. |

## Turning a recording into numbers (4 commands)

Once, on a Mac: `brew install ffmpeg`.

```bash
# 1. EXTRACT: numbered frames with their real timestamps, and duplicate frames flagged.
node _hs-extract.mjs hs-video/C07-3.mov          # add --jpg for big native recordings

# 2. MEASURE: open the page, calibrate, track, tag, then press Save.
node _hs-measure.mjs                              # http://127.0.0.1:3031/

# 3. FIT: every saved track becomes docs/hs-reference.json.
node _hs-fit.mjs

# 4. VIEW: the reference, one row per number.
node -e "for (const r of require('./docs/hs-reference.json')) console.log(r.status.padEnd(11), r.id.padEnd(26), r.value ?? '—', r.unit)"
```

### In the measuring page

- **Calibrate first.** Click the points in the list: left wall, right wall, ground line, crossbar
  top, left goal mouth, and the top and bottom of a standing head.
  - The walls and the ground set the mapping onto our world, 0–1060 wall to wall.
  - The other points are cross-checks. The panel compares them with our goal height and head
    size.
- **Track.** Press `1` (ball), `2` (you) or `3` (the CPU) and click the object. Then press `T`
  to auto-track forward. Step with `←` `→` (shift: 10 frames, alt: skip duplicates) and click
  anywhere the track went wrong. `Del` clears the object on this frame.
  - During a GOAL! banner or a power cut-in the tracker records nothing, on purpose.
- **Tag events** with the keys on the tag buttons: kick, bounce, touch, goal, ready on/off,
  gauge full, power press, cut-in on/off, jump tap/hold, dash, release.
  - Put the surface or the variant in *note*: `wall`, `bar`, `top`, `ceiling`, `feet`, `knee`,
    `head`, `jump`, `run`.
- **Save** writes `docs/hs-clips/<clip>.tracks.json`. Commit those files.

Numbers that can't be recorded (for example power shots you don't own) go in
`docs/hs-estimates.json`, with their source. They show up in the reference as `estimated`.
