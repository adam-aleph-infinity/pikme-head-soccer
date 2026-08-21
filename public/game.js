// Client: pick screen, input, fixed-step loop, renderer, live tuner.
// Everything that decides the game lives in /shared; this file only draws it and reads keys.

import * as C from '../shared/constants.js';
import { createMatch, step, headY, NO_FX } from '../shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from '../shared/bot.js';
import { shotFor, SHOTS } from '../shared/powershots.js';
import { activeMeteors, isRobot, robotCharging, actKind, ACT } from '../shared/spectacle.js';
import { createNet } from './net.js';
import { playEvent, SFX, setAudioEnabled, audioEnabled } from './audio.js';
import { STAGES, randomStage, stageById } from './stages.js';
import { DIRECTIONS } from './art-directions.js';

// The eleven backdrops a match can roll: the seven Street Fighter II homages plus the four
// original directions. DIRECTIONS uses the identical { id, name, grass, wall, draw(g, s) }
// contract STAGES does, which is why this is a concat and not an adapter.
const POOL = [...STAGES, ...DIRECTIONS];
const pickStage = () => POOL[Math.floor(Math.random() * POOL.length)];
const findStage = (id) => POOL.find((x) => x.id === id) || null;

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
  // The app injects these before the page boots, exactly as it does for football.
  name: (typeof window !== 'undefined' && window.SALTIZ_NAME) || new URLSearchParams(location.search).get('name') || 'שחקן',
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

// Bindings are DATA, not a frozen map, because nobody could find out how to kick. Two slots
// per action so the arrow cluster and the letter cluster can both live, and the whole thing
// is rebindable from the ⌨ screen and persisted.
const ACTIONS = [
  { id: 'left', label: 'שמאלה' },
  { id: 'right', label: 'ימינה' },
  { id: 'jump', label: 'קפיצה' },
  { id: 'kick', label: 'בעיטה' },
  { id: 'power', label: 'כוח' },
];
const DEFAULT_BINDS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['ArrowUp', 'Space'],
  kick: ['ArrowDown', 'KeyS'],
  power: ['KeyJ', 'ShiftLeft'],
};
const BIND_STORE = 'hs-binds';

function loadBinds() {
  try {
    const raw = JSON.parse(localStorage.getItem(BIND_STORE) || 'null');
    if (!raw) return structuredClone(DEFAULT_BINDS);
    // Merge over the defaults so a binding added in a later build is not missing for
    // anyone who already saved a set.
    const out = structuredClone(DEFAULT_BINDS);
    for (const a of ACTIONS) if (Array.isArray(raw[a.id])) out[a.id] = raw[a.id].slice(0, 2);
    return out;
  } catch { return structuredClone(DEFAULT_BINDS); }
}
let BINDS = loadBinds();
const saveBinds = () => { try { localStorage.setItem(BIND_STORE, JSON.stringify(BINDS)); } catch {} };

// code -> action, rebuilt whenever the bindings change. One lookup per keystroke.
let KEYMAP = {};
function rebuildKeymap() {
  KEYMAP = {};
  for (const a of ACTIONS) for (const code of BINDS[a.id]) if (code) KEYMAP[code] = a.id;
}
rebuildKeymap();

// Human-readable caps. The code is what the browser reports; this is what a person calls it.
const KEY_LABEL = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Space: 'רווח', ShiftLeft: 'Shift', ShiftRight: 'Shift ימין',
  ControlLeft: 'Ctrl', AltLeft: 'Alt', Enter: 'Enter', Tab: 'Tab',
};
const keyLabel = (code) => {
  if (!code) return '—';
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
};

// RTL note: the pitch is NOT mirrored, so ← always means screen-left. The player always
// defends the LEFT goal, which keeps the arrow keys honest in both directions.
let listening = null;            // {action, slot} while capturing a rebind

