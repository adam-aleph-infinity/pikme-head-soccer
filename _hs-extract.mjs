// A HEAD SOCCER RECORDING → NUMBERED FRAMES WITH REAL TIMESTAMPS.
// Run: node _hs-extract.mjs hs-video/C07-3.mov [--out hs-video/C07-3] [--width 1280] [--jpg]
//
// Step 1 of 4 in docs/HS-RECORDING.md. Writes, into the out dir:
//   frames/00000.png …   every frame the recorder wrote, none dropped, none invented
//                        (--jpg: .jpg instead — a native iPhone recording is 2556 px wide and
//                        its PNGs run to gigabytes; --width N scales frames down to N px wide,
//                        default 1280 for anything wider. The calibration maps wall-to-wall
//                        in whatever pixels the frames have, so scaling changes no number.)
//   frames.json          [{i, t, dup?}] — t in seconds from the frame's own timestamp
//   meta.json            {clip, take, source, sourceSha256, width, height, containerFps, fps, …}
//
// WHY NOT JUST "60fps". An iPhone screen recording has a variable frame rate: when nothing on
// screen changes the recorder writes fewer frames, and under load it writes them late. Frame
// number × 1/60 is then a wrong clock, and every speed fitted from it is wrong by the same
// hidden factor. So frames are pulled out with passthrough timing (no frame duplicated or
// dropped to hit a rate) and each one keeps the presentation timestamp ffprobe reads off it.
//
// WHY DUPLICATES. If Head Soccer itself renders at 30fps, a 60fps recording shows every game
// frame twice. Fitting the repeat as a second sample 16ms later invents a pause in every
// motion. Each frame is compared with the last UNIQUE frame on a 320×180 gray thumbnail
// (tools/hs-track.mjs markDuplicates) and repeats are flagged `dup: true`; the fits skip them.
// The effective render rate — what the game actually drew at — is reported at the end.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { markDuplicates, effectiveFps } from './tools/hs-track.mjs';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!src || !existsSync(src)) {
  console.error('usage: node _hs-extract.mjs <video> [--out hs-video/<clip>-<take>] [--width 1280] [--jpg]');
  process.exit(1);
}

const has = (bin) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
if (!has('ffmpeg') || !has('ffprobe')) {
  console.error('ffmpeg/ffprobe not found. On a Mac:  brew install ffmpeg');
  process.exit(1);
}

// C07-3.mov → clip "C7", take 3, out dir hs-video/C07-3. M1-arcade-kor.mp4 → full match
// "M1" (take 1 unless it says -N), out dir named after the file. A file named anything else
// still extracts; it keeps its own name as the clip, and _hs-fit.mjs will not know which
// metrics it feeds.
const base = path.basename(src).replace(/\.[^.]+$/, '');
const m = /^([CM])0*(\d{1,2})(?:-(\d+))?/i.exec(base);
const clip = m ? m[1].toUpperCase() + m[2] : base;
const take = m?.[3] ? Number(m[3]) : 1;
const out = outIdx >= 0 ? args[outIdx + 1] : path.join('hs-video', base);
const wIdx = args.indexOf('--width');
const maxWidth = wIdx >= 0 ? Number(args[wIdx + 1]) : 1280;
const ext = args.includes('--jpg') ? 'jpg' : 'png';

// ─── timestamps ──────────────────────────────────────────────────────────────────────────────
const probe = spawnSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height:frame=best_effort_timestamp_time,pts_time',
  '-show_frames', '-of', 'json', src,
], { maxBuffer: 1 << 28, encoding: 'utf8' });
if (probe.status !== 0) { console.error(probe.stderr); process.exit(1); }
const info = JSON.parse(probe.stdout);
const stream = info.streams?.[0] ?? {};
const times = (info.frames ?? []).map((f) => Number(f.best_effort_timestamp_time ?? f.pts_time));
if (!times.length || times.some((t) => !Number.isFinite(t))) {
  console.error('ffprobe returned no usable frame timestamps');
  process.exit(1);
}
const t0 = times[0];
const rel = times.map((t) => +(t - t0).toFixed(6));

