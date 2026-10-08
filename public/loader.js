// THE LOADING SCREEN, which is also the title (Idan, 2026-10-07: "like the game, with our
// Saltiz symbol, like the clip").
//
// Head Ball 2's first frame (uploaded-images/ScreenRecording_10-07-2026 16-43-33_1.mov, 0.4 to
// 14 s): a floodlit night stadium under a purple sky with a goal at each edge, two big heads
// squaring up from either side, the logo between them, and along the bottom a status line
// ("Connecting to the match server…") over a fat green pill that reads "Loading 75%". Ours
// keeps that layout and puts our own things in it: HS's night stadium (hs-stadium.js) in Saltiz's
// red, gold and black, the Saltiz symbol over the words סלטיז ראשים, and either side of it the
// four Mythic starters (Idan, 2026-10-08: "put שובל, אורי, פז and נוה"), 2v2, head to head:
// שובל and אורי against נוה and פז, the front pair (אורי, נוה) face to face across a gold VS,
// each side in its team's light. WHOLE, as the artist drew them — off each sheet, in the kit, on
// the gold podium (tools/chars/mythic_full.py): the three-quarter views of the three who face
// the right way, שובל's front view (his faces the wrong way, and mirrored his 24 would read
// backwards) — not the game's heads, which on their own "look cut off".
//
// The bar is real: it counts what the match needs before it is first played (the drawn faces,
// the head anchors, the crowd, the font, your card) and never runs ahead of it. It is held to
// a short minimum so the art is seen, and at 100% it turns into "tap to start", which is the
// tap a browser needs before it will play any sound. A tap made while it is still loading is
// kept, and goes through the moment loading finishes.
import { HS_STAGES } from './hs-stadium.js';
import { MYTHICS } from '../shared/mythics.js';

const STATUS = [
  [0, 'מכינים את האצטדיון…'],
  [0.2, 'מעירים את הקהל…'],
  [0.45, 'מציירים את האלופים…'],
  [0.75, 'מנפחים את הכדור…'],
  [0.92, 'מתחברים לשרת המשחק…'],
];
const EXPR = ['normal', 'kick', 'happy', 'hurt'];

