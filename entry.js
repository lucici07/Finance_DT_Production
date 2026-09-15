(() => {
const controls=document.createElement('div');controls.className='cloud-controls';
controls.innerHTML='<button id="saveCloud" class="primary">Save new workspace</button><button id="shareCloud">Share</button><label class="button">Import backup<input id="entryImport" type="file" accept=".json" hidden></label>';
document.querySelector('.titleblock').after(controls);
document.querySelector('.production-banner').textContent='New workspace | Start from this blank template. Save to get your own workspace link.';
document.querySelector('#entryImport').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
 if(file.size>1800000)throw new Error('Backup exceeds the workspace size limit.');
 const raw=JSON.parse(await file.text()),value=raw.state||raw;
 const safe=v=>!v||typeof v!=='object'||Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&safe(x));
 if(!safe(value)||!value.data||!Object.keys(value.data).length||!Object.values(value.data).every(rows=>Array.isArray(rows)&&rows.every(Array.isArray))||!Array.isArray(value.futureSheets)||!value.dailyPlans||!value.pageMeta)throw new Error('Invalid backup.');
 if(!confirm('Import this backup into the current draft? Existing cloud workspaces will not change.'))return;
 restoreState(JSON.stringify(value));save();
 }catch(error){alert(error.message);}
};
try{
 if(localStorage.getItem('financePlanProductionV1')){
 const recover=document.createElement('button');recover.textContent='Download previous browser backup';controls.append(recover);
 recover.onclick=()=>{
 const saved={data:JSON.parse(localStorage.getItem('financePlanProductionV1')),futureSheets:JSON.parse(localStorage.getItem('futureSheetsProductionV1')||'[]'),dailyPlans:JSON.parse(localStorage.getItem('dailyPlansProductionV1')||'{}'),pageMeta:JSON.parse(localStorage.getItem('pageMetaProductionV1')||'{}')};
 const url=URL.createObjectURL(new Blob([JSON.stringify(saved)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='previous-browser-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 }
}catch{}
const initial=stateJSON();let busy=false,leaving=false;
const oldSave=save;save=function(...args){oldSave(...args);document.querySelector('#saveState').textContent='Draft in this tab | Save to create your workspace link';};
document.querySelector('#saveState').textContent='Default template | No personal workspace loaded';
async function create(){
 if(busy)return;
 if(document.querySelector('#editDrawer').classList.contains('open')||document.querySelector('#todoDialog').open){alert('Finish or close the item being edited before saving.');return;}
 busy=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
 const initialView={active,view:!document.querySelector('#calendarView').classList.contains('hidden')?'calendar':!document.querySelector('#dashboardView').classList.contains('hidden')?'dashboard':'weekly'};
 const r=await fetch(new URL('api/workspaces',location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:JSON.parse(stateJSON()),initialView}),signal:AbortSignal.timeout(20000)});
 if(r.status===404)throw new Error('Cloud saving is available at finance-dt-weekly-plan.lucici1007.chatgpt.site. Export your draft before switching sites.');const result=await r.json();if(!r.ok)throw new Error(result.error||'Unable to save workspace.');
 const url=new URL('./',location.href);url.hash='share='+result.token;leaving=true;location.assign(url.href);location.reload();
 }catch(e){document.querySelector('#saveState').textContent=e.message+' Your draft is still in this tab.';}
 finally{busy=false;controls.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
document.querySelector('#saveCloud').onclick=document.querySelector('#shareCloud').onclick=create;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();create();}});
addEventListener('beforeunload',e=>{if(!leaving&&stateJSON()!==initial){e.preventDefault();e.returnValue='';}});
})();