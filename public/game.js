// Client: pick screen, input, fixed-step loop, renderer, live tuner.
// Everything that decides the game lives in /shared; this file only draws it and reads keys.

import * as C from '../shared/constants.js';
import { createMatch, step, headY, NO_FX } from '../shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from '../shared/bot.js';
import { shotFor, SHOTS } from '../shared/powershots.js';

const CARD_ART = 'https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards';
const RARITIES = ['legendary', 'epic', 'rare', 'common'];
const HEB_RARITY = { legendary: 'אגדי', epic: 'אדיר', rare: 'נדיר', common: 'רגיל' };
const CARDS_PER_RARITY = 45;

const $ = (s) => document.querySelector(s);
const cardUrl = (r, n) => `${CARD_ART}/${r}/${n}.webp`;

let ANCHORS = { cardW: 400, cardH: 545, heads: {} };
const DEFAULT_ANCHOR = { cx: 0.5, cy: 0.3, d: 0.41 };
const anchorFor = (r, n) => ANCHORS.heads[`${r}_${n}`] || DEFAULT_ANCHOR;

// ---------------------------------------------------------------------------
// Head art. A card is a full 400x545 illustration, so the "big head" is a circular
// window onto it — positioned from a face box detected offline (Vision.framework) and
// baked into head-anchors.json. Painted as a CSS background on a DOM node, never blitted
// into the canvas: canvas-drawn card art comes back blank inside WKWebView.
function paintHead(el, r, n, sizePx) {
  const a = anchorFor(r, n);
  const { cardW, cardH } = ANCHORS;
  const rendered = sizePx / a.d;                       // card width at this zoom
  el.style.backgroundImage = `url("${cardUrl(r, n)}")`;
  el.style.backgroundSize = `${rendered}px ${rendered * (cardH / cardW)}px`;
  el.style.backgroundPosition =
    `${sizePx / 2 - a.cx * rendered}px ${sizePx / 2 - a.cy * rendered * (cardH / cardW)}px`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PICK SCREEN
// ═══════════════════════════════════════════════════════════════════════════
const pick = {
  me: { rarity: 'legendary', number: 3 },
  foe: { rarity: 'legendary', number: 2 },
  target: 'me',
  rarity: 'legendary',
  level: 3,
};

function renderGrid() {
  const grid = $('#cardGrid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= CARDS_PER_RARITY; n++) {
    const el = document.createElement('button');
    el.className = 'card';
    el.style.backgroundImage = `url("${cardUrl(pick.rarity, n)}")`;
    el.innerHTML = `<b>${n}</b>`;
    const chosen = pick[pick.target];
    if (chosen.rarity === pick.rarity && chosen.number === n) el.classList.add('sel');
    el.onclick = () => {
      pick[pick.target] = { rarity: pick.rarity, number: n };
      renderGrid();
      renderSlots();
    };
    frag.appendChild(el);
  }
  grid.appendChild(frag);
}

function renderSlots() {
  for (const who of ['me', 'foe']) {
    const slot = $(who === 'me' ? '#slotMe' : '#slotFoe');
    const c = pick[who];
    paintHead(slot.querySelector('.slot-art'), c.rarity, c.number, 72);
    const shot = shotFor(c.rarity, c.number);
    slot.querySelector('.slot-shot').textContent = shot.name;
    slot.classList.toggle('active', pick.target === who);
  }
}

$('#slotMe').onclick = () => { pick.target = 'me'; renderSlots(); renderGrid(); };
$('#slotFoe').onclick = () => { pick.target = 'foe'; renderSlots(); renderGrid(); };

$('#rarityTabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  pick.rarity = b.dataset.r;
  for (const t of $('#rarityTabs').children) t.classList.toggle('on', t === b);
  renderGrid();
};

$('#diff').oninput = (e) => {
  pick.level = +e.target.value;
  $('#diffName').textContent = DIFFICULTIES[pick.level].name;
};
$('#diffName').textContent = DIFFICULTIES[pick.level].name;

$('#playBtn').onclick = () => startMatch();

// ═══════════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════════
const held = { left: false, right: false, jump: false, kick: false, power: false };
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'kick', KeyS: 'kick', KeyK: 'kick',
  KeyJ: 'power', KeyL: 'power', ShiftLeft: 'power', ShiftRight: 'power',
};
// RTL note: the pitch is NOT mirrored, so ← always means screen-left. The player
// always defends the LEFT goal, which keeps the arrow keys honest in both directions.
addEventListener('keydown', (e) => {
  const k = KEYS[e.code];
  if (!k) return;
  held[k] = true;
  e.preventDefault();
});
addEventListener('keyup', (e) => {
  const k = KEYS[e.code];
  if (!k) return;
  held[k] = false;
  e.preventDefault();
});

