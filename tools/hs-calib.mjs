// SCREEN PIXELS → OUR WORLD. Pure; used by tools/hs-measure (the page) and by test-hs-fit.mjs.
//
// A Head Soccer recording is a phone screen, not a world. The only thing both games agree on is
// the pitch: a wall on the left, a wall on the right, grass along the bottom. So the mapping is
// anchored on exactly those three clicks and nothing else:
//
//   x_world = (x_px − wallL) · W / (wallR − wallL)          wall-to-wall becomes 0..1060
//   y_world = GROUND_Y + (y_px − ground) · s                 the grass line becomes GROUND_Y
//
// with ONE scale s = W / (wallR − wallL) for both axes. Using the same scale vertically is the
// point: the recording is not stretched, so a jump that is 30% of the pitch width in HS must be
// 30% of ours too, and any vertical number (apex, goal height) comes out in the same world
// pixels as the horizontal ones. y points down, as it does in shared/sim.js.
//
// The other clicks — crossbar, goal mouth, head top/bottom — do not feed the mapping. They are
// cross-checks: once mapped, the goal height and head diameter are numbers we can compare with
// GOAL_H and HEAD_R, and a calibration that puts the crossbar somewhere absurd is a misclick.

// The points the page asks for, in the order it asks. `axis` says which coordinate matters —
// the ground line only needs a y, a wall only needs an x — so a slightly off-axis click is fine.
export const CALIB_POINTS = [
  { key: 'wallL',      axis: 'x', label: 'left wall (inner edge)' },
  { key: 'wallR',      axis: 'x', label: 'right wall (inner edge)' },
  { key: 'ground',     axis: 'y', label: 'ground line (where feet stand)' },
  { key: 'crossbar',   axis: 'y', label: 'crossbar top' },
  { key: 'goalFront',  axis: 'x', label: 'goal mouth front (left goal)' },
  { key: 'headTop',    axis: 'y', label: 'head top (a standing player)' },
  { key: 'headBottom', axis: 'y', label: 'head bottom (same player)' },
  // Not part of the mapping: the tracker only re-finds a lost ball below this line.
  { key: 'hudBottom',  axis: 'y', label: 'HUD bottom (optional: below the POWER bars)' },
];

// clicks: { wallL:{x,y}, wallR:{x,y}, ground:{x,y}, ... } in source-video pixels.
// world:  { W, groundY } — pass C.W and C.GROUND_Y from shared/constants.js.
// Returns null until the three anchoring clicks exist.
export function makeCalib(clicks, world) {
  const { wallL, wallR, ground } = clicks || {};
  if (!wallL || !wallR || !ground) return null;
  const span = wallR.x - wallL.x;
  if (!(Math.abs(span) > 1)) return null;          // two walls in one place is a misclick
  const s = world.W / span;
  const calib = {
    clicks: { ...clicks },
    W: world.W, groundY: world.groundY,
    x0: wallL.x, y0: ground.y, scale: s,
  };
  calib.checks = crossChecks(calib);
  return calib;
}

export function pxToWorld(calib, p) {
  return { x: (p.x - calib.x0) * calib.scale, y: calib.groundY + (p.y - calib.y0) * calib.scale };
}

export function worldToPx(calib, p) {
  return { x: calib.x0 + p.x / calib.scale, y: calib.y0 + (p.y - calib.groundY) / calib.scale };
}

// A length (a radius, a distance) has no origin, only the scale.
export const pxLen = (calib, len) => len * calib.scale;

// The cross-check numbers, in world pixels. Missing clicks give null, not NaN.
export function crossChecks(calib) {
  const c = calib.clicks, s = calib.scale;
  return {
    goalHeight: c.crossbar ? (calib.y0 - c.crossbar.y) * s : null,
    goalMouthX: c.goalFront ? (c.goalFront.x - calib.x0) * s : null,
    headDiameter: c.headTop && c.headBottom ? Math.abs(c.headBottom.y - c.headTop.y) * s : null,
  };
}
