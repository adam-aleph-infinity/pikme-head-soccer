// A REEL: HS's Player Select scrolls each side's heads up and down — the chosen one big in the
// middle, its neighbours peeking in above and below (docs/HS-MENUS.md §3.4, M15). Both sides of
// our Player Select are one of these: your cards on the left, the champions on the right.
//
// It came out of the arcade board's own reel (game.js placeReel and its drag/wheel handlers):
// it follows the finger, snaps to the nearest item, gives a little past the ends, and rolls one
// item per wheel notch. What an item LOOKS like is the caller's (`paint`), and items are only
// painted as they come near the middle, so a reel of 45 faces does not fetch 45 images at once.
import { reelLook, rubber, reelSnap } from '../shared/menu.js';

/**
 * @param {HTMLElement} el   the reel's box; its items are positioned by --d (steps from the
 *                           middle) and --s (scale), which menus.css turns into a transform
 * @param {object} o
 * @param {number} o.count
 * @param {number} [o.index]                 0-based
 * @param {(i:number, item:HTMLElement)=>void} o.paint
 * @param {(i:number)=>void} [o.onSelect]   a new item reached the middle
 * @param {(i:number)=>void} [o.onTap]      the middle item was tapped (not dragged)
 * @param {'y'|'x'} [o.axis]                 'x': a sideways reel (HS's tournament select)
 */
export function createReel(el, { count, index = 0, paint, onSelect, onTap, axis = 'y' }) {
  const X = axis === 'x';
  el.classList.toggle('rl-x', X);
  let n = count, sel = clamp(index), pos = sel, painted = new Set();
  let drag = null, dragged = false, wheelAt = 0;

  function clamp(i) { return Math.max(0, Math.min(n - 1, i | 0)); }
  const step = () => parseFloat(getComputedStyle(el).getPropertyValue('--step')) || (X ? el.clientWidth * 0.3 : el.clientHeight * 0.36) || 80;

  function build() {
    el.innerHTML = '';
    painted = new Set();
    for (let i = 0; i < n; i++) {
      const it = document.createElement('div');
      it.className = 'rl-item';
      it.dataset.i = i;
      it.addEventListener('click', () => {
        if (dragged) return;
        if (i === sel) onTap?.(i);
        else select(i);
      });
      el.appendChild(it);
    }
    place(sel);
  }

  function place(p) {
    pos = p;
    for (const it of el.children) {
      const i = +it.dataset.i, d = i - p, L = reelLook(d);
      it.style.setProperty('--d', d.toFixed(3));
      it.style.setProperty('--s', L.scale.toFixed(3));
      it.style.opacity = L.opacity.toFixed(2);
      it.style.zIndex = String(L.z);
      it.style.visibility = L.hidden ? 'hidden' : '';
      it.classList.toggle('sel', i === sel);
      if (Math.abs(d) <= 3.2 && !painted.has(i)) { painted.add(i); paint(i, it); }
    }
  }

  function select(i, { silent = false } = {}) {
    i = clamp(i);
    const changed = i !== sel;
    sel = i;
    place(i);
    if (changed && !silent) onSelect?.(i);
  }

  // ── drag / swipe ──
  el.addEventListener('pointerdown', (e) => {
    drag = { y: X ? e.clientX : e.clientY, from: sel, id: e.pointerId };
    dragged = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = (X ? e.clientX : e.clientY) - drag.y;
    if (!dragged && Math.abs(dy) < 8) return;
    if (!dragged) { dragged = true; el.classList.add('dragging'); try { el.setPointerCapture(e.pointerId); } catch { /* gone */ } }
    place(rubber(drag.from - dy / step(), 0, n - 1));
  });
  const end = () => {
    if (!drag) return;
    const from = drag.from;
    drag = null;
    if (!dragged) return;
    el.classList.remove('dragging');
    select(reelSnap(from, pos, 0, n - 1));
    setTimeout(() => { dragged = false; }, 0);      // the click that ends a drag is not a tap
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  // ── the wheel: one item per notch, however fast a trackpad fires ──
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const t = performance.now();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 4 || t - wheelAt < 140) return;
    wheelAt = t;
    select(sel + Math.sign(d));
  }, { passive: false });

  build();
  return {
    el,
    get index() { return sel; },
    select,
    step: (k) => select(sel + k),
    /** A new list (another rarity): rebuild, land on `i` without announcing it. */
    reset(count2, i = 0) { n = count2; sel = clamp(i); build(); },
    /** Paint again (a card was unlocked, a stage beaten): items repaint as they come near. */
    repaint() { painted = new Set(); place(sel); },
    place: () => place(sel),
  };
}
