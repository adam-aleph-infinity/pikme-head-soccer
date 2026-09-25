"""Build the REAL-FACE Head Soccer characters from card photos. docs/CHARACTERS.md explains the look.

    python tools/chars/build-real.py <dir> [--from STAGE] [--only EXPR,...] [--work DIR]

<dir> is a key of tools/chars/real.json (e.g. legendary-1). Stages, each cached in <work>/<dir>/:

  card     download the card (or reuse card.png)
  vision   vision-matte.swift on the card: subject matte + face landmarks
  restore  crop the head, Real-ESRGAN x4, GFPGAN v1.4 face restore (blend 'gfpgan')
  grade    colour: undo the card's coloured light (hue rotation in Lab, per real.json 'grade')
  pose     LivePortrait (expressions.py): the real face re-posed into each expression + 3/4 turn
  refine   GFPGAN again on each posed face (LivePortrait renders at 512), then Vision again for the
           matte and landmarks of the posed head
  compose  cut the head out (hair + face, no neck), caricature warp, grade, shade, keyline, frame
           -> public/img/chars/<dir>/<expr>.webp

Heavy tools (not game dependencies, dev machine only): a Python venv with torch, basicsr, realesrgan,
gfpgan, facexlib, opencv, pillow; weights in $CHAR_WEIGHTS; a LivePortrait checkout in
$LIVEPORTRAIT_DIR; macOS Vision (swift). `compose` alone needs only opencv + numpy + pillow + cwebp,
so the look can be re-tuned without the models once the refine outputs exist.
"""
import argparse, json, os, subprocess, sys, urllib.request
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STAGES = ['card', 'vision', 'restore', 'grade', 'pose', 'refine', 'compose']
SWIFT = os.environ.get('SWIFT', '/Library/Developer/CommandLineTools/usr/bin/swift')

# The frame every character file shares (public/characters.js CHAR_BOX): the head box is 100 x 91.5
# units at (BX, BY) inside a 144 x 142 canvas. PX = output pixels per unit.
FW, FH, BX, BY, BW, BH = 144, 142, 22, 26, 100, 91.5


def log(*a): print('[build-real]', *a, flush=True)


def vision(img_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    subprocess.run([SWIFT, os.path.join(HERE, 'vision-matte.swift'), img_path, out_dir], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return json.load(open(os.path.join(out_dir, 'face.json')))


_gfp = None
def gfpgan(img, weight):
    global _gfp
    import torch
    if _gfp is None:
        from gfpgan import GFPGANer
        W = os.environ.get('CHAR_WEIGHTS', '.weights')
        dev = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
        here = os.getcwd(); os.chdir(W)      # facexlib keeps its detector in ./gfpgan/weights
        try:
            _gfp = GFPGANer(model_path=os.path.join(os.path.abspath(W), 'GFPGANv1.4.pth'), upscale=1, arch='clean',
                            channel_multiplier=2, bg_upsampler=None, device=dev)
        finally:
            os.chdir(here)
    _, _, out = _gfp.enhance(img, has_aligned=False, only_center_face=True, paste_back=True, weight=weight)
    return img if out is None else out


def restore(card, face, cfg, out_dir):
    import torch
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer
    fx, fy, fw, fh = face['box']
    size = int(round(fw * cfg.get('span', 2.5)))
    x0 = int(round(fx + fw / 2 - size / 2)); y0 = int(round(fy + fh / 2 - size * cfg.get('up', 0.62)))
    big = cv2.copyMakeBorder(card, size, size, size, size, cv2.BORDER_REFLECT)
    crop = big[y0 + size:y0 + 2 * size, x0 + size:x0 + 2 * size]
    W = os.environ.get('CHAR_WEIGHTS', '.weights')
    dev = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    esr = RealESRGANer(scale=4, model_path=os.path.join(W, 'RealESRGAN_x4plus.pth'),
                       model=RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4),
                       tile=0, pre_pad=10, half=False, device=dev)
    up, _ = esr.enhance(crop, outscale=4)
    cv2.imwrite(os.path.join(out_dir, 'esr.png'), up)
    out = gfpgan(up, cfg.get('gfpgan', 0.6))
    cv2.imwrite(os.path.join(out_dir, 'restored.png'), out)
    json.dump({'x': x0, 'y': y0, 'size': size, 'scale': 4}, open(os.path.join(out_dir, 'crop.json'), 'w'))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def grade(img, g):
    """Undo the card's coloured light. g.rot: Lab hue rotation (deg) applied to hues in [lo, hi]
    (feathered over g.feather deg); g.chroma: chroma gain; g.light: L gain; g.lift: L offset."""
    if not g: return img
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0] * (100 / 255), lab[..., 1] - 128, lab[..., 2] - 128
    h = np.degrees(np.arctan2(b, a)); c = np.hypot(a, b)
    lo, hi = g.get('band', [70, 150]); fe = g.get('feather', 30)
    w = smoothstep(lo - fe, lo, h) * (1 - smoothstep(hi, hi + fe, h))
    # rotHi: extra rotation for the greenest hues (the hair's green-lit highlights), from hiFrom up
    extra = g.get('rotHi', 0) * smoothstep(g.get('hiFrom', 110), g.get('hiFrom', 110) + 20, h)
    h = h + (g.get('rot', 0) + extra) * w
    c = c * (1 + (g.get('chroma', 1) - 1) * w)
    L = np.clip(L * g.get('light', 1) + g.get('lift', 0), 0, 100)
    a, b = c * np.cos(np.radians(h)), c * np.sin(np.radians(h))
    lab = np.dstack([L * 2.55, a + 128, b + 128])
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


