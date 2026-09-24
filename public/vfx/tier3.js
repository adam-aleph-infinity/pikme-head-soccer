// Tier 3 — נבחרת (stages 19-27) champion VFX: control of the other player. See
// public/champ-vfx.js for the contract: every hook only DRAWS, reading the match it is handed
// (s.M) and never writing to it.

const TAU = Math.PI * 2;

// Client-side memory for an effect record or a shot (last frame's ball speed, the skate marks
// behind a slide). Kept here, keyed by the object, because nothing may be written onto it.
const mem = new WeakMap();
const memo = (o, init) => { let v = mem.get(o); if (!v) { v = init(); mem.set(o, v); } return v; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// A fixed jag per index, so a crack or a rock keeps its shape from frame to frame.
const hash = (i) => { const j = Math.sin(i * 127.1 + 311.7) * 43758.5453; return j - Math.floor(j); };
// 0 → 1 over the first `a` seconds of an effect, 1 → 0 over its last `b`.
const envelope = (e, a = 0.15, b = 0.3) => clamp(Math.min(e.t / a, (e.life - e.t) / b), 0, 1);
// The player an effect sits on: its target, else the foe of whoever fired it.
const victim = (s, e) => (e && e.target != null && s.M.players[e.target]) || s.foe;
const feet = (s, p) => s.depth(p.x, p.y);
const head = (s, p) => s.depth(p.x, s.headY(p));

function star(g, x, y, r, rot, pts = 5, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = rot + (i / (pts * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}
function disc(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.fill(); }

// An irregular asteroid outline — the same jag every frame for one seed.
function rockPath(g, r, rot, seed) {
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = rot + (i / 9) * TAU, rr = r * (0.8 + hash(seed + i) * 0.28);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

// A dimensional doorway: dark core, four spiral arms winding inward, a pale rim. `k` 0..1.
function rift(g, x, y, rx, ry, spin, k) {
  if (k <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.globalAlpha = 0.5 * k;
  g.fillStyle = '#1a0b3d';
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = 3; g.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    g.strokeStyle = arm % 2 ? '#6a5cff' : '#00e0c6';
    g.globalAlpha = 0.85 * k;
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const f = i / 14, a = spin + arm * (TAU / 4) + f * 4.2, rr = 1 - f * 0.85;
      g.lineTo(Math.cos(a) * rx * rr, Math.sin(a) * ry * rr);
    }
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = k;
  g.strokeStyle = '#cfc9ff'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
  g.restore();
}

// A six-armed snowflake, two barbs per arm, stroked in one path.
function snowflake(g, x, y, r, rot, color, lw) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, c = Math.cos(a), sn = Math.sin(a);
    g.moveTo(0, 0); g.lineTo(c * r, sn * r);
    for (const f of [0.55, 0.8]) for (const b of [-0.6, 0.6]) {
      const L = r * (f === 0.55 ? 0.34 : 0.22);
      g.moveTo(c * r * f, sn * r * f); g.lineTo(c * r * f + Math.cos(a + b) * L, sn * r * f + Math.sin(a + b) * L);
    }
  }
  g.stroke();
  g.restore();
}

// The drain's padlock, centred on (x, y); `lift` raises the shackle as it unlocks.
function padlock(g, x, y, lift) {
  g.strokeStyle = '#b3ffe3'; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y - 5 - lift, 6, Math.PI, 0); g.lineTo(x + 6, y - 2 - lift); g.stroke();
  g.fillStyle = '#0a1f17'; g.fillRect(x - 8, y - 5, 16, 13);
  g.strokeStyle = '#00d68f'; g.lineWidth = 2; g.strokeRect(x - 8, y - 5, 16, 13);
  g.fillStyle = '#c6ff4a'; disc(g, x, y, 2); g.fillRect(x - 1, y, 2, 5);
}

// ── the super cut-in ─────────────────────────────────────────────────────────
// The engine's band sweeps in from the champion's side and out the other; each entry draws its
// signature beside it. `cutFrame` gives the fade, the band's slide and an anchor clear of the
// title (centre) and the icon (the far side): the champion's own end of the band.
function cutFrame(s, k) {
  const { C } = s;
  const from = s.owner.side > 0 ? -1 : 1;
  const ease = k < 0.25 ? 1 - (1 - k / 0.25) ** 3 : 1;
  const out = k > 0.72 ? ((k - 0.72) / 0.28) ** 2 : 0;
  const bx = from * (1 - ease) * C.W - from * out * C.W;
  const fade = clamp(Math.min(k / 0.08, (1 - k) / 0.35), 0, 1);
  const pop = k < 0.2 ? 0.6 + 0.4 * (1 - (1 - k / 0.2) ** 3) : 1;
  return { from, bx, fade, pop, x: C.W / 2 - from * 360 + bx, y: C.H * 0.34 };
}

// The activation's light: a wide soft glow and a hot core, a spinning sunburst, and a comic word.
// Shared structure, never a shared look — every caller passes its own colours and word.
function blast(s, x, y, o) {
  const { fx } = s;
  fx.glow(x, y, o.R || 170, o.c1, { life: o.life || 0.7, alpha: 0.9 });
  fx.glow(x, y, (o.R || 170) * 0.4, o.c2, { life: 0.4, alpha: 1, layer: 'front' });
  fx.rays(x, y, { color: o.c1, color2: o.c2, n: o.n || 14, r1: o.rayR || 340, life: o.rayLife || 0.8, spin: o.spin ?? 1.4, alpha: 0.5 });
  if (o.word) fx.stamp(o.wx ?? x, o.wy ?? y - 80, o.word, { color: o.wc || o.c2, edge: o.edge, r: o.wr || 56, life: 1.1 });
}

// A full-screen colour wash for the whole of an effect — the scene changes colour while the
// power is on. Capped under the brief: 0.35 for the first 0.6 s, 0.22 after.
function wash(g, s, col, a, t = 1) {
  const A = Math.min(t < 0.6 ? 0.35 : 0.22, a);
  if (!(A > 0.005)) return;
  g.save(); g.globalAlpha = A; g.fillStyle = col; g.fillRect(0, 0, s.C.W, s.C.H); g.restore();
}
// One ambient particle somewhere over the whole pitch (not just round the victim).
function anywhere(s, o) {
  const { fx, C } = s;
  return fx.emit({ x: fx.rand(0, C.W), y: fx.rand(C.CEIL_Y, C.GROUND_Y), ...o });
}
// The lingering aftermath: a long soft glow, slow faint rays and `n` motes drifting for ~2 s,
// so a short power leaves the pitch glowing well after its record is gone.
function linger(s, x, y, o) {
  const { fx } = s;
  const life = o.life || 2.2;
  fx.glow(x, y, o.R || 200, o.c1, { life, alpha: 0.75 });
  fx.rays(x, y, { color: o.c1, color2: o.c2, n: o.rn || 10, r: 20, r1: o.rayR || 320, life: life * 0.9, spin: o.spin ?? 0.5, alpha: 0.28 });
  for (let i = 0, n = fx.n(o.n || 24); i < n; i++) {
    fx.emit({ shape: 'dot', x: x + fx.rand(-1, 1) * (o.w || 220), y: y + fx.rand(-1, 1) * (o.h || 110), vx: fx.rand(-22, 22), vy: o.vy ?? -26,
      r: fx.rand(2.5, 6), life: fx.rand(1.2, life + 0.4), color: i % 2 ? o.c1 : o.c2, blend: 'lighter', ...(o.mote || {}) });
  }
}
// Manga focus lines raking in from the screen's edges toward (x, y): the "super move" frame.
function focusLines(g, s, x, y, col, a, seed = 0) {
  const { C } = s;
  if (!(a > 0.01)) return;
  g.save();
  g.globalAlpha = a; g.fillStyle = col;
  const R = Math.hypot(C.W, C.H);
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const an = (i / 28) * TAU + hash(i + seed) * 0.2, w = 0.012 + hash(i * 3 + seed) * 0.018, r0 = R * (0.42 + hash(i * 7 + seed) * 0.2);
    g.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0);
    g.lineTo(x + Math.cos(an - w) * R, y + Math.sin(an - w) * R);
    g.lineTo(x + Math.cos(an + w) * R, y + Math.sin(an + w) * R);
    g.closePath();
  }
  g.fill();
  g.restore();
}
// Outlined comic text: a dark edge, a bright fill — reads on any backdrop.
function label(g, text, x, y, size, fill, edge, font = '-apple-system, Arial') {
  g.font = `900 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size * 0.18); g.strokeStyle = edge; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}

// Where the portal's victim stood while its champion was armed: the power moves him before any
// hook runs, so the aura remembers the spot the entry rift has to open on.
const portalFrom = [null, null];

export default {
  // ── 19 · reverse — the jester ─────────────────────────────────────────────
  reverse: {
    theme: "Jester's confusion",
    visual: 'candy-stripe hypno spiral, orbiting dizzy stars, floating question marks, flipping left/right arrows',
    palette: ['#ff66ff', '#fff0fb', '#7a1fa2', '#39e6c8', '#ffe45c'],
    doc: {
      fantasy: 'A court jester hexes the opponent: his head spins, stars circle it and left is suddenly right.',
      purpose: 'Stage 19 opens the tier that controls the other player. Reversed controls punish a keeper who reacts on reflex and teach reading the status ring before moving.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is struck at the goal on a lofted line (1.15× a kick) and the opponent\'s left and right are swapped for 3.5 s. One reverse at a time; it cannot be extended.',
      bot: 'Arms the moment it can (POWERS.reverse.arm = "any") and fires on its next touch; brawler style — no extra aggression, tackles 1.35× as often, so it likes to fire it close. Able bots under a reverse flip their own inputs back; weak ones run the wrong way.',
      sequence: {
        anticipation: 'While armed a big two-horned jester cap in magenta and teal flops behind the champion\'s head under a magenta glow, glowing yellow bells swinging, three question marks orbiting and more floating off.',
        activation: 'Under the super cut-in (manga focus lines, whirling candy streamers and a giant spinning candy hypno-wheel with ⇄ arrows and question marks at the champion\'s end of the band): a magenta-teal sunburst and glow at the ball, a "הפוך!" word, a magenta hex beam into the opponent\'s head where a second teal sunburst, glow and yellow ring go off, 40 confetti papers, 20 candy streaks, yellow stars and "?" glyphs, six big "?" left hanging over the pitch for 3 s, a magenta flash and edge glow and a shake.',
        main: 'For 3.5 s the whole stadium goes candy-purple (wash ≤0.2): a giant 16-wedge hypno-wheel (r 320) with a scalloped candy rim and a two-arm spiral turns behind the victim in big magenta/teal glows; six outlined dizzy stars orbit his head, a merry-go-round of big outlined "?" (every other one upside down) wheels round his body and two big arrows beside him keep flipping. A candy shock-ring rolls out of him every 0.45 s, sparkles twinkle all over the pitch and paper swirls down from the roof.',
        impact: 'As the hex lands: a teal glow, 18 yellow stars and a teal ring off the victim\'s head with a big ⇄ glyph rising.',
        aftermath: 'He snaps out of it: a "חזרתי!" word, a teal sunburst, stars and confetti fly off, a teal ring pops and a "!" jumps over his head; a pink glow, faint slow rays and 22 drifting stars linger for 2 s.',
        cleanup: 'Confetti and stars run out inside 2.5 s; the wheel, wash and spiral fade over the last 0.4 s so the end is visible coming.',
      },
      layers: 'Cut-in: focus lines, 2 glows, 8 candy streamers, 12-wedge hypno wheel, two-arm spiral, ⇄ and "?" text. Back: purple wash, 2 drawGlow, 16-wedge wheel, candy rim, spiral. Front: 6 outlined stars each lit by drawGlow, 6 outlined "?" labels, flipping arrows. Particles: glow, rays, stamp, beam, confetti, streaks, stars, "?"/"⇄" glyphs, rings, dots.',
      camera: 'Shake 7 on firing, 5 when the hex lands; a 0.25 s magenta flash (alpha 0.3) and a 0.9 s magenta edge vignette on firing. No colour grade — the victim must stay readable.',
      hud: 'The engine\'s 🔄 status pill with its 3.5 s ring over the victim\'s head; nothing duplicated here.',
      audio: 'Fire: a slide-whistle up and back down with a toy blip. Impact: a wobbly detuned tone with a sparkle. End: a two-note "ding-ding" as the controls come back.',
      counterplay: 'Watch the ring over your head: stand still for 3.5 s rather than run blind, or press the opposite direction on purpose. The champion must still beat you with the lofted strike that fired it.',
      perf: '~100 particles on firing, ≤2 a frame while the hex lasts plus one ring every 0.45 s, ~70 on the end; ≤8 drawGlow a frame; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), anywhere(), focusLines(), label(), fx.beam, fx.confetti, fx.burst, fx.ring, fx.glyph, fx.emit(star/streak/confetti), fx.drawGlow, fx.vignette, fx.shake, fx.flash, cutFrame(), memo(), s.depth, s.headY, s.headR, envelope().',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 300, to: 950, type: 'triangle', peak: 0.45, dur: 0.18 }, { k: 'sweep', from: 950, to: 260, type: 'triangle', peak: 0.4, dur: 0.22, t: 0.18 }, { k: 'blip', freq: 1320, type: 'square', peak: 0.16, dur: 0.07, t: 0.42 }],
      impact: [{ k: 'sweep', from: 520, to: 470, type: 'sine', peak: 0.35, dur: 0.5, detune: 45 }, { k: 'blip', freq: 1760, type: 'triangle', peak: 0.2, dur: 0.12, t: 0.05 }],
      end: [{ k: 'blip', freq: 988, type: 'triangle', peak: 0.3, dur: 0.1 }, { k: 'blip', freq: 1319, type: 'triangle', peak: 0.3, dur: 0.16, t: 0.1 }],
    },

    aura(g, p, s) {
      const h = head(s, p), R = s.headR(p);
      s.fx.drawGlow(g, h.x, h.y - R * 0.5, R + 56, '#ff66ff', 0.55 + 0.15 * Math.sin(s.t * 6));
      g.save();
      // the jester's cap: two big floppy horns out from behind the head, the bells swinging
      for (const k of [-1, 1]) {
        const sw = Math.sin(s.t * 5 + k) * 9;
        const bx = h.x + k * (R + 30) + sw, by = h.y - R - 22 + Math.cos(s.t * 5 + k) * 5;
        g.fillStyle = k < 0 ? '#ff66ff' : '#39e6c8';
        g.strokeStyle = '#7a1fa2'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(h.x - k * R * 0.3, h.y - R * 0.6);
        g.quadraticCurveTo(h.x + k * (R + 10), h.y - R - 46, bx, by);
        g.lineTo(h.x + k * R * 1.05, h.y - R * 0.05);
        g.closePath(); g.fill(); g.stroke();
        s.fx.drawGlow(g, bx, by, 18, '#ffe45c', 0.8);
        g.fillStyle = '#ffe45c';
        disc(g, bx, by, 7);
      }
      // three question marks orbiting the cap
      g.font = '900 20px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) {
        const a = s.t * 2.5 + (i / 3) * TAU;
        g.fillStyle = i === 1 ? '#39e6c8' : '#ffe45c';
        g.fillText('?', h.x + Math.cos(a) * (R + 40), h.y - R * 0.3 + Math.sin(a) * 14);
      }
      g.restore();
      if (Math.random() < 0.12) {
        s.fx.glyph(h.x + s.fx.rand(-R, R), h.y - R - 10, '?', { r: 18, color: '#ff66ff', vy: -50, life: 0.8, spin: s.fx.rand(-3, 3) });
      }
    },

    cutin(g, s, k) {
      const c = cutFrame(s, k), R = 118 * c.pop;
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#ff66ff', 0.45 * c.fade, 1);
      s.fx.drawGlow(g, c.x, c.y, R * 2.4, '#ff66ff', 0.9 * c.fade);
      s.fx.drawGlow(g, c.x, c.y, R * 1.2, '#39e6c8', 0.6 * c.fade);
      g.save();
      // candy streamers whirling out behind the wheel
      g.translate(c.x, c.y); g.rotate(k * 4);
      g.lineWidth = 10; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.globalAlpha = 0.85 * c.fade; g.strokeStyle = ['#ff66ff', '#39e6c8', '#ffe45c', '#fff0fb'][i % 4];
        g.beginPath();
        for (let j = 0; j <= 10; j++) { const f = j / 10, r = R + f * 170, aa = a + f * 1.2; g.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); }
        g.stroke();
      }
      g.restore();
      g.save();
      g.translate(c.x, c.y); g.rotate(-k * 7);
      // the hypno wheel
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.globalAlpha = 0.75 * c.fade; g.fillStyle = i % 2 ? '#fff0fb' : '#ff66ff';
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a, a + TAU / 12); g.closePath(); g.fill();
      }
      g.globalAlpha = c.fade; g.lineWidth = 12; g.lineCap = 'round';
      for (let arm = 0; arm < 2; arm++) {
        g.strokeStyle = arm ? '#7a1fa2' : '#39e6c8';
        g.beginPath();
        for (let i = 0; i <= 24; i++) { const f = i / 24, a = arm * Math.PI + f * TAU * 1.5, r = 8 + f * (R - 14); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.stroke();
      }
      g.strokeStyle = '#ffe45c'; g.lineWidth = 6;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      g.restore();
      g.save();
      g.globalAlpha = c.fade; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 64px -apple-system, Arial'; g.lineWidth = 8; g.strokeStyle = '#7a1fa2';
      const fl = Math.cos(k * 18);
      g.translate(c.x, c.y + R + 34); g.scale(fl, 1);
      g.strokeText('⇄', 0, 0); g.fillStyle = '#ffe45c'; g.fillText('⇄', 0, 0);
      g.restore();
      g.save();
      g.globalAlpha = c.fade; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 44px -apple-system, Arial'; g.lineWidth = 6; g.strokeStyle = '#7a1fa2';
      for (let i = 0; i < 4; i++) {
        const a = k * 5 + (i / 4) * TAU, x = c.x + Math.cos(a) * (R + 50), y = c.y + Math.sin(a) * (R * 0.8);
        g.fillStyle = i % 2 ? '#39e6c8' : '#ffe45c';
        g.strokeText('?', x, y); g.fillText('?', x, y);
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      blast(s, at.x, at.y, { c1: '#ff66ff', c2: '#39e6c8', n: 16, word: 'הפוך!', wc: '#ffe45c', edge: '#7a1fa2', spin: -2.4 });
      fx.ring(at.x, at.y, { color: '#ff66ff', r1: 150, life: 0.5, w: 8 });
      fx.ring(at.x, at.y, { color: '#39e6c8', r: 4, r1: 100, life: 0.6, w: 5 });
      fx.confetti(at.x, at.y, 40, ['#ff66ff', '#39e6c8', '#ffe45c', '#fff0fb']);
      fx.burst(at.x, at.y, 14, { shape: 'star', speed: 380, r: 9, spin: 9, drag: 1.6, life: 1, color: '#ffe45c', color2: '#ff66ff' });
      fx.burst(at.x, at.y, 8, { shape: 'glyph', text: '?', r: 26, speed: 220, spin: 4, drag: 1.5, life: 1, color: '#ffe45c' });
      // the hex beam: a magenta bolt of jester magic from the ball into the opponent's head
      const q = s.foe, h = head(s, q), R = s.headR(q);
      fx.beam(at.x, at.y, h.x, h.y, { color: '#ff66ff', color2: '#fff0fb', w: 22, life: 0.45 });
      fx.glyph(h.x, h.y - R - 40, '⇄', { r: 40, color: '#7a1fa2', vy: -30, life: 0.9 });
      // a second sunburst on the victim, turning the other way: the hex lands on him too
      fx.rays(h.x, h.y, { color: '#39e6c8', color2: '#ffe45c', n: 12, r1: 300, life: 0.9, spin: 2.2, alpha: 0.4 });
      fx.glow(h.x, h.y, 170, '#ff66ff', { life: 0.8, alpha: 0.8 });
      fx.ring(h.x, h.y, { color: '#ffe45c', r: 10, r1: 220, life: 0.6, w: 8, layer: 'front' });
      // candy sparkles sprayed right across the pitch
      for (let i = 0, n = fx.n(20); i < n; i++) {
        const a = fx.rand(0, TAU), v = fx.rand(300, 700);
        fx.emit({ shape: 'streak', x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, r: 8, w: 4, life: 0.6, color: ['#ff66ff', '#39e6c8', '#ffe45c', '#fff0fb'][i % 4] });
      }
      // question marks that hang in the air for the whole hex
      for (let i = 0, n = fx.n(6); i < n; i++) {
        fx.emit({ shape: 'glyph', text: '?', rot: i % 2 ? Math.PI : 0, x: fx.rand(80, s.C.W - 80), y: fx.rand(s.C.CEIL_Y + 50, s.C.GROUND_Y - 120), vy: -12, spin: fx.rand(-1.5, 1.5), r: fx.rand(30, 46), life: fx.rand(2.2, 3.2), color: i % 3 ? '#ff66ff' : '#39e6c8' });
      }
      fx.flash('#ff66ff', 0.3, 0.25);
      fx.vignette('#ff66ff', 0.55, 1.4);
      fx.shake(8, 0.35);
    },

    impact(s, ev) {
      const { fx } = s;
      const R = ev.on != null ? s.headR(s.M.players[ev.on]) : 20;
      const d = s.depth(ev.x, ev.y);
      fx.glow(d.x, d.y, R + 70, '#39e6c8', { life: 0.5, alpha: 0.8 });
      fx.burst(d.x, d.y, 18, { shape: 'star', speed: 280, r: 8, spin: 9, drag: 2, life: 0.9, color: '#ffe45c' });
      fx.ring(d.x, d.y, { color: '#39e6c8', r: R, r1: R + 90, life: 0.5, w: 6, layer: 'front' });
      if (ev.kind === 'land') fx.glyph(d.x, d.y - R - 34, '⇄', { r: 44, color: '#ff66ff', vy: -45, life: 1.1 });
      fx.shake(5, 0.25);
    },

    back(g, e, s) {
      const q = victim(s, e), h = head(s, q), R = s.headR(q);
      const k = envelope(e, 0.2, 0.4);
      // the whole stadium goes candy-pink while his controls are upside down
      wash(g, s, '#7a1fa2', 0.2 * k, e.t);
      s.fx.drawGlow(g, h.x, h.y, R + 220, '#ff66ff', 0.6 * k);
      s.fx.drawGlow(g, h.x, h.y, R + 90, '#39e6c8', 0.35 * k);
      g.save();
      g.translate(h.x, h.y);
      // the big hypno wheel behind him: the whole corner of the pitch goes dizzy
      g.rotate(s.t * 1.5);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.globalAlpha = 0.2 * k; g.fillStyle = i % 2 ? '#fff0fb' : '#ff66ff';
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 320, a, a + TAU / 16); g.closePath(); g.fill();
      }
      // a scalloped candy rim holding the wheel together
      g.globalAlpha = 0.8 * k; g.lineWidth = 6;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.strokeStyle = i % 2 ? '#39e6c8' : '#ffe45c';
        g.beginPath(); g.arc(0, 0, 150, a, a + TAU / 16); g.stroke();
      }
      g.rotate(-s.t * 5.5);
      g.globalAlpha = 0.55 * k;
      g.lineWidth = 7; g.lineCap = 'round';
      // two interleaved spirals: the candy stripe of a hypno wheel
      for (let arm = 0; arm < 2; arm++) {
        g.strokeStyle = arm ? '#fff0fb' : '#ff66ff';
        g.beginPath();
        for (let i = 0; i <= 28; i++) {
          const f = i / 28, a = arm * Math.PI + f * TAU * 1.6, r = R * 0.6 + f * (R + 60);
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.stroke();
      }
      g.restore();
    },

    front(g, e, s) {
      const q = victim(s, e), h = head(s, q), f = feet(s, q), R = s.headR(q);
      const k = envelope(e, 0.2, 0.4);
      g.save();
      // dizzy stars on a tilted ring above the head; the far half smaller and dimmer
      g.strokeStyle = '#7a1fa2'; g.lineWidth = 2.5; g.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        const a = s.t * 5 + (i / 6) * TAU, far = Math.sin(a) < 0;
        const x = h.x + Math.cos(a) * (R + 30), y = h.y - R - 6 + Math.sin(a) * 12;
        s.fx.drawGlow(g, x, y, far ? 14 : 24, '#ffe45c', 0.7 * k);
        g.globalAlpha = k * (far ? 0.55 : 1);
        g.fillStyle = i % 2 ? '#39e6c8' : '#ffe45c';
        star(g, x, y, far ? 8 : 13, s.t * 6 + i); g.stroke();
      }
      // a merry-go-round of big outlined "?" wheeling round him, far side dimmer
      for (let i = 0; i < 6; i++) {
        const a = -s.t * 1.8 + (i / 6) * TAU, far = Math.sin(a) < 0;
        const x = h.x + Math.cos(a) * (R + 92), y = (h.y + f.y) / 2 - 10 + Math.sin(a) * 34;
        g.globalAlpha = k * (far ? 0.5 : 1);
        g.save(); g.translate(x, y); g.rotate(Math.sin(s.t * 4 + i) * 0.4);
        if (i % 2) g.rotate(Math.PI); label(g, '?', 0, 0, far ? 26 : 36, ['#ff66ff', '#39e6c8', '#ffe45c'][i % 3], '#2a0838');
        g.restore();
      }
      // the arrows beside the body keep flipping: which way is which?
      const flip = Math.cos(s.t * 6);
      const bx = s.C.BODY_W / 2 + 34, by = f.y - s.C.BODY_H * 0.45;
      g.globalAlpha = 0.95 * k;
      for (const side of [-1, 1]) {
        g.save();
        g.translate(f.x + side * bx, by);
        g.scale(side * flip * 2.6, 2.6);
        g.fillStyle = side < 0 ? '#39e6c8' : '#ff66ff';
        g.strokeStyle = '#2a0838'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-8, -2.5); g.lineTo(1, -2.5); g.lineTo(1, -7); g.lineTo(9, 0); g.lineTo(1, 7); g.lineTo(1, 2.5); g.lineTo(-8, 2.5); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      const q = victim(s, e), h = head(s, q), R = s.headR(q);
      // a candy shock-ring rolls out of him every 0.45 s
      const st = memo(e, () => ({ n: 0 }));
      if (e.t > st.n * 0.45) {
        st.n++;
        fx.ring(h.x, h.y, { color: st.n % 2 ? '#ff66ff' : '#39e6c8', r: R + 10, r1: R + 230, life: 0.7, w: 6 });
        return;
      }
      if (Math.random() < 0.08) fx.glyph(h.x + fx.rand(-R, R), h.y - R - 4, '?', { r: 22, color: '#fff0fb', vy: -40, life: 0.8, spin: fx.rand(-2, 2) });
      if (Math.random() < 0.2) fx.emit({ shape: 'star', x: h.x + fx.rand(-R - 40, R + 40), y: h.y - R, vy: -40, spin: 5, r: 6, life: 0.6, color: '#ffe45c' });
      // candy sparkles twinkling all over the pitch, and paper swirling down from the roof
      if (Math.random() < 0.5) anywhere(s, { shape: 'star', r: fx.rand(4, 8), spin: 4, life: 0.7, vy: -10, color: ['#ff66ff', '#39e6c8', '#ffe45c'][Math.floor(Math.random() * 3)] });
      if (Math.random() < 0.3) fx.emit({ shape: 'confetti', x: fx.rand(0, s.C.W), y: s.C.CEIL_Y, vx: fx.rand(-40, 40), vy: 60, grav: 60, spin: 8, r: 5, life: 2, color: Math.random() < 0.5 ? '#ff66ff' : '#39e6c8' });
    },

    end(s, info) {
      const { fx } = s;
      const q = victim(s, info.e), h = head(s, q), R = s.headR(q);
      fx.glow(h.x, h.y, R + 60, '#39e6c8', { life: 0.5 });
      fx.burst(h.x, h.y - R, 14, { shape: 'star', speed: 320, r: 7, spin: 10, drag: 2, life: 0.7, color: '#ffe45c' });
      fx.confetti(h.x, h.y - R, 14, ['#ff66ff', '#39e6c8', '#ffe45c']);
      fx.ring(h.x, h.y, { color: '#39e6c8', r: R, r1: R + 60, life: 0.4, w: 5, layer: 'front' });
      fx.glyph(h.x, h.y - R - 34, '!', { r: 34, color: '#7a1fa2', vy: -60, life: 0.7 });
      fx.stamp(h.x, h.y - R - 90, 'חזרתי!', { r: 44, color: '#39e6c8', edge: '#2a0838', life: 1.4 });
      fx.rays(h.x, h.y, { color: '#39e6c8', color2: '#ffe45c', n: 14, r1: 260, life: 0.7, spin: -2, alpha: 0.45 });
      linger(s, h.x, h.y, { c1: '#ff66ff', c2: '#39e6c8', R: 190, n: 22, life: 2.2, mote: { shape: 'star', spin: 3, r: 5 } });
      // the last dizzy stars drifting down
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'star', x: h.x + fx.rand(-90, 90), y: h.y - R - fx.rand(10, 60), vy: 30, vx: fx.rand(-10, 10), spin: 3, r: 6, life: 1.8, color: '#ff66ff' });
      fx.shake(4, 0.2);
    },
  },

  // ── 20 · freeze — the cryo cage ───────────────────────────────────────────
  freeze: {
    theme: 'Cryo crystal cage',
    visual: 'ice crystals growing into a cage round the victim, frost vapour, snowflakes, a glass-snap shatter',
    palette: ['#8fe9ff', '#e6fbff', '#1d5fa0', '#5ad1f0', '#0b2c4a'],
    doc: {
      fantasy: 'A blast of cryo: ice crystals shoot up round the opponent and lock him in a cage — then it snaps.',
      purpose: 'The shortest control in the tier — 0.75 s — but total: no moving, no jumping, no kicking. It teaches that a tiny window is enough when the ball is already yours.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is popped straight up (1.25× a header\'s lift) for you to play, and the opponent is frozen solid for 0.75 s. One freeze at a time.',
      bot: 'Arms the moment it can (POWERS.freeze.arm = "any"); striker style — a touch more aggression (+0.06), normal tackling — so it fires it on its way to goal and plays the popped ball itself.',
      sequence: {
        anticipation: 'While armed a big glowing six-armed snowflake and a smaller counter-turning one hang over the champion\'s head in a cyan glow, with a wide frost ring at his feet and cold motes rising.',
        activation: 'Under the super cut-in (focus lines, a giant spinning snowflake on an ice hexagon, icicles dropping from the top of the screen and ice spikes shooting up the bottom): an ice-blue sunburst and glow at the ball, a "קפוא!" word, a frost beam to the opponent\'s feet with a second sunburst there, 30 ice shards, 16 glitter papers, 22 big ❄ flakes left hanging over the whole stadium for 2-3 s, an ice flash, a long cyan edge glow and a 1.6 s deep-blue grade.',
        main: 'The whole screen freezes: an ice-blue wash, frost teeth biting in along the top and bottom edges, big frost fans in all four corners and a blizzard blowing across the stadium. Behind the victim two giant snowflakes turn; nine big dark-edged crystals grow round him in 0.16 s, tips glowing, inside a lit frost dome over a frosted patch. In the last 0.18 s cracks run through the crystals and they tremble.',
        impact: 'Crystal spikes erupt from under the victim\'s feet with a cyan glow, a ring along the ground and vapour puffs.',
        aftermath: 'The cage SNAPS: a white glow and an 18-ray ice sunburst, 48 shards, chips and glitter blowing out, two rings, a big "קראאק!" word, a flash and a sharp shake; then frost light, faint rays and slow stars linger for 2.4 s while ❄ flakes drift down all over the pitch.',
        cleanup: 'Shards fall and fade inside 1 s, flakes and frost light inside 2.8 s; the wash, frost edges and cage go with the effect record.',
      },
      layers: 'Cut-in: focus lines, glow, ice hexagon, 22 icicles, two snowflakes, 9 ice spikes. Back: ice wash, 2 drawGlow, 2 giant snowflakes, 48 edge teeth, frost patch, corner frost (4×5 spikes). Front: 9 faceted crystals (dark + white edges, tips lit by drawGlow) and the frost dome. Particles: glow, rays, stamp, beam, confetti, shards, ❄ glyphs, streaks, vapour, blizzard squares, stars, rings.',
      camera: 'Shake 6 on firing, 3 when the cage lands, 10 on the shatter; a 0.2 s ice-blue flash (0.3), a 1.8 s cyan edge glow and a 1.6 s deep-blue grade (0.12) on firing, a 0.15 s white flash on the snap.',
      hud: 'The engine\'s ❄️ pill with its 0.75 s ring over the victim\'s head.',
      audio: 'Fire: a crystalline chime over a falling icy hiss. Impact: a creaking crackle as the cage grows. End: a glass shatter — a high noise crack with a bright tinkle.',
      counterplay: 'None once it lands — so deny the touch: stay between the ball and your goal before the champion reaches it, and be ready the instant the cage snaps.',
      perf: '~100 particles on firing, ~115 on the snap, ≤4 a frame while alive; ≤11 drawGlow a frame; one shadowBlur, on the aura snowflake only.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), anywhere(), focusLines(), fx.beam, fx.confetti, fx.burst, fx.ring, fx.glyph, fx.emit(shard/smoke/star/streak/sq/glyph), fx.drawGlow, fx.vignette, fx.shake, fx.flash, fx.tint, cutFrame(), snowflake(), s.depth, s.headY, s.headR, envelope().',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 2093, type: 'sine', peak: 0.3, dur: 0.12 }, { k: 'blip', freq: 2637, type: 'sine', peak: 0.25, dur: 0.16, t: 0.06 }, { k: 'thud', freq: 5200, q: 0.8, peak: 0.35, decay: 0.4 }],
      impact: [{ k: 'thud', freq: 3200, q: 6, peak: 0.35, decay: 0.08 }, { k: 'thud', freq: 2800, q: 6, peak: 0.3, decay: 0.08, t: 0.07 }, { k: 'sweep', from: 900, to: 1800, type: 'sine', peak: 0.15, dur: 0.2 }],
      end: [{ k: 'thud', freq: 4200, q: 6, peak: 0.6, decay: 0.09 }, { k: 'thud', freq: 2600, q: 3, peak: 0.4, decay: 0.2, t: 0.02 }, { k: 'blip', freq: 3136, type: 'triangle', peak: 0.18, dur: 0.07, t: 0.04 }],
    },

    aura(g, p, s) {
      const h = head(s, p), f = feet(s, p), R = s.headR(p);
      const y = h.y - R - 30 + Math.sin(s.t * 4) * 3;
      s.fx.drawGlow(g, h.x, y, 46, '#8fe9ff', 0.8);
      s.fx.drawGlow(g, f.x, f.y, 60, '#5ad1f0', 0.5);
      g.save();
      g.strokeStyle = '#5ad1f0'; g.lineWidth = 3; g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(f.x, f.y + 2, 46, 7, 0, 0, TAU); g.stroke();
      g.globalAlpha = 1;
      g.shadowColor = '#8fe9ff'; g.shadowBlur = 12;
      snowflake(g, h.x, y, 20, s.t * 1.5, '#e6fbff', 4);
      g.shadowBlur = 0;
      snowflake(g, h.x + p.side * (R + 22), h.y - R * 0.2, 10, -s.t * 2.5, '#5ad1f0', 2);
      g.restore();
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'dot', x: f.x + s.fx.rand(-30, 30), y: f.y - s.fx.rand(0, 36), vy: -30, r: 2.5, life: 0.7, color: '#e6fbff' });
      }
    },

    cutin(g, s, k) {
      const { C } = s;
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#8fe9ff', 0.4 * c.fade, 2);
      s.fx.drawGlow(g, c.x, c.y, 260 * c.pop, '#8fe9ff', 0.9 * c.fade);
      g.save();
      // an ice-crystal hexagon behind the flake
      g.globalAlpha = 0.55 * c.fade; g.fillStyle = '#1d5fa0';
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = k + (i / 6) * TAU; g.lineTo(c.x + Math.cos(a) * 150 * c.pop, c.y + Math.sin(a) * 150 * c.pop); } g.closePath(); g.fill();
      g.globalAlpha = c.fade; g.strokeStyle = '#e6fbff'; g.lineWidth = 6; g.stroke();
      // frost icicles hanging off the top edge of the screen
      const drop = clamp(k / 0.25, 0, 1);
      g.fillStyle = '#e6fbff'; g.globalAlpha = 0.85 * c.fade;
      g.beginPath();
      for (let i = 0; i < 22; i++) { const x = (i + 0.5) * (s.C.W / 22), L = (30 + hash(i + 70) * 60) * drop; g.moveTo(x - 20, 0); g.lineTo(x, L); g.lineTo(x + 20, 0); }
      g.fill();
      g.globalAlpha = c.fade;
      snowflake(g, c.x, c.y, 120 * c.pop, k * 2, '#e6fbff', 12);
      snowflake(g, c.x, c.y, 70 * c.pop, -k * 3, '#5ad1f0', 6);
      // ice spikes shooting up the bottom of the screen
      const grow = clamp(k / 0.3, 0, 1);
      for (let i = 0; i < 9; i++) {
        const x = (i + 0.5) * (C.W / 9), L = (70 + hash(i + 3) * 70) * grow, w = 26;
        g.fillStyle = i % 2 ? '#8fe9ff' : '#5ad1f0'; g.globalAlpha = 0.8 * c.fade;
        g.beginPath(); g.moveTo(x - w, C.H); g.lineTo(x, C.H - L); g.lineTo(x + w, C.H); g.closePath(); g.fill();
        g.strokeStyle = '#e6fbff'; g.lineWidth = 3; g.globalAlpha = c.fade; g.stroke();
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      blast(s, at.x, at.y, { c1: '#8fe9ff', c2: '#e6fbff', n: 12, word: 'קפוא!', wc: '#e6fbff', edge: '#1d5fa0', spin: 0.8 });
      fx.burst(at.x, at.y, 30, { shape: 'shard', speed: 460, r: 8, spin: 12, grav: 400, life: 0.8, color: '#8fe9ff', color2: '#e6fbff' });
      fx.confetti(at.x, at.y, 16, ['#e6fbff', '#8fe9ff', '#5ad1f0']);
      fx.burst(at.x, at.y, 6, { shape: 'glyph', text: '❄', r: 24, speed: 200, spin: 3, drag: 1.6, life: 1, color: '#e6fbff' });
      fx.ring(at.x, at.y, { color: '#e6fbff', r1: 140, life: 0.45, w: 7 });
      // a beam of frost from the champion to the one it is about to lock up
      const q = feet(s, s.foe), dx = q.x - at.x, dy = (q.y - 20) - at.y;
      fx.beam(at.x, at.y, q.x, q.y - 20, { color: '#5ad1f0', color2: '#e6fbff', w: 20, life: 0.4 });
      for (let i = 0, n = fx.n(8); i < n; i++) {
        const f = i / n;
        fx.emit({ shape: 'streak', x: at.x + dx * f * 0.3, y: at.y + dy * f * 0.3, vx: dx * 2.2, vy: dy * 2.2, r: 8, w: 3, life: 0.35 + f * 0.1, color: '#5ad1f0', blend: 'lighter' });
      }
      // a cold snap over the whole stadium: big flakes hanging in the air for seconds
      for (let i = 0, n = fx.n(22); i < n; i++) {
        fx.emit({ shape: 'glyph', text: '❄', x: fx.rand(20, s.C.W - 20), y: fx.rand(s.C.CEIL_Y, s.C.GROUND_Y - 40), vx: fx.rand(-30, 30), vy: fx.rand(20, 50), spin: fx.rand(-2, 2), r: fx.rand(16, 34), life: fx.rand(1.8, 2.8), color: i % 3 ? '#e6fbff' : '#8fe9ff' });
      }
      fx.rays(q.x, q.y - 40, { color: '#5ad1f0', color2: '#e6fbff', n: 12, r1: 320, life: 0.9, spin: -1.2, alpha: 0.45 });
      fx.flash('#8fe9ff', 0.3, 0.2);
      fx.vignette('#8fe9ff', 0.6, 1.8);
      fx.tint('#1d5fa0', 0.12, 1.6);
      fx.shake(6, 0.25);
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.on != null ? s.M.players[ev.on] : s.foe, f = feet(s, q);
      fx.glow(f.x, f.y - 30, 110, '#5ad1f0', { life: 0.45 });
      fx.burst(f.x, f.y, 18, { shape: 'shard', speed: 340, angle: -Math.PI / 2, spread: 1.8, r: 8, grav: 800, life: 0.55, color: '#e6fbff', color2: '#5ad1f0' });
      fx.ring(f.x, f.y, { color: '#5ad1f0', r1: 120, life: 0.4, w: 5 });
      for (let i = 0; i < fx.n(5); i++) fx.emit({ shape: 'smoke', x: f.x + fx.rand(-40, 40), y: f.y - 6, vy: -30, r: 6, r1: 22, life: 0.9, color: '#e6fbff', layer: 'back' });
      fx.shake(3, 0.2);
    },

    back(g, e, s) {
      const { C } = s;
      const q = victim(s, e), f = feet(s, q);
      const grow = clamp(e.t / 0.16, 0, 1), k = 1 - (1 - grow) ** 3;
      const fade = clamp((e.life - e.t) / 0.15, 0, 1);
      wash(g, s, '#8fe9ff', (e.t < 0.6 ? 0.2 : 0.1) * k * fade, e.t);
      s.fx.drawGlow(g, f.x, f.y - 30, 260 * k, '#8fe9ff', 0.7 * fade);
      s.fx.drawGlow(g, f.x, f.y - 50, 120 * k, '#e6fbff', 0.5 * fade);
      // a giant snowflake turning slowly behind the cage
      g.save();
      g.globalAlpha = 0.55 * k * fade;
      snowflake(g, f.x, f.y - 60, 170 * k, s.t * 0.6, '#e6fbff', 7);
      g.globalAlpha = 0.5 * k * fade;
      snowflake(g, f.x, f.y - 60, 110 * k, -s.t * 0.9, '#5ad1f0', 5);
      // frost teeth biting in along the top and bottom edges of the whole screen
      g.fillStyle = '#e6fbff'; g.globalAlpha = 0.7 * k * fade;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const x = (i + 0.5) * (C.W / 24), L = (26 + hash(i + 50) * 50) * k;
        g.moveTo(x - 22, 0); g.lineTo(x, L); g.lineTo(x + 22, 0);
        g.moveTo(x - 22, C.H); g.lineTo(x, C.H - L * 0.8); g.lineTo(x + 22, C.H);
      }
      g.fill();
      g.strokeStyle = '#1d5fa0'; g.lineWidth = 2; g.globalAlpha = 0.8 * k * fade; g.stroke();
      g.restore();
      g.save();
      g.globalAlpha = 0.5 * k;
      g.fillStyle = '#e6fbff';
      g.beginPath(); g.ellipse(f.x, f.y + 3, 84 * k, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = '#5ad1f0'; g.lineWidth = 2; g.globalAlpha = 0.8 * k;
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, L = (50 + hash(i) * 34) * k;
        g.moveTo(f.x + Math.cos(a) * 14, f.y + 3 + Math.sin(a) * 2);
        g.lineTo(f.x + Math.cos(a) * L, f.y + 3 + Math.sin(a) * 8);
      }
      g.stroke();
      // frost creeping in from the four corners of the screen
      for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [C.W, 0, -1, 1], [0, C.H, 1, -1], [C.W, C.H, -1, -1]]) {
        g.globalAlpha = 0.5 * k * fade; g.fillStyle = '#8fe9ff';
        g.beginPath(); g.moveTo(cx, cy);
        for (let i = 0; i <= 5; i++) {
          const a = (i / 5) * (Math.PI / 2), L = (120 + hash(i + cx) * 90) * k;
          g.lineTo(cx + sx * Math.cos(a) * (i % 2 ? L : L * 0.45), cy + sy * Math.sin(a) * (i % 2 ? L : L * 0.45));
        }
        g.closePath(); g.fill();
        g.globalAlpha = 0.8 * k * fade; g.strokeStyle = '#e6fbff'; g.stroke();
      }
      g.restore();
    },

    front(g, e, s) {
      const q = victim(s, e), f = feet(s, q), h = head(s, q), R = s.headR(q);
      const grow = clamp(e.t / 0.16, 0, 1), k = 1 - (1 - grow) ** 3;
      const cracking = e.life - e.t < 0.18;
      const jx = cracking ? (Math.random() - 0.5) * 4 : 0;
      const W = s.C.BODY_W / 2 + 8, hy = h.y - f.y;
      // [x, y from the feet, length, lean] — ground crystals round the body, two at the head's
      // sides, one on top: a cage outside the silhouette, never on it
      const spots = [[-W - 4, 0, 86, -0.22], [W + 4, 0, 86, 0.22], [-W - 24, 0, 62, -0.5], [W + 24, 0, 62, 0.5],
        [-W - 44, 0, 40, -0.85], [W + 44, 0, 40, 0.85],
        [-(R + 8), hy + 6, 44, -1.05], [R + 8, hy + 6, 44, 1.05], [0, hy - R - 2, 36, 0]];
      g.save();
      g.translate(f.x + jx, f.y);
      // the frost dome holding it together
      g.globalAlpha = 0.1 * k; g.fillStyle = '#8fe9ff';
      const top = hy - R - 12, cy = top / 2, ry = -top / 2 + 12;
      g.beginPath(); g.ellipse(0, cy, R + 34, ry, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.5 * k; g.strokeStyle = '#5ad1f0'; g.lineWidth = 3; g.stroke();
      g.lineJoin = 'round';
      spots.forEach(([x, y, L, lean], i) => {
        const len = L * k, w = 8 + (i % 2);
        s.fx.drawGlow(g, x + Math.sin(lean) * len, y - Math.cos(lean) * len, 16, '#e6fbff', 0.8 * k);
        g.save();
        g.translate(x, y); g.rotate(lean);
        g.globalAlpha = 0.6; g.fillStyle = '#8fe9ff';
        g.beginPath();
        g.moveTo(-w * 0.6, 0); g.lineTo(-w, -len * 0.7); g.lineTo(0, -len); g.lineTo(w, -len * 0.7); g.lineTo(w * 0.6, 0);
        g.closePath(); g.fill();
        g.globalAlpha = 0.8; g.strokeStyle = '#0b2c4a'; g.lineWidth = 5; g.stroke();
        g.globalAlpha = 0.95; g.strokeStyle = '#e6fbff'; g.lineWidth = 2.5; g.stroke();
        // the facet down its middle
        g.strokeStyle = '#1d5fa0'; g.globalAlpha = 0.6; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -len * 0.9); g.lineTo(0, -len * 0.15); g.stroke();
        if (cracking) {
          g.strokeStyle = '#0b2c4a'; g.globalAlpha = 0.9;
          g.beginPath(); g.moveTo(-w * 0.8, -len * 0.3); g.lineTo(w * 0.2, -len * 0.45); g.lineTo(-w * 0.3, -len * 0.62); g.lineTo(w * 0.7, -len * 0.75); g.stroke();
        }
        g.restore();
      });
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      const q = victim(s, e), f = feet(s, q);
      if (Math.random() < 0.5) {
        fx.emit({ shape: 'smoke', x: f.x + fx.rand(-70, 70), y: f.y - fx.rand(0, 70), vy: -22, vx: fx.rand(-8, 8), r: 6, r1: 24, life: 0.8, alpha: 0.6, color: '#e6fbff', layer: 'back' });
      }
      if (Math.random() < 0.3) fx.emit({ shape: 'star', x: f.x + fx.rand(-80, 80), y: f.y - 120, vy: 40, spin: 3, r: 5, life: 0.7, color: '#8fe9ff' });
      // a blizzard blowing across the whole stadium
      fx.emit({ shape: 'sq', x: fx.rand(-40, s.C.W), y: fx.rand(0, s.C.GROUND_Y), vx: fx.rand(260, 420), vy: fx.rand(60, 140), r: fx.rand(2.5, 5), life: 1.2, color: '#e6fbff' });
      if (Math.random() < 0.5) anywhere(s, { shape: 'glyph', text: '❄', r: fx.rand(14, 24), vx: 120, vy: 50, spin: 2, life: 1.4, color: '#8fe9ff' });
    },

    end(s, info) {
      const { fx } = s;
      const q = victim(s, info.e), f = feet(s, q);
      const cy = f.y - 40;
      // the snap: everything at once, and fast
      fx.glow(f.x, cy, 220, '#e6fbff', { life: 0.5, alpha: 1 });
      fx.rays(f.x, cy, { color: '#8fe9ff', color2: '#e6fbff', n: 18, r1: 420, life: 0.8, spin: 2.6, alpha: 0.5 });
      fx.burst(f.x, cy, 48, { shape: 'shard', speed: 620, r: 10, spin: 20, grav: 900, life: 1, color: '#8fe9ff', color2: '#e6fbff' });
      fx.burst(f.x, cy, 12, { shape: 'sq', speed: 380, r: 4, grav: 700, life: 0.7, color: '#e6fbff' });
      fx.confetti(f.x, cy, 16, ['#8fe9ff', '#e6fbff', '#5ad1f0']);
      fx.ring(f.x, cy, { color: '#e6fbff', r: 20, r1: 240, life: 0.45, w: 9, layer: 'front' });
      fx.ring(f.x, cy, { color: '#5ad1f0', r: 10, r1: 150, life: 0.5, w: 5, layer: 'front' });
      fx.stamp(f.x, cy - 90, 'קראאק!', { color: '#8fe9ff', edge: '#0b2c4a', r: 60, life: 1.3 });
      // the snap leaves the stadium glittering: frost light and flakes drifting down for 2 s
      linger(s, f.x, cy, { c1: '#8fe9ff', c2: '#e6fbff', R: 230, n: 18, life: 2.4, vy: 30, w: 260, mote: { shape: 'star', spin: 3, r: 5 } });
      for (let i = 0; i < fx.n(14); i++) fx.emit({ shape: 'glyph', text: '❄', x: fx.rand(20, s.C.W - 20), y: fx.rand(s.C.CEIL_Y, cy), vy: fx.rand(30, 60), vx: fx.rand(-20, 20), spin: fx.rand(-2, 2), r: fx.rand(16, 30), life: fx.rand(1.8, 2.6), color: i % 2 ? '#e6fbff' : '#5ad1f0' });
      fx.flash('#e6fbff', 0.3, 0.15);
      fx.shake(10, 0.35);
    },
  },

  // ── 21 · meteor — the asteroid ────────────────────────────────────────────
  meteor: {
    theme: 'Asteroid re-entry',
    visual: 'a rock with molten cracks climbing to the sky and diving back in a long plasma tail, crater blast with rock debris and dust',
    palette: ['#ff5a1f', '#3a2a22', '#ffc49a', '#8a2b0e', '#5c4a3d', '#ffe6c7'],
    doc: {
      fantasy: 'The champion boots the ball into orbit and it comes back down as a flaming meteor, straight into the net.',
      purpose: 'The first shot of the tier that is not flat: it climbs, turns and dives, so a keeper who reads flat lines is beaten from above — it teaches looking up.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball rockets up at 1.25× power-shot speed (drifting 0.3× forward) until 60 px under the ceiling or 0.55 s, then dives at 1.1× speed at the goal mouth, 45% of the way up the goal. It lives 2.2 s. Blockable by a body (it costs health) and counterable by a timed kick like any power shot.',
      bot: 'Arms only on attack (POWERS.meteor.arm = "attack": the ball past 40% of the pitch toward the far goal and not behind it); striker style (+0.06 aggression, normal tackling).',
      sequence: {
        anticipation: 'While armed three big molten-rimmed rocks orbit the champion\'s head, each lit by its own orange glow, with embers rising off them.',
        activation: 'Under the super cut-in (focus lines and a giant flaming meteor streaking past the band through a rain of smaller ones): an orange sunburst and glow at the ball, a "שיגור!" word, a launch beam shooting up to the sky, rock chips, ember streaks and sparks thrown upward, dust rolling out at the champion\'s feet, an orange flash and edge glow, and a kick of the camera.',
        main: 'The sky catches fire (a huge orange glow over the ball\'s side of the roof) and a meteor shower rakes the whole stadium behind it. The ball becomes a huge tumbling rock (1.7× climbing, 2.3× diving) with glowing cracks; climbing it drags flame and smoke, at the top it flares with a ring and a whistle, then dives with a long three-layer plasma tail, a bow shock and a white-hot glow. A pulsing dark-edged target reticle with a "!" locks onto the goal it will hit. A bright ring and core sit exactly on the real ball, drawn last.',
        impact: 'Crater: a huge white-hot glow, two sunbursts, a pillar of fire punched up to the sky, a "בום!" word, a fire ring and a wide dust ring, 36 rock chunks, 24 embers, 20 white-hot streaks and rock confetti, dust clouds, the heaviest shake of the shots, a white flash, an orange edge glow and a scorched grade.',
        aftermath: 'The crater smoulders for 2.6 s: a glowing pit, faint slow rays, flames and embers licking up and twelve dark smoke columns rising out of it.',
        cleanup: 'Debris runs out inside 1.6 s, smoke and embers inside 3 s.',
      },
      layers: 'Cut-in: focus lines, glow, 7 raining meteors, 3-layer tail, rock body and cracks. Back: meteor-shower streaks, smoke and dust. Ball: sky drawGlow, target reticle (dark + bright rings, crosshair, "!" label) with its glow, halo and bow glow, plasma tail (3 tapered flames), bow shock, rock with shadow glow, highlight lobe, molten cracks, then the real-ball ring and core. Particles: glow, rays, beam, stamp, confetti, smoke, embers, shards, streaks, rings.',
      camera: 'Shake 7 on launch, 16 on the crater; flashes 0.2 s on launch and 0.25 s white on impact; a 0.8 s orange vignette each time; a 0.6 s scorched tint at alpha 0.14.',
      hud: 'The ordinary meter and armed glow; the ☄️ banner on firing. No lingering status — the power is the shot.',
      audio: 'Fire: a deep rumble under a rising roar. At the turn a falling whistle. Impact: a huge low boom with rock crunch. End: a crackle of cooling stone.',
      counterplay: 'It lands on a fixed spot — 45% up the goal mouth — so stand under the goal and jump into the dive; or kick it on the way up to counter. Charging out leaves the net to the dive.',
      perf: '~75 particles on launch, ~110 on the crater, ≤4 a frame in flight; ball ≤5 drawGlow and one shadowBlur on the rock; the tail is 3 filled paths.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), focusLines(), label(), fx.beam, fx.burst, fx.confetti, fx.ring, fx.emit(smoke/shard/streak/sq/dot), fx.drawGlow, fx.vignette, fx.shake, fx.flash, fx.tint, fx.sound (the turn whistle), cutFrame(), s.depth, rockPath().',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 70, q: 0.6, peak: 0.9, decay: 0.6 }, { k: 'sweep', from: 90, to: 420, type: 'sawtooth', peak: 0.35, dur: 0.5 }],
      impact: [{ k: 'thud', freq: 55, q: 0.5, peak: 1, decay: 0.9 }, { k: 'thud', freq: 900, q: 1.5, peak: 0.5, decay: 0.25 }, { k: 'thud', freq: 240, q: 2, peak: 0.4, decay: 0.4, t: 0.08 }],
      end: [{ k: 'thud', freq: 1800, q: 1.2, peak: 0.15, decay: 0.7 }, { k: 'thud', freq: 700, q: 3, peak: 0.1, decay: 0.3, t: 0.2 }],
    },

    aura(g, p, s) {
      const h = head(s, p), R = s.headR(p);
      g.save();
      for (let i = 0; i < 3; i++) {
        const a = s.t * 2.2 + (i / 3) * TAU;
        const x = h.x + Math.cos(a) * (R + 26), y = h.y - 6 + Math.sin(a) * (R * 0.5 + 8);
        s.fx.drawGlow(g, x, y, 30, '#ff5a1f', 0.8);
        g.save();
        g.translate(x, y);
        g.fillStyle = '#ff5a1f'; g.globalAlpha = 0.9;
        rockPath(g, 15, s.t * 3 + i, i * 9); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#3a2a22';
        rockPath(g, 11, s.t * 3 + i, i * 9); g.fill();
        g.strokeStyle = '#ffc49a'; g.lineWidth = 2; g.stroke();
        g.restore();
      }
      g.restore();
      if (Math.random() < 0.4) {
        s.fx.emit({ shape: 'sq', x: h.x + s.fx.rand(-R - 24, R + 24), y: h.y + s.fx.rand(-10, 10), vy: -70, r: 3, life: 0.6, color: '#ffc49a', color2: '#8a2b0e' });
      }
    },

    cutin(g, s, k) {
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      // a giant meteor streaking down past the band, from high on the champion's side
      const x = c.x + (k - 0.5) * 260 * c.from, y = c.y - 60 + k * 120, r = 64 * c.pop;
      const ux = 0.8 * c.from, uy = 0.6, nx = -uy, ny = ux;
      focusLines(g, s, x, y, '#ff5a1f', 0.4 * c.fade, 3);
      s.fx.drawGlow(g, x, y, r * 4, '#ff5a1f', 0.95 * c.fade);
      // smaller meteors raining past it
      g.save();
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const u = (k * 1.4 + hash(i + 30)) % 1, sx = hash(i + 31) * s.C.W, sy = u * s.C.H * 0.8;
        g.globalAlpha = 0.8 * c.fade; g.strokeStyle = i % 2 ? '#ffc49a' : '#ff5a1f'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - ux * 90, sy - uy * 90); g.stroke();
      }
      g.restore();
      g.save();
      g.translate(x, y);
      g.globalCompositeOperation = 'lighter';
      [['#8a2b0e', r * 1.3, 380], ['#ff5a1f', r * 0.95, 290], ['#ffc49a', r * 0.5, 200]].forEach(([col, w, l], i) => {
        const fl = l * (1 + Math.sin(k * 60 + i * 2) * 0.06);
        g.globalAlpha = 0.8 * c.fade; g.fillStyle = col;
        g.beginPath();
        g.moveTo(nx * w, ny * w);
        g.quadraticCurveTo(-ux * fl * 0.4 + nx * w * 0.7, -uy * fl * 0.4 + ny * w * 0.7, -ux * fl, -uy * fl);
        g.quadraticCurveTo(-ux * fl * 0.4 - nx * w * 0.7, -uy * fl * 0.4 - ny * w * 0.7, -nx * w, -ny * w);
        g.closePath(); g.fill();
      });
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = c.fade;
      g.fillStyle = '#3a2a22'; rockPath(g, r, k * 4, 3); g.fill();
      g.strokeStyle = '#ffc49a'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#5c4a3d'; disc(g, -r * 0.25, -r * 0.3, r * 0.4);
      g.strokeStyle = '#ff5a1f'; g.lineWidth = 6; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = k * 4 + i * 1.7;
        g.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        g.lineTo(Math.cos(a + 0.4) * r * 0.5, Math.sin(a + 0.4) * r * 0.5);
        g.lineTo(Math.cos(a + 0.1) * r * 0.85, Math.sin(a + 0.1) * r * 0.85);
      }
      g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx, C } = s;
      blast(s, at.x, at.y, { c1: '#ff5a1f', c2: '#ffe6c7', n: 12, word: 'שיגור!', wc: '#ffc49a', edge: '#3a2a22', wy: at.y + 70, spin: 2 });
      // the launch beam: a column of fire from the boot to the sky
      fx.beam(at.x, at.y, at.x + s.side * 40, C.CEIL_Y, { color: '#ff5a1f', color2: '#ffe6c7', w: 26, life: 0.4 });
      fx.burst(at.x, at.y, 20, { shape: 'shard', speed: 420, angle: -Math.PI / 2, spread: 1.4, r: 7, spin: 12, grav: 1000, life: 0.9, color: '#5c4a3d' });
      fx.burst(at.x, at.y, 18, { shape: 'streak', speed: 620, angle: -Math.PI / 2, spread: 0.8, life: 0.35, w: 3, color: '#ff5a1f', color2: '#ffc49a' });
      fx.burst(at.x, at.y, 12, { shape: 'sq', speed: 380, r: 4, grav: 500, drag: 1, life: 0.7, color: '#ffc49a', color2: '#ff5a1f' });
      const f = feet(s, s.owner);
      fx.ring(f.x, f.y, { color: '#5c4a3d', r1: 160, life: 0.55, w: 8 });
      fx.ring(at.x, at.y, { color: '#ff5a1f', r1: 130, life: 0.4, w: 6 });
      fx.burst(f.x, f.y - 4, 10, { shape: 'smoke', speed: 110, angle: -Math.PI / 2, spread: 2.6, r: 9, r1: 30, drag: 1.5, life: 1.1, color: '#5c4a3d', layer: 'back' });
      fx.flash('#ff5a1f', 0.28, 0.2);
      fx.vignette('#ff5a1f', 0.5, 0.8);
      fx.shake(7, 0.3);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y);
      const pw = b.power, dive = !!pw && pw.phase === 1;
      const r = b.r * (dive ? 2.3 : 1.7);
      const sp = Math.hypot(b.vx, b.vy);
      const ux = sp > 1 ? b.vx / sp : 0, uy = sp > 1 ? b.vy / sp : 1;
      const nx = -uy, ny = ux;
      const { C } = s;
      // the sky catches fire over the whole stadium while it is up there
      s.fx.drawGlow(g, d.x, C.CEIL_Y, 560, dive ? '#ff5a1f' : '#8a2b0e', dive ? 0.5 : 0.4);
      // the landing zone: a red target locked on the goal it is going to hit
      if (pw) {
        const tx = pw.dir > 0 ? C.W - C.GOAL_W * 0.55 : C.GOAL_W * 0.55, ty = C.GROUND_Y - C.GOAL_H * 0.45;
        const T = s.depth(tx, ty), pulse = 0.5 + 0.5 * Math.sin(s.t * (dive ? 24 : 12));
        const tr = 44 + 12 * pulse + (dive ? 0 : 16);
        s.fx.drawGlow(g, T.x, T.y, tr * 2.4, '#ff5a1f', 0.45 + 0.35 * pulse);
        g.save();
        g.translate(T.x, T.y); g.rotate(s.t * 2);
        g.lineCap = 'round';
        for (const [col, w] of [['#2a0f06', 8], [pulse > 0.5 ? '#ffe6c7' : '#ff5a1f', 4]]) {
          g.strokeStyle = col; g.lineWidth = w;
          g.beginPath(); g.arc(0, 0, tr, 0, TAU); g.stroke();
          g.beginPath(); g.arc(0, 0, tr * 0.55, 0, TAU); g.stroke();
          g.beginPath();
          for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; g.moveTo(Math.cos(a) * tr * 0.7, Math.sin(a) * tr * 0.7); g.lineTo(Math.cos(a) * tr * 1.35, Math.sin(a) * tr * 1.35); }
          g.stroke();
        }
        g.restore();
        g.save();
        g.globalAlpha = pulse > 0.3 ? 1 : 0.4;
        label(g, '!', T.x, T.y - tr - 26, 40, '#ffe6c7', '#8a2b0e');
        g.restore();
      }
      s.fx.drawGlow(g, d.x, d.y, r * (dive ? 4.6 : 3.4), '#ff5a1f', 0.9);
      if (dive) s.fx.drawGlow(g, d.x + ux * r, d.y + uy * r, r * 1.8, '#ffe6c7', 0.75);
      g.save();
      g.translate(d.x, d.y);
      // the re-entry tail: three tapered flames trailing opposite the travel, flickering
      g.globalCompositeOperation = 'lighter';
      const L = dive ? 240 : 70;
      const layers = [['#8a2b0e', r * 1.45, L], ['#ff5a1f', r * 1.05, L * 0.75], ['#ffc49a', r * 0.55, L * 0.45]];
      layers.forEach(([c, w, l], i) => {
        const fl = l * (1 + Math.sin(s.t * 40 + i * 2) * 0.08);
        g.globalAlpha = 0.8;
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(nx * w, ny * w);
        g.quadraticCurveTo(-ux * fl * 0.4 + nx * w * 0.7, -uy * fl * 0.4 + ny * w * 0.7, -ux * fl, -uy * fl);
        g.quadraticCurveTo(-ux * fl * 0.4 - nx * w * 0.7, -uy * fl * 0.4 - ny * w * 0.7, -nx * w, -ny * w);
        g.closePath(); g.fill();
      });
      // the bow shock blazing ahead of it on the way down
      if (dive) {
        const a = Math.atan2(uy, ux);
        g.globalAlpha = 0.9; g.strokeStyle = '#ffe6c7'; g.lineWidth = 4;
        g.beginPath(); g.arc(ux * 4, uy * 4, r + 7, a - 1.1, a + 1.1); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // the rock, tumbling
      const rot = s.t * 6 * (pw ? pw.dir : 1);
      g.shadowColor = '#ff5a1f'; g.shadowBlur = dive ? 18 : 10;
      g.fillStyle = '#3a2a22';
      rockPath(g, r, rot, 3); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#5c4a3d';
      g.beginPath(); g.arc(-r * 0.25, -r * 0.3, r * 0.45, 0, TAU); g.fill();
      // molten cracks, brighter in the dive
      g.strokeStyle = dive ? '#ffc49a' : '#ff5a1f'; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = rot + i * 1.7;
        g.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        g.lineTo(Math.cos(a + 0.4) * r * 0.5, Math.sin(a + 0.4) * r * 0.5);
        g.lineTo(Math.cos(a + 0.1) * r * 0.85, Math.sin(a + 0.1) * r * 0.85);
      }
      g.stroke();
      // the real ball, last: a bright ring and core exactly where it is
      g.strokeStyle = '#ffe6c7'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.stroke();
      g.fillStyle = '#ffe6c7';
      disc(g, 0, 0, 4);
      g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const pw = b.power;
      const st = pw ? memo(pw, () => ({ phase: pw.phase })) : null;
      // the turn at the top: a flare and the whistle of the dive starting
      if (st && pw.phase !== st.phase) {
        st.phase = pw.phase;
        fx.ring(b.x, b.y, { color: '#ffc49a', r: 10, r1: 110, life: 0.35, w: 5, layer: 'front' });
        fx.glow(b.x, b.y, 120, '#ffc49a', { life: 0.35 });
        fx.sound([{ k: 'sweep', from: 2400, to: 500, type: 'sine', peak: 0.25, dur: 0.6 }]);
      }
      // a meteor shower raking the sky behind it, the whole time it flies
      const dir = pw ? pw.dir : 1;
      if (Math.random() < 0.6) {
        fx.emit({ shape: 'streak', x: fx.rand(-100, s.C.W), y: fx.rand(0, s.C.GROUND_Y * 0.55), vx: dir * fx.rand(380, 560), vy: fx.rand(300, 420), r: 34, w: fx.rand(3, 6), life: 0.55, color: Math.random() < 0.5 ? '#ffc49a' : '#ff5a1f', color2: '#8a2b0e', layer: 'back', blend: 'lighter' });
      }
      if (pw && pw.phase === 1) {
        fx.emit({ shape: 'smoke', x: b.x - b.vx * 0.02, y: b.y - b.vy * 0.02, vx: fx.rand(-30, 30), vy: fx.rand(-30, 30), r: 12, r1: 30, life: 0.5, color: '#ff5a1f', color2: '#3a2a22', blend: 'lighter' });
        fx.emit({ shape: 'smoke', x: b.x - b.vx * 0.06, y: b.y - b.vy * 0.06, vy: -20, r: 10, r1: 34, life: 1, color: '#5c4a3d', layer: 'back' });
        if (Math.random() < 0.6) fx.emit({ shape: 'sq', x: b.x, y: b.y, vx: -b.vx * 0.15 + fx.rand(-90, 90), vy: -b.vy * 0.15 + fx.rand(-90, 90), grav: 400, r: 4, life: 0.5, color: '#ffc49a' });
        else fx.emit({ shape: 'streak', x: b.x, y: b.y, vx: -b.vx * 0.4 + fx.rand(-60, 60), vy: -b.vy * 0.4 + fx.rand(-60, 60), r: 6, w: 3, life: 0.25, color: '#ff5a1f' });
      } else {
        fx.emit({ shape: 'smoke', x: b.x, y: b.y + 12, vx: fx.rand(-10, 10), vy: 20, r: 7, r1: 24, life: 0.8, color: '#5c4a3d', layer: 'back' });
        if (Math.random() < 0.6) fx.emit({ shape: 'sq', x: b.x, y: b.y + 8, vx: fx.rand(-50, 50), vy: 70, r: 3, life: 0.4, color: '#ff5a1f' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const d = s.depth(ev.x, ev.y);
      blast(s, d.x, d.y, { c1: '#ff5a1f', c2: '#ffe6c7', R: 240, n: 18, rayR: 460, word: 'בום!', wc: '#ffe6c7', edge: '#8a2b0e', wr: 76, wy: d.y - 90, spin: 0.9 });
      fx.ring(d.x, d.y, { color: '#ff5a1f', r1: 200, life: 0.55, w: 10 });
      fx.ring(d.x, d.y, { color: '#5c4a3d', r: 20, r1: 280, life: 0.8, w: 12 });
      fx.burst(d.x, d.y, 36, { shape: 'shard', speed: 560, r: 8, spin: 12, grav: 1100, life: 1, color: '#3a2a22', color2: '#5c4a3d' });
      fx.burst(d.x, d.y, 24, { shape: 'sq', speed: 420, r: 4, grav: 500, life: 0.8, color: '#ffc49a', color2: '#ff5a1f' });
      fx.burst(d.x, d.y, 10, { shape: 'smoke', speed: 140, r: 12, r1: 40, drag: 2, life: 1.4, color: '#8a2b0e', color2: '#5c4a3d', layer: 'back' });
      // a pillar of fire punched straight up out of the crater, and a second slower sunburst
      fx.beam(d.x, d.y, d.x, 0, { color: '#ff5a1f', color2: '#ffe6c7', w: 46, life: 0.5 });
      fx.rays(d.x, d.y, { color: '#8a2b0e', color2: '#ffc49a', n: 10, r1: 600, life: 1.3, spin: -0.5, alpha: 0.4 });
      fx.burst(d.x, d.y, 20, { shape: 'streak', speed: 760, r: 12, w: 4, drag: 1.5, life: 0.5, color: '#ffe6c7', color2: '#ff5a1f' });
      fx.confetti(d.x, d.y, 14, ['#ff5a1f', '#ffc49a', '#8a2b0e', '#5c4a3d'], { life: 1.6 });
      fx.flash('#ffe6c7', 0.35, 0.25);
      fx.vignette('#ff5a1f', 0.55, 0.9);
      fx.tint('#3a2a22', 0.14, 0.6);
      fx.shake(16, 0.55);
    },

    end(s, info) {
      const { fx } = s;
      const b = s.M.ball, d = s.depth(b.x, b.y);
      // the crater smoulders for seconds: a glowing pit, flames licking up, a smoke column
      fx.glow(d.x, d.y, 140, '#8a2b0e', { life: 2.6, alpha: 0.9 });
      linger(s, d.x, d.y, { c1: '#ff5a1f', c2: '#ffc49a', R: 240, n: 20, life: 2.6, vy: -60, w: 70, h: 20, rn: 8, rayR: 380, mote: { shape: 'sq', r: 4, drag: 0.4 } });
      for (let i = 0; i < fx.n(12); i++) {
        fx.emit({ shape: 'smoke', x: d.x + fx.rand(-34, 34), y: d.y, vy: -40 - i * 7, vx: fx.rand(-10, 10), r: 10, r1: 44, life: fx.rand(1.8, 2.8), color: i % 3 ? '#3a2a22' : '#5c4a3d', layer: 'back' });
        fx.emit({ shape: 'streak', x: d.x + fx.rand(-30, 30), y: d.y, vy: -fx.rand(90, 200), vx: fx.rand(-20, 20), r: 8, w: 4, life: fx.rand(0.8, 1.8), color: '#ffc49a', color2: '#ff5a1f', blend: 'lighter' });
      }
    },
  },

  // ── 22 · drain — the siphon ───────────────────────────────────────────────
  drain: {
    theme: 'Energy siphon thief',
    visual: 'green-black energy tether from victim to thief, stolen meter orbs arcing across, a padlock clamped by the victim',
    palette: ['#00d68f', '#0a1f17', '#b3ffe3', '#2e8a63', '#c6ff4a'],
    doc: {
      fantasy: 'The champion plugs into the opponent and siphons his power away — then padlocks his meter.',
      purpose: 'A power against powers: it empties the rival\'s meter, cancels his armed ultimate and every effect he has running, and locks his meter so he cannot answer for 5 s.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. You take all of the opponent\'s meter (60% of it lands in yours), his armed power and running effects are cancelled, his meter cannot fill for 5 s, and the ball is struck at goal on a lofted line.',
      bot: 'Arms the moment it can (POWERS.drain.arm = "any"); brawler style (no extra aggression, 1.35× tackling), so it tends to fire it in a scramble.',
      sequence: {
        anticipation: 'While armed a wide dark halo with five green arcs turns round the champion\'s head in a green glow, and lime motes are sucked into it.',
        activation: 'Under the super cut-in (focus lines, energy motes streaming in from all over the screen to a giant green siphon vortex with a padlock at its heart): an implosion at the ball — a green sunburst turning backwards, a "שלורפ!" word, rings collapsing inward, 36 pale streaks pulled into the point — a green siphon beam from the opponent to the champion with 16 lime orbs, a backwards sunburst on the victim, and on the thief a lime glow, ring and green confetti; a dark flash and a long green edge glow.',
        main: 'For 5 s the stadium goes toxic green (wash ≤0.22). A dark siphon vortex with five spiral arms churns under the victim, chains wrap round his body and a big glowing padlock hangs beside his head; the thief burns with a flickering lime flame aura. A thick two-strand tether writhes between their chests with orbs running along it, and energy motes from all over the pitch stream into the thief; after 0.9 s the tether thins to a thread.',
        impact: 'The theft: 5-17 glowing orbs (more when more meter was stolen) arc from the victim to the champion, with "−N%" and "+N%" comic stamps over them and a lime glow on the thief. The padlock clamps on with a ring and a "נעול!" word.',
        aftermath: 'The shackle lifts over the last 0.4 s, then the lock bursts: a green sunburst and glow, chips, glass shards and confetti, a pale ring and a big "קליק!" word; green light and motes linger for 2 s.',
        cleanup: 'Orbs are timed to die as they reach the thief; chips fade in 0.7 s, confetti and motes in 2.4 s.',
      },
      layers: 'Cut-in: focus lines, glow, 16 streaming motes, 5-arm vortex, padlock. Back: toxic wash, victim vortex (dark ellipse + 5 arms) with drawGlow, thief flame aura (7 tongues, lighter) with drawGlow. Over (so it reads in the goal): suction ring, tether (dark 10px + green 5px strands), travelling orbs, chain links, padlock with its glow. Particles: glow, rays, beam, stamp, confetti, orbs, streaks, glyphs, rings, chips, shards.',
      camera: 'Shake 6 on firing, 3 on the clamp; a dark 0.25 s flash at alpha 0.25 and a 1 s green vignette on firing. No grade.',
      hud: 'The engine\'s 🫳 pill with its 5 s ring over the victim; the % stamps show the real amount stolen.',
      audio: 'Fire: a reverse suck — a falling sawtooth into a low gulp. Impact: a bubbling slurp of rising blips. End: a click-clack of a lock opening.',
      counterplay: 'Spend your meter before the drain champion reaches the ball — an armed power stolen is a power wasted. Under the lock, play plain football for 5 s.',
      perf: '~80 particles on firing, ≤18 orbs on the theft, ≤4 a frame while alive, ~80 on the unlock; tether is 2 polylines of 17 points with one shadowBlur on the green strand, ≤9 drawGlow a frame.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), anywhere(), focusLines(), fx.beam, fx.confetti, fx.burst, fx.ring, fx.glyph, fx.emit(dot/streak/sq/smoke/glyph), fx.drawGlow, fx.vignette, fx.shake, fx.flash, cutFrame(), padlock(), s.depth, s.headY, s.headR, envelope().',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 1400, to: 90, type: 'sawtooth', peak: 0.35, dur: 0.35 }, { k: 'thud', freq: 110, q: 3, peak: 0.6, decay: 0.2, t: 0.3 }],
      impact: [{ k: 'blip', freq: 330, type: 'sine', peak: 0.3, dur: 0.08 }, { k: 'blip', freq: 440, type: 'sine', peak: 0.3, dur: 0.08, t: 0.08 }, { k: 'blip', freq: 587, type: 'sine', peak: 0.3, dur: 0.1, t: 0.16 }, { k: 'sweep', from: 200, to: 700, type: 'square', peak: 0.12, dur: 0.3 }],
      end: [{ k: 'thud', freq: 2400, q: 8, peak: 0.4, decay: 0.05 }, { k: 'thud', freq: 1600, q: 8, peak: 0.35, decay: 0.06, t: 0.09 }],
    },

    aura(g, p, s) {
      const h = head(s, p), R = s.headR(p);
      s.fx.drawGlow(g, h.x, h.y, R + 50, '#00d68f', 0.6);
      g.save();
      g.globalAlpha = 0.6; g.strokeStyle = '#0a1f17'; g.lineWidth = 10;
      g.beginPath(); g.arc(h.x, h.y, R + 16, 0, TAU); g.stroke();
      g.globalAlpha = 1; g.strokeStyle = '#00d68f'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = -s.t * 3 + (i / 5) * TAU;
        g.beginPath(); g.arc(h.x, h.y, R + 16, a, a + 0.7); g.stroke();
      }
      g.strokeStyle = '#c6ff4a'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = s.t * 4 + (i / 3) * TAU;
        g.beginPath(); g.arc(h.x, h.y, R + 26, a, a + 0.4); g.stroke();
      }
      g.restore();
      // motes pulled in: born on a wide circle, timed to reach the halo as they die
      if (Math.random() < 0.45) {
        const a = Math.random() * TAU, d = R + 80, life = 0.5;
        s.fx.emit({ shape: 'dot', x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, vx: -Math.cos(a) * 62 / life, vy: -Math.sin(a) * 62 / life, r: 3, life, color: '#c6ff4a', blend: 'lighter' });
      }
    },

    cutin(g, s, k) {
      const c = cutFrame(s, k), R = 120 * c.pop;
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#00d68f', 0.4 * c.fade, 4);
      s.fx.drawGlow(g, c.x, c.y, R * 2.4, '#00d68f', 0.9 * c.fade);
      // energy motes streaming into the vortex from all over the screen
      g.save();
      g.fillStyle = '#c6ff4a';
      for (let i = 0; i < 16; i++) {
        const u = (k * 2 + hash(i + 60)) % 1, a = hash(i + 61) * TAU, r = (1 - u) * 420 + R * 0.4;
        g.globalAlpha = c.fade * u;
        disc(g, c.x + Math.cos(a - u) * r, c.y + Math.sin(a - u) * r * 0.7, 4 + 4 * u);
      }
      g.restore();
      g.save();
      g.translate(c.x, c.y);
      g.globalAlpha = 0.7 * c.fade; g.fillStyle = '#0a1f17';
      disc(g, 0, 0, R * 0.55);
      // the siphon vortex: five arms winding into the lock
      g.lineCap = 'round';
      for (let arm = 0; arm < 5; arm++) {
        g.strokeStyle = arm % 2 ? '#c6ff4a' : '#00d68f'; g.lineWidth = 9; g.globalAlpha = c.fade;
        g.beginPath();
        for (let i = 0; i <= 16; i++) { const f = i / 16, a = -k * 9 + arm * (TAU / 5) + f * 3.4, r = R * (1 - f * 0.7); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.stroke();
      }
      g.scale(3.2 * c.pop, 3.2 * c.pop);
      padlock(g, 0, 0, 0);
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      blast(s, at.x, at.y, { c1: '#00d68f', c2: '#c6ff4a', n: 14, word: 'שלורפ!', wc: '#c6ff4a', edge: '#0a1f17', spin: -3 });
      fx.ring(at.x, at.y, { color: '#00d68f', r: 140, r1: 4, life: 0.4, w: 7, layer: 'front' });
      fx.ring(at.x, at.y, { color: '#c6ff4a', r: 90, r1: 2, life: 0.32, w: 4, layer: 'front' });
      for (let i = 0, n = fx.n(36); i < n; i++) {
        const a = (i / n) * TAU, life = 0.36, d = 110 + (i % 3) * 40;
        fx.emit({ shape: 'streak', x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, vx: -Math.cos(a) * d / life, vy: -Math.sin(a) * d / life, r: 7, w: 3, life, color: i % 2 ? '#b3ffe3' : '#00d68f' });
      }
      // the siphon: a green beam out of the victim's chest into the thief's, orbs flying along it
      const q = s.foe, o = s.owner;
      const A = s.depth(q.x, q.y - s.C.BODY_H / 2), B = s.depth(o.x, o.y - s.C.BODY_H / 2);
      fx.beam(A.x, A.y, B.x, B.y, { color: '#00d68f', color2: '#c6ff4a', w: 20, life: 0.5 });
      for (let i = 0, n = fx.n(16); i < n; i++) {
        const life = 0.3 + (i / n) * 0.4;
        fx.emit({ shape: 'dot', x: A.x, y: A.y + fx.rand(-8, 8), vx: (B.x - A.x) / life, vy: (B.y - A.y) / life + fx.rand(-40, 40), r: 5, life, color: '#c6ff4a', color2: '#00d68f', blend: 'lighter' });
      }
      // the drained bar of energy: a column of lime pulled up out of the victim and into the thief
      fx.rays(A.x, A.y, { color: '#2e8a63', color2: '#00d68f', n: 10, r1: 280, life: 0.8, spin: -1.8, alpha: 0.4 });
      fx.glow(B.x, B.y, 180, '#c6ff4a', { life: 1.2, alpha: 0.8 });
      fx.ring(B.x, B.y, { color: '#c6ff4a', r: 10, r1: 200, life: 0.6, w: 8, layer: 'front' });
      fx.confetti(B.x, B.y, 18, ['#00d68f', '#c6ff4a', '#b3ffe3', '#2e8a63']);
      fx.flash('#0a1f17', 0.25, 0.25);
      fx.vignette('#00d68f', 0.6, 1.6);
      fx.shake(7, 0.3);
    },

    impact(s, ev) {
      const { fx } = s;
      if (ev.kind === 'drained') {
        const q = s.foe, o = s.owner;
        const from = s.depth(q.x, q.y - s.C.BODY_H / 2), to = s.depth(o.x, o.y - s.C.BODY_H / 2);
        const amt = Number.isFinite(ev.amount) ? ev.amount : 0;
        const n = fx.n(5 + Math.round(amt * 12)), grav = 420;
        for (let i = 0; i < n; i++) {
          // a ballistic arc that lands on the thief exactly as the orb dies
          const T = 0.5 + i * 0.03, x = from.x + fx.rand(-10, 10), y = from.y + fx.rand(-10, 10);
          fx.emit({ shape: 'dot', x, y, vx: (to.x - x) / T, vy: (to.y - y) / T - 0.5 * grav * T, grav, r: 6, life: T, color: '#c6ff4a', color2: '#00d68f', blend: 'lighter' });
        }
        const hq = head(s, q), ho = head(s, o);
        fx.glow(ho.x, ho.y, 90, '#c6ff4a', { life: 0.9 });
        fx.stamp(hq.x, hq.y - s.headR(q) - 56, `−${Math.round(amt * 100)}%`, { r: 34, color: '#2e8a63', edge: '#0a1f17', vy: -30, life: 1.2 });
        fx.stamp(ho.x, ho.y - s.headR(o) - 56, `+${Math.round(amt * 60)}%`, { r: 34, color: '#c6ff4a', edge: '#0a1f17', vy: -30, life: 1.2 });
        return;
      }
      const d = s.depth(ev.x, ev.y);
      const R = ev.on != null ? s.headR(s.M.players[ev.on]) : 20;
      fx.glow(d.x, d.y, R + 60, '#00d68f', { life: 0.4 });
      fx.ring(d.x, d.y, { color: '#00d68f', r: R + 4, r1: R + 70, life: 0.35, w: 6, layer: 'front' });
      fx.burst(d.x, d.y, 12, { shape: 'sq', speed: 220, r: 3, drag: 2, life: 0.5, color: '#b3ffe3' });
      if (ev.kind === 'land') fx.stamp(d.x, d.y + R + 50, 'נעול!', { r: 36, color: '#b3ffe3', edge: '#0a1f17', vy: 10, life: 0.9 });
      fx.shake(3, 0.2);
    },

    // Behind the bodies: the stadium goes toxic green; a siphon vortex churns under the victim
    // and the thief burns with a lime power aura, swelling on what it took.
    back(g, e, s) {
      const q = victim(s, e), o = s.M.players[e.owner] || s.owner;
      const k = envelope(e, 0.15, 0.4), full = clamp(1 - (e.t - 0.9) / 0.6, 0.45, 1);
      wash(g, s, '#0a1f17', 0.16 * k, e.t);
      wash(g, s, '#00d68f', 0.06 * k, e.t);
      const V = s.depth(q.x, q.y - s.C.BODY_H / 2), T = s.depth(o.x, o.y - s.C.BODY_H / 2);
      s.fx.drawGlow(g, V.x, V.y, 170, '#2e8a63', 0.6 * k * full);
      g.save();
      g.translate(V.x, V.y);
      g.globalAlpha = 0.55 * k; g.fillStyle = '#0a1f17';
      g.beginPath(); g.ellipse(0, 0, 120, 70, 0, 0, TAU); g.fill();
      g.lineCap = 'round';
      for (let arm = 0; arm < 5; arm++) {
        g.strokeStyle = arm % 2 ? '#c6ff4a' : '#00d68f'; g.lineWidth = 6; g.globalAlpha = 0.85 * k * full;
        g.beginPath();
        for (let i = 0; i <= 14; i++) { const f = i / 14, a = -s.t * 4 + arm * (TAU / 5) + f * 3.2, r = 1 - f * 0.8; g.lineTo(Math.cos(a) * 120 * r, Math.sin(a) * 70 * r); }
        g.stroke();
      }
      g.restore();
      // the thief's aura: flame tongues licking up round him, lime and green
      const pulse = 0.5 + 0.5 * Math.sin(s.t * 10);
      s.fx.drawGlow(g, T.x, T.y - 10, 150 + 30 * pulse, '#c6ff4a', 0.55 * k);
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const u = (i / 6) * 2 - 1, fl = 70 + 40 * Math.sin(s.t * 14 + i * 1.9);
        const x = T.x + u * 34;
        g.globalAlpha = 0.6 * k; g.fillStyle = i % 2 ? '#00d68f' : '#c6ff4a';
        g.beginPath(); g.moveTo(x - 12, T.y + 16); g.quadraticCurveTo(x + Math.sin(s.t * 8 + i) * 14, T.y - fl * 0.5, x + u * 10, T.y - fl); g.quadraticCurveTo(x + 4, T.y - fl * 0.4, x + 12, T.y + 16); g.closePath(); g.fill();
      }
      g.restore();
    },

    over(g, e, s) {
      const q = victim(s, e), o = s.M.players[e.owner] || s.owner;
      const k = envelope(e, 0.1, 0.4);
      const strength = k * clamp(1 - (e.t - 0.9) / 0.5, 0.22, 1);
      const a = s.depth(q.x, q.y - s.C.BODY_H / 2), b = s.depth(o.x, o.y - s.C.BODY_H / 2);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const pt = (f, ph) => {
        const off = Math.sin(f * Math.PI) * Math.sin(f * 10 - s.t * 14 + ph) * 14;
        return [a.x + dx * f + nx * off, a.y + dy * f + ny * off];
      };
      s.fx.drawGlow(g, a.x, a.y, 70, '#00d68f', 0.7 * strength);
      s.fx.drawGlow(g, b.x, b.y, 60, '#c6ff4a', 0.6 * strength);
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      // the suction ring round the victim: arcs winding inward
      g.strokeStyle = '#2e8a63'; g.lineWidth = 3; g.globalAlpha = 0.7 * strength;
      for (let i = 0; i < 4; i++) {
        const r = 30 + ((1 - ((s.t * 1.5 + i / 4) % 1)) * 50), an = s.t * 3 + i * 1.6;
        g.beginPath(); g.arc(a.x, a.y, r, an, an + 1.4); g.stroke();
      }
      // the tether: a dark strand and a green one twisting round it
      g.globalAlpha = 0.55 * strength; g.strokeStyle = '#0a1f17'; g.lineWidth = 10;
      g.beginPath();
      for (let i = 0; i <= 16; i++) g.lineTo(...pt(i / 16, Math.PI));
      g.stroke();
      g.globalAlpha = 0.95 * strength; g.strokeStyle = '#00d68f'; g.lineWidth = 5;
      g.shadowColor = '#00d68f'; g.shadowBlur = 10;
      g.beginPath();
      for (let i = 0; i <= 16; i++) g.lineTo(...pt(i / 16, 0));
      g.stroke();
      g.shadowBlur = 0;
      // orbs running along it, victim → thief
      if (strength > 0.3) {
        g.fillStyle = '#c6ff4a';
        for (let i = 0; i < 3; i++) {
          const [x, y] = pt((s.t * 1.2 + i / 3) % 1, 0);
          s.fx.drawGlow(g, x, y, 22, '#c6ff4a', 0.8 * strength);
          disc(g, x, y, 6);
        }
      }
      g.restore();
      // the padlock, beside the head on the pitch side (never over it)
      const h = head(s, q), R = s.headR(q);
      const side = q.x < s.C.W / 2 ? 1 : -1;
      const px = h.x + side * (R + 34), py = h.y - 2 + Math.sin(s.t * 3) * 2;
      const snap = 2.4 + (1 - clamp(e.t / 0.2, 0, 1)) * 1.4;
      const lift = 6 * clamp(1 - (e.life - e.t) / 0.4, 0, 1);
      // chains wrapped round his body, the links glinting
      const f = feet(s, q), cy = f.y - s.C.BODY_H * 0.55;
      g.save();
      g.globalAlpha = 0.95 * k; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + s.t * 0.8, x = f.x + Math.cos(a) * 30, y = cy + Math.sin(a) * 9;
        if (Math.sin(a) < 0) continue;   // only the near half: the chain wraps round the front
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        g.strokeStyle = '#0a1f17'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 6, 3.5, 0, 0, TAU); g.stroke();
        g.strokeStyle = i % 2 ? '#b3ffe3' : '#2e8a63'; g.lineWidth = 3; g.stroke();
        g.restore();
      }
      g.restore();
      s.fx.drawGlow(g, px, py, 44, '#c6ff4a', 0.6 * k);
      g.save();
      g.globalAlpha = k;
      g.translate(px, py); g.scale(snap, snap);
      padlock(g, 0, 0, lift);
      g.restore();
    },

    tick(e, s) {
      const q = victim(s, e), o = s.M.players[e.owner] || s.owner;
      if (Math.random() < (e.t < 0.9 ? 0.35 : 0.1)) {
        const life = 0.7, x = q.x + s.fx.rand(-12, 12), y = q.y - s.C.BODY_H / 2;
        s.fx.emit({ shape: 'dot', x, y, vx: (o.x - x) / life, vy: (o.y - s.C.BODY_H / 2 - y) / life, r: 3, life, color: '#b3ffe3' });
      }
      if (Math.random() < 0.08) s.fx.emit({ shape: 'smoke', x: q.x, y: q.y - 20, vy: -25, r: 6, r1: 22, life: 0.9, color: '#0a1f17', layer: 'back' });
      // energy motes all over the pitch, pulled into the thief
      if (Math.random() < 0.7) {
        const life = 0.9, x = s.fx.rand(0, s.C.W), y = s.fx.rand(s.C.CEIL_Y, s.C.GROUND_Y), tx = o.x, ty = o.y - s.C.BODY_H / 2;
        s.fx.emit({ shape: 'dot', x, y, vx: (tx - x) / life, vy: (ty - y) / life, r: s.fx.rand(2.5, 4.5), life, color: Math.random() < 0.5 ? '#c6ff4a' : '#00d68f', blend: 'lighter' });
      }
      if (Math.random() < 0.15) anywhere(s, { shape: 'glyph', text: '%', r: 18, vy: -30, life: 0.8, color: '#2e8a63' });
    },

    end(s, info) {
      const { fx } = s;
      const q = victim(s, info.e), h = head(s, q), R = s.headR(q);
      const side = q.x < s.C.W / 2 ? 1 : -1;
      const x = h.x + side * (R + 34), y = h.y;
      fx.glow(x, y, 130, '#00d68f', { life: 0.6 });
      fx.rays(x, y, { color: '#00d68f', color2: '#c6ff4a', n: 12, r1: 260, life: 0.7, spin: 2, alpha: 0.45 });
      fx.burst(x, y, 24, { shape: 'sq', speed: 300, r: 5, grav: 500, life: 0.7, color: '#00d68f', color2: '#2e8a63' });
      fx.burst(x, y, 10, { shape: 'shard', speed: 360, r: 7, spin: 12, grav: 600, life: 0.8, color: '#b3ffe3' });
      fx.confetti(x, y, 20, ['#00d68f', '#c6ff4a', '#b3ffe3']);
      fx.ring(x, y, { color: '#b3ffe3', r: 6, r1: 130, life: 0.45, w: 6, layer: 'front' });
      fx.stamp(x, y - 60, 'קליק!', { r: 42, color: '#b3ffe3', edge: '#0a1f17', life: 1.2 });
      linger(s, x, y, { c1: '#00d68f', c2: '#c6ff4a', R: 170, n: 16, life: 2, w: 120, h: 70 });
      fx.shake(4, 0.2);
    },
  },

  // ── 23 · quake — the earthquake ───────────────────────────────────────────
  quake: {
    theme: 'Tectonic earthquake',
    visual: 'a fissure tearing along the ground with rock slabs jutting up, thrown rock chunks, dust columns, tremor marks',
    palette: ['#c08b5c', '#5a3d24', '#f0d2b4', '#8c6239', '#2a1a0e'],
    doc: {
      fantasy: 'The champion stamps and the pitch splits: a glowing fissure races to the opponent and throws him into the air.',
      purpose: 'The violent control power: the victim is hurled up (1.25× a jump) and sideways, takes 10% damage and has no control for 0.9 s while the ball hops forward — a clean look at goal.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The opponent is thrown into the air and frozen for 0.9 s (−10% health); the ball jumps forward (0.6× a kick, 1.5× lift) for you to chase.',
      bot: 'Arms the moment it can (POWERS.quake.arm = "any"); brawler style (no extra aggression, 1.35× tackling) — it fires in close quarters.',
      sequence: {
        anticipation: 'While armed long cracks glowing with magma pulse in the ground under the champion\'s feet in a warm glow, pebbles hop off the grass and big tremor marks shiver beside his body.',
        activation: 'Under the super cut-in (earth-brown focus lines, a jagged magma fissure tearing across the whole bottom of the screen with slabs tilting up and a boulder at the champion\'s end of the band): an earthen sunburst and a magma glow at his feet, a "רעש!" word, two dust rings, 26 rock chips, 14 pebbles and 12 dust clouds thrown up, shock streaks racing out along the ground both ways, a long earth-brown edge glow and a hard shake.',
        main: 'The stadium fills with brown dust (wash) and molten light. A jagged fissure tears along the ground from the champion to past the victim in 0.25 s, opening wide with magma glowing in the gap, a pale lip and branching cracks; big dark-edged rock slabs shove up out of it lit orange from below, four lava geysers erupt from the crack, and hairline cracks run on to both ends of the pitch. Rubble falls out of the sky all over the stadium, chunks fly and dust columns rise while the victim shivers in the air.',
        impact: 'The quake event: the strongest shake in the tier (18 for 0.9 s), a magma glow, an orange sunburst and fire ring and a "בום בום!" word over the victim, rock confetti, an earth-brown grade and an orange edge glow, eight dust columns and 24 rocks thrown up along the line.',
        aftermath: 'The ground keeps smoking: ten dust clouds roll over the floor, the crack glows out ember by ember for 2 s, faint rays and embers rise along the line, a "רררר..." word rumbles and a last aftershock shakes.',
        cleanup: 'The crack and wash fade over their last 0.3 s; rocks run out within 1.2 s, dust and embers within 2.8 s.',
      },
      layers: 'Cut-in: focus lines, full-width fissure with magma core, slabs, boulder, glow. Back: dust wash, 1 + ≤8 magma drawGlow, 4 lava geysers (2 tapered flames each, lighter), fissure (dark gap, magma core line, pale lip), branches, hairline cracks, ≤10 outlined rock slabs. Front: tremor zigzags beside the victim. Particles: glow, rays, stamp, confetti, shards, rubble, pebbles, dust smoke, embers, streaks, rings.',
      camera: 'Shake 12 on the stamp, 18 over 0.9 s on the quake event (the tier\'s strongest), 5 on the settle; a 1.4 s brown vignette on the stamp, a 1.6 s brown tint (0.12) and orange vignette on the quake.',
      hud: 'The engine\'s 🌋 pill with its 0.9 s ring over the victim; the health bar shows the 10% hit.',
      audio: 'Fire: a sub-bass stomp with a gravel crunch. Impact: a long rolling rumble with cracking rock. End: a rattle of settling gravel.',
      counterplay: 'Keep your distance — the champion has to touch the ball first — and land ready to defend: the ball it knocked forward is loose, not a shot.',
      perf: '~80 particles on the stamp, ~60 on the quake event, ≤4 a frame while alive, ~60 on the settle; crack ≤52 vertices, ≤10 slabs, 4 geysers and ≤9 drawGlow a frame; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), focusLines(), fx.burst, fx.confetti, fx.ring, fx.emit(shard/sq/smoke/dot/streak), fx.drawGlow, fx.vignette, fx.shake, fx.tint, cutFrame(), s.depth, s.headR, memo(), hash(), envelope().',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 48, q: 0.5, peak: 1, decay: 0.5 }, { k: 'thud', freq: 600, q: 1, peak: 0.45, decay: 0.3, t: 0.03 }],
      impact: [{ k: 'thud', freq: 40, q: 0.4, peak: 1, decay: 1.2 }, { k: 'thud', freq: 180, q: 1.5, peak: 0.6, decay: 0.5, t: 0.1 }, { k: 'thud', freq: 1300, q: 4, peak: 0.35, decay: 0.12, t: 0.18 }],
      end: [{ k: 'thud', freq: 900, q: 0.8, peak: 0.2, decay: 0.5 }, { k: 'thud', freq: 70, q: 0.8, peak: 0.3, decay: 0.3 }],
    },

    aura(g, p, s) {
      const f = feet(s, p), pulse = 0.5 + 0.5 * Math.sin(s.t * 12);
      s.fx.drawGlow(g, f.x, f.y + 3, 70, '#ff7a2a', 0.35 + 0.35 * pulse);
      g.save();
      g.lineJoin = 'round';
      for (const [col, w, dy, al] of [['#2a1a0e', 5, 0, 0.9], ['#ff7a2a', 2, 0, 0.4 + 0.6 * pulse], ['#f0d2b4', 2, -3, 0.3 + 0.4 * pulse]]) {
        g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = al;
        g.beginPath();
        for (const k of [-1, 1]) {
          g.moveTo(f.x + k * 6, f.y + 3 + dy);
          for (let i = 1; i <= 6; i++) g.lineTo(f.x + k * (6 + i * 12), f.y + 3 + dy + (hash(i + k * 7) - 0.5) * 8);
        }
        g.stroke();
      }
      // tremor marks shivering beside the body
      g.strokeStyle = '#c08b5c'; g.lineWidth = 3; g.globalAlpha = 0.9;
      const j = Math.sin(s.t * 50) * 3;
      g.beginPath();
      for (const k of [-1, 1]) for (const off of [10, 20]) {
        const x = f.x + k * (s.C.BODY_W / 2 + off) + j;
        g.moveTo(x, f.y - 30); g.lineTo(x + k * 4, f.y - 22); g.lineTo(x, f.y - 14); g.lineTo(x + k * 4, f.y - 6);
      }
      g.stroke();
      g.restore();
      if (Math.random() < 0.45) {
        s.fx.emit({ shape: 'sq', x: f.x + s.fx.rand(-40, 40), y: f.y - 2, vx: s.fx.rand(-30, 30), vy: s.fx.rand(-200, -90), grav: 900, r: 3, life: 0.45, color: '#8c6239' });
      }
    },

    cutin(g, s, k) {
      const { C } = s;
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#c08b5c', 0.4 * c.fade, 5);
      const G = C.H - 70, open = clamp(k / 0.2, 0, 1);
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push([(i / 20) * C.W, G + (hash(i + 40) - 0.5) * 34]);
      g.save();
      g.globalAlpha = c.fade; g.lineJoin = 'round'; g.lineCap = 'round';
      // the tear across the whole screen, magma inside
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 6 + 22 * open;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y); g.stroke();
      g.strokeStyle = '#ff7a2a'; g.lineWidth = 3 + 8 * open;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y); g.stroke();
      g.strokeStyle = '#f0d2b4'; g.lineWidth = 3;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y - 8 - 10 * open); g.stroke();
      for (let i = 1; i < 20; i += 3) {
        const [x, y] = pts[i];
        s.fx.drawGlow(g, x, y, 60, '#ff7a2a', 0.7 * c.fade);
        g.save(); g.translate(x, y - 10); g.rotate((hash(i + 9) - 0.5) * 0.9);
        g.fillStyle = '#8c6239'; g.fillRect(-26, -36 * open, 52, 36 * open);
        g.strokeStyle = '#5a3d24'; g.lineWidth = 3; g.strokeRect(-26, -36 * open, 52, 36 * open);
        g.restore();
      }
      // a boulder at the champion's end of the band
      g.translate(c.x, c.y + Math.sin(k * 70) * 5);
      g.fillStyle = '#5a3d24'; rockPath(g, 95 * c.pop, k, 17); g.fill();
      g.strokeStyle = '#c08b5c'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#ff7a2a'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(-40, -50); g.lineTo(-5, -10); g.lineTo(-25, 20); g.lineTo(15, 60); g.moveTo(-5, -10); g.lineTo(40, -20); g.stroke();
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      const f = feet(s, s.owner);
      blast(s, f.x, f.y - 10, { c1: '#c08b5c', c2: '#ff7a2a', n: 10, rayR: 300, word: 'רעש!', wc: '#f0d2b4', edge: '#2a1a0e', wy: f.y - 150, spin: 0.6 });
      fx.ring(f.x, f.y, { color: '#c08b5c', r1: 180, life: 0.5, w: 9 });
      fx.ring(f.x, f.y, { color: '#f0d2b4', r: 10, r1: 110, life: 0.35, w: 5 });
      fx.burst(f.x, f.y - 4, 26, { shape: 'shard', speed: 460, angle: -Math.PI / 2, spread: 2, r: 8, spin: 12, grav: 1000, life: 0.9, color: '#5a3d24', color2: '#8c6239' });
      fx.burst(f.x, f.y - 4, 14, { shape: 'sq', speed: 380, angle: -Math.PI / 2, spread: 2.4, r: 4, grav: 900, life: 0.7, color: '#8c6239', color2: '#ff7a2a' });
      fx.burst(f.x, f.y - 4, 12, { shape: 'smoke', speed: 160, angle: -Math.PI / 2, spread: 3, r: 10, r1: 34, drag: 1.5, life: 1.1, color: '#f0d2b4', alpha: 0.7, layer: 'back' });
      // shock lines racing out along the ground both ways
      for (const dir of [-1, 1]) {
        for (let i = 0; i < fx.n(5); i++) fx.emit({ shape: 'streak', x: f.x, y: f.y - 2 - i * 3, vx: dir * (500 + i * 90), vy: 0, drag: 1, r: 20, w: 4, life: 0.5, color: i % 2 ? '#ff7a2a' : '#f0d2b4' });
      }
      fx.vignette('#8c6239', 0.6, 1.4);
      fx.shake(12, 0.4);
    },

    impact(s, ev) {
      const { fx, C } = s;
      if (ev.kind === 'quake') {
        const a = s.owner.x, b = s.foe.x;
        const h = head(s, s.foe);
        fx.glow(h.x, C.GROUND_Y, 160, '#ff7a2a', { life: 0.7 });
        fx.stamp(h.x, h.y - s.headR(s.foe) - 60, 'בום בום!', { r: 50, color: '#ff7a2a', edge: '#2a1a0e', life: 1 });
        for (let i = 0, n = fx.n(8); i < n; i++) {
          const x = a + (b - a) * ((i + 0.5) / n);
          fx.emit({ shape: 'smoke', x, y: C.GROUND_Y, vx: fx.rand(-10, 10), vy: -140, drag: 0.8, r: 10, r1: 36, life: 1.1, color: '#c08b5c', alpha: 0.8, layer: 'back' });
        }
        for (let i = 0, n = fx.n(24); i < n; i++) {
          fx.emit({ shape: 'shard', x: a + (b - a) * Math.random(), y: C.GROUND_Y, vx: fx.rand(-110, 110), vy: fx.rand(-580, -280), grav: 1100, spin: fx.rand(-14, 14), r: fx.rand(5, 10), life: 1, color: '#5a3d24', color2: '#8c6239' });
        }
        fx.rays(h.x, C.GROUND_Y, { color: '#ff7a2a', color2: '#c08b5c', n: 14, r1: 480, life: 0.9, spin: 0.8, alpha: 0.45 });
        fx.ring(h.x, C.GROUND_Y, { color: '#ff7a2a', r: 20, r1: 300, life: 0.7, w: 10 });
        fx.confetti(h.x, C.GROUND_Y - 20, 16, ['#8c6239', '#c08b5c', '#5a3d24', '#ff7a2a'], { life: 1.4 });
        fx.tint('#5a3d24', 0.12, 1.6);
        fx.vignette('#ff7a2a', 0.5, 1.6);
        fx.shake(18, 0.9);
        return;
      }
      const q = ev.on != null ? s.M.players[ev.on] : s.foe, f = feet(s, q);
      fx.glow(f.x, f.y, 90, '#c08b5c', { life: 0.5 });
      fx.burst(f.x, f.y, 12, { shape: 'smoke', speed: 160, r: 8, r1: 26, drag: 2, life: 0.8, color: '#f0d2b4', alpha: 0.7, layer: 'back' });
      fx.burst(f.x, f.y, 10, { shape: 'sq', speed: 300, angle: -Math.PI / 2, spread: 2, r: 4, grav: 900, life: 0.6, color: '#8c6239' });
    },

    back(g, e, s) {
      const { C } = s;
      const q = victim(s, e);
      // the line is set where the two stood when it opened; it does not chase the victim
      const st = memo(e, () => {
        const o = s.M.players[e.owner] || s.owner;
        const dir = Math.sign(q.x - o.x) || 1;
        return { a: clamp(o.x, C.GOAL_W, C.W - C.GOAL_W), b: clamp(q.x + dir * 60, C.GOAL_W, C.W - C.GOAL_W), seed: Math.floor(Math.random() * 99) };
      });
      const grow = clamp(e.t / 0.25, 0, 1), fade = clamp((e.life - e.t) / 0.3, 0, 1);
      const open = Math.sin(clamp(e.t / e.life, 0, 1) * Math.PI) * 0.6 + 0.4;
      const G = C.GROUND_Y + 4;
      const L = (st.b - st.a) * grow;
      const n = clamp(Math.round(Math.abs(L) / 18), 2, 52);
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([st.a + (L * i) / n, G + (hash(st.seed + i) - 0.5) * 10 * (i > 0 && i < n ? 1 : 0.3)]);
      // the stadium shakes itself full of dust and the light goes molten
      wash(g, s, '#5a3d24', (e.t < 0.6 ? 0.2 : 0.1) * fade, e.t);
      s.fx.drawGlow(g, (st.a + st.b) / 2, G, Math.abs(st.b - st.a) * 0.6 + 160, '#ff7a2a', 0.45 * fade * grow);
      // magma light breathing out of the gap
      for (let i = 1, c = 0; i < n && c < 8; i += Math.max(1, Math.floor(n / 8)), c++) {
        s.fx.drawGlow(g, pts[i][0], pts[i][1], 60 + 20 * open, '#ff7a2a', 0.7 * fade * (0.7 + 0.3 * Math.sin(s.t * 9 + i)));
      }
      // lava geysers: tall molten jets erupting out of the crack, flickering
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 2, c = 0; i < n && c < 4; i += Math.max(2, Math.floor(n / 4)), c++) {
        const [x, y] = pts[i], H = (90 + 60 * hash(st.seed + i)) * open * grow * (0.8 + 0.2 * Math.sin(s.t * 20 + i));
        for (const [col, w, hh] of [['#ff5a1f', 16, 1], ['#ffc07a', 8, 0.75]]) {
          g.globalAlpha = 0.75 * fade; g.fillStyle = col;
          g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.4, y - H * hh * 0.6, x + Math.sin(s.t * 9 + i) * 4, y - H * hh); g.quadraticCurveTo(x + w * 0.4, y - H * hh * 0.6, x + w, y); g.closePath(); g.fill();
        }
      }
      g.restore();
      g.save();
      g.globalAlpha = fade;
      g.lineJoin = 'round'; g.lineCap = 'round';
      // hairline cracks run on to both ends of the pitch: the whole floor is broken
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 2; g.globalAlpha = 0.8 * fade * grow;
      g.beginPath();
      for (const [x0, x1] of [[Math.min(st.a, st.b), C.GOAL_W], [Math.max(st.a, st.b), C.W - C.GOAL_W]]) {
        g.moveTo(x0, G);
        for (let i = 1; i <= 8; i++) g.lineTo(x0 + (x1 - x0) * (i / 8), G + (hash(st.seed + i * 11) - 0.5) * 10);
      }
      g.stroke();
      g.globalAlpha = fade;
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 4 + 10 * open;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y); g.stroke();
      g.strokeStyle = '#ff7a2a'; g.lineWidth = 2 + 3 * open;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y + 1); g.stroke();
      // the pale broken lip above the gap
      g.strokeStyle = '#f0d2b4'; g.lineWidth = 2; g.globalAlpha = 0.8 * fade;
      g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y - 5 - 3 * open); g.stroke();
      // branches and the slabs the quake pushed up
      g.strokeStyle = '#2a1a0e'; g.lineWidth = 3; g.globalAlpha = fade;
      g.beginPath();
      for (let i = 2; i < n; i += 3) {
        const [x, y] = pts[i], d = hash(st.seed + i * 3) > 0.5 ? 1 : -1;
        g.moveTo(x, y); g.lineTo(x + d * 14, y + 8); g.lineTo(x + d * 24, y + 11);
      }
      g.stroke();
      for (let i = 1, c = 0; i < n && c < 10; i += 4, c++) {
        const [x, y] = pts[i];
        g.save();
        // big tilted rock slabs shoved up out of the pitch, lit orange from the gap below
        const sw = 14 + hash(st.seed + i) * 10, sh = (28 + hash(st.seed + i * 2) * 26) * open * grow;
        g.translate(x, y - 3); g.rotate((hash(st.seed + i * 5) - 0.5) * 0.9);
        g.fillStyle = '#8c6239';
        g.beginPath(); g.moveTo(-sw, 0); g.lineTo(-sw * 0.8, -sh); g.lineTo(sw * 0.3, -sh * 1.12); g.lineTo(sw, -sh * 0.8); g.lineTo(sw, 0); g.closePath(); g.fill();
        g.strokeStyle = '#2a1a0e'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#c08b5c'; g.fillRect(-sw * 0.8, -sh, sw * 0.9, 4);
        g.fillStyle = '#ff7a2a'; g.fillRect(-sw, -4, sw * 2, 4);
        g.restore();
      }
      g.restore();
    },

    front(g, e, s) {
      const q = victim(s, e), f = feet(s, q);
      const k = envelope(e, 0.05, 0.3);
      const j = Math.sin(s.t * 60) * 4;
      g.save();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#f0d2b4'; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath();
      for (const side of [-1, 1]) for (const off of [12, 24]) {
        const x = f.x + side * (s.C.BODY_W / 2 + off) + j;
        g.moveTo(x, f.y - 36);
        for (let i = 1; i <= 5; i++) g.lineTo(x + (i % 2 ? side * 6 : 0), f.y - 36 + i * 7);
      }
      g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      const st = mem.get(e);
      if (!st) return;
      const x = st.a + (st.b - st.a) * clamp(e.t / 0.25, 0, 1) * Math.random();
      if (Math.random() < 0.4) fx.emit({ shape: 'shard', x, y: C.GROUND_Y, vx: fx.rand(-60, 60), vy: fx.rand(-420, -220), grav: 1100, spin: 10, r: 6, life: 0.7, color: '#5a3d24' });
      if (Math.random() < 0.35) fx.emit({ shape: 'smoke', x, y: C.GROUND_Y, vy: -100, drag: 1, r: 8, r1: 26, life: 0.9, color: '#c08b5c', alpha: 0.7, layer: 'back' });
      if (Math.random() < 0.3) fx.emit({ shape: 'dot', x, y: C.GROUND_Y, vy: fx.rand(-260, -120), grav: 500, r: 4, life: 0.6, color: '#ff7a2a', blend: 'lighter' });
      // the roof is coming down: rubble falling out of the sky all over the stadium
      if (Math.random() < 0.6) fx.emit({ shape: 'shard', x: fx.rand(0, C.W), y: fx.rand(-20, C.CEIL_Y + 40), vx: fx.rand(-30, 30), vy: fx.rand(80, 200), grav: 900, spin: fx.rand(-10, 10), r: fx.rand(5, 11), life: 0.9, color: Math.random() < 0.5 ? '#8c6239' : '#c08b5c', color2: '#5a3d24' });
    },

    end(s, info) {
      const { fx, C } = s;
      const st = info.e && mem.get(info.e);
      const a = st ? st.a : s.owner.x, b = st ? st.b : s.foe.x;
      // the ground settles but keeps smoking: dust rolling over the whole floor, the crack
      // glowing out ember by ember for two seconds, and a last aftershock
      for (let i = 0, n = fx.n(10); i < n; i++) {
        const x = a + (b - a) * (i / Math.max(1, n - 1));
        fx.emit({ shape: 'smoke', x, y: C.GROUND_Y - 2, vx: fx.rand(-70, 70), vy: -fx.rand(10, 40), drag: 0.8, r: 12, r1: 50, life: fx.rand(1.8, 2.6), color: i % 2 ? '#f0d2b4' : '#c08b5c', alpha: 0.6, layer: 'back' });
        fx.glow(x, C.GROUND_Y + 4, 60, '#ff7a2a', { life: fx.rand(1.6, 2.4), alpha: 0.7 });
      }
      linger(s, (a + b) / 2, C.GROUND_Y - 30, { c1: '#ff7a2a', c2: '#c08b5c', R: 260, n: 24, life: 2.3, vy: -50, w: Math.abs(b - a) / 2 + 40, h: 20, rn: 12, rayR: 360, mote: { shape: 'sq', r: 4 } });
      fx.stamp((a + b) / 2, C.GROUND_Y - 170, 'רררר...', { r: 40, color: '#c08b5c', edge: '#2a1a0e', life: 1.4, vy: -20 });
      fx.shake(5, 0.3);
    },
  },

  // ── 24 · trampoline — the big top ─────────────────────────────────────────
  trampoline: {
    theme: 'Circus big-top',
    visual: 'red-and-yellow striped trampoline mat along the pitch on sprung blue rails, bunting under the big-top roof, confetti and bounce stars',
    palette: ['#ffe14a', '#e8263b', '#1f5fd1', '#fff6c2', '#2bb673'],
    doc: {
      fantasy: 'Roll up, roll up: the pitch becomes a circus trampoline under the big top and the ball will not stop bouncing.',
      purpose: 'A field power, not a player one: for 6 s the ball keeps all its height off the grass, which makes it wild to control — best for the champion who expected it.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is popped high (1.4× a header\'s lift) and for 6 s it bounces off the ground with no loss (bounce 1.0). It affects both players equally.',
      bot: 'Arms the moment it can (POWERS.trampoline.arm = "any"); striker style (+0.06 aggression, normal tackling).',
      sequence: {
        anticipation: 'While armed a big spinning red-and-cream striped circus hoop turns behind the champion\'s head in a yellow glow, and a glowing yellow star bounces at his feet.',
        activation: 'Under the super cut-in (red focus lines, a giant striped big-top tent with a waving flag, bunting across the top of the screen): a red-yellow sunburst and glow at the ball, a "בוינג!" word, a 45-paper confetti cannon, two more confetti cannons firing up from both ends of the pitch, bounce stars, rings, a yellow flash, a long red edge glow and a drum-and-cymbal "ba-dum-tss".',
        main: 'For 6 s the stadium is a circus: red-and-cream canvas swags with a dark scalloped hem hang from the roof, striped tent walls rise behind both goals, two spotlight cones sweep down from the roof onto the mat, and a striped mat runs the pitch\'s length on blue rails with springs and chasing marquee bulbs, sagging under the ball. Every bounce throws 22 confetti papers, stars, two rings, a small sunburst and a "הופ!/בוינג!/יאהו!" word; glitter twinkles all over the tent and paper flutters down from the roof.',
        impact: 'As the field takes hold: a big glowing yellow star pops at the ball and confetti shoots up off both ends of the mat.',
        aftermath: 'The grand finale: three fireworks burst under the roof with glows and rings, confetti rains down, and a big "טה-דה!" word pops in the middle of the pitch over a slow sunburst, with a closing cymbal as the mat fades.',
        cleanup: 'Mat, canvas, cones and bunting fade over the last 0.5 s; fireworks and confetti run out in 2.2 s.',
      },
      layers: 'Cut-in: focus lines, glow, tent (8 stripes + roof + flag), bunting. Back: red wash, 12 canvas swags, 2×4 wall stripes, 2 spotlight cones, mat stripes (≤36 quads) with a dark-edged top, marquee bulbs, rails, springs, legs, bunting (≤24 pennants), 3 drawGlow. Front: spring arcs under the ball. Particles: glow, rays, stamp, confetti, stars, rings, glyphs.',
      camera: 'Shake 3 per bounce, 5 on firing, 4 on the finale; a 0.15 s yellow flash (0.25) and a 1.4 s red vignette on firing. No grade.',
      hud: 'No status pill (the field is on nobody); the mat itself is the timer — it fades out over its last half second.',
      audio: 'Fire: a circus snare-and-cymbal "ba-dum-tss". Impact: a bright whistle toot. Each bounce: a tom hit, alternating pitch. End: a cymbal splash.',
      counterplay: 'Do not chase the ball\'s bounce — go where it will land next. A header on the way down kills the height; the trampoline gives it straight back to whoever reads it first.',
      perf: '~90 particles on firing, ≤40 per bounce, ≤3 a frame otherwise, ~90 on the finale; ~150 draw calls and 3 drawGlow a frame for the circus; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), wash(), anywhere(), focusLines(), fx.confetti, fx.burst, fx.ring, fx.glyph, fx.emit(star/confetti), fx.drawGlow, fx.vignette, fx.shake, fx.flash, fx.sound (bounce drum), cutFrame(), memo(), envelope().',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 200, q: 2, peak: 0.7, decay: 0.12 }, { k: 'thud', freq: 150, q: 2, peak: 0.8, decay: 0.16, t: 0.14 }, { k: 'thud', freq: 6500, q: 0.7, peak: 0.35, decay: 0.4, t: 0.3 }],
      impact: [{ k: 'blip', freq: 1568, type: 'square', peak: 0.18, dur: 0.12 }, { k: 'blip', freq: 2093, type: 'square', peak: 0.16, dur: 0.18, t: 0.12 }],
      end: [{ k: 'thud', freq: 7000, q: 0.6, peak: 0.4, decay: 0.7 }, { k: 'thud', freq: 130, q: 2, peak: 0.6, decay: 0.2 }],
    },

    aura(g, p, s) {
      const h = head(s, p), f = feet(s, p), R = s.headR(p);
      const rr = R + 26, seg = 14;
      s.fx.drawGlow(g, h.x, h.y, rr + 36, '#ffe14a', 0.55);
      g.save();
      g.lineWidth = 9;
      for (let i = 0; i < seg; i++) {
        const a0 = s.t * 2 + (i / seg) * TAU;
        g.strokeStyle = i % 2 ? '#e8263b' : '#fff6c2';
        g.beginPath(); g.arc(h.x, h.y, rr, a0, a0 + TAU / seg); g.stroke();
      }
      g.strokeStyle = '#1f5fd1'; g.lineWidth = 3;
      g.beginPath(); g.arc(h.x, h.y, rr + 7, 0, TAU); g.stroke();
      g.beginPath(); g.arc(h.x, h.y, rr - 7, 0, TAU); g.stroke();
      const hop = Math.abs(Math.sin(s.t * 6)) * 30;
      const sx = f.x + p.side * 36, sy = f.y - 10 - hop;
      s.fx.drawGlow(g, sx, sy, 26, '#ffe14a', 0.9);
      g.fillStyle = '#ffe14a';
      star(g, sx, sy, 11, s.t * 3);
      g.restore();
    },

    cutin(g, s, k) {
      const { C } = s;
      const c = cutFrame(s, k), W = 140 * c.pop, H = 170 * c.pop;
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#e8263b', 0.4 * c.fade, 6);
      s.fx.drawGlow(g, c.x, c.y, 220 * c.pop, '#ffe14a', 0.8 * c.fade);
      g.save();
      g.globalAlpha = c.fade;
      // the big top: striped walls, a scalloped roof and a flag
      const base = c.y + H * 0.5, eave = c.y - H * 0.05, peak = c.y - H * 0.5;
      for (let i = 0; i < 8; i++) {
        const x0 = c.x - W + (i / 8) * W * 2, x1 = x0 + W / 4;
        g.fillStyle = i % 2 ? '#fff6c2' : '#e8263b';
        g.beginPath(); g.moveTo(x0, base); g.lineTo(x1, base); g.lineTo(c.x + (x1 - c.x) * 0.9, eave); g.lineTo(c.x + (x0 - c.x) * 0.9, eave); g.closePath(); g.fill();
        g.fillStyle = i % 2 ? '#e8263b' : '#ffe14a';
        g.beginPath(); g.moveTo(c.x + (x0 - c.x) * 1.05, eave); g.lineTo(c.x + (x1 - c.x) * 1.05, eave); g.lineTo(c.x, peak); g.closePath(); g.fill();
      }
      g.strokeStyle = '#1f5fd1'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(c.x - W * 1.05, eave); g.lineTo(c.x, peak); g.lineTo(c.x + W * 1.05, eave); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(c.x, peak); g.lineTo(c.x, peak - 40); g.stroke();
      g.fillStyle = '#2bb673';
      const wv = Math.sin(k * 30) * 6;
      g.beginPath(); g.moveTo(c.x, peak - 40); g.lineTo(c.x + c.from * -34, peak - 32 + wv); g.lineTo(c.x, peak - 22); g.closePath(); g.fill();
      // bunting across the top of the screen
      const cols = ['#e8263b', '#ffe14a', '#1f5fd1', '#2bb673'];
      for (let i = 0; i < 16; i++) {
        const x = (i + 0.5) * (C.W / 16), y = 8 + Math.sin((i % 4) / 4 * Math.PI) * 12;
        g.fillStyle = cols[i % 4];
        g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x + 20, y); g.lineTo(x + Math.sin(k * 20 + i) * 5, y + 34); g.closePath(); g.fill();
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      blast(s, at.x, at.y, { c1: '#e8263b', c2: '#ffe14a', n: 16, word: 'בוינג!', wc: '#ffe14a', edge: '#1f5fd1', spin: 1.8 });
      fx.confetti(at.x, at.y, 45, ['#e8263b', '#ffe14a', '#1f5fd1', '#2bb673']);
      fx.burst(at.x, at.y, 10, { shape: 'star', speed: 300, r: 9, spin: 8, drag: 2, life: 0.9, color: '#fff6c2', color2: '#ffe14a' });
      fx.ring(at.x, at.y, { color: '#e8263b', r1: 140, life: 0.45, w: 7 });
      fx.ring(at.x, at.y, { color: '#1f5fd1', r: 6, r1: 90, life: 0.5, w: 4 });
      // confetti cannons firing up from both ends of the pitch
      for (const x of [s.C.GOAL_W + 20, s.C.W - s.C.GOAL_W - 20]) {
        fx.burst(x, s.C.GROUND_Y, 12, { shape: 'confetti', speed: 520, angle: -Math.PI / 2 + (x < s.C.W / 2 ? 0.35 : -0.35), spread: 0.7, grav: 380, drag: 0.8, spin: 10, r: 6, life: 1.8, color: x < s.C.W / 2 ? '#2bb673' : '#1f5fd1', color2: '#ffe14a' });
      }
      fx.flash('#ffe14a', 0.25, 0.15);
      fx.vignette('#e8263b', 0.5, 1.4);
      fx.shake(5, 0.2);
    },

    impact(s, ev) {
      const { fx, C } = s;
      const d = s.depth(ev.x, ev.y);
      fx.glow(d.x, d.y - 30, 70, '#ffe14a', { life: 0.6 });
      fx.glyph(d.x, d.y - 30, '★', { r: 48, color: '#ffe14a', vy: -40, life: 1, spin: 2 });
      for (const x of [C.GOAL_W + 10, C.W - C.GOAL_W - 10]) {
        fx.burst(x, C.GROUND_Y, 10, { shape: 'confetti', speed: 340, angle: -Math.PI / 2, spread: 1, grav: 400, drag: 1, spin: 10, r: 5, life: 1.2, color: x < C.W / 2 ? '#2bb673' : '#1f5fd1' });
      }
    },

    back(g, e, s) {
      const { C } = s;
      const k = envelope(e, 0.3, 0.5);
      const b = s.M.ball, G = C.GROUND_Y;
      const x0 = C.GOAL_W + 6, x1 = C.W - C.GOAL_W - 6;
      // the big top's canvas hanging from the roof: the whole pitch is under the tent
      wash(g, s, '#e8263b', 0.08 * k, e.t);
      g.save();
      // the canvas drapes: red-and-cream swags hanging from the roof, a scalloped hem
      const hem = C.CEIL_Y + 70;
      for (let i = 0; i < 12; i++) {
        const a = i * (C.W / 12), c = a + C.W / 12;
        g.globalAlpha = 0.6 * k; g.fillStyle = i % 2 ? '#fff6c2' : '#e8263b';
        g.beginPath(); g.moveTo(a, 0); g.lineTo(c, 0); g.lineTo(c, hem - 30); g.quadraticCurveTo((a + c) / 2, hem + 10, a, hem - 30); g.closePath(); g.fill();
        g.globalAlpha = 0.9 * k; g.strokeStyle = '#8a1020'; g.lineWidth = 3; g.stroke();
      }
      // the tent's side walls: fat red-and-cream stripes rising at both ends behind the goals
      for (const [xa, xb] of [[0, C.GOAL_W + 20], [C.W - C.GOAL_W - 20, C.W]]) {
        for (let i = 0; i < 4; i++) {
          const w = (xb - xa) / 4;
          g.globalAlpha = 0.28 * k; g.fillStyle = i % 2 ? '#fff6c2' : '#e8263b';
          g.fillRect(xa + i * w, hem - 30, w, G - hem + 30);
        }
      }
      // two spotlight cones sweeping down from the roof
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const sx = i ? C.W - 140 : 140, u = 0.5 + 0.45 * Math.sin(s.t * (0.9 + i * 0.4) + i * 2);
        const tx = x0 + (x1 - x0) * u;
        g.globalAlpha = 0.16 * k; g.fillStyle = i ? '#fff6c2' : '#ffe14a';
        g.beginPath(); g.moveTo(sx - 14, 0); g.lineTo(tx - 90, G + 6); g.lineTo(tx + 90, G + 6); g.lineTo(sx + 14, 0); g.closePath(); g.fill();
      }
      g.restore();
      // the spots on the mat, and one following the ball down onto it
      for (let i = 0; i < 2; i++) {
        const u = 0.5 + 0.45 * Math.sin(s.t * (0.9 + i * 0.4) + i * 2);
        s.fx.drawGlow(g, x0 + (x1 - x0) * u, G - 30, 150, i ? '#fff6c2' : '#ffe14a', 0.55 * k);
      }
      // the mat sags under the ball as it comes down onto it
      const near = clamp(1 - (G - b.r - b.y) / 40, 0, 1);
      s.fx.drawGlow(g, b.x, G, 50 + 40 * near, '#ffe14a', (0.3 + 0.5 * near) * k);
      const dip = near * 12 * k;
      const top = (x) => G + dip * Math.exp(-(((x - b.x) / 46) ** 2));
      g.save();
      g.globalAlpha = 0.9 * k;
      const stripe = 26, n = Math.ceil((x1 - x0) / stripe);
      for (let i = 0; i < n; i++) {
        const a = x0 + i * stripe, c = Math.min(x1, a + stripe);
        g.fillStyle = i % 2 ? '#e8263b' : '#ffe14a';
        g.beginPath(); g.moveTo(a, top(a)); g.lineTo(c, top(c)); g.lineTo(c, G + 11); g.lineTo(a, G + 11); g.closePath(); g.fill();
      }
      g.strokeStyle = '#8a1020'; g.lineWidth = 5;
      g.beginPath();
      for (let x = x0; x <= x1; x += stripe / 2) g.lineTo(x, top(x));
      g.stroke();
      g.strokeStyle = '#fff6c2'; g.lineWidth = 3;
      g.stroke();
      // marquee bulbs chasing along the mat's edge
      const chase = Math.floor(s.t * 10);
      for (let x = x0 + 8, i = 0; x < x1; x += 22, i++) {
        const on = (i + chase) % 3 === 0;
        g.fillStyle = on ? '#fff6c2' : '#ffe14a'; g.globalAlpha = (on ? 1 : 0.55) * k;
        disc(g, x, G + 8, on ? 3.5 : 2.5);
      }
      g.globalAlpha = 0.9 * k;
      // rails, springs and legs
      g.fillStyle = '#1f5fd1';
      g.fillRect(x0 - 4, G + 11, x1 - x0 + 8, 5);
      g.fillRect(x0 - 4, G + 11, 6, 26); g.fillRect(x1 - 2, G + 11, 6, 26);
      g.strokeStyle = '#fff6c2'; g.lineWidth = 2;
      g.beginPath();
      for (let x = x0 + 40; x < x1 - 20; x += 80) {
        g.moveTo(x, G + 16);
        for (let i = 1; i <= 4; i++) g.lineTo(x + (i % 2 ? 5 : -5), G + 16 + i * 3);
      }
      g.stroke();
      // bunting under the big-top roof: three swags of pennants, swaying
      const y0 = C.CEIL_Y + 4, span = (C.W - 180) / 3;
      const cols = ['#e8263b', '#ffe14a', '#1f5fd1', '#2bb673'];
      g.strokeStyle = '#1f5fd1'; g.lineWidth = 2; g.globalAlpha = 0.85 * k;
      g.beginPath();
      for (let sw = 0; sw < 3; sw++) for (let i = 0; i <= 8; i++) { const f = i / 8; g.lineTo(90 + span * (sw + f), y0 + Math.sin(f * Math.PI) * 22); }
      g.stroke();
      for (let sw = 0, c = 0; sw < 3; sw++) {
        for (let i = 1; i < 8; i++, c++) {
          const f = i / 8, x = 90 + span * (sw + f), y = y0 + Math.sin(f * Math.PI) * 22;
          const sway = Math.sin(s.t * 3 + c) * 4;
          g.fillStyle = cols[c % 4];
          g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.lineTo(x + sway, y + 17); g.closePath(); g.fill();
        }
      }
      g.restore();
    },

    front(g, e, s) {
      const b = s.M.ball, G = s.C.GROUND_Y;
      const near = clamp(1 - (G - b.r - b.y) / 60, 0, 1) * envelope(e, 0.3, 0.5);
      if (near <= 0.05) return;
      const d = s.depth(b.x, b.y);
      g.save();
      g.globalAlpha = 0.85 * near; g.strokeStyle = '#fff6c2'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      for (const k of [-1, 1]) { g.moveTo(d.x + k * (b.r + 4), d.y + b.r); g.quadraticCurveTo(d.x + k * (b.r + 18), d.y + b.r + 4, d.x + k * (b.r + 14), d.y + b.r + 14); }
      g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      const b = s.M.ball;
      const st = memo(e, () => ({ vy: b.vy, n: 0 }));
      // a bounce: falling last frame, rising now, down on the mat
      if (st.vy > 80 && b.vy < -40 && b.y > C.GROUND_Y - b.r - 16) {
        st.n++;
        const x = b.x, y = C.GROUND_Y;
        fx.confetti(x, y, 22, st.n % 2 ? ['#e8263b', '#ffe14a', '#fff6c2'] : ['#1f5fd1', '#2bb673', '#fff6c2']);
        fx.burst(x, y - 6, 8, { shape: 'star', speed: 280, angle: -Math.PI / 2, spread: 2.2, r: 8, spin: 8, drag: 2, life: 0.7, color: '#ffe14a' });
        fx.ring(x, y, { color: '#fff6c2', r: 8, r1: 120, life: 0.4, w: 6 });
        fx.ring(x, y, { color: '#e8263b', r: 4, r1: 80, life: 0.35, w: 4 });
        fx.glow(x, y, 110, '#ffe14a', { life: 0.4 });
        fx.rays(x, y, { color: '#ffe14a', color2: '#e8263b', n: 10, r1: 220, life: 0.45, spin: 2, alpha: 0.4 });
        fx.stamp(x, y - 80, ['הופ!', 'בוינג!', 'יאהו!'][st.n % 3], { r: 40, color: st.n % 2 ? '#ffe14a' : '#2bb673', edge: '#8a1020', life: 0.7, vy: -60 });
        fx.shake(3, 0.12);
        fx.sound([{ k: 'thud', freq: st.n % 2 ? 170 : 120, q: 2.5, peak: 0.45, decay: 0.12 }]);
      }
      st.vy = b.vy;
      if (Math.random() < 0.15) fx.emit({ shape: 'star', x: fx.rand(C.GOAL_W, C.W - C.GOAL_W), y: C.GROUND_Y - 4, vy: -60, spin: 4, r: 5, life: 0.6, color: '#fff6c2' });
      // circus glitter twinkling all over the tent, and paper fluttering down from the roof
      if (Math.random() < 0.4) anywhere(s, { shape: 'star', r: fx.rand(4, 8), spin: 5, life: 0.6, color: ['#ffe14a', '#fff6c2', '#2bb673'][Math.floor(Math.random() * 3)] });
      if (Math.random() < 0.35) fx.emit({ shape: 'confetti', x: fx.rand(0, C.W), y: C.CEIL_Y + 50, vx: fx.rand(-30, 30), vy: 40, grav: 50, spin: 9, r: 5, life: 2.2, color: ['#e8263b', '#ffe14a', '#1f5fd1', '#2bb673'][Math.floor(Math.random() * 4)] });
    },

    end(s, info) {
      const { fx, C } = s;
      const cols = ['#e8263b', '#ffe14a', '#2bb673'];
      for (let i = 0; i < 3; i++) {
        fx.burst(C.W * (0.25 + i * 0.25), C.CEIL_Y + 10, 10, { shape: 'confetti', speed: 120, angle: Math.PI / 2, spread: 2.6, grav: 260, drag: 0.6, spin: 10, r: 5, life: 1.6, color: cols[i] });
      }
      // the grand finale: three fireworks bursting under the roof
      [['#ffe14a', 0.25], ['#e8263b', 0.5], ['#2bb673', 0.75]].forEach(([col, u], i) => {
        const x = C.W * u, y = C.CEIL_Y + 90 + (i % 2) * 40;
        fx.burst(x, y, 14, { shape: 'star', speed: 260, r: 6, spin: 6, grav: 120, drag: 1.2, life: 1.6, color: col, color2: '#fff6c2' });
        fx.ring(x, y, { color: col, r: 6, r1: 130, life: 0.6, w: 5, layer: 'front' });
        fx.glow(x, y, 120, col, { life: 1.2, alpha: 0.8 });
      });
      fx.glow(C.W / 2, C.H * 0.45, 200, '#ffe14a', { life: 1.4 });
      fx.rays(C.W / 2, C.H * 0.4, { color: '#ffe14a', color2: '#e8263b', n: 16, r1: 420, life: 1.4, spin: 1, alpha: 0.4 });
      fx.stamp(C.W / 2, C.H * 0.4, 'טה-דה!', { r: 64, color: '#ffe14a', edge: '#8a1020', life: 1.6 });
      fx.shake(4, 0.2);
    },
  },

  // ── 25 · stutter — the paused tape ────────────────────────────────────────
  stutter: {
    theme: 'VHS pause glitch',
    visual: 'RGB-split freeze-frame ball with pause bars, scanlines and a tracking tear, then fast-forward chevrons and speed streaks',
    palette: ['#ff9f1c', '#ff2e63', '#08f7fe', '#1b1b2f', '#e0e0e0'],
    doc: {
      fantasy: 'Somebody hit PAUSE on the tape: the shot freezes mid-air, glitching — then it fast-forwards into the net.',
      purpose: 'A timing trap: the shot flies, stops dead for 0.44 s, then leaves at 1.5× speed. Keepers who dive at the first flight are beaten by the second.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball flies flat at 1.0× power-shot speed for 0.28 s, hangs still for 0.44 s, then bursts forward at 1.5× with a little sag. It lives 2.04 s, and is blockable (costs health) and counterable like any power shot.',
      bot: 'Arms only on attack (POWERS.stutter.arm = "attack": ball past 40% of the pitch toward the far goal, not behind it); striker style (+0.06 aggression, normal tackling).',
      sequence: {
        anticipation: 'While armed six VHS tracking bars in red and cyan flicker beside the champion, a big blinking ▶ with an RGB shadow hangs over his head in a cyan glow, and a red REC dot pulses.',
        activation: 'Under the super cut-in (pink focus lines, giant RGB-split ⏸ bars, a "PAUSE" on-screen label and scanlines rolling down the whole screen): an RGB sunburst and glow at the ball, a "פאוז!" word, red and cyan tracking beams across the full width of the screen, six scanline tears, 24 horizontal streaks and 20 static squares, a cyan flash and edge glow.',
        main: 'The whole screen becomes a VHS tape while the shot flies: scanlines roll down it and the deck\'s on-screen display sits in the corner ("▶ PLAY", then "II PAUSE", then "▶▶ x2", with a running timecode). Paused, a tracking band rolls down the picture, RGB bars jitter down both edges, a giant ghosted RGB ⏸ hangs mid-screen, static snow flickers all over, and the ball is a freeze-frame in a big dark-edged viewfinder with jittering red/cyan ghosts, pause bars, a tracking tear and a buffering ring. Then a "זוום!" word, a ⏩ glyph and a streak burst as it fast-forwards under a giant ghosted ▶▶, with speed lines tearing across the whole screen and three glowing chevrons behind it. The orange ball stays drawn last at its true spot.',
        impact: 'Blocked or scoring: an RGB sunburst and glow, a "טראח!" word, 30 static squares, 20 RGB confetti bits, long tear streaks across the ball\'s height, an orange ring, a ⏹ glyph, a cyan flash and a shake.',
        aftermath: 'The tape ends: a big ⏪ glyph and a "עצור!" word, rewinding streaks, 40 static squares crackling over the whole screen and dying out over 2 s, and a red-cyan glow with drifting pixels lingering.',
        cleanup: 'Glitch particles live ≤2 s, confetti ≤1.6 s.',
      },
      layers: 'Cut-in: focus lines, glow, RGB pause bars, label, ≤66 scanlines. Ball: full-screen scanlines (alpha ≤0.16, 2 px in 6), tracking band, edge RGB bars, giant ghosted ⏸/▶▶, 9 speed lines, OSD text, drawGlow halo, RGB ghosts (lighter), orange core, clipped scanlines, tear band, viewfinder box and label, pause bars, buffer ring, FF chevrons with drawGlow. Particles: glow, rays, beam, stamp, confetti, streaks, static squares, glyphs, rings, dots.',
      camera: 'Shake 6 on firing, 6 on the fast-forward, 10 on impact; cyan flashes of 0.12-0.18 s (alpha ≤0.28) and a cyan vignette on firing.',
      hud: 'The ordinary meter and armed glow; the ⏯️ banner on firing. No lingering status — the power is the shot.',
      audio: 'Fire: a tape-stop — a falling sawtooth with a digital blip. The pause: a quick wind-down. The burst: a rising square zip. Impact: a static crunch and a low thump. End: a rewind chirp.',
      counterplay: 'Do not commit on the first 0.28 s. Wait out the pause in the ball\'s line and meet the fast-forward; or step up and body it while it hangs.',
      perf: '~60 particles on firing, ≤4 a frame in flight, ~70 on impact, ~75 on the end; ball ≤150 draw calls with one clip and ≤4 drawGlow; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), anywhere(), focusLines(), fx.beam, fx.confetti, fx.burst, fx.ring, fx.glyph, fx.stamp, fx.emit(streak/sq), fx.drawGlow, fx.vignette, fx.shake, fx.flash, fx.sound (pause and burst cues), cutFrame(), memo(), s.depth.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 700, to: 70, type: 'sawtooth', peak: 0.35, dur: 0.3 }, { k: 'blip', freq: 1900, type: 'square', peak: 0.15, dur: 0.05 }, { k: 'blip', freq: 950, type: 'square', peak: 0.12, dur: 0.05, t: 0.06 }],
      impact: [{ k: 'thud', freq: 3800, q: 0.4, peak: 0.45, decay: 0.2 }, { k: 'thud', freq: 110, q: 1, peak: 0.8, decay: 0.3 }],
      end: [{ k: 'sweep', from: 400, to: 1600, type: 'triangle', peak: 0.15, dur: 0.15 }, { k: 'sweep', from: 400, to: 1600, type: 'triangle', peak: 0.12, dur: 0.15, t: 0.15 }],
    },

    aura(g, p, s) {
      const f = feet(s, p), h = head(s, p), R = s.headR(p);
      s.fx.drawGlow(g, h.x, h.y - R - 30, 40, '#08f7fe', 0.7);
      g.save();
      g.globalAlpha = 0.65;
      for (let i = 0; i < 6; i++) {
        const y = f.y - 6 - Math.random() * 80, w = 14 + Math.random() * 40;
        const x = f.x + (Math.random() < 0.5 ? -1 : 1) * (s.C.BODY_W / 2 + 14 + Math.random() * 22);
        g.fillStyle = i % 2 ? '#08f7fe' : '#ff2e63';
        g.fillRect(x - w / 2, y, w, 3);
      }
      if ((s.t * 2) % 1 < 0.7) {
        const y = h.y - R - 30;
        for (const [dx, c, a] of [[-3, '#08f7fe', 0.75], [3, '#ff2e63', 0.75], [0, '#ff9f1c', 1]]) {
          g.globalAlpha = a; g.fillStyle = c;
          g.beginPath(); g.moveTo(h.x - 10 + dx, y - 13); g.lineTo(h.x + 13 + dx, y); g.lineTo(h.x - 10 + dx, y + 13); g.closePath(); g.fill();
        }
      }
      // REC
      g.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 8);
      g.fillStyle = '#ff2e63'; disc(g, h.x - p.side * (R + 22), h.y - R - 4, 5);
      g.restore();
    },

    cutin(g, s, k) {
      const { C } = s;
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#ff2e63', 0.35 * c.fade, 7);
      s.fx.drawGlow(g, c.x, c.y, 190 * c.pop, '#08f7fe', 0.7 * c.fade);
      g.save();
      // scanlines rolling down the whole screen
      g.globalAlpha = 0.1 * c.fade; g.fillStyle = '#1b1b2f';
      const roll = (k * 80) % 8;
      for (let y = roll; y < C.H; y += 8) g.fillRect(0, y, C.W, 3);
      // the giant pause bars, split into red, cyan and orange
      const bw = 38 * c.pop, bh = 150 * c.pop, gap = 26 * c.pop;
      const jit = (Math.random() - 0.5) * 6;
      g.globalCompositeOperation = 'lighter';
      for (const [dx, col] of [[-7 + jit, '#ff2e63'], [7 - jit, '#08f7fe']]) {
        g.globalAlpha = 0.75 * c.fade; g.fillStyle = col;
        g.fillRect(c.x - gap / 2 - bw + dx, c.y - bh / 2, bw, bh); g.fillRect(c.x + gap / 2 + dx, c.y - bh / 2, bw, bh);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = c.fade; g.fillStyle = '#ff9f1c';
      g.fillRect(c.x - gap / 2 - bw, c.y - bh / 2, bw, bh); g.fillRect(c.x + gap / 2, c.y - bh / 2, bw, bh);
      g.strokeStyle = '#1b1b2f'; g.lineWidth = 4;
      g.strokeRect(c.x - gap / 2 - bw, c.y - bh / 2, bw, bh); g.strokeRect(c.x + gap / 2, c.y - bh / 2, bw, bh);
      // the on-screen label, VHS style
      if ((k * 6) % 1 < 0.75) {
        g.font = '900 30px Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#e0e0e0'; g.fillText('PAUSE', c.x, c.y + bh / 2 + 28);
      }
      g.restore();
    },

    fire(s, at) {
      const { fx, C } = s;
      blast(s, at.x, at.y, { c1: '#08f7fe', c2: '#ff2e63', n: 18, word: 'פאוז!', wc: '#ff9f1c', edge: '#1b1b2f', spin: 3 });
      // the tracking tear: red and cyan beams across the whole screen
      fx.beam(0, at.y - 8, C.W, at.y - 8, { color: '#ff2e63', color2: '#e0e0e0', w: 12, life: 0.3 });
      fx.beam(0, at.y + 8, C.W, at.y + 8, { color: '#08f7fe', color2: '#e0e0e0', w: 12, life: 0.35 });
      // scanline tears across the screen, both ways
      for (const [dir, c, dy] of [[1, '#ff2e63', -18], [-1, '#08f7fe', 18], [1, '#e0e0e0', 0], [-1, '#ff9f1c', -30], [1, '#08f7fe', 30], [-1, '#ff2e63', 40]]) {
        fx.emit({ shape: 'streak', x: at.x, y: at.y + dy, vx: dir * 800, vy: 0, r: 80, w: 3, life: 0.35, color: c });
      }
      fx.burst(at.x, at.y, 12, { shape: 'streak', speed: 560, spread: 0.4, angle: 0, r: 10, w: 3, life: 0.25, color: '#08f7fe' });
      fx.burst(at.x, at.y, 12, { shape: 'streak', speed: 560, spread: 0.4, angle: Math.PI, r: 10, w: 3, life: 0.25, color: '#ff2e63' });
      fx.burst(at.x, at.y, 20, { shape: 'sq', speed: 260, r: 4, life: 0.4, color: '#e0e0e0', color2: '#ff9f1c' });
      fx.ring(at.x, at.y, { color: '#ff9f1c', r1: 120, life: 0.35, w: 6 });
      fx.flash('#08f7fe', 0.25, 0.12);
      fx.vignette('#08f7fe', 0.45, 0.7);
      fx.shake(6, 0.2);
    },

    ball(g, b, s) {
      const pw = b.power, t = pw ? pw.t : 1;
      const ph = t < 0.28 ? 0 : t < 0.72 ? 1 : 2;
      const d = s.depth(b.x, b.y), r = b.r * 1.4;
      const dir = pw ? pw.dir : Math.sign(b.vx) || 1;
      const { C } = s;
      // THE WHOLE SCREEN IS A VHS TAPE while the shot flies: scanlines, a tracking band rolling
      // down it, and the deck's on-screen display in the corner
      g.save();
      g.globalAlpha = ph === 1 ? 0.16 : 0.08; g.fillStyle = '#1b1b2f';
      const roll = (s.t * 60) % 6;
      for (let y = roll; y < C.H; y += 6) g.fillRect(0, y, C.W, 2);
      if (ph === 1) {
        const ty = ((s.t * 0.9) % 1) * C.H;
        g.globalAlpha = 0.18; g.fillStyle = '#e0e0e0'; g.fillRect(0, ty, C.W, 14);
        g.globalAlpha = 0.5; g.fillStyle = '#ff2e63'; g.fillRect(0, ty - 3, C.W, 3);
        g.fillStyle = '#08f7fe'; g.fillRect(0, ty + 14, C.W, 3);
        // RGB edge bars down both sides of the screen, jittering
        const jx = (Math.random() - 0.5) * 8;
        g.globalAlpha = 0.35; g.fillStyle = '#ff2e63'; g.fillRect(jx, 0, 10, C.H); g.fillRect(C.W - 10 + jx, 0, 10, C.H);
        g.fillStyle = '#08f7fe'; g.fillRect(12 - jx, 0, 6, C.H); g.fillRect(C.W - 18 - jx, 0, 6, C.H);
        // a giant pause sign ghosted over the middle of the picture, RGB-split
        const cx = C.W / 2, cy = C.H * 0.42, bw = 56, bh = 200, gap = 44;
        for (const [dx, col, al] of [[-6, '#ff2e63', 0.22], [6, '#08f7fe', 0.22], [0, '#e0e0e0', 0.2]]) {
          g.globalAlpha = al; g.fillStyle = col;
          g.fillRect(cx - gap / 2 - bw + dx + jx, cy - bh / 2, bw, bh); g.fillRect(cx + gap / 2 + dx + jx, cy - bh / 2, bw, bh);
        }
      } else if (ph === 2) {
        // a giant ghosted fast-forward sign
        const cx = C.W / 2, cy = C.H * 0.42;
        g.globalAlpha = 0.2; g.fillStyle = '#08f7fe';
        g.beginPath();
        for (const o of [-70, 50]) { g.moveTo(cx + o * dir - dir * 50, cy - 90); g.lineTo(cx + o * dir + dir * 70, cy); g.lineTo(cx + o * dir - dir * 50, cy + 90); g.closePath(); }
        g.fill();
        // fast-forward: speed lines tearing across the whole screen
        g.globalAlpha = 0.45; g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const y = C.CEIL_Y + hash(i + 80) * (C.GROUND_Y - C.CEIL_Y), L = 120 + hash(i + 81) * 160;
          const x = ((hash(i + 82) * C.W + s.t * 2200 * dir) % (C.W + L) + C.W + L) % (C.W + L) - L / 2;
          g.strokeStyle = i % 3 === 0 ? '#ff2e63' : i % 3 === 1 ? '#08f7fe' : '#e0e0e0'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - dir * L, y); g.stroke();
        }
      }
      g.globalAlpha = ph === 1 ? ((s.t * 3) % 1 < 0.7 ? 1 : 0.3) : 1;
      const osd = ph === 0 ? '▶ PLAY' : ph === 1 ? 'II PAUSE' : '▶▶ x2';
      g.save(); g.textAlign = 'left';
      g.font = '900 34px Menlo, monospace'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const ox = dir > 0 ? 40 : C.W - 250;
      g.lineWidth = 6; g.strokeStyle = '#1b1b2f'; g.strokeText(osd, ox, 150);
      g.fillStyle = ph === 1 ? '#ff9f1c' : ph === 2 ? '#08f7fe' : '#e0e0e0'; g.fillText(osd, ox, 150);
      g.font = '900 20px Menlo, monospace';
      const tc = `SP 00:0${Math.floor(s.t % 10)}:${String(Math.floor((s.t * 30) % 30)).padStart(2, '0')}`;
      g.strokeText(tc, ox, 182); g.fillStyle = '#e0e0e0'; g.fillText(tc, ox, 182);
      g.restore();
      g.restore();
      s.fx.drawGlow(g, d.x, d.y, r * (ph === 1 ? 5 : 3.5), ph === 1 ? '#ff2e63' : '#08f7fe', 0.7);
      g.save();
      g.translate(d.x, d.y);
      // fast-forward: three big glowing chevrons behind it
      if (ph === 2) {
        for (let i = 0; i < 3; i++) {
          const x = -dir * (r + 14 + i * 22);
          s.fx.drawGlow(g, x, 0, 26, i % 2 ? '#ff2e63' : '#08f7fe', 0.6 - i * 0.15);
          g.globalAlpha = 0.95 - i * 0.25;
          g.fillStyle = i % 2 ? '#ff2e63' : '#08f7fe';
          g.beginPath(); g.moveTo(x - dir * 10, -16); g.lineTo(x + dir * 8, 0); g.lineTo(x - dir * 10, 16); g.lineTo(x - dir * 4, 0); g.closePath(); g.fill();
        }
      }
      // the RGB split: wide and jittering in the freeze, a fringe otherwise
      const spread = ph === 1 ? 7 : 3, j = ph === 1 ? 3 : 0;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = ph === 1 ? 0.8 : 0.55;
      g.fillStyle = '#ff2e63'; disc(g, -spread + (Math.random() - 0.5) * j * 2, (Math.random() - 0.5) * j, r);
      g.fillStyle = '#08f7fe'; disc(g, spread + (Math.random() - 0.5) * j * 2, (Math.random() - 0.5) * j, r);
      g.globalCompositeOperation = 'source-over';
      if (ph === 1) {
        // the freeze-frame: a viewfinder box with corner brackets and the OSD label
        const bw = 74, bh = 56, c = 18;
        g.globalAlpha = 0.95;
        g.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.moveTo(sx * bw, sy * (bh - c)); g.lineTo(sx * bw, sy * bh); g.lineTo(sx * (bw - c), sy * bh);
        }
        g.strokeStyle = '#1b1b2f'; g.lineWidth = 8; g.stroke();
        g.strokeStyle = '#e0e0e0'; g.lineWidth = 4; g.stroke();
        // a focus cross in the corners' middle, and the freeze-frame label
        g.strokeStyle = '#ff9f1c'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-bw + 6, 0); g.lineTo(-bw + 22, 0); g.moveTo(bw - 6, 0); g.lineTo(bw - 22, 0); g.stroke();
        g.font = '900 18px Menlo, monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.lineWidth = 4; g.strokeStyle = '#1b1b2f'; g.strokeText('II PAUSE', -bw + 2, -bh - 14);
        g.fillStyle = '#e0e0e0'; g.fillText('II PAUSE', -bw + 2, -bh - 14);
      }
      g.globalAlpha = 1;
      g.fillStyle = '#ff9f1c'; disc(g, 0, 0, r);
      g.strokeStyle = '#1b1b2f'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.fillStyle = '#e0e0e0'; disc(g, -r * 0.35, -r * 0.35, r * 0.25);
      // scanlines, and in the freeze a tracking tear shoved sideways
      g.save();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      g.fillStyle = '#1b1b2f'; g.globalAlpha = 0.3;
      for (let y = -r; y < r; y += 4) g.fillRect(-r, y, r * 2, 2);
      if (ph === 1 && Math.random() < 0.4) {
        g.globalAlpha = 1; g.fillStyle = '#ff9f1c';
        const ty = (Math.random() - 0.5) * r * 1.4;
        g.fillRect(-r + (Math.random() - 0.5) * 10, ty, r * 2, 4);
      }
      g.restore();
      if (ph === 1) {
        // pause bars over it and a buffering ring filling up to the burst
        const k = clamp((t - 0.28) / 0.44, 0, 1);
        g.fillStyle = '#1b1b2f'; g.globalAlpha = 0.7;
        g.fillRect(-12, -r - 30, 24, 22);
        g.fillStyle = '#e0e0e0'; g.globalAlpha = 1;
        g.fillRect(-9, -r - 28, 6, 18); g.fillRect(3, -r - 28, 6, 18);
        g.strokeStyle = '#ff9f1c'; g.lineWidth = 4;
        g.beginPath(); g.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * k); g.stroke();
      }
      g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const pw = b.power, t = pw ? pw.t : 1;
      const ph = t < 0.28 ? 0 : t < 0.72 ? 1 : 2;
      const st = pw ? memo(pw, () => ({ ph })) : { ph };
      if (ph !== st.ph) {
        st.ph = ph;
        if (ph === 1) {
          fx.glyph(b.x, b.y - 50, '⏸', { r: 32, color: '#e0e0e0', vy: -20, life: 0.5 });
          fx.sound([{ k: 'sweep', from: 600, to: 80, type: 'sawtooth', peak: 0.25, dur: 0.22 }]);
        } else if (ph === 2) {
          const dir = pw.dir;
          fx.burst(b.x, b.y, 18, { shape: 'streak', speed: 820, spread: 0.3, angle: dir > 0 ? 0 : Math.PI, r: 12, w: 3, life: 0.3, color: '#08f7fe' });
          fx.glow(b.x, b.y, 100, '#08f7fe', { life: 0.3 });
          fx.glyph(b.x - dir * 30, b.y - 44, '⏩', { r: 34, color: '#08f7fe', vy: -30, life: 0.5 });
          fx.stamp(b.x, b.y + 60, 'זוום!', { r: 40, color: '#08f7fe', edge: '#1b1b2f', life: 0.7 });
          fx.ring(b.x, b.y, { color: '#ff9f1c', r: 10, r1: 90, life: 0.3, w: 5, layer: 'front' });
          fx.shake(6, 0.2);
          fx.sound([{ k: 'sweep', from: 200, to: 2400, type: 'square', peak: 0.28, dur: 0.2 }]);
        }
      }
      if (ph === 1) {
        if (Math.random() < 0.8) fx.emit({ shape: 'sq', x: b.x + fx.rand(-70, 70), y: b.y + fx.rand(-50, 50), r: 5, life: 0.15, color: Math.random() < 0.5 ? '#ff2e63' : '#08f7fe' });
        // static snow flickering all over the paused picture
        for (let i = 0; i < 2; i++) anywhere(s, { shape: 'sq', r: fx.rand(3, 7), life: 0.12, color: ['#e0e0e0', '#ff2e63', '#08f7fe'][Math.floor(Math.random() * 3)] });
        if (Math.random() < 0.3) fx.emit({ shape: 'streak', x: fx.rand(0, s.C.W), y: fx.rand(s.C.CEIL_Y, s.C.GROUND_Y), vx: 1400, r: 60, w: 3, life: 0.12, color: '#e0e0e0' });
      } else if (ph === 2) {
        const dir = Math.sign(b.vx) || 1;
        fx.emit({ shape: 'streak', x: b.x - dir * 16, y: b.y - 6, vx: dir * 320, r: 18, w: 3, life: 0.16, color: '#08f7fe' });
        fx.emit({ shape: 'streak', x: b.x - dir * 16, y: b.y + 6, vx: dir * 320, r: 18, w: 3, life: 0.16, color: '#ff2e63' });
        if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: b.x - dir * 30, y: b.y + fx.rand(-14, 14), vx: -dir * 60, r: 3, life: 0.2, color: '#e0e0e0' });
      } else if (Math.random() < 0.6) {
        fx.emit({ shape: 'sq', x: b.x, y: b.y + fx.rand(-10, 10), vx: -b.vx * 0.1, r: 3, life: 0.2, color: '#ff9f1c' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const d = s.depth(ev.x, ev.y);
      blast(s, d.x, d.y, { c1: '#ff2e63', c2: '#08f7fe', R: 190, n: 20, rayR: 400, word: 'טראח!', wc: '#ff9f1c', edge: '#1b1b2f', wr: 64, spin: -2 });
      fx.burst(d.x, d.y, 30, { shape: 'sq', speed: 380, r: 4, drag: 2, life: 0.55, color: '#e0e0e0', color2: '#ff9f1c' });
      fx.confetti(d.x, d.y, 20, ['#ff2e63', '#08f7fe', '#ff9f1c']);
      for (const [dir, c, dy] of [[1, '#08f7fe', -12], [-1, '#ff2e63', 12], [-1, '#e0e0e0', 0], [1, '#ff9f1c', 5], [1, '#ff2e63', 24], [-1, '#08f7fe', -24]]) {
        fx.emit({ shape: 'streak', x: d.x, y: d.y + dy, vx: dir * 1000, r: 100, w: 4, life: 0.35, color: c });
      }
      fx.ring(d.x, d.y, { color: '#ff9f1c', r1: 150, life: 0.4, w: 7, layer: 'front' });
      fx.glyph(d.x, d.y - 50, '⏹', { r: 34, color: '#e0e0e0', vy: -30, life: 0.7 });
      fx.flash('#08f7fe', 0.28, 0.18);
      fx.shake(10, 0.35);
    },

    end(s, info) {
      const { fx } = s;
      const b = s.M.ball, d = s.depth(b.x, b.y);
      fx.glow(d.x, d.y, 130, '#ff2e63', { life: 1.2 });
      fx.glyph(d.x, d.y - 46, '⏪', { r: 44, color: '#e0e0e0', vy: -30, life: 1.4 });
      fx.stamp(d.x, d.y - 110, 'עצור!', { r: 44, color: '#ff9f1c', edge: '#1b1b2f', life: 1.4, vy: -20 });
      for (let i = 0; i < fx.n(10); i++) {
        fx.emit({ shape: 'streak', x: d.x + fx.rand(-60, 60), y: d.y + fx.rand(-40, 40), vx: -fx.rand(260, 520), r: 30, w: 4, drag: 1, life: fx.rand(0.5, 1.1), color: i % 2 ? '#ff2e63' : '#08f7fe' });
      }
      // the tape's end: static snow crackling over the whole screen, dying out over 2 s
      for (let i = 0; i < fx.n(40); i++) {
        fx.emit({ shape: 'sq', x: fx.rand(0, s.C.W), y: fx.rand(0, s.C.H), r: fx.rand(3, 8), life: fx.rand(0.3, 2), color: ['#e0e0e0', '#ff2e63', '#08f7fe', '#ff9f1c'][i % 4] });
      }
      linger(s, d.x, d.y, { c1: '#08f7fe', c2: '#ff2e63', R: 200, n: 14, life: 2, w: 140, h: 80, mote: { shape: 'sq', r: 4 } });
    },
  },

  // ── 26 · ice — the skating rink ───────────────────────────────────────────
  ice: {
    theme: 'Skating rink',
    visual: 'glossy pale-blue ice sheet under the victim with sliding reflections and his mirrored body, skate scratch marks, cold mist, ice-chip spray',
    palette: ['#b8f0ff', '#f2fbff', '#6aa8c8', '#d9eef7', '#3d7ea6'],
    doc: {
      fantasy: 'The ground under the opponent turns into a skating rink: he skates when he wants to run and slides when he wants to stop.',
      purpose: 'A softer, longer control than the freeze: 3 s where the victim accelerates at 0.3× and barely stops (friction 0.992 a tick instead of 0.80), with no dash. It punishes over-committing.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is struck at goal on a lofted line and the opponent\'s floor is ice for 3 s: 0.3× acceleration, near-frictionless sliding, dash disabled.',
      bot: 'Arms the moment it can (POWERS.ice.arm = "any"); brawler style (no extra aggression, 1.35× tackling).',
      sequence: {
        anticipation: 'While armed a wide shimmering rink-edge oval rings the champion\'s feet in a pale glow, big skate blades glint under his boots and frost sparkles pop.',
        activation: 'Under the super cut-in (pale focus lines, a giant ice skate gliding along a glossy rink stripe, sparkles twinkling): a pale-blue sunburst and glow at the ball, a "החלקה!" word, a 30-flake skate-stop snow fan, ice shards, 14 glitter papers, two rings, a glassy beam to the opponent\'s feet with frost streaks skidding out both ways, a short ice flash and a long pale edge glow.',
        main: 'For 3 s the stadium is a rink seen through ice: a cold blue wash, broad gloss bands sweeping across the whole screen, the floor strip frosted with glints sliding along it, a blue-and-white rink board along the floor line and dark-edged sparkles twinkling on the ice. A glossy sheet up to 240 px wide follows the victim\'s feet with his body mirrored in it and fresh skate scratches, four glowing skate-swirl arcs spin round his feet (faster as he slides) and a white SLIPPERY "!" warning sign bobs beside his head. Mist curls off it, glitter drifts down over the rink and ice chips spray from his feet.',
        impact: 'The sheet spreads: a glow, a wide ring rolling out along the ground from his feet, ice chips skidding flat both ways, mist puffs and a "ווּיי!" word over him.',
        aftermath: 'The rink cracks and melts: a glow and an ice sunburst, 36 shards burst up and out, two rings, glitter confetti, a big "קראק!" word, a wide mist cloud and a frost glow with drifting sparkles lingering for 2.2 s, and a crackle.',
        cleanup: 'The sheet, wash and floor frost fade over their last 0.35 s; shards run out inside a second, mist and sparkles in 2.6 s.',
      },
      layers: 'Cut-in: focus lines, glow, rink stripe, skate (boot, blade, laces), 5 sparkles. Back: cold wash, floor frost, 3 floor glints, rink board, 10 outlined sparkles, 4 swirl arcs, 2 screen-wide gloss bands, warning sign, 3 gloss drawGlow, ice ellipse with deep-blue edge, mirrored body, sliding gloss, frosted rim, clipped scratch marks. Particles: glow, rays, beam, stamp, confetti, mist smoke, chips, sparkle stars, shards, streaks, rings.',
      camera: 'Shake 4 on firing, 2 when the sheet spreads, 5 on the crack; a 0.15 s ice flash (0.25) and a 1.4 s pale-blue vignette on firing. No grade.',
      hud: 'The engine\'s 🧊 pill with its 3 s ring over the victim.',
      audio: 'Fire: a skate-stop scrape (bright noise) over a glassy tone. Impact: a hollow ice "tonk". End: a triple crackle of breaking ice.',
      counterplay: 'Move early and in short taps — do not sprint, you will not stop. Stand your ground in front of the goal for 3 s rather than chase.',
      perf: '~75 particles on firing, ≤4 a frame while alive, ~100 on the crack; sheet and rink ~60 draw calls plus ≤40 scratch segments under one clip and 3 drawGlow; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), focusLines(), label(), star(), fx.beam, fx.confetti, fx.burst, fx.ring, fx.emit(smoke/sq/star/shard/streak), fx.drawGlow, fx.vignette, fx.shake, fx.flash, cutFrame(), memo() (the scratch history), envelope(), s.depth.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 5000, q: 0.9, peak: 0.4, decay: 0.3 }, { k: 'sweep', from: 1800, to: 1200, type: 'sine', peak: 0.16, dur: 0.3 }],
      impact: [{ k: 'blip', freq: 1175, type: 'sine', peak: 0.3, dur: 0.15 }, { k: 'thud', freq: 2000, q: 5, peak: 0.25, decay: 0.12 }],
      end: [{ k: 'thud', freq: 3500, q: 5, peak: 0.35, decay: 0.08 }, { k: 'thud', freq: 3100, q: 5, peak: 0.3, decay: 0.08, t: 0.06 }, { k: 'thud', freq: 2700, q: 5, peak: 0.28, decay: 0.1, t: 0.13 }],
    },

    aura(g, p, s) {
      const f = feet(s, p);
      s.fx.drawGlow(g, f.x, f.y + 3, 70, '#b8f0ff', 0.6);
      g.save();
      g.globalAlpha = 0.65; g.fillStyle = '#b8f0ff';
      g.beginPath(); g.ellipse(f.x, f.y + 3, 58, 9, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.95; g.strokeStyle = '#3d7ea6'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(f.x, f.y + 3, 58, 9, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#f2fbff'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.3 * Math.sin(s.t * 6);
      g.beginPath(); g.ellipse(f.x, f.y + 3, 53, 6, 0, Math.PI, TAU); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#3d7ea6';
      g.fillRect(f.x - 19, f.y - 1, 16, 4); g.fillRect(f.x + 3, f.y - 1, 16, 4);
      g.fillStyle = '#f2fbff';
      const gl = (s.t * 40) % 16;
      g.fillRect(f.x - 19 + gl, f.y - 1, 3, 4); g.fillRect(f.x + 3 + gl, f.y - 1, 3, 4);
      g.restore();
      if (Math.random() < 0.3) s.fx.emit({ shape: 'star', x: f.x + s.fx.rand(-50, 50), y: f.y + s.fx.rand(-6, 6), r: 5, spin: 4, life: 0.45, color: '#f2fbff' });
    },

    cutin(g, s, k) {
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#b8f0ff', 0.4 * c.fade, 8);
      const sc = 3 * c.pop, x = c.x + (k - 0.5) * 120 * -c.from, y = c.y + 20;
      s.fx.drawGlow(g, x, y, 190 * c.pop, '#b8f0ff', 0.85 * c.fade);
      g.save();
      g.globalAlpha = c.fade;
      // the rink stripe it glides on
      g.fillStyle = '#d9eef7'; g.beginPath(); g.ellipse(c.x, y + 26 * sc, 180 * c.pop, 12 * c.pop, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3d7ea6'; g.lineWidth = 4; g.stroke();
      // the skate: a boot, laces and a long blade
      g.translate(x, y); g.scale(sc * -c.from, sc); g.rotate(-0.08);
      g.fillStyle = '#f2fbff';
      g.beginPath(); g.moveTo(-18, -34); g.lineTo(-2, -34); g.lineTo(0, -8); g.lineTo(24, -4); g.quadraticCurveTo(30, 0, 26, 8); g.lineTo(-20, 8); g.closePath(); g.fill();
      g.strokeStyle = '#3d7ea6'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#6aa8c8'; g.lineWidth = 1.5;
      g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-14, -28 + i * 7); g.lineTo(-4, -24 + i * 7); } g.stroke();
      g.fillStyle = '#6aa8c8'; g.fillRect(-16, 8, 4, 8); g.fillRect(16, 8, 4, 8);
      g.fillStyle = '#b8f0ff'; g.beginPath(); g.moveTo(-26, 16); g.lineTo(28, 16); g.quadraticCurveTo(36, 16, 34, 12); g.lineTo(36, 19); g.lineTo(-26, 19); g.closePath(); g.fill();
      g.restore();
      // sparkles twinkling round it
      g.save(); g.fillStyle = '#f2fbff';
      for (let i = 0; i < 5; i++) {
        g.globalAlpha = c.fade * Math.abs(Math.sin(k * 14 + i * 1.7));
        star(g, c.x + (hash(i + 5) - 0.5) * 360, c.y + (hash(i + 11) - 0.5) * 200, 14, 0, 4, 0.25);
      }
      g.restore();
    },

    fire(s, at) {
      const { fx, side } = s;
      blast(s, at.x, at.y, { c1: '#b8f0ff', c2: '#f2fbff', n: 12, word: 'החלקה!', wc: '#f2fbff', edge: '#3d7ea6', spin: 1 });
      fx.burst(at.x, at.y, 30, { shape: 'sq', speed: 420, spread: 1.5, angle: side > 0 ? -0.5 : Math.PI + 0.5, r: 4, grav: 700, life: 0.7, color: '#f2fbff', color2: '#d9eef7' });
      fx.burst(at.x, at.y, 12, { shape: 'shard', speed: 320, r: 6, spin: 10, grav: 600, life: 0.7, color: '#b8f0ff', color2: '#6aa8c8' });
      fx.confetti(at.x, at.y, 14, ['#f2fbff', '#b8f0ff', '#6aa8c8']);
      fx.ring(at.x, at.y, { color: '#b8f0ff', r1: 130, life: 0.4, w: 6 });
      fx.ring(at.x, at.y, { color: '#3d7ea6', r: 4, r1: 80, life: 0.45, w: 4 });
      // the ice races along the floor to him: a skid of frost streaks and a glassy beam
      const q = feet(s, s.foe);
      fx.beam(at.x, at.y, q.x, q.y, { color: '#b8f0ff', color2: '#f2fbff', w: 18, life: 0.4 });
      for (let i = 0, n = fx.n(12); i < n; i++) {
        fx.emit({ shape: 'streak', x: q.x, y: q.y - fx.rand(0, 10), vx: (i % 2 ? 1 : -1) * fx.rand(400, 700), vy: 0, drag: 2, r: 16, w: 4, life: 0.6, color: i % 3 ? '#f2fbff' : '#6aa8c8' });
      }
      fx.flash('#b8f0ff', 0.25, 0.15);
      fx.vignette('#b8f0ff', 0.55, 1.4);
      fx.shake(4, 0.15);
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.on != null ? s.M.players[ev.on] : s.foe, f = feet(s, q), h = head(s, q);
      fx.glow(f.x, f.y, 120, '#d9eef7', { life: 0.5 });
      fx.ring(f.x, f.y + 3, { color: '#d9eef7', r: 10, r1: 190, life: 0.55, w: 5 });
      fx.burst(f.x, f.y, 8, { shape: 'shard', speed: 320, angle: 0, spread: 0.3, r: 6, drag: 3, life: 0.55, color: '#b8f0ff' });
      fx.burst(f.x, f.y, 8, { shape: 'shard', speed: 320, angle: Math.PI, spread: 0.3, r: 6, drag: 3, life: 0.55, color: '#b8f0ff' });
      for (let i = 0; i < fx.n(5); i++) fx.emit({ shape: 'smoke', x: f.x + fx.rand(-60, 60), y: f.y, vy: -18, r: 7, r1: 24, life: 0.9, alpha: 0.6, color: '#d9eef7', layer: 'back' });
      if (ev.kind === 'land') fx.stamp(h.x, h.y - s.headR(q) - 60, 'ווּיי!', { r: 40, color: '#b8f0ff', edge: '#3d7ea6', life: 0.9 });
      fx.shake(2, 0.15);
    },

    back(g, e, s) {
      const { C } = s;
      const q = victim(s, e), f = feet(s, q);
      const k = envelope(e, 0.2, 0.35);
      const w = 240 * (0.3 + 0.7 * k), G = f.y;
      // the whole stadium turns rink-cold, and the floor strip frosts over end to end
      wash(g, s, '#3d7ea6', 0.14 * k, e.t);
      g.save();
      g.globalAlpha = 0.3 * k; g.fillStyle = '#d9eef7';
      g.fillRect(0, C.GROUND_Y, C.W, C.H - C.GROUND_Y);
      // big glossy glints sliding along the whole floor
      g.globalCompositeOperation = 'lighter'; g.fillStyle = '#f2fbff';
      for (let i = 0; i < 3; i++) {
        const x = ((s.t * 260 + i * C.W / 3) % (C.W + 200)) - 100;
        g.globalAlpha = 0.3 * k;
        g.beginPath(); g.moveTo(x, C.GROUND_Y); g.lineTo(x + 40, C.GROUND_Y); g.lineTo(x + 10, C.H); g.lineTo(x - 30, C.H); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // the rink boards: a blue-and-white rail along the whole floor line
      g.globalAlpha = 0.9 * k;
      g.fillStyle = '#3d7ea6'; g.fillRect(0, C.GROUND_Y - 3, C.W, 6);
      g.fillStyle = '#f2fbff';
      for (let x = 0; x < C.W; x += 60) g.fillRect(x, C.GROUND_Y - 3, 30, 3);
      // four-point sparkles twinkling across the ice, dark-edged so they read on white
      g.strokeStyle = '#3d7ea6'; g.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const tw = Math.abs(Math.sin(s.t * 3 + i * 1.3));
        if (tw < 0.3) continue;
        const x = hash(i + 90) * C.W, y = C.GROUND_Y + 8 + hash(i + 91) * (C.H - C.GROUND_Y - 14);
        g.globalAlpha = k * tw; g.fillStyle = '#f2fbff';
        star(g, x, y, 5 + 7 * tw, 0, 4, 0.25); g.stroke();
      }
      g.restore();
      // the victim's spin: two glowing skate-swirl arcs round his feet when he moves
      const spd = clamp(Math.abs(q.vx) / 200, 0, 1);
      g.save();
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        const a = s.t * (6 + 6 * spd) * (i < 2 ? 1 : -1) + i * Math.PI, hy = i < 2 ? 8 : 30, rx = i < 2 ? 56 : 44;
        g.globalAlpha = (0.45 + 0.5 * spd) * k; g.strokeStyle = i % 2 ? '#b8f0ff' : '#f2fbff';
        g.beginPath(); g.ellipse(f.x, G - hy, rx, 12, 0, a, a + 2.4); g.stroke();
      }
      // the whole picture seen through a sheet of ice: broad gloss bands sweeping the screen
      g.fillStyle = '#f2fbff';
      for (let i = 0; i < 2; i++) {
        const x = ((s.t * 180 + i * (C.W * 0.6 + 200)) % (C.W + 600)) - 300;
        g.globalAlpha = 0.12 * k;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 90, 0); g.lineTo(x - 90, C.H); g.lineTo(x - 180, C.H); g.closePath(); g.fill();
        g.globalAlpha = 0.18 * k;
        g.beginPath(); g.moveTo(x + 110, 0); g.lineTo(x + 124, 0); g.lineTo(x - 56, C.H); g.lineTo(x - 70, C.H); g.closePath(); g.fill();
      }
      g.restore();
      // a SLIPPERY! sign bobbing beside him: a white warning triangle, a skid "!" inside
      const h = head(s, q), R = s.headR(q), side = q.x < C.W / 2 ? 1 : -1;
      const sx = h.x + side * (R + 46), sy = h.y + Math.sin(s.t * 4) * 4, tip = Math.sin(s.t * 3) * 0.25;
      g.save();
      g.globalAlpha = k;
      g.translate(sx, sy); g.rotate(tip);
      g.lineJoin = 'round';
      g.fillStyle = '#f2fbff'; g.strokeStyle = '#3d7ea6'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, -26); g.lineTo(26, 20); g.lineTo(-26, 20); g.closePath(); g.fill(); g.stroke();
      label(g, '!', 0, 4, 30, '#3d7ea6', '#f2fbff');
      g.restore();
      for (let i = 0; i < 3; i++) {
        const u = ((s.t * 0.5 + i / 3) % 1) * 2 - 1;
        s.fx.drawGlow(g, f.x + u * w * 0.8, G + 5, 34, '#f2fbff', 0.6 * k * (1 - Math.abs(u)));
      }
      g.save();
      g.globalAlpha = 0.85 * k; g.fillStyle = '#b8f0ff';
      g.beginPath(); g.ellipse(f.x, G + 5, w, 14, 0, 0, TAU); g.fill();
      g.save();
      g.clip();
      // his reflection: the body, mirrored into the ice
      g.globalAlpha = 0.28 * k; g.fillStyle = '#3d7ea6';
      g.fillRect(f.x - s.C.BODY_W / 2, G + 1, s.C.BODY_W, 16);
      // skate scratches, fading with age
      const st = mem.get(e);
      if (st && st.pts.length > 1) {
        g.strokeStyle = '#6aa8c8'; g.lineWidth = 2;
        for (let i = 1; i < st.pts.length; i++) {
          const a = st.pts[i - 1], b = st.pts[i];
          g.globalAlpha = k * clamp(1 - (e.t - b.t) / 0.6, 0, 1) * 0.9;
          g.beginPath(); g.moveTo(a.x, G + 5 + a.y); g.lineTo(b.x, G + 5 + b.y); g.stroke();
        }
      }
      // gloss sweeping across
      g.strokeStyle = '#f2fbff'; g.lineWidth = 4; g.globalAlpha = 0.75 * k;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const u = ((s.t * 0.7 + i / 3) % 1) * 2 - 1, x = f.x + u * w;
        g.moveTo(x - 9, G + 16); g.lineTo(x + 9, G - 3);
      }
      g.stroke();
      g.restore();
      // a deep-blue edge under the frosted rim: the sheet reads on a pale stage and a dark one
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#3d7ea6'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(f.x, G + 5, w, 14, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#f2fbff'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(f.x, G + 5, w - 4, 11, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      const q = victim(s, e), f = feet(s, q);
      const st = memo(e, () => ({ pts: [] }));
      if (q.onGround && Math.abs(q.vx) > 20) {
        st.pts.push({ x: f.x + fx.rand(-6, 6), y: fx.rand(-4, 4), t: e.t });
        if (Math.abs(q.vx) > 120) fx.emit({ shape: 'sq', x: f.x, y: f.y, vx: -q.vx * 0.4 + fx.rand(-30, 30), vy: fx.rand(-140, -50), grav: 700, r: 3, life: 0.45, color: '#f2fbff' });
      }
      while (st.pts.length > 40 || (st.pts.length && e.t - st.pts[0].t > 0.6)) st.pts.shift();
      if (Math.random() < 0.35) fx.emit({ shape: 'smoke', x: f.x + fx.rand(-130, 130), y: f.y + 2, vy: -14, vx: fx.rand(-8, 8), r: 6, r1: 24, life: 1, alpha: 0.5, color: '#d9eef7', layer: 'back' });
      if (Math.random() < 0.2) fx.emit({ shape: 'star', x: f.x + fx.rand(-180, 180), y: f.y + fx.rand(-4, 8), r: 5, spin: 4, life: 0.5, color: '#f2fbff' });
      // cold glitter drifting down over the whole rink
      if (Math.random() < 0.6) fx.emit({ shape: 'star', x: fx.rand(0, s.C.W), y: fx.rand(s.C.CEIL_Y, s.C.GROUND_Y - 60), vx: fx.rand(-10, 10), vy: fx.rand(30, 60), spin: 3, r: fx.rand(3, 6), life: 1.4, color: Math.random() < 0.5 ? '#f2fbff' : '#b8f0ff', layer: 'back' });
    },

    end(s, info) {
      const { fx } = s;
      const q = victim(s, info.e), f = feet(s, q);
      fx.glow(f.x, f.y, 180, '#b8f0ff', { life: 0.7 });
      fx.rays(f.x, f.y - 20, { color: '#b8f0ff', color2: '#f2fbff', n: 14, r1: 340, life: 0.8, spin: 1.6, alpha: 0.45 });
      fx.burst(f.x, f.y, 36, { shape: 'shard', speed: 420, angle: -Math.PI / 2, spread: 2.8, r: 8, spin: 12, grav: 900, life: 1, color: '#b8f0ff', color2: '#6aa8c8' });
      fx.ring(f.x, f.y + 3, { color: '#f2fbff', r: 20, r1: 220, life: 0.45, w: 6 });
      fx.ring(f.x, f.y + 3, { color: '#3d7ea6', r: 10, r1: 150, life: 0.5, w: 4 });
      fx.confetti(f.x, f.y - 20, 14, ['#f2fbff', '#b8f0ff', '#6aa8c8']);
      fx.stamp(f.x, f.y - 120, 'קראק!', { r: 52, color: '#f2fbff', edge: '#3d7ea6', life: 1.3 });
      for (let i = 0; i < fx.n(10); i++) fx.emit({ shape: 'smoke', x: f.x + fx.rand(-160, 160), y: f.y, vy: -20, r: 9, r1: 40, life: fx.rand(1.6, 2.4), alpha: 0.6, color: '#d9eef7', layer: 'back' });
      linger(s, f.x, f.y - 10, { c1: '#b8f0ff', c2: '#f2fbff', R: 220, n: 18, life: 2.2, w: 240, h: 20, vy: -18, mote: { shape: 'star', spin: 3, r: 5 } });
      fx.shake(5, 0.25);
    },
  },

  // ── 27 · portal — the rift ────────────────────────────────────────────────
  portal: {
    theme: 'Dimensional rift',
    visual: 'swirling purple and teal vortex doorways, a magenta space-tear crack, the victim sucked into one rift and spat out of a matching one at halfway',
    palette: ['#6a5cff', '#00e0c6', '#cfc9ff', '#1a0b3d', '#ff4fd8'],
    doc: {
      fantasy: 'Space tears open under the opponent and swallows him — he tumbles out of a second rift on the halfway line, far from his own goal.',
      purpose: 'Stage 27\'s keeper-removal: the opponent is moved to 40 px on the champion\'s side of the halfway line and his goal is left empty for the lofted strike that fired it.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The opponent is teleported instantly to halfway (standing, all speed killed) and the ball is struck at his empty goal on a lofted line. Instant — no duration.',
      bot: 'Arms only on attack (POWERS.portal.arm = "attack": the ball past 40% of the pitch toward the far goal, not behind it); striker style (+0.06 aggression, normal tackling).',
      sequence: {
        anticipation: 'While armed a big vortex doorway spins behind the champion in a violet glow with a magenta tear beside it, and a glowing violet ring shimmers under the opponent\'s feet — where the rift will open.',
        activation: 'Under the super cut-in (violet focus lines and a giant spiralling vortex with star specks being sucked into it): at the ball a violet glow and ring. Where the opponent stood the entry rift collapses: a violet glow, rings shrinking inward, streaks sucked to its centre, a vertical magenta tear and a "פוף!" word. A magenta wormhole beam shoots from the entry to the exit on the halfway line, where a teal rift blooms with a teal sunburst, a glow, rings, streaks, dark mist, glitter confetti and a "הופה!" word; a violet flash and edge glow.',
        main: 'For 0.6 s (the effect record) deep space leaks into the stadium (a dark violet wash) and both doorways stand open — each a giant spiral vortex (60×120) in a big glow, ringed by circling star specks — joined by a glowing dashed magenta wormhole arc thrown over the pitch; sparks are sucked into the entry and spat out of the exit, and both shrink shut as the record runs out.',
        impact: 'Arrival (the effect landing, or the "teleport" event): a teal glow, a ring and a 12-star sparkle at the victim\'s feet as he lands.',
        aftermath: 'Both doorways slam shut — a magenta flash-star, a ring snapping closed and a crackle of lightning at each — and a "ביי!" word pops; each spot keeps shimmering for 2.2 s with a coloured glow, slow faint rays, a widening ring and drifting stardust.',
        cleanup: 'Rift particles live ≤2.6 s; nothing is left on the pitch.',
      },
      layers: 'Cut-in: focus lines, glow, rift() at 90×110, 10 sucked specks. Aura: rift() (dark core, 4 spiral arms in lighter blend, rim), drawGlow, tear line, foe shimmer. Back: space wash, wormhole arc (dark + dashed magenta + pale core), rift() ×2 at 60×120, 16 circling star specks, 3 drawGlow. Particles: glow, rays, beam, stamp, confetti, rings, streaks, bolt tears, stars, mist, dots.',
      camera: 'Shake 7, a 0.2 s violet flash at alpha 0.22 and a 0.9 s violet vignette on firing; shake 3 on arrival.',
      hud: 'Nothing lingers — the power is instant; the 🌀 banner on firing.',
      audio: 'Fire: a warbling detuned drop into a sub whump. Impact: a reversed "fwoomp" of arrival. End: a soft shimmering chime.',
      counterplay: 'Keep the champion off the ball near your goal — it only arms on attack. Once moved, sprint back or cut the lofted strike off from halfway; it is not a power ball.',
      perf: '~95 particles on firing across both rifts (bursts ≤18 each), ≤4 a frame while open, ~60 on the close; one rift draw is ~7 paths, ≤3 drawGlow a frame; no shadowBlur.',
      helpers: 'blast() (fx.glow/rays/stamp), linger(), wash(), focusLines(), fx.beam, fx.confetti, fx.ring, fx.burst, fx.bolt, fx.stamp, fx.emit(streak/star/smoke/sq/dot), fx.drawGlow, fx.vignette, fx.shake, fx.flash, cutFrame(), rift(), star(), s.depth, s.headR.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 1200, to: 180, type: 'sine', peak: 0.4, dur: 0.45, detune: 30 }, { k: 'sweep', from: 1250, to: 190, type: 'triangle', peak: 0.25, dur: 0.45, detune: -30 }, { k: 'thud', freq: 60, q: 0.8, peak: 0.7, decay: 0.3, t: 0.35 }],
      impact: [{ k: 'sweep', from: 120, to: 900, type: 'sine', peak: 0.35, dur: 0.25 }, { k: 'thud', freq: 400, q: 1.5, peak: 0.4, decay: 0.15, t: 0.22 }],
      end: [{ k: 'blip', freq: 1480, type: 'sine', peak: 0.2, dur: 0.2 }, { k: 'blip', freq: 1976, type: 'sine', peak: 0.16, dur: 0.25, t: 0.08 }],
    },

    aura(g, p, s) {
      const f = feet(s, p), q = feet(s, s.foe);
      // remember where the victim is standing: the entry rift opens here when it fires
      portalFrom[p.index] = { x: s.foe.x, y: s.foe.y };
      const x = f.x - p.side * 44, y = f.y - 36;
      s.fx.drawGlow(g, x, y, 60, '#6a5cff', 0.8);
      rift(g, x, y, 18, 38, -s.t * 5, 0.95);
      g.save();
      g.strokeStyle = '#ff4fd8'; g.lineWidth = 3; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(x - p.side * 26, y - 40);
      for (let i = 1; i <= 7; i++) g.lineTo(x - p.side * (26 + (i % 2 ? 6 : -3)), y - 40 + i * 11);
      g.stroke();
      g.restore();
      s.fx.drawGlow(g, q.x, q.y + 3, 50, '#6a5cff', 0.35 + 0.25 * Math.sin(s.t * 6));
      g.save();
      g.strokeStyle = '#6a5cff'; g.lineWidth = 3; g.globalAlpha = 0.45 + 0.3 * Math.sin(s.t * 6);
      g.beginPath(); g.ellipse(q.x, q.y + 3, 40, 7, 0, 0, TAU); g.stroke();
      g.restore();
      if (Math.random() < 0.4) {
        const a = Math.random() * TAU, life = 0.4;
        s.fx.emit({ shape: 'dot', x: x + Math.cos(a) * 44, y: y + Math.sin(a) * 60, vx: -Math.cos(a) * 44 / life, vy: -Math.sin(a) * 60 / life, r: 2.5, life, color: '#cfc9ff' });
      }
    },

    cutin(g, s, k) {
      const c = cutFrame(s, k);
      if (c.fade <= 0) return;
      focusLines(g, s, c.x, c.y, '#6a5cff', 0.45 * c.fade, 9);
      s.fx.drawGlow(g, c.x, c.y, 200 * c.pop, '#6a5cff', 0.85 * c.fade);
      rift(g, c.x, c.y, 90 * c.pop, 110 * c.pop, -k * 10, c.fade);
      // star specks spiralling in
      g.save();
      g.fillStyle = '#cfc9ff';
      for (let i = 0; i < 10; i++) {
        const u = (k * 1.6 + hash(i) ) % 1, a = i * 2.4 - u * 5, r = (1 - u) * 190;
        g.globalAlpha = c.fade * u;
        star(g, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.9, 5 + 5 * u, a, 4, 0.35);
      }
      g.restore();
    },

    fire(s, at) {
      const { fx } = s;
      const q = s.foe;
      const mem0 = portalFrom[s.owner.index];
      // no memory (fired without an armed frame drawn): open it on his own goal line
      const from = mem0 || { x: q.side > 0 ? s.C.GOAL_W + 30 : s.C.W - s.C.GOAL_W - 30, y: s.C.GROUND_Y };
      const A = s.depth(from.x, from.y - 34), B = s.depth(q.x, q.y - 34);
      fx.glow(at.x, at.y, 90, '#6a5cff', { life: 0.4 });
      fx.ring(at.x, at.y, { color: '#6a5cff', r1: 120, life: 0.4, w: 6 });
      // ENTRY — the doorway collapsing where he stood, everything sucked into it
      fx.glow(A.x, A.y, 130, '#6a5cff', { life: 0.6 });
      fx.ring(A.x, A.y, { color: '#6a5cff', r: 110, r1: 4, life: 0.5, w: 6, layer: 'front' });
      fx.ring(A.x, A.y, { color: '#00e0c6', r: 75, r1: 3, life: 0.4, w: 4, layer: 'front' });
      fx.ring(A.x, A.y, { color: '#cfc9ff', r: 40, r1: 4, life: 0.9, w: 4 });
      for (let i = 0, n = fx.n(18); i < n; i++) {
        const a = (i / n) * TAU, life = 0.42;
        fx.emit({ shape: 'streak', x: A.x + Math.cos(a) * 60, y: A.y + Math.sin(a) * 90, vx: -Math.cos(a) * 60 / life, vy: -Math.sin(a) * 90 / life, r: 7, w: 3, life, color: i % 2 ? '#6a5cff' : '#cfc9ff' });
      }
      fx.bolt(A.x, A.y - 90, A.x, A.y + 34, { color: '#ff4fd8', life: 0.5, w: 4 });
      fx.emit({ shape: 'star', x: A.x, y: A.y, r: 24, r1: 2, life: 0.45, color: '#cfc9ff', blend: 'lighter' });
      fx.stamp(A.x, A.y - 110, 'פוף!', { r: 42, color: '#cfc9ff', edge: '#1a0b3d', life: 0.9 });
      // the wormhole: a magenta beam and streaks shot from entry to exit
      fx.beam(A.x, A.y, B.x, B.y, { color: '#ff4fd8', color2: '#cfc9ff', w: 18, life: 0.45 });
      for (let i = 0, n = fx.n(8); i < n; i++) {
        const life = 0.3 + i * 0.03;
        fx.emit({ shape: 'streak', x: A.x, y: A.y + fx.rand(-24, 24), vx: (B.x - A.x) / life, vy: (B.y - A.y) / life, r: 16, w: 3, life, color: '#ff4fd8', blend: 'lighter' });
      }
      // EXIT — the teal doorway blooming on the halfway line
      blast(s, B.x, B.y, { c1: '#00e0c6', c2: '#6a5cff', R: 150, n: 14, rayR: 320, word: 'הופה!', wc: '#00e0c6', edge: '#1a0b3d', wy: B.y - 110, spin: 2.4 });
      fx.ring(B.x, B.y, { color: '#00e0c6', r: 4, r1: 120, life: 0.5, w: 6, layer: 'front' });
      fx.ring(B.x, B.y, { color: '#6a5cff', r: 4, r1: 80, life: 0.6, w: 4, layer: 'front' });
      fx.ring(B.x, B.y, { color: '#cfc9ff', r: 44, r1: 26, life: 1, w: 4 });
      fx.burst(B.x, B.y, 18, { shape: 'streak', speed: 420, r: 7, w: 3, drag: 2, life: 0.5, color: '#00e0c6' });
      fx.burst(B.x, B.y, 6, { shape: 'smoke', speed: 70, r: 12, r1: 36, drag: 2, life: 1, color: '#1a0b3d', layer: 'back' });
      fx.confetti(B.x, B.y, 16, ['#6a5cff', '#00e0c6', '#ff4fd8', '#cfc9ff']);
      fx.bolt(B.x, B.y - 90, B.x, B.y + 34, { color: '#ff4fd8', life: 0.45, w: 4 });
      fx.emit({ shape: 'star', x: B.x, y: B.y, r: 4, r1: 34, life: 0.4, color: '#00e0c6', blend: 'lighter' });
      fx.flash('#6a5cff', 0.22, 0.2);
      fx.vignette('#6a5cff', 0.5, 0.9);
      fx.shake(7, 0.3);
      portalFrom[s.owner.index] = null;
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.on != null ? s.M.players[ev.on] : s.foe, f = feet(s, q);
      fx.glow(f.x, f.y, 80, '#00e0c6', { life: 0.45 });
      fx.ring(f.x, f.y, { color: '#00e0c6', r: 6, r1: 100, life: 0.4, w: 5 });
      fx.burst(f.x, f.y, 12, { shape: 'star', speed: 220, angle: -Math.PI / 2, spread: 2.6, r: 5, spin: 6, grav: 500, life: 0.6, color: '#cfc9ff' });
      fx.shake(3, 0.15);
    },

    // The 0.6 s effect record: both doorways, full size, shrinking shut over its life.
    back(g, e, s) {
      const q = victim(s, e);
      const st = memo(e, () => ({ from: e.fromX != null ? { x: e.fromX, y: e.fromY ?? s.C.GROUND_Y } : portalFrom[e.owner], to: { x: q.x, y: q.y } }));
      const k = 1 - clamp(e.t / e.life, 0, 1), ke = 1 - (1 - k) ** 2;
      // deep space leaks into the stadium while both doors are open
      wash(g, s, '#1a0b3d', 0.3 * ke, e.t);
      const B = s.depth(st.to.x, st.to.y - 40);
      const A = st.from ? s.depth(st.from.x, st.from.y - 40) : null;
      // the wormhole: a glowing arc thrown over the pitch from the entry to the exit
      if (A) {
        const mx = (A.x + B.x) / 2, my = Math.min(A.y, B.y) - 150 - Math.abs(B.x - A.x) * 0.15;
        g.save();
        g.lineCap = 'round';
        g.globalAlpha = 0.7 * ke; g.strokeStyle = '#1a0b3d'; g.lineWidth = 16;
        g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.setLineDash([18, 14]); g.lineDashOffset = -s.t * 260;
        g.globalAlpha = 0.95 * ke; g.strokeStyle = '#ff4fd8'; g.lineWidth = 7; g.stroke();
        g.setLineDash([]);
        g.strokeStyle = '#cfc9ff'; g.lineWidth = 2.5; g.stroke();
        g.restore();
        s.fx.drawGlow(g, mx, my + 60, 160 * ke, '#ff4fd8', 0.35 * ke);
        s.fx.drawGlow(g, A.x, A.y, 190 * ke, '#6a5cff', 0.9 * ke);
        rift(g, A.x, A.y, 60 * ke, 120 * ke, -s.t * 6, ke);
      }
      s.fx.drawGlow(g, B.x, B.y, 190 * ke, '#00e0c6', 0.9 * ke);
      rift(g, B.x, B.y, 60 * ke, 120 * ke, s.t * 6, ke);
      // star specks circling both doors
      g.save();
      for (const [P, dir, col] of [[A, -1, '#cfc9ff'], [B, 1, '#00e0c6']]) {
        if (!P) continue;
        for (let i = 0; i < 8; i++) {
          const a = dir * s.t * 3 + (i / 8) * TAU, r = (80 + 20 * Math.sin(s.t * 5 + i)) * ke;
          g.globalAlpha = ke; g.fillStyle = i % 2 ? col : '#ff4fd8';
          star(g, P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * 1.5, 6, a, 4, 0.35);
        }
      }
      g.restore();
    },

    tick(e, s) {
      const st = mem.get(e);
      if (!st) return;
      const { fx } = s;
      // sparks sucked into the entry…
      if (st.from) {
        const A = s.depth(st.from.x, st.from.y - 40);
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * TAU, life = 0.35;
          fx.emit({ shape: 'dot', x: A.x + Math.cos(a) * 110, y: A.y + Math.sin(a) * 150, vx: -Math.cos(a) * 110 / life, vy: -Math.sin(a) * 150 / life, r: 3.5, life, color: i ? '#cfc9ff' : '#ff4fd8', blend: 'lighter' });
        }
      }
      // …and spat out of the exit
      const B = s.depth(st.to.x, st.to.y - 40);
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU, v = fx.rand(200, 380);
        fx.emit({ shape: 'streak', x: B.x, y: B.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, r: 7, w: 3, life: 0.45, color: i ? '#00e0c6' : '#cfc9ff' });
      }
    },

    end(s, info) {
      const st = info.e && mem.get(info.e);
      const q = victim(s, info.e);
      for (const p of [st && st.from, st ? st.to : { x: q.x, y: q.y }]) {
        if (!p) continue;
        const d = s.depth(p.x, p.y - 40), fx = s.fx, entry = p === (st && st.from);
        // the door slams: a flash-star and a ring snapping shut…
        fx.glow(d.x, d.y, 120, '#ff4fd8', { life: 0.5 });
        fx.ring(d.x, d.y, { color: '#cfc9ff', r: 90, r1: 2, life: 0.35, w: 6, layer: 'front' });
        fx.emit({ shape: 'star', x: d.x, y: d.y, r: 40, r1: 2, life: 0.45, color: '#ff4fd8', blend: 'lighter' });
        fx.bolt(d.x - 40, d.y - 80, d.x + 40, d.y + 60, { color: '#ff4fd8', life: 0.6, w: 4 });
        // …and the spot keeps shimmering with stardust for two seconds
        linger(s, d.x, d.y, { c1: entry ? '#6a5cff' : '#00e0c6', c2: '#cfc9ff', R: 230, n: 26, life: 2.6, w: 100, h: 120, vy: -14, spin: entry ? -0.6 : 0.6, mote: { shape: 'star', spin: 4, r: 5 } });
        fx.ring(d.x, d.y, { color: entry ? '#6a5cff' : '#00e0c6', r: 20, r1: 150, life: 1.4, w: 4 });
      }
      s.fx.stamp(s.C.W / 2, s.C.H * 0.3, 'ביי!', { r: 48, color: '#cfc9ff', edge: '#1a0b3d', life: 1.3 });
    },
  },
};
