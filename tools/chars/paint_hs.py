#!/usr/bin/env python3
"""Paint the Head Soccer-style characters (docs/CHARACTERS.md, docs/HS-ART-STYLE.md).

Every face is built from the same rig: one head (silhouette, ear, skin tones, hair), and per
expression only the eyes, brows and mouth change, the way HS swaps a face sprite. Shapes are
authored as smooth closed splines in FRAME UNITS (public/characters.js CHAR_BOX: 144 x 142, the
head box 100 x 91.5 at (22, 26)), rasterised with Skia at SS px per unit, cel-shaded with hard
tone shapes (no gradients), outlined, then downsampled to 3 px per unit.

  python tools/chars/paint_hs.py [--out public/img/chars] [--big DIR] [--only legendary-1]

Needs numpy, pillow and skia-python (dev only), and cwebp (brew install webp).
"""
import argparse, json, math, os, subprocess, sys
import numpy as np
import skia
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from hs_chars import CHARS, EXPRS  # noqa: E402

FW, FH = 144, 142          # frame, units
PX_BOLD = 1.5
PX = (45, 44)              # the pitch sprite: 100 units of head box = 31 texels of the half-res pitch
BOX = (22, 26, 100, 91.5)  # head box in the frame
SS = 12                    # render px per unit (4x the shipped 3 px per unit)
OUT_PX = 3


def rgb(h, a=255):
    h = h.lstrip('#')
    return skia.Color(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def spline(pts, closed=True, t=1.0):
    """Catmull-Rom through pts; a point (x, y, 'c') is a corner (no tangent), (x, y, k) a
    point with its own tension k."""
    P = [(p[0], p[1]) for p in pts]
    kinds = [p[2] if len(p) > 2 else t for p in pts]
    n = len(P)
    path = skia.Path()
    path.moveTo(*P[0])
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[i]
        p1, p2 = P[i], P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else p2
        k1 = 0 if kinds[i] == 'c' else kinds[i]
        k2 = 0 if kinds[(i + 1) % n] == 'c' else kinds[(i + 1) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * k1, p1[1] + (p2[1] - p0[1]) / 6 * k1)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * k2, p2[1] - (p3[1] - p1[1]) / 6 * k2)
        path.cubicTo(*c1, *c2, *p2)
    if closed:
        path.close()
    return path


def ellipse(cx, cy, rx, ry, rot=0):
    p = skia.Path()
    p.addOval(skia.Rect(cx - rx, cy - ry, cx + rx, cy + ry))
    if rot:
        p.transform(skia.Matrix.RotateDeg(rot, (cx, cy)))
    return p


def union(*ps):
    out = ps[0]
    for p in ps[1:]:
        out = skia.Op(out, p, skia.PathOp.kUnion_PathOp)
    return out


def minus(a, b):
    return skia.Op(a, b, skia.PathOp.kDifference_PathOp)


def inter(a, b):
    return skia.Op(a, b, skia.PathOp.kIntersect_PathOp)


def _cr(P, t):
    """Catmull-Rom point on an open polyline P at t in [0, 1]."""
    n = len(P) - 1
    f = min(t * n, n - 1e-9)
    i = int(f); u = f - i
    p0, p1, p2 = P[max(i - 1, 0)], P[i], P[i + 1]
    p3 = P[min(i + 2, n)]
    def c(a, b, cc, d):
        return 0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u ** 3)
    return (c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]))


