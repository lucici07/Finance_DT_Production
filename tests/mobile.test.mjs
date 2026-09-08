import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createPlanServer } from '../server.mjs';
const key='mobile-test-owner-key-0123456789abcdef';
test('mobile layouts, touch editing, Calendar, Dashboard, shared Viewing and desktop resize',async()=>{
const server=createPlanServer({ownerKey:key,dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;let browser;
try{
browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#connectCloud').waitFor();
await page.evaluate(()=>{data.W1=[[1,'Finance','Quarterly plan review','Check the latest budget and follow up on action items.','Cici','2026-09-08','2026-09-10','','WIP','Review forecast','Note '.repeat(20)],[2,'Operations','Prepare status update','Summarize progress','','2026-09-08','','','Not Started','','']];save();tabs();render();dailyPlans['2026-09-08']=[{title:'Discuss weekly progress',details:'Review actions together',status:'WIP'}];selectedDate='2026-09-08';calendarMonth=new Date('2026-09-01T12:00:00');});
const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
await noOverflow();assert.equal(await page.locator('.tablewrap>table').isVisible(),false);assert.equal(await page.locator('.mobile-task-card').count(),2);
mkdirSync('runtime',{recursive:true});await page.screenshot({path:'runtime/mobile-weekly.png',fullPage:true});
await page.locator('.mobile-task-card summary').first().tap();await page.locator('.mobile-edit-row').first().tap();
assert.equal(await page.locator('#editDrawer').evaluate(e=>Math.abs(e.getBoundingClientRect().width-innerWidth)<2),true);
await page.locator('#rowForm [name="f2"]').fill('Updated from phone');await page.locator('#rowForm button[type="submit"]').tap();
await page.locator('.mobile-task-title').filter({hasText:'Updated from phone'}).waitFor();await noOverflow();
await page.locator('#calendarBtn').tap();await page.locator('.calendar-day').first().waitFor();await noOverflow();
assert.equal(await page.locator('.day-panel').evaluate(el=>getComputedStyle(el).position),'static');
await page.waitForFunction(()=>scrollY===0);await page.screenshot({path:'runtime/mobile-calendar.png',fullPage:true});
await page.locator('#addTodo').tap();await page.locator('#todoForm [name="title"]').fill('Phone Todo');await page.locator('#saveTodo').tap();await page.getByText('Phone Todo',{exact:true}).waitFor();
await page.locator('#dashboardBtn').tap();await noOverflow();await page.waitForFunction(()=>scrollY===0);await page.screenshot({path:'runtime/mobile-dashboard.png',fullPage:true});
await page.locator('#weeklyBtn').tap();await page.locator('.mobile-tools summary').tap();assert.equal(await page.locator('#columnsBtn').isVisible(),true);await page.locator('.mobile-tools summary').tap();
await page.locator('#exportBtn').tap();assert.equal(await page.locator('#exportDialog').isVisible(),true);await page.locator('#closeExport').tap();
for(const width of [320,412,740]){await page.setViewportSize({width,height:844});await noOverflow();await page.locator('#calendarBtn').tap();await noOverflow();await page.locator('#dashboardBtn').tap();await noOverflow();await page.locator('#weeklyBtn').tap();}
await page.setViewportSize({width:1280,height:900});assert.equal(await page.locator('.tablewrap>table').isVisible(),true);assert.equal(await page.locator('.mobile-task-list').isVisible(),false);
await page.setViewportSize({width:390,height:844});await page.locator('#connectCloud').tap();await page.waitForFunction(()=>!document.querySelector('#loginCloud').disabled);await page.locator('#ownerKey').fill(key);await page.locator('#loginCloud').tap();await page.waitForFunction(()=>!document.querySelector('#connectForm').closest('dialog').open);
page.once('dialog',d=>d.accept());await page.locator('#shareCloud').tap();await page.locator('#shareLink').waitFor({state:'visible'});const link=await page.locator('#shareLink').inputValue();
const viewerContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),viewer=await viewerContext.newPage();
viewer.on('pageerror',e=>errors.push(e.message));await viewer.goto(link);await viewer.locator('#workspaceMode').waitFor();assert.equal(await viewer.locator('#workspaceMode').inputValue(),'viewing');assert.equal(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
await viewer.locator('.mobile-task-card summary').first().tap();assert.equal(await viewer.locator('.mobile-edit-row').first().isVisible(),false);
await viewer.locator('#workspaceMode').selectOption('editing');await viewer.waitForFunction(()=>window.sharedSession.editing);await viewer.locator('.mobile-edit-row').first().tap();await viewer.locator('#rowForm [name="f2"]').fill('Shared phone edit');await viewer.locator('#rowForm button[type="submit"]').tap();await viewer.locator('#sharedSave').tap();await viewer.waitForFunction(()=>document.querySelector('#saveState').textContent.startsWith('Latest cloud save'));
assert.deepEqual(errors,[]);
}finally{await browser?.close();server.close();await once(server,'close');}
});
