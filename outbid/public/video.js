/* OUTBID video auction: opt-in WebRTC and on-device open-palm bidding. */
'use strict';
let cameraStream=null,videoPeer=null,remoteReady=false,videoAnnounced=false,remoteCandidates=[],queuedOffer=null;
let localCameraEnabled=false,localMicEnabled=false,remoteMuted=false,gestureEnabled=false;
let handsModel=null,handsBusy=false,handsTimer=null,handsBroken=false,lastVideoRound=null;
const gestureTracker=new OutbidHand.Tracker(()=>{if(bidByGesture()){notice('HAND RAISED — BID PLACED');$('handState').textContent='BID PLACED. LOWER YOUR HAND TO RESET.'}});
const meVideo=$('localVideo'),otherVideo=$('remoteVideo');
const rtcOptions={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
function videoStatus(message){$('voiceStatus').textContent=message}
function isBotMatch(){return !!state?.players?.some(p=>p.id==='bot')}
function isCaller(){return !!(state?.players?.length===2&&state.you===state.players[0].id)}
function videoRoundKey(){return state?.phase==='bid'?state.round:state?.phase+'-'+state?.round}
function isAllowedHandBid(){
 if(!state||state.phase!=='bid'||state.leader===state.you||lockedLocally)return false;
 const cash=state.players.find(p=>p.id===state.you)?.cash||0;
 return cash>=(state.minBid||((state.highBid||0)+100));
}
function updateCameraControls(){
 const active=!!cameraStream;
 $('lobbyVideo').classList.toggle('hidden',!active||!localCameraEnabled);
 $('lobbyVideoPlaceholder').classList.toggle('hidden',active&&localCameraEnabled);
 $('lobbyCameraButton').textContent=active?'Turn off camera':'Enable camera + mic';
 $('lobbyCameraStatus').textContent=active?(localCameraEnabled?'Preview on · mic '+(localMicEnabled?'on':'off'):'Camera disabled'):/TikTok|musical_ly|Bytedance/i.test(navigator.userAgent)?'Use Safari if the camera is blocked':'Only turns on when you choose';
 $('startCamera').classList.toggle('hidden',active);
 $('camToggle').classList.toggle('hidden',!active);
 $('mic').classList.toggle('hidden',!active);
 $('mute').classList.toggle('hidden',!active||isBotMatch());
 $('camToggle').textContent=localCameraEnabled?'Camera on':'Camera off';
 $('mic').textContent=localMicEnabled?'Mic on':'Mic off';
 $('mute').textContent=remoteMuted?'Sound off':'Sound on';
 $('handToggle').textContent=gestureEnabled?'Hand bids on':'Hand bids off';
 $('handToggle').setAttribute('aria-pressed',String(gestureEnabled));
 $('yourCameraBadge').textContent=localCameraEnabled?'· LIVE':'· OFF';
 $('localPlaceholder').classList.toggle('hidden',active&&localCameraEnabled);
 $('localVideo').classList.toggle('hidden',!active||!localCameraEnabled);
 $('connectionLabel').textContent=isBotMatch()?'Bot match':videoPeer?.connectionState==='connected'?'Connected':active?'Waiting for rival video':'Video off';
}
function updateRemoteVisual(r){
 const bot=r.players?.some(p=>p.id==='bot'),other=r.players?.find(p=>p.id!==r.you),link=videoPeer?.connectionState==='connected'&&otherVideo.srcObject;
 $('remotePlaceholderSymbol').textContent=bot?'◈':'?';
 $('rivalPlaceholderName').textContent=bot?'OUTBID BOT':other?.name||'RIVAL';
 $('rivalPlaceholderStatus').textContent=bot?'BOT PRACTICE · NO VIDEO':!other?'WAITING FOR RIVAL':link?'LIVE':'CAMERA NOT CONNECTED';
 $('remotePlaceholder').classList.toggle('hidden',!!link&&!bot);
 $('remoteVideo').classList.toggle('hidden',!link||bot);
 $('rivalCameraBadge').textContent=link?'· LIVE':bot?'· BOT':'· OFF';
 $('localBidBadge').textContent=r.phase==='bid'?r.leader===r.you?'YOU LEAD '+money(r.highBid):'RAISE HAND TO BID':'—';
 $('rivalBidBadge').textContent=r.phase==='bid'&&other&&r.leader===other.id?'LEADS '+money(r.highBid):'—';
 if(r.phase==='bid'){
  $('handHint').textContent=r.leader===r.you?'YOU ARE LEADING':'RAISE AN OPEN PALM TO BID';
  if(!cameraStream)$('handState').textContent='Enable camera to raise your hand. The button also works.';
  else if(!gestureEnabled)$('handState').textContent='Hand bidding is off. Use the bid button.';
  else if(r.leader===r.you)$('handState').textContent='You are winning. Lower your hand, then raise again if outbid.';
 }else if(r.phase==='reveal')$('handState').textContent='SOLD! NEXT ITEM COMING UP.';
 else if(r.phase==='done')$('handState').textContent='MATCH OVER. GOOD GAME.';
 else $('handState').textContent='Waiting for an auction to start.';
 if(lastVideoRound!==videoRoundKey()){
  lastVideoRound=videoRoundKey();gestureTracker.reset(lastVideoRound);
  $('gestureCircle').style.setProperty('--angle','0deg');
 }
 updateCameraControls();
}
socket.on('state',r=>{
 updateRemoteVisual(r);
 if(cameraStream&&r.players.length===2&&!isBotMatch())announceVideoReady();
 if(r.phase==='left')stopPeer('Opponent left the match.');
});
function stopPeer(reason){
 if(videoPeer){videoPeer.ontrack=null;videoPeer.onicecandidate=null;videoPeer.close();videoPeer=null}
 otherVideo.srcObject=null;remoteReady=false;videoAnnounced=false;remoteCandidates=[];queuedOffer=null;
 $('remoteVideo').classList.add('hidden');$('remotePlaceholder').classList.remove('hidden');
 if(reason)videoStatus(reason);
 updateCameraControls();
}
function announceVideoReady(){
 if(!cameraStream||!state||state.players.length!==2||isBotMatch()||videoAnnounced)return;
 videoAnnounced=true;socket.emit('videoReady');
 if(remoteReady&&isCaller())offerVideo();
}
function createPeer(){
 if(videoPeer&&videoPeer.signalingState!=='closed')return videoPeer;
 if(!cameraStream)return null;
 const pc=new RTCPeerConnection(rtcOptions);videoPeer=pc;
 for(const track of cameraStream.getTracks())pc.addTrack(track,cameraStream);
 pc.onicecandidate=e=>{if(e.candidate&&socket.connected)socket.emit('signal',{type:'candidate',payload:e.candidate.toJSON()})};
 pc.ontrack=e=>{
  if(!otherVideo.srcObject)otherVideo.srcObject=e.streams[0]||new MediaStream([e.track]);
  otherVideo.play().catch(()=>videoStatus('Tap the video to allow sound.'));
  $('remotePlaceholder').classList.add('hidden');otherVideo.classList.remove('hidden');
  $('connectionLabel').textContent='VIDEO CONNECTING';
 };
 pc.onconnectionstatechange=()=>{
  const status=pc.connectionState;
  if(status==='connected'){videoStatus('Face-to-face video connected. Raise your hand to bid.');$('connectionLabel').textContent='● VIDEO LIVE'}
  else if(status==='failed'){videoStatus('Video link failed on this network. Button bidding still works.');$('connectionLabel').textContent='VIDEO FAILED'}
  else if(status==='disconnected'){$('connectionLabel').textContent='RECONNECTING VIDEO';}
  updateCameraControls();
 };
 return pc;
}
let offerBusy=false;
async function offerVideo(){
 if(!cameraStream||!remoteReady||isBotMatch()||!isCaller()||offerBusy)return;
 const pc=createPeer();if(!pc||pc.signalingState!=='stable')return;
 offerBusy=true;
 try{
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal',{type:'offer',payload:pc.localDescription});
 }catch(e){videoStatus('Could not start video: '+e.message)}
 finally{offerBusy=false}
}
async function acceptOffer(payload){
 if(!cameraStream){queuedOffer=payload;videoStatus('Your rival is ready. Enable camera to join.');return}
 const pc=createPeer();if(!pc)return;
 try{
  await pc.setRemoteDescription(payload);
  await flushRemoteCandidates();
  const answer=await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal',{type:'answer',payload:pc.localDescription});
 }catch(e){videoStatus('Video handshake failed. Try toggling the camera.')}
}
async function flushRemoteCandidates(){
 if(!videoPeer?.remoteDescription)return;
 for(const candidate of remoteCandidates.splice(0))try{await videoPeer.addIceCandidate(candidate)}catch(e){}
}
socket.on('videoReady',()=>{
 remoteReady=true;
 if(cameraStream)announceVideoReady();
 if(cameraStream&&isCaller())offerVideo();
});
socket.on('videoStopped',()=>{stopPeer('Rival stopped sharing video.');});
socket.on('signal',async d=>{
 if(!d||!['offer','answer','candidate'].includes(d.type)||isBotMatch())return;
 try{
  if(d.type==='offer')await acceptOffer(d.payload);
  else if(d.type==='answer'){
   if(videoPeer?.signalingState==='have-local-offer'){await videoPeer.setRemoteDescription(d.payload);await flushRemoteCandidates()}
  }else if(d.type==='candidate'){
   if(videoPeer?.remoteDescription)await videoPeer.addIceCandidate(d.payload);
   else remoteCandidates.push(d.payload);
  }
 }catch(e){videoStatus('Video connection issue: '+e.message)}
});
async function enableCamera(){
 if(cameraStream)return;
 if(!navigator.mediaDevices?.getUserMedia){videoStatus('Camera unavailable in this browser. Button bidding still works.');notice('Your browser does not support camera capture.');return}
 $('startCamera').disabled=true;$('startCamera').textContent='STARTING CAMERA…';
 // iOS's media-playback session can block microphone capture; change before getUserMedia.
 setAudioCaptureMode(true);
 try{
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:18,max:25}},audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(err){
   // If the microphone is blocked or absent, retry with camera only.
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
  }
  cameraStream=stream;localCameraEnabled=stream.getVideoTracks().some(t=>t.enabled);localMicEnabled=stream.getAudioTracks().some(t=>t.enabled);
  setAudioCaptureMode(stream.getAudioTracks().length>0);
  meVideo.srcObject=stream;await meVideo.play().catch(()=>{});
  $('lobbyVideo').srcObject=stream;await $('lobbyVideo').play().catch(()=>{});
  videoStatus('Camera enabled. Raise an open hand high in the frame, then lower it between bids. Other players can screen-record.');
  $('handState').textContent='OPEN PALM IN UPPER HALF OF CAMERA · HOLD FOR ONE SECOND';
  updateCameraControls();
  if(state?.players?.length===2&&!isBotMatch())announceVideoReady();
  if(queuedOffer){const old=queuedOffer;queuedOffer=null;await acceptOffer(old)}
  if(window.Hands){gestureEnabled=true;updateCameraControls();beginHandTracking()}
  else{gestureEnabled=false;updateCameraControls();videoStatus('Camera is live. Hand tracker unavailable; use the bid button.')}
  setMusicDucking(true);
 }catch(e){
  setAudioCaptureMode(false);
  if(e.name==='NotAllowedError')videoStatus('Camera permission denied. You can still bid with the button.');
  else videoStatus('Could not start camera: '+e.message);
  notice('CAMERA NOT AVAILABLE — BUTTON BIDDING WORKS');
 }finally{
  $('startCamera').disabled=false;$('startCamera').textContent='◉ ENABLE VIDEO + MIC';
  updateCameraControls();
 }
}
window.stopOutbidLobbyCamera=function(){
 if(activeMode||!cameraStream)return;
 for(const t of cameraStream.getTracks())t.stop();
 cameraStream=null;localCameraEnabled=false;localMicEnabled=false;gestureEnabled=false;
 if(handsTimer){clearTimeout(handsTimer);handsTimer=null}
 setMusicDucking(false);
 meVideo.srcObject=null;$('lobbyVideo').srcObject=null;
 if(videoPeer)stopPeer('Camera off');
 setAudioCaptureMode(false);
 updateCameraControls();
};
$('lobbyCameraButton').addEventListener('click',async()=>{
 if(!cameraStream){await enableCamera();return}
 for(const t of cameraStream.getTracks())t.stop();
 cameraStream=null;localCameraEnabled=false;localMicEnabled=false;gestureEnabled=false;
 setMusicDucking(false);
 meVideo.srcObject=null;$('lobbyVideo').srcObject=null;
 if(videoPeer)stopPeer('Camera turned off.');
 setAudioCaptureMode(false);
 updateCameraControls();
});
$('startCamera').addEventListener('click',enableCamera);
$('camToggle').addEventListener('click',()=>{
 if(!cameraStream)return;
 const tracks=cameraStream.getVideoTracks();localCameraEnabled=!localCameraEnabled;
 tracks.forEach(t=>t.enabled=localCameraEnabled);
 if(!localCameraEnabled)gestureEnabled=false;
 else if(window.Hands&&!handsBroken){gestureEnabled=true;beginHandTracking()}
 updateCameraControls();
});
$('mic').addEventListener('click',()=>{
 const tracks=cameraStream?.getAudioTracks()||[];
 if(!tracks.length){videoStatus('This camera session has no microphone.');return}
 localMicEnabled=!localMicEnabled;tracks.forEach(t=>t.enabled=localMicEnabled);updateCameraControls();
});
$('mute').addEventListener('click',()=>{
 remoteMuted=!remoteMuted;otherVideo.muted=remoteMuted;updateCameraControls();
});
$('handToggle').addEventListener('click',()=>{
 if(!cameraStream||!localCameraEnabled){notice('ENABLE YOUR CAMERA TO USE HAND BIDDING');return}
 if(handsBroken||!window.Hands){notice('HAND TRACKER UNAVAILABLE — USE BUTTON BIDDING');return}
 gestureEnabled=!gestureEnabled;
 if(gestureEnabled)beginHandTracking();
 else{gestureTracker.reset('disabled-'+Date.now());$('gestureCircle').style.setProperty('--angle','0deg');}
 updateCameraControls();
});
function onHandLandmarks(result){
 const points=result?.multiHandLandmarks?.[0];
 const open=!!(points&&OutbidHand.isRaisedPalm(points));
 const progress=gestureTracker.update(open,Date.now(),isAllowedHandBid());
 $('gestureCircle').style.setProperty('--angle',(progress.progress*360).toFixed(1)+'deg');
 if(!state||state.phase!=='bid')return;
 if(!gestureEnabled)return;
 if(progress.triggered)$('handState').textContent='BID REGISTERED. LOWER HAND TO RESET.';
 else if(!progress.ready)$('handState').textContent='LOWER YOUR HAND BRIEFLY TO REARM.';
 else if(open)$('handState').textContent=progress.progress>.2?'KEEP YOUR PALM UP… '+Math.floor(progress.progress*100)+'%':'OPEN PALM DETECTED — KEEP IT UP';
 else $('handState').textContent='SHOW AN OPEN PALM ABOVE YOUR SHOULDER.';
}
async function initializeHands(){
 if(handsBroken)return false;
 if(handsModel)return true;
 if(typeof window.Hands!=='function')return false;
 try{
  const m=new window.Hands({locateFile:file=>'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/'+file});
  m.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:0.68,minTrackingConfidence:0.62});
  m.onResults(onHandLandmarks);
  handsModel=m;
  return true;
 }catch(e){handsBroken=true;gestureEnabled=false;videoStatus('Hand detection failed to initialize. Use manual bid button.');updateCameraControls();return false}
}
async function beginHandTracking(){
 if(handsTimer||!gestureEnabled||!cameraStream||!localCameraEnabled)return;
 if(!await initializeHands())return;
 async function run(){
  handsTimer=null;
  if(!cameraStream||!gestureEnabled||!localCameraEnabled||handsBroken)return;
  if(document.visibilityState==='visible'&&meVideo.readyState>=2&&!handsBusy){
   handsBusy=true;
   try{await handsModel.send({image:meVideo})}
   catch(e){handsBroken=true;gestureEnabled=false;videoStatus('Hand tracking stopped on this device. The bid button still works.');updateCameraControls()}
   finally{handsBusy=false}
  }
  if(gestureEnabled&&!handsBroken)handsTimer=setTimeout(run,145);
 }
 handsTimer=setTimeout(run,200);
}
$('reportMatch').addEventListener('click',()=>{
 if(!state){location.reload();return}
 if(!confirm('Report this room and leave the match?'))return;
 socket.emit('report',{reason:'unsafe video chat'});
 notice('REPORT SUBMITTED. LEAVING MATCH.');
 setTimeout(()=>location.reload(),300);
});
otherVideo.addEventListener('click',()=>otherVideo.play().catch(()=>{}));
window.addEventListener('pagehide',()=>{
 if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());
 setAudioCaptureMode(false);
 setMusicDucking(false);
 if(videoPeer)videoPeer.close();
});
updateCameraControls();
