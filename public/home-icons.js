// THE HOME SCREEN'S ICONS — drawn here as inline SVG in the characters' own style (docs/HS-ART-STYLE.md):
// one dark keyline round each shape, two or three flat tones, a white highlight. Ours, in the Saltiz
// colours; the tiles they sit on are menus.css .hm-tile. Each is a 100 x 100 viewBox that the tile
// lets break out over its top edge.

const K = '#140c08';                      // the keyline, the heads' own
const svg = (body) => `<svg viewBox="0 0 100 100" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const ln = `stroke="${K}" stroke-width="5" paint-order="stroke"`;

// SHOP: a gift box in Saltiz red, a gold ribbon round it and a bow on the lid.
export const SHOP = svg(`
  <path d="M14 46h72v42a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#e8102e" ${ln}/>
  <path d="M14 46h72v10H14z" fill="#9a0a1e"/>
  <path d="M10 34h80v14H10z" fill="#ff3a4e" ${ln}/>
  <path d="M14 36h72v4H14z" fill="#ff8a96"/>
  <path d="M43 34h14v60H43z" fill="#ffd400" ${ln}/>
  <path d="M46 36h4v56h-4z" fill="#fff3a0"/>
  <path d="M50 34c-8-14-26-18-26-8 0 7 14 8 26 8zm0 0c8-14 26-18 26-8 0 7-14 8-26 8z" fill="#ffd400" ${ln}/>
  <path d="M30 26c4-2 10 1 14 5" fill="none" stroke="#fff3a0" stroke-width="3"/>
  <circle cx="50" cy="34" r="6" fill="#ffb000" ${ln}/>`);

// FRIENDS: two cartoon heads side by side, the one behind a little smaller.
export const FRIENDS = svg(`
  <path d="M8 92c2-16 12-24 24-24s22 8 24 24z" fill="#2f8cff" ${ln}/>
  <circle cx="32" cy="46" r="20" fill="#f2b98e" ${ln}/>
  <path d="M12 44c0-16 10-22 20-22s21 6 20 20c-6-6-14-8-22-6-6 2-12 6-18 8z" fill="#6a3a1c" ${ln}/>
  <circle cx="26" cy="50" r="3" fill="${K}"/><circle cx="39" cy="50" r="3" fill="${K}"/>
  <path d="M27 58q6 5 12 0" fill="none" stroke="${K}" stroke-width="3"/>
  <path d="M44 94c2-18 14-28 28-28s26 10 28 28z" fill="#e8102e" ${ln}/>
  <circle cx="70" cy="44" r="23" fill="#e7a879" ${ln}/>
  <path d="M46 40c2-18 14-24 24-24 14 0 24 8 23 24-8-8-16-10-26-7-8 2-14 6-21 7z" fill="#2a1d16" ${ln}/>
  <path d="M60 22c6-3 14-3 20 1" fill="none" stroke="#5a4636" stroke-width="3"/>
  <circle cx="63" cy="48" r="3.4" fill="${K}"/><circle cx="78" cy="48" r="3.4" fill="${K}"/>
  <path d="M62 57q8 8 16 0z" fill="#7a1e1e" stroke="${K}" stroke-width="2.6"/>`);

// LEADERBOARD: a 2-1-3 podium, a gold crown floating over the top step.
export const BOARD = svg(`
  <path d="M6 60h28v34H6z" fill="#7a8cff" ${ln}/>
  <path d="M66 68h28v26H66z" fill="#c07a3a" ${ln}/>
  <path d="M34 46h32v48H34z" fill="#ffd400" ${ln}/>
  <path d="M37 49h26v5H37z" fill="#fff3a0"/>
  <path d="M9 63h22v4H9z" fill="#b8c4ff"/><path d="M69 71h22v4H69z" fill="#e8a868"/>
  <text x="50" y="82" text-anchor="middle" font-family="Rubik, Arial, sans-serif" font-weight="900" font-size="24" fill="#8a4b00">1</text>
  <text x="20" y="86" text-anchor="middle" font-family="Rubik, Arial, sans-serif" font-weight="900" font-size="18" fill="#2a2f7a">2</text>
  <text x="80" y="89" text-anchor="middle" font-family="Rubik, Arial, sans-serif" font-weight="900" font-size="16" fill="#5a2a08">3</text>
  <path d="M30 38l-4-24 13 11 11-17 11 17 13-11-4 24z" fill="#ffd400" ${ln}/>
  <path d="M30 38h40v-6H30z" fill="#ffb000"/>
  <circle cx="50" cy="26" r="4" fill="#e8102e" stroke="${K}" stroke-width="2.4"/>
  <path d="M36 22l4 6" stroke="#fff3a0" stroke-width="3"/>`);

// BATTLE PASS: a gold ticket, notched at the sides, the Saltiz hexagon stamped on it.
export const PASS = svg(`
  <path d="M8 28h84v14a8 8 0 0 0 0 16v14H8V58a8 8 0 0 0 0-16z" fill="#ffd400" ${ln}/>
  <path d="M12 32h76v6H12z" fill="#fff3a0"/>
  <path d="M30 32v36" stroke="#b86e06" stroke-width="3" stroke-dasharray="4 4"/>
  <path d="M60 32l14 8v16l-14 8-14-8V40z" fill="#e8102e" ${ln}/>
  <path d="M60 40l7 4v8l-7 4-7-4v-8z" fill="#ffd400"/>
  <path d="M15 46h8M15 54h8" stroke="#b86e06" stroke-width="4"/>`);

// QUESTS: a cream scroll with three checklist lines, the first two ticked in Saltiz red.
export const QUESTS = svg(`
  <path d="M22 12h56a6 6 0 0 1 6 6v64a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#fff3d0" ${ln}/>
  <path d="M22 16h56v6H22z" fill="#ffd400"/>
  <path d="M26 34l5 5 9-10M26 54l5 5 9-10" fill="none" stroke="#e8102e" stroke-width="6"/>
  <circle cx="33" cy="76" r="6" fill="none" stroke="#b86e06" stroke-width="4"/>
  <path d="M50 36h26M50 56h26M50 76h20" stroke="#b86e06" stroke-width="5"/>`);

// TROPHY: a gold cup on a dark base.
export const TROPHY = svg(`
  <path d="M26 12h48v22c0 16-10 26-24 26S26 50 26 34z" fill="#ffd400" ${ln}/>
  <path d="M26 20H12c0 14 8 22 18 22M74 20h14c0 14-8 22-18 22" fill="none" stroke="${K}" stroke-width="9"/>
  <path d="M26 20H12c0 14 8 22 18 22M74 20h14c0 14-8 22-18 22" fill="none" stroke="#ffb000" stroke-width="4"/>
  <path d="M33 16h6v22c0 8 4 13 9 15-10 0-15-7-15-15z" fill="#fff3a0"/>
  <path d="M44 58h12v14H44z" fill="#ffb000" ${ln}/>
  <path d="M28 72h44v16H28z" fill="#5a3a8a" ${ln}/>
  <path d="M32 75h36v4H32z" fill="#8a6ac0"/>`);

// SETTINGS: a steel gear.
const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="43" y="6" width="14" height="18" rx="2" transform="rotate(${i * 45} 50 50)"/>`).join('');
export const GEAR = svg(`
  <g fill="#c9ced6" stroke="${K}" stroke-width="5" paint-order="stroke">${teeth}<circle cx="50" cy="50" r="30"/></g>
  <g fill="#c9ced6">${teeth}</g>
  <circle cx="50" cy="50" r="30" fill="#c9ced6"/>
  <path d="M30 40a24 24 0 0 1 30-16" fill="none" stroke="#f6f8fa" stroke-width="5"/>
  <circle cx="50" cy="50" r="12" fill="#3a3f4a" stroke="${K}" stroke-width="4"/>`);
