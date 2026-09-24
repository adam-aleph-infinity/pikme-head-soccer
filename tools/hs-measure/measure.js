// THE MEASURING PAGE. Frames in, a .tracks.json out.
//
// Positions are kept in SOURCE-VIDEO PIXELS while you work and only mapped into world units
// when saving, so a recalibration (you misclicked a wall) re-maps everything already tracked
// instead of leaving it in the old units. The saved file carries the calibration clicks, so
// loading it back converts the other way.
import { CALIB_POINTS, makeCalib, pxToWorld, worldToPx, pxLen } from '/tools/hs-calib.mjs';
import { toGray, medianBackground, findBlob, predict, overlayFraction } from '/tools/hs-track.mjs';

const $ = (id) => document.getElementById(id);
const view = $('view'), ctx = view.getContext('2d');
const loupe = $('loupe'), lctx = loupe.getContext('2d');

const TAGS = [
  ['kick', 'k'], ['bounce', 'b'], ['touch', 'o'], ['goal', 'g'],
  ['ready_on', 'r'], ['ready_off', 'f'], ['gauge_full', 'u'], ['power_press', 'p'],
  ['jump_tap', 'j'], ['jump_hold', 'h'], ['dash', 'd'], ['release', 'l'],
  ['cutin_on', 'c'], ['cutin_off', 'v'],
];
const COLORS = { ball: '#ffd84a', p0: '#4ad0ff', p1: '#ff6a6a' };
// How each object is looked for (tools/hs-track.mjs explains the channels). The ball is found
// as "brighter and whiter than the background" — tried on real footage, plain brightness
// difference latched onto pale cartoon faces within half a second. Heads use brightness.
const LOOK = {
  ball: { channel: 'white', polarity: 1, thr: () => Number($('thrBall').value) },
  p0: { channel: 'luma', polarity: 0, thr: () => Number($('thr').value) },
  p1: { channel: 'luma', polarity: 0, thr: () => Number($('thr').value) },
};
const OVERLAY = 0.08;      // > this fraction of the frame changed = a banner / cut-in: skip (play is ~0.03,
                           // a GOAL! banner 0.09–0.15, a cut-in or a menu 0.3+ — measured on M3)
const OBJS = ['ball', 'p0', 'p1'];

const S = {
  world: null, clip: null, meta: null, frames: [], cur: 0,
  clicks: {}, calibKey: CALIB_POINTS[0].key, calib: null,
  pos: { ball: new Map(), p0: new Map(), p1: new Map() },   // i → {x, y, r} in px
  tags: [],
  img: new Map(), gray: new Map(), bg: {}, f: 1, scale: 1,
  running: false, mouse: null,
};

const status = (msg, err = false) => { $('status').textContent = msg; $('status').className = err ? 'err' : ''; };
const mode = () => document.querySelector('input[name=mode]:checked').value;
const obj = () => document.querySelector('input[name=obj]:checked').value;
const setObj = (o) => { document.querySelector(`input[name=obj][value=${o}]`).checked = true; draw(); };

// ─── loading ─────────────────────────────────────────────────────────────────────────────────
async function init() {
  S.world = await (await fetch('/api/world')).json();
  const clips = await (await fetch('/api/clips')).json();
  $('clip').innerHTML = clips.map((c) => `<option value="${c.clip}">${c.clip}${c.saved ? ' ✓' : ''}</option>`).join('');
  const want = new URLSearchParams(location.search).get('clip');
  if (want) $('clip').value = want;
  if (!clips.length) status('no clips in hs-video/ — run node _hs-extract.mjs first', true);
  else await loadClip($('clip').value);
  $('tagbtns').innerHTML = TAGS.map(([t, k]) => `<button data-tag="${t}">${t} (${k})</button>`).join('');
  renderCalibList();
}

