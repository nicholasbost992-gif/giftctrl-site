/* OUTBID — browser client. UI and gameplay are separate from the server. */
'use strict';
const $ = id => document.getElementById(id);
const socket = io({reconnection:true,reconnectionAttempts:15});
let state=null,activeMode='',lastPhase='',lastRound=0,toastTimeout=null,lockedLocally=false;
let peer=null,localStream=null,remoteEnabled=false,muted=false,queuedCandidates=[];
const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const imageData={
 'Mystery Supercar':['photo-1503376780353-7e6692767b70','AUTOMOTIVE'],
 'Old Watch':['photo-1523275335684-37898b6baf30','WATCHES'],
 'Storage Locker':[null,'MYSTERY LOT'],
 'Vintage Arcade':['photo-1511512578047-dfb367046420','GAMING'],
 'Art Canvas':['photo-1579783902614-a3fb3927b6a5','FINE ART'],
 'Designer Bag':['photo-1584917865442-de89df76afd3','LUXURY GOODS'],
 'Retro Console':['photo-1552820728-8b83bb6b773f','GAMING'],
 'Gold Coin':['photo-1610375461246-83df859d849d','COLLECTIBLES'],
 'Mystery Safe':[null,'MYSTERY LOT'],
 'Sports Coupe':['photo-1494976388531-d1058494cdd8','AUTOMOTIVE']
};
const money = n => '$'+Math.round(Number(n)||0).toLocaleString('en-US');
const nameOf = p => p && p.name ? String(p.name) : 'Waiting…';
function notice(message){const el=$('toast');el.textContent=message;el.classList.add('active');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('active'),3500)}
function nickname(){const val=$('name').value.trim().slice(0,18)||'Player';try{localStorage.setItem('outbid_nickname',val)}catch(e){}return val}
try{$('name').value=localStorage.getItem('outbid_nickname')||''}catch(e){}
function begin(mode,code){
 if(!socket.connected){notice('Reconnecting. Try again in a moment.');return}
 const name=nickname(); activeMode=mode;lastPhase='';lastRound=0;lockedLocally=false;
 $('home').classList.add('hidden');$('game').classList.remove('hidden');
 $('resultPanel').classList.add('hidden');
 $('gameMessage').textContent='CONNECTING TO THE TABLE…';
 $('chatlog').replaceChildren(); const line=document.createElement('div');line.className='system-line';line.textContent='Messages only go to this room.';$('chatlog').append(line);
 if(mode==='join')socket.emit('join',{code,name});else socket.emit(mode,name);
 window.scrollTo(0,0);
}
$('playOnline').addEventListener('click',()=>begin('find'));
$('playBot').addEventListener('click',()=>begin('solo'));
$('createRoom').addEventListener('click',()=>begin('create'));
$('joinRoom').addEventListener('click',()=>{
 const code=$('roomcode').value.trim().toUpperCase();
 if(!/^[A-F0-9]{6}$/.test(code)){notice('Enter a valid six-character room code.');return}
 begin('join',code);
});
$('roomcode').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinRoom').click()});
$('name').addEventListener('keydown',e=>{if(e.key==='Enter')$('playOnline').click()});
$('leaveMatch').addEventListener('click',()=>window.location.reload());
$('newMatch').addEventListener('click',()=>window.location.reload());
$('copyRoom').addEventListener('click',async()=>{
 if(!state||!state.code)return notice('Join a room to get a code.');
 try{await navigator.clipboard.writeText(state.code);notice('ROOM CODE COPIED: '+state.code)}
 catch(e){notice('ROOM CODE: '+state.code)}
});
socket.on('connect',()=>{if(!state&&activeMode==='')$('gameMessage').textContent='CONNECTED'});
socket.on('disconnect',()=>{
 if(activeMode)notice('Connection interrupted. Reconnecting…');
 $('phaseLabel').textContent='RECONNECTING';
});
socket.on('connect_error',()=>{if(activeMode)notice('Cannot reach the game server yet.')});
socket.on('errorMessage',message=>{
 notice(String(message));
 if(state===null && activeMode==='join'){$('game').classList.add('hidden');$('home').classList.remove('hidden');activeMode=''}
 lockedLocally=false;
});
function setPlayer(p,prefix){
 $(prefix+'Name').textContent=nameOf(p);
 $(prefix+'Initial').textContent=p?nameOf(p).charAt(0).toUpperCase():'?';
 $(prefix+'Net').textContent=p?money((p.cash||0)+(p.collection||0)):'—';
 $(prefix+'Details').textContent=p?'Cash '+money(p.cash)+' · Items '+money(p.collection):'Waiting for player';
}
function setArtwork(name){
 const info=imageData[name]||[null,'MYSTERY LOT'],id=info[0];
 $('itemCategory').textContent=info[1];
 const photo=$('itemPhoto'),fall=$('imageFallback');
 if(!id){photo.classList.add('hidden');fall.classList.remove('hidden');return}
 const url='https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1050&q=82';
 photo.onerror=()=>{photo.classList.add('hidden');fall.classList.remove('hidden')};
 photo.onload=()=>{photo.classList.remove('hidden');fall.classList.add('hidden')};
 if(photo.dataset.src!==url){photo.dataset.src=url;photo.classList.add('hidden');fall.classList.remove('hidden');photo.src=url}
 else if(photo.complete&&photo.naturalWidth>0){photo.classList.remove('hidden');fall.classList.add('hidden')}
}
function render(){
 if(!state)return;
 const r=state,players=r.players||[],you=players.find(p=>p.id===r.you),them=players.find(p=>p.id!==r.you);
 setPlayer(you,'you');setPlayer(them,'them');
 $('roomInfo').textContent='ROOM '+r.code;
 $('roundNumber').innerHTML=String(Math.min(r.round,5))+'<span>/5</span>';
 Array.from($('roundPips').children).forEach((el,i)=>{
   el.className=i+1<r.round?'finished':i+1===r.round?'active':'';
 });
 const phase=r.phase, newPhase=phase!==lastPhase||r.round!==lastRound;
 if(newPhase && phase==='bid')lockedLocally=false;
 $('phaseLabel').textContent=({wait:'WAITING FOR AN OPPONENT',bid:'BIDDING NOW',reveal:'LOT REVEALED',done:'MATCH FINISHED',left:'OPPONENT LEFT'})[phase]||phase.toUpperCase();
 $('stageState').textContent=({wait:'WAITING',bid:'LIVE ROUND',reveal:'SOLD',done:'FINAL',left:'ENDED'})[phase]||'—';
 $('stageEyebrow').textContent='LOT '+String(Math.min(r.round,5)).padStart(3,'0')+' / 005';
 const item=r.lot?.name||r.result?.item||'The table is ready';
 $('itemName').textContent=phase==='wait'?'Waiting for your opponent':phase==='left'?'Match ended':phase==='done'?'Auction complete':item;
 setArtwork(phase==='wait'||phase==='left'||phase==='done'?null:item);
 $('resultPanel').classList.toggle('hidden',phase!=='reveal'&&phase!=='done'&&phase!=='left');
 const canBid=phase==='bid'&&!r.submitted&&!lockedLocally;
 $('amount').disabled=!canBid;
 $('bidbutton').disabled=!canBid;
 document.querySelectorAll('.quick-bids button').forEach(b=>b.disabled=!canBid);
 $('yourCashHint').textContent='AVAILABLE '+money(you?.cash||0);
 $('amount').max=String(you?.cash||0);
 if(phase==='bid'){
   $('actionHeading').innerHTML=r.submitted||lockedLocally?'Bid locked<span>.</span>':'Place your bid<span>.</span>';
   $('actionHelp').textContent=r.submitted||lockedLocally?'Your offer is locked. Waiting for the other bidder.':'Choose your number. Your rival won’t know your bid until the lot sells.';
   $('bidCount').textContent=r.submitted||lockedLocally?'SUBMITTED':'SECRET BID';
   $('bidbutton').innerHTML=r.submitted||lockedLocally?'BID SUBMITTED ✓':'LOCK IN BID <span>→</span>';
   $('bidStatus').textContent=r.submitted||lockedLocally?'YOUR OFFER IS HIDDEN UNTIL REVEAL':'● THE HIGHEST BID TAKES THE ITEM';
   $('stageExplainer').textContent='Highest secret bid wins. Ties are randomized.';
   $('gameMessage').textContent=r.submitted?'YOUR BID IS IN. WAITING FOR RIVAL.':'MAKE YOUR MOVE BEFORE THE CLOCK RUNS OUT.';
   if(newPhase){lockedLocally=false;$('amount').value='';if(musicOn)playAccent(440)}
 }
 else if(phase==='reveal'){
   const result=r.result||{},value=result.value||0,delta=value-(result.price||0),won=you&&result.winner===you.name;
   $('resultLabel').textContent=won?'YOU WON THE LOT':'LOT SOLD';
   $('resultValue').textContent=money(value);
   $('resultDetail').textContent='Won by '+String(result.winner||'Nobody')+' for '+money(result.price||0)+' · '+(delta>=0?'+':'−')+money(Math.abs(delta))+' value';
   $('actionHeading').innerHTML='Bids are in<span>.</span>';
   $('actionHelp').textContent='Real value: '+money(value)+'. Next lot in a moment.';
   $('bidCount').textContent='ROUND COMPLETE';
   $('bidStatus').textContent='● EVERY DOLLAR COUNTS';
   $('stageExplainer').textContent='The true lot value has been revealed.';
   $('bidbutton').textContent='WAITING FOR NEXT ROUND';
   $('gameMessage').textContent='THE NEXT LOT IS COMING UP.';
   if(newPhase&&musicOn)playAccent(won?660:260);
 }
 else if(phase==='done'){
   const a=players[0],b=players[1],aNet=a?(a.cash+a.collection):0,bNet=b?(b.cash+b.collection):0;
   const winner=aNet===bNet?'DRAW':nameOf(aNet>bNet?a:b);
   $('resultLabel').textContent='FIVE ROUNDS COMPLETE';
   $('resultValue').textContent=winner==='DRAW'?'DRAW':winner===nameOf(you)?'YOU WIN':'GAME OVER';
   $('resultDetail').textContent=winner==='DRAW'?'Both players tied.':'Winner: '+winner+' · '+money(Math.max(aNet,bNet))+' net worth';
   $('actionHeading').innerHTML='Game over<span>.</span>';
   $('actionHelp').textContent='You started with $10,000. Ready to run it back?';
   $('bidCount').textContent='FINAL RESULT';
   $('bidbutton').textContent='MATCH COMPLETE';
   $('bidStatus').textContent='● GG. WELL PLAYED.';
   $('stageExplainer').textContent='Highest net worth after five lots wins.';
   $('gameMessage').textContent='HIT NEW MATCH TO START AGAIN.';
 }
 else if(phase==='left'){
   $('resultLabel').textContent='OPPONENT DISCONNECTED';$('resultValue').textContent='MATCH ENDED';
   $('resultDetail').textContent='The other player has left the room.';
   $('actionHeading').innerHTML='They left<span>.</span>';$('actionHelp').textContent='You can start another game any time.';
   $('bidCount').textContent='CONNECTION ENDED';$('bidbutton').textContent='MATCH ENDED';
   $('gameMessage').textContent='START A NEW MATCH TO PLAY AGAIN.';
 }
 else{
   $('actionHeading').innerHTML='Finding a rival<span>.</span>';
   $('actionHelp').textContent='Keep this tab open. The match will start as soon as your opponent joins.';
   $('bidCount').textContent='MATCHMAKING';
   $('bidStatus').textContent='● WAITING FOR PLAYER TWO';
   $('bidbutton').textContent='WAITING';
   $('stageExplainer').textContent='Send the room code to a friend or wait for your opponent.';
   $('gameMessage').textContent=activeMode==='find'?'SEARCHING FOR AN AVAILABLE OPPONENT…':'SHARE THE CODE ABOVE TO INVITE A FRIEND.';
 }
 if(newPhase){lastPhase=phase;lastRound=r.round}
 if(r.players.length===2&&localStream&&r.you===r.players[0].id&&!remoteEnabled){remoteEnabled=true;makeOffer()}
 if(phase==='left'){peer?.close();peer=null;voiceStatus('Opponent disconnected')}
}
socket.on('state',r=>{state=r;render()});
function updateClock(){
 if(!state)return;
 const r=state,remaining=Math.max(0,(Number(r.endsAt)||0)-Date.now()),seconds=Math.ceil(remaining/1000),duration=r.phase==='bid'?25000:r.phase==='reveal'?6000:0;
 $('timer').innerHTML=(duration?String(seconds).padStart(2,'0'):'--')+'<small>s</small>';
 $('timerFill').style.width=duration?Math.max(0,Math.min(100,remaining/duration*100))+'%':'0%';
 $('timerFill').style.background=remaining<5000&&r.phase==='bid'?'#fa927b':'var(--acid)';
}
setInterval(updateClock,100);
function bid(){
 if(!state||state.phase!=='bid'||state.submitted||lockedLocally)return;
 const text=$('amount').value.trim(),amt=Number(text),you=state.players.find(p=>p.id===state.you);
 if(text===''||!Number.isSafeInteger(amt)||amt<0||amt>(you?.cash||0)){notice('Enter a valid bid within your cash balance.');return}
 lockedLocally=true; socket.emit('bid',amt);notice('BID LOCKED — '+money(amt));playAccent(370);render();
}
$('bidbutton').addEventListener('click',bid);
$('amount').addEventListener('keydown',e=>{if(e.key==='Enter')bid()});
document.querySelectorAll('[data-bid]').forEach(button=>button.addEventListener('click',()=>{
 if(!state||state.phase!=='bid'||state.submitted)return;
 const cash=state.players.find(p=>p.id===state.you)?.cash||0;
 $('amount').value=String(Math.min(cash,button.dataset.bid==='max'?cash:Number(button.dataset.bid)));$('amount').focus();
}));
function sendChat(e){if(e)e.preventDefault();let v=$('chatinput').value.trim();if(!v||!state)return;socket.emit('chat',v);$('chatinput').value=''}
$('chatForm').addEventListener('submit',sendChat);
socket.on('chat',m=>{
 const row=document.createElement('div');row.className='chat-entry';
 const sender=document.createElement('b');sender.textContent=String(m.from||'Player')+': ';
 row.append(sender,document.createTextNode(String(m.text||'')));
 $('chatlog').append(row);$('chatlog').scrollTop=$('chatlog').scrollHeight;
 while($('chatlog').children.length>90)$('chatlog').firstChild.remove();
});
function collapseChat(collapsed){
 $('chatContent').classList.toggle('hidden',collapsed);
 $('toggleChat').textContent=collapsed?'SHOW +':'HIDE −';
 $('toggleChat').setAttribute('aria-expanded',String(!collapsed));
}
$('toggleChat').addEventListener('click',()=>collapseChat(!$('chatContent').classList.contains('hidden')));
if(window.matchMedia('(max-width:760px)').matches)collapseChat(true);
function voiceStatus(message){$('voiceStatus').textContent=message}
function setupPeer(){
 if(peer||!localStream)return;
 peer=new RTCPeerConnection(rtcConfig);
 localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));
 peer.onicecandidate=e=>{if(e.candidate)socket.emit('signal',{type:'candidate',payload:e.candidate})};
 peer.ontrack=e=>{$('remoteAudio').srcObject=e.streams[0];voiceStatus('Voice connected')};
 peer.onconnectionstatechange=()=>{if(peer)voiceStatus('Voice: '+peer.connectionState)};
}
async function makeOffer(){
 if(!localStream||!state||state.players.length!==2||state.players.some(p=>p.id==='bot'))return;
 setupPeer();if(peer.signalingState!=='stable')return;
 try{const offer=await peer.createOffer();await peer.setLocalDescription(offer);socket.emit('signal',{type:'offer',payload:peer.localDescription})}
 catch(e){voiceStatus('Could not start voice')}
}
async function toggleMic(){
 if(localStream){
   localStream.getTracks().forEach(t=>t.stop());localStream=null;
   if(peer)peer.close();peer=null;remoteEnabled=false;
   $('mic').textContent='MIC OFF';voiceStatus('Voice disabled');return;
 }
 if(!navigator.mediaDevices?.getUserMedia){voiceStatus('Microphone not available');return}
 if(state?.players.some(p=>p.id==='bot')){voiceStatus('Voice is for multiplayer matches');return}
 try{
   localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   $('mic').textContent='MIC ON';voiceStatus('Waiting for other microphone');
   socket.emit('voiceReady');
   if(state?.players.length===2&&state.you===state.players[0].id)makeOffer();
 }catch(e){voiceStatus(e.name==='NotAllowedError'?'Microphone permission denied':'Could not access microphone')}
}
$('mic').addEventListener('click',toggleMic);
socket.on('voiceReady',()=>{if(localStream&&state?.players.length===2&&state.you===state.players[0].id)makeOffer()});
socket.on('signal',async data=>{
 try{
   if(!localStream){if(data.type==='offer')voiceStatus('Rival ready — enable mic to join');return}
   setupPeer();
   if(data.type==='offer'){
     await peer.setRemoteDescription(data.payload);
     const answer=await peer.createAnswer();
     await peer.setLocalDescription(answer);
     socket.emit('signal',{type:'answer',payload:peer.localDescription});
     await flushCandidates();
   }else if(data.type==='answer'){await peer.setRemoteDescription(data.payload);await flushCandidates()}
   else if(data.type==='candidate'){if(peer.remoteDescription)await peer.addIceCandidate(data.payload);else queuedCandidates.push(data.payload)}
 }catch(e){voiceStatus('Voice connection issue')}
});
async function flushCandidates(){for(const candidate of queuedCandidates)await peer.addIceCandidate(candidate);queuedCandidates=[]}
$('mute').addEventListener('click',()=>{muted=!muted;$('remoteAudio').muted=muted;$('mute').textContent=muted?'AUDIO OFF':'AUDIO ON'});
/* Optional membership. Payments remain off unless the owner configures Stripe. */
async function request(url,opts){const res=await fetch(url,opts);const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data}
function openPro(open){$('proBackdrop').classList.toggle('hidden',!open)}
$('proNav').addEventListener('click',()=>openPro(true));
$('closePro').addEventListener('click',()=>openPro(false));
$('proBackdrop').addEventListener('click',e=>{if(e.target===$('proBackdrop'))openPro(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')openPro(false)});
async function refreshPro(){
 try{
   const query=new URLSearchParams(location.search);
   if(query.has('checkout_session')){
     await request('/api/pro/confirm?session='+encodeURIComponent(query.get('checkout_session')));
     history.replaceState(null,'',location.pathname);
     notice('OUTBID PRO ACTIVE');
   }
   const status=await request('/api/pro/status');
   document.body.classList.toggle('is-pro',!!status.pro);
   $('proStatus').textContent=status.pro?'Your PRO membership is active.':status.configured?'Membership is available.':'PRO is not available for purchase yet.';
   $('proButton').classList.toggle('hidden',status.pro||!status.configured);
   $('portalButton').classList.toggle('hidden',!status.hasCustomer);
 }catch(e){$('proStatus').textContent='Membership status unavailable.'}
}
$('proButton').addEventListener('click',async()=>{try{const r=await request('/api/pro/checkout',{method:'POST'});location.href=r.url}catch(e){notice(e.message)}});
$('portalButton').addEventListener('click',async()=>{try{const r=await request('/api/pro/portal',{method:'POST'});location.href=r.url}catch(e){notice(e.message)}});
refreshPro();
/* Original in-browser instrumental. User gesture required by mobile audio policies. */
let audioCtx=null,musicOn=false,musicTimer=null,step=0,musicBus=null;
function audioReady(){
 if(!audioCtx){
   audioCtx=new (window.AudioContext||window.webkitAudioContext)();
   musicBus=audioCtx.createGain();musicBus.gain.value=.38;
   const compressor=audioCtx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=3;
   musicBus.connect(compressor);compressor.connect(audioCtx.destination);
 }
}
function synth(freq,t,len,vol,wave='triangle'){
 const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain();
 oscillator.type=wave;oscillator.frequency.setValueAtTime(freq,t);
 gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.001,vol),t+.009);
 gain.gain.exponentialRampToValueAtTime(.0001,t+len);
 oscillator.connect(gain).connect(musicBus);
 oscillator.start(t);oscillator.stop(t+len+.01);
}
function kick(t){
 const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';
 o.frequency.setValueAtTime(132,t);o.frequency.exponentialRampToValueAtTime(42,t+.17);
 g.gain.setValueAtTime(.8,t);g.gain.exponentialRampToValueAtTime(.001,t+.23);
 o.connect(g).connect(musicBus);o.start(t);o.stop(t+.24);
}
function noiseHit(t,kind){
 const len=kind==='snare'?.14:.06,buff=audioCtx.createBuffer(1,Math.round(audioCtx.sampleRate*len),audioCtx.sampleRate),samples=buff.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
 src.buffer=buff;filter.type='highpass';filter.frequency.value=kind==='snare'?1200:7000;
 g.gain.setValueAtTime(kind==='snare'?.24:.075,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
 src.connect(filter).connect(g).connect(musicBus);src.start(t);src.stop(t+len);
}
function musicTick(){
 if(!musicOn||!audioCtx)return;
 const t=audioCtx.currentTime+.025,n=step%16,bars=[98,116.54,87.31,130.81],root=bars[Math.floor(step/16)%bars.length];
 if(n%4===0)kick(t);
 if(n===4||n===12)noiseHit(t,'snare');
 if(n%2===0)noiseHit(t,'hat');
 if([0,3,6,8,11,14].includes(n))synth(root*(n===11?1.5:1),t,.23,.14,'sawtooth');
 if([0,7,10].includes(n))synth(root*4,t,.42,.055,'triangle');
 step++;
}
async function toggleMusic(){
 try{
   audioReady();
   if(musicOn){musicOn=false;clearInterval(musicTimer);await audioCtx.suspend()}
   else{await audioCtx.resume();musicOn=true;musicTick();musicTimer=setInterval(musicTick,150)}
   $('soundText').textContent=musicOn?'SOUND ON':'SOUND OFF';
   $('soundIcon').textContent=musicOn?'♫':'♪';
   $('musicToggle').setAttribute('aria-pressed',String(musicOn));
   notice(musicOn?'SOUND ON':'SOUND OFF');
 }catch(e){notice('Audio is unavailable in this browser.')}
}
$('musicToggle').addEventListener('click',toggleMusic);
function playAccent(freq){if(!audioCtx||!musicOn||audioCtx.state!=='running')return;try{synth(freq,audioCtx.currentTime,.14,.07,'triangle')}catch(e){}}
