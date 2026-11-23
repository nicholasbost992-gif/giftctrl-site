'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Param{
 constructor(){this.value=0}
 setValueAtTime(v){this.value=v}
 exponentialRampToValueAtTime(v){this.value=v}
 setTargetAtTime(v){this.value=v}
}
let notes=0;
class Node{
 constructor(){this.gain=new Param();this.frequency=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param()}
 connect(){return this}
 start(){notes++}
 stop(){}
}
class Context{
 constructor(){this.currentTime=0;this.state='running';this.sampleRate=44100;this.destination=new Node()}
 createDynamicsCompressor(){return new Node()}
 createGain(){return new Node()}
 createOscillator(){return new Node()}
 createBiquadFilter(){return new Node()}
 createBuffer(_channels,count){return {getChannelData:()=>new Float32Array(count)}}
 createBufferSource(){return new Node()}
 resume(){this.state='running';return Promise.resolve()}
}
const controls=new Map(),listeners=new Map(),prefs=new Map();
const session={type:'auto'};
const sandbox={
 window:{AudioContext:Context},
 navigator:{audioSession:session},
 document:{visibilityState:'visible',addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn)}},
 localStorage:{getItem(k){return prefs.get(k)||null},setItem(k,v){prefs.set(k,v)}},
 setInterval(){return 1},clearInterval(){},
 notice(){},
 $:id=>{if(!controls.has(id))controls.set(id,{addEventListener(){},setAttribute(){},textContent:'',value:''});return controls.get(id)},
 console,Math,Number,String,Date
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/soundscape.js','utf8'),sandbox,{timeout:2000});
assert.equal(vm.runInContext('musicWanted',sandbox),true,'Soundtrack should default to ON');
assert.equal(vm.runInContext('musicOn',sandbox),false,'No sound should start before a user gesture');
assert.ok(listeners.has('pointerdown')&&listeners.has('touchend'),'iOS audio must unlock on touch');
vm.runInContext('audioUnlock({target:{closest:()=>false}})',sandbox,{timeout:2000});
assert.equal(vm.runInContext('musicOn',sandbox),true,'First interaction starts music without a second button press');
assert.equal(session.type,'playback','iPhone silent-mode category should allow playback');
vm.runInContext('setAudioCaptureMode(true)',sandbox);
assert.equal(session.type,'play-and-record','Mic capture must switch to a compatible audio session');
vm.runInContext('setAudioCaptureMode(false)',sandbox);
vm.runInContext("setMusicScene('match');playStep(17,0.2);setMusicScene('menu');playStep(25,0.3)",sandbox);
assert.equal(vm.runInContext('musicScene',sandbox),'menu','Scene switching must preserve music mode');
assert.equal(session.type,'playback','Audio should return to silent-mode-compatible playback after capture');
vm.runInContext("setMusicDucking(true);playGameSfx('item');playGameSfx('bid');playGameSfx('outbid');playGameSfx('sold');playGameSfx('win');playGameSfx('loss');playGameSfx('tick');playGameSfx('scan');",sandbox,{timeout:2000});
assert.ok(notes>=20,'Original music and game sound cues should schedule audio notes');
vm.runInContext('toggleMusic()',sandbox);
assert.equal(prefs.get('outbid_music'),'off','Explicitly turning music off should persist');
assert.equal(vm.runInContext('musicOn',sandbox),false,'Explicitly muted music must stop');
vm.runInContext('audioUnlock({target:{closest:()=>false}})',sandbox);
assert.equal(vm.runInContext('musicOn',sandbox),false,'A later tap must not override explicit mute');
vm.runInContext('toggleMusic()',sandbox);
assert.equal(prefs.get('outbid_music'),'on','Turning music back on should persist');
const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
const css=fs.readFileSync('public/styles.css','utf8');
for(const id of ['lotIntro','lotIntroRound','lotIntroTitle','lotIntroPhoto','lotIntroCondition','bidImpact','bidImpactText','musicToggle','effectsToggle','musicVolume','homeSoundButton','gameSoundButton']){
 assert(html.includes('id="'+id+'"'),'Missing audio or animation UI: '+id);
}
assert(html.indexOf('/soundscape.js')<html.indexOf('/app.js'),'Audio should load before state listeners');
assert(app.includes("showLotIntro(r)"),'Item intro must trigger on new auction');
assert(app.includes("flashBid(r)"),'Rival bid flash must trigger on new bid');
assert(app.includes("playGameSfx('tick')"),'Countdown sound should be connected');
assert(css.includes('@keyframes outbid-lot-entrance'),'Item entrance animation missing');
assert(css.includes('prefers-reduced-motion'),'Reduced-motion support missing');
console.log('Soundscape / animation tests passed: first-tap autoplay, persisted mute, iOS silent-mode and mic session categories, 8 effects, transitions.');
