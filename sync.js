(() => {
const $c = s => document.querySelector(s);
let key='', busy=false, available=false, synced='', revision=0, updated='', error='';
try { ({state:synced='',revision=0,updated=''}=JSON.parse(localStorage.getItem('cloudAckV1')||'{}')); } catch {}
const actions=document.createElement('div'); actions.className='cloud-controls';
actions.innerHTML='<button id="connectCloud">Connect cloud</button><button id="saveCloud" class="primary">Save</button><button id="shareCloud">Share</button>';
$c('.titleblock').after(actions);
const panel=document.createElement('dialog'); panel.className='cloud-dialog';
panel.innerHTML='<form id="connectForm"><button type="button" id="closeCloud" class="x">Close</button><h2>Cloud workspace</h2><p id="cloudInfo">Checking service...</p><label>Owner key<input id="ownerKey" type="password" autocomplete="off" minlength="32" required></label><button id="loginCloud" class="primary">Connect</button><p id="cloudMessage" role="status"></p><div class="cloud-actions"><button type="button" id="loadCloud">Load cloud version</button><button type="button" id="backupCloud">Download full backup</button><label>Restore full backup<input id="restoreCloud" type="file" accept=".json"></label><button type="button" id="revokeCloud">Revoke all share links</button><button type="button" id="disconnectCloud">Disconnect</button></div></form>';
document.body.append(panel);
const sharePanel=document.createElement('dialog'); sharePanel.className='cloud-dialog';
sharePanel.innerHTML='<form method="dialog"><h2>Shared workspace link</h2><p id="shareInfo"></p><label>Link<input id="shareLink" readonly></label><p id="copyStatus" role="status"></p><button type="button" id="copyLink">Copy link</button> <button>Close</button></form>';
document.body.append(sharePanel);
$c('#saveState').setAttribute('role','status');
$c('.production-banner').textContent='Local edits are saved in this browser | Use Save to sync to cloud';
function status(){if(!busy)$c('#saveState').textContent=error||(key&&synced===stateJSON()?'Synced | '+new Date(updated).toLocaleString():'Saved locally | Not synced to cloud');}
function fail(e){error=e.message;$c('#cloudMessage').textContent=error;$c('#saveState').textContent=error;}
function ack(snapshot,result){synced=snapshot;revision=result.revision;updated=result.updated;localStorage.setItem('cloudAckV1',JSON.stringify({state:synced,revision,updated}));}
async function api(path,method='GET',body){
let r;try{r=await fetch(new URL('api/'+path,location.href),{method,headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new Error('Cannot reach cloud. Local data is retained; retry when connected.');}
let result;try{result=await r.json();}catch{throw new Error('Cloud service is unavailable at this address.');}
if(!r.ok)throw new Error(result.error||'Cloud request failed.');return result;
}
function backup(){const u=URL.createObjectURL(new Blob([stateJSON()],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='finance-plan-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function load(result){restoreState(JSON.stringify(result.state));undoStack=[];redoStack=[];updateHistoryButtons();ack(stateJSON(),result);error='';}
const oldSave=save,oldRestore=restoreState;
save=function(...args){try{oldSave(...args);error='';status();}catch(e){fail(new Error('Local save failed. Download a backup or save to cloud.'));throw e;}};
restoreState=function(...args){oldRestore(...args);error='';status();};
$c('#connectCloud').onclick=()=>panel.showModal();$c('#closeCloud').onclick=()=>panel.close();$c('#backupCloud').onclick=backup;
$c('#connectForm').onsubmit=async e=>{
e.preventDefault();if(busy||!available)return;busy=true;key=$c('#ownerKey').value;$c('#ownerKey').value='';$c('#saveState').textContent='Connecting...';
try{const r=await api('workspace');error='';
if(!r.state){revision=0;synced='';updated='';}
else if(JSON.stringify(r.state)===stateJSON())ack(stateJSON(),r);
else if(confirm('Load the saved cloud workspace? Your current local data will download as a full backup first. Cancel keeps your local edits.')){backup();load(r);}
$c('#connectCloud').textContent='Cloud settings';$c('#cloudMessage').textContent='Connected. Save uploads all pages and Calendar Todos. Share opens the full workspace in Viewing mode, with an Editing option.';panel.close();
}catch(e){key='';fail(e);}finally{busy=false;status();}
};
$c('#loadCloud').onclick=async()=>{
if(busy)return;if(!key)return fail(new Error('Connect with your owner key first.'));busy=true;
try{const r=await api('workspace');if(!r.state)throw new Error('No cloud save yet.');if(confirm('Download a backup and replace local data with the cloud version?')){backup();load(r);panel.close();}}
catch(e){fail(e);}finally{busy=false;status();}
};
async function sync(){
if(busy)return null;if(!key||!available){panel.showModal();return null;}
if($c('#editDrawer').classList.contains('open')||$c('#todoDialog').open){alert('Save or close the item being edited before syncing.');return null;}
busy=true;error='';$c('#saveState').textContent='Syncing...';$c('#saveCloud').disabled=true;const snapshot=stateJSON();
try{const r=await api('workspace','PUT',{state:JSON.parse(snapshot),revision});ack(snapshot,r);return r;}catch(e){fail(e);return null;}finally{busy=false;$c('#saveCloud').disabled=false;status();}
}
$c('#saveCloud').onclick=sync;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();sync();}});
$c('#shareCloud').onclick=async()=>{
if(busy)return;
if(!confirm('Share this entire workspace, including every weekly page, Calendar and Dashboard? Recipients start in Viewing and can switch to Editing and Save changes to the same workspace. Anyone you forward the link to receives this access.'))return;
const initialView={active,view:!$c('#calendarView').classList.contains('hidden')?'calendar':!$c('#dashboardView').classList.contains('hidden')?'dashboard':'weekly',dashboardWeek:$c('#dashboardWeek').value,calendarMonth:dateKey(calendarMonth),selectedDate,search:$c('#search').value,statusFilter:$c('#statusFilter').value,zoom};
const r=await sync();if(!r)return;busy=true;
try{const result=await api('shares','POST',{scope:'workspace',allowEdit:true,initialView,revision:r.revision}),url=new URL('./',location.href);url.hash='share='+result.token;$c('#shareLink').value=url.href;$c('#shareInfo').textContent='Full workspace | Opens in Viewing. Recipients can switch to Editing and Save changes visible to everyone.';$c('#copyStatus').textContent='';sharePanel.showModal();}
catch(e){fail(e);}finally{busy=false;status();}
};
$c('#copyLink').onclick=async()=>{try{await navigator.clipboard.writeText($c('#shareLink').value);$c('#copyStatus').textContent='Link copied.';}catch{$c('#shareLink').select();$c('#copyStatus').textContent='Select and copy the link above.';}};
$c('#revokeCloud').onclick=async()=>{if(busy)return;if(!key)return fail(new Error('Connect first.'));if(!confirm('Disable all existing share links?'))return;busy=true;try{await api('shares','DELETE');$c('#cloudMessage').textContent='All share links revoked.';}catch(e){fail(e);}finally{busy=false;}};
$c('#disconnectCloud').onclick=()=>{if(busy)return;key='';$c('#connectCloud').textContent='Connect cloud';$c('#cloudMessage').textContent='Disconnected. Local data stays in this browser.';status();};
$c('#restoreCloud').onchange=async e=>{
const file=e.target.files[0];e.target.value='';if(!file||busy)return;
try{if(file.size>5*1024*1024)throw new Error('Backup exceeds 5 MB.');const s=JSON.parse(await file.text());
const safe=v=>!v||typeof v!=='object'||Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&safe(x));
if(!safe(s)||!s.data||!Object.keys(s.data).length||!Array.isArray(s.futureSheets)||!s.dailyPlans||!s.pageMeta||!Object.values(s.data).every(rows=>Array.isArray(rows)&&rows.every(Array.isArray)))throw new Error('Invalid backup.');
if(confirm('Download a backup, then replace local data with this file? Cloud stays unchanged until Save.')){backup();restoreState(JSON.stringify(s));undoStack=[];redoStack=[];updateHistoryButtons();panel.close();status();}}
catch(e){fail(e);}
};
setInterval(async()=>{
if(!key||busy||document.hidden||$c('#editDrawer').classList.contains('open')||$c('#todoDialog').open||$c('#newPageDialog').open)return;
const before=stateJSON();
try{const r=await api('workspace');
if(busy||!key||stateJSON()!==before||$c('#editDrawer').classList.contains('open')||$c('#todoDialog').open||$c('#newPageDialog').open)return;
if(r.state&&r.revision>revision){if(before===synced)load(r);else error='Someone saved a newer version. Local edits are retained; use Load cloud version before saving.';status();}
}catch(e){fail(e);}
},15000);
status();
fetch(new URL('api/health',location.href),{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(r=>{available=r.service==='finance-dt-sync';}).catch(()=>{}).finally(()=>{
$c('#cloudInfo').textContent=available?'Use your owner key to connect. It stays only in this tab memory. Connect on another device to load your workspace.':'Cloud is not deployed at this address. Local editing and full backups work. Open the cloud-hosted app after deployment.';
$c('#loginCloud').disabled=!available;if(!available)$c('.production-banner').textContent='Local mode | Cloud deployment required for sync and share';
});
})();