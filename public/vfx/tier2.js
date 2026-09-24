// Tier 2 — ליגה (stages 10-18) champion VFX. See public/champ-vfx.js for the contract: every
// hook only DRAWS, reading the match it is handed (s.M) and never writing to it.

const TAU = Math.PI * 2;

// Per-record memory the hooks keep for themselves: last onGround, last hop, where a dragged
// kettlebell has got to. Keyed by the sim's own objects so it dies with them — and kept HERE,
// never on the record: a field written onto m.ball.power is a write to the match.
const MEMO = new WeakMap();
const memo = (o, init) => { let v = MEMO.get(o); if (!v) { v = init(); MEMO.set(o, v); } return v; };

// 0 → 1 over an effect's first `a` seconds, 1 → 0 over its last `b`: nothing pops in or out.
const fade = (e, a = 0.25, b = 0.5) => Math.max(0, Math.min(1, e.t / a, (e.life - e.t) / b));
const hash = (n) => { const j = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return j - Math.floor(j); };
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// The player an effect is on: its target, or for a field effect the champion who cast it.
const who = (s, e) => s.M.players[e.target != null ? e.target : e.owner];
// The cut-in's own fade (k runs 0 → 1 over its second), and an ease-out for things rising in.
const cf = (k) => Math.max(0, Math.min(1, k / 0.08, (1 - k) / 0.35));
const ease = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3;
// Where a comic word may sit: never above the top of the screen.
const top = (y) => Math.max(64, y);
// The cut-in signature sits on the champion's own half, clear of the screen edge.
const cx = (s, m = 170) => Math.max(m, Math.min(s.C.W - m, s.owner.x));

// The touch's big moment, in a power's colours: a sunburst and two light blobs, one white-hot.
function pop(fx, x, y, c1, c2, o = {}) {
  fx.rays(x, y, { color: c1, color2: c2, n: o.n || 16, r1: o.R || 340, life: o.life || 0.75, spin: o.spin ?? 1.2, alpha: o.alpha ?? 0.5 });
  fx.glow(x, y, o.g || 150, c1, { life: 0.7, alpha: 0.9 });
  fx.glow(x, y, (o.g || 150) * 0.45, '#ffffff', { life: 0.35, alpha: 0.8 });
}

// A burst of flat light wedges turning round (x, y) — drawn straight to the canvas, so an effect
// can hold a sunburst behind a body for its whole life. Two colours alternate; `a` is its alpha.
function wedges(g, x, y, r0, r1, n, rot, c1, c2, a) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * TAU, w = (TAU / n) * 0.42;
    g.globalAlpha = a * (i % 2 ? 0.6 : 1); g.fillStyle = i % 2 ? c2 : c1;
    g.beginPath();
    g.moveTo(x + Math.cos(a0 - w * 0.3) * r0, y + Math.sin(a0 - w * 0.3) * r0);
    g.lineTo(x + Math.cos(a0 - w) * r1, y + Math.sin(a0 - w) * r1);
    g.lineTo(x + Math.cos(a0 + w) * r1, y + Math.sin(a0 + w) * r1);
    g.lineTo(x + Math.cos(a0 + w * 0.3) * r0, y + Math.sin(a0 + w * 0.3) * r0);
    g.closePath(); g.fill();
  }
  g.restore();
}

// Stroke the current path twice: a dark keyline, then the colour on top — reads on any stage.
function keyed(g, dark, col, w) {
  g.strokeStyle = dark; g.lineWidth = w + 4; g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
}

// A jagged line re-rolled from `seed`, for crackle and cracks drawn straight to the canvas.
function jag(g, x1, y1, x2, y2, seed, amp = 10, n = 6) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  g.beginPath(); g.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const f = i / n, o = (hash(seed + i * 7.31) - 0.5) * 2 * amp;
    g.lineTo(x1 + dx * f + nx * o, y1 + dy * f + ny * o);
  }
  g.lineTo(x2, y2); g.stroke();
}

// The colossus's head: a squared-off monument with a domed crown, centred on (x, y), size R.
function monument(g, x, y, R) {
  g.beginPath();
  g.moveTo(x - R * 0.8, y + R * 0.9); g.lineTo(x - R * 0.9, y - R * 0.6);
  g.quadraticCurveTo(x, y - R * 1.15, x + R * 0.9, y - R * 0.6);
  g.lineTo(x + R * 0.8, y + R * 0.9); g.closePath();
}

// A jet seen from above, nose along +x, scaled by k (the ball's radius). Used as the rising
// shot itself, small as its tell, and huge in its cut-in.
function jet(g, x, y, ang, k, flame, t) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  if (flame) {
    // afterburner: magenta outer cone, ice-blue core, flickering length
    const L = k * (2.4 + Math.sin(t * 60) * 0.35 + Math.random() * 0.4);
    g.globalCompositeOperation = 'lighter';
    g.shadowColor = '#ff5ea8'; g.shadowBlur = 16;
    g.fillStyle = '#ff5ea8';
    g.beginPath(); g.moveTo(-k * 1.5, -k * 0.5); g.lineTo(-k * 1.5 - L, 0); g.lineTo(-k * 1.5, k * 0.5); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#7ad7ff';
    g.beginPath(); g.moveTo(-k * 1.5, -k * 0.26); g.lineTo(-k * 1.5 - L * 0.55, 0); g.lineTo(-k * 1.5, k * 0.26); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  // swept wings and tailplanes, keylined dark so the jet reads on any sky
  const kl = Math.max(2, k * 0.14);
  g.fillStyle = '#5b6675'; g.strokeStyle = '#1c2230'; g.lineWidth = kl; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(k * 0.5, 0); g.lineTo(-k * 0.8, -k * 1.9); g.lineTo(-k * 1.25, -k * 1.8); g.lineTo(-k * 0.6, -k * 0.3);
  g.lineTo(-k * 0.6, k * 0.3); g.lineTo(-k * 1.25, k * 1.8); g.lineTo(-k * 0.8, k * 1.9); g.closePath(); g.stroke(); g.fill();
  g.beginPath();
  g.moveTo(-k * 1.1, 0); g.lineTo(-k * 1.75, -k * 0.85); g.lineTo(-k * 1.6, 0); g.lineTo(-k * 1.75, k * 0.85); g.closePath(); g.stroke(); g.fill();
  // pink wingtip lights
  g.fillStyle = '#ff5ea8';
  g.fillRect(-k * 1.1, -k * 1.95, k * 0.35, k * 0.2); g.fillRect(-k * 1.1, k * 1.75, k * 0.35, k * 0.2);
  // fuselage: the bulge in the middle is the ball's own size, so the ball still reads
  g.fillStyle = '#d7dde5';
  g.beginPath(); g.ellipse(-k * 0.3, 0, k * 1.35, k * 0.5, 0, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(k * 0.8, -k * 0.42); g.lineTo(k * 2.1, 0); g.lineTo(k * 0.8, k * 0.42); g.closePath(); g.stroke(); g.fill();
  g.beginPath(); g.ellipse(-k * 0.3, 0, k * 1.35, k * 0.5, 0, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, 0, k * 0.95, 0, TAU); g.fill();
  // canopy and a pink squadron stripe
  g.fillStyle = '#2fb8ff';
  g.beginPath(); g.ellipse(k * 0.55, 0, k * 0.5, k * 0.24, 0, 0, TAU); g.fill();
  g.strokeStyle = '#ff5ea8'; g.lineWidth = Math.max(2, k * 0.12);
  g.beginPath(); g.moveTo(-k * 0.5, -k * 0.9); g.lineTo(-k * 0.5, k * 0.9); g.stroke();
  g.restore();
}

// The raygun, nose along +x, at scale z.
function raygun(g, z, pulse) {
  g.save(); g.scale(z, z);
  g.fillStyle = '#2a1642';
  g.fillRect(-4, 0, 7, 12);
  g.fillStyle = '#9d4dff';
  g.beginPath(); g.ellipse(4, -2, 12, 7, 0, 0, TAU); g.fill();
  g.fillStyle = '#f0dcff';
  g.beginPath(); g.ellipse(1, -5, 6, 2, 0, 0, TAU); g.fill();
  g.fillStyle = '#2a1642';
  g.beginPath(); g.moveTo(-6, -2); g.lineTo(-12, -11); g.lineTo(-2, -6); g.closePath(); g.fill();
  g.strokeStyle = '#f0dcff'; g.lineWidth = 2 / z * 1.4;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(17 + i * 5, -2, 2, 5 - i, 0, 0, TAU); g.stroke(); }
  g.globalAlpha *= 0.5 + pulse * 0.5; g.fillStyle = '#ff4de1';
  g.beginPath(); g.arc(31, -2, 3 + pulse * 2, 0, TAU); g.fill();
  g.restore();
}

// A cartoon lightning bolt, filled, from (x, y) down `h`, `w` wide.
function thunderbolt(g, x, y, h, w) {
  g.beginPath();
  g.moveTo(x + w * 0.2, y); g.lineTo(x - w * 0.6, y + h * 0.55); g.lineTo(x - w * 0.05, y + h * 0.5);
  g.lineTo(x - w * 0.4, y + h); g.lineTo(x + w * 0.6, y + h * 0.38); g.lineTo(x + w * 0.05, y + h * 0.43);
  g.lineTo(x + w * 0.55, y); g.closePath();
}

