"""The HS-style characters' rigs, for paint_hs.py. Frame units (144 x 142, head box 100 x 91.5
at (22, 26), chin on y = 117.5). Characters face RIGHT: the ear and the shaded side are on the
left (the back of the head), the features sit right of centre, the far eye is the smaller one.
A point (x, y, 'c') is a corner; plain points are smooth.

Every character shares ONE head traced off Head Soccer's Korea (the RESULT portrait, M3 92.8 s,
cropped 600 x 520 with its chin at y 490): the jowls, the eye band, the muzzle, the brows, nose
and mouth are all Korea's own proportions. Points are authored in that crop's pixels and mapped
into rig units by R(); only hair, skin, facial hair and headwear change per card."""

import copy
import math

_S = 0.2306                      # rig units per reference pixel: Korea's 555 px width -> 128 units
_V = 1.08                        # the in-match Korea (M4 29.98 s) stands taller than the result portrait
_CHIN = 113.4                    # the chin's keyline ends on the head box's bottom (117.5), so the collar shows under it


def R(pts):
    out = []
    for p in pts:
        q = (round(8 + (p[0] - 25) * _S, 2), round(_CHIN - (490 - p[1]) * _S * _V, 2))
        out.append(q + tuple(p[2:]))
    return out


def U(v):
    return round(v * _S, 2)


def P1(p):
    return R([p])[0][:2]


# Per-expression face settings (a character can override any key under 'exprs').
#   lid: (outer, inner) offsets of the upper lid line from the eye's own top, + = lower
#   browLift: brows up (units); browTilt: + = inner end lower (angrier), - = worried
#   eyes: open | happy (closed arcs) | shut (> <) | spiral (dizzy)
#   mouth: line | shout | grin | frown | wavy
EXPRS = {
    'normal': {'lid': (0, 0), 'look': (0.5, 0.05), 'mouth': 'line', 'furrow': 1},
    'kick':   {'lid': (1.5, 3.0), 'look': (0.65, 0.1), 'browTilt': 1.5, 'mouth': 'shout', 'furrow': 1},
    'hurt':   {'lid': (-1, -1), 'eyes': 'shut', 'browLift': 2.5, 'browTilt': -6, 'mouth': 'wavy', 'sweat': True},
    'happy':  {'lid': (0, 0), 'eyes': 'happy', 'browLift': 3.5, 'browTilt': -4.5, 'mouth': 'grin', 'blushA': 150},
    'sad':    {'lid': (2.5, -3.5), 'look': (0.25, 0.65), 'browLift': 1.5, 'browTilt': -7.5, 'mouth': 'frown', 'tear': True},
}

# ── the Korea head ─────────────────────────────────────────────────────────────────────────
_ey, _fy = P1((185, 238)), P1((435, 242))
BASE = {
    'ink': '#1c120d', 'outline': 3.4,
    'head': R([(330, 58), (446, 66), (518, 102), (545, 170), (552, 250), (570, 318), (586, 384), (578, 440),
               (548, 474), (470, 490), (330, 496), (190, 492), (112, 476), (64, 444), (44, 398), (48, 345),
               (64, 280), (76, 200), (110, 122), (196, 72)]),
    'ear': R([(90, 262), (52, 256), (27, 284), (24, 330), (38, 362), (68, 378), (96, 362)]),
    'earIn': R([(80, 280), (54, 286), (46, 320), (58, 350), (84, 354)]),
    'earLine': R([(74, 290), (56, 310), (58, 336), (74, 346)]),
    # the pale muzzle: its top edge runs right under the eyes and dips under the nose
    'muzzle': R([(20, 385), (110, 348), (250, 336), (345, 342), (405, 352), (432, 356), (470, 344), (530, 336),
                 (600, 342), (620, 560, 'c'), (0, 560, 'c')]),
    'muzzleHi': [R([(190, 342, 'c'), (262, 334), (335, 344, 'c'), (262, 352)]),
                 R([(445, 344, 'c'), (492, 336), (548, 342, 'c'), (496, 350)])],
    'backShade': R([(-20, -20, 'c'), (190, -20, 'c'), (148, 150), (126, 260), (128, 350), (146, 440), (190, 540, 'c'), (-20, 540, 'c')]),
    'chinShade': R([(40, 446), (200, 470), (350, 474), (500, 467), (620, 430, 'c'), (620, 560, 'c'), (0, 560, 'c')]),
    'nose': {
        'tip': P1((432, 342)),
        'shade': [R([(418, 282, 'c'), (438, 310), (446, 336, 'c'), (426, 330), (420, 305)])],
        'hi': [R([(398, 285, 'c'), (408, 312), (410, 334, 'c'), (401, 312)])],
        'dark': [R([(408, 344, 'c'), (430, 326), (454, 344, 'c'), (431, 350)])],
    },
    'furrowLines': [R([(372, 238), (378, 268)]), R([(392, 236), (395, 262)])],
    'eyes': [
        {'x0': _ey[0], 'x1': P1((336, 0))[0], 'yt': _ey[1], 'tilt': U(26), 'yb': P1((0, 334))[1], 'inner': 'right',
         'pupil': (U(46), U(58)), 'px': U(14), 'py': -0.4, 'bl': U(4), 'browOut': U(16), 'browIn': U(34), 'lidW': 3.2, 'round': 3.4},
        {'x0': _fy[0], 'x1': P1((528, 0))[0], 'yt': _fy[1], 'tilt': U(22), 'yb': P1((0, 330))[1], 'inner': 'left',
         'pupil': (U(34), U(54)), 'px': U(4), 'py': -0.4, 'skew': 0.6, 'browOut': U(10), 'browIn': U(14), 'lidW': 3.2, 'round': 3.0},
    ],
    'iris': '#101010', 'irisRing': '#3a3a3e',
    'browW': (U(26), U(36)), 'browGap': U(12), 'browC': '#1e1612', 'browHi': '#4a3a30',
    'mouth': {'x': P1((384, 0))[0], 'y': P1((0, 382))[1], 'w': U(88), 'lw': 2.8, 'grinH': 12, 'shoutH': 12},
    'mouthInk': '#3e1e14',
    'sweat': P1((560, 200)),
}


