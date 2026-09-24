# SharePoint build checkpoint — resumed and packaged

Updated after the resumed work on 2026-09-23 (America/New_York).

## Ready locally

- Clean SPFx 1.22.2 production build and package completed with no compiler/lint warnings or errors.
- Installer: finance-weekly-sharepoint/sharepoint/solution/finance-weekly-sharepoint.sppkg
- SHA-256: 8deb388a5a3c11fc9a4ae06c9c6a6656c8bde7fa2c804a20176263a52040be45
- Archive verified: 16 entries, one current JavaScript bundle, app manifest present.
- Dependency lock is committed with source. Build artifacts and dependency directories remain ignored.
- Final focused suite: 11 tests passed (storage, enforced CSP, Excel/PDF actions, member/year switching, draft protection, list setup recovery).
- Earlier full original-app regression suite: 20 passed at the previous checkpoint.

## Implementation

Target: https://lenovonam.sharepoint.com/sites/WeeklyCatch-Up
Existing UI runs in an isolated same-origin frame, initialized from compiled SPFx code. No inline script injection or script-policy exception is needed. This replaced the provisional inline-script approach.

Each fiscal-year list stores member workspace headers and immutable JSON snapshot attachments. Save commits the pointer with an exact ETag. All members default to their own workspace; other members open read-only in the app. List permissions are not per-user isolation, as agreed.

The fiscal year start month defaults to April and remains configurable/unconfirmed. One workspace per person per year; legacy multiple independent workspace-link views are not automatically merged.

## Rebuild

- Standard: install Node 22.14+ within Node 22; npm ci in finance-weekly-sharepoint; then node sharepoint/build.mjs from repository root.
- This machine: node sharepoint/build.mjs --temporary uses the local Node 22 runtime and cached build directory.
- Windows PowerShell script execution was disabled. The Node build script works without changing that policy.
- runtime/sharepoint-build-path.txt records the local cache path.
- The slow full npm extraction was stopped after the required compiler/package tools successfully ran. npm install --package-lock-only --ignore-scripts completed. The cached directory suffices for the verified clean build; use npm ci for a fresh complete dependency installation.
- Root app tests use system Node 24; SPFx build uses Node 22.

## Remaining external validation

The package has NOT been installed in the company tenant. No company SharePoint resources or production data were changed.

A SharePoint App Catalog administrator/site deployment route must install the package. Then add FinanceWeekly to a modern page, confirm the fiscal month, and initialize the year list with a site-owner account. Test real account save/reload, another member/manager view, permissions and exports.

Use 部署说明.md for handoff. Agree on snapshot retention and historical-year permissions with the site owner. Import only the desired existing workspace backup after choosing the correct year.

Do not describe a successful local build or mocked browser tests as a successful company SharePoint connection.
