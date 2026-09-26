// Head Soccer's stadium, painted (Idan, 2026-09-26: "do everything like HS").
//
// Off HS's own frames (hs-video/M4 30.2 s): a blue sky with soft clouds and a floodlight mast at
// each end; a roof edge; two tiers of stands packed with a STILL crowd, split by a strip of
// coloured banners and cut by grey stair aisles, a tunnel mouth at the top of the middle aisle;
// then the hoardings and the floor, which game.js draws (hsBoards / hsFloor). Smooth shapes and
// gradients — the opposite of the old 16-bit stages, which stay in stages.js but out of rotation.
//
// Same contract as a stage in stages.js: `draw(g, s)` with s = { W, horizon, crowdTop, crowdBot,
// gy, t } in world units. `static: true` tells game.js the picture never changes, so it is drawn
// once per canvas size instead of twelve times a second.

// A tiny seeded PRNG, so a stadium's crowd is the same crowd every match.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SKIN = ['#f3cba5', '#e8b48c', '#d49a6a', '#b07850', '#7e5236'];
const HAIR = ['#1f1510', '#3b2616', '#5e3b1e', '#141414', '#9a5a26', '#d9b36a', '#6b6b6b'];
const SHIRT = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#00acc1', '#f06292', '#3949ab', '#c0ca33'];
const BANNER = ['#d7263d', '#f4c20d', '#1bb3a6', '#8a3ffc', '#2e86de', '#e84393'];

function sky(g, W, top, bot, night) {
  const gr = g.createLinearGradient(0, top, 0, bot);
  if (night) { gr.addColorStop(0, '#070b24'); gr.addColorStop(1, '#1c2a5e'); }
  else { gr.addColorStop(0, '#2f8fe0'); gr.addColorStop(0.7, '#7cc4f4'); gr.addColorStop(1, '#bfe3fb'); }
  g.fillStyle = gr; g.fillRect(0, top - 60, W, bot - top + 60);
  if (night) return;
  // soft clouds: overlapping white discs with a faint blue underside
  const r = rng(7);
  for (let i = 0; i < 7; i++) {
    const cx = r() * W, cy = top + 12 + r() * (bot - top) * 0.55, s = 18 + r() * 22;
    g.fillStyle = '#ffffffd9';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + (k - 2) * s * 0.8, cy + Math.abs(k - 2) * 3, s * (1 - Math.abs(k - 2) * 0.18), 0, 6.2832); g.fill(); }
  }
}

function mast(g, x, top, bot, night) {
  // lattice tower
  g.strokeStyle = '#8b98a8'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(x - 6, bot); g.lineTo(x - 3, top + 18); g.moveTo(x + 6, bot); g.lineTo(x + 3, top + 18);
  for (let y = bot; y > top + 22; y -= 12) { g.moveTo(x - 6 + (bot - y) * 0.03, y); g.lineTo(x + 5 - (bot - y) * 0.03, y - 12); }
  g.stroke();
  // the light bank
  g.fillStyle = '#5d6878'; g.fillRect(x - 26, top, 52, 22);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = night ? '#fffbe0' : '#e9eef4';
    g.beginPath(); g.arc(x - 18 + i * 12, top + 6 + j * 10, 4, 0, 6.2832); g.fill();
  }
  if (night) {
    const gl = g.createRadialGradient(x, top + 11, 4, x, top + 11, 140);
    gl.addColorStop(0, '#fff8d0cc'); gl.addColorStop(1, '#fff8d000');
    g.fillStyle = gl; g.fillRect(x - 140, top - 130, 280, 280);
  }
}

