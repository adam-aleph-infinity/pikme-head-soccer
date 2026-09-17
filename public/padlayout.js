// EDIT MODE — move and resize the on-screen buttons, and remember it.
//
// Every phone is a different phone and every pair of thumbs is a different pair of thumbs.
// The tuned default (see sizePad in game.js) is a good guess for the middle of that
// distribution and a bad one at either end: a big thumb on a small phone covers the goal,
// a small thumb on a tablet cannot reach the cards. So the layout is the player's.
//
// What it saves, and why it saves that and not pixels:
//
//   • The MOVE is stored as a fraction of the stage, not in pixels. Pixels bake in the
//     device and the orientation — a layout dragged in landscape would come back with the
//     kick button off the side of the screen in portrait. A fraction survives both.
//   • The SIZE is stored as a multiplier on --u, the unit sizePad already derives from the
//     stage. So resizing composes with the responsive sizing instead of fighting it, and a
//     button sized on a phone is the same size relative to the pitch on a tablet.
//   • Nothing is saved until it MOVES. An untouched device has an empty record and gets the
//     authored layout exactly, which also means a future retune of the defaults reaches
//     everyone who never opened this screen.
//
// Leaf module: it knows about DOM elements and localStorage and nothing else — no sim, no
// match, no renderer. game.js hands it the pad and the two callbacks it needs.
const KEY = 'hs.padlayout.v1';
const OP_KEY = 'hs.padopacity.v1';
const MIN_S = 0.6, MAX_S = 2.0;
// 0.94, not the old 0.72. That number was chosen for five flat grey circles, which were
// meant to recede into the pitch. The pad is painted now — gold arrows and stone plaques —
// and paint at 72% over grass reads as faded rather than as restrained. The slider still
// goes all the way down for anyone who wants the pitch back.
const DEF_OP = 0.94;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

function save(layout) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
}

// How visible the controls are when you are not touching them. Football calls this
// «שקיפות בקרות» and it is the one control-feel preference worth having: the pad sits on top
// of the pitch, and how much pitch it is allowed to hide is a matter of taste, not design.
export function loadOpacity() {
  const v = parseFloat(localStorage.getItem(OP_KEY));
  return Number.isFinite(v) ? Math.max(0.2, Math.min(1, v)) : DEF_OP;
}

export function applyOpacity(pad, v = loadOpacity()) {
  if (pad) pad.style.setProperty('--ctl-op', String(v));
}

function saveOpacity(v) {
  try { localStorage.setItem(OP_KEY, String(v)); } catch {}
}

// Paint one button's saved offset + size onto it. Called on every apply and after every
// drag, and it is the ONLY place that writes these two custom properties.
function paint(btn, rec, stage) {
  const dx = (rec?.x || 0) * stage.w;
  const dy = (rec?.y || 0) * stage.h;
  btn.style.setProperty('--s', String(clamp(rec?.s || 1, MIN_S, MAX_S)));
  btn.style.setProperty('--xf', dx || dy ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` : 'none');
}

export function applyLayout(pad, stage, layout = loadLayout()) {
  if (!pad) return;
  for (const btn of pad.querySelectorAll('.btn')) paint(btn, layout[btn.dataset.k], stage);
}

// ---------------------------------------------------------------------------
// The editor itself. `stageOf()` is a function rather than a value because the stage
// changes size under it — rotate the phone mid-edit and the next drag has to use the new
// box, or the fractions it writes are against a box that no longer exists.
export function createEditor({ pad, stageOf, onChange = () => {} }) {
  let layout = loadLayout();
  let opacity = loadOpacity();
  let editing = false;
  let drag = null;
  // What the layout looked like when the editor opened. The editor is a DRAFT — the same
  // shape football's is — because a control layout is fiddly and the first thing anyone does
  // is drag something somewhere worse. Without a way back, the only escape is dragging it
  // home by eye.
  let before = null;

  const recFor = (k) => (layout[k] ||= { x: 0, y: 0, s: 1 });

  function repaint() {
    const stage = stageOf();
    for (const btn of pad.querySelectorAll('.btn')) paint(btn, layout[btn.dataset.k], stage);
  }

  function onDown(e) {
    if (!editing) return;
    const btn = e.target.closest('.btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const rec = recFor(btn.dataset.k);
    const stage = stageOf();
    drag = {
      btn, rec, stage,
      grip: !!e.target.closest('.grip'),
      x0: e.clientX, y0: e.clientY,
      ox: rec.x, oy: rec.y, os: rec.s || 1,
      // A resize needs a reference length to divide by, and the button's own width is the
      // honest one: dragging the corner out by half a button widens it by half.
      base: btn.getBoundingClientRect().width / (rec.s || 1),
    };
    btn.classList.add('dragging');
    btn.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.grip) {
      // Diagonal out = bigger. Taking the mean of the two axes rather than the larger keeps
      // a sloppy diagonal from jumping.
      drag.rec.s = clamp(drag.os + (dx + dy) / 2 / Math.max(1, drag.base), MIN_S, MAX_S);
    } else {
      // Clamped so a button can never be dragged off the stage and lost. Half a stage in
      // any direction is plenty and always recoverable.
      drag.rec.x = clamp(drag.ox + dx / drag.stage.w, -0.5, 0.5);
      drag.rec.y = clamp(drag.oy + dy / drag.stage.h, -0.5, 0.5);
    }
    paint(drag.btn, drag.rec, drag.stage);
  }

  function onUp() {
    if (!drag) return;
    drag.btn.classList.remove('dragging');
    drag = null;
    save(layout);
    onChange(layout);
  }

  pad.addEventListener('pointerdown', onDown, true);
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  return {
    get editing() { return editing; },
    setOpacity(v) {
      opacity = Math.max(0.2, Math.min(1, Number(v) || DEF_OP));
      applyOpacity(pad, opacity);
      saveOpacity(opacity);
    },
    get opacity() { return opacity; },
    start() {
      editing = true;
      before = JSON.parse(JSON.stringify({ layout, opacity }));
      document.body.classList.add('editing');
      // The grip is created on entry and destroyed on exit rather than living in the HTML,
      // so a button in play can never have a stray hit area sitting on its corner.
      for (const btn of pad.querySelectorAll('.btn')) {
        if (!btn.querySelector('.grip')) {
          const g = document.createElement('span');
          g.className = 'grip';
          btn.appendChild(g);
        }
      }
      repaint();
    },
    // Keep what was dragged.
    stop() {
      editing = false;
      before = null;
      document.body.classList.remove('editing');
      for (const g of pad.querySelectorAll('.grip')) g.remove();
      save(layout);
      onChange(layout);
    },
    // Put everything back the way it was when the editor opened.
    cancel() {
      if (before) {
        layout = before.layout;
        opacity = before.opacity;
        applyOpacity(pad, opacity);
      }
      this.stop();
      repaint();
    },
    reset() {
      layout = {};
      opacity = DEF_OP;
      save(layout);
      saveOpacity(opacity);
      applyOpacity(pad, opacity);
      repaint();
      onChange(layout);
    },
    repaint,
    get layout() { return layout; },
  };
}
