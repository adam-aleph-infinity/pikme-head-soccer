// PLAYERS' BUG REPORTS AND SUGGESTIONS (Options → דווחו על באג או שלחו הצעות). The game posts here;
// we pass it on to an anonymous Google Form, whose answers land in its Google Sheet. Nothing is
// kept on this server (its SQLite file goes with every deploy, docs/PLAY-STATS.md).
//   GET  /feedback   {on}: is a form set up? The Options button only shows when it is.
//   POST /feedback   {kind: 'bug'|'idea', text} → {ok:true} only when Google took it; else an error.
// The form is set by env vars (Render's dashboard, render.yaml), never sent to the page:
//   FEEDBACK_FORM_ID          the id in the form's link: docs.google.com/forms/d/e/<id>/viewform
//   FEEDBACK_ENTRY_KIND       entry.NNN of the "סוג" question (באג / הצעה)
//   FEEDBACK_ENTRY_TEXT       entry.NNN of the "הודעה" question
//   FEEDBACK_ENTRY_VERSION    entry.NNN of "גרסה" (optional): the deployed commit
// Players may be children: no name, no device id, no address is passed on — only what they typed.

const MAX_BODY = 4096;
const MIN_TEXT = 3, MAX_TEXT = 1000;
const PER_WINDOW = 5, WINDOW_MS = 10 * 60000;   // posts per address per ten minutes
const TIMEOUT_MS = 8000;
export const KINDS = { bug: 'באג', idea: 'הצעה' };

// the post Google gets, or an error code: pure, so the tests can read it
export function formBody(body, cfg, version) {
  const kind = body?.kind, text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!Object.hasOwn(KINDS, kind)) return { err: 'kind' };
  if (text.length < MIN_TEXT || text.length > MAX_TEXT) return { err: 'text' };
  const p = new URLSearchParams({ [cfg.kind]: KINDS[kind], [cfg.text]: text });
  if (cfg.version) p.set(cfg.version, version);
  return { params: p };
}

export function createFeedback({ env = process.env, fetchFn = (...a) => fetch(...a), now = () => Date.now(), formBase = 'https://docs.google.com/forms/d/e' } = {}) {
  const cfg = { id: env.FEEDBACK_FORM_ID, kind: env.FEEDBACK_ENTRY_KIND, text: env.FEEDBACK_ENTRY_TEXT, version: env.FEEDBACK_ENTRY_VERSION };
  const on = !!(cfg.id && cfg.kind && cfg.text);
  // FEEDBACK_FORM_URL — the whole formResponse address instead (the harness's stand-in for Google)
  const url = env.FEEDBACK_FORM_URL || `${formBase}/${encodeURIComponent(cfg.id || '')}/formResponse`;
  const version = (env.RENDER_GIT_COMMIT || 'local').slice(0, 7);
  const hits = new Map();

  const reply = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(obj));
  function limited(ip) {
    const t = now(), list = (hits.get(ip) || []).filter((x) => t - x < WINDOW_MS);
    if (list.length >= PER_WINDOW) { hits.set(ip, list); return true; }
    hits.set(ip, [...list, t]);
    if (hits.size > 5000) hits.clear();          // a flood of addresses cannot grow it forever
    return false;
  }

  async function forward(params) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetchFn(url, { method: 'POST', body: params, signal: ctl.signal, redirect: 'manual',
        headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      return r.status >= 200 && r.status < 300;
    } catch { return false; } finally { clearTimeout(t); }
  }

  // the HTTP side; returns true when it answered
  function handle(req, res, rel) {
    if (rel !== '/feedback') return false;
    if (req.method === 'GET') { reply(res, 200, { on }); return true; }
    if (req.method !== 'POST') { reply(res, 405, { ok: false, err: 'method' }); return true; }
    let size = 0; const chunks = [];
    req.on('data', (b) => { size += b.length; if (size <= MAX_BODY) chunks.push(b); });
    req.on('end', async () => {
      if (!on) return reply(res, 503, { ok: false, err: 'off' });
      if (size > MAX_BODY) return reply(res, 413, { ok: false, err: 'size' });
      let body = null;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* answered below */ }
      const f = formBody(body, cfg, version);
      if (f.err) return reply(res, 400, { ok: false, err: f.err });
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (limited(ip)) return reply(res, 429, { ok: false, err: 'busy' });
      const ok = await forward(f.params);
      reply(res, ok ? 200 : 502, ok ? { ok: true } : { ok: false, err: 'form' });
    });
    return true;
  }

  return { on, handle };
}
