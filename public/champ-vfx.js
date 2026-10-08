// POWER-SHOT VFX — how a Head Soccer power shot LOOKS, and nothing else.
//
// shared/hs-powers.js decides what a shot does; this file only watches the match (the ball's
// `power`, each player's `armed` and `ail`, `m.cutin`, and the sim's events) and draws. It writes
// nothing back, so it cannot reach the sim, the bot, the server or an online room.
//
// Idan's rule: EXACTLY Head Soccer, nothing the footage does not show (docs/HS-POWER-SHOTS.md).
// So the whole vocabulary is:
//   the press    — a yellow glow hugging the whole silhouette, head and body, behind it, and
//                  thin electric wisps crackling off it (§1)                    drawArmed
//   the cut-in   — 1.34s: the screen darkens, a white disc and golden halo ring behind the
//                  shooter's head, 8 gold and 8 soft rays turning slowly; no text, no zoom (§2)
//   the shot     — the comet on its family's path (public/vfx/families.js, §3), or a champion's
//                  own power (public/vfx/powers/)                                 drawBall
//   the defender — block: a glowing orb with spark shards flying off it for the grind (§4); hit:
//                  red droplets and the ball's after-images (§4); dazed: three gold stars;
//                  other ailments: public/vfx/ailments.js                     drawOver / drawOverlay
// No shakes, flashes, grades, words or confetti: HS has none of them.
//
// HOW IT IS PAINTED (public/vfx/fx-kit.js): every piece is a texture painted once offscreen
// (soft falloffs, white-hot cores, streak noise, bloom) and blitted, mostly additively. The game's
// own canvas is half resolution and upscaled pixelated (the pixel-art look of the pitch); soft
// light cannot survive that, so in the game these effects go on two FULL-resolution layers
// (useLayers): UNDER the DOM heads — the cut-in's dark, rays and disc, so the shooter's head sits
// on the disc as in HS — and OVER them — shots, glows, bursts, stars, ailments. Without layers
// (the tests, the old harnesses) everything draws on whatever canvas it is handed, as before.

import * as C from '../shared/constants.js';
import { headY, headR } from '../shared/sim.js';
import { depthPoint } from '../shared/goalbox.js';
import { FAMILY_ORDER, AILMENT_ORDER } from '../shared/hs-powers.js';
import { FAMILY_VFX, drawGrind, drawFist } from './vfx/families.js';
import { AILMENT_VFX } from './vfx/ailments.js';
import { POWER_VFX } from './vfx/powers/index.js';
import { drawArmedGlow, drawStars, headPath, blit, glow, spark, ghostBall, armedGlowTex, sideFlameJobs, auraTex, starTex, orbitTex, bubble, LIVE, TAU } from './vfx/fx-kit.js';
import { drawRays, drawDisc, cutTimeline, goldRay, softRay, disc, halo } from './vfx/cutin.js';

export { FAMILY_VFX, AILMENT_VFX, POWER_VFX };
// The canvas reaches above world y=0 (game.js SKY_TOP: the camera keeps C.VIEW_ABOVE_GROUND of
// sky). The cut-in's dark has to cover that strip too; the canvas clips whatever is spare.
const SKY_PAD = Math.max(0, (C.VIEW_ABOVE_GROUND || 0) - C.GROUND_Y) + 8;
const HIST = 20;                         // path points kept per ball (the tail is ≤ 340 px)
const HIT_GHOSTS = 0.4;                  // s the after-images follow a HIT ball (§4 M4 43.33–43.6)
const DARK_RGB = '4,3,10';

