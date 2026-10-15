// GAMEPLAY ANALYTICS ON THE PAGE (the rules are shared/analytics.js; docs/ANALYTICS.md the whole story).
// The game calls the small typed functions at the bottom; nothing outside this file knows the
// provider is PostHog, and nothing here can stop a match: every send is fire-and-forget.
//
// No SDK: one fetch to PostHog's batch endpoint. So there is no autocapture, no session replay, no
// heatmaps, no cookies — that code is simply not on the page.
//
// THE SWITCHES
//   KEY empty                      analytics is off, completely (the default until a key is set)
//   dev host (localhost, Wi-Fi)    off unless ?analytics=send
//   ?analytics=debug               logs every event to the console and window.__ANALYTICS_LOG; sends nothing
//   ?analytics=send                sends, and logs too (failures included)
//   consent                        the Saltiz app's window.SALTIZ_ANALYTICS (true / false); absent = nothing
//                                  is kept. The player's Options switch can only turn it off. ?consent=1
//                                  stands in for the app on a dev host.
import { createAnalytics, OFF_KEY } from '../shared/analytics.js';
import { PROTOCOL } from '../shared/net.js';

const KEY = 'phc_kFXjpSDojMedK24chA7kxLsmbBFVJp4oHNYH73LF5ZPa';   // PostHog project API key (public, phc_…)
const HOST = 'https://eu.i.posthog.com';          // PostHog EU cloud
const FLUSH_MS = 15000;

export function createAnalyticsClient({ store, devHost, params }) {
  const flag = params.get('analytics');
  const debug = flag === 'debug';
  const sending = !!KEY && !debug && (!devHost || flag === 'send');
  const verbose = debug || flag === 'send';
  const LOG = [];
  const log = verbose ? (...a) => { LOG.push(a); console.debug('[analytics]', ...a); } : null;
  if (verbose) window.__ANALYTICS_LOG = LOG;
  const failures = { n: 0 };

  // the app's word, or the dev stand-in for it
  const hostConsent = () => {
    const v = window.SALTIZ_ANALYTICS;
    if (v === true || (devHost && params.get('consent') === '1')) return 'granted';
    return v === false ? 'denied' : 'unknown';
  };
  const playerOff = () => { try { return store?.getItem(OFF_KEY) === '1'; } catch { return false; } };
  const decide = () => (playerOff() ? 'denied' : hostConsent());

  const platform = window.SALTIZ_CARDS || window.SALTIZ_NAME ? 'saltiz_ios'
    : matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ? 'pwa' : 'web';
  let version = 'unknown';
  // the deployed commit (server.js /version); a local server has none
  if (sending || debug) {
    fetch('/version').then((r) => r.json()).then((v) => { version = /^[0-9a-f]{7,40}$/.test(v?.commit || '') ? v.commit.slice(0, 7) : 'dev'; }).catch(() => {});
  }

  function post(body, beacon, retry = true) {
    const url = `${HOST}/batch/`;
    // text/plain needs no CORS preflight, so a page being closed can still get it out
    if (beacon && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
    fetch(url, { method: 'POST', body, headers: { 'content-type': 'text/plain' }, credentials: 'omit', keepalive: body.length < 60000 })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
      .catch((e) => {
        if (retry) { setTimeout(() => post(body, false, false), 5000); return; }
        failures.n++;
        log?.('send failed, dropped', String(e));
      });
  }
  function send(events, how) {
    if (!sending) { log?.(`(debug) would send ${events.length}`, events.map((e) => e.event)); return; }
    const body = JSON.stringify({
      api_key: KEY,
      batch: events.map((e) => ({
        event: e.event,
        timestamp: new Date(e.ts).toISOString(),
        distinct_id: e.distinct_id,
        properties: {
          ...e.props, session_id: e.session_id, platform, app_version: version, protocol: PROTOCOL,
          $process_person_profile: false,   // anonymous events: no person profiles
          $geoip_disable: true,             // no city / country looked up from the address
          $lib: 'salties-web',
        },
      })),
    });
    post(body, how === 'unload');
  }

  const core = sending || debug
    ? createAnalytics({ storage: store, uuid: () => crypto.randomUUID(), send, log })
    : null;
  if (core) {
    core.setConsent(decide());
    if (document.hidden) core.hidden();
    document.addEventListener('visibilitychange', () => (document.hidden ? core.hidden() : core.shown()));
    addEventListener('pagehide', () => core.hidden());
    setInterval(() => { core.tick(); core.flush(); }, FLUSH_MS);
    // the app may decide after the page has loaded
    window.saltizSetAnalytics = (on) => { window.SALTIZ_ANALYTICS = !!on; core.setConsent(decide()); if (document.hidden) core.hidden(); };
    if (verbose) window.__ANALYTICS = { core, failures };
  }

  // ── what the game calls ── (all of them do nothing when analytics is off)
  const safe = (f) => (...a) => { if (!core) return; try { f(...a); } catch (e) { log?.('error', e); } };
  const champ = (c) => (c && c.rarity && c.number ? `${c.rarity}_${c.number}` : undefined);
  let mmAt = 0;
  const waited = () => Math.max(0, Math.round((performance.now() - mmAt) / 1000));
  return {
    // the player left for the app through יציאה: the WebView may be torn down without a pagehide
    leaving: safe(() => core.hidden()),
    // the Options switch: shown only when the app has said yes; it can turn analytics off and on again
    canToggle: () => !!core && hostConsent() === 'granted',
    isOn: () => !!core && core.consent === 'granted',
    setPlayerOn: safe((on) => {
      try { if (on) store?.removeItem(OFF_KEY); else store?.setItem(OFF_KEY, '1'); } catch { /* private mode */ }
      core.setConsent(decide());
    }),
    modeEnter: safe((m) => core.modeEnter(m)),
    modeExit: safe(() => core.modeExit()),
    mmStart: safe((trophies) => { mmAt = performance.now(); core.track('matchmaking_start', { trophies }); }),
    mmFound: safe(() => core.track('matchmaking_found', { wait_s: waited() })),
    mmCancel: safe(() => core.track('matchmaking_cancel', { wait_s: waited() })),
    matchStart: safe(({ mode, me, trophies, oppTrophies, vsCpu }) =>
      core.matchStart({ mode, champ: champ(me), trophies, opp_trophies: oppTrophies, vs_cpu: vsCpu })),
    matchOver: safe(() => core.matchOver()),
    matchEnd: safe(({ result, score, trophyDelta, trophies, ranked }) =>
      core.matchEnd({ result, score_me: score?.[0], score_opp: score?.[1], trophy_delta: trophyDelta, trophies, ranked })),
    matchQuit: safe((score) => core.matchQuit({ score_me: score?.[0], score_opp: score?.[1] })),
    disconnect: safe(() => core.disconnect()),
    unlock: safe((type, id, level) => core.track('item_unlock', { item_type: type, item_id: id, level })),
    trophyMilestone: safe((arena) => core.track('trophy_milestone', { arena })),
    welcomePopupSeen: safe(() => core.track('welcome_popup_seen', {})),
    feedbackClicked: safe((location) => core.track('feedback_clicked', { location })),
  };
}
