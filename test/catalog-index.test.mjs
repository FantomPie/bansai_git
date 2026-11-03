import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('published catalog has unique named objects and valid section destinations',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../catalog/catalog-index.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(catalog).sort(),['updatedAt','objects','folders','tzGroups','tzSource'].sort());
 assert.ok(catalog.objects.every(o=>typeof o.path==='string'&&o.path.trim()&&typeof o.name==='string'&&o.name.trim()));
 assert.equal(new Set(catalog.objects.map(o=>o.path)).size,catalog.objects.length);
 for(const group of catalog.tzGroups){assert.ok(group.id);assert.ok(group.hall);assert.ok(Array.isArray(group.objectPaths));}
});
