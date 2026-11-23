/* Open-palm bidding gesture. Runs entirely on the device; landmarks never leave the browser. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OutbidHand=api;
})(typeof window!=='undefined'?window:null,function(){
 function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
 function isRaisedPalm(points){
  if(!Array.isArray(points)||points.length<21)return false;
  const wrist=points[0],middle=points[9];
  if(!wrist||!middle||middle.y>.63||middle.y<-.02)return false;
  const pairs=[[8,6],[12,10],[16,14],[20,18]];
  let extended=0;
  for(const [tip,pip] of pairs){
   if(points[tip]&&points[pip]&&points[tip].y<points[pip].y-.018&&distance(points[tip],wrist)>distance(points[pip],wrist)*1.13)extended++;
  }
  return extended>=3;
 }
 class Tracker{
  constructor(onRaise){this.onRaise=onRaise;this.armed=true;this.start=null;this.missingSince=null;this.cooldown=0;this.lastRound=null;}
  reset(round){
   if(round===this.lastRound)return;
   this.lastRound=round;
   this.armed=false;this.start=null;this.missingSince=null;
  }
  update(isOpen,now=Date.now(),canBid=true){
   if(!isOpen){
    this.start=null;
    if(this.missingSince===null)this.missingSince=now;
    if(now-this.missingSince>550)this.armed=true;
    return {progress:0,ready:this.armed,triggered:false};
   }
   this.missingSince=null;
   if(!this.armed||now<this.cooldown)return {progress:0,ready:this.armed,triggered:false};
   if(this.start===null)this.start=now;
   const progress=Math.min(1,(now-this.start)/850);
   if(progress>=1&&canBid){
    this.armed=false;this.start=null;this.cooldown=now+1400;
    if(typeof this.onRaise==='function')this.onRaise();
    return {progress:1,ready:false,triggered:true};
   }
   return {progress,ready:true,triggered:false};
  }
 }
 return {isRaisedPalm,Tracker};
});
