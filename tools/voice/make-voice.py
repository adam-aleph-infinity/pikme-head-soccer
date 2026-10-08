# THE NARRATOR'S VOICE — every tutorial line, spoken in Idan's own voice (Idan, 2026-10-07: "the
# SAME EXACTLY VOICE like the audio I uploaded… not like AI or robotic").
#
# Local and free (Idan's choice): Resemble AI's Chatterbox multilingual model copies a voice from
# a few seconds of it, and speaks Hebrew — but only well with the vowels written in (niqqud), so
# Dicta's diacritizer puts them in first. (Chatterbox calls Dicta itself, wrongly, and silently
# falls back to bare letters — which came out garbled. So the text arrives here already pointed.)
#
# Each line is made in several takes (two stretches of the recording × a calm and a livelier
# read) and the best is kept: the one a Hebrew speech recognizer hears back closest to the words,
# and whose voice is closest to the recording. Then the silence is trimmed, the level evened
# out, and it is written to public/audio/voice/<id>.mp3, which the tutorial plays.
#
# Run (see docs/TUTORIAL.md §Narration for the setup):
#   node tools/voice/lines.mjs > /tmp/lines.json
#   <venv>/bin/python tools/voice/make-voice.py --lines /tmp/lines.json --ref <recording> \
#       --dicta <dicta-1.0.onnx> --out public/audio/voice [--only id,id] [--takes 4]
# Chatterbox marks everything it makes with Resemble's inaudible watermark (Perth). Left on.
import argparse, json, os, re, subprocess, sys, time, unicodedata

ap = argparse.ArgumentParser()
ap.add_argument('--lines', required=True)
ap.add_argument('--ref', required=True)
ap.add_argument('--dicta', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--work', default='/tmp/saltiz-voice')
ap.add_argument('--only', default='')
ap.add_argument('--takes', type=int, default=4)
ap.add_argument('--min-sim', type=float, default=0.0)   # also go to a second round under this voice match
args = ap.parse_args()
os.makedirs(args.work, exist_ok=True)
os.makedirs(args.out, exist_ok=True)

def ff(*a):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)

# ── the reference: the whole recording (for judging), and two clean stretches (for copying) ──
full = os.path.join(args.work, 'ref-full.wav')
ff('-i', args.ref, '-ac', '1', '-ar', '24000', full)
REFS = {}
for name, start, dur in [('long', 20.0, 30.0), ('e', 51.0, 12.0)]:
    REFS[name] = os.path.join(args.work, f'ref-{name}.wav')
    ff('-i', full, '-ss', str(start), '-t', str(dur), '-af', 'highpass=f=70,loudnorm=I=-20:TP=-2', '-ar', '24000', REFS[name])

# ── what is SAID (the bubbles are for reading; a narrator says numbers and English as words) ──
SPOKEN = {   # only where the bubble's words are not the ones to say: numbers and English as words
    'power': 'וואו, מד הכוח מלא! לחצו על פאוור, ותפעילו כוח על!',
    'counter': 'זהירות! עכשיו היריב יירה עליכם כוח על. בעטו בכדור לפני שהוא פוגע בכם, וחסמתם אותו!',
    'won': 'ניצחון ראשון! כל הכבוד! קיבלתם חמש מאות נקודות סולטיז!',
    'lost': 'לא נורא, אתם משתפרים! על האימון קיבלתם חמש מאות נקודות סולטיז!',
    'draw': 'תיקו! לא רע בכלל! על האימון קיבלתם חמש מאות נקודות סולטיז!',
    'stats': 'מהירות, בעיטה, קפיצה, דאש, וכוח. הכוח ממלא את מד הפאוור מהר יותר!',
    'arcade': 'ועכשיו, לארקייד! נצחו את ארבעים וחמישה האלופים, וכל ניצחון שווה עוד נקודות. בהצלחה!',
}
# words Dicta points wrongly (names, loanwords), pointed by hand
FIX = {
    'לסולטיז': 'לְסוֹלְטִיז', 'סולטיז': 'סוֹלְטִיז', 'דאש': 'דֶּאשׁ',
    'פאוור': 'פָּאוּאֶר', 'הפאוור': 'הַפָּאוּאֶר', 'לארקייד': 'לָאַרְקֵייד',
}
NIQQUD = re.compile('[֑-ׇ]')
def bare(t): return NIQQUD.sub('', t)
def norm(t): return re.sub(r'[^א-ת]', '', bare(unicodedata.normalize('NFC', t)))

lines = json.load(open(args.lines))
only = set(filter(None, args.only.split(',')))
todo = {k: SPOKEN.get(k, v.replace('\n', ' ').replace('—', ',').replace(' · ', ', ')) for k, v in lines.items() if not only or k in only}

