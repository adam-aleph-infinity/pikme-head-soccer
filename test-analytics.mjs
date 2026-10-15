// GAMEPLAY ANALYTICS (shared/analytics.js): nothing before consent, only the allowlist leaves, a
// withdrawn consent forgets everything, every match ends once, the per-session cap, the sessions and
// the modes. Plus: the game's hooks stay one-way (the sim never sees analytics). Run: node test-analytics.mjs
import fs from 'node:fs';
import * as AN from './shared/analytics.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
// a world with a clock to move, ids to count, and a sender that keeps what it was given
function world() {
  let t = 1_000_000, n = 0;
  const sent = [], storage = mem();
  const a = AN.createAnalytics({ storage, now: () => t, uuid: () => `id-${String(++n).padStart(16, '0')}`, send: (b) => sent.push(...b) });
  return { a, sent, storage, wait: (ms) => { t += ms; }, names: () => sent.map((e) => e.event) };
}

// ── consent ──
{
  const w = world();
  w.a.track('mode_enter', { mode: 'arcade' });
  w.a.matchStart({ mode: 'arcade', champ: 'mythic_1' });
  w.a.flush();
  ok('before consent: nothing queued, nothing sent', w.a.queued === 0 && w.sent.length === 0);
  ok('before consent: no anonymous id is made', w.storage.getItem(AN.ANID_KEY) === null && w.a.anonId === null);
  w.a.setConsent('granted');
  w.a.flush();
  ok('consent granted: a session starts with session_start', w.names().join() === 'session_start');
  ok('…and an anonymous id is made and kept', !!w.storage.getItem(AN.ANID_KEY) && w.sent[0].distinct_id === w.storage.getItem(AN.ANID_KEY));
  ok('nothing from before consent came along', !w.names().includes('mode_enter'));
  w.a.track('matchmaking_start', { trophies: 120 });
  w.a.setConsent('denied');
  w.a.flush();
  ok('denied: the queue is forgotten, not sent', w.a.queued === 0 && !w.names().includes('matchmaking_start'));
  ok('denied: the anonymous id is deleted', w.storage.getItem(AN.ANID_KEY) === null && w.a.anonId === null);
  w.a.track('matchmaking_start', { trophies: 120 });
  ok('denied: later calls are dropped', w.a.queued === 0);
  w.a.setConsent('granted');
  w.a.flush();
  ok('granted again: a fresh id, not the old one', w.sent.at(-1).distinct_id !== w.sent[0].distinct_id);
  const u = world();
  u.a.setConsent('unknown');
  u.a.track('session_start', {});
  ok('unknown is not consent', u.a.queued === 0);
}

// ── the allowlist ──
{
  ok('an event not on the list is refused', !AN.validate('kick', {}).ok && !AN.validate('toString', {}).ok);
  const v = AN.validate('match_start', { mode: 'arcade', champ: 'mythic_2', trophies: 40, name: 'Idan', email: 'a@b.c' });
  ok('a property not on the list is dropped', !('name' in v.props) && !('email' in v.props) && v.dropped.includes('name'));
  ok('…and the rest of the event still goes', v.ok && v.props.mode === 'arcade' && v.props.champ === 'mythic_2' && v.props.trophies === 40);
  ok('free text in an id field is dropped', !('champ' in AN.validate('match_start', { mode: 'arcade', champ: 'idan@mail.com' }).props));
  ok('a mode not in the list is dropped', !('mode' in AN.validate('mode_enter', { mode: 'chat' }).props));
  ok('numbers must be whole and in range', Object.keys(AN.validate('match_end', { score_me: 2.5, score_opp: -1, duration_s: NaN, trophies: 1e9 }).props).length === 0);
  ok('a trophy loss may be negative', AN.validate('match_end', { trophy_delta: -24 }).props.trophy_delta === -24);
  ok('booleans are booleans', !('ranked' in AN.validate('match_end', { ranked: 'yes' }).props));
  ok('an arena is 1..10', !('arena' in AN.validate('trophy_milestone', { arena: 11 }).props));
  ok('the welcome popup and the feedback button are on the list', AN.validate('welcome_popup_seen').ok && AN.validate('feedback_clicked', { location: 'settings' }).props.location === 'settings');
  ok('feedback_clicked carries only a known place', !('location' in AN.validate('feedback_clicked', { location: 'free text' }).props));
  const w = world();
  w.a.setConsent('granted');
  w.a.track('chat_message', { text: 'hi' });
  w.a.track('item_unlock', { item_type: 'stat_level', item_id: 'speed', level: 3, nickname: 'x' });
  w.a.flush();
  ok('only allowlisted events are sent', w.names().join() === 'session_start,item_unlock');
  ok('what is sent carries only allowlisted properties', JSON.stringify(w.sent[1].props) === '{"item_type":"stat_level","item_id":"speed","level":3}');
  const keys = new Set(w.sent.flatMap((e) => Object.keys(e)));
  ok('an event is its name, properties, time, session and anonymous id — nothing else', [...keys].sort().join() === 'distinct_id,event,props,session_id,ts');
}

