import { joinRoom } from 'https://esm.sh/trystero@0.25.3';

const APP_ID='soquetin-multiplayer-probe-2026';
const params=new URLSearchParams(location.search);
const code=(params.get('room')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const slot=Math.max(1,Math.min(4,Number(params.get('slot')||1)));
const token=`angu-simulator-${slot}`;
const name=`SIM ${slot}`;
const color=slot-1;
const ICONS={mente:'🧠',accion:'⚡',palabra:'💬',creatividad:'✏️',engano:'🎭',grupo:'👥'};
const $=s=>document.querySelector(s);
const stage=$('#stage');
$('#room').textContent=code||'----';
$('#ident').textContent=name;

let room,hello,state,intent,ping,hostPeer=null;
const game={phase:'lobby',turn:0,round:1,players:[],challenge:null};

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function me(){return game.players.find(p=>p.token===token)}
function current(){return game.players[game.turn%Math.max(1,game.players.length)]}
function sendHello(target){hello?.send({token,name,color},target?{target}:undefined).catch(()=>{})}
function sendIntent(type,payload={}){intent?.send({type,token,...payload},hostPeer?{target:hostPeer}:undefined).catch(()=>{})}

function connect(){
  if(code.length!==4){stage.innerHTML='<div class="card"><h2>Falta código de sala</h2></div>';return}
  room=joinRoom({appId:APP_ID},code,{onJoinError:({error})=>console.warn(error)});
  hello=room.makeAction('angu-hello-v1');
  state=room.makeAction('angu-state-v1');
  intent=room.makeAction('angu-intent-v1');
  ping=room.makeAction('angu-ping-v1');
  room.onPeerJoin=peerId=>{hostPeer=peerId;$('#conn').className='conn ok';setTimeout(()=>sendHello(peerId),80)};
  room.onPeerLeave=peerId=>{if(peerId===hostPeer){hostPeer=null;$('#conn').className='conn wait';render()}};
  state.onMessage=(data,{peerId})=>{hostPeer=peerId;Object.assign(game,data);$('#conn').className='conn ok';render()};
  sendHello();setTimeout(()=>ping.send({want:'state'}).catch(()=>{}),500);
  setInterval(()=>{sendHello();ping.send({want:'state'}).catch(()=>{})},9000);
}

function render(){
  const p=me();
  if(!p){stage.innerHTML=`<div class="card"><div style="font-size:48px">🐾</div><h2>${name}</h2><p>Conectando con la sala ${code}…</p><p class="muted">Esperando al host.</p></div>`;return}
  $('#ident').textContent=`${p.name} · ${p.prizes?.map(x=>ICONS[x]).join(' ')||''}`;
  if(game.phase==='lobby'){
    stage.innerHTML=`<div class="card"><span class="badge">CONECTADO</span><h2 class="name">${esc(p.name)}</h2><p>Color ${p.color+1}</p><div class="prizes">${p.prizes?.map(x=>ICONS[x]).join(' ')||''}</div><p class="muted">Esperando que arranque la partida.</p></div>`;return
  }
  if(game.phase==='winner'){
    const w=game.players.find(x=>x.token===game.winner);stage.innerHTML=`<div class="card"><div style="font-size:60px">🏆</div><h2>${w?.token===token?'¡GANASTE!':`${esc(w?.name||'')} ganó`}</h2></div>`;return
  }
  const active=current(),isTurn=active?.token===token,c=game.challenge;
  if(game.phase==='turn'&&isTurn){stage.innerHTML='<div class="card"><span class="badge">TU TURNO</span><h2>Tirá el dado</h2><button id="dice" class="dice">🎲</button></div>';$('#dice').onclick=()=>{sendIntent('roll');$('#dice').disabled=true};return}
  if(game.phase==='challenge'&&c?.kind==='trivia'){
    if(c.reader===token){stage.innerHTML=`<div class="card"><span class="badge">VOS LEÉS</span><h2>Pregunta</h2><p class="q">${esc(c.q)}</p></div>`;return}
    if(c.answerer===token){stage.innerHTML=`<div class="card"><span class="badge">RESPONDÉ</span><h2>${esc(c.q)}</h2><div class="answers">${c.opts.map((o,i)=>`<button class="ans" data-i="${i}">${esc(o)}</button>`).join('')}</div></div>`;stage.querySelectorAll('.ans').forEach(b=>b.onclick=()=>{sendIntent('answer',{choice:Number(b.dataset.i)});stage.querySelectorAll('.ans').forEach(x=>x.disabled=true)});return}
  }
  if(game.phase==='challenge'&&c?.kind==='buzzer'){
    if(c.reader===token){stage.innerHTML=`<div class="card"><span class="badge">VOS LEÉS</span><p class="q">${esc(c.q)}</p><p>Respuesta: <b>${esc(c.answer)}</b></p></div>`;return}
    stage.innerHTML='<div class="card"><h2>¿La sabés?</h2><button id="buzz" class="buzz">¡YO!</button></div>';$('#buzz').onclick=()=>{sendIntent('buzz');$('#buzz').disabled=true};return
  }
  if(game.phase==='buzz-answer'&&c?.answerer===token){stage.innerHTML=`<div class="card"><span class="badge">FUISTE PRIMERO</span><p class="q">${esc(c.q)}</p><input id="free" value="Respuesta simulada ${slot}"><button id="send" class="big primary">Responder</button></div>`;$('#send').onclick=()=>sendIntent('buzzAnswer',{text:$('#free').value});return}
  if(game.phase==='judge'&&c?.reader===token){const answer=c.kind==='trivia'?c.opts?.[c.selected]:c.freeAnswer||'';stage.innerHTML=`<div class="card"><span class="badge">JURADO</span><h2>¿Está bien?</h2><p class="q">${esc(answer)}</p><div class="judge"><button id="no" class="bad">✕ NO</button><button id="yes" class="ok">✓ SÍ</button></div></div>`;$('#yes').onclick=()=>sendIntent('judge',{ok:true});$('#no').onclick=()=>sendIntent('judge',{ok:false});return}
  if(game.phase==='challenge'&&c?.kind==='social'&&(c.answerer===token||c.reader===token)){
    stage.innerHTML=`<div class="card"><span class="badge">${c.answerer===token?'TE TOCA':'JURADO'}</span><h2>${ICONS[c.category]||''} ${esc(c.category)}</h2><p class="q">${esc(c.q)}</p>${c.reader===token?'<div class="judge"><button id="no" class="bad">No ganó</button><button id="yes" class="ok">Ganó</button></div>':''}</div>`;
    if(c.reader===token){$('#yes').onclick=()=>sendIntent('judge',{ok:true});$('#no').onclick=()=>sendIntent('judge',{ok:false})}return
  }
  if(game.phase==='challenge'&&c?.kind==='robber'&&(c.attacker===token||c.defender===token)){
    stage.innerHTML=`<div class="card"><span class="badge">⚔️ ROBO</span><h2>Duelo</h2><p class="q">${esc(c.q)}</p>${c.reader===token?'<div class="judge"><button id="no" class="bad">Defiende</button><button id="yes" class="ok">Atacante</button></div>':''}</div>`;
    if(c.reader===token){$('#yes').onclick=()=>sendIntent('judge',{ok:true});$('#no').onclick=()=>sendIntent('judge',{ok:false})}return
  }
  stage.innerHTML=`<div class="card"><div style="font-size:48px">🐶</div><h2>${isTurn?'Angu está pensando…':`Turno de ${esc(active?.name||'otro')}`}</h2><p class="muted">Mirá la pantalla grande.</p><div class="prizes">${p.prizes?.map(x=>ICONS[x]).join(' ')||''}</div></div>`;
}

connect();render();