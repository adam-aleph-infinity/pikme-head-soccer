# HS-MENUS: how Head Soccer's menus look and work (Phase 1 research)

Branch `hs/menus`, 2026-10-06. Research only. No game code was changed.

**How sure each claim is.** Every claim carries one of these tags:
- **[CLIP]**: seen in Idan's recordings. The frame is saved in `docs/hs-menus/`. This is the main reference.
- **[WEB]**: from a web source, linked inline.
- **UNSURE**: not confirmed. The reason is given, and it is listed again in §7 as a question or a screenshot to take.

What the clips cover: the whole Arcade loop. That is **Player Select → VS intro → KICK OFF → match → Pause → Result → Player Select**, plus a review popup.
What the clips don't show: the title screen, main menu, mode select, shop, settings and loading screens. For those this doc relies on the web (§3.1–3.3, 3.5, 3.6).

---

## 1. Sources

### Idan's clips (main reference)
| Clip | Menu content | Frames saved |
|---|---|---|
| `hs-video/M4-gaps.mp4` (2556×1180, iPhone) | Player Select scrolled through about 13 opponents (0–14 s); VS (14 s); Result WIN → NEXT MATCH → Player Select → PLAY → VS (90–95 s); Result LOSE (184 s) | `ps-arcade-hires.jpg`, `ps-tooltip.jpg`, `ps-locked-opponent.jpg`, `result-win-hires.jpg`, `result-win-anim.jpg`, `result-lose.jpg` |
| `hs-video/M2-arcade-kor-uk.mp4` | Player Select → PLAY → VS → KICK OFF (9.5–13 s) | `vs-intro.jpg` |
| `hs-video/M12-base-stats.mp4` | Same flow, on grass | `kickoff.jpg` |
| `hs-video/M6-headers.mp4`, `M13-base-kicks.mp4` | Pause menu at the start | `pause.jpg` |
| `hs-video/M1-arcade-kor-kor.mp4`, `M9`, `M10`, `M11`, `M13` (last 3 s) | Result WIN screen | `result-win.jpg` |
| `hs-video/M10-russia-3star.mp4` (0–1 s) | "Review / Later" popup over Player Select | `review-popup.jpg` |
| `uploaded-images/Screenshot 2026-09-26 at 15.16.06.png` | In-match button bar (L/R, POWER/KICK/JUMP) | n/a |
| `uploaded-images/*.ogg` | `Start.ogg`, `Pause2.ogg`, `Win2.ogg`, `Lose.ogg`, `End sound.ogg` are the menu-related sounds | n/a |
| **M15** `uploaded-images/WhatsApp Video 2026-10-06 at 18.34.12.mp4` (147 s, **no sound**), captured for Phase 2 | Main menu + carousel, Multiplayer popup + Connecting, Player Select (UNLOCK, tooltips), Tournament select + bracket, OPTION, gift, shop UPGRADE/COSTUME, Pause, How To, Pause → TITLE | `m15-*.jpg` (16 frames) |
| **M16** `uploaded-images/WhatsApp Video 2026-10-06 at 23.13.28.mp4` (123 s, **with sound**), captures A, G, H, K | Cold launch (splash → title → menu), Player Select → VS, a match, pause → GIVE UP, a full loss to NEXT | `m16-*.jpg` (9 frames) |

### Web
**Which version to trust.** Idan's clips show the **current game (v7.x, 2026)**. Most web screenshots are from **v6, 2017**. Where they disagree, the clip wins.

