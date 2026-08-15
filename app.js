import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { joinRoom, selfId } from 'https://esm.sh/trystero@0.25.3';

// Reusa exactamente el appId que ya funcionó en la prueba multiplayer de Soquetín.
const APP_ID='soquetin-multiplayer-probe-2026';
const COLORS=['#3ba7ff','#ff4d3f','#ffd43b','#69d536','#a85dea','#ff8b2c'];
const COLOR_NAMES=['Azul','Rojo','Amarillo','Verde','Violeta','Naranja'];
const CATEGORIES=['mente','accion','palabra','creatividad','engano','grupo'];
const ICONS={mente:'🧠',accion:'⚡',palabra:'💬',creatividad:'✏️',engano:'🎭',grupo:'👥'};
const TRACK_COUNT=30;
const $=s=>document.querySelector(s);
const views={home:$('#homeView'),host:$('#hostView'),player:$('#playerView')};
const tokenKey='angu-player-token-v1',nameKey='angu-player-name-v1',colorKey='angu-player-color-v1';
let playerToken=localStorage.getItem(tokenKey)||crypto.randomUUID();localStorage.setItem(tokenKey,playerToken);
let playerName=localStorage.getItem(nameKey)||'';
let preferredColor=Number(localStorage.getItem(colorKey)||0);
let room=null,actions=null,roomCode='',isHost=false,hostPeer=null;

const game={phase:'lobby',turn:0,round:1,roll:null,winner:null,players:[],challenge:null,buzzerWinner:null,message:'',revision:0};
const trivia=[
 {q:'¿Cuál es el planeta más grande del sistema solar?',opts:['Marte','Júpiter','Saturno','Venus'],a:1},
 {q:'¿Qué animal puede dormir de pie?',opts:['Caballo','Perro','Conejo','Pingüino'],a:0},
 {q:'¿Cuántos lados tiene un hexágono?',opts:['5','6','7','8'],a:1},
 {q:'¿Cuál de estos es un mamífero?',opts:['Tiburón','Pulpo','Delfín','Pingüino'],a:2},
 {q:'¿Qué gas absorben principalmente las plantas?',opts:['Oxígeno','Helio','CO₂','Hidrógeno'],a:2},
 {q:'¿Qué océano es el más grande?',opts:['Atlántico','Índico','Pacífico','Ártico'],a:2}
];

const cleanCode=v=>(v||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const makeCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from({length:4},()=>a[Math.floor(Math.random()*a.length)]).join('')};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const me=()=>game.players.find(p=>p.token===playerToken);
const current=()=>game.players[game.turn%Math.max(1,game.players.length)];
const categoryFor=pos=>CATEGORIES[pos%CATEGORIES.length];
const showView=name=>Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name));
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1500)}
function setHostStatus(t){$('#hostStatus').textContent=t}

$('#roomCodeInput').addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('#createRoomBtn').onclick=()=>startHost(makeCode());
$('#joinRoomBtn').onclick=()=>{const c=cleanCode($('#roomCodeInput').value);if(c.length===4)startPlayer(c)};
const incoming=cleanCode(new URLSearchParams(location.search).get('room'));if(incoming)$('#roomCodeInput').value=incoming;

