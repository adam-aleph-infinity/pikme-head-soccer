// Champion VFX tests — every one of the 45 powers has a complete, working, distinct look.
// Run: node test-vfx.mjs          (all 45)
//      node test-vfx.mjs 3        (tier 3 only — stages 19-27)
//
// The look is checked the way the game uses it: each power is FIRED in the real sim, in both
// seats, and the VFX runtime watches the match exactly as the client does — every event handed
// to onEvent, update() every tick, and every draw hook run against a recording canvas. So a hook
// that is never reached, throws, draws NaN, or touches the match fails here rather than on a
// phone mid-match.

import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { POWERS, POWER_ORDER } from './shared/powers.js';
import fs from 'node:fs';
import { VFX, PHASES, DOC_FIELDS, SOUND_KINDS, SOUND_SLOTS, createVfx } from './public/champ-vfx.js';
import { render as renderDoc, DOC_PATH } from './scripts/champions-doc.mjs';

globalThis.VFX_STRICT = true;              // a hook that throws is a failure, not a skipped frame

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const TIER = Number(process.argv[2]) || 0;
const IDS = TIER ? POWER_ORDER.slice((TIER - 1) * 9, TIER * 9) : POWER_ORDER;
const IDLE = { left: false, right: false, jump: false, kick: false, power: false };
const HEX = /^#[0-9a-f]{6}$/i;
const str = (v, n) => typeof v === 'string' && v.trim().length >= n;

