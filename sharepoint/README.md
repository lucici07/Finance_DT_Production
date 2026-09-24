# SharePoint deployment

This is a separate SPFx build of the existing app. The current ChatGPT-hosted site and its database are unchanged.

## Storage model

One list per fiscal year: FinanceWeekly_FY2026 means the year **starting** in 2026.
April is the configurable default start month; confirm it in the web part settings.
The year selector determines where the entire workspace is saved. Dates inside records do not move records between lists automatically.

Each person has one Workspace item, keyed by their SharePoint LoginName. Each successful Save also creates a Snapshot item with a workspace.json attachment, then changes the workspace pointer using an exact ETag. A failed upload cannot replace the last successful save; a concurrent save is rejected. Snapshot history and failed-upload remnants are retained; they consume site storage. Do not delete snapshots referenced by Workspace.SnapshotId. Define retention with the site owner before long-term use.

This preserves custom columns, page order, weekly rows, calendar tasks and task links. It deliberately does not create one editable SharePoint row per weekly task. Use the website to edit tasks; lists store the complete workspace.

There are approximately 20 live workspace items, **plus snapshot items for every Save**. EntryType and Title indexes keep directory and owner lookups selective; snapshots are fetched by item ID. The 5,000 threshold is not a limit on total saves, and no scan of all snapshots is needed.

## Build status

A clean production package has been generated and checked. See VALIDATION.md for test evidence and CHECKPOINT.md for remaining company deployment steps.

The frame HTML contains no scripts; compiled SPFx code initializes the existing app, including ExcelJS, without inline script injection.

## Installation

1. Build using Node 22 (SPFx 1.22.2 toolchain).
2. In sharepoint/finance-weekly-sharepoint run npm ci, then from the repository root run node sharepoint/build.mjs. On this machine, node sharepoint/build.mjs --temporary reuses cached build dependencies. The build automatically bundles the existing app and removes stale bundles.
3. Give sharepoint/finance-weekly-sharepoint/sharepoint/solution/finance-weekly-sharepoint.sppkg to the SharePoint App Catalog administrator. Upload/deploy the package, install on WeeklyCatch-Up if required, and add FinanceWeekly to a modern page.
4. Configure site URL https://lenovonam.sharepoint.com/sites/WeeklyCatch-Up and confirm fiscal start month.
5. Open the page as a site owner and click Set up FY ... list. Setup creates the fields and indexes. It requires list-management permission; it is not a bypass for company deployment policy.
6. Give the group access to the page and read/add/edit access to the lists and attachments. The application opens other people's workspaces read-only, but this is **not a data-security boundary**: users with list edit rights can edit via SharePoint itself, as agreed.
7. Each member opens their own workspace, switches to Editing, enters data and clicks Save. The manager uses Workspace to select a member, or opens a copied Share link. Members appear after their first save.
8. In a new fiscal year, create the new list with the setup action. Old lists remain available through the year selector. If old years must be immutable, set their SharePoint permissions read-only.

## Migration and acceptance

Download a JSON workspace backup from the existing app (not just Excel). In the SharePoint app choose the correct fiscal year, switch to Editing, import the backup, inspect it, and Save. No production data is migrated automatically.

Test with actual tenant accounts: list setup; own workspace create/save/reload; another member view; manager link; custom columns; calendar-to-weekly linkage; Excel/PDF export; two-window conflict; next-year setup; previous-year retrieval; loss of connectivity; large real workspace. SPFx assets are bundled in the app package; the frame contains packaged code and is not an embed of the chatgpt.site URL.

The SharePoint app does not use the legacy browser-local workspace-link library. The member/year controls replace that navigation. Multiple independent views for one person in one year are not migrated as separate workspaces; choose the intended backup before import.

Live tenant access and App Catalog deployment cannot be tested without company authentication. A local build or mocked test does not prove tenant deployment or permissions.
