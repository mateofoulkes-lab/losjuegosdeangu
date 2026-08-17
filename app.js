import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';
import { pickChallenge } from './challenge-bank.js';

const APP_ID='soquetin-multiplayer-probe-2026';
const COLORS=['#0066ff','#ff1744','#009e43','#d8bd00','#ff2fb3','#090909','#ffffff','#8f35ff'];
const COLOR_NAMES=['Azul','Rojo','Verde','Amarillo','Rosa','Negro','Blanco','Violeta'];
const CATEGORIES=['mente','accion','palabra','creatividad','mentiras','grupo'];
const CATEGORY_COLORS={mente:'#53b9f5',accion:'#ff5843',palabra:'#ffd54a',creatividad:'#72d54a',mentiras:'#b763e8',grupo:'#ff9a3c'};
const ICONS={mente:'🧠',accion:'⚡',palabra:'💬',creatividad:'✏️',mentiras:'🎭',grupo:'👥'};
const TRACK_COUNT=26;
const TRACK=[[.3,5.8905,'start'],[-2.4728,5.7193,'creatividad'],[-4.4729,5.2158,'mentiras'],[-6.5106,4.4091,'palabra'],[-7.9706,3.4081,'accion'],[-9.1415,2.1506,'mente'],[-9.8137,.5688,'grupo'],[-9.6297,-1.1133,'mente'],[-8.6312,-2.6312,'accion'],[-7.2584,-3.7858,'palabra'],[-5.5569,-4.6863,'mente'],[-3.6216,-5.3317,'accion'],[-1.6519,-5.6755,'palabra'],[.3,-5.8905,'creatividad'],[2.5355,-5.7816,'mentiras'],[4.5675,-5.3406,'grupo'],[6.4642,-4.6564,'mente'],[8.1072,-3.7757,'accion'],[9.5423,-2.6582,'palabra'],[10.4173,-1.1156,'creatividad'],[10.5769,.6701,'mentiras'],[9.9031,2.1293,'grupo'],[8.7525,3.3462,'creatividad'],[7.1106,4.4091,'palabra'],[5.3564,5.2158,'accion'],[3.3659,5.7193,'mente']];
const DICE_FACES={1:[0,0,0,1],2:[-0.7071068,0,0,0.7071068],3:[0,0,1,0],4:[0,0,0.7071068,0.7071068],5:[0.7071068,0,0,0.7071068],6:[0,0,-0.7071068,0.7071068]};
const PIECES=[
 {name:'Auto',file:'auto.glb',icon:'🚗',boost:1.5},{name:'Cañón',file:'canon.glb',icon:'💥',boost:1.5},{name:'Carretilla',file:'carretilla.glb',icon:'🛒',boost:1.5},{name:'Casa',file:'casa.glb',icon:'🏠',boost:1},{name:'Dedal',file:'dedal.glb',icon:'🔔',boost:1},{name:'Patito',file:'patito.glb',icon:'🦆',boost:1},{name:'Perro',file:'perro.glb',icon:'🐕',boost:1},{name:'Plancha',file:'plancha.glb',icon:'♨️',boost:1},{name:'Sombrero',file:'sombrero.glb',icon:'🎩',boost:1},{name:'Tren',file:'tren.glb',icon:'🚂',boost:1.5}
];

const $=s=>document.querySelector(s);
const views={home:$('#homeView'),host:$('#hostView'),player:$('#playerView')};
const tokenKey='angu-player-token-v1',nameKey='angu-player-name-v1';
let playerToken=localStorage.getItem(tokenKey)||crypto.randomUUID();localStorage.setItem(tokenKey,playerToken);
let playerName=localStorage.getItem(nameKey)||'';
let room=null,actions=null,roomCode='',isHost=false,hostPeer=null,setupTimer=null,resultTimer=null;
const game={phase:'lobby',turn:0,round:1,roll:null,winner:null,players:[],challenge:null,buzzerWinner:null,message:'',revision:0,setupRemaining:0,landing:null,steal:null,lastChallengeKey:''};

const cleanCode=v=>(v||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const makeCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from({length:4},()=>a[Math.floor(Math.random()*a.length)]).join('')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me=()=>game.players.find(p=>p.token===playerToken);
const current=()=>game.players[game.turn%Math.max(1,game.players.length)];
const trackCategory=pos=>TRACK[((pos%TRACK_COUNT)+TRACK_COUNT)%TRACK_COUNT][2];
const categoryFor=pos=>{const c=trackCategory(pos);return c==='start'?CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)]:c};
const showView=name=>Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name));
function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1600)}
function setHostStatus(t){const e=$('#hostStatus');if(e)e.textContent=t}

$('#roomCodeInput').addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('#createRoomBtn').onclick=()=>startHost(makeCode());
$('#joinRoomBtn').onclick=()=>{const c=cleanCode($('#roomCodeInput').value);if(c.length===4)startPlayer(c)};
const incoming=cleanCode(new URLSearchParams(location.search).get('room'));if(incoming)$('#roomCodeInput').value=incoming;

