// HEAD SOCCER POWER SHOTS — the eleven families, the ailments and the arming aura.
//
// Replaces shared/powers.js (the 45 bespoke champion powers) and shared/powershots.js (one flat
// shot in five colours), both in archive/. What Head Soccer has, and nothing else:
//
//   press POWER (gauge full)  → ARMED: the player crackles gold; a character with an AURA also
//                               hits a nearby opponent with it (onArm).
//   the next touch of the ball → the CUT-IN (sim.js, 1.34s) and the shot flies its FAMILY's path.
//   the shot meets the other player:
//       armed     → COUNTER: their own shot goes back (sim.js fireUltimateOnContact)
//       kicking   → BLOCK: the ball grinds on the boot, drops dead, then fires back as theirs
//       otherwise → HIT: knocked back and dazed, any AILMENT lands, the ball bounces off him
//     …except where the family says otherwise (a Ground shot cannot be blocked, a Grab carries
//     the defender, a Destructive or Critical shot smashes through a block).
//
// The numbers that were measured are cited against docs/HS-POWER-SHOTS.md (§n). Everything the
// footage does not show is marked `estimated` and follows the approved champion map
// (docs/HS-CHAMPION-MAP.md) and the HS wiki's family descriptions.
//
// ROLLBACK RULES. This file is sim code: it runs on the server and on every phone, and a client
// replays it after each snapshot. So: no Math.random, no Math.sin/cos (a JS engine may round them
// differently — the Up-and-Down wave is a literal table), and every piece of state that decides a
// future tick is a plain scalar on `ball.power` or on the player (`ail`, `ailT`), which serialize()
// copies whole.

import * as C from './constants.js';
import { HS_MAP } from './hs-champion-map.js';

// ── the families ─────────────────────────────────────────────────────────────
// speed   × POWER_SHOT_SPEED (2150 px/s, the measured comet — §3)
// block   what a KICKING defender does to it: 'grind' (HS's block, §4), 'none' (cannot be
//         blocked: it passes through), 'smash' (knocks the blocker away and rolls on),
//         'through' (knocks the blocker away and keeps flying), 'grab' (seizes him)
// color / glow / tail — the renderer's palette (public/vfx/families.js); the sim never reads them.
export const FAMILIES = Object.freeze({
  straight:    { id: 'straight',    name: 'בעיטה ישרה',  en: 'Straight',    speed: 1.0,  block: 'grind',   color: '#34d2ff', glow: '#e8fdff', measured: true },
  ground:      { id: 'ground',      name: 'בעיטת קרקע',  en: 'Ground',      speed: 0.85, block: 'none',    color: '#d08a3a', glow: '#ffe2b0' },
  downward:    { id: 'downward',    name: 'בעיטה יורדת', en: 'Downward',    speed: 1.0,  block: 'grind',   color: '#b06cff', glow: '#f0dcff' },
  destructive: { id: 'destructive', name: 'בעיטה הורסת', en: 'Destructive', speed: 0.9,  block: 'smash',   color: '#ff4a1c', glow: '#ffd08a' },
  aerial:      { id: 'aerial',      name: 'מטאור',       en: 'Aerial',      speed: 1.05, block: 'grind',   color: '#ff7a1a', glow: '#fff0a0', measured: true },
  delay:       { id: 'delay',       name: 'בעיטה מושהית', en: 'Delay',      speed: 1.15, block: 'grind',   color: '#7c5cff', glow: '#e4dcff' },
  grab:        { id: 'grab',        name: 'טופר',        en: 'Grab',        speed: 0.8,  block: 'grab',    color: '#2446c8', glow: '#9fc0ff', measured: true },
  multiball:   { id: 'multiball',   name: 'רב־כדור',     en: 'Multi-Ball',  speed: 0.95, block: 'grind',   color: '#ffc21a', glow: '#fff6c0' },
  updown:      { id: 'updown',      name: 'גל',          en: 'Up-and-Down', speed: 0.8,  block: 'grind',   color: '#2fe07a', glow: '#d6ffe6' },
  ailment:     { id: 'ailment',     name: 'קללה',        en: 'Ailment',     speed: 0.9,  block: 'grind',   color: '#e04cff', glow: '#fbd6ff' },
  critical:    { id: 'critical',    name: 'קריטי',       en: 'Critical',    speed: 1.3,  block: 'through', color: '#ffffff', glow: '#ff3355' },
});
export const FAMILY_ORDER = Object.freeze(Object.keys(FAMILIES));

