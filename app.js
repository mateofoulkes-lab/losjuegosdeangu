import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { joinRoom } from 'https://esm.sh/trystero@0.25.3/torrent';

const APP_ID = 'mateo-party-p2p-v1';
const VERSION = '0.1.0';
const COLORS = ['#3ba7ff','#ff4d3f','#ffd43b','#69d536','#a85dea','#ff8b2c'];
const COLOR_NAMES = ['Azul','Rojo','Amarillo','Verde','Violeta','Naranja'];
const CATEGORIES = ['mente','accion','palabra','creatividad','engano','grupo'];
const ICONS = {mente:'🧠',accion:'⚡',palabra:'💬',creatividad:'✏️',engano:'🎭',grupo:'👥'};
const TRACK_COUNT = 30;
const STORAGE_KEY = 'angu-player-token-v1';
const NAME_KEY = 'angu-player-name-v1';
const COLOR_KEY = 'angu-player-color-v1';
const $ = s => document.querySelector(s);
const views = {home:$('#homeView'),host:$('#hostView'),player:$('#playerView')};
let mode = 'home', roomCode = '', room = null, selfPeerId = '', roomActions = null;
let playerToken = localStorage.getItem(STORAGE_KEY) || crypto.randomUUID();
localStorage.setItem(STORAGE_KEY, playerToken);
let playerName = localStorage.getItem(NAME_KEY) || '';
let preferredColor = Number(localStorage.getItem(COLOR_KEY) || 0);
let hostToken = null;

const game = {
  phase:'lobby', turn:0, round:1, roll:null, winner:null,
  players:[], challenge:null, buzzerWinner:null, message:'',
  revision:0, startedAt:null
};

const trivia = [
  {q:'¿Cuál es el planeta más grande del sistema solar?',opts:['Marte','Júpiter','Saturno','Venus'],a:1},
  {q:'¿Qué animal puede dormir de pie?',opts:['Caballo','Perro','Conejo','Pingüino'],a:0},
  {q:'¿Cuántos lados tiene un hexágono?',opts:['5','6','7','8'],a:1},
  {q:'¿Cuál de estos es un mamífero?',opts:['Tiburón','Pulpo','Delfín','Pingüino'],a:2},
  {q:'¿Qué gas absorben principalmente las plantas?',opts:['Oxígeno','Helio','CO₂','Hidrógeno'],a:2},
  {q:'¿Qué océano es el más grande?',opts:['Atlántico','Índico','Pacífico','Ártico'],a:2}
];

function showView(name){ Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name)); mode=name; }
function cleanCode(v){return (v||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)}
function makeCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from({length:4},()=>a[Math.floor(Math.random()*a.length)]).join('')}
function setHostStatus(s){$('#hostStatus').textContent=s}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1700)}
function currentPlayer(){return game.players[game.turn % Math.max(1,game.players.length)]}
function me(){return game.players.find(p=>p.token===playerToken)}
function categoryFor(pos){return CATEGORIES[pos%CATEGORIES.length]}
function occupiedColors(){return new Set(game.players.map(p=>p.color))}

$('#roomCodeInput').addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('#createRoomBtn').onclick=()=>startHost(makeCode());
$('#joinRoomBtn').onclick=()=>{const c=cleanCode($('#roomCodeInput').value);if(c.length!==4)return;startPlayer(c)};
const urlRoom=new URLSearchParams(location.search).get('room');
if(urlRoom) $('#roomCodeInput').value=cleanCode(urlRoom);