addEventListener('keydown', (e) => {
  if (listening) { captureBind(e); return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  held[k] = true;
  e.preventDefault();
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
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
// KEYS — view and rebind
// ═══════════════════════════════════════════════════════════════════════════
function renderKeys() {
  const grid = $('#keysGrid');
  grid.innerHTML = '';
  for (const a of ACTIONS) {
    const label = document.createElement('div');
    label.className = 'act';
    label.textContent = a.label;
    grid.appendChild(label);
    for (let slot = 0; slot < 2; slot++) {
      const code = BINDS[a.id][slot];
      const cap = document.createElement('button');
      cap.className = 'keycap' + (code ? '' : ' empty');
      cap.textContent = keyLabel(code);
      cap.onclick = () => startListening(a.id, slot, cap);
      grid.appendChild(cap);
    }
  }
}

function startListening(action, slot, cap) {
  document.querySelectorAll('.keycap.listening').forEach((el) => el.classList.remove('listening'));
  listening = { action, slot };
  cap.classList.add('listening');
  cap.textContent = '…';
  $('#keysHint').textContent = 'לחץ על מקש · Esc לביטול';
  $('#keysHint').classList.add('arming');
}

function captureBind(e) {
  e.preventDefault();
  const { action, slot } = listening;
  listening = null;
  $('#keysHint').classList.remove('arming');

  if (e.code === 'Escape') {
    $('#keysHint').textContent = 'בוטל';
  } else {
    // A key may only drive one action, or holding it would fire two things at once.
    for (const a of ACTIONS) {
      BINDS[a.id] = BINDS[a.id].map((c) => (c === e.code ? null : c));
    }
    BINDS[action][slot] = e.code;
    saveBinds();
    rebuildKeymap();
    $('#keysHint').textContent = `${keyLabel(e.code)} הוגדר`;
  }
  renderKeys();
  setTimeout(() => { $('#keysHint').textContent = 'לחץ על משבצת ואז על המקש הרצוי'; }, 1600);
}

// Remember where we came from: the keys screen is reachable from the picker AND from
// inside a match, and returning to the wrong one drops a dead 'pick' screen over a live game.
let keysReturn = '#pick';
function openKeys(from) {
  keysReturn = from;
  renderKeys();
  $(from).classList.add('hidden');
  $('#keys').classList.remove('hidden');
}
function closeKeys() {
  listening = null;
  $('#keys').classList.add('hidden');
  $(keysReturn).classList.remove('hidden');
  if (keysReturn === '#match' && M) resize();
}
$('#keysBtn').onclick = () => openKeys('#pick');
$('#keysInGame').onclick = () => openKeys('#match');
$('#keysBack').onclick = closeKeys;
$('#keysReset').onclick = () => {
  BINDS = structuredClone(DEFAULT_BINDS);
  saveBinds(); rebuildKeymap(); renderKeys();
  $('#keysHint').textContent = 'אופס לברירת מחדל';
};

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
  // A crater is drawn ON the grass and outlives the flash, so the pitch carries a memory
  // of where the last rock landed.
  crater(x) { parts.push({ k: 'k', x, y: C.GROUND_Y, life: 2.6, t: 0, color: '#2a1408' }); },
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
// ONLINE — private room by 4-char code. The share link IS the invite.
// ═══════════════════════════════════════════════════════════════════════════
let ONLINE = false;
let NET = null;
let PIN_STAGE = null;

const shareLink = (code) => `${location.origin}/?room=${code}`;

function net() {
  if (NET) return NET;
  NET = createNet({
    onStatus: (st) => {
      const d = $('#netdot');
      d.classList.toggle('on', st === 'online');
      d.classList.toggle('busy', st === 'connecting');
      d.title = { online: 'מחובר', connecting: 'מתחבר…', offline: 'לא מחובר' }[st] || st;
    },
    onRoom: renderLobby,
    onStart: startOnlineMatch,
    onOver: () => { /* the local sim reaches full time too; endMatch already ran */ },
    onOpponentLeft: () => banner('היריב עזב — בוט נכנס', '#ffb800'),
    onError: (code) => {
      $('#lobbyHint').textContent = {
        'not-found': 'לא נמצא חדר עם הקוד הזה',
        full: 'החדר מלא',
        'in-match': 'המשחק כבר התחיל',
        'no-codes': 'אין קודים פנויים, נסה שוב',
      }[code] || code;
    },
  });
  NET.connect();
  return NET;
}

function openLobby(mode, code) {
  const n = net();
  $('#pick').classList.add('hidden');
  $('#lobby').classList.remove('hidden');
  $('#codeBox').classList.toggle('hidden', mode !== 'host');
  $('#joinBox').classList.toggle('hidden', mode === 'host');
  $('#roomCode').textContent = '····';
  $('#seats').innerHTML = '';
  $('#lobbyHint').textContent = mode === 'host' ? 'שלח את הקישור לחבר' : 'הכנס את הקוד שקיבלת';
  $('#readyBtn').disabled = true;

  const go = () => {
    n.hello(pick.name || 'שחקן', pick.me);
    if (mode === 'host') n.create();
    else if (code) n.join(code);
  };
  // The socket may still be opening on a cold start; queue the intent rather than dropping it.
  if (n.connected) go();
  else {
    $('#lobbyHint').textContent = 'מתחבר לשרת…';
    const t = setInterval(() => { if (n.connected) { clearInterval(t); go(); } }, 200);
    setTimeout(() => clearInterval(t), 60000);
  }
}

function renderLobby(room) {
  $('#roomCode').textContent = room.code;
  const seats = $('#seats');
  seats.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const m = room.members[i];
    const el = document.createElement('div');
    el.className = 'seat' + (m ? (m.ready ? ' ready' : '') : ' empty');
    el.innerHTML = `<div class="face"></div><div class="nm">${m ? m.name : 'ממתין…'}</div>
                    <div class="st">${m ? (m.ready ? 'מוכן ✓' : 'בוחר') : ''}</div>`;
    if (m) paintHead(el.querySelector('.face'), m.card.rarity, m.card.number, 64);
    seats.appendChild(el);
  }
  const full = room.members.length === 2;
  $('#readyBtn').disabled = !full;
  $('#lobbyHint').textContent = full ? 'שניכם כאן — לחצו מוכן' : 'שלח את הקישור לחבר';
}

function startOnlineMatch(msg) {
  ONLINE = true;
  STAGE = PIN_STAGE || pickStage();
  M = NET.match;
  parts.length = 0;
  last = performance.now();
  running = true;
  $('#lobby').classList.add('hidden');
  $('#pick').classList.add('hidden');
  $('#match').classList.remove('hidden');
  $('#over').classList.add('hidden');
  for (let i = 0; i < 2; i++) {
    $('#head' + i).className = 'head p' + i;
    $('#head' + i).dataset.card = '';
    $(`.gauge.g${i} .nm`).textContent = M.players[i].shot.name;
  }
  resize();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

$('#hostBtn').onclick = () => openLobby('host');
$('#joinBtn').onclick = () => openLobby('join');
$('#joinGo').onclick = () => {
  const code = $('#codeInput').value.trim().toUpperCase();
  if (code.length === 4) net().join(code);
};
$('#codeInput').oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
$('#readyBtn').onclick = () => { net().ready(true); $('#readyBtn').disabled = true; $('#lobbyHint').textContent = 'ממתין ליריב…'; };
$('#lobbyBack').onclick = () => { net().leave(); $('#lobby').classList.add('hidden'); $('#pick').classList.remove('hidden'); };
$('#copyLink').onclick = async () => {
  const code = $('#roomCode').textContent;
  const txt = shareLink(code);
  try { await navigator.clipboard.writeText(txt); $('#copyLink').textContent = 'הועתק ✓'; }
  catch { $('#lobbyHint').textContent = txt; }
  setTimeout(() => ($('#copyLink').textContent = 'העתק קישור'), 1600);
};

// ═══════════════════════════════════════════════════════════════════════════
// MATCH
// ═══════════════════════════════════════════════════════════════════════════
let M = null, BOT = null, raf = 0, acc = 0, last = 0, running = false;

function startMatch() {
  ONLINE = false;
  STAGE = PIN_STAGE || pickStage();
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
  playEvent('whistle');
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
    // The sim's event names ARE the sound names, so a new event gets audio for free and a
    // missing one is silently ignored rather than throwing mid-frame.
    playEvent(e.type === 'strike' ? (e.head ? 'head' : 'kick') : e.type);
    if (e.type === 'goal') banner(e.power ? 'גול פאוור!' : 'גול!', e.player === 0 ? '#4ea0ff' : '#ff5c7a');
    else if (e.type === 'counter') banner('קאונטר!', '#ffffff');
    else if (e.type === 'tackle') {
      const col = e.powered ? SHOTS[e.shot].color : '#ffd166';
      fx.shockwave(e.x, e.y, col);
      if (e.powered) banner(SHOTS[e.shot].effect.note + '!', col);
      else if (e.by === (ONLINE ? NET.you : 0)) banner('פגיעה! +כוח', '#ffd166');
    }
    else if (e.type === 'blocked') {
      // A block is the defender's big moment — it deserves to read as one.
      banner('נחסם!', SHOTS[e.shot].color);
    }
    else if (e.type === 'armed') banner(SHOTS[e.shot].name, SHOTS[e.shot].color);
    else if (e.type === 'ballReset') banner('כדור חדש', '#8ea0be');
    else if (e.type === 'powershot') { banner(SHOTS[e.shot].name, SHOTS[e.shot].color); flash(SHOTS[e.shot].glow, 0.22); }
    else if (e.type === 'blocked') flash('#ffffff', 0.16);
    // ---- spectacle ----
    // Only the ACT gets a banner. A line of Hebrew per falling rock would cover the pitch
    // at exactly the moment the player needs to see the marker under it.
    else if (e.type === 'meteorStart') { banner('מטאורים!', '#ff7a18'); flash('#ff9a3c', 0.16); }
    else if (e.type === 'moonStart') { banner('כוח משיכה נמוך', '#7fd8ff'); flash('#7fd8ff', 0.14); }
    else if (e.type === 'windStart') banner(e.dir > 0 ? 'רוח ←' : 'רוח →', '#dff0ff');
    else if (e.type === 'robotCharge') banner('רובוט!', e.player === 0 ? '#6cf0ff' : '#ffd24a');
    else if (e.type === 'robotOn') flash(e.player === 0 ? '#6cf0ff' : '#ffd24a', 0.2);
    else if (e.type === 'meteorHit') { fx.crater(e.x); flash('#ffb070', 0.09); }
    else if (e.type === 'golden') banner('מוות פתאומי', '#ffb800');
    else if (e.type === 'fulltime') { playEvent(e.winner === (ONLINE ? NET.you : 0) ? 'win' : 'lose'); endMatch(); }
    else if (e.type === 'ballReset') playEvent('reset');
  }
  M.events.length = 0;
}

// A full-screen flash on a special. Two frames of white is most of what sells an impact in
// a fighting game, and it costs nothing.
let flashT = 0, flashCol = '#fff', flashLife = 0.2;
function flash(col, life) { flashT = life; flashLife = life; flashCol = col; }

// ---- loop ------------------------------------------------------------------
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!M) return;

  if (running) {
    if (ONLINE) {
      // The net module owns the tick clock online: it has to replay from whatever tick a
      // snapshot lands on, so a second accumulator here would fight it.
      const m = NET.advance(dt, held, fx);
      if (m) { M = m; drainEvents(); }
    } else {
      acc += dt;
      let guard = 0;
      while (acc >= C.TICK && guard++ < 8) {
        // ?solo=1 (or window.BOT_OFF) leaves the opponent standing still. It exists for two
      // reasons: practising a shot without being harassed, and making the screenshot
      // harness deterministic — every probe there was racing a bot that could score,
      // freeze the match and reset positions between one await and the next.
      const foe = window.BOT_OFF ? {} : botInput(BOT, M, 1, C.TICK);
        step(M, [{ ...held }, foe], C.TICK, fx);
        acc -= C.TICK;
        drainEvents();
        if (!running) break;
      }
    }
  }
  stepParts(dt);
  if (bannerT > 0) bannerT -= dt;
  if (flashT > 0) flashT -= dt;
  draw();
  syncHud();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════
const cv = $('#cv');
const ctx = cv.getContext('2d');
let SC = 1, crowd = [];

// Street Fighter II is PIXEL art, and the cheapest honest way to get there is to render at
// half resolution and upscale with smoothing off. One texel becomes a fat on-screen pixel,
// every gradient becomes a hard edge, and canvas text picks up the chunky arcade look for
// free. Drawing "pixel-style" at full res never convinces — the edges stay clean.
const PIXEL = 2;

function resize() {
  const vw = innerWidth, vh = innerHeight;
  const ratio = C.W / C.H;
  let w = vw, h = w / ratio;
  if (h > vh) { h = vh; w = h * ratio; }
  const stage = $('#stage');
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  SC = w / C.W;
  sizePad(w, h, vw, vh);
  cv.width = Math.ceil(C.W / PIXEL);
  cv.height = Math.ceil(C.H / PIXEL);
  ctx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);   // draw in WORLD units, land on texels
  ctx.imageSmoothingEnabled = false;
  if (!crowd.length) {
    for (let i = 0; i < 520; i++) {
      crowd.push({ x: Math.random() * C.W, f: Math.random(), r: 4 + Math.random() * 5,
        c: `hsl(${Math.random() * 360} 45% ${26 + Math.random() * 26}%)`, ph: Math.random() * 6.28 });
    }
  }
}
// The touch pad is sized off the STAGE, not the viewport, and in one place. A thumb is a
// thumb on every device, so the button has to be a fraction of the play area rather than a
// fixed 62px that is a tap-target on a tablet and half the pitch on a portrait phone.
// The clamp keeps it inside 46..96 CSS px: below 46 it is under the 44pt touch minimum,
// above 96 it starts covering the goal.
const padEl = document.querySelector('.pad');
const safeInset = (side) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--sa-' + side);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
function sizePad(w, h, vw, vh) {
  if (!padEl) return;
  const u = Math.max(46, Math.min(96, Math.min(h * 0.20, w * 0.115)));
  // The stage is centred, so the letterbox bar already eats this much of the inset.
  const barX = (vw - w) / 2, barY = (vh - h) / 2;
  const px = (n) => Math.max(0, Math.round(n)) + 'px';
  padEl.style.setProperty('--u', u.toFixed(1) + 'px');
  padEl.style.setProperty('--pl', px(safeInset('l') - barX));
  padEl.style.setProperty('--pr', px(safeInset('r') - barX));
  padEl.style.setProperty('--pb', px(safeInset('b') - barY));
}

