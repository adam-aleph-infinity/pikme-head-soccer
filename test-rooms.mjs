// Room registry tests. Pure — no socket, no timers. Run: node test-rooms.mjs
import { createRegistry, genCode, createRoom, joinRoom, leave, setReady, bothReady, sweep, ROOM_GRACE_MS, CODE_ALPHABET, GONE_MS, RETRY_MS }
  from './shared/rooms.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const member = (id, name = id) => ({ id, name, card: { rarity: 'legendary', number: 3 } });

// --- codes ------------------------------------------------------------------
{
  const seen = new Set();
  let rng = 0;
  for (let i = 0; i < 400; i++) {
    const c = genCode(() => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648, () => false);
    seen.add(c);
    ok('code is 4 chars', c.length === 4, c);
    ok('code uses the unambiguous alphabet', [...c].every((ch) => CODE_ALPHABET.includes(ch)), c);
  }
  ok('codes vary', seen.size > 50, `${seen.size} distinct of 400`);
}
{
  // Nothing that can be misread aloud or over a bad photo of a screen.
  for (const bad of ['0', 'O', '1', 'I', '5', 'S']) {
    ok(`alphabet excludes ${bad}`, !CODE_ALPHABET.includes(bad));
  }
}
{
  const taken = new Set(['AAAA']);
  const c = genCode(() => 0, (code) => taken.has(code));   // rng=0 always yields the first letter
  ok('genCode avoids a taken code', c !== 'AAAA', c);
}

// --- create / join ----------------------------------------------------------
{
  const reg = createRegistry();
  const r = createRoom(reg, member('h'));
  ok('createRoom returns a room', !!r.room && !r.error);
  ok('the creator is the host', r.room.hostId === 'h');
  ok('the creator is in the room', r.room.members.length === 1);
  ok('a new room is in the lobby', r.room.phase === 'lobby');
  ok('the registry knows the room', reg.rooms.get(r.room.code) === r.room);
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  const j = joinRoom(reg, member('g'), room.code);
  ok('a code joins straight in', !j.error && j.room === room, j.error);
  ok('the room now has two', room.members.length === 2);
  ok('the guest is not host', room.hostId === 'h');
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  ok('a lowercase code still joins', !joinRoom(reg, member('g'), room.code.toLowerCase()).error);
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  ok('a code with spaces still joins', !joinRoom(reg, member('g'), ` ${room.code} `).error);
}
{
  const reg = createRegistry();
  ok('an unknown code is rejected', joinRoom(reg, member('g'), 'ZZZZ').error === 'not-found');
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  joinRoom(reg, member('g'), room.code);
  ok('a third player is refused', joinRoom(reg, member('x'), room.code).error === 'full');
  ok('the room stays at two', room.members.length === 2);
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  joinRoom(reg, member('g'), room.code);
  room.phase = 'match';
  ok('you cannot join a live match', joinRoom(reg, member('x'), room.code).error === 'in-match');
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  // Joining a second room drops you out of the first, or you exist twice.
  const { room: r2 } = createRoom(reg, member('g'));
  joinRoom(reg, reg.byMember.get('h').member, r2.code);
  ok('joining elsewhere leaves the old room', !reg.rooms.has(room.code) || room.members.length === 0);
  ok('the player is only in the new room', r2.members.length === 2);
}

// --- ready / start ----------------------------------------------------------
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  joinRoom(reg, member('g'), room.code);
  ok('nobody is ready to begin with', !bothReady(room));
  setReady(reg, 'h', true);
  ok('one ready is not enough', !bothReady(room));
  setReady(reg, 'g', true);
  ok('both ready starts it', bothReady(room));
  setReady(reg, 'g', false);
  ok('un-readying un-starts it', !bothReady(room));
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  setReady(reg, 'h', true);
  ok('a solo host is never both-ready', !bothReady(room), 'a lone player must not start a 1v1');
}