function connect(code,isHost){
  roomCode=code;
  room=joinRoom({appId:APP_ID},code);
  selfPeerId=room.selfId || '';
  const [sendHello,onHello]=room.makeAction('hello');
  const [sendState,onState]=room.makeAction('state');
  const [sendIntent,onIntent]=room.makeAction('intent');
  const [sendPing,onPing]=room.makeAction('ping');
  roomActions={sendHello,onHello,sendState,onState,sendIntent,onIntent,sendPing,onPing};

  room.onPeerJoin(peerId=>{
    if(isHost){setHostStatus('conectado');setTimeout(()=>broadcastState(peerId),150)}
    else setTimeout(()=>sendHello({token:playerToken,name:playerName,color:preferredColor,kind:'player'}),120);
  });
  room.onPeerLeave(peerId=>{if(isHost){const p=game.players.find(x=>x.peerId===peerId);if(p){p.connected=false;renderHostPlayers();broadcastState();}}});

  onHello((data,peerId)=>{
    if(!isHost)return;
    let p=game.players.find(x=>x.token===data.token);
    if(!p){
      const taken=occupiedColors();let ci=Number.isInteger(data.color)&&!taken.has(data.color)?data.color:COLORS.findIndex((_,i)=>!taken.has(i));if(ci<0)ci=game.players.length%COLORS.length;
      p={token:data.token,peerId,name:(data.name||`Jugador ${game.players.length+1}`).slice(0,18),color:ci,pos:0,prizes:[],connected:true};
      game.players.push(p);toast(`${p.name} entró 🐾`);
    } else {p.peerId=peerId;p.connected=true;if(data.name)p.name=data.name.slice(0,18)}
    game.revision++;renderHostPlayers();updateHostLobby();refresh3DTokens();broadcastState();
  });

  onState((data,peerId)=>{
    if(isHost)return;
    hostToken=peerId;
    Object.assign(game,data);
    renderPhone();
  });

  onIntent((data,peerId)=>{if(isHost)handleIntent(data,peerId)});
  onPing((data,peerId)=>{ if(isHost) broadcastState(peerId); });

  if(!isHost){
    sendHello({token:playerToken,name:playerName,color:preferredColor,kind:'player'});
    setTimeout(()=>sendPing({want:'state'}),700);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){sendHello({token:playerToken,name:playerName,color:preferredColor,kind:'player'});sendPing({want:'state'});}});
    window.addEventListener('focus',()=>{sendHello({token:playerToken,name:playerName,color:preferredColor,kind:'player'});sendPing({want:'state'});});
  }
}

function safeState(){return JSON.parse(JSON.stringify(game))}
function broadcastState(peerId){if(!roomActions)return;roomActions.sendState(safeState(),peerId);renderHostPlayers();renderHostGameInfo();refresh3DTokens()}
function sendIntent(type,payload={}){roomActions?.sendIntent({type,token:playerToken,...payload},hostToken||undefined)}

async function startHost(code){
  showView('host');$('#hostRoomCode').textContent=code;$('#qrBox').textContent=`Abrí esta misma web en el celular e ingresá ${code}`;
  history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,true);init3D();renderHostPlayers();updateHostLobby();
  setHostStatus('esperando jugadores');
}
function startPlayer(code){showView('player');$('#phoneRoomCode').textContent=code;history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,false);renderPhone();}

function updateHostLobby(){
  const btn=$('#startGameBtn');btn.disabled=game.players.length<2;btn.textContent=game.players.length<2?'Esperando al menos 2 jugadores…':`Empezar con ${game.players.length} jugadores`;
}
$('#startGameBtn').onclick=()=>{
  if(game.players.length<2)return;game.phase='turn';game.turn=0;game.roll=null;game.challenge=null;game.startedAt=Date.now();game.revision++;
  $('#hostLobby').classList.add('hidden');$('#hostGameInfo').classList.remove('hidden');broadcastState();toast('¡Arranca la partida!');
};
$('#hostNextBtn').onclick=()=>advanceTurn();
$('#hostMoveBtn').onclick=()=>{const p=currentPlayer();if(p){p.pos=(p.pos+1)%TRACK_COUNT;game.revision++;broadcastState();animateToken(p.token)}};
$('#hostPrizeBtn').onclick=()=>{const p=currentPlayer();if(p)awardPrize(p,categoryFor(p.pos))};

