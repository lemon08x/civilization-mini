import { processesFor } from './economy-catalog.js';
import { towerNeeds } from './tower.js';
import { workshopNeeds,workshopPayroll } from './workshop.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import type { OperationsState,RegionalProject } from '../model/operations.js';
import type { Subject,Crop,Worker } from '../model/economy.js';
import { ALL_PRODUCTS as PRODUCTS,ALL_PROCESSES as PROCESSES,CROPS,SUBJECT_NAMES } from './economy-catalog.js';
import { amount,changeGoods,equipped,foodStock,level,organizationLevel,wage,processMultiplier } from './economy.js';
import { shopCatalog,deliverShop,shopEvent,deviceReserved,repairPrice,salePrice,servicePending } from './shop.js';
export function initialOperations():OperationsState{return {paused:false,food:false,foodReserved:0,farm:null,production:null,supplies:false,sales:false,maintenance:false,charter:false,mine:false,steam:false,projects:{},activeProject:null,notice:[]};}
export function opEvent(events:GameEvent[],operation:string,target:string,detail:string,amount=0,money=0){events.push({type:'operations',operation,target,detail,amount,money});}
export function completed(s:GameState,id:RegionalProject):boolean{return s.economy?.operations?.projects[id]?.stage==='complete';}
export const REGIONAL_PROJECTS:{id:RegionalProject;name:string;needs:Partial<Record<Subject,number>>;inputs:Record<string,number>;effect:string;test:string;previous?:RegionalProject}[]=[
 {id:'food',name:'稳定供粮',needs:{organization:1},inputs:{},effect:'取得生活保障成果；供粮协议预留额度增加2份。',test:'连续运行验证：有供粮协议或农业托管，季末无缺粮且仍有至少一季口粮'},
 {id:'mechanical',name:'地区机械供应',needs:{mechanics:3,materials:2},inputs:{shaft:2,ceramics:2},effect:'机械工业交付合作形成；自动出售铁料、陶质构件和机械部件每件多1钱。',test:'实际使用手摇传动或水轮，完成纤维、绳索、磨粮、脱粒、榨油中的一批；每季至多一次验证'},
 {id:'mine',name:'深层排水采矿',needs:{mechanics:5,materials:3},inputs:{iron:2,valve:1},previous:'mechanical',effect:'开放持续矿场合作：每季实际排水后取得矿料，消耗木材、泵耐用和矿工分成。',test:'使用可用活塞泵排水，1木材、1泵耐用和1钱分成换取矿料；与农业共用泵'},
 {id:'steam',name:'蒸汽供能接入',needs:{heat:6,materials:6,mechanics:4},inputs:{brick:2,spring:2,seal:2},previous:'mine',effect:'开放燃料动力：不依赖公共水的免行动食品加工；陶器、砖和冶铁可每季加速一批，即时完成。',test:'运行燃料动力试验；消耗木材、弹簧及阀门，验证压力与热处理配套'}
];
export function foodTarget(s:GameState,r:Ruleset):number{return r.operations!.foodTarget+(completed(s,'food')?2:0);}
export function projectBlockers(s:GameState,id:RegionalProject):string[]{
 const p=REGIONAL_PROJECTS.find(p=>p.id===id)!,e=s.economy!,ops=e.operations!;
 const needs=Object.entries(p.needs).filter(([d,n])=>Math.max(0,...s.household.memberIds.map(person=>level(s,d as Subject,person)))<n).map(([d,n])=>`家族需${SUBJECT_NAMES[d as Subject]}${n}阶`);
 if(p.previous&&!completed(s,p.previous))needs.push('需先完成'+REGIONAL_PROJECTS.find(x=>x.id===p.previous)!.name);
 if(id==='food'&&!ops.food&&!ops.farm)needs.push('先签供粮协议或农业托管');
 if(id==='mechanical'&&!equipped(s,'P01')&&!equipped(s,'P03'))needs.push('需可用手摇传动或水轮');
 if(id==='mine'&&!equipped(s,'W03'))needs.push('需可用活塞泵');
 if(id==='steam'&&!equipped(s,'F04'))needs.push('需可用热处理炉验证配套');
 return needs;
}
export function reserveFood(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const ops=s.economy?.operations;if(!ops)return;
 if(s.socialFood||!ops.food||ops.paused)return;
 const n=Math.min(s.production!.market.food,foodTarget(s,r));
 ops.foodReserved+=n;s.production!.market.food-=n;
 opEvent(events,'reserved','food','供粮协议预留'+n+'份市场口粮，按实际配送付费',n);
}
export function renewOperations(s:GameState,r:Ruleset,events:GameEvent[]):void{const ops=s.economy?.operations;if(!ops)return;ops.foodReserved=0;reserveFood(s,r,events);}
function alert(s:GameState,events:GameEvent[],target:string,detail:string){const o=s.economy!.operations!;if(!o.notice.includes(detail)){o.notice.push(detail);opEvent(events,'attention',target,detail);}}
export function farmCrop(s:GameState):Crop{const o=s.economy!.operations!;return o.farm==='rotation'?(s.economy!.field.lastCrop==='wheat'?'soy':'wheat'):(o.farm??'wheat');}
export function planBlocker(s:GameState,w:Worker,r:Ruleset):string[]{
 const ops=s.economy!.operations;if(!ops||w.kind!=='artisan'||!ops.production||w.project)return [];
 if(ops.production.recipe!==w.job)return ['生产计划与岗位不同，请重新安排'];
 const p=PROCESSES.find(p=>p.id===w.job)!;
 return ops.production.mode==='stock'&&Object.entries(p.outputs).every(([id])=>amount(s,id)>=r.operations!.outputReserve)?['已达到备货目标，自动待命']:[];
}
function obligations(s:GameState,r:Ruleset):number{return r.operations!.cashReserve+workshopPayroll(s,r)+Object.values(s.economy!.workers).filter(w=>w?.active&&!servicePending(s,'training',w.kind)).reduce((n,w)=>n+wage(s,r,w!),0)+(s.economy!.operations!.food?Math.max(0,foodTarget(s,r)-foodStock(s))*r.parameters.foodPrice:0);}
function autoSell(s:GameState,r:Ruleset,events:GameEvent[]){
 const e=s.economy!,o=e.operations!;if(!o.sales)return;
 const recipe=o.production?PROCESSES.find(p=>p.id===o.production!.recipe):undefined;
 const ids=[...new Set([...(e.workshops?.nodes.rope?['rope']:[]),...(recipe&&o.production!.mode==='sell'?Object.keys(recipe.outputs):[]),'ceramics','iron','fiber','shaft','valve','spring','solution','ore','flax','oil','wheat','soy','flour'])];
 for(const id of ids){
  const keep=Math.max((e.modern?.enabled.includes('E02')&&id==='fuel'?2:0),(workshopNeeds(s,r)[id]??0)+(towerNeeds(s,r)[id]??0), ['wheat','soy','flour'].includes(id)?Math.max(r.operations!.foodTarget,r.operations!.outputReserve):r.operations!.outputReserve);
  const n=Math.min(Math.max(0,amount(s,id)-keep),e.market);if(!n)continue;
  const premium=completed(s,'mechanical')&&['iron','ceramics','shaft','valve','spring'].includes(id)?1:0;
  const money=n*(salePrice(s,id)+premium);changeGoods(s,{[id]:n},-1,events,'自动交付');e.market-=n;s.household.money+=money;
  events.push({type:'economy-trade',good:id,operation:'sell',amount:n,money});opEvent(events,'sold',id,'自动交付'+n+'件，收入'+money+'钱',n,money);
 }
}
function purchaseInputs(s:GameState,r:Ruleset,events:GameEvent[]){
 const e=s.economy!,o=e.operations!,sh=e.shop!;if(!o.supplies)return;
 const needs:Record<string,number>={};
 const add=(id:string,n:number)=>{needs[id]=Math.max(needs[id]??0,n);};
 if(e.modern?.enabled.includes('E02'))add('fuel',2);
 if(o.farm){add(CROPS[farmCrop(s)].seed,1);if(e.field.fertility<2)add('compost',1);}
 if(o.production&&e.workers.artisan?.active){const p=PROCESSES.find(p=>p.id===o.production!.recipe)!;for(const [id,n]of Object.entries(p.inputs))add(id,n*r.operations!.inputBatches*processMultiplier(s,p,e.workers.artisan));}
 if(equipped(s,'W03')||o.mine||o.steam)add('wood',Math.max(2,r.operations!.steamFuel));
 for(const [id,n] of Object.entries(workshopNeeds(s,r)))add(id,n);
 for(const [id,n] of Object.entries(towerNeeds(s,r)))if(id!=='food')needs[id]=(needs[id]??0)+n;
 const catalog=shopCatalog(s,r);
 for(const [id,target]of Object.entries(needs)){
  const pending=sh.orders.filter(x=>x.kind==='goods'&&x.target===id).reduce((n,x)=>n+x.amount,0);
  const missing=Math.max(0,target-amount(s,id)-pending);if(!missing)continue;
  const item=catalog.find(x=>x.kind==='goods'&&x.target===id);if(!item)continue;
  if(!item.local&&!r.civilization&&s.clock.generation===r.parameters.generations&&s.clock.turn===r.parameters.turnsPerGeneration)continue;
  const n=Math.min(missing,item.stock,sh.transport,Math.max(0,Math.floor((s.household.money-obligations(s,r))/item.price)));
  if(!n){alert(s,events,id,'自动补货等待：'+item.name+'（检查周转金、库存和运输）');continue;}
  const money=n*item.price;s.household.money-=money;sh.stock[item.id]-=n;sh.transport-=n;
  const order={kind:item.kind,target:id,name:item.name,amount:n,due:s.clock.absoluteTurn+1};
  shopEvent(events,'purchased',id,'供货协议购入'+item.name,money,n);
  if(item.local)deliverShop(s,r,order,events);else sh.orders.push(order);
 }
}
function autoCare(s:GameState,r:Ruleset,events:GameEvent[]){
 const e=s.economy!,o=e.operations!;if(!o.maintenance||!r.civilization&&s.clock.generation===r.parameters.generations&&s.clock.turn===r.parameters.turnsPerGeneration)return;
 for(const [id,n]of Object.entries(e.equipment)){
  if(n>r.operations!.repairThreshold||deviceReserved(s,id)||e.equipmentUsed[id]===s.clock.absoluteTurn)continue;
  const cost=repairPrice(s,r,id);if(s.household.money-cost<obligations(s,r)){alert(s,events,id,'维护待命：'+PRODUCTS.find(p=>p.id===id)!.name+'缺周转金');continue;}
  s.household.money-=cost;e.shop!.orders.push({kind:'repair',target:id,name:PRODUCTS.find(p=>p.id===id)!.name+'维护',amount:1,due:s.clock.absoluteTurn+1});
  shopEvent(events,'repair',id,'自动送修，本季停用、次季恢复',cost);
 }
}
export function beforeOperations(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const e=s.economy!,o=e.operations;if(!o)return;o.notice=[];if(o.paused)return;
 autoSell(s,r,events);supplyFood(s,r,events,false);autoCare(s,r,events);purchaseInputs(s,r,events);
 if(o.farm&&e.workers.farmer?.active){e.workers.farmer.job=e.field.crop??farmCrop(s);
 }
}
export function afterOperations(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const e=s.economy!,o=e.operations;if(!o||o.paused)return;
 if(o.mine||o.activeProject==='mine'){
  if(equipped(s,'W03')&&e.equipmentUsed.W03!==s.clock.absoluteTurn&&amount(s,'wood')>=1&&s.household.money>=1){
   changeGoods(s,{wood:1},-1,events,'合作矿场排水');s.household.money--;e.equipment.W03--;e.equipmentUsed.W03=s.clock.absoluteTurn;
   events.push({type:'economy-equipment-used',product:'W03',remaining:e.equipment.W03});changeGoods(s,{ore:r.operations!.mineYield},1,events,'排水后矿工采掘');opEvent(events,'mined','mine','排水采掘完成，已付1钱矿工分成',r.operations!.mineYield,1);
  }else alert(s,events,'mine','矿场待命：检查泵占用、木材和分成资金');
 }
 if(o.activeProject==='steam'&&equipped(s,'F04')&&e.equipmentUsed.F04!==s.clock.absoluteTurn&&amount(s,'wood')>=r.operations!.steamFuel&&amount(s,'spring')>=1&&amount(s,'valve')>=1){
  changeGoods(s,{wood:r.operations!.steamFuel,spring:1,valve:1},-1,events,'蒸汽配套试运行');e.equipment.F04--;e.equipmentUsed.F04=s.clock.absoluteTurn;
  events.push({type:'economy-equipment-used',product:'F04',remaining:e.equipment.F04});opEvent(events,'commission','steam','压力与热处理配套试验完成',1);
 }else if(o.activeProject==='steam')alert(s,events,'steam',`蒸汽试验等待：需空闲热处理炉、${r.operations!.steamFuel}木材、1弹簧、1阀门`);
 for(const event of [...events])if(event.type==='economy-worker'&&event.operation==='waiting'&&(event.detail.includes('工资不足')||event.detail.startsWith('需')||event.detail.includes('公共水不足')))alert(s,events,event.worker,'雇员待命：'+event.detail);
 autoSell(s,r,events);
 supplyFood(s,r,events,true);
}
function supplyFood(s:GameState,r:Ruleset,events:GameEvent[],report:boolean){
 const o=s.economy!.operations!;
 if(!s.socialFood&&o.food){
  const need=Math.max(0,foodTarget(s,r)-foodStock(s));const n=Math.min(need,o.foodReserved,Math.floor(s.household.money/r.parameters.foodPrice));
  if(n){const money=n*r.parameters.foodPrice;s.household.money-=money;s.household.food+=n;o.foodReserved-=n;events.push({type:'food-purchased',amount:n,money});opEvent(events,'supplied','food','长期供粮配送'+n+'份',n,money);}
  if(report&&foodStock(s)<r.parameters.foodPerTurn)alert(s,events,'food','供粮不足：需补充资金或市场供应');
 }
}