// ── matches end once ──
{
  const w = world();
  w.a.setConsent('granted');
  w.a.matchStart({ mode: 'arena', champ: 'mythic_3', trophies: 300, opp_trophies: 280, vs_cpu: true });
  w.wait(61_000);
  w.a.matchOver();
  w.wait(5_000);
  w.a.matchQuit({ score_me: 1, score_opp: 2 });
  w.a.disconnect();
  w.a.matchEnd({ result: 'win', score_me: 3, score_opp: 1, trophy_delta: 31, trophies: 331, ranked: true });
  w.a.matchEnd({ result: 'win', score_me: 3, score_opp: 1 });
  w.a.flush();
  const ends = w.sent.filter((e) => ['match_end', 'match_quit', 'disconnect'].includes(e.event));
  ok('after the whistle a quit or a drop is not counted; the result is, once', ends.length === 1 && ends[0].event === 'match_end', w.names().join());
  ok('its duration is the match, not the wait for the server', ends[0].props.duration_s === 61);
  ok('entering a match enters its mode', w.names().slice(0, 3).join() === 'session_start,mode_enter,match_start');
  w.a.matchStart({ mode: 'arcade', champ: 'mythic_1' });
  w.wait(20_000);
  w.a.matchQuit({ score_me: 0, score_opp: 1 });
  w.a.matchEnd({ result: 'loss' });
  w.a.flush();
  ok('a quit mid-match is the end of it', w.names().filter((n) => n === 'match_quit').length === 1 && w.names().filter((n) => n === 'match_end').length === 1);
  ok('…with the time played and the mode', w.sent.find((e) => e.event === 'match_quit').props.elapsed_s === 20 && w.sent.find((e) => e.event === 'match_quit').props.mode === 'arcade');
  ok('moving to another mode leaves the first', w.names().includes('mode_exit') && w.sent.find((e) => e.event === 'mode_exit').props.mode === 'arena');
  w.a.matchStart({ mode: 'online', champ: 'mythic_1' });
  w.a.disconnect(); w.a.disconnect();
  w.a.flush();
  ok('a dropped connection is reported once', w.names().filter((n) => n === 'disconnect').length === 1);
}

// ── modes ──
{
  const w = world();
  w.a.setConsent('granted');
  w.a.modeEnter('arena');
  w.wait(90_000);
  w.a.modeExit();
  w.wait(500);
  w.a.modeEnter('arena');                       // "another battle": through the home screen and straight back
  w.wait(30_000);
  w.a.modeExit();
  w.wait(AN.MODE_GRACE_MS + 1);
  w.a.tick();
  w.a.flush();
  ok('back to the same mode at once is not an exit and a new entry', w.names().join() === 'session_start,mode_enter,mode_exit', w.names().join());
  ok('…and the time in it runs on (the half second on the home screen too)', w.sent[2].props.duration_s === 121);
  ok('a mode left for the menu is stamped when it was left, not when the grace ran out', w.sent[2].ts === w.sent[1].ts + 120_500);
  w.a.modeEnter('practice'); w.a.modeEnter('practice');
  w.a.flush();
  ok('entering the mode you are in is nothing', w.names().filter((n) => n === 'mode_enter').length === 2);
  ok('a made-up mode is ignored', (w.a.modeEnter('casino'), w.a.mode === 'practice'));
}