// --- leaving ----------------------------------------------------------------
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  joinRoom(reg, member('g'), room.code);
  leave(reg, 'h');
  ok('the room survives the host leaving', reg.rooms.has(room.code));
  ok('host passes to the survivor', room.hostId === 'g');
  ok('only one member left', room.members.length === 1);
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  leave(reg, 'h');
  ok('an empty room is destroyed', !reg.rooms.has(room.code));
  ok('the member index is cleaned up', !reg.byMember.has('h'));
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, member('h'));
  joinRoom(reg, member('g'), room.code);
  setReady(reg, 'g', true);
  leave(reg, 'g');
  joinRoom(reg, member('g2'), room.code);
  ok('a freed slot can be re-filled', room.members.length === 2);
  ok("the leaver's ready flag does not linger", !bothReady(room));
}
{
  const reg = createRegistry();
  ok('leaving nothing is harmless', leave(reg, 'nobody') === null);
}

// --- a dropped phone (2026-10-22): the room waits for it ------------------------
const phone = (id, pid) => ({ ...member(id), pid });
{
  const reg = createRegistry();
  const { room } = createRoom(reg, phone('h', 'dev-h'));
  leave(reg, 'h', { keepEmpty: true, now: 1000 });
  ok('a host whose connection dropped keeps the room', reg.rooms.has(room.code) && room.members.length === 0);
  const r = joinRoom(reg, phone('g', 'dev-g'), room.code);
  ok('…the friend can still join it', !r.error && room.members.length === 1 && room.hostId === 'g', JSON.stringify(r.error));
  const back = joinRoom(reg, phone('h2', 'dev-h'), room.code);
  ok('…and the host comes back to it on a new connection', !back.error && room.members.length === 2 && room.members.map((m) => m.id).join() === 'g,h2');
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, phone('h', 'dev-h'));
  joinRoom(reg, phone('g', 'dev-g'), room.code);
  // the host's old socket has not closed yet (a phone in the background): its new one takes its own seat
  const back = joinRoom(reg, phone('h2', 'dev-h'), room.code);
  ok('the same phone on a new connection replaces its old seat, not "full"', !back.error && room.members.length === 2 && !reg.byMember.has('h') && reg.byMember.has('h2'));
  ok('…a different phone is still turned away', joinRoom(reg, phone('x', 'dev-x'), room.code).error === 'full');
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, phone('h', 'dev-h'));
  leave(reg, 'h', { keepEmpty: true, now: 1000 });
  ok('a waiting room is not swept early', sweep(reg, 1000 + ROOM_GRACE_MS - 1).length === 0 && reg.rooms.has(room.code));
  ok('…and goes after the grace', sweep(reg, 1000 + ROOM_GRACE_MS)[0] === room.code && !reg.rooms.has(room.code));
  ok('the grace is a few minutes', ROOM_GRACE_MS >= 60000 && ROOM_GRACE_MS <= 10 * 60000);
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, phone('h', 'dev-h'));
  leave(reg, 'h', { keepEmpty: true, now: 1000 });
  joinRoom(reg, phone('g', 'dev-g'), room.code);
  ok('a room someone came back to is never swept', sweep(reg, 1000 + 10 * ROOM_GRACE_MS).length === 0 && reg.rooms.has(room.code));
}
{
  const reg = createRegistry();
  const { room } = createRoom(reg, phone('h', 'dev-h'));
  leave(reg, 'h');
  ok('leaving on purpose still closes the room at once', !reg.rooms.has(room.code));
  const m = createRoom(reg, phone('a', 'dev-a')).room;
  m.phase = 'match';
  leave(reg, 'a', { keepEmpty: true });
  ok('only a lobby waits: a room left empty mid-match closes', !reg.rooms.has(m.code));
}

// --- code exhaustion --------------------------------------------------------
{
  const reg = createRegistry();
  // Fill every possible code, then prove createRoom fails loudly instead of hanging.
  const total = CODE_ALPHABET.length ** 4;
  ok('the code space is big enough to be worth having', total > 100000, String(total));
  const c = genCode(Math.random, () => true, 12);   // every candidate "taken"
  ok('genCode gives up rather than looping forever', c === null);
  const r = createRoom(reg, member('h'), () => null);
  ok('createRoom surfaces exhaustion', r.error === 'no-codes', JSON.stringify(r));
}