async function loadClip(name) {
  S.clip = name;
  S.frames = await (await fetch(`/video/${name}/frames.json`)).json();
  S.meta = await (await fetch(`/video/${name}/meta.json`)).json().catch(() => ({}));
  S.img.clear(); S.gray.clear(); S.bg = {};
  S.clicks = {}; S.calib = null; S.tags = [];
  for (const o of OBJS) S.pos[o].clear();
  const saved = await (await fetch(`/api/tracks/${name}`)).json();
  if (saved) restore(saved);
  $('slider').max = String(S.frames.length - 1);
  const first = await image(0);
  // Track on at most ~1280px wide; calibration clicks stay in full frame pixels.
  S.f = Math.max(1, Math.ceil(first.naturalWidth / 1280));
  fitCanvas(first);
  await go(0);
  status(`${name}: ${S.frames.length} frames, ${S.meta.fps ? S.meta.fps.toFixed(1) + ' fps unique' : ''}${saved ? ' — loaded saved tracks' : ''}`);
  renderCalibList(); renderTags();
}

function restore(doc) {
  S.clicks = doc.calib?.clicks ?? {};
  S.calib = makeCalib(S.clicks, { W: S.world.W, groundY: S.world.GROUND_Y });
  S.tags = doc.tags ?? [];
  if (!S.calib) return;
  for (const fr of doc.frames ?? []) {
    for (const o of OBJS) {
      const w = fr[o];
      if (!w) continue;
      const p = worldToPx(S.calib, w);
      S.pos[o].set(fr.i, { x: p.x, y: p.y, r: w.r != null ? w.r / S.calib.scale : null });
    }
  }
}

function image(i) {
  if (S.img.has(i)) return S.img.get(i).p;
  const im = new Image();
  const p = new Promise((res, rej) => { im.onload = () => res(im); im.onerror = rej; });
  im.src = `/video/${S.clip}/frames/${String(i).padStart(5, '0')}.${S.meta.ext || 'png'}`;
  S.img.set(i, { im, p });
  // A few hundred decoded frames is plenty; the oldest go first.
  if (S.img.size > 240) S.img.delete(S.img.keys().next().value);
  return p;
}

const scratch = document.createElement('canvas');
async function gray(i, channel = 'luma') {
  const key = channel + ':' + i;
  if (S.gray.has(key)) return S.gray.get(key);
  const im = await image(i);
  scratch.width = im.naturalWidth; scratch.height = im.naturalHeight;
  const sc = scratch.getContext('2d', { willReadFrequently: true });
  sc.drawImage(im, 0, 0);
  const g = toGray(sc.getImageData(0, 0, im.naturalWidth, im.naturalHeight).data, im.naturalWidth, im.naturalHeight, S.f, channel);
  S.gray.set(key, g);
  if (S.gray.size > 400) S.gray.delete(S.gray.keys().next().value);
  return g;
}

// The median of up to 31 unique frames in the chosen time range. For a standstill clip the
// first second; for a whole match, a long stretch of open play works too (nothing stays put).
async function background(channel) {
  if (S.bg[channel]) return S.bg[channel];
  const t0 = Number($('bg0').value), t1 = Number($('bg1').value);
  const idx = S.frames.filter((f) => f.t >= t0 && f.t <= t1 && !f.dup).map((f) => f.i);
  if (!idx.length) idx.push(0);
  status(`building ${channel} background from ${idx.length} frames…`);
  const step = Math.max(1, Math.floor(idx.length / 31));
  const gs = [];
  for (let k = 0; k < idx.length; k += step) gs.push(await gray(idx[k], channel));
  S.bg[channel] = medianBackground(gs);
  status(`${channel} background: median of ${gs.length} frames in ${t0}–${t1}s`);
  return S.bg[channel];
}
async function buildBackground() { S.bg = {}; await background('luma'); await background('white'); }

function fitCanvas(im) {
  const maxW = $('stage').clientWidth - 4, maxH = $('stage').clientHeight - 4;
  S.scale = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight, 1.5);
  view.width = Math.round(im.naturalWidth * S.scale);
  view.height = Math.round(im.naturalHeight * S.scale);
}

