import previous from './site-sb-base.js';
import {entranceMaterials} from './sb/entrance-materials.js';
import {porchConnections} from './sb/porch-connections.js';
const M=await entranceMaterials();let detail,rig,enabled=new URLSearchParams(location.search).get('entry')!=='before';
function apply(){if(!detail)return;enabled?detail.apply():detail.restore();if(rig)rig.renderer.shadowMap.needsUpdate=true;document.getElementById('comparison-state').textContent=enabled?'AFTER · connected porch architecture':'BEFORE · isolated porch treatment';document.querySelectorAll('[data-entry]').forEach(b=>b.classList.toggle('selected',(b.dataset.entry==='after')===enabled));}
const presets={connection:['Porch and surrounding architecture',[-34,9,39],[-20,7,15]],rearjoin:['Connection behind porch',[-37,12,9],[-20,6,10]],...previous.presets};const view=new URLSearchParams(location.search).get('view');
export default {...previous,title:'Church · connected entrance architecture',presets:presets[view]?{[view]:presets[view],...presets}:presets,build(mats,level){const root=previous.build(mats,level);if(level==='high'){detail=porchConnections(root,M);detail.materials.forEach(m=>mats['connection_'+m.uuid]=m);apply();}return root;},configure(r){previous.configure(r);rig=r;apply();}};
for(const b of document.querySelectorAll('[data-entry]'))b.addEventListener('click',()=>{enabled=b.dataset.entry==='after';apply();});
