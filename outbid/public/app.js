/* OUTBID — browser client. UI and gameplay are separate from the server. */
'use strict';
const $ = id => document.getElementById(id);
const socket = io({reconnection:true,reconnectionAttempts:15});
let state=null,activeMode='',lastPhase='',lastRound=0,toastTimeout=null,lockedLocally=false;
let selectedRaise=100;
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
 setMusicScene('match');
 $('home').classList.add('hidden');$('preflightBackdrop').classList.add('hidden');document.body.classList.remove('preflight-open');$('game').classList.remove('hidden');
 $('resultPanel').classList.add('hidden');
 $('gameMessage').textContent='CONNECTING TO THE TABLE…';
 $('chatlog').replaceChildren(); const line=document.createElement('div');line.className='system-line';line.textContent='Messages only go to this room.';$('chatlog').append(line);
 if(mode==='join')socket.emit('join',{code,name});else socket.emit(mode,name);
 window.scrollTo(0,0);
}
function openPreflight(mode='camera'){
 const dialog=$('preflightBackdrop');
 dialog.classList.remove('hidden');
 $('preflightTitle').textContent=mode==='private'?'Private room':mode==='online'?'Ready for a 1v1?':'Camera check';
 document.body.classList.add('preflight-open');
 if(mode==='private')$('roomcode').focus();
 else if(mode==='online')$('name').focus();
 else $('lobbyCameraButton').focus();
}
function closePreflight(){
 $('preflightBackdrop').classList.add('hidden');
 document.body.classList.remove('preflight-open');
 window.stopOutbidLobbyCamera?.();
 $('openCameraCheck').focus();
}
function toggleSiteMenu(open){
 $('arenaMenuPanel').classList.toggle('hidden',!open);
 $('arenaMenuButton').setAttribute('aria-expanded',String(open));
}
$('arenaMenuButton').addEventListener('click',()=>toggleSiteMenu($('arenaMenuPanel').classList.contains('hidden')));
document.addEventListener('click',e=>{
 if(!e.target.closest('.arena-menu-wrapper'))toggleSiteMenu(false);
});
$('arenaMenuPanel').addEventListener('click',e=>{if(e.target.closest('button'))toggleSiteMenu(false)});
$('copyShareLink').addEventListener('click',async()=>{
 const url='https://outbid-olee.onrender.com';
 try{await navigator.clipboard.writeText(url);notice('OUTBID LINK COPIED')}
 catch(e){window.prompt('Copy the OUTBID link:',url)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleSiteMenu(false)});
$('openCameraCheck').addEventListener('click',()=>openPreflight());
$('cameraCheckCard').addEventListener('click',()=>openPreflight());
$('practiceCard').addEventListener('click',()=>$('playBot').click());
$('playLiveCard').addEventListener('click',()=>openPreflight('online'));
$('privateRoomCard').addEventListener('click',()=>openPreflight('private'));
$('closePreflight').addEventListener('click',closePreflight);
$('preflightBackdrop').addEventListener('click',e=>{if(e.target===$('preflightBackdrop'))closePreflight()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('preflightBackdrop').classList.contains('hidden'))closePreflight();
});
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
function lotVisual(lot){
 const old=imageData[lot?.name]||[null,'MYSTERY LOT'];
 return {
  photo:lot?.image||old[0],
  category:lot?.category||old[1],
  emoji:lot?.emoji||'✦'
 };
}
function setArtwork(lot){
 const visual=lotVisual(lot),id=visual.photo;
 $('itemCategory').textContent=visual.category;
 const photo=$('itemPhoto'),fall=$('imageFallback');
 fall.textContent=visual.emoji;
 if(!id){
  photo.dataset.src='';photo.removeAttribute('src');
  photo.classList.add('hidden');fall.classList.remove('hidden');return;
 }
 // Photos represent item categories; the named lot and hidden value come from the server.
 photo.alt=visual.category+' representative photo';
 const url='https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=1050&q=82';
 photo.onerror=()=>{photo.classList.add('hidden');fall.classList.remove('hidden')};
 photo.onload=()=>{photo.classList.remove('hidden');fall.classList.add('hidden')};
 if(photo.dataset.src!==url){photo.dataset.src=url;photo.classList.add('hidden');fall.classList.remove('hidden');photo.src=url}
 else if(photo.complete&&photo.naturalWidth>0){photo.classList.remove('hidden');fall.classList.add('hidden')}
}
// Lightweight visual feedback for each new auction lot and competing bids.
let introHideTimer=null,bidHideTimer=null,lastBidCount=0,lastBidRound=0,lastTickCue='';
function showLotIntro(r){
 const lot=r.lot;if(!lot)return;
 const el=$('lotIntro'),photo=$('lotIntroPhoto'),fallback=$('lotIntroFallback');
 $('lotIntroRound').textContent=String(r.round).padStart(2,'0')+' / 05';
 $('lotIntroTitle').textContent=lot.name;
 $('lotIntroCondition').textContent=lot.condition+' · NEW LOT';
 const id=lotVisual(lot).photo;
 fallback.textContent=lot.emoji||'✦';
 if(id){
  const src='https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=800&q=80';
  photo.classList.add('hidden');fallback.classList.remove('hidden');
  photo.onload=()=>{photo.classList.remove('hidden');fallback.classList.add('hidden')};
  photo.onerror=()=>{photo.classList.add('hidden');fallback.classList.remove('hidden')};
  photo.src=src;
 }else{photo.removeAttribute('src');photo.classList.add('hidden');fallback.classList.remove('hidden')}
 clearTimeout(introHideTimer);
 el.classList.remove('is-visible');
 void el.offsetWidth; // Restart keyframe animation on every round.
 el.classList.add('is-visible');el.setAttribute('aria-hidden','false');
 introHideTimer=setTimeout(()=>{el.classList.remove('is-visible');el.setAttribute('aria-hidden','true')},1600);
}
function flashBid(r){
 const el=$('bidImpact');
 $('bidImpactText').textContent=(r.leader===r.you?'YOU BID ':'RIVAL BID ')+money(r.highBid||0);
 el.classList.toggle('your-bid',r.leader===r.you);
 clearTimeout(bidHideTimer);el.classList.remove('is-visible');void el.offsetWidth;
 el.classList.add('is-visible');el.setAttribute('aria-hidden','false');
 bidHideTimer=setTimeout(()=>{el.classList.remove('is-visible');el.setAttribute('aria-hidden','true')},900);
}

