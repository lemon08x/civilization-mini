/** The only game-aware bridge. Never pass GameState, RNG, or future weather into narrative. */
import {advanceStory,STORY_CATALOG,CATALOG_VERSION,validateCatalog,validateStoryState,DISCOVERY_TEXT,type StoryEvent,type Fact,type StoryState} from '../narrative/index.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
import {LANDSCAPE_NAMES} from './landscapes.js';
export const discoveryText=DISCOVERY_TEXT;
const BINDINGS:Record<string,(subjectId:string)=>string>={
 'landmark.preserve':id=>'economy:farmstory:'+id+'-preserve',
 'landmark.reclaim':id=>'economy:farmstory:'+id+'-leave',
};
const TOPICS=['place.discovered','landmark.preserved','landmark.reclaimed','landscape.changed','landscape.used','landscape.converted','place.inherited','person.arrived','person.learned','person.succeeded'];
validateCatalog(STORY_CATALOG,Object.keys(BINDINGS),TOPICS);
export function emptyStory():StoryState{return {version:1,catalogVersion:CATALOG_VERSION,sequence:0,instances:{},records:[]};}
export function validNarrative(value:unknown):boolean{return validateStoryState(value,STORY_CATALOG,CATALOG_VERSION);}
function facts(s:GameState):Fact[]{
 return Object.values(s.economy?.farm?.plots??{}).map(p=>({id:p.id,values:{landscapeName:p.landscape?LANDSCAPE_NAMES[p.landscape.kind]:'旧界',level:p.landscape?.level??0,builderName:s.persons[p.landscape?.builtBy??'']?.name??'前人'}}));
}
export function settleNarrative(before:GameState,s:GameState,events:GameEvent[],actionId?:string):void {
 const actorId=before.household.activePersonId,day=s.life?.calendar?.absoluteDay??s.clock.absoluteTurn,era=s.era?.index??0;
 const signals:StoryEvent[]=events.flatMap(e=>e.type==='story-fact'?[{topic:e.topic,subjectId:e.subjectId,actorId:e.actorId,day,era,values:{...e.values,actorName:s.persons[e.actorId]?.name??'前人'}}]:[]);
 const add=(topic:string,subjectId:string,id=actorId,values:Record<string,string|number|boolean>={})=>signals.push({topic,subjectId,actorId:id,day,era,values:{actorName:s.persons[id]?.name??'前人',...values}});
 if(!actionId)add('person.arrived',s.household.activePersonId);
 if(events.some(e=>e.type==='branch'&&e.operation==='learned'))add('person.learned',actorId);
 if(actorId!==s.household.activePersonId){
  add('person.succeeded',s.household.activePersonId,s.household.activePersonId,{predecessorName:before.persons[actorId]?.name??'前人'});
  for(const p of Object.values(s.economy?.farm?.plots??{}))if(p.landscape)add('place.inherited',p.id,s.household.activePersonId);
 }
 const current=s.story??emptyStory();
 s.story=advanceStory({state:current,sequence:current.sequence+1,facts:facts(s),events:signals,catalog:STORY_CATALOG}).state;
}
export function narrativeView(s:GameState){
 const state=s.story??emptyStory();
 const choices=Object.values(state.instances).flatMap(i=>{
  const d=STORY_CATALOG.find(d=>d.id===i.definitionId);if(!d)return [];
  const p=s.economy?.farm?.plots[i.subjectId];if(!p?.discovery||p.discovery.resolved)return [];
  return d.nodes.flatMap(n=>i.completed.includes(n.id)?(n.choices??[]).map(c=>({instanceId:i.id,subjectId:i.subjectId,label:c.label,actionId:BINDINGS[c.capability](i.subjectId)})):[]);
 });
 return {catalogVersion:state.catalogVersion,records:structuredClone(state.records),choices};
}
