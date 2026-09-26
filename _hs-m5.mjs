// M5 (Idan's WhatsApp match, 848x384, Korea vs the weak CPU) → per-frame tracks.
// Run: node _hs-m5.mjs [--out docs/hs-clips/M5-kor-kor-weak.raw.json]   (after node _hs-extract.mjs hs-video/M5-kor-kor-weak.mp4 --out hs-video/M5 — the PNGs, so frame i IS frames.json[i])
//
// A whole match, not a shot-list clip, so it is tracked end to end in one pass and the events
// (kicks, jumps, dashes, headers) are pulled out afterwards (_hs-m5-events.mjs). What is read
// off every frame:
//   ball     the white channel against a median background (tools/hs-track.mjs findBlob),
//            predicted from the last two positions, re-found anywhere when lost
//   faces    both players' skin blobs (Korea vs Korea: the only skin on the pitch), kept apart
//            by continuity — left one is the human at kickoff
//   buttons  the mean colour of a patch inside L, R, POWER, KICK and JUMP. HS lights a pressed
//            plaque solid yellow, so a press is readable frame by frame.
//
// CALIBRATION (measured on frame 300): the game spans x 70..781 (black bars either side), so
// wall to wall is 711 px = 1060 world (1.4909 world px per video px, one scale for both axes —
// checked: the goal roof's front corner sits 103.5 px above the shoe line = 154 world, HS's
// measured goal top). The shoe line (ground) is y 322.5.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { toGray, medianBackground, findBlob, predict } from './tools/hs-track.mjs';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--')) || 'hs-video/M5-kor-kor-weak.mp4';
const outArg = args.indexOf('--out');
const out = outArg >= 0 ? args[outArg + 1] : 'docs/hs-clips/M5-kor-kor-weak.raw.json';
const W = 848, H = 384, FB = W * H * 4;
const frames = JSON.parse(readFileSync('hs-video/M5/frames.json', 'utf8'));

export const CALIB = { wallL: 70, wallR: 781, ground: 322.5, W: 1060, groundY: 435 };
CALIB.s = CALIB.W / (CALIB.wallR - CALIB.wallL);

const PATCH = {           // [x0, y0, x1, y1] inside each plaque, clear of its lettering
  L: [128, 350, 150, 362], R: [262, 350, 284, 362],
  P: [436, 349, 448, 361], K: [548, 349, 560, 361], J: [668, 349, 680, 361],
};

function decode(onFrame, select = null) {
  return new Promise((resolve, reject) => {
    const vf = select ? ['-vf', `select='${select}'`, '-vsync', '0'] : [];
    const ff = spawn('ffmpeg', ['-v', 'error', '-framerate', '60', '-i', 'hs-video/M5/frames/%05d.png', ...vf, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
    let buf = Buffer.alloc(0), i = 0;
    ff.stdout.on('data', (d) => {
      buf = buf.length ? Buffer.concat([buf, d]) : d;
      while (buf.length >= FB) { onFrame(buf.subarray(0, FB), i++); buf = buf.subarray(FB); }
    });
    ff.on('close', (c) => (c ? reject(new Error('ffmpeg ' + c)) : resolve(i)));
  });
}

const patchMean = (px, [x0, y0, x1, y1]) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; r += px[o]; g += px[o + 1]; b += px[o + 2]; n++; }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
};

