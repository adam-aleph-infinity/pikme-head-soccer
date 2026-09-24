// Tier 1 — שכונה (stages 1-9) champion VFX. See public/champ-vfx.js for the contract: every
// hook only DRAWS, reading the match it is handed (s.M) and never writing to it.
//
// Every power here is a super move: a big themed tell while armed, its own giant signature in
// the super cut-in, a screen-filling activation, a projectile or pitch transformation lit from
// inside, a huge payoff and an aftermath that fades rather than snaps.

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// 0 → 1 over the first `fin` seconds of an effect, 1 → 0 over its last `fout`: the grow/shrink
// every lingering effect here runs through, so nothing pops in or out.
const envOf = (e, fin, fout) => clamp01(e.t / fin) * clamp01((e.life - e.t) / fout);
const OUTLINE = '#1b1030';
const hashy = (n) => { const v = Math.sin(n * 91.7 + 3.3) * 43758.5453; return v - Math.floor(v); };

// Per-effect memory the VFX keeps for itself (a spring's last landing, a wall's cracks). Keyed
// by the effect record, so it is never written INTO the match and dies with the record.
const SPRINGS = new WeakMap();
const WALLS = new WeakMap();

// ── shared spectacle beats (the look of each is the power's own colours and word) ─────────

// The hit every fire and every big impact opens with: a light blob with a white-hot heart, a
// spinning sunburst, a shock ring and a comic-book word. 5 particles.
function boom(s, x, y, o) {
  const { fx } = s;
  const R = o.R || 160;
  fx.glow(x, y, R, o.c1, { life: o.life || 0.65, alpha: 0.9 });
  fx.glow(x, y, R * 0.4, o.core || '#ffffff', { life: 0.3, alpha: 0.9, layer: 'front' });
  fx.rays(x, y, { color: o.c1, color2: o.c2, r1: o.rays || 340, n: o.n || 14, life: 0.75, spin: o.spin || 1.2 });
  fx.ring(x, y, { color: o.c2, r1: R * 0.95, life: 0.45, w: 8, layer: 'front' });
  if (o.word) fx.stamp(x + (o.dx || 0), Math.max(70, y - (o.up == null ? 95 : o.up)), o.word, { color: o.wc || '#ffe14a', r: o.wr || 56, life: o.wl || 1.1 });
}

// The cut-in signature: the power's theme object, giant, popping in on the champion's end of
// the screen under the name band, lit from behind, fading with the cut-in. `draw` paints it
// round (0, 0) at roughly 1 unit = 1px of a 260px-tall silhouette.
function cutStage(g, s, k, glowCol, draw) {
  const a = clamp01(k / 0.08) * clamp01((1 - k) / 0.3);
  if (a <= 0.01) return;
  const C = s.C, from = s.owner.side > 0 ? -1 : 1;
  const x = C.W / 2 + from * C.W * 0.27, y = C.H * 0.7;
  const sc = k < 0.14 ? 0.3 + (k / 0.14) * 0.95 : k < 0.24 ? 1.25 - ((k - 0.14) / 0.1) * 0.25 : 1 + (k - 0.24) * 0.1;
  s.fx.drawGlow(g, x, y, 200 * sc, glowCol, 0.85 * a);
  g.save();
  g.globalAlpha = a;
  g.translate(x, y); g.scale(sc, sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, a, from, k);
  g.restore();
}

// The ball itself, drawn LAST over every giant projectile: a white keyline exactly on the ball
// and a bright core, so however big the show, the ball is where the eye lands.
function ballCore(g, x, y, r, col) {
  g.save();
  g.globalAlpha = 1;
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, r + 1.5, 0, TAU); g.stroke();
  g.restore();
}

// A soft band of colour along the ground (the scene changing under an effect). ≤0.2 alpha.
function groundBand(g, s, col, alpha, h) {
  const C = s.C;
  const gr = g.createLinearGradient(0, C.GROUND_Y - h, 0, C.H);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, col);
  g.save(); g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(0, C.GROUND_Y - h, C.W, C.H - C.GROUND_Y + h); g.restore();
}

// A flame tongue: a teardrop from (x, y) up to a swaying tip `h` above it.
function tongue(g, x, y, w, h, sway) {
  g.beginPath();
  g.moveTo(x - w, y);
  g.quadraticCurveTo(x - w * 1.1, y - h * 0.55, x + sway, y - h);
  g.quadraticCurveTo(x + w * 1.1, y - h * 0.55, x + w, y);
  g.closePath();
  g.fill();
}

// A coin seen edge-on as it spins: the ellipse narrows with cos(spin), the stamp shows face-on.
function coin(g, x, y, r, spin) {
  const w = Math.abs(Math.cos(spin));
  g.fillStyle = '#b8860b';
  g.beginPath(); g.ellipse(x, y, Math.max(1.5, r * w), r, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffc400';
  g.beginPath(); g.ellipse(x, y, Math.max(0.8, (r - 2) * w), r - 2, 0, 0, TAU); g.fill();
  if (w > 0.55) { g.fillStyle = '#b8860b'; g.fillRect(x - 1, y - r * 0.55, 2, r * 1.1); }
  if (w > 0.92) { g.fillStyle = '#fff3b0'; g.fillRect(x - r * 0.5, y - r * 0.5, 3, 3); }
}

// A steel coil from yTop down to yBot, `w` either side of x, as a zig-zag with a lit edge.
function coil(g, x, yTop, yBot, w, turns, lw = 4) {
  const n = turns * 2;
  g.lineJoin = 'round';
  for (const [col, l, dx] of [['#56636e', lw, 0], ['#b7c3cc', Math.max(2, lw / 2), -1]]) {
    g.strokeStyle = col; g.lineWidth = l;
    g.beginPath(); g.moveTo(x + dx, yTop);
    for (let i = 1; i < n; i++) g.lineTo(x + dx + (i % 2 ? w : -w), yTop + (yBot - yTop) * (i / n));
    g.lineTo(x + dx, yBot);
    g.stroke();
  }
  g.fillStyle = '#56636e';
  g.fillRect(x - w - 3, yBot - 1, w * 2 + 6, 4);
}

// A horseshoe magnet at (x, y), its opening facing `ang`: red pole on one arm, blue on the other.
function horseshoe(g, x, y, r, ang, glow, lw = 8) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.lineCap = 'butt'; g.lineWidth = lw;
  if (glow) { g.shadowColor = '#ff4d6d'; g.shadowBlur = 12; }
  g.strokeStyle = '#ff4d6d';
  g.beginPath(); g.arc(0, 0, r, Math.PI / 2, Math.PI); g.stroke();
  g.beginPath(); g.moveTo(0, r); g.lineTo(r * 1.2, r); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = '#3a6bff';
  g.beginPath(); g.arc(0, 0, r, Math.PI, Math.PI * 1.5); g.stroke();
  g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 1.2, -r); g.stroke();
  g.fillStyle = '#c9ced6';
  g.fillRect(r * 1.2, r - lw / 2, lw * 0.75, lw);
  g.fillRect(r * 1.2, -r - lw / 2, lw * 0.75, lw);
  g.restore();
}
// Where the magnet pulls to — the same point shared/powers.js pulls the ball toward.
const bootPoint = (o, C) => ({ x: o.x + o.side * 40, y: C.GROUND_Y - 22 });

// The tank at the origin (turret centre), barrel toward `side`: hull, turret, barrel, wheels.
function tank(g, side, t) {
  g.strokeStyle = '#c7ccd4'; g.lineWidth = 3;
  g.strokeRect(-26, 14, 52, 14);
  g.beginPath(); g.ellipse(0, 10, 20, 11, 0, Math.PI, 0); g.stroke();
  g.beginPath(); g.moveTo(0, 4); g.lineTo(side * 50, 2); g.lineWidth = 10; g.stroke();
  g.fillStyle = '#2b2f36'; g.fillRect(-26, 14, 52, 14);
  g.fillStyle = '#4b5563'; g.beginPath(); g.ellipse(0, 10, 20, 11, 0, Math.PI, 0); g.fill();
  g.strokeStyle = '#4b5563'; g.lineWidth = 7; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(0, 4); g.lineTo(side * 46, 2); g.stroke();
  g.fillStyle = '#2b2f36'; g.fillRect(side * 46 - 4, -3, 8, 11);
  g.fillStyle = '#7c8591'; g.fillRect(-8, 1, 16, 3);           // hatch
  g.fillStyle = '#1b1e23';
  for (let i = 0; i < 4; i++) {
    const wx = -19 + i * 12.6;
    g.beginPath(); g.arc(wx, 26, 4, 0, TAU); g.fill();
    g.strokeStyle = '#6b7280'; g.lineWidth = 2;
    const a = t * 8 * side + i;
    g.beginPath(); g.moveTo(wx, 26); g.lineTo(wx + Math.cos(a) * 4, 26 + Math.sin(a) * 4); g.stroke();
  }
}

// One earthworm segment with its dark rim; worm eyes on the head.
function wormSeg(g, x, y, r, j, n) {
  g.fillStyle = '#8f3a52'; g.beginPath(); g.arc(x, y, r + 1.5, 0, TAU); g.fill();
  g.fillStyle = j === n - 1 ? '#c2566f' : j === (n >> 1) ? '#b04a63' : j % 2 ? '#f28ca8' : '#e0738f';
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function wormFace(g, x, y, r, dir) {
  for (const o of [-0.45, 0.45]) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + dir * r * 0.25 + o * r, y - r * 0.25, r * 0.36, 0, TAU); g.fill();
    g.fillStyle = OUTLINE; g.beginPath(); g.arc(x + dir * r * 0.35 + o * r, y - r * 0.22, r * 0.17, 0, TAU); g.fill();
  }
  g.strokeStyle = '#8f3a52'; g.lineWidth = Math.max(2, r * 0.14);
  g.beginPath(); g.arc(x + dir * r * 0.2, y + r * 0.2, r * 0.35, 0.3, Math.PI - 0.3); g.stroke();
}

// The two worms' coils round a player's legs: the half of each helix behind the body goes in
// back(), the half in front in front(), so the worms really wrap round rather than overlay.
function worms(g, e, s, front) {
  const q = s.M.players[e.target];
  const d = s.depth(q.x, q.y);
  const grow = envOf(e, 0.4, 0.3);
  const H = 60 * grow;
  const segs = 14;
  for (let w = 0; w < 3; w++) {
    const ph = s.t * 3.2 + w * TAU / 3;
    for (let j = 0; j < segs; j++) {
      const f = j / (segs - 1);
      const a = ph + f * 5.5;
      if ((Math.sin(a) >= 0) !== front) continue;
      const rx = s.C.BODY_W / 2 + 3 + (1 - f) * 4;
      const x = d.x + Math.cos(a) * rx + Math.sin(s.t * 9 + j + w) * 1.4;   // the wriggle
      const y = d.y + 2 - f * H;
      wormSeg(g, x, y, 5.2 - f * 1.2, j, segs);
    }
  }
}

// The wave's crest at world x: where the ball WAS when it passed x, read back off its own sine
// (y0 + amp·sin(w·t)), shifted so the curve always meets the ball where the ball actually is.
function crestAt(b, x) {
  const pw = b.power;
  if (!pw || pw.amp == null || pw.y0 == null) return b.y;
  const sp = Math.abs(b.vx) || 950;
  const off = b.y - (pw.y0 + pw.amp * Math.sin(pw.w * pw.t));
  const t = pw.t - (b.x - x) * pw.dir / sp;
  return pw.y0 + off + pw.amp * Math.sin(pw.w * Math.max(0, t));
}

// ── the pitch-wide show ─────────────────────────────────────────────────────
// '#rrggbb' → 'rgba(…)', for gradients that fade a theme colour to nothing.
function rgba(c, a) {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// n themed things drifting over the whole pitch while a power is on, each on its own seeded
// drift, wrapping round the screen; draw(g, x, y, i, h) paints one. Draw-only, no particles.
// o: vx/vy drift, top/bot band, x0/x1 to keep them to part of the pitch, seed.
function field(g, s, n, o, draw) {
  const C = s.C, top = o.top == null ? 0 : o.top, bot = o.bot == null ? C.GROUND_Y : o.bot;
  const x0 = o.x0 == null ? -60 : o.x0, W = (o.x1 == null ? C.W + 60 : o.x1) - x0, H = bot - top, sd = o.seed || 0;
  for (let i = 0; i < n; i++) {
    const h1 = hashy(i * 1.3 + sd), h2 = hashy(i * 3.7 + sd + 11), h3 = hashy(i * 7.1 + sd + 23);
    const sp = 0.6 + h3 * 0.8;
    const x = (((h1 * W + s.t * (o.vx || 0) * sp) % W) + W) % W + x0;
    const y = (((h2 * H + s.t * (o.vy || 0) * sp) % H) + H) % H + top;
    draw(g, x, y, i, h3);
  }
}

// Anime speed lines streaking across the whole screen against a flat shot's direction.
function speedLines(g, s, dir, cols, k, n = 16) {
  const C = s.C;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const h = hashy(i + 40), y = 24 + h * (C.GROUND_Y - 30);
    const L = 90 + hashy(i + 77) * 220, W = C.W + L + 120;
    const x = (((hashy(i + 5) * W - s.t * (1500 + h * 900) * dir) % W) + W) % W - L;
    g.globalAlpha = k * (0.45 + 0.45 * hashy(i + 9));
    g.strokeStyle = cols[i % cols.length]; g.lineWidth = 3 + (i % 3) * 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke();
  }
  g.restore();
}

// The ARMED beacon each tier-1 champion wears over its own tell: a pillar of the power's light
// from the turf to above the head, a spinning dashed ring on the grass with a ripple running
// out of it, and the power's icon in a diamond badge bobbing high over the head (a diamond, not
// a disc, so it never reads as a ball) — ARMED reads from across the pitch, over the gold glow.
function beacon(g, s, p, c1, c2) {
  const C = s.C;
  const gd = s.depth(p.x, C.GROUND_Y);
  const hd = s.depth(p.x, s.headY(p) - s.headR(p) - 62 + Math.sin(s.t * 4) * 5);
  const pulse = 0.5 + 0.5 * Math.sin(s.t * 7);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(0, hd.y - 30, 0, gd.y);
  gr.addColorStop(0, rgba(c1, 0)); gr.addColorStop(1, rgba(c1, 0.55 + 0.2 * pulse));
  g.fillStyle = gr;
  g.fillRect(gd.x - 34, hd.y - 30, 68, gd.y - hd.y + 30);
  g.fillStyle = rgba(c2, 0.5);
  g.fillRect(gd.x - 5, hd.y, 10, gd.y - hd.y);
  g.globalCompositeOperation = 'source-over';
  // the ring on the turf
  const rx = 66 + pulse * 6;
  g.strokeStyle = OUTLINE; g.lineWidth = 8;
  g.beginPath(); g.ellipse(gd.x, gd.y + 2, rx, 13, 0, 0, TAU); g.stroke();
  g.strokeStyle = c1; g.lineWidth = 4;
  g.setLineDash([16, 10]); g.lineDashOffset = -s.t * 60;
  g.beginPath(); g.ellipse(gd.x, gd.y + 2, rx, 13, 0, 0, TAU); g.stroke();
  g.setLineDash([]);
  const f = (s.t * 1.3) % 1;
  g.globalAlpha = 1 - f; g.strokeStyle = c2; g.lineWidth = 3;
  g.beginPath(); g.ellipse(gd.x, gd.y + 2, rx + f * 70, 13 + f * 12, 0, 0, TAU); g.stroke();
  // sparks spiralling up the pillar
  g.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const u = (s.t * 0.8 + i / 4) % 1, a = s.t * 5 + i * 1.6;
    const x = gd.x + Math.cos(a) * 30, y = gd.y - u * (gd.y - hd.y);
    g.globalAlpha = Math.sin(u * Math.PI);
    g.fillStyle = i % 2 ? c1 : c2;
    g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 4, y); g.lineTo(x, y + 6); g.lineTo(x - 4, y); g.closePath(); g.fill();
  }
  // the badge
  g.globalAlpha = 1;
  s.fx.drawGlow(g, hd.x, hd.y, 46 + pulse * 10, c1, 0.8);
  g.translate(hd.x, hd.y);
  g.fillStyle = OUTLINE; g.strokeStyle = c1; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, -24); g.lineTo(24, 0); g.lineTo(0, 24); g.lineTo(-24, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = c1;
  g.beginPath(); g.moveTo(-8, 28); g.lineTo(8, 28); g.lineTo(0, 38); g.closePath(); g.fill();
  g.font = '20px -apple-system, "Apple Color Emoji", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff'; g.fillText(s.P.icon, 0, 1);
  g.restore();
}

// A row of n flame tongues burning along the turf right across the pitch, `k` tall.
function groundFire(g, s, k, n) {
  const C = s.C, y = s.depth(0, C.GROUND_Y).y + 2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.75 * k;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (C.W / n), h = (22 + 16 * hashy(i) + Math.sin(s.t * 12 + i * 2.3) * 8) * k;
    g.fillStyle = '#ff3d00'; tongue(g, x, y, 12, h, Math.sin(s.t * 8 + i) * 5);
    g.fillStyle = '#ffb627'; tongue(g, x, y, 6, h * 0.55, Math.sin(s.t * 8 + i) * 3);
  }
  g.restore();
}

// n particles thrown in from across the whole screen at once, so an activation or a payoff
// fills the pitch instead of one spot: from 'top' (falling in), 'ground' (rising off the turf)
// or 'air' (anywhere over the pitch); make(x, y, i) returns the particle's own fields.
function sheet(s, n, from, make) {
  const { fx, C } = s;
  for (let i = 0, k = fx.n(n); i < k; i++) {
    const x = ((i + Math.random()) / k) * C.W;
    const y = from === 'top' ? fx.rand(-30, 40) : from === 'ground' ? C.GROUND_Y - fx.rand(0, 8) : fx.rand(50, C.GROUND_Y - 30);
    fx.emit({ x, y, ...make(x, y, i) });
  }
}