def lock(cl, w0, w1=0.0, n=48, shift=0.0, bulge=0.35, r0=0.55):
    """A hair lock: a brush stroke along the centreline `cl` (smooth), `w0` wide at the root
    tapering to `w1` at the tip (pointed when 0), fattest a little after the root; `shift` slides
    it sideways (fraction of the width, + = to the left of travel)."""
    P = [(p[0], p[1]) for p in cl]
    L, R = [], []
    for k in range(n + 1):
        t = k / n
        x, y = _cr(P, t)
        x2, y2 = _cr(P, min(t + 0.01, 1)) if t < 1 else (x, y)
        x1, y1 = _cr(P, max(t - 0.01, 0))
        dx, dy = (x2 - x1), (y2 - y1)
        d = math.hypot(dx, dy) or 1
        nx, ny = dy / d, -dx / d
        grow = r0 + (1 - r0) * math.sin(math.pi / 2 * min(t / 0.28, 1))
        taper = 1 - max(0.0, (t - 0.28) / 0.72) ** 1.25
        w = (w1 + (w0 - w1) * grow * taper) * (1 + bulge * math.sin(math.pi * min(t * 1.6, 1))) / 2
        cx, cy = x + nx * shift * w * 2, y + ny * shift * w * 2
        L.append((cx + nx * w, cy + ny * w)); R.append((cx - nx * w, cy - ny * w))
    path = skia.Path()
    path.moveTo(*L[0])
    for p in L[1:]:
        path.lineTo(*p)
    for p in reversed(R):
        path.lineTo(*p)
    path.close()
    return path


def draw_locks(P, locks, tones, ink, clip=None):
    """Each lock: its tone, a highlight streak along it, a shade along its other edge, and a
    thin ink line round it so the clumps read as separate chunks."""
    for L in locks:
        path = lock(L['cl'], *L['w'])
        P.fill(path, tones[L.get('tone', 'base')], clip=clip)
        if L.get('sh', 0.55):
            P.fill(lock(L['cl'], L['w'][0] * 0.5, L['w'][1] * 0.3, shift=-L.get('sh', 0.55)), tones['shade'], clip=path)
        if L.get('hi', 0.3) is not None:
            P.fill(lock(L['cl'][L.get('hiFrom', 0):], L['w'][0] * L.get('hiW', 0.28), 0, shift=L.get('hi', 0.3)), tones['hi'], clip=path)
            if L.get('hi2', True):
                P.fill(lock(L['cl'][L.get('hiFrom', 0):], L['w'][0] * L.get('hiW', 0.28) * 0.45, 0, shift=L.get('hi', 0.3) * 1.5), tones['hi2'], clip=path)
        P.stroke(path, tones['line'], L.get('lw', 0.9), clip=clip)


def mirror_x(pts, cx):
    return [(2 * cx - p[0], p[1], *p[2:]) for p in pts]


class Painter:
    def __init__(self, c):
        self.c = c

    def fill(self, path, col, a=255, clip=None, blend=None):
        c = self.c
        if clip is not None:
            c.save(); c.clipPath(clip, doAntiAlias=True)
        p = skia.Paint(AntiAlias=True, Color=rgb(col, a))
        if blend:
            p.setBlendMode(blend)
        c.drawPath(path, p)
        if clip is not None:
            c.restore()

    def stroke(self, path, col, w, a=255, clip=None, cap='round'):
        c = self.c
        if clip is not None:
            c.save(); c.clipPath(clip, doAntiAlias=True)
        p = skia.Paint(AntiAlias=True, Color=rgb(col, a), Style=skia.Paint.kStroke_Style, StrokeWidth=w,
                       StrokeJoin=skia.Paint.kRound_Join,
                       StrokeCap=skia.Paint.kRound_Cap if cap == 'round' else skia.Paint.kButt_Cap)
        c.drawPath(path, p)
        if clip is not None:
            c.restore()


def lens(x0, y0, x1, y1, bulge, bulge2=None):
    """A leaf/lens between two points, bulging `bulge` units to the left of the direction of
    travel (and `bulge2` back the other way, default a sliver)."""
    b2 = bulge * 0.15 if bulge2 is None else bulge2
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1
    nx, ny = dy / L, -dx / L
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    return spline([(x0, y0, 'c'), (mx + nx * bulge, my + ny * bulge), (x1, y1, 'c'), (mx - nx * b2, my - ny * b2)])


# ─────────────────────────────── face parts ───────────────────────────────

