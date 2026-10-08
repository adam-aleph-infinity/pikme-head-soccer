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
import * as ICON from './home-icons.js';
import { createReel } from './reel.js';
import * as MN from '../shared/menu.js';
import { HS_STAGES } from './hs-stadium.js';
import * as TOUR from '../shared/tournament.js';

const $ = (s) => document.querySelector(s);
export const SCREENS = ['title', 'menu', 'modes', 'select', 'shop', 'bracket', 'howto', 'lobby', 'match'];
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
  let shopFrom = 'select';              // where the shop's BACK goes: 'menu' | 'select'
  let selMode = 'arcade';               // Player Select: 'arcade' | 'practice'
  let meList = [];                     // the characters list (MN.charReel)
  let reelMe = null, reelFoe = null, reelCup = null;
  let practiceFoe = 1;                  // practice: which champion's card you play against
  let howFrom = 'menu', howPage = 0;
  let cardsFor = 'select';              // who opened the card popup
  let shownPts = null, ptsAnim = 0;

  // The symbol, everywhere HS has its own art.
  for (const id of ['tSym', 'hmPodSym', 'mnLogo', 'oSym', 'pSym', 'vsSym', 'brSym']) { const el = document.getElementById(id); if (el) el.innerHTML = symbolSVG(); }

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
  let leaving = false, waiting = false;
  function openTitle() { leaving = false; waiting = false; show('title'); }
  function leaveTitle() {
    if (leaving || screen !== 'title') return;
    // The title is the loading screen (loader.js): a tap while it loads goes through when it is done.
    if (ctx.whenLoaded && !waiting) { waiting = true; ctx.whenLoaded(() => { waiting = false; if (screen === 'title' && !leaving) goTitle(); }); }
  }
  function goTitle() {
    leaving = true;
    ctx.onFirstTap?.();
    ctx.sfx?.('swish');
    // A new player's first tap starts the tutorial (tutorial.js) instead of the menu.
    if (ctx.firstRun?.()) { ctx.startTutorial(); return; }
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

  // ── HOME ────────────────────────────────────────────────────────────────
  // Ours: you, standing on a podium under a spotlight on a dark stage; your profile and
  // trophies top-left, the wallet along the top, settings top-right; characters and shop on the
  // left, the battle pass bottom-left; friends and the leaderboard on the right, PLAY bottom-right.
  // Money and trophies are not in the game yet: they read 0 until they are.
  function openMenu() {
    show('menu');
    paintHome();
    ctx.onHome?.();
  }
  // the tiles' drawn icons (home-icons.js), once
  const ICONS = { trophy: ICON.TROPHY, gear: ICON.GEAR, shop: '<img src="img/shop-icon.png" alt="">', friends: ICON.FRIENDS, board: ICON.BOARD, pass: ICON.PASS, quests: ICON.QUESTS };
  for (const el of document.querySelectorAll('#menu [data-ico]')) el.innerHTML = ICONS[el.dataset.ico] || '';
  function paintHome() {
    $('#hmName').textContent = pick.name || MN.cleanName('');
    $('#mnPts').textContent = fmt(state.stats.points);
    $('#hmMoney').textContent = fmt(state.stats.money || 0);
    $('#hmCups').textContent = fmt(ctx.trophies?.() ?? state.stats.trophies ?? 0);
    const av = $('#hmAvatar');
    av.classList.toggle('photo', !ctx.characterFor?.(pick.me.rarity, pick.me.number));
    ctx.paintHead(av, pick.me.rarity, pick.me.number, av.clientWidth || 60, { fill: 1.05 });
    ctx.paintStanding?.($('#hmHero'), pick.me);
    paintTeam();
    ctx.paintArenaHome?.();
    // the Characters tile: two of the drawn champions peeking out of it
    const [fa, fb] = document.querySelectorAll('#hmChars .hm-cf');
    ctx.paintHead(fa, 'legendary', 3, fa.clientWidth || 40, { fill: 1.05 });
    ctx.paintHead(fb, 'legendary', 2, fb.clientWidth || 40, { fill: 1.05, flip: true });
  }
  // YOUR TEAM (team.js): its chip under your trophies, its colour round your face
  function paintTeam() {
    const t = ctx.team?.(), chip = $('#hmTeam'), av = $('#hmAvatar');
    chip.classList.toggle('hidden', !t);
    av.classList.toggle('team', !!t);
    if (!t) return;
    for (const el of [chip, av]) { el.style.setProperty('--tc', t.color); el.style.setProperty('--td', t.dark); }
    $('#hmTBdg').innerHTML = ctx.badgeSVG(t);
    $('#hmTName').textContent = t.title;
    $('#hmTStat').textContent = ctx.teamStatus?.() || '';
  }
  // "Coming soon", for the buttons whose screens are not built yet.
  let toastT = 0;
  function toast(text) {
    const t = $('#hmToast');
    t.textContent = text;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 1600);
  }
  // PLAY is the arena (arena.js); the other modes are the button beside it
  tap('#hmPlay', () => (ctx.playArena ? ctx.playArena() : openModes()));
  tap('#hmModes', () => openModes());
  on('#hmCupsBox', () => { ctx.sfx?.('tap'); ctx.openRoad?.(); });
  tap('#hmBoard', () => (ctx.openBoard ? ctx.openBoard() : toast('בקרוב!')));
  tap('#hmChars', () => openCards('menu'));
  tap('#hmShop', () => openShop('menu'));
  tap('#hmProfile', () => openStats({ profile: true }));
  tap('#hmTeam', () => ctx.openTeam?.());
  for (const id of ['#hmPass', '#hmQuests', '#hmFriends', '#hmMoneyPlus']) tap(id, () => toast('בקרוב!'));
  tap('#hmPtsPlus', () => openShop('menu'));          // more points: the shop is where they are spent
  tap('#mnOpt', () => openOptions());

  // ── GAME MODES ──────────────────────────────────────────────────────────
  // What PLAY opens: every mode (shared/menu.js MODES) as a big card, its mascot over it.
  const row = $('#mdRow');
  const MODE_ICON = { arcade: '👑', tournament: '🏆', multi: '⚡', practice: '🎯' };
  row.innerHTML = MN.MODES.map((m) => `<button class="mn-mode" data-mode="${m.id}">
      <span class="mn-masc"></span><b class="mn-pill"><i class="mn-ico">${MODE_ICON[m.id]}</i><span>${m.name}</span></b><small class="mn-sub"></small></button>`).join('');
  for (const b of row.children) b.addEventListener('click', () => press(b.querySelector('.mn-pill'), () => enterMode(b.dataset.mode)));
  function paintMascot(b) {
    const m = b.querySelector('.mn-masc'), id = b.dataset.mode;
    if (id === 'arcade') {
      m.innerHTML = '<i class="mm-face"></i><b class="mm-deco crown">👑</b>';
      const n = ARC.currentStage(state.prog);
      ctx.paintHead(m.querySelector('.mm-face'), 'legendary', n, m.querySelector('.mm-face').clientWidth || 60);
    } else if (id === 'multi') {
      m.innerHTML = '<i class="mm-face a"></i><b class="mm-deco bolt">⚡</b><i class="mm-face b"></i>';
      const [a, c] = m.querySelectorAll('.mm-face');
      ctx.paintHead(a, pick.me.rarity, pick.me.number, a.clientWidth || 50);
      ctx.paintHead(c, 'legendary', 2, c.clientWidth || 50, { flip: true });
    } else if (id === 'tournament') {
      m.innerHTML = '<i class="mm-face a"></i><b class="mm-deco cup">🏆</b><i class="mm-face b"></i>';
      const [a, c] = m.querySelectorAll('.mm-face');
      ctx.paintHead(a, 'legendary', 3, a.clientWidth || 50);
      ctx.paintHead(c, 'legendary', 5, c.clientWidth || 50, { flip: true });
    } else {
      m.innerHTML = '<i class="mm-face"></i><b class="mm-deco cone">🎯</b>';
      ctx.paintHead(m.querySelector('.mm-face'), pick.me.rarity, pick.me.number, m.querySelector('.mm-face').clientWidth || 60);
    }
  }
  function enterMode(id) {
    if (id === 'arcade') openSelect('arcade');
    else if (id === 'practice') openSelect('practice');
    // a tournament under way goes straight back to its bracket
    else if (id === 'tournament') { if (ctx.tour.get() && !TOUR.finished(ctx.tour.get())) openBracket(); else openSelect('tournament'); }
    else openMp();
  }
  function openModes() {
    show('modes');
    const sub = (id) => row.querySelector(`[data-mode="${id}"] .mn-sub`);
    sub('arcade').textContent = ARC.campaignComplete(state.prog) ? 'כל 45 האלופים ✓' : `שלב ${ARC.currentStage(state.prog)}/${ARC.STAGE_COUNT}`;
    const t = ctx.tour.get();
    sub('tournament').textContent = t && !TOUR.finished(t) ? `בתהליך · ${TOUR.ROUNDS[t.round]}` : '8 שחקנים · גביע';
    sub('multi').innerHTML = 'עם חבר <span class="online-count"></span>';
    sub('practice').textContent = 'נגד המחשב';
    ctx.refreshOnline?.();
    for (const b of row.children) paintMascot(b);
  }
  tap('#mdBack', () => openMenu());

  // ── PLAYER SELECT ──────────────────────────────────────────────────────
  // HS: your character on the left, the CPU's on the right, each a vertical reel; the match
  // counter in a tab on the panel's top edge, the last score under it, a pill on each side, a
  // VS between the two flags, the stars under the CPU's, its row of icons, then SHOP, the
  // stats and PLAY along the bottom. Ours puts a rarity gem where your flag goes and the tier's
  // badge where the CPU's does, and the champion's power where HS lists its achievements.
  const champs = ctx.champions;
  const foeStage = () => (selMode === 'arcade' ? state.sel : practiceFoe);
  const powerOf = (card) => ctx.shotFor(card, { arcade: selMode === 'arcade' });
  // your reel: the vertical one, or in the tournament HS's sideways one
  const meReel = () => (selMode === 'tournament' && reelCup ? reelCup : reelMe);
  const meCard = () => meList[meReel() ? meReel().index : 0];
  const resetMe = (count, i) => { reelMe?.reset(count, i); reelCup?.reset(count, i); };

  function hexHTML({ caged = false, plate = '', badge = '', color = '#fe0034', done = false } = {}) {
    return `<span class="m-hex"><i class="m-face"></i>${caged ? '<i class="m-cage"></i>' : ''}${plate ? `<b class="m-plate">${plate}</b>` : ''}` +
      `${badge ? `<span class="m-badge" style="--c:${color}">${badge}</span>` : ''}${done ? '<span class="m-done">✓</span>' : ''}</span>`;
  }
  function paintMe(i, item) {
    const c = meList[i], shot = powerOf(c);
    item.innerHTML = hexHTML({ caged: !c.owned, plate: c.owned ? '' : 'לא באלבום', badge: shot.icon || '⚡', color: MN.RARITY_COLOR[c.rarity] });
    const f = item.querySelector('.m-face');
    ctx.paintHead(f, c.rarity, c.number, f.clientWidth || 120, { h: f.clientHeight || undefined, fill: 0.86 });   // the whole champion, hat to chin, inside the hexagon
  }
  function paintFoe(i, item) {
    const c = champs[i], st = selMode === 'arcade' ? ARC.stageStatus(state.prog, c.stage) : 'available';
    item.innerHTML = hexHTML({ caged: st === 'locked', badge: c.icon, color: c.color, done: st === 'completed' });
    item.classList.add('foe');
    const f = item.querySelector('.m-face');
    ctx.paintHead(f, 'legendary', c.stage, f.clientWidth || 120, { h: f.clientHeight || undefined, flip: true, fill: 0.86 });
  }
  function buildReels() {
    meList = MN.charReel(ctx.owns);
    // a card no longer in the list (another rarity, saved before there was one list) gives way to
    // the first one you can play: your starter
    let iMe = MN.charIndex(meList, pick.me);
    if (iMe < 0 || !meList[iMe].owned) { iMe = Math.max(0, meList.findIndex((c) => c.owned)); pick.me = { rarity: meList[iMe].rarity, number: meList[iMe].number }; }
    if (!reelMe) reelMe = createReel($('#reelMe'), { count: meList.length, index: iMe, paint: paintMe, onSelect: onMe, onTap: () => openCards('select') });
    else reelMe.reset(meList.length, iMe);
    if (selMode === 'tournament') {
      if (!reelCup) reelCup = createReel($('#reelCup'), { count: meList.length, index: iMe, paint: paintMe, onSelect: onMe, onTap: () => openCards('select'), axis: 'x' });
      else reelCup.reset(meList.length, iMe);
    }
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
    if (mode === 'arcade' && stage) state.sel = stage;
    if (mode === 'practice') pick.foe = { ...champs[practiceFoe - 1].card };
    show('select');
    $('#select').classList.toggle('practice', mode === 'practice');
    $('#select').classList.toggle('tournament', mode === 'tournament');
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
    const arcade = selMode === 'arcade', cup = selMode === 'tournament';
    $('#selH').textContent = arcade ? 'בחר שחקן' : cup ? 'טורניר' : 'אימון חופשי';
    $('#selTabK').textContent = arcade ? 'שלב' : cup ? 'בחרו שחקן' : 'אימון';
    $('#selTabV').textContent = arcade ? `${n}/${ARC.STAGE_COUNT}` : cup ? 'לטורניר' : ctx.difficulties[pick.level].name;
    const sc = arcade ? ARC.lastScore(state.prog, n) : null;
    $('#selScore').textContent = sc ? `${sc[0]} : ${sc[1]}` : '';
    $('#selScore').classList.toggle('hidden', !sc);
    // no rarity and no tier on this screen (Idan): one list of characters, and the opponent's
    // league is not written under it
    const me = meCard();
    $('#selFoeTag').textContent = arcade ? 'אלוף' : 'יריב';
    stars($('#selStars'), arcade ? c.hs.stars : MN.levelStars(pick.level));
    $('#selDiff').classList.toggle('hidden', arcade || cup);
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
    if (st === 'locked' && !cup) {
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
    play.innerHTML = `<b>${why || (cup ? 'הבא' : 'שחק')}</b>`;     // HS's tournament select says NEXT
  }
  const barHTML = (lv, next = -1) => Array.from({ length: 10 }, (_, i) => `<i class="${i < lv ? 'on' : i === next ? 'next' : ''}"></i>`).join('');
  tap('#selBack', () => openModes());
  tap('#selShop', () => openShop());
  tap('#selPlay', () => play());
  function play() {
    if ($('#selPlay').disabled) return;
    if (selMode === 'arcade') ctx.play.arcade(reelFoe.index + 1);
    else if (selMode === 'tournament') { ctx.tour.start({ ...pick.me }); seen.clear(); openBracket(); }
    else ctx.play.practice();
  }
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

  // ── THE TOURNAMENT'S BRACKET ───────────────────────────────────────────
  // HS: before you press PLAY the round's other matches are already played — each winner JUMPS
  // up its line to the next node, one match after another, and its score shows under it: the
  // loser's goals in red, the winner's in blue ("red - blue"). Your own result climbs the same
  // way when you come back from the match. The eight start along the bottom, YOU tagged.
  const LEAF_Y = 82, NODE_Y = [62, 45, 29];
  const leafX = (i) => 6.25 + 12.5 * i;
  const NODE_X = [[12.5, 37.5, 62.5, 87.5], [25, 75], [50]];
  const seen = new Set();                    // matches whose climb has been shown
  let flyTimers = [];
  function headOf(t, slot) {
    const e = t.entrants[slot];
    return e.you ? e.card : { rarity: 'legendary', number: e.stage };
  }
  function openBracket() {
    show('bracket');
    renderBracket();
  }
  function renderBracket() {
    const t = ctx.tour.get();
    if (!t) { openSelect('tournament'); return; }
    flyTimers.forEach(clearTimeout); flyTimers = [];
    const svg = $('#brLines'), nodes = $('#brNodes'), panel = $('.br-panel');
    const W = panel.clientWidth, H = panel.clientHeight;
    // the matches to climb now: decided, not yet shown — round by round, yours first in a round
    const fresh = [];
    for (let r = 0; r < 3; r++) {
      const ms = t.rounds[r].map((m, k) => ({ m, k, r })).filter(({ m, k }) => m.winner !== null && !seen.has(`${r}:${k}`));
      ms.sort((x, y) => (y.m.winner === TOUR.YOU) - (x.m.winner === TOUR.YOU) || ((y.m.a === TOUR.YOU || y.m.b === TOUR.YOU) - (x.m.a === TOUR.YOU || x.m.b === TOUR.YOU)));
      fresh.push(...ms);
    }
    const STEP = 0.55;                        // seconds between two climbs
    const delayOf = new Map(fresh.map((f, n) => [`${f.r}:${f.k}`, 0.35 + n * STEP]));
    let paths = '', html = '';
    // where a match's two sides come from
    const childPos = (r, k, side) => (r === 0
      ? [leafX(t.rounds[0][k][side]), LEAF_Y]
      : [NODE_X[r - 1][k * 2 + (side === 'a' ? 0 : 1)], NODE_Y[r - 1]]);
    // the leaves
    for (let i = 0; i < 8; i++) {
      const e = t.entrants[i], c = e.you ? null : champs[e.stage - 1];
      const m0 = t.rounds[0].find((m) => m.a === i || m.b === i), k0 = t.rounds[0].indexOf(m0);
      const lost = m0.winner !== null && m0.winner !== i;
      const d = delayOf.get(`0:${k0}`);
      html += `<div class="br-leaf${e.you ? ' you' : ''}${lost ? ' out' : ''}${lost && d !== undefined ? ' late' : ''}" style="left:${leafX(i)}%;top:${LEAF_Y}%;--c:${c ? c.color : '#3aa0ff'};--dl:${(d ?? 0) + 0.35}s" data-slot="${i}">
        <span class="m-hex"><i class="m-face"></i></span>${e.you ? '<b class="br-you">אתה</b>' : `<small>${c.title}</small>`}</div>`;
    }
    for (let r = 0; r < 3; r++) {
      const rows = t.rounds[r].length ? t.rounds[r] : NODE_X[r].map(() => null);
      rows.forEach((m, k) => {
        const px = NODE_X[r][k], py = NODE_Y[r];
        const d = delayOf.get(`${r}:${k}`);
        if (m) {
          for (const side of ['a', 'b']) {
            const [cx, cy] = childPos(r, k, side);
            const won = m.winner !== null && m.winner === m[side];
            const top = r === 0 ? cy - 9 : cy - 3, join = (top + py) / 2 + 2;
            paths += `<path class="${won ? 'won' : ''}${won && d !== undefined ? ' fresh' : ''}" style="--dl:${(d ?? 0) + 0.3}s" d="M${cx} ${top} V${join} H${px} V${py + 3}"/>`;
          }
        }
        if (m && m.winner !== null) {
          // the winner's head starts on its own spot and jumps up to this node
          const side = m.winner === m.a ? 'a' : 'b', [cx, cy] = childPos(r, k, side);
          const dx = ((cx - px) / 100) * W, dy = ((cy - py) / 100) * H;
          const wg = m.score[side === 'a' ? 0 : 1], lg = m.score[side === 'a' ? 1 : 0];
          html += `<div class="br-node won${d !== undefined ? ' fly' : ''}${m.winner === TOUR.YOU ? ' you' : ''}" style="left:${px}%;top:${py}%;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--dl:${d ?? 0}s" data-w="${m.winner}">
            <span class="m-hex"><i class="m-face"></i></span><span class="br-score" dir="ltr"><b class="l">${lg}</b>-<b class="w">${wg}</b></span></div>`;
        } else {
          const mine = m && (m.a === TOUR.YOU || m.b === TOUR.YOU) && !t.out;
          html += `<div class="br-node${mine ? ' next' : ''}" style="left:${px}%;top:${py}%"><b>?</b></div>`;
        }
      });
    }
    svg.innerHTML = paths;
    nodes.innerHTML = html;
    for (const el of nodes.querySelectorAll('.br-leaf')) {
      const h = headOf(t, +el.dataset.slot), f = el.querySelector('.m-face');
      ctx.paintHead(f, h.rarity, h.number, f.clientWidth || 44, { flip: +el.dataset.slot % 2 === 1 });
    }
    for (const el of nodes.querySelectorAll('.br-node.won')) {
      const h = headOf(t, +el.dataset.w), f = el.querySelector('.m-face');
      ctx.paintHead(f, h.rarity, h.number, f.clientWidth || 36);
    }
    // a hop sound as each lands, and PLAY waits until the round has played out (HS)
    const go = $('#brGo');
    fresh.forEach((f, n) => flyTimers.push(setTimeout(() => ctx.sfx?.('tick'), (0.35 + n * STEP + 0.35) * 1000)));
    fresh.forEach((f) => seen.add(`${f.r}:${f.k}`));
    const busy = fresh.length ? (0.35 + fresh.length * STEP + 0.3) * 1000 : 0;
    go.disabled = !!busy;
    if (busy) flyTimers.push(setTimeout(() => { go.disabled = false; }, busy));
    $('#brEarned').textContent = fmt(t.earned);
    $('#brRound').textContent = t.champion ? 'אלופים!' : t.out ? 'הטורניר הסתיים' : TOUR.ROUNDS[t.round];
    const ym = TOUR.yourMatch(t);
    if (ym) {
      $('#brMsg').innerHTML = `${TOUR.ROUNDS[t.round]} · נגד <b>${champs[ym.stage - 1].title}</b>`;
      go.innerHTML = '<b>שחק!</b>';
    } else {
      const r = TOUR.reached(t, TOUR.YOU);
      $('#brMsg').innerHTML = t.champion ? '🏆 זכיתם בטורניר!' : `הודחתם ב${TOUR.ROUNDS[r]}. ננסה שוב?`;
      go.innerHTML = '<b>טורניר חדש</b>';
    }
    if (t.champion && fresh.some((f) => f.r === 2)) flyTimers.push(setTimeout(showChampion, busy + 300));
  }
  function showChampion() {
    const t = ctx.tour.get();
    if (!t?.champion || screen !== 'bracket') return;
    $('#brWinPts').textContent = '+' + fmt(t.earned);
    $('#brWin').classList.remove('hidden');       // shown first: the face is sized off its real box
    const f = $('#brWinFace'), me = ctx.tour.get().entrants[TOUR.YOU].card;
    ctx.paintHead(f, me.rarity, me.number, f.clientWidth || 80, { expr: 'happy' });
    ctx.sfx?.('swish');
  }
  tap('#brGo', () => {
    const t = ctx.tour.get();
    if (TOUR.yourMatch(t)) ctx.play.tournament();
    else { ctx.tour.clear(); seen.clear(); openSelect('tournament'); }
  });
  tap('#brBack', () => openModes());           // the tournament waits: the menu's pill says so
  tap('#brWinOk', () => $('#brWin').classList.add('hidden'));

  // ── YOUR CARD: the album, in a popup ───────────────────────────────────
  function openCards(from) {
    cardsFor = from;
    renderCards();
    openPop('cardsPop');
  }
  function renderCards() {
    // the same one list as Player Select's reel: your starter, then the legendary cards
    const grid = $('#cardGrid');
    grid.innerHTML = '';
    MN.charReel(ctx.owns).forEach(({ rarity, number: n, owned }, i) => {
      const b = document.createElement('button');
      b.className = 'cd' + (owned ? '' : ' locked') + (pick.me.rarity === rarity && pick.me.number === n ? ' sel' : '');
      b.style.backgroundImage = `url("${ctx.cardUrl(rarity, n)}")`;
      if (rarity === 'mythic') {                                   // a portrait, not a card: shown whole
        b.classList.add('myth');
        b.style.backgroundImage += ', radial-gradient(circle at 50% 42%, #ff5fd266, #2a1030 72%)';
      }
      b.innerHTML = rarity === 'mythic' ? '' : `<b>${n}</b>`;
      if (!owned) b.title = 'לא באלבום שלך';
      b.onclick = () => {
        if (!owned) return;
        pick.me = { rarity, number: n };
        closePop('cardsPop');
        if (cardsFor === 'mp') renderMp();
        else if (cardsFor === 'menu') paintHome();
        else { meList = MN.charReel(ctx.owns); resetMe(meList.length, i); renderSelect(); }
      };
      grid.appendChild(b);
    });
  }
  on('#cardsX', () => closePop('cardsPop'));

  // ── SHOP ────────────────────────────────────────────────────────────────
  // HS: BACK, the folder tabs, a row per stat — name, price, ten dots, Buy — and MY POINT at
  // the bottom. One tab: we have no costumes, pets or bodies.
  function openShop(from = 'select') {
    shopFrom = from;
    shownPts = state.stats.points;
    show('shop');
    renderShop();
    const f = $('#shopFace');
    ctx.paintHead(f, pick.me.rarity, pick.me.number, f.clientWidth || 100);
    $('#shopName').textContent = MN.charName(pick.me);
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
  const leaveShop = () => { if (shopFrom === 'menu') openMenu(); else { show('select'); renderSelect(); } };
  tap('#shopBack', leaveShop);

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
  tap('#oTut', () => { closePop('optPop'); ctx.startTutorial?.(true); });
  tap('#oStats', () => openStats());
  tap('#oBack', () => closePop('optPop'));
  on('#optPop', (e, el) => { if (e.target === el) closePop('optPop'); });
  function openStats({ profile = false } = {}) {
    $('#statsH').textContent = profile ? 'הפרופיל שלי' : 'סטטיסטיקה';
    $('#stNameRow').hidden = !profile;
    $('#stName').value = pick.name || '';
    const p = state.prog, rec = Object.values(p.record);
    const w = rec.reduce((s, r) => s + r.w, 0), l = rec.reduce((s, r) => s + r.l, 0);
    const lv = Object.values(state.stats.lv).reduce((s, v) => s + v, 0);
    const rows = [['אלופים שהובסו', `${p.cleared} / ${ARC.STAGE_COUNT}`], ['ניצחונות בארקייד', w], ['הפסדים בארקייד', l],
      ['נקודות סולטיז', `<i class="coin"></i> ${fmt(state.stats.points)}`], ['רמות שדרוג', `${lv} / 50`]];
    // the team and the arena (team.js, arena.js), first
    if (profile && ctx.profileRows) rows.unshift(...ctx.profileRows());
    $('#statsList').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    openPop('statsPop');
  }
  on('#statsX', () => closePop('statsPop'));
  // the same name the multiplayer popup keeps ("MAX 10 · AUTO SAVE")
  $('#stName').addEventListener('input', (e) => {
    pick.name = MN.cleanName(e.target.value);
    try { ctx.store?.setItem(MN.NAME_KEY, pick.name); } catch { /* private mode */ }
    $('#hmName').textContent = pick.name;
  });

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
    $('#mpCardName').textContent = MN.charName(pick.me);
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
    if (document.body.classList.contains('tut-on')) return;      // the tutorial has the keys (tutorial.js guard)
    if (document.body.classList.contains('st-on')) return;       // …and the starter pick has them before it (starter.js)
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
      if ((k === 'Enter' || k === 'NumpadEnter') && !(t?.tagName === 'BUTTON')) act = () => openModes();
    } else if (screen === 'modes') {
      if (k === 'Escape') act = () => openMenu();
    } else if (screen === 'select') {
      const reel = selMode === 'tournament' ? reelCup : e.shiftKey ? reelMe : reelFoe;
      if (k === 'ArrowDown' || (selMode === 'tournament' && k === 'ArrowRight')) act = () => reel.step(1);
      else if (k === 'ArrowUp' || (selMode === 'tournament' && k === 'ArrowLeft')) act = () => reel.step(-1);
      else if (k === 'Home') act = () => reel.select(0);
      else if (k === 'End') act = () => reel.select(reel === reelFoe ? champs.length - 1 : meList.length - 1);
      else if ((k === 'Enter' || k === 'NumpadEnter') && !(t?.tagName === 'BUTTON')) act = play;
      else if (k === 'Escape') act = () => openModes();
    } else if (screen === 'shop') {
      if (k === 'Escape') act = leaveShop;
    } else if (screen === 'bracket') {
      if (!$('#brWin').classList.contains('hidden')) { if (k === 'Escape' || k === 'Enter') act = () => $('#brWin').classList.add('hidden'); }
      else if (k === 'Enter' || k === 'NumpadEnter') act = () => $('#brGo').click();
      else if (k === 'Escape') act = () => openModes();
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
    if (screen === 'select') { reelMe?.repaint(); reelFoe?.repaint(); reelCup?.repaint(); }
    if (screen === 'menu') paintHome();
    if (screen === 'modes') openModes();
  });

  return {
    paintTeam,
    paintHome: () => { if (screen === 'menu') paintHome(); },
    toast,
    show, get screen() { return screen; },
    openTitle, openMenu, openModes, openSelect, openShop, openHowTo, openOptions, openMp, openBracket,
    get selMode() { return selMode; },
    closePops: () => POPS.forEach(closePop),
    syncSound, renderPoints,
    selectStage: (n) => { if (screen !== 'select') openSelect('arcade', { stage: n }); else reelFoe.select(n - 1); },
  };
}
