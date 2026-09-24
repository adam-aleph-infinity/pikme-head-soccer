# Drawn characters: Saltiz faces in the Head Soccer style

Most cards play as a crop of their photo (`head-crop.js`). A card listed in
`public/characters.js` plays as a drawn cartoon of the person on the card instead: on the
pitch, on the pick-screen slots, in the arcade (your face and the champion reel), on the
scoreboard faces and on the result screen. The cartoon is our own drawing in HS's style
language. Nothing is traced, cropped or copied from HS.

| Card | Dir | The caricature, in three features |
|---|---|---|
| legendary #1 (Saltiz beach shack) | `legendary-1` | short dark hair in a quiff of three big locks curling forward with a messy fringe; thick straight brows; broad face with ears and a shadow of stubble. Hurt uses his card's round "O" mouth |
| legendary #2 (green worms) | `legendary-2` | long wavy blonde hair parted in the middle with darker roots, thin curtains ending in points at the jaw; arched brows; big lashed eyes. Hurt is her card's face: brows knotted up, eyes wide, a big scream |

## Files

- `public/img/chars/<dir>/{normal,kick,hurt,happy,sad}.svg`: one small SVG per expression
  (9-11 KB each). WKWebView-safe: only `path`/`ellipse`/`circle`, fills, strokes and
  `clipPath`. No filters, masks, images, text or `foreignObject`. `test-characters.mjs` checks this.
- `tools/chars/build.mjs` writes those files from hand-placed path data (`node tools/chars/build.mjs`).
  Shared parts (silhouette, eye, brow, mouths, bruise, tear) are functions there. Each
  character is a palette, its hair paths, and one small function per expression.
- `public/characters.js`: the registry (`'legendary:1' → { dir }`), the shared frame
  `CHAR_BOX`, and `expressionFor(match, player)`.
- `_charfaces.mjs`: shoots every screen with the two characters, plus a comparison sheet (card |
  cartoon | ours in-match | HS in-match | HS select) at `.shots/charfaces/sheet.png`
  (`HS_VIDEO_DIR=../../hs-video PORT=3081 node _charfaces.mjs`).

## The frame

All coordinates are in **head-box units**. The head box the pitch draws (`HEAD_W × HEAD_H` of
the hitbox, 1.17 × 1.07) is **100 × 91.5**, with its top-left corner at 0,0. Every file has
`viewBox="-22 -26 144 142"`, which leaves room around the box for hair breaking the outline:
26 units above, 22 on each side and 24.5 below (long hair on the shoulders). `paintPitchChar`
(game.js) sizes the head's `<i>` to that frame around the box, so the drawn silhouette sits
exactly where the photo head's keyline did. Portraits (`paintCharPortrait`) scale the box to
84% of the element's width and centre it slightly above the middle.

Characters are drawn **facing right** (a 3/4 turn toward the opponent of player one). The
client mirrors them with `scaleX(-1)` wherever they should face left: player two on the pitch
and the scoreboard, the arcade champion, and your slot on the pick screen (the page is RTL).

## Style rules (measured from HS M3/M4 at full resolution; see HS-CHARACTER-LOOK.md)

**Proportions.** The head is nearly the whole character: wider than tall (62 × 57), with a
dome on top and full cheeks below. It uses the same superellipse as `HEAD_SHAPE`, regenerated
in `build.mjs`, so a drawn head fills the same area as the photo head. Features sit low: brows
at about 45% of the height, eyes 50-62%, nose tip about 72%, mouth 85-88%. Hair takes the top
~30% and rises up to about 20 units above the dome.

**Outline.** One near-black warm brown, `#1c0f08`. The silhouette and hair keylines are
4.2-4.6 units (~5% of head height). Lids are 3.4, brows are filled wedges, and feature lines
are 2.2-2.8. Hair has its own keyline and sits **on top of** the head outline, so its locks
break the silhouette the way HS hair does.

**Palette.** Each surface gets three flat tones: base, one shade, one light. No gradients.
- Skin: base, a shade crescent on the back (left) side and under the jaw, a lit patch on the
  front cheek, and a thin **rim light** (pale gold) just inside the back edge.
- Hair: base, a shade band where it meets the face and on the back side, 2-3 highlight
  streaks on the lit top, and a rim stroke down the back.
