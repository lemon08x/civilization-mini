import {electricRewardPercent} from '../model/electric.js';
import {ERAS,ERA_CARDS,DUNGEON_TASKS} from '../model/eras.js';
import {branchNodesFor,nodeInEra} from '../model/branches.js';
import {ALL_PROCESSES,CROPS} from './economy-catalog.js';
import {activePerson,heir} from '../model/state.js';
import type {GameState} from '../model/state.js';
import type {Ruleset} from '../ruleset.js';
import type {GameEvent} from '../model/events.js';
import type {OperatorId,SystemId} from '../model/industry.js';
export const eraCard=(s:GameState)=>ERA_CARDS.find(c=>c.id===s.era?.card);
export function eraEvent(s:GameState,events:GameEvent[],operation:string,detail:string,amount=0,money=0){const e=s.era!;events.push({type:'era',operation,stage:e.index,card:e.card,detail,amount,money});}
function drawCard(s:GameState):string{let x=s.randomState;x^=x<<13;x^=x>>>17;x^=x<<5;s.randomState=x>>>0;return ERA_CARDS[Math.floor(s.randomState/4294967296*ERA_CARDS.length)].id;}
export function initializeEras(s:GameState,r:Ruleset):void{
 if(!r.eras)return;s.era={rules:structuredClone(r.eras),index:0,elapsed:0,card:drawCard(s),rewardEscrow:0,closed:false,groundwater:1,tap:false,pendingSettle:false,startGeneration:s.clock.generation,dungeon:{started:false,tasks:[],...(r.electric?{powered:false}:{})}};
}
export function renewEraServices(s:GameState,r:Ruleset):void{
 const e=s.era;if(!e)return;const stage=ERAS[e.index],card=eraCard(s)!;
 e.groundwater=1;
 s.socialFood!.rules.imports=Math.max(1,stage.imports+card.imports);
 s.socialFood!.rules.serviceCapacity=stage.service;
 s.socialFood!.price=r.parameters.foodPrice+card.price;
}
export function publicWaterFee(s:GameState):number{
 const e=s.era,f=s.economy?.field;
 return e?.index===3&&e.tap&&f?.crop&&f.growth<f.duration&&s.location.rain+f.moisture<2&&s.household.money>=1?1:0;
}
export function operateEraServices(s:GameState,events:GameEvent[]):void{
 const e=s.era;if(!e)return;
 const f=s.economy!.field;
 if(!f.crop||f.growth>=f.duration||s.location.rain+f.moisture>=2)return;
 if(e.index===3&&e.tap){
  if(s.household.money<1){eraEvent(s,events,'service-waiting','自来水服务等待：需1钱；自家井和供水设备仍可使用');return;}
  s.household.money--;f.moisture+=2;f.tended=s.clock.absoluteTurn;
  eraEvent(s,events,'water-service','公共自来水人员供水2份，支付1钱；本人不承担提水劳动',2,1);return;
 }
 if(ERAS[e.index].publicWell){
  f.moisture+=2;f.tended=s.clock.absoluteTurn;
  eraEvent(s,events,'water-service','集镇公井供水2份，不消耗科技和个人提水',2,0);
 }
}
export function eraProductionClaim(s:GameState,units:number,kind:'food'|'craft'):number{
 const e=s.era;if(!e||!units)return 0;
 let claim=units*(kind==='food'?ERAS[e.index].foodWeight:ERAS[e.index].craftWeight)*10;
 if(eraCard(s)?.id==='education')claim=Math.floor(claim*0.9);
 const learned=s.economy!.branches!.learned[s.household.activePersonId]??[];
 if(['O3','O4','O5'].some(id=>learned.includes(id)))claim=Math.floor(claim*1.25);
 return claim;
}
export function recordEraProduction(s:GameState,events:GameEvent[],produced:readonly GameEvent[]):void{
 const e=s.era;if(!e||e.closed)return;
 for(const event of [...produced]){
  let units=0,kind:'food'|'craft'='food',source='';
  if(event.type==='economy-farm'&&event.operation==='harvest'){units=event.amount;kind='food';source='实际收获'+event.crop;}
  if(event.type==='economy-process'&&event.stage==='complete'){
   const p=ALL_PROCESSES.find(p=>p.id===event.recipe);if(!p)continue;
   units=Object.values(p.outputs).reduce((n,x)=>n+x,0)*event.factor;kind='craft';source='实际加工'+event.recipe;
  }
  if(!units)continue;
  const claim=eraProductionClaim(s,units,kind);e.rewardEscrow+=claim;
  eraEvent(s,events,'earned',`${source}${units}份，获得${claim/10}份阶段回报凭证；只在本阶段兑现，不被后续社会服务追溯取消`,claim);
 }
}
export function eraServices(s:GameState){
 const e=s.era;if(!e)return [];
 const stage=ERAS[e.index],out:string[]=[`食品到货${s.socialFood!.rules.imports}、服务容量${s.socialFood!.rules.serviceCapacity}`];
 if(stage.gatherBonus)out.push('公地采食额外+'+stage.gatherBonus);
 if(stage.workBonus)out.push('村社帮工收入+'+stage.workBonus);
 if(stage.publicWell)out.push('集镇公井：旱季为家庭田补水，无需泵科技');
 if(stage.publicMill)out.push('公共磨坊：可用小麦换面粉，无需磨粮知识');
 if(e.index>=2)out.push('公共铁料与电工材料市场');
 if(e.index===3)out.push('市政口粮配送；可付费自来水；最终家业试炼');
 return out;
}
const RUN_ORDER:SystemId[]=['well','hand','pump','shaft'];
function systemLabor(s:GameState,id:SystemId){
 if(id==='well')return {time:2,energy:1};
 if(id==='pump')return {time:2,energy:1};
 if(id==='shaft')return {time:8,energy:6};
 const r=s.life?.renewal;return {time:r?.farmTime??4,energy:r?.farmEnergy??4};
}
function seasonalBudgets(s:GameState){
 const r=s.economy!.industry!.rules,out:Partial<Record<OperatorId,{time:number;energy:number}>>={self:{time:s.life!.rules.timePerSeason,energy:s.life!.rules.baseEnergy}};
 for(const id of ['laborer','farmer','artisan'] as const)if(s.economy!.workers[id])out[id]={time:r.workerTime,energy:r.workerEnergy};
 return out;
}
export function runnableSystems(s:GameState):Set<string>{
 const run=new Set<string>(),x=s.economy?.industry;if(!x)return run;
 const budgets=seasonalBudgets(s);
 for(const id of RUN_ORDER){
  const inst=x.instances[id];if(!inst?.commissioned)continue;
  const operator=inst.enabled&&inst.operator?inst.operator:!inst.operator?'self':null;
  if(!operator)continue;
  const labor=systemLabor(s,id),b=budgets[operator];if(!b||b.time<labor.time||b.energy<labor.energy)continue;
  b.time-=labor.time;b.energy-=labor.energy;run.add(id);
 }
 return run;
}
export function projectEraRemainder(s:GameState,rules:Ruleset,remaining:number){
 const empty={remaining:0,harvests:0,harvestUnits:0,shaftBatches:0,craftUnits:0,claims:0,waterSecured:false,notes:[] as string[]};
 if(!s.era||remaining<=0)return empty;
 const notes:string[]=[],run=runnableSystems(s);
 const tap=s.era.index===3&&s.era.tap&&s.household.money>=1;
 const publicWell=ERAS[s.era.index].publicWell;
 const waterSecured=run.has('well')||run.has('pump')||tap||publicWell;
 notes.push(waterSecured?(run.has('well')?'井水保障剩余旱季灌溉':run.has('pump')?'机械供水保障剩余旱季灌溉':tap?'公共自来水保障剩余旱季灌溉':'集镇公井保障剩余旱季灌溉'):'无公共供水也无已安排的井泵，旱季收成按当地气候折减');
 const f=s.economy!.field,goods=s.economy!.goods;
 const cropId=f.crop??((f.lastCrop&&(goods[CROPS[f.lastCrop].seed]??0)>0)?f.lastCrop:null)??((goods.seedWheat??0)>0||f.crop?'wheat':null);
 let harvests=0,harvestUnits=0;
 if(cropId){
  const spec=CROPS[cropId],duration=f.crop?f.duration:spec.duration;
  const first=!f.crop?duration:f.growth>=duration?0:duration-f.growth;
  harvests=first===0?1+Math.floor(remaining/duration):first>remaining?0:1+Math.floor((remaining-first)/duration);
  const drought=rules.scenarios[s.location.id].drought;
  const success=waterSecured?harvests:Math.floor(harvests*(100-drought)/100);
  let fertility=f.fertility;const bonus=f.crop?f.bonus:0,modern=s.economy!.modern?.cropBonus??0;
  for(let i=0;i<success;i++){
   harvestUnits+=Math.max(1,spec.yield+bonus+modern+Math.min(1,fertility)-(i===0&&f.crop?f.stress:0));
   fertility=Math.max(0,Math.min(3,fertility+(cropId==='soy'?1:-1)));
  }
  notes.push(`田间推算收获${success}次、${harvestUnits}份（${waterSecured?'供水已保障':`当地干旱${drought}%，按可预期非旱季折减`}）`);
 }else notes.push('无在耕作物或可续种的种子，不推算田间收获');
 let shaftBatches=0,craftUnits=0;
 if(run.has('shaft')){shaftBatches=remaining;craftUnits=shaftBatches*2;notes.push(`轴加工工位按人员安排推算${shaftBatches}批、${craftUnits}份；假定市场可维持耗材与常规维护`);}
 else if(xHasShaft(s))notes.push('轴加工已建但已暂停或人员时间不足，不计入推算');
 const claims=eraProductionClaim(s,harvestUnits,'food')+eraProductionClaim(s,craftUnits,'craft');
 return {remaining,harvests,harvestUnits,shaftBatches,craftUnits,claims,waterSecured,notes};
}
function xHasShaft(s:GameState){return !!s.economy?.industry?.instances.shaft?.commissioned;}
// 代际估计：前三个时代每代按 birthYears×4 季；当前代剩余取后辈距成年的季数，无在世后辈时按公开规则估（距生子 + 成年），不读取随机寿命。现代不推算。
export function estimateEraRemaining(s:GameState):number{
 const e=s.era;if(!e||e.index>=ERAS.length-1)return 0;
 const r=s.life?.rules;if(!r)return 0;
 const lived=s.clock.generation-e.startGeneration;
 const h=s.household.heirId!==s.household.activePersonId?heir(s):null;
 let current=0;
 if(h?.vitality?.alive)current=Math.max(0,r.adultYears*4-h.vitality.ageSeasons);
 else{const v=activePerson(s)?.vitality;if(v?.alive)current=Math.max(0,r.birthYears*4-v.ageSeasons)+r.adultYears*4;}
 return Math.max(0,e.rules.generationLimit-lived-1)*r.birthYears*4+current;
}
function dungeonTaskWeight(s:GameState,id:string):number{
 const t=DUNGEON_TASKS.find(t=>t.id===id);if(!t)return 0;
 if(s.electric&&id==='power')return s.electric.rules.powerProgress;
 if(s.electric&&id==='appliance')return s.electric.rules.applianceProgress;
 return t.progress;
}
export function dungeonScore(s:GameState):number{return (s.era?.dungeon.tasks??[]).reduce((sum,id)=>sum+dungeonTaskWeight(s,id),0);}
// 共用结算：兑现凭证、记录事件并进入下一时代（重抽社会卡，startGeneration 记为当前代）；现代为旅程终点。
export function advanceEra(s:GameState,events:GameEvent[],how:string):void{
 const e=s.era!;
 const percent=electricRewardPercent(s);
 if(percent<100){e.rewardEscrow=Math.floor(e.rewardEscrow*percent/100);eraEvent(s,events,'electric-discount',`现代结算缺少本季实际用电服务，回报凭证按${percent}%兑现；公共服务和已有收益仍保留。`);}
 const money=Math.floor(e.rewardEscrow/(e.rules.rewardDivisor*10));s.household.money+=money;
 eraEvent(s,events,'settled',`${ERAS[e.index].name}结束（${how}）：本阶段回报凭证${e.rewardEscrow/10}，兑现${money}钱。收益已结清，不被后续社会服务追溯取消。`,e.rewardEscrow,money);
 e.rewardEscrow=0;e.pendingSettle=false;
 if(e.index===ERAS.length-1){
  e.closed=true;if(s.status!=='ended')s.status='complete';
  const score=dungeonScore(s),target=e.rules.dungeonTarget,names=e.dungeon.tasks.map(id=>DUNGEON_TASKS.find(t=>t.id===id)?.name??id);
  const won=(!s.electric||e.dungeon.powered===true)&&score>=target;
  eraEvent(s,events,'journey-ended',`副本任务：${names.join('、')||'无'}；总分${score}/${target}。${won?'最终副本完成，家族旅程结束':'现代阶段结束；最终副本未达标，保留已获阶段回报'}`);
  return;
 }
 e.index++;e.elapsed=0;e.startGeneration=s.clock.generation;e.card=drawCard(s);
 eraEvent(s,events,'revealed',`进入${ERAS[e.index].name}。${ERAS[e.index].description} 社会卡「${eraCard(s)!.name}」：${eraCard(s)!.description}`);
}
export function settleEra(s:GameState,rules:Ruleset,events:GameEvent[]):void{
 const e=s.era;if(!e||e.closed)return;e.elapsed++;
 const chosen=e.pendingSettle,timedOut=e.index<ERAS.length-1&&s.clock.generation-e.startGeneration>=e.rules.generationLimit;
 if(!chosen&&!timedOut)return;
 let how=timedOut?'本时代代际预算用尽':'玩家主动结算';
 if(chosen&&!timedOut){
  const remaining=estimateEraRemaining(s);
  if(remaining>0){
   const proj=projectEraRemainder(s,rules,remaining);e.rewardEscrow+=proj.claims;
   eraEvent(s,events,'projected',`主动结算，剩余时间按代际估计约${remaining}季，按当前有效产能推算：收获${proj.harvestUnits}份、加工${proj.craftUnits}份，凭证${proj.claims/10}份。${proj.notes.join('；')}`,proj.claims);
   how='玩家主动结算，剩余时间已推算';
  }
 }
 advanceEra(s,events,how);
}
export function eraView(s:GameState,rules:Ruleset){
 const e=s.era!,stage=ERAS[e.index],lived=s.clock.generation-e.startGeneration;
 const limit=e.index<ERAS.length-1?e.rules.generationLimit:null;
 const remaining=estimateEraRemaining(s);
 const preview=projectEraRemainder(s,rules,remaining);
 const percent=electricRewardPercent(s),payable=Math.floor((e.rewardEscrow+preview.claims)*percent/100);
 const goals=limit===null?undefined:(()=>{
  const courses=branchNodesFor(s).filter(n=>n.unlockEra===e.index);
  const learned=s.economy?.branches?.learned[s.household.activePersonId]??[];
  const mastered=courses.filter(n=>learned.includes(n.id)).length;
  const inst=s.economy?.industry?.instances;
  const milestone=e.index===0?{label:'建成并调试家庭水井',done:!!inst?.well?.commissioned}
   :e.index===1?{label:'建成并调试机械供水',done:!!inst?.pump?.commissioned}
   :{label:'建成轴加工工位并安装水力发电机组',done:!!inst?.shaft?.commissioned&&s.economy!.equipment.E01!==undefined};
  return [{label:`掌握本时代新课程 ${mastered}/${courses.length}`,done:courses.length>0&&mastered>=courses.length},milestone,{label:'完成至少一次代际交接',done:lived>=1}];
 })();
 const dungeonOptions=DUNGEON_TASKS.filter(t=>s.electric||(t.id!=='power'&&t.id!=='appliance')).map(t=>({id:t.id,name:t.id==='power'&&s.electric?`交付${s.electric.rules.dungeonPower}电完成工程通电验收`:t.name,progress:dungeonTaskWeight(s,t.id),done:e.dungeon.tasks.includes(t.id)}));
 return {...(s.electric?{electricRewardPercent:percent,electricRequirement:'现代完整回报需本季实际点灯、电报服务或电解；副本需真实交付电力。'}:{}),stage,index:e.index,stages:ERAS.map(x=>({id:x.id,name:x.name})),elapsed:e.elapsed,generationsLived:lived,generationLimit:limit,lastGeneration:limit!==null&&lived===limit-1,remaining,card:eraCard(s)!,rewardClaims:e.rewardEscrow/10,expectedReward:Math.floor(payable/(e.rules.rewardDivisor*10)),rewardDivisor:e.rules.rewardDivisor,closed:e.closed,groundwater:e.groundwater,tap:e.tap,publicWaterAvailable:e.index===3,publicWell:stage.publicWell,publicMill:stage.publicMill,services:eraServices(s),projection:{remaining:preview.remaining,harvestUnits:preview.harvestUnits,craftUnits:preview.craftUnits,claims:preview.claims/10,previewReward:Math.floor(payable/(e.rules.rewardDivisor*10)),waterSecured:preview.waterSecured,notes:preview.notes,appliesOnSettle:true},canSettle:!e.closed,...(goals?{goals}:{}),dungeon:e.index===3?{...e.dungeon,score:dungeonScore(s),target:e.rules.dungeonTarget,options:dungeonOptions}:null,lockedKnowledge:branchNodesFor(s).filter(n=>!nodeInEra(s,n.id)).map(n=>({id:n.id,name:n.name}))};
}
