// tools/hs-glow-measure.mjs — MEASURE THE ARMED GLOW, Head Soccer's or ours, the same way.
//
// For every frame: subtract an empty background (same camera, nothing there), keep only the
// flame's light (new, bright, lemon-yellow or white-hot), map it into HEAD-RADIUS units round the
// head centre, and add it up. Out come numbers that can be compared between HS and ours:
//   · the occupancy map (how often each spot round the head is flame) and its picture
//   · per frame, per side: flame area, top, reach out, how many separate pieces (split / merged)
//   · how fast it changes (overlap of the flame with itself 1, 2, 4, 8 frames later)
//
//   node tools/hs-glow-measure.mjs <spec.json> <out-prefix>
//   spec: { video, t, n } | { frames: [{ png }] }, bg: 'low' | { video, t } | { png }, cx, cy, R
//         (cx, cy, R in the frame's own px; frames are consecutive at `fps`)
// HS footage is only LOOKED AT here; nothing from it goes into the game.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FF = '/opt/homebrew/bin/ffmpeg';
const [specFile, out] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { cx, cy, R } = spec;
// the box, in head radii from the head centre (y down): ±X across, Y0 (above) … Y1 (below)
const X = 3, Y0 = -3.4, Y1 = 2.4, G = 16;                      // G cells a head radius
const GW = Math.round(2 * X * G), GH = Math.round((Y1 - Y0) * G);
const bx = Math.round(cx - X * R), by = Math.round(cy + Y0 * R), bw = Math.round(2 * X * R), bh = Math.round((Y1 - Y0) * R);

