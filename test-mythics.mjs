// THE MYTHIC STARTERS (shared/mythics.js): four cards of their own, one shared power, no stats of
// their own, the same hitbox as everyone, and art registered in the shared frame. Run: node test-mythics.mjs
import * as MY from './shared/mythics.js';
import { GEM } from './shared/champion-powers/mythic.js';
import * as MN from './shared/menu.js';
import { shotFor } from './shared/hs-powers.js';
import { CHARACTERS, characterFor, kitFor } from './public/characters.js';
import * as C from './shared/constants.js';
import { createMatch, step, headY, headR, serialize, restore } from './shared/sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const cards = MY.MYTHICS.map((m) => ({ rarity: MY.MYTHIC, number: m.number }));

// ── who they are ──
ok('four Mythics, numbered 1–4', MY.MYTHIC_COUNT === 4 && MY.MYTHICS.map((m) => m.number).join() === '1,2,3,4');
ok('…named שובל, אורי, נוה, פז (Idan)', MY.MYTHICS.map((m) => m.name).join() === 'שובל,אורי,נוה,פז');
ok('…each from its artist\'s sheet', MY.MYTHICS.map((m) => m.sheet).join() === 'champ_A,champ_B,champ_C,champ_D');
ok('isMythic knows its own', cards.every(MY.isMythic) && !MY.isMythic({ rarity: 'mythic', number: 5 }) && !MY.isMythic({ rarity: 'legendary', number: 1 }));

// ── the rarity ──
ok('Mythic is the rarest, first in the list', MN.RARITY_ORDER[0] === 'mythic' && MN.RARITY_NAME.mythic === 'מיתי' && !!MN.RARITY_COLOR.mythic);
ok('its row is four cards; the album\'s are 45', MN.cardsIn('mythic') === 4 && MN.cardsIn('legendary') === 45);

// ── one power, the same for all four, no stronger than anyone's ──
const shots = cards.map((c) => shotFor(c)), arc = cards.map((c) => shotFor(c, { arcade: true }));
ok('one Mythic power for all four (Idan): the Mythic Gem', shots.every((s) => s.cp === 'mythicgem' && s.family === shots[0].family && s.name === MY.MYTHIC_POWER.name && s.speed === MY.MYTHIC_POWER.speed));
ok('…the same in the arcade and out of it', arc.every((s, i) => s.cp === shots[i].cp && s.speed === shots[i].speed && s.color === shots[i].color));
ok('…above the arcade\'s average (Idan): faster than the comet', MY.MYTHIC_POWER.speed > 1);
ok('…each in their own gem\'s colour (Idan): Shoval red, Ori pink, Naveh yellow, Paz green',
  shots.map((s) => s.color).join() === [1, 2, 3, 4].map((n) => MY.mythicGem(n).color).join() && new Set(shots.map((s) => s.color)).size === 4 &&
  MY.MYTHIC_GEMS[1].gem === 'ruby' && MY.MYTHIC_GEMS[2].gem === 'pink diamond' && MY.MYTHIC_GEMS[3].gem === 'topaz' && MY.MYTHIC_GEMS[4].gem === 'emerald');
{
  // the hue of each: red, pink, yellow, green
  const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const h = shots.map((s) => hue(s.color));
  ok('…and the colours are what they say', (h[0] > 340 || h[0] < 10) && h[1] > 300 && h[1] < 335 && h[2] > 40 && h[2] < 60 && h[3] > 130 && h[3] < 160, h.map((v) => v.toFixed(0)).join());
}

// ── no stats of their own (Idan: "no bonus"): a match gives a Mythic exactly a legendary's body ──
const mm = createMatch(cards[0], { rarity: 'legendary', number: 1 }, {});
const ml = createMatch({ rarity: 'legendary', number: 2 }, { rarity: 'legendary', number: 1 }, {});
ok('no stat bonus: the same body as any other card', JSON.stringify(mm.players[0].stats) === JSON.stringify(ml.players[0].stats), JSON.stringify(mm.players[0].stats));
ok('the same hitbox as everyone', headR(mm, mm.players[0]) === C.HEAD_R && headR(mm, mm.players[0]) === headR(ml, ml.players[0]));

