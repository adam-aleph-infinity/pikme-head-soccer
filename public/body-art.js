// THE BODY UNDER THE HEAD — painted once, blitted every frame.
//
// Head Soccer's body (docs/HS-CHARACTER-LOOK.md, "The body, re-studied"): a small black suit
// hidden almost entirely behind the head, a strip of team-colour collar showing just under the
// chin, and two chunky black football boots — flat sole, a toe cap lower than the ankle, a
// gold stripe at the heel and a gold rim light along the top. Everything keylined in the same
// near-black as the head, cel-shaded in two or three flat tones, lit from the front.
//
// It used to be drawn from paths every frame on the half-resolution pitch canvas, where a 13
// texel boot upscaled 2x pixelated reads as a blob ("the legs look like car wheels") and the
// suit's hard texels never met the head's smooth keyline ("the head looks dismantled"). Now the
// art is painted here at SS texture px per world px into offscreen canvases — each boot, the
// torso, and the whole lower body for every pose that moves both feet (a flipbook: stand, the
// run cycle, the jump) — and game.js blits them onto #cvbody, a layer at the screen's own
// resolution under the DOM heads. A frame costs one or two drawImage calls per player.
//
// The collar is cut to the head's own silhouette (HEAD_SHAPE): the chin sits over it, and a band
// of the collar's shade tone right under the jaw line is the chin's shadow on it — the thing
// that makes head and body read as one piece. Any head sized to HEAD_SHAPE sits on it cleanly.
import { tex } from './vfx/fx-kit.js';

export const SS = 3;                        // texture px per world px (screen is ~1.3-2)
export const OUTLINE = '#140c08';           // the head's keyline colour (.head::before)
const OL = 2.6;                             // keyline, world px — the head's is 5% of its height

// Measured on the 26.4 head (HS M4 29.98 s stand, 32.6-33.1 run, 21.25 jump, 29.68-29.95 kick,
// full resolution, 2.1 full-res px per world px): the boot is ~27 long and ~11 tall, feet
// together span ~1.2 R, the sole is ~14 px under the chin.
export const BOOT_L = 24, BOOT_H = 13.5;
export const BOOT_BACK = -4, BOOT_FRONT = 4;   // boot centres, standing, along the facing
const SUIT_W = 26, SUIT_TOP = -32, SUIT_BOT = -4;

const BOOT = { base: '#1f2025', shade: '#111216', light: '#363841', spec: '#7d8292', sole: '#30323a', lace: '#b9c0d4' };
const SUIT = { base: '#1f2027', shade: '#131418', light: '#353845', spec: '#5a5f72' };

// One boot's silhouette, toe toward +x, sole on y = 0, centred on x = 0. A football boot, not a
// clog: a flat sole, the heel counter rising to a padded ankle collar at the back, the instep
// sloping down to a toe cap that is lower than the ankle and rounded at the tip.
function bootPath(g) {
  const L = BOOT_L / 2, H = BOOT_H;
  g.beginPath();
  g.moveTo(-L + 2.5, 0);
  g.lineTo(L - 3, 0);                                      // the sole
  g.quadraticCurveTo(L + 1, 0, L + 1, -3.2);               // toe tip
  g.bezierCurveTo(L + 1, -H * 0.76, L - 3.5, -H * 0.88, L - 8, -H * 0.88);   // toe cap: a round dome
  g.bezierCurveTo(-2, -H * 0.9, -4, -H * 1.0, -L + 3.5, -H);   // the instep, up to the collar
  g.quadraticCurveTo(-L - 0.6, -H, -L - 0.4, -H * 0.62);     // padded ankle collar, heel
  g.quadraticCurveTo(-L - 0.2, 0, -L + 2.5, 0);
  g.closePath();
}

