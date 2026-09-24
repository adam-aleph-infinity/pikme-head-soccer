// FINDING THE BALL IN A FRAME. Pure image maths on grayscale arrays — no DOM, no fs — so the
// page (tools/hs-measure) and the extractor (_hs-extract.mjs) share it and node can test it.
//
// The method is the dull one on purpose, because it is the one that fails visibly:
//
//   1. BACKGROUND. The first second of every clip is a standstill (docs/HS-RECORDING.md asks for
//      it), so the per-pixel median of those frames is the empty pitch. Anything that moves later
//      is "not background".
//   2. DIFFERENCE. |frame − background| > threshold gives a mask of moving things.
//   3. BLOB NEAREST THE PREDICTION. Only the window around where the object should be (last
//      position + last velocity) is searched; of the connected blobs there, the one nearest the
//      prediction, and of a size close to the last one, wins.
//   4. CIRCLE FIT. An algebraic (Kåsa) least-squares circle through the blob's edge pixels. The
//      edge fit, not the centroid, because a ball half-hidden behind a head still has half an
//      edge that is a correct arc, while its centroid is wherever the visible half is.
//
// Known weakness, and why manual correction exists: whatever stood still during the first
// second (the heads at kickoff, the ball on its spawn spot) is IN the background, so where it
// used to be shows up as a "ghost" blob once it leaves. The prediction window usually walks
// away from the ghost; when it doesn't, you click.

// RGBA (canvas ImageData) → one channel, box-downsampled by an integer factor f.
//   'luma'   ordinary brightness — heads, anything
//   'white'  min − 2·(max − min) of R,G,B: bright AND colourless. Head Soccer's ball is white
//            (with black patches) on green grass; in this channel it is the brightest thing on
//            the pitch, while grass is ~0 and skin — bright but orange — is low, so a ball
//            touching a face stays a separate blob. (Plain min(R,G,B) was tried first: light
//            skin is bright in every channel and the tracker walked off onto a face.)
export function toGray(rgba, w, h, f = 1, channel = 'luma') {
  const gw = Math.floor(w / f), gh = Math.floor(h / f);
  const out = new Uint8Array(gw * gh);
  const n = f * f;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      for (let dy = 0; dy < f; dy++) {
        let o = ((gy * f + dy) * w + gx * f) * 4;
        if (channel === 'white') {
          for (let dx = 0; dx < f; dx++, o += 4) {
            const lo = Math.min(rgba[o], rgba[o + 1], rgba[o + 2]), hi = Math.max(rgba[o], rgba[o + 1], rgba[o + 2]);
            sum += Math.max(0, 3 * lo - 2 * hi);
          }
        }
        else for (let dx = 0; dx < f; dx++, o += 4) sum += rgba[o] * 0.299 + rgba[o + 1] * 0.587 + rgba[o + 2] * 0.114;
      }
      out[gy * gw + gx] = sum / n;
    }
  }
  return { w: gw, h: gh, f, channel, data: out };
}

// Per-pixel median of up to `max` frames spread evenly over the list.
export function medianBackground(grays, max = 31) {
  if (!grays.length) return null;
  const pick = [];
  const k = Math.min(max, grays.length);
  for (let j = 0; j < k; j++) pick.push(grays[Math.floor((j * grays.length) / k)]);
  const { w, h, f } = pick[0];
  const out = new Uint8Array(w * h);
  const col = new Uint8Array(k);
  for (let p = 0; p < w * h; p++) {
    for (let j = 0; j < k; j++) col[j] = pick[j].data[p];
    col.sort();
    out[p] = col[k >> 1];
  }
  return { w, h, f, data: out };
}

// How many pixels differ by more than `thr` — the duplicate-frame test. A count, not a mean:
// a ball moving a few pixels changes a few dozen pixels a lot, which a whole-frame mean
// drowns in compression noise.
export function diffCount(a, b, thr = 24) {
  let n = 0;
  const A = a.data, B = b.data;
  for (let p = 0; p < A.length; p++) if (Math.abs(A[p] - B[p]) > thr) n++;
  return n;
}

// The fraction of the frame that differs from the background. Head Soccer covers the pitch
// with full-screen overlays — the GOAL! banner, the darkened power cut-in, KICK OFF — and
// during those the "moving blob" nearest the prediction is a letter or a light ray. The
// tracker checks this first and records nothing for such a frame. Measured on a full match
// (M3): open play ~0.03, the GOAL! banner 0.09–0.15, a cut-in or a menu 0.3 and up.
export function overlayFraction(gray, bg, thr = 30) {
  return diffCount(gray, bg, thr) / gray.data.length;
}

