import { joinRoom } from 'https://esm.sh/trystero@0.25.3';

const APP_ID='los-juegos-de-angu-lodijo-standalone-v1';
const MIN_PLAYERS=3;
const MAX_PLAYERS=8;
const HAND_SIZE=6;
const TARGET_SCORE=30;

const $=s=>document.querySelector(s);
const views={home:$('#homeView'),host:$('#hostView'),player:$('#playerView')};
const cleanCode=v=>(v||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
const makeCode=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pad=n=>String(n).padStart(3,'0');
const cardSrc=n=>`./${pad(n)}.jpg`;

const tokenKey='lodijo-player-token-v1';
const nameKey='lodijo-player-name-v1';
let playerToken=localStorage.getItem(tokenKey)||crypto.randomUUID();
localStorage.setItem(tokenKey,playerToken);
let playerName=localStorage.getItem(nameKey)||'';
let room=null,actions=null,isHost=false,roomCode='',hostPeer=null;
let playerSnapshot=null;
let metadata=null,maxAvailableImage=0;

const game={
  phase:'lobby',round:0,narratorIndex:0,narratorToken:null,clue:'',players:[],
  deck:[],discard:[],submissions:[],displayCards:[],reveal:[],roundDeltas:{},
  roundSummary:'',winnerTokens:[],revision:0
};

function showView(name){Object.entries(views).forEach(([k,v])=>v.classList.toggle('active',k===name))}
function toast(text){const e=$('#toast');if(!e)return;e.textContent=text;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function setConn(ok){$('#phoneConnection')?.classList.toggle('online',!!ok)}
function connectedPlayers(){return game.players.filter(p=>p.connected)}
function narrator(){return game.players.find(p=>p.token===game.narratorToken)||null}
function playerByToken(token){return game.players.find(p=>p.token===token)||null}
function submissionFor(token){return game.submissions.find(s=>s.token===token)||null}
function ownerOfCard(card){return game.submissions.find(s=>s.card===card)?.token||null}

async function loadMetadata(){
  try{
    const r=await fetch('./cartas.json',{cache:'no-store'});
    if(!r.ok)throw new Error(String(r.status));
    metadata=await r.json();
    return Number(metadata.total_cards)||1008;
  }catch(err){console.warn('No se pudo leer cartas.json',err);metadata=null;return 1008}
}
async function imageExists(n){
  try{
    const r=await fetch(cardSrc(n),{method:'HEAD',cache:'no-store'});
    return r.ok;
  }catch{return false}
}
async function detectAvailableImages(){
  const total=await loadMetadata();
  if(!(await imageExists(1)))return 0;
  let lo=1,hi=total;
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2);
    if(await imageExists(mid))lo=mid;else hi=mid-1;
  }
  return lo;
}
function versionForCard(card){
  if(!metadata?.cards)return'';
  const file=`${pad(card)}.jpg`;
  return metadata.cards.find(x=>x.file===file)?.version||'';
}

