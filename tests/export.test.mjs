import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createPlanServer } from '../server.mjs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ExcelJS=require('../vendor/exceljs.min.js');
test('six-character owner password, Excel selection, and one physical PDF page per workspace page',async()=>{
const password='testpw',server=createPlanServer({ownerKey:password,dbPath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;let browser;
try{
assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+password}})).status,200);
assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer wrong!'}})).status,401);
browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await page.locator('#exportBtn').waitFor();
await page.evaluate(()=>{
data={W1:Array.from({length:70},(_,i)=>[i+1,'财务','任务 '+i,'内容 '.repeat(15),'Owner','2026-09-08','','','WIP','Next','']),Empty:[],'Next 3 Weeks':[[1,'Category','Future','<script>unsafe</script>','Owner','High','WIP','','','']]};
pageMeta={W1:{id:'week1'},Empty:{id:'week2',headers:['No.','中文栏目','Topic']},'Next 3 Weeks':{id:'week3'}};futureSheets=new Set(['Next 3 Weeks']);active='W1';save();tabs();render();
window.print=()=>{window.printRequested=true;};
});
await page.locator('#exportBtn').click();await page.locator('#exportFormat').selectOption('pdf');await page.locator('#confirmExport').click();await page.waitForFunction(()=>window.printRequested);
assert.equal(await page.locator('#workspacePrint .export-sheet').count(),3);
assert.equal(await page.locator('#workspacePrint tbody tr').count(),72);
const fits=await page.locator('#workspacePrint .export-sheet').evaluateAll(sheets=>sheets.every(sheet=>{const r=sheet.getBoundingClientRect(),c=sheet.firstElementChild.getBoundingClientRect();return c.width<=r.width+1&&c.height<=r.height+1;}));assert.equal(fits,true);
const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,3);
await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('#workspacePrint').count(),0);assert.equal(await page.locator('#weeklyView').isVisible(),true);
await page.locator('#exportBtn').click();await page.locator('#exportScope').selectOption('current');await page.locator('#exportFormat').selectOption('excel');
const downloaded=page.waitForEvent('download');await page.locator('#confirmExport').click();const download=await downloaded;
const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(readFileSync(await download.path()));assert.equal(workbook.worksheets.length,1);assert.equal(workbook.worksheets[0].name,'W1');assert.equal(workbook.worksheets[0].rowCount,71);
await page.locator('#exportBtn').click();await page.locator('#exportScope').selectOption('all');
const allDownload=page.waitForEvent('download');await page.locator('#confirmExport').click();const all=await allDownload;const full=new ExcelJS.Workbook();await full.xlsx.load(readFileSync(await all.path()));assert.deepEqual(full.worksheets.map(s=>s.name),['W1','Empty','Next 3 Weeks']);
assert.deepEqual(errors,[]);
}finally{await browser?.close();server.close();await once(server,'close');}
});