def char(**kw):
    ch = copy.deepcopy(BASE)
    for k, v in kw.items():
        ch[k] = v
    return ch


def curls(centres, r):
    """A mop of curls: each a short hooked stroke round `centre`, the hook breaking the outline."""
    out = []
    for (cx, cy, a) in centres:
        pts = []
        for k in range(4):
            t = math.radians(a + 200 - k * 70)
            pts.append((cx + math.cos(t) * r, cy - math.sin(t) * r))
        out.append({'cl': R(pts), 'w': (U(r * 1.35), U(6)), 'hi': 0.3, 'sh': 0.5})
    return out



# ── props ─────────────────────────────────────────────────────────────────────────────────────
# Authored in the reference crop's pixels like everything else, returned as paint_hs extras.

def _oval(cx, cy, rx, ry, rot=0.0, n=10, corner=False):
    c, s_ = math.cos(rot), math.sin(rot)
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n
        x, y = math.cos(t) * rx, math.sin(t) * ry
        out.append((cx + x * c - y * s_, cy + x * s_ + y * c) + (('c',) if corner else ()))
    return out


_WORM = {'base': '#c2574c', 'shade': '#7a2a26', 'hi': '#ec9486', 'hi2': '#ffe6dc', 'line': '#1e0706'}


def worm(cl, w, eye_side=-1, back=False):
    """An earthworm from the card, made to frighten: a thick ringed, slimy body tapering to the
    tail (the FIRST point) and ending at the last point in its own blunt tip, where an open round
    mouth ringed with teeth faces what it is after, with two small glowing red eyes just behind
    it. eye_side: which side of travel the eyes sit on."""
    (x0, y0), (x1, y1) = cl[-2][:2], cl[-1][:2]
    d = math.hypot(x1 - x0, y1 - y0) or 1
    ux, uy = (x1 - x0) / d, (y1 - y0) / d
    nx, ny = -uy * eye_side, ux * eye_side
    r = w / 2
    rot = math.atan2(uy, ux)
    # authored tail-first; stroked head-first so it is full width at the head and tapers to a point
    body = {'cl': R(list(reversed(cl))), 'w': (U(w), U(w * 0.08)), 'tones': {**_WORM, 'hi2': None}, 'lw': 1.7, 'bulge': 0.12,
            'rings': max(4, int(len(cl) * 1.1)), 'ring0': 0.3, 'ring1': 0.9, 'ringC': '#5e2420', 'ringHi': '#c07468',
            'band': (0.12, 0.24, '#b4625a')}
    tip = {'pts': R(_oval(x1 + ux * r * 0.15, y1 + uy * r * 0.15, r * 0.95, r, rot)), 'tones': _WORM, 'lw': 1.3,
           'hi': [R(_oval(x1 - nx * r * 0.5, y1 - ny * r * 0.5, r * 0.55, r * 0.18, rot))],
           'hi2': [R(_oval(x1 - nx * r * 0.55 + ux * r * 0.1, y1 - ny * r * 0.55 + uy * r * 0.1, r * 0.2, r * 0.07, rot))]}
    # the mouth, at the very tip: a dark hole, a red throat, a ring of teeth
    mx, my = x1 + ux * r * 0.62, y1 + uy * r * 0.62
    mouth = {'pts': R(_oval(mx, my, r * 0.46, r * 0.78, rot)), 'tones': {'base': '#2a0606', 'line': '#1a0404'}, 'lw': 0.8,
             'rims': [(*P1((mx, my)), U(r * 0.46), U(r * 0.46), '#e0838a', 1.1)],
             'hi': [R(_oval(mx + ux * r * 0.04, my + uy * r * 0.04, r * 0.26, r * 0.46, rot))], 'hiC': '#a01c1c',
             'dots': []}
    tip['tones'] = {**_WORM}
    for part in (body, tip, mouth):
        if back:
            part['layer'] = 'back'
    # two eyes on the upper side, just behind the tip, glowing
    eyes = []
    for k, (along, out, sz) in enumerate(((0.05, 0.55, 1.0), (-0.3, 0.62, 0.8))):
        ex, ey = x1 + ux * r * along + nx * r * out, y1 + uy * r * along + ny * r * out
        eyes += [(*P1((ex, ey)), U(r * 0.28 * sz), U(r * 0.28 * sz), '#1a0504'), (*P1((ex, ey)), U(r * 0.21 * sz), U(r * 0.21 * sz), '#ff1a0e'),
                 (*P1((ex, ey)), U(r * 0.1 * sz), U(r * 0.1 * sz), '#ffc050'), (*P1((ex - ux * r * 0.06, ey - uy * r * 0.06)), U(r * 0.04 * sz), U(r * 0.04 * sz), '#ffffff')]
    mouth['dots'] = mouth['dots'] + eyes
    glow = {'pts': R(_oval(x1 + nx * r * 0.45, y1 + ny * r * 0.45, r * 0.75, r * 0.5, rot)), 'tones': {'base': '#ff3a1e'}, 'a': 55,
            'line': False, 'hdOnly': True}
    return [body, tip, glow, mouth]


_SNAKE = {'base': '#4f9e2c', 'shade': '#2a5e17', 'hi': '#8fd24a', 'hi2': '#d8f59c', 'line': '#0c2005'}


