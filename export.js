(() => {
  const dialog=document.createElement('dialog');dialog.id='exportDialog';dialog.className='cloud-dialog';
  dialog.innerHTML='<form id="exportForm"><button type="button" id="closeExport" class="x">Close</button><h2>Export workspace</h2><label>Format<select id="exportFormat"><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option></select></label><label>Pages<select id="exportScope"><option value="all">All workspace pages</option><option value="current">Current weekly page</option></select></label><p id="exportHint">Each workspace page becomes a separate Excel worksheet.</p><p id="exportMessage" role="status"></p><button type="submit" id="confirmExport" class="primary">Export</button></form>';
  document.body.append(dialog);
  document.querySelector('#exportBtn').onclick=()=>{document.querySelector('#exportMessage').textContent='';dialog.showModal();};
  document.querySelector('#closeExport').onclick=()=>dialog.close();
  document.querySelector('#exportFormat').onchange=e=>{document.querySelector('#exportHint').textContent=e.target.value==='pdf'?'One landscape PDF page per workspace page. Large tables scale to fit. Choose Save as PDF in the print window.':'Each workspace page becomes a separate Excel worksheet.';};
  function cleanupPrint(){
    document.body.classList.remove('workspace-printing');
    document.querySelector('#workspacePrint')?.remove();
  }
  window.prepareWorkspacePrint=function(names=Object.keys(data)){
    cleanupPrint();
    const root=document.createElement('div');root.id='workspacePrint';
    const timestamp=new Date().toLocaleString();
    for(const name of names){
      const sheet=document.createElement('section');sheet.className='export-sheet';
      const content=document.createElement('div');content.className='export-sheet-content';
      const title=document.createElement('h1');title.textContent=name;
      const meta=document.createElement('p');meta.className='export-meta';meta.textContent='Finance DT Weekly Plan | '+timestamp+' | '+data[name].length+' items';
      const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr'),body=document.createElement('tbody'),hs=headers(name);
      for(const label of hs){const th=document.createElement('th');th.textContent=label;header.append(th);}head.append(header);
      for(const row of data[name]){const tr=document.createElement('tr');for(let i=0;i<hs.length;i++){const td=document.createElement('td');td.textContent=row[i]??'';tr.append(td);}body.append(tr);}
      if(!data[name].length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=hs.length;td.textContent='No items';tr.append(td);body.append(tr);}
      table.append(head,body);content.append(title,meta,table);sheet.append(content);root.append(sheet);
      content.dataset.columns=String(hs.length);
    }
    document.body.append(root);
    // The same fixed physical dimensions are used for measurement and printing.
    for(const sheet of root.children){
      const content=sheet.firstElementChild,width=sheet.clientWidth,height=sheet.clientHeight;
      content.style.width=Math.max(width,Number(content.dataset.columns)*125)+'px';
      const scale=Math.min(1,width/(content.scrollWidth+2),height/(content.scrollHeight+2));
      content.style.transform='scale('+scale+')';
    }
    document.body.classList.add('workspace-printing');
    return root;
  };
  document.querySelector('#exportForm').onsubmit=async event=>{
    event.preventDefault();
    const button=document.querySelector('#confirmExport');button.disabled=true;
    try{
      const names=document.querySelector('#exportScope').value==='current'?[active]:Object.keys(data);
      if(document.querySelector('#exportFormat').value==='excel')await exportExcel(names);
      else{
        if(document.fonts)await document.fonts.ready;
        window.prepareWorkspacePrint(names);dialog.close();
        const previousTitle=document.title;document.title='Finance DT Weekly Plan';
        addEventListener('afterprint',()=>{cleanupPrint();document.title=previousTitle;},{once:true});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        try{window.print();}catch(error){cleanupPrint();document.title=previousTitle;throw error;}
      }
      dialog.close();
    }catch(error){document.querySelector('#exportMessage').textContent='Export failed: '+error.message;if(!dialog.open)dialog.showModal();}
    finally{button.disabled=false;}
  };
})();