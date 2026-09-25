// The scoreboard's own arithmetic. Run: node test-hud.mjs
//
// The rest of the HUD is a layout, and a layout is only true in pixels — that half lives in
// _hudshots.mjs, which drives a real browser across five screen sizes. What is left is the
// one thing on the board that is computed rather than positioned: the clock's text. It runs
// here, in node, on every `npm test`, because "0:59" vs "59" is a rule and not a picture.
import { readFileSync } from 'node:fs';
import { clockText, gaugeView } from './public/hud.js';
import * as C from './shared/constants.js';
import { createMatch, serialize, step, headY } from './shared/sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// ── M:SS, THE FOOTBALL FORMAT ────────────────────────────────────────────────
ok('a full minute reads 1:00', clockText(60) === '1:00', clockText(60));
ok('the second below it reads 0:59', clockText(59) === '0:59', clockText(59));
ok('seconds always carry two digits', clockText(9) === '0:09', clockText(9));
ok('and so does the ten-second mark', clockText(10) === '0:10', clockText(10));
ok('full time reads 0:00', clockText(0) === '0:00', clockText(0));
ok('two and a half minutes reads 2:30', clockText(150) === '2:30', clockText(150));

// A clock is a float counting down, and the board shows the second you are IN — the same
// rule the old bare `Math.ceil(clock)` used, kept so a 60s match still opens on its full
// duration and the last whole second on the board is 0:01 rather than a doubled 0:00.
ok('a part-second counts as the second you are in', clockText(46.4) === '0:47', clockText(46.4));
ok('the last tick before the whistle is 0:01', clockText(0.02) === '0:01', clockText(0.02));

// The clock is driven straight off MATCH.clock, which can undershoot zero by a frame between
// `m.clock -= dt` and the clamp on the next line. A negative must never print as -1:59.
ok('a clock past zero never goes negative', clockText(-0.4) === '0:00', clockText(-0.4));
ok('nor does a broken one', clockText(NaN) === '0:00' && clockText(undefined) === '0:00');

// ── SUDDEN DEATH ─────────────────────────────────────────────────────────────
// No number to show, and this is the label the rest of the game (and _shot.mjs) expects to
// find in #clock.
ok('golden goal keeps its own label', clockText(12, true) === 'גול מכריע', clockText(12, true));
ok('and that label wins over whatever the clock says', clockText(0, true) === 'גול מכריע');

// ── THE SHIPPED MATCH ────────────────────────────────────────────────────────
// The format has to suit the duration the game actually ships with, not a hypothetical one:
// a board 4.6ch wide holds M:SS and nothing longer.
ok('the shipped match length fits the board', clockText(C.MATCH_DURATION).length <= 4,
   `${C.MATCH_DURATION}s → ${clockText(C.MATCH_DURATION)}`);
ok('every second of it formats to four characters',
   Array.from({ length: Math.ceil(C.MATCH_DURATION) + 1 }, (_, i) => clockText(i))
     .every((t) => /^\d:[0-5]\d$/.test(t)));

