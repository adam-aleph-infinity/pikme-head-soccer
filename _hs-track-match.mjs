// A WHOLE HEAD SOCCER MATCH → per-frame tracks.   node _hs-track-match.mjs M5   (M1…M5, or all)
// Writes docs/hs-clips/<clip>.raw.json. The events (kicks, jumps, dashes, headers) are pulled out
// afterwards by _hs-match-events.mjs.
//
// Every one of Idan's five matches, tracked end to end in one pass each. What is read off every frame:
//   ball     a white blob of the ball's size with 8–40% of its disc black (the patches), not in
//            the median background; predicted from the last two positions, re-found when it is the
//            only ball-like thing on screen. Korea's white jersey has the area but no patches.
//   faces    both players' skin blobs, kept apart by continuity (the human is the left one at
//            kickoff, and attacks right, in every match).
//   buttons  the mean colour of a patch inside L, R, POWER, KICK and JUMP. HS lights a pressed
//            plaque solid yellow, so every press is readable frame by frame.
//
// CALIBRATION. The phone's game area is HS's 1.805:1 box with black bars either side; wall to wall
// is that box's width = 1060 world, one scale for both axes (checked on M5: the goal roof's front
// corner sits 103.5 px over the shoe line = 154 world, HS's measured goal top).
//   M1, M2, M5 (WhatsApp, 848x384): game x 70..781, shoe line y 322.5 (M5 frame 300).
//   M3, M4 (AirDrop 2556x1180, decoded at 1280 wide): game x 107..1172, shoe line 489 (M3's clicks).
// Every pixel size below was read on the 848 clips and scales by k = game width / 711.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { toGray, medianBackground, predict } from './tools/hs-track.mjs';