export function advanceProjects(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const o=s.economy?.operations;if(!o?.activeProject||o.paused)return;
 const id=o.activeProject,p=o.projects[id]!;const season=events.find(e=>e.type==='season-settled');let success=false;
 if(id==='food')success=!!(o.food||o.farm)&&season?.type==='season-settled'&&season.missing===0&&foodStock(s)>=r.parameters.foodPerTurn;
 if(id==='mechanical')success=p.qualifiedTurn===s.clock.absoluteTurn;
 if(id==='mine')success=p.qualifiedTurn===s.clock.absoluteTurn;
 if(id==='steam')success=p.qualifiedTurn===s.clock.absoluteTurn;
 if(!success){if(id==='food')p.progress=0;opEvent(events,'project-waiting',id,'项目本季尚未满足运行验证条件');return;}
 p.progress=Math.min(r.operations!.commissionSeasons,p.progress+1);opEvent(events,'project-progress',id,'实际运行验证'+p.progress+'/'+r.operations!.commissionSeasons,p.progress);
 if(p.progress>=r.operations!.commissionSeasons){p.stage='complete';o.activeProject=null;if(id==='mine')o.mine=true;if(id==='steam')o.steam=true;opEvent(events,'project-complete',id,REGIONAL_PROJECTS.find(p=>p.id===id)!.name+'已达成，新能力开放',1);}
}
export function steamReady(s:GameState,r:Ruleset):boolean{return !!s.economy?.operations?.steam&&!s.economy.operations.paused&&completed(s,'steam')&&s.economy!.poweredTurn!==s.clock.absoluteTurn&&amount(s,'wood')>=r.operations!.steamFuel;}
export function useSteam(s:GameState,r:Ruleset,events:GameEvent[]):void{changeGoods(s,{wood:r.operations!.steamFuel},-1,events,'蒸汽供能');s.economy!.poweredTurn=s.clock.absoluteTurn;opEvent(events,'powered','steam','燃料供能已生效，本季动力额度用尽',1);}
export function handoverOperations(s:GameState,events:GameEvent[]):void{const o=s.economy?.operations;if(!o||o.charter)return;for(const w of Object.values(s.economy!.workers))if(w)w.active=false;o.paused=true;o.foodReserved=0;opEvent(events,'paused','family','经营安排已保存但暂停；后辈可用一次接续行动恢复，家族契约可免去此操作');}
export function operationsView(s:GameState,r:Ruleset){const o=s.economy!.operations!;return {...structuredClone(o),foodTarget:foodTarget(s,r),parameters:r.operations!,organization:organizationLevel(s),stage:completed(s,'steam')?'燃料动力':completed(s,'mine')?'资源开拓':completed(s,'mechanical')?'地区工业':completed(s,'food')?'生活保障':o.food||o.farm||o.production?'委托经营':'亲自谋生',projectsCatalog:(s.economy!.branches?[]:REGIONAL_PROJECTS).map(p=>({...p,test:p.id==='steam'?`每个验证季用空闲热处理炉、${r.operations!.steamFuel}木材、1弹簧、1阀门，完成一次压力配套试验`:p.test,blockers:projectBlockers(s,p.id),state:o.projects[p.id]?.stage??'available',progress:o.projects[p.id]?.progress??0})),completed:Object.entries(o.projects).filter(([,p])=>p?.stage==='complete').map(([id])=>id),recipes:processesFor(s).map(p=>({id:p.id,name:p.name,equipment:p.equipment,outputs:p.outputs}))};}

export function recordProjectEvidence(s:GameState,events:GameEvent[]):void{
 const o=s.economy?.operations;if(!o?.activeProject)return;const id=o.activeProject;
 const valid=id==='mechanical'?events.some(e=>e.type==='economy-equipment-used'&&['P01','P03'].includes(e.product))&&events.some(e=>e.type==='economy-process'&&e.stage==='complete'):id==='mine'?events.some(e=>e.type==='operations'&&e.operation==='mined'):id==='steam'?events.some(e=>e.type==='operations'&&e.operation==='commission'&&e.target==='steam'):false;
 if(valid)o.projects[id]!.qualifiedTurn=s.clock.absoluteTurn;
}
