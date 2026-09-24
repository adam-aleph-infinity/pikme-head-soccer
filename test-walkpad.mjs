// The walk plate's arithmetic, and what a HELD direction does to the body. Run: node test-walkpad.mjs
//
// The touch half — real fingers on a real page, hold and slide judged by where the player
// goes — is _touch-slide.mjs (headless Chrome). What lives here is the part that is a rule
// and not a gesture: which arrow a point means (public/walkpad.js), how two held directions
// resolve, and that the sim moves a held direction every single tick and turns on the tick
// the input turns.
import * as C from './shared/constants.js';
import { createMatch, step } from './shared/sim.js';
import { walkPick, resolveWalk } from './public/walkpad.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

// The default pad at 844x390, measured: two ~95x101 boxes with a ~11px gap.
const L = { left: 3, top: 288, right: 98, bottom: 389 };
const R = { left: 109, top: 288, right: 204, bottom: 389 };
const cy = 338;

// ── ON A BUTTON ──────────────────────────────────────────────────────────────
ok('centre of ◀ is left', walkPick(50, cy, L, R) === 'left');
ok('centre of ▶ is right', walkPick(156, cy, L, R) === 'right');
ok('a new touch on ◀ is left', walkPick(50, cy, L, R, { start: true }) === 'left');
ok('the corner of ▶ is right', walkPick(203, 289, L, R, { start: true }) === 'right');

// ── THE GAP IS LIVE ──────────────────────────────────────────────────────────
ok('a new touch in the gap, nearer ◀, is left', walkPick(101, cy, L, R, { start: true }) === 'left');
ok('a new touch in the gap, nearer ▶, is right', walkPick(107, cy, L, R, { start: true }) === 'right');
ok('a slide crossing the gap never drops to nothing',
   [...Array(20)].every((_, i) => walkPick(90 + i, cy, L, R, { cur: 'right' }) !== null));

// ── A WALKING THUMB MAY WANDER ───────────────────────────────────────────────
ok('walking, 60px above ▶ (a thumb rolled high) still walks right', walkPick(156, 228, L, R, { cur: 'left' }) === 'right');
ok('walking, 30px past the outer edge of ◀ still walks left', walkPick(-27, cy, L, R, { cur: 'left' }) === 'left');
ok('walking, well out on the pitch holds nothing', walkPick(422, 120, L, R, { cur: 'right' }) === null);
ok('walking, 150px above the pad holds nothing', walkPick(156, 130, L, R, { cur: 'right' }) === null);
ok('a NEW touch 60px above ▶ is not a walk (that is the pitch)', walkPick(156, 228, L, R, { start: true }) === null);
ok('a NEW touch well out on the pitch is not a walk', walkPick(422, 200, L, R, { start: true }) === null);

// ── NO FLICKER ON THE BOUNDARY, NO STICKING PAST IT ──────────────────────────
const mid = (L.right + R.left) / 2;
ok('resting on the boundary keeps ◀', walkPick(mid + 1, cy, L, R, { cur: 'left' }) === 'left');
ok('resting on the boundary keeps ▶', walkPick(mid - 1, cy, L, R, { cur: 'right' }) === 'right');
ok('but onto ▶ proper, it is right', walkPick(R.left + 6, cy, L, R, { cur: 'left' }) === 'right');
ok('and onto ◀ proper, it is left', walkPick(L.right - 6, cy, L, R, { cur: 'right' }) === 'left');
// The complaint: R → L → R. Every sample of the return must say right once past the gap.
{
  let cur = 'right', flips = [];
  for (const x of [156, 120, 104, 95, 60, 40, 60, 95, 104, 112, 130, 156]) {
    const k = walkPick(x, cy - 25 * Math.sin(x / 50), L, R, { cur });
    if (k !== cur) flips.push(`${x}:${k}`);
    cur = k;
  }
  ok('▶ → ◀ → ▶ turns exactly twice', flips.length === 2 && cur === 'right', flips.join(' '));
}

