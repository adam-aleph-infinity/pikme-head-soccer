// THE LEAGUE — the arena and the teams' week, run where nobody can touch them (docs/TEAMS-ARENA.md).
//
// The rules are shared/arena.js and shared/teams.js; the memory is server/store.js. This file is the
// referee: it finds opponents, starts arena matches in rooms of their own (server.js runs them, as it
// runs every online match), and when one ends it reads the score off its OWN sim and pays the
// trophies. A client never says how a match went, how many trophies it has, or what its team won.
//
//   queue → found (the VS card, VS_MS) → start → over / a player leaves → arenaResult + profile
//   No human in BOT_AFTER: a CPU with a made-up player's name (Idan), at your trophies and level.
//   Leaving a match loses it, and the player left behind wins at once. Leaving during the VS card
//   is no match at all: the other player goes back to searching, with the time already waited.
//
// THE WEEK: every finished arena match is written to its week (when the week is in play) for the
// team the player started that week on. At Saturday 20:00 the week is decided once and saved, and
// every player is told on their next connection — paid if they played, told how to next time if not.
import * as A from '../shared/arena.js';
import * as T from '../shared/teams.js';

export function createLeague({ store, reg, send, startMatch, createBot, createRoom, seat, leave,
  clock = Date.now, rnd = Math.random, botAfter = A.BOT_AFTER, vsMs = A.VS_MS, dev = false, live = false }) {
  // `live` off (Idan, 2026-10-09, until the arenas are finished): the arena is PRACTICE — real
  // matches against other kids (or the CPU), but no trophies, no daily bonus, no road, no team
  // week. The profile says so and the client labels it "זירת אימון · הגביעים בקרוב".
  let offset = 0;                                  // dev: the clock moved on (endWeek)
  const now = () => clock() + offset;
  const queue = new Map();                         // member.id → { member, pid, trophies, since }
  const players = new Set();                       // connected members that said who they are
  let seq = 0, lastFinal = 0;

  // the team a player counts for in week `w` (a switch counts from the next Sunday)
  const teamIn = (p, w) => (!p?.team ? null : !p.team_from || w >= p.team_from ? p.team : (p.prev_team || p.team));
  const STAND_TTL = 10000;
  let stand = { week: null, at: 0, rows: null };
  function standingsOf(week) {
    const fin = store.week(week);
    if (fin) return fin.standings;
    const t = clock();
    if (stand.week !== week || t - stand.at > STAND_TTL) stand = { week, at: t, rows: T.standings(store.weekRows(week)) };
    return stand.rows;
  }
  const fresh = () => { stand.week = null; };

  function profileOf(p) {
    const t = now(), w = T.weekOf(t), day = T.dayOf(t), row = store.weekRow(w.id, p.id);
    const last = store.lastWeekBefore(w.id);
    return {
      type: 'profile', now: t, live,
      trophies: p.trophies, best: p.best, arena: A.arenaOf(p.trophies).n, road: p.road,
      daily: { day, wins: store.dayWins(day, p.id) },
      starter: p.starter, team: p.team, switched: !!p.switched,
      rank: store.rank(p.trophies), total: Math.max(1, store.total()),
      week: !live ? null : {
        id: w.id, phase: w.phase, end: w.end, next: w.next,
        standings: standingsOf(w.id),
        me: { team: teamIn(p, w.id), played: row?.played || 0, wins: row?.wins || 0, won: row?.won || 0, counted: Math.min(T.CAP, row?.won || 0) },
      },
      last: live && last ? { week: last.week, winner: last.standings.find((s) => s.rank === 1 && s.active)?.team || null } : null,
    };
  }
  const sendProfile = (member, p = store.player(member.pid)) => { if (p && member?.ws) send(member.ws, profileOf(p)); };

  // ── WHO YOU ARE ──
  function hello(member, msg) {
    if (!T.isDeviceId(msg.id)) return;
    const t = now(), w = T.weekOf(t).id;
    const starter = Number.isInteger(msg.starter) && T.isTeam(msg.starter) ? msg.starter : null;
    let p = store.ensure(msg.id, starter, w, t);
    if (!p.starter && starter) p = store.setStarter(msg.id, starter, w);
    member.pid = msg.id;
    players.add(member);
    sendProfile(member, p);
    offerPrize(member, p);
  }
  function gone(member) { players.delete(member); queue.delete(member.id); }

  // ── FINDING A MATCH ──
  function enqueue(member) {
    const p = member.pid && store.player(member.pid);
    if (!p) { send(member.ws, { type: 'error', code: 'no-id' }); return; }
    if (!p.starter) { send(member.ws, { type: 'error', code: 'no-starter' }); return; }
    if (reg.byMember.has(member.id)) {
      const r = reg.byMember.get(member.id).room;
      if (r.arena) return;                         // already matched
      leave(reg, member.id);                       // out of a friend's lobby first
    }
    // your card: your own Mythic or an album card — never somebody else's Mythic
    if (member.card?.rarity === 'mythic' && member.card.number !== p.starter) member.card = { rarity: 'mythic', number: p.starter };
    queue.set(member.id, { member, pid: p.id, trophies: p.trophies, since: queue.get(member.id)?.since ?? now() });
    send(member.ws, { type: 'queued', trophies: p.trophies });
  }
  function unqueue(member) { queue.delete(member.id); }

  function tick() {
    const t = now();
    const list = [...queue.values()].sort((a, b) => a.since - b.since);
    const used = new Set();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (used.has(a)) continue;
      if (a.member.ws.readyState !== 1) { queue.delete(a.member.id); continue; }
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (used.has(b) || b.pid === a.pid || b.member.ws.readyState !== 1) continue;
        if (A.canPair(a, b, t)) { used.add(a); used.add(b); queue.delete(a.member.id); queue.delete(b.member.id); found(a, b); break; }
      }
    }
    for (const a of [...queue.values()]) if (!used.has(a) && t - a.since >= botAfter) { queue.delete(a.member.id); found(a, null); }
    if (clock() - lastFinal > 15000) finalizeWeeks();
  }

  // a match is made: its own room, the VS card for both, kick-off VS_MS later
  function found(a, b) {
    const pa = store.player(a.pid), pb = b && store.player(b.pid);
    const bot = b ? null : A.botFor(pa.trophies, pa.loss_streak, rnd);
    const { room } = createRoom(reg, a.member, () => `arena-${++seq}`);
    if (b) seat(reg, b.member, room);
    room.members.forEach((m, i) => { m.index = i; });
    const tA = pa.trophies, tB = b ? pb.trophies : bot.trophies;
    const arena = A.arenaOf(Math.max(tA, tB));
    room.arena = {
      pids: [pa.id, pb?.id || null],
      trophies: [tA, tB],
      cards: [a.member.card, b ? b.member.card : { rarity: 'mythic', number: bot.starter }],
      names: [a.member.name, b ? b.member.name : bot.name],
      teams: [teamIn(pa, T.weekOf(now()).id), b ? teamIn(pb, T.weekOf(now()).id) : bot.starter],
      bot, stage: arena.stage, arena: arena.n,
      waited: [a.since, b?.since],
      done: false,
    };
    const ar = room.arena;
    for (const m of room.members) {
      const i = m.index, o = 1 - i;
      send(m.ws, { type: 'found', you: i, arena: ar.arena, stage: ar.stage, practice: !live,
        me: { trophies: ar.trophies[i], team: ar.teams[i] },
        opp: { name: ar.names[o], card: ar.cards[o], team: ar.teams[o], trophies: ar.trophies[o] } });
    }
    ar.timer = setTimeout(() => {
      ar.timer = null;
      if (ar.done || !reg.rooms.has(room.code)) return;
      startMatch(room, { cards: ar.cards, names: ar.names, bots: [null, bot ? createBot(bot.level) : null], extra: { arena: { n: ar.arena, stage: ar.stage } } });
    }, vsMs);
  }

  // ── THE END OF A MATCH ──
  function over(room, score) {
    const ar = room.arena;
    if (!ar || ar.done) return;
    ar.done = true;
    const res = (i) => (score[i] > score[1 - i] ? 'win' : score[i] < score[1 - i] ? 'loss' : 'draw');
    const tell = [0, 1].filter((i) => ar.pids[i]).map((i) => settle(room, i, res(i), score, false));
    tell.forEach((f) => f());                      // both written before either is told (rank, totals)
    close(room);
  }
  // a player left (or lost the connection): during the VS card nothing happened and the other one
  // searches again; during the match the leaver loses and the other wins, now
  function left(room, member) {
    const ar = room.arena;
    if (!ar || ar.done) { leave(reg, member.id); return; }
    ar.done = true;
    if (!room.match) {
      clearTimeout(ar.timer);
      const stay = room.members.filter((m) => m !== member);
      leave(reg, member.id);
      for (const m of stay) {
        leave(reg, m.id);
        send(m.ws, { type: 'oppLeft', when: 'vs' });
        const i = m.index;
        queue.set(m.id, { member: m, pid: ar.pids[i], trophies: ar.trophies[i], since: ar.waited[i] ?? now() });
      }
      return;
    }
    const li = member.index, score = [...room.match.score];
    const tell = [settle(room, li, 'loss', score, true)];
    if (ar.pids[1 - li]) tell.push(settle(room, 1 - li, 'win', score, true));
    tell.forEach((f) => f());
    leave(reg, member.id);
    close(room);
  }
  // writes one player's match; returns what tells them (sent once every player's match is written)
  function settle(room, i, result, score, forfeit) {
    const ar = room.arena, p = store.player(ar.pids[i]);
    if (!p) return () => {};
    const m = room.members.find((x) => x.index === i);
    // practice (not live): nothing is counted — only the losing run, so the CPU stays kind
    if (!live) {
      store.recordMatch({ id: p.id, trophies: p.trophies, now: now(), day: null, win: false, week: null, team: null, won: 0,
        lossStreak: result === 'win' ? 0 : result === 'loss' ? p.loss_streak + 1 : p.loss_streak });
      return () => {
        if (!m) return;
        send(m.ws, { type: 'arenaResult', result, score, forfeit, practice: true, delta: 0, trophies: p.trophies, arena: A.arenaOf(p.trophies).n, newArena: null, bonus: 0, dailyWins: 0, counted: 0 });
        sendProfile(m);
      };
    }
    const r = A.applyResult(p.trophies, ar.trophies[1 - i], result);
    const t = now(), w = T.weekOf(t), day = T.dayOf(t), win = result === 'win';
    const counts = w.phase === 'play';
    const before = win ? store.dayWins(day, p.id) : 0;
    const bonus = win ? A.dailyBonus(before) : 0;
    store.recordMatch({
      id: p.id, trophies: r.trophies, now: t, day, win,
      lossStreak: win ? 0 : result === 'loss' ? p.loss_streak + 1 : p.loss_streak,
      week: counts ? w.id : null, team: teamIn(p, w.id), won: win ? r.delta : 0,
    });
    fresh();
    return () => {
      if (!m) return;
      send(m.ws, { type: 'arenaResult', result, score, forfeit, delta: r.delta, trophies: r.trophies, arena: r.arena, newArena: r.newArena,
        bonus, dailyWins: Math.min(A.DAILY.length, before + (win ? 1 : 0)), counted: counts && win ? r.delta : 0 });
      sendProfile(m);
    };
  }
  function close(room) {
    room.match = null;
    room.phase = 'over';
    for (const m of [...room.members]) leave(reg, m.id);
  }

  // ── THE TROPHY ROAD, THE SWITCH ──
  function road(member, msg) {
    const p = member.pid && store.player(member.pid), i = msg.i | 0;
    if (!live || !p || !A.canClaim(i, p.best, p.road) || !store.claimRoad(p.id, i)) { send(member.ws, { type: 'road', ok: false, i }); return; }
    send(member.ws, { type: 'road', ok: true, i, prize: A.roadPrize(i) });
    sendProfile(member);
  }
  function switchTeam(member, msg) {
    const p = member.pid && store.player(member.pid), n = msg.team | 0;
    const no = (err) => send(member.ws, { type: 'switched', ok: false, err });
    if (!p) return no('offline');
    if (!T.isTeam(n) || n === p.team) return no('bad');
    if (p.switched) return no('used');
    const w = T.weekOf(now()).id;
    if (!store.switchTeam(p.id, n, T.weekShift(w, 1), teamIn(p, w))) return no('used');
    fresh();
    send(member.ws, { type: 'switched', ok: true, starter: n });
    sendProfile(member);
  }

  // ── THE WEEK IS DECIDED ──
  function finalizeWeeks() {
    lastFinal = clock();
    if (!live) return;
    const w = T.weekOf(now());
    let any = false;
    for (const id of store.weeksPlayed()) {
      if (id > w.id || (id === w.id && w.phase === 'play') || store.week(id)) continue;
      store.saveWeek(id, T.standings(store.weekRows(id)), now());
      any = true;
    }
    if (any) { fresh(); for (const m of players) offerPrize(m); }
  }
  // the newest decided week's news, until this player has seen it (ack)
  function offerPrize(member, p = store.player(member.pid)) {
    if (!live || !p || !member?.ws) return;
    const w = T.weekOf(now());
    const fin = (w.phase === 'break' && store.week(w.id)) || store.lastWeekBefore(w.id);
    if (!fin || store.claimed(fin.week, p.id)) return;
    const [y, mo, d] = fin.week.split('-').map(Number);
    if (p.created > T.israelTime(y, mo, d + 6, T.WEEK_END_HOUR, 0)) return;   // joined after it
    const row = store.weekRow(fin.week, p.id);
    const team = row?.team ?? teamIn(p, fin.week);
    const mine = team && fin.standings.find((s) => s.team === team);
    const winner = fin.standings.find((s) => s.rank === 1 && s.active)?.team || null;
    if (!mine || !winner) return;                  // nobody played that week
    const active = (row?.played || 0) >= T.ACTIVE_MATCHES;
    send(member.ws, { type: 'prize', week: fin.week, rank: mine.rank, winner, myTeam: team, active, prize: T.prizeFor(mine.rank, active) });
  }
  function ack(member, msg) {
    const p = member.pid && store.player(member.pid);
    if (!p || !T.isWeekId(msg.week)) return;
    const fin = store.week(msg.week);
    if (!fin) return;
    const row = store.weekRow(msg.week, p.id), team = row?.team ?? teamIn(p, msg.week);
    const mine = fin.standings.find((s) => s.team === team);
    const prize = mine && T.prizeFor(mine.rank, (row?.played || 0) >= T.ACTIVE_MATCHES);
    store.claim(msg.week, p.id, mine?.rank ?? null, prize?.points || 0, now());
  }

  // ── DEV TOOLS (DEV_TOOLS=1 only): a week in a minute ──
  function devOp(member, msg) {
    if (!dev) return;
    const p = member.pid && store.player(member.pid);
    const w = T.weekOf(now());
    if (msg.op === 'seed') {
      // four teams of made-up players, unequal sizes, a believable week each
      const rows = [];
      [[28, 1], [16, 2], [10, 3], [6, 4]].forEach(([n], k) => {
        const team = 1 + ((k + (p?.starter || 1)) % 4);
        for (let i = 0; i < n; i++) {
          const played = Math.floor(rnd() * 12), wins = Math.floor(played * (0.3 + rnd() * 0.4));
          rows.push({ team, played, wins, won: wins * (24 + Math.floor(rnd() * 12)), trophies: Math.floor(rnd() * 2000) });
        }
      });
      store.seed(w.id, rows, now());
    } else if (msg.op === 'endWeek') {
      offset += (w.phase === 'play' ? w.end : T.weekOf(w.next).end) - now() + 1000;
      finalizeWeeks();
    } else if (msg.op === 'toPlay') {
      if (w.phase === 'break') offset += w.next - now() + 60000;
    } else if (msg.op === 'trophies' && p) {
      store.setTrophies(p.id, p.trophies + 100);
    } else if (msg.op === 'day' && p) {
      store.resetDay(T.dayOf(now()), p.id);
    } else if (msg.op === 'wipe') {
      store.wipe(); offset = 0;
      for (const m of players) if (m.pid) store.ensure(m.pid, null, T.weekOf(now()).id, now());
    }
    fresh();
    for (const m of players) sendProfile(m);
    if (p) offerPrize(member);
  }

  return {
    hello, gone, enqueue, unqueue, tick, over, left, road, switchTeam, ack, dev: devOp,
    profile: (member) => sendProfile(member),
    get queued() { return queue.size; },
    now,
  };
}