def snake(cl, w, ang, s=None):
    """A Medusa snake rearing straight up out of her hair: a thick green scaled body from the base
    (the FIRST point, hidden behind her head) up to the neck (the last point), then a wedge-shaped
    viper head pointing along `ang` (degrees, screen space) with its jaws thrown wide open — two
    white fangs, a forked red tongue, a burning yellow slit eye under an angry brow ridge."""
    s = s or w * 1.15
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = -dy, dx
    if ny < 0:                       # keep the jaw on the underside whichever way it faces
        nx, ny = -nx, -ny
    hx, hy = cl[-1][0] + dx * s * 0.75, cl[-1][1] + dy * s * 0.75

    def L(u, v, c=True):
        q = (hx + (u * dx + v * nx) * s, hy + (u * dy + v * ny) * s)
        return q + (('c',) if c else ())

    body = {'cl': R(list(reversed(cl + [L(-0.35, -0.02, False)]))), 'w': (U(w), U(w * 1.25)), 'tones': _SNAKE, 'lw': 1.6,
            'bulge': 0.1, 'rings': max(5, int(len(cl) * 1.6)), 'ring0': 0.08, 'ring1': 0.95, 'ringC': '#1f4a12', 'ringHi': '#a6e062',
            'layer': 'back'}
    tongue = {'cl': R([L(0.7, 0.22, False), L(1.2, 0.3, False), L(1.45, 0.2, False)]), 'w': (U(s * 0.09), U(s * 0.05)),
              'tones': {'base': '#e0243a', 'line': '#4a0610'}, 'lw': 0.8, 'layer': 'back'}
    forks = [{'cl': R([L(1.42, 0.21, False), L(1.62, v, False)]), 'w': (U(s * 0.05), U(s * 0.01)),
              'tones': {'base': '#e0243a', 'line': '#4a0610'}, 'lw': 0.7, 'layer': 'back'} for v in (0.06, 0.36)]
    # the gaping mouth: a dark red throat between the jaws
    mouth = {'pts': R([L(-0.3, 0.1), L(0.95, -0.12), L(1.0, 0.1, False), L(0.82, 0.62), L(0.1, 0.5, False)]),
             'tones': {'base': '#5a0a14', 'hi': '#b01e30', 'line': '#1a0404'}, 'lw': 1.0, 'layer': 'back',
             'hi': [R([L(-0.1, 0.18), L(0.7, 0.05), L(0.62, 0.42), L(0.1, 0.36, False)])]}
    # the upper jaw and skull: a flat wedge, wide at the back, a blunt snout
    skull = {'pts': R([L(-0.7, 0.2), L(-0.8, -0.2, False), L(-0.45, -0.55, False), L(0.3, -0.52, False), L(1.02, -0.3, False),
                       L(1.12, -0.08), L(0.95, 0.02, False), L(-0.1, 0.08, False)]),
             'tones': _SNAKE, 'lw': 1.4, 'layer': 'back',
             'shade': [R([L(-0.7, 0.2), L(-0.1, 0.08, False), L(0.95, 0.02, False), L(1.1, -0.06), L(0.5, -0.12, False), L(-0.6, -0.02, False)])],
             'hi': [R([L(-0.4, -0.45), L(0.4, -0.44, False), L(0.95, -0.28), L(0.3, -0.36, False), L(-0.3, -0.34, False)])],
             'lines': [R([L(-0.15, -0.58, False), L(0.25, -0.34, False), L(0.6, -0.3, False)])], 'lineW': 1.3,
             'dots': [(*P1(L(1.0, -0.2, False)), U(s * 0.03), U(s * 0.03), '#0c2005')]}
    # the lower jaw, dropped open
    jaw = {'pts': R([L(-0.55, 0.28), L(-0.05, 0.62, False), L(0.84, 0.66), L(0.82, 0.54, False), L(0.1, 0.44, False), L(-0.3, 0.18, False)]),
           'tones': {**_SNAKE, 'base': '#b8cf5a', 'line': '#0c2005'}, 'lw': 1.2, 'layer': 'back',
           'shade': [R([L(-0.4, 0.3), L(0.0, 0.6, False), L(0.8, 0.64), L(0.1, 0.52, False)])]}
    fangs = [{'pts': R([L(u - 0.07, 0.0), L(u + 0.07, -0.02), L(u + 0.02, 0.34)]), 'tones': {'base': '#fbfbf2', 'line': '#2a2a20'},
              'lw': 0.6, 'layer': 'back'} for u in (0.72, 0.3)]
    low = [{'pts': R([L(0.62, 0.52), L(0.74, 0.54), L(0.66, 0.34)]), 'tones': {'base': '#fbfbf2', 'line': '#2a2a20'},
            'lw': 0.5, 'layer': 'back'}]
    ex, ey = P1(L(0.05, -0.3, False))
    eye = {'pts': R([L(-0.2, -0.3), L(0.05, -0.47, False), L(0.3, -0.33), L(0.05, -0.16, False)]),
           'tones': {'base': '#ffd21a', 'hi': '#fff27a', 'line': '#1a0e02'}, 'lw': 0.8, 'layer': 'back',
           'dots': [(ex, ey, U(s * 0.035), U(s * 0.13), '#120800'), (ex - U(s * 0.06), ey - U(s * 0.06), U(s * 0.025), U(s * 0.025), '#ffffff')]}
    brow = {'pts': R([L(-0.35, -0.44), L(0.0, -0.6, False), L(0.42, -0.4), L(0.36, -0.32), L(0.0, -0.46, False), L(-0.3, -0.36)]),
            'tones': {'base': '#1c3e0e', 'line': '#0c2005'}, 'lw': 0.6, 'layer': 'back'}
    glow = {'pts': R(_oval(*L(0.05, -0.31, False), s * 0.3, s * 0.22, a)), 'tones': {'base': '#ffe23a'}, 'a': 60,
            'line': False, 'hdOnly': True, 'layer': 'back'}
    return [body, tongue] + forks + [mouth] + fangs + low + [jaw, skull, glow, eye, brow]


_GOLD = {'base': '#ffc92e', 'shade': '#d48a0c', 'hi': '#fff0a0', 'hi2': '#ffffff', 'line': '#6e3e04'}