for (const btn of document.querySelectorAll('.pad .btn')) {
  const k = btn.dataset.k;
  const set = (v) => (ev) => { ev.preventDefault(); held[k] = v; btn.classList.toggle('on', v); };
  btn.addEventListener('pointerdown', set(true));
  btn.addEventListener('pointerup', set(false));
  btn.addEventListener('pointercancel', set(false));
  btn.addEventListener('pointerleave', set(false));
}
// The pad shows on any touch device; ?pad=1 forces it on so a desktop browser (and the
// screenshot harness) can check the phone layout without a phone.
const FORCE_PAD = /[?&]pad=1\b/.test(location.search);
if (!FORCE_PAD && !matchMedia('(pointer: coarse)').matches) document.body.classList.add('no-touch');

// ═══════════════════════════════════════════════════════════════════════════
// FX — particles the sim asks for, drawn by the renderer
// ═══════════════════════════════════════════════════════════════════════════
const parts = [];
const fx = {
  trail(x, y, color, n = 2) {
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'p', x, y, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90,
        life: .38, t: 0, r: 4 + Math.random() * 6, color });
    }
  },
  shockwave(x, y, color) { parts.push({ k: 'w', x, y, life: .5, t: 0, color }); },
  grab(x, y, color) { parts.push({ k: 'g', x, y, life: 1.4, t: 0, color }); },
  hit(x, y, color, s = 1) {
    for (let i = 0; i < 4 * s; i++) {
      const a = Math.random() * Math.PI * 2;
      parts.push({ k: 'p', x, y, vx: Math.cos(a) * 190 * s, vy: Math.sin(a) * 190 * s,
        life: .26, t: 0, r: 3 + Math.random() * 4, color });
    }
  },
  goal(x, y, color) {
    parts.push({ k: 'w', x, y, life: .8, t: 0, color });
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 460;
      parts.push({ k: 'c', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 180,
        life: 1.5, t: 0, r: 3 + Math.random() * 5,
        color: ['#ffb800', '#4ea0ff', '#ff5c7a', '#5ce15c', '#ffffff'][i % 5] });
    }
  },
};

function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    if (p.k === 'p' || p.k === 'c') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.k === 'c' ? 900 : 260) * dt;
      p.vx *= .96;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCH
// ═══════════════════════════════════════════════════════════════════════════
let M = null, BOT = null, raf = 0, acc = 0, last = 0, running = false;

