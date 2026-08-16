import * as THREE from 'three';

const DICE_FACES={
 1:[0,0,0,1],
 2:[-0.7071068,0,0,0.7071068],
 3:[0,0,1,0],
 4:[0,0,0.7071068,0.7071068],
 5:[0.7071068,0,0,0.7071068],
 6:[0,0,-0.7071068,0.7071068]
};

let debugDie=null;
let rolling=false;
let typed='';
let typedTimer=null;

// Captura el wrapper real del dado cuando app.js lo agrega a la escena.
const originalAdd=THREE.Scene.prototype.add;
THREE.Scene.prototype.add=function(...objects){
  const result=originalAdd.apply(this,objects);
  for(const obj of objects){
    let found=false;
    obj?.traverse?.(n=>{if(/^dice(?:\.|$)/i.test(n.name||''))found=true});
    if(found)debugDie=obj;
  }
  return result;
};

function hideCenter(ms=3100){
  const card=document.getElementById('hostCenterCard');
  if(!card)return;
  card.style.opacity='0';
  card.style.pointerEvents='none';
  card.style.visibility='hidden';
  clearTimeout(hideCenter.t);
  hideCenter.t=setTimeout(()=>{
    card.style.opacity='';
    card.style.pointerEvents='';
    card.style.visibility='';
  },ms);
}

function rollDebugDie(value=1+Math.floor(Math.random()*6)){
  if(!debugDie||rolling)return false;
  rolling=true;
  hideCenter();

  const start=performance.now();
  const dur=1000;
  const base=debugDie.position.clone();
  const target=new THREE.Quaternion().fromArray(DICE_FACES[value]).normalize();
  const spinX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.31);
  const spinY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.39);
  const spinZ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.27);
  let settleFrom=null;

  (function tick(){
    const t=Math.min(1,(performance.now()-start)/dur);
    if(t<.72){
      debugDie.quaternion.multiply(spinX).multiply(spinY).multiply(spinZ);
      debugDie.position.set(
        base.x+Math.sin(t*Math.PI*4)*.32,
        base.y+Math.sin(t*Math.PI)*2.2,
        base.z+Math.sin(t*Math.PI*3)*.22
      );
    }else{
      if(!settleFrom)settleFrom=debugDie.quaternion.clone();
      const u=(t-.72)/.28;
      const e=1-Math.pow(1-u,3);
      debugDie.quaternion.copy(settleFrom).slerp(target,e);
      debugDie.position.set(base.x,base.y+Math.sin((1-u)*Math.PI)*.18,base.z);
    }
    if(t<1)requestAnimationFrame(tick);
    else{
      debugDie.quaternion.copy(target);
      debugDie.position.copy(base);
      rolling=false;
      console.log(`[ANGU DEBUG] dado → ${value}`);
    }
  })();
  return true;
}

window.__anguRollDebugDie=rollDebugDie;

document.addEventListener('keydown',e=>{
  const tag=(document.activeElement?.tagName||'').toUpperCase();
  if(['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable)return;
  if(e.key.length!==1)return;
  clearTimeout(typedTimer);
  typed=(typed+e.key.toLowerCase()).slice(-4);
  typedTimer=setTimeout(()=>typed='',1300);
  if(typed==='dado'){
    typed='';
    rollDebugDie();
  }
});

console.log('[ANGU DEBUG] Escribí "dado" para tirar el dado sin afectar la partida.');