// ── the ailments (estimated: none of these are in our footage but the stars) ──────────────
// dur is the base, in seconds, at intensity 0.5; it scales 0.6×–1.4× with intensity.
export const AILMENTS = Object.freeze({
  reverse:  { id: 'reverse',  name: 'בלבול',  dur: 3.0, color: '#e04cff' },   // left is right (???)
  shock:    { id: 'shock',    name: 'חשמל',   dur: 2.5, color: '#ffe23a' },   // half speed, no jump, no dash
  freeze:   { id: 'freeze',   name: 'קפוא',   dur: 1.5, color: '#9fe8ff' },   // an ice block: no control at all
  beheaded: { id: 'beheaded', name: 'בלי ראש', dur: 3.0, color: '#b9a7d6' },  // no head: no header, the ball passes where it was
  burn:     { id: 'burn',     name: 'בוער',   dur: 2.0, color: '#ff6a1a' },   // cannot kick, a little slower
  stars:    { id: 'stars',    name: 'כוכבים', dur: 1.0, color: '#ffd23c' },   // dazed: no control (HS §4's three gold stars)
});
export const AILMENT_ORDER = Object.freeze(Object.keys(AILMENTS));
export const AURA_ORDER = Object.freeze(['none', 'stun', 'push', 'reverse', 'freeze']);

// ── timings ─────────────────────────────────────────────────────────────────────
export const HS = Object.freeze({
  BLOCK_GRIND: 0.8,       // s the ball grinds on a kicking blocker (§4: M4 61.45–62.25, 79.55–80.25)
  BLOCK_PUSH: 40,         // px/s the grind pushes him back (§4: "a few pixels")
  BLOCK_REST: 0.4,        // s it then sits dead at his feet before firing back (§4: 62.35–62.7)
  HIT_KNOCK: 380,         // px/s the hit defender is thrown toward his own goal (§4 M4 43.33; estimated)
  HIT_LIFT: 240,          // px/s up with it
  SMASH_KNOCK: 520,       // Destructive / Critical: harder (estimated)
  AERIAL_UP: 1600,        // px/s straight up out of the top of the screen (§3 M2 42.7)
  AERIAL_WAIT: 1.0,       // s off-screen, warning streaks (§3 M2 43.2–44.2)
  AERIAL_DIVE_DEG: 40,    // the dive's angle below horizontal (§3 "~30–40°"); TAN_DIVE is its tangent
  DELAY_GO: 0.12,         // s of flight before the Delay shot stops dead (estimated)
  AURA_STUN: 0.8, AURA_PUSH: 460, AURA_REVERSE: 2.5, AURA_FREEZE: 1.2,
});

const TAN_DIVE = 0.8391;   // tan 40°, as a literal (no Math.tan in sim code — see ROLLBACK RULES)

// ── who fires what ──────────────────────────────────────────────────────────────
// Champions are the approved map (docs/hs-champion-map.json → shared/hs-champion-map.js); every
// other card picks by rarity, then by its number. Commons get the plain families, legendaries
// reach the late ones — the same order the arcade introduces them in.
const RARITY_POOL = {
  common: ['straight', 'ground', 'downward', 'straight'],
  rare: ['straight', 'ground', 'downward', 'updown', 'aerial', 'destructive'],
  epic: ['updown', 'aerial', 'destructive', 'delay', 'ailment', 'multiball', 'downward'],
  legendary: FAMILY_ORDER,
};
const HAND_AIL = ['reverse', 'shock', 'freeze', 'beheaded', 'burn', 'stars'];
const MAP_BY_STAGE = new Map(HS_MAP.map((r) => [r.stage, r]));
export const championRow = (char) => (char && char.rarity === 'legendary' ? MAP_BY_STAGE.get(Number(char.number)) || null : null);

// The shot a card fires. `arcade` gives a champion its own intensity and gentleness from the map;
// everywhere else (online, free play) every shot plays at the same middle intensity, so a card's
// family is its identity and never its advantage — the same reason stats are equal online.
export function shotFor(char, { arcade = false } = {}) {
  const row = championRow(char);
  if (row) {
    return makeShot(row.family, {
      ailment: row.ailment, aura: row.aura, auraRadius: row.auraRadius,
      intensity: arcade ? row.intensity : 0.5, gentle: arcade && !!row.gentle, stage: row.stage,
      name: row.power && row.power.name, icon: row.power && row.power.icon,
    });
  }
  const pool = RARITY_POOL[char && char.rarity] || RARITY_POOL.common;
  const n = Math.abs(Number(char && char.number) || 0);
  const family = pool[n % pool.length];
  return makeShot(family, { ailment: family === 'ailment' ? HAND_AIL[n % HAND_AIL.length] : null });
}

