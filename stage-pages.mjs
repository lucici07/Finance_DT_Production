import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public-preview/vendor', { recursive: true });
for (const file of ['index.html','app.js','sync.js','export.js','export.css','mobile.js','mobile.css','bootstrap.js','shared-workspace.js','share.html','share.js','styles.css','details.css','calendar.css','dashboard.css','production.css','sync.css','.nojekyll','_headers','vendor/exceljs.min.js']) copyFileSync(file,'public-preview/'+file);