# ─── compose ────────────────────────────────────────────────────────────────────────────────

def lm_pts(face, k): return np.array(face['landmarks'][k], np.float32)


def radial_warp(maps, c, R, k):
    """Magnify (k > 0) inside radius R round c: a smooth bulge that is identity at R."""
    mx, my = maps
    dx, dy = mx - c[0], my - c[1]
    r = np.sqrt(dx * dx + dy * dy)
    t = np.clip(r / R, 0, 1)
    s = 1 - k * (1 - t * t) ** 2          # sample closer to the centre -> magnified
    return c[0] + dx * s, c[1] + dy * s


def chibi_warp(maps, cx, top, chin, pivot, ktop, klow, brow=None, kup=0.0):
    """HS head shape from a real head: the cranium widened (most at the top of the hair, none at the
    chin), the face below `pivot` (the nose) shortened and the hair above `brow` lowered, so the head
    reads as HS's wide dome over a small jaw — wider than tall. Inverse map: dest -> src."""
    mx, my = maps
    f = 1 + ktop * smoothstep(chin, top, my)
    sx = cx + (mx - cx) / f
    sy = np.where(my > pivot, pivot + (my - pivot) / max(1e-3, 1 - klow), my)
    if brow is not None and kup:
        sy = np.where(my < brow, brow - (brow - my) / max(1e-3, 1 - kup), sy)
    return sx.astype(np.float32), sy.astype(np.float32)