// A shot by family, for tests and tools: shotById('grab', { gentle: true }).
export function shotById(family, o = {}) { return makeShot(family, o); }

function makeShot(family, o = {}) {
  const F = FAMILIES[family] || FAMILIES.straight;
  const aura = AURA_ORDER.includes(o.aura) ? o.aura : 'none';
  return Object.freeze({
    id: F.id, family: F.id,
    ailment: AILMENTS[o.ailment] ? o.ailment : null,
    aura, auraRadius: aura === 'none' ? 0 : (o.auraRadius || 100),
    intensity: o.intensity ?? 0.5,
    gentle: !!o.gentle,
    name: o.name || F.name, icon: o.icon || null,
    color: F.color, glow: F.glow,
  });
}

// ── stats ───────────────────────────────────────────────────────────────────────
// HS's 1–10 stat levels → multipliers (estimated spread: level 1 runs and kicks ~20% under an
// average body and jumps ~14% under, level 10 as far over). Only an arcade champion has levels;
// everyone else is EQUAL.
export const EQUAL_STATS = Object.freeze({ speed: 1, jump: 1, kick: 1 });
const lvl = (L, lo, hi) => lo + (hi - lo) * (Math.max(1, Math.min(10, L || 5.5)) - 1) / 9;
export function statsFor(levels) {
  if (!levels) return EQUAL_STATS;
  return { speed: lvl(levels.speed, 0.8, 1.2), jump: lvl(levels.jump, 0.86, 1.14), kick: lvl(levels.kick, 0.8, 1.2) };
}
// The POWER stat is how fast the gauge fills: level 5–6 is the starter's 15s, 10 is 25% faster.
export const meterRateFor = (L) => (L ? 0.8 + (Math.max(1, Math.min(10, L)) - 1) * 0.05 : 1);

// ── the Up-and-Down wave: a literal quarter-sine, 33 entries, linearly interpolated ──────
const QSIN = [0, 0.0491, 0.098, 0.1467, 0.1951, 0.243, 0.2903, 0.3369, 0.3827, 0.4276, 0.4714, 0.5141,
  0.5556, 0.5957, 0.6344, 0.6716, 0.7071, 0.741, 0.773, 0.8032, 0.8315, 0.8577, 0.8819, 0.904, 0.9239,
  0.9415, 0.9569, 0.97, 0.9808, 0.9892, 0.9952, 0.9988, 1];
// One period over u ∈ [0, 1): 0 → 1 → 0 → −1 → 0.
export function wave(u) {
  let f = u - Math.floor(u);
  const q = Math.floor(f * 4); f = f * 4 - q;              // quadrant and position in it
  const x = (q === 1 || q === 3 ? 1 - f : f) * 32;
  const i = Math.min(31, Math.floor(x));
  const v = QSIN[i] + (QSIN[i + 1] - QSIN[i]) * (x - i);
  return q >= 2 ? -v : v;
}

// ── helpers ─────────────────────────────────────────────────────────────────────
const goalLineX = (dir) => (dir > 0 ? C.W - C.GOAL_W : C.GOAL_W);
const baseSpeed = (pw) => C.POWER_SHOT_SPEED * FAMILIES[pw.fam].speed * (0.92 + 0.16 * pw.int);
export const ailDur = (type, int = 0.5, fam = null) =>
  (AILMENTS[type] ? AILMENTS[type].dur : 1) * (0.6 + 0.8 * int) * (fam === 'ailment' ? 1.4 : 1);

// Everything a power ball carries, as plain scalars (serialize copies it whole).
function freshPower(p, shot, o = {}) {
  return {
    id: shot.family, fam: shot.family, ail: shot.ailment || '', int: shot.intensity, gentle: shot.gentle ? 1 : 0,
    owner: p.index, dir: p.side, t: 0, life: C.POWER_SHOT_LIFE, ph: 'fly', k: 0,
    x0: 0, y0: 0, tx: 0, ty: 0, vx0: 0, vy0: 0, tgt: -1, pass: 0, extra: 0, rb: 0, hit: 0,
    color: shot.color, glow: shot.glow,
    ...o,
  };
}

