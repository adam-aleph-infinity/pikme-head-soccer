# Real-face characters: Saltiz cards as Head Soccer characters

Most cards play as a crop of their photo (`head-crop.js`). A card listed in
`public/characters.js` plays as a **Head Soccer character made from the real person on the
card**: their own head, cut out of the card photo, upscaled and face-restored, re-posed into each
game expression, and given HS's big-head shape, lighting and dark keyline. It shows on the pitch,
on the pick-screen slots, in the arcade (your face and the champion reel), on the scoreboard faces
and on the result screen.

History: a plain photo crop in a circle was rejected ("just a photo of a card, no character"),
then hand-drawn SVG cartoons ("looks like Roblox, doesn't look like the cards"). This pipeline
keeps the person's real face and only changes what HS changes: proportions, pose, expression,
lighting, outline.

| Card | Dir | Notes |
|---|---|---|
| legendary #1 (Saltiz beach shack) | `legendary-1` | Card lit by a warm yellow shack light; shocked "O" mouth. Kick borrows a shout, hurt keeps his own open mouth with the eyes squeezed shut |
| legendary #2 (green worms) | `legendary-2` | Card lit bright green (skin and hair turned olive): colour undone in `grade`. Screaming on the card; the calm faces have the forehead furrows ironed out (`forehead`). Long hair trimmed to a bob just under the jaw |

## Files

- `public/img/chars/<dir>/{normal,kick,hurt,happy,sad}.webp`: one WebP with alpha per
  expression, 432 × 426 (3 px per head-box unit), 11-18 KB each, ~58 KB (#1) / ~85 KB (#2) per
  character. `test-characters.mjs` checks every file exists, has alpha, the frame size and the
  150 KB budget.
- `public/characters.js`: the registry (`'legendary:1' → { dir, nose, fit }`), the shared frame
  `CHAR_BOX`, and `expressionFor(match, player)`. `nose` places the red-nose bruise, `fit` is the
  drawn head's box (frame units) that portraits fit to their element. Both are printed by the
  build (`registry:` line).
- `tools/chars/build-real.py`: the pipeline (below). `tools/chars/real.json`: per-card settings.
- `tools/chars/vision-matte.swift`: macOS Vision subject/person mattes and face landmarks.
- `tools/chars/expressions.py`: LivePortrait retargeting, headless.
- `_charfaces.mjs`: shoots every screen with the two characters and builds the comparison sheet
  (see "Checking it").

## The frame

All coordinates are in **head-box units**. The head box the pitch draws (`HEAD_W × HEAD_H` of
the hitbox) is **100 × 91.5**. Every file is a 144 × 142-unit canvas with the box at (22, 26), so
hair can rise above and spill beside it. `paintPitchChar` (game.js) sizes the head's `<i>` to that
frame around the box; the build puts the chin on the box's bottom edge (where the body's collar
starts) and the face centre on the box's centre line. Portraits (`paintCharPortrait`) fit `fit`
into the element (`fill` 1.1 by default: a touch of hair and chin cropped; the result screen uses
1.0, the whole head).

Characters face **right** (a 12° head turn toward the opponent of player one, done by
LivePortrait). The client mirrors them with `scaleX(-1)` wherever they should face left: player
two on the pitch and scoreboard, the arcade champion, your pick-screen slot. The bruise overlay
lives inside the mirrored `<i>`, so it follows the nose.

## The pipeline (`build-real.py <dir>`)

Stages are cached in `--work` (default `.charwork/`, git-ignored), so `--from compose` re-tunes
the look in seconds without running any model.

1. **card**: download the card WebP (400 × 545; no bigger original exists: the Supabase bucket
   serves only that size, `render/image` just resamples it, listing needs a key, and the repo and
   its history hold no card art).
2. **vision**: `vision-matte.swift` runs `VNDetectFaceLandmarksRequest` (face box + 76 points)
   on the card.
3. **restore**: crop a square round the face (`span` × the face-box width, `up` of it above the
   face centre, enough for the top of the hair), **Real-ESRGAN x4plus** (×4, 800+ px), then
   **GFPGAN v1.4** on the face blended at `gfpgan` 0.6: crisp eyes, lashes, teeth and skin at
   the size a 3× phone shows, without turning into someone else (1.0 drifts the identity).
4. **grade**: undo the card's coloured light before the models see it. A hue rotation in Lab over
   a feathered hue band (`rot`, `band`, `rotHi` for the greenest highlights), chroma and
   lightness gains. #2: -36° (-46° on the hair highlights) takes olive skin back to skin and
   green-lit hair back to blonde. #1: chroma ×0.86, a touch brighter (the shack light made him
   orange).
