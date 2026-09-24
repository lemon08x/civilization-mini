import {LANDSCAPE_INPUTS} from '../systems/economy-catalog.js';
import type {GameState} from '../model/state.js';
import {LANDSCAPE_NAMES,landscapeDescription} from '../systems/landscapes.js';
import {changeGoods,missingGoods} from '../systems/inventory.js';
import {defineAction,type ActionDefinition} from './definition.js';
import type {LandscapeKind} from '../model/economy.js';
export function landscapeActions(s:GameState):ActionDefinition[]{
 const farm=s.economy?.farm;if(!farm)return [];const result:ActionDefinition[]=[],r=farm.rules;
 for(const p of Object.values(farm.plots)){
  if(!p.landscape)continue;
  for(const kind of ['tea','reading','garden','memorial'] as const){
   const current=p.landscape,same=current.kind===kind;if(same&&current.level===3)continue;
   const level=same?3:2,wood=LANDSCAPE_INPUTS[same?'upgrade':'build'].wood,clay=LANDSCAPE_INPUTS[same?'upgrade':'build'].clay;
   const preview={...p,landscape:{...current,kind,level:level as 2|3}};
   const materials={wood,clay};
   const a=defineAction(s,`economy:landscape:${p.id}-${kind}`,`${same?'完善':current.kind==='landmark'?'建设':'改建为'}${LANDSCAPE_NAMES[kind]}`,'景观',{time:same?r.landscapeUpgradeDays:r.landscapeBuildDays,energy:r.clearEnergy},[
    ...missingGoods(s,materials),...(same&&current.uses===0?['先在对应功能中实际使用一次景观，再完善']:[]),
   ],`${wood}木材、${clay}黏土营造石座与院落；${landscapeDescription(s,preview)}同类只取最高效果，不叠加。改建保留往事，替换现有功能。`,(d,events)=>{
    const plot=d.economy!.farm!.plots[p.id],old=plot.landscape!;
    plot.landscape={kind:kind as LandscapeKind,level:level as 2|3,builtBy:same?old.builtBy:d.household.activePersonId,uses:same?old.uses:0};
    events.push({type:'story-fact',topic:'landscape.changed',subjectId:p.id,actorId:d.household.activePersonId,values:{kind,level}});
    if(!same&&old.kind!=='landmark')events.push({type:'story-fact',topic:'landscape.converted',subjectId:p.id,actorId:d.household.activePersonId,values:{oldName:LANDSCAPE_NAMES[old.kind],landscapeName:LANDSCAPE_NAMES[kind]}});
   });
   a.deferred=true;a.prepare=(d,events)=>changeGoods(d,materials,-1,events,'景观建设备料');result.push(a);
  }
 }
 return result;
}