export default {
  // ── 10 · giant — the colossus ─────────────────────────────────────────────
  giant: {
    theme: 'Stone colossus',
    visual: 'weathered stone and cast bronze, looming titan silhouette, ground cracks, stomp shockwaves',
    palette: ['#4a453d', '#8c8475', '#b0783a', '#e0a960', '#c9bfa8', '#2b2620'],
    doc: {
      fantasy: 'A colossus of stone and bronze wakes behind the champion; on the touch, the champion becomes it — a head the size of a monument.',
      purpose: 'The first power that changes a body, not the ball: stage 10 teaches that a bigger head is a bigger goal-mouth to shoot past and a bigger forehead to attack with.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball pops straight up a header\'s height and your head grows to 1.55× for 7 seconds.',
      bot: 'Arms at any moment (arm: any) and plays the keeper style — holds its line and lets the giant head do the saving.',
      sequence: {
        anticipation: 'While armed a big stone monument head with a bronze rim towers behind and above the champion, shoulders spread wide, its eye-slits burning bronze (lit), a slow bronze sunburst and a slow bronze sunburst and a bronze glow breathing behind it and pebbles lifting off the grass.',
        activation: 'The cut-in: a colossal monument head rises out of the bottom of the screen with cracked stone and burning eyes. Then a bronze sunburst, three scale-up rings, 30 stone shards, dust rolling both ways, a boulder fountain out of the turf, bronze stars, a 320px ground shockwave, a second stone sunburst, stone confetti, a huge "ענק!" stamp and a "בום!" at the feet; a bronze screen-edge glow, shake 12 and a bronze flash.',
        main: 'For 7s: the colossus stands behind the giant head with lit eyes over it and a bronze glow around the head, a thick segmented bronze halo turns with glowing orbiting chips, a keylined bronze crown of stone spikes stands up off the halo, a slow bronze sunburst turns behind the solid, keylined, cracked colossus, pebbles hop off the turf all over the pitch as it trembles, and every landing is a stomp — a dust ring, fresh glowing cracks in the pitch and a "בום!" stamp.',
        impact: 'The growth itself: rings expand from the old head size to the new, a slow bronze sunburst, stone confetti and a big crack under the feet.',
        aftermath: 'The head shrinks back: rings collapse inward, stone crumbs rain off it, a bronze glow fades out and a last puff of dust rolls at the feet.',
        cleanup: 'Cracks fade out over 3s, crumbs and dust run out their life; nothing is left on the pitch.',
      },
      layers: 'Cut-in monument head (over the dim), colossus silhouette with lit eyes + footprint + glowing cracks (back), bronze halo and orbiting lit chips (front), rays, glows, confetti, stamps, smoke, shards, rings.',
      camera: 'Shake 12, a bronze vignette for 1.1s and a 0.25s bronze flash on firing; shake 5 and a stamp on every stomp while giant.',
      hud: 'The engine\'s 🗿 status pill with its 7s ring over the giant head; nothing else — the head is the HUD.',
      audio: 'Fire: a deep rumble swelling upward (growth). Impact: a stone slab landing. End: a falling sigh with a crumble. Each stomp adds a low thud.',
      counterplay: 'A giant head is also a slow one: shoot low along the grass under it, or lob to the far post it cannot turn to — and wait it out, 7s is not a whole attack.',
      perf: '~120 particles on firing, ≤3 pebbles and dust a frame, ~16 per stomp; ≤10 drawGlow a frame; at most 4 cracks remembered; no shadowBlur.',
      helpers: 'pop() (fx.rays + fx.glow), fx.ring, fx.burst, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(smoke/shard/sq), fx.shake, fx.flash, monument(), jag().',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 55, q: 0.6, peak: 1, decay: 0.8 }, { k: 'sweep', from: 70, to: 240, type: 'sawtooth', peak: 0.35, dur: 0.6 }],
      impact: [{ k: 'thud', freq: 80, q: 0.9, peak: 0.9, decay: 0.45 }, { k: 'thud', freq: 700, q: 2, peak: 0.25, decay: 0.2, t: 0.03 }],
      end: [{ k: 'sweep', from: 260, to: 70, type: 'triangle', peak: 0.3, dur: 0.5 }, { k: 'thud', freq: 1400, q: 1, peak: 0.12, decay: 0.3, t: 0.2 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, s.headY(p));
      const hr = s.headR(p), pulse = 0.5 + Math.sin(s.t * 4) * 0.5;
      const R = hr * 2.3, cy = d.y - hr * 1.3;
      s.fx.drawGlow(g, d.x, cy, R * 1.7, '#b0783a', 0.35 + pulse * 0.25);
      wedges(g, d.x, cy, R * 0.9, R * 2.6, 12, s.t * 0.5, '#e0a960', '#b0783a', 0.28 + pulse * 0.12);
      g.save();
      // shoulders, then the vast monument head, its eyes above the real one
      g.globalAlpha = 0.82; g.fillStyle = '#4a453d';
      g.beginPath(); g.moveTo(d.x - hr * 3.4, d.y + hr * 1.4); g.lineTo(d.x - hr * 2.4, d.y - hr * 0.1);
      g.lineTo(d.x + hr * 2.4, d.y - hr * 0.1); g.lineTo(d.x + hr * 3.4, d.y + hr * 1.4); g.closePath(); g.fill();
      monument(g, d.x, cy, R); g.fill();
      g.globalAlpha = 0.95; keyed(g, '#2b2620', '#e0a960', 3);
      g.globalAlpha = 0.8; g.strokeStyle = '#2b2620'; g.lineWidth = 2;
      jag(g, d.x - R * 0.5, cy - R * 0.8, d.x - R * 0.2, cy - R * 0.1, p.index * 7 + 3, 5, 4);
      g.globalAlpha = 0.6 + pulse * 0.4; g.fillStyle = '#e0a960';
      for (const sd of [-1, 1]) g.fillRect(d.x + sd * R * 0.42 - R * 0.2, cy - R * 0.38, R * 0.4, 6);
      g.restore();
      for (const sd of [-1, 1]) s.fx.drawGlow(g, d.x + sd * R * 0.42, cy - R * 0.35, 20 + pulse * 8, '#e0a960', 0.8);
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'sq', x: p.x + s.fx.rand(-30, 30), y: p.y - 2, vy: -s.fx.rand(30, 80), r: 3, life: 0.8, color: '#8c8475', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 200);
      const R = C.H * 0.26, cy = C.H + R * 1.3 - ease(k / 0.35) * R * 1.95;
      s.fx.drawGlow(g, x, cy, R * 1.9, '#b0783a', 0.7 * f);
      g.save();
      g.globalAlpha = 0.92 * f;
      g.fillStyle = '#4a453d';
      g.beginPath(); g.moveTo(x - R * 2, C.H + 10); g.lineTo(x - R * 1.4, cy + R * 0.8); g.lineTo(x + R * 1.4, cy + R * 0.8); g.lineTo(x + R * 2, C.H + 10); g.closePath(); g.fill();
      monument(g, x, cy, R); g.fill();
      g.fillStyle = '#8c8475';
      g.beginPath(); g.moveTo(x - R * 0.8, cy + R * 0.9); g.lineTo(x - R * 0.9, cy - R * 0.6); g.lineTo(x - R * 0.55, cy - R * 0.8); g.lineTo(x - R * 0.5, cy + R * 0.9); g.closePath(); g.fill();
      monument(g, x, cy, R);
      g.strokeStyle = '#e0a960'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#2b2620'; g.lineWidth = 3;
      jag(g, x - R * 0.3, cy - R * 0.95, x + R * 0.1, cy + R * 0.2, 11, 10, 5);
      jag(g, x + R * 0.6, cy - R * 0.5, x + R * 0.3, cy + R * 0.7, 29, 8, 4);
      // the brow ridge, a nose block, the burning eyes
      g.fillStyle = '#2b2620';
      g.fillRect(x - R * 0.7, cy - R * 0.5, R * 1.4, R * 0.12);
      g.fillRect(x - R * 0.12, cy - R * 0.35, R * 0.24, R * 0.55);
      g.fillStyle = '#e0a960';
      for (const sd of [-1, 1]) g.fillRect(x + sd * R * 0.42 - R * 0.2, cy - R * 0.33, R * 0.4, R * 0.1);
      g.restore();
      for (const sd of [-1, 1]) s.fx.drawGlow(g, x + sd * R * 0.42, cy - R * 0.28, R * 0.45, '#e0a960', f);
    },

    fire(s, at) {
      const { fx, owner } = s;
      const hy = s.headY(owner), hr = s.headR(owner);
      pop(fx, owner.x, hy, '#e0a960', '#b0783a', { g: 170, R: 380, spin: 0.6, life: 0.9 });
      for (let i = 0; i < 3; i++) fx.ring(owner.x, hy, { r: hr + i * 6, r1: hr * 3.4 + i * 34, life: 0.5 + i * 0.14, w: 8 - i * 2, color: i ? '#b0783a' : '#e0a960', layer: 'front' });
      fx.burst(owner.x, hy, 30, { shape: 'shard', speed: 380, r: 7, spin: 10, grav: 800, life: 1, color: pick(['#8c8475', '#4a453d']) });
      fx.burst(owner.x, owner.y, 12, { shape: 'smoke', speed: 190, spread: 0.6, angle: 0, r: 10, r1: 30, life: 1.1, drag: 2, color: '#c9bfa8', layer: 'back' });
      fx.burst(owner.x, owner.y, 12, { shape: 'smoke', speed: 190, spread: 0.6, angle: Math.PI, r: 10, r1: 30, life: 1.1, drag: 2, color: '#c9bfa8', layer: 'back' });
      fx.confetti(owner.x, hy, 24, ['#8c8475', '#c9bfa8', '#b0783a', '#e0a960']);
      // the ground splits: a boulder fountain out of the turf and bronze sparks off the growth
      fx.burst(owner.x, owner.y, 26, { shape: 'sq', speed: 520, spread: 1.4, angle: -Math.PI / 2, r: 7, grav: 1100, life: 1.1, color: pick(['#4a453d', '#8c8475', '#2b2620']) });
      fx.burst(owner.x, hy, 18, { shape: 'star', speed: 300, r: 7, spin: 6, life: 0.8, color: '#e0a960', blend: 'lighter' });
      fx.ring(owner.x, owner.y, { r: 10, r1: 320, life: 0.7, w: 10, color: '#c9bfa8' });
      fx.rays(owner.x, owner.y, { color: '#c9bfa8', color2: '#b0783a', n: 9, r1: 420, life: 1.1, spin: -0.3, alpha: 0.4 });
      fx.stamp(owner.x, top(hy - hr * 2 - 50), 'ענק!', { r: 78, color: '#e0a960', edge: '#2b2620', life: 1.3 });
      fx.stamp(owner.x + owner.side * 120, top(owner.y - 40), 'בום!', { r: 40, color: '#c9bfa8', edge: '#2b2620', life: 0.9, vy: -60 });
      fx.vignette('#b0783a', 0.6, 1.2);
      fx.shake(14, 0.55);
      fx.flash('#e0a960', 0.3, 0.25);
    },

    back(g, e, s) {
      const q = who(s, e);
      const k = fade(e, 0.35, 0.8), hr = s.headR(q), C = s.C;
      const d = s.depth(q.x, s.headY(q)), f = s.depth(q.x, q.y);
      const pulse = 0.5 + Math.sin(s.t * 3) * 0.5;
      const R = hr * 1.9, x = d.x - q.side * 12, cy = d.y - hr * 1.15;
      s.fx.drawGlow(g, d.x, d.y, hr * 3.4, '#b0783a', 0.7 * k);
      // a slow bronze sunburst behind the titan the whole time it stands
      wedges(g, x, cy, R * 0.8, R * 3.4, 14, s.t * 0.35, '#e0a960', '#b0783a', 0.32 * k);
      g.save();
      // the colossus standing behind the giant head, its eyes lit above it
      g.globalAlpha = 0.8 * k; g.fillStyle = '#4a453d';
      g.beginPath(); g.moveTo(x - R * 1.9, d.y + hr * 1.5); g.lineTo(x - R * 1.2, d.y); g.lineTo(x + R * 1.2, d.y); g.lineTo(x + R * 1.9, d.y + hr * 1.5); g.closePath(); g.fill();
      keyed(g, '#2b2620', '#b0783a', 3);
      monument(g, x, cy, R); g.fill();
      g.globalAlpha = 0.9 * k; keyed(g, '#2b2620', '#e0a960', 4);
      g.strokeStyle = '#2b2620'; g.lineWidth = 3;
      jag(g, x - R * 0.5, cy - R * 0.9, x - R * 0.15, cy, e.seq * 3 + 1, 7, 4);
      jag(g, x + R * 0.6, cy - R * 0.6, x + R * 0.35, cy + R * 0.3, e.seq * 3 + 2, 6, 4);
      g.globalAlpha = (0.7 + pulse * 0.3) * k; g.fillStyle = '#ffd08a';
      for (const sd of [-1, 1]) g.fillRect(x + sd * R * 0.42 - R * 0.2, cy - R * 0.4, R * 0.4, 8);
      // its footprint, and the cracks it has stamped
      g.globalAlpha = 0.4 * k; g.fillStyle = '#4a453d';
      g.beginPath(); g.ellipse(f.x, f.y + 2, hr * 1.5, 7, 0, 0, TAU); g.fill();
      const mem = memo(e, () => ({ ground: q.onGround, cracks: [] }));
      g.strokeStyle = '#2b2620'; g.lineWidth = 3; g.lineCap = 'round';
      for (const c of mem.cracks) {
        const age = s.t - c.t;
        if (age > 3 || age < 0) continue;
        g.globalAlpha = (1 - age / 3) * 0.85;
        for (let i = 0; i < 6; i++) {
          const dir = i % 2 ? 1 : -1, len = 22 + hash(c.seed + i) * 60;
          jag(g, c.x, C.GROUND_Y + 2, c.x + dir * len, C.GROUND_Y + 4 + hash(c.seed + i * 3) * 20, c.seed + i, 5, 4);
        }
        if (age < 0.8) {
          g.globalAlpha = 1 - age / 0.8; g.strokeStyle = '#e0a960';
          jag(g, c.x, C.GROUND_Y + 2, c.x + 30, C.GROUND_Y + 12, c.seed, 4, 3);
          jag(g, c.x, C.GROUND_Y + 2, c.x - 26, C.GROUND_Y + 10, c.seed + 5, 4, 3);
          g.strokeStyle = '#2b2620';
        }
      }
      g.restore();
      for (const sd of [-1, 1]) s.fx.drawGlow(g, x + sd * R * 0.42, cy - R * 0.36, 30, '#e0a960', (0.6 + pulse * 0.4) * k);
      for (const c of mem.cracks) {
        const age = s.t - c.t;
        if (age >= 0 && age < 1.2) s.fx.drawGlow(g, c.x, C.GROUND_Y + 6, 60, '#e0a960', (1 - age / 1.2) * 0.8);
      }
    },

    front(g, e, s) {
      const q = who(s, e);
      const k = fade(e, 0.35, 0.8), hr = s.headR(q);
      const d = s.depth(q.x, s.headY(q));
      // the last second: the halo flickers, a warning that the head is about to shrink
      const warn = e.life - e.t < 1.2 ? (Math.sin(s.t * 30) > 0 ? 1 : 0.35) : 1;
      g.save();
      g.lineCap = 'butt';
      for (let i = 0; i < 8; i++) {
        const a = s.t * 0.8 + (i / 8) * TAU;
        g.globalAlpha = 0.95 * k * warn;
        g.beginPath(); g.arc(d.x, d.y, hr + 10, a, a + TAU / 8 - 0.12);
        keyed(g, '#2b2620', i % 2 ? '#e0a960' : '#8c8475', 8);
      }
      // bronze spikes of a stone crown standing up off the halo
      g.fillStyle = '#b0783a'; g.strokeStyle = '#2b2620'; g.lineWidth = 3; g.lineJoin = 'round';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42, r0 = hr + 14, r1 = hr + 34 + (i === 2 ? 14 : 0);
        g.globalAlpha = k * warn;
        g.beginPath();
        g.moveTo(d.x + Math.cos(a - 0.12) * r0, d.y + Math.sin(a - 0.12) * r0);
        g.lineTo(d.x + Math.cos(a) * r1, d.y + Math.sin(a) * r1);
        g.lineTo(d.x + Math.cos(a + 0.12) * r0, d.y + Math.sin(a + 0.12) * r0);
        g.closePath(); g.fill(); g.stroke();
      }
      g.lineWidth = 2; g.strokeStyle = '#e0a960'; g.globalAlpha = 0.7 * k * warn;
      g.beginPath(); g.arc(d.x, d.y, hr + 15, 0, TAU); g.stroke();
      // stone chips orbiting the monument
      g.fillStyle = '#c9bfa8';
      const chips = [];
      for (let i = 0; i < 4; i++) {
        const a = -s.t * 1.6 + (i / 4) * TAU;
        const x = d.x + Math.cos(a) * (hr + 26), y = d.y + Math.sin(a) * (hr + 26) * 0.55;
        g.globalAlpha = k * 0.95;
        g.fillRect(x - 4, y - 4, 8, 8);
        chips.push([x, y]);
      }
      g.restore();
      for (const [x, y] of chips) s.fx.drawGlow(g, x, y, 14, '#e0a960', 0.6 * k * warn);
    },

    tick(e, s) {
      const q = who(s, e);
      const mem = memo(e, () => ({ ground: q.onGround, cracks: [] }));
      // every landing is a stomp
      if (q.onGround && !mem.ground) {
        const { fx } = s;
        fx.ring(q.x, q.y, { r: 10, r1: 160, life: 0.5, w: 6, color: '#c9bfa8' });
        fx.glow(q.x, q.y, 90, '#b0783a', { life: 0.4, alpha: 0.7 });
        fx.burst(q.x, q.y - 2, 5, { shape: 'smoke', speed: 180, spread: 0.5, angle: 0, r: 7, r1: 24, life: 0.8, drag: 2.5, color: '#c9bfa8', layer: 'back' });
        fx.burst(q.x, q.y - 2, 5, { shape: 'smoke', speed: 180, spread: 0.5, angle: Math.PI, r: 7, r1: 24, life: 0.8, drag: 2.5, color: '#c9bfa8', layer: 'back' });
        fx.burst(q.x, q.y - 4, 4, { shape: 'shard', speed: 240, spread: 1.2, angle: -Math.PI / 2, r: 5, grav: 900, spin: 12, life: 0.6, color: '#8c8475' });
        fx.stamp(q.x + fx.rand(-20, 20), q.y - 40, 'בום!', { r: 34, color: '#c9bfa8', edge: '#2b2620', life: 0.6, vy: -50 });
        fx.shake(5, 0.22);
        fx.sound([{ k: 'thud', freq: 65, q: 0.8, peak: 0.6, decay: 0.3 }]);
        mem.cracks.push({ x: q.x, t: s.t, seed: Math.random() * 999 });
        if (mem.cracks.length > 4) mem.cracks.shift();
      }
      mem.ground = q.onGround;
      if (Math.random() < 0.25) s.fx.emit({ shape: 'sq', x: q.x + s.fx.rand(-30, 30), y: q.y - 1, vy: -s.fx.rand(20, 50), r: 3, life: 0.6, color: '#8c8475', layer: 'back' });
      // the whole pitch trembles under the titan: pebbles hop off the turf everywhere
      if (Math.random() < 0.6) s.fx.emit({ shape: 'sq', x: s.fx.rand(s.C.GOAL_W, s.C.W - s.C.GOAL_W), y: s.C.GROUND_Y - 1, vx: s.fx.rand(-20, 20), vy: -s.fx.rand(90, 200), grav: 900, r: s.fx.rand(3, 6), life: 0.6, color: pick(['#8c8475', '#4a453d', '#c9bfa8']), layer: 'back' });
      if (Math.random() < 0.15) s.fx.emit({ shape: 'smoke', x: s.fx.rand(s.C.GOAL_W, s.C.W - s.C.GOAL_W), y: s.C.GROUND_Y - 3, vy: -12, r: 6, r1: 22, life: 1.1, color: '#c9bfa8', alpha: 0.6, layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      if (ev.e) {
        const q = who(s, ev.e), hr = s.headR(q);
        for (let i = 0; i < 3; i++) fx.ring(ev.x, ev.y, { r: hr / 1.55, r1: hr + 14 + i * 22, life: 0.55 + i * 0.1, w: 5, color: '#b0783a', layer: 'front' });
        fx.rays(ev.x, ev.y, { color: '#c9bfa8', color2: '#8c8475', n: 10, r1: 260, life: 1.1, spin: -0.4, alpha: 0.35 });
        fx.confetti(q.x, q.y - 10, 10, ['#4a453d', '#8c8475', '#e0a960']);
        memo(ev.e, () => ({ ground: q.onGround, cracks: [] })).cracks.push({ x: q.x, t: s.t, seed: Math.random() * 999 });
      } else {
        fx.ring(ev.x, ev.y, { color: '#b0783a', r1: 140, life: 0.5, w: 6 });
        fx.glow(ev.x, ev.y, 100, '#e0a960', { life: 0.4 });
      }
      fx.shake(6, 0.28);
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e ? who(s, info.e) : s.owner;
      const hy = s.headY(q), hr = s.headR(q) * 1.55;
      fx.ring(q.x, hy, { r: hr + 40, r1: hr * 0.4, life: 0.45, w: 5, color: '#b0783a', layer: 'front' });
      fx.glow(q.x, hy, hr * 2.4, '#b0783a', { life: 1, alpha: 0.6 });
      for (let i = 0; i < fx.n(16); i++) {
        const a = Math.random() * TAU;
        fx.emit({ shape: 'sq', x: q.x + Math.cos(a) * hr, y: hy + Math.sin(a) * hr * 0.6, vx: fx.rand(-60, 60), vy: fx.rand(-100, 0), grav: 900, r: 4, life: 1, color: pick(['#8c8475', '#4a453d', '#c9bfa8']) });
      }
      fx.emit({ shape: 'smoke', x: q.x, y: q.y - 4, vy: -20, r: 12, r1: 40, life: 1.2, color: '#c9bfa8', layer: 'back' });
    },
  },

  // ── 11 · shrink — the shrink ray ─────────────────────────────────────────
  shrink: {
    theme: 'Sci-fi shrink ray',
    visual: 'retro chrome-and-violet raygun, wobbling purple beam, collapsing target rings, orbiting sparkles',
    palette: ['#9d4dff', '#f0dcff', '#ff4de1', '#2a1642', '#5cf2e6'],
    doc: {
      fantasy: 'The champion draws a 1950s raygun, and whoever is in front of it goes pew — and comes out pocket-sized.',
      purpose: 'The mirror of the giant: the power works on the other player\'s body, and stage 11 teaches that a small head is a small wall — shoot at it and it cannot cover the goal.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is driven at the goal you attack on a lofted line and the opponent\'s head shrinks to 60% for 7 seconds.',
      bot: 'Arms at any moment (arm: any) and plays the striker style — presses forward to shoot past the shrunken keeper.',
      sequence: {
        anticipation: 'While armed a big chunky violet raygun hovers at the champion\'s hip, its muzzle glowing magenta; a keylined dashed aim line runs to a spinning, keylined magenta target reticle locked round the opponent\'s head, and teal charge motes stream into the muzzle.',
        activation: 'The cut-in: a giant raygun fires a wobbling beam across the lower screen into collapsing target rings. Then PEW: a thick violet energy beam with a white core and a magenta inner beam jumps to the opponent\'s head, a magenta sunburst at the muzzle, glows at both ends, teal stars, sparkles pulled into the target, 24 magenta motes along the beam, a second sunburst and a collapsing ring on the target, confetti and a big "פיו!" stamp; violet screen-edge glow, shake 6.',
        main: 'For 7s: a violet-and-teal sunburst turns behind the small head, a keylined magenta target is painted on the grass at his feet, violet sparkle-rain falls over the whole pitch, sparkles are sucked in toward him from far out, the small head sits in a violet glow, big target rings collapse inward on it over and over, a zoom-box of four corner brackets shrinks onto it, six lit sparkles orbit it, and inward-pointing arrows either side say "small".',
        impact: 'The shrink lands: two big rings collapse from wide onto the head, stars stream inward, a small magenta sunburst and a teal "קטן!" stamp over the head.',
        aftermath: 'The head pops back: a teal ring bursts outward, a "בוינג!" stamp, sparkles scatter and a violet glow fades.',
        cleanup: 'Sparkles, rings and stamps run out within a second; the beam is gone after 0.5s.',
      },
      layers: 'Raygun + reticle + aim line (aura), cut-in raygun and beam, beams + wobbling beam (front), glow halo, collapsing target rings, zoom brackets, lit orbiting sparkles, rays, glows, stars, confetti, stamps.',
      camera: 'A violet vignette and 0.15s violet flash on the shot, shake 6 on the shot and 3 as the ray lands; no grade.',
      hud: 'The engine\'s 🔻 status pill with its 7s ring over the shrunken head.',
      audio: 'Fire: a classic falling "pew" with a sine ping. Impact: a descending wobble. End: a rising boing.',
      counterplay: 'The shrunken player still runs and kicks at full strength: stop blocking with the head, block with the body and the boot, and go forward — 7s passes.',
      perf: '~100 particles on firing, ≤2 sparkles and a rare ring a frame; ≤8 drawGlow a frame; beam and rings are strokes, one shadowBlur on the wobbling beam only.',
      helpers: 'raygun(), pop()-style fx.rays + fx.glow, fx.beam, fx.ring (inward, r > r1), fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(star/dot), fx.burst, fx.flash, fx.shake.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 2400, to: 300, type: 'square', peak: 0.3, dur: 0.16 }, { k: 'blip', freq: 1800, type: 'sine', peak: 0.2, dur: 0.1 }],
      impact: [{ k: 'sweep', from: 900, to: 120, type: 'sine', peak: 0.35, dur: 0.35 }, { k: 'blip', freq: 1200, type: 'triangle', peak: 0.15, dur: 0.08, t: 0.3 }],
      end: [{ k: 'sweep', from: 200, to: 900, type: 'triangle', peak: 0.3, dur: 0.25 }],
    },

    aura(g, p, s) {
      const foe = s.foe;
      const x = p.x + p.side * 26, y = p.y - s.C.BODY_H * 0.7;
      const d = s.depth(x, y), fd = s.depth(foe.x, s.headY(foe)), fr = s.headR(foe);
      const ang = Math.atan2(fd.y - d.y, fd.x - d.x);
      const flip = Math.cos(ang) < 0 ? -1 : 1;
      const pulse = 0.5 + Math.sin(s.t * 10) * 0.5;
      const mx = d.x + Math.cos(ang) * 31 * 2.3, my = d.y + Math.sin(ang) * 31 * 2.3;
      g.save();
      // the aim line and the reticle locked round the opponent's head (never inside it)
      g.globalAlpha = 0.75;
      g.setLineDash([6, 8]); g.lineDashOffset = -s.t * 60;
      g.beginPath(); g.moveTo(mx, my); g.lineTo(fd.x, fd.y); keyed(g, '#2a1642', '#ff4de1', 2);
      g.setLineDash([10, 6]);
      g.globalAlpha = 0.7 + pulse * 0.3;
      g.beginPath(); g.arc(fd.x, fd.y, fr + 14 + pulse * 4, s.t * 2, s.t * 2 + TAU); keyed(g, '#2a1642', '#ff4de1', 4);
      g.setLineDash([]);
      g.strokeStyle = '#f0dcff';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + s.t * 2, r0 = fr + 20, r1 = fr + 32;
        g.beginPath(); g.moveTo(fd.x + Math.cos(a) * r0, fd.y + Math.sin(a) * r0); g.lineTo(fd.x + Math.cos(a) * r1, fd.y + Math.sin(a) * r1); g.stroke();
      }
      g.globalAlpha = 1;
      g.translate(d.x, d.y); g.rotate(ang); g.scale(1, flip);
      raygun(g, 2.3, pulse);
      g.restore();
      s.fx.drawGlow(g, mx, my, 26 + pulse * 14, '#ff4de1', 0.9);
      if (Math.random() < 0.5) {
        const a = Math.random() * TAU;
        s.fx.emit({ shape: 'dot', x: mx + Math.cos(a) * 30, y: my + Math.sin(a) * 30, vx: -Math.cos(a) * 100, vy: -Math.sin(a) * 100, r: 2.5, life: 0.3, color: '#5cf2e6', blend: 'lighter' });
      }
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 220), y = C.H * 0.7;
      const dir = s.foe.x >= s.owner.x ? 1 : -1;
      const pulse = 0.5 + Math.sin(k * 60) * 0.5;
      const slide = ease(k / 0.3);
      const gx = x - dir * (1 - slide) * 300;
      const mx = gx + dir * 31 * 6, my = y - 2 * 6, tx = gx + dir * 560;
      g.save();
      g.globalAlpha = f;
      // the beam, once the gun is in: a wobbling violet line out to a far target
      if (k > 0.22) {
        g.lineCap = 'round';
        for (const [w, col] of [[22, '#9d4dff'], [8, '#f0dcff']]) {
          g.lineWidth = w; g.strokeStyle = col;
          g.beginPath();
          for (let i = 0; i <= 18; i++) { const u = i / 18; g.lineTo(mx + (tx - mx) * u, my + Math.sin(u * 16 - k * 50) * 10); }
          g.stroke();
        }
        g.strokeStyle = '#ff4de1'; g.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          const u = (k * 2.5 + i / 3) % 1;
          g.globalAlpha = f * u; g.beginPath(); g.arc(tx, my, 20 + u * 90, 0, TAU); g.stroke();
        }
        g.globalAlpha = f;
      }
      g.translate(gx, y); g.scale(dir, 1);
      raygun(g, 6, pulse);
      g.restore();
      s.fx.drawGlow(g, mx, my, 90, '#ff4de1', f);
      if (k > 0.22) s.fx.drawGlow(g, tx, my, 110, '#9d4dff', f);
    },

    fire(s, at) {
      const { fx, owner, foe } = s;
      const x = owner.x + owner.side * 26, y = owner.y - s.C.BODY_H * 0.7;
      const tx = foe.x, ty = s.headY(foe);
      fx.beam(x, y, tx, ty, { color: '#9d4dff', color2: '#f0dcff', w: 30, life: 0.5, layer: 'front' });
      fx.beam(x, y, tx, ty, { color: '#ff4de1', color2: '#ffffff', w: 12, life: 0.35, layer: 'front' });
      fx.rays(x, y, { color: '#ff4de1', color2: '#9d4dff', n: 12, r1: 240, life: 0.55, spin: 3 });
      fx.glow(x, y, 100, '#ff4de1', { life: 0.5 });
      fx.glow(tx, ty, 130, '#9d4dff', { life: 0.7 });
      fx.emit({ shape: 'star', x, y, r: 12, r1: 40, life: 0.22, color: '#ffffff', color2: '#ff4de1', blend: 'lighter' });
      for (let i = 1; i < 6; i++) {
        const u = i / 6;
        fx.ring(x + (tx - x) * u, y + (ty - y) * u, { r: 4, r1: 26, life: 0.3 + u * 0.15, w: 4, color: '#f0dcff', layer: 'front' });
      }
      fx.burst(x, y, 20, { shape: 'star', speed: 240, r: 4, spin: 8, life: 0.5, color: '#5cf2e6', blend: 'lighter' });
      for (let i = 0, n = fx.n(18); i < n; i++) {
        const a = (i / n) * TAU, R = 110;
        fx.emit({ shape: 'dot', x: tx + Math.cos(a) * R, y: ty + Math.sin(a) * R, vx: -Math.cos(a) * R * 2.4, vy: -Math.sin(a) * R * 2.4, r: 3, life: 0.4, color: '#f0dcff', blend: 'lighter' });
      }
      fx.confetti(tx, ty, 20, ['#9d4dff', '#ff4de1', '#5cf2e6']);
      // the ray's wake: magenta motes all along the beam, and a second sunburst on the target
      for (let i = 0, n = fx.n(24); i < n; i++) {
        const u = Math.random();
        fx.emit({ shape: 'star', x: x + (tx - x) * u, y: y + (ty - y) * u, vx: fx.rand(-90, 90), vy: fx.rand(-140, 40), r: fx.rand(3, 6), spin: 8, life: fx.rand(0.5, 0.9), color: pick(['#ff4de1', '#f0dcff', '#5cf2e6']), blend: 'lighter' });
      }
      fx.rays(tx, ty, { color: '#9d4dff', color2: '#5cf2e6', n: 14, r1: 300, life: 0.8, spin: -2, alpha: 0.5 });
      fx.ring(tx, ty, { r: 220, r1: 20, life: 0.5, w: 10, color: '#ff4de1', layer: 'front' });
      fx.stamp(x, top(y - 90), 'פיו!', { r: 70, color: '#ff4de1', edge: '#2a1642' });
      fx.vignette('#9d4dff', 0.55, 1);
      fx.flash('#9d4dff', 0.2, 0.15);
      fx.shake(6, 0.25);
    },

    // Behind the shrunken player: a violet-and-teal sunburst turning on him, and a magenta target
    // painted on the grass at his feet — the whole stadium points at how small he is.
    back(g, e, s) {
      const q = who(s, e), C = s.C, k = fade(e, 0.2, 0.6), hr = s.headR(q);
      const d = s.depth(q.x, s.headY(q)), f = s.depth(q.x, q.y);
      wedges(g, d.x, d.y, hr + 10, 260, 16, -s.t * 0.9, '#9d4dff', '#5cf2e6', 0.26 * k);
      g.save();
      for (let i = 3; i >= 0; i--) {
        const rx = 30 + i * 26 + Math.sin(s.t * 4) * 3;
        g.globalAlpha = 0.85 * k;
        g.beginPath(); g.ellipse(f.x, f.y + 4, rx, rx * 0.18, 0, 0, TAU);
        keyed(g, '#2a1642', i % 2 ? '#ff4de1' : '#f0dcff', 3);
      }
      // falling violet sparkle-rain over the whole pitch
      g.fillStyle = '#f0dcff';
      for (let i = 0; i < 18; i++) {
        const x = hash(e.seq * 13 + i) * C.W, sp = 60 + hash(i * 5.1) * 80;
        const y = C.CEIL_Y + ((hash(i * 2.7) * 400 + s.t * sp) % (C.GROUND_Y - C.CEIL_Y));
        const z = 2 + (i % 3);
        g.globalAlpha = k * (0.4 + 0.5 * Math.sin(s.t * 5 + i));
        g.fillStyle = i % 3 ? '#f0dcff' : '#ff4de1';
        g.fillRect(x - z, y - 1, z * 2, 2); g.fillRect(x - 1, y - z, 2, z * 2);
      }
      g.restore();
    },

    front(g, e, s) {
      const q = who(s, e), o = s.M.players[e.owner];
      const k = fade(e, 0.2, 0.6), hr = s.headR(q);
      const d = s.depth(q.x, s.headY(q));
      s.fx.drawGlow(g, d.x, d.y, hr * 3 + 60, '#9d4dff', 0.6 * k);
      g.save();
      // the beam, for the first 0.35s: a sine-wobbling violet line with a white core
      if (e.t < 0.35) {
        const gx = o.x + o.side * 26, gy = o.y - s.C.BODY_H * 0.7;
        const gd = s.depth(gx, gy);
        const dx = d.x - gd.x, dy = d.y - gd.y, L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L, a = 1 - e.t / 0.35;
        g.globalAlpha = a; g.lineCap = 'round';
        g.shadowColor = '#ff4de1'; g.shadowBlur = 14;
        for (const [w, col] of [[10, '#9d4dff'], [4, '#f0dcff']]) {
          g.lineWidth = w; g.strokeStyle = col;
          g.beginPath();
          for (let i = 0; i <= 16; i++) {
            const f = i / 16, off = Math.sin(f * 18 - s.t * 40) * 7 * (w > 5 ? 1 : 0.5);
            g.lineTo(gd.x + dx * f + nx * off, gd.y + dy * f + ny * off);
          }
          g.stroke();
          g.shadowBlur = 0;
        }
      }
      // a violet spotlight from the sky pinning the shrunken head
      const spot = g.createLinearGradient(0, s.C.CEIL_Y, 0, d.y + hr);
      spot.addColorStop(0, 'rgba(157,77,255,0)'); spot.addColorStop(1, 'rgba(255,77,225,0.45)');
      g.globalAlpha = 0.8 * k; g.fillStyle = spot;
      g.beginPath(); g.moveTo(d.x - 18, s.C.CEIL_Y); g.lineTo(d.x + 18, s.C.CEIL_Y); g.lineTo(d.x + hr * 3, d.y + hr); g.lineTo(d.x - hr * 3, d.y + hr); g.closePath(); g.fill();
      // target rings collapsing inward, forever — dark-keyed so they read on a bright stage
      for (let i = 0; i < 4; i++) {
        const f = (s.t * 0.9 + i / 4) % 1, R = hr + 6 + f * 130;
        g.globalAlpha = k * f;
        g.strokeStyle = '#2a1642'; g.lineWidth = 9;
        g.beginPath(); g.arc(d.x, d.y, R, 0, TAU); g.stroke();
        g.strokeStyle = i % 2 ? '#ff4de1' : '#b98cff'; g.lineWidth = 5;
        g.beginPath(); g.arc(d.x, d.y, R, 0, TAU); g.stroke();
      }
      // a giant magnifying glass hovering beside him: "look how tiny"
      const side = q.x > s.C.W / 2 ? -1 : 1, mgx = d.x + side * (hr + 78), mgy = d.y - 50 + Math.sin(s.t * 2.5) * 6, MR = 38;
      g.globalAlpha = k;
      g.lineCap = 'round';
      g.strokeStyle = '#2a1642'; g.lineWidth = 16;
      g.beginPath(); g.moveTo(mgx + side * MR * 0.7, mgy + MR * 0.7); g.lineTo(mgx + side * MR * 1.6, mgy + MR * 1.6); g.stroke();
      g.strokeStyle = '#ff4de1'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(mgx + side * MR * 0.75, mgy + MR * 0.75); g.lineTo(mgx + side * MR * 1.55, mgy + MR * 1.55); g.stroke();
      g.globalAlpha = 0.35 * k; g.fillStyle = '#5cf2e6';
      g.beginPath(); g.arc(mgx, mgy, MR, 0, TAU); g.fill();
      g.globalAlpha = k; g.strokeStyle = '#2a1642'; g.lineWidth = 11;
      g.beginPath(); g.arc(mgx, mgy, MR, 0, TAU); g.stroke();
      g.strokeStyle = '#f0dcff'; g.lineWidth = 6;
      g.beginPath(); g.arc(mgx, mgy, MR, 0, TAU); g.stroke();
      g.globalAlpha = 0.8 * k; g.strokeStyle = '#ffffff'; g.lineWidth = 4;
      g.beginPath(); g.arc(mgx, mgy, MR * 0.7, -2.6, -1.8); g.stroke();
      // a zoom box: four corner brackets closing on the head
      const zb = hr + 12 + ((1 - (s.t * 0.7) % 1) * 30);
      g.globalAlpha = k * 0.9; g.strokeStyle = '#5cf2e6'; g.lineWidth = 3;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath(); g.moveTo(d.x + sx * zb, d.y + sy * (zb - 10)); g.lineTo(d.x + sx * zb, d.y + sy * zb); g.lineTo(d.x + sx * (zb - 10), d.y + sy * zb); g.stroke();
      }
      // inward arrows either side
      g.fillStyle = '#f0dcff';
      const bx = hr + 34 + Math.sin(s.t * 6) * 4;
      for (const sd of [-1, 1]) {
        g.beginPath(); g.moveTo(d.x + sd * bx, d.y - 9); g.lineTo(d.x + sd * (bx - 13), d.y); g.lineTo(d.x + sd * bx, d.y + 9); g.closePath(); g.fill();
      }
      // sparkles orbiting the small head
      g.fillStyle = '#5cf2e6';
      const sp = [];
      for (let i = 0; i < 6; i++) {
        const a = s.t * 3 + (i / 6) * TAU, rr = hr + 18;
        const x = d.x + Math.cos(a) * rr, y = d.y + Math.sin(a) * rr * 0.8, z = 3 + (i % 2) * 2;
        g.globalAlpha = k;
        g.fillRect(x - z, y - 1, z * 2, 2); g.fillRect(x - 1, y - z, 2, z * 2);
        sp.push([x, y]);
      }
      g.restore();
      for (let i = 0; i < sp.length; i += 2) s.fx.drawGlow(g, sp[i][0], sp[i][1], 12, '#5cf2e6', 0.8 * k);
    },

    tick(e, s) {
      const q = who(s, e), hr = s.headR(q), hy = s.headY(q), { fx } = s;
      // sparkles sucked in toward the small head, from far out, all the time
      for (let i = 0; i < 2; i++) {
        if (Math.random() > 0.6) continue;
        const a = Math.random() * TAU, R = fx.rand(90, 160);
        fx.emit({ shape: 'star', x: q.x + Math.cos(a) * R, y: hy + Math.sin(a) * R, vx: -Math.cos(a) * R * 2, vy: -Math.sin(a) * R * 2, r: fx.rand(3, 6), life: 0.42, spin: 6, color: pick(['#f0dcff', '#5cf2e6', '#ff4de1']), blend: 'lighter' });
      }
      if (Math.random() < 0.05) fx.ring(q.x, hy, { r: 150, r1: hr, life: 0.4, w: 5, color: '#ff4de1', layer: 'front' });
    },

    impact(s, ev) {
      const { fx } = s;
      const hr = ev.e ? s.headR(who(s, ev.e)) : 18;
      fx.ring(ev.x, ev.y, { r: 150, r1: hr, life: 0.45, w: 7, color: '#9d4dff', layer: 'front' });
      fx.ring(ev.x, ev.y, { r: 90, r1: hr, life: 0.32, w: 5, color: '#ff4de1', layer: 'front' });
      fx.rays(ev.x, ev.y, { color: '#ff4de1', color2: '#5cf2e6', n: 10, r1: 160, life: 0.5, spin: -3, alpha: 0.4 });
      for (let i = 0, n = fx.n(16); i < n; i++) {
        const a = (i / n) * TAU, R = 90;
        fx.emit({ shape: 'star', x: ev.x + Math.cos(a) * R, y: ev.y + Math.sin(a) * R, vx: -Math.cos(a) * R * 2.6, vy: -Math.sin(a) * R * 2.6, r: 5, life: 0.35, color: '#5cf2e6', blend: 'lighter' });
      }
      if (ev.e) fx.stamp(ev.x, top(ev.y - hr - 70), 'קטן!', { r: 40, color: '#5cf2e6', edge: '#2a1642', life: 1.1 });
      fx.shake(3, 0.2);
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e ? who(s, info.e) : s.foe;
      const hy = s.headY(q), hr = s.headR(q);
      fx.ring(q.x, hy, { r: hr, r1: hr * 3, life: 0.4, w: 6, color: '#5cf2e6', layer: 'front' });
      fx.glow(q.x, hy, hr * 3, '#9d4dff', { life: 0.8, alpha: 0.6 });
      fx.burst(q.x, hy, 24, { shape: 'star', speed: 280, r: 5, spin: 8, life: 0.7, color: '#5cf2e6' });
      fx.ring(q.x, hy, { r: hr, r1: hr * 5, life: 0.6, w: 8, color: '#ff4de1', layer: 'front' });
      fx.confetti(q.x, hy, 16, ['#9d4dff', '#ff4de1', '#5cf2e6', '#f0dcff']);
      fx.stamp(q.x, top(hy - hr - 50), 'בוינג!', { r: 46, color: '#f0dcff', edge: '#2a1642', life: 1 });
    },
  },

  // ── 12 · lowgrav — the moon ──────────────────────────────────────────────
  lowgrav: {
    theme: 'Lunar surface',
    visual: 'pale regolith grey, deep space wash, craters on the grass, earth-rise in the sky, slow drifting moondust',
    palette: ['#b8bcc6', '#6e7380', '#1b2340', '#3d7bd9', '#5fbf6a', '#e9ecf2'],
    doc: {
      fantasy: 'The pitch is lifted to the moon: the sky turns to space, the earth rises over the stands, and the ball floats like an astronaut.',
      purpose: 'The first power that changes the ball\'s physics for everyone: stage 12 teaches reading a slow, high ball — whoever gets under it first wins it.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball pops straight up (1.5× a header\'s lift) and ball gravity drops to 0.35× for 6 seconds.',
      bot: 'Arms at any moment (arm: any) and plays the striker style — goes up for the floating ball with headers.',
      sequence: {
        anticipation: 'While armed a big keylined cratered moon orbits over the champion inside a dashed silver halo ring, three stars twinkle round it and grey moondust rises lazily off the grass at its feet.',
        activation: 'The cut-in: a huge full moon rises out of the bottom of the screen, craters and a dark terminator, the blue-and-green earth beside it and stars around. Then a slow silver-and-blue sunburst, a big moonlight glow, 30 slow-drifting stars, moondust, confetti that FLOATS (low gravity, heavy drag), 26 moon rocks torn off the pitch floating up, a 300px blue ring, 26 moon rocks torn off the pitch floating up, a 300px blue ring and a "ירח!" stamp that drifts up; a navy screen-edge glow for 1.4s and a silver flash.',
        main: 'For 6s the stadium is on the moon: a navy space wash (0.28 for its first 0.6s, then 0.16), 26 twinkling stars with the brightest lit, a shooting star now and then, a big keylined earth (clouds, night side, sunlit rim) rising in the sky, keylined moon rocks floating slowly up past the stands, a flag planted at the centre spot waving in no air, the grass washed regolith grey with craters, dust motes floating up, and the ball in a soft moonlight glow with two keylined dashed orbit rings and a moonlet circling it.',
        impact: 'Moonfall: a white ring, a slow small sunburst and a crescent glyph at the ball as gravity lets go, with a faint silver flash.',
        aftermath: 'Gravity comes back: the floating dust drops to the grass, a moonlight glow fades from the ball and a falling tone plays.',
        cleanup: 'The wash, earth and craters fade over 0.8s; dust motes run out their life.',
      },
      layers: 'Cut-in moon and earth, space wash + stars + shooting star + lit earth + regolith grass + craters (back), ball glow + orbit ring + moonlet (front), rays, glows, confetti, stamp, stars, dust.',
      camera: 'No shake — the moon is quiet. A navy vignette and a 0.2s silver flash on firing; the wash is the grade (0.28 briefly, then ≤ 0.16).',
      hud: 'No status pill (it is a field effect, on no one); the space wash and the earth in the sky are the timer — they fade out as it ends.',
      audio: 'Fire: a slow rising sine with a glassy ping. Impact: two soft bell notes. End: a long falling sine.',
      counterplay: 'Everyone gets the same moon: a slow ball is easy to reach, so run under it and head it back — do not jump early, it falls much later than you think.',
      perf: '~90 particles on firing, ≤2 a frame from motes and ball dust; ≤9 drawGlow a frame; stars and craters are seeded, not stored; no shadowBlur.',
      helpers: 'pop() (fx.rays + fx.glow), fx.ring, fx.burst, fx.confetti (low gravity), fx.stamp, fx.vignette, fx.drawGlow, fx.emit(smoke/sq/star), fx.glyph, fx.flash, hash().',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 400, to: 1200, type: 'sine', peak: 0.25, dur: 0.6 }, { k: 'blip', freq: 1568, type: 'sine', peak: 0.2, dur: 0.4, t: 0.2 }],
      impact: [{ k: 'blip', freq: 784, type: 'triangle', peak: 0.25, dur: 0.5 }, { k: 'blip', freq: 1175, type: 'triangle', peak: 0.2, dur: 0.5, t: 0.12 }],
      end: [{ k: 'sweep', from: 900, to: 200, type: 'sine', peak: 0.2, dur: 0.7 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), hr = s.headR(p);
      const a = s.t * 1.8;
      const d = s.depth(p.x + Math.cos(a) * (hr + 34), hy - hr * 0.5 + Math.sin(a) * 22);
      s.fx.drawGlow(g, d.x, d.y, 46, '#e9ecf2', 0.7);
      g.save();
      // a silver halo ring round the champion, then the moon itself, big and keylined
      g.globalAlpha = 0.8; g.setLineDash([8, 6]); g.lineDashOffset = -s.t * 20;
      g.beginPath(); g.ellipse(s.depth(p.x, hy).x, s.depth(p.x, hy).y - hr * 0.5, hr + 34, 22, 0, 0, TAU);
      keyed(g, '#1b2340', '#e9ecf2', 2);
      g.setLineDash([]);
      g.globalAlpha = 1; g.fillStyle = '#b8bcc6';
      g.beginPath(); g.arc(d.x, d.y, 22, 0, TAU); g.fill();
      g.strokeStyle = '#1b2340'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#6e7380';
      g.beginPath(); g.arc(d.x - 6, d.y - 5, 5.5, 0, TAU); g.fill();
      g.beginPath(); g.arc(d.x + 8, d.y + 6, 4.5, 0, TAU); g.fill();
      g.beginPath(); g.arc(d.x + 5, d.y - 11, 3, 0, TAU); g.fill();
      g.strokeStyle = '#e9ecf2'; g.lineWidth = 3;
      g.beginPath(); g.arc(d.x, d.y, 19, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      // three stars twinkling round the champion
      g.fillStyle = '#e9ecf2';
      for (let i = 0; i < 3; i++) {
        const b = -s.t * 0.9 + (i / 3) * TAU, z = 3 + 2 * (0.5 + 0.5 * Math.sin(s.t * 6 + i * 2));
        const sd = s.depth(p.x + Math.cos(b) * (hr + 50), hy + Math.sin(b) * 30);
        g.globalAlpha = 0.9;
        g.fillRect(sd.x - z, sd.y - 1, z * 2, 2); g.fillRect(sd.x - 1, sd.y - z, 2, z * 2);
      }
      g.restore();
      if (Math.random() < 0.3) {
        s.fx.emit({ shape: 'sq', x: p.x + s.fx.rand(-30, 30), y: p.y - 2, vy: -s.fx.rand(12, 28), vx: s.fx.rand(-6, 6), r: 3, life: 1.4, color: '#b8bcc6', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 220);
      const R = C.H * 0.24, y = C.H + R * 1.1 - ease(k / 0.4) * R * 2.2;
      s.fx.drawGlow(g, x, y, R * 2.2, '#e9ecf2', 0.55 * f);
      g.save();
      g.globalAlpha = f;
      // stars round it
      g.fillStyle = '#e9ecf2';
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 3.1) * TAU, rr = R * (1.3 + hash(i * 7.7) * 1.2), z = 2 + hash(i) * 3;
        g.fillRect(x + Math.cos(a) * rr - z, y + Math.sin(a) * rr * 0.7 - 1, z * 2, 2);
        g.fillRect(x + Math.cos(a) * rr - 1, y + Math.sin(a) * rr * 0.7 - z, 2, z * 2);
      }
      g.fillStyle = '#b8bcc6';
      g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      g.fillStyle = '#6e7380';
      for (let i = 0; i < 6; i++) {
        const a = hash(i * 5.3 + 1) * TAU, rr = R * 0.65 * hash(i * 2.9 + 2), cr = R * (0.08 + hash(i * 1.7) * 0.12);
        g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, cr, 0, TAU); g.fill();
      }
      // the terminator: night creeping over one edge
      g.globalAlpha = 0.45 * f; g.fillStyle = '#1b2340';
      g.beginPath(); g.arc(x, y, R, -Math.PI / 2, Math.PI / 2); g.ellipse(x, y, R * 0.45, R, 0, Math.PI / 2, -Math.PI / 2, true); g.fill();
      g.globalAlpha = f; g.strokeStyle = '#e9ecf2'; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, R, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
      // the earth, hanging beside it
      const ex = x + (s.owner.side > 0 ? 1 : -1) * R * 1.6, ey = y - R * 0.7;
      g.fillStyle = '#3d7bd9';
      g.beginPath(); g.arc(ex, ey, R * 0.28, 0, TAU); g.fill();
      g.fillStyle = '#5fbf6a';
      g.beginPath(); g.ellipse(ex - R * 0.08, ey - R * 0.05, R * 0.12, R * 0.08, 0.4, 0, TAU); g.fill();
      g.restore();
      s.fx.drawGlow(g, ex, ey, R * 0.7, '#3d7bd9', 0.7 * f);
    },

    fire(s, at) {
      const { fx, C } = s;
      pop(fx, at.x, at.y, '#e9ecf2', '#3d7bd9', { g: 180, R: 400, spin: 0.35, life: 1.2, alpha: 0.4 });
      fx.ring(at.x, at.y, { color: '#e9ecf2', r1: 180, life: 1.1, w: 5 });
      fx.burst(at.x, at.y, 30, { shape: 'star', speed: 110, r: 5, spin: 2, drag: 0.6, life: 1.8, color: '#e9ecf2', blend: 'lighter' });
      fx.burst(at.x, at.y + 20, 14, { shape: 'smoke', speed: 70, r: 6, r1: 20, life: 1.8, drag: 1, vy: -15, color: '#b8bcc6', layer: 'back' });
      fx.confetti(at.x, at.y, 20, ['#b8bcc6', '#e9ecf2', '#3d7bd9', '#5fbf6a'], { grav: 90, drag: 1.8, life: 2.2 });
      // moon rocks torn off the pitch, floating up slowly all over it
      for (let i = 0, n = fx.n(26); i < n; i++) {
        fx.emit({ shape: 'shard', x: fx.rand(C.GOAL_W, C.W - C.GOAL_W), y: C.GROUND_Y - 2, vx: fx.rand(-20, 20), vy: -fx.rand(60, 150), grav: 40, drag: 0.4, r: fx.rand(5, 10), spin: fx.rand(-2, 2), life: fx.rand(1.8, 2.6), color: pick(['#b8bcc6', '#6e7380']) });
      }
      fx.ring(at.x, at.y, { color: '#3d7bd9', r1: 300, life: 1.4, w: 8 });
      fx.stamp(at.x, top(at.y - 80), 'ירח!', { r: 74, color: '#e9ecf2', edge: '#1b2340', vy: -14, life: 1.5 });
      fx.vignette('#1b2340', 0.6, 1.4);
      fx.flash('#e9ecf2', 0.2, 0.25);
    },

    back(g, e, s) {
      const k = fade(e, 0.5, 0.8), C = s.C;
      g.save();
      // the space wash — a grade, so under the readability cap (a stronger beat at first)
      g.globalAlpha = (e.t < 0.6 ? 0.28 : 0.16) * k; g.fillStyle = '#1b2340';
      g.fillRect(0, 0, C.W, C.GROUND_Y);
      // the grass turned to grey regolith
      g.globalAlpha = 0.18 * k; g.fillStyle = '#b8bcc6';
      g.fillRect(0, C.GROUND_Y, C.W, C.H - C.GROUND_Y);
      // stars, seeded by the effect so they do not jump around
      g.fillStyle = '#e9ecf2';
      const bright = [];
      for (let i = 0; i < 26; i++) {
        const x = hash(e.seq * 31 + i) * C.W, y = C.CEIL_Y + hash(e.seq * 17 + i * 3) * (C.GROUND_Y - C.GOAL_H - 60);
        const tw = 0.5 + 0.5 * Math.sin(s.t * 3 + i);
        g.globalAlpha = k * (0.35 + 0.55 * tw);
        const z = i % 5 === 0 ? 3 : 1;
        g.fillRect(x - z, y - 1, z * 2 + 1, 2); if (z > 1) g.fillRect(x - 1, y - z, 2, z * 2 + 1);
        if (i % 5 === 0) bright.push([x, y, tw]);
      }
      // a shooting star now and then
      const ph = (s.t * 0.6 + e.seq * 0.37) % 1;
      let shoot = null;
      if (ph < 0.22) {
        const u = ph / 0.22, sx = C.W * (0.15 + hash(Math.floor(s.t * 0.6) + e.seq) * 0.7), sy = C.CEIL_Y + 30;
        const x = sx + u * 220, y = sy + u * 90;
        g.globalAlpha = k * Math.sin(u * Math.PI); g.strokeStyle = '#e9ecf2'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 60, y - 25); g.stroke();
        shoot = [x, y, Math.sin(u * Math.PI)];
      }
      // the earth, rising slowly over the stand opposite the ball's half
      const ex = s.M.ball.x < C.W / 2 ? C.W * 0.72 : C.W * 0.28;
      const ey = 130 - Math.min(1, e.t / e.life) * 40, ER = 56;
      g.globalAlpha = 0.95 * k; g.fillStyle = '#3d7bd9';
      g.beginPath(); g.arc(ex, ey, ER, 0, TAU); g.fill();
      g.strokeStyle = '#1b2340'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#5fbf6a';
      g.beginPath(); g.ellipse(ex - 15, ey - 12, 20, 13, 0.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ex + 20, ey + 16, 13, 8, -0.3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ex - 6, ey + 30, 9, 5, 0.2, 0, TAU); g.fill();
      g.fillStyle = '#e9ecf2'; g.globalAlpha = 0.7 * k;
      g.beginPath(); g.ellipse(ex + 10, ey - 26, 22, 5, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ex - 20, ey + 8, 16, 4, -0.2, 0, TAU); g.fill();
      // the night side, and a silver rim of sunlight
      g.globalAlpha = 0.4 * k; g.fillStyle = '#1b2340';
      g.beginPath(); g.arc(ex, ey, ER, -Math.PI / 2, Math.PI / 2); g.ellipse(ex, ey, ER * 0.4, ER, 0, Math.PI / 2, -Math.PI / 2, true); g.fill();
      g.strokeStyle = '#e9ecf2'; g.lineWidth = 3; g.globalAlpha = 0.8 * k;
      g.beginPath(); g.arc(ex, ey, ER - 2, Math.PI * 0.9, Math.PI * 1.6); g.stroke();
      // moon rocks floating up past the stands, slow as balloons
      for (let i = 0; i < 9; i++) {
        const x = C.GOAL_W + hash(e.seq * 5 + i * 1.3) * (C.W - C.GOAL_W * 2);
        const span = C.GROUND_Y - C.CEIL_Y;
        const y = C.GROUND_Y - ((hash(i * 3.3) * span + s.t * (18 + hash(i) * 20)) % span);
        const r = 7 + hash(i * 7.1) * 9, rot = s.t * (hash(i * 2) - 0.5) * 2;
        g.save(); g.translate(x, y); g.rotate(rot);
        g.globalAlpha = 0.9 * k; g.fillStyle = '#b8bcc6';
        g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * 0.4, -r * 0.8); g.lineTo(r * 0.6, -r * 0.7); g.lineTo(r, r * 0.1); g.lineTo(r * 0.2, r * 0.8); g.lineTo(-r * 0.7, r * 0.6); g.closePath();
        g.fill(); g.strokeStyle = '#1b2340'; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = '#6e7380'; g.beginPath(); g.arc(r * 0.1, -r * 0.1, r * 0.28, 0, TAU); g.fill();
        g.restore();
      }
      // a flag planted in the regolith at the centre spot, waving slowly as if in no air
      const fx0 = C.W / 2, fy0 = C.GROUND_Y + 6;
      g.globalAlpha = k; g.strokeStyle = '#1b2340'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(fx0, fy0); g.lineTo(fx0, fy0 - 92); g.stroke();
      g.strokeStyle = '#e9ecf2'; g.lineWidth = 2.5; g.stroke();
      for (let j = 0; j < 3; j++) {
        g.fillStyle = j % 2 ? '#e9ecf2' : '#3d7bd9';
        g.beginPath();
        for (let n = 0; n <= 6; n++) g.lineTo(fx0 + n * 8, fy0 - 90 + j * 10 + Math.sin(n * 0.8 - s.t * 2) * 3);
        for (let n = 6; n >= 0; n--) g.lineTo(fx0 + n * 8, fy0 - 80 + j * 10 + Math.sin(n * 0.8 - s.t * 2) * 3);
        g.closePath(); g.fill();
      }
      // craters pressed into the grass
      for (let i = 0; i < 5; i++) {
        const x = C.GOAL_W + 60 + hash(e.seq * 7 + i) * (C.W - C.GOAL_W * 2 - 120);
        const r = 18 + hash(e.seq + i * 11) * 22;
        g.globalAlpha = 0.4 * k; g.fillStyle = '#6e7380';
        g.beginPath(); g.ellipse(x, C.GROUND_Y + 14, r, r * 0.25, 0, 0, TAU); g.fill();
        g.fillStyle = '#b8bcc6';
        g.beginPath(); g.ellipse(x, C.GROUND_Y + 14 - r * 0.2, r, r * 0.08, 0, 0, Math.PI, true); g.fill();
      }
      g.restore();
      s.fx.drawGlow(g, ex, ey, 150, '#3d7bd9', 0.7 * k);
      for (const [x, y, tw] of bright) s.fx.drawGlow(g, x, y, 12, '#e9ecf2', k * tw * 0.8);
      if (shoot) s.fx.drawGlow(g, shoot[0], shoot[1], 20, '#e9ecf2', k * shoot[2]);
    },

    front(g, e, s) {
      const b = s.M.ball, k = fade(e, 0.4, 0.8);
      const d = s.depth(b.x, b.y);
      s.fx.drawGlow(g, d.x, d.y, b.r + 34, '#e9ecf2', 0.4 * k);
      g.save();
      // a slow orbit ring round the ball — the ball itself stays clear
      g.globalAlpha = 0.9 * k;
      g.setLineDash([8, 6]); g.lineDashOffset = -s.t * 12;
      for (const [R, tilt] of [[b.r + 20, -0.3], [b.r + 32, 0.5]]) {
        g.beginPath(); g.ellipse(d.x, d.y, R, R * 0.4, tilt, 0, TAU); keyed(g, '#1b2340', '#e9ecf2', 2);
      }
      g.setLineDash([]);
      const a = s.t * 2;
      g.fillStyle = '#b8bcc6'; g.strokeStyle = '#1b2340'; g.lineWidth = 2;
      g.beginPath(); g.arc(d.x + Math.cos(a) * (b.r + 20), d.y + Math.sin(a) * (b.r + 20) * 0.4, 5, 0, TAU); g.fill(); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      const b = s.M.ball;
      if (Math.random() < 0.4) fx.emit({ shape: 'sq', x: fx.rand(C.GOAL_W, C.W - C.GOAL_W), y: C.GROUND_Y - 2, vy: -fx.rand(10, 26), vx: fx.rand(-5, 5), r: 3, life: 2.4, color: pick(['#b8bcc6', '#6e7380']), layer: 'back' });
      if (Math.hypot(b.vx, b.vy) > 80 && Math.random() < 0.5) {
        fx.emit({ shape: 'smoke', x: b.x - Math.sign(b.vx) * 10, y: b.y, vx: -b.vx * 0.05, vy: -8, r: 4, r1: 16, life: 1.5, drag: 0.8, color: '#b8bcc6', layer: 'back' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      fx.ring(ev.x, ev.y, { color: '#e9ecf2', r1: 110, life: 0.7, w: 4 });
      fx.rays(ev.x, ev.y, { color: '#b8bcc6', color2: '#1b2340', n: 10, r1: 200, life: 1, spin: -0.3, alpha: 0.3 });
      fx.glyph(ev.x, ev.y - 50, '🌙', { r: 34, vy: -20, life: 1.3 });
      fx.flash('#e9ecf2', 0.14, 0.2);
    },

    end(s) {
      const { fx, C } = s;
      const b = s.M.ball;
      fx.glow(b.x, b.y, 80, '#e9ecf2', { life: 0.9, alpha: 0.6 });
      for (let i = 0; i < fx.n(18); i++) {
        fx.emit({ shape: 'sq', x: fx.rand(C.GOAL_W, C.W - C.GOAL_W), y: fx.rand(C.GROUND_Y - 200, C.GROUND_Y - 40), vy: 40, grav: 600, r: 3, life: 0.8, color: '#b8bcc6', layer: 'back' });
      }
    },
  },

  // ── 13 · rising — the jet ────────────────────────────────────────────────
  rising: {
    theme: 'Jet fighter',
    visual: 'silver swept-wing jet, magenta afterburner, white wingtip contrails, heat haze, sonic-boom vapour cone',
    palette: ['#d7dde5', '#5b6675', '#ff5ea8', '#7ad7ff', '#2fb8ff', '#f4f7fb'],
    doc: {
      fantasy: 'The ball becomes a fighter jet: it drops to the runway, lights the afterburner and climbs out under the crossbar.',
      purpose: 'The first shot whose line bends against you: stage 13 teaches that a shot that starts on the grass and ends at the bar cannot be met at one height — you have to read where it will be.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is set on the grass and flies at 1.0× power-shot speed on a straight climbing line that reaches just under the bar at the goal you attack.',
      bot: 'Arms on attack (arm: attack — ball ahead of it, in the opponent half) and plays the striker style.',
      sequence: {
        anticipation: 'While armed lit runway lights chase along the grass toward the goal you attack and a jet with its afterburner lit banks in circles above the champion\'s head in a pink glow.',
        activation: 'The cut-in: a huge fighter jet screams diagonally up across the lower screen, afterburner blazing, two white contrails drawn behind it. Then ignition: a pink-and-ice sunburst, a magenta afterburner beam blasted back along the runway, a glow, 30 sparks thrown backward, white smoke rolling off the runway, pink sparks, ice stars, a 300px ring, confetti and a big "ווש!" stamp; a pink screen-edge glow, shake 7 and a white flash.',
        main: 'A keylined silver jet 2× the ball\'s scale (over 7× its radius wingtip to wingtip) with pink wingtip lights, a long pink afterburner plume full of white shock diamonds, sonic rings peeling off behind it, swept wings, canopy and a flickering magenta-and-ice afterburner lit by two glows, nose along its real velocity; heat haze behind, contrails off both wingtips, a white vapour cone while it climbs, and a keylined white ring exactly on the ball drawn last so it is always findable. The sonic boom fires once: a white sunburst, a ring, a "בום!" stamp and a crack.',
        impact: 'On a block or a goal: a jet explosion — a magenta sunburst, a big pink glow, silver airframe shards, ice streaks, pink-and-silver confetti, a rolling pink-and-white smoke cloud, a 340px shock ring, a big "קבום!" stamp, a pink vignette, shake 12 and a white flash on a goal.',
        aftermath: 'A white vapour ring, a fading pink glow and contrail puffs hang where the jet ended.',
        cleanup: 'Contrails, sparks and confetti run out in under two seconds; nothing is left.',
      },
      layers: 'Cut-in jet with contrails, runway lights + banking jet (aura), afterburner glows + heat haze + vapour cone (behind), afterburner, airframe, canopy, ball ring, contrail smoke (back), rays, beam, glows, confetti, stamps, sparks, shards, rings.',
      camera: 'Shake 7, a pink vignette and a white flash on ignition, 4 on the sonic boom, 12 on the blast; a 0.25s white flash on a goal.',
      hud: 'The ordinary gold meter and armed glow; no lingering status — the power is the shot.',
      audio: 'Fire: a rising detuned jet roar with an ignition thump. The boom: a sharp crack. Impact: a low blast with a screaming fall. End: jet noise fading out.',
      counterplay: 'It is low when it leaves and high when it arrives: meet it early near the grass with the body, or stand at the goal and jump for the bar — never in between.',
      perf: '~110 particles on firing, ≤4 contrail/spark/ring particles a frame, ~95 on the blast; ≤5 drawGlow a frame; one shadowBlur on the afterburner.',
      helpers: 'jet(), pop() (fx.rays + fx.glow), fx.beam, fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(smoke/streak/shard/star/sq), fx.shake, fx.flash, fx.sound, memo() for the one-shot boom.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 200, to: 1600, type: 'sawtooth', peak: 0.3, dur: 0.5, detune: 12 }, { k: 'thud', freq: 180, q: 1, peak: 0.6, decay: 0.2 }],
      impact: [{ k: 'thud', freq: 110, q: 0.7, peak: 1, decay: 0.5 }, { k: 'sweep', from: 2400, to: 200, type: 'sawtooth', peak: 0.3, dur: 0.4 }],
      end: [{ k: 'crowd', dur: 0.8, peak: 0.12 }],
    },

    aura(g, p, s) {
      const C = s.C, hy = s.headY(p), hr = s.headR(p);
      const lit = Math.floor(s.t * 12) % 8;
      let lx = 0, ly = 0;
      g.save();
      // runway lights chasing toward the goal it will fly at
      for (let i = 0; i < 8; i++) {
        const on = lit === i;
        const d = s.depth(p.x + p.side * (20 + i * 24), C.GROUND_Y + 6);
        g.globalAlpha = on ? 1 : 0.5; g.fillStyle = on ? '#f4f7fb' : '#ff5ea8';
        g.fillRect(d.x - 4, d.y - 2, 8, 4);
        if (on) { lx = d.x; ly = d.y; }
      }
      // a jet banking in circles over the head, afterburner lit
      const a = s.t * 2.4;
      const x = p.x + Math.cos(a) * (hr + 30), y = hy - hr - 26 + Math.sin(a) * 10;
      const d = s.depth(x, y);
      g.globalAlpha = 1;
      jet(g, d.x, d.y, a + Math.PI / 2, 10, true, s.t);
      g.restore();
      s.fx.drawGlow(g, lx, ly, 22, '#ff5ea8', 0.9);
      s.fx.drawGlow(g, d.x, d.y, 40, '#ff5ea8', 0.5);
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C;
      const dir = s.owner.side > 0 ? 1 : -1;
      const u = ease(k / 0.7);
      const x0 = dir > 0 ? -120 : C.W + 120;
      const x = x0 + dir * u * (C.W + 240) * 0.8, y = C.H * 0.95 - u * C.H * 0.38;
      const ang = Math.atan2(-C.H * 0.38, dir * (C.W + 240) * 0.8);
      const K = 30;
      g.save();
      g.globalAlpha = 0.8 * f; g.strokeStyle = '#f4f7fb'; g.lineCap = 'round';
      const c = Math.cos(ang), sn = Math.sin(ang);
      for (const sd of [-1, 1]) {
        const wx = -K * 1.1 * c - sd * K * 1.8 * sn, wy = -K * 1.1 * sn + sd * K * 1.8 * c;
        g.lineWidth = 6;
        g.beginPath(); g.moveTo(x0 + wx, C.H * 0.95 + wy); g.lineTo(x + wx, y + wy); g.stroke();
      }
      g.globalAlpha = f;
      g.restore();
      s.fx.drawGlow(g, x - c * K * 3, y - sn * K * 3, K * 3.5, '#ff5ea8', f);
      g.save(); g.globalAlpha = f;
      jet(g, x, y, ang, K, true, s.t);
      g.restore();
      s.fx.drawGlow(g, x + c * K * 0.5, y + sn * K * 0.5, K * 1.6, '#7ad7ff', 0.4 * f);
    },

    fire(s, at) {
      const { fx, side, C } = s;
      const y = C.GROUND_Y - 13;
      pop(fx, at.x, y, '#ff5ea8', '#7ad7ff', { g: 150, R: 340, spin: 1.8 });
      fx.beam(at.x, y, at.x - side * 280, y + 4, { color: '#ff5ea8', color2: '#7ad7ff', w: 28, life: 0.45 });
      fx.emit({ shape: 'star', x: at.x, y, r: 18, r1: 50, life: 0.22, color: '#ffffff', color2: '#ff5ea8', blend: 'lighter' });
      fx.ring(at.x, y, { color: '#ff5ea8', r1: 150, life: 0.4, w: 6 });
      fx.burst(at.x, y, 30, { shape: 'streak', speed: 500, spread: 0.7, angle: side > 0 ? Math.PI : 0, color: '#7ad7ff', life: 0.3, w: 3 });
      fx.burst(at.x - side * 16, C.GROUND_Y - 4, 22, { shape: 'smoke', speed: 150, spread: 1, angle: side > 0 ? Math.PI : 0, r: 8, r1: 28, life: 1.1, drag: 2, vy: -20, color: '#f4f7fb', layer: 'back' });
      fx.burst(at.x, y, 12, { shape: 'sq', speed: 300, spread: 1.2, angle: side > 0 ? Math.PI : 0, r: 4, grav: 400, life: 0.5, color: '#ff5ea8' });
      fx.burst(at.x, y, 20, { shape: 'star', speed: 260, spread: 2, angle: -Math.PI / 2, r: 6, spin: 8, life: 0.7, color: pick(['#f4f7fb', '#7ad7ff']), blend: 'lighter' });
      fx.ring(at.x, y, { color: '#7ad7ff', r1: 300, life: 0.7, w: 8 });
      fx.confetti(at.x, y - 20, 16, ['#ff5ea8', '#d7dde5', '#7ad7ff', '#2fb8ff']);
      fx.stamp(at.x, top(y - 110), 'ווש!', { r: 74, color: '#ff5ea8', edge: '#1c2230' });
      fx.vignette('#ff5ea8', 0.5, 0.9);
      fx.flash('#f4f7fb', 0.2, 0.15);
      fx.shake(7, 0.3);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y);
      const ang = Math.atan2(b.vy, b.vx), k = b.r * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      s.fx.drawGlow(g, d.x - c * k * 3.4, d.y - sn * k * 3.4, k * 3.2, '#ff5ea8', 0.9);
      s.fx.drawGlow(g, d.x - c * k * 2, d.y - sn * k * 2, k * 1.6, '#7ad7ff', 0.7);
      g.save();
      g.translate(d.x, d.y); g.rotate(ang);
      // a long afterburner plume with shock diamonds in it — the jet's signature
      const PL = k * (7 + Math.sin(s.t * 40) * 0.5), x0 = -k * 1.6;
      g.globalCompositeOperation = 'lighter';
      const pg = g.createLinearGradient(x0, 0, x0 - PL, 0);
      pg.addColorStop(0, 'rgba(255,94,168,0.95)'); pg.addColorStop(0.5, 'rgba(255,94,168,0.45)'); pg.addColorStop(1, 'rgba(122,215,255,0)');
      g.fillStyle = pg;
      g.beginPath(); g.moveTo(x0, -k * 0.6); g.quadraticCurveTo(x0 - PL * 0.5, -k * 0.9, x0 - PL, 0); g.quadraticCurveTo(x0 - PL * 0.5, k * 0.9, x0, k * 0.6); g.closePath(); g.fill();
      g.fillStyle = '#f4f7fb';
      for (let i = 0; i < 4; i++) {
        const dx = x0 - k * (0.9 + i * 1.3), w = k * (0.34 - i * 0.06), l = k * 0.55;
        g.globalAlpha = 0.9 - i * 0.18;
        g.beginPath(); g.moveTo(dx + l, 0); g.lineTo(dx, -w); g.lineTo(dx - l, 0); g.lineTo(dx, w); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // heat haze behind the nozzle: two wavering translucent strokes
      g.strokeStyle = '#ffc4e1'; g.lineWidth = 2; g.globalAlpha = 0.35;
      for (let j = 0; j < 2; j++) {
        g.beginPath();
        for (let i = 0; i <= 8; i++) g.lineTo(-k * 3 - i * 9, (j ? 1 : -1) * (k * 0.4 + Math.sin(s.t * 30 + i + j * 2) * 4));
        g.stroke();
      }
      // the sonic-boom vapour cone, while it climbs
      if (b.vy < -30) {
        g.globalAlpha = 0.5 + Math.sin(s.t * 20) * 0.15;
        g.strokeStyle = '#f4f7fb'; g.lineWidth = 3;
        g.beginPath(); g.arc(k * 1.2, 0, k * 2.8, Math.PI * 0.66, Math.PI * 1.34); g.stroke();
        g.globalAlpha = 0.2; g.fillStyle = '#f4f7fb';
        g.beginPath(); g.moveTo(k * 1.2, 0); g.arc(k * 1.2, 0, k * 2.8, Math.PI * 0.72, Math.PI * 1.28); g.closePath(); g.fill();
      }
      g.restore();
      jet(g, d.x, d.y, ang, k, true, s.t);
      // the ball, always findable: a bright keylined ring exactly on it, drawn last
      g.save();
      g.beginPath(); g.arc(d.x, d.y, b.r, 0, TAU); keyed(g, '#1c2230', '#ffffff', 3);
      g.restore();
      s.fx.drawGlow(g, d.x, d.y, b.r * 1.6, '#f4f7fb', 0.35);
    },

    trail(b, s) {
      const { fx } = s;
      const a = Math.atan2(b.vy, b.vx), k = b.r * 2, c = Math.cos(a), sn = Math.sin(a);
      for (const sd of [-1, 1]) {
        const lx = -k * 1.1, ly = sd * k * 1.8;
        fx.emit({ shape: 'smoke', x: b.x + c * lx - sn * ly, y: b.y + sn * lx + c * ly, r: 4, r1: 14, life: 1.1, color: '#f4f7fb', layer: 'back' });
      }
      if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: b.x - c * k * 3, y: b.y - sn * k * 3, vx: -b.vx * 0.2, vy: fx.rand(-50, 50), r: 4, life: 0.35, color: pick(['#ff5ea8', '#7ad7ff']) });
      // sonic rings peeling off behind it, one every few frames
      const roll = Math.random();
      if (roll < 0.22) fx.ring(b.x - c * k * 2.5, b.y - sn * k * 2.5, { r: k * 0.8, r1: k * 3.2, life: 0.35, w: 4, color: '#f4f7fb', layer: 'back' });
      else if (roll < 0.45) fx.glow(b.x - c * k * 4, b.y - sn * k * 4, 26, '#ff5ea8', { life: 0.3, alpha: 0.6 });
      // the sonic boom, once per shot, as the climb gets going
      const pw = b.power;
      if (pw) {
        const mem = memo(pw, () => ({ boom: false }));
        if (!mem.boom && pw.t > 0.15 && b.vy < -30) {
          mem.boom = true;
          fx.ring(b.x, b.y, { r: 8, r1: 150, life: 0.45, w: 6, color: '#f4f7fb', layer: 'front' });
          fx.rays(b.x, b.y, { color: '#f4f7fb', color2: '#7ad7ff', n: 12, r1: 200, life: 0.4, spin: 2, alpha: 0.4 });
          fx.stamp(b.x, top(b.y - 60), 'בום!', { r: 40, color: '#f4f7fb', edge: '#1c2230', life: 0.7 });
          fx.shake(4, 0.18);
          fx.sound([{ k: 'thud', freq: 1800, q: 0.7, peak: 0.45, decay: 0.08 }, { k: 'thud', freq: 90, q: 0.6, peak: 0.5, decay: 0.3 }]);
        }
      }
    },

    impact(s, ev) {
      const { fx } = s;
      pop(fx, ev.x, ev.y, '#ff5ea8', '#ffc4e1', { g: 170, R: 380, spin: 2.2 });
      fx.ring(ev.x, ev.y, { color: '#ff5ea8', r1: 190, life: 0.55, w: 8 });
      fx.burst(ev.x, ev.y, 28, { shape: 'shard', speed: 440, r: 7, spin: 16, grav: 900, life: 0.9, color: '#d7dde5' });
      fx.burst(ev.x, ev.y, 18, { shape: 'streak', speed: 600, color: '#7ad7ff', life: 0.35, w: 3 });
      fx.confetti(ev.x, ev.y, 22, ['#ff5ea8', '#d7dde5', '#7ad7ff', '#2fb8ff']);
      // the fireball: a rolling cloud of pink-and-white smoke and a ring of sonic shock
      fx.burst(ev.x, ev.y, 18, { shape: 'smoke', speed: 160, r: 12, r1: 40, drag: 2.5, life: 1.2, color: pick(['#ffc4e1', '#f4f7fb']), layer: 'back' });
      fx.ring(ev.x, ev.y, { color: '#f4f7fb', r1: 340, life: 0.7, w: 10, layer: 'front' });
      fx.stamp(ev.x, top(ev.y - 70), 'קבום!', { r: 78, color: '#ff5ea8', edge: '#1c2230' });
      fx.vignette('#ff5ea8', 0.5, 0.8);
      fx.shake(14, 0.5);
      if (ev.kind === 'goal') fx.flash('#ff5ea8', 0.2, 0.25);
    },

    end(s) {
      const { fx } = s;
      const b = s.M.ball;
      fx.ring(b.x, b.y, { r: 10, r1: 80, life: 1, w: 5, color: '#f4f7fb' });
      fx.glow(b.x, b.y, 70, '#ff5ea8', { life: 1, alpha: 0.5 });
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-24, 24), y: b.y + fx.rand(-10, 10), vy: -14, r: 7, r1: 24, life: 1.2, color: '#f4f7fb', layer: 'back' });
    },
  },

  // ── 14 · turbo — nitro ───────────────────────────────────────────────────
  turbo: {
    theme: 'Nitro street racer',
    visual: 'blue nitro heel-flames, NOS canisters, horizontal speed lines, tire smoke on turns, checkered-flag glints',
    palette: ['#2d6bff', '#00e5ff', '#b8f7ff', '#111111', '#f5f5f5', '#8d939b', '#ff2e4c'],
    doc: {
      fantasy: 'The champion straps on two nitro bottles and hits the button: blue fire out of the heels and the pitch turns into a drag strip.',
      purpose: 'The first power that is pure speed: stage 14 teaches that a faster opponent wins every loose ball, so you defend the space, not the man.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is driven at the goal you attack on a lofted line, and you run 1.5× faster with 1.6× acceleration and dashes that never wait, for 4.5 seconds.',
      bot: 'Arms at any moment (arm: any) and plays the striker style — it uses the speed to get to every loose ball first.',
      sequence: {
        anticipation: 'While armed two big keylined NOS bottles hang on the champion\'s back with a pressure gauge needle wobbling into the red, and long lit blue pilot flames roar at the heels.',
        activation: 'The cut-in: a giant checkered flag waves on the champion\'s side while two nitro flame jets stream across the bottom of the screen. Then the nitro blast: a cyan sunburst, two thick blue flame beams blasted backward, a glow, 30 streaks thrown back, checkered confetti, tire smoke, a 320px blue fire ring, a spark fan, a 🏁 flag, a big "ניטרו!" stamp and a "וררום!"; a cyan screen-edge glow and shake 8.',
        main: 'For 4.5s: a spinning blue sunburst behind the racer, a roaring navy-keyed blue-fire aura licking up round the whole body, keylined speed streaks rushing across the whole pitch, nitro sparks spraying off the heels every frame, twin lit blue flames (48px at a standstill, 120 at a run) jet backward from the heels sized by the real running speed, three cyan afterimage ghosts of the body trail behind when it runs, speed lines stream past, a checkered strip runs under the feet, tire smoke and a screech on every change of direction, flame sparks and checkered glints.',
        impact: 'The nitro takes hold: a blue ring and a glow at the feet, streaks fired rearward.',
        aftermath: 'The bottles run dry: grey smoke puffs, a fading blue glow, a small grey "פפט!" stamp and a three-pop sputter.',
        cleanup: 'Smoke, confetti and streaks run out their life within two seconds.',
      },
      layers: 'Cut-in flag and flame jets, NOS bottles + gauge + lit heel flames (aura), afterimage ghosts + checkered strip + speed lines + lit heel flames (back), rays, beams, glows, confetti, stamps, streaks, tire smoke, glints, rings, glyph.',
      camera: 'Shake 8 and a cyan vignette on the blast; no grade — speed reads better without a tint.',
      hud: 'The engine\'s ⚡ status pill with its 4.5s ring over the champion\'s head.',
      audio: 'Fire: a square-wave rev up with a gear-change blip. Impact: a sawtooth whine. End: a three-pop sputter. Turns add a quiet screech.',
      counterplay: 'Speed is not aim: stay goal-side and let it run past you — it overruns balls it would have trapped, and 4.5s is gone fast.',
      perf: '~100 particles on firing, ≤4 a frame (heel spark, streak, smoke on turns or glint); ≤4 drawGlow a frame; one shadowBlur on the heel flame.',
      helpers: 'pop() (fx.rays + fx.glow), fx.beam, fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(streak/smoke/star/dot), fx.glyph, fx.shake, fx.sound, memo() for turns.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 300, to: 2200, type: 'square', peak: 0.28, dur: 0.35, detune: 20 }, { k: 'blip', freq: 1760, type: 'square', peak: 0.2, dur: 0.06, t: 0.3 }],
      impact: [{ k: 'sweep', from: 1200, to: 2600, type: 'sawtooth', peak: 0.2, dur: 0.2 }],
      end: [{ k: 'blip', freq: 220, type: 'square', peak: 0.2, dur: 0.06 }, { k: 'blip', freq: 200, type: 'square', peak: 0.16, dur: 0.06, t: 0.1 }, { k: 'blip', freq: 170, type: 'square', peak: 0.12, dur: 0.08, t: 0.22 }],
    },

    aura(g, p, s) {
      const C = s.C;
      const d = s.depth(p.x - p.side * (C.BODY_W / 2 + 7), p.y - C.BODY_H + 2);
      const f = s.depth(p.x, p.y);
      s.fx.drawGlow(g, f.x - p.side * 26, f.y - 5, 34, '#00e5ff', 0.8);
      g.save();
      // two NOS bottles on the back
      g.strokeStyle = '#111111'; g.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) {
        const x = d.x - p.side * i * 16;
        g.fillStyle = '#2d6bff'; g.fillRect(x - 6, d.y - 6, 13, 36); g.strokeRect(x - 6, d.y - 6, 13, 36);
        g.fillStyle = '#ff2e4c'; g.fillRect(x - 6, d.y + 5, 13, 6);
        g.fillStyle = '#b8f7ff'; g.fillRect(x - 4, d.y - 2, 3, 26);
        g.fillStyle = '#f5f5f5'; g.fillRect(x - 3, d.y - 13, 7, 7); g.strokeRect(x - 3, d.y - 13, 7, 7);
      }
      // the gauge, needle creeping into the red
      const gx = d.x - p.side * 8, gy = d.y - 28;
      g.fillStyle = '#111111';
      g.beginPath(); g.arc(gx, gy, 10, 0, TAU); g.fill();
      g.strokeStyle = '#ff2e4c'; g.lineWidth = 2;
      g.beginPath(); g.arc(gx, gy, 7, -0.4, 0.6); g.stroke();
      const na = -2.4 + 2.6 * (0.8 + Math.sin(s.t * 13) * 0.2);
      g.strokeStyle = '#f5f5f5';
      g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(na) * 7, gy + Math.sin(na) * 7); g.stroke();
      // pilot flames at the heels
      g.globalCompositeOperation = 'lighter';
      for (const [col, L, w] of [['#2d6bff', 56, 9], ['#00e5ff', 36, 5]]) {
        g.fillStyle = col; g.globalAlpha = 0.6 + Math.random() * 0.4;
        const l = L + Math.random() * 10;
        g.beginPath(); g.moveTo(f.x - p.side * 8, f.y - 4 - w); g.lineTo(f.x - p.side * (8 + l), f.y - 4); g.lineTo(f.x - p.side * 8, f.y - 4 + w); g.closePath(); g.fill();
      }
      g.restore();
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 230), y0 = C.H * 0.5;
      const dir = s.owner.side > 0 ? 1 : -1;
      // nitro jets streaming across the bottom
      const u = ease(k / 0.3);
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const [yy, col, w] of [[C.H * 0.86, '#2d6bff', 34], [C.H * 0.86, '#b8f7ff', 12], [C.H * 0.94, '#00e5ff', 22]]) {
        const x0 = dir > 0 ? 0 : C.W, x1 = x0 + dir * C.W * u;
        g.globalAlpha = 0.85 * f; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy + Math.sin(k * 40) * 3); g.stroke();
      }
      g.restore();
      s.fx.drawGlow(g, (dir > 0 ? 0 : C.W) + dir * C.W * u, C.H * 0.88, 90, '#00e5ff', f);
      // the checkered flag, waving
      g.save();
      g.globalAlpha = f;
      g.fillStyle = '#8d939b'; g.fillRect(x - 6, y0 - 10, 8, C.H * 0.34);
      const cols = 8, rows = 5, sq = 22;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const wv = Math.sin(i * 0.8 - k * 22) * 8 * (i / cols);
          g.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5';
          g.fillRect(x + dir * i * sq - (dir < 0 ? sq : 0), y0 + j * sq + wv, sq + 1, sq + 1);
        }
      }
      g.strokeStyle = '#ff2e4c'; g.lineWidth = 4;
      g.strokeRect(x - (dir < 0 ? cols * sq : 0), y0 - 2, cols * sq, rows * sq + 12);
      g.restore();
    },

    fire(s) {
      const { fx, owner, side } = s;
      const x = owner.x, y = owner.y - 6;
      pop(fx, x, y - 20, '#00e5ff', '#2d6bff', { g: 150, R: 340, spin: 2.4 });
      fx.beam(x, y, x - side * 320, y, { color: '#2d6bff', color2: '#b8f7ff', w: 30, life: 0.5 });
      fx.beam(x, y - 14, x - side * 230, y - 16, { color: '#00e5ff', color2: '#ffffff', w: 14, life: 0.38 });
      fx.emit({ shape: 'star', x, y, r: 16, r1: 44, life: 0.2, color: '#ffffff', color2: '#00e5ff', blend: 'lighter' });
      fx.ring(x, y, { color: '#00e5ff', r1: 150, life: 0.4, w: 6 });
      fx.burst(x, y, 30, { shape: 'streak', speed: 600, spread: 0.6, angle: side > 0 ? Math.PI : 0, color: pick(['#2d6bff', '#00e5ff']), life: 0.35, w: 3 });
      fx.confetti(x, y - 30, 20, ['#111111', '#f5f5f5', '#ff2e4c']);
      fx.burst(x, y, 10, { shape: 'smoke', speed: 140, spread: 0.8, angle: side > 0 ? Math.PI : 0, r: 7, r1: 24, life: 0.9, drag: 2, color: '#8d939b', layer: 'back' });
      fx.glyph(owner.x - side * 40, s.headY(owner) - s.headR(owner) - 20, '🏁', { r: 38, vy: -60 });
      // a blue fire ring blown out along the ground and sparks in a wide fan behind
      fx.ring(x, y, { color: '#2d6bff', r1: 320, life: 0.6, w: 10 });
      fx.burst(x, y - 10, 28, { shape: 'dot', speed: 460, spread: 1.4, angle: side > 0 ? Math.PI : 0, r: 4, grav: 300, life: 0.6, color: pick(['#00e5ff', '#b8f7ff']), blend: 'lighter' });
      fx.stamp(owner.x, top(s.headY(owner) - s.headR(owner) - 70), 'ניטרו!', { r: 72, color: '#00e5ff', edge: '#111111' });
      fx.stamp(owner.x - side * 140, top(owner.y - 50), 'וררום!', { r: 36, color: '#f5f5f5', edge: '#111111', life: 0.9, vy: -50 });
      fx.vignette('#00e5ff', 0.55, 0.9);
      fx.shake(10, 0.35);
    },

    back(g, e, s) {
      const q = who(s, e), C = s.C;
      const k = fade(e, 0.2, 0.6);
      const run = Math.min(1, Math.abs(q.vx) / 300);
      const dir = Math.abs(q.vx) > 30 ? Math.sign(q.vx) : (q.facing || q.side);
      const f = s.depth(q.x, q.y), hr = s.headR(q), hd = s.depth(q.x, s.headY(q));
      s.fx.drawGlow(g, f.x, f.y - C.BODY_H, 120 * k + 1, '#00e5ff', 0.6 * k);
      g.save();
      // the whole pitch is a racetrack: speed streaks rushing past at every height
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const sp = 900 + hash(i) * 900, len = 60 + hash(i + 3) * 120;
        const x = ((hash(i + 9) * (C.W + len) - s.t * sp * dir) % (C.W + len) + C.W + len) % (C.W + len) - len / 2;
        const y = C.CEIL_Y + 40 + hash(i + 5) * (C.GROUND_Y - C.CEIL_Y - 60);
        g.globalAlpha = 0.7 * k;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir * len, y);
        keyed(g, '#111111', i % 3 ? '#b8f7ff' : '#00e5ff', 2 + (i % 3));
      }
      // a spinning blue sunburst behind the racer
      wedges(g, hd.x, (hd.y + f.y) / 2, 30, 190, 12, s.t * 3, '#00e5ff', '#2d6bff', 0.3 * k);
      // a roaring blue-fire aura round the whole body: navy-keyed tongues licking up and back
      const tongues = (col, grow, a) => {
        g.globalAlpha = a * k; g.fillStyle = col;
        for (let i = 0; i < 9; i++) {
          const u = i / 8 - 0.5, fl = 0.7 + 0.3 * Math.sin(s.t * 23 + i * 2.1);
          const x = f.x + u * (C.BODY_W + 100), h = ((C.BODY_H + hr * 2.8) * (1 - Math.abs(u) * 0.6) * fl) + grow;
          g.beginPath(); g.moveTo(x - 11 - grow * 0.2, f.y); g.quadraticCurveTo(x - 12, f.y - h * 0.6, x - dir * (14 + grow * 0.3), f.y - h); g.quadraticCurveTo(x + 12, f.y - h * 0.6, x + 11 + grow * 0.2, f.y); g.closePath(); g.fill();
        }
      };
      tongues('#0b1a4a', 8, 0.75);
      tongues('#2d6bff', 0, 0.85);
      g.globalCompositeOperation = 'lighter';
      tongues('#00e5ff', -18, 0.7);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#e8fdff'; g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = s.t * 9 + i * 2.1, seed = Math.floor(s.t * 14) + i * 5;
        g.globalAlpha = 0.9 * k;
        jag(g, f.x + Math.cos(a) * (C.BODY_W / 2 + 14), f.y - 10 - hash(seed) * C.BODY_H, hd.x + Math.cos(a + 1) * (hr + 10), hd.y + Math.sin(a) * hr * 0.6, seed, 7, 5);
      }
      // afterimage ghosts of the body, when it runs
      if (run > 0.2) {
        for (let i = 1; i <= 3; i++) {
          const gx = -dir * i * (10 + run * 16);
          g.globalAlpha = k * run * (0.34 - i * 0.08); g.fillStyle = i % 2 ? '#00e5ff' : '#2d6bff';
          g.fillRect(f.x + gx - C.BODY_W / 2, f.y - C.BODY_H, C.BODY_W, C.BODY_H);
          g.beginPath(); g.arc(hd.x + gx, hd.y, hr, 0, TAU); g.fill();
        }
      }
      // the checkered strip under the feet
      g.globalAlpha = 0.8 * k;
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5';
          g.fillRect(f.x - 64 + i * 8, f.y + 2 + j * 5, 8, 5);
        }
      }
      // speed lines streaming past the body, faster when it runs
      g.strokeStyle = '#b8f7ff'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const off = ((s.t * (500 + run * 900) + i * 53) % 150);
        const y = f.y - 6 - i * 11;
        g.globalAlpha = k * (0.25 + run * 0.55) * (1 - off / 150);
        const x0 = f.x - dir * (20 + off);
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 - dir * (24 + run * 40), y); g.stroke();
      }
      // twin nitro flames out of the heels, as long as the running speed
      const L = 48 + run * 70 + Math.random() * 14;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = k;
      g.shadowColor = '#00e5ff'; g.shadowBlur = 12;
      g.fillStyle = '#2d6bff';
      for (const hy of [-10, -2]) {
        g.beginPath(); g.moveTo(f.x - dir * 8, f.y + hy - 8); g.lineTo(f.x - dir * (8 + L), f.y + hy); g.lineTo(f.x - dir * 8, f.y + hy + 8); g.closePath(); g.fill();
        g.shadowBlur = 0;
      }
      g.fillStyle = '#b8f7ff';
      g.beginPath(); g.moveTo(f.x - dir * 8, f.y - 8); g.lineTo(f.x - dir * (8 + L * 0.5), f.y - 6); g.lineTo(f.x - dir * 8, f.y - 4); g.closePath(); g.fill();
      g.restore();
      s.fx.drawGlow(g, f.x - dir * (8 + L * 0.5), f.y - 6, 20 + L * 0.5, '#00e5ff', 0.8 * k);
      s.fx.drawGlow(g, f.x - dir * 8, f.y - 6, 18, '#b8f7ff', 0.7 * k);
    },

    tick(e, s) {
      const q = who(s, e), { fx } = s;
      const mem = memo(e, () => ({ vx: q.vx, sq: 0 }));
      // tire smoke on a change of direction
      if (q.onGround && Math.abs(q.vx - mem.vx) > 120 && Math.sign(q.vx) !== Math.sign(mem.vx)) {
        fx.emit({ shape: 'smoke', x: q.x + fx.rand(-8, 8), y: q.y - 3, vx: -q.vx * 0.2, vy: -fx.rand(20, 40), r: 7, r1: 26, life: 0.9, color: '#8d939b', layer: 'back' });
        if (s.t - mem.sq > 0.4) { mem.sq = s.t; fx.sound([{ k: 'sweep', from: 1900, to: 1500, type: 'sine', peak: 0.08, dur: 0.18 }]); }
      }
      mem.vx = q.vx;
      const dir = Math.abs(q.vx) > 30 ? Math.sign(q.vx) : (q.facing || q.side);
      // nitro sparks spraying off the heels all the time, harder when running
      fx.emit({ shape: 'dot', x: q.x - dir * 14, y: q.y - fx.rand(2, 12), vx: -dir * fx.rand(220, 420) - q.vx * 0.3, vy: fx.rand(-60, 20), r: 3.5, life: 0.28, color: pick(['#00e5ff', '#b8f7ff', '#2d6bff']), blend: 'lighter', layer: 'back' });
      if (Math.random() < 0.3) fx.emit({ shape: 'streak', x: q.x - dir * 20, y: s.headY(q) + fx.rand(-20, 40), vx: -dir * 700, r: 14, w: 3, life: 0.2, color: '#b8f7ff' });
      else if (Math.random() < 0.12) fx.emit({ shape: 'star', x: q.x + fx.rand(-30, 30), y: q.y + 4, r: 6, spin: 5, life: 0.35, color: '#f5f5f5', layer: 'back' });
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.e ? who(s, ev.e) : s.owner;
      fx.ring(q.x, q.y - 4, { color: '#2d6bff', r1: 120, life: 0.45, w: 6 });
      fx.glow(q.x, q.y - 6, 80, '#2d6bff', { life: 0.5 });
      fx.burst(q.x, q.y - 8, 10, { shape: 'streak', speed: 440, spread: 0.4, angle: q.side > 0 ? Math.PI : 0, color: '#b8f7ff', life: 0.3, w: 3 });
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e ? who(s, info.e) : s.owner;
      fx.glow(q.x - q.side * 14, q.y - 8, 60, '#2d6bff', { life: 0.8, alpha: 0.6 });
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'smoke', x: q.x - q.side * 14, y: q.y - 12 - i * 3, vx: -q.side * 30, vy: -30, r: 6, r1: 22, life: 1.1, color: '#8d939b', layer: 'back' });
      fx.stamp(q.x - q.side * 30, top(q.y - 70), 'פפט!', { r: 28, color: '#8d939b', edge: '#111111', life: 0.8 });
    },
  },

  // ── 15 · heavy — the iron weights ────────────────────────────────────────
  heavy: {
    theme: 'Iron gym weights',
    visual: 'black iron KG plates on a barbell, chained kettlebell dragging, ground dents, sweat drops, chalk dust',
    palette: ['#3a3f47', '#1f2227', '#c0c6d0', '#d8343f', '#6fd0ff', '#a58e6b'],
    doc: {
      fantasy: 'A barbell of iron plates drops onto the opponent\'s shoulders and a kettlebell is chained to his ankle: every step is leg day.',
      purpose: 'The first power that takes the opponent\'s air away: stage 15 teaches that a player who cannot jump cannot defend the high ball — go over him.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is driven at the goal you attack on a lofted line, and the opponent gets 1.9× gravity and 0.85× jump for 5 seconds.',
      bot: 'Arms at any moment (arm: any) and plays the brawler style — goes for the man to earn the meter back.',
      sequence: {
        anticipation: 'While armed a big keylined KG kettlebell swings like a pendulum on a long chain from the champion\'s hand on a chain, lit by a red glow, with a pale motion arc behind it.',
        activation: 'The cut-in: a giant barbell with two huge red-rimmed 1000 KG plates slams down from the top onto the lower screen and bounces, dust lines flying. Then the clang: an iron-and-red sunburst at the champion, a red weight-drop beam from the sky onto the opponent, 30 iron shards, dust at his feet, iron confetti, a KG plate flung, a 300px red shockwave, a red sunburst, a dust wall rolling both ways, and a big red "כבד!" stamp over him; a dark iron screen-edge glow and shake 9.',
        main: 'For 5s: a red-and-iron sunburst turns under him, a big keylined 1000 KG weight hangs in a red gravity column over his head, red gravity streaks rain down on him, a keylined barbell across his shoulders with two huge double KG plates that sag as he moves, a kettlebell on a chain dragging behind his feet, a red pressure glow and a dent under him, red gravity chevrons pressing down either side, dust from every step, sweat drops — and every landing is a thud with a dust ring and a "דונג!" stamp.',
        impact: 'The plates slam on: a big dust ring at the feet, chips, "-קפיצה" off the head, shake 6.',
        aftermath: 'The plates fall off: iron chunks and chips drop to the grass with a clank, a red glow fades and a relieved dust puff rises.',
        cleanup: 'Chunks and dust run out within a second; the dent and chevrons go with the effect.',
      },
      layers: 'Cut-in barbell and plates, kettlebell (aura), pressure glow + dent + chevrons + chain + kettlebell (back), barbell and lit KG plates (front), rays, beam, glows, confetti, stamps, step dust, sweat drops, chips, rings, glyphs.',
      camera: 'Shake 9 and an iron vignette on firing, 6 when it lands, 3 on each heavy landing; no grade.',
      hud: 'The engine\'s 🏋️ status pill with its 5s ring over the weighed-down head.',
      audio: 'Fire: a plate clang over a gym thump. Impact: a dropped deadlift. End: two plates clanking on the floor. Each landing adds a low thud.',
      counterplay: 'You can still run, and ground balls are still yours: stay on the grass, block low, and never try to out-jump the lob — it is only 5s.',
      perf: '~105 particles on firing, ≤3 a frame (gravity streak, step dust, sweat), ~12 per landing; ≤5 drawGlow a frame; no shadowBlur.',
      helpers: 'pop() (fx.rays + fx.glow), fx.beam, fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(smoke/shard/dot/ring), fx.glyph, fx.shake, fx.sound, memo() for the kettlebell and landings.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 140, q: 1.5, peak: 0.8, decay: 0.25 }, { k: 'thud', freq: 2600, q: 8, peak: 0.5, decay: 0.3 }, { k: 'blip', freq: 330, type: 'triangle', peak: 0.15, dur: 0.2 }],
      impact: [{ k: 'thud', freq: 60, q: 0.8, peak: 1, decay: 0.5 }, { k: 'thud', freq: 1800, q: 6, peak: 0.3, decay: 0.2 }],
      end: [{ k: 'thud', freq: 2200, q: 7, peak: 0.3, decay: 0.2 }, { k: 'thud', freq: 2500, q: 7, peak: 0.25, decay: 0.2, t: 0.09 }],
    },

    aura(g, p, s) {
      const C = s.C;
      const hx = p.x + p.side * (C.BODY_W / 2 + 2), hy = p.y - C.BODY_H * 0.55;
      const a = Math.sin(s.t * 4) * 0.7;
      const d = s.depth(hx, hy);
      const L = 44, kx = d.x + Math.sin(a) * L, ky = d.y + Math.cos(a) * L;
      s.fx.drawGlow(g, kx, ky + 10, 60, '#d8343f', 0.75);
      g.save();
      g.globalAlpha = 0.6; g.strokeStyle = '#c0c6d0'; g.lineWidth = 4; g.setLineDash([6, 6]);
      g.beginPath(); g.arc(d.x, d.y, L, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7); g.stroke();
      g.globalAlpha = 1; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(kx, ky); keyed(g, '#1f2227', '#c0c6d0', 2.5);
      g.setLineDash([]);
      g.translate(kx, ky); g.scale(1.6, 1.6);
      g.fillStyle = '#1f2227';
      g.beginPath(); g.arc(0, 7, 13, 0, TAU); g.fill();
      g.strokeStyle = '#d8343f'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 7, 13, 0, TAU); g.stroke();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, -4, 7, Math.PI, 0); g.stroke();
      g.strokeStyle = '#c0c6d0'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 7, 11, -2.5, -1.6); g.stroke();
      g.fillStyle = '#c0c6d0'; g.font = '900 10px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('KG', 0, 8);
      g.restore();
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 260);
      const land = C.H * 0.72;
      // drops in, slams, bounces once
      const y = k < 0.16 ? -C.H * 0.2 + (k / 0.16) ** 2 * (land + C.H * 0.2) : land - Math.abs(Math.sin((k - 0.16) * 12)) * 30 * Math.max(0, 1 - (k - 0.16) * 3);
      const R = C.H * 0.14, half = R * 1.6;
      g.save();
      g.globalAlpha = f;
      if (k > 0.16) {
        g.strokeStyle = '#a58e6b'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + (i / 5) * Math.PI, r0 = half + R, r1 = r0 + 40 + (k - 0.16) * 120;
          g.globalAlpha = f * Math.max(0, 1 - (k - 0.16) * 2);
          g.beginPath(); g.moveTo(x + Math.cos(a) * r0, land + R + Math.sin(a) * 10); g.lineTo(x + Math.cos(a) * r1, land + R + Math.sin(a) * 30 - 20); g.stroke();
        }
        g.globalAlpha = f;
      }
      g.strokeStyle = '#c0c6d0'; g.lineWidth = 12;
      g.beginPath(); g.moveTo(x - half - R * 0.9, y); g.lineTo(x + half + R * 0.9, y); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(R * 0.45)}px Arial`;
      for (const sd of [-1, 1]) {
        const px = x + sd * half;
        g.fillStyle = '#1f2227';
        g.beginPath(); g.arc(px, y, R, 0, TAU); g.fill();
        g.strokeStyle = '#d8343f'; g.lineWidth = 8;
        g.beginPath(); g.arc(px, y, R * 0.78, 0, TAU); g.stroke();
        g.strokeStyle = '#3a3f47'; g.lineWidth = 4;
        g.beginPath(); g.arc(px, y, R * 0.3, 0, TAU); g.stroke();
        g.fillStyle = '#c0c6d0';
        g.fillText('1000', px, y - R * 0.5 + 4);
        g.fillText('KG', px, y + R * 0.52);
      }
      g.restore();
      for (const sd of [-1, 1]) s.fx.drawGlow(g, x + sd * half, y, R * 1.6, '#d8343f', 0.55 * f);
    },

    fire(s) {
      const { fx, owner, foe, C } = s;
      const x = owner.x, y = s.headY(owner);
      const fy = s.headY(foe), fr = s.headR(foe);
      pop(fx, x, y, '#c0c6d0', '#d8343f', { g: 140, R: 320, spin: 0.9 });
      fx.beam(foe.x, C.CEIL_Y, foe.x, fy - fr - 6, { color: '#d8343f', color2: '#c0c6d0', w: 26, life: 0.45 });
      fx.glow(foe.x, fy, 110, '#d8343f', { life: 0.6 });
      fx.burst(x, y, 30, { shape: 'shard', speed: 320, r: 6, spin: 12, grav: 900, life: 0.8, color: pick(['#3a3f47', '#1f2227']) });
      fx.ring(x, y, { color: '#c0c6d0', r1: 120, life: 0.35, w: 6, layer: 'front' });
      fx.ring(foe.x, foe.y, { color: '#a58e6b', r1: 140, life: 0.45, w: 6 });
      fx.burst(foe.x, foe.y - 2, 16, { shape: 'smoke', speed: 170, spread: 1.6, angle: -Math.PI / 2, r: 7, r1: 24, life: 0.9, drag: 2.5, color: '#a58e6b', layer: 'back' });
      fx.confetti(foe.x, fy, 14, ['#3a3f47', '#c0c6d0', '#d8343f']);
      fx.glyph(x, y - 30, 'KG', { r: 30, color: '#d8343f', vx: (foe.x - x) * 1.2, vy: -60, spin: 6, life: 0.8 });
      // the drop lands on him: a shockwave, a dust wall both ways, iron chips flying
      fx.ring(foe.x, foe.y, { color: '#d8343f', r: 10, r1: 300, life: 0.6, w: 10 });
      fx.rays(foe.x, fy, { color: '#d8343f', color2: '#3a3f47', n: 12, r1: 320, life: 0.8, spin: -1, alpha: 0.45 });
      fx.burst(foe.x, foe.y - 4, 20, { shape: 'smoke', speed: 260, spread: 0.5, angle: 0, r: 8, r1: 30, life: 1, drag: 2.5, color: '#a58e6b', layer: 'back' });
      fx.burst(foe.x, foe.y - 4, 20, { shape: 'smoke', speed: 260, spread: 0.5, angle: Math.PI, r: 8, r1: 30, life: 1, drag: 2.5, color: '#a58e6b', layer: 'back' });
      fx.stamp(foe.x, top(fy - fr - 60), 'כבד!', { r: 76, color: '#d8343f', edge: '#1f2227', life: 1.2 });
      fx.vignette('#3a3f47', 0.6, 1.1);
      fx.shake(12, 0.4);
    },

    back(g, e, s) {
      const q = who(s, e), C = s.C;
      const k = fade(e, 0.2, 0.5);
      const f = s.depth(q.x, q.y), hr = s.headR(q);
      const mem = memo(e, () => ({ ground: q.onGround, kx: q.x - (q.facing || q.side) * 40 }));
      const want = q.x - (Math.abs(q.vx) > 20 ? Math.sign(q.vx) : (q.facing || q.side)) * 46;
      mem.kx += (want - mem.kx) * Math.min(1, s.dt * 3);
      const kd = s.depth(mem.kx, C.GROUND_Y);
      s.fx.drawGlow(g, f.x, f.y, 110, '#d8343f', (q.onGround ? 0.65 : 0.4) * k);
      g.save();
      // a red gravity well crushing down on him from the sky, with a giant 1000KG weight in it
      const hy = s.depth(q.x, s.headY(q)).y, wy = hy - hr - 130 + Math.sin(s.t * 5) * 6;
      wedges(g, f.x, f.y, 20, 240, 10, s.t * 0.6, '#d8343f', '#c0c6d0', 0.22 * k);
      const col = g.createLinearGradient(0, wy - 40, 0, f.y);
      col.addColorStop(0, 'rgba(216,52,63,0)'); col.addColorStop(1, 'rgba(216,52,63,0.6)');
      g.globalAlpha = 0.9 * k; g.fillStyle = col;
      g.beginPath(); g.moveTo(f.x - 80, wy - 40); g.lineTo(f.x + 80, wy - 40); g.lineTo(f.x + 44, f.y); g.lineTo(f.x - 44, f.y); g.closePath(); g.fill();
      g.globalAlpha = k;
      g.save(); g.translate(f.x, wy); g.scale(1.35, 1.35);
      g.fillStyle = '#12141a';
      g.beginPath(); g.moveTo(-40, -26); g.lineTo(40, -26); g.lineTo(56, 30); g.lineTo(-56, 30); g.closePath(); g.fill();
      g.strokeStyle = '#d8343f'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#3a3f47';
      g.beginPath(); g.moveTo(-35, -21); g.lineTo(35, -21); g.lineTo(50, 25); g.lineTo(-50, 25); g.closePath(); g.fill();
      g.strokeStyle = '#12141a'; g.lineWidth = 7;
      g.beginPath(); g.arc(0, -28, 16, Math.PI, 0); g.stroke();
      g.fillStyle = '#ffffff'; g.font = '900 20px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('1000', 0, 2);
      g.fillStyle = '#ff6b75'; g.font = '900 12px Arial'; g.fillText('KG', 0, 18);
      g.restore();
      // cracks splitting the turf out from under his feet
      g.strokeStyle = '#1f2227'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const sd = i % 2 ? 1 : -1, L = (40 + hash(i) * 60) * k;
        jag(g, f.x + sd * 12, f.y + 2, f.x + sd * (12 + L), f.y + 4 + (hash(i + 2) - 0.5) * 8, i * 3, 4, 4);
      }
      // the dent: deeper when he stands on it
      g.globalAlpha = (q.onGround ? 0.5 : 0.22) * k; g.fillStyle = '#3a3f47';
      g.beginPath(); g.ellipse(f.x, f.y + 3, 30, 6, 0, 0, TAU); g.fill();
      // red gravity chevrons pressing down on either side of him
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const u = (s.t * 1.4 + i / 3) % 1;
          const x = f.x + sd * (hr + 34), y = hy - 60 + u * 130;
          g.globalAlpha = k * Math.sin(u * Math.PI);
          g.strokeStyle = '#3a0a10'; g.lineWidth = 10;
          g.beginPath(); g.moveTo(x - 13, y - 10); g.lineTo(x, y + 3); g.lineTo(x + 13, y - 10); g.stroke();
          g.strokeStyle = '#ff4757'; g.lineWidth = 5;
          g.beginPath(); g.moveTo(x - 13, y - 10); g.lineTo(x, y + 3); g.lineTo(x + 13, y - 10); g.stroke();
        }
      }
      // the chain, in links, from the ankle to the kettlebell dragging on the grass
      g.globalAlpha = k; g.strokeStyle = '#c0c6d0'; g.lineWidth = 2;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 0.7) / n;
        const sag = (u) => Math.sin(u * Math.PI) * 6;
        g.beginPath();
        g.moveTo(f.x + (kd.x - f.x) * t0, f.y - 4 + (kd.y - 12 - f.y + 4) * t0 + sag(t0));
        g.lineTo(f.x + (kd.x - f.x) * t1, f.y - 4 + (kd.y - 12 - f.y + 4) * t1 + sag(t1));
        g.stroke();
      }
      g.fillStyle = '#1f2227';
      g.beginPath(); g.arc(kd.x, kd.y - 11, 13, 0, TAU); g.fill();
      g.strokeStyle = '#d8343f'; g.lineWidth = 2;
      g.beginPath(); g.arc(kd.x, kd.y - 11, 13, 0, TAU); g.stroke();
      g.strokeStyle = '#3a3f47'; g.lineWidth = 3;
      g.beginPath(); g.arc(kd.x, kd.y - 22, 7, Math.PI, 0); g.stroke();
      g.restore();
    },

    front(g, e, s) {
      const q = who(s, e);
      const k = fade(e, 0.2, 0.5), hr = s.headR(q);
      const sag = Math.max(-4, Math.min(8, q.vy * 0.01)) + (q.onGround ? 2 : 0);
      const d = s.depth(q.x, s.headY(q) + hr * 0.35 + sag);
      const px = hr + 30;
      g.save();
      g.globalAlpha = k;
      // the bar, bending under the plates
      g.beginPath(); g.moveTo(d.x - px - 14, d.y + 6); g.quadraticCurveTo(d.x, d.y - 8, d.x + px + 14, d.y + 6);
      keyed(g, '#1f2227', '#c0c6d0', 5);
      g.font = '900 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const sd of [-1, 1]) {
        const x = d.x + sd * px, y = d.y + 4;
        // two plates each side, the outer one smaller
        g.fillStyle = '#1f2227';
        g.beginPath(); g.ellipse(x + sd * 12, y, 8, 18, 0, 0, TAU); g.fill();
        g.strokeStyle = '#d8343f'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill();
        g.strokeStyle = '#0d0f12'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#d8343f'; g.lineWidth = 5;
        g.beginPath(); g.arc(x, y, 19, 0, TAU); g.stroke();
        g.strokeStyle = '#c0c6d0'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 24, -2.4, -1.4); g.stroke();
        g.fillStyle = '#ffffff';
        g.fillText('KG', x, y + 1);
      }
      g.restore();
      for (const sd of [-1, 1]) s.fx.drawGlow(g, d.x + sd * px - 10, d.y - 14, 18, '#ffffff', 0.8 * k * (0.5 + 0.5 * Math.sin(s.t * 5 + sd)));
    },

    tick(e, s) {
      const q = who(s, e), { fx } = s;
      const mem = memo(e, () => ({ ground: q.onGround, kx: q.x - (q.facing || q.side) * 40 }));
      if (q.onGround && !mem.ground) {
        fx.ring(q.x, q.y, { r: 6, r1: 100, life: 0.4, w: 5, color: '#a58e6b' });
        fx.burst(q.x, q.y - 2, 8, { shape: 'smoke', speed: 130, spread: 1.4, angle: -Math.PI / 2, r: 6, r1: 20, life: 0.7, drag: 3, color: '#a58e6b', layer: 'back' });
        fx.stamp(q.x, q.y - 50, 'דונג!', { r: 30, color: '#c0c6d0', edge: '#1f2227', life: 0.6, vy: -40 });
        fx.shake(3, 0.15);
        fx.sound([{ k: 'thud', freq: 75, q: 1, peak: 0.55, decay: 0.25 }]);
      }
      mem.ground = q.onGround;
      // gravity itself, visible: red streaks raining straight down onto him
      if (Math.random() < 0.5) fx.emit({ shape: 'streak', x: q.x + fx.rand(-70, 70), y: s.headY(q) - fx.rand(60, 160), vy: 900, rot: Math.PI / 2, r: 16, w: 3, life: 0.18, color: pick(['#d8343f', '#c0c6d0']) });
      if (q.onGround && Math.abs(q.vx) > 40 && Math.random() < 0.3) {
        fx.emit({ shape: 'smoke', x: q.x + fx.rand(-10, 10), y: q.y - 2, vx: -q.vx * 0.15, vy: -fx.rand(10, 30), r: 4, r1: 12, life: 0.6, color: '#a58e6b', layer: 'back' });
      }
      if (Math.random() < 0.12) {
        const hr = s.headR(q), sd = Math.random() < 0.5 ? -1 : 1;
        fx.emit({ shape: 'dot', x: q.x + sd * hr * 0.9, y: s.headY(q) - hr * 0.4, vx: sd * fx.rand(30, 70), vy: -fx.rand(40, 90), grav: 600, r: 3.5, life: 0.6, color: '#6fd0ff' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.e ? who(s, ev.e) : s.foe;
      fx.ring(q.x, q.y, { color: '#a58e6b', r1: 150, life: 0.5, w: 7 });
      fx.burst(q.x, q.y - 2, 10, { shape: 'smoke', speed: 160, spread: 1.6, angle: -Math.PI / 2, r: 7, r1: 24, life: 0.9, drag: 2.5, color: '#a58e6b', layer: 'back' });
      fx.burst(ev.x, ev.y, 8, { shape: 'shard', speed: 220, r: 5, spin: 10, grav: 900, life: 0.6, color: '#3a3f47' });
      fx.glyph(ev.x + 50, ev.y - s.headR(q) - 20, '-קפיצה', { r: 20, color: '#d8343f', vy: -30 });
      fx.shake(6, 0.3);
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e ? who(s, info.e) : s.foe;
      const y = s.headY(q) + s.headR(q) * 0.35, px = s.headR(q) + 22;
      for (const sd of [-1, 1]) {
        fx.emit({ shape: 'dot', x: q.x + sd * px, y, vx: sd * 60, vy: -80, grav: 1400, r: 16, life: 0.55, color: '#1f2227' });
        fx.emit({ shape: 'ring', x: q.x + sd * px, y, vx: sd * 60, vy: -80, grav: 1400, r: 12, r1: 12, life: 0.55, w: 4, color: '#d8343f', layer: 'front' });
      }
      fx.glow(q.x, q.y - 10, 80, '#d8343f', { life: 0.8, alpha: 0.5 });
      fx.burst(q.x, y, 8, { shape: 'shard', speed: 180, r: 4, spin: 10, grav: 900, life: 0.7, color: '#3a3f47' });
      fx.emit({ shape: 'smoke', x: q.x, y: q.y - 4, vy: -30, r: 10, r1: 32, life: 1, color: '#a58e6b', layer: 'back' });
    },
  },

  // ── 16 · skip — the skipping stone ───────────────────────────────────────
  skip: {
    theme: 'Stone skipping on a lake',
    visual: 'flat banded slate stone, lake-water sheen under the ball, oval ripple rings and splash droplets at each skip',
    palette: ['#5d6770', '#8e98a1', '#2e7fb8', '#1c4f75', '#dff4ff', '#a9e3ff'],
    doc: {
      fantasy: 'The champion side-arms a flat stone across a still lake: it skims, skips, skips again — and every skip is a ripple.',
      purpose: 'The first shot with a rhythm: stage 16 teaches timing over position — the stone alternates a low hop and a high one, so you block on the low hop.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball flies at 1.05× power-shot speed under 1.5× gravity and skips off the grass in alternating hops — 26px, then 118px, then 26px…',
      bot: 'Arms on attack (arm: attack — ball ahead of it, in the opponent half) and plays the striker style.',
      sequence: {
        anticipation: 'While armed a wide pool of glowing lake water sits at the champion\'s feet with three oval ripples spreading, and a flat stone circles the waist.',
        activation: 'The cut-in: a lake stretches across the lower screen and a giant flat stone skips across it in three arcs, a ripple and a splash at every touch. Then the splash: a water-blue sunburst, glows, 36 droplets thrown up, droplet confetti, two rings, a curtain of spray along the grass, a 360px wave ring, a jumping 🐟, mist and a big "שפריץ!" stamp; a lake-blue screen-edge glow and shake 5.',
        main: 'The ball is a keylined flat banded slate stone 2.4× the ball with a wet sheen streaming off it, tilted with its flight, with a keylined white ring exactly on the ball drawn last; under it a wide keylined strip of lake water with moving glints and the stone\'s reflection; every real skip (the flight\'s own hop counter) throws up a keylined water spout with a rainbow arching through the spray and leaves lit oval ripple rings, splash droplets, a glow, a "פליק!"/"פלאק!" stamp and a plip; mist skims off between skips.',
        impact: 'On a block or a goal: a huge splash — a sunburst, droplets up and falling, droplet confetti, two rings, a "שפלאש!" stamp, a pale-blue flash and shake 8.',
        aftermath: 'The stone sinks: a plunk, rings spreading on the spot, a fading blue glow and bubbles rising.',
        cleanup: 'Ripples and droplets run out within two seconds; the lake goes with the shot.',
      },
      layers: 'Cut-in lake and skipping stone, pool + ripples (aura), lit water strip + glints + reflection + lit oval ripples (drawn with the ball), slate stone with strata and highlight, ball ring, rays, glows, confetti, stamps, splash droplets, mist, rings.',
      camera: 'Shake 5 and a blue vignette on firing, shake 8 and a 0.15s pale-blue flash on impact; no grade.',
      hud: 'The ordinary gold meter and armed glow; no lingering status — the power is the shot.',
      audio: 'Fire: a sine plip rising. Each skip: a short plip. Impact: splash noise with a low bloop. End: a falling plunk.',
      counterplay: 'Count the skips: the low hop is at knee height and easy to body-block, the high one clears you — step up to meet it after a high hop, as it comes down.',
      perf: '~110 particles on firing, 1 mist and 1 droplet a frame, ~11 per skip; ≤9 drawGlow a frame; ripples are at most 6 remembered strokes; no shadowBlur.',
      helpers: 'pop() (fx.rays + fx.glow), fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(dot/smoke), fx.flash, fx.shake, fx.sound, memo() on the shot for skips and ripples.',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 1320, type: 'sine', peak: 0.25, dur: 0.12 }, { k: 'sweep', from: 600, to: 1400, type: 'sine', peak: 0.18, dur: 0.1 }],
      impact: [{ k: 'crowd', dur: 0.5, peak: 0.3 }, { k: 'blip', freq: 520, type: 'sine', peak: 0.25, dur: 0.15 }],
      end: [{ k: 'sweep', from: 700, to: 180, type: 'sine', peak: 0.25, dur: 0.25 }, { k: 'blip', freq: 900, type: 'sine', peak: 0.1, dur: 0.06, t: 0.12 }],
    },

    aura(g, p, s) {
      const f = s.depth(p.x, p.y);
      s.fx.drawGlow(g, f.x, f.y + 3, 90, '#2e7fb8', 0.8);
      g.save();
      g.globalAlpha = 0.75; g.fillStyle = '#2e7fb8';
      g.beginPath(); g.ellipse(f.x, f.y + 3, 80, 12, 0, 0, TAU); g.fill();
      g.strokeStyle = '#1c4f75'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = '#dff4ff'; g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const k = (s.t * 0.8 + i / 3) % 1;
        g.globalAlpha = (1 - k) * 0.85;
        g.beginPath(); g.ellipse(f.x, f.y + 3, 8 + k * 75, (8 + k * 75) * 0.18, 0, 0, TAU); g.stroke();
      }
      // a flat stone circling the waist
      const a = s.t * 3;
      const sx = f.x + Math.cos(a) * 44, sy = f.y - s.C.BODY_H * 0.5 + Math.sin(a) * 8;
      g.globalAlpha = 1; g.fillStyle = '#5d6770';
      g.beginPath(); g.ellipse(sx, sy, 18, 8, 0, 0, TAU); g.fill();
      g.strokeStyle = '#dff4ff'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#8e98a1';
      g.beginPath(); g.ellipse(sx - 1, sy - 1, 6, 2, 0, 0, TAU); g.fill();
      g.restore();
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C;
      const dir = s.owner.side > 0 ? 1 : -1;
      const wy = C.H * 0.84;
      g.save();
      g.globalAlpha = 0.8 * f; g.fillStyle = '#1c4f75';
      g.fillRect(0, wy - 10, C.W, C.H - wy + 10);
      g.globalAlpha = 0.9 * f; g.strokeStyle = '#a9e3ff'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const y = wy + i * 14;
        g.beginPath();
        for (let x = 0; x <= C.W; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + k * 10 + i) * 4);
        g.stroke();
      }
      // three skips across: each touchdown leaves a ripple
      const u = Math.min(1, k / 0.8), hops = 3;
      const x0 = dir > 0 ? 80 : C.W - 80, span = (C.W - 160) * dir;
      const x = x0 + span * u, y = wy - Math.abs(Math.sin(u * hops * Math.PI)) * C.H * 0.22;
      g.strokeStyle = '#dff4ff'; g.lineWidth = 4;
      for (let i = 1; i <= hops; i++) {
        const ut = i / hops - 1e-3;
        if (u < ut) continue;
        const age = (u - ut) * 3;
        const rx = x0 + span * (i / hops), rr = 20 + age * 110;
        g.globalAlpha = f * Math.max(0, 1 - age);
        g.beginPath(); g.ellipse(rx, wy, rr, rr * 0.16, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = f;
      g.translate(x, y); g.rotate(Math.sin(k * 30) * 0.15);
      g.fillStyle = '#5d6770';
      g.beginPath(); g.ellipse(0, 0, 70, 26, 0, 0, TAU); g.fill();
      g.strokeStyle = '#8e98a1'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#1c4f75'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-56, 6); g.quadraticCurveTo(0, 16, 56, 4); g.stroke();
      g.fillStyle = '#dff4ff'; g.globalAlpha = 0.7 * f;
      g.beginPath(); g.ellipse(-18, -9, 26, 6, -0.2, 0, TAU); g.fill();
      g.restore();
      s.fx.drawGlow(g, x, wy, 160, '#2e7fb8', 0.7 * f);
      s.fx.drawGlow(g, x, y, 90, '#a9e3ff', 0.4 * f);
    },

    fire(s, at) {
      const { fx } = s;
      pop(fx, at.x, at.y, '#a9e3ff', '#2e7fb8', { g: 140, R: 320, spin: 1 });
      fx.burst(at.x, at.y, 36, { shape: 'dot', speed: 280, spread: 1.8, angle: -Math.PI / 2, r: 4, grav: 900, life: 0.8, color: pick(['#a9e3ff', '#dff4ff']) });
      fx.confetti(at.x, at.y, 16, ['#a9e3ff', '#dff4ff', '#2e7fb8']);
      fx.ring(at.x, at.y, { color: '#dff4ff', r1: 110, life: 0.4, w: 5 });
      fx.ring(at.x, at.y, { color: '#2e7fb8', r1: 70, life: 0.35, w: 4 });
      fx.burst(at.x, at.y, 8, { shape: 'smoke', speed: 80, r: 6, r1: 20, life: 0.8, drag: 2, color: '#dff4ff', layer: 'back' });
      // a lake-wide splash: a curtain of spray thrown up along the grass and a big wave ring
      fx.burst(at.x, s.C.GROUND_Y - 4, 30, { shape: 'dot', speed: 420, spread: 2.4, angle: -Math.PI / 2, r: 5, grav: 1000, life: 1, color: pick(['#2e7fb8', '#a9e3ff', '#dff4ff']) });
      fx.ring(at.x, s.C.GROUND_Y, { color: '#a9e3ff', r1: 360, life: 0.8, w: 8 });
      fx.burst(at.x, at.y, 14, { shape: 'star', speed: 240, r: 5, spin: 8, life: 0.6, color: '#dff4ff', blend: 'lighter' });
      fx.glyph(at.x - s.side * 60, at.y - 30, '🐟', { r: 30, vx: -s.side * 80, vy: -220, grav: 600, spin: 4, life: 1 });
      fx.stamp(at.x, top(at.y - 80), 'שפריץ!', { r: 70, color: '#a9e3ff', edge: '#1c4f75' });
      fx.vignette('#2e7fb8', 0.5, 0.9);
      fx.shake(7, 0.3);
    },

    ball(g, b, s) {
      const C = s.C, d = s.depth(b.x, b.y);
      const w = s.depth(b.x, C.GROUND_Y);
      const h = Math.max(0, C.GROUND_Y - b.y);
      const mem = b.power ? memo(b.power, () => ({ hop: b.power.hop, rip: [] })) : { rip: [] };
      s.fx.drawGlow(g, w.x, w.y + 4, 120, '#2e7fb8', 0.6);
      g.save();
      // the lake under the stone: a wide sheen and moving glints
      g.globalAlpha = 0.7; g.fillStyle = '#2e7fb8';
      g.beginPath(); g.ellipse(w.x, w.y + 4, 190, 14, 0, 0, TAU); g.fill();
      g.strokeStyle = '#1c4f75'; g.lineWidth = 3; g.stroke();
      g.globalAlpha = 0.85; g.strokeStyle = '#dff4ff'; g.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) {
        const x = w.x - 140 + ((s.t * 90 + i * 41) % 270);
        g.beginPath(); g.moveTo(x, w.y + 1 + (i % 3) * 3); g.lineTo(x + 16, w.y + 1 + (i % 3) * 3); g.stroke();
      }
      // the stone's reflection, fainter the higher it is
      g.globalAlpha = Math.max(0, 0.4 - h / 400); g.fillStyle = '#1c4f75';
      g.beginPath(); g.ellipse(w.x, w.y + 5, b.r * 1.6, 4, 0, 0, TAU); g.fill();
      // oval ripples at every skip
      g.strokeStyle = '#dff4ff'; g.lineWidth = 3;
      const young = [];
      for (const r of mem.rip) {
        const age = s.t - r.t;
        if (age < 0 || age > 1.2) continue;
        for (let i = 0; i < 3; i++) {
          const rr = 10 + (age + i * 0.16) * 90;
          g.globalAlpha = Math.max(0, 1 - age / 1.2) * (i ? 0.5 : 0.95);
          g.beginPath(); g.ellipse(r.x, r.y + 4, rr, rr * 0.16, 0, 0, TAU); g.stroke();
        }
        if (age < 0.5) young.push([r.x, r.y, age]);
        // a water spout thrown up at the skip, with a rainbow arching through the spray
        if (age < 0.7) {
          const u = age / 0.7, H = 90 * Math.sin(Math.min(1, u * 2) * Math.PI / 2) * (1 - u * 0.6);
          g.globalAlpha = (1 - u) * 0.9; g.fillStyle = '#a9e3ff';
          g.beginPath(); g.moveTo(r.x - 16, r.y + 4); g.quadraticCurveTo(r.x - 6, r.y - H * 0.6, r.x - 3, r.y - H); g.lineTo(r.x + 3, r.y - H); g.quadraticCurveTo(r.x + 6, r.y - H * 0.6, r.x + 16, r.y + 4); g.closePath(); g.fill();
          g.strokeStyle = '#1c4f75'; g.lineWidth = 2.5; g.stroke();
          g.lineWidth = 4;
          ['#ff5a5a', '#ffd93d', '#5cff8a', '#4fa8ff'].forEach((c, j) => {
            g.globalAlpha = (1 - u) * 0.75; g.strokeStyle = c;
            g.beginPath(); g.arc(r.x, r.y + 4, 70 - j * 5, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
          });
        }
      }
      g.restore();
      for (const [x, y, age] of young) s.fx.drawGlow(g, x, y + 4, 70, '#a9e3ff', (1 - age * 2) * 0.8);
      s.fx.drawGlow(g, d.x, d.y, b.r * 2.4, '#dff4ff', 0.35);
      // the stone: flat, banded slate, tipped a little with its flight
      g.save();
      g.translate(d.x, d.y);
      g.rotate(Math.atan2(b.vy, Math.abs(b.vx) + 1) * 0.5 * Math.sign(b.vx || 1) + Math.sin(s.t * 25) * 0.08);
      const R = b.r * 2.4;
      // a wet sheen streaming off the back of the stone
      g.globalAlpha = 0.6; g.strokeStyle = '#a9e3ff'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const back = -Math.sign(b.vx || 1);
        g.beginPath(); g.moveTo(back * R * 0.8, (i - 1) * R * 0.25); g.lineTo(back * (R * 1.6 + i * 10 + Math.sin(s.t * 30 + i) * 5), (i - 1) * R * 0.35); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#5d6770';
      g.beginPath(); g.ellipse(0, 0, R, R * 0.55, 0, 0, TAU); g.fill();
      keyed(g, '#1c2530', '#8e98a1', 3);
      g.strokeStyle = '#1c4f75'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-R * 0.8, R * 0.15); g.quadraticCurveTo(0, R * 0.35, R * 0.8, R * 0.1); g.stroke();
      g.fillStyle = '#dff4ff'; g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(-R * 0.25, -R * 0.22, R * 0.38, R * 0.12, -0.2, 0, TAU); g.fill();
      g.restore();
      // the ball, always findable: a bright ring exactly on it, drawn last
      g.save();
      g.globalAlpha = 0.95;
      g.beginPath(); g.arc(d.x, d.y, b.r, 0, TAU); keyed(g, '#1c4f75', '#ffffff', 3);
      g.restore();
    },

    trail(b, s) {
      const { fx, C } = s;
      const pw = b.power;
      if (Math.random() < 0.6) fx.emit({ shape: 'smoke', x: b.x - Math.sign(b.vx) * 14, y: Math.min(b.y + 6, C.GROUND_Y - 2), vy: -10, r: 5, r1: 16, life: 0.6, color: '#dff4ff', layer: 'back' });
      fx.emit({ shape: 'dot', x: b.x - Math.sign(b.vx) * 20, y: b.y + fx.rand(-6, 6), vx: -b.vx * 0.15, vy: fx.rand(-80, 0), grav: 700, r: 3, life: 0.45, color: pick(['#a9e3ff', '#2e7fb8']) });
      if (!pw) return;
      const mem = memo(pw, () => ({ hop: pw.hop, rip: [] }));
      // a skip is the flight's own hop counter ticking over
      if (pw.hop !== mem.hop) {
        mem.hop = pw.hop;
        const w = s.depth(b.x, C.GROUND_Y);
        mem.rip.push({ x: w.x, y: w.y, t: s.t });
        if (mem.rip.length > 6) mem.rip.shift();
        fx.burst(b.x, C.GROUND_Y - 4, 9, { shape: 'dot', speed: 240, spread: 1.4, angle: -Math.PI / 2, r: 3.5, grav: 900, life: 0.6, color: pick(['#a9e3ff', '#dff4ff']) });
        fx.stamp(b.x, C.GROUND_Y - 70, pw.hop % 2 ? 'פליק!' : 'פלאק!', { r: 30, color: '#dff4ff', edge: '#1c4f75', life: 0.55, vy: -60 });
        fx.sound([{ k: 'blip', freq: 1100 + pw.hop % 2 * 300, type: 'sine', peak: 0.15, dur: 0.06 }]);
      }
    },

    impact(s, ev) {
      const { fx } = s;
      pop(fx, ev.x, ev.y, '#2e7fb8', '#a9e3ff', { g: 160, R: 340, spin: 1.4 });
      fx.burst(ev.x, ev.y, 30, { shape: 'dot', speed: 360, spread: 2.2, angle: -Math.PI / 2, r: 5, grav: 1000, life: 0.9, color: '#a9e3ff' });
      fx.confetti(ev.x, ev.y, 16, ['#a9e3ff', '#dff4ff', '#2e7fb8', '#1c4f75']);
      fx.ring(ev.x, ev.y, { color: '#dff4ff', r1: 170, life: 0.5, w: 6 });
      fx.ring(ev.x, ev.y, { color: '#2e7fb8', r1: 110, life: 0.4, w: 5 });
      fx.stamp(ev.x, top(ev.y - 70), 'שפלאש!', { r: 58, color: '#dff4ff', edge: '#1c4f75' });
      fx.flash('#a9e3ff', 0.18, 0.18);
      fx.shake(8, 0.35);
    },

    end(s) {
      const { fx } = s;
      const b = s.M.ball;
      fx.ring(b.x, b.y, { r: 4, r1: 70, life: 0.8, w: 4, color: '#dff4ff' });
      fx.ring(b.x, b.y, { r: 4, r1: 44, life: 0.6, w: 4, color: '#2e7fb8' });
      fx.glow(b.x, b.y, 70, '#2e7fb8', { life: 0.9, alpha: 0.6 });
      for (let i = 0; i < fx.n(10); i++) fx.emit({ shape: 'dot', x: b.x + fx.rand(-14, 14), y: b.y, vy: -fx.rand(30, 80), r: 3, life: 0.9, color: '#dff4ff' });
    },
  },

  // ── 17 · wind — the autumn gale ──────────────────────────────────────────
  wind: {
    theme: 'Autumn gale',
    visual: 'pale streamlines bending round the players, tumbling rust and ochre leaves, dust torn off the walker',
    palette: ['#e8fff4', '#b5471f', '#d9a02b', '#c2331f', '#7a4a26', '#6f8f7e', '#bca789'],
    doc: {
      fantasy: 'An autumn storm blows through the stadium, straight at the opponent\'s goal: leaves everywhere and the opponent leaning into it.',
      purpose: 'The first power that pushes the ball on its own: stage 17 teaches playing with and against a force — every loose ball drifts toward one goal.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is driven at the goal you attack on a lofted line, and for 4 seconds a wind of 0.42× ball gravity (about 500 px/s²) pushes every loose ball toward that goal while the opponent walks at 0.85× speed.',
      bot: 'Arms on attack (arm: attack — ball ahead of it, in the opponent half) and plays the striker style.',
      sequence: {
        anticipation: 'While armed six big keylined leaves whirl round the champion in a pale sage glow, a curling gust spiral turns beside it and short gust lines flick toward the goal it attacks.',
        activation: 'The cut-in: a giant cartoon storm cloud with puffed cheeks blows a gust across the lower screen, streamlines and leaves pouring out of its mouth. Then the gust: a pale sunburst, three gust beams fired toward the goal, 20 streaks, 26 tumbling leaves, leaf confetti, a wall of 28 leaves blown in from the whole upwind edge, a sunburst, a big ochre "סופה!" stamp and a "ווווש!" riding the gust; a sage screen-edge glow and a whoosh.',
        main: 'For 4s: a puffed-cheek storm cloud hangs upwind under the roof blowing gust lines out of its mouth, thick keylined streamlines scroll across the whole pitch in the real wind direction (the effect\'s ax), bending around the opponent; big keylined cartoon curl-swirls ride the gale across the stadium with lit heads; big rust, ochre and red leaves tumble across, in front of and behind the players; lit pressure arcs press on the opponent\'s upwind side; dust is torn off his feet whenever he walks into it.',
        impact: 'The gale takes hold on the opponent: a grey-green ring, a leaf burst, a 🍂 glyph and a faint storm grade.',
        aftermath: 'The wind drops: the last leaves flutter down to the grass, a pale glow fades on the opponent and the whoosh falls away.',
        cleanup: 'Leaves and dust run out their life within 4s of drifting; streamlines and swirls fade with the effect.',
      },
      layers: 'Cut-in storm cloud, leaves + gust spiral (aura), streamlines + lit curl-swirls (back, under ball and players), lit pressure arcs (front), rays, beams, glows, confetti, stamp, leaves (shard particles), dust smoke, streaks, ring, glyph.',
      camera: 'A sage vignette on firing and a 0.12 grey-green grade for 1s as it lands; no shake — wind is steady, not sudden.',
      hud: 'The engine\'s 🌬️ status pill with its 4s ring over the opponent\'s head.',
      audio: 'Fire: a noise gust over a rising sine whoosh. Impact: a longer gust with a low moan. End: the wind dying away.',
      counterplay: 'The wind is the ball\'s, not yours: keep it on the ground and in your feet, clear it high only if you want it back at your goal — and it only blows for 4s.',
      perf: '~95 particles on firing, ≤3 a frame (two leaves, a dust puff); streamlines are 27 short polylines plus 3 spirals; ≤5 drawGlow a frame; no shadowBlur.',
      helpers: 'pop() (fx.rays + fx.glow), fx.beam, fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(shard/smoke/streak), fx.glyph, fx.tint, fx.sound.',
    },
    sounds: {
      fire: [{ k: 'crowd', dur: 0.9, peak: 0.35 }, { k: 'sweep', from: 300, to: 900, type: 'sine', peak: 0.2, dur: 0.6 }],
      impact: [{ k: 'crowd', dur: 1.4, peak: 0.25 }, { k: 'sweep', from: 500, to: 200, type: 'triangle', peak: 0.12, dur: 1 }],
      end: [{ k: 'sweep', from: 600, to: 150, type: 'sine', peak: 0.15, dur: 0.8 }],
    },

    aura(g, p, s) {
      const hy = s.headY(p), hr = s.headR(p);
      const d0 = s.depth(p.x, hy + 20);
      s.fx.drawGlow(g, d0.x, d0.y, hr + 60, '#e8fff4', 0.4);
      // a curling gust spiral beside the champion
      g.save();
      g.strokeStyle = '#e8fff4'; g.lineWidth = 3; g.lineCap = 'round'; g.globalAlpha = 0.7;
      const sx = d0.x + p.side * (hr + 40), sy = d0.y - 10;
      g.beginPath();
      for (let i = 0; i <= 20; i++) { const a = s.t * 5 + i * 0.45, r = 22 - i; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.7); }
      g.stroke();
      g.restore();
      for (let i = 0; i < 6; i++) {
        const a = s.t * 3 + (i / 6) * TAU;
        const d = s.depth(p.x + Math.cos(a) * (hr + 38), hy + 20 + Math.sin(a) * 48);
        // save/restore per leaf, never setTransform: the renderer's own scale is underneath
        g.save();
        g.translate(d.x, d.y); g.rotate(a * 2); g.scale(1.6, 1.6);
        g.fillStyle = ['#b5471f', '#d9a02b', '#c2331f'][i % 3];
        g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(0, -7, 9, 0); g.quadraticCurveTo(0, 7, -9, 0); g.fill();
        g.strokeStyle = '#3d2412'; g.lineWidth = 1.5; g.stroke();
        g.strokeStyle = '#7a4a26';
        g.beginPath(); g.moveTo(-9, 0); g.lineTo(7, 0); g.stroke();
        g.restore();
      }
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'streak', x: p.x - p.side * 10, y: hy + s.fx.rand(-20, 30), vx: p.side * 340, r: 8, w: 3, life: 0.25, color: '#e8fff4', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 200), y = C.H * 0.68;
      const dir = s.owner.side > 0 ? 1 : -1;
      const puff = 1 + Math.sin(k * 30) * 0.04;
      const R = 58 * puff;
      g.save();
      g.globalAlpha = f;
      // the gust out of its mouth
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const yy = y - 40 + i * 16, off = ((k * 1400 + i * 90) % 600);
        g.strokeStyle = i % 2 ? '#6f8f7e' : '#e8fff4'; g.lineWidth = i % 2 ? 4 : 6;
        g.beginPath();
        for (let n = 0; n <= 8; n++) { const xx = x + dir * (R * 1.3 + off * 0.3 + n * 40); g.lineTo(xx, yy + Math.sin(n * 0.8 + k * 20) * 8 + (i - 2.5) * n * 3); }
        g.stroke();
      }
      // leaves in the gust
      for (let i = 0; i < 7; i++) {
        const u = (k * 1.6 + i / 7) % 1;
        g.save();
        g.translate(x + dir * (R + u * 560), y - 40 + hash(i) * 90 + Math.sin(u * 9) * 20); g.rotate(u * 14);
        g.fillStyle = ['#b5471f', '#d9a02b', '#c2331f', '#7a4a26'][i % 4];
        g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -10, 14, 0); g.quadraticCurveTo(0, 10, -14, 0); g.fill();
        g.restore();
      }
      // the cloud: puffs, a sage keyline, cheeks and a round blowing mouth
      g.fillStyle = '#e8fff4';
      const puffs = [[0, 0, 1], [-0.9, 0.2, 0.7], [0.8, 0.25, 0.65], [-0.4, -0.6, 0.7], [0.4, -0.55, 0.6]];
      g.strokeStyle = '#6f8f7e'; g.lineWidth = 5;
      for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(x + px * R, y + py * R, pr * R, 0, TAU); g.stroke(); }
      for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(x + px * R, y + py * R, pr * R, 0, TAU); g.fill(); }
      g.fillStyle = '#c2331f'; g.globalAlpha = 0.45 * f;
      g.beginPath(); g.arc(x + dir * R * 0.35, y + R * 0.2, R * 0.2, 0, TAU); g.fill();
      g.globalAlpha = f; g.fillStyle = '#7a4a26';
      g.beginPath(); g.arc(x - dir * R * 0.05, y - R * 0.2, 6, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + dir * R * 0.35, y - R * 0.2, 6, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + dir * R * 0.75, y + R * 0.05, R * 0.14 * puff, R * 0.18, 0, 0, TAU); g.fill();
      g.restore();
      s.fx.drawGlow(g, x, y, R * 2.4, '#e8fff4', 0.4 * f);
    },

    fire(s, at) {
      const { fx, side } = s;
      const dir = side > 0 ? 1 : -1;
      pop(fx, at.x, at.y, '#e8fff4', '#6f8f7e', { g: 130, R: 320, spin: 3 });
      for (const o of [-30, 0, 30]) fx.beam(at.x, at.y + o, at.x + dir * 560, at.y + o * 1.6, { color: '#6f8f7e', color2: '#e8fff4', w: 12, life: 0.45 });
      fx.burst(at.x, at.y, 20, { shape: 'streak', speed: 600, spread: 0.5, angle: dir > 0 ? 0 : Math.PI, color: '#e8fff4', life: 0.4, w: 3 });
      fx.burst(at.x, at.y, 26, { shape: 'shard', speed: 340, spread: 1.1, angle: dir > 0 ? 0 : Math.PI, r: 6, spin: 12, grav: 120, life: 1.4, color: pick(['#d9a02b', '#b5471f', '#c2331f']) });
      fx.confetti(at.x, at.y, 18, ['#b5471f', '#d9a02b', '#c2331f', '#7a4a26'], { grav: 160, vx: dir * 200 });
      // a wall of leaves blown in from the whole upwind edge of the stadium at once
      for (let i = 0, n = fx.n(28); i < n; i++) {
        fx.emit({ shape: 'shard', x: dir > 0 ? fx.rand(-40, 60) : s.C.W + fx.rand(-60, 40), y: fx.rand(s.C.CEIL_Y + 20, s.C.GROUND_Y - 10), vx: dir * fx.rand(380, 620), vy: fx.rand(-60, 60), r: fx.rand(10, 16), spin: fx.rand(-10, 10), life: 2.4, color: pick(['#b5471f', '#d9a02b', '#c2331f', '#7a4a26']) });
      }
      fx.rays(at.x, at.y, { color: '#d9a02b', color2: '#e8fff4', n: 10, r1: 380, life: 0.9, spin: -dir * 2, alpha: 0.35 });
      fx.stamp(at.x, top(at.y - 80), 'סופה!', { r: 74, color: '#d9a02b', edge: '#7a4a26' });
      fx.stamp(at.x + dir * 180, top(at.y - 20), 'ווווש!', { r: 38, color: '#e8fff4', edge: '#3d5247', vx: dir * 120, life: 1 });
      fx.vignette('#6f8f7e', 0.5, 1.1);
      fx.shake(4, 0.4);
    },

    back(g, e, s) {
      const C = s.C, q = who(s, e);
      const k = fade(e, 0.4, 0.7), dir = Math.sign(e.ax) || 1;
      const qy = q.y - 40, span = C.GROUND_Y - C.CEIL_Y - 50;
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 9; i++) {
        const base = C.CEIL_Y + 30 + (i / 8) * span;
        for (let j = 0; j < 3; j++) {
          const off = ((s.t * 520 + i * 137 + j * 380) % (C.W + 380)) - 190;
          const x0 = dir > 0 ? off : C.W - off;
          g.beginPath();
          for (let n = 0; n <= 10; n++) {
            const x = x0 + dir * n * 11;
            let y = base + Math.sin(x * 0.015 + s.t * 2 + i) * 5;
            // bend round the player standing in the wind
            const dx = x - q.x, dy = y - qy;
            if (Math.abs(dx) < 90 && Math.abs(dy) < 80) y += (80 - Math.abs(dy)) * 0.6 * (1 - Math.abs(dx) / 90) * (dy < 0 ? -1 : 1);
            g.lineTo(x, y);
          }
          // a sage keyline under the pale line, so the gust reads on a bright stand and a dark one
          g.globalAlpha = 0.5 * k; g.strokeStyle = '#3d5247'; g.lineWidth = 7; g.stroke();
          g.globalAlpha = 0.9 * k; g.strokeStyle = '#e8fff4'; g.lineWidth = 3.5; g.stroke();
        }
      }
      // big cartoon curl-swirls riding the gale across the stadium
      const heads = [];
      for (let i = 0; i < 3; i++) {
        const off = ((s.t * 300 + i * (C.W + 300) / 3) % (C.W + 300)) - 150;
        const x = dir > 0 ? off : C.W - off, y = C.CEIL_Y + 80 + i * 90 + Math.sin(s.t * 2 + i) * 20;
        g.globalAlpha = 0.85 * k;
        g.beginPath();
        for (let n = 0; n <= 22; n++) { const a = -dir * (s.t * 4 + n * 0.5), r = 56 - n * 2.2; g.lineTo(x - dir * n * 6 + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); }
        keyed(g, '#3d5247', i % 2 ? '#bca789' : '#e8fff4', 5);
        heads.push([x, y]);
      }
      // the storm cloud itself hangs upwind under the roof for the whole gale, cheeks puffed, blowing
      const puff = 1 + Math.sin(s.t * 6) * 0.05, R = 46 * puff;
      const cx0 = dir > 0 ? 150 : C.W - 150, cy0 = C.CEIL_Y + 130 + Math.sin(s.t * 1.5) * 6;
      const puffs = [[0, 0, 1], [-0.9, 0.2, 0.7], [0.8, 0.25, 0.65], [-0.4, -0.6, 0.7], [0.4, -0.55, 0.6]];
      g.globalAlpha = 0.95 * k;
      g.strokeStyle = '#3d5247'; g.lineWidth = 6;
      for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(cx0 + px * R, cy0 + py * R, pr * R, 0, TAU); g.stroke(); }
      g.fillStyle = '#e8fff4';
      for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(cx0 + px * R, cy0 + py * R, pr * R, 0, TAU); g.fill(); }
      g.fillStyle = '#c2331f'; g.globalAlpha = 0.5 * k;
      g.beginPath(); g.arc(cx0 + dir * R * 0.35, cy0 + R * 0.2, R * 0.2 * puff, 0, TAU); g.fill();
      g.globalAlpha = 0.95 * k; g.fillStyle = '#7a4a26';
      g.beginPath(); g.arc(cx0 - dir * R * 0.05, cy0 - R * 0.2, 5, 0, TAU); g.fill();
      g.beginPath(); g.arc(cx0 + dir * R * 0.35, cy0 - R * 0.2, 5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(cx0 + dir * R * 0.78, cy0 + R * 0.05, R * 0.13 * puff, R * 0.17, 0, 0, TAU); g.fill();
      // gust lines pouring out of its mouth
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const o = ((s.t * 600 + i * 70) % 260);
        g.globalAlpha = k * (1 - o / 260);
        g.beginPath();
        g.moveTo(cx0 + dir * (R + o), cy0 - 18 + i * 12);
        g.lineTo(cx0 + dir * (R + o + 60), cy0 - 18 + i * 12 + (i - 1.5) * 8);
        keyed(g, '#3d5247', '#e8fff4', 3);
      }
      g.restore();
      for (const [x, y] of heads) s.fx.drawGlow(g, x, y, 50, '#e8fff4', 0.4 * k);
      s.fx.drawGlow(g, cx0, cy0, 130, '#e8fff4', 0.4 * k);
    },

    front(g, e, s) {
      const q = who(s, e);
      const k = fade(e, 0.4, 0.7), dir = Math.sign(e.ax) || 1, hr = s.headR(q);
      const d = s.depth(q.x, s.headY(q) + 14);
      s.fx.drawGlow(g, d.x - dir * (hr + 26), d.y, 50, '#e8fff4', 0.5 * k);
      g.save();
      g.lineWidth = 4;
      // pressure arcs on the side the wind is hitting him from
      for (let i = 0; i < 3; i++) {
        const f = (s.t * 2.5 + i / 3) % 1;
        g.globalAlpha = k * (1 - f) * 0.95;
        const cx0 = d.x - dir * (hr + 30 - f * 16);
        g.beginPath(); g.arc(cx0 + dir * 30, d.y, 36 + i * 12, dir > 0 ? Math.PI * 0.7 : -Math.PI * 0.3, dir > 0 ? Math.PI * 1.3 : Math.PI * 0.3);
        keyed(g, '#3d5247', i % 2 ? '#d9a02b' : '#e8fff4', 4);
      }
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      const dir = Math.sign(e.ax) || 1, q = who(s, e);
      for (let i = 0; i < 2; i++) {
        if (Math.random() > 0.45) continue;
        fx.emit({ shape: 'shard', x: dir > 0 ? -10 : C.W + 10, y: fx.rand(C.CEIL_Y + 20, C.GROUND_Y - 10), vx: dir * fx.rand(260, 420), vy: fx.rand(-40, 50), r: fx.rand(10, 16), spin: fx.rand(-9, 9), life: 3.8, color: pick(['#b5471f', '#d9a02b', '#c2331f', '#7a4a26']), layer: i ? 'front' : 'back' });
      }
      // dust torn off the feet of the one walking into it
      if (q.onGround && Math.abs(q.vx) > 20 && Math.sign(q.vx) === -dir && Math.random() < 0.5) {
        fx.emit({ shape: 'smoke', x: q.x, y: q.y - 3, vx: dir * fx.rand(120, 200), vy: -fx.rand(10, 30), r: 5, r1: 16, life: 0.7, color: '#bca789', layer: 'back' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const dir = ev.e ? Math.sign(ev.e.ax) || 1 : s.side;
      fx.ring(ev.x, ev.y, { color: '#6f8f7e', r1: 130, life: 0.55, w: 5 });
      fx.burst(ev.x, ev.y, 12, { shape: 'shard', speed: 280, spread: 1.4, angle: dir > 0 ? 0 : Math.PI, r: 6, spin: 10, grav: 100, life: 1.3, color: '#b5471f' });
      fx.glyph(ev.x, ev.y - 50, '🍂', { r: 30, vx: dir * 60, spin: 3, life: 1.1 });
      fx.tint('#6f8f7e', 0.12, 1);
    },

    end(s, info) {
      const { fx, C } = s;
      const q = info.e ? who(s, info.e) : s.foe;
      fx.glow(q.x, s.headY(q), 80, '#e8fff4', { life: 0.9, alpha: 0.5 });
      for (let i = 0; i < fx.n(12); i++) {
        fx.emit({ shape: 'shard', x: fx.rand(C.GOAL_W, C.W - C.GOAL_W), y: fx.rand(C.CEIL_Y + 40, C.GROUND_Y - 150), vx: fx.rand(-40, 40), vy: 30, grav: 160, drag: 1, r: 6, spin: fx.rand(-6, 6), life: 2, color: pick(['#b5471f', '#d9a02b', '#7a4a26']), layer: 'back' });
      }
    },
  },

  // ── 18 · strike — lightning ──────────────────────────────────────────────
  strike: {
    theme: 'Thunderstrike',
    visual: 'crackling violet-white lightning arcs round a charged ball, thunder flash from the sky, a blocker locked in jittering sparks',
    palette: ['#7b5cff', '#b8a6ff', '#eef3ff', '#5ad1ff', '#231a4d'],
    doc: {
      fantasy: 'The champion calls the storm down onto the boot: the ball leaves as a ball of lightning, and whoever gets in its way is struck rigid.',
      purpose: 'The fastest shot in the game with a price on blocking it: stage 18 teaches when not to block — a frozen defender is an open goal for the rebound.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball leaves flat at 1.3× power-shot speed; a player who blocks it is frozen (no input at all) for 0.9 seconds.',
      bot: 'Arms on attack (arm: attack — ball ahead of it, in the opponent half) and plays the striker style.',
      sequence: {
        anticipation: 'While armed a big keylined storm cloud hangs above the champion\'s head, forking bolts off it, flickering with violet light, static arcs crackle from the body to the grass, a glowing electric ring pulses at the feet and sparks spit off.',
        activation: 'The cut-in: a giant cartoon lightning bolt slams down the lower screen from a storm cloud, flickering white and violet. Then thunder: three bolts and a thick violet-white thunder beam drop from the sky onto the ball, a violet sunburst, glows, 40 cyan sparks, violet stars, five bolts stabbing down all over the pitch, a static ring on the grass, streaks, confetti and a big "זזזט!" stamp; a violet screen-edge glow, shake 10 and a white flash.',
        main: 'A lightning storm round the ball: a keylined thundercloud follows it under the roof and forks a bolt down onto it every other frame, bolts are left burning from roof to grass behind it, a big violet glow 5× the ball, eight keylined arcs crackling out to 4.8× its radius re-rolled every frame, a violet shell and a white-hot core exactly the ball\'s size drawn last; bolt particles, sparks and small glows spit off behind it.',
        impact: 'On a block or a goal: a thunder beam from the sky, bolts, a violet sunburst and glow, sparks, violet-and-cyan confetti, a "קראק!" stamp, shake 12. The blocker is then locked for 0.9s under a strobing violet sunburst, a bolt from the roof striking his head every frame, a cartoon x-ray flashing white bones in his body, and a lit cage of jittering arcs round body and head, sparks jumping off, a ring pulsing at the feet.',
        aftermath: 'The charge bleeds away: a fading violet glow, a few sparks drop and a dark wisp of smoke rises, with distant thunder.',
        cleanup: 'Bolts live 0.1-0.35s, sparks under half a second, confetti under two; nothing stays.',
      },
      layers: 'Cut-in bolt + cloud, storm cloud + static arcs + lit feet ring (aura), storm glow + crackle arcs + core (ball), lit paralysis cage (front), rays, beams, glows, confetti, stamp, bolt particles, sparks, rings, smoke.',
      camera: 'Shake 10, a violet vignette and a 0.2s white flash on firing; shake 12 and a violet flash on a block or goal.',
      hud: 'The ordinary gold meter; after a block, the engine\'s ⚡ status pill with its 0.9s ring over the frozen blocker.',
      audio: 'Fire: a sharp crack, a falling zap and a rolling low thunder. Impact: a crack with an electric buzz. End: distant thunder.',
      counterplay: 'Do not block it with the head unless the goal is behind you: step out of the line and take the rebound, or counter with a kick — 1.3× is fast but dead flat.',
      perf: '~100 particles on firing, ≤4 a frame in flight, ~75 on impact; ≤5 drawGlow a frame; arcs are strokes; one shadowBlur on the core.',
      helpers: 'thunderbolt(), pop() (fx.rays + fx.glow), fx.beam, fx.bolt, fx.burst, fx.ring, fx.confetti, fx.stamp, fx.vignette, fx.drawGlow, fx.emit(sq/star/smoke), fx.flash, fx.shake, jag().',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 3200, q: 0.6, peak: 0.7, decay: 0.08 }, { k: 'sweep', from: 4000, to: 800, type: 'sawtooth', peak: 0.2, dur: 0.08 }, { k: 'thud', freq: 70, q: 0.5, peak: 0.9, decay: 0.9, t: 0.05 }],
      impact: [{ k: 'thud', freq: 2800, q: 0.7, peak: 0.6, decay: 0.12 }, { k: 'blip', freq: 120, type: 'sawtooth', peak: 0.25, dur: 0.5 }],
      end: [{ k: 'thud', freq: 60, q: 0.4, peak: 0.5, decay: 1.2 }],
    },

    aura(g, p, s) {
      const f = s.depth(p.x, p.y), C = s.C;
      const h = s.depth(p.x, s.headY(p)), hr = s.headR(p);
      const seed = Math.floor(s.t * 20) + p.index * 100;
      const cy = h.y - hr - 34, flick = hash(seed) > 0.6;
      s.fx.drawGlow(g, f.x, f.y + 2, 40, '#7b5cff', 0.7);
      if (flick) s.fx.drawGlow(g, h.x, cy, 50, '#b8a6ff', 0.9);
      g.save();
      // the storm cloud over the head
      const puffs = [[-26, 3, 18], [0, -6, 23], [26, 3, 18], [0, 9, 18]];
      g.globalAlpha = 0.95; g.strokeStyle = flick ? '#eef3ff' : '#7b5cff'; g.lineWidth = 3;
      for (const [dx, dy, r] of puffs) { g.beginPath(); g.arc(h.x + dx, cy - 8 + dy, r, 0, TAU); g.stroke(); }
      g.fillStyle = '#231a4d';
      for (const [dx, dy, r] of puffs) { g.beginPath(); g.arc(h.x + dx, cy - 8 + dy, r, 0, TAU); g.fill(); }
      if (flick) {
        g.strokeStyle = '#eef3ff'; g.lineWidth = 3;
        jag(g, h.x + 6, cy + 12, h.x + p.side * (hr + 14), h.y - hr * 0.2, seed, 6, 4);
        jag(g, h.x - 10, cy + 12, h.x - p.side * (hr + 20), h.y + hr, seed + 3, 6, 5);
      }
      g.globalAlpha = 0.5 + Math.sin(s.t * 18) * 0.3;
      g.strokeStyle = '#7b5cff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(f.x, f.y + 2, 30, 6, 0, 0, TAU); g.stroke();
      g.globalAlpha = 0.9; g.strokeStyle = '#b8a6ff'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const sd = i % 2 ? 1 : -1;
        jag(g, f.x + sd * 10, f.y - C.BODY_H * (0.3 + hash(seed + i) * 0.6), f.x + sd * (18 + hash(seed + i * 5) * 18), f.y + 2, seed + i * 13, 5, 4);
      }
      g.restore();
      if (Math.random() < 0.35) s.fx.emit({ shape: 'sq', x: p.x + s.fx.rand(-16, 16), y: p.y - s.fx.rand(0, 26), vx: s.fx.rand(-80, 80), vy: -s.fx.rand(40, 120), grav: 500, r: 3, life: 0.3, color: '#5ad1ff' });
    },

    cutin(g, s, k) {
      const f = cf(k), C = s.C, x = cx(s, 200);
      const on = k > 0.08 && (k < 0.3 || Math.sin(k * 70) > -0.3);
      const y0 = C.H * 0.45, h = C.H * 0.55;
      g.save();
      g.globalAlpha = f;
      // the storm cloud under the band, the bolt out of it
      g.fillStyle = '#231a4d';
      for (const [dx, dy, r] of [[-90, 0, 50], [-30, -14, 62], [40, -8, 56], [100, 4, 44]]) { g.beginPath(); g.arc(x + dx, y0 + dy, r, 0, TAU); g.fill(); }
      if (on) {
        const drop = ease((k - 0.08) / 0.12);
        g.save();
        g.beginPath(); g.rect(0, y0, C.W, h * drop); g.clip();
        thunderbolt(g, x, y0, h, 110);
        g.fillStyle = '#eef3ff'; g.fill();
        g.strokeStyle = '#7b5cff'; g.lineWidth = 8; g.lineJoin = 'round'; g.stroke();
        g.restore();
      }
      g.strokeStyle = '#b8a6ff'; g.lineWidth = 3;
      jag(g, x - 60, y0 + 20, x - 180, y0 + 110, Math.floor(k * 20), 14, 5);
      jag(g, x + 70, y0 + 20, x + 190, y0 + 90, Math.floor(k * 20) + 9, 14, 5);
      g.restore();
      s.fx.drawGlow(g, x, y0 + h * 0.5, 200, '#7b5cff', (on ? 0.9 : 0.4) * f);
      s.fx.drawGlow(g, x, y0, 110, '#b8a6ff', 0.6 * f);
    },

    fire(s, at) {
      const { fx, C } = s;
      fx.beam(at.x, C.CEIL_Y, at.x, at.y, { color: '#7b5cff', color2: '#eef3ff', w: 30, life: 0.35 });
      fx.bolt(at.x + fx.rand(-30, 30), C.CEIL_Y, at.x, at.y, { color: '#eef3ff', w: 6, life: 0.25, blend: 'lighter' });
      fx.bolt(at.x + fx.rand(-90, -40), C.CEIL_Y, at.x, at.y, { color: '#7b5cff', w: 4, life: 0.2 });
      fx.bolt(at.x + fx.rand(40, 90), C.CEIL_Y, at.x, at.y, { color: '#b8a6ff', w: 3, life: 0.18 });
      pop(fx, at.x, at.y, '#b8a6ff', '#7b5cff', { g: 160, R: 360, spin: 2 });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 18, r1: 54, life: 0.2, color: '#eef3ff', color2: '#b8a6ff', blend: 'lighter' });
      fx.ring(at.x, at.y, { color: '#b8a6ff', r1: 170, life: 0.4, w: 6 });
      fx.burst(at.x, at.y, 40, { shape: 'sq', speed: 440, r: 3.5, grav: 600, life: 0.45, color: '#5ad1ff' });
      fx.burst(at.x, at.y, 12, { shape: 'star', speed: 260, r: 5, spin: 10, life: 0.4, color: '#b8a6ff', blend: 'lighter' });
      // the whole sky answers: bolts stabbing down all over the pitch, and a static ring on the grass
      for (let i = 0; i < 5; i++) {
        const x = C.GOAL_W + Math.random() * (C.W - C.GOAL_W * 2);
        fx.bolt(x, C.CEIL_Y, x + fx.rand(-60, 60), C.GROUND_Y, { color: i % 2 ? '#b8a6ff' : '#eef3ff', w: 4, life: 0.2 + i * 0.05, blend: 'lighter' });
      }
      fx.ring(at.x, C.GROUND_Y, { color: '#5ad1ff', r1: 340, life: 0.6, w: 8 });
      fx.burst(at.x, at.y, 20, { shape: 'streak', speed: 700, color: '#eef3ff', life: 0.3, w: 3 });
      fx.confetti(at.x, at.y, 16, ['#7b5cff', '#5ad1ff', '#b8a6ff', '#eef3ff']);
      fx.stamp(at.x, top(at.y - 90), 'זזזט!', { r: 76, color: '#5ad1ff', edge: '#231a4d' });
      fx.vignette('#7b5cff', 0.6, 0.9);
      fx.shake(10, 0.35);
      fx.flash('#eef3ff', 0.26, 0.2);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y), r = b.r;
      const seed = Math.floor(s.t * 30), C = s.C;
      const flick = hash(seed * 1.7) > 0.5;
      // the storm rides above the shot: a thundercloud under the roof following the ball, and a
      // bolt forking down out of it onto the ball every other frame
      g.save();
      const cy = C.CEIL_Y + 26;
      g.globalAlpha = 0.9; g.fillStyle = '#231a4d'; g.strokeStyle = '#7b5cff'; g.lineWidth = 3;
      const cl = [[-110, 6, 30], [-60, -6, 40], [0, -10, 46], [60, -4, 40], [115, 6, 30], [-20, 12, 34], [40, 14, 32]];
      for (const [dx, dy, cr] of cl) { g.beginPath(); g.arc(d.x + dx, cy + dy, cr, 0, TAU); g.stroke(); }
      for (const [dx, dy, cr] of cl) { g.beginPath(); g.arc(d.x + dx, cy + dy, cr, 0, TAU); g.fill(); }
      if (flick) {
        g.globalAlpha = 1; g.lineJoin = 'round';
        g.beginPath();
        const x1 = d.x + (hash(seed) - 0.5) * 120, n = 8;
        g.moveTo(x1, cy + 20);
        for (let i = 1; i < n; i++) g.lineTo(x1 + (d.x - x1) * (i / n) + (hash(seed + i * 2.3) - 0.5) * 36, cy + 20 + (d.y - r - cy - 20) * (i / n));
        g.lineTo(d.x, d.y - r);
        keyed(g, '#7b5cff', '#eef3ff', 3);
      }
      g.restore();
      s.fx.drawGlow(g, d.x, cy, 150, '#7b5cff', flick ? 0.8 : 0.35);
      s.fx.drawGlow(g, d.x, d.y, r * 5, '#7b5cff', 0.85);
      s.fx.drawGlow(g, d.x, d.y, r * 2.4, '#5ad1ff', 0.7);
      g.save();
      g.translate(d.x, d.y);
      // eight arcs crackling out round it — the storm the ball carries
      g.lineJoin = 'round';
      for (let i = 0; i < 8; i++) {
        const a0 = hash(seed + i * 3) * TAU, a1 = a0 + 0.6 + hash(seed + i) * 1.4;
        const R = r * (2.4 + hash(seed + i * 9) * 2.4);
        g.beginPath();
        const x0 = Math.cos(a0) * (r + 2), y0 = Math.sin(a0) * (r + 2), x2 = Math.cos(a1) * R, y2 = Math.sin(a1) * R;
        g.moveTo(x0, y0);
        for (let j = 1; j < 5; j++) g.lineTo(x0 + (x2 - x0) * j / 5 + (hash(seed + i * 17 + j) - 0.5) * 14, y0 + (y2 - y0) * j / 5 + (hash(seed + i * 11 + j) - 0.5) * 14);
        g.lineTo(x2, y2);
        keyed(g, '#231a4d', i % 3 === 0 ? '#5ad1ff' : i % 3 === 1 ? '#b8a6ff' : '#eef3ff', 2.5);
      }
      // the violet shell, then the white-hot core — same size as the ball, so it reads as the ball
      g.globalAlpha = 0.5; g.fillStyle = '#231a4d';
      g.beginPath(); g.arc(0, 0, r + 8, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.shadowColor = '#7b5cff'; g.shadowBlur = 18;
      g.fillStyle = '#7b5cff';
      g.beginPath(); g.arc(0, 0, r + 3, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#eef3ff';
      g.beginPath(); g.arc(0, 0, r - 1, 0, TAU); g.fill();
      g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const dir = Math.sign(b.vx) || 1;
      if (Math.random() < 0.6) fx.bolt(b.x, b.y, b.x - dir * fx.rand(40, 80), b.y + fx.rand(-34, 34), { color: '#b8a6ff', w: 2.5, life: 0.1, blend: 'lighter' });
      fx.emit({ shape: 'sq', x: b.x - dir * 10, y: b.y + fx.rand(-8, 8), vx: -b.vx * 0.15, vy: fx.rand(-100, 100), r: 3, life: 0.22, color: '#5ad1ff' });
      if (Math.random() < 0.3) fx.glow(b.x - dir * 30, b.y, 30, '#7b5cff', { life: 0.25, alpha: 0.6 });
      // now and then a bolt left burning in the air behind it, from the roof to the grass
      if (Math.random() < 0.08) { const x = b.x - dir * fx.rand(40, 120); fx.bolt(x, s.C.CEIL_Y + 30, x + fx.rand(-40, 40), s.C.GROUND_Y, { color: '#b8a6ff', w: 3, life: 0.16, blend: 'lighter' }); }
    },

    impact(s, ev) {
      const { fx, C } = s;
      if (ev.kind === 'land') {
        // the paralysis taking hold on the blocker
        fx.ring(ev.x, ev.y, { color: '#5ad1ff', r: 60, r1: 20, life: 0.35, w: 5, layer: 'front' });
        fx.glow(ev.x, ev.y, 70, '#5ad1ff', { life: 0.5 });
        fx.burst(ev.x, ev.y, 12, { shape: 'sq', speed: 220, r: 3, life: 0.35, color: '#b8a6ff' });
        return;
      }
      fx.beam(ev.x + fx.rand(-20, 20), C.CEIL_Y, ev.x, ev.y, { color: '#7b5cff', color2: '#eef3ff', w: 26, life: 0.3 });
      fx.bolt(ev.x + fx.rand(-40, 40), C.CEIL_Y, ev.x, ev.y, { color: '#eef3ff', w: 6, life: 0.22, blend: 'lighter' });
      fx.bolt(ev.x, ev.y, ev.x + fx.rand(-100, 100), ev.y + fx.rand(-70, 70), { color: '#7b5cff', w: 3, life: 0.18 });
      pop(fx, ev.x, ev.y, '#7b5cff', '#5ad1ff', { g: 170, R: 380, spin: -2 });
      fx.ring(ev.x, ev.y, { color: '#7b5cff', r1: 190, life: 0.5, w: 8 });
      fx.burst(ev.x, ev.y, 30, { shape: 'sq', speed: 500, r: 3.5, grav: 700, life: 0.5, color: '#5ad1ff' });
      fx.confetti(ev.x, ev.y, 20, ['#7b5cff', '#5ad1ff', '#b8a6ff', '#eef3ff']);
      fx.stamp(ev.x, top(ev.y - 80), 'קראק!', { r: 62, color: '#eef3ff', edge: '#231a4d' });
      fx.shake(12, 0.4);
      fx.flash('#7b5cff', 0.24, 0.2);
    },

    // The paralysed blocker: a cage of arcs round body and head, re-rolled every frame.
    front(g, e, s) {
      const q = who(s, e), C = s.C;
      const k = fade(e, 0.05, 0.2), hr = s.headR(q);
      const f = s.depth(q.x, q.y), h = s.depth(q.x, s.headY(q));
      const seed = Math.floor(s.t * 30) + e.seq * 50;
      s.fx.drawGlow(g, h.x, h.y, hr * 2.8, '#7b5cff', 0.6 * k);
      s.fx.drawGlow(g, f.x, f.y - C.BODY_H / 2, 50, '#5ad1ff', 0.5 * k);
      const zap = Math.floor(s.t * 24) % 2 === 0;
      wedges(g, h.x, (h.y + f.y) / 2, 30, 210, 14, s.t * 4, '#7b5cff', '#5ad1ff', (zap ? 0.4 : 0.22) * k);
      g.save();
      g.globalAlpha = k;
      g.lineJoin = 'round';
      // the sky keeps striking him: a bolt from the roof onto his head, re-rolled every frame
      g.beginPath();
      {
        const n = 7, x1 = h.x + (hash(seed) - 0.5) * 60, y1 = C.CEIL_Y, y2 = h.y - hr;
        g.moveTo(x1, y1);
        for (let i = 1; i < n; i++) g.lineTo(x1 + (h.x - x1) * (i / n) + (hash(seed + i * 3.7) - 0.5) * 40, y1 + (y2 - y1) * (i / n));
        g.lineTo(h.x, y2);
      }
      g.globalAlpha = k * (zap ? 1 : 0.5);
      keyed(g, '#231a4d', '#eef3ff', 3);
      // the cartoon x-ray: the body flashes dark with white bones in it
      if (zap) {
        const bx = f.x, top0 = f.y - C.BODY_H, bw = C.BODY_W;
        g.globalAlpha = 0.85 * k; g.fillStyle = '#231a4d';
        g.fillRect(bx - bw / 2 - 2, top0, bw + 4, C.BODY_H);
        g.strokeStyle = '#eef3ff'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(bx, top0 + 2); g.lineTo(bx, f.y - 8); g.stroke();
        for (let i = 0; i < 3; i++) { const y = top0 + 5 + i * 5; g.beginPath(); g.moveTo(bx - 10 + i, y); g.lineTo(bx + 10 - i, y); g.stroke(); }
        g.beginPath(); g.moveTo(bx, f.y - 8); g.lineTo(bx - 8, f.y - 1); g.moveTo(bx, f.y - 8); g.lineTo(bx + 8, f.y - 1); g.stroke();
      }
      g.globalAlpha = k;
      g.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const a0 = hash(seed + i) * TAU, a1 = a0 + 0.8 + hash(seed + i * 4) * 1.2;
        g.strokeStyle = i % 2 ? '#eef3ff' : '#b8a6ff';
        jag(g, h.x + Math.cos(a0) * (hr + 4), h.y + Math.sin(a0) * (hr + 4), h.x + Math.cos(a1) * (hr + 20), h.y + Math.sin(a1) * (hr + 20), seed + i * 7, 6, 4);
      }
      g.strokeStyle = '#5ad1ff';
      for (const sd of [-1, 1]) jag(g, f.x + sd * (C.BODY_W / 2 + 4), f.y - C.BODY_H, f.x + sd * (C.BODY_W / 2 + 2), f.y, seed + sd * 11, 5, 4);
      g.globalAlpha = k * (0.5 + 0.5 * Math.sin(s.t * 40));
      g.strokeStyle = '#7b5cff'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(f.x, f.y + 2, 32, 6, 0, 0, TAU); g.stroke();
      g.restore();
    },

    tick(e, s) {
      const q = who(s, e), { fx } = s;
      fx.emit({ shape: 'sq', x: q.x + fx.rand(-18, 18), y: q.y - fx.rand(0, s.C.BODY_H), vx: fx.rand(-120, 120), vy: fx.rand(-120, 40), r: 3, life: 0.2, color: '#5ad1ff' });
      if (Math.random() < 0.3) fx.bolt(q.x, s.headY(q), q.x + fx.rand(-70, 70), s.headY(q) + fx.rand(-60, 20), { color: '#b8a6ff', w: 2, life: 0.08 });
    },

    end(s, info) {
      const { fx } = s;
      const at = info.e ? who(s, info.e) : s.M.ball;
      const y = info.e ? at.y - 20 : at.y;
      fx.glow(at.x, y, 70, '#7b5cff', { life: 0.8, alpha: 0.6 });
      for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'sq', x: at.x + fx.rand(-14, 14), y, vx: fx.rand(-50, 50), vy: -fx.rand(20, 80), grav: 500, r: 3, life: 0.5, color: '#b8a6ff' });
      fx.emit({ shape: 'smoke', x: at.x, y, vy: -30, r: 8, r1: 28, life: 1.1, color: '#231a4d', layer: 'back' });
    },
  },
};
