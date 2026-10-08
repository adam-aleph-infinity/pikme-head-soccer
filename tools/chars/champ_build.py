# THE NEW LEGENDARY CHAMPIONS' GAME ART (Idan's picks off public/_champions.html, 2026-10-08).
#
# From a chosen design (public/champ-concepts/card-NN.js, drawn in the game's frame, every expression
# through kit.js setExpr) to the files the game plays, in the same frame as before (characters.js
# CHAR_BOX, docs/CHARACTERS.md):
#   public/img/chars/legendary-<n>/<expression>.webp     576 x 568, the HD portrait, alpha, lossy
#   public/img/chars/legendary-<n>/px-<expression>.webp  40 x 48, the pitch sprite (built, not shown)
# The designs are already in frame units and refitted to the hitbox (kit.js fitted), so they are
# rendered as they are, no placement. Chrome draws them exactly as the browser does, off the dev
# server (public/_champ-render.html). The art a card had before is kept in .charwork/backup/.
#
#   ~/.charvenv/bin/python tools/chars/champ_build.py --chrome "<chrome path>" 1A 2D 3B 4C 5B
# prints the characters.js line for each.
import argparse, json, os, re, shutil, subprocess, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPRESSIONS = ['normal', 'kick', 'hurt', 'happy', 'sad']
U, SS = 4, 2
FW, FH = 144 * U, 142 * U
PX = (40, 48)


def chrome_run(chrome, args):
    return subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=6000', *args],
                          check=True, capture_output=True, text=True).stdout


def body_box(al):
    """The drawn head's box in frame units (characters.js fit): the champion's own body, keyline
    included, leaving out the small loose bits round it (sparkles, bubbles, flying crumbs), which
    would only shrink its portraits."""
    m = np.asarray(Image.fromarray(al).resize((FW // 2, FH // 2), Image.BILINEAR)) > 64
    h, w = m.shape
    lab = np.zeros(m.shape, np.int32); sizes = [0]
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        k = len(sizes); lab[y0, x0] = k; stack = [(y0, x0)]; n = 0
        while stack:
            y, x = stack.pop(); n += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = k; stack.append((yy, xx))
        sizes.append(n)
    keep = [k for k, n in enumerate(sizes) if k and n >= 0.15 * max(sizes)]
    ys, xs = np.nonzero(np.isin(lab, keep))
    u = U / 2
    return [round(float(xs.min()) / u, 1), round(float(ys.min()) / u, 1), round(float(xs.max() + 1) / u, 1), round(float(ys.max() + 1) / u, 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chrome', required=True)
    ap.add_argument('--port', default='3020')
    ap.add_argument('picks', nargs='+')
    a = ap.parse_args()
    base = f'http://127.0.0.1:{a.port}/_champ-render.html'
    tmp = tempfile.mkdtemp(prefix='champ-')
    for tag in a.picks:
        tag, _, dirname = tag.partition('=')       # 0A=coach: a drawing with no card, built into img/chars/coach
        n = int(tag[:-1])
        dirname = dirname or f'legendary-{n}'
        dom = chrome_run(a.chrome, ['--dump-dom', f'{base}?tag={tag}&meta=1'])
        meta = json.loads(re.search(r'<pre id="meta">(.*?)</pre>', dom, re.S).group(1).replace('&quot;', '"'))
        d = os.path.join(ROOT, 'public', 'img', 'chars', dirname)
        bak = os.path.join(ROOT, '.charwork', 'backup', dirname)
        if os.path.isdir(d) and not os.path.isdir(bak): shutil.copytree(d, bak)
        os.makedirs(d, exist_ok=True)
        fit = None
        for e in EXPRESSIONS:
            png = os.path.join(tmp, f'{tag}-{e}.png')
            chrome_run(a.chrome, [f'--window-size={FW * SS},{FH * SS}', '--default-background-color=00000000', f'--screenshot={png}', f'{base}?tag={tag}&expr={e}&ss={SS}'])
            im = Image.open(png).convert('RGBA').resize((FW, FH), Image.LANCZOS)
            al = np.asarray(im)[..., 3]
            if al.max() == 0: raise SystemExit(f'{tag} {e}: nothing rendered')
            im.save(os.path.join(d, f'{e}.webp'), 'WEBP', quality=80, method=6)
            # the pitch sprite: the same face at HS's in-match density, hard alpha (not shown in play)
            px = im.resize(PX, Image.LANCZOS)
            pa = np.asarray(px).copy(); pa[..., 3] = np.where(pa[..., 3] > 110, 255, 0)
            Image.fromarray(pa, 'RGBA').save(os.path.join(d, f'px-{e}.webp'), 'WEBP', lossless=True)
            if e == 'normal': fit = body_box(al)
        frac = lambda p: [round(p[0] / 144, 3), round(p[1] / 142, 3)]
        size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
        print(f"  '{'legendary:' + str(n) if dirname.startswith('legendary-') else dirname + ':1'}': {{ dir: '{dirname}', name: '{meta['name']}', nose: {frac(meta['nose'])}, eyes: {[frac(p) for p in meta['eyes']]}, fit: {fit} }},   // {tag}, {size // 1024} KB", flush=True)


if __name__ == '__main__':
    main()