function connect(code,host){
 isHost=host;roomCode=code;
 room=joinRoom({appId:APP_ID},code,{onJoinError:({error})=>console.warn('Trystero join error',error)});
 actions={hello:room.makeAction('angu-hello-v1'),state:room.makeAction('angu-state-v1'),intent:room.makeAction('angu-intent-v1'),ping:room.makeAction('angu-ping-v1')};
 room.onPeerJoin=peerId=>{
   if(isHost){setHostStatus('P2P conectado');setTimeout(()=>sendState(peerId),120)}
   else{setTimeout(()=>{sendHello();actions.ping.send({want:'state'}).catch(()=>{})},100)}
 };
 room.onPeerLeave=peerId=>{
   if(isHost){const p=game.players.find(x=>x.peerId===peerId);if(p){p.connected=false;sync()}}
   else if(hostPeer===peerId){hostPeer=null;$('#phoneConn').style.color='#ffb44d'}
 };
 actions.hello.onMessage=(d,{peerId})=>{
   if(!isHost||!d?.token)return;
   let p=game.players.find(x=>x.token===d.token);
   if(!p){if(game.players.length>=8)return;p={token:d.token,peerId,name:(d.name||`Jugador ${game.players.length+1}`).slice(0,18),color:null,piece:null,pos:0,prizes:[],connected:true};game.players.push(p);toast(`${p.name} entró 🐾`)}
   else{p.peerId=peerId;p.connected=true;if(d.name)p.name=d.name.slice(0,18)}
   sync()
 };
 actions.state.onMessage=(d,{peerId})=>{if(isHost||!d)return;hostPeer=peerId;Object.assign(game,d);$('#phoneConn').style.color='#50e38a';renderPhone()};
 actions.intent.onMessage=(d,{peerId})=>{if(isHost)handleIntent(d,peerId)};
 actions.ping.onMessage=(d,{peerId})=>{if(isHost)sendState(peerId)};
 if(!isHost){sendHello();setTimeout(()=>actions.ping.send({want:'state'}).catch(()=>{}),700)}
}
function sendHello(){actions?.hello.send({token:playerToken,name:playerName}).catch(()=>{})}
function sendState(target){if(!isHost||!actions)return;actions.state.send(JSON.parse(JSON.stringify(game)),target?{target}:undefined).catch(()=>{})}
// Intents are deliberately broadcast inside the Trystero room. Only the host processes them.
// This avoids a phone accidentally targeting another phone in the WebRTC mesh.
function sendIntent(type,payload={}){actions?.intent.send({type,token:playerToken,...payload}).catch(()=>{})}
function sync(){game.revision++;renderHost();refresh3DTokens();sendState()}
function requestState(){if(isHost||!room)return;sendHello();actions?.ping.send({want:'state'}).catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestState()});
window.addEventListener('focus',requestState);
window.addEventListener('pageshow',requestState);
window.addEventListener('online',requestState);
setInterval(()=>{if(!isHost&&room&&!document.hidden)requestState()},8000);

function startHost(code){
 showView('host');$('#hostRoomCode').textContent=code;
 const u=new URL(location.href);u.searchParams.set('room',code);
 $('#qrBox').innerHTML=`Código <b>${code}</b><br><small>Celulares: abrí esta web e ingresá el código. Conexión WebRTC P2P por Trystero.</small>`;
 history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,true);init3D();renderHost();setHostStatus('esperando celulares')
}
function startPlayer(code){showView('player');$('#phoneRoomCode').textContent=code;history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,false);renderPhone()}

