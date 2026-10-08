// Match SFX, synthesised — except the crowd's voice, which is real recordings (public/audio/crowd,
// credits in its CREDITS.md): a synthesised crowd shouting words always sounded like robots.
//
// Voiced after Head Soccer's (Idan, 2026-09-26: "do everything like HS"): natural sounds — a
// round thump off the boot, a springy knock off the head, a referee's trilled whistle, a crowd
// that roars on a goal — rather than the Street Fighter II chiptune this kit was first written to.
// The sounds themselves stay our own: built from WebAudio noise, filters and sine partials.
//
// Everything is created on demand and thrown away. No buffers to preload, nothing to block
// the first frame, and it survives the WebView with no asset pipeline at all.

let AC = null;
// Two switches, as in HS's pause menu (SOUND, MUSIC): every effect goes through `master`, the
// match's music and crowd through `music`, and both into `out`, the one volume.
let out = null;
let master = null;
let music = null;
let enabled = true;        // sound effects
let musicOn = true;        // the match bed
let route = null;          // where env() sends a voice: the effects unless the bed is playing it

function ctx() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });   // the lowest output delay the device offers
    out = AC.createGain();
    out.gain.value = 0.32;
    out.connect(AC.destination);
    master = AC.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(out);
    music = AC.createGain();
    music.gain.value = musicOn ? 1 : 0;
    music.connect(out);
  }
  // iOS/WKWebView start every context suspended until a gesture; nudging it on each sound
  // is cheaper than tracking whether the unlock already happened. ('interrupted' is Safari's
  // word for a context a phone call or the app going to the background stopped.)
  if (AC.state === 'suspended' || AC.state === 'interrupted') AC.resume().catch(() => {});
  return AC;
}

const now = () => ctx().currentTime;

// One shared noise buffer — regenerating white noise per hit is pure waste.
let noiseBuf = null;
function noise() {
  const a = ctx();
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

function env(node, t0, peak, attack, decay) {
  const g = ctx().createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  node.connect(g);
  g.connect(route || master);
  return g;
}

// A noise burst through a bandpass: the arcade impact sound.
function thud({ freq = 220, q = 1.2, peak = 0.9, decay = 0.16, t = 0, attack = 0.004 } = {}) {
  const a = ctx(), t0 = now() + t;
  const src = noise();
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t0);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.35), t0 + decay);
  bp.Q.value = q;
  src.connect(bp);
  env(bp, t0, peak, attack, decay);
  src.start(t0);
  src.stop(t0 + attack + decay + 0.05);
}

// A pitched sweep: whooshes, charges, stingers.
function sweep({ from = 200, to = 800, type = 'square', peak = 0.5, dur = 0.18, t = 0, detune = 0, attack = 0.008 } = {}) {
  const a = ctx(), t0 = now() + t;
  const o = a.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  env(o, t0, peak, attack, dur);
  o.start(t0);
  o.stop(t0 + attack + dur + 0.05);
}

function blip({ freq = 660, type = 'square', peak = 0.4, dur = 0.08, t = 0 } = {}) {
  const a = ctx(), t0 = now() + t;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  env(o, t0, peak, 0.005, dur);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// Filtered noise swelling and falling away — a terrace, not a hiss.
function crowd({ dur = 1.4, peak = 0.5, t = 0 } = {}) {
  const a = ctx(), t0 = now() + t;
  const src = noise();
  src.loop = true;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t0);
  bp.frequency.linearRampToValueAtTime(1500, t0 + dur * 0.3);
  bp.frequency.linearRampToValueAtTime(600, t0 + dur);
  bp.Q.value = 0.6;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.18);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// ── THE CROWD'S VOICE ──────────────────────────────────────────────────────────────