def coin(cx, cy, r, tilt=0.0, squash=1.0):
    """A gold coin from the card, seen a little edge-on: a thick darker rim, the face, an embossed
    star, a lit crescent and a glint."""
    rx, ry = r, r * squash
    star = []
    for k in range(10):
        t = -math.pi / 2 + k * math.pi / 5
        rr = r * (0.42 if k % 2 == 0 else 0.18)
        star.append((cx + math.cos(t) * rr * 1.0, cy + math.sin(t) * rr * squash, 'c'))
    return [
        {'pts': R(_oval(cx + r * 0.08, cy + r * 0.1, rx, ry, tilt, 12)), 'tones': {**_GOLD, 'base': '#b86e06'}, 'lw': 1.1},   # the edge
        {'pts': R(_oval(cx, cy, rx, ry, tilt, 12)), 'tones': _GOLD, 'lw': 1.1,
         'shade': [R(_oval(cx + r * 0.3, cy + r * 0.3 * squash, rx * 0.95, ry * 0.8, tilt, 10))],
         'hi': [R(_oval(cx - r * 0.34, cy - r * 0.36 * squash, rx * 0.5, ry * 0.26, tilt - 0.6, 8))],
         'hi2': [R(_oval(cx - r * 0.48, cy - r * 0.46 * squash, rx * 0.14, ry * 0.1, tilt, 6))],
         'rims': [(*P1((cx, cy)), U(rx * 0.74), U(ry * 0.74), '#d48a0c', 0.9)]},
        {'pts': R(star), 'tones': {**_GOLD, 'base': '#e8a415'}, 'lw': 0.5, 'lc': '#9a5a06'},
    ]


def bubble(cx, cy, r):
    """A soap bubble from the card: a pale rim, a glint and a highlight arc."""
    return [{'pts': R(_oval(cx, cy, r, r, 0, 12)), 'tones': {'base': '#d6f8ff', 'line': '#3fb4d0'}, 'a': 150, 'lw': 0.7, 'hdOnly': True,
             'hi': [R(_oval(cx - r * 0.35, cy - r * 0.4, r * 0.32, r * 0.14, -0.6, 8))],
             'rims': [(*P1((cx, cy)), U(r * 0.86), U(r * 0.86), '#9ae6f6', 0.8)],
             'dots': [(*P1((cx + r * 0.4, cy + r * 0.3)), U(r * 0.1), U(r * 0.1), '#ffffff')]}]

# ── #1 Shoval: young man, near-black hair swept up and back into a quiff, thick brows, tan ─────
SHOVAL = char(
    dir='legendary-1', name='Shoval',
    skin={'base': '#d9a073', 'light': '#eec499', 'hi': '#fae0b3', 'mid': '#b97c52', 'dark': '#7f4b2d'},
    hairShadow=R([(110, 290, 'c'), (140, 196), (200, 150), (270, 136), (340, 132), (410, 140), (480, 136), (530, 160),
                  (548, 210, 'c'), (600, 0, 'c'), (80, 0, 'c')]),
    hair=R([(112, 290, 'c'), (90, 230), (92, 160), (128, 90), (200, 44), (300, 24), (400, 26), (482, 50), (530, 96),
            (552, 150), (552, 214, 'c'), (530, 170), (500, 142, 'c'), (456, 128), (410, 126), (378, 142, 'c'),
            (344, 122), (284, 124), (224, 136), (174, 164), (146, 214, 'c'), (132, 200), (120, 240)]),
    hairTones={'base': '#2e2520', 'shade': '#1a1411', 'hi': '#554539', 'hi2': '#86705d', 'line': '#110c0a'},
    locks=[
        {'cl': R([(128, 280), (104, 230), (74, 214)]), 'w': (U(40), 1), 'hi': -0.3},
        {'cl': R([(160, 196), (124, 146), (82, 136)]), 'w': (U(54), 1), 'hi': -0.3},
        {'cl': R([(256, 132), (218, 84), (156, 70), (104, 86)]), 'w': (U(72), 1), 'hi': -0.3},
        {'cl': R([(372, 140), (362, 70), (300, 30), (216, 30)]), 'w': (U(88), 1), 'hi': -0.3},
        {'cl': R([(462, 130), (466, 62), (420, 22), (344, 14)]), 'w': (U(84), 1), 'hi': -0.3},
        {'cl': R([(540, 190), (548, 116), (520, 64), (466, 38)]), 'w': (U(56), 1), 'hi': -0.3},
        {'cl': R([(506, 72), (540, 40), (566, 50)]), 'w': (U(24), 1), 'hi': -0.3},
    ],
    # from the card: a fan of gold coins tucked into his hair above the ear, and two bubbles
    extras=coin(120, 204, 40, 0.35, 0.9) + coin(80, 240, 42, -0.2, 0.92) + coin(110, 282, 36, 0.1, 0.86)
           + bubble(590, 60, 24) + bubble(610, 118, 14),
    rim={'dx': 1.5, 'dy': 1.7, 'c': '#ffd24a', 'a': 235, 'zone': R([(-40, -40, 'c'), (420, -40, 'c'), (200, 140), (120, 330), (140, 560, 'c'), (-40, 560, 'c')])},
)

