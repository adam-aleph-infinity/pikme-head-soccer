# The loading screen and the first-launch tutorial

Idan asked for this on 2026-10-07: a loading screen and a first-launch tutorial "exactly like the clip, but with our game". The clip is **Head Ball 2's** first launch, not Head Soccer's.

## 1. The clip

The file is `uploaded-images/ScreenRecording_10-07-2026 16-43-33_1.mov`: 122 s at 60 fps, with sound. It is a portrait recording of a landscape game, so rotate it with `transpose=2`. All 7284 frames were scanned; every scene change plus 2 frames a second was read (329 frames).

| s | What happens |
|---|---|
| 0–14 | **Loading**: a night stadium under a purple sky, a goal at each edge, two big heads squaring up, the logo between them. "Connecting to the match server…" sits over a fat green pill reading "Loading 75%". iOS permission dialogs (ignored). |
| 17 | The player drops in from the sky onto an empty pitch. No HUD, no buttons. |
| 19–27 | A coach (an old man in a headset, thumb up) appears top-left with a cream bubble: "Move to the marked area". There is a green target on the grass. Only ◀ ▶ are on the pad, with a pulsing ring round ▶. A green ✓ shows when you get there; then the same again to the left. |
| 28 | "Now jump": the jump button arrives, ringed. |
| 32–35 | A ball falls in. "Walk forward and take a high shot", with a green arrow at the ball. → **Gooal** |
| 38–42 | A third button arrives. "Now take a shot from the ground" → **Gooal** |
| 42–45 | The screen goes dark and the coach comes in big: "Let's have a practice match and see how good you are". |
| 46–56 | VS: "Finding An Opponent" while the opponent's face spins like a roulette → "Opponent Found" → "Match is Loading". |
| 57–59 | "Match Starts", then 3-2-1 with a green arrow over you. |
| 59–64 | Everything dims except the power button. A white glove taps it: "Tap the button to use your super powers" → "Use one of the two super powers!" The opponent gets frozen in ice. |
| 64–100 | A ~40 s match. |
| 100–110 | Final Whistle → "You Won 2-0" with +200 coins and +400 fans. A dimmed tooltip on the fans: "Your fans are ready to support you!" |
| 110–122 | New Stadium, then 2 prize cards (Giant Player ×3, Freeze ×3) → Claim → main menu. |

## 2. Ours

Idan's choices:
- **The coach** is a champion: Paz (legendary 5), in a headset, thumb up.
- **The loading screen is the title**: at 100% the bar turns into "לחצו כדי להתחיל".
- **Upgrades** get a guided first buy, which the clip doesn't have.
- **No skip**; the tutorial can be replayed from OPTIONS → הדרכה.

