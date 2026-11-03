// Release imports can introduce exhibits and screen sections absent from the original brief.
export function withModelPlacements(index, models) {
 const objects=(index.objects||[]).map(o=>({...o,tzGroupIds:[...(o.tzGroupIds||[])]}));
 const groups=(index.tzGroups||[]).map(g=>({...g,objectPaths:[...(g.objectPaths||[])]}));
 for(const model of models){
  if(!model.folder)continue;
  let object=objects.find(o=>o.path===model.folder);
  if(!object){object={path:model.folder,name:model.name,hasSource:false,tzGroupIds:[],placement:model.placement};objects.push(object);}
  const p=model.placement;if(!p?.code||!p.hall)continue;
  let group=groups.find(g=>g.id===p.code);
  if(!group){group={id:p.code,hall:model.folder.split('/')[0],hallTitle:p.hall,title:p.destination||p.code,objectPaths:[]};groups.push(group);}
  if(!group.objectPaths.includes(model.folder))group.objectPaths.push(model.folder);
  if(!object.tzGroupIds.includes(group.id))object.tzGroupIds.push(group.id);
 }
 return {...index,objects,tzGroups:groups};
}
