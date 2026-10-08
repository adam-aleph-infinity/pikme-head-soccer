// THE HOME SCREEN'S STADIUM, BAKED. Run: node tools/home-bg/build.mjs [palette]
//
// The home screen's backdrop is layered (menus.css, "HOME"): the sky and the sun are CSS, the
// clouds drift as their own small pictures, the floodlights and the pitch lines are drawn by the
// page — and everything that never moves (the stadium's bowl and roof, the crowd, the ad boards,
// the mown pitch) is this one picture, baked once to a WebP so a phone pays for it once.
//
// The picture is 2.4:1 — wider than any phone we fit (4:3 … 20:9) — so `background-size: cover`
// always fits it by HEIGHT: 36% down the picture is 36% down every screen, and the extra width is
// the bleed each side. The bands are laid out in those screen percentages (the brief):
//   roof ring ~19–28% (it curves up toward the sides), bowl tiers to 36%, crowd 36–48%,
//   ad boards 48–51%, the pitch 51–100%, its stripes running to a vanishing point at (50%, −40%).
//
// Colours are tokens in PALETTES, so a day or a night stadium is a new palette, not a new drawing.
// Writes: public/img/home-<palette>.webp (2x), public/img/home-cloud-{far,mid,near}.svg, and the
// stadium's source SVG to tools/home-bg/out/ for a look in a browser.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../../_chrome.mjs';

const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('out/', import.meta.url);
const IMG = new URL('public/img/', ROOT);

const PALETTES = {
  sunset: {
    roofTop: '#2a1a55', roofBottom: '#1d1440', truss: '#46307e', rim: '#ff9a6a', underside: '#120b2c',
    arch: '#3d2356', archGlow: '#ff9a6a',
    bowlTop: '#1d1440', bowlBottom: '#2a1a55', tierLine: '#ffffff',
    crowdDark: '#1d1440', crowdTint: '#ff9a5a', bokeh: '#fff3c0',
    boards: ['#e8102e', '#ffd400', '#2a6fe8', '#a24bd8', '#37c8d6', '#ff7a1a', '#ff5fa2', '#3dbb4a'],
    boardFrame: '#140c2a', boardWarm: '#ff9a5a',
    grassA: '#3f9a4a', grassB: '#348a41', grassFar: '#ffa060', grassEdge: '#d4f5a8',
    tuftLight: '#5cbf62', tuftDark: '#2f7d3a',
    // the clouds: lit tops, a pink middle, purple bellies — far ones bluer and flatter
    cloud: {
      far: { lit: '#e9a0c0', mid: '#a45a9c', belly: '#5a3480' },
      mid: { lit: '#ffb3c8', mid: '#c8689e', belly: '#6a3a8c' },
      near: { lit: '#ffd0a0', mid: '#e47aa0', belly: '#6a3a8c' },
    },
  },
};

const W = 1440, H = 600;                        // 1x; baked at 2x
const pct = (p) => (p / 100) * H;               // screen % of height → picture units
const VP = { x: W / 2, y: pct(-40) };
const CROWD_TOP = pct(36), BOARD_TOP = pct(48), PITCH_TOP = pct(51);

// A tiny seeded PRNG (the same one as public/hs-stadium.js), so every build draws the same crowd.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const f = (n) => Math.round(n * 10) / 10;

// colour helpers: mix two hex colours, and take saturation out
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const desat = (h, t) => { const c = rgb(h); const g = c[0] * .3 + c[1] * .59 + c[2] * .11; return hex(c.map((v) => v + (g - v) * t)); };

const SKIN = ['#f6d2b0', '#eebd96', '#dca577', '#c48a5c', '#a06a42', '#7a4c2c', '#5a3620'];
const HAIR = ['#1f1510', '#3b2616', '#5e3b1e', '#141414', '#9a5a26', '#e0bd72'];
const SHIRT = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5', '#00acc1', '#f06292', '#3949ab', '#c0ca33', '#e8102e', '#ffd400'];
const TEAM = [['#e8102e', '#ffd400'], ['#ffd400', '#e8102e'], ['#2a6fe8', '#f5f5f5'], ['#a24bd8', '#f5f5f5']];

// THE ROOF's top edge: lowest in the middle (behind you), rising toward both sides — the bowl.
const roofY = (x) => pct(25) - pct(6.5) * ((x - W / 2) / (W / 2)) ** 2;
const along = (fn, dy = 0, step = 20) => { const p = []; for (let x = -20; x <= W + 20; x += step) p.push(`${f(x)},${f(fn(x) + dy)}`); return p; };

