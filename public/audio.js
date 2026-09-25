// Arcade SFX, synthesised — no audio files anywhere.
//
// The brief was "sounds from Street Fighter II". Those samples are Capcom's, so this is the
// nearest honest thing: the same *vocabulary* built out of WebAudio primitives. Early-90s
// arcade hardware was making these noises the same way — a short noise burst through a
// bandpass for an impact, a square sweep for a whoosh, a detuned pair for a fanfare. Which
// means a synth gets genuinely close rather than merely approximating a sample.
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

// ---------------------------------------------------------------------------
// The kit. One entry per sim event, so game.js just forwards event types here.
export const SFX = {
  kick()      { thud({ freq: 260, peak: 0.7, decay: 0.12 }); sweep({ from: 420, to: 130, peak: 0.22, dur: 0.1 }); },
  head()      { thud({ freq: 500, q: 2.2, peak: 0.5, decay: 0.09 }); },
  jump()      { sweep({ from: 240, to: 620, type: 'square', peak: 0.16, dur: 0.11 }); },
  dash()      { sweep({ from: 900, to: 220, type: 'sawtooth', peak: 0.2, dur: 0.14 }); },
  post()      { blip({ freq: 1400, type: 'triangle', peak: 0.45, dur: 0.22 }); blip({ freq: 2100, type: 'triangle', peak: 0.2, dur: 0.16, t: 0.01 }); },

  // A punch connecting: low body thud plus a bright crack on top.
  tackle()    { thud({ freq: 170, peak: 1.0, decay: 0.2 }); thud({ freq: 1600, q: 3, peak: 0.5, decay: 0.07 }); },

  // Charging up. Rising detuned pair — the classic "I am about to do something" cue.
  armed()     {
    sweep({ from: 180, to: 900, type: 'sawtooth', peak: 0.3, dur: 0.45 });
    sweep({ from: 180, to: 900, type: 'sawtooth', peak: 0.3, dur: 0.45, detune: 14 });
    blip({ freq: 1320, peak: 0.3, dur: 0.1, t: 0.42 });
  },

  // Fireball: a big downward whoosh with a noise body riding under it.
  powershot() {
    sweep({ from: 1200, to: 180, type: 'sawtooth', peak: 0.55, dur: 0.38 });
    thud({ freq: 900, q: 0.8, peak: 0.8, decay: 0.34 });
    blip({ freq: 220, type: 'square', peak: 0.35, dur: 0.3 });
  },

  // Metal on metal — you got in the way and it cost you.
  blocked()   {
    thud({ freq: 2600, q: 6, peak: 0.7, decay: 0.16 });
    blip({ freq: 1760, type: 'triangle', peak: 0.4, dur: 0.24 });
    blip({ freq: 1174, type: 'triangle', peak: 0.3, dur: 0.28, t: 0.02 });
  },

  counter()   { blip({ freq: 2093, type: 'triangle', peak: 0.5, dur: 0.16 }); blip({ freq: 3136, type: 'triangle', peak: 0.35, dur: 0.2, t: 0.04 }); },

  // Goal: fanfare over a terrace roar.
  goal()      {
    crowd({ dur: 1.8, peak: 0.55 });
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      blip({ freq: f, type: 'square', peak: 0.34, dur: 0.16, t: i * 0.075 });
      blip({ freq: f * 1.5, type: 'square', peak: 0.12, dur: 0.16, t: i * 0.075 });
    });
  },

  whistle()   { sweep({ from: 2100, to: 2400, type: 'sine', peak: 0.3, dur: 0.16 }); sweep({ from: 2400, to: 2000, type: 'sine', peak: 0.3, dur: 0.2, t: 0.16 }); },

  win()       { [523, 659, 784, 1047, 1319].forEach((f, i) => blip({ freq: f, type: 'square', peak: 0.36, dur: 0.2, t: i * 0.1 })); crowd({ dur: 2.2, peak: 0.5 }); },
  lose()      { [523, 466, 392, 311].forEach((f, i) => blip({ freq: f, type: 'square', peak: 0.32, dur: 0.28, t: i * 0.14 })); },
  reset()     { blip({ freq: 880, type: 'triangle', peak: 0.22, dur: 0.1 }); },

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
  straight: { from: 1400, to: 300 }, aerial: { from: 400, to: 2200 }, grab: { from: 300, to: 120, type: 'square' },
  delay: { from: 900, to: 900, type: 'square' }, ground: { from: 300, to: 60 }, destructive: { from: 1000, to: 80 },
  critical: { from: 2400, to: 200 }, downward: { from: 2000, to: 150 }, multiball: { from: 700, to: 1400, type: 'square' },
  updown: { from: 500, to: 1600, type: 'triangle' }, ailment: { from: 1200, to: 400, type: 'triangle' },
};
const basePowershot = SFX.powershot;
SFX.powershot = (e) => {
  basePowershot();
  const v = FAMILY_VOICE[e?.fam];
  if (v) sweep({ from: v.from, to: v.to, type: v.type || 'sawtooth', peak: 0.28, dur: 0.3, t: 0.04, detune: 7 });
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
    if (bed.step % 2 === 1) STAB[bar].forEach((f) => blip({ freq: f, type: 'square', peak: 0.045, dur: 0.09, t: t + BEAT / 2 }));
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
