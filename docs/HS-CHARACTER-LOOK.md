# How a Head Soccer character looks — and how ours copies the look, not the art

Studied from full-resolution crops of `hs-video/M3-airdrop-full.mp4` and `hs-video/M4-gaps.mp4`
(2556x1180 after rotation, 60 fps). Times below are seconds into those clips. Sizes are in "1280
px" (the frame at half size, which is what `docs/hs-clips/*.tracks.json` calibrates in; HS's
calibrated head is 52.75 px there) or in head radii **R**.

Our rule: the heads stay Saltiz card faces, everything else is drawn by us from paths
(`drawBody`, `drawBoot` in `public/game.js`). No HS sprite is traced, cropped or shipped.

Exception: cards with a real-face character (`public/characters.js`) play as their own person made
into an HS character (the real head, re-posed, HS proportions and keyline). See `docs/CHARACTERS.md`.

## What HS does

| | Head Soccer | Where |
|---|---|---|
| **Head : body** | Head sprite 56-57 px tall (hair spikes included), 62 wide: wider than tall. Visible body under the chin is 15 px: **3.8 : 1**. The "2.9:1" noted earlier counted the body from the head's centre line, not the chin. | M3 6.8, M4 29.98 |
| **Head outline** | ONE native pixel (the game renders at about 1/4 of the recording: a head is ~24 native px), near-black warm brown. So the keyline is ~4% of the head's size. | M4 29.7 zoom |
| **Shading** | Cel-shaded: two or three flat tones, lit from the front, darker toward the back of the head. A thin **gold rim light** runs along the back edge of the hair and cheek. No gradients, no drop shadow round the head. | same |
| **Body** | No torso you can read, no arms, no legs. A small **black suit** under the chin with a **coloured collar** (blue on the Korea character) peeking out, and two **chunky black boots**, all rimmed in the same gold. The whole body is a dark pedestal barely wider than two-thirds of the head. | M4 29.98, 80.3 |
| **Shoes** | Round clogs, ~1 R long and ~0.5 R tall; together they span ~1.7-2 R. Black with a grey sheen and a gold rim. | M4 29.98 |
| **Kick** | **No leg ever shows.** The front boot leaves the body and rides up in front of the face: frame 0 low and forward (≈1 R out, 0.3 R up), frame 2 at 1.76 R out / 1.1 R up, frame 4 at face height (1.8 R out, 1.64 R up), frames 5-15 **held high**, toe up (1.7 R out, 2.1 R up — level with the brows), then snapped back in one frame. 16 frames out = 0.26 s (= `KICK_TIME`), next kick 21 frames later (`KICK_COOLDOWN` 0.349). A faint white swoosh follows the boot on the way up. | M4 29.68-31.96, every frame |
| **Jump** | Head and body rise as one, no squash or stretch, no rotation. The two boots **splay** apart, toes out. The shadow stays on the grass, a little smaller and fainter as the player rises. | M4 21.0-22.0 |
| **Run** | Head rides level — no lean, no visible bob. The two boots paddle, alternating a few px fore and aft. | M4 32.6-33.4 |
| **Facing** | Always toward the opponent, running backwards included. (The result/select portraits face the VS too.) | all |
| **Dash** | **Afterimages**: one or two see-through copies of the whole character (head and body, untinted, ~40% then ~25%) overlapping the player by more than half a head, lingering ~6 frames after the burst ends. | M4 57.9-58.1, 66.4 |
| **Shadow** | A soft dark ellipse ~1.5 head diameters wide and ~0.25 D tall, alpha ~0.4, centred under the feet. | every frame |
| **Hit / dazed** | A power shot into an unarmed player: the whole character tips **back ~25°** away from the hit and is carried backwards through the air; lands upright. No stars in these clips. The face sprite changes (squint), and a red "bloody nose" mark can stay on the face for a few seconds after. | M4 61.9-63.0, 80.3 |
| **YOU marker** | A rounded speech bubble with a downward tail, bold outlined "YOU" in yellow, directly on top of the local player's head, **only while the KICK OFF banner stands** (gone the moment play starts). ~1.5 heads wide. | M3 4.0-6.2 |
| **Celebration** | None on the pitch: after a goal the players keep their normal poses under the GOAL! banner. | M3 11.4-14 |
| **Result screen** | Big head portraits either side of VS; the **loser's portrait is darkened** to a grey silhouette with a "…" over it. | M3 92.8 |
| **Player select** | Big head portraits in octagonal gold frames, facing the VS. | M3 0.8 |