# ── #2 Ori: young woman, long wavy blonde hair parted in the middle with darker roots, falling
#    past the jaw onto the shoulders; a softer HS face — no jowls, big lashed eyes, thin arched
#    brows, full pink lips, blush ───────────────────────────────────────────────────────────
_BLONDE = {'base': '#d6b163', 'shade': '#8c6434', 'hi': '#ecd290', 'hi2': '#f6e6b4', 'line': '#9a7440', 'mid': '#b89048'}
_BLONDE_BACK = {'base': '#b8914e', 'shade': '#7c5a2e', 'hi': '#d8b46a', 'hi2': '#ecd08e', 'line': '#5a3e1a'}
ORI = char(
    dir='legendary-2', name='Ori', ink='#2a170d', outline=3.2,
    webpQ=74,                                    # the long hair is the most detail of any head: keeps her under 150 KB
    skin={'base': '#f3cba6', 'light': '#fbdcc0', 'hi': '#fff1dc', 'mid': '#dfa883', 'dark': '#b0715a'},
    # a rounder, narrower face: the cheeks stay inside the skull line, the chin is a soft curve
    head=R([(330, 64), (446, 72), (512, 106), (536, 170), (542, 250), (552, 318), (558, 378), (546, 430),
            (512, 466), (440, 488), (330, 494), (224, 488), (148, 468), (104, 434), (88, 388), (88, 338),
            (94, 280), (100, 200), (126, 124), (204, 76)]),
    muzzle=R([(60, 390), (150, 352), (250, 342), (345, 346), (405, 356), (432, 360), (470, 350), (530, 344),
              (600, 350), (620, 560, 'c'), (0, 560, 'c')]),
    muzzleHi=[R([(196, 348, 'c'), (262, 340), (332, 350, 'c'), (262, 357)]),
              R([(448, 350, 'c'), (492, 343), (540, 350, 'c'), (496, 356)])],
    backShade=R([(-20, -20, 'c'), (200, -20, 'c'), (160, 150), (140, 260), (140, 350), (156, 430), (200, 540, 'c'), (-20, 540, 'c')]),
    chinShade=R([(90, 440), (220, 474), (350, 480), (490, 470), (620, 420, 'c'), (620, 560, 'c'), (0, 560, 'c')]),
    hairShadow=R([(116, 250, 'c'), (150, 200), (200, 160), (262, 136), (336, 120), (408, 136), (472, 160), (520, 200),
                  (548, 280, 'c'), (600, 0, 'c'), (60, 0, 'c')]),
    # the long lengths fall BEHIND her: down past the ear and the far cheek onto the shoulders
    hairBack=R([(96, 300, 'c'), (90, 170), (170, 70), (330, 40), (490, 70), (566, 170), (564, 320, 'c'), (330, 250)]),
    hairBackTones=_BLONDE_BACK,
    backLocks=[
        {'cl': R([(104, 220), (70, 330), (84, 420), (60, 500), (74, 566)]), 'w': (U(80), U(24))},
        {'cl': R([(150, 250), (126, 350), (140, 440), (118, 520)]), 'w': (U(56), U(18)), 'tone': 'shade'},
        {'cl': R([(560, 230), (588, 330), (576, 420), (598, 500), (584, 562)]), 'w': (U(72), U(22))},
    ],
    hairTones=_BLONDE,
    # the crown, parted in the middle, the sides swept back over the temples and TUCKED behind the
    # ear: the whole face shows
    hair=R([(96, 270, 'c'), (92, 180), (130, 100), (200, 56), (300, 34), (400, 36), (484, 62), (540, 120), (562, 210),
            (560, 300, 'c'), (536, 240), (504, 190), (452, 152), (394, 128), (338, 116, 'c'), (282, 128), (222, 152),
            (170, 190), (136, 236), (116, 268)]),
    hairShade=[R([(338, 118, 'c'), (270, 136), (196, 180), (150, 230), (120, 170), (170, 86), (260, 48), (338, 40),
                  (416, 48), (506, 86), (548, 170), (524, 236), (480, 180), (404, 136)])],
    hairLines=[R([(338, 56), (300, 96), (270, 150)]), R([(338, 56), (376, 96), (406, 150)]),
               R([(280, 56), (222, 102), (186, 160)]), R([(396, 56), (456, 102), (494, 160)])],
    locks=[
        # swept from the part back over the temple to behind the ear
        {'cl': R([(330, 54), (250, 66), (180, 108), (136, 170), (112, 232), (104, 272)]), 'w': (U(56), 1), 'tone': 'base', 'hi': 0.3, 'hiW': 0.2, 'lw': 0.45},
        {'cl': R([(318, 72), (246, 98), (192, 146), (156, 206), (134, 256)]), 'w': (U(40), 1), 'tone': 'hi', 'hi': 0.25, 'hiW': 0.2, 'lw': 0.45},
        {'cl': R([(250, 50), (182, 76), (132, 128), (102, 196), (94, 250)]), 'w': (U(36), 1), 'tone': 'mid', 'hi': 0.25, 'hiW': 0.2, 'lw': 0.45},
        {'cl': R([(346, 54), (426, 66), (496, 108), (540, 190), (554, 260), (560, 300)]), 'w': (U(56), 1), 'tone': 'base', 'hi': -0.3, 'hiW': 0.2, 'lw': 0.45},
        {'cl': R([(358, 72), (430, 98), (484, 146), (516, 220), (534, 290)]), 'w': (U(40), 1), 'tone': 'hi', 'hi': -0.25, 'hiW': 0.2, 'lw': 0.45},
        {'cl': R([(426, 50), (494, 76), (544, 128), (570, 210), (576, 280)]), 'w': (U(36), 1), 'tone': 'mid', 'hi': -0.25, 'hiW': 0.2, 'lw': 0.45},
    ],
    # Medusa's snakes: five green vipers rearing STRAIGHT UP out of her hair from behind her head,
    # jaws wide open and fangs out — two tall ones up her sides, two over her temples, one on top
    extras=snake([(150, 330), (70, 300), (30, 240), (56, 170), (28, 110), (44, 60)], 48, -128)
           + snake([(220, 160), (170, 110), (180, 56), (152, 14)], 40, -160)
           + snake([(330, 120), (316, 70), (340, 30), (324, 0)], 36, -40)
           + snake([(440, 160), (486, 110), (474, 56), (496, 14)], 40, -20)
           + snake([(510, 330), (576, 300), (604, 240), (580, 170), (600, 110), (576, 60)], 48, -52),
    scale=0.8,                                   # the rearing snakes stand tall: a touch smaller keeps them in frame
    nose={
        'tip': P1((430, 344)),
        'shade': [R([(420, 296, 'c'), (436, 318), (440, 338, 'c'), (426, 334)])],
        'hi': [R([(402, 300, 'c'), (410, 320), (411, 336, 'c'), (404, 320)])],
        'dark': [R([(414, 346, 'c'), (430, 334), (448, 346, 'c'), (431, 351)])],
    },
    furrow=0, furrowLines=[],
    eyes=[
        {'x0': P1((188, 0))[0], 'x1': P1((334, 0))[0], 'yt': P1((0, 246))[1], 'tilt': U(4), 'yb': P1((0, 336))[1], 'inner': 'right',
         'pupil': (U(44), U(58)), 'px': U(12), 'py': 0.2, 'bl': U(6), 'browOut': U(8), 'browIn': U(4), 'lidW': 4.4, 'round': 4.6},
        {'x0': P1((440, 0))[0], 'x1': P1((528, 0))[0], 'yt': P1((0, 248))[1], 'tilt': U(4), 'yb': P1((0, 332))[1], 'inner': 'left',
         'pupil': (U(32), U(54)), 'px': U(4), 'py': 0.2, 'skew': 0.6, 'browOut': U(6), 'browIn': U(2), 'lidW': 4.4, 'round': 4.0},
    ],
    lashes=True, lashLen=1.7, iris='#1a1210', irisRing='#6a4a36',
    browW=(U(12), U(16)), browGap=U(28), browArch=3.4, browC='#7a5230', browHi='#a57846',
    blush=[(*P1((238, 382)), 9, 4.0), (*P1((500, 380)), 6.5, 3.6)], blushC='#ff8f98',
    mouth={'x': P1((392, 0))[0], 'y': P1((0, 396))[1], 'w': U(66), 'lw': 2.0, 'grinH': 11, 'shoutH': 10.5},
    mouthInk='#8a2c34', lipC='#ec7f8e', lipTop='#d4606f',
    sweat=P1((548, 210)),
    exprs={'normal': {'furrow': 0, 'look': (0.4, 0.05)}},
    rim={'dx': 1.5, 'dy': 1.7, 'c': '#fff4c0', 'a': 220, 'zone': R([(-60, -60, 'c'), (400, -60, 'c'), (160, 160), (-60, 640, 'c')])},
)