// ── LAUNCH ──────────────────────────────────────────────────────────────────────
// The armed touch. Turns the ball into this player's power ball and sets up its family's path.
// A Multi-Ball also puts its extra balls on the pitch (m.xballs — real balls, sim.js steps them).
export function launch(m, b, p, kit, fx, o = {}) {
  const shot = p.shot;
  const pw = freshPower(p, shot);
  pw.x0 = b.x; pw.y0 = b.y;
  b.power = pw;
  b.spin = pw.dir * 26;
  const S = baseSpeed(pw);
  switch (pw.fam) {
    case 'ground': pw.ph = 'drop'; break;
    // aimed through the mouth, low, a little inside the line (the foot of the post is furniture)
    case 'downward': pw.ph = 'rise'; pw.tx = goalLineX(pw.dir) + pw.dir * 24; pw.ty = C.GROUND_Y - C.GOAL_H * 0.3; break;
    case 'aerial': {
      pw.ph = 'up';
      // into the mouth, under the bar and past the roof's edge (the goal is a box — goalbox.js)
      pw.tx = goalLineX(pw.dir) + pw.dir * 30;
      pw.ty = C.GROUND_Y - C.GOAL_H * 0.35;
      break;
    }
    case 'delay': pw.ph = 'go'; break;
    default: break;
  }
  b.vx = pw.dir * S; b.vy = 0;
  if (pw.fam === 'multiball' && m.xballs) {
    const n = shot.gentle ? 1 : pw.int >= 0.9 ? 2 : 1;
    const k = shot.gentle ? 0.7 : 0.95;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0 ? -1 : 1;
      const x = { x: b.x, y: b.y + up * b.r * 0.5, vx: pw.dir * S * k, vy: up * S * 0.11, r: b.r, spin: 0, power: null };
      x.power = freshPower(p, shot, { extra: 1, x0: b.x, y0: b.y, vx0: pw.dir * S * k, vy0: up * S * 0.11 * (1 + i * 0.4) });
      m.xballs.push(x);
    }
  }
  m.events.push({ type: 'powershot', player: p.index, shot: pw.fam, fam: pw.fam, ail: pw.ail, champ: p.champ ? p.champ.id : null, ultimate: true, countered: !!o.countered });
  return pw;
}

