// THE GOAL IS A ROOM, AND THIS IS ITS FLOOR PLAN.
//
// The net used to be described in two places that had never been introduced to each other.
// The renderer knew a goal was a BOX drawn in oblique projection (public/game.js, drawGoal);
// the sim knew it was a vertical LINE at x = GOAL_W with a wall somewhere behind it. Neither
// of them had any notion of an INTERIOR, and that one missing idea is the whole bug:
//
//   · the renderer drew the entire box — far net, back, roof AND the near net you look
//     through — in one pass BEFORE the bodies, so the ball and the players were painted over
//     the front of it. A goal you can never be behind is a sticker on the backdrop, which is
//     exactly what it looked like.
//   · the sim clamped both players at x = GOAL_W + BODY_W/2, so the mouth of the goal was an
//     invisible wall. Nobody could walk into the room because there was no room.
//
// So the box is written down once, here, in the units the sim already uses, and both sides
// read it:
//
//   depth   x, from the goal LINE to the back of the net. The camera is side on, so the net's
//           front-to-back IS the sim's x axis — nothing has to be invented for it.
//   height  y, from GROUND_Y up to the crossbar.
//   width   post to post: the axis that runs INTO the screen. The sim has no third axis and
//           is not getting one — this axis is not simulated, it is a DEPTH the renderer
//           projects, 0 at the near side net and 1 at the far one.
//
// z IS WHAT THE BUG WAS ABOUT. The match is played on the near side plane (z = 0): that is
// where the pitch, the players and the ball all live, which is why everything on the pitch
// draws in front of every part of the goal — correct while you are on the pitch, nonsense the
// moment you are inside the net. A body inside the net belongs BETWEEN the two side nets, and
// that is one number: INSIDE_Z. The draw order falls straight out of it (far net before the
// bodies, near net after them), and so does the small step across the screen that puts a ball
// visibly inside the box instead of pasted onto its front face.
import * as C from './constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// THE WIDTH AXIS, PROJECTED. One step from the near side of the net to the far side moves a
// point inward across the screen and up it — inward because the vanishing point for a goal at
// the edge of a side-on pitch is towards the middle of the picture, up because you are
// looking slightly down on the box. These two fractions were the renderer's private numbers;
// they live here now because the projection they define is what decides where a ball inside
// the net gets drawn, and the renderer is no longer the only thing that needs to know.
export const WIDTH_X = 0.40;          // of GOAL_W, towards the middle of the pitch
export const WIDTH_Y = 0.13;          // of GOAL_H, up the screen

// The two side nets, and the plane between them where anything inside the goal belongs.
export const NEAR_Z = 0;
export const FAR_Z = 1;
export const INSIDE_Z = (NEAR_Z + FAR_Z) / 2;

// How deep into the net a body has to be before it is fully at INSIDE_Z, as a fraction of the
// goal's depth. It is a RAMP rather than a switch because a switch is a teleport: the
// projection below moves a point sideways by WIDTH_X · GOAL_W ≈ 37px, and applying half of
// that in one frame the instant the ball touched the line would throw the ball BACKWARDS out
// of the goal it had just entered. Over a ramp this long the projected motion is still
// monotonic — 1 − (wx · INSIDE_Z) / (GOAL_W · ENTRY_RAMP) = 0.6 > 0 — so a ball going in only
// ever looks like it is going in, just a little slower while it settles into the box.
export const ENTRY_RAMP = 0.5;

// The crossbar's height. Everything asks for it and everything used to spell it out.
export const barY = () => C.GROUND_Y - C.GOAL_H;

// One goal's corners, in world units. Recomputed per call and never cached: every constant in
// here is live-tuned from the tuner panel mid-match, and a cached box is a goal that stops
// following its own GOAL_H.
export function goalBox(left) {
  const inward = left ? 1 : -1;                      // towards the middle of the pitch
  return {
    left,
    inward,
    lineX: left ? C.GOAL_W : C.W - C.GOAL_W,         // the goal line — the near post stands on it
    wallX: left ? C.POST_R : C.W - C.POST_R,         // the back of the net, hard against the wall
    top: barY(),
    ground: C.GROUND_Y,
    wx: inward * C.GOAL_W * WIDTH_X,                 // one step along the width axis, across
    wy: -C.GOAL_H * WIDTH_Y,                         // …and up
  };
}

