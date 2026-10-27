const $=s=>document.querySelector(s);
let playing=false,ready=false,recording=false,elapsed=0,last=0;
const period=48;
let street=false;
function setHeight(on){street=on;window.__orbitTour.street(on);$('#street-view').classList.toggle('active',on);$('#aerial-view').classList.toggle('active',!on);}
// Whole-building envelope: all nine domes and the ground remain in frame.
// Adapt to portrait windows by pulling back, rather than cropping the church.
function pose(u,aspect=window.innerWidth/window.innerHeight){
 const a=-Math.PI*.73+u*Math.PI*2;
 const fit=Math.max(1,Math.min(1.18,.72/aspect)),r=(108+4*Math.cos(u*Math.PI*4))*fit;
 return [[Math.sin(a)*r,64*fit+6*Math.sin(u*Math.PI*2),Math.cos(a)*r],[0,38,0]];
}
function pause(){playing=false;$('#play-orbit').textContent='Play';$('#play-orbit').classList.remove('active');$('#orbit-status').textContent='Drag to explore · Play resumes the circuit';}
function play(){if(street)setHeight(false);playing=true;last=performance.now();$('#play-orbit').textContent='Pause';$('#play-orbit').classList.add('active');$('#orbit-status').textContent='A slow circuit around the exterior';}
function frame(now){if(ready&&playing&&!recording){elapsed+=(now-last)/1000;const [p,t]=pose((elapsed%period)/period);window.__view(p,t);}last=now;requestAnimationFrame(frame);}
$('#street-view').onclick=()=>{if(!ready)return;pause();setHeight(true);window.__view([-39,1.75,37],[-15,16,8]);$('#orbit-status').textContent='Street-level view · Drag and zoom to explore';};
$('#aerial-view').onclick=()=>{if(!ready)return;pause();setHeight(false);window.__view(...pose(elapsed/period));};
$('#play-orbit').onclick=()=>playing?pause():play();
$('#rotate-orbit').onclick=()=>pause();
$('#reset').onclick=()=>{setHeight(false);elapsed=0;window.__view(...pose(0));play();};
$('#c').addEventListener('pointerdown',pause,{capture:true});$('#c').addEventListener('wheel',pause,{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
function start(){if(!window.__orbitTour||$('#loading'))return setTimeout(start,100);ready=true;window.__orbitTour.setup();window.__view(...pose(0));$('#help').textContent='Drag to rotate down to street level · Scroll or pinch to zoom';document.title='Church of the Savior on Spilled Blood · Explore';if(!matchMedia('(prefers-reduced-motion:reduce)').matches)play();else pause();requestAnimationFrame(frame);}
start();
