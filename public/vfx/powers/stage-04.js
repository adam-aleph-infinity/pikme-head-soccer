// CHOCO BURST, drawn — the King of Mud's power (what it does: shared/champion-powers/stage-04.js).
// The champion is the new Saltiz chocolate bar, about to burst; the card, Naveh in a crate of
// marshmallows, rare snacks flying round him and a glowing "?".
//
//   the cut-in   a glowing "?" over where the ball will leave, marshmallows tumbling round it
//   the flight   the bar itself — the red wrapper, crimped at both ends, a gold band — shaking harder
//                and harder as it nears the burst; then the bare ball, dripping chocolate
//   the burst    foil confetti, chocolate blobs flung ahead onto the grass, marshmallows bouncing
//   the splat    (a zone) a glossy puddle of melted chocolate on the grass, bubbling, drying out
//   a hit        the bar bursting ON him: a chocolate splash (and `sticky`, ailments.js: chocolate
//                feet, a drip down the head while he is coated)
//   armed        marshmallows circling the head
// Client only: Math.random is fine here.

import { TAU, ball, hash, rrect } from './common.js';
import { blit, glow } from '../fx-kit.js';
// (the engine first: the stage file is part of its registry's import cycle)
import '../../../shared/hs-powers.js';
import { CHOCO } from '../../../shared/champion-powers/stage-04.js';
import * as C from '../../../shared/constants.js';

export const CHOC = { dark: '#3a1a0a', mid: '#5a2d14', hi: '#8a4a24', shine: '#d9a070', wrap: '#c0262d', wrapDk: '#7a1016', gold: '#ffd34a' };

// the wrapper round the ball: a red pillow crimped at both ends, a gold band, a white wordmark wave
function wrapper(g, x, y, r, rot) {
  const L = r * 2.2, H = r * 1.25;
  g.save(); g.translate(x, y); g.rotate(rot);
  // crimped ends
  for (const s of [-1, 1]) {
    g.fillStyle = CHOC.wrapDk;
    g.beginPath(); g.moveTo(s * L * 0.82, -H * 0.85);
    for (let i = 0; i <= 6; i++) g.lineTo(s * (L + (i % 2 ? 5 : 0)), -H * 0.85 + (i / 6) * H * 1.7);
    g.lineTo(s * L * 0.82, H * 0.85); g.closePath(); g.fill();
  }
  // the body
  const lg = g.createLinearGradient(0, -H, 0, H);
  lg.addColorStop(0, '#ff5a5a'); lg.addColorStop(0.35, CHOC.wrap); lg.addColorStop(1, CHOC.wrapDk);
  g.fillStyle = lg; g.strokeStyle = '#3a0508'; g.lineWidth = 2;
  rrect(g, -L * 0.85, -H, L * 1.7, H * 2, H * 0.55); g.fill(); g.stroke();
  // the gold band and the wordmark's white wave across it
  g.fillStyle = CHOC.gold; g.fillRect(-L * 0.85, -H * 0.18, L * 1.7, H * 0.36);
  g.strokeStyle = '#ffffff'; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-L * 0.5, -H * 0.55); g.bezierCurveTo(-L * 0.2, -H * 0.85, L * 0.15, -H * 0.25, L * 0.5, -H * 0.55); g.stroke();
  // the foil's shine
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.ellipse(-L * 0.25, -H * 0.62, L * 0.35, H * 0.12, 0, 0, TAU); g.fill();
  g.restore();
}

function marshmallow(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = '#fff8f2'; g.strokeStyle = '#e8c8c0'; g.lineWidth = 1.2;
  rrect(g, -s, -s * 0.8, s * 2, s * 1.6, s * 0.6); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,190,210,0.6)'; g.fillRect(-s, -s * 0.15, s * 2, s * 0.3);
  g.restore();
}