// Which net a point is inside, or null for the 99% of the pitch that is not in one. Above the
// bar the answer is always null: a ball sailing over the goal is over it, not in it, and it
// has to keep drawing in front of the frame it is clearing.
export function goalAt(x, y) {
  if (y !== undefined && y < barY()) return null;
  if (x < C.GOAL_W) return goalBox(true);
  if (x > C.W - C.GOAL_W) return goalBox(false);
  return null;
}

// 0 at the goal line, 1 once a body is properly inside the net. See ENTRY_RAMP.
export function depthT(x, box) {
  return clamp((box.lineX - x) * box.inward / (C.GOAL_W * ENTRY_RAMP), 0, 1);
}

// The one number the draw order is sorted on: NEAR_Z out on the pitch, up to INSIDE_Z in the
// net. Anything with z > NEAR_Z is behind the near net and in front of the far one.
export function depthZ(x, y) {
  const box = goalAt(x, y);
  return box ? INSIDE_Z * depthT(x, box) : NEAR_Z;
}

// Where a world point at depth z is DRAWN.
//
// The sideways part is the whole step. The vertical part is scaled by how high off the grass
// the point is, because this pitch draws its near and far touchlines on the SAME ground line —
// the box's feet do not recede, only its top does, which is exactly how the frame itself is
// drawn (a post runs from the grass to top + wy, so a point a fraction f up it has moved
// f · wy). Without that scaling a ball resting in the back of the net would be lifted 12px off
// the floor and hang there, with its own shadow underneath it.
export function project(x, y, z, box) {
  const h = clamp((box.ground - y) / C.GOAL_H, 0, 1);
  return { x: x + box.wx * z, y: y + box.wy * z * h, z };
}

// The renderer's one-liner: world point in, screen point and its depth out. Identity
// everywhere except inside a net, so it is safe to put on every body in the game.
export function depthPoint(x, y) {
  const box = goalAt(x, y);
  if (!box) return { x, y, z: NEAR_Z };
  return project(x, y, INSIDE_Z * depthT(x, box), box);
}

// THE SIM'S HALF OF THE SAME BOX: how far a body of width w may walk.
//
// `underBar` is the whole rule. Under the bar the mouth is a doorway and the back of the net
// is the wall — you can stand in your own goal, which is what a goalkeeper is for. Level with
// the frame or above it the goal is solid: you cannot arrive through the roof, and the goal
// line is the wall again.
export function walkBounds(w, underBar) {
  const edge = underBar ? C.POST_R : C.GOAL_W;
  return { lo: edge + w / 2, hi: C.W - edge - w / 2 };
}

// THE CROSSBAR, AS THE THING THAT STOPS A HEAD.
//
// The sim has always had a bar here: `bounceOffCrossbar` in shared/sim.js bounces the BALL off
// a capsule of radius POST_R laid along y = barY across the goal's whole depth, which is what
// stops a ball dropping in through the roof of the net. Players never met it, and once the
// mouth became a doorway that gap was visible from two sides of one boundary — measured, at
// the moment this was written:
//
//   x ≤ 107   a jump stopped with the crown at y=243, the bar's CENTRE line, so the top of
//             the head was buried in a bar drawn 238..248 — "stuck inside the crossbar"
//   x ≥ 108   no bar at all: the crown reached y=196, clean through it — "passes right
//             through it". x=108..125 is directly under the drawn bar, which spans 92..128
//
// Both are this function's fault for not existing. It returns the lowest a circle of radius r
// may put its CENTRE — the underside of the same capsule, offset by the circle — which is
// −Infinity out on the pitch where there is no bar overhead.
//
// It is a ROUNDED ceiling, not a box, and that matters at the mouth: a head beside the bar's
// end may rise past the bar's height, because the bar has ended. The curve is exactly the
// capsule's, so the height a jump reaches grows smoothly from "just under the bar" directly
// beneath it to "unlimited" a head's radius past the post. No step, nothing to pop through.
export function barCeiling(x, r) {
  const R = r + C.POST_R;                     // centre to centre at the moment of contact
  // How far x is from the nearest bar, along the ground. Each bar runs the depth of its own
  // net, from the back of it out to the goal line, and nothing is ever near both.
  const dx = Math.min(Math.max(0, x - C.GOAL_W), Math.max(0, (C.W - C.GOAL_W) - x));
  if (dx >= R) return -Infinity;              // clear of both bars: the sky is open
  return barY() + Math.sqrt(R * R - dx * dx);
}