- Extras: optional stubble (a jaw patch one step darker than the skin), and darker roots
  along a parting.
Choose the base colours from the card photo, then push them lighter and more saturated.
Choose the shade by hand, one clear step darker and warmer (do not multiply). Expect about
12 colours per character.

**Eyes.** A white almond about 20-24 wide × 16-19 tall. Its top edge tilts down toward the
nose for the determined in-match look (`lidTilt`). It is capped by the heaviest line on the
face, a thick lid stroke. The pupil is big (0.6-0.72 of the eye width), pressed up under the
lid and shifted toward the opponent, with one white catch-light. The far eye is drawn ~15%
narrower (3/4 turn). Women get a brown iris ring and an outer lash flick. Shut eyes are a
single thick arc: `^` for happy, a `>` chevron for pain.

**Brows.** Filled tapered wedges, thickest at the inner end, sitting right on the lids. Their
angle carries the emotion: inner ends down means determined or effort, inner ends up means
hurt or sad, and high and flat means happy. Thickness is a likeness cue (7.5-9 for #1, 4.5
for #2).

**Nose.** Barely drawn: the underside of the tip as one stroke plus a small shade shape.
Never draw a line running up between the eyes, because at pitch size it reads as a letter.

**Mouth.** Simple and low. A short flat line with a lip shade (normal), gritted teeth
(kick), a round "O", a scream trapezoid with top teeth and tongue (hurt), a D-shaped grin with
teeth and tongue (happy), or a small downturned arc (sad).

**Marks.** The hurt face gets HS's red nose blotch. Sad gets a tear or a sweat drop. The game
draws the stun stars itself (`drawOverHeads`).

## Expressions and when they show

`expressionFor` reads match state only. The sim is untouched.

| Expression | When |
|---|---|
| `hurt` | `p.stunned > 0`, or `p.hurt > 0` (the stun-after-kick flag, when the sim has one) |
| `happy` / `sad` | while the GOAL! banner stands: the scorer is happy, the other player sad |
| `kick` | while the kick swing runs (`p.kickT > 0`) |
| `normal` | otherwise; also the portraits on the pick screen and in the arcade |

The result screen shows both heads either side of the score: the winner is `happy`, the loser
is `sad` and greyed out like HS's loser portrait. A photo card there shows its crop.

## Adding a character

1. Save the card and crop the face big. Write down three features that make the person
   recognisable (hair shape, brows, the card's expression).
2. In `build.mjs`, copy a character block. Set the palette, draw the hair (`HAIR`, plus
   `BACK` for long hair behind the head) as bold shapes, and adjust the eye, brow and mouth
   parameters per expression. Use the card's own expression for `hurt` or `happy`.
3. `node tools/chars/build.mjs`, then add the card to `CHARACTERS` in `public/characters.js`.
4. `node _charfaces.mjs` (point `pick.me` / `pick.foe` at the new card) and view the sheet.
   Check that it reads at pitch size (~60 px wide) next to the HS crop, not only big.
   `node test-characters.mjs`.

## Refinement log (the first two characters)

- **Pass 0.** First draft: eyes too small for HS, a porcupine of regular spikes on #1, a
  "5"-shaped nose, a boxy stubble patch. #2's hair was a closed hood, with the back hair
  forming a band under the chin.
- **Pass 1.** #1: three big rounded locks curling forward with a two-point fringe (the card's
  quiff), bigger eyes, stubble reshaped along the jaw. #2: back hair split under the chin and
  ending in pointed waves, thinner face-framing curtains that flick out at the jaw, bigger
  lashed eyes.
- **Pass 2.** #1's fringe lifted off the brows, larger pupils, a shorter nose. #2's brow
  signs fixed (the hurt and sad brows now knot UP like her card instead of glaring). Curtain
  bangs sweep from the part instead of a pointed arch, a smaller nose, a bigger scream.
- **Pass 3 (in-match at 844×390).** Both nose strokes cut down to the tip's underside,
  because the upward stroke read as a letter at 60 px. Eyes and pupils grew again to match HS's
  in-match read. #1's hair warmed to the card's brown. #2's part became a thin line of roots
  instead of a wedge. Integration fixes: the pick slots are sized from the element (phone
  layouts shrink them to 34 px), and the arcade champion and your pick slot are mirrored to
  face the VS.