## What ours does now

| | Before | Now |
|---|---|---|
| Head | Circle exactly the hitbox, 3 px ring in team blue/red, a big soft drop shadow, leaning ±20° with speed — a **coin** | HS's **silhouette**: 1.17 × 1.07 of the hitbox (HS 62 × 57), a superellipse that is a dome on top and square-ish below, widest a little under the middle, jaw drawn in (`HEAD_SHAPE` → CSS `--head-shape` polygon, clip-path on the layers; the canvas traces the same points for the net). One near-black keyline (~5% of the height, `--ol`) all round; no ring, no rim light, no drop shadow. The card face is cropped **1.3× tighter** and nudged down (`HEAD_CROP`, head-crop.js `opts`) so face and hair fill the shape, chin on the flat bottom. Cartoon push: `saturate(1.35) contrast(1.12) brightness(1.04)` on the photo, a flat highlight and a shaded lower edge. Upright. The sim head is still the 26.4 circle. |
| Body | SF2 gi: blue/red torso, belt, arms, legs with socks, long football boots | Dark rounded suit, team-colour collar just under the chin, rarity-colour rim light down its back, two chunky clog boots. Head : body **3.8 : 1** (chin 15 px off the grass). |
| Kick | A leg pivoting from the hip, extending to the ball | The front boot alone, on HS's arc and timing (`KICK_KEYS`), held high toe-up, plus a faint swoosh while it climbs. The first frame starts at 1.2 R (HS 0.95 R) so the toe reaches the edge of the sim's kick circle. |
| Jump / run | Arms up, leg tuck / leg swing | Boots splay / boots paddle. |
| Dash | nothing | Two afterimages: body copies on the canvas, head copies as DOM clones (`drawHeadGhosts`), on a clock that stops during a hit-stop. |
| Shadow | 3 px bar | HS-size ellipse that stays on the grass and shrinks/fades with height. |
| Stunned | body flat at 66°, head at 69° | Tipped back 0.45 rad (head and body together, body pivoted at the neck so the feet swing forward), three stars orbiting over the head. |
| Kickoff | — | "YOU" bubble in the local player's team colour over their head while the KICK OFF banner is up (online: over `NET.you`). |

**Filter cost** (`node _headcost.mjs`: a live match, both heads moving, 844x390, CPU throttled 4x,
5 s per variant): circle / shape / shape + CSS filter all ran at 16.7 ms median, 0% of frames over
20 ms. An SVG posterize (`feComponentTransfer`, 6 levels) on top measured 0-1.1% over 20 ms in
Chrome — and WebKit rasterises `url()` SVG filters on HTML content on the CPU, so on an iPhone it
would be the expensive one. Not kept. Everything kept is WebKit-safe: `clip-path: polygon()` (also
`-webkit-` prefixed), CSS filter functions, a `drop-shadow` filter for the armed glow (a
box-shadow would glow round the box, not the head).

Not taken: HS's red-nose bruise (the repo removed damage looks on purpose — no health in HS
parity), the face turning to the opponent (our heads are front-facing photos), hair breaking the
top of the outline (a photo cannot), the loser's grey portrait (result screen, separate work).

## Checking it

`node _charshots.mjs` poses both players on a frozen 844x390 phone (stand, run, three kick
frames, jump, dash, stunned, kickoff) → `.shots/chars/`. With `HS_VIDEO_DIR` pointing at the
folder holding `M4-gaps.mp4` it also cuts the same poses out of HS at the same framing and writes
`.shots/chars/side_by_side.png` (HS top row, ours below), and `heads-lineup.png`: eight Saltiz
faces in the pitch head's shape and crop, mis-measured anchors included (`LINEUP_ZOOMS=1,1.3,1.6`
adds a row per crop zoom).

