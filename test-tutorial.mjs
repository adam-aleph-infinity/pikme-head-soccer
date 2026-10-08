// The first-launch tutorial's rules, in node (shared/tutorial.js). Run: node test-tutorial.mjs
//
// What it looks like and that it plays through end to end is checked in a real browser
// (_tutorial-shots.mjs); this is the part that is a decision — who gets it, what each drill
// asks for, where its ball goes, and that the practice match pays exactly the first upgrade.
import * as T from './shared/tutorial.js';
import { costOf } from './shared/upgrades.js';
import * as C from './shared/constants.js';
import { createMatch, step, headY } from './shared/sim.js';
import { stageConfig } from './shared/champions.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const P = (q = '') => new URLSearchParams(q);
const fresh = { prog: { cleared: 0, record: {} }, stats: { points: 0, lv: { speed: 0, jump: 0, kick: 0, dash: 0, power: 0 } } };

// ── who gets it ──
ok('a brand-new player gets it', T.shouldRun({ ...fresh, params: P() }));
ok('…not once it is done', !T.shouldRun({ ...fresh, flag: 'done', params: P() }));
ok('…not with an arcade stage cleared', !T.shouldRun({ prog: { cleared: 1, record: {} }, stats: fresh.stats, params: P() }));
ok('…not with a stage merely played', !T.shouldRun({ prog: { cleared: 0, record: { 1: { last: [0, 2] } } }, stats: fresh.stats, params: P() }));
ok('…not with points', !T.shouldRun({ prog: fresh.prog, stats: { ...fresh.stats, points: 100 }, params: P() }));
ok('…not with an upgrade', !T.shouldRun({ prog: fresh.prog, stats: { points: 0, lv: { ...fresh.stats.lv, kick: 1 } }, params: P() }));
ok('?tutorial forces it, even when done', T.shouldRun({ ...fresh, flag: 'done', params: P('?tutorial') }));
ok('the harnesses (?nointro) and deep links skip it', ['?nointro', '?notutorial', '?room=ABCD', '?play=1', '?arcade=3'].every((q) => !T.shouldRun({ ...fresh, params: P(q) })));
ok('no storage at all still works', T.shouldRun({ params: P() }) && !T.playedBefore(null, null));

// ── the drills ──
const ids = T.DRILLS.map((d) => d.id).join();
ok('HB2\'s drills in HB2\'s order, plus the dash', ids === 'right,left,jump,dash,high,ground', ids);
ok('every drill rings a button that is on the pad', T.DRILLS.every((d) => d.pad.includes(d.ring)));
ok('a marker drill has a marker on the pitch', T.DRILLS.filter((d) => d.pass === 'mark').every((d) => d.mark > 100 && d.mark < 960));
ok('the first two send you right, then left', T.DRILLS[0].mark > 530 && T.DRILLS[1].mark < 530);
ok('a ball drill passes on a goal', T.DRILLS.filter((d) => d.ball).every((d) => d.pass === 'goal'));
ok('the buttons arrive one by one and never leave', T.DRILLS.every((d, i) => i === 0 || T.DRILLS[i - 1].pad.every((k) => d.pad.includes(k))));
ok('POWER is never on the pad in the drills (it is taught in the match)', T.DRILLS.every((d) => !d.pad.includes('power')));
ok('every drill says something and has a keyboard line', T.DRILLS.every((d) => d.say && d.keys));
ok('nextDrill walks the list and ends', T.nextDrill(0) === 1 && T.nextDrill(T.DRILLS.length - 1) === null);

// ── the marker and the ball ──
ok('on the marker: within reach either side', T.onMark(760, 760) && T.onMark(760 + T.MARK_REACH, 760) && T.onMark(760 - T.MARK_REACH, 760));
ok('…and not beyond it', !T.onMark(760 + T.MARK_REACH + 1, 760));
for (const px of [60, 221, 530, 800, 1000]) {
  for (const kind of ['drop', 'ground']) {
    const s = T.ballSpot(kind, px);
    ok(`the ${kind} ball for a player at ${px} is on the pitch, short of the far goal`, s.x >= 360 && s.x <= 1060 - 330, String(s.x));
  }
}
ok('the ball goes in front of you', T.ballSpot('ground', 221).x > 221 && T.ballSpot('drop', 300).x > 300);

