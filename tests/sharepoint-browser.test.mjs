import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';

test('compiled SharePoint app works under CSP with inline scripts blocked',async()=>{
  execFileSync(process.execPath,['sharepoint/prepare.mjs']);
  const raw=readFileSync('sharepoint/finance-weekly-sharepoint/src/generated/appDocument.ts','utf8');
  const doc=JSON.parse(raw.slice('export default '.length).trim().replace(/;$/,''));
  const runtime=readFileSync('sharepoint/finance-weekly-sharepoint/src/generated/appRuntime.ts','utf8').replace('const ExcelJS = require("./exceljs.min.js");','import ExcelJS from "/exceljs-module.js";');
  const excel='const value={exports:{}};\n(function(module,exports){\n'+readFileSync('vendor/exceljs.min.js','utf8')+'\n})(value,value.exports);\nexport default value.exports;';
  assert.ok(!/<script\b/i.test(doc));
  assert.ok(!doc.includes('href="styles.css'));
  assert.ok(!runtime.includes("script.textContent = source"));
  const server=createServer((req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
    if(req.url==='/app-runtime.js'||req.url==='/exceljs-module.js'){res.setHeader('Content-Type','text/javascript');res.end(req.url==='/app-runtime.js'?runtime:excel);}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(async doc=>{
      const {mountApp}=await import('/app-runtime.js');
      window.mockState={data:{W1:[[1,'Finance','Original task']]},futureSheets:[],dailyPlans:{'2026-09-23':[{title:'Calendar task'}]},pageMeta:{W1:{id:'week1'}}};
      window.mockRevision='"1"';window.mockFailure=false;
      window.makeFrame=editable=>{
        document.querySelector('iframe')?.remove();
        const frame=document.createElement('iframe');frame.style.cssText='width:1400px;height:1000px';
        const bridge={canEdit:editable,displayName:'Test Member',year:2026,validate:value=>!!value?.data,share:()=>{},
          request:async(method,body)=>{
            if(method==='PUT'){
              if(window.mockFailure)throw new Error('Connection lost. Draft retained.');
              if(body.revision!==window.mockRevision)throw new Error('A newer save exists.');
              window.mockState=structuredClone(body.state);window.mockRevision='"2"';
            }
            return {state:structuredClone(window.mockState),revision:window.mockRevision,updated:'2026-09-23T12:00:00Z'};
          }};
        frame.onload=()=>mountApp(frame.contentWindow,bridge);
        frame.srcdoc=doc;document.body.append(frame);
      };
      window.makeFrame(true);
    },doc);
    const frame=page.frameLocator('iframe');
    await frame.locator('#workspaceMode').waitFor();
    assert.equal(await frame.locator('.profile b').textContent(),'Test Member');
    await frame.locator('#workspaceMode').selectOption('editing');
    const importState=async title=>{
      const state=await page.evaluate(()=>structuredClone(window.mockState));
      state.data.W1[0][2]=title;
      await frame.locator('.share-session-controls input[type=file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
      await frame.locator('#tbody').getByText(title,{exact:true}).waitFor();
    };
    await importState('Saved in SharePoint');
    await frame.locator('#sharedSave').click();
    await page.waitForFunction(()=>window.mockState.data.W1[0][2]==='Saved in SharePoint');
    assert.equal(await page.frames()[1].evaluate(()=>window.hasSharePointDraft()),false);
    await frame.locator('#calendarBtn').click();
    assert.equal(await frame.locator('#calendarView').isVisible(),true);
    await frame.locator('#weeklyBtn').click();
    await frame.locator('#exportBtn').click();
    const excelDownload=page.waitForEvent('download');
    await frame.locator('#confirmExport').click();
    assert.match((await excelDownload).suggestedFilename(),/\.xlsx$/);
    await page.frames()[1].evaluate(()=>{window.print=()=>{window.printRequested=true;};});
    await frame.locator('#exportBtn').click();
    await frame.locator('#exportFormat').selectOption('pdf');
    await frame.locator('#confirmExport').click();
    await page.frames()[1].waitForFunction(()=>window.printRequested);
    assert.equal(await frame.locator('#workspacePrint .export-sheet').count(),1);
    await page.frames()[1].evaluate(()=>dispatchEvent(new Event('afterprint')));
    await page.evaluate(()=>window.mockFailure=true);
    await importState('Unsaved draft');
    await frame.locator('#sharedSave').click();
    await frame.locator('#saveState').filter({hasText:'Connection lost'}).waitFor();
    assert.equal(await frame.locator('#tbody').getByText('Unsaved draft',{exact:true}).count(),1);
    assert.equal(await page.frames()[1].evaluate(()=>window.hasSharePointDraft()),true);
    const download=page.waitForEvent('download');
    await frame.getByRole('button',{name:'Download workspace backup'}).click();
    assert.match((await download).suggestedFilename(),/FY2026/);
    await page.evaluate(()=>window.makeFrame(false));
    await frame.locator('#workspaceMode').waitFor();
    assert.equal(await frame.locator('#workspaceMode').isDisabled(),true);
    assert.equal(await frame.locator('#sharedSave').isDisabled(),true);
    assert.equal(await frame.locator('#tbody').getByText('Saved in SharePoint',{exact:true}).count(),1);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
