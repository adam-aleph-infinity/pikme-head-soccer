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
//
// The same trick answers the rest without an id (2026-10-14, Idan: "add what's critical"): the device also
// remembers the hour it was last seen (players per hour), the day it first played (it says "back 1 / 7 days
// after my first day" — retention), and which first-time steps it has done (the new player's journey:
// starter, tutorial, first real match). The server only ever adds 1 to a counter.

export const MODES = ['practice', 'arcade', 'tournament', 'tutorial', 'online', 'arena'];
export const KINDS = ['open', 'time', 'enter', 'start', 'end', 'quit', 'drop', 'step', 'err'];
export const SEEN_KEY = 'hs.playstats.v1';
export const TEAM_KEY = 'hs.playstats.team';  // '1' on a team member's phone: it is never counted
export const MAX_EVENTS = 50;                 // per POST
export const MAX_SECS = 4 * 3600;             // per time / match report
// "came back N days after the first day": the days retention is told for
export const RET_DAYS = [1, 2, 3, 7, 14, 30];
// THE NEW PLAYER'S JOURNEY, each step once per device, in order
export const STEPS = ['starter', 'tut_start', 'tut_done', 'first_match', 'first_finish', 'home', 'shop_done', 'second_match'];
// how a friend's room went (counted on the server, which sees it happen)
export const ROOM_FAILS = ['not-found', 'full', 'in-match', 'no-codes', 'stale', 'other'];

const TZ = 'Asia/Jerusalem';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

// '2026-10-13' — the Israel calendar day of a timestamp
export const dayOf = (ms) => dayFmt.format(new Date(ms));
// '14' — the Israel hour of a timestamp
export const hourOf = (ms) => hourFmt.format(new Date(ms)).padStart(2, '0');
export const monthOf = (day) => day.slice(0, 7);
// whole days from one calendar day to another ('2026-10-13' → '2026-10-14' is 1)
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
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
// `fresh`: the device has never played the game (no starter, no tutorial) — it starts a first day, which
// retention and the journey count from. A device already playing before that keeps no first day.
export function openFlags(seen, now, { fresh = false } = {}) {
  const day = dayOf(now), hour = `${day}T${hourOf(now)}`;
  const flags = {
    new: !seen,
    day: seen?.day !== day,
    week: seen?.week !== weekOf(day),
    month: seen?.month !== monthOf(day),
    hour: seen?.hour !== hour,
  };
  if (flags.day && seen?.day && daysBetween(seen.day, day) === 1) flags.back = true;   // played yesterday too
  const first = seen?.first || (fresh && !seen?.first ? day : null);
  if (first && !seen?.first) flags.cohort = true;                                       // a first day starts today
  if (flags.day && seen?.first) {
    const n = daysBetween(seen.first, day);
    if (RET_DAYS.includes(n)) flags.ret = n;
  }
  const next = { day, week: weekOf(day), month: monthOf(day), hour };
  if (first) { next.first = first; next.steps = seen?.steps || ''; }
  return { flags, seen: next };
}

// THE JOURNEY: a step this device has not done yet (only a device with a first day has a journey)
export function stepDue(seen, step) {
  if (!seen?.first || !STEPS.includes(step)) return false;
  return !String(seen.steps || '').split(',').includes(step);
}
export const stepDone = (seen, step) => ({ ...seen, steps: [...String(seen.steps || '').split(',').filter(Boolean), step].join(',') });

// THE SERVER: one event in, the counters it adds 1 (or n) to. An invalid event adds nothing.
// Counter names: open, players, players_app, new, fresh, week_players, month_players, hour_players, back,
// cohort, ret_<n>, secs, step:<step>, err_pages, err_in_match,
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
    if (ev.hour === true) c.hour_players = 1;
    if (ev.day === true && ev.back === true) c.back = 1;
    if (ev.cohort === true) c.cohort = 1;
    if (ev.day === true && RET_DAYS.includes(ev.ret)) c[`ret_${ev.ret}`] = 1;
    return c;
  }
  if (ev.k === 'time') { const s = secs(ev.s); return s ? { secs: s } : null; }
  if (ev.k === 'step') return STEPS.includes(ev.s) ? { [`step:${ev.s}`]: 1 } : null;
  if (ev.k === 'err') return ev.m === true ? { err_pages: 1, err_in_match: 1 } : { err_pages: 1 };
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