5. **pose**: `expressions.py` = LivePortrait's image retargeting, headless. The card's own face
   is re-rendered from its own appearance features with nudged implicit keypoints, so it stays
   the same person. Per expression (`real.json` → `expressions`): `drive` borrows the
   expression of a LivePortrait example face (`d30.jpg` calm smile, `d19.jpg` open shout,
   `d8.jpg` sad pout, `laugh.pkl#20` a laugh frame), blended by `amount`, then the Gradio
   sliders on top: `eye`/`lip` open ratios, `smile`, `eyebrow`, `lip0..3`, and `yaw`/`pitch`/
   `roll`. Why `drive`: the sliders alone cannot calm a scream ("lip 0" on an open mouth gives a
   pout); an absolute expression from a calm face does.
6. **refine**: GFPGAN again on each posed face (LivePortrait decodes at 512 px), then Vision
   again on the posed image for its own mattes and landmarks (`VNGenerateForegroundInstance
   MaskRequest` and `VNGeneratePersonSegmentationRequest` at `.accurate`).
7. **compose** (numpy/OpenCV only):
   - **Matte**: the person matte limited to the (dilated) subject lift, where both agree: the
     person matte has the clean head and hair, the lift drops what it would not (card #2's
     arm and worms touching her hair).
   - **Head only**: everything under the jaw (the Vision face contour, a hair lower) goes: neck,
     shirt, shoulders. Long hair (`head.longHair`) may hang beside the face down to a curved
     hem, inside an ellipse round the head, as long as it is hair-coloured (not the black top,
     not pink worms), and thin strands and stray curls are opened away (`lockMin`).
   - **Silhouette**: holes closed, biggest blob, smoothed: a clean graphic outline, as HS
     has, instead of wispy photo hair.
   - **Decontaminate**: every pixel that is not solidly the person is refilled from inside the
     head, so no yellow or green card background bleeds into the edge.
   - **Forehead** (`forehead`, per expression in `styleBy`): mid-frequency removal on the
     forehead and between the brows, skin pixels only: the scream's furrows go, the texture
     stays.
   - **HS proportions** (`chibiTop`, `chibiLow`, `chibiUp`, `widen`, `eyes`): the cranium is
     widened toward the top, the face below the nose shortened, the hair above the brows
     lowered and the whole head widened a little, so it reads as HS's wide dome over a small
     jaw (wider than tall, like the 62 × 57 HS head); the eyes are magnified 20-24% with a smooth
     radial warp. The same person, pushed the way HS pushes a face.
   - **Look**: a light bilateral smoothing (`smoothMix` 0.35, so skin does not go waxy), an
     S-curve and chroma push, a back-side shade (the back of the head is the left) and a
     **dome lighting** pass (`volume`: normals from a blurred silhouette, key light front-top
     on the facing side) so the head has HS's rounded volume instead of a flat pasted photo; a
     soft occlusion inside the edge (`ao`) and a thin warm **rim light** along the back/top edge
     (`rim`, `rimColor`).
   - **Keyline**: a near-black warm-brown band (`#1c0f08`, `outline` 3.6 units ≈ 4% of the head
     height, HS's 1 native px), anti-aliased, the head inset under it by 0.3 unit so no halo shows.
   - **Placement**: the scale comes from the normal face's jaw width (`faceU` units), anchored on
     the eyes with the normal face's eye-to-chin offset, so no expression changes the head's
     size or jumps it up and down (an open mouth drops the chin). Premultiplied resize, then an
     unsharp mask (`sharpen`) inside the head at the final size, then `cwebp -q 82`.

## Expressions and when they show

`expressionFor` reads match state only. The sim is untouched.

| Expression | When | How it is made |
|---|---|---|
| `hurt` | `p.stunned > 0` (knockout stars, power-shot daze) | the card's own open mouth, eyes squeezed shut, brows knit; the game adds the stars and the knock-back tilt |
| `happy` / `sad` | while the GOAL! banner stands: the scorer happy, the other sad | a laugh (#1) / open smile (#2); a pout with lowered lids (d8) |
| `kick` | while the kick swing runs (`p.kickT > 0`) | #1 a shout with knit brows; #2 a set, tight smile with knit brows |
| `normal` | otherwise; portraits | a calm, slightly smiling face (d30) with the card's features |

The bruise tiers (`.hurt1..3`, the sim's `hurt`) are a flush, then a red nose, then nose + cheek,
drawn at the character's own nose (`--nose-x/-y`) with a multiply blend so the skin shows through.
The result screen shows both heads either side of the score: the winner happy, the loser sad and
greyed like HS's loser portrait (112 px, 96 px on a short phone).

## Adding a card

1. Dev tools (not game dependencies; nothing is added to `package.json`):
   ```sh
   brew install python@3.11 webp
   python3.11 -m venv ~/.charvenv && ~/.charvenv/bin/pip install numpy pillow opencv-python-headless \
     scipy torch torchvision onnxruntime huggingface_hub pyyaml tyro rich imageio imageio-ffmpeg \
     scikit-image ffmpeg-python matplotlib albumentations
   ~/.charvenv/bin/pip install --no-deps gfpgan basicsr facexlib realesrgan
   # basicsr imports a torchvision module that no longer exists:
   sed -i '' 's/functional_tensor import rgb_to_grayscale/functional import rgb_to_grayscale/' \
     ~/.charvenv/lib/python3.11/site-packages/basicsr/data/degradations.py
   git clone --depth 1 https://github.com/KwaiVGI/LivePortrait ~/LivePortrait
   ~/.charvenv/bin/python -c "from huggingface_hub import snapshot_download as d; d('KwaiVGI/LivePortrait', \
     local_dir='$HOME/LivePortrait/pretrained_weights', allow_patterns=['liveportrait/*','insightface/*'])"
   mkdir -p ~/charweights && cd ~/charweights && \
     curl -LO https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth && \
     curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
   ```
2. Add a block to `tools/chars/real.json` (copy the closer of the two: short hair → #1, long hair
   or a coloured light → #2). Set the card URL.
3. `CHAR_WEIGHTS=~/charweights LIVEPORTRAIT_DIR=~/LivePortrait ~/.charvenv/bin/python
   tools/chars/build-real.py <dir>` (a few minutes on an M-series Mac, MPS).
4. Look at `.charwork/<dir>/graded.png`: is the skin skin-coloured? Tune `grade`, rerun `--from grade`.
5. Look at every `.charwork/<dir>/refined/<expr>/final.png`. To pick an expression, render a grid of
   candidate presets (`expressions.py graded.png out/ presets.json`, one preset per key) and
   choose. Rerun `--from pose --only <expr>`.
6. Tune the look with `--from compose` (seconds). A `WARNING … touches the frame edge` means the
   head is too big for the frame: lower `faceU` or the `chibi*` values.
7. Add the card to `CHARACTERS` in `public/characters.js` with the printed `nose` and `fit`.
8. `PORT=3101 CDP=9601 node _charfaces.mjs` (point `pick.me` / `pick.foe` at the new card), view
   the sheet, `node test-characters.mjs`.

## Checking it

`PORT=3101 CDP=9601 HS_VIDEO_DIR=<folder with M3/M4> node _charfaces.mjs` → `.shots/charfaces/`:
the pick screen, the pitch frozen in each pose (stand, kick, hurt, goal, bruised) with zooms round
each player at the phone's 3× and at 1×, the result screen, the arcade, and `sheet.png`: card |
every expression | ours in-match 3× | ours 1× | HS Korea and Mexico in-match at the same framing |
HS Mexico 1× | HS select and result portraits.

## Refinement log (the first two characters)

- **Pass 0 (first pipeline run).** Faces read as photo stickers: tall egg-shaped heads, the top
  of #1's hair cut flat by the crop, worms and a hand stuck in #2's long hair, LivePortrait's
  "eye 0.3" made both look sleepy, and closing the card's open mouths with "lip 0" gave pouts.
- **Pass 1.** Expressions rebuilt on `drive` (a calm face's absolute expression), chosen from
  15-preset grids per card; a bigger restore crop (the whole hair); hair rules (hem, ellipse,
  hair colour, strands opened away); head anchored on the eyes. Wired into the game.
- **Pass 2 (in-match next to HS at 844×390, 3×).** Heads were smaller and narrower than HS's:
  bigger (`faceU`), widened, `chibiTop/Low/Up` for a wider-than-tall dome; the person matte
  replaced the subject lift (it had #2's arm); dome lighting and rim light; the distance-field
  dome showed a crease across the face, replaced by a blurred-silhouette dome.
- **Pass 3.** Skin had gone waxy (smoothing 0.75 → 0.35, occlusion halved, an unsharp mask at
  the final size); #2's scream furrows ironed out on the calm faces; hair highlights pushed from
  green to gold (`rotHi`); eyes magnified more; portraits fit the drawn head's own box (the
  result screen was cutting off the hair) and the result portraits grew to 112 px.
- **Pass 4.** #1 de-oranged and brightened, his kick changed from a pout to a shout; head size
  locked to the normal face (the jaw contour widens with an open mouth, which made the head
  change size between expressions); a clean rebuild from scratch checked the pipeline end to end.
