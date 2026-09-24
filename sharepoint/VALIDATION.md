# Validation

- Clean production build: Node 22.14.0, SPFx 1.22.2, Heft 1.1.2, TypeScript 5.8.3, Webpack 5.95.0.
- Compiler, lint and packaging: passed, no warnings/errors in final build.
- Final focused tests: 11 passed.
- Covers snapshot round trips, failed uploads, first-save retry, ETag conflicts, wrong-owner rejection, size validation, fiscal boundaries, CSP with inline scripts blocked, JSON backup/import, Excel download, PDF print flow, read-only viewing, member switching, draft protection, missing-year recovery and setup.
- Original full regression suite at previous checkpoint: 20 passed.
- Browser: headless Microsoft Edge. SharePoint identity/API transport is simulated.
- Host test uses Node's experimental stripTypeScriptTypes helper; the warning applies to the test runner, not the deployed app.
- Package verified: 304043 bytes, 16 archive entries, one current JavaScript bundle and AppManifest.xml.
- SHA-256: 8deb388a5a3c11fc9a4ae06c9c6a6656c8bde7fa2c804a20176263a52040be45

Not verified: company authentication, actual Lists REST responses/permissions, tenant deployment and tenant-specific policies. No production or company SharePoint data was modified.

CSP implementation follows Microsoft's guidance to avoid inline scripts:
https://learn.microsoft.com/en-us/sharepoint/dev/spfx/content-securty-policy-trusted-script-sources