// A frame is a duplicate when it is (near-)identical to the last UNIQUE frame. Comparing with
// the last unique one rather than the previous frame stops a slow drift from being dropped
// one imperceptible step at a time.
export function markDuplicates(grays, { thr = 24, minPx = 3 } = {}) {
  const dup = new Array(grays.length).fill(false);
  let ref = grays[0];
  for (let i = 1; i < grays.length; i++) {
    if (diffCount(grays[i], ref, thr) < minPx) dup[i] = true;
    else ref = grays[i];
  }
  return dup;
}

// The rate the GAME rendered at, as opposed to the rate the recorder wrote at: 1 / the median
// gap between consecutive unique frames. The median, so a standstill (all "duplicates") does
// not read as a slideshow.
export function effectiveFps(times, dup) {
  const gaps = [];
  let last = null;
  for (let i = 0; i < times.length; i++) {
    if (dup && dup[i]) continue;
    if (last !== null) gaps.push(times[i] - last);
    last = times[i];
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return 1 / gaps[gaps.length >> 1];
}

// Kåsa circle fit: least squares on x² + y² + Dx + Ey + F = 0.
export function fitCircle(pts) {
  if (pts.length < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const [x, y] of pts) {
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z;
  }
  // Normal equations  [sxx sxy sx; sxy syy sy; sx sy n] [D E F]ᵀ = −[sxz syz sz]ᵀ
  const sol = solve3([[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], [-sxz, -syz, -sz]);
  if (!sol) return null;
  const [D, E, F] = sol;
  const cx = -D / 2, cy = -E / 2;
  const r2 = cx * cx + cy * cy - F;
  return r2 > 0 ? { x: cx, y: cy, r: Math.sqrt(r2) } : null;
}

export function solve3(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j < 4; j++) M[r][j] -= k * M[c][j];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

// The blob search. Coordinates are in the GRAY image (i.e. already divided by its factor f).
//   at        {x, y}  predicted centre
//   searchR   half-size of the square window searched
//   expectR   the object's known radius (null = no preference). With it, a blob more than
//             maxGrow× that size is treated as the object merged with something else.
// Returns {x, y, r, area, merged, round} or null.
//   polarity  0: any change from the background; +1: only BRIGHTER than it (a white ball)
//   reacquire the ball was lost (off the top of the screen, behind the HUD): search the whole
//             window for ONE clean, round blob of about expectR, ignoring distance. More than
//             one candidate → null; the tracker would rather wait a frame than guess.
//   minY      reacquire only: ignore candidates above this y. The HUD's POWER gauge fills
//             with a bright, slowly advancing edge that is exactly "a small white thing that
//             was not in the background" — on M3 the ball was 'reacquired' on it for seconds.
export function findBlob(gray, bg, { at, searchR = 40, thr = 30, minArea = 6, expectR = null, maxGrow = 1.6, polarity = 0, reacquire = false, minY = -Infinity } = {}) {
  let nCand = 0;
  const { w, h } = gray;
  const x0 = Math.max(0, Math.floor(at.x - searchR)), x1 = Math.min(w - 1, Math.ceil(at.x + searchR));
  const y0 = Math.max(0, Math.floor(at.y - searchR)), y1 = Math.min(h - 1, Math.ceil(at.y + searchR));
  if (x1 < x0 || y1 < y0) return null;
  const ww = x1 - x0 + 1, wh = y1 - y0 + 1;
  const mask = new Uint8Array(ww * wh);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * w + x;
      const d = gray.data[p] - bg.data[p];
      if ((polarity > 0 ? d : Math.abs(d)) > thr) mask[(y - y0) * ww + (x - x0)] = 1;
    }
  }
  // Connected components, 4-neighbour flood fill with an explicit stack.
  const label = new Int32Array(ww * wh);
  let best = null, next = 1;
  const stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s]) continue;
    const id = next++;
    const cells = [];
    label[s] = id; stack.push(s);
    while (stack.length) {
      const q = stack.pop();
      cells.push(q);
      const qx = q % ww, qy = (q / ww) | 0;
      if (qx > 0 && mask[q - 1] && !label[q - 1]) { label[q - 1] = id; stack.push(q - 1); }
      if (qx < ww - 1 && mask[q + 1] && !label[q + 1]) { label[q + 1] = id; stack.push(q + 1); }
      if (qy > 0 && mask[q - ww] && !label[q - ww]) { label[q - ww] = id; stack.push(q - ww); }
      if (qy < wh - 1 && mask[q + ww] && !label[q + ww]) { label[q + ww] = id; stack.push(q + ww); }
    }
    if (cells.length < minArea) continue;
    const edge = [];
    let mx = 0, my = 0;
    for (const q of cells) {
      const qx = q % ww, qy = (q / ww) | 0;
      mx += qx; my += qy;
      const inside = (xx, yy) => xx >= 0 && yy >= 0 && xx < ww && yy < wh && label[yy * ww + xx] === id;
      if (!inside(qx - 1, qy) || !inside(qx + 1, qy) || !inside(qx, qy - 1) || !inside(qx, qy + 1)) {
        edge.push([qx + x0 + 0.5, qy + y0 + 0.5]);
      }
    }
    const areaR = Math.sqrt(cells.length / Math.PI);
    let c, merged = false;
    if (expectR && (areaR > expectR * maxGrow || areaR < expectR / maxGrow)) {
      // MERGED: the ball is touching a head (or a boot, or the net) and the two are one blob.
      // Or PARTIAL: half of it is hidden, and what is left is a smaller blob with one true arc.
      // Either way its size is known, so fit a circle of THAT radius to the edge pixels near
      // the prediction, dropping the ones that belong to something else.
      const near = edge.filter(([x, y]) => Math.hypot(x - at.x, y - at.y) < expectR * 2);
      c = fitCircleR(near, expectR, at);
      if (!c) continue;
      merged = true;
    } else {
      c = fitCircle(edge);
      // An edge fit that disagrees wildly with the blob's own size is a fit to noise.
      if (!c || c.r > areaR * 3 || c.r < areaR * 0.5) c = { x: mx / cells.length + x0 + 0.5, y: my / cells.length + y0 + 0.5, r: areaR };
    }
    // How much of the fitted disc the blob fills: ~1 for a ball, far less for a digit or a line.
    const round = cells.length / (Math.PI * c.r * c.r);
    if (reacquire && (c.y < minY || merged || round < 0.6 || round > 1.4 || Math.abs(Math.log(c.r / expectR)) > 0.35)) continue;
    const d = reacquire ? 0 : Math.hypot(c.x - at.x, c.y - at.y);
    const sizePenalty = expectR && !merged ? Math.abs(Math.log(c.r / expectR)) * expectR * 4 : 0;
    // A merged fit is a guess about a hidden edge: prefer a clean blob at the same distance.
    const score = d + sizePenalty + (merged ? expectR * 0.5 + c.resid * 4 : 0);
    if (!best || score < best.score) best = { x: c.x, y: c.y, r: c.r, area: cells.length, merged, round, score };
    nCand++;
  }
  if (reacquire && nCand !== 1) return null;       // two ball-like things: not a guess to make
  if (!best) return null;
  delete best.score;
  return best;
}

