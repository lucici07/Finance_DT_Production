// Run from the project root: node sharepoint/export-existing.mjs "<your full workspace share URL>" output.json
// Only reads the explicitly supplied existing workspace; never modifies it.
import {writeFile} from 'node:fs/promises';
import {validState} from '../state-validation.mjs';
const [link, output] = process.argv.slice(2);
if (!link || !output) throw new Error('Provide the full workspace share URL and an output JSON filename.');
const url = new URL(link);
if (url.origin !== 'https://finance-dt-weekly-plan.lucici1007.chatgpt.site') throw new Error('Use your Finance DT production workspace link.');
const token = new URLSearchParams(url.hash.slice(1)).get('share');
if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('Open your saved workspace and copy its full URL, including #share=...');
const response = await fetch(new URL('/api/shared/' + token, url), {signal:AbortSignal.timeout(30000)});
if (!response.ok) throw new Error('Unable to read that workspace ('+response.status+').');
const result = await response.json();
if (!validState(result.state)) throw new Error('The response is not a valid complete workspace.');
await writeFile(output, JSON.stringify(result.state,null,2), {flag:'wx'});
console.log('Saved complete workspace backup. Existing files are never overwritten.');