addEventListener('resize', () => { if (M) resize(); });
addEventListener('orientationchange', () => setTimeout(() => M && resize(), 120));

function draw() {
  const g = ctx;
  g.clearRect(0, 0, C.W, C.H);
  // A frozen frame on its own just looks like a dropped frame. A couple of pixels of shake
  // during hit-stop is what turns it into an impact.
  const shake = M.hitStop > 0 ? M.hitStop * 60 : 0;
  if (shake > 0) {
    g.save();
    g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  }
  drawStadium(g);
  drawGoal(g, true);
  drawGoal(g, false);
  drawWind(g);                       // in the air, behind the players
  drawMeteorMarks(g);                // on the grass, under the players
  for (const p of M.players) drawAura(g, p);
  for (const p of M.players) drawBody(g, p);
  drawParts(g, false);
  drawBall(g, M.ball);
  drawParts(g, true);
  drawMeteorRocks(g);                // falling in front of everything
  drawMoon(g);                       // a wash over the whole pitch
  if (shake > 0) g.restore();
  if (flashT > 0) {
    g.save();
    g.globalAlpha = (flashT / flashLife) * 0.75;
    g.fillStyle = flashCol;
    g.fillRect(0, 0, C.W, C.H);
    g.restore();
  }
  drawHeads();
  if (M.freeze > 0 && M.phase !== 'over') drawReady(g);
}

// SF2 stages are warm, saturated and built from hard bands — no gradients anywhere, and a
// dense pixel crowd behind a railing. The night-blue stadium this replaced was atmospheric
// but soft, which is the opposite of the look.
// A stage per match, drawn by public/stages.js. Everything from the hoardings down —
// boards, wall, grass, goals, players — stays here, because that furniture is the same
// wherever you are playing; only sky, horizon and crowd change.
let STAGE = pickStage();