// Skin: Korea's face is a warm peach. Grass is green, the ball white, the crowd far smaller.
const isSkin = (r, g, b) => r > 170 && g > 110 && b > 70 && r > g + 18 && g > b + 8 && r - b < 150;
function skinBlobs(px) {
  const mask = new Uint8Array(W * H);
  for (let y = 190; y < 335; y++) for (let x = 70; x < 781; x++) {
    const o = (y * W + x) * 4; if (isSkin(px[o], px[o + 1], px[o + 2])) mask[y * W + x] = 1;
  }
  const seen = new Uint8Array(W * H), blobs = [], st = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let n = 0, sx = 0, sy = 0, minY = 1e9, maxY = 0, minX = 1e9, maxX = 0;
    seen[s] = 1; st.push(s);
    while (st.length) {
      const q = st.pop(), x = q % W, y = (q / W) | 0;
      n++; sx += x; sy += y; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x;
      // ±2 as well as ±1: the goal net draws 1-px lines over a face in the mouth, and a face
      // cut into strips by it is still one face
      for (const nq of [q - 1, q + 1, q - W, q + W, q - 2, q + 2, q - 2 * W, q + 2 * W]) if (mask[nq] && !seen[nq]) { seen[nq] = 1; st.push(nq); }
    }
    if (n >= 50) blobs.push({ x: sx / n, y: sy / n, n, minX, maxX, minY, maxY });
  }
  return blobs;
}

function ballCandidates(px, gray) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < 336; y++) for (let x = 70; x < 781; x++) {
    const o = (y * W + x) * 4, p = y * W + x;
    const lo = Math.min(px[o], px[o + 1], px[o + 2]), hi = Math.max(px[o], px[o + 1], px[o + 2]);
    if (lo > 175 && hi - lo < 50 && gray.data[p] - bg.data[p] > 40) mask[p] = 1;
  }
  const seen = new Uint8Array(W * H), out = [], st = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let n = 0, x0 = 1e9, x1 = 0, y0 = 1e9, y1 = 0;
    seen[s] = 1; st.push(s);
    while (st.length) {
      const q = st.pop(), x = q % W, y = (q / W) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const nq of [q - 1, q + 1, q - W, q + W]) if (mask[nq] && !seen[nq]) { seen[nq] = 1; st.push(nq); }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (n < 90 || n > 260 || w < 17 || w > 26 || h < 11 || h > 25) continue;
    const r = w / 2, cx = (x0 + x1) / 2, cy = y0 + r;           // the top edge is the clean one
    let dk = 0, tot = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || y < 0 || y >= H) continue;
      const o = (y * W + x) * 4; tot++;
      if (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11 < 90) dk++;
    }
    const dark = dk / tot;
    if (dark < 0.08 || dark > 0.4) continue;
    out.push({ x: cx, y: cy, r, area: n, dark: +dark.toFixed(2), merged: h < 13 });
  }
  return out;
}

// ---- pass 1: background (white channel) from 61 frames spread over the match ----
const pick = new Set();
for (let j = 0; j < 61; j++) pick.add(Math.floor(((j + 0.5) * frames.length) / 61));
const sample = [];
await decode((px, i) => { if (pick.has(i)) sample.push(toGray(px, W, H, 1, 'white')); });
const bg = medianBackground(sample, 61);
console.log(`background from ${sample.length} frames`);

