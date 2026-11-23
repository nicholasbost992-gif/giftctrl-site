'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('public/index.html','utf8');
const js=fs.readFileSync('public/app.js','utf8');
const css=fs.readFileSync('public/styles.css','utf8');
const server=fs.readFileSync('server.js','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const unique=new Set(ids);
assert.strictEqual(ids.length,unique.size,'Duplicate element IDs');
const refs=[...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
const missing=[...new Set(refs.filter(id=>!unique.has(id)))];
assert.deepStrictEqual(missing,[],'App references missing elements');
for(const id of ['home','game','playOnline','playBot','createRoom','joinRoom','name','roomcode','amount','bidbutton','itemPhoto','resultPanel','chatlog','musicToggle','proBackdrop']){
 assert(unique.has(id),'Required screen element missing: '+id);
}
assert(html.includes('/socket.io/socket.io.js'),'Socket.IO script missing');
assert(html.includes('/styles.css'),'Main stylesheet missing');
assert(html.includes('/app.js'),'Game script missing');
assert(css.includes('@media(max-width:760px)'),'Mobile breakpoint missing');
assert(server.includes('express.static'),'Server is not serving frontend files');
assert(server.includes("app.get('/health'"),'Health endpoint missing');
console.log('OUTBID smoke checks passed: '+ids.length+' elements and '+refs.length+' UI references verified.');
