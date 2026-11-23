'use strict';
const assert=require('node:assert/strict');
const {ITEMS,makeLots,categoriesCount}=require('../items.js');
const {visualFor}=require('../visuals.js');
assert.equal(ITEMS.length,1200,'There should be exactly 1200 authored unique lots');
assert.equal(categoriesCount,45,'45 distinct categories must be included');
const byName=new Map(ITEMS.map(i=>[i.name,i]));
assert.equal(byName.size,ITEMS.length,'Each lot must have a unique name');
assert.equal(new Set(ITEMS.map(i=>i.category)).size,categoriesCount,'All categories must be nonempty');
for(const item of ITEMS){
 assert.ok(item.name&&item.name.length<=75,'Item name must be readable: '+item.name);
 assert.ok(item.category&&item.category.length<=32);
 assert.ok(item.emoji);
 assert.ok(Number.isInteger(item.base)&&item.base>=0&&item.base<30000,'Invalid lot value: '+item.name);
 assert.ok(item.image===null||/^photo-[a-z0-9-]{12,}$/.test(item.image),'Unexpected photo asset');
}
// Never show a car image for an E-MOTO, or a pristine product photo for junk.
assert.equal(ITEMS.filter(x=>x.junk).length,100,'One hundred distinct worthless finds');
assert.ok(ITEMS.some(x=>x.junk&&x.base===0),'Some worthless items should be worth zero');
assert.ok(ITEMS.filter(x=>x.image).length>50,'Retain safe representative product photography');
assert.ok(ITEMS.filter(x=>x.category==='E-MOTO').every(x=>x.image===null),'Never show a petrol bike/car stock photo for E-MOTO');
assert.ok(ITEMS.filter(x=>x.junk).every(x=>x.image===null),'Junk must never be shown as pristine stock imagery');
assert.deepEqual(visualFor({name:'Extended E-Moto Seat',category:'E-MOTO',emoji:'⚡'}),{image:null,emoji:'🪑'});
assert.equal(visualFor({name:'Cracked Android Phone',category:'JUNK & BROKEN',emoji:'🗑️',junk:true}).image,null);
assert.equal(visualFor({name:'Sportbike Track Weapon',category:'MOTORCYCLES',emoji:'🏍️'}).image,null);
assert.equal(visualFor({name:'Diamond Chronograph Watch',category:'LUXURY WATCHES',emoji:'⌚'}).image,'photo-1523275335684-37898b6baf30');
let checked=0;const first100=new Set();
for(let match=0;match<120;match++){
 const lots=makeLots();
 assert.equal(lots.length,5,'Exactly five lots per game');
 assert.equal(new Set(lots.map(i=>i.name)).size,5,'No duplicate items within a match');
 assert.equal(new Set(lots.map(i=>i.category)).size,5,'Give each round a different category');
 const bases=lots.map(l=>byName.get(l.name).base);
 assert.equal(lots.filter(l=>l.junk).length,1,'One junk lot per match');
 assert.equal(bases.filter(v=>v<=1200).length,2,'Include junk and a cheap find');
 assert.equal(bases.filter(v=>v>1200&&v<=8000).length,2,'Include two mid-tier items');
 assert.equal(bases.filter(v=>v>8000).length,1,'Include one high-stakes item');
 for(const lot of lots){
  assert.ok(lot.value>=0&&(lot.junk?lot.value%10===0:lot.value%100===0),'Round value is a valid in-game valuation');
  assert.ok(lot.clue&&lot.condition&&lot.category&&lot.emoji,'Every lot has useful display data');
  assert.equal(typeof lot.name,'string');
  if(match<20){assert.ok(!first100.has(lot.name),'Recently used lot should not repeat');first100.add(lot.name)}
  checked++;
 }
}
console.log('Auction catalog passed: '+ITEMS.length+' unique lots, '+categoriesCount+' categories, '+checked+' sampled rounds, no recent repeats or duplicate categories.');