// ── THERE IS NO HEALTH ────────────────────────────────────────────────────────
//
// Head Soccer has no health, so neither does this game any more: the hidden health bar and the
// bruised faces it drove (hurtTier, .head.hurt1..4) were removed in the HS parity pass. What is
// fenced here is that nothing of it survives or creeps back — no health widget, no bruise tier,
// no `hp` on a player or in the snapshot — written as a guard because the failure mode is
// somebody adding a perfectly reasonable little bar later on.
{
  const html = readFileSync(new URL('./public/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./public/style.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./public/game.js', import.meta.url), 'utf8');

  // Nothing in the markup is a health widget. `hp` as a whole word catches id="hp"/class="hp",
  // and the health/damage words catch the friendlier names somebody would reach for.
  ok('the markup has no health element', !/\b(id|class)="[^"]*\b(hp|health|damage|hurt-?bar)\b/i.test(html),
     (html.match(/\b(id|class)="[^"]*\b(hp|health|damage)\b[^"]*"/i) || [])[0]);
  // …and no bar/meter/fill styled for one. The gauge (.meter/.gauge) is the POWER bar and has
  // every right to be there; what must not exist is a second one for health.
  ok('the stylesheet has no health bar', !/\.(hp|health|damage)-?(bar|meter|fill)?\s*[{,]/i.test(css),
     (css.match(/\.(hp|health|damage)[^\s{,]*\s*[{,]/i) || [])[0]);

  // The renderer never prints health as text.
  const writes = js.match(/\.(textContent|innerHTML|innerText)\s*=\s*[^;]+;/g) || [];
  const leaks = writes.filter((w) => /\bhp\b|health/i.test(w));
  ok('the HUD never writes health as text', leaks.length === 0, leaks.join(' | '));

  // The bruises are gone from both sides: no tier is styled and the renderer sets none.
  ok('no bruise tier survives in the stylesheet',
     [1, 2, 3, 4].every((t) => !new RegExp(`\\.head\\.hurt${t}\\s*[{,:]`).test(css)));
  ok('and the renderer never reads health or sets a hurt class',
     !/hurtTier|p\.hp\b/.test(js) && !/classList\.toggle\('hurt'/.test(js));
  // The three markers the damage system replaced are gone from both sides too.
  for (const dead of ['hexed', 'slowed', 'knocked']) {
    ok(`no .head.${dead} rule survives`, !new RegExp(`\\.head\\.${dead}\\s*[{,]`).test(css));
    ok(`and the renderer never sets '${dead}'`, !new RegExp(`toggle\\('${dead}'`).test(js));
  }

  // And the state itself is gone: not on the player, not on the match, not on the wire.
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  ok('a player carries no health', m.players.every((p) => !('hp' in p) && !('health' in p)));
  ok('nor does the match', !('hp' in m) && !('health' in m));
  ok('and the snapshot has no seat for it', !JSON.stringify(serialize(m)).includes('"hp"'));
}

// ── THE POWER BAR AND BUTTON THROUGH A PRESS ─────────────────────────────────
// "When you use the power it's not resetting the bar." HS M4: POWER at 36.49 s, the bar empty
// by 36.56 s and refilling from there, the POWER plaque gone until the bar is full (54.88 s).
// Driven through the real sim, so the HUD is judged on what a match actually does.
{
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  m.phase = 'play'; m.freeze = 0; m.banner = null; m.bannerT = 0; m.gaugeLead = 0;
  const p = m.players[0];
  const park = () => { m.ball.x = C.W / 2; m.ball.y = C.CEIL_Y + C.BALL_R + 2; m.ball.vx = 0; m.ball.vy = 0; m.hitStop = 0; };
  p.gauge = 1; park();
  let v = gaugeView(p);
  ok('a full bar shows the POWER button', v.full && v.button && v.pct === 100, JSON.stringify(v));
  step(m, [{ power: true }, {}]);
  v = gaugeView(p);
  ok('the press empties the bar', v.pct === 0 && !v.full, JSON.stringify(v));
  ok('and hides the button', !v.button);
  ok('while the player is armed (the glow)', v.armed);
  for (let i = 0; i < 120; i++) { park(); step(m, [{}, {}]); }
  v = gaugeView(p);
  ok('two seconds on, the bar is refilling', Math.abs(v.pct - 120 * C.TICK * C.GAUGE_PASSIVE * 100) < 1e-6, v.pct.toFixed(3));
  ok('the button is still hidden, the arm still waiting', !v.button && v.armed);
  // Full again before the shot: the arm still has to fire first, so no button yet.
  p.gauge = 1;
  v = gaugeView(p);
  ok('a bar full again while still armed keeps the button hidden', v.full && !v.button, JSON.stringify(v));
  for (let t = 0; t < 30 && !m.ball.power; t++) { m.hitStop = 0; m.ball.x = p.x; m.ball.y = headY(p); m.ball.vx = m.ball.vy = 0; step(m, [{}, {}]); }
  v = gaugeView(p);
  ok('the touch fires the shot and the button comes back on the full bar', !!m.ball.power && !v.armed && v.button, JSON.stringify(v));
  ok('a bad gauge value reads as empty', gaugeView({ gauge: NaN, armed: 0 }).pct === 0);
  // The renderer paints the bar and the button off gaugeView and nothing else.
  const js = readFileSync(new URL('./public/game.js', import.meta.url), 'utf8');
  ok('game.js lights the button off gaugeView', /const ready = gaugeView\(mine\)\.button;[\s\S]{0,400}toggle\('ready', ready\)/.test(js));
  ok('and paints the bar off it', /prop\(gEl, '--p', gv\.pct/.test(js));
}

console.log(`hud: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