function stadium(P) {
  const s = [];
  const ROOF = 16, UNDER = 7, ARCH = 15;
  const archTop = (x) => roofY(x) + ROOF + UNDER;
  const bowlTop = (x) => archTop(x) + ARCH;
  // the bowl: seats from under the arches down to the boards
  s.push(`<polygon points="${along(bowlTop, -2).join(' ')} ${W + 20},${BOARD_TOP + 4} -20,${BOARD_TOP + 4}" fill="url(#bowl)"/>`);
  // faint tier lines, following the bowl's curve down to the crowd
  for (let j = 1; j <= 6; j++) {
    const t = j / 7;
    s.push(`<polyline points="${along((x) => bowlTop(x) + (CROWD_TOP + 6 - bowlTop(x)) * t).join(' ')}" fill="none" stroke="${P.tierLine}" stroke-opacity=".07" stroke-width="1.2"/>`);
  }
  // the concourse: a ring of arched openings, dimly lit from inside by the sunset
  s.push(`<polygon points="${along(archTop, -1).join(' ')} ${along(bowlTop, 1).reverse().join(' ')}" fill="${P.roofBottom}"/>`);
  for (let x = 6; x < W; x += 30) {
    const y0 = archTop(x + 9) + 2, y1 = bowlTop(x + 9) - 1, r = 8;
    s.push(`<path d="M${f(x)} ${f(y1)}V${f(y0 + r)}a${r} ${r} 0 0 1 ${2 * r} 0V${f(y1)}z" fill="url(#arch)"/>`);
  }
  // the roof ring: its underside in shadow, the ring, its trusses, and the sunset along its top edge
  s.push(`<polygon points="${along(roofY, ROOF).join(' ')} ${along(archTop, 0).reverse().join(' ')}" fill="${P.underside}"/>`);
  s.push(`<polygon points="${along(roofY).join(' ')} ${along(roofY, ROOF).reverse().join(' ')}" fill="url(#roof)"/>`);
  const truss = [];
  for (let x = -24; x < W + 24; x += 24) truss.push(`M${f(x)} ${f(roofY(x) + 3)}L${f(x + 12)} ${f(roofY(x + 12) + ROOF - 2)}L${f(x + 24)} ${f(roofY(x + 24) + 3)}`);
  s.push(`<path d="${truss.join('')}" fill="none" stroke="${P.truss}" stroke-width="1.6"/>`);
  s.push(`<polyline points="${along(roofY, ROOF - 1).join(' ')}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`);
  s.push(`<polyline points="${along(roofY, .5).join(' ')}" fill="none" stroke="${P.rim}" stroke-width="5" stroke-opacity=".45" filter="url(#b3)"/>`);
  s.push(`<polyline points="${along(roofY, .8).join(' ')}" fill="none" stroke="${P.rim}" stroke-width="1.8"/>`);
  return s.join('\n');
}

// ONE FAN, far off: a round head on a round-shouldered body. No face — at this distance and blur
// there is none to see. One in eight has both arms up.
function fan(r, x, base, h, shade, P, armsUp) {
  const w = h * .62, shirt = mix(desat(pick(r, SHIRT), .3), P.crowdDark, shade);
  const skin = mix(desat(pick(r, SKIN), .3), P.crowdDark, shade);
  const hy = base - h * .7, hr = h * .21, top = base - h * .5;
  const o = [];
  if (armsUp) {
    for (const d of [-1, 1]) {
      const hx = x + d * w * .62, hyy = base - h * 1.12;
      o.push(`<path d="M${f(x + d * w * .34)} ${f(top + h * .08)}L${f(hx)} ${f(hyy)}" stroke="${shirt}" stroke-width="${f(w * .22)}" stroke-linecap="round"/>`);
      o.push(`<circle cx="${f(hx)}" cy="${f(hyy)}" r="${f(w * .14)}" fill="${skin}"/>`);
    }
  }
  o.push(`<rect x="${f(x - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(h * .9)}" rx="${f(w * .4)}" fill="${shirt}"/>`);
  o.push(`<circle cx="${f(x)}" cy="${f(hy)}" r="${f(hr)}" fill="${skin}"/>`);
  if (r() < .65) o.push(`<path d="M${f(x - hr)} ${f(hy)}a${f(hr)} ${f(hr)} 0 0 1 ${f(2 * hr)} 0z" fill="${mix(pick(r, HAIR), P.crowdDark, shade)}"/>`);
  return o.join('');
}

