// THE CARDS THAT HAVE A CHARACTER.
//
// Most cards are played as a crop of their photo (head-crop.js). A card listed here is played
// as a Head Soccer-style cartoon character whose identity (hair, skin, face shape, gender) comes
// from the person on the card: painted in HS's own art style by a rig of cel-shaded vector shapes
// (tools/chars/paint_hs.py, the rigs in tools/chars/hs_chars.py), one head with the face swapped
// per expression. Two files per expression in public/img/chars/<dir>/: <expression>.webp, the
// smooth high-detail portrait (pick screen, arcade, scoreboard, result), and px-<expression>.webp,
// the pitch sprite at HS's in-match pixel density (built, but not shown: the pitch uses the HD
// portrait, since a 40 x 48 sprite stretched to a phone screen reads blurred). How, and how to add a card:
// docs/CHARACTERS.md; the style itself: docs/HS-ART-STYLE.md.
//
// Every file shares one frame, CHAR_BOX, in "head-box units": the head box the pitch draws (HEAD_W
// x HEAD_H of the hitbox, game.js) is 100 wide and 91.5 tall, and the image reaches `x` left of it
// and `y` above it so hair can break the outline the way HS hair does. Portraits are 4 px per unit.
export const CHAR_BOX = { x: 22, y: 26, w: 144, h: 142, boxW: 100, boxH: 91.5 };

export const EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad'];

// nose: where the nose tip sits in the frame (fractions of its width/height), for the red-nose
// bruise (.hurt1..3, style.css); fit: the drawn head's box in frame units, which portraits fit to
// their element. Both written here by paint_hs.py.
export const CHARACTERS = {
  'legendary:1': { dir: 'legendary-1', name: 'Shoval', nose: [0.68, 0.577], fit: [12.9, 4.8, 137.2, 118.2] },
  'legendary:2': { dir: 'legendary-2', name: 'Ori', nose: [0.678, 0.58], fit: [11.3, 3.1, 141.8, 133.8] },
  'legendary:3': { dir: 'legendary-3', name: 'Naveh', nose: [0.68, 0.577], fit: [12.9, 2.2, 142.8, 118.2] },
  'legendary:4': { dir: 'legendary-4', name: 'Naveh', nose: [0.676, 0.582], fit: [14.2, 1.9, 134.3, 118.2] },
};

export const characterFor = (rarity, number) => CHARACTERS[`${rarity}:${number}`] || null;

// THE CLOTHES FROM THE CARD, on the body under the head (public/body-art.js). A card not listed
// wears the black HS suit, which is also what #1, #2 and #4 wear on their cards (a black
// T-shirt). `suit` replaces the suit's tones; `collar` its team-colour band; `badge` puts the Saltiz logo on the chest.
export const KITS = {
  'legendary:3': {
    suit: { base: '#f5c518', shade: '#c99a0c', light: '#ffe46a', spec: '#fff6c0' },
    collar: '#f5c518', collarDark: '#b8880a', collarLight: '#fff1a0', badge: { base: '#e2231a', mark: '#ffd21a' },   // the Saltiz logo on the chest
  },
};
export const kitFor = (rarity, number) => KITS[`${rarity}:${number}`] || null;

// The pitch sprite of the same face, in HS art pixels: HS renders at 480 x 320 stretched to the
// phone, one art pixel = 2.21 x 1.84 world px (non-square), so the 144 x 142-unit frame (89 x 88
// world px) is 40 x 48 of them. Not used on the pitch any more (see the top of this file).
export const CHAR_PX = { w: 40, h: 48 };

export const charUrl = (ch, expr = 'normal', px = false) =>
  `img/chars/${ch.dir}/${px ? 'px-' : ''}${EXPRESSIONS.includes(expr) ? expr : 'normal'}.webp`;

// The face a player shows: always the one face — the characters make no expressions. (The
// knockout's stars and the red-nose bruise, .hurt1..3, still show over it.)
export function expressionFor() {
  return 'normal';
}
