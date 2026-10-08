# THE MYTHIC STARTERS WHOLE, for the loading screen (Idan, 2026-10-08: the heads alone "look cut
# off"; show them like the pictures).
#
# Each artist's sheet (uploaded-images/champ_A–D, 2×2 panels; the files are read, never changed)
# has the character's FRONT view top-left: the whole figure in the kit, on a gold hexagon podium,
# inside a white sticker outline, over a background of rays. This lifts that figure out, podium
# and outline included: the background is everything outside the white outline that can be
# reached from the panel's edge without crossing white, and the rest is the figure.
#   public/img/mythic-full/<n>.webp      the front view, trimmed to itself, alpha, at the sheet's own size
#   public/img/mythic-full/<n>-3q.webp   the three-quarter view (the loading screen's 2v2)
#
#   ~/.charvenv/bin/python3 tools/chars/mythic_full.py
import os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHEETS = {1: ('champ_A', 'champ_A_Shoval_sheet.png'), 2: ('champ_B', 'champ_B_Ori_sheet.png'),
          3: ('champ_C', 'champ_C_Naveh_sheet.png'), 4: ('champ_D', 'champ_D_Paz_sheet.png')}
# What is cut out: (card, panel, file name). The front views, and the three-quarter views of the
# three who face the way the loading screen's 2v2 needs (Ori to the right; Naveh and Paz to the
# left — Shoval's faces left too, so he stands in his front view: mirroring would turn his 24).
CUTS = [(1, 'tl', '1'), (2, 'tl', '2'), (3, 'tl', '3'), (4, 'tl', '4'),
        (2, 'bl', '2-3q'), (3, 'bl', '3-3q'), (4, 'bl', '4-3q')]
OUT = os.path.join(ROOT, 'public', 'img', 'mythic-full')


