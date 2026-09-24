import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';

test('SharePoint host selects members, protects drafts, and recovers a missing fiscal year',async()=>{
  let host=stripTypeScriptTypes(readFileSync('sharepoint/FinanceWeeklyWebPart.ts','utf8'));
  host=host.replace(/from '@microsoft\/[^']+'/g,"from '/spfx.js'").replace(/from '\.\/generated\/([^']+)'/g,(_,name)=>"from '/"+name+".js'");
  const modules={
    '/host.js':host,
    '/spfx.js':`export class BaseClientSideWebPart {
      constructor(){this.domElement=document.querySelector('#root');this.properties={siteUrl:location.origin,fiscalStartMonth:4};this.context={spHttpClient:{fetch(){throw new Error('Unexpected fetch');}}};}
      async onInit(){}
    }
    export const SPHttpClient={configurations:{v1:{}}};
    export const PropertyPaneTextField=()=>({});
    export const PropertyPaneDropdown=()=>({});`,
    '/appDocument.js':"export default '<!doctype html><html><body></body></html>';",
    '/appRuntime.js':`export async function mountApp(window,bridge){window.bridge=bridge;window.prepareWorkspaceSwitch=async()=>!window.blockSwitch;window.document.body.textContent=bridge.displayName;window.ready=true;}`,
    '/validation.js':"export const validState=()=>true;",
    '/store.js':`export const DEFAULT_SITE=location.origin;
    export const fiscalYear=()=>2026;
    window.createdYears=[];
    export class SharePointStore {
      constructor(site,year){this.year=year;}
      async currentUser(){return {LoginName:'me',Title:'My workspace'};}
      async members(){
        if(this.year===2027&&!window.createdYears.includes(2027))throw Object.assign(new Error('Year list not found'),{status:404});
        return [{OwnerKey:'me',EmployeeName:'My workspace'},{OwnerKey:'other',EmployeeName:'Other member'}];
      }
      async provision(){window.createdYears.push(this.year);}
      async load(){return {state:null,revision:null,updated:null};}
    }`
  };
  const server=createServer((req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    if(modules[req.url]){res.setHeader('Content-Type','text/javascript');res.end(modules[req.url]);}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><main id="root"></main></body></html>');}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?financeYear=2026');
    await page.evaluate(async()=>{const {default:Host}=await import('/host.js');window.host=new Host();await window.host.onInit();window.host.render();});
    const frame=page.frameLocator('iframe');
    await frame.getByText('My workspace',{exact:true}).waitFor();
    assert.equal(await page.frames()[1].evaluate(()=>window.bridge.canEdit),true);
    await page.locator('#root select').selectOption('other');
    await frame.getByText('Other member',{exact:true}).waitFor();
    assert.equal(await page.frames()[1].evaluate(()=>window.bridge.canEdit),false);
    await page.frames()[1].evaluate(()=>window.blockSwitch=true);
    await page.locator('#root select').selectOption('me');
    await page.waitForFunction(()=>document.querySelector('#root select').value==='other');
    assert.equal(await frame.getByText('Other member',{exact:true}).count(),1);
    await page.frames()[1].evaluate(()=>window.blockSwitch=false);
    await page.locator('#root input[type=number]').fill('2027');
    await page.getByRole('button',{name:'Open year',exact:true}).click();
    await page.getByRole('button',{name:'Set up FY 2027 list'}).waitFor();
    assert.equal(await page.locator('iframe').count(),0);
    await page.locator('#root input[type=number]').fill('2026');
    await page.getByRole('button',{name:'Open year',exact:true}).click();
    await frame.getByText('My workspace',{exact:true}).waitFor();
    await page.locator('#root input[type=number]').fill('2027');
    await page.getByRole('button',{name:'Open year',exact:true}).click();
    await page.getByRole('button',{name:'Set up FY 2027 list'}).click();
    await frame.getByText('My workspace',{exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.createdYears),[2027]);
    await page.evaluate(()=>window.host.onDispose());
    assert.equal(await page.locator('iframe').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
