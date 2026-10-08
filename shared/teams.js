// THE TEAMS — four of them, one per Mythic starter (Idan, 2026-10-08; docs/TEAMS-ARENA.md).
// Pure: no DOM, and the storage is passed in, like shared/upgrades.js. The server (server/league.js)
// and the client (public/team.js) both read these rules, so they can never disagree.
//
// Pokémon GO's teams, ours: a team is who you are, never how strong you are. Each one is led by a
// Mythic (Blanche, Candela and Spark there; שובל, אורי, נוה and פז here), and picking your Mythic
// starter IS picking your team, so a player's team is always their starter's number. Switching team
// switches the champion too (Idan): the one free switch, then gems (not built yet).
//
// Teams never reach the match: nothing here is read by shared/sim.js.

import { MYTHICS, MYTHIC_COUNT, mythicGem } from './mythics.js';

// ── WHO ──────────────────────────────────────────────────────────────────────────────────────
// The colours are the Mythic Gem's (shared/mythics.js MYTHIC_GEMS): Shoval red, Ori pink, Naveh
// yellow, Paz green (Idan's four). `dark` outlines the team's lettering and fills its badge's rim.
const DARK = { 1: '#6e0714', 2: '#6e0752', 3: '#6b4300', 4: '#055a2a' };
export const TEAMS = Object.freeze(MYTHICS.map((m) => Object.freeze({
  id: m.number,
  leader: m.number,
  name: m.name,
  title: `קבוצת ${m.name}`,
  color: mythicGem(m.number).color,
  glow: mythicGem(m.number).glow,
  dark: DARK[m.number],
})));
export const TEAM_COUNT = MYTHIC_COUNT;
export const isTeam = (t) => Number.isInteger(+t) && +t >= 1 && +t <= TEAM_COUNT;
export const teamById = (t) => (isTeam(t) ? TEAMS[+t - 1] : null);
// your team is your starter's (a switch changes both)
export const teamOf = (starter) => teamById(starter);

// ── THE WEEK: Sunday 00:00 → Saturday 20:00, Israel time (Idan) ──────────────────────────────
// Saturday 20:00 → Sunday 00:00 is the results break: the week is decided, the screen shows who won,
// and arena matches still move your trophies but count for no team. A week is named by its Sunday's
// date ("2026-10-11"). Israel's clocks change on a Friday 02:00 (spring) and a Sunday 02:00 (autumn),
// never at a boundary, so every boundary is a single, unambiguous instant.
export const TZ = 'Asia/Jerusalem';
export const WEEK_END_HOUR = 20;
const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
// the wall clock in Israel at instant `ms`
export function israel(ms) {
  const p = {};
  for (const { type, value } of FMT.formatToParts(new Date(ms))) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: WD[p.weekday] };
}
const offsetAt = (ms) => { const p = israel(ms); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; };
// the instant at which Israel's wall clock reads y-mo-d h:mi (day overflow is fine: d = 32 is next month)
export function israelTime(y, mo, d, h = 0, mi = 0) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offsetAt(wall);
  const o2 = offsetAt(t);
  if (wall - o2 !== t) t = wall - o2;
  return t;
}
const iso = (y, mo, d) => { const D = new Date(Date.UTC(y, mo - 1, d)); return D.toISOString().slice(0, 10); };
// Israel's calendar date at `ms`, "YYYY-MM-DD" (the daily bonus's day)
export const dayOf = (ms) => { const p = israel(ms); return iso(p.y, p.mo, p.d); };
// The week `ms` falls in: { id, start, end, next, phase }.
//   start — Sunday 00:00   end — Saturday 20:00   next — the next Sunday 00:00
//   phase — 'play' before `end`, 'break' from `end` to `next`
export function weekOf(ms) {
  const p = israel(ms);
  const sd = p.d - p.wd;                            // this week's Sunday (may be < 1: Date.UTC rolls it back)
  const start = israelTime(p.y, p.mo, sd, 0, 0);
  const end = israelTime(p.y, p.mo, sd + 6, WEEK_END_HOUR, 0);
  const next = israelTime(p.y, p.mo, sd + 7, 0, 0);
  return { id: iso(p.y, p.mo, sd), start, end, next, phase: ms < end ? 'play' : 'break' };
}
// the week before / after a week id
export const weekShift = (id, n) => { const [y, mo, d] = id.split('-').map(Number); return iso(y, mo, d + 7 * n); };
export const isWeekId = (id) => typeof id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(id) && weekOf(israelTime(...id.split('-').map(Number), 12)).id === id;

// ── THE SCORE (docs/TEAMS-ARENA.md "fairness") ───────────────────────────────────────────────
// Each player's week counts for the team they were on when it began (a switch counts from the next).
//   won    — trophies won in arena WINS this week. A loss costs your own trophies but never lowers
//            your team: playing more can only help it (Idan wants kids to play more).
//   active — at least ACTIVE_MATCHES arena matches this week. The rest are not counted at all, so a
//            team is never dragged down by players who did not play.
//   capped — min(won, CAP): about ten wins. Past that, the way to help your team is to bring a
//            teammate, not to play alone all night.
// The team's score is the AVERAGE of its active players' capped wins, pulled toward the average of
// everyone who played by K "average players", K = (all active players) ÷ SHRINK:
//     score = (Σ capped + K·μ) ÷ (active + K)
// Why not the plain average: four teams with the same effort but different sizes should each win
// a quarter of the weeks, and a plain average does not — a small team's average is noisier, so it
// tops the table more often by luck (simulated: 34% for a 5% team, 16% for a 60% one). The pull
// evens that out (21–28% over every size split tried), and a team that really plays more still
// wins most weeks (test-teams.mjs runs both). A team where nobody played is last, whatever μ is.
export const ACTIVE_MATCHES = 3;
export const CAP = 300;
export const SHRINK = 8;

