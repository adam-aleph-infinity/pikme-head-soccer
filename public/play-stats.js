// PLAY STATS ON THE PAGE (the rules are shared/play-stats.js; docs/PLAY-STATS.md the whole story).
// Daily totals only, posted to our own server (/play): no id, no name, no score. Always on, because
// nothing in it can tell one child from another. Analytics (analytics.js, PostHog) is separate and
// still waits for the app's consent.
//
// withPlayStats(AN, PS) hands the game ONE object: every AN call it already makes also counts here, so
// game.js needed no new hooks.
import { openFlags, stepDue, stepDone, SEEN_KEY, TEAM_KEY, MODES, MAX_EVENTS } from '../shared/play-stats.js';

const FLUSH_MS = 20000;

export function createPlayStats({ store, inApp, fresh, devHost, params }) {
  // a dev host counts only with ?playstats=send (so `npm start` and the harnesses add nothing)
  const on = !devHost || params.get('playstats') === 'send';
  // a team member's phone (Options: tap the logo 7 times) is never counted, from the next event on
  const team = () => { try { return store?.getItem(TEAM_KEY) === '1'; } catch { return false; } };
  const q = [];
  const push = (ev) => { if (on && !team() && q.length < 200) q.push(ev); };
  const flush = (beacon) => {
    while (q.length) {
      const body = JSON.stringify({ ev: q.splice(0, MAX_EVENTS) });
      try {
        if (beacon && navigator.sendBeacon?.('/play', new Blob([body], { type: 'text/plain' }))) continue;
        fetch('/play', { method: 'POST', body, headers: { 'content-type': 'text/plain' }, keepalive: true }).catch(() => {});
      } catch { /* never into the game */ }
    }
  };

  // THE OPEN: "first time today / this week / this month / ever"
  let seen = null;
  try { seen = JSON.parse(store?.getItem(SEEN_KEY) || 'null'); } catch { /* private mode */ }
  const o = openFlags(seen, Date.now(), { fresh: !!fresh });
  seen = o.seen;
  const save = () => { try { store?.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* private mode */ } };
  save();
  push({ k: 'open', ...o.flags, fresh: !!fresh && o.flags.new, app: !!inApp });   // new to the game AND to this counter

  // THE NEW PLAYER'S JOURNEY: each first-time step once, on the day it happens
  const step = (s) => { if (!stepDue(seen, s)) return; seen = stepDone(seen, s); save(); push({ k: 'step', s }); };

  // TIME PLAYED: foreground seconds, reported when the page hides
  let shownAt = document.hidden ? 0 : performance.now();
  const hide = () => {
    if (shownAt) { push({ k: 'time', s: (performance.now() - shownAt) / 1000 }); shownAt = 0; }
    flush(true);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else shownAt = performance.now(); });
  addEventListener('pagehide', hide);
  setInterval(() => flush(false), FLUSH_MS);

  // A MATCH: one start, and one ending (end, quit or drop), whichever comes first
  let match = null;
  // A CRASH: a page that hit an error the game didn't catch, once per page (and whether a match was on)
  let crashed = false;
  const crash = () => { if (crashed) return; crashed = true; push({ k: 'err', m: !!match }); };
  addEventListener('error', crash);
  addEventListener('unhandledrejection', crash);
  const close = (k) => {
    if (!match) return;
    push({ k, mode: match.mode, s: (performance.now() - match.at) / 1000 });
    match = null;
  };
  const mode = (m) => (MODES.includes(m) ? m : null);
  return {
    modeEnter(m) { if (mode(m)) push({ k: 'enter', mode: m }); },
    matchStart({ mode: m }) {
      if (!mode(m)) return;
      match = { mode: m, at: performance.now() };
      push({ k: 'start', mode: m });
      if (m === 'tutorial') step('tut_start');
      else if (stepDue(seen, 'first_match')) step('first_match');
      else step('second_match');
    },
    matchOver() { const m = match?.mode; close('end'); if (m) step(m === 'tutorial' ? 'tut_done' : 'first_finish'); },
    unlock(type) { if (type === 'mythic') step('starter'); },
    step,
    matchQuit() { close('quit'); },
    disconnect() { close('drop'); },
  };
}

// the game's AN, with play stats counting alongside it
export function withPlayStats(an, ps) {
  const tee = (name) => (...a) => { try { ps[name](...a); } catch { /* never into the game */ } return an[name](...a); };
  return { ...an, modeEnter: tee('modeEnter'), matchStart: tee('matchStart'), matchOver: tee('matchOver'), matchQuit: tee('matchQuit'), disconnect: tee('disconnect'), unlock: tee('unlock'), step: (s) => { try { ps.step(s); } catch { /* never into the game */ } } };
}
