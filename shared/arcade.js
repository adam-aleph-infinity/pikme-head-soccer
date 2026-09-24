// ARCADE PROGRESS — which of the 45 stages are locked, open or beaten. Pure: no DOM, and the
// storage is passed in, so the client hands it localStorage and the tests hand it a Map.
//
// Progress is one number, `cleared`: stages 1..cleared are beaten, stage cleared+1 is open,
// everything after it is locked. The arcade is strictly in order, so nothing else can be true
// and no other shape could say it: there is no way to write down "stage 9 beaten, stage 4 not".
// Replaying a beaten stage can only ever keep or raise it (Math.max), which is what makes a
// completed stage stay completed however that replay goes.
//
// Its own key. Nothing that is already saved on a device is read or rewritten, and a value
// that will not parse is treated as no progress at all rather than as an error.

import { CHAMPION_COUNT } from './champions.js';

export const ARCADE_KEY = 'hs.arcade.v1';
export const STAGE_COUNT = CHAMPION_COUNT;

export const freshProgress = () => ({ v: 1, cleared: 0, record: {} });

export function parseProgress(raw) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return freshProgress(); }
  if (!o || typeof o !== 'object' || o.v !== 1) return freshProgress();
  const cleared = Number.isInteger(o.cleared) ? Math.max(0, Math.min(STAGE_COUNT, o.cleared)) : 0;
  const record = {};
  if (o.record && typeof o.record === 'object') {
    for (const [k, r] of Object.entries(o.record)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || n > STAGE_COUNT || !r || typeof r !== 'object') continue;
      const w = Number.isInteger(r.w) && r.w > 0 ? r.w : 0;
      const l = Number.isInteger(r.l) && r.l > 0 ? r.l : 0;
      if (w || l) record[n] = { w, l };
    }
  }
  return { v: 1, cleared, record };
}

export function loadProgress(storage) {
  try { return parseProgress(storage ? storage.getItem(ARCADE_KEY) : null); } catch { return freshProgress(); }
}

export function saveProgress(storage, prog) {
  try { storage.setItem(ARCADE_KEY, JSON.stringify(prog)); return true; } catch { return false; }
}

const valid = (n) => Number.isInteger(n) && n >= 1 && n <= STAGE_COUNT;

// 'completed' | 'available' | 'locked'
export function stageStatus(prog, n) {
  if (!valid(n)) return 'locked';
  if (n <= prog.cleared) return 'completed';
  return n === prog.cleared + 1 ? 'available' : 'locked';
}

export const canStart = (prog, n) => stageStatus(prog, n) !== 'locked';

// The stage the board opens on: the first one not yet beaten, or the last once all are.
export const currentStage = (prog) => Math.min(prog.cleared + 1, STAGE_COUNT);

export const campaignComplete = (prog) => prog.cleared >= STAGE_COUNT;

// A match on stage `n` just ended. Returns a NEW progress object and what changed; the input is
// never mutated, so a caller that fails to save still holds the old truth.
//
// A result for a stage that cannot be started is refused outright — the only way to reach a
// locked stage's result is a bug or a hand-edited call, and neither should unlock anything.
export function recordResult(prog, n, won) {
  if (!canStart(prog, n)) return { prog, accepted: false, unlocked: null, firstClear: false, complete: campaignComplete(prog) };
  const r = prog.record[n] || { w: 0, l: 0 };
  const record = { ...prog.record, [n]: { w: r.w + (won ? 1 : 0), l: r.l + (won ? 0 : 1) } };
  const firstClear = !!won && n === prog.cleared + 1;
  const cleared = firstClear ? n : prog.cleared;
  const next = { v: 1, cleared, record };
  const unlocked = firstClear && n < STAGE_COUNT ? n + 1 : null;
  return { prog: next, accepted: true, unlocked, firstClear, complete: campaignComplete(next) };
}