export function createLoader({ paintHead, cardUrl, me, quick = false }) {
  const $ = (s) => document.querySelector(s);
  const root = $('#title');
  const fill = $('#ldFill'), pct = $('#ldPct'), status = $('#ldStatus');
  let real = 0, shown = 0, done = false, t0 = performance.now(), raf = 0;
  const waiters = [];
  // The art is up a little before anything has loaded, so it holds for at least this long.
  const MIN = quick ? 0 : 2400;

  paintBackdrop();
  paintHeroes();

  // ── what the first match needs, counted ──
  const jobs = [];
  for (let k = 1; k <= 5; k++) for (const e of EXPR) jobs.push(img(`img/chars/legendary-${k}/${e}.webp`));
  for (const h of document.querySelectorAll('#title .ld-hero')) jobs.push(img(`img/mythic-full/${h.dataset.img}.webp`));   // the four here
  for (const m of MYTHICS) jobs.push(img(`img/chars/mythic-${m.number}/normal.webp`));   // and the starter pick's
  jobs.push(fetch('data/head-anchors.json').then((r) => r.ok && r.json()).catch(() => null));
  for (const n of ['applause', 'goal1', 'goal2', 'miss1', 'sad1']) jobs.push(fetch(`audio/crowd/${n}.mp3`).then((r) => r.ok && r.arrayBuffer()).catch(() => null));
  if (document.fonts?.load) jobs.push(document.fonts.load('900 40px Rubik').catch(() => null));
  if (me && cardUrl) jobs.push(img(cardUrl(me.rarity, me.number)));
  let n = 0;
  // Nothing on a slow line holds the game hostage: after 8 s whatever is left loads in the back.
  const all = Promise.all(jobs.map((p) => Promise.race([p, wait(8000)]).finally(() => { n++; real = n / jobs.length; })));
  all.then(() => { real = 1; });

  function img(src) {
    return new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(i); i.decoding = 'async'; i.src = src; });
  }
  function wait(ms) { return new Promise((ok) => setTimeout(ok, ms)); }

  function tick(now) {
    // never ahead of the work, never ahead of the minimum, and eased so it climbs like HB2's
    const cap = Math.min(real, MIN ? (now - t0) / MIN : 1);
    shown += (cap - shown) * (cap >= 1 ? 0.25 : 0.12);
    if (cap >= 1 && shown > 0.995) shown = 1;
    const p = Math.round(shown * 100);
    fill.style.setProperty('--p', shown * 100 + '%');
    pct.textContent = `טוען ${p}%`;
    let line = STATUS[0][1];
    for (const [at, s] of STATUS) if (shown >= at) line = s;
    if (status.textContent !== line) status.textContent = line;
    if (shown >= 1) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('ld-done');
    for (const f of waiters.splice(0)) f();
  }

  // ── the key art ──
  function paintBackdrop() {
    const cv = $('#ldStadium');
    if (!cv) return;
    // HB2's frame, wide (a landscape phone is ~2.16:1): a third of sky with the floodlights
    // in it, the stands small and far off, then a big lit pitch. HS's night stadium is the middle band.
    const K = 1, W = 1600, H = 740, SKY = 120, gy = 380;
    cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d');
    g.scale(K, K);
    const sky = g.createLinearGradient(0, 0, 0, SKY + gy * 0.4);
    sky.addColorStop(0, '#1a0004'); sky.addColorStop(0.5, '#6a0716'); sky.addColorStop(1, '#25040c');
    g.fillStyle = sky; g.fillRect(0, 0, W, SKY + gy * 0.4);
    g.save();
    g.translate(0, SKY);
    try { HS_STAGES[1].draw(g, { W, t: 0, horizon: gy * 0.6, crowdTop: gy * 0.61, crowdBot: gy * 0.81 - 8, gy }); } catch { /* the sky stands in */ }
    g.restore();
    // a Saltiz night: the sky tinted to the symbol's deep red, lit gold from the masts
    const tint = g.createLinearGradient(0, 0, 0, SKY + gy * 0.45);
    tint.addColorStop(0, 'rgba(70,0,10,.92)'); tint.addColorStop(0.6, 'rgba(180,10,40,.45)'); tint.addColorStop(1, 'rgba(120,0,20,0)');
    g.fillStyle = tint; g.fillRect(0, 0, W, SKY + gy * 0.45);
    for (const x of [W * 0.1, W * 0.9]) {
      const l = g.createRadialGradient(x, SKY + 20, 4, x, SKY + 20, 260);
      l.addColorStop(0, 'rgba(255,250,225,.95)'); l.addColorStop(0.15, 'rgba(255,214,120,.45)'); l.addColorStop(1, 'rgba(255,170,40,0)');
      g.fillStyle = l; g.fillRect(x - 260, 0, 520, SKY + 280);
    }
    // the hoardings: plain glowing strips (no words: the logo stands in front of them)
    const top = SKY + gy * 0.82, bot = SKY + gy * 0.9;
    const hb = g.createLinearGradient(0, top, 0, bot);
    hb.addColorStop(0, '#5a0814'); hb.addColorStop(1, '#1a0206');
    g.fillStyle = hb; g.fillRect(0, top, W, bot - top);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff335566' : '#ffd40055'; g.fillRect(i * W / 8 + 6, top + 6, W / 8 - 12, 4); }
    // the grass: bright stripes, lit in the middle, a line round the centre circle
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2fae3c' : '#3cc24a'; g.fillRect(i * W / 16, bot, W / 16 + 1, H - bot); }
    const lit = g.createRadialGradient(W / 2, H * 0.92, 20, W / 2, H * 0.92, W * 0.5);
    lit.addColorStop(0, 'rgba(220,255,140,.6)'); lit.addColorStop(1, 'rgba(0,40,0,0)');
    g.fillStyle = lit; g.fillRect(0, bot, W, H - bot);
    const edge = g.createLinearGradient(0, bot, 0, H);
    edge.addColorStop(0, 'rgba(0,0,0,.25)'); edge.addColorStop(0.2, 'rgba(0,0,0,0)');
    g.fillStyle = edge; g.fillRect(0, bot, W, H - bot);
    g.strokeStyle = '#ffffffb0'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(W / 2, bot); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.ellipse(W / 2, bot + (H - bot) * 0.55, 190, 52, 0, 0, Math.PI * 2); g.stroke();
    // (no goals: with the four standing on it, goals at the edges read as a second pitch — Idan)
  }
  // the four: each figure's picture, set once (a resize needs nothing: they are sized by CSS)
  function paintHeroes() {
    for (const h of document.querySelectorAll('#title .ld-hero')) {
      const im = h.querySelector('.ld-fig'), src = `img/mythic-full/${h.dataset.img}.webp`;
      if (!im.getAttribute('src')) { im.src = src; im.alt = MYTHICS[h.dataset.n - 1].name; h.style.setProperty('--fig', `url("${src}")`); }
    }
  }

  return {
    get done() { return done; },
    // run `f` once loading is finished (now, if it already is)
    then(f) { if (done) f(); else waiters.push(f); },
    repaint: paintHeroes,
  };
}
