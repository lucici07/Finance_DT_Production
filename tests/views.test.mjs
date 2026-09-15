import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {chromium} from '@playwright/test';import {createPlanServer} from '../server.mjs';
test('workspace view tabs isolate weekly/calendar/dashboard and sync square tracks saved state',async()=>{
const server=createPlanServer({ownerKey:'test-private-admin',dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage();await page.goto(base);await page.locator('#newWorkspaceView').waitFor();
page.once('dialog',d=>d.accept('Workspace A'));await page.locator('#newWorkspaceView').click();await page.locator('#workspaceMode').waitFor();await page.locator('#workspaceViews').waitFor();const tokenA=new URL(page.url()).hash.slice(7);
assert.equal(await page.locator('#sharedBackup').count(),0);assert.equal(await page.locator('#sharedReload').innerText(),'');
assert.equal(await page.locator('#sharedReload').getAttribute('data-sync'),'synced');
await page.locator('#workspaceMode').selectOption('editing');await page.waitForFunction(()=>window.sharedSession.editing);
await page.locator('[data-empty-col="2"]').click();await page.locator('.cell-editor').fill('A task');assert.equal(await page.locator('#sharedReload').getAttribute('data-sync'),'pending');await page.locator('.cell-editor').press('Escape');assert.equal(await page.locator('#sharedReload').getAttribute('data-sync'),'synced');await page.locator('[data-empty-col]').nth(2).click();await page.locator('.cell-editor').fill('A task');await page.locator('.cell-editor').press('Enter');
await page.evaluate(()=>{dailyPlans['2026-09-15']=[{title:'A calendar'}];save();});
await page.locator('#sharedSave').click();await page.waitForFunction(()=>document.querySelector('#sharedReload').dataset.sync==='synced');
await page.locator('#dashboardBtn').click();
page.once('dialog',d=>d.accept('Workspace B'));await page.locator('#newWorkspaceView').click();await page.waitForFunction(token=>window.sharedSession?.token!==token&&!!window.sharedSession,tokenA);await page.locator('#workspaceViews').waitFor();const tokenB=new URL(page.url()).hash.slice(7);
assert.equal(await page.evaluate(()=>data.W1.length),0);assert.equal(await page.evaluate(()=>Object.keys(dailyPlans).length),0);
await page.locator('#workspaceMode').selectOption('editing');await page.waitForFunction(()=>window.sharedSession.editing);await page.evaluate(()=>{data.W1=[[1,'B','B task']];save();render();});
page.once('dialog',d=>d.dismiss());await page.locator('[data-workspace="'+tokenA+'"]').click();assert.equal(new URL(page.url()).hash.slice(7),tokenB);
page.once('dialog',d=>d.accept());await page.locator('[data-workspace="'+tokenA+'"]').click();await page.waitForFunction(token=>window.sharedSession?.token===token,tokenA);await page.locator('#workspaceViews').waitFor();
assert.equal(await page.evaluate(()=>data.W1[0][2]),'A task');assert.equal(await page.evaluate(()=>dailyPlans['2026-09-15'][0].title),'A calendar');assert.equal(await page.locator('#dashboardView').isVisible(),true);
await page.locator('[data-workspace="'+tokenB+'"]').click();await page.waitForFunction(token=>window.sharedSession?.token===token,tokenB);await page.locator('#workspaceViews').waitFor();
assert.equal(await page.evaluate(()=>data.W1[0][2]),'B task');assert.equal(await page.evaluate(()=>Object.keys(dailyPlans).length),0);
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}finally{await browser.close();server.close();await once(server,'close');}
});