export const CLIPS = {
  M1: { src: 'hs-video/M1-arcade-kor-kor.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M2: { src: 'hs-video/M2-arcade-kor-uk.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M3: { src: 'hs-video/M3-airdrop-full.mp4', W: 1280, H: 590, x0: 107, x1: 1172, ground: 489, scale: true },
  M4: { src: 'hs-video/M4-gaps.mp4', W: 1280, H: 590, x0: 107, x1: 1172, ground: 489, scale: true },
  M5: { src: 'hs-video/M5-kor-kor-weak.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  // M6 (2026-09-29): Korea vs Cameroon, a full match in the day stadium; WhatsApp like M1/M2/M5.
  M6: { src: 'hs-video/M6-headers.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5, darkSkin: true },
  // M7–M11 (2026-10-02/03): Idan (Korea) against the arcade CPU by star rating, WhatsApp like M6 —
  // Italy 4★, UK 5★, Germany 5★, Russia 3★, Cameroon 1★. Each opens on the PLAYER SELECT screen.
  M7: { crowd: true, hairId: true, start: 23, src: 'hs-video/M7-italy-4star.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M8: { crowd: true, hairId: true, start: 7, src: 'hs-video/M8-uk-5star.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M9: { crowd: true, hairId: true, start: 4.5, src: 'hs-video/M9-germany-5star.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M10: { crowd: true, hairId: true, start: 5.5, src: 'hs-video/M10-russia-3star.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  M11: { crowd: true, hairId: true, skinId: true, start: 3.5, src: 'hs-video/M11-cameroon-1star.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5, darkSkin: true },
  // M12 (2026-10-06): Korea against Korea, both on HS's BASE stats (a fresh account, level 0, no
  // upgrades) — the reference for our level 0. Day stadium like M7–M11; both Korea, so no hair id.
  M12: { crowd: true, start: 4, src: 'hs-video/M12-base-stats.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  // M13 (2026-10-06): Idan on base stats again (level 0), kicking more, Korea vs the stage-1 Korea CPU,
  // sunset stadium. Opens on the pause menu.
  M13: { crowd: true, start: 9.5, src: 'hs-video/M13-base-kicks.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
  // M14 (2026-10-05 18.09, uploaded 10-06): Idan on LEVEL 8 stats against the stage-1 Korea CPU. The phone
  // fills its wider screen by stretching HS's box (848x392, ~120 fps), so the file here is the upload
  // squeezed back to 711x384, padded to M12's 848 and resampled to 60 fps: HUD, goals and boards then sit
  // on M12's pixels exactly. Idan plays a pink-haired card (a pig hat until it falls off), the CPU is
  // the black-haired Korea: `hairCpu` tells them apart.
  M14: { crowd: true, hairCpu: true, start: 4, src: 'hs-video/M14-level8.mp4', W: 848, H: 384, x0: 70, x1: 781, ground: 322.5 },
};

async function track(name) {
  const cfg = CLIPS[name];
  const { W, H, x0: GX0, x1: GX1, ground: GY } = cfg;
  const k = (GX1 - GX0) / 711, FB = W * H * 4;
  const calib = { wallL: GX0, wallR: GX1, ground: GY, W: 1060, groundY: 435, s: 1060 / (GX1 - GX0) };
  // the M5 patches, carried over by the game box: x from the left wall, y from the shoe line
  const M5P = { L: [128, 350, 150, 362], R: [262, 350, 284, 362], P: [436, 349, 448, 361], K: [548, 349, 560, 361], J: [668, 349, 680, 361] };
  const PATCH = Object.fromEntries(Object.entries(M5P).map(([key, [a, b, c, d]]) =>
    [key, [GX0 + (a - 70) * k, GY + (b - 322.5) * k, GX0 + (c - 70) * k, GY + (d - 322.5) * k].map(Math.round)]));

  // Real timestamps (the recorder's frame rate is variable), one per decoded frame.
  const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', cfg.src], { maxBuffer: 1 << 28 });
  const times = pr.stdout.toString().trim().split('\n').map((l) => parseFloat(l));
  const t0 = times[0];

  const decode = (onFrame) => new Promise((resolve, reject) => {
    const vf = cfg.scale ? ['-vf', `scale=${W}:${H}`] : [];
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', cfg.src, ...vf, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
    let buf = Buffer.alloc(0), i = 0;
    ff.stdout.on('data', (d) => {
      buf = buf.length ? Buffer.concat([buf, d]) : d;
      while (buf.length >= FB) { onFrame(buf.subarray(0, FB), i++); buf = buf.subarray(FB); }
    });
    ff.on('close', (c) => (c ? reject(new Error('ffmpeg ' + c)) : resolve(i)));
  });

  const patchMean = (px, [a, b, c, d]) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (let y = b; y < d; y++) for (let x = a; x < c; x++) { const o = (y * W + x) * 4; r += px[o]; g += px[o + 1]; bl += px[o + 2]; n++; }
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
  };
  // Skin: a warm peach (Korea, and the UK CPU in M2). Grass is green, the ball white.
  const peach = (r, g, b) => r > 170 && g > 110 && b > 70 && r > g + 18 && g > b + 8 && r - b < 150;
  // …and a brown one for M6's Cameroon CPU (read off M6 20 s: 143/115/98 down to 67/38/28).
  const brown = (r, g, b) => r >= 60 && r <= 170 && r > g + 18 && g > b + 4 && r - b > 35 && r - b < 110;
  const isSkin = cfg.darkSkin ? (r, g, b) => peach(r, g, b) || brown(r, g, b) : peach;
  const FY0 = Math.round(GY - 132 * k), FY1 = Math.round(GY + 12.5 * k);
  function skinBlobs(px, gray) {
    const mask = new Uint8Array(W * H);
    for (let y = FY0; y < FY1; y++) for (let x = GX0; x < GX1; x++) {
      const o = (y * W + x) * 4; if (!isSkin(px[o], px[o + 1], px[o + 2])) continue;
      // M6's day stadium: the crowd is skin-coloured and sits in the band a jumping head uses. It
      // does not move, so up there a face pixel must also stand off the median background. Only
      // above the ad boards (y < GY − 60 k): the CPU keeper stands in his goal so long that the
      // median background has his face in it.
      // (M7–M11's stadiums have skin-coloured crowds too: `crowd` applies the same rule.)
      if ((cfg.darkSkin || cfg.crowd) && y < GY - 60 * k && Math.abs(gray.data[y * W + x] - bg.data[y * W + x]) < 22) continue;
      mask[y * W + x] = 1;
    }
    const seen = new Uint8Array(W * H), blobs = [], st = [];
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || seen[s]) continue;
      let n = 0, sx = 0, sy = 0, minY = 1e9, maxY = 0, minX = 1e9, maxX = 0, pe = 0;
      seen[s] = 1; st.push(s);
      while (st.length) {
        const q = st.pop(), x = q % W, y = (q / W) | 0;
        { const o = q * 4; if (peach(px[o], px[o + 1], px[o + 2])) pe++; }
        n++; sx += x; sy += y; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x;
        // ±2 as well as ±1: the goal net draws 1-px lines over a face in the mouth
        for (const nq of [q - 1, q + 1, q - W, q + W, q - 2, q + 2, q - 2 * W, q + 2 * W]) if (mask[nq] && !seen[nq]) { seen[nq] = 1; st.push(nq); }
      }
      if (n < 50 * k * k) continue;
      // HAIR: the share of near-black pixels in a band just over the face (Idan's Korea has black
      // hair; none of M7–M11's CPUs do) — `hairId` clips use it to tell the two players apart.
      let dark = 0, tot = 0;
      for (let y = Math.max(0, minY - Math.round(9 * k)); y < minY - Math.round(2 * k); y++) for (let x = minX; x <= maxX; x++) {
        const o = (y * W + x) * 4; tot++; if (px[o] + px[o + 1] + px[o + 2] < 150) dark++;
      }
      // (and PEACH: the share of the face that is peach — Korea against M11's brown-skinned Cameroon)
      blobs.push({ x: sx / n, y: sy / n, n, minX, maxX, minY, maxY, hair: cfg.skinId ? pe / n : tot ? dark / tot : 0 });
    }
    return blobs;
  }
  let bg = null;
  const BY1 = Math.round(GY + 13.5 * k);
  function ballCandidates(px, gray) {
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < BY1; y++) for (let x = GX0; x < GX1; x++) {
      const o = (y * W + x) * 4, p = y * W + x;
      const lo = Math.min(px[o], px[o + 1], px[o + 2]), hi = Math.max(px[o], px[o + 1], px[o + 2]);
      if (lo > 175 && hi - lo < 50 && gray.data[p] - bg.data[p] > 40) mask[p] = 1;
    }
    const seen = new Uint8Array(W * H), out = [], st = [];
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || seen[s]) continue;
      let n = 0, a = 1e9, c = 0, b = 1e9, d = 0;
      seen[s] = 1; st.push(s);
      while (st.length) {
        const q = st.pop(), x = q % W, y = (q / W) | 0;
        n++; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y;
        for (const nq of [q - 1, q + 1, q - W, q + W]) if (mask[nq] && !seen[nq]) { seen[nq] = 1; st.push(nq); }
      }
      const w = c - a + 1, h = d - b + 1;
      if (n < 90 * k * k || n > 260 * k * k || w < 17 * k || w > 26 * k || h < 11 * k || h > 25 * k) continue;
      const r = w / 2, cx = (a + c) / 2, cy = b + r;           // the top edge is the clean one
      let dk = 0, tot = 0;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || y < 0 || y >= H) continue;
        const o = (y * W + x) * 4; tot++;
        if (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11 < 90) dk++;
      }
      const dark = dk / tot;
      if (dark < 0.08 || dark > 0.4) continue;
      out.push({ x: cx, y: cy, r, area: n });
    }
    return out;
  }

  // ---- pass 1: the background, the per-pixel median of 61 frames spread over the match ----
  const total = times.length, pick = new Set(), sample = [];
  for (let j = 0; j < 61; j++) pick.add(Math.floor(((j + 0.5) * total) / 61));
  await decode((px, i) => { if (pick.has(i)) sample.push(toGray(px, W, H, 1, 'white')); });
  bg = medianBackground(sample, 61);

  // ---- pass 2: track ----
  const rec = [];
  let hist = [], lost = 0, faces = [null, null], faceHist = [[], []], prevG = null;
  const n = await decode((px, i) => {
    const t = (times[i] ?? times[times.length - 1] + (i - times.length + 1) / 60) - t0;
    const gray = toGray(px, W, H, 1, 'white');
    // a repeated frame (the recorder wrote the same picture twice): flagged, the fits skip it
    let diff = 0;
    if (prevG) for (let p = 0; p < gray.data.length; p += 7) if (Math.abs(gray.data[p] - prevG.data[p]) > 24) diff++;
    const dup = !!prevG && diff < 3;
    prevG = gray;
    const cands = ballCandidates(px, gray);
    const at = predict(hist.slice(-2), t);
    let ball = null;
    if (at && lost < 8) {
      const gate = (45 + 12 * lost) * k;
      ball = cands.map((c) => ({ ...c, d: Math.hypot(c.x - at.x, c.y - at.y) })).filter((c) => c.d < gate).sort((a, b) => a.d - b.d)[0] || null;
    }
    if (!ball && cands.length === 1) ball = cands[0];
    if (ball) { hist.push({ x: ball.x, y: ball.y, t }); hist = hist.slice(-3); lost = 0; } else lost++;

    // FACES: identity is continuity alone — predicted from the last two positions, the pair
    // assigned jointly; overlapping heads record neither until they part; a face lost for a while
    // comes back as the one blob the other player is not.
    // (`start`: the clip opens on PLAYER SELECT and the VS screen, two big portraits; faces from kickoff on)
    const blobs = t < (cfg.start || 0) ? [] : skinBlobs(px, gray).filter((b) => b.n < 2500 * k * k && b.maxX - b.minX < 60 * k).sort((a, b) => b.n - a.n).slice(0, 5);
    const next = [null, null];
    if (!faces[0] || !faces[1]) {
      const two = blobs.slice(0, 2).sort((a, b) => a.x - b.x);
      if (two.length === 2 && Math.abs(two[0].x - two[1].x) > 60 * k) { next[0] = two[0]; next[1] = two[1]; }
    } else {
      const pred = [0, 1].map((q) => {
        const h = faceHist[q];
        const a = h[h.length - 1], b = h[h.length - 2];
        if (!a) return { ...faces[q], lag: 99 };
        const lag = Math.max(1, i - a.i);
        const v = b ? { x: (a.x - b.x) / Math.max(1, a.i - b.i), y: (a.y - b.y) / Math.max(1, a.i - b.i) } : { x: 0, y: 0 };
        return { x: a.x + v.x * Math.min(lag, 6), y: a.y + v.y * Math.min(lag, 6), lag };
      });
      const gate = (q) => (28 + 10 * Math.min(pred[q].lag || 1, 8)) * k;
      const cost = (q, b) => (b ? Math.hypot(b.x - pred[q].x, b.y - pred[q].y) : 60 * k);
      let best = null;
      const opts = [null, ...blobs];
      for (const a of opts) for (const b of opts) {
        if (a && a === b) continue;
        if (a && cost(0, a) > gate(0)) continue;
        if (b && cost(1, b) > gate(1)) continue;
        const c = cost(0, a) + cost(1, b);
        if (!best || c < best.c) best = { a, b, c };
      }
      if (best) {
        next[0] = best.a; next[1] = best.b;
        if (blobs.length === 1 && Math.hypot(pred[0].x - pred[1].x, pred[0].y - pred[1].y) < 45 * k) { next[0] = null; next[1] = null; }
      }
      for (let q = 0; q < 2; q++) {
        if (next[q] || !(pred[q].lag > 12)) continue;
        const other = next[1 - q] || pred[1 - q];
        const free = blobs.filter((b) => b !== next[1 - q] && Math.hypot(b.x - other.x, b.y - other.y) > 45 * k && b.n > 250 * k * k);
        if (free.length === 1) next[q] = free[0];
      }
    }
    if (cfg.hairId) {
      // the human is the black-haired one: a clear difference overrides continuity (after an overlap
      // the tracker used to carry on with the two swapped); one face alone takes the slot its hair says
      if (next[0] && next[1] && next[1].hair > next[0].hair + 0.08) [next[0], next[1]] = [next[1], next[0]];
      else if (!next[1] && next[0] && next[0].hair < (cfg.skinId ? 0.4 : 0.03)) { next[1] = next[0]; next[0] = null; }
      else if (!next[0] && next[1] && next[1].hair > (cfg.skinId ? 0.5 : 0.12)) { next[0] = next[1]; next[1] = null; }
    }
    if (cfg.hairCpu) {
      // the other way round: the CPU (Korea) is the black-haired one, the human is not
      if (next[0] && next[1] && next[0].hair > next[1].hair + 0.08) [next[0], next[1]] = [next[1], next[0]];
      else if (!next[1] && next[0] && next[0].hair > 0.12) { next[1] = next[0]; next[0] = null; }
      else if (!next[0] && next[1] && next[1].hair < 0.03) { next[0] = next[1]; next[1] = null; }
    }
    for (let q = 0; q < 2; q++) {
      if (next[q]) { faces[q] = next[q]; faceHist[q].push({ x: next[q].x, y: next[q].y, i }); faceHist[q] = faceHist[q].slice(-3); }
    }
    const btn = {};
    for (const key in PATCH) btn[key] = patchMean(px, PATCH[key]);
    rec.push({
      i, t: +t.toFixed(4), dup,
      ball: ball ? { x: +ball.x.toFixed(2), y: +ball.y.toFixed(2), r: +ball.r.toFixed(2), a: ball.area } : null,
      f: next.map((b) => (b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), n: b.n, x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, hair: +(b.hair ?? 0).toFixed(2) } : null)),
      btn,
    });
  });
  const out = `docs/hs-clips/${name}.raw.json`;
  writeFileSync(out, JSON.stringify({ clip: name, src: cfg.src, k, calib, patch: PATCH, frames: rec }));
  console.log(`${name}: ${n} frames (${times.length} timestamps), ball in ${rec.filter((r) => r.ball).length}, both faces in ${rec.filter((r) => r.f[0] && r.f[1]).length} → ${out}`);
}

const want = process.argv[2] || 'all';
for (const name of want === 'all' ? Object.keys(CLIPS) : [want]) await track(name);
