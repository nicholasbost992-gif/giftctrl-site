'use strict';
const assert=require('node:assert/strict');
const {isRaisedPalm,Tracker}=require('../public/hand-gesture.js');
function openHand(){
 const points=Array.from({length:21},()=>({x:.5,y:.65}));
 points[0]={x:.5,y:.8};points[9]={x:.5,y:.46};
 for(const [tip,pip,x] of [[8,6,.36],[12,10,.46],[16,14,.56],[20,18,.66]]){
  points[pip]={x,y:.55};points[tip]={x,y:.24};
 }
 return points;
}
const hand=openHand();
assert.equal(isRaisedPalm(hand),true,'An open palm held high is detected');
const fist=hand.map(p=>({...p}));for(const t of [8,12,16,20])fist[t].y=.65;
assert.equal(isRaisedPalm(fist),false,'A closed fist is not a raised hand');
const low=hand.map(p=>({...p,y:p.y+.25}));
assert.equal(isRaisedPalm(low),false,'A low hand does not trigger');
assert.equal(isRaisedPalm([]),false,'Missing landmarks do not trigger');
let count=0;
const g=new Tracker(()=>count++);
g.update(true,0,true);
g.update(true,400,true);
assert.equal(count,0,'A short flick cannot bid');
const first=g.update(true,900,true);
assert.equal(first.triggered,true);
assert.equal(count,1,'A held open palm bids once');
g.update(true,1900,true);g.update(true,2600,true);
assert.equal(count,1,'Continuously holding the hand up cannot spam bids');
g.update(false,2700,true);g.update(false,3310,true);
g.update(true,3400,true);g.update(true,4320,true);
assert.equal(count,2,'Lowering and raising again places another bid');
g.reset('next-round');
g.update(true,5000,true);g.update(true,6000,true);
assert.equal(count,2,'Holding a hand between rounds cannot auto-bid');
g.update(false,6200,true);g.update(false,6800,true);g.update(true,6900,true);g.update(true,7850,true);
assert.equal(count,3,'After re-arming, the new round supports bidding');
const noBid=new Tracker(()=>count++);
noBid.update(true,0,false);noBid.update(true,900,false);
assert.equal(count,3,'No bid outside an active auction');
console.log('Hand-gesture tests passed: palm, fist, low hand, hold, cooldown, re-arm and round transition.');