// THE CROWD: three tiers, far to near — smaller, darker and blurrier the farther back. Each tier is
// two staggered rows; the near tier's legs are behind the ad boards, as in a real stand.
const TIERS = [
  { base: CROWD_TOP + 13, h: 12, shade: .42, blur: 2.6 },
  { base: CROWD_TOP + 31, h: 16, shade: .26, blur: 2 },
  { base: CROWD_TOP + 53, h: 21, shade: .1, blur: 1.4 },
];
function crowd(P, r) {
  const s = [];
  TIERS.forEach((t, ti) => {
    const g = [];
    for (const row of [0, 1]) {
      const base = t.base + row * t.h * .45, step = t.h * .62 * .98;
      for (let x = -10 + (row ? step / 2 : 0); x < W + 10; x += step * (.9 + r() * .2)) {
        g.push(fan(r, x + (r() - .5) * 2, base + (r() - .5) * 2, t.h * (.92 + r() * .16), t.shade + row * -.04, P, r() < 1 / 8));
      }
    }
    // a few flags and scarves in team colours, held up over the heads
    for (let k = 0; k < (ti === 0 ? 3 : 5); k++) {
      const x = 40 + r() * (W - 80), y = t.base - t.h * 1.15, [a, b] = pick(r, TEAM);
      const ca = mix(desat(a, .3), P.crowdDark, t.shade), cb = mix(desat(b, .3), P.crowdDark, t.shade);
      if (r() < .5) {
        const fw = t.h * 1.1, fh = t.h * .7;
        g.push(`<path d="M${f(x)} ${f(t.base - t.h * .4)}V${f(y - fh)}" stroke="#2a2030" stroke-width="${f(t.h * .08)}"/>`);
        g.push(`<path d="M${f(x)} ${f(y - fh)}q${f(fw / 2)} ${f(-fh * .25)} ${f(fw)} 0v${f(fh * .5)}q${f(-fw / 2)} ${f(fh * .25)} ${f(-fw)} 0z" fill="${ca}"/>`);
        g.push(`<path d="M${f(x)} ${f(y - fh * .5)}q${f(fw / 2)} ${f(-fh * .25)} ${f(fw)} 0v${f(fh * .5)}q${f(-fw / 2)} ${f(fh * .25)} ${f(-fw)} 0z" fill="${cb}"/>`);
      } else {
        const sw = t.h * 2.4, sh = t.h * .22;
        for (let i = 0; i < 6; i++) g.push(`<rect x="${f(x + i * sw / 6)}" y="${f(y + t.h * .25 + Math.sin(i) * 1.2)}" width="${f(sw / 6 + .4)}" height="${f(sh)}" fill="${i % 2 ? cb : ca}"/>`);
      }
    }
    s.push(`<g filter="url(#crowd${ti})">${g.join('')}</g>`);
  });
  // the sunset over all of it: warm, and darker toward the back of the stand
  s.push(`<rect x="0" y="${f(CROWD_TOP - 30)}" width="${W}" height="${f(BOARD_TOP - CROWD_TOP + 34)}" fill="${P.crowdTint}" opacity=".32" style="mix-blend-mode:multiply"/>`);
  s.push(`<rect x="0" y="${f(CROWD_TOP - 30)}" width="${W}" height="${f(BOARD_TOP - CROWD_TOP + 34)}" fill="url(#crowdShade)"/>`);
  // camera flashes and phone lights, here and there
  for (let k = 0; k < 46; k++) {
    const x = r() * W, y = CROWD_TOP + 2 + r() * (BOARD_TOP - CROWD_TOP - 6), rr = 1.6 + r() * 2.2;
    s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr * 2.4)}" fill="url(#bokeh)" opacity="${f(.5 + r() * .5)}"/>`);
    s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr * .45)}" fill="#fff"/>`);
  }
  return s.join('\n');
}

