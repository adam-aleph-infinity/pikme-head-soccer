// CHAMPION VFX — how each of the 45 champion powers LOOKS and SOUNDS, and nothing else.
//
// shared/powers.js decides what a power does; this file only watches. It reads m.champ, the
// ball's power and the sim's events, and draws. Nothing here writes to the match, so nothing
// here can reach the sim, the bot, the server or an online room — and Math.random is fine.
//
// Every power runs the same six phases, and each has one hook in its entry (public/vfx/tierN.js):
//
//   anticipation  aura(g, p, s)       every frame the champion is ARMED — the tell that the
//                                     next touch is going to be this power, not a plain touch
//   activation    fire(s)             once, on the touch that fires it ('powershot' event)
//   main          ball(g, b, s)       every frame its shot is in the air (replaces the fireball)
//                 trail(b, s)         …and the particles that shot throws off as it flies (s.dt)
//                 back/front(g, e, s) every frame an effect record of it is alive: behind the
//                 over(g, e, s)       bodies, in front of them, or over the goal nets
//                 tick(e, s)          …and the particles that effect throws off (s.dt)
//   impact        impact(s, ev)       where it lands: its shot blocked or scoring, its effect
//                                     taking hold ('land'), or its own sim event (drilled…)
//   aftermath     end(s, info)        once, when its shot or an effect of it is gone
//   cleanup       (engine)            particles run out their life, tints and shake decay
//
// The helpers every hook gets (`s.fx`) are the whole visual vocabulary: typed particles, rings,
// lightning, glyphs, light (glow blobs, sunburst rays, energy beams), confetti, comic-book impact
// words, screen shake, flash, a colour grade, an edge glow, and synthesised sound.
//
// And every power opens the same way, because that is what a super move IS: the SUPER CUT-IN.
// The touch that fires it holds the match for CUT_HOLD seconds (arcade only — online matches have
// no m.champ and never reach this file), the pitch dims, light bursts out of the champion, and a
// band with their name and the power's icon sweeps across. The power's own fire() burst lands
// under it. game.js asks holding() before each sim step. Sharing the
// vocabulary is allowed; sharing a look is not — test-vfx.mjs fingerprints what every power
// draws and fails on two that draw the same thing.

import * as C from '../shared/constants.js';
import { POWERS, POWER_ORDER } from '../shared/powers.js';
import { headY, headR } from '../shared/sim.js';
import { depthPoint } from '../shared/goalbox.js';
import TIER1 from './vfx/tier1.js';
import TIER2 from './vfx/tier2.js';
import TIER3 from './vfx/tier3.js';
import TIER4 from './vfx/tier4.js';
import TIER5 from './vfx/tier5.js';

export const PHASES = ['anticipation', 'activation', 'main', 'impact', 'aftermath', 'cleanup'];
export const DOC_FIELDS = ['fantasy', 'purpose', 'player', 'bot', 'layers', 'camera', 'hud', 'audio', 'counterplay', 'perf', 'helpers'];
export const SOUND_KINDS = ['thud', 'sweep', 'blip', 'crowd'];
export const SOUND_SLOTS = ['fire', 'impact', 'end'];

export const VFX = Object.freeze({ ...TIER1, ...TIER2, ...TIER3, ...TIER4, ...TIER5 });

// Particles are cheap but not free: past this many the oldest go first. On a phone that is
// dropping frames the budget halves, and every hook that emits reads `s.fx.budget` to scale.
const MAX_PARTS = 900;
const CUT_HOLD = 0.42, CUT_LIFE = 1.0;
const TAU = Math.PI * 2;

// A sim event that belongs to one power, by name. Everything else is keyed off the ball's
// power or the event's own `champ`.
const OWN_EVENTS = {
  wallHit: 'goalwall', mirrored: 'mirror', coinHit: 'coins', timeResumes: 'timestop',
  blown: 'tornado', drained: 'drain', quake: 'quake', teleport: 'portal', drilled: 'drill',
  split: 'split', released: 'carry', stolen: 'carry',
};