function connect(code,host){
 isHost=host;roomCode=code;
 room=joinRoom({appId:APP_ID},code,{onJoinError:({error})=>console.warn('Trystero join error',error)});
 actions={hello:room.makeAction('angu-hello-v1'),state:room.makeAction('angu-state-v1'),intent:room.makeAction('angu-intent-v1'),ping:room.makeAction('angu-ping-v1')};
 room.onPeerJoin=peerId=>{
   if(isHost){setHostStatus('conectado');setTimeout(()=>sendState(peerId),120)}
   else {hostPeer=peerId;setTimeout(()=>sendHello(peerId),100)}
 };
 room.onPeerLeave=peerId=>{
   if(isHost){const p=game.players.find(x=>x.peerId===peerId);if(p){p.connected=false;game.revision++;renderHost();sendState()}}
   else if(hostPeer===peerId){hostPeer=null;$('#phoneConn').style.color='#ffb44d'}
 };
 actions.hello.onMessage=(d,{peerId})=>{
   if(!isHost||!d?.token)return;
   let p=game.players.find(x=>x.token===d.token);
   if(!p){
     const used=new Set(game.players.map(x=>x.color));let color=Number(d.color);if(!Number.isInteger(color)||used.has(color))color=COLORS.findIndex((_,i)=>!used.has(i));if(color<0)color=game.players.length%COLORS.length;
     p={token:d.token,peerId,name:(d.name||`Jugador ${game.players.length+1}`).slice(0,18),color,pos:0,prizes:[],connected:true};game.players.push(p);toast(`${p.name} entró 🐾`);
   }else{p.peerId=peerId;p.connected=true;if(d.name)p.name=d.name.slice(0,18)}
   game.revision++;renderHost();refresh3DTokens();sendState();
 };
 actions.state.onMessage=(d,{peerId})=>{if(isHost||!d)return;hostPeer=peerId;Object.assign(game,d);$('#phoneConn').style.color='#50e38a';renderPhone()};
 actions.intent.onMessage=(d,{peerId})=>{if(isHost)handleIntent(d,peerId)};
 actions.ping.onMessage=(d,{peerId})=>{if(isHost)sendState(peerId)};
 if(!isHost){sendHello();setTimeout(()=>actions.ping.send({want:'state'}).catch(()=>{}),800)}
}
function sendHello(target){if(!actions)return;actions.hello.send({token:playerToken,name:playerName,color:preferredColor},target?{target}:undefined).catch(()=>{})}
function sendState(target){if(!isHost||!actions)return;actions.state.send(JSON.parse(JSON.stringify(game)),target?{target}:undefined).catch(()=>{})}
function sendIntent(type,payload={}){if(!actions)return;actions.intent.send({type,token:playerToken,...payload},hostPeer?{target:hostPeer}:undefined).catch(()=>{})}

// Nunca navegamos a otra página ni destruimos la sala: solo cambiamos el contenido de phoneStage.
// Al volver de background/foco, el mismo token lógico recupera su jugador aunque Trystero regenere el peer.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!isHost&&room){sendHello();actions.ping.send({want:'state'}).catch(()=>{})}});
window.addEventListener('focus',()=>{if(!isHost&&room){sendHello();actions.ping.send({want:'state'}).catch(()=>{})}});
setInterval(()=>{if(!isHost&&room&&!document.hidden){sendHello();actions.ping.send({want:'state'}).catch(()=>{})}},12000);

function startHost(code){showView('host');$('#hostRoomCode').textContent=code;$('#qrBox').textContent=`Abrí esta misma web en el celular e ingresá ${code}`;history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,true);init3D();renderHost();setHostStatus('esperando jugadores')}
function startPlayer(code){showView('player');$('#phoneRoomCode').textContent=code;history.replaceState(null,'',`${location.pathname}?room=${code}`);connect(code,false);renderPhone()}

function renderHost(){
 const rail=$('#playerRail');rail.innerHTML='';
 game.players.forEach(p=>{const d=document.createElement('div');d.className='player-pill';d.innerHTML=`<span class="color-dot" style="background:${COLORS[p.color]}"></span><b>${esc(p.name)}</b><span>${p.connected?'':'💤'}</span><span class="prizes">${p.prizes.map(x=>ICONS[x]).join('')}</span>`;rail.append(d)});
 const start=$('#startGameBtn');start.disabled=game.players.length<2;start.textContent=game.players.length<2?'Esperando al menos 2 jugadores…':`Empezar con ${game.players.length} jugadores`;
 renderHostInfo();refresh3DTokens();
}
function renderHostInfo(){
 const lobby=$('#hostLobby'),info=$('#hostGameInfo');
 if(game.phase==='lobby'){lobby.classList.remove('hidden');info.classList.add('hidden');return}
 lobby.classList.add('hidden');info.classList.remove('hidden');
 if(game.phase==='winner'){const w=game.players.find(p=>p.token===game.winner);info.innerHTML=`<h2>🏆 ${esc(w?.name)}</h2><p>¡Consiguió las seis arandelas!</p>`;return}
 const p=current();let h=`<span class="turn-badge">RONDA ${game.round}</span><h2>${esc(p?.name)}</h2>`;
 if(game.phase==='turn')h+='<p>Está por tirar el dado desde su celular.</p>';
 if(game.phase==='moving')h+=`<p>🎲 Avanza ${game.roll} casillas…</p>`;
 if(game.challenge)h+=`<p><b>${ICONS[game.challenge.category]||'⚔️'} ${esc(game.challenge.category).toUpperCase()}</b></p><p>${esc(game.challenge.q)}</p>`;
 if(game.phase==='result')h+=`<h2>${esc(game.message)}</h2>`;info.innerHTML=h;
}
$('#startGameBtn').onclick=()=>{if(game.players.length<2)return;game.phase='turn';game.turn=0;game.round=1;game.revision++;renderHost();sendState();toast('¡Arranca la partida!')};
$('#hostNextBtn').onclick=advanceTurn;
$('#hostMoveBtn').onclick=()=>{const p=current();if(p){p.pos=(p.pos+1)%TRACK_COUNT;game.revision++;renderHost();sendState();animateToken(p.token)}};
$('#hostPrizeBtn').onclick=()=>{const p=current();if(p)awardPrize(p,categoryFor(p.pos))};