// ─── frames ──────────────────────────────────────────────────────────────────────────────────
// ffmpeg 5.1 renamed -vsync to -fps_mode; older builds only know the old spelling.
const ver = /ffmpeg version n?(\d+)\.(\d+)/.exec(spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout || '');
const newFlag = !ver || Number(ver[1]) > 5 || (Number(ver[1]) === 5 && Number(ver[2]) >= 1);
const passthrough = newFlag ? ['-fps_mode', 'passthrough'] : ['-vsync', 'passthrough'];

const framesDir = path.join(out, 'frames');
if (existsSync(framesDir)) rmSync(framesDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });
console.log(`extracting ${times.length} frames → ${framesDir}`);
// ffmpeg rotates by the recording's rotation metadata before this filter sees the frame, so
// iw is the UPRIGHT width. (ffprobe's width/height above are the coded, pre-rotation ones.)
// The muxer's "non monotonically increasing dts" warnings are silenced by -v error… mostly;
// they are harmless: frames are numbered by order, and their times come from ffprobe.
const ex = spawnSync('ffmpeg', ['-v', 'error', '-i', src, ...passthrough,
  '-vf', `scale='min(${maxWidth},iw)':-2:flags=area`, ...(ext === 'jpg' ? ['-q:v', '2'] : []),
  '-start_number', '0', path.join(framesDir, `%05d.${ext}`)], { stdio: 'inherit' });
if (ex.status !== 0) process.exit(1);
const written = readdirSync(framesDir).filter((f) => f.endsWith('.' + ext)).length;
const dims = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json',
  path.join(framesDir, `00000.${ext}`)], { encoding: 'utf8' }).stdout).streams[0];
if (written !== times.length) {
  console.warn(`⚠ ffmpeg wrote ${written} frames, ffprobe listed ${times.length} timestamps — ` +
    'timestamps are matched by index, so check the tail of the clip.');
}

// ─── duplicates ──────────────────────────────────────────────────────────────────────────────
const TW = 320, TH = 180;
const grays = await new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', src, ...passthrough,
    '-vf', `scale=${TW}:${TH},format=gray`, '-f', 'rawvideo', 'pipe:1']);
  const list = [];
  let buf = Buffer.alloc(0);
  p.stdout.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= TW * TH) {
      list.push({ w: TW, h: TH, f: 1, data: new Uint8Array(buf.subarray(0, TW * TH)) });
      buf = buf.subarray(TW * TH);
    }
  });
  p.on('error', reject);
  p.on('close', (code) => (code === 0 ? resolve(list) : reject(new Error('ffmpeg thumbnail pass failed'))));
});
const dup = markDuplicates(grays);

const n = Math.min(written, times.length);
const frames = [];
for (let i = 0; i < n; i++) frames.push(dup[i] ? { i, t: rel[i], dup: true } : { i, t: rel[i] });
writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames));

const sha = await new Promise((resolve, reject) => {
  const h = createHash('sha256');
  createReadStream(src).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
});
const containerFps = effectiveFps(rel.slice(0, n), null);
const fps = effectiveFps(rel.slice(0, n), dup);
const meta = {
  clip, take, source: path.basename(src), sourceSha256: sha,
  // The frames as written: upright (ffmpeg autorotates) and possibly scaled down.
  width: dims.width, height: dims.height, ext,
  sourceWidth: stream.width, sourceHeight: stream.height,
  frames: n, duplicates: dup.slice(0, n).filter(Boolean).length,
  duration: rel[n - 1], containerFps, fps,
};
writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));

console.log(`${clip} take ${take}: ${n} frames over ${meta.duration.toFixed(2)}s, ${meta.duplicates} duplicates`);
console.log(`recorder ${containerFps?.toFixed(1)} fps, game rendered at ~${fps?.toFixed(1)} fps (unique frames)`);
if (fps && fps < 50) console.log('  → the game (or the recording) is under 60fps: timing floor is one unique frame, ' + (1000 / fps).toFixed(0) + 'ms.');
console.log(`next: node _hs-measure.mjs   then open http://127.0.0.1:3031/?clip=${path.basename(out)}`);
