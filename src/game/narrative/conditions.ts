import type {Condition,Fact,StoryEvent} from './contracts.js';
export function matches(conditions:readonly Condition[]=[],event:StoryEvent,fact?:Fact):boolean {
 return conditions.every(c=>{const value=(c.source==='event'?event.values:fact?.values)?.[c.key];
 return c.op==='eq'?value===c.value:typeof value==='number'&&typeof c.value==='number'&&value>=c.value;});
}
export function interpolate(text:string,values:Readonly<Record<string,string|number|boolean>>):string {
 return text.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,(_,key:string)=>String(values[key]??'未记名'));
}