function handleIntent(d,peerId){
 const p=game.players.find(x=>x.token===d?.token);if(!p)return;p.peerId=peerId;p.connected=true;
 if(d.type==='profile'&&game.phase==='lobby'){
   p.name=(d.name||p.name).trim().slice(0,18);const wants=Number(d.color);if(!game.players.some(x=>x.token!==p.token&&x.color===wants))p.color=wants;game.revision++;renderHost();sendState();return;
 }
 const active=current();
 if(d.type==='roll'&&game.phase==='turn'&&active?.token===p.token){const n=1+Math.floor(Math.random()*6);game.roll=n;game.phase='moving';game.revision++;renderHost();sendState();rollDice3D(n);setTimeout(()=>moveBy(p,n),850);return}
 const c=game.challenge;
 if(d.type==='answer'&&game.phase==='challenge'&&c?.kind==='trivia'&&c.answerer===p.token){c.selected=Number(d.choice);c.correct=c.selected===c.answer;game.phase='judge';game.revision++;renderHost();sendState();return}
 if(d.type==='judge'&&game.phase==='judge'&&c?.reader===p.token){resolveChallenge(!!d.ok);return}
 if(d.type==='buzz'&&game.phase==='challenge'&&c?.kind==='buzzer'&&!game.buzzerWinner){game.buzzerWinner=p.token;c.answerer=p.token;game.phase='buzz-answer';game.revision++;renderHost();sendState();return}
 if(d.type==='buzzAnswer'&&game.phase==='buzz-answer'&&c?.answerer===p.token){c.freeAnswer=(d.text||'').slice(0,80);game.phase='judge';game.revision++;renderHost();sendState()}
}
function moveBy(p,n){const start=p.pos;let s=0;const timer=setInterval(()=>{s++;p.pos=(start+s)%TRACK_COUNT;game.revision++;renderHost();sendState();animateToken(p.token);if(s>=n){clearInterval(timer);game.roll=null;setTimeout(()=>landed(p),350)}},260)}
function landed(p){const other=game.players.find(x=>x.token!==p.token&&x.pos===p.pos);if(other){startRobber(p,other);return}startCategory(p,categoryFor(p.pos))}
function readerFor(p){const i=game.players.findIndex(x=>x.token===p.token);return game.players[(i+1)%game.players.length]}
function startCategory(p,cat){
 const q=trivia[Math.floor(Math.random()*trivia.length)],r=readerFor(p);
 if(cat==='mente'||cat==='palabra')game.challenge={kind:'trivia',category:cat,q:q.q,opts:q.opts,answer:q.a,answerer:p.token,reader:r.token};
 else if(cat==='accion'){game.challenge={kind:'buzzer',category:cat,q:q.q,answer:q.opts[q.a],answerer:null,reader:r.token};game.buzzerWinner=null}
 else {const prompts={creatividad:'Inventá en 20 segundos el peor nombre posible para un superhéroe.',engano:'Decí dos cosas verdaderas y una mentira sobre vos. Que adivinen la falsa.',grupo:'¿Quién del grupo sobreviviría mejor a una isla desierta? Todos señalan a alguien.'};game.challenge={kind:'social',category:cat,q:prompts[cat],answerer:p.token,reader:r.token}}
 game.phase='challenge';game.revision++;renderHost();sendState();
}
function startRobber(a,b){game.challenge={kind:'robber',category:'robo',q:`${a.name} cayó sobre ${b.name}. ¡Se activa el ROBADOR! Por ahora juegan piedra, papel o tijera; ${b.name} marca quién ganó.`,answerer:a.token,reader:b.token,attacker:a.token,defender:b.token};game.phase='challenge';game.revision++;renderHost();sendState();toast('⚔️ ¡ROBO!')}
function resolveChallenge(ok){const c=game.challenge,p=game.players.find(x=>x.token===c?.answerer);if(ok&&p&&c.category!=='robo')awardPrize(p,c.category,false);game.message=ok?'¡Correcto! 🎉':'No esta vez 😅';game.phase='result';game.revision++;renderHost();sendState();setTimeout(advanceTurn,1700)}
function awardPrize(p,cat,broadcast=true){if(!p.prizes.includes(cat))p.prizes.push(cat);if(p.prizes.length>=CATEGORIES.length){game.winner=p.token;game.phase='winner'}game.revision++;renderHost();if(broadcast)sendState()}
function advanceTurn(){if(game.winner||!game.players.length)return;game.turn=(game.turn+1)%game.players.length;if(game.turn===0)game.round++;game.phase='turn';game.challenge=null;game.buzzerWinner=null;game.roll=null;game.message='';game.revision++;renderHost();sendState()}

