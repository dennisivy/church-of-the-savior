"""Add only the visible north central icon; preserve the eleven shield entries.
Usage: python3 assets/spilled-blood/heraldry/prepare_icons.py /path/to/porch-pair.jpg
Coordinates digitized in a 600x887 preview of original crop [5180,570,6080,1900].
"""
from pathlib import Path
import json,sys,hashlib,math
from PIL import Image
import numpy as np
import cv2
out=Path(__file__).resolve().parent;src=Path(sys.argv[1]);im=np.array(Image.open(src).convert('RGB'))
assert im.shape[:2]==(4912,7360)
m=json.loads((out/'mapping.json').read_text())
assert hashlib.sha256(src.read_bytes()).hexdigest()==m['source']['sha256']
scale=np.array([900/600,1330/887]);origin=np.array([5180,570])
def pts(points):return np.array(points,np.float32)*scale+origin
# Full estimated artwork rectangle, including its hidden lower-left corner.
quad=pts([[24,181],[563,15],[586,696],[33,815]])
# Conservative visibility mask: exclude the entire obscured lower ground strip.
# All three human figures remain inside; hidden floor/roof/railing is transparent.
visible=pts([[27,183],[560,19],[580,625],[32,727]])
mask=np.zeros(im.shape[:2],np.uint8);cv2.fillPoly(mask,[np.rint(visible).astype(np.int32)],255)
wire=pts([[231,115],[253,727]])
cv2.line(mask,tuple(np.rint(wire[0]).astype(int)),tuple(np.rint(wire[1]).astype(int)),0,7)
W,H=512,748
hom=cv2.getPerspectiveTransform(quad.astype(np.float32),np.float32([[0,0],[W-1,0],[W-1,H-1],[0,H-1]]))
rgb=cv2.warpPerspective(im,hom,(W,H),flags=cv2.INTER_LINEAR)
alpha=cv2.warpPerspective(mask,hom,(W,H),flags=cv2.INTER_LINEAR)
rgba=np.dstack([rgb,alpha]);rgba[alpha==0,:3]=128
name='north-central-icon';file=name+'.png';Image.fromarray(rgba).save(out/file)
credit=dict(m['source']);credit['modifications']='Central north icon cropped and approximately perspective-rectified to the builder inset aspect. Conservative transparent mask excludes occluded lower ground/roof/railing and a thin wire. No reconstruction, inpainting, cloned artwork or generated figures.'
r=dict(id=name,file=file,description='North bell-tower central icon: enthroned Christ flanked by two standing figures; all are real photographed mosaic.',face='north',source_quad_TL_TR_BR_BL=quad.tolist(),source_visible_polygon=visible.tolist(),source_wire_mask_segment=wire.tolist(),source_wire_mask_width_px=7,source_to_output_homography=hom.tolist(),output_size=[W,H],position_local=[0,16.25,-5.858],rotation_y_radians=math.pi,width_m=2.66,height_m=3.90,alpha_test=.35,credit=credit,placement_basis='Builder north central frame(a=pi/2,r=5.94,u=0,z=16.25,w=2.70,h=3.94); bed outer radius=5.85; plane 8mm outward, dimensions inset 2cm each side. Photo plane rectification approximate; target aspect follows builder, not a metric camera solve.',occlusion='Lower background strip and wire are transparent. Parent stone bed remains visible there; do not fill or clone.',sha256=hashlib.sha256((out/file).read_bytes()).hexdigest())
m['panels']=[p for p in m['panels'] if p['id']!=name]+[r]
m['scope']='Photo-supported north shields and individually sourced icon panels; see each panel placement and credit'
(out/'mapping.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(name,W,H,'local [0,16.25,-5.858], size 2.66x3.90 m')
