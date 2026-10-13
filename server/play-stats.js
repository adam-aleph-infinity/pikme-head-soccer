// PLAY STATS ON THE SERVER (shared/play-stats.js has the rules; docs/PLAY-STATS.md the whole story).
// One table of daily counters in the league's SQLite file: (day, key) → n. No row names a device.
//   POST /play            a page's batch of events → +n on today's counters. Always 204.
//   GET  /stats/history   every day / week / month so far, summed (JSON). ?days=N limits it.
import { countBatch, summarize, dayOf } from '../shared/play-stats.js';

const MAX_BODY = 8192;
const PER_MIN = 60;                            // POSTs per address per minute; more are dropped

export function createPlayStats(db, { now = () => Date.now() } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS play_daily (
    day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, key))`);
  const inc = db.prepare(`INSERT INTO play_daily (day, key, n) VALUES (?, ?, ?)
    ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n`);
  const since = db.prepare('SELECT day, key, n FROM play_daily WHERE day >= ?');
  const hits = new Map();
  setInterval(() => hits.clear(), 60000).unref();

  function add(body) {
    const c = countBatch(body);
    if (!c) return 0;
    const day = dayOf(now());
    db.exec('BEGIN');
    try { for (const [k, n] of Object.entries(c)) inc.run(day, k, n); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    return Object.keys(c).length;
  }

  function history(days) {
    const from = Number.isInteger(days) && days > 0 ? dayOf(now() - (days - 1) * 86400000) : '0000';
    return summarize(since.all(from));
  }

  // the HTTP side; returns true when it answered
  function handle(req, res, rel, query) {
    if (rel === '/play' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const n = (hits.get(ip) || 0) + 1;
      hits.set(ip, n);
      let size = 0; const chunks = [];
      req.on('data', (b) => { size += b.length; if (size <= MAX_BODY) chunks.push(b); });
      req.on('end', () => {
        if (n <= PER_MIN && size <= MAX_BODY) {
          try { add(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { /* a bad batch counts nothing */ }
        }
        res.writeHead(204, { 'cache-control': 'no-store' }).end();
      });
      return true;
    }
    if (rel === '/stats/history' && req.method === 'GET') {
      const d = Number(query.get('days'));
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(history(Number.isInteger(d) ? d : undefined), null, 1));
      return true;
    }
    return false;
  }

  return { add, history, handle };
}