from dicta_onnx import Dicta
dicta = Dicta(args.dicta)
def point(t):
    # Dicta writes a kubutz AND the vav (מְעֻולֶּה); the model reads that oddly, so make it a shuruk
    out = dicta.add_diacritics(t).replace('ֻו', 'וּ')
    return ' '.join(FIX.get(re.sub(r'[^א-ת]', '', bare(w)), None) and re.sub(r'[א-ת֑-ׇ]+', FIX[re.sub(r'[^א-ת]', '', bare(w))], w) or w for w in out.split(' '))

import numpy as np, torch, torchaudio as ta, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel
from resemblyzer import VoiceEncoder, preprocess_wav
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
tts = ChatterboxMultilingualTTS.from_pretrained(device=dev)
asr = WhisperModel('medium', device='cpu', compute_type='int8')
enc = VoiceEncoder('cpu')
ref_emb = enc.embed_utterance(preprocess_wav(full))

def lev(a, b):
    p = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        c = [i]
        for j, cb in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (ca != cb)))
        p = c
    return p[-1]

# a happy, kid-friendly coach (Idan): livelier reads than the default 0.5
TAKES = [('long', 0.7), ('e', 0.7), ('long', 0.8), ('e', 0.8), ('long', 0.75), ('e', 0.75), ('long', 0.65), ('e', 0.65)]
report = {}
for k, spoken in todo.items():
    pointed = point(spoken)
    target = norm(spoken)
    best = None
    tried = []
    # two rounds of --takes each, cycling the reads; the second only if the first heard it wrong
    for rnd in range(2):
        for n in range(args.takes):
            ref, exag = TAKES[(n + rnd * args.takes) % len(TAKES)]
            torch.manual_seed(1000 * rnd + 17 * n + len(k))
            t0 = time.time()
            wav = tts.generate(pointed, language_id='he', audio_prompt_path=REFS[ref], exaggeration=exag, cfg_weight=0.4, temperature=0.8)
            raw = os.path.join(args.work, f'{k}-{rnd}{n}.wav')
            ta.save(raw, wav, tts.sr)
            dur = wav.shape[-1] / tts.sr
            segs = list(asr.transcribe(raw, language='he', beam_size=5, word_timestamps=True)[0])
            heard = ' '.join(s.text.strip() for s in segs)
            # the model can babble on quietly after the last word: cut the take there
            words = [w for s in segs for w in (s.words or [])]
            if words and words[-1].end + 0.25 < dur:
                cut = int((words[-1].end + 0.25) * tts.sr)
                wav = wav[..., :cut]; ta.save(raw, wav, tts.sr); dur = wav.shape[-1] / tts.sr
            cer = lev(norm(heard), target) / max(1, len(target))
            sim = float(np.dot(ref_emb, enc.embed_utterance(preprocess_wav(raw))))
            cps = len(target) / max(0.1, dur)               # letters a second: 6–20 is speech
            # lively: how far the pitch moves (semitones); a flat, robotic read is under ~2.5
            try:
                y, sr_ = librosa.load(raw, sr=16000); f0, vo, _ = librosa.pyin(y, fmin=70, fmax=400, sr=sr_)
                f = f0[vo & ~np.isnan(f0)]; live = float(np.std(12 * np.log2(f / np.median(f)))) if len(f) > 10 else 0.0
            except Exception: live = 0.0
            score = sim - 0.8 * cer - (0.3 if not 5 <= cps <= 22 else 0) + 0.04 * min(live, 5)
            tried.append({'take': f'{rnd}{n}', 'ref': ref, 'exag': exag, 'cer': round(cer, 3), 'sim': round(sim, 3), 'live': round(live, 2), 'dur': round(dur, 2), 'heard': heard, 'score': round(score, 3)})
            print(f'{k} take {rnd}{n} ({ref}, {exag}): cer {cer:.2f} sim {sim:.3f} live {live:.1f} {dur:.1f}s {time.time() - t0:.0f}s | {heard}', flush=True)
            if best is None or score > best[0]: best = (score, raw, tried[-1])
        if best[2]['cer'] <= 0.15 and best[2]['sim'] >= args.min_sim: break   # good enough: no second round
    mp3 = os.path.join(args.out, f'{k}.mp3')
    ff('-i', best[1], '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5,adelay=40',
       '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', mp3)
    report[k] = {'spoken': spoken, 'pointed': pointed, 'chosen': best[2], 'takes': tried}
    print(f'== {k}: take {best[2]["take"]} cer {best[2]["cer"]} sim {best[2]["sim"]} -> {mp3}', flush=True)

prev = {}
rp = os.path.join(args.out, 'voice-report.json')
if os.path.exists(rp):
    try: prev = json.load(open(rp))
    except Exception: prev = {}
prev.update(report)
json.dump(prev, open(rp, 'w'), ensure_ascii=False, indent=1)
print('done:', len(report), 'lines')
