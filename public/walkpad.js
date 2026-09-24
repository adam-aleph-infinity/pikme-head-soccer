// THE WALK PLATE: which arrow a thumb at (x, y) means. Pure — no DOM — so npm test can pin it.
//
// Head Soccer's left thumb does not press two buttons, it rests on one big L/R plate and
// rolls: the half it is nearer to is the direction, and sliding across flips it at once.
// Ours are two buttons the player can move and resize (edit mode), so the plate is built from
// wherever the two rects actually are:
//
//   · ON a button            → that button, always (a resized ▶ owns its whole box).
//   · between / around them  → the NEARER button, measured to its edge, so the gap between
//                              the arrows is not a dead strip a slide has to cross blind.
//   · how far "around" reaches depends on the finger:
//       - a NEW touch (`start`) reaches only half the gap past each button (capped at half a
//         button), so a press between two adjacent arrows lands on one of them, but a tap on
//         the pitch well away from the pad is not a walk;
//       - a finger ALREADY walking (`start` false) reaches a whole button-height past either
//         rect. A thumb arcs as it slides and rolls high or low when it lands; the old
//         hit-test lost it the moment it left the button's box, which read as "stuck".
//         Past that reach it holds nothing (slid onto the pitch) — and picks up again the
//         moment it comes back, because the finger is still being tracked.
//   · `cur` is what that finger holds now: a small hysteresis keeps a thumb resting right on
//     the boundary from flickering between the two.
//
// Rects are {left, top, right, bottom} in the same space as (x, y) — client px in the page.

const distToRect = (x, y, r) => Math.hypot(
  Math.max(r.left - x, 0, x - r.right),
  Math.max(r.top - y, 0, y - r.bottom),
);
const height = (r) => r.bottom - r.top;
const width = (r) => r.right - r.left;

// Edge-to-edge distance between the two rects (0 if they touch or overlap).
const gapBetween = (a, b) => Math.hypot(
  Math.max(b.left - a.right, a.left - b.right, 0),
  Math.max(b.top - a.bottom, a.top - b.bottom, 0),
);

/**
 * @param {number} x
 * @param {number} y
 * @param {{left:number,top:number,right:number,bottom:number}} L  the ◀ button's box
 * @param {{left:number,top:number,right:number,bottom:number}} R  the ▶ button's box
 * @param {{cur?: 'left'|'right'|null, start?: boolean}} [opt]
 * @returns {'left'|'right'|null}
 */
export function walkPick(x, y, L, R, { cur = null, start = false } = {}) {
  if (!L || !R) return null;
  const unit = Math.max(1, Math.min(height(L), height(R), width(L), width(R)));
  const reach = start ? Math.min(unit / 2, gapBetween(L, R) / 2 + 1) : unit;
  const dL = distToRect(x, y, L), dR = distToRect(x, y, R);
  if (dL > reach && dR > reach) return null;
  let pick;
  if (dL === 0 && dR === 0) {
    // Overlapping boxes (a layout dragged one onto the other): nearer centre decides.
    const c = (r) => Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
    pick = c(L) <= c(R) ? 'left' : 'right';
  } else {
    pick = dL <= dR ? 'left' : 'right';
  }
  // Hysteresis: stay with the current arrow until the other one is clearly nearer. Never
  // holds on to an arrow the finger is now off by more than the reach.
  if (cur && cur !== pick) {
    const dCur = cur === 'left' ? dL : dR, dNew = cur === 'left' ? dR : dL;
    const hyst = Math.min(4, unit * 0.06);
    if (dCur - dNew < hyst && dCur <= reach) return cur;
  }
  return pick;
}

/**
 * Two walk directions held at once (two thumbs, → and ← on a keyboard) resolve to the one
 * pressed MOST RECENTLY, the way HS turns the instant the thumb rolls over. Without this the
 * sim sums them to zero and the player freezes on the spot — which is also "stuck".
 * @param {{left:boolean,right:boolean}} on   raw state
 * @param {{left:number,right:number}} stamp  when each was last pressed (bigger = later)
 */
export function resolveWalk(on, stamp) {
  if (on.left && on.right) {
    return stamp.left > stamp.right ? { left: true, right: false } : { left: false, right: true };
  }
  return { left: !!on.left, right: !!on.right };
}