def eye_shape(e, ex):
    """The eye white of eye `e` (spec) for expression ex: a rounded quad, flat bottom, top cut by
    the lid line (outer y, inner y)."""
    x0, x1, yb = e['x0'], e['x1'], e['yb']
    inner_right = e['inner'] == 'right'
    to, ti = ex['lid']            # lid y offsets from the eye's own top (outer, inner)
    yt_o, yt_i = e['yt'] + to, e['yt'] + ti + e.get('tilt', 0)
    ytl, ytr = (yt_o, yt_i) if inner_right else (yt_i, yt_o)
    bl = e.get('bl', 0)           # bottom lift at the outer corner
    ybl, ybr = (yb - bl, yb) if inner_right else (yb, yb - bl)
    r = e.get('round', 2.6)
    p = skia.Path()
    p.moveTo(x0, ytl); p.lineTo(x1, ytr); p.lineTo(x1 + e.get('skew', 0), ybr); p.lineTo(x0 - e.get('skew', 0) * 0.3, ybl); p.close()
    pe = skia.CornerPathEffect.Make(r)
    out = skia.Path()
    paint = skia.Paint(PathEffect=pe)
    paint.getFillPath(p, out)
    return out, (ytl, ytr)


def draw_eye(P, e, ex, look, ch):
    mode = ex.get('eyes', 'open')
    ink = ch['ink']
    x0, x1, yb = e['x0'], e['x1'], e['yb']
    cx = (x0 + x1) / 2
    if mode == 'happy':          # closed, a bold upturned arc ^
        h = (yb - e['yt']) * 0.55
        path = spline([(x0 + 1, yb - 2), (cx, yb - 2 - h), (x1 - 1, yb - 2)], closed=False)
        P.stroke(path, ink, 3.4)
        return
    if mode == 'shut':           # squeezed shut: > <
        inner_right = e['inner'] == 'right'
        xa, xb = (x0 + 2, x1 - 1) if inner_right else (x1 - 2, x0 + 1)
        ym = (e['yt'] + yb) / 2 + 1.5
        path = skia.Path(); path.moveTo(xa, ym - 6); path.lineTo(xb, ym); path.lineTo(xa, ym + 5)
        P.stroke(path, ink, 3.2)
        return
    white, (ytl, ytr) = eye_shape(e, ex)
    P.fill(white, '#ffffff')
    if mode == 'spiral':         # dizzy
        pts = []
        for i in range(60):
            a = i * 0.36
            r = 0.4 + i * 0.105
            pts.append((cx + math.cos(a) * r * 1.05, (yb + max(ytl, ytr)) / 2 + 0.5 + math.sin(a) * r * 0.95))
        P.stroke(spline(pts, closed=False), ink, 1.6, clip=white)
    else:
        # iris/pupil: a big black oval with a dark grey ring on the lit side and a white glint
        pr = e['pupil']
        px = cx + e.get('px', 0) + look[0] * (x1 - x0) * 0.22
        py = (yb + (ytl + ytr) / 2) / 2 + e.get('py', -1.4) + look[1] * 3
        irisC = ch.get('iris', '#141414')
        P.fill(ellipse(px, py, pr[0], pr[1]), irisC, clip=white)
        if ch.get('irisRing'):
            P.fill(minus(ellipse(px, py, pr[0], pr[1]), ellipse(px + 0.6, py + 0.8, pr[0] * 0.72, pr[1] * 0.75)),
                   ch['irisRing'], clip=white)
        P.fill(ellipse(px + 0.4, py + 0.6, pr[0] * 0.55, pr[1] * 0.58), '#050505', clip=white)
        P.fill(ellipse(px + pr[0] * 0.38, py - pr[1] * 0.42, pr[0] * 0.26, pr[1] * 0.3), '#ffffff', clip=white)
        P.fill(ellipse(px - pr[0] * 0.35, py + pr[1] * 0.45, pr[0] * 0.12, pr[1] * 0.12), '#ffffff', 200, clip=white)
    # the lower part of the white a touch shaded (lid shadow) — one hard step
    # the lid's shadow on the white: one hard step, following the lid
    shade = skia.Path(); shade.moveTo(x0 - 2, ytl - 2); shade.lineTo(x1 + 2, ytr - 2); shade.lineTo(x1 + 2, ytr + 2.2); shade.lineTo(x0 - 2, ytl + 2.2); shade.close()
    P.fill(shade, '#d5dde8', 255, clip=white)
    # heavy upper lid line
    lid = skia.Path(); lid.moveTo(x0 - 0.6, ytl); lid.lineTo(x1 + 0.6, ytr)
    P.stroke(lid, ink, e.get('lidW', 2.6))
    # thin line along the bottom
    bot = skia.Path(); bot.moveTo(x0 + 2, yb - (e.get('bl', 0) if e['inner'] == 'right' else 0)); bot.lineTo(x1 - 2, yb - (0 if e['inner'] == 'right' else e.get('bl', 0)))
    P.stroke(bot, ink, 0.9, a=150)
    if ch.get('lashes'):
        # two flicks off the outer corner
        inner_right = e['inner'] == 'right'
        ox, oy = (x0 - 0.4, ytl) if inner_right else (x1 + 0.4, ytr)
        s = -1 if inner_right else 1
        for k, (dx, dy) in enumerate([(3.6, -2.2), (2.6, -4.4)]):
            fl = spline([(ox - s * k * 1.2, oy + 0.6), (ox + s * dx * 0.6 - s * k * 1.2, oy + dy * 0.4),
                         (ox + s * dx - s * k * 1.2, oy + dy)], closed=False)
            P.stroke(fl, ink, 1.5)


