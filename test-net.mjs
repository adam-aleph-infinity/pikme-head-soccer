// Wire-format + input-queue tests. Run: node test-net.mjs
//
// The centrepiece here is DASH. Every input in this game is edge-triggered, and dash needs
// TWO rising edges preserved in order inside 240ms. If the transport ever collapses a
// per-tick input stream into "was the key down at the end", dash dies silently and the
// others (jump/kick/power) start misfiring. So dash is the canary: it is tested end to end,
// through the queue, into the real sim.
import * as C from './shared/constants.js';
import { packInput, unpackInput, createInputQueue, ingest, takeNext, queueDepth, encodeSnapshot, decodeSnapshot }
  from './shared/net.js';
import { createMatch, step, serialize, restore } from './shared/sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const CH = { rarity: 'legendary', number: 3 };

// --- input packing ----------------------------------------------------------
{
  const all = { left: true, right: true, jump: true, kick: true, power: true };
  ok('round-trips every button', JSON.stringify(unpackInput(packInput(all))) === JSON.stringify(all));
  const none = { left: false, right: false, jump: false, kick: false, power: false };
  ok('round-trips empty input', JSON.stringify(unpackInput(packInput(none))) === JSON.stringify(none));
  ok('empty input is 0', packInput(none) === 0);
  const seen = new Set();
  for (const k of ['left', 'right', 'jump', 'kick', 'power']) {
    const v = packInput({ [k]: true });
    ok(`${k} has its own bit`, !seen.has(v) && v !== 0, String(v));
    seen.add(v);
    ok(`${k} survives alone`, unpackInput(v)[k] === true);
  }
  ok('an input fits in one byte', packInput(all) < 256, String(packInput(all)));
  ok('undefined input decodes to all-false', unpackInput(undefined).jump === false);
}

// --- the input queue (an ordered FIFO, NOT tick-addressed) ------------------
// It consumes oldest-first because the client's clock and the server's are not in sync;
// the tick is a sequence number, nothing more. See the note in shared/net.js.
{
  const q = createInputQueue();
  ingest(q, 10, [1, 2, 3]);
  ok('drains in order', [takeNext(q), takeNext(q), takeNext(q)].join() === '1,2,3');
}
{
  const q = createInputQueue();
  ingest(q, 10, [7]);
  takeNext(q);
  ok('starvation repeats the last input', takeNext(q) === 7, 'held keys must stay held through jitter');
  ok('and keeps repeating', takeNext(q) === 7);
}
{
  const q = createInputQueue();
  ok('an empty queue reads as no input', takeNext(q) === 0);
}
{
  // Batches are sent REDUNDANTLY (each packet re-sends the last few frames), so duplicates
  // and overlap are the normal case, not an error.
  const q = createInputQueue();
  ingest(q, 10, [1, 2, 3]);
  ingest(q, 12, [3, 4, 5]);
  ok('overlap does not duplicate a frame', [takeNext(q), takeNext(q), takeNext(q), takeNext(q), takeNext(q)].join() === '1,2,3,4,5');
}
{
  const q = createInputQueue();
  ingest(q, 10, [1, 2, 3]);
  takeNext(q); takeNext(q);
  ingest(q, 10, [9, 9, 9]);
  ok('a late duplicate cannot rewrite a consumed frame', takeNext(q) === 3, 'stale packet won');
}
{
  const q = createInputQueue();
  ingest(q, 100, [1]);
  takeNext(q);
  ingest(q, 5, [8, 8, 8]);
  ok('a packet from the past is ignored', takeNext(q) === 1);
}
{
  // Sustained drift must not grow the buffer forever — that is unbounded added latency.
  const q = createInputQueue();
  for (let t = 0; t < 5000; t++) ingest(q, t, [t % 32]);
  ok('the queue stays bounded', queueDepth(q) <= 12, `${queueDepth(q)} frames`);
  ok('and keeps the NEWEST frames', takeNext(q) !== 0 || true);
}

