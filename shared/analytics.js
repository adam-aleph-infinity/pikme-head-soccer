// GAMEPLAY ANALYTICS — the rules (docs/ANALYTICS.md). Pure: no DOM, no network, no clock of its own;
// public/analytics.js hands it a storage, a clock and a sender, and the tests hand it fakes.
//
// What it promises, whatever the game code calls:
//   · nothing is kept or sent until consent is GRANTED — before it, calls are dropped, not queued
//   · only the events and properties in SCHEMA leave, and every value is a number, a boolean or one
//     of a fixed list: no names, no text, nothing a player typed
//   · a withdrawn consent forgets the queue and the anonymous id at once
//   · a session never sends more than CAP events, whatever goes wrong in a loop
//   · it never throws into the game

export const ANID_KEY = 'hs.analytics.id.v1';     // the anonymous id: random, analytics-only, made after consent
export const OFF_KEY = 'hs.analytics.off';        // the player's own OFF switch (Options)
export const CAP = 80;                            // events per session, at most
export const BATCH = 20;                          // a full batch goes at once
export const SESSION_GAP_MS = 30 * 60 * 1000;    // back within 30 minutes: the same session
export const MODE_GRACE_MS = 2000;                // menu → straight back into the same mode: not an exit

export const MODES = ['practice', 'arcade', 'tournament', 'tutorial', 'online', 'arena'];
const INT = { int: [0, 1e7] };
const SINT = { int: [-1e5, 1e5] };
const BOOL = { bool: true };
const MODE = { one: MODES };
const CHAMP = { re: /^(common|rare|epic|legendary|mythic)_\d{1,3}$/ };
const ITEM = { re: /^[a-z0-9_]{1,32}$/ };

// THE ALLOWLIST. An event not here is dropped; a property not under its event is dropped.
export const SCHEMA = {
  session_start: {},
  session_end: { duration_s: INT },
  mode_enter: { mode: MODE },
  mode_exit: { mode: MODE, duration_s: INT },
  matchmaking_start: { trophies: INT },
  matchmaking_found: { wait_s: INT },
  matchmaking_cancel: { wait_s: INT },
  match_start: { mode: MODE, champ: CHAMP, trophies: INT, opp_trophies: INT, vs_cpu: BOOL },
  match_end: { mode: MODE, result: { one: ['win', 'loss', 'draw'] }, score_me: INT, score_opp: INT, duration_s: INT,
    trophy_delta: SINT, trophies: INT, ranked: BOOL },
  match_quit: { mode: MODE, elapsed_s: INT, score_me: INT, score_opp: INT },
  disconnect: { mode: MODE, elapsed_s: INT },
  item_unlock: { item_type: { one: ['mythic', 'stat_level', 'arcade_stage'] }, item_id: ITEM, level: INT },
  trophy_milestone: { arena: { int: [1, 10] } },
  welcome_popup_seen: {},
  feedback_clicked: { location: { one: ['settings'] } },
};

const okValue = (rule, v) => {
  if (rule.int) return Number.isInteger(v) && v >= rule.int[0] && v <= rule.int[1];
  if (rule.bool) return typeof v === 'boolean';
  if (rule.one) return rule.one.includes(v);
  if (rule.re) return typeof v === 'string' && rule.re.test(v);
  return false;
};
// An event as the allowlist lets it out: { ok, props, dropped } — bad properties are left behind
// (and named, for the debug console), the rest goes.
export function validate(name, props = {}) {
  const rules = Object.hasOwn(SCHEMA, name) ? SCHEMA[name] : null;
  if (!rules) return { ok: false, props: null, dropped: [name] };
  const out = {}, dropped = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (Object.hasOwn(rules, k) && okValue(rules[k], v)) out[k] = v;
    else dropped.push(k);
  }
  return { ok: true, props: out, dropped };
}
const secs = (ms) => Math.max(0, Math.round(ms / 1000));