// `drawBall(g, b)` is the client's own ball painter: the cut-in repaints the power ball with it
// OVER the dark, as HS does (the comet flies bright across a darkened pitch, M4 43.07 s).
// `drawBody(g, p)` is the client's body painter: the shooter's body goes back over the cut-in's
// disc (HS: the whole sprite stands on the white disc, M4 40.75 s).
// `me()` is the seat this screen plays (a champion power can look different to its shooter —
// USA's invisible ball is "translucent to whoever uses the shot").
// A champion's OWN power (shared/champion-powers.js, a `cp` on the ball's power) is drawn by its
// renderer in public/vfx/powers/ instead of its family's comet; a block's rebound is the plain shot.
const EVENT_VFX = Object.values(POWER_VFX).filter((P) => typeof P.event === 'function');
const powerVfx = (pw) => (pw && pw.cp && !pw.rb ? POWER_VFX[pw.cp] || null : null);
// Paint every texture ahead of time, a piece per idle slice, so the first press or shot never
// stalls a frame (each is a one-off per-pixel paint of a few ms).
function warmTextures() {
  if (!LIVE || typeof setTimeout !== 'function') return;
  const KB = (C.BODY_H + C.HEAD_R - C.NECK) / C.HEAD_R;       // a standing player's feet, in head radii
  const jobs = [() => armedGlowTex(KB), ...sideFlameJobs(), auraTex, () => glow('#ffd21a', 0.02), starTex, orbitTex, goldRay, softRay, disc, () => halo(0), () => halo(1), ghostBall,
    () => spark('#ffd21a'), () => spark('#ffe14a'), () => glow('#ff2a14', 0.05), () => glow('#ffd21a', 0.3), bubble, ...Object.values(POWER_VFX).filter((P) => P.warm).map((P) => () => P.warm())];
  const idle = typeof requestIdleCallback === 'function' ? (f) => requestIdleCallback(f, { timeout: 500 }) : (f) => setTimeout(f, 16);
  // a job answering false is not finished (a texture painted in slices): it runs again next time
  // Each idle slice runs as many small jobs as its spare time allows (≈ 3 ms kept back), at least one.
  const next = (dl) => {
    let n = 0;
    do {
      const j = jobs[0]; if (!j) return;
      let done = true; try { done = j() !== false; } catch {} if (done) jobs.shift();
    } while (jobs.length && dl && typeof dl.timeRemaining === 'function' && dl.timeRemaining() > 3 && ++n < 400);
    if (jobs.length) idle(next);
  };
  setTimeout(() => idle(next), 400);
}
let warmed = false;

