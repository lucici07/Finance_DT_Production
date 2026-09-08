(() => {
const session=window.sharedSession,$s=s=>document.querySelector(s);
let revision=session.revision,synced=stateJSON(),updated=session.updated,busy=false,revoked=false,error='';
const controls=document.createElement('div');controls.className='cloud-controls share-session-controls';
controls.innerHTML='<label class="workspace-mode-label">Mode <select id="workspaceMode"><option value="viewing">Viewing</option><option value="editing">Editing</option></select></label><button id="sharedSave" class="primary">Save</button><button id="sharedReload">Load latest</button><button id="sharedBackup">Download backup</button>';
$s('.titleblock').after(controls);
$s('#workspaceMode').disabled=!session.canEdit;
$s('#saveState').setAttribute('role','status');
const allowed='#weeklyBtn,#calendarBtn,#dashboardBtn,#backToWeekly,#prevMonth,#nextMonth,#todayBtn,#monthTitle,#applyMonth,#monthWheel,#yearWheel,#dashboardWeek,#statusFilter,#search,#zoomIn,#zoomOut,#zoomRange,#zoomValue,#exportBtn,#dashboardExportPdf,#dashboardRefresh,#refreshBtn,#privacyBtn,#railAI,#closeAgent,#chatInput,#chatForm,.suggestions button,[data-tab],[data-date],.note-link,.share-session-controls button,.share-session-controls select,#privacyDialog button,#monthPicker button';
function mayUse(element){return !!element.closest(allowed);}
function markControls(){
  document.querySelectorAll('button,input,select,textarea').forEach(el=>{
    const blocked=!session.editing&&!mayUse(el);
    el.classList.toggle('viewing-disabled',blocked);
    if(blocked)el.setAttribute('aria-disabled','true');else if(el.classList.contains('viewing-disabled')===false)el.removeAttribute('aria-disabled');
  });
  $s('#sharedSave').disabled=!session.editing||busy||revoked;
}
function status(){
  $s('#workspaceMode').value=session.editing?'editing':'viewing';
  document.body.classList.toggle('workspace-viewing',!session.editing);
  $s('.production-banner').textContent=revoked?'Share access revoked':session.editing?'Editing shared workspace | Save updates the same workspace for everyone':'Viewing shared workspace | Switch to Editing to make changes';
  if(!busy)$s('#saveState').textContent=error||(synced===stateJSON()?'Latest cloud save | '+new Date(updated).toLocaleString():'Unsaved changes in this tab');
  markControls();
}
function gate(e){
  if(session.editing&&!revoked)return;
  if(e.type==='keydown'){
    const command=e.ctrlKey||e.metaKey;
    if(command&&['z','y','v','s'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}
    return;
  }
  if(['dblclick','contextmenu','dragstart','drop','paste','submit'].includes(e.type)){
    if(e.type==='submit'&&(e.target.id==='chatForm'||e.target.closest('#monthPicker,#privacyDialog')))return;
    if(e.type==='paste'&&e.target.matches('#search,#chatInput'))return;
    e.preventDefault();e.stopImmediatePropagation();return;
  }
  const target=e.target.closest('button,input,select,textarea,[data-edit-todo],[draggable]');
  if(target&&!mayUse(e.target)){e.preventDefault();e.stopImmediatePropagation();}
}
for(const event of ['click','dblclick','contextmenu','dragstart','drop','paste','keydown','submit','input','change'])window.addEventListener(event,gate,true);
new MutationObserver(markControls).observe(document.querySelector('.app'),{childList:true,subtree:true});
function draftOpen(){return $s('#editDrawer').classList.contains('open')||$s('#todoDialog').open||$s('#newPageDialog').open;}
function backup(){const u=URL.createObjectURL(new Blob([stateJSON()],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='shared-workspace-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function request(method='GET',body){
  let response;
  try{response=await fetch(new URL('api/shared/'+session.token,location.href),{method,headers:body?{'Content-Type':'application/json','X-Workspace-Mode':'editing'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Cannot reach cloud. Changes remain in this tab; retry or download a backup.');}
  const result=await response.json();
  if(!response.ok){
    if([403,404].includes(response.status)){revoked=true;session.editing=false;$s('#workspaceMode').disabled=true;}
    throw new Error(result.error||'Unable to load workspace.');
  }
  return result;
}
function apply(result){
  restoreState(JSON.stringify(result.state));undoStack=[];redoStack=[];updateHistoryButtons();
  revision=result.revision;updated=result.updated;synced=stateJSON();error='';
}
const oldSave=save,oldRestore=restoreState;
save=function(...args){if(!session.editing)return;oldSave(...args);error='';status();};
restoreState=function(...args){oldRestore(...args);status();};
async function saveCloud(){
  if(busy||!session.editing||revoked)return false;
  if(draftOpen()){alert('Finish or close the item being edited before Save.');return false;}
  busy=true;error='';$s('#saveState').textContent='Syncing...';markControls();
  const snapshot=stateJSON();
  try{const result=await request('PUT',{state:JSON.parse(snapshot),revision});revision=result.revision;updated=result.updated;synced=snapshot;return synced===stateJSON();}
  catch(e){error=e.message;return false;}finally{busy=false;status();}
}
async function refresh(force=false){
  if(busy||revoked||draftOpen())return false;
  if(force&&stateJSON()!==synced){if(!confirm('Download a backup of your edits, then load the latest cloud version?'))return false;backup();}
  const before=stateJSON();busy=true;
  try{
    const result=await request();
    if(draftOpen()||before!==stateJSON())return false;
    if(force||stateJSON()===synced){if(result.revision!==revision||force)apply(result);}
    else if(result.revision!==revision)error='Someone saved a newer version. Your edits are retained; use Load latest before saving.';
    return true;
  }catch(e){error=e.message;return false;}finally{busy=false;status();}
}
$s('#workspaceMode').onchange=async e=>{
  if(busy||revoked){status();return;}
  const next=e.target.value;
  if(next==='editing'){
    if(!session.canEdit||!await refresh())return status();
    session.editing=true;
  }else{
    if(draftOpen()){alert('Finish or close the item being edited first.');return status();}
    if(stateJSON()!==synced){if(!confirm('Save your changes before returning to Viewing? Cancel keeps Editing.')||!await saveCloud())return status();}
    session.editing=false;
  }
  status();
};
$s('#sharedSave').onclick=saveCloud;$s('#sharedReload').onclick=()=>refresh(true);$s('#sharedBackup').onclick=backup;
document.addEventListener('keydown',e=>{if(session.editing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveCloud();}});
addEventListener('beforeunload',e=>{if(stateJSON()!==synced||session.editing&&draftOpen()){e.preventDefault();e.returnValue='';}});
const view=session.initialView||{};
if(view.active&&data[view.active]){active=view.active;tabs();}
if(typeof view.search==='string')$s('#search').value=view.search;
if(typeof view.statusFilter==='string')$s('#statusFilter').value=view.statusFilter;
if(view.calendarMonth&&/^\d{4}-\d{2}-01$/.test(view.calendarMonth))calendarMonth=new Date(view.calendarMonth+'T12:00:00');
if(view.selectedDate&&/^\d{4}-\d{2}-\d{2}$/.test(view.selectedDate))selectedDate=view.selectedDate;
if(view.view==='calendar')showCalendar(true);else if(view.view==='dashboard'){showDashboard();if(view.dashboardWeek&&data[view.dashboardWeek]){$s('#dashboardWeek').value=view.dashboardWeek;renderDashboard();}}else render();
if(Number.isFinite(view.zoom))applyZoom(view.zoom);
status();
setInterval(()=>{if(!document.hidden)refresh();},15000);
})();