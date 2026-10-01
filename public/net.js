// Client networking: socket, prediction, rollback reconciliation.
//
// The client runs the SAME `shared/sim.js` the server runs, at the same 60Hz. Every tick it
// steps locally with its own input and the opponent's last known input. When a 30Hz snapshot
// arrives it restores to that authoritative state and replays its own buffered inputs
// forward to the present.
//
// Interpolating the ball instead would have been simpler, and wrong: in this game your boot
// hits the ball constantly, and interpolation puts every one of your own kicks a full
// round-trip behind your foot. Rollback is affordable here because the state is ~600 bytes
// and re-stepping 30 ticks of this sim costs microseconds.

import * as C from '../shared/constants.js';
import { createMatch, step, restore } from '../shared/sim.js';
import { packInput, unpackInput, decodeSnapshot, PROTOCOL } from '../shared/net.js';

const BUFFER = 240;             // ticks of local input kept for replay (~4s)
const SEND_HZ = 30;
const REDUNDANCY = 6;           // frames re-sent per packet, so one lost packet costs nothing

export function createNet({ onRoom, onStart, onOver, onError, onStatus, onOpponentLeft, onOnline }) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const net = {
    ws: null, id: null, room: null, match: null,
    live: false,                // is a match actually in progress — see pump
    you: 0, tick: 0, acc: 0,
    inputs: new Map(),          // tick -> packed input (mine)
    oppInput: 0,
    lastSnap: null,
    rtt: 0, status: 'connecting',
    connected: false,
    online: null,               // players with the game open right now, any mode (server count)
  };

  const setStatus = (s) => { net.status = s; onStatus?.(s); };

  let retry = 0;
  function connect() {
    setStatus('connecting');
    const ws = new WebSocket(url);
    net.ws = ws;
    ws.onopen = () => { net.connected = true; retry = 0; setStatus('online'); pingLoop(); };
    // Every page holds this socket from boot, arcade included: it is how the server counts who
    // has the game open. So a dropped one (a deploy, a phone waking up) comes back by itself,
    // backing off to 30s against a server that is not there.
    ws.onclose = () => {
      if (net.ws !== ws) return;
      net.connected = false; setStatus('offline');
      setTimeout(connect, Math.min(30000, 2000 * 2 ** retry++));
    };
    ws.onerror = () => { setStatus('offline'); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handle(msg);
    };
  }

  function handle(msg) {
    switch (msg.type) {
      case 'welcome': net.id = msg.id; break;
      case 'room':
        net.room = msg;
        net.you = Math.max(0, msg.members.findIndex((m) => m.id === net.id));
        onRoom?.(msg);
        break;
      case 'error': onError?.(msg.code); break;
      case 'start': {
        net.match = createMatch(msg.chars[0], msg.chars[1], { duration: msg.duration });
        net.live = true;
        net.tick = 0; net.acc = 0;
        net.inputs.clear();
        net.oppInput = 0;
        net.lastSnap = null;
        onStart?.(msg);
        break;
      }
      case 'opponentLeft': onOpponentLeft?.(msg.index); break;
      case 'over': net.live = false; onOver?.(msg.score); break;
      case 'online': net.online = msg.n; onOnline?.(msg.n); break;
      case 'pong': net.rtt = Math.round(performance.now() - msg.t); break;
      default:
        // Snapshots are the hot path and carry no `type` — they are {t, i, s}.
        if (msg.t !== undefined && msg.s) applySnapshot(msg);
    }
  }

  // ---- the whole point of this file ---------------------------------------
  function applySnapshot(wire) {
    const snap = decodeSnapshot(wire);
    if (!net.match) return;
    if (net.lastSnap && snap.tick <= net.lastSnap) return;    // out-of-order UDP-ish arrival
    net.lastSnap = snap.tick;
    net.oppInput = snap.oppInput;

    restore(net.match, snap.state);

    // Replay MY inputs from the snapshot's tick up to where I already am. The opponent's
    // input is held constant across the replay — for a five-button game that guess is right
    // far more often than not, and a wrong one is corrected by the very next snapshot.
    const target = net.tick;
    for (let t = snap.tick; t < target; t++) {
      stepOnce(t, net.inputs.get(t) ?? 0, snap.oppInput);
    }
    net.match.events.length = 0;   // replayed events already fired locally; do not re-fire
    // Anything older than the snapshot can never be replayed again.
    for (const t of [...net.inputs.keys()]) if (t < snap.tick - 2) net.inputs.delete(t);
  }

  function stepOnce(tick, myPacked, oppPacked) {
    const mine = unpackInput(myPacked);
    const theirs = unpackInput(oppPacked);
    const ins = net.you === 0 ? [mine, theirs] : [theirs, mine];
    step(net.match, ins, C.TICK);
  }

  // Advance the local sim. Called from the render loop with real dt; returns the match so
  // the renderer can draw it.
  function advance(dt, held, fx) {
    if (!net.match) return null;
    net.acc += dt;
    let guard = 0;
    while (net.acc >= C.TICK && guard++ < 8) {
      net.acc -= C.TICK;
      // `held` may be a function: the client's per-tick input, which remembers a tap that came
      // and went between two ticks (tickInput in game.js) and has to be asked once per tick.
      const packed = packInput(typeof held === 'function' ? held() : held);
      net.inputs.set(net.tick, packed);
      if (net.inputs.size > BUFFER) {
        const oldest = net.tick - BUFFER;
        for (const t of [...net.inputs.keys()]) if (t < oldest) net.inputs.delete(t);
      }
      const mine = unpackInput(packed);
      const theirs = unpackInput(net.oppInput);
      const ins = net.you === 0 ? [mine, theirs] : [theirs, mine];
      step(net.match, ins, C.TICK, fx);
      net.tick++;
    }
    return net.match;
  }

  // ---- outbound ------------------------------------------------------------
  const sendMsg = (m) => { if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(m)); };

  // Every packet re-sends the last REDUNDANCY frames. Bandwidth is irrelevant at this size
  // and it means a single dropped packet never leaves a hole in the input stream — which,
  // for edge-triggered inputs like dash, is the difference between working and not.
  let sendTimer = 0;
  function pump() {
    // `net.match` is never cleared once a match has started — it is what advance() replays
    // from — so guarding on it alone meant this kept serialising and sending an input packet
    // SEND_HZ times a second for the rest of the page session: on the card screen, through
    // every later bot match, on the over screen. On a phone that is a main-thread stringify
    // and a radio wake-up thirty times a second, forever, for a match that finished minutes
    // ago. `live` tracks whether a match is actually in progress; the sim path is untouched.
    if (!net.live || !net.match) return;
    const t0 = Math.max(0, net.tick - REDUNDANCY);
    const f = [];
    for (let t = t0; t < net.tick; t++) f.push(net.inputs.get(t) ?? 0);
    if (f.length) sendMsg({ type: 'input', t0, f });
  }
  setInterval(pump, 1000 / SEND_HZ);

  function pingLoop() {
    sendMsg({ type: 'ping', t: performance.now() });
    // 2s in a room (the RTT readout); otherwise a 25s keep-alive, so an idle arcade page is
    // not waking the phone's radio every two seconds just to be counted.
    setTimeout(() => { if (net.connected) pingLoop(); }, net.room || net.live ? 2000 : 25000);
  }

  Object.assign(net, {
    connect,
    hello: (name, card) => sendMsg({ type: 'hello', name, card, v: PROTOCOL }),
    create: () => sendMsg({ type: 'create' }),
    join: (code) => sendMsg({ type: 'join', code }),
    setCard: (card) => sendMsg({ type: 'card', card }),
    ready: (v) => sendMsg({ type: 'ready', v }),
    leave: () => { net.live = false; sendMsg({ type: 'leave' }); },
    advance,
  });
  return net;
}