- **Head Soccer Fandom wiki** (https://headsoccer.fandom.com/wiki/…).
  - Pages used: Arcade, Game_Modes, Points, Stats, Stars, Survival, League, Head_Cup, Death, Fight, Awaken, Multiplayer, Costumes, Pet_Shop, Body_Shop, Headballs, Unlock_Requirements, Ads_Watching_System, Languages, Tutorial, Beginners_Guide, Unused/Scrapped_Contents, Glitches, Head_Soccer_Sounds.
  - WebFetch was blocked (402), so the pages were read through the wiki API.
  - Below, `W:Page` means `https://headsoccer.fandom.com/wiki/Page`.
- **App Store:** https://apps.apple.com/us/app/head-soccer/id487119327. The version history includes:
  - 7.0 "Renewal Character Select" (2025-10-27);
  - 7.1.6 "Renewal Multiplayer" (2026-09-30);
  - 7.1.7 "multiplayer select costume & pet / Emoji" (2026-10-06).
- **Google Play:** https://play.google.com/store/apps/details?id=com.dnddream.headsoccer.android
- **YouTube v7.0:** https://www.youtube.com/watch?v=SmylmZ1-Q_0. Its storyboard frames show the title, the menu and a result.
- **Reddit and TouchArcade** blocked fetches (403). Nothing here comes from them.

**Saved web references** in `docs/hs-menus/web/`:

| File | Shows |
|---|---|
| `menu-carousel-2017.jpg` | main menu (mode carousel) + League popup |
| `menu-grid-2017.jpg` | main menu as a 3×3 grid |
| `title-bg.jpg`, `title-character.jpg` | title art layers |
| `options-language.jpg` | Options popup (language, iCloud) |
| `ps-arcade-old.jpg` | pre-7.0 Arcade Player Select |
| `select-carousel-other-modes.jpg` | character carousel used by the other modes |
| `shop-upgrade.jpg`, `shop-pet.jpg` | shop tabs |
| `unlock-modal.jpg` | "Asura Unlock" modal |
| `headball-pick.jpg` | Headball reward pick |
| `tournament-bracket.jpg` | bracket |
| `result-survival.jpg` | Survival result |
| `help-1.jpg` | "How to" page 1 |
| `vs-screen-appstore.jpg` | App Store VS screen |
| `sprites-ui.jpg`, `sprites-ui02.jpg` | the game's UI sprite sheets: every button, header and pressed state |


## 1b. What M15 settled (2026-10-06)

M15 is a capture Idan took for Phase 2. **Where M15 disagrees with the 2017 web material in §3, M15 wins.**

### Main menu (`m15-main-menu.jpg`)
- Logo at the top-left, with a NEWS tab hanging from the top.
- **Top-right icons:** a promo, a gift box, ⚙ OPTION, and a 4-square icon.
- **Right side:** the FREE POINT TV on a robot arm, with a "3000P" sign.
- **Left:** a green ⬆ button.
- **Bottom: a looping carousel.**
  - Order: ARCADE → TOURNAMENT → SURVIVAL → LEAGUE → HEAD CUP → DEATH → FIGHT → AWAKEN (NEW) → MULTIPLAYER (N) → MORE GAMES → ARCADE.
  - Yellow ‹ › sit at the edges.
  - The centred pill is bigger and bright; its neighbours are dim and grey.
  - The mode's mascot pops up above the centred pill.

### Main menu → Player Select (`m15-main-to-select.jpg`)
1. The pill turns dark (pressed).
2. Hard cut.
3. The panel appears first, with the heads flashing white.
4. The title drops in from the top and the bottom bar rises from the bottom, in about 0.25 s.

**BACK** from Player Select goes to the main menu with a hard cut.

### Player Select
- **Your own locked character** (`m15-ps-unlock.jpg`): the honeycomb cage, plus a big gold **UNLOCK** plate over it.
- **Stat bars:** empty at level 0 on a fresh install. They show **your upgrade levels**.
- **Another tooltip:** "Win by more than 10 goals".

### Tournament
- **Select** (`m15-tournament-select.jpg`): the same frame, but a **horizontal** reel of 3 hexagons with the centre one bigger. The HERO pill sits on top, the flag under the centre, and the bottom bar is SHOP / stats / **NEXT**.
- **Bracket** (`m15-tournament-bracket.jpg`): flags with a YOU tag, and "KICK OFF !!".

### OPTION (`m15-option.jpg`)
- **Same design as Pause:** a giant ball with "OPTION" over the dimmed menu.
- **Pills:** Language at the top; SOUND, MUSIC and How to on the left; STATS, Facebook and BACK on the right; iCloud at the bottom.

### Gift (`m15-gift.jpg`)
Three loot chests for points: 19,000 / 140,000 / 250,000.

### Shop
- **Layout:** BACK, then the folder tabs UPGRADE / COSTUME / PET / BODY. The active tab is green with yellow text.
- **UPGRADE** (`m15-shop-upgrade.jpg`): rows with "500 POINT" and 10 dots each, and a gold **Buy** button. MY POINT is at the bottom-left; Get More Point at the bottom-right.
- **COSTUME** (`m15-shop-costume.jpg`): 3 cards per page with ‹ ›. Each card shows a padlock-and-chain ball, an F RANK badge, stats shown as "?", and **Unlock**.

### Multiplayer (`m15-mp-popup.jpg`, `m15-mp-connecting.jpg`)
- **The popup:**
  - It sits over the dimmed menu.
  - A two-tone panel, green and purple, with a "SERVER REGION ‹ Auto ›" tab.
  - "NAME · MAX 10 · AUTO SAVE" with an input.
  - **QUICK PLAY** and **FRIENDLY** buttons.
  - A red ✕ in the corner.
- **"Connecting..":** a yellow hex-pattern panel with two phones and a dashed line between them.

### Pause → TITLE
TITLE goes to the **main menu**. There is no separate title screen in that path.

### How To (`m15-howto-dash.jpg`, `m15-howto-credits.jpg`)
- **8 card pages** that swipe sideways. The next page peeks in from the side.
- **Each page:** a number and name tag (on a flame) at the bottom-left, and ‹ › at the bottom corners.
- **BACK** at the top-left.
- **Pages seen:** 4 Dash (double tap), 5 Sudden Death, 8 Credits.

### Still open
- **A:** the title screen on a cold launch.
- **G:** what GIVE UP does next.
- **H:** a full LOSE result, then NEXT.
- **K:** any sound. M15 is silent.


## 1c. What M16 settled (2026-10-06): the last four open items

- **A · Cold launch:**
  1. The app opens on black, and the **D&D Dream logo** fades in and out (about 1.3 s, `m16-splash.jpg`).
  2. The title's stadium art fades in. About 2 s later the **HEAD SOCCER logo drops in from the top**, with its ball and a loud hit (`m16-title-drop.jpg`).
  3. **"TOUCH TO KICK OFF !" blinks** on and off about once a second (`m16-title-touch.jpg`).
  4. A tap **shrinks the logo into the top-left corner** while the menu art slides in, about 0.7 s (`m16-title-to-menu.jpg`).
- **VS:** after a moment the VS shows **"TOUCH TO KICK OFF"** under it, and lasts **about 2 s** with no tap (`m16-vs-touch-to-kickoff.jpg`). M2's 1.25 s was a tapped one.
- **G · GIVE UP:**
  - **No confirm and no result screen.** The pause's pills **slide back out to the sides**, about 0.25 s (`m16-pause-slide-out.jpg`), then it cuts straight to **Player Select**.
  - The pause also **opens** with its pills sliding in from the sides (`m16-pause-slide-in.jpg`).
- **H · A loss to NEXT:**
  1. The RESULT panel slides in from the right.
  2. **LOSE is spelled in red.**
  3. Then **your head chars black**, with frizzled hair and a **"?!" bubble** (`m16-result-lose-charred.jpg`).
  - REWARD 0, FREE POINT at the bottom-left, **NEXT at the bottom-right**.
- **K · Sound:**
  - Silence through the splash, then the **logo's hit**.
  - **Music, nonstop, under the title, the menu and Player Select.**
  - **A short sound on every button press.**
  - The VS is quieter; the match has its own music and crowd.

**Built from it:**
- Menu music (original, synthesised) on every menu screen, plus a tap, a tick and a swish. It starts at the first tap, because a browser allows no sound before one.
- The title's blink and the logo drop.
- The VS at about 2 s, with its hint; a tap skips it.
- The pause sliding in and out.
- GIVE UP records the loss and returns to Player Select.
- The loss's "?!" bubble, and NEXT at the bottom-right.

---

## 2. HS's look: a style guide for all the menus [CLIP]

- **Orientation:** always landscape. Menus fill the screen edge to edge; there is no letterbox inside the game.
- **Big titles** ("PLAYER SELECT", "RESULT", "PAUSE", "KICK OFF", "GOAL!", "VS"):
  - heavy italic display font;
  - a yellow → orange vertical gradient;
  - a thick dark-brown outline and a small drop shadow.
  - It's the same lettering as KICK OFF / GOAL in the match.
- **Buttons:**
  - **Gold pill:** a rounded capsule with a yellow-gold gradient and a darker gold rim. It has a faint ball watermark, and the text is black/dark-brown bold italic (SHOP, PLAY, NEXT MATCH, NEXT).
  - **Pressed:** goes dark brown with gold text (PLAY in `vs` sheet; RESUME in `pause.jpg`).
  - **Pause-menu variant:** smaller gold pills with brown text. On the left column a grey round icon sits at the pill's left end.
- **Panels:**
  - a **green striped-pitch panel**: vertical light/dark grass stripes, a faint centre circle and line, and a 4–6 px white rounded border;
  - used for Player Select and Result alike;
  - the panel sits over a backdrop that changes by screen.
- **Backdrops:**
  - Player Select: royal blue with big faint football-panel shapes.
  - Result and Pause: the match stadium, dimmed about 50%.
- **Small labels:**
  - white bold sans in dark translucent "pill" bars (REWARD POINT / TOTAL POINT; "YOU");
  - "POINT" is set smaller and in yellow-green.
- **Tags:**
  - "PLAYER" is a navy tag; "COM" is a dark-red tag. Both use white or yellow caps.
  - "HERO" sits in a blue pill on the player's side and an orange pill on the CPU's side, each with a person icon.
- **Numbers:** score digits are chunky yellow-orange with a dark outline (Result). The points value is plain yellow.
- **Flags** are flat rectangles with a thin white border, always next to the head.
- **Heads:** big, no body. Player Select puts them in **gold octagon frames**; Result shows them with no frame and battle damage (bruises, a black eye, blood).
- **Stars:** 1–5 small yellow stars under the CPU's flag (= CPU skill; see `docs/HS-STATS.md`).
- **Stat bars:** 10 small green segments per stat, labels in white italic caps.
- **Tooltip:** a dark rounded box with a neon-green border, white text, and a small yellow triangle pointing at the icon.
- **Popup** (review): dark translucent rounded box, white text, two gold pills.

---

## 3. Screens

### 3.1 Splash / title screen
**[WEB]**. None of the clips shows this screen, so its *current* look is UNSURE.

- **Art:**
  - A tilted cartoon stadium: crowd, a keeper, a "D&D DREAM" board (`web/title-bg.jpg`).
  - In front, South Korea heads a ball under light rays (`web/title-character.jpg`).
- **Logo:**
  - "HEAD" in flame letters (yellow → red, black outline), with "SOCCER" in silver below (`web/sprites-ui02.jpg`).
  - In v7 the logo is big and centred, with a ball over it ([YT](https://www.youtube.com/watch?v=SmylmZ1-Q_0)).
- **Text:** "**TOUCH TO KICK OFF !**" under the logo. The footer reads "(C) COPYRIGHT ALL RIGHTS RESERVED D&D DREAM CORP."
- **Behavior:**
  - Tapping anywhere goes to the main menu, where the logo sits at the top-left. UNSURE whether it animates or cuts.
  - Pause → **TITLE** also comes here [CLIP shows the button].
- **Music:** Title.ogg / Title5.ogg (W:Head_Soccer_Sounds/Background_Music).
- **UNSURE:** whether a D&D Dream splash or loading screen comes first. No source shows one.

### 3.2 Main menu

> **Ours is no longer HS's carousel (2026-10-08).** The home screen is our own: the
> player's character (the match body and head, `game.js` `paintStanding`) on a podium under a
> spotlight on a dark stage. Top-left: the profile card (tap: name + stats) and trophies; along the
> top: the wallet (money, נקודות סולטיז); top-right: settings. Left: דמויות (the card picker) over
> חנות (the upgrades shop), BATTLE PASS bottom-left. Right: חברים over LEADERBOARD, and **שחק**
> bottom-right, which opens a separate **game modes** screen (`#modes`: every mode in `MODES`,
> as cards). Player Select's and the bracket's BACK go to that screen. Money, trophies, the battle
> pass, friends and the leaderboard are placeholders (0 / "בקרוב") until they exist. What follows
> is the HS research the old menu was built from.
**[WEB]**, `web/menu-carousel-2017.jpg`, `web/menu-grid-2017.jpg`. The v7.0 video still shows the carousel. None of the clips shows this screen.

```
┌───────────────────────────────────────────────────────────┐
│ HEAD                                   [🏀promo][🎁][⚙OPTION]│
│ SOCCER        (big character art, dimmed stadium)   [4500P] │
│                                                [FREE POINT📺]│
│ (⬆)                                                         │
│ ‹  TOURNAMENT  SURVIVAL [ LEAGUE ] HEAD CUP  DEATH  ›       │  centred pill enlarged
└───────────────────────────────────────────────────────────┘
```

- **Background:** the title art, zoomed and darkened. The logo sits at the top-left.
- **Top-right icons:**
  - a cross-promo game icon;
  - a red **gift box** (UNSURE: probably a daily gift);
  - a grey **gear "OPTION"** → the Options popup (§3.6).
- **Right edge:** a **FREE POINT** TV on a robot arm, with a sign such as "4500P". Watching an ad gives points. The wiki pages disagree on the timing: every 45 min for 100–5,000 (W:Ads_Watching_System) or every 60 min for 1,000–7,500 (W:Points).
- **Bottom: the mode carousel.**
  - A row of thick pill buttons with white rounded lettering, a dark outline, a coloured fill and a silver bevel.
  - The centred one is bigger; the neighbours are dimmed.
  - Yellow chevrons ‹ › sit at both ends, and each mode's character art stands above its pill.
- **Left:** a green round ⬆ button. In August 2017 a red ⬇ button opened a **3×3 grid** instead:
  - ARCADE (red), TOURNAMENT (cyan), SURVIVAL (yellow)
  - LEAGUE (green), HEAD CUP (purple), DEATH (brown)
  - FIGHT (blue), MULTIPLAYER (orange), MORE GAMES (rainbow)
  - UNSURE: it probably toggles between the grid and the carousel.
- **Tapping a mode:**
  - Most modes go straight to their select screen.
  - **LEAGUE** opens a popup on the menu instead: a green pitch panel with a white border holding the gold pills **1. Amateur ⚽ / 2. Minor 🏅 / 3. Major 🏆 / Back**.
- **UNSURE:**
  - The current order of the modes, and whether MORE GAMES is still there.
  - What the Android back button does here (probably a quit dialog).

### 3.3 Mode select
**[WEB]**. Switch modes only from the main menu. Each mode has its own select screen, then its own hub (bracket, table, map…).

**Rules for every mode:**
- A match is **60 s**. A draw goes to **SUDDEN DEATH**, and in sudden death the gauges stop charging (W:Beginners_Guide).
- There is **no training mode**. The tutorial is the 7-page "How to" help (W:Tutorial).

| Mode | What it is | Entry | Reward | Screens |
|---|---|---|---|---|
| **Arcade** | Pick your character and the opponent. Each win unlocks the next opponent for that character only. 11 achievements per opponent. | free | 100 for the first opponent, +50 for each later one (W:Arcade). [CLIP] KOR v KOR win = 100. | Player Select (§3.4) |
| **Tournament** | 8 random characters, 3 knockout rounds | free | 100 / 700 / 1,700, then pick 1 of 3 Headballs | carousel select → bracket (`web/tournament-bracket.jpg`) |
| **Survival** | Endless stages; your "balls" are your lives. Every 10th stage is a RANK MATCH, ranks F→SS. | free | 30N+20 per stage | carousel select → VS with "STAGE n" → `web/result-survival.jpg` |
| **League** | Amateur / Minor / Major: 10 characters, 18 matches + a final | beat 33 in Arcade, or 100k / 200k / 300k | 20k / 30k / 40k | menu popup → select → standings |
| **Head Cup** | 32 characters, 8 groups, then knockout + 3rd place | 5,000 or an ad | 30k / 20k / 15k / 10k | groups table → podium |
| **Death** | 30 stages with henchmen + a boss, obstacles, continues | 5,000 | 100k + PumpKill | "CONTINUE?" screen |
| **Fight** | On a ship with life bars: a world map, 8 opponents, bonus games, 4 bosses | 5,000 | 50k + pet + Headball | map, "K.O PERFECT" |
| **Awaken** (v7.0, Oct 2025) | Board game against a robot; the final is against your awakened self | ? | ? | board, blue RESULT |
| **Multiplayer** | iOS: Game Center / Bluetooth. Android: Google Play. "Renewal Multiplayer" came in 7.1.6 (2026-09-30). | free | win 200 / lose 10 | UNSURE: renewed in 7.1.6, not seen |

Sources: W:Game_Modes, W:Arcade, W:Tournament, W:Survival, W:League, W:Head_Cup, W:Death, W:Fight, W:Awaken, W:Multiplayer, W:Points.

**History:**
- v1.0 (2012) had 12 characters and Arcade, Tournament and Multiplayer.
- Later versions added League (2.0), Head Cup (3.0), Death (5.0), Fight (6.0) and Awaken (7.0).
- Today there are **103 characters** (AS).

**UNSURE:** whether HS has a 2-players-on-one-device mode. None is documented; the local option is Bluetooth on iOS.

### 3.4 Player Select (Arcade) [CLIP]: `ps-arcade-hires.jpg`, `ps-tooltip.jpg`, `ps-locked-opponent.jpg`, `review-popup.jpg`

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│ ←BACK             P L A Y E R   S E L E C T                  │  blue backdrop
│ ┌──────────────────────── MATCH 28 ────────────────────────┐ │
│ │ (prev head)   [👤HERO]   0 : 0   [HERO👤]   (prev head)  │ │
│ │ ╔══════╗                                       ╔══════╗  │ │  green pitch panel
│ │ ║ YOU  ║   PLAYER        VS        COM         ║ CPU  ║  │ │
│ │ ║ head ║   [flag]  ⚡ VS ⚡   [flag]  ★★★★★    ║(cage)║  │ │
│ │ ╚══════╝                                       ╚══════╝  │ │
│ │ (next head)   ○ ○ ○ ○ ○ ○ ○ ○ ○ ◎ ○   (11 icons)  (next) │ │
│ └──────────────────────────────────────────────────────────┘ │
│ [   SHOP   ]  SPEED ▮▮▯…  DASH ▮▮▯…            [   PLAY   ]   │
│               KICK  ▮▮▯…  POWER ▮▮▯…                         │
│               JUMP  ▮▮▯…  SURVIVAL ▮▯…                       │
└──────────────────────────────────────────────────────────────┘
```

- **Top:**
  - "PLAYER SELECT" title, centred, about 12% of the screen height.
  - **BACK** at the top-left: a white left arrow with "BACK" in small yellow-white caps under it.
- **Panel:** about 80% of the width and 70% of the height.
  - **MATCH n** hangs from the top border as a white tab with gold trim. It is the arcade match counter (28 → 29 after a match).
  - Under the tab:
    - A **score pill** "0 : 0".
    - **Blue HERO** pill (player side) and **orange HERO** pill (CPU side).
- **Left: your character, a vertical carousel.**
  - The selected head sits in a big gold octagon. The neighbours above and below peek in, cut off by the panel edge.
  - A round **power-type badge** (a blue energy orb for Korea) sits at the frame's top-left.
- **Right: the CPU opponent, also a vertical carousel.** Same frame, mirrored, badge at the top-right.
  - **[CLIP] You pick the opponent yourself:** M4 0–14 s scrolls UK → NED → TUR → pirate → "?" → NZL → IRL → CAN → UK → ITA → USA → KOR, then plays KOR.
  - **Locked opponents** have a grey **hexagonal chain-link cage** drawn over the head.
  - [WEB W:Arcade] "Each win unlocks the next opponent, for that character only", so a cage means *not yet unlocked for this character*.
  - The gold octagon frames are the **7.0 "Renewal Character Select"** (Oct 2025). Before that the frames were round, with green ▲/▼ chevrons and a split **UPGRADE | COSTUME** button where SHOP is now (`web/ps-arcade-old.jpg`).
- **Centre:**
  - "PLAYER" tag + your flag;
  - a glowing yellow **VS** with lightning lines;
  - "COM" tag + the opponent's flag;
  - **1–5 stars** under the CPU flag. Locked ones show 5★; USA showed 2★.
- **Bottom of the panel: a row of 11 round mission icons.** [WEB W:Arcade] These are the **11 achievements per opponent**.
  - They are dim, with the current one in a green ring.
  - When a locked opponent is selected, a **tooltip** shows its condition. Seen:
    - "Win without using a jump";
    - "Win without using a kick";
    - "Win with pet.(only live)".
- **Bottom bar, outside the panel:**
  - **SHOP** gold pill on the left;
  - a **6-stat block** in the middle: SPEED / KICK / JUMP and DASH / POWER / SURVIVAL, each with 10 green segments;
  - **PLAY** gold pill on the right.

**Behavior and navigation:**
- **Scrolling:** a vertical swipe on either carousel moves it. The opponent changes about every 1 s in M4.
- **Score pill:** shows your **last result against that opponent**. Locked ones read 0 : 0. KOR read 7 : 1 before the M4 match and **3 : 0 after it**, and 3–0 was the score just played.
- **PLAY:** the button darkens (pressed), then about 0.25 s later the VS intro starts (§3.7). There is no separate loading screen.
- **BACK:** UNSURE where it goes (probably Mode select or the Main menu). Never tapped in the clips.
- **SHOP:** opens the shop (§3.5). Never tapped in the clips.
- **Review popup [CLIP M10]:**
  - It appears over Player Select at the start of the session (match 71) and dims the screen behind it.
  - Text: 'Thank you for playing "Head Soccer". Your 5 star review brings along free updates. :)'
  - Buttons: **Review** and **Later**.

**UNSURE:**
- **HERO.** The wiki says only that "Hero buttons jump to a character" (W:Arcade). Jump to which one (your best? the next unbeaten?) is unknown. Both sides read HERO in every clip.
- **Score pill.** The wiki calls it a "win:loss tally". The clip contradicts that: KOR went 7 : 1 → **3 : 0** after a 3-0 win, where a tally would read 8 : 1. I trust the clip; one more clip settles it (§7 E).
- **Achievements.** What a completed one looks like, and whether completing all 11 gives anything.
- Whose stats the bars show. Everything is 2 bars at match 28, about 3 at match 71, and SURVIVAL is always the lowest. They may be the selected player's stats including upgrades.
- How you swipe the carousels exactly (drag vs flick, any snap), and whether arrows exist.
- Whether **2P / Online** use this same screen.

### 3.5 Shop / upgrades
**[WEB]**. The clips only show the **SHOP** button, so the *current* v7 shop is UNSURE. Before 7.0, Player Select had a split **UPGRADE | COSTUME** button instead (`web/ps-arcade-old.jpg`).

**Layout** (`web/shop-upgrade.jpg`, older 2-tab version):

```
┌──────────────────────────────────────────────┐
│←BACK [ UPGRADE ][ COSTUME ][ PET ][ BODY ]     │  folder tabs: active green + yellow title, inactive blue
│ ┌──────────────────────┬───────────────────┐ │
│ │ SPEED         POINT  │ DASH        POINT │ │  green pitch panel
│ │ ●●●●●●●●●● [Buy]     │ ●●●●●●●●●● [Buy]  │ │
│ │ KICK / JUMP …        │ POWER / SURVIVAL …│ │
│ └──────────────────────┴───────────────────┘ │
│ [MY POINT 1.643.230]          [Get More Point]│
└──────────────────────────────────────────────┘
```

- **Currency:** **Points only** (a "P" coin). There are no gems. Points come from matches, FREE POINT ads, and in-app purchases ("Get More Point") (W:Points).
- **UPGRADE tab:**
  - **6 stats**: SPEED, KICK, JUMP, DASH, POWER, SURVIVAL. Each has 10 levels shown as blue dots, a "POINT" price, and a gold **Buy** button.
  - The cost is **500 for level 1 and doubles each level, up to 256,000 for level 10** (W:Stats).
  - This is the **same curve as our `shared/upgrades.js`** (500×2^(L−1)).
  - UNSURE: whether upgrades are per character or global.
- **COSTUME tab:**
  - 96 costumes in 8 ranks (F, E, D, C, B, A, S, SS). You unlock them through Survival rank matches or Headballs, then buy them.
  - Prices run from 8k up to 2.4M.
  - They add +1 to +4 to stats, and many hurt the opponent.
  - Buttons: Buy / Equip / Unequip (W:Costumes).
- **PET tab:**
  - 16 pets, 20k to 4M, evolving at Lv 20 and Lv 60.
  - Each card shows LV / TYPE / HP / EXP, with ‹ › to browse and Equip / Unequip (`web/shop-pet.jpg`, W:Pet_Shop).
- **BODY tab:** 15 bodies, 10k to 1.3M, +1/+2 to stats (W:Body_Shop).
- **Unlocking characters:**
  - Tapping a locked character opens a modal, "<Name> Unlock" with OK (`web/unlock-modal.jpg`).
  - Ways to unlock: meet the requirement, pay points (100k → about 7.7M), watch ads, or pay real money (W:Unlock_Requirements).
  - The unlock celebration shows bands in the flag's colours, the head, a star, an open padlock and speed lines.
- **HEADBALL:** after you clear a mode, you pick 1 of 3 capsules and get points, a costume, a body or a character (`web/headball-pick.jpg`).
- **Sounds:** buy, equip, fail, point (W:Head_Soccer_Sounds).

### 3.6 Settings / options
Settings live in two places.

- **Pause menu [CLIP]:** **SOUND** and **MUSIC** toggles, plus **How to** (§3.8).
- **Main menu ⚙ OPTION [WEB]** (`web/options-language.jpg`): a popup over the menu with:
  - a "**Language**" header;
  - **12 flag buttons** (EN, KO, DE, FR, NL, ZH, JA, IT, ES, PL, TR, ID) with a ✓ on the active one;
  - **OK**;
  - below that, **iCloud** (Save / Load). On Android 6.15.2+ this is "Save Data (Server)", with an email login and then Save / Load.

The UI art stays mostly in English whatever the language (W:Languages).

The sprite sheets also contain buttons whose place in the menus is UNSURE: **STATS** (a record screen with SINGLE / MULTIPLAY / VICTORY / Total Goals / Play TIME / Most Goals), **INFO**, and **Facebook**.

No vibration, control-layout or button-size options are documented.

### 3.7 Loading → VS intro → KICK OFF [CLIP]: `vs-intro.jpg`, `kickoff.jpg`

Timeline from M2 (sampled at 4 fps) and M4:

| t (s) | What happens |
|---|---|
| 0 | PLAY pressed; it turns dark. |
| +0.25 | **Hard cut** to the match stadium, with no HUD and no players. A **red horizontal band with speed streaks** sweeps across the middle third of the screen. |
| +0.5 | The two heads slide in from the left and right edges along the band, facing each other. A small "vs" sits between them. |
| +0.75 | A big **gold VS** slams in, with yellow lightning crackling out to both heads. |
| +1.0 | The VS fades and the heads leave. |
| +1.25 | The band is gone. The HUD and the players appear. |
| +1.5 | **KICK OFF** letters fly in with motion blur from both sides, plus a purple "YOU" marker over your player. |
| +2.0 → +3.25 | "KICK OFF" holds. A **ball drops** from above, onto and through the lettering, then the match starts. |

- **Result → Player Select [CLIP M4 92 s]:** a quick fade through the dimmed, empty stadium (the D&D Dream balloon is visible), about 0.5 s.
- **On first launch:** a D&D Dream splash and loading screen, if any (§3.1).

### 3.8 Pause [CLIP]: `pause.jpg`

- **The pause button:** a yellow round "II" at the far **top-right** of the HUD.
- **When paused:**
  - The match freezes and is **dimmed about 50%**. The HUD stays visible, the power bars turn grey, and the on-screen pad dims.
  - A **giant football** sits in the centre, about 45% of the screen height, with "**PAUSE**" in the yellow italic title lettering across it.
- **Left column** (3 gold pills, each with a round grey icon at its left end):
  - **SOUND**: the speaker icon wears a red ⊘ when it's off, as in the clip. It toggles the sound effects.
  - **MUSIC**: a note icon, also with a red ⊘ when off. It toggles the music.
  - **How to**: the how-to-play help.
- **Right column** (3 gold pills):
  - **RESUME**: shown dark/pressed in the clip.
  - **GIVE UP**: forfeits the match → Result (LOSE). UNSURE.
  - **TITLE**: goes to the title screen / main menu. UNSURE which one.
- The pause sound is probably `uploaded-images/Pause2.ogg`.
- **UNSURE:** whether a "Give up" asks "are you sure?", and what the How to screen looks like.

### 3.9 Result [CLIP]: `result-win.jpg`, `result-win-hires.jpg`, `result-win-anim.jpg`, `result-lose.jpg`

**Layout:**
- **RESULT** title, top centre, very large: about 20% of the screen height. It overlaps the panel's top border.
- The green pitch panel, about 80% × 65%.
  - "YOU" sits in a small dark pill at the top centre. Under it, **WIN** (blue → white gradient, white outline) or **LOSE**, revealed **one letter at a time** (W… WI… WIN).
  - Your head is on the left and the CPU's head on the right. They are big, about 25% of the screen height each, with no frame, and show bruises and damage.
  - The flags sit beside the VS, with **chunky gold scores** under them.
  - **Bottom strip:** "REWARD **POINT** 100" on the left and "TOTAL **POINT** 12,450" on the right.
- **Below the panel:**
  - **NEXT MATCH** (when you win) or **NEXT** (when you lose): a gold pill, centred for a win and bottom-right for a loss.
  - When you win, a **FREE POINT** button sits bottom-left: a little cyan TV icon, which presumably plays an ad for points.

**Behavior:**
- About 0.5 s after the clock hits 0:00, the dimmed stadium appears and the panel comes up.
- Then "YOU" appears, and WIN or LOSE is spelled out.
- When WIN completes, the **loser's head turns black (charred)** (`result-win-anim.jpg`, M4 91.6–92.3 s).
- **Points:**
  - An arcade win paid **100**; a loss paid **0**.
  - TOTAL rose 11,250 → 12,450 across the clips. (Our 100×stage formula is our own invention.)
- **Buttons:**
  - NEXT MATCH → the same character's Player Select with MATCH +1, about 1 s total [CLIP M4].
  - NEXT after a loss → UNSURE, probably the same.
- Sounds: probably `Win2.ogg` / `Lose.ogg` / `End sound.ogg`.

**UNSURE:**
- The LOSE lettering colour and how it animates. The clip cut at "YOU".
- Whether a draw exists in Arcade, or whether a tie goes to sudden death.
- Whether REWARD changes with the stars or the mode.
- Whether FREE POINT also shows after a loss. It wasn't visible in `result-lose.jpg`.

---

## 4. Navigation map

### HS
```
[D&D splash?] ─▶ TITLE "TOUCH TO KICK OFF !" ─tap─▶ MAIN MENU
MAIN MENU ─⚙ OPTION─▶ [Options popup: language · iCloud/server save] ─OK─▶ MAIN MENU
MAIN MENU ─FREE POINT 📺─▶ ad ─▶ +points            MAIN MENU ─🎁─▶ gift (UNSURE)
MAIN MENU ─mode pill─▶
   ARCADE ───────────────▶ PLAYER SELECT (you ⇅ · COM ⇅)                     [CLIP]
   LEAGUE ─▶ [popup Amateur/Minor/Major/Back] ─▶ select ─▶ standings
   TOURNAMENT / SURVIVAL / HEAD CUP / DEATH / FIGHT / AWAKEN ─▶ (entry fee or ad)
        ─▶ character carousel ─NEXT─▶ mode hub (bracket · groups · map · board)
   MULTIPLAYER ─▶ Game Center / Bluetooth / Google Play
PLAYER SELECT ─BACK─▶ MAIN MENU (UNSURE)
PLAYER SELECT ─SHOP─▶ SHOP [UPGRADE|COSTUME|PET|BODY] ─BACK─▶ PLAYER SELECT
PLAYER SELECT ─PLAY─▶ VS intro (~1.25 s) ─▶ KICK OFF (~2 s) ─▶ MATCH            [CLIP]
MATCH ─II─▶ PAUSE: RESUME→MATCH · GIVE UP→loss · TITLE→TITLE · SOUND/MUSIC · How to→Help   [CLIP]
MATCH ─0:00 (draw → SUDDEN DEATH)─▶ RESULT ─NEXT MATCH / NEXT─▶ PLAYER SELECT (MATCH +1)    [CLIP]
RESULT ─FREE POINT 📺─▶ ad ─▶ +points
mode cleared ─▶ HEADBALL pick 1 of 3 / VICTORY
```

### Ours today
```
boot → #pick (card grid, 180 cards) ──שחק──▶ #modeSel
#modeSel ──‹חזרה──▶ #pick
#modeSel ──רב משתתפים──▶ (reveals row) ──צור קישור / הצטרף לקוד──▶ #lobby ──both ready──▶ MATCH(online, no VS intro)
#modeSel ──שחקן יחיד──▶ #arcade ──שחק──▶ VS intro ▶ KICK OFF ▶ MATCH
#arcade ──שדרוג──▶ [#upg shop modal] ──✕/Esc──▶ #arcade
#arcade ──אימון חופשי──▶ VS ▶ MATCH(free) ; #arcade ──‹חזרה/Esc──▶ #modeSel
MATCH ──II/Esc──▶ [#pause]: המשך · מההתחלה · יציאה(→#arcade or #pick) · 🔊
MATCH ──full time──▶ [#over]: השלב הבא / נסה שוב → MATCH · שלבים → #arcade
```

---

## 5. Our menus vs HS, screen by screen

Our code:
- `public/index.html`, `public/game.js` (G), `public/style.css` (S).
- 5 screens: `SCREENS = ['pick','modeSel','arcade','lobby','match']`, with `show(id)` at G:206.
- The UI is in Hebrew and RTL. Menus aren't forced to landscape.
- There are two visual themes: the old dark navy (pick, lobby) and the red/gold "Saltiz" theme (modeSel, arcade, shop).

**The look overall:**
- **HS:** blue backdrop, green striped-pitch panels with white borders, gold pills, heavy yellow-orange outlined italic titles, English labels.
- **Ours:** two themes. Dark navy for pick and lobby; Saltiz black with a red/gold honeycomb, spinning rays and Rubik font for modeSel, arcade and the shop. Labels are in Hebrew.
- HS's in-match lettering (KICK OFF / GOAL / RESULT) is already close.

| HS screen | HS | Ours today | What's different or missing |
|---|---|---|---|
| Splash / title | Title art + logo + "TOUCH TO KICK OFF !" | **none**: boot lands on `#pick` (`public/index.html:19`) | **Missing** |
| Main menu | Hub: mode carousel/grid, ⚙ OPTION, FREE POINT, gift | `#modeSel`: 2 big cards, Multiplayer and Single player (`public/index.html:64`) | Different look. Only 2 entries; no options or extras. |
| Modes | 9 modes | Arcade (45 champions), online private room, free practice (hidden in the arcade footer) | No Tournament / Survival / League / Head Cup / Death / Fight / Awaken. **Scope question for Phase 2.** |
| Character select | **One** Player Select: both sides scroll, octagon frames, flags, PLAYER/COM, stars, MATCH n, last score, 11 achievements, 6 stat bars, SHOP / PLAY | **Two** screens: `#pick` (a 180-card grid in 4 rarity tabs, me/foe slots, no stats), then `#arcade` (`public/index.html:100`) | `#arcade` is already close: hexagon reel, stars, stat bars, gold PLAY. See the list below. |
| Shop | Full screen with tabs UPGRADE / COSTUME / PET / BODY, 6 stats × 10 dots, Buy, MY POINT | `#upg` modal over the arcade (`public/index.html:159`): 5 stats × 10 segments, same price curve, nice buy animation | Missing **SURVIVAL**, the tabs (costume, pet, body) and the full-screen layout |
| Settings | Options popup (language, save) + pause SOUND / MUSIC / How to | Only 🔊 in pause, not saved | Missing MUSIC, How to, language, saving the sound setting |
| VS intro / KICK OFF | Red band, heads slide in, VS + lightning, ~1.25 s; KICK OFF fly-in + ball drop | `#vs` 1.5 s: red band, streaks, faces slide in, **Saltiz badge spins**, gold VS (`public/game.js:1236`) | Already close. HS has no badge, has lightning to the heads, and the timing differs slightly. Online skips the VS. |
| Pause | Big ball "PAUSE"; 2 columns of 3 gold pills: SOUND / MUSIC / How to and RESUME / GIVE UP / TITLE; match dimmed | `#pause` "הפסקה": המשך / מההתחלה / יציאה + 🔊 | Different layout. We have **Restart** (HS doesn't). Missing MUSIC, How to, GIVE UP (= loss), TITLE. |
| Result | RESULT; YOU WIN spelled out; bruised heads; loser charred; flags + scores; REWARD / TOTAL POINT strip; one NEXT MATCH button; FREE POINT | `#over`: RESULT, YOU WIN / LOSE letters, faces, loser dark silhouette, plus a Hebrew title and subtitle and 2 buttons (`public/game.js:1160`) | Already close. Missing the REWARD / TOTAL POINT strip, flags and bruises; ours has 2 buttons, HS has 1. |
| Popups | Review prompt, unlock modal, achievement tooltips | none | Optional |
| Multiplayer | Platform matchmaking | Room code / link lobby (`#lobby`) | Different model, fine to keep |

**Character select in detail: HS Player Select vs our `#arcade`:**
- **You pick your own character:** HS scrolls you on the same screen. Ours picks you on `#pick` and then you're fixed in the arcade.
- **Locked:** HS draws a **chain-link cage** over the head. Ours is greyscale + 🔒.
- **Flags:** HS shows a flag next to each head. We have cards and champions, not countries, so **ask** what goes there.
- **Counters:** HS shows "MATCH n", a last-score pill and the 11-achievement row. Ours has none of these; it has a tier strip, a power box and a stage chip instead.
- **Stats:** HS has 6 (with SURVIVAL); ours has 5.
- **Extras on ours:** the "free practice" slider and the upgrade button. HS has SHOP in the bottom-left.
- **Sides:** HS puts you on the left and the CPU on the right. Ours does the same, through RTL grid areas.

---

## 6. Bugs found on the way, all fixed in Phase 3 (2026-10-06)
| # | Bug | Fix | Guarded by |
|---|---|---|---|
| a | A stray `}` in `public/style.css` ate the `.over-sub` rule | Deleted | `test-css.mjs` (braces in both stylesheets) |
| b | The pick screen's VS matched the VS-intro rule | The rule is scoped to `#vs` (and the pick screen is gone) | `test-css.mjs` |
| c | Game keys couldn't be typed into the room-code box (A, D, J) | Keys typed into a field are text | `_online-flow.mjs` types `ADJ` |
| d | Online "again" started an offline bot match; "leave" didn't leave the room | Again goes to the room; leave calls `net().leave()` | `_online-flow.mjs` |
| e | Practice exited to the card grid | One `MODE` variable routes every exit | `_menu-shots.mjs` |
| f | Online, the guest was shown the host's result | WIN/LOSE is counted from your own seat (`NET.you`) | `_online-flow.mjs` (guest wins 2-0) |

---

## 6b. What was built (Phase 3, 2026-10-06)
All of it is on branch `hs/menus`, uncommitted. The full plan was approved in Phase 2.

### Files
- **`public/menus.js`**: the router and every menu screen.
- **`public/menus.css`**: the Saltiz premium kit and the screens. Everything is sized in `--u`, so a screen keeps its proportions from a 667 px phone to a 1440 px desktop.
- **`public/reel.js`**: Player Select's vertical reels.
- **`public/symbol.js`**: the Saltiz symbol redrawn as SVG from `saltiz.jpg`'s own geometry, each piece animatable. `public/img/saltiz-symbol.svg` is generated from it.
- **`shared/menu.js`**: the menus' rules, tested by `test-menus.mjs`.

### The screens
- **Title:** the symbol assembles, then "לחצו כדי להתחיל". A tap flies the symbol to the menu's corner.
- **Main menu:** HS's layout, with the symbol as the hero art. The carousel loops through ארקייד · רב משתתפים · אימון.
- **Player Select:** two reels, the stage tab, the last score, a rarity chip and a tier chip, VS, stars, the power row, your stats, SHOP / PLAY. Practice adds a difficulty picker. A card-grid popup opens from your frame.
- **Shop:** full screen with HS's rows.
- **Options:** HS's ring design with SOUND / MUSIC / How to / Stats.
- **How To:** 8 pages.
- **Multiplayer:** the popup, then a restyled lobby with HS's "Connecting.." panel.
- **Pause:** HS's ring, with GIVE UP and TITLE.
- **Result:** one NEXT MATCH / NEXT button and the REWARD / TOTAL POINT strip.
- **VS intro:** retimed to HS's ~1.25 s, with the symbol and lightning.

### Tournament (added 2026-10-07, Idan)
- **Where:** the carousel's second mode, in HS's order: ארקייד · טורניר · רב משתתפים · אימון.
- **Player Select:** your reel, plus a trophy panel listing the prizes. The button says הבא (HS's NEXT).
- **Choosing your player:** like HS, only you, on a sideways reel.
- **The bracket screen:** 8 players, with you in slot 6 (HS M15 46 s).
  - Each round's **other matches are played before you press שחק!**: one after another, each winner jumps up its line to the next node.
  - Each score shows under the winner, the loser's goals in red and the winner's in blue ("red - blue").
  - The שחק! button waits until they have all landed.
- **The look:** blue-to-purple sky, rainbow rays, confetti, the Saltiz symbol spinning behind the cup, and the bracket on HS's green pitch.
- **Your matches:** played against champions with their own bot and powers. The road gets harder: the quarter-final opponent comes from stages 1–15, the semi from 10–30, the final from 20–45.
- **Matches you're not in:** decided by dice (at the start of each round), with the higher-ranked champion more likely to win.
- **Prizes, HS's own:** 100 / 700 / 1,700 נקודות סולטיז per round won.
- **Losing:**
  - One loss and you're out; the rest of the bracket plays itself out.
  - GIVE UP counts as a loss.
- **Winning it all:** the "אלופי הטורניר!" trophy screen.
- **Saving:** stored as `hs.tour.v1`, so a tournament survives closing the app.
- **Code:** rules in `shared/tournament.js`, tests in `test-tournament.mjs`.

### Removed
- **The old screens:** `#pick`, `#modeSel` and `#arcade`, with 344 CSS rules.
- **Restart in pause:** HS has none.

### Data
- The arcade save keeps each stage's **last score** (`shared/arcade.js`, `lastScore`).
- The audio has separate SOUND and MUSIC switches, saved as `hs.audio.v1`.
- Your multiplayer name is saved as `hs.name.v1`.
- **One list, no rarities (Idan, 2026-10-08).** Player Select and the card popup show a single list, "דמויות" (`shared/menu.js` `charReel`): your Mythic starter first, then legendary #1–#45 in order, with the cards not in your album caged. The other three Mythics are not shown at all. The rarity pill is now a fixed "דמויות" label. The rarity and tier badges are gone, both under the two sides of the VS and on the result screen.

### Checks
- `npm test` (with the new `test-menus.mjs` and `test-css.mjs`).
- `node _menu-shots.mjs`: the whole navigation map at 4 sizes, plus portrait.
- `_arcade-shots.mjs`, `_upgrade-shots.mjs`, `_online-flow.mjs` (two browsers, one room).
- **Tools:** `_page-shot.mjs` and `_frames.mjs` (animation frame sheets); dev pages `public/_kit.html` and `public/_symbol.html`.

---

## 7. UNSURE: questions for Idan and screenshots to capture

**Update 2026-10-06:** M15 and M16 answered every capture asked for below (A–K). See §1b and §1c.
### Decisions for Idan
1. **Look:** copy HS 1:1 (blue backdrop, green pitch panels, gold pills, English labels)? Or keep HS's layout with the Saltiz logo and colours, and Hebrew labels?
2. **Modes:** HS has 9; we have Arcade, Online and a hidden free practice. Should the rebuild only cover menus for what we already have? Or should we also plan new modes (Tournament, Survival, League…)?
3. **Characters:** HS has one Player Select where both sides scroll. Should our 180-card `#pick` grid stay, or be folded into an HS-style Player Select? And what goes where HS puts the **flag**: card rarity, a team badge, nothing?
4. **Title screen:** add an HS-style title ("TOUCH TO KICK OFF") before the main menu?
5. **Monetisation features:** FREE POINT TV, the "Review / Later" prompt and "Get More Point". I assume we skip all of them. Correct?
6. **The SURVIVAL stat:** HS has 6 stats; we have 5. Adding it is a sim change (it would need test-arcade). Do you want it?
7. **Restart in pause:** HS has no Restart, only RESUME / GIVE UP / TITLE. Should we drop ours?

### Things still UNSURE, and what would settle them
| # | UNSURE | Why | Capture this in the real game |
|---|---|---|---|
| A | Splash, title, and title → menu transition | No clip; web art is from 2012–2017 | **Screen-record a cold launch** from tapping the app icon until the main menu is idle, with sound on |
| B | Current main menu: layout, mode order, the ⬆ button, gift box | Web shows 2017 versions only | **One screenshot** of the main menu, plus a **10 s clip** swiping the mode carousel both ways and tapping the round ⬆/⬇ button |
| C | Options popup today | Web only, 2017 | **Screenshot** after tapping ⚙ OPTION. Also tap the 🎁 gift and screenshot it. |
| D | Where BACK on Player Select goes, and the menu → Arcade transition | Never tapped in the clips | **Clip:** main menu → ARCADE → Player Select → BACK |
| E | What "HERO" does; what the 11 icons are; whether the score pill is the last score or a W:L tally | The wiki says a "W:L tally" and that "Hero buttons jump to a character". The clip shows KOR going 7:1 → **3:0** after a 3-0 win, which fits *last score*. | **Clip:** tap each HERO pill; long-press an achievement icon; scroll **your** side to a locked character and tap it; play a match and lose, then check the pill |
| F | The current shop: tabs, layout, buy animation | Never opened in the clips; the web shows the pre-7.0 shop | **Screenshot of every shop tab**, plus a **clip of one purchase** with sound, then BACK |
| G | How to, GIVE UP and TITLE in pause | Buttons seen but never pressed | **Screenshots** of each How to page; a **clip** of GIVE UP (any confirm? what comes next?) and of TITLE (where does it land?) |
| H | The full LOSE animation and NEXT after a loss; a draw → SUDDEN DEATH | The clip was cut at "YOU" | **Clip** of a lost match from 0:00 to NEXT and the screen after it; if possible, also a draw |
| I | The character carousel in other modes, and its NEXT button | Web only, 2017 | **Screenshot** of the Tournament (or Survival) select screen |
| J | The renewed Multiplayer menu (7.1.6) | New, nothing online yet | **Screenshot** of the first Multiplayer screen |
| K | Menu sounds: does a button tap make a sound? | Can't hear sound in the web sources | Any menu clip **with sound on**. For A–D, record with sound please. |
