"""Concept sketches only (docs/CHARACTERS.md, "How they were designed"): SDXL (DreamShaper XL
Turbo) on MPS with IP-Adapter Plus taking an HS select portrait as the STYLE reference and a
text description of the card person. Its output is never shipped: it was used to explore each
character's hair and face design before painting the rig (hs_chars.py). The HS reference image
is a local crop of the recording, never committed.

  python tools/chars/concept-sdxl.py <1|2> [ip_scale] [count]   (STYLE_REF, OUT env vars)
"""
import sys, torch
from diffusers import AutoPipelineForText2Image, DPMSolverMultistepScheduler
from transformers import CLIPVisionModelWithProjection
from PIL import Image
import os
OUT = os.environ.get('OUT', '.charwork/concepts/')
os.makedirs(OUT, exist_ok=True)
enc = CLIPVisionModelWithProjection.from_pretrained('h94/IP-Adapter', subfolder='models/image_encoder', torch_dtype=torch.float16)
pipe = AutoPipelineForText2Image.from_pretrained('Lykon/dreamshaper-xl-v2-turbo', torch_dtype=torch.float16, variant='fp16', image_encoder=enc).to('mps')
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
pipe.load_ip_adapter('h94/IP-Adapter', subfolder='sdxl_models', weight_name='ip-adapter-plus_sdxl_vit-h.safetensors')
pipe.set_ip_adapter_scale(float(sys.argv[2]) if len(sys.argv) > 2 else 0.55)
style = Image.open(os.environ['STYLE_REF']).convert('RGB')   # an HS select-portrait crop
who = sys.argv[1]
P = {
 '1': 'young man with dark brown swept-up quiff hair, thick dark eyebrows, tan skin, determined frown',
 '2': 'young woman with long wavy blonde hair, dark blonde roots, arched eyebrows, pink lips, determined look',
}[who]
prompt = f'2d mobile game character portrait, chibi big round head only, wide jowly cheeks, {P}, big white eyes with black pupils, thick bold dark outline, cel shading, flat colors, vector art, head soccer game style, plain white background'
neg = 'photo, realistic, 3d render, body, shoulders, neck, text, frame, blurry, gradient background'
for i in range(int(sys.argv[3]) if len(sys.argv) > 3 else 4):
    g = torch.Generator('cpu').manual_seed(100 + i)
    im = pipe(prompt, negative_prompt=neg, ip_adapter_image=style, num_inference_steps=8, guidance_scale=2.0, width=1024, height=1024, generator=g).images[0]
    im.save(f'{OUT}gen-{who}-{i}.png')
    print('saved', i, flush=True)
