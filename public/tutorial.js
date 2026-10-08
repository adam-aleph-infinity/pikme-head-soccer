// THE FIRST-LAUNCH TUTORIAL, played on the real match (shared/tutorial.js has the rules and
// the words; tutorial.css the look).
//
// Head Ball 2's first launch, ours (uploaded-images/ScreenRecording_10-07-2026 16-43-33_1.mov):
//   DRILLS   the player drops in from the sky; Paz, our coach, slides into the corner and talks
//            in a cream bubble. Each button comes onto the pad when it is needed, with a pulsing
//            ring; there is a green target on the grass to walk to, a green arrow at the ball,
//            and a ✓ for each step done. Ours adds the dash.
//   MATCH    "let's have a practice match" → the VS finding an opponent → a short match against
//            the easiest champion. At kick-off it stops, dims everything but POWER, and a glove
//            taps it: the first power shot is the player's own.
//   AFTER    the result pays the first upgrade; the coach walks you into the shop to buy it,
//            then to the main menu and the arcade.
//
// game.js owns the match. It asks this module four things every tick (hold / mask / afterStep /
// event) and lets it draw on the pitch (drawGround / drawOver). Everything else here is DOM.
import * as C from '../shared/constants.js';
import * as T from '../shared/tutorial.js';
import { headY } from '../shared/sim.js';

const GLOVE = `<svg viewBox="0 0 64 84" aria-hidden="true"><g stroke="#1b1f3a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
  <path fill="#fff" d="M19 44 V11 a7 7 0 0 1 14 0 V36 a6 6 0 0 1 12 0 V40 a6 6 0 0 1 11 3 V60 c0 11-8 18-19 18 h-7 c-9 0-15-5-18-12 l-7-15 a6 6 0 0 1 10-6 Z"/>
  <path fill="none" stroke="#c9d2e4" stroke-width="2.5" d="M33 37 V44 M45 41 V47"/>
  <rect fill="#e8edf6" x="14" y="73" width="36" height="9" rx="3"/></g></svg>`;
const THUMB = `<svg viewBox="0 0 60 70" aria-hidden="true"><g stroke="#140c08" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
  <path fill="#f3c39b" d="M22 31 L25 9 a6.5 6.5 0 0 1 13 2 L36 28 H50 a6 6 0 0 1 0 12 a6 6 0 0 1 -1 11 a6 6 0 0 1 -2 10 H21 a7 7 0 0 1 -7 -7 V37 a7 7 0 0 1 8 -6 Z"/>
  <path fill="none" stroke="#c98d62" stroke-width="2.4" d="M37 40 H47 M36 51 H46"/>
  <rect fill="#c9a24a" x="1" y="32" width="15" height="33" rx="3"/><rect fill="#fff" stroke-width="2" x="12" y="34" width="5" height="29" rx="2"/></g></svg>`;
const HEADSET = `<svg class="tc-set" viewBox="0 0 100 100" aria-hidden="true"><g stroke="#140c08" stroke-width="2.4">
  <path d="M15 36 Q11 50 15 60" fill="none" stroke="#24242c" stroke-width="5"/>
  <ellipse cx="16" cy="62" rx="8.5" ry="10.5" fill="#24242c"/><ellipse cx="16" cy="62" rx="4.2" ry="5.8" fill="#e8102e"/>
  <path d="M19 71 Q28 87 54 85" fill="none" stroke="#24242c" stroke-width="3.6" stroke-linecap="round"/>
  <rect x="52" y="80" width="12" height="8.5" rx="4.2" fill="#24242c"/></g></svg>`;
