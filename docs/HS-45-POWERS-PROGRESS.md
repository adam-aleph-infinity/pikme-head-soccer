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
