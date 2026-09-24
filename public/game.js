// Client: pick screen, input, fixed-step loop, renderer, live tuner.
// Everything that decides the game lives in /shared; this file only draws it and reads keys.

import * as C from '../shared/constants.js';
import { createMatch, step, headY, headR, hurtTier, NO_FX } from '../shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from '../shared/bot.js';
import { shotFor, SHOTS } from '../shared/powershots.js';
import { goalBox, goalAt, depthPoint, INSIDE_Z } from '../shared/goalbox.js';
import { createEditor, applyLayout, applyOpacity, loadOpacity } from './padlayout.js';
import { headCrop } from './head-crop.js';
import { clockText } from './hud.js';
import { createNet } from './net.js';
import { playEvent, SFX, setAudioEnabled, audioEnabled, synth } from './audio.js';
import { STAGES, randomStage, stageById } from './stages.js';
import { DIRECTIONS } from './art-directions.js';
import { CHAMPIONS, TIERS, stageConfig, championForStage } from '../shared/champions.js';
import { POWERS } from '../shared/powers.js';
import * as ARC from '../shared/arcade.js';
import { createVfx } from './champ-vfx.js';

// What the 45 champion powers look and sound like. It only watches the match (see champ-vfx.js).
const VFXR = createVfx({ synth });

// The eleven backdrops a match can roll: the seven Street Fighter II homages plus the four
// original directions. DIRECTIONS uses the identical { id, name, grass, wall, draw(g, s) }
// contract STAGES does, which is why this is a concat and not an adapter.
const POOL = [...DIRECTIONS, ...STAGES];
// A match only ever rolls one of the four ORIGINAL directions. Putting all eleven in the
// hat meant 7-in-11 matches served a Street Fighter homage and the new art looked like it
// had vanished — which is exactly how it was reported. The seven are superseded, not
// deleted: every one is still reachable by ?stage=<id>.
const pickStage = () => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
const findStage = (id) => POOL.find((x) => x.id === id) || null;

const CARD_ART = 'https://pxsjmychuxwufcvqixgu.supabase.co/storage/v1/object/public/cards';
const RARITIES = ['legendary', 'epic', 'rare', 'common'];
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
  // The maths lives in head-crop.js so test-heads.mjs can run it over all 180 anchors. It
  // CLAMPS the window to the card, which the old inline version did not: twenty of the
  // anchors were measured asking for a window bigger than the card or too near an edge, and
  // an unclamped crop shows the card's edge and blank space beyond it — which is why some
  // faces sat off centre on a phone.
  const c = headCrop(anchorFor(r, n), ANCHORS.cardW, ANCHORS.cardH, sizePx);
  el.style.backgroundImage = `url("${cardUrl(r, n)}")`;
  el.style.backgroundSize = `${c.width}px ${c.height}px`;
  el.style.backgroundPosition = `${c.x}px ${c.y}px`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PICK SCREEN
// ═══════════════════════════════════════════════════════════════════════════
// THE PLAYER'S ALBUM. The app injects it before the page boots — window.SALTIZ_CARDS, a
// compact [{ r, n, c, w }] built from their claims — because inside the app the album IS the
// roster: the cards you own are the heads you may play, and (since the hand landed) the
// powers you may press. Ignoring it, which this file did until now, let a player walk into
// the game with a legendary they do not own.
//
// Outside the app there is no album, and that must stay a full deck rather than an empty
// one: the browser is where this game gets argued about, and locking it to nothing owned
// would make it untestable. So an ABSENT album means everything is available; a PRESENT one
// means exactly what it says, even if it says very little.
const OWNED = (() => {
  const raw = typeof window !== 'undefined' ? window.SALTIZ_CARDS : null;
  if (!Array.isArray(raw) || !raw.length) return null;              // no album -> no gate
  const set = new Set();
  for (const c of raw) {
    const r = c && (c.r || c.rarity);
    const n = Number(c && (c.n ?? c.card_number ?? c.number));
    if (RARITIES.includes(r) && n >= 1 && n <= CARDS_PER_RARITY) set.add(`${r}_${n}`);
  }
  return set.size ? set : null;
})();
const owns = (r, n) => !OWNED || OWNED.has(`${r}_${n}`);
// The best card they actually hold, for the opening selection: rarest first, then lowest
// number, so a player with one legendary opens on it rather than on a common they forgot.
const bestOwned = () => {
  if (!OWNED) return null;
  // RARITIES here is RAREST FIRST — legendary, epic, rare, common. archive/shared/cards.js ordered its
  // own list the other way (common first, because the rarity ladder indexes off it), and
  // reversing this one to match cost a test: it opened the player on the worst card they own.
  for (const r of RARITIES) {
    for (let n = 1; n <= CARDS_PER_RARITY; n++) if (OWNED.has(`${r}_${n}`)) return { rarity: r, number: n };
  }
  return null;
};

const pick = {
  // The app injects these before the page boots, exactly as it does for football.
  name: (typeof window !== 'undefined' && window.SALTIZ_NAME) || new URLSearchParams(location.search).get('name') || 'שחקן',
  me: bestOwned() || { rarity: 'legendary', number: 3 },
  foe: { rarity: 'legendary', number: 2 },
  target: 'me',
  rarity: (bestOwned() || { rarity: 'legendary' }).rarity,
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
    // A card you do not own is shown, not hidden — seeing what the album could hold is half
    // the reason to go and get it — but it cannot be picked as YOUR head. The opponent slot
    // is unrestricted: choosing who to play against is not a claim to own them.
    const mine = pick.target === 'me';
    const locked = mine && !owns(pick.rarity, n);
    el.classList.toggle('locked', locked);
    if (locked) el.title = 'לא באלבום שלך';
    el.onclick = () => {
      if (locked) return;
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

// ── SCREENS ───────────────────────────────────────────────────────────────
// Exactly one is up at a time. Every navigation goes through here, so a new screen cannot be
// left showing behind another one.
const SCREENS = ['pick', 'modeSel', 'arcade', 'lobby', 'match'];
function show(id) { for (const sId of SCREENS) $('#' + sId).classList.toggle('hidden', sId !== id); }

// ── THE TWO MODES ──────────────────────────────────────────────────────────
// Asked AFTER the card, on a screen of its own: «רב משתתפים» is the private-room 1v1 exactly
// as it was (the same two buttons, the same lobby, the same wire), and «שחקן יחיד (ארקייד)» is
// the 45-champion campaign. This used to be a bot/duo toggle on the pick bar; the arcade is
// what "play the computer" grew into, and the old free match lives on inside it.
function openModes(multi = false) {
  show('modeSel');
  $('#multiRow').classList.toggle('hidden', !multi);
  $('#modeMulti').classList.toggle('on', multi);
  $('#modeArcadeSub').textContent = ARC.campaignComplete(PROG)
    ? '45 אלופים · הושלם ✓'
    : `45 אלופים · שלב ${ARC.currentStage(PROG)}`;
}
$('#playBtn').onclick = () => openModes();
$('#modeBack').onclick = () => show('pick');
$('#modeMulti').onclick = () => openModes(true);
$('#modeArcade').onclick = () => openArcade();

// ── THE ARCADE BOARD ──────────────────────────────────────────────────────
// Progress is shared/arcade.js; this only draws it and refuses to start a locked stage.
const STORE = (() => { try { return window.localStorage; } catch { return null; } })();
let PROG = ARC.loadProgress(STORE);
let ARC_SEL = ARC.currentStage(PROG);
let ARCADE = null;                       // { stage } while an arcade match is being played

const STATUS_TXT = { locked: 'נעול', available: 'זמין', completed: 'הושלם' };
const STATUS_CLS = { locked: 'locked', available: 'open', completed: 'done' };
const starText = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));

function openArcade() {
  show('arcade');
  layoutArcade();
  renderArcade();
}
$('#arcBack').onclick = () => openModes();

// Tile size off the height the screen has: the strip scrolls sideways, so only its height is
// fixed, and the face crop needs a real pixel size (paintHead positions the art in px).
let TILE_PX = 0;
// The reel's big hexagon: as large as its column allows with the neighbours still showing
// above and below. REEL_STEP is the distance between two champions' centres.
let REEL_H = 0, REEL_STEP = 0;
function layoutArcade() {
  const reel = $('#arcReel');
  const h = Math.max(56, Math.round(Math.min(reel.clientHeight / 2.5, reel.clientWidth * 0.8, 220)));
  if (h !== REEL_H) {
    REEL_H = h; REEL_STEP = Math.round(h * 0.78);
    reel.style.setProperty('--h', h + 'px');
    reel.style.setProperty('--step', REEL_STEP + 'px');
    for (const f of reel.querySelectorAll('.f')) f.dataset.card = '';
  }
  const tile = Math.max(36, Math.min(60, Math.round(Math.min(innerHeight * 0.11, innerWidth * 0.1))));
  if (tile === TILE_PX) return;
  TILE_PX = tile;
  const g = $('#arcGrid');
  g.style.setProperty('--tile', tile + 'px');
  for (const f of g.querySelectorAll('.f')) f.dataset.card = '';
}

// Lay the reel out around a (possibly fractional, mid-drag) position: each champion sits
// `d` steps from the middle, shrinking and fading with distance. Only the few near the middle
// are shown; the rest wait off the reel.
let REEL_POS = 0;
function placeReel(pos) {
  REEL_POS = pos;
  for (const el of $('#arcReel').children) {
    const d = +el.dataset.stage - pos, a = Math.abs(d);
    const s = a < 1 ? 1 - 0.45 * a : Math.max(0.3, 0.55 - 0.15 * (a - 1));
    el.style.setProperty('--d', d.toFixed(3));
    el.style.setProperty('--s', s.toFixed(3));
    el.style.opacity = a > 2.4 ? 0 : a < 1 ? 1 : Math.max(0, 0.75 - 0.35 * (a - 1)).toFixed(2);
    el.style.zIndex = String(10 - Math.round(a));
    el.style.visibility = a > 3 ? 'hidden' : '';
    el.tabIndex = -1;
  }
}

// The stat bars under the pitch, 1–10 like Head Soccer's: each champion's number placed
// between the weakest and the strongest of the 45, so the bars show where it sits on the ladder.
const STAT_ROWS = [
  ['מהירות', (d) => d.body.speed], ['קפיצה', (d) => d.body.jump], ['בעיטה', (d) => d.body.kick],
  ['תגובה', (d) => -d.react], ['דיוק', (d) => d.aim], ['התקפה', (d) => d.aggression],
];
const STAT_RANGE = STAT_ROWS.map(([, f]) => {
  const v = CHAMPIONS.map((c) => f(c.difficulty));
  return [Math.min(...v), Math.max(...v)];
});
function renderStats(c) {
  const box = $('#arcStats');
  if (!box.children.length) {
    box.innerHTML = STAT_ROWS.map(([name]) => `<div class="arc-stat"><span>${name}</span><i>${'<s></s>'.repeat(10)}</i></div>`).join('');
  }
  STAT_ROWS.forEach(([, f], k) => {
    const [lo, hi] = STAT_RANGE[k];
    const n = 1 + Math.round(9 * (hi > lo ? (f(c.difficulty) - lo) / (hi - lo) : 1));
    [...box.children[k].querySelectorAll('s')].forEach((seg, i) => seg.classList.toggle('on', i < n));
  });
}

