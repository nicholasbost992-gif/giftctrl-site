'use strict';
// Runs against a locally spawned OUTBID server so bidding rules are tested over real sockets.
const assert=require('node:assert/strict');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {io}=require('socket.io-client');

function next(socket,event,predicate=()=>true,ms=10000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{
   socket.off(event,onEvent);
   reject(new Error('Timed out waiting for '+event+' on '+socket.id));
  },ms);
  function onEvent(data){
   if(!predicate(data))return;
   clearTimeout(timer);socket.off(event,onEvent);resolve(data);
  }
  socket.on(event,onEvent);
 });
}
async function availablePort(){
 const s=net.createServer();
 await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve)});
 const port=s.address().port;await new Promise(resolve=>s.close(resolve));
 return port;
}
(async()=>{
 let server=null,logs='',clients=[];
 try{
  const port=await availablePort();
  server=spawn(process.execPath,['server.js'],{
   cwd:require('node:path').join(__dirname,'..'),
   env:{...process.env,PORT:String(port),STRIPE_SECRET_KEY:'',SESSION_SECRET:''},
   stdio:['ignore','pipe','pipe']
  });
  server.stdout.on('data',d=>{logs+=d.toString().slice(0,1000)});
  server.stderr.on('data',d=>{logs+=d.toString().slice(0,1000)});
  server.on('error',e=>{logs+=String(e)});
  async function connect(){
   const c=io('http://127.0.0.1:'+port,{
    transports:['websocket'],reconnection:true,reconnectionAttempts:30,reconnectionDelay:100,timeout:2500
   });
   clients.push(c);
   if(!c.connected)await next(c,'connect',()=>true,12000);
   return c;
  }
  const alice=await connect(),bob=await connect();
  const waiting=next(alice,'state',r=>r.phase==='wait');
  alice.emit('create','Alice');
  const room=await waiting;
  assert.match(room.code,/^[A-F0-9]{6}$/);
  const joined=next(alice,'state',r=>r.phase==='bid'&&r.players.length===2);
  bob.emit('join',{code:room.code,name:'Bob'});
  const opened=await joined;
  assert.equal(opened.highBid,0);
  assert.equal(opened.minBid,100);

  const aLeads=next(alice,'state',r=>r.phase==='bid'&&r.highBid===500&&r.leader===alice.id);
  alice.emit('bid',500);
  await aLeads;
  const bLeads=next(alice,'state',r=>r.phase==='bid'&&r.highBid===600&&r.leader===bob.id);
  bob.emit('bid',600);
  await bLeads;
  const aLeadsAgain=next(bob,'state',r=>r.phase==='bid'&&r.highBid===700&&r.leader===alice.id);
  alice.emit('bid',700);
  const rebid=await aLeadsAgain;
  assert.equal(rebid.bidCount,3,'Both players can re-raise within same round');
  assert.equal(rebid.round,1,'Auction should not resolve after each player bids');
  assert.equal(rebid.minBid,800);

  const lowError=next(bob,'errorMessage',m=>String(m).includes('$800'));
  bob.emit('bid',650);
  await lowError;
  const selfError=next(alice,'errorMessage',m=>String(m).includes('already'));
  alice.emit('bid',800);
  await selfError;

  const solo=await connect();
  const soloOpen=next(solo,'state',r=>r.phase==='bid'&&r.players.some(p=>p.id==='bot'));
  solo.emit('solo','Tester');
  await soloOpen;
  const soloLeads=next(solo,'state',r=>r.phase==='bid'&&r.leader===solo.id&&r.highBid===100);
  solo.emit('bid',100);await soloLeads;
  const botCounter=next(solo,'state',r=>r.phase==='bid'&&r.leader==='bot'&&r.highBid>=200,6500);
  const outbid=await botCounter;
  const raised=next(solo,'state',r=>r.phase==='bid'&&r.leader===solo.id&&r.highBid===outbid.highBid+100);
  solo.emit('bid',outbid.highBid+100);
  await raised;
  console.log('Live auction integration passed: player rebids, min raises, leader validation, bot counterbid and human counterraise.');
 }catch(e){
  console.error('AUCTION INTEGRATION FAILED:',e.stack||e);
  if(logs)console.error('SERVER LOG:',logs.slice(-2000));
  process.exitCode=1;
 }finally{
  for(const c of clients)c.disconnect();
  if(server)server.kill('SIGTERM');
 }
})();