function beginSetupCountdown(){
 if(game.players.length<2)return;clearInterval(setupTimer);clearTimeout(resultTimer);
 game.players.forEach(p=>{p.color=null;p.piece=null;p.pos=0;p.prizes=[]});
 Object.assign(game,{phase:'selection-countdown',setupRemaining:5,turn:0,round:1,winner:null,challenge:null,buzzerWinner:null,message:'',landing:null,steal:null,lastChallengeKey:''});
 sync();setupTimer=setInterval(()=>{game.setupRemaining--;if(game.setupRemaining<=0){clearInterval(setupTimer);beginSelection();return}sync()},1000)
}
function beginSelection(){game.phase='selection';game.setupRemaining=10;sync();setupTimer=setInterval(()=>{game.setupRemaining--;if(game.setupRemaining<=0){clearInterval(setupTimer);finalizeSelection();return}sync()},1000)}
function shuffled(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function finalizeSelection(){
 const freeColors=COLORS.map((_,i)=>i).filter(i=>!game.players.some(p=>p.color===i));
 const freePieces=shuffled(PIECES.map((_,i)=>i).filter(i=>!game.players.some(p=>p.piece===i)));
 game.players.forEach(p=>{if(!Number.isInteger(p.color))p.color=freeColors.shift();if(!Number.isInteger(p.piece))p.piece=freePieces.shift()});
 game.phase='turn';game.setupRemaining=0;game.turn=0;game.round=1;sync();toast('¡Fichas listas! 🎉')
}

function playerStatus(p){
 if(!p.connected)return{text:'DESCONECTADO',cls:'disconnected'};
 if(game.phase==='selection-countdown')return{text:'PREPARATE',cls:''};
 if(game.phase==='selection'){const a=Number.isInteger(p.piece)?PIECES[p.piece].name:'—',b=Number.isInteger(p.color)?COLOR_NAMES[p.color]:'—';return{text:`${a} · ${b}`,cls:Number.isInteger(p.color)&&Number.isInteger(p.piece)?'active':''}}
 if(game.phase==='steal-choice'&&game.steal?.attacker===p.token)return{text:'ELEGÍ QUÉ ROBAR',cls:'active'};
 if(game.phase==='steal-choice'&&game.steal?.victimTokens?.includes(p.token))return{text:'POSIBLE ROBO',cls:'reader'};
 const active=current(),c=game.challenge;
 if(game.winner===p.token)return{text:'GANADOR',cls:'active'};
 if(game.phase==='turn'&&active?.token===p.token)return{text:'EN TURNO · TIRA',cls:'active'};
 if(game.phase==='moving'&&active?.token===p.token)return{text:'MOVIENDO',cls:'active'};
 if(c){
   if(game.buzzerWinner===p.token)return{text:'¡PRIMERO!',cls:'buzzer-winner active'};
   if(c.reader===p.token){if(game.phase==='judge')return{text:'DECIDE',cls:'reader'};return{text:c.kind==='buzzer'?'LEE / CONTROLA':'JURADO',cls:'reader'}}
   if(c.answerer===p.token)return{text:c.kind==='perform'?'ACTÚA':c.kind==='taboo'?'DA PISTAS':'RESPONDE',cls:'active'};
   if(c.kind==='buzzer'&&game.phase==='challenge')return{text:'BUZZER LISTO',cls:''}
 }
 if(game.phase==='result'&&active?.token===p.token)return{text:game.message||'RESULTADO',cls:'active'};
 return{text:'ESPERANDO',cls:''}
}
function wheelBackground(p){const parts=[];CATEGORIES.forEach((cat,i)=>{const on=p.prizes.includes(cat),color=on?CATEGORY_COLORS[cat]:'#26374b',a=i*60,b=(i+1)*60;parts.push(`${color} ${a}deg ${b-2}deg`,`#0d1d31 ${b-2}deg ${b}deg`)});return`conic-gradient(${parts.join(',')})`}
function playerCard(p){const s=playerStatus(p),color=Number.isInteger(p.color)?COLORS[p.color]:'#445166',piece=Number.isInteger(p.piece)?PIECES[p.piece]:null;const el=document.createElement('div');el.className=`player-card ${s.cls}`;el.style.setProperty('--player',color);el.innerHTML=`<div class="player-card-avatar">${piece?.icon||'❔'}</div><div class="player-card-main"><div class="player-name">${esc(p.name)}</div><div class="player-status"><span class="status-chip">${esc(s.text)}</span></div></div><div class="progress-wheel" style="background:${wheelBackground(p)}"></div>`;return el}
function renderPlayerPanels(){const left=$('#playersLeft'),right=$('#playersRight');if(!left||!right)return;left.innerHTML='';right.innerHTML='';const split=Math.ceil(game.players.length/2);game.players.forEach((p,i)=>(i<split?left:right).appendChild(playerCard(p)))}
function renderHost(){renderPlayerPanels();const start=$('#startGameBtn');if(start){start.disabled=game.players.length<2||game.phase!=='lobby';start.textContent=game.players.length<2?'Esperando al menos 2 jugadores…':'Empezar partida'}renderHostInfo()}
function challengePublicText(c){if(!c)return'';if(c.kind==='taboo')return'Da pistas para que el grupo adivine la palabra. Hay palabras prohibidas que sólo ve el jugador.';if(c.kind==='perform')return'El jugador recibió una actuación privada en su celular. ¡Mírenlo!';if(c.kind==='buzzer')return c.q;if(c.kind==='free')return c.q;return c.q||''}
function renderHostInfo(){
 const lobby=$('#hostLobby'),info=$('#hostGameInfo'),center=$('#hostCenterCard');if(!lobby||!info)return;
 const cinematic=game.phase==='moving';center?.classList.toggle('hidden',cinematic);if(cinematic)return;
 if(game.phase==='lobby'){lobby.classList.remove('hidden');info.classList.add('hidden');return}
 lobby.classList.add('hidden');info.classList.remove('hidden');
 if(game.phase==='selection-countdown'){info.innerHTML=`<div class="setup-countdown">${game.setupRemaining}</div><h2>¡PREPÁRENSE!</h2><p>Enseguida eligen ficha y color.</p>`;return}
 if(game.phase==='selection'){const ready=game.players.filter(p=>Number.isInteger(p.color)&&Number.isInteger(p.piece)).length;info.innerHTML=`<div class="setup-timer">${game.setupRemaining}s</div><h2>Fichas y colores</h2><p><strong>${ready}/${game.players.length}</strong> listos</p><div class="host-choice-list">${game.players.map(p=>`<div><b>${esc(p.name)}</b><span>${Number.isInteger(p.piece)?PIECES[p.piece].icon+' '+PIECES[p.piece].name:'sin ficha'}</span><span class="choice-color" style="--c:${Number.isInteger(p.color)?COLORS[p.color]:'#445166'}">${Number.isInteger(p.color)?COLOR_NAMES[p.color]:'sin color'}</span></div>`).join('')}</div>`;return}
 if(game.phase==='steal-choice'){const a=game.players.find(p=>p.token===game.steal?.attacker);info.innerHTML=`<div class="steal-banner">⚔️ ROBO</div><h2>${esc(a?.name||'Jugador')} puede robar</h2><p>Ganó la prueba en una casilla ocupada. Está eligiendo un premio que todavía no tiene.</p>`;return}
 if(game.phase==='winner'){const w=game.players.find(p=>p.token===game.winner);info.innerHTML=`<h2>🏆 ${esc(w?.name)}</h2><p>¡Consiguió los seis premios!</p>`;return}
 const p=current(),c=game.challenge;let h=`<span class="turn-badge">RONDA ${game.round}</span><h2>${esc(p?.name||'')}</h2>`;
 if(game.phase==='turn')h+='<p>Tirá el dado desde el celular.</p>';
 if(c){h+=`<p><b>${ICONS[c.category]||'🎲'} ${esc(c.category).toUpperCase()} · ${esc(c.title||labelKind(c.kind))}</b></p><p>${esc(challengePublicText(c))}</p>`}
 if(game.phase==='judge')h+='<p>El jurado decide desde su celular.</p>';
 if(game.phase==='result')h+=`<h2>${esc(game.message)}</h2>`;
 info.innerHTML=h
}
function labelKind(k){return({trivia:'PREGUNTA',free:'DESAFÍO',buzzer:'BUZZER',taboo:'PALABRA PROHIBIDA',perform:'ACTUACIÓN',social:'GRUPO'})[k]||'DESAFÍO'}

$('#startGameBtn').onclick=beginSetupCountdown;
$('#hostNextBtn').onclick=advanceTurn;
$('#hostMoveBtn').onclick=()=>{const p=current();if(p&&game.phase==='turn'){p.pos=(p.pos+1)%TRACK_COUNT;sync();repositionAllTokens(false)}};
$('#hostPrizeBtn').onclick=()=>{const p=current();if(p)awardPrize(p,categoryFor(p.pos),true)};

function handleIntent(d,peerId){
 const p=game.players.find(x=>x.token===d?.token);if(!p)return;p.peerId=peerId;p.connected=true;
 if(d.type==='profile'&&game.phase==='lobby'){p.name=(d.name||p.name).trim().slice(0,18);sync();return}
 if(d.type==='selectSetup'&&game.phase==='selection'){
   if(Number.isInteger(d.color)&&d.color>=0&&d.color<COLORS.length&&!game.players.some(x=>x.token!==p.token&&x.color===d.color))p.color=d.color;
   if(Number.isInteger(d.piece)&&d.piece>=0&&d.piece<PIECES.length&&!game.players.some(x=>x.token!==p.token&&x.piece===d.piece))p.piece=d.piece;
   sync();return
 }
 if(d.type==='stealPrize'&&game.phase==='steal-choice'&&game.steal?.attacker===p.token){resolveSteal(d.victim,d.category);return}
 if(d.type==='skipSteal'&&game.phase==='steal-choice'&&game.steal?.attacker===p.token){finishResult('No robó ningún premio');return}
 const active=current();
 if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token){const n=1+Math.floor(Math.random()*6);game.roll=n;game.phase='moving';sync();rollDice3D(n);setTimeout(()=>moveBy(p,n),1100);return}
 const c=game.challenge;if(!c)return;
 if(d.type==='answer'&&game.phase==='challenge'&&c.kind==='trivia'&&c.answerer===p.token){c.selected=Number(d.choice);game.phase='judge';sync();return}
 if(d.type==='freeAnswer'&&game.phase==='challenge'&&c.kind==='free'&&c.answerer===p.token){c.freeAnswer=(d.text||'').trim().slice(0,120);game.phase='judge';sync();return}
 if(d.type==='buzz'&&game.phase==='challenge'&&c.kind==='buzzer'&&!game.buzzerWinner&&c.reader!==p.token){game.buzzerWinner=p.token;c.answerer=p.token;game.phase='buzz-answer';sync();return}
 if(d.type==='buzzAnswer'&&game.phase==='buzz-answer'&&c.answerer===p.token){c.freeAnswer=(d.text||'').trim().slice(0,100);game.phase='judge';sync();return}
 if(d.type==='judge'&&c.reader===p.token&&['judge','challenge'].includes(game.phase)){resolveChallenge(!!d.ok);return}
}
function moveBy(p,n){const start=p.pos;let s=0;const timer=setInterval(()=>{s++;p.pos=(start+s)%TRACK_COUNT;game.revision++;repositionAllTokens(false);renderHost();sendState();if(s>=n){clearInterval(timer);game.roll=null;setTimeout(()=>landed(p),650)}},300)}
function landed(p){const occupants=game.players.filter(x=>x.token!==p.token&&x.pos===p.pos);game.landing={player:p.token,occupants:occupants.map(x=>x.token)};startCategory(p,categoryFor(p.pos))}
function readerFor(p){const i=game.players.findIndex(x=>x.token===p.token);return game.players[(i+1)%game.players.length]}
function startCategory(p,cat){
 const item=pickChallenge(cat,game.lastChallengeKey);game.lastChallengeKey=item.key;const r=readerFor(p);
 game.challenge={...item,category:cat,answerer:item.kind==='buzzer'?null:p.token,reader:r.token,selected:null,freeAnswer:''};
 game.buzzerWinner=null;game.phase='challenge';sync()
}
function resolveChallenge(ok){
 const c=game.challenge,p=game.players.find(x=>x.token===c?.answerer) || current();
 if(ok&&p){awardPrize(p,c.category,false);const opts=stealOptionsFor(p);if(opts.length){game.steal={attacker:p.token,options:opts,victimTokens:[...new Set(opts.map(o=>o.victim))]};game.challenge=null;game.phase='steal-choice';game.message='¡Ganó! Puede robar un premio';sync();toast('⚔️ ¡ROBO DISPONIBLE!');return}}
 finishResult(ok?'¡Superado! 🎉':'No esta vez 😅')
}
function stealOptionsFor(attacker){const occupants=(game.landing?.occupants||[]).map(t=>game.players.find(p=>p.token===t)).filter(Boolean);const out=[];occupants.forEach(v=>v.prizes.forEach(cat=>{if(!attacker.prizes.includes(cat))out.push({victim:v.token,category:cat})}));return out}
function resolveSteal(victimToken,cat){const a=game.players.find(p=>p.token===game.steal?.attacker),v=game.players.find(p=>p.token===victimToken);const valid=game.steal?.options?.some(o=>o.victim===victimToken&&o.category===cat);if(!a||!v||!valid||!v.prizes.includes(cat)||a.prizes.includes(cat))return;v.prizes=v.prizes.filter(x=>x!==cat);a.prizes.push(cat);if(a.prizes.length>=CATEGORIES.length){game.winner=a.token;game.phase='winner';game.steal=null;game.landing=null;sync();return}finishResult(`${a.name} robó ${ICONS[cat]} ${cat.toUpperCase()} a ${v.name}`)}
function finishResult(msg){game.message=msg;game.challenge=null;game.steal=null;game.phase='result';sync();clearTimeout(resultTimer);resultTimer=setTimeout(advanceTurn,2100)}
function awardPrize(p,cat,broadcast=true){if(CATEGORIES.includes(cat)&&!p.prizes.includes(cat))p.prizes.push(cat);if(p.prizes.length>=CATEGORIES.length){game.winner=p.token;game.phase='winner'}if(broadcast)sync()}
function advanceTurn(){if(game.winner||!game.players.length||['lobby','selection','selection-countdown','steal-choice'].includes(game.phase))return;game.turn=(game.turn+1)%game.players.length;if(game.turn===0)game.round++;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.landing=null;game.steal=null;sync()}