// consent: 'unknown' | 'granted' | 'denied'. `send(events)` gets a batch of
// { event, props, ts, session_id, distinct_id } and may fail; it is never awaited.
export function createAnalytics({ storage = null, now = () => Date.now(), uuid, send = () => {}, log = null } = {}) {
  let consent = 'unknown';
  let anid = null;
  let queue = [];
  let session = null;                 // { id, count, activeMs, shownAt, hiddenAt }
  let mode = null, modeAt = 0, pendingExit = null;
  let match = null;                   // { mode, t0, tOver, state: 'open' | 'over' }
  let capped = false;
  const say = (...a) => { try { log?.(...a); } catch { /* the console is not the game's problem */ } };

  const readId = () => { try { const v = storage?.getItem(ANID_KEY); return typeof v === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : null; } catch { return null; } };
  function ensureId() {
    if (anid) return anid;
    anid = readId();
    if (!anid) { anid = uuid(); try { storage?.setItem(ANID_KEY, anid); } catch { /* private mode: this page only */ } }
    return anid;
  }
  function forgetId() { anid = null; try { storage?.removeItem(ANID_KEY); } catch { /* private mode */ } }

  function push(name, props, ts = now()) {
    if (consent !== 'granted' || !session) return false;
    const v = validate(name, props);
    if (!v.ok) { say('drop: unknown event', name); return false; }
    if (v.dropped.length) say('drop: bad properties on', name, v.dropped);
    if (session.count >= CAP) { if (!capped) say('cap reached: no more events this session', CAP); capped = true; return false; }
    session.count++;
    const ev = { event: name, props: v.props, ts, session_id: session.id, distinct_id: ensureId() };
    queue.push(ev);
    say('event', name, v.props);
    if (queue.length >= BATCH) flush();
    return true;
  }
  function flush(how = 'normal') {
    settleExit();
    if (!queue.length || consent !== 'granted') return 0;
    const out = queue; queue = [];
    try { send(out, how); } catch (e) { say('send failed', e); }
    return out.length;
  }
  // a mode left for the menu is called left once the grace is over (or something else happens)
  function settleExit(force = false) {
    if (!pendingExit || (!force && now() - pendingExit.at < MODE_GRACE_MS)) return;
    const p = pendingExit; pendingExit = null;
    push('mode_exit', { mode: p.mode, duration_s: secs(p.at - p.since) }, p.at);   // stamped when the mode was left, not when it was noticed
  }

  function startSession() {
    session = { id: uuid(), count: 0, activeMs: 0, shownAt: now(), hiddenAt: null };
    capped = false;
    mode = null; pendingExit = null; match = null;
    push('session_start', {});
  }

  const api = {
    get consent() { return consent; },
    get queued() { return queue.length; },
    get sessionId() { return session?.id || null; },
    get anonId() { return anid; },
    get mode() { return mode; },

    // the privacy choice. Granted: an id (made now if there was none) and a session. Anything else:
    // the queue and the id are forgotten, and nothing more is kept.
    setConsent(state) {
      const next = state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'unknown';
      if (next === consent) return;
      consent = next;
      if (next === 'granted') { ensureId(); startSession(); return; }
      queue = []; session = null; mode = null; pendingExit = null; match = null;
      if (next === 'denied') forgetId();
    },

    track(name, props) { try { settleExit(); return push(name, props); } catch (e) { say('track failed', e); return false; } },
    flush,
    tick() { try { settleExit(); } catch { /* never into the game */ } },

    // THE PAGE: hidden ends the session as far as anyone can tell (the app may never come back);
    // shown again within SESSION_GAP_MS carries on with the same one, and a later session_end
    // says the longer duration — the last one for a session is the true one.
    hidden() {
      if (!session || session.hiddenAt != null) return;
      session.activeMs += now() - session.shownAt;
      session.hiddenAt = now();
      settleExit(true);
      // the mode ends with the session (the app may never come back), and resumes if it does
      if (mode) { push('mode_exit', { mode, duration_s: secs(now() - modeAt) }); session.resume = mode; mode = null; }
      push('session_end', { duration_s: secs(session.activeMs) });
      flush('unload');
    },
    shown() {
      if (consent !== 'granted') return;
      if (!session) { startSession(); return; }
      if (session.hiddenAt == null) return;
      if (now() - session.hiddenAt > SESSION_GAP_MS) { startSession(); return; }
      session.hiddenAt = null;
      session.shownAt = now();
      if (session.resume) { const m = session.resume; session.resume = null; api.modeEnter(m); }
    },

    // MODES: one at a time. Back to the menu is an exit — unless the same mode is entered again
    // straight away (the arena's "another battle" goes through the home screen).
    modeEnter(m) {
      if (!MODES.includes(m) || consent !== 'granted') return;
      if (pendingExit) {
        if (pendingExit.mode === m && now() - pendingExit.at < MODE_GRACE_MS) { mode = m; modeAt = pendingExit.since; pendingExit = null; return; }
        settleExit(true);
      }
      if (mode === m) return;
      if (mode) push('mode_exit', { mode, duration_s: secs(now() - modeAt) });
      mode = m; modeAt = now();
      push('mode_enter', { mode: m });
    },
    modeExit() {
      if (!mode) return;
      pendingExit = { mode, since: modeAt, at: now() };
      mode = null;
    },

    // MATCHES: each one ends exactly once — match_end, match_quit or disconnect, whichever is first.
    matchStart(p) {
      if (consent !== 'granted' || !MODES.includes(p?.mode)) return;
      api.modeEnter(p.mode);
      match = { mode: p.mode, t0: now(), tOver: null, state: 'open' };
      push('match_start', p);
    },
    // the final whistle, before the result is known (the arena's comes from the server)
    matchOver() { if (match?.state === 'open') { match.state = 'over'; match.tOver = now(); } },
    matchEnd(p = {}) {
      if (!match || match.state === 'closed') return;
      const d = secs((match.tOver ?? now()) - match.t0);
      push('match_end', { ...p, mode: match.mode, duration_s: d });
      match.state = 'closed';
    },
    matchQuit(p = {}) {
      if (match?.state !== 'open') return;
      push('match_quit', { ...p, mode: match.mode, elapsed_s: secs(now() - match.t0) });
      match.state = 'closed';
    },
    disconnect() {
      if (match?.state !== 'open') return;
      push('disconnect', { mode: match.mode, elapsed_s: secs(now() - match.t0) });
      match.state = 'closed';
    },
    get matchState() { return match?.state || null; },
  };
  return api;
}
