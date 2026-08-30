// Runtime rules patch for the main Angu game.
// Keeps app.js readable while applying the Carrera de Mentes-specific rules.
const appUrl = new URL('./app.js', import.meta.url);
const challengeBankUrl = new URL('./challenge-bank.js', import.meta.url).href;

let source = await fetch(appUrl).then(r => {
  if (!r.ok) throw new Error(`No se pudo cargar app.js (${r.status})`);
  return r.text();
});

function patch(from, to, label) {
  if (!source.includes(from)) throw new Error(`[Angu rules] No se encontró el bloque: ${label}`);
  source = source.replace(from, to);
}

// Blob modules cannot resolve ./challenge-bank.js relative to the original page,
// so make that import absolute before evaluating the patched module.
patch(
  "import { pickChallenge } from './challenge-bank.js';",
  `import { pickChallenge } from '${challengeBankUrl}';`,
  'challenge-bank import'
);

patch(
  "const game={phase:'lobby',turn:0,round:1,roll:null,winner:null,players:[],challenge:null,buzzerWinner:null,message:'',revision:0,setupRemaining:0,landing:null,steal:null,lastChallengeKey:''};",
  "const game={phase:'lobby',turn:0,round:1,turnRolls:0,roll:null,winner:null,players:[],challenge:null,buzzerWinner:null,message:'',revision:0,setupRemaining:0,landing:null,steal:null,resumeTurnAfterSteal:false,lastChallengeKey:''};",
  'game state'
);

patch(
  "Object.assign(game,{phase:'selection-countdown',setupRemaining:5,turn:0,round:1,winner:null,challenge:null,buzzerWinner:null,message:'',landing:null,steal:null,lastChallengeKey:''});",
  "Object.assign(game,{phase:'selection-countdown',setupRemaining:5,turn:0,round:1,turnRolls:0,winner:null,challenge:null,buzzerWinner:null,message:'',landing:null,steal:null,resumeTurnAfterSteal:false,lastChallengeKey:''});",
  'new game reset'
);

patch(
  "game.phase='turn';game.setupRemaining=0;game.turn=0;game.round=1;sync();toast('¡Fichas listas! 🎉')",
  "game.phase='turn';game.setupRemaining=0;game.turn=0;game.round=1;game.turnRolls=0;sync();toast('¡Fichas listas! 🎉')",
  'selection finish reset'
);

patch(
  "if(game.phase==='turn')h+='<p>Tirá el dado desde el celular.</p>';",
  "if(game.phase==='turn')h+=`<p>Tirá el dado desde el celular. <b>Tirada ${Math.min(game.turnRolls+1,3)}/3</b></p>`;",
  'host roll counter'
);

patch(
  "if(d.type==='skipSteal'&&game.phase==='steal-choice'&&game.steal?.attacker===p.token){finishResult('No robó ningún premio');return}",
  "if(d.type==='skipSteal'&&game.phase==='steal-choice'&&game.steal?.attacker===p.token){finishAfterSteal('No robó ningún premio');return}",
  'skip steal continuation'
);

patch(
  "if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token){const n=1+Math.floor(Math.random()*6);game.roll=n;game.phase='moving';sync();rollDice3D(n);setTimeout(()=>moveBy(p,n),1100);return}",
  "if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token&&game.turnRolls<3){const n=1+Math.floor(Math.random()*6);game.turnRolls++;game.roll=n;game.phase='moving';sync();rollDice3D(n);setTimeout(()=>moveBy(p,n),1100);return}",
  'three-roll guard'
);

patch(
`function resolveChallenge(ok){
 const c=game.challenge,p=game.players.find(x=>x.token===c?.answerer) || current();
 if(ok&&p){awardPrize(p,c.category,false);const opts=stealOptionsFor(p);if(opts.length){game.steal={attacker:p.token,options:opts,victimTokens:[...new Set(opts.map(o=>o.victim))]};game.challenge=null;game.phase='steal-choice';game.message='¡Ganó! Puede robar un premio';sync();toast('⚔️ ¡ROBO DISPONIBLE!');return}}
 finishResult(ok?'¡Superado! 🎉':'No esta vez 😅')
}`,
`function resolveChallenge(ok){
 const c=game.challenge,p=game.players.find(x=>x.token===c?.answerer) || current();
 const isCarrera=c?.source==='Carrera de Mentes';
 const isThreeStar=isCarrera&&Number(c?.difficulty)===3;
 const canRollAgain=isCarrera&&game.turnRolls<3;
 if(ok&&p){
   if(!isCarrera||isThreeStar)awardPrize(p,c.category,false);
   if(game.winner){sync();return}
   const opts=stealOptionsFor(p);
   if(opts.length){
     game.resumeTurnAfterSteal=canRollAgain;
     game.steal={attacker:p.token,options:opts,victimTokens:[...new Set(opts.map(o=>o.victim))]};
     game.challenge=null;game.phase='steal-choice';
     game.message=isThreeStar?'¡3 estrellas! Premio ganado · puede robar':'¡Correcta! Puede robar';
     sync();toast('⚔️ ¡ROBO DISPONIBLE!');return
   }
   if(isCarrera){
     const prizeText=isThreeStar?' · 🧠 premio de MENTE ganado':'';
     if(canRollAgain){continueTurn(\`¡Correcta!\${prizeText} · tirás de nuevo\`);return}
     finishResult(\`¡Correcta!\${prizeText} · tercera tirada completada\`);return
   }
 }
 finishResult(ok?'¡Superado! 🎉':'Incorrecta · termina el turno 😅')
}`,
  'Carrera reward and reroll rules'
);

