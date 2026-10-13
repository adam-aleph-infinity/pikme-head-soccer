// THE CHAMPIONS' OWN POWERS — one per arcade champion, in card-number order.
//
// ORIGINAL POWERS (Idan, 2026-10-11): each champion's power is our own, fitted to its head and its
// card (docs/CHAMPION-POWERS.md — the 45 concepts, the balance budget, what is built). Head Soccer is
// the benchmark for how a power looks and lands, never the thing copied. They are being rebuilt in
// batches of five; a stage whose original power is not built yet still fires the Head Soccer copy
// it had (docs/HS-45-POWERS.md — stage 6), in the arcade only, or its family from the approved map.
//
// One file per stage, shared/champion-powers/stage-NN.js: the definition (what the board says, the
// family it flies on, its numbers) and any behaviour of its own as hooks the engine
// (shared/hs-powers.js) calls — launch, step, contact, skip. What a power leaves on the pitch (a
// strip, a splat, a fence) is a zone: shared/power-zones.js.
//
// WHERE: an original power (`everywhere: true`) fires everywhere — arcade, online, free play — at
// one strength, the same for every player who owns the card (Idan: no per-stage scaling for now).
//
// ROLLBACK RULES, as in hs-powers.js: this is sim code — no Math.random / sin / cos; every
// piece of state lives as a plain scalar on `ball.power`, the player or a zone.

import S01 from './champion-powers/stage-01.js';
import S02 from './champion-powers/stage-02.js';
import S03 from './champion-powers/stage-03.js';
import S04 from './champion-powers/stage-04.js';
import S05 from './champion-powers/stage-05.js';
import S06 from './champion-powers/stage-06.js';
// the four Mythic starters' own power (not a stage: shared/mythics.js)
import MYTHIC_GEM from './champion-powers/mythic.js';

// The registry: one line per built stage.
export const CHAMPION_POWERS = Object.freeze({
  1: S01,
  2: S02,
  3: S03,
  4: S04,
  5: S05,
  6: S06,
});

export const BUILT_STAGES = Object.freeze(Object.keys(CHAMPION_POWERS).map(Number));
export const championPower = (stage) => CHAMPION_POWERS[stage] || null;
const BY_ID = new Map([...Object.values(CHAMPION_POWERS), MYTHIC_GEM].map((d) => [d.id, d]));
export const powerById = (id) => BY_ID.get(id) || null;

// How hard a power is to stop — the ladder must never step down (test-arcade). Each term is one
// thing the defender has to beat, weighted by how much it costs him:
//   speed      less time to react (× the comet)
//   disable    seconds without full control after a hit (× 0.5)
//   jumpers    it reaches you in the air, so jumping over it is no answer (+0.5)
//   decoys     fakes to read, each × how many seconds of the flight it lasts × 0.4
//   invisible  seconds it cannot be seen (× 1.5); through: it passes a defender (+0.75)
//   above      it comes down from above the head, the hardest line to head (+0.6)
//   blockKO    seconds a successful block still costs the blocker (× 0.5)
//   knock      how much further its hit throws him than a plain shot's (× 1 over the first)
//   zone       something it leaves on the pitch that costs the defender (+0.5 each)
export function difficultyScore(def) {
  const d = (def && def.diff) || {};
  return (d.speed || 1) + 0.5 * (d.disable || 0) + 0.5 * (d.jumpers || 0) + 0.4 * (d.decoys || 0) * (d.decoyLife || 0) +
    1.5 * (d.invisible || 0) + 0.75 * (d.through || 0) + 0.6 * (d.above || 0) + 0.5 * (d.blockKO || 0) +
    Math.max(0, (d.knock || 1) - 1) + 0.5 * (d.zone || 0);
}

// ── the hooks (hs-powers.js calls these for a ball whose power has a `cp`) ──────────────
// launch(m, b, p, pw, S, kit)                 after the family has set the ball up
// step(m, b, dt, pw, S, kit, api)             undefined → the family's own step; else its result
// contact(m, p, b, kit, pw, kicking, api)     undefined → the family's own rules; else the outcome
// skip(pw)                                    true → this power makes no contact right now
// holds(pw)                                   true → its shooter is held where he is (no input, no tackle)
export function cpLaunch(m, b, p, pw, S, kit) {
  const D = BY_ID.get(pw.cp);
  if (D && D.launch) D.launch(m, b, p, pw, S, kit);
}
export function cpStep(m, b, dt, pw, S, kit, api) {
  const D = BY_ID.get(pw.cp);
  return D && D.step ? D.step(m, b, dt, pw, S, kit, api) : undefined;
}
export function cpContact(m, p, b, kit, pw, kicking, api) {
  if (pw.rb || pw.hit) return undefined;           // a block's rebound is the blocker's plain shot
  const D = BY_ID.get(pw.cp);
  return D && D.contact ? D.contact(m, p, b, kit, pw, kicking, api) : undefined;
}
export function cpHolds(pw) {
  const D = BY_ID.get(pw.cp);
  return !!(D && D.holds && D.holds(pw));
}
export function cpSkip(pw) {
  const D = BY_ID.get(pw.cp);
  return !!(D && D.skip && D.skip(pw));
}