const raw = (src, n = 1) => {
  const inp = src.video ? ['-ss', String(src.t), '-i', src.video, '-frames:v', String(n)] : ['-i', src.png];
  const r = spawnSync(FF, ['-v', 'error', ...inp, '-vf', `crop=${bw}:${bh}:${bx}:${by},scale=${GW}:${GH}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  return r.stdout;
};
const F = GW * GH * 3;
let frames = [];
if (spec.video) { const all = raw({ video: spec.video, t: spec.t }, spec.n); for (let k = 0; (k + 1) * F <= all.length; k++) frames.push(all.subarray(k * F, (k + 1) * F)); }
else frames = spec.frames.map((f) => raw(f));
// the background: a given empty frame, or (bg: "low") the window itself — flames only ADD light,
// so each pixel's dim end over the frames (its 15th percentile by brightness) is the scene
// without them (the stadium's LED boards change, so an empty frame from elsewhere does not do)
let bg;
if (spec.bg === 'low') {
  bg = Buffer.alloc(F);
  const idx = frames.map((_, k) => k), q = Math.floor(frames.length * 0.15);
  for (let i = 0; i < GW * GH; i++) {
    idx.sort((a, b) => (frames[a][i * 3] + frames[a][i * 3 + 1] + frames[a][i * 3 + 2]) - (frames[b][i * 3] + frames[b][i * 3 + 1] + frames[b][i * 3 + 2]));
    const f = frames[idx[q]]; bg[i * 3] = f[i * 3]; bg[i * 3 + 1] = f[i * 3 + 1]; bg[i * 3 + 2] = f[i * 3 + 2];
  }
} else bg = raw(spec.bg);

// the head itself (and the suit under it) is not flame: leave out the inside of its outline
const inHead = (x, y) => {
  const a = Math.atan2(y - 0.06, x), c = Math.cos(a), s = Math.sin(a), n = s < 0 ? 2.1 : 2.9;
  const ex = Math.sign(c) * Math.abs(c) ** (2 / n), ey = Math.sign(s) * Math.abs(s) ** (2 / n);
  const Rr = Math.hypot(ex * 1.17, ey * 1.07 * (ey < 0 ? 1.12 : 0.88));
  return Math.hypot(x, y - 0.06) < Rr * 0.9 || (y > 0.8 && y < 1.9 && Math.abs(x) < 0.6);
};
const cell = (i) => [(i % GW) / G - X, Math.floor(i / GW) / G + Y0];

// flame-ness of one pixel: 0 … 1 (core), plus a separate soft-glow value
function classify(f, i) {
  const r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2];
  const d = Math.abs(r - bg[i * 3]) + Math.abs(g - bg[i * 3 + 1]) + Math.abs(b - bg[i * 3 + 2]);
  const white = r > 235 && g > 230 && b > 200;
  const lemon = r > 200 && g > 0.86 * r && b < 0.82 * g;
  const core = d > 70 && (white || (lemon && (r + g) / 2 > 215)) ? 1 : 0;
  const glow = d > 40 && r > 150 && g > 0.8 * r && b < 0.85 * g ? Math.min(1, d / 200) : 0;
  return [core, glow];
}
const N = frames.length, occ = new Float32Array(GW * GH), glowM = new Float32Array(GW * GH), masks = [];
const per = [];
for (const f of frames) {
  const m = new Uint8Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) {
    const [x, y] = cell(i);
    if (inHead(x, y)) continue;
    const [c, gl] = classify(f, i);
    m[i] = c; occ[i] += c / N; glowM[i] += gl / N;
  }
  masks.push(m);
  // per side: area (head radii²), top, reach out, pieces (4-connected, ≥ 3 cells)
  const side = (sg) => {
    let area = 0, top = 9, reach = 0;
    const seen = new Uint8Array(GW * GH);
    let pieces = 0;
    for (let i = 0; i < GW * GH; i++) {
      const [x, y] = cell(i);
      if (!m[i] || Math.sign(x) !== sg) continue;
      area++; top = Math.min(top, y); reach = Math.max(reach, Math.abs(x));
      if (seen[i]) continue;
      let sz = 0; const st = [i]; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); sz++;
        const jx = j % GW, jy = Math.floor(j / GW);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qx = jx + dx, qy = jy + dy, q = qy * GW + qx;
          if (qx < 0 || qy < 0 || qx >= GW || qy >= GH || seen[q] || !m[q] || Math.sign(qx / G - X) !== sg) continue;
          seen[q] = 1; st.push(q);
        }
      }
      if (sz >= 3) pieces++;
    }
    return { area: area / (G * G), top, reach, pieces };
  };
  per.push({ L: side(-1), R: side(1) });
}
// how fast it changes: IoU of the flame with itself `lag` frames later
const iou = (a, b) => { let I = 0, U = 0; for (let i = 0; i < a.length; i++) { I += a[i] & b[i]; U += a[i] | b[i]; } return U ? I / U : 1; };
const lags = {};
for (const lag of [1, 2, 3, 4, 8, 16]) { let s = 0, c = 0; for (let k = 0; k + lag < N; k++) { s += iou(masks[k], masks[k + lag]); c++; } lags[lag] = c ? +(s / c).toFixed(3) : null; }
const stat = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: +m.toFixed(3), sd: +Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length).toFixed(3), min: +Math.min(...a).toFixed(2), max: +Math.max(...a).toFixed(2) }; };
const sideStats = (k) => ({
  area: stat(per.map((p) => p[k].area)),
  top: stat(per.map((p) => (p[k].top < 9 ? p[k].top : 0))),
  reach: stat(per.map((p) => p[k].reach)),
  pieces: stat(per.map((p) => p[k].pieces)),
  split: +(per.filter((p) => p[k].pieces >= 2).length / N).toFixed(3),
});
// where the flame is, as a profile: for each height band, the mean X of the flame on the right side
const profile = [];
for (let yb = Y0; yb < Y1 - 0.01; yb += 0.4) {
  let s = 0, w = 0, xin = 9, xout = 0;
  for (let i = 0; i < GW * GH; i++) {
    const [x, y] = cell(i);
    if (y < yb || y >= yb + 0.4 || x <= 0 || occ[i] < 0.15) continue;
    s += x * occ[i]; w += occ[i]; xin = Math.min(xin, x); xout = Math.max(xout, x);
  }
  profile.push({ y: +yb.toFixed(1), occ: +(w / G / G).toFixed(3), x: w ? +(s / w).toFixed(2) : null, xin: w ? +xin.toFixed(2) : null, xout: w ? +xout.toFixed(2) : null });
}
// how thick the lines are: the flame's horizontal runs, row by row (its strokes run mostly up),
// on the right side, outside the head — the median run, in head radii (white-hot core and all)
const runs = [];
for (const m of masks) {
  for (let y = 0; y < GH; y++) {
    let len = 0;
    for (let x = Math.round(X * G); x <= GW; x++) {
      const on = x < GW && m[y * GW + x];
      if (on) len++;
      else if (len) { if (len >= 1 && len < G * 0.8) runs.push(len / G); len = 0; }
    }
  }
}
runs.sort((a, b) => a - b);
const thick = { median: runs.length ? +runs[Math.floor(runs.length / 2)].toFixed(3) : null, p75: runs.length ? +runs[Math.floor(runs.length * 0.75)].toFixed(3) : null };
const res = { thick, frames: N, L: sideStats('L'), R: sideStats('R'), change: lags, profile, series: per.map((p) => [p.L.pieces, p.R.pieces, +p.R.area.toFixed(2)]) };
writeFileSync(`${out}.json`, JSON.stringify(res, null, 1));
// the occupancy map as a picture (white = always flame), the glow map beside it
const img = Buffer.alloc(GW * 2 * GH * 3);
for (let i = 0; i < GW * GH; i++) {
  const x = i % GW, y = Math.floor(i / GW), [hx, hy] = cell(i), head = inHead(hx, hy);
  const o = (y * GW * 2 + x) * 3, o2 = o + GW * 3;
  const v = Math.round(255 * Math.min(1, occ[i] * 1.5)), gv = Math.round(255 * Math.min(1, glowM[i] * 1.5));
  img[o] = v; img[o + 1] = v; img[o + 2] = head ? 90 : v * 0.3;
  img[o2] = gv; img[o2 + 1] = gv; img[o2 + 2] = head ? 90 : 0;
}
spawnSync(FF, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${GW * 2}x${GH}`, '-i', '-', '-vf', `scale=${GW * 6}:${GH * 3}:flags=neighbor`, `${out}.png`], { input: img });
console.log(JSON.stringify({ thick, area: res.R.area.mean, top: res.R.top.mean, reach: res.R.reach.mean, change: lags }, null, 0));