def brow_path(e, ex, ch):
    """A thick angular wedge sitting on the eye's lid line, lifted by ex['browLift']."""
    white, (ytl, ytr) = eye_shape(e, ex)
    x0, x1 = e['x0'] - e.get('browOut', 3), e['x1'] + 1.5
    inner_right = e['inner'] == 'right'
    if not inner_right:
        x0, x1 = e['x0'] - 1.5, e['x1'] + e.get('browOut', 3)
    lift = ex.get('browLift', 0) + ch.get('browGap', 0)
    tilt = ex.get('browTilt', 0)            # extra: + = inner end lower (angrier)
    yl, yr = ytl - lift, ytr - lift
    if inner_right:
        yr += tilt
    else:
        yl += tilt
    # extend the line to the brow's own ends
    def y_at(x):
        return yl + (yr - yl) * (x - e['x0']) / (e['x1'] - e['x0'])
    th_o, th_i = ch['browW']                 # thickness at outer / inner end
    tl, tr = (th_o, th_i) if inner_right else (th_i, th_o)
    arch = ex.get('browArch', ch.get('browArch', 0))
    mx = (x0 + x1) / 2
    top = [(x0, y_at(x0) - tl * 0.35, 'c'), (mx, (y_at(x0) + y_at(x1)) / 2 - (tl + tr) / 2 - arch), (x1, y_at(x1) - tr, 'c')]
    bot = [(x1, y_at(x1) + 0.4, 'c'), (mx, (y_at(x0) + y_at(x1)) / 2 + 0.3 - arch * 0.6), (x0, y_at(x0) + 0.8, 'c')]
    return spline(top + bot)


def draw_brow(P, e, ex, ch):
    b = brow_path(e, ex, ch)
    P.fill(b, ch['browC'])
    # a lighter bevel on the top edge
    P.fill(b, ch['browHi'], clip=minus(b, _shift(b, 0, -1.3)))
    P.stroke(b, ch['ink'], 0.8, a=200)


def _shift(p, dx, dy):
    q = skia.Path(p)
    q.offset(dx, dy)
    return q