// THE HOUR: the same batch, counted again under the hour it arrived in ('h:14:open' …), for "players
// per hour" and a fair same-time comparison between days.
export function hourly(counters, hh) {
  const out = {};
  const put = (k, n) => { if (n) out[`h:${hh}:${k}`] = (out[`h:${hh}:${k}`] || 0) + n; };
  put('players', counters.hour_players);
  // the day's players whose FIRST visit of the day was in this hour: summed to hour H, the day's players so far
  // (2026-10-16, for the dashboard's "today to now against the same hours before")
  put('day', counters.players);
  put('open', counters.open);
  put('new', counters.fresh);
  put('secs', counters.secs);
  put('matches', Object.entries(counters).reduce((a, [k, n]) => a + (k.startsWith('start:') ? n : 0), 0));
  return out;
}

// counters that hold a highest-so-far, not a sum (peak players online)
export const isMax = (key) => key === 'peak' || key.endsWith(':peak');
const merge = (acc, key, n) => { acc[key] = isMax(key) ? Math.max(acc[key] || 0, n) : (acc[key] || 0) + n; };

// THE REPORT: rows of {day, key, n} → per day, per week and per month, plus "by mode" for each.
export function summarize(rows) {
  const days = new Map();
  for (const { day, key, n } of rows) {
    if (!days.has(day)) days.set(day, {});
    merge(days.get(day), key, n);
  }
  const view = (label, c, players, { hours = false } = {}) => {
    const modes = {};
    for (const m of MODES) {
      const started = c[`start:${m}`] || 0, ended = c[`end:${m}`] || 0, quit = c[`quit:${m}`] || 0, dropped = c[`drop:${m}`] || 0;
      const entered = c[`enter:${m}`] || 0, secs = c[`secs:${m}`] || 0;
      if (started || entered || ended) modes[m] = { entered, started, finished: ended, quit, dropped, minutes: Math.round(secs / 60) };
    }
    const out = {
      [label.k]: label.v, players: c[players] || 0, newPlayers: c.fresh || 0, inAppPlayers: c.players_app || 0,
      opens: c.open || 0, minutesPlayed: Math.round((c.secs || 0) / 60),
      matches: Object.values(modes).reduce((a, m) => a + m.started, 0), modes,
      peakOnline: c.peak || 0,
      // of the day's players, how many also played the day before
      alsoPlayedDayBefore: c.back || 0,
      newPlayerSteps: { opened: c.fresh || 0, ...Object.fromEntries(STEPS.map((s) => [s, c[`step:${s}`] || 0])) },
      friendRooms: {
        created: c['room:create'] || 0, joined: c['room:join'] || 0, matches: c['room:match'] || 0,
        failed: Object.fromEntries(ROOM_FAILS.map((f) => [f, c[`room:fail:${f}`] || 0]).filter(([, n]) => n)),
      },
      errors: { pages: c.err_pages || 0, inMatch: c.err_in_match || 0 },
    };
    if (hours) {
      out.hours = [];
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0'), g = (k) => c[`h:${hh}:${k}`] || 0;
        const row = { hour: hh, players: g('players'), opens: g('open'), newPlayers: g('new'), minutes: Math.round(g('secs') / 60), matches: g('matches'), peakOnline: g('peak'), dayPlayers: g('day') };
        if (row.players || row.opens || row.peakOnline || row.matches) out.hours.push(row);
      }
    }
    return out;
  };
  const roll = (keyOf) => {
    const m = new Map();
    for (const [day, c] of days) {
      const k = keyOf(day);
      if (!m.has(k)) m.set(k, {});
      const acc = m.get(k);
      for (const [key, n] of Object.entries(c)) if (!key.startsWith('h:')) merge(acc, key, n);
    }
    return m;
  };
  const sorted = (m) => [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const all = {};
  for (const c of days.values()) for (const [key, n] of Object.entries(c)) if (!key.startsWith('h:')) merge(all, key, n);
  // RETENTION: each day that started first days (new players), and how many came back N days later.
  // null = that day has not come yet (or is outside the range asked for).
  const retention = [...days.keys()].sort().reverse().filter((d) => days.get(d).cohort).map((d) => ({
    day: d, newPlayers: days.get(d).cohort,
    ...Object.fromEntries(RET_DAYS.map((n) => { const later = days.get(addDays(d, n)); return [`day${n}`, later ? later[`ret_${n}`] || 0 : null]; })),
  }));
  return {
    // all-time players = devices counted at least once since `since` (the day counting began)
    allTime: view({ k: 'since', v: [...days.keys()].sort()[0] || null }, all, 'new'),
    days: sorted(days).map(([d, c]) => view({ k: 'day', v: d }, c, 'players', { hours: true })),
    weeks: sorted(roll(weekOf)).map(([w, c]) => view({ k: 'week', v: w }, c, 'week_players')),
    months: sorted(roll(monthOf)).map(([mo, c]) => view({ k: 'month', v: mo }, c, 'month_players')),
    retention,
  };
}
