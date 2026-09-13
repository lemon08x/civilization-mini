import {INDUSTRY_PRODUCTS,SYSTEMS,type SystemDefinition,type SystemInstance,type OperatorId} from '../model/industry.js';
import {activePerson,type GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
import {knowledgeNeeds,productName} from './industry-products.js';
import {changeGoods,consumeEquipment,equipped,missingGoods} from './economy.js';
import {servicePending} from './shop.js';

export function industryEvent(events:GameEvent[],operation:string,target:string,actor:string,detail:string,time=0,energy=0,money=0):void{events.push({type:'industry',operation,target,actor,detail,time,energy,money});}
export function installedIn(s:GameState,equipment:string):string|undefined{
 return SYSTEMS.find(def=>def.equipment===equipment&&s.economy?.industry?.instances[def.id])?.name;
}
export function systemUnlockNeeds(s:GameState,def:SystemDefinition):string[]{
 const x=s.economy!.industry!;
 return [...knowledgeNeeds(s,def.knowledge),...def.products.filter(id=>!x.products[id]).map(id=>'需验证'+productName(id)),...def.systems.filter(id=>!x.commissioned.includes(id)).map(id=>'需调试前置系统'+id)];
}
export function systemDemand(s:GameState,def:SystemDefinition):boolean{
 if(def.id==='shaft')return true;
 const f=s.economy!.field;return !!f.crop&&f.growth<f.duration&&s.location.rain+f.moisture<2;
}
export function operatorNeeds(s:GameState,def:SystemDefinition,operator:OperatorId|null):string[]{
 if(!operator)return ['未安排人员'];
 if(operator==='self')return [];
 const w=s.economy!.workers[operator];
 if(!w)return ['尚未招募该岗位'];
 if(servicePending(s,'training',operator))return ['员工培训中'];
 if(def.qualification==='craft'&&operator!=='artisan')return ['加工任务需熟练工匠'];
 return [];
}
export function operatorBudget(s:GameState,operator:OperatorId){
 const x=s.economy!.industry!;
 if(operator==='self')return {timeRemaining:s.life!.timeRemaining,energy:activePerson(s).vitality!.energy};
 return x.workers[operator]??{timeRemaining:0,energy:0};
}
export function reservedLabor(s:GameState,operator:OperatorId='self',exclude?:string){
 let time=0,energy=0;
 for(const def of SYSTEMS){const i=s.economy?.industry?.instances[def.id];if(i?.enabled&&i.commissioned&&i.operator===operator&&def.id!==exclude&&systemDemand(s,def)){time+=def.time;energy+=def.energy;}}
 return {time,energy};
}
export function assignmentNeeds(s:GameState,def:SystemDefinition,operator:OperatorId):string[]{
 const budget=operatorBudget(s,operator),reserved=reservedLabor(s,operator,def.id),needs=operatorNeeds(s,def,operator);
 // Reserve potential demand when assigning; idle systems do not lock personal time in later observations.
 if(budget.timeRemaining<reserved.time+def.time)needs.push('人员时间不足（含其他系统预留）');
 if(budget.energy<reserved.energy+def.energy)needs.push('人员精力不足（先休息或下季再安排）');
 return needs;
}
export function systemInputs(def:SystemDefinition):Record<string,number>{return def.id==='shaft'?{wood:2,iron:1}:def.id==='pump'?{wood:1}:{};}
export function physicalNeeds(s:GameState,def:SystemDefinition):string[]{
 const e=s.economy!;
 return [...missingGoods(s,systemInputs(def)),...(def.id!=='shaft'&&s.location.water<1?['公共水不足']:[]),
  ...(def.equipment&&!equipped(s,def.equipment)?['设备不可用或维修中']:[]),
  ...(def.equipment&&e.equipmentUsed[def.equipment]===s.clock.absoluteTurn?['设备本季已占用']:[]),
  ...(def.id==='shaft'&&!e.industry!.products.shaft?.protocol?['缺少轴制造规程，外购检验不能代替试制']:[])];
}
export function wageFor(s:GameState,def:SystemDefinition,operator:OperatorId|null):number{return !operator||operator==='self'?0:Math.ceil(def.time/s.economy!.industry!.rules.wageTimeUnit);}
export function systemBlockers(s:GameState,def:SystemDefinition,i:SystemInstance):string[]{
 if(!i.commissioned)return ['尚未调试'];if(!i.enabled)return ['主动暂停'];
 if(!systemDemand(s,def))return ['本季无需供水'];
 const needs=[...operatorNeeds(s,def,i.operator),...physicalNeeds(s,def)];
 if(i.operator){const b=operatorBudget(s,i.operator),r=s.economy!.industry!.rules;
  const rest=i.operator!=='self'&&b.energy<def.energy;
  if(b.timeRemaining<def.time+(rest?r.workerRestTime:0))needs.push('人员剩余时间不足');
  if(b.energy+(rest?Math.min(r.workerRestRecovery,r.workerEnergy-b.energy):0)<def.energy)needs.push('人员精力不足');
  if(s.household.money<wageFor(s,def,i.operator))needs.push('工资不足');
 }
 return needs;
}
export function settleIndustry(s:GameState,events:GameEvent[]):void{
 const x=s.economy?.industry;if(!x)return;
 for(const def of SYSTEMS){const i=x.instances[def.id];if(!i)continue;
  const blockers=systemBlockers(s,def,i);
  if(blockers.length){industryEvent(events,'waiting',def.id,i.operator??'none',def.name+'：'+blockers.join('；'));continue;}
  const operator=i.operator!,r=x.rules,budget=operatorBudget(s,operator),pay=wageFor(s,def,operator);
  // All physical, wage and work conditions passed before any resource is changed.
  if(operator!=='self'&&budget.energy<def.energy){budget.timeRemaining-=r.workerRestTime;budget.energy=Math.min(r.workerEnergy,budget.energy+r.workerRestRecovery);industryEvent(events,'rest',def.id,operator,'员工休息恢复精力，不计工作工资',r.workerRestTime,0);}
  if(operator==='self'){s.life!.timeRemaining-=def.time;activePerson(s).vitality!.energy-=def.energy;}
  else{budget.timeRemaining-=def.time;budget.energy-=def.energy;}
  s.household.money-=pay;
  changeGoods(s,systemInputs(def),-1,events,def.name+'投入');
  if(def.equipment){consumeEquipment(s,def.equipment,events);s.economy!.equipmentUsed[def.equipment]=s.clock.absoluteTurn;}
  if(def.id==='shaft'){
   changeGoods(s,{shaft:2},1,events,'系统加工产出');
   events.push({type:'economy-process',recipe:'shaft',actor:'系统：'+operator,stage:'complete',factor:1});
  }else{
   s.location.water--;s.economy!.field.moisture+=2;s.economy!.field.tended=s.clock.absoluteTurn;
   events.push({type:'economy-farm',operation:def.id==='pump'?'pump':'tend',crop:s.economy!.field.crop!,actor:'系统：'+operator,amount:1});
  }
  industryEvent(events,'worked',def.id,operator,def.name+'完成；实际扣费',def.time,def.energy,pay);
 }
}
export function renewIndustry(s:GameState):void{
 const x=s.economy?.industry;if(!x)return;
 for(const id of Object.keys(s.economy!.workers)){
  const b=x.workers[id];x.workers[id]={timeRemaining:x.rules.workerTime,energy:Math.min(x.rules.workerEnergy,(b?.energy??x.rules.workerEnergy)+x.rules.workerRecovery)};
 }
}
export function industryView(s:GameState){
 const x=s.economy!.industry!;
 return {catalog:structuredClone(INDUSTRY_PRODUCTS),reserved:reservedLabor(s),products:structuredClone(x.products),workers:structuredClone(x.workers),rules:structuredClone(x.rules),
  systems:SYSTEMS.map(def=>{const instance=x.instances[def.id];return {...def,instance:instance?structuredClone(instance):null,unlockNeeds:systemUnlockNeeds(s,def),blockers:instance?systemBlockers(s,def,instance):['尚未建设'],wage:instance?wageFor(s,def,instance.operator):0};})};
}
