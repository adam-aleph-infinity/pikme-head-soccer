// THE LEAGUE'S MEMORY — every arena player's trophies and team, every week's numbers and result, every
// prize paid (docs/TEAMS-ARENA.md). One SQLite file (node:sqlite, built into Node ≥ 22.13): on
// Render it lives on the service's disk (DATA_DIR=/var/data, render.yaml), here in ./data, and a
// test hands it ':memory:'. Only server/league.js writes it, and only from what the server itself
// saw: no number in here ever comes from a client.
//
// No names, no ages, nothing personal: a player is a random device id (shared/teams.js deviceId),
// their Mythic, their team and their numbers. Nicknames are shown to an opponent during a match and
// never written down.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openStore(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      starter INTEGER,                 -- their Mythic (1–4) = their team
      team INTEGER,                    -- the team they are on now…
      team_from TEXT,                  -- …which counts for weeks from this one (a switch: next Sunday)
      prev_team INTEGER,               -- the team that counts before team_from
      switched INTEGER NOT NULL DEFAULT 0,
      trophies INTEGER NOT NULL DEFAULT 0,
      best INTEGER NOT NULL DEFAULT 0,
      road INTEGER NOT NULL DEFAULT 0, -- Trophy Road nodes claimed (1..road)
      loss_streak INTEGER NOT NULL DEFAULT 0,
      matches INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL,
      seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS players_trophies ON players(trophies);
    CREATE TABLE IF NOT EXISTS week_stats (
      week TEXT NOT NULL, player TEXT NOT NULL, team INTEGER NOT NULL,
      won INTEGER NOT NULL DEFAULT 0, played INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week, player)
    );
    CREATE TABLE IF NOT EXISTS daily (
      day TEXT NOT NULL, player TEXT NOT NULL, wins INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, player)
    );
    CREATE TABLE IF NOT EXISTS weeks (
      week TEXT PRIMARY KEY, standings TEXT NOT NULL, final_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS claims (
      week TEXT NOT NULL, player TEXT NOT NULL, place INTEGER, points INTEGER NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (week, player)
    );
  `);
  const q = (sql) => db.prepare(sql);
  const S = {
    get: q('SELECT * FROM players WHERE id = ?'),
    insert: q(`INSERT INTO players (id, starter, team, team_from, prev_team, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    seen: q('UPDATE players SET seen = ? WHERE id = ?'),
    setStarter: q('UPDATE players SET starter = ?, team = ?, team_from = ?, prev_team = ? WHERE id = ? AND starter IS NULL'),
    switchTeam: q('UPDATE players SET starter = ?, team = ?, team_from = ?, prev_team = ?, switched = 1 WHERE id = ? AND switched = 0'),
    result: q('UPDATE players SET trophies = ?, best = MAX(best, ?), loss_streak = ?, matches = matches + 1, seen = ? WHERE id = ?'),
    trophies: q('UPDATE players SET trophies = ?, best = MAX(best, ?) WHERE id = ?'),
    road: q('UPDATE players SET road = ? WHERE id = ? AND road = ?'),
    week: q(`INSERT INTO week_stats (week, player, team, won, played, wins) VALUES (?, ?, ?, ?, 1, ?)
             ON CONFLICT (week, player) DO UPDATE SET won = won + excluded.won, played = played + 1, wins = wins + excluded.wins`),
    weekRow: q('SELECT * FROM week_stats WHERE week = ? AND player = ?'),
    weekRows: q('SELECT team, won, played, wins FROM week_stats WHERE week = ?'),
    weeksPlayed: q('SELECT DISTINCT week FROM week_stats ORDER BY week'),
    day: q(`INSERT INTO daily (day, player, wins) VALUES (?, ?, 1) ON CONFLICT (day, player) DO UPDATE SET wins = wins + 1`),
    dayWins: q('SELECT wins FROM daily WHERE day = ? AND player = ?'),
    dayReset: q('DELETE FROM daily WHERE day = ? AND player = ?'),
    saveWeek: q('INSERT OR IGNORE INTO weeks (week, standings, final_at) VALUES (?, ?, ?)'),
    getWeek: q('SELECT * FROM weeks WHERE week = ?'),
    lastWeek: q('SELECT * FROM weeks WHERE week < ? ORDER BY week DESC LIMIT 1'),
    claim: q('INSERT OR IGNORE INTO claims (week, player, place, points, at) VALUES (?, ?, ?, ?, ?)'),
    claimed: q('SELECT 1 FROM claims WHERE week = ? AND player = ?'),
    above: q('SELECT COUNT(*) AS n FROM players WHERE trophies > ? AND matches > 0'),
    total: q('SELECT COUNT(*) AS n FROM players WHERE matches > 0'),
  };
  const tx = (f) => { db.exec('BEGIN'); try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  return {
    db,
    player: (id) => S.get.get(id) || null,
    // a device seen for the first time; its starter (if it has one yet) is its team from this week
    ensure(id, starter, week, now) {
      const had = S.get.get(id);
      if (had) { S.seen.run(now, id); return S.get.get(id); }
      const st = Number.isInteger(starter) ? starter : null;
      S.insert.run(id, st, st, st ? week : null, st, now, now);
      return S.get.get(id);
    },
    // the first pick, made while the server did not know this device yet: it is the team from now
    setStarter(id, starter, week) { S.setStarter.run(starter, starter, week, starter, id); return S.get.get(id); },
    // the one free switch: the new team (and its Mythic) at once; it counts from `from`
    switchTeam(id, starter, from, prevTeam) { return S.switchTeam.run(starter, starter, from, prevTeam, id).changes > 0; },
    // one arena match, for one human, all at once
    recordMatch({ id, trophies, lossStreak, now, week, team, won, win, day }) {
      return tx(() => {
        S.result.run(trophies, trophies, lossStreak, now, id);
        if (week) S.week.run(week, id, team, won, win ? 1 : 0);
        if (win && day) S.day.run(day, id);
      });
    },
    setTrophies: (id, t) => S.trophies.run(t, t, id),
    claimRoad: (id, i) => S.road.run(i, id, i - 1).changes > 0,
    weekRow: (week, id) => S.weekRow.get(week, id) || null,
    weekRows: (week) => S.weekRows.all(week),
    weeksPlayed: () => S.weeksPlayed.all().map((r) => r.week),
    dayWins: (day, id) => S.dayWins.get(day, id)?.wins || 0,
    resetDay: (day, id) => S.dayReset.run(day, id),
    saveWeek: (week, standings, now) => S.saveWeek.run(week, JSON.stringify(standings), now).changes > 0,
    week(week) { const r = S.getWeek.get(week); return r ? { week: r.week, standings: JSON.parse(r.standings), final_at: r.final_at } : null; },
    lastWeekBefore(week) { const r = S.lastWeek.get(week); return r ? { week: r.week, standings: JSON.parse(r.standings), final_at: r.final_at } : null; },
    claim: (week, id, place, points, now) => S.claim.run(week, id, place, points, now).changes > 0,
    claimed: (week, id) => !!S.claimed.get(week, id),
    rank: (t) => S.above.get(t).n + 1,
    total: () => S.total.get().n,
    // dev only (DEV_TOOLS=1): fake players with a week of numbers, so the standings look real
    seed(week, rows, now) {
      tx(() => {
        rows.forEach((r, i) => {
          const id = `seed-${week}-${i}`;
          db.prepare('INSERT OR REPLACE INTO players (id, starter, team, team_from, prev_team, trophies, best, matches, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, r.team, r.team, week, r.team, r.trophies, r.trophies, r.played, now, now);
          db.prepare('INSERT OR REPLACE INTO week_stats (week, player, team, won, played, wins) VALUES (?, ?, ?, ?, ?, ?)').run(week, id, r.team, r.won, r.played, r.wins);
        });
      });
    },
    wipe() { db.exec('DELETE FROM players; DELETE FROM week_stats; DELETE FROM daily; DELETE FROM weeks; DELETE FROM claims;'); },
    close: () => db.close(),
  };
}
