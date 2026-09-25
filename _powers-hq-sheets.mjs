// THE POWERS' COMPARISON SHEETS — Head Soccer's frame beside ours at the same moment and the same
// head size, for the pieces we filmed (the press glow, the cut-in, Korea's comet, the block, the
// stars), and ours at 844×390 2x and 3x for all five powers.
//
//   node _powers-hq.mjs stills --dpr 2 && node _powers-hq.mjs stills --dpr 3 && node _powers-hq.mjs block
//   node _powers-hq-sheets.mjs        → .shots/powers-hq/sheets/{armed,cutin,comet,block,stars}.png,
//                                       powers-2x.png, powers-3x.png
//
// The HS frames are pulled from Idan's recordings (hs-video/, not in git) only to be LOOKED AT
// here; nothing from them goes into the game.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const FF = '/opt/homebrew/bin/ffmpeg';
const ROOT = `${import.meta.dirname}/.shots/powers-hq`, OUT = `${ROOT}/sheets`;
const VID = process.env.HS_VIDEO || `${import.meta.dirname}/hs-video`;
mkdirSync(`${OUT}/tmp`, { recursive: true });
const ff = (args) => { const r = spawnSync(FF, ['-v', 'error', '-y', ...args]); if (r.status) console.log(String(r.stderr).slice(0, 300)); };
const pos = (dir) => (existsSync(`${ROOT}/${dir}/pos.json`) ? JSON.parse(readFileSync(`${ROOT}/${dir}/pos.json`, 'utf8')) : {});

// HS: one frame of M4 (2556×1180 after rotation; 2 frame px a world px), cropped
const HS_HEAD = 2 * 26.4;                    // HS head radius in frame px
function hs(name, t, [x, y, w, h]) {
  const f = `${OUT}/tmp/hs-${name}.png`;
  ff(['-ss', String(t), '-i', `${VID}/M4-gaps.mp4`, '-frames:v', '1', '-vf', `crop=${w}:${h}:${x}:${y}`, f]);
  return f;
}
// ours: the same world box round `at`, scaled to the HS crop's size (same head size on the sheet)
function ours(dir, file, at, [ox, oy, w, h], tag) {
  const P = pos(dir)[file];
  if (!P) return null;
  const k = P.k / 2;                         // our device px per HS frame px
  const c = at === 'ball' ? P.ball : at === 'defender' ? P.defender : P.shooter;
  const cw = Math.round(w * k), ch = Math.round(h * k), cx = Math.round(c.x + ox * k), cy = Math.round(c.y + oy * k);
  const f = `${OUT}/tmp/ours-${tag}.png`;
  ff(['-i', `${ROOT}/${dir}/${file}`, '-vf', `crop=${cw}:${ch}:${Math.max(0, cx)}:${Math.max(0, cy)},scale=${w}:${h}:flags=lanczos`, f]);
  return f;
}
function pair(name, A, B, H = 420) {
  if (!A || !B) { console.log(`  ✗ ${name}: missing ${A ? 'ours' : 'HS'}`); return; }
  // Head Soccer on the LEFT, ours on the RIGHT (this ffmpeg has no drawtext for labels)
  ff(['-i', A, '-i', B, '-filter_complex', `[0:v]scale=-2:${H},pad=iw+8:ih:0:0:white[a];[1:v]scale=-2:${H}[b];[a][b]hstack=inputs=2`, `${OUT}/${name}.png`]);
  console.log(`  ✓ ${OUT}/${name}.png`);
}

// crops, in HS frame px, relative to the thing they are about (the head centre, the ball)
// ARMED (M4 36.55 s): the head 130 px across → a 300×280 box round it
pair('armed', hs('armed', 36.55, [590, 740, 300, 280]), ours('2x', 'stage-01-a2-armed.png', 'shooter', [-150, -170, 300, 280], 'armed'), 420);
// CUT-IN (M4 40.62 s): 1000×760 round the shooter's head
pair('cutin', hs('cutin', 40.62, [1350, 380, 1000, 760]), ours('2x', 'stage-01-b3-cut.png', 'shooter', [-500, -390, 1000, 760], 'cutin'), 520);
// COMET (M4 43.15 s): 1400×560, the ball ≈ 950 px from the left, 170 down
pair('comet', hs('comet', 43.15, [200, 560, 1400, 560]), ours('2x', 'stage-01-d-fly.png', 'ball', [-450, -180, 1400, 560], 'comet'), 360);
// BLOCK (M4 61.65 s): 440×340 round the orb
pair('block', hs('block', 61.65, [900, 660, 440, 340]), ours('block', 'grind-03.png', 'ball', [-220, -170, 440, 340], 'block'), 420);
// STARS (M4 80.95 s): 360×260 round the dazed head
pair('stars', hs('stars', 80.95, [1300, 700, 360, 260]), ours('block', 'stars-1.png', 'shooter', [-180, -170, 360, 260], 'stars'), 420);

// all five powers at both scales: one row a power, press → cut-in → flight → impact → after
const MOMENTS = ['a2-armed', 'b3-cut', 'c-fly', 'd-fly', 'e-fly', 'f-impact', 'g-after'];
for (const dpr of ['2x', '3x']) {
  const rows = [];
  for (const n of [1, 2, 3, 4, 5]) {
    const files = MOMENTS.map((m) => `${ROOT}/${dpr}/stage-0${n}-${m}.png`).filter(existsSync);
    if (files.length < MOMENTS.length) continue;
    const row = `${OUT}/tmp/row-${dpr}-${n}.png`;
    ff([...files.flatMap((f) => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}:v]scale=480:-2,pad=iw+4:ih+4:2:2:white[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${files.length}`, row]);
    rows.push(row);
  }
  if (rows.length) { ff([...rows.flatMap((f) => ['-i', f]), '-filter_complex', `${rows.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${rows.length}`, `${OUT}/powers-${dpr}.png`]); console.log(`  ✓ ${OUT}/powers-${dpr}.png`); }
}
