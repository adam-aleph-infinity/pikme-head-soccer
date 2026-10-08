// THE LOADING SCREEN, which is also the title (Idan, 2026-10-07: "like the game, with our
// Saltiz symbol, like the clip").
//
// Head Ball 2's first frame (uploaded-images/ScreenRecording_10-07-2026 16-43-33_1.mov, 0.4 to
// 14 s): a floodlit night stadium under a purple sky with a goal at each edge, two big heads
// squaring up from either side, the logo between them, and along the bottom a status line
// ("Connecting to the match server…") over a fat green pill that reads "Loading 75%". Ours
// keeps that layout and puts our own things in it: HS's night stadium (hs-stadium.js), two of
// our drawn champions, and the Saltiz symbol over the words סלטיז ראשים.
//
// The bar is real: it counts what the match needs before it is first played (the drawn faces,
// the head anchors, the crowd, the font, your card) and never runs ahead of it. It is held to
// a short minimum so the art is seen, and at 100% it turns into "tap to start", which is the
// tap a browser needs before it will play any sound. A tap made while it is still loading is
// kept, and goes through the moment loading finishes.
import { HS_STAGES } from './hs-stadium.js';

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
    // HB2's frame, wide (a landscape phone is ~2.16:1): a third of purple sky with the
    // floodlights in it, the stands small and far off, then a big lit pitch with a goal at
    // each edge. HS's night stadium is the middle band.
    const K = 1, W = 1600, H = 740, SKY = 120, gy = 380;
    cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d');
    g.scale(K, K);
    const sky = g.createLinearGradient(0, 0, 0, SKY + gy * 0.4);
    sky.addColorStop(0, '#3a0a5e'); sky.addColorStop(0.5, '#7a2a9e'); sky.addColorStop(1, '#2a1260');
    g.fillStyle = sky; g.fillRect(0, 0, W, SKY + gy * 0.4);
    g.save();
    g.translate(0, SKY);
    try { HS_STAGES[1].draw(g, { W, t: 0, horizon: gy * 0.6, crowdTop: gy * 0.61, crowdBot: gy * 0.81 - 8, gy }); } catch { /* the sky stands in */ }
    g.restore();
    // HB2's sky is a purple dusk, not HS's navy: tint the top, and light it from the masts
    const tint = g.createLinearGradient(0, 0, 0, SKY + gy * 0.45);
    tint.addColorStop(0, 'rgba(120,30,170,.9)'); tint.addColorStop(0.6, 'rgba(170,60,200,.5)'); tint.addColorStop(1, 'rgba(90,40,160,0)');
    g.fillStyle = tint; g.fillRect(0, 0, W, SKY + gy * 0.45);
    for (const x of [W * 0.1, W * 0.9]) {
      const l = g.createRadialGradient(x, SKY + 20, 4, x, SKY + 20, 260);
      l.addColorStop(0, 'rgba(255,250,230,.95)'); l.addColorStop(0.15, 'rgba(255,220,255,.45)'); l.addColorStop(1, 'rgba(200,120,255,0)');
      g.fillStyle = l; g.fillRect(x - 260, 0, 520, SKY + 280);
    }
    // the hoardings: plain glowing strips (no words: the logo stands in front of them)
    const top = SKY + gy * 0.82, bot = SKY + gy * 0.9;
    const hb = g.createLinearGradient(0, top, 0, bot);
    hb.addColorStop(0, '#3a1470'); hb.addColorStop(1, '#14062e');
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
    // a goal at each edge, its net in the floodlight
    goal(g, 30, H - 120, 1); goal(g, W - 30, H - 120, -1);
  }
  function goal(g, x, base, dir) {
    const w = 150, h = 250, top = base - h + 40;
    g.save();
    g.translate(x, 0);
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1.4;
    for (let k = 0; k <= w; k += 11) { g.beginPath(); g.moveTo(dir * k, top + 6); g.lineTo(dir * k * 0.86, base + 40); g.stroke(); }
    for (let y = top + 6; y <= base + 40; y += 11) { g.beginPath(); g.moveTo(0, y); g.lineTo(dir * w * (1 - 0.14 * (y - top) / (base + 40 - top)), y); g.stroke(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, top); g.lineTo(dir * w, top); g.lineTo(dir * w * 0.86, base + 40); g.stroke();
    g.restore();
  }
  function paintHeroes() {
    for (const [id, k, flip] of [['#ldFace0', 1, false], ['#ldFace1', 3, true]]) {
      const el = $(id);
      if (el) paintHead(el, 'legendary', k, el.clientWidth || 300, { expr: 'kick', flip, fill: 1.05 });
    }
    for (const b of document.querySelectorAll('.ld-body')) if (!b.firstChild) b.innerHTML = body(b.classList.contains('red') ? '#e8102e' : '#1b6fe0');
  }
  // HS's body under each head (body-art.js, drawn small): a black suit with a strip of team
  // colour at the collar, one boot planted and one swung through at the ball, gold at the heel.
  function body(col) {
    const boot = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-15 -9 h17 q15 0 17 12 v6 h-34 z" fill="#15151a"/><path d="M-15 -9 h6 v18 h-6 z" fill="#f5c518"/><path d="M-15 8 h34" stroke="#f5c518" stroke-width="2.4"/></g>`;
    return `<svg viewBox="0 0 100 70" aria-hidden="true"><g stroke="#140c08" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M26 4 Q50 -4 74 4 L70 30 Q50 36 30 30 Z" fill="#22222a"/>
      <path d="M30 2 Q50 -6 70 2 L68 10 Q50 4 32 10 Z" fill="${col}"/>
      ${boot(38, 42, 0)}${boot(72, 34, -28)}</g></svg>`;
  }

  return {
    get done() { return done; },
    // run `f` once loading is finished (now, if it already is)
    then(f) { if (done) f(); else waiters.push(f); },
    repaint: paintHeroes,
  };
}
