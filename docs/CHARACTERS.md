# Card characters: Saltiz cards as Head Soccer characters

Most cards play as a crop of their photo (`head-crop.js`). A card listed in
`public/characters.js` plays as a **Head Soccer-style cartoon character**: drawn in HS's own art
style (`docs/HS-ART-STYLE.md`), with *who it is* taken from the card: hair, skin tone, gender,
face shape, vibe. No photo pixels are in the art. It shows on the pitch, on the pick-screen
slots, in the arcade (your face and the champion reel), on the scoreboard faces and on the
result screen.

History, so nobody goes back: a photo crop in a circle ("just a photo of a card"), then flat SVG
cartoons ("looks like Roblox"), then the card's real face cut out and re-posed ("the head looks
dismantled"). Idan's brief: HS's art style, related to the cards, not deep.

| Card | Dir | From the card |
|---|---|---|
| legendary #1 | `legendary-1` (Shoval) | young man; dark, near-black hair swept up and back into a quiff; thick dark brows; warm tan skin; broad face |
| legendary #2 | `legendary-2` (Ori) | young woman; long wavy blonde hair parted in the middle, darker roots, falling past the jaw onto the shoulders; her own softer face (no jowls, no ear showing), big lashed eyes with brown rings, thin arched brows, full pink lips, blush |
| legendary #3 | `legendary-3` (Naveh, grill) | bearded man; full auburn beard, big grin; the card's yellow hat with the red logo |
| legendary #4 | `legendary-4` (Naveh, box) | same man; big mop of copper curls, light stubble, wide excited eyes, open grin |

All four share one head traced off HS's Korea (Ori with her own softer outline on the same eye band) (`BASE` in `tools/chars/hs_chars.py`, points in the reference crop's pixels via `R()`), so they read as the same game's roster.

Each card also carries one prop from its card, painted in the rig as `extras` (drawn over the hair, with its own keyline): #1 a gold coin tucked above the ear, #2 a worm curled over her head with a red eye, #3 a grill spatula behind the hat, #4 marshmallows in the curls. Clothes from the card are `KITS` in `public/characters.js` (the suit tones, the collar band): #3's yellow shirt; the rest wear the black suit, which is their cards' black T-shirt. In HS proportions the head hides the torso, so only the collar band under the chin shows.

## Files

