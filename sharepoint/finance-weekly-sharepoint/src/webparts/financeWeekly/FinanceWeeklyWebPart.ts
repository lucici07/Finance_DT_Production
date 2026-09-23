// @ts-nocheck
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { PropertyPaneTextField, PropertyPaneDropdown } from '@microsoft/sp-property-pane';
import appDocument from '../../generated/appDocument';
import { SharePointStore, DEFAULT_SITE, fiscalYear } from '../../generated/store';
import { validState } from '../../generated/validation';

export default class FinanceWeeklyWebPart extends BaseClientSideWebPart {
  private frame;
  private store;
  private me;
  private owner;
  private year;
  private members = [];
  private loading = false;
  private beforeLeave = event => {
    if (this.frame?.contentWindow?.hasSharePointDraft?.()) { event.preventDefault(); event.returnValue = ''; }
  };
  protected async onInit() {
    await super.onInit();
    window.addEventListener('beforeunload', this.beforeLeave);
  }
  public render() {
    if (!this.loading && !this.frame) void this.start();
  }
  private async start() {
    this.loading = true;
    this.domElement.replaceChildren();
    const message = document.createElement('p');
    message.textContent = 'Connecting to SharePoint…';
    this.domElement.append(message);
    try {
      const params = new URL(location.href).searchParams;
      const month = Number(this.properties.fiscalStartMonth || 4);
      this.year = this.year || Number(params.get('financeYear') || fiscalYear(new Date(), month));
      const site = this.properties.siteUrl || DEFAULT_SITE;
      if (new URL(site).origin !== location.origin) throw new Error('Add this web part to a page on ' + new URL(site).origin + ', then configure the target site.');
      this.store = new SharePointStore(site, this.year, (url, options) => this.context.spHttpClient.fetch(url, SPHttpClient.configurations.v1, options), validState);
      this.me = await this.store.currentUser();
      this.owner = this.owner || params.get('financeMember') || this.me.LoginName;
      await this.show();
    } catch (error) {
      message.textContent = error.message;
      if (error.status === 404) {
        const setup = document.createElement('button');
        setup.textContent = 'Set up FY ' + this.year + ' list';
        setup.onclick = async () => {
          setup.disabled = true; message.textContent = 'Creating list and indexes…';
          try { await this.store.provision(); await this.show(); }
          catch (failure) { message.textContent = failure.message + ' Ask a site owner to run setup if access is denied.'; setup.disabled = false; }
        };
        this.domElement.append(setup);
      }
    } finally { this.loading = false; }
  }
  private async show() {
    this.members = await this.store.members();
    if (!this.members.some(member => member.OwnerKey === this.me.LoginName)) this.members.unshift({OwnerKey: this.me.LoginName, EmployeeName: this.me.Title});
    if (!this.members.some(member => member.OwnerKey === this.owner)) throw new Error('This member has not saved a workspace for the selected fiscal year.');
    const current = this.members.find(member => member.OwnerKey === this.owner);
    this.domElement.replaceChildren();
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0';
    const memberLabel = document.createElement('label'); memberLabel.textContent = 'Workspace ';
    const select = document.createElement('select');
    for (const member of this.members) { const option = document.createElement('option'); option.value = member.OwnerKey; option.textContent = member.EmployeeName + (member.OwnerKey === this.me.LoginName ? ' (me)' : ''); select.append(option); }
    select.value = this.owner;
    select.onchange = async () => {
      const next = select.value;
      if (!await this.prepareSwitch()) { select.value = this.owner; return; }
      this.owner = next; this.mountFrame();
    };
    memberLabel.append(select);
    const yearLabel = document.createElement('label'); yearLabel.textContent = 'Fiscal year starting in ';
    const yearInput = document.createElement('input'); yearInput.type = 'number'; yearInput.min = '2000'; yearInput.max = '2200'; yearInput.value = String(this.year); yearInput.style.width = '90px';
    const openYear = document.createElement('button'); openYear.textContent = 'Open year';
    openYear.onclick = async () => {
      const next = Number(yearInput.value);
      if (!Number.isInteger(next) || next < 2000 || next > 2200) { yearInput.reportValidity(); return; }
      if (!await this.prepareSwitch()) return;
      this.year = next; this.owner = this.me.LoginName; this.frame?.remove(); this.frame = undefined; await this.start();
    };
    yearLabel.append(yearInput);
    const hint = document.createElement('span'); hint.textContent = 'Each year is a separate workspace. Other members open read-only.';
    toolbar.append(memberLabel, yearLabel, openYear, hint); this.domElement.append(toolbar);
    this.mountFrame();
  }
  private async prepareSwitch() {
    return this.frame?.contentWindow?.prepareWorkspaceSwitch ? this.frame.contentWindow.prepareWorkspaceSwitch() : true;
  }
  private mountFrame() {
    this.frame?.remove();
    const owner = this.owner, year = this.year, store = this.store;
    const member = this.members.find(item => item.OwnerKey === owner);
    const blank = {data: {W1: [], 'Next 3 Weeks': []}, futureSheets: ['Next 3 Weeks'], dailyPlans: {}, pageMeta: {W1: {id: crypto.randomUUID()}, 'Next 3 Weeks': {id: crypto.randomUUID()}}};
    const frame = document.createElement('iframe');
    frame.title = 'Weekly planning workspace';
    frame.style.cssText = 'width:100%;height:85vh;min-height:700px;border:0';
    frame.financeBridge = {
      canEdit: owner === this.me.LoginName,
      displayName: member.EmployeeName,
      year,
      validate: validState,
      request: async (method, body) => {
        const result = method === 'PUT' ? await store.save(owner, member.EmployeeName, body.state, body.revision) : await store.load(owner);
        return {...result, state: result.state || blank, updated: result.updated || new Date().toISOString()};
      },
      share: async () => {
        const url = new URL(location.href);
        url.searchParams.set('financeMember', owner); url.searchParams.set('financeYear', String(year));
        try { await navigator.clipboard.writeText(url.href); alert('Workspace link copied. Recipients must have access to this SharePoint site.'); }
        catch { prompt('Copy workspace link', url.href); }
      }
    };
    this.frame = frame; this.domElement.append(frame); frame.srcdoc = appDocument;
  }
  protected async onPropertyPaneFieldChanged(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!await this.prepareSwitch()) { this.properties[name] = oldValue; return; }
    this.frame?.remove(); this.frame = undefined;
    if (name === 'fiscalStartMonth') this.year = undefined;
    await this.start();
  }
  protected onDispose() {
    window.removeEventListener('beforeunload', this.beforeLeave);
    this.frame?.remove();
  }
  protected getPropertyPaneConfiguration() {
    return {pages: [{header: {description: 'SharePoint storage'}, groups: [{groupName: 'Weekly plan', groupFields: [
      PropertyPaneTextField('siteUrl', {label: 'SharePoint site URL', value: this.properties.siteUrl || DEFAULT_SITE}),
      PropertyPaneDropdown('fiscalStartMonth', {label: 'Fiscal year starts in month', options: Array.from({length:12}, (_, index) => ({key:index + 1, text:String(index + 1)})), selectedKey:this.properties.fiscalStartMonth || 4})
    ]}]}]};
  }
}