function drawStadium(g) {
  const t = performance.now() / 1000;
  const gy = C.GROUND_Y;
  // Bands measured off a real kickoff screenshot: stands 25-68% of screen height,
  // hoardings 69-78%, grass below.
  const standTop = gy * 0.30, standBot = gy * 0.81;
  const ledTop = gy * 0.82, ledBot = gy * 0.93;

  // The stage owns everything down to the wall, with its crowd band at the BOTTOM of its
  // own art. Handing it only the strip above standTop squeezed each backdrop into ~25% of
  // the frame and left a big flat crowd block underneath — the opposite of SF2, where the
  // backdrop IS most of what you see.
  STAGE.draw(g, {
    W: C.W, t, crowd,
    horizon: gy * 0.60,
    crowdTop: gy * 0.61,
    crowdBot: standBot - 8,
    gy,
  });

  // railing across the front of the crowd, common to every stage
  R2(g, 0, standBot - 6, C.W, 6, OUTLINE);
  R2(g, 0, standBot - 5, C.W, 2, '#c9c9d2');

  // perimeter wall down to the grass, tinted to the stage
  R2(g, 0, standBot, C.W, gy - standBot, STAGE.wall);
  g.globalAlpha = .25;
  for (let x = 0; x < C.W; x += 34) R2(g, x, standBot, 2, gy - standBot, '#ffffff');
  g.globalAlpha = 1;

  // hoardings
  const ledH = ledBot - ledTop;
  R2(g, C.GOAL_W, ledTop - 2, C.W - C.GOAL_W * 2, ledH + 4, OUTLINE);
  const scroll = Math.round((t * 60) % 240);
  g.save();
  g.beginPath(); g.rect(C.GOAL_W, ledTop, C.W - C.GOAL_W * 2, ledH); g.clip();
  for (let x = -240; x < C.W + 240; x += 240) {
    R2(g, x + scroll, ledTop, 118, ledH, '#1b3f8a');
    R2(g, x + scroll + 120, ledTop, 118, ledH, '#c81e37');
    g.fillStyle = '#ffd23c';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${Math.round(ledH * 0.62)}px -apple-system, Arial`;
    g.fillText('SALTIZ', x + scroll + 59, ledTop + ledH / 2);
    g.fillText('ראשים', x + scroll + 179, ledTop + ledH / 2);
  }
  g.restore();

  // pitch — flat mown stripes in the stage's own greens
  R2(g, 0, gy, C.W, C.H - gy, STAGE.grass[0]);
  for (let x = 0; x < C.W; x += 80) R2(g, x, gy, 40, C.H - gy, STAGE.grass[1]);
  R2(g, 0, gy - 3, C.W, 3, OUTLINE);
  R2(g, 0, gy, C.W, 2, '#eaffea');
  R2(g, C.W / 2 - 1, gy, 2, C.H - gy, '#eaffea');
  g.strokeStyle = '#eaffeaaa';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(C.W / 2, gy, 68, (C.H - gy) * 0.5, 0, 0, Math.PI);
  g.stroke();
}

const R2 = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// A stone guardian, the way Sagat's temple stage frames its pitch. Blocky, three flat
// stone tones, black keyline — same rules as the fighters, so it sits in the same world.
function drawGuardian(g, cx, top, bot) {
  const h = bot - top;
  const w = 62;
  const x = Math.round(cx - w / 2);
  const stone = '#8a7a66', dark = '#5d5044', lite = '#b3a48c';

  g.fillStyle = OUTLINE;
  g.fillRect(x - 3, Math.round(top + h * 0.06) - 3, w + 6, Math.round(h * 0.94) + 3);

  // plinth, torso, shoulders
  g.fillStyle = dark;
  g.fillRect(x, Math.round(bot - h * 0.18), w, Math.round(h * 0.18));
  g.fillStyle = stone;
  g.fillRect(x + 6, Math.round(top + h * 0.34), w - 12, Math.round(h * 0.48));
  g.fillRect(x, Math.round(top + h * 0.30), w, Math.round(h * 0.10));
  g.fillStyle = lite;
  g.fillRect(x + 6, Math.round(top + h * 0.34), 4, Math.round(h * 0.48));

  // head with a hard shadow and two lit eyes
  const hw = Math.round(w * 0.52), hx = Math.round(cx - hw / 2), hh = Math.round(h * 0.24);
  g.fillStyle = OUTLINE;
  g.fillRect(hx - 2, Math.round(top + h * 0.06) - 2, hw + 4, hh + 4);
  g.fillStyle = stone;
  g.fillRect(hx, Math.round(top + h * 0.06), hw, hh);
  g.fillStyle = dark;
  g.fillRect(Math.round(cx + hw * 0.12), Math.round(top + h * 0.06), Math.round(hw * 0.38), hh);
  g.fillStyle = '#ffd23c';
  g.fillRect(hx + 5, Math.round(top + h * 0.13), 6, 4);
  g.fillRect(hx + hw - 11, Math.round(top + h * 0.13), 6, 4);
  // crossed arms
  g.fillStyle = dark;
  g.fillRect(x + 4, Math.round(top + h * 0.46), w - 8, 7);
}

function drawGoal(g, left) {
  // Head Soccer's goals read as a chunky white FRAME with a diamond net behind it, standing
  // on the ground line — not the thin outline this had. The crossbar is drawn as an actual
  // bar because it now IS one in the sim: the ball bounces off it.
  const x0 = left ? 0 : C.W - C.GOAL_W;
  const x1 = x0 + C.GOAL_W;
  const top = C.GROUND_Y - C.GOAL_H;
  const postX = left ? x1 : x0;               // the front post, facing the pitch
  const bar = C.POST_R * 2;

  g.save();
  // net cavity — opaque, so the stadium behind does not read through the mesh
  g.fillStyle = '#05080f';
  g.fillRect(x0, top, C.GOAL_W, C.GOAL_H);

  // diamond mesh — clipped to the cavity so it never bleeds onto the pitch
  g.beginPath(); g.rect(x0, top, C.GOAL_W, C.GOAL_H); g.clip();
  g.strokeStyle = '#ffffff2e';
  g.lineWidth = 1.2;
  const step = 15;
  g.beginPath();
  for (let d = -C.GOAL_H; d < C.GOAL_W + C.GOAL_H; d += step) {
    g.moveTo(x0 + d, top); g.lineTo(x0 + d + C.GOAL_H, C.GROUND_Y);
    g.moveTo(x0 + d, top); g.lineTo(x0 + d - C.GOAL_H, C.GROUND_Y);
  }
  g.stroke();
  g.restore();

  g.save();
  // frame: crossbar across the whole roof, then the front post down to the grass
  g.fillStyle = '#f4f8ff';
  g.fillRect(x0, top - bar / 2, C.GOAL_W, bar);
  g.fillRect(postX - bar / 2, top - bar / 2, bar, C.GOAL_H + bar / 2);
  // a soft shadow under the bar so the frame sits in front of the net
  g.fillStyle = '#00000038';
  g.fillRect(x0, top + bar / 2, C.GOAL_W, 4);
  // rounded cap where bar meets post
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(postX, top, bar * 0.62, 0, 6.2832); g.fill();
  // goal line on the grass
  g.fillStyle = '#ffffff88';
  g.fillRect(Math.min(postX, x0), C.GROUND_Y - 2, C.GOAL_W, 3);
  g.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECTACLE — meteors, moon phase, wind, robots
// ═══════════════════════════════════════════════════════════════════════════
// Everything here reads m.spec through shared/spectacle.js rather than off the event
// stream, so it survives a rollback: a snapshot that rewinds the sim rewinds the meteors
// with it, and the renderer simply draws whatever the current state says.
//
// The marker is the single most important thing this file draws. The whole fairness claim
// rests on a player SEEING it, so it gets a beam from the sky, a closing ring, a chevron
// pair and a flashing core — four separate cues for one event, which is three more than a
// subtle designer would use and exactly right for an arcade game on a phone.
function drawMeteorMarks(g) {
  const met = activeMeteors(M);
  if (!met.length) return;
  const t = performance.now() / 1000;
  g.save();
  for (const r of met) {
    const f = r.f;                                   // 0 at the warning, 1 at impact
    const urgent = 0.35 + 0.65 * f;
    const flash = 0.55 + 0.45 * Math.sin(t * (8 + 22 * f));

    // The column of light it is coming down. Narrow, and only over the lower half of the
    // frame: a full-height wide one hazed out the whole stage and read as weather.
    const top = C.GROUND_Y * 0.55;
    const grad = g.createLinearGradient(0, top, 0, C.GROUND_Y);
    grad.addColorStop(0, 'rgba(255,120,40,0)');
    grad.addColorStop(1, `rgba(255,150,60,${0.16 + 0.30 * f})`);
    g.fillStyle = grad;
    g.fillRect(Math.round(r.x - C.METEOR_R * 0.34), top, Math.round(C.METEOR_R * 0.68), C.GROUND_Y - top);

    // The danger zone, drawn ON THE GRASS. Centred on the ground LINE it sat half on the
    // perimeter wall, which made a rock look like it was going to land in the crowd.
    const my = C.GROUND_Y + 16, ry = C.METEOR_R * 0.24;
    g.globalAlpha = 0.22 + 0.34 * f;
    g.fillStyle = '#ff5a1e';
    g.beginPath(); g.ellipse(r.x, my, C.METEOR_R, ry, 0, 0, 6.2832); g.fill();

    g.globalAlpha = 1;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 5;
    g.beginPath(); g.ellipse(r.x, my, C.METEOR_R, ry, 0, 0, 6.2832); g.stroke();
    g.strokeStyle = '#ffd166';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(r.x, my, C.METEOR_R, ry, 0, 0, 6.2832); g.stroke();

    // the ring closing onto the spot — the countdown you can read at a glance
    g.strokeStyle = `rgba(255,255,255,${flash})`;
    g.lineWidth = 4;
    const rr = Math.max(4, C.METEOR_R * (1 - f));
    g.beginPath(); g.ellipse(r.x, my, rr, Math.max(2, rr * 0.24), 0, 0, 6.2832); g.stroke();

    // Chevrons over the marker, keylined so they survive a busy stage behind them.
    for (let i = 0; i < 3; i++) {
      const y = C.GROUND_Y - 16 - i * 15 - (1 - f) * 10;
      const w = 20 - i * 5;
      const tri = (pad) => {
        g.beginPath();
        g.moveTo(r.x - w - pad, y - pad); g.lineTo(r.x, y + 10 + pad); g.lineTo(r.x + w + pad, y - pad);
        g.lineTo(r.x + w + pad, y - 7 - pad); g.lineTo(r.x, y + 3); g.lineTo(r.x - w - pad, y - 7 - pad);
        g.closePath(); g.fill();
      };
      g.globalAlpha = urgent;
      g.fillStyle = OUTLINE; tri(2);
      g.fillStyle = flash > 0.6 ? '#fff2b0' : '#ff5a1e'; tri(0);
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

// The rock itself: a blocky three-tone stone inside a black keyline, with a fire tail and a
// white-hot leading edge — the same construction as the power-shot fireball, so it belongs
// to the same world.
function drawMeteorRocks(g) {
  const met = activeMeteors(M);
  if (!met.length) return;
  for (const r of met) {
    if (r.y < C.CEIL_Y - 40) continue;
    const sz = 13 + r.f * 9;
    g.save();
    g.translate(Math.round(r.x), Math.round(r.y));

    // tail — a tapering flame stretching back up the flight path
    g.globalAlpha = .85;
    for (let i = 1; i < 9; i++) {
      const k = i / 9;
      const w = sz * (1 - k) * 1.5;
      if (w < 1) continue;
      g.fillStyle = i < 3 ? '#fff3b0' : i < 6 ? '#ff9a3c' : '#e0451e';
      g.fillRect(Math.round(-w / 2 + (Math.random() - .5) * 3), Math.round(-sz - i * 13),
                 Math.round(w), 13);
    }
    g.globalAlpha = 1;

    // stone
    g.fillStyle = OUTLINE;
    g.fillRect(-sz - 2, -sz - 2, sz * 2 + 4, sz * 2 + 4);
    g.fillStyle = '#6b5a4c';
    g.fillRect(-sz, -sz, sz * 2, sz * 2);
    g.fillStyle = '#8d7a68';
    g.fillRect(-sz, -sz, sz, sz);
    g.fillStyle = '#42362c';
    g.fillRect(0, 0, sz, sz);
    // leading edge, burning
    g.fillStyle = '#ffd166';
    g.fillRect(-sz, sz - 4, sz * 2, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(-sz + 4, sz - 2, sz * 2 - 8, 2);
    g.restore();
  }
}

// Moon phase: a cold wash over the pitch with dust drifting UP through it. The tint is what
// tells you the rules changed; the motes are what make it read as low gravity rather than
// as a colour filter.
function drawMoon(g) {
  if (actKind(M) !== ACT.MOON) return;
  const t = performance.now() / 1000;
  g.save();
  g.globalAlpha = .21;
  g.fillStyle = '#7fd8ff';
  g.fillRect(0, 0, C.W, C.H);

  // Dust rising, swaying as it goes. Bigger and slower than the first pass, which read as
  // sensor noise rather than as "things are falling more slowly here".
  g.globalAlpha = .62;
  for (let i = 0; i < 64; i++) {
    const sway = Math.sin(t * 0.7 + i) * 9;
    const x = ((i * 137.5) % C.W) + sway;
    const y = (C.H - ((t * 22 + i * 31) % (C.H + 80))) + 40;
    const s = 3 + (i % 4);
    g.fillStyle = i % 4 ? '#cdefff' : '#ffffff';
    g.fillRect(Math.round(x), Math.round(y), s, s);
  }

  // A halo on the BALL. The one object whose physics visibly changed should be the one
  // wearing the effect — the tint alone was a colour filter you stopped noticing.
  const b = M.ball;
  if (!b.power) {
    g.globalAlpha = .35 + .2 * Math.sin(t * 3);
    g.strokeStyle = '#cdefff';
    g.lineWidth = 2;
    g.beginPath(); g.arc(b.x, b.y, b.r + 7, 0, 6.2832); g.stroke();
    g.globalAlpha = .2;
    g.beginPath(); g.arc(b.x, b.y, b.r + 13, 0, 6.2832); g.stroke();
  }
  g.restore();
}

// Wind: streaks tearing across the pitch the way it is blowing. Drawn behind the players so
// it never hides the thing you are trying to hit.
function drawWind(g) {
  const k = actKind(M);
  if (k !== ACT.WIND) return;
  const dir = M.spec.dir;
  const t = performance.now() / 1000;
  g.save();
  g.globalAlpha = .5;
  for (let i = 0; i < 26; i++) {
    const speed = 260 + (i % 5) * 130;
    const len = 26 + (i % 7) * 12;
    const y = C.CEIL_Y + ((i * 73) % (C.GROUND_Y - C.CEIL_Y - 10));
    let x = ((t * speed + i * 211) % (C.W + 200)) - 100;
    if (dir < 0) x = C.W - x;
    g.fillStyle = i % 3 ? '#dff0ff' : '#ffffff';
    g.fillRect(Math.round(x), Math.round(y), Math.round(len), 2);
  }
  // an arrow banner on the grass, so the direction is never a guess
  g.globalAlpha = .8;
  g.fillStyle = '#dff0ff';
  for (let i = 0; i < 5; i++) {
    const x = C.W / 2 + (i - 2) * 34 + ((t * 90) % 34) * dir;
    g.beginPath();
    g.moveTo(x, C.GROUND_Y + 12);
    g.lineTo(x + 16 * dir, C.GROUND_Y + 20);
    g.lineTo(x, C.GROUND_Y + 28);
    g.closePath(); g.fill();
  }
  g.restore();
}

// SF2 palettes: hard 3-tone ramps, no gradients, everything sitting inside a black
// outline. Player 1 is a blue gi, player 2 a red one, both with the yellow belt.
const GI = [
  { base: '#3c6fd6', shade: '#22407f', light: '#6fa0ff', skin: '#f0b48a', skinShade: '#b87d55' },
  { base: '#d63c3c', shade: '#7f2222', light: '#ff7a6f', skin: '#f0b48a', skinShade: '#b87d55' },
];
const OUTLINE = '#0b0710';

// Every sprite piece goes through here: a black keyline first, then the fill inside it.
// The outline is what makes a blocky shape read as a fighting-game sprite rather than a box.
function px(g, x, y, w, h, fill) {
  g.fillStyle = OUTLINE;
  g.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2);
  g.fillStyle = fill;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// A robot is a REBUILD of the silhouette, not a recolour. Same proportions — it has to
// occupy the same space or the game stops being readable — but square shoulders, a lit
// reactor in the chest, piston legs and an antenna that pokes out above the head window.
// The player's own colour survives as the accent, because "which one am I" outranks
// "look, a robot".
function drawRobotBody(g, p) {
  const pal = GI[p.index];
  const bw = C.BODY_W, bh = C.BODY_H;
  const t = performance.now() / 1000;
  const steel = '#8f9bb3', dark = '#3d4658', lite = '#dfe7f5';
  const glow = p.index === 0 ? '#6cf0ff' : '#ffd24a';

  g.save();
  g.globalAlpha = .35;
  g.fillStyle = '#000';
  g.fillRect(Math.round(p.x - bw * 0.7), C.GROUND_Y, Math.round(bw * 1.4), 3);
  g.restore();

  g.save();
  g.translate(Math.round(p.x), Math.round(p.y));
  if (p.knocked > 0) g.rotate(p.side * 1.15);

  // piston legs — two segments with a bright joint, so the walk reads as machinery
  const kickP = p.kickT > 0 ? 1 - p.kickT / C.KICK_TIME : 0;
  const swing = p.kickT > 0 ? Math.sin(kickP * Math.PI) : 0;
  const stride = p.onGround ? Math.sin(performance.now() / 80) * Math.min(1, Math.abs(p.vx) / 260) * 6 : 3;
  const legW = Math.max(5, Math.round(bw * 0.30));
  const legH = Math.round(bh * 0.42);
  const kickX = p.facing * swing * C.KICK_REACH * 0.7;
  px(g, -bw * 0.34 - stride, -legH, legW, legH, dark);
  px(g, -bw * 0.34 - stride, -legH * 0.45, legW, 3, glow);
  px(g, bw * 0.04 + kickX + stride, -legH - swing * 8, legW, legH, steel);
  px(g, bw * 0.04 + kickX + stride, -legH * 0.45 - swing * 8, legW, 3, glow);
  px(g, -bw * 0.40 - stride, -3, legW + 5, 3, lite);
  px(g, bw * 0.00 + kickX + stride, -3 - swing * 8, legW + 5, 3, lite);

  // chassis: square pauldrons over a plated torso
  const tH = Math.round(bh * 0.66);
  px(g, -bw / 2 - 3, -bh - 3, bw + 6, 6, steel);          // shoulder bar
  px(g, -bw / 2, -bh, bw, tH, steel);
  g.fillStyle = dark;
  g.fillRect(Math.round(bw / 2 - bw * 0.30), Math.round(-bh), Math.round(bw * 0.30), tH);
  g.fillStyle = lite;
  g.fillRect(Math.round(-bw / 2), Math.round(-bh), 2, tH);
  // reactor core, pulsing
  const pulse = 0.55 + 0.45 * Math.sin(t * 9);
  g.globalAlpha = pulse;
  g.fillStyle = glow;
  g.fillRect(Math.round(-4), Math.round(-bh + tH * 0.32), 8, 8);
  g.globalAlpha = 1;
  g.fillStyle = '#ffffff';
  g.fillRect(Math.round(-2), Math.round(-bh + tH * 0.32 + 2), 4, 4);
  // hazard stripe where the belt was
  g.fillStyle = pal.base;
  g.fillRect(Math.round(-bw / 2), Math.round(-bh + tH - 4), bw, 4);

  // hydraulic arms
  const armW = Math.max(4, Math.round(bw * 0.24));
  const armH = Math.round(bh * 0.36);
  const guard = p.onGround ? 0 : -armH * 0.7;
  px(g, -bw / 2 - armW - 2, -bh + 2 + guard, armW, armH, dark);
  px(g, bw / 2 + 2, -bh + 2 + guard - swing * 5, armW, armH, dark);

  g.restore();

  // antenna — drawn ABOVE the head window, which is a DOM circle, so it has to start high
  // enough to clear the element or it is simply hidden behind the card art.
  const hy = headY(p);
  const top = hy - C.HEAD_R - 4;
  g.save();
  g.fillStyle = OUTLINE;
  g.fillRect(Math.round(p.x - 3), Math.round(top - 26), 6, 28);
  g.fillStyle = steel;
  g.fillRect(Math.round(p.x - 1), Math.round(top - 25), 3, 27);
  g.globalAlpha = pulse * .45;
  g.fillStyle = glow;
  g.beginPath(); g.arc(p.x, top - 28, 11, 0, 6.2832); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = OUTLINE;
  g.beginPath(); g.arc(p.x, top - 28, 6, 0, 6.2832); g.fill();
  g.fillStyle = glow;
  g.beginPath(); g.arc(p.x, top - 28, 4.5, 0, 6.2832); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(p.x, top - 28, 2, 0, 6.2832); g.fill();
  g.restore();
}

function drawBody(g, p) {
  if (isRobot(M, p.index)) { drawRobotBody(g, p); return; }
  const pal = GI[p.index];
  const knocked = p.knocked > 0;
  const bw = C.BODY_W, bh = C.BODY_H;

  // contact shadow
  g.save();
  g.globalAlpha = .35;
  g.fillStyle = '#000';
  g.fillRect(Math.round(p.x - bw * 0.6), C.GROUND_Y, Math.round(bw * 1.2), 3);
  g.restore();

  g.save();
  g.translate(Math.round(p.x), Math.round(p.y));
  if (knocked) g.rotate(p.side * 1.15);

  // legs. The kick swings the front one out; otherwise they stride with the run.
  const kickP = p.kickT > 0 ? 1 - p.kickT / C.KICK_TIME : 0;
  const swing = p.kickT > 0 ? Math.sin(kickP * Math.PI) : 0;
  const stride = p.onGround ? Math.sin(performance.now() / 90) * Math.min(1, Math.abs(p.vx) / 260) * 5 : 3;
  const legW = Math.max(4, Math.round(bw * 0.26));
  const legH = Math.round(bh * 0.42);
  px(g, -bw * 0.32 - stride, -legH, legW, legH, pal.shade);
  const kickX = p.facing * swing * C.KICK_REACH * 0.7;
  px(g, bw * 0.06 + kickX + stride, -legH - swing * 8, legW, legH, pal.base);
  // boots
  px(g, -bw * 0.36 - stride, -3, legW + 3, 3, '#f2f2f2');
  px(g, bw * 0.02 + kickX + stride, -3 - swing * 8, legW + 3, 3, '#f2f2f2');

  // torso — gi body, hard shadow down one side, belt across the waist
  const tH = Math.round(bh * 0.62);
  px(g, -bw / 2, -bh, bw, tH, pal.base);
  g.fillStyle = pal.shade;
  g.fillRect(Math.round(bw / 2 - bw * 0.28), Math.round(-bh), Math.round(bw * 0.28), tH);
  g.fillStyle = pal.light;
  g.fillRect(Math.round(-bw / 2), Math.round(-bh), 2, tH);
  g.fillStyle = '#f5d23c';                                  // belt
  g.fillRect(Math.round(-bw / 2), Math.round(-bh + tH - 3), bw, 3);

  // arms: guard up when airborne, one cocked back on a kick
  const armW = Math.max(3, Math.round(bw * 0.2));
  const armH = Math.round(bh * 0.34);
  const guard = p.onGround ? 0 : -armH * 0.7;
  px(g, -bw / 2 - armW, -bh + 2 + guard, armW, armH, pal.skin);
  px(g, bw / 2, -bh + 2 + guard - swing * 5, armW, armH, pal.skin);

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

// Charging aura. SF2 tells you a special is coming before it lands — the character flashes
// and the air around them moves. Without that tell, POWER MODE is invisible to the opponent
// and there is nothing to react to.
function drawAura(g, p) {
  if (p.armed <= 0) return;
  const t = performance.now() / 1000;
  const col = p.shot.color;
  const hy = headY(p);
  g.save();
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.6 + i / 3) % 1;
    g.globalAlpha = (1 - ph) * 0.55;
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(p.x, (hy + p.y) / 2, C.HEAD_R * (0.6 + ph * 1.5), C.BODY_H * 1.6 * (0.6 + ph * 1.2), 0, 0, 6.2832);
    g.stroke();
  }
  // sparks rising off the shoulders
  g.globalAlpha = 1;
  for (let i = 0; i < 6; i++) {
    const ph = (t * 2.4 + i / 6) % 1;
    const sx = p.x + Math.sin(i * 2.1 + t * 3) * C.HEAD_R * 0.9;
    const sy = p.y - ph * (C.BODY_H + C.HEAD_R * 2.2);
    g.fillStyle = i % 2 ? col : '#ffffff';
    g.fillRect(Math.round(sx), Math.round(sy), 3, 5);
  }
  g.restore();
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
  if (b.power) {
    // A fireball, not a coloured football: white-hot core, a saturated shell, and a spinning
    // ring — the three layers every SF2 projectile is built from.
    const t = performance.now() / 1000;
    const sp = b.r * 2.6;
    g.globalAlpha = .35;
    g.fillStyle = b.power.glow;
    g.beginPath(); g.ellipse(0, 0, sp * 1.5, sp * 0.75, 0, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = b.power.color;
    g.beginPath(); g.ellipse(0, 0, sp, sp * 0.8, 0, 0, 6.2832); g.fill();
    g.fillStyle = b.power.glow;
    g.beginPath(); g.ellipse(0, 0, sp * 0.62, sp * 0.5, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, 0, sp * 0.3, sp * 0.26, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#ffffffcc';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, 0, sp * 1.05, sp * 0.34, t * 9, 0, 6.2832); g.stroke();
    g.shadowBlur = 0;
    g.restore();
    return;
  }
  g.fillStyle = '#f6f9ff';
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
    } else if (p.k === 'k') {
      // scorch on the grass — flattened, so it sits ON the pitch rather than floating
      if (front) continue;
      g.save();
      g.globalAlpha = k * .75;
      g.fillStyle = p.color;
      g.beginPath(); g.ellipse(p.x, C.GROUND_Y + 3, 34 * (1.1 - k * .2), 8, 0, 0, 6.2832); g.fill();
      g.globalAlpha = k * .5;
      g.fillStyle = '#ff8a3c';
      g.beginPath(); g.ellipse(p.x, C.GROUND_Y + 3, 16 * k, 4 * k, 0, 0, 6.2832); g.fill();
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
  // Only the pre-kickoff freeze dims the pitch. Blacking out the post-goal freeze too hid
  // the one moment the game is showing off — the celebration.
  if (M.phase === 'goal') return;
  g.save();
  g.fillStyle = '#000000b0';
  g.fillRect(0, 0, C.W, C.H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const txt = M.freeze > 0.45 ? 'מוכן?' : 'קדימה!';
  g.font = '900 46px -apple-system, Arial';
  g.lineJoin = 'round';
  g.lineWidth = 8;
  g.strokeStyle = OUTLINE;
  g.strokeText(txt, C.W / 2, C.H * 0.30);
  g.fillStyle = '#ffd23c';
  g.fillText(txt, C.W / 2, C.H * 0.30);

  // The controls, on the glass, every kickoff. "How do I kick?" should never need a README
  // — and on desktop there is no touch pad to read the answer off.
  if (!document.body.classList.contains('no-touch')) { g.restore(); return; }
  const rows = [
    ['זוז', BINDS.left.filter(Boolean).map(keyLabel).join(' / ') + '  ' + BINDS.right.filter(Boolean).map(keyLabel).join(' / ')],
    ['בעיטה', BINDS.kick.filter(Boolean).map(keyLabel).join(' / ')],
    ['קפיצה', BINDS.jump.filter(Boolean).map(keyLabel).join(' / ')],
    ['כוח', BINDS.power.filter(Boolean).map(keyLabel).join(' / ')],
    ['ריצה', 'לחיצה כפולה'],
    ['הרמה', 'קפיצה + בעיטה'],
  ];
  const y0 = C.H * 0.5;
  const lh = 26;
  g.font = '700 17px -apple-system, Arial';
  for (let i = 0; i < rows.length; i++) {
    const y = y0 + i * lh;
    g.textAlign = 'right';
    g.fillStyle = '#8ea0be';
    g.fillText(rows[i][0], C.W / 2 + 130, y);
    g.textAlign = 'left';
    g.fillStyle = '#ffd166';
    g.fillText(rows[i][1], C.W / 2 - 120, y);
  }
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
    // The head is a DOM node over the canvas, so the robot treatment has to be CSS: the
    // card face goes chrome, and the outline switches to the machine's own colour. Cleared
    // explicitly on the way out, or the class-based .slowed/.hexed filters stay overridden.
    const robot = isRobot(M, i), charging = robotCharging(M, i);
    // A visor across the card face. The body is a 19px sliver under a 60px head in this
    // game, so armour plating alone cannot say "robot" — the change has to happen on the
    // biggest thing on screen. It is a DOM child of the head, clipped by the same
    // border-radius, because the head is DOM and the canvas can never draw over it.
    let visor = el.lastElementChild;
    if (!visor || visor.tagName !== 'B') {
      visor = document.createElement('b');
      el.appendChild(visor);
    }
    if (robot) {
      const gl = i === 0 ? '#6cf0ff' : '#ffd24a';
      visor.style.cssText = 'position:absolute;left:-4%;right:-4%;top:43%;height:19%;display:block;'
        + `background:linear-gradient(180deg,#07131c 0%,${gl} 30%,#ffffff 50%,${gl} 70%,#07131c 100%);`
        + `box-shadow:0 0 14px ${gl};opacity:.94;`;
    } else if (visor.style.display !== 'none') {
      visor.style.cssText = 'display:none';
    }
    if (robot) {
      el.style.filter = 'grayscale(1) contrast(1.55) brightness(1.12) sepia(.5) hue-rotate('
                      + (i === 0 ? '150deg' : '-25deg') + ') saturate(2.6)';
      el.style.outlineColor = i === 0 ? '#6cf0ff' : '#ffd24a';
    } else if (charging) {
      // The windup: the face strobes between human and machine, so the transformation is
      // visible a full second before the stats change.
      const k = Math.sin(performance.now() / 55) > 0 ? 1 : 0;
      el.style.filter = k ? 'grayscale(1) contrast(2) brightness(1.6)' : '';
      el.style.outlineColor = k ? '#ffffff' : '';
    } else if (el.style.filter || el.style.outlineColor) {
      el.style.filter = '';
      el.style.outlineColor = '';
    }
    el.classList.toggle('armed', p.armed > 0);
    if (p.armed > 0) el.style.setProperty('--glow', p.shot.color);
    el.classList.toggle('hexed', !!p.effectId);
    el.classList.toggle('knocked', p.knocked > 0 || p.rooted > 0);
    el.classList.toggle('slowed', p.slow > 0 && p.knocked <= 0);
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
    const powered = p.armed > 0;
    // While POWER MODE is live the bar counts DOWN — the gauge stops being "how close am I"
    // and becomes "how long have I got", which is the only number that matters then.
    gEl.querySelector('.fill').style.width =
      (powered ? (p.armed / C.POWER_MODE_TIME) * 100 : p.gauge * 100) + '%';
    gEl.classList.toggle('full', p.gauge >= 1 && !powered);
    gEl.classList.toggle('powered', powered);
    gEl.querySelector('.nm').textContent = powered
      ? `${p.shot.name} ${p.armed.toFixed(1)}s`
      : p.shot.name;
  }
  const me = ONLINE ? NET.you : 0;
  const mine = M.players[me];
  const pb = $('#powerBtn');
  pb.classList.toggle('ready', mine.gauge >= 1 && mine.armed <= 0);
  pb.classList.toggle('live', mine.armed > 0);
  pb.textContent = mine.armed > 0 ? mine.armed.toFixed(1) : 'POWER';
  $('#rtt').textContent = ONLINE ? `${NET.rtt}ms` : '';
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
  GAUGE_FULL: [3, 60], POWER_MODE_TIME: [1, 12], POWER_SHOT_SPEED: [800, 3600],
  POWER_SHOT_LIFE: [.4, 4], POWER_SHOT_SAG: [0, 1], POWER_BLOCK_REBOUND: [0, 1],
  POWER_TACKLE_SCALE: [0, 1.5], BODY_DEADEN: [0, 1],
  POWER_STUN: [.2, 3], COUNTER_WINDOW: [40, 320], MATCH_DURATION: [15, 180],
  // jump feel
  COYOTE_TIME: [0, .3], JUMP_BUFFER: [0, .3], FALL_MULT: [1, 3],
  // kick shaping
  LOB_LIFT: [1, 3], LOB_DRIVE: [.2, 1],
  // tackling
  TACKLE_GAUGE: [0, .4], TACKLE_SLOW: [.2, 1], TACKLE_SLOW_TIME: [0, 4],
  TACKLE_STUN: [0, 1], TACKLE_PUSH: [0, 900], TACKLE_LIFT: [0, 600], TACKLE_IMMUNE: [0, 4],
  // impact
  HIT_STOP_KICK: [0, .2], HIT_STOP_POWER: [0, .3], HIT_STOP_TACKLE: [0, .2],
  BALL_IDLE_RESET: [2, 20],
  // spectacle
  SPECTACLE_ON: [0, 1], SPECTACLE_FIRST: [2, 40], SPECTACLE_GAP: [3, 45], SPECTACLE_QUIET_END: [0, 30],
  METEOR_WARN: [.3, 4], METEOR_SHOWER_TIME: [1, 20], METEOR_INTERVAL: [.2, 4],
  METEOR_SPREAD: [0, 460], METEOR_KEEPOUT: [60, 380], METEOR_R: [20, 160], METEOR_BALL_R: [20, 200],
  METEOR_PUSH: [0, 1200], METEOR_LIFT: [0, 900], METEOR_KNOCK: [0, 1.5],
  METEOR_BALL_POP: [0, 1400], METEOR_BALL_PUSH: [0, 600], HIT_STOP_METEOR: [0, .3],
  MOON_TIME: [1, 20], MOON_GRAV_BALL: [.1, 1], MOON_GRAV_PLAYER: [.1, 1],
  WIND_TIME: [1, 20], WIND_FORCE: [0, 1400],
  ROBOT_DEFICIT: [1, 6], ROBOT_WARN: [.2, 4], ROBOT_TIME: [1, 30], ROBOT_COOLDOWN: [0, 40],
  ROBOT_SPEED: [.8, 1.8], ROBOT_KICK: [.8, 2], ROBOT_JUMP: [.6, 1.4], ROBOT_GRAV: [.6, 2],
  // One dial over all of them: PACE rescales speeds, gravities, drags and durations together
  // so the match slows down without any trajectory changing shape. 1 = the old pace.
  PACE: [0.5, 1.3],
};
const BASE = C.snapshot();

