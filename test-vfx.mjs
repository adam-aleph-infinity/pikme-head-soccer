// Power-shot VFX tests — every family and every ailment has a renderer, and the renderers are
// Head Soccer's (docs/HS-POWER-SHOTS.md), cheap, and harmless. Run: node test-vfx.mjs
//
// Checked the way the game uses them: each family is FIRED in the real sim and the VFX runtime
// watches the match as the client does — every event handed to onEvent, update() every tick, and
// every draw call run against a recording canvas. So a renderer that is never reached, throws,
// draws NaN, writes to the match or blows the phone's budget fails here rather than mid-match.

import fs from 'node:fs';
import * as C from './shared/constants.js';
import { createMatch, step, headY, serialize } from './shared/sim.js';
import { shotById, FAMILY_ORDER, AILMENT_ORDER, applyAilment } from './shared/hs-powers.js';
import { createVfx, FAMILY_VFX, AILMENT_VFX, FAMILIES_DRAWN, AILMENTS_DRAWN } from './public/champ-vfx.js';
import { cometAlpha, COMET } from './public/vfx/families.js';
import { render as renderDoc, DOC_PATH } from './scripts/champions-doc.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const NONE = [{}, {}];

// ── a canvas that records ──────────────────────────────────────────────────
// Every call is counted by name; any non-finite number handed to it is counted too (NaN on a
// canvas draws nothing and says nothing); shadowBlur, the phone's most expensive state, is logged.
function recorder() {
  const log = { ops: 0, bad: 0, calls: new Map(), blur: 0 };
  const grad = { addColorStop(o) { if (!Number.isFinite(o)) log.bad++; } };
  const t = {
    canvas: { width: C.W, height: C.H },
    measureText: (s) => ({ width: String(s).length * 12 }),
    createRadialGradient: (...a) => { log.ops++; if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    createLinearGradient: (...a) => { log.ops++; if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    getLineDash: () => [],
  };
  const g = new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      return (...a) => {
        log.ops++;
        log.calls.set(k, (log.calls.get(k) || 0) + 1);
        for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) log.bad++;
      };
    },
    set(o, k, v) {
      o[k] = v;
      if (k === 'shadowBlur' && v > 0) log.blur++;
      if (typeof v === 'number' && !Number.isFinite(v)) log.bad++;
      return true;
    },
  });
  return { g, log };
}

// ── 1. the registry: every family and every ailment has a renderer ─────────
ok('all 11 families have a renderer', FAMILIES_DRAWN.length === 11 && FAMILY_ORDER.every((f) => typeof FAMILY_VFX[f]?.draw === 'function'), FAMILIES_DRAWN.join(','));
ok('no renderer for a family that does not exist', Object.keys(FAMILY_VFX).every((f) => FAMILY_ORDER.includes(f)));
ok('all 6 ailments have an overlay', AILMENTS_DRAWN.length === 6 && AILMENT_ORDER.every((a) => typeof AILMENT_VFX[a]?.draw === 'function'), AILMENTS_DRAWN.join(','));
ok('every family has a 3-colour palette', FAMILY_ORDER.every((f) => Array.isArray(FAMILY_VFX[f].palette) && FAMILY_VFX[f].palette.length === 3));
ok('the Aerial draws its warning streaks', typeof FAMILY_VFX.aerial.warn === 'function');

// ── 2. only what Head Soccer shows ──────────────────────────────────────────
// Idan: "exactly like Head Soccer" — no shakes, flashes, grades, banners or confetti. The runtime
// does not even have the verbs any more.
{
  const v = createVfx();
  for (const verb of ['shakeOffset', 'drawGrade', 'drawStatus', 'drawStageDim', 'drawEffects', 'drawParts']) ok(`the runtime has no ${verb}`, !(verb in v));
  // The filmed comet: full while the screen is still dark, faint by the time it lifts (§3).
  ok('the comet is full size for its first 0.2s', cometAlpha(0) === 1 && cometAlpha(COMET.FULL - 0.01) === 1);
  ok('…and faint 0.1s after that', cometAlpha(COMET.FULL + COMET.FADE) <= COMET.FLOOR + 1e-9);
  ok('the comet is the filmed size: ~95px tall at the ball, ~360px long', COMET.BODY_W0 * 2 > 85 && COMET.BODY_W0 * 2 < 105 && COMET.BODY_L > 300 && COMET.BODY_L < 400);
}