// Paint one boot (in world units, origin at the middle of the sole) on a texture context.
function paintBoot(g, trim, stripe = true) {
  const L = BOOT_L / 2, H = BOOT_H;
  g.save();
  bootPath(g);
  g.fillStyle = BOOT.base; g.fill();
  g.save();
  bootPath(g); g.clip();
  // cel tones: the back and underside in shade, the upper lit
  g.fillStyle = BOOT.shade;
  g.fillRect(-L - 2, -H * 0.42, BOOT_L + 4, H);
  g.beginPath(); g.ellipse(-L + 1, -H * 0.6, 5, H, 0, 0, 6.2832); g.fill();
  g.fillStyle = BOOT.light;
  g.beginPath(); g.ellipse(L * 0.35, -H * 0.9, L * 0.95, H * 0.36, -0.12, 0, 6.2832); g.fill();
  // the sole: a lighter band under the upper, with its welt line
  g.fillStyle = BOOT.sole;
  g.fillRect(-L - 2, -2.6, BOOT_L + 4, 2.6);
  g.fillStyle = OUTLINE;
  g.fillRect(-L - 2, -3.1, BOOT_L + 4, 0.7);
  // the stripe: a slanted band of the trim colour across the heel counter (HS's gold heel)
  // (only on the boot whose heel is in view: in the pair, the front heel sits over the back boot
  // and two stripes side by side read as a glyph)
  if (stripe) {
  g.fillStyle = trim;
  g.beginPath();
  g.moveTo(-L + 1.4, -3.1); g.lineTo(-L + 2.9, -3.1); g.lineTo(-L + 4.9, -H * 0.9); g.lineTo(-L + 3.4, -H * 0.93);
  g.closePath(); g.fill();
  }
  g.restore();
  // laces: three short light dashes across the instep
  g.strokeStyle = BOOT.lace; g.lineWidth = 0.9; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = -2.2 + i * 2.7, y = -H * (0.9 - i * 0.07);
    g.moveTo(x - 0.9, y + 1.1); g.lineTo(x + 0.9, y - 0.4);
  }
  g.stroke();
  // specular: a thin crescent on the toe cap, lit from the front
  g.strokeStyle = BOOT.spec; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(L - 7, -H * 0.62); g.quadraticCurveTo(L - 2.2, -H * 0.58, L - 1, -3.6); g.stroke();
  // the rim light: HS runs a thin gold line along the top of the boot, on the back half
  g.strokeStyle = trim; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-L + 1.3, -H * 0.66); g.quadraticCurveTo(-L + 0.8, -H * 0.9, -L + 4, -H * 0.93); g.lineTo(-3, -H * 0.86); g.stroke();
  // keyline last, covering the slack at every detail's end
  bootPath(g);
  g.lineWidth = OL; g.lineJoin = 'round'; g.strokeStyle = OUTLINE; g.stroke();
  g.restore();
}

// The head's bottom edge, as world y (feet at 0) at world x off the centre line — the collar is
// cut to it. headShape: HEAD_SHAPE points in a unit box; box: { cy, rx, ry }.
function jawCurve(headShape, box) {
  const pts = headShape.map(([u, v]) => [(u - 0.5) * 2 * box.rx, box.cy + (v - 0.5) * 2 * box.ry])
    .filter(([, y]) => y > box.cy + box.ry * 0.2).sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], u = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * u;
    }
    return pts[pts.length - 1][1];
  };
}

function suitPath(g) {
  const w = SUIT_W / 2, t = SUIT_TOP, b = SUIT_BOT;
  g.beginPath();
  g.moveTo(-w + 7, t);
  g.lineTo(w - 7, t);
  g.quadraticCurveTo(w + 0.5, t, w + 0.5, t + 9);          // shoulders round under the jaw
  g.lineTo(w, b - 5);
  g.quadraticCurveTo(w, b, w - 5, b);
  g.lineTo(-w + 5, b);
  g.quadraticCurveTo(-w, b, -w, b - 5);
  g.lineTo(-w - 0.5, t + 9);
  g.quadraticCurveTo(-w - 0.5, t, -w + 7, t);
  g.closePath();
}

// The torso, facing +x: the suit, the collar cut to the jaw, the chin's shadow on it.
function paintSuit(g, kit, trim, jaw) {
  const w = SUIT_W / 2;
  const S = kit.suit || SUIT;
  suitPath(g);
  g.fillStyle = S.base; g.fill();
  g.save();
  suitPath(g); g.clip();
  g.fillStyle = S.shade;                                 // back half and the hem in shade
  g.fillRect(-w - 1, SUIT_TOP, w * 0.8, SUIT_BOT - SUIT_TOP);
  g.fillRect(-w - 1, SUIT_BOT - 3.5, SUIT_W + 2, 4);
  g.fillStyle = S.light;                                    // lit front panel
  g.beginPath(); g.ellipse(w * 0.55, -12, w * 0.42, 9, 0, 0, 6.2832); g.fill();
  g.fillStyle = S.spec;
  g.fillRect(w - 2.6, -19, 1.2, 9);
  g.fillStyle = trim;                                       // rim light down the back
  g.fillRect(-w - 0.5, SUIT_TOP + 6, 1.8, SUIT_BOT - SUIT_TOP - 9);
  // THE COLLAR: a band of team colour following the jaw 3.6 px down, its top in the collar's
  // shade tone — the shadow the chin casts on it. Drawn a little INTO the head too, so however
  // the chin art ends, the colour runs up under it rather than stopping short of it.
  const band = (d0, d1, col) => {
    g.beginPath();
    for (let x = -w - 1; x <= w + 1; x += 1) g.lineTo(x, jaw(x) + d0);
    for (let x = w + 1; x >= -w - 1; x -= 1) g.lineTo(x, jaw(x) + d1);
    g.closePath(); g.fillStyle = col; g.fill();
  };
  band(-4, 3.8, kit.collar);
  band(-4, 1.1, kit.collarDark);                            // chin shadow
  band(3.8, 4.6, OUTLINE);                                  // the collar's lower edge
  g.fillStyle = kit.collarLight;                            // lit tip at the front
  g.beginPath(); g.ellipse(w * 0.55, jaw(w * 0.55) + 2.6, 2.6, 0.7, 0, 0, 6.2832); g.fill();
  if (kit.badge) {                                          // the Saltiz logo on the chest: a red hexagon, a yellow mark
    const bx = w * 0.42, by = -11, r = 4.2;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = kit.badge.base; g.fill();
    g.lineWidth = 0.7; g.strokeStyle = OUTLINE; g.stroke();
    g.fillStyle = kit.badge.mark;
    g.fillRect(bx - 1.8, by - 1.9, 3.6, 1.1); g.fillRect(bx - 1.8, by - 1.9, 1.1, 3.8); g.fillRect(bx - 1.8, by + 0.8, 3.6, 1.1);
  }
  g.restore();
  suitPath(g);
  g.lineWidth = OL; g.lineJoin = 'round'; g.strokeStyle = OUTLINE; g.stroke();
}