function connect(code,host){
  isHost=host;roomCode=code;
  room=joinRoom({appId:APP_ID},code,{onJoinError:({error})=>console.warn('LoDijo join error',error)});
  actions={
    hello:room.makeAction('lodijo-hello-v1'),
    state:room.makeAction('lodijo-state-v1'),
    intent:room.makeAction('lodijo-intent-v1'),
    ping:room.makeAction('lodijo-ping-v1')
  };
  room.onPeerJoin=peerId=>{
    if(isHost){$('#hostStatus').textContent='P2P conectado';setTimeout(()=>sendState(peerId),100)}
    else setTimeout(()=>{sendHello();actions.ping.send({want:'state'}).catch(()=>{})},100);
  };
  room.onPeerLeave=peerId=>{
    if(isHost){
      const p=game.players.find(x=>x.peerId===peerId);
      if(p){p.connected=false;sync();if(game.phase==='decoys')maybeAdvanceDecoys();if(game.phase==='vote')maybeAdvanceVotes()}
    }else if(hostPeer===peerId){hostPeer=null;setConn(false)}
  };
  actions.hello.onMessage=(data,{peerId})=>{
    if(!isHost||!data?.token)return;
    let p=game.players.find(x=>x.token===data.token);
    if(!p){
      if(game.phase!=='lobby'){sendLocked(peerId,'La partida ya empezó. Esperá a la próxima partida.');return}
      if(game.players.length>=MAX_PLAYERS){sendLocked(peerId,'La sala está llena.');return}
      p={token:data.token,peerId,name:(data.name||`Jugador ${game.players.length+1}`).slice(0,18),score:0,hand:[],submitted:null,vote:null,connected:true};
      game.players.push(p);toast(`${p.name} entró 💬`);
    }else{
      p.peerId=peerId;p.connected=true;if(data.name)p.name=data.name.slice(0,18);
      if(game.phase==='paused'&&connectedPlayers().length>=MIN_PLAYERS)setTimeout(beginRound,300);
    }
    sync();
  };
  actions.state.onMessage=(data,{peerId})=>{
    if(isHost||!data)return;
    hostPeer=peerId;playerSnapshot=data;setConn(true);renderPhone();
  };
  actions.intent.onMessage=(data,{peerId})=>{if(isHost)handleIntent(data,peerId)};
  actions.ping.onMessage=(data,{peerId})=>{if(isHost)sendState(peerId)};
  if(!isHost){sendHello();setTimeout(()=>actions.ping.send({want:'state'}).catch(()=>{}),650)}
}
function sendHello(){actions?.hello.send({token:playerToken,name:playerName}).catch(()=>{})}
function sendIntent(type,payload={}){actions?.intent.send({type,token:playerToken,...payload}).catch(()=>{})}
function sendLocked(peerId,message){actions?.state.send({locked:true,message,roomCode},{target:peerId}).catch(()=>{})}
function publicPlayers(){return game.players.map(p=>({token:p.token,name:p.name,score:p.score,connected:p.connected}))}
function snapshotFor(p){
  const phase=game.phase;
  const exposeCards=['vote','reveal','winner'].includes(phase)?game.displayCards:[];
  return {
    locked:false,roomCode,phase,round:game.round,narratorToken:game.narratorToken,
    narratorName:narrator()?.name||'',clue:game.clue,players:publicPlayers(),
    displayCards:exposeCards,reveal:['reveal','winner'].includes(phase)?game.reveal:[],
    roundDeltas:['reveal','winner'].includes(phase)?game.roundDeltas:{},roundSummary:game.roundSummary,
    winnerTokens:game.winnerTokens,targetScore:TARGET_SCORE,
    me:p?{token:p.token,hand:p.hand,submitted:p.submitted,vote:p.vote}:null,
    revision:game.revision
  };
}
function sendState(targetPeer=null){
  if(!isHost||!actions)return;
  if(targetPeer){
    const p=game.players.find(x=>x.peerId===targetPeer);
    if(p)actions.state.send(snapshotFor(p),{target:targetPeer}).catch(()=>{});
    return;
  }
  game.players.filter(p=>p.connected&&p.peerId).forEach(p=>actions.state.send(snapshotFor(p),{target:p.peerId}).catch(()=>{}));
}
function sync(){game.revision++;renderHost();sendState()}
function requestState(){if(!isHost&&room){sendHello();actions?.ping.send({want:'state'}).catch(()=>{})}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestState()});
window.addEventListener('focus',requestState);window.addEventListener('pageshow',requestState);window.addEventListener('online',requestState);
setInterval(()=>{if(!isHost&&room&&!document.hidden)requestState()},8000);

