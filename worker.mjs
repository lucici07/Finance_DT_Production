import { validState } from './state-validation.mjs';

const headers = {
  'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const equal=(a,b)=>{let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;};
const schemas=[
'CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, page_id TEXT NOT NULL, created TEXT NOT NULL)'
];
const initialized=new WeakMap();
async function ready(db){
  let promise=initialized.get(db);
  if(!promise){promise=db.batch(schemas.map(sql=>db.prepare(sql))).catch(e=>{initialized.delete(db);throw e;});initialized.set(db,promise);}
  await promise;
}
async function bodyJSON(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'JSON required.');
  const chunks=[];let size=0;const reader=request.body?.getReader();
  if(!reader)throw fail(400,'JSON required.');
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1800000){await reader.cancel();throw fail(413,'Cloud workspace exceeds the 1.8 MB limit. Export a backup and reduce the workspace size.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid request.');
  return body;
}
export function createWorker(assets={}){
return {async fetch(request,env){
const send=(code,body)=>Response.json(body,{status:code,headers});
try{
const path=new URL(request.url).pathname,method=request.method;
if(path.startsWith('/api/')){
  if(!env.DB||!env.OWNER_KEY||env.OWNER_KEY.length<32)throw fail(503,'Cloud service is not configured.');
  if(path==='/api/health'&&method==='GET'){await ready(env.DB);return send(200,{service:'finance-dt-sync',version:2});}
  if(path.startsWith('/api/shared/')&&method==='GET'){
    const token=path.slice('/api/shared/'.length);
    if(!/^[a-f0-9]{64}$/.test(token))throw fail(404,'This link is unavailable or has been revoked.');
    await ready(env.DB);
    const saved=await env.DB.prepare('SELECT w.state,w.revision,w.updated,s.page_id FROM shares s JOIN workspace w ON w.id=1 WHERE s.token=?').bind(hex(await hash(token))).first();
    if(!saved)throw fail(404,'This link is unavailable or has been revoked.');
    const state=JSON.parse(saved.state),name=Object.keys(state.data).find(name=>state.pageMeta[name]?.id===saved.page_id);
    if(!name)throw fail(404,'This page is no longer shared.');
    const hs=state.pageMeta[name].headers||(state.futureSheets.includes(name)?['No.','Category','Topic','Content','Focal Name','Priority','Status','Start Date','Due Date','Last Update']:['No.','Category','Topic','Content','Focal Name','Date','Due Date','Last Update','Status','Next Action','Note']);
    return send(200,{name,headers:hs,rows:state.data[name].map(row=>row.slice(0,hs.length)),updated:saved.updated,revision:saved.revision});
  }
  const supplied=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!equal(await hash(supplied),await hash(env.OWNER_KEY)))throw fail(401,'Enter a valid owner key.');
  await ready(env.DB);
  if(path==='/api/workspace'&&method==='GET'){
    const saved=await env.DB.prepare('SELECT * FROM workspace WHERE id=1').first();
    return send(200,saved?{state:JSON.parse(saved.state),revision:saved.revision,updated:saved.updated}:{state:null,revision:0});
  }
  if(path==='/api/workspace'&&method==='PUT'){
    const body=await bodyJSON(request);let valid=false;try{valid=validState(body.state);}catch{}
    if(!valid||!Number.isSafeInteger(body.revision)||body.revision<0)throw fail(400,'Invalid workspace.');
    const updated=new Date().toISOString(),serialized=JSON.stringify(body.state);
    const result=body.revision===0
      ?await env.DB.prepare('INSERT OR IGNORE INTO workspace VALUES (1,?,1,?)').bind(serialized,updated).run()
      :await env.DB.prepare('UPDATE workspace SET state=?, revision=revision+1, updated=? WHERE id=1 AND revision=?').bind(serialized,updated,body.revision).run();
    if(result.meta.changes!==1)throw fail(409,'Cloud data changed. Back up this device, then load the cloud version before saving.');
    return send(200,{revision:body.revision+1,updated});
  }
  if(path==='/api/shares'&&method==='POST'){
    const body=await bodyJSON(request),saved=await env.DB.prepare('SELECT * FROM workspace WHERE id=1').first();
    if(!saved||body.revision!==saved.revision)throw fail(409,'Save the current version before sharing.');
    const state=JSON.parse(saved.state);
    if(typeof body.pageId!=='string'||!Object.values(state.pageMeta).some(meta=>meta.id===body.pageId))throw fail(400,'Page not found.');
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    const result=await env.DB.prepare('INSERT INTO shares SELECT ?,?,? FROM workspace WHERE id=1 AND revision=?').bind(hex(await hash(token)),body.pageId,new Date().toISOString(),body.revision).run();
    if(result.meta.changes!==1)throw fail(409,'Save the current version before sharing.');
    return send(201,{token});
  }
  if(path==='/api/shares'&&method==='DELETE'){await env.DB.prepare('DELETE FROM shares').run();return send(200,{revoked:true});}
  throw fail(404,'Not found.');
}
if(!['GET','HEAD'].includes(method))throw fail(405,'Method not allowed.');
const file=path==='/'?'index.html':path.slice(1);
if(!Object.hasOwn(assets,file))throw fail(404,'Not found.');
const type={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'}[file.split('.').at(-1)]||'application/octet-stream';
return new Response(method==='HEAD'?null:assets[file],{headers:{...headers,'Content-Type':type}});
}catch(e){return send(e.status||500,{error:e.status?e.message:'Server error. Please try again.'});}
}};
}
