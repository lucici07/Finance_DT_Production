// Transport is supplied by SPFx's SPHttpClient; no application secret is needed.
export const DEFAULT_SITE = 'https://lenovonam.sharepoint.com/sites/WeeklyCatch-Up';
export function fiscalYear(date, startMonth) {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) throw new Error('Set the fiscal year start month (1–12).');
  return date.getFullYear() - (date.getMonth() + 1 < startMonth ? 1 : 0);
}
const quote = value => encodeURIComponent(String(value).replaceAll("'", "''")).replaceAll("'", '%27');
export class SharePointStore {
  constructor(site, year, request, validate) {
    const url = new URL(site);
    if (url.protocol !== 'https:' || !Number.isInteger(year) || year < 2000 || year > 2200) throw new Error('Invalid SharePoint site or fiscal year.');
    this.site = url.href.replace(/\/$/, '');
    this.title = `FinanceWeekly_FY${year}`;
    this.base = `${this.site}/_api/web/lists/getbytitle('${this.title}')`;
    this.request = request;
    this.validate = validate;
  }
  async api(path, method = 'GET', body, headers = {}) {
    const response = await this.request(path, {method, headers: {Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', 'odata-version': '', ...headers}, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)});
    if (!response.ok) {
      const error = new Error(response.status === 412 ? 'A newer save exists. Reload before saving; your draft is still open.' : response.status === 403 ? 'Your SharePoint account does not have permission for this operation.' : response.status === 404 ? 'The fiscal-year list or saved workspace was not found.' : `SharePoint request failed (${response.status}). Retry after checking your connection.`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const value = await response.json();
    return {value, etag: response.headers.get('ETag') || value['odata.etag'] || value['@odata.etag']};
  }
  async currentUser() {
    return (await this.api(`${this.site}/_api/web/currentuser?$select=Id,Title,LoginName,Email`)).value;
  }
  async provision() {
    // Explicit setup action only. Rerunning repairs an interrupted field setup.
    try { await this.api(this.base); }
    catch (error) {
      if (error.status !== 404) throw error;
      await this.api(`${this.site}/_api/web/lists`, 'POST', {Title: this.title, BaseTemplate: 100, EnableAttachments: true, Description: 'Personal finance weekly workspaces and immutable JSON save snapshots.'});
    }
    const fields = [
      ['EntryType', 'Text', ' Indexed="TRUE"'],
      ['OwnerKey', 'Text', ' Indexed="TRUE"'],
      ['EmployeeName', 'Text', ''],
      ['SnapshotId', 'Number', ' Decimals="0"']
    ];
    for (const [name, type, extra] of fields) {
      try { await this.api(`${this.base}/fields/getbyinternalnameortitle('${name}')`); }
      catch (error) {
        if (error.status !== 404) throw error;
        await this.api(`${this.base}/fields/createfieldasxml`, 'POST', {parameters: {SchemaXml: `<Field Type="${type}" Name="${name}" StaticName="${name}" DisplayName="${name}"${extra} />`, Options: 0}});
      }
    }
    await this.api(`${this.base}/fields/getbyinternalnameortitle('Title')`, 'POST', {Indexed: true, EnforceUniqueValues: true}, {'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*'});
  }
  async members() {
    const result = await this.api(`${this.base}/items?$select=Id,OwnerKey,EmployeeName&$filter=EntryType%20eq%20%27Workspace%27&$top=100`);
    return result.value.value;
  }
  async head(owner) {
    const result = await this.api(`${this.base}/items?$select=Id&$filter=Title%20eq%20%27${quote(`workspace:${owner}`)}%27&$top=1`);
    const first = result.value.value[0];
    if (!first) return null;
    const item = await this.api(`${this.base}/items(${first.Id})`);
    if (!item.etag) throw new Error('SharePoint did not return a version tag. Saving is disabled to protect existing data.');
    return {...item.value, etag: item.etag};
  }
  async load(owner) {
    const head = await this.head(owner);
    if (!head) return {state: null, revision: null, updated: null};
    if (!head.SnapshotId) return {state: null, revision: head.etag, updated: head.Modified};
    const snapshot = await this.api(`${this.base}/items(${Number(head.SnapshotId)})/AttachmentFiles('workspace.json')/$value`);
    if (!this.validate(snapshot.value)) throw new Error('Saved workspace failed validation. No data was overwritten.');
    return {state: snapshot.value, revision: head.etag, updated: head.Modified};
  }
  async save(owner, name, state, revision) {
    if (!this.validate(state)) throw new Error('Invalid workspace. Save cancelled.');
    const payload = JSON.stringify(state);
    if (new TextEncoder().encode(payload).length > 1800000) throw new Error('Workspace exceeds the 1.8 MB save limit. Export a backup and split the workspace by fiscal year.');
    const me = await this.currentUser();
    if (me.LoginName !== owner) throw new Error('Other members’ workspaces are read-only in this app.');
    let head = await this.head(owner);
    if (head && !head.SnapshotId && revision === null) revision = head.etag;
    if ((head?.etag ?? null) !== revision) throw Object.assign(new Error('A newer save exists. Reload before saving; your draft is still open.'), {status: 412});
    if (!head) {
      await this.api(`${this.base}/items`, 'POST', {Title: `workspace:${owner}`, EntryType: 'Workspace', OwnerKey: owner, EmployeeName: name});
      head = await this.head(owner);
    }
    // Upload to a separate immutable snapshot item. A partial upload never replaces
    // the pointer to the last successful save. Failed/conflicting saves may leave
    // an unreferenced snapshot for an administrator to clean up later.
    const snapshot = await this.api(`${this.base}/items`, 'POST', {Title: `snapshot:${crypto.randomUUID()}`, EntryType: 'Snapshot', OwnerKey: owner, EmployeeName: name});
    const snapshotId = snapshot.value.Id;
    await this.api(`${this.base}/items(${snapshotId})/AttachmentFiles/add(FileName='workspace.json')`, 'POST', payload, {'Content-Type': 'application/octet-stream'});
    await this.api(`${this.base}/items(${head.Id})`, 'POST', {SnapshotId: snapshotId}, {'X-HTTP-Method': 'MERGE', 'IF-MATCH': head.etag});
    const committed = await this.head(owner);
    if (Number(committed.SnapshotId) !== Number(snapshotId)) throw Object.assign(new Error('Another save completed immediately after yours. Reload before continuing.'), {status: 412});
    return {state, revision: committed.etag, updated: committed.Modified};
  }
}
