// tools/hs-flame-mask.mjs — HS footage study only (nothing from it goes into the game).
// Isolate the armed flames in HS footage: pixels that are bright yellow/white AND differ from an
// empty background frame of the same (static) camera. Writes an enlarged white-on-black sheet.
// node mask.mjs <video> <t0> <frames> <step> <x> <y> <w> <h> <bgT> <out.png> [cols]
import { spawnSync } from 'node:child_process';
const [vid, t0, n, step, x, y, w, h, bgT, out, cols = 6] = process.argv.slice(2);
const W = +w, H = +h, N = +n, ST = +step, FF = '/opt/homebrew/bin/ffmpeg';
const grab = (t, frames) => spawnSync(FF, ['-v', 'error', '-ss', String(t), '-i', vid, '-frames:v', String(frames), '-vf', `crop=${W}:${H}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 }).stdout;
const bg = grab(bgT, 1), all = grab(t0, N * ST), F = W * H * 3;
const C = +cols, R = Math.ceil(N / C), OW = W * C, OH = H * R, img = Buffer.alloc(OW * OH * 3);
for (let k = 0; k < N; k++) {
  const f = all.subarray(k * ST * F, (k * ST + 1) * F), ox = (k % C) * W, oy = Math.floor(k / C) * H;
  for (let i = 0; i < W * H; i++) {
    const r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2];
    const d = Math.abs(r - bg[i * 3]) + Math.abs(g - bg[i * 3 + 1]) + Math.abs(b - bg[i * 3 + 2]);
    // flame light: red and green high, blue lower (lemon) or all high (white core); must be new
    const lum = (r + g) / 2, yel = lum - b;
    let v = 0;
    if (d > 60 && r > 170 && g > 160) v = Math.min(255, (lum - 150) * 2.2 + Math.max(0, yel) * 0.4);
    const gray = b > 215 && r > 235 && g > 235 ? 255 : v;          // the white core
    const o = ((oy + Math.floor(i / W)) * OW + ox + (i % W)) * 3;
    // show: white core white, yellow body yellow, faint glow dim
    img[o] = gray; img[o + 1] = gray; img[o + 2] = b > 215 && gray === 255 ? 255 : gray * 0.3;
  }
}
spawnSync(FF, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${OW}x${OH}`, '-i', '-', '-vf', `scale=${OW * (+process.env.Z || 1.5)}:${OH * (+process.env.Z || 1.5)}:flags=neighbor`, out], { input: img });
console.log('ok', out);
