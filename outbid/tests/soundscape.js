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
const controls=new Map();
const sandbox={
 window:{AudioContext:Context},
 document:{addEventListener(){}},
 localStorage:{getItem(){return null},setItem(){}},
 setInterval(){return 1},clearInterval(){},
 notice(){},
 $:id=>{if(!controls.has(id))controls.set(id,{addEventListener(){},setAttribute(){},textContent:'',value:''});return controls.get(id)},
 console,Math,Number,String,Date
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('public/soundscape.js','utf8'),sandbox,{timeout:2000});
vm.runInContext("audioReady();musicOn=true;nextBeatAt=0;scheduler();setMusicDucking(true);playGameSfx('item');playGameSfx('bid');playGameSfx('outbid');playGameSfx('sold');playGameSfx('win');playGameSfx('loss');playGameSfx('tick');playGameSfx('scan');",sandbox,{timeout:2000});
assert.ok(notes>=20,'Original music and game sound cues should schedule audio notes');
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
console.log('Soundscape / animation tests passed: original music, 8 game effects, all popup UI references and transitions.');
