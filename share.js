(() => {
const token=location.hash.slice(1);let page=null,loading=false;const status=document.querySelector('#viewerStatus');
function render(){const head=document.querySelector('#viewerHead'),body=document.querySelector('#viewerRows');head.replaceChildren();body.replaceChildren();if(!page)return;
document.querySelector('#viewerTitle').textContent=page.name;const row=document.createElement('tr');
for(const name of page.headers){const th=document.createElement('th');th.textContent=name;row.append(th);}head.append(row);
const query=document.querySelector('#viewerSearch').value.toLowerCase();
for(const values of page.rows.filter(values=>values.some(v=>String(v??'').toLowerCase().includes(query)))){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v??'';tr.append(td);}body.append(tr);}
if(!body.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=page.headers.length;td.textContent=query?'No matching items.':'No items on this page.';tr.append(td);body.append(tr);}
}
async function refresh(){if(loading)return;loading=true;document.querySelector('#viewerRefresh').disabled=true;
try{if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid share link.');const r=await fetch(new URL('api/shared/'+token,location.href),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(r.status===404?'This link is unavailable or has been revoked.':'Unable to load. Try Refresh.');page=await r.json();render();status.textContent='Last saved '+new Date(page.updated).toLocaleString()+' | Read only | Checks for updates every 30 seconds';}
catch(e){page=null;render();document.querySelector('#viewerTitle').textContent='Shared plan';status.textContent=e.message;}
finally{loading=false;document.querySelector('#viewerRefresh').disabled=false;}}
document.querySelector('#viewerSearch').oninput=render;document.querySelector('#viewerRefresh').onclick=refresh;refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
})();