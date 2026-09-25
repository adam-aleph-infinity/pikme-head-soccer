// THE CARDS THAT HAVE A CHARACTER.
//
// Most cards are played as a crop of their photo (head-crop.js). A card listed here is played
// as a Head Soccer-style cartoon character whose identity (hair, skin, face shape, gender) comes
// from the person on the card: painted in HS's own art style by a rig of cel-shaded vector shapes
// (tools/chars/paint_hs.py, the rigs in tools/chars/hs_chars.py), one head with the face swapped
// per expression. Two files per expression in public/img/chars/<dir>/: <expression>.webp, the
// smooth high-detail portrait (pick screen, arcade, scoreboard, result), and px-<expression>.webp,
// the pitch sprite at HS's in-match pixel density, shown pixelated. How, and how to add a card:
// docs/CHARACTERS.md; the style itself: docs/HS-ART-STYLE.md.
//
// Every file shares one frame, CHAR_BOX, in "head-box units": the head box the pitch draws (HEAD_W
// x HEAD_H of the hitbox, game.js) is 100 wide and 91.5 tall, and the image reaches `x` left of it
// and `y` above it so hair can break the outline the way HS hair does. Files are 3 px per unit.
export const CHAR_BOX = { x: 22, y: 26, w: 144, h: 142, boxW: 100, boxH: 91.5 };

export const EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad'];

// nose: where the nose tip sits in the frame (fractions of its width/height), for the red-nose
// bruise (.hurt1..3, style.css); fit: the drawn head's box in frame units, which portraits fit to
// their element. Both written here by paint_hs.py.
export const CHARACTERS = {
  'legendary:1': { dir: 'legendary-1', name: 'Shoval', nose: [0.56, 0.653], fit: [14.3, 17.0, 126.9, 118.0] },
  'legendary:2': { dir: 'legendary-2', name: 'Ori', nose: [0.56, 0.653], fit: [10.8, 16.8, 132.0, 118.1] },
};

export const characterFor = (rarity, number) => CHARACTERS[`${rarity}:${number}`] || null;

// The pitch sprite of the same face, in HS art pixels: HS renders at 480 x 320 stretched to the
// phone, one art pixel = 2.21 x 1.84 world px (non-square), so the 144 x 142-unit frame (89 x 88
// world px) is 40 x 48 of them. Shown pixelated (style.css .head.char > i), as HS's heads are.
export const CHAR_PX = { w: 40, h: 48 };

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
