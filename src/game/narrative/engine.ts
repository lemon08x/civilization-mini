import type {StoryInput,StoryRecord,StoryState} from './contracts.js';
import {matches,interpolate} from './conditions.js';
export function advanceStory(input:StoryInput):{state:StoryState;notices:StoryRecord[]} {
 const state:StoryState=structuredClone(input.state),notices:StoryRecord[]=[];
 if(input.sequence<=state.sequence)return {state,notices};
 if(input.sequence!==state.sequence+1)throw new Error('剧情行动序号不连续');
 const facts=new Map(input.facts.map(f=>[f.id,f]));
 for(const [eventIndex,event] of input.events.entries())for(const definition of input.catalog){
  const instanceId=definition.id+'@'+event.subjectId;
  for(const node of definition.nodes){
   if(node.topic!==event.topic||!matches(node.conditions,event,facts.get(event.subjectId)))continue;
   let instance=state.instances[instanceId];
   if(node.after?.some(id=>!instance?.completed.includes(id)))continue;
   const key=node.id+(node.repeat==='person'?'@'+event.actorId:node.repeat==='event'?'@'+input.sequence+':'+eventIndex:'');
   if(instance?.completed.includes(key))continue;
   instance??=state.instances[instanceId]={id:instanceId,definitionId:definition.id,revision:definition.revision,subjectId:event.subjectId,completed:[],choices:{},participants:{}};
   // Event-repeat nodes need no permanent dedupe keys: sequence provides batch idempotency.
   if(!instance.completed.includes(node.id))instance.completed.push(node.id);
   if(node.repeat==='person'&&!instance.completed.includes(key))instance.completed.push(key);
   if(node.choice)instance.choices[node.id]=node.choice;
   instance.participants[node.id]=event.actorId;
   const values={...facts.get(event.subjectId)?.values,...event.values};
   const record={id:input.sequence+':'+eventIndex+':'+definition.id+':'+node.id,instanceId,nodeId:node.id,subjectId:event.subjectId,actorId:event.actorId,day:event.day,era:event.era,surface:node.surface,title:interpolate(node.title,values),text:interpolate(node.text,values)};
   state.records.push(record);notices.push(record);
  }
 }
 state.sequence=input.sequence;
 return {state,notices};
}
