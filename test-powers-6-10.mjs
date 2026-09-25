// The champions' own powers, stages 6–10 (shared/champion-powers/stage-06..10.js, drawn by
// public/vfx/powers/stage-06..10.js): each is fired in a real arcade match from both seats, its
// flight is checked against the Head Soccer character it copies, what it does to the defender
// (hit, block) is checked, and its renderer is run against a recording canvas.
// Run: node test-powers-6-10.mjs
import * as C from './shared/constants.js';
import { createMatch, step, headY, serialize, restore } from './shared/sim.js';
import { championPower, difficultyScore } from './shared/champion-powers.js';
import { AILMENTS, ailMods } from './shared/hs-powers.js';
import { createVfx, POWER_VFX } from './public/champ-vfx.js';
import { AILMENT_VFX } from './public/vfx/ailments.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const IDLE = {};
const FOE = { rarity: 'epic', number: 1 };

// The champion of `stage` in seat `i` touches the ball off its head, armed; the other player stands
// `gap` px down the pitch. Returns once the cut-in has released the ball.
function fire(stage, i, { gap = 460, x = 300, bally = null } = {}) {
  const cards = []; cards[i] = { rarity: 'legendary', number: stage }; cards[1 - i] = FOE;
  const m = createMatch(cards[0], cards[1], { champions: true, duration: 600 });
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.gaugeLead = 0; m.ballWait = 0;
  const p = m.players[i], q = m.players[1 - i];
  const X = (v) => (i === 0 ? v : C.W - v);
  p.x = X(x); q.x = X(x + gap);
  const log = [];
  p.gauge = 1; p.prev = {};
  const press = [IDLE, IDLE]; press[i] = { power: true };
  step(m, press); log.push(...m.events); m.events.length = 0;
  m.ball.x = p.x; m.ball.y = bally ?? headY(p); m.ball.vx = 0; m.ball.vy = 0;
  step(m, [IDLE, IDLE]); log.push(...m.events); m.events.length = 0;
  const launch = { x: m.ball.x, y: m.ball.y };
  for (let k = 0; k < 200 && m.cutin > C.POWER_RELEASE; k++) { step(m, [IDLE, IDLE]); log.push(...m.events); m.events.length = 0; }
  return { m, p, q, log, launch, X };
}
// Steps on until `until(m, events)` is true (or n ticks); the defender's input from `qin(m, k)`.
function run(f, n, until = () => false, qin = () => IDLE) {
  const { m, p } = f;
  const path = [];
  for (let k = 0; k < n; k++) {
    const inp = []; inp[p.index] = IDLE; inp[1 - p.index] = qin(m, k);
    step(m, inp);
    f.log.push(...m.events);
    path.push({ x: m.ball.x, y: m.ball.y, ph: m.ball.power && m.ball.power.ph, pw: !!m.ball.power });
    const stop = until(m, m.events);
    m.events.length = 0;
    if (stop) break;
  }
  return path;
}
const ev = (f, type) => f.log.find((e) => e.type === type);
const kickNear = (reach = 150) => (m) => {
  const q = m.players.find((pl) => pl.index !== (m.ball.power ? m.ball.power.owner : -1)) || m.players[1];
  return { kick: !!m.ball.power && Math.abs(m.ball.x - q.x) < reach };
};