def draw_mouth(P, ch, ex, head):
    m = ch['mouth']
    mx, my, mw = m['x'], m['y'], m['w']
    mode = ex.get('mouth', 'line')
    ink = ch['mouthInk']
    lip = ch.get('lipC')
    if mode == 'line':
        path = spline([(mx - mw / 2, my + 1.2), (mx - mw * 0.1, my - 0.4), (mx + mw * 0.2, my - 0.1), (mx + mw / 2, my + 1.4)], closed=False)
        if lip:   # a fuller lower lip
            P.fill(spline([(mx - mw * 0.42, my + 0.6, 'c'), (mx, my + 3.4), (mx + mw * 0.42, my + 0.8, 'c'), (mx, my + 0.9)]), lip)
            P.fill(spline([(mx - mw * 0.40, my + 0.2, 'c'), (mx - mw * 0.1, my - 1.8), (mx + mw * 0.02, my - 1.0), (mx + mw * 0.14, my - 1.9), (mx + mw * 0.40, my + 0.3, 'c'), (mx, my + 0.6)]), ch.get('lipTop', lip))
        else:     # the lip's shadow under the line
            P.fill(spline([(mx - mw * 0.3, my + 2.2, 'c'), (mx, my + 4.2), (mx + mw * 0.3, my + 2.4, 'c'), (mx, my + 2.8)]), ch['skin']['mid'], 170, clip=head)
        P.stroke(path, ink, m.get('lw', 2.0))
        return
    if mode == 'frown':
        path = spline([(mx - mw * 0.45, my + 3.0), (mx - mw * 0.1, my + 0.2), (mx + mw * 0.25, my + 0.4), (mx + mw * 0.5, my + 3.4)], closed=False)
        P.fill(spline([(mx - mw * 0.25, my + 3.6, 'c'), (mx, my + 5.4), (mx + mw * 0.3, my + 3.8, 'c'), (mx, my + 4.2)]), lip or ch['skin']['mid'], 170 if not lip else 255, clip=head)
        P.stroke(path, ink, m.get('lw', 2.0))
        return
    if mode == 'wavy':
        # a small open wobbly mouth
        w = mw * 0.8
        shape = spline([(mx - w / 2, my + 1), (mx - w / 4, my - 1.2), (mx, my + 0.4), (mx + w / 4, my - 1.0), (mx + w / 2, my + 1.2),
                        (mx + w / 3, my + 5), (mx, my + 5.8), (mx - w / 3, my + 5)])
        P.fill(shape, '#4a1612'); P.fill(ellipse(mx + 0.5, my + 5.2, w * 0.28, 2.0), '#c8454a', clip=shape)
        P.stroke(shape, ink, 1.4)
        return
    # open mouths: 'shout' (kick) and 'grin' (happy): flat-ish top, round bottom
    if mode == 'shout':
        w, h, top_curve = mw * 0.95, m.get('shoutH', 9.5), -0.5
    else:
        w, h, top_curve = mw * 1.25, m.get('grinH', 9), 1.2
    x0, x1 = mx - w / 2, mx + w / 2
    shape = spline([(x0, my - 0.5, 'c'), (mx, my + top_curve - 1.0), (x1, my - 0.8, 'c'),
                    (x1 - w * 0.12, my + h * 0.7), (mx + w * 0.05, my + h), (x0 + w * 0.12, my + h * 0.72)])
    P.fill(shape, '#4a1612')
    P.fill(ellipse(mx + w * 0.08, my + h + 1.2, w * 0.34, h * 0.42), '#d24a52', clip=shape)   # tongue
    P.fill(ellipse(mx + w * 0.08, my + h + 0.9, w * 0.26, h * 0.3), '#e5707a', clip=shape)
    teeth = spline([(x0 - 1, my - 3, 'c'), (x1 + 1, my - 3, 'c'), (x1 + 1, my + h * 0.3, 'c'), (mx, my + h * 0.36), (x0 - 1, my + h * 0.3, 'c')])
    P.fill(teeth, '#ffffff', clip=shape)
    P.fill(_shift(teeth, 0, -h * 0.12), '#f4f4ef', clip=inter(shape, teeth))
    if mode == 'shout':   # gritted lower teeth too
        lt = spline([(x0, my + h + 2, 'c'), (x1, my + h + 2, 'c'), (x1, my + h * 0.8, 'c'), (mx, my + h * 0.74), (x0, my + h * 0.8, 'c')])
        P.fill(lt, '#ffffff', clip=shape)
    if lip:
        P.stroke(shape, lip, 1.6)
    P.stroke(shape, ink, 1.4)


