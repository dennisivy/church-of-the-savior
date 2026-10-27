#!/usr/bin/env python3
"""Reproduce the photographed mosaic crop; requires Pillow, numpy, opencv-python.
Run from any directory: python3 /path/to/rectify.py. No network or AI processing.
"""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source.jpg'
W, H = 368, 338
# Approximate planar bounding quadrilateral, inferred from the visible jambs.
# Dimensions retain average photographed edge lengths; not metric calibration.
QUAD = np.float32([[794, 1577], [1152, 1573], [1165, 1910], [787, 1914]])
DEST = np.float32([[0, 0], [W-1, 0], [W-1, H-1], [0, H-1]])
M = cv2.getPerspectiveTransform(QUAD, DEST)
# Actual inner mosaic outline: pointed top, short upright sides, concave arch
# at foot. Coordinates picked on original 1920x2560 photo, not invented fill.
OUTLINE = [[971,1577], [1161,1808], [1165,1910],
           [1117,1887], [1069,1871], [1020,1861], [971,1858],
           [923,1864], [876,1877], [830,1894], [787,1914], [789,1812]]
image = np.array(Image.open(SOURCE).convert('RGB'))
warped = cv2.warpPerspective(image, M, (W,H), flags=cv2.INTER_CUBIC)
# Global exposure adjustment only; preserves photographed forms and colours.
warped = np.clip(warped.astype(np.float32) * 2.0, 0, 255).astype(np.uint8)
outline = cv2.perspectiveTransform(np.float32([OUTLINE]), M)[0]
mask = Image.new('L', (W*4,H*4), 0)
ImageDraw.Draw(mask).polygon([(round(x*4),round(y*4)) for x,y in outline], fill=255)
mask = mask.resize((W,H), Image.Resampling.LANCZOS)
result = Image.fromarray(warped).convert('RGBA')
result.putalpha(mask)
result.save(ROOT / 'south-west-porch.png')
commons = json.loads((ROOT/'commons-metadata.json').read_text())
page = next(iter(commons['query']['pages'].values()))
ext = page['imageinfo'][0]['extmetadata']
assert 'Gzen92' in ext['Artist']['value']
assert ext['LicenseShortName']['value'] == 'CC BY-SA 4.0'
source_url = 'https://commons.wikimedia.org/wiki/File:Cath%C3%A9drale_Saint-Sauveur-sur-le-Sang-Vers%C3%A9_-_entr%C3%A9e_(4).jpg'
modifications = 'Photographic crop; mild four-point perspective rectification; bicubic resampling to 368 x 338; global RGB brightness multiplied by 2.0; antialiased transparent mask following the pointed top, upright sides and concave lower arch. No AI generation, inpainting, scene replacement, sharpening or invented detail.'
note = 'Descent from the Cross (after Viktor Vasnetsov), west-facing tympanum of the SOUTH porch block. Identification agrees with saved elements-porches-apses-roofs.md and visible scene in entree (4). The full surviving photographed scene is retained. Output aspect is photo-derived after mild rectification, not a surveyed physical ratio; single-view lens/perspective uncertainty remains. Low-light, limited-resolution source; do not claim restoration-level accuracy. Parent supplies placement and integration.'
metadata = {
 'id':'south-west-porch', 'output':'south-west-porch.png', 'output_size':[W,H],
 'aspect':W/H, 'aspect_basis':'Mean photographed bounding-edge lengths, rounded to native-scale output; physical aspect uncalibrated',
 'scene':'Descent from the Cross',
 'credit':{'author':'Gzen92','file':page['title'].removeprefix('File:'),'source_url':source_url,
           'license':ext['LicenseShortName']['value'],'license_url':ext['LicenseUrl']['value']},
 'modifications':modifications, 'note':note,
 'source_image':'source.jpg','source_size':[1920,2560],
 'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'metadata_evidence':'commons-metadata.json', 'script':'rectify.py',
 'source_quad_pixels':QUAD.tolist(), 'source_mask_polygon_pixels':OUTLINE,
 'homography_source_to_output':M.tolist(),
 'placement_hint':{'x':-24.365,'y':7.7,'z':16.25,'face':'west'},
 'alpha':True,'derivative_license':'CC BY-SA 4.0'
}
(ROOT/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
(ROOT/'credits.md').write_text(f'''# South-west porch — Descent from the Cross

Photograph: **Gzen92**, *{metadata['credit']['file']}*, 17 February 2017.
[Original file on Wikimedia Commons]({source_url}).
[Author](https://commons.wikimedia.org/wiki/User:Gzen92).

Licensed **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
This modified crop is distributed under the same license. Attribute Gzen92,
link the source and license, and indicate the modifications when reusing it.
Verified Commons API author/license evidence is retained in `commons-metadata.json`.

## Modifications

{modifications}

## Identification and limitations

{note}

Output: **{W} × {H} RGBA PNG**, aspect **{W/H:.6f}:1**.
Transparent areas are outside the actual mosaic; the lower edge follows the
arch and is not a straight triangular cutout. `source.jpg` is the saved
1920 × 2560 research copy, not the full-resolution Commons original.

Reproduce with `python3 rectify.py` (Pillow, NumPy and OpenCV required).
No network access is needed. Metadata includes the exact source hash,
landmarks, homography and intended placement supplied by the parent.
''')
print(json.dumps({'output':str(ROOT/'south-west-porch.png'),'size':[W,H],'aspect':W/H,'alpha_extrema':mask.getextrema()}))
