// STAGE 2 — CAMEROON, "Thunderbolt Shot" (1 star).
//
// Wiki (Cameroon): "the ball is covered in lightning, and it shoots straight across the field";
// hit, "the opponent turns blue and is surrounded in electricity and is stunned, unable to jump or
// move fast"; "slightly better than South Korea's in the way that it has an after-effect".
// Power_Shots: Shocked = "slowing them down and rendering them unable to jump".
// So: the straight family at Korea's own pace (the wiki GIF QqqGYR.gif flies it at ≈ 2280 px/s, Korea's
// within the error — docs/HS-FIRST-3-POWERS.md), and a hit leaves the shock ailment (half speed, no
// jump, no dash — hs-powers.js AILMENTS.shock) for 1.8 s. Blocked and fired back, it is a plain
// rebound: the shock stays with Cameroon's shot (Idan).
// Look: public/vfx/powers/stage-02.js.
export default Object.freeze({
  stage: 2, id: 'thunderbolt', hs: 'Cameroon', hsPower: 'Thunderbolt Shot', hsStars: 1,
  family: 'straight', speed: 1, ailment: 'shock', ailSec: 1.8,
  name: 'ברק', icon: '⚡', color: '#b9a8ff',
  desc: 'כדור עטוף ברקים טס ישר. מי שנפגע מתחשמל: איטי ולא קופץ.',
  sources: ['https://headsoccer.wiki.gg/wiki/Cameroon', 'https://headsoccer.wiki.gg/wiki/Power_Shot_Guide', 'https://headsoccer.wiki.gg/wiki/Power_Shots'],
  diff: { speed: 1, disable: 1.8 },
});
