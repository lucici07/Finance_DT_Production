import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';

test('packaged app supports SharePoint save/reload, backup, calendar and read-only viewing',async()=>{
  execFileSync(process.execPath,['sharepoint/prepare.mjs']);
  const raw=readFileSync('sharepoint/finance-weekly-sharepoint/src/generated/appDocument.ts','utf8');
  const doc=JSON.parse(raw.slice('export default '.length).trim().replace(/;$/,''));
  assert.ok(!doc.includes('src="bootstrap.js'));
  assert.ok(!doc.includes('href="styles.css'));
  const server=createServer((req,res)=>res.end('<!doctype html><html><body></body></html>'));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(doc=>{
      window.mockState={data:{W1:[[1,'Finance','Original task']]},futureSheets:[],dailyPlans:{'2026-09-23':[{title:'Calendar task'}]},pageMeta:{W1:{id:'week1'}}};
      window.mockRevision='"1"';window.mockFailure=false;
      window.makeFrame=editable=>{
        document.querySelector('iframe')?.remove();
        const frame=document.createElement('iframe');frame.style.cssText='width:1400px;height:1000px';
        frame.financeBridge={canEdit:editable,displayName:'Test Member',year:2026,validate:value=>!!value?.data,share:()=>{},
          request:async(method,body)=>{
            if(method==='PUT'){
              if(window.mockFailure)throw new Error('Connection lost. Draft retained.');
              if(body.revision!==window.mockRevision)throw new Error('A newer save exists.');
              window.mockState=structuredClone(body.state);window.mockRevision='"2"';
            }
            return {state:structuredClone(window.mockState),revision:window.mockRevision,updated:'2026-09-23T12:00:00Z'};
          }};
        document.body.append(frame);frame.srcdoc=doc;
      };
      window.makeFrame(true);
    },doc);
    const frame=page.frameLocator('iframe');
    await frame.locator('#workspaceMode').waitFor();
    assert.equal(await frame.locator('.profile b').textContent(),'Test Member');
    await frame.locator('#workspaceMode').selectOption('editing');
    await page.frames()[1].evaluate(()=>{data.W1[0][2]='Saved in SharePoint';save();render();});
    await frame.locator('#sharedSave').click();
    await page.waitForFunction(()=>window.mockState.data.W1[0][2]==='Saved in SharePoint');
    assert.equal(await page.frames()[1].evaluate(()=>window.hasSharePointDraft()),false);
    await frame.locator('#calendarBtn').click();
    assert.equal(await frame.locator('#calendarView').isVisible(),true);
    await frame.locator('#weeklyBtn').click();
    await page.evaluate(()=>window.mockFailure=true);
    await page.frames()[1].evaluate(()=>{data.W1[0][2]='Unsaved draft';save();render();});
    await frame.locator('#sharedSave').click();
    await frame.locator('#saveState').filter({hasText:'Connection lost'}).waitFor();
    assert.equal(await page.frames()[1].evaluate(()=>data.W1[0][2]),'Unsaved draft');
    assert.equal(await page.frames()[1].evaluate(()=>window.hasSharePointDraft()),true);
    const download=page.waitForEvent('download');
    await frame.getByRole('button',{name:'Download workspace backup'}).click();
    assert.match((await download).suggestedFilename(),/FY2026/);
    await page.evaluate(()=>window.makeFrame(false));
    await frame.locator('#workspaceMode').waitFor();
    assert.equal(await frame.locator('#workspaceMode').isDisabled(),true);
    assert.equal(await frame.locator('#sharedSave').isDisabled(),true);
    assert.equal(await page.frames()[1].evaluate(()=>data.W1[0][2]),'Saved in SharePoint');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