async function startHost(code){
  showView('host');roomCode=code;$('#hostRoomCode').textContent=code;$('#hostCodeHuge').textContent=code;
  connect(code,true);renderHost();
  const joinUrl=new URL(location.href);joinUrl.search='';joinUrl.hash='';joinUrl.searchParams.set('room',code);
  const qr=$('#qrBox');qr.innerHTML='';
  if(window.QRCode)new QRCode(qr,{text:joinUrl.href,width:240,height:240,colorDark:'#120d18',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  else qr.innerHTML=`<div style="color:#111;padding:12px;text-align:center">${esc(joinUrl.href)}</div>`;
  $('#hostStatus').textContent='Sala abierta · esperando celulares';
  maxAvailableImage=await detectAvailableImages();
  $('#deckStatus').textContent=maxAvailableImage?`${maxAvailableImage} imágenes disponibles ahora · el banco puede crecer hasta ${metadata?.total_cards||1008}`:'No pude encontrar imágenes disponibles';
  renderHost();
}
function preparePlayer(code){
  roomCode=code;showView('player');$('#phoneRoomCode').textContent=code;$('#phoneJoinRoom').textContent=code;
  $('#playerName').value=playerName;$('#phoneJoin').classList.remove('hidden');$('#phoneGame').classList.add('hidden');
}
function enterPlayer(){
  const name=$('#playerName').value.trim();if(!name){toast('Poné tu nombre');return}
  playerName=name.slice(0,18);localStorage.setItem(nameKey,playerName);
  $('#phoneJoin').classList.add('hidden');$('#phoneGame').classList.remove('hidden');
  $('#phoneStage').innerHTML=waitCard('📡','Conectando…','Buscando la TV anfitriona.');
  connect(roomCode,false);
}

function replenishDeck(){if(!game.deck.length&&game.discard.length){game.deck=shuffle(game.discard);game.discard=[]}}
function drawCard(){replenishDeck();return game.deck.pop()??null}
function fillHand(p){while(p.hand.length<HAND_SIZE){const c=drawCard();if(c==null)break;p.hand.push(c)}}
function chooseNextNarrator(){
  if(!game.players.length)return null;
  for(let step=0;step<game.players.length;step++){
    game.narratorIndex=(game.narratorIndex+1)%game.players.length;
    if(game.players[game.narratorIndex].connected)return game.players[game.narratorIndex];
  }
  return null;
}
function startGame(){
  const active=connectedPlayers();
  if(active.length<MIN_PLAYERS)return;
  if(maxAvailableImage<active.length*HAND_SIZE+active.length){toast('Todavía hay pocas imágenes cargadas');return}
  game.players=game.players.filter(p=>p.connected).map(p=>({...p,score:0,hand:[],submitted:null,vote:null}));
  game.deck=shuffle(Array.from({length:maxAvailableImage},(_,i)=>i+1));game.discard=[];game.round=1;game.narratorIndex=0;
  game.players.forEach(fillHand);game.narratorToken=game.players[0].token;beginRound(false);
}
function beginRound(rotate=false){
  if(connectedPlayers().length<MIN_PLAYERS){game.phase='paused';game.clue='';sync();return}
  game.players.forEach(p=>{p.submitted=null;p.vote=null;fillHand(p)});
  game.submissions=[];game.displayCards=[];game.reveal=[];game.roundDeltas={};game.roundSummary='';game.winnerTokens=[];game.clue='';
  if(rotate){const next=chooseNextNarrator();if(!next){game.phase='paused';sync();return}game.narratorToken=next.token}
  else if(!playerByToken(game.narratorToken)?.connected){const next=chooseNextNarrator();if(next)game.narratorToken=next.token}
  game.phase='narrator-pick';sync();
}
function nextRound(){if(game.phase!=='reveal')return;game.round++;beginRound(true)}
function abortRound(){
  if(['lobby','winner'].includes(game.phase))return;
  game.round++;game.players.forEach(p=>{p.submitted=null;p.vote=null;fillHand(p)});beginRound(true);
}
function restartGame(){
  game.players.forEach(p=>{p.score=0;p.hand=[];p.submitted=null;p.vote=null});
  game.deck=shuffle(Array.from({length:maxAvailableImage},(_,i)=>i+1));game.discard=[];game.round=1;game.narratorIndex=0;game.narratorToken=game.players.find(p=>p.connected)?.token||null;
  game.players.forEach(fillHand);beginRound(false);
}

function takeCardFromHand(p,card){
  const idx=p.hand.indexOf(card);if(idx<0)return false;
  p.hand.splice(idx,1);p.submitted=card;game.discard.push(card);return true;
}
function handleIntent(data){
  if(!data?.token)return;const p=playerByToken(data.token);if(!p)return;
  if(data.type==='narrate'&&game.phase==='narrator-pick'&&p.token===game.narratorToken){
    const card=Number(data.card),clue=String(data.clue||'').trim().slice(0,120);
    if(!clue||!takeCardFromHand(p,card))return;
    game.clue=clue;game.submissions=[{token:p.token,card}];game.phase='decoys';sync();maybeAdvanceDecoys();return;
  }
  if(data.type==='decoy'&&game.phase==='decoys'&&p.token!==game.narratorToken&&!p.submitted){
    const card=Number(data.card);if(!takeCardFromHand(p,card))return;
    game.submissions.push({token:p.token,card});sync();maybeAdvanceDecoys();return;
  }
  if(data.type==='vote'&&game.phase==='vote'&&p.token!==game.narratorToken&&!p.vote){
    const card=Number(data.card);if(!game.displayCards.includes(card)||card===p.submitted)return;
    p.vote=card;sync();maybeAdvanceVotes();return;
  }
}
function maybeAdvanceDecoys(){
  if(game.phase!=='decoys')return;
  const required=connectedPlayers().filter(p=>p.token!==game.narratorToken);
  if(required.every(p=>!!p.submitted)){
    game.displayCards=shuffle(game.submissions.filter(s=>playerByToken(s.token)?.connected||s.token===game.narratorToken).map(s=>s.card));
    game.phase='vote';sync();
  }
}
function maybeAdvanceVotes(){
  if(game.phase!=='vote')return;
  const voters=connectedPlayers().filter(p=>p.token!==game.narratorToken&&p.submitted);
  if(voters.length&&voters.every(p=>!!p.vote))scoreRound(voters);
}
function scoreRound(voters){
  const story=submissionFor(game.narratorToken);if(!story)return;
  const deltas=Object.fromEntries(game.players.map(p=>[p.token,0]));
  const correct=voters.filter(p=>p.vote===story.card);
  if(correct.length===0||correct.length===voters.length){
    voters.forEach(p=>deltas[p.token]+=2);
    game.roundSummary=correct.length===0?'Nadie encontró la carta del narrador: los demás suman 2 puntos.':'Todos encontraron la carta del narrador: los demás suman 2 puntos.';
  }else{
    deltas[game.narratorToken]+=3;correct.forEach(p=>deltas[p.token]+=3);
    game.roundSummary=`${correct.length} ${correct.length===1?'persona encontró':'personas encontraron'} la carta: narrador y aciertos suman 3.`;
  }
  voters.forEach(v=>{
    if(v.vote!==story.card){const owner=ownerOfCard(v.vote);if(owner&&owner!==game.narratorToken)deltas[owner]=(deltas[owner]||0)+1}
  });
  game.players.forEach(p=>p.score+=deltas[p.token]||0);game.roundDeltas=deltas;
  game.reveal=game.displayCards.map(card=>{
    const ownerToken=ownerOfCard(card),owner=playerByToken(ownerToken);
    return {card,ownerToken,ownerName:owner?.name||'—',isStory:card===story.card,voters:voters.filter(v=>v.vote===card).map(v=>v.name),version:versionForCard(card)};
  });
  const max=Math.max(...game.players.map(p=>p.score));
  if(max>=TARGET_SCORE){game.winnerTokens=game.players.filter(p=>p.score===max).map(p=>p.token);game.phase='winner'}else game.phase='reveal';
  sync();
}

function renderHost(){
  if(!isHost)return;
  renderHostPlayers();
  const lobby=$('#hostLobby'),board=$('#hostGame'),start=$('#startGameBtn');
  if(game.phase==='lobby'){
    lobby.classList.remove('hidden');board.classList.add('hidden');$('#hostPhaseTitle').textContent='Sala de espera';
    const n=connectedPlayers().length;const enough=n>=MIN_PLAYERS&&maxAvailableImage>=n*HAND_SIZE+n;
    start.disabled=!enough;start.textContent=n<MIN_PLAYERS?`Esperando al menos ${MIN_PLAYERS} jugadores…`:maxAvailableImage<n*HAND_SIZE+n?'Esperando más imágenes…':'Empezar LoDijo';
    return;
  }
  lobby.classList.add('hidden');board.classList.remove('hidden');$('#roundNumber').textContent=game.round||1;
  renderScoreboard();renderHostStage();
}
function renderHostPlayers(){
  const box=$('#hostPlayers');if(!box)return;box.innerHTML='';
  if(!game.players.length){box.innerHTML='<div class="empty-player">Todavía no entró nadie.</div>';return}
  game.players.forEach(p=>{const row=document.createElement('div');row.className='player-row';row.innerHTML=`<span class="player-dot ${p.connected?'':'off'}"></span><span class="player-name">${esc(p.name)}</span>${p.connected?'':'<span class="tiny">fuera</span>'}`;box.appendChild(row)})
}
function renderScoreboard(){
  const box=$('#scoreList');box.innerHTML='';
  [...game.players].sort((a,b)=>b.score-a.score).forEach(p=>{const row=document.createElement('div');row.className=`score-row ${p.token===game.narratorToken?'narrator':''}`;const delta=game.roundDeltas[p.token]||0;row.innerHTML=`<span class="player-dot ${p.connected?'':'off'}"></span><span class="player-name">${esc(p.name)}${p.token===game.narratorToken?' · 🗣️':''}</span><span class="player-score">${p.score}${delta&&['reveal','winner'].includes(game.phase)?` <small>+${delta}</small>`:''}</span>`;box.appendChild(row)})
}
function hostPrompt(icon,title,copy='',clue=''){return `<div class="phase-icon">${icon}</div><h2>${esc(title)}</h2>${clue?`<div class="clue-display">“${esc(clue)}”</div>`:''}${copy?`<p>${esc(copy)}</p>`:''}`}
function waitingPeople(filter){return `<div class="waiting-grid">${filter.map(p=>`<div class="wait-person ${p.submitted||p.vote?'done':''}"><strong>${esc(p.name)}</strong><br><span class="tiny">${p.submitted||p.vote?'✓ listo':'pensando…'}</span></div>`).join('')}</div>`}
function renderHostStage(){
  const prompt=$('#hostPrompt'),cards=$('#hostCards'),result=$('#hostRoundResult'),controls=$('#hostControls');cards.innerHTML='';result.classList.add('hidden');result.innerHTML='';controls.innerHTML='';
  const n=narrator();
  if(game.phase==='paused'){
    $('#hostPhaseTitle').textContent='Partida en pausa';prompt.innerHTML=hostPrompt('⏸️','Faltan jugadores','Necesitamos al menos 3 celulares conectados para seguir.');return;
  }
  if(game.phase==='narrator-pick'){
    $('#hostPhaseTitle').textContent='El narrador elige';prompt.innerHTML=hostPrompt('🗣️',`${n?.name||'El narrador'} está mirando sus cartas`,'Va a elegir una imagen y escribir una pista.');controls.innerHTML='<button id="skipRoundBtn" class="secondary">Saltar ronda</button>';$('#skipRoundBtn').onclick=abortRound;return;
  }
  if(game.phase==='decoys'){
    $('#hostPhaseTitle').textContent='Buscando imágenes';prompt.innerHTML=hostPrompt('🖼️','Elegí una carta que pueda engañar','Cada jugador busca en su mano una imagen que también combine con la pista.',game.clue);
    cards.innerHTML=waitingPeople(connectedPlayers().filter(p=>p.token!==game.narratorToken));controls.innerHTML='<button id="skipRoundBtn" class="secondary">Saltar ronda</button>';$('#skipRoundBtn').onclick=abortRound;return;
  }
  if(game.phase==='vote'){
    $('#hostPhaseTitle').textContent='Votación';prompt.innerHTML=hostPrompt('🗳️','¿Cuál era la carta original?','Votá desde tu celular. El narrador no vota.',game.clue);
    renderDisplayCards(false);controls.innerHTML='<button id="skipRoundBtn" class="secondary">Saltar ronda</button>';$('#skipRoundBtn').onclick=abortRound;return;
  }
  if(game.phase==='reveal'){
    $('#hostPhaseTitle').textContent='Resultado';prompt.innerHTML=hostPrompt('✨','Esto fue lo que quiso decir',game.roundSummary,game.clue);renderDisplayCards(true);
    result.classList.remove('hidden');result.innerHTML='<div class="result-summary">🗣️ La carta original está marcada en violeta. Cada voto engañado suma 1 punto al dueño de la carta señuelo.</div>';
    controls.innerHTML='<button id="nextRoundBtn" class="primary">Siguiente ronda</button>';$('#nextRoundBtn').onclick=nextRound;return;
  }
  if(game.phase==='winner'){
    $('#hostPhaseTitle').textContent='Fin de la partida';const names=game.winnerTokens.map(t=>playerByToken(t)?.name).filter(Boolean).join(' y ');prompt.innerHTML=`<div class="winner-screen"><div class="trophy">🏆</div><h2>${esc(names)}</h2><p>¡Ganó LoDijo con ${Math.max(...game.players.map(p=>p.score))} puntos!</p></div>`;renderDisplayCards(true);controls.innerHTML='<button id="restartGameBtn" class="primary">Jugar otra partida</button>';$('#restartGameBtn').onclick=restartGame;
  }
}
function renderDisplayCards(reveal){
  const box=$('#hostCards');box.innerHTML='';
  game.displayCards.forEach((card,i)=>{
    const info=reveal?game.reveal.find(r=>r.card===card):null;const div=document.createElement('div');div.className='host-card';
    div.innerHTML=`<img src="${cardSrc(card)}" alt="Carta ${i+1}"><div class="card-number">${i+1}</div>${info?`<div class="owner-tag ${info.isStory?'story':''}">${info.isStory?'🗣️ ':''}${esc(info.ownerName)}</div><div class="vote-bubbles">${info.voters.map(v=>`<span class="vote-bubble">${esc(v)}</span>`).join('')}</div>`:''}`;box.appendChild(div)
  })
}

function waitCard(icon,title,copy){return `<div class="phone-card phone-wait"><div class="wait-icon">${icon}</div><h2>${esc(title)}</h2><p class="phone-stage-copy">${esc(copy)}</p></div>`}
function scoreListHTML(s){return `<div class="phone-score-list">${[...s.players].sort((a,b)=>b.score-a.score).map(p=>`<div class="phone-score"><span>${esc(p.name)}${p.token===s.narratorToken?' 🗣️':''}</span><strong>${p.score}${s.roundDeltas?.[p.token]?` (+${s.roundDeltas[p.token]})`:''}</strong></div>`).join('')}</div>`}
function renderPhone(){
  const s=playerSnapshot,stage=$('#phoneStage');if(!s||!stage)return;
  if(s.locked){stage.innerHTML=waitCard('🔒','Partida en curso',s.message||'No podés entrar ahora.');return}
  const me=s.me;if(!me){stage.innerHTML=waitCard('📡','Sincronizando…','Esperando datos de la TV.');return}
  const amNarrator=me.token===s.narratorToken;
  if(s.phase==='lobby'){stage.innerHTML=waitCard('📺','Ya estás en la sala','Mirá la TV. La partida empieza cuando el anfitrión toque Empezar.');return}
  if(s.phase==='paused'){stage.innerHTML=waitCard('⏸️','Partida en pausa','Estamos esperando que vuelvan a conectarse jugadores.');return}
  if(s.phase==='narrator-pick'){
    if(!amNarrator){stage.innerHTML=waitCard('🗣️',`${s.narratorName} es el narrador`,'Está eligiendo una imagen y pensando una pista.');return}
    stage.innerHTML=`<div class="phone-card"><span class="narrator-banner">SOS EL NARRADOR</span><h2 class="phone-stage-title">Elegí tu imagen</h2><p class="phone-stage-copy">Después escribí una pista: puede ser una palabra, una frase, una referencia… ni demasiado obvia ni imposible.</p><div id="handGrid" class="hand-grid">${me.hand.map(c=>phoneCard(c)).join('')}</div><div class="clue-form"><input id="clueInput" class="clue-input" maxlength="120" placeholder="Tu pista…"><button id="sendNarration" class="primary big" disabled>Usar imagen y pista</button></div></div>`;
    let selected=null;stage.querySelectorAll('.phone-image-card').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.card);stage.querySelectorAll('.phone-image-card').forEach(x=>x.classList.toggle('selected',x===b));validateNarration()});
    const inp=$('#clueInput'),btn=$('#sendNarration');function validateNarration(){btn.disabled=!selected||!inp.value.trim()}inp.oninput=validateNarration;btn.onclick=()=>{btn.disabled=true;sendIntent('narrate',{card:selected,clue:inp.value.trim()})};return;
  }
  if(s.phase==='decoys'){
    if(amNarrator){stage.innerHTML=`${waitCard('🎭','Ahora tratá de no delatarte','Los demás están buscando cartas que puedan hacerse pasar por la tuya.')}<div class="phone-clue">“${esc(s.clue)}”</div>`;return}
    if(me.submitted){stage.innerHTML=`${waitCard('✅','Carta enviada','Esperá a que el resto elija su señuelo.')}<div class="phone-clue">“${esc(s.clue)}”</div>`;return}
    stage.innerHTML=`<div class="phone-card"><p class="eyebrow">PISTA</p><div class="phone-clue">“${esc(s.clue)}”</div><h2 class="phone-stage-title">Elegí tu mejor señuelo</h2><p class="phone-stage-copy">¿Cuál de tus imágenes podría haber inspirado esa pista?</p><div class="hand-grid">${me.hand.map(c=>phoneCard(c)).join('')}</div><button id="sendDecoy" class="primary big" disabled style="margin-top:14px">Enviar esta imagen</button></div>`;
    hookSingleCard('#sendDecoy',card=>sendIntent('decoy',{card}));return;
  }
  if(s.phase==='vote'){
    if(amNarrator){stage.innerHTML=`${waitCard('🗳️','Ellos están votando','No podés votar en tu propia ronda. Disfrutá del caos.')}<div class="phone-clue">“${esc(s.clue)}”</div>`;return}
    if(me.vote){stage.innerHTML=`${waitCard('✅','Voto enviado','Ahora mirá la TV y esperá al resto.')}<div class="phone-clue">“${esc(s.clue)}”</div>`;return}
    stage.innerHTML=`<div class="phone-card"><p class="eyebrow">PISTA</p><div class="phone-clue">“${esc(s.clue)}”</div><h2 class="phone-stage-title">¿Cuál puso el narrador?</h2><p class="phone-stage-copy">No podés votar tu propia carta.</p><div class="vote-grid">${s.displayCards.map((c,i)=>phoneCard(c,i+1,c===me.submitted)).join('')}</div><button id="sendVote" class="primary big" disabled style="margin-top:14px">Votar</button></div>`;
    hookSingleCard('#sendVote',card=>sendIntent('vote',{card}),true);return;
  }
  if(s.phase==='reveal'){
    const mine=s.roundDeltas?.[me.token]||0;stage.innerHTML=`<div class="phone-card"><p class="eyebrow">RESULTADO</p><h2 class="phone-stage-title">${mine?`¡Sumaste ${mine}! 🎉`:'Esta vez no sumaste'}</h2><p class="phone-stage-copy">${esc(s.roundSummary||'Mirá la TV para ver quién engañó a quién.')}</p>${scoreListHTML(s)}</div>`;return;
  }
  if(s.phase==='winner'){
    const won=s.winnerTokens.includes(me.token);stage.innerHTML=`<div class="phone-card phone-wait"><div class="wait-icon">${won?'🏆':'👏'}</div><h2>${won?'¡Ganaste!':'¡Fin de la partida!'}</h2><p>${won?'Lo dijiste mejor que nadie.':'Mirá la TV para ver el resultado final.'}</p>${scoreListHTML(s)}</div>`;
  }
}
function phoneCard(card,label=null,disabled=false){return `<button class="phone-image-card" data-card="${card}" ${disabled?'disabled':''}><img src="${cardSrc(card)}" alt="Carta">${label!=null?`<span class="small-number">${label}</span>`:''}</button>`}
function hookSingleCard(buttonSelector,onSend){
  const stage=$('#phoneStage'),btn=$(buttonSelector);let selected=null;
  stage.querySelectorAll('.phone-image-card:not(:disabled)').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.card);stage.querySelectorAll('.phone-image-card').forEach(x=>x.classList.toggle('selected',x===b));btn.disabled=false});
  btn.onclick=()=>{if(!selected)return;btn.disabled=true;stage.querySelectorAll('.phone-image-card').forEach(x=>x.disabled=true);onSend(selected)};
}

$('#roomCodeInput').addEventListener('input',e=>e.target.value=cleanCode(e.target.value));
$('#createRoomBtn').onclick=()=>startHost(makeCode());
$('#manualJoinBtn').onclick=()=>{const c=cleanCode($('#roomCodeInput').value);if(c.length===4)preparePlayer(c);else toast('El código tiene 4 letras')};
$('#enterRoomBtn').onclick=enterPlayer;
$('#startGameBtn').onclick=startGame;

const incoming=cleanCode(new URLSearchParams(location.search).get('room'));
if(incoming)preparePlayer(incoming);else showView('home');
