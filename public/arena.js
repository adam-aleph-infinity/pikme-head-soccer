// THE ARENA ON SCREEN (shared/arena.js has the rules, server/league.js decides; arena.css the look).
//
//   searching  you on the left, a roulette of faces on the right, a clock, a cancel — then the VS
//              card when the server finds someone: their nickname, team and trophies, the arena
//   result     on HS's result panel: the trophies counting up (or down), the daily star, the bonus;
//              a new arena opens with a reveal of its own
//   the road   Clash Royale's Trophy Road, laid sideways: a node every 100, a gate per arena, your
//              marker, and a CLAIM on every prize your best has reached
//   the board  the leaderboard (Idan: teams + your rank): the four teams this week, last week's
//              winner, and where you stand — a number, never another kid's name
//
// Everything shown comes from the server's profile (ctx.profile()); nothing here is counted on the
// phone.
import * as A from '../shared/arena.js';
import * as T from '../shared/teams.js';
import { MYTHIC } from '../shared/mythics.js';
import { badgeSVG, timeLeft } from './team.js';
import { TROPHY } from './home-icons.js';

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const PLACE = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '4' };

export function createArena(ctx) {
  const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstElementChild; document.body.appendChild(el); return el; };
  const later = (f) => requestAnimationFrame(() => requestAnimationFrame(f));
  const teamTag = (t) => { const x = T.teamById(t); return x ? `<span class="af-team" style="--tc:${x.color};--td:${x.dark}"><i class="hm-tbdg">${badgeSVG(x)}</i>${x.title}</span>` : ''; };

  // ═══ SEARCHING, THEN VS ═══
  const find = mk(`<div class="af hidden" id="arFind" role="dialog" aria-modal="true" aria-label="קרב בזירה">
    <i class="m-rays" aria-hidden="true"></i>
    <div class="af-top"><b class="af-arena" id="afArena"></b><small class="af-aname" id="afAName"></small></div>
    <div class="af-row">
      <div class="af-side me"><i class="af-face" id="afMe"></i><b class="af-name" id="afMeName"></b><span id="afMeTeam"></span><span class="af-cups" id="afMeCups"></span></div>
      <b class="af-vs">VS</b>
      <div class="af-side opp"><i class="af-face" id="afOpp"></i><b class="af-name" id="afOppName"></b><span id="afOppTeam"></span><span class="af-cups" id="afOppCups"></span></div>
    </div>
    <p class="af-msg" id="afMsg"></p>
    <button class="m-pill red sm af-cancel" id="afCancel"><b>ביטול</b></button>
  </div>`);
  const $f = (s) => find.querySelector(s);
  let spin = 0, clock = 0, t0 = 0, state = null;           // null | 'search' | 'vs'
  const cupsHTML = (n) => `<i class="af-cup">${TROPHY}</i>${fmt(n)}`;
  // the faces that roll while it searches: the four Mythics and a few champions
  const ROLL = [[MYTHIC, 1], [MYTHIC, 2], [MYTHIC, 3], [MYTHIC, 4], ['legendary', 3], ['legendary', 12], ['legendary', 27], ['legendary', 40]];
  function paintMe() {
    const p = ctx.profile(), me = ctx.me();
    ctx.paintHead($f('#afMe'), me.rarity, me.number, $f('#afMe').clientWidth || 120, { expr: 'normal', fill: 1 });
    $f('#afMeName').textContent = ctx.myName();
    $f('#afMeTeam').innerHTML = teamTag(ctx.starter());
    $f('#afMeCups').innerHTML = ctx.live?.() ? cupsHTML(p?.trophies || 0) : '';     // practice: no trophies to show
    const a = A.arenaOf(p?.trophies || 0);
    $f('#afArena').textContent = ctx.live?.() ? `זירה ${a.n}` : 'זירת אימון';
    $f('#afAName').textContent = ctx.live?.() ? a.name : 'משחק אימון · הגביעים בקרוב!';
  }
  function search({ again = false } = {}) {
    state = 'search';
    find.classList.remove('hidden', 'vs');
    $f('#afOppName').textContent = '?';
    $f('#afOppTeam').innerHTML = '';
    $f('#afOppCups').innerHTML = '';
    $f('#afCancel').classList.remove('hidden');
    t0 = performance.now();
    later(paintMe);
    let k = 0;
    clearInterval(spin);
    spin = setInterval(() => {
      const [r, n] = ROLL[k++ % ROLL.length];
      ctx.paintHead($f('#afOpp'), r, n, $f('#afOpp').clientWidth || 120, { expr: 'normal', flip: true, fill: 1 });
      $f('#afOpp').classList.remove('tick'); void $f('#afOpp').offsetWidth; $f('#afOpp').classList.add('tick');
    }, 140);
    clearInterval(clock);
    const say = again ? 'היריב יצא. מחפשים שוב' : 'מחפשים יריב';
    const paintClock = () => { const s = Math.floor((performance.now() - t0) / 1000); $f('#afMsg').textContent = `${say}${'.'.repeat(1 + (s % 3))}  0:${String(s).padStart(2, '0')}`; };
    paintClock();
    clock = setInterval(paintClock, 500);
    ctx.sfx?.('swish');
  }
  // the server found someone: the VS card until kick-off
  function found(msg) {
    state = 'vs';
    clearInterval(spin); clearInterval(clock);
    find.classList.remove('hidden');
    find.classList.add('vs');
    $f('#afCancel').classList.add('hidden');
    const a = A.ARENAS[(msg.arena || 1) - 1];
    $f('#afArena').textContent = msg.practice ? 'זירת אימון' : `זירה ${a.n}`;
    $f('#afAName').textContent = msg.practice ? 'משחק אימון · הגביעים בקרוב!' : a.name;
    $f('#afOppName').textContent = msg.opp.name;
    $f('#afOppTeam').innerHTML = teamTag(msg.opp.team);
    $f('#afOppCups').innerHTML = msg.practice ? '' : cupsHTML(msg.opp.trophies);
    $f('#afMeCups').innerHTML = msg.practice ? '' : cupsHTML(msg.me.trophies);
    ctx.paintHead($f('#afOpp'), msg.opp.card.rarity, msg.opp.card.number, $f('#afOpp').clientWidth || 120, { expr: 'normal', flip: true, fill: 1 });
    $f('#afMsg').textContent = 'מתחילים!';
    ctx.sfx?.('whistle');
  }
  function hide() { state = null; clearInterval(spin); clearInterval(clock); find.classList.add('hidden'); }
  $f('#afCancel').addEventListener('click', () => { if (state !== 'search') return; ctx.sfx?.('tap'); ctx.cancel(); hide(); });

  // ═══ THE RESULT: trophies on HS's result panel ═══
  function resultInto(panel, res) {
    let box = panel.querySelector('.oa');
    if (!box) { box = document.createElement('div'); box.className = 'oa'; panel.querySelector('#ovPts').after(box); }
    box.classList.remove('hidden');
    if (!res) { box.innerHTML = '<span class="oa-wait">…</span>'; return; }
    // practice (the trophies are not live yet): no number, just what it was
    if (res.practice) {
      box.innerHTML = `<span class="oa-practice"><i class="af-cup">${TROPHY}</i>משחק אימון · הגביעים בקרוב!</span>
        ${res.forfeit && res.result === 'win' ? '<small class="oa-team">היריב יצא, הניצחון שלכם!</small>' : ''}`;
      return;
    }
    const sign = res.delta > 0 ? '+' : res.delta < 0 ? '−' : '±';
    box.innerHTML = `<span class="oa-cups ${res.delta > 0 ? 'up' : res.delta < 0 ? 'down' : ''}"><i class="af-cup">${TROPHY}</i><b>${sign}${fmt(Math.abs(res.delta))}</b></span>
      <span class="oa-tot"><small>גביעים</small><b id="oaTot">${fmt(res.trophies - res.delta)}</b></span>
      ${res.bonus ? `<span class="oa-bonus"><small>בונוס ניצחון יומי ${'★'.repeat(res.dailyWins)}${'☆'.repeat(Math.max(0, A.DAILY.length - res.dailyWins))}</small><b><i class="coin"></i>+${fmt(res.bonus)}</b></span>` : ''}
      ${res.counted ? `<small class="oa-team"><bdi dir="ltr">+${fmt(res.counted)}</bdi> ל${T.teamOf(ctx.starter())?.title || 'קבוצה'}!</small>` : ''}
      ${res.forfeit && res.result === 'win' ? '<small class="oa-team">היריב יצא, הניצחון שלכם!</small>' : ''}`;
    ctx.countUp?.(box.querySelector('#oaTot'), res.trophies - res.delta, res.trophies);
    if (res.newArena) setTimeout(() => reveal(res.newArena), 1500);
  }
  const clearResult = (panel) => panel.querySelector('.oa')?.classList.add('hidden');

  // ═══ A NEW ARENA ═══
  const rv = mk(`<div class="ar-rv hidden" id="arReveal" role="dialog" aria-modal="true" aria-label="זירה חדשה">
    <i class="ar-rv-rays"></i><div class="ar-rv-box"><small>זירה חדשה!</small><b class="ar-rv-n" id="arRvN"></b><b class="ar-rv-name" id="arRvName"></b>
    <p>יריבים חזקים יותר, ופרסים גדולים יותר!</p><button class="m-pill big glint" id="arRvOk"><b>יאללה!</b></button></div></div>`);
  function reveal(n) {
    const a = A.ARENAS[n - 1];
    if (!a) return;
    rv.querySelector('#arRvN').textContent = `זירה ${a.n}`;
    rv.querySelector('#arRvName').textContent = a.name;
    rv.classList.remove('hidden');
    ctx.sfx?.('buy');
  }
  rv.querySelector('#arRvOk').addEventListener('click', () => { ctx.sfx?.('tap'); rv.classList.add('hidden'); });

  // ═══ THE TROPHY ROAD ═══
  const road = mk(`<div class="ar-road hidden" id="arRoad" role="dialog" aria-modal="true" aria-label="דרך הגביעים">
    <button class="m-back" id="arRoadBack"><i></i>חזרה</button>
    <div class="ar-rh"><b class="m-title sm">דרך הגביעים</b><span class="ar-rme" id="arRoadMe"></span></div>
    <div class="ar-track" id="arTrack"><div class="ar-line" id="arLine"><i class="ar-fill" id="arFill"></i></div></div>
    <p class="ar-rhint" id="arRoadHint"></p>
  </div>`);
  const NODE_W = 13;                                       // --u per 100 trophies
  function paintRoad() {
    const p = ctx.profile(), best = p?.best || 0, claimed = p?.road || 0;
    const line = road.querySelector('#arLine');
    road.querySelector('#arRoadMe').innerHTML = `<i class="af-cup">${TROPHY}</i>${fmt(p?.trophies || 0)} · זירה ${A.arenaOf(p?.trophies || 0).n}`;
    line.style.setProperty('--n', A.ROAD_NODES);
    line.style.setProperty('--w', NODE_W);
    road.querySelector('#arFill').style.width = `calc(var(--u) * ${NODE_W} * ${Math.min(A.ROAD_NODES, best / A.ROAD_STEP)})`;
    line.querySelectorAll('.ar-node, .ar-you').forEach((e) => e.remove());
    const parts = [];
    for (let i = 1; i <= A.ROAD_NODES; i++) {
      const pr = A.roadPrize(i), st = i <= claimed ? 'done' : A.canClaim(i, best, claimed) ? 'ready' : A.roadAt(i) <= best ? 'wait' : 'locked';
      const x = `calc(var(--u) * ${NODE_W} * ${i})`;
      // every node: its dot on the line, its trophies and prize under it, then CLAIM or ✓; a gate's card
      // (the arena) stands over the line, clear of everything else
      const a = pr.gate && A.ARENAS[pr.gate - 1];
      parts.push(`<div class="ar-node ${pr.gate ? 'gate ' : ''}${st}" style="left:${x}">${a ? `<div class="ar-card"><b>זירה ${a.n}</b><span>${a.name}</span></div>` : ''}
        <i class="ar-dot"></i><small>${fmt(A.roadAt(i))}</small><em><i class="coin"></i>${fmt(pr.points)}</em>
        ${st === 'ready' ? `<button class="m-pill sm glint ar-claim" data-i="${i}"><b>קבלו!</b></button>` : st === 'done' ? '<i class="ar-ok">✓</i>' : ''}</div>`);
    }
    parts.push(`<i class="ar-you" style="left:calc(var(--u) * ${NODE_W} * ${Math.min(A.ROAD_NODES, (p?.trophies || 0) / A.ROAD_STEP)})"><b>אתם</b></i>`);
    line.insertAdjacentHTML('beforeend', parts.join(''));
    line.querySelectorAll('.ar-claim').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); b.disabled = true; ctx.sfx?.('tap'); ctx.claimRoad(+b.dataset.i); }));
    const waiting = A.roadWaiting(best, claimed);
    road.querySelector('#arRoadHint').textContent = !p ? 'מתחברים לשרת…' : waiting ? `מחכים לכם ${waiting} פרסים!` : `הפרס הבא ב-${fmt(A.roadAt(claimed + 1))} גביעים`;
  }
  function openRoad() {
    road.classList.remove('hidden');
    paintRoad();
    later(() => {
      const p = ctx.profile(), track = road.querySelector('#arTrack');
      const u = Math.min(innerHeight / 100, innerWidth * 0.5625 / 100);
      const i = Math.min((p?.road || 0) + 1, Math.floor((p?.best || 0) / A.ROAD_STEP) + 1);
      track.scrollLeft = Math.max(0, u * NODE_W * i - track.clientWidth / 2);
    });
  }
  road.querySelector('#arRoadBack').addEventListener('click', () => { ctx.sfx?.('tap'); road.classList.add('hidden'); ctx.onClose?.(); });
  // the server paid a node (or refused it)
  function roadDone(msg) {
    if (!road.classList.contains('hidden')) paintRoad();
    if (msg.ok) {
      const n = road.querySelector(`.ar-claim[data-i="${msg.i}"]`)?.closest('.ar-node');
      n?.classList.add('pop');
      if (msg.prize?.gate) reveal(msg.prize.gate);
    }
  }

  // ═══ THE LEADERBOARD ═══
  const board = mk(`<div class="m-pop hidden ar-board" id="arBoard" role="dialog" aria-modal="true" aria-label="דירוג">
    <div class="m-panel plain ar-bbox"><button class="m-x" id="arBoardX" aria-label="סגור">✕</button>
      <b class="ar-bh">דירוג</b><div class="ar-brank" id="arBRank"></div>
      <div class="ar-bweek"><b>הקבוצות השבוע</b><small id="arBWhen"></small></div><div class="tm-rows" id="arBRows"></div>
      <p class="ar-blast" id="arBLast"></p>
      <button class="m-pill sm" id="arBTeam"><b>לקבוצה שלי</b></button>
    </div></div>`);
  function paintBoard() {
    const p = ctx.profile(), w = p?.week;
    board.querySelector('#arBRank').innerHTML = p
      ? `<small>המקום שלכם</small><b>#${fmt(p.rank)}</b><small>מתוך ${fmt(p.total)} שחקנים · <i class="af-cup">${TROPHY}</i>${fmt(p.trophies)}</small>`
      : '<small>מתחברים לשרת…</small>';
    board.querySelector('#arBWhen').textContent = !w ? '' : w.phase === 'break' ? 'השבוע נגמר!' : timeLeft(w.end - (Date.now() + (ctx.clockSkew?.() || 0)));
    const meTeam = w?.me?.team || ctx.starter(), top = Math.max(1, ...(w?.standings || []).map((s) => s.score));
    board.querySelector('#arBRows').innerHTML = (w?.standings || []).map((s) => {
      const x = T.teamById(s.team);
      return `<div class="tm-row${s.team === meTeam ? ' me' : ''}" style="--tc:${x.color};--td:${x.dark};--tg:${x.glow}">
        <b class="tm-rank">${s.active ? PLACE[s.rank] : '–'}</b><i class="tm-bdg">${badgeSVG(x)}</i><b class="tm-tn">${x.title}</b>
        <i class="tm-bar"><i style="width:${s.active ? Math.max(4, (100 * s.score) / top) : 0}%"></i></i><b class="tm-sc">${s.active ? fmt(s.score) : '0'}</b></div>`;
    }).join('');
    const lw = p?.last?.winner && T.teamById(p.last.winner);
    board.querySelector('#arBLast').innerHTML = lw ? `בשבוע שעבר ניצחה <b style="color:${lw.color}">${lw.title}</b> 🏆` : '';
  }
  function openBoard() { paintBoard(); board.classList.remove('hidden'); }
  const closeBoard = () => board.classList.add('hidden');
  board.querySelector('#arBoardX').addEventListener('click', closeBoard);
  board.querySelector('#arBTeam').addEventListener('click', () => { closeBoard(); ctx.openTeam?.(); });

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!board.classList.contains('hidden')) closeBoard();
    else if (!road.classList.contains('hidden')) road.querySelector('#arRoadBack').click();
    else if (state === 'search') $f('#afCancel').click();
  }, true);
  addEventListener('resize', () => { if (state) later(paintMe); });

  return {
    search, found, hide, resultInto, clearResult, reveal, openRoad, roadDone, openBoard,
    oppLeft: () => search({ again: true }),
    refresh() { if (!road.classList.contains('hidden')) paintRoad(); if (!board.classList.contains('hidden')) paintBoard(); },
    get searching() { return state === 'search'; },
    get on() { return !!state; },
    get roadOn() { return !road.classList.contains('hidden'); },
    get boardOn() { return !board.classList.contains('hidden'); },
  };
}
