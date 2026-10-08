# THE MYTHIC STARTERS' GAME ART (Idan, 2026-10-08: option A for all four).
#
# From the approved traces (public/mythic-concepts/heads/<champ>-bl-A.svg, made from the artist's
# sheets by tools/chars/mythic_trace.py) to the files the game plays, in the same frame as #1–#5
# (public/characters.js CHAR_BOX, docs/CHARACTERS.md):
#   public/img/chars/mythic-<n>/<expression>.webp     576 x 568, the HD portrait, alpha, lossy
#   public/img/chars/mythic-<n>/px-<expression>.webp  40 x 48, the pitch sprite (built, not shown)
# The three-quarter view is the one the pitch shows; a sheet that drew it facing left is mirrored
# (characters face right, the game mirrors player two). The head, hair included but not hair that
# hangs below it, is laid exactly on the drawn-head box every character fills (game.js CHAR_FIT:
# 128 x 114 frame units, its middle at x 75.2, the chin on y 118.2), so on the pitch it is the head
# box and stands over the same hitbox as #1–#5. The artist drew one face, so every expression is
# that face (in play every character keeps its normal face anyway: characters.js expressionFor).
#
# Needs Chrome, which rasterises the SVG exactly as the browser does:
#   <venv with pillow numpy>/bin/python tools/chars/mythic_build.py --chrome "<chrome path>"
import argparse, base64, json, os, subprocess, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HEADS = json.load(open(os.path.join(ROOT, 'public', 'mythic-concepts', 'heads', 'heads.json')))
EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad']
U = 4                                         # px per frame unit
FW, FH = 144 * U, 142 * U
FIT = {'w': 128 * U, 'h': 114 * U, 'cx': 75.2 * U, 'bot': 118.2 * U}
SS = 2                                        # render supersampled, then downsample
PX = (40, 48)

# card number, sheet, does its three-quarter view face left, and where the eyes (back, front) and
# the nose tip are in that panel (panel px, read off the sheet on a grid) for the hit marks
MYTHICS = [
    {'n': 1, 'id': 'champ_A', 'left': True, 'eyes': [[412, 300], [281, 300]], 'nose': [262, 337]},
    {'n': 2, 'id': 'champ_B', 'left': False, 'panel': 'blg', 'eyes': [[412, 294], [519, 294]], 'nose': [556, 344]},
    {'n': 3, 'id': 'champ_C', 'left': True, 'eyes': [[419, 300], [300, 300]], 'nose': [281, 356]},
    {'n': 4, 'id': 'champ_D', 'left': True, 'eyes': [[406, 300], [294, 300]], 'nose': [275, 375]},
]


def placement(m, mirror):
    """Where the head image goes in the frame (px), and a function from panel px to frame px."""
    pad = m['pad']
    h0, _, h2, chin = m['head']
    sx, sy = FIT['w'] / (h2 - h0), FIT['h'] / chin
    W, H = (m['w'] + 2 * pad) * sx, (m['h'] + 2 * pad) * sy
    uc = pad + (h0 + h2) / 2                   # the head's middle, in image px
    if mirror: uc = (m['w'] + 2 * pad) - uc
    x, y = FIT['cx'] - uc * sx, FIT['bot'] - (pad + chin) * sy

    def to_frame(px, py):
        hx, hy = px - m['off'][0], py - m['off'][1]
        dx = (hx - (h0 + h2) / 2) * sx
        return FIT['cx'] + (-dx if mirror else dx), FIT['bot'] - (chin - hy) * sy
    return (x, y, W, H), to_frame


def render(chrome, svg_file, box, mirror, out):
    # the SVG goes in inline (a page cannot fetch it from the server: Chrome blocks that), in a
    # throwaway local page next to the output
    x, y, W, H = (v * SS for v in box)
    flip = 'transform:scaleX(-1);' if mirror else ''
    # stretched to the box, not letterboxed: an <img> SVG keeps its own aspect unless told not to
    svg = open(svg_file).read().replace('<svg ', '<svg preserveAspectRatio="none" ', 1)
    src = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()
    page = out + '.html'
    open(page, 'w').write(f'<html><body style="margin:0;background:transparent;overflow:hidden">'
                          f'<img src="{src}" style="position:absolute;left:{x:.2f}px;top:{y:.2f}px;width:{W:.2f}px;height:{H:.2f}px;{flip}"></body></html>')
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--window-size={FW * SS},{FH * SS}',
                    '--default-background-color=00000000', '--virtual-time-budget=4000', f'--screenshot={out}',
                    'file://' + page], check=True, capture_output=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chrome', required=True)
    ap.add_argument('--option', default='A')
    a = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix='mythic-')
    lines = []
    for my in MYTHICS:
        pn = my.get('panel', 'bl')
        m = HEADS[my['id']][pn]
        box, to_frame = placement(m, my['left'])
        png = os.path.join(tmp, f"{my['id']}.png")
        render(a.chrome, os.path.join(ROOT, 'public', 'mythic-concepts', 'heads', f"{my['id']}-{pn}-{a.option}.svg"), box, my['left'], png)
        im = Image.open(png).convert('RGBA').resize((FW, FH), Image.LANCZOS)
        al = np.asarray(im)[..., 3]
        if al.max() == 0: raise SystemExit(f"{my['id']}: nothing rendered")
        d = os.path.join(ROOT, 'public', 'img', 'chars', f"mythic-{my['n']}")
        os.makedirs(d, exist_ok=True)
        # the pitch sprite: the same face at HS's in-match density, hard alpha (not shown in play)
        px = im.resize(PX, Image.LANCZOS)
        pa = np.asarray(px).copy(); pa[..., 3] = np.where(pa[..., 3] > 110, 255, 0)
        px = Image.fromarray(pa, 'RGBA')
        for e in EXPRESSIONS:
            im.save(os.path.join(d, f'{e}.webp'), 'WEBP', quality=80, method=6)
            px.save(os.path.join(d, f'px-{e}.webp'), 'WEBP', lossless=True)
        ys, xs = np.nonzero(al > 16)
        fit = [round(xs.min() / U, 1), round(ys.min() / U, 1), round((xs.max() + 1) / U, 1), round((ys.max() + 1) / U, 1)]
        frac = lambda p: [round(p[0] / FW, 3), round(p[1] / FH, 3)]
        eyes = [frac(to_frame(*e)) for e in my['eyes']]
        nose = frac(to_frame(*my['nose']))
        size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
        print(f"mythic:{my['n']} fit {fit} nose {nose} eyes {eyes} {size // 1024} KB", flush=True)
        lines.append({'key': f"mythic:{my['n']}", 'dir': f"mythic-{my['n']}", 'nose': nose, 'eyes': eyes, 'fit': fit})
    json.dump(lines, open(os.path.join(tmp, 'registry.json'), 'w'))
    print('registry:', os.path.join(tmp, 'registry.json'))


if __name__ == '__main__':
    main()
