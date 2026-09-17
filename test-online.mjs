// Online protocol tests against a REAL server on a throwaway port. Fast (~6s): it proves the
// handshake, seating, start, snapshot flow, input effect and bot backfill. The full-match
// convergence run lives in `_soak.mjs`, which is too slow to sit in `npm test`.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { unpackInput, packInput, decodeSnapshot } from './shared/net.js';

let PORT;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const srv = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: '0', RENDER_GIT_COMMIT: 'c'.repeat(40) }, stdio: ['ignore', 'pipe', 'inherit'],
});
// Let the OS allocate a port so another checkout's tests cannot silently answer ours.
const listening = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Test server did not start')), 10000);
  let output = '';
  srv.stdout.on('data', (chunk) => {
    output += chunk;
    const match = output.match(/local\s+http:\/\/localhost:(\d+)/);
    if (match) { PORT = Number(match[1]); clearTimeout(timer); resolve(); }
  });
  srv.once('error', (error) => { clearTimeout(timer); reject(error); });
  srv.once('exit', () => { clearTimeout(timer); reject(new Error('Test server exited')); });
});
const die = (code) => { try { srv.kill(); } catch {} process.exit(code); };
process.on('uncaughtException', (e) => { console.log('  ✗ threw:', e.message); die(1); });

// --- a tiny client: same wire protocol the browser speaks -------------------
function client(name, card) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const c = { ws, name, card, id: null, room: null, started: null, snaps: [], over: null, oppLeft: false, tick: 0, msgs: [] };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type) c.msgs.push(m.type);
    if (m.type === 'welcome') c.id = m.id;
    else if (m.type === 'room') c.room = m;
    else if (m.type === 'start') c.started = m;
    else if (m.type === 'over') c.over = m;
    else if (m.type === 'opponentLeft') c.oppLeft = true;
    else if (m.t !== undefined && m.s) c.snaps.push(decodeSnapshot(m));
  };
  c.send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  c.open = new Promise((r) => { ws.onopen = r; });
  return c;
}
const until = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(50); }
  return false;
};

await listening;

const version = await fetch(`http://127.0.0.1:${PORT}/version`);
ok('version identifies the running commit', (await version.json()).commit === 'c'.repeat(40));
ok('version cannot be cached', version.headers.get('cache-control') === 'no-store');

const A = client('אדם', { rarity: 'legendary', number: 3 });
const B = client('חבר', { rarity: 'epic', number: 7 });
await Promise.all([A.open, B.open]);
ok('both clients connect', true);
await until(() => A.id && B.id);
ok('each gets an id', !!A.id && !!B.id && A.id !== B.id, `${A.id} / ${B.id}`);

// --- create + join ----------------------------------------------------------
A.send({ type: 'hello', name: A.name, card: A.card });
A.send({ type: 'create' });
ok('host gets a room', await until(() => A.room), 'no room message');
const code = A.room?.code;
ok('the code is 4 chars', code?.length === 4, code);

B.send({ type: 'hello', name: B.name, card: B.card });
B.send({ type: 'join', code });
ok('the guest joins by code', await until(() => B.room?.members?.length === 2), JSON.stringify(B.room));
ok('the host is told someone joined', await until(() => A.room?.members?.length === 2));
ok('both see the same room', A.room.code === B.room.code);
ok('names cross over', A.room.members.map((m) => m.name).join() === 'אדם,חבר', A.room.members.map((m) => m.name).join());
ok('cards cross over', A.room.members[1].card.rarity === 'epic' && A.room.members[1].card.number === 7);
ok('the host is the creator', A.room.hostId === A.id);

// --- a bad code -------------------------------------------------------------
{
  const C3 = client('ג', { rarity: 'rare', number: 1 });
  await C3.open;
  C3.send({ type: 'join', code: 'ZZZZ' });
  ok('an unknown code errors', await until(() => C3.msgs.includes('error')));
  C3.send({ type: 'join', code });
  ok('a third player is refused', await until(() => C3.msgs.filter((t) => t === 'error').length >= 2));
  C3.ws.close();
}

