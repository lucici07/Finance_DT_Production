export async function mountApp(window, bridge) {
  /*__FRAME_BINDINGS__*/
  window.sharePointBridge = bridge;
  try {
    const result = await bridge.request('GET');
    const initial = result.state || {data: {W1: [], 'Next 3 Weeks': []}, futureSheets: ['Next 3 Weeks'], dailyPlans: {}, pageMeta: {W1: {id: crypto.randomUUID()}, 'Next 3 Weeks': {id: crypto.randomUUID()}}};
    window.sharedSession = {...result, token: 'sharepoint', state: initial, editing: false, canEdit: bridge.canEdit, initialView: {active: Object.keys(initial.data)[0]}};
    const values = new Map(Object.entries({financePlanProductionV1: JSON.stringify(initial.data), futureSheetsProductionV1: JSON.stringify(initial.futureSheets), dailyPlansProductionV1: JSON.stringify(initial.dailyPlans), pageMetaProductionV1: JSON.stringify(initial.pageMeta)}));
    window.workspaceStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
    const workspaceStorage = window.workspaceStorage;
    /*__FINANCE_APP_CODE__*/
    document.querySelector('.profile b').textContent = bridge.displayName;
    document.querySelector('.profile small').textContent = 'FY ' + bridge.year;
    document.querySelector('.avatar').textContent = bridge.displayName.slice(0, 1);
    const backup = document.createElement('button'); backup.textContent = 'Download workspace backup';
    backup.onclick = () => {
      const url = URL.createObjectURL(new Blob([stateJSON()], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = 'weekly-FY' + bridge.year + '.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.querySelector('.share-session-controls').append(backup);
    if (bridge.canEdit) {
      const label = document.createElement('label'); label.textContent = 'Import workspace backup';
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
      input.onchange = async () => {
        const file = input.files[0]; input.value = ''; if (!file) return;
        try {
          if (!window.sharedSession.editing) throw new Error('Switch to Editing before importing.');
          if (file.size > 1800000) throw new Error('Backup exceeds 1.8 MB.');
          const raw = JSON.parse(await file.text()), value = raw.state || raw;
          if (!bridge.validate(value)) throw new Error('Invalid workspace backup.');
          if (confirm('Replace this draft with the backup? SharePoint changes only after you click Save.')) { restoreState(JSON.stringify(value)); save(); }
        } catch (error) { alert(error.message); }
      };
      label.append(input); document.querySelector('.share-session-controls').append(label);
    }
    window.hasSharePointDraft = () => stateJSON() !== window.lastSharePointSave || !!inlineEdit || document.querySelector('#editDrawer').classList.contains('open') || document.querySelector('#todoDialog').open || document.querySelector('#newPageDialog').open;
    window.lastSharePointSave = stateJSON();
  } catch (error) {
    document.body.replaceChildren(); const message = document.createElement('p'); message.textContent = error.message; document.body.append(message);
  }
}
