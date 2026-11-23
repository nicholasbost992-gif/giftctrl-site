/* OUTBID ORIGINAL SOUNDTRACK + AUCTION SOUND EFFECTS
   Generated from original synthesis patterns; no external audio or copyrighted samples.
   Music and effects are independently switchable, and never auto-play on page load.
*/
'use strict';
let audioCtx=null,musicOn=false,musicTimer=null,musicBus=null,fxBus=null,step=0,nextBeatAt=0;
let sfxOn=true,volume=.65,musicDucked=false;
try{sfxOn=localStorage.getItem('outbid_sfx')!=='off'}catch(e){}
const BPM=114,STEP_SECONDS=60/BPM/4;
function audioReady(){
 if(audioCtx)return audioCtx;
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
function audioUnlock(){
 try{const c=audioReady();if(c&&c.state!=='running')c.resume().catch(()=>{})}catch(e){}
}
document.addEventListener('pointerdown',audioUnlock,{passive:true});
document.addEventListener('keydown',audioUnlock);
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
const CHORDS=[
 {root:110,notes:[220,261.63,329.63,392],bass:55},
 {root:98,notes:[196,246.94,293.66,369.99],bass:49},
 {root:130.81,notes:[261.63,329.63,392,493.88],bass:65.406},
 {root:87.31,notes:[174.61,220,261.63,329.63],bass:43.65}
];
function playStep(index,t){
 const beat=index%16,bar=Math.floor(index/16),chord=CHORDS[bar%4];
 if(beat===0||beat===8)kick(t,beat===0?.48:.36);
 if(beat===4||beat===12)snare(t);
 if(beat%2===0)hat(t,beat===6||beat===14);
 if(beat===3||beat===11)noise(t,.02,.016,7500);
 if([0,3,6,10,14].includes(beat)){
  const bass=chord.bass*(beat===10?1.5:1);
  osc(bass,t,.21,.20,'triangle',musicBus,700);
  osc(bass*2,t,.15,.034,'sawtooth',musicBus,650);
 }
 if(beat===0){
  chord.notes.forEach((note,k)=>osc(note,t+.03+k*.003,1.65,.011,'sine',musicBus,1100));
 }
 const melody=[0,0,2,0,1,0,0,3,0,2,0,1,0,0,3,2];
 const degree=melody[beat];
 if(degree && beat%2===0){
  const note=chord.notes[(degree+bar)%chord.notes.length]*2;
  osc(note,t,.15,.046,'triangle',musicBus,2300);
  osc(note*2,t,.065,.012,'sine');
 }
 if(beat===15&&bar%4===3)noise(t,.18,.035,2500);
}
function scheduler(){
 if(!musicOn||!audioCtx||audioCtx.state!=='running')return;
 while(nextBeatAt<audioCtx.currentTime+.20){
  playStep(step,nextBeatAt);
  nextBeatAt+=STEP_SECONDS;step++;
 }
}
function syncAudioControls(){
 const menu=$('musicToggle'),quick=$('gameSoundButton'),home=$('homeSoundButton'),sfx=$('effectsToggle'),slider=$('musicVolume');
 if(menu){menu.setAttribute('aria-pressed',String(musicOn));$('soundText').textContent=musicOn?'Music on':'Music off';$('soundIcon').textContent=musicOn?'♫':'♪'}
 if(quick){quick.textContent=musicOn?'♫ Music on':'♪ Music off';quick.setAttribute('aria-pressed',String(musicOn))}
 if(home){home.textContent=musicOn?'♫ Soundtrack on':'♪ Play soundtrack';home.setAttribute('aria-pressed',String(musicOn))}
 if(sfx){sfx.textContent=sfxOn?'Sound effects on':'Sound effects off';sfx.setAttribute('aria-pressed',String(sfxOn))}
 if(slider)slider.value=String(Math.round(volume*100));
}
async function toggleMusic(){
 try{
  const c=audioReady();if(!c){notice('Your browser does not support audio.');return}
  await c.resume();
  musicOn=!musicOn;
  if(musicOn){step=0;nextBeatAt=c.currentTime+.04;scheduler();musicTimer=setInterval(scheduler,55)}
  else{clearInterval(musicTimer);musicTimer=null}
  syncAudioGains();syncAudioControls();
  notice(musicOn?'Soundtrack on':'Soundtrack off');
 }catch(e){notice('Audio could not be enabled in this browser.')}
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
    noise(t,.27,.06,1700,fxBus);
    [392,587.33,783.99,1174.66].forEach((n,i)=>osc(n,t+i*.09,.19,.14-(i*.015),'triangle',fxBus));
    break;
   case 'bid':
    osc(430,t,.1,.18,'triangle',fxBus);
    osc(660,t+.075,.15,.16,'sine',fxBus);
    break;
   case 'outbid':
    osc(440,t,.10,.13,'sine',fxBus);
    osc(330,t+.10,.18,.14,'triangle',fxBus);
    break;
   case 'sold':
    kick(t,.30,fxBus);noise(t,.10,.12,1300,fxBus);
    osc(261.63,t+.13,.18,.11,'triangle',fxBus);
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
$('musicToggle').addEventListener('click',toggleMusic);
$('effectsToggle').addEventListener('click',toggleEffects);
$('musicVolume').addEventListener('input',e=>{volume=Math.max(0,Math.min(1,Number(e.target.value)/100));syncAudioGains();syncAudioControls()});
$('gameSoundButton').addEventListener('click',toggleMusic);
$('homeSoundButton').addEventListener('click',toggleMusic);
syncAudioControls();
