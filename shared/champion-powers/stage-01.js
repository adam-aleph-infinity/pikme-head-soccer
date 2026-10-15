// STAGE 1 — התותחן, THE CANNONEER (a pirate-parrot captain; the card: Shoval at the ship's hut he
// built in his backyard, nautical flags, gold coins and bubbles). An ORIGINAL power, not a Head
// Soccer character's (docs/CHAMPION-POWERS.md; redesigned with Idan 2026-10-12).
//
// BROADSIDE: pressing POWER turns the parrot into a cannon (drawn: public/vfx/powers/stage-01.js —
// the sim does not change the arm). His touch loads the ball down the barrel, and when the cut-in
// lets go the cannon fires THREE times, GAP s apart:
//   • shots 1 and 2 are iron SHELLS (power-zones.js 'shell'): flat at the ball's height and pace,
//     they never score; a kick on the swing up parries one, anything else it meets is hit — the
//     power hit (thrown, a mark on the face), dazed as long as any power hit (Idan, 2026-10-14:
//     every stun the same), the arm kept;
//   • shot 3 is THE BALL, out of the same muzzle in the same flash, and from there a straight
//     power shot: counter it armed, kick-block it (the grind, then it fires back), or take it on
//     the head or the body — the power hit, and the cannonball, too heavy to bounce back, thuds
//     down and rolls on toward the goal (THUD_VX: its pace sets the power's strength, measured
//     with _power-balance.mjs at GAP 1.5 s: 100 px/s scores 27% against the CPU, 124 55%).
// While loaded the cannon is PLANTED (`holds`: sim.js takes his input and nobody can tackle him)
// and the ball is sealed in the barrel (`skip`) — the barrage cannot be interrupted (Idan).
// A KICK-BLOCK FIRES IT ALL BACK (Idan, 2026-10-13: "copy it exactly"): the blocker fires the same
// barrage — two shells, then the ball — held where he stands as the Cannoneer is, from in front of
// his own head; only the Cannoneer turns into a cannon (the renderer). `brg` marks a barrage ball.
import * as C from '../constants.js';
import { addZone } from '../power-zones.js';

export const BROADSIDE = Object.freeze({
  SPEED: 1.0,       // × the comet — shells and ball alike, so the third looks like the first two
  // s between the shots: the release, +GAP, +2·GAP. (Idan 2026-10-12 made it 1 s with a 0.4 s shell
  // daze; 2026-10-14 every stun the same — and at 1 s a defender a shell put down for the full 0.9 s
  // was never up for the next shot: 99% goals. So 1.5 s again, his ~0.6 s to answer it.)
  GAP: 1.5,
  SHELLS: 2,        // shells before the ball
  // the muzzle, in head radii from the head's centre (forward, up): the barrel runs level out of the
  // beak (public/vfx/powers/stage-01.js draws it there), and every shot leaves from its mouth
  MUZZLE_X: 2.3, MUZZLE_Y: 0.35,
  THUD_VX: 124,     // the ball, met by a head or a body: a cannonball too heavy to bounce back — it
  THUD_VY: 200,     //   thuds down where it met him and rolls on after him (px/s on, px/s up)
});

// The cannon fires: shell n (1, 2) or the ball (3) — the flash, the recoil and the boom (renderer, audio).
function fire(m, b, pw, n) {
  m.events.push({ type: 'cannonFire', player: pw.owner, n, real: n > BROADSIDE.SHELLS, x: b.x, y: b.y, dir: pw.dir });
}

export default Object.freeze({
  stage: 1, id: 'broadside', everywhere: true,
  family: 'straight', speed: BROADSIDE.SPEED, ailment: null, ailSec: 0,
  name: 'Broadside', icon: '🦜', color: '#ffb347',
  desc: 'התוכי הופך לתותח: שני פגזים מעיפים, השלישי הוא הכדור! בעטו בפגזים כדי להדוף אותם.',
  // two shells' worth of hits to dodge before the shot itself (the harness measures the truth)
  diff: { speed: BROADSIDE.SPEED, disable: 0.9, decoys: BROADSIDE.SHELLS, decoyLife: 0.5 },
  ballAt: BROADSIDE.GAP * BROADSIDE.SHELLS,               // s after the release the ball itself leaves

  launch(m, b, p, pw) {
    // (a block's fire-back too — `src` someone else's: the same barrage, at once, no cut-in)
    pw.ph = 'load'; pw.k = 0; pw.n = 0; pw.px = p.x; pw.py = p.y; pw.brg = 1;
    b.vx = 0; b.vy = 0;
  },
  step(m, b, dt, pw, S, kit) {
    if (pw.ph !== 'load') return undefined;               // the ball's own flight: the straight family's
    const q = m.players[pw.owner];
    // planted where he fired from (nothing moves him: no input, no tackle — sim.js powerHolds) —
    // in the air too: touched up there, he hangs there firing until the ball is away (Idan), as the
    // cut-in holds every shooter. (Only on the match itself: the bot's look-ahead flies a copy of
    // the ball on a fake one with no zones.)
    if (m.zones) { q.x = pw.px; q.vx = 0; q.y = pw.py; q.vy = 0; if (q.y < C.GROUND_Y - 0.5) q.onGround = false; }
    b.x = Math.min(C.W - b.r, Math.max(b.r, q.x + pw.dir * BROADSIDE.MUZZLE_X * C.HEAD_R));
    b.y = kit.headY(q) - BROADSIDE.MUZZLE_Y * C.HEAD_R;
    b.vx = 0; b.vy = 0;
    const due = pw.n * BROADSIDE.GAP;                     // the next shot, s after the release
    if (pw.k >= due - 1e-9) {
      pw.n++;
      if (pw.n <= BROADSIDE.SHELLS) {
        addZone(m, { k: 'shell', cp: pw.cp, own: pw.owner, x0: b.x, x1: b.x, y: b.y, dir: pw.dir, life: 2, spd: C.POWER_SHOT_SPEED * BROADSIDE.SPEED });
        fire(m, b, pw, pw.n);
      } else {
        // THE BALL: out of the muzzle as a straight power shot, its 2 s of flight from here
        pw.ph = 'fly'; pw.t = 0; pw.k = 0; pw.x0 = b.x; pw.y0 = b.y;
        b.vx = pw.dir * S;
        fire(m, b, pw, pw.n);
        return undefined;
      }
    }
    pw.k += dt;
    return true;
  },
  // THE BALL met by a head or a body (not the boot — that is the block, the family's): the power
  // hit, and the cannonball does not bounce back off him but thuds down and rolls on toward his goal.
  // The early header (a jump right off the muzzle) is the family's, as is the counter (sim.js).
  contact(m, p, b, kit, pw, kicking, api) {
    if (kicking || !pw.brg) return undefined;
    if (!p.onGround && Math.abs(b.x - pw.x0) < 170) return undefined;
    const r = api.hit(m, p, b, pw, 'cannon');
    b.power = null;
    b.vx = pw.dir * BROADSIDE.THUD_VX; b.vy = -BROADSIDE.THUD_VY;
    b.x = kit.keepOutOfGoal(b.x, b.y, p.x - pw.dir * (C.BODY_W / 2 + b.r + 2), Math.min(b.y, C.GROUND_Y - b.r), b.r);
    return r;
  },
  skip: (pw) => pw.ph === 'load',
  holds: (pw) => pw.ph === 'load',
});