function renderPhone(){
 const stage=$('#phoneStage'),p=me();$('#identityText').textContent=p?`${p.name} · ${COLOR_NAMES[p.color]}`:'Jugador';
 if(!p){stage.innerHTML='<div class="phone-card"><div class="wait-icon">🐾</div><h2>Entrando a la sala…</h2><p>Angu está avisándole al tablero.</p></div>';return}
 if(game.phase==='lobby'){
   const used=new Set(game.players.map(x=>x.color));stage.innerHTML=`<div class="phone-card"><h2>Tu ficha</h2><input id="nameEdit" class="name-input" maxlength="18" value="${esc(p.name)}" placeholder="Tu nombre"><div class="palette">${COLORS.map((c,i)=>`<button class="color-pick ${p.color===i?'selected':''}" data-color="${i}" ${used.has(i)&&p.color!==i?'disabled':''} style="background:${c}"></button>`).join('')}</div><button id="saveProfile" class="primary big">Listo</button><p>Seguís conectado aunque esta pantalla cambie durante la partida.</p></div>`;
   stage.querySelectorAll('.color-pick').forEach(b=>b.onclick=()=>{preferredColor=Number(b.dataset.color);stage.querySelectorAll('.color-pick').forEach(x=>x.classList.toggle('selected',x===b))});
   $('#saveProfile').onclick=()=>{playerName=($('#nameEdit').value||p.name).trim().slice(0,18);localStorage.setItem(nameKey,playerName);localStorage.setItem(colorKey,preferredColor);sendIntent('profile',{name:playerName,color:preferredColor})};return;
 }
 if(game.phase==='winner'){const w=game.players.find(x=>x.token===game.winner);stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🏆</div><h2>${w?.token===p.token?'¡GANASTE!':`${esc(w?.name)} ganó`}</h2><p>Angu está orgullosa. Probablemente.</p></div>`;return}
 const active=current(),turn=active?.token===p.token,c=game.challenge;
 if(game.phase==='turn'&&turn){stage.innerHTML='<div class="phone-card"><span class="turn-badge">TU TURNO</span><h2>¡Tirá el dado!</h2><button id="diceBtn" class="dice-button">🎲</button></div>';$('#diceBtn').onclick=()=>{navigator.vibrate?.(60);sendIntent('roll');$('#diceBtn').disabled=true};return}
 if(game.phase==='challenge'&&c?.kind==='trivia'){
   if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS LEÉS</span><h2>${ICONS[c.category]} Pregunta</h2><p class="reader-question">${esc(c.q)}</p></div>`;return}
   if(c.answerer===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">RESPONDÉ</span><h2>${esc(c.q)}</h2><div class="answer-grid">${c.opts.map((o,i)=>`<button class="answer-btn" data-a="${i}">${esc(o)}</button>`).join('')}</div></div>`;stage.querySelectorAll('.answer-btn').forEach(b=>b.onclick=()=>{sendIntent('answer',{choice:Number(b.dataset.a)});stage.querySelectorAll('.answer-btn').forEach(x=>x.disabled=true)});return}
 }
 if(game.phase==='challenge'&&c?.kind==='buzzer'){
   if(c.reader===p.token){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS LEÉS</span><h2>Todos juegan</h2><p class="reader-question">${esc(c.q)}</p><p>Respuesta: <b>${esc(c.answer)}</b></p></div>`;return}
   stage.innerHTML='<div class="phone-card"><h2>¿La sabés?</h2><button id="buzzBtn" class="buzzer">¡YO!</button></div>';$('#buzzBtn').onclick=()=>{navigator.vibrate?.([80,40,80]);sendIntent('buzz');$('#buzzBtn').disabled=true};return
 }
 if(game.phase==='buzz-answer'&&c?.answerer===p.token){stage.innerHTML=`<div class="phone-card"><h2>¡Fuiste primero!</h2><p>${esc(c.q)}</p><input id="freeAnswer" class="name-input" placeholder="Tu respuesta"><button id="sendFree" class="primary big">Responder</button></div>`;$('#sendFree').onclick=()=>sendIntent('buzzAnswer',{text:$('#freeAnswer').value});return}
 if(game.phase==='judge'&&c?.reader===p.token){const t=c.kind==='trivia'?c.opts[c.selected]:c.freeAnswer||'';stage.innerHTML=`<div class="phone-card"><span class="turn-badge">VOS DECIDÍS</span><h2>¿Respondió bien?</h2><p class="reader-question">${esc(t)}</p><div class="judge-row"><button id="badJudge" class="bad">✕ NO</button><button id="okJudge" class="ok">✓ SÍ</button></div></div>`;$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false});return}
 if(game.phase==='challenge'&&c?.kind==='social'&&(c.answerer===p.token||c.reader===p.token)){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">${c.answerer===p.token?'TE TOCA':'JURADO'}</span><h2>${ICONS[c.category]} ${esc(c.category)}</h2><p class="reader-question">${esc(c.q)}</p>${c.reader===p.token?'<div class="judge-row"><button id="badJudge" class="bad">No ganó</button><button id="okJudge" class="ok">Ganó</button></div>':''}</div>`;if(c.reader===p.token){$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false})}return}
 if(game.phase==='challenge'&&c?.kind==='robber'&&(c.attacker===p.token||c.defender===p.token)){stage.innerHTML=`<div class="phone-card"><span class="turn-badge">⚔️ ROBO</span><h2>¡Duelo!</h2><p class="reader-question">${esc(c.q)}</p>${c.reader===p.token?'<div class="judge-row"><button id="badJudge" class="bad">Defiende</button><button id="okJudge" class="ok">Atacante gana</button></div>':''}</div>`;if(c.reader===p.token){$('#okJudge').onclick=()=>sendIntent('judge',{ok:true});$('#badJudge').onclick=()=>sendIntent('judge',{ok:false})}return}
 stage.innerHTML=`<div class="phone-card"><div class="wait-icon">🐶</div><h2>${turn?'Angu está pensando…':`Turno de ${esc(active?.name)}`}</h2><p>Mirá la pantalla grande.</p><p>${p.prizes.map(x=>ICONS[x]).join(' ')}</p></div>`;
}