export function createVfx({ synth = () => {}, now = () => performance.now() / 1000 } = {}) {
  const parts = [];
  const cam = { shake: 0, shakeLife: 0, shakeMag: 0, flash: 0, flashLife: 0, flashCol: '#fff', flashA: 0.5,
    tint: 0, tintLife: 0, tintCol: '#000', tintA: 0 };
  let M = null;
  let budget = 1, slow = 0, lastDt = 1 / 60;
  let shot = null;                   // { power, owner } — the champion shot in the air right now
  let cut = null;                    // { power, owner, t } — the super cut-in, while it runs
  let dim = 0, dimCol = '#000000';   // the stage's "lights down" while a power is on (0 → 1)
  const stats = { emitted: 0, shapes: new Set(), glows: 0 };   // what the hooks asked for (tests)
  const live = new Map();            // effect seq → { power, e } for the effects alive last frame

  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const add = (p) => {
    stats.emitted++; stats.shapes.add(p.shape);
    if (parts.length >= MAX_PARTS) parts.shift();
    p.t = 0;
    parts.push(p);
    return p;
  };

  // ── the vocabulary ────────────────────────────────────────────────────────
  // emit: one particle. shape — dot | sq | streak | smoke | shard | star | ring | glyph | bolt.
  // Every field has a default, so a hook writes only what makes its particle its own.
  const fx = {
    get budget() { return budget; },
    rand,
    n: (k) => Math.max(1, Math.round(k * budget)),
    emit(o) {
      return add({
        shape: 'dot', x: 0, y: 0, vx: 0, vy: 0, grav: 0, drag: 0, life: 0.5, r: 4, r1: null,
        color: '#fff', color2: null, alpha: 1, rot: 0, spin: 0, blend: null, layer: 'front',
        w: 2, text: '', ...o,
      });
    },
    // n particles thrown out of (x, y) at `speed`, within `spread` radians of `angle`.
    burst(x, y, n, o = {}) {
      const { speed = 200, spread = TAU, angle = 0, jitter = 0.5, ...rest } = o;
      for (let i = 0, k = fx.n(n); i < k; i++) {
        const a = angle + (spread >= TAU ? (i / k) * TAU + rand(-0.2, 0.2) : rand(-spread / 2, spread / 2));
        const v = speed * (1 - jitter + rand(0, jitter * 2));
        fx.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: a, ...rest });
      }
    },
    ring(x, y, o = {}) { return fx.emit({ shape: 'ring', x, y, r: 6, r1: 90, life: 0.45, w: 4, layer: 'back', ...o }); },
    bolt(x, y, x2, y2, o = {}) { return fx.emit({ shape: 'bolt', x, y, x2, y2, life: 0.18, w: 3, seed: rand(0, 999), ...o }); },
    glyph(x, y, text, o = {}) { return fx.emit({ shape: 'glyph', x, y, text, r: 22, vy: -40, life: 0.9, ...o }); },
    shake(mag, life = 0.3) { if (mag >= cam.shakeMag * (cam.shake / (cam.shakeLife || 1))) { cam.shakeMag = mag; cam.shake = cam.shakeLife = life; } },
    flash(color, alpha = 0.5, life = 0.2) { cam.flash = cam.flashLife = life; cam.flashCol = color; cam.flashA = alpha; },
    tint(color, alpha = 0.18, life = 0.8) { cam.tint = cam.tintLife = life; cam.tintCol = color; cam.tintA = alpha; },
    sound(list) { if (Array.isArray(list) && list.length) synth(list); },

    // ── light and spectacle ──
    // A soft additive light blob — the cheapest way to make anything look like it is glowing.
    glow(x, y, r, color, o = {}) { return fx.emit({ shape: 'glow', x, y, r, color, life: 0.5, blend: 'lighter', layer: 'back', ...o }); },
    // A sunburst of `n` rays spinning out of (x, y).
    rays(x, y, o = {}) { return fx.emit({ shape: 'rays', x, y, n: 14, r: 30, r1: 280, life: 0.6, spin: 1.2, alpha: 0.55, blend: 'lighter', layer: 'back', ...o }); },
    // A thick energy beam from (x, y) to (x2, y2) with a white-hot core, thinning as it dies.
    beam(x, y, x2, y2, o = {}) { return fx.emit({ shape: 'beam', x, y, x2, y2, w: 18, life: 0.35, blend: 'lighter', ...o }); },
    // Paper confetti, flipping as it falls, in the colours given.
    confetti(x, y, n, colors, o = {}) {
      for (let i = 0, k = fx.n(n); i < k; i++) {
        const a = rand(0, TAU), v = rand(120, 460);
        fx.emit({ shape: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220, grav: 520, drag: 1.2,
          r: rand(4, 7), spin: rand(-14, 14), rot: a, life: rand(1, 1.6), color: colors[i % colors.length], ...o });
      }
    },
    // A comic-book word — "בום!" — that pops in big, wobbles and fades. Kids read these first.
    stamp(x, y, text, o = {}) { return fx.emit({ shape: 'stamp', x, y, text, r: 48, vy: -30, life: 1, rot: rand(-0.2, 0.2), color: '#ffe14a', color2: null, edge: '#1b1030', ...o }); },
    // The screen's edges glow in a colour for a while — "a power is on".
    vignette(color, alpha = 0.5, life = 0.8) { cam.vig = cam.vigLife = life; cam.vigCol = color; cam.vigA = alpha; },
    // Paint a light blob right now, from a draw hook (ball/back/front/aura). Counts as light.
    drawGlow(g, x, y, r, color, alpha = 1) { stats.glows++; paintGlow(g, x, y, r, color, alpha); },
  };

  // What every hook is handed. Rebuilt per call so `owner`/`foe` are the right way round.
  function ctx(power, ownerIndex) {
    const owner = M.players[ownerIndex] || M.players[0];
    const foe = M.players[1 - owner.index];
    return {
      t: now(), dt: lastDt, M, C, P: POWERS[power], V: VFX[power], fx, owner, foe, side: owner.side,
      depth: depthPoint, headY: (p) => headY(p), headR: (p) => headR(M, p), TAU,
    };
  }
  const call = (power, hook, ownerIndex, ...args) => {
    const V = VFX[power];
    if (!V || !V[hook] || !M) return;
    try { V[hook](...args, ctx(power, ownerIndex)); } catch (err) { if (globalThis.VFX_STRICT) throw err; }
  };
  // Draw hooks take (g, …, s); the others take (s, …) — same call, the context goes first.
  const callS = (power, hook, ownerIndex, ...args) => {
    const V = VFX[power];
    if (!V || !V[hook] || !M) return;
    try { V[hook](ctx(power, ownerIndex), ...args); } catch (err) { if (globalThis.VFX_STRICT) throw err; }
  };
  const sound = (power, slot) => { const V = VFX[power]; if (V && V.sounds) fx.sound(V.sounds[slot]); };

  function shotEnded(info) {
    if (!shot) return;
    const s = shot; shot = null;
    callS(s.power, 'end', s.owner, info);
    sound(s.power, 'end');
  }

  return {
    VFX, fx, parts, cam,
    stats,
    reset() { parts.length = 0; shot = null; cut = null; dim = 0; live.clear(); cam.shake = cam.flash = cam.tint = cam.vig = 0; },
    // True while a super cut-in is holding the match. game.js does not step the sim meanwhile.
    holding() { return !!(cut && cut.t < CUT_HOLD); },
    bind(m) { if (m !== M) { M = m; this.reset(); } },

    // One sim event. Called by game.js for every event it drains, before it is cleared.
    onEvent(e) {
      if (!M || !M.champ) return;
      if (e.type === 'powershot' && e.champ) {
        if (shot) shotEnded({ kind: 'replaced' });
        const b = M.ball;
        cut = { power: e.champ, owner: e.player, t: 0 };
        callS(e.champ, 'fire', e.player, { x: b.x, y: b.y, countered: !!e.countered });
        sound(e.champ, 'fire');
        if (b.power && b.power.champ === e.champ) shot = { power: e.champ, owner: e.player };
        return;
      }
      if (e.type === 'blocked' && shot) {
        const q = M.players[e.player];
        callS(shot.power, 'impact', shot.owner, { kind: 'blocked', x: q.x, y: headY(q), on: e.player });
        sound(shot.power, 'impact');
        shotEnded({ kind: 'blocked' });
        return;
      }
      if (e.type === 'goal') {
        const b = M.ball;
        // A goal ends every effect in play; each of them gets its impact at the net.
        if (shot && e.power) {
          callS(shot.power, 'impact', shot.owner, { kind: 'goal', x: b.x, y: b.y, scorer: e.player });
          sound(shot.power, 'impact');
          shotEnded({ kind: 'goal' });
        } else if (shot) shotEnded({ kind: 'goal' });
        return;
      }
      if (e.type === 'saved') {
        const power = e.by === 'clone' ? 'clone' : 'goalwall';
        const b = M.ball;
        callS(power, 'impact', e.player, { kind: 'saved', x: b.x, y: b.y });
        sound(power, 'impact');
        if (shot) shotEnded({ kind: 'saved' });
        return;
      }
      const own = OWN_EVENTS[e.type];
      if (own) {
        const owner = e.type === 'stolen' || e.type === 'blown' || e.type === 'teleport' || e.type === 'coinHit'
          ? 1 - e.player : e.player;
        const b = M.ball;
        callS(own, 'impact', owner, { kind: e.type, x: b.x, y: b.y, on: 1 - owner, amount: e.amount });
        sound(own, 'impact');
      }
    },

    // Once per rendered frame: particles, camera, the shot and the effects coming and going.
    update(dt) {
      if (!M) return;
      lastDt = dt;
      slow = slow * 0.95 + (dt > 0.024 ? 0.05 : 0);
      budget = slow > 0.5 ? 0.5 : 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
      for (const k of ['shake', 'flash', 'tint', 'vig']) if (cam[k] > 0) cam[k] = Math.max(0, cam[k] - dt);
      if (cut && (cut.t += dt) >= CUT_LIFE) cut = null;
      // Lights down while any champion power is on the pitch: an effect drawn over a bright
      // backdrop (a sunset carnival) washed out to nothing under the alpha caps. Only the
      // BACKDROP dims — bodies, ball, nets and the DOM heads are all drawn after it.
      if (M.champ) {
        const on = M.champ.effects.find((e) => e.power && e.t < e.life);
        const pw = M.ball.power && M.ball.power.champ ? M.ball.power.champ : null;
        const id = (cut && cut.power) || pw || (on && on.power) || null;
        if (id) { const V = VFX[id]; dimCol = (V && V.palette && V.palette[V.palette.length - 1]) || '#000000'; }
        const want = id ? 1 : 0;
        dim += (want - dim) * Math.min(1, dt * (want ? 8 : 2.5));
        if (dim < 0.002) dim = 0;
      }
      if (!M.champ) return;

      // The shot in the air. The mirror, the tornado and the carry hand the ball over as their
      // own shot, so the one flying may not be the one that was fired.
      const pw = M.ball.power;
      if (pw && pw.champ) {
        if (!shot || shot.power !== pw.champ) { if (shot) shotEnded({ kind: 'handover' }); shot = { power: pw.champ, owner: pw.owner }; }
        call(pw.champ, 'trail', shot.owner, M.ball);
      } else if (shot) shotEnded({ kind: 'spent' });
      for (const eb of M.champ.balls) if (eb.power && eb.power.champ) call(eb.power.champ, 'trail', eb.power.owner, eb);

      // Effects: a new record is the power LANDING; a record that is gone is its aftermath.
      const seen = new Set();
      for (const e of M.champ.effects) {
        if (!e.power || e.t >= e.life) continue;
        seen.add(e.seq);
        if (!live.has(e.seq)) {
          live.set(e.seq, { power: e.power, owner: e.owner, e });
          const q = e.target != null ? M.players[e.target] : null;
          const at = q ? { x: q.x, y: headY(q) } : { x: e.x ?? M.ball.x, y: e.y ?? M.ball.y };
          callS(e.power, 'impact', e.owner, { kind: 'land', e, ...at, on: e.target });
        }
        call(e.power, 'tick', e.owner, e);
      }
      for (const [seq, rec] of live) {
        if (seen.has(seq)) continue;
        live.delete(seq);
        callS(rec.power, 'end', rec.owner, { kind: 'effect', e: rec.e });
        sound(rec.power, 'end');
      }
    },

    // The champion's tell, over the gold armed aura, behind the body.
    drawAura(g, p) {
      if (!M || !M.champ || !p.champ || !(p.armed > 0)) return;
      call(p.champ.power, 'aura', p.index, g, p);
    },
    // Replaces the fireball for a champion shot. False = not ours, draw it the ordinary way.
    drawBall(g, b) {
      const id = b.power && b.power.champ;
      if (!M || !M.champ || !id || !VFX[id] || !VFX[id].ball) return false;
      call(id, 'ball', b.power.owner, g, b);
      return true;
    },
    // Called first thing in the champion back layer, i.e. right over the stadium backdrop.
    drawStageDim(g) {
      if (!(dim > 0)) return;
      g.save();
      g.globalAlpha = 0.58 * dim; g.fillStyle = '#05030c'; g.fillRect(0, 0, C.W, C.H);
      g.globalAlpha = 0.12 * dim; g.fillStyle = dimCol; g.fillRect(0, 0, C.W, C.H);
      g.restore();
    },
    drawEffects(g, layer) {
      if (!M || !M.champ) return;
      const hook = layer === 'back' || layer === 'over' ? layer : 'front';
      for (const e of M.champ.effects) if (e.power && e.t < e.life) call(e.power, hook, e.owner, g, e);
    },
    drawParts(g, layer) { drawParticles(g, parts, layer, now()); },

    // The camera: the translate for a shake, then the flash and grade over the pitch.
    shakeOffset() {
      if (cam.shake <= 0) return null;
      const k = (cam.shake / cam.shakeLife) * cam.shakeMag;
      return [(Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k];
    },
    drawGrade(g) {
      if (cam.tint > 0) {
        const k = Math.min(1, (cam.tint / cam.tintLife) * 3);   // holds, then fades in its last third
        g.save(); g.globalAlpha = cam.tintA * k; g.fillStyle = cam.tintCol; g.fillRect(0, 0, C.W, C.H); g.restore();
      }
      if (cam.vig > 0) {
        const k = Math.min(1, (cam.vig / cam.vigLife) * 2.5);
        const gr = g.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.45, C.W / 2, C.H / 2, C.W * 0.62);
        gr.addColorStop(0, rgba(cam.vigCol, 0));
        gr.addColorStop(1, rgba(cam.vigCol, cam.vigA * k));
        g.save(); g.fillStyle = gr; g.fillRect(0, 0, C.W, C.H); g.restore();
      }
      if (cam.flash > 0) {
        g.save(); g.globalAlpha = cam.flashA * (cam.flash / cam.flashLife); g.fillStyle = cam.flashCol; g.fillRect(0, 0, C.W, C.H); g.restore();
      }
    },

    // THE SUPER CUT-IN. Dim, a sunburst out of the champion, and a band sweeping in from their
    // side with their name and the power's icon; an entry may add its own layer (cutin hook).
    drawCutin(g) {
      if (!cut || !M) return;
      const P = POWERS[cut.power], V = VFX[cut.power] || {};
      const owner = M.players[cut.owner] || M.players[0];
      const k = cut.t / CUT_LIFE;
      const fade = Math.min(1, cut.t / 0.08) * Math.min(1, (CUT_LIFE - cut.t) / 0.35);
      const col = (V.palette && V.palette[0]) || P.color, col2 = (V.palette && V.palette[1]) || P.glow;
      const hx = owner.x, hy = headY(owner);
      g.save();
      g.globalAlpha = 0.42 * fade; g.fillStyle = '#05030a'; g.fillRect(0, 0, C.W, C.H);
      // the sunburst behind the champion
      g.globalCompositeOperation = 'lighter';
      g.translate(hx, hy); g.rotate(cut.t * 1.6);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, L = 520;
        g.globalAlpha = (i % 2 ? 0.2 : 0.34) * fade; g.fillStyle = i % 2 ? col2 : col;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.09) * L, Math.sin(a - 0.09) * L); g.lineTo(Math.cos(a + 0.09) * L, Math.sin(a + 0.09) * L); g.closePath(); g.fill();
      }
      g.restore();
      g.save();
      paintGlow(g, hx, hy, 150, col, 0.8 * fade);
      // the band, sliding in from the champion's side and out the other
      const from = owner.side > 0 ? -1 : 1;
      const ease = k < 0.25 ? 1 - (1 - k / 0.25) ** 3 : 1;
      const out = k > 0.72 ? ((k - 0.72) / 0.28) ** 2 : 0;
      const bx = from * (1 - ease) * C.W - from * out * C.W;
      const by = C.H * 0.34, bh = 84;
      g.globalAlpha = 0.92 * fade;
      g.translate(bx, 0);
      g.fillStyle = '#10081c';
      g.beginPath(); g.moveTo(-20, by - bh / 2 + 10); g.lineTo(C.W + 20, by - bh / 2 - 10); g.lineTo(C.W + 20, by + bh / 2 - 10); g.lineTo(-20, by + bh / 2 + 10); g.closePath(); g.fill();
      g.fillStyle = col; g.fillRect(-20, by - bh / 2 + 2, C.W + 40, 6); g.fillRect(-20, by + bh / 2 - 8, C.W + 40, 6);
      // speed lines through the band
      g.strokeStyle = col2; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const ly = by - bh / 2 + 14 + i * 7, lx = ((i * 131 + cut.t * 1900 * -from) % C.W + C.W) % C.W;
        g.globalAlpha = 0.35 * fade; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 120 * -from, ly); g.stroke();
      }
      g.globalAlpha = fade;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '64px -apple-system, "Apple Color Emoji", Arial';
      g.fillStyle = '#fff'; g.fillText(P.icon, C.W / 2 + from * 250, by + 2);
      const title = owner.champ && owner.champ.title ? owner.champ.title : P.name;
      g.font = '900 46px -apple-system, Arial';
      g.lineWidth = 8; g.strokeStyle = '#1b1030'; g.strokeText(title, C.W / 2 - from * 40, by + 2);
      g.fillStyle = col2; g.fillText(title, C.W / 2 - from * 40, by + 2);
      g.restore();
      if (V.cutin) { try { V.cutin(g, ctx(cut.power, cut.owner), k); } catch (err) { if (globalThis.VFX_STRICT) throw err; } }
    },

    // HUD: what is on each player, as the power's icon on a dark SQUARE badge with a bar that
    // runs down with the time it has left — the "cooldown" of an effect is how long it has to go.
    // Square on purpose: a round white-rimmed badge (time stop's colour is near-white) read as a
    // second ball hanging over the head.
    drawStatus(g) {
      if (!M || !M.champ) return;
      const t = now();
      g.save();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const p of M.players) {
        const on = [];
        for (const e of M.champ.effects) {
          if (e.target !== p.index || !e.power || e.t >= e.life) continue;
          if (!on.some((o) => o.power === e.power)) on.push({ power: e.power, left: 1 - e.t / e.life });
        }
        if (!on.length) continue;
        const d = depthPoint(p.x, headY(p));
        const w = 34, y = d.y - headR(M, p) - 26 + Math.sin(t * 5) * 2;
        on.forEach((o, i) => {
          const P = POWERS[o.power];
          const x = d.x + (i - (on.length - 1) / 2) * (w + 6);
          g.globalAlpha = 0.85; g.fillStyle = '#0b0710';
          badge(g, x - w / 2, y - w / 2, w, w + 8, 7); g.fill();
          g.globalAlpha = 1; g.strokeStyle = P.color; g.lineWidth = 3;
          badge(g, x - w / 2, y - w / 2, w, w + 8, 7); g.stroke();
          g.font = '20px -apple-system, "Apple Color Emoji", Arial';
          g.fillStyle = '#fff'; g.fillText(P.icon, x, y);
          g.fillStyle = P.color;
          g.fillRect(x - w / 2 + 5, y + w / 2 + 1, (w - 10) * Math.max(0, o.left), 4);
        });
      }
      g.restore();
    },
  };
}

