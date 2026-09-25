"""Step 3 of the real-character pipeline: re-pose the REAL face into each game expression.

    python tools/chars/expressions.py <in.png> <out-dir> <presets.json>

Uses LivePortrait (KwaiVGI, MIT; https://github.com/KwaiVGI/LivePortrait) image retargeting, the same
maths as its Gradio "retargeting image" panel, run headless: the face's implicit keypoints are nudged
(smile, brows, lips, eye/lip openness, head yaw/pitch/roll) and the photo is re-rendered from its
own appearance features, so it stays the same person with the same skin, eyes and hair.
Set LIVEPORTRAIT_DIR to a checkout with pretrained_weights/ downloaded (see docs/CHARACTERS.md).

presets.json: { "<name>": { "eye": 0.35, "lip": 0.0, "smile": 0.8, "eyebrow": -8, "yaw": 12, ... }, ... }
Keys (all optional; 0/absent = unchanged): eye / lip (target open ratios, eyes ~0.35 open, 0 shut;
lip 0 closed ... 0.8 wide), smile, wink, eyebrow (+ raise / - knit), lip0..lip3 (Gradio lip sliders),
eye_x / eye_y (gaze), pitch / yaw / roll (degrees), scale (crop scale, default 2.3).
Writes <out-dir>/<name>.png at the input's size (the re-rendered face pasted back with LivePortrait's
soft mask) and <out-dir>/<name>.face.png (the 512 px face render).
"""
import json, os, sys
import numpy as np, cv2, torch

ARGS = [os.path.abspath(a) for a in sys.argv[1:4]]
LP = os.environ.get('LIVEPORTRAIT_DIR')
if not LP: sys.exit('set LIVEPORTRAIT_DIR')
sys.path.insert(0, LP); os.chdir(LP)
from src.config.argument_config import ArgumentConfig
from src.config.inference_config import InferenceConfig
from src.config.crop_config import CropConfig
from src.live_portrait_pipeline import LivePortraitPipeline
from src.utils.crop import prepare_paste_back, paste_back
from src.utils.camera import get_rotation_matrix


# The Gradio pipeline's keypoint edits, verbatim in effect (src/gradio_pipeline.py).
def eyeball(dx, dy, d):
    if dx > 0: d[0, 11, 0] += dx * 0.0007; d[0, 15, 0] += dx * 0.001
    else: d[0, 11, 0] += dx * 0.001; d[0, 15, 0] += dx * 0.0007
    d[0, 11, 1] += dy * -0.001; d[0, 15, 1] += dy * -0.001
    b = -dy / 2.
    d[0, 11, 1] += b * -0.001; d[0, 13, 1] += b * 0.0003; d[0, 15, 1] += b * -0.001; d[0, 16, 1] += b * 0.0003
    return d

def smile(s, d):
    d[0, 20, 1] += s * -0.01; d[0, 14, 1] += s * -0.02; d[0, 17, 1] += s * 0.0065; d[0, 17, 2] += s * 0.003
    d[0, 13, 1] += s * -0.00275; d[0, 16, 1] += s * -0.00275; d[0, 3, 1] += s * -0.0035; d[0, 7, 1] += s * -0.0035
    return d

def wink(w, d):
    d[0, 11, 1] += w * 0.001; d[0, 13, 1] += w * -0.0003; d[0, 17, 0] += w * 0.0003
    d[0, 17, 1] += w * 0.0003; d[0, 3, 1] += w * -0.0003
    return d

def eyebrow(e, d):
    if e > 0: d[0, 1, 1] += e * 0.001; d[0, 2, 1] += e * -0.001
    else:
        d[0, 1, 0] += e * -0.001; d[0, 2, 0] += e * 0.001; d[0, 1, 1] += e * 0.0003; d[0, 2, 1] += e * -0.0003
    return d

def lip0(v, d): d[0, 19, 0] += v; return d
def lip1(v, d):
    d[0, 14, 1] += v * 0.001; d[0, 3, 1] += v * -0.0005; d[0, 7, 1] += v * -0.0005; d[0, 17, 2] += v * -0.0005
    return d
def lip2(v, d):
    d[0, 20, 2] += v * -0.001; d[0, 20, 1] += v * -0.001; d[0, 14, 1] += v * -0.001
    return d
def lip3(v, d):
    d[0, 19, 1] += v * 0.001; d[0, 19, 2] += v * 0.0001; d[0, 17, 1] += v * -0.0001
    return d


