# Head Soccer's character art style

What our characters (`docs/CHARACTERS.md`) copy: the *style*, never the art. Studied from
full-resolution frames of `hs-video/M3-airdrop-full.mp4` and `hs-video/M4-gaps.mp4` (HEVC,
rotated to 2556 x 1180): PLAYER SELECT at M3 0.8 s and M4 0.8 s (Korea, Mexico, Netherlands),
RESULT at M3 92.8 s (Korea lost, Mexico won), in-match at M4 29.98 s (Korea standing), M4 62.5 s
(Korea knocked back) and M3 40 s (Mexico). The headsoccer.wiki.gg character images block
scripted downloads (every file came back as the same error page), so the recording is the
reference. **No HS image is in the repo**: crops live in the scratch/`.shots` folders only.

## Silhouette

- **The character is a head.** A body only peeks out under the chin (a black suit, a collar,
  two boots). The head sprite is wider than tall: 62 x 57 in the 1280-wide frame.
- **Wide jaw, jowls.** A dome of a cranium, then the cheeks bulge out *past* the cranium at mouth
  level, widest in the lower third, and the bottom is nearly flat with rounded corners. Korea's
  lower face is a big pale "muzzle" that reads like a bulldog's jowls.
- **Three-quarter view toward the opponent.** Face features sit right of centre, the far eye is
  narrower, the ear shows on the back (left) side only, the far cheek bulges past the eye.
- Hair sits low on the head and breaks the outline in a few chunky clumps; it is part of the one
  silhouette the keyline goes round.

## Line

- One **near-black warm-brown keyline** (`#1c120d`-ish) round the whole silhouette: ~2.5-3% of
  the head width in the HD portraits, 1 art pixel in-match.
- Inner lines are thinner and fewer: the ear, the fringe where it lies on the forehead, the
  upper lids (heavy, black), a thin line under the eyes, the mouth. Hair clumps are separated
  mostly by tone, with only thin dark lines.

## Shading: flat cel tones with hard edges

- Skin in **three or four flat tones**, no gradients: a mid tan on the forehead / eye band, a
  **pale muzzle** (cheeks, mouth, chin) with a hard edge just under the eyes, a darker tone on the
  back side of the head, under the hairline and down the nose's far side, and a pale-yellow
  **highlight streak** along the top of the muzzle under each eye.
- Light comes from the front-top on the facing side. Shadow shapes are hard-edged and simple.
- In-match the heads also carry a **gold rim** of pixels along the top/back edge of the hair and
  cheek (Korea: yellow pixels on the hair tips and the back of the head).

## Eyes, brows, nose, mouth

- **Big white eyes**: wide rounded quads with a flat bottom, the top cut on a slant by the lid so
  the default look is **angry / determined**. A thin grey lid shadow under the lid line.
- **Black pupils**, big (nearly the full eye height), looking toward the opponent, cut by the
  lid, with a dark-grey ring on one side and a white glint. No coloured irises.
- **Thick angular brows**: dark wedges sitting right on the lids, thicker at the inner end,
  slanting down toward the nose, a lighter bevel on top. Two short furrow marks between them.
- **Nose**: barely there; a small dark nostril wedge under the eye band, a light bridge streak.
- **Mouth**: small. A short dark line, slightly down-turned, with a lip-shadow tone under it.
  Expressions change only eyes, brows and mouth (HS swaps the face sprite: a squint when hit).

## Hair

- **Chunky clumps**, each with its own base tone, a darker shade along one edge and a
  **highlight streak** (1-2 lighter tones) along its length; Korea's black hair has grey and
  gold streaks. Tips are pointed and break the silhouette.

## Palette

Warm, saturated, mid-contrast: skin `#d9a073 / #eec499 / #fae0b3 / #b97c52` (tan) or lighter
`#efc39c / #f9dbbb`; hair near-black `#2e2520` with `#554539 / #86705d` streaks; blonde
`#ebc466 / #bf8a38 / #f8e09a / #fff6cf`; pure white eyes, black pupils, a gold `#ffd24a` rim.

## Pixel art in-match

HS renders at **480 x 320**, stretched to fill the phone: the recording's pixel grid measures
**4.44 x 3.70 recording px per art pixel** (FFT of the edge energy over three frames, M3 40,
M4 29.98, M4 62.5 — identical). At the calibration of `docs/hs-clips` (0.5 world px per
recording px) that is **2.21 x 1.84 world px per art pixel** (not square), and a head is about
**28 art pixels wide**. Every head is its HD art shrunk to that grid: hard alpha, flat tones,
the keyline 1 pixel, pupils 2-3 pixels, a brow 1-2 pixels thick, a mouth 1 pixel. It is drawn
nearest-neighbour, and when the head tips back (hit) the pixels rotate with it.

The PLAYER SELECT (octagonal gold frames) and RESULT portraits are the same art at full HD: smooth
vector edges, the same tones; the result screen's loser portrait is the same face sunk into a
dark warm grey.
