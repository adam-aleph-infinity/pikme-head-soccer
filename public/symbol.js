// THE SALTIZ SYMBOL, drawn instead of pasted. img/saltiz.jpg is a 900px JPEG on a black square:
// it cannot glow, assemble, tint or sit on anything that is not black. This is the same mark
// rebuilt from its own geometry, measured off that file (2026-10-06):
//
//   a pointy-top hexagon (circumradius 50) seen as a cube — a frame 12.55 thick round the
//   edge, and the cube's three inner edges from the centre: up to the top, down-left to the
//   lower-left corner, and down-right to the lower-right one. Colour does the rest:
//     red  — the left wall, the top-left edge, the right wall and the down-left inner edge
//            (the "C");
//     gold — one ribbon (the "S"): along the top-right edge, down the spine, curving into the
//            down-right inner edge, then round the bottom — over the red where they cross.
//
// Every piece is its own element with its own class, so CSS can assemble it piece by piece
// (the title screen), and each call gets its own gradient ids, so two symbols on one page do
// not share (or break) each other's paint.
const R = 50;                                  // circumradius
const A = R * Math.sqrt(3) / 2;                // apothem: 43.30
const T = 12.55;                               // the frame's thickness (89px of 709 in the JPEG)
const r = (A - T) / (Math.sqrt(3) / 2);        // the inner hexagon's circumradius
const ANG = [-90, -30, 30, 90, 150, 210];      // top, upper-right, lower-right, bottom, lower-left, upper-left
const at = (rad, deg) => [rad * Math.cos(deg * Math.PI / 180), rad * Math.sin(deg * Math.PI / 180)];
const O = ANG.map((d) => at(R, d)), I = ANG.map((d) => at(r, d));
const [TOP, UR, LR, BOT, LL, UL] = [0, 1, 2, 3, 4, 5];
const f = (n) => +n.toFixed(2);
const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
// One edge of the frame, mitred at both corners.
const edge = (a, b) => pts([O[a], O[b], I[b], I[a]]);

// The down-left inner edge: a band round the line from the centre to the lower-left corner,
// from under the spine out to (and past) the frame's outer edge — the hexagon clips it.
function diagonal() {
  const d = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];       // towards the lower-left corner
  const n = [Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)];        // its normal
  // the point on the line offset `o` from the centre line where x = X
  const onEdge = (o, X) => { const s = (X - o * n[0]) / d[0]; return [X, s * d[1] + o * n[1]]; };
  return pts([onEdge(-T / 2, 2), onEdge(-T / 2, -A - 2), onEdge(T / 2, -A - 2), onEdge(T / 2, 2)]);
}

// The spine: straight down from the top, then a wide curve (from about a third of the way
// down) that leaves heading for the lower-right edge at ~30° and runs into the gold there. Stroked at the frame's thickness and clipped by the
// hexagon, so its ends are wherever the frame is.
const SPINE = 'M0,-52 L0,-21 C0,-7 8.5,5 17,10 L52,30.6';   // fitted to the JPEG's spine edges

let seq = 0;
/**
 * The symbol as an <svg> string.
 * @param {object} [o]
 * @param {string} [o.cls]    extra classes on the <svg>
 * @param {string} [o.title]  an accessible name; without one the symbol is decoration
 */
export function symbolSVG({ cls = '', title = '' } = {}) {
  const u = 'sz' + (++seq);
  const label = title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"';
  // Red is lit from the outside in, gold from the top-left: the 3D the JPEG paints in.
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sz ${cls}" viewBox="-56 -56 112 112" ${label} focusable="false">
<defs>
  <clipPath id="${u}c"><polygon points="${pts(O)}"/></clipPath>
  <linearGradient id="${u}rl" x1="0" x2="1"><stop offset="0" stop-color="#ff4b3c"/><stop offset=".35" stop-color="#ff0f36"/><stop offset="1" stop-color="#e3002f"/></linearGradient>
  <linearGradient id="${u}rr" x1="1" x2="0"><stop offset="0" stop-color="#ff3a33"/><stop offset=".4" stop-color="#fe0034"/><stop offset="1" stop-color="#d9002c"/></linearGradient>
  <linearGradient id="${u}rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4a38"/><stop offset=".5" stop-color="#fe0034"/><stop offset="1" stop-color="#cc0029"/></linearGradient>
  <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".3" stop-color="#ffdd01"/><stop offset=".8" stop-color="#ffc400"/><stop offset="1" stop-color="#ff9a00"/></linearGradient>
  <linearGradient id="${u}gs" x1="0" x2="1"><stop offset="0" stop-color="#ffe95a"/><stop offset=".45" stop-color="#ffdd01"/><stop offset=".85" stop-color="#ffbf00"/><stop offset="1" stop-color="#ff9200"/></linearGradient>
  <linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17121a"/><stop offset="1" stop-color="#060607"/></linearGradient>
  <!-- the JPEG's "pillow": each colour's edges sink into a darker shade of itself, and what
       lies on top casts a soft shadow onto what is under it -->
  <filter id="${u}pr" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.1" result="b"/>
    <feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="1" k3="-1" result="e"/>
    <feFlood flood-color="#5e000e" flood-opacity=".85"/><feComposite in2="e" operator="in" result="s"/>
    <feDropShadow in="SourceAlpha" dx="0" dy="0" stdDeviation="1.1" flood-color="#000" flood-opacity=".8" result="d"/>
    <feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge>
  </filter>
  <filter id="${u}pg" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.1" result="b"/>
    <feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="1" k3="-1" result="e"/>
    <feFlood flood-color="#c45300" flood-opacity=".85"/><feComposite in2="e" operator="in" result="s"/>
    <feDropShadow in="SourceAlpha" dx="0" dy="0" stdDeviation="1.1" flood-color="#000" flood-opacity=".8" result="d"/>
    <feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge>
  </filter>
</defs>
<polygon class="sz-rim" points="${pts(O)}" fill="none" stroke="#000" stroke-opacity=".85" stroke-width="5" stroke-linejoin="round"/>
<g clip-path="url(#${u}c)">
  <polygon class="sz-core" points="${pts(O)}" fill="url(#${u}k)"/>
  <g class="sz-under" filter="url(#${u}pg)">
    <polygon class="sz-gold sz-gold-ll" points="${edge(BOT, LL)}" fill="url(#${u}g)"/>
  </g>
  <g class="sz-c" filter="url(#${u}pr)">
    <polygon class="sz-red sz-red-l" points="${edge(LL, UL)}" fill="url(#${u}rl)"/>
    <polygon class="sz-red sz-red-tl" points="${edge(UL, TOP)}" fill="url(#${u}rl)"/>
    <polygon class="sz-red sz-red-d" points="${diagonal()}" fill="url(#${u}rd)"/>
    <polygon class="sz-red sz-red-r" points="${edge(UR, LR)}" fill="url(#${u}rr)"/>
  </g>
  <g class="sz-s" filter="url(#${u}pg)">
    <polygon class="sz-gold sz-gold-lr" points="${edge(LR, BOT)}" fill="url(#${u}g)"/>
    <path class="sz-gold sz-spine" d="${SPINE}" fill="none" stroke="url(#${u}gs)" stroke-width="${T}" pathLength="100"/>
    <polygon class="sz-gold sz-gold-tr" points="${edge(TOP, UR)}" fill="url(#${u}g)"/>
  </g>
</g>
</svg>`;
}

// For tools and tests: the hexagon's own numbers.
export const SYMBOL_GEOMETRY = { R, A, T, r, outer: O, inner: I };
