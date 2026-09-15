# Cloud workspaces

The main URL opens a blank template backed by tab memory. It never restores personal localStorage or reads the legacy owner workspace. Save new workspace / Share creates an independent cloud record and opens its capability link. Each link defaults to Viewing and allows switching to Editing. Keep the link to return to the workspace.

## Storage and permissions

- POST /api/workspaces creates an independent workspace with a random 256-bit token. Only its hash is stored in independent_workspaces.
- GET/PUT /api/shared/:token reads/writes only the record identified by that token. PUT requires X-Workspace-Mode: editing and the latest revision; stale writes receive 409.
- Existing workspace_shares and page-only shares continue to reference the legacy workspace unchanged.
- OWNER_KEY is a private backend administration secret for legacy APIs only. It must not be the old publicly displayed password or appear in frontend code. Normal users access content through their workspace link.
- Existing legacy share revocation APIs affect legacy grants only, not independent workspaces.
- Every link recipient has the same capability. This app does not implement user accounts or identity-based permissions.
- Root drafts and unsaved shared edits live in tab memory. Shared sessions poll saved changes every 15 seconds, protecting drafts and open forms. Reloading a shared link starts in Viewing.
- Old localStorage data is untouched; Download previous browser backup and Import backup provide explicit recovery without automatically displaying old content.
- Request size is limited to 1.8 MB.

## Run locally

Use Node 24.14 or newer:

```powershell
$env:OWNER_KEY = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm.cmd start
```

Open http://127.0.0.1:3000. No owner password is needed for the normal UI.
Local SQLite defaults to runtime/plan.sqlite. DATA_DIR changes its directory; PORT defaults to 3000 and HOST to 127.0.0.1.
For Docker, set OWNER_KEY as a platform secret, mount a persistent /data volume, and use HTTPS. Run one instance with SQLite. Back up the database with SQLite's backup API or stop the service before copying all database files. Redact capability tokens from access logs.

## Hosted deployment

Production: https://finance-dt-weekly-plan.lucici1007.chatgpt.site/
Sites uses worker.mjs and managed D1 with DB configured in .openai/hosting.json. The same Worker runs on local Node using a SQLite adapter.
GitHub Pages is a static preview; cloud creation requires the production host. It can still export and recover local drafts.
.env.production and runtime/ are ignored by git. They are excluded from deployment artifacts.
Build with node build-site.mjs after pushing the exact source commit.
Package: tar -czf runtime/site-deploy.tar.gz .openai/hosting.json dist/server/index.js dist/server/wrangler.json
Save a Sites version using the pushed SHA and validated archive, then deploy.
GET /api/health is the health endpoint.

## Validation

npm.cmd test runs API and headless Edge browser checks. Tests use isolated databases and never change production data.
Coverage includes separate workspaces, blank entry despite old browser data, same-tab link changes, legacy grants, CAS conflicts, Viewing/Editing, mobile layout and exports.

## Export and mobile

Excel exports selected weekly tabs as worksheets, including task IDs. PDF prints each selected weekly tab on one A3 landscape page, scaled to fit. Dashboard has a separate PDF action.
Screen widths up to 760px use touch-friendly cards and bottom navigation. Tests emulate mobile widths and a desktop viewport; they are not physical-device tests.
