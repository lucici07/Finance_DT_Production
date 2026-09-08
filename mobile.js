(() => {
  const media=matchMedia('(max-width:760px)'),toolbar=document.querySelector('.toolbar');
  const tools=document.createElement('details');tools.className='mobile-tools';
  const summary=document.createElement('summary');summary.textContent='More tools';tools.append(summary);
  const body=document.createElement('div');body.className='mobile-tools-body';tools.append(body);toolbar.append(tools);
  const advanced=['.history-controls','#refreshBtn','#resetBtn','.toolbar > .button','#columnsBtn','#editBtn','.zoom-control'].map(selector=>document.querySelector(selector)).filter(Boolean).map(element=>{const marker=document.createComment('toolbar position');element.before(marker);return {element,marker};});
  const list=document.createElement('div');list.className='mobile-task-list';list.setAttribute('aria-label','Weekly tasks');document.querySelector('.tablewrap').append(list);
  const expanded=new Set();
  function cards(){
    list.replaceChildren();if(!media.matches)return;
    const indices=[...document.querySelectorAll('#tbody tr[data-row]')].map(tr=>Number(tr.dataset.row));
    for(const index of indices){
      const row=data[active][index],hs=headers(),id=row[hs.length]||active+':'+index;
      const card=document.createElement('details');card.className='mobile-task-card';card.open=expanded.has(id);
      card.addEventListener('toggle',()=>{if(card.isConnected){if(card.open)expanded.add(id);else expanded.delete(id);}});
      const heading=document.createElement('summary'),title=document.createElement('span'),status=document.createElement('span');
      title.className='mobile-task-title';title.textContent=cell(row,'Topic')||'Item '+(index+1);
      status.className='mobile-task-status';status.textContent=cell(row,'Status')||'';
      heading.onclick=()=>{selectedRow=index;selectedCell=null;};
      heading.append(title);if(status.textContent)heading.append(status);card.append(heading);
      const dl=document.createElement('dl');
      hs.forEach((name,col)=>{if(row[col]===null||row[col]===undefined||String(row[col])==='')return;const field=document.createElement('div');field.className='mobile-task-field';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;if(name==='Note')dd.innerHTML=linkify(row[col]);else dd.textContent=row[col];field.append(dt,dd);dl.append(field);});
      card.append(dl);
      const edit=document.createElement('button');edit.type='button';edit.className='mobile-edit-row';edit.textContent='Edit item';
      edit.onclick=()=>{if(window.sharedSession&&!window.sharedSession.editing)return;selectedRow=index;selectedCell=null;if(isDailyOrphan(row)){if(confirm('The linked Daily Todo was deleted. Add it back to Calendar?'))restoreDailyFromRow(row);return;}openDrawer(index);};
      card.append(edit);list.append(card);
    }
    if(!indices.length){const empty=document.createElement('p');empty.className='mobile-empty';empty.textContent='No matching items. Change the filters or add a new item.';list.append(empty);}
  }
  const originalRender=render;
  render=function(...args){originalRender(...args);cards();};
  function layout(){
    if(media.matches){for(const {element} of advanced)body.append(element);}
    else {tools.open=false;for(const {element,marker} of advanced)marker.after(element);}
    cards();
  }
  document.addEventListener('click',event=>{if(media.matches&&event.target.closest('#weeklyBtn,#calendarBtn,#dashboardBtn,#backToWeekly,[data-tab]'))requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'auto'}));});
  media.addEventListener('change',layout);
  new ResizeObserver(entries=>{document.documentElement.style.setProperty('--mobile-header-height',entries[0].target.getBoundingClientRect().height+'px');}).observe(document.querySelector('.topbar'));
  layout();
})();