def smooth_forehead(img, face, k, fw):
    """Iron out the card's expression lines (a scream's forehead furrows) that a re-posed calm face
    would otherwise keep: remove the mid frequencies (wrinkle scale) on the forehead's SKIN only,
    keeping the fine texture and the broad shading."""
    brows = np.concatenate([lm_pts(face, 'leftBrow'), lm_pts(face, 'rightBrow')])
    x0, x1 = brows[:, 0].min(), brows[:, 0].max()
    top = brows[:, 1].min()
    H, W = img.shape[:2]
    f = img.astype(np.float32)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    # skin colour: the median of the cheeks under the eyes
    le, re = lm_pts(face, 'leftEye').mean(0), lm_pts(face, 'rightEye').mean(0)
    samples = []
    for c in (le, re):
        y, x = int(c[1] + 0.18 * fw), int(c[0])
        samples.append(lab[max(0, y - 8):y + 8, max(0, x - 8):x + 8].reshape(-1, 3))
    ref = np.median(np.concatenate(samples), 0)
    dist = np.linalg.norm((lab - ref)[..., 1:], axis=2)                # chroma distance only
    skin = np.clip(1 - (dist - 8) / 10, 0, 1) * (lab[..., 0] > ref[0] * 0.55)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    box = (smoothstep(top - 0.42 * fw, top - 0.3 * fw, yy) * (1 - smoothstep(top + 0.06 * fw, top + 0.12 * fw, yy))
           * smoothstep(x0 - 0.02 * fw, x0 + 0.08 * fw, xx) * (1 - smoothstep(x1 - 0.08 * fw, x1 + 0.02 * fw, xx)))
    # the glabella (between the brows) too: that is where the worry sits
    cx = (le[0] + re[0]) / 2
    gl = np.exp(-(((xx - cx) / (0.09 * fw)) ** 2 + ((yy - (top + 0.05 * fw)) / (0.08 * fw)) ** 2))
    m = cv2.GaussianBlur(np.clip(np.maximum(box, gl) * skin, 0, 1), (0, 0), 0.02 * fw)[..., None]
    band = cv2.GaussianBlur(f, (0, 0), 0.006 * fw) - cv2.GaussianBlur(f, (0, 0), 0.05 * fw)
    return np.clip(f - band * m * k, 0, 255).astype(np.uint8)


def head_mask(img, matte, face, hcfg):
    """Hair + face, the neck and shirt trimmed off under the jaw."""
    H, W = matte.shape
    con = lm_pts(face, 'contour')                      # ear to ear along the jaw, through the chin
    con = con[np.argsort(con[:, 0])]
    fw = con[:, 0].max() - con[:, 0].min()
    drop = hcfg.get('jawDrop', 0.015) * fw
    xs = np.arange(W, dtype=np.float32)
    # jaw line as y(x): the contour inside, flat beyond its ends (continued at the end height)
    jy = np.interp(xs, con[:, 0], con[:, 1] + drop)
    keep = np.arange(H, dtype=np.float32)[:, None] <= jy[None, :]
    m = matte.astype(np.float32) / 255
    below = ~keep
    lh = hcfg.get('longHair', 0)
    if lh > 0:
        # long hair may hang past the jaw beside the face down to chin + lh*fw, bright pixels only
        # (blonde hair; the neck in shadow and the black top are dropped)
        chin = con[:, 1].max()
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        L, A = lab[..., 0] / 255, lab[..., 1] - 128
        # hair, not the black top (dark) or the card's worms (pink-brown)
        hairish = (L > hcfg.get('hairL', 0.22)) & (A < hcfg.get('hairMaxA', 14))
        hairish = cv2.GaussianBlur(hairish.astype(np.float32), (0, 0), 3) > 0.5
        cx = (con[:, 0].min() + con[:, 0].max()) / 2
        inside = np.abs(xs - cx) < fw * hcfg.get('neckHalf', 0.30)
        yy = np.arange(H, dtype=np.float32)[:, None]
        # the hem: an arc, lowest at the outside, so the hair ends in a rounded fall not a ruler line
        hem = chin + lh * fw - (np.clip(1 - np.abs(xs - cx) / (fw * 0.9), 0, 1) ** 2)[None, :] * fw * 0.18
        # and nothing wider than the hair can hang: an ellipse round the head drops arms and props
        ey = (con[:, 1].min() + chin) / 2
        ell = ((xs[None, :] - cx) / (fw * hcfg.get('hairHalfW', 0.82))) ** 2 + ((yy - ey) / (fw * 1.1)) ** 2 < 1
        allow = below & (yy < hem) & hairish & ~inside[None, :] & (matte > 128) & ell
        # the jaw line only trims the neck: beside the face the hair keeps its own edge down to the hem
        keep = keep | (below & ~inside[None, :] & (yy <= con[:, 1].max()) & ell & (np.abs(xs - cx)[None, :] > fw * 0.5))
        # thin strands and stray curls go: only locks at least ~8% of the jaw wide survive
        k = max(3, int(hcfg.get('lockMin', 0.08) * fw) | 1)
        allow = cv2.morphologyEx(allow.astype(np.uint8), cv2.MORPH_OPEN,
                                 cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
        keep = keep | allow
    m = m * keep
    return m


def silhouette(m, px_per_fw, fw, smooth=0.018, close=0.03):
    """A clean graphic silhouette from the soft matte: holes closed, wisps and nicks smoothed."""
    b = (m > 0.5).astype(np.uint8)
    k = max(3, int(close * fw) | 1)
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    # keep the biggest blob
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    if n > 1:
        big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); b = (lab == big).astype(np.uint8)
    # fill holes
    ff = b.copy(); h, w = b.shape
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
    b = b | (1 - ff)
    s = cv2.GaussianBlur(b.astype(np.float32), (0, 0), smooth * fw)
    return s          # soft; threshold 0.5 = the edge


