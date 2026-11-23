import {build} from 'esbuild';
import {mkdir,copyFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
await build({entryPoints:['src/viewer.js'],outfile:'web/viewer.js',bundle:true,minify:true,target:['chrome66'],format:'iife',legalComments:'eof'});
async function copyDir(from,to){await mkdir(to,{recursive:true});for(const e of await readdir(from,{withFileTypes:true})){const a=join(from,e.name),b=join(to,e.name);if(e.isDirectory())await copyDir(a,b);else if(!e.name.startsWith('890_'))await copyFile(a,b);}}
await copyDir('web','android/app/src/main/assets');
console.log('Web and offline APK assets prepared.');
