"""Add one verified west shrine photo crop; preserve all other mapped panels.
Usage: python3 assets/spilled-blood/heraldry/prepare_west_shrine.py /path/to/bell-west.jpg
Requires Pillow, NumPy and OpenCV. No network or generative processing.
"""
from pathlib import Path
import sys,json,hashlib,math
from PIL import Image
import numpy as np
import cv2
out=Path(__file__).resolve().parent;src=Path(sys.argv[1]);im=np.array(Image.open(src).convert('RGB'));h,w=im.shape[:2]
assert (w,h)==(3840,2560),'Coordinates refer to the supplied Commons thumbnail'
# Digitized against the 1100x733 review image. Follow the INNER gold-artwork
# boundary, excluding outer carved canopy, brick, granite and pedestal.
preview_poly=[[344,690],[346,490],[351,442],[366,388],[388,337],[420,292],[458,253],[499,225],[538,213],[577,218],[617,236],[654,264],[685,303],[707,351],[723,405],[732,459],[727,691],[620,691],[620,646],[578,645],[568,692],[557,721],[531,725],[519,708],[519,665],[506,645],[456,646],[456,692]]
poly=np.rint(np.array(preview_poly)*[w/1100,h/733]).astype(np.int32)
mask=np.zeros((h,w),np.uint8);cv2.fillPoly(mask,[poly],255)
x0,y0=poly.min(axis=0);x1,y1=poly.max(axis=0)+1
W=512;H=round(W*(y1-y0)/(x1-x0));pad=2
rgb=cv2.resize(im[y0:y1,x0:x1],(W,H),interpolation=cv2.INTER_AREA)
a=cv2.resize(mask[y0:y1,x0:x1],(W,H),interpolation=cv2.INTER_AREA)
rgba=np.pad(np.dstack([rgb,a]),((pad,pad),(pad,pad),(0,0)));rgba[rgba[:,:,3]==0,:3]=128
ident='west-shrine-icon';filename=ident+'.png';Image.fromarray(rgba).save(out/filename)
source=dict(author='Александр Байдуков (Aleksandr BAYDUKOV)',title='Western facade of the bell tower Of the Cathedral of the Resurrection.jpg',source_url='https://commons.wikimedia.org/wiki/File:Western_facade_of_the_bell_tower_Of_the_Cathedral_of_the_Resurrection.jpg',license='CC BY-SA 4.0',license_url='https://creativecommons.org/licenses/by-sa/4.0/',date_taken='2020-10-10 15:54:41',source='Own work',verified='Actual Commons Summary and Licensing returned by exact-title web search; also independently verified by parent.',modifications='Cropped lower west shrine composition; outer architecture and pedestal masked transparent; area-downsampled with transparent padding. Internal crucifix and small inset-icon borders retained as part of the photographed composition. No invented or reconstructed imagery.',local_file=str(src.resolve()),size=[w,h],original_size=[7047,4698],sha256=hashlib.sha256(src.read_bytes()).hexdigest())
width=3.01;height=width*(H+4)/(W+4)
r=dict(id=ident,file=filename,description='Lower west shrine Crucifixion with gold mosaic surround and two small inset icons; photographed relief/trim remains flat in this texture.',face='west',source_crop_bbox_xyxy=[int(x0),int(y0),int(x1),int(y1)],source_visible_polygon=poly.tolist(),original_pixel_scale_xy=[7047/w,4698/h],source_to_output_affine=[[W/(x1-x0),0,pad-x0*W/(x1-x0)],[0,H/(y1-y0),pad-y0*H/(y1-y0)]],output_size=[W+4,H+4],target_inner_xyxy=[pad,pad,pad+W-1,pad+H-1],position_local=[-6.148,3.55,0],rotation_y_radians=-math.pi/2,width_m=width,height_m=height,alpha_test=.35,credit=source,placement_basis='Lower west shrine frame(a=pi,r=6.23,u=0,z=3.55,w=3.05,h=5.40); bed surface r=6.14, image 8mm outward. Width fits inside niche; height preserves photographic aspect, deliberately not stretched to full 5.40m height. Image-left is local -Z/north.',occlusion='Outer carved hood/brick/granite excluded; pedestal around lower figure masked. Transparent areas expose parent backing. No reconstruction beyond available photo.',sha256=hashlib.sha256((out/filename).read_bytes()).hexdigest())
m=json.loads((out/'mapping.json').read_text());m['panels']=[p for p in m['panels'] if p['id']!=ident]+[r];m['scope']='11 north shields, north central icon and verified lower west shrine icon'
(out/'mapping.json').write_text(json.dumps(m,ensure_ascii=False,indent=2,default=lambda x:x.item())+'\n')
print(ident,r['output_size'],r['position_local'],width,height)
