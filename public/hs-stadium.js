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

const SKIN = ['#f6d2b0', '#eebd96', '#dca577', '#c48a5c', '#a06a42', '#7a4c2c', '#5a3620'];
const HAIR = ['#1f1510', '#3b2616', '#5e3b1e', '#141414', '#9a5a26', '#e0bd72', '#8a8a8a', '#b8432a'];
const SHIRT = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#00acc1', '#f06292', '#3949ab', '#c0ca33', '#222831'];
const BANNER = ['#d7263d', '#f4c20d', '#1bb3a6', '#8a3ffc', '#2e86de', '#e84393'];
const TAU = 6.2832;

function sky(g, W, top, bot, night) {
  const gr = g.createLinearGradient(0, top, 0, bot);
  if (night) { gr.addColorStop(0, '#050820'); gr.addColorStop(0.6, '#111c48'); gr.addColorStop(1, '#23326a'); }
  // HS M4 (arena, day): a bright CYAN sky — (44, 211, 250) between the clouds — not a soft blue
  else { gr.addColorStop(0, '#12a6ec'); gr.addColorStop(0.6, '#2cd0fa'); gr.addColorStop(1, '#9fe8ff'); }
  g.fillStyle = gr; g.fillRect(0, top - 60, W, bot - top + 60);
  const r = rng(7);
  if (night) {                                       // a few stars
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; g.fillRect(r() * W, top + r() * (bot - top) * 0.8, 1.2, 1.2); }
    return;
  }
  // soft clouds: puffs lit from above, a faint blue-grey belly
  for (let i = 0; i < 7; i++) {
    const cx = r() * W, cy = top + 14 + r() * (bot - top) * 0.5, sz = 16 + r() * 22;
    for (let k = 0; k < 6; k++) {
      const px = cx + (k - 2.5) * sz * 0.72, py = cy + Math.abs(k - 2.5) * 3.2, pr = sz * (1 - Math.abs(k - 2.5) * 0.14);
      const cg = g.createRadialGradient(px - pr * 0.2, py - pr * 0.45, pr * 0.1, px, py, pr);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.75, '#f1f7fd'); cg.addColorStop(1, '#d6e6f5');
      g.fillStyle = cg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
    }
  }
}

function mast(g, x, top, bot, night) {
  // lattice tower, lit on one side
  g.lineCap = 'round';
  g.strokeStyle = night ? '#5b6678' : '#8b98a8'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(x - 6, bot); g.lineTo(x - 3, top + 20); g.moveTo(x + 6, bot); g.lineTo(x + 3, top + 20); g.stroke();
  g.lineWidth = 1.2; g.beginPath();
  for (let y = bot; y > top + 24; y -= 10) { g.moveTo(x - 6 + (bot - y) * 0.03, y); g.lineTo(x + 5 - (bot - y) * 0.03, y - 10); g.moveTo(x - 5 + (bot - y) * 0.03, y - 10); g.lineTo(x + 5 - (bot - y) * 0.03, y - 10); }
  g.stroke();
  // the light bank: a framed panel of lamps
  const fr = g.createLinearGradient(0, top, 0, top + 24);
  fr.addColorStop(0, '#77839a'); fr.addColorStop(1, '#434c5c');
  g.fillStyle = fr; g.beginPath(); g.roundRect(x - 28, top, 56, 24, 3); g.fill();
  g.fillStyle = '#2c3340'; g.fillRect(x - 25, top + 3, 50, 18);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const lx = x - 18.5 + i * 12.3, ly = top + 7.5 + j * 9;
    const lg = g.createRadialGradient(lx - 1, ly - 1, 0.5, lx, ly, 4);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.6, night ? '#fff6c8' : '#e3ebf5'); lg.addColorStop(1, night ? '#e8c860' : '#9eabbd');
    g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 4, 0, TAU); g.fill();
  }
  if (night) {
    const gl = g.createRadialGradient(x, top + 12, 4, x, top + 12, 160);
    gl.addColorStop(0, '#fff8d0dd'); gl.addColorStop(0.25, '#fff8d055'); gl.addColorStop(1, '#fff8d000');
    g.fillStyle = gl; g.fillRect(x - 160, top - 150, 320, 320);
  }
}

