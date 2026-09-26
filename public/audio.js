// Match SFX, synthesised — no audio files anywhere.
//
// Voiced after Head Soccer's (Idan, 2026-09-26: "do everything like HS"): natural sounds — a
// round thump off the boot, a springy knock off the head, a referee's trilled whistle, a crowd
// that roars on a goal — rather than the Street Fighter II chiptune this kit was first written to.
// The sounds themselves stay our own: built from WebAudio noise, filters and sine partials.
//
// Everything is created on demand and thrown away. No buffers to preload, nothing to block
// the first frame, and it survives the WebView with no asset pipeline at all.

let AC = null;
let master = null;
let enabled = true;

function ctx() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.32;
    master.connect(AC.destination);
  }
  // iOS/WKWebView start every context suspended until a gesture; nudging it on each sound
  // is cheaper than tracking whether the unlock already happened.
  if (AC.state === 'suspended') AC.resume().catch(() => {});
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
  g.connect(master);
  return g;
}

// A noise burst through a bandpass: the arcade impact sound.
function thud({ freq = 220, q = 1.2, peak = 0.9, decay = 0.16, t = 0 } = {}) {
  const a = ctx(), t0 = now() + t;
  const src = noise();
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t0);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.35), t0 + decay);
  bp.Q.value = q;
  src.connect(bp);
  env(bp, t0, peak, 0.004, decay);
  src.start(t0);
  src.stop(t0 + decay + 0.05);
}