// --- why a join found no room (2026-11-20) ---------------------------------
// Live: 282 not-found joins against 240 rooms. The registry now tells a typo from a room that is gone, and a
// repeat by the same player from a new failure, so each kid's failure is counted once as its cause.
{
  const reg = createRegistry();
  const t0 = 1e12;
  const why = (who, code, now = t0) => joinRoom(reg, who, code, now).why;
  const f = phone('f', 'dev-f'), g = phone('g', 'dev-g');
  ok('a code nobody ever made is "never"', why(f, 'ZZZZ') === 'never');
  ok('…the same player with the same code again is a "retry"', why(f, 'ZZZZ', t0 + 1000) === 'retry');
  ok('…again on a new connection of the same phone, still a "retry"', why({ ...phone('f2', 'dev-f') }, 'zzzz', t0 + 2000) === 'retry');
  ok('…another player with that code is their own first failure', why(g, 'ZZZZ', t0 + 3000) === 'never');
  ok('…and long after, the same player\'s try counts fresh', why(f, 'ZZZZ', t0 + 3000 + RETRY_MS + 1) === 'never');

  const closedRoom = createRoom(reg, phone('h', 'dev-h')).room;
  leave(reg, 'h', { now: t0 });
  ok('the host left on purpose: a friend\'s join is "closed"', why(phone('k', 'dev-k'), closedRoom.code, t0 + 5000) === 'closed');

  const swept = createRoom(reg, phone('h2', 'dev-h2')).room;
  leave(reg, 'h2', { keepEmpty: true, now: t0 });
  ok('within the grace the room is still there', joinRoom(reg, phone('k2', 'dev-k2'), swept.code, t0 + 1000).room === swept);
  leave(reg, 'k2', { keepEmpty: true, now: t0 + 1000 });
  sweep(reg, t0 + 1000 + ROOM_GRACE_MS);
  ok('the grace ran out: the host coming back is "expired"', why(phone('h2b', 'dev-h2'), swept.code, t0 + 1000 + ROOM_GRACE_MS + 10) === 'expired');
  ok('…and its next return is a "retry", not a second failure', why(phone('h2c', 'dev-h2'), swept.code, t0 + 1000 + ROOM_GRACE_MS + 20) === 'retry');

  // a closed code is not handed out again while it is remembered, then is forgotten
  const reuse = createRoom(reg, phone('r', 'dev-r'), (rng, taken) => [closedRoom.code, 'NEWW'].find((c) => !taken(c)) || null);
  ok('a code that just closed is not handed out again', reuse.room?.code === 'NEWW', JSON.stringify(reuse.error));
  leave(reg, 'r', { now: t0 });
  sweep(reg, t0 + 2 * GONE_MS);
  ok('…the closed codes are forgotten after a day', reg.gone.size === 0, [...reg.gone.keys()].join());
  ok('…and so are the failures', reg.failed.size === 0, String(reg.failed.size));
  ok('a forgotten code is "never" again', why(phone('z', 'dev-z'), closedRoom.code, t0 + 2 * GONE_MS + 1) === 'never');

  // a re-made code is a live room, not "gone"
  const reg2 = createRegistry();
  const a = createRoom(reg2, phone('a', 'dev-a'), () => 'ABCD').room;
  leave(reg2, 'a');
  reg2.gone.clear();                                  // as if the day passed
  createRoom(reg2, phone('b', 'dev-b'), () => 'ABCD');
  ok('a code made again is a room again', !reg2.gone.has('ABCD') && joinRoom(reg2, phone('c', 'dev-c'), 'ABCD').room?.code === a.code);

  // the arena's rooms are never typed, so they are never remembered
  const reg3 = createRegistry();
  const ar = createRoom(reg3, phone('x', 'dev-x'), () => 'arena-1').room;
  ar.arena = true; leave(reg3, 'x');
  ok('an arena room leaves nothing behind', reg3.gone.size === 0);
}
{
  const { ROOM_FAILS } = await import('./shared/play-stats.js');
  ok('the stats know every reason', ['never', 'closed', 'expired', 'retry'].every((w) => ROOM_FAILS.includes(`not-found:${w}`)) && ROOM_FAILS.includes('not-found'));
}

console.log(`test-rooms: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