patch(
  "function resolveSteal(victimToken,cat){const a=game.players.find(p=>p.token===game.steal?.attacker),v=game.players.find(p=>p.token===victimToken);const valid=game.steal?.options?.some(o=>o.victim===victimToken&&o.category===cat);if(!a||!v||!valid||!v.prizes.includes(cat)||a.prizes.includes(cat))return;v.prizes=v.prizes.filter(x=>x!==cat);a.prizes.push(cat);if(a.prizes.length>=CATEGORIES.length){game.winner=a.token;game.phase='winner';game.steal=null;game.landing=null;sync();return}finishResult(`${a.name} robó ${ICONS[cat]} ${cat.toUpperCase()} a ${v.name}`)}",
  "function resolveSteal(victimToken,cat){const a=game.players.find(p=>p.token===game.steal?.attacker),v=game.players.find(p=>p.token===victimToken);const valid=game.steal?.options?.some(o=>o.victim===victimToken&&o.category===cat);if(!a||!v||!valid||!v.prizes.includes(cat)||a.prizes.includes(cat))return;v.prizes=v.prizes.filter(x=>x!==cat);a.prizes.push(cat);if(a.prizes.length>=CATEGORIES.length){game.winner=a.token;game.phase='winner';game.steal=null;game.landing=null;sync();return}finishAfterSteal(`${a.name} robó ${ICONS[cat]} ${cat.toUpperCase()} a ${v.name}`)}",
  'steal resolution continuation'
);

patch(
  "function finishResult(msg){game.message=msg;game.challenge=null;game.steal=null;game.phase='result';sync();clearTimeout(resultTimer);resultTimer=setTimeout(advanceTurn,2100)}\nfunction awardPrize",
  "function continueTurn(msg){game.message=msg;game.challenge=null;game.steal=null;game.resumeTurnAfterSteal=false;game.phase='result';sync();clearTimeout(resultTimer);resultTimer=setTimeout(()=>{if(game.winner)return;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.landing=null;game.steal=null;sync()},1800)}\nfunction finishAfterSteal(msg){const resume=game.resumeTurnAfterSteal;game.resumeTurnAfterSteal=false;if(resume)continueTurn(`${msg} · tirás de nuevo`);else finishResult(`${msg} · termina el turno`)}\nfunction finishResult(msg){game.message=msg;game.challenge=null;game.steal=null;game.resumeTurnAfterSteal=false;game.phase='result';sync();clearTimeout(resultTimer);resultTimer=setTimeout(advanceTurn,2100)}\nfunction awardPrize",
  'continue same turn helper'
);

patch(
  "function advanceTurn(){if(game.winner||!game.players.length||['lobby','selection','selection-countdown','steal-choice'].includes(game.phase))return;game.turn=(game.turn+1)%game.players.length;if(game.turn===0)game.round++;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.landing=null;game.steal=null;sync()}",
  "function advanceTurn(){if(game.winner||!game.players.length||['lobby','selection','selection-countdown','steal-choice'].includes(game.phase))return;game.turn=(game.turn+1)%game.players.length;if(game.turn===0)game.round++;game.turnRolls=0;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.landing=null;game.steal=null;game.resumeTurnAfterSteal=false;sync()}",
  'turn roll reset'
);

patch(
  "if(game.phase==='turn'&&turn){stage.innerHTML='<div class=\"phone-card\"><span class=\"turn-badge\">TU TURNO</span><h2>¡Tirá el dado!</h2><button id=\"diceBtn\" class=\"dice-button\">🎲</button></div>';",
  "if(game.phase==='turn'&&turn){stage.innerHTML=`<div class=\"phone-card\"><span class=\"turn-badge\">TU TURNO · ${Math.min(game.turnRolls+1,3)}/3</span><h2>¡Tirá el dado!</h2><button id=\"diceBtn\" class=\"dice-button\">🎲</button></div>`;",
  'phone roll counter'
);

