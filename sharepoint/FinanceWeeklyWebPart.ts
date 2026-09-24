import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient, type ISPHttpClientOptions } from '@microsoft/sp-http';
import { type IPropertyPaneConfiguration, PropertyPaneTextField, PropertyPaneDropdown } from '@microsoft/sp-property-pane';
import appDocument from './generated/appDocument';
import { mountApp } from './generated/appRuntime';
import { SharePointStore, DEFAULT_SITE, fiscalYear } from './generated/store';
import { validState } from './generated/validation';

interface PlannerProperties { siteUrl: string; fiscalStartMonth: number; }
interface Member { OwnerKey: string; EmployeeName: string; }
interface User { LoginName: string; Title: string; }
/* eslint-disable @rushstack/no-new-null -- These contracts mirror existing nullable JSON and SharePoint API responses. */
interface WorkspaceState {
  data: Record<string, (string | number | null)[][]>;
  futureSheets: string[];
  dailyPlans: Record<string, Record<string, unknown>[]>;
  pageMeta: Record<string, { id: string; headers?: string[] }>;
}
interface SaveBody { state: WorkspaceState; revision: string | null; }
interface WorkspaceResult { state: WorkspaceState | null; revision: string | null; updated: string | null; }
/* eslint-enable @rushstack/no-new-null */
interface AppWindow extends Window {
  hasSharePointDraft?: () => boolean;
  prepareWorkspaceSwitch?: () => Promise<boolean>;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function errorStatus(error: unknown): number {
  return Number((error as { status?: number })?.status || 0);
}

export default class FinanceWeeklyWebPart extends BaseClientSideWebPart<PlannerProperties> {
  private frame: HTMLIFrameElement | undefined;
  private store: SharePointStore | undefined;
  private me: User = { LoginName: '', Title: '' };
  private owner: string = '';
  private year: number = 0;
  private members: Member[] = [];
  private loading: boolean = false;
  private switching: boolean = false;
  private disposed: boolean = false;
  private generation: number = 0;

