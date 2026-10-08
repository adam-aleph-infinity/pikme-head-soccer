// THE TEAMS ON SCREEN (shared/teams.js has the rules; team.css the look; docs/TEAMS-ARENA.md the why).
//
//   the badge      a hexagon in the team's colour with the Mythic Gem in it — Saltiz's hexagon, the
//                  starters' gem; it stands for the team everywhere (starter, home, VS, standings)
//   the intro      three cards and a tap each, said by your team's leader (Idan: "the team leader
//                  explains"), as Pokémon GO's leaders greet you: who you are, the four teams and the
//                  week, what you can win. The tutorial plays it after the shop; a player who had a
//                  starter before teams existed sees it once on the home screen instead.
//   the screen     your team: the leader, this week's standings, what you gave, the prizes, the switch
//   the prize      "your team won!" — a week's prize, shown on the first launch after it
//   the switch     one free switch, and the champion goes with the team (Idan)
//
// For kids: big words, few of them, pictures in place of sentences. No chat, no other player's name:
// the standings are the four teams, and "you" is the only player on this screen.
import * as T from '../shared/teams.js';
import { MYTHIC, MYTHICS } from '../shared/mythics.js';
import { TROPHY } from './home-icons.js';

// ── THE BADGE ──
export function badgeSVG(team) {
  const t = typeof team === 'object' ? team : T.teamById(team);
  if (!t) return '';
  return `<svg viewBox="0 0 40 44" aria-hidden="true">
    <path d="M20 2 37 11.5v21L20 42 3 32.5v-21z" fill="${t.color}" stroke="${t.dark}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M20 6.6 33 13.9v16.2L20 37.4 7 30.1V13.9z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"/>
    <path d="M12.5 17.5h15l4 5L20 35 8.5 22.5z" fill="#fff" stroke="${t.dark}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M8.5 22.5h23M12.5 17.5l4 5 3.5 12.5 3.5-12.5 4-5" fill="none" stroke="${t.dark}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M14 19h4.5l-2 2.6z" fill="${t.glow}"/></svg>`.replace(/>\s+</g, '><');
}
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
// "נשארו 3 ימים" — the time left, in the biggest unit that is at least one
export function timeLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 2) return `נשארו ${d} ימים`;
  if (d === 1) return 'נשאר יום אחד';
  if (h >= 2) return `נשארו ${h} שעות`;
  if (h === 1) return 'נשארה שעה אחת';
  if (m >= 2) return `נשארו ${m} דקות`;
  return 'נשארה דקה!';
}
const PLACE = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '4' };

