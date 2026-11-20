// Private-room registry for online 1v1. Pure: no sockets, no timers, no I/O — the server
// owns transport and calls into this. That split is what makes `test-rooms.mjs` possible.
//
// There is no host-accept step on purpose. The 4-char code IS the permission: you only have
// it because the host sent you the link. Football needs accept/reject because it matchmakes
// strangers into public lobbies; this only ever admits someone you invited.

// No 0/O, 1/I, 5/S — the code gets read aloud, typed by a kid, or screenshotted badly.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';   // no O/I/S, no 0/1/5
const ROOM_MAX = 2;
// A ROOM OUTLIVES ITS LAST PLAYER'S DROPPED CONNECTION for this long (2026-10-22). A phone that goes to the
// background (the host switching to WhatsApp to send the link) drops its socket, and the room went with it:
// on 19.10, 29 friends' joins found no room. Now it waits, the friend can join it, and the host's phone takes
// its seat back when it reconnects (game.js rejoins). Leaving on purpose still closes it at once.
export const ROOM_GRACE_MS = 5 * 60 * 1000;
// WHY A JOIN FOUND NO ROOM (2026-11-20). 282 'not-found' joins since 15.10, against 240 rooms: one kid made many
// (a JOIN tapped again and again, a host's phone retrying its swept room on every return), and nothing told a typo
// from a room that was there and is gone. So the registry remembers, in memory only and for a while:
//   gone   — codes of rooms closed (the host left) or expired (the grace ran out), for GONE_MS
//   failed — "this player already failed with this code", for RETRY_MS, so a repeat is counted as one
// and joinRoom says which: 'never' | 'closed' | 'expired' | 'retry'. Nothing here is ever stored or reported but
// the reason's name (server.js counts it); the codes and ids die with the process.
export const GONE_MS = 24 * 3600 * 1000;
export const RETRY_MS = 10 * 60 * 1000;

export function createRegistry() {
  return {
    rooms: new Map(),        // code -> room
    byMember: new Map(),     // memberId -> { member, room }
    gone: new Map(),         // code -> { at, why: 'closed' | 'expired' } — a friend's room that is no more
    failed: new Map(),       // 'player|code' -> at — a join that already failed
  };
}

export function genCode(rng = Math.random, isTaken = () => false, attempts = 200) {
  for (let a = 0; a < attempts; a++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    if (!isTaken(code)) return code;
  }
  return null;                // caller decides what to tell the player
}

export const normalizeCode = (code) => String(code || '').trim().toUpperCase();

export function createRoom(reg, member, gen = genCode) {
  leave(reg, member.id);      // a player is only ever in one room
  // a code that just closed is not handed out again: a late friend with the old invite must not walk into a stranger's room
  const code = gen(Math.random, (c) => reg.rooms.has(c) || reg.gone.has(c));
  if (!code) return { error: 'no-codes' };
  reg.gone.delete(code);
  const room = {
    code,
    hostId: member.id,
    members: [],
    ready: new Set(),
    phase: 'lobby',           // lobby -> match -> over
    match: null,              // the sim, once started
  };
  reg.rooms.set(code, room);
  attach(reg, member, room);
  return { room };
}

export function joinRoom(reg, member, code, now = Date.now()) {
  const room = reg.rooms.get(normalizeCode(code));
  if (!room) return { error: 'not-found', why: notFoundWhy(reg, member, normalizeCode(code), now) };
  if (room.phase !== 'lobby') return { error: 'in-match' };
  // the same phone back on a new connection (its old one may not have closed yet): it takes its own seat
  const old = member.pid ? room.members.find((m) => m.pid === member.pid && m.id !== member.id) : null;
  if (old) leave(reg, old.id, { keepEmpty: true });
  if (room.members.length >= ROOM_MAX) return { error: 'full' };
  leave(reg, member.id);
  attach(reg, member, room);
  return { room };
}

// The first failure of this player with this code says why; the same one again within RETRY_MS is a 'retry'.
function notFoundWhy(reg, member, code, now) {
  const key = `${member.pid || member.id}|${code}`;
  const seen = reg.failed.get(key);
  reg.failed.set(key, now);
  if (seen != null && now - seen < RETRY_MS) return 'retry';
  return reg.gone.get(code)?.why || 'never';
}
const closed = (reg, room, why, now) => {
  reg.rooms.delete(room.code);
  if (!room.arena) reg.gone.set(room.code, { at: now, why });
};

// THE ARENA (server/league.js) seats its second player itself: they were matched, not invited, and
// an arena room's code is not one anybody can type.
export function seat(reg, member, room) {
  leave(reg, member.id);
  attach(reg, member, room);
  return room;
}
function attach(reg, member, room) {
  room.members.push(member);
  reg.byMember.set(member.id, { member, room });
  delete room.emptySince;
  if (!room.members.some((m) => m.id === room.hostId)) room.hostId = room.members[0].id;
}

export function roomOf(reg, memberId) {
  return reg.byMember.get(memberId)?.room || null;
}

export function setReady(reg, memberId, ready) {
  const room = roomOf(reg, memberId);
  if (!room) return null;
  if (ready) room.ready.add(memberId);
  else room.ready.delete(memberId);
  return room;
}

// A lone host must never start: this is a 1v1, and "both ready" with one member would
// hand someone an empty pitch.
export function bothReady(room) {
  return room.members.length === ROOM_MAX && room.members.every((m) => room.ready.has(m.id));
}

// keepEmpty: a dropped connection, not a choice — a lobby left empty waits ROOM_GRACE_MS (sweep) instead of closing.
export function leave(reg, memberId, { keepEmpty = false, now = Date.now() } = {}) {
  const entry = reg.byMember.get(memberId);
  if (!entry) return null;
  const { room } = entry;
  reg.byMember.delete(memberId);
  room.members = room.members.filter((m) => m.id !== memberId);
  // Ready flags are per-member; a stale one would let the next joiner start unannounced.
  room.ready.delete(memberId);

  if (room.members.length === 0) {
    if (keepEmpty && room.phase === 'lobby' && !room.arena) room.emptySince = now;
    else closed(reg, room, 'closed', now);
    return room;
  }
  if (room.hostId === memberId) room.hostId = room.members[0].id;
  return room;
}

// The rooms left empty longer than the grace go (the server calls this every few seconds). Returns their codes.
export function sweep(reg, now = Date.now(), grace = ROOM_GRACE_MS) {
  const gone = [];
  for (const [code, room] of reg.rooms) {
    if (room.emptySince != null && !room.members.length && now - room.emptySince >= grace) { closed(reg, room, 'expired', now); gone.push(code); }
  }
  for (const [code, g] of reg.gone) if (now - g.at >= GONE_MS) reg.gone.delete(code);
  for (const [key, at] of reg.failed) if (now - at >= RETRY_MS) reg.failed.delete(key);
  return gone;
}