// THE POSES THAT MOVE BOTH FEET — one composite each (back boot, suit, front boot), facing +x:
//  'stand', 'run0'..'run7' (a paddle cycle), 'air' (splayed), 'kick' (the back boot and suit
//  only — the kicking boot is blitted on its own, on its arc).
export const RUN_FRAMES = 8;
function feet(pose) {
  // [x, lift, angle, faceSign] for the back boot then the front
  if (pose === 'air') return [[BOOT_BACK - 6, -1, -0.22, -1], [BOOT_FRONT + 5, -1, -0.2, 1]];
  if (pose === 'kick') return [[BOOT_BACK + 1, 0, 0, 1], null];
  if (pose.startsWith('run')) {
    // HS's run (M4 32.6-33.1): the two boots paddle fore and aft ~5 px, the one coming forward
    // lifted a touch with its heel up — a shuffle under a head that rides dead level.
    const ph = (+pose.slice(3) / RUN_FRAMES) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return [[BOOT_BACK - 6.5 * s, c > 0 ? -3 * c : 0, c > 0 ? 0.26 * c : 0, 1],
            [BOOT_FRONT + 6.5 * s, c < 0 ? 3 * c : 0, c < 0 ? -0.26 * c : 0, 1]];
  }
  return [[BOOT_BACK, 0, 0, 1], [BOOT_FRONT, 0, 0, 1]];
}

// Texture boxes, world units: a boot on its own, and a whole lower body.
const BW = BOOT_L + 8, BH = BOOT_H + 8;                     // boot texture, origin mid-sole
const LX0 = -30, LX1 = 30, LY0 = SUIT_TOP - 3, LY1 = 5;     // lower body texture

export function createBodyArt({ headShape, headBox }) {
  const jaw = jawCurve(headShape, headBox);
  const bootTex = (trim, stripe = true) => tex(`hsbody:boot:${trim}:${stripe ? 1 : 0}`, BW * SS, BH * SS, (g) => {
    g.setTransform(SS, 0, 0, SS, (BW / 2) * SS, (BH - 3) * SS);
    paintBoot(g, trim, stripe);
  });
  const placeBoot = (g, trim, x, y, face, ang, stripe = true) => {
    const t = bootTex(trim, stripe);
    g.save();
    g.translate(x, y);
    if (face < 0) g.scale(-1, 1);
    if (ang) g.rotate(-ang);
    g.drawImage(t, -BW / 2, -(BH - 3), BW, BH);
    g.restore();
  };
  const lowerTex = (kit, trim, pose) => tex(`hsbody:${kit.collar}:${kit.suit ? kit.suit.base : ''}:${kit.badge ? 'b' : ''}:${trim}:${pose}`, (LX1 - LX0) * SS, (LY1 - LY0) * SS, (g) => {
    g.setTransform(SS, 0, 0, SS, -LX0 * SS, -LY0 * SS);
    const [b, f] = feet(pose);
    placeBoot(g, trim, b[0], b[1], b[3], b[2]);
    paintSuit(g, kit, trim, jaw);
    if (f) placeBoot(g, trim, f[0], f[1], f[3], f[2], pose === 'air');
  });
  return {
    // The lower body at the feet (origin), facing `face`.
    lower(g, kit, trim, pose, face) {
      const t = lowerTex(kit, trim, pose);
      if (face < 0) { g.save(); g.scale(-1, 1); }
      g.drawImage(t, LX0, LY0, LX1 - LX0, LY1 - LY0);
      if (face < 0) g.restore();
    },
    // One boot: sole centre at (x, y), toe toward `face`, toe tipped up by `ang`.
    boot(g, trim, x, y, face, ang) { placeBoot(g, trim, x, y, face, ang); },
    // Warm the cache for a player so no texture is painted mid-match.
    warm(kit, trim) {
      bootTex(trim);
      for (const p of ['stand', 'air', 'kick', ...Array.from({ length: RUN_FRAMES }, (_, i) => 'run' + i)]) lowerTex(kit, trim, p);
    },
  };
}
