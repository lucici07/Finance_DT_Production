import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {createPlanServer} from '../server.mjs';
test('blank entry, page protection, future paste and scoped clear',async()=>{
const server=createPlanServer({ownerKey:'lenovo',dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port);
await page.locator('#saveCloud').waitFor();
assert.equal(await page.locator('#resetBtn').count(),0);
for(const name of ['W1','Next 3 Weeks']){
 await page.locator('[data-tab="'+name+'"]').click({button:'right'});
 assert.equal(await page.locator('#deleteTab').isDisabled(),true);
 await page.evaluate(()=>document.querySelector('#deleteTab').onclick());
 assert.equal(await page.evaluate(name=>!!data[name],name),true);
 await page.evaluate(()=>closeTabMenu());
}
await page.evaluate(()=>{data.W1=[[1,'Finance','Keep me']];dailyPlans={'2026-09-15':[{title:'Keep Todo'}]};save();tabs();render();});
await page.locator('[data-tab="Next 3 Weeks"]').click();
await page.locator('[data-empty-col="0"]').click();
await page.evaluate(()=>{
 const clip=new DataTransfer();clip.setData('text/plain','1\tFinance\tPlan A\tDetail A\tOwner\tHigh\tWIP\t2026-09-15\t2026-09-20\n2\tFinance\tPlan B\tDetail B\tOwner\tLow\tNot Started\t2026-09-16\t2026-09-21');
 document.querySelector('#tbody').dispatchEvent(new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true}));
});
assert.equal(await page.evaluate(()=>data['Next 3 Weeks'].length),2);
assert.equal(await page.evaluate(()=>cell(data[active][1],'Topic')),'Plan B');
assert.equal(await page.evaluate(()=>data.W1.length),1);
page.once('dialog',d=>d.dismiss());
await page.locator('[data-tab="Next 3 Weeks"]').click({button:'right'});await page.locator('#clearPage').click();
assert.equal(await page.evaluate(()=>data[active].length),2);
page.once('dialog',d=>d.accept());await page.locator('#clearPage').click();
assert.equal(await page.evaluate(()=>data[active].length),0);
assert.equal(await page.evaluate(()=>data.W1.length),1);
assert.equal(await page.evaluate(()=>dailyPlans['2026-09-15'].length),1);
await page.locator('#undoBtn').click();assert.equal(await page.evaluate(()=>data[active].length),2);
assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();await once(server,'close');}
});
