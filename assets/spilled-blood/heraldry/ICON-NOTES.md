# North central icon addition

Added mapping ID **`north-central-icon`**, output `north-central-icon.png`, **512×748 RGBA**. `createHeraldry()` loads it automatically alongside the 11 existing shields. Its per-panel credit overrides the common shield modification description, and the material uses alphaTest=0.35. No geometry/site/bell-builder/artwork files were changed.

## Placement

Bell-local Three.js centre **[0,16.25,−5.858]**, size **2.66×3.90 m**, rotation Y=π, normal north (−Z). Translate the returned group only by bell.u, as before. Image-left is east/local +X. It matches the builder's north central `frame(a=π/2,r=5.94,u=0,z=16.25,w=2.70,h=3.94)`. Bed surface r=5.85; image plane is 8 mm outward and 2 cm inside each frame edge. Do not place this image on the south or west faces.

The artwork is an approximate projective rectification into the builder's inset aspect, not a new metric camera solve. All three visible figures are retained. A conservative lower strip containing the obscuring porch roof/railing/finials and a thin wire are transparent. The parent bed will remain visible through these gaps; no missing ground, inscriptions or figures were reconstructed. Source-space visibility polygon, wire-mask segment, homography and output hash are recorded in mapping.json.

## Credit and source

**Александр Байдуков (Aleksandr BAYDUKOV)**, *Northern and North-Western tympana of the porches.jpg*, own work, 10 October 2020. [Actual Commons page](https://commons.wikimedia.org/wiki/File:Northern_and_North-Western_tympana_of_the_porches.jpg), **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. This modified crop is distributed under CC BY-SA 4.0. Source author and license were verified on the actual Commons page using the built-in browser during this research session. Source is the same verified full 7360×4912 original as the shield set, SHA-256 `75bab4b3ac6123e695c41b1aafac5927a448f97dac9f9d5a5ee446e6596d6b07`.

Credit: “North icon photograph by Александр Байдуков (Aleksandr BAYDUKOV), Wikimedia Commons, CC BY-SA 4.0. Cropped, perspective-rectified and reduced; obscured lower ground and wire masked transparent. No reconstructed imagery.” Link source and license; no endorsement implied.

Native artwork spans roughly 800 pixels horizontally and 1000 vertically; the output reduces real source detail. Photographic lighting and existing colours remain.

## West shrine — verification resolved and panel added

The earlier license blocker is resolved: exact-title web search returned the actual Commons file page with author **Александр Байдуков**, own work, taken **10 October 2020, 15:54:41**, and **CC BY-SA 4.0**. [Source page](https://commons.wikimedia.org/wiki/File:Western_facade_of_the_bell_tower_Of_the_Cathedral_of_the_Resurrection.jpg). The parent independently verified the same page. Original size 7047×4698; supplied `bell-west.jpg` is its 3840×2560 thumbnail. Source and output hashes, original pixel scale and all crop vertices are in the panel's mapping entry.

Added **`west-shrine-icon`**, `west-shrine-icon.png`, **516×680 RGBA** (512×676 artwork rectangle plus padding), from roughly 1356×1789 actual source pixels. This is the lower west shrine **Crucifixion**, not the upper lunette. Outer canopy, masonry and pedestal surround are masked transparent. The composition's internal crucifix border, small inset-icon borders and photographed figure are retained; relief depicted in the photo is flat in the delivered texture. No generated detail or repeated substitute imagery.

**Local position [−6.148,3.55,0], rotation Y=−π/2, size 3.01×3.9667 m.** Normal faces west (−X); image-left is north/local −Z. The builder's matching lower shrine frame is `frame(pi,6.23,0,3.55,3.05,5.40,.18)`. Its backing surface is r=6.14 and this plane is 8 mm outward. Width fits the bed with 2 cm nominal clearance each side; height preserves the photograph's aspect instead of stretching the figures into the taller 5.40 m placeholder. Consequently some backing remains above/below and through the masked silhouette. This is a photo-supported inset, not an independently surveyed full-scale shrine reconstruction.

Source and modified crop are **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. Credit: “West shrine photograph by Александр Байдуков (Aleksandr BAYDUKOV), Wikimedia Commons, CC BY-SA 4.0. Cropped, masked and downsampled; outer architecture and pedestal excluded. No reconstructed imagery.” Include source and license links; no endorsement implied.

Rebuild only this panel with:

```sh
python3 assets/spilled-blood/heraldry/prepare_west_shrine.py /path/to/bell-west.jpg
```

`createHeraldry()` already supports per-panel credits and alpha masks and now loads **13 panels** from the mapping without parent code changes. Other faces/lunette remain unsupported. No parent/site/bell-builder/artwork files were changed.

## Reproduction / validation

```sh
python3 assets/spilled-blood/heraldry/prepare_icons.py /private/tmp/sb-artwork-hires/porch-pair.jpg
```

The script preserves the 11 shield entries. The shield rebuild script now preserves separately added icon entries as well. Output inspected visually; 13 unique mapping IDs, all referenced files/hashes, RGBA alpha and source hash checked. Module syntax checked. Parent's rendered integration was not inspected in this pass.
