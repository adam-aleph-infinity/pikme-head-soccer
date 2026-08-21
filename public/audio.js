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

// A long low-passed noise bed: earth moving, not a hit. Used for the meteor impact and
// for the shower's opening rumble.
function rumble({ dur = 0.8, peak = 0.9, freq = 150, t = 0 } = {}) {
  const a = ctx(), t0 = now() + t;
  const src = noise();
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq, t0);
  lp.frequency.exponentialRampToValueAtTime(50, t0 + dur);
  lp.Q.value = 3;
  src.connect(lp);
  env(lp, t0, peak, 0.02, dur);
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

  // ---- SPECTACLE --------------------------------------------------------
  // The telegraph has to be audible as well as visible: on a phone, in a pocket, the
  // whistle is often what makes you look down before the rock lands.

  // Shower incoming: an air-raid two-tone over a rumble.
  meteorStart() {
    rumble({ dur: 1.2, peak: 0.7, freq: 220 });
    sweep({ from: 440, to: 880, type: 'square', peak: 0.28, dur: 0.34 });
    sweep({ from: 880, to: 440, type: 'square', peak: 0.28, dur: 0.34, t: 0.34 });
    sweep({ from: 440, to: 880, type: 'square', peak: 0.22, dur: 0.34, t: 0.68 });
  },

  // ONE rock, marked. The classic falling-bomb whistle: pitch drops the whole way down.
  meteorWarn() {
    sweep({ from: 1500, to: 260, type: 'sawtooth', peak: 0.20, dur: 1.0 });
    sweep({ from: 1500, to: 260, type: 'sine', peak: 0.14, dur: 1.0, detune: 22 });
  },

  // Landing. Everything low, with a crack of debris on top.
  meteorHit() {
    rumble({ dur: 0.9, peak: 1.0, freq: 180 });
    thud({ freq: 90, q: 0.7, peak: 1.0, decay: 0.45 });
    thud({ freq: 1900, q: 4, peak: 0.45, decay: 0.1 });
    blip({ freq: 70, type: 'square', peak: 0.4, dur: 0.4 });
  },
  meteorBall()  { thud({ freq: 700, q: 2, peak: 0.6, decay: 0.14 }); sweep({ from: 300, to: 1400, peak: 0.3, dur: 0.3 }); },
  meteorKnock() { thud({ freq: 150, peak: 0.85, decay: 0.22 }); },

  // Transforming: a servo ratchet under a rising whine, then the clunk of it locking in.
  robotCharge() {
    sweep({ from: 120, to: 760, type: 'sawtooth', peak: 0.26, dur: 0.9 });
    sweep({ from: 120, to: 760, type: 'square', peak: 0.16, dur: 0.9, detune: -18 });
    for (let i = 0; i < 7; i++) blip({ freq: 300 + i * 90, type: 'square', peak: 0.14, dur: 0.05, t: i * 0.11 });
  },
  robotOn() {
    thud({ freq: 200, peak: 1.0, decay: 0.26 });
    [131, 196, 262].forEach((f, i) => {
      blip({ freq: f, type: 'sawtooth', peak: 0.3, dur: 0.42, t: i * 0.02 });
      blip({ freq: f * 2, type: 'square', peak: 0.14, dur: 0.34, t: i * 0.02 });
    });
    sweep({ from: 900, to: 2400, type: 'square', peak: 0.2, dur: 0.24 });
  },
  // Powering down — the same chord falling apart.
  robotOff() {
    sweep({ from: 700, to: 90, type: 'sawtooth', peak: 0.3, dur: 0.55 });
    blip({ freq: 160, type: 'square', peak: 0.22, dur: 0.3, t: 0.3 });
  },

  // Low gravity: a bell that will not settle.
  moonStart() {
    [784, 1047, 1319].forEach((f, i) => {
      blip({ freq: f, type: 'sine', peak: 0.3, dur: 0.7, t: i * 0.09 });
      blip({ freq: f * 1.005, type: 'sine', peak: 0.2, dur: 0.7, t: i * 0.09 });
    });
  },
  moonEnd()   { [1319, 1047, 784].forEach((f, i) => blip({ freq: f, type: 'sine', peak: 0.22, dur: 0.34, t: i * 0.07 })); },

  // Wind: bandpassed noise that swells and drops, an octave under the crowd.
  windStart() { crowd({ dur: 1.6, peak: 0.42 }); sweep({ from: 300, to: 180, type: 'sine', peak: 0.16, dur: 1.2 }); },
  windEnd()   { crowd({ dur: 0.7, peak: 0.18 }); },
};

export function setAudioEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.32 : 0;
}
export const audioEnabled = () => enabled;

// Forward a sim event to the kit. Unknown events are silently ignored, so adding an event
// to the sim never breaks audio and never needs a matching change here.
export function playEvent(type) {
  if (!enabled) return;
  const fn = SFX[type];
  if (fn) { try { fn(); } catch { /* audio is never worth crashing a frame for */ } }
}