// Every built stage: fires from both seats with its own id, toward the other goal, with the cut-in.
function basics(stage, id) {
  const D = championPower(stage);
  ok(`stage ${stage}: built, id ${id}`, D && D.id === id, D && D.id);
  ok(`stage ${stage}: a Hebrew name and description for the arcade board`, D && /[֐-׿]/.test(D.name) && /[֐-׿]/.test(D.desc));
  ok(`stage ${stage}: cites the character's wiki page`, D && D.sources.some((s) => s.startsWith('https://headsoccer.wiki.gg/wiki/')));
  for (const seat of [0, 1]) {
    const f = fire(stage, seat);
    const shot = ev(f, 'powershot');
    ok(`stage ${stage} (seat ${seat}): fires ${id}`, shot && shot.cp === id && f.m.ball.power && f.m.ball.power.cp === id, JSON.stringify(shot));
    ok(`stage ${stage} (seat ${seat}): toward the other goal`, f.m.ball.power && f.m.ball.power.dir === f.p.side);
    // it gets there: the other player or the net, finite all the way
    let bad = false;
    run(f, 60 * 4, (m, es) => { if (![m.ball.x, m.ball.y, m.ball.vx, m.ball.vy].every(Number.isFinite)) bad = true; return es.some((e) => ['powerHit', 'blocked', 'goal'].includes(e.type)) || m.phase !== 'play'; });
    ok(`stage ${stage} (seat ${seat}): reaches the defender or the net`, f.log.some((e) => ['powerHit', 'blocked', 'goal'].includes(e.type)));
    ok(`stage ${stage} (seat ${seat}): finite`, !bad);
  }
  // rollback: a snapshot mid-flight restores into the same future
  const a = fire(stage, 0), b = fire(stage, 0);
  run(a, 8); run(b, 8);
  restore(b.m, JSON.parse(JSON.stringify(serialize(a.m))));
  run(a, 20); run(b, 20);
  ok(`stage ${stage}: a mid-flight snapshot replays bit for bit`, JSON.stringify(serialize(a.m)) === JSON.stringify(serialize(b.m)));
}

// ── a canvas that records (as test-vfx) ─────────────────────────────────────
function recorder() {
  const log = { ops: 0, bad: 0 };
  const grad = { addColorStop(o) { if (!Number.isFinite(o)) log.bad++; } };
  const t = {
    canvas: { width: C.W, height: C.H }, measureText: (s) => ({ width: String(s).length * 12 }),
    createRadialGradient: (...a) => { log.ops++; if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    createLinearGradient: (...a) => { log.ops++; if (a.some((v) => !Number.isFinite(v))) log.bad++; return grad; },
    getLineDash: () => [],
  };
  const g = new Proxy(t, {
    get(o, k) { if (k in o) return o[k]; return (...a) => { log.ops++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) log.bad++; }; },
    set(o, k, v) { o[k] = v; if (typeof v === 'number' && !Number.isFinite(v)) log.bad++; return true; },
  });
  return { g, log };
}
// The renderer, watched through a whole shot the way the client does: every event, update and draw.
function renderSmoke(stage, id, ails = []) {
  ok(`stage ${stage}: a renderer is registered`, POWER_VFX[id] && typeof POWER_VFX[id].draw === 'function');
  let T = 0;
  const V = createVfx({ now: () => T, drawBall: () => {} });
  const { g, log } = recorder();
  const f = fire(stage, 0);
  V.bind(f.m);
  let threw = null;
  const before = JSON.stringify(serialize(f.m));
  try {
    for (let k = 0; k < 150; k++) {
      step(f.m, [IDLE, IDLE]);
      for (const e of f.m.events) V.onEvent(e);
      f.m.events.length = 0;
      T += C.TICK; V.update(C.TICK);
      const s0 = JSON.stringify(serialize(f.m));
      if (V.drawGround) V.drawGround(g);
      V.drawBall(g, f.m.ball); V.drawOver(g);
      for (const p of f.m.players) V.drawArmed(g, p);
      V.drawOverlay(g); V.drawCutin(g);
      if (JSON.stringify(serialize(f.m)) !== s0) throw new Error('the renderer wrote to the match');
    }
    // the armed look
    const a = fire(stage, 0).m; a.players[1].armed = 1; a.players[1].shot = a.players[0].shot; V.bind(a); V.drawArmed(g, a.players[1]);
  } catch (e) { threw = e; }
  ok(`stage ${stage}: the renderer runs a whole shot without throwing or touching the sim`, !threw, threw && threw.message);
  ok(`stage ${stage}: draws something, and no NaN`, log.ops > 50 && log.bad === 0, `${log.ops} ops, ${log.bad} bad`);
  void before;
  for (const ail of ails) {
    const r = recorder();
    const p = { x: 500, y: C.GROUND_Y, side: 1, vy: 0 };
    let e = null;
    try { AILMENT_VFX[ail].draw(r.g, p, { t: 0.3, hx: 500, hy: 380, r: 26, fy: 435, fx: 500 }); } catch (x) { e = x; }
    ok(`stage ${stage}: the ${ail} ailment has a look, drawn cleanly`, !e && r.log.ops > 5 && r.log.bad === 0, e && e.message);
  }
}