function startMatch() {
  M = createMatch(pick.me, pick.foe, {});
  BOT = createBot(pick.level);
  parts.length = 0;
  acc = 0; last = performance.now(); running = true;

  $('#pick').classList.add('hidden');
  $('#match').classList.remove('hidden');
  $('#over').classList.add('hidden');

  for (let i = 0; i < 2; i++) {
    const el = $('#head' + i);
    el.className = 'head p' + i;
    el.dataset.card = '';
    const c = M.players[i].char;
    $(`.gauge.g${i} .nm`).textContent = M.players[i].shot.name;
  }
  resize();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function endMatch() {
  running = false;
  const [a, b] = M.score;
  const iWon = a > b;
  $('#overTitle').textContent = iWon ? 'ניצחת!' : 'הפסדת';
  $('#overTitle').style.color = iWon ? 'var(--hot)' : 'var(--p1)';
  $('#overScore').textContent = `${a} : ${b}`;
  $('#over').classList.remove('hidden');
}

$('#again').onclick = () => startMatch();
$('#back').onclick = $('#quit').onclick = () => {
  running = false;
  cancelAnimationFrame(raf);
  $('#match').classList.add('hidden');
  $('#pick').classList.remove('hidden');
};

// ---- banner ----------------------------------------------------------------
let bannerT = 0;
function banner(text, color) {
  const el = $('#banner');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;                       // restart the animation
  el.classList.add('show');
  bannerT = 1.1;
}

// Last 200 sim events, newest last. Cheap, and the only way to answer "what just happened?"
// after the fact — a power shot that scores is gone from the ball by the next frame.
const EVENT_LOG = [];
function drainEvents() {
  for (const e of M.events) {
    EVENT_LOG.push({ ...e, t: +M.t.toFixed(2) });
    if (EVENT_LOG.length > 200) EVENT_LOG.shift();
    if (e.type === 'goal') banner(e.power ? 'גול פאוור!' : 'גול!', e.player === 0 ? '#4ea0ff' : '#ff5c7a');
    else if (e.type === 'counter') banner('קאונטר!', '#ffffff');
    else if (e.type === 'powershot') banner(SHOTS[e.shot].name, SHOTS[e.shot].color);
    else if (e.type === 'golden') banner('מוות פתאומי', '#ffb800');
    else if (e.type === 'fulltime') endMatch();
  }
  M.events.length = 0;
}

// ---- loop ------------------------------------------------------------------
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!M) return;

  if (running) {
    acc += dt;
    let guard = 0;
    while (acc >= C.TICK && guard++ < 8) {
      const foe = botInput(BOT, M, 1, C.TICK);
      step(M, [{ ...held }, foe], C.TICK, fx);
      acc -= C.TICK;
      drainEvents();
      if (!running) break;
    }
  }
  stepParts(dt);
  if (bannerT > 0) bannerT -= dt;
  draw();
  syncHud();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════
const cv = $('#cv');
const ctx = cv.getContext('2d');
let SC = 1, crowd = [];