// Carrera de Mentes: before revealing a question, the active player chooses 1, 2 or 3 stars.
patch(
`function startCategory(p,cat){
 const item=pickChallenge(cat,game.lastChallengeKey);game.lastChallengeKey=item.key;const r=readerFor(p);
 game.challenge={...item,category:cat,answerer:item.kind==='buzzer'?null:p.token,reader:r.token,selected:null,freeAnswer:''};
 game.buzzerWinner=null;game.phase='challenge';sync()
}`,
`function startCategory(p,cat,difficulty=null){
 if(cat==='mente'&&!difficulty){game.challenge=null;game.buzzerWinner=null;game.phase='difficulty-choice';game.message='Elegí dificultad: ⭐, ⭐⭐ o ⭐⭐⭐';sync();return}
 const item=pickChallenge(cat,game.lastChallengeKey,difficulty);game.lastChallengeKey=item.key;const r=readerFor(p);
 game.challenge={...item,category:cat,answerer:item.kind==='buzzer'?null:p.token,reader:r.token,selected:null,freeAnswer:''};
 game.buzzerWinner=null;game.phase='challenge';game.message='';sync()
}`,
  'difficulty selection before Mente question'
);

patch(
  "const active=current();\n if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token&&game.turnRolls<3){const n=1+Math.floor(Math.random()*6);game.turnRolls++;game.roll=n;game.phase='moving';sync();rollDice3D(n);setTimeout(()=>moveBy(p,n),1100);return}",
  "const active=current();\n if(d.type==='chooseDifficulty'&&game.phase==='difficulty-choice'&&active?.token===p.token&&[1,2,3].includes(Number(d.difficulty))){startCategory(p,'mente',Number(d.difficulty));return}\n if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token&&game.turnRolls<3){const n=1+Math.floor(Math.random()*6);game.turnRolls++;game.roll=n;game.phase='moving';sync();rollDice3D(n);setTimeout(()=>moveBy(p,n),1100);return}",
  'difficulty choice intent'
);

patch(
  "if(game.phase==='turn'&&active?.token===p.token)return{text:'EN TURNO · TIRA',cls:'active'};",
  "if(game.phase==='difficulty-choice'&&active?.token===p.token)return{text:'ELEGÍ ⭐ DIFICULTAD',cls:'active'};if(game.phase==='turn'&&active?.token===p.token)return{text:'EN TURNO · TIRA',cls:'active'};",
  'difficulty player status'
);

patch(
  "if(game.phase==='turn'&&turn){stage.innerHTML=`<div class=\"phone-card\"><span class=\"turn-badge\">TU TURNO · ${Math.min(game.turnRolls+1,3)}/3</span><h2>¡Tirá el dado!</h2><button id=\"diceBtn\" class=\"dice-button\">🎲</button></div>`;$('#diceBtn').onclick=()=>{navigator.vibrate?.(60);sendIntent('roll');$('#diceBtn').disabled=true};return}\n if(c){",
  "if(game.phase==='turn'&&turn){stage.innerHTML=`<div class=\"phone-card\"><span class=\"turn-badge\">TU TURNO · ${Math.min(game.turnRolls+1,3)}/3</span><h2>¡Tirá el dado!</h2><button id=\"diceBtn\" class=\"dice-button\">🎲</button></div>`;$('#diceBtn').onclick=()=>{navigator.vibrate?.(60);sendIntent('roll');$('#diceBtn').disabled=true};return}\n if(game.phase==='difficulty-choice'){if(turn){stage.innerHTML='<div class=\"phone-card\"><span class=\"turn-badge\">🧠 MENTE</span><h2>Elegí la dificultad</h2><p>⭐ y ⭐⭐ te permiten seguir jugando si acertás. ⭐⭐⭐ además puede darte el premio de Mente.</p><div class=\"answer-grid\"><button class=\"answer-btn diff-btn\" data-d=\"1\">⭐</button><button class=\"answer-btn diff-btn\" data-d=\"2\">⭐⭐</button><button class=\"answer-btn diff-btn\" data-d=\"3\">⭐⭐⭐</button></div></div>';stage.querySelectorAll('.diff-btn').forEach(b=>b.onclick=()=>{sendIntent('chooseDifficulty',{difficulty:Number(b.dataset.d)});stage.querySelectorAll('.diff-btn').forEach(x=>x.disabled=true)});return}stage.innerHTML='<div class=\"phone-card\"><div class=\"wait-icon\">🧠</div><h2>Eligiendo dificultad…</h2><p>El jugador en turno decide entre ⭐, ⭐⭐ y ⭐⭐⭐.</p></div>';return}\n if(c){",
  'difficulty picker on phone'
);

const blob = new Blob([source], { type: 'text/javascript' });
const moduleUrl = URL.createObjectURL(blob);
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
