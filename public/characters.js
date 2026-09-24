// THE CARDS THAT HAVE A REAL CHARACTER.
//
// Most cards are played as a crop of their photo (head-crop.js). A card listed here is played
// as a drawn Head Soccer-style cartoon of the person on it instead — hand-authored SVG heads in
// public/img/chars/<dir>/<expression>.svg, built by tools/chars/build.mjs. How they are drawn,
// and how to add one: docs/CHARACTERS.md.
//
// Every SVG shares one frame, CHAR_BOX, in "head-box units": the head box the pitch draws (HEAD_W
// x HEAD_H of the hitbox, game.js) is 100 wide and 91.5 tall, and the file's viewBox reaches
// `x` left of it and `y` above it so hair can break the outline the way HS hair does.
export const CHAR_BOX = { x: 22, y: 26, w: 144, h: 142, boxW: 100, boxH: 91.5 };

export const EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad'];

export const CHARACTERS = {
  'legendary:1': { dir: 'legendary-1', name: 'Shoval' },
  'legendary:2': { dir: 'legendary-2', name: 'Ori' },
};

export const characterFor = (rarity, number) => CHARACTERS[`${rarity}:${number}`] || null;

export const charUrl = (ch, expr = 'normal') =>
  `img/chars/${ch.dir}/${EXPRESSIONS.includes(expr) ? expr : 'normal'}.svg`;

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