// ── FLIGHT ──────────────────────────────────────────────────────────────────────
// Once per ball sub-step. Returns true while the power owns the ball (sim.js then skips gravity,
// drag and the speed cap for it).
export function stepPower(m, b, dt, kit, fx) {
  const pw = b.power;
  if (!pw) return false;
  const S = baseSpeed(pw);
  switch (pw.ph) {
    // ─ the block (§4): pinned on the boot, then dead at the feet, then fired back ─
    case 'grind': {
      const q = m.players[pw.tgt];
      pw.k += dt;
      q.x += pw.dir * HS.BLOCK_PUSH * dt;
      kit.bounds(q);
      b.x = q.x + pw.x0; b.y = q.y + pw.y0; b.vx = 0; b.vy = 0;
      if (pw.k >= HS.BLOCK_GRIND) {
        pw.ph = 'rest'; pw.k = 0;
        b.x = kit.keepOutOfGoal(b.x, b.y, q.x - pw.dir * (C.BODY_W / 2 + b.r + 6), C.GROUND_Y - b.r, b.r);
        b.y = C.GROUND_Y - b.r;
      }
      return true;
    }
    case 'rest': {
      pw.k += dt; b.vx = 0; b.vy = 0;
      if (pw.k >= HS.BLOCK_REST) {
        const q = m.players[pw.tgt];
        pw.owner = q.index; pw.dir = q.side; pw.ph = 'fly'; pw.rb = 1; pw.t = 0; pw.k = 0; pw.tgt = -1; pw.pass = 0;
        pw.x0 = b.x; pw.y0 = b.y;
        b.vx = pw.dir * C.POWER_SHOT_SPEED; b.vy = 0;
        m.events.push({ type: 'rebound', player: q.index, fam: pw.fam, x: b.x, y: b.y });
      }
      return true;
    }
    // ─ the Grab (§3 M3): the ball carries the defender toward his own goal ─
    case 'grab': {
      const q = m.players[pw.tgt];
      const sp = pw.gentle ? 150 : 260 + 160 * pw.int;
      pw.k += sp * dt;
      b.vx = pw.dir * sp; b.vy = 0;
      const off = pw.dir * (C.HEAD_R + b.r + 2);
      q.x = b.x + b.vx * dt - off; q.vx = b.vx;
      kit.bounds(q);
      const toLine = Math.abs(goalLineX(pw.dir) - q.x);
      // Gentle (stage 2): a third of the way to the line, and a jump or a fresh kick breaks it.
      const broke = pw.gentle && (q.vy < -100 || q.kickT > C.KICK_TIME - 2 * C.TICK);
      if (pw.k >= pw.tx || toLine < 6 || broke) {
        if (!broke) { q.stunned = 0; kit.stun(m, q, C.POWER_BLOCK_STUN); applyAilment(m, q, 'stars', C.POWER_BLOCK_STUN); }
        else if (q.ail === 'stars') { q.ail = ''; q.ailT = 0; }
        m.events.push({ type: 'released', player: q.index, by: pw.owner, broke });
        if (pw.gentle || broke) { b.power = null; b.vx = pw.dir * 140; b.vy = -160; return false; }
        pw.ph = 'fly'; pw.fam = 'straight'; pw.t = 0; pw.pass |= 1 << q.index; pw.tgt = -1;
        b.vx = pw.dir * S; b.vy = 0;
      }
      return true;
    }
    // ─ Aerial (§3 M2): straight up and out, a second of warning, then the dive ─
    case 'up':
      b.vx = 0; b.vy = -HS.AERIAL_UP;
      if (b.y <= -100) {
        pw.ph = 'wait'; pw.k = 0;
        const rise = pw.ty + 110;
        pw.x0 = pw.tx - pw.dir * rise / TAN_DIVE;
        b.x = pw.x0; b.y = -110; b.vy = 0;
      }
      return true;
    case 'wait':
      b.vx = 0; b.vy = 0; b.x = pw.x0; b.y = -110;
      pw.k += dt;
      if (pw.k >= HS.AERIAL_WAIT * (1.15 - 0.3 * pw.int)) { pw.ph = 'dive'; pw.t = 0; aimAt(b, pw.tx, pw.ty, S * 1.05); }
      return true;
    case 'dive': {
      aimAt(b, pw.tx, pw.ty, S * 1.05);
      pw.t += dt;
      if (b.y >= pw.ty - 2 || pw.t > pw.life) return endPower(b);
      return true;
    }
    // ─ Downward: a short hop up, then a straight line down into the foot of the goal ─
    case 'rise':
      b.vx = pw.dir * S * 0.35; b.vy = -S * 0.5;
      pw.k += dt;
      if (pw.k >= 0.14) { pw.ph = 'fly'; pw.k = 0; aimAt(b, pw.tx, pw.ty, S); }
      return true;
    // ─ Ground: down onto the turf, then along it ─
    case 'drop':
      b.vx = pw.dir * S * 0.6; b.vy = 1200;
      // (a power ball bounces off the grass inside the sub-step, so "reached it" is a band)
      if (b.y >= C.GROUND_Y - b.r - 12) { pw.ph = 'roll'; b.y = C.GROUND_Y - b.r; b.vy = 0; b.vx = pw.dir * S; }
      return true;
    case 'roll':
      b.y = C.GROUND_Y - b.r; b.vy = 0; b.vx = pw.dir * S;
      break;
    // ─ Delay: a short flight, a dead stop in the air, then on at the goal ─
    case 'go':
      b.vx = pw.dir * S * 0.8; b.vy = 0;
      pw.k += dt;
      if (pw.k >= HS.DELAY_GO) { pw.ph = 'hold'; pw.k = 0; b.vx = 0; b.vy = 0; }
      return true;
    case 'hold':
      b.vx = 0; b.vy = 0;
      pw.k += dt;
      if (pw.k >= 0.35 + 0.45 * pw.int) {
        pw.ph = 'fly'; pw.t = 0;
        const dx = goalLineX(pw.dir) - b.x, dy = (C.GROUND_Y - C.GOAL_H * 0.45) - b.y;
        const d = Math.hypot(dx, dy) || 1;
        pw.vx0 = (dx / d) * S; pw.vy0 = (dy / d) * S;
        m.events.push({ type: 'delayGo', player: pw.owner, x: b.x, y: b.y });
      }
      return true;
    default: {
      // 'fly'
      if (pw.hit) { b.vx = pw.vx0; b.vy += C.BALL_GRAV * dt; }
      else if (pw.rb) { b.vx = pw.dir * C.POWER_SHOT_SPEED; b.vy = 0; }
      else if (pw.extra) { b.vx = pw.vx0; b.vy = pw.vy0; }
      else if (pw.fam === 'downward') {
        aimAt(b, pw.tx, pw.ty, S);
        if (b.y >= pw.ty - 2) { pw.t += dt; return endPower(b); }
      } else if (pw.fam === 'delay' && (pw.vx0 || pw.vy0)) { b.vx = pw.vx0; b.vy = pw.vy0; }
      else if (pw.fam === 'updown') {
        const A = 55 + 45 * pw.int, L = 300;
        const yc = Math.max(C.SKY_Y + A + 20, Math.min(C.GROUND_Y - b.r - A - 2, pw.y0));
        b.vx = pw.dir * S;
        const nx = b.x + b.vx * dt;
        const ty = yc - A * wave(Math.abs(nx - pw.x0) / L);
        b.vy = (ty - b.y) / dt;
      } else { b.vx = pw.dir * S; b.vy = 0; }        // dead flat (§3: ±2% of the frame, release to defender)
    }
  }
  pw.t += dt;
  // Ran out, or pinned against a wall above a goal (the flight would push into it for ever).
  if (pw.t >= pw.life || b.x < b.r + 2 || b.x > C.W - b.r - 2) return endPower(b);
  return true;
}