// ── the pay and the match ──
ok('the practice match pays exactly the first upgrade', T.REWARD === costOf(1), `${T.REWARD} vs ${costOf(1)}`);
ok('the practice match is short (HB2: 38 s)', T.MATCH_SECONDS >= 30 && T.MATCH_SECONDS <= 60);
ok('a stuck shot drill gives up on aim after a few balls', T.MAX_TRIES >= 2 && T.MAX_TRIES <= 5 && T.RETRY_IDLE > 1);
ok('the coach is one of the drawn characters', T.COACH >= 1 && T.COACH <= 5);
ok('the coach has a line for every moment', ['hello', 'again', 'match', 'power', 'powerGo', 'powerAfter', 'won', 'lost', 'toShop', 'shop', 'stats', 'bought', 'arcade'].every((k) => T.SAY[k]) && T.SAY.good.length > 1);

// ── the counter lesson, played in the sim exactly as tutorial.js stages it ──
// You on your mark, him on his with the ball on his head and his power armed; his shot freezes
// COUNTER_GAP short of you and your kick goes in on the next tick. Every champion who can be the
// practice opponent (FOES) must be blocked that way — and NOT pressing must be a hit.
function counterTrial(foeN, press) {
  const m = createMatch({ rarity: 'legendary', number: foeN === 1 ? 2 : 1 }, { rarity: 'legendary', number: foeN }, { ...stageConfig(1, null).matchOpts, duration: T.MATCH_SECONDS });
  m.freeze = 0; m.phase = 'play'; m.banner = null; m.bannerT = 0; m.ballWait = 0;
  const p = m.players[0], q = m.players[1], b = m.ball;
  p.x = T.COUNTER_SPOTS.me; q.x = T.COUNTER_SPOTS.foe; q.armed = 1;
  b.x = q.x - (C.HEAD_R + b.r - 4); b.y = headY(q); b.vx = 40;
  let froze = false, kickAt = -1;
  const ev = [];
  for (let i = 0; i < 60 * 5; i++) {
    if (!froze && b.power && b.power.owner === 1 && !(m.hitStop > 0) && b.x - p.x < T.COUNTER_GAP) { froze = true; kickAt = i; }
    const inp = press && froze && i >= kickAt && i < kickAt + 6 ? { kick: true } : {};
    step(m, [inp, {}], C.TICK);
    for (const e of m.events) if (e.player === 0 && e.by === 1) ev.push(e.type);
    m.events.length = 0;
  }
  return { froze, blocked: ev.includes('blocked'), hit: ev.includes('powerHit') };
}
for (const n of T.FOES) {
  const yes = counterTrial(n, true), no = counterTrial(n, false);
  ok(`counter lesson vs champion ${n}: his shot reaches the freeze`, yes.froze);
  ok(`…and the kick there blocks it`, yes.blocked && !yes.hit, JSON.stringify(yes));
  ok(`…while standing still is a hit (so the lesson can say "again")`, !no.blocked, JSON.stringify(no));
}
ok('the opponent is never your own card', [1, 2, 3, 7].every((n) => T.foeFor({ rarity: 'legendary', number: n }).number !== n) && T.foeFor({ rarity: 'epic', number: 2 }).number === 2);
ok('…and never the coach', T.FOES.every((n) => n !== T.COACH));
ok('the freeze sits inside the measured block window (300–520 px)', T.COUNTER_GAP >= 300 && T.COUNTER_GAP <= 520);

// ── the narration ──
ok('every coach line has a clip id', Object.values(T.SAY).flat().every((t) => T.voiceFor(t)) && T.DRILLS.every((d) => T.voiceFor(d.say)));
ok('clip ids are safe file names', Object.keys(T.LINES).every((k) => /^[a-zA-Z0-9]+$/.test(k)));

console.log(`tutorial: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
