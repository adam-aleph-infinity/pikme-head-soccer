// THE STARTER PICK — the very first thing a new player sees after the title: they choose ONE of the
// four Mythics and keep it for good (Idan, 2026-10-08; the rules are shared/mythics.js, the save is
// STARTER_KEY).
//
// A scene for kids, in the artist's own staging (uploaded-images/champ_A–D: each character on a
// gold podium under a spotlight, sparkles all round) and in Saltiz's own colours — red, gold and
// black, the symbol's hexagons on the wall, the symbol by the title and big behind the champions
// (Idan: "so you can see it's Saltiz's game"). The four stand whole on their podiums — the head is not cropped by a frame — bobbing
// gently, each with their name on a ribbon in their own kit's colours and a line about who they
// are. A tap picks one (it jumps, its light comes up), "בחירה" asks once more ("this is for good"),
// and the yes saves it before anything else happens. Until that yes nothing is saved, so a game
// closed here asks again next time; after it the choice can never be offered again. The keyboard
// works too: ← → to move, Enter to choose and to confirm, Esc to step back from the question.
//
// THE TEAMS (Idan, 2026-10-08; shared/teams.js): each Mythic leads a team, so this pick is the
// player's team too, and the screen says so — every podium carries its team's ribbon and light,
// and the question names both ("לבחור את פז? ולהצטרף לקבוצת פז!"). The four come in a fresh order on
// every visit, so no team is the first one everybody sees.
import { MYTHICS, MYTHIC, saveStarter } from '../shared/mythics.js';
import { teamOf } from '../shared/teams.js';
import { kitFor } from './characters.js';
import { symbolSVG } from './symbol.js';
import { badgeSVG } from './team.js';

// a fresh order (Fisher–Yates)
function shuffled(a, rnd = Math.random) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export function createStarterPick({ paintHead, store, sfx }) {
  const $ = (s) => document.querySelector(s);
  const root = $('#starter'), row = $('#stRow'), go = $('#stGo'), ask = $('#stConfirm');
  let sel = 0, done = null, asking = false, built = false;
  let order = MYTHICS.map((m) => m.number);        // the order on screen (shuffled per visit)

  // the sky's sparkles: fixed places (not random, so every launch looks the same), each twinkling
  // on its own beat
  function sky() {
    $('#stSym').innerHTML = symbolSVG();
    $('#stMark').innerHTML = symbolSVG();
    const stars = [];
    for (let i = 0; i < 22; i++) {
      const x = (i * 37 + 11) % 100, y = (i * 53 + 7) % 62, s = 0.6 + ((i * 29) % 10) / 10, d = ((i * 17) % 30) / 10;
      stars.push(`<i style="left:${x}%;top:${y}%;--s:${s.toFixed(2)};animation-delay:-${d.toFixed(1)}s"></i>`);
    }
    $('#stStars').innerHTML = stars.join('');
  }
  // measured by layout, not on screen: a box still popping in (scaled) would paint the face small
  const paint = (el, n) => {
    const w = el.offsetWidth || 120, h = el.offsetHeight || w;
    paintHead(el, MYTHIC, n, w, { h, fill: 0.94 });
  };
  function render() {
    if (!built) { sky(); built = true; }
    row.innerHTML = order.map((n, i) => {
      const m = MYTHICS[n - 1], k = kitFor(MYTHIC, n), t = teamOf(n);
      return `<button class="st-card" data-n="${n}" style="--kc:${k.suit.base};--kt:${k.collarDark};--tc:${t.color};--td:${t.dark};--tg:${t.glow};--bob:-${(i * 0.45).toFixed(2)}s">` +
        `<span class="st-stage"><i class="st-light"></i><span class="st-pod"></span><i class="st-pic"></i><i class="st-burst"></i></span>` +
        `<b class="st-name">${m.name}</b><span class="st-team"><i class="st-tbdg">${badgeSVG(t)}</i>${t.title}</span><small class="st-role">${m.role}</small></button>`;
    }).join('');
    row.querySelectorAll('.st-card').forEach((b) => {
      paint(b.querySelector('.st-pic'), +b.dataset.n);
      b.onclick = () => { if (!asking) choose(+b.dataset.n); };
    });
  }
  function choose(n) {
    if (sel !== n) sfx?.('tick');
    sel = n;
    row.querySelectorAll('.st-card').forEach((b) => {
      const on = +b.dataset.n === n;
      b.classList.toggle('sel', on);
      if (on) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }   // the jump, again on every pick
    });
    row.classList.add('has-sel');
    go.disabled = false;
  }
  function question() {
    if (!sel) return;
    const m = MYTHICS[sel - 1], k = kitFor(MYTHIC, sel), t = teamOf(sel);
    asking = true;
    $('#stCQ').textContent = `לבחור את ${m.name}?`;
    const ct = $('#stCTeam');
    if (ct) {
      ct.innerHTML = `<i class="st-tbdg">${badgeSVG(t)}</i>ולהצטרף ל${t.title}!`;
      for (const [v, c] of [['--tc', t.color], ['--td', t.dark]]) ct.style.setProperty(v, c);
    }
    $('#stYes').innerHTML = `<b>כן, ${m.name}!</b>`;
    ask.style.setProperty('--kc', k.suit.base);
    ask.style.setProperty('--kt', k.collarDark);
    ask.classList.remove('hidden');
    paint($('#stCFace'), sel);
    sfx?.('swish');
  }
  function back() { asking = false; ask.classList.add('hidden'); }
  function yes() {
    const n = saveStarter(store, sel);          // a starter already saved is kept: one choice, ever
    if (!n) return;
    sfx?.('tap');
    close();
    const f = done; done = null;
    f?.(n);
  }
  function close() {
    back();
    root.classList.add('hidden');
    document.body.classList.remove('st-on');
  }
  go.onclick = () => question();
  $('#stYes').onclick = () => yes();
  $('#stNo').onclick = () => back();
  addEventListener('keydown', (e) => {
    if (root.classList.contains('hidden')) return;
    const k = e.key;
    if (asking) {
      if (k === 'Enter') yes();
      else if (k === 'Escape') back();
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      // the row reads right to left (Hebrew): → is the previous card
      const d = k === 'ArrowLeft' ? 1 : -1, i = order.indexOf(sel);
      choose(sel ? order[(i + d + order.length) % order.length] : order[0]);
    } else if (k === 'Enter') question();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  addEventListener('resize', () => {
    if (root.classList.contains('hidden')) return;
    row.querySelectorAll('.st-card').forEach((b) => paint(b.querySelector('.st-pic'), +b.dataset.n));
    if (asking) paint($('#stCFace'), sel);
  });

  return {
    // shows the scene; `then(n)` runs once the choice is confirmed and saved
    open(then) {
      done = then; sel = 0; asking = false;
      order = shuffled(order);
      go.disabled = true;
      row.classList.remove('has-sel');
      root.classList.remove('hidden');
      document.body.classList.add('st-on');
      render();
    },
    get on() { return !root.classList.contains('hidden'); },
  };
}
