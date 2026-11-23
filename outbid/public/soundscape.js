/* OUTBID ORIGINAL SOUNDTRACK + AUCTION SOUND EFFECTS
   Generated from original synthesis patterns; no external audio or copyrighted samples.
   Music is enabled by default and starts on the first user interaction, as browsers require.
*/
'use strict';
let audioCtx=null,musicOn=false,musicTimer=null,musicBus=null,fxBus=null,step=0,nextBeatAt=0;
let sfxOn=true,volume=.65,musicDucked=false,musicWanted=true,captureAudio=false;
try{
 sfxOn=localStorage.getItem('outbid_sfx')!=='off';
 // Explicitly choosing Music off persists between visits; otherwise it starts on the first tap.
 musicWanted=localStorage.getItem('outbid_music')!=='off';
}catch(e){}
function setIOSAudioSession(){
 // Safari's playback category normally plays through the Ring/Silent switch.
 // When capturing mic audio, use the capture-compatible category instead.
 try{
  if(navigator.audioSession){
   navigator.audioSession.type=captureAudio?'play-and-record':'playback';
  }
 }catch(e){}
}
function setAudioCaptureMode(on){
 captureAudio=!!on;
 setIOSAudioSession();
 if(audioCtx&&musicWanted&&audioCtx.state!=='running'&&audioCtx.state!=='closed'){
  audioCtx.resume().catch(()=>{});
 }
}
let musicScene='menu';
function setMusicScene(scene){
 musicScene=scene==='match'?'match':'menu';
 // Let the current phrase finish, but pick a new rhythm from the next bar.
}
const BPM=112,STEP_SECONDS=60/BPM/4;
function audioReady(){
 if(audioCtx)return audioCtx;
 setIOSAudioSession();
 const AudioCtor=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtor)return null;
 audioCtx=new AudioCtor();
 const limiter=audioCtx.createDynamicsCompressor();
 limiter.threshold.value=-19;limiter.knee.value=14;limiter.ratio.value=3.7;limiter.attack.value=.006;limiter.release.value=.18;
 limiter.connect(audioCtx.destination);
 musicBus=audioCtx.createGain();musicBus.gain.value=0;musicBus.connect(limiter);
 fxBus=audioCtx.createGain();fxBus.gain.value=.55;fxBus.connect(limiter);
 syncAudioGains();
 return audioCtx;
}
function syncAudioGains(){
 if(!audioCtx)return;
 const t=audioCtx.currentTime;
 musicBus.gain.setTargetAtTime(musicOn?(musicDucked?.055:.19)*volume:0,t,.09);
 fxBus.gain.setTargetAtTime(sfxOn?.52:0,t,.04);
}
function setMusicDucking(ducked){musicDucked=!!ducked;syncAudioGains()}
function startWantedMusic(){
 if(!musicWanted)return;
 setIOSAudioSession();
 try{
  const c=audioReady();if(!c)return;
  if(!musicOn){
   musicOn=true;
   step=0;nextBeatAt=c.currentTime+.045;
   if(musicTimer!==null)clearInterval(musicTimer);
   musicTimer=setInterval(scheduler,55);
   syncAudioGains();syncAudioControls();
  }
  // resume() must be invoked synchronously inside the player's first tap.
  if(c.state!=='running'&&c.state!=='closed')c.resume().then(()=>scheduler()).catch(()=>{});
  else scheduler();
 }catch(e){}
}
function audioUnlock(event){
 // Sound toggles handle their own first tap; don't turn music on then immediately off.
 if(event?.target?.closest?.('#musicToggle, #homeSoundButton, #gameSoundButton'))return;
 setIOSAudioSession();
 if(musicWanted){startWantedMusic();return}
 try{
  const c=audioReady();
  if(c&&c.state!=='running'&&c.state!=='closed')c.resume().catch(()=>{});
 }catch(e){}
}
// No unsolicited audio before user input. On iPhone the gesture may be touchend or click.
document.addEventListener('pointerdown',audioUnlock,{capture:true,passive:true});
document.addEventListener('touchend',audioUnlock,{capture:true,passive:true});
document.addEventListener('click',audioUnlock,true);
document.addEventListener('keydown',audioUnlock,true);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&musicWanted&&musicOn){
  setIOSAudioSession();
  if(audioCtx&&audioCtx.state!=='running'&&audioCtx.state!=='closed')audioCtx.resume().catch(()=>{});
 }
});
function osc(freq,time,duration,level,type='sine',dest=musicBus,cutoff=0){
 if(!audioCtx||!dest)return;
 const o=audioCtx.createOscillator(),v=audioCtx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,time);
 v.gain.setValueAtTime(.0001,time);
 v.gain.exponentialRampToValueAtTime(Math.max(.0005,level),time+.009);
 v.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.03,duration));
 if(cutoff){
  const f=audioCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=cutoff;
  o.connect(f);f.connect(v);
 }else o.connect(v);
 v.connect(dest);o.start(time);o.stop(time+duration+.02);
}
function noise(time,duration,level,cutoff=3000,dest=musicBus){
 const length=Math.max(64,Math.floor(audioCtx.sampleRate*duration));
 const buf=audioCtx.createBuffer(1,length,audioCtx.sampleRate),ch=buf.getChannelData(0);
 for(let i=0;i<length;i++)ch[i]=Math.random()*2-1;
 const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),v=audioCtx.createGain();
 src.buffer=buf;f.type='highpass';f.frequency.value=cutoff;
 v.gain.setValueAtTime(level,time);v.gain.exponentialRampToValueAtTime(.0001,time+duration);
 src.connect(f);f.connect(v);v.connect(dest);src.start(time);src.stop(time+duration);
}
function kick(t,level=.44,dest=musicBus){
 const o=audioCtx.createOscillator(),g=audioCtx.createGain();
 o.type='sine';o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(43,t+.15);
 g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
 o.connect(g);g.connect(dest);o.start(t);o.stop(t+.23);
}
function snare(t){noise(t,.15,.11,1250);osc(186,t,.10,.07,'triangle')}
function hat(t,open=false){noise(t,open?.10:.038,open?.036:.021,6500)}
// Eight-bar, originally composed harmonic progression: Am9 -> Fmaj7 -> Cmaj9
// -> G6 -> Dm9 -> Fmaj9 -> Em7 -> E7 turnaround.
const CHORDS=[
 {bass:55,notes:[220,261.63,329.63,392],lead:[440,493.88,523.25,659.25,587.33]},
 {bass:43.65,notes:[174.61,220,261.63,329.63],lead:[349.23,392,440,523.25,493.88]},
 {bass:65.41,notes:[261.63,329.63,392,493.88],lead:[523.25,587.33,659.25,783.99,659.25]},
 {bass:49,notes:[196,246.94,293.66,392],lead:[392,440,493.88,587.33,493.88]},
 {bass:73.42,notes:[146.83,174.61,220,261.63],lead:[293.66,349.23,440,523.25,440]},
 {bass:43.65,notes:[174.61,220,261.63,392],lead:[349.23,440,523.25,587.33,523.25]},
 {bass:82.41,notes:[164.81,196,246.94,293.66],lead:[329.63,392,493.88,587.33,493.88]},
 {bass:82.41,notes:[164.81,207.65,246.94,311.13],lead:[329.63,415.3,493.88,622.25,659.25]}
];
const LEADS=[
 [0,-1,1,-1,2,-1,3,2,0,-1,2,3,4,-1,3,1],
 [0,-1,1,2,-1,3,-1,2,1,-1,4,3,-1,2,1,-1],
 [0,-1,2,-1,1,3,2,-1,4,-1,3,2,1,2,-1,0],
 [-1,1,0,-1,2,3,-1,4,3,-1,2,1,0,-1,1,-1]
];
function bassNote(t,freq,long=false){
 const d=long?.40:.20;
 osc(freq,t,d,.24,'triangle',musicBus,550);
 osc(freq*2,t,d*.8,.047,'sawtooth',musicBus,420);
}
function softPad(t,notes,major){
 notes.forEach((note,i)=>{
  osc(note,t+.025+i*.012,major?1.7:1.2,.009,'sine',musicBus,1400);
  osc(note/2,t+.030+i*.015,major?1.55:1.15,.0055,'triangle',musicBus,460);
 });
}
function rim(t){noise(t,.047,.057,2550);osc(185,t,.036,.028,'triangle')}
function subDrop(t){
 const o=audioCtx.createOscillator(),g=audioCtx.createGain();
 o.type='sine';o.frequency.setValueAtTime(100,t);
 o.frequency.exponentialRampToValueAtTime(36,t+.34);
 g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.28,t+.035);
 g.gain.exponentialRampToValueAtTime(.001,t+.35);
 o.connect(g).connect(musicBus);o.start(t);o.stop(t+.38);
}
function playStep(index,t){
 const beat=index%16,bar=Math.floor(index/16),section=Math.floor(bar/8)%4;
 const chord=CHORDS[bar%CHORDS.length],inMatch=musicScene==='match';
 const breakdown=section===3&&bar%8===7;
 const variation=(bar%8===3||bar%8===7);
 const soft=musicScene==='menu',ghost=bar%2===1;
 if(beat===0){
  kick(t,soft?.29:breakdown?.25:.43);
  softPad(t,chord.notes,soft);
  if(inMatch&&bar%4===0)subDrop(t);
 }
 if(inMatch&&beat===8&&!breakdown)kick(t,.35);
 if(soft){
  if(beat===8)rim(t);
  if([2,6,10,14].includes(beat))hat(t);
 }else{
  if(beat===4||beat===12)snare(t);
  if(beat%2===0&&!breakdown)hat(t,variation&&beat===14);
  if([3,7,11,15].includes(beat)&&!breakdown)noise(t,.027,.018,7000);
  if(ghost&&beat===10)rim(t);
  if(variation&&beat===15)noise(t,.17,.042,2000);
 }
 const pattern=soft?[0,6,10,14]:[0,3,6,8,10,14];
 if(pattern.includes(beat))bassNote(t,chord.bass*(beat===10?1.5:1),beat===0);
 if(!breakdown&&((soft&&beat%2===0)||(inMatch&&[2,5,7,10,13].includes(beat)))){
  const offset=(beat+bar)%chord.notes.length;
  const note=chord.notes[offset]*(soft?1:2);
  osc(note,t,.12,soft?.024:.035,'triangle',musicBus,soft?1600:3000);
 }
 const degree=LEADS[(bar+section)%LEADS.length][beat];
 if(degree>=0&&!breakdown&&((soft&&beat%4===0)||(inMatch&&beat%2===0))){
  const note=chord.lead[degree];
  osc(note,t,soft?.20:.13,soft?.042:.064,'triangle',musicBus,2600);
  if(inMatch&&variation)osc(note*2,t+.017,.062,.009,'sine',musicBus,3900);
 }
 if(inMatch&&beat===15&&bar%8===7){noise(t,.24,.075,2100);osc(987.77,t,.24,.038,'sine')}
}
function scheduler(){
 if(!musicOn||!audioCtx||audioCtx.state!=='running'||document.visibilityState==='hidden')return;
 if(nextBeatAt<audioCtx.currentTime-.25)nextBeatAt=audioCtx.currentTime+.03;
 while(nextBeatAt<audioCtx.currentTime+.20){
  playStep(step,nextBeatAt);
  nextBeatAt+=STEP_SECONDS;step++;
 }
}
function syncAudioControls(){
 const menu=$('musicToggle'),quick=$('gameSoundButton'),home=$('homeSoundButton'),sfx=$('effectsToggle'),slider=$('musicVolume');
 if(menu){menu.setAttribute('aria-pressed',String(musicWanted));$('soundText').textContent=musicWanted?'Music on':'Music off';$('soundIcon').textContent=musicWanted?'♫':'♪'}
 if(quick){quick.textContent=musicWanted?'♫ Music on':'♪ Music off';quick.setAttribute('aria-pressed',String(musicWanted))}
 if(home){home.textContent=musicWanted?'♫ Soundtrack on':'♪ Play soundtrack';home.setAttribute('aria-pressed',String(musicWanted))}
 if(sfx){sfx.textContent=sfxOn?'Sound effects on':'Sound effects off';sfx.setAttribute('aria-pressed',String(sfxOn))}
 if(slider)slider.value=String(Math.round(volume*100));
}
function toggleMusic(){
 musicWanted=!musicWanted;
 try{localStorage.setItem('outbid_music',musicWanted?'on':'off')}catch(e){}
 if(musicWanted){
  startWantedMusic();
  notice('Music on');
 }else{
  musicOn=false;
  if(musicTimer!==null){clearInterval(musicTimer);musicTimer=null}
  syncAudioGains();
  notice('Music off');
 }
 syncAudioControls();
}
function toggleEffects(){
 sfxOn=!sfxOn;try{localStorage.setItem('outbid_sfx',sfxOn?'on':'off')}catch(e){}
 audioUnlock();syncAudioGains();syncAudioControls();
 if(sfxOn)playGameSfx('click');
}
function playGameSfx(kind){
 if(!sfxOn)return;
 const c=audioReady();if(!c||c.state!=='running')return;
 const t=c.currentTime+.018;
 try{
  switch(kind){
   case 'item':
    noise(t,.36,.11,1300,fxBus);
    [261.63,392,523.25,783.99].forEach((n,i)=>osc(n,t+i*.085,.18,.13-(i*.012),'triangle',fxBus));
    kick(t+.27,.19,fxBus);
    break;
   case 'bid':
    osc(430,t,.1,.18,'triangle',fxBus);
    osc(660,t+.075,.15,.16,'sine',fxBus);
    break;
   case 'outbid':
    osc(622.25,t,.09,.14,'triangle',fxBus);
    osc(415.3,t+.085,.16,.16,'triangle',fxBus);
    noise(t+.04,.065,.045,3400,fxBus);
    break;
   case 'sold':
    // Three short auction-gavel-like wooden thuds followed by a warm bell.
    [0,.085,.16].forEach((delay,i)=>{kick(t+delay,.29-(i*.07),fxBus);noise(t+delay,.035,.11-(i*.018),850,fxBus)});
    osc(523.25,t+.23,.37,.11,'sine',fxBus);
    break;
   case 'win':
    [392,493.88,587.33,783.99].forEach((n,i)=>osc(n,t+i*.095,.25,.16,'triangle',fxBus));
    break;
   case 'loss':
    [392,349.23,293.66].forEach((n,i)=>osc(n,t+i*.13,.23,.12,'triangle',fxBus));
    break;
   case 'tick':
    osc(720,t,.055,.07,'sine',fxBus);
    break;
   case 'scan':
    osc(490,t,.095,.12,'sine',fxBus);
    osc(740,t+.10,.12,.13,'triangle',fxBus);
    break;
   case 'click':
   default:osc(540,t,.065,.075,'triangle',fxBus);
  }
 }catch(e){}
}
// Legacy calls from game code use a short confirmation chime; keep compatibility.
function playAccent(){playGameSfx('click')}
document.addEventListener('DOMContentLoaded',()=>{
// Do not claim an exclusive playback session before the player interacts.
$('musicToggle').addEventListener('click',toggleMusic);
$('effectsToggle').addEventListener('click',toggleEffects);
$('musicVolume').addEventListener('input',e=>{volume=Math.max(0,Math.min(1,Number(e.target.value)/100));syncAudioGains();syncAudioControls()});
$('gameSoundButton').addEventListener('click',toggleMusic);
$('homeSoundButton').addEventListener('click',toggleMusic);
syncAudioControls();
});
