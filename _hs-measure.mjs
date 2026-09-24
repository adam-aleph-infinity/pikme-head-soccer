// THE MEASURING PAGE'S SERVER. Run: node _hs-measure.mjs [--port 3031] [--video hs-video]
// then open http://127.0.0.1:3031/
//
// Step 2 of 4 in docs/HS-RECORDING.md. A tiny static server, separate from server.js on
// purpose: production serves only public/ and shared/, and this tool — and the recordings it
// reads — must never end up there. It binds to 127.0.0.1 only.
//
//   /                          tools/hs-measure/index.html (and its js/css)
//   /tools/*.mjs               the pure modules the page imports (calibration, tracker)
//   /api/world                 {W, GROUND_Y} from shared/constants.js — the target of the mapping
//   /api/clips                 extracted clip dirs under hs-video/ (those with a frames.json)
//   /video/<clip>/...          frames.json, meta.json, frames/NNNNN.png
//   /api/tracks/<clip>         GET an existing docs/hs-clips/<clip>.tracks.json (to keep working)
//   POST /api/tracks/<clip>    save it — the page's Save button
import http from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as C from './shared/constants.js';

const ROOT = import.meta.dirname;
const arg = (name, def) => { const k = process.argv.indexOf(name); return k >= 0 ? process.argv[k + 1] : def; };
const PORT = Number(arg('--port', process.env.HS_MEASURE_PORT || 3031));
const VIDEO = path.resolve(ROOT, arg('--video', 'hs-video'));
const TOOL = path.join(ROOT, 'tools', 'hs-measure');
const CLIPS_OUT = path.join(ROOT, 'docs', 'hs-clips');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

// A clip name is the only user-controlled path segment; keep it to what _hs-extract writes.
const CLIP_RE = /^[A-Za-z0-9_.-]{1,64}$/;

// Serve a file only if it resolves inside `dir` — no ../ out of the sandbox.
function sendFile(res, dir, rel) {
  const file = path.resolve(dir, '.' + path.sep + rel);
  if (!file.startsWith(dir + path.sep) && file !== dir) return notFound(res);
  if (!existsSync(file) || !statSync(file).isFile()) return notFound(res);
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
}
const notFound = (res) => { res.writeHead(404); res.end('not found'); };
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  if (p === '/' || p === '/index.html') return sendFile(res, TOOL, 'index.html');
  if (p === '/api/world') return json(res, { W: C.W, GROUND_Y: C.GROUND_Y, GOAL_H: C.GOAL_H, GOAL_W: C.GOAL_W, HEAD_R: C.HEAD_R ?? null });
  if (p === '/api/clips') {
    const list = existsSync(VIDEO) ? readdirSync(VIDEO).filter((d) => existsSync(path.join(VIDEO, d, 'frames.json'))) : [];
    return json(res, list.sort().map((d) => ({ clip: d, saved: existsSync(path.join(CLIPS_OUT, `${d}.tracks.json`)) })));
  }
  if (p.startsWith('/video/')) return sendFile(res, VIDEO, p.slice('/video/'.length));
  if (p.startsWith('/tools/') && p.endsWith('.mjs')) return sendFile(res, path.join(ROOT, 'tools'), p.slice('/tools/'.length));

  const t = /^\/api\/tracks\/([^/]+)$/.exec(p);
  if (t) {
    const name = t[1];
    if (!CLIP_RE.test(name)) return json(res, { error: 'bad clip name' }, 400);
    const file = path.join(CLIPS_OUT, `${name}.tracks.json`);
    if (req.method === 'GET') return existsSync(file) ? sendFile(res, CLIPS_OUT, `${name}.tracks.json`) : json(res, null);
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; if (body.length > 64 << 20) req.destroy(); });
      req.on('end', () => {
        let doc;
        try { doc = JSON.parse(body); } catch { return json(res, { error: 'not JSON' }, 400); }
        if (!doc || !Array.isArray(doc.frames) || !Array.isArray(doc.tags)) return json(res, { error: 'need frames[] and tags[]' }, 400);
        mkdirSync(CLIPS_OUT, { recursive: true });
        writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
        console.log(`saved ${path.relative(ROOT, file)} (${doc.frames.length} frames, ${doc.tags.length} tags)`);
        json(res, { ok: true, file: path.relative(ROOT, file) });
      });
      return;
    }
  }
  return sendFile(res, TOOL, p.slice(1));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`hs-measure on http://127.0.0.1:${PORT}/  (clips from ${path.relative(ROOT, VIDEO) || '.'}/, saves to docs/hs-clips/)`);
});