// A stadium is thousands of people shouting one vowel at once. Each voice here is a buzzing
// sawtooth at its own pitch (men and women, a little out of tune with each other, each with
// its own wobble) run through three formant filters — the resonances that make an "O" an "O"
// and an "A" an "A" — and the filters glide from vowel to vowel, so the crowd SAYS the word.
// A breath of noise through the same formants, a hall of reverb, and it reads as a terrace.
let hall = null;
function crowdBus() {
  const a = ctx();
  if (!hall) {
    const len = Math.floor(a.sampleRate * 1.6), ir = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = a.createConvolver(); conv.buffer = ir;
    const wet = a.createGain(); wet.gain.value = 0.35;
    const dry = a.createGain(); dry.gain.value = 0.8;
    const input = a.createGain();
    input.connect(dry); dry.connect(master);
    input.connect(conv); conv.connect(wet); wet.connect(master);
    hall = input;
  }
  return hall;
}
const pan = (node, x) => {
  const a = ctx();
  if (!a.createStereoPanner) return node;
  const p = a.createStereoPanner(); p.pan.value = x; node.connect(p); return p;
};
// Vowels as [F1, F2, F3] (Hz), averaged across voices.
const VOWEL = { g: [300, 900, 2300], o: [480, 820, 2500], aw: [620, 980, 2550], a: [760, 1250, 2600], l: [360, 1050, 2600] };
// shape: [[time fraction, vowel], ...]; pitch: [[time fraction, multiplier], ...]; amp: likewise.
function chant({ n = 22, dur = 2.2, peak = 0.5, shape, pitch, amp, t = 0, spread = 0.12 }) {
  const a = ctx(), bus = crowdBus();
  for (let v = 0; v < n; v++) {
    const t0 = now() + t + Math.random() * 0.14, d = dur * (0.88 + Math.random() * 0.2);
    const female = Math.random() < 0.35;
    const f0 = (female ? 210 : 118) * (1 + (Math.random() - 0.5) * spread * 2);
    const o = a.createOscillator(); o.type = 'sawtooth';
    pitch.forEach(([k, m], i) => (i ? o.frequency.linearRampToValueAtTime(f0 * m, t0 + k * d) : o.frequency.setValueAtTime(f0 * m, t0)));
    // the wobble of a shouting voice
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = 4.5 + Math.random() * 2.5; lg.gain.value = f0 * 0.025;
    lfo.connect(lg); lg.connect(o.frequency);
    const breath = noise(); breath.loop = true;
    const bg = a.createGain(); bg.gain.value = 0.35;
    breath.connect(bg);
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    amp.forEach(([k, m]) => out.gain.linearRampToValueAtTime(Math.max(0.0001, (peak / Math.sqrt(n)) * m), t0 + k * d));
    const fm = female ? 1.15 : 1;
    [0, 1, 2].forEach((fi) => {
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [5, 7, 9][fi];
      shape.forEach(([k, vw], i) => {
        const f = VOWEL[vw][fi] * fm * (1 + (Math.random() - 0.5) * 0.06);
        i ? bp.frequency.linearRampToValueAtTime(f, t0 + k * d) : bp.frequency.setValueAtTime(f, t0);
      });
      const fg = a.createGain(); fg.gain.value = [1, 0.7, 0.3][fi];
      o.connect(bp); bg.connect(bp); bp.connect(fg); fg.connect(out);
    });
    pan(out, (Math.random() - 0.5) * 1.6).connect(bus);
    o.start(t0); lfo.start(t0); breath.start(t0);
    const end = t0 + d + 0.1;
    o.stop(end); lfo.stop(end); breath.stop(end);
  }
}
// The terrace underneath the words: a wide wash of noise that swells with them.
function roar({ dur = 2.5, peak = 0.4, t = 0, lo = 500, hi = 1400 } = {}) {
  const a = ctx(), t0 = now() + t, src = noise(); src.loop = true;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.5;
  bp.frequency.setValueAtTime(lo, t0); bp.frequency.linearRampToValueAtTime(hi, t0 + dur * 0.3); bp.frequency.linearRampToValueAtTime(lo, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.15); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); pan(g, 0).connect(crowdBus());
  src.start(t0); src.stop(t0 + dur + 0.05);
}
// Hands: each clap a tiny crack of band-passed noise, scattered in time and across the stands,
// thickest just after the goal and thinning out.
function claps({ count = 50, dur = 3, t = 0, peak = 0.35 } = {}) {
  const a = ctx(), bus = crowdBus();
  for (let i = 0; i < count; i++) {
    const t0 = now() + t + dur * Math.pow(Math.random(), 1.6);
    const src = noise(), bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1100 + Math.random() * 1500; bp.Q.value = 1.2;
    const g = a.createGain(), pk = peak * (0.4 + Math.random() * 0.6);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(pk, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05 + Math.random() * 0.04);
    src.connect(bp); bp.connect(g); pan(g, (Math.random() - 0.5) * 1.8).connect(bus);
    src.start(t0, Math.random() * 0.4); src.stop(t0 + 0.12);
  }
}
// A fan's two-finger whistle, rising.
function fanWhistle(t = 0) {
  const a = ctx(), t0 = now() + t, o = a.createOscillator(), g = a.createGain();
  const f = 1800 + Math.random() * 700;
  o.type = 'sine'; o.frequency.setValueAtTime(f * 0.8, t0); o.frequency.linearRampToValueAtTime(f * 1.15, t0 + 0.25); o.frequency.linearRampToValueAtTime(f, t0 + 0.55);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.05); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.6);
  o.connect(g); pan(g, (Math.random() - 0.5) * 1.6).connect(crowdBus()); o.start(t0); o.stop(t0 + 0.65);
}