def panel_box(im, which='tl'):
    """A panel ('tl', 'tr', 'bl', 'br'): up to the black divider lines between the four."""
    a = np.asarray(im.convert('RGB')).astype(int)
    H, W = a.shape[:2]
    dark = a.sum(axis=2) < 90
    cols = dark[: H // 2].mean(axis=0)              # a column of the divider is dark all the way down
    rows = dark[:, : W // 2].mean(axis=1)
    cx = [x for x in range(int(W * 0.4), int(W * 0.6)) if cols[x] > 0.8]
    cy = [y for y in range(int(H * 0.4), int(H * 0.6)) if rows[y] > 0.8]
    vx0, vx1 = (min(cx), max(cx)) if cx else (W // 2, W // 2)
    hy0, hy1 = (min(cy), max(cy)) if cy else (H // 2, H // 2)
    return {'tl': (0, 0, vx0 - 2, hy0 - 2), 'tr': (vx1 + 3, 0, W, hy0 - 2),
            'bl': (0, hy1 + 3, vx0 - 2, H), 'br': (vx1 + 3, hy1 + 3, W, H)}[which]


def background(rgb):
    """True where the panel's background is: reachable from the edge without crossing the white
    sticker outline (white = bright and colourless; the rays' cream glow is not)."""
    H, W = rgb.shape[:2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    white = (mn > 222) & (mx - mn < 26)
    bg = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if not white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and not bg[ny, nx] and not white[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg


def strip_outline(rgb, bg):
    """The artist's white sticker outline goes too (Idan: it "looks pasted onto the screen"): the
    light pixels reached from the background, through the outline and its soft edges, up to the
    figure's own dark keyline, which is then the edge — as on the game's art. White inside the
    figure (the shirt's panel, the socks) sits behind that keyline, so it is never reached."""
    H, W = bg.shape
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    light = (mn > 150) & (mx - mn < 60)
    out = bg.copy()
    q = deque(zip(*np.nonzero(bg)))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and not out[ny, nx] and light[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out


def feet_shadow(rgb, fg, cut):
    """On the podium the outline also ran round the shoes; taken away it leaves holes between the
    shoes and the podium. Those (the outline cut from INSIDE the podium's own outer edge, row by
    row) come back as the shoes' shadow on the podium: the same pixels, darkened."""
    H, W = fg.shape
    width = fg.sum(axis=1)
    top = H - 1
    while top > 0 and width[top] < width.max() * 0.6: top -= 1             # the podium's bottom rows
    while top > 0 and width[top - 1] >= width.max() * 0.6: top -= 1        # …up to its top edge
    top = max(0, top - int(H * 0.045))                                     # and the shoes on it
    out = rgb.copy()
    for y in range(top, H):
        xs = np.nonzero(fg[y])[0]
        if len(xs) < 2: continue
        inner = cut[y, xs[0]:xs[-1] + 1]
        fg[y, xs[0]:xs[-1] + 1] |= inner
        out[y, xs[0]:xs[-1] + 1][inner] = (out[y, xs[0]:xs[-1] + 1][inner] * 0.3).astype(int)
    return out


def components(mask):
    """Connected regions (4-neighbour) of a boolean mask: a label image and each region's size."""
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    sizes = [0]
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        k = len(sizes); lab[y0, x0] = k; q = deque([(y0, x0)]); n = 0
        while q:
            y, x = q.popleft(); n += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = k; q.append((ny, nx))
        sizes.append(n)
    return lab, sizes


# The background seen THROUGH each figure — between the legs, between an arm and the body —
# which the outline closes off from the edge, so the flood never reaches it. One seed per gap
# (panel px, read off the sheet on a grid).
HOLES = {
    '1': [(430, 930), (601, 717)],
    '2': [(445, 880), (583, 690)],
    '3': [(450, 900), (591, 758)],
    '4': [(450, 900), (590, 758)],
    '2-3q': [(450, 850)],
    '3-3q': [(455, 865)],
    '4-3q': [(455, 865)],
}


def clean(rgb, fg, n):
    """(1) Only the figure itself, not the sparkles of the background (white, so the flood stopped
    at them): the biggest piece is kept. (2) Each gap is filled out from its seed: up to the white
    outline and the dark keylines, near the seed's colour, and no further than 110 px."""
    lab, sizes = components(fg)
    fg = lab == int(np.argmax(sizes))
    H, W = fg.shape
    mx, mn, sm = rgb.max(axis=2), rgb.min(axis=2), rgb.sum(axis=2)
    wall = ((mn > 222) & (mx - mn < 26)) | (sm < 200)
    for sx, sy in HOLES.get(n, []):
        c0 = rgb[sy, sx]; seen = {(sy, sx)}; q = deque([(sy, sx)]); got = 0
        while q:
            y, x = q.popleft()
            fg[y, x] = False; got += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if (ny, nx) in seen or not (0 <= ny < H and 0 <= nx < W): continue
                if abs(ny - sy) > 110 or abs(nx - sx) > 110 or wall[ny, nx]: continue
                if np.abs(rgb[ny, nx] - c0).sum() > 120: continue
                seen.add((ny, nx)); q.append((ny, nx))
        print(f'    gap at {sx},{sy}: {got} px, colour {c0.tolist()}')
    return fg


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    for n, panel, name in CUTS:
        if only and name not in only: continue
        folder, sheet = SHEETS[n]
        im = Image.open(os.path.join(ROOT, 'uploaded-images', folder, sheet)).convert('RGB')
        box = panel_box(im, panel)
        pan = im.crop(box)                          # a copy in memory; the sheet is not touched
        rgb = np.asarray(pan).astype(int)
        bg = background(rgb)
        fg = clean(rgb, ~bg, name)
        cut = strip_outline(rgb, ~fg) & fg
        fg &= ~cut
        rgb = feet_shadow(rgb, fg, cut)
        pan = Image.fromarray(rgb.astype(np.uint8))
        # the alpha: the figure, its outline's outer edge softened by a pixel
        a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
        out = pan.convert('RGBA'); out.putalpha(a)
        bb = a.point(lambda v: 255 if v > 8 else 0).getbbox()
        out = out.crop(bb)
        path = os.path.join(OUT, f'{name}.webp')
        out.save(path, 'WEBP', quality=86, method=6)
        print(f'{name}: panel {box} figure {out.size} {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
