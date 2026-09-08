import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlanServer } from '../server.mjs';
const key='test-only-owner-key-0123456789abcdef0123456789';
const state=()=>({data:{W1:[[1,'Topic','task_1']],W2:[[2,'PRIVATE','task_2']]},futureSheets:[],dailyPlans:{'2026-09-08':[{title:'PRIVATE TODO'}]},pageMeta:{W1:{id:'week_1',headers:['No.','Topic']},W2:{id:'week_2',headers:['No.','Topic']}}});
test('cloud persistence, authorization, conflict detection, scoped live shares and revocation',async()=>{
const dir=mkdtempSync(join(tmpdir(),'finance-test-')),dbPath=join(dir,'test.sqlite');
let server;
async function start(){server=createPlanServer({ownerKey:key,dbPath});server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function stop(){server.close();await once(server,'close');}
try{
let base=await start();
const request=async(path,method='GET',body,credential=key)=>{const r=await fetch(base+'/api/'+path,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
assert.equal((await request('workspace','GET',null,'')).status,401);
assert.equal((await request('workspace')).body.revision,0);
assert.equal((await request('workspace','PUT',{revision:0,state:state()})).status,200);
const updated=state();updated.data.W1[0][1]='Latest';
const race=await Promise.all([request('workspace','PUT',{revision:1,state:updated}),request('workspace','PUT',{revision:1,state:state()})]);
assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
assert.equal((await request('workspace','PUT',{revision:2,state:{}})).status,400);
const {body:share,status}=await request('shares','POST',{revision:2,pageId:'week_1'});assert.equal(status,201);
let publicPage=await request('shared/'+share.token,'GET',null,'');
assert.equal(publicPage.status,200);assert.equal(publicPage.body.rows[0][1],'Latest');
assert.equal(JSON.stringify(publicPage.body).includes('PRIVATE'),false);assert.equal(JSON.stringify(publicPage.body).includes('task_1'),false);
assert.equal((await request('workspace','PUT',{revision:2,state:updated},share.token)).status,401);
assert.equal((await request('shares','DELETE',null,share.token)).status,401);
updated.data.W1[0][1]='Live update';await request('workspace','PUT',{revision:2,state:updated});
assert.equal((await request('shared/'+share.token,'GET',null,'')).body.rows[0][1],'Live update');
for(const path of ['server.mjs','.env','runtime/plan.sqlite','package.json'])assert.equal((await fetch(base+'/'+path)).status,404);
await stop();base=await start();
assert.equal((await request('workspace')).body.revision,3);
assert.equal((await request('shared/'+share.token,'GET',null,'')).status,200);
await request('shares','DELETE');assert.equal((await request('shared/'+share.token,'GET',null,'')).status,404);
const polluted=JSON.parse(JSON.stringify(state()).replace('"W1":','"__proto__":'));
assert.equal((await request('workspace','PUT',{revision:3,state:polluted})).status,400);
}finally{if(server?.listening)await stop();rmSync(dir,{recursive:true,force:true});}
});
