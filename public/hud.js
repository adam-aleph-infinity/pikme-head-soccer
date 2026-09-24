// What the scoreboard SAYS, as opposed to where it sits.
//
// One function so far, and it is here rather than inline in game.js for the same reason
// head-crop.js is: it is the half of the HUD that can be checked without a browser, and
// test-hud.mjs runs it in node. The layout half needs pixels and lives in _hudshots.mjs.

// The match clock, the way a football scoreboard writes it: M:SS, seconds always two digits,
// counting the second you are IN rather than the one you have finished — so a 60-second match
// opens on 1:00 and the last whole second on the board is 0:01, not 0:00 held for two ticks.
// Golden goal has no number to show, so it names the rule instead.
export function clockText(clock, golden = false) {
  if (golden) return 'גול מכריע';
  const s = Math.max(0, Math.ceil(Number.isFinite(clock) ? clock : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The POWER bar and the POWER button, as the HUD paints them off one player.
//
// HS M4 36.49 s: POWER pressed, the bar is EMPTY by 36.56 s and climbing again at 36.67 s, while
// the player glows (armed) until the touch that fires the shot at 41.93 s. The sim empties
// `gauge` on the press, so the bar simply shows `gauge` — no special case for armed. The button
// is only there when a press would do something: a full bar and no arm already waiting. It goes
// on the press and comes back when the refill is full again (and the first shot has fired).
export function gaugeView(p) {
  const gauge = Number.isFinite(p.gauge) ? Math.max(0, Math.min(1, p.gauge)) : 0;
  const armed = p.armed > 0;
  const full = gauge >= 1;
  return { pct: gauge * 100, full, armed, button: full && !armed };
}