function resize() {
  const vw = innerWidth, vh = innerHeight;
  const ratio = C.W / C.H;
  let w = vw, h = w / ratio;
  if (h > vh) { h = vh; w = h * ratio; }
  const stage = $('#stage');
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  SC = w / C.W;
  const dpr = Math.min(2.5, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  ctx.setTransform(dpr * SC, 0, 0, dpr * SC, 0, 0);   // draw in WORLD units from here on
  if (!crowd.length) {
    for (let i = 0; i < 260; i++) {
      crowd.push({ x: Math.random() * C.W, f: Math.random(), r: 4 + Math.random() * 5,
        c: `hsl(${Math.random() * 360} 45% ${26 + Math.random() * 26}%)`, ph: Math.random() * 6.28 });
    }
  }
}
addEventListener('resize', () => { if (M) resize(); });
addEventListener('orientationchange', () => setTimeout(() => M && resize(), 120));

function draw() {
  const g = ctx;
  g.clearRect(0, 0, C.W, C.H);
  drawStadium(g);
  drawGoal(g, true);
  drawGoal(g, false);
  for (const p of M.players) drawBody(g, p);
  drawParts(g, false);
  drawBall(g, M.ball);
  drawParts(g, true);
  drawHeads();
  if (M.freeze > 0 && M.phase !== 'over') drawReady(g);
}

function drawStadium(g) {
  const t = performance.now() / 1000;
  const gy = C.GROUND_Y;
  // Bands are fractions of the ground line, so dragging GROUND_Y in the tuner doesn't
  // leave the crowd floating in space.
  const standTop = gy * 0.08, standBot = gy * 0.50, wallBot = gy * 0.88;

  const sky = g.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#070c1c');
  sky.addColorStop(1, '#12244a');
  g.fillStyle = sky;
  g.fillRect(0, 0, C.W, gy);

  // roof trusses + floodlight rigs
  g.fillStyle = '#05080f';
  g.fillRect(0, 0, C.W, standTop);
  for (let i = 0; i < 4; i++) {
    const x = C.W * (0.14 + i * 0.24);
    g.strokeStyle = '#2a3550';                       // mast, or the rig reads as a floating bar
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, standTop - 6); g.stroke();
    g.fillStyle = '#1c2436';
    g.fillRect(x - 28, standTop - 12, 56, 11);
    g.fillStyle = '#fff8dc';                          // lamps
    for (let l = 0; l < 4; l++) g.fillRect(x - 24 + l * 13, standTop - 10, 8, 7);
    const fl = g.createRadialGradient(x, standTop, 6, x, standTop + gy * 0.75, gy * 0.95);
    fl.addColorStop(0, '#ffffff2e');
    fl.addColorStop(1, '#ffffff00');
    g.fillStyle = fl;
    g.fillRect(0, 0, C.W, gy);
  }

  // stands + crowd
  g.fillStyle = '#0b1124';
  g.fillRect(0, standTop, C.W, standBot - standTop);
  for (const c of crowd) {
    const y = standTop + c.f * (standBot - standTop);
    g.globalAlpha = .5 + .5 * Math.sin(t * 2 + c.ph) * .5;
    g.fillStyle = c.c;
    g.beginPath();
    g.arc(c.x, y + Math.sin(t * 3 + c.ph) * 2, c.r, 0, 6.2832);
    g.fill();
  }
  g.globalAlpha = 1;

  // stand front / barrier
  g.fillStyle = '#070b16';
  g.fillRect(0, standBot, C.W, wallBot - standBot);
  g.strokeStyle = '#ffffff14';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, standBot + 3); g.lineTo(C.W, standBot + 3);
  g.stroke();
  // house wordmark, big and faded, so the empty middle band reads as a stadium wall
  g.save();
  g.globalAlpha = .07;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${Math.round((wallBot - standBot) * 0.8)}px -apple-system, Arial`;
  g.fillText('SALTIZ', C.W / 2, (standBot + wallBot) / 2);
  g.restore();

  // LED hoardings running the touchline
  const ledH = gy - wallBot;
  g.fillStyle = '#0a1224';
  g.fillRect(0, wallBot, C.W, ledH);
  const scroll = (t * 90) % 240;
  g.save();
  g.beginPath(); g.rect(0, wallBot, C.W, ledH); g.clip();
  for (let x = -240; x < C.W + 240; x += 240) {
    g.fillStyle = '#ffb80022';
    g.fillRect(x + scroll, wallBot + 2, 232, ledH - 4);
    g.fillStyle = '#ffb800aa';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.round(ledH * 0.55)}px -apple-system, Arial`;
    g.fillText('SALTIZ ראשים', x + scroll + 116, wallBot + ledH / 2);
  }
  g.restore();

  // grass
  const gr = g.createLinearGradient(0, gy, 0, C.H);
  gr.addColorStop(0, '#39a352');
  gr.addColorStop(1, '#15582b');
  g.fillStyle = gr;
  g.fillRect(0, gy, C.W, C.H - gy);
  g.fillStyle = '#ffffff0e';
  for (let x = 0; x < C.W; x += 96) g.fillRect(x, gy, 48, C.H - gy);
  g.fillStyle = '#ffffff66';
  g.fillRect(0, gy - 2, C.W, 3);
  g.fillRect(C.W / 2 - 1, gy, 2, C.H - gy);
  // centre arc, drawn flat because the camera is side-on
  g.strokeStyle = '#ffffff44';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(C.W / 2, gy, 74, (C.H - gy) * 0.55, 0, 0, Math.PI);
  g.stroke();
}

function drawGoal(g, left) {
  const x0 = left ? 0 : C.W - C.GOAL_W;
  const top = C.GROUND_Y - C.GOAL_H;
  g.save();
  g.fillStyle = '#00000055';
  g.fillRect(x0, top, C.GOAL_W, C.GOAL_H);
  // net
  g.strokeStyle = '#ffffff33';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = x0; x <= x0 + C.GOAL_W; x += 11) { g.moveTo(x, top); g.lineTo(x, C.GROUND_Y); }
  for (let y = top; y <= C.GROUND_Y; y += 11) { g.moveTo(x0, y); g.lineTo(x0 + C.GOAL_W, y); }
  g.stroke();
  // frame
  const px = left ? C.GOAL_W : C.W - C.GOAL_W;
  g.strokeStyle = '#f2f6ff';
  g.lineWidth = C.POST_R * 2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(px, C.GROUND_Y);
  g.lineTo(px, top);
  g.lineTo(left ? 0 : C.W, top);
  g.stroke();
  g.restore();
}