// a blob of chocolate, glossy
function blob(g, x, y, rx, ry, a = 1) {
  g.save(); g.globalAlpha = a;
  g.fillStyle = CHOC.mid; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  g.fillStyle = CHOC.hi; g.beginPath(); g.ellipse(x - rx * 0.15, y - ry * 0.2, rx * 0.65, ry * 0.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,230,200,0.75)'; g.beginPath(); g.ellipse(x - rx * 0.35, y - ry * 0.45, rx * 0.22, ry * 0.15, -0.3, 0, TAU); g.fill();
  g.restore();
}

// the burst: foil confetti, chocolate blobs flung on to the splat, marshmallows bouncing, a pop ring
function burst(x, y, cx, gy, dir) {
  const foil = [], blobs = [], mm = [];
  for (let i = 0; i < 16; i++) foil.push({ x, y, vx: (Math.random() - 0.5) * 520 + dir * 120, vy: -(120 + Math.random() * 380), r: Math.random() * TAU, w: (Math.random() - 0.5) * 30, c: i % 3 });
  for (let i = 0; i < 7; i++) { const tx = cx + (Math.random() - 0.5) * 150; blobs.push({ x0: x, y0: y, tx, s: 5 + Math.random() * 6, h: 40 + Math.random() * 50 }); }
  for (let i = 0; i < 5; i++) mm.push({ x, y, vx: dir * (80 + Math.random() * 260), vy: -(250 + Math.random() * 200), r: Math.random() * TAU, w: (Math.random() - 0.5) * 14 });
  return {
    t: 0, life: 0.9,
    step(dt) {
      for (const f of foil) { f.vy += 600 * dt; f.vx *= 0.97; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.w * dt; }
      for (const q of mm) { q.vy += 1300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.w * dt; if (q.y > gy - 6 && q.vy > 0) { q.y = gy - 6; q.vy *= -0.45; q.vx *= 0.7; } }
    },
    draw(g, t) {
      if (t < 0.25) {
        const k = t / 0.25; g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - k; g.strokeStyle = '#ffe2c0'; g.lineWidth = 9 * (1 - k) + 1;
        g.beginPath(); g.arc(x, y, 14 + k * 90, 0, TAU); g.stroke(); g.restore();
        blit(g, glow('#ffb070', 0.3), x, y, 120 * (1 - k) + 30, 120 * (1 - k) + 30, 0, 1 - k);
      }
      // the blobs flying on to the grass in an arc (the splat lands CHOCO.LAND s after the burst)
      const fl = Math.min(1, t / CHOCO.LAND);
      if (fl < 1) for (const q of blobs) { const bx = q.x0 + (q.tx - q.x0) * fl, by = q.y0 + (gy - 4 - q.y0) * fl - q.h * 4 * fl * (1 - fl); blob(g, bx, by, q.s, q.s * 0.8); }
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.3 : 1;
      g.save(); g.globalAlpha = Math.max(0, fade);
      for (const f of foil) {
        const w = Math.abs(Math.cos(f.r)) * 7 + 1;
        g.fillStyle = f.c === 0 ? CHOC.wrap : f.c === 1 ? '#e8e8f0' : CHOC.gold;
        g.fillRect(f.x - w / 2, f.y - 3, w, 6);
      }
      g.restore();
      g.save(); g.globalAlpha = Math.max(0, fade); for (const q of mm) marshmallow(g, q.x, q.y, 6, q.r); g.restore();
    },
  };
}

// a hit: the bar bursting on the defender — a splash of chocolate thrown up round him
function splash(x, y) {
  const drops = [];
  for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 3, v = 200 + Math.random() * 420; drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 3 + Math.random() * 6 }); }
  return {
    t: 0, life: 0.65,
    step(dt) { for (const d of drops) { d.vy += 1300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; } },
    draw(g, t) {
      const f = t / 0.65;
      if (t < 0.15) blob(g, x, y, 34 * (1 - t / 0.15) + 12, 28 * (1 - t / 0.15) + 10, 1 - t / 0.15);
      for (const d of drops) blob(g, d.x, d.y, d.s, d.s * 0.85, 1 - f * f);
    },
  };
}

