import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('published catalog has unique named objects and the test release destination',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../catalog/catalog-index.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(catalog).sort(),['updatedAt','objects','folders','tzGroups','tzSource'].sort());
 assert.ok(catalog.objects.every(o=>typeof o.path==='string'&&o.path.trim()&&typeof o.name==='string'&&o.name.trim()));
 assert.equal(new Set(catalog.objects.map(o=>o.path)).size,catalog.objects.length);
 const path='VESTIBUL/TEST/TEST';
 assert.ok(catalog.objects.some(o=>o.path===path));assert.ok(catalog.folders.includes(path));
 const group=catalog.tzGroups.find(g=>g.id==='VESTIBUL_TEST');
 assert.equal(group.hall,'VESTIBUL');assert.ok(group.objectPaths.includes(path));
});
