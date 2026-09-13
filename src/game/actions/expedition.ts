import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { defineAction,type ActionDefinition } from './definition.js';
import { expeditionCatalog,newAttempt,expeditionEvent,applyGenerationProof } from '../systems/expedition.js';
import { requirements,missingGoods,foodStock,changeGoods,amount } from '../systems/economy.js';
import { ALL_GOODS } from '../systems/economy-catalog.js';

export function expeditionActions(s:GameState,r:Ruleset):ActionDefinition[]{
  const x=s.economy?.expeditions;if(!x)return [];
  const out:ActionDefinition[]=[];
  const catalog=expeditionCatalog(s);
  for(const f of catalog){
    const a=x.attempts[f.id];
    out.push(defineAction(s,`economy:expeditionstart:${f.id}`,'挑战／接续：'+f.name,'副本',{ap:1},[
      ...requirements(s,f.requires),...(a?.completed?['已经完成，奖励不可重复领取']:[]),
      ...(x.selected&&x.attempts[x.selected]?.active?['先暂停当前副本']:[])
    ],'开启生产验证，不赠送能力。物资须另行装运并等到下季到场。不同副本由自己的生产能力决定是否能应对。',(d,ev)=>{const z=d.economy!.expeditions!;z.selected=f.id;z.attempts[f.id]??=newAttempt();z.attempts[f.id].active=true;applyGenerationProof(d,f);expeditionEvent(ev,f.id,'start',f.name+'开始，投入与奖励见副本清单');}));
  }
  if(!x.selected)return out;
  const f=catalog.find(f=>f.id===x.selected)!,a=x.attempts[f.id];
  out.push(defineAction(s,'economy:expeditionpause:current','暂停当前副本','副本',{ap:0},a.active?[]:['当前没有进行中的副本'],'保留现场与在途物料，暂停不退还已消耗投入。连续副本暂停会立即中断，连续进度归零。',(d,ev)=>{const a=d.economy!.expeditions!.attempts[f.id];a.active=false;if(f.clean)a.progress=0;expeditionEvent(ev,f.id,'pause',f.name+'暂停');}));
  const remaining=Math.max(0,f.seasons-a.progress);
  const kit=Object.fromEntries(Object.entries(f.kit).map(([id,n])=>[id,Math.max(0,Math.min(n,n*remaining-(a.stock[id]??0)-a.shipments.reduce((v,q)=>v+(q.goods[id]??0),0))) ]).filter(([,n])=>Number(n)>0)) as Record<string,number>;
  const partial=s.economy!.lineage?Object.fromEntries(Object.entries(kit).map(([id,n])=>[id,Math.min(n,amount(s,id))]).filter(([,n])=>Number(n)>0)) as Record<string,number>:kit;
  const food=Object.entries(partial).reduce((sum,[id,n])=>sum+ALL_GOODS[id].food*n,0);
  const shipBlockers=s.economy!.lineage
    ?[...(!Object.keys(partial).length?Object.keys(kit).length?['家庭没有可装运的副本物资']:['现场与在途已足够，无需重复供货']:[] )]
    :[...(!Object.keys(kit).length?['现场与在途已足够，无需重复供货']:[]),...missingGoods(s,kit)];
  out.push(defineAction(s,'economy:expeditionship:current',s.economy!.lineage?'装运已有副本物资':'装运一套副本物资','副本',{ap:1},[
    ...(!a.active||a.completed?['先开始或接续副本']:[]),...shipBlockers,...(foodStock(s)-food<r.parameters.foodPerTurn?['先留足家庭本季口粮']:[])
  ],s.economy!.lineage?'可分批装运当前缺的物资，立即从家庭扣除，下一季到场。不必一次凑齐全套。':'一次最多装运一套当前副本物资，立即从家庭扣除，下一季到场。副本物料不能同时供家庭和工厂使用。',(d,ev)=>{const sent=s.economy!.lineage?partial:kit;changeGoods(d,sent,-1,ev,'副本装运');d.economy!.expeditions!.attempts[f.id].shipments.push({goods:{...sent},due:d.clock.absoluteTurn+1});expeditionEvent(ev,f.id,'sent','投入物资已装运，下一季到场',sent);}));
  return out;
}
