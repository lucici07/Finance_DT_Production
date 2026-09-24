import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
let html = read('index.html').replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
html = html.replace(/<link\b[^>]*href="([^"?]+)(?:\?[^" ]*)?"[^>]*>/gi, (_, path) => '<style>' + read(path) + '</style>');
const target = new URL('finance-weekly-sharepoint/src/generated/', import.meta.url); mkdirSync(target, {recursive:true});
writeFileSync(new URL('appDocument.ts', target), 'export default '+JSON.stringify(html)+';\n');
writeFileSync(new URL('store.ts', target), '// @ts-nocheck\n'+read('sharepoint/storage.mjs'));
writeFileSync(new URL('validation.ts', target), '// @ts-nocheck\n'+read('state-validation.mjs'));
copyFileSync(new URL('vendor/exceljs.min.js', root), new URL('exceljs.min.js', target));
const scripts = ['app.js', 'mobile.js', 'export.js', 'shared-workspace.js'].map(path => read(path).replace(/(?<![\w.])innerWidth\b/g, 'window.innerWidth').replace(/(?<![\w.])innerHeight\b/g, 'window.innerHeight'));
let boot = read('sharepoint/frame-boot.js');
const bindings = [
  'const document = window.document, globalThis = window, location = window.location, navigator = window.navigator;',
  'const {MutationObserver, ResizeObserver, Event, CustomEvent, FormData, FileReader, Blob, URL, crypto, localStorage, sessionStorage, AbortSignal} = window;',
  ...['addEventListener','removeEventListener','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','matchMedia','getComputedStyle','alert','confirm','prompt','fetch'].map(name => 'const '+name+' = window.'+name+'.bind(window);')
].join('\n');
boot = boot.replace('/*__FRAME_BINDINGS__*/', () => bindings).replace('/*__FINANCE_APP_CODE__*/', () => scripts.join('\n;\n'));
writeFileSync(new URL('appRuntime.ts', target), '// @ts-nocheck\nconst ExcelJS = require("./exceljs.min.js");\n' + boot);
writeFileSync(new URL('finance-weekly-sharepoint/src/webparts/financeWeekly/FinanceWeeklyWebPart.ts', import.meta.url), read('sharepoint/FinanceWeeklyWebPart.ts').replaceAll("'./generated/", "'../../generated/"));
console.log('Prepared script-free frame HTML and compiled SharePoint runtime.');