// ONE SPECTATOR, a little cartoon fan in the style of the players: a round shaded head with a
// keyline, eyes and a mouth, one of several haircuts or a hat, shoulders in a shaded shirt and,
// for some, arms up or a scarf held overhead. (x, y) is the seat line; `s` the size for the row's
// depth; `look` which way the eyes point.
function fan(g, x, y, s, r, look, night) {
  const skin = pick(r, SKIN), hair = pick(r, HAIR), shirt = pick(r, SHIRT);
  const ol = night ? 'rgba(0,0,6,0.6)' : 'rgba(28,18,30,0.5)';
  const hr = 5.2 * s, hx = x, hy = y - 10.8 * s;
  const hs = r(), pose = r(), lw = 0.75 * s;
  const style = hs < 0.3 ? 'short' : hs < 0.45 ? 'long' : hs < 0.55 ? 'curly' : hs < 0.65 ? 'bald' : hs < 0.8 ? 'cap' : hs < 0.9 ? 'beanie' : 'spiky';
  const hat = pick(r, SHIRT);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // arms up (behind the shoulders): cheering, or a scarf stretched overhead
  const scarf = pose < 0.07, up = scarf || pose < 0.2 ? 2 : pose < 0.3 ? 1 : 0;
  const side = r() < 0.5 ? -1 : 1;
  for (let k = 0; k < up; k++) {
    const d = up === 2 ? (k ? 1 : -1) : side;
    const sx = hx + d * 5 * s, sy = y - 4 * s, ex = hx + d * (scarf ? 7.5 : 7) * s, ey = hy - (scarf ? 7.5 : 6.5) * s;
    g.strokeStyle = ol; g.lineWidth = 3.4 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = shirt; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(ex, ey, 1.6 * s, 0, TAU); g.fill();
  }
  if (scarf) {
    const c1 = pick(r, BANNER), sw = 7.5 * s, sy = hy - 8.5 * s;
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ffffff' : c1; g.fillRect(hx - sw + (i * 2 * sw) / 5, sy, (2 * sw) / 5 + 0.3, 2.8 * s); }
    g.strokeStyle = ol; g.lineWidth = 0.5 * s; g.strokeRect(hx - sw, sy, 2 * sw, 2.8 * s);
  }
  // long hair and curls sit behind the head
  if (style === 'long') {
    g.fillStyle = hair; g.beginPath(); g.roundRect(hx - hr * 1.12, hy - hr * 0.6, hr * 2.24, hr * 1.95, hr * 0.6); g.fill();
  } else if (style === 'curly') {
    g.fillStyle = hair; g.strokeStyle = ol; g.lineWidth = lw;
    g.beginPath(); g.arc(hx, hy - hr * 0.2, hr * 1.3, 0, TAU); g.fill(); g.stroke();
  }
  // shoulders and chest
  const t = 7 * s;
  g.beginPath();
  g.moveTo(hx - t, y + 6 * s); g.lineTo(hx - t, y - 0.5 * s);
  g.quadraticCurveTo(hx - t, y - 5.8 * s, hx - 2.6 * s, y - 6.2 * s); g.lineTo(hx + 2.6 * s, y - 6.2 * s);
  g.quadraticCurveTo(hx + t, y - 5.8 * s, hx + t, y - 0.5 * s); g.lineTo(hx + t, y + 6 * s); g.closePath();
  g.fillStyle = shirt; g.fill();
  const sg = g.createLinearGradient(hx - t, 0, hx + t, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0.22)'); sg.addColorStop(0.45, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sg; g.fill();
  if (r() < 0.2) {                                   // a striped jersey
    g.save(); g.clip(); g.fillStyle = shirt === '#f5f5f5' ? '#1e88e5' : 'rgba(255,255,255,0.75)';
    for (let i = -2; i <= 2; i++) g.fillRect(hx + i * 3 * s - 0.7 * s, y - 7 * s, 1.4 * s, 14 * s);
    g.restore();
  }
  g.strokeStyle = ol; g.lineWidth = lw; g.stroke();
  // neck and V collar
  g.fillStyle = skin; g.beginPath(); g.moveTo(hx - 2.2 * s, y - 6.3 * s); g.lineTo(hx + 2.2 * s, y - 6.3 * s); g.lineTo(hx, y - 3.2 * s); g.closePath(); g.fill();
  // ears, then the head over them
  g.fillStyle = skin; g.strokeStyle = ol; g.lineWidth = lw;
  for (const d of [-1, 1]) { g.beginPath(); g.arc(hx + d * hr * 0.95, hy + 0.6 * s, 1.5 * s, 0, TAU); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fillStyle = skin; g.fill();
  const hg = g.createRadialGradient(hx - hr * 0.35, hy - hr * 0.45, hr * 0.1, hx, hy, hr * 1.05);
  hg.addColorStop(0, 'rgba(255,255,255,0.3)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(60,20,10,0.22)');
  g.fillStyle = hg; g.fill(); g.stroke();
  // hair / hat on top
  g.fillStyle = hair;
  if (style === 'short' || style === 'long' || style === 'curly') {
    g.beginPath(); g.arc(hx, hy, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0);
    g.quadraticCurveTo(hx + hr * 0.7, hy - hr * 0.55, hx + hr * 0.2 * side, hy - hr * 0.35);
    g.quadraticCurveTo(hx - hr * 0.6, hy - hr * 0.55, hx - hr * 1.04, hy);
    g.fill(); g.stroke();
  } else if (style === 'spiky') {
    g.beginPath(); g.moveTo(hx - hr * 1.02, hy - hr * 0.1);
    for (let i = 0; i <= 5; i++) { const a = Math.PI * (1.05 + i * 0.18); g.lineTo(hx + Math.cos(a) * hr * 1.35, hy + Math.sin(a) * hr * 1.35); g.lineTo(hx + Math.cos(a + 0.28) * hr * 0.95, hy + Math.sin(a + 0.28) * hr * 0.95); }
    g.lineTo(hx + hr * 1.02, hy - hr * 0.1); g.quadraticCurveTo(hx, hy - hr * 0.6, hx - hr * 1.02, hy - hr * 0.1); g.fill(); g.stroke();
  } else if (style === 'cap') {
    g.fillStyle = hat; g.beginPath(); g.arc(hx, hy - hr * 0.12, hr * 1.06, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx + look * hr * 0.9, hy - hr * 0.1, hr * 0.85, hr * 0.26, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(hx - hr * 0.35, hy - hr * 0.7, hr * 0.25, 0, TAU); g.fill();
  } else if (style === 'beanie') {
    g.fillStyle = hat; g.beginPath(); g.arc(hx, hy - hr * 0.1, hr * 1.06, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(hx - hr * 1.06, hy - hr * 0.32, hr * 2.12, hr * 0.32); g.strokeRect(hx - hr * 1.06, hy - hr * 0.32, hr * 2.12, hr * 0.32);
    g.beginPath(); g.arc(hx, hy - hr * 1.18, hr * 0.32, 0, TAU); g.fill(); g.stroke();
  } else {                                           // bald: a shine
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(hx - hr * 0.3, hy - hr * 0.55, hr * 0.35, hr * 0.2, -0.4, 0, TAU); g.fill();
  }
  // the face: eyes towards the play, a mouth — open for the ones cheering
  const ex = hx + look * 1.1 * s, ey = hy + 0.5 * s;
  g.fillStyle = '#1b1320';
  for (const d of [-1, 1]) { g.beginPath(); g.ellipse(ex + d * 1.9 * s, ey, 0.75 * s, 1 * s, 0, 0, TAU); g.fill(); }
  if (up) { g.beginPath(); g.ellipse(ex, ey + 2.6 * s, 1.2 * s, 1 * s, 0, 0, TAU); g.fillStyle = '#6b1d22'; g.fill(); }
  else { g.strokeStyle = '#6b2a24'; g.lineWidth = 0.6 * s; g.beginPath(); g.arc(ex, ey + 1.5 * s, 1.3 * s, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
}

// One tier: stepped rows of blue seats with the crowd in them, back to front so every row sits
// in front of the one behind; the back rows a little smaller and hazier, so the stand recedes.
// HS's crowd (M4 20 s, side by side with ours): about four rows a tier of BIG fans packed
// shoulder to shoulder, warm and a little dark (mean 119, 99, 84; brightness 0.53) and soft — the
// whole stand is out of focus behind the play (edge detail 13 against the 50 ours had with ~7
// rows of small, sharp fans). CROWD is the fan's size against the old one.
const CROWD = 1.9;
// The stands are painted at this fraction of full resolution and scaled up: HS's crowd is soft,
// out of focus behind the play (Idan: "the audience are way too clear").
const SOFT = 0.33;
function tier(g, W, top, bot, seed, aisles, night) {
  const gr = g.createLinearGradient(0, top, 0, bot);
  // HS M5's night stands are floodlit: light grey concrete under the dark sky, not navy
  gr.addColorStop(0, night ? '#6c6e76' : '#6a625b'); gr.addColorStop(1, night ? '#8a8c93' : '#8a8178');
  g.fillStyle = gr; g.fillRect(0, top, W, bot - top);
  const r = rng(seed);
  const rows = [];
  for (let y = top + 13 * CROWD; y < bot + 4 * CROWD; y += 16.5 * CROWD) rows.push(y);
  rows.forEach((y, ri) => {
    const depth = rows.length > 1 ? ri / (rows.length - 1) : 1;
    const s = (0.86 + 0.16 * depth) * CROWD, colW = 13.5 * s;
    // the step: a lit riser and the row of seat backs
    g.fillStyle = night ? '#a4a6ad' : '#aeb4be'; g.fillRect(0, y + 3, W, 1.6);
    // the benches: HS's are grey concrete, not blue seats
    g.fillStyle = night ? '#9a9ca4' : '#8a857e'; g.fillRect(0, y - 1, W, 4);
    g.fillStyle = night ? '#b6b8bf' : '#aaa59d'; g.fillRect(0, y - 1, W, 1.2);
    for (let x = 6 + (ri % 2) * colW * 0.5; x < W; x += colW) {
      if (aisles.some((a) => Math.abs(x - a) < 22)) continue;
      // HS's stands are not full: ~a quarter of the day crowd's seats are empty (M1, M4), most of
      // the night stadium's (M5)
      if (r() < (night ? 0.6 : 0.22)) continue;
      const look = Math.max(-1, Math.min(1, (W / 2 - x) / (W * 0.35))) * 0.7 + (r() - 0.5) * 0.6;
      fan(g, x + (r() - 0.5) * 3, y + (r() - 0.5) * 1.5, s * (0.94 + r() * 0.12), r, look, night);
    }
    // the haze of distance over the back rows
    if (depth < 1) { g.fillStyle = night ? `rgba(30,32,44,${0.14 * (1 - depth)})` : `rgba(40,26,18,${0.18 * (1 - depth)})`; g.fillRect(0, y - 20 * CROWD, W, 24 * CROWD); }
  });
  // the aisles: concrete stairs with yellow step edges and a handrail
  for (const a of aisles) {
    const ag = g.createLinearGradient(a - 18, 0, a + 18, 0);
    ag.addColorStop(0, night ? '#2e3442' : '#aeb3bc'); ag.addColorStop(0.5, night ? '#434a5a' : '#d3d7de'); ag.addColorStop(1, night ? '#2e3442' : '#aeb3bc');
    g.fillStyle = ag; g.fillRect(a - 18, top, 36, bot - top);
    for (let y = top + 5; y < bot; y += 8.25) {
      g.fillStyle = night ? '#222733' : '#9197a2'; g.fillRect(a - 18, y + 1.6, 36, 2.2);
      g.fillStyle = night ? '#8a7a30' : '#f2c230'; g.fillRect(a - 18, y, 36, 1.2);
    }
    g.fillStyle = '#00000030'; g.fillRect(a - 0.5, top, 3, bot - top);
    g.fillStyle = '#eef1f5'; g.fillRect(a - 1.2, top, 2, bot - top);
  }
  // the shade at the top of the tier, under whatever overhangs it
  const sh = g.createLinearGradient(0, top, 0, top + 26);
  sh.addColorStop(0, 'rgba(0,0,10,0.45)'); sh.addColorStop(1, 'rgba(0,0,10,0)');
  g.fillStyle = sh; g.fillRect(0, top, W, 26);

}

function stadium(night, seed) {
  return (g, s) => {
    // placed off HS's screen (M4 30.2 s): the roof ~22% down it, the banner strip ~40%, with the
    // pitch filling the phone's width (game.js resize) — which crops the world above y ≈ 33
    const W = s.W, roofTop = s.gy * 0.215, roofBot = roofTop + 16;
    const midA = s.gy * 0.49, midB = midA + 17, bot = s.crowdBot + 8;
    sky(g, W, 0, roofTop, night);
    mast(g, W * 0.1, 8, roofTop + 4, night);
    mast(g, W * 0.9, 8, roofTop + 4, night);
    // the roof edge
    const rf = g.createLinearGradient(0, roofTop, 0, roofBot);
    rf.addColorStop(0, night ? '#2a3044' : '#f4f7fa'); rf.addColorStop(0.55, night ? '#1b2030' : '#d6dce4'); rf.addColorStop(1, night ? '#11151f' : '#9aa4b1');
    g.fillStyle = rf; g.fillRect(0, roofTop, W, roofBot - roofTop);
    g.fillStyle = night ? '#1f4a8a' : '#2466b8'; g.fillRect(0, roofTop + 5, W, 3);
    g.fillStyle = night ? '#0b0e16' : '#6e7886'; g.fillRect(0, roofBot - 2, W, 2);
    const aisles = [W * 0.08, W * 0.5, W * 0.92];
    // OUT OF FOCUS, as HS's stands are: both tiers are painted at a third of the resolution (SOFT) and scaled up
    // smoothly, then warmed and darkened a touch (HS's crowd: brightness 0.53, warm 119/99/84).
    // (A canvas `filter: blur()` did the same on desktop and blanked the stands in headless
    // Chrome, so it is not trusted.)
    const H2 = bot + 10, soft = document.createElement('canvas');
    soft.width = Math.ceil(W * SOFT); soft.height = Math.ceil(H2 * SOFT);
    const h = soft.getContext('2d');
    h.scale(SOFT, SOFT);
    tier(h, W, roofBot, midA, seed, aisles, night);
    tier(h, W, midB, bot, seed + 11, aisles, night);
    if (!night) { h.fillStyle = 'rgba(52,30,16,0.16)'; h.fillRect(0, roofBot, W, bot - roofBot); }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(soft, 0, roofBot * SOFT, soft.width, soft.height - roofBot * SOFT, 0, roofBot, W, H2 - roofBot);
    // the banner strip between the tiers
    for (let i = 0; i < 6; i++) {
      const bx = i * W / 6 + 3, bw = W / 6 - 6, c = BANNER[(i + seed) % BANNER.length];
      g.fillStyle = c; g.fillRect(bx, midA, bw, midB - midA);
      const bg = g.createLinearGradient(0, midA, 0, midB);
      bg.addColorStop(0, 'rgba(255,255,255,0.35)'); bg.addColorStop(0.45, 'rgba(255,255,255,0.05)'); bg.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = bg; g.fillRect(bx, midA, bw, midB - midA);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let k = bx + 8; k < bx + bw - 6; k += 14) { g.beginPath(); g.moveTo(k, midB); g.lineTo(k + 6, midA); g.lineTo(k + 10, midA); g.lineTo(k + 4, midB); g.fill(); }
    }
    g.fillStyle = '#00000033'; g.fillRect(0, midB - 3, W, 3);
    // the tunnel mouth at the top of the middle aisle (HS: a dark doorway with a white frame)
    const tf = g.createLinearGradient(0, roofBot, 0, roofBot + 30);
    tf.addColorStop(0, '#ffffff'); tf.addColorStop(1, '#c9ced6');
    g.fillStyle = tf; g.fillRect(W * 0.5 - 30, roofBot, 60, 30);
    const ti = g.createLinearGradient(0, roofBot + 4, 0, roofBot + 30);
    ti.addColorStop(0, '#0c0f16'); ti.addColorStop(1, '#2c3342');
    g.fillStyle = ti; g.fillRect(W * 0.5 - 24, roofBot + 4, 48, 26);
  };
}

// The rotation. `floor` picks game.js's floor painter; `boards` the hoarding set.
export const HS_STAGES = [
  { id: 'hs-day', name: 'אצטדיון', hs: true, static: true, floor: 'grass', sky: '#2f8fe0',
    grass: ['#8db060', '#9dbb6b'], wall: '#27313f', draw: stadium(false, 3) },   // HS M1's day pitch: a pale olive green (141–159, 176–186, 96–107)
  { id: 'hs-night', name: 'אצטדיון בלילה', hs: true, static: true, floor: 'grass', sky: '#070b24',
    grass: ['#30b27d', '#3abd87'], wall: '#161b26', draw: stadium(true, 5) },   // HS M5's night pitch: teal (48–70, 178–188, 125–137)
  { id: 'hs-arena', name: 'אולם', hs: true, static: true, floor: 'wood', sky: '#2f8fe0',
    grass: ['#d59a55', '#c98c48'], wall: '#27313f', draw: stadium(false, 9) },
];
