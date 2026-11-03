import {createReadStream,createWriteStream} from 'node:fs';
import {readdir,rename} from 'node:fs/promises';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {resolve} from 'node:path';
const dir=resolve(process.argv[2]||'data','models');
for(const name of await readdir(dir)){
 if(!name.endsWith('.glb'))continue;
 const path=resolve(dir,name);await pipeline(createReadStream(path),createGzip({level:6}),createWriteStream(path+'.gz.tmp'));await rename(path+'.gz.tmp',path+'.gz');console.log(name);
}
