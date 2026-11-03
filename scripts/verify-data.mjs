import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
const root=resolve(process.argv[2]||'data');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
for(const file of manifest.files){
 const path=resolve(root,file.path);
 if(!path.startsWith(root+sep))throw Error('Manifest path escapes data directory');
 if((await stat(path)).size!==file.size)throw Error('Size mismatch: '+file.path);
 const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);
 if(h.digest('hex')!==file.sha256)throw Error('Hash mismatch: '+file.path);
}
console.log(`Verified ${manifest.fileCount} files, ${manifest.modelCount} models`);
