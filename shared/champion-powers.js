// THE CHAMPIONS' OWN POWERS — each arcade champion fires one real Head Soccer character's power
// shot, copied: the same flight, the same look (our own canvas art — public/vfx/powers/), the same
// effect on the defender. Stage 1 is the easiest shot in HS and they climb from there
// (docs/hs-45-powers.json is the spec, docs/HS-45-POWERS-PROGRESS.md what is built).
//
// One file per stage, shared/champion-powers/stage-NN.js: the definition (what the arcade board
// says, the family it flies on, its numbers) and any behaviour of its own as hooks the engine
// (shared/hs-powers.js) calls — launch, step, contact, skip. A champion with no file here keeps its
// family from the approved map (shared/hs-champion-map.js) until its turn comes.
//
// Only in the ARCADE (shotFor(char, { arcade: true })): online and free play a legendary card
// still plays its map family at the middle intensity, so a card is never an advantage there.
//
// ROLLBACK RULES, as in hs-powers.js: this is sim code — no Math.random / sin / cos / tan; every
// piece of state lives as a plain scalar on `ball.power` or the player.

import S01 from './champion-powers/stage-01.js';
import S02 from './champion-powers/stage-02.js';
import S03 from './champion-powers/stage-03.js';
import S04 from './champion-powers/stage-04.js';
import S05 from './champion-powers/stage-05.js';

// The registry: one line per built stage.
export const CHAMPION_POWERS = Object.freeze({
  1: S01,
  2: S02,
  3: S03,
  4: S04,
  5: S05,
});

export const BUILT_STAGES = Object.freeze(Object.keys(CHAMPION_POWERS).map(Number));
export const championPower = (stage) => CHAMPION_POWERS[stage] || null;
const BY_ID = new Map(Object.values(CHAMPION_POWERS).map((d) => [d.id, d]));
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
export function difficultyScore(def) {
  const d = (def && def.diff) || {};
  return (d.speed || 1) + 0.5 * (d.disable || 0) + 0.5 * (d.jumpers || 0) + 0.4 * (d.decoys || 0) * (d.decoyLife || 0) +
    1.5 * (d.invisible || 0) + 0.75 * (d.through || 0) + 0.6 * (d.above || 0) + 0.5 * (d.blockKO || 0);
}

// ── the hooks (hs-powers.js calls these for a ball whose power has a `cp`) ──────────────
// launch(m, b, p, pw, S, kit)                 after the family has set the ball up
// step(m, b, dt, pw, S, kit, api)             undefined → the family's own step; else its result
// contact(m, p, b, kit, pw, kicking, api)     undefined → the family's own rules; else the outcome
// skip(pw)                                    true → this power makes no contact right now
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
export function cpSkip(pw) {
  const D = BY_ID.get(pw.cp);
  return !!(D && D.skip && D.skip(pw));
}