// ---------- THREE.JS ----------
let scene,camera,renderer,loader,boardRoot,tokenGroup,diceMesh,decorGroup;const tokenMeshes=new Map();
function init3D(){
 const canvas=$('#gameCanvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x0b3154);camera=new THREE.PerspectiveCamera(36,2,.1,100);camera.position.set(0,13,15.5);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xfff2cf,0x234160,2.3));const sun=new THREE.DirectionalLight(0xffe1a5,3);sun.position.set(-5,10,7);sun.castShadow=true;scene.add(sun);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(8.7,8.7,.55,64),new THREE.MeshStandardMaterial({color:0x8a5127,roughness:.78}));floor.scale.set(1.35,1,.92);floor.position.y=-.48;floor.receiveShadow=true;scene.add(floor);
 boardRoot=new THREE.Group();tokenGroup=new THREE.Group();decorGroup=new THREE.Group();scene.add(boardRoot,tokenGroup,decorGroup);loader=new GLTFLoader();loadGLB('./TABLERO.glb',boardRoot,7.2);loadDecor('./CUCHA.glb',[-7.4,.05,-2.9],1.7,-.35);loadDecor('./PLATO.glb',[7.3,.05,-2.2],1,.15);loadDecor('./PELOTA.glb',[6.6,.05,3.6],.75,0);loadDecor('./JUGUETE.glb',[-6.7,.05,3.8],1,.35);
 diceMesh=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.25,1.25),new THREE.MeshStandardMaterial({color:0xf8f5df,roughness:.35}));diceMesh.position.set(0,.9,0);diceMesh.castShadow=true;scene.add(diceMesh);
 const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};addEventListener('resize',resize);resize();
 (function loop(t){requestAnimationFrame(loop);decorGroup.rotation.y=Math.sin(t*.0002)*.006;renderer.render(scene,camera)})(0);
}
function loadGLB(url,parent,scale){loader.load(url,g=>{const o=g.scene;o.scale.setScalar(scale);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});parent.add(o)},undefined,()=>{})}
function loadDecor(url,pos,scale,ry){loader.load(url,g=>{const o=g.scene;o.position.set(...pos);o.scale.setScalar(scale);o.rotation.y=ry;o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});decorGroup.add(o)},undefined,()=>{})}
function trackPos(i){const a=-Math.PI/2+(i/TRACK_COUNT)*Math.PI*2;return new THREE.Vector3(Math.cos(a)*6.15,.43,Math.sin(a)*3.85)}
function refresh3DTokens(){if(!tokenGroup||!loader)return;game.players.forEach(p=>{if(!tokenMeshes.has(p.token)){loader.load('./pin.glb',g=>{const o=g.scene;o.scale.setScalar(.42);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.material=n.material.clone();n.material.color?.set(COLORS[p.color])}});tokenGroup.add(o);tokenMeshes.set(p.token,o);positionToken(p,true)},undefined,()=>fallback(p))}else positionToken(p,true)})}
function fallback(p){const o=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,.7,18),new THREE.MeshStandardMaterial({color:COLORS[p.color]}));tokenGroup.add(o);tokenMeshes.set(p.token,o);positionToken(p,true)}
function positionToken(p,snap){const o=tokenMeshes.get(p.token);if(!o)return;const v=trackPos(p.pos),same=game.players.filter(x=>x.pos===p.pos),rank=same.findIndex(x=>x.token===p.token);v.x+=(rank-(same.length-1)/2)*.28;v.z+=(rank%2)*.18;if(snap)o.position.copy(v);else animateObject(o,v)}
function animateToken(token){const p=game.players.find(x=>x.token===token),o=tokenMeshes.get(token);if(p&&o)animateObject(o,trackPos(p.pos))}
function animateObject(o,target){const from=o.position.clone(),start=performance.now(),dur=250;(function tick(){const t=Math.min(1,(performance.now()-start)/dur),e=1-Math.pow(1-t,3);o.position.lerpVectors(from,target,e);o.position.y=target.y+Math.sin(t*Math.PI)*.45;if(t<1)requestAnimationFrame(tick)})()}
function rollDice3D(value){if(!diceMesh)return;const start=performance.now();(function tick(){const t=Math.min(1,(performance.now()-start)/800);diceMesh.rotation.x+=.23;diceMesh.rotation.y+=.31;diceMesh.position.y=.9+Math.sin(t*Math.PI)*2.1;if(t<1)requestAnimationFrame(tick);else{diceMesh.position.y=.9;toast(`🎲 ${value}`)}})()}

console.log('Los juegos de Angu', {selfId,appId:APP_ID});