  private childWindow(): AppWindow | undefined {
    return (this.frame?.contentWindow || undefined) as AppWindow | undefined;
  }
  private beforeLeave = (event: BeforeUnloadEvent): void => {
    if (this.childWindow()?.hasSharePointDraft?.()) { event.preventDefault(); event.returnValue = ''; }
  };
  protected async onInit(): Promise<void> {
    await super.onInit();
    window.addEventListener('beforeunload', this.beforeLeave);
  }
  public render(): void {
    if (!this.loading && !this.frame && !this.disposed) this.run(() => this.start());
  }
  private run(action: () => Promise<void>): void {
    action().catch((error: unknown) => {
      if (!this.disposed) this.showError(error);
    });
  }
  private clearFrame(): void {
    this.frame?.remove(); this.frame = undefined;
  }
  private async start(): Promise<void> {
    const generation = ++this.generation;
    this.loading = true;
    this.clearFrame();
    this.domElement.replaceChildren(document.createTextNode('Connecting to SharePoint...'));
    try {
      const params = new URL(location.href).searchParams;
      const month = Number(this.properties.fiscalStartMonth || 4);
      this.year = this.year || Number(params.get('financeYear') || fiscalYear(new Date(), month));
      const site = this.properties.siteUrl || DEFAULT_SITE;
      if (new URL(site).origin !== location.origin) throw new Error('Add this web part to a page on ' + new URL(site).origin + ', then configure the target site.');
      const store = new SharePointStore(site, this.year, (url: string, options: ISPHttpClientOptions) => this.context.spHttpClient.fetch(url, SPHttpClient.configurations.v1, options), validState);
      this.store = store;
      const me = await store.currentUser() as User;
      const members = await store.members() as Member[];
      if (generation !== this.generation || this.disposed) return;
      this.me = me;
      this.members = members;
      this.owner = this.owner || params.get('financeMember') || me.LoginName;
      if (!this.members.some(member => member.OwnerKey === me.LoginName)) this.members.unshift({OwnerKey: me.LoginName, EmployeeName: me.Title});
      if (!this.members.some(member => member.OwnerKey === this.owner)) throw new Error('This member has not saved a workspace for the selected fiscal year. Choose a fiscal year to return to your own workspace.');
      this.showWorkspace();
    } catch (error) {
      if (generation === this.generation && !this.disposed) this.showError(error);
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }
  private showError(error: unknown): void {
    this.clearFrame();
    const message = document.createElement('p'); message.textContent = errorMessage(error);
    this.domElement.replaceChildren(message);
    this.domElement.append(this.yearControls());
    if (this.store && [400, 404].indexOf(errorStatus(error)) !== -1) {
      const store = this.store;
      const setup = document.createElement('button'); setup.textContent = 'Set up FY ' + this.year + ' list';
      setup.addEventListener('click', () => this.run(async () => {
        setup.setAttribute('disabled', '');
        message.replaceChildren(document.createTextNode('Creating list and indexes...'));
        try { await store.provision(); await this.start(); }
        catch (failure) {
          message.replaceChildren(document.createTextNode(errorMessage(failure) + ' Ask a site owner to run setup if access is denied.'));
          setup.removeAttribute('disabled');
        }
      }));
      this.domElement.append(setup);
    }
  }
  private yearControls(): HTMLLabelElement {
    const label = document.createElement('label'); label.textContent = 'Fiscal year starting in ';
    const input = document.createElement('input');
    input.type = 'number'; input.required = true; input.min = '2000'; input.max = '2200'; input.step = '1'; input.style.width = '90px';
    input.value = String(this.year || fiscalYear(new Date(), Number(this.properties.fiscalStartMonth || 4)));
    const open = document.createElement('button'); open.textContent = 'Open year';
    open.addEventListener('click', () => this.run(async () => {
      if (!input.reportValidity() || this.switching) return;
      this.switching = true;
      try {
        if (!await this.prepareSwitch()) return;
        this.year = Number(input.value); this.owner = this.me.LoginName;
        await this.start();
      } finally { this.switching = false; }
    }));
    label.append(input, open); return label;
  }
  private showWorkspace(): void {
    this.domElement.replaceChildren();
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0';
    const label = document.createElement('label'); label.textContent = 'Workspace ';
    const select = document.createElement('select');
    for (const member of this.members) {
      const option = document.createElement('option'); option.value = member.OwnerKey;
      option.textContent = member.EmployeeName + (member.OwnerKey === this.me.LoginName ? ' (me)' : '');
      select.append(option);
    }
    select.value = this.owner;
    select.addEventListener('change', () => this.run(async () => {
      if (this.switching) { this.selectOwner(select); return; }
      const next = select.value;
      this.switching = true; select.setAttribute('disabled', '');
      try {
        if (!await this.prepareSwitch()) { this.selectOwner(select); return; }
        this.owner = next; this.mountFrame();
      } finally { this.switching = false; select.removeAttribute('disabled'); }
    }));
    label.append(select);
    const hint = document.createElement('span'); hint.textContent = 'Each year is a separate workspace. Other members open read-only.';
    toolbar.append(label, this.yearControls(), hint); this.domElement.append(toolbar);
    this.mountFrame();
  }
  private selectOwner(select: HTMLSelectElement): void { select.value = this.owner; }
  private async prepareSwitch(): Promise<boolean> {
    const child = this.childWindow();
    return child?.prepareWorkspaceSwitch ? child.prepareWorkspaceSwitch() : true;
  }
  private mountFrame(): void {
    this.clearFrame();
    const owner = this.owner, year = this.year, store = this.store;
    const member = this.members.find(item => item.OwnerKey === owner);
    if (!store || !member) throw new Error('Workspace selection is unavailable. Reload the page.');
    const blank: WorkspaceState = {data: {W1: [], 'Next 3 Weeks': []}, futureSheets: ['Next 3 Weeks'], dailyPlans: {}, pageMeta: {W1: {id: crypto.randomUUID()}, 'Next 3 Weeks': {id: crypto.randomUUID()}}};
    const frame = document.createElement('iframe');
    frame.title = 'Weekly planning workspace';
    frame.style.cssText = 'width:100%;height:85vh;min-height:700px;border:0';
    const bridge = {
      canEdit: owner === this.me.LoginName,
      displayName: member.EmployeeName,
      year,
      validate: validState,
      request: async (method: string, body?: SaveBody): Promise<WorkspaceResult> => {
        if (method === 'PUT' && !body) throw new Error('Missing workspace data.');
        const result = (method === 'PUT' && body ? await store.save(owner, member.EmployeeName, body.state, body.revision) : await store.load(owner)) as WorkspaceResult;
        return {...result, state: result.state || blank, updated: result.updated || new Date().toISOString()};
      },
      share: async (): Promise<void> => {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set('financeMember', owner); url.searchParams.set('financeYear', String(year));
        try { await navigator.clipboard.writeText(url.href); alert('Workspace link copied. Recipients must have access to this SharePoint site.'); }
        catch { prompt('Copy workspace link', url.href); }
      }
    };
    frame.addEventListener('load', () => {
      if (this.frame === frame && frame.contentWindow) this.run(() => mountApp(frame.contentWindow, bridge));
    });
    this.frame = frame; frame.srcdoc = appDocument; this.domElement.append(frame);
  }
  protected onPropertyPaneFieldChanged(name: string, oldValue: unknown, newValue: unknown): void {
    if (oldValue === newValue) return;
    this.run(async () => {
      if (!await this.prepareSwitch()) {
        if (name === 'siteUrl') this.properties.siteUrl = String(oldValue || DEFAULT_SITE);
        if (name === 'fiscalStartMonth') this.properties.fiscalStartMonth = Number(oldValue || 4);
        return;
      }
      if (name === 'fiscalStartMonth') this.year = 0;
      await this.start();
    });
  }
  protected onDispose(): void {
    this.disposed = true; this.generation++;
    window.removeEventListener('beforeunload', this.beforeLeave);
    this.clearFrame();
  }
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {pages: [{header: {description: 'SharePoint storage'}, groups: [{groupName: 'Weekly plan', groupFields: [
      PropertyPaneTextField('siteUrl', {label: 'SharePoint site URL', value: this.properties.siteUrl || DEFAULT_SITE}),
      PropertyPaneDropdown('fiscalStartMonth', {label: 'Fiscal year starts in month', options: Array.from({length:12}, (_, index) => ({key:index + 1, text:String(index + 1)})), selectedKey:this.properties.fiscalStartMonth || 4})
    ]}]}]};
  }
}