export function createVfx({ now = () => performance.now() / 1000, drawBall: paintBall = null, drawBody: paintBody = null, me = () => 0, headPose = null } = {}) {
  if (!warmed) { warmed = true; warmTextures(); }
  let M = null;
  let layered = false;                   // game.js drew us our own two hi-res layers (useLayers)
  let onTop = false;                     // painting the top layer now (paintBall calls back into drawBall)
  const dirty = { under: true, top: true };
  const track = new Map();               // ball → { hist, t0 (release, on the SIM clock m.t), ph, ghost }
  const drops = [];                      // the hit's red droplets (§4)
  const shards = [];                     // the block's spark shards (§4 M4 61.5–62.1 s)
  const bursts = [];                     // a champion power's one-off bursts (the Mythic Gem's shatter)
  const ailCol = [];                     // per player: the colour of what crusted him (the gem's)
  const stats = { balls: 0, drops: 0 };  // what was drawn (tests)
  const lastCut = { by: -1, at: 0 };     // the cut-in that just ended, for the dark's fade-out

  // a plain ball anywhere (a renderer's fakes and orbiting balls), in the game's own art
  const ballAt = paintBall ? (g, x, y) => paintBall(g, { x, y, r: C.BALL_R, vx: 0, vy: 0, spin: 0, power: null, fake: true }) : null;
  const rec = (b) => { let r = track.get(b); if (!r) { r = { hist: [], t0: M.t, ph: '', ghost: 0 }; track.set(b, r); } return r; };
  const balls = () => (M ? [M.ball, ...(M.xballs || [])] : []);
  // inside a net the ball is drawn between the nets on the game's canvas; its light stays up here
  const inGoal = (b) => depthPoint(b.x, b.y).z > 0;

  // the block's burst, the Grab's fist, the Aerial's lances, the hit's droplets and after-images
  function pitchFx(g) {
    const t = now();
    for (const b of balls()) {
      const pw = b.power;
      if (pw && pw.ph === 'grind') { const d = depthPoint(b.x, b.y); drawGrind(g, d.x, d.y, t); }
      // the Grab's fist round the seized player's body, its arm back to the shooter (§3 M3 74.15 s)
      if (pw && pw.ph === 'grab' && M.players[pw.tgt] && M.players[pw.owner]) {
        const q = M.players[pw.tgt], a = M.players[pw.owner];
        const f = depthPoint(q.x, q.y - 34), o = depthPoint(a.x, headY(a));
        drawFist(g, f.x, f.y, pw.dir, o.x, o.y, t);
      }
      if (pw && pw.fam === 'aerial' && (pw.ph === 'wait' || pw.ph === 'dive')) FAMILY_VFX.aerial.warn(g, { pw, now: t });
      const r = track.get(b);
      // the hit ball's after-images: soft motion-blurred copies of it down its path (§4)
      if ((!pw || pw.hit) && r && r.ghost > 0 && r.hist.length > 3) {
        const gb = ghostBall(), k = Math.min(1, r.ghost / 0.15);
        for (let i = 4; i >= 1; i--) {
          const h = r.hist[i * 2]; if (!h) continue;
          blit(g, gb, h.x, h.y, b.r * 2.7, b.r * 2.7, 0, (0.5 - i * 0.1) * k, false);
        }
      }
    }
    // the block's shards: yellow spears of light shooting out of the orb
    if (shards.length) {
      const sp = spark('#ffd21a');
      for (const s of shards) {
        const f = s.t / s.life, v = Math.hypot(s.vx, s.vy) || 1;
        blit(g, sp, s.x, s.y, s.len * (1 - 0.4 * f), 20, Math.atan2(s.vy, s.vx), (1 - f * f), true, 1, 0.5);
      }
    }
    // a power's own bursts (its renderer's `event` made them)
    for (const fx of bursts) fx.draw(g, fx.t);
    // the hit's droplets: soft red blobs thrown up and falling (§4 M4 43.33, 80.85 s)
    if (drops.length) {
      const gl = glow('#ff2a14', 0.05);
      for (const p of drops) { const f = p.t / p.life; blit(g, gl, p.x, p.y, 16 * (1 - 0.3 * f), 14 * (1 - 0.3 * f), 0, 1 - f, false); }
      stats.drops += drops.length;
    }
  }

  // a champion power's pieces above the heads (Japan's log where he stood)
  function overHeads(g) {
    for (const b of balls()) {
      const pw = b.power, P = powerVfx(pw);
      if (!P || !P.over || !M.players[pw.owner]) continue;
      const a = M.players[pw.owner], f = depthPoint(a.x, a.y), r = track.get(b);
      const d = depthPoint(b.x, b.y);
      P.over(g, { pw, now: now(), px: f.x, pfy: f.y, pr: headR(M, a), sinceTouch: r && r.touch != null ? now() - r.touch : 9, x: d.x, y: d.y, r: b.r });
    }
  }

  // The shot's own picture, for one power ball, on `g` (no ball).
  function shotFx(g, b) {
    const pw = b.power, P = powerVfx(pw);
    const V = P || FAMILY_VFX[pw.fam] || FAMILY_VFX.straight;
    const r = track.get(b);
    const d = depthPoint(b.x, b.y);
    stats.balls++;
    const f0 = depthPoint(pw.x0, pw.y0);
    const hide = V.draw(g, b, { t: r ? Math.max(0, M.t - r.t0) : 0, now: now(), hist: r ? r.hist : null, x: d.x, y: d.y, r: b.r, pw, groundY: C.GROUND_Y, fx: f0.x, fy: f0.y, me: me(), ball: ballAt });
    return P ? !!hide : pw.ph === 'wait';
  }
  // Whether this power ball has a moving shot picture right now (vs. hanging, pinned, hit…).
  function shotLive(b) {
    const pw = b.power;
    if (!pw) return false;
    if (M.cutin > C.POWER_RELEASE || pw.hit) return false;
    return !(pw.ph === 'grind' || pw.ph === 'rest' || pw.ph === 'hold' || pw.ph === 'grab');
  }

  // The cut-in's timing (docs/HS-POWER-VFX-RESEARCH.md §5, frames at 60 fps from the touch):
  // the dark comes down in a straight line from f3 to f21, to ≈ 21 % of the pitch's brightness
  // (M4 stands luma 112 → 24), holds, and goes back up in a straight line from 0.075 s after the
  // ball leaves to 0.39 s after (half-up at 1.50 s = the sim's cut-in end, POWER_CUTIN).
  const DARK_MAX = 0.79;
  function cutState() {
    let el;
    const rel = C.POWER_CUTIN - C.POWER_RELEASE;          // the ball leaves (1.27 s)
    const tail = 0.39 - C.POWER_RELEASE;                  // the lift's wall-clock end past the sim's
    if (M.cutin > 0 && M.cutinBy >= 0) {
      el = C.POWER_CUTIN - M.cutin;
      lastCut.by = M.cutinBy; lastCut.at = now();
    } else {
      const since = now() - lastCut.at;
      if (!(lastCut.by >= 0) || since >= tail || since < 0) { lastCut.by = -1; return null; }
      el = C.POWER_CUTIN + since;
    }
    const p = M.players[M.cutin > 0 ? M.cutinBy : lastCut.by];
    if (!p) return null;
    const down = Math.min(1, Math.max(0, (el - 3 / 60) / (18 / 60)));
    const up = Math.min(1, Math.max(0, (el - rel - 0.075) / 0.315));
    const fade = down * (1 - up);
    const T = cutTimeline(el * 60, rel * 60);
    const h = depthPoint(p.x, headY(p));
    return { el, fade, T, glow: T.out, dark: DARK_MAX * fade, p, q: M.players[1 - p.index], h, r: headR(M, p) };
  }
  // THE SHOOTER'S WIND-UP (§5), the head's angle frame by frame (M4 40.20 s, a rotated template
  // of the head matched on every frame; + is tipped back, face up): back smoothly f5 → f13 to 59°,
  // held ≈ 53°; at f53 it WHIPS FORWARD like a header — ≈ 60° forward at f54–55, springing back
  // to 15° at f57 — and settles 27° forward from f59, through the release (f76), until f89; then
  // it eases upright by f101. One face, only the tilt (Idan). Radians, signed like game.js
  // reelTilt (the crown goes back, away from his front).
  const TILT_K = [[4, 0], [5, 7], [6, 25], [7, 33], [8, 39], [9, 45], [10, 51], [11, 55], [13, 59], [16, 59], [22, 53],
    [52, 53], [53, 0], [54, -58], [55, -60], [56, -31], [57, -15], [58, -21], [59, -27], [89, -27], [92, -20], [95, -11], [98, -5], [101, 0]];
  const tiltCut = { by: -1, f: 0, at: 0 };
  function cutTilt(p) {
    if (!M) return 0;
    let f;
    if (M.cutin > 0 && M.cutinBy === p.index) {
      f = (C.POWER_CUTIN - M.cutin) * 60;
      tiltCut.by = p.index; tiltCut.f = f; tiltCut.at = now();
    } else if (tiltCut.by === p.index && !(M.cutin > 0)) {
      // (past the sim's cut-in the lean still has its last ≈ 0.2 s to run, on the wall clock)
      f = tiltCut.f + (now() - tiltCut.at) * 60;
      if (!(f < 101) || f < tiltCut.f) { tiltCut.by = -1; return 0; }
    } else return 0;
    let d = 0;
    for (let i = 1; i < TILT_K.length; i++) if (f <= TILT_K[i][0]) { const [f0, v0] = TILT_K[i - 1], [f1, v1] = TILT_K[i]; d = f < f0 ? 0 : v0 + (v1 - v0) * (f - f0) / (f1 - f0); break; }
    return -p.side * d * Math.PI / 180;
  }
  // THE BALL THROUGH THE CUT-IN (§5): gone from the touch (f2), back at f27–30 above the head and
  // a little in front (1.6 r out, 1.85 r up), and knocked out in front — where it leaves from (the
  // sim already has it there, C.POWER_RELEASE_AT) — by the head's whip at f52–54, drawn stretched
  // sideways from then on (M4 40.20 s f52–f61).
  // → { hide } or { x, y, sx, sy, a } in world px, or null outside a cut-in's hold.
  function cutBall(b) {
    if (!M || !b.power || !(M.cutin > C.POWER_RELEASE) || !(M.cutinBy >= 0)) return null;
    const p = M.players[M.cutinBy];
    if (!p || b.power.owner !== p.index) return null;
    const f = (C.POWER_CUTIN - M.cutin) * 60;
    if (f < 27) return { hide: true };
    const r = C.HEAD_R, hy = headY(p), s = p.side;
    const ax = p.x + s * mixN(1.6, 1.65, (f - 30) / 22) * r, ay = hy - mixN(1.85, 1.8, (f - 30) / 22) * r;
    const k = Math.min(1, Math.max(0, (f - 52) / 2)), e = k * k * (3 - 2 * k);
    const st = Math.min(1, Math.max(0, (f - 52) / 2));
    return { x: ax + (b.x - ax) * e, y: ay + (b.y - ay) * e, sx: 1 + 0.3 * st, sy: 1 - 0.12 * st, a: Math.min(1, (f - 27) / 3) };
  }
  const mixN = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  const fillDark = (g, a) => { g.fillStyle = `rgba(${DARK_RGB},${a.toFixed(3)})`; g.fillRect(-20, -SKY_PAD, C.W + 40, C.H + SKY_PAD + 40); };
  const clearLayer = (g) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); };

  // What only exists under a cut-in, painted over the dark: a champion's own cut-in pieces.
  function cutExtras(g) {
    for (const b of balls()) {
      const P = powerVfx(b.power);
      if (P && P.cutin && M.cutin > C.POWER_RELEASE) { const o = depthPoint(b.power.x0, b.power.y0); P.cutin(g, { pw: b.power, now: now(), cut: C.POWER_CUTIN - M.cutin, fx: o.x, fy: o.y, r: b.r, ball: ballAt }); }
    }
  }
  // THE PRESS (§1): see fx-kit drawArmedGlow. With layers the silhouette glow goes UNDER the
  // heads (part 'under', from drawUnder) and the wisps over them; without, both here.
  function armedAt(g, p, part = layered ? 'over' : 'both') {
    if (!(p.armed > 0)) return;
    const h = depthPoint(p.x, headY(p)), f = depthPoint(p.x, p.y);
    const r = headR(M, p), t = now();
    drawArmedGlow(g, h.x, h.y, r, f.x, f.y, t, p.index, part);
    if (part === 'under') return;
    // …and a champion's own touch on it, where it has one (public/vfx/powers/)
    const P = p.shot && p.shot.cp ? POWER_VFX[p.shot.cp] : null;
    if (P && P.armed) P.armed(g, p, { t, hx: h.x, hy: h.y, r, fx: f.x, fy: f.y });
  }
  // THE STARS over a dazed head (§4) — not while a power shot grinds on his boot: HS shows the
  // block's burst there, no stars (M4 61.45–62.25 s).
  function starsAt(g, p) {
    if (!(p.stunned > 0)) return false;
    const pw = M.ball.power;
    if (pw && pw.ph === 'grind' && pw.tgt === p.index) return false;
    // over the crown of the knocked-out head (tipped back 0.65 rad, game.js reelTilt): HS keeps
    // the ring nearly level above it, leaning only a little with the head
    // (the head's own pose from the game when it has one: tipped about the neck on the grass,
    // its centre moves back with the tilt — game.js headPose)
    const hp = headPose ? headPose(p) : { tilt: -p.side * 0.65, dx: 0, dy: 0 };
    const r = headR(M, p), h = depthPoint(p.x + hp.dx, headY(p) + hp.dy), lean = hp.tilt || -p.side * 0.65, up = r * 1.25;
    drawStars(g, h.x + Math.sin(lean * 0.45) * up, h.y - Math.cos(lean * 0.45) * up, r, now(), 1, lean * 0.25);
    return true;
  }
  function overlays(g) {
    const t = now();
    if (!(M.cutin > 0) && !(lastCut.by >= 0 && t - lastCut.at < 0.39 - C.POWER_RELEASE)) overHeads(g);
    for (const p of M.players) {
      const stars = starsAt(g, p);
      if (!p.ail || !AILMENT_VFX[p.ail]) continue;
      if (p.ail === 'stars' && stars) continue;
      const h = depthPoint(p.x, headY(p)), f = depthPoint(p.x, p.y);
      AILMENT_VFX[p.ail].draw(g, p, { t, hx: h.x, hy: h.y, r: headR(M, p), fy: f.y, col: ailCol[p.index] });
    }
  }

  return {
    stats, track, drops, shards,
    reset() { track.clear(); drops.length = 0; shards.length = 0; bursts.length = 0; ailCol.length = 0; },
    bind(m) { if (m !== M) { M = m; this.reset(); } },
    // game.js has given us the two full-resolution layers (drawUnder / drawTop).
    useLayers(on = true) { layered = !!on; },
    get layered() { return layered; },
    // The cut-in is the sim's own pause now (m.cutin); nothing on the client holds the match.
    holding() { return false; },

    onEvent(e) {
      if (!M) return;
      // a champion power's own one-off burst (the Mythic Gem's shatter), and the colour it leaves
      for (const P of EVENT_VFX) { const fx = P.event(e, depthPoint); if (fx) bursts.push(fx); }
      if (e.type === 'gemShatter') ailCol[e.player] = e.color;
      if (e.type === 'powershot') {
        for (const b of balls()) if (b.power) { const r = rec(b); r.hist.length = 0; r.t0 = M.t + (M.cutin > 0 ? Math.max(0, M.cutin - C.POWER_RELEASE) : 0); r.ph = b.power.ph; r.touch = now(); }
      } else if (e.type === 'rebound' || e.type === 'delayGo') {
        const r = rec(M.ball); r.hist.length = 0; r.t0 = M.t;
      } else if (e.type === 'powerHit' && e.how !== 'pass' && e.how !== 'shatter') {
        // §4 M4 43.33: red droplets burst at the impact…
        const x = e.x ?? M.ball.x, y = e.y ?? M.ball.y;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.45 + (Math.random() - 0.5) * 0.3, v = 140 + Math.random() * 120;
          drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.15 });
        }
        // …and the ball's after-images follow it on.
        const r = rec(M.ball); r.ghost = HIT_GHOSTS;
      }
    },

    // Once per rendered frame: record each ball's path on screen, run the droplets and shards.
    update(dt) {
      if (!M) return;
      const live = new Set();
      for (const b of balls()) {
        const r = track.get(b);
        if (b.power && b.power.ph === 'grind' && shards.length < 14 && Math.random() < dt * 40) {
          // the grind throws a spear of light every ≈ 25 ms
          const d = depthPoint(b.x, b.y), a = Math.random() * TAU, v = 380 + Math.random() * 420;
          shards.push({ x: d.x + Math.cos(a) * 26, y: d.y + Math.sin(a) * 26, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.14 + Math.random() * 0.1, len: 50 + Math.random() * 60 });
        }
        if (!b.power && !(r && r.ghost > 0)) continue;
        const q = rec(b);
        live.add(b);
        if (b.power) {
          // A shot that starts moving again (the Aerial's dive, the Delay's burst) is a new release.
          // (and a blocked shot fired back off the boot flies a fresh comet: §4 "full comet tail")
          if (b.power.ph !== q.ph) {
            if (b.power.ph === 'dive' || (b.power.ph === 'fly' && (q.ph === 'grind' || q.ph === 'rest'))) { q.hist.length = 0; q.t0 = M.t; }
            q.ph = b.power.ph;
          }
        }
        if (!b.power || b.power.hit) q.ghost -= dt;
        const d = depthPoint(b.x, b.y);
        const h = q.hist;
        if (!h.length || Math.hypot(h[0].x - d.x, h[0].y - d.y) > 0.5) { h.unshift({ x: d.x, y: d.y }); if (h.length > HIST) h.length = HIST; }
      }
      for (const b of [...track.keys()]) if (!live.has(b)) track.delete(b);
      for (let i = bursts.length - 1; i >= 0; i--) {
        const fx = bursts[i];
        fx.t += dt;
        if (fx.t >= fx.life) { bursts.splice(i, 1); continue; }
        if (fx.step) fx.step(dt);
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i];
        p.t += dt;
        if (p.t >= p.life) { drops.splice(i, 1); continue; }
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.t += dt;
        if (s.t >= s.life) { shards.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.9; s.vy *= 0.9;
      }
    },

    // UNDER the ball (game.js drawBall calls this, then draws the ball itself on top — the filmed
    // comet has the plain ball at its nose). Returns true when the ball must not be drawn there
    // (hidden, off the top of the screen — or, with layers, drawn up on the top layer instead).
    // the shooter's wind-up tilt and the held ball's pose, for game.js (headPose, drawBall)
    cutTilt: (p) => cutTilt(p),
    cutBall: (b) => cutBall(b),
    drawBall(g, b) {
      const pw = b.power;
      if (!M || !pw) return false;
      const P = powerVfx(pw);
      // (a champion power that draws the ball's wait itself — Japan's five circling — hides it)
      if (P && P.hideInCut && M.cutin > C.POWER_RELEASE) return true;
      // the held ball is painted over the dark (drawTop / drawCutin), bright, where cutBall says
      if (cutBall(b)) return !onTop;
      // Until 0.97s into the cut-in the ball has not left: HS shows it hanging by the shooter's
      // head, no tail (§2) — then it flies under the dark. A ball carried on through a HIT is drawn
      // as its after-images, not a comet (§4). Pinned on a boot, dead at the feet, or hanging
      // still: no tail — HS shows only the block's spark burst there (§4, M4 61.45–62.7 s).
      if (!shotLive(b)) return false;
      if (layered && !onTop) return !inGoal(b);
      return shotFx(g, b);
    },

    // Whether the ball's own shadow on the grass must go too (an invisible or hidden power ball).
    hideShadow(b) {
      if (onTop) return true;                                   // (the top layer paints no shadows)
      const P = M && b && powerVfx(b.power);
      return !!(P && P.hideShadow && P.hideShadow(b.power, M));
    },
    // OVER the ball, on the pitch: the block's grind, the Aerial's warning, the hit's droplets and
    // the after-images of a hit ball. (With layers these go on the top layer; under a cut-in's dark
    // drawCutin paints them over the dark — in HS the block's burst and the comet are the bright
    // things on a darkened pitch, M4 61.45 s.)
    drawOver(g) {
      if (!M || layered || M.cutin > 0 || (lastCut.by >= 0 && now() - lastCut.at < 0.39 - C.POWER_RELEASE)) return;
      pitchFx(g);
    },
    drawArmed(g, p) {
      if (!M) return;
      armedAt(g, p);
    },
    // THE AILMENTS and the stars, on the layer above the heads.
    drawOverlay(g) {
      if (!M) return;
      overlays(g);
    },

    // THE CUT-IN (§2) on one canvas over everything (no layers): the dark, the light, the shot
    // repainted bright over it. The shooter's head is DOM under this canvas, so the dark and the
    // disc leave a hole in his head's own shape.
    drawCutin(g) {
      if (!M) return;
      const s = cutState();
      if (!s) return;
      g.save();
      fillDark(g, s.dark);
      if (s.glow > 0) { drawRays(g, s.h.x, s.h.y, s.r, s.T, s.el); drawDisc(g, s.h.x, s.h.y, s.r, s.T); }
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000'; headPath(g, s.h.x, s.h.y, s.r); g.fill();
      const qh = depthPoint(s.q.x, headY(s.q)); headPath(g, qh.x, qh.y, headR(M, s.q)); g.fill();
      g.restore();
      if (paintBody) paintBody(g, s.q);
      if (s.glow > 0 && paintBody) paintBody(g, s.p);
      if (paintBall && M.cutin <= C.POWER_RELEASE) for (const b of balls()) if (b.power) paintBall(g, b);
      if (paintBall && M.cutin > C.POWER_RELEASE) { onTop = true; try { for (const b of balls()) if (cutBall(b)) paintBall(g, b); } finally { onTop = false; } }
      pitchFx(g);
      cutExtras(g);
      overHeads(g);
    },

    // HS softens the darkened backdrop under a cut-in (M4 40.4–41.7 s: the stands go out of
    // focus). CSS px of blur for the pitch canvas now — game.js puts it on #cv as a CSS filter
    // (the canvas is half resolution, so the GPU blur is cheap), quantized so the style only
    // changes during the fades.
    pitchBlur() {
      if (!M) return 0;
      const s = cutState();
      return s ? Math.round(s.fade * 1.6 * 4) / 4 : 0;
    },

    // WITH LAYERS — game.js calls these two every frame.
    // UNDER the heads: the cut-in's dark over the whole pitch, its rays and disc, and the shooter's
    // body back on top of the disc. His head is DOM above this layer, so it sits on the disc and
    // stays bright, exactly as HS's sprite does.
    drawUnder(g) {
      if (!M) return;
      const s = cutState();
      if (dirty.under) { clearLayer(g); dirty.under = false; }
      const armed = M.players.some((p) => p.armed > 0);
      if (!s && !armed) return;
      dirty.under = true;
      if (s) {
        fillDark(g, s.dark);
        if (s.glow > 0) {
          drawRays(g, s.h.x, s.h.y, s.r, s.T, s.el);
          drawDisc(g, s.h.x, s.h.y, s.r, s.T);
        }
        // The other player plays on through the cut-in (sim.js step), so he stays bright too —
        // under the dark he was a black shadow walking through the shooter (Idan).
        if (paintBody) paintBody(g, s.q);
        if (s.glow > 0 && paintBody) paintBody(g, s.p);
      }
      // the press glow, behind the head and round the body
      for (const p of M.players) armedAt(g, p, 'under');
    },
    // OVER the heads: every shot's picture with its ball at the nose, the pitch pieces (block,
    // hit, fist, lances), the armed glows, the ailments and stars.
    // (The other player is not darkened under a cut-in: he is still playing — see drawUnder.)
    drawTop(g) {
      if (!M) return;
      if (dirty.top) { clearLayer(g); dirty.top = false; }
      const s = cutState();
      const busy = s || drops.length || shards.length || track.size || M.players.some((p) => p.armed > 0 || p.stunned > 0 || p.ail) || balls().some((b) => b.power);
      if (!busy) return;
      dirty.top = true;
      onTop = true;
      try {
        for (const b of balls()) {
          if (paintBall && cutBall(b)) { paintBall(g, b); continue; }
          if (!b.power || !shotLive(b)) continue;
          if (inGoal(b) || !paintBall) shotFx(g, b);
          else paintBall(g, b);
        }
      } finally { onTop = false; }
      pitchFx(g);
      if (s) cutExtras(g);
      for (const p of M.players) armedAt(g, p);
      overlays(g);
      if (s) overHeads(g);
    },
  };
}

// For the tests and the screenshot harness: every family and ailment has a renderer.
export const FAMILIES_DRAWN = FAMILY_ORDER.filter((f) => FAMILY_VFX[f] && typeof FAMILY_VFX[f].draw === 'function');
export const AILMENTS_DRAWN = AILMENT_ORDER.filter((a) => AILMENT_VFX[a] && typeof AILMENT_VFX[a].draw === 'function');