function aimAt(b, tx, ty, S) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
  b.vx = (dx / d) * S; b.vy = (dy / d) * S;
}
function endPower(b) {
  b.power = null;
  return false;
}

// Contacts the power ball does NOT make: its own shooter, anyone while it is pinned, carried,
// hidden in the sky or resting, and whoever it has already gone through.
export function skipContact(b, p) {
  const pw = b.power;
  if (!pw) return false;
  if (pw.owner === p.index) return true;
  // (a Delay hanging in the air is frozen in time: nothing touches it until it goes on)
  if (pw.ph === 'grind' || pw.ph === 'rest' || pw.ph === 'grab' || pw.ph === 'up' || pw.ph === 'wait' || pw.ph === 'hold') return true;
  return (pw.pass & (1 << p.index)) !== 0;
}

// ── CONTACT: an unarmed defender meets the other player's power ball ────────────────
// (An ARMED one never gets here: sim.js fires their own shot first — the counter, §4.)
// Returns the outcome: 'block' | 'hit' | 'smash' | 'through' | 'pass' | 'grab' | 'deflect'.
export function contact(m, p, b, kit, fx) {
  const pw = b.power;
  const F = FAMILIES[pw.fam];
  // The leg is out for KICK_TIME after the press, whether or not the swing already met the ball
  // (a strike cuts kickT short; the cooldown still says how long ago the press was).
  const kicking = p.kickT > 0 || p.kickCd > C.KICK_COOLDOWN - C.KICK_TIME;
  m.idle = 0;
  // A Multi-Ball's extra balls are only for scoring with: one touch knocks them dead.
  if (pw.extra) {
    b.power = null;
    b.vx = -pw.dir * Math.abs(b.vx) * 0.35; b.vy = -200;
    if (!kicking && !p.armed) knock(m, p, pw, kit, HS.HIT_KNOCK * 0.6, C.POWER_BLOCK_STUN * 0.6);
    m.events.push({ type: 'blocked', player: p.index, by: pw.owner, fam: pw.fam, extra: true });
    return 'deflect';
  }
  // A weak Destructive (the first tier's cannon) is still blockable; from the middle of the
  // campaign on it smashes a block aside (the map's intensity is how strong a family plays).
  const mode = pw.rb ? 'grind' : F.block === 'smash' && pw.int < 0.4 ? 'grind' : F.block;
  // A GRAB seizes whoever it meets — unless he kicks into it: a boot blocks the claw like any
  // other shot (the kick is HS's answer to every power ball, §4).
  if (mode === 'grab' && pw.ph === 'fly' && !kicking) {
    pw.ph = 'grab'; pw.tgt = p.index; pw.k = 0;
    pw.tx = pw.gentle ? Math.abs(goalLineX(pw.dir) - p.x) / 3 : 2000;
    // Seized: a real champion's claw holds you for the whole drag; the gentle one only holds
    // on, and a jump breaks it (see stepPower 'grab').
    // §3 M3 74.1 s: the seized player sees stars at once.
    if (!pw.gentle) { kit.stun(m, p, 3); applyAilment(m, p, 'stars', 3); }
    b.y = kit.headY(p);
    m.events.push({ type: 'grabbed', player: p.index, by: pw.owner, gentle: !!pw.gentle });
    return 'grab';
  }
  if (mode === 'none') {
    // GROUND: it cannot be blocked or deflected — only countered. It trips whoever it meets and rolls on.
    pw.pass |= 1 << p.index;
    knock(m, p, pw, kit, 120, C.POWER_BLOCK_STUN, 420);
    landAilment(m, p, pw);
    m.events.push({ type: 'powerHit', player: p.index, by: pw.owner, fam: pw.fam, how: 'pass' });
    return 'pass';
  }
  if (kicking && (mode === 'grind' || mode === 'grab')) {
    // THE BLOCK (§4): pinned where it met the boot, the blocker pushed back and held.
    m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
    pw.ph = 'grind'; pw.k = 0; pw.tgt = p.index;
    pw.x0 = b.x - p.x; pw.y0 = Math.max(b.y, kit.headY(p) - C.HEAD_R) - p.y;
    // Held while it grinds — the daze HS shows (~0.5s, power.blockStun); the ball grinds on to 0.8s.
    kit.stun(m, p, C.POWER_BLOCK_STUN);
    if (pw.fam === 'ailment') landAilment(m, p, pw);
    m.events.push({ type: 'blocked', player: p.index, by: pw.owner, fam: pw.fam, shot: pw.fam });
    return 'block';
  }
  // THE HIT (§4 M4 43.33, M3 38.25): knocked back and dazed; the ball bounces off (below).
  m.hitStop = Math.max(m.hitStop, C.HIT_STOP_POWER);
  const smash = mode === 'smash' || mode === 'through';
  knock(m, p, pw, kit, smash ? HS.SMASH_KNOCK : HS.HIT_KNOCK, C.POWER_BLOCK_STUN);
  landAilment(m, p, pw);
  const how = mode === 'through' ? 'through' : smash ? 'smash' : 'hit';
  m.events.push({ type: 'powerHit', player: p.index, by: pw.owner, fam: pw.fam, how, x: b.x, y: b.y });
  if (mode === 'through') { pw.pass |= 1 << p.index; return how; }
  if (mode === 'smash') {
    // A strong Destructive smashes on through him, still the shot, slower and falling now.
    pw.pass |= 1 << p.index; pw.hit = 1; pw.ph = 'fly';
    pw.vx0 = pw.dir * Math.max(Math.abs(b.vx), Math.hypot(b.vx, b.vy)) * 0.75;
    b.vx = pw.vx0; b.vy = -120;
    return how;
  }
  // …and the ball BOUNCES OFF HIM, as off any body, keeping most of its pace, no longer the shot:
  // square on, it flies straight back (M3 38.25 s: off the Mexico keeper and all the way into the
  // shooter's own empty net, ~1800 of the comet's 2150 px/s); grazing the crown, it carries on
  // past him (M4 43.30–43.40 s: over the head and into the goal behind). Drawn as the ball's
  // after-images (champ-vfx), not a comet.
  const hy = kit.headY(p);
  let nx, ny;
  if (b.y < p.y - C.BODY_H) { nx = b.x - p.x; ny = b.y - hy; }        // the head: its circle's normal
  else { nx = Math.sign(b.x - p.x) || -pw.dir; ny = 0; }               // the body: square
  const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
  b.vx *= C.POWER_BLOCK_REBOUND; b.vy *= C.POWER_BLOCK_REBOUND;
  b.power = null;
  const r0 = (b.y < p.y - C.BODY_H ? C.HEAD_R : C.BODY_W / 2) + b.r + 2;
  const tx = (b.y < p.y - C.BODY_H ? p.x : p.x) + nx * r0, ty = (b.y < p.y - C.BODY_H ? hy + ny * r0 : b.y);
  b.x = kit.keepOutOfGoal(b.x, b.y, tx, ty, b.r); b.y = Math.min(ty, C.GROUND_Y - b.r);
  return how;
}

