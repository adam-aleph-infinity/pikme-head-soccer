// Where to put a card so its FACE lands in the middle of a circle.
//
// Every head in this game — the two on the pitch, the three cards under it, the slots on the
// pick screen — is the same trick: the card art as a background, scaled so the head fills the
// element and offset so the face is centred. The numbers come from public/data/head-anchors.json,
// which was measured automatically (`auto: true` on every entry) and is therefore sometimes
// wrong.
//
// The specific way it is wrong, and the reason this file exists: for 20 of the 180 cards the
// window it asks for is bigger than the card, or sits too near an edge to fit. The browser
// happily obliges — it shows the card's edge and empty space beyond it — and the face ends up
// pushed to one side. Adam's phone, where the cards are small and the misses are obvious, is
// where that got noticed.
//
// So the window is CLAMPED to the card here rather than trusted. A clamped crop is not the
// perfect crop — the face can still sit slightly off centre if its anchor was badly measured —
// but it can never show anything that is not card, which is the difference between "this face
// is a little low" and "this card is broken".
//
// Split out of game.js so test-heads.mjs can run it over all 180 anchors in node.

// A head bigger than this fraction of the card is a FAILED MEASUREMENT, not a close-up.
// Measured over the 180 auto-detected anchors: the median head is 0.36 of the card wide and
// three quarters are under 0.48 — but seventeen came out above 0.68 and one at 1.33, which is
// wider than the card it is supposedly inside. Those are the cards where the detector locked
// onto the whole photo, and a crop that honours them shows a scene rather than a face.
// Capping zooms back in on whatever the detector thought the centre was, which is nearly
// always the right part of the card even when the size was nonsense.
const MAX_D = 0.55;

export function headCrop(anchor, cardW, cardH, sizePx) {
  const ratio = cardH / cardW;
  // The window, in card-normalised units: `d` wide, and the same number of PIXELS tall, which
  // is fewer normalised units because a card is taller than it is wide.
  const d = Math.min(MAX_D, Math.max(0.05, anchor.d || 0.6));
  const halfW = d / 2;
  const halfH = halfW / ratio;

  // Clamp the centre so the window stays on the card. If the window is wider (or taller) than
  // the card itself, there is nothing to clamp to — centre it and show the whole card.
  const cx = halfW * 2 >= 1 ? 0.5 : Math.min(1 - halfW, Math.max(halfW, anchor.cx));
  const cy = halfH * 2 >= 1 ? 0.5 : Math.min(1 - halfH, Math.max(halfH, anchor.cy));

  const rendered = sizePx / d;                      // card width at this zoom
  return {
    width: rendered,
    height: rendered * ratio,
    x: sizePx / 2 - cx * rendered,
    y: sizePx / 2 - cy * rendered * ratio,
    // What was moved, so a tool can report the badly-measured anchors rather than hide them.
    shiftX: cx - anchor.cx,
    shiftY: cy - anchor.cy,
    // How much the head size had to be cut back, so a tool can list the failed measurements.
    zoom: (anchor.d || 0.6) / d,
  };
}

// Does this window sit entirely on the card? The property the clamp exists to guarantee.
export function cropOnCard(anchor, cardW, cardH) {
  const c = headCrop(anchor, cardW, cardH, 100);
  // Re-derive the normalised window from the returned geometry and check all four edges.
  const left = -c.x / c.width, right = (100 - c.x) / c.width;
  const top = -c.y / c.height, bottom = (100 - c.y) / c.height;
  return left >= -1e-9 && top >= -1e-9 && right <= 1 + 1e-9 && bottom <= 1 + 1e-9;
}
