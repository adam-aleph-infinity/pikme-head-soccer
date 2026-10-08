# THE MYTHIC HEADS, TRACED FROM THE ARTIST'S SHEETS (Idan, 2026-10-08: "the hair looks very bad…
# I want it to look more like the photos").
#
# The sheets (uploaded-images/champ_A–D) are only READ: each is opened in memory, never written,
# cropped or resized on disk. For every panel this cuts the character out along the sheet's own
# white sticker outline, keeps the head (everything above the neck line, plus the long hair and the
# beard below it), and traces it into flat-colour vector art in three strengths:
#   A  cartoon — the line work over 7 flat tones, the roster's heavy keyline and gold rim
#   B  bold cartoon — flatter still (6 tones, more smoothing), with the sheets' white sticker outline
#   C  mythic cartoon — A under a prismatic rim (the page adds the aura)
# (Idan, 2026-10-08, after the first traces: "a bit too realistic". So none of the three keeps the
# painterly shading any more: each is the artist's LINE WORK, kept crisp, over flat fills.)
# Output: public/mythic-concepts/heads/<champ>-<panel>-<option>.svg and heads.json (where each
# head's chin is, and its scale), which _mythics.html places on the kit body.
#
# Run: <venv with numpy scipy pillow vtracer>/bin/python tools/chars/mythic_trace.py
import json, os, io, colorsys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage as ndi
import vtracer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(ROOT, 'uploaded-images')
OUT = os.path.join(ROOT, 'public', 'mythic-concepts', 'heads')
INK = '#1c120d'

# Per panel, read off the sheets by eye on a 50 px grid (panel px: the sheet minus its 2x2 grid
# lines and an 8 px margin):
#   cut   the neck line: a row, or a polyline [[x, y], …] that follows the jaw (a three-quarter
#         view's collar and far shoulder rise beside the chin). The head is what is above it.
#   box   [xmin, xmax]: leaves out a raised fist or a waving hand beside the head.
#   skull [x0, x1]: for long hair that hangs down beside the head (Ori): the head itself, face to
#         the back of the hair on the skull. The hanging hair is not head, so the hitbox is not
#         pulled back toward it (Idan: "make the hitbox in the center like the original ones")
#   chin  the chin's row, when hair hangs lower than it (Ori's game head).
#   poly  for long hair that falls past the chin (Ori): the outline of head and hair together;
#         inside it, below the chin, the jersey, its white trim and bare skin are dropped.
SHEETS = {
    'champ_A': {'file': 'champ_A/champ_A_Shoval_sheet.png', 'panels': {
        'tl': {'cut': [[280, 405], [340, 418], [400, 442], [500, 442], [560, 420], [640, 420]], 'box': [292, 650]}, 'tr': {'cut': 448, 'box': [312, 900]},
        # the game's head: the neck line follows his jaw keyline all the way to under the ear, so
        # the head ends in a chin, not a slice of neck (Idan: Shoval and Ori "look cut")
        'bl': {'cut': [[240, 390], [262, 420], [285, 442], [320, 457], [360, 458], [395, 453], [425, 441], [452, 421], [472, 396], [483, 366], [492, 346], [540, 340], [640, 335]]}, 'br': {'cut': 410}}},
    # Ori's blonde hair and her skin are close in tone: two more colours keep them apart
    'champ_B': {'file': 'champ_B/champ_B_Ori_sheet.png', 'k': 2, 'panels': {
        'tl': {'cut': 400, 'poly': [[280, 30], [612, 30], [612, 505], [560, 505], [540, 425], [500, 400], [445, 418], [390, 400], [352, 425], [334, 525], [278, 525]]},
        'tr': {'cut': 405, 'skull': [258, 545], 'poly': [[250, 30], [600, 30], [600, 330], [560, 400], [480, 420], [400, 430], [376, 440], [372, 588], [250, 588]]},
        'bl': {'cut': 425, 'skull': [265, 637], 'poly': [[212, 30], [672, 30], [672, 395], [600, 420], [545, 425], [480, 445], [400, 445], [345, 565], [212, 565]]},
        'br': {'cut': 400, 'poly': [[288, 30], [612, 30], [612, 440], [582, 522], [318, 522], [288, 440]]},
        # the game's own three-quarter head: the line runs under her jaw (the chin whole, no neck)
        # and her hair ends in a soft curve at the shoulder, inside the character frame (144 x 142
        # units, mythic_build.py), clear of the sleeve (Idan: "looks cut"). `chin` is where her
        # chin is, since the hair now reaches lower than it.
        'blg': {'src': 'bl', 'skull': [265, 637], 'chin': 438, 'box': [262, 680],
                'cut': [[240, 330], [262, 360], [280, 398], [300, 425], [330, 416], [360, 410], [395, 396], [415, 386], [440, 413], [470, 429], [505, 438], [535, 431], [565, 411], [585, 386], [600, 363], [620, 396], [650, 421], [672, 426]]}}},
    'champ_C': {'file': 'champ_C/champ_C_Naveh_sheet.png', 'panels': {
        'tl': {'cut': 464}, 'tr': {'cut': 464, 'box': [0, 650]},
        'bl': {'cut': [[240, 445], [290, 460], [340, 482], [400, 478], [460, 455], [490, 425], [620, 415]]}, 'br': {'cut': 410}}},
    'champ_D': {'file': 'champ_D/champ_D_Paz_sheet.png', 'panels': {
        'tl': {'cut': 492}, 'tr': {'cut': 488, 'box': [0, 612]},
        'bl': {'cut': [[220, 430], [280, 445], [340, 462], [420, 458], [480, 440], [500, 415], [620, 405]]}, 'br': {'cut': 410}}},
}
PANELS = ['tl', 'tr', 'bl', 'br']