function drawBody(g, p) {
  const hy = headY(p);
  const lean = Math.max(-.3, Math.min(.3, p.vx / 900));
  const knocked = p.knocked > 0;
  const col = p.index === 0 ? '#2f6fb8' : '#b8425c';
  const dark = p.index === 0 ? '#1d4a80' : '#7e2b3e';

  g.save();
  g.translate(p.x, p.y);
  if (knocked) g.rotate(p.side * 1.15);
  else g.rotate(lean * .5);

  // shadow
  g.restore();
  g.save();
  g.globalAlpha = .3;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(p.x, C.GROUND_Y + 3, C.BODY_W * .7, 6, 0, 0, 6.2832);
  g.fill();
  g.restore();

  g.save();
  g.translate(p.x, p.y);
  if (knocked) g.rotate(p.side * 1.15);

  // legs — the kick swings the front one
  const kickP = p.kickT > 0 ? 1 - p.kickT / C.KICK_TIME : 0;
  const swing = p.kickT > 0 ? Math.sin(kickP * Math.PI) : 0;
  const stride = p.onGround ? Math.sin(performance.now() / 90) * Math.min(1, Math.abs(p.vx) / 260) * 10 : 6;
  g.strokeStyle = dark;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-6, -C.BODY_H * .45); g.lineTo(-6 - stride, 0);
  g.moveTo(6, -C.BODY_H * .45);
  g.lineTo(6 + p.facing * swing * C.KICK_REACH * .8, -swing * 22 + (1 - swing) * stride);
  g.stroke();

  // torso
  g.fillStyle = col;
  roundRect(g, -C.BODY_W / 2, -C.BODY_H, C.BODY_W, C.BODY_H * .78, 9);
  g.fill();
  // shirt number band
  g.fillStyle = '#ffffff26';
  g.fillRect(-C.BODY_W / 2, -C.BODY_H * .62, C.BODY_W, 7);

  // arms
  g.strokeStyle = col;
  g.lineWidth = 7;
  g.beginPath();
  const arm = p.onGround ? 0 : -.9;
  g.moveTo(-C.BODY_W / 2 + 2, -C.BODY_H * .82);
  g.lineTo(-C.BODY_W / 2 - 12, -C.BODY_H * .82 + 16 + arm * 22);
  g.moveTo(C.BODY_W / 2 - 2, -C.BODY_H * .82);
  g.lineTo(C.BODY_W / 2 + 12, -C.BODY_H * .82 + 16 + arm * 22);
  g.stroke();

  // neck into the DOM head
  g.strokeStyle = dark;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(0, -C.BODY_H);
  g.lineTo(0, hy - p.y + C.HEAD_R * .55);
  g.stroke();
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawBall(g, b) {
  g.save();
  g.globalAlpha = .3;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(b.x, C.GROUND_Y + 3, b.r * .9, 5, 0, 0, 6.2832);
  g.fill();
  g.restore();

  g.save();
  g.translate(b.x, b.y);
  g.rotate((b.spin || 0) * .12 + b.x * .012);
  if (b.power) {
    g.shadowColor = b.power.glow;
    g.shadowBlur = 26;
  }
  g.fillStyle = b.power ? b.power.color : '#f6f9ff';
  g.beginPath(); g.arc(0, 0, b.r, 0, 6.2832); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = b.power ? '#ffffffcc' : '#1b2436';
  g.beginPath(); g.arc(0, 0, b.r * .34, 0, 6.2832); g.fill();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.2832;
    g.beginPath();
    g.arc(Math.cos(a) * b.r * .68, Math.sin(a) * b.r * .68, b.r * .17, 0, 6.2832);
    g.fill();
  }
  g.restore();
}