_AUBURN = {'base': '#9a4f26', 'shade': '#6e3316', 'hi': '#c06d36', 'hi2': '#e09457', 'line': '#4c220d'}
_NAVEH_SKIN = {'base': '#e3a987', 'light': '#f4cbaa', 'hi': '#ffe4c8', 'mid': '#c2835f', 'dark': '#8a5034'}

# ── #3 Naveh on the grill: the yellow logo hat, a full auburn beard, a big grin ─────────────────
NAVEH_GRILL = char(
    dir='legendary-3', name='Naveh', ink='#1f120b',
    skin=_NAVEH_SKIN,
    hairShadow=R([(100, 240, 'c'), (330, 214), (566, 236, 'c'), (600, 0, 'c'), (60, 0, 'c')]),
    # the hat is the "hair": a boxy yellow cap sitting low on the brow
    hair=R([(84, 222, 'c'), (84, 130), (130, 54), (230, 16), (420, 14), (520, 48), (562, 126), (566, 222, 'c'),
            (470, 196), (330, 188), (190, 196)]),
    hairTones={'base': '#f7c81c', 'shade': '#d39a0b', 'hi': '#ffe45c', 'hi2': '#fff5b0', 'line': '#8f6106'},
    hairShade=[R([(60, 250, 'c'), (70, 120), (140, 30), (190, 20), (150, 120), (150, 240, 'c')]),
               R([(80, 236, 'c'), (190, 206), (330, 198), (470, 206), (580, 228, 'c'), (580, 250, 'c'), (80, 250, 'c')])],
    hairHi=[R([(250, 40, 'c'), (400, 30), (500, 60), (420, 60), (300, 64)])],
    extras=[
        # the Saltiz badge on the hat
        {'pts': R([(370, 50, 'c'), (440, 70, 'c'), (452, 140, 'c'), (390, 180, 'c'), (320, 160, 'c'), (310, 90, 'c')]),
         'tones': {'base': '#e2231a', 'shade': '#a8120c', 'hi': '#ff6a55', 'line': '#5e0a06'}, 'lw': 1.4,
         'shade': [R([(452, 140, 'c'), (390, 180, 'c'), (380, 150, 'c'), (430, 124, 'c')])],
         'hi': [R([(370, 58, 'c'), (430, 74, 'c'), (420, 84, 'c'), (372, 70, 'c')])]},
        {'pts': R([(352, 90, 'c'), (420, 96, 'c'), (420, 118, 'c'), (372, 116, 'c'), (374, 136, 'c'), (420, 136, 'c'),
                   (410, 156, 'c'), (346, 150, 'c'), (346, 106, 'c')]), 'tones': {'base': '#ffd21a', 'shade': '#d49a08', 'line': '#5e0a06'}, 'lw': 0.9},
        # grill tongs behind the hat on the left: two steel arms, scalloped tips
        {'cl': R([(150, 220), (110, 130), (84, 36), (80, -4)]), 'w': (U(20), U(16)), 'layer': 'back',
         'tones': {'base': '#bfc6cf', 'shade': '#7d8590', 'hi': '#eef2f6', 'line': '#2a2e34'}, 'lw': 1.0},
        {'cl': R([(170, 220), (150, 130), (140, 40), (150, -2)]), 'w': (U(20), U(16)), 'layer': 'back',
         'tones': {'base': '#bfc6cf', 'shade': '#7d8590', 'hi': '#eef2f6', 'line': '#2a2e34'}, 'lw': 1.0},
        {'pts': R([(60, 6, 'c'), (80, -20), (100, 6, 'c'), (92, 14), (80, 4), (68, 14)]), 'layer': 'back',
         'tones': {'base': '#9aa2ac', 'line': '#2a2e34'}, 'lw': 0.9},
        {'pts': R([(130, 4, 'c'), (150, -22), (170, 4, 'c'), (162, 12), (150, 2), (138, 12)]), 'layer': 'back',
         'tones': {'base': '#9aa2ac', 'line': '#2a2e34'}, 'lw': 0.9},
        # the spatula behind the hat on the right: a wooden handle, riveted steel neck, slotted blade
        {'cl': R([(556, 214), (576, 170), (592, 130)]), 'w': (U(22), U(20)), 'layer': 'back',
         'tones': {'base': '#8a5228', 'shade': '#5e3316', 'hi': '#b7773e', 'line': '#2e1606'}, 'lw': 1.1,
         'lines': [R([(566, 200), (580, 164)]), R([(574, 204), (586, 172)])], 'lineC': '#5e3316', 'lineW': 0.6},
        {'cl': R([(592, 132), (600, 110), (606, 92)]), 'w': (U(12), U(12)), 'layer': 'back',
         'tones': {'base': '#c9ced6', 'shade': '#8a919c', 'hi': '#f6f8fa', 'line': '#2a2e34'}, 'lw': 1.0,
         'dots': [(*P1((594, 124)), 0.7, 0.7, '#4a4f58')]},
        {'pts': R([(590, 96, 'c'), (574, 6, 'c'), (638, -8, 'c'), (650, 82, 'c')]), 'layer': 'back',
         'tones': {'base': '#cfd4dc', 'shade': '#9097a2', 'hi': '#f4f6fa', 'hi2': '#ffffff', 'line': '#2a2e34'}, 'lw': 1.2,
         'shade': [R([(628, 0, 'c'), (638, -8, 'c'), (650, 82, 'c'), (638, 86, 'c')])],
         'hi': [R([(580, 14, 'c'), (592, 10, 'c'), (604, 90, 'c'), (594, 94, 'c')])],
         'lines': [R([(604, 22), (610, 66)]), R([(616, 20), (622, 64)]), R([(628, 18), (634, 62)])], 'lineC': '#4a4f58', 'lineW': 1.4},
    ],
    beard={
        'tones': _AUBURN,
        'shape': R([(126, 226), (112, 300), (104, 372), (124, 440), (200, 486), (340, 496), (480, 488), (552, 452), (578, 392),
                    (568, 330), (556, 290), (548, 326), (520, 356), (470, 368), (432, 366), (404, 372), (340, 372), (280, 364),
                    (220, 352), (172, 326), (146, 290), (148, 232)]),
        'moustache': R([(318, 384, 'c'), (360, 360), (432, 356), (478, 372, 'c'), (440, 380), (384, 374)]),
        'shade': [R([(80, 380, 'c'), (180, 470), (330, 500), (520, 492), (600, 440, 'c'), (600, 560, 'c'), (80, 560, 'c')])],
        'streaks': [R([(160, 340, 'c'), (170, 410), (220, 460, 'c'), (190, 400)]), R([(290, 400, 'c'), (300, 450), (340, 482, 'c'), (310, 440)]),
                    R([(470, 400, 'c'), (480, 440), (520, 468, 'c'), (494, 430)])],
    },
    browC='#5a2e16', browHi='#8a4a26',
    mouth={'x': P1((396, 0))[0], 'y': P1((0, 394))[1], 'w': U(96), 'lw': 2.8, 'grinH': 13, 'shoutH': 12},
    mouthInk='#3a140a',
    exprs={'normal': {'mouth': 'grin', 'browLift': 1.2, 'browTilt': -1.5}},
    rim={'dx': 1.5, 'dy': 1.7, 'c': '#fff3a0', 'a': 230, 'zone': R([(-40, -40, 'c'), (420, -40, 'c'), (200, 140), (120, 330), (140, 560, 'c'), (-40, 560, 'c')])},
)

