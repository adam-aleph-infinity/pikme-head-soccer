// Street Fighter II stages, rebuilt as original pixel art.
//
// Capcom's actual background ART is theirs, so none of it is copied here — what is borrowed
// is the STAGE DESIGN language, which is the part that actually matters: a strong silhouette
// on the horizon, one big readable landmark, a band of onlookers, and two or three props
// that move. That is why an SF2 stage is recognisable from a thumbnail, and it is entirely
// reproducible without touching their pixels.
//
// Every stage draws into the band ABOVE the pitch. The hoardings, grass, goals and players
// are drawn by game.js on top, so a stage only ever owns sky → horizon → crowd.

const OUTLINE = '#0b0710';

// ---- shared pixel helpers -------------------------------------------------
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const OUT = (g, x, y, w, h, c) => { R(g, x - 1, y - 1, w + 2, h + 2, OUTLINE); R(g, x, y, w, h, c); };

// Flat colour bands instead of a gradient — SF2 skies are banded, and a gradient is the
// single fastest way to stop looking like a 16-bit game.
function bands(g, W, top, bot, colors) {
  const h = (bot - top) / colors.length;
  for (let i = 0; i < colors.length; i++) R(g, 0, top + i * h, W, h + 1, colors[i]);
}

function silhouette(g, W, baseY, peaks, color, seed = 0) {
  g.fillStyle = color;
  for (let i = 0; i < peaks; i++) {
    const x = (i - 0.5) * (W / (peaks - 1.5)) + ((seed * 37 + i * 53) % 40) - 20;
    const w = W / peaks * 1.9;
    const h = 40 + ((seed * 17 + i * 29) % 46);
    g.beginPath();
    g.moveTo(x, baseY);
    g.lineTo(x + w / 2, baseY - h);
    g.lineTo(x + w, baseY);
    g.closePath();
    g.fill();
  }
}

// A block of onlookers. Every SF2 stage has them, and they are what make a backdrop feel
// like a place people came to rather than a painting.
function onlookers(g, W, top, bot, crowd, t, palette) {
  for (const c of crowd) {
    const y = top + 6 + c.f * (bot - top - 14);
    const bob = Math.sin(t * 3 + c.ph) > 0 ? 0 : 2;
    R(g, c.x - 1, y + bob - 1, 6, 8, OUTLINE);
    R(g, c.x, y + bob + 2, 4, 4, palette ? palette[(c.ph * 7 | 0) % palette.length] : c.c);
    R(g, c.x, y + bob, 4, 3, '#f0b48a');
  }
}