// ── 3. every family, fired in the sim, watched and drawn ────────────────────
function fired(fam, o = {}, seat = 0) {
  const m = createMatch({ rarity: 'legendary', number: 8 }, { rarity: 'legendary', number: 9 }, {});
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.gaugeLead = 0;
  const p = m.players[seat], q = m.players[1 - seat];
  p.shot = shotById(fam, o);
  p.x = seat === 0 ? 300 : C.W - 300; q.x = seat === 0 ? 760 : C.W - 760;
  const vfx = createVfx({ now: () => m.t, drawBall: () => {} });
  vfx.bind(m);
  const main = recorder(), over = recorder();
  const res = { m, vfx, main, over, maxOps: 0, cutOps: 0, frames: 0, events: [] };
  const frame = () => {
    vfx.update(C.TICK);
    const o0 = main.log.ops + over.log.ops;
    for (const b of [m.ball, ...m.xballs]) vfx.drawBall(main.g, b);
    vfx.drawOver(main.g);
    for (const pl of m.players) vfx.drawArmed(over.g, pl);
    vfx.drawOverlay(over.g);
    const c0 = over.log.ops;
    vfx.drawCutin(over.g);
    res.cutOps += over.log.ops - c0;
    res.maxOps = Math.max(res.maxOps, main.log.ops + over.log.ops - o0);
    res.frames++;
  };
  p.gauge = 1; p.prev = {};
  const inp = [{}, {}]; inp[seat] = { power: true };
  step(m, inp);
  frame();
  m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
  for (let i = 0; i < 60 * 3.2 && m.phase === 'play'; i++) {
    step(m, NONE);
    for (const e of m.events) { vfx.onEvent(e); res.events.push(e); }
    m.events.length = 0;
    frame();
  }
  return res;
}
for (const fam of FAMILY_ORDER) {
  for (const seat of [0, 1]) {
    let r, err = null;
    try { r = fired(fam, {}, seat); } catch (e) { err = e; }
    const tag = `${fam} (seat ${seat})`;
    ok(`${tag}: draws without throwing`, !err, err && err.stack.split('\n').slice(0, 2).join(' '));
    if (!r) continue;
    ok(`${tag}: fired`, r.events.some((e) => e.type === 'powershot' && e.fam === fam));
    ok(`${tag}: its renderer drew the shot`, r.vfx.stats.balls > 5, `${r.vfx.stats.balls} frames`);
    ok(`${tag}: the cut-in was drawn`, r.cutOps > 20);
    ok(`${tag}: no NaN reached the canvas`, r.main.log.bad === 0 && r.over.log.bad === 0, `${r.main.log.bad + r.over.log.bad}`);
    ok(`${tag}: no shadowBlur (the phone's most expensive state)`, r.main.log.blur === 0 && r.over.log.blur === 0);
    ok(`${tag}: a modest frame (< 700 canvas calls)`, r.maxOps < 700, `${r.maxOps}`);
  }
}
{
  // The block's grind and the hit's droplets — and the droplets are the only particles there are.
  const r = fired('straight');
  ok('a hit throws at most 7 droplets (§4 red spark droplets)', r.vfx.drops.length <= 7 && r.vfx.stats.drops > 0, `${r.vfx.stats.drops}`);
  ok('the arming rim was drawn on the press', r.over.log.calls.get('arc') > 0);
}

// ── 4. every ailment overlay draws ──────────────────────────────────────────
for (const ail of AILMENT_ORDER) {
  const m = createMatch({ rarity: 'legendary', number: 8 }, { rarity: 'legendary', number: 9 }, {});
  m.phase = 'play'; m.freeze = 0;
  applyAilment(m, m.players[1], ail, 2);
  const vfx = createVfx({ now: () => 1.23 });
  vfx.bind(m);
  const { g, log } = recorder();
  let err = null;
  try { vfx.update(C.TICK); vfx.drawOverlay(g); } catch (e) { err = e; }
  ok(`${ail}: its overlay draws`, !err && log.ops > 3, err ? err.message : `${log.ops} calls`);
  ok(`${ail}: no NaN`, log.bad === 0);
}

// ── 5. the renderer never writes to the match ───────────────────────────────
{
  const m = createMatch({ rarity: 'legendary', number: 8 }, { rarity: 'legendary', number: 9 }, {});
  m.phase = 'play'; m.freeze = 0; m.gaugeLead = 0;
  m.players[0].shot = shotById('multiball');
  m.players[0].gauge = 1; step(m, [{ power: true }, {}]);
  m.ball.x = m.players[0].x; m.ball.y = headY(m.players[0]); step(m, NONE);
  applyAilment(m, m.players[1], 'freeze', 2);
  const vfx = createVfx({ now: () => m.t, drawBall: () => {} });
  vfx.bind(m);
  const before = JSON.stringify(serialize(m));
  const { g } = recorder();
  for (let i = 0; i < 30; i++) {
    for (const e of m.events) vfx.onEvent(e);
    vfx.update(C.TICK); vfx.drawBall(g, m.ball); vfx.drawOver(g); vfx.drawOverlay(g); vfx.drawCutin(g);
    for (const p of m.players) vfx.drawArmed(g, p);
  }
  ok('watching and drawing leaves the match exactly as it was', JSON.stringify(serialize(m)) === before);
}

// ── 6. the design book is current ───────────────────────────────────────────
{
  const cur = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
  ok('docs/CHAMPIONS.md is current (node scripts/champions-doc.mjs)', cur === renderDoc());
}

console.log(`test-vfx: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
