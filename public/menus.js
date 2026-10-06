// THE MENUS — Head Soccer's screens and flow, in the Saltiz colours. docs/HS-MENUS.md is the
// reference for every screen (layout, timing, the M15 frames); menus.css draws them; the rules
// that are decisions rather than pixels live in shared/menu.js and are tested in node.
//
//   TITLE → MENU (a looping carousel: ארקייד · רב משתתפים · אימון)
//   MENU → SELECT (your card reel ⇄ the champion reel) ⇄ SHOP;  SELECT → VS → MATCH
//   MENU ⚙ → OPTIONS (sound, music, how to, stats);  MENU → MULTIPLAYER → LOBBY
//
// game.js owns the match and the saved state; it hands this module what it needs (createMenus'
// `ctx`) and gets back the screens to open. One screen is up at a time (show), and a pill is
// pressed — HS's dark pressed state — a beat before its screen opens (press).
import { symbolSVG } from './symbol.js';
import { createReel } from './reel.js';
import * as MN from '../shared/menu.js';
import { HS_STAGES } from './hs-stadium.js';

const $ = (s) => document.querySelector(s);
export const SCREENS = ['title', 'menu', 'select', 'shop', 'howto', 'lobby', 'match'];
const POPS = ['cardsPop', 'statsPop', 'optPop', 'mpPop'];      // the order Esc closes them in
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

// The five stats, in HS's two columns (SPEED KICK JUMP | DASH POWER — HS's third, SURVIVAL, is
// not ours: there is no Survival mode).
const STATS = [
  ['speed', 'מהירות', '⚡', '#3ad1ff'], ['kick', 'בעיטה', '⚽', '#ffb020'], ['jump', 'קפיצה', '🦘', '#7dff5a'],
  ['dash', 'דאש', '💨', '#c77dff'], ['power', 'כוח', '🔥', '#ff4a5c'],
];

// HOW TO: HS's eight pages, ours. Each is a number, a name and a little picture.
const HOW = [
  ['המטרה', 'כבשו יותר שערים מהיריב בדקה אחת. הראש, הרגל — הכל הולך.', '<i class="hw-head"></i><i class="hw-ball"></i><i class="hw-goal"></i>'],
  ['תנועה', 'החצים ← → בצד שמאל של המסך (במקלדת: A ו-D, או החצים).', '<span class="hw-keys"><kbd>←</kbd><kbd>→</kbd></span><i class="hw-head run"></i>'],
  ['קפיצה ובעיטה', 'קפיצה — כפתור JUMP (רווח / ↑). בעיטה — KICK (S / ↓). בעיטה באוויר מרימה את הכדור.', '<span class="hw-keys"><kbd>JUMP</kbd><kbd>KICK</kbd></span><i class="hw-head jump"></i><i class="hw-ball up"></i>'],
  ['דאש', 'לחיצה כפולה על חץ — והשחקן זינק קדימה. טוב למירוץ אל הכדור.', '<span class="hw-keys"><kbd>→</kbd><kbd>→</kbd></span><i class="hw-head dash"></i>'],
  ['כוח-על', 'כשמד ה-POWER מתמלא, לחצו POWER (J) ליד הכדור. לכל אלוף כוח משלו.', '<i class="hw-gauge"></i><i class="hw-ball fire"></i>'],
  ['מוות פתאומי', 'תיקו כשהשעון מגיע ל-0:00? השער הבא מנצח, ומד הכוח קופא.', '<b class="hw-sd">SUDDEN DEATH</b>'],
  ['ארקייד ונקודות סולטיז', 'נצחו את 45 האלופים לפי הסדר. כל ניצחון משלם נקודות סולטיז — ובחנות קונים בהן שדרוגים.', '<i class="hw-crown">👑</i><span class="hw-pts"><i class="coin"></i>+100</span>'],
  ['קרדיטים', 'סלטיז ראשים · משחק כדורגל ראשים של סלטיז, בהשראת Head Soccer של D&D Dream.', '<span class="m-sym hw-sym"></span>'],
];