export default {
  // ── 1 · cannon — the tank ────────────────────────────────────────────────
  cannon: {
    theme: 'Armoured tank',
    visual: 'gunmetal turret, black-powder smoke, riveted iron shell, muzzle flash',
    palette: ['#4b5563', '#ff8a3d', '#ffe0a3', '#2b2f36'],
    doc: {
      fantasy: 'A tank rolls up behind the champion: the next touch is a round out of its main gun.',
      purpose: 'The plainest shot in the game — dead flat and fast — so stage 1 teaches what a power shot is and that blocking one costs you: the blocker is thrown back across the pitch.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball leaves flat at 1.0× power-shot speed toward the goal you attack.',
      bot: 'Arms on attack (ball ahead of it, in the opponent half) and waits for a touch; stage-1 ladder, so it is slow to arm and slow to reach the ball.',
      sequence: {
        anticipation: 'While armed a tank half again the champion\'s size idles behind them, barrel on the far goal: tracks turning, a red aiming line reaching out of the muzzle, an orange glow pulsing at the muzzle and smoke curling off it. Over it all the armed beacon: a pillar of orange light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head.',
        activation: 'BOOM: in the cut-in a giant tank fires with a muzzle star; on the pitch an orange sunburst, a white-hot light blob, a muzzle-blast beam fired down the shot line, recoil rings, a cone of sparks, rolling black-powder smoke and a "בום!" word; orange edges glow, the screen kicks hard. The blast rolls down the whole pitch: speed streaks everywhere, a smoke wall along the turf and a huge orange shock ring.',
        main: 'A giant artillery shell three ball-widths tall streaks flat behind the ball — gunmetal body, copper band, fins and a flame exhaust — with the ball as its glowing warhead tip, pressure arcs ahead, speed lines, an orange glow on the turf beneath and smoke, sparks and embers pouring off it. The whole screen rushes past in anime speed lines, hot shrapnel sparks blow along, a Mach cone rakes back from the warhead and a scorch line burns along the turf behind it.',
        impact: 'KABOOM: a huge orange sunburst and fireball glow, two shock rings, iron shards, spark streaks, dark smoke, spinning shrapnel confetti and a "קאבום!" word, with the heaviest shake and an orange flash. A mushroom cloud climbs into a rolling cap over a giant slow sunburst, the shock runs out along the turf both ways and shrapnel rains over the whole pitch.',
        aftermath: 'A tall column of dark smoke with glowing embers climbs and drifts for two seconds where the shell ended. A burning crater glows on the turf and hot sparks float up all across the pitch for two seconds.',
        cleanup: 'Smoke, embers and shrapnel run out their life within ~2s; nothing is left on the pitch.',
      },
      layers: 'Tank, aiming line and muzzle glow (aura); cut-in tank with muzzle star; sunburst rays, light blobs, muzzle beam, rings, spark streaks, shards, smoke (fire); shell with exhaust flame, speed lines, pressure arcs and turf glow, then the ball core drawn last (ball); fireball, shards, shrapnel confetti and stamp (impact); smoke column with embers (end).',
      camera: 'Shake 12 and an orange flash, 1s orange vignette and a light orange tint on firing; shake 14, a flash and a vignette on the explosion.',
      hud: 'The ordinary gold meter and armed glow, the engine\'s super cut-in with its tank; no lingering status — the power is the shot.',
      audio: 'Fire: a low boom with a noise body. Impact: a bigger, lower explosion with a metallic crack. End: a soft hiss of settling smoke.',
      counterplay: 'Flat means predictable: stand in the line and take the hit (you lose health and get thrown back), or time a kick for a counter. Jumping over it leaves the goal open.',
      perf: '~75 particles on firing, ~95 on the explosion, ≤4 a frame in flight; 3 drawGlow a frame on the shell, 3 on the aura; no shadowBlur (glow sprites instead). The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.beam, fx.burst, fx.confetti, fx.emit(smoke/shard/streak/star/sq), fx.drawGlow, fx.vignette, fx.shake, fx.flash, fx.tint, s.depth. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 120, q: 0.8, peak: 1, decay: 0.42 }, { k: 'sweep', from: 700, to: 60, type: 'sawtooth', peak: 0.4, dur: 0.3 }],
      impact: [{ k: 'thud', freq: 90, q: 0.7, peak: 1, decay: 0.6 }, { k: 'thud', freq: 2200, q: 4, peak: 0.45, decay: 0.12 }],
      end: [{ k: 'thud', freq: 3000, q: 0.5, peak: 0.12, decay: 0.5 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const bob = Math.sin(s.t * 9) * 1.5;
      const x = d.x - p.side * 40, y = d.y - 44 + bob;
      const pulse = 0.5 + 0.5 * Math.sin(s.t * 7);
      // the aiming line out of the barrel toward the goal it will fire at
      g.save();
      g.strokeStyle = '#ff3b3b'; g.lineWidth = 2; g.globalAlpha = 0.35 + 0.3 * pulse;
      g.setLineDash([10, 8]); g.lineDashOffset = -s.t * 60 * p.side;
      g.beginPath(); g.moveTo(x + p.side * 78, y + 5); g.lineTo(x + p.side * 360, y + 5); g.stroke();
      g.setLineDash([]);
      g.restore();
      beacon(g, s, p, '#ff8a3d', '#ffe0a3');
      s.fx.drawGlow(g, x, y + 24, 90, '#ff8a3d', 0.45);
      s.fx.drawGlow(g, x + p.side * 95, y + 4, 30 + pulse * 18, '#ffe0a3', 0.6 + 0.3 * pulse);
      g.save();
      g.globalAlpha = 0.95;
      g.translate(x, y - 8); g.scale(1.9, 1.9);
      tank(g, p.side, s.t);
      g.restore();
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'smoke', x: x + p.side * 76, y: y + 3, vx: p.side * 10, vy: -30, r: 4, r1: 14, life: 0.8, color: '#6b7280', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#ff8a3d', (g, a, from) => {
        const side = -from;
        g.save(); g.scale(4, 4); tank(g, side, s.t); g.restore();
        // the muzzle star as it fires
        const f = clamp01((k - 0.1) / 0.3);
        if (f > 0 && f < 1) {
          const mx = side * 210, my = 8, R = 30 + f * 70;
          s.fx.drawGlow(g, mx, my, R * 1.6, '#ffe0a3', (1 - f) * a);
          g.fillStyle = '#ff8a3d'; g.globalAlpha = (1 - f) * a;
          g.beginPath();
          for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU, rr = i % 2 ? R * 0.4 : R; g.lineTo(mx + Math.cos(an) * rr, my + Math.sin(an) * rr); }
          g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my, R * 0.3, 0, TAU); g.fill();
        }
      });
    },

    fire(s, at) {
      const { fx, side } = s;
      const ang = side > 0 ? 0 : Math.PI;
      boom(s, at.x, at.y, { c1: '#ff8a3d', c2: '#ffe0a3', R: 170, rays: 380, n: 16, word: 'בום!', wc: '#ffe0a3' });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 24, r1: 70, life: 0.2, color: '#ffffff', color2: '#ff8a3d', blend: 'lighter' });
      fx.beam(at.x, at.y, at.x + side * 340, at.y, { color: '#ff8a3d', color2: '#ffe0a3', w: 30, life: 0.3 });
      fx.ring(at.x, at.y, { color: '#ffe0a3', r1: 130, life: 0.35, w: 6 });
      fx.burst(at.x, at.y, 30, { shape: 'streak', speed: 620, spread: 0.9, angle: ang, color: '#ffd166', life: 0.3, w: 3, blend: 'lighter' });
      fx.burst(at.x - side * 10, at.y, 20, { shape: 'smoke', speed: 130, spread: 1.8, angle: ang + Math.PI, r: 10, r1: 34, life: 1.3, vy: -20, drag: 1.5, color: '#2b2f36', layer: 'back' });
      fx.burst(at.x, at.y, 14, { shape: 'sq', speed: 360, spread: 1.4, angle: ang, grav: 700, r: 4, life: 0.6, color: '#ffe0a3', color2: '#ff8a3d' });
      fx.ring(at.x, at.y, { color: '#ff8a3d', r1: 260, life: 0.6, w: 10, layer: 'front' });
      // the blast rolls down the whole pitch: speed streaks everywhere and a smoke wall behind
      sheet(s, 26, 'air', () => ({ shape: 'streak', vx: side * fx.rand(900, 1500), vy: 0, w: 3, life: 0.35, color: Math.random() < 0.5 ? '#ffe0a3' : '#ff8a3d', blend: 'lighter' }));
      sheet(s, 12, 'ground', () => ({ shape: 'smoke', vx: side * fx.rand(40, 140), vy: -fx.rand(10, 50), r: 12, r1: 44, drag: 1, life: 1.4, color: '#4b5563', layer: 'back' }));
      fx.shake(12, 0.35);
      fx.flash('#ff8a3d', 0.22, 0.18);
      fx.vignette('#ff8a3d', 0.55, 1.1);
      fx.tint('#ff8a3d', 0.08, 1.2);
    },

    ball(g, b, s) {
      const d = s.depth(b.x, b.y);
      const dir = Math.sign(b.vx) || 1;
      const R = b.r * 1.8;
      const C = s.C;
      // the whole screen rushes past: speed lines, and hot shrapnel sparks blown along
      speedLines(g, s, dir, ['#ffe0a3', '#ff8a3d', '#9aa3ad'], 1, 18);
      g.save();
      field(g, s, 16, { vx: -dir * 520, vy: -30, seed: 3 }, (g, x, y, i) => {
        g.fillStyle = i % 3 ? '#ff8a3d' : '#ffe0a3'; g.fillRect(x, y, 5, 3);
      });
      // the scorch line burning along the turf behind the shell
      const gd = s.depth(b.x, C.GROUND_Y);
      const sg = g.createLinearGradient(gd.x, 0, gd.x - dir * 460, 0);
      sg.addColorStop(0, 'rgba(255,138,61,0.85)'); sg.addColorStop(1, 'rgba(255,138,61,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = sg;
      g.fillRect(Math.min(gd.x, gd.x - dir * 460), gd.y - 5, 460, 10);
      g.globalCompositeOperation = 'source-over';
      // the Mach cone: two shock lines raking back from the warhead, cream over a dark edge
      g.lineCap = 'round';
      for (const [col, lw] of [[OUTLINE, 7], ['#ffe0a3', 3]]) {
        g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = 0.85;
        for (const sy of [-1, 1]) {
          g.beginPath(); g.moveTo(d.x + dir * (b.r + 6), d.y + sy * 4);
          g.quadraticCurveTo(d.x - dir * 60, d.y + sy * 44, d.x - dir * 190, d.y + sy * 92); g.stroke();
        }
      }
      g.restore();
      s.fx.drawGlow(g, gd.x, gd.y, 150, '#ff8a3d', 0.45);
      s.fx.drawGlow(g, d.x - dir * R * 2.2, d.y, R * 3.2, '#ff8a3d', 0.55);
      g.save();
      g.translate(d.x, d.y); g.scale(dir, 1);
      // speed lines over and under the shell
      g.strokeStyle = '#ffe0a3'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const k = (s.t * 5 + i * 0.27) % 1, y = (i % 2 ? -1 : 1) * (R + 6 + i * 4);
        g.globalAlpha = (1 - k) * 0.7;
        g.beginPath(); g.moveTo(-R * 1.5 - k * 90, y); g.lineTo(-R * 1.5 - k * 90 - 50, y); g.stroke();
      }
      // pressure arcs pushed ahead
      for (let i = 0; i < 3; i++) {
        const k = ((s.t * 6 + i / 3) % 1);
        g.globalAlpha = (1 - k) * 0.7;
        g.beginPath(); g.arc(b.r + 4 + k * 16, 0, R + k * 12, -0.9, 0.9); g.stroke();
      }
      // the exhaust flame roaring out of the tail
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.9;
      const tail = -R * 3.4, L = R * 2.2 + Math.sin(s.t * 40) * 6;
      g.fillStyle = '#ff8a3d';
      g.beginPath(); g.moveTo(tail, -R * 0.7); g.quadraticCurveTo(tail - L * 0.6, -R * 0.5, tail - L, Math.sin(s.t * 23) * 4); g.quadraticCurveTo(tail - L * 0.6, R * 0.5, tail, R * 0.7); g.closePath(); g.fill();
      g.fillStyle = '#ffe0a3';
      g.beginPath(); g.moveTo(tail, -R * 0.35); g.quadraticCurveTo(tail - L * 0.35, 0, tail, R * 0.35); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // the shell body behind the warhead: fins, casing, copper band, highlight, keyline
      g.fillStyle = '#2b2f36';
      g.beginPath(); g.moveTo(tail + 4, -R); g.lineTo(tail - 10, -R * 1.45); g.lineTo(tail + 16, -R); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(tail + 4, R); g.lineTo(tail - 10, R * 1.45); g.lineTo(tail + 16, R); g.closePath(); g.fill();
      g.fillStyle = '#4b5563';
      g.beginPath(); g.moveTo(tail, -R); g.lineTo(-b.r * 0.2, -R); g.quadraticCurveTo(b.r * 0.9, -R * 0.8, b.r * 0.9, 0); g.quadraticCurveTo(b.r * 0.9, R * 0.8, -b.r * 0.2, R); g.lineTo(tail, R); g.closePath(); g.fill();
      g.strokeStyle = OUTLINE; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#c46a2b'; g.fillRect(tail + R * 0.9, -R + 1, 6, R * 2 - 2);
      g.fillStyle = '#9aa3ad'; g.fillRect(tail + 4, -R * 0.62, -tail - b.r * 1.2, 3);
      g.fillStyle = '#9aa3ad';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(tail + R * 1.7 + i * 7, R * 0.55, 1.6, 0, TAU); g.fill(); }
      g.restore();
      // the warhead: the ball, iron hot at the rim with its rivets turning, and its keyline last
      g.save();
      s.fx.drawGlow(g, d.x, d.y, b.r * 2.4, '#ffe0a3', 0.75);
      g.translate(d.x, d.y);
      g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(0, 0, b.r + 3, 0, TAU); g.fill();
      g.fillStyle = '#2b2f36'; g.beginPath(); g.arc(0, 0, b.r, 0, TAU); g.fill();
      g.fillStyle = '#9aa3ad';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + s.t * 14 * dir;
        g.beginPath(); g.arc(Math.cos(a) * b.r * 0.68, Math.sin(a) * b.r * 0.68, 1.6, 0, TAU); g.fill();
      }
      g.restore();
      ballCore(g, d.x, d.y, b.r * 0.45, '#ffe0a3');
      g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, b.r + 4, 0, TAU); g.stroke(); g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const back = -Math.sign(b.vx) || -1;
      fx.emit({ shape: 'smoke', x: b.x + back * 70, y: b.y + fx.rand(-6, 6), vy: -14, r: 7, r1: 24, life: 0.8, color: '#6b7280', layer: 'back' });
      fx.emit({ shape: 'dot', x: b.x + back * 80, y: b.y + fx.rand(-8, 8), vx: back * 120, vy: fx.rand(-60, 60), r: 3, life: 0.35, color: '#ffd166', blend: 'lighter' });
      if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: fx.rand(-80, 80), r: 3, life: 0.3, color: '#ffd166' });
      if (Math.random() < 0.25) fx.glow(b.x + back * 60, b.y, 40, '#ff8a3d', { life: 0.3, alpha: 0.5 });
    },

    impact(s, ev) {
      const { fx } = s;
      boom(s, ev.x, ev.y, { c1: '#ff8a3d', c2: '#ffe0a3', R: 220, rays: 460, n: 18, word: 'קאבום!', wc: '#ff8a3d', wr: 64, up: 110 });
      fx.emit({ shape: 'dot', x: ev.x, y: ev.y, r: 20, r1: 80, life: 0.3, color: '#ffe0a3', color2: '#ff8a3d', blend: 'lighter' });
      fx.ring(ev.x, ev.y, { color: '#ff8a3d', r1: 200, life: 0.6, w: 10 });
      fx.burst(ev.x, ev.y, 14, { shape: 'shard', speed: 480, r: 7, spin: 14, grav: 900, life: 0.9, color: '#4b5563', color2: '#2b2f36' });
      fx.burst(ev.x, ev.y, 14, { shape: 'streak', speed: 700, color: '#ffd166', life: 0.35, w: 3, blend: 'lighter' });
      fx.burst(ev.x, ev.y, 14, { shape: 'smoke', speed: 140, r: 12, r1: 40, drag: 1.6, life: 1.4, vy: -30, color: '#2b2f36', layer: 'back' });
      fx.confetti(ev.x, ev.y, 14, ['#4b5563', '#9aa3ad', '#ff8a3d', '#c46a2b']);
      // the mushroom cloud: a stalk of fire-lit smoke climbing into a rolling cap
      for (let i = 0; i < fx.n(6); i++) {
        fx.emit({ shape: 'smoke', x: ev.x + fx.rand(-10, 10), y: ev.y - i * 6, vy: -90 - i * 22, drag: 0.8, r: 14, r1: 30 + i * 4, life: 1.8, color: i < 3 ? '#c46a2b' : '#2b2f36', layer: 'back' });
      }
      for (let i = 0; i < fx.n(8); i++) {
        const a = -Math.PI / 2 + (i / 7 - 0.5) * 2.6;
        fx.emit({ shape: 'smoke', x: ev.x, y: ev.y - 150, vx: Math.cos(a) * 110, vy: Math.sin(a) * 70 - 60, drag: 1.4, r: 16, r1: 46, life: 1.9, color: '#4b5563', layer: 'back' });
      }
      fx.glow(ev.x, ev.y - 120, 170, '#ff8a3d', { life: 1.2, alpha: 0.6 });
      fx.rays(ev.x, ev.y, { color: '#ff8a3d', color2: '#c46a2b', r1: 700, n: 24, life: 0.9, spin: -0.8, alpha: 0.3 });
      // the shock running out along the turf both ways, and shrapnel raining over the pitch
      for (const sx of [-1, 1]) fx.burst(ev.x, s.C.GROUND_Y - 6, 8, { shape: 'streak', speed: 1000, spread: 0.12, angle: sx > 0 ? 0 : Math.PI, w: 4, life: 0.4, color: '#ffe0a3', blend: 'lighter' });
      sheet(s, 18, 'top', () => ({ shape: 'shard', vx: fx.rand(-60, 60), vy: fx.rand(80, 260), grav: 500, spin: fx.rand(-12, 12), r: 5, life: 1.3, color: '#9aa3ad', color2: '#4b5563' }));
      fx.shake(16, 0.5);
      fx.flash('#ffe0a3', 0.15, 0.16);
      fx.vignette('#ff8a3d', 0.5, 0.9);
    },

    end(s, info) {
      const { fx } = s;
      const b = s.M.ball;
      for (let i = 0; i < fx.n(10); i++) {
        fx.emit({ shape: 'smoke', x: b.x + fx.rand(-20, 20), y: b.y, vy: -45 - i * 9, vx: fx.rand(-14, 14), r: 9, r1: 36, life: 2, color: '#2b2f36', layer: 'back' });
      }
      for (let i = 0; i < fx.n(8); i++) {
        fx.emit({ shape: 'dot', x: b.x + fx.rand(-20, 20), y: b.y, vy: fx.rand(-120, -40), vx: fx.rand(-30, 30), r: 2.5, life: 1.6, color: '#ffd166', blend: 'lighter' });
      }
      fx.glow(b.x, b.y, 80, '#ff8a3d', { life: 1.2, alpha: 0.5 });
      // a burning crater: embers glowing on the turf, and hot sparks floating up all over
      for (let i = 0; i < fx.n(5); i++) fx.glow(b.x + fx.rand(-70, 70), s.C.GROUND_Y - 6, fx.rand(30, 60), i % 2 ? '#ff8a3d' : '#c46a2b', { life: fx.rand(1.6, 2.4), alpha: 0.7 });
      sheet(s, 24, 'ground', () => ({ shape: 'sq', vx: fx.rand(-20, 20), vy: -fx.rand(30, 110), r: 3, life: fx.rand(1.6, 2.6), color: '#ffd166', color2: '#c46a2b', blend: 'lighter' }));
    },
  },

  // ── 2 · tentacles — the earthworms ───────────────────────────────────────
  tentacles: {
    theme: 'Burrowing earthworms',
    visual: 'soil clods erupting from the turf, pink segmented earthworms coiling up the legs, wriggling dirt mounds',
    palette: ['#f28ca8', '#c2566f', '#6b4a2e', '#3d2a1a', '#a07850'],
    doc: {
      fantasy: 'The ground under the opponent turns to wormery: fat pink earthworms burst out of the soil and wind round their legs.',
      purpose: 'The first effect power: it does not score by itself, it takes the opponent\'s jump away for 3 seconds so the struck ball — or the next one — gets over them.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is struck at the goal you attack (1.15× kick power, a lofted line) and the opponent is held for 3s: no jumping, walking at 0.8× speed.',
      bot: 'POWERS.tentacles.arm is \'any\' and at stage 2 the ladder is below the smart bar anyway, so it arms the moment the meter is full; its style is \'brawler\' — it goes for the man to fill the meter.',
      sequence: {
        anticipation: 'While armed two big dirt mounds heave either side of the champion\'s boots and cartoon worms with eyes pop in and out of them, over a pink glow, kicking up soil. Over it all the armed beacon: a pillar of pink light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head.',
        activation: 'In the cut-in a giant smiling earthworm rears out of a mound. On the pitch: a pink-and-brown sunburst, a pink light blob, a clod explosion, a burrow line of dirt fountains racing along the ground to the opponent, dirt-and-worm confetti and a "תולעים!" word; brown edges glow and the screen shakes. Soil geysers burst up all along the ground end to end with a huge brown ring.',
        main: 'A big dirt mound under the opponent with a pink glow; three fat worms spiral up round the legs, half behind the body and half in front; a GIANT worm with eyes arches in and out of the ground beside them; little worms pop out of mounds all along the pitch and the turf goes dark earth-brown. The turf across the whole pitch is torn into a lumpy strip of dark soil, clods tumble out of the air everywhere, worms with eyes pop out of seven mounds along the pitch and a second giant worm arches on the other side.',
        impact: 'On landing the soil erupts at the opponent\'s feet: a fountain of clods, dust, a brown sunburst, worm-and-soil confetti, a pink ring, an "איכס!" word and a shake. A giant pink ring and slow sunburst, a vignette and dirt raining over the whole pitch.',
        aftermath: 'The worms pull back down, the mound collapses in a last spray of clods, and dust hangs over the spot for a second and a half. Every mound on the pitch caves in with a puff of dust and a spray of clods.',
        cleanup: 'Clods fall under gravity and fade within ~1.5s; the mounds and worms are drawn only while the effect lives.',
      },
      layers: 'Mounds, worms and glow (aura); cut-in giant worm; sunburst, glows, clods (sq), burrow line, confetti, smoke (fire); earth-brown ground band, pitch mounds with worm heads, giant arching worm, main mound and back coils (back); front coils (front); clods, dust, rings, stamp (impact/end).',
      camera: 'Shake 7 and a 1s brown vignette on firing, shake 8 on the eruption; no flash — this is a ground effect, not an explosion.',
      hud: 'The engine\'s 🪱 status pill with its 3s ring over the held opponent; nothing else.',
      audio: 'Fire: a low burrowing rumble falling in pitch. Impact: a wet soil thump with a rising squelch. End: a soft dry crumble.',
      counterplay: 'You can still walk (slowly), head and kick: stay goal-side and head it away rather than jumping. It lasts 3s — wait it out before trying a jump.',
      perf: '~75 particles on firing, ~65 on the eruption, ≤3 a frame from tick; ~70 arcs for the coils, ~16 for the giant worm, 4 pitch mounds; ≤3 drawGlow a frame, no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.burst, fx.confetti, fx.emit(sq/smoke/dot), fx.drawGlow, fx.vignette, fx.shake, s.depth, s.C.BODY_W. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 160, to: 55, type: 'triangle', peak: 0.45, dur: 0.32 }, { k: 'thud', freq: 180, q: 0.9, peak: 0.7, decay: 0.25 }],
      impact: [{ k: 'thud', freq: 95, q: 0.6, peak: 0.9, decay: 0.35 }, { k: 'sweep', from: 300, to: 520, type: 'sine', peak: 0.2, dur: 0.2, t: 0.05 }],
      end: [{ k: 'thud', freq: 240, q: 1.4, peak: 0.25, decay: 0.2 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      beacon(g, s, p, '#f28ca8', '#a07850');
      s.fx.drawGlow(g, d.x, d.y - 4, 100, '#f28ca8', 0.5 + 0.15 * Math.sin(s.t * 6));
      g.save();
      for (const k of [-1, 1]) {
        const mx = d.x + k * 44, my = d.y + 2;
        const up = Math.max(0, Math.sin(s.t * 5 + k * 1.7)) * 44;      // how far out of the hole
        const n = 6;
        for (let j = 0; j < n; j++) {
          const f = j / (n - 1);
          wormSeg(g, mx + Math.sin(s.t * 8 + j) * 4 * f, my - 3 - up * f, 8 - j * 0.5, j, n);
        }
        if (up > 10) wormFace(g, mx + Math.sin(s.t * 8 + 5) * 4, my - 3 - up, 6, k);
        // the mound, drawn after the worm so the worm comes up out of it
        g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(mx, my + 1, 28, 13, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#3d2a1a'; g.beginPath(); g.ellipse(mx, my, 25, 11, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#6b4a2e'; g.beginPath(); g.ellipse(mx, my - 1, 17, 6, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#a07850'; g.fillRect(mx - 11, my - 7, 5, 4); g.fillRect(mx + 6, my - 6, 5, 4);
      }
      g.restore();
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'sq', x: d.x + s.fx.rand(-40, 40), y: d.y - 2, vy: -130, vx: s.fx.rand(-40, 40), grav: 700, r: 3, life: 0.45, color: '#6b4a2e', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#f28ca8', (g, a, from) => {
        // the mound
        g.fillStyle = '#3d2a1a'; g.beginPath(); g.ellipse(0, 90, 150, 44, 0, Math.PI, 0); g.fill();
        // the giant worm rearing up in an S
        const n = 16, sw = Math.sin(s.t * 6) * 16;
        for (let j = 0; j < n; j++) {
          const f = j / (n - 1);
          const x = Math.sin(f * 4.2) * 60 * (1 - f * 0.4) + sw * f, y = 80 - f * 220;
          wormSeg(g, x, y, 30 - f * 8, j, n);
        }
        const hx = Math.sin(4.2) * 60 * 0.6 + sw, hy = 80 - 220;
        wormFace(g, hx, hy, 22, -from);
        g.fillStyle = '#6b4a2e'; g.beginPath(); g.ellipse(0, 92, 120, 26, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#a07850';
        for (let i = 0; i < 7; i++) g.fillRect(-100 + i * 30, 72 + (i % 2) * 8, 12, 9);
      });
    },

    fire(s, at) {
      const { fx, C } = s;
      boom(s, at.x, at.y, { c1: '#f28ca8', c2: '#a07850', R: 150, rays: 320, n: 12, word: 'תולעים!', wc: '#f28ca8' });
      fx.burst(at.x, at.y, 26, { shape: 'sq', speed: 340, grav: 800, r: 5, life: 0.8, spin: 8, color: '#6b4a2e', color2: '#3d2a1a' });
      fx.ring(at.x, at.y, { color: '#f28ca8', r1: 110, life: 0.4, w: 6 });
      // the burrow racing under the turf from the champion to the opponent: fountains of dirt
      const a = s.owner.x, b = s.foe.x;
      for (let i = 0, n = fx.n(14); i < n; i++) {
        const f = (i + 0.5) / n;
        fx.emit({ shape: 'sq', x: a + (b - a) * f, y: C.GROUND_Y, vx: fx.rand(-40, 40), vy: -160 - f * 280, grav: 900, r: 5, life: 0.4 + f * 0.5, color: '#a07850', layer: 'back' });
      }
      fx.confetti(at.x, at.y, 18, ['#f28ca8', '#e0738f', '#6b4a2e', '#a07850']);
      fx.burst(at.x, at.y, 10, { shape: 'smoke', speed: 90, r: 8, r1: 26, drag: 2, life: 0.9, color: '#a07850', layer: 'back' });
      // the whole pitch heaves: soil geysers all along the ground
      sheet(s, 28, 'ground', (x, y, i) => ({ shape: 'sq', vx: fx.rand(-60, 60), vy: -fx.rand(240, 520), grav: 1000, spin: 8, r: fx.rand(4, 7), life: 0.9, color: i % 3 ? '#6b4a2e' : '#f28ca8', color2: '#3d2a1a' }));
      fx.ring(at.x, at.y, { color: '#a07850', r1: 240, life: 0.6, w: 9, layer: 'front' });
      fx.shake(9, 0.35);
      fx.vignette('#6b4a2e', 0.5, 1);
    },

    back(g, e, s) {
      const C = s.C;
      const q = s.M.players[e.target];
      const d = s.depth(q.x, C.GROUND_Y);
      const k = envOf(e, 0.25, 0.35);
      groundBand(g, s, '#3d2a1a', 0.2 * k, 70);
      s.fx.drawGlow(g, d.x, d.y - 14, 110 * k + 1, '#f28ca8', 0.5 * k);
      g.save();
      // the turf torn up into a lumpy strip of dark soil right across the pitch
      const g0 = s.depth(0, C.GROUND_Y).y;
      g.globalAlpha = 0.92 * k;
      g.fillStyle = '#3d2a1a';
      g.beginPath(); g.moveTo(0, g0 + 16);
      for (let i = 0; i <= 40; i++) g.lineTo((i / 40) * C.W, g0 - 4 - (i % 2 ? 5 : 0) - Math.sin(i * 1.7 + s.t * 2) * 3);
      g.lineTo(C.W, g0 + 16); g.closePath(); g.fill();
      g.strokeStyle = '#6b4a2e'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#a07850';
      for (let i = 0; i < 26; i++) g.fillRect(hashy(i + 3) * C.W, g0 + 2 + hashy(i + 9) * 9, 5, 3);
      // soil clods tumbling down out of the air everywhere
      field(g, s, 14, { vy: 170, vx: 12, seed: 8, top: 0, bot: C.GROUND_Y }, (g, x, y, i) => {
        g.fillStyle = OUTLINE; g.fillRect(x - 1, y - 1, 10, 9);
        g.fillStyle = i % 4 ? '#a07850' : '#f28ca8'; g.fillRect(x, y, 8, 7);
      });
      g.globalAlpha = 1;
      // worms popping out of mounds all along the pitch, looking round
      for (let i = 0; i < 7; i++) {
        const mx = C.W * (0.07 + i * 0.143);
        if (Math.abs(mx - q.x) < 100) continue;
        const md = s.depth(mx, C.GROUND_Y);
        const up = Math.max(0, Math.sin(s.t * 4 + i * 2.1)) * 34 * k;
        for (let j = 0; j < 5; j++) wormSeg(g, md.x + Math.sin(s.t * 7 + j) * 2 * j, md.y - 2 - up * (j / 4), 7 - j * 0.5, j, 5);
        if (up > 12) wormFace(g, md.x + Math.sin(s.t * 7 + 4) * 8, md.y - 2 - up, 5, i % 2 ? 1 : -1);
        g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(md.x, md.y + 2, 22 * k, 10 * k, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#3d2a1a'; g.beginPath(); g.ellipse(md.x, md.y + 1, 19 * k, 8 * k, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#6b4a2e'; g.beginPath(); g.ellipse(md.x, md.y, 12 * k, 4 * k, 0, Math.PI, 0); g.fill();
      }
      // the GIANT worms arching in and out of the ground either side of the opponent
      const toward = q.x < C.W / 2 ? 1 : -1;
      const cx = d.x + toward * 140, rise = (0.6 + 0.4 * Math.sin(s.t * 2.2)) * k;
      const n = 22;
      let hx = cx, hy = d.y;
      s.fx.drawGlow(g, cx, d.y - 110 * rise, 150 * k + 1, '#f28ca8', 0.55 * k);
      const bx2 = d.x - toward * 110, rise2 = (0.55 + 0.45 * Math.sin(s.t * 2.6 + 2)) * k;
      let h2x = bx2, h2y = d.y;
      for (let j = 0; j < 16; j++) {
        const f = j / 15, a = Math.PI - f * (Math.PI - 0.6);
        h2x = bx2 - Math.cos(a) * 52 * toward; h2y = d.y + 4 - Math.sin(a) * 110 * rise2 + Math.sin(s.t * 10 + j) * 2;
        wormSeg(g, h2x, h2y, 10 - Math.abs(f - 0.5) * 4, j, 16);
      }
      if (rise2 > 0.3) wormFace(g, h2x, h2y, 9, -toward);
      for (let j = 0; j < n; j++) {
        const f = j / (n - 1), a = Math.PI - f * (Math.PI - 0.5);
        hx = cx + Math.cos(a) * 96 * toward; hy = d.y + 4 - Math.sin(a) * 200 * rise + Math.sin(s.t * 9 + j) * 2;
        wormSeg(g, hx, hy, 18 - Math.abs(f - 0.5) * 6, j, n);
      }
      if (rise > 0.3) wormFace(g, hx, hy, 16, toward);
      // the main mound
      g.fillStyle = '#3d2a1a';
      g.beginPath(); g.ellipse(d.x, d.y + 2, 44 * k, 11 * k, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b4a2e';
      g.beginPath(); g.ellipse(d.x, d.y, 36 * k, 14 * k, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#a07850';
      for (let i = 0; i < 7; i++) {
        const cx2 = d.x - 28 * k + i * 9.3 * k;
        g.fillRect(cx2, d.y - 5 * k - Math.abs(Math.sin(s.t * 6 + i * 1.3)) * 5 * k, 5, 4);
      }
      // the hole the giant worm's tail comes out of
      g.fillStyle = '#3d2a1a';
      g.beginPath(); g.ellipse(cx - 96 * toward, d.y + 4, 20 * k, 8 * k, 0, Math.PI, 0); g.fill();
      g.restore();
      worms(g, e, s, false);
    },

    front(g, e, s) { worms(g, e, s, true); },

    tick(e, s) {
      const { fx, C } = s;
      const q = s.M.players[e.target];
      if (Math.abs(q.vx) > 40 && Math.random() < 0.4) {
        fx.emit({ shape: 'sq', x: q.x - Math.sign(q.vx) * 10, y: q.y - 4, vx: -q.vx * 0.3, vy: -140, grav: 900, r: 4, life: 0.45, color: '#6b4a2e' });
      }
      if (Math.random() < 0.12) {
        fx.emit({ shape: 'sq', x: q.x + fx.rand(-18, 18), y: q.y - fx.rand(6, 36), vy: 20, grav: 600, r: 3, life: 0.45, color: '#a07850' });
      }
      if (Math.random() < 0.1) {
        const mx = C.W * (0.14 + Math.floor(Math.random() * 4) * 0.24);
        fx.emit({ shape: 'sq', x: mx + fx.rand(-8, 8), y: C.GROUND_Y - 4, vx: fx.rand(-60, 60), vy: -160, grav: 900, r: 3, life: 0.4, color: '#6b4a2e', layer: 'back' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.e && ev.e.target != null ? s.M.players[ev.e.target] : null;
      const x = q ? q.x : ev.x, y = q ? s.C.GROUND_Y : ev.y;
      boom(s, x, y - 10, { c1: '#a07850', c2: '#f28ca8', R: 130, rays: 260, n: 12, word: 'איכס!', wc: '#f28ca8', up: 150 });
      fx.burst(x, y, 30, { shape: 'sq', speed: 420, spread: 1.6, angle: -Math.PI / 2, grav: 1000, r: 6, spin: 10, life: 0.9, color: '#6b4a2e', color2: '#3d2a1a' });
      fx.burst(x, y - 4, 10, { shape: 'smoke', speed: 100, spread: 1.4, angle: -Math.PI / 2, r: 8, r1: 28, drag: 2, life: 1, color: '#a07850', layer: 'back' });
      fx.confetti(x, y - 10, 16, ['#f28ca8', '#c2566f', '#6b4a2e']);
      fx.ring(x, y, { color: '#a07850', r1: 100, life: 0.45, w: 5 });
      fx.ring(x, y, { color: '#f28ca8', r1: 220, life: 0.6, w: 8, layer: 'front' });
      fx.rays(x, y - 10, { color: '#f28ca8', color2: '#6b4a2e', r1: 560, n: 20, life: 0.8, spin: -0.9, alpha: 0.4 });
      sheet(s, 20, 'top', () => ({ shape: 'sq', vx: fx.rand(-40, 40), vy: fx.rand(60, 200), grav: 700, spin: 6, r: 5, life: 1.2, color: '#6b4a2e', color2: '#3d2a1a' }));
      fx.vignette('#f28ca8', 0.45, 0.9);
      fx.shake(10, 0.35);
    },

    end(s, info) {
      const { fx, C } = s;
      const q = info.e && info.e.target != null ? s.M.players[info.e.target] : s.foe;
      fx.burst(q.x, C.GROUND_Y, 16, { shape: 'sq', speed: 240, spread: 1.4, angle: -Math.PI / 2, grav: 900, r: 4, life: 0.7, color: '#3d2a1a' });
      for (let i = 0; i < fx.n(6); i++) {
        fx.emit({ shape: 'smoke', x: q.x + fx.rand(-30, 30), y: C.GROUND_Y - 8, vy: -20, vx: fx.rand(-20, 20), r: 8, r1: 30, life: 1.5, color: '#a07850', layer: 'back' });
      }
      for (let i = 0; i < fx.n(5); i++) {
        fx.emit({ shape: 'dot', x: q.x + fx.rand(-20, 20), y: C.GROUND_Y - 12, vy: 140, r: 4, life: 0.2, color: '#f28ca8', layer: 'back' });
      }
      fx.glow(q.x, C.GROUND_Y - 10, 70, '#f28ca8', { life: 0.8, alpha: 0.4 });
      // every mound on the pitch caves in with a last puff of dust
      sheet(s, 10, 'ground', () => ({ shape: 'smoke', vy: -fx.rand(15, 40), vx: fx.rand(-20, 20), r: 10, r1: 34, life: 1.8, color: '#6b4a2e', layer: 'back' }));
      sheet(s, 14, 'ground', () => ({ shape: 'sq', vy: -fx.rand(120, 260), vx: fx.rand(-50, 50), grav: 900, r: 4, life: 0.9, color: '#a07850' }));
    },
  },

  // ── 3 · blaze — the charcoal grill ───────────────────────────────────────
  blaze: {
    theme: 'Charcoal grill fire tunnel',
    visual: 'flame hoops lit along the shot\'s path, a grill-marked ember ball, heat shimmer, charcoal smoke, a blocker left burning',
    palette: ['#ff3d00', '#ffb627', '#7a1f00', '#3b3b3b', '#fff1c1', '#2a2a2a'],
    doc: {
      fantasy: 'The champion stands on a lit barbecue; the shot goes out as a glowing coal down a tunnel of fire, and whoever stops it gets grilled.',
      purpose: 'A flat shot like the cannon, but blocking it is no longer free: the blocker burns for 2.5s, so the defender has to choose between the goal and their health.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball flies flat at 1.02× power-shot speed (≈1020px/s). A body that blocks it burns: 0.03 health every 0.25s for 2.5s (9 ticks, 0.27 in all).',
      bot: 'POWERS.blaze.arm is \'attack\', but at stage 3 the ladder is below the smart bar, so it arms as soon as the meter is full and waits for a touch; style \'striker\' — it presses forward.',
      sequence: {
        anticipation: 'While armed a big charcoal grill roars under the champion: a blazing orange light, glowing coals, a black grate, tall flame tongues licking up behind the legs and embers rising. Over it all the armed beacon: a pillar of red light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head.',
        activation: 'In the cut-in a giant kettle barbecue blazes with flames. On the pitch: a red-orange sunburst, a white-hot light blob, a flame-jet beam fired down the shot line, flame rings, fire streaks, a shower of embers, charcoal smoke and an "אש!" word; the screen edges burn red, it flashes and shakes. Flame jets shoot up off the turf end to end and a huge gold ring blasts out.',
        main: 'A huge three-layer fireball (flame streaming five ball-widths behind) roars down a tunnel of big flame hoops fixed along the shot\'s line, each lighting up as it passes; heat shimmer rises, the turf glows under it and the whole pitch warms red; the grill-marked coal ball with a white keyline sits at its head. The turf burns right across the pitch in a row of flame tongues and embers blow everywhere.',
        impact: 'Blocked: a fireball sunburst on the blocker, flame shards, an ember storm, smoke and a "צלוי!" word; they catch light ("חם!") — tall glowing flames behind the body, flames licking the legs, grill marks seared across the torso, sparks on every damage tick. Goal: the same blast in the net. A firestorm: a giant slow sunburst and burning embers raining over the whole pitch; on the blocker a flame-jet burst and a red vignette for the whole burn, with a ring of fire round their feet, low flames along the turf and embers drifting.',
        aftermath: 'Smoke curls off the charred blocker with dying embers when the burn runs out; a shot that ends elsewhere drops its last embers under a fading glow. The turf stays hot: embers smoulder and float up right across the pitch for two seconds.',
        cleanup: 'Embers and smoke fade within ~1.5s; the flames are drawn only while the burn record lives.',
      },
      layers: 'Grill, coals, flames and glow (aura); cut-in kettle grill; sunburst, glows, flame beam, rings, streaks, embers, smoke (fire); red pitch wash, turf glow, flame hoops with glows, three-layer flame, heat shimmer, coal and ball keyline (ball); back flames with glow and front flames with grill marks on the burning body; spark streaks, smoke (tick/end).',
      camera: 'Shake 9, a red flash and a 1s red vignette on firing; shake 12, a flash and a vignette on the burst.',
      hud: 'The engine\'s 🔥 status pill with its 2.5s ring over the burning blocker.',
      audio: 'Fire: a roaring whoosh (noise swell + rising saw). Impact: a deep whoomph with a crackling roar. End: a thin sizzle.',
      counterplay: 'It is flat and a hair faster than the cannon: jump it if the goal is covered, or time a kick to counter it — a counter never burns you. If you must block, block early so you have 2.5s to recover.',
      perf: '~75 particles on firing, ~90 on the burst, ≤4 a frame in flight and ≤3 while burning; ≤6 drawGlow a frame on the shot; no shadowBlur (glow sprites instead). The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.beam, fx.burst, fx.confetti, fx.emit(star/dot/shard/streak/smoke), fx.drawGlow, fx.vignette, fx.shake, fx.flash, s.depth. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'crowd', dur: 0.55, peak: 0.4 }, { k: 'sweep', from: 140, to: 620, type: 'sawtooth', peak: 0.3, dur: 0.3 }],
      impact: [{ k: 'thud', freq: 320, q: 0.5, peak: 0.9, decay: 0.45 }, { k: 'crowd', dur: 0.8, peak: 0.3, t: 0.05 }],
      end: [{ k: 'thud', freq: 4200, q: 0.4, peak: 0.1, decay: 0.7 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const x = d.x, y = d.y + 3;
      const fl = 0.8 + Math.sin(s.t * 11) * 0.2;
      beacon(g, s, p, '#ff3d00', '#ffb627');
      s.fx.drawGlow(g, x, y - 20, 100 * fl, '#ff3d00', 0.55);
      s.fx.drawGlow(g, x, y - 6, 45, '#ffb627', 0.6);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 + Math.sin(s.t * 11) * 0.15;
      g.fillStyle = '#ff3d00';
      g.beginPath(); g.ellipse(x, y, 42, 8, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.85;
      for (let i = 0; i < 9; i++) {
        const fx0 = x - 48 + i * 12, h = 44 + Math.sin(s.t * 13 + i * 2.1) * 12 + (i % 2) * 18 - Math.abs(i - 4) * 4;
        g.fillStyle = '#ff3d00'; tongue(g, fx0, y - 3, 8, h, Math.sin(s.t * 9 + i) * 5);
        g.fillStyle = '#ffb627'; tongue(g, fx0, y - 3, 4, h * 0.6, Math.sin(s.t * 9 + i) * 3);
        g.fillStyle = '#fff1c1'; tongue(g, fx0, y - 3, 2, h * 0.3, 0);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#2a2a2a';
      g.fillRect(x - 44, y - 3, 88, 4);
      for (let i = 0; i < 8; i++) g.fillRect(x - 40 + i * 11.3, y - 6, 3, 9);
      g.fillRect(x - 36, y + 1, 3, 14); g.fillRect(x + 33, y + 1, 3, 14);
      g.restore();
      if (Math.random() < 0.5) {
        s.fx.emit({ shape: 'dot', x: x + s.fx.rand(-36, 36), y: y - 8, vx: s.fx.rand(-15, 15), vy: -90, r: 2.5, life: 0.8, color: '#ffb627', blend: 'lighter', layer: 'back' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#ff3d00', (g) => {
        // flames roaring out of the bowl
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const fx0 = -96 + i * 32, h = 130 + Math.sin(s.t * 12 + i * 1.7) * 30 + (i % 2) * 40;
          g.fillStyle = '#ff3d00'; tongue(g, fx0, -10, 22, h, Math.sin(s.t * 8 + i) * 14);
          g.fillStyle = '#ffb627'; tongue(g, fx0, -10, 11, h * 0.6, Math.sin(s.t * 8 + i) * 8);
          g.fillStyle = '#fff1c1'; tongue(g, fx0, -10, 5, h * 0.3, 0);
        }
        g.globalCompositeOperation = 'source-over';
        // the kettle bowl, grate and legs
        g.fillStyle = '#2a2a2a';
        g.beginPath(); g.arc(0, -10, 120, 0, Math.PI); g.closePath(); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 6; g.stroke();
        g.fillStyle = '#7a1f00'; g.fillRect(-124, -18, 248, 12);
        g.strokeStyle = '#3b3b3b'; g.lineWidth = 8;
        for (const lx of [-70, 0, 70]) { g.beginPath(); g.moveTo(lx * 0.8, 90); g.lineTo(lx * 1.3, 170); g.stroke(); }
        g.fillStyle = '#fff1c1'; g.fillRect(-60, 20, 20, 8); g.fillRect(30, 30, 26, 8);
      });
    },

    fire(s, at) {
      const { fx, side } = s;
      const ang = side > 0 ? 0 : Math.PI;
      boom(s, at.x, at.y, { c1: '#ff3d00', c2: '#ffb627', core: '#fff1c1', R: 175, rays: 380, n: 16, word: 'אש!', wc: '#ffb627' });
      fx.emit({ shape: 'star', x: at.x, y: at.y, r: 22, r1: 60, life: 0.2, color: '#fff1c1', color2: '#ff3d00', blend: 'lighter' });
      fx.beam(at.x, at.y, at.x + side * 320, at.y, { color: '#ff3d00', color2: '#fff1c1', w: 34, life: 0.35 });
      fx.ring(at.x, at.y, { color: '#ff3d00', r1: 130, life: 0.4, w: 8 });
      fx.burst(at.x, at.y, 24, { shape: 'streak', speed: 560, spread: 1, angle: ang, color: '#ffb627', life: 0.3, w: 3, blend: 'lighter' });
      fx.burst(at.x, at.y, 24, { shape: 'dot', speed: 300, r: 3, grav: -150, drag: 1, life: 1, color: '#ffb627', color2: '#ff3d00', blend: 'lighter' });
      fx.burst(at.x - side * 8, at.y, 12, { shape: 'smoke', speed: 90, spread: 1.6, angle: ang + Math.PI, r: 9, r1: 28, vy: -30, drag: 1.5, life: 1.2, color: '#3b3b3b', layer: 'back' });
      // the whole pitch catches: flame jets shoot up off the turf end to end
      sheet(s, 30, 'ground', (x, y, i) => ({ shape: 'shard', vx: fx.rand(-30, 30), vy: -fx.rand(300, 560), rot: -Math.PI / 2, r: fx.rand(8, 13), drag: 1.5, life: 0.6, color: i % 2 ? '#ff3d00' : '#ffb627', color2: '#7a1f00', blend: 'lighter' }));
      fx.ring(at.x, at.y, { color: '#ffb627', r1: 250, life: 0.6, w: 9, layer: 'front' });
      fx.shake(10, 0.35);
      fx.flash('#ff3d00', 0.3, 0.2);
      fx.vignette('#ff3d00', 0.6, 1.1);
    },

    ball(g, b, s) {
      const C = s.C;
      const d = s.depth(b.x, b.y);
      const dir = (b.power && b.power.dir) || Math.sign(b.vx) || 1;
      const r = b.r * 2.1;
      // the whole pitch warms under it, the turf burns end to end and embers blow everywhere
      g.save(); g.globalAlpha = 0.09; g.fillStyle = '#ff3d00'; g.fillRect(0, 0, C.W, C.H);
      groundFire(g, s, 1, 26);
      field(g, s, 22, { vy: -90, vx: -dir * 60, seed: 5 }, (g, x, y, i) => {
        g.fillStyle = i % 3 ? '#ffb627' : '#fff1c1'; g.fillRect(x, y, 4, 4);
      });
      g.restore();
      const gd = s.depth(b.x, C.GROUND_Y);
      s.fx.drawGlow(g, gd.x, gd.y, 130, '#ff3d00', 0.45);
      g.save();
      // the tunnel: hoops fixed in the WORLD every 80px, lit as the shot reaches them and
      // dying behind it — so the tunnel is laid along the path the ball really flew
      const SP = 80, base = Math.floor(b.x / SP) * SP;
      let lit = 0;
      for (let j = -6; j <= 6; j++) {
        const hx = base + j * SP;
        const dist = (b.x - hx) * dir;                      // > 0: behind the ball
        if (dist < -SP || dist > 420) continue;
        const fade = dist < 0 ? 0.3 : 1 - dist / 420;
        const flick = 1 + Math.sin(s.t * 22 + hx) * 0.08;
        const ry = (r * 1.9 + 8) * flick, rx = ry * 0.34;
        const h = s.depth(hx, b.y);
        if (dist >= 0 && lit < 3) { s.fx.drawGlow(g, h.x, h.y, ry * 1.3, '#ff3d00', fade * 0.6); lit++; }
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = fade * 0.9;
        g.strokeStyle = '#ff3d00'; g.lineWidth = 7;
        g.beginPath(); g.ellipse(h.x, h.y, rx, ry, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#ffb627'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(h.x, h.y, rx * 0.75, ry * 0.88, 0, 0, TAU); g.stroke();
        // little flames standing on each hoop
        g.fillStyle = '#ffb627';
        for (let i = -1; i <= 1; i++) tongue(g, h.x + i * rx * 0.6, h.y - ry + 3, 4, 12 + Math.sin(s.t * 18 + i + hx) * 4, 0);
      }
      g.restore();
      s.fx.drawGlow(g, d.x - dir * r, d.y, r * 2.6, '#ff3d00', 0.7);
      g.save();
      g.translate(d.x, d.y); g.scale(dir, 1);
      // the fireball: three layers of flame streaming behind the coal
      g.globalCompositeOperation = 'lighter';
      const L = r * 3.6 + Math.sin(s.t * 30) * 6;
      for (const [col, sc, al] of [['#ff3d00', 1, 0.9], ['#ffb627', 0.68, 0.9], ['#fff1c1', 0.38, 0.8]]) {
        g.globalAlpha = al; g.fillStyle = col;
        g.beginPath();
        g.moveTo(r * 0.3, -r * sc);
        g.quadraticCurveTo(-L * sc * 0.5, -r * 1.2 * sc, -L * sc, Math.sin(s.t * 17) * 6 * sc);
        g.quadraticCurveTo(-L * sc * 0.5, r * 1.2 * sc, r * 0.3, r * sc);
        g.arc(0, 0, r * sc, Math.PI / 2, -Math.PI / 2, true);
        g.closePath(); g.fill();
      }
      // flame licks round the front
      g.fillStyle = '#ff3d00'; g.globalAlpha = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = -1.2 + i * 0.6, rr = r + 4 + Math.sin(s.t * 25 + i * 2) * 4;
        g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 5, 0, TAU); g.fill();
      }
      // heat shimmer rising off it
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#fff1c1'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 0.35 - i * 0.08;
        g.beginPath();
        for (let q = 0; q <= 8; q++) {
          const x = -(q * 8), y = -r - 9 - i * 7 + Math.sin(q * 1.3 + s.t * 16 + i) * 3;
          if (q) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
      g.restore();
      // the coal — the ball: white-hot heart, orange crust, grill marks turning — and its keyline
      g.save();
      g.translate(d.x, d.y);
      const cr = b.r * 1.1;
      g.fillStyle = '#ffb627'; g.beginPath(); g.arc(0, 0, cr, 0, TAU); g.fill();
      g.fillStyle = '#fff1c1'; g.beginPath(); g.arc(-cr * 0.25, -cr * 0.25, cr * 0.5, 0, TAU); g.fill();
      g.rotate(s.t * 12 * dir);
      g.strokeStyle = '#7a1f00'; g.lineWidth = 3;
      for (const o of [-0.4, 0.4]) { g.beginPath(); g.moveTo(-cr * 0.8, o * cr - 0.3 * cr); g.lineTo(cr * 0.8, o * cr + 0.3 * cr); g.stroke(); }
      g.restore();
      g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, cr + 2, 0, TAU); g.stroke(); g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const back = -Math.sign(b.vx) * 30;
      fx.emit({ shape: 'dot', x: b.x + back, y: b.y + fx.rand(-14, 14), vx: -b.vx * 0.05, vy: fx.rand(-160, -50), r: 3, life: 0.6, color: '#ffb627', blend: 'lighter' });
      fx.emit({ shape: 'smoke', x: b.x + back * 2.5, y: b.y, vy: -30, r: 6, r1: 22, life: 0.9, color: '#3b3b3b', layer: 'back' });
      if (Math.random() < 0.5) fx.emit({ shape: 'shard', x: b.x + back, y: b.y, vx: -b.vx * 0.15, vy: fx.rand(-60, 60), r: 6, rot: Math.atan2(0, -b.vx), life: 0.25, color: '#ff3d00', blend: 'lighter' });
      if (Math.random() < 0.2) fx.glow(b.x + back * 2, b.y, 50, '#ff3d00', { life: 0.35, alpha: 0.5 });
    },

    impact(s, ev) {
      const { fx } = s;
      if (ev.kind === 'land') {
        // the blocker catching light
        const q = s.M.players[ev.e.target];
        fx.ring(q.x, q.y - 14, { color: '#ffb627', r1: 80, life: 0.4, w: 6 });
        fx.burst(q.x, q.y - 14, 18, { shape: 'dot', speed: 180, r: 3, grav: -140, life: 0.8, color: '#ffb627', blend: 'lighter' });
        fx.glow(q.x, q.y - 20, 90, '#ff3d00', { life: 0.6, alpha: 0.7 });
        fx.stamp(q.x, Math.max(70, s.headY(q) - s.headR(q) - 40), 'חם!', { color: '#ff3d00', r: 50, life: 1 });
        fx.burst(q.x, q.y - 10, 16, { shape: 'shard', speed: 380, spread: 1.4, angle: -Math.PI / 2, r: 10, drag: 1.5, life: 0.5, color: '#ff3d00', color2: '#ffb627', blend: 'lighter' });
        fx.vignette('#ff3d00', 0.45, 2.5);
        return;
      }
      boom(s, ev.x, ev.y, { c1: '#ff3d00', c2: '#ffb627', core: '#fff1c1', R: 210, rays: 440, n: 18, word: 'צלוי!', wc: '#ffb627', wr: 62, up: 110 });
      fx.emit({ shape: 'dot', x: ev.x, y: ev.y, r: 18, r1: 76, life: 0.32, color: '#fff1c1', color2: '#ff3d00', blend: 'lighter' });
      fx.ring(ev.x, ev.y, { color: '#ff3d00', r1: 180, life: 0.55, w: 10 });
      fx.burst(ev.x, ev.y, 20, { shape: 'shard', speed: 440, r: 7, spin: 12, grav: -200, life: 0.6, color: '#ff3d00', blend: 'lighter' });
      fx.burst(ev.x, ev.y, 30, { shape: 'dot', speed: 360, r: 3, grav: 300, life: 1.1, color: '#ffb627', color2: '#7a1f00' });
      fx.burst(ev.x, ev.y, 12, { shape: 'smoke', speed: 120, r: 10, r1: 34, drag: 1.6, vy: -40, life: 1.3, color: '#3b3b3b', layer: 'back' });
      fx.confetti(ev.x, ev.y, 12, ['#ff3d00', '#ffb627', '#7a1f00', '#2a2a2a']);
      fx.rays(ev.x, ev.y, { color: '#ff3d00', color2: '#fff1c1', r1: 680, n: 22, life: 0.9, spin: -1, alpha: 0.4 });
      // a firestorm: burning embers rain down over the whole pitch
      sheet(s, 26, 'top', (x, y, i) => ({ shape: 'dot', vx: fx.rand(-40, 40), vy: fx.rand(120, 300), grav: 200, r: fx.rand(2.5, 4.5), life: 1.4, color: i % 2 ? '#ffb627' : '#ff3d00', color2: '#7a1f00', blend: 'lighter' }));
      fx.shake(13, 0.45);
      fx.flash('#ff3d00', 0.28, 0.2);
      fx.vignette('#ff3d00', 0.5, 0.9);
    },

    // The burn: flames behind the body (back) and in front of the legs (front), flaring on the
    // tick the sim takes health — `since` is how long ago that was, read off e.next/e.every.
    back(g, e, s) {
      const q = s.M.players[e.target];
      const d = s.depth(q.x, q.y);
      const k = envOf(e, 0.15, 0.4);
      const since = e.t - (e.next - e.every);
      const flare = 1 + 0.5 * clamp01(1 - since / 0.1);
      s.fx.drawGlow(g, d.x, d.y - 30, 110 * flare * k + 1, '#ff3d00', 0.6 * k);
      // the pitch smoulders round the burning blocker: low flames along the turf and embers
      groundFire(g, s, 0.55 * k, 20);
      g.save();
      g.globalAlpha = k;
      field(g, s, 14, { vy: -70, vx: 10, seed: 17 }, (g, x, y, i) => {
        g.fillStyle = i % 2 ? '#ffb627' : '#ff3d00'; g.fillRect(x, y, 4, 4);
      });
      // a ring of fire on the ground round their feet
      const gy = s.depth(q.x, s.C.GROUND_Y).y;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + s.t * 0.8, fxr = d.x + Math.cos(a) * 58, fy = gy + Math.sin(a) * 10;
        const h = (26 + Math.sin(s.t * 15 + i * 1.7) * 8) * flare * k;
        g.fillStyle = '#ff3d00'; tongue(g, fxr, fy, 7, h, Math.sin(s.t * 9 + i) * 4);
        g.fillStyle = '#fff1c1'; tongue(g, fxr, fy, 2.5, h * 0.4, 0);
      }
      g.restore();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85 * k;
      for (let i = 0; i < 5; i++) {
        const x = d.x - 20 + i * 10, h = (46 + Math.sin(s.t * 14 + i * 1.9) * 10 + (i % 2) * 12) * flare * k;
        g.fillStyle = '#ff3d00'; tongue(g, x, d.y - 2, 8, h, Math.sin(s.t * 10 + i) * 5);
        g.fillStyle = '#ffb627'; tongue(g, x, d.y - 2, 4, h * 0.55, Math.sin(s.t * 10 + i) * 3);
      }
      g.restore();
    },

    front(g, e, s) {
      const q = s.M.players[e.target];
      const d = s.depth(q.x, q.y);
      const k = envOf(e, 0.15, 0.4);
      const since = e.t - (e.next - e.every);
      const hot = clamp01(1 - since / 0.12);
      g.save();
      // grill marks seared across the torso, glowing on each damage tick
      g.globalAlpha = 0.6 * k;
      g.lineWidth = 3;
      g.strokeStyle = hot > 0 ? '#ff3d00' : '#2a2a2a';
      for (let i = 0; i < 3; i++) {
        const y = d.y - 6 - i * 8;
        g.beginPath(); g.moveTo(d.x - 11, y); g.lineTo(d.x + 11, y - 7); g.stroke();
      }
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8 * k;
      for (let i = 0; i < 3; i++) {
        const x = d.x - 10 + i * 10, h = (18 + Math.sin(s.t * 18 + i * 2.3) * 6) * (1 + hot * 0.6);
        g.fillStyle = '#ff3d00'; tongue(g, x, d.y, 5, h, Math.sin(s.t * 12 + i) * 2);
        g.fillStyle = '#fff1c1'; tongue(g, x, d.y, 2, h * 0.4, 0);
      }
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      const q = s.M.players[e.target];
      if (Math.random() < 0.6) fx.emit({ shape: 'dot', x: q.x + fx.rand(-16, 16), y: q.y - fx.rand(10, 50), vx: fx.rand(-20, 20), vy: -110, r: 2.5, life: 0.7, color: '#ffb627', blend: 'lighter' });
      const since = e.t - (e.next - e.every);
      if (since >= 0 && since < s.dt) {
        for (let i = 0; i < 2; i++) fx.emit({ shape: 'streak', x: q.x + fx.rand(-10, 10), y: q.y - fx.rand(6, 24), vx: fx.rand(-180, 180), vy: fx.rand(-240, -80), grav: 500, w: 2, life: 0.28, color: '#fff1c1' });
      } else if (Math.random() < 0.25) {
        fx.emit({ shape: 'smoke', x: q.x + fx.rand(-10, 10), y: q.y - 50, vy: -40, r: 5, r1: 18, life: 0.9, color: '#3b3b3b', layer: 'back' });
      }
    },

    end(s, info) {
      const { fx } = s;
      if (info.e && info.e.type === 'burn') {
        const q = s.M.players[info.e.target];
        for (let i = 0; i < fx.n(8); i++) fx.emit({ shape: 'smoke', x: q.x + fx.rand(-14, 14), y: q.y - 24, vy: -45 - i * 6, r: 6, r1: 24, life: 1.6, color: '#3b3b3b', layer: 'back' });
        for (let i = 0; i < fx.n(6); i++) fx.emit({ shape: 'dot', x: q.x + fx.rand(-14, 14), y: q.y - 20, vy: fx.rand(-90, -30), r: 2, life: 1.2, color: '#ff3d00', blend: 'lighter' });
        return;
      }
      const b = s.M.ball;
      // the turf stays hot: embers smoulder and float up right across the pitch for 2s
      sheet(s, 22, 'ground', () => ({ shape: 'dot', vx: fx.rand(-15, 15), vy: -fx.rand(40, 120), r: 3, life: fx.rand(1.6, 2.4), color: '#ffb627', color2: '#ff3d00', blend: 'lighter' }));
      for (let i = 0; i < fx.n(4); i++) fx.glow(b.x + fx.rand(-80, 80), s.C.GROUND_Y - 8, fx.rand(30, 55), '#ff3d00', { life: fx.rand(1.4, 2.2), alpha: 0.6 });
      fx.burst(b.x, b.y, 12, { shape: 'dot', speed: 110, r: 2.5, grav: 400, life: 1, color: '#7a1f00', color2: '#ffb627' });
      for (let i = 0; i < fx.n(5); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-12, 12), y: b.y, vy: -40, r: 7, r1: 26, life: 1.4, color: '#3b3b3b', layer: 'back' });
      fx.glow(b.x, b.y, 70, '#ff3d00', { life: 1, alpha: 0.5 });
    },
  },

  // ── 4 · mud — the swamp bog ──────────────────────────────────────────────
  mud: {
    theme: 'Swamp bog',
    visual: 'a brown bubbling mud pool round the victim, plopping bubbles, green scum, splatter, sinking ripples, mud up to the ankles',
    palette: ['#6b4423', '#3e2716', '#a47148', '#c9a27e', '#57693a'],
    doc: {
      fantasy: 'A bog opens under the opponent and they sink to the ankles in thick, bubbling swamp mud.',
      purpose: 'Slows the opponent right down for 4s so the struck ball — or a follow-up — can beat them to the goal; the gentlest way to teach that powers can target the player, not the ball.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is struck at the goal you attack (1.15× kick power) and the opponent is bogged for 4s: 0.5× top speed, 0.6× acceleration, no dash.',
      bot: 'POWERS.mud.arm is \'any\' and stage 4 is below the smart bar, so it arms as soon as the meter is full; style \'brawler\' — it goes for the man to earn the meter.',
      sequence: {
        anticipation: 'While armed the champion stands in a wide bubbling swamp puddle with cattails swaying at its edges, a fly buzzing round, bubbles popping and a murky green glow. Over it all the armed beacon: a pillar of swamp-green light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. The puddle is wider and dark-rimmed, with mud blobs bulging and plopping either side.',
        activation: 'In the cut-in a giant dripping mud splat with a grinning frog on it. On the pitch: a brown-green sunburst, a murky glow, a mud-blob explosion, mud-and-scum splatter confetti, a "שפריץ!" word, green-brown screen edges, a dark tint and a shake. Mud rains out of the sky over the whole pitch and splats back up off the turf, with a big green ring.',
        main: 'A wide swamp opens round the opponent wherever they walk: dark rim, swirling surface, green scum, bubbles swelling and popping, ripples running out, cattails and reeds swaying round it, a frog on a lily pad blinking, swamp gas glowing green as it rises; the ground across the pitch turns murky green; a mud lip swallows their boots. The whole pitch floods: a glossy mud tide with a green rim rolls along the turf end to end, bubbles swell and burst all along it, mud splats rain out of the sky, glowing fireflies blink over the bog, and a BIG frog on a lily pad blinks and lashes its pink tongue out at the ball.',
        impact: 'On landing a mud geyser at the opponent\'s feet: a brown sunburst, blobs fountaining up, splatter confetti, a ring, a "פלופ!" word, a dark tint and a shake. A green ring, a slow sunburst, a vignette and mud raining over the pitch.',
        aftermath: 'The swamp drains: a last ripple, blobs falling back and murky steam hanging for a second and a half. The flood drains off the whole pitch: murky steam, a last round of bursting bubbles and fireflies drifting away.',
        cleanup: 'The pool shrinks over its last 0.5s; blobs, gas and steam fade within ~1.5s.',
      },
      layers: 'Puddle, cattails, fly and glow (aura); cut-in splat and frog; sunburst, glows, blobs (dot), confetti, smoke (fire); murky ground band, pool, scum, ripples, bubbles, reeds, lily pad and frog, glow (back); ankle-deep lip (front); plops (ring), swamp gas (glow), splashes (tick).',
      camera: 'Shake 7, a 1s green vignette and a dark tint on firing; shake 8 and a dark tint on the geyser.',
      hud: 'The engine\'s 🟤 status pill with its 4s ring over the bogged opponent.',
      audio: 'Fire: a wet splat sinking in pitch. Impact: two bubble plops and a squelch. End: a slow draining gurgle.',
      counterplay: 'Jumping still works — hop out toward the ball rather than wading. You can head and kick normally, so stay between the ball and your goal and let it come to you for 4s.',
      perf: '~70 particles on firing, ~65 on the geyser, ≤3 a frame from tick; the swamp is ~60 shapes with 2 drawGlow; no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.burst, fx.confetti, fx.emit(dot/ring/smoke), fx.drawGlow, fx.vignette, fx.shake, fx.tint, s.depth. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 260, q: 0.6, peak: 0.8, decay: 0.28 }, { k: 'sweep', from: 340, to: 80, type: 'sine', peak: 0.35, dur: 0.22 }],
      impact: [{ k: 'blip', freq: 180, type: 'sine', peak: 0.4, dur: 0.1 }, { k: 'blip', freq: 120, type: 'sine', peak: 0.35, dur: 0.12, t: 0.09 }, { k: 'thud', freq: 140, q: 0.8, peak: 0.6, decay: 0.3 }],
      end: [{ k: 'sweep', from: 90, to: 210, type: 'sine', peak: 0.25, dur: 0.35 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      beacon(g, s, p, '#7fa04a', '#a47148');
      s.fx.drawGlow(g, d.x, d.y - 6, 100, '#7fa04a', 0.6);
      g.save();
      g.globalAlpha = 0.95;
      g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(d.x, d.y + 2, 58, 11, 0, 0, TAU); g.fill();
      g.fillStyle = '#3e2716'; g.beginPath(); g.ellipse(d.x, d.y + 2, 54, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(d.x, d.y + 1, 44, 6.5, 0, 0, TAU); g.fill();
      // a mud blob bulging and plopping on each side
      for (const k of [-1, 1]) {
        const u = (s.t * 1.4 + (k > 0 ? 0.5 : 0)) % 1, bh = Math.sin(u * Math.PI) * 22;
        g.fillStyle = OUTLINE; tongue(g, d.x + k * 30, d.y + 2, 11, bh + 3, 0);
        g.fillStyle = '#7d5230'; tongue(g, d.x + k * 30, d.y + 2, 9, bh, 0);
      }
      g.fillStyle = '#57693a';
      for (let i = 0; i < 4; i++) g.fillRect(d.x - 26 + i * 16, d.y + (i % 2), 5, 2);
      // cattails at the edges
      for (const k of [-1, 1]) {
        const bx = d.x + k * 44, sw = Math.sin(s.t * 2.5 + k) * 4;
        g.strokeStyle = '#57693a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx, d.y + 2); g.quadraticCurveTo(bx + sw * 0.5, d.y - 20, bx + sw, d.y - 40); g.stroke();
        g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(bx + sw, d.y - 44, 3.5, 8, sw * 0.03, 0, TAU); g.fill();
      }
      // bubbles swelling and popping
      for (let i = 0; i < 2; i++) {
        const c = s.t * 1.6 + i * 0.5, k = c % 1;
        const bx = d.x + Math.sin(Math.floor(c) * 2.3 + i) * 24;
        if (k < 0.9) {
          g.strokeStyle = '#c9a27e'; g.lineWidth = 2;
          g.beginPath(); g.arc(bx, d.y, 3 + k * 7, Math.PI, 0); g.stroke();
        }
      }
      // a fly buzzing round the champion
      const fa = s.t * 7;
      g.fillStyle = '#1e1a14';
      g.fillRect(d.x + Math.cos(fa) * 30 - 2, d.y - 60 + Math.sin(fa * 1.7) * 12 - 2, 4, 4);
      g.restore();
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'dot', x: d.x + s.fx.rand(-14, 14), y: d.y - 8, vy: 30, grav: 600, r: 3, life: 0.35, color: '#6b4423' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#57693a', (g) => {
        // the splat: a lumpy blob with drips
        g.fillStyle = '#3e2716';
        g.beginPath();
        for (let i = 0; i <= 18; i++) {
          const a = (i / 18) * TAU, rr = 120 + (i % 2 ? -28 : 18) + Math.sin(i * 2.3) * 10;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8);
        }
        g.closePath(); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 6; g.stroke();
        g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(0, 0, 90, 64, 0, 0, TAU); g.fill();
        for (let i = 0; i < 4; i++) {
          const x = -70 + i * 46, h = 30 + (i % 2) * 30 + Math.sin(s.t * 3 + i) * 6;
          g.fillStyle = '#3e2716'; g.fillRect(x - 7, 60, 14, h); g.beginPath(); g.arc(x, 60 + h, 9, 0, TAU); g.fill();
        }
        g.fillStyle = '#a47148'; g.beginPath(); g.arc(-40, -24, 12, 0, TAU); g.fill(); g.beginPath(); g.arc(46, 20, 8, 0, TAU); g.fill();
        // the frog
        g.fillStyle = '#57693a'; g.beginPath(); g.ellipse(10, -60, 46, 30, 0, 0, TAU); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 4; g.stroke();
        for (const o of [-22, 22]) {
          g.fillStyle = '#57693a'; g.beginPath(); g.arc(10 + o, -88, 14, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(10 + o, -88, 9, 0, TAU); g.fill();
          g.fillStyle = OUTLINE; g.beginPath(); g.arc(12 + o, -87, 4.5, 0, TAU); g.fill();
        }
        g.strokeStyle = OUTLINE; g.lineWidth = 4;
        g.beginPath(); g.arc(10, -62, 22, 0.3, Math.PI - 0.3); g.stroke();
      });
    },

    fire(s, at) {
      const { fx } = s;
      boom(s, at.x, at.y, { c1: '#a47148', c2: '#57693a', core: '#c9a27e', R: 150, rays: 330, n: 12, word: 'שפריץ!', wc: '#c9a27e' });
      fx.burst(at.x, at.y, 32, { shape: 'dot', speed: 400, grav: 900, r: 5, life: 0.8, color: '#6b4423', color2: '#3e2716' });
      fx.burst(at.x, at.y, 10, { shape: 'smoke', speed: 80, r: 8, r1: 26, drag: 2, life: 0.9, color: '#a47148', layer: 'back' });
      fx.confetti(at.x, at.y, 18, ['#6b4423', '#3e2716', '#57693a', '#a47148']);
      fx.ring(at.x, at.y, { color: '#3e2716', r1: 110, life: 0.4, w: 6 });
      fx.ring(at.x, at.y, { color: '#7fa04a', r1: 250, life: 0.6, w: 9, layer: 'front' });
      // mud rains out of the sky over the whole pitch and splats back up off the turf
      sheet(s, 24, 'top', (x, y, i) => ({ shape: 'dot', vx: fx.rand(-30, 30), vy: fx.rand(120, 300), grav: 900, r: fx.rand(5, 9), life: 1, color: i % 3 ? '#6b4423' : '#7fa04a', color2: '#3e2716' }));
      sheet(s, 12, 'ground', () => ({ shape: 'ring', r: 3, r1: 26, w: 3, life: 0.5, color: '#a47148', layer: 'back' }));
      fx.shake(8, 0.35);
      fx.tint('#3e2716', 0.16, 0.7);
      fx.vignette('#57693a', 0.55, 1.1);
    },

    back(g, e, s) {
      const C = s.C;
      const q = s.M.players[e.target];
      const d = s.depth(q.x, C.GROUND_Y);
      const k = envOf(e, 0.3, 0.5);
      const R = 72 * k;
      if (R < 1) return;
      groundBand(g, s, '#57693a', 0.2 * k, 140);
      s.fx.drawGlow(g, d.x, d.y - 8, R * 1.4, '#57693a', 0.5 * k);
      s.fx.drawGlow(g, d.x, d.y - 70, 150 * k, '#7fa04a', 0.45 * k);
      g.save();
      // the whole pitch floods: a glossy mud tide rolling along the turf end to end, with
      // bubbles swelling and bursting all along it, and fireflies blinking over the bog
      const g0 = s.depth(0, C.GROUND_Y).y;
      g.globalAlpha = 0.9 * k;
      g.fillStyle = '#3e2716';
      g.beginPath(); g.moveTo(0, g0 + 18);
      for (let i = 0; i <= 30; i++) g.lineTo((i / 30) * C.W, g0 - 6 + Math.sin(i * 0.8 + s.t * 1.6) * 4);
      g.lineTo(C.W, g0 + 18); g.closePath(); g.fill();
      g.strokeStyle = '#7fa04a'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = '#c9a27e'; g.lineWidth = 2.5;
      for (let i = 0; i < 9; i++) {
        const bx = C.W * ((i + 0.5) / 9) + Math.sin(i * 5.3) * 30, u = (s.t * (0.7 + hashy(i) * 0.6) + hashy(i + 4)) % 1;
        if (Math.abs(bx - q.x) < 90) continue;
        const br = 4 + u * 13;
        if (u < 0.88) {
          g.fillStyle = '#6b4423'; g.beginPath(); g.arc(bx, g0 - 4, br, Math.PI, 0); g.fill();
          g.beginPath(); g.arc(bx, g0 - 4, br, Math.PI, 0); g.stroke();
          g.fillStyle = '#e6d2b5'; g.fillRect(bx - br * 0.5, g0 - 4 - br * 0.7, 3, 3);
        } else {
          g.beginPath(); g.arc(bx, g0 - 4, br + (u - 0.88) * 120, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
      }
      field(g, s, 18, { vx: 14, vy: -10, seed: 21, top: C.GROUND_Y - 190, bot: C.GROUND_Y - 20 }, (g, x, y, i, h) => {
        const on = 0.5 + 0.5 * Math.sin(s.t * (3 + h * 4) + i * 2);
        g.globalAlpha = on * k;
        g.fillStyle = '#d4ff6a'; g.fillRect(x - 4, y - 4, 8, 8);
        g.fillStyle = '#ffffff'; g.fillRect(x - 1.5, y - 1.5, 3, 3);
        if (i < 6) s.fx.drawGlow(g, x, y, 22, '#d4ff6a', 0.6 * on * k);
      });
      // mud splats raining out of the sky over the whole pitch
      field(g, s, 14, { vy: 300, vx: -20, seed: 27, top: -20, bot: C.GROUND_Y }, (g, x, y, i) => {
        g.globalAlpha = 0.9 * k;
        const r = 5 + (i % 3) * 2;
        g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(x, y, r + 2, r * 1.5 + 2, 0, 0, TAU); g.fill();
        g.fillStyle = i % 4 ? '#7d5230' : '#7fa04a'; g.beginPath(); g.ellipse(x, y, r, r * 1.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#c9a27e'; g.fillRect(x - r * 0.5, y - r * 0.8, 2.5, 2.5);
      });
      g.globalAlpha = 1;
      // the bog erupts round him: thick mud tongues heaving up behind his body to head height,
      // dark-rimmed so they read on any stage and clear of the touch buttons at his feet
      for (let i = 0; i < 7; i++) {
        const u = i / 6 - 0.5, ph = s.t * (2.2 + i * 0.3) + i * 1.7;
        const h = (100 + 80 * (0.5 + 0.5 * Math.sin(ph))) * k * (1 - Math.abs(u) * 0.7);
        const x = d.x + u * R * 2.3, w = 13 + 5 * Math.cos(i);
        g.fillStyle = '#2a1a0e'; tongue(g, x, d.y + 4, w + 3, h + 4, Math.sin(ph * 0.7) * 8);
        g.fillStyle = i % 2 ? '#6b4423' : '#7d5230'; tongue(g, x, d.y + 4, w, h, Math.sin(ph * 0.7) * 8);
        g.fillStyle = '#7fa04a'; g.globalAlpha = 0.9;
        g.beginPath(); g.ellipse(x + Math.sin(ph * 0.7) * 6, d.y - h * 0.8, w * 0.35, 4, 0, 0, TAU); g.fill();
        g.fillStyle = '#c9a27e';
        g.beginPath(); g.arc(x - w * 0.3 + Math.sin(ph * 0.7) * 5, d.y - h * 0.55, 3.5, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      // swamp fog rolling across the pitch at shin height
      for (let i = 0; i < 6; i++) {
        const fxp = ((i / 6) * (C.W + 240) + s.t * 22 * (i % 2 ? 1 : -1)) % (C.W + 240);
        g.globalAlpha = 0.3 * k; g.fillStyle = i % 2 ? '#7fa04a' : '#57693a';
        g.beginPath(); g.ellipse((fxp + C.W + 240) % (C.W + 240) - 120, C.GROUND_Y - 30 - (i % 3) * 16, 150, 28, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#3e2716'; g.beginPath(); g.ellipse(d.x, d.y + 2, R, R * 0.24, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(d.x, d.y + 1, R * 0.86, R * 0.18, 0, 0, TAU); g.fill();
      g.strokeStyle = '#a47148'; g.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const a = s.t * (i ? -1.1 : 0.8) + i * 2;
        g.beginPath(); g.ellipse(d.x, d.y + 1, R * (0.35 + i * 0.25), R * (0.07 + i * 0.05), 0, a, a + 1.6); g.stroke();
      }
      g.fillStyle = '#57693a';
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + s.t * 0.3;
        g.fillRect(d.x + Math.cos(a) * R * 0.62, d.y + 1 + Math.sin(a) * R * 0.13, 5, 2);
      }
      for (let i = 0; i < 3; i++) {
        const f = (e.t * 0.9 + i / 3) % 1;
        g.globalAlpha = (1 - f) * 0.6;
        g.beginPath(); g.ellipse(d.x, d.y + 1, R * (0.3 + 0.8 * f), R * (0.3 + 0.8 * f) * 0.22, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 5; i++) {
        const c = e.t * 1.3 + i * 0.37, f = c % 1;
        if (f > 0.9) continue;
        const bx = d.x + Math.sin(i * 2.7 + Math.floor(c) * 1.9) * R * 0.6;
        const br = 2 + f * 7;
        g.fillStyle = '#6b4423'; g.beginPath(); g.arc(bx, d.y, br, Math.PI, 0); g.fill();
        g.strokeStyle = '#c9a27e'; g.beginPath(); g.arc(bx, d.y, br, Math.PI, 0); g.stroke();
      }
      // reeds and cattails round the rim, swaying
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1, j = i % 3;
        const bx = d.x + side * (R * (0.82 + j * 0.1)), sw = Math.sin(s.t * 2.4 + i) * 4;
        const h = (34 + j * 10) * k;
        g.strokeStyle = '#57693a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx, d.y + 3); g.quadraticCurveTo(bx + sw * 0.5, d.y - h * 0.5, bx + sw, d.y - h); g.stroke();
        if (j !== 1) { g.fillStyle = '#6b4423'; g.beginPath(); g.ellipse(bx + sw, d.y - h - 4, 3, 7, 0, 0, TAU); g.fill(); }
      }
      // a BIG frog on a lily pad beside the bog, blinking, lashing its tongue out at the ball
      const toward = q.x < C.W / 2 ? 1 : -1;
      const lx = d.x + toward * (R + 70), ly = d.y + 2, fk = 3 * k;
      g.lineWidth = 3;
      g.fillStyle = '#2f6b2a'; g.strokeStyle = OUTLINE;
      g.beginPath(); g.ellipse(lx, ly, 17 * fk, 5 * fk, 0, 0.3, TAU - 0.3); g.lineTo(lx, ly); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7fa04a';
      g.beginPath(); g.ellipse(lx, ly - 6 * fk, 10 * fk, 7 * fk, 0, 0, TAU); g.fill(); g.stroke();
      for (const o of [-4.5, 4.5]) {
        g.fillStyle = '#7fa04a'; g.beginPath(); g.arc(lx + o * fk, ly - 13 * fk, 3.6 * fk, 0, TAU); g.fill(); g.stroke();
      }
      const blink = (s.t % 2.4) < 0.12;
      for (const o of [-4.5, 4.5]) {
        g.fillStyle = blink ? '#7fa04a' : '#ffffff'; g.beginPath(); g.arc(lx + o * fk, ly - 13 * fk, 2.4 * fk, 0, TAU); g.fill();
        if (!blink) { g.fillStyle = OUTLINE; g.beginPath(); g.arc(lx + o * fk + toward * 1.5, ly - 13 * fk, 1.1 * fk, 0, TAU); g.fill(); }
      }
      g.strokeStyle = OUTLINE; g.lineWidth = 3;
      g.beginPath(); g.arc(lx, ly - 7 * fk, 5 * fk, 0.35, Math.PI - 0.35); g.stroke();
      // the tongue: out and back every 1.8s, toward the ball, stopping short of it
      const tu = (s.t % 1.8) / 1.8;
      if (tu < 0.28 && k > 0.5) {
        const b = s.M.ball, bd = s.depth(b.x, b.y), mx = lx + toward * 5 * fk, my = ly - 5 * fk;
        const reach = Math.sin((tu / 0.28) * Math.PI) * Math.min(170, Math.hypot(bd.x - mx, bd.y - my) - b.r - 14);
        if (reach > 6) {
          const a = Math.atan2(bd.y - my, bd.x - mx), tx = mx + Math.cos(a) * reach, ty = my + Math.sin(a) * reach;
          g.lineCap = 'round';
          g.strokeStyle = OUTLINE; g.lineWidth = 9; g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty); g.stroke();
          g.strokeStyle = '#ff6f91'; g.lineWidth = 5; g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = '#ff6f91'; g.fillRect(tx - 5, ty - 5, 10, 10);
        }
      }
      g.restore();
    },

    front(g, e, s) {
      const q = s.M.players[e.target];
      const k = envOf(e, 0.3, 0.5);
      const deep = 6 + 5 * clamp01(e.t / 2);                    // sinking deeper as it goes on
      g.save();
      if (q.y > s.C.GROUND_Y - 6) {
        const d = s.depth(q.x, s.C.GROUND_Y);
        g.fillStyle = '#6b4423';
        g.beginPath(); g.ellipse(d.x, d.y - 1, 26 * k, deep * k, 0, 0, TAU); g.fill();
        g.strokeStyle = '#a47148'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(d.x, d.y - 1, 26 * k, deep * k, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      } else {
        const d = s.depth(q.x, q.y);
        g.fillStyle = '#6b4423';
        for (const o of [-8, 8]) { g.beginPath(); g.arc(d.x + o, d.y - 1, 5 * k, 0, TAU); g.fill(); }
      }
      // mud slathered up his body: dripping splotches with a dark rim, sliding down
      const bd = s.depth(q.x, q.y);
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, f = ((s.t * 0.35 + i * 0.29) % 1);
        const x = bd.x + side * (s.C.BODY_W / 2 - 3) + Math.sin(i * 3.1) * 4;
        const y = bd.y - 46 + f * 34 + (i >> 1) * 6;
        g.globalAlpha = k * (1 - f * 0.4);
        g.fillStyle = '#2a1a0e'; g.beginPath(); g.ellipse(x, y, 7.5, 10.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#7d5230'; g.beginPath(); g.ellipse(x, y, 6, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#6b4423'; g.fillRect(x - 2, y + 6, 4, 8 + f * 8);
      }
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      const q = s.M.players[e.target];
      const roll = Math.random();
      if (roll < 0.14) {
        const x = q.x + fx.rand(-50, 50);
        fx.emit({ shape: 'ring', x, y: C.GROUND_Y, r: 2, r1: 14, w: 2, life: 0.3, color: '#c9a27e', layer: 'back' });
        fx.emit({ shape: 'dot', x, y: C.GROUND_Y - 2, vy: -130, grav: 800, r: 2.5, life: 0.35, color: '#6b4423' });
      } else if (roll < 0.6) {
        if (Math.random() < 0.15) fx.glow(q.x + fx.rand(-50, 50), C.GROUND_Y - 6, 22, '#7fa04a', { vy: -50, life: 1, alpha: 0.6 });
        // mud globs flung up out of the bog, arcing over his head and splatting back
        fx.emit({ shape: 'dot', x: q.x + fx.rand(-60, 60), y: C.GROUND_Y - 30, vx: fx.rand(-90, 90), vy: -fx.rand(320, 480), grav: 900, r: fx.rand(4, 7), life: 0.9, color: '#6b4423', color2: '#3e2716' });
      }
      if (Math.abs(q.vx) > 20 && q.y > C.GROUND_Y - 6 && Math.random() < 0.4) {
        fx.emit({ shape: 'dot', x: q.x - Math.sign(q.vx) * 14, y: C.GROUND_Y - 4, vx: -q.vx * 0.6, vy: -180, grav: 900, r: 3.5, life: 0.5, color: '#3e2716' });
      }
    },

    impact(s, ev) {
      const { fx, C } = s;
      const x = ev.e && ev.e.target != null ? s.M.players[ev.e.target].x : ev.x;
      boom(s, x, C.GROUND_Y - 20, { c1: '#6b4423', c2: '#57693a', core: '#c9a27e', R: 140, rays: 280, n: 12, word: 'פלופ!', wc: '#a47148', up: 160 });
      fx.burst(x, C.GROUND_Y - 4, 34, { shape: 'dot', speed: 460, spread: 1.4, angle: -Math.PI / 2, grav: 1000, r: 5.5, life: 0.9, color: '#6b4423', color2: '#3e2716' });
      fx.burst(x, C.GROUND_Y - 6, 8, { shape: 'smoke', speed: 70, spread: 1.2, angle: -Math.PI / 2, r: 8, r1: 26, drag: 2, life: 1, color: '#a47148', layer: 'back' });
      fx.confetti(x, C.GROUND_Y - 20, 14, ['#6b4423', '#57693a', '#c9a27e']);
      fx.ring(x, C.GROUND_Y, { color: '#a47148', r1: 110, life: 0.45, w: 5 });
      fx.ring(x, C.GROUND_Y - 20, { color: '#7fa04a', r1: 230, life: 0.6, w: 8, layer: 'front' });
      fx.rays(x, C.GROUND_Y - 20, { color: '#7fa04a', color2: '#a47148', r1: 560, n: 18, life: 0.8, spin: 0.7, alpha: 0.4 });
      sheet(s, 18, 'top', () => ({ shape: 'dot', vx: fx.rand(-30, 30), vy: fx.rand(100, 260), grav: 900, r: fx.rand(4, 8), life: 1, color: '#6b4423', color2: '#3e2716' }));
      fx.vignette('#7fa04a', 0.45, 1);
      fx.shake(9, 0.35);
      fx.tint('#3e2716', 0.14, 0.5);
    },

    end(s, info) {
      const { fx, C } = s;
      const q = info.e && info.e.target != null ? s.M.players[info.e.target] : s.foe;
      fx.ring(q.x, C.GROUND_Y, { color: '#6b4423', r1: 90, life: 0.6, w: 4 });
      fx.burst(q.x, C.GROUND_Y - 4, 10, { shape: 'dot', speed: 180, spread: 1.2, angle: -Math.PI / 2, grav: 900, r: 3.5, life: 0.6, color: '#a47148' });
      for (let i = 0; i < fx.n(6); i++) fx.emit({ shape: 'smoke', x: q.x + fx.rand(-40, 40), y: C.GROUND_Y - 6, vy: -25, r: 8, r1: 28, life: 1.5, color: '#57693a', layer: 'back' });
      fx.glow(q.x, C.GROUND_Y - 10, 80, '#57693a', { life: 1, alpha: 0.4 });
      // the flood drains off the whole pitch: murky steam and a last round of bursting bubbles
      sheet(s, 12, 'ground', () => ({ shape: 'smoke', vy: -fx.rand(15, 45), vx: fx.rand(-15, 15), r: 10, r1: 36, life: 1.9, color: '#7fa04a', layer: 'back' }));
      sheet(s, 12, 'ground', () => ({ shape: 'ring', r: 3, r1: 22, w: 3, life: fx.rand(0.4, 0.9), color: '#c9a27e', layer: 'back' }));
      sheet(s, 10, 'air', () => ({ shape: 'sq', vy: -fx.rand(10, 40), vx: fx.rand(-20, 20), r: 4, life: 2, color: '#d4ff6a', blend: 'lighter' }));
    },
  },

  // ── 5 · goalwall — the fortress ──────────────────────────────────────────
  goalwall: {
    theme: 'Brick fortress wall',
    visual: 'red bricks laid course by course in running bond, mortar dust, a grey battlement cap, cracks and chips where the ball hits',
    palette: ['#a4503c', '#6e2f22', '#e6d8bf', '#6f7680', '#8d949c', '#c4b59a'],
    doc: {
      fantasy: 'The champion bricks up their own goal: a masonry wall goes up course by course across the goal mouth and every ball bounces off it.',
      purpose: 'The first defensive power: 3.5 seconds where the goal is shut, even to power shots, so the champion can clear and counter-attack.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is cleared hard (1.1× strike, 0.95 lift) and a wall stands 8px in front of your goal line, from the ground to just under the crossbar, for 3.5s. Balls come off it at 0.82 restitution; a power shot hitting it is saved and turned into a plain ball.',
      bot: 'POWERS.goalwall.arm is \'defend\' (ball in its own half), but at stage 5 the ladder is below the smart bar, so it arms as soon as the meter is full; style \'keeper\' — it holds its line.',
      sequence: {
        anticipation: 'While armed a big brick stack keeps being laid behind the champion, course on course, puffing mortar dust, with a little red pennant on top and a warm stone glow. Over it all the armed beacon: a pillar of gold light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. The stack is bigger and dark-backed.',
        activation: 'In the cut-in a giant castle wall with battlements and a waving flag. On the pitch: a stone-and-brick sunburst, a warm glow, bricks flung back toward the goal, dust, brick confetti, a "חומה!" word, grey screen edges, a flash and a shake. Bricks rain in from the sky across the pitch, a gold shimmer rises off the turf and a huge gold ring spreads.',
        main: 'The wall goes up in 0.5s, one course dropping onto the last, then stands in front of the net: running-bond bricks, mortar lines, a stone battlement cap with two blazing torches and a red flag waving on a pole; a golden shield shimmer sweeps up its face; its foot glows; every hit leaves a crack at the height it struck. The wall is wider, the golden dome towers over the goal with a red fortress crest (gold rim, white tower) bobbing on top, two searchlights sweep the sky from the battlements and gold motes rise off the fort across its half of the pitch.',
        impact: 'Wall hit: brick chips, mortar dust, a small light and a "בונק!" word. Power shot saved: a sunburst, a stone glow, a big brick burst, confetti, a "נחסם!" word, a flash and a heavy shake. On going up: dust rolls out along the ground and rays burst from its foot. On going up: big gold rays, a gold ring and a light at its foot.',
        aftermath: 'In its last 0.35s the courses crumble from the top down, then the rubble tumbles out onto the pitch under a dust cloud that hangs for a second and a half. The dust rolls out across half the pitch, the last gold of the shield drifts away and a "קראש!" word.',
        cleanup: 'Bricks and dust fall and fade within ~1.5s; the cracks are forgotten with the record.',
      },
      layers: 'Brick stack, pennant and glow (aura); cut-in castle wall; sunburst, glows, bricks (sq), dust (smoke), confetti (fire); the wall in over() in front of the net: foot glow, bricks, shimmer, cap, merlons, torches with glow, flag, cracks; chips, dust, rings, stamps (impact/end).',
      camera: 'Shake 7, a flash and a 1s grey vignette on firing; 4 on going up, 3 per hit, 10 on a save, 7 on the collapse; a mortar-white flash on a save.',
      hud: 'None beyond the wall itself — it is its own timer: it crumbles as the 3.5s end.',
      audio: 'Fire: brick clack, mortar thump, clack. Impact: a sharp stone crack over a thump. End: a low rumble of rubble.',
      counterplay: 'Don\'t shoot into it — a power shot is wasted on it. Keep the ball, keep your meter, and wait the 3.5s out; a ball above the crossbar goes over it.',
      perf: '~65 particles on firing, ~70 on a save, ≤2 a frame from tick; ~60 rects a frame for the wall, 3 drawGlow; no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.burst, fx.confetti, fx.emit(sq/smoke), fx.drawGlow, fx.vignette, fx.shake, fx.flash, s.depth, s.C.GROUND_Y. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'thud', freq: 420, q: 3, peak: 0.6, decay: 0.08 }, { k: 'thud', freq: 180, q: 1, peak: 0.8, decay: 0.3, t: 0.06 }, { k: 'thud', freq: 420, q: 3, peak: 0.5, decay: 0.08, t: 0.18 }],
      impact: [{ k: 'thud', freq: 760, q: 5, peak: 0.6, decay: 0.07 }, { k: 'thud', freq: 150, q: 0.9, peak: 0.8, decay: 0.22 }],
      end: [{ k: 'thud', freq: 110, q: 0.6, peak: 0.8, decay: 0.7 }, { k: 'thud', freq: 320, q: 2, peak: 0.4, decay: 0.3, t: 0.12 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const x = d.x - p.side * 40, y = d.y;
      const n = 1 + Math.floor((s.t * 3) % 7);                  // courses laid so far, looping
      beacon(g, s, p, '#ffd166', '#a4503c');
      s.fx.drawGlow(g, x, y - 40, 90, '#ffd166', 0.5);
      g.save();
      g.globalAlpha = 0.95;
      g.fillStyle = OUTLINE; g.fillRect(x - 32, y - n * 13 - 2, 60, n * 13 + 2);
      for (let c = 0; c < n; c++) {
        for (let i = 0; i < 3; i++) {
          const bx = x - 30 + i * 19 - (c % 2 ? 0 : -4), by = y - (c + 1) * 13;
          g.fillStyle = '#a4503c'; g.fillRect(bx, by, 17, 12);
          g.fillStyle = '#6e2f22'; g.fillRect(bx, by + 8, 17, 4);
          g.fillStyle = '#e6d8bf'; g.fillRect(bx + 1, by + 1, 3, 2);
        }
      }
      // the pennant on top of the stack
      const ty = y - n * 13;
      g.strokeStyle = '#6f7680'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, ty); g.lineTo(x, ty - 22); g.stroke();
      g.fillStyle = '#d7263d';
      g.beginPath(); g.moveTo(x, ty - 22); g.quadraticCurveTo(x + p.side * 8, ty - 22 + Math.sin(s.t * 8) * 3, x + p.side * 16, ty - 18); g.lineTo(x, ty - 13); g.closePath(); g.fill();
      g.restore();
      if (Math.random() < 0.3) s.fx.emit({ shape: 'smoke', x, y: y - n * 10, vy: -20, r: 3, r1: 12, life: 0.6, color: '#c4b59a', layer: 'back' });
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#c4b59a', (g, a, from) => {
        const W = 260, H = 190, BH = 30, BL = 52;
        g.fillStyle = '#e6d8bf'; g.fillRect(-W / 2, -H / 2, W, H);
        for (let c = 0; c * BH < H; c++) {
          const off = c % 2 ? BL / 2 : 0, y = H / 2 - (c + 1) * BH;
          for (let bx = -W / 2 - off; bx < W / 2; bx += BL) {
            const x1 = Math.max(bx, -W / 2) + 3, x2 = Math.min(bx + BL, W / 2) - 3;
            if (x2 - x1 < 4) continue;
            g.fillStyle = '#a4503c'; g.fillRect(x1, y + 3, x2 - x1, BH - 6);
            g.fillStyle = '#6e2f22'; g.fillRect(x1, y + BH - 10, x2 - x1, 7);
          }
        }
        g.fillStyle = '#6f7680'; g.fillRect(-W / 2 - 12, -H / 2 - 24, W + 24, 26);
        for (let i = 0; i < 5; i++) g.fillRect(-W / 2 - 12 + i * ((W + 24 - 36) / 4), -H / 2 - 50, 36, 28);
        g.strokeStyle = OUTLINE; g.lineWidth = 5; g.strokeRect(-W / 2 - 12, -H / 2 - 24, W + 24, H + 24);
        // the flag
        g.strokeStyle = '#8d949c'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(0, -H / 2 - 50); g.lineTo(0, -H / 2 - 130); g.stroke();
        g.fillStyle = '#d7263d';
        const wv = Math.sin(s.t * 9) * 8;
        g.beginPath(); g.moveTo(0, -H / 2 - 130); g.quadraticCurveTo(-from * 40, -H / 2 - 130 + wv, -from * 80, -H / 2 - 115); g.quadraticCurveTo(-from * 40, -H / 2 - 95 - wv, 0, -H / 2 - 90); g.closePath(); g.fill();
      });
    },

    fire(s, at) {
      const { fx, side } = s;
      const back = side > 0 ? Math.PI : 0;
      boom(s, at.x, at.y, { c1: '#c4b59a', c2: '#a4503c', core: '#e6d8bf', R: 150, rays: 320, n: 10, word: 'חומה!', wc: '#e6d8bf' });
      fx.burst(at.x, at.y, 26, { shape: 'sq', speed: 520, spread: 1.2, angle: back, grav: 800, spin: 10, r: 7, life: 0.8, color: '#a4503c', color2: '#6e2f22' });
      fx.burst(at.x, at.y, 14, { shape: 'smoke', speed: 90, r: 7, r1: 24, drag: 2, life: 0.9, color: '#c4b59a', layer: 'back' });
      fx.confetti(at.x, at.y, 16, ['#a4503c', '#6e2f22', '#8d949c', '#e6d8bf']);
      fx.ring(at.x, at.y, { color: '#e6d8bf', r1: 110, life: 0.4, w: 6 });
      fx.ring(at.x, at.y, { color: '#ffd166', r1: 240, life: 0.6, w: 9, layer: 'front' });
      // bricks rain in from the sky across the pitch and a gold shimmer rises off the turf
      sheet(s, 22, 'top', () => ({ shape: 'sq', vx: side * -fx.rand(60, 200), vy: fx.rand(100, 260), grav: 800, spin: fx.rand(-10, 10), r: 8, life: 1.1, color: '#a4503c', color2: '#6e2f22' }));
      sheet(s, 16, 'ground', () => ({ shape: 'star', vy: -fx.rand(80, 200), r: 5, spin: 6, life: 0.9, color: '#ffd166', blend: 'lighter' }));
      fx.shake(8, 0.35);
      fx.flash('#e6d8bf', 0.2, 0.16);
      fx.vignette('#6f7680', 0.55, 1.1);
    },

    over(g, e, s) {
      const C = s.C;
      const bot = C.GROUND_Y, H = bot - e.top, BH = 12, BL = 15, W = 40;
      const courses = Math.ceil(H / BH);
      const built = (e.t / 0.5) * courses;                      // fractional: the course dropping in
      const left = e.life - e.t;
      const crumble = left < 0.35 ? (1 - left / 0.35) * courses : 0;
      const top = s.depth(e.x, e.top);
      const x = top.x;
      const k = envOf(e, 0.5, 0.35);
      s.fx.drawGlow(g, x, bot - 6, 70 * k + 1, '#c4b59a', 0.5 * k);
      s.fx.drawGlow(g, x, (bot + e.top) / 2, 150 * k + 1, '#ffd166', 0.55 * k);
      g.save();
      // searchlights sweeping the sky from the battlements, and gold motes rising off the fort
      const away0 = Math.sign(C.W / 2 - e.x) || 1;
      g.globalCompositeOperation = 'lighter';
      for (const o of [-1, 1]) {
        const a = -Math.PI / 2 + away0 * (0.35 + o * 0.22) + Math.sin(s.t * 1.3 + o) * 0.3, L = 460;
        const bx0 = x + o * W / 2, by0 = e.top - 12;
        const sg0 = g.createLinearGradient(bx0, by0, bx0 + Math.cos(a) * L, by0 + Math.sin(a) * L);
        sg0.addColorStop(0, 'rgba(255,233,168,0.5)'); sg0.addColorStop(1, 'rgba(255,233,168,0)');
        g.globalAlpha = k; g.fillStyle = sg0;
        g.beginPath(); g.moveTo(bx0, by0);
        g.lineTo(bx0 + Math.cos(a - 0.1) * L, by0 + Math.sin(a - 0.1) * L);
        g.lineTo(bx0 + Math.cos(a + 0.1) * L, by0 + Math.sin(a + 0.1) * L);
        g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      field(g, s, 14, { vy: -60, x0: x - (away0 > 0 ? 20 : 240), x1: x + (away0 > 0 ? 240 : 20), top: C.CEIL_Y, bot, seed: 31 }, (g, fx0, fy, i) => {
        g.globalAlpha = k * (0.5 + 0.5 * Math.sin(s.t * 6 + i));
        g.fillStyle = i % 2 ? '#ffd166' : '#fff6d8';
        g.beginPath(); g.moveTo(fx0, fy - 5); g.lineTo(fx0 + 3, fy); g.lineTo(fx0, fy + 5); g.lineTo(fx0 - 3, fy); g.closePath(); g.fill();
      });
      g.globalAlpha = 1;
      // a golden force-field bulging out of the goal mouth round the wall: the whole goal is shut
      const fw = 100 * k, fy0 = e.top - 80;
      if (fw > 2) {
        const sg = g.createLinearGradient(x - fw, 0, x + fw, 0);
        sg.addColorStop(0, 'rgba(255,209,102,0)'); sg.addColorStop(0.5, 'rgba(255,209,102,0.55)'); sg.addColorStop(1, 'rgba(255,209,102,0)');
        g.globalAlpha = 0.8 * k; g.fillStyle = sg;
        g.beginPath(); g.ellipse(x, bot, fw, bot - fy0, 0, Math.PI, 0); g.fill();
        g.globalAlpha = k; g.strokeStyle = '#6e2f22'; g.lineWidth = 7;
        g.beginPath(); g.ellipse(x, bot, fw, bot - fy0, 0, Math.PI, 0); g.stroke();
        g.strokeStyle = '#ffe9a8'; g.lineWidth = 3.5;
        g.beginPath(); g.ellipse(x, bot, fw, bot - fy0, 0, Math.PI, 0); g.stroke();
        // hex shimmer cells climbing the dome
        g.strokeStyle = '#fff6d8'; g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const u = (s.t * 0.6 + i / 8) % 1, a = Math.PI + (0.15 + 0.7 * hashy(i)) * Math.PI;
          const hx = x + Math.cos(a) * fw * 0.75, hy = bot + Math.sin(a) * (bot - fy0) * (0.3 + 0.6 * u);
          g.globalAlpha = Math.sin(u * Math.PI) * 0.9 * k;
          g.beginPath();
          for (let j = 0; j < 6; j++) { const b = j * TAU / 6; g.lineTo(hx + Math.cos(b) * 8, hy + Math.sin(b) * 8); }
          g.closePath(); g.stroke();
        }
        g.globalAlpha = 1;
        // the fortress crest on top of the dome: a red shield with a gold rim and a white tower
        const sx = x, sy = fy0 - 4 + Math.sin(s.t * 3) * 3, sc = k;
        g.save(); g.translate(sx, sy); g.scale(sc, sc);
        const shield = () => { g.beginPath(); g.moveTo(-20, -22); g.lineTo(20, -22); g.lineTo(20, 2); g.quadraticCurveTo(18, 18, 0, 26); g.quadraticCurveTo(-18, 18, -20, 2); g.closePath(); };
        shield(); g.fillStyle = '#d7263d'; g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 8; g.stroke();
        g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.stroke();
        g.fillStyle = '#e6d8bf';
        g.fillRect(-8, -8, 16, 20);
        g.fillRect(-10, -14, 5, 6); g.fillRect(-2.5, -14, 5, 6); g.fillRect(5, -14, 5, 6);
        g.fillStyle = '#6e2f22'; g.fillRect(-3, 3, 6, 9);
        g.restore();
      }
      for (let c = 0; c < courses; c++) {
        if (c >= built) break;
        if (courses - 1 - c < crumble) continue;
        const drop = Math.max(0, 1 - (built - c)) * 26;
        const y = Math.max(e.top, bot - (c + 1) * BH) - drop;
        const h = Math.min(BH, bot - c * BH - Math.max(e.top, bot - (c + 1) * BH));
        g.fillStyle = '#e6d8bf';
        g.fillRect(x - W / 2, y, W, h);
        const off = c % 2 ? BL / 2 : 0;
        for (let bx = x - W / 2 - off; bx < x + W / 2; bx += BL) {
          const x1 = Math.max(bx, x - W / 2) + 1, x2 = Math.min(bx + BL, x + W / 2) - 1;
          if (x2 - x1 < 2) continue;
          g.fillStyle = '#a4503c'; g.fillRect(x1, y + 1, x2 - x1, h - 2);
          g.fillStyle = '#6e2f22'; g.fillRect(x1, y + h - 4, x2 - x1, 3);
          g.fillStyle = '#c4b59a'; g.fillRect(x1, y + 1, 2, 2);
        }
      }
      const standing = built >= courses && crumble < 0.5;
      if (standing) {
        // the golden shield shimmer sweeping up the face
        const sy = bot - ((e.t * 0.8) % 1) * H;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.35; g.fillStyle = '#fff6d8';
        g.fillRect(x - W / 2, sy - 7, W, 14);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        // the battlement cap
        const y = e.top - 8;
        g.fillStyle = '#6f7680'; g.fillRect(x - W / 2 - 4, y, W + 8, 9);
        g.fillStyle = '#8d949c'; g.fillRect(x - W / 2 - 4, y, W + 8, 3);
        g.fillStyle = '#6f7680';
        g.fillRect(x - W / 2 - 4, y - 8, 10, 8);
        g.fillRect(x + W / 2 - 6, y - 8, 10, 8);
        // torches on the merlons
        for (const o of [-1, 1]) {
          const tx = x + o * (W / 2 + 1), ty = y - 10;
          s.fx.drawGlow(g, tx, ty - 6, 30 + Math.sin(s.t * 13 + o) * 5, '#ffb347', 0.8);
          g.fillStyle = '#ffb347'; tongue(g, tx, ty, 4, 12 + Math.sin(s.t * 17 + o) * 3, Math.sin(s.t * 9) * 2);
          g.fillStyle = '#fff6d8'; tongue(g, tx, ty, 2, 6, 0);
        }
        // the flag, waving over the wall
        g.strokeStyle = '#8d949c'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 34); g.stroke();
        const away = Math.sign(C.W / 2 - e.x) || 1, wv = Math.sin(s.t * 9) * 3;
        g.fillStyle = '#d7263d';
        g.beginPath(); g.moveTo(x, y - 34); g.quadraticCurveTo(x + away * 9, y - 34 + wv, x + away * 18, y - 29); g.quadraticCurveTo(x + away * 9, y - 24 - wv, x, y - 22); g.closePath(); g.fill();
      }
      const st = WALLS.get(e);
      if (st) {
        g.strokeStyle = '#3a1d14'; g.lineWidth = 2; g.lineJoin = 'round';
        for (const cr of st.cracks) {
          if (cr.y < bot - (courses - crumble) * BH) continue;      // its course has crumbled
          g.beginPath(); g.moveTo(x + cr.dir * W / 2, cr.y);
          for (let i = 1; i <= 5; i++) g.lineTo(x + cr.dir * (W / 2 - i * 5), cr.y + ((i * cr.seed) % 3 - 1) * 5);
          g.stroke();
        }
      }
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      if (e.t < 0.5) {
        const y = C.GROUND_Y - (e.t / 0.5) * (C.GROUND_Y - e.top);
        fx.emit({ shape: 'smoke', x: e.x + fx.rand(-16, 16), y, vy: -15, vx: fx.rand(-40, 40), r: 4, r1: 14, life: 0.6, color: '#c4b59a', layer: 'back' });
        if (Math.random() < 0.5) fx.emit({ shape: 'sq', x: e.x + fx.rand(-14, 14), y, vx: fx.rand(-80, 80), vy: -60, grav: 700, r: 3, life: 0.4, color: '#a4503c' });
      } else if (Math.random() < 0.15) {
        fx.emit({ shape: 'sq', x: e.x + fx.rand(-14, 14), y: fx.rand(e.top, C.GROUND_Y), vy: 20, grav: 300, r: 2, life: 0.6, color: '#e6d8bf' });
      }
    },

    impact(s, ev) {
      const { fx, C } = s;
      const wall = s.M.champ.effects.find((e) => e.power === 'goalwall' && e.owner === s.owner.index && e.t < e.life);
      if (ev.kind === 'land') {
        const away = Math.sign(C.W / 2 - ev.e.x) > 0 ? 0 : Math.PI;
        fx.burst(ev.e.x, C.GROUND_Y - 4, 14, { shape: 'smoke', speed: 180, spread: 0.6, angle: away, drag: 2, r: 8, r1: 28, life: 1, color: '#c4b59a', layer: 'back' });
        fx.rays(ev.e.x, C.GROUND_Y - 40, { color: '#ffd166', color2: '#c4b59a', r1: 420, n: 14, life: 0.8, alpha: 0.45 });
        fx.ring(ev.e.x, C.GROUND_Y - 60, { color: '#ffd166', r1: 180, life: 0.5, w: 7, layer: 'front' });
        fx.glow(ev.e.x, C.GROUND_Y - 70, 140, '#ffd166', { life: 0.8, alpha: 0.6 });
        fx.shake(5, 0.25);
        return;
      }
      if (wall) {
        let st = WALLS.get(wall);
        if (!st) WALLS.set(wall, st = { cracks: [] });
        if (st.cracks.length < 6) {
          st.cracks.push({ y: Math.max(wall.top + 6, Math.min(C.GROUND_Y - 6, ev.y)), dir: Math.sign(C.W / 2 - wall.x) || 1, seed: 1 + Math.floor(Math.random() * 5) });
        }
      }
      const big = ev.kind === 'saved';
      const away = wall ? Math.sign(C.W / 2 - wall.x) : Math.sign(C.W / 2 - ev.x);
      const ang = away > 0 ? 0 : Math.PI;
      fx.burst(ev.x, ev.y, big ? 28 : 10, { shape: 'sq', speed: big ? 440 : 260, spread: 1.6, angle: ang, grav: 900, spin: 12, r: big ? 6 : 4, life: 0.8, color: '#a4503c', color2: '#6e2f22' });
      fx.burst(ev.x, ev.y, big ? 10 : 4, { shape: 'smoke', speed: 80, r: 6, r1: 24, drag: 2, life: 0.8, color: '#e6d8bf', layer: 'back' });
      if (big) {
        boom(s, ev.x, ev.y, { c1: '#e6d8bf', c2: '#a4503c', R: 170, rays: 360, n: 12, word: 'נחסם!', wc: '#e6d8bf', dx: away * 60, up: 90 });
        fx.confetti(ev.x, ev.y, 18, ['#a4503c', '#8d949c', '#e6d8bf', '#d7263d']);
        fx.shake(10, 0.35);
        fx.flash('#e6d8bf', 0.22, 0.16);
      } else {
        fx.glow(ev.x, ev.y, 50, '#e6d8bf', { life: 0.3, alpha: 0.6 });
        fx.stamp(ev.x + away * 50, Math.max(70, ev.y - 40), 'בונק!', { color: '#c4b59a', r: 34, life: 0.6 });
        fx.shake(3, 0.15);
      }
    },

    end(s, info) {
      const { fx, C } = s;
      const e = info.e;
      if (!e || e.type !== 'wall') return;
      const away = Math.sign(C.W / 2 - e.x) || 1;
      for (let i = 0, n = fx.n(24); i < n; i++) {
        fx.emit({ shape: 'sq', x: e.x + fx.rand(-14, 14), y: fx.rand(e.top, C.GROUND_Y), vx: away * fx.rand(20, 200), vy: fx.rand(-200, 0), grav: 1000, spin: fx.rand(-10, 10), r: 7, life: 1, color: '#a4503c', color2: '#6e2f22' });
      }
      fx.burst(e.x, C.GROUND_Y - 6, 12, { shape: 'smoke', speed: 100, spread: 1.6, angle: -Math.PI / 2, drag: 2, r: 10, r1: 34, life: 1.5, color: '#c4b59a', layer: 'back' });
      fx.glow(e.x, C.GROUND_Y - 30, 90, '#c4b59a', { life: 1, alpha: 0.4 });
      // the dust rolls out across half the pitch and the last gold of the shield drifts away
      for (let i = 0; i < fx.n(10); i++) fx.emit({ shape: 'smoke', x: e.x + away * i * 26, y: C.GROUND_Y - fx.rand(4, 30), vx: away * fx.rand(30, 120), vy: -fx.rand(5, 30), drag: 0.8, r: 12, r1: 40, life: 2, color: '#c4b59a', layer: 'back' });
      fx.burst(e.x, (C.GROUND_Y + e.top) / 2, 16, { shape: 'star', speed: 160, grav: -60, r: 5, spin: 6, life: 1.5, color: '#ffd166', blend: 'lighter' });
      fx.stamp(e.x + away * 70, Math.max(70, e.top - 30), 'קראש!', { color: '#c4b59a', r: 40, life: 0.9 });
      fx.shake(8, 0.4);
    },
  },

  // ── 6 · coins — the casino jackpot ───────────────────────────────────────
  coins: {
    theme: 'Casino jackpot',
    visual: 'spinning gold coins pouring from a lit slot-machine marquee, felt-green landing markers, $ sparkles, 777 glyph',
    palette: ['#ffc400', '#b8860b', '#fff3b0', '#1f8f4e', '#d7263d'],
    doc: {
      fantasy: 'The champion hits the jackpot and the payout falls on the opponent\'s head — a marquee lights up over them and gold rains down.',
      purpose: 'The first power the opponent can dodge by moving: it rewards footwork, and punishes standing still with steady health loss.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball is struck at the goal you attack and coins fall on the opponent for 4.5s: one every 0.26s (until 0.5s before the end), each hit costs 0.06 health and knocks them 70px/s sideways.',
      bot: 'POWERS.coins.arm is \'any\' and stage 6 is below the smart bar, so it arms as soon as the meter is full; style \'brawler\' — it goes for the man to fill the meter.',
      sequence: {
        anticipation: 'While armed five big coins orbit round the champion\'s head, spinning edge-on to face-on and glinting, with golden light pooling either side. Over it all the armed beacon: a pillar of gold light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. Seven bigger coins orbit the head.',
        activation: 'In the cut-in a giant slot machine spins its 777 reels and pulls its lever. On the pitch: a gold-and-red sunburst, a gold light blob, a red 777 rising, a fountain of gold coins and sparkles, gold-green-red confetti and a "ג\'קפוט!" word; gold edges glow and it flashes. Gold pours out of the sky over the whole pitch, $ and 7 signs pop everywhere and a huge gold ring spreads.',
        main: 'A huge slot-machine marquee with "777" and chasing bulbs glows at the ceiling above the opponent; every coin in the real coin list is drawn big and spinning where it is, lit with its own gold glow and a speed streak, and a felt-green marker glows on the ground where it will land; a gold wash hangs at the top of the pitch and sparkles drift down. The marquee is twice the size, dark-framed, with "★ 7 7 7 ★" in big lights, hung just under the HUD; two casino spotlights swing down from it onto the opponent; $ signs and glints drift down over the whole pitch; a heap of gold grows round the opponent\'s feet; the real coins are bigger, dark-rimmed, with longer streaks.',
        impact: 'Each coin that hits bursts into gold chips, a glint, a light and a $, sometimes a "צ\'ינג!". On landing, sparkles, rays and a $ burst at the ceiling over the opponent.',
        aftermath: 'The payout: a fountain of coins, confetti, a green $ and a "כסף!" word rising from the opponent under a fading gold glow. The jackpot bursts: a big gold-green sunburst, confetti and sparkles over the whole pitch.',
        cleanup: 'Coins, confetti and sparkles fade within ~1.6s; the marquee goes with the record.',
      },
      layers: 'Orbiting coins and glows (aura); cut-in slot machine; sunburst, glows, 777 glyph, gold dots, stars, confetti (fire); landing markers with glows (back); top gold wash, marquee with text and bulbs, lit spinning coins with streaks (front); glints (star), chips, $ glyphs, stamps.',
      camera: 'Shake 6, a gold flash and a 1s gold vignette on firing, shake 3 per coin hit.',
      hud: 'The engine\'s 🪙 status pill with its 4.5s ring over the opponent.',
      audio: 'Fire: a three-note slot jingle over a metal clack. Impact: a coin clink. End: a cash-register ka-ching.',
      counterplay: 'Keep moving: coins spawn at fixed offsets around where you stand when they drop, and the green markers show where they land. A coin hitting you also shoves you, so don\'t get pinned against your own goal.',
      perf: '~70 particles on firing, ~16 per coin hit; ~6 coins alive with one drawGlow each plus the marquee\'s (≤14 a frame); no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.burst, fx.confetti, fx.emit(dot/star), fx.glyph, fx.drawGlow, fx.vignette, fx.shake, fx.flash, s.depth, s.headY, s.headR. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'blip', freq: 1047, type: 'triangle', peak: 0.35, dur: 0.09 }, { k: 'blip', freq: 1319, type: 'triangle', peak: 0.35, dur: 0.09, t: 0.07 }, { k: 'blip', freq: 1568, type: 'triangle', peak: 0.4, dur: 0.16, t: 0.14 }, { k: 'thud', freq: 3200, q: 6, peak: 0.3, decay: 0.1 }],
      impact: [{ k: 'blip', freq: 2637, type: 'triangle', peak: 0.35, dur: 0.07 }, { k: 'blip', freq: 3520, type: 'sine', peak: 0.25, dur: 0.12, t: 0.03 }],
      end: [{ k: 'thud', freq: 1800, q: 4, peak: 0.3, decay: 0.08 }, { k: 'blip', freq: 2093, type: 'square', peak: 0.2, dur: 0.25, t: 0.08 }],
    },

    aura(g, p, s) {
      const h = s.depth(p.x, s.headY(p));
      const R = s.headR(p) + 28;
      beacon(g, s, p, '#ffc400', '#d7263d');
      s.fx.drawGlow(g, h.x - R, h.y, 60, '#ffc400', 0.55);
      s.fx.drawGlow(g, h.x + R, h.y, 60, '#ffc400', 0.55);
      g.save();
      for (let i = 0; i < 7; i++) {
        const a = s.t * 2.6 + i * TAU / 7;
        coin(g, h.x + Math.cos(a) * R, h.y + Math.sin(a) * R * 0.8, 13, s.t * 9 + i);
      }
      g.restore();
      if (Math.random() < 0.3) {
        const a = Math.random() * TAU;
        s.fx.emit({ shape: 'star', x: h.x + Math.cos(a) * R, y: h.y + Math.sin(a) * R * 0.8, r: 6, life: 0.3, spin: 6, color: '#fff3b0', blend: 'lighter' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#ffc400', (g, a, from) => {
        // the cabinet
        g.fillStyle = '#d7263d'; g.fillRect(-120, -120, 240, 230);
        g.strokeStyle = OUTLINE; g.lineWidth = 6; g.strokeRect(-120, -120, 240, 230);
        g.fillStyle = '#b8860b'; g.fillRect(-130, -150, 260, 36);
        g.fillStyle = '#fff3b0'; g.font = '900 30px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('JACKPOT', 0, -131);
        // bulbs chasing round the marquee
        const st = Math.floor(s.t * 12);
        for (let i = 0; i < 10; i++) { g.fillStyle = (i + st) % 3 ? '#b8860b' : '#fff3b0'; g.beginPath(); g.arc(-117 + i * 26, -108, 5, 0, TAU); g.fill(); }
        // three reels spinning to 7-7-7
        for (let i = 0; i < 3; i++) {
          const rx = -76 + i * 76;
          g.fillStyle = '#fff3b0'; g.fillRect(rx - 32, -80, 64, 100);
          const stop = k > 0.3 + i * 0.12;
          g.fillStyle = '#d7263d'; g.font = '900 64px -apple-system, Arial';
          g.fillText(stop ? '7' : String((st + i * 3) % 9 + 1), rx, -30 + (stop ? 0 : ((s.t * 900) % 40) - 20));
        }
        g.fillStyle = '#1f8f4e'; g.fillRect(-100, 40, 200, 50);
        g.fillStyle = '#ffc400'; for (let i = 0; i < 5; i++) coin(g, -70 + i * 35, 64, 14, s.t * 8 + i);
        // the lever
        const lx = -from * 138, pull = k < 0.3 ? k / 0.3 : 1;
        g.strokeStyle = '#8d949c'; g.lineWidth = 8;
        g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx - from * 20, -90 + pull * 110); g.stroke();
        g.fillStyle = '#d7263d'; g.beginPath(); g.arc(lx - from * 20, -90 + pull * 110, 16, 0, TAU); g.fill();
      });
    },

    fire(s, at) {
      const { fx } = s;
      boom(s, at.x, at.y, { c1: '#ffc400', c2: '#d7263d', core: '#fff3b0', R: 165, rays: 360, n: 16, word: 'ג\'קפוט!', wc: '#ffc400' });
      fx.glyph(at.x, at.y - 20, '777', { color: '#d7263d', r: 34, vy: -70, life: 1.1 });
      fx.burst(at.x, at.y, 26, { shape: 'dot', speed: 420, grav: 800, r: 5, life: 0.9, color: '#ffc400', color2: '#b8860b' });
      fx.burst(at.x, at.y, 12, { shape: 'star', speed: 240, r: 6, spin: 8, life: 0.5, color: '#fff3b0', blend: 'lighter' });
      fx.confetti(at.x, at.y, 20, ['#ffc400', '#1f8f4e', '#d7263d', '#fff3b0']);
      fx.ring(at.x, at.y, { color: '#ffc400', r1: 250, life: 0.6, w: 9, layer: 'front' });
      // the whole casino pays out: gold pours out of the sky and $ signs pop all over the pitch
      sheet(s, 26, 'top', (x, y, i) => ({ shape: 'dot', vx: fx.rand(-30, 30), vy: fx.rand(150, 320), grav: 700, r: 5, life: 1.1, color: '#ffc400', color2: '#b8860b' }));
      sheet(s, 8, 'air', (x, y, i) => ({ shape: 'glyph', text: i % 2 ? '$' : '7', r: 26, vy: -60, life: 0.9, color: i % 2 ? '#1f8f4e' : '#d7263d' }));
      fx.shake(7, 0.3);
      fx.flash('#ffc400', 0.22, 0.18);
      fx.vignette('#ffc400', 0.55, 1.1);
    },

    back(g, e, s) {
      const C = s.C;
      const q = s.M.players[e.target];
      const k = envOf(e, 0.3, 0.4);
      g.save();
      // the casino floor: $ signs and glints drifting down over the whole pitch, and a heap of
      // gold growing round the opponent's feet as the payout goes on
      g.font = '900 22px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round';
      field(g, s, 12, { vy: 60, vx: 8, seed: 41 }, (g, x, y, i) => {
        g.globalAlpha = 0.75 * k;
        g.lineWidth = 4; g.strokeStyle = OUTLINE; g.strokeText('$', x, y);
        g.fillStyle = i % 3 ? '#ffc400' : '#1f8f4e'; g.fillText('$', x, y);
      });
      field(g, s, 16, { vy: 40, seed: 43 }, (g, x, y, i) => {
        g.globalAlpha = k * (0.4 + 0.6 * Math.abs(Math.sin(s.t * 5 + i)));
        g.fillStyle = '#fff3b0';
        g.fillRect(x - 1.5, y - 6, 3, 12); g.fillRect(x - 6, y - 1.5, 12, 3);
      });
      g.globalAlpha = 1;
      const pd = s.depth(q.x, C.GROUND_Y + 2), ph = 4 + 14 * clamp01(e.t / 3) * k;
      s.fx.drawGlow(g, pd.x, pd.y - 6, 70 * k + 1, '#ffc400', 0.5 * k);
      for (let i = 0; i < 9; i++) {
        const u = i / 8 - 0.5, cx = pd.x + u * 90 * k, cy = pd.y - (1 - Math.abs(u) * 2) * ph + (i % 2) * 2;
        g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(cx, cy, 10, 5, 0, 0, TAU); g.fill();
        g.fillStyle = i % 2 ? '#ffc400' : '#b8860b'; g.beginPath(); g.ellipse(cx, cy - 1, 8, 3.5, 0, 0, TAU); g.fill();
      }
      for (const c of e.coins) {
        const k = clamp01((c.y - C.CEIL_Y) / (C.GROUND_Y - C.CEIL_Y));
        const d = s.depth(c.x, C.GROUND_Y + 2);
        s.fx.drawGlow(g, d.x, d.y - 2, 14 + 18 * k, '#1f8f4e', 0.5 * k);
        g.globalAlpha = 0.4 + 0.45 * k;
        g.fillStyle = '#0f3d24';
        g.beginPath(); g.ellipse(d.x, d.y, 4 + 9 * k, 2 + 2 * k, 0, 0, TAU); g.fill();
        g.strokeStyle = '#1f8f4e'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(d.x, d.y, 6 + 10 * k, 3 + 2.5 * k, 0, 0, TAU); g.stroke();
      }
      g.restore();
    },

    front(g, e, s) {
      const C = s.C;
      const q = s.M.players[e.target];
      const k = envOf(e, 0.2, 0.4);
      g.save();
      // a gold wash at the top of the pitch
      g.globalAlpha = 0.14 * k; g.fillStyle = '#ffc400'; g.fillRect(0, 0, C.W, C.CEIL_Y + 60);
      // the slot-machine marquee over the target, bulbs chasing along it
      const mx = Math.max(170, Math.min(C.W - 170, q.x)), my = C.CEIL_Y + 46, mw = 320 * k, mh = 40;
      // two casino spotlights swinging down out of the marquee onto the opponent
      const gy = s.depth(q.x, C.GROUND_Y).y;
      g.globalCompositeOperation = 'lighter';
      for (const o of [-1, 1]) {
        const sx0 = mx + o * mw * 0.4, tx = q.x + Math.sin(s.t * 2.2 + o) * 50;
        const sg = g.createLinearGradient(0, my + mh, 0, gy);
        sg.addColorStop(0, 'rgba(255,243,176,0.4)'); sg.addColorStop(1, 'rgba(255,196,0,0.05)');
        g.globalAlpha = k; g.fillStyle = sg;
        g.beginPath(); g.moveTo(sx0 - 8, my + mh); g.lineTo(sx0 + 8, my + mh); g.lineTo(tx + 60, gy); g.lineTo(tx - 60, gy); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      if (mw > 4) {
        s.fx.drawGlow(g, mx, my + mh / 2, mw * 0.7, '#ffc400', 0.55 * k);
        g.globalAlpha = 0.85;
        g.globalAlpha = 1;
        g.fillStyle = OUTLINE; g.fillRect(mx - mw / 2 - 3, my - 3, mw + 6, mh + 6);
        g.fillStyle = '#d7263d'; g.fillRect(mx - mw / 2, my, mw, mh);
        g.fillStyle = '#b8860b'; g.fillRect(mx - mw / 2, my + mh - 4, mw, 4); g.fillRect(mx - mw / 2, my, mw, 4);
        const n = 20, step = Math.floor(s.t * 10);
        for (let i = 0; i < n; i++) {
          g.fillStyle = (i + step) % 3 ? '#b8860b' : '#fff3b0';
          g.fillRect(mx - mw / 2 + (i + 0.5) * (mw / n) - 2, my + 5, 4, 4);
          g.fillRect(mx - mw / 2 + (i + 0.5) * (mw / n) - 2, my + mh - 9, 4, 4);
        }
        if (k > 0.6) {
          g.font = '900 24px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = OUTLINE;
          g.strokeText('★ 7 7 7 ★', mx, my + mh / 2 + 1);
          g.fillStyle = (step % 2) ? '#fff3b0' : '#ffc400';
          g.fillText('★ 7 7 7 ★', mx, my + mh / 2 + 1);
        }
      }
      // the coins themselves, where the sim has them, lit
      for (const c of e.coins) {
        const d = s.depth(c.x, c.y);
        s.fx.drawGlow(g, d.x, d.y, 34, '#ffc400', 0.65);
        g.globalAlpha = 0.6; g.strokeStyle = '#fff3b0'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(d.x, d.y - 16); g.lineTo(d.x, d.y - 16 - Math.min(56, c.vy * 0.07)); g.stroke();
        g.globalAlpha = 1;
        const sw = Math.abs(Math.cos(s.t * 14 + c.x * 0.37));
        g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(d.x, d.y, Math.max(3, 16 * sw), 16, 0, 0, TAU); g.fill();
        coin(g, d.x, d.y, 14, s.t * 14 + c.x * 0.37);
      }
      g.restore();
    },

    tick(e, s) {
      const { fx, C } = s;
      if (e.coins.length && Math.random() < 0.35) {
        const c = e.coins[Math.floor(Math.random() * e.coins.length)];
        fx.emit({ shape: 'star', x: c.x + fx.rand(-8, 8), y: c.y + fx.rand(-8, 8), r: 5, spin: 8, life: 0.25, color: '#fff3b0', blend: 'lighter' });
      }
      if (Math.random() < 0.2) {
        fx.emit({ shape: 'star', x: fx.rand(0, C.W), y: C.CEIL_Y + fx.rand(0, 40), vy: 60, r: 3, spin: 4, life: 1.2, color: '#ffc400', blend: 'lighter' });
      }
    },

    impact(s, ev) {
      const { fx } = s;
      const q = ev.e && ev.e.target != null ? s.M.players[ev.e.target] : s.foe;
      if (ev.kind === 'land') {
        fx.burst(q.x, s.C.CEIL_Y + 12, 14, { shape: 'star', speed: 150, r: 6, spin: 8, life: 0.5, color: '#fff3b0', blend: 'lighter' });
        fx.rays(q.x, s.C.CEIL_Y + 14, { color: '#ffc400', color2: '#d7263d', r1: 220, n: 12, life: 0.7, alpha: 0.45 });
        fx.glyph(q.x, s.C.CEIL_Y + 34, '$', { color: '#1f8f4e', r: 26, vy: 30, life: 0.8 });
        return;
      }
      const x = q.x, y = s.headY(q) - s.headR(q);
      fx.burst(x, y, 12, { shape: 'dot', speed: 260, spread: 2.4, angle: -Math.PI / 2, grav: 900, r: 3.5, life: 0.55, color: '#ffc400', color2: '#b8860b' });
      fx.emit({ shape: 'star', x, y, r: 14, r1: 3, life: 0.22, color: '#fff3b0', blend: 'lighter' });
      fx.glow(x, y, 50, '#ffc400', { life: 0.3, alpha: 0.7 });
      fx.glyph(x + fx.rand(-12, 12), y - 12, '$', { color: '#ffc400', r: 22, vy: -80, life: 0.7 });
      if (Math.random() < 0.35) fx.stamp(x + fx.rand(-30, 30), Math.max(70, y - 50), 'צ\'ינג!', { color: '#fff3b0', r: 32, life: 0.6 });
      fx.shake(3, 0.12);
    },

    end(s, info) {
      const { fx } = s;
      const q = info.e && info.e.target != null ? s.M.players[info.e.target] : s.foe;
      fx.burst(q.x, s.C.GROUND_Y - 6, 20, { shape: 'dot', speed: 320, spread: 1.6, angle: -Math.PI / 2, grav: 900, r: 4, life: 0.9, color: '#ffc400', color2: '#b8860b' });
      fx.confetti(q.x, s.C.GROUND_Y - 30, 16, ['#ffc400', '#1f8f4e', '#d7263d']);
      fx.glyph(q.x, s.headY(q) - s.headR(q) - 30, '$', { color: '#1f8f4e', r: 30, vy: -50, life: 1.1 });
      fx.stamp(q.x, Math.max(70, s.headY(q) - s.headR(q) - 80), 'כסף!', { color: '#ffc400', r: 40, life: 0.9 });
      fx.glow(q.x, s.C.GROUND_Y - 30, 90, '#ffc400', { life: 1, alpha: 0.45 });
      // the jackpot bursts: a last shower of gold and green over the whole pitch
      fx.rays(q.x, s.C.GROUND_Y - 40, { color: '#ffc400', color2: '#1f8f4e', r1: 520, n: 18, life: 1, alpha: 0.4 });
      sheet(s, 20, 'top', () => ({ shape: 'confetti', vx: fx.rand(-40, 40), vy: fx.rand(40, 160), grav: 260, drag: 1, r: 5, spin: fx.rand(-12, 12), life: 1.8, color: Math.random() < 0.5 ? '#ffc400' : '#1f8f4e' }));
      sheet(s, 14, 'air', () => ({ shape: 'star', vy: fx.rand(20, 60), r: 5, spin: 5, life: 1.6, color: '#fff3b0', blend: 'lighter' }));
    },
  },

  // ── 7 · spring — the pogo coil ───────────────────────────────────────────
  spring: {
    theme: 'Steel pogo spring',
    visual: 'a zig-zag steel coil under the boots that squashes on landing and stretches in the air, teal boing rings, squash lines',
    palette: ['#46e0c8', '#b7c3cc', '#56636e', '#e8fbff', '#2fa894'],
    doc: {
      fantasy: 'The champion bolts a steel spring to their boots: every jump goes higher, and they can bounce again in mid-air.',
      purpose: 'Owns the air for 7 seconds — higher headers and a second jump to reach balls no one else can — and the ball is popped up to make use of it straight away.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball pops straight up off your head (1.25× header lift) and for 7s you jump 1.35× higher with one extra jump in the air.',
      bot: 'POWERS.spring.arm is \'any\' and stage 7 is below the smart bar, so it arms as soon as the meter is full; style \'striker\' — it presses forward to use the height.',
      sequence: {
        anticipation: 'While armed a big coil sits squashed under the champion\'s boots, wobbling with stored tension, over a teal glow, with teal rings pulsing up off it. Over it all the armed beacon: a pillar of teal light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. A bigger coil and three boing rings.',
        activation: 'In the cut-in a giant spring with a boot on top boings up and down. On the pitch: a teal-white sunburst, a teal light blob, three boing rings, steel streaks shot upward, sparkles, teal-steel confetti and a "בוינג!" word; teal edges glow and the screen bounces. The whole pitch turns trampoline: teal jets boing up off the turf end to end, rings pop along the ground and a huge teal ring spreads.',
        main: 'A big coil under the champion\'s feet, driven by their real motion: squashed and wide on the ground, wobbling back after each landing, stretched long while rising and shorter while falling; a teal launch pad glows on the turf under them and their shadow of light follows them into the air; squash and stretch lines, and teal sparkles rise. The pitch becomes a bounce park: sprung pads pump along the turf, teal chevrons rise everywhere, and a ribbon of light traces where the champion\'s boots have been in the air.',
        impact: 'Each jump throws a boing ring and a light from the feet with a boing sound; the air jump a big teal ring, stars and a small "בוינג!"; each landing squash lines out to the sides. On landing the power: a ring, rays, steel bits and a "הופ!". On landing the power a big teal light, a huge ring and a spray of white streaks upward.',
        aftermath: 'The coil unwinds with a falling sproing: steel streaks, sparkles, a grey ring and a teal glow fading at the feet. Every pad on the pitch gives a last boing ring, teal stars float up and a "ספרוינג!" word.',
        cleanup: 'The coil fades over its last 0.4s; rings, sparkles and streaks run out within ~1s.',
      },
      layers: 'Coil, rings and glow (aura); cut-in giant spring and boot; sunburst, glows, rings, streaks, bits, stars, confetti (fire); launch pad and light, coil (back); squash and stretch lines (front); boing rings, glows, stars, stamps (tick).',
      camera: 'Shake 5 and a 1s teal vignette on firing — after that the motion is the player\'s own, the camera stays still.',
      hud: 'The engine\'s 🌀 status pill with its 7s ring over the champion.',
      audio: 'Fire: a rising-then-falling boing. Impact: a short rising sproing. Each jump: a quiet boing blip. End: a detuned sproing falling away.',
      counterplay: 'Stay low and goal-side: the champion wins every aerial for 7s, so deny the bounce — keep the ball on the ground and tackle when they land.',
      perf: '~65 particles on firing, ≤6 a frame from tick (only on a jump or landing) plus ≤1 sparkle; two 14-point polylines and 2 drawGlow a frame; no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.ring, fx.burst, fx.confetti, fx.emit(streak/sq/star), fx.drawGlow, fx.sound, fx.vignette, fx.shake, s.depth; a WeakMap per effect remembers the last landing. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 160, to: 780, type: 'sine', peak: 0.5, dur: 0.2 }, { k: 'sweep', from: 780, to: 320, type: 'triangle', peak: 0.3, dur: 0.25, t: 0.18 }],
      impact: [{ k: 'sweep', from: 260, to: 1040, type: 'sine', peak: 0.35, dur: 0.16 }, { k: 'blip', freq: 1560, type: 'sine', peak: 0.15, dur: 0.06, t: 0.14 }],
      end: [{ k: 'sweep', from: 700, to: 110, type: 'triangle', peak: 0.3, dur: 0.42, detune: 25 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      const wob = Math.sin(s.t * 18) * 3.5;
      beacon(g, s, p, '#46e0c8', '#e8fbff');
      s.fx.drawGlow(g, d.x, d.y + 4, 90, '#46e0c8', 0.6);
      g.save();
      g.strokeStyle = '#46e0c8'; g.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const k = (s.t * 1.6 + i / 3) % 1;
        g.globalAlpha = (1 - k) * 0.9;
        g.beginPath(); g.ellipse(d.x, d.y + 8 - k * 60, 26 + k * 30, 6 + k * 6, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      coil(g, d.x, d.y - 2, d.y + 12 + wob, 26, 3, 6);
      g.restore();
      if (Math.random() < 0.3) {
        s.fx.emit({ shape: 'sq', x: d.x + s.fx.rand(-20, 20), y: d.y + 6, vy: -80, r: 3, life: 0.4, color: '#46e0c8', blend: 'lighter' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#46e0c8', (g) => {
        const bounce = Math.abs(Math.sin(k * Math.PI * 3));
        const top = -40 - bounce * 90;
        coil(g, 0, top, 150, 70, 4, 16);
        // the boot on top
        g.fillStyle = '#2fa894'; g.fillRect(-80, top - 50, 150, 50);
        g.beginPath(); g.ellipse(70, top - 18, 40, 32, 0, 0, TAU); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 6; g.strokeRect(-80, top - 50, 150, 50);
        g.fillStyle = '#e8fbff'; g.fillRect(-80, top - 10, 190, 12);
        g.fillStyle = '#46e0c8'; g.fillRect(-80, top - 110, 70, 62);
        // boing rings off the base
        g.strokeStyle = '#46e0c8'; g.lineWidth = 6;
        for (let i = 0; i < 2; i++) {
          const f = (k * 3 + i / 2) % 1;
          g.globalAlpha = (1 - f) * 0.8;
          g.beginPath(); g.ellipse(0, 150, 80 + f * 90, 18 + f * 12, 0, 0, TAU); g.stroke();
        }
      });
    },

    fire(s, at) {
      const { fx } = s;
      boom(s, at.x, at.y, { c1: '#46e0c8', c2: '#e8fbff', R: 150, rays: 340, n: 14, word: 'בוינג!', wc: '#46e0c8', spin: 2 });
      fx.ring(at.x, at.y, { color: '#46e0c8', r1: 120, life: 0.45, w: 7, layer: 'front' });
      fx.ring(at.x, at.y, { color: '#e8fbff', r1: 80, life: 0.35, w: 5, layer: 'front' });
      fx.ring(at.x, at.y, { color: '#2fa894', r1: 170, life: 0.55, w: 4, layer: 'front' });
      fx.burst(at.x, at.y, 20, { shape: 'streak', speed: 520, spread: 1.4, angle: -Math.PI / 2, w: 3, life: 0.35, color: '#b7c3cc' });
      fx.burst(at.x, at.y, 14, { shape: 'sq', speed: 300, grav: 700, r: 3, life: 0.6, color: '#56636e', color2: '#b7c3cc' });
      fx.burst(at.x, at.y, 8, { shape: 'star', speed: 220, r: 6, spin: 8, life: 0.5, color: '#e8fbff', blend: 'lighter' });
      fx.confetti(at.x, at.y, 14, ['#46e0c8', '#2fa894', '#b7c3cc', '#e8fbff']);
      // the whole pitch turns trampoline: teal jets boing up off the turf end to end
      sheet(s, 26, 'ground', (x, y, i) => ({ shape: 'streak', vx: 0, vy: -fx.rand(500, 900), drag: 1.5, w: 4, life: 0.5, color: i % 2 ? '#46e0c8' : '#e8fbff', blend: 'lighter' }));
      sheet(s, 10, 'ground', () => ({ shape: 'ring', r: 4, r1: 40, w: 4, life: 0.5, color: '#46e0c8', layer: 'back' }));
      fx.ring(at.x, at.y, { color: '#46e0c8', r1: 260, life: 0.65, w: 9, layer: 'front' });
      fx.shake(6, 0.3);
      fx.vignette('#46e0c8', 0.5, 1);
    },

    back(g, e, s) {
      const p = s.M.players[e.target];
      const C = s.C;
      const d = s.depth(p.x, p.y);
      const st = SPRINGS.get(e);
      const k = envOf(e, 0.2, 0.4);
      // the pitch turns into a bounce park: sprung pads pumping along the turf, teal chevrons
      // rising everywhere, and a ribbon of light tracing where the champion's boots have been
      g.save();
      const g0 = s.depth(0, C.GROUND_Y).y;
      for (let i = 0; i < 6; i++) {
        const px = C.W * ((i + 0.5) / 6);
        if (Math.abs(px - p.x) < 80) continue;
        const u = Math.abs(Math.sin(s.t * 4 + i * 1.3)), top = g0 - 6 - u * 16;
        g.globalAlpha = k;
        coil(g, px, top, g0 + 4, 12, 2, 4);
        g.fillStyle = OUTLINE; g.fillRect(px - 22, top - 6, 44, 8);
        g.fillStyle = i % 2 ? '#46e0c8' : '#2fa894'; g.fillRect(px - 20, top - 5, 40, 5);
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      field(g, s, 12, { vy: -120, seed: 51 }, (g, x, y, i) => {
        g.globalAlpha = 0.8 * k;
        g.strokeStyle = OUTLINE; g.lineWidth = 9;
        g.beginPath(); g.moveTo(x - 14, y + 11); g.lineTo(x, y); g.lineTo(x + 14, y + 11); g.stroke();
        g.strokeStyle = i % 2 ? '#46e0c8' : '#e8fbff'; g.lineWidth = 4.5;
        g.beginPath(); g.moveTo(x - 14, y + 11); g.lineTo(x, y); g.lineTo(x + 14, y + 11); g.stroke();
      });
      const st0 = SPRINGS.get(e);
      if (st0 && st0.trail && st0.trail.length > 2) {
        g.globalCompositeOperation = 'lighter';
        for (const [col, lw] of [['#2fa894', 14], ['#e8fbff', 4]]) {
          g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = 0.6 * k;
          g.beginPath();
          st0.trail.forEach((pt, i) => { const q = s.depth(pt.x, pt.y); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
          g.stroke();
        }
      }
      g.restore();
      let len, w;
      if (p.y >= C.GROUND_Y - 1) {
        const since = st ? s.t - st.land : 9;
        const wob = Math.exp(-since * 7) * Math.cos(since * 32);
        len = 9 + 6 * wob; w = 17 + (9 - len) * 0.8;
      } else {
        len = Math.max(12, Math.min(40, 18 - p.vy * 0.035)); w = 13;
      }
      // the launch pad glowing on the turf under them, and the light that follows them up
      const gd = s.depth(p.x, C.GROUND_Y);
      const hgt = clamp01((C.GROUND_Y - p.y) / 200);
      s.fx.drawGlow(g, gd.x, gd.y, (60 + hgt * 30) * k + 1, '#46e0c8', (0.5 - hgt * 0.25) * k);
      s.fx.drawGlow(g, d.x, d.y + len, 40 * k + 1, '#e8fbff', 0.4 * k);
      g.save();
      g.globalAlpha = 0.6 * k; g.strokeStyle = '#2fa894'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(gd.x, gd.y + 2, 34 + Math.sin(s.t * 6) * 4, 7, 0, 0, TAU); g.stroke();
      const yBot = Math.min(d.y + len, C.GROUND_Y + 12);
      g.globalAlpha = k;
      coil(g, d.x, d.y - 3, yBot, w * 1.4, 3, 7);
      // a tall bounce column of light over the champion: rising rings and up-chevrons that say
      // "this one jumps higher" from across the pitch
      const top = s.headY(p) - s.headR(p) - 20, hd = s.depth(p.x, top);
      const col = g.createLinearGradient(0, hd.y - 150, 0, gd.y);
      col.addColorStop(0, 'rgba(70,224,200,0)'); col.addColorStop(1, 'rgba(70,224,200,0.55)');
      g.globalAlpha = 0.7 * k; g.fillStyle = col;
      g.fillRect(d.x - 46, hd.y - 150, 92, gd.y - hd.y + 150);
      for (let i = 0; i < 4; i++) {
        const u = (s.t * 0.9 + i / 4) % 1, y = gd.y - u * (gd.y - hd.y + 150), rx = 50 - u * 16;
        g.globalAlpha = (1 - u) * k; g.strokeStyle = '#0d4a42'; g.lineWidth = 7;
        g.beginPath(); g.ellipse(d.x, y, rx, rx * 0.26, 0, 0, TAU); g.stroke();
        g.strokeStyle = i % 2 ? '#46e0c8' : '#e8fbff'; g.lineWidth = 3.5;
        g.beginPath(); g.ellipse(d.x, y, rx, rx * 0.26, 0, 0, TAU); g.stroke();
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const u = (s.t * 1.6 + i / 3) % 1, y = hd.y - 10 - u * 90;
        g.globalAlpha = (1 - u) * k;
        g.strokeStyle = '#0d4a42'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(d.x - 20, y + 14); g.lineTo(d.x, y); g.lineTo(d.x + 20, y + 14); g.stroke();
        g.strokeStyle = '#46e0c8'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(d.x - 20, y + 14); g.lineTo(d.x, y); g.lineTo(d.x + 20, y + 14); g.stroke();
      }
      g.restore();
      s.fx.drawGlow(g, hd.x, hd.y - 40, 90 * k + 1, '#46e0c8', 0.5 * k);
    },

    front(g, e, s) {
      const p = s.M.players[e.target];
      const st = SPRINGS.get(e);
      if (!st) return;
      const d = s.depth(p.x, p.y);
      g.save();
      g.lineWidth = 3; g.lineCap = 'round';
      const sl = s.t - st.land;
      if (sl < 0.25) {
        g.strokeStyle = '#2fa894'; g.globalAlpha = 1 - sl / 0.25;
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const x0 = d.x + side * (24 + sl * 140), y0 = d.y - 2 - i * 6;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + side * 12, y0); g.stroke();
        }
      }
      const sj = s.t - st.jump;
      if (sj < 0.3) {
        g.strokeStyle = '#e8fbff'; g.globalAlpha = 1 - sj / 0.3;
        for (let i = -2; i <= 2; i++) {
          g.beginPath(); g.moveTo(d.x + i * 8, d.y + 10); g.lineTo(d.x + i * 8, d.y + 32); g.stroke();
        }
      }
      g.restore();
    },

    tick(e, s) {
      const { fx } = s;
      const p = s.M.players[e.target];
      let st = SPRINGS.get(e);
      if (!st) SPRINGS.set(e, st = { air: !p.onGround, vy: p.vy, land: -9, jump: -9 });
      const air = !p.onGround;
      // the boots' path for the light ribbon: the last ~0.5s, only while off the ground
      if (!st.trail) st.trail = [];
      if (air) st.trail.push({ x: p.x, y: p.y });
      else if (st.trail.length) st.trail.shift();
      if (st.trail.length > 30) st.trail.shift();
      if (st.air && !air) {
        st.land = s.t;
        fx.ring(p.x, p.y, { color: '#2fa894', r: 4, r1: 50, life: 0.3, w: 4 });
        fx.emit({ shape: 'sq', x: p.x - 14, y: p.y, vx: -100, vy: -70, grav: 500, r: 3, life: 0.35, color: '#b7c3cc' });
        fx.emit({ shape: 'sq', x: p.x + 14, y: p.y, vx: 100, vy: -70, grav: 500, r: 3, life: 0.35, color: '#b7c3cc' });
      } else if (!st.air && air && p.vy < 0) {
        st.jump = s.t;
        fx.ring(p.x, p.y + 6, { color: '#e8fbff', r: 4, r1: 56, life: 0.35, w: 4 });
        fx.glow(p.x, p.y + 6, 50, '#46e0c8', { life: 0.35, alpha: 0.7 });
        fx.sound([{ k: 'sweep', from: 220, to: 660, type: 'sine', peak: 0.16, dur: 0.12 }]);
      } else if (air && p.vy < st.vy - 150) {
        st.jump = s.t;
        fx.ring(p.x, p.y + 6, { color: '#46e0c8', r: 6, r1: 80, life: 0.4, w: 5 });
        fx.emit({ shape: 'streak', x: p.x, y: p.y + 10, vy: 340, w: 3, life: 0.22, color: '#46e0c8' });
        fx.burst(p.x, p.y + 8, 3, { shape: 'star', speed: 160, r: 5, spin: 8, life: 0.4, color: '#e8fbff', blend: 'lighter' });
        fx.stamp(p.x, Math.max(70, p.y - 150), 'בוינג!', { color: '#46e0c8', r: 30, life: 0.6 });
        fx.sound([{ k: 'sweep', from: 330, to: 990, type: 'sine', peak: 0.2, dur: 0.14 }]);
      } else if (Math.random() < 0.12) {
        fx.emit({ shape: 'star', x: p.x + fx.rand(-20, 20), y: s.C.GROUND_Y - 4, vy: -60, r: 3, spin: 5, life: 0.6, color: '#46e0c8', blend: 'lighter' });
      }
      st.air = air; st.vy = p.vy;
    },

    impact(s, ev) {
      const { fx } = s;
      const p = ev.e && ev.e.target != null ? s.M.players[ev.e.target] : s.owner;
      fx.ring(p.x, p.y, { color: '#2fa894', r1: 100, life: 0.45, w: 6 });
      fx.rays(p.x, p.y, { color: '#46e0c8', color2: '#e8fbff', r1: 200, n: 10, life: 0.5, alpha: 0.45 });
      fx.burst(p.x, p.y, 10, { shape: 'sq', speed: 200, spread: 1.6, angle: -Math.PI / 2, grav: 700, r: 3, life: 0.6, color: '#56636e' });
      fx.stamp(p.x, Math.max(70, p.y - 170), 'הופ!', { color: '#e8fbff', r: 46, life: 0.9 });
      fx.glow(p.x, p.y - 40, 150, '#46e0c8', { life: 0.7, alpha: 0.6 });
      fx.ring(p.x, p.y, { color: '#46e0c8', r1: 220, life: 0.6, w: 8, layer: 'front' });
      fx.burst(p.x, p.y, 16, { shape: 'streak', speed: 700, spread: 1.2, angle: -Math.PI / 2, w: 4, life: 0.4, color: '#e8fbff', blend: 'lighter' });
    },

    end(s, info) {
      const { fx } = s;
      const p = info.e && info.e.target != null ? s.M.players[info.e.target] : s.owner;
      fx.burst(p.x, p.y, 12, { shape: 'streak', speed: 300, w: 2, life: 0.4, color: '#b7c3cc' });
      fx.burst(p.x, p.y, 6, { shape: 'star', speed: 90, r: 4, spin: 6, grav: -40, life: 1, color: '#46e0c8', blend: 'lighter' });
      fx.ring(p.x, p.y, { color: '#56636e', r1: 70, life: 0.45, w: 3 });
      fx.glow(p.x, p.y, 60, '#46e0c8', { life: 0.9, alpha: 0.45 });
      // every pad on the pitch gives one last boing as the spring lets go
      sheet(s, 12, 'ground', () => ({ shape: 'ring', r: 4, r1: 34, w: 4, life: 0.6, color: '#2fa894', layer: 'back' }));
      sheet(s, 16, 'ground', () => ({ shape: 'star', vy: -fx.rand(80, 220), grav: 120, r: 4, spin: 6, life: 1.5, color: '#46e0c8', blend: 'lighter' }));
      fx.stamp(p.x, Math.max(70, s.headY(p) - s.headR(p) - 60), 'ספרוינג!', { color: '#46e0c8', r: 34, life: 0.9 });
    },
  },

  // ── 8 · magnet — the horseshoe ───────────────────────────────────────────
  magnet: {
    theme: 'Horseshoe magnet',
    visual: 'a red-and-blue horseshoe magnet at the boot, curving field lines reaching to the ball, iron filings sliding along them',
    palette: ['#ff4d6d', '#3a6bff', '#c9ced6', '#2d2f38', '#b07cff'],
    doc: {
      fantasy: 'A horseshoe magnet clamps onto the champion\'s boot and the ball is dragged in along its field lines.',
      purpose: 'Four seconds of total ball control: the ball keeps coming back to the champion\'s feet, so they can dribble, shield and pick their shot.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The touch itself does not strike the ball; for 4s it is pulled toward a point 40px ahead of your boot, 22px above the ground, at 1.3× ball gravity, from up to 380px away.',
      bot: 'POWERS.magnet.arm is \'any\' and stage 8 is below the smart bar, so it arms as soon as the meter is full; style \'striker\' — it presses forward with the ball stuck to it.',
      sequence: {
        anticipation: 'While armed a big horseshoe hangs at the champion\'s boot, bobbing, glowing red and blue at its poles, with violet field arcs pulsing off them. Over it all the armed beacon: a pillar of violet light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. A bigger horseshoe with four field arcs.',
        activation: 'In the cut-in a giant horseshoe magnet crackles with field lines and sparks. On the pitch: a red-blue sunburst, a violet light blob, a magnetic beam from the boot to the ball, lightning zaps, red and blue rings, silver sparks, filings and a "זזזט!" word; violet edges glow with a blue tint. Every scrap of iron on the pitch comes flying at the boot and a huge violet ring spreads.',
        main: 'A big horseshoe sits at the real pull point with its glowing poles turned to the ball; thick field lines curve from each pole to the ball while it is within the 380px range (short, searching lines beyond it), iron filings slide along them, field ripples spread across the pitch from the magnet, the pitch takes a violet cast, the ball glows violet with red/blue arcs spinning round it and little zaps crackle between them. Iron filings all over the pitch turn to the magnet and slide in to it, nuts tumble in through the air, and the overhead horseshoe is bigger with lightning crackling across its poles.',
        impact: 'On landing a violet ring and rays round the ball, filings thrown off it and a "קליק!" word. A violet light, red and blue lightning from the boot to the ball and a big red ring.',
        aftermath: 'The magnet lets go: filings drop to the turf, sparks fall, a silver ring spreads from the boot and the violet light fades. Every filing on the pitch drops where it was, violet sparks fall and a "פזזט…" word.',
        cleanup: 'The lines fade over the last 0.4s; filings and sparks fall and fade within ~1.2s.',
      },
      layers: 'Horseshoe, pole glows and arcs (aura); cut-in giant magnet; sunburst, glows, beam, bolts, rings, streaks, filings (fire); violet wash, field ripples, field lines (gradients) with filings, pole and ball glows (back); horseshoe with a single shadowBlur and the spinning capture ring (front); zaps (bolt) and streaks (tick).',
      camera: 'Shake 5, a 0.8s blue tint and a 1s violet vignette on firing; nothing after — control, not violence.',
      hud: 'None beyond the magnet: the field lines themselves show the range and the 4s fade.',
      audio: 'Fire: a detuned pair of rising square hums with a tick. Impact: a metallic clack. End: a falling saw as the field drops.',
      counterplay: 'Get your body between the boot and the ball — tackles and body contact still win it — or clear it past 380px, where the pull stops. It is only 4s.',
      perf: '~60 particles on firing; 4 bezier lines, 12 filings, 2 ripples and 3 drawGlow a frame, one gradient per line, one shadowBlur on the horseshoe; ≤2 particles a frame from tick. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.beam, fx.bolt, fx.ring, fx.burst, fx.emit(streak/sq/star), fx.drawGlow, fx.vignette, fx.shake, fx.tint, s.depth, g.createLinearGradient. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'sweep', from: 90, to: 180, type: 'square', peak: 0.25, dur: 0.45, detune: 8 }, { k: 'sweep', from: 90, to: 180, type: 'square', peak: 0.25, dur: 0.45, detune: -8 }, { k: 'blip', freq: 1760, type: 'sine', peak: 0.2, dur: 0.08, t: 0.4 }],
      impact: [{ k: 'thud', freq: 1900, q: 8, peak: 0.5, decay: 0.06 }, { k: 'blip', freq: 880, type: 'square', peak: 0.18, dur: 0.12 }],
      end: [{ k: 'sweep', from: 240, to: 50, type: 'sawtooth', peak: 0.3, dur: 0.4 }],
    },

    aura(g, p, s) {
      const P = bootPoint(p, s.C);
      const d = s.depth(P.x, P.y + Math.sin(s.t * 6) * 2);
      const ang = p.side > 0 ? 0 : Math.PI;
      beacon(g, s, p, '#b07cff', '#ff4d6d');
      s.fx.drawGlow(g, d.x, d.y + 18, 40, '#ff4d6d', 0.75);
      s.fx.drawGlow(g, d.x, d.y - 18, 40, '#3a6bff', 0.75);
      s.fx.drawGlow(g, d.x + p.side * 30, d.y, 70, '#b07cff', 0.5);
      horseshoe(g, d.x, d.y, 18, ang, false, 13);
      g.save();
      g.strokeStyle = '#b07cff'; g.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const k = (s.t * 1.5 + i / 4) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath(); g.arc(d.x + p.side * 26, d.y, 10 + k * 60, ang - 1, ang + 1); g.stroke();
      }
      g.restore();
      if (Math.random() < 0.2) {
        s.fx.emit({ shape: 'streak', x: d.x + p.side * 60, y: d.y + s.fx.rand(-20, 20), vx: -p.side * 200, w: 2, life: 0.2, color: '#c9ced6' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#b07cff', (g, a, from) => {
        const ang = from > 0 ? Math.PI : 0;
        // field lines fanning out of the poles
        g.strokeStyle = '#b07cff'; g.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          const f = (s.t * 1.2 + i / 3) % 1;
          g.globalAlpha = (1 - f) * a;
          g.beginPath(); g.arc(-from * 120, 0, 60 + f * 120, ang - 0.9, ang + 0.9); g.stroke();
        }
        g.globalAlpha = a;
        horseshoe(g, 0, 0, 90, ang === 0 ? Math.PI : 0, false, 50);
        // sparks crackling between the poles
        g.strokeStyle = '#e8e2ff'; g.lineWidth = 4;
        const px = -from * 108;
        g.beginPath(); g.moveTo(px, -90);
        for (let i = 1; i < 6; i++) g.lineTo(px + Math.sin(s.t * 60 + i * 7) * 16, -90 + i * 30);
        g.stroke();
      });
    },

    fire(s, at) {
      const { fx } = s;
      const P = bootPoint(s.owner, s.C);
      boom(s, at.x, at.y, { c1: '#b07cff', c2: '#ff4d6d', core: '#e8e2ff', R: 150, rays: 340, n: 16, word: 'זזזט!', wc: '#b07cff' });
      fx.beam(P.x, P.y, at.x, at.y, { color: '#b07cff', color2: '#e8e2ff', w: 22, life: 0.4 });
      for (let i = 0; i < 3; i++) fx.bolt(P.x, P.y, at.x + fx.rand(-30, 30), at.y + fx.rand(-30, 30), { color: i % 2 ? '#3a6bff' : '#ff4d6d', w: 3, life: 0.3 });
      fx.ring(P.x, P.y, { color: '#ff4d6d', r1: 130, life: 0.5, w: 6 });
      fx.ring(P.x, P.y, { color: '#3a6bff', r1: 90, life: 0.6, w: 6 });
      fx.burst(at.x, at.y, 24, { shape: 'streak', speed: 380, w: 2, life: 0.35, color: '#c9ced6' });
      fx.burst(at.x, at.y, 20, { shape: 'sq', speed: 260, r: 3, grav: 300, life: 0.7, color: '#2d2f38', color2: '#c9ced6' });
      fx.burst(P.x, P.y, 6, { shape: 'star', speed: 150, r: 5, spin: 8, life: 0.45, color: '#e8e2ff', blend: 'lighter' });
      // every scrap of iron on the pitch comes flying at the boot
      sheet(s, 30, 'air', (x, y) => ({ shape: 'sq', vx: (P.x - x) * 1.6, vy: (P.y - y) * 1.6, r: 4, life: 0.6, color: '#c9ced6', color2: '#2d2f38' }));
      fx.ring(P.x, P.y, { color: '#b07cff', r1: 280, life: 0.6, w: 9, layer: 'front' });
      fx.shake(6, 0.3);
      fx.tint('#3a6bff', 0.1, 0.8);
      fx.vignette('#b07cff', 0.5, 1);
    },

    back(g, e, s) {
      const C = s.C;
      const o = s.M.players[e.owner], b = s.M.ball;
      const P = bootPoint(o, C);
      const k = envOf(e, 0.2, 0.4);
      const dx = b.x - P.x, dy = b.y - P.y;
      const dist = Math.hypot(dx, dy) || 1;
      const within = dist < e.range;
      const reach = within ? dist : Math.min(dist, 120);
      const ux = dx / dist, uy = dy / dist, nx = -uy, ny = ux;
      const ex = P.x + ux * reach, ey = P.y + uy * reach;
      const ang = Math.atan2(dy, dx);
      const pd = s.depth(P.x, P.y);
      g.save();
      // the pitch takes a violet cast, and field ripples spread from the magnet
      g.globalAlpha = 0.14 * k; g.fillStyle = '#b07cff'; g.fillRect(0, 0, C.W, C.H);
      for (let i = 0; i < 3; i++) {
        const f = (s.t * 0.7 + i / 3) % 1;
        g.globalAlpha = (1 - f) * 0.7 * k;
        g.strokeStyle = '#2a1650'; g.lineWidth = 8;
        g.beginPath(); g.arc(pd.x, pd.y, 30 + f * e.range * 1.3, 0, TAU); g.stroke();
        g.strokeStyle = i % 2 ? '#ff4d6d' : '#b07cff'; g.lineWidth = 4;
        g.beginPath(); g.arc(pd.x, pd.y, 30 + f * e.range * 1.3, 0, TAU); g.stroke();
      }
      g.restore();
      // iron filings all over the pitch, each turned to the magnet and sliding in to it, and
      // nuts and bolts tumbling in through the air
      g.save();
      for (let i = 0; i < 36; i++) {
        const bx = hashy(i + 61) * C.W, by = C.CEIL_Y + hashy(i + 67) * (C.GROUND_Y - C.CEIL_Y);
        const u = (s.t * (0.25 + hashy(i) * 0.2) + hashy(i + 3)) % 1, f = u * 0.85;
        const fx0 = bx + (P.x - bx) * f, fy0 = by + (P.y - by) * f;
        const a = Math.atan2(P.y - fy0, P.x - fx0), q = s.depth(fx0, fy0);
        g.globalAlpha = k * Math.sin(u * Math.PI);
        g.save(); g.translate(q.x, q.y); g.rotate(a);
        g.fillStyle = OUTLINE; g.fillRect(-9, -3.5, 18, 7);
        g.fillStyle = '#c9ced6'; g.fillRect(-8, -2.5, 16, 3);
        g.restore();
      }
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const bx = hashy(i + 91) * C.W, by = C.CEIL_Y + 20 + hashy(i + 97) * 200;
        const u = (s.t * 0.35 + i / 5) % 1, f = u * u * 0.95;
        const q = s.depth(bx + (P.x - bx) * f, by + (P.y - by) * f);
        g.globalAlpha = k * Math.min(1, (1 - u) * 5);
        g.save(); g.translate(q.x, q.y); g.rotate(s.t * 6 + i);
        g.fillStyle = '#c9ced6'; g.strokeStyle = OUTLINE;
        g.beginPath(); for (let j = 0; j < 6; j++) { const b = j * TAU / 6; g.lineTo(Math.cos(b) * 8, Math.sin(b) * 8); } g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#2d2f38'; g.fillRect(-3, -3, 6, 6);
        g.restore();
      }
      g.restore();
      s.fx.drawGlow(g, pd.x, pd.y, 110 * k + 1, '#b07cff', 0.7 * k);
      if (within) { const bd = s.depth(b.x, b.y); s.fx.drawGlow(g, bd.x, bd.y, 80 * k + 1, '#b07cff', 0.8 * k); }
      // a giant horseshoe magnet hovering over the champion, poles aimed at the ball, lit
      const hd = s.depth(o.x, s.headY(o) - s.headR(o) - 70 + Math.sin(s.t * 3) * 5);
      s.fx.drawGlow(g, hd.x, hd.y, 100 * k + 1, '#ff4d6d', 0.45 * k);
      g.save();
      g.globalAlpha = k;
      const ha = Math.atan2(b.y - hd.y, b.x - hd.x), HR = 46 * k + 1;
      horseshoe(g, hd.x, hd.y, HR, ha, false, 24);
      // lightning crackling across the gap between its poles
      const t1 = { x: hd.x + Math.cos(ha) * HR * 1.3 - Math.sin(ha) * HR, y: hd.y + Math.sin(ha) * HR * 1.3 + Math.cos(ha) * HR };
      const t2 = { x: hd.x + Math.cos(ha) * HR * 1.3 + Math.sin(ha) * HR, y: hd.y + Math.sin(ha) * HR * 1.3 - Math.cos(ha) * HR };
      for (const [col, lw] of [['#b07cff', 7], ['#e8e2ff', 3]]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(t1.x, t1.y);
        for (let j = 1; j < 6; j++) {
          const f = j / 6, jit = Math.sin(Math.floor(s.t * 20) * 7.3 + j * 4.1) * 12;
          g.lineTo(t1.x + (t2.x - t1.x) * f + Math.cos(ha) * jit, t1.y + (t2.y - t1.y) * f + Math.sin(ha) * jit);
        }
        g.lineTo(t2.x, t2.y); g.stroke();
      }
      g.restore();
      g.save();
      g.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const pole = i < 2 ? 1 : -1;
        const sx = P.x + Math.cos(ang) * 15 - Math.sin(ang) * 14 * pole;
        const sy = P.y + Math.sin(ang) * 15 + Math.cos(ang) * 14 * pole;
        const bulge = (i % 2 ? 0.25 : 0.5) * pole * reach;
        const cx = (sx + ex) / 2 + nx * bulge, cy = (sy + ey) / 2 + ny * bulge;
        const a = s.depth(sx, sy), c = s.depth(cx, cy), z = s.depth(ex, ey);
        const grad = g.createLinearGradient(a.x, a.y, z.x, z.y);
        grad.addColorStop(0, pole > 0 ? '#ff4d6d' : '#3a6bff');
        grad.addColorStop(1, '#b07cff');
        g.globalAlpha = k * (within ? 0.5 : 0.25);
        g.strokeStyle = '#2a1650'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(c.x, c.y, z.x, z.y); g.stroke();
        g.strokeStyle = grad; g.lineWidth = 6;
        g.globalAlpha = k * (within ? 1 : 0.5 + 0.25 * Math.sin(s.t * 10));
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(c.x, c.y, z.x, z.y); g.stroke();
        if (!within) continue;
        g.fillStyle = '#2d2f38';
        for (let j = 0; j < 3; j++) {
          const u = 1 - ((s.t * 0.9 + j / 3 + i * 0.13) % 1);
          const m1 = 1 - u;
          const fx0 = m1 * m1 * a.x + 2 * m1 * u * c.x + u * u * z.x;
          const fy0 = m1 * m1 * a.y + 2 * m1 * u * c.y + u * u * z.y;
          g.fillRect(fx0 - 4, fy0 - 3, 8, 6);
        }
      }
      g.restore();
    },

    front(g, e, s) {
      const o = s.M.players[e.owner], b = s.M.ball;
      const P = bootPoint(o, s.C);
      const k = envOf(e, 0.2, 0.4);
      const d = s.depth(P.x, P.y);
      g.save();
      g.globalAlpha = Math.max(0.2, k);
      horseshoe(g, d.x, d.y, 20, Math.atan2(b.y - P.y, b.x - P.x), true, 13);
      if (Math.hypot(b.x - P.x, b.y - P.y) < e.range) {
        const bd = s.depth(b.x, b.y), R = b.r + 12, a = s.t * 6;
        g.lineWidth = 6;
        g.strokeStyle = '#ff4d6d'; g.beginPath(); g.arc(bd.x, bd.y, R, a, a + 2.2); g.stroke();
        g.strokeStyle = '#3a6bff'; g.beginPath(); g.arc(bd.x, bd.y, R, -a + Math.PI, -a + Math.PI + 2.2); g.stroke();
        g.strokeStyle = '#b07cff'; g.lineWidth = 2; g.beginPath(); g.arc(bd.x, bd.y, R + 7, a * 0.5, a * 0.5 + 1.2); g.stroke();
      }
      g.restore();
    },

    tick(e, s) {
      const o = s.M.players[e.owner], b = s.M.ball;
      const P = bootPoint(o, s.C);
      if (Math.hypot(b.x - P.x, b.y - P.y) >= e.range) return;
      if (Math.random() < 0.35) {
        s.fx.emit({ shape: 'streak', x: b.x, y: b.y, vx: (P.x - b.x) * 2, vy: (P.y - b.y) * 2, w: 2, life: 0.25, color: '#b07cff', layer: 'back' });
      }
      if (Math.random() < 0.06) s.fx.bolt(P.x, P.y, b.x, b.y, { color: '#e8e2ff', w: 2, life: 0.12 });
    },

    impact(s, ev) {
      const { fx } = s;
      fx.ring(ev.x, ev.y, { color: '#b07cff', r1: 90, life: 0.45, w: 5, layer: 'front' });
      fx.rays(ev.x, ev.y, { color: '#b07cff', color2: '#3a6bff', r1: 200, n: 12, life: 0.5, alpha: 0.45 });
      fx.burst(ev.x, ev.y, 12, { shape: 'sq', speed: 200, r: 3, grav: 400, life: 0.6, color: '#2d2f38' });
      fx.stamp(ev.x, Math.max(70, ev.y - 80), 'קליק!', { color: '#e8e2ff', r: 44, life: 0.9 });
      fx.glow(ev.x, ev.y, 130, '#b07cff', { life: 0.6, alpha: 0.7 });
      const P = bootPoint(s.owner, s.C);
      for (let i = 0; i < 4; i++) fx.bolt(P.x, P.y, ev.x + fx.rand(-20, 20), ev.y + fx.rand(-20, 20), { color: i % 2 ? '#ff4d6d' : '#3a6bff', w: 4, life: 0.35 });
      fx.ring(ev.x, ev.y, { color: '#ff4d6d', r1: 200, life: 0.55, w: 7, layer: 'front' });
    },

    end(s, info) {
      const { fx } = s;
      const P = bootPoint(s.owner, s.C);
      fx.burst(P.x, P.y, 14, { shape: 'sq', speed: 140, spread: 2, angle: -Math.PI / 2, grav: 900, r: 3, life: 0.9, color: '#2d2f38' });
      fx.burst(P.x, P.y, 6, { shape: 'star', speed: 120, r: 4, spin: 6, grav: 300, life: 0.9, color: '#e8e2ff', blend: 'lighter' });
      fx.ring(P.x, P.y, { color: '#c9ced6', r1: 80, life: 0.5, w: 3 });
      fx.glow(P.x, P.y, 70, '#b07cff', { life: 1, alpha: 0.45 });
      // the field drops: every filing on the pitch falls where it was, sparking
      sheet(s, 24, 'air', () => ({ shape: 'sq', vx: fx.rand(-20, 20), vy: fx.rand(0, 60), grav: 900, r: 4, life: 1.2, color: '#c9ced6', color2: '#2d2f38' }));
      sheet(s, 10, 'air', () => ({ shape: 'star', vy: fx.rand(20, 60), r: 5, spin: 8, life: 1.2, color: '#b07cff', blend: 'lighter' }));
      fx.stamp(P.x, Math.max(70, P.y - 160), 'פזזט…', { color: '#b07cff', r: 32, life: 0.9 });
    },
  },

  // ── 9 · wave — the red surf ──────────────────────────────────────────────
  wave: {
    theme: 'Red ocean surf',
    visual: 'the ball riding a red sine-wave crest, a foam line and a curling lip, pink spray and droplets, a splash on impact',
    palette: ['#e01e4f', '#8c0f30', '#ff9ab5', '#ffe4ec', '#5a0820'],
    doc: {
      fantasy: 'The champion kicks up a red sea: the ball surfs a rolling wave all the way to the goal.',
      purpose: 'The first shot that is not flat: it rises and falls, so a defender who stands in its line may be under or over it — blocking it is about timing, not position.',
      player: 'Fill the meter, press POWER, then touch the ball with head or body. The ball leaves at 0.95× power-shot speed (≈950px/s), lowered to at least 60px above the ground, and swings 55px up and down on a sine (3π rad/s, one full wave every 0.67s) all the way.',
      bot: 'POWERS.wave.arm is \'attack\', but at stage 9 the ladder is below the smart bar, so it arms as soon as the meter is full; style \'striker\' — it presses forward.',
      sequence: {
        anticipation: 'While armed big red wavelets lap and curl round the champion\'s feet with foam curls spinning on them, a red-pink glow and pink spray flying. Over it all the armed beacon: a pillar of red light from the turf to above the head, a spinning dashed ring with a ripple on the grass, sparks spiralling up, and the power\'s icon in a diamond badge bobbing over the head. Bigger, dark-edged wavelets.',
        activation: 'In the cut-in a giant curling red wave with foam claws breaks across the screen. On the pitch: a red-pink sunburst, a red light blob, a water-jet beam down the shot line, droplets and foam thrown forward, spray confetti, a "גל!" word, red screen edges, a red tint and a shake. Spray fountains burst up off the turf end to end and a huge red ring spreads.',
        main: 'Behind the ball the real sine it has flown is drawn as a tall red wave reaching to the turf — crest on top, deepening body, a thick pink foam line with foam blobs — lit along its crest; a huge white-pink lip curls right over the ball; a red sea swells along the bottom of the pitch; the ball is a red water orb with a foam cap and a white keyline, drawn last. A two-layer red sea with a foam line rolls along the bottom of the whole pitch, fish leap out of it and dive back, bubbles rise everywhere, and the wave body is deeper with a dark-edged crest.',
        impact: 'SPLASH: a red sunburst and light, a huge fountain of red droplets and foam, spray confetti, two rings, a "ספלאש!" word, a heavy shake, a red vignette and tint. A giant slow sunburst and the splash coming down as rain over the whole pitch.',
        aftermath: 'The last droplets rain down, foam hangs and a ripple spreads on the turf under where it ended, under a fading red light. Puddle ripples all along the turf, a last drizzle and spray mist.',
        cleanup: 'Droplets fall under gravity and fade within ~1.5s; the wave is drawn only while the shot flies.',
      },
      layers: 'Wavelets, curls and glow (aura); cut-in giant wave; sunburst, glows, water beam, droplets (dot), confetti, foam (smoke), rings (fire); bottom red sea band, wave body with a vertical gradient, foam crest and blobs, crest glows, curling lip, water orb with keyline (ball); spray (trail); splash (impact/end).',
      camera: 'Shake 7, a red tint and a 1s red vignette on firing; shake 12, a tint and a vignette on the splash.',
      hud: 'The ordinary armed glow and the engine\'s super cut-in with its wave; no lingering status — the power is the shot.',
      audio: 'Fire: a surf roar with a falling whoosh. Impact: a deep splash. End: a soft hiss of spray.',
      counterplay: 'Read the crest: the wave behind the ball shows its rhythm. Step into its line where it will be low and head it, jump it where it will be high, or counter it with a timed kick.',
      perf: '~70 particles on firing, ~80 on the splash, ≤4 a frame in flight; one 34-point polygon, one polyline, a 24-point sea band and 5 drawGlow a frame; no shadowBlur. The pitch-wide layer (armed beacon, ambient field, turf strip) adds ~30-90 plain shapes and ≤7 drawGlow a frame, no shadowBlur; the screen-wide sheets keep every burst ≤~120 particles.',
      helpers: 'boom (fx.glow/rays/ring/stamp), fx.beam, fx.burst, fx.confetti, fx.emit(dot/smoke), fx.drawGlow, fx.vignette, fx.shake, fx.tint, s.depth, g.createLinearGradient. Shared: beacon, field, sheet, speedLines/groundFire where themed.',
    },
    sounds: {
      fire: [{ k: 'crowd', dur: 0.7, peak: 0.35 }, { k: 'sweep', from: 420, to: 110, type: 'sine', peak: 0.4, dur: 0.5 }],
      impact: [{ k: 'thud', freq: 520, q: 0.5, peak: 0.9, decay: 0.5 }, { k: 'crowd', dur: 0.4, peak: 0.25, t: 0.04 }],
      end: [{ k: 'thud', freq: 1300, q: 0.4, peak: 0.14, decay: 0.6 }],
    },

    aura(g, p, s) {
      const d = s.depth(p.x, p.y);
      beacon(g, s, p, '#e01e4f', '#ffe4ec');
      s.fx.drawGlow(g, d.x, d.y - 8, 100, '#e01e4f', 0.55);
      g.save();
      for (const k of [-1, 1]) {
        const x0 = d.x + k * 6, y0 = d.y + 3;
        const h = 30 + Math.sin(s.t * 6 + k) * 7;
        g.fillStyle = '#e01e4f'; g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(x0, y0);
        for (let i = 0; i <= 10; i++) g.lineTo(x0 + k * i * 7, y0 - h * Math.sin((i / 10) * Math.PI) - Math.sin(s.t * 9 + i) * 2);
        g.closePath(); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#8c0f30'; g.globalAlpha = 0.7;
        g.beginPath(); g.moveTo(x0, y0); for (let i = 0; i <= 10; i++) g.lineTo(x0 + k * i * 7, y0 - h * 0.45 * Math.sin((i / 10) * Math.PI)); g.closePath(); g.fill();
        g.strokeStyle = '#ffe4ec'; g.lineWidth = 4; g.globalAlpha = 1;
        const a = s.t * 5 * k;
        g.beginPath(); g.arc(x0 + k * 48, y0 - h + 6, 10, a, a + 4.2); g.stroke();
      }
      g.restore();
      if (Math.random() < 0.45) {
        s.fx.emit({ shape: 'dot', x: d.x + s.fx.rand(-44, 44), y: d.y - 8, vx: s.fx.rand(-50, 50), vy: -170, grav: 700, r: 2.5, life: 0.45, color: '#ffe4ec' });
      }
    },

    cutin(g, s, k) {
      cutStage(g, s, k, '#e01e4f', (g, a, from) => {
        const dir = -from;
        g.scale(dir, 1);
        const gr = g.createLinearGradient(0, -150, 0, 150);
        gr.addColorStop(0, '#e01e4f'); gr.addColorStop(1, '#5a0820');
        g.fillStyle = gr;
        // the body rising into a curl
        g.beginPath();
        g.moveTo(-200, 150);
        g.quadraticCurveTo(-160, 20, -60, -80);
        g.quadraticCurveTo(40, -170, 130, -110);
        g.quadraticCurveTo(170, -70, 120, -40);
        g.quadraticCurveTo(60, -80, 20, -30);
        g.quadraticCurveTo(-20, 40, 60, 150);
        g.closePath(); g.fill();
        g.strokeStyle = OUTLINE; g.lineWidth = 6; g.stroke();
        // the foam lip and claws
        g.strokeStyle = '#ffe4ec'; g.lineWidth = 12;
        g.beginPath(); g.moveTo(-60, -80); g.quadraticCurveTo(40, -170, 130, -110); g.stroke();
        g.fillStyle = '#ffe4ec';
        for (let i = 0; i < 5; i++) {
          const x = 60 + i * 18, y = -130 + i * 16 + Math.sin(s.t * 10 + i) * 4;
          g.beginPath(); g.arc(x, y, 12 - i * 1.5, 0, TAU); g.fill();
        }
        g.strokeStyle = '#ff9ab5'; g.lineWidth = 6;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-40 + i * 20, 40 + i * 30, 26, Math.PI, Math.PI * 1.7); g.stroke(); }
      });
    },

    fire(s, at) {
      const { fx, side } = s;
      boom(s, at.x, at.y, { c1: '#e01e4f', c2: '#ff9ab5', core: '#ffe4ec', R: 170, rays: 360, n: 14, word: 'גל!', wc: '#ff9ab5' });
      fx.beam(at.x, at.y, at.x + side * 300, at.y - 20, { color: '#e01e4f', color2: '#ffe4ec', w: 28, life: 0.35 });
      fx.burst(at.x, at.y, 30, { shape: 'dot', speed: 420, spread: 1.6, angle: side > 0 ? -0.5 : Math.PI + 0.5, grav: 900, r: 4, life: 0.8, color: '#e01e4f', color2: '#8c0f30' });
      fx.burst(at.x, at.y, 14, { shape: 'dot', speed: 240, r: 3, grav: 600, life: 0.6, color: '#ffe4ec' });
      fx.confetti(at.x, at.y, 14, ['#e01e4f', '#ff9ab5', '#ffe4ec', '#8c0f30']);
      fx.burst(at.x, at.y, 6, { shape: 'smoke', speed: 70, r: 6, r1: 22, drag: 2, life: 0.8, color: '#ff9ab5', layer: 'back' });
      fx.ring(at.x, at.y, { color: '#ff9ab5', r1: 120, life: 0.45, w: 6 });
      fx.ring(at.x, at.y, { color: '#e01e4f', r1: 260, life: 0.6, w: 9, layer: 'front' });
      // the sea rises under the whole pitch: spray fountains off the turf end to end
      sheet(s, 28, 'ground', (x, y, i) => ({ shape: 'dot', vx: fx.rand(-40, 40), vy: -fx.rand(260, 520), grav: 900, r: fx.rand(3, 5), life: 0.9, color: i % 3 ? '#e01e4f' : '#ffe4ec', color2: '#8c0f30' }));
      fx.shake(8, 0.35);
      fx.tint('#e01e4f', 0.14, 0.7);
      fx.vignette('#e01e4f', 0.55, 1.1);
    },

    ball(g, b, s) {
      const C = s.C;
      const pw = b.power;
      const dir = (pw && pw.dir) || Math.sign(b.vx) || 1;
      const sp = Math.abs(b.vx) || 950;
      const d = s.depth(b.x, b.y);
      const r = b.r * 1.2;
      // the red sea swelling along the bottom of the pitch: two rolling layers with a foam line,
      // bubbles rising all over, and fish leaping out of it and diving back in
      g.save();
      const g0 = s.depth(0, C.GROUND_Y).y;
      for (const [col, al, h, ph] of [['#8c0f30', 0.4, 34, 0], ['#e01e4f', 0.35, 16, 2]]) {
        g.globalAlpha = al; g.fillStyle = col;
        g.beginPath(); g.moveTo(0, C.H);
        for (let i = 0; i <= 30; i++) { const x = (i / 30) * C.W; g.lineTo(x, g0 - h + Math.sin(i * 0.9 + s.t * 5 * dir + ph) * 7); }
        g.lineTo(C.W, C.H); g.closePath(); g.fill();
      }
      g.globalAlpha = 0.9; g.strokeStyle = '#ffe4ec'; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 30; i++) { const x = (i / 30) * C.W; const y = g0 - 12 + Math.sin(i * 0.9 + s.t * 5 * dir + 2) * 7; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      g.lineWidth = 2;
      field(g, s, 14, { vy: -110, vx: 10, seed: 71, top: C.CEIL_Y, bot: C.GROUND_Y }, (g, x, y, i) => {
        g.globalAlpha = 0.7; g.strokeStyle = i % 2 ? '#ffe4ec' : '#ff9ab5';
        g.beginPath(); g.arc(x, y, 3 + (i % 3) * 2, 0, TAU); g.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const u = (s.t * 0.9 + i / 3) % 1, fx0 = C.W * (0.18 + 0.32 * i) + (u - 0.5) * 120 * (i % 2 ? 1 : -1);
        const fy = g0 - 10 - Math.sin(u * Math.PI) * 120, va = Math.atan2(-Math.cos(u * Math.PI) * 120 * Math.PI, 120 * (i % 2 ? 1 : -1));
        g.globalAlpha = 1;
        g.save(); g.translate(fx0, fy); g.rotate(va); g.scale(1.6, i % 2 ? 1.6 : -1.6);
        g.fillStyle = '#ff9ab5'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 0, 16, 8, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-14, 0); g.lineTo(-26, -8); g.lineTo(-26, 8); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ffffff'; g.fillRect(7, -4, 4, 4); g.fillStyle = OUTLINE; g.fillRect(9, -3, 2, 2);
        g.restore();
      }
      g.restore();
      const L = Math.min(340, (pw ? pw.t : 0) * sp);
      const N = 16;
      g.save();
      if (L > 8) {
        const crest = [];
        for (let i = 0; i <= N; i++) {
          const x = b.x - dir * L * (i / N);
          crest.push(s.depth(x, crestAt(b, x)));
        }
        for (let i = 3; i <= 12; i += 4) s.fx.drawGlow(g, crest[i].x, crest[i].y, 50, '#ff9ab5', 0.45 * (1 - i / N));
        const gd = s.depth(0, C.GROUND_Y);
        const grad = g.createLinearGradient(0, d.y - 60, 0, gd.y);
        grad.addColorStop(0, '#e01e4f');
        grad.addColorStop(1, '#5a0820');
        g.fillStyle = grad;
        g.globalAlpha = 0.62;
        g.beginPath();
        crest.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y)));
        for (let i = N; i >= 0; i--) g.lineTo(crest[i].x, crest[i].y + (gd.y - crest[i].y) * (0.3 + 0.7 * (i / N)));
        g.closePath(); g.fill();
        g.globalAlpha = 0.95;
        g.strokeStyle = OUTLINE; g.lineWidth = 9;
        g.beginPath();
        for (let i = 0; i <= N * 0.75; i++) (i ? g.lineTo(crest[i].x, crest[i].y) : g.moveTo(crest[i].x, crest[i].y));
        g.stroke();
        g.strokeStyle = '#ff9ab5'; g.lineWidth = 5;
        g.beginPath();
        for (let i = 0; i <= N * 0.75; i++) (i ? g.lineTo(crest[i].x, crest[i].y) : g.moveTo(crest[i].x, crest[i].y));
        g.stroke();
        g.fillStyle = '#ffe4ec';
        for (let i = 1; i <= 9; i += 2) {
          g.globalAlpha = 0.9 * (1 - i / N);
          g.beginPath(); g.arc(crest[i].x, crest[i].y - 2 + Math.sin(s.t * 12 + i) * 2, 4.5 - i * 0.3, 0, TAU); g.fill();
        }
      }
      s.fx.drawGlow(g, d.x, d.y, r * 3.4, '#e01e4f', 0.65);
      g.translate(d.x, d.y);
      g.scale(dir, 1);
      // the huge lip curling over from behind the ball
      g.globalAlpha = 0.95;
      g.strokeStyle = '#ff9ab5'; g.lineWidth = 8;
      g.beginPath(); g.arc(-8, -2, r * 2.6, Math.PI * 0.95, TAU - 0.35); g.stroke();
      g.strokeStyle = '#ffe4ec'; g.lineWidth = 4;
      g.beginPath(); g.arc(-8, -2, r * 2.6 + 3, Math.PI * 1.05, TAU - 0.45); g.stroke();
      g.fillStyle = '#ffe4ec';
      for (let i = 0; i < 3; i++) {
        const a = TAU - 0.35 - i * 0.12;
        g.beginPath(); g.arc(-8 + Math.cos(a) * r * 2.6, -2 + Math.sin(a) * r * 2.6 + i * 4, 5 - i, 0, TAU); g.fill();
      }
      // the water orb — the ball
      g.globalAlpha = 1;
      g.fillStyle = '#e01e4f';
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = '#8c0f30';
      g.beginPath(); g.arc(r * 0.2, r * 0.25, r * 0.7, 0, TAU); g.fill();
      g.fillStyle = '#e01e4f';
      g.beginPath(); g.arc(-r * 0.1, -r * 0.1, r * 0.62, 0, TAU); g.fill();
      g.fillStyle = '#ffe4ec';
      g.beginPath(); g.arc(-r * 0.35, -r * 0.4, r * 0.22, 0, TAU); g.fill();
      g.strokeStyle = '#ff9ab5'; g.lineWidth = 2;
      const a = s.t * 10;
      g.beginPath(); g.arc(0, 0, r - 2, a, a + 1.4); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, r + 2, 0, TAU); g.stroke();
      g.restore();
    },

    trail(b, s) {
      const { fx } = s;
      const back = -Math.sign(b.vx) || -1;
      fx.emit({ shape: 'dot', x: b.x + back * 20, y: b.y - 10, vx: back * fx.rand(20, 100), vy: fx.rand(-200, -60), grav: 800, r: 3, life: 0.5, color: '#ffe4ec' });
      fx.emit({ shape: 'dot', x: b.x + back * 40, y: crestAt(b, b.x + back * 40) + 4, vx: back * 40, vy: fx.rand(-100, 0), grav: 700, r: 3.5, life: 0.45, color: '#e01e4f' });
      if (Math.random() < 0.5) fx.emit({ shape: 'smoke', x: b.x + back * 26, y: b.y, vy: -20, r: 4, r1: 14, life: 0.5, color: '#ff9ab5', layer: 'back' });
      if (Math.random() < 0.15) fx.glow(b.x + back * 30, b.y, 36, '#ff9ab5', { life: 0.3, alpha: 0.5 });
    },

    impact(s, ev) {
      const { fx } = s;
      boom(s, ev.x, ev.y, { c1: '#e01e4f', c2: '#ffe4ec', core: '#ffe4ec', R: 210, rays: 440, n: 16, word: 'ספלאש!', wc: '#ff9ab5', wr: 62, up: 110 });
      fx.burst(ev.x, ev.y, 34, { shape: 'dot', speed: 460, grav: 900, r: 4.5, life: 1, color: '#e01e4f', color2: '#8c0f30' });
      fx.burst(ev.x, ev.y, 16, { shape: 'dot', speed: 280, grav: 600, r: 3, life: 0.8, color: '#ffe4ec' });
      fx.burst(ev.x, ev.y, 8, { shape: 'smoke', speed: 90, r: 8, r1: 28, drag: 2, life: 1.1, color: '#ff9ab5', layer: 'back' });
      fx.confetti(ev.x, ev.y, 16, ['#e01e4f', '#ff9ab5', '#ffe4ec']);
      fx.ring(ev.x, ev.y, { color: '#ff9ab5', r1: 180, life: 0.55, w: 8 });
      fx.rays(ev.x, ev.y, { color: '#ff9ab5', color2: '#8c0f30', r1: 680, n: 22, life: 0.9, spin: -1, alpha: 0.4 });
      // the splash comes down as rain over the whole pitch
      sheet(s, 26, 'top', (x, y, i) => ({ shape: 'streak', vx: fx.rand(-30, 30), vy: fx.rand(500, 800), w: 2, life: 0.8, color: i % 2 ? '#ff9ab5' : '#e01e4f' }));
      fx.shake(13, 0.45);
      fx.tint('#e01e4f', 0.16, 0.6);
      fx.vignette('#e01e4f', 0.5, 0.9);
    },

    end(s, info) {
      const { fx, C } = s;
      const b = s.M.ball;
      for (let i = 0; i < fx.n(14); i++) {
        fx.emit({ shape: 'dot', x: b.x + fx.rand(-40, 40), y: b.y - fx.rand(0, 40), vy: fx.rand(0, 60), grav: 800, r: 3, life: 1.1, color: '#e01e4f' });
      }
      for (let i = 0; i < fx.n(4); i++) fx.emit({ shape: 'smoke', x: b.x + fx.rand(-30, 30), y: b.y, vy: -15, r: 8, r1: 26, life: 1.4, color: '#ffe4ec', layer: 'back' });
      fx.ring(b.x, C.GROUND_Y, { color: '#8c0f30', r1: 80, life: 0.8, w: 4 });
      fx.glow(b.x, b.y, 80, '#e01e4f', { life: 1, alpha: 0.4 });
      // the sea runs off the pitch: puddle ripples all along the turf and a last drizzle
      sheet(s, 12, 'ground', () => ({ shape: 'ring', r: 4, r1: fx.rand(24, 44), w: 3, life: fx.rand(0.7, 1.4), color: '#ff9ab5', layer: 'back' }));
      sheet(s, 18, 'top', () => ({ shape: 'streak', vy: fx.rand(400, 600), w: 2, life: 1, color: '#ff9ab5' }));
      sheet(s, 8, 'ground', () => ({ shape: 'smoke', vy: -fx.rand(10, 30), r: 10, r1: 34, life: 1.8, color: '#ffe4ec', layer: 'back' }));
    },
  },
};
