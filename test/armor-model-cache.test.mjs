import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {armorModelCache} from '../scripts/armor-model-cache.mjs';
test('release model is verified, cached across restarts and concurrent downloads deduplicated',async()=>{
 const root=await mkdtemp(join(tmpdir(),'armor-model-cache-'));const bytes=Buffer.alloc(12);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(12,8);
 const asset={url:'https://github.com/FantomPie/bansai_git/releases/download/example/HELMET.glb',size:12,sha256:createHash('sha256').update(bytes).digest('hex')};let calls=0;
 try{const get=armorModelCache({dataRoot:root,fetchAsset:async()=>{calls++;return new Response(bytes);}});
  const [a,b]=await Promise.all([get(asset),get(asset)]);assert.equal(a,b);assert.equal(calls,1);assert.deepEqual(await readFile(a),bytes);
  const restarted=armorModelCache({dataRoot:root,fetchAsset:()=>{throw Error('Unexpected network');}});assert.equal(await restarted(asset),a);
  await assert.rejects(get({...asset,url:'https://another.example/model.glb'}),/Invalid model/);
  await assert.rejects(get({...asset,sha256:'0'.repeat(64)}),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
