import { joinRoom } from 'https://esm.sh/trystero@0.25.3';

const APP_ID='soquetin-multiplayer-probe-2026';
const COLORS=['#0066ff','#ff1744','#009e43','#d8bd00','#ff2fb3','#090909','#ffffff','#8f35ff'];
const COLOR_NAMES=['Azul','Rojo','Verde','Amarillo','Rosa','Negro','Blanco','Violeta'];
const PIECES=[
 {name:'Auto',icon:'🚗'},{name:'Cañón',icon:'💥'},{name:'Carretilla',icon:'🛒'},{name:'Casa',icon:'🏠'},{name:'Dedal',icon:'🔔'},{name:'Patito',icon:'🦆'},{name:'Perro',icon:'🐕'},{name:'Plancha',icon:'♨️'},{name:'Sombrero',icon:'🎩'},{name:'Tren',icon:'🚂'}
];
const ICONS={mente:'🧠',accion:'⚡',palabra:'💬',creatividad:'✏️',mentiras:'🎭',grupo:'👥'};
const params=new URLSearchParams(location.search);
const code=(params.get('room')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const slot=Math.max(1,Math.min(4,Number(params.get('slot')||1)));
const token=`angu-simulator-${slot}`;
const name=`SIM ${slot}`;
const $=s=>document.querySelector(s),stage=$('#stage');
$('#room').textContent=code||'----';$('#ident').textContent=name;
let room,hello,state,intent,ping,hostPeer=null;
const game={phase:'lobby',turn:0,round:1,players:[],challenge:null,steal:null,setupRemaining:0};
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function me(){return game.players.find(p=>p.token===token)}function current(){return game.players[game.turn%Math.max(1,game.players.length)]}
function sendHello(target){hello?.send({token,name},target?{target}:undefined).catch(()=>{})}function sendIntent(type,payload={}){intent?.send({type,token,...payload},hostPeer?{target:hostPeer}:undefined).catch(()=>{})}
function connect(){
 if(code.length!==4){stage.innerHTML='<div class="card"><h2>Falta código de sala</h2></div>';return}
 room=joinRoom({appId:APP_ID},code,{onJoinError:({error})=>console.warn(error)});hello=room.makeAction('angu-hello-v1');state=room.makeAction('angu-state-v1');intent=room.makeAction('angu-intent-v1');ping=room.makeAction('angu-ping-v1');
 room.onPeerJoin=peerId=>{hostPeer=peerId;$('#conn').className='conn ok';setTimeout(()=>sendHello(peerId),80)};
 room.onPeerLeave=peerId=>{if(peerId===hostPeer){hostPeer=null;$('#conn').className='conn wait';render()}};
 state.onMessage=(data,{peerId})=>{hostPeer=peerId;Object.assign(game,data);$('#conn').className='conn ok';render()};
 sendHello();setTimeout(()=>ping.send({want:'state'}).catch(()=>{}),500);setInterval(()=>{sendHello();ping.send({want:'state'}).catch(()=>{})},9000);
}
function prizes(p){return p?.prizes?.map(x=>ICONS[x]||'').join(' ')||''}
function render(){
 const p=me();if(!p){stage.innerHTML=`<div class="card"><div style="font-size:48px">🐾</div><h2>${name}</h2><p>Conectando con ${code}…</p></div>`;return}
 $('#ident').textContent=`${p.name}${Number.isInteger(p.color)?` · ${COLOR_NAMES[p.color]}`:''} · ${prizes(p)}`;
 if(game.phase==='lobby'){stage.innerHTML=`<div class="card"><span class="badge">CONECTADO</span><h2 class="name">${esc(p.name)}</h2><p class="muted">Esperando que arranque la partida.</p></div>`;return}
 if(game.phase==='selection-countdown'){stage.innerHTML=`<div class="card"><div class="count">${game.setupRemaining}</div><h2>¡PREPARADO!</h2><p>Cuando llegue a cero, elegí personaje y color.</p></div>`;return}
 if(game.phase==='selection'){
   const usedColors=new Set(game.players.filter(x=>x.token!==token&&Number.isInteger(x.color)).map(x=>x.color));
   const usedPieces=new Set(game.players.filter(x=>x.token!==token&&Number.isInteger(x.piece)).map(x=>x.piece));
   stage.innerHTML=`<div class="card"><div class="timer">${game.setupRemaining}s</div><h2 class="setup-title">PERSONAJE</h2><div class="piece-strip">${PIECES.map((pc,i)=>`<button class="piece ${p.piece===i?'selected':''} ${usedPieces.has(i)?'taken':''}" data-piece="${i}" ${usedPieces.has(i)?'disabled':''}><span class="ico">${pc.icon}</span><span class="txt">${pc.name}</span></button>`).join('')}</div><h2 class="setup-title">COLOR</h2><div class="colors">${COLORS.map((c,i)=>`<button class="color ${p.color===i?'selected':''} ${usedColors.has(i)?'taken':''} ${[3,6].includes(i)?'light':''}" style="--c:${c}" data-color="${i}" ${usedColors.has(i)?'disabled':''}>${COLOR_NAMES[i]}</button>`).join('')}</div><div class="summary">${Number.isInteger(p.piece)?PIECES[p.piece].icon+' '+PIECES[p.piece].name:'Elegí personaje'} · ${Number.isInteger(p.color)?COLOR_NAMES[p.color]:'Elegí color'}</div></div>`;
   stage.querySelectorAll('.piece:not(.taken)').forEach(b=>b.onclick=()=>sendIntent('selectSetup',{piece:Number(b.dataset.piece)}));stage.querySelectorAll('.color:not(.taken)').forEach(b=>b.onclick=()=>sendIntent('selectSetup',{color:Number(b.dataset.color)}));return;
 }
 if(game.phase==='steal-choice'&&game.steal?.attacker===token){const opts=game.steal.options||[];stage.innerHTML=`<div class="card"><span class="badge">⚔️ ROBO</span><h2>Elegí un premio</h2><p>Podés robar uno que todavía no tengas.</p><div class="steal-grid">${opts.map((o,i)=>{const v=game.players.find(x=>x.token===o.victim);return`<button class="steal" data-i="${i}"><span>${ICONS[o.category]||'🏆'}</span><b>${esc(o.category).toUpperCase()}</b><small>de ${esc(v?.name||'jugador')}</small></button>`}).join('')}</div><button id="skip" class="skip">No robar</button></div>`;stage.querySelectorAll('.steal').forEach(b=>b.onclick=()=>{const o=opts[Number(b.dataset.i)];sendIntent('stealPrize',{victim:o.victim,category:o.category})});$('#skip').onclick=()=>sendIntent('skipSteal');return}
 if(game.phase==='steal-choice'){stage.innerHTML='<div class="card"><div style="font-size:56px">⚔️</div><h2>¡Hay robo!</h2><p>Mirá la pantalla grande.</p></div>';return}
 if(game.phase==='winner'){const w=game.players.find(x=>x.token===game.winner);stage.innerHTML=`<div class="card"><div style="font-size:60px">🏆</div><h2>${w?.token===token?'¡GANASTE!':`${esc(w?.name||'')} ganó`}</h2></div>`;return}
 const active=current(),isTurn=active?.token===token,c=game.challenge;
 if(game.phase==='turn'&&isTurn){stage.innerHTML='<div class="card"><span class="badge">TU TURNO</span><h2>Tirá el dado</h2><button id="dice" class="dice">🎲</button></div>';$('#dice').onclick=()=>{sendIntent('roll');$('#dice').disabled=true};return}
 if(game.phase==='challenge'&&c?.kind==='trivia'){if(c.reader===token){stage.innerHTML=`<div class="card"><span class="badge">VOS LEÉS</span><h2>Pregunta</h2><p class="q">${esc(c.q)}</p></div>`;return}if(c.answerer===token){stage.innerHTML=`<div class="card"><span class="badge">RESPONDÉ</span><h2>${esc(c.q)}</h2><div class="answers">${c.opts.map((o,i)=>`<button class="ans" data-i="${i}">${esc(o)}</button>`).join('')}</div></div>`;stage.querySelectorAll('.ans').forEach(b=>b.onclick=()=>{sendIntent('answer',{choice:Number(b.dataset.i)});stage.querySelectorAll('.ans').forEach(x=>x.disabled=true)});return}}
 if(game.phase==='challenge'&&c?.kind==='buzzer'){if(c.reader===token){stage.innerHTML=`<div class="card"><span class="badge">VOS LEÉS</span><p class="q">${esc(c.q)}</p><p>Respuesta: <b>${esc(c.answer)}</b></p></div>`;return}stage.innerHTML='<div class="card"><h2>¿La sabés?</h2><button id="buzz" class="buzz">¡YO!</button></div>';$('#buzz').onclick=()=>{sendIntent('buzz');$('#buzz').disabled=true};return}
 if(game.phase==='buzz-answer'&&c?.answerer===token){stage.innerHTML=`<div class="card"><span class="badge">FUISTE PRIMERO</span><p class="q">${esc(c.q)}</p><input id="free" value="Respuesta simulada ${slot}"><button id="send" class="big primary">Responder</button></div>`;$('#send').onclick=()=>sendIntent('buzzAnswer',{text:$('#free').value});return}
 if(game.phase==='judge'&&c?.reader===token){const answer=c.kind==='trivia'?c.opts?.[c.selected]:c.freeAnswer||'';stage.innerHTML=`<div class="card"><span class="badge">JURADO</span><h2>¿Está bien?</h2><p class="q">${esc(answer)}</p><div class="judge"><button id="no" class="bad">✕ NO</button><button id="yes" class="ok">✓ SÍ</button></div></div>`;$('#yes').onclick=()=>sendIntent('judge',{ok:true});$('#no').onclick=()=>sendIntent('judge',{ok:false});return}
 if(game.phase==='challenge'&&c?.kind==='social'&&(c.answerer===token||c.reader===token)){stage.innerHTML=`<div class="card"><span class="badge">${c.answerer===token?'TE TOCA':'JURADO'}</span><h2>${ICONS[c.category]||''} ${esc(c.category)}</h2><p class="q">${esc(c.q)}</p>${c.reader===token?'<div class="judge"><button id="no" class="bad">No ganó</button><button id="yes" class="ok">Ganó</button></div>':''}</div>`;if(c.reader===token){$('#yes').onclick=()=>sendIntent('judge',{ok:true});$('#no').onclick=()=>sendIntent('judge',{ok:false})}return}
 stage.innerHTML=`<div class="card"><div style="font-size:48px">🐶</div><h2>${isTurn?'Angu está pensando…':`Turno de ${esc(active?.name||'otro')}`}</h2><p class="muted">Mirá la pantalla grande.</p><div class="prizes">${prizes(p)}</div></div>`;
}
connect();render();