def panels_of(im):
    """The four panels, found from the sheet's dark grid lines."""
    a = np.asarray(im).astype(np.int16)
    H, W, _ = a.shape
    dark = a.sum(2) < 120
    vx = int(np.argmax(dark.mean(0)[W // 3: 2 * W // 3])) + W // 3
    hy = int(np.argmax(dark.mean(1)[H // 3: 2 * H // 3])) + H // 3
    m = 8
    return {'tl': (m, m, vx - m, hy - m), 'tr': (vx + m, m, W - m, hy - m), 'bl': (m, hy + m, vx - m, H - m), 'br': (vx + m, hy + m, W - m, H - m)}


def figure_mask(p):
    """The character: everything a flood fill from the panel's edge cannot reach through the
    white sticker outline, without the outline itself."""
    white = p.min(2) > 225
    lab, _ = ndi.label(~white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fig = ~np.isin(lab, list(border))
    fig = ndi.binary_fill_holes(fig)
    # peel the sticker outline: white pixels touching the outside
    outside = ~fig
    for _ in range(14):
        ring = fig & ndi.binary_dilation(outside) & (p.min(2) > 200)
        if not ring.any(): break
        fig &= ~ring; outside |= ring
    return fig


def head_mask(p, fig, spec):
    H, W = fig.shape
    yy, xx = np.mgrid[0:H, 0:W]
    c = spec['cut']
    if isinstance(c, int): above = yy < c
    else:
        line = np.interp(np.arange(W), [q[0] for q in c], [q[1] for q in c])
        above = yy < line[None, :]
    keep = fig & above
    if 'box' in spec: keep &= (xx >= spec['box'][0]) & (xx <= spec['box'][1])
    if 'poly' in spec:
        pm = Image.new('L', (W, H), 0)
        ImageDraw.Draw(pm).polygon([tuple(q) for q in spec['poly']], fill=255)
        inpoly = np.asarray(pm) > 0
        hsv = np.asarray(Image.fromarray(p.astype(np.uint8)).convert('HSV')).astype(np.float32)
        hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        # below the chin: not the pink jersey, not bare skin, not the white trim
        pinkskin = ((hue >= 285) & (sat >= 0.2) & (val >= 0.3)) | ((hue <= 14) & (sat >= 0.25) & (val >= 0.6))
        white = (sat < 0.08) & (val > 0.9)
        gold = (hue >= 33) & (hue <= 56) & (sat > 0.55) & (val > 0.62)     # the necklace
        low = fig & inpoly & ~above & ~pinkskin & ~white & ~ndi.binary_dilation(gold, iterations=3)
        keep = (keep & inpoly) | low
    # the collar's white yoke and gold trim where they peek in along the head's bottom edge
    ys = np.nonzero(keep.any(1))[0]
    if len(ys):
        y0, y1 = ys.min(), ys.max()
        hsv = np.asarray(Image.fromarray(p.astype(np.uint8)).convert('HSV')).astype(np.float32)
        hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        trim = ((sat < 0.12) & (val > 0.8)) | ((hue >= 36) & (hue <= 56) & (sat > 0.45) & (val > 0.55))
        band = yy > y1 - (y1 - y0) * 0.13
        keep &= ~(band & ndi.binary_dilation(trim, iterations=2))
    # the head is the biggest piece; anything cut loose drops out
    lab, n = ndi.label(keep)
    if n > 1:
        sizes = ndi.sum(keep, lab, range(1, n + 1))
        keep = lab == (1 + int(np.argmax(sizes)))
    keep = ndi.binary_opening(keep, iterations=2)
    lab, n = ndi.label(keep)
    if n > 1:
        sizes = ndi.sum(keep, lab, range(1, n + 1))
        keep = lab == (1 + int(np.argmax(sizes)))
    return ndi.binary_fill_holes(keep)


def kmeans(px, k, iters=12, seed=1):
    rng = np.random.default_rng(seed)
    sample = px[rng.choice(len(px), min(len(px), 20000), replace=False)].astype(np.float32)
    c = sample[rng.choice(len(sample), k, replace=False)]
    for _ in range(iters):
        d = ((sample[:, None, :] - c[None]) ** 2).sum(2)
        lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any(): c[j] = sample[m].mean(0)
    return c


def toon(rgb, alpha, k, med):
    """A cartoon of the drawing: its dark line work (eyes, brows, mouth, the strokes in the hair)
    lifted out crisp, and everything else smoothed flat and snapped to k colours of this head."""
    g = np.asarray(Image.fromarray(rgb).convert('L')).astype(np.float32)
    black = ndi.grey_closing(g, footprint=np.ones((7, 7), bool)) - g     # thin dark strokes
    lines = (black > 30) & (g < 150)
    lab, n = ndi.label(lines)
    if n:
        sz = ndi.sum(lines, lab, range(1, n + 1))
        lines = np.isin(lab, 1 + np.nonzero(sz >= 25)[0])
    img = Image.fromarray(rgb)
    for _ in range(3): img = img.filter(ImageFilter.MedianFilter(med))
    a = np.asarray(img).reshape(-1, 3)
    on = (alpha.reshape(-1) > 0) & ~lines.reshape(-1)
    c = kmeans(a[on], k)
    d = ((a[:, None, :].astype(np.float32) - c[None]) ** 2).sum(2)
    q = c[d.argmin(1)].astype(np.uint8).reshape(rgb.shape)
    q = np.asarray(Image.fromarray(q).filter(ImageFilter.ModeFilter(9))).copy()
    q[lines] = [42, 22, 16]
    return q


def trace(rgba, **kw):
    buf = io.BytesIO(); Image.fromarray(rgba, 'RGBA').save(buf, 'PNG')
    svg = vtracer.convert_raw_image_to_svg(buf.getvalue(), img_format='png', colormode='color', hierarchical='stacked', mode='spline', **kw)
    body = svg[svg.index('>', svg.index('<svg')) + 1: svg.rindex('</svg>')]
    return body


def silhouette(alpha):
    """The head's outline as one path (traced from its alpha), for the keyline and the rim."""
    m = np.where(alpha[..., None] > 0, 0, 255).astype(np.uint8).repeat(3, 2)
    buf = io.BytesIO(); Image.fromarray(m, 'RGB').save(buf, 'PNG')
    svg = vtracer.convert_raw_image_to_svg(buf.getvalue(), img_format='png', colormode='binary', mode='spline', filter_speckle=8)
    import re
    paths = re.findall(r'<path d="([^"]+)"[^>]*transform="translate\(([-\d.]+),([-\d.]+)\)"', svg)
    return ' '.join(f'<path d="{d}" transform="translate({x},{y})"/>' for d, x, y in paths)


def wrap(w, h, body, sil, opt):
    pad = 14
    vb = f'{-pad} {-pad} {w + 2 * pad} {h + 2 * pad}'
    defs, under, over = '', '', ''
    if opt == 'B':
        under += f'<g fill="#ffffff" stroke="#ffffff" stroke-width="22" stroke-linejoin="round">{sil}</g>'
    under += f'<g fill="{INK}" stroke="{INK}" stroke-width="{11 if opt != "B" else 6}" stroke-linejoin="round">{sil}</g>'
    if opt in ('A', 'C'):
        grad = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6ad5"/><stop offset=".4" stop-color="#8b7bff"/><stop offset=".7" stop-color="#4ff0ff"/><stop offset="1" stop-color="#ffe46a"/></linearGradient>' if opt == 'C' else ''
        defs += grad + f'<mask id="r" maskUnits="userSpaceOnUse" x="{-pad}" y="{-pad}" width="{w + 2 * pad}" height="{h + 2 * pad}"><g fill="#fff">{sil}</g><g fill="#000" transform="translate(0 {9 if opt == "C" else 7})">{sil}</g></mask>'
        over += f'<rect x="{-pad}" y="{-pad}" width="{w + 2 * pad}" height="{h + 2 * pad}" fill="{"url(#g)" if opt == "C" else "#ffd24a"}" mask="url(#r)"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w + 2 * pad}" height="{h + 2 * pad}"><defs>{defs}</defs>{under}<g>{body}</g>{over}</svg>'


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for cid, sh in SHEETS.items():
        im = Image.open(os.path.join(REF, sh['file'])).convert('RGB')     # read only
        full = np.asarray(im)
        meta[cid] = {}
        boxes = panels_of(im)
        for pn, spec in sh['panels'].items():
            x0, y0, x1, y1 = boxes[spec.get('src', pn)]
            p = full[y0:y1, x0:x1].astype(np.int16)
            fig = figure_mask(p)
            hm = head_mask(p, fig, spec)
            ys, xs = np.nonzero(hm)
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            rgb = p[by0:by1, bx0:bx1].astype(np.uint8)
            alpha = (hm[by0:by1, bx0:bx1] * 255).astype(np.uint8)
            # the chin: the middle of the head's own pixels on the neck line
            c = spec['cut']
            cutY = spec.get('chin', c if isinstance(c, int) else int(max(q[1] for q in c)))
            # the chin: the lowest of the face's own pixels in the middle of the neck line
            rows = [y for y in range(min(cutY, by1) - 1, by0, -1) if hm[y].any()]
            yc = rows[0] if rows else by1 - 1
            # …and the neck: the middle of the jaw a little above it (a three-quarter chin is off to
            # one side; the neck is under the whole jaw), where the body's collar goes
            ya = yc - int((yc - by0) * 0.16)
            row = np.nonzero(hm[ya])[0]
            cx = (row.min() + row.max()) / 2 - bx0
            cy = yc - by0
            r2 = np.nonzero(hm[max(by0, yc - int((yc - by0) * 0.3))])[0]
            w, h = bx1 - bx0, by1 - by0
            sil = silhouette(alpha)
            for opt in 'ABC':
                xk = sh.get('k', 0)
                q = toon(rgb, alpha, 6 + xk, 9) if opt == 'B' else toon(rgb, alpha, 7 + xk, 7)
                body = trace(np.dstack([q, alpha]), filter_speckle=10, color_precision=8, layer_difference=4, corner_threshold=70, length_threshold=4, path_precision=2)
                svg = wrap(w, h, body, sil, opt)
                open(os.path.join(OUT, f'{cid}-{pn}-{opt}.svg'), 'w').write(svg)
            # the drawn head proper: crown to chin, side to side above the chin (hair that falls
            # below the chin is not head) — what the game fits to its head box (game.js CHAR_FIT)
            cols = np.nonzero(hm[by0:yc + 1].any(0))[0]
            meta[cid][pn] = {'w': int(w), 'h': int(h), 'pad': 14, 'off': [int(bx0), int(by0)], 'chin': [round(float(cx), 1), int(cy)], 'skull': int(r2.max() - r2.min()) if len(r2) else int(w),
                             'head': [int(cols.min() - bx0), 0, int(cols.max() + 1 - bx0), int(cy)]}
            if 'skull' in spec: meta[cid][pn]['head'][0], meta[cid][pn]['head'][2] = spec['skull'][0] - int(bx0), spec['skull'][1] - int(bx0)
            print(cid, pn, w, h, 'chin', meta[cid][pn]['chin'], 'skull', meta[cid][pn]['skull'], flush=True)
    json.dump(meta, open(os.path.join(OUT, 'heads.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
