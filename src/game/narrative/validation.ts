import type {StoryDefinition,StoryState} from './contracts.js';
export function validateCatalog(catalog:readonly StoryDefinition[],capabilities:readonly string[],topics?:readonly string[]):void {
 const definitions=new Set<string>();
 for(const d of catalog){
  if(definitions.has(d.id)||!d.id||!Number.isInteger(d.revision)||d.revision<1)throw new Error('剧情目录标识无效：'+d.id);definitions.add(d.id);
  const ids=new Set(d.nodes.map(n=>n.id));if(ids.size!==d.nodes.length)throw new Error('重复剧情节点：'+d.id);
  for(const n of d.nodes){
   if(topics&&!topics.includes(n.topic))throw new Error('未接入剧情事件：'+n.topic);
   if(!n.topic||!n.title||!n.text||n.after?.some(id=>!ids.has(id)))throw new Error('剧情节点缺少内容或前置：'+d.id+'/'+n.id);
   if(n.choices?.some(c=>!capabilities.includes(c.capability)))throw new Error('未绑定剧情能力：'+d.id+'/'+n.id);
   if(new Set(n.choices?.map(c=>c.id)).size!==(n.choices?.length??0))throw new Error('重复剧情选择：'+n.id);
   if(n.conditions?.some(c=>!['event','fact'].includes(c.source)||!['eq','gte'].includes(c.op)||c.op==='gte'&&typeof c.value!=='number'))throw new Error('无效剧情条件：'+n.id);
  }
  const visit=(id:string,path:Set<string>)=>{if(path.has(id))throw new Error('剧情前置循环：'+d.id+'/'+id);const next=new Set(path).add(id);for(const parent of d.nodes.find(n=>n.id===id)!.after??[])visit(parent,next);};
  for(const n of d.nodes)visit(n.id,new Set());
 }
}
export function validateStoryState(value:unknown,catalog:readonly StoryDefinition[],version:string):value is StoryState {
 try {
 if(!value||typeof value!=='object')return false;const s=value as StoryState;
 if(s.version!==1||s.catalogVersion!==version||!Number.isSafeInteger(s.sequence)||s.sequence<0||!s.instances||typeof s.instances!=='object'||Array.isArray(s.instances)||!Array.isArray(s.records))return false;
 for(const [id,i] of Object.entries(s.instances)){
  const d=catalog.find(d=>d.id===i?.definitionId);
  if(!d||i.id!==id||i.revision!==d.revision||typeof i.subjectId!=='string'||id!==d.id+'@'+i.subjectId||!Array.isArray(i.completed)||new Set(i.completed).size!==i.completed.length||i.completed.some(k=>typeof k!=='string'||!d.nodes.some(n=>k===n.id||n.repeat==='person'&&k.startsWith(n.id+'@')))||!i.choices||typeof i.choices!=='object'||Array.isArray(i.choices)||!i.participants||typeof i.participants!=='object'||Array.isArray(i.participants))return false;
  if(Object.entries(i.choices).some(([node,choice])=>d.nodes.find(n=>n.id===node)?.choice!==choice))return false;
  if(Object.entries(i.participants).some(([node,actor])=>!d.nodes.some(n=>n.id===node)||typeof actor!=='string'))return false;
 }
 const ids=new Set<string>();
 for(const r of s.records){const i=s.instances[r?.instanceId],d=catalog.find(d=>d.id===i?.definitionId);if(!i||!d?.nodes.some(n=>n.id===r.nodeId)||r.subjectId!==i.subjectId||!['id','actorId','title','text'].every(k=>typeof r[k as keyof typeof r]==='string')||!Number.isFinite(r.day)||r.day<0||!Number.isInteger(r.era)||r.era<0||!['place','relaxation','learning','farming','inheritance'].includes(r.surface)||ids.has(r.id))return false;ids.add(r.id);}
 return true;
 }catch{return false;}
}
