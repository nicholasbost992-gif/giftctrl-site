const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const app=express(),server=http.createServer(app),io=new Server(server);
const rooms=new Map(),queue=[];
const items=[
  ['Mystery Supercar',1800,'🏎️'],['Old Watch',7600,'⌚'],['Storage Locker',13500,'📦'],
  ['Vintage Arcade',8900,'🕹️'],['Art Canvas',16400,'🖼️'],['Designer Bag',400,'👜'],
  ['Retro Console',14200,'🎮'],['Gold Coin',9600,'🪙'],['Mystery Safe',2200,'💎'],
  ['Sports Coupe',10500,'🚘']
];
const BASE_BID_TIME=24000,REVEAL_TIME=4700,MIN_RAISE=100,APPRAISAL_COST=300;
const quality=[
 {label:'ROUGH',factor:[0.32,0.64],notes:['SOLD AS-IS · May need work','SELLER NOTE · Condition is uncertain','COLLECTOR NOTE · Some parts look worn']},
 {label:'USED',factor:[0.68,1.05],notes:['SELLER NOTE · Normal wear visible','INSPECTOR NOTE · Appears complete','SELLER NOTE · Previously owned and maintained']},
 {label:'PRISTINE',factor:[1.07,1.62],notes:['COLLECTOR NOTE · Excellent condition','INSPECTOR NOTE · Exceptional preservation','SELLER NOTE · Scarce edition claimed']}
];
function makeLots(){
 return [...items].sort(()=>Math.random()-.5).slice(0,5).map(([name,base,emoji])=>{
  const q=quality[Math.floor(Math.random()*quality.length)];
  const value=Math.max(100,Math.round(base*(q.factor[0]+Math.random()*(q.factor[1]-q.factor[0]))/100)*100);
  return {name,value,emoji,clue:q.notes[Math.floor(Math.random()*q.notes.length)],condition:q.label};
 });
}
function estimate(value){
 const variance=0.13+Math.random()*0.07;
 const low=Math.max(0,Math.floor(value*(1-variance)/100)*100);
 const high=Math.ceil(value*(1+variance)/100)*100;
 return {low,high};
}
function showMoney(n){return '$'+n.toLocaleString('en-US')}
function room(priv){
 const code=crypto.randomBytes(3).toString('hex').toUpperCase();
 const r={code,priv,players:[],round:0,phase:'wait',lots:makeLots(),
  highBid:0,leader:null,bidCount:0,endsAt:0,extensions:0,result:null,bot:false,botTimer:null,timer:null};
 rooms.set(code,r);return r;
}
function emit(r){
 for(const p of r.players){
  const currentLeader=r.players.find(x=>x.id===r.leader);
  io.to(p.id).emit('state',{
   code:r.code,phase:r.phase,round:r.round+1,
   players:r.players.map(x=>({id:x.id,name:x.name,cash:x.cash,collection:x.collection})),
   you:p.id,
   lot:r.phase==='bid'?{name:r.lots[r.round].name,emoji:r.lots[r.round].emoji,clue:r.lots[r.round].clue,condition:r.lots[r.round].condition}:null,
   appraisal:p.appraisals?.[r.round]||null,scansRemaining:p.scans||0,appraisalCost:APPRAISAL_COST,
   highBid:r.highBid,leader:r.leader,leaderName:currentLeader?currentLeader.name:null,
   bidCount:r.bidCount,minBid:r.highBid+MIN_RAISE,
   endsAt:r.endsAt,result:r.result
  });
 }
}
function join(s,r,name){
 if(r.players.length>=2)return s.emit('errorMessage','Room full');
 const p={id:s.id,name:String(name||'Player').trim().slice(0,18)||'Player',cash:10000,collection:0,scans:2,appraisals:{}};
 r.players.push(p);s.data.room=r.code;s.join(r.code);emit(r);
 if(r.players.length===2)start(r);
}
function scheduleRoundEnd(r){
 clearTimeout(r.timer);
 r.timer=setTimeout(()=>resolve(r),Math.max(0,r.endsAt-Date.now()));
}
function scheduleBot(r){
 if(!r.bot||r.phase!=='bid'||r.leader==='bot'||r.botTimer||Date.now()>=r.endsAt)return;
 const bot=r.players.find(p=>p.id==='bot');
 if(!bot||r.highBid+MIN_RAISE>Math.min(bot.cash,r.botCeiling))return;
 r.botTimer=setTimeout(()=>{
  r.botTimer=null;
  if(r.phase!=='bid'||Date.now()>=r.endsAt||r.leader==='bot')return;
  const bot=r.players.find(p=>p.id==='bot');
  if(!bot)return;
  const min=r.highBid+MIN_RAISE;
  if(min>Math.min(bot.cash,r.botCeiling))return;
  const jump=r.highBid===0?Math.floor((200+Math.random()*450)/100)*100:
    Math.floor((100+Math.random()*500)/100)*100;
  const target=Math.min(bot.cash,r.botCeiling,Math.max(min,r.highBid+jump));
  placeBid(r,bot,target);
 },1100+Math.random()*1600);
}
function start(r){
 if(r.round>=5){r.phase='done';r.endsAt=0;emit(r);return;}
 clearTimeout(r.timer);clearTimeout(r.botTimer);r.botTimer=null;
 r.phase='bid';r.highBid=0;r.leader=null;r.bidCount=0;r.extensions=0;r.result=null;
 r.endsAt=Date.now()+BASE_BID_TIME;
 const bot=r.players.find(p=>p.id==='bot');
 if(bot)r.botCeiling=Math.min(bot.cash,Math.max(100,Math.round(
    r.lots[r.round].value*(0.45+Math.random()*0.85)/100)*100));
 emit(r);scheduleRoundEnd(r);scheduleBot(r);
}
function placeBid(r,player,n){
 if(r.phase!=='bid'||Date.now()>=r.endsAt)return {error:'The round has ended'};
 if(r.leader===player.id)return {error:'You already have the highest bid'};
 if(!Number.isSafeInteger(n)||n<r.highBid+MIN_RAISE||n>player.cash)
  return {error:'Bid at least '+showMoney(r.highBid+MIN_RAISE)+' (available '+showMoney(player.cash)+')'};
 r.highBid=n;r.leader=player.id;r.bidCount++;
 // Give everyone a brief chance to react to a last-second bid. Never extend indefinitely.
 if(r.endsAt-Date.now()<3500&&r.extensions<2){r.endsAt+=4000;r.extensions++;scheduleRoundEnd(r);}
 emit(r);
 if(player.id!=='bot')scheduleBot(r);
 return {ok:true};
}
function resolve(r){
 if(r.phase!=='bid')return;
 clearTimeout(r.timer);clearTimeout(r.botTimer);r.botTimer=null;
 const w=r.players.find(p=>p.id===r.leader)||null;
 const price=w?r.highBid:0;
 if(w){w.cash-=price;w.collection+=r.lots[r.round].value;}
 r.result={winner:w?.name||'Nobody',winnerId:w?.id||null,price,value:r.lots[r.round].value,item:r.lots[r.round].name,profit:r.lots[r.round].value-price,condition:r.lots[r.round].condition};
 r.phase='reveal';r.endsAt=Date.now()+REVEAL_TIME;emit(r);
 r.timer=setTimeout(()=>{r.round++;start(r)},REVEAL_TIME);
}
io.on('connection',s=>{
 s.on('solo',name=>{
  if(s.data.room)return;
  const r=room(true);r.bot=true;join(s,r,name);
  r.players.push({id:'bot',name:'OUTBID BOT',cash:10000,collection:0,scans:0,appraisals:{}});start(r);
 });
 s.on('find',name=>{
  if(s.data.room)return;
  while(queue.length){
   const r=rooms.get(queue.shift());
   if(r&&r.phase==='wait'&&r.players.length===1)return join(s,r,name);
  }
  const r=room(false);join(s,r,name);queue.push(r.code);
 });
 s.on('create',name=>{if(!s.data.room)join(s,room(true),name)});
 s.on('join',({code,name}={})=>{
  const r=rooms.get(String(code||'').toUpperCase());
  if(!r||r.phase!=='wait')return s.emit('errorMessage','Room unavailable');
  join(s,r,name);
 });
 s.on('bid',amount=>{
  const r=rooms.get(s.data.room);
  if(!r||r.phase!=='bid')return s.emit('errorMessage','Auction is not open');
  const p=r.players.find(x=>x.id===s.id),n=Number(amount);
  if(!p)return;
  const outcome=placeBid(r,p,n);
  if(outcome.error)s.emit('errorMessage',outcome.error);
 });
 s.on('appraise',()=>{
  const r=rooms.get(s.data.room);
  if(!r||r.phase!=='bid'||Date.now()>=r.endsAt)return s.emit('errorMessage','Appraisal unavailable');
  const p=r.players.find(x=>x.id===s.id);
  if(!p)return;
  if(p.appraisals[r.round])return s.emit('errorMessage','You already scanned this lot');
  if(p.scans<=0)return s.emit('errorMessage','No appraisals remaining');
  if(p.cash<APPRAISAL_COST)return s.emit('errorMessage','Not enough cash for an appraisal');
  p.cash-=APPRAISAL_COST;p.scans--;
  p.appraisals[r.round]=estimate(r.lots[r.round].value);
  emit(r);
 });
 s.on('videoReady',()=>{
  const r=rooms.get(s.data.room);
  if(!r||r.players.length!==2)return;
  const other=r.players.find(p=>p.id!==s.id&&p.id!=='bot');
  if(other)io.to(other.id).emit('videoReady');
 });
 s.on('videoStopped',()=>{
  const r=rooms.get(s.data.room);
  if(!r)return;
  const other=r.players.find(p=>p.id!==s.id&&p.id!=='bot');
  if(other)io.to(other.id).emit('videoStopped');
 });
 s.on('report',data=>{
  const r=rooms.get(s.data.room);
  if(!r||!r.players.some(p=>p.id===s.id))return;
  console.warn('OUTBID report received',JSON.stringify({time:new Date().toISOString(),room:r.code,reporter:s.id,reason:String(data?.reason||'video').slice(0,40)}));
  s.emit('reported');
 });
 s.on('chat',message=>{
  const r=rooms.get(s.data.room);
  if(!r||!r.players.some(p=>p.id===s.id))return;
  const now=Date.now();if(now-(s.data.lastChat||0)<700)return;
  s.data.lastChat=now;
  const msg=String(message||'').trim().slice(0,240);
  if(msg)io.to(r.code).emit('chat',{from:r.players.find(p=>p.id===s.id).name,text:msg});
 });
 s.on('voiceReady',()=>{
  const r=rooms.get(s.data.room);
  if(r&&r.players.length===2){
   const other=r.players.find(p=>p.id!==s.id);
   if(other&&other.id!=='bot')io.to(other.id).emit('voiceReady');
  }
 });
 s.on('signal',data=>{
  const r=rooms.get(s.data.room);
  if(!r||r.players.length!==2||!data||!['offer','answer','candidate'].includes(data.type))return;
  const other=r.players.find(p=>p.id!==s.id);
  if(other&&other.id!=='bot')io.to(other.id).emit('signal',{type:data.type,payload:data.payload});
 });
 s.on('disconnect',()=>{
  const r=rooms.get(s.data.room);if(!r)return;
  clearTimeout(r.timer);clearTimeout(r.botTimer);r.botTimer=null;
  r.phase='left';emit(r);rooms.delete(r.code);
 });
});
const Stripe=require('stripe');const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;const secret=process.env.SESSION_SECRET||null;const baseUrl=process.env.PUBLIC_URL||'https://outbid-live-game.onrender.com';app.use(express.json({limit:'16kb'}));function signed(customer){let sig=crypto.createHmac('sha256',secret).update(customer).digest('hex');return customer+'.'+sig}function customerFrom(req){if(!secret)return null;let cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('outbid_customer='));if(!cookie)return null;let val=decodeURIComponent(cookie.slice(16)),i=val.lastIndexOf('.');if(i<0)return null;let id=val.slice(0,i),sig=val.slice(i+1),expected=crypto.createHmac('sha256',secret).update(id).digest('hex');if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;return id.startsWith('cus_')?id:null}function setCustomer(res,id){res.setHeader('Set-Cookie','outbid_customer='+encodeURIComponent(signed(id))+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000')}async function proStatus(id){if(!stripe||!id)return false;const subs=await stripe.subscriptions.list({customer:id,status:'all',limit:100});return subs.data.some(s=>['active','trialing'].includes(s.status)&&s.items.data.some(i=>i.price.id===process.env.STRIPE_PRICE_ID))}app.get('/api/pro/status',async(req,res)=>{try{const id=customerFrom(req);res.json({configured:!!(stripe&&secret&&process.env.STRIPE_PRICE_ID),pro:await proStatus(id),hasCustomer:!!id})}catch(e){res.status(503).json({error:'Subscription status unavailable'})}});app.post('/api/pro/checkout',async(req,res)=>{if(!stripe||!secret||!process.env.STRIPE_PRICE_ID)return res.status(503).json({error:'PRO checkout is not enabled yet'});try{const id=customerFrom(req);const session=await stripe.checkout.sessions.create({mode:'subscription',line_items:[{price:process.env.STRIPE_PRICE_ID,quantity:1}],...(id?{customer:id}:{}),success_url:baseUrl+'/?checkout_session={CHECKOUT_SESSION_ID}',cancel_url:baseUrl+'/?checkout=cancelled',allow_promotion_codes:true});res.json({url:session.url})}catch(e){res.status(500).json({error:'Could not start checkout'})}});app.get('/api/pro/confirm',async(req,res)=>{if(!stripe||!secret)return res.status(503).json({error:'Payments not configured'});try{let sid=String(req.query.session||'');if(!sid.startsWith('cs_'))return res.status(400).json({error:'Invalid checkout session'});let session=await stripe.checkout.sessions.retrieve(sid);if(session.mode!=='subscription'||session.status!=='complete'||!session.customer)return res.status(400).json({error:'Checkout incomplete'});if(!await proStatus(session.customer))return res.status(409).json({error:'Subscription not active yet'});setCustomer(res,session.customer);res.json({pro:true})}catch(e){res.status(500).json({error:'Unable to verify checkout'})}});app.post('/api/pro/portal',async(req,res)=>{if(!stripe)return res.status(503).json({error:'Payments not configured'});let id=customerFrom(req);if(!id)return res.status(401).json({error:'No linked subscription on this browser'});try{let p=await stripe.billingPortal.sessions.create({customer:id,return_url:baseUrl});res.json({url:p.url})}catch(e){res.status(500).json({error:'Billing portal unavailable'})}});app.get('/health',(req,res)=>res.json({ok:true}));const path=require('path');app.use(express.static(path.join(__dirname,'public'),{maxAge:0,setHeaders:(res,file)=>{if(file.endsWith('.html')||file.endsWith('.js')||file.endsWith('.css'))res.setHeader('Cache-Control','no-store')}}));app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));server.listen(process.env.PORT||3000);