// THE CHAMPIONS' OWN POWERS, DRAWN — one renderer per built stage (shared/champion-powers.js is
// what each one does). champ-vfx.js dispatches a power ball whose `cp` is here to its renderer
// instead of its family's comet.
//
// A renderer: { id, palette, draw(g, b, s) → true to hide the plain ball, armed?(g, p, s),
// hideInCut?, cutin?(g, s), over?(g, s) } — see champ-vfx.js for what `s` carries.

import P01 from './stage-01.js';
import P02 from './stage-02.js';
import P03 from './stage-03.js';
import P04 from './stage-04.js';

// The registry: one line per built stage.
const LIST = [
  P01,
  P02,
  P03,
  P04,
];

export const POWER_VFX = Object.freeze(Object.fromEntries(LIST.map((v) => [v.id, v])));
