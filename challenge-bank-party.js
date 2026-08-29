import { CHALLENGE_BANK as BASE_BANK, pickChallenge as pickBaseChallenge } from './challenge-bank.js';
import { MIMIC_CARDS, PICTIONARY_CARDS } from './draw-mime-bank.js';

// Extiende el banco existente sin tocar Carrera de Mentes ni Tabú.
// Acción pasa a ser Dígalo con Mímica y Creatividad pasa a ser Pictionary.
export const CHALLENGE_BANK={
  ...BASE_BANK,
  accion:MIMIC_CARDS,
  creatividad:PICTIONARY_CARDS
};

const used={accion:new Set(),creatividad:new Set()};

function pickFresh(category,pool,lastKey=''){
  const seen=used[category];
  if(seen.size>=pool.length-1)seen.clear();
  let candidates=pool.map((item,index)=>({item,index})).filter(x=>!seen.has(x.index)&&`${category}:party:${x.index}`!==lastKey);
  if(!candidates.length){seen.clear();candidates=pool.map((item,index)=>({item,index})).filter(x=>`${category}:party:${x.index}`!==lastKey)}
  const picked=candidates[Math.floor(Math.random()*candidates.length)]||{item:pool[0],index:0};
  seen.add(picked.index);
  return {...picked.item,key:`${category}:party:${picked.index}`};
}

export function pickChallenge(category,lastKey='',difficulty=null){
  if(category==='accion')return pickFresh('accion',MIMIC_CARDS,lastKey);
  if(category==='creatividad')return pickFresh('creatividad',PICTIONARY_CARDS,lastKey);
  return pickBaseChallenge(category,lastKey,difficulty);
}