// ---------------------------------------------------------------------------
// The stages. `draw(g, s)` where s = { W, skyTop, horizon, crowdTop, crowdBot, gy, crowd, t }
export const STAGES = [
  {
    id: 'japan',
    name: 'טירת הלילה',            // Ryu — a moonlit castle
    grass: ['#2f7a3e', '#3a9149'],
    wall: '#241a33',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#141a4a', '#1e2a66', '#2c3f86', '#3f5aa8']);
      // moon with a hard rim, and a rooftop skyline
      R(g, s.W * 0.76, 34, 46, 46, '#fff6d0');
      R(g, s.W * 0.76 + 8, 42, 30, 30, '#ffffff');
      silhouette(g, s.W, s.horizon, 6, '#101736', 3);
      // the castle: tiered roofs, the one landmark
      const cx = s.W * 0.5, base = s.horizon;
      for (let tier = 0; tier < 3; tier++) {
        const w = 150 - tier * 38, h = 30;
        const y = base - 40 - tier * 40;
        OUT(g, cx - w / 2, y, w, h, '#2b3a63');
        R(g, cx - w / 2 - 10, y, w + 20, 6, '#16203c');       // eaves
        R(g, cx - w / 2 + 6, y + 10, w - 12, h - 14, '#8a6a3a');
      }
      OUT(g, cx - 18, base - 44, 36, 44, '#3a4d7a');
      // cherry trees flanking
      for (const bx of [s.W * 0.16, s.W * 0.84]) {
        R(g, bx - 3, s.horizon - 54, 6, 54, '#4a2f22');
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * 6.2832;
          R(g, bx + Math.cos(a) * 26 - 4, s.horizon - 68 + Math.sin(a) * 18 - 4, 9, 9, i % 3 ? '#ff9ecb' : '#ffc6e0');
        }
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#241a33');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#c8506e', '#4a6fb5', '#d8b34a', '#5f9e63']);
    },
  },
  {
    id: 'harbor',
    name: 'הנמל',                   // Ken — a working dockyard
    grass: ['#2f9e3e', '#3cb84a'],
    wall: '#22384a',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#7fd0ff', '#a8e2ff', '#cfeeff']);
      // sea
      R(g, 0, s.horizon - 60, s.W, 60, '#2f6fa8');
      for (let i = 0; i < 40; i++) {
        const wx = (i * 53 + Math.sin(s.t + i) * 12) % s.W;
        R(g, wx, s.horizon - 54 + (i % 5) * 11, 14, 2, '#63a6d8');
      }
      // cargo ship hull + cranes
      OUT(g, s.W * 0.08, s.horizon - 96, 300, 66, '#b03a2e');
      R(g, s.W * 0.08, s.horizon - 96, 300, 12, '#e8e8ee');
      for (const cxx of [s.W * 0.55, s.W * 0.78]) {
        R(g, cxx, s.horizon - 150, 8, 150, '#d8a13c');
        R(g, cxx - 60, s.horizon - 150, 130, 8, '#d8a13c');
        R(g, cxx + 56, s.horizon - 142, 4, 40, '#8a6a20');
      }
      // stacked containers
      const cols = ['#c83c3c', '#3c78c8', '#d8a13c', '#3ca85a'];
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < (i % 3 ? 2 : 3); j++) {
          OUT(g, 30 + i * 100, s.horizon - 30 - j * 26, 88, 24, cols[(i + j) % 4]);
        }
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#22384a');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#e8e8ee', '#3c78c8', '#d8a13c', '#c83c3c']);
    },
  },
  {
    id: 'china',
    name: 'שוק הרחוב',              // Chun-Li — a market street
    grass: ['#2f9e3e', '#3cb84a'],
    wall: '#5a2222',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#ffd98a', '#ffb85c', '#ff9440']);
      silhouette(g, s.W, s.horizon - 40, 7, '#c06a3a', 5);
      // shopfronts with tiled roofs and hanging signs
      for (let i = 0; i < 6; i++) {
        const x = i * (s.W / 6);
        const w = s.W / 6 - 8;
        OUT(g, x + 4, s.horizon - 120, w, 120, i % 2 ? '#c8341e' : '#e0a028');
        R(g, x - 2, s.horizon - 128, w + 16, 14, '#3a2418');       // roof tiles
        R(g, x + 14, s.horizon - 96, w - 28, 44, '#f2e2b8');       // shutter
        for (let k = 0; k < 4; k++) R(g, x + 18 + k * 12, s.horizon - 88, 6, 28, '#c8341e');
        // hanging lantern
        const sway = Math.sin(s.t * 1.6 + i) * 3;
        R(g, x + w / 2 + sway, s.horizon - 128, 2, 16, '#3a2418');
        OUT(g, x + w / 2 - 9 + sway, s.horizon - 112, 18, 22, '#e02020');
        R(g, x + w / 2 - 9 + sway, s.horizon - 106, 18, 4, '#ffd23c');
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#5a2222');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#e0c85a', '#c8341e', '#2f6fa8', '#f2e2b8']);
    },
  },
  {
    id: 'airbase',
    name: 'בסיס האוויר',            // Guile — hangar, jet, chain-link
    grass: ['#3a8a4a', '#48a256'],
    wall: '#3b4450',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#9fc8e8', '#c2ddf0', '#e0eef8']);
      // hangar arch
      const hx = s.W * 0.5, hw = 460, hh = 150;
      g.fillStyle = OUTLINE;
      g.beginPath(); g.ellipse(hx, s.horizon, hw / 2 + 3, hh + 3, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#8e9aa8';
      g.beginPath(); g.ellipse(hx, s.horizon, hw / 2, hh, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#2b3340';
      g.beginPath(); g.ellipse(hx, s.horizon, hw / 2 - 40, hh - 34, 0, Math.PI, 0); g.fill();
      // the jet, the landmark
      const jx = hx, jy = s.horizon - 54;
      OUT(g, jx - 90, jy, 190, 18, '#c9ced6');
      R(g, jx + 84, jy - 16, 26, 18, '#c9ced6');                 // tail
      g.fillStyle = '#9aa3ad';
      g.beginPath(); g.moveTo(jx - 30, jy + 18); g.lineTo(jx + 40, jy + 18); g.lineTo(jx - 10, jy + 44); g.closePath(); g.fill();
      R(g, jx - 74, jy + 3, 26, 9, '#5ec8ff');                   // canopy
      // chain-link fence in front
      R(g, 0, s.horizon - 40, s.W, 40, '#00000022');
      g.strokeStyle = '#c9ced6aa'; g.lineWidth = 1;
      g.beginPath();
      for (let x = -40; x < s.W + 40; x += 14) { g.moveTo(x, s.horizon - 40); g.lineTo(x + 40, s.horizon); g.moveTo(x + 40, s.horizon - 40); g.lineTo(x, s.horizon); }
      g.stroke();
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#3b4450');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#4a5a3a', '#6a7a4a', '#2b3340', '#8e9aa8']);
    },
  },
  {
    id: 'jungle',
    name: 'האמזונס',                // Blanka — river, huts, canopy
    grass: ['#2f8a3a', '#3aa347'],
    wall: '#1e3a24',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#ffd07a', '#ffae5c', '#e07a4a']);
      silhouette(g, s.W, s.horizon - 30, 8, '#1d5a2c', 9);
      // river
      R(g, 0, s.horizon - 46, s.W, 46, '#2f6a7a');
      for (let i = 0; i < 30; i++) R(g, (i * 71 + Math.sin(s.t * 1.2 + i) * 10) % s.W, s.horizon - 40 + (i % 4) * 11, 18, 2, '#5aa0aa');
      // stilt huts
      for (const bx of [s.W * 0.2, s.W * 0.72]) {
        R(g, bx - 4, s.horizon - 48, 5, 48, '#6a4a2a');
        R(g, bx + 44, s.horizon - 48, 5, 48, '#6a4a2a');
        OUT(g, bx - 14, s.horizon - 86, 74, 38, '#a8763e');
        g.fillStyle = '#5a3a1e';
        g.beginPath(); g.moveTo(bx - 24, s.horizon - 86); g.lineTo(bx + 22, s.horizon - 116); g.lineTo(bx + 70, s.horizon - 86); g.closePath(); g.fill();
      }
      // canopy leaves overhanging the top
      for (let i = 0; i < 16; i++) {
        const lx = i * (s.W / 15), ly = 10 + (i % 3) * 14;
        g.fillStyle = i % 2 ? '#1d5a2c' : '#27723a';
        g.beginPath(); g.ellipse(lx, ly, 52, 26, 0.3, 0, 6.2832); g.fill();
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#1e3a24');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#d8a13c', '#a8763e', '#27723a', '#e07a4a']);
    },
  },
  {
    id: 'temple',
    name: 'המקדש',                  // Dhalsim — columns, elephants, mandala
    grass: ['#3a9149', '#46a856'],
    wall: '#4a2c1a',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#ffdca0', '#ffbf70', '#f09a4a']);
      // mandala sun behind the temple
      const mx = s.W / 2, my = s.horizon - 150;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * 6.2832 + s.t * 0.15;
        g.fillStyle = i % 2 ? '#ffb04a' : '#ff8a2a';
        g.beginPath(); g.moveTo(mx, my); g.arc(mx, my, 110, a, a + 0.19); g.closePath(); g.fill();
      }
      R(g, mx - 40, my - 40, 80, 80, '#ffd88a');
      // temple front: columns and a stepped roof
      OUT(g, s.W * 0.2, s.horizon - 130, s.W * 0.6, 130, '#c98a4a');
      for (let i = 0; i < 7; i++) OUT(g, s.W * 0.22 + i * (s.W * 0.56 / 7), s.horizon - 112, 26, 112, '#e0a868');
      for (let i = 0; i < 3; i++) R(g, s.W * 0.18 - i * 8, s.horizon - 142 - i * 12, s.W * 0.64 + i * 16, 14, '#a86a34');
      // elephant statues either side
      for (const ex of [s.W * 0.12, s.W * 0.88]) {
        OUT(g, ex - 34, s.horizon - 58, 68, 58, '#b8b0a0');
        R(g, ex - 46, s.horizon - 50, 16, 34, '#b8b0a0');        // trunk
        R(g, ex - 40, s.horizon - 62, 24, 18, '#cfc7b6');        // head
        R(g, ex + 6, s.horizon - 46, 4, 4, '#0b0710');
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#4a2c1a');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#ff8a2a', '#e0c85a', '#c8341e', '#b8b0a0']);
    },
  },
  {
    id: 'factory',
    name: 'המפעל',                  // Zangief — girders, furnace, pipes
    grass: ['#3a8a4a', '#46a256'],
    wall: '#2a2028',
    draw(g, s) {
      bands(g, s.W, 0, s.horizon, ['#3a2030', '#5a2a30', '#7a3a2a']);
      // furnace glow, pulsing
      const glow = 0.6 + Math.sin(s.t * 2.2) * 0.25;
      g.globalAlpha = glow;
      R(g, s.W * 0.34, s.horizon - 120, s.W * 0.32, 120, '#ff7a1e');
      g.globalAlpha = 1;
      OUT(g, s.W * 0.32, s.horizon - 134, s.W * 0.36, 22, '#4a4048');
      // girders
      for (let i = 0; i < 5; i++) {
        R(g, 0, 26 + i * 34, s.W, 8, '#4a4048');
        R(g, i * (s.W / 4), 20, 10, 150, '#4a4048');
      }
      // pipes running along the wall
      for (let i = 0; i < 4; i++) {
        const py = s.horizon - 100 + i * 22;
        R(g, 0, py, s.W, 10, i % 2 ? '#6a5a4a' : '#5a5a66');
        for (let x = 20; x < s.W; x += 90) R(g, x, py - 3, 12, 16, '#8a7a6a');
      }
      R(g, 0, s.horizon, s.W, s.crowdBot - s.horizon, '#2a2028');
      onlookers(g, s.W, s.crowdTop, s.crowdBot, s.crowd, s.t, ['#8a7a6a', '#c83c3c', '#5a5a66', '#e0c85a']);
    },
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
export const randomStage = () => STAGES[Math.floor(Math.random() * STAGES.length)];
