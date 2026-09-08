# Cloud Save and Share

This version provides one owner-managed workspace with local editing, explicit cloud Save, and live read-only links for individual weekly pages. It has no Microsoft account login, multi-user editing, or Teams package yet.

## Current deployment

The existing GitHub Pages workflow remains a static preview. It cannot run the API. Its Save/Share controls explain that cloud deployment is required. The Sites deployment target is https://finance-dt-weekly-plan.lucici1007.chatgpt.site. Sites uses worker.mjs with managed D1 storage, built by node build-site.mjs. Version 1 was published successfully and passed live browser/API verification. Temporary verification data has been removed.

Deploy the Node app at the root of a dedicated HTTPS origin. It serves both the editor and API. Keep the same origin for the editor and API; no external CORS endpoint is configured.

## Run locally (Node 24.14 or newer)

PowerShell:

```powershell
$env:OWNER_KEY = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
npm.cmd start
```

Open http://127.0.0.1:3000. Enter the generated OWNER_KEY in Connect cloud. Keep this secret in a password manager; it grants full read/write access, including share revocation. Do not put it in client code, git, shared URLs, or public hosting settings. The key stays in the browser tab memory and must be re-entered after reloading.

Local data defaults to runtime/plan.sqlite. DATA_DIR selects another directory; PORT defaults to 3000 and HOST to 127.0.0.1.

## Production host

Use a Node 24 host or the included Dockerfile with:
- HTTPS termination and a dedicated hostname.
- OWNER_KEY supplied through the platform secret manager (at least 32 random characters).
- HOST=0.0.0.0 and a configured PORT.
- A persistent volume mounted at DATA_DIR (Docker default /data), writable by the node user.
- One application instance. This SQLite configuration is not for multiple replicas or ephemeral/serverless filesystems.
- Regular database backups. Stop the service before copying the database, or use the SQLite online backup API. Do not copy only the main file while WAL writes are active.
- Proxy access logs should redact /api/shared/* tokens.

Build with `docker build -t finance-dt .`. Supply OWNER_KEY and mount a persistent /data volume through the chosen hosting platform. A restart with the same volume retains workspaces and share links.

Health check: GET /api/health. No cloud account, DNS, credentials, billing, or production volume is configured in this repository.

## Move existing local data to the cloud app

Browser data belongs to its original website address. On the old/static page (after these front-end changes are published), open Connect cloud > Download full backup. Open the new cloud-hosted editor, connect with the owner key and load the cloud version first, then restore that JSON under Cloud workspace and click Save. This JSON contains all weekly pages, custom headers, metadata, and Calendar Todos. Excel export is not a full-workspace migration.

Save uploads the complete workspace and acknowledges the saved version and time only after the server responds. It does not automatically turn unsynced Calendar Todos into weekly rows. Finish the row/Todo edit form first. Edits made during an upload remain marked as not synced and need another Save.

On another device, connect using the owner key and accept Load cloud version. Replacing local state downloads a full backup first. If a device saves an old revision after another device saved, it receives a conflict instead of overwriting the new version. Back up local edits, load the latest cloud state, and reapply edits. There is no automatic merge.

Share saves first, then generates a link for the currently selected weekly page. All columns and rows on that page are included, regardless of active search/filter; other pages and standalone Calendar Todos are excluded. Information already copied into a weekly row is included. The viewer has search, refresh, and 30-second polling while visible. Renaming a page keeps links working through its stable ID; deleting it makes links unavailable. Links do not expire automatically; Cloud settings > Revoke all share links invalidates every existing link. Previously copied or downloaded content cannot be withdrawn.

The owner key and read-only share tokens are separate. Tokens have 256 bits of randomness and only their hashes are stored in the database. Viewer pages do not load the editing app or write into a recipient's local workspace.

## Validation

`npm ci` then `npm test` runs HTTP integration tests plus headless Microsoft Edge browser flows. Edge must be installed. Tests use generated temporary databases or in-memory databases and do not touch production state.

## Hosted deployment

The managed Sites runtime uses the DB binding from .openai/hosting.json. OWNER_KEY is stored as a secret in the platform. The local .env.production file is ignored by git and excluded from the build; copy only its value into Connect cloud when logging in. Never share this key. Share links contain separate read-only tokens.

The hosted workspace request limit is 1.8 MB because D1 limits each stored row to 2 MB. The Node/Docker option remains available independently.

Build output contains a self-contained Worker in dist/server/index.js and Sites metadata; it embeds only allowlisted front-end assets. Database contents, tests, local environment files, and source history are not included in the deployment archive.

Archive packaging after a successful source push and build:

`tar -czf runtime/site-deploy.tar.gz .openai/hosting.json dist/server/index.js dist/server/wrangler.json`