// ── sessions ──
{
  const w = world();
  w.a.setConsent('granted');
  w.wait(120_000);
  w.a.hidden();
  ok('hidden: session_end with the time in front of the player, sent at once', w.names().join() === 'session_start,session_end' && w.sent[1].props.duration_s === 120);
  const id = w.a.sessionId;
  w.wait(10 * 60_000);
  w.a.shown();
  w.wait(60_000);
  w.a.hidden();
  ok('back within 30 minutes: the same session, its time adding up', w.a.sessionId === id && w.sent.at(-1).props.duration_s === 180);
  w.wait(AN.SESSION_GAP_MS + 1);
  w.a.shown();
  w.a.flush();
  ok('back after 30 minutes: a new session', w.a.sessionId !== id && w.names().at(-1) === 'session_start');
  w.a.modeEnter('arcade');
  w.a.hidden();
  ok('leaving the app in a mode says the mode ended before the session did', w.names().slice(-2).join() === 'mode_exit,session_end');
  w.wait(5_000);
  w.a.shown();
  w.a.flush();
  ok('…and back in the app, the mode carries on', w.names().at(-1) === 'mode_enter' && w.a.mode === 'arcade');
  w.a.hidden();
  w.a.hidden();
  w.a.hidden();
  ok('hidden twice is one session_end', w.names().filter((n) => n === 'session_end').length === 4);
}

// ── volume ──
{
  const w = world();
  w.a.setConsent('granted');
  for (let i = 0; i < 500; i++) w.a.track('matchmaking_cancel', { wait_s: 1 });
  w.a.flush();
  ok(`never more than ${AN.CAP} events in a session`, w.sent.length === AN.CAP);
  const b = [];
  const x = AN.createAnalytics({ storage: mem(), uuid: () => 'x'.repeat(16) + Math.random().toString(36).slice(2, 8), send: (batch) => b.push(batch.length) });
  x.setConsent('granted');
  for (let i = 0; i < 45; i++) x.track('matchmaking_cancel', { wait_s: 1 });
  ok(`a full batch of ${AN.BATCH} goes by itself`, b.length === 2 && b.every((n) => n === AN.BATCH));
  const boom = AN.createAnalytics({ storage: mem(), uuid: () => 'y'.repeat(20), send: () => { throw new Error('offline'); } });
  boom.setConsent('granted');
  let threw = false;
  try { boom.track('session_end', { duration_s: 1 }); boom.flush(); boom.hidden(); } catch { threw = true; }
  ok('a sender that throws never reaches the game', !threw);
  const bad = AN.createAnalytics({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} }, uuid: () => 'z'.repeat(20) });
  try { bad.setConsent('granted'); bad.track('session_end', { duration_s: 1 }); bad.setConsent('denied'); } catch { threw = true; }
  ok('a storage that throws (private mode) never reaches the game', !threw);
}

// ── the game's side ──
{
  const sim = ['shared/sim.js', 'shared/bot.js', 'shared/constants.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  ok('the sim never sees analytics', !/analytics/i.test(sim));
  const page = fs.readFileSync('public/analytics.js', 'utf8');
  ok('no provider SDK is loaded: no autocapture, no replay', !/posthog-js|array\.js|<script|import\(.*posthog/i.test(page));
  ok('anonymous events only, no location lookup', /\$process_person_profile: false/.test(page) && /\$geoip_disable: true/.test(page));
  const game = fs.readFileSync('public/game.js', 'utf8');
  ok('the game reaches the provider only through analytics.js', !/posthog/i.test(game) && !/posthog/i.test(fs.readFileSync('public/menus.js', 'utf8')));
  const names = [...game.matchAll(/AN\.track\('(\w+)'/g)].map((m) => m[1]);
  ok('every event the game names is on the list', names.every((n) => n in AN.SCHEMA));
}

console.log(`analytics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
