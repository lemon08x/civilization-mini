import {LANDSCAPE_INPUTS} from './economy-catalog.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
import type {LandscapeKind,FarmPlot} from '../model/economy.js';
export const LANDSCAPE_NAMES:Record<LandscapeKind,string>={landmark:'旧界地标',tea:'古树茶亭',reading:'静读小院',garden:'田畔花园',memorial:'乡土纪念园'};
export function landscapeSource(s:GameState,kind:LandscapeKind,plotId?:string):FarmPlot|undefined {
 const plots=Object.values(s.economy?.farm?.plots??{}),target=plotId?s.economy?.farm?.plots[plotId]:undefined;
 return plots.filter(p=>p.landscape&&(kind==='landmark'||p.landscape.kind===kind)&&(!plotId||target&&Math.max(Math.abs(p.x-target.x),Math.abs(p.y-target.y))<=2))
 .sort((a,b)=>b.landscape!.level-a.landscape!.level||a.id.localeCompare(b.id))[0];
}
export function landscapeEffect(s:GameState,id:string):{source?:FarmPlot;pressurePercent:number;timePercent:number} {
 const [,op,target]=id.split(':'),r=s.economy?.farm?.rules;let source:FarmPlot|undefined;
 if(op==='branchlearn')source=landscapeSource(s,'reading');
 else if(['farm','farmplot','farmrare','farmfertilize','fertilize'].includes(op))source=landscapeSource(s,'garden',op==='farm'||op==='fertilize'?'p2q2':target.split('-')[0]);
 else if(['branchteach','sectteach','teach','consult'].includes(op)||op==='neighbor'&&target==='learn')source=landscapeSource(s,'memorial');
 const upgraded=source?.landscape?.level===3;
 return {source,pressurePercent:source&&r&&source.landscape!.kind!=='memorial'?(upgraded?r.landscapePressurePercentUpgraded:r.landscapePressurePercent):0,timePercent:source?.landscape?.kind==='memorial'&&r?(upgraded?r.landscapeTeachingPercentUpgraded:r.landscapeTeachingPercent):0};
}
export function landscapeCost(s:GameState,id:string,cost:{time:number;energy:number}){
 const effect=landscapeEffect(s,id);
 return {time:cost.time*(1-effect.timePercent/100),energy:Math.round(cost.energy*(1-effect.pressurePercent/100)*100)/100};
}
/** Settle actual use in the world before the narrative adapter reads its facts. */
export function recordLandscapeUse(before:GameState,next:GameState,events:GameEvent[],actionId:string):void {
 if(!events.some(e=>e.type==='action-paid')||(next.life?.calendar?.absoluteDay??0)<=(before.life?.calendar?.absoluteDay??0))return;
 const source=landscapeEffect(before,actionId).source,plot=source?next.economy?.farm?.plots[source.id]:undefined;
 if(!source?.landscape||!plot?.landscape||plot.landscape.kind!==source.landscape.kind)return;
 plot.landscape.uses++;
 events.push({type:'story-fact',topic:'landscape.used',subjectId:plot.id,actorId:before.household.activePersonId,values:{kind:source.landscape.kind}});
}
export function landscapeDescription(s:GameState,p:FarmPlot):string {
 const l=p.landscape,r=s.economy!.farm!.rules;if(!l)return '';const up=l.level===3;
 return l.kind==='landmark'?'已在放松与调养解锁凭栏散心，可选建四种景观。':l.kind==='tea'?`在放松与调养中品茶半日，基础减压${up?r.landscapeTeaReliefUpgraded:r.landscapeTeaRelief}，消耗${LANDSCAPE_INPUTS.tea.food}批干粮；不需回到地块操作。`:l.kind==='reading'?`理论学习增压减少${up?r.landscapePressurePercentUpgraded:r.landscapePressurePercent}%，学习页报价自动生效。`:l.kind==='garden'?`两格内播种、灌溉、施肥和收获增压减少${up?r.landscapePressurePercentUpgraded:r.landscapePressurePercent}%，农时报价自动生效。`:`教导与请教耗时减少${up?r.landscapeTeachingPercentUpgraded:r.landscapeTeachingPercent}%，按半天向上取整；教学与传承入口生效。`;
}
export function landscapeView(s:GameState){return Object.values(s.economy?.farm?.plots??{}).filter(p=>p.landscape).map(p=>({plotId:p.id,...p.landscape!,name:LANDSCAPE_NAMES[p.landscape!.kind],description:landscapeDescription(s,p)}));}