// A circle of KNOWN radius r through edge points: Gauss–Newton on Σ(|p − c| − r)², twice
// trimmed to the points within 1.5px of the circle so another object's edge drops out.
// resid is the RMS distance of the kept points from the circle.
export function fitCircleR(pts, r, init, iters = 12) {
  let cx = init.x, cy = init.y, use = pts;
  for (let pass = 0; pass < 3; pass++) {
    if (use.length < 5) return null;
    for (let it = 0; it < iters; it++) {
      let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
      for (const [x, y] of use) {
        const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1e-9;
        const jx = dx / d, jy = dy / d, e = d - r;
        a11 += jx * jx; a12 += jx * jy; a22 += jy * jy; b1 += jx * e; b2 += jy * e;
      }
      const det = a11 * a22 - a12 * a12;
      if (Math.abs(det) < 1e-9) break;
      cx -= (a22 * b1 - a12 * b2) / det;
      cy -= (a11 * b2 - a12 * b1) / det;
    }
    use = pts.filter(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < 1.5);
  }
  if (use.length < 5) return null;
  // Points on less than a third of the circle do not pin a centre down.
  const angles = new Set(use.map(([x, y]) => Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * 12)));
  if (angles.size < 4) return null;
  const resid = Math.sqrt(use.reduce((s, [x, y]) => s + (Math.hypot(x - cx, y - cy) - r) ** 2, 0) / use.length);
  return { x: cx, y: cy, r, resid };
}

// Constant-velocity prediction from the last two known positions (in time order), to time t.
export function predict(prev, t) {
  const known = prev.filter(Boolean);
  if (!known.length) return null;
  const b = known[known.length - 1];
  if (known.length < 2) return { x: b.x, y: b.y };
  const a = known[known.length - 2];
  const dt = b.t - a.t;
  if (!(dt > 0)) return { x: b.x, y: b.y };
  const k = (t - b.t) / dt;
  return { x: b.x + (b.x - a.x) * k, y: b.y + (b.y - a.y) * k };
}