function knock(m, p, pw, kit, v, daze, lift = HS.HIT_LIFT) {
  p.vx = pw.dir * v; p.vy = -lift; p.onGround = false;
  kit.stun(m, p, daze);
  if (!p.ail) applyAilment(m, p, 'stars', daze);
}
function landAilment(m, p, pw) {
  if (pw.ail) applyAilment(m, p, pw.ail, ailDur(pw.ail, pw.int, pw.fam));
}

// A KICK a hair before the ball arrives blocks it too: the boot is out in front of the body, and
// a block that only counted once the ball was already inside the torso would ask for a timing no
// thumb has. Called on the kick press (sim.js tryCounter); the reach is the boot's.
export function earlyBlock(m, p, kit, fx) {
  const b = m.ball, pw = b.power;
  if (!pw || pw.owner === p.index || pw.extra || skipContact(b, p) || p.armed > 0) return false;
  if (pw.ph !== 'fly' && pw.ph !== 'roll' && pw.ph !== 'dive' && pw.ph !== 'go') return false;
  const hy = kit.headY(p);
  const near = Math.hypot(b.x - p.x, b.y - (hy + p.y) / 2) < C.HEAD_R + b.r + C.KICK_REACH * 0.55;
  const coming = (p.x - b.x) * pw.dir > -C.BODY_W;
  if (!near || !coming) return false;
  contact(m, p, b, kit, fx);
  return true;
}

