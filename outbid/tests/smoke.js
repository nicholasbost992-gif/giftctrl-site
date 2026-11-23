'use strict';
const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('public/index.html','utf8');
const js=fs.readFileSync('public/app.js','utf8')+'\n'+fs.readFileSync('public/video.js','utf8');
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
assert(html.includes('/hand-gesture.js'),'Hand gesture library missing');
assert(html.includes('/video.js'),'Camera client missing');
for(const id of ['localVideo','remoteVideo','startCamera','camToggle','handToggle','gestureProgress','handState','lotClue','appraiseBtn','appraisalResult','reportMatch'])assert(unique.has(id),'Missing camera auction control: '+id);
assert(/@media\s*\(\s*max-width\s*:\s*(?:690|760)px\s*\)/.test(css),'Mobile breakpoint missing');
assert(server.includes('express.static'),'Server is not serving frontend files');
assert(server.includes("app.get('/health'"),'Health endpoint missing');
for(const id of ['lobbyVideo','lobbyVideoPlaceholder','lobbyCameraButton','lobbyCameraStatus'])assert(unique.has(id),'Missing lobby camera preview: '+id);
assert(!html.includes('LOOK.<br>'),'Old billboard-style homepage should be removed');
console.log('OUTBID smoke checks passed: '+ids.length+' elements and '+refs.length+' UI references verified.');