// THE SET PIECE (cutBack): a giant Saltiz bar stands up behind the shooter, shaking harder and
// harder, a big glowing "?" over it and marshmallows raining down — and at the release it splits.
function barSet(g, s) {
  const { hx, hy, hr, px, py, dir, el, rel, now } = s;
  const k = Math.min(1, el / 0.4), e = 1 - Math.pow(1 - k, 3);
  const a = Math.min(1, el / 0.1) * (s.out ?? 1);
  const shake = Math.min(1, el / rel) ** 2;
  const cx = hx - dir * hr * 2.3 + (Math.random() - 0.5) * hr * 0.35 * shake, cy = py - hr * 2.6 * e;
  g.save(); g.globalAlpha = a;
  g.translate(cx, cy); g.rotate(Math.PI / 2 + (Math.random() - 0.5) * 0.12 * shake);
  wrapper(g, 0, 0, hr * 1.55 * e, 0);
  g.restore();
  // the "?"
  g.save(); g.globalAlpha = a * e;
  blit(g, glow('#ffe08a', 0.3), cx, cy - hr * 4.3, hr * 5, hr * 5, 0, 0.9);
  g.font = `900 ${Math.round(hr * 3)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = '#7a4a00'; g.strokeText('?', cx, cy - hr * 4.3 + Math.sin(now * 6) * 4);
  g.fillStyle = '#fff2b0'; g.fillText('?', cx, cy - hr * 4.3 + Math.sin(now * 6) * 4);
  g.restore();
  // marshmallows raining
  for (let i = 0; i < 9; i++) { const f = (now * 0.9 + hash(i, 4)) % 1, x = px + (hash(i, 7) - 0.5) * hr * 9, y = hy - hr * 5 + f * hr * 7; g.globalAlpha = a * Math.sin(f * Math.PI); marshmallow(g, x, y, hr * 0.3, f * 6 + i); }
  g.globalAlpha = 1;
}

export default {
  id: 'chocoburst',
  palette: [CHOC.wrap, CHOC.mid, CHOC.gold, '#fff8f2'],
  cutColor: '#ff5a4a',
  cutBack: barSet,

  draw(g, b, s) {
    const pw = s.pw, dir = pw.dir || 1, x = s.x, y = s.y, r = s.r, now = s.now || 0;
    const h = s.hist || [];
    if (!pw.burst) {
      // the wrapped bar, shaking harder the nearer the burst (BURST_AT short of the goal line)
      const gx = dir > 0 ? C.W - C.GOAL_W : C.GOAL_W;
      const toGo = Math.max(0, (gx - b.x) * dir - CHOCO.BURST_AT);
      const shake = Math.max(0, 1 - toGo / 360);
      const jx = (Math.random() - 0.5) * 6 * shake, jy = (Math.random() - 0.5) * 6 * shake;
      // crumbs and foil glints trailing it
      for (let i = 2; i < Math.min(h.length, 12); i += 2) {
        const p = h[i];
        g.fillStyle = i % 4 ? CHOC.hi : CHOC.gold; g.globalAlpha = 1 - i / 12;
        g.beginPath(); g.arc(p.x + (hash(i, 1) - 0.5) * 14, p.y + (hash(i, 2) - 0.5) * 14, 2.2, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      blit(g, glow('#ff6a5a', 0.2), x, y, r * 5, r * 3.4, 0, 0.4 + 0.4 * shake);
      wrapper(g, x + jx, y + jy, r, (dir > 0 ? 0 : Math.PI) + Math.sin(now * 40) * 0.12 * shake);
      return true;
    }
    // burst: the bare ball, dripping chocolate behind it
    for (let i = 1; i < Math.min(h.length, 10); i++) {
      const p = h[i];
      blob(g, p.x + (hash(i, 4) - 0.5) * 8, p.y + i * 1.8, 3.5 - i * 0.25, 3 - i * 0.2, 1 - i / 10);
    }
    blob(g, x - dir * r * 0.2, y + r * 0.4, r * 0.7, r * 0.45, 0.85);
    ball(g, s, x, y);
    return true;
  },

  // The splat: a glossy puddle of melted chocolate on the grass, bubbling; it dries out at the end.
  zone(g, z, s) {
    if (z.k !== 'splat' || z.t < z.land) return;
    const cx = (s.x0 + s.x1) / 2, half = Math.abs(s.x1 - s.x0) / 2, gy = s.gy, now = s.now;
    const grow = Math.min(1, (z.t - z.land) / 0.1), left = z.life - z.t, dry = Math.min(1, left / 0.5);
    const w = half * (0.6 + 0.4 * grow) * (0.85 + 0.15 * dry), hh = 11 * (0.7 + 0.3 * grow);
    g.save();
    g.globalAlpha = dry;
    // the puddle: a dark rim, the body, a gloss across the top
    g.fillStyle = CHOC.dark; g.beginPath(); g.ellipse(cx, gy + 1, w + 4, hh + 3, 0, 0, TAU); g.fill();
    const rg = g.createRadialGradient(cx - w * 0.2, gy - hh * 0.4, 2, cx, gy, w);
    rg.addColorStop(0, CHOC.hi); rg.addColorStop(0.6, CHOC.mid); rg.addColorStop(1, CHOC.dark);
    g.fillStyle = rg; g.beginPath(); g.ellipse(cx, gy, w, hh, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,225,190,0.55)';
    g.beginPath(); g.ellipse(cx - w * 0.3, gy - hh * 0.45, w * 0.35, hh * 0.18, 0, 0, TAU); g.fill();
    // blobs round its edge and bubbles popping in it
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; blob(g, cx + Math.cos(a) * w * 0.95, gy + Math.sin(a) * hh * 0.9, 5 + 3 * hash(i, 8), 4, dry); }
    for (let i = 0; i < 4; i++) {
      const f = (now * 1.3 + i * 0.27) % 1, bx = cx + (hash(i, Math.floor(now * 1.3 + i * 0.27)) - 0.5) * w * 1.4;
      g.strokeStyle = CHOC.shine; g.lineWidth = 1.2; g.globalAlpha = dry * (1 - f);
      g.beginPath(); g.arc(bx, gy - 2, 1.5 + f * 4, Math.PI, TAU); g.stroke();
    }
    g.restore();
  },

  // Under the cut-in: the card's glowing "?" over the ball's spot, marshmallows tumbling round it.
  cutin(g, s) {
    const x = s.fx, y = s.fy, R = s.r, t = s.now || 0;
    const k = Math.max(0, Math.min(1, (s.cut ?? 0.6) / 0.9));
    blit(g, glow('#ffe08a', 0.3), x, y - R * 2.4, R * 5, R * 5, 0, 0.8 * k);
    g.save();
    g.globalAlpha = k; g.font = `900 ${Math.round(R * 2.6)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeStyle = '#7a4a00'; g.strokeText('?', x, y - R * 2.4 + Math.sin(t * 6) * 3);
    g.fillStyle = '#fff2b0'; g.fillText('?', x, y - R * 2.4 + Math.sin(t * 6) * 3);
    g.restore();
    for (let i = 0; i < 6; i++) { const a = t * 2 + i * 1.05, d = R * (2 - 0.5 * k); g.globalAlpha = k; marshmallow(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, R * 0.3, a); }
    g.globalAlpha = 1;
  },

  // Armed: marshmallows circling the head.
  armed(g, p, s) {
    const t = s.t, rx = s.r * 1.5, ry = s.r * 0.5, cy = s.hy - s.r * 0.25;
    for (let i = 0; i < 3; i++) { const a = t * 2.6 + i * 2.09; marshmallow(g, s.hx + Math.cos(a) * rx, cy + Math.sin(a) * ry, s.r * 0.22, a); }
  },

  event(e, at) {
    if (e.type === 'chocoBurst') { const d = at(e.x, e.y), c = at(e.cx, C.GROUND_Y); return burst(d.x, d.y, c.x, c.y, e.dir || 1); }
    if (e.type === 'chocoCoat') { const d = at(e.x, e.y); return splash(d.x, d.y); }
    return null;
  },
};