// --- ready → start ----------------------------------------------------------
A.send({ type: 'ready', v: true });
await sleep(200);
ok('one ready does not start it', !A.started && !B.started);
B.send({ type: 'ready', v: true });
ok('both ready starts it', await until(() => A.started && B.started), 'no start message');
ok('both are told the same lineup', JSON.stringify(A.started.chars) === JSON.stringify(B.started.chars));
ok('the lineup matches the picks',
   A.started.chars[0].number === 3 && A.started.chars[1].number === 7, JSON.stringify(A.started.chars));

// --- snapshots --------------------------------------------------------------
ok('snapshots arrive', await until(() => A.snaps.length > 5 && B.snaps.length > 5),
   `A=${A.snaps.length} B=${B.snaps.length}`);
{
  const t = A.snaps.map((s) => s.tick);
  ok('snapshot ticks advance', t.every((v, i) => i === 0 || v > t[i - 1]), t.slice(0, 6).join(','));
  ok('snapshots are ~30Hz', t[1] - t[0] === 2, `stride ${t[1] - t[0]} sim ticks`);
  ok('a snapshot carries a full state', !!A.snaps[0].state.p && A.snaps[0].state.p.length === 2);
}

// --- input actually moves the player ---------------------------------------
{
  // Input is ignored during the kickoff freeze. Measuring across it read as "the player
  // never moved" while the server was in fact perfectly fine.
  ok('the kickoff freeze ends', await until(() => A.snaps.at(-1)?.state.phase === 'play', 4000),
     `phase=${A.snaps.at(-1)?.state.phase}`);

  const before = A.snaps.at(-1).state.p[0][0];       // P_FIELDS[0] === 'x'
  const RIGHT = packInput({ right: true });
  let seq = 0;
  for (let k = 0; k < 12; k++) {
    A.send({ type: 'input', t0: seq, f: [RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT] });
    seq += 6;                                        // the tick is a SEQUENCE number, not a clock
    await sleep(50);
  }
  const after = A.snaps.at(-1).state.p[0][0];
  ok('my input moves MY player', after > before + 20, `x ${before.toFixed(0)} → ${after.toFixed(0)}`);
  ok('the other client sees it too', Math.abs(B.snaps.at(-1).state.p[0][0] - after) < 120,
     `A=${after.toFixed(0)} B=${B.snaps.at(-1).state.p[0][0].toFixed(0)}`);
}

// --- both clients agree on the world ---------------------------------------
{
  const a = A.snaps.at(-1), b = B.snaps.at(-1);
  ok('both clients are on the same match', Math.abs(a.tick - b.tick) <= 4, `${a.tick} vs ${b.tick}`);
  ok('both see the same score', a.state.score.join() === b.state.score.join());
}

// --- a disconnect hands the seat to a bot ----------------------------------
{
  const n0 = A.snaps.length;
  B.ws.close();
  ok('the survivor is told', await until(() => A.oppLeft), 'no opponentLeft');
  await sleep(700);
  ok('the match keeps running', A.snaps.length > n0 + 5, `${A.snaps.length - n0} more snapshots`);
  // Sample ACROSS the window, not just the two ends. A bot that steps out to meet the ball
  // and comes back is at the same x 900ms later and read as "nobody is driving the seat" —
  // this check failed roughly one run in five on that alone, with the seat visibly kicking
  // in the very snapshot that condemned it. (Same fix, same reason, as the "the ball got
  // moved by play" probe in _shot.mjs.)
  const mark = A.snaps.length - 1;
  await sleep(900);
  const xs = A.snaps.slice(mark).map((s) => s.state.p[1][0]);
  const swing = Math.max(...xs) - Math.min(...xs);
  ok('a bot is actually playing the empty seat', swing > 5,
     `moved ${swing.toFixed(0)}px across ${xs.length} snapshots`);
}

A.ws.close();
await sleep(300);
console.log(`test-online: ${pass} passed, ${fail} failed`);
die(fail ? 1 : 0);