# ─────────────────────────────── the head ───────────────────────────────

def bolder(ch, k):
    """The pitch sprite is ~31 texels wide: the thin lines (mouth, lids, keyline) are thickened
    so they survive at one or two texels, the way HS's in-match sprites keep them."""
    import copy
    ch = copy.deepcopy(ch)
    ch['mouth']['lw'] = ch['mouth'].get('lw', 2) * k
    ch['outline'] = ch.get('outline', 3.0) * (1 + (k - 1) * 0.5)
    for e in ch['eyes']:
        e['lidW'] = e.get('lidW', 2.6) * (1 + (k - 1) * 0.6)
    if ch.get('rim'):   # HS's in-match heads carry a bright gold rim pixel along the back/top
        ch['rim']['dx'] *= 1.7; ch['rim']['dy'] *= 1.7; ch['rim']['a'] = 255
    return ch


def paint(ch, expr):
    ex = dict(EXPRS[expr])
    ex.update(ch.get('exprs', {}).get(expr, {}))
    W, H = FW * SS, FH * SS
    surf = skia.Surface(W, H)
    c = surf.getCanvas()
    c.clear(skia.ColorTRANSPARENT)
    c.scale(SS, SS)
    P = Painter(c)
    sk = ch['skin']
    ink = ch['ink']
    OL = ch.get('outline', 3.0)

    head = spline(ch['head'])
    ear = spline(ch['ear']) if ch.get('ear') else skia.Path()
    hair_back = spline(ch['hairBack']) if ch.get('hairBack') else skia.Path()
    hair = spline(ch['hair'])
    for L in ch.get('locks', []):
        hair = union(hair, lock(L['cl'], *L['w']))
    for L in ch.get('backLocks', []):
        hair_back = union(hair_back, lock(L['cl'], *L['w']))
    hair_all = union(hair, hair_back)
    sil = union(head, ear, hair_all)

    # 1. the keyline: the whole silhouette stroked, the art is drawn over its inner half
    P.stroke(sil, ink, OL * 2)
    P.fill(sil, ink)

    # 2. back hair (behind the face)
    if ch.get('hairBack') or ch.get('backLocks'):
        hb = ch['hairBackTones']
        P.fill(hair_back, hb['base'])
        for s in ch.get('hairBackShade', []):
            P.fill(spline(s), hb['shade'], clip=hair_back)
        for s in ch.get('hairBackHi', []):
            P.fill(spline(s), hb['hi'], clip=hair_back)
        for s in ch.get('hairBackLines', []):
            P.stroke(spline(s, closed=False), hb['line'], 1.0, clip=hair_back)
        draw_locks(P, ch.get('backLocks', []), hb, ch['ink'])
        P.stroke(head, ink, 1.6, clip=hair_back)

    # 3. ear
    if ch.get('ear'):
        P.fill(ear, sk['mid'])
        P.fill(spline(ch['earIn']), sk['dark'], clip=ear)
        P.stroke(spline(ch['earLine'], closed=False), ink, 1.3, clip=ear)
        P.stroke(ear, ink, 1.8)

    # 4. skin: upper tone, the lighter muzzle (cheeks, mouth, chin), its highlight rim,
    #    the back-side shadow and the chin shade — all hard-edged cel shapes
    P.fill(head, sk['base'])
    muzzle = spline(ch['muzzle'])
    P.fill(muzzle, sk['light'], clip=head)
    for h in ch.get('muzzleHi', []):
        P.fill(spline(h), sk['hi'], clip=inter(head, muzzle))
    P.fill(spline(ch['backShade']), sk['mid'], clip=head)
    if ch.get('chinShade'):
        P.fill(spline(ch['chinShade']), sk['mid'], 150, clip=inter(head, muzzle))
    if ch.get('blush'):
        for b in ch['blush']:
            P.fill(ellipse(*b), ch['blushC'], ex.get('blushA', 110), clip=head)
    if ch.get('foreheadHi'):
        P.fill(spline(ch['foreheadHi']), sk['hi'], 150, clip=head)
    # the hair's shadow on the forehead
    if ch.get('hairShadow'):
        P.fill(spline(ch['hairShadow']), sk['mid'], clip=head)

    # 5. face: nose, eyes, brows, mouth, extras
    nose = ch['nose']
    for s in nose.get('shade', []):
        P.fill(spline(s), sk['mid'], clip=head)
    for s in nose.get('hi', []):
        P.fill(spline(s), sk['hi'], 200, clip=head)
    for s in nose.get('dark', []):
        P.fill(spline(s), sk['dark'], clip=head)
    if ex.get('furrow', ch.get('furrow', 0)):
        for s in ch['furrowLines']:
            P.stroke(spline(s, closed=False), sk['dark'], 1.0, a=int(200 * ex.get('furrow', 1)), clip=head)
    look = ex.get('look', (0.45, 0))
    for e in ch['eyes']:
        draw_eye(P, e, ex, look, ch)
    for e in ch['eyes']:
        draw_brow(P, e, ex, ch)
    draw_mouth(P, ch, ex, head)
    if ex.get('tear'):
        e = ch['eyes'][0]
        tx, ty = (e['x0'] + e['x1']) / 2 - 3, e['yb'] + 2.5
        drop = spline([(tx, ty - 3, 'c'), (tx + 2.4, ty + 2.2), (tx, ty + 4.0), (tx - 2.4, ty + 2.2)])
        P.fill(drop, '#8fd6ff'); P.fill(ellipse(tx - 0.6, ty + 1.8, 0.7, 1.0), '#ffffff'); P.stroke(drop, '#2a6fa8', 0.9)
    if ex.get('sweat'):
        sx, sy = ch['sweat']
        drop = spline([(sx, sy - 5, 'c'), (sx + 3.2, sy + 1.8), (sx, sy + 4.6), (sx - 3.2, sy + 1.8)])
        P.fill(drop, '#aee4ff'); P.fill(ellipse(sx - 0.8, sy + 1.4, 0.9, 1.4), '#ffffff'); P.stroke(drop, '#2a6fa8', 1.0)

    # 6. front hair: base, shade shapes, highlight streaks, clump lines, rim light
    ht = ch['hairTones']
    P.fill(spline(ch['hair']), ht['base'])
    for s in ch.get('hairShade', []):
        P.fill(spline(s), ht['shade'], clip=hair)
    for s in ch.get('hairHi', []):
        P.fill(spline(s), ht['hi'], clip=hair)
    for s in ch.get('hairHi2', []):
        P.fill(spline(s), ht['hi2'], clip=hair)
    for s in ch.get('hairLines', []):
        P.stroke(spline(s, closed=False), ht['line'], 1.1, clip=hair)
    draw_locks(P, ch.get('locks', []), ht, ch['ink'])
    P.stroke(hair, ink, 1.8, clip=head)   # where the fringe lies on the face: an inked edge
    if ch.get('hairBack') or ch.get('backLocks'):
        P.stroke(hair, ink, 1.4, clip=hair_back)

    # 7. rim light: a thin warm band just inside the keyline on the back/top edge
    rim = ch.get('rim')
    if rim:
        inside = sil
        band = minus(sil, _shift(sil, rim['dx'], rim['dy']))
        P.fill(band, rim['c'], rim.get('a', 255), clip=spline(rim['zone']))

    img = surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType, alphaType=skia.kUnpremul_AlphaType)
    return img


