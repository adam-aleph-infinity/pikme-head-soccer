// Dumb static server. The match runs entirely in the browser for now — this exists only so
// the phone on the LAN can load it, and so `/shared` is reachable from the client's imports.
// When this graduates to real 1v1, server.js becomes the authoritative host and `shared/sim.js`
// is already the thing both sides run.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3020;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

// Only these two trees are served. Anything else 404s rather than walking the repo.
const ALLOWED = ['public', 'shared'];

const server = http.createServer((req, res) => {
  // Parse by hand: `new URL('//', base)` reads as protocol-relative and throws, and a
  // request line of `//` is exactly what a stray trailing slash in a curl sends.
  let rel = (req.url || '/').split('?')[0].split('#')[0];
  try { rel = decodeURIComponent(rel); } catch { /* keep the raw path */ }
  rel = '/' + rel.split('/').filter(Boolean).join('/');
  if (rel === '/') rel = '/index.html';

  // /shared/* maps to the repo's shared folder; everything else lives under /public.
  const first = rel.split('/')[1];
  const abs = ALLOWED.includes(first)
    ? path.join(ROOT, rel)
    : path.join(ROOT, 'public', rel);

  const safe = path.normalize(abs);
  if (!ALLOWED.some((d) => safe.startsWith(path.join(ROOT, d)))) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(safe, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(safe)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`⚽ head-soccer mock`);
  console.log(`   local   http://localhost:${PORT}`);
  for (const ip of nets) console.log(`   phone   http://${ip}:${PORT}`);
});