function buildTuner() {
  const body = $('#tunerBody');
  body.innerHTML = '';
  // Read the LIVE values, not the boot snapshot: moving PACE rewrites a dozen other numbers,
  // and a panel still showing their old values is worse than no panel.
  const cur = C.snapshot();
  for (const k of C.TUNABLE) {
    const [lo, hi] = RANGES[k] || [0, BASE[k] * 3 || 1];
    const stepv = (hi - lo) / 200;
    const row = document.createElement('div');
    row.className = 'tune-row';
    row.innerHTML = `<label>${k}</label><output>${fmt(cur[k])}</output>
      <input type="range" min="${lo}" max="${hi}" step="${stepv}" value="${cur[k]}">`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    inp.oninput = () => {
      const v = +inp.value;
      out.textContent = fmt(v);
      C.tune({ [k]: v });
      if (k === 'HEAD_R' || k === 'GROUND_Y') { for (let i = 0; i < 2; i++) $('#head' + i).dataset.card = ''; }
      if (k === 'PACE') buildTuner();     // it just moved every other row

    };
    body.appendChild(row);
  }
}
const fmt = (v) => (Math.abs(v) < 10 ? (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : Math.round(v));

$('#gear').onclick = () => { $('#tuner').classList.toggle('hidden'); };
$('#sndBtn').onclick = () => {
  const on = !audioEnabled();
  setAudioEnabled(on);
  $('#sndBtn').textContent = on ? '🔊' : '🔇';
  $('#sndBtn').classList.toggle('off', !on);
  if (on) SFX.whistle();          // also serves as the WKWebView audio unlock gesture
};
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
  // ?pace=0.7 — the whole match in slow motion, for arguing about speed on the phone
  // without a rebuild. Same scale as the PACE row in the tuner.
  if (q.has('pace')) C.setPace(+q.get('pace'));
  if (q.has('diff')) {
    pick.level = Math.max(0, Math.min(5, +q.get('diff')));
    $('#diff').value = pick.level;
    $('#diffName').textContent = DIFFICULTIES[pick.level].name;
  }

  renderSlots();
  renderGrid();
  buildTuner();
  if (q.has('solo')) window.BOT_OFF = true;
  // ?stage=japan|harbor|china|airbase|jungle|temple|factory pins one, for screenshots.
  // ?stage= pins any of the eleven. Falls back to the old lookup so an unknown id still
  // yields a stage rather than a blank screen.
  if (q.has('stage')) PIN_STAGE = findStage(q.get('stage')) || stageById(q.get('stage'));
  if (q.has('room')) {
    // A share link is an invite: land straight in the lobby, pre-joined.
    const code = String(q.get('room')).trim().toUpperCase().slice(0, 4);
    $('#codeInput').value = code;
    openLobby('join', code);
  } else if (q.has('play')) startMatch();
})();

// Handy from the console / screenshot harness. MATCH must be a live getter — Object.assign
// would copy the value at boot (null) and every probe would read stale.
// SPEC/ACT are here so _spectacle-shots.mjs can force an event instead of waiting nine
// seconds and hoping the dice pick the one it wants to photograph.
Object.assign(window, { C, startMatch, pick, SHOTS, ACT, activeMeteors, isRobot });
Object.defineProperty(window, 'MATCH', { get: () => M });
Object.defineProperty(window, 'HELD', { get: () => held });
Object.defineProperty(window, 'EVENTS', { get: () => EVENT_LOG });
// Which backdrop is live. A getter, not a copy: STAGE is reassigned on every kickoff, so a
// value captured at boot would report the first match forever.
Object.defineProperty(window, 'STAGE', { get: () => STAGE });
Object.defineProperty(window, 'STAGE_POOL', { get: () => POOL.map((s) => s.id) });
