import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../worker.mjs';
const key='test-only-owner-key-0123456789abcdef0123456789';
const state=()=>({data:{W1:[[1,'Topic','task_1']],W2:[[2,'PRIVATE','task_2']]},futureSheets:[],dailyPlans:{'2026-09-08':[{title:'PRIVATE TODO'}]},pageMeta:{W1:{id:'week_1',headers:['No.','Topic']},W2:{id:'week_2',headers:['No.','Topic']}}});
test('deployed Worker D1 contract: CAS, live scoped reads, malformed input and revocation',async()=>{
const sqlite=new DatabaseSync(':memory:');
const DB={prepare(sql){const stmt=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return stmt.get(...values)||null;},async run(){return {meta:stmt.run(...values)};}};},async batch(stmts){return Promise.all(stmts.map(s=>s.run()));}};
const worker=createWorker({'index.html':'Editor'}),env={DB,OWNER_KEY:key};
const req=async(path,method='GET',body,credential=key)=>{
const r=await worker.fetch(new Request('https://example.test'+path,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);return {code:r.status,body:await r.json()};};
try{
assert.equal((await req('/api/health')).code,200);
assert.equal((await req('/api/workspace','GET',null,'')).code,401);
assert.equal((await req('/api/workspace','PUT',{revision:0,state:state()})).code,200);
const requests=await Promise.all([req('/api/workspace','PUT',{revision:1,state:state()}),req('/api/workspace','PUT',{revision:1,state:state()})]);
assert.deepEqual(requests.map(r=>r.code).sort(),[200,409]);
const share=await req('/api/shares','POST',{revision:2,pageId:'week_1'});assert.equal(share.code,201);
const token=share.body.token,read=await req('/api/shared/'+token,'GET',null,'');assert.equal(read.code,200);assert.equal(read.body.rows[0][1],'Topic');assert.equal(JSON.stringify(read.body).includes('PRIVATE'),false);
assert.equal((await req('/api/workspace','PUT',{revision:2,state:state()},token)).code,401);
const next=state();next.data.W1[0][1]='Changed';assert.equal((await req('/api/workspace','PUT',{revision:2,state:next})).code,200);assert.equal((await req('/api/shared/'+token,'GET',null,'')).body.rows[0][1],'Changed');
assert.equal((await req('/api/workspace','PUT',{revision:3,state:{}})).code,400);
const big=state();big.data.W1[0][1]='x'.repeat(1800000);assert.equal((await req('/api/workspace','PUT',{revision:3,state:big})).code,413);
assert.equal((await req('/api/shares','DELETE',null,token)).code,401);
assert.equal((await req('/api/shares','DELETE')).code,200);assert.equal((await req('/api/shared/'+token,'GET',null,'')).code,404);
assert.equal((await worker.fetch(new Request('https://example.test/server.mjs'),env)).status,404);
}finally{sqlite.close();}
});
