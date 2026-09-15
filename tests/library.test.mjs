import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {readFileSync} from 'node:fs';import {chromium} from '@playwright/test';import {createPlanServer} from '../server.mjs';
test('workspace view manager retains links and list export/import is local',async()=>{
const server=createPlanServer({ownerKey:'private-admin-password',dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const context=await browser.newContext(),page=await context.newPage();await page.goto(base);await page.locator('#workspaceLibrary').waitFor();await page.evaluate(()=>{data.W1=[[1,'Finance','Saved original']];save();render();});
await page.locator('#saveCloud').click();await page.locator('#workspaceLibrary').waitFor();await page.locator('#workspaceMode').waitFor();const link=page.url();
await page.locator('#workspaceLibrary').click();assert.equal(await page.locator('.library-item').count(),1);
page.once('dialog',d=>d.accept('My weekly plan'));await page.getByRole('button',{name:'Rename',exact:true}).click();
page.once('dialog',d=>d.accept('September'));await page.getByRole('button',{name:'Move to folder',exact:true}).click();
await page.locator('#libraryFolder').selectOption('September');assert.match(await page.locator('.library-item').innerText(),/My weekly plan/);
await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#libraryDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);const download=page.waitForEvent('download');await page.locator('#libraryExport').click();const file=await download;const exported=readFileSync(await file.path());
assert.equal(JSON.parse(exported).workspaces.length,1);assert.equal(exported.toString().includes('Saved original'),false);
await page.locator('#libraryDialog').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.locator('#libraryDialog').isVisible(),false);
const fresh=await context.newPage();await fresh.goto(base);await fresh.locator('#workspaceLibrary').waitFor();
assert.equal(page.url(),link);assert.equal(await page.evaluate(()=>data.W1[0][2]),'Saved original');assert.equal(await fresh.evaluate(()=>data.W1.length),0);
await fresh.locator('#workspaceLibrary').click();assert.equal(await fresh.locator('.library-item').count(),1);
fresh.once('dialog',d=>d.accept());await fresh.getByRole('button',{name:'Remove from list',exact:true}).click();assert.equal(await fresh.locator('.library-item').count(),0);
assert.equal((await fetch(base+'/api/shared/'+new URL(link).hash.slice(7))).status,200);
await fresh.locator('#libraryImport').setInputFiles({name:'workspace-links.json',mimeType:'application/json',buffer:exported});assert.equal(await fresh.locator('.library-item').count(),1);
const reopen=context.waitForEvent('page');await fresh.getByRole('link',{name:'Open',exact:true}).click();const restored=await reopen;await restored.locator('#workspaceMode').waitFor();assert.equal(await restored.evaluate(()=>data.W1[0][2]),'Saved original');
const outsider=await browser.newContext(),other=await outsider.newPage();await other.goto(base);await other.locator('#workspaceLibrary').click();assert.equal(await other.locator('.library-item').count(),0);
}finally{await browser.close();server.close();await once(server,'close');}
});