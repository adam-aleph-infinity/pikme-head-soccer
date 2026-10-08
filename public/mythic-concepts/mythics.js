// THE FOUR MYTHIC STARTERS, as the artist drew them (uploaded-images/champ_A–D; Idan,
// 2026-10-08). Proposals only: nothing in the game reads this file.
//
// Every detail here is read off the four views of each sheet: the hair (its shape, colour,
// what is long and what is faded), the eyes, brows, beard and glasses, the skin, and the kit
// (shirt, white yoke, trim, the gold hexagon badge, the number front and back, shorts, socks,
// boots). rig.js places it on the model; the options (STYLES) change only HOW it is drawn.

const P = Math.PI;
const ring = (n, a0, a1, f) => Array.from({ length: n }, (_, i) => f(n === 1 ? a0 : a0 + ((a1 - a0) * i) / (n - 1), i));

// ---- champ_A: Shoval (#24, black kit) ----
const shovalHair = () => {
  const els = [];
  // the front: thick waves swept up off the forehead, narrow at the root, full in the middle,
  // their tips flicking up and back past the outline
  ring(7, -1.15, 1.15, (t, i) => { const w = i % 2 ? 0.16 : -0.12; els.push({ t: 'lock', w: [8, 21, 2], k: [[t, 0.28, 3], [t * 1.03 + w * 0.3, 0.13, 13], [t * 1.06 + w, 0.02, 19], [t * 1.1 + w * 2.2 + Math.sign(t || 1) * 0.15, 0.0, 24]] }); });
  // the back: full, wavy clumps down to the nape
  ring(7, P - 1.3, P + 1.3, (t, i) => { const w = i % 2 ? 0.12 : -0.12; els.push({ t: 'lock', w: [14, 20, 3], k: [[t, 0.0, 17], [t + w, 0.22, 12], [t - w * 0.5, 0.45, 7], [t + w, 0.62, 3.5]] }); });
  // the sides, shorter, over the ears
  for (const s of [-1, 1]) els.push({ t: 'lock', w: [12, 16, 3], k: [[s * 1.0, 0.04, 17], [s * 1.3, 0.22, 10], [s * 1.48, 0.4, 4]] });
  // the wave that falls onto the forehead (his right)
  els.push({ t: 'lock', w: [12, 16, 3], k: [[-0.75, 0.03, 18], [-0.5, 0.15, 14], [-0.3, 0.26, 9], [-0.42, 0.34, 5]] });
  return els;
};

// ---- champ_B: Ori (#28, pink kit) ----
const oriHair = () => {
  const els = [];
  // from the middle parting, out and down over the temples
  for (const s of [-1, 1]) ring(3, 0.06, 0.5, (t) => els.push({ t: 'lock', w: [12, 20, 10], k: [[s * t * 0.4, 0.02, 5], [s * (t + 0.35), 0.13, 7], [s * (t + 0.7), 0.3, 7], [s * (t + 0.95), 0.42, 6]] }));
  // the long fall: wide strands from behind the temples, hanging straight from the widest point
  // of the head into one smooth curtain past the shoulders, cut nearly straight, all round the back
  for (const s of [-1, 1]) ring(7, 1.55, 2.9, (t) => els.push({ t: 'strand', w: [22, 12, 26], hang: 56, flare: 0.7, k: [[s * t, 0.26, 6], [s * t, 0.62, 8]] }));
  els.push({ t: 'strand', w: [26, 14, 28], hang: 56, flare: 0, k: [[P, 0.26, 6], [P, 0.62, 8]] });
  return els;
};

// ---- champ_C: Naveh (#10, yellow kit) ----
const navehHair = () => {
  const els = [];
  const curl = (th, v, out, r, i) => els.push({ t: 'curl', at: [th, v, out], r, spin: i * 1.7 });
  ring(9, -P, P * (7 / 9), (t, i) => curl(t, 0.0, 15, 7.6, i));
  ring(14, -P, P * (12 / 14), (t, i) => curl(t, 0.06, 13, 7.4, i + 3));
  ring(16, -P, P * (14 / 16), (t, i) => curl(t + 0.1, 0.13, 10.5, 7.2, i + 5));
  ring(7, -1.15, 1.15, (t, i) => curl(t, 0.21, 7.5, 6.8, i + 2));
  ring(5, P - 1.0, P + 1.0, (t, i) => curl(t, 0.22, 7, 6.8, i + 8));
  ring(6, -0.75, 0.75, (t, i) => curl(t + 0.06, 0.27, 5.5, 5.8, i + 4));
  return els;
};