| Clip | Ours |
|---|---|
| Loading key art | HS's night stadium in Saltiz red, gold and black, the Saltiz symbol over סלטיז / ראשים, and the four Mythic starters 2v2, head to head (Idan, 2026-10-08): שובל and אורי on the left in red light, נוה and פז on the right in blue, the front pair (אורי, נוה) face to face across a gold VS. They stand WHOLE, as the artist drew them, on their gold podiums (`public/img/mythic-full/`, cut out by `tools/chars/mythic_full.py`; the sheets themselves are read, never changed): the three-quarter views of the three who face the right way, שובל's front view (his faces the wrong way, and mirrored his 24 would read backwards). The white sticker outline is cut off and the stadium lights them (a rim in the team's light, a shade, a shadow on the grass), so they stand in the scene rather than look pasted on; no goals at the edges (they read as a second pitch). The bar is real: it counts the drawn faces, the anchors, the crowd audio, the font and your card. It holds for at least 2.4 s. A tap made while it loads goes through when it is done. |
| Drills | The same order, plus **the dash** (double-tap ▶): right, left, jump, dash, high shot, ground shot. Buttons arrive one by one, ringed, and POWER is held back for the match. A shot drill hands out a fresh ball when the last one dies; after 3 balls any clean kick passes. |
| Practice talk, VS roulette | Our VS with a face roulette over it, then straight into KICK OFF. Our own YOU bubble stands in for HB2's arrow. |
| Power lesson | At kick-off, play stops with your bar full. The dim has a hole cut round POWER (a clip-path; a box-shadow would not paint over the match canvases), with the ring and the glove. The press arms it and the next touch fires it. |
| (new) Counter lesson | After your power, the coach warns you and the two of you are put on your marks. His power is fired at you and freezes 400 px short of you with KICK ringed; your kick blocks it, and his shot goes back at his goal. A hit, and it is staged again. |
| Match | 45 s against a **sparring partner** (Idan, 2026-10-08): a very weak CPU, 70% of the opponent's speed. It hangs back near its own goal, steps up only for a ball in its half (and not always), now and then clears it, and never dashes, fires its power or kicks you. It decides only every 0.4 s and holds each decision, so no arrow press is ever short enough to read as a dash tap. **Both goals are open**: you score, and it can too (rarely). The only shot kept out is the counter lesson's own staged one. A draw at the whistle is a draw: no sudden death. The opponent is champion 2, or 1 when your card is 2; their straight shots are the only ones a kick blocks (3 and 4 can't be kicked back). |
| Result | Win or lose, it pays **500 points**, the price of a level-1 upgrade. The NEXT button reads לחנות. |
| (new) Shop | The coach points at Speed's Buy; nothing else can be pressed. ✓, then he explains the five stats. |
| Main menu | A ring round ARCADE: "beat the 45 champions". Done; `hs.tutorial.v1 = done`. |

## Narration (2026-10-07)

Every coach line is also spoken in **Idan's own voice**, copied from his recording (`uploaded-images/WhatsApp Audio 2026-10-01 at 10.11.35.opus`). He chose a free model that runs on the Mac.

How the clips are made:
- The model is Resemble AI's **Chatterbox multilingual**, which speaks Hebrew.
- Hebrew comes out well only with the vowels written in, so Dicta's diacritizer adds niqqud first; names and loanwords are fixed by hand (`FIX`).
- Each line is made in several takes, from two stretches of the recording and with a calm and a livelier read.
- The take kept is the one a Hebrew speech recognizer (Whisper) hears back closest to the words, with a voice closest to the recording.
- The model can mumble on quietly after the last word, so each take is cut 0.25 s after the last word Whisper hears.
- Clips are saved to `public/audio/voice/<id>.mp3`. Scores for every take are in `voice-report.json`.
- Chatterbox keeps Resemble's inaudible watermark on everything it makes.

How they play:
- Under the SOUND switch.
- The music drops to a third while the coach talks.
- A new line cuts off the one before it.
- The tutorial waits for a line to finish before it moves on.

Setup, on any Mac (≈ 5 GB of models):
```
brew install uv && uv venv -p 3.11 voice-venv
VIRTUAL_ENV=$PWD/voice-venv uv pip install chatterbox-tts faster-whisper resemblyzer dicta-onnx "setuptools<70"
curl -LO https://github.com/thewh1teagle/dicta-onnx/releases/download/model-files-v1.0/dicta-1.0.onnx
node tools/voice/lines.mjs > lines.json
voice-venv/bin/python tools/voice/make-voice.py --lines lines.json --ref <recording> --dicta dicta-1.0.onnx --out public/audio/voice [--only id,id]
```
After changing a line in `shared/tutorial.js`, run it with `--only` for that line.

## Who gets it

`shared/tutorial.js` `shouldRun`, changed on 2026-10-08 with the Mythic starters (`shared/mythics.js`, `public/starter.js`).

**Everyone does it once, new player or not** (Idan). It uses a new key, `hs.tutorial.v2`; the old `v1`, which marked anyone with progress as done, is no longer read.

- **First launch:** the title tap opens the **starter pick** first. The player picks one of the four Mythics and confirms ("for good"). The choice is saved at once to `hs.mythic.v1`, and the tutorial then plays with that Mythic.
- **Closing the game:**
  - Before confirming: the next launch asks again.
  - After confirming: the next launch goes straight back into the tutorial with the same Mythic. The choice is never offered twice.
- **Ownership:** only the starter is playable. The other three are locked ("🔒 נעול"): there is no way to win them in the game, and buying them comes later. The app's album has no say over Mythics.
- **The 500 points:** paid once, and recorded right away (`paid`), so closing the game and running it again never pays twice.
  - The guided first buy is level-1 speed, which those 500 pay for.
  - A player who already has speed (one who played before) is only shown the shop and keeps the 500. None of their own points are spent.
- **Progress, points and upgrades are never touched.**
- **Links:**
  - A friend's **room link** opened before the first launch shows the title. The starter pick and the whole tutorial come first, then the player goes to the room (Idan).
  - `?tutorial` forces it.
  - `?nointro`, the harnesses' flag, skips the whole first launch. `?notutorial` skips only the tutorial; the starter pick still comes first.
  - The testing links (`?play`, `?arcade`…) skip it.
- **Replays:** OPTIONS → הדרכה replays it without a new pick. A replay pays nothing and never spends points.

## Files and checks

- `shared/tutorial.js`: the rules and the words.
- `public/tutorial.js` and `tutorial.css`: the overlay and the step machine.
- `public/loader.js`: the loading screen.
- `game.js` seams: `TUT.hold / mask / afterStep / event / drawGround / drawOver`.

Checks:
- `node test-tutorial.mjs`: the rules, plus the counter lesson played in the sim against every possible opponent.
- `node _tutorial-shots.mjs`: the first launch in headless Chrome with real keys and a screenshot of every step (`.shots/tutorial`). It covers the starter pick (closed before confirming, then mid-tutorial), the whole tutorial, the locked Mythics, an existing player and a room link. Set `SIZE=667x375` for other screens.
- `node test-mythics.mjs`: the Mythic cards, their power and the starter's save rules.