- `public/img/chars/<dir>/<expr>.webp`: the **HD portrait** (pick, arcade, scoreboard, result),
  576 x 568 (4 px per frame unit), lossy q84 (#2 q74), ~30-40 KB each. **The pitch uses it too**: the
  40 x 48 pitch sprite below, stretched to a phone's screen, read as a blur.
- `public/img/chars/<dir>/px-<expr>.webp`: the **pitch sprite** (built, no longer shown), the same face at HS's in-match
  pixel density: 40 x 48 art pixels, lossless, < 1 KB. Shown with `image-rendering: pixelated`
  (`.head.char > i` in style.css).
- `public/characters.js`: the registry (`'legendary:1' → { dir, name, nose, fit }`, written by the
  build), `CHAR_BOX`, `CHAR_PX`, `charUrl(ch, expr, px)`, `expressionFor(match, player)`.
- `tools/chars/paint_hs.py`: the painter. `tools/chars/hs_chars.py`: the two rigs and the
  expression table. `tools/chars/concept-sdxl.py`: the concept-sketch generator (not shipped art).
- `test-characters.mjs`: every file exists, has alpha, the right size; under 250 KB a character (the card props are most of it).
- `_charfaces.mjs`: the comparison sheet (see "Checking it").

## The frame

Coordinates are **frame units**. The head box the pitch draws (`HEAD_W x HEAD_H` of the hitbox,
= `HEAD_SHAPE`'s box) is 100 x 91.5; the frame is 144 x 142 with the box at (22, 26), so hair
can rise above it and cheeks spill beside it. The **chin sits on the box's bottom edge** (y 117.5,
keyline included) and follows `HEAD_SHAPE`'s jaw, so the head ends where the body's collar begins
(`public/body-art.js` cuts the collar to that jaw line and shades the chin's shadow on it). The
art spans about 112 x 101 units: the same share of the box as HS's 62 x 57 sprite.

Characters face **right** (three-quarter view toward the opponent of player one). The client
mirrors them with `scaleX(-1)` wherever they face left.

## How they were designed

1. **Style study** (`docs/HS-ART-STYLE.md`) from full-resolution frames of the recording.
2. **Concept sketches**: SDXL (DreamShaper XL Turbo, MPS) with IP-Adapter Plus taking HS's Korea
   select portrait as the style reference and a text description of each card person
   (`concept-sdxl.py`). They fixed the designs (#1's swept quiff and heavy brows, #2's parted
   wavy bob) but were not HS: frontal, necks, a copy of the portrait frame, and no way to get five
   consistent expressions. Nothing generated is shipped.
3. **The rig** (`hs_chars.py`), painted by `paint_hs.py` with Skia at 12 px per unit:
   - the silhouette: a head spline (dome, jowls, flat jaw), the ear, the hair (a cap plus
     brush-stroke **locks**, each a tapered stroke along a centreline, whose tips break the
     outline), unioned and keylined in `ink`;
   - skin in flat tones: `base` (forehead / eye band), a pale `light` **muzzle** with its `hi`
     streak under the eyes, `mid` for the back side, the hairline shadow and the nose's far side,
     `dark` for the ear and nostril; a chin shade; blush for #2;
   - each lock: base, a shade along one edge, one or two highlight streaks, a thin line round it;
   - a gold **rim** band inside the keyline on the top/back edge;
   - the face per expression (`EXPRS`): eye whites cut by the lid line, black pupils with ring and
     glint, lid shadow, heavy upper lid (lashes for #2); brow wedges on the lids; mouth.
   - The whole rig is scaled 0.87 about the chin (`SCALE`, `ANCHOR`) to HS's sprite size.
4. **Two outputs per expression**: the HD portrait (the render downsampled premultiplied to 3 px
   per unit) and the pitch sprite (`pixel_sprite`): the render with thicker lines (`bolder`: mouth
   x1.5, lids, keyline, a wider rim, so they survive at one pixel), box-filtered to 40 x 48,
   **every pixel snapped to the rig's own flat palette** (the colours covering > 0.04% of the
   render: hard cel edges, no blended tones) and hard alpha.

```sh
python3.11 -m venv ~/.charvenv && ~/.charvenv/bin/pip install numpy pillow skia-python
brew install webp
~/.charvenv/bin/python tools/chars/paint_hs.py            # writes public/img/chars + characters.js
~/.charvenv/bin/python tools/chars/paint_hs.py --png --out /tmp/chars   # review PNGs only
```

A `WARNING … touches the frame edge` means a lock or the hair is outside the frame.

## Expressions and when they show

`expressionFor` reads match state only. The sim is untouched.

| Expression | When | Face |
|---|---|---|
| `normal` | otherwise; portraits | determined: lids slanted, pupils to the opponent, a short down-turned mouth |
| `kick` | the kick swing (`p.kickT > 0`) | lids lower and fiercer, brows down, an open shout with top and bottom teeth |
| `hurt` | `p.stunned > 0` (knockout stars, power-shot daze) | eyes squeezed shut `> <`, brows up and knit, a small wobbly open mouth, a sweat drop; the game adds the stars and tips the head back |
| `happy` | the scorer, while the GOAL! banner stands | closed happy arcs, brows up, a wide open grin |
| `sad` | the other player, same time | worried brows, lids slanted the other way, pupils down, a frown, a tear |

The loser's result portrait is the `sad` face greyed like HS's (`.ov-face.lost`: grayscale, a
touch of sepia, brightness 0.42). The bruise tiers (`.hurt1..3`) are drawn at the rig's nose
(`nose`, written by the build).

## Adding a card

1. Copy the closer rig in `hs_chars.py` (short hair → `SHOVAL`, long hair → `ORI`), give it the
   card's `dir` and `name`, and change what makes the person: skin tones, hair tones and locks
   (centreline points + root/tip widths), brows (`browW`, `browArch`, `browC`), lashes, lips,
   blush. Keep the head, eyes and muzzle geometry: that is the HS construction.
2. Register it in `CHARS` and add a placeholder line for it in `CHARACTERS` (`public/characters.js`);
   the build rewrites that line with `nose` and `fit`.
3. Build, then check it (below) and `node test-characters.mjs`.

## Checking it

`HS_VIDEO_DIR=<folder with M3/M4> PORT=3121 CDP=9621 node _charfaces.mjs` → `.shots/charfaces/`:
the pick screen, the pitch frozen in each pose, zooms round each player at 3x and 1x, the result
screen, the arcade, and `sheet.png`: card | every expression (HD) | ours in-match 3x and 1x | HS
Korea and Mexico in-match at the same framing | the **1:1 row** (the phone at 3x is the
recording's own scale, so a 240 px crop of each, doubled nearest-neighbour, compares art pixel
for art pixel) | HS select and result portraits.

## Refinement log (the first two characters)

- **Pass 0.** First rig render: the HS construction was there (pale muzzle, slanted lids, brow
  wedges, keyline) but the eyes and pupils were half HS's size, #1's hair was a smooth helmet
  and #2's a wig, and the quiff ran off the top of the frame.
- **Pass 1.** Eyes enlarged to HS's (the eye band ~25% of the head), brows thickened, the muzzle
  and nose moved to the new eye band. Hair rebuilt from brush-stroke locks with shade and
  highlight streaks: #1's first try was a hedgehog (straight spikes), redone as six wide locks
  combed up and **back**; #2 got a parted crown, swept front locks and back locks to the jaw.
- **Pass 2 (in-match next to HS).** The smooth HD head looked pasted onto a pixel-art pitch.
  Measured HS's grid (480 x 320 stretched: 2.21 x 1.84 world px per art pixel) and added the
  pitch sprite at exactly that density, lines thickened for it, palette-snapped, hard alpha.
- **Pass 3.** Silhouette made HS's: the jowls wider than the cranium, the jaw lower and flatter;
  the grey band on the eye whites (it read as a visor) cut to a thin lid shadow; pupils raised
  under the lid (determined, not startled); #2's lids flattened, arched thinner brows, a waved
  outline, her back locks no longer sausages.
- **Pass 4 (with the new HS body).** The head covered the collar: the jaw lifted to end on
  `HEAD_SHAPE`'s jaw line, and the whole rig scaled 0.87 about the chin, because at the 1:1 row
  ours was ~25% wider than HS's sprite. #2's eyes brown → HS's black pupils. The dizzy spiral
  eyes turned to mush at 40 px: `hurt` now squeezes the eyes shut (HS's own hit face is a squint).
- **Pass 5.** #2's waves deepened (outer flick locks, deeper shade tone); pupil rings slimmed (they
  read grey); the gold rim wider on the pitch sprite and carried down the back of the cheek, as
  HS's in-match heads show it; the loser portrait sunk into HS's dark warm grey instead of flat
  grey; the WebPs brought under the budget (q84, the sprites lossless < 1 KB).