// ---- champ_D: Paz (#05, green kit) ----
const pazHair = () => {
  const els = [];
  // short on top, brushed up into a small quiff
  ring(6, -0.95, 0.85, (t) => els.push({ t: 'lock', w: [7, 15, 2], k: [[t, 0.28, 2.5], [t + 0.05, 0.15, 8], [t + 0.12, 0.05, 11], [t + 0.22, 0.0, 13]] }));
  ring(6, P - 1.1, P + 1.1, (t) => els.push({ t: 'lock', w: [12, 14, 2], k: [[t, 0.02, 9], [t, 0.16, 6], [t, 0.32, 3]] }));
  return els;
};

export const MYTHICS = [
  {
    id: 'champ_A', name: 'Shoval', shirt: 24, sheet: 'champ_A/champ_A_Shoval_sheet.png',
    sheetViews: 'front · top-right: left side · bottom-left: three-quarter front-left · back',
    views: [{ label: 'Front', yaw: 0, panel: 'tl' }, { label: '¾ front-left', yaw: -35, panel: 'bl' }, { label: 'Left side', yaw: -90, panel: 'tr' }, { label: 'Back', yaw: 180, panel: 'br' }], facesLeft: true,
    skin: { base: '#e0a476', light: '#f0bf95', mid: '#c98757', dark: '#a66a40' },
    eyes: { iris: '#5b3420' }, brows: { c: '#2a1a12', w: 5 },
    mouth: { A: 'smirk', B: 'smirk', C: 'grin' },
    beard: { kind: 'stubble', c: '#3b2519', alpha: 0.13, span: 1.4, top: [[0, 0.75], [0.4, 0.77], [1.0, 0.7], [1.4, 0.56]], bot: [[0, 1.0], [1.4, 0.86]] },
    hair: { c: { base: '#3b2519', shade: '#22140c', hi: '#6a4630' }, cap: { line: [[0, 0.27], [0.5, 0.28], [1.0, 0.34], [1.3, 0.42], [1.7, 0.5], [2.4, 0.68], [3.15, 0.8]], out: 3 }, els: shovalHair() },
    kit: { n: '24', shirt: { base: '#1f1f24', shade: '#131316' }, yoke: '#f4f4f2', yokeBack: true, trim: '#d6a23a', badge: '#f2c230', num: '#ffffff', numLine: null,
      shorts: { base: '#1f1f24', shade: '#121215', stripe: '#d6a23a' }, socks: { base: '#1d1d22', band: '#f4f4f2' }, boots: { base: '#18181c', sole: '#f4f4f2', stripe: '#f4f4f2' } },
  },
  {
    id: 'champ_B', name: 'Ori', shirt: 28, sheet: 'champ_B/champ_B_Ori_sheet.png', female: true,
    sheetViews: 'front · top-right: right side · bottom-left: three-quarter front-right · back',
    views: [{ label: 'Front', yaw: 0, panel: 'tl' }, { label: '¾ front-right', yaw: 35, panel: 'bl' }, { label: 'Right side', yaw: 90, panel: 'tr' }, { label: 'Back', yaw: 180, panel: 'br' }],
    skin: { base: '#f1c09c', light: '#fbd6b8', mid: '#dca17b', dark: '#c0805b' },
    eyes: { iris: '#6b3b1f' }, brows: { c: '#3a2416', w: 3.6 }, lips: '#e0707a', blush: true, necklace: true,
    mouth: { A: 'smile', B: 'big', C: 'grin' },
    hair: { c: { base: '#e9cf8c', shade: '#c7a660', hi: '#fbefc4' }, hideEars: true,
      cap: { line: [[0, 0.17], [0.35, 0.2], [0.6, 0.28], [0.9, 0.38], [1.2, 0.5], [1.5, 1.0], [3.15, 1.0]], out: 4, root: { c: '#9a7448', v: 0.1 } }, els: oriHair() },
    kit: { n: '28', shirt: { base: '#f493bd', shade: '#d9709c' }, yoke: '#fbf5f7', yokeBack: true, trim: '#e4b24c', badge: '#f2c230', num: '#ffffff', numLine: '#e4b24c',
      shorts: { base: '#f493bd', shade: '#d9709c', stripe: '#e4b24c' }, socks: { base: '#ffffff', band: '#f6eef2' }, boots: { base: '#f7f5f6', sole: '#f493bd', stripe: '#e4b24c' } },
  },
  {
    id: 'champ_C', name: 'Naveh', shirt: 10, sheet: 'champ_C/champ_C_Naveh_sheet.png',
    sheetViews: 'front · top-right: right side · bottom-left: three-quarter front-left · back',
    views: [{ label: 'Front', yaw: 0, panel: 'tl' }, { label: '¾ front-left', yaw: -35, panel: 'bl' }, { label: 'Right side', yaw: 90, panel: 'tr' }, { label: 'Back', yaw: 180, panel: 'br' }], facesLeft: true,
    skin: { base: '#f0b996', light: '#fbd1b4', mid: '#d99a76', dark: '#bf7d5a' },
    eyes: { iris: '#7d97ad' }, brows: { c: '#9a6a33', w: 3.6 },
    mouth: { A: 'grin', B: 'big', C: 'grin' },
    beard: { kind: 'stubble', c: '#b07a45', alpha: 0.3, span: 1.45, top: [[0, 0.705], [0.25, 0.71], [0.75, 0.68], [1.25, 0.52], [1.45, 0.48]], bot: [[0, 1.03], [1.2, 0.92], [1.45, 0.62]] },
    hair: { c: { base: '#cf9b45', shade: '#9e6f2b', hi: '#f0c977' }, cap: { c: { base: '#c19563' }, line: [[0, 0.25], [0.6, 0.27], [1.0, 0.33], [1.3, 0.44], [1.7, 0.5], [2.4, 0.66], [3.15, 0.74]], out: 1.5 }, els: navehHair() },
    kit: { n: '10', shirt: { base: '#f4c21f', shade: '#d39a12' }, yoke: '#fbf8ee', yokeBack: false, trim: '#8a5a1c', badge: '#f2c230', num: '#ffffff', numLine: '#8a5a1c',
      shorts: { base: '#f4c21f', shade: '#d39a12', stripe: '#ffffff' }, socks: { base: '#ffffff', band: '#e9b43a' }, boots: { base: '#e3a41f', sole: '#ffffff', stripe: '#ffffff' } },
  },
  {
    id: 'champ_D', name: 'Paz', shirt: 5, sheet: 'champ_D/champ_D_Paz_sheet.png',
    sheetViews: 'front · top-right: right side · bottom-left: three-quarter front-left · back',
    views: [{ label: 'Front', yaw: 0, panel: 'tl' }, { label: '¾ front-left', yaw: -35, panel: 'bl' }, { label: 'Right side', yaw: 90, panel: 'tr' }, { label: 'Back', yaw: 180, panel: 'br' }], facesLeft: true,
    skin: { base: '#efb391', light: '#facdb0', mid: '#d8936f', dark: '#bb7553' },
    eyes: { iris: '#5f9a4e', u: 23 }, brows: { c: '#a2471d', w: 4 },
    mouth: { A: 'grin', B: 'big', C: 'grin' },
    glasses: { c: '#6b737d', hi: '#c9d1db' },
    beard: { kind: 'full', c: { base: '#c4622c', shade: '#8f4119', hi: '#e8894c' }, span: 1.52, out: [2, 5],
      top: [[0, 0.705], [0.25, 0.705], [0.75, 0.66], [1.25, 0.5], [1.52, 0.46]], bot: [[0, 1.07], [0.5, 1.06], [1.1, 0.94], [1.52, 0.6]] },
    hair: { c: { base: '#b85a2a', shade: '#8a3c18', hi: '#e07a40' }, cap: { c: { base: '#c06a3e' }, line: [[0, 0.27], [0.6, 0.28], [1.0, 0.34], [1.3, 0.45], [1.6, 0.5], [2.4, 0.68], [3.15, 0.76]], out: 2 }, els: pazHair() },
    kit: { n: '05', shirt: { base: '#2ea64e', shade: '#1f7d38' }, yoke: '#f6f8f4', yokeBack: false, trim: '#d9a53a', badge: '#f2c230', num: '#ffffff', numLine: '#d9a53a',
      shorts: { base: '#2ea64e', shade: '#1f7d38', stripe: '#ffffff' }, socks: { base: '#ffffff', band: '#2ea64e' }, boots: { base: '#1a1a1e', sole: '#f4f4f4', stripe: '#f4f4f4' } },
  },
];

// THE THREE WAYS TO TRANSLATE A SHEET INTO THE GAME. Every option is the artist's own drawing,
// traced from the sheet (tools/chars/mythic_trace.py) as a cartoon: its line work over flat
// colours. What changes is how flat, and the finish.
export const STYLES = [
  { key: 'A', name: 'Cartoon',
    blurb: 'The artist\'s line work kept crisp over 7 flat colours, with the roster\'s heavy dark keyline and gold rim light.' },
  { key: 'B', name: 'Bold cartoon',
    blurb: 'Flatter still: 6 colours and more smoothing, bolder shapes, with the sheets\' white sticker outline.' },
  { key: 'C', name: 'Mythic cartoon',
    blurb: 'A\'s line work and flat colours, with a rainbow rim instead of gold and a soft aura, to mark the new rarity.' },
];
