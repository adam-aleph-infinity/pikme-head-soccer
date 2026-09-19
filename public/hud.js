// What the scoreboard SAYS, as opposed to where it sits.
//
// One function so far, and it is here rather than inline in game.js for the same reason
// head-crop.js is: it is the half of the HUD that can be checked without a browser, and
// test-hud.mjs runs it in node. The layout half needs pixels and lives in _hudshots.mjs.

// The match clock, the way a football scoreboard writes it: M:SS, seconds always two digits,
// counting the second you are IN rather than the one you have finished — so a 60-second match
// opens on 1:00 and the last whole second on the board is 0:01, not 0:00 held for two ticks.
// Golden goal has no number to show, so it keeps the two Hebrew letters it always had.
export function clockText(clock, golden = false) {
  if (golden) return 'ג.ג';
  const s = Math.max(0, Math.ceil(Number.isFinite(clock) ? clock : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