# ── #4 Naveh in the box: a big mop of copper curls, stubble, wide excited eyes, open grin ────────
NAVEH_BOX = char(
    dir='legendary-4', name='Naveh', ink='#1f120b',
    scale=0.85,                                  # the mop of curls is the tallest hair: a touch smaller keeps it in the frame
    skin=_NAVEH_SKIN,
    hairShadow=R([(124, 290, 'c'), (156, 222), (220, 184), (330, 172), (440, 178), (520, 200), (552, 250, 'c'), (600, 0, 'c'), (60, 0, 'c')]),
    hair=R([(120, 296, 'c'), (84, 236), (72, 150), (104, 70), (190, 20), (320, 0), (450, 10), (540, 56), (578, 140),
            (566, 240, 'c'), (536, 208), (480, 184), (400, 172), (330, 176), (250, 180), (190, 200), (156, 238, 'c'), (136, 262)]),
    hairTones={'base': '#b0592a', 'shade': '#7c3a17', 'hi': '#d97e3f', 'hi2': '#f3a868', 'line': '#56260c'},
    locks=curls([(100, 250, 150), (92, 170, 140), (130, 96, 120), (200, 48, 100), (290, 24, 90), (380, 22, 80), (466, 40, 60),
                 (530, 86, 40), (560, 160, 20), (556, 220, 0), (230, 150, 110), (340, 120, 90), (450, 128, 70), (400, 70, 80)], 44)
          + [{'cl': R([(200, 186), (240, 150), (282, 170)]), 'w': (U(40), 1), 'hi': 0.3},
             {'cl': R([(420, 176), (462, 150), (500, 180)]), 'w': (U(38), 1), 'hi': 0.3}],
    extras=[
        {'pts': R([(176, 50, 'c'), (230, 40, 'c'), (238, 86, 'c'), (184, 96, 'c')]), 'c': '#fbf6ee', 'clip': None, 'lw': 1.0, 'hi': [R([(186, 50), (226, 44), (228, 56), (190, 62)])], 'hiC': '#ffffff'},
        {'pts': R([(400, 14, 'c'), (452, 22, 'c'), (446, 66, 'c'), (394, 58, 'c')]), 'c': '#fbf6ee', 'clip': None, 'lw': 1.0, 'hi': [R([(404, 18), (446, 26), (444, 38), (402, 30)])], 'hiC': '#ffffff'},
        {'pts': R([(520, 110, 'c'), (566, 128, 'c'), (554, 170, 'c'), (508, 152, 'c')]), 'c': '#fbf6ee', 'clip': None, 'lw': 1.0},
    ],
    beard={
        'tones': _AUBURN, 'a': 70,
        'shape': R([(126, 290), (112, 372), (130, 440), (200, 486), (340, 496), (480, 488), (552, 452), (578, 392), (566, 330),
                    (530, 360), (470, 368), (420, 372), (340, 376), (270, 368), (200, 350), (156, 310)]),
        'moustache': R([(330, 378, 'c'), (380, 360), (440, 360), (470, 376, 'c'), (384, 372)]),
    },
    browC='#6a3216', browHi='#9a5428', browGap=U(20),
    mouth={'x': P1((392, 0))[0], 'y': P1((0, 390))[1], 'w': U(100), 'lw': 2.8, 'grinH': 14, 'shoutH': 12},
    mouthInk='#3a140a',
    exprs={'normal': {'mouth': 'grin', 'browLift': 2.6, 'browTilt': -3, 'lid': (-2, -3), 'furrow': 0, 'look': (0.3, 0)},
           'kick': {'furrow': 0}},
    rim={'dx': 1.5, 'dy': 1.7, 'c': '#ffd24a', 'a': 235, 'zone': R([(-40, -40, 'c'), (420, -40, 'c'), (200, 140), (120, 330), (140, 560, 'c'), (-40, 560, 'c')])},
)
for e in NAVEH_BOX['eyes']:
    e['tilt'] = U(12)