// ── the power fires in the sim ──
{
  const m = createMatch(cards[2], { rarity: 'legendary', number: 1 }, {});
  m.freeze = 0; m.phase = 'play'; m.banner = null; m.bannerT = 0; m.ballWait = 0;
  const p = m.players[0], b = m.ball;
  p.armed = 1; p.x = 300;
  b.x = p.x + (C.HEAD_R + b.r - 4); b.y = headY(p); b.vx = -40; b.vy = 0;
  const ev = [];
  for (let i = 0; i < 60 * 2; i++) { step(m, [{}, {}], C.TICK); for (const e of m.events) ev.push(e); m.events.length = 0; }
  const shot = ev.find((e) => e.type === 'powershot' && e.player === 0);
  ok('a Mythic\'s power shot fires', !!shot, ev.map((e) => e.type).join(','));
  ok('…as the Mythic Gem', shot && shot.cp === 'mythicgem', JSON.stringify(shot));
}

// ── the gem in play: shatters on a head or body, only the timed kick stops it ──
// Mythic `n` in seat `i` fires; the other player stands `gap` px down the pitch.
function fireGem(i, { gap = 450, n = 1 } = {}) {
  const cs = []; cs[i] = { rarity: MY.MYTHIC, number: n }; cs[1 - i] = { rarity: 'epic', number: 1 };
  const m = createMatch(cs[0], cs[1], { duration: 600 });
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.gaugeLead = 0; m.ballWait = 0;
  const p = m.players[i], q = m.players[1 - i];
  p.x = i === 0 ? 300 : C.W - 300; q.x = i === 0 ? 300 + gap : C.W - 300 - gap;
  p.gauge = 1; p.prev = {};
  const press = [{}, {}]; press[i] = { power: true }; step(m, press); m.events.length = 0;
  m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = 0; m.ball.vy = 0;
  const log = [];
  for (let k = 0; k < 300 && !(m.cutin > 0 && m.cutin <= C.POWER_RELEASE); k++) { step(m, [{}, {}]); log.push(...m.events); m.events.length = 0; }
  return { m, p, q, log };
}
function runGem(f, n, qin = () => ({}), until = () => false) {
  const path = [];
  for (let k = 0; k < n && f.m.phase === 'play'; k++) {
    const inp = []; inp[f.p.index] = {}; inp[f.q.index] = qin(f.m);
    step(f.m, inp); f.log.push(...f.m.events);
    path.push({ n: f.m.xballs.length, ail: f.q.ail, x: f.q.x });
    const stop = until(f.m, f.m.events);
    f.m.events.length = 0;
    if (stop) break;
  }
  return path;
}
for (const seat of [0, 1]) {
  // standing in its way: it shatters on him — a stop, as any hit — he is stuck in the gem, and the
  // ball pops loose over him toward his goal
  const f = fireGem(seat, { n: 2 });
  ok(`gem (seat ${seat}): fired in Ori's pink`, f.m.ball.power && f.m.ball.power.cp === 'mythicgem' && f.m.ball.power.color === MY.mythicGem(2).color);
  const path = runGem(f, 150, () => ({}), (m, es) => es.some((e) => e.type === 'gemShatter'));
  const sh = f.log.find((e) => e.type === 'gemShatter');
  ok(`gem (seat ${seat}): shatters on whoever stands in its way`, !!sh && sh.player === f.q.index && sh.color === MY.mythicGem(2).color, JSON.stringify(sh));
  ok(`gem (seat ${seat}): …and that is a stop: the shot is over, no shards fly on (Idan: "OP")`, !f.m.ball.power && f.m.xballs.length === 0);
  ok(`gem (seat ${seat}): …the ball pops up over him, on toward his goal`, f.m.ball.vy < 0 && f.m.ball.vx * f.p.side > 0, `${f.m.ball.vx} ${f.m.ball.vy}`);
  ok(`gem (seat ${seat}): …and he is stuck in the gem, longer than a daze`, f.log.some((e) => e.type === 'ailment' && e.ail === 'gem' && e.player === f.q.index && Math.abs(e.time - GEM.CRUST) < 1e-9) && GEM.CRUST > 1);
  const stuck = runGem(f, 120).filter((s) => s.ail === 'gem');
  ok(`gem (seat ${seat}): …without moving`, stuck.length > 60 && stuck.every((s) => Math.abs(s.x - stuck[0].x) < 1), stuck.length);
  // a header (jumping into it) is a stop too
  const j = fireGem(seat);
  runGem(j, 150, (m) => ({ jump: !!m.ball.power && Math.abs(m.ball.x - j.q.x) < 300 }), (m, es) => es.some((e) => e.type === 'gemShatter'));
  ok(`gem (seat ${seat}): a header shatters it too`, j.log.some((e) => e.type === 'gemShatter') && !j.m.ball.power);
  // the timed kick: blocked, and fired back as the blocker's
  const k = fireGem(seat);
  runGem(k, 30, (m) => ({ kick: !!m.ball.power && Math.abs(m.ball.x - k.q.x) - 20 < Math.abs(m.ball.vx) * 0.135 }), (m, es) => es.some((e) => e.type === 'blocked' || e.type === 'gemShatter'));
  ok(`gem (seat ${seat}): a timed kick blocks it whole`, k.log.some((e) => e.type === 'blocked' && e.player === k.q.index) && !k.log.some((e) => e.type === 'gemShatter'));
  runGem(k, 80, () => ({}), (m, es) => es.some((e) => e.type === 'powershot'));
  ok(`gem (seat ${seat}): …and it goes back as the blocker's gem`, k.log.some((e) => e.type === 'powershot' && e.rebound && e.player === k.q.index && e.cp === 'mythicgem'));
  // nobody in the way: it goes in
  const e = fireGem(seat, { gap: 2000 });
  runGem(e, 120);
  ok(`gem (seat ${seat}): with nobody in its way it scores`, e.m.score[e.p.index] === 1);
}
{
  // rollback: a snapshot taken while he is stuck in the gem replays bit for bit
  const a = fireGem(0), b = fireGem(0);
  const at = (f) => runGem(f, 200, () => ({}), (m, es) => es.some((e) => e.type === 'gemShatter'));
  at(a); at(b); runGem(a, 3); runGem(b, 3);
  const live = a.q.ail === 'gem' && b.q.ail === 'gem';
  restore(b.m, JSON.parse(JSON.stringify(serialize(a.m))));
  runGem(a, 40); runGem(b, 40);
  ok('gem: a snapshot with him in the gem replays bit for bit', live && JSON.stringify(serialize(a.m)) === JSON.stringify(serialize(b.m)));
}