export function createTeams(ctx) {
  const tint = (el, t) => { el.style.setProperty('--tc', t.color); el.style.setProperty('--td', t.dark); el.style.setProperty('--tg', t.glow); };
  const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstElementChild; document.body.appendChild(el); return el; };
  const myTeam = () => T.teamOf(ctx.starter());
  const later = (f) => requestAnimationFrame(() => requestAnimationFrame(f));

  // ═══ THE INTRO: three cards, a tap each ═══
  const intro = mk(`<div class="ti hidden" id="tmIntro" role="dialog" aria-modal="true" aria-label="הקבוצה שלך">
    <i class="ti-rays"></i>
    <div class="ti-lead"><i class="ti-glow"></i><span class="ti-pod"></span><div class="ti-man"></div></div>
    <div class="ti-box m-panel plain"><div class="ti-art"></div><b class="ti-say"></b>
      <div class="ti-foot"><span class="ti-dots"><i></i><i></i><i></i></span><small class="ti-next">לחצו להמשך</small></div></div>
  </div>`);
  let card = 0, introDone = null, introTeam = null;
  const CARDS = [
    (t) => ({ say: `היי! אני ${t.name}.\nברוכים הבאים לקבוצה שלי!`,
      art: `<span class="ti-badge">${badgeSVG(t)}</span><b class="ti-team">${t.title}</b>` }),
    (t) => ({ say: 'יש 4 קבוצות,\nוכל שבוע הן מתחרות!',
      art: `<span class="ti-four">${T.TEAMS.map((x) => `<span class="ti-t${x.id === t.id ? ' me' : ''}" style="--tc:${x.color};--td:${x.dark}"><i>${badgeSVG(x)}</i><b>${x.name}</b>${x.id === t.id ? '<em>אתם!</em>' : ''}</span>`).join('')}</span>` }),
    (t) => ({ say: ctx.live?.() ? 'נצחו בזירה, אספו גביעים,\nועזרו לקבוצה לזכות בפרסים!' : 'בקרוב: נצחו בזירה, אספו גביעים,\nועזרו לקבוצה לזכות בפרסים!',
      art: `<span class="ti-flow"><span class="ti-step"><i class="ti-cup">${TROPHY}</i><b>נצחו</b></span><i class="ti-arr"></i>
        <span class="ti-step"><i class="ti-bars"><i></i><i></i><i class="me"></i><i></i></i><b>הקבוצה עולה</b></span><i class="ti-arr"></i>
        <span class="ti-step"><i class="ti-gift">🎁</i><b>פרסים!</b></span></span>` }),
  ];
  function showCard(i) {
    card = i;
    const c = CARDS[i](introTeam), box = intro.querySelector('.ti-box');
    intro.querySelector('.ti-art').innerHTML = c.art;
    intro.querySelector('.ti-say').textContent = c.say;
    intro.querySelectorAll('.ti-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    intro.querySelector('.ti-next').textContent = i === CARDS.length - 1 ? 'יאללה!' : 'לחצו להמשך';
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    intro.classList.toggle('c2', i === 2);
  }
  function openIntro(team, then) {
    introTeam = T.teamById(team) || myTeam() || T.TEAMS[0];
    introDone = then || null;
    tint(intro, introTeam);
    intro.classList.remove('hidden');
    showCard(0);
    later(() => ctx.paintStanding?.(intro.querySelector('.ti-man'), { rarity: MYTHIC, number: introTeam.leader }));
    ctx.sfx?.('swish');
  }
  function nextCard() {
    if (intro.classList.contains('hidden')) return;
    ctx.sfx?.('tap');
    if (card < CARDS.length - 1) { showCard(card + 1); return; }
    intro.classList.add('hidden');
    const f = introDone; introDone = null;
    f?.();
  }
  intro.addEventListener('click', nextCard);

  // ═══ THE TEAM SCREEN ═══
  const scr = mk(`<div class="tm hidden" id="tmScr" role="dialog" aria-modal="true" aria-label="הקבוצה שלי">
    <i class="m-rays" aria-hidden="true"></i>
    <button class="m-back" id="tmBack"><i></i>חזרה</button>
    <div class="tm-side">
      <div class="tm-lead"><i class="ti-glow"></i><span class="ti-pod"></span><div class="tm-man"></div></div>
      <div class="tm-name"><span class="tm-badge"></span><b class="tm-title"></b></div>
      <button class="m-pill sm tm-switch" id="tmSwitch"><b>החלפת קבוצה</b></button>
      <small class="tm-swnote" id="tmSwNote"></small>
    </div>
    <div class="m-panel plain tm-panel">
      <div class="tm-top"><b class="tm-h">התחרות השבועית</b><small class="tm-when" id="tmWhen"></small></div>
      <div class="tm-rows" id="tmRows"></div>
      <div class="tm-me" id="tmMe"></div>
      <div class="tm-prizes" id="tmPrizes"></div>
    </div>
    <div class="tm-dev hidden" id="tmDev"></div>
  </div>`);
  const $s = (sel) => scr.querySelector(sel);
  let scrTimer = 0;
  function openScreen() {
    const t = myTeam();
    if (!t) return;
    scr.classList.remove('hidden');
    paintScreen();
    later(() => ctx.paintStanding?.($s('.tm-man'), { rarity: MYTHIC, number: t.leader }));
    clearInterval(scrTimer);
    scrTimer = setInterval(() => { if (scr.classList.contains('hidden')) clearInterval(scrTimer); else paintWhen(); }, 20000);
    ctx.onOpen?.();
  }
  function closeScreen() { scr.classList.add('hidden'); clearInterval(scrTimer); ctx.onClose?.(); }
  const now = () => Date.now() + (ctx.clockSkew?.() || 0);
  function paintWhen() {
    const w = ctx.profile()?.week;
    $s('#tmWhen').textContent = !w ? '' : w.phase === 'break' ? `שבוע חדש מתחיל בעוד ${timeLeft(w.next - now()).replace(/^נשאר[הו]? /, '')}` : timeLeft(w.end - now());
  }
  function paintScreen() {
    const t = myTeam(), p = ctx.profile(), w = p?.week;
    tint(scr, t);
    $s('.tm-badge').innerHTML = badgeSVG(t);
    $s('.tm-title').textContent = t.title;
    // the switch: free once, then gems (not built: shown, never charged)
    const used = !!p?.switched;
    $s('#tmSwitch').innerHTML = used ? `<b>💎 ${T.GEMS_SWITCH_PRICE} · בקרוב</b>` : '<b>החלפת קבוצה</b>';
    $s('#tmSwitch').disabled = used || !p;
    $s('#tmSwNote').textContent = used ? 'את ההחלפה החינמית כבר עשיתם' : 'פעם אחת בחינם (האלוף מתחלף איתה)';
    // the week
    const rows = $s('#tmRows'), me = $s('#tmMe');
    $s('.tm-h').textContent = w?.phase === 'break' ? 'השבוע נגמר!' : 'התחרות השבועית';
    if (!w) {
      rows.innerHTML = `<p class="tm-off">${p ? 'התחרות תתחיל בקרוב!' : 'מתחברים לשרת…<br><small>התחרות תופיע כשיהיה חיבור לאינטרנט</small>'}</p>`;
      me.innerHTML = '';
    } else {
      const meTeam = w.me?.team || t.id, top = Math.max(1, ...w.standings.map((s) => s.score));
      rows.innerHTML = w.standings.map((s) => {
        const x = T.teamById(s.team);
        return `<div class="tm-row${s.team === meTeam ? ' me' : ''}" style="--tc:${x.color};--td:${x.dark}">
          <b class="tm-rank">${s.active ? PLACE[s.rank] : '–'}</b><i class="tm-bdg">${badgeSVG(x)}</i><b class="tm-tn">${x.title}</b>
          <i class="tm-bar"><i style="width:${s.active ? Math.max(4, (100 * s.score) / top) : 0}%"></i></i><b class="tm-sc">${s.active ? fmt(s.score) : '0'}</b></div>`;
      }).join('');
      const m = w.me || { played: 0, wins: 0, counted: 0 };
      const need = Math.max(0, T.ACTIVE_MATCHES - m.played);
      const other = meTeam !== t.id ? `<small class="tm-was">השבוע אתם עוד נחשבים ל${T.teamById(meTeam).title}. מיום ראשון: ל${t.title}!</small>` : '';
      me.innerHTML = (need
        ? `<b>שחקו עוד ${need === 1 ? 'משחק אחד' : need + ' משחקים'} בזירה, וגם אתם בתחרות!</b>`
        : m.counted >= T.CAP
          ? `<b>הגעתם למקסימום השבוע! 💪</b><span>${m.wins} ניצחונות · 🏆 ${fmt(m.counted)}</span>`
          : `<b>התרומה שלכם:</b><span>${m.wins} ניצחונות · 🏆 ${fmt(m.counted)}</span>`) + other;
    }
    paintWhen();
    $s('#tmPrizes').innerHTML = `<span><em>🥇</em><i class="coin"></i>${fmt(T.PRIZES[1].points)} + 🏅</span><span><em>🥈</em><i class="coin"></i>${fmt(T.PRIZES[2].points)}</span><span><em>🥉</em><i class="coin"></i>${fmt(T.PRIZES[3].points)}</span><small>למי ששיחק ${T.ACTIVE_MATCHES} משחקים בשבוע</small>`;
    // dev tools (?teamsim on a dev host): the end of a week without waiting a week
    const dev = $s('#tmDev');
    dev.classList.toggle('hidden', !ctx.dev);
    if (ctx.dev && !dev.children.length) {
      dev.innerHTML = [['seed', 'קבוצות מזויפות'], ['endWeek', 'סיים שבוע'], ['trophies', '+100 גביעים'], ['day', 'איפוס יומי'], ['wipe', 'מחק הכל']]
        .map(([op, l]) => `<button data-op="${op}">${l}</button>`).join('');
      dev.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ctx.dev(b.dataset.op)));
    }
  }
  $s('#tmBack').addEventListener('click', () => { ctx.sfx?.('tap'); closeScreen(); });
  $s('#tmSwitch').addEventListener('click', () => { ctx.sfx?.('tap'); openSwitch(); });

  // ═══ THE SWITCH: pick one of the other three, then are-you-sure ═══
  const sw = mk(`<div class="m-pop hidden tm-sw" id="tmSw" role="dialog" aria-modal="true" aria-label="החלפת קבוצה">
    <div class="m-panel plain tm-swbox"><button class="m-x" id="tmSwX" aria-label="סגור">✕</button>
      <b class="tm-swh">לאיזו קבוצה לעבור?</b><div class="tm-swrow" id="tmSwRow"></div>
      <p class="tm-swq" id="tmSwQ"></p>
      <div class="tm-swbtns"><button class="m-pill red sm" id="tmSwNo"><b>עוד רגע</b></button><button class="m-pill sm glint" id="tmSwYes" disabled><b>כן, להחליף!</b></button></div>
    </div></div>`);
  let swTo = 0;
  function openSwitch() {
    const t = myTeam();
    swTo = 0;
    sw.querySelector('#tmSwRow').innerHTML = T.TEAMS.filter((x) => x.id !== t.id).map((x) => `<button class="tm-swc" data-t="${x.id}" style="--tc:${x.color};--td:${x.dark}"><i class="tm-swf"></i><i class="tm-bdg">${badgeSVG(x)}</i><b>${x.title}</b></button>`).join('');
    sw.querySelectorAll('.tm-swc').forEach((b) => {
      ctx.paintHead?.(b.querySelector('.tm-swf'), MYTHIC, +b.dataset.t, 90, { fill: 1 });
      b.addEventListener('click', () => pickSwitch(+b.dataset.t));
    });
    sw.querySelector('#tmSwQ').textContent = 'האלוף מתחלף יחד עם הקבוצה. אפשר רק פעם אחת בחינם.';
    sw.querySelector('#tmSwYes').disabled = true;
    sw.classList.remove('hidden');
  }
  function pickSwitch(n) {
    ctx.sfx?.('tick');
    swTo = n;
    const from = myTeam(), to = T.teamById(n);
    sw.querySelectorAll('.tm-swc').forEach((b) => b.classList.toggle('sel', +b.dataset.t === n));
    sw.querySelector('#tmSwQ').textContent = `תקבלו את ${MYTHICS[n - 1].name} במקום ${MYTHICS[from.id - 1].name}, ו${from.name} יינעל.\nהניצחונות של השבוע נשארים ל${from.title}.`;
    sw.querySelector('#tmSwYes').disabled = false;
    void to;
  }
  const closeSwitch = () => sw.classList.add('hidden');
  sw.querySelector('#tmSwX').addEventListener('click', closeSwitch);
  sw.querySelector('#tmSwNo').addEventListener('click', closeSwitch);
  sw.querySelector('#tmSwYes').addEventListener('click', async () => {
    if (!swTo) return;
    const btn = sw.querySelector('#tmSwYes');
    btn.disabled = true;
    const r = await ctx.switchTeam?.(swTo);
    if (r?.ok) {
      closeSwitch();
      ctx.sfx?.('buy');
      paintScreen();
      later(() => ctx.paintStanding?.($s('.tm-man'), { rarity: MYTHIC, number: myTeam().leader }));
      openIntro(myTeam().id, null);
    } else {
      sw.querySelector('#tmSwQ').textContent = r?.err === 'offline' ? 'צריך חיבור לאינטרנט כדי להחליף קבוצה.' : r?.err === 'used' ? 'את ההחלפה החינמית כבר עשיתם.' : 'משהו השתבש. נסו שוב.';
      btn.disabled = false;
    }
  });

  // ═══ THE PRIZE: "your team won!" ═══
  const pz = mk(`<div class="m-pop hidden tm-pz" id="tmPrize" role="dialog" aria-modal="true" aria-label="תוצאות השבוע">
    <div class="tm-pzfx" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="m-panel plain tm-pzbox"><span class="tm-pzbdg"></span><b class="tm-pzh"></b><p class="tm-pzt"></p>
      <div class="tm-pzwin"></div><button class="m-pill big glint" id="tmPzOk"><b>איזה כיף!</b></button></div></div>`);
  let pzDone = null;
  // p: { week, rank, winner, myTeam, active, prize: { points, badge } | null }
  function openPrize(p, then) {
    pzDone = then || null;
    const mine = T.teamById(p.myTeam) || myTeam(), win = T.teamById(p.winner);
    tint(pz, mine);
    pz.querySelector('.tm-pzbdg').innerHTML = badgeSVG(mine);
    let h, txt;
    if (p.rank === 1 && p.active) { h = 'הקבוצה שלכם ניצחה! 🏆'; txt = `${mine.title} במקום הראשון השבוע!`; }
    else if (p.rank === 1) { h = `${mine.title} ניצחה! 🏆`; txt = `שחקו ${T.ACTIVE_MATCHES} משחקים בשבוע הבא, וגם אתם תזכו בפרס!`; }
    else if (p.active) { h = `מקום ${p.rank} לקבוצה שלכם!`; txt = win ? `השבוע ניצחה ${win.title}. בשבוע הבא זה אתם!` : 'כל הכבוד על המשחק!'; }
    else { h = win ? `${win.title} ניצחה השבוע` : 'השבוע נגמר'; txt = `שחקו ${T.ACTIVE_MATCHES} משחקים בשבוע הבא, ותעזרו ל${mine.title}!`; }
    pz.querySelector('.tm-pzh').textContent = h;
    pz.querySelector('.tm-pzt').textContent = txt;
    pz.querySelector('.tm-pzwin').innerHTML = p.prize ? `<span class="tm-pzpts"><i class="coin"></i>+${fmt(p.prize.points)}</span>${p.prize.badge ? '<span class="tm-pzmed">🏅</span>' : ''}` : '';
    pz.classList.toggle('won', p.rank === 1 && !!p.active);
    pz.classList.remove('hidden');
    ctx.sfx?.(p.prize ? 'buy' : 'swish');
  }
  pz.querySelector('#tmPzOk').addEventListener('click', () => { ctx.sfx?.('tap'); pz.classList.add('hidden'); const f = pzDone; pzDone = null; f?.(); });

  addEventListener('keydown', (e) => {
    if (!intro.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); nextCard(); }
    else if (!sw.classList.contains('hidden') && e.key === 'Escape') closeSwitch();
    else if (!scr.classList.contains('hidden') && sw.classList.contains('hidden') && e.key === 'Escape') closeScreen();
  }, true);
  addEventListener('resize', () => {
    const t = !intro.classList.contains('hidden') ? introTeam : !scr.classList.contains('hidden') ? myTeam() : null;
    if (!t) return;
    ctx.paintStanding?.(intro.classList.contains('hidden') ? $s('.tm-man') : intro.querySelector('.ti-man'), { rarity: MYTHIC, number: t.leader });
  });

  return {
    intro: openIntro,
    open: openScreen,
    close: closeScreen,
    prize: openPrize,
    // the server's profile changed: redraw what is open
    refresh() { if (!scr.classList.contains('hidden')) paintScreen(); },
    get introOn() { return !intro.classList.contains('hidden'); },
    get screenOn() { return !scr.classList.contains('hidden'); },
    get prizeOn() { return !pz.classList.contains('hidden'); },
  };
}
