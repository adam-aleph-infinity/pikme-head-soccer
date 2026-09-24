// POWER-SHOT VFX — how a Head Soccer power shot LOOKS, and nothing else.
//
// shared/hs-powers.js decides what a shot does; this file only watches the match (the ball's
// `power`, each player's `armed` and `ail`, `m.cutin`, and the sim's events) and draws. It writes
// nothing back, so it cannot reach the sim, the bot, the server or an online room.
//
// Idan's rule: EXACTLY Head Soccer, nothing the footage does not show (docs/HS-POWER-SHOTS.md).
// So the whole vocabulary is:
//   the press    — a thin crackling gold rim round the armed player, flame tongues off the crown
//                  (§1)                                                          drawArmed
//   the cut-in   — 1.34s: the screen darkens, a white disc and gold halo behind the shooter's head,
//                  8 gold and 8 white rays turning slowly; no text, no zoom (§2)   drawCutin
//   the shot     — the comet on its family's path (public/vfx/families.js, §3)   drawBall
//   the defender — block: a crackling spark burst for the grind (§4); hit: red spark droplets and
//                  the ball's after-images (§4); dazed: three gold stars; other ailments: one plain
//                  shape each (public/vfx/ailments.js)                           drawOver / drawOverlay
// No shakes, flashes, grades, rings, words or confetti: HS has none of them.

import * as C from '../shared/constants.js';
import { headY, headR } from '../shared/sim.js';
import { depthPoint } from '../shared/goalbox.js';
import { FAMILY_ORDER, AILMENT_ORDER } from '../shared/hs-powers.js';
import { FAMILY_VFX, drawGrind } from './vfx/families.js';
import { AILMENT_VFX } from './vfx/ailments.js';

export { FAMILY_VFX, AILMENT_VFX };
// The canvas reaches above world y=0 (game.js SKY_TOP: the camera keeps C.VIEW_ABOVE_GROUND of
// sky). The cut-in's dark has to cover that strip too; the canvas clips whatever is spare.
const SKY_PAD = Math.max(0, (C.VIEW_ABOVE_GROUND || 0) - C.GROUND_Y) + 8;
const TAU = Math.PI * 2;
const HIST = 20;                         // path points kept per ball (the tail is ≤ 340 px)
const HIT_GHOSTS = 0.4;                  // s the after-images follow a HIT ball (§4 M4 43.33–43.6)

