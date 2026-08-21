// Dumb static server. The match runs entirely in the browser for now — this exists only so
// the phone on the LAN can load it, and so `/shared` is reachable from the client's imports.
// When this graduates to real 1v1, server.js becomes the authoritative host and `shared/sim.js`
// is already the thing both sides run.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { WebSocketServer } from 'ws';
import * as C from './shared/constants.js';
import { createMatch, step, serialize } from './shared/sim.js';
import { createBot, botInput } from './shared/bot.js';
import { createRegistry, createRoom, joinRoom, leave, setReady, bothReady, roomOf } from './shared/rooms.js';
import { createInputQueue, ingest, takeNext, unpackInput, encodeSnapshot } from './shared/net.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3020;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

// Only these two trees are served. Anything else 404s rather than walking the repo.
const ALLOWED = ['public', 'shared'];

const server = http.createServer((req, res) => {
  // Parse by hand: `new URL('//', base)` reads as protocol-relative and throws, and a
  // request line of `//` is exactly what a stray trailing slash in a curl sends.
  let rel = (req.url || '/').split('?')[0].split('#')[0];
  try { rel = decodeURIComponent(rel); } catch { /* keep the raw path */ }
  rel = '/' + rel.split('/').filter(Boolean).join('/');
  if (rel === '/') rel = '/index.html';

  // /shared/* maps to the repo's shared folder; everything else lives under /public.
  const first = rel.split('/')[1];
  const abs = ALLOWED.includes(first)
    ? path.join(ROOT, rel)
    : path.join(ROOT, 'public', rel);

  const safe = path.normalize(abs);
  if (!ALLOWED.some((d) => safe.startsWith(path.join(ROOT, d)))) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(safe, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(safe)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`⚽ head-soccer mock`);
  console.log(`   local   http://localhost:${PORT}`);
  for (const ip of nets) console.log(`   phone   http://${ip}:${PORT}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// ONLINE 1v1
//
// One global loop drives every room at the sim's own 60Hz and broadcasts every other tick
// (30Hz). Per-room setIntervals were the obvious alternative and the wrong one: Node timers
// are coarse, and N of them drift against each other, so two rooms on one box would run at
// visibly different speeds.
// ═══════════════════════════════════════════════════════════════════════════

const reg = createRegistry();
const wss = new WebSocketServer({ server, path: '/ws' });
let nextId = 1;

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const DEFAULT_CARD = { rarity: 'legendary', number: 3 };

function sanitizeCard(card) {
  const rarity = ['common', 'rare', 'epic', 'legendary'].includes(card?.rarity) ? card.rarity : DEFAULT_CARD.rarity;
  const number = Math.max(1, Math.min(45, Number(card?.number) || DEFAULT_CARD.number));
  return { rarity, number };
}

function roomView(room) {
  return {
    type: 'room',
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    members: room.members.map((m) => ({ id: m.id, name: m.name, card: m.card, ready: room.ready.has(m.id) })),
  };
}
const broadcast = (room, msg) => { for (const m of room.members) send(m.ws, msg); };

function startMatch(room) {
  const [a, b] = room.members;
  room.phase = 'match';
  room.match = createMatch(a.card, b.card, {});
  room.tick = 0;
  room.acc = 0;
  room.lastInput = [0, 0];
  for (const m of room.members) m.queue = createInputQueue();
  room.bots = [null, null];
  broadcast(room, {
    type: 'start',
    chars: [a.card, b.card],
    names: [a.name, b.name],
    duration: C.MATCH_DURATION,
  });
}

// A disconnect mid-match must not strand the player who stayed. The empty seat becomes a
// bot at the difficulty the abandoned player was already facing, and the match finishes.
function seatBot(room, index) {
  if (!room.bots) return;
  room.bots[index] = createBot(3);
  broadcast(room, { type: 'opponentLeft', index });
}

function stepRoom(room, dt) {
  const m = room.match;
  if (!m) return;
  room.acc += dt;
  let guard = 0;
  while (room.acc >= C.TICK && guard++ < 6) {
    room.acc -= C.TICK;
    const inputs = [{}, {}];
    for (let i = 0; i < 2; i++) {
      const member = room.members.find((mm) => mm.index === i);
      if (room.bots[i] || !member) {
        if (!room.bots[i]) seatBot(room, i);
        inputs[i] = botInput(room.bots[i], m, i, C.TICK);
      } else {
        const packed = takeNext(member.queue);
        room.lastInput[i] = packed;
        inputs[i] = unpackInput(packed);
      }
    }
    step(m, inputs);
    room.tick++;

    if (m.phase === 'over') {
      broadcast(room, { type: 'over', score: [m.score[0], m.score[1]] });
      room.phase = 'lobby';
      room.match = null;
      room.ready.clear();
      broadcast(room, roomView(room));
      return;
    }
    // 30Hz on the wire: the client sims at 60 and rolls forward between snapshots.
    if (room.tick % 2 === 0) {
      for (const member of room.members) {
        send(member.ws, encodeSnapshot(m, room.tick, room.lastInput[1 - member.index]));
      }
    }
  }
}

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  for (const room of [...reg.rooms.values()]) if (room.phase === 'match') stepRoom(room, dt);
}, 8);

wss.on('connection', (ws) => {
  const member = { id: 'p' + (nextId++), ws, name: 'שחקן', card: DEFAULT_CARD, index: 0, queue: createInputQueue() };
  send(ws, { type: 'welcome', id: member.id });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = roomOf(reg, member.id);

    switch (msg.type) {
      case 'hello':
        member.name = String(msg.name || 'שחקן').slice(0, 24);
        member.card = sanitizeCard(msg.card);
        if (room) broadcast(room, roomView(room));
        break;

      case 'create': {
        const r = createRoom(reg, member);
        if (r.error) { send(ws, { type: 'error', code: r.error }); break; }
        member.index = 0;
        send(ws, roomView(r.room));
        break;
      }

      case 'join': {
        const r = joinRoom(reg, member, msg.code);
        if (r.error) { send(ws, { type: 'error', code: r.error }); break; }
        // Seat by position: members[0] defends the left goal, members[1] the right.
        r.room.members.forEach((mm, i) => { mm.index = i; });
        broadcast(r.room, roomView(r.room));
        break;
      }

      case 'card':
        member.card = sanitizeCard(msg.card);
        if (room && room.phase === 'lobby') broadcast(room, roomView(room));
        break;

      case 'ready': {
        if (!room || room.phase !== 'lobby') break;
        setReady(reg, member.id, !!msg.v);
        broadcast(room, roomView(room));
        if (bothReady(room)) startMatch(room);
        break;
      }

      case 'input':
        if (room && room.phase === 'match') ingest(member.queue, msg.t0 | 0, msg.f);
        break;

      case 'leave': {
        if (!room) break;
        const wasMatch = room.phase === 'match';
        const idx = member.index;
        leave(reg, member.id);
        if (room.members.length) {
          if (wasMatch) seatBot(room, idx);
          broadcast(room, roomView(room));
        }
        break;
      }

      case 'ping':
        send(ws, { type: 'pong', t: msg.t });
        break;
    }
  });

  ws.on('close', () => {
    const room = roomOf(reg, member.id);
    if (!room) return;
    const wasMatch = room.phase === 'match';
    const idx = member.index;
    leave(reg, member.id);
    if (room.members.length) {
      if (wasMatch) seatBot(room, idx);
      broadcast(room, roomView(room));
    }
  });
});

console.log(`   ws      /ws  (online 1v1, ${C.MATCH_DURATION}s matches)`);