// ── the art: in the shared frame, with its kit ──
for (const c of cards) {
  const ch = characterFor(c.rarity, c.number);
  ok(`mythic ${c.number} has its character`, !!ch && ch.dir === `mythic-${c.number}` && CHARACTERS[`mythic:${c.number}`] === ch);
  ok(`…and its kit (the sheet's shirt, the gold badge)`, !!kitFor(c.rarity, c.number)?.suit && !!kitFor(c.rarity, c.number)?.badge);
}

// ── the starter: chosen once, kept for good ──
{
  const box = new Map(), store = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, String(v)) };
  const P = (q = '') => new URLSearchParams(q);
  ok('a new device has no starter, so it must choose', MY.loadStarter(store) === null && MY.needsStarter({ starter: null, params: P() }));
  ok('…even when the tutorial is skipped (Idan): only the harnesses\' ?nointro gets past', MY.needsStarter({ starter: null, params: P('?notutorial') }) && !MY.needsStarter({ starter: null, params: P('?nointro') }));
  ok('the choice saves at once', MY.saveStarter(store, 3) === 3 && MY.loadStarter(store) === 3 && box.get(MY.STARTER_KEY) === JSON.stringify({ v: 1, starter: 3 }));
  ok('…and can never be made twice: a second choice keeps the first', MY.saveStarter(store, 1) === 3 && MY.loadStarter(store) === 3);
  ok('…so the next launch does not ask again', !MY.needsStarter({ starter: MY.loadStarter(store), params: P() }));
  ok('you own your starter and only it', MY.ownsMythic(3, 3) && [1, 2, 4].every((n) => !MY.ownsMythic(3, n)) && !MY.ownsMythic(null, 1));
  ok('a broken save is no choice (asked again, never stuck)', ['{', 'null', '{"v":1,"starter":9}', '{"v":2,"starter":1}', '"x"'].every((r) => MY.parseStarter(r) === null));
  ok('a bad number is never saved', MY.saveStarter({ getItem: () => null, setItem: () => { throw new Error('no'); } }, 2) === null && MY.saveStarter(new Map([]) && { getItem: () => null, setItem() {} }, 7) === null);
  const other = new Map(), ostore = { getItem: (k) => other.get(k) ?? null, setItem: (k, v) => other.set(k, v) };
  other.set('hs.arcade.v1', '{"v":1,"cleared":12,"record":{}}'); other.set('hs.stats.v1', '{"v":1,"points":2400}');
  MY.saveStarter(ostore, 2);
  ok('choosing touches nothing else saved (progress, points)', other.get('hs.arcade.v1') === '{"v":1,"cleared":12,"record":{}}' && other.get('hs.stats.v1') === '{"v":1,"points":2400}' && other.size === 3);
}

console.log(`mythics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
