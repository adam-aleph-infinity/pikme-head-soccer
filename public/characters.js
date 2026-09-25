// THE CARDS THAT HAVE A REAL CHARACTER.
//
// Most cards are played as a crop of their photo (head-crop.js). A card listed here is played
// as a Head Soccer character made from the REAL person on the card: their own head cut out of
// the card photo, upscaled and face-restored, re-posed into each expression (LivePortrait), then
// given HS's big-head shape, grading, rim light and dark keyline — public/img/chars/<dir>/
// <expression>.webp, built by tools/chars/build-real.py. How, and how to add a card:
// docs/CHARACTERS.md.
//
// Every file shares one frame, CHAR_BOX, in "head-box units": the head box the pitch draws (HEAD_W
// x HEAD_H of the hitbox, game.js) is 100 wide and 91.5 tall, and the image reaches `x` left of it
// and `y` above it so hair can break the outline the way HS hair does. Files are 3 px per unit.
export const CHAR_BOX = { x: 22, y: 26, w: 144, h: 142, boxW: 100, boxH: 91.5 };

export const EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad'];

// nose: where the nose tip sits in the frame (fractions of its width/height), for the red-nose
// bruise (.hurt1..3, style.css); fit: the drawn head's box in frame units, which portraits fit to
// their element. Both printed by build-real.py (registry:).
export const CHARACTERS = {
  'legendary:1': { dir: 'legendary-1', name: 'Shoval', nose: [0.569, 0.627], fit: [5.8, 2.0, 135.1, 121.2] },
  'legendary:2': { dir: 'legendary-2', name: 'Ori', nose: [0.569, 0.627], fit: [3.0, 1.8, 140.6, 121.3] },
};

export const characterFor = (rarity, number) => CHARACTERS[`${rarity}:${number}`] || null;

// The pitch sprite of the same face: the art box-filtered to the pitch's own texel size (the head
// box is ~31 texels of the half-res canvas) and shown pixelated, as HS's in-match heads are.
export const CHAR_PX = { w: 45, h: 44 };

export const charUrl = (ch, expr = 'normal', px = false) =>
  `img/chars/${ch.dir}/${px ? 'px-' : ''}${EXPRESSIONS.includes(expr) ? expr : 'normal'}.webp`;

// Which face a player on the pitch is making, from match state only (the sim is not touched):
// hurt while stunned (the knockout's stars, or a power-shot daze), happy after scoring and sad
// after conceding while the GOAL! banner stands, gritted while kicking. NOT off `p.hurt`: that is
// the bruise tier (kickDamage), kept for the whole match, and HS shows it as a mark on the face —
// the .hurt1..3 overlay — not as a face held for the rest of the game.
export function expressionFor(m, p) {
  if (p.stunned > 0) return 'hurt';
  if (m && m.banner === 'goal' && m.lastScorer != null) return m.lastScorer === p.index ? 'happy' : 'sad';
  if (p.kickT > 0) return 'kick';
  return 'normal';
}