export function createMenus(ctx) {
  const { pick, ARC, UPG, state } = ctx;
  let screen = null;
  let carIdx = 0;                       // the carousel's centred mode
  let selMode = 'arcade';               // Player Select: 'arcade' | 'practice'
  let meRarity = pick.me.rarity, meList = [];
  let reelMe = null, reelFoe = null;
  let practiceFoe = 1;                  // practice: which champion's card you play against
  let howFrom = 'menu', howPage = 0;
  let cardsFor = 'select';              // who opened the card popup
  let shownPts = null, ptsAnim = 0;

  // The symbol, everywhere HS has its own art.
  for (const id of ['tSym', 'mnBlimpSym', 'mnLogo', 'oSym', 'pSym', 'vsSym']) { const el = document.getElementById(id); if (el) el.innerHTML = symbolSVG(); }

  // ── SCREENS AND POPUPS ──────────────────────────────────────────────────
  function show(id) {
    for (const s of SCREENS) document.getElementById(s)?.classList.toggle('hidden', s !== id);
    const el = document.getElementById(id);
    // HS's entrance: the title drops, the bar rises, the faces flash — replayed on every visit
    if (el?.classList.contains('m-screen')) { el.classList.remove('m-enter'); void el.offsetWidth; el.classList.add('m-enter'); }
    screen = id;
    document.body.dataset.screen = id;
    if (id !== 'match') ctx.menuMusic?.();       // HS: the music runs under every menu screen
  }
  const popOpen = (id) => !document.getElementById(id)?.classList.contains('hidden');
  const topPop = () => POPS.find(popOpen) || null;
  function openPop(id) { document.getElementById(id).classList.remove('hidden'); }
  function closePop(id) { document.getElementById(id)?.classList.add('hidden'); }

  // HS's pressed state shows, then the screen changes a beat later.
  function press(btn, fn) {
    if (btn.disabled) return;
    ctx.sfx?.('tap');
    btn.classList.add('is-pressed');
    setTimeout(() => { btn.classList.remove('is-pressed'); fn(); }, 110);
  }
  const on = (sel, fn) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) { console.warn('menus: nothing at', sel); return; }
    el.addEventListener('click', (e) => fn(e, el));
  };
  const tap = (sel, fn) => on(sel, (e, el) => press(el, fn));

  // ── TITLE ───────────────────────────────────────────────────────────────
  // HS: the logo and "TOUCH TO KICK OFF !". Here the symbol assembles (menus.css .t-sym), and a
  // tap flies it to the menu's top-left corner, where HS keeps its logo.
  let leaving = false;
  function openTitle() { leaving = false; show('title'); }
  function leaveTitle() {
    if (leaving || screen !== 'title') return;
    leaving = true;
    ctx.onFirstTap?.();
    ctx.sfx?.('swish');
    const from = $('#tSym').getBoundingClientRect();
    openMenu();
    const logo = $('#mnLogo'), to = logo.getBoundingClientRect();
    if (!from.width || !to.width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fly = document.createElement('span');
    fly.className = 'm-sym glow m-fly';
    fly.innerHTML = symbolSVG();
    Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.appendChild(fly);
    logo.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const k = to.width / from.width;
      fly.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})`;
    }));
    const done = () => { fly.remove(); logo.style.opacity = ''; };
    fly.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 900);
  }
  on('#title', leaveTitle);

  // ── MAIN MENU ───────────────────────────────────────────────────────────
  // HS M15: the logo top-left, its icons top-right, a big piece of art, and a looping carousel
  // of modes along the bottom — the centred one bigger, with its mascot popping up above it.
  const track = $('#mnTrack');
  const MODE_ICON = { arcade: '🏆', multi: '⚡', practice: '🎯' };
  track.innerHTML = MN.MODES.map((m, i) => `<button class="mn-mode" data-i="${i}" data-mode="${m.id}">
      <span class="mn-masc"></span><b class="mn-pill"><i class="mn-ico">${MODE_ICON[m.id]}</i><span>${m.name}</span></b><small class="mn-sub"></small></button>`).join('');
  for (const b of track.children) {
    b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (i === carIdx) press(b.querySelector('.mn-pill'), () => enterMode(MN.MODES[i].id));
      else spin(i);
    });
  }
  function spin(i) { carIdx = MN.wrap(i, MN.MODES.length); ctx.sfx?.('tick'); placeCarousel(); }
  function placeCarousel() {
    const offs = MN.carouselOffsets(carIdx, MN.MODES.length);
    [...track.children].forEach((b, i) => {
      b.style.setProperty('--o', offs[i]);
      b.classList.toggle('on', offs[i] === 0);
      b.tabIndex = offs[i] === 0 ? 0 : -1;
    });
    paintMascot();
  }
  function paintMascot() {
    for (const b of track.children) b.querySelector('.mn-masc').innerHTML = '';
    const b = track.children[carIdx], m = b.querySelector('.mn-masc'), id = MN.MODES[carIdx].id;
    if (id === 'arcade') {
      m.innerHTML = '<i class="mm-face"></i><b class="mm-deco crown">👑</b>';
      const n = ARC.currentStage(state.prog);
      ctx.paintHead(m.querySelector('.mm-face'), 'legendary', n, m.querySelector('.mm-face').clientWidth || 60);
    } else if (id === 'multi') {
      m.innerHTML = '<i class="mm-face a"></i><b class="mm-deco bolt">⚡</b><i class="mm-face b"></i>';
      const [a, c] = m.querySelectorAll('.mm-face');
      ctx.paintHead(a, pick.me.rarity, pick.me.number, a.clientWidth || 50);
      ctx.paintHead(c, 'legendary', 2, c.clientWidth || 50, { flip: true });
    } else {
      m.innerHTML = '<i class="mm-face"></i><b class="mm-deco cone">🎯</b>';
      ctx.paintHead(m.querySelector('.mm-face'), pick.me.rarity, pick.me.number, m.querySelector('.mm-face').clientWidth || 60);
    }
  }
  function enterMode(id) {
    if (id === 'arcade') openSelect('arcade');
    else if (id === 'practice') openSelect('practice');
    else openMp();
  }
  function openMenu() {
    show('menu');
    const subs = track.querySelectorAll('.mn-sub');
    subs[0].textContent = ARC.campaignComplete(state.prog) ? 'כל 45 האלופים ✓' : `שלב ${ARC.currentStage(state.prog)}/${ARC.STAGE_COUNT}`;
    subs[1].innerHTML = 'עם חבר <span class="online-count"></span>';
    subs[2].textContent = 'נגד המחשב';
    ctx.refreshOnline?.();
    $('#mnPts').textContent = fmt(state.stats.points);
    paintScene();
    placeCarousel();
  }
  // THE SCENE. HS's day stadium (hs-stadium.js, the same painter as the match) once, with our
  // own boards and grass under it; then the cast: you, big, heading the ball — the drawn
  // champions around you, cheering. A card without a drawn character plays its photo in a ring.
  let stadiumDone = false;
  function paintStadium() {
    if (stadiumDone) return;
    stadiumDone = true;
    // SKY of open sky above the stadium (HS's title art has its sky): the blimp flies in it
    const cv = $('#mnStadium'), K = 1.5, W = 1060, SKY = 150, H = 560 + SKY, gy = 435;
    cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d');
    g.scale(K, K);
    const sk = g.createLinearGradient(0, 0, 0, SKY + 100);
    sk.addColorStop(0, '#0f8fe0'); sk.addColorStop(0.7, '#2cc3f5'); sk.addColorStop(1, '#12a6ec');
    g.fillStyle = sk; g.fillRect(0, 0, W, SKY + 100);
    g.fillStyle = '#ffffffd9';
    for (const [x, y, r] of [[120, 60, 34], [165, 52, 44], [215, 64, 30], [560, 40, 28], [600, 34, 38], [640, 44, 26], [880, 74, 36], [925, 66, 46], [975, 78, 30]]) {
      g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
    g.translate(0, SKY);
    try { HS_STAGES[0].draw(g, { W, t: 0, horizon: gy * 0.6, crowdTop: gy * 0.61, crowdBot: gy * 0.81 - 8, gy }); } catch { /* the sky colour stands in */ }
    // the hoardings: Saltiz boards in the logo's colours and the crowd's
    const top = gy * 0.82, bot = gy * 0.95, n = 6, bw = W / n;
    const BOARDS = [['#e8102e', '#ffd400', 'SALTIZ'], ['#ffd400', '#c4001f', 'סלטיז ראשים'], ['#1b6fe0', '#fff', 'GOAL!'],
      ['#16a34a', '#fff', 'סלטיז'], ['#8a3ffc', '#ffd400', 'HEAD'], ['#ff7a00', '#fff', '⚽ ⚽ ⚽']];
    BOARDS.forEach(([bg, fg, txt], i) => {
      const x = i * bw;
      const gr = g.createLinearGradient(0, top, 0, bot);
      gr.addColorStop(0, bg); gr.addColorStop(1, '#0006');
      g.fillStyle = bg; g.fillRect(x, top, bw, bot - top);
      g.fillStyle = gr; g.globalAlpha = 0.35; g.fillRect(x, top, bw, bot - top); g.globalAlpha = 1;
      g.fillStyle = '#0005'; g.fillRect(x, top, 2, bot - top);
      g.fillStyle = fg; g.font = '900 30px Rubik, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, x + bw / 2, (top + bot) / 2 + 1);
    });
    // the grass: HS's bright stripes, the halfway line, the centre circle
    const floor = H - SKY;
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3fae3a' : '#4cc046'; g.fillRect(i * W / 12, bot, W / 12 + 1, floor - bot); }
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(W / 2, bot); g.lineTo(W / 2, floor); g.stroke();
    g.beginPath(); g.ellipse(W / 2, (bot + floor) / 2 + 20, 120, 40, 0, 0, Math.PI * 2); g.stroke();
  }
  function paintScene() {
    paintStadium();
    const face = $('#mnFace');
    const mine = ctx.characterFor?.(pick.me.rarity, pick.me.number);
    ctx.paintHead(face, pick.me.rarity, pick.me.number, face.clientWidth || 240, { expr: 'kick', fill: 1.05 });
    face.classList.toggle('photo', !mine);
    // the cheering champions: every drawn character but yours, happy
    const cast = [1, 2, 3, 4, 5].filter((k) => !(pick.me.rarity === 'legendary' && pick.me.number === k)).slice(0, 4);
    const box = $('#mnCast');
    if (box.dataset.cast !== cast.join()) {
      box.dataset.cast = cast.join();
      box.innerHTML = cast.map((k, i) => `<i class="mn-fan f${i}"><i class="mn-fan-face"></i></i>`).join('');
    }
    box.querySelectorAll('.mn-fan-face').forEach((el, i) => ctx.paintHead(el, 'legendary', cast[i], el.clientWidth || 90, { expr: i % 2 ? 'happy' : 'kick', flip: i % 2 === 1, fill: 1.05 }));
  }
  on('#mnPrev', () => spin(carIdx - 1));
  on('#mnNext', () => spin(carIdx + 1));
  tap('#mnOpt', () => openOptions());
  // a swipe along the carousel turns it
  {
    let x0 = null;
    const car = $('.mn-car');
    car.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    car.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) spin(carIdx + (dx < 0 ? 1 : -1));
    });
  }

  // ── PLAYER SELECT ──────────────────────────────────────────────────────
  // HS: your character on the left, the CPU's on the right, each a vertical reel; the match
  // counter in a tab on the panel's top edge, the last score under it, a pill on each side, a
  // VS between the two flags, the stars under the CPU's, its row of icons, then SHOP, the
  // stats and PLAY along the bottom. Ours puts a rarity gem where your flag goes and the tier's
  // badge where the CPU's does, and the champion's power where HS lists its achievements.
  const champs = ctx.champions;
  const foeStage = () => (selMode === 'arcade' ? state.sel : practiceFoe);
  const powerOf = (card) => ctx.shotFor(card, { arcade: selMode === 'arcade' });
  const meCard = () => meList[reelMe ? reelMe.index : 0];

  function hexHTML({ caged = false, plate = '', badge = '', color = '#fe0034', done = false } = {}) {
    return `<span class="m-hex"><i class="m-face"></i>${caged ? '<i class="m-cage"></i>' : ''}${plate ? `<b class="m-plate">${plate}</b>` : ''}` +
      `${badge ? `<span class="m-badge" style="--c:${color}">${badge}</span>` : ''}${done ? '<span class="m-done">✓</span>' : ''}</span>`;
  }
  function paintMe(i, item) {
    const c = meList[i], shot = powerOf(c);
    item.innerHTML = hexHTML({ caged: !c.owned, plate: c.owned ? '' : 'לא באלבום', badge: shot.icon || '⚡', color: MN.RARITY_COLOR[c.rarity] });
    const f = item.querySelector('.m-face');
    ctx.paintHead(f, c.rarity, c.number, f.clientWidth || 120, { fill: 1.05 });
  }
  function paintFoe(i, item) {
    const c = champs[i], st = selMode === 'arcade' ? ARC.stageStatus(state.prog, c.stage) : 'available';
    item.innerHTML = hexHTML({ caged: st === 'locked', badge: c.icon, color: c.color, done: st === 'completed' });
    item.classList.add('foe');
    const f = item.querySelector('.m-face');
    ctx.paintHead(f, 'legendary', c.stage, f.clientWidth || 120, { flip: true, fill: 1.05 });
  }
  function buildReels() {
    meList = MN.cardReel(meRarity, ctx.owns, ctx.perRarity);
    const iMe = pick.me.rarity === meRarity ? pick.me.number - 1 : (MN.firstOwned(meRarity, ctx.owns, ctx.perRarity) || 1) - 1;
    if (!reelMe) reelMe = createReel($('#reelMe'), { count: meList.length, index: iMe, paint: paintMe, onSelect: onMe, onTap: () => openCards('select') });
    else reelMe.reset(meList.length, iMe);
    const iFoe = foeStage() - 1;
    if (!reelFoe) reelFoe = createReel($('#reelFoe'), { count: champs.length, index: iFoe, paint: paintFoe, onSelect: onFoe });
    else reelFoe.reset(champs.length, iFoe);
  }
  function onMe(i) {
    const c = meList[i];
    if (c.owned) pick.me = { rarity: c.rarity, number: c.number };
    renderSelect();
  }
  function onFoe(i) {
    if (selMode === 'arcade') state.sel = i + 1;
    else { practiceFoe = i + 1; pick.foe = { ...champs[i].card }; }
    renderSelect();
  }
  function openSelect(mode, { stage } = {}) {
    selMode = mode;
    carIdx = MN.MODES.findIndex((m) => m.id === mode);
    if (mode === 'arcade' && stage) state.sel = stage;
    if (mode === 'practice') pick.foe = { ...champs[practiceFoe - 1].card };
    meRarity = pick.me.rarity;
    show('select');
    $('#select').classList.toggle('practice', mode === 'practice');
    buildReels();
    renderSelect();
  }
  function stars(el, n) {
    el.innerHTML = MN.starRow(n).map((s) => `<i class="st ${s}"></i>`).join('');
    el.setAttribute('aria-label', `${n} כוכבים`);
  }
  function renderSelect() {
    const n = reelFoe.index + 1, c = champs[n - 1];
    const st = selMode === 'arcade' ? ARC.stageStatus(state.prog, n) : 'available';
    const arcade = selMode === 'arcade';
    $('#selH').textContent = arcade ? 'בחר שחקן' : 'אימון חופשי';
    $('#selTabK').textContent = arcade ? 'שלב' : 'אימון';
    $('#selTabV').textContent = arcade ? `${n}/${ARC.STAGE_COUNT}` : ctx.difficulties[pick.level].name;
    const sc = arcade ? ARC.lastScore(state.prog, n) : null;
    $('#selScore').textContent = sc ? `${sc[0]} : ${sc[1]}` : '';
    $('#selScore').classList.toggle('hidden', !sc);
    $('#selRar').innerHTML = `<i class="pp"></i>${MN.RARITY_NAME[meRarity]} ▾`;
    $('#selRar').style.setProperty('--rc', MN.RARITY_COLOR[meRarity]);
    $('#selTier').innerHTML = `${ctx.tiers[c.tier]}<i class="pp"></i>`;
    const me = meCard();
    const gem = $('#selGem');
    gem.textContent = MN.RARITY_NAME[me.rarity];
    gem.style.setProperty('--c', MN.RARITY_COLOR[me.rarity]);
    const fg = $('#selFoeGem');
    fg.textContent = ctx.tiers[c.tier];
    fg.style.setProperty('--c', c.color);
    $('#selFoeTag').textContent = arcade ? 'אלוף' : 'יריב';
    stars($('#selStars'), arcade ? c.hs.stars : MN.levelStars(pick.level));
    $('#selDiff').classList.toggle('hidden', arcade);
    $('#diffName').textContent = ctx.difficulties[pick.level].name;
    $('#diffDown').disabled = pick.level <= 0;
    $('#diffUp').disabled = pick.level >= 5;
    // the champion's power, where HS lists the opponent's achievements
    const pw = arcade ? { icon: c.icon, name: c.powerName, desc: c.desc, color: c.color } : { ...powerOf(pick.foe), color: c.color, desc: 'בעיטת הכוח של היריב באימון' };
    const pb = $('#selPower');
    pb.innerHTML = `<i style="--c:${pw.color}">${pw.icon || '⚡'}</i><b>${pw.name}</b><small>${c.title}</small>`;
    pb.dataset.desc = pw.desc || '';
    // HS's tooltip over a caged opponent: what it takes
    const tip = $('#selTip');
    if (st === 'locked') {
      const prev = champs[n - 2];
      tip.textContent = `🔒 נצחו קודם את ${prev ? prev.title : 'האלוף הקודם'}`;
      tip.classList.remove('hidden');
    } else tip.classList.add('hidden');
    // your stats: the levels you bought (HS shows its bars empty on a fresh start, M15)
    const box = $('#selStats');
    box.innerHTML = STATS.map(([k, name]) => `<span class="ss"><small>${name}</small><span class="m-bars">${barHTML(state.stats.lv[k])}</span></span>`).join('');
    // PLAY: only a stage that is open, with a card you own
    const play = $('#selPlay');
    const why = st === 'locked' ? '🔒 נעול' : !me.owned ? 'לא באלבום' : '';
    play.disabled = !!why;
    play.innerHTML = `<b>${why || 'שחק'}</b>`;
  }
  const barHTML = (lv, next = -1) => Array.from({ length: 10 }, (_, i) => `<i class="${i < lv ? 'on' : i === next ? 'next' : ''}"></i>`).join('');
  tap('#selBack', () => openMenu());
  tap('#selShop', () => openShop());
  tap('#selPlay', () => play());
  function play() {
    if ($('#selPlay').disabled) return;
    if (selMode === 'arcade') ctx.play.arcade(reelFoe.index + 1);
    else ctx.play.practice();
  }
  on('#selRar', () => {
    meRarity = MN.nextRarity(meRarity);
    const first = MN.firstOwned(meRarity, ctx.owns, ctx.perRarity);
    if (first) pick.me = { rarity: meRarity, number: first };
    meList = MN.cardReel(meRarity, ctx.owns, ctx.perRarity);
    reelMe.reset(meList.length, (first || 1) - 1);
    renderSelect();
  });
  on('#selPower', (e, el) => {
    const tip = $('#selTip');
    if (!el.dataset.desc) return;
    tip.textContent = el.dataset.desc;
    tip.classList.remove('hidden');
    clearTimeout(tip._t);
    tip._t = setTimeout(() => renderSelect(), 3200);
  });
  on('#diffDown', () => { pick.level = Math.max(0, pick.level - 1); renderSelect(); });
  on('#diffUp', () => { pick.level = Math.min(5, pick.level + 1); renderSelect(); });

  // ── YOUR CARD: the album, in a popup ───────────────────────────────────
  let cardsRarity = meRarity;
  function openCards(from) {
    cardsFor = from;
    cardsRarity = pick.me.rarity;
    renderCards();
    openPop('cardsPop');
  }
  function renderCards() {
    $('#cardsTabs').innerHTML = MN.RARITY_ORDER.map((r) => `<button class="m-chip${r === cardsRarity ? ' on' : ''}" data-r="${r}" style="--rc:${MN.RARITY_COLOR[r]}">${MN.RARITY_NAME[r]}</button>`).join('');
    const grid = $('#cardGrid');
    grid.innerHTML = '';
    for (let n = 1; n <= ctx.perRarity; n++) {
      const owned = ctx.owns(cardsRarity, n);
      const b = document.createElement('button');
      b.className = 'cd' + (owned ? '' : ' locked') + (pick.me.rarity === cardsRarity && pick.me.number === n ? ' sel' : '');
      b.style.backgroundImage = `url("${ctx.cardUrl(cardsRarity, n)}")`;
      b.innerHTML = `<b>${n}</b>`;
      if (!owned) b.title = 'לא באלבום שלך';
      b.onclick = () => {
        if (!owned) return;
        pick.me = { rarity: cardsRarity, number: n };
        closePop('cardsPop');
        if (cardsFor === 'mp') renderMp();
        else { meRarity = cardsRarity; meList = MN.cardReel(meRarity, ctx.owns, ctx.perRarity); reelMe.reset(meList.length, n - 1); renderSelect(); }
      };
      grid.appendChild(b);
    }
  }
  on('#cardsTabs', (e) => { const b = e.target.closest('button'); if (!b) return; cardsRarity = b.dataset.r; renderCards(); });
  on('#cardsX', () => closePop('cardsPop'));

  // ── SHOP ────────────────────────────────────────────────────────────────
  // HS: BACK, the folder tabs, a row per stat — name, price, ten dots, Buy — and MY POINT at
  // the bottom. One tab: we have no costumes, pets or bodies.
  function openShop() {
    shownPts = state.stats.points;
    show('shop');
    renderShop();
    const f = $('#shopFace');
    ctx.paintHead(f, pick.me.rarity, pick.me.number, f.clientWidth || 100);
    $('#shopName').textContent = MN.RARITY_NAME[pick.me.rarity] + ' #' + pick.me.number;
  }
  function renderShop(bought = null) {
    const box = $('#upgRows');
    if (!box.children.length) {
      box.innerHTML = STATS.map(([k, name, ico, c]) => `<div class="upg-row" data-k="${k}" style="--c:${c}">
        <span class="sh-name"><i>${ico}</i><b>${name}</b><small class="sh-mult"></small></span>
        <span class="sh-price"><i class="coin"></i><b></b></span>
        <span class="m-bars sh-bars"></span>
        <button class="m-pill sm upg-buy"><b>קנה</b></button></div>`).join('');
      box.querySelectorAll('.upg-buy').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.closest('.upg-row').dataset.k;
          const r = UPG.buy(state.stats, k);
          if (!r.bought) return;
          ctx.setStats(r.st);
          if (ctx.sfxOn()) ctx.SFX.buy(state.stats.lv[k] === 10);
          renderShop(k);
        });
      });
    }
    for (const row of box.children) {
      const k = row.dataset.k, L = state.stats.lv[k], nx = UPG.nextOf(state.stats, k), can = UPG.canBuy(state.stats, k);
      row.querySelector('.sh-bars').innerHTML = barHTML(L, can ? L : -1);
      row.querySelector('.sh-mult').textContent = `רמה ${L} · ×${ctx.statMult(k, L)}`;
      row.querySelector('.sh-price b').textContent = nx ? fmt(nx.cost) : 'MAX';
      row.querySelector('.sh-price').classList.toggle('max', !nx);
      const btn = row.querySelector('.upg-buy');
      btn.disabled = !can;
      btn.innerHTML = `<b>${nx ? 'קנה' : 'MAX ⭐'}</b>`;
      btn.setAttribute('aria-label', nx ? `שדרג ${row.querySelector('.sh-name b').textContent} לרמה ${nx.level}, ${fmt(nx.cost)} נקודות סולטיז` : 'רמה מקסימלית');
      if (bought === k) {
        row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop');
        const seg = row.querySelectorAll('.sh-bars i')[L - 1];
        seg?.classList.add('new');
        const f = document.createElement('span');
        f.className = 'upg-float'; f.textContent = '+1';
        row.appendChild(f); setTimeout(() => f.remove(), 900);
      }
    }
    if (bought) { const p = $('#upgPtsBox'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
    renderPoints();
  }
  // the points run down to the new total rather than jumping
  function renderPoints() {
    const el = $('#upgPts'), from = shownPts ?? state.stats.points, to = state.stats.points;
    shownPts = to;
    $('#mnPts').textContent = fmt(to);
    cancelAnimationFrame(ptsAnim);
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 380);
      el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) ptsAnim = requestAnimationFrame(tick);
    };
    ptsAnim = requestAnimationFrame(tick);
  }
  tap('#shopBack', () => { show('select'); renderSelect(); });

  // ── OPTIONS · STATS ─────────────────────────────────────────────────────
  // HS M15: OPTION is its pause screen's design over the dimmed menu.
  function syncSound() {
    for (const id of ['#oSnd', '#pSnd']) $(id)?.querySelector('.m-orb').classList.toggle('off', !ctx.sfxOn());
    for (const id of ['#oMus', '#pMus']) $(id)?.querySelector('.m-orb').classList.toggle('off', !ctx.musicOn());
  }
  function openOptions() { syncSound(); openPop('optPop'); }
  on('#oSnd', () => { ctx.setSfx(!ctx.sfxOn()); syncSound(); });
  on('#oMus', () => { ctx.setMusic(!ctx.musicOn()); syncSound(); });
  tap('#oHow', () => { closePop('optPop'); openHowTo('menu'); });
  tap('#oStats', () => openStats());
  tap('#oBack', () => closePop('optPop'));
  on('#optPop', (e, el) => { if (e.target === el) closePop('optPop'); });
  function openStats() {
    const p = state.prog, rec = Object.values(p.record);
    const w = rec.reduce((s, r) => s + r.w, 0), l = rec.reduce((s, r) => s + r.l, 0);
    const lv = Object.values(state.stats.lv).reduce((s, v) => s + v, 0);
    const rows = [['אלופים שהובסו', `${p.cleared} / ${ARC.STAGE_COUNT}`], ['ניצחונות בארקייד', w], ['הפסדים בארקייד', l],
      ['נקודות סולטיז', `<i class="coin"></i> ${fmt(state.stats.points)}`], ['רמות שדרוג', `${lv} / 50`]];
    $('#statsList').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    openPop('statsPop');
  }
  on('#statsX', () => closePop('statsPop'));

  // ── HOW TO ──────────────────────────────────────────────────────────────
  // HS: card pages that slide sideways, the next one peeking in; its number and name on a
  // flame at the bottom-left; ‹ › at the bottom corners; BACK to wherever it was opened from.
  const howTrack = $('#howTrack');
  howTrack.innerHTML = HOW.map(([name, text, art], i) => `<article class="m-panel plain how-page">
      <div class="hw-art">${art}</div><p>${text}</p><b class="how-tag"><em>${i + 1}</em>${name}</b></article>`).join('');
  const hs = howTrack.querySelector('.hw-sym'); if (hs) hs.innerHTML = symbolSVG();
  function openHowTo(from) {
    howFrom = from;
    howPage = 0;
    show('howto');
    placeHow();
    for (const h of howTrack.querySelectorAll('.hw-head')) ctx.paintHead(h, pick.me.rarity, pick.me.number, h.clientWidth || 60);
  }
  function placeHow() {
    howTrack.style.setProperty('--p', howPage);
    [...howTrack.children].forEach((pg, i) => pg.classList.toggle('on', i === howPage));
    $('#howPrev').disabled = howPage === 0;
    $('#howNext').disabled = howPage === HOW.length - 1;
  }
  const howGo = (k) => { howPage = Math.max(0, Math.min(HOW.length - 1, howPage + k)); placeHow(); };
  on('#howPrev', () => howGo(-1));
  on('#howNext', () => howGo(1));
  {
    let x0 = null;
    const view = $('#howView');
    view.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    view.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) howGo(dx < 0 ? 1 : -1); });
  }
  function leaveHowTo() {
    if (howFrom === 'pause') { show('match'); ctx.onHowToClosed?.(); }
    else { openMenu(); openOptions(); }
  }
  tap('#howBack', leaveHowTo);

  // ── MULTIPLAYER ─────────────────────────────────────────────────────────
  // HS M15: a popup over the dimmed menu — your name ("MAX 10 · AUTO SAVE") on one half, two
  // big ways in on the other. Ours: make a room (HS's FRIENDLY) or join one with its code.
  function openMp() { renderMp(); openPop('mpPop'); ctx.refreshOnline?.(); }
  function renderMp() {
    $('#mpName').value = pick.name;
    const f = $('#mpFace');
    ctx.paintHead(f, pick.me.rarity, pick.me.number, f.clientWidth || 60);
    $('#mpCardName').textContent = `${MN.RARITY_NAME[pick.me.rarity]} #${pick.me.number}`;
  }
  $('#mpName').addEventListener('input', (e) => {
    pick.name = MN.cleanName(e.target.value);
    try { ctx.store?.setItem(MN.NAME_KEY, pick.name); } catch { /* private mode */ }
  });
  on('#mpCard', () => openCards('mp'));
  on('#mpX', () => closePop('mpPop'));
  tap('#hostBtn', () => { closePop('mpPop'); ctx.lobby('host'); });
  tap('#joinBtn', () => { closePop('mpPop'); ctx.lobby('join'); });
  for (const id of POPS) on('#' + id, (e, el) => { if (e.target === el && id !== 'optPop') closePop(id); });

  // ── KEYS ────────────────────────────────────────────────────────────────
  // ←/→ turn the carousel, ↑/↓ roll the CPU's reel (Shift: yours), Enter goes, Esc goes back —
  // and a popup on top takes Esc first. Captured, so none of it is also a game key.
  addEventListener('keydown', (e) => {
    if (!screen || screen === 'match') return;
    const t = e.target, inField = t?.closest?.('input,textarea,[contenteditable]');
    const k = e.code;
    let act = null;
    const pop = topPop();
    if (pop) {
      if (k === 'Escape') act = () => closePop(pop);
    } else if (inField) {
      return;
    } else if (screen === 'title') {
      if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') act = leaveTitle;
    } else if (screen === 'menu') {
      if (k === 'ArrowLeft') act = () => spin(carIdx - 1);
      else if (k === 'ArrowRight') act = () => spin(carIdx + 1);
      else if ((k === 'Enter' || k === 'NumpadEnter') && !t?.closest?.('button:not(.mn-mode)')) act = () => enterMode(MN.MODES[carIdx].id);
    } else if (screen === 'select') {
      const reel = e.shiftKey ? reelMe : reelFoe;
      if (k === 'ArrowDown') act = () => reel.step(1);
      else if (k === 'ArrowUp') act = () => reel.step(-1);
      else if (k === 'Home') act = () => reel.select(0);
      else if (k === 'End') act = () => reel.select(reel === reelMe ? meList.length - 1 : champs.length - 1);
      else if ((k === 'Enter' || k === 'NumpadEnter') && !(t?.tagName === 'BUTTON')) act = play;
      else if (k === 'Escape') act = () => openMenu();
    } else if (screen === 'shop') {
      if (k === 'Escape') act = () => { show('select'); renderSelect(); };
    } else if (screen === 'howto') {
      if (k === 'ArrowLeft') act = () => howGo(-1);
      else if (k === 'ArrowRight') act = () => howGo(1);
      else if (k === 'Escape') act = leaveHowTo;
    } else if (screen === 'lobby') {
      if (k === 'Escape') act = () => $('#lobbyBack').click();
    }
    if (!act || (e.repeat && k.endsWith('Enter'))) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    act();
  }, true);

  // ── A RESIZE repaints the faces at their new size ──
  addEventListener('resize', () => {
    if (screen === 'select') { reelMe?.repaint(); reelFoe?.repaint(); }
    if (screen === 'menu') openMenu();
  });

  return {
    show, get screen() { return screen; },
    openTitle, openMenu, openSelect, openShop, openHowTo, openOptions, openMp,
    get selMode() { return selMode; },
    closePops: () => POPS.forEach(closePop),
    syncSound, renderPoints,
    selectStage: (n) => { if (screen !== 'select') openSelect('arcade', { stage: n }); else reelFoe.select(n - 1); },
  };
}
