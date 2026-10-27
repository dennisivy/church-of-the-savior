import previous from './site-sb-whole.js';
import {entranceMaterials} from './sb/entrance-materials.js';
import {apseRustication} from './sb/apse-rustication.js';
import {refineBasePanels} from './sb/base-panels.js';
import {rusticatedBase} from './sb/rusticated-base.js';
const M=await entranceMaterials();let detail,panels,apse,rig,enabled=new URLSearchParams(location.search).get('base')!=='before';
function apply(){if(!detail)return;if(enabled){detail.apply();panels.apply();apse.apply();}else{apse.restore();panels.restore();detail.restore();}if(rig)rig.renderer.shadowMap.needsUpdate=true;document.getElementById('comparison-state').textContent=enabled?'AFTER · jointed rough-faced stone base':'BEFORE · smooth lower wall';document.querySelectorAll('[data-base]').forEach(b=>b.classList.toggle('selected',(b.dataset.base==='after')===enabled));}
const presets={apsebase:['Curved lower stonework',[39,3.7,24],[23,2.8,6]],base:['Lower stonework',[-14.6,2.6,24],[-14.4,2.6,15.3]],context:['Entrance and base',[-27,3.2,37],[-14,4,17]],...previous.presets};const view=new URLSearchParams(location.search).get('view');
export default {...previous,title:'Church · lower stonework reference study',presets:presets[view]?{[view]:presets[view],...presets}:presets,build(mats,level){const root=previous.build(mats,level);if(level==='high'){detail=rusticatedBase(root,M);panels=refineBasePanels(root,M);mats.basePanel=panels.material;apse=apseRustication(root,M);mats.apseBlocks=apse.material;mats.rusticatedBase=detail.material;mats.baseDressed=detail.dressedMaterial;apply();console.info('Rusticated base',JSON.stringify(detail.group.userData));}return root;},configure(r){previous.configure(r);rig=r;apply();}};
for(const b of document.querySelectorAll('[data-base]'))b.addEventListener('click',()=>{enabled=b.dataset.base==='after';apply();});