## The body, re-studied (painted at full resolution)

Idan: "the legs look like car wheels, and the head looks dismantled". The body was drawn from
paths on the half-res pitch (PIXEL 2): 13-texel clogs upscaled pixelated read as wheels, and the
suit's hard texels never met the head's smooth keyline. Re-measured at full resolution (M4 29.98
stand, 32.6-33.1 run, 21.25 jump, 29.68-29.95 every kick frame, 57.97 dash, 62.5 stunned;
2.1 full-res px per world px):

| | Head Soccer | Ours now (`public/body-art.js`) |
|---|---|---|
| Head on body | The chin sits straight on the collar and the boot tops — ~30 full-res px chin to sole, of which ~22 is boot; no neck, no gap | Chin 15 world px off the grass; boots 13.5 tall; the collar is cut to `HEAD_SHAPE`'s jaw line and runs up under the chin, so any head in that shape sits on it |
| Collar | A strip of bright team cyan under the chin, dark suit at the sides | Team-colour band following the jaw, its top in the collar's shade tone (the chin's shadow), keyline under it |
| Boots | Chunky near-black, ~27 x 11, flat sole, domed upper, gold rim at the heel and along the top | Football boot: flat sole (lighter band + welt line), heel counter to a padded ankle collar, domed toe cap, three lace dashes, toe-cap specular, rarity-colour heel stripe (back boot only) and rim light; 2-3 cel tones; keyline 2.6 (the head's 5%) in the head's own `#140c08` |
| Run | The boots paddle fore/aft ~5-6 px, the one coming forward lifted, heel up | 8-frame flipbook, ±6.5 px, 3 px lift, 0.26 rad heel-up, 0.28 s cycle |
| Jump | Boots splay toes out, nearly flat | Splayed ±0.2 rad |
| Kick | One boot on the arc (`KICK_KEYS`), sole to the ball, held high | Unchanged arc; the boot sprite blitted rotated |
| Shadow | Soft dark ellipse ~2.6 R x 0.5 R, mostly below the soles | Soft radial ellipse 2.64 R x 0.52 R, centred a third below the soles, on the pitch canvas (so a ball rolls over it) |

**How it is drawn.** body-art.js paints each boot and the whole lower body for every pose (stand,
run0-7, air, kick) ONCE at 3 texture px per world px (fx-kit `tex` cache), and `drawBody` blits
one sprite per player (two while kicking) onto `#cvbody`, a canvas at the screen's resolution
between the pitch and `#cvfx0` (so the cut-in's dark still covers a non-shooter). The pitch's
shake is applied to it too, the cut-in blur follows `#cv`'s, and the near net is laid back over a
body in the goal with `source-atop` (`netOverBodies`), so it lands on body pixels only.

**Cost** (`node _bodycost.mjs`: live match, 844x390, 4x CPU throttle): 16.7 ms median / 16.8
p95, 0.3% of frames over 20 ms; `drawBody` 3.4 µs a call.

**Checking it:** `BODY=1 node _charshots.mjs` (with `HS_VIDEO_DIR`) adds the run at four phases,
the kick at HS frames 1/2/4/8 and a player in the goal, and writes `body_sheet-1x.png` (whole
2.6-head square) and `body_sheet-3x.png` (chin to shadow), HS over ours. `CARD0=rarity_n` poses a
given card (a photo card shows the head in `HEAD_SHAPE`, the shape the collar is cut to).

Quality passes: (1) layer + sprites; boots too long/thin, stripe loud → (2) boot 24 x 13.5, feet
closer (±4), jump splay flattened, collar thinner → (3) domed toe cap, laces brighter, stripe
narrower, BODY sheets added → (4) de-blued blacks, collar band 3.8 with a 1.1 chin shadow, run
paddle ±6.5 with lift, shadow moved onto the grass → (5-6) heel stripe only on the back boot (two
side by side read as "11"), in-goal net check.