function handleIntent(data,peerId){
  const p=game.players.find(x=>x.token===data.token);if(!p)return;
  p.peerId=peerId;p.connected=true;
  if(data.type==='profile'&&game.phase==='lobby'){
    p.name=(data.name||p.name).slice(0,18);
    const wants=Number(data.color);if(!game.players.some(x=>x.token!==p.token&&x.color===wants))p.color=wants;
    game.revision++;broadcastState();return;
  }
  const active=currentPlayer();
  if(data.type==='roll'&&game.phase==='turn'&&active?.token===p.token){
    const n=1+Math.floor(Math.random()*6);game.roll=n;game.phase='moving';game.revision++;broadcastState();rollDice3D(n);
    setTimeout(()=>movePlayerBy(p,n),900);return;
  }
  if(data.type==='answer'&&game.phase==='challenge'&&game.challenge?.kind==='trivia'&&game.challenge.answerer===p.token){
    game.challenge.selected=Number(data.choice);game.challenge.correct=game.challenge.selected===game.challenge.answer;game.phase='judge';game.revision++;broadcastState();return;
  }
  if(data.type==='judge'&&game.phase==='judge'&&game.challenge?.reader===p.token){resolveChallenge(!!data.ok);return;}
  if(data.type==='buzz'&&game.phase==='challenge'&&game.challenge?.kind==='buzzer'&&!game.buzzerWinner){game.buzzerWinner=p.token;game.challenge.answerer=p.token;game.phase='buzz-answer';game.revision++;broadcastState();return;}
  if(data.type==='buzzAnswer'&&game.phase==='buzz-answer'&&game.challenge?.answerer===p.token){game.challenge.freeAnswer=(data.text||'').slice(0,80);game.phase='judge';game.revision++;broadcastState();return;}
}

function movePlayerBy(p,n){
  const start=p.pos;let step=0;
  const timer=setInterval(()=>{
    step++;p.pos=(start+step)%TRACK_COUNT;game.revision++;broadcastState();animateToken(p.token);
    if(step>=n){clearInterval(timer);game.roll=null;setTimeout(()=>landed(p),400)}
  },280);
}
function landed(p){
  const other=game.players.find(x=>x.token!==p.token&&x.pos===p.pos);
  if(other){game.message=`${p.name} cayó junto a ${other.name}. ¡ROBO pendiente!`;toast('⚔️ ¡ROBO!');startRobber(p,other);return}
  startCategoryChallenge(p,categoryFor(p.pos));
}
function pickReader(answerer){const i=game.players.findIndex(p=>p.token===answerer.token);return game.players[(i+1)%game.players.length]}
function startCategoryChallenge(p,cat){
  const q=trivia[Math.floor(Math.random()*trivia.length)], reader=pickReader(p);
  if(cat==='mente'||cat==='palabra'){
    game.challenge={kind:'trivia',category:cat,q:q.q,opts:q.opts,answer:q.a,answerer:p.token,reader:reader.token};game.phase='challenge';
  } else if(cat==='accion'){
    game.challenge={kind:'buzzer',category:cat,q:q.q,answer:q.opts[q.a],reader:reader.token,answerer:null};game.buzzerWinner=null;game.phase='challenge';
  } else {
    const prompts={creatividad:'Inventá en 20 segundos el peor nombre posible para un superhéroe.',engano:'Decí dos cosas verdaderas y una mentira sobre vos. Que adivinen la falsa.',grupo:'¿Quién del grupo sobreviviría mejor a una isla desierta? Todos señalan a alguien.'};
    game.challenge={kind:'social',category:cat,q:prompts[cat],answerer:p.token,reader:reader.token};game.phase='challenge';
  }
  game.revision++;broadcastState();
}
function startRobber(attacker,defender){
  game.challenge={kind:'robber',category:'robo',q:`${attacker.name} desafía a ${defender.name}. Por ahora: piedra, papel o tijera a una mano; el admin decide el ganador.`,answerer:attacker.token,reader:defender.token,attacker:attacker.token,defender:defender.token};
  game.phase='challenge';game.revision++;broadcastState();
}
function resolveChallenge(ok){
  const c=game.challenge, p=game.players.find(x=>x.token===c.answerer);
  if(ok&&p&&c.category!=='robo') awardPrize(p,c.category,false);
  game.message=ok?'¡Correcto! 🎉':'No esta vez 😅';game.phase='result';game.revision++;broadcastState();
  setTimeout(()=>advanceTurn(),1800);
}
function awardPrize(p,cat,doBroadcast=true){if(!p.prizes.includes(cat))p.prizes.push(cat);if(p.prizes.length>=CATEGORIES.length){game.winner=p.token;game.phase='winner'}game.revision++;if(doBroadcast)broadcastState()}
function advanceTurn(){if(game.winner)return;game.turn=(game.turn+1)%game.players.length;if(game.turn===0)game.round++;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.revision++;broadcastState();}

