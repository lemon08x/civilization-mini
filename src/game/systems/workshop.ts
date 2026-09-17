import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import type { WorkshopId,WorkshopState } from '../model/workshop.js';
import { amount,changeGoods } from './inventory.js';
import { recordEvidence } from './knowledge.js';
import { PROCESSES,GOODS } from './economy-catalog.js';
import { made } from './shop.js';

export const WORKSHOPS = [
  {id:'fiber' as const,name:'纤维作坊',input:'flax',output:'fiber',level:1},
  {id:'rope' as const,name:'绳索作坊',input:'fiber',output:'rope',level:2},
];
export const initialWorkshops=():WorkshopState=>({nodes:{},shipments:[]});
export const workshopWage=(r:Ruleset)=>r.economy!.wage+1;
function event(events:GameEvent[],operation:string,target:string,detail:string,n=0,money=0){events.push({type:'operations',operation:'workshop-'+operation,target,detail,amount:n,money});}
export function workshopPayroll(s:GameState,r:Ruleset):number {
  if(s.economy?.operations?.paused)return 0;
  return Object.values(s.economy?.workshops?.nodes??{}).reduce((n,w)=>n+(w?.active?w.units*workshopWage(r):0),0);
}
export function workshopNeeds(s:GameState,r:Ruleset):Record<string,number>{
  const net=s.economy?.workshops;if(!net)return {};
  const needs:Record<string,number>={};
  for(const spec of WORKSHOPS){const w=net.nodes[spec.id];if(!w?.active||w.source!=='household')continue;
    const arriving=net.shipments.filter(x=>x.target===spec.id).reduce((n,x)=>n+x.amount,0);
    needs[spec.input]=Math.max(0,Math.min(r.workshops!.buffer,2*w.units*r.operations!.inputBatches)-w.input-arriving);
  }
  return needs;
}
export function arriveWorkshops(s:GameState,_r:Ruleset,events:GameEvent[]):void{
  const net=s.economy?.workshops;if(!net)return;
  const due=net.shipments.filter(x=>x.due<=s.clock.absoluteTurn);
  net.shipments=net.shipments.filter(x=>x.due>s.clock.absoluteTurn);
  for(const x of due){
    if(x.target==='household')changeGoods(s,{[x.good]:x.amount},1,events,'作坊交货到家');
    else net.nodes[x.target]!.input+=x.amount;
    event(events,'arrived',x.target,`${GOODS[x.good].name}${x.amount}份已到达${x.target==='household'?'家庭库存':WORKSHOPS.find(w=>w.id===x.target)!.name}`,x.amount);
  }
}
export function workshopBlockers(s:GameState,r:Ruleset,id:WorkshopId):string[]{
  const w=s.economy!.workshops!.nodes[id];if(!w)return ['尚未建设'];
  const spec=WORKSHOPS.find(x=>x.id===id)!,p=PROCESSES.find(x=>x.id===id)!;
  return [...(s.economy!.operations!.paused?['等待接续家族经营']:[]),...(!w.active?['已暂停生产']:[]),
    ...(w.input<p.inputs[spec.input]?[`缺${GOODS[spec.input].name}；检查供应来源与在途货物`]:[]),
    ...(w.output+p.outputs[spec.output]>r.workshops!.buffer?['成品缓冲已满，等待下游或交货运输']:[]),
    ...(s.household.money<workshopWage(r)?['工资不足']:[])];
}
export function settleWorkshops(s:GameState,r:Ruleset,events:GameEvent[]):void{
  const net=s.economy?.workshops;if(!net||s.economy!.operations!.paused)return;
  // 所有路线先发运已有库存，再加工；不依赖节点遍历顺序逐级穿透。
  for(const spec of WORKSHOPS){const w=net.nodes[spec.id];if(!w?.active)continue;
    const pending=net.shipments.filter(x=>x.target===spec.id).reduce((n,x)=>n+x.amount,0);
    const upstream=w.source==='upstream'?net.nodes.fiber:undefined;
    const available=w.source==='household'?amount(s,spec.input):upstream?.output??0;
    const n=Math.min(available,r.workshops!.transport*w.logistics,Math.max(0,r.workshops!.buffer-w.input-pending));
    if(n){if(w.source==='household')changeGoods(s,{[spec.input]:n},-1,events,spec.name+'装运原料');else upstream!.output-=n;
      net.shipments.push({target:spec.id,good:spec.input,amount:n,due:s.clock.absoluteTurn+1});
      event(events,'sent',spec.id,`${spec.name}原料发运${n}份，下季到达`,n);
    }
  }
  for(const spec of WORKSHOPS){const w=net.nodes[spec.id];if(!w)continue;
    // 纤维接入下游时全部保留给下游；切回家庭供货后才向家庭交货。
    if(spec.id==='fiber'&&net.nodes.rope?.source==='upstream')continue;
    const n=Math.min(w.output,r.workshops!.transport*w.logistics);
    if(n){w.output-=n;net.shipments.push({target:'household',good:spec.output,amount:n,due:s.clock.absoluteTurn+1});event(events,'sent',spec.id,`${spec.name}交货${n}份，下季到家`,n);}
  }
  for(const spec of WORKSHOPS){const w=net.nodes[spec.id];if(!w)continue;
    const blockers=workshopBlockers(s,r,spec.id);
    if(blockers.length){event(events,'waiting',spec.id,spec.name+'：'+blockers.join('；'));continue;}
    const p=PROCESSES.find(x=>x.id===spec.id)!,input=p.inputs[spec.input],output=p.outputs[spec.output];
    const batches=Math.min(w.units,Math.floor(w.input/input),Math.floor((r.workshops!.buffer-w.output)/output),Math.floor(s.household.money/workshopWage(r)));
    w.input-=input*batches;w.output+=output*batches;const pay=batches*workshopWage(r);s.household.money-=pay;
    events.push({type:'economy-process',recipe:spec.id,actor:spec.name,stage:'complete',factor:batches});
    event(events,'worked',spec.id,`${spec.name}完成${batches}批，产出${output*batches}份，工资${pay}钱${batches<w.units?'；部分工位因原料、缓冲或工资不足待命':''}`,output*batches,pay);
    made(s,spec.output);if(spec.id==='fiber')s.economy!.fiberBatches+=batches;
    recordEvidence(s,'organization',events,'作坊协作实际生产');
  }
}
export function workshopView(s:GameState,r:Ruleset){
  const net=s.economy!.workshops!;
  return {parameters:r.workshops!,wage:workshopWage(r),nodes:WORKSHOPS.map(spec=>({...spec,unit:net.nodes[spec.id]?structuredClone(net.nodes[spec.id]):null,blockers:workshopBlockers(s,r,spec.id)})),shipments:structuredClone(net.shipments)};
}