let ARC_SHOWN = 0;                       // the stage the strip last scrolled to
function renderArcade() {
  const grid = $('#arcGrid');
  if (grid.children.length !== CHAMPIONS.length) {
    grid.innerHTML = '';
    for (const c of CHAMPIONS) {
      const el = document.createElement('button');
      el.dataset.stage = c.stage;
      el.dataset.tier = c.tier;
      const first = c.stage === 1 || CHAMPIONS[c.stage - 2].tier !== c.tier;
      el.innerHTML = `<i class="f"></i><b>${c.stage}</b><em></em>${first ? `<u>${TIERS[c.tier]}</u>` : ''}`;
      el.onclick = () => selectStage(c.stage);
      grid.appendChild(el);
    }
  }
  for (const el of grid.children) {
    const n = +el.dataset.stage;
    const st = ARC.stageStatus(PROG, n);
    const first = el.querySelector('u') ? ' tier1st' : '';
    el.className = `arc-tile ${STATUS_CLS[st]}${first}${n === ARC_SEL ? ' sel' : ''}`;
    el.title = `${CHAMPIONS[n - 1].title} · ${STATUS_TXT[st]}`;
    const f = el.firstElementChild;
    const px = Math.round(TILE_PX * 0.84);
    if (TILE_PX && f.dataset.card !== String(px)) { paintHead(f, 'legendary', n, px); f.dataset.card = String(px); }
  }
  if (ARC_SHOWN !== ARC_SEL) {
    ARC_SHOWN = ARC_SEL;
    // By hand, not scrollIntoView: that also scrolls the (overflow: hidden) screen itself, and
    // on a small phone the whole arcade slid sideways off the glass.
    const t = grid.children[ARC_SEL - 1], gr = grid.getBoundingClientRect(), tr = t.getBoundingClientRect();
    if (gr.width) grid.scrollBy({ left: (tr.left + tr.width / 2) - (gr.left + gr.width / 2), behavior: 'smooth' });
  }
  $('#arcProg').textContent = `${PROG.cleared} / ${ARC.STAGE_COUNT}`;
  $('#arcBar').style.width = (PROG.cleared / ARC.STAGE_COUNT * 100).toFixed(1) + '%';

  const c = championForStage(ARC_SEL);
  const st = ARC.stageStatus(PROG, ARC_SEL);
  const pw = POWERS[c.power];
  // The reel: built once, then only its classes and its faces change.
  const reel = $('#arcReel');
  if (reel.children.length !== CHAMPIONS.length) {
    reel.innerHTML = '';
    for (const c of CHAMPIONS) {
      const el = document.createElement('button');
      el.className = 'arc-slot';
      el.dataset.stage = c.stage;
      el.innerHTML = `<b class="fb">${c.stage}</b><i class="f"></i><span class="lk">🔒</span>`;
      el.onclick = () => { if (!reelDragged) selectStage(c.stage); };
      reel.appendChild(el);
    }
  }
  for (const el of reel.children) {
    const n = +el.dataset.stage, f = el.children[1];
    el.className = `arc-slot ${STATUS_CLS[ARC.stageStatus(PROG, n)]}${n === ARC_SEL ? ' sel' : ''}`;
    el.title = CHAMPIONS[n - 1].title;
    // Painted at full size once; the reel's scale does the shrinking. Only near the middle, so
    // opening the board does not fetch all 45 cards at once.
    const px = Math.round(REEL_H * 0.82);
    if (REEL_H && Math.abs(n - ARC_SEL) <= 3 && f.dataset.card !== String(px)) { paintHead(f, 'legendary', n, px); f.dataset.card = String(px); }
  }
  if (!reel.classList.contains('dragging')) placeReel(ARC_SEL);
  $('#arcCount').textContent = `${c.stage} / ${ARC.STAGE_COUNT}`;
  $('#arcStage').textContent = `שלב ${c.stage} · ${TIERS[c.tier]}`;
  $('#arcTitle').textContent = c.title;
  $('#arcStars').textContent = starText(c.difficulty.stars);
  const badge = $('#arcStatus');
  badge.textContent = st === 'locked' ? '🔒 נעול' : st === 'completed' ? '✓ הושלם' : '⚡ מחכה לך';
  badge.className = `arc-status ${STATUS_CLS[st]}`;
  $('#arcPower').textContent = `${pw.icon} ${pw.name}`;
  $('#arcPower').style.setProperty('--pc', pw.color);
  $('#arcDesc').textContent = st === 'locked' ? 'נצח את האלוף הקודם כדי לפתוח את השלב הזה.' : pw.desc;
  $('#arcPrev').disabled = ARC_SEL <= 1;
  $('#arcNext').disabled = ARC_SEL >= ARC.STAGE_COUNT;
  renderStats(c);
  // Who you are bringing: your card, and the power its ultimate has in the arcade.
  const mine = CHAMPIONS.find((x) => x.card.rarity === pick.me.rarity && x.card.number === pick.me.number);
  paintHead($('#arcYouFace'), pick.me.rarity, pick.me.number, $('#arcYouFace').clientWidth || 64);
  $('#arcYou').textContent = mine
    ? `${mine.title} ${POWERS[mine.power].icon}`
    : shotFor(pick.me.rarity, pick.me.number).name;
  const play = $('#arcPlay');
  play.disabled = st === 'locked';
  play.textContent = st === 'locked' ? '🔒 נעול' : st === 'completed' ? 'שחק שוב ▶' : 'שחק ▶';
}
// Every way of moving the reel lands here, clamped to 1..45; the reel's transition does the roll.
function selectStage(n) {
  n = Math.max(1, Math.min(ARC.STAGE_COUNT, n));
  if (n === ARC_SEL) { placeReel(n); return; }
  ARC_SEL = n;
  renderArcade();
}
$('#arcPrev').onclick = () => selectStage(ARC_SEL - 1);
$('#arcNext').onclick = () => selectStage(ARC_SEL + 1);
$('#arcPlay').onclick = () => startArcadeStage(ARC_SEL);

// Drag (mouse) or swipe (touch) the reel: it follows the finger, then snaps to the nearest
// champion. Up brings the next one in from below. Past the ends it only gives a little.
let reelDrag = null, reelDragged = false;
const reelEl = $('#arcReel');
reelEl.addEventListener('pointerdown', (e) => {
  reelDrag = { y: e.clientY, pos: ARC_SEL, id: e.pointerId };
  reelDragged = false;
});
reelEl.addEventListener('pointermove', (e) => {
  if (!reelDrag || e.pointerId !== reelDrag.id) return;
  const dy = e.clientY - reelDrag.y;
  if (!reelDragged && Math.abs(dy) < 8) return;
  if (!reelDragged) { reelDragged = true; reelEl.classList.add('dragging'); reelEl.setPointerCapture(e.pointerId); }
  let pos = reelDrag.pos - dy / (REEL_STEP || 80);
  if (pos < 1) pos = 1 - (1 - pos) * 0.3;
  if (pos > ARC.STAGE_COUNT) pos = ARC.STAGE_COUNT + (pos - ARC.STAGE_COUNT) * 0.3;
  placeReel(pos);
});
const endReelDrag = () => {
  if (!reelDrag) return;
  reelDrag = null;
  if (!reelDragged) return;
  reelEl.classList.remove('dragging');
  // A quarter of a step is enough to mean «the next one»; further than that rounds as usual.
  const from = ARC_SEL, off = REEL_POS - from;
  selectStage(Math.abs(off) < 0.25 ? from : off > 0 ? Math.max(from + 1, Math.round(REEL_POS)) : Math.min(from - 1, Math.round(REEL_POS)));
  setTimeout(() => { reelDragged = false; }, 0);   // the click that ends a drag is not a tap
};
reelEl.addEventListener('pointerup', endReelDrag);
reelEl.addEventListener('pointercancel', endReelDrag);
// The wheel rolls one champion per notch, however fast a trackpad fires.
let wheelAt = 0;
reelEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const now = performance.now();
  if (Math.abs(e.deltaY) < 4 || now - wheelAt < 140) return;
  wheelAt = now;
  selectStage(ARC_SEL + Math.sign(e.deltaY));
}, { passive: false });

// Keys on the board: ↑/↓ roll the reel the way it looks, Home/End jump to the ends,
// Enter plays, Esc goes back. Left alone while a control that owns those keys has focus.
addEventListener('keydown', (e) => {
  if ($('#arcade').classList.contains('hidden')) return;
  if (e.repeat && e.code.endsWith('Enter')) return;
  const t = e.target, inField = t && t.tagName === 'INPUT';
  const onButton = t && t.tagName === 'BUTTON';
  let act = null;
  if (!inField && e.code === 'ArrowDown') act = () => selectStage(ARC_SEL + 1);
  else if (!inField && e.code === 'ArrowUp') act = () => selectStage(ARC_SEL - 1);
  else if (!inField && e.code === 'Home') act = () => selectStage(1);
  else if (!inField && e.code === 'End') act = () => selectStage(ARC.STAGE_COUNT);
  else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !onButton) act = () => startArcadeStage(ARC_SEL);
  else if (e.code === 'Escape') act = () => openModes();
  if (!act) return;
  e.preventDefault();
  e.stopImmediatePropagation();          // not also a game key held into the match
  act();
}, true);
$('#freeBtn').onclick = () => startMatch();
addEventListener('resize', () => { if (!$('#arcade').classList.contains('hidden')) { layoutArcade(); renderArcade(); } });

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

// ═══════════════════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════════════════
const held = { left: false, right: false, jump: false, kick: false, power: false };

// Bindings are DATA, not a frozen map. Two slots per action so the arrow cluster and the
// letter cluster can both live.
//
// The rebinding SCREEN is gone: this game is played in the app, on a phone, with the buttons
// on the glass — a keyboard-remapping page was a desktop feature sitting in a phone game's
// menu. The keys themselves still work (a desktop browser is where this thing gets argued
// about, and every harness drives it with real keypresses), and any layout a player saved
// while that screen existed is still honoured on load.
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

