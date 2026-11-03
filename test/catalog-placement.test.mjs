import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withModelPlacements} from '../scripts/catalog-placement.mjs';
test('new release exhibit appears in its hall and screen without mutating the brief',()=>{
 const index={objects:[],tzGroups:[]};
 const model={name:'Тест',folder:'VESTIBUL/TEST/TEST',placement:{hall:'Вестибюль',code:'VESTIBUL_TEST',destination:'Тест'}};
 const result=withModelPlacements(index,[model,model]);
 assert.equal(result.objects.length,1);assert.equal(result.tzGroups.length,1);
 assert.equal(result.tzGroups[0].hall,'VESTIBUL');assert.deepEqual(result.tzGroups[0].objectPaths,[model.folder]);
 assert.deepEqual(result.objects[0].tzGroupIds,['VESTIBUL_TEST']);assert.deepEqual(index,{objects:[],tzGroups:[]});
});
test('existing object keeps its name and all original hall placements',()=>{
 const index={objects:[{path:'H1/A',name:'Original',tzGroupIds:['OLD']}],tzGroups:[{id:'OLD',objectPaths:['H1/A']}]};
 const result=withModelPlacements(index,[{folder:'H1/A',name:'Variant',placement:{hall:'Зал 1',code:'NEW'}}]);
 assert.equal(result.objects[0].name,'Original');assert.deepEqual(result.objects[0].tzGroupIds,['OLD','NEW']);
 assert.deepEqual(result.tzGroups[0],index.tzGroups[0]);
});