// rows: [{ team, won, played }] — one per player, for one week. Returns the four teams, best first:
// [{ team, score, active, members, rank }]. Scores are compared at one decimal; teams that tie share
// the place (and its prize), and the next place is skipped (1, 1, 3, 4).
export function standings(rows) {
  const t = TEAMS.map((x) => ({ team: x.id, sum: 0, active: 0, members: 0 }));
  let all = 0, allSum = 0;
  for (const r of rows || []) {
    const s = t[+r.team - 1];
    if (!s) continue;
    s.members++;
    if (!((r.played | 0) >= ACTIVE_MATCHES)) continue;
    const c = Math.max(0, Math.min(CAP, r.won | 0));
    s.active++; s.sum += c; all++; allSum += c;
  }
  const mu = all ? allSum / all : 0, K = all / SHRINK;
  const out = t.map((s) => ({
    team: s.team,
    score: s.active ? Math.round(((s.sum + K * mu) / (s.active + K)) * 10) / 10 : 0,
    active: s.active, members: s.members,
  }));
  // nobody played: everyone shares last place (no winner, no prize but the taking part)
  const key = (s) => (s.active ? s.score : -1);
  out.sort((a, b) => key(b) - key(a) || a.team - b.team);
  for (const s of out) s.rank = all ? 1 + out.filter((o) => key(o) > key(s)).length : TEAM_COUNT;
  return out;
}

// ── THE PRIZES (Arcade Points now; champion boxes later, Idan) ────────────────────────────────
// Only for a player who was active that week. Small next to the economy: an arcade win pays 100 per
// stage, an upgrade costs 500 → 256,000 (shared/upgrades.js).
export const PRIZES = Object.freeze({ 1: { points: 2000, badge: true }, 2: { points: 1000, badge: false }, 3: { points: 500, badge: false }, 4: { points: 500, badge: false } });
export const prizeFor = (rank, active) => (active && PRIZES[rank] ? { ...PRIZES[rank] } : null);

// ── ON THE DEVICE ────────────────────────────────────────────────────────────────────────────
// The server owns the truth (the team, the switch, the prizes). The device keeps what it needs to
// draw the screens offline and what it was already paid: { v, welcomed, badges, claimed, switched }.
//   welcomed — the team intro has been shown (the tutorial's team step, or the one-time welcome)
//   claimed  — the last weeks whose prize this device added to its points: a prize sent twice is
//              paid once
export const TEAM_KEY = 'hs.team.v1';
const CLAIMS_KEPT = 12;
export const freshTeamRec = () => ({ v: 1, welcomed: false, badges: 0, claimed: [], switched: false });
export function parseTeamRec(raw) {
  let o = null;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return freshTeamRec(); }
  if (!o || typeof o !== 'object' || o.v !== 1) return freshTeamRec();
  return {
    v: 1,
    welcomed: o.welcomed === true,
    badges: Number.isInteger(o.badges) && o.badges > 0 ? Math.min(o.badges, 9999) : 0,
    claimed: Array.isArray(o.claimed) ? o.claimed.filter((w) => typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w)).slice(-CLAIMS_KEPT) : [],
    switched: o.switched === true,
  };
}
export function loadTeamRec(storage) {
  try { return parseTeamRec(storage ? storage.getItem(TEAM_KEY) : null); } catch { return freshTeamRec(); }
}
export function saveTeamRec(storage, rec) {
  try { storage.setItem(TEAM_KEY, JSON.stringify(rec)); return true; } catch { return false; }
}
// A week's prize arrived: returns { rec, paid } — paid is the prize to add now, or null when this
// week was already paid on this device.
export function claimPrize(rec, week, prize) {
  if (!prize || rec.claimed.includes(week)) return { rec, paid: null };
  return {
    rec: { ...rec, claimed: [...rec.claimed, week].slice(-CLAIMS_KEPT), badges: rec.badges + (prize.badge ? 1 : 0) },
    paid: prize,
  };
}

// THE DEVICE ID: who this device is to the server until the app hands us its own user id (Idan:
// "device ID now, app ID later"). Random, never shown, made once.
export const DEVICE_KEY = 'hs.device.v1';
export const isDeviceId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);
export function deviceId(storage, make = () => globalThis.crypto.randomUUID()) {
  try {
    const had = storage?.getItem(DEVICE_KEY);
    if (isDeviceId(had)) return had;
    const id = make();
    storage?.setItem(DEVICE_KEY, id);
    return id;
  } catch { return null; }
}

// ── SWITCHING (Idan: one free switch, then gems; the champion switches with the team) ─────────
// The switch is at once — the new team, its Mythic as your only Mythic, the old one locked — but
// this week's wins still count for the team you started the week on, and the new one from next
// Sunday: nobody hops onto the leading team on a Saturday.
export const GEMS_SWITCH_PRICE = 500;                 // shown, not charged: gems are not built yet
export const canSwitchFree = (switched) => !switched;
export const switchCountsFrom = (ms) => weekShift(weekOf(ms).id, 1);
