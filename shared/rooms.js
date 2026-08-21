// Private-room registry for online 1v1. Pure: no sockets, no timers, no I/O — the server
// owns transport and calls into this. That split is what makes `test-rooms.mjs` possible.
//
// There is no host-accept step on purpose. The 4-char code IS the permission: you only have
// it because the host sent you the link. Football needs accept/reject because it matchmakes
// strangers into public lobbies; this only ever admits someone you invited.

// No 0/O, 1/I, 5/S — the code gets read aloud, typed by a kid, or screenshotted badly.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';   // no O/I/S, no 0/1/5
const ROOM_MAX = 2;

export function createRegistry() {
  return {
    rooms: new Map(),        // code -> room
    byMember: new Map(),     // memberId -> { member, room }
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
  const code = gen(Math.random, (c) => reg.rooms.has(c));
  if (!code) return { error: 'no-codes' };
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

export function joinRoom(reg, member, code) {
  const room = reg.rooms.get(normalizeCode(code));
  if (!room) return { error: 'not-found' };
  if (room.phase !== 'lobby') return { error: 'in-match' };
  if (room.members.length >= ROOM_MAX) return { error: 'full' };
  leave(reg, member.id);
  attach(reg, member, room);
  return { room };
}

function attach(reg, member, room) {
  room.members.push(member);
  reg.byMember.set(member.id, { member, room });
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

export function leave(reg, memberId) {
  const entry = reg.byMember.get(memberId);
  if (!entry) return null;
  const { room } = entry;
  reg.byMember.delete(memberId);
  room.members = room.members.filter((m) => m.id !== memberId);
  // Ready flags are per-member; a stale one would let the next joiner start unannounced.
  room.ready.delete(memberId);

  if (room.members.length === 0) {
    reg.rooms.delete(room.code);
    return room;
  }
  if (room.hostId === memberId) room.hostId = room.members[0].id;
  return room;
}