// ═══ STAGE 6 — RUSSIA, Ice Shot ═══════════════════════════════════════════
{
  basics(6, 'iceshot');
  renderSmoke(6, 'iceshot', ['iced']);
  const D = championPower(6);
  // Flight: level for the first stretch, then "a little downward curve".
  for (const seat of [0, 1]) {
    const f = fire(6, seat, { gap: 900 });
    f.q.y = C.GROUND_Y; f.q.x = seat === 0 ? C.W - 20 : 20;          // out of the way, in the corner
    const y0 = f.m.ball.y, x0 = f.launch.x;
    const path = run(f, 40, (m) => !m.ball.power);
    const flat = path.filter((s) => s.pw && Math.abs(s.x - x0) < 280);
    const late = path.filter((s) => s.pw && Math.abs(s.x - x0) > 560);
    ok(`russia (seat ${seat}): level off the touch`, flat.length > 3 && flat.every((s) => Math.abs(s.y - y0) < 1.5), flat.map((s) => s.y.toFixed(0)).join(','));
    ok(`russia (seat ${seat}): dips at the end, a little (20–120 px)`, late.length > 0 && late[late.length - 1].y - y0 > 20 && late[late.length - 1].y - y0 < 120, late.map((s) => (s.y - y0).toFixed(0)).join(','));
  }
  // Hit (standing in its way): frozen in the ice block.
  {
    const f = fire(6, 0, { gap: 400 });
    run(f, 60, (m, es) => es.some((e) => e.type === 'powerHit'));
    const q = f.q;
    ok('russia hit: the defender is iced', q.ail === 'iced' && Math.abs(q.ailT - D.ailSec) < 0.2, `${q.ail} ${q.ailT}`);
    // no control while frozen: holding a direction and jump does nothing once he has landed
    run(f, 50);
    q.vx = 0;                                   // (still sliding from the knock: stop him dead, then try)
    const x1 = q.x;
    run(f, 40, () => false, () => ({ left: true, jump: true }));
    ok('russia hit: no control in the ice', Math.abs(q.x - x1) < 2 && q.y >= C.GROUND_Y - 0.5, `${x1} → ${q.x}`);
  }
  // Block (kicking into it): the blocker is frozen too, and the ball drops loose for the shooter.
  {
    const f = fire(6, 0, { gap: 400 });
    run(f, 60, (m, es) => es.some((e) => e.type === 'blocked' || e.type === 'powerHit'), kickNear());
    const bl = ev(f, 'blocked');
    ok('russia block: a kick blocks it', !!bl && bl.cp === 'iceshot' && bl.how === 'iced', JSON.stringify(bl));
    ok('russia block: the blocker is frozen in the ice', f.q.ail === 'iced', f.q.ail);
    ok('russia block: the ball is loose, heading back toward the shooter', !f.m.ball.power && f.m.ball.vx * f.p.side < 0);
  }
  // The ice block slides: "able to be kicked and dashed into the goal".
  {
    const md = ailMods({ ail: 'iced' });
    ok('russia: the ice block takes every control', md && md.dead && md.noJump && md.noDash);
    const f = fire(6, 0, { gap: 400 });
    const q = f.q; q.ail = 'iced'; q.ailT = 2; q.stunned = 0; q.y = C.GROUND_Y; q.vy = 0; q.onGround = true; q.vx = 400;
    f.m.ball.power = null; f.m.ball.x = 100; f.m.ball.y = 300;
    const x0 = q.x; run(f, 30);
    ok('russia: an iced player pushed on the grass slides on (ice), a long way', Math.abs(q.x - x0) > 90, `${(q.x - x0).toFixed(0)} px`);
    ok('russia: iced is a real ailment with a duration', AILMENTS.iced && AILMENTS.iced.dur === D.ailSec);
  }
}

// ═══ the ladder: every stage here at least as hard to stop as the one before ═══
{
  let prev = -Infinity;
  for (let s = 6; s <= 10; s++) {
    const D = championPower(s);
    if (!D) continue;
    const sc = difficultyScore(D);
    ok(`stage ${s}: not easier than the stage before (${sc.toFixed(2)} ≥ ${prev.toFixed(2)})`, sc >= prev);
    prev = sc;
  }
}

console.log(`test-powers-6-10: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
