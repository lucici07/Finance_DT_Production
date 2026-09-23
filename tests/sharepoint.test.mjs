import test from 'node:test';
import assert from 'node:assert/strict';
import { SharePointStore, fiscalYear } from '../sharepoint/storage.mjs';
import { validState } from '../state-validation.mjs';

const state = () => ({data:{W1:[['Example','task_1']]},futureSheets:[],dailyPlans:{'2026-09-23':[{title:'Check report'}]},pageMeta:{W1:{id:'week_1',headers:['Topic']}}});
function fixture() {
  const items = new Map(), attachments = new Map(), calls = [];
  let sequence = 0, failUpload = false, conflict = false;
  const response = (value, status=200, etag) => new Response(status===204?null:JSON.stringify(value), {status,headers:etag?{ETag:etag}:{}});
  const request = async (url, options) => {
    calls.push({url,...options});
    const body = options.body ? (()=>{try{return JSON.parse(options.body);}catch{return options.body;}})() : null;
    if (url.includes('/currentuser')) return response({LoginName:"i:0#.f|membership|user@example.com",Title:'Member'});
    const id = Number(url.match(/items\((\d+)\)/)?.[1]);
    if (url.includes('/AttachmentFiles/add')) {
      if(failUpload)return response({},503);
      attachments.set(id,body); return response({},201);
    }
    if (url.includes('/AttachmentFiles(')) return attachments.has(id)?response(attachments.get(id)):response({},404);
    if (id) {
      const item=items.get(id);
      if(!item)return response({},404);
      if(options.headers['X-HTTP-Method']==='MERGE'){
        if(conflict||options.headers['IF-MATCH']!==item.etag)return response({},412);
        Object.assign(item,body,{etag:'"'+(Number(item.etag.replaceAll('"',''))+1)+'"',Modified:'2026-09-23T12:01:00Z'});
        return response(null,204);
      }
      return response(item,200,item.etag);
    }
    if(options.method==='POST'&&url.endsWith('/items')){
      if([...items.values()].some(item=>item.Title===body.Title))return response({},409);
      const item={...body,Id:++sequence,etag:'"1"',Modified:'2026-09-23T12:00:00Z'};
      items.set(item.Id,item);return response(item,201,item.etag);
    }
    const filter=new URL(url).searchParams.get('$filter');
    return response({value:[...items.values()].filter(item=>filter?.startsWith('Title eq')?item.Title===filter.slice(10,-1).replaceAll("''","'"):item.EntryType==='Workspace')});
  };
  const store=new SharePointStore('https://tenant.sharepoint.com/sites/weekly',2026,request,validState);
  return {store,calls,items,attachments,owner:"i:0#.f|membership|user@example.com",fail:()=>{failUpload=true;},resume:()=>{failUpload=false;},conflict:()=>{conflict=true;}};
}
test('fiscal boundaries and configurable start month',()=>{
  assert.equal(fiscalYear(new Date(2026,2,31),4),2025);
  assert.equal(fiscalYear(new Date(2026,3,1),4),2026);
  assert.equal(fiscalYear(new Date(2026,0,1),1),2026);
  assert.throws(()=>fiscalYear(new Date(),0));
});
test('round trip preserves weekly, calendar and metadata; directory excludes snapshots',async()=>{
  const f=fixture(); const saved=await f.store.save(f.owner,'Member',state(),null);
  assert.deepEqual(saved.state,state());
  assert.deepEqual((await f.store.load(f.owner)).state,state());
  assert.equal((await f.store.members()).length,1);
  assert.equal(f.items.size,2);
});
test('second save creates immutable snapshot and changes pointer',async()=>{
  const f=fixture();const first=await f.store.save(f.owner,'Member',state(),null);
  const next=state();next.data.W1[0][0]='Changed';
  await f.store.save(f.owner,'Member',next,first.revision);
  assert.equal(f.attachments.size,2);
  assert.deepEqual((await f.store.load(f.owner)).state,next);
});
test('stale save is rejected before uploading',async()=>{
  const f=fixture();await f.store.save(f.owner,'Member',state(),null);
  await assert.rejects(f.store.save(f.owner,'Member',state(),null),/newer save/);
  assert.equal(f.attachments.size,1);
});
test('failed upload retains last committed state',async()=>{
  const f=fixture();const first=await f.store.save(f.owner,'Member',state(),null);
  const changed=state();changed.data.W1[0][0]='Failed';
  f.fail();
  await assert.rejects(f.store.save(f.owner,'Member',changed,first.revision),/503/);
  assert.deepEqual((await f.store.load(f.owner)).state,state());
});
test('ETag conflict during commit does not change pointer',async()=>{
  const f=fixture();const first=await f.store.save(f.owner,'Member',state(),null);
  f.conflict();
  await assert.rejects(f.store.save(f.owner,'Member',state(),first.revision),/newer save/);
  assert.equal([...f.items.values()].find(item=>item.EntryType==='Workspace').SnapshotId,2);
});
test('viewer cannot save another member through adapter',async()=>{
  const f=fixture();
  await assert.rejects(f.store.save('other-user','Other',state(),null),/read-only/);
  assert.equal(f.items.size,0);
});
test('oversized or malformed backups do not write anything',async()=>{
  const f=fixture();
  await assert.rejects(f.store.save(f.owner,'Member',{},null),/Invalid/);
  const large=state();large.data.W1[0][0]='x'.repeat(1800001);
  await assert.rejects(f.store.save(f.owner,'Member',large,null),/1.8 MB/);
  assert.equal(f.items.size,0);
});

test('first-save upload failure can be retried with the original draft revision',async()=>{
  const f=fixture();f.fail();
  await assert.rejects(f.store.save(f.owner,'Member',state(),null),/503/);
  assert.equal((await f.store.load(f.owner)).state,null);
  f.resume();
  await f.store.save(f.owner,'Member',state(),null);
  assert.deepEqual((await f.store.load(f.owner)).state,state());
});