# ── #5 Paz at the ice pool: a straw fedora with a dark band, round glasses, a full ginger beard,
#    a big grin (card: "פז והארטיק") ───────────────────────────────────────────────────────────────
_GINGER = {'base': '#b35a28', 'shade': '#7e3a16', 'hi': '#d4783e', 'hi2': '#eea264', 'line': '#52240c'}
_STRAW = {'base': '#dcbc7c', 'shade': '#b18e4e', 'hi': '#f0daa4', 'hi2': '#fbefcf', 'line': '#6e5222'}
_FRAME = {'base': '#3b2a1e', 'shade': '#24180f', 'hi': '#6a5140', 'line': '#1a100a'}


def _ring(cx, cy, rx, ry, n=18):
    return R([(cx + math.cos(k / n * 2 * math.pi) * rx, cy + math.sin(k / n * 2 * math.pi) * ry) for k in range(n + 1)])


PAZ = char(
    dir='legendary-5', name='Paz', ink='#1f120b',
    scale=0.88,                                  # the brim is the widest thing on any head: a touch smaller keeps it in frame
    skin=_NAVEH_SKIN,
    # the brim's shadow across the forehead
    hairShadow=R([(96, 248, 'c'), (330, 226), (570, 248, 'c'), (600, 0, 'c'), (60, 0, 'c')]),
    # the hat's CROWN is the "hair": pinched at the top, sitting on the brow
    hair=R([(118, 206, 'c'), (126, 126), (168, 56), (250, 26), (330, 40), (410, 22), (490, 46), (532, 116), (542, 206, 'c'),
            (450, 192), (330, 188), (210, 194)]),
    hairTones=_STRAW,
    hairShade=[R([(100, 214, 'c'), (112, 120), (160, 40), (200, 34), (170, 120), (168, 208, 'c')])],
    hairHi=[R([(260, 40, 'c'), (330, 52), (400, 36), (380, 62), (300, 66)])],
    extras=[
        # the dark band round the crown
        {'pts': R([(120, 200, 'c'), (122, 162), (330, 150), (540, 160), (542, 198, 'c'), (330, 186)]),
         'tones': {'base': '#3a2a1c', 'shade': '#241810', 'hi': '#5e4630', 'line': '#1a100a'}, 'lw': 1.0},
        # the wide brim, over the top of the head
        {'pts': R([(4, 236, 'c'), (60, 200), (170, 184), (330, 180), (490, 184), (590, 200), (636, 234, 'c'), (580, 256),
                   (330, 250), (70, 258)]),
         'tones': _STRAW, 'lw': 1.4,
         'shade': [R([(4, 236, 'c'), (70, 258), (330, 250), (580, 256), (636, 234, 'c'), (590, 244), (330, 236), (60, 244)])],
         'hi': [R([(60, 204, 'c'), (200, 188), (330, 186), (220, 196)])]},
        # ginger curls peeking out under the brim at the back of the head
        {'pts': R([(56, 256, 'c'), (34, 292), (40, 336), (70, 350), (96, 326), (104, 280), (92, 256)]), 'tones': _GINGER, 'lw': 1.1, 'layer': 'back'},
        # round glasses: two rims, the bridge, the arm back to the ear
        {'cl': _ring(262, 288, 90, 66), 'w': (U(9), U(9)), 'tones': _FRAME, 'lw': 0.8},
        {'cl': _ring(486, 290, 60, 60), 'w': (U(8), U(8)), 'tones': _FRAME, 'lw': 0.8},
        {'cl': R([(352, 280), (388, 270), (426, 282)]), 'w': (U(8), U(8)), 'tones': _FRAME, 'lw': 0.8},
        {'cl': R([(172, 282), (130, 278), (96, 284)]), 'w': (U(8), U(7)), 'tones': _FRAME, 'lw': 0.8},
    ],
    beard={
        'tones': _GINGER,
        'shape': R([(126, 226), (112, 300), (104, 372), (124, 440), (200, 486), (340, 496), (480, 488), (552, 452), (578, 392),
                    (568, 330), (556, 290), (548, 326), (520, 356), (470, 368), (432, 366), (404, 372), (340, 372), (280, 364),
                    (220, 352), (172, 326), (146, 290), (148, 232)]),
        'moustache': R([(318, 384, 'c'), (360, 360), (432, 356), (478, 372, 'c'), (440, 380), (384, 374)]),
        'shade': [R([(80, 380, 'c'), (180, 470), (330, 500), (520, 492), (600, 440, 'c'), (600, 560, 'c'), (80, 560, 'c')])],
        'streaks': [R([(160, 340, 'c'), (170, 410), (220, 460, 'c'), (190, 400)]), R([(290, 400, 'c'), (300, 450), (340, 482, 'c'), (310, 440)]),
                    R([(470, 400, 'c'), (480, 440), (520, 468, 'c'), (494, 430)])],
    },
    browC='#6a3216', browHi='#9a5428',
    mouth={'x': P1((396, 0))[0], 'y': P1((0, 394))[1], 'w': U(104), 'lw': 2.8, 'grinH': 15, 'shoutH': 12},
    mouthInk='#3a140a',
    exprs={'normal': {'mouth': 'grin', 'browLift': 2.4, 'browTilt': -2.5, 'lid': (-1.5, -2), 'furrow': 0, 'look': (0.35, 0)}},
    rim={'dx': 1.5, 'dy': 1.7, 'c': '#fff3a0', 'a': 230, 'zone': R([(-40, -40, 'c'), (420, -40, 'c'), (200, 140), (120, 330), (140, 560, 'c'), (-40, 560, 'c')])},
)

CHARS = {'legendary:1': SHOVAL, 'legendary:2': ORI, 'legendary:3': NAVEH_GRILL, 'legendary:4': NAVEH_BOX, 'legendary:5': PAZ}