EXP_IDX = [1, 2, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]      # LivePortrait's "exp" region
REGIONS = {'lip': [6, 12, 14, 17, 19, 20], 'eyes': [11, 13, 15, 16, 18], 'brows': [1, 2]}
_drv = {}
def drive_exp(pipe, spec):
    """'d30.jpg' -> exp of that driving image; 'laugh.pkl#30' -> frame 30 of that motion template."""
    if spec in _drv: return _drv[spec]
    base = os.path.join(LP, 'assets', 'examples', 'driving')
    if '.pkl' in spec:
        import pickle
        f, _, fr = spec.partition('#')
        m = pickle.load(open(os.path.join(base, f), 'rb'))['motion']
        e = torch.tensor(m[int(fr or 0)]['exp'], dtype=torch.float32)
    else:
        path = spec if os.path.isabs(spec) else os.path.join(base, spec)
        im = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
        W = pipe.live_portrait_wrapper
        ci = pipe.cropper.crop_source_image(im, pipe.cropper.crop_cfg)
        e = W.get_kp_info(W.prepare_source(ci['img_crop_256x256']))['exp'].float().cpu()
    _drv[spec] = e
    return e


def main():
    src, out_dir, presets = ARGS[0], ARGS[1], json.load(open(ARGS[2]))
    os.makedirs(out_dir, exist_ok=True)
    inf, crop = InferenceConfig(), CropConfig()
    inf.flag_force_cpu = False
    pipe = LivePortraitPipeline(inference_cfg=inf, crop_cfg=crop)
    W = pipe.live_portrait_wrapper
    dev = W.device
    img = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB)
    cache = {}
    for name, p in presets.items():
        sc = float(p.get('scale', 2.3))
        if sc not in cache:
            crop.scale = sc
            pipe.cropper.update_config({'scale': sc})
            ci = pipe.cropper.crop_source_image(img, pipe.cropper.crop_cfg)
            I_s = W.prepare_source(ci['img_crop_256x256'])
            info = W.get_kp_info(I_s)
            cache[sc] = dict(ci=ci, info=info, f=W.extract_feature_3d(I_s), x=W.transform_keypoint(info),
                             mask=prepare_paste_back(inf.mask_crop, ci['M_c2o'], dsize=(img.shape[1], img.shape[0])))
        c = cache[sc]; info = c['info']
        with torch.no_grad():
            R_s = get_rotation_matrix(info['pitch'], info['yaw'], info['roll'])
            R_d = get_rotation_matrix(info['pitch'] + p.get('pitch', 0), info['yaw'] + p.get('yaw', 0), info['roll'] + p.get('roll', 0))
            d = info['exp'].clone().to(dev)
            if p.get('drive'):
                # borrow the expression of a driving face (a LivePortrait example image or one frame
                # of a motion template), blended by 'amount' over the expression keypoints only —
                # identity, pose and hair stay the card's
                e = drive_exp(pipe, p['drive']).to(dev)
                k = float(p.get('amount', 1.0))
                sel = torch.zeros_like(d)
                for i in (EXP_IDX if p.get('region', 'all') == 'all' else REGIONS[p['region']]): sel[:, i, :] = 1
                if p.get('region', 'all') == 'all':
                    sel[:, 3:5, 1] = 1; sel[:, 5, 2] = 1; sel[:, 8, 2] = 1; sel[:, 9, 1:] = 1
                d = d + (e - d) * sel * k
            T = lambda v: torch.tensor(float(v)).to(dev)
            if p.get('eye_x') or p.get('eye_y'): d = eyeball(T(p.get('eye_x', 0)), T(p.get('eye_y', 0)), d)
            for k, fn in (('smile', smile), ('wink', wink), ('eyebrow', eyebrow), ('lip0', lip0), ('lip1', lip1), ('lip2', lip2), ('lip3', lip3)):
                if p.get(k): d = fn(T(p[k]), d)
            x_d = info['scale'].to(dev) * (info['kp'].to(dev) @ R_d.to(dev) + d) + info['t'].to(dev)
            x_s = c['x'].to(dev)
            if 'eye' in p:
                r = W.calc_combined_eye_ratio([[float(p['eye'])]], c['ci']['lmk_crop'])
                x_d = x_d + W.retarget_eye(x_s, r)
            if 'lip' in p:
                r = W.calc_combined_lip_ratio([[float(p['lip'])]], c['ci']['lmk_crop'])
                x_d = x_d + W.retarget_lip(x_s, r)
            x_d = W.stitching(x_s, x_d)
            out = W.parse_output(W.warp_decode(c['f'], x_s, x_d)['out'])[0]
        full = paste_back(out, c['ci']['M_c2o'], img, c['mask'])
        cv2.imwrite(os.path.join(out_dir, name + '.png'), cv2.cvtColor(full, cv2.COLOR_RGB2BGR))
        cv2.imwrite(os.path.join(out_dir, name + '.face.png'), cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
        print('wrote', name)


if __name__ == '__main__':
    main()