function drawParts(g, front) {
  for (const p of parts) {
    const k = 1 - p.t / p.life;
    if (p.k === 'w') {
      if (front) continue;
      g.save();
      g.globalAlpha = k * .8;
      g.strokeStyle = p.color;
      g.lineWidth = 5 * k + 1;
      g.beginPath(); g.arc(p.x, p.y, (1 - k) * 150 + 8, 0, 6.2832); g.stroke();
      g.restore();
    } else if (p.k === 'g') {
      if (front) continue;
      g.save();
      g.globalAlpha = Math.min(1, k * 2);
      g.strokeStyle = p.color;
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.2832 + p.t * 2;
        g.beginPath();
        g.moveTo(p.x, C.GROUND_Y);
        g.quadraticCurveTo(p.x + Math.cos(a) * 70, p.y + 20, p.x + Math.cos(a) * 34, p.y - 40 + Math.sin(a) * 20);
        g.stroke();
      }
      g.restore();
    } else if (front === (p.k === 'c')) {
      g.save();
      g.globalAlpha = k;
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.r * (p.k === 'c' ? 1 : k), 0, 6.2832); g.fill();
      g.restore();
    }
  }
}

function drawReady(g) {
  // Only the pre-kickoff freeze dims the pitch. Blacking out the post-goal freeze too
  // hid the one moment the game is showing off — the celebration.
  if (M.phase === 'goal') return;
  g.save();
  g.fillStyle = '#000000aa';
  g.fillRect(0, 0, C.W, C.H);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 58px -apple-system, Arial';
  g.fillText(M.freeze > 0.45 ? 'מוכן?' : 'קדימה!', C.W / 2, C.H * 0.45);
  g.restore();
}

