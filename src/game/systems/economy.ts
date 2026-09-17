import {electricReady,electricRewardPercent} from '../model/electric.js';
import { settleIndustry,industryView } from './industry.js';
import {branchHas,branchView} from './branches.js';
import { expeditionView } from './expedition.js';
import { modernOnline } from './modern.js';
import { topicsFor,productsFor,processesFor,goodsFor } from './economy-catalog.js';
import { towerView } from './tower.js';
import { workshopView } from './workshop.js';
import { operationsView,planBlocker } from './operations.js';
import { servicePending,shopView,salePrice } from './shop.js';
import {type GameState} from '../model/state.js';
import type { EconomyState, Crop, WorkerKind, Worker } from '../model/economy.js';
import { SUBJECTS } from '../model/economy.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import { ALL_PROCESSES as PROCESSES, CROPS, SUBJECT_NAMES, WORKER_NAMES, ALL_JOB_NAMES as JOB_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, foodStock, storage } from './inventory.js';
import { level, organizationLevel, recordEvidence, wage } from './knowledge.js';
import { farmBlocker, farmWork, fieldYield, settleOngoingFarm } from './agriculture.js';
import { finishProcess, processBlockers, runProcess } from './processing.js';

export { amount, changeGoods, consumeEquipment, equipped, foodStock, missingGoods, storage } from './inventory.js';
export { level, organizationLevel, recordEvidence, requirements, wage } from './knowledge.js';
export { farmBlocker, farmCycleLabor, farmWork, fieldYield, settleOngoingFarm } from './agriculture.js';
export { assemblyReady, finishProcess, processBlockers, processInputs, processMultiplier, runProcess } from './processing.js';

export function initialEconomy():EconomyState {
  return {knowledge:{},evidence:{},notes:{},goods:{wood:2,clay:2,seedWheat:1,seedSoy:1,seedFlax:1},equipment:{},workers:{},
    field:{crop:null,planted:0,moisture:0,growth:0,stress:0,fertility:2,lastCrop:null,tended:0,composted:false,bonus:0,duration:2},
    ongoing:{farm:null},project:null,market:4,recruitment:1,industrySupply:4,regional:{iron:false,fiber:false,teaching:{}},published:{},ironBatches:0,fiberBatches:0,poweredTurn:0,equipmentUsed:{}};
}

export function workerBlocker(s:GameState,w:Worker):string[]{
  if(servicePending(s,'training',w.kind))return ['委托培训中，本季不工作、不扣工资'];
  if(w.project)return s.clock.absoluteTurn>w.project.started?[]:['在制品需跨季'];
  if(w.job==='rest')return ['合同已暂停'];
  if(['wheat','soy','flax'].includes(w.job))return farmBlocker(s,w.job as Crop,w);
  return processBlockers(s,PROCESSES.find(p=>p.id===w.job)!,w);
}