// A pitched sweep: whooshes, charges, stingers.
function sweep({ from = 200, to = 800, type = 'square', peak = 0.5, dur = 0.18, t = 0, detune = 0 } = {}) {
  const a = ctx(), t0 = now() + t;
  const o = a.createOscillator();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  env(o, t0, peak, 0.008, dur);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
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

// ---------------------------------------------------------------------------
// The kit. One entry per sim event, so game.js just forwards event types here.
// A referee's whistle: a pea whistle's ~2.9 kHz tone, trilled by the pea (fast wobble).
function whistleBlast(t = 0, dur = 0.32) {
  for (let k = 0; k * 0.028 < dur; k++) blip({ freq: k % 2 ? 2750 : 2950, type: 'sine', peak: 0.2, dur: 0.034, t: t + k * 0.028 });
}
// A struck metal tube: inharmonic sine partials ringing down.
function clang(peak = 0.4, t = 0) {
  [[620, 1], [1705, 0.55], [2790, 0.35], [4100, 0.2]].forEach(([f, g]) => blip({ freq: f, type: 'sine', peak: peak * g, dur: 0.5 * (1.2 - g * 0.4), t }));
}

export const SFX = {
  // The boot on the ball: a round low thump with a pitch drop, no chip in it.
  kick()      { thud({ freq: 140, q: 0.9, peak: 0.85, decay: 0.09 }); sweep({ from: 190, to: 60, type: 'sine', peak: 0.5, dur: 0.12 }); },
  // The head: springier — a knock with a short boing on top.
  head()      { thud({ freq: 420, q: 1.6, peak: 0.45, decay: 0.07 }); sweep({ from: 330, to: 150, type: 'sine', peak: 0.35, dur: 0.14 }); },
  jump()      { thud({ freq: 1800, q: 0.7, peak: 0.08, decay: 0.12 }); },
  dash()      { thud({ freq: 2200, q: 0.5, peak: 0.16, decay: 0.16 }); },
  post()      { clang(0.42); },

  // A boot to the shins: a heavy body knock with a smack on it.
  tackle()    { thud({ freq: 150, peak: 1.0, decay: 0.18 }); thud({ freq: 2400, q: 1.5, peak: 0.35, decay: 0.05 }); },

  // Armed: a rising swell of air and tone — the power gathering.
  armed()     {
    const a = ctx(), t0 = now(), src = noise(), bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(3000, t0 + 0.5);
    src.connect(bp); env(bp, t0, 0.35, 0.4, 0.15); src.start(t0); src.stop(t0 + 0.6);
    sweep({ from: 220, to: 880, type: 'sine', peak: 0.2, dur: 0.5 });
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
    roar({ dur: 3.4, peak: 0.55, lo: 600, hi: 1600 });
    chant({ n: 26, dur: 2.3, peak: 0.95, t: 0.05,
      shape: [[0, 'g'], [0.06, 'o'], [0.22, 'a'], [0.85, 'a'], [1, 'l']],
      pitch: [[0, 1.05], [0.15, 1.4], [0.8, 1.35], [1, 1.15]],
      amp: [[0.05, 0.6], [0.2, 1], [0.8, 0.9], [1, 0]] });
    claps({ count: 70, dur: 3.2, t: 0.25 });
    for (let i = 0; i < 3; i++) fanWhistle(0.3 + Math.random() * 1.8);
  },
  // The OPPONENT'S goal: a long, falling "awwww" and a low grumble, nobody clapping.
  goalAgainst() {
    roar({ dur: 2.4, peak: 0.25, lo: 300, hi: 650 });
    chant({ n: 22, dur: 1.9, peak: 0.7,
      shape: [[0, 'aw'], [0.6, 'aw'], [1, 'o']],
      pitch: [[0, 1.2], [0.25, 1.1], [1, 0.72]],
      amp: [[0.12, 1], [0.6, 0.7], [1, 0]] });
  },
  // CLOSE, BUT NO: "ohhhhh" rising on the shot and sinking as it misses.
  nearMiss()  {
    roar({ dur: 1.6, peak: 0.25, lo: 450, hi: 900 });
    chant({ n: 20, dur: 1.4, peak: 0.7,
      shape: [[0, 'o'], [1, 'o']],
      pitch: [[0, 1.15], [0.3, 1.28], [1, 0.85]],
      amp: [[0.1, 1], [0.55, 0.8], [1, 0]] });
  },

  whistle()   { whistleBlast(0, 0.34); },

  // Full time: three blasts over the crowd (a win cheers, a loss groans).
  win()       { whistleBlast(0, 0.22); whistleBlast(0.3, 0.22); whistleBlast(0.6, 0.5); crowd({ dur: 2.6, peak: 0.6 }); },
  lose()      {
    whistleBlast(0, 0.22); whistleBlast(0.3, 0.22); whistleBlast(0.6, 0.5);
    const a = ctx(), t0 = now() + 0.2, src = noise(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(250, t0 + 1.6);
    src.loop = true; src.connect(lp); env(lp, t0, 0.35, 0.3, 1.4); src.start(t0); src.stop(t0 + 1.8);
  },
  reset()     { blip({ freq: 880, type: 'sine', peak: 0.18, dur: 0.1 }); },

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
      case 'burn':
        thud({ freq: 900, q: 0.5, peak: 0.5, decay: 0.5 }); sweep({ from: 200, to: 90, type: 'sawtooth', peak: 0.2, dur: 0.45 }); break;
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
const basePowershot = SFX.powershot;
SFX.powershot = (e) => {
  basePowershot();
  const v = FAMILY_VOICE[e?.fam];
  if (v) sweep({ from: v.from, to: v.to, type: v.type || 'triangle', peak: 0.28, dur: 0.3, t: 0.04, detune: 7 });
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
  if (bed || !enabled) return;
  const a = ctx();
  // the crowd: a looped murmur, band-limited so it sits under everything else
  const src = noise(); src.loop = true;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const g = a.createGain(); g.gain.value = 0.07;
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
  src.start();
  bed = { next: a.currentTime + 0.1, step: 0, crowd: src, timer: setInterval(() => { try { bedTick(); } catch { /* never worth a frame */ } }, 100) };
}
export function stopBed() {
  if (!bed) return;
  clearInterval(bed.timer);
  try { bed.crowd.stop(); } catch { /* already stopped */ }
  bed = null;
}

export function setAudioEnabled(v) {
  enabled = v;
  if (!v) stopBed();
  if (master) master.gain.value = v ? 0.32 : 0;
}
export const audioEnabled = () => enabled;

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
  try { SFX[name](); } finally { [AC, master, noiseBuf, hall] = keep; }
  const buf = await off.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