// ---- DOM heads -------------------------------------------------------------
function drawHeads() {
  const size = C.HEAD_R * 2 * SC;
  for (let i = 0; i < 2; i++) {
    const p = M.players[i];
    const el = $('#head' + i);
    const key = `${p.char.rarity}_${p.char.number}_${Math.round(size)}`;
    if (el.dataset.card !== key) {
      paintHead(el.firstElementChild, p.char.rarity, p.char.number, size);
      el.style.width = el.style.height = size + 'px';
      el.dataset.card = key;
    }
    const x = p.x * SC, y = headY(p) * SC;
    const tilt = Math.max(-.34, Math.min(.34, p.vx / 1100)) + (p.knocked > 0 ? p.side * 1.2 : 0);
    el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${tilt}rad)`;
    el.classList.toggle('armed', p.armed > 0);
    el.classList.toggle('knocked', p.knocked > 0 || p.rooted > 0);
  }
}

// ---- HUD -------------------------------------------------------------------
function syncHud() {
  $('#s0').textContent = M.score[0];
  $('#s1').textContent = M.score[1];
  const clk = $('#clock');
  clk.textContent = M.golden ? 'ג.ג' : Math.ceil(M.clock);
  clk.classList.toggle('low', !M.golden && M.clock <= 10);
  for (let i = 0; i < 2; i++) {
    const p = M.players[i];
    const gEl = $(`.gauge.g${i}`);
    gEl.querySelector('.fill').style.width = (p.gauge * 100) + '%';
    gEl.classList.toggle('full', p.gauge >= 1 || p.armed > 0);
  }
  $('#powerBtn').classList.toggle('ready', M.players[0].gauge >= 1 && M.players[0].armed <= 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TUNER — drag the feel while the match is running
// ═══════════════════════════════════════════════════════════════════════════
const RANGES = {
  PLAYER_SPEED: [120, 900], PLAYER_ACCEL: [800, 8000], PLAYER_AIR_ACCEL: [200, 3000],
  PLAYER_GRAV: [800, 5000], JUMP_V: [400, 1500], DASH_V: [300, 1800], DASH_TIME: [.05, .5],
  KICK_POWER: [200, 1600], KICK_LIFT: [0, 1400], KICK_REACH: [20, 130], KICK_R: [10, 60],
  KICK_TIME: [.05, .6], HEAD_POWER: [.4, 2.5],
  BALL_GRAV: [300, 3000], BALL_BOUNCE: [.2, 1], BALL_AIR: [.97, 1], BALL_GROUND_FRICTION: [.9, 1],
  BALL_MAX_SPEED: [500, 2600],
  GOAL_H: [90, 300], GOAL_W: [40, 160], HEAD_R: [24, 80], GROUND_Y: [360, 500],
  GAUGE_FULL: [3, 60], ARMED_TIME: [1, 15], POWER_SHOT_SPEED: [500, 3000],
  POWER_STUN: [.2, 3], COUNTER_WINDOW: [40, 320], MATCH_DURATION: [15, 180],
};
const BASE = C.snapshot();

function buildTuner() {
  const body = $('#tunerBody');
  body.innerHTML = '';
  for (const k of C.TUNABLE) {
    const [lo, hi] = RANGES[k] || [0, BASE[k] * 3 || 1];
    const stepv = (hi - lo) / 200;
    const row = document.createElement('div');
    row.className = 'tune-row';
    row.innerHTML = `<label>${k}</label><output>${fmt(BASE[k])}</output>
      <input type="range" min="${lo}" max="${hi}" step="${stepv}" value="${BASE[k]}">`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    inp.oninput = () => {
      const v = +inp.value;
      out.textContent = fmt(v);
      C.tune({ [k]: v });
      if (k === 'HEAD_R' || k === 'GROUND_Y') { for (let i = 0; i < 2; i++) $('#head' + i).dataset.card = ''; }
    };
    body.appendChild(row);
  }
}
const fmt = (v) => (Math.abs(v) < 10 ? (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : Math.round(v));

$('#gear').onclick = () => { $('#tuner').classList.toggle('hidden'); };
$('#tunerClose').onclick = () => $('#tuner').classList.add('hidden');
$('#tunerReset').onclick = () => { C.tune(BASE); buildTuner(); for (let i = 0; i < 2; i++) $('#head' + i).dataset.card = ''; };
$('#tunerCopy').onclick = async () => {
  const now = C.snapshot();
  const diff = {};
  for (const k of C.TUNABLE) if (Math.abs(now[k] - BASE[k]) > 1e-9) diff[k] = +now[k].toFixed(4);
  const text = JSON.stringify(diff, null, 2);
  try { await navigator.clipboard.writeText(text); $('#tunerCopy').textContent = 'הועתק ✓'; }
  catch { $('#tunerCopy').textContent = text; }
  setTimeout(() => ($('#tunerCopy').textContent = 'העתק JSON'), 1600);
};

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
(async function boot() {
  try {
    const res = await fetch('data/head-anchors.json');
    if (res.ok) ANCHORS = await res.json();
  } catch { /* fall back to the centre-of-card default */ }

  // ?me=legendary_3&foe=epic_7&diff=4 — so a screenshot harness can pin a matchup.
  const q = new URLSearchParams(location.search);
  for (const [key, who] of [['me', 'me'], ['foe', 'foe']]) {
    const v = q.get(key);
    if (!v) continue;
    const [r, n] = v.split('_');
    if (RARITIES.includes(r) && +n >= 1 && +n <= CARDS_PER_RARITY) pick[who] = { rarity: r, number: +n };
  }
  if (q.has('diff')) {
    pick.level = Math.max(0, Math.min(5, +q.get('diff')));
    $('#diff').value = pick.level;
    $('#diffName').textContent = DIFFICULTIES[pick.level].name;
  }

  renderSlots();
  renderGrid();
  buildTuner();
  if (q.has('play')) startMatch();
})();

// Handy from the console / screenshot harness. MATCH must be a live getter — Object.assign
// would copy the value at boot (null) and every probe would read stale.
Object.assign(window, { C, startMatch, pick, SHOTS });
Object.defineProperty(window, 'MATCH', { get: () => M });
Object.defineProperty(window, 'HELD', { get: () => held });
Object.defineProperty(window, 'EVENTS', { get: () => EVENT_LOG });
