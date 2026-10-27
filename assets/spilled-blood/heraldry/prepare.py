"""Rebuild individual north-face heraldic tiles from the verified Commons original.
Usage: python3 assets/spilled-blood/heraldry/prepare.py /path/to/porch-pair.jpg
No downloads, inference of missing emblems, or generation. Requires cv2/numpy/Pillow.
"""
from pathlib import Path
import sys,json,hashlib,math
import numpy as np
import cv2
from PIL import Image
out=Path(__file__).resolve().parent
src=Path(sys.argv[1]);im=np.array(Image.open(src).convert('RGB'))
assert im.shape[:2]==(4912,7360),'Use the full Commons original, not a thumbnail'
# Quad coordinates digitized in a 920x1100 view of source crop [4500,0,7360,3300].
# Each polygon lies inside its individual heraldic mosaic tile, excluding masonry.
specs=[
 (4,8,'blue-black field with white tree',[[616,149],[655,133],[660,187],[617,202]]),
 (4,9,'eagle above red and white lower field',[[710,119],[748,104],[752,155],[713,171]]),
 (3,7,'white cross on red',[[535,279],[574,265],[578,310],[538,324]]),
 (3,8,'mountain and diagonal blue band',[[616,245],[655,231],[660,293],[618,307]]),
 (3,9,'red bow on pale field',[[708,216],[750,200],[754,262],[711,277]]),
 (2,8,'quartered red and blue animals',[[620,348],[660,333],[664,393],[623,409]]),
 (2,9,'diagonal dark band on pale field',[[711,322],[754,307],[757,366],[714,380]]),
 (1,8,'vertical blue band between dark figures',[[626,452],[666,438],[669,496],[629,510]]),
 (1,9,'gold crescent below pale chief',[[716,422],[757,407],[760,470],[718,484]]),
 (0,8,'dark horse on pale gold',[[630,552],[671,539],[673,595],[632,609]]),
 (0,9,'blue animal on pale field',[[721,529],[761,517],[765,567],[723,580]])]
credit=dict(author='Александр Байдуков (Aleksandr BAYDUKOV)',title='Northern and North-Western tympana of the porches.jpg',source_url='https://commons.wikimedia.org/wiki/File:Northern_and_North-Western_tympana_of_the_porches.jpg',license='CC BY-SA 4.0',license_url='https://creativecommons.org/licenses/by-sa/4.0/',modifications='Individual heraldic mosaic tiles cropped, perspective-rectified and reduced to 96x136 pixels. No repainting, enhancement, inpainting or repeated substitutes.')
records=[]
for row,col,description,quad in specs:
 q=np.array(quad,np.float32)*[2860/920,3]+[4500,0];W,H=96,136
 dest=np.float32([[0,0],[W-1,0],[W-1,H-1],[0,H-1]])
 hom=cv2.getPerspectiveTransform(q.astype(np.float32),dest)
 tile=cv2.warpPerspective(im,hom,(W,H),flags=cv2.INTER_LINEAR)
 ident=f'north-r{row}-c{col}';filename=ident+'.png';Image.fromarray(tile).save(out/filename)
 u=(col-4.5)*.72;h=13.65+row*1.04
 records.append(dict(id=ident,file=filename,description=description,face='north',builder_angle_radians=math.pi/2,builder_row=row,builder_column=col,source_quad_TL_TR_BR_BL=q.tolist(),source_to_output_homography=hom.tolist(),output_size=[W,H],position_local=[-u,h,-5.828],rotation_y_radians=math.pi,width_m=.47,height_m=.67,placement_basis='North main grid; row 0 bottom, row 5 top; column 0 photo-left/east, column 9 photo-right/west. Builder tangent u=(col-4.5)*.72; h=13.65+row*1.04. Artwork face 8mm outward of bed surface r=5.82.',sha256=hashlib.sha256((out/filename).read_bytes()).hexdigest()))
manifest=dict(version=1,source=dict(**credit,local_file=str(src.resolve()),size=[7360,4912],sha256=hashlib.sha256(src.read_bytes()).hexdigest(),verified='Actual Commons Summary and Licensing inspected in built-in browser during this research session'),coordinates='Bell-local glTF Y-up; west=-X, north=-Z; parent translates group.x by bell.u; no additional rotation or scale',scope='11 distinct, visible north-face heraldic tiles only; no geographic arms identifications asserted',panels=records)
# Preserve separately sourced icon entries when rebuilding the original shields.
if (out/'mapping.json').exists():
 previous=json.loads((out/'mapping.json').read_text())
 manifest['panels'] += [p for p in previous['panels'] if p.get('builder_row') is None]
 if len(manifest['panels'])>len(records): manifest['scope']='11 north-face shields plus separately sourced icon panels'
(out/'mapping.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Readable crop-only visual audit, never used as a facade material.
sheet=Image.new('RGB',(6*112,2*162),(210,210,210))
from PIL import ImageDraw
draw=ImageDraw.Draw(sheet)
for i,r in enumerate(records):
 x=i%6*112;y=i//6*162;sheet.paste(Image.open(out/r['file']),(x+8,y+18));draw.text((x+5,y+2),r['id'],fill=(0,0,0))
sheet.save(out/'crop-review.jpg')
print('Extracted',len(records),'unique tiles at 96x136; mapping written')