async function go(i) {
  S.cur = Math.max(0, Math.min(S.frames.length - 1, i));
  $('slider').value = String(S.cur);
  await image(S.cur);
  for (let k = 1; k <= 3; k++) image(Math.min(S.frames.length - 1, S.cur + k));   // prefetch
  draw();
}

// ─── drawing ─────────────────────────────────────────────────────────────────────────────────
function draw() {
  const e = S.img.get(S.cur);
  if (!e || !e.im.complete) return;
  const im = e.im, s = S.scale;
  ctx.drawImage(im, 0, 0, view.width, view.height);

  // Calibration: walls as vertical lines, horizontal ones for ground / bar / head.
  ctx.lineWidth = 1;
  for (const cp of CALIB_POINTS) {
    const c = S.clicks[cp.key];
    if (!c) continue;
    ctx.strokeStyle = cp.key === S.calibKey && mode() === 'calib' ? '#ffd84a' : 'rgba(120,255,120,0.7)';
    ctx.beginPath();
    if (cp.axis === 'x') { ctx.moveTo(c.x * s, 0); ctx.lineTo(c.x * s, view.height); }
    else { ctx.moveTo(0, c.y * s); ctx.lineTo(view.width, c.y * s); }
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.fillText(cp.key, c.x * s + 4, c.y * s - 4);
  }

  // Objects: this frame as a circle, the selected one with a trail.
  for (const o of OBJS) {
    const cur = S.pos[o].get(S.cur);
    ctx.strokeStyle = COLORS[o];
    if (o === obj()) {
      ctx.globalAlpha = 0.5; ctx.beginPath();
      let first = true;
      for (let k = S.cur - 40; k <= S.cur; k++) {
        const p = S.pos[o].get(k);
        if (!p) { first = true; continue; }
        if (first) ctx.moveTo(p.x * s, p.y * s); else ctx.lineTo(p.x * s, p.y * s);
        first = false;
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (!cur) continue;
    ctx.lineWidth = o === obj() ? 2 : 1;
    ctx.beginPath(); ctx.arc(cur.x * s, cur.y * s, Math.max(3, (cur.r ?? 6) * s), 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cur.x * s - 3, cur.y * s); ctx.lineTo(cur.x * s + 3, cur.y * s); ctx.stroke();
  }
  ctx.lineWidth = 1;

  const fr = S.frames[S.cur];
  const tagsHere = S.tags.filter((t) => t.i === S.cur).map((t) => t.type).join(', ');
  $('frameinfo').textContent = `#${fr.i}  t=${fr.t.toFixed(3)}s${fr.dup ? '  (duplicate)' : ''}${tagsHere ? '  [' + tagsHere + ']' : ''}`;
  const p = S.pos[obj()].get(S.cur);
  $('posinfo').textContent = p && S.calib
    ? `${obj()} world (${pxToWorld(S.calib, p).x.toFixed(1)}, ${pxToWorld(S.calib, p).y.toFixed(1)})${p.r ? ' r=' + pxLen(S.calib, p.r).toFixed(1) : ''}`
    : p ? `${obj()} px (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) — not calibrated` : `${obj()}: —`;
  drawLoupe();
}

function drawLoupe() {
  const e = S.img.get(S.cur);
  if (!S.mouse || !e) { loupe.hidden = true; return; }
  loupe.hidden = false;
  const Z = 4, half = loupe.width / Z / 2;
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(e.im, S.mouse.x - half, S.mouse.y - half, half * 2, half * 2, 0, 0, loupe.width, loupe.height);
  lctx.strokeStyle = '#f0f'; lctx.beginPath();
  lctx.moveTo(loupe.width / 2, 0); lctx.lineTo(loupe.width / 2, loupe.height);
  lctx.moveTo(0, loupe.height / 2); lctx.lineTo(loupe.width, loupe.height / 2); lctx.stroke();
  const w = S.calib ? pxToWorld(S.calib, S.mouse) : null;
  $('mouseinfo').textContent = `mouse px (${S.mouse.x.toFixed(0)}, ${S.mouse.y.toFixed(0)})` +
    (w ? `  world (${w.x.toFixed(1)}, ${w.y.toFixed(1)})` : '');
}

function renderCalibList() {
  $('calibpts').innerHTML = CALIB_POINTS.map((cp) =>
    `<li data-key="${cp.key}" class="${cp.key === S.calibKey ? 'cur' : ''} ${S.clicks[cp.key] ? 'done' : ''}">${cp.label}</li>`).join('');
  const c = S.calib?.checks;
  $('checks').innerHTML = S.calib
    ? `scale ${S.calib.scale.toFixed(4)} world px / px<br>` +
      `goal height ${c.goalHeight?.toFixed(1) ?? '—'} (ours ${S.world.GOAL_H})<br>` +
      `head diameter ${c.headDiameter?.toFixed(1) ?? '—'} (ours ${S.world.HEAD_R ? 2 * S.world.HEAD_R : '—'})<br>` +
      `goal mouth x ${c.goalMouthX?.toFixed(1) ?? '—'} (ours ${S.world.GOAL_W})`
    : 'click the walls and the ground first';
}

function renderTags() {
  S.tags.sort((a, b) => a.i - b.i);
  $('tags').innerHTML = S.tags.map((t, k) =>
    `<li data-k="${k}">#${t.i} ${t.t.toFixed(3)}s <b>${t.type}</b> ${t.note ? '· ' + t.note : ''}<span class="x" data-del="${k}">✕</span></li>`).join('');
}

// ─── clicking ────────────────────────────────────────────────────────────────────────────────
const toPx = (ev) => { const r = view.getBoundingClientRect(); return { x: (ev.clientX - r.left) / S.scale, y: (ev.clientY - r.top) / S.scale }; };

view.addEventListener('mousemove', (ev) => { S.mouse = toPx(ev); drawLoupe(); });
view.addEventListener('mouseleave', () => { S.mouse = null; drawLoupe(); });
view.addEventListener('click', async (ev) => {
  const p = toPx(ev);
  if (mode() === 'calib') {
    S.clicks[S.calibKey] = p;
    S.calib = makeCalib(S.clicks, { W: S.world.W, groundY: S.world.GROUND_Y });
    const k = CALIB_POINTS.findIndex((c) => c.key === S.calibKey);
    const next = CALIB_POINTS.slice(k + 1).find((c) => !S.clicks[c.key]);
    if (next) S.calibKey = next.key;
    renderCalibList(); draw();
    return;
  }
  await setPos(obj(), S.cur, p, $('snap').checked);
  draw();
});

// A click is "the object is about here"; with snap on it is refined to the moving blob under
// it, which also gives the ball its radius.
async function setPos(o, i, p, snap) {
  const prev = S.pos[o].get(i) ?? lastKnown(o, i);
  let r = prev?.r ?? defaultR(o);
  if (snap) {
    const L = LOOK[o];
    const bg = await background(L.channel);
    const g = await gray(i, L.channel);
    // No size preference on a click: this is where the ball's radius is learnt.
    const b = findBlob(g, bg, { at: { x: p.x / S.f, y: p.y / S.f }, searchR: Math.max(6, (r * 1.5) / S.f),
      thr: L.thr(), polarity: L.polarity, expectR: o === 'ball' ? null : r / S.f });
    if (b) { p = { x: b.x * S.f, y: b.y * S.f }; if (o === 'ball') r = b.r * S.f; }
  }
  S.pos[o].set(i, { x: p.x, y: p.y, r });
}

function defaultR(o) {
  const c = S.clicks;
  if (o !== 'ball' && c.headTop && c.headBottom) return Math.abs(c.headBottom.y - c.headTop.y) / 2;
  return S.calib ? 12 / S.calib.scale : 10;
}

function lastKnown(o, i) {
  for (let k = i - 1; k >= 0 && k > i - 30; k--) if (S.pos[o].has(k)) return S.pos[o].get(k);
  return null;
}

// ─── auto-track ──────────────────────────────────────────────────────────────────────────────
// From the current frame forward until the end or Esc. Needs the object's position on this
// frame (click it first); its radius there is held fixed for the whole run, which is what lets
// the tracker keep the ball apart from a head it is touching.
//   duplicate frame   copies the previous position (the fits skip duplicates anyway)
//   overlay frame     (GOAL banner, power cut-in) records nothing
//   lost              records nothing, then looks for ONE ball-sized round blob within reach
//                     of where it was last seen — how far it could have got — each frame, for
//                     up to 3 s; after that the run stops and waits for a click.
async function autoTrack() {
  const o = obj(), L = LOOK[o];
  if (!S.pos[o].has(S.cur)) { status(`click the ${o} on this frame first`, true); return; }
  const bg = await background(L.channel), bgL = await background('luma');
  S.running = true;
  const R0 = S.pos[o].get(S.cur).r ?? defaultR(o);
  const width = S.img.get(S.cur).im.naturalWidth;
  let i = S.cur, n = 0, gaps = 0, overlays = 0, lastSeen = S.cur;
  while (S.running && i + 1 < S.frames.length) {
    const next = i + 1, fr = S.frames[next];
    i = next;
    if (n++ % 4 === 0) await go(i);
    if (fr.dup) { const q = S.pos[o].get(next - 1); if (q) S.pos[o].set(next, { ...q }); continue; }
    if (overlayFraction(await gray(next, 'luma'), bgL, 30) > OVERLAY) { S.pos[o].delete(next); overlays++; continue; }
    const g = await gray(next, L.channel);
    const hist = [];
    for (let k = next - 1; k >= 0 && hist.length < 2; k--) {
      if (S.frames[k].dup) continue;
      const q = S.pos[o].get(k);
      if (!q) break;
      hist.unshift({ ...q, t: S.frames[k].t });
    }
    let b = null;
    if (hist.length) {
      const at = predict(hist, fr.t), last = hist[hist.length - 1];
      const speed = hist.length === 2 ? Math.hypot(last.x - hist[0].x, last.y - hist[0].y) : 0;
      b = findBlob(g, bg, { at: { x: at.x / S.f, y: at.y / S.f }, searchR: Math.max(R0 * 2, speed * 1.5) / S.f,
        thr: L.thr(), polarity: L.polarity, expectR: R0 / S.f });
    } else {
      const lp = S.pos[o].get(lastSeen), dt = fr.t - S.frames[lastSeen].t;
      if (dt > 3) { status(`${o} gone for 3 s at #${next} — click it and press T again`, true); break; }
      b = findBlob(g, bg, { at: { x: lp.x / S.f, y: lp.y / S.f }, searchR: (3 * R0 + 1.5 * width * dt) / S.f,
        thr: L.thr(), polarity: L.polarity, expectR: R0 / S.f, reacquire: true });
    }
    if (!b) { S.pos[o].delete(next); gaps++; continue; }
    S.pos[o].set(next, { x: b.x * S.f, y: b.y * S.f, r: o === 'ball' && !b.merged ? b.r * S.f : R0 });
    lastSeen = next;
  }
  S.running = false;
  await go(i);
  if (!$('status').classList.contains('err')) status(`tracked ${o} to #${i}: ${gaps} lost, ${overlays} overlay frames skipped — check it`);
}

// ─── tags ────────────────────────────────────────────────────────────────────────────────────
function addTag(type) {
  const fr = S.frames[S.cur];
  S.tags.push({ i: fr.i, t: fr.t, type, note: $('note').value.trim() });
  renderTags(); draw();
  status(`tag ${type} at #${fr.i}`);
}

$('tagbtns').addEventListener('click', (ev) => { const t = ev.target.dataset.tag; if (t) addTag(t); });
$('tags').addEventListener('click', (ev) => {
  if (ev.target.dataset.del != null) { S.tags.splice(Number(ev.target.dataset.del), 1); renderTags(); draw(); return; }
  const li = ev.target.closest('li');
  if (li) go(S.tags[Number(li.dataset.k)].i);
});
$('calibpts').addEventListener('click', (ev) => {
  const li = ev.target.closest('li');
  if (!li) return;
  S.calibKey = li.dataset.key;
  document.querySelector('input[name=mode][value=calib]').checked = true;
  renderCalibList(); draw();
});

// ─── saving ──────────────────────────────────────────────────────────────────────────────────
const r2 = (v) => Math.round(v * 100) / 100;
async function save() {
  if (!S.calib) { status('calibrate first (walls + ground)', true); return; }
  const w = (o, i, withR) => {
    const p = S.pos[o].get(i);
    if (!p) return null;
    const q = pxToWorld(S.calib, p);
    return withR ? { x: r2(q.x), y: r2(q.y), r: p.r != null ? r2(pxLen(S.calib, p.r)) : null } : { x: r2(q.x), y: r2(q.y) };
  };
  const m = /^([CM])0*(\d+)(?:-(\d+))?/.exec(S.clip);
  const doc = {
    clip: S.meta.clip ?? (m ? m[1] + m[2] : S.clip),
    take: S.meta.take ?? (m?.[3] ? Number(m[3]) : 1),
    sourceSha256: S.meta.sourceSha256 ?? null,
    fps: S.meta.fps ?? null,
    calib: { clicks: S.clicks, scale: S.calib.scale, x0: S.calib.x0, y0: S.calib.y0, W: S.calib.W, groundY: S.calib.groundY, checks: S.calib.checks },
    frames: S.frames.map((f) => {
      const out = { i: f.i, t: f.t };
      if (f.dup) out.dup = true;
      out.ball = w('ball', f.i, true); out.p0 = w('p0', f.i, false); out.p1 = w('p1', f.i, false);
      return out;
    }),
    tags: S.tags.map((t) => ({ i: t.i, t: t.t, type: t.type, note: t.note || '' })),
  };
  const res = await fetch(`/api/tracks/${S.clip}`, { method: 'POST', body: JSON.stringify(doc) });
  const j = await res.json();
  status(j.ok ? `saved ${j.file}` : `save failed: ${j.error}`, !j.ok);
}

// ─── wiring ──────────────────────────────────────────────────────────────────────────────────
$('load').onclick = () => loadClip($('clip').value);
$('save').onclick = save;
$('auto').onclick = autoTrack;
$('bgbuild').onclick = buildBackground;
$('bg0').onchange = $('bg1').onchange = () => { S.bg = {}; };
$('slider').oninput = () => go(Number($('slider').value));
document.querySelectorAll('input[name=mode], input[name=obj]').forEach((el) => el.addEventListener('change', draw));
window.addEventListener('resize', () => { const e = S.img.get(S.cur); if (e?.im.complete) { fitCanvas(e.im); draw(); } });

function stepFrame(d, skipDup) {
  let i = S.cur + d;
  if (skipDup) while (S.frames[i]?.dup) i += Math.sign(d);
  go(i);
}

document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT' && ev.target.type !== 'radio' && ev.target.type !== 'checkbox' && ev.target.type !== 'range') return;
  const k = ev.key;
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    ev.preventDefault();
    stepFrame((k === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1), ev.altKey);
  } else if (k === '1' || k === '2' || k === '3') setObj(OBJS[Number(k) - 1]);
  else if (k === 't' || k === 'T') autoTrack();
  else if (k === 'Escape') S.running = false;
  else if (k === 'Delete' || k === 'Backspace') { S.pos[obj()].delete(S.cur); draw(); }
  else {
    const t = TAGS.find(([, key]) => key === k.toLowerCase());
    if (t && !ev.metaKey && !ev.ctrlKey) addTag(t[0]);
  }
});

init().catch((e) => status(String(e), true));
