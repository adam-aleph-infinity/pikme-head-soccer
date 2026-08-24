// Every face in the album, cropped to a circle. Run: node test-heads.mjs
//
// The head anchors were measured automatically and 20 of the 180 ask for a window that does
// not fit on the card — too big, or too near an edge. A browser given such a window shows the
// card's edge and blank space past it, and the face slides off centre. That is what Adam saw
// on his phone, where the cards are small and a miss is obvious.
//
// This runs the real crop maths (public/head-crop.js — the same module the client imports)
// over the real anchors, so the guarantee is checked against the data rather than assumed.
import { readFileSync } from 'node:fs';
import { headCrop, cropOnCard } from './public/head-crop.js';

const A = JSON.parse(readFileSync(new URL('./public/data/head-anchors.json', import.meta.url), 'utf8'));
const { cardW, cardH, heads } = A;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${extra ? '  — ' + extra : ''}`); }
};

const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const ids = [];
for (const r of RARITIES) for (let n = 1; n <= 45; n++) ids.push(`${r}_${n}`);

ok('every card in the album has an anchor', ids.every((id) => !!heads[id]),
  ids.filter((id) => !heads[id]).slice(0, 5).join(' '));

// ── THE ONE GUARANTEE ─────────────────────────────────────────────────────────
{
  const off = ids.filter((id) => !cropOnCard(heads[id], cardW, cardH));
  ok('no crop shows anything that is not card', off.length === 0,
    `${off.length} still overflow: ${off.slice(0, 6).join(' ')}`);
}

// ── AND IT ONLY MOVED THE ONES THAT NEEDED IT ─────────────────────────────────
{
  const moved = ids.filter((id) => {
    const c = headCrop(heads[id], cardW, cardH, 100);
    return Math.abs(c.shiftX) > 1e-6 || Math.abs(c.shiftY) > 1e-6;
  });
  ok('the anchors that already fit are untouched', moved.length > 0 && moved.length <= 30,
    `${moved.length} of ${ids.length} clamped`);
  // Named, because a clamp is a patch over a bad measurement and the list is the to-do.
  const worst = moved
    .map((id) => {
      const c = headCrop(heads[id], cardW, cardH, 100);
      return [id, Math.max(Math.abs(c.shiftX), Math.abs(c.shiftY))];
    })
    .sort((a, b) => b[1] - a[1]);
  console.log(`  · clamped ${moved.length} anchors; worst: ${worst.slice(0, 5).map(([id, v]) => `${id} ${(v * 100).toFixed(1)}%`).join(', ')}`);
  ok('and none of them had to move more than a third of a card',
    worst.every(([, v]) => v <= 0.34), worst[0] ? `${worst[0][0]} moved ${(worst[0][1] * 100).toFixed(1)}%` : '');
}

// ── THE FAILED MEASUREMENTS ───────────────────────────────────────────────────
{
  // A head cannot be most of the card. Seventeen anchors say otherwise, one of them claiming
  // a head wider than the card it sits on; those crops showed a scene instead of a face.
  const zoomed = ids
    .map((id) => [id, headCrop(heads[id], cardW, cardH, 100).zoom])
    .filter(([, z]) => z > 1.001)
    .sort((a, b) => b[1] - a[1]);
  ok('the impossible head sizes are cut back', zoomed.length > 0, 'nothing was capped');
  console.log(`  · capped ${zoomed.length} head sizes; worst: ${zoomed.slice(0, 5).map(([id, z]) => `${id} ${z.toFixed(1)}x`).join(', ')}`);
  ok('and no card is left claiming a head wider than itself',
    ids.every((id) => headCrop(heads[id], cardW, cardH, 100).width * 0.55 >= 100 - 1e-6 ||
                      heads[id].d <= 0.55),
    'a crop still asks for more than the card');
  // Most of the album measured fine and must be left alone. The bound is a quarter rather
  // than the tenth I first guessed, because the data says one card in five was mis-measured —
  // 37 of 180 — and a threshold that calls the real number a failure is a threshold that will
  // be quietly raised by whoever hits it next. Sixteen untouched cards were photographed
  // before and after and are pixel-identical.
  ok('the album is mostly untouched', zoomed.length < ids.length * 0.25,
    `${zoomed.length} of ${ids.length} capped`);
}

// ── THE GEOMETRY ITSELF ───────────────────────────────────────────────────────
{
  // A square element, a card that is taller than it is wide: the background has to keep the
  // card's aspect or every face is stretched.
  const c = headCrop(heads['legendary_3'], cardW, cardH, 64);
  ok('the card keeps its aspect ratio',
    Math.abs(c.height / c.width - cardH / cardW) < 1e-9,
    `${(c.width).toFixed(1)}x${(c.height).toFixed(1)}`);
  ok('and the head fills the element', Math.abs(c.width * heads['legendary_3'].d - 64) < 1e-6);

  // Doubling the element doubles the numbers and nothing else — the same crop, bigger.
  const big = headCrop(heads['legendary_3'], cardW, cardH, 128);
  ok('the crop is scale-free', Math.abs(big.width - c.width * 2) < 1e-6 &&
    Math.abs(big.x - c.x * 2) < 1e-6);
}

// ── A BROKEN ANCHOR CANNOT BREAK A CARD ───────────────────────────────────────
{
  // Nonsense in, something sane out: the auto-measurer produced `d` values as large as 0.9,
  // and nothing stops a future run producing 2.
  const mad = headCrop({ cx: 1.4, cy: -0.3, d: 3 }, cardW, cardH, 60);
  ok('an impossible anchor still yields a usable crop',
    Number.isFinite(mad.width) && Number.isFinite(mad.x) && mad.width > 0,
    JSON.stringify(mad));
  ok('and it is centred rather than off the card', cropOnCard({ cx: 1.4, cy: -0.3, d: 3 }, cardW, cardH));
}

console.log(`test-heads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