// ── EDIT-MODE LAYOUTS ────────────────────────────────────────────────────────
// Moved apart, resized, stacked: the plate is built from wherever the boxes are.
{
  const bigL = { left: 20, top: 200, right: 160, bottom: 340 };   // 140px ◀
  const smallR = { left: 320, top: 250, right: 390, bottom: 320 }; // 70px ▶, far away
  ok('far apart: centre of the big ◀', walkPick(90, 270, bigL, smallR, { start: true }) === 'left');
  ok('far apart: centre of the small ▶', walkPick(355, 285, bigL, smallR, { start: true }) === 'right');
  ok('far apart: the wide gap is not a walk for a new touch', walkPick(240, 285, bigL, smallR, { start: true }) === null);
  ok('far apart: a walking thumb near ▶ is right', walkPick(300, 285, bigL, smallR, { cur: 'left' }) === 'right');
  ok('far apart: the middle of the wide gap is nothing', walkPick(240, 285, bigL, smallR, { cur: 'left' }) === null);
  // ◀ stacked above ▶ (a player who likes a vertical pair).
  const upL = { left: 40, top: 150, right: 140, bottom: 250 };
  const dnR = { left: 40, top: 262, right: 140, bottom: 362 };
  ok('stacked: upper is left', walkPick(90, 200, upL, dnR) === 'left');
  ok('stacked: lower is right', walkPick(90, 320, upL, dnR) === 'right');
  ok('stacked: slide down turns right', walkPick(90, 280, upL, dnR, { cur: 'left' }) === 'right');
  // Dragged on top of each other: nearer centre wins, never null.
  const oL = { left: 0, top: 0, right: 100, bottom: 100 };
  const oR = { left: 50, top: 0, right: 150, bottom: 100 };
  ok('overlapping: nearer the ◀ centre is left', walkPick(60, 50, oL, oR) === 'left');
  ok('overlapping: nearer the ▶ centre is right', walkPick(90, 50, oL, oR) === 'right');
}
ok('no boxes (pad hidden): nothing', walkPick(10, 10, null, R) === null);

// ── MOST RECENT WINS ─────────────────────────────────────────────────────────
const w = (on, st) => { const r = resolveWalk(on, st); return r.left ? 'left' : r.right ? 'right' : 'none'; };
ok('only ▶: right', w({ left: false, right: true }, { left: 0, right: 1 }) === 'right');
ok('both, ◀ newer: left', w({ left: true, right: true }, { left: 5, right: 3 }) === 'left');
ok('both, ▶ newer: right', w({ left: true, right: true }, { left: 5, right: 9 }) === 'right');
ok('neither: none', w({ left: false, right: false }, { left: 5, right: 9 }) === 'none');

// ── THE SIM: A HELD DIRECTION MOVES EVERY TICK, AND TURNS ON THE TICK ────────
{
  const m = createMatch({ rarity: 'legendary', number: 3 }, { rarity: 'legendary', number: 2 }, {});
  const idle = { left: false, right: false, jump: false, kick: false, power: false };
  for (let i = 0; i < 2000 && !(m.phase === 'play' && !(m.freeze > 0)); i++) step(m, [idle, idle], C.TICK);
  ok('the match reaches open play', m.phase === 'play');
  const p = m.players[0];
  p.x = 300; m.ball.x = 900; m.players[1].x = 1000;
  const run = (input, n) => {
    const dx = [];
    for (let i = 0; i < n; i++) { const x0 = p.x; step(m, [input, idle], C.TICK); dx.push(p.x - x0); }
    return dx;
  };
  const R1 = run({ ...idle, right: true }, 60);
  ok('held ▶: x grows on every one of 60 ticks', R1.every((d) => d > 0), R1.filter((d) => d <= 0).length + ' stalls');
  const L1 = run({ ...idle, left: true }, 30);
  ok('switched to ◀: x falls from the very first tick', L1.every((d) => d < 0), L1.slice(0, 3).map((d) => d.toFixed(2)).join(' '));
  const R2 = run({ ...idle, right: true }, 30);
  ok('switched back to ▶: x grows from the very first tick', R2.every((d) => d > 0), R2.slice(0, 3).map((d) => d.toFixed(2)).join(' '));
  const S = run(idle, 5);
  ok('let go: stops on the tick', S.every((d) => Math.abs(d) < 1e-9));
}

console.log(`walkpad: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
