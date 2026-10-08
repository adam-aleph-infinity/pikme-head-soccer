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

// nose: where the nose tip sits in the frame (fractions of its width/height), for the red nose
// (the hit marks, style.css); eyes: the back and front eye's centres, for the blue and the black
// eye (read off the art on a 10% grid; all five sit within a point of these); fit: the drawn head's box in frame units, which portraits fit to
// their element. Both written here by paint_hs.py.
export const CHARACTERS = {
  // #1-#45: the new champions Idan picked off public/_champions.html (2026-10-08), drawn as vector
  // designs (public/champ-concepts) and built by tools/chars/champ_build.py, which prints these lines.
  // The art they replace (Shoval, Ori, Naveh, Naveh, Paz) is kept in .charwork/backup/.
  'legendary:1': { dir: 'legendary-1', name: 'Pirate Parrot', nose: [0.775, 0.437], eyes: [[0.404, 0.451], [0.617, 0.43]], fit: [0.0, 3.0, 143.0, 119.5] },
  'legendary:2': { dir: 'legendary-2', name: 'Green Snake', nose: [0.861, 0.394], eyes: [[0.514, 0.352], [0.715, 0.342]], fit: [10.5, 8.0, 141.5, 121.0] },
  'legendary:3': { dir: 'legendary-3', name: 'Flame Burger', nose: [0.609, 0.332], eyes: [[0.446, 0.283], [0.63, 0.273]], fit: [3.5, 0.0, 143.5, 121.0] },
  'legendary:4': { dir: 'legendary-4', name: 'Saltiz Bar', nose: [0.624, 0.518], eyes: [[0.462, 0.481], [0.653, 0.447]], fit: [12.0, 5.5, 135.0, 120.5] },
  'legendary:5': { dir: 'legendary-5', name: 'Ice Pop', nose: [0.559, 0.417], eyes: [[0.384, 0.31], [0.599, 0.33]], fit: [13.0, 2.0, 132.0, 120.0] },
  'legendary:6': { dir: 'legendary-6', name: 'Sack Brute', nose: [0.667, 0.52], eyes: [[0.472, 0.457], [0.722, 0.436]], fit: [7.5, 0.0, 141.5, 116.5] },
  'legendary:7': { dir: 'legendary-7', name: 'Coin-Brain Bot', nose: [0.61, 0.595], eyes: [[0.445, 0.533], [0.7, 0.519]], fit: [0.0, 0.0, 144.0, 117.5] },
  'legendary:8': { dir: 'legendary-8', name: 'Bullseye', nose: [0.639, 0.542], eyes: [[0.431, 0.423], [0.701, 0.415]], fit: [19.5, 0.0, 136.5, 119.5] },
  'legendary:9': { dir: 'legendary-9', name: 'Red Tide', nose: [0.661, 0.602], eyes: [[0.448, 0.506], [0.681, 0.493]], fit: [8.5, 1.0, 143.0, 127.0] },
  'legendary:10': { dir: 'legendary-10', name: 'Blaze', nose: [0.616, 0.585], eyes: [[0.439, 0.493], [0.666, 0.475]], fit: [5.5, 0.0, 138.0, 121.5] },
  'legendary:11': { dir: 'legendary-11', name: 'Banshee', nose: [0.639, 0.535], eyes: [[0.472, 0.437], [0.701, 0.408]], fit: [0.0, 4.5, 137.0, 120.5] },
  'legendary:12': { dir: 'legendary-12', name: 'Globetrotter', nose: [0.65, 0.496], eyes: [[0.469, 0.415], [0.693, 0.404]], fit: [11.0, 0.0, 144.0, 124.0] },
  'legendary:13': { dir: 'legendary-13', name: 'Daruma', nose: [0.597, 0.548], eyes: [[0.465, 0.451], [0.715, 0.437]], fit: [9.5, 3.0, 138.5, 120.5] },
  'legendary:14': { dir: 'legendary-14', name: 'Castle Keep', nose: [0.561, 0.618], eyes: [[0.366, 0.499], [0.649, 0.485]], fit: [9.5, 0.0, 138.5, 122.0] },
  'legendary:15': { dir: 'legendary-15', name: 'Heavy Present', nose: [0.66, 0.592], eyes: [[0.458, 0.493], [0.771, 0.482]], fit: [12.5, 0.0, 135.5, 120.0] },
  'legendary:16': { dir: 'legendary-16', name: 'Melon Float', nose: [0.528, 0.599], eyes: [[0.378, 0.528], [0.614, 0.518]], fit: [15.0, 0.0, 143.5, 120.0] },
  'legendary:17': { dir: 'legendary-17', name: 'Astronaut', nose: [0.694, 0.493], eyes: [[0.486, 0.412], [0.688, 0.401]], fit: [3.0, 0.0, 130.5, 116.5] },
  'legendary:18': { dir: 'legendary-18', name: 'Robot', nose: [0.625, 0.577], eyes: [[0.458, 0.451], [0.708, 0.444]], fit: [3.5, 0.0, 129.5, 121.0] },
  'legendary:19': { dir: 'legendary-19', name: 'Two-Way Chameleon', nose: [0.836, 0.495], eyes: [[0.675, 0.125], [0.626, 0.437]], fit: [6.5, 8.0, 144.0, 122.5] },
  'legendary:20': { dir: 'legendary-20', name: 'Royal Flush', nose: [0.601, 0.6], eyes: [[0.441, 0.529], [0.667, 0.518]], fit: [16.0, 2.0, 140.5, 121.5] },
  'legendary:21': { dir: 'legendary-21', name: 'Hot Bucket', nose: [0.542, 0.558], eyes: [[0.379, 0.486], [0.613, 0.476]], fit: [15.5, 0.0, 142.0, 121.5] },
  'legendary:22': { dir: 'legendary-22', name: 'Raccoon Bandit', nose: [0.875, 0.525], eyes: [[0.417, 0.434], [0.66, 0.42]], fit: [10.5, 1.0, 138.0, 117.5] },
  'legendary:23': { dir: 'legendary-23', name: 'Burnout', nose: [0.556, 0.465], eyes: [[0.479, 0.401], [0.625, 0.391]], fit: [5.5, 7.5, 143.0, 123.5] },
  'legendary:24': { dir: 'legendary-24', name: 'Genie Lamp', nose: [0.569, 0.537], eyes: [[0.403, 0.48], [0.618, 0.469]], fit: [4.0, 0.0, 144.0, 117.5] },
  'legendary:25': { dir: 'legendary-25', name: 'Scuba Diver', nose: [0.694, 0.606], eyes: [[0.472, 0.496], [0.674, 0.486]], fit: [3.0, 0.5, 130.0, 121.0] },
  'legendary:26': { dir: 'legendary-26', name: 'Vending Machine', nose: [0.75, 0.471], eyes: [[0.4, 0.457], [0.635, 0.45]], fit: [14.5, 6.5, 126.0, 119.0] },
  'legendary:27': { dir: 'legendary-27', name: 'Carousel Horse', nose: [0.882, 0.579], eyes: [[0.55, 0.323], [0.738, 0.309]], fit: [11.0, 0.0, 144.0, 121.0] },
  'legendary:28': { dir: 'legendary-28', name: 'Rock', nose: [0.535, 0.373], eyes: [[0.417, 0.31], [0.618, 0.306]], fit: [13.5, 4.5, 134.0, 122.0] },
  'legendary:29': { dir: 'legendary-29', name: 'Narwhal', nose: [0.792, 0.474], eyes: [[0.486, 0.381], [0.701, 0.369]], fit: [13.5, 3.0, 144.0, 117.5] },
  'legendary:30': { dir: 'legendary-30', name: 'Wagyu', nose: [0.542, 0.507], eyes: [[0.403, 0.44], [0.632, 0.43]], fit: [12.0, 0.0, 137.5, 121.0] },
'legendary:31': { dir: 'legendary-31', name: 'Rat King', nose: [0.794, 0.615], eyes: [[0.479, 0.451], [0.668, 0.44]], fit: [11.0, 0.0, 144.0, 120.0] },
  'legendary:32': { dir: 'legendary-32', name: 'Count Bunny', nose: [0.625, 0.529], eyes: [[0.439, 0.437], [0.669, 0.426]], fit: [6.0, 0.0, 139.5, 117.5] },
  'legendary:33': { dir: 'legendary-33', name: 'Tycoon', nose: [0.761, 0.563], eyes: [[0.441, 0.461], [0.652, 0.451]], fit: [9.5, 0.0, 138.5, 121.0] },
  'legendary:34': { dir: 'legendary-34', name: 'Storm Wizard', nose: [0.703, 0.569], eyes: [[0.426, 0.457], [0.637, 0.447]], fit: [2.5, 0.0, 138.0, 122.0] },
  'legendary:35': { dir: 'legendary-35', name: 'Big Meat', nose: [0.542, 0.493], eyes: [[0.389, 0.423], [0.59, 0.412]], fit: [11.5, 0.0, 135.0, 120.5] },
  'legendary:36': { dir: 'legendary-36', name: 'Coin Tycoon', nose: [0.623, 0.549], eyes: [[0.397, 0.451], [0.681, 0.419]], fit: [9.5, 0.0, 138.5, 118.5] },
  'legendary:37': { dir: 'legendary-37', name: 'Cracked Mirror', nose: [0.521, 0.437], eyes: [[0.417, 0.366], [0.604, 0.359]], fit: [17.5, 0.0, 136.0, 120.0] },
  'legendary:38': { dir: 'legendary-38', name: 'Coconut', nose: [0.569, 0.549], eyes: [[0.438, 0.444], [0.653, 0.433]], fit: [12.0, 0.0, 137.5, 121.5] },
  'legendary:39': { dir: 'legendary-39', name: 'Prime Minister', nose: [0.75, 0.59], eyes: [[0.438, 0.468], [0.653, 0.457]], fit: [4.5, 1.0, 140.0, 120.5] },
  'legendary:40': { dir: 'legendary-40', name: 'Ghost Gummy', nose: [0.6, 0.539], eyes: [[0.454, 0.438], [0.68, 0.43]], fit: [7.0, 4.0, 134.0, 117.5] },
  'legendary:41': { dir: 'legendary-41', name: 'Supercar', nose: [0.771, 0.521], eyes: [[0.611, 0.454], [0.833, 0.443]], fit: [12.0, 0.0, 141.0, 118.0] },
  'legendary:42': { dir: 'legendary-42', name: 'Tank', nose: [0.583, 0.444], eyes: [[0.458, 0.373], [0.632, 0.366]], fit: [12.5, 7.0, 141.0, 120.0] },
  'legendary:43': { dir: 'legendary-43', name: 'The Reaper', nose: [0.625, 0.549], eyes: [[0.472, 0.479], [0.674, 0.468]], fit: [8.5, 0.0, 142.5, 121.0] },
  'legendary:44': { dir: 'legendary-44', name: 'Rodeo Bull', nose: [0.773, 0.676], eyes: [[0.432, 0.423], [0.677, 0.405]], fit: [4.0, 0.0, 139.5, 117.5] },
  'legendary:45': { dir: 'legendary-45', name: 'Vault Door', nose: [0.528, 0.423], eyes: [[0.431, 0.31], [0.604, 0.303]], fit: [15.0, 3.0, 133.0, 121.0] },
  // the tutorial's coach (no card): the Saltiz commentator, a bust (public/champ-concepts/card-00.js)
  'coach:1': { dir: 'coach', name: 'Saltiz Commentator', nose: [0.688, 0.345], eyes: [[0.458, 0.299], [0.604, 0.292]], fit: [0.5, 0.5, 144.0, 142.0] },
  // THE MYTHIC STARTERS (shared/mythics.js): the artist's own heads, traced from the sheets as a
  // cartoon and laid exactly on the drawn-head box, so they stand over the same hitbox
  // (tools/chars/mythic_trace.py → mythic_build.py, which prints these lines; docs/CHARACTERS.md).
  'mythic:1': { dir: 'mythic-1', name: 'Shoval', nose: [0.793, 0.58], eyes: [[0.393, 0.502], [0.742, 0.502]], fit: [8.8, 2.5, 141.5, 120.5] },
  'mythic:2': { dir: 'mythic-2', name: 'Ori', nose: [0.773, 0.612], eyes: [[0.429, 0.494], [0.685, 0.494]], fit: [10.0, 2.2, 141.5, 120.5] },
  'mythic:3': { dir: 'mythic-3', name: 'Naveh', nose: [0.876, 0.583], eyes: [[0.499, 0.472], [0.824, 0.472]], fit: [8.8, 2.5, 141.5, 120.2] },
  'mythic:4': { dir: 'mythic-4', name: 'Paz', nose: [0.836, 0.646], eyes: [[0.502, 0.484], [0.788, 0.484]], fit: [9.0, 2.5, 141.2, 120.2] },
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
// The Mythics wear their sheets' kits: the shirt's colour on the suit, its white yoke as the
// collar band with the trim's colour for its shadow, and the gold hexagon badge on the chest.
const mythicKit = (base, shade, light, spec, trim) => ({
  suit: { base, shade, light, spec }, collar: '#f6f4ee', collarDark: trim, collarLight: '#ffffff', badge: { base: '#f2c230', mark: '#fff2b0' },
});
KITS['mythic:1'] = mythicKit('#d81f33', '#a3121f', '#f04a5c', '#ffc2ca', '#d6a23a');      // שובל: red (his team's, Idan 2026-10-08; the sheet's was black), gold trim
KITS['mythic:2'] = mythicKit('#f493bd', '#d9709c', '#ffb3d1', '#ffe0ee', '#e4b24c');      // אורי: pink
KITS['mythic:3'] = mythicKit('#f4c21f', '#d39a12', '#ffe066', '#fff3b0', '#8a5a1c');      // נוה: yellow, brown trim
KITS['mythic:4'] = mythicKit('#2ea64e', '#1f7d38', '#5fcb73', '#bdf0c8', '#d9a53a');      // פז: green
export const kitFor = (rarity, number) => KITS[`${rarity}:${number}`] || null;

// The pitch sprite of the same face, in HS art pixels: HS renders at 480 x 320 stretched to the
// phone, one art pixel = 2.21 x 1.84 world px (non-square), so the 144 x 142-unit frame (89 x 88
// world px) is 40 x 48 of them. Not used on the pitch any more (see the top of this file).
export const CHAR_PX = { w: 40, h: 48 };

export const charUrl = (ch, expr = 'normal', px = false) =>
  `img/chars/${ch.dir}/${px ? 'px-' : ''}${EXPRESSIONS.includes(expr) ? expr : 'normal'}.webp`;

// The face a player shows: always the one face — the characters make no expressions (Idan,
// 2026-09-27, again after trying HS's eyes-shut hit face). The knockout's stars and the hit
// marks (.hurt1..3) still show over it.
export function expressionFor() {
  return 'normal';
}
