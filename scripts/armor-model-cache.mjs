import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
export function armorModelCache({dataRoot,fetchAsset=fetch}){
 const pending=new Map();
 return async(asset)=>{
  if(!/^[a-f0-9]{64}$/.test(asset.sha256)||!/^https:\/\/github\.com\/FantomPie\/bansai_git\/releases\/download\/[^/]+\/[^/]+\.glb$/.test(asset.url))throw Error('Invalid model asset');
  const path=dataRoot+'/armor-models/'+asset.sha256+'.glb';
  if(pending.has(path))return pending.get(path);
  const job=(async()=>{
   let bytes;try{bytes=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(bytes&&createHash('sha256').update(bytes).digest('hex')===asset.sha256)return path;
   const response=await fetchAsset(asset.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Model download failed');
   bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length!==asset.size||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Model checksum mismatch');
   await mkdir(dataRoot+'/armor-models',{recursive:true});const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,bytes);await rename(temp,path);return path;
  })();pending.set(path,job);try{return await job;}finally{pending.delete(path);}
 };
}