function judgeButtons(){return'<div class="judge-row"><button id="badJudge" class="bad">✕ NO</button><button id="okJudge" class="ok">✓ SÍ</button></div>'}
function hookJudge(){const ok=$('#okJudge'),bad=$('#badJudge');if(ok)ok.onclick=()=>sendIntent('judge',{ok:true});if(bad)bad.onclick=()=>sendIntent('judge',{ok:false})}
function renderPhone(){
 const stage=$('#phoneStage'),p=me();$('#identityText').textContent=p?`${p.name}${Number.isInteger(p.color)?` · ${COLOR_NAMES[p.color]}`:''}`:'Jugador';
 if(!p){stage.innerHTML='<div class="phone-card"><div class="wait-icon">🐾</div><h2>Entrando…</h2><p>Buscando la pantalla por Trystero…</p></div>';return}
 if(game.phase==='lobby'){stage.innerHTML=`<div class="phone-card"><h2>Tu nombre</h2><input id="nameEdit" class="name-input" maxlength="18" value="${esc(p.name)}"><button id="saveProfile" class="primary big setup-save">Listo</button><p>La ficha y el color se eligen cuando empieza la partida.</p><small>● conexión P2P</small></div>`;$('#saveProfile').onclick=()=>{playerName=($('#nameEdit').value||p.name).trim().slice(0,18);localStorage.setItem(nameKey,playerName);sendIntent('profile',{name:playerName})};return}
 if(game.phase==='selection-countdown'){stage.innerHTML=`<div class="phone-card"><div class="setup-countdown">${game.setupRemaining}</div><h2>¡Preparado!</h2><p>Cuando llegue a cero, elegí rápido.</p></div>`;return}
 if(game.phase==='selection'){
   const usedColors=new Set(game.players.filter(x=>x.token!==p.token&&Number.isInteger(x.color)).map(x=>x.color)),usedPieces=new Set(game.players.filter(x=>x.token!==p.token&&Number.isInteger(x.piece)).map(x=>x.piece));
   stage.innerHTML=`<div class="phone-card setup-card"><div class="setup-timer">${game.setupRemaining}s</div><h2 class="setup-title">Personaje</h2><div class="piece-strip">${PIECES.map((pc,i)=>`<button class="piece-pick ${p.piece===i?'selected':''} ${usedPieces.has(i)?'taken':''}" data-piece="${i}" ${usedPieces.has(i)?'disabled':''}><span class="piece-icon">${pc.icon}</span><span class="piece-name">${esc(pc.name)}</span></button>`).join('')}</div><h2 class="setup-title color-title">Color</h2><div class="color-grid">${COLORS.map((c,i)=>`<button class="setup-color ${p.color===i?'selected':''} ${usedColors.has(i)?'taken':''} ${[3,6].includes(i)?'light':''}" data-color="${i}" ${usedColors.has(i)?'disabled':''} style="--setup-color:${c}"><span class="color-dot"></span><b>${COLOR_NAMES[i]}</b></button>`).join('')}</div><div class="setup-summary">${Number.isInteger(p.piece)?PIECES[p.piece].icon+' '+PIECES[p.piece].name:'Elegí personaje'} · ${Number.isInteger(p.color)?COLOR_NAMES[p.color]:'Elegí color'}</div></div>`;
   stage.querySelectorAll('.piece-pick:not(.taken)').forEach(b=>b.onclick=()=>sendIntent('selectSetup',{piece:Number(b.dataset.piece)}));stage.querySelectorAll('.setup-color:not(.taken)').forEach(b=>b.onclick=()=>sendIntent('selectSetup',{color:Number(b.dataset.color)}));return
 }
 if(game.phase==='steal-choice'&&game.steal?.attacker===p.token){const opts=game.steal.options||[];stage.innerHTML=`<div class="phone-card"><span class="turn-badge">⚔️ ROBO</span><h2>Elegí un premio</h2><p>Podés robar uno que todavía no tengas.</p><div class="steal-grid">${opts.map((o,i)=>{const v=game.players.find(x=>x.token===o.victim);return`<button class="steal-option" data-i="${i}"><span>${ICONS[o.category]}</span><b>${o.category.toUpperCase()}</b><small>de ${esc(v?.name||'jugador')}</small></button>`}).join('')}</div><button id="skipSteal" class="wide-skip">No robar</button></div>`;stage.querySelectorAll('.steal-option').forEach(b=>b.onclick=()=>{const o=opts[Number(b.dataset.i)];sendIntent('stealPrize',{victim:o.victim,category:o.category})});$('#skipSteal').onclick=()=>sendIntent('skipSteal');return}
 if(game.phase==='steal-choice'){stage.innerHTML='<div class="phone-card"><div class="wait-icon">⚔️</div><h2>¡Hay robo!</h2><p>Mirá la pantalla grande.</p></div>';return}
 if(game.phase==='winner'){const w=game.players.find(x=>x.token===game.winner);stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🏆</div><h2>${w?.token===p.token?'¡GANASTE!':`${esc(w?.name)} ganó`}</h2></div>`;return}
 const active=current(),turn=active?.token===p.token,c=game.challenge;
 if(game.phase==='turn'&&turn){stage.innerHTML='<div class="phone-card"><span class="turn-badge">TU TURNO</span><h2>¡Tirá el dado!</h2><button id="diceBtn" class="dice-button">🎲</button></div>';$('#diceBtn').onclick=()=>{navigator.vibrate?.(60);sendIntent('roll');$('#diceBtn').disabled=true};return}
 if(c){
   if(c.kind==='trivia'&&game.phase==='challenge'){
     if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS LEÉS</span><h2>${ICONS[c.category]} Pregunta</h2><p class="reader-question">${esc(c.q)}</p><p>Correcta: <b>${esc(c.opts[c.a])}</b></p></div>`;return}
     if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">RESPONDÉ</span><h2>${esc(c.q)}</h2><div class="answer-grid">${c.opts.map((o,i)=>`<button class="answer-btn" data-a="${i}">${esc(o)}</button>`).join('')}</div></div>`;stage.querySelectorAll('.answer-btn').forEach(b=>b.onclick=()=>{sendIntent('answer',{choice:Number(b.dataset.a)});stage.querySelectorAll('.answer-btn').forEach(x=>x.disabled=true)});return}
   }
   if(c.kind==='free'&&game.phase==='challenge'&&c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">${esc(c.title||'DESAFÍO')}</span><h2>${esc(c.q)}</h2><input id="freeAnswer" class="name-input" maxlength="120" placeholder="Tu respuesta"><button id="sendFree" class="primary big setup-save">Responder</button></div>`;$('#sendFree').onclick=()=>sendIntent('freeAnswer',{text:$('#freeAnswer').value});return}
   if(c.kind==='taboo'&&game.phase==='challenge'){
     if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">PALABRA PROHIBIDA</span><h2>${esc(c.secret)}</h2><p>No podés decir:</p><div class="setup-summary">${c.forbidden.map(esc).join(' · ')}</div><p>Da pistas en voz alta. No mires la TV para buscar ayuda 😄</p></div>`;return}
     if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">JURADO</span><h2>¿La adivinaron?</h2><p>Palabra: <b>${esc(c.secret)}</b></p><p>Prohibidas: ${c.forbidden.map(esc).join(', ')}</p>${judgeButtons()}</div>`;hookJudge();return}
   }
   if(c.kind==='perform'&&game.phase==='challenge'){
     if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">${esc(c.title||'ACTUÁ')}</span><h2>Tu consigna secreta</h2><p class="reader-question">${esc(c.q)}</p><p>Hacelo delante del grupo.</p></div>`;return}
     if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">JURADO</span><h2>¿Lo logró?</h2><p>${esc(c.q)}</p>${judgeButtons()}</div>`;hookJudge();return}
   }
   if(c.kind==='social'&&game.phase==='challenge'){
     if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">${esc(c.title||'TE TOCA')}</span><h2>${ICONS[c.category]} ${esc(c.category)}</h2><p class="reader-question">${esc(c.q)}</p><p>Resolvelo hablando con el grupo.</p></div>`;return}
     if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">JURADO</span><h2>${esc(c.title||'DESAFÍO')}</h2><p>${esc(c.q)}</p>${judgeButtons()}</div>`;hookJudge();return}
   }
   if(c.kind==='buzzer'&&game.phase==='challenge'){
     if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS CONTROLÁS</span><h2>Buzzer</h2><p class="reader-question">${esc(c.q)}</p><p>Respuesta esperada: <b>${esc(c.answer)}</b></p></div>`;return}
     stage.innerHTML='<div class="phone-card"><h2>¿La sabés?</h2><button id="buzzBtn" class="buzzer">¡YO!</button></div>';$('#buzzBtn').onclick=()=>{navigator.vibrate?.([80,40,80]);sendIntent('buzz');$('#buzzBtn').disabled=true};return
   }
   if(game.phase==='buzz-answer'&&c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><h2>¡Fuiste primero!</h2><p>${esc(c.q)}</p><input id="freeAnswer" class="name-input" maxlength="100"><button id="sendFree" class="primary big setup-save">Responder</button></div>`;$('#sendFree').onclick=()=>sendIntent('buzzAnswer',{text:$('#freeAnswer').value});return}
   if(game.phase==='judge'&&c.reader===p.token){let response='';if(c.kind==='trivia')response=c.opts[c.selected]??'—';else response=c.freeAnswer||'—';stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS DECIDÍS</span><h2>¿Superó la prueba?</h2><p class="reader-question">${esc(response)}</p>${c.answer?`<p>Referencia: <b>${esc(c.answer)}</b></p>`:''}${c.hint?`<p>${esc(c.hint)}</p>`:''}${judgeButtons()}</div>`;hookJudge();return}
 }
 stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🐶</div><h2>${turn?'Angu está pensando…':`Turno de ${esc(active?.name||'otro jugador')}`}</h2><p>Mirá la pantalla grande.</p><p>${p.prizes.map(x=>ICONS[x]).join(' ')}</p></div>`
}

let scene,camera,renderer,loader,tokenGroup,diceMesh,boardObject=null;const tokenMeshes=new Map();
const SCENE={camera:{position:[.499,20.0403,14.2626],target:[.4074,.0137,.3682],fov:36},objects:{MESA:{p:[0,-.08,0],r:[-90,0,0],s:[2.701,2.701,2.701]},TABLERO:{p:[0,.2985,0],r:[0,0,0],s:[.7664,.7664,.7664]},CUCHA:{p:[-11.2508,.3856,-7.4391],r:[0,-33.589,0],s:[1.1885,1.1885,1.1885]},PLATO:{p:[13.2215,.3357,-5.6536],r:[180,-77.825,180],s:[1,1,1]},PELOTA:{p:[-6.977,.0551,3.3824],r:[0,0,0],s:[.75,.75,.75]},JUGUETE:{p:[4.056,.1706,6.1407],r:[0,20.054,0],s:[1.4484,1.4484,1.4484]}}};
function rad(v){return THREE.MathUtils.degToRad(v)}function applyCfg(o,c){o.position.fromArray(c.p);o.rotation.set(rad(c.r[0]),rad(c.r[1]),rad(c.r[2]));o.scale.fromArray(c.s)}
function init3D(){const canvas=$('#gameCanvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.shadowMap.enabled=true;scene=new THREE.Scene();scene.background=new THREE.Color(0x0b3154);camera=new THREE.PerspectiveCamera(36,2,.05,300);camera.position.fromArray(SCENE.camera.position);camera.lookAt(...SCENE.camera.target);scene.add(new THREE.HemisphereLight(0xfff0ce,0x183757,2.9));const sun=new THREE.DirectionalLight(0xffdf9a,3.7);sun.position.set(-8,16,10);sun.castShadow=true;scene.add(sun);loader=new GLTFLoader();tokenGroup=new THREE.Group();scene.add(tokenGroup);const tex=new THREE.TextureLoader().load('./FONDO.jpg');tex.colorSpace=THREE.SRGBColorSpace;const table=new THREE.Mesh(new THREE.PlaneGeometry(24,15),new THREE.MeshStandardMaterial({map:tex,roughness:.87}));applyCfg(table,SCENE.objects.MESA);scene.add(table);loadConfigured('./TABLERO.glb',SCENE.objects.TABLERO,o=>{boardObject=o;repositionAllTokens(true);positionDie()});loadConfigured('./CUCHA.glb',SCENE.objects.CUCHA);loadConfigured('./PLATO.glb',SCENE.objects.PLATO);loadConfigured('./PELOTA.glb',SCENE.objects.PELOTA);loadConfigured('./JUGUETE.glb',SCENE.objects.JUGUETE);loadDie();const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};addEventListener('resize',resize);resize();(function loop(){requestAnimationFrame(loop);renderer.render(scene,camera)})()}
function loadConfigured(url,cfg,onLoad){loader.load(url,g=>{const o=g.scene;applyCfg(o,cfg);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(n.material?.map)n.material.map.colorSpace=THREE.SRGBColorSpace}});scene.add(o);onLoad?.(o)},undefined,e=>console.warn(url,e))}
function normalizeDie(root,target=1.25){root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=new THREE.Vector3();b.getSize(s);root.scale.setScalar(target/(Math.max(s.x,s.y,s.z)||1));root.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(root),c=new THREE.Vector3();b2.getCenter(c);root.position.sub(c);root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(n.material?.map)n.material.map.colorSpace=THREE.SRGBColorSpace}})}
function positionDie(){if(!diceMesh)return;diceMesh.position.set(0,surfaceYAt(0,0)+.78,0)}
function loadDie(){loader.load('./dado.glb',g=>{diceMesh=new THREE.Group();const visual=g.scene;normalizeDie(visual,1.25);diceMesh.add(visual);scene.add(diceMesh);diceMesh.quaternion.fromArray(DICE_FACES[1]);positionDie()},undefined,e=>{console.warn('No se pudo cargar dado.glb, usando fallback',e);diceMesh=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1),new THREE.MeshStandardMaterial({color:0xf8f5df,roughness:.35}));scene.add(diceMesh);positionDie()})}
function normalizeVisual(root,target=.72){root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=new THREE.Vector3();b.getSize(s);root.scale.setScalar(target/(Math.max(s.x,s.y,s.z)||1));root.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(root),c=new THREE.Vector3();b2.getCenter(c);root.position.x-=c.x;root.position.z-=c.z;root.position.y-=b2.min.y}
function makePlastic(root,color){root.traverse(n=>{if(n.isMesh){n.material=new THREE.MeshPhysicalMaterial({color,roughness:.16,metalness:.02,clearcoat:.58,clearcoatRoughness:.17});n.castShadow=true;n.receiveShadow=true}})}
function surfaceYAt(x,z){if(!boardObject)return .49;const ray=new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0),0,50),hits=ray.intersectObject(boardObject,true);return hits.length?hits[0].point.y:.49}
function refresh3DTokens(){if(!tokenGroup||!loader)return;for(const[token,o]of [...tokenMeshes]){const p=game.players.find(x=>x.token===token);if(!p||!Number.isInteger(p.piece)||!Number.isInteger(p.color)){tokenGroup.remove(o);tokenMeshes.delete(token)}}game.players.forEach(p=>{if(!Number.isInteger(p.piece)||!Number.isInteger(p.color))return;const existing=tokenMeshes.get(p.token);if(existing&&existing.userData.piece===p.piece){existing.traverse(n=>{if(n.isMesh&&n.material?.color)n.material.color.set(COLORS[p.color])});return}if(existing){tokenGroup.remove(existing);tokenMeshes.delete(p.token)}const pc=PIECES[p.piece];loader.load(`./3dmodels/${pc.file}`,g=>{const wrap=new THREE.Group(),visual=g.scene;visual.rotation.y=Math.PI/2;normalizeVisual(visual,.72);visual.scale.multiplyScalar(pc.boost);makePlastic(visual,COLORS[p.color]);wrap.add(visual);wrap.userData.piece=p.piece;tokenGroup.add(wrap);tokenMeshes.set(p.token,wrap);repositionAllTokens(true)},undefined,()=>{})});repositionAllTokens(true)}
function footprint(o){o.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o),s=new THREE.Vector3();b.getSize(s);return Math.max(s.x,s.z,.4)}
function occupancyTargets(pos){const players=game.players.filter(p=>p.pos===pos&&tokenMeshes.has(p.token));if(!players.length)return new Map();const d=TRACK[pos],prev=TRACK[(pos+25)%26],next=TRACK[(pos+1)%26],t=new THREE.Vector3(next[0]-prev[0],0,next[1]-prev[1]).normalize(),r=new THREE.Vector3(-t.z,0,t.x),max=Math.max(.5,...players.map(p=>footprint(tokenMeshes.get(p.token)))),step=(max*1.12+.28)*.5,cols=players.length<=2?players.length:players.length<=4?2:3,rows=Math.ceil(players.length/cols),out=new Map();players.forEach((p,i)=>{const row=Math.floor(i/cols),col=i%cols,used=Math.min(cols,players.length-row*cols),a=(col-(used-1)/2)*step,b=(row-(rows-1)/2)*step,x=d[0]+t.x*a+r.x*b,z=d[1]+t.z*a+r.z*b;out.set(p.token,new THREE.Vector3(x,surfaceYAt(x,z)+.012,z))});return out}
function repositionAllTokens(snap=true){const positions=new Set(game.players.filter(p=>tokenMeshes.has(p.token)).map(p=>p.pos));positions.forEach(pos=>{for(const[token,target]of occupancyTargets(pos)){const o=tokenMeshes.get(token);if(snap)o.position.copy(target);else animateObject(o,target)}})}
function animateObject(o,target){const from=o.position.clone(),start=performance.now(),dur=260;(function tick(){const q=Math.min(1,(performance.now()-start)/dur),e=1-Math.pow(1-q,3);o.position.lerpVectors(from,target,e);o.position.y=THREE.MathUtils.lerp(from.y,target.y,e)+Math.sin(q*Math.PI)*.35;if(q<1)requestAnimationFrame(tick)})()}
function rollDice3D(value){if(!diceMesh)return;const start=performance.now(),dur=1000,base=diceMesh.position.clone(),target=new THREE.Quaternion().fromArray(DICE_FACES[value]).normalize(),spinX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.31),spinY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.39),spinZ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.27);let settleFrom=null;(function tick(){const t=Math.min(1,(performance.now()-start)/dur);if(t<.72){diceMesh.quaternion.multiply(spinX).multiply(spinY).multiply(spinZ);diceMesh.position.set(base.x+Math.sin(t*Math.PI*4)*.32,base.y+Math.sin(t*Math.PI)*2.2,base.z+Math.sin(t*Math.PI*3)*.22)}else{if(!settleFrom)settleFrom=diceMesh.quaternion.clone();const u=(t-.72)/.28,e=1-Math.pow(1-u,3);diceMesh.quaternion.copy(settleFrom).slerp(target,e);diceMesh.position.set(base.x,base.y+Math.sin((1-u)*Math.PI)*.18,base.z)}if(t<1)requestAnimationFrame(tick);else{diceMesh.quaternion.copy(target);diceMesh.position.copy(base)}})()}

console.log('Los juegos de Angu v0.4.0',{selfId,appId:APP_ID,transport:'Trystero/WebRTC P2P'});
