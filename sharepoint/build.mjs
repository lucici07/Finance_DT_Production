import {existsSync, readFileSync, mkdirSync, cpSync, copyFileSync} from 'node:fs';
import {dirname, join, resolve, sep, delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)), root=dirname(here);
const solution=join(here,'finance-weekly-sharepoint');
const localNode=join(root,'runtime','node22','node_modules','node','bin',process.platform==='win32'?'node.exe':'node');
const node=existsSync(localNode)?localNode:process.execPath;
const version=spawnSync(node,['--version'],{encoding:'utf8',windowsHide:true}).stdout?.trim();
const match=/^v22\.(\d+)\./.exec(version||'');
if(!match||Number(match[1])<14)throw new Error('SPFx 1.22.2 requires Node 22.14 or newer within Node 22.');
const temporary=process.argv.includes('--temporary');
if(process.argv.slice(2).some(arg=>arg!=='--temporary'))throw new Error('Usage: node sharepoint/build.mjs [--temporary]');
let build=solution;
if(temporary){
  build=resolve(readFileSync(join(root,'runtime','sharepoint-build-path.txt'),'utf8').trim());
  const expectedRoot=resolve(tmpdir())+sep;
  if(!build.toLowerCase().startsWith(expectedRoot.toLowerCase())||!/^finance-weekly-spfx-[a-f0-9]+$/i.test(build.slice(expectedRoot.length)))throw new Error('Unexpected temporary build directory.');
}
function run(args,cwd){
  const result=spawnSync(node,args,{cwd,stdio:'inherit',windowsHide:true,env:{...process.env,PATH:dirname(node)+delimiter+(process.env.PATH||'')}});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Build step failed with exit code '+result.status);
}
run([join(here,'prepare.mjs')],root);
if(temporary){
  for(const name of ['config','src','tsconfig.json','.eslintrc.js','package.json'])cpSync(join(solution,name),join(build,name),{recursive:true,force:true});
}
const heft=join(build,'node_modules','@rushstack','heft','bin','heft');
if(!existsSync(heft))throw new Error('Install dependencies with npm ci in the build directory first.');
run([heft,'build','--clean','--production'],build);
run([heft,'package-solution','--production'],build);
const artifactRelative=join('sharepoint','solution','finance-weekly-sharepoint.sppkg');
const artifact=join(solution,artifactRelative);
if(temporary){
  mkdirSync(dirname(artifact),{recursive:true});
  copyFileSync(join(build,artifactRelative),artifact);
  copyFileSync(join(build,'package-lock.json'),join(solution,'package-lock.json'));
}
console.log('Package: '+artifact);
console.log('SHA256: '+createHash('sha256').update(readFileSync(artifact)).digest('hex'));
