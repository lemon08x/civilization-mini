import { modernOnline,usePower } from './modern.js';
import { topicsFor,productsFor,processesFor,goodsFor } from './economy-catalog.js';
import { towerView } from './tower.js';
import { workshopView } from './workshop.js';
import { operationsView,planBlocker,steamReady,useSteam } from './operations.js';
import { made,servicePending,shopView,salePrice } from './shop.js';
import type { GameState } from '../model/state.js';
import type { EconomyState, Subject, Crop, WorkerKind, Worker } from '../model/economy.js';
import { SUBJECTS } from '../model/economy.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import { ALL_GOODS as GOODS, ALL_TOPICS as TOPICS, ALL_PRODUCTS as PRODUCTS, ALL_PROCESSES as PROCESSES, CROPS, SUBJECT_NAMES, WORKER_NAMES, ALL_JOB_NAMES as JOB_NAMES } from './economy-catalog.js';
import type { ProcessSpec } from './economy-catalog.js';

export function initialEconomy():EconomyState {
  return {knowledge:{},evidence:{},notes:{},goods:{wood:2,clay:2,seedWheat:1,seedSoy:1,seedFlax:1},equipment:{},workers:{},
    field:{crop:null,planted:0,moisture:0,growth:0,stress:0,fertility:2,lastCrop:null,tended:0,composted:false,bonus:0,duration:2},
    project:null,market:4,recruitment:1,industrySupply:4,regional:{iron:false,fiber:false,teaching:{}},published:{},ironBatches:0,fiberBatches:0,poweredTurn:0,equipmentUsed:{}};
}
export function level(s:GameState,subject:Subject,person=s.household.activePersonId):number{return s.economy!.knowledge[person]?.[subject]??0;}
export function amount(s:GameState,id:string):number{return s.economy!.goods[id]??0;}
export function equipped(s:GameState,id:string):boolean{return (s.economy!.equipment[id]??0)>0&&!servicePending(s,'repair',id);}
export function consumeEquipment(s:GameState,id:string,events:GameEvent[]):void {
  s.economy!.equipment[id]--;events.push({type:'economy-equipment-used',product:id,remaining:s.economy!.equipment[id]});
}
export function changeGoods(s:GameState,goods:Record<string,number>,sign:number,events:GameEvent[],source:string):void {
  for(const[id,n]of Object.entries(goods)){const next=amount(s,id)+n*sign;if(next<0)throw new Error('实物不足：'+id);s.economy!.goods[id]=next;}
  events.push({type:'economy-goods',source,changes:Object.fromEntries(Object.entries(goods).map(([id,n])=>[id,n*sign]))});
}
export function requirements(s:GameState,needs:Partial<Record<Subject,number>>):string[]{return Object.entries(needs).filter(([d,n])=>level(s,d as Subject)<n).map(([d,n])=>`需${SUBJECT_NAMES[d as Subject]}第${n}阶`);}
export function missingGoods(s:GameState,needs:Record<string,number>):string[]{return Object.entries(needs).filter(([id,n])=>amount(s,id)<n).map(([id,n])=>`需${n}${GOODS[id]?.name??id}`);}
export function recordEvidence(s:GameState,subject:Subject,events:GameEvent[],source:string):void{
  const n=level(s,subject)+1;if(n>(s.economy?.modern?10:6))return;const t=TOPICS.find(t=>t.subject===subject&&t.level===n)!;
  const list=s.economy!.evidence[s.household.activePersonId]??=[];
  if(!list.includes(t.id)){list.push(t.id);events.push({type:'economy-evidence',topic:t.id,source});}
}
export function fieldYield(s:GameState):number{
  const f=s.economy!.field;if(!f.crop)return 0;
  const late=Math.max(0,f.growth-f.duration-(equipped(s,'U04')?1:0));
  return Math.max(1,CROPS[f.crop].yield+f.bonus+(s.economy!.modern?.cropBonus??0)+Math.min(1,f.fertility)-f.stress-late);
}
export function farmBlocker(s:GameState,crop:Crop,worker?:Worker):string[]{
  const f=s.economy!.field;
  if(!f.crop){
    if(worker?.kind==='laborer'&&worker.experience<8)return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker?[]:requirements(s,{agronomy:CROPS[crop].level})),...missingGoods(s,{[CROPS[crop].seed]:1})];
  }
  if(f.growth>=f.duration)return [];
  if(f.tended===s.clock.absoluteTurn)return ['本季已管理田间'];
  if(s.location.rain+f.moisture>=2)return ['本季水分充足，等待作物生长'];
  if(s.location.water<1)return ['公共水不足'];
  return [];
}
export function farmWork(s:GameState,crop:Crop,events:GameEvent[],worker?:Worker):void{
  const e=s.economy!,f=e.field,actor=worker?WORKER_NAMES[worker.kind]:'本人';
  if(!f.crop){
    if(worker?.kind==='farmer'&&e.operations?.farm&&f.fertility<2&&amount(s,'compost')>0){changeGoods(s,{compost:1},-1,events,'农工托管施肥');f.fertility=Math.min(3,f.fertility+1);}
    if(e.modern)e.modern.cropBonus=0;
    const c=CROPS[crop];changeGoods(s,{[c.seed]:1},-1,events,actor+'播种');
    let bonus=worker&&worker.experience>=8?1:0;for(const id of (e.shop?['U01']:['U01','U02']))if(equipped(s,id)){bonus++;consumeEquipment(s,id,events);}
    if(e.shop&&equipped(s,'U02')&&e.shop.seededTurn!==s.clock.absoluteTurn){e.shop.seededTurn=s.clock.absoluteTurn;consumeEquipment(s,'U02',events);}
    if(level(s,'agronomy')>=6&&f.lastCrop&&f.lastCrop!==crop)bonus++;
    let duration=c.duration;if(equipped(s,'U10')){duration=Math.max(1,duration-1);consumeEquipment(s,'U10',events);}
    Object.assign(f,{crop,planted:s.clock.absoluteTurn,moisture:0,growth:0,stress:0,tended:0,composted:false,bonus,duration});
    events.push({type:'economy-farm',operation:'sow',crop,actor,amount:0});
  }else if(f.growth>=f.duration){
    const c=CROPS[f.crop],n=fieldYield(s),out:Record<string,number>={[f.crop]:n,straw:c.straw,[c.seed]:1};
    if(level(s,'agronomy')>=5)out[c.seed]++;
    changeGoods(s,out,1,events,actor+'收获');made(s,f.crop);if(equipped(s,'U04'))consumeEquipment(s,'U04',events);
    events.push({type:'economy-farm',operation:'harvest',crop:f.crop,actor,amount:n});
    f.fertility=Math.max(0,Math.min(3,f.fertility+(f.crop==='soy'?1:-1)));f.lastCrop=f.crop;f.crop=null;
  }else{
    s.location.water--;f.moisture+=equipped(s,'W01')?2:1;if(equipped(s,'W01'))consumeEquipment(s,'W01',events);
    f.tended=s.clock.absoluteTurn;events.push({type:'economy-farm',operation:'tend',crop:f.crop,actor,amount:1});
  }
  if(!worker)recordEvidence(s,'agronomy',events,'田间实践');
}
export function assemblyReady(s:GameState,worker?:Worker):boolean{return !!worker&&!!s.economy!.modern&&organizationLevel(s)>=7&&equipped(s,'T07')&&s.economy!.equipmentUsed.T07!==s.clock.absoluteTurn&&s.economy!.modern.power>=1;}
export function processMultiplier(s:GameState,p:ProcessSpec,worker?:Worker):number{if(!p.wait&&assemblyReady(s,worker))return 2;if(worker&&worker.experience>=8)return 2;return ['fiber','rope'].includes(p.id)&&equipped(s,'P01')?2:1;}
export function processInputs(s:GameState,p:ProcessSpec,worker?:Worker):Record<string,number>{const factor=processMultiplier(s,p,worker);return Object.fromEntries(Object.entries(p.inputs).map(([id,n])=>[id,n*factor]));}
export function processBlockers(s:GameState,p:ProcessSpec,worker?:Worker):string[]{
  const e=s.economy!;
  const activeProjects=[e.project,...Object.values(e.workers).map(w=>w?.project)].filter(Boolean);
  const busy=p.equipment&&activeProjects.some(x=>PROCESSES.find(p=>p.id===x!.good)?.equipment===p.equipment);
  const power=(p.power??0)*processMultiplier(s,p,worker)+(!p.wait&&assemblyReady(s,worker)?1:0);
  return [...(worker&& !Object.values(p.requires).some(n=>n>6)?[]:requirements(s,p.requires)),...(power>(e.modern?.power??0)?['电力不足：本批需要'+power+'电']:[]),...missingGoods(s,processInputs(s,p,worker)),
    ...(p.equipment&&!equipped(s,p.equipment)?['需可用'+PRODUCTS.find(x=>x.id===p.equipment)!.name]:[]),
    ...(busy||p.equipment&&e.equipmentUsed[p.equipment]===s.clock.absoluteTurn?['对应设备本季或在制工序占用']:[]),
    ...(!worker&&e.project?['先完成本人在制项目']:[])];
}
function completeProcess(s:GameState,p:ProcessSpec,factor:number,events:GameEvent[],actor:string):void{
  changeGoods(s,Object.fromEntries(Object.entries(p.outputs).map(([id,n])=>[id,n*factor])),1,events,actor+'完成'+p.name);
  events.push({type:'economy-process',recipe:p.id,actor,stage:'complete',factor});
  if(actor==='本人'){for(const d of Object.keys(p.requires))recordEvidence(s,d as Subject,events,p.name);}
  for(const id of Object.keys(p.outputs))made(s,id);
  if(p.id==='iron')s.economy!.ironBatches++;if(p.id==='fiber')s.economy!.fiberBatches++;
}
export function runProcess(s:GameState,p:ProcessSpec,events:GameEvent[],worker?:Worker,rules?:Ruleset):void{
  const factor=processMultiplier(s,p,worker),actor=worker?WORKER_NAMES[worker.kind]:'本人';
  const assembly=!p.wait&&assemblyReady(s,worker);
  if(p.power)usePower(s,p.power*factor,events,p.name);
  if(assembly){usePower(s,1,events,'标准化装配');consumeEquipment(s,'T07',events);s.economy!.equipmentUsed.T07=s.clock.absoluteTurn;}
  changeGoods(s,Object.fromEntries(Object.entries(p.inputs).map(([id,n])=>[id,n*factor])),-1,events,actor+'开工');
  if(p.equipment){consumeEquipment(s,p.equipment,events);s.economy!.equipmentUsed[p.equipment]=s.clock.absoluteTurn;}
  if(factor===2&&['fiber','rope'].includes(p.id)&&equipped(s,'P01')&&(!worker||worker.experience<8))consumeEquipment(s,'P01',events);
  const accelerated=rules&&['ceramics','brick','iron'].includes(p.id)&&steamReady(s,rules);
  if(accelerated)useSteam(s,rules!,events);
  if(p.wait&&!accelerated){const project={good:p.id,amount:factor,started:s.clock.absoluteTurn};if(worker)worker.project=project;else s.economy!.project=project;events.push({type:'economy-process',recipe:p.id,actor,stage:'start',factor});}
  else completeProcess(s,p,factor,events,actor);
}
export function finishProcess(s:GameState,events:GameEvent[],worker?:Worker):void{
  const project=worker?worker.project:s.economy!.project;if(!project)throw new Error('没有在制品');
  const p=PROCESSES.find(x=>x.id===project.good)!;
  completeProcess(s,p,project.amount,events,worker?WORKER_NAMES[worker.kind]:'本人');
  if(worker)worker.project=null;else s.economy!.project=null;
}
export function organizationLevel(s:GameState):number{return Math.max(level(s,'organization'),s.economy!.notes.organization??0);}
export function wage(_s:GameState,rules:Ruleset,w:Worker):number{return rules.economy!.wage+(w.kind==='laborer'?0:w.kind==='manager'?2:1)+(w.experience>=8?1:0);}
export function workerBlocker(s:GameState,w:Worker):string[]{
  if(servicePending(s,'training',w.kind))return ['委托培训中，本季不工作、不扣工资'];
  if(w.project)return s.clock.absoluteTurn>w.project.started?[]:['在制品需跨季'];
  if(w.job==='rest')return ['合同已暂停'];
  if(['wheat','soy','flax'].includes(w.job))return farmBlocker(s,w.job as Crop,w);
  return processBlockers(s,PROCESSES.find(p=>p.id===w.job)!,w);
}
export function foodStock(s:GameState):number{return s.household.food+['flour','wheat','soy'].reduce((n,id)=>n+amount(s,id),0);}
export function storage(s:GameState):number{return s.economy!.shop?.assets.includes('granary')?Math.max(equipped(s,'S02')?14:equipped(s,'S01')?8:4,s.economy!.shopGranaryCapacity??0):equipped(s,'S02')?14:equipped(s,'S01')?8:4;}
export function settleEconomy(s:GameState,rules:Ruleset,events:GameEvent[]):void{
  const e=s.economy!,f=e.field;
  if(f.crop&&s.location.rain+f.moisture<2&&equipped(s,'W03')&&s.location.water>0&&amount(s,'wood')>0){
    changeGoods(s,{wood:1},-1,events,'活塞泵自动灌溉');s.location.water--;f.moisture+=2;consumeEquipment(s,'W03',events);if(e.operations)e.equipmentUsed.W03=s.clock.absoluteTurn;
    events.push({type:'economy-farm',operation:'pump',crop:f.crop,actor:'活塞泵',amount:1});
  }
  // 固定结算次序可观察。同一设备、地块不能因多人或自动化重复获得产出。
  for(const kind of ['laborer','farmer','artisan','manager'] as WorkerKind[]){
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
  if(f.crop&&f.growth<f.duration){
    if(!modernOnline(s,'U08M')&&s.location.rain+f.moisture<2)f.stress++;
    if(!modernOnline(s,'U08M')&&s.location.rain>=3){if(equipped(s,'U08'))consumeEquipment(s,'U08',events);else f.stress++;}
    f.growth++;f.moisture=0;
    events.push({type:'economy-crop-growth',crop:f.crop,growth:f.growth,stress:f.stress});
  }else if(f.crop)f.growth++;
  for(const [id,batches,key]of [['iron',e.ironBatches,'iron'],['fiber',e.fiberBatches,'fiber']] as const){
    const d=id==='iron'?'chemistry':'materials';
    if(!e.regional[key]&&batches>=3&&(e.published[d]??0)>0){e.regional[key]=true;events.push({type:'economy-region',industry:key});}
  }
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
  return {...structuredClone(e),...(e.tower?{towerView:towerView(s,rules)}:{}),...(e.workshops?{workshopView:workshopView(s,rules)}:{}),...(e.shop?{marketView:shopView(s,rules)}:{}),...(e.operations?{operationsView:operationsView(s,rules)}:{}),foodTotal:foodStock(s),storage:modernOnline(s,'S08')?Math.max(30,storage(s)):storage(s),harvest:fieldYield(s),
    disciplines:SUBJECTS.map(subject=>({subject,name:SUBJECT_NAMES[subject],level:level(s,subject),heirLevel:level(s,subject,s.household.heirId),notes:e.notes[subject]??0,
      topics:topicsFor(s).filter(t=>t.subject===subject).map(t=>({...t,known:level(s,subject)>=t.level,evidence:(e.evidence[s.household.activePersonId]??[]).includes(t.id)}))})),
    staff:Object.values(e.workers).map(w=>({...structuredClone(w!),name:WORKER_NAMES[w!.kind],jobName:JOB_NAMES[w!.job],wage:wage(s,rules,w!),blockers:[...workerBlocker(s,w!),...planBlocker(s,w!,rules)]})),
    products:productsFor(s).map(p=>e.shop&&p.id==='U02'?{...p,effect:'每季一次本人播种免行动，仍扣种子与耐用度；雇工工资不减免'}:p),processes:processesFor(s),crops:CROPS,goodsCatalog:goodsFor(s),parameters:structuredClone(rules.economy!)};
}
