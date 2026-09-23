# Paused checkpoint

Paused at the user's request on 2026-09-23. Do not resume builds or deployment until asked.

## Agreed outcome
Keep the existing weekly-planning UI and use SharePoint for storage:
https://lenovonam.sharepoint.com/sites/WeeklyCatch-Up
Default to the signed-in member's workspace; allow member selection for read-only viewing, including by the manager. No strict member-to-member data isolation was requested.

## Implemented locally
- Separate SPFx 1.22.2 web-part project in finance-weekly-sharepoint/.
- FinanceWeeklyWebPart.ts is the host source; prepare.mjs copies it into the generated project and bundles the current HTML/CSS/JS.
- storage.mjs uses SPHttpClient transport, one list per fiscal year, indexed workspace directory and immutable JSON attachment snapshots with ETag-protected pointer updates.
- Each person has one workspace per fiscal year. Every save also creates a snapshot item; snapshots consume site storage and need a retention policy.
- April is a configurable default fiscal start month, not a confirmed company setting.
- JSON import/export, read-only other-member view, member/year navigation, existing calendar and exports.
- Optional bridge hooks in shared-workspace.js; the original hosted app is not redeployed.
- Chinese deployment guide and a read-only existing-workspace export utility.

## Verification already completed
- Full regression suite including initial SharePoint tests: 20 passed.
- Added first-save upload retry test afterward; all 9 storage tests passed.
- Headless Edge tested the packaged UI with a simulated bridge.
- No live SharePoint login, real Lists API, tenant CSP, or App Catalog deployment has been verified.

## Not finished
- SPFx dependency installation and production compilation/package generation are incomplete.
- No .sppkg has been produced. Do not describe this as deployed or fully connected.
- No SPFx package-lock.json exists yet; finish npm install before using npm ci.
- npm installation in the OneDrive workspace was stopped because it was very slow.
- A second install in a temporary directory was also stopped at the user's pause request.
- A project-local Node 22 runtime exists under runtime/node22 (ignored by Git). System Node is 24.
- The temporary build directory path is recorded in runtime/sharepoint-build-path.txt (local only).
- Continue by checking partial install state, finishing dependencies with Node 22, running prepare.mjs, compiling, fixing any compiler/linter findings, and packaging.
- sharepoint/build.ps1 expects the Heft executable at node_modules/@rushstack/heft/lib/start.js; verify the installed package's actual bin path.
- Review/test host property-pane updates and the real tenant deployment path.
- Current app's multiple independent workspace-link library is replaced with person/year navigation in this first adapter; migration of several views for one person is not implemented.
- Agree with the site owner how to retain snapshots and manage historical-year permissions.
- Package installation needs an App Catalog administrator or equivalent company deployment route. Access to Shared Documents alone is insufficient.

## Safety/state
No company SharePoint resources or existing production data were modified.
Dependency directories, generated embedded assets, temporary files and runtime credentials/data must remain out of Git.
