# The 45 champions' own powers — what is built

Each arcade champion fires one real Head Soccer character's power shot: the same flight, the same look
(our own canvas art), the same effect on the defender. The spec is `docs/hs-45-powers.json`
(`docs/HS-45-POWERS.md`); this page lists what is in the game.

- Behaviour: `shared/champion-powers.js` (the registry) + `shared/champion-powers/stage-NN.js` (one file
  per stage: the definition and its hooks into the engine, `shared/hs-powers.js`).
- Look: `public/vfx/powers/stage-NN.js` (one renderer per stage), registered in
  `public/vfx/powers/index.js`, dispatched by `public/champ-vfx.js`. The cut-in (1.34 s dark, rays,
  disc) and the arm → fire → counter / block / hit flow are HS's own and unchanged
  (`docs/HS-POWER-SHOTS.md`).
- Arcade only: online and free play a legendary card keeps its family from the approved map.
- Every champion without a built power keeps its family from the approved map
  (`docs/HS-CHAMPION-MAP.md`).
- Tests: `test-arcade.mjs` §2b (registry = spec, escalating), `test-ultimate.mjs` §16 (flight and defender
  effect, both seats), `test-vfx.mjs` §3b (every renderer drawn, cheap, no NaN).

Try one on the phone (LAN dev host only): `http://<mac>.local:3000/?unlockall&arcade=N` opens stage N.

| stage | champion | HS character | power | what it does | sources |
|---|---|---|---|---|---|
| 1 | התותחן | South Korea (0.5★) | Blue Aura Shot — הילה כחולה | HS's starter comet, cloaked in a blue flame aura: dead flat at 0.92 × 2150 px/s. A kick blocks it (grind, then it fires back), an armed touch counters it, standing in its way knocks you back toward your goal, dazed. Armed: a faint blue glow round the head. | [South_Korea](https://headsoccer.wiki.gg/wiki/South_Korea), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide), `docs/HS-POWER-SHOTS.md` §3–4 |
| 2 | אדון התולעים | Cameroon (1★) | Thunderbolt Shot — ברק | Straight and flat at 0.95 × 2150 px/s, the ball inside a crackling yellow-white electric sphere with bolts jumping off it and forked lightning trailing behind. A hit leaves the defender shocked 1.8 s (blue wash + sparks: half speed, no jump, no dash). A kick blocks it. Armed: little sparks crackling round the head. | [Cameroon](https://headsoccer.wiki.gg/wiki/Cameroon), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide), [Power_Shots](https://headsoccer.wiki.gg/wiki/Power_Shots) |
| 3 | השף הבוער | Nigeria (1.5★) | Tornado Shot — טורנדו | Drops to the grass and runs along it at 0.85 × 2150 px/s, the ball hopping quickly inside a sandy funnel ≈ 150 px tall (dust at its foot, a dust wake) that also catches a player jumping over it. Caught: thrown up spinning inside a whirl, out cold 3 s, the ball drops loose. A kick blocks it. Armed: a little dust devil round the feet. | [Nigeria](https://headsoccer.wiki.gg/wiki/Nigeria), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide), [Power_Shots](https://headsoccer.wiki.gg/wiki/Power_Shots) |
| 4 | מלך הבוץ | USA (2★) | Illusion Shot — אשליה | Splits into a fan of eight identical balls with pale streaks; after ≈ 260 px seven pop in white puffs and the real one turns invisible (a faint shimmer to the defender, a ghost to its shooter), flashing into sight only when it bounces — it travels slightly downward. While invisible it goes straight through the defender, even through a kick: only a counter stops it. Visible (fired from close), a kick blocks it. Armed: the head shimmers into ghost copies. | [USA](https://headsoccer.wiki.gg/wiki/USA), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide) |
| 5 | בונה החומות | Japan (2.5★) | Ninja Shot — נינג׳ה | At the touch he turns into a log (a puff of smoke); five balls circle over where he stood; then one every 0.13 s, streaks of blue light shoot down at the goal at the guide's five heights — middle, very low, highest, a little lower, middle. Only the green streak carries the ball (its slot drawn from a fixed deck weighted high). A kick blocks it but knocks the blocker out 1.2 s; standing in its way is the plain hit. Armed: ninja smoke curling round the feet. | [Japan](https://headsoccer.wiki.gg/wiki/Japan), [Power_Shot_Guide](https://headsoccer.wiki.gg/wiki/Power_Shot_Guide) |