def decontaminate(img, alpha, radius):
    """Replace every pixel that is not solidly the person (matte <= 0.98: the soft rim, and the
    background) with colour pulled in from inside the head (normalised blurs at growing radii),
    so no card background (yellow shack, green worms) bleeds into the edge under the keyline."""
    solid = (alpha > 0.98).astype(np.float32)
    inner = img.astype(np.float32) * solid[..., None]
    acc, ws = inner.copy(), solid.copy()
    for s in (radius * 0.5, radius, radius * 2, radius * 4):
        acc_b = cv2.GaussianBlur(inner, (0, 0), s); ws_b = cv2.GaussianBlur(solid, (0, 0), s)
        fill = ws < 0.5
        acc[fill] = acc_b[fill]; ws[fill] = ws_b[fill]
    fillc = acc / np.maximum(ws, 1e-4)[..., None]
    return np.where(solid[..., None] > 0, img, fillc).astype(np.float32)


def compose(img, lift, person, face, cfg, expr, px, ed):
    """img: the refined, posed 4x head crop (BGR uint8); lift/person: its Vision mattes; face: its
    landmarks. Returns the framed character as BGRA uint8 (FW*px x FH*px)."""
    hc = cfg.get('head', {}); st = dict(cfg.get('style', {}), **cfg.get('styleBy', {}).get(expr, {}))
    H, W = lift.shape
    con = lm_pts(face, 'contour'); fw = float(con[:, 0].max() - con[:, 0].min())
    if st.get('forehead'):
        img = smooth_forehead(img, face, st['forehead'], fw)
    # 1. matte: where the two Vision mattes agree. The person matte has the cleaner head and hair; the
    # subject lift can take props touching the person (card #2's arm and worms) and is only a limit.
    grow = cv2.dilate(lift, np.ones((9, 9), np.uint8))
    m0 = np.minimum(person, grow)
    hm = head_mask(img, m0, face, hc)
    sil = silhouette(hm, px, fw, st.get('smooth', 0.018), st.get('close', 0.03))
    # 2. clean the edge colour, then the caricature warp (image and silhouette together)
    base = decontaminate(img.astype(np.float32), hm, 0.01 * fw)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    maps = (gx, gy)
    le, re = lm_pts(face, 'leftEye').mean(0), lm_pts(face, 'rightEye').mean(0)
    mid = (le + re) / 2
    if st.get('chibiTop') or st.get('chibiLow'):
        yy = np.nonzero((sil > 0.5).any(1))[0]
        nose0 = lm_pts(face, 'nose').mean(0)
        brow0 = np.concatenate([lm_pts(face, 'leftBrow'), lm_pts(face, 'rightBrow')])[:, 1].min()
        maps = chibi_warp(maps, (con[:, 0].min() + con[:, 0].max()) / 2, float(yy.min()), float(con[:, 1].max()),
                          float(nose0[1]), st.get('chibiTop', 0), st.get('chibiLow', 0), float(brow0), st.get('chibiUp', 0))
    bulge = st.get('bulge', 0.0)
    if bulge: maps = radial_warp(maps, (mid[0], mid[1] + 0.05 * fw), st.get('bulgeR', 1.2) * fw, bulge)
    ek = st.get('eyes', 0.0)
    if ek:
        for c in (le, re): maps = radial_warp(maps, c, st.get('eyeR', 0.3) * fw, ek)
    mx, my = maps
    base = cv2.remap(base, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    sil = cv2.remap(sil, mx, my, cv2.INTER_LINEAR, borderValue=0)

    def fwd(p):   # where a source point lands after the warp (nearest sample)
        d = (mx - p[0]) ** 2 + (my - p[1]) ** 2
        i = int(np.argmin(d)); return np.array([i % W, i // W], np.float32)
    nose = fwd(lm_pts(face, 'nose').mean(0))
    # 3. placement scale (work px -> frame px): face width in units, plus a horizontal widen
    # scale from the NORMAL face's jaw width for every expression (the contour Vision finds widens
    # when a mouth opens), so the head keeps one size whatever the face does
    anc = os.path.join(os.path.dirname(ed), 'anchor.json')
    fw_n = fw if expr == 'normal' or not os.path.exists(anc) else json.load(open(anc))['fw']
    s = st.get('faceU', 64) * px / fw_n
    sx, sy = s * st.get('widen', 1.0), s
    upx = px / s                            # work px per head-box unit (vertical)
    ol_u = st.get('outline', 3.6)
    ol = ol_u * upx                         # keyline width in work px
    # 4. look: gentle edge-preserving smoothing, contrast and chroma, shading, rim light
    b8 = np.clip(base, 0, 255).astype(np.uint8)
    sm = cv2.bilateralFilter(b8, 0, st.get('bilatC', 18), max(1.0, 0.006 * fw)).astype(np.float32)
    base = base + (sm - base) * st.get('smoothMix', 0.5)
    lab = cv2.cvtColor(np.clip(base, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0] / 255
    ck = st.get('contrast', 0.15)
    L = L + ck * (L - 0.5) * (1 - np.abs(2 * L - 1))              # soft S-curve
    L = np.clip(L * st.get('light', 1.0) + st.get('lift', 0.0), 0, 1)
    lab[..., 0] = L * 255
    lab[..., 1:] = 128 + (lab[..., 1:] - 128) * st.get('chroma', 1.1)
    base = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    binm = (sil > 0.5).astype(np.uint8)
    din = cv2.distanceTransform(binm, cv2.DIST_L2, 5)             # inside: px to the edge
    dout = cv2.distanceTransform(1 - binm, cv2.DIST_L2, 5)        # outside: px to the edge
    sd = np.where(binm > 0, -din, dout)
    # back-side shade (the back of the head is the left: characters face right) and a lit front
    xs = (gx - mid[0]) / fw
    shade = st.get('shade', 0.18) * smoothstep(-0.1, -0.75, xs)
    lit = st.get('lit', 0.06) * smoothstep(0.0, 0.5, xs) * smoothstep(0.9, 0.2, (gy - mid[1]) / fw + 0.5)
    base = base * (1 - shade[..., None]) + (255 - base) * lit[..., None]
    # volume: light the head as a dome (normals from the silhouette's distance field), key light
    # front-top on the facing side like HS — the photo's own shading stays underneath
    vol = st.get('volume', 0.0)
    if vol:
        # a blurred silhouette is a smooth dome (a distance field has a crease along its medial axis)
        R = st.get('domeR', 0.35) * fw
        hgt = cv2.GaussianBlur(binm.astype(np.float32), (0, 0), st.get('domeBlur', 0.2) * fw)
        hy, hx = np.gradient(hgt * R * 2.5)
        n = np.dstack([-hx, -hy, np.ones_like(hx)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
        Ld = np.array(st.get('keyDir', [0.45, -0.6, 0.65]), np.float32); Ld /= np.linalg.norm(Ld)
        diff = np.clip(n @ Ld, 0, 1)
        k = (st.get('ambient', 0.62) + (1 - st.get('ambient', 0.62)) * diff / max(1e-3, float(Ld[2])))
        base = base * (1 + (k[..., None] - 1) * vol)
    # a soft occlusion just inside the edge, all round
    ao = st.get('ao', 0.22) * np.exp(-din / (st.get('aoU', 2.2) * upx))
    base = base * (1 - ao[..., None])
    # rim light: a thin warm band along the back/top edge
    sb = cv2.GaussianBlur(sil, (0, 0), 2.0 * upx)
    ny, nx = np.gradient(-sb)
    nn = np.sqrt(nx * nx + ny * ny) + 1e-6
    ldir = np.array(st.get('rimDir', [-0.75, -0.66]), np.float32); ldir /= np.linalg.norm(ldir)
    facing = np.clip((nx * ldir[0] + ny * ldir[1]) / nn, 0, 1) ** 1.5
    rimw = st.get('rimU', 1.4) * upx
    rim = st.get('rim', 0.7) * facing * np.clip(1 - din / rimw, 0, 1) ** 1.5 * binm
    rc = np.array(st.get('rimColor', [150, 225, 255]), np.float32)[None, None, :]   # BGR pale gold
    base = base + (rc - base) * (rim[..., None] * 0.6)
    # 5. keyline: near-black band outside the silhouette, the head inset a hair so no halo shows
    olc = np.array(st.get('outlineColor', [8, 15, 28]), np.float32)          # BGR #1c0f08
    aa = 0.8
    a_head = np.clip((-sd - st.get('inset', 0.3) * upx) / aa + 0.5, 0, 1)
    a_all = np.clip((ol - sd) / aa + 0.5, 0, 1)
    col = base * a_head[..., None] + olc * (1 - a_head[..., None])
    # 6. premultiply, scale to the frame, place: chin on the box bottom, face centre on the box centre
    pm = np.dstack([col * a_all[..., None], a_all * 255]).astype(np.float32)
    tw, th = max(1, int(round(W * sx))), max(1, int(round(H * sy)))
    small = cv2.resize(pm, (tw, th), interpolation=cv2.INTER_AREA)
    ys, xs_ = np.nonzero(binm)
    cxw = (con[:, 0].min() + con[:, 0].max()) / 2
    chin = ys[np.abs(xs_ - cxw) < 0.2 * fw].max()
    OW, OH = int(round(FW * px)), int(round(FH * px))
    # Anchored on the eyes, with the chin-to-eyes and centre-to-eyes offsets of the NORMAL face, so
    # the head does not jump when a mouth opens (an open mouth drops the chin).
    eye = fwd(mid)
    if expr == 'normal' or not os.path.exists(anc):
        json.dump({'chin': float(chin - eye[1]), 'cx': float(cxw - eye[0]), 'fw': fw}, open(anc, 'w'))
    A = json.load(open(anc))
    ox = (BX + BW / 2 + st.get('dx', 0)) * px - (eye[0] + A['cx']) * sx
    oy = (BY + BH - ol_u * 0.55 + st.get('dy', 0)) * px - (eye[1] + A['chin']) * sy
    M = np.float32([[1, 0, ox], [0, 1, oy]])
    out = cv2.warpAffine(small, M, (OW, OH), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = out[..., 3:4] / 255
    rgb = np.where(a > 1e-3, out[..., :3] / np.maximum(a, 1e-3), 0)
    if st.get('sharpen'):
        # crisp features at the size the phone shows them (unsharp mask, inside the head only)
        solid = cv2.erode((out[..., 3] > 250).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)[..., None]
        bl = cv2.GaussianBlur(rgb, (0, 0), st.get('sharpenR', 1.0))
        rgb = rgb + (rgb - bl) * st['sharpen'] * solid
    res = np.dstack([np.clip(rgb, 0, 255), out[..., 3]]).astype(np.uint8)
    ay, ax = np.nonzero(res[..., 3] > 16)
    info = {'nose': [round(float((nose[0] * sx + ox) / OW), 4), round(float((nose[1] * sy + oy) / OH), 4)],
            # the drawn head (keyline included) in frame units: portraits fit this box
            'bbox': [round(float(ax.min() / px), 1), round(float(ay.min() / px), 1),
                     round(float((ax.max() + 1) / px), 1), round(float((ay.max() + 1) / px), 1)]}
    if ay.min() < 1 or ax.min() < 1 or ax.max() > OW - 2 or ay.max() > OH - 2:
        log(f'WARNING {expr}: the head touches the frame edge {info["bbox"]} — lower faceU/chibi*')
    json.dump(info, open(os.path.join(ed, 'placed.json'), 'w'))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir'); ap.add_argument('--from', dest='frm', default='card')
    ap.add_argument('--to', default='compose'); ap.add_argument('--only', default='')
    ap.add_argument('--work', default=os.path.join(ROOT, '.charwork'))
    ap.add_argument('--px', type=float, default=3.0, help='output pixels per head-box unit')
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, 'real.json')))[a.dir]
    wd = os.path.join(a.work, a.dir); os.makedirs(wd, exist_ok=True)
    run = lambda s: STAGES.index(a.frm) <= STAGES.index(s) <= STAGES.index(a.to)
    exprs = [e for e in cfg['expressions'] if not a.only or e in a.only.split(',')]
    card_png = os.path.join(wd, 'card.png')
    if run('card') and not os.path.exists(card_png):
        raw = urllib.request.urlopen(cfg['card']).read()
        im = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        cv2.imwrite(card_png, im); log('card', im.shape)
    if run('vision'):
        vision(card_png, os.path.join(wd, 'card-vision')); log('vision ok')
    if run('restore'):
        face = json.load(open(os.path.join(wd, 'card-vision', 'face.json')))
        restore(cv2.imread(card_png), face, cfg.get('restore', {}), wd); log('restore ok')
    if run('grade'):
        cv2.imwrite(os.path.join(wd, 'graded.png'), grade(cv2.imread(os.path.join(wd, 'restored.png')), cfg.get('grade')))
        log('grade ok')
    if run('pose'):
        pj = os.path.join(wd, 'presets.json')
        json.dump({e: cfg['expressions'][e] for e in exprs}, open(pj, 'w'))
        subprocess.run([sys.executable, os.path.join(HERE, 'expressions.py'), os.path.join(wd, 'graded.png'),
                        os.path.join(wd, 'posed'), pj], check=True)
        log('pose ok')
    if run('refine'):
        for e in exprs:
            im = cv2.imread(os.path.join(wd, 'posed', e + '.png'))
            w = cfg.get('refine', {}).get('gfpgan', 0.5)
            out = gfpgan(im, w) if w > 0 else im
            ed = os.path.join(wd, 'refined', e); os.makedirs(ed, exist_ok=True)
            cv2.imwrite(os.path.join(ed, 'img.png'), out)
            vision(os.path.join(ed, 'img.png'), ed)
            log('refine', e)
    if run('compose'):
        od = os.path.join(ROOT, 'public', 'img', 'chars', a.dir); os.makedirs(od, exist_ok=True)
        for e in exprs:
            ed = os.path.join(wd, 'refined', e)
            face = json.load(open(os.path.join(ed, 'face.json')))
            rgba = compose(cv2.imread(os.path.join(ed, 'img.png')), cv2.imread(os.path.join(ed, 'lift.png'), 0),
                           cv2.imread(os.path.join(ed, 'person.png'), 0), face, cfg, e, a.px, ed)
            png = os.path.join(ed, 'final.png'); cv2.imwrite(png, rgba)
            webp = os.path.join(od, e + '.webp')
            subprocess.run(['cwebp', '-quiet', '-q', str(cfg.get('webpQ', 82)), '-alpha_q', '90', '-m', '6',
                            '-sharp_yuv', png, '-o', webp], check=True)
            log('compose', e, os.path.getsize(webp), 'bytes')
        # what public/characters.js needs: the nose (for the bruise) and the union box (for portraits)
        P = [json.load(open(os.path.join(wd, 'refined', e, 'placed.json'))) for e in cfg['expressions']]
        n = P[0]['nose']
        bb = [min(p['bbox'][0] for p in P), min(p['bbox'][1] for p in P), max(p['bbox'][2] for p in P), max(p['bbox'][3] for p in P)]
        tot = sum(os.path.getsize(os.path.join(od, e + '.webp')) for e in cfg['expressions'])
        log(f"registry: nose: [{n[0]:.3f}, {n[1]:.3f}], fit: [{', '.join(f'{v:g}' for v in bb)}]   ({tot} bytes total)")


if __name__ == '__main__':
    main()
