import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {chromium} from '@playwright/test';import {createPlanServer} from '../server.mjs';
test('main entry stays blank and independent workspace links isolate saves',async()=>{
const server=createPlanServer({ownerKey:'private-admin-key',dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});try{
const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('financePlanProductionV1','{"W1":[[1,"Private","Old personal data"]]}'));
const page=await context.newPage();await page.goto(base);await page.locator('#saveCloud').waitFor();
assert.equal(await page.evaluate(()=>data.W1.length),0);
assert.equal(await page.locator('#connectCloud').count(),0);
await page.evaluate(()=>{data.W1=[[1,'A','Workspace A']];save();render();});
await page.locator('#saveCloud').click();await page.locator('#workspaceMode').waitFor();const linkA=page.url(),tokenA=new URL(linkA).hash.slice(7);
assert.match(linkA,/#share=[a-f0-9]{64}$/);assert.equal(await page.locator('#workspaceMode').inputValue(),'viewing');
await page.goto(base);await page.locator('#saveCloud').waitFor();assert.equal(await page.evaluate(()=>data.W1.length),0);
await page.evaluate(()=>{data.W1=[[1,'B','Workspace B']];save();render();});
await page.locator('#shareCloud').click();await page.locator('#workspaceMode').waitFor();const linkB=page.url(),tokenB=new URL(linkB).hash.slice(7);
assert.notEqual(linkA,linkB);
await page.locator('#workspaceMode').selectOption('editing');await page.evaluate(()=>{data.W1[0][2]='B updated';save();render();});
await page.locator('#sharedSave').click();await page.waitForFunction(()=>document.querySelector('#saveState').textContent.startsWith('Latest cloud save'));
const read=async token=>(await(await fetch(base+'/api/shared/'+token)).json());
assert.equal((await read(tokenA)).state.data.W1[0][2],'Workspace A');const b=await read(tokenB);assert.equal(b.state.data.W1[0][2],'B updated');
assert.equal((await fetch(base+'/api/shared/'+tokenB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:b.state,revision:b.revision})})).status,403);
assert.equal((await fetch(base+'/api/shared/'+tokenB,{method:'PUT',headers:{'Content-Type':'application/json','X-Workspace-Mode':'editing'},body:JSON.stringify({state:b.state,revision:1})})).status,409);
assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer lenovo'}})).status,401);
await page.goto(linkA);await page.waitForFunction(token=>window.sharedSession?.token===token,tokenA);await page.locator('#workspaceMode').waitFor();assert.equal(await page.evaluate(()=>data.W1[0][2]),'Workspace A');
await page.reload();await page.locator('#workspaceMode').waitFor();assert.equal(await page.evaluate(()=>data.W1[0][2]),'Workspace A');
await page.goto(base+'?new=true');await page.locator('#saveCloud').waitFor();assert.equal(await page.evaluate(()=>data.W1.length),0);
assert.match(await page.evaluate(()=>localStorage.getItem('financePlanProductionV1')),/Old personal data/);
}finally{await browser.close();server.close();await once(server,'close');}
});
