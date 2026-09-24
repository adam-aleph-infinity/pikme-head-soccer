// Client: pick screen, input, fixed-step loop, renderer, live tuner.
// Everything that decides the game lives in /shared; this file only draws it and reads keys.

import * as C from '../shared/constants.js';
import { createMatch, step, headY, headR, NO_FX } from '../shared/sim.js';
import { createBot, botInput, DIFFICULTIES } from '../shared/bot.js';
import { shotFor } from '../shared/hs-powers.js';
import { goalBox, goalAt, depthPoint, INSIDE_Z } from '../shared/goalbox.js';
import { createEditor, applyLayout, applyOpacity, loadOpacity } from './padlayout.js';
import { walkPick, resolveWalk } from './walkpad.js';
import { headCrop } from './head-crop.js';
import { clockText, gaugeView } from './hud.js';
import { createNet } from './net.js';
import { playEvent, SFX, setAudioEnabled, audioEnabled, synth } from './audio.js';
import { STAGES, randomStage, stageById } from './stages.js';
import { DIRECTIONS } from './art-directions.js';
import { CHAMPIONS, TIERS, stageConfig, championForStage } from '../shared/champions.js';
import * as ARC from '../shared/arcade.js';
import { createVfx } from './champ-vfx.js';

// What a Head Soccer power shot looks like: the aura, the cut-in, the comet, the ailments. It
// only watches the match (see champ-vfx.js).
const VFXR = createVfx({ drawBall: (g, b) => drawBall(g, b) });

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
function paintHead(el, r, n, sizePx, opts) {
  // The maths lives in head-crop.js so test-heads.mjs can run it over all 180 anchors. It
  // CLAMPS the window to the card, which the old inline version did not: twenty of the
  // anchors were measured asking for a window bigger than the card or too near an edge, and
  // an unclamped crop shows the card's edge and blank space beyond it — which is why some
  // faces sat off centre on a phone.
  const c = headCrop(anchorFor(r, n), ANCHORS.cardW, ANCHORS.cardH, sizePx, opts);
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
    const shot = shotFor(c);
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

// The stat bars under the pitch: Head Soccer's own five 1–10 stats, straight from the champion
// map (docs/HS-CHAMPION-MAP.md) — speed, jump, kick, dash, power.
const STAT_ROWS = [
  ['מהירות', (c) => c.hs.stats.speed], ['קפיצה', (c) => c.hs.stats.jump], ['בעיטה', (c) => c.hs.stats.kick],
  ['דאש', (c) => c.hs.stats.dash], ['כוח', (c) => c.hs.stats.power],
];
function renderStats(c) {
  const box = $('#arcStats');
  if (!box.children.length) {
    box.innerHTML = STAT_ROWS.map(([name]) => `<div class="arc-stat"><span>${name}</span><i>${'<s></s>'.repeat(10)}</i></div>`).join('');
  }
  STAT_ROWS.forEach(([, f], k) => {
    const n = f(c);
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
  const pw = { icon: c.icon, name: c.powerName, color: c.color, desc: c.desc };
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
  $("#arcStars").textContent = starText(c.hs.stars);
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
    ? `${mine.title} ${mine.icon}`
    : shotFor(pick.me).name;
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
const heldNow = { left: false, right: false, jump: false, kick: false, power: false };
// A PRESS IS NEVER LOST BETWEEN TWO TICKS. The sim samples `held` once per 1/60s tick, and
// only on the frames that run a tick at all — none at all on half the frames of a 120Hz
// screen, none under a frame that ran zero steps. A tap whose down and up both landed between
// two samples (iOS can deliver a quick tap's touchstart and touchend in the same frame) was
// simply never seen. So every press is also remembered until a tick has consumed it: the next
// tick sees the button down at least once, and the sim's own edge test does the rest. Writers
// still just set held[k] = true/false; the Proxy is what notices the press.
const tapped = {};
const held = new Proxy(heldNow, {
  set(t, k, v) { if (v && !t[k]) tapped[k] = true; t[k] = v; return true; },
});
// The input one tick steps with: what is down now, plus anything pressed since the last tick.
function tickInput() {
  const inp = { ...heldNow };
  for (const k in tapped) { inp[k] = true; delete tapped[k]; }
  return inp;
}

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

// `held` is what the sim reads, and it is DERIVED — from the keys that are down and the
// fingers that are on the pad — by syncHeld(), never written directly. Two sources writing
// one flag is how a key gets stuck: a finger lifting used to clear a direction the keyboard
// was still holding, and vice versa.
const keyDown = { left: false, right: false, jump: false, kick: false, power: false };
// When each walk direction was last pressed, by whatever pressed it. Both held at once (→
// with ← on top, two thumbs, a slide that has not let go of the old arrow yet) resolves to
// the most recent — see resolveWalk in walkpad.js.
const walkStamp = { left: 0, right: 0 };
let walkClock = 0;
const WALK = new Set(['left', 'right']);

addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (!keyDown[k] && WALK.has(k)) walkStamp[k] = ++walkClock;   // auto-repeat is not a new press
  keyDown[k] = true;
  syncHeld();
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  keyDown[k] = false;
  syncHeld();
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
// On a phone the pad runs on TOUCH EVENTS, one record per finger keyed by Touch.identifier;
// pointer events drive it only for a mouse or pen (and for a touch screen with no touch
// events at all). The history, because each step was a real bug on Idan's iPhone:
//
//   • pointerleave released a direction while the thumb was still down (it drifts). Fixed by
//     capturing the pointer — which in turn stopped a slide ▶→◀ from ever reaching ◀, fixed by
//     re-hit-testing the walk arrows on every move.
//   • "I can hold ▶, slide to ◀, but sliding back to ▶ it's stuck" — and "I can't hold the
//     arrows". Pointer events on iOS cannot keep a touch: pointerdown.preventDefault() does
//     not stop WebKit's own gesture recognisers (long-press, the loupe, text-selection drag),
//     and touch-action only speaks for pan and zoom. Hold still for a moment, then move, and
//     iOS may take the touch for itself: pointercancel (the direction drops, and the finger
//     is no longer tracked, so nothing it does until it lifts can walk) or simply no more
//     pointermoves (the old direction stays held). And the walk hit-test was the button's own
//     box, so a thumb that rolled a few px high on the way back held NOTHING — measured by
//     _touch-slide.mjs. A non-passive touchstart/touchmove that preventDefault()s is the one
//     thing that tells iOS the page owns this touch; touch events always come back to the
//     element the touch started on, with a stable identifier, until the finger lifts.
//   • THE MAGNIFIER is iOS deciding a long press on a ◀ glyph means "select this text".
//     -webkit-touch-callout, the killed contextmenu and the preventDefault below stop it.
//
// Walk fingers are tracked from the press until the lift, whatever they are over in between,
// and on every move walkPick (walkpad.js) re-asks which arrow the point is nearer to — the gap
// between the arrows is live, a thumb a button-height off the row still walks, a thumb out on
// the pitch holds nothing until it comes back. Jump, kick and power keep the key they landed
// on until the lift: sliding off jump onto kick is a miss, not a change of mind.
const PAD_BTNS = [...document.querySelectorAll('.pad .btn')];
const fingers = new Map();              // 't<Touch.identifier>' | 'p<pointerId>' -> { k, walk, touch }

function syncHeld() {
  const on = { ...keyDown };
  const byFinger = {};
  for (const f of fingers.values()) if (f.k) on[f.k] = byFinger[f.k] = true;
  Object.assign(on, resolveWalk(on, walkStamp));
  for (const k of Object.keys(held)) held[k] = !!on[k];
  // Lit = a finger is on it AND it is the direction that won, so a thumb can see which one
  // the game heard.
  for (const b of PAD_BTNS) b.classList.toggle('on', !!(byFinger[b.dataset.k] && held[b.dataset.k]));
}

function setFinger(id, k, init) {
  let f = fingers.get(id);
  if (!f) fingers.set(id, f = { k: null, walk: false, touch: false, ...init });
  if (k && k !== f.k && WALK.has(k)) walkStamp[k] = ++walkClock;
  f.k = k;
  syncHeld();
}
function dropFinger(id) { if (fingers.delete(id)) syncHeld(); }

// The two arrows' boxes, read when a walking finger goes down and kept for its gesture (a
// layout cannot change mid-press). A pressed arrow is drawn at scale(.94); that is undone
// here so the plate is the arrow's real footprint, not the shrunk one.
let walkRects = null;
function readWalkRects() {
  const box = (b) => {
    if (!b) return null;
    const q = b.getBoundingClientRect();
    if (!q.width || !q.height) return null;
    const pressed = b.classList.contains('on') || b.matches(':active');
    const gx = pressed ? q.width * (1 / 0.94 - 1) / 2 : 0, gy = pressed ? q.height * (1 / 0.94 - 1) / 2 : 0;
    return { left: q.left - gx, top: q.top - gy, right: q.right + gx, bottom: q.bottom + gy };
  };
  const l = box(document.querySelector('.pad .btn[data-k="left"]'));
  const r = box(document.querySelector('.pad .btn[data-k="right"]'));
  return l && r ? { l, r } : null;
}
const pickAt = (x, y, opt) => (walkRects ? walkPick(x, y, walkRects.l, walkRects.r, opt) : null);
const editing = () => !!(EDITOR && EDITOR.editing);

// ── TOUCH ────────────────────────────────────────────────────────────────────
const HAS_TOUCH_EVENTS = 'ontouchstart' in window;
// Where a touch that did not land on a button may still start a walk (the plate between and
// around the arrows): the pitch itself, never a menu, the HUD's buttons or a dialog.
const onPitch = (el) => !!(el && el.closest && el.closest('#stage') && !el.closest('button, a, input, label, select'));
const tid = (t) => 't' + t.identifier;
// Any finger we think is down that the glass no longer reports is gone — a touchend the OS
// swallowed (a notification, a system gesture) must not leave its key held.
function reconcile(ev) {
  const live = new Set([...ev.touches].map(tid));
  let changed = false;
  for (const [id, f] of fingers) if (f.touch && id[0] === 't' && !live.has(id)) { fingers.delete(id); changed = true; }
  if (changed) syncHeld();
}

addEventListener('touchstart', (ev) => {
  if (editing()) return;              // the layout editor drives its own drags (pointer events)
  reconcile(ev);
  let mine = false;
  for (const t of ev.changedTouches) {
    const btn = t.target && t.target.closest ? t.target.closest('.pad .btn') : null;
    let k = null;
    if (btn) {
      k = btn.dataset.k;
      if (WALK.has(k)) walkRects = readWalkRects();
    } else if (onPitch(t.target)) {
      walkRects = readWalkRects();
      k = pickAt(t.clientX, t.clientY, { start: true });
    }
    if (!k) continue;
    mine = true;
    setFinger(tid(t), k, { walk: WALK.has(k), touch: true });
  }
  // THE line: this touch is the page's. No long-press, loupe, selection, scroll or zoom, and
  // no pointercancel stealing it back half way through a hold.
  if (mine && ev.cancelable) ev.preventDefault();
}, { passive: false });

addEventListener('touchmove', (ev) => {
  let mine = false;
  for (const t of ev.changedTouches) {
    const f = fingers.get(tid(t));
    if (!f) continue;
    mine = true;
    if (!f.walk || editing()) continue;
    const k = pickAt(t.clientX, t.clientY, { cur: f.k });
    if (k !== f.k) setFinger(tid(t), k);
  }
  if (mine && ev.cancelable) ev.preventDefault();
}, { passive: false });

const touchUp = (ev) => {
  let mine = false;
  for (const t of ev.changedTouches) if (fingers.has(tid(t))) { mine = true; dropFinger(tid(t)); }
  reconcile(ev);
  // Cancelling the lift of a pad touch stops the synthetic click/mouse events that would
  // otherwise follow it onto whatever is under the button.
  if (mine && ev.cancelable && ev.type === 'touchend') ev.preventDefault();
};
addEventListener('touchend', touchUp, { passive: false });
addEventListener('touchcancel', touchUp, { passive: false });

// ── MOUSE / PEN (and touch on an engine without touch events) ────────────────
// Same books, keyed 'p<pointerId>'. Captured on down, so a drag off the button still ends
// here; walk pointers re-pick on every move exactly as a walking finger does.
const pid = (ev) => 'p' + ev.pointerId;
for (const btn of PAD_BTNS) {
  btn.addEventListener('pointerdown', (ev) => {
    if (editing()) return;            // while the layout is being edited a press MOVES the button
    if (ev.pointerType === 'touch' && HAS_TOUCH_EVENTS) return;   // the touch handlers own it
    ev.preventDefault();
    const k = btn.dataset.k;
    if (WALK.has(k)) walkRects = readWalkRects();
    setFinger(pid(ev), k, { walk: WALK.has(k), touch: ev.pointerType === 'touch' });
    try { btn.setPointerCapture(ev.pointerId); } catch { /* older engines: harmless */ }
  });
  // A capture taken away (a system gesture) is a lift for jump/kick/power. A walk pointer is
  // followed by position, not by the capture, so losing it there is not a release.
  btn.addEventListener('lostpointercapture', (ev) => {
    const f = fingers.get(pid(ev));
    if (f && !f.walk) dropFinger(pid(ev));
  });
  btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
addEventListener('pointermove', (ev) => {
  const f = fingers.get(pid(ev));
  if (!f || !f.walk || editing()) return;
  const k = pickAt(ev.clientX, ev.clientY, { cur: f.k });
  if (k !== f.k) setFinger(pid(ev), k);
}, { passive: true });
const pointerUp = (ev) => dropFinger(pid(ev));
addEventListener('pointerup', pointerUp);
addEventListener('pointercancel', pointerUp);

// Anything that takes the page away — a notification, the app backgrounding, a phone call,
// alt-tab — lifts every finger and every key. Without this the last direction stays held.
const releaseAll = () => {
  fingers.clear();
  for (const k of Object.keys(keyDown)) keyDown[k] = false;
  walkRects = null;
  syncHeld();
};
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
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
  // Every finger and key, or one that was on an arrow when the editor opened stays in the
  // books and holds a key nobody is pressing.
  releaseAll();
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
      // `stale`: the server runs a newer protocol than this cached page (see PROTOCOL in
      // shared/net.js). Nothing here can fix that, so say so and fetch the new build.
      if (code === 'stale') {
        $('#lobbyHint').textContent = 'גרסה חדשה — טוען מחדש…';
        setTimeout(() => location.reload(), 1000);
        return;
      }
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
  vsSlack = 0; for (const k in tapped) delete tapped[k];   // nothing carried in from the menus

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

// What a player's power shot is called (its champion's theme, or its family's name).
const powerName = (p) => p.shot.name;

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
    playEvent(e.type === 'strike' ? (e.head ? 'head' : 'kick') : e.type);
    VFXR.onEvent(e);
    // NO WORDS FOR A POWER SHOT. Head Soccer puts no text on the press, the cut-in, the shot, a
    // block or a counter (docs/HS-POWER-SHOTS.md §2) — the picture says it (champ-vfx.js). The
    // GOAL! banner is the sim's (drawReady).
    if (e.type === 'tackle') {
      fx.shockwave(e.x, e.y, '#ffd166');
      // No '+כוח' in it: a tackle pays no power (the gauge is a clock), and saying so on every
      // boot to the shins was the bar "filling when I kick" that Idan reported.
      if (e.by === (ONLINE ? NET.you : 0)) banner('פגיעה!', '#ffd166');
    }
    else if (e.type === 'ballReset') banner('כדור חדש', '#8ea0be');
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
// VSYNC SNAP. The sim ticks at exactly 60Hz and the screen refreshes at ~60 (or 120), so the
// fixed-step accumulator sits at a constant phase — unless the frame timestamps jitter. Safari
// coarsens them to 1ms (16, 17, 17, 16…), and whenever that phase sits within a jitter of a tick
// boundary the loop runs 0 steps on one frame and 2 on the next: the same picture twice, then a
// jump. Modelled with 1ms-quantised stamps that is ~50 such hitches a minute at 60Hz and ~170 at
// 120Hz (headless Chrome on main showed 77 in 15s); snapped, ~1. A frame within 4ms of a whole
// number of ticks (or half a tick, for 120Hz) counts as exactly that. What the snap takes away
// is kept in `vsSlack` and paid back once it reaches half a tick, so the clock never drifts —
// the jitter cancels out by itself, and only a real refresh rate that is not 60 costs a step.
let vsSlack = 0;
function vsyncDt(dt) {
  for (const k of [0.5, 1, 2, 3]) {
    const q = C.TICK * k;
    if (Math.abs(dt - q) < Math.min(0.004, q / 4)) { vsSlack += dt - q; dt = q; break; }
  }
  if (Math.abs(vsSlack) >= C.TICK / 2) { dt = Math.max(0, dt + vsSlack); vsSlack = 0; }
  return dt;
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!M) return;

  if (running) {
    const simDt = vsyncDt(dt);
    if (ONLINE) {
      // The net module owns the tick clock online: it has to replay from whatever tick a
      // snapshot lands on, so a second accumulator here would fight it.
      const m = NET.advance(simDt, tickInput, fx);
      if (m) { M = m; drainEvents(); }
    } else {
      acc += simDt;
      // window.SIM_HOLD: a screenshot harness steps the match itself (_vfx-shots.mjs).
      if (window.SIM_HOLD) acc = 0;
      let guard = 0;
      while (acc >= C.TICK && guard++ < 8) {
        // ?solo=1 (or window.BOT_OFF) leaves the opponent standing still. It exists for two
      // reasons: practising a shot without being harassed, and making the screenshot
      // harness deterministic — every probe there was racing a bot that could score,
      // freeze the match and reset positions between one await and the next.
      const foe = window.BOT_OFF ? {} : botInput(BOT, M, 1, C.TICK);
        step(M, [tickInput(), foe], C.TICK, fx);
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

// HOW MUCH SKY. The camera used to crop up to 34px off the top of the 530px world to fill a
// phone's width, which left 401px of sky over the grass on an 844x390 phone. Head Soccer shows
// 487 (C.VIEW_ABOVE_GROUND, off Idan's recordings: the grass at frame y 489 of 590, and the
// ball flies over the HUD), so every header or lob between 401 and 487 up vanished here and
// stayed on screen there — "the ball goes too far up and hides". The fit now always keeps
// VIEW_ABOVE_GROUND of sky, and the canvas reaches ABOVE world y=0 to draw it (SKY_TOP).
// A phone pays in width: the pitch renders ~18% smaller than it did, with sky-coloured bars at
// the sides — the same trade HS makes, whose pitch also leaves bars on a 2.16:1 screen.
//
// SKY_TOP: world px of canvas above y=0. Even, so the world origin stays on a texel (PIXEL 2).
const skyTop = () => Math.max(0, 2 * Math.ceil((C.VIEW_ABOVE_GROUND - C.GROUND_Y) / 2));
let SKY_TOP = skyTop();              // re-read on resize: GROUND_Y is live-tunable

// Decorative grass drawn BELOW the world, never simulated and never reachable. It exists so
// that lifting the pitch above the controls does not leave a void under it: the pitch ends
// where the sim says it ends, and the green simply keeps going behind the buttons.
const BLEED = 170;

function resize() {
  const vw = innerWidth, vh = innerHeight;
  SKY_TOP = skyTop();
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
  const scale = Math.min(vw / C.W, (vh - band) / C.VIEW_ABOVE_GROUND);
  const w = C.W * scale, h = (SKY_TOP + C.H + BLEED) * scale;

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
    el.style.top = (OY - SKY_TOP * scale) + 'px';     // the canvas starts SKY_TOP above y=0
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
    el.height = Math.ceil((SKY_TOP + C.H + BLEED) / PIXEL);
    c.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, SKY_TOP / PIXEL);   // draw in WORLD units, land on texels
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
      const d = ctx.getImageData(2, SKY_TOP / PIXEL + 2, 1, 1).data;   // raw pixels: below the sky strip
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
  g.clearRect(0, -SKY_TOP, C.W, SKY_TOP + C.H + BLEED);
  // A frozen frame on its own just looks like a dropped frame. A couple of pixels of shake
  // during hit-stop is what turns it into an impact.
  // Not under a cut-in: that pause is 1.34s long, and 80px of shake is not an impact.
  const shake = M.hitStop > 0 && !(M.cutin > 0) ? M.hitStop * 60 : 0;
  if (shake > 0) {
    g.save();
    g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  }
  drawStadium(g);
  paintLetterbox();
  // THE GOAL IS A BOX AND THE BODIES GO INSIDE IT. Everything between these two calls is
  // drawn in the goal's interior when it is in one: behind the near net, in front of the far
  // one. See drawGoalBack / drawGoalFront and shared/goalbox.js.
  drawGoalBack(g, true);
  drawGoalBack(g, false);
  // Dash afterimages first, so the player is drawn over their own trail. GHOSTS is read again
  // by drawHeads for the head copies.
  // On a clock that stops during a hit-stop, so a freeze-frame freezes the trail with it.
  const wall = performance.now() / 1000;
  if (!(M.hitStop > 0)) TRAIL_CLOCK.t += Math.min(0.1, Math.max(0, wall - TRAIL_CLOCK.wall));
  TRAIL_CLOCK.wall = wall;
  const now = TRAIL_CLOCK.t;
  for (const p of M.players) {
    trackTrail(p, now);
    GHOSTS[p.index] = trailGhosts(p, now);
    for (let k = GHOSTS[p.index].length - 1; k >= 0; k--) {
      const q = GHOSTS[p.index][k];
      g.save(); g.globalAlpha = q.alpha; drawBody(g, q, true); g.restore();
    }
  }
  for (const p of M.players) drawBody(g, p);
  drawParts(g, false);
  drawBall(g, M.ball);
  for (const eb of M.xballs) drawBall(g, eb);      // a Multi-Ball's extras
  VFXR.drawOver(g);                                // a block's grind, a hit's sparks, the Aerial's warning
  drawBallMarker(g, M.ball);
  drawParts(g, true);
  drawGoalFront(g, true);            // the net you look through, over whatever is in the goal
  drawGoalFront(g, false);
  if (shake > 0) g.restore();
  if (flashT > 0) {
    g.save();
    g.globalAlpha = (flashT / flashLife) * 0.75;
    g.fillStyle = flashCol;
    g.fillRect(0, -SKY_TOP, C.W, SKY_TOP + C.H);
    g.restore();
  }
  drawHeads();
  drawHeadNet();                     // …and the near net again, over a head that is in the goal
  drawOverHeads(ctxNet);             // YOU at kickoff, stars over a stunned head
  // Over the heads (they are DOM nodes under this layer): the armed tongues, what a shot left on
  // a player, and the cut-in — the whole screen darkens but the shooter (champ-vfx.js).
  for (const p of M.players) VFXR.drawArmed(ctxNet, p);
  VFXR.drawOverlay(ctxNet);
  VFXR.drawCutin(ctxNet);
  if (M.banner && M.bannerT > 0 && M.phase !== 'over') drawReady(g);
}

// THE BALL ABOVE THE PICTURE. The camera keeps Head Soccer's 487px of sky, but the ceiling is
// higher than that (C.CEIL_Y), so a skied ball can still leave the top — in HS too, ~4% of live
// play. HS simply clips it; here a small chevron sits on the top edge under the ball's x so you
// can still read where it will come down. Subtle on purpose: it fades as the ball climbs away.
// (Not for an Aerial power shot waiting up there: its warning streaks say where it comes down.)
function drawBallMarker(g, b) {
  if (M.ballWait > 0 || (b.power && (b.power.ph === 'up' || b.power.ph === 'wait'))) return;
  // The world y the viewer's top edge shows: the canvas top, or lower when the stage is taller
  // than the canvas is wide enough to fill (then the canvas top is the edge).
  const top = Math.max(-SKY_TOP, SC > 0 ? -OY / SC : -SKY_TOP);
  if (b.y + b.r >= top) return;
  const s = 10;                      // world px: ~6 CSS px on an 844x390 phone
  const x = Math.max(s + 4, Math.min(C.W - s - 4, b.x)), y = top + 3;
  g.save();
  g.globalAlpha = Math.max(0.35, 0.8 - (top - b.y) / 400);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + s, y + s);
  g.lineTo(x - s, y + s);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = OUTLINE;
  g.stroke();
  g.restore();
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
  ctxNet.clearRect(0, -SKY_TOP, C.W, SKY_TOP + C.H + BLEED);
  for (const p of M.players) {
    const h = depthPoint(p.x, headY(p));
    // Exactly the head's own shape. Wider and the wash would land on pixels the main canvas
    // has already washed, and a second 10% would ring the head in a darker halo.
    const rx = headR(M, p) * HEAD_W, ry = headR(M, p) * HEAD_H, r = rx;
    for (const left of [true, false]) {
      const box = goalBox(left);
      // The whole box, all four uprights: the near pair sit at wallX/lineX and the far pair
      // one width-step inward, and which of those is leftmost flips between the two goals.
      const xs = [box.wallX, box.wallX + box.wx, box.lineX, box.lineX + box.wx];
      if (h.x + r < Math.min(...xs) || h.x - r > Math.max(...xs) || h.y + r < box.top + box.wy) continue;
      ctxNet.save();
      ctxNet.beginPath();
      for (const [u, v] of HEAD_SHAPE) ctxNet.lineTo(h.x + (u - 0.5) * 2 * rx, h.y + (v - 0.5) * 2 * ry);
      ctxNet.closePath();                                  // the drawn head's own outline
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
  // The strip above world y=0 (SKY_TOP) is sky the stage art does not reach: carry on its top
  // colour, the same sample the letterbox bars are painted with.
  if (SKY_TOP > 0 && barSky) R2(g, 0, -SKY_TOP, C.W, SKY_TOP + 1, barSky);

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


// THE BODY UNDER THE HEAD, drawn the way a Head Soccer character is built — see
// docs/HS-CHARACTER-LOOK.md for the frames this was measured from. HS has no gi, no arms and no
// legs: under the head there is a small dark suit with a coloured collar peeking out below the
// chin, and two chunky boots. The whole body is barely more than a quarter of a head tall, and
// that is the proportion that makes it read as HS — the head is the character, the rest is a
// pedestal with feet. (Ours, not theirs: the suit, collar and boots are drawn here from paths;
// nothing is traced from an HS sprite.)
//
// The canvas is half resolution (PIXEL 2), so one texel is 2 world px. HS's own sprites sit on
// almost the same grid — its head is ~24 native pixels tall, ours is 26 texels — so every
// keyline here is ONE texel, the way HS's is.
const OUTLINE = '#0b0710';
// Team colour lives in the COLLAR (and the YOU bubble), not in a ring round the head: HS keeps
// the head clean and puts the kit colour under the chin.
const KIT = [
  { collar: '#3d8bff', collarDark: '#1c4fb4' },
  { collar: '#ff4a64', collarDark: '#a3182f' },
];
// The rim light — HS edges its dark suit and boots with a thin gold line on the back. Ours takes
// the colour of the card's rarity, so a legendary is trimmed in gold and a common in silver.
const TRIM = { legendary: '#ffcc33', epic: '#d08cff', rare: '#6fd0ff', common: '#c8d0da' };
const SUIT = '#1f2130', SUIT_LIGHT = '#3b4058';
const BOOT = '#16171e', BOOT_LIGHT = '#555b73';
// Measured sizes, in world px on the 26.4 head (HS M4 29.68 s, standing, full resolution):
// the boot is about one head RADIUS long and half a radius tall, the two boots together span
// 1.7 radii, and the body shows 0.57 radii below the chin.
const BOOT_L = 25, BOOT_H = 14;
const BOOT_BACK = -10, BOOT_FRONT = 11;             // boot centres, standing, along the facing
const SUIT_W = 30, SUIT_BOT = -7;                  // the suit sits down inside the boots

// THE KICK, as HS animates it (M4 29.68–31.96 s, every frame): no leg ever shows. The front boot
// leaves the body and rides up in front of the face — low and forward on the first frame, at
// face height by the fourth, then HELD high, toe up, for the rest of the swing, and snapped back
// in a frame. Keyframes are [progress through KICK_TIME, forward, up, toe-up angle], in head
// radii off the feet. HS's first frame is 0.95 R forward; this starts at 1.2 so the toe reaches
// the edge of the sim's kick circle (KICK_REACH − KICK_R) — the boot must look able to touch
// the ball it touches.
const KICK_KEYS = [
  [0.00, 1.20, 0.30, -0.25],
  [0.07, 1.42, 0.70, 0.30],
  [0.13, 1.60, 1.10, 0.65],
  [0.20, 1.70, 1.45, 0.95],
  [0.32, 1.76, 1.95, 1.20],
  [0.55, 1.76, 2.10, 1.30],
  [0.92, 1.72, 2.05, 1.30],
  [1.00, 1.00, 0.60, 0.40],
];
function kickPose(k) {
  let i = 0;
  while (i < KICK_KEYS.length - 2 && k > KICK_KEYS[i + 1][0]) i++;
  const a = KICK_KEYS[i], b = KICK_KEYS[i + 1];
  const u = Math.max(0, Math.min(1, (k - a[0]) / (b[0] - a[0])));
  return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}

// One boot, toe toward +x in its own space, sole on y = 0. A clog, not a football boot: flat
// sole, a round toe, and the upper swelling highest at the ankle — the chunky shape that still
// reads at 13 texels long.
function bootPath(g) {
  const L = BOOT_L / 2, H = BOOT_H;
  g.beginPath();
  g.moveTo(-L + 3, 0);
  g.lineTo(L - 4, 0);
  g.quadraticCurveTo(L + 1, 0, L + 1, -4);
  g.quadraticCurveTo(L + 1, -H * 0.72, L - 7, -H * 0.8);    // round toe cap
  g.lineTo(-1, -H * 0.86);
  g.quadraticCurveTo(-L + 1, -H * 1.05, -L, -H * 0.5);      // high ankle, rounded heel
  g.quadraticCurveTo(-L, 0, -L + 3, 0);
  g.closePath();
}
function drawBoot(g, x, y, face, ang, trim) {
  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  g.rotate(-ang);
  // No clip (a clip per boot per frame is the expensive kind of canvas call on a phone): the
  // details are placed inside the shape, and the keyline goes on LAST and covers the texel of
  // slack at their ends.
  bootPath(g);
  g.fillStyle = BOOT; g.fill();
  g.fillStyle = BOOT_LIGHT;                                  // the sheen across the upper
  g.fillRect(-5, -BOOT_H * 0.8, 10, 2);
  g.fillStyle = trim;                                        // rim light down the heel
  g.fillRect(-BOOT_L / 2 + 1, -BOOT_H * 0.72, 2, BOOT_H * 0.5);
  g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = OUTLINE; g.stroke();
  g.restore();
}

// The ground shadow — HS draws a soft dark ellipse about as wide as the head under every
// player, and leaves it on the grass when they jump, a little smaller and fainter the higher
// they go. It is the only thing that tells you how high a jumping head is.
function drawShadow(g, p) {
  const s = depthPoint(p.x, C.GROUND_Y);
  const k = Math.max(0, Math.min(1, (C.GROUND_Y - p.y) / 130));
  g.save();
  g.globalAlpha = 0.42 * (1 - 0.45 * k);
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(s.x, s.y + 1, C.HEAD_R * 1.5 * (1 - 0.3 * k), C.HEAD_R * 0.24 * (1 - 0.3 * k), 0, 0, 6.2832);
  g.fill();
  g.restore();
}

function drawBody(g, p, ghost = false) {
  const kit = KIT[p.index] || KIT[0];
  const trim = TRIM[p.char && p.char.rarity] || TRIM.legendary;
  const R = C.HEAD_R;
  // Projected at the FEET, which is the anchor the whole sprite hangs off.
  const d = depthPoint(p.x, p.y);
  if (!ghost) drawShadow(g, p);

  g.save();
  g.translate(Math.round(d.x), Math.round(d.y));
  // Facing: `side`, the goal this player attacks — which is also the opponent. HS characters
  // face the other player the whole match, running backwards included, and the sim latches the
  // kick to the same rule (kickDir), so the boot that swings is the boot that can reach.
  const face = p.side;
  // KNOCKED BACK (HS M4 61.9 s): the whole character tips back ~25° away from the hit, head
  // included, and is carried backwards through the air. Pivoted at the neck so the body stays
  // under the head, which means the boots swing out forward — the "feet taken out" look.
  if (p.stunned > 0) {
    g.translate(0, -C.BODY_H);
    g.rotate(-face * 0.45);
    g.translate(0, C.BODY_H);
  }
  const air = !p.onGround;
  const kicking = p.kickT > 0;
  // THE RUN: the boots shuffle, alternating a few px fore and aft with a small lift — HS's
  // walk cycle is a pair of feet paddling under a head that does not bob or lean.
  const run = !air && Math.abs(p.vx) > 20 ? Math.min(1, Math.abs(p.vx) / C.PLAYER_SPEED) : 0;
  const ph = performance.now() / 1000 * Math.PI * 2 / 0.28;
  const sw = Math.sin(ph) * 4 * run, lift = Math.max(0, Math.cos(ph)) * 3 * run;

  // back boot
  if (air) drawBoot(g, face * (BOOT_BACK - 4), -1, -face, -0.45, trim);      // splayed: toe out, down
  else drawBoot(g, face * (BOOT_BACK - sw), -lift * (sw < 0 ? 1 : 0), face, 0, trim);

  // the suit: a rounded dark body, collar in the team colour just under the chin, and the
  // rim-light trim down its back edge
  const top = -C.BODY_H, h = SUIT_BOT - top;
  roundRect(g, -SUIT_W / 2, top, SUIT_W, h, 8);
  g.fillStyle = SUIT; g.fill();
  g.fillStyle = SUIT_LIGHT;                                  // lit front
  g.fillRect(face > 0 ? 3 : -11, top + 8, 8, h - 10);
  g.fillStyle = trim;                                        // rim light on the back
  g.fillRect(face > 0 ? -SUIT_W / 2 + 1 : SUIT_W / 2 - 3, top + 7, 2, h - 10);
  // The collar, just under the chin: the head is drawn 7% taller than its hitbox (HEAD_H), so
  // the chin is 15 px off the grass and the collar sits in the first texels below it.
  g.fillStyle = kit.collarDark;
  g.fillRect(-9, top + 8, 18, 6);
  g.fillStyle = kit.collar;
  g.fillRect(-7, top + 9, 14, 3);
  roundRect(g, -SUIT_W / 2, top, SUIT_W, h, 8);
  g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();

  // front boot — or the kick
  if (kicking) {
    const k = 1 - p.kickT / C.KICK_TIME;
    const [fx, fy, ang] = kickPose(k);
    // the swoosh: a faint arc behind the rising boot, only while it is climbing
    if (k < 0.3 && !ghost) {
      g.save();
      g.globalAlpha = 0.5 * (1 - k / 0.3);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -R * 0.2, R * 1.9, face > 0 ? -0.95 : Math.PI - 0.2, face > 0 ? 0.2 : Math.PI + 0.95);
      g.stroke();
      g.restore();
    }
    drawBoot(g, face * fx * R, -fy * R + BOOT_H / 2, face, ang, trim);
  } else if (air) {
    drawBoot(g, face * (BOOT_FRONT + 3), -1, face, -0.45, trim);           // splayed: toe down
  } else {
    drawBoot(g, face * (BOOT_FRONT + sw), -lift * (sw > 0 ? 1 : 0), face, 0, trim);
  }
  g.restore();
}

// THE DASH AFTERIMAGES (HS M4 57.9 s and 66.4 s): two see-through copies of the whole
// character strung out behind a dash, fading over about six frames after it ends. The body copy
// is drawn here from a short position history; the head copies are DOM clones — see drawHeads.
const TRAIL = [{ hist: [], until: 0 }, { hist: [], until: 0 }];
// HS's copies overlap the player by more than half a head — two of them, close behind.
const TRAIL_AGES = [0.02, 0.045];                            // s behind the player
const TRAIL_ALPHA = [0.45, 0.25];
const GHOSTS = [[], []];
const TRAIL_CLOCK = { t: 0, wall: 0 };
function trackTrail(p, now) {
  const tr = TRAIL[p.index];
  tr.hist.push({ now, x: p.x, y: p.y, onGround: p.onGround, vx: p.vx, kickT: p.kickT });
  while (tr.hist.length > 2 && now - tr.hist[0].now > 0.2) tr.hist.shift();
  const dashing = !(p.stunned > 0) && (p.dashT > 0 || Math.abs(p.vx) > C.PLAYER_SPEED * 1.8);
  if (dashing) tr.until = now + 0.12;
}
// The ghost poses for player i right now: [{x, y, ..., alpha}], empty when there is no trail.
function trailGhosts(p, now) {
  const tr = TRAIL[p.index];
  if (now >= tr.until) return [];
  const fade = Math.min(1, (tr.until - now) / 0.12 * 0.65 + 0.35);
  const out = [];
  TRAIL_AGES.forEach((age, i) => {
    let best = null;
    for (const h of tr.hist) if (!best || Math.abs(now - h.now - age) < Math.abs(now - best.now - age)) best = h;
    if (best && Math.abs(best.x - p.x) > 6) out.push({ ...p, ...best, stunned: 0, alpha: TRAIL_ALPHA[i] * fade });
  });
  return out;
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
  // After a goal the ball is not on the pitch until it drops in (m.ballWait, HS's 0.555s).
  if (M.ballWait > 0 && b === M.ball) return;
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

  // A POWER BALL is the plain ball at the nose of its family's comet (champ-vfx.js draws the
  // comet under it, docs/HS-POWER-SHOTS.md §3). An Aerial up off the top of the screen is not drawn.
  if (VFXR.drawBall(g, b)) return;
  g.save();
  g.translate(d.x, d.y);
  const spin = (b.spin || 0) * .12 + b.x * .012;
  g.rotate(spin);
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

// THE BANNERS, timed by the sim (m.banner / m.bannerT): KICK OFF for the 2.17s the kickoff
// holds, GOAL! for the 2.05s after a goal (HS M3/M4). They are presentation, but HS times its
// restarts off them, so they live on the match clock rather than on a CSS animation.
function drawReady(g) {
  if (M.banner === 'goal') {
    // Only the pre-kickoff freeze dims the pitch. Blacking out the post-goal freeze too hid
    // the one moment the game is showing off — the celebration.
    const col = M.lastScorer === 0 ? '#4ea0ff' : '#ff5c7a';
    const t = C.GOAL_BANNER - M.bannerT;                  // seconds since the goal
    const pop = t < 0.18 ? 0.6 + 0.4 * (t / 0.18) + 0.25 * Math.sin((t / 0.18) * Math.PI) : 1;
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // The page is right-to-left (Hebrew), and a canvas inherits that: 'GOAL!' came out '!GOAL'.
    g.direction = 'ltr';
    // Under the scoreboard, not on it: at the KICK OFF line a 72px GOAL! sat on the score digits.
    g.translate(C.W / 2, C.H * 0.35);
    g.scale(pop, pop);
    g.font = '900 64px -apple-system, Arial';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = OUTLINE;
    g.strokeText('GOAL!', 0, 0);
    g.fillStyle = col;
    g.fillText('GOAL!', 0, 0);
    g.restore();
    return;
  }
  if (M.phase !== 'kickoff') return;
  g.save();
  g.fillStyle = '#000000b0';
  g.fillRect(0, -SKY_TOP, C.W, SKY_TOP + C.H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const txt = 'KICK OFF';
  g.direction = 'ltr';
  g.font = '900 46px -apple-system, Arial';
  g.lineJoin = 'round';
  g.lineWidth = 8;
  g.strokeStyle = OUTLINE;
  g.strokeText(txt, C.W / 2, C.H * 0.30);
  g.fillStyle = '#ffd23c';
  g.fillText(txt, C.W / 2, C.H * 0.30);
  g.direction = 'inherit';                 // the Hebrew control rows below keep the page's RTL

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
// THE HEAD IS A HEAD SOCCER SHAPE, NOT A COIN. HS's head sprite is 62 px wide and 56-57 tall on
// the 1280 frame (M3 6.8 s, M4 29.98 s, full resolution) around a 52.8 px head: a wide cartoon
// head — dome on top, full cheeks, a flat chin sitting on the collar — with one thick near-black
// keyline round it. So ours is drawn HEAD_W x HEAD_H of the hitbox diameter, in that silhouette
// (the polygon in style.css), with the card face zoomed until face and hair FILL it. The sim
// never sees any of this: its head is still the 26.4 circle, and the drawn one overhangs it a
// few px at the cheeks and chin exactly as HS's hair and cheeks overhang its own.
// Drawn at exactly the hitbox, the body showed 17 px under the chin (3.1:1 head to body) where
// HS shows 15 (3.8:1); a 1.07 height puts the chin 15 px off the grass.
const HEAD_W = 1.17, HEAD_H = 1.07;
// The silhouette, as points in a unit box (0..1 across, 0..1 down): a superellipse that is
// ROUND on top (exponent 2.1, a dome) and squarer below (2.9: full cheeks and a flat chin),
// widest a little below the middle, the jaw drawn in a touch at the bottom corners. One list, two users: the CSS clip-path on
// the DOM head (--head-shape) and the canvas path the near net is clipped to (drawHeadNet).
const HEAD_SHAPE = (() => {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    const n = s < 0 ? 2.1 : 2.9;
    let x = Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = Math.sign(s) * Math.abs(s) ** (2 / n);
    x *= 1 - 0.1 * Math.max(0, y) ** 2;
    // the widest line sits BELOW the middle: a tall dome, then the cheeks and a short flat jaw
    pts.push([0.5 + x / 2, 0.56 + y * (y < 0 ? 0.56 : 0.44)]);
  }
  return pts;
})();
document.documentElement.style.setProperty('--head-shape',
  `polygon(${HEAD_SHAPE.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(',')})`);
// The crop for that shape (head-crop.js opts): 1.35x tighter than the measured head, and the
// window lifted a tenth of a head so there is hair over the brow and the chin reaches the flat
// bottom. Chosen on a lineup of the album (_charshots.mjs → heads-lineup.png).
const HEAD_CROP = { zoom: 1.3, lift: -0.06 };
function headBox(p) {
  const d = headR(M, p) * 2 * SC;
  return { w: d * HEAD_W, h: d * HEAD_H };
}
function drawHeads() {
  for (let i = 0; i < 2; i++) {
    const p = M.players[i];
    // The head is a DOM node, so a big-head pickup is a CSS size change, not a canvas one.
    // The card art is repainted at the new size rather than transform-scaled: a scaled-up
    // background is a blurry card, and the whole hook is being able to tell who it is.
    const { w, h } = headBox(p);
    const el = HUD.head[i];
    const key = `${p.char.rarity}_${p.char.number}_${Math.round(w)}`;
    if (el.dataset.card !== key) {
      // the keyline is about one texel of the half-res canvas, whatever size the head is
      const ol = Math.max(1.5, h * 0.05);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.setProperty('--ol', ol.toFixed(1) + 'px');
      // The card is painted into the box INSIDE the keyline, so it is cropped for that box.
      paintHead(el.firstElementChild, p.char.rarity, p.char.number, w - 2 * ol, { ...HEAD_CROP, h: h - 2 * ol });
      el.dataset.card = key;
    }
    // Through the same projection as the body, or a player walking into the goal leaves their
    // head behind on the goal line.
    const d = depthPoint(p.x, headY(p));
    const x = OX + d.x * SC, y = OY + d.y * SC;
    // UPRIGHT. An HS head does not lean into a run — it rides level on the feet paddling under
    // it — and only tips back, with the body (drawBody), when a hit knocks the player back.
    const tilt = p.stunned > 0 ? -p.side * 0.45 : 0;
    el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${tilt}rad)`;
    drawHeadGhosts(i, el, w, h);
    // ARMED: THE PLAYER GLOWS LIKE A FULL POWER BAR.
    //
    // Deliberately the BAR's gold and not the character's shot colour, which is what this
    // used to be. Armed means "the meter is full and spent the moment I reach the ball", so
    // the head and the meter are saying one thing and they should say it in one colour — see
    // the gaugeReady keyframes in style.css, which this is the head's half of.
    el.classList.toggle('armed', p.armed > 0);
    if (p.armed > 0) el.style.setProperty('--glow', '#ffc400');
    // BEHEADED (the ailment): no head for its few seconds — champ-vfx draws the empty ring.
    const gone = p.ail === 'beheaded';
    if (el.classList.contains('gone') !== gone) { el.classList.toggle('gone', gone); el.style.visibility = gone ? 'hidden' : ''; }
    // NO BRUISES. The face used to redden and bruise off a hidden health bar (.head.hurt1..4);
    // Head Soccer has no health, so the character is drawn the same however often it is hit.
  }
}

// The head half of a dash afterimage: see-through copies of the head node, placed where the
// body ghosts were drawn (GHOSTS, filled by draw). Cloned once per card and hidden the rest of
// the time, so a match without a dash costs one `hidden` check per copy per frame.
const HEAD_GHOSTS = [[], []];
function drawHeadGhosts(i, el, w, h) {
  const want = GHOSTS[i], pool = HEAD_GHOSTS[i];
  if (!want.length && !pool.length) return;
  if (pool.key !== el.dataset.card) {                 // new card or size: re-clone
    for (const gh of pool) gh.remove();
    pool.length = 0;
    pool.key = el.dataset.card;
  }
  while (pool.length < want.length) {
    const gh = el.cloneNode(true);
    gh.removeAttribute('id');
    gh.className = `head ghost g${i}`;
    el.parentNode.insertBefore(gh, el);               // under the live head
    pool.push(gh);
  }
  for (let k = 0; k < pool.length; k++) {
    const gh = pool[k], q = want[k];
    if (!q) { gh.hidden = true; continue; }
    const d = depthPoint(q.x, headY(q));
    gh.hidden = false;
    gh.style.opacity = q.alpha.toFixed(2);
    gh.style.transform = `translate(${OX + d.x * SC - w / 2}px, ${OY + d.y * SC - h / 2}px)`;
  }
}

// ABOVE THE HEADS — the kickoff's YOU marker and a stunned player's stars. Both have to sit over
// a head, and a head is a DOM node, so they go on the net layer (ctxNet) the same way the near
// net does.
function drawOverHeads(g) {
  const t = performance.now() / 1000;
  for (const p of M.players) {
    if (!(p.stunned > 0)) continue;
    // …not while a power shot grinds on his boot: HS shows the block's spark burst, no stars
    // (docs/HS-POWER-SHOTS.md §4, M4 61.45–62.25 s; champ-vfx.js draws the burst).
    const pw = M.ball.power;
    if (pw && pw.ph === 'grind' && pw.tgt === p.index) continue;
    const r = headR(M, p);
    const c = depthPoint(p.x, headY(p) - r - 4);
    // three stars orbiting a flat ring over the head; the far side of the ring is smaller
    for (let k = 0; k < 3; k++) {
      const a = t * 7 + k * 2.094;
      const z = (Math.sin(a) + 1) / 2;                   // 0 far → 1 near
      star(g, c.x + Math.cos(a) * r * 0.85, c.y + Math.sin(a) * r * 0.25, 6 + z * 3, 0.65 + z * 0.35);
    }
  }
  // YOU, over the local player's head for as long as the KICK OFF banner stands (HS: the
  // bubble is up through the banner and gone the moment play starts).
  if (M.phase === 'kickoff') {
    const p = M.players[ONLINE && NET ? (NET.you ?? 0) : 0];
    if (p) youMarker(g, p, t);
  }
}
function star(g, x, y, r, a) {
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, an = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  g.closePath();
  g.fillStyle = '#ffe14a'; g.fill();
  g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
  g.restore();
}
function youMarker(g, p, t) {
  const r = headR(M, p);
  const top = depthPoint(p.x, headY(p) - r);
  const bob = Math.sin(t * 5) * 2;
  const w = r * 2.8, h = r * 1.45, x = top.x, y = top.y - 12 - h / 2 + bob;
  const col = p.index === 1 ? '#ff5c7a' : '#4ea0ff';
  g.save();
  // the bubble and its tail, one keyline round both
  const shape = () => {
    roundRect(g, x - w / 2, y - h / 2, w, h, h / 2);
    g.moveTo(x - 6, y + h / 2 - 1); g.lineTo(x, y + h / 2 + 8); g.lineTo(x + 6, y + h / 2 - 1);
  };
  shape(); g.lineWidth = 4; g.strokeStyle = OUTLINE; g.lineJoin = 'round'; g.stroke();
  shape(); g.fillStyle = col; g.fill();
  g.fillStyle = '#ffffff55';                               // gloss along the top
  roundRect(g, x - w / 2 + 5, y - h / 2 + 3, w - 10, h * 0.3, h * 0.15); g.fill();
  g.direction = 'ltr';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(h * 0.72)}px -apple-system, Arial`;
  g.lineWidth = 4; g.strokeStyle = OUTLINE; g.strokeText('YOU', x, y + 1);
  g.fillStyle = '#ffd23c'; g.fillText('YOU', x, y + 1);
  g.restore();
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
    const gv = gaugeView(p);
    const armed = gv.armed;
    // THE PRESS EMPTIES THE BAR (HS M4 36.49 s) and the refill climbs from there while the
    // head glows; the `armed` class and the ⚡ in the name are what say "loaded, go and touch
    // the ball". See gaugeView.
    //
    // The fill is ONE continuous ramp painted across the whole track and revealed by a
    // clip, rather than a growing box. Growing a box squeezes the gradient into whatever
    // is filled, so the colour under the tip never changes and you get a shorter rainbow
    // instead of a climbing one. Revealing a fixed ramp is what makes the leading edge
    // travel green -> yellow -> orange -> red with nothing to step over.
    prop(gEl, '--p', gv.pct.toFixed(2) + '%');
    gEl.classList.toggle('full', gv.full);
    gEl.classList.toggle('powered', armed);
    const nm = powerName(p);
    txt(HUD.gaugeName[i], armed ? `${nm} ⚡` : nm);
  }
  const me = ONLINE ? NET.you : 0;
  const mine = M.players[me];
  const pb = HUD.power;
  // Up only when a press would arm: HS hides the POWER plaque on the press and shows it again
  // when the bar is full (M4 36.56 s → 54.88 s). The glow on the head is what says armed.
  pb.classList.toggle('ready', gaugeView(mine).button);
  txt(HUD.rtt, ONLINE ? `${NET.rtt}ms` : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// TUNER — drag the feel while the match is running
// ═══════════════════════════════════════════════════════════════════════════
const RANGES = {
  // Absolute per-second values now — the PACE dial that used to rescale them is gone — so the
  // ranges sit round Head Soccer's measured numbers (PLAYER_SPEED 228, JUMP_V 240, DASH_V 1790).
  PLAYER_SPEED: [80, 600], SLIP_ACCEL: [200, 5000],
  PLAYER_GRAV: [200, 2000], JUMP_V: [120, 600], JUMP_REJUMP: [0, .3], DASH_V: [300, 3000], DASH_TIME: [.016, .3],
  KICK_POWER: [200, 1600], KICK_LIFT: [0, 1400], KICK_REACH: [20, 130], KICK_R: [10, 60],
  KICK_TIME: [.05, .6],
  BALL_GRAV: [200, 2000], BALL_BOUNCE: [.2, 1], BALL_AIR: [.97, 1], BALL_GROUND_FRICTION: [.9, 1],
  BAR_BOUNCE: [0, 1], CEIL_BOUNCE: [0, 1], CEIL_KEEP_X: [0, 1],
  BALL_MAX_SPEED: [300, 2000],
  GOAL_H: [90, 300], GOAL_W: [40, 160], HEAD_R: [16, 60], GROUND_Y: [360, 500],
  GAUGE_PASSIVE: [0, .25], GAUGE_LEAD: [0, 6], POWER_CUTIN: [0, 3], POWER_BLOCK_STUN: [0, 2],
  POWER_SHOT_SPEED: [300, 3200],
  POWER_SHOT_LIFE: [.4, 4], POWER_BLOCK_REBOUND: [0, 1],
  BODY_DEADEN: [0, 1],
  COUNTER_WINDOW: [40, 320], MATCH_DURATION: [15, 180],
  // jump feel
  COYOTE_TIME: [0, .3], JUMP_BUFFER: [0, .3],
  // kick shaping
  LOB_LIFT: [1, 3], LOB_DRIVE: [.2, 1],
  // tackling
  TACKLE_PUSH: [0, 900], TACKLE_LIFT: [0, 600], TACKLE_IMMUNE: [0, 4], TACKLE_SHOVE: [0, 1.5],
  // The knockdown a power can cause. The health dials (KICK_DAMAGE, HP_*) that sat here went
  // with the hidden health itself — Head Soccer has none.
  STUN_TIME: [.2, 3],
  // impact
  HIT_STOP_KICK: [0, .2], HIT_STOP_POWER: [0, .3], HIT_STOP_TACKLE: [0, .2],
  BALL_IDLE_RESET: [2, 20],
};
const BASE = C.snapshot();

function buildTuner() {
  const body = $('#tunerBody');
  body.innerHTML = '';
  // Read the LIVE values, not the boot snapshot: a reset moves every row at once, and a panel
  // still showing their old values is worse than no panel.
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
  // This Mac, or a phone on its Wi-Fi (npm start's «phone» address): localhost and the private
  // address ranges. Production is a public hostname, so it is never one.
  const DEV_HOST = /^(localhost|\[::1\]|[\w-]+\.local|(127|10)(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/.test(location.hostname);
  // ?hs=1 — the Head Soccer ruleset switch (C.HS, see shared/constants.js), for trying the
  // migration on a phone. Dev hosts only, like ?unlockall: on production a URL must not be
  // able to change the rules. Set here at boot, before any match is created.
  if (DEV_HOST && q.has('hs')) C.setHS(q.get('hs') !== '0');
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
  // (?pace= used to run the whole match in slow motion. The PACE dial is gone — every constant
  // is Head Soccer's own per-second number now — so the flag went with it.)
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
    // ?unlockall / ?resetarcade — testing links: every stage open, or a fresh campaign, on this
    // device. Only on a dev machine or the local network, never on production: there they would
    // hand anyone all 45 champions for typing a word.
    if (DEV_HOST && (q.has('unlockall') || q.has('resetarcade'))) {
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
Object.assign(window, { drawBody, HEAD_CROP, HEAD_W, HEAD_H });
Object.assign(window, { C, startMatch, pick, paintHead, callout, VFXR });
// The arcade, for the harness: the same entry points the buttons use, and the live progress.
Object.assign(window, { startArcadeStage, openArcade, openModes, selectStage, CHAMPIONS });
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
