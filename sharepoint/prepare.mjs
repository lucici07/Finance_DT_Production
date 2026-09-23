import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const scripts = ['vendor/exceljs.min.js', 'app.js', 'mobile.js', 'export.js', 'shared-workspace.js'].map(read);
let html = read('index.html').replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
html = html.replace(/<link\b[^>]*href="([^"?]+)(?:\?[^" ]*)?"[^>]*>/gi, (_, path) => '<style>' + read(path) + '</style>');
const inline = value => value.replace(/<\/script/gi, '<\\/script');
html = html.replace('</body>', '<script>window.financeAppScripts=' + inline(JSON.stringify(scripts)) + ';</script><script>' + inline(read('sharepoint/frame-boot.js')) + '</script></body>');
const target = new URL('finance-weekly-sharepoint/src/generated/', import.meta.url); mkdirSync(target, {recursive:true});
writeFileSync(new URL('appDocument.ts', target), 'export default '+JSON.stringify(html)+';\n');
writeFileSync(new URL('store.ts', target), '// @ts-nocheck\n'+read('sharepoint/storage.mjs'));
writeFileSync(new URL('validation.ts', target), '// @ts-nocheck\n'+read('state-validation.mjs'));
console.log('Prepared bundled SharePoint app assets.');

writeFileSync(new URL('finance-weekly-sharepoint/src/webparts/financeWeekly/FinanceWeeklyWebPart.ts', import.meta.url), read('sharepoint/FinanceWeeklyWebPart.ts').replaceAll("'./generated/", "'../../generated/"));