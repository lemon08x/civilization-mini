/** Public, serializable narrative protocol. No game/runtime/UI imports are allowed here. */
export type Value = string | number | boolean;
export type Surface = 'place' | 'relaxation' | 'learning' | 'farming' | 'inheritance';
export interface Fact { id:string; values:Readonly<Record<string,Value>> }
export interface StoryEvent { topic:string; subjectId:string; actorId:string; day:number; era:number; values:Readonly<Record<string,Value>> }
export interface Condition { source:'event'|'fact'; key:string; op:'eq'|'gte'; value:Value }
export interface StoryChoice { id:string; label:string; capability:string }
export interface StoryNode {
 id:string; topic:string; after?:readonly string[]; conditions?:readonly Condition[];
 repeat:'once'|'person'|'event'; surface:Surface; title:string; text:string;
 choice?:string; choices?:readonly StoryChoice[];
}
export interface StoryDefinition { id:string; revision:number; scope:'place'|'person'; title:string; nodes:readonly StoryNode[] }
export interface StoryInstance { id:string; definitionId:string; revision:number; subjectId:string; completed:string[]; choices:Record<string,string>; participants:Record<string,string> }
export interface StoryRecord { id:string; instanceId:string; nodeId:string; subjectId:string; actorId:string; day:number; era:number; surface:Surface; title:string; text:string }
export interface StoryState { version:1; catalogVersion:string; sequence:number; instances:Record<string,StoryInstance>; records:StoryRecord[] }
export interface StoryInput { state:Readonly<StoryState>; sequence:number; facts:readonly Fact[]; events:readonly StoryEvent[]; catalog:readonly StoryDefinition[] }