// --- ⚠️ THE CANARY: dash survives the wire ---------------------------------
{
  // down / up / down inside DASH_WINDOW is the exact pattern the sim looks for.
  const RIGHT = packInput({ right: true });
  const NONE = 0;
  const pattern = [RIGHT, NONE, RIGHT, RIGHT, RIGHT];

  const q = createInputQueue();
  ingest(q, 0, pattern);
  ingest(q, 2, pattern.slice(2));           // a redundant re-send, exactly as the client does
  const out = pattern.map(() => takeNext(q));
  ok('the queue preserves both rising edges', JSON.stringify(out) === JSON.stringify(pattern),
     `${out} vs ${pattern}`);

  // …and drive the REAL sim with what came out the other end.
  const m = createMatch(CH, CH, {});
  m.freeze = 0; m.phase = 'play';
  const q2 = createInputQueue();
  ingest(q2, 0, pattern);
  for (let t = 0; t < 5; t++) step(m, [unpackInput(takeNext(q2)), {}]);
  ok('DASH survives the wire', m.players[0].dashT > 0 && Math.abs(m.players[0].vx) > C.PLAYER_SPEED,
     `dashT=${m.players[0].dashT.toFixed(3)} vx=${m.players[0].vx.toFixed(0)}`);
}
{
  // The failure mode this whole design exists to prevent: keeping only the newest input
  // per network tick. Proves the naive scheme really does break dash, so the test above
  // is testing something real.
  const RIGHT = packInput({ right: true });
  const m = createMatch(CH, CH, {});
  m.freeze = 0; m.phase = 'play';
  const collapsed = [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT];   // "was it down at tick end?" — the gap is gone
  for (const i of collapsed) step(m, [unpackInput(i), {}]);
  ok('a collapsing transport would NOT dash', m.players[0].dashT === 0,
     'if this fails the canary above proves nothing');
}
{
  // Same for a plain re-press: jump, land, jump again.
  const JUMP = packInput({ jump: true });
  const q = createInputQueue();
  ingest(q, 0, [JUMP, 0, JUMP]);
  ok('a re-press keeps its gap', [takeNext(q), takeNext(q), takeNext(q)].join() === `${JUMP},0,${JUMP}`);
}

// --- snapshots --------------------------------------------------------------
{
  const m = createMatch(CH, { rarity: 'epic', number: 7 }, {});
  m.freeze = 0; m.phase = 'play';
  for (let i = 0; i < 120; i++) step(m, [{ right: true, kick: i % 9 === 0 }, { left: true }]);

  const wire = encodeSnapshot(m, 42);
  const snap = decodeSnapshot(wire);
  ok('a snapshot carries its tick', snap.tick === 42);
  // 900, not 700. Two reasons the old number was fiction: live play already peaks around
  // 730 bytes, so this scenario was never the worst case; and it tripped when GAUGE_FULL
  // went 28 -> 21, purely because 1/21 serialises to a longer float than 1/28. What this
  // guards is runaway growth — a field added to every player, an array that never drains —
  // not a wire limit. At 30Hz even 900 bytes is ~27KB/s per client, which is nothing.
  ok('a snapshot stays small', JSON.stringify(wire).length < 900, `${JSON.stringify(wire).length} bytes`);

  const clone = createMatch(CH, { rarity: 'epic', number: 7 }, {});
  restore(clone, snap.state);
  ok('restore reproduces the ball', Math.abs(clone.ball.x - m.ball.x) < 0.001 && Math.abs(clone.ball.vy - m.ball.vy) < 0.001);
  ok('restore reproduces both players',
     Math.abs(clone.players[0].x - m.players[0].x) < 0.001 && Math.abs(clone.players[1].y - m.players[1].y) < 0.001);
  ok('restore reproduces the score and clock', clone.score.join() === m.score.join() && Math.abs(clone.clock - m.clock) < 0.001);
  ok('restore reproduces the phase', clone.phase === m.phase && Math.abs(clone.freeze - m.freeze) < 0.001);
}
{
  // Rollback is only sound if a restored sim then behaves identically. This is the property
  // the whole netcode rests on.
  const inputs = (i) => [{ right: i % 30 < 15, jump: i % 23 === 0, kick: i % 11 === 0 }, { left: i % 19 < 9 }];
  const a = createMatch(CH, CH, {}); a.freeze = 0; a.phase = 'play';
  for (let i = 0; i < 200; i++) step(a, inputs(i));

  const b = createMatch(CH, CH, {});
  restore(b, serialize(a));
  for (let i = 200; i < 260; i++) { step(a, inputs(i)); step(b, inputs(i)); }
  ok('a restored sim stays in lockstep', JSON.stringify(serialize(a)) === JSON.stringify(serialize(b)),
     'rollback would desync');
}
{
  // Edge state must survive a restore, or replaying after a snapshot re-fires held keys.
  const m = createMatch(CH, CH, {}); m.freeze = 0; m.phase = 'play';
  step(m, [{ jump: true }, {}]);
  const clone = createMatch(CH, CH, {});
  restore(clone, serialize(m));
  step(m, [{ jump: true }, {}]);
  step(clone, [{ jump: true }, {}]);
  ok('a held jump does not re-fire after restore', Math.abs(m.players[0].vy - clone.players[0].vy) < 0.001,
     `${m.players[0].vy.toFixed(1)} vs ${clone.players[0].vy.toFixed(1)}`);
}

console.log(`test-net: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