// '#rrggbb' → 'rgba(r,g,b,a)'. Anything else passes through (it is already a colour).
function rgba(c, a) {
  if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) return c;
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// A light blob is a radial gradient, and gradients are the expensive thing on a phone — so each
// colour is painted ONCE into a small sprite and stamped from then on. Where there is no canvas
// to paint into (the Node tests) it falls back to a flat translucent disc.
const SPRITES = new Map();
function glowSprite(color) {
  if (SPRITES.has(color)) return SPRITES.get(color);
  let cv = null;
  try {
    cv = globalThis.OffscreenCanvas ? new OffscreenCanvas(64, 64) : globalThis.document ? globalThis.document.createElement('canvas') : null;
    if (cv) {
      cv.width = cv.height = 64;
      const x = cv.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.3, rgba(color, 0.55)); gr.addColorStop(1, rgba(color, 0));
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    }
  } catch { cv = null; }
  SPRITES.set(color, cv);
  return cv;
}
function paintGlow(g, x, y, r, color, alpha) {
  if (!(r > 0)) return;
  const spr = glowSprite(color);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  if (spr) g.drawImage(spr, x - r, y - r, r * 2, r * 2);
  else { g.globalAlpha *= 0.35; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.restore();
}

function badge(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ── drawing the particles ───────────────────────────────────────────────────
function drawParticles(g, parts, layer, t) {
  for (const p of parts) {
    if (p.layer !== layer) continue;
    const k = 1 - p.t / p.life;                       // 1 → 0 over its life
    const r = p.r1 == null ? p.r : p.r + (p.r1 - p.r) * (1 - k);
    g.save();
    if (p.blend) g.globalCompositeOperation = p.blend;
    g.globalAlpha = Math.max(0, Math.min(1, p.alpha * (p.shape === 'ring' ? k : Math.min(1, k * 1.6))));
    const col = p.color2 && k < 0.5 ? p.color2 : p.color;
    g.fillStyle = col; g.strokeStyle = col;
    switch (p.shape) {
      case 'sq': g.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), Math.max(1, r), Math.max(1, r)); break;
      case 'streak': {
        const sp = Math.hypot(p.vx, p.vy) || 1, L = Math.max(r * 2, sp * 0.05);
        g.lineWidth = p.w; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L); g.stroke();
        break;
      }
      case 'smoke':
        g.globalAlpha *= 0.55;
        g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, r), 0, TAU); g.fill();
        break;
      case 'shard':
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.6, r * 0.45); g.lineTo(-r * 0.6, -r * 0.45); g.closePath(); g.fill();
        break;
      case 'star':
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? r * 0.3 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill();
        break;
      case 'ring':
        g.lineWidth = Math.max(0.5, p.w * k + 0.5);
        g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, r), 0, TAU); g.stroke();
        break;
      case 'glyph':
        g.font = `900 ${Math.round(r)}px -apple-system, "Apple Color Emoji", Arial`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillText(p.text, 0, 0);
        break;
      case 'bolt': {
        // Lightning: a jagged line re-rolled a few times a second from its seed, so it crackles.
        const n = 7, seed = p.seed + Math.floor(t * 24);
        g.lineWidth = p.w; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(p.x, p.y);
        for (let i = 1; i < n; i++) {
          const f = i / n, j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
          const off = ((j - Math.floor(j)) - 0.5) * 26;
          g.lineTo(p.x + (p.x2 - p.x) * f + off, p.y + (p.y2 - p.y) * f + off * 0.6);
        }
        g.lineTo(p.x2, p.y2); g.stroke();
        break;
      }
      case 'glow':
        g.restore();
        paintGlow(g, p.x, p.y, r, col, p.alpha * k);
        continue;
      case 'rays': {
        g.translate(p.x, p.y); g.rotate(p.rot);
        const n = p.n || 12;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, w = 0.5 / n * TAU * 0.5;
          g.fillStyle = i % 2 && p.color2 ? p.color2 : p.color;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * r, Math.sin(a - w) * r); g.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r); g.closePath(); g.fill();
        }
        break;
      }
      case 'beam': {
        g.lineCap = 'round';
        g.lineWidth = Math.max(1, p.w * k);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x2, p.y2); g.stroke();
        g.strokeStyle = p.color2 || '#ffffff'; g.lineWidth = Math.max(1, p.w * k * 0.35);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x2, p.y2); g.stroke();
        break;
      }
      case 'confetti': {
        g.translate(p.x, p.y); g.rotate(p.rot);
        const f = Math.abs(Math.cos(p.rot * 2 + p.t * 9));
        g.fillRect(-r, -r * 0.5 * f, r * 2, Math.max(1, r * f));
        break;
      }
      case 'stamp': {
        // pops in 1.35x, settles to 1x, wobbles
        const age = p.t, sc = age < 0.1 ? (age / 0.1) * 1.35 : age < 0.22 ? 1.35 - ((age - 0.1) / 0.12) * 0.35 : 1;
        g.translate(p.x, p.y); g.rotate(p.rot + Math.sin(age * 18) * 0.04); g.scale(sc, sc);
        g.font = `900 ${Math.round(r)}px -apple-system, Arial`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = Math.max(4, r * 0.2); g.strokeStyle = p.edge || '#1b1030';
        g.strokeText(p.text, 0, 0);
        g.fillStyle = p.color; g.fillText(p.text, 0, 0);
        break;
      }
      default:
        g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, r), 0, TAU); g.fill();
    }
    g.restore();
  }
}