// `drawBall(g, b)` is the client's own ball painter: the cut-in repaints the power ball with it
// OVER the dark, as HS does (the comet flies bright across a darkened pitch, M4 43.07 s).
export function createVfx({ now = () => performance.now() / 1000, drawBall: paintBall = null } = {}) {
  let M = null;
  const track = new Map();               // ball → { hist, t0 (release, on the SIM clock m.t), ph, ghost }
  const drops = [];                      // the hit's red spark droplets (§4) — the only particles
  const stats = { balls: 0, drops: 0 };  // what was drawn (tests)

  const rec = (b) => { let r = track.get(b); if (!r) { r = { hist: [], t0: M.t, ph: '', ghost: 0 }; track.set(b, r); } return r; };
  const balls = () => (M ? [M.ball, ...(M.xballs || [])] : []);

  return {
    stats, track, drops,
    reset() { track.clear(); drops.length = 0; },
    bind(m) { if (m !== M) { M = m; this.reset(); } },
    // The cut-in is the sim's own pause now (m.cutin); nothing on the client holds the match.
    holding() { return false; },

    onEvent(e) {
      if (!M) return;
      if (e.type === 'powershot') {
        for (const b of balls()) if (b.power) { const r = rec(b); r.hist.length = 0; r.t0 = M.t + (M.cutin > 0 ? Math.max(0, M.cutin - C.POWER_RELEASE) : 0); r.ph = b.power.ph; }
      } else if (e.type === 'rebound' || e.type === 'delayGo') {
        const r = rec(M.ball); r.hist.length = 0; r.t0 = M.t;
      } else if (e.type === 'powerHit' && e.how !== 'pass') {
        // §4 M4 43.33: red spark droplets burst at the impact…
        const x = e.x ?? M.ball.x, y = e.y ?? M.ball.y;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.45 + (Math.random() - 0.5) * 0.3, v = 140 + Math.random() * 120;
          drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.15 });
        }
        // …and the ball's after-images follow it on.
        const r = rec(M.ball); r.ghost = HIT_GHOSTS;
      }
    },

    // Once per rendered frame: record each ball's path on screen, run the droplets.
    update(dt) {
      if (!M) return;
      const live = new Set();
      for (const b of balls()) {
        const r = track.get(b);
        if (!b.power && !(r && r.ghost > 0)) continue;
        const q = rec(b);
        live.add(b);
        if (b.power) {
          // A shot that starts moving again (the Aerial's dive, the Delay's burst) is a new release.
          if (b.power.ph !== q.ph) { if (b.power.ph === 'dive') { q.hist.length = 0; q.t0 = M.t; } q.ph = b.power.ph; }
        }
        if (!b.power || b.power.hit) q.ghost -= dt;
        const d = depthPoint(b.x, b.y);
        const h = q.hist;
        if (!h.length || Math.hypot(h[0].x - d.x, h[0].y - d.y) > 0.5) { h.unshift({ x: d.x, y: d.y }); if (h.length > HIST) h.length = HIST; }
      }
      for (const b of [...track.keys()]) if (!live.has(b)) track.delete(b);
      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i];
        p.t += dt;
        if (p.t >= p.life) { drops.splice(i, 1); continue; }
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
    },

    // UNDER the ball (game.js drawBall calls this, then draws the ball itself on top — the filmed
    // comet has the plain ball at its nose). Returns true when the ball must not be drawn (it is up
    // off the top of the screen).
    drawBall(g, b) {
      const pw = b.power;
      if (!M || !pw) return false;
      // Until 0.97s into the cut-in the ball has not left: HS shows it hanging by the shooter's
      // head, no tail (§2) — then it flies under the dark. A ball carried on through a HIT is drawn
      // as its after-images, not a comet (§4).
      if (M.cutin > C.POWER_RELEASE || pw.hit) return false;
      const V = FAMILY_VFX[pw.fam] || FAMILY_VFX.straight;
      const r = track.get(b);
      const d = depthPoint(b.x, b.y);
      stats.balls++;
      V.draw(g, b, { t: r ? Math.max(0, M.t - r.t0) : 0, now: now(), hist: r ? r.hist : null, x: d.x, y: d.y, r: b.r, pw, groundY: C.GROUND_Y });
      return pw.ph === 'wait';
    },

    // OVER the ball, on the pitch: the block's grind, the Aerial's warning, the hit's droplets and
    // the after-images of a hit ball.
    drawOver(g) {
      if (!M) return;
      const t = now();
      for (const b of balls()) {
        const pw = b.power;
        if (pw && pw.ph === 'grind') { const d = depthPoint(b.x, b.y); drawGrind(g, d.x, d.y, t); }
        if (pw && pw.ph === 'wait' && FAMILY_VFX.aerial.warn) FAMILY_VFX.aerial.warn(g, { pw, now: t });
        const r = track.get(b);
        if ((!pw || pw.hit) && r && r.ghost > 0 && r.hist.length > 3) {
          g.save();
          for (let i = 1; i <= 4; i++) {
            const h = r.hist[i * 2]; if (!h) break;
            g.globalAlpha = (0.34 - i * 0.07) * Math.min(1, r.ghost / 0.15);
            g.fillStyle = '#ffffff'; g.strokeStyle = '#1b2436'; g.lineWidth = 1.5;
            g.beginPath(); g.arc(h.x, h.y, b.r, 0, TAU); g.fill(); g.stroke();
          }
          g.restore();
        }
      }
      if (drops.length) {
        g.save(); g.fillStyle = '#ff2a1a';
        for (const p of drops) { g.globalAlpha = 1 - p.t / p.life; g.beginPath(); g.arc(p.x, p.y, 3.2, 0, TAU); g.fill(); }
        g.restore();
        stats.drops += drops.length;
      }
    },

    // THE PRESS (§1), on the layer above the heads: a thin bright rim round the head and the body,
    // and 2–4 jagged flame tongues off the crown and shoulders, re-rolled every frame so it crackles.
    drawArmed(g, p) {
      if (!M || !(p.armed > 0)) return;
      const h = depthPoint(p.x, headY(p)), f = depthPoint(p.x, p.y);
      const r = headR(M, p);
      g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
      // the rim
      g.strokeStyle = '#ffb800'; g.lineWidth = 9; g.globalAlpha = 0.35;          // the soft glow…
      g.beginPath(); g.arc(h.x, h.y, r + 3, 0, TAU); g.stroke();
      g.strokeRect(f.x - C.BODY_W / 2 - 3, f.y - C.BODY_H - 2, C.BODY_W + 6, C.BODY_H + 3);
      g.strokeStyle = '#ffd23c'; g.lineWidth = 4; g.globalAlpha = 0.95;          // …and the rim
      g.beginPath(); g.arc(h.x, h.y, r + 2, 0, TAU); g.stroke();
      g.strokeRect(f.x - C.BODY_W / 2 - 2, f.y - C.BODY_H - 1, C.BODY_W + 4, C.BODY_H + 2);
      g.strokeStyle = '#fffbe0'; g.lineWidth = 1.3; g.globalAlpha = 1;
      g.beginPath(); g.arc(h.x, h.y, r + 1.5, 0, TAU); g.stroke();
      // the tongues: crown and shoulders, about half a head tall
      const roots = [-1.95, -1.57, -1.2, -2.6, -0.55];
      const n = 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = roots[(i + Math.floor(Math.random() * roots.length)) % roots.length];
        const x0 = h.x + Math.cos(a) * r, y0 = h.y + Math.sin(a) * r;
        const L = r * (0.5 + Math.random() * 0.4);
        g.strokeStyle = i % 2 ? '#fffbe0' : '#ffd23c'; g.lineWidth = i % 2 ? 2 : 3.2;
        g.beginPath(); g.moveTo(x0, y0);
        for (let k = 1; k <= 3; k++) {
          const s = k / 3;
          g.lineTo(x0 + Math.cos(a) * L * s * 0.5 + (Math.random() - 0.5) * 7, y0 - L * s + Math.sin(a) * L * s * 0.3);
        }
        g.stroke();
      }
      g.restore();
    },

    // THE AILMENTS, on the layer above the heads (a stunned player with no ailment has no shape:
    // the block's grind holds him and shows the spark burst instead).
    drawOverlay(g) {
      if (!M) return;
      const t = now();
      for (const p of M.players) {
        if (!p.ail || !AILMENT_VFX[p.ail]) continue;
        // A dazed player's three stars are game.js's (drawOverHeads draws them for any stun).
        if (p.ail === 'stars' && p.stunned > 0) continue;
        const h = depthPoint(p.x, headY(p)), f = depthPoint(p.x, p.y);
        AILMENT_VFX[p.ail].draw(g, p, { t, hx: h.x, hy: h.y, r: headR(M, p), fy: f.y });
      }
    },

    // THE CUT-IN (§2), over everything, heads included. The pause is the sim's (m.cutin, 1.34s);
    // this is the picture: the pitch 55→65% darker with the shooter left in a pool of light, a
    // white disc ≈ 1.6 head radii with a gold halo to ≈ 2.2 behind the head (the DOM head covers
    // its middle), and 8 wide gold rays alternating with 8 thin white ones, ≈ 190px long, widest at
    // the far end, turning at 0.5 rad/s. They grow in over the first 0.1s; it all lifts over the
    // last 0.1s. No text, no band, no zoom.
    drawCutin(g) {
      if (!M || !(M.cutin > 0) || !(M.cutinBy >= 0)) return;
      const p = M.players[M.cutinBy];
      if (!p) return;
      const T = C.POWER_CUTIN, el = T - M.cutin;                // seconds into the cut-in
      const fade = Math.min(1, el / 0.08) * Math.min(1, M.cutin / 0.1);
      // The rays and the disc go with the ball: gone 0.1s after it leaves (M4 41.50 → 41.57 s),
      // while the dark stays down to the end.
      const glow = fade * Math.max(0, Math.min(1, (M.cutin - C.POWER_RELEASE + 0.1) / 0.1));
      const grow = Math.min(1, 0.3 + el / 0.1 * 0.7);
      const h = depthPoint(p.x, headY(p));
      const r = headR(M, p);
      const dark = 0.55 + 0.1 * Math.min(1, el / 1.0);
      g.save();
      const gr = g.createRadialGradient(h.x, h.y, r * 1.2, h.x, h.y, r * 7);
      gr.addColorStop(0, 'rgba(4,3,10,0)');
      gr.addColorStop(0.35, `rgba(4,3,10,${(dark * 0.8).toFixed(3)})`);
      gr.addColorStop(1, `rgba(4,3,10,${dark.toFixed(3)})`);
      g.globalAlpha = fade; g.fillStyle = gr; g.fillRect(0, -SKY_PAD, C.W, C.H + SKY_PAD + 40);
      g.restore();
      // the shot, bright over the dark once it has left
      if (paintBall && M.cutin <= C.POWER_RELEASE) for (const b of balls()) if (b.power) paintBall(g, b);
      if (!(glow > 0)) return;
      g.save();
      // the rays
      g.globalCompositeOperation = 'lighter';
      g.translate(h.x, h.y);
      g.rotate(el * 0.5);
      const L = 190 * grow, r0 = r * 1.5;
      for (let i = 0; i < 16; i++) {
        const gold = i % 2 === 0;
        const a = (i / 16) * TAU;
        const len = L * (gold ? 1 : 0.75) * (0.88 + 0.12 * Math.sin(el * 9 + i * 1.7));
        const w = gold ? 32 : 9;                                  // half-width at the far end, px
        const lg = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        lg.addColorStop(0, gold ? 'rgba(255,214,70,0.85)' : 'rgba(255,255,255,0.8)');
        lg.addColorStop(1, gold ? 'rgba(255,190,40,0)' : 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.globalAlpha = glow;
        const px = -Math.sin(a), py = Math.cos(a);
        g.beginPath();
        g.moveTo(Math.cos(a) * r0 + px * 3, Math.sin(a) * r0 + py * 3);
        g.lineTo(Math.cos(a) * len + px * w, Math.sin(a) * len + py * w);
        g.lineTo(Math.cos(a) * len - px * w, Math.sin(a) * len - py * w);
        g.lineTo(Math.cos(a) * r0 - px * 3, Math.sin(a) * r0 - py * 3);
        g.closePath(); g.fill();
      }
      g.restore();
      // the disc and its halo, round the head
      g.save();
      g.globalAlpha = glow;
      const dg = g.createRadialGradient(h.x, h.y, r * 0.9, h.x, h.y, r * 2.25 * grow + r * 0.1);
      dg.addColorStop(0, 'rgba(255,255,255,1)');
      dg.addColorStop(0.45, 'rgba(255,252,220,0.95)');
      dg.addColorStop(0.7, 'rgba(255,200,60,0.6)');
      dg.addColorStop(1, 'rgba(255,180,30,0)');
      g.fillStyle = dg;
      g.beginPath(); g.arc(h.x, h.y, r * 2.35, 0, TAU); g.arc(h.x, h.y, r * 0.98, 0, TAU, true); g.fill();
      g.restore();
    },
  };
}

// For the tests and the screenshot harness: every family and ailment has a renderer.
export const FAMILIES_DRAWN = FAMILY_ORDER.filter((f) => FAMILY_VFX[f] && typeof FAMILY_VFX[f].draw === 'function');
export const AILMENTS_DRAWN = AILMENT_ORDER.filter((a) => AILMENT_VFX[a] && typeof AILMENT_VFX[a].draw === 'function');