// ── THE PRESS: the arming aura ──────────────────────────────────────────────────
export function onArm(m, p, kit, fx) {
  const sh = p.shot;
  if (!sh || sh.aura === 'none' || !(sh.auraRadius > 0)) return false;
  const q = m.players[1 - p.index];
  const d = Math.hypot(q.x - p.x, kit.headY(q) - kit.headY(p));
  const hit = d <= sh.auraRadius && q.stunned <= 0;
  m.events.push({ type: 'aura', player: p.index, aura: sh.aura, r: sh.auraRadius, hit });
  if (!hit) return false;
  switch (sh.aura) {
    case 'stun': kit.stun(m, q, HS.AURA_STUN); applyAilment(m, q, 'stars', HS.AURA_STUN); break;
    case 'push': {
      const s = Math.sign(q.x - p.x) || -p.side;
      q.vx = s * HS.AURA_PUSH; q.vy = -260; q.onGround = false; q.shoved = 0.3;
      break;
    }
    case 'reverse': applyAilment(m, q, 'reverse', HS.AURA_REVERSE); break;
    case 'freeze': applyAilment(m, q, 'freeze', HS.AURA_FREEZE); break;
  }
  return true;
}

// ── AILMENTS ────────────────────────────────────────────────────────────────────
// One at a time, never stacked: a new one replaces the old only if it would last longer.
export function applyAilment(m, p, type, dur) {
  if (!AILMENTS[type] || !(dur > 0)) return false;
  if (p.ail && p.ailT >= dur) return false;
  p.ail = type; p.ailT = dur;
  m.events.push({ type: 'ailment', player: p.index, ail: type, time: dur });
  return true;
}
// Wall time, like the stun (sim.js ticks it on the same schedule).
export function tickAilment(m, p, dt) {
  if (!p.ail) return;
  p.ailT -= dt;
  if (p.ailT > 0) return;
  m.events.push({ type: 'ailmentEnd', player: p.index, ail: p.ail });
  p.ail = ''; p.ailT = 0;
}

// What an ailment does to the body, in the shape stepPlayer reads (the same keys the arcade's
// champion mods used to have, so the movement code did not have to change). null = nothing on.
export function ailMods(p) {
  if (!p.ail) return null;
  const o = { time: 1, speed: 1, jump: 1, grav: 1, airJumps: 0, noDash: false, dashFree: false, accel: 1,
    friction: 0, frozen: false, noJump: false, reverse: false, noKick: false, dead: false };
  switch (p.ail) {
    case 'reverse': o.reverse = true; break;
    case 'shock': o.speed = 0.5; o.noJump = true; o.noDash = true; break;
    case 'freeze': o.frozen = true; o.dead = true; o.noJump = true; o.noDash = true; break;
    case 'burn': o.noKick = true; o.speed = 0.8; break;
    case 'stars': o.dead = true; o.noDash = true; break;
    default: break;                                   // beheaded: sim.js drops the head's contacts
  }
  return o;
}
const DEAD = Object.freeze({});
export function ailInput(md, input) {
  if (md.dead) return DEAD;
  if (!md.reverse && !md.noKick && !md.noJump) return input;
  const o = { ...input };
  if (md.reverse) { o.left = !!input.right; o.right = !!input.left; }
  if (md.noKick) o.kick = false;
  if (md.noJump) o.jump = false;
  return o;
}
export const headless = (p) => p.ail === 'beheaded';

// Ball-side and extra-ball helpers for the renderer and the bot.
export const familyOf = (b) => (b && b.power ? FAMILIES[b.power.fam] : null);
