'use strict';
// One-time optional link creation for OUTBID using is.gd's public, free API.
// This is best-effort, never blocks deployment, and only creates a redirect to our existing app.
(async()=>{
 const target='https://outbid-live-game.onrender.com/';
 const aliases=['outbid1v1','outbidarena','playoutbid26'];
 for(const alias of aliases){
  try{
   const qs=new URLSearchParams({format:'json',url:target,shorturl:alias});
   const r=await fetch('https://is.gd/create.php?'+qs.toString(),{signal:AbortSignal.timeout(6000)});
   const result=await r.json();
   if(result.shorturl&&result.shorturl.startsWith('https://is.gd/')){
    const check=await fetch(result.shorturl,{redirect:'manual',signal:AbortSignal.timeout(6000)});
    const where=check.headers.get('location')||'';
    if(check.status>=300&&check.status<400&&where.replace(/\/$/,'')===target.replace(/\/$/,'')){
     console.log('OUTBID_SHORTLINK_VERIFIED='+result.shorturl);
     return;
    }
    console.log('OUTBID_SHORTLINK_CREATED_BUT_UNVERIFIED='+result.shorturl);
    return;
   }
   console.log('OUTBID_SHORTLINK_ATTEMPT_FAILED='+alias+':'+(result.errormessage||r.status));
  }catch(e){console.log('OUTBID_SHORTLINK_ATTEMPT_ERROR='+alias+':'+e.message)}
 }
 console.log('OUTBID_SHORTLINK_UNAVAILABLE; original URL is unchanged.');
})();