export function settleEconomy(s:GameState,rules:Ruleset,events:GameEvent[]):void{
  const e=s.economy!,f=e.field;
  if(!e.industry&&f.crop&&(!e.branches||branchHas(s,'A1'))&&s.location.rain+f.moisture<2&&equipped(s,'W03')&&s.location.water>0&&amount(s,'wood')>0){
    changeGoods(s,{wood:1},-1,events,'活塞泵自动灌溉');s.location.water--;f.moisture+=2;consumeEquipment(s,'W03',events);if(e.operations)e.equipmentUsed.W03=s.clock.absoluteTurn;
    events.push({type:'economy-farm',operation:'pump',crop:f.crop,actor:'活塞泵',amount:1});
  }
  // 固定结算次序可观察。同一设备、地块不能因多人或自动化重复获得产出。
  for(const kind of (e.industry?[]:['laborer','farmer','artisan','manager']) as WorkerKind[]){
    const w=e.workers[kind];if(!w?.active)continue;
    const cost=wage(s,rules,w),blockers=[...workerBlocker(s,w),...planBlocker(s,w,rules)];
    if(s.household.money<cost||blockers.length){events.push({type:'economy-worker',worker:kind,operation:'waiting',money:0,detail:s.household.money<cost?'工资不足':blockers.join('；')});continue;}
    s.household.money-=cost;
    if(w.project)finishProcess(s,events,w);else if(['wheat','soy','flax'].includes(w.job))farmWork(s,w.job as Crop,events,w);else runProcess(s,PROCESSES.find(p=>p.id===w.job)!,events,w,rules);
    w.experience++;events.push({type:'economy-worker',worker:kind,operation:'worked',money:cost,detail:JOB_NAMES[w.job]});
    recordEvidence(s,'organization',events,'实际雇佣与工序安排');
    if(kind==='manager'&&organizationLevel(s)>=6&&e.market>0){
      const id=['iron','ceramics','fiber'].find(id=>amount(s,id)>2);
      if(id){const revenue=salePrice(s,id);changeGoods(s,{[id]:1},-1,events,'合作交付');e.market--;s.household.money+=revenue-1;
        events.push({type:'economy-trade',good:id,operation:'sell',amount:1,money:revenue});events.push({type:'economy-worker',worker:kind,operation:'share',money:1,detail:'合作收益分成'});}
    }
  }
  settleIndustry(s,events);
  if(f.crop&&f.growth<f.duration){
    if(!modernOnline(s,'U08M')&&s.location.rain+f.moisture<2)f.stress++;
    if(!modernOnline(s,'U08M')&&s.location.rain>=3){if(equipped(s,'U08'))consumeEquipment(s,'U08',events);else f.stress++;}
    f.growth++;f.moisture=0;
    events.push({type:'economy-crop-growth',crop:f.crop,growth:f.growth,stress:f.stress});
  }else if(f.crop)f.growth++;
  settleOngoingFarm(s,rules,events);
  for(const [id,batches,key]of [['iron',e.ironBatches,'iron'],['fiber',e.fiberBatches,'fiber']] as const){
    const d=id==='iron'?'chemistry':'materials';
    if(!e.regional[key]&&batches>=3&&(e.published[d]??0)>0){e.regional[key]=true;events.push({type:'economy-region',industry:key});}
  }
  if(s.socialFood)return; // v21 converts food once, after social purchases and production.
  let need=Math.max(0,rules.parameters.foodPerTurn-s.household.food);
  for(const id of ['flour','wheat','soy']){const n=Math.min(need,amount(s,id));if(n){changeGoods(s,{[id]:n},-1,events,'家庭生活取粮');s.household.food+=n;need-=n;}}
}
export function spoilEconomy(s:GameState,events:GameEvent[]):void{
  const protectedFood=modernOnline(s,'S08')?Math.max(30,storage(s)):storage(s);
  let excess=Math.max(0,foodStock(s)-protectedFood);if(!excess)return;
  let loss=Math.ceil(excess/3);const loose=Math.min(loss,s.household.food);s.household.food-=loose;loss-=loose;
  const changes:Record<string,number>={};for(const id of ['flour','soy','wheat']){const n=Math.min(loss,amount(s,id));if(n){changes[id]=n;loss-=n;}}
  if(Object.keys(changes).length)changeGoods(s,changes,-1,events,'食品保存损耗');
  events.push({type:'food-spoiled',amount:loose+Object.values(changes).reduce((a,b)=>a+b,0),protected:protectedFood});
}
export function economyView(s:GameState,rules:Ruleset){
  const e=s.economy!;
  return {...structuredClone(e),...(s.electric?{electricView:{rules:structuredClone(s.electric.rules),ready:electricReady(s),rewardPercent:electricRewardPercent(s),hydroOutput:s.location.weather==='dry'?s.electric.rules.dryHydroPower:6,loadOrder:['LAMP','TELEGRAPH'],description:'手动调度供能；电灯和电报按顺序耗电，电解按批耗电。季末余电可储存，否则跨季耗散。'}}:{}),ongoing:structuredClone(e.ongoing??{farm:null}),...(e.industry?{industryView:industryView(s)}:{}),...(e.branches?{branchView:branchView(s)}:{}),...(e.expeditions?{expeditionView:expeditionView(s)}:{}),...(e.tower?{towerView:towerView(s,rules)}:{}),...(e.workshops?{workshopView:workshopView(s,rules)}:{}),...(e.shop?{marketView:shopView(s,rules)}:{}),...(e.operations?{operationsView:operationsView(s,rules)}:{}),foodTotal:foodStock(s),storage:modernOnline(s,'S08')?Math.max(30,storage(s)):storage(s),harvest:fieldYield(s),
    disciplines:(e.branches?[]:SUBJECTS).map(subject=>({subject,name:SUBJECT_NAMES[subject],level:level(s,subject),heirLevel:level(s,subject,s.household.heirId),notes:e.notes[subject]??0,
      topics:topicsFor(s).filter(t=>t.subject===subject).map(t=>({...t,known:level(s,subject)>=t.level,evidence:(e.evidence[s.household.activePersonId]??[]).includes(t.id)}))})),
    staff:Object.values(e.workers).map(w=>({...structuredClone(w!),name:WORKER_NAMES[w!.kind],jobName:JOB_NAMES[w!.job],wage:wage(s,rules,w!),blockers:[...workerBlocker(s,w!),...planBlocker(s,w!,rules)]})),
    products:productsFor(s).map(p=>e.shop&&p.id==='U02'?{...p,effect:'每季一次本人播种免行动，仍扣种子与耐用度；雇工工资不减免'}:p),processes:processesFor(s),crops:CROPS,goodsCatalog:goodsFor(s),parameters:structuredClone(rules.economy!)};
}