// ── a canvas that records ──────────────────────────────────────────────────
// Every method call is logged by name, every colour set is logged by value, and any
// non-finite number handed to it is counted: NaN on a canvas draws nothing and says nothing.
function recorder() {
  const log = { ops: 0, bad: 0, colors: new Set(), calls: new Map() };
  const grad = { addColorStop(o, c) { if (!Number.isFinite(o)) log.bad++; log.colors.add(String(c).toLowerCase()); } };
  const t = {
    canvas: { width: C.W, height: C.H },
    measureText: (s) => ({ width: String(s).length * 12 }),
    createRadialGradient: (...a) => { if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    createLinearGradient: (...a) => { if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    createConicGradient: () => grad,
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
      if ((k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor') && typeof v === 'string') log.colors.add(v.toLowerCase());
      if (typeof v === 'number' && !Number.isFinite(v)) log.bad++;
      return true;
    },
  });
  return { g, log };
}

// ── 1. the registry ─────────────────────────────────────────────────────────
if (!TIER) {
  ok('exactly 45 VFX entries', Object.keys(VFX).length === 45, `got ${Object.keys(VFX).length}`);
  ok('VFX keys are the 45 powers, no strays', Object.keys(VFX).every((k) => POWERS[k]) && POWER_ORDER.every((k) => VFX[k]));
}
for (const id of IDS) {
  const V = VFX[id];
  ok(`${id}: has a VFX entry`, !!V);
  if (!V) continue;
  ok(`${id}: theme`, str(V.theme, 4));
  ok(`${id}: visual language`, str(V.visual, 12));
  ok(`${id}: palette of 3+ hex colours`, Array.isArray(V.palette) && V.palette.length >= 3 && V.palette.every((c) => HEX.test(c)));
  for (const h of ['aura', 'fire', 'impact', 'end']) ok(`${id}: ${h}() hook`, typeof V[h] === 'function');
  if (POWERS[id].kind === 'shot') for (const h of ['ball', 'trail']) ok(`${id}: shot needs ${h}()`, typeof V[h] === 'function');
  const d = V.doc || {};
  for (const f of DOC_FIELDS) ok(`${id}: doc.${f}`, str(d[f], 20), JSON.stringify(d[f]));
  for (const ph of PHASES) ok(`${id}: doc.sequence.${ph}`, str(d.sequence?.[ph], 15));
  for (const slot of SOUND_SLOTS) {
    const list = V.sounds?.[slot];
    ok(`${id}: sounds.${slot} is a recipe`, Array.isArray(list) && list.length > 0 && list.every((n) => SOUND_KINDS.includes(n.k)));
  }
}
const uniq = (name, f) => {
  const seen = new Map();
  for (const id of IDS) {
    const v = VFX[id] && f(VFX[id]);
    if (v == null) continue;
    ok(`${name} unique: ${id}`, !seen.has(v), `same as ${seen.get(v)}`);
    seen.set(v, id);
  }
};
uniq('theme', (V) => V.theme?.toLowerCase());
uniq('visual', (V) => V.visual?.toLowerCase());
uniq('palette', (V) => V.palette?.join('').toLowerCase());
uniq('fire sound', (V) => JSON.stringify(V.sounds?.fire));

// ── 2. every power, fired in the sim, watched by the runtime ────────────────
// Wrap every hook so we know which were reached. VFX is frozen; its entries are not.
const HITS = new Map();
for (const id of IDS) {
  const V = VFX[id];
  if (!V) continue;
  for (const h of ['aura', 'fire', 'ball', 'trail', 'back', 'front', 'over', 'tick', 'impact', 'end']) {
    if (typeof V[h] !== 'function' || V[h].__wrapped) continue;
    const f = V[h];
    V[h] = function (...a) { HITS.get(id)?.[h] !== undefined && (HITS.get(id)[h]++); return f.apply(this, a); };
    V[h].__wrapped = true;
  }
}
const freshHits = () => ({ aura: 0, fire: 0, ball: 0, trail: 0, back: 0, front: 0, over: 0, tick: 0, impact: 0, end: 0 });

const FOE_CARD = { rarity: 'epic', number: 1 };
const snap = (m) => JSON.stringify([m.players.map((p) => [p.x, p.y, p.vx, p.vy, p.hp, p.gauge, p.armed]), m.ball, m.champ.effects.length, m.score]);

// One run: stage n's champion in seat i, fired off its head, `secs` of match after.
// `foeX` is where the other player stands, as distance from the champion's own side.
// With `active`, the other player chases the ball and kicks it back at the champion's goal —
// which is what reaches the branches an idle defender never does: a mirror returning a shot,
// a carry being stolen, a clone saving, a banked strike in stopped time.
function chase(m, q) {
  const b = m.ball, dx = b.x - q.x;
  return { left: dx < -10, right: dx > 10, jump: b.y < q.y - 90 && Math.abs(dx) < 60, kick: Math.abs(dx) < 50, power: false };
}
function scenario(id, n, i, foeX, secs, sounds, active = false) {
  const cards = [];
  cards[i] = { rarity: 'legendary', number: n };
  cards[1 - i] = FOE_CARD;
  const m = createMatch(cards[0], cards[1], { champions: true, duration: 600 });
  m.phase = 'play'; m.freeze = 0;
  const p = m.players[i], q = m.players[1 - i];
  const X = (x) => (i === 0 ? x : C.W - x);
  for (const [pl, x] of [[p, 380], [q, foeX]]) { pl.x = X(x); pl.y = C.GROUND_Y; pl.vx = pl.vy = 0; pl.onGround = true; pl.facing = pl.side; }
  const vfx = createVfx({ synth: (l) => sounds.push(l) });
  vfx.bind(m);
  const { g, log } = recorder();
  const frame = (dt) => {
    vfx.update(dt);
    vfx.drawStageDim(g);
    vfx.drawEffects(g, 'back');
    for (const pl of m.players) vfx.drawAura(g, pl);
    vfx.drawParts(g, 'back');
    if (!vfx.drawBall(g, m.ball) && m.ball.power && m.ball.power.champ) log.fallback = (log.fallback || 0) + 1;
    for (const eb of m.champ.balls) vfx.drawBall(g, eb);
    vfx.drawEffects(g, 'front');
    vfx.drawParts(g, 'front');
    vfx.drawEffects(g, 'over');
    vfx.shakeOffset();
    vfx.drawGrade(g);
    vfx.drawCutin(g);
    vfx.drawStatus(g);
  };
  // Armed, a moment before the touch: the tell.
  p.gauge = 1; p.armed = 1;
  const b = m.ball;
  b.x = C.W / 2; b.y = C.CEIL_Y + 60; b.vx = b.vy = 0;
  for (let k = 0; k < 12; k++) frame(1 / 60);
  // The touch.
  b.x = p.x + p.side * 4; b.y = headY(p); b.vx = 0; b.vy = 0; b.power = null;
  m.hitStop = 0;
  let maxParts = 0, maxOps = 0, mutated = false, balls = new Set(), effects = new Set();
  let burst = 0, held = false, heldFor = 0, glows0 = vfx.stats.glows;
  for (let k = 0, N = Math.round(secs / C.TICK); k < N; k++) {
    const qIn = active ? chase(m, q) : IDLE;
    step(m, i === 0 ? [IDLE, qIn] : [qIn, IDLE]);
    for (const e of m.events) {
      const e0 = vfx.stats.emitted;
      vfx.onEvent(e);
      if (e.type === 'powershot' && e.champ === id) { burst = Math.max(burst, vfx.stats.emitted - e0); held = vfx.holding(); }
    }
    if (vfx.holding()) heldFor += C.TICK;
    m.events.length = 0;
    if (m.ball.power?.champ) balls.add(m.ball.power.champ);
    for (const eb of m.champ.balls) if (eb.power?.champ) balls.add(eb.power.champ);
    for (const e of m.champ.effects) if (e.power) effects.add(e.power);
    const before = k % 20 === 0 ? snap(m) : null;
    const ops0 = log.ops;
    frame(C.TICK);
    maxOps = Math.max(maxOps, log.ops - ops0);
    if (before && snap(m) !== before) mutated = true;
    maxParts = Math.max(maxParts, vfx.parts.length);
    if (m.phase === 'over') break;
  }
  // Let the aftermath run out, as the client does between a goal and the kickoff.
  for (let k = 0; k < 90; k++) frame(1 / 60);
  return { log, maxParts, maxOps, mutated, balls, effects, leftover: vfx.parts.length,
    burst, held, heldFor, shapes: vfx.stats.shapes, glows: vfx.stats.glows - glows0 };
}

const SIGS = new Map();
// BIG, not just correct: every power has to hit hard on the touch, reach for the light-and-
// spectacle part of the toolkit, and light its main effect up.
const BIG = ['glow', 'rays', 'beam', 'confetti', 'stamp'];
const SPECTACLE = new Map(), BURST = new Map(), GLOWS = new Map();
for (const id of IDS) {
  if (!VFX[id]) continue;
  const n = POWER_ORDER.indexOf(id) + 1;
  const colors = new Set();
  let ops = 0;
  SPECTACLE.set(id, new Set());
  for (const i of [0, 1]) {
    const hits = freshHits();
    HITS.set(id, hits);
    const sounds = [];
    const runs = [scenario(id, n, i, 760, 10, sounds), scenario(id, n, i, 60, 10, sounds), scenario(id, n, i, 700, 10, sounds, true)];
    HITS.delete(id);
    const seat = `${id} seat ${i}`;
    for (const r of runs) {
      ok(`${seat}: no NaN/Infinity reached the canvas`, r.log.bad === 0, `${r.log.bad} bad values`);
      ok(`${seat}: never writes to the match`, !r.mutated);
      ok(`${seat}: particle budget respected`, r.maxParts <= 900, `${r.maxParts}`);
      ok(`${seat}: frame cost bounded`, r.maxOps < 9000, `${r.maxOps} canvas calls in one frame`);
      if (r.burst) {
        ok(`${seat}: the super cut-in holds the match`, r.held);
        ok(`${seat}: …and lets go within a second`, r.heldFor < 1, `${r.heldFor.toFixed(2)}s`);
      }
      for (const sh of r.shapes) SPECTACLE.get(id).add(sh);
      BURST.set(id, Math.max(BURST.get(id) || 0, r.burst));
      GLOWS.set(id, (GLOWS.get(id) || 0) + r.glows);
      ok(`${seat}: no champion ball drawn as the plain fireball`, !r.log.fallback, `${r.log.fallback} frames`);
      for (const c of r.log.colors) colors.add(c);
      ops += r.log.ops;
      for (const other of r.balls) if (other === id) ok(`${seat}: its shot has ball()`, typeof VFX[id].ball === 'function');
      if (r.effects.has(id)) ok(`${seat}: its effect has back()/front()/over()`, ['back', 'front', 'over'].some((h) => typeof VFX[id][h] === 'function'));
    }
    for (const ph of ['aura', 'fire', 'impact', 'end']) ok(`${seat}: ${ph}() reached`, hits[ph] > 0, JSON.stringify(hits));
    ok(`${seat}: main phase drawn (ball/back/front)`, hits.ball + hits.back + hits.front + hits.over > 0, JSON.stringify(hits));
    ok(`${seat}: sounds played`, sounds.length >= 2);
  }
  ok(`${id}: draws something substantial`, ops > 3000, `${ops} canvas calls`);
  ok(`${id}: draws in 6+ colours`, colors.size >= 6, [...colors].join(' '));
  ok(`${id}: a big burst on the touch (50+ particles)`, BURST.get(id) >= 50, `${BURST.get(id)}`);
  const big = BIG.filter((sh) => SPECTACLE.get(id).has(sh));
  ok(`${id}: uses 3+ of the spectacle kit (${BIG.join('/')})`, big.length >= 3, big.join(',') || 'none');
  ok(`${id}: 5+ particle shapes in all`, SPECTACLE.get(id).size >= 5, [...SPECTACLE.get(id)].join(','));
  ok(`${id}: its main effect is lit (fx.drawGlow)`, GLOWS.get(id) > 0, `${GLOWS.get(id)}`);
  SIGS.set(id, colors);
}

// ── 3. no two powers look alike ─────────────────────────────────────────────
// A look is the set of colours it paints with. Two powers sharing 80% of their colours are one
// look in two costumes.
const ids = [...SIGS.keys()];
for (let a = 0; a < ids.length; a++) {
  for (let b = a + 1; b < ids.length; b++) {
    const A = SIGS.get(ids[a]), B = SIGS.get(ids[b]);
    const inter = [...A].filter((c) => B.has(c) && c !== '#ffffff' && c !== '#fff' && c !== '#000' && c !== '#000000').length;
    const small = Math.min(A.size, B.size);
    ok(`${ids[a]} vs ${ids[b]}: distinct look`, inter / small < 0.8, `${inter}/${small} colours shared`);
  }
}

// ── 4. the design book is the code ─────────────────────────────────────────
if (!TIER) {
  const cur = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
  ok('docs/CHAMPIONS.md is current (node scripts/champions-doc.mjs)', cur === renderDoc());
}

console.log(`test-vfx${TIER ? ` (tier ${TIER})` : ''}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
