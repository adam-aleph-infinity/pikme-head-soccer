// Wire format + the input queue. Pure — no socket in sight, so `test-net.mjs` can drive it.
//
// The queue is the important half. Every input in this game is EDGE-triggered (the sim
// derives edges by comparing each tick's input to the previous one), and dash is a
// double-tap: down, up, down, inside 240ms. So the transport's job is not "tell the server
// which keys are held" — it is "deliver the per-tick input stream without holes or
// reordering". A transport that reports the latest state per network tick silently destroys
// dash and misfires everything else; football shipped that bug as "shoots wrong direction".

import { serialize } from './sim.js';

// Eight buttons, one byte. The three cards are inputs exactly like the other five — same
// queue, same edge discipline — because an ability delivered on a different path than the
// jump button is an ability that desyncs the first time the two paths disagree.
const BITS = { left: 1, right: 2, jump: 4, kick: 8, power: 16, card1: 32, card2: 64, card3: 128 };
const KEYS = Object.keys(BITS);

export function packInput(input = {}) {
  let v = 0;
  for (const k of KEYS) if (input[k]) v |= BITS[k];
  return v;
}

export function unpackInput(v = 0) {
  const n = v | 0;
  const out = {};
  for (const k of KEYS) out[k] = (n & BITS[k]) !== 0;
  return out;
}

// ---------------------------------------------------------------------------
// Input queue — an ORDERED FIFO, not a tick-addressed map.
//
// The first version indexed frames by the client's tick and had the server read the frame
// for its OWN tick. That silently assumed the two clocks were in sync: under any real
// latency the client's frame for tick N arrives when the server is already past N, so every
// input was discarded as stale and the player never moved. Making the client run ahead of
// the server would fix it and costs a clock-sync loop nobody wants in a mock.
//
// So the tick is treated as a SEQUENCE NUMBER, not a shared clock. The server consumes the
// oldest unconsumed frame each tick, in order. That is what actually matters here: edges
// (and dash's two-of-them-in-order) survive exactly, and there is no clock to sync.
//
// Cost: a small, self-correcting input delay equal to however deep the buffer sits.
const MAX_BUFFER = 12;       // ~200ms. Beyond this the oldest frames are stale anyway.

export function createInputQueue() {
  return {
    frames: new Map(),       // seq -> packed input, consumed lowest-first
    last: 0,                 // most recent frame consumed (repeated through starvation)
    played: -1,              // highest seq consumed; nothing at or below is accepted again
    newest: -1,
  };
}

export function ingest(q, t0, frames) {
  if (!Array.isArray(frames)) return q;
  for (let i = 0; i < frames.length; i++) {
    const seq = t0 + i;
    // First writer wins, twice over. A seq already CONSUMED is history. A seq already KNOWN
    // keeps its first value: honest redundant re-sends carry identical frames, so a
    // disagreeing one is a stale or bad packet either way.
    if (seq <= q.played || q.frames.has(seq)) continue;
    q.frames.set(seq, frames[i] | 0);
    if (seq > q.newest) q.newest = seq;
  }
  // Sustained clock drift would otherwise grow this without bound and add latency forever.
  // Drop from the FRONT — the oldest frames are the ones already too late to matter.
  while (q.frames.size > MAX_BUFFER) {
    let lo = Infinity;
    for (const seq of q.frames.keys()) if (seq < lo) lo = seq;
    q.frames.delete(lo);
    if (lo > q.played) q.played = lo;
  }
  return q;
}

// The next input, in order. Starvation repeats the last one: a held key must stay held
// through jitter, and the sim's own edge detection then sees no spurious edge.
export function takeNext(q) {
  if (q.frames.size === 0) return q.last;
  let lo = Infinity;
  for (const seq of q.frames.keys()) if (seq < lo) lo = seq;
  q.last = q.frames.get(lo);
  q.frames.delete(lo);
  if (lo > q.played) q.played = lo;
  return q.last;
}

export const queueDepth = (q) => q.frames.size;

// ---------------------------------------------------------------------------
// Snapshots. JSON, not a packed binary format: one 1v1 snapshot is ~500 bytes, so 30Hz is
// ~15KB/s per client, which is nothing. Binary is a later optimisation with a real cost in
// debuggability, and this is a mock.
export function encodeSnapshot(m, tick, oppInput = 0) {
  return { t: tick, i: oppInput, s: serialize(m) };
}

export function decodeSnapshot(wire) {
  return { tick: wire.t, oppInput: wire.i | 0, state: wire.s };
}
