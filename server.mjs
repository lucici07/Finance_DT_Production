import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createWorker } from './worker.mjs';
export { validState } from './state-validation.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export function createPlanServer({ownerKey,dbPath=resolve(root,'runtime/plan.sqlite')}={}){
if(typeof ownerKey!=='string'||ownerKey.length<6)throw new Error('Set OWNER_KEY to a password of at least 6 characters.');
if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
const sqlite=new DatabaseSync(dbPath);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
const DB={
prepare(sql){const statement=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return statement.get(...values)||null;},async run(){return {meta:statement.run(...values)};}};},
async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}
};
const files=['index.html','app.js','sync.js','export.js','export.css','mobile.js','mobile.css','bootstrap.js','shared-workspace.js','sync.css','share.html','share.js','styles.css','details.css','calendar.css','dashboard.css','production.css','vendor/exceljs.min.js'];
const assets=Object.fromEntries(files.map(file=>[file,readFileSync(resolve(root,file),'utf8')]));
const worker=createWorker(assets);
const server=http.createServer(async(req,res)=>{
try{
const request=new Request(new URL(req.url,'http://localhost'),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
const response=await worker.fetch(request,{DB,OWNER_KEY:ownerKey});
res.writeHead(response.status,Object.fromEntries(response.headers));
res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Server error. Please retry.'}));}
});
server.on('close',()=>sqlite.close());return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const server=createPlanServer({ownerKey:process.env.OWNER_KEY,dbPath:process.env.DATA_DIR?resolve(process.env.DATA_DIR,'plan.sqlite'):undefined});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Finance DT server listening on port '+server.address().port));
}