// THE AD BOARDS: bright panels, a step quieter than the UI (less saturation and contrast, sunset
// warmth on them) and no words — only a soft shine, so they never read as something to tap.
function boards(P, r) {
  const s = [], bh = PITCH_TOP - BOARD_TOP;
  s.push(`<rect x="-20" y="${f(BOARD_TOP - 2)}" width="${W + 40}" height="${f(bh + 2)}" fill="${P.boardFrame}"/>`);
  let i = Math.floor(r() * P.boards.length);
  for (let x = -40; x < W + 40; x += 100) {
    const c = mix(mix(desat(P.boards[i++ % P.boards.length], .15), '#808080', .15), P.boardWarm, .12);
    s.push(`<rect x="${x + 1.5}" y="${f(BOARD_TOP)}" width="97" height="${f(bh - 1.5)}" rx="1.5" fill="${c}"/>`);
    s.push(`<rect x="${x + 1.5}" y="${f(BOARD_TOP)}" width="97" height="${f(bh - 1.5)}" rx="1.5" fill="url(#boardShine)"/>`);
    s.push(`<rect x="${x + 22}" y="${f(BOARD_TOP + bh * .38)}" width="${f(40 + r() * 16)}" height="${f(bh * .22)}" rx="2" fill="#fff" opacity=".22"/>`);
  }
  return s.join('\n');
}

// THE PITCH: mowing stripes as wedges running to the vanishing point, warm toward the far side,
// a light edge where it meets the boards, and short tufts along both edges.
function pitch(P, r) {
  const s = [], SW = 120;
  const xAt = (xb, y) => VP.x + (xb - VP.x) * (y - VP.y) / (H - VP.y);   // the ray from VP through (xb, H)
  s.push(`<rect x="-20" y="${f(PITCH_TOP)}" width="${W + 40}" height="${f(H - PITCH_TOP + 20)}" fill="${P.grassA}"/>`);
  for (let k = -16; k <= 16; k++) {
    if (k % 2 === 0) continue;
    const x0 = VP.x + (k - .5) * SW, x1 = x0 + SW;
    s.push(`<polygon points="${f(xAt(x0, PITCH_TOP))},${f(PITCH_TOP)} ${f(xAt(x1, PITCH_TOP))},${f(PITCH_TOP)} ${f(x1)},${H + 20} ${f(x0)},${H + 20}" fill="${P.grassB}"/>`);
  }
  s.push(`<rect x="-20" y="${f(PITCH_TOP)}" width="${W + 40}" height="${f(H - PITCH_TOP)}" fill="url(#farTint)"/>`);
  s.push(`<rect x="-20" y="${f(PITCH_TOP)}" width="${W + 40}" height="8" fill="url(#boardShadow)"/>`);
  s.push(`<rect x="-20" y="${f(PITCH_TOP + .4)}" width="${W + 40}" height="1.4" fill="${P.grassEdge}" opacity=".55"/>`);
  const tufts = (y, hMin, hMax, light, dark, up) => {
    const d = [], dd = [];
    for (let x = -10; x < W + 10; x += 3 + r() * 4) {
      const hh = hMin + r() * (hMax - hMin), lean = (r() - .5) * hh * .6, w = 1.3 + r() * 1.4;
      (r() < .5 ? d : dd).push(`M${f(x - w)} ${f(y)}L${f(x + lean)} ${f(y - up * hh)}L${f(x + w)} ${f(y)}z`);
    }
    return `<path d="${d.join('')}" fill="${light}"/><path d="${dd.join('')}" fill="${dark}"/>`;
  };
  s.push(tufts(PITCH_TOP + 2, 2, 4.5, P.tuftLight, P.grassA, 1));
  s.push(tufts(H + 1, 6, 13, P.tuftDark, mix(P.grassB, P.tuftDark, .5), 1));
  return s.join('\n');
}

function stadiumSvg(P) {
  const r = rng(20261008);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.roofTop}"/><stop offset="1" stop-color="${P.roofBottom}"/></linearGradient>
<linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bowlTop}"/><stop offset="1" stop-color="${P.bowlBottom}"/></linearGradient>
<linearGradient id="arch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.archGlow}" stop-opacity=".22"/><stop offset="1" stop-color="${P.arch}"/></linearGradient>
<linearGradient id="crowdShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.crowdDark}" stop-opacity=".55"/><stop offset=".55" stop-color="${P.crowdDark}" stop-opacity=".12"/><stop offset="1" stop-color="${P.crowdDark}" stop-opacity="0"/></linearGradient>
<radialGradient id="bokeh"><stop offset="0" stop-color="${P.bokeh}" stop-opacity=".95"/><stop offset=".35" stop-color="${P.bokeh}" stop-opacity=".45"/><stop offset="1" stop-color="${P.bokeh}" stop-opacity="0"/></radialGradient>
<linearGradient id="boardShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="farTint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.grassFar}" stop-opacity=".42"/><stop offset=".35" stop-color="${P.grassFar}" stop-opacity=".1"/><stop offset=".7" stop-color="${P.grassFar}" stop-opacity="0"/><stop offset="1" stop-color="#0a2a10" stop-opacity=".22"/></linearGradient>
<linearGradient id="boardShadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<filter id="b3" x="-5%" y="-200%" width="110%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
${TIERS.map((t, i) => `<filter id="crowd${i}" x="-2%" y="-20%" width="104%" height="140%"><feGaussianBlur stdDeviation="${t.blur}"/></filter>`).join('\n')}
</defs>
${stadium(P)}
${crowd(P, r)}
${boards(P, r)}
${pitch(P, r)}
</svg>`;
}

// A CLOUD, one per depth: soft overlapping puffs under one shared gradient (so no seams), lit on
// top, purple underneath, a flat-ish base, and blurred — no outline anywhere.
const CLOUDS = {
  far: { w: 420, h: 110, blur: 4, puffs: [[70, 70, 30], [130, 58, 40], [205, 54, 44], [280, 62, 36], [345, 72, 26]], base: [210, 78, 180, 18] },
  mid: { w: 420, h: 160, blur: 3, puffs: [[80, 100, 40], [150, 72, 58], [235, 62, 66], [315, 86, 48], [370, 108, 30]], base: [220, 116, 185, 26] },
  near: { w: 440, h: 200, blur: 2.5, puffs: [[78, 128, 46], [150, 92, 70], [245, 78, 80], [335, 104, 60], [395, 134, 34]], base: [230, 146, 200, 30] },
};
function cloudSvg(c, col) {
  const puffs = c.puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const [bx, by, brx, bry] = c.base;
  const top = Math.min(...c.puffs.map(([, y, r]) => y - r)), bottom = by + bry;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}">
<defs>
<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}"><stop offset="0" stop-color="${col.lit}"/><stop offset=".45" stop-color="${col.mid}"/><stop offset="1" stop-color="${col.belly}"/></linearGradient>
<filter id="s" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="${c.blur}"/></filter>
<filter id="h" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="${c.blur * 3}"/></filter>
</defs>
<g filter="url(#h)" fill="${col.lit}" opacity=".35">${puffs}</g>
<g filter="url(#s)" fill="url(#g)">${puffs}<ellipse cx="${bx}" cy="${by}" rx="${brx}" ry="${bry}"/></g>
</svg>`;
}

// Chrome draws the SVG into a 2x canvas and hands back a WebP (alpha kept: the sky stays clear).
async function bake(svg, w, h, out) {
  const CDP = 9451, prof = new URL('prof/', OUT);
  rmSync(prof, { recursive: true, force: true });
  const chrome = spawn(chromePath(), [`--remote-debugging-port=${CDP}`, '--headless=new', '--no-first-run',
    `--user-data-dir=${fileURLToPath(prof)}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let t;
    for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} }
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pend = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
    const send = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const res = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const img = new Image(); img.src = ${JSON.stringify(src)}; await img.decode();
      const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h};
      c.getContext('2d').drawImage(img, 0, 0, ${w}, ${h});
      return c.toDataURL('image/webp', .86); })()` });
    const url = res?.result?.value;
    if (!url?.startsWith('data:image/webp')) throw new Error('bake failed: ' + JSON.stringify(res).slice(0, 300));
    writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    ws.close();
  } finally {
    chrome.kill();
  }
}

const name = process.argv[2] || 'sunset';
const P = PALETTES[name];
if (!P) throw new Error(`no palette "${name}" — have: ${Object.keys(PALETTES).join(', ')}`);
mkdirSync(OUT, { recursive: true });
const svg = stadiumSvg(P);
writeFileSync(new URL(`home-${name}.svg`, OUT), svg);
for (const d of Object.keys(CLOUDS)) writeFileSync(new URL(`home-cloud-${d}.svg`, IMG), cloudSvg(CLOUDS[d], P.cloud[d]));
await bake(svg, W * 2, H * 2, new URL(`home-${name}.webp`, IMG));
console.log(`baked public/img/home-${name}.webp (${W * 2}×${H * 2}) and the three clouds`);