// ── THE REAL CROWD ─────────────────────────────────────────────────────────────────
// Recorded crowds, several takes per moment, so no two goals sound alike: a take is picked at
// random (never the one just played), pitched and levelled a touch differently each time, and a
// goal sometimes gets a layer of applause on top at its own random offset. Fetched on the first
// sound and decoded once; until a take has arrived the synthesised voice above stands in.
const TAKES = {
  goal: ['goal1', 'goal2', 'goal3', 'goal4', 'goal5'],
  nearMiss: ['miss1', 'miss2', 'miss3'],
  goalAgainst: ['sad1', 'sad2', 'sad3'],
  applause: ['applause'],
};
const BUF = new Map(), LAST = {};
let loading = false;
function loadTakes() {
  if (loading || typeof fetch !== 'function') return;
  loading = true;
  const a = ctx();
  for (const name of Object.values(TAKES).flat()) {
    fetch(`audio/crowd/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((ab) => new Promise((ok, no) => a.decodeAudioData(ab, ok, no)))
      .then((b) => BUF.set(name, b)).catch(() => { /* the synth stands in */ });
  }
}
// `shape`: cut a take to HS's own crowd sounds — `dur` seconds from `offset`, a level envelope
// ([[s, 0–1], …]), and a tone: `lp`/`hp` (Hz), a `peak` ([Hz, dB, Q]), a high `shelf` ([Hz, dB]).
function take(kind, { gain = 1, t = 0, offset = 0, rate = [0.94, 1.06], shape = null } = {}) {
  const ready = TAKES[kind].filter((n) => BUF.has(n));
  if (!ready.length) return false;
  const pool = ready.length > 1 ? ready.filter((n) => n !== LAST[kind]) : ready;
  const name = pool[Math.floor(Math.random() * pool.length)];
  LAST[kind] = name;
  const a = ctx(), src = a.createBufferSource(), g = a.createGain();
  src.buffer = BUF.get(name);
  src.playbackRate.value = rate[0] + Math.random() * (rate[1] - rate[0]);
  const G = gain * (0.85 + Math.random() * 0.3), t0 = now() + t;
  let head = src;
  if (shape) {
    if (shape.lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = shape.lp; f.Q.value = 0.6; head.connect(f); head = f; }
    if (shape.hp) { const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = shape.hp; f.Q.value = 0.6; head.connect(f); head = f; }
    if (shape.shelf) { const f = a.createBiquadFilter(); f.type = 'highshelf'; [f.frequency.value, f.gain.value] = shape.shelf; head.connect(f); head = f; }
    if (shape.peak) { const f = a.createBiquadFilter(); f.type = 'peaking'; [f.frequency.value, f.gain.value, f.Q.value] = shape.peak; head.connect(f); head = f; }
    shape.env.forEach(([k, v], i) => (i ? g.gain.linearRampToValueAtTime(Math.max(0.0001, G * v), t0 + k) : g.gain.setValueAtTime(Math.max(0.0001, G * v), t0)));
  } else g.gain.value = G;
  head.connect(g); g.connect(master);
  src.start(t0, offset);
  if (shape) src.stop(t0 + shape.dur + 0.02);
  return true;
}
// HS's crowd at the final whistle (uploaded-images/Win2.ogg, Lose.ogg, measured), in OUR crowd's
// real voices. The WIN: 4.1 s of cheering — up in 0.3 s, held, down 20 dB by 3.5 s, gone by 3.9 —
// its weight at 630–1600 Hz: our goal roar from past its build-up, with applause under it.
function cheer(t = 0) {
  const env = [[0, 0], [0.3, 1], [3.3, 0.85], [3.62, 0.1], [3.95, 0]];
  take('goal', { gain: 0.8, t, offset: 2.7, rate: [0.97, 1.03], shape: { dur: 4.0, shelf: [2500, 8], peak: [1100, 3.5, 1], env } });
  take('applause', { gain: 0.5, t, offset: 1 + Math.random() * 3, rate: [1, 1], shape: { dur: 4.0, env } });
}
// The LOSS: a 1.8 s groan — up over 0.4 s, held, down 20 dB by 1.58 s — dark: the weight at
// 250–1000 Hz, little above 1.6 kHz. Our "awww", cut past its slow start and darkened.
function groan(t = 0) {
  take('goalAgainst', { gain: 2.3, t, offset: 0.8, rate: [0.95, 1.02], shape: { dur: 1.8, hp: 260, lp: 4500, peak: [2000, -8, 2], env: [[0, 0], [0.06, 0.7], [0.4, 1], [1.3, 0.8], [1.58, 0.1], [1.75, 0]] } });
}

// ---------------------------------------------------------------------------
// The kit. One entry per sim event, so game.js just forwards event types here.
// A referee's whistle: a pea whistle's ~2.9 kHz tone, trilled by the pea (fast wobble).
// HS's pea whistle (uploaded-images/Start.ogg, End sound.ogg, Pause2.ogg, measured): a 2767 Hz
// tone trilled by the pea at 76 Hz — the pitch swinging 2534–2943 Hz and the level pulsing ~0.8
// deep at the same rate — with its octave 25 dB down. Flat for the blast, 10 ms in and out.
function whistleBlast(t = 0, dur = 0.32, peak = 0.72) {
  const a = ctx(), t0 = now() + t;
  const o = a.createOscillator(), o2 = a.createOscillator(); o.frequency.value = 2767; o2.frequency.value = 2767 * 2;
  const fm = a.createOscillator(), fg = a.createGain(), fg2 = a.createGain(); fm.frequency.value = 76; fg.gain.value = 205; fg2.gain.value = 410;
  fm.connect(fg); fg.connect(o.frequency); fm.connect(fg2); fg2.connect(o2.frequency);
  const am = a.createGain(), ad = a.createGain(); am.gain.value = 0.6; ad.gain.value = 0.4; fm.connect(ad); ad.connect(am.gain);
  const h2 = a.createGain(); h2.gain.value = 0.056;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  out.gain.setValueAtTime(peak, t0 + dur - 0.012); out.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.connect(am); o2.connect(h2); h2.connect(am); am.connect(out); out.connect(master);
  // the breath through it: a band of air round 1.8 kHz and a hiss above 6 kHz
  const br = noise(); br.loop = true;
  const n1 = a.createBiquadFilter(); n1.type = 'bandpass'; n1.frequency.value = 2000; n1.Q.value = 5;
  const n2 = a.createBiquadFilter(); n2.type = 'highpass'; n2.frequency.value = 6000;
  const ng1 = a.createGain(); ng1.gain.value = 1.2; const ng2 = a.createGain(); ng2.gain.value = 0.03;
  br.connect(n1); n1.connect(ng1); ng1.connect(out); br.connect(n2); n2.connect(ng2); ng2.connect(out);
  for (const n of [o, o2, fm, br]) { n.start(t0); n.stop(t0 + dur + 0.02); }
}
// Full time (End sound.ogg): short, short, long — 0.30 s, 0.30 s, 0.75 s, 0.18 and 0.25 s apart.
function fullTime() { whistleBlast(0, 0.3); whistleBlast(0.48, 0.3); whistleBlast(1.03, 0.75); }
// A struck metal tube: inharmonic sine partials ringing down.
function clang(peak = 0.4, t = 0) {
  const a = ctx(), t0 = now() + t, out = a.createGain();
  [[0, 0.0001], [0.03, peak * 0.2], [0.21, peak], [0.55, peak * 0.7], [0.75, peak * 0.1], [0.97, peak * 0.01], [1.1, 0.0001]]
    .forEach(([k, v], i) => (i ? out.gain.linearRampToValueAtTime(v, t0 + k) : out.gain.setValueAtTime(v, t0)));
  // the rattle: the ring shaken at ~22 Hz, not quite regularly
  const rat = a.createOscillator(), rg = a.createGain(), rm = a.createGain(); rat.frequency.value = 22; rg.gain.value = 0.35; rm.gain.value = 0.65;
  rat.connect(rg); rg.connect(rm.gain); rm.connect(out); out.connect(master);
  for (const [f, db] of [[452, 0], [754, -8], [883, -7], [1055, -6], [1357, -15], [1421, -14], [1550, -16], [1701, -17]]) {
    const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004); g.gain.value = Math.pow(10, db / 20) * 0.55;
    o.connect(g); g.connect(rm); o.start(t0); o.stop(t0 + 1.15);
  }
  // …and the rattle's noise under the ring: low at 150–400 Hz, a hiss above 2.5 kHz
  const nz = noise(); nz.loop = true;
  const r1 = a.createBiquadFilter(); r1.type = 'bandpass'; r1.frequency.value = 320; r1.Q.value = 1.6;
  const r2 = a.createBiquadFilter(); r2.type = 'bandpass'; r2.frequency.value = 2800; r2.Q.value = 1.2;
  const q1 = a.createGain(); q1.gain.value = 2.4; const q2 = a.createGain(); q2.gain.value = 0.1;
  nz.connect(r1); r1.connect(q1); q1.connect(rm); nz.connect(r2); r2.connect(q2); q2.connect(rm);
  nz.start(t0); nz.stop(t0 + 1.15);
  rat.start(t0); rat.stop(t0 + 1.15);
}
function ashes() {
  const a = ctx(), t0 = now(), src = noise(); src.loop = true;
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; hp.Q.value = 0.5;
  const pk = a.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 8300; pk.Q.value = 0.9; pk.gain.value = 5;
  const g = a.createGain(), P = 0.078;
  [[0, P], [0.1, P * 0.8], [0.36, P * 0.9], [0.5, P * 0.5], [0.68, P * 0.1], [0.87, P * 0.01], [0.98, 0.0001]]
    .forEach(([k, v], i) => (i ? g.gain.linearRampToValueAtTime(v, t0 + k) : g.gain.setValueAtTime(v, t0)));
  const mid = a.createBiquadFilter(); mid.type = 'bandpass'; mid.frequency.value = 800; mid.Q.value = 0.4;
  const mg = a.createGain(); mg.gain.value = 0.22;
  src.connect(hp); hp.connect(pk); pk.connect(g); src.connect(mid); mid.connect(mg); mg.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 1);
  sweep({ from: 45, to: 30, type: 'sine', peak: 0.052, dur: 0.2 });
}
// A puff of air: noise through a low body band and a high hiss band, up over `at`, down over `dur`.
function whoosh({ lo = 400, hi = 9000, peak = 0.2, at = 0.1, dur = 0.2, t = 0, body = 1 } = {}) {
  const a = ctx(), t0 = now() + t, src = noise();
  const b1 = a.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = lo; b1.Q.value = 0.9;
  const b2 = a.createBiquadFilter(); b2.type = 'highpass'; b2.frequency.value = hi * 0.75;
  const g1 = a.createGain(); g1.gain.value = body; const g2 = a.createGain(); g2.gain.value = 0.9;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + at); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
  src.connect(b1); b1.connect(g1); g1.connect(g); src.connect(b2); b2.connect(g2); g2.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + at + dur + 0.05);
}

export const SFX = {
  // THE MENUS (HS M16, with sound): every button press is a short bright tap; turning the
  // carousel a softer tick; leaving the title a rising swish. Original, synthesised, small.
  tap()       { blip({ freq: 1320, type: 'triangle', peak: 0.16, dur: 0.045 }); blip({ freq: 1980, type: 'sine', peak: 0.07, dur: 0.035, t: 0.012 }); thud({ freq: 900, q: 1.4, peak: 0.08, decay: 0.04 }); },
  tick()      { blip({ freq: 980, type: 'triangle', peak: 0.09, dur: 0.03 }); },
  swish()     { sweep({ from: 260, to: 1400, type: 'sine', peak: 0.1, dur: 0.22 }); thud({ freq: 3200, q: 0.6, peak: 0.07, decay: 0.2, attack: 0.05 }); },
  // THE BOOT ON THE BALL (uploaded-images/Kick.ogg, measured): a deep boom — nearly all of it at
  // 30–60 Hz, peaking 30 ms in and down 20 dB by 90 ms, gone by 150 ms — with a hollow knock at
  // 430–1200 Hz on the front and a faint click above.
  kick()      { sweep({ from: 54, to: 33, type: 'sine', peak: 1.0, dur: 0.26, attack: 0.025 }); thud({ freq: 240, q: 0.8, peak: 0.55, decay: 0.2, attack: 0.012 }); thud({ freq: 800, q: 0.7, peak: 0.45, decay: 0.24, attack: 0.01 }); thud({ freq: 2600, q: 1, peak: 0.1, decay: 0.12, attack: 0.008 }); },
  // THE SECOND KICK SOUND (Kick3.ogg) — on the head here: a shorter "thock" at 172 Hz (100–250 Hz
  // hold it all), 110 ms, with a small click at 4–6 kHz.
  head()      { sweep({ from: 190, to: 165, type: 'sine', peak: 0.47, dur: 0.2, attack: 0.03 }); sweep({ from: 120, to: 100, type: 'sine', peak: 0.125, dur: 0.18, attack: 0.03 }); thud({ freq: 480, q: 0.8, peak: 0.31, decay: 0.15, attack: 0.01 }); thud({ freq: 5000, q: 1.2, peak: 0.26, decay: 0.08, attack: 0.005 }); },
  jump()      { thud({ freq: 1800, q: 0.7, peak: 0.08, decay: 0.12 }); },
  // THE DASH (Dash.ogg): a 0.5 s double whoosh — a 400 Hz body under a hiss at 6–16 kHz, up
  // over 130 ms, a dip at 210 ms and a second puff at 270 ms, gone by 420 ms.
  dash()      { whoosh({ lo: 380, hi: 9000, peak: 0.096, at: 0.14, dur: 0.24, body: 3 }); whoosh({ lo: 380, hi: 9000, peak: 0.08, at: 0.04, dur: 0.18, t: 0.24, body: 3 }); },
  // THE CROSSBAR (crossbar.ogg): a metal frame ringing and rattling — partials 452, 754, 883,
  // 1055, 1357–1701 Hz (452 loudest, the rest 6–17 dB down), swelling for 210 ms, held, and gone
  // by ~1 s.
  // The ball off the frame: SILENT (Idan: the clang's rattle read as a scraping, friction sound).
  // The crowd's "ohh" at a shot off the post or bar is its own event (game.js chanceNear) and stays.
  post()      {},

  // A boot to the shins: a heavy body knock with a smack on it.
  tackle()    { thud({ freq: 150, peak: 1.0, decay: 0.18 }); thud({ freq: 2400, q: 1.5, peak: 0.35, decay: 0.05 }); },

  // THE POWER BUTTON (Powershoot.ogg): a 1.8 s rush of bright noise — its weight at 2.5–10 kHz,
  // the lows 20 dB under — swelling for 0.4 s, sagging round 0.8 s, up again, gone by 1.75 s.
  armed()     {
    const a = ctx(), t0 = now(), src = noise(); src.loop = true;
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.5;
    const pk = a.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 4000; pk.Q.value = 0.8; pk.gain.value = 4;
    const lo = a.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 1100;
    const lg = a.createGain(); lg.gain.value = 0.9;
    const g = a.createGain(), P = 0.19;
    [[0, 0.0001], [0.03, P * 0.25], [0.39, P], [0.62, P * 0.75], [0.8, P * 0.4], [1.0, P * 0.5], [1.12, P * 0.6], [1.5, P * 0.35], [1.75, 0.0001]]
      .forEach(([k, v], i) => (i ? g.gain.linearRampToValueAtTime(v, t0 + k) : g.gain.setValueAtTime(v, t0)));
    src.connect(hp); hp.connect(pk); pk.connect(g); src.connect(lo); lo.connect(lg); lg.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 1.8);
  },

  // The shot going off: a big rushing whoosh over a low boom.
  powershot() {
    thud({ freq: 1400, q: 0.5, peak: 0.7, decay: 0.45 });
    sweep({ from: 110, to: 38, type: 'sine', peak: 0.7, dur: 0.4 });
  },

  // Blocked: the ball stopped dead against a boot — a thud with a ring.
  blocked()   { thud({ freq: 180, peak: 0.9, decay: 0.2 }); clang(0.25, 0.01); },

  counter()   { [1320, 1980, 2640].forEach((f, i) => blip({ freq: f, type: 'sine', peak: 0.28, dur: 0.3, t: i * 0.03 })); },

  // YOUR goal: the whole ground shouts "GOAAAAL!", roaring, clapping, a few fans whistling.
  goal()      {
    loadTakes();
    if (take('goal', { gain: 0.8 })) {
      if (Math.random() < 0.6) take('applause', { gain: 0.3 + Math.random() * 0.25, t: 0.4 + Math.random() * 1.2, offset: Math.random() * 3 });
      if (Math.random() < 0.5) for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) fanWhistle(0.3 + Math.random() * 2);
      return;
    }
    roar({ dur: 3.4, peak: 0.55, lo: 600, hi: 1600 });
    chant({ n: 26, dur: 2.3, peak: 0.95, t: 0.05,
      shape: [[0, 'g'], [0.06, 'o'], [0.22, 'a'], [0.85, 'a'], [1, 'l']],
      pitch: [[0, 1.05], [0.15, 1.4], [0.8, 1.35], [1, 1.15]],
      amp: [[0.05, 0.6], [0.2, 1], [0.8, 0.9], [1, 0]] });
    claps({ count: 70, dur: 3.2, t: 0.25 });
    for (let i = 0; i < 3; i++) fanWhistle(0.3 + Math.random() * 1.8);
  },
  // The OPPONENT'S goal: a long, falling "awwww" and a low grumble, nobody clapping.
  // THE OPPONENT'S GOAL: our crowd's real "awww", mixed with HS's (Goal_enemy2/5/7/8.ogg): their
  // slower build (~0.8 s), their length (1.3–3.7 s) and their darker top (little above 1.6 kHz).
  goalAgainst() {
    loadTakes();
    if (take('goalAgainst', { gain: 2.4, rate: [0.92, 1.04], shape: { dur: 2.3, hp: 280, lp: 4000, peak: [2000, -8, 2], env: [[0, 0], [0.25, 0.7], [0.55, 1], [1.8, 0.85], [2.15, 0.1], [2.3, 0]] } })) return;
    roar({ dur: 2.4, peak: 0.25, lo: 300, hi: 650 });
    chant({ n: 22, dur: 1.9, peak: 0.7,
      shape: [[0, 'aw'], [0.6, 'aw'], [1, 'o']],
      pitch: [[0, 1.2], [0.25, 1.1], [1, 0.72]],
      amp: [[0.12, 1], [0.6, 0.7], [1, 0]] });
  },
  // CLOSE, BUT NO: "ohhhhh" rising on the shot and sinking as it misses.
  nearMiss()  {
    loadTakes();
    if (take('nearMiss', { gain: 0.75, rate: [0.93, 1.07] })) return;
    roar({ dur: 1.6, peak: 0.25, lo: 450, hi: 900 });
    chant({ n: 20, dur: 1.4, peak: 0.7,
      shape: [[0, 'o'], [1, 'o']],
      pitch: [[0, 1.15], [0.3, 1.28], [1, 0.85]],
      amp: [[0.1, 1], [0.55, 0.8], [1, 0]] });
  },

  // Kick off (Start.ogg): one 0.55 s blast. Pause (Pause2.ogg): a 0.2 s pip.
  whistle()   { whistleBlast(0, 0.55); },
  pause()     { whistleBlast(0, 0.2, 0.27); },

  // Full time: three blasts over the crowd (a win cheers, a loss groans).
  win()       { loadTakes(); fullTime(); if (TAKES.goal.some((n) => BUF.has(n))) cheer(0.35); else crowd({ dur: 2.6, peak: 0.6 }); },
  cheer()     { loadTakes(); cheer(); },
  ashes()     { ashes(); },
  groan()     { loadTakes(); groan(); },
  lose()      {
    loadTakes(); fullTime();
    if (TAKES.goalAgainst.some((n) => BUF.has(n))) { groan(0.35); return; }
    const a = ctx(), t0 = now() + 0.2, src = noise(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(250, t0 + 1.6);
    src.loop = true; src.connect(lp); env(lp, t0, 0.35, 0.3, 1.4); src.start(t0); src.stop(t0 + 1.8);
  },
  reset()     { blip({ freq: 880, type: 'sine', peak: 0.18, dur: 0.1 }); },
  // AN UPGRADE BOUGHT: a coin's tick and two soft bell notes a fourth apart (E6 → A6), each with a
  // quiet octave over it for the bell — short and clean, no till. The tenth level adds a third.
  buy(top = false) {
    thud({ freq: 3200, q: 4, peak: 0.12, decay: 0.035 });
    const bell = (f, t, peak) => { blip({ freq: f, type: 'sine', peak, dur: 0.32, t }); blip({ freq: f * 2, type: 'sine', peak: peak * 0.22, dur: 0.16, t }); };
    bell(1318.5, 0.015, 0.2);
    bell(1760, 0.085, 0.22);
    if (top) bell(2637, 0.17, 0.18);
  },

  // ── the sounds HS has that this kit did not (HS-GAP-AUDIT V7) ──
  // The ball on the grass: a soft low thump, as loud as the bounce was hard.
  bounce(e)   { const k = Math.min(1, Math.abs(e?.v || 300) / 900); thud({ freq: 140 + 60 * k, q: 1.4, peak: 0.12 + 0.45 * k, decay: 0.07 + 0.05 * k }); },
  // A boot that lands on a body every fifth time: a dull knock and a yelp.
  hurt()      { thud({ freq: 320, peak: 0.8, decay: 0.12 }); sweep({ from: 900, to: 1500, type: 'triangle', peak: 0.18, dur: 0.12, t: 0.03 }); },
  // Knocked out: the fall, then the stars going round.
  stunned()   {
    sweep({ from: 700, to: 140, type: 'triangle', peak: 0.3, dur: 0.4 });
    [1568, 2093, 1760, 2349].forEach((f, i) => blip({ freq: f, type: 'triangle', peak: 0.14, dur: 0.12, t: 0.35 + i * 0.12 }));
  },
  revive()    { sweep({ from: 400, to: 900, type: 'triangle', peak: 0.16, dur: 0.14 }); },
  // A power shot landing on a player: the heaviest thing in the kit.
  powerHit()  { thud({ freq: 120, peak: 1.0, decay: 0.32 }); thud({ freq: 1900, q: 3, peak: 0.55, decay: 0.1 }); sweep({ from: 500, to: 60, type: 'sawtooth', peak: 0.3, dur: 0.3 }); },
  // Each ailment its own colour of sound.
  ailment(e)  {
    switch (e?.ail) {
      case 'freeze': case 'iced':
        [2637, 3136, 3951].forEach((f, i) => blip({ freq: f, type: 'sine', peak: 0.2, dur: 0.35, t: i * 0.05 })); thud({ freq: 4000, q: 4, peak: 0.3, decay: 0.2 }); break;
      // BURNT TO ASHES (Ashes.ogg): a bright crumbling hiss — its weight at 4–16 kHz, peak ~8.3 kHz —
      // held 0.35 s and gone by 0.9 s, over a small low thump.
      case 'burn': ashes(); break;
      case 'shock':
        for (let i = 0; i < 6; i++) blip({ freq: 110 + (i % 2) * 40, type: 'sawtooth', peak: 0.25, dur: 0.05, t: i * 0.05 }); break;
      case 'reverse':
        sweep({ from: 600, to: 300, type: 'sine', peak: 0.25, dur: 0.18 }); sweep({ from: 300, to: 600, type: 'sine', peak: 0.25, dur: 0.18, t: 0.18 }); break;
      case 'thrown': case 'twister':
        sweep({ from: 300, to: 1400, type: 'sawtooth', peak: 0.25, dur: 0.5 }); break;
      default:
        [1568, 2093, 1760].forEach((f, i) => blip({ freq: f, type: 'triangle', peak: 0.14, dur: 0.12, t: i * 0.1 }));
    }
  },
};

// A power shot's own sound, by FAMILY (the powershot event carries it): the shared whoosh,
// pitched and coloured per family so a Tornado does not sound like a Thunderbolt.
const FAMILY_VOICE = {
  straight: { from: 1400, to: 300 }, aerial: { from: 400, to: 2200 }, grab: { from: 300, to: 120, type: 'triangle' },
  delay: { from: 900, to: 900, type: 'triangle' }, ground: { from: 300, to: 60 }, destructive: { from: 1000, to: 80 },
  critical: { from: 2400, to: 200 }, downward: { from: 2000, to: 150 }, multiball: { from: 700, to: 1400, type: 'triangle' },
  updown: { from: 500, to: 1600, type: 'triangle' }, ailment: { from: 1200, to: 400, type: 'triangle' },
};
// …and the first three champions' own sound AT THE RELEASE, when the ball leaves the cut-in
// (shared/constants.js POWER_CUTIN − POWER_RELEASE = 1.27 s after the touch that sent this event):
// HS M4's audio has a broadband rush right there. So Korea is that rush, Cameroon's Thunderbolt a
// thunder crack, Nigeria's Tornado a wind that swells and blows through (docs/HS-FIRST-3-POWERS.md).
const RELEASE_AT = 1.27;
const CP_VOICE = {
  blueaura(t) { whoosh({ lo: 700, hi: 7000, peak: 0.34, at: 0.025, dur: 0.34, t, body: 2 }); },
  thunderbolt(t) {
    thud({ freq: 3200, q: 0.35, peak: 0.95, decay: 0.07, t });
    thud({ freq: 1200, q: 0.5, peak: 0.7, decay: 0.18, t: t + 0.01 });
    for (let i = 0; i < 5; i++) thud({ freq: 2400 + i * 520, q: 2, peak: 0.38, decay: 0.03, t: t + 0.04 + i * 0.037 });
    thud({ freq: 70, q: 0.6, peak: 0.6, decay: 0.5, t });
    sweep({ from: 95, to: 38, type: 'sine', peak: 0.5, dur: 0.7, t: t + 0.02 });
  },
  tornado(t) {
    whoosh({ lo: 260, hi: 3200, peak: 0.42, at: 0.12, dur: 0.55, t, body: 3 });
    whoosh({ lo: 420, hi: 5200, peak: 0.26, at: 0.08, dur: 0.4, t: t + 0.18, body: 2 });
  },
  // the Mythic Gem: a bright crystal chime rising over the rush (ours, not HS's)
  mythicgem(t) {
    whoosh({ lo: 900, hi: 9000, peak: 0.3, at: 0.03, dur: 0.32, t, body: 2 });
    [1568, 2093, 2637, 3136, 4186].forEach((f, i) => blip({ freq: f, type: 'sine', peak: 0.2 - i * 0.025, dur: 0.38, t: t + i * 0.035 }));
    sweep({ from: 1200, to: 3800, type: 'triangle', peak: 0.1, dur: 0.25, t });
  },
};
// The gem shattering: a glassy crack and a shower of tinkles falling away.
SFX.gemShatter = () => {
  thud({ freq: 5200, q: 0.5, peak: 0.55, decay: 0.09 });
  thud({ freq: 2400, q: 0.9, peak: 0.4, decay: 0.14, t: 0.005 });
  for (let i = 0; i < 10; i++) blip({ freq: 2600 + Math.random() * 3400 - i * 120, type: 'sine', peak: 0.16 - i * 0.011, dur: 0.06 + Math.random() * 0.1, t: 0.02 + i * 0.022 + Math.random() * 0.015 });
};
const basePowershot = SFX.powershot;
SFX.powershot = (e) => {
  basePowershot();
  const v = FAMILY_VOICE[e?.fam];
  if (v) sweep({ from: v.from, to: v.to, type: v.type || 'triangle', peak: 0.28, dur: 0.3, t: 0.04, detune: 7 });
  // (a block's fire-back leaves at once — no cut-in — so its sound does too)
  if (e?.cp && CP_VOICE[e.cp]) CP_VOICE[e.cp](e.rebound ? 0 : RELEASE_AT);
};

// ── THE MATCH BED: music and crowd (HS-GAP-AUDIT V4, V5) ─────────────────────────
// HS plays music under the whole match (its M3/M4 audio has no silence longer than 1.5 s, with
// a steady beat) over a crowd that never quite stops. Both are synthesised here, original, and
// scheduled a beat ahead on the audio clock so a busy frame cannot make them stutter.
const BPM = 124, BEAT = 60 / BPM;
// A four-bar loop in A minor: a bass note per beat, a stab on the off-beats of 2 and 4.
const BASS = [110, 110, 130.8, 110, 98, 98, 123.5, 98, 87.3, 87.3, 110, 87.3, 98, 98, 123.5, 146.8];
const STAB = [[440, 523, 659], [392, 494, 587], [349, 440, 523], [392, 494, 587]];
let bed = null;
function bedTick() {
  const a = ctx();
  route = music;
  try { bedVoices(a); } finally { route = null; }
}
function bedVoices(a) {
  while (bed.next < a.currentTime + 0.25) {
    const t = bed.next - a.currentTime, i = bed.step % 16, bar = Math.floor(bed.step / 4) % 4;
    thud({ freq: 90, q: 1, peak: 0.34, decay: 0.12, t });                                   // kick
    blip({ freq: BASS[i], type: 'triangle', peak: 0.22, dur: BEAT * 0.8, t });              // bass
    if (bed.step % 2 === 1) STAB[bar].forEach((f) => blip({ freq: f, type: 'triangle', peak: 0.07, dur: 0.12, t: t + BEAT / 2 }));
    thud({ freq: 7000, q: 5, peak: 0.08, decay: 0.03, t: t + BEAT / 2 });                   // hat
    bed.next += BEAT; bed.step++;
  }
}
export function startBed() {
  loadTakes();
  stopMenuMusic();
  if (bed || !musicOn) return;
  const a = ctx();
  // the crowd: a looped murmur, band-limited so it sits under everything else
  const src = noise(); src.loop = true;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const g = a.createGain(); g.gain.value = 0.07;
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(music);
  src.start();
  bed = { next: a.currentTime + 0.1, step: 0, crowd: src, timer: setInterval(() => { try { bedTick(); } catch { /* never worth a frame */ } }, 100) };
}
export function stopBed() {
  if (!bed) return;
  clearInterval(bed.timer);
  try { bed.crowd.stop(); } catch { /* already stopped */ }
  bed = null;
}

// ── THE MENU MUSIC (HS M16: music under the title, the menu and Player Select, without a
// break, until the match starts) ── Original: a bright four-chord loop in F major (F C Dm B♭),
// 120 BPM — a kick on 1 and 3, a bass note a beat, a plucked arpeggio in eighths, a light hat —
// quieter than the match's, so a tap still cuts through. Scheduled ahead like the match bed.
const MBPM = 120, MBEAT = 60 / MBPM;
const MBASS = [87.31, 130.81, 146.83, 116.54];
const MARP = [[349.2, 440, 523.3, 698.5], [392, 523.3, 659.3, 784], [293.7, 349.2, 440, 587.3], [349.2, 466.2, 587.3, 698.5]];
let menu = null;
function menuVoices(a) {
  while (menu.next < a.currentTime + 0.25) {
    const t = menu.next - a.currentTime, beat = menu.step % 4, bar = Math.floor(menu.step / 4) % 4;
    if (beat % 2 === 0) thud({ freq: 85, q: 1, peak: 0.2, decay: 0.11, t });
    blip({ freq: MBASS[bar], type: 'triangle', peak: 0.15, dur: MBEAT * 0.85, t });
    const arp = MARP[bar];
    blip({ freq: arp[(beat * 2) % 4], type: 'triangle', peak: 0.06, dur: 0.13, t });
    blip({ freq: arp[(beat * 2 + 1) % 4], type: 'triangle', peak: 0.05, dur: 0.12, t: t + MBEAT / 2 });
    thud({ freq: 7500, q: 5, peak: 0.045, decay: 0.025, t: t + MBEAT / 2 });
    menu.next += MBEAT; menu.step++;
  }
}
function menuTick() {
  const a = ctx();
  route = music;
  try { menuVoices(a); } finally { route = null; }
}
export function startMenuMusic() {
  if (menu || bed || !musicOn) return;
  const a = ctx();
  menu = { next: a.currentTime + 0.08, step: 0, timer: setInterval(() => { try { menuTick(); } catch { /* never worth a frame */ } }, 100) };
}
export function stopMenuMusic() {
  if (!menu) return;
  clearInterval(menu.timer);
  menu = null;
}
export const menuMusicPlaying = () => !!menu;
export const bedPlaying = () => !!bed;

// Both at once (the old single switch).
export function setAudioEnabled(v) { setSfxEnabled(v); setMusicEnabled(v); }
export function setSfxEnabled(v) {
  enabled = !!v;
  if (master) master.gain.value = enabled ? 1 : 0;
}
export function setMusicEnabled(v) {
  musicOn = !!v;
  if (!musicOn) { stopBed(); stopMenuMusic(); }
  if (music) music.gain.value = musicOn ? 1 : 0;
}
// THE NARRATOR (the tutorial's coach, tutorial.js): one recorded line at a time, under the
// SOUND switch like every effect, with the music ducked to a third while he talks. Clips are
// decoded once and kept; a new line cuts the one before it, as a narrator would.
const VOICE = new Map();             // url -> Promise<AudioBuffer | null>
const VOICE_BUF = new Map();         // url -> AudioBuffer, once decoded
let voiceSrc = null, voiceEnds = 0, voiceGain = null;
export function loadVoice(url) {
  if (!VOICE.has(url)) {
    VOICE.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => ab && new Promise((ok, no) => ctx().decodeAudioData(ab, ok, no)))
      .then((buf) => { if (buf) VOICE_BUF.set(url, buf); return buf; })
      .catch(() => null));
  }
  return VOICE.get(url);
}
export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* done already */ } voiceSrc = null; }
  voiceEnds = 0;
  if (music && AC) music.gain.setTargetAtTime(musicOn ? 1 : 0, AC.currentTime, 0.12);
}
// Plays it now if it is loaded (and when it loads, if it is still the latest line asked for).
let voiceWant = null;
export function playVoice(url) {
  voiceWant = url;
  stopVoice();
  if (!url || !enabled) return 0;
  const go = (buf) => {
    if (!buf || voiceWant !== url) return;
    const a = ctx();
    // 1.5: the narrator peaks ~0.4 at the output — over the kicks (~0.3), not shouting
    if (!voiceGain) { voiceGain = a.createGain(); voiceGain.gain.value = 1.5; voiceGain.connect(master); }
    const src = a.createBufferSource();
    src.buffer = buf; src.connect(voiceGain); src.start();
    voiceSrc = src; voiceEnds = a.currentTime + buf.duration;
    music.gain.setTargetAtTime(musicOn ? 0.33 : 0, a.currentTime, 0.08);
    src.onended = () => { if (voiceSrc === src) stopVoice(); };
  };
  const buf = VOICE_BUF.get(url);
  if (buf) go(buf); else loadVoice(url).then(go);
  return buf ? buf.duration : 0;
}
// Seconds of the current line still to come (0 when he is quiet).
export const voiceLeft = () => (voiceSrc && AC ? Math.max(0, voiceEnds - AC.currentTime) : 0);

// THE UNLOCK, from inside a tap or a key (game.js calls it on every one until it takes). It makes
// the context, resumes it, and — the first time — starts one silent sample, which older iOS
// needs to see inside the gesture before it lets any later sound out.
let primed = false;
export function unlockAudio() {
  const a = ctx();
  if (!primed) {
    primed = true;
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch { /* nothing to prime */ }
  }
  return a.state;
}
// How loud the game is right now, 0..1 (the peak of the last ~20 ms at the output) — so a
// harness can tell sound from silence without a speaker.
let meter = null, meterBuf = null;
export function audioLevel() {
  if (!AC || !out) return 0;
  if (!meter) { meter = AC.createAnalyser(); meter.fftSize = 1024; meterBuf = new Float32Array(meter.fftSize); out.connect(meter); }
  meter.getFloatTimeDomainData(meterBuf);
  let p = 0;
  for (const v of meterBuf) p = Math.max(p, Math.abs(v));
  return p;
}
// What the browser is letting the context do: 'none' (not made yet), 'suspended', 'running'.
export const audioState = () => (AC ? AC.state : 'none');
export const audioEnabled = () => enabled;
export const musicEnabled = () => musicOn;

// A champion power's own sound, as data: [{ k: 'thud' | 'sweep' | 'blip' | 'crowd', …params }].
// The same four primitives the kit above is built from — see public/champ-vfx.js.
const PRIMS = { thud, sweep, blip, crowd };
export function synth(list) {
  if (!enabled) return;
  try { for (const { k, ...o } of list) if (PRIMS[k]) PRIMS[k](o); } catch { /* never worth a frame */ }
}

// Forward a sim event to the kit. Unknown events are silently ignored, so adding an event
// to the sim never breaks audio and never needs a matching change here.
export function playEvent(type, e) {
  if (!enabled) return;
  const fn = SFX[type];
  if (fn) { try { fn(e); } catch { /* audio is never worth crashing a frame for */ } }
}

// For a test harness: render one kit sound into an OfflineAudioContext and hand back the
// samples, so its level can be measured (and listened to) without a speaker.
export async function renderOffline(name, sec = 4) {
  const keep = [AC, master, noiseBuf, hall];
  const off = new OfflineAudioContext(2, Math.ceil(44100 * sec), 44100);
  AC = off; master = off.createGain(); master.gain.value = 0.32; master.connect(off.destination);
  noiseBuf = null; hall = null;
  try { SFX[name]({ player: 0 }); } finally { [AC, master, noiseBuf, hall] = keep; }
  const buf = await off.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