def downsample(img, f):
    """Premultiplied box-then-lanczos downsample."""
    a = img[..., 3:4].astype(np.float32) / 255
    pm = np.concatenate([img[..., :3].astype(np.float32) * a, a * 255], axis=2)
    im = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA')
    im = im.resize((img.shape[1] // f, img.shape[0] // f), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    al = arr[..., 3:4] / 255
    rgbv = np.where(al > 0, arr[..., :3] / np.maximum(al, 1e-6), 0)
    return np.concatenate([np.clip(rgbv, 0, 255), arr[..., 3:4]], axis=2).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'img', 'chars'))
    ap.add_argument('--big', default=None, help='also write big PNGs here (review)')
    ap.add_argument('--only', default=None)
    ap.add_argument('--png', action='store_true', help='PNG only, skip WebP')
    args = ap.parse_args()
    reg = {}
    for key, ch in CHARS.items():
        if args.only and ch['dir'] != args.only:
            continue
        d = os.path.join(args.out, ch['dir'])
        os.makedirs(d, exist_ok=True)
        fit = None
        for expr in EXPRS:
            big = paint(ch, expr)
            small = downsample(big, SS // OUT_PX)
            assert small.shape[:2] == (FH * OUT_PX, FW * OUT_PX), small.shape
            if args.big:
                os.makedirs(os.path.join(args.big, ch['dir']), exist_ok=True)
                Image.fromarray(downsample(big, 2)).save(os.path.join(args.big, ch['dir'], f'{expr}.png'))
            png = os.path.join(d, f'{expr}.png')
            Image.fromarray(small).save(png)
            if not args.png:
                subprocess.run(['cwebp', '-quiet', '-q', '90', '-alpha_q', '100', '-exact', png, '-o', os.path.join(d, f'{expr}.webp')], check=True)
                os.remove(png)
            # the pitch sprite: the art box-filtered to the pitch's texel size, hard alpha
            pb = paint(bolder(ch, PX_BOLD), expr)
            a = pb[..., 3:4].astype(np.float32) / 255
            pm = np.concatenate([pb[..., :3] * a, a * 255], 2).astype(np.uint8)
            arr = np.asarray(Image.fromarray(pm, 'RGBA').resize(PX, Image.BOX)).astype(np.float32)
            al = arr[..., 3:4] / 255
            col = np.where(al > 0, arr[..., :3] / np.maximum(al, 1e-6), 0)
            px = np.concatenate([np.clip(col, 0, 255), (al > 0.5) * 255.0], 2).astype(np.uint8)
            pxpng = os.path.join(d, f'px-{expr}.png')
            Image.fromarray(px).save(pxpng)
            if not args.png:
                subprocess.run(['cwebp', '-quiet', '-lossless', '-z', '9', '-exact', pxpng, '-o', os.path.join(d, f'px-{expr}.webp')], check=True)
                os.remove(pxpng)
            if expr == 'normal':
                ys, xs = np.nonzero(big[..., 3] > 8)
                fit = [round(xs.min() / SS, 1), round(ys.min() / SS, 1), round((xs.max() + 1) / SS, 1), round((ys.max() + 1) / SS, 1)]
                edge = xs.min() == 0 or ys.min() == 0 or xs.max() == big.shape[1] - 1 or ys.max() == big.shape[0] - 1
                if edge:
                    print(f'WARNING {ch["dir"]}: the head touches the frame edge', file=sys.stderr)
        nx, ny = ch['nose']['tip']
        reg[key] = {'dir': ch['dir'], 'name': ch['name'], 'nose': [round(nx / FW, 3), round(ny / FH, 3)], 'fit': fit}
    print('registry:', json.dumps(reg))


if __name__ == '__main__':
    main()
