import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {chromium} from '@playwright/test';import {createPlanServer} from '../server.mjs';
test('single click types inline, double click opens drawer, shared viewing stays read only',async()=>{
const server=createPlanServer({ownerKey:'test-admin-password',dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage();await page.goto(base);await page.locator('#saveCloud').waitFor();
await page.evaluate(()=>{data.W1=[[1,'Finance','Original','Details']];save();render();});
const topic=()=>page.locator('tr[data-row="0"] td[data-col="2"]');
await topic().click();await page.locator('.cell-editor').fill('Typed directly');await page.locator('.cell-editor').press('Enter');assert.equal(await topic().innerText(),'Typed directly');
await topic().click();await page.locator('.cell-editor').fill('Cancel me');await page.locator('.cell-editor').press('Escape');assert.equal(await topic().innerText(),'Typed directly');
await topic().dblclick();await page.locator('#editDrawer.open').waitFor();assert.equal(await page.locator('#rowForm [name="f2"]').inputValue(),'Typed directly');await page.locator('#cancelRow').click();
await topic().click();await page.locator('.cell-editor').fill('Blur commit');await page.locator('tr[data-row="0"] td[data-col="3"]').click();assert.equal(await page.evaluate(()=>data.W1[0][2]),'Blur commit');
await page.locator('.cell-editor').fill('New details');await page.locator('.cell-editor').press('Tab');assert.equal(await page.evaluate(()=>data.W1[0][3]),'New details');await page.locator('.cell-editor').press('Escape');
await page.locator('[data-empty-col="2"]').click();await page.locator('.cell-editor').fill('New row');await page.locator('.cell-editor').press('Enter');assert.equal(await page.evaluate(()=>data.W1.length),2);
await topic().click();await page.locator('.cell-editor').evaluate(el=>{const clip=new DataTransfer();clip.setData('text/plain','Pasted topic\tPasted details\nSecond topic\tSecond details');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true}));});
assert.equal(await page.evaluate(()=>data.W1[1][2]),'Second topic');
await page.locator('#saveCloud').click();await page.locator('#workspaceMode').waitFor();
await topic().click();assert.equal(await page.locator('.cell-editor').count(),0);
await page.locator('#workspaceMode').selectOption('editing');await topic().click();await page.locator('.cell-editor').fill('Cloud inline');await page.locator('#sharedSave').click();await page.waitForFunction(()=>document.querySelector('#saveState').textContent.startsWith('Latest cloud save'));
await page.reload();await page.locator('#workspaceMode').waitFor();assert.equal(await topic().innerText(),'Cloud inline');
}finally{await browser.close();server.close();await once(server,'close');}
});