// One tier of spectators: rows of little painted people, back to front, with stair aisles.
function tier(g, W, top, bot, seed, aisles, night) {
  // the concrete behind them
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, night ? '#2a2f3c' : '#6f7684'); gr.addColorStop(1, night ? '#3a4150' : '#9aa1ad');
  g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
  const r = rng(seed);
  const rowH = 15, colW = 13;
  for (let y = top + 10; y < bot - 2; y += rowH) {
    // the step's lip
    g.fillStyle = night ? '#454c5c' : '#b7bcc6'; g.fillRect(0, y + 8, W, 2);
    for (let x = 4 + ((y / rowH) % 2) * 6; x < W; x += colW) {
      if (aisles.some((a) => Math.abs(x - a) < 20)) continue;
      if (r() < 0.06) continue;                                    // the odd empty seat
      const jx = x + (r() - 0.5) * 3, jy = y + (r() - 0.5) * 2;
      // shirt
      g.fillStyle = pick(r, SHIRT);
      g.beginPath(); g.ellipse(jx, jy + 7, 6, 5, 0, Math.PI, 0); g.fill();
      g.fillRect(jx - 6, jy + 6, 12, 4);
      // head and hair
      g.fillStyle = pick(r, SKIN);
      g.beginPath(); g.arc(jx, jy, 4.6, 0, 6.2832); g.fill();
      g.fillStyle = pick(r, HAIR);
      g.beginPath(); g.arc(jx, jy - 1.2, 4.6, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    }
  }
  // the aisles: grey stairs
  for (const a of aisles) {
    g.fillStyle = night ? '#3b4252' : '#c9cdd4'; g.fillRect(a - 16, top, 32, bot - top);
    g.fillStyle = night ? '#2c3240' : '#a5abb5';
    for (let y = top + 6; y < bot; y += 8) g.fillRect(a - 16, y, 32, 2);
    g.fillStyle = '#e9edf2'; g.fillRect(a - 1, top, 2, bot - top);   // the handrail
  }
  if (night) { g.fillStyle = '#0a0f2a40'; g.fillRect(0, top, W, bot - top); }
}

function stadium(night, seed) {
  return (g, s) => {
    // placed off HS's screen (M4 30.2 s): the roof ~22% down it, the banner strip ~40%, with the
    // pitch filling the phone's width (game.js resize) — which crops the world above y ≈ 33
    const W = s.W, roofTop = s.gy * 0.33, roofBot = roofTop + 14;
    const midA = s.gy * 0.555, midB = midA + 15, bot = s.crowdBot + 8;
    sky(g, W, 0, roofTop, night);
    mast(g, W * 0.1, roofTop - 88, roofTop + 4, night);
    mast(g, W * 0.9, roofTop - 88, roofTop + 4, night);
    // the roof edge
    g.fillStyle = night ? '#1b2030' : '#dfe4ea'; g.fillRect(0, roofTop, W, roofBot - roofTop);
    g.fillStyle = night ? '#0e121c' : '#8d96a3'; g.fillRect(0, roofBot - 4, W, 4);
    const aisles = [W * 0.08, W * 0.5, W * 0.92];
    tier(g, W, roofBot, midA, seed, aisles, night);
    // the tunnel mouth at the top of the middle aisle (HS: a dark doorway with a white frame)
    g.fillStyle = '#f1f3f6'; g.fillRect(W * 0.5 - 30, roofBot, 60, 30);
    g.fillStyle = '#20252f'; g.fillRect(W * 0.5 - 24, roofBot + 4, 48, 26);
    // the banner strip between the tiers
    for (let i = 0; i < 6; i++) {
      g.fillStyle = BANNER[(i + seed) % BANNER.length];
      g.fillRect(i * W / 6 + 3, midA, W / 6 - 6, midB - midA);
    }
    g.fillStyle = '#00000033'; g.fillRect(0, midB - 3, W, 3);
    tier(g, W, midB, bot, seed + 11, aisles, night);
  };
}

// The rotation. `floor` picks game.js's floor painter; `boards` the hoarding set.
export const HS_STAGES = [
  { id: 'hs-day', name: 'אצטדיון', hs: true, static: true, floor: 'grass', sky: '#2f8fe0',
    grass: ['#3f9a2a', '#4aab31'], wall: '#27313f', draw: stadium(false, 3) },
  { id: 'hs-night', name: 'אצטדיון בלילה', hs: true, static: true, floor: 'grass', sky: '#070b24',
    grass: ['#2f7e22', '#389029'], wall: '#161b26', draw: stadium(true, 5) },
  { id: 'hs-arena', name: 'אולם', hs: true, static: true, floor: 'wood', sky: '#2f8fe0',
    grass: ['#d59a55', '#c98c48'], wall: '#27313f', draw: stadium(false, 9) },
];
