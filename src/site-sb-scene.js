import * as T from 'three';
import previous from './site-sb-connected.js';
import {createDome,createDomeMaterials} from './sb/domes-refined.js';
import {createChurchSetting} from './sb/church-setting.js';
const query=new URLSearchParams(location.search);
const solve=await fetch('spilled-blood/data/solve.json').then(r=>r.json());
let enabled=query.get('scene')!=='before',rig,setting,oldGround;
const pairs=[],materials=createDomeMaterials();
function apply(){
 for(const [old,next]of pairs){old.visible=!enabled;next.visible=enabled;}
 if(setting)setting.group.visible=enabled;if(oldGround)oldGround.visible=!enabled;
 if(rig)rig.renderer.shadowMap.needsUpdate=true;
 const label=document.getElementById('comparison-state');if(label)label.textContent=enabled?'AFTER · dome construction and canal setting':'BEFORE · previous domes and ground';
 document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('selected',(b.dataset.scene==='after')===enabled));
}
const presets={apsefront:['Three apse roofs',[62,32,0],[18,21,0]],apsejoin:['Apse roof junctions',[41,31,26],[19,20,0]],apseback:['Rear roof junctions',[8,32,-27],[19,20,0]],scene:['Canal and courtyard',[-92,22,105],[0,28,0]],domeclose:['Enamel dome detail',[-22,45,28],[-10,42,10]],domenorth:['North dome detail',[-26,46,-31],[-10,42,-10]],domesoutheast:['South-east diamonds',[25,46,29],[10,42,10]],domenortheast:['North-east crosses',[25,46,-29],[10,42,-10]],centraldetail:['Central spiral',[12,74,19],[0,70,0]],paving:['Paving and railings',[-18,3,42],[-8,1,23]],...previous.presets};
const v=query.get('view');
export default {...previous,title:'Church · domes and canal setting',presets:presets[v]?{[v]:presets[v],...presets}:presets,
 build(mats,level){const root=previous.build(mats,level);if(level!=='high')return root;
 const old=[];root.traverse(o=>{if(o.isGroup&&o.userData.kind&&o.userData.height&&o.name.startsWith('sb-dome-'))old.push(o);});
 for(const o of old){const d=o.userData;const next=createDome({kind:d.kind,height:d.height,radius:d.radius,materials,neckStart:d.kind==='C'?solve.params.hC2[0]-64.5:undefined});next.position.copy(o.position);next.quaternion.copy(o.quaternion);next.scale.copy(o.scale);o.parent.add(next);pairs.push([o,next]);}
 for(const [k,m]of Object.entries(materials))mats['dome_refined_'+k]=m;
 if(pairs.length!==9)throw new Error('Expected nine dome groups, found '+pairs.length);
 let invalid=0,structuralShells=0;for(const [,next]of pairs)next.traverse(o=>{if(o.userData.closedStructuralBacking)structuralShells++;if(o.isMesh)for(const a of Object.values(o.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))invalid++;});if(invalid||structuralShells!==9)throw new Error('Invalid dome geometry');console.info('Dome replacement validation',JSON.stringify({domes:pairs.length,structuralShells,invalidCoordinates:invalid,originalsRetained:true,dimensionsPreserved:true}));apply();return root;
 },
 buildGround(mats){const group=new T.Group();oldGround=previous.buildGround(mats);setting=createChurchSetting();group.add(oldGround,setting.group);for(const [i,m]of Object.values(setting.materials).entries())mats['setting_'+i]=m;apply();return group;},
 configure(r){previous.configure(r);rig=r;apply();},
 update(state){previous.update?.(state);if(enabled)setting?.update?.(state.dt);}
};
for(const b of document.querySelectorAll('[data-scene]'))b.addEventListener('click',()=>{enabled=b.dataset.scene==='after';apply();});