function render(){
 if(!state)return;
 const r=state,players=r.players||[],you=players.find(p=>p.id===r.you),them=players.find(p=>p.id!==r.you);
 setPlayer(you,'you');setPlayer(them,'them');
 $('roomInfo').textContent='Room '+r.code;
 $('roundNumber').innerHTML=String(Math.min(r.round,5))+'<span>/5</span>';
 Array.from($('roundPips').children).forEach((el,i)=>{
   el.className=i+1<r.round?'finished':i+1===r.round?'active':'';
 });
 const phase=r.phase, newPhase=phase!==lastPhase||r.round!==lastRound;
 if(phase==='bid'){
  if(newPhase||r.round!==lastBidRound){
   lastBidRound=r.round;lastBidCount=0;lastTickCue='';
   showLotIntro(r);playGameSfx('item');
  }
  if((r.bidCount||0)>lastBidCount){
   flashBid(r);
   playGameSfx(r.leader===r.you?'bid':'outbid');
  }
  lastBidCount=r.bidCount||0;
 }else if(newPhase&&phase==='reveal'){
  const winnerIsYou=r.result?.winnerId===r.you;
  playGameSfx(winnerIsYou?'win':'sold');
 }else if(newPhase&&phase==='done'){
  const a=players[0],b=players[1];
  const winning=a&&b?((a.cash+a.collection)===(b.cash+b.collection)?null:(a.cash+a.collection)>(b.cash+b.collection)?a:b):null;
  playGameSfx(winning?.id===r.you?'win':'loss');
 }
 if(newPhase && phase==='bid')lockedLocally=false;
 $('phaseLabel').textContent=({wait:'Waiting for opponent',bid:'Bidding',reveal:'Lot sold',done:'Match finished',left:'Opponent left'})[phase]||phase.toUpperCase();
 $('stageState').textContent=({wait:'Waiting',bid:'Live',reveal:'Sold',done:'Final',left:'Ended'})[phase]||'—';
 $('stageEyebrow').textContent='Lot '+String(Math.min(r.round,5)).padStart(3,'0')+' / 005';
 const item=r.lot?.name||r.result?.item||'The table is ready';
 $('itemName').textContent=phase==='wait'?'Waiting for your opponent':phase==='left'?'Match ended':phase==='done'?'Auction complete':item;
 $('lotClue').textContent=r.lot?.clue||'A new item is coming to the table.';
 setArtwork(phase==='bid'?r.lot:phase==='reveal'?r.result:null);
 $('resultPanel').classList.toggle('hidden',phase!=='reveal'&&phase!=='done'&&phase!=='left');
 const scan=r.appraisal,scansRemaining=Number(r.scansRemaining)||0,scanCost=Number(r.appraisalCost)||300;
 $('appraisalResult').textContent=scan?'ESTIMATE: '+money(scan.low)+' – '+money(scan.high):scansRemaining+' SCAN'+(scansRemaining===1?'':'S')+' LEFT · '+money(scanCost)+' EACH';
 $('appraiseBtn').disabled=phase!=='bid'||!!scan||scansRemaining<=0||(you?.cash||0)<scanCost;
 $('appraiseBtn').textContent=scan?'ESTIMATE REVEALED':scansRemaining<=0?'NO SCANS LEFT':'APPRAISE ↗';
 const isLeading=phase==='bid'&&r.leader===r.you;
 const highBid=Number(r.highBid)||0,minimum=Number(r.minBid)||highBid+100,cash=you?.cash||0;
 const canBid=phase==='bid'&&!isLeading&&!lockedLocally&&minimum<=cash;
 $('highestBid').textContent=money(highBid);
 $('bidLeader').textContent=r.leaderName?(isLeading?'YOU':r.leaderName.toUpperCase()):'No bids yet';
 $('bidLeader').classList.toggle('my-lead',isLeading);
 $('amount').disabled=!canBid;
 $('bidbutton').disabled=!canBid;
 document.querySelectorAll('.quick-bids button').forEach(b=>b.disabled=!canBid);
 $('yourCashHint').textContent='AVAILABLE '+money(cash)+' · MIN '+money(minimum);
 $('amount').max=String(cash);
 $('amount').min=String(minimum);
 $('amount').placeholder=String(minimum);
 if(phase==='bid'){
   const pricedOut=minimum>cash;
   $('actionHeading').innerHTML=isLeading?'You’re winning<span>.</span>':pricedOut?'Out of cash<span>.</span>':'Raise your hand<span>.</span>';
   $('actionHelp').textContent=isLeading?'Hold on to your lead — if your rival raises, drop your hand then raise it again.':pricedOut?'Your rival has bid more than your available cash.':highBid?'Your rival is leading. Open your palm or use the button to bid '+money(minimum)+' or more.':'Show an open palm above your shoulder for one second, or tap BID.';
   $('bidCount').textContent=(r.bidCount||0)+' TOTAL BID'+(r.bidCount===1?'':'S');
   $('bidbutton').innerHTML=isLeading?'You’re leading ✓':pricedOut?'Not enough cash':lockedLocally?'Placing bid…':'Place bid <span>→</span>';
   $('bidStatus').textContent=isLeading?'You have the highest bid':pricedOut?'Not enough cash for another bid':'Raise your hand or use the button to bid again';
   $('stageExplainer').textContent='24-second auctions. Last-second bids briefly extend the clock.';
   $('gameMessage').textContent=isLeading?'You’re in the lead. Watch for a new bid.':highBid?'Your rival is ahead. Raise your bid.':'The auction is open. Make the first bid.';
   if(newPhase){$('amount').value=''}
   else if(isLeading){$('amount').value=''}
   else if(highBid>0&&Number($('amount').value)<minimum&&minimum<=cash){$('amount').value=String(minimum)}
 }
 else if(phase==='reveal'){
   const result=r.result||{},value=result.value||0,delta=value-(result.price||0),won=you&&result.winner===you.name;
   $('resultLabel').textContent=won?'YOU WON THE LOT':'LOT SOLD';
   $('resultValue').textContent=money(value);
   $('resultDetail').textContent='Won by '+String(result.winner||'Nobody')+' for '+money(result.price||0)+' · '+(delta>=0?'+':'−')+money(Math.abs(delta))+' profit';
   $('actionHeading').innerHTML='Bids are in<span>.</span>';
   $('actionHelp').textContent='This lot is actually worth '+money(value)+'. '+(delta>=0?'The winner made a profit.':'The winning bid was too high.')+' Next round soon.';
   $('bidCount').textContent='Round complete';
   $('bidStatus').textContent='Every dollar counts';
   $('stageExplainer').textContent='The true lot value has been revealed.';
   $('bidbutton').textContent='Next round soon';
   $('gameMessage').textContent='Next lot coming up…';
 }
 else if(phase==='done'){
   const a=players[0],b=players[1],aNet=a?(a.cash+a.collection):0,bNet=b?(b.cash+b.collection):0;
   const winner=aNet===bNet?'DRAW':nameOf(aNet>bNet?a:b);
   $('resultLabel').textContent='Match complete';
   $('resultValue').textContent=winner==='DRAW'?'DRAW':winner===nameOf(you)?'You win!':'Game over';
   $('resultDetail').textContent=winner==='DRAW'?'Both players tied.':'Winner: '+winner+' · '+money(Math.max(aNet,bNet))+' net worth';
   $('actionHeading').innerHTML='Game over<span>.</span>';
   $('actionHelp').textContent='You started with $10,000. Ready to run it back?';
   $('bidCount').textContent='Final result';
   $('bidbutton').textContent='Match complete';
   $('bidStatus').textContent='Good game';
   $('stageExplainer').textContent='Highest net worth after five lots wins.';
   $('gameMessage').textContent='Start another match to play again.';
 }
 else if(phase==='left'){
   $('resultLabel').textContent='OPPONENT DISCONNECTED';$('resultValue').textContent='Match ended';
   $('resultDetail').textContent='The other player has left the room.';
   $('actionHeading').innerHTML='They left<span>.</span>';$('actionHelp').textContent='You can start another game any time.';
   $('bidCount').textContent='Connection ended';$('bidbutton').textContent='MATCH ENDED';
   $('gameMessage').textContent='Start a new match to play again.';
 }
 else{
   $('actionHeading').innerHTML='Finding a rival<span>.</span>';
   $('actionHelp').textContent='Keep this tab open. The match will start as soon as your opponent joins.';
   $('bidCount').textContent='Matchmaking';
   $('bidStatus').textContent='Waiting for another player';
   $('bidbutton').textContent='Waiting';
   $('stageExplainer').textContent='Send the room code to a friend or wait for your opponent.';
   $('gameMessage').textContent=activeMode==='find'?'Looking for another player…':'Share the room code with a friend.';
 }
 if(newPhase){lastPhase=phase;lastRound=r.round}
 if(phase==='left')notice('Opponent disconnected. Start a new match to continue.');
}
socket.on('state',r=>{lockedLocally=false;state=r;render()});
function updateClock(){
 if(!state)return;
 const r=state,remaining=Math.max(0,(Number(r.endsAt)||0)-Date.now()),seconds=Math.ceil(remaining/1000),duration=r.phase==='bid'?24000:r.phase==='reveal'?4700:0;
 $('timer').innerHTML=(duration?String(seconds).padStart(2,'0'):'--')+'<small>s</small>';
 $('timerFill').style.width=duration?Math.max(0,Math.min(100,remaining/duration*100))+'%':'0%';
 $('timerFill').style.background=remaining<5000&&r.phase==='bid'?'#fa927b':'var(--acid)';
 if(r.phase==='bid'&&seconds>0&&seconds<=3){const cue=r.code+':'+r.round+':'+seconds;if(lastTickCue!==cue){lastTickCue=cue;playGameSfx('tick')}}
}
setInterval(updateClock,100);
function bid(){
 if(!state||state.phase!=='bid'||state.leader===state.you||lockedLocally)return;
 const text=$('amount').value.trim(),amt=Number(text),you=state.players.find(p=>p.id===state.you),minimum=state.minBid||((state.highBid||0)+100);
 if(text===''||!Number.isSafeInteger(amt)||amt<minimum||amt>(you?.cash||0)){
   notice('Next bid must be at least '+money(minimum)+' and within your cash balance.');return;
 }
 lockedLocally=true;
 socket.emit('bid',amt);
 notice('BID PLACED — '+money(amt));
 playGameSfx('click');render();
}
$('bidbutton').addEventListener('click',bid);
$('amount').addEventListener('keydown',e=>{if(e.key==='Enter')bid()});
function nextGestureAmount(){
 if(!state||state.phase!=='bid'||state.leader===state.you)return null;
 const you=state.players.find(p=>p.id===state.you),cash=you?.cash||0;
 const minimum=state.minBid||((state.highBid||0)+100);
 if(cash<minimum)return null;
 return selectedRaise==='max'?cash:Math.min(cash,Math.max(minimum,(state.highBid||0)+selectedRaise));
}
function bidByGesture(){
 const next=nextGestureAmount();
 if(next===null)return false;
 $('amount').value=String(next);
 bid();
 return true;
}
document.querySelectorAll('[data-bid]').forEach(button=>button.addEventListener('click',()=>{
 selectedRaise=button.dataset.bid==='max'?'max':Number(button.dataset.bid);
 document.querySelectorAll('[data-bid]').forEach(b=>b.classList.toggle('selected',b===button));
 const next=nextGestureAmount();
 if(next!==null)$('amount').value=String(next);
}));
$('appraiseBtn').addEventListener('click',()=>{
 if(!state||state.phase!=='bid'||state.appraisal)return;
 socket.emit('appraise');playGameSfx('scan');
 notice('APPRAISAL REQUESTED · THIS COSTS '+money(state.appraisalCost||300)+' IN GAME CASH');
});
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
