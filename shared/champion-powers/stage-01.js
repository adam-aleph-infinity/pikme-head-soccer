// STAGE 1 — SOUTH KOREA, "Blue Aura Shot" (0.5 stars, HS's first arcade opponent).
//
// Wiki (South_Korea): "shoots the ball horizontally towards the opponent at a high speed, which is
// cloaked in a blue aura. If the opponent does not counter it, he will get pushed back into his own
// goal and the ball will bounce off the opponent's head." It is HS's starter shot — the straight
// comet we filmed (docs/HS-POWER-SHOTS.md §3–4): dead flat, a kick blocks it, an armed touch
// counters it, standing in its way gets you knocked back. So the engine's straight family as it is,
// a touch slower than the filmed 2150 px/s so the first stage is the easiest shot of all.
// Look: public/vfx/powers/stage-01.js.
export default Object.freeze({
  stage: 1, id: 'blueaura', hs: 'South Korea', hsPower: 'Blue Aura Shot', hsStars: 0.5,
  family: 'straight', speed: 0.92, ailment: null, ailSec: 0,
  name: 'הילה כחולה', icon: '🔵', color: '#2f7bff',
  desc: 'כדור עטוף הילה כחולה טס ישר ושטוח לשער. בעיטה בזמן חוסמת אותו.',
  sources: ['https://headsoccer.wiki.gg/wiki/South_Korea', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide', 'docs/HS-POWER-SHOTS.md §3–4 (M4, M1)'],
  diff: { speed: 0.92 },
});