const SUBTLE = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createTutorial(ctx) {
  const $ = (s) => document.querySelector(s);
  const store = ctx.store;
  const u = () => Math.min(innerHeight / 100, (innerWidth * 0.5625) / 100);

  // ── THE OVERLAY ──
  const root = document.createElement('div');
  root.id = 'tut';
  root.className = 'hidden';
  root.innerHTML = `<i class="tut-fade"></i><i class="tut-spot"></i><i class="tut-ring"></i>
    <div class="tut-coach"><i class="tc-suit"></i><i class="tc-face"></i>${HEADSET}<span class="tc-thumb">${THUMB}</span></div>
    <div class="tut-bub"><b class="tut-say"></b><small class="tut-keys"></small><small class="tut-next"></small></div>
    <i class="tut-hand">${GLOVE}</i><i class="tut-check"></i>`;
  document.body.appendChild(root);
  const el = (s) => root.querySelector(s);
  const fadeEl = el('.tut-fade'), spotEl = el('.tut-spot'), ringEl = el('.tut-ring'), handEl = el('.tut-hand');
  const coachEl = el('.tut-coach'), faceEl = el('.tc-face'), bubEl = el('.tut-bub'), checkEl = el('.tut-check');
  const touch = matchMedia('(pointer: coarse)').matches;

  // ── STATE ──
  let on = false, phase = null, hold = false, firstTime = true;
  let allow = new Set();
  let di = 0, dState = 'go', mark = null, arrow = false, ballWanted = false, placeNext = null;
  let tries = 0, idleT = 0, simT = 0, landed = false, quietT = 0;
  let pw = null, playT = 0, pwT = 0;
  // the counter lesson: null → 'wait' → 'talk' → 'fly' → 'hold' → 'after' → 'done'
  let cw = null, cwT = 0, botFrozen = false;
  let ringOn = null, handOn = null, spotOn = null, bubAt = null;
  let tapNext = null;                  // a "tap to continue": what the tap does
  let guardOk = null;                  // while set, only clicks inside these elements get through
  let timers = [], raf = 0, gen = 0;
  const later = (ms, f) => { const g = gen; timers.push(setTimeout(() => { if (g === gen && on) f(); }, ms)); };
  // …or once the coach has finished his line, if that is later (the narration, ctx.voice)
  const laterV = (ms, f) => later(Math.max(ms, (ctx.voiceLeft?.() || 0) * 1000 + 250), f);

  // ── LOOKS ──
  function coach(mode) {
    coachEl.classList.toggle('on', mode !== 'off');
    coachEl.classList.toggle('big', mode === 'big');
    if (mode !== 'off') {
      const px = Math.round((mode === 'big' ? 52 : 19) * u());
      ctx.paintHead(faceEl, 'legendary', T.COACH, px, { expr: 'happy', fill: 1.05 });
    }
  }
  // say(text, { at: 'coach' | 'big' | element, side: 'up' | 'down', keys, next })
  function say(text, opts = {}) {
    if (!text) { bubEl.classList.remove('on'); bubAt = null; return; }
    bubEl.querySelector('.tut-say').textContent = text;
    ctx.voice?.(T.voiceFor(text));                  // the coach says it, in Idan's voice
    bubEl.querySelector('.tut-keys').textContent = !touch && opts.keys ? 'מקלדת: ' + opts.keys : '';
    bubEl.querySelector('.tut-next').textContent = opts.next ? (touch ? 'לחצו להמשך' : 'לחצו / Enter להמשך') : '';
    bubEl.classList.toggle('big', opts.at === 'big');
    bubAt = { at: opts.at || 'coach', side: opts.side || 'up' };
    bubEl.classList.remove('on'); void bubEl.offsetWidth; bubEl.classList.add('on');
    placeBubble();
  }
  function placeBubble() {
    if (!bubAt) return;
    const U = u(), w = bubEl.offsetWidth, h = bubEl.offsetHeight, { at, side } = bubAt;
    let x, y, cls = '', tail = '50%';
    if (at === 'coach' || at === 'big') {
      const r = coachEl.getBoundingClientRect();
      x = at === 'big' ? r.left + r.width * 0.86 : r.right + 2.2 * U;
      y = at === 'big' ? r.top + r.height * 0.28 - h / 2 : r.top + 3.5 * U;
      bubEl.style.setProperty('--tx', '0%');
    } else {
      const r = (typeof at === 'string' ? $(at) : at)?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      x = Math.max(2 * U, Math.min(innerWidth - w - 2 * U, cx - w / 2));
      y = side === 'up' ? r.top - h - 3 * U : r.bottom + 3 * U;
      y = Math.max(U, Math.min(innerHeight - h - U, y));
      cls = side;
      tail = Math.max(10, Math.min(90, ((cx - x) / w) * 100)) + '%';
      bubEl.style.setProperty('--tx', tail);
    }
    bubEl.classList.toggle('up', cls === 'up');
    bubEl.classList.toggle('down', cls === 'down');
    bubEl.style.setProperty('--tail', tail);
    bubEl.style.left = x + 'px';
    bubEl.style.top = y + 'px';
  }
  const target = (t) => (typeof t === 'string' ? $(t) : t);
  function fit(node, e, pad) {
    const r = target(e)?.getBoundingClientRect();
    if (!r || !r.width) { node.classList.remove('on'); return; }
    const p = pad * u();
    Object.assign(node.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
  }
  function ring(t) { ringOn = t; if (!t) ringEl.classList.remove('on'); else { fit(ringEl, t, 0.8); ringEl.classList.add('on'); } }
  // The dim is a full-screen layer with a rounded hole cut in it (clip-path, even-odd). A huge
  // box-shadow round the hole did the same on the menus but never painted over the match's
  // canvases in Chrome.
  let spotKey = '';
  function spot(t) {
    spotOn = t;
    if (!t) { spotEl.classList.remove('on'); spotKey = ''; return; }
    const r = target(t)?.getBoundingClientRect();
    if (!r || !r.width) return;
    const p = 1.2 * u(), x = r.left - p, y = r.top - p, w = r.width + 2 * p, h = r.height + 2 * p, k = Math.min(3 * u(), w / 2, h / 2);
    const key = [x, y, w, h, innerWidth, innerHeight].map(Math.round).join();
    if (key !== spotKey) {
      spotKey = key;
      const W = innerWidth, H = innerHeight, f = (v) => v.toFixed(1);
      spotEl.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z M${f(x + k)} ${f(y)}H${f(x + w - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + w)} ${f(y + k)}V${f(y + h - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + w - k)} ${f(y + h)}H${f(x + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x)} ${f(y + h - k)}V${f(y + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + k)} ${f(y)}Z")`;
    }
    spotEl.classList.add('on');
  }
  function hand(t) {
    handOn = t;
    if (!t) { handEl.classList.remove('on'); return; }
    const r = target(t)?.getBoundingClientRect();
    if (!r) return;
    Object.assign(handEl.style, { left: r.left + r.width * 0.55 + 'px', top: r.top + r.height * 0.45 + 'px' });
    handEl.classList.add('on');
  }
  function fade(level) {
    fadeEl.classList.toggle('on', level === 'dim');
    fadeEl.classList.toggle('black', level === 'black');
  }
  function check() {
    checkEl.classList.remove('on'); void checkEl.offsetWidth; checkEl.classList.add('on');
    ctx.sfx('buy');
  }
  function pads(list) {
    for (const k of ['left', 'right', 'jump', 'kick', 'power']) ctx.padBtn(k)?.classList.toggle('tut-off', !!list && !list.includes(k));
  }
  // "tap anywhere to go on": the whole overlay takes the tap
  function waitTap(f) { tapNext = f; root.style.pointerEvents = f ? 'auto' : ''; }
  root.addEventListener('click', () => { if (tapNext) { const f = tapNext; waitTap(null); ctx.sfx('tap'); f(); } });

  // Everything that moves under the overlay is followed, every frame, while it runs.
  function loop() {
    raf = requestAnimationFrame(loop);
    if (ringOn) fit(ringEl, ringOn, 0.8);
    if (spotOn) spot(spotOn);
    if (handOn) hand(handOn);
    if (bubAt && bubAt.at !== 'coach' && bubAt.at !== 'big') placeBubble();
    if (phase === 'match' && pw === 'hold' && ctx.pressed('power')) powerPressed();
    if (phase === 'match' && cw === 'hold' && ctx.pressed('kick')) counterPressed();
    if (phase === 'shop') watchShop();
  }

  // Only the thing being taught can be pressed (and Enter / Space go on a "tap to continue").
  function guard(e) {
    if (!on) return;
    if (e.type === 'keydown') {
      if (tapNext && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) { e.preventDefault(); e.stopImmediatePropagation(); root.click(); return; }
      if (guardOk) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (!guardOk || tapNext) return;
    if (guardOk.some((s) => target(s)?.contains(e.target))) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }
  for (const t of ['pointerdown', 'click', 'touchstart']) addEventListener(t, guard, { capture: true, passive: false });
  addEventListener('keydown', guard, true);
  addEventListener('resize', () => { if (on) { placeBubble(); if (coachEl.classList.contains('on')) coach(coachEl.classList.contains('big') ? 'big' : 'small'); } });

  // ── THE RUN ──
  function start({ replay = false } = {}) {
    gen++;
    timers.forEach(clearTimeout); timers = [];
    on = true; firstTime = !replay && read() !== 'done';
    root.classList.remove('hidden');
    document.body.classList.add('tut-on', 'tut-drill');
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    fade('black');
    phase = 'intro'; hold = false; di = 0; dState = 'go'; mark = null; arrow = false; ballWanted = false; placeNext = null;
    landed = false; simT = 0; pw = null; cw = null; botFrozen = false; spar = null; guardOk = null; waitTap(null);
    allow = new Set();
    pads([]);
    coach('off'); say(null); ring(null); spot(null); hand(null);
    ctx.preloadVoice?.(Object.keys(T.LINES));
    ctx.startDrills();
    later(80, () => fade(null));
  }
  // the coach comes in once you have landed (afterStep)
  function hello() {
    coach('small');
    later(350, () => { say(T.SAY.hello); laterV(2350, () => drill(0)); });
  }
  function drill(i) {
    di = i; dState = 'go'; tries = 0; idleT = 0;
    const d = T.DRILLS[i];
    phase = 'drill';
    allow = new Set(d.pad);
    pads(d.pad);
    mark = d.mark ?? null;
    say(d.say, { keys: d.keys });
    ring(ctx.padBtn(d.ring));
    if (d.ball) placeNext = d.ball;
  }
  function ok() {
    if (dState !== 'go') return;
    dState = 'ok';
    mark = null; arrow = false; ballWanted = false; placeNext = null;
    ring(null);
    check();
    say(T.SAY.good[di % T.SAY.good.length]);
    const n = T.nextDrill(di);
    // the last drill's GOAL! plays out (and the restart with it) before the screen goes dark
    if (n == null) laterV(900, () => { phase = 'outro-wait'; });
    else laterV(1250, () => drill(n));
  }
  function retry() {
    tries++;
    idleT = 0;
    const d = T.DRILLS[di];
    say(tries >= T.MAX_TRIES ? T.LINES.kick : T.SAY.again, { keys: d.keys });
    laterV(1400, () => { if (phase === 'drill' && dState === 'go' && T.DRILLS[di] === d) say(d.say, { keys: d.keys }); });
    placeNext = d.ball;
  }
  function placeBall(M, kind) {
    const p = M.players[0], s = T.ballSpot(kind, p.x, C.W), b = M.ball;
    b.x = s.x; b.vx = 0; b.vy = 0; b.spin = 0; b.power = null;
    b.y = kind === 'drop' ? C.BALL_SPAWN.y - 140 : C.GROUND_Y - b.r;
    M.ballWait = 0; M.idle = 0;
    ballWanted = true; arrow = true; idleT = 0;
  }
  // "Let's have a practice match" — big coach in the dark, then the VS finding an opponent
  function outro() {
    phase = 'outro'; hold = true;
    pads([]); allow = new Set();
    say(null); coach('off');
    fade('dim');
    later(450, () => { coach('big'); later(300, () => { say(T.SAY.match, { at: 'big', next: true }); laterV(3450, () => { if (tapNext === find) { waitTap(null); find(); } }); }); });
    later(900, () => waitTap(find));
  }
  function find() {
    if (phase !== 'outro') return;
    phase = 'find';
    say(null); coach('off'); fade('black');
    const vs = $('#vs'), meC = ctx.me(), foe = ctx.foe();
    let label = vs.querySelector('.vs-find');
    if (!label) { label = document.createElement('b'); label.className = 'vs-find'; vs.appendChild(label); }
    later(350, () => {
      fade(null);
      vs.classList.remove('hidden', 'skip'); vs.classList.add('tut-find');
      vs.style.animation = 'none'; void vs.offsetWidth; vs.style.animation = '';
      ctx.paintFace($('#vsFace0'), meC, false);
      label.textContent = 'מחפשים יריב…'; label.classList.add('blink');
      const f1 = $('#vsFace1'); f1.classList.add('spin');
      const pool = [1, 2, 3, 4, 5].map((n) => ({ rarity: 'legendary', number: n }));
      let k = 0;
      const spinT = setInterval(() => { if (!on) return clearInterval(spinT); ctx.paintFace(f1, pool[k++ % pool.length], true); ctx.sfx('tick'); }, 130);
      later(2600, () => {
        clearInterval(spinT);
        f1.classList.remove('spin');
        ctx.paintFace(f1, foe, true);
        label.classList.remove('blink'); label.textContent = 'נמצא יריב!';
        ctx.sfx('swish');
      });
      later(3500, () => { label.textContent = 'המשחק נטען…'; });
      later(4200, () => { vs.classList.remove('tut-find'); vs.classList.add('hidden'); label.textContent = ''; match(); });
    });
  }
  function match() {
    phase = 'match'; hold = false; pw = 'wait'; playT = 0;
    mark = null; arrow = false;
    document.body.classList.remove('tut-drill');
    pads(null);
    allow = new Set(['left', 'right', 'jump', 'kick', 'power']);
    ctx.startPractice();
  }
  // THE POWER LESSON (HB2 59 s): play stops, the bar is full, the glove taps POWER
  function powerLesson(M) {
    pw = 'hold'; hold = true;
    M.players[0].gauge = 1;
    allow = new Set(['power']);
    const btn = ctx.padBtn('power');
    spot(btn); ring(btn); hand(btn);
    say(T.SAY.power, { at: btn, side: 'up', keys: 'J' });
    ctx.sfx('tap');
  }
  function powerPressed() {
    pw = 'armed'; pwT = 0; hold = false;
    allow = new Set(['left', 'right', 'jump', 'kick', 'power']);
    spot(null); ring(null); hand(null);
    say(T.SAY.powerGo, { at: '.hud', side: 'down' });
  }
  function powerDone() {
    if (pw !== 'armed') return;
    pw = 'after';
    say(T.SAY.powerAfter, { at: '.hud', side: 'down' });
    laterV(3800, () => { if (pw === 'after') { pw = 'done'; say(null); cw = 'wait'; cwT = 0; } });
  }
  // THE COUNTER LESSON (Idan): the opponent fires its power at you, and a kick sends it back.
  // The coach says what is coming; the two of them are put on their marks (you in front of your
  // goal, him at the far end with the ball on his head and his power armed); his shot goes, and
  // COUNTER_GAP short of you it freezes with KICK ringed. The press lets it go — and the boot is
  // up in time (shared/tutorial.js COUNTER_GAP). A hit and it is staged again.
  function counterLesson() {
    cw = 'talk'; hold = true; botFrozen = true;
    allow = new Set();
    talk(T.SAY.counter, () => stageCounter());
  }
  function stageCounter() {
    const M = ctx.match();
    if (!M || phase !== 'match') return;
    const p = M.players[0], q = M.players[1], b = M.ball;
    for (const [pl, x] of [[p, T.COUNTER_SPOTS.me], [q, T.COUNTER_SPOTS.foe]]) {
      pl.x = x; pl.y = C.GROUND_Y; pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.stunned = 0; pl.armed = 0;
    }
    p.gauge = Math.min(p.gauge, 0.5);              // no arming out of it: this one is a kick
    q.armed = 1; q.gauge = 0;
    b.x = q.x - (C.HEAD_R + b.r - 4); b.y = headY(q); b.vx = 40; b.vy = 0; b.spin = 0; b.power = null;
    M.xballs.length = 0; M.ballWait = 0;
    allow = new Set();                             // stand in its way
    cw = 'fly'; cwT = 0; hold = false;
  }
  function counterFreeze() {
    cw = 'hold'; hold = true;
    allow = new Set(['kick']);
    const btn = ctx.padBtn('kick');
    spot(btn); ring(btn); hand(btn);
    say(T.SAY.counterNow, { at: btn, side: 'up', keys: '↓ / S' });
  }
  function counterPressed() {
    cw = 'after'; cwT = 0; hold = false;
    spot(null); ring(null); hand(null);
  }
  function counterDone(blocked) {
    if (cw !== 'after' && cw !== 'fly') return;
    if (blocked) {
      cw = 'done';
      check();
      say(T.SAY.counterOk, { at: '.hud', side: 'down' });
      allow = new Set(['left', 'right', 'jump', 'kick', 'power']);
      laterV(3200, () => { say(null); botFrozen = false; });
    } else {
      cw = 'retry';
      say(T.SAY.counterMiss, { at: '.hud', side: 'down' });
      laterV(1900, () => { if (cw === 'retry') stageCounter(); });
    }
  }
  // THE SPARRING PARTNER (Idan, 2026-10-08): a very weak CPU that lets you learn. It walks slower
  // than you, hangs back near its own goal, defends a little and clears the ball now and then, but
  // it never dashes, never fires its power (but for the lesson's) and never boots you.
  // It decides only every SPAR_THINK seconds and holds what it decided until the next decision, so
  // every arrow press lasts longer than a tap (C.DASH_TAP_MAX) and the sim never reads a dash.
  const SPAR_THINK = 0.4, SPAR_SPEED = 0.7;
  let spar = null;
  function foeInput(inp, M) {
    if (!on || phase !== 'match') return inp;
    if (hold || botFrozen || !M) return {};
    const q = M.players[1], p = M.players[0], b = M.ball;
    if (!spar || spar.M !== M) {
      spar = { M, t: 0, move: 0, kick: 0, jump: 0 };
      q.stats = { ...q.stats, speed: q.stats.speed * SPAR_SPEED };
    }
    if (spar.kick > 0) spar.kick--;
    if (spar.jump > 0) spar.jump--;
    if ((spar.t -= C.TICK) <= 0) {
      spar.t = SPAR_THINK;
      const home = C.W - C.GOAL_W - 110;
      // the ball in its own half and low enough to reach: go stand behind it (its kick then goes
      // your way); otherwise back home. Some of the time it just hesitates.
      const near = b.x > C.W * 0.5 && b.y > C.GROUND_Y - 220 && Math.random() < 0.6;
      const target = near ? Math.max(C.W * 0.5, Math.min(home + 40, b.x + 30)) : home;
      spar.move = Math.abs(target - q.x) > 25 ? Math.sign(target - q.x) : 0;
      const dx = b.x - q.x, hy = headY(q);
      if (Math.abs(dx) < 75 && dx < 15 && b.y > hy - 60 && Math.abs(p.x - q.x) > 90 && Math.random() < 0.35) spar.kick = 6;
      if (Math.abs(dx) < 60 && b.y < hy - 50 && q.onGround && Math.random() < 0.25) spar.jump = 6;
    }
    return { left: spar.move < 0, right: spar.move > 0, kick: spar.kick > 0, jump: spar.jump > 0, power: false };
  }
  // THE RESULT: the points it paid, then off to the shop
  function result(won, draw = false) {
    phase = 'result'; hold = false; pw = 'done'; cw = 'done'; botFrozen = false;
    say(null); spot(null);
    later(1700, () => {
      if (phase !== 'result') return;            // already on the way to the shop
      spot('#ovPts');
      say(won ? T.SAY.won : draw ? T.SAY.draw : T.SAY.lost, { at: '#ovPts', side: 'up', next: true });
      waitTap(() => {
        if (phase !== 'result') return;
        say(T.SAY.toShop, { at: '#again', side: 'up' });
        spot('#again'); ring('#again'); hand('#again');
        guardOk = ['#again'];
      });
    });
  }
  // THE SHOP: buy the first upgrade (a replay with no points to spend only explains it)
  let speed0 = 0;
  function shop() {
    phase = 'shop-wait'; guardOk = ['#tut'];
    waitTap(null); say(null); spot(null); ring(null); hand(null);
    ctx.menu.openShop();
    later(650, () => {
      speed0 = ctx.stats().lv.speed;
      const row = $('#upgRows .upg-row[data-k="speed"]'), buy = row?.querySelector('.upg-buy');
      // a replay only explains: it never spends points the player earned for real
      if (firstTime && buy && !buy.disabled) {
        phase = 'shop';
        spot(row); ring(buy); hand(buy);
        say(T.SAY.shop, { at: row, side: 'down' });
        guardOk = [buy];
      } else {
        phase = 'shop-talk';
        talk(T.SAY.stats, toMenu);
      }
    });
  }
  function watchShop() {
    if (ctx.stats().lv.speed <= speed0) return;
    phase = 'shop-talk'; guardOk = ['#tut'];
    ring(null); hand(null);
    check();
    say(T.SAY.bought, { at: '#upgRows', side: 'down' });
    later(1900, () => talk(T.SAY.stats, toMenu));
  }
  // the coach, big, in the dark, until a tap (HB2 42 s)
  function talk(text, then) {
    spot(null); ring(null); hand(null);
    say(null); fade('dim'); coach('big');
    later(300, () => say(text, { at: 'big', next: true }));
    later(600, () => waitTap(() => { fade(null); coach('off'); say(null); then(); }));
  }
  // THE MENU: the arcade is where it goes on
  function toMenu() {
    phase = 'menu'; guardOk = ['#tut'];
    say(null); spot(null);
    ctx.menu.openMenu();
    later(700, () => {
      const mode = $('.mn-mode.on') || '#mnTrack';
      ring(mode);
      say(T.SAY.arcade, { at: mode, side: 'up', next: true });
      waitTap(finish);
    });
  }
  function finish() {
    write('done');
    stop();
  }
  function stop() {
    gen++;
    ctx.voice?.(null);
    timers.forEach(clearTimeout); timers = [];
    on = false; phase = null; hold = false; guardOk = null; waitTap(null);
    mark = null; arrow = false;
    cancelAnimationFrame(raf);
    pads(null);
    coach('off'); say(null); ring(null); spot(null); hand(null); fade(null);
    root.classList.add('hidden');
    document.body.classList.remove('tut-on', 'tut-drill');
  }
  function read() { try { return store?.getItem(T.TUT_KEY) ?? null; } catch { return null; } }
  function write(v) { try { store?.setItem(T.TUT_KEY, v); } catch { /* private mode */ } }

  // THE COUNTER LESSON'S SHOT never scores: it is staged at you to be kicked back, and a miss is
  // staged again. Everything else in the match counts, both ways (Idan, 2026-10-08).
  function guardLesson(M) {
    const b = M.ball;
    if (M.phase !== 'play' || M.afterGoal > 0 || !b.power || b.power.owner !== 1) return;
    if (!['fly', 'hold', 'after', 'retry'].includes(cw)) return;
    const mine = C.GOAL_W + b.r * C.HS_STRETCH + 6, next = b.x + b.vx * 2 * C.TICK;
    if (b.x < mine || (b.vx < 0 && next < mine)) {
      b.power = null; b.x = Math.max(b.x, mine);
      b.vx = Math.max(160, Math.abs(b.vx) * 0.4); if (b.vy > -60) b.vy = -160;
    }
  }

  // ── THE TICK (game.js, after every sim step) ──
  function afterStep(M) {
    if (!on || !M) return;
    if (phase === 'match') {
      const b = M.ball, p = M.players[0], live = M.phase === 'play' && !(M.freeze > 0) && !(M.ballWait > 0) && !(M.afterGoal > 0) && !(M.hitStop > 0);
      if (pw === 'wait' && M.phase === 'play' && !(M.freeze > 0) && !(M.ballWait > 0)) {
        playT += C.TICK;
        if (playT > 0.7) powerLesson(M);
      } else if (pw === 'armed') {
        pwT += C.TICK;
        if (pwT > 7) powerDone();
      }
      // the counter lesson: a quiet moment after the power one, then his shot, then the freeze
      if (cw === 'wait' && live && !b.power) { cwT += C.TICK; if (cwT > 1.5) counterLesson(); }
      else if (cw === 'fly' && b.power && b.power.owner === 1 && !(M.hitStop > 0) && b.x - p.x < T.COUNTER_GAP) counterFreeze();
      else if (cw === 'after' || cw === 'fly') { cwT += C.TICK; if (cwT > 4) counterDone(false); }
      guardLesson(M);
      // NO SUDDEN DEATH IN PRACTICE: the match is 45 s, and a draw at the whistle is a draw.
      if (M.golden && M.phase !== 'over') {
        M.golden = false; M.phase = 'over';
        M.events = M.events.filter((e) => e.type !== 'golden');
        M.events.push({ type: 'fulltime', winner: M.score[0] > M.score[1] ? 0 : M.score[1] > M.score[0] ? 1 : -1 });
      }
      return;
    }
    // drills: the other player is parked far off the pitch, the clock never runs out
    const foe = M.players[1];
    foe.x = C.W + 900; foe.y = -4000; foe.vx = 0; foe.vy = 0; foe.armed = 0; foe.gauge = 0;
    M.clock = 999;
    const live = M.phase === 'play' && !(M.freeze > 0) && !(M.afterGoal > 0);
    // a drill's ball comes in once the last GOAL! has finished spelling itself out
    quietT = M.banner ? 0 : quietT + C.TICK;
    if (live && placeNext && quietT > 0.6) { const k = placeNext; placeNext = null; placeBall(M, k); }
    if (live && !ballWanted) M.ballWait = 1e9;
    simT += C.TICK;
    const p = M.players[0];
    if (phase === 'intro' && !landed && p.onGround && simT > 0.3) { landed = true; later(500, hello); }
    if (phase === 'outro-wait' && live && !M.banner) outro();
    if (phase !== 'drill' || dState !== 'go') return;
    const d = T.DRILLS[di];
    if (d.pass === 'mark' && p.onGround && T.onMark(p.x, d.mark)) ok();
    if (d.ball && ballWanted && live) {
      const b = M.ball;
      const dead = Math.abs(b.vx) < 30 && Math.abs(b.vy) < 40 && b.y > C.GROUND_Y - b.r - 6;
      idleT = dead ? idleT + C.TICK : 0;
      if (idleT > T.RETRY_IDLE) retry();
    }
  }
  function event(e) {
    if (!on) return;
    if (phase === 'match') {
      if (pw === 'armed' && e.player === 0 && (e.type === 'strike' || e.type === 'powerHit' || e.type === 'goal')) later(900, powerDone);
      if ((cw === 'after' || cw === 'fly') && e.player === 0 && e.by === 1) {
        if (e.type === 'blocked') counterDone(true);
        else if (e.type === 'powerHit') counterDone(false);
      }
      return;
    }
    if (phase !== 'drill' || dState !== 'go') return;
    const d = T.DRILLS[di];
    if (e.type === 'jump' && e.player === 0 && d.pass === 'jump') ok();
    else if (e.type === 'dash' && e.player === 0 && d.pass === 'dash') ok();
    else if (e.type === 'goal' && d.pass === 'goal') { if (e.player === 0) ok(); else retry(); }
    else if (e.type === 'strike' && e.player === 0 && d.pass === 'goal' && tries >= T.MAX_TRIES) later(500, ok);
  }
  function mask(inp) {
    if (!on) return inp;
    for (const k in inp) if (inp[k] && !allow.has(k)) inp[k] = false;
    return inp;
  }

  // ── ON THE PITCH ──
  // HB2's target on the grass: a green ring with four corner ticks, turning slowly
  function drawGround(g) {
    if (!on || mark == null) return;
    const s = ctx.depthPoint(mark, C.GROUND_Y), t = performance.now() / 1000;
    const rx = 60, ry = 17, pulse = SUBTLE ? 1 : 1 + 0.06 * Math.sin(t * 6);
    g.save();
    g.translate(s.x, s.y + 2);
    g.scale(pulse, pulse);
    g.fillStyle = 'rgba(90,255,110,.22)';
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#6dff7a'; g.shadowColor = '#3dff5a'; g.shadowBlur = 12;
    g.setLineDash([12, 8]); g.lineDashOffset = -t * 30;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.lineWidth = 3.5;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = a * rx * 0.42, y = b * ry * 0.42;
      g.beginPath(); g.moveTo(x - a * 13, y); g.lineTo(x, y); g.lineTo(x, y - b * 5); g.stroke();
    }
    g.restore();
  }
  // HB2's fat green arrow at the ball, bobbing towards it from up and to the right
  function drawOver(g, M) {
    if (!on || !arrow || !M || M.ballWait > 0) return;
    const b = M.ball, t = performance.now() / 1000, bob = SUBTLE ? 0 : Math.sin(t * 7) * 5;
    const ang = Math.PI * 0.75;                               // pointing down-left, at the ball
    const d = b.r + 10 + bob;
    g.save();
    g.translate(b.x + d * 0.7071, b.y - d * 0.7071);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(-20, -18); g.lineTo(-20, -8); g.lineTo(-46, -8); g.lineTo(-46, 8); g.lineTo(-20, 8); g.lineTo(-20, 18); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#0b4d0b'; g.stroke();
    g.fillStyle = '#4dff3a'; g.fill();
    g.fillStyle = '#c6ffb0'; g.fillRect(-44, -6, 22, 4);
    g.restore();
  }

  return {
    start, stop,
    get on() { return on; },
    get hold() { return on && hold; },
    get solo() { return on && phase !== 'match' && phase !== 'result'; },
    get phase() { return phase; },
    get ball() { return on && arrow; },
    get drill() { return phase === 'drill' ? T.DRILLS[di].id + (dState === 'ok' ? ':ok' : '') : null; },
    afterStep, event, mask, foeInput, drawGround, drawOver,
    get lesson() { return cw; },
    result, toShop: shop,
    reward: () => (firstTime ? T.REWARD : 0),
    firstRun: (prog, stats, params) => T.shouldRun({ flag: read(), prog, stats, params }),
    markDone: () => write('done'),
  };
}
