// PLAY STATS — how many play and which modes they play, as DAILY TOTALS ONLY (docs/PLAY-STATS.md).
//
// The difference from analytics (shared/analytics.js, PostHog): nothing here can tell one player from
// another. No id, no name, no card, no score, nothing leaves our own server. The device sends "a match of
// arcade ended after 74 s" and "this device is opening the game for the first time today"; the server adds
// 1 to a counter for today and keeps nothing else. So it needs no consent switch and is always on.
//
// "How many players" without an id: the device remembers the last day / week / month it said hello, and
// says "first time today / this week / this month / ever" when that changes. The server sums those flags:
// the sum of `day` flags on a day is that day's players, of `week` flags over a week that week's, and so on.

export const MODES = ['practice', 'arcade', 'tournament', 'tutorial', 'online', 'arena'];
export const KINDS = ['open', 'time', 'enter', 'start', 'end', 'quit', 'drop'];
export const SEEN_KEY = 'hs.playstats.v1';
export const MAX_EVENTS = 50;                 // per POST
export const MAX_SECS = 4 * 3600;             // per time / match report

const TZ = 'Asia/Jerusalem';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// '2026-10-13' — the Israel calendar day of a timestamp
export const dayOf = (ms) => dayFmt.format(new Date(ms));
export const monthOf = (day) => day.slice(0, 7);
// '2026-W42' — the ISO week of a calendar day
export function weekOf(day) {
  const d = new Date(day + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;                 // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3);              // that week's Thursday decides the year
  const y = d.getUTCFullYear();
  const w = 1 + Math.floor((d - Date.UTC(y, 0, 1)) / 86400000 / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

// THE DEVICE: which "first time" flags this open carries. `seen` is what it stored last time (or null).
export function openFlags(seen, now) {
  const day = dayOf(now);
  const flags = {
    new: !seen,
    day: seen?.day !== day,
    week: seen?.week !== weekOf(day),
    month: seen?.month !== monthOf(day),
  };
  return { flags, seen: { day, week: weekOf(day), month: monthOf(day) } };
}

// THE SERVER: one event in, the counters it adds 1 (or n) to. An invalid event adds nothing.
// Counter names: open, players, players_app, new, fresh, week_players, month_players, secs,
// enter:<mode>, start:<mode>, end:<mode>, quit:<mode>, drop:<mode>, secs:<mode>
export function countersFor(ev) {
  if (!ev || typeof ev !== 'object' || !KINDS.includes(ev.k)) return null;
  const secs = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(MAX_SECS, Math.round(v))) : 0);
  if (ev.k === 'open') {
    const c = { open: 1 };
    if (ev.day === true) { c.players = 1; if (ev.app === true) c.players_app = 1; }
    if (ev.new === true) c.new = 1;          // first time THIS counter sees the device (all-time players)
    if (ev.fresh === true) c.fresh = 1;      // a device that has never played the game (new players)
    if (ev.week === true) c.week_players = 1;
    if (ev.month === true) c.month_players = 1;
    return c;
  }
  if (ev.k === 'time') { const s = secs(ev.s); return s ? { secs: s } : null; }
  if (!MODES.includes(ev.mode)) return null;
  const c = { [`${ev.k}:${ev.mode}`]: 1 };
  if (ev.k === 'end' || ev.k === 'quit' || ev.k === 'drop') { const s = secs(ev.s); if (s) c[`secs:${ev.mode}`] = s; }
  return c;
}

// A whole POST body → the summed counters for it (or null when the body is not a batch).
export function countBatch(body) {
  if (!body || !Array.isArray(body.ev)) return null;
  const out = {};
  for (const ev of body.ev.slice(0, MAX_EVENTS)) {
    const c = countersFor(ev);
    if (c) for (const [k, n] of Object.entries(c)) out[k] = (out[k] || 0) + n;
  }
  return out;
}

// THE REPORT: rows of {day, key, n} → per day, per week and per month, plus "by mode" for each.
export function summarize(rows) {
  const days = new Map();
  for (const { day, key, n } of rows) {
    if (!days.has(day)) days.set(day, {});
    days.get(day)[key] = (days.get(day)[key] || 0) + n;
  }
  const view = (label, c, players) => {
    const modes = {};
    for (const m of MODES) {
      const started = c[`start:${m}`] || 0, ended = c[`end:${m}`] || 0, quit = c[`quit:${m}`] || 0, dropped = c[`drop:${m}`] || 0;
      const entered = c[`enter:${m}`] || 0, secs = c[`secs:${m}`] || 0;
      if (started || entered || ended) modes[m] = { entered, started, finished: ended, quit, dropped, minutes: Math.round(secs / 60) };
    }
    return {
      [label.k]: label.v, players: c[players] || 0, newPlayers: c.fresh || 0, inAppPlayers: c.players_app || 0,
      opens: c.open || 0, minutesPlayed: Math.round((c.secs || 0) / 60),
      matches: Object.values(modes).reduce((a, m) => a + m.started, 0), modes,
    };
  };
  const roll = (keyOf) => {
    const m = new Map();
    for (const [day, c] of days) {
      const k = keyOf(day);
      if (!m.has(k)) m.set(k, {});
      const acc = m.get(k);
      for (const [key, n] of Object.entries(c)) acc[key] = (acc[key] || 0) + n;
    }
    return m;
  };
  const sorted = (m) => [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const all = {};
  for (const c of days.values()) for (const [key, n] of Object.entries(c)) all[key] = (all[key] || 0) + n;
  return {
    // all-time players = devices counted at least once since `since` (the day counting began)
    allTime: view({ k: 'since', v: [...days.keys()].sort()[0] || null }, all, 'new'),
    days: sorted(days).map(([d, c]) => view({ k: 'day', v: d }, c, 'players')),
    weeks: sorted(roll(weekOf)).map(([w, c]) => view({ k: 'week', v: w }, c, 'week_players')),
    months: sorted(roll(monthOf)).map(([mo, c]) => view({ k: 'month', v: mo }, c, 'month_players')),
  };
}