addEventListener('keydown', (e) => {
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

// ── EDIT MODE ──────────────────────────────────────────────────────────────
// Declared before the press handlers because they ask it whether a press is a press or a
// drag. See padlayout.js for what gets saved and why it is saved as fractions.
const stageBox = () => {
  const r = $('#stage').getBoundingClientRect();
  return { w: r.width || innerWidth, h: r.height || innerHeight };
};
let EDITOR = null;

// THE CONTROLS, AS A GAMEPAD RATHER THAN AS WEB BUTTONS.
//
// Two complaints, one cause. The buttons "sometimes get stuck" and "sometimes open a
// magnifier", and both come from treating a thumb like a mouse:
//
//   • RELEASING ON pointerleave. A thumb does not hold still — it rolls and drifts a few
//     pixels while you hold a direction — and the moment it crossed the edge of the button
//     the key was released while the finger was still down. That reads as "unresponsive" and,
//     if the finger then came back without a new pointerdown, as "stuck". A real d-pad keeps
//     the input until you LIFT. So the pointer is captured on down and only released on up or
//     cancel, and pointerleave is gone.
//   • THE MAGNIFIER is iOS deciding that a long press on a ◀ glyph means "select this text".
//     touch-action alone does not stop it; -webkit-touch-callout and a killed contextmenu do.
//
// Also tracked PER POINTER ID, so a second thumb landing on jump cannot release the direction
// the first one is holding, and a pointer lost to the OS (a notification, a call) releases
// exactly its own key.
const heldBy = new Map();                       // pointerId -> { k, touch }
// The two buttons a thumb is allowed to slide BETWEEN. Everything else keeps the capture it
// was pressed with, because sliding off jump onto kick is a miss, not a change of mind.
const WALK = new Set(['left', 'right']);

function pressPointer(id, btn, touch) {
  const k = btn.dataset.k;
  heldBy.set(id, { k, touch });
  held[k] = true;
  btn.classList.add('on');
}

function releasePointer(id) {
  const rec = heldBy.get(id);
  if (!rec) return;
  heldBy.delete(id);
  // Only clear the key if no OTHER live pointer is still holding it — two thumbs on the same
  // direction should take two lifts.
  for (const r of heldBy.values()) if (r.k === rec.k) return;
  held[rec.k] = false;
  for (const b of document.querySelectorAll(`.pad .btn[data-k="${rec.k}"]`)) b.classList.remove('on');
}

// ── SLIDING BETWEEN THE ARROWS ──────────────────────────────────────────────
// The capture above is what stops a drifting thumb from dropping a direction, and it is also
// what stopped a thumb SLIDING from ▶ onto ◀ from ever reaching ◀: every move for that finger
// is delivered to the button it started on. Correct for five separate buttons, wrong for the
// one pair you walk with — nobody lifts their thumb to turn around.
//
// So the walk pointers, and only the walk pointers, re-ask on every move which arrow is under
// the finger. The capture STAYS where it is: it is what guarantees the move events keep
// arriving here at all once the finger is over the canvas.
//
// The answer used to come from document.elementFromPoint on every move, which asks the whole
// page to hit-test itself dozens of times a second WHILE the button it is testing is having
// its own transform changed underneath it (`.on`/`:active` scale the pressed arrow down 6%,
// which moves its hit edges) — a live target on top of a live query. That is a plausible way
// for a return slide (▶ → ◀ → ▶) to land on the wrong side of the boundary on a real touch
// screen without ever showing up in a scripted test that moves the finger in tidy steps. So
// the geometry is read ONCE, when the walking finger first goes down — before either arrow has
// been pressed and shrunk — and every move during that finger's gesture is answered by simple
// arithmetic against that frozen box instead of a fresh hit-test.
let walkGeom = null;
function captureWalkGeom() {
  const l = document.querySelector('.pad-l .btn[data-k="left"]');
  const r = document.querySelector('.pad-l .btn[data-k="right"]');
  if (!l || !r) return null;
  return { l, r, lr: l.getBoundingClientRect(), rr: r.getBoundingClientRect() };
}
const walkAt = (x, y) => {
  if (!walkGeom) return null;
  const { l, r, lr, rr } = walkGeom;
  const top = Math.min(lr.top, rr.top), bottom = Math.max(lr.bottom, rr.bottom);
  if (y < top || y > bottom) return null;
  if (x >= lr.left && x <= lr.right) return l;
  if (x >= rr.left && x <= rr.right) return r;
  return null;                              // the gap between them, or off both ends
};

// Which fingers are WALKING, kept apart from which ones are currently holding a direction.
// They are not the same set and conflating them was the first version of this: a finger that
// slides off both arrows lets go of its direction, and if that is also what stops it being
// tracked then sliding back on can never pick anything up again. A walk pointer is tracked
// from the press that started it until it lifts, whatever it happens to be over in between.
const walking = new Set();                      // pointerIds that pressed a walk arrow

function trackWalk(ev) {
  if (!walking.has(ev.pointerId)) return;               // not a walking finger: leave it be
  if (EDITOR && EDITOR.editing) return;
  const btn = walkAt(ev.clientX, ev.clientY);
  const cur = heldBy.get(ev.pointerId);
  if (btn && cur && btn.dataset.k === cur.k) return;    // still on the same arrow
  const touch = cur ? cur.touch : ev.pointerType === 'touch';
  releasePointer(ev.pointerId);
  if (btn) pressPointer(ev.pointerId, btn, touch);
}
// On the window, not on the button: with a capture the move is delivered to the capturing
// element and bubbles from there, and without one (an engine where setPointerCapture threw)
// it is delivered wherever the finger actually is. Both reach here — and so does the lift,
// which the button would miss if the finger were over the pitch when it came off.
addEventListener('pointermove', trackWalk, { passive: true });
const endWalk = (ev) => {
  if (walking.delete(ev.pointerId)) releasePointer(ev.pointerId);
  if (!walking.size) walkGeom = null;           // no walking finger left: nothing to stay fresh for
};
addEventListener('pointerup', endWalk);
addEventListener('pointercancel', endWalk);

for (const btn of document.querySelectorAll('.pad .btn')) {
  btn.addEventListener('pointerdown', (ev) => {
    // While the layout is being edited a press MOVES the button instead of firing it.
    if (EDITOR && EDITOR.editing) return;
    ev.preventDefault();
    // Geometry first: it has to be read before pressPointer's `.on` class can shrink whichever
    // arrow this finger landed on.
    if (WALK.has(btn.dataset.k)) walkGeom = captureWalkGeom();
    pressPointer(ev.pointerId, btn, ev.pointerType === 'touch');
    if (WALK.has(btn.dataset.k)) walking.add(ev.pointerId);
    // Capture: every later event for this finger comes here even if it slides off the button,
    // which is the whole fix for the drift.
    try { btn.setPointerCapture(ev.pointerId); } catch { /* older engines: harmless */ }
  });
  const up = (ev) => {
    ev.preventDefault();
    walking.delete(ev.pointerId);
    releasePointer(ev.pointerId);
    if (!walking.size) walkGeom = null;
  };
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  // The capture can be taken away (a system gesture, a rotation). Treat it as a lift rather
  // than leaving the key down forever.
  btn.addEventListener('lostpointercapture', (ev) => {
    // The capture going away is only a lift for buttons that RELY on it. A walk arrow keeps
    // following the finger by hit-test, so losing the capture there is not a release.
    if (!walking.has(ev.pointerId)) releasePointer(ev.pointerId);
  });
  btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
const releaseAll = (touchOnly = false) => {
  for (const [id, rec] of [...heldBy]) {
    if (touchOnly && !rec.touch) continue;
    walking.delete(id);
    releasePointer(id);
  }
  if (!touchOnly) walking.clear();
  if (!walking.size) walkGeom = null;
};
// Anything that takes the page away — a notification, the app backgrounding, a phone call —
// lifts every finger. Without this the last direction you were holding stays held.
addEventListener('blur', () => releaseAll());
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
// Belt and braces for the platform that has swallowed a pointerup before: if the glass has no
// touches left on it, nothing can still be held by a touch. Mouse pointers are left alone, or
// a stray tap on a touchscreen laptop would drop the key the mouse is holding.
const allTouchesGone = (ev) => { if (!ev.touches.length) releaseAll(true); };
addEventListener('touchend', allTouchesGone, { passive: true });
addEventListener('touchcancel', allTouchesGone, { passive: true });
// The pad is on every device now, thumb or mouse — it holds the three cards, and an ability
// you cannot see is an ability nobody presses. `no-touch` survives as a flag for the few
// places that still want to know (cursor, the key caps printed on the cards); `?pad=1` is
// kept so old harness URLs keep working.
if (!matchMedia('(pointer: coarse)').matches) document.body.classList.add('no-touch');

EDITOR = createEditor({
  pad: $('#pad'),
  stageOf: stageBox,
});
applyOpacity($('#pad'), loadOpacity());
$('#editOpacity').value = String(loadOpacity());

// `how` is which of the editor's three exits was taken. Save keeps the drag, cancel puts
// everything back the way it was on open, and neither leaves a key stuck down.
const setEditing = (on, how = 'save') => {
  if (on) EDITOR.start();
  else if (how === 'cancel') EDITOR.cancel();
  else EDITOR.stop();
  $('#editBar').classList.toggle('hidden', !on);
  $('#editOpacity').value = String(EDITOR.opacity);
  for (const k of Object.keys(held)) held[k] = false;
  // The per-pointer books too, or a finger that was on an arrow when the editor opened stays
  // in them and its lift releases a key nobody is holding.
  heldBy.clear(); walking.clear(); walkGeom = null;
  for (const b of document.querySelectorAll('.pad .btn')) b.classList.remove('on');
};
// Reached from settings, the way football's is — one entry point, not a button in the way.
$('#editCtlBtn').onclick = () => { $('#tuner').classList.add('hidden'); setEditing(true); };
$('#editDone').onclick = () => setEditing(false, 'save');
$('#editCancel').onclick = () => setEditing(false, 'cancel');
$('#editReset').onclick = () => { EDITOR.reset(); $('#editOpacity').value = String(EDITOR.opacity); };
$('#editOpacity').oninput = (e) => EDITOR.setOpacity(+e.target.value);

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
  show('lobby');
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
  bgAt = -1e9;                        // new stage, so the baked backdrop is stale
  M = NET.match;
  parts.length = 0;
  last = performance.now();
  running = true;
  ARCADE = null;
  show('match');
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
$('#lobbyBack').onclick = () => { net().leave(); openModes(true); };
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

// The free match against the bot: your card, the יריב slot, the difficulty slider. Unchanged
// from before the arcade, and still what ?play=1 and the screenshot harnesses start.
function startMatch() {
  ARCADE = null;
  STAGE = PIN_STAGE || pickStage();
  beginLocal(pick.me, pick.foe, {}, createBot(pick.level));
}

// AN ARCADE STAGE. The same match on the same sim with the same controls — the differences are
// all data: who the opponent is (the stage's champion), how its bot plays (its stage on the
// ladder), and that both legendary cards fire their champion power instead of the power shot.
function startArcadeStage(n) {
  if (!ARC.canStart(PROG, n)) return false;          // a locked stage does not start. Ever.
  const cfg = stageConfig(n);
  ARCADE = { stage: n };
  ARC_SEL = n;
  // Each champion has a home ground, drawn from the four original backdrops in turn.
  STAGE = PIN_STAGE || DIRECTIONS[cfg.champ.arena % DIRECTIONS.length];
  beginLocal(pick.me, cfg.champ.card, cfg.matchOpts, createBot(0, Math.random, cfg.bot));
  return true;
}

function beginLocal(me, foe, opts, bot) {
  ONLINE = false;
  bgAt = -1e9;                        // new stage, so the baked backdrop is stale
  M = createMatch(me, foe, opts);
  BOT = bot;
  parts.length = 0;
  acc = 0; last = performance.now(); running = true;

  show('match');
  $('#over').classList.add('hidden');

  for (let i = 0; i < 2; i++) {
    const el = $('#head' + i);
    el.className = 'head p' + i;
    el.dataset.card = '';
    $(`.gauge.g${i} .nm`).textContent = powerName(M.players[i]);
  }
  resize();
  playEvent('whistle');
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// What a player's ultimate is called: the champion power in the arcade, the power shot anywhere else.
const powerOf = (p) => (p.champ ? POWERS[p.champ.power] : null);
const powerName = (p) => (powerOf(p) ? powerOf(p).name : p.shot.name);

function endMatch() {
  running = false;
  const [a, b] = M.score;
  const iWon = a > b;
  $('#overTitle').textContent = iWon ? 'ניצחת!' : 'הפסדת';
  $('#overTitle').style.color = iWon ? 'var(--hot)' : 'var(--p1)';
  $('#overScore').textContent = `${a} : ${b}`;
  const sub = $('#overSub');
  sub.hidden = true;
  $('#again').textContent = 'עוד פעם';
  $('#back').textContent = 'קלפים';
  if (ARCADE) arcadeResult(iWon);
  $('#over').classList.remove('hidden');
}

// A stage was won or lost: record it, save it, and say what it means.
function arcadeResult(won) {
  const n = ARCADE.stage;
  const r = ARC.recordResult(PROG, n, won);
  if (r.accepted) { PROG = r.prog; ARC.saveProgress(STORE, PROG); }
  const champ = championForStage(n);
  const sub = $('#overSub');
  sub.hidden = false;
  $('#back').textContent = 'שלבים';
  if (won) {
    const last = n === ARC.STAGE_COUNT;
    $('#overTitle').textContent = last ? '🏆 אלוף הארקייד!' : 'ניצחון!';
    sub.textContent = last
      ? 'ניצחת את כל 45 האלופים'
      : r.unlocked ? `${champ.title} הובס · שלב ${n + 1} נפתח` : `${champ.title} הובס · שלב ${n} הושלם`;
    ARCADE.next = last ? null : n + 1;
    $('#again').textContent = last ? 'שחק שוב' : 'השלב הבא';
    ARC_SEL = last ? n : n + 1;
  } else {
    sub.textContent = `${champ.title} מחכה לך · שלב ${n}`;
    ARCADE.next = n;
    $('#again').textContent = 'נסה שוב';
  }
}

$('#again').onclick = () => {
  if (ARCADE) startArcadeStage(ARCADE.next || ARCADE.stage);
  else startMatch();
};
$('#back').onclick = $('#quit').onclick = () => {
  running = false;
  cancelAnimationFrame(raf);
  // Leaving an arcade match early records nothing: a quit is neither a win nor a loss.
  if (ARCADE) { ARCADE = null; openArcade(); }
  else show('pick');
};

// ---- banner ----------------------------------------------------------------
let bannerT = 0;
// WHO PLAYED WHAT. A card was the loudest thing a player could do and it happened in silence:
// your own button greyed out, and your opponent got no signal at all that the reason they were
// suddenly heavy was a card and not the game. Every use now says so.
//
// Capped at three on screen: two players spamming a hand can produce four in a second, and a
// stack that tall covers the crossbar.
function callout({ player, name, label, color }) {
  const box = $('#callouts');
  if (!box) return;
  while (box.children.length >= 3) box.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `callout p${player}`;
  el.style.setProperty('--cc', color);
  const who = ONLINE
    ? (player === (NET.you ?? 0) ? 'אתה' : 'היריב')
    : (player === 0 ? (pick.name || 'אתה') : 'היריב');
  el.innerHTML = `<span class="who"></span><span class="what"></span><span class="spark">✦</span>`;
  el.querySelector('.who').textContent = who;
  el.querySelector('.what').textContent = label || name;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 1500);
}

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
    // A champion power brings its own sound (champ-vfx.js), in place of the fireball's.
    if (!(e.type === 'powershot' && e.champ)) playEvent(e.type === 'strike' ? (e.head ? 'head' : 'kick') : e.type);
    VFXR.onEvent(e);
    if (e.type === 'goal') banner(e.power ? 'גול פאוור!' : 'גול!', e.player === 0 ? '#4ea0ff' : '#ff5c7a');
    else if (e.type === 'counter') banner('קאונטר!', '#ffffff');
    else if (e.type === 'tackle') {
      fx.shockwave(e.x, e.y, '#ffd166');
      if (e.by === (ONLINE ? NET.you : 0)) banner('פגיעה! +כוח', '#ffd166');
    }
    else if (e.type === 'blocked') {
      // A block is the defender's big moment — it deserves to read as one.
      banner('נחסם!', SHOTS[e.shot].color);
      flash('#ffffff', 0.16);
    }
    // ARMED. The banner says the move is loaded, not that it has gone off — the shot's own
    // banner is `powershot`, below, and it only fires on a touch.
    else if (e.type === 'armed') { banner(powerName(M.players[e.player]) + ' מוכן!', '#ffc400'); flash('#ffe14a', 0.12); }
    else if (e.type === 'ballReset') banner('כדור חדש', '#8ea0be');
    else if (e.type === 'powershot') {
      // A champion's power is announced by its own name and colour; the power shot by its shot's.
      const P = e.champ ? POWERS[e.champ] : SHOTS[e.shot];
      banner(`${e.champ ? P.icon + ' ' : ''}${e.countered ? 'קאונטר! ' : ''}${P.name}`, P.color);
      flash(P.glow, 0.22);
    }
    else if (e.type === 'drilled') banner('קידוח!', POWERS.drill.color);
    else if (e.type === 'mirrored') banner('מראה!', POWERS.mirror.color);
    else if (e.type === 'saved') banner('הצלה!', e.by === 'clone' ? POWERS.clone.color : POWERS.goalwall.color);
    else if (e.type === 'stolen') banner('נגנב!', '#ffffff');
    else if (e.type === 'timeResumes') banner('הזמן חוזר', POWERS.timestop.color);
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
      // A champion's super cut-in holds the match for a beat (arcade only; see champ-vfx.js).
      if (M.champ && VFXR.holding()) acc = 0;
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
  VFXR.bind(M);
  VFXR.update(dt);
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
// The layer above the DOM heads. Same size, same transform, same pixel grid as `cv` — it is
// the same picture, and anything drawn on it has to land on the same texels. See drawHeadNet.
const cvNet = $('#cvnet');
const ctxNet = cvNet.getContext('2d');
// SC is world units -> CSS px. OX/OY are where world (0,0) lands inside the stage, and they
// are NOT always zero: the canvas is COVER-fitted on a wide screen, so it hangs off the top.
// Anything that positions a DOM node over the pitch must go through all three — the heads are
// DOM nodes, and a head placed with SC alone drifts by exactly the crop.
let SC = 1, OX = 0, OY = 0, crowd = [];

// Street Fighter II is PIXEL art, and the cheapest honest way to get there is to render at
// half resolution and upscale with smoothing off. One texel becomes a fat on-screen pixel,
// every gradient becomes a hard edge, and canvas text picks up the chunky arcade look for
// free. Drawing "pixel-style" at full res never convinces — the edges stay clean.
const PIXEL = 2;

// How much sky may be cropped to fill more of the screen — and the number is set by the
// BALL, not by taste. The pitch is 960x530 (1.81:1) against a phone's 2.16:1, so filling the
// width completely would mean hiding 86px off the top. Measured over twelve bot matches, the
// ball reaches y=42 and spends 4.5% of the playing time above that line: a full-bleed fit
// would lose the ball off the top of the screen one tick in twenty-two. So the crop stops
// short of the highest the ball ever gets, and whatever is left over stays as bars — painted
// the colour of the sky (see paintLetterbox) rather than black.
const MAX_CROP_PX = 34;               // world units, against a measured ball ceiling of 42

// Decorative grass drawn BELOW the world, never simulated and never reachable. It exists so
// that lifting the pitch above the controls does not leave a void under it: the pitch ends
// where the sim says it ends, and the green simply keeps going behind the buttons.
const BLEED = 170;

function resize() {
  const vw = innerWidth, vh = innerHeight;
  const ratio = C.W / C.H;

  // THE CONTROL BAND. The buttons used to sit ON the pitch — players stood in them, and the
  // bottom of the play area was under a thumb. So the ground line is now placed at the TOP of
  // the band the controls occupy, and the playable half of the world is entirely above them.
  //
  // It costs width: clearing a 90px band on a 390px-tall phone means the pitch renders at
  // about 83% of the screen instead of 100%, with sky-coloured bars at the sides. That is the
  // trade, and it is the right way round — a bar at the edge costs you nothing, a thumb over
  // the six-yard box costs you the goal.
  const band = padUnit(vw, vh) * 1.17 + safeInset('b');     // button + its edge margin
  const scale = Math.min(vw / C.W, (vh - band) / (C.GROUND_Y - MAX_CROP_PX));
  const w = C.W * scale, h = (C.H + BLEED) * scale;

  // The stage is the whole viewport, so the HUD and the pad — which are positioned against
  // the stage — stay where a thumb expects them instead of riding with the canvas.
  const stage = $('#stage');
  const sw = vw, sh = vh;
  stage.style.width = sw + 'px';
  stage.style.height = sh + 'px';
  SC = w / C.W;
  OX = (sw - w) / 2;
  // Anchored by the GROUND LINE rather than by either edge: everything else follows from
  // where the players' feet have to be.
  OY = (vh - band) - C.GROUND_Y * scale;
  for (const el of [cv, cvNet]) {
    el.style.left = OX + 'px';
    el.style.top = OY + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  sizePad(sw, sh, vw, vh);
  // The scoreboard portraits are sized by CSS (--face, off the smaller viewport axis), so
  // this is the one place that asks how big the CSS made them and hands that to the crop.
  const faceW = Math.round($('#face0').getBoundingClientRect().width);
  if (faceW > 0 && faceW !== FACE_PX) { FACE_PX = faceW; $('#face0').dataset.card = $('#face1').dataset.card = ''; }
  paintFaces();
  applyBars();                       // the gradient's cut is the ground line, which just moved
  // Saved offsets are fractions of the stage, so they have to be re-multiplied whenever the
  // stage changes — rotation, a resized window, the keyboard opening on a phone.
  applyLayout($('#pad'), { w: sw, h: sh });
  for (const [el, c] of [[cv, ctx], [cvNet, ctxNet]]) {
    el.width = Math.ceil(C.W / PIXEL);
    el.height = Math.ceil((C.H + BLEED) / PIXEL);
    c.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);   // draw in WORLD units, land on texels
    c.imageSmoothingEnabled = false;
  }
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
// The thumb unit, on its own, because resize() has to know how tall the control band is
// BEFORE it can decide where the pitch ends. A thumb is a thumb on every device, so it is a
// fraction of the play area rather than a fixed pixel size (46..96 keeps it inside the 44pt
// touch minimum without covering the goal).
const padUnit = (w, h) => Math.max(46, Math.min(96, Math.min(h * 0.20, w * 0.115)));

function sizePad(w, h, vw, vh) {
  if (!padEl) return;
  const u = padUnit(w, h);
  // The stage is centred, so the letterbox bar already eats this much of the inset.
  const barX = (vw - w) / 2, barY = (vh - h) / 2;
  const px = (n) => Math.max(0, Math.round(n)) + 'px';
  padEl.style.setProperty('--u', u.toFixed(1) + 'px');
  padEl.style.setProperty('--pl', px(safeInset('l') - barX));
  padEl.style.setProperty('--pr', px(safeInset('r') - barX));
  padEl.style.setProperty('--pb', px(safeInset('b') - barY));
  centreRow();
}

// The cards live BETWEEN the two thumbs, and the two thumbs are not symmetric — the act
// group is three buttons wide against the walk group's two. Centring the row on the stage
// therefore drops it on top of the right-hand group on a phone (measured: a 78px overlap on
// a 844x390 frame). So the row is centred on the GAP, measured from the real boxes rather
// than derived from a button count that the next design change would invalidate.
const ROW_MARGIN = 14;             // px of daylight kept on each side of the hand

// The union of a thumb group's buttons, which is not the same as the group's own box once a
// button is allowed to overhang it.
function groupBox(group) {
  const bs = [...group.querySelectorAll('.btn')].map((b) => b.getBoundingClientRect());
  if (!bs.length) return group.getBoundingClientRect();
  const left = Math.min(...bs.map((b) => b.left)), right = Math.max(...bs.map((b) => b.right));
  const top = Math.min(...bs.map((b) => b.top)), bottom = Math.max(...bs.map((b) => b.bottom));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function centreRow() {
  const row = document.getElementById('cardRow');
  const l = document.querySelector('.pad-l');
  const r = document.querySelector('.pad-r');
  if (!row || !l || !r) return;
  // Measure UNSHIFTED and UNSCALED. Measuring while the previous frame's scale is still on
  // the element makes the fit compound against itself — the first pass I wrote did exactly
  // that and settled at a 3px overlap instead of the margin it was asked for.
  row.style.setProperty('--rowx', '0px');
  row.style.setProperty('--rows', '1');
  // The BUTTONS' boxes, not the group's. The walk arrows overhang their group on purpose —
  // their hit target reaches past the artwork and is pulled back into the row with a negative
  // margin — so the group box is the artwork's width and the thing the cards have to clear is
  // wider than it by --hx.
  const lb = groupBox(l), rb = groupBox(r);
  const rowb = row.getBoundingClientRect();
  if (!rowb.width) return;

  // If the hand does not fit between the thumbs, shrink it rather than overlap them: a card
  // you cannot press because your own jump button is on top of it is worse than a small one.
  const room = Math.max(0, rb.left - lb.right - ROW_MARGIN * 2);
  let scale = rowb.width > room ? room / rowb.width : 1;

  // ...but only down to the 44pt touch minimum, which is a hard floor and not a preference.
  // A portrait phone has almost no gap between the two thumbs, and shrinking to fit it put
  // the cards at 29px — a target you cannot reliably hit, measured by _pad.mjs. So when the
  // hand cannot fit BESIDE the thumbs at a usable size, it goes ABOVE them at full size
  // instead. Sideways when there is room, stacked when there is not.
  const card = row.querySelector('.card');
  const cardW = card ? card.getBoundingClientRect().width : 0;
  const minScale = cardW ? Math.min(1, 44 / cardW) : 1;
  const stacked = scale < minScale;
  if (stacked) scale = 1;
  row.style.setProperty('--rows', scale.toFixed(3));

  if (stacked) {
    // One row up: clear of the tallest thumb group, with the same margin.
    const lift = Math.max(lb.height, rb.height) + ROW_MARGIN;
    row.style.setProperty('--rowy', (-lift).toFixed(1) + 'px');
    row.style.setProperty('--rowx', '0px');
    return;
  }
  row.style.setProperty('--rowy', '0px');
  row.style.setProperty('--rowx',
    ((lb.right + rb.left) / 2 - (rowb.left + rowb.width / 2)).toFixed(1) + 'px');
}

addEventListener('resize', () => { if (M) resize(); });
addEventListener('orientationchange', () => setTimeout(() => M && resize(), 120));

// THE LETTERBOX. The pitch is a fixed 960x470 (2.04:1) and a modern phone is 2.16:1 or
// wider, so a centred stage always leaves a bar at each end. Black bars read as "the page
// does not fit" — the game looks like it is sitting in a box rather than filling the screen.
//
// Cropping the world instead would either cut the HUD (it lives at the top of the stage) or
// cut the goals, so the stage keeps its aspect and the BARS get painted the colour of the
// backdrop behind them. Sampled from the canvas rather than read off the stage definition,
// because the four art directions each paint their own sky and a hardcoded colour would be
// wrong for three of them. One sample per stage, not per frame.
let barStage = null, barSky = null;
function paintLetterbox() {
  if (!STAGE) return;
  if (STAGE.id !== barStage) {
    try {
      const d = ctx.getImageData(2, 2, 1, 1).data;
      barSky = `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
      barStage = STAGE.id;
    } catch { return; }        // a tainted canvas would throw; the default background is fine
  }
  applyBars();
}

// The bars are painted on the STAGE, not the body: the stage covers the viewport and carries
// its own opaque colour, so a colour on the body sits behind it and is never seen — which is
// exactly the bug that made the first version look like it had done nothing.
//
// And they are a two-stop gradient rather than one flat colour, cut at the ground line: sky
// beside the sky, grass beside the grass. A single colour makes the bottom corners read as
// holes punched either side of the pitch.
//
// AND IT ONLY WRITES WHEN THE BARS ACTUALLY CHANGE. draw() calls paintLetterbox() every frame,
// which called this every frame, which assigned a `background` on #stage every frame — and
// #stage is the element covering the whole viewport. Measured: 301 writes over 301 frames, all
// 301 of them byte-identical to the one before. The three things the gradient is built from
// (the ground line, the sky sample, the stage's grass) only move on a resize or a stage change,
// so the write belongs on those events, not on the frame clock. Nothing here is a big number on
// a desktop; on a phone, handing the engine a fresh full-viewport background sixty times a
// second is the kind of work that costs a frame without ever showing up as slow JavaScript.
let barsGround = -1, barsSky = null, barsGrass = null;
function applyBars() {
  if (!barSky || !STAGE) return;
  const ground = Math.max(0, Math.round(OY + C.GROUND_Y * SC));
  const grass = STAGE.grass ? STAGE.grass[0] : barSky;
  if (ground === barsGround && barSky === barsSky && grass === barsGrass) return;
  barsGround = ground; barsSky = barSky; barsGrass = grass;
  $('#stage').style.background =
    `linear-gradient(to bottom, ${barSky} 0 ${ground}px, ${grass} ${ground}px 100%)`;
}

function draw() {
  const g = ctx;
  g.clearRect(0, 0, C.W, C.H + BLEED);
  // A frozen frame on its own just looks like a dropped frame. A couple of pixels of shake
  // during hit-stop is what turns it into an impact.
  const shake = M.hitStop > 0 ? M.hitStop * 60 : 0;
  const kick = VFXR.shakeOffset();           // a champion power's own camera kick
  if (shake > 0 || kick) {
    g.save();
    g.translate((Math.random() - .5) * shake + (kick ? kick[0] : 0), (Math.random() - .5) * shake + (kick ? kick[1] : 0));
  }
  drawStadium(g);
  paintLetterbox();
  // THE GOAL IS A BOX AND THE BODIES GO INSIDE IT. Everything between these two calls is
  // drawn in the goal's interior when it is in one: behind the near net, in front of the far
  // one. See drawGoalBack / drawGoalFront and shared/goalbox.js.
  drawGoalBack(g, true);
  drawGoalBack(g, false);
  if (M.champ) drawChampBack(g);
  for (const p of M.players) { drawAura(g, p); VFXR.drawAura(g, p); }
  for (const p of M.players) drawBody(g, p);
  drawParts(g, false);
  drawBall(g, M.ball);
  if (M.champ) drawChampFront(g);
  drawParts(g, true);
  drawGoalFront(g, true);            // the net you look through, over whatever is in the goal
  drawGoalFront(g, false);
  if (M.champ) VFXR.drawEffects(g, 'over');   // a wall stands in FRONT of the mouth, so over the net
  if (shake > 0 || kick) g.restore();
  if (M.champ) { VFXR.drawGrade(g); VFXR.drawCutin(g); }
  if (flashT > 0) {
    g.save();
    g.globalAlpha = (flashT / flashLife) * 0.75;
    g.fillStyle = flashCol;
    g.fillRect(0, 0, C.W, C.H);
    g.restore();
  }
  drawHeads();
  drawHeadNet();                     // …and the near net again, over a head that is in the goal
  if (M.freeze > 0 && M.phase !== 'over') drawReady(g);
}

// THE ONE THING THE CANVAS CANNOT REACH.
//
// A head is a DOM node — card art drawn into a canvas comes out blank in WKWebView, so the
// biggest thing on screen is an element sitting above the whole pitch. Which means the near
// net, drawn on the canvas underneath it, cannot cover a head standing in the goal: body
// behind the net, head in front of it, and the illusion dies at the neck.
//
// So the front of the net is stroked a second time on a canvas ABOVE the heads, clipped to
// the head it has to cover. Clipped, because that layer must touch nothing else: everywhere
// but inside that circle the net on the main canvas is the real one, and two passes over the
// same pixels would show up as a double-strength cord. Inside the circle there is no first
// pass to double — the head is opaque and hides it.
//
// It is the SAME pass the main canvas runs, not a version of it gated on "is this player in
// the goal". The net only paints where the net is, so a head half way through the mouth comes
// out half netted — exactly as the body below it does — instead of flipping all at once the
// frame the player's middle crosses the line. The bounding test below skips the work when the
// head is nowhere near a goal and can change nothing, so it cannot pop either.
function drawHeadNet() {
  ctxNet.clearRect(0, 0, C.W, C.H + BLEED);
  for (const p of M.players) {
    const h = depthPoint(p.x, headY(p));
    // Exactly the head's own disc. Wider and the wash would land on pixels the main canvas
    // has already washed, and a second 10% would ring the head in a darker halo.
    const r = headR(M, p);
    for (const left of [true, false]) {
      const box = goalBox(left);
      // The whole box, all four uprights: the near pair sit at wallX/lineX and the far pair
      // one width-step inward, and which of those is leftmost flips between the two goals.
      const xs = [box.wallX, box.wallX + box.wx, box.lineX, box.lineX + box.wx];
      if (h.x + r < Math.min(...xs) || h.x - r > Math.max(...xs) || h.y + r < box.top + box.wy) continue;
      ctxNet.save();
      ctxNet.beginPath();
      ctxNet.arc(h.x, h.y, r, 0, 6.2832);
      ctxNet.clip();
      drawGoalFront(ctxNet, left, true);   // net only — see drawGoalFront
      ctxNet.restore();
    }
  }
}

// SF2 stages are warm, saturated and built from hard bands — no gradients anywhere, and a
// dense pixel crowd behind a railing. The night-blue stadium this replaced was atmospheric
// but soft, which is the opposite of the look.
// A stage per match, drawn by public/stages.js. Everything from the hoardings down —
// boards, wall, grass, goals, players — stays here, because that furniture is the same
// wherever you are playing; only sky, horizon and crowd change.
let STAGE = pickStage();

// THE BACKDROP WAS THE ENTIRE FRAME.
//
// STAGE.draw repaints the whole stadium — sky, skyline and a 520-strong crowd drawn body by
// body — from scratch on every frame: 9,000-13,000 fillStyle/fillRect calls, measured, against
// well under 200 for everything that actually moves (both players, the ball, the ball's
// particles, the goals). Roughly 98% of the frame's draw work was ambient scenery that no part
// of the game reads, and at 60fps that is over half a million canvas calls a second — nothing
// on a phone survives it.
//
// It is safe to bake because it is a pure function of `t`: every scattered position is a hash
// of its own index (see `rnd` in art-directions.js, which exists precisely so the layout cannot
// strobe between frames) and the crowd array is only ever read. So the same call at the same
// `t` produces the same pixels. It is baked to an offscreen canvas at the same fixed internal
// resolution as the main one and re-baked BG_HZ times a second instead of sixty.
//
// What this costs: ambient motion only — drifting clouds, rain, a flickering sign, the crowd's
// bob — now updates at BG_HZ. Everything the player is actually looking at (ball, players,
// goals, the scrolling hoardings below) is untouched and stays at 60.
const BG_HZ = 12;
let bgCanvas = null, bgCtx = null, bgAt = -1e9;
function stageLayer(t, scene) {
  if (!bgCanvas) {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = Math.ceil(C.W / PIXEL);
    bgCanvas.height = Math.ceil((C.H + BLEED) / PIXEL);
    bgCtx = bgCanvas.getContext('2d');
    bgCtx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    bgCtx.imageSmoothingEnabled = false;
  }
  if (t - bgAt >= 1 / BG_HZ) {
    bgAt = t;
    bgCtx.clearRect(0, 0, C.W, C.H + BLEED);
    STAGE.draw(bgCtx, scene);
  }
  return bgCanvas;
}

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
  g.drawImage(stageLayer(t, {
    W: C.W, t, crowd,
    horizon: gy * 0.60,
    crowdTop: gy * 0.61,
    crowdBot: standBot - 8,
    gy,
  }), 0, 0, C.W, C.H + BLEED);

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
  // Set once, not once per board: the value is identical on every iteration, and assigning
  // ctx.font re-parses the font shorthand each time. The hoardings stay at 60fps — they scroll.
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(ledH * 0.62)}px -apple-system, Arial`;
  for (let x = -240; x < C.W + 240; x += 240) {
    R2(g, x + scroll, ledTop, 118, ledH, '#1b3f8a');
    R2(g, x + scroll + 120, ledTop, 118, ledH, '#c81e37');
    g.fillStyle = '#ffd23c';
    g.fillText('SALTIZ', x + scroll + 59, ledTop + ledH / 2);
    g.fillText('ראשים', x + scroll + 179, ledTop + ledH / 2);
  }
  g.restore();

  // pitch — flat mown stripes in the stage's own greens, drawn past the bottom of the world
  // into the BLEED so the strip behind the controls is grass rather than a hole.
  const grassH = C.H + BLEED - gy;
  R2(g, 0, gy, C.W, grassH, STAGE.grass[0]);
  for (let x = 0; x < C.W; x += 80) R2(g, x, gy, 40, grassH, STAGE.grass[1]);
  R2(g, 0, gy - 3, C.W, 3, OUTLINE);
  R2(g, 0, gy, C.W, 2, '#eaffea');
  R2(g, C.W / 2 - 1, gy, 2, grassH, '#eaffea');
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

// A GOAL AS A BOX, AND THE BOX IS ONE SHAPE PUSHED ONE STEP DEEPER.
//
// THE BOX IS DRAWN IN TWO PASSES, and that is the whole of the depth fix. It used to be one,
// before the bodies, so every part of the net — including the near side you are supposed to
// look THROUGH — was painted behind the ball and the players. A goal nothing can ever be
// behind is a sticker on the backdrop, which is exactly what it looked like.
//
//   drawGoalBack   the far side net, the back, the far half of the roof and the far frame.
//                  Drawn before the bodies: everything inside the goal is in front of it.
//   drawGoalFront  the near side net, the near half of the roof and the near frame. Drawn
//                  after the bodies, so a ball in the net is seen THROUGH it.
//
// Between the two sit the ball and the players, at the depth shared/goalbox.js gives them —
// which is how "inside the goal" stopped being a thing only the scoreline knew about.
//
// The pass before all this drew two frames that disagreed with each other: the far one was
// TALLER and HIGHER than the near one, and offset downwards as well. Nearer things are
// bigger, so the eye read the tall frame as the near one, then hit the offset pointing the
// other way and gave up. That is why it did not look like a box and why the back never
// showed — the "back" had ended up as a 20px splinter jammed against the canvas edge.
//
// This is an OBLIQUE projection, the one pixel art has always used: the far frame is the
// near frame translated, not shrunk. Same size, one step along the depth axis. It is not
// photographic — a photographic goal would need its far posts to shrink and the pitch to
// recede with them, and this pitch has no depth to recede into — but it is CONSISTENT,
// and consistency is what the eye reads as solid.
//
// THREE AXES, and every corner falls out of them:
//   depth   lineX -> wallX, along the ground: the net's front-to-back. Horizontal, because
//           the camera is side on and the sim scores on a vertical line.
//   height  GROUND_Y -> top.
//   width   post to post, running INTO the screen, so it projects to ONE offset (wx, wy).
//
// EVERY LINE IS AT LEAST 2 WORLD PX. The canvas renders at half resolution on purpose
// (PIXEL = 2), so a 1px cord is half a texel and comes out as grey mush — which is exactly
// what "the net looks blurry" was. A readable net here means FEWER, fatter cords with real
// gaps, not more of them.
//
// WHERE THE FAR FRAME GOES, and the one rule it may not break.
//
// It steps towards the vanishing point — which for a left goal is off to the RIGHT — and UP
// the screen, and that step is what puts a roof band above the near crossbar. The roof is
// the single cue doing most of the work here: take it away and the goal is a flat panel
// again, however many nets are hung on it.
//
// But its FEET DO NOT MOVE. This game draws the whole pitch on one ground line — near
// touchline and far touchline land on the same y — so a post that stops 25px short of that
// line is not "further back", it is hanging in the air, and that is exactly what it looked
// like. So the far posts step sideways and their tops step up, and then they run all the
// way down to GROUND_Y like everything else in this world.
//
// The price is that the far frame comes out slightly TALLER than the near one instead of
// slightly shorter. That is the wrong way round for a photograph and the right way round
// for this pitch: a real net is pegged to the grass behind the goal anyway, so the far side
// reaching the ground is what the eye expects. It is drawn dim and thin, and at the size a
// thumb sees it the extra 25px reads as net coming down to the floor, which is what it is.
function goalCorners(left) {
  const box = goalBox(left);
  const { lineX, wallX, top } = box;
  const G = C.GROUND_Y;
  // The NEAR frame: all four corners real. Its foot is the grass, its bar is the bar the sim
  // bounces the ball off, and its front post is the goal line itself. Nothing here is fudged,
  // so the thing the player aims at is the thing the rules use.
  const c = {
    box,
    bar: C.POST_R * 2,
    nFT: [lineX, top], nFB: [lineX, G],
    nBT: [wallX, top], nBB: [wallX, G],
    // …and the FAR frame: tops stepped back, feet on the same grass.
    fFT: [lineX + box.wx, top + box.wy], fBT: [wallX + box.wx, top + box.wy],
    fFB: [lineX + box.wx, G], fBB: [wallX + box.wx, G],
  };
  // The MID-WIDTH top corners — the plane a body inside the net is drawn on. The roof is cut
  // here so that its near half can go in front of a ball tucked under the bar while its far
  // half stays behind it. Every other face is wholly in front of or wholly behind that plane,
  // so the roof is the only one that has to be split.
  c.mFT = mix(c.nFT, c.fFT, INSIDE_Z);
  c.mBT = mix(c.nBT, c.fBT, INSIDE_Z);
  return c;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
const line = (g, a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
const wash = (g, pts, c, a) => { poly(g, pts); g.fillStyle = c; g.globalAlpha = a; g.fill(); g.globalAlpha = 1; };

// A mesh across any quad, walking both pairs of opposite edges. One routine for all the
// faces, so the cords line up where the faces meet instead of drifting apart at the seam.
function mesh(g, A, B, C2, D, nAB, nBC, alpha) {
  g.save(); poly(g, [A, B, C2, D]); g.clip();
  g.lineWidth = 2; g.lineCap = 'butt';
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i <= nAB; i++) line(g, mix(A, B, i / nAB), mix(D, C2, i / nAB));
  for (let i = 0; i <= nBC; i++) line(g, mix(A, D, i / nBC), mix(B, C2, i / nBC));
  g.restore();
}

// PASS ONE: everything behind a body standing in the net. Drawn deepest first so each net
// shows through the one in front of it, and every one of them dimmer than the near side — it
// is a net, and a net you look through has to stay quieter than the net you look at.
// drawGoalBack/drawGoalFront are pure functions of the goal geometry alone — no ball, no
// player, nothing that changes between frames — yet the old code re-stroked every cord of
// every mesh (dozens of clipped line() calls per pass) on every single frame, up to four
// times over once drawHeadNet's per-head, per-goal passes are counted. That clip-heavy vector
// redraw was the actual FPS killer on Render: cheap on a dev machine, brutal on the phones
// kids actually play on. Since the pixels never change except on resize, each pass is baked
// once per goal side into an offscreen canvas at the same fixed internal resolution as the
// main canvas, and every frame just blits that bitmap instead of re-walking the mesh.
const goalLayerCache = new Map();
function goalLayer(key, left, painter) {
  const box = goalBox(left);
  const cacheKey = key + (left ? 'L' : 'R');
  let entry = goalLayerCache.get(cacheKey);
  if (!entry || entry.box !== box) {
    const cnv = document.createElement('canvas');
    cnv.width = Math.ceil(C.W / PIXEL);
    cnv.height = Math.ceil((C.H + BLEED) / PIXEL);
    const cg = cnv.getContext('2d');
    cg.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    cg.imageSmoothingEnabled = false;
    painter(cg, left);
    entry = { box, canvas: cnv };
    goalLayerCache.set(cacheKey, entry);
  }
  return entry.canvas;
}

function drawGoalBack(g, left) {
  g.drawImage(goalLayer('back', left, drawGoalBackRaw), 0, 0, C.W, C.H + BLEED);
}

function drawGoalFront(g, left, netOnly = false) {
  const layer = goalLayer(netOnly ? 'frontNet' : 'frontFull', left,
    (cg, l) => drawGoalFrontRaw(cg, l, netOnly));
  g.drawImage(layer, 0, 0, C.W, C.H + BLEED);
}

function drawGoalBackRaw(g, left) {
  const { box, bar, nBT, nBB, fFT, fBT, fFB, fBB, mFT, mBT } = goalCorners(left);

  g.save();

  // 1. THE FAR SIDE. This panel had no net at all, so the far half of the goal was an empty
  //    wire frame: the mouth opened onto bare crowd and the eye had nothing to read depth on.
  wash(g, [fFT, fBT, fBB, fFB], '#0a1220', 0.13);
  mesh(g, fFT, fBT, fBB, fFB, 9, 22, 0.36);

  // 2. THE BACK, the panel joining the two rear posts. Wholly behind anything in the net:
  //    a body inside the goal is at least its own radius in front of the back plane.
  wash(g, [nBT, fBT, fBB, nBB], '#0a1220', 0.16);
  mesh(g, nBT, fBT, fBB, nBB, 4, 20, 0.40);

  // 3. THE ROOF, far half. The face that says "box", and the reason the far frame steps up at
  //    all. Its near half is held back for the front pass — see goalCorners.
  wash(g, [mFT, mBT, fBT, fFT], '#0a1220', 0.20);
  mesh(g, mFT, mBT, fBT, fFT, 9, 2, 0.62);

  g.restore();

  // THE FAR FRAME, AND ALL OF IT IS WHITE.
  //
  // Every member used to be tinted by how far away it is — #76889d at the back through
  // #eef5ff at the mouth — on the theory that a dimmer bar reads as a deeper one. It does
  // not. At this size the tint just reads as unpainted metal, and a goal frame is one
  // colour in life. Depth is carried by the line WIDTHS instead, which still run from
  // 0.38 of a bar at the far side to a full bar at the mouth, and by the draw order: far
  // members first so the near ones cross in front of them.
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';

  g.lineWidth = bar * 0.38;
  line(g, fFT, fBT);                      // far top rail
  line(g, fBB, fFB);                      // far ground rail
  line(g, fFB, fFT);                      // far post, on the line
  line(g, fBT, fBB);                      // far post, at the wall

  // The bar from the near frame to the far one across the back. The two along the bottom are
  // missing on purpose: both frames stand on GROUND_Y now, so a bar between the feet lies
  // along the ground line and the rails already drew it.
  g.lineWidth = bar * 0.6;
  line(g, nBT, fBT);                      // back top bar

  // The goal area painted on the grass. It belongs to the FLOOR, so it stays in the back
  // pass — put it in the front one and it paints a stripe across the boots of anyone
  // standing in their own six-yard box.
  g.fillStyle = '#ffffff88';
  g.fillRect(box.left ? 0 : C.W - C.GOAL_W, C.GROUND_Y - 2, C.GOAL_W, 3);
  g.restore();
}

// PASS TWO: the side of the net between the camera and anything standing in the goal. Drawn
// after the bodies, which is the entire reason a ball in the net now reads as being in it.
// `netOnly` leaves the white frame out. It is for the head layer: a head is a DOM node, so
// this pass is the only thing that can cover one — and a crossbar stroked across the face of a
// player STANDING AT THE POST reads as a head embedded in the bar, which is the exact illusion
// the crossbar fix is chasing out. The mesh is honest there (the head really is behind the
// near net at that depth); the frame is not, because those members sit on the near plane the
// player is standing on, and the rest of the bar recedes BEHIND them into the screen.
function drawGoalFrontRaw(g, left, netOnly = false) {
  const { bar, nFT, nFB, nBT, nBB, fFT, mFT, mBT } = goalCorners(left);

  g.save();
  // 4. THE ROOF, near half — in front of a ball tucked up under the bar, behind one sitting
  //    on the floor of the net only in the sense that it is nowhere near it.
  wash(g, [nFT, nBT, mBT, mFT], '#0a1220', 0.20);
  mesh(g, nFT, nBT, mBT, mFT, 9, 2, 0.62);

  // 5. THE NEAR SIDE, the big one the ball is seen through. Lightest wash of the four so the
  //    crowd still carries on behind it — a net you cannot see the stadium through reads as
  //    a hole, which is what the opaque cavity this replaced always looked like. Its cords
  //    are 2px on a ~9px grid, which is what lets a 24px ball behind it stay a ball.
  //
  //    There is no FLOOR face any more. Both frames stand on GROUND_Y now, so the floor is
  //    edge on and has no area; the dark quad that used to be drawn there was a shadow doing
  //    the job of feet that should never have been off the ground.
  wash(g, [nFT, nBT, nBB, nFB], '#0a1220', 0.10);
  mesh(g, nFT, nBT, nBB, nFB, 9, 20, 0.54);
  g.restore();
  if (netOnly) return;

  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';

  // THE CROSSBAR: post to post across the mouth.
  g.lineWidth = bar * 0.78;
  line(g, nFT, fFT);

  g.lineWidth = bar * 0.8;
  line(g, nBT, nBB);                      // near post, at the wall
  line(g, nBB, nFB);                      // near ground rail

  // The near top rail is the bar the ball actually bounces off, and the near front post is
  // the goal line. Thickest, drawn last so nothing crosses in front of them.
  g.lineWidth = bar;
  line(g, nFT, nBT);
  line(g, nFT, nFB);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(nFT[0], nFT[1], bar * 0.6, 0, 6.2832); g.fill();
  g.restore();
}


// SF2 palettes: hard 3-tone ramps, no gradients, everything sitting inside a black
// outline. Player 1 is a blue gi, player 2 a red one, both with the yellow belt.
// The BOOTS carry the same two colours one step further: blue for player one, red for player
// two. They are the part of the sprite that does the work — the reach is drawn off them — so
// they are the part that has to be readable at a glance, and a white sole under a saturated
// upper is how a football boot reads at 33px long.
const GI = [
  { base: '#3c6fd6', shade: '#22407f', light: '#6fa0ff', skin: '#f0b48a', skinShade: '#b87d55',
    boot: '#1e56c8', bootLight: '#5b93ff', bootDark: '#0d2a6b', sock: '#eaf1ff' },
  { base: '#d63c3c', shade: '#7f2222', light: '#ff7a6f', skin: '#f0b48a', skinShade: '#b87d55',
    boot: '#c81e2e', bootLight: '#ff6f61', bootDark: '#6e0f18', sock: '#ffeceb' },
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

function drawBody(g, p) {
  const pal = GI[p.index];
  const knocked = p.stunned > 0;      // the only slump left: bottomed out, not "hit"

  const bw = C.BODY_W, bh = C.BODY_H;
  // Projected at the FEET, which is the anchor the whole sprite hangs off. A body is 79px
  // tall against a 192px goal, so the step's vertical part varies by under 5px across it —
  // far too little to be worth stretching a sprite for.
  const d = depthPoint(p.x, p.y);

  // contact shadow
  g.save();
  g.globalAlpha = .35;
  g.fillStyle = '#000';
  g.fillRect(Math.round(d.x - bw * 0.6), C.GROUND_Y, Math.round(bw * 1.2), 3);
  g.restore();

  g.save();
  g.translate(Math.round(d.x), Math.round(d.y));
  if (knocked) g.rotate(p.side * 1.15);

  // LEGS, and they point where the KICK does — `side`, the goal this player attacks — not
  // where the body faces. The sim latches the swing to the same rule (kickDir), and the two
  // have to agree or the sprite is lying about which leg can reach the ball: walking backwards
  // used to turn the boot round while the kick itself went forward.
  const face = p.side;
  const kickP = p.kickT > 0 ? 1 - p.kickT / C.KICK_TIME : 0;
  const swing = p.kickT > 0 ? Math.sin(kickP * Math.PI) : 0;
  // The walk and the airborne tuck, both as ANGLES now that the limb pivots — see `leg`.
  const stride = p.onGround ? Math.sin(performance.now() / 90) * Math.min(1, Math.abs(p.vx) / 260) * 0.5 : 0.3;
  const legW = Math.max(4, Math.round(bw * 0.26));
  // Longer than the 0.42 it was, and most of the extra is hidden behind the torso — which is
  // the point. It only comes out when the leg does: swing a kick and the thigh appears from
  // under the shirt, so the kick has a leg behind it instead of a boot sliding out on its own.
  const legH = Math.round(bh * 0.62);
  const bootL = Math.round((legW + 3) * C.FOOT_LEN);
  // The boot is drawn on its STUDS: the sole sits SOLE_UP off the grass and the studs bridge
  // the gap, so the foot rests on the pitch the way a boot does instead of the upper being
  // buried in it. bootH is the upper alone, ankle down to the sole.
  const bootH = 6;
  const SOLE_UP = 2;
  const sockH = 6;                                           // ankle upward
  const shortH = 4;                                          // hip downward; skin in between
  const HIP_Y = -legH;                                       // where both limbs hang from
  const SHIN = legH - bootH - SOLE_UP + 1;                   // hip to ankle, standing
  const BOOT_FOLLOW = 0.22;                                  // of the leg's angle the foot takes
  const KICK_SWING = 1.25;                                   // rad the leg comes through, at full
  const KICK_EXTEND = 14;                                    // and px of shin it gains doing it

  // ONE LEG, hip to boot. It PIVOTS at the hip rather than sliding sideways, which is the
  // whole difference between a kick and what this used to draw: the old swing moved the leg
  // 43px across to meet the sim's reach and left a 29px hole between the hip and the thigh,
  // so the kicking boot floated away from the body on a stub of sock. Hung off the hip it
  // stays attached, and the reach comes from the leg EXTENDING through the swing instead —
  // which is also what a chibi sprite has to do, because no leg on a 27px body reaches 62px.
  //
  // `hipX` is the limb's near edge at the hip and `ang` how far it has swung forward, in
  // radians and positive toward the facing. `reach` is the extension, in px of extra shin.
  //
  // Order up from the grass: boot, sock, a sliver of knee, shorts. That is the order a
  // footballer's leg actually goes in, and the sock — the whole shin with the turnover hoop
  // at the top of it, not a 3px band at the ankle — is most of what the old leg was missing.
  // The limb gets ONE keyline and its bands are painted inside without another, or four
  // stacked 2px plates would be more black outline than leg.
  const leg = (hipX, ang, shorts, reach = 0) => {
    const shin = SHIN + reach;
    const pivotX = hipX + legW / 2;                          // the hip itself
    const sin = Math.sin(ang), cos = Math.cos(ang);

    g.save();
    g.translate(Math.round(pivotX), HIP_Y);
    g.rotate(-face * ang);                                   // canvas y is down; forward is -θ
    px(g, -legW / 2, 0, legW, shin, pal.skin);               // thigh, knee, shin
    g.fillStyle = shorts;                                    // shorts over the thigh
    g.fillRect(Math.round(-legW / 2), 0, legW, shortH);
    g.fillStyle = pal.sock;                                  // sock up the shin
    g.fillRect(Math.round(-legW / 2), Math.round(shin - sockH), legW, sockH);
    g.fillStyle = pal.base;                                  // turnover hoop at the sock top
    g.fillRect(Math.round(-legW / 2), Math.round(shin - sockH), legW, 2);
    g.fillStyle = pal.shade;                                 // and the shaded side of the calf
    g.fillRect(Math.round(legW / 2 - 2), Math.round(shin - sockH + 2), 2, sockH - 2);
    g.restore();

    // THE BOOT, drawn as ONE silhouette rather than stacked plates: a tall heel, an instep
    // that falls away over the laces, and a toe that runs out long and LOW along the grass.
    // That profile is what says "football boot" at this size — the old two-rectangle boot had
    // a toe cap as tall as the heel, which is a shoe box, not a boot.
    //
    // It is drawn in its own space with the toe toward +x, then mirrored by the facing, so the
    // away player gets a real mirrored boot instead of one wearing its heel on the wrong end.
    // It hangs off the ANKLE the leg just ended at and only partly follows the leg's angle: a
    // footballer's foot stays pointed along the strike while the shin swings through, and a
    // boot turned the full 70° with the leg is a boot pointing at the floor.
    const s = face;
    const ankleX = pivotX + face * sin * shin;
    const ankleY = HIP_Y + cos * shin;
    g.save();
    g.translate(Math.round(ankleX - face * legW / 2), Math.round(ankleY + bootH - 1));
    g.scale(s, 1);
    g.rotate(-ang * BOOT_FOLLOW);

    const heel = -3;                                         // a little behind the ankle
    const toe = bootL + heel;
    const outline = () => {
      g.beginPath();
      g.moveTo(heel, 0);
      g.lineTo(heel, -bootH + 1);
      g.quadraticCurveTo(heel, -bootH, heel + 2, -bootH);    // rounded heel counter
      g.lineTo(heel + legW + 1, -bootH);
      g.quadraticCurveTo(heel + legW + 4, -bootH, heel + legW + 5, -bootH + 2);
      g.lineTo(toe - 4, -3.5);                               // the instep falling to the toe
      g.quadraticCurveTo(toe, -3, toe, -1.5);                // rounded toe
      g.quadraticCurveTo(toe, 0, toe - 2, 0);
      g.closePath();
    };

    g.strokeStyle = OUTLINE; g.lineWidth = 2; g.lineJoin = 'round';
    outline(); g.stroke();
    g.fillStyle = pal.boot; outline(); g.fill();

    g.save();
    outline(); g.clip();                                     // everything below stays in shape
    g.fillStyle = pal.bootDark;                              // heel counter, darker at the back
    g.fillRect(heel, -bootH, 4, bootH);
    g.fillStyle = pal.bootLight;                             // the side flash, heel to toe
    g.beginPath();
    g.moveTo(heel + 3, -1.5);
    g.lineTo(heel + legW + 3, -bootH + 1);
    g.lineTo(heel + legW + 6, -bootH + 1);
    g.lineTo(heel + 7, -1.5);
    g.closePath(); g.fill();
    g.fillStyle = '#f4f6fb';                                 // sole, running the whole length
    g.fillRect(heel, -2, bootL + 1, 2);
    g.fillStyle = '#ffffff';                                 // laces across the instep
    for (let i = 0; i < 3; i++) g.fillRect(heel + legW + 2 + i * 3, -bootH + 2, 1, 3);
    g.restore();

    g.fillStyle = OUTLINE;                                   // studs, bridging sole to grass
    for (let i = 0; i < 3; i++) g.fillRect(heel + 1 + i * ((bootL - 4) / 3), 0, 2, SOLE_UP);
    g.restore();
  };

  // Back leg plants, front leg swings. The swing is an ANGLE plus an EXTENSION, and between
  // them the toe cap lands near KICK_REACH — the same number the sim strikes the ball from, so
  // the toe really is where the toe-poke happens. Neither alone gets there: 70° of a 10px shin
  // is 9px of reach, and a leg that only grows is a telescope, not a kick.
  leg(-bw * 0.32, -stride, pal.shade);
  leg(bw * 0.02, stride + swing * KICK_SWING, pal.base, swing * KICK_EXTEND);

  // torso — gi body, hard shadow down one side, belt across the waist. Its HEM is what decides
  // how much leg there is to look at: at 0.62 it finished 2px above the boot and the socks the
  // leg is mostly made of were never on screen at all. 0.5 leaves a shin's worth showing.
  const tH = Math.round(bh * 0.5);
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

// THE ARMED AURA. SF2 tells you a special is coming before it lands — the character flashes
// and the air around them moves. That tell matters more than it ever has here: an armed
// player is going to turn their next touch of the ball into a power shot, and the only
// defence is to see it and get to the ball first.
//
// In the FULL BAR's gold, matching the head's glow and the meter, not in the character's
// shot colour — one state, one colour, wherever it is drawn.
function drawAura(g, p) {
  if (p.armed <= 0) return;
  const t = performance.now() / 1000;
  const col = '#ffc400';
  const d = depthPoint(p.x, p.y);                     // on the body it wraps — see drawBody
  const hy = depthPoint(p.x, headY(p)).y;
  g.save();
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.6 + i / 3) % 1;
    g.globalAlpha = (1 - ph) * 0.55;
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(d.x, (hy + d.y) / 2, headR(M, p) * (0.6 + ph * 1.5), C.BODY_H * 1.6 * (0.6 + ph * 1.2), 0, 0, 6.2832);
    g.stroke();
  }
  // sparks rising off the shoulders
  g.globalAlpha = 1;
  for (let i = 0; i < 6; i++) {
    const ph = (t * 2.4 + i / 6) % 1;
    const sx = d.x + Math.sin(i * 2.1 + t * 3) * headR(M, p) * 0.9;
    const sy = d.y - ph * (C.BODY_H + headR(M, p) * 2.2);
    g.fillStyle = i % 2 ? col : '#ffffff';
    g.fillRect(Math.round(sx), Math.round(sy), 3, 5);
  }
  g.restore();
}

function drawBall(g, b) {
  // Inside a net the ball is drawn one step along the goal's width axis, which is what puts
  // it BETWEEN the two side nets rather than flat against the front of the box. Out on the
  // pitch this is the identity — see shared/goalbox.js.
  const d = depthPoint(b.x, b.y);
  g.save();
  g.globalAlpha = .3;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(d.x, C.GROUND_Y + 3, b.r * .9, 5, 0, 0, 6.2832);
  g.fill();
  g.restore();

  // A champion's shot is its own projectile (champ-vfx.js) — the teleport's, between its
  // portals, is no ball at all but the portals themselves.
  if (VFXR.drawBall(g, b)) return;
  if (b.power && b.power.hidden) return;
  g.save();
  g.translate(d.x, d.y);
  const spin = (b.spin || 0) * .12 + b.x * .012;
  g.rotate(spin);
  // The ghost shot is drawn as one: the body it is about to pass through should not be able to
  // tell it apart from a normal power shot by anything but the glow going pale.
  if (b.power && b.power.phantom) g.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 60);
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
  const r = b.r;
  g.fillStyle = '#f6f9ff';
  g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();

  // The panels are a truncated icosahedron seen face-on to one pentagon: the five neighbours
  // sit out along the centre pentagon's corners, one corner pointing back at it, squashed
  // radially because they face away. Clipped to the ball, so the rim cuts them. No seams —
  // at a 12-texel ball a hairline is half a texel and only greys the white.
  g.save();
  g.clip();
  const P = r * .38;
  g.fillStyle = '#1b2436';
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.2832 - 1.5708;
    g.lineTo(Math.cos(a) * P, Math.sin(a) * P);
  }
  g.closePath(); g.fill();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.2832 - 1.5708, ca = Math.cos(a), sa = Math.sin(a);
    const cx = ca * r * .92, cy = sa * r * .92;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const q = Math.PI + k / 5 * 6.2832;               // k=0 is the corner pointing inward
      const u = Math.cos(q) * P * .6, v = Math.sin(q) * P;
      g.lineTo(cx + ca * u - sa * v, cy + sa * u + ca * v);
    }
    g.closePath(); g.fill();
  }
  g.restore();

  // Light does not spin with the ball, so the shading is laid over it unrotated: a lit
  // upper-left, a cool shadowed crescent lower-right, a glint, and a one-texel outline.
  g.rotate(-spin);
  g.fillStyle = ballShade(r);
  g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(-r * .42, -r * .42, r * .16, 0, 6.2832); g.fill();
  g.strokeStyle = '#0e1422';
  g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, r - 1, 0, 6.2832); g.stroke();
  g.restore();
}

// ═══ CHAMPION POWERS, DRAWN ═══════════════════════════════════════════════
// Everything a champion leaves on the pitch is drawn by its own entry in public/vfx/ (see
// champ-vfx.js), read straight off m.champ. Behind the bodies: what stands on the pitch. In
// front: the extra balls, the effects' front layers, and each head's status ring.
function drawChampBack(g) {
  VFXR.drawStageDim(g);
  VFXR.drawEffects(g, 'back');
  VFXR.drawParts(g, 'back');
}

function drawChampFront(g) {
  for (const eb of M.champ.balls) drawBall(g, eb);
  VFXR.drawEffects(g, 'front');
  VFXR.drawParts(g, 'front');
  VFXR.drawStatus(g);
}

let ballShadeCache = null;
function ballShade(r) {
  if (ballShadeCache?.r === r) return ballShadeCache.grad;
  const grad = ctx.createRadialGradient(-r * .4, -r * .4, 0, -r * .1, -r * .1, r * 1.1);
  grad.addColorStop(0, 'rgba(255,255,255,.25)');
  grad.addColorStop(.55, 'rgba(255,255,255,0)');
  grad.addColorStop(.82, 'rgba(60,80,130,.22)');
  grad.addColorStop(1, 'rgba(30,42,80,.45)');
  ballShadeCache = { r, grad };
  return grad;
}

function drawParts(g, front) {
  for (const p of parts) {
    const k = 1 - p.t / p.life;
    // A spark lives in the world like everything else, so one struck inside a net steps into
    // the box with the ball that struck it. Without this, a ball bouncing in the goal throws
    // its sparks 18px to one side of itself, onto the near plane it is no longer on.
    const d = depthPoint(p.x, p.y);
    if (p.k === 'w') {
      if (front) continue;
      g.save();
      g.globalAlpha = k * .8;
      g.strokeStyle = p.color;
      g.lineWidth = 5 * k + 1;
      g.beginPath(); g.arc(d.x, d.y, (1 - k) * 150 + 8, 0, 6.2832); g.stroke();
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
        g.moveTo(d.x, C.GROUND_Y);
        g.quadraticCurveTo(d.x + Math.cos(a) * 70, d.y + 20, d.x + Math.cos(a) * 34, d.y - 40 + Math.sin(a) * 20);
        g.stroke();
      }
      g.restore();
    } else if (front === (p.k === 'c')) {
      g.save();
      g.globalAlpha = k;
      g.fillStyle = p.color;
      g.beginPath(); g.arc(d.x, d.y, p.r * (p.k === 'c' ? 1 : k), 0, 6.2832); g.fill();
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

// EVERY DOM NODE THE FRAME TOUCHES, LOOKED UP ONCE.
//
// drawHeads, paintFaces and syncHud all run on every frame, and between them they used to
// re-query a dozen elements per frame — sixty times a second, for a row of nodes that are
// written in index.html and never replaced. (The innerHTML rewrites in this file are the pick
// grid, the lobby seats, a callout and the tuner body; none of them reach into here, so none of
// these handles can go stale.) The lookups were the work; the writes are what the HUD is for.
//
// Declared above its first user on purpose: these are `const`, so a call that landed before
// this line would hit the temporal dead zone rather than a missing element.
const HUD = {
  s: [$('#s0'), $('#s1')],
  clock: $('#clock'),
  gauge: [$('.gauge.g0'), $('.gauge.g1')],
  gaugeName: [$('.gauge.g0 .nm'), $('.gauge.g1 .nm')],
  face: [$('#face0'), $('#face1')],
  head: [$('#head0'), $('#head1')],
  power: $('#powerBtn'),
  rtt: $('#rtt'),
};

// ---- DOM heads -------------------------------------------------------------
function drawHeads() {
  for (let i = 0; i < 2; i++) {
    const p = M.players[i];
    // The head is a DOM node, so a big-head pickup is a CSS size change, not a canvas one.
    // The card art is repainted at the new size rather than transform-scaled: a scaled-up
    // background is a blurry card, and the whole hook is being able to tell who it is.
    const size = headR(M, p) * 2 * SC;
    const el = HUD.head[i];
    const key = `${p.char.rarity}_${p.char.number}_${Math.round(size)}`;
    if (el.dataset.card !== key) {
      paintHead(el.firstElementChild, p.char.rarity, p.char.number, size);
      el.style.width = el.style.height = size + 'px';
      el.dataset.card = key;
    }
    // Through the same projection as the body, or a player walking into the goal leaves their
    // head behind on the goal line.
    const d = depthPoint(p.x, headY(p));
    const x = OX + d.x * SC, y = OY + d.y * SC;
    const tilt = Math.max(-.34, Math.min(.34, p.vx / 1100)) + (p.stunned > 0 ? p.side * 1.2 : 0);
    el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${tilt}rad)`;
    // ARMED: THE PLAYER GLOWS LIKE A FULL POWER BAR.
    //
    // Deliberately the BAR's gold and not the character's shot colour, which is what this
    // used to be. Armed means "the meter is full and spent the moment I reach the ball", so
    // the head and the meter are saying one thing and they should say it in one colour — see
    // the gaugeReady keyframes in style.css, which this is the head's half of.
    el.classList.toggle('armed', p.armed > 0);
    if (p.armed > 0) el.style.setProperty('--glow', '#ffc400');
    // DAMAGE IS SHOWN ON THE CHARACTER AND NOWHERE ELSE.
    //
    // There is no health bar, no number and no meter anywhere in the HUD — deliberately. The
    // card's own face is the readout: it reddens as the player is worn down and bruises blue
    // when they are nearly out (.head.hurt1..4 in style.css). One class at a time, straight
    // off hurtTier, so the sim and the picture cannot hold different opinions about it.
    //
    // This replaces the three markers that used to live here — `hexed` (the signature effect's
    // green cast), `knocked` (grey) and `slowed` (washed out, with a spinning dashed ring).
    // All three said "this player has been switched off"; these say "this player is hurt".
    const hurt = hurtTier(p.hp);
    for (let t = 1; t <= 4; t++) el.classList.toggle('hurt' + t, hurt === t);
  }
}

// ---- HUD -------------------------------------------------------------------
// THE TWO FACES ON THE SCOREBOARD. Where a Head Soccer scoreboard flies two national flags,
// this one shows the two cards actually being played — which is the same information and a
// better answer, because the card is a thing the player chose.
//
// No new art path and no second copy of "who is player i": the portrait goes through the
// SAME paintHead → head-crop pipeline as the head on the grass and the cards under the
// pitch, reading p.char straight off the match. So a face that is centred in its circle
// down there is centred up here, and a player who swaps card gets a new portrait for free
// on the next frame.
//
// Repainting is keyed on card AND size, so calling this every frame costs one string
// compare per player; the background only gets rewritten when the character or the screen
// actually changed. The size comes from resize() rather than from a measurement here —
// reading a box back mid-frame, after drawHeads has just written transforms, forces a
// synchronous layout sixty times a second.
let FACE_PX = 44;
function paintFaces() {
  if (!M) return;
  for (let i = 0; i < 2; i++) {
    const el = HUD.face[i];
    const { rarity, number } = M.players[i].char;
    const key = `${rarity}_${number}_${FACE_PX}`;
    if (el.dataset.card === key) continue;
    paintHead(el.firstElementChild, rarity, number, FACE_PX);
    el.dataset.card = key;
  }
}

// THE HUD IS WRITTEN SIXTY TIMES A SECOND FOR VALUES THAT CHANGE ONCE.
//
// Assigning .textContent tears the old text node down and builds a new one even when the
// string is identical, and a custom-property write invalidates style for the subtree. Doing
// both unconditionally every frame meant the scoreboard alone dirtied layout on every frame
// of every match — measured at exactly 1.00 layout per frame, for a score that changes a
// handful of times and a clock that changes once a second. Reading these back is cheap
// (inline style and text, no geometry), so each write is now guarded by what is already there.
const txt = (el, v) => { const s = String(v); if (el.textContent !== s) el.textContent = s; };
const prop = (el, k, v) => { if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };

function syncHud() {
  txt(HUD.s[0], M.score[0]);
  txt(HUD.s[1], M.score[1]);
  const clk = HUD.clock;
  // M:SS rather than a bare count of seconds — see clockText. The board is a football
  // scoreboard now and "59" on one is a shirt number.
  txt(clk, clockText(M.clock, M.golden));
  clk.classList.toggle('low', !M.golden && M.clock <= 10);
  paintFaces();
  for (let i = 0; i < 2; i++) {
    const p = M.players[i];
    const gEl = HUD.gauge[i];
    const armed = p.armed > 0;
    // ARMED KEEPS THE BAR FULL. It used to count DOWN while the move was live, because the
    // move WAS the countdown. Now the meter is not spent until the ball is touched, so a
    // draining bar would be lying about what you still have: the bar stays at 100% and the
    // `armed` class is what says "loaded, go and touch the ball".
    //
    // The fill is ONE continuous ramp painted across the whole track and revealed by a
    // clip, rather than a growing box. Growing a box squeezes the gradient into whatever
    // is filled, so the colour under the tip never changes and you get a shorter rainbow
    // instead of a climbing one. Revealing a fixed ramp is what makes the leading edge
    // travel green -> yellow -> orange -> red with nothing to step over.
    prop(gEl, '--p', (p.gauge * 100).toFixed(2) + '%');
    gEl.classList.toggle('full', p.gauge >= 1);
    gEl.classList.toggle('powered', armed);
    const nm = powerName(p);
    txt(HUD.gaugeName[i], armed ? `${nm} ⚡` : nm);
  }
  const me = ONLINE ? NET.you : 0;
  const mine = M.players[me];
  const pb = HUD.power;
  // Lit when a full meter means you can arm, and held lit while you ARE armed — the button
  // is the same thing the head's glow is saying, and it has nothing left to count down.
  pb.classList.toggle('ready', mine.gauge >= 1 && mine.armed <= 0);
  pb.classList.toggle('live', mine.armed > 0);
  txt(pb, mine.armed > 0 ? '⚡' : 'POWER');
  txt(HUD.rtt, ONLINE ? `${NET.rtt}ms` : '');
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
  GAUGE_FULL: [3, 60], POWER_SHOT_SPEED: [800, 3600],
  POWER_SHOT_LIFE: [.4, 4], POWER_SHOT_SAG: [0, 1], POWER_BLOCK_REBOUND: [0, 1],
  POWER_TACKLE_SCALE: [0, 1.5], BODY_DEADEN: [0, 1],
  POWER_STUN: [.2, 3], COUNTER_WINDOW: [40, 320], MATCH_DURATION: [15, 180],
  // jump feel
  COYOTE_TIME: [0, .3], JUMP_BUFFER: [0, .3], FALL_MULT: [1, 3],
  // kick shaping
  LOB_LIFT: [1, 3], LOB_DRIVE: [.2, 1],
  // tackling
  TACKLE_GAUGE: [0, .4], TACKLE_PUSH: [0, 900], TACKLE_LIFT: [0, 600], TACKLE_IMMUNE: [0, 4],
  // damage and health. TACKLE_SLOW / TACKLE_SLOW_TIME / TACKLE_STUN used to sit above; they
  // were the dials on the lockout a hit used to apply, and there is no lockout to dial now.
  // These are what a hit costs instead. No slider prints a health value on the pitch — the
  // tuner is a dev panel behind the gear, not part of the HUD.
  KICK_DAMAGE: [0, .5], KICK_DAMAGE_BACK: [1, 3], POWER_DAMAGE: [0, 1], HP_REGEN: [0, .4],
  HP_STUN_TIME: [1.5, 2], HP_AFTER_STUN: [.1, .9],
  // impact
  HIT_STOP_KICK: [0, .2], HIT_STOP_POWER: [0, .3], HIT_STOP_TACKLE: [0, .2],
  BALL_IDLE_RESET: [2, 20],
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
    if (!RARITIES.includes(r) || !(+n >= 1 && +n <= CARDS_PER_RARITY)) continue;
    // The album gates the URL too. Greying a card out in the picker is not a guard if
    // `?me=legendary_1` walks straight past it — and inside the app this query string is one
    // WebView inspector away. The opponent stays free: choosing who to play against is not a
    // claim to own them.
    if (who === 'me' && !owns(r, +n)) continue;
    pick[who] = { rarity: r, number: +n };
  }
  // (?pickups and ?cards used to switch the two power systems on and off from a URL. Both
  // systems are gone — see archive/README.md — so the flags are gone with them rather than
  // left as links that quietly do nothing.)
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
  // ?arcade opens the board; ?arcade=7 starts stage 7 — if, and only if, it is unlocked.
  else if (q.has('arcade') || q.has('unlockall') || q.has('resetarcade')) {
    // ?unlockall / ?resetarcade — testing links: every stage open, or a fresh campaign, on this device.
    if (q.has('unlockall') || q.has('resetarcade')) {
      PROG = ARC.parseProgress(JSON.stringify({ v: 1, cleared: q.has('unlockall') ? 45 : 0, record: {} }));
      ARC.saveProgress(STORE, PROG);
      ARC_SEL = ARC.currentStage(PROG);
    }
    const n = Number(q.get('arcade'));
    if (!(n && startArcadeStage(n))) openArcade();
  }
})();

// Handy from the console / screenshot harness. MATCH must be a live getter — Object.assign
// would copy the value at boot (null) and every probe would read stale.
// goalBox/depthPoint are here so a harness can ask the SAME geometry the renderer drew with
// where a body in the net should have landed, instead of re-deriving it and drifting.
Object.assign(window, { goalBox, goalAt, depthPoint, INSIDE_Z });
// drawBody, for looking at the sprite itself at a zoom a 79px body can be judged at. The
// boots are 23px long on screen and no screenshot of a match will ever settle whether one
// reads as a football boot — see _bootshots.mjs, which calls this.
Object.assign(window, { drawBody });
Object.assign(window, { C, startMatch, pick, SHOTS, paintHead, callout });
// The arcade, for the harness: the same entry points the buttons use, and the live progress.
Object.assign(window, { startArcadeStage, openArcade, openModes, selectStage, POWERS, CHAMPIONS });
Object.defineProperty(window, 'ARCADE', { get: () => ARCADE });
Object.defineProperty(window, 'ARCADE_PROGRESS', { get: () => PROG });
// The measured head anchors, for the crop tools — see head-crop.js and test-heads.mjs.
Object.defineProperty(window, '__ANCHORS', { get: () => ANCHORS });
Object.assign(window, { headCrop });
Object.defineProperty(window, 'MATCH', { get: () => M });
Object.defineProperty(window, 'HELD', { get: () => held });
Object.defineProperty(window, 'EVENTS', { get: () => EVENT_LOG });
// Which backdrop is live. A getter, not a copy: STAGE is reassigned on every kickoff, so a
// value captured at boot would report the first match forever.
Object.defineProperty(window, 'STAGE', { get: () => STAGE });
Object.defineProperty(window, 'STAGE_POOL', { get: () => POOL.map((s) => s.id) });