// ---- pass 2: track ----
const ER = 16.5 / CALIB.s;                 // the ball's radius in video px (~11.1)
const rec = [];
let hist = [], lost = 0, faces = [null, null], faceHist = [[], []];
await decode((px, i) => {
  const t = frames[i]?.t ?? i / 60;
  const gray = toGray(px, W, H, 1, 'white');
  // THE BALL'S SIGNATURE, read off frames 300, 900, 4900, 4930 (the ball at rest, rolling, in
  // the air): a white blob 19–24 px wide and 13–19 tall (its shaded lower edge drops out) with
  // 12–35% of the disc black (the patches). Korea's white jersey is the same area but has no
  // patches and sits under a face; the eye whites and the goal net are far smaller. Only white
  // that is NOT in the median background counts.
  const cands = ballCandidates(px, gray);
  const at = predict(hist.slice(-2), t);
  let ball = null;
  if (at && lost < 8) {
    const gate = 45 + 12 * lost;
    ball = cands.map((c) => ({ ...c, d: Math.hypot(c.x - at.x, c.y - at.y) })).filter((c) => c.d < gate).sort((a, b) => a.d - b.d)[0] || null;
  }
  if (!ball && cands.length === 1) ball = cands[0];     // re-found: one ball-like thing only
  if (ball) { hist.push({ x: ball.x, y: ball.y, t }); hist = hist.slice(-3); lost = 0; } else lost++;

  // FACES. Both players are Korea, so identity is continuity alone: each face is predicted from
  // its last two positions and the pair is assigned jointly (both ways tried, the cheaper kept).
  // One blob where two predictions meet is the two heads overlapping — neither is recorded
  // until they part, and the prediction carries them through.
  const blobs = skinBlobs(px).filter((b) => b.n < 2500 && b.maxX - b.minX < 60).sort((a, b) => b.n - a.n).slice(0, 5);
  const next = [null, null];
  if (!faces[0] || !faces[1]) {
    const two = blobs.slice(0, 2).sort((a, b) => a.x - b.x);
    if (two.length === 2 && Math.abs(two[0].x - two[1].x) > 60) { next[0] = two[0]; next[1] = two[1]; }
  } else {
    const pred = [0, 1].map((k) => {
      const h = faceHist[k].filter(Boolean);
      const a = h[h.length - 1], b = h[h.length - 2];
      if (!a) return faces[k];
      const lag = Math.max(1, i - a.i);
      const v = b ? { x: (a.x - b.x) / Math.max(1, a.i - b.i), y: (a.y - b.y) / Math.max(1, a.i - b.i) } : { x: 0, y: 0 };
      return { x: a.x + v.x * Math.min(lag, 6), y: a.y + v.y * Math.min(lag, 6), lag };
    });
    const gate = (k) => 28 + 10 * Math.min(pred[k].lag || 1, 8);
    const cost = (k, b) => (b ? Math.hypot(b.x - pred[k].x, b.y - pred[k].y) : 60);
    let bestA = null;
    const opts = [null, ...blobs];
    for (const a of opts) for (const b of opts) {
      if (a && a === b) continue;
      if (a && cost(0, a) > gate(0)) continue;
      if (b && cost(1, b) > gate(1)) continue;
      const c = cost(0, a) + cost(1, b);
      if (!bestA || c < bestA.c) bestA = { a, b, c };
    }
    if (bestA) {
      next[0] = bestA.a; next[1] = bestA.b;
      // two predictions on one blob, the other side empty: overlapping heads, record neither
      const lone = blobs.length === 1 && Math.hypot(pred[0].x - pred[1].x, pred[0].y - pred[1].y) < 45;
      if (lone) { next[0] = null; next[1] = null; }
    }
    // RE-FOUND BY EXCLUSION. There are only two players: a face lost for a while (in the net,
    // behind the other) comes back as the one blob the other player is not.
    for (let k = 0; k < 2; k++) {
      if (next[k] || !(pred[k].lag > 12)) continue;
      const other = next[1 - k] || pred[1 - k];
      const free = blobs.filter((b) => b !== next[1 - k] && Math.hypot(b.x - other.x, b.y - other.y) > 45 && b.n > 250);
      if (free.length === 1) next[k] = free[0];
    }
  }
  for (let k = 0; k < 2; k++) {
    if (next[k]) { faces[k] = next[k]; faceHist[k].push({ x: next[k].x, y: next[k].y, i }); faceHist[k] = faceHist[k].slice(-3); }
  }
  const btn = {};
  for (const k in PATCH) btn[k] = patchMean(px, PATCH[k]);
  rec.push({
    i, t: +t.toFixed(4), dup: !!frames[i]?.dup,
    ball: ball ? { x: +ball.x.toFixed(2), y: +ball.y.toFixed(2), r: +ball.r.toFixed(2), a: ball.area, m: ball.merged ? 1 : 0 } : null,
    f: next.map((b) => (b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), n: b.n, x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY } : null)),
    btn,
  });
  if (i % 1000 === 0) console.log('frame', i);
});
writeFileSync(out, JSON.stringify({ clip: 'M5', src, calib: CALIB, patch: PATCH, frames: rec }));
console.log(`wrote ${out}: ${rec.length} frames, ball seen in ${rec.filter((r) => r.ball).length}`);
