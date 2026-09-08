(async () => {
  const token = new URLSearchParams(location.hash.slice(1)).get('share');
  const loadScript = src => new Promise((resolve,reject) => { const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load the app. Refresh to retry.'));document.body.append(script); });
  try {
    if (token !== null) {
      document.body.classList.add('workspace-loading');
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid share link.');
      const response=await fetch(new URL('api/shared/'+token,location.href),{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(response.status===404?'This share link is unavailable or has been revoked.':'Unable to load the shared workspace. Refresh to retry.');
      const result=await response.json();
      if(result.scope!=='workspace'||!result.state)throw new Error('This is not a workspace share link.');
      window.sharedSession={token,...result,editing:false};
      const values=new Map(Object.entries({
        financePlanProductionV1:JSON.stringify(result.state.data),futureSheetsProductionV1:JSON.stringify(result.state.futureSheets),
        dailyPlansProductionV1:JSON.stringify(result.state.dailyPlans),pageMetaProductionV1:JSON.stringify(result.state.pageMeta)
      }));
      window.workspaceStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
    } else window.workspaceStorage=localStorage;
    await loadScript('app.js?v=18');
    await loadScript('mobile.js?v=1');
    await loadScript('export.js?v=1');
    await loadScript(window.sharedSession?'shared-workspace.js?v=1':'sync.js?v=3');
    document.body.classList.remove('workspace-loading');
  } catch(error) {
    document.body.classList.remove('workspace-loading');
    document.body.replaceChildren();
    const box=document.createElement('main');box.className='share-load-error';
    const title=document.createElement('h1');title.textContent='Workspace unavailable';
    const text=document.createElement('p');text.textContent=error.message;
    const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();
    box.append(title,text,retry);document.body.append(box);
  }
})();