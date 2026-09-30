# HS proportions: head, ball, goal, pitch

Measured 2026-09-30 off Idan's full-resolution iPhone recordings (M3 15.2 s; M4 29.98 and 31.0 s;
2556 x 1180, both players standing). Ours was shot at the same size and staged the same way
(`node _prop-shot.mjs out.png`, with `ME=`, `FOE=` and `STAGE=` to choose the cards and the stadium).
HS's game box is 2127 px wide, so 1 world px = 2.007 screen px on both axes. Every number below
is in world px (the pitch is 1060 wide, wall to wall).

HS draws a 480 x 320 picture and stretches it 1.2x sideways (constants.js `HS_STRETCH`). Anything
round in HS therefore shows as a 1.2:1 oval on the phone: the ball, the heads, the HUD coins.

| | HS | Ours before | Ours now |
|---|---|---|---|
| Game box | 1.8:1, black bars beside it | same | — |
| Grass line | 82.6% down the screen | same | — |
| Ball | 36 x 30 | 36 x 30 | — |
| Goal: near post / far post / top of bar | 37 / 57 / 138 | 40 / 57 / 138 | — |
| Kickoff spot | 221 from the wall | 221 | — |
| Player shadow | ~71 wide | ~72 | — |
| **Head as drawn (hair included)** | **67.7 x 55 (1.23:1)** | 61.8 x 56.5 (photo), ~84 x 68 (cartoon) | 67.7 x 55, both kinds |
| Whole player, feet to crown | 70 | 72.5 | 70.5 |
| Chin above the grass | 15.5 | 15 | 15.5 |
| Hoardings | 360–395 (36 tall) | 357–404 (48 tall) | 360–395 |
| Far / near touchline | 21.5 behind the feet / 29 in front | at the boards / 58 in front | HS's |
| Centre circle | 120 x 10.5 round the feet line | 92 x 16 | HS's |
| Goal box: back edge / front edge | 102 wide 6.5 behind / 86 wide 9.5 in front | slanted the wrong way | HS's |
| Penalty box: back edge / front edge | 170 wide 14 behind / 142 wide 18 in front, plus an arc | slanted the wrong way | HS's |
| Lines on the court | faint cream, (215, 174, 116) over (198, 135, 52) | white | HS's |

## What changed

- **Head box** (game.js and fx-kit.js, `HEAD_W` and `HEAD_H`): 1.17 x 1.07 of the hitbox became
  1.28 x 1.04. The old 62 wide came from a cheek-to-cheek measurement that left out the side hair.
  That made our drawn head narrower than its own 63-wide hitbox. Photo faces are cropped to the
  wider box and are never stretched.
- **Cartoon characters** (game.js, `charFrame`): each painted head is about 128 x 114 frame units,
  1.24x the 100 x 91.5 box it was laid out round. At the built scale that made a character 168 px
  wide on the 2556 screen, against HS's 135. The art is now scaled so the painted head fills the
  head box, stretched sideways the way HS stretches its own sprites (Idan's choice). The chin sits
  on the bottom of the box. All five characters share one scale.
- **HS stadiums' pitch** (game.js, `hsBoardsAndFloor`): HS's board band and all of HS's markings.
  The boxes' sides now slant towards the wall as they come forward, towards a vanishing point over
  the middle, as HS's do.

The sim is not touched: the hitbox, the goal line and every physics number stay as they were.

## The ball (2026-09-30, "the ball feels bigger")

- **Size is right.** Edge to edge the ball is 73 x 60 screen px in both games, and all six HS clips
  track the same ball (an equal-area radius of 16.4 world px).
- **HS draws no ball shadow.** There is none at rest (M4 31.0 s) and none in the air (M4 34.51 s,
  169 up, far from both players). Ours drew a dark ellipse under the ball, and the ball plus its
  shadow read as one bigger ball. The shadow is gone.
- **Lighter drawing.** HS's keyline is ~2.5 screen px (ours was 4, now 1.2 world). HS's rim is
  white, with separate black panels on it. Ours had a navy rim shade and five outer panels that
  joined into a dark ring round ~65% of the edge. The shade is toned down and the panels moved out.
- **HS's side walls stand off-screen (not changed).** In HS the ball turns about 11 world px from the
  screen edge, the median of ~25 fitted wall bounces over M1–M4 (clean ones 8–13). It is visibly
  clipped by the edge at the bounce (M4 69.69 s: 8.5 of its 18 hidden). A player standing in the
  goal is cut off too. The ball meets the grass at its drawn size, so HS's walls are ~7 world px
  beyond the picture. Ours are at the picture's edge, so our ball turns at 18.

## Still open

- The body and boots under the head look about as wide as HS's (~48 when both feet show), but the
  pixel-art blur makes that a rough reading. They were not changed.
- Where HS's physical goal line is still needs a recording (see the goal notes in constants.js).
