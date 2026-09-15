(() => {
const key='financeWorkspaceLibraryV1';
const valid=item=>item&&typeof item.token==='string'&&/^[a-f0-9]{64}$/.test(item.token)&&typeof item.name==='string'&&typeof item.folder==='string';
function read(){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(valid):[];}catch{return [];}}
function write(items){localStorage.setItem(key,JSON.stringify(items));}
const token=window.sharedSession?.token;
let storageError='';
if(token){try{const items=read(),existing=items.find(item=>item.token===token);if(existing)existing.opened=Date.now();else items.unshift({token,name:'Workspace '+new Date().toLocaleString(),folder:'General',opened:Date.now()});write(items);}catch{storageError='Browser storage is unavailable. Keep your workspace link or download a backup.';}}
const button=document.createElement('button');button.id='workspaceLibrary';button.textContent='My workspaces';document.querySelector('.cloud-controls').append(button);
const dialog=document.createElement('dialog');dialog.id='libraryDialog';dialog.className='cloud-dialog workspace-library';
dialog.innerHTML='<form method="dialog"><button class="x">Close</button><h2>My workspaces</h2><p>Saved links in this browser only. Opening a new workspace does not delete previous ones.</p><label>Folder<select id="libraryFolder"></select></label><p id="libraryMessage" role="status"></p><div id="libraryItems"></div><button type="button" id="libraryExport">Export workspace list</button><label class="button">Import workspace list<input id="libraryImport" type="file" accept=".json" hidden></label><p>To restore a workspace JSON backup, use Import backup on the main page.</p></form>';
document.body.append(dialog);
const folder=dialog.querySelector('#libraryFolder'),message=dialog.querySelector('#libraryMessage'),list=dialog.querySelector('#libraryItems');
const urlFor=item=>{const url=new URL('./',location.href);url.hash='share='+item.token;return url.href;};
function mutate(action){try{const items=read();action(items);write(items);render();}catch{message.textContent='Unable to save this list in the browser. Export it or keep your workspace links.';}}
function render(){
const items=read().sort((a,b)=>(b.opened||0)-(a.opened||0)),selected=folder.value;
folder.replaceChildren(new Option('All folders',''));
for(const name of [...new Set(items.map(i=>i.folder))].sort())folder.add(new Option(name,name));
folder.value=[...folder.options].some(o=>o.value===selected)?selected:'';
list.replaceChildren();message.textContent=storageError;
const visible=items.filter(i=>!folder.value||i.folder===folder.value);
if(!visible.length){const empty=document.createElement('p');empty.textContent='No saved workspaces here yet. Create a workspace or open an existing share link to add it.';list.append(empty);}
for(const item of visible){
 const card=document.createElement('article');card.className='library-item';
 const name=document.createElement('strong');name.textContent=item.name+(item.token===token?' (current)':'');
 const group=document.createElement('small');group.textContent=item.folder;
 const actions=document.createElement('div');actions.className='library-actions';
 const open=document.createElement('a');open.textContent='Open';open.href=urlFor(item);open.target='_blank';open.rel='noopener noreferrer';open.className='button';actions.append(open);
 for(const [label,action] of [
 ['Rename',()=>{const value=prompt('Workspace name:',item.name)?.trim();if(value)mutate(items=>{items.find(i=>i.token===item.token).name=value.slice(0,120);});}],
 ['Move to folder',()=>{const value=prompt('Folder name (enter a new name to create a folder):',item.folder)?.trim();if(value){folder.value='';mutate(items=>{items.find(i=>i.token===item.token).folder=value.slice(0,80);});}}],
 ['Remove from list',()=>{if(confirm('Remove this saved link from this browser? Cloud data will not be deleted. Keep a copy of the link if you need it later.'))mutate(items=>{const index=items.findIndex(i=>i.token===item.token);if(index>=0)items.splice(index,1);});}]
 ]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;actions.append(b);}
 card.append(name,group,actions);list.append(card);
}
}
button.onclick=()=>{render();dialog.showModal();};folder.onchange=render;
dialog.querySelector('#libraryExport').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify({format:'finance-workspace-links-v1',workspaces:read()})],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='workspace-links.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 message.textContent='Workspace links exported. This file contains access links, not a backup of task data.';
};
dialog.querySelector('#libraryImport').onchange=async e=>{
const file=e.target.files[0];e.target.value='';if(!file)return;
try{
 if(file.size>1024*1024)throw new Error('Workspace list is too large.');
 const value=JSON.parse(await file.text());
 if(value.format!=='finance-workspace-links-v1'||!Array.isArray(value.workspaces)||!value.workspaces.every(valid))throw new Error('Choose a workspace list export. For a task backup, use Import backup on the main page.');
 mutate(items=>{for(const item of value.workspaces)if(!items.some(i=>i.token===item.token))items.push({token:item.token,name:item.name.slice(0,120),folder:item.folder.slice(0,80),opened:Date.now()});});
}catch(error){message.textContent=error.message;}
};
})();