function renderHostPlayers(){
  const rail=$('#playerRail');rail.innerHTML='';game.players.forEach((p,i)=>{const d=document.createElement('div');d.className='player-pill';d.innerHTML=`<span class="color-dot" style="background:${COLORS[p.color]}"></span><b>${escapeHtml(p.name)}</b><span>${p.connected?'':'💤'}</span><span class="prizes">${p.prizes.map(x=>ICONS[x]||'⬡').join('')}</span>`;rail.append(d)});updateHostLobby();}
function renderHostGameInfo(){
  const el=$('#hostGameInfo');if(game.phase==='lobby'){el.classList.add('hidden');return}el.classList.remove('hidden');
  if(game.phase==='winner'){const w=game.players.find(p=>p.token===game.winner);el.innerHTML=`<h2>🏆 ${escapeHtml(w?.name||'Ganador')}</h2><p>¡Consiguió las seis arandelas!</p>`;return}
  const p=currentPlayer();let html=`<span class="turn-badge">RONDA ${game.round}</span><h2>${escapeHtml(p?.name||'')}</h2><p>${game.phase==='turn'?'Es su turno. Tirará el dado desde el celular.':''}</p>`;
  if(game.phase==='moving')html+=`<p>🎲 Moviendo ${game.roll} casillas…</p>`;
  if(game.challenge)html+=`<p><b>${ICONS[game.challenge.category]||'⚔️'} ${game.challenge.category.toUpperCase()}</b></p><p>${escapeHtml(game.challenge.q)}</p>`;
  if(game.phase==='result')html+=`<h2>${escapeHtml(game.message)}</h2>`;
  el.innerHTML=html;
}
function renderPhone(){
  const stage=$('#phoneStage'), p=me();$('#identityText').textContent=p?`${p.name} · ${COLOR_NAMES[p.color]}`:'Jugador';
  if(!p){
    stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🐾</div><h2>Entrando a la sala…</h2><p>Angu está avisándole al tablero.</p></div>`;return;
  }
  if(game.phase==='lobby'){
    const taken=occupiedColors();stage.innerHTML=`<div class="phone-card"><h2>Tu ficha</h2><input id="nameEdit" class="name-input" maxlength="18" value="${escapeAttr(p.name)}" placeholder="Tu nombre"><div class="palette">${COLORS.map((c,i)=>`<button class="color-pick ${p.color===i?'selected':''}" data-color="${i}" ${taken.has(i)&&p.color!==i?'disabled':''} style="background:${c}"></button>`).join('')}</div><button id="saveProfile" class="primary big">Listo</button><p>Esperando que Angu arranque la partida…</p></div>`;
    stage.querySelectorAll('.color-pick').forEach(b=>b.onclick=()=>{preferredColor=Number(b.dataset.color);stage.querySelectorAll('.color-pick').forEach(x=>x.classList.toggle('selected',x===b))});
    $('#saveProfile').onclick=()=>{playerName=($('#nameEdit').value||p.name).trim().slice(0,18);localStorage.setItem(NAME_KEY,playerName);localStorage.setItem(COLOR_KEY,preferredColor);sendIntent('profile',{name:playerName,color:preferredColor});};return;
  }
  if(game.phase==='winner'){const w=game.players.find(x=>x.token===game.winner);stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🏆</div><h2>${w?.token===p.token?'¡GANASTE!':`${escapeHtml(w?.name||'')} ganó`}</h2><p>Angu está orgullosa. Probablemente.</p></div>`;return}
  const active=currentPlayer(), isTurn=active?.token===p.token, c=game.challenge;
  if(game.phase==='turn'&&isTurn){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">TU TURNO</span><h2>¡Tirá el dado!</h2><button id="diceBtn" class="dice-button">🎲</button></div>`;$('#diceBtn').onclick=()=>{navigator.vibrate?.(60);sendIntent('roll');$('#diceBtn').disabled=true};return}
  if(game.phase==='challenge'&&c?.kind==='trivia'){
    if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS LEÉS</span><h2>${ICONS[c.category]} Pregunta</h2><p class="reader-question">${escapeHtml(c.q)}</p><p class="muted">La respuesta correcta no se muestra todavía.</p></div>`;return}
    if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">RESPONDÉ</span><h2>${escapeHtml(c.q)}</h2><div class="answer-grid">${c.opts.map((o,i)=>`<button class="answer-btn" data-a="${i}">${escapeHtml(o)}</button>`).join('')}</div></div>`;stage.querySelectorAll('.answer-btn').forEach(b=>b.onclick=()=>{sendIntent('answer',{choice:Number(b.dataset.a)});stage.querySelectorAll('.answer-btn').forEach(x=>x.disabled=true)});return}
  }
  if(game.phase==='challenge'&&c?.kind==='buzzer'){
    if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS LEÉS</span><h2>Todos juegan</h2><p class="reader-question">${escapeHtml(c.q)}</p><p>Respuesta: <b>${escapeHtml(c.answer)}</b></p></div>`;return}
    stage.innerHTML=`<div class="phone-card"><h2>¿La sabés?</h2><button id="buzzBtn" class="buzzer">¡YO!</button></div>`;$('#buzzBtn').onclick=()=>{navigator.vibrate?.([80,40,80]);sendIntent('buzz');$('#buzzBtn').disabled=true};return
  }
  if(game.phase==='buzz-answer'&&c?.answerer===p.token){stage.innerHTML=`<div class="phone-card"><h2>¡Fuiste primero!</h2><p>${escapeHtml(c.q)}</p><input id="freeAnswer" class="name-input" placeholder="Tu respuesta"><button id="sendFree" class="primary big">Responder</button></div>`;$('#sendFree').onclick=()=>sendIntent('buzzAnswer',{text:$('#freeAnswer').value});return}
  if(game.phase==='judge'&&c?.reader===p.token){const answerText=c.kind==='trivia'?c.opts[c.selected]:c.freeAnswer||'';stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS DECIDÍS</span><h2>¿Respondió bien?</h2><p class="reader-question">${escapeHtml(answerText)}</p><div class="judge-row"><button id="badJudge" class="bad">✕ NO</button><button id="okJudge" class="ok">✓ SÍ</button></div></div>`;$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false});return}
  if(game.phase==='challenge'&&c?.kind==='social'&&(c.answerer===p.token||c.reader===p.token)){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">${c.answerer===p.token?'TE TOCA':'ACOMPAÑÁ'}</span><h2>${ICONS[c.category]} ${c.category}</h2><p class="reader-question">${escapeHtml(c.q)}</p>${c.reader===p.token?'<div class="judge-row"><button id="badJudge" class="bad">No ganó</button><button id="okJudge" class="ok">Ganó</button></div>':''}</div>`;if(c.reader===p.token){$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false})}return}
  if(game.phase==='challenge'&&c?.kind==='robber'&&(c.attacker===p.token||c.defender===p.token)){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">⚔️ ROBO</span><h2>¡Duelo!</h2><p class="reader-question">${escapeHtml(c.q)}</p>${c.reader===p.token?'<div class="judge-row"><button id="badJudge" class="bad">Defiende</button><button id="okJudge" class="ok">Atacante gana</button></div>':''}</div>`;if(c.reader===p.token){$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false})}return}
  stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🐶</div><h2>${isTurn?'Angu está pensando…':`Turno de ${escapeHtml(active?.name||'otro jugador')}`}</h2><p>${game.phase==='moving'?'El dado ya está rodando en la TV.':'Mirá la pantalla grande.'}</p><p>${p.prizes.map(x=>`${ICONS[x]} `).join('')}</p></div>`;
}

function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function escapeAttr(s=''){return escapeHtml(s)}

// ---------- THREE.JS BOARD ----------
let scene, camera, renderer, loader, boardRoot, tokenGroup, diceMesh, decorGroup;
const tokenMeshes=new Map();
function init3D(){
  const canvas=$('#gameCanvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0b3154);camera=new THREE.PerspectiveCamera(36,2,0.1,100);camera.position.set(0,13,15.5);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xfff2cf,0x234160,2.3));const sun=new THREE.DirectionalLight(0xffe1a5,3);sun.position.set(-5,10,7);sun.castShadow=true;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(8.7,8.7,.55,64),new THREE.MeshStandardMaterial({color:0x8a5127,roughness:.78}));floor.scale.set(1.35,1,.92);floor.position.y=-.48;floor.receiveShadow=true;scene.add(floor);
  boardRoot=new THREE.Group();tokenGroup=new THREE.Group();decorGroup=new THREE.Group();scene.add(boardRoot,tokenGroup,decorGroup);loader=new GLTFLoader();
  loadGLB('./TABLERO.glb',boardRoot,{scale:7.2,y:0});
  loadDecor('./CUCHA.glb',[-7.4,0,-2.9],1.7,-.35);loadDecor('./PLATO.glb',[7.3,0,-2.2],1.0,.15);loadDecor('./PELOTA.glb',[6.6,0,3.6],.75,0);loadDecor('./JUGUETE.glb',[-6.7,0,3.8],1.0,.35);
  diceMesh=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.25,1.25),new THREE.MeshStandardMaterial({color:0xf8f5df,roughness:.35}));diceMesh.position.set(0,.9,0);diceMesh.castShadow=true;scene.add(diceMesh);
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};addEventListener('resize',resize);resize();
  (function loop(t){requestAnimationFrame(loop);decorGroup.rotation.y=Math.sin(t*.0002)*.006;renderer.render(scene,camera)})(0);
}
function loadGLB(url,parent,{scale=1,y=0}={}){loader.load(url,g=>{const o=g.scene;o.scale.setScalar(scale);o.position.y=y;o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});parent.add(o)},undefined,()=>{})}
function loadDecor(url,pos,scale,ry){loader.load(url,g=>{const o=g.scene;o.position.set(...pos);o.position.y=.05;o.scale.setScalar(scale);o.rotation.y=ry;o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});decorGroup.add(o)},undefined,()=>{})}
function trackPos(idx){const a=-Math.PI/2+(idx/TRACK_COUNT)*Math.PI*2;return new THREE.Vector3(Math.cos(a)*6.15,.43,Math.sin(a)*3.85)}
function refresh3DTokens(){if(!tokenGroup||!loader)return;game.players.forEach(p=>{if(!tokenMeshes.has(p.token)){loader.load('./pin.glb',g=>{const o=g.scene;o.scale.setScalar(.42);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.material=n.material.clone();n.material.color?.set(COLORS[p.color])}});tokenGroup.add(o);tokenMeshes.set(p.token,o);positionToken(p,true)},undefined,()=>makeFallbackToken(p))}else positionToken(p,true)});}
function makeFallbackToken(p){const o=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,.7,18),new THREE.MeshStandardMaterial({color:COLORS[p.color]}));o.castShadow=true;tokenGroup.add(o);tokenMeshes.set(p.token,o);positionToken(p,true)}
function positionToken(p,snap=false){const o=tokenMeshes.get(p.token);if(!o)return;const v=trackPos(p.pos);const same=game.players.filter(x=>x.pos===p.pos);const rank=same.findIndex(x=>x.token===p.token);v.x+=(rank-(same.length-1)/2)*.28;v.z+=(rank%2)*.18;if(snap)o.position.copy(v);else animateObjectTo(o,v)}
function animateToken(token){const p=game.players.find(x=>x.token===token),o=tokenMeshes.get(token);if(!p||!o)return;const v=trackPos(p.pos);animateObjectTo(o,v)}
function animateObjectTo(o,target){const from=o.position.clone(),start=performance.now(),dur=260;const tick=()=>{const t=Math.min(1,(performance.now()-start)/dur),e=1-Math.pow(1-t,3);o.position.lerpVectors(from,target,e);o.position.y=target.y+Math.sin(t*Math.PI)*.45;if(t<1)requestAnimationFrame(tick)};tick()}
function rollDice3D(value){if(!diceMesh)return;const start=performance.now(),base=diceMesh.position.clone();const tick=()=>{const t=Math.min(1,(performance.now()-start)/800);diceMesh.rotation.x+=.23;diceMesh.rotation.y+=.31;diceMesh.position.y=.9+Math.sin(t*Math.PI)*2.1;if(t<1)requestAnimationFrame(tick);else{diceMesh.position.copy(base);toast(`🎲 ${value}`)}};tick()}
