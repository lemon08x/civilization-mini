import { usePower,modernOnline } from './modern.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import type { TowerState } from '../model/tower.js';
import { amount,changeGoods,foodStock,equipped,consumeEquipment } from './economy.js';
import { ALL_GOODS as GOODS } from './economy-catalog.js';

export const TOWER_FLOORS=[
  {id:'camp',name:'施工营地',subtitle:'先让建设者吃上饭',kit:{food:1,wood:1},proof:[] as string[],pump:false,continuous:false,effect:'营地完成，开放栈道施工；工地运输增加1份／季。'},
  {id:'towpath',name:'纤维栈道',subtitle:'把亚麻变成可靠的牵引绳',kit:{food:1,rope:1},proof:['workshop-rope'],pump:false,continuous:false,effect:'栈道完成，开放闸基施工；工地运输再增加1份／季。'},
  {id:'locks',name:'闸基烧造',subtitle:'用持续烧造支撑水工结构',kit:{food:1,ceramics:1,brick:1},proof:['kiln'],pump:false,continuous:false,effect:'闸基完成，开放排水施工。'},
  {id:'drain',name:'排水施工',subtitle:'让施工面保持可用',kit:{food:1,iron:1,seal:1,wood:1},proof:[],pump:true,continuous:false,effect:'排水段完成，开放最后合龙试炼。'},
  {id:'canal',name:'两河大运河 · 合龙',subtitle:'供粮、机械加工与排水连续协作',kit:{food:1,valve:1,shaft:1,rope:1,wood:1},proof:['delegated-mechanical'],pump:true,continuous:true,effect:'贯通两河，宏大工程通关。'},
] satisfies {id:string;name:string;subtitle:string;kit:Record<string,number>;proof:string[];pump:boolean;continuous:boolean;effect:string}[];
export const MODERN_FLOORS=[
 {id:'survey',name:'峡谷工业基建营',subtitle:'接续家业，建立现代工程供货基地',kit:{food:1,ceramics:1,shaft:1},proof:[],pump:false,continuous:false,effect:'开放输电建设，工地运力增加1份。',power:0},
 {id:'grid',name:'发电与输电走廊',subtitle:'发电机真实供能，铜线进入输电网络',kit:{food:1,coil:1,cable:1},proof:['electrical'],pump:false,continuous:false,effect:'输电走廊建成，工地运力再增加1份。',power:2},
 {id:'waterworks',name:'电动泵站与流域工程',subtitle:'用电动离心泵维持施工，水电与供水争用水源',kit:{food:1,iron:1,seal:1},proof:[],pump:true,continuous:false,effect:'开放电子制造与通信建设。',power:2},
 {id:'electronics',name:'电子制造与无线调度',subtitle:'雇员实际制造电路，通信设备真实在线',kit:{food:1,circuit:1,battery:1},proof:['delegated-electronics'],pump:false,continuous:false,effect:'开放数字协同工业区验收。',power:2},
 {id:'smart',name:'清洁电网与数字协同工业区',subtitle:'清洁发电、电子制造、无线通信和数字控制连续协作',kit:{food:1,controller:1,composite:1,cable:1},proof:['delegated-control'],pump:false,continuous:true,effect:'现代工程全线验收，数字协同工业区通关。',power:3},
] satisfies {id:string;name:string;subtitle:string;kit:Record<string,number>;proof:string[];pump:boolean;continuous:boolean;effect:string;power:number}[];
export const floorsFor=(s:GameState)=>s.economy?.modern?MODERN_FLOORS:TOWER_FLOORS;
export const PROOF_NAMES:Record<string,string>={
 electrical:'本季实际完成绝缘铜线或电机线圈',
 'delegated-electronics':'本季雇员实际完成电子电路或数字控制器',
 'delegated-control':'本季雇员实际完成数字控制器',
 'workshop-rope':'本季绳索作坊实际完成加工',
 kiln:'本季实际完成一批陶质构件或耐火砖',
 'delegated-mechanical':'本季雇员实际完成一批阀门或传动轴',
};
export const initialTower=():TowerState=>({floor:0,active:false,delivery:false,stock:{},shipments:[],progress:0,evidenceTurn:0,evidence:[]});
export const towerDuration=(r:Ruleset,index:number)=>(r.modern?MODERN_FLOORS:TOWER_FLOORS)[index].continuous?r.tower!.finalSeasons:r.tower!.buildSeasons;
export const towerTransport=(s:GameState,r:Ruleset)=>r.tower!.transport+Math.min(s.economy!.tower!.floor,2)+(modernOnline(s,'N08')?1:0);
const total=(values:Record<string,number>)=>Object.values(values).reduce((a,b)=>a+b,0);
export const towerGoodName=(id:string)=>id==='food'?'施工口粮':GOODS[id]?.name??id;
function log(events:GameEvent[],operation:string,floor:number,detail:string,goods:Record<string,number>={}){events.push({type:'tower',operation,floor,detail,goods});}
export function towerRunning(s:GameState):boolean {const t=s.economy?.tower;return !!t&&t.active&&!s.economy!.operations!.paused&&t.floor<floorsFor(s).length;}

// 建筑实体所需的剩余物资；计入现场与在途，防止反复订货和超额交付。
export function towerNeeds(s:GameState,r:Ruleset):Record<string,number>{
 const t=s.economy?.tower;if(!t||!towerRunning(s)||!t.delivery)return {};
 const f=floorsFor(s)[t.floor],remaining=towerDuration(r,t.floor)-t.progress;
 return Object.fromEntries(Object.entries(f.kit).map(([id,n])=>[id,Math.max(0,n!*remaining-(t.stock[id]??0)-t.shipments.filter(x=>x.good===id).reduce((a,x)=>a+x.amount,0))]));
}
export function arriveTower(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const t=s.economy?.tower;if(!t)return;
 const due=t.shipments.filter(x=>x.due<=s.clock.absoluteTurn);t.shipments=t.shipments.filter(x=>x.due>s.clock.absoluteTurn);
 for(const x of due){t.stock[x.good]=(t.stock[x.good]??0)+x.amount;log(events,'arrived',t.floor,`${x.amount}份${towerGoodName(x.good)}到达工地`,{[x.good]:x.amount});}
 if(total(t.stock)>r.tower!.capacity)throw new Error('工地库存超过容量');
 t.evidenceTurn=s.clock.absoluteTurn;t.evidence=[];
}
export function dispatchTower(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const t=s.economy?.tower;if(!t||!towerRunning(s)||!t.delivery)return;
 let transport=towerTransport(s,r),space=r.tower!.capacity-total(t.stock)-t.shipments.reduce((a,x)=>a+x.amount,0);
 const needs=towerNeeds(s,r);
 // 优先补齐最少的施工套数，避免一种材料占满工地而其他必需品永远运不进来。
 const kit=floorsFor(s)[t.floor].kit;
 while(transport>0&&space>0){
  const id=Object.keys(needs).filter(id=>needs[id]>0&&(id==='food'?foodStock(s)>r.parameters.foodPerTurn:amount(s,id)>0))
   .sort((a,b)=>((t.stock[a]??0)+t.shipments.filter(x=>x.good===a).reduce((n,x)=>n+x.amount,0))/(kit[a as keyof typeof kit]??1)-((t.stock[b]??0)+t.shipments.filter(x=>x.good===b).reduce((n,x)=>n+x.amount,0))/(kit[b as keyof typeof kit]??1))[0];
  if(!id)break;
  if(id==='food'){
   if(s.household.food>r.parameters.foodPerTurn)s.household.food--;
   else {const grain=['flour','wheat','soy'].find(g=>amount(s,g)>0);if(grain)changeGoods(s,{[grain]:1},-1,events,'施工口粮装运');else s.household.food--;}
  }else changeGoods(s,{[id]:1},-1,events,'大运河施工装运');
  const shipment=t.shipments.find(x=>x.good===id&&x.due===s.clock.absoluteTurn+1);
  if(shipment)shipment.amount++;else t.shipments.push({good:id,amount:1,due:s.clock.absoluteTurn+1});
  needs[id]--;space--;transport--;log(events,'sent',t.floor,`装运1份${towerGoodName(id)}，下一季到达工地`,{[id]:1});
 }
}
export function recordTowerEvidence(s:GameState,events:GameEvent[]):void{
 const t=s.economy?.tower;if(!t||!towerRunning(s))return;
 if(t.evidenceTurn!==s.clock.absoluteTurn){t.evidenceTurn=s.clock.absoluteTurn;t.evidence=[];}
 const add=(id:string)=>{if(!t.evidence.includes(id))t.evidence.push(id);};
 for(const e of events){
  if(e.type==='operations'&&e.operation==='workshop-worked'&&e.target==='rope'&&e.amount>0)add('workshop-rope');
  if(e.type==='economy-process'&&e.stage==='complete'){
   if(['wire','coil'].includes(e.recipe))add('electrical');
   if(['circuit','controller'].includes(e.recipe)&&e.actor!=='本人')add('delegated-electronics');
   if(e.recipe==='controller'&&e.actor!=='本人')add('delegated-control');
   if(['ceramics','brick'].includes(e.recipe))add('kiln');
   if(['valve','shaft'].includes(e.recipe)&&e.actor!=='本人')add('delegated-mechanical');
  }
 }
}
export function towerBlockers(s:GameState,_r:Ruleset):string[]{
 const t=s.economy!.tower!;if(t.floor>=floorsFor(s).length)return [];
 const f=floorsFor(s)[t.floor],pump=s.economy!.modern?'W07':'W03';
 const modern:string[]=[];if(s.economy!.modern){
 const power=MODERN_FLOORS[t.floor].power+(f.pump?1:0);
 if(s.economy!.modern.power<power)modern.push('工地电力不足：需要'+power+'电');
 if(t.floor>=3&&!modernOnline(s,'N08'))modern.push('无线电调度站本季未在线');
 if(t.floor===4){if(!modernOnline(s,'N10'))modern.push('数字协同控制中心本季未在线');if(!['E01','E03'].some(id=>s.economy!.modern!.operated[id]===s.clock.absoluteTurn))modern.push('需本季水电或光伏实际发电');}
 }
 return [...modern,...(!t.active?['尚未开工或已暂停']:[]),...(s.economy!.operations!.paused?['家族经营待接续']:[]),
  ...Object.entries(f.kit).filter(([id,n])=>(t.stock[id]??0)<n!).map(([id,n])=>`工地缺${n!-(t.stock[id]??0)}份${towerGoodName(id)}`),
  ...f.proof.filter(id=>t.evidenceTurn!==s.clock.absoluteTurn||!t.evidence.includes(id)).map(id=>PROOF_NAMES[id]),
  ...(f.pump&&!equipped(s,pump)?['需可用'+(pump==='W07'?'电动离心泵':'活塞泵')]:[]),...(f.pump&&s.economy!.equipmentUsed[pump]===s.clock.absoluteTurn?['活塞泵本季已被农业或矿场占用']:[])];
}
export function settleTower(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const t=s.economy?.tower;if(!t||t.floor>=floorsFor(s).length)return;
 const f=floorsFor(s)[t.floor],season=events.find(e=>e.type==='season-settled');
 const blockers=towerBlockers(s,r);if(season?.type!=='season-settled'||season.missing>0)blockers.unshift('家庭本季缺粮，施工让位于生存');
 if(blockers.length){
  if(f.continuous&&t.progress){t.progress=0;log(events,'interrupted',t.floor,'连续合龙试验中断，连续季数归零；已投入的施工物料不返还');}
  if(t.active)log(events,'waiting',t.floor,blockers.join('；'));
  return;
 }
 const consumed:Record<string,number>={};for(const [id,n] of Object.entries(f.kit)){t.stock[id]-=n!;consumed[id]=n!;}
 if(s.economy!.modern){const power=MODERN_FLOORS[t.floor].power+(f.pump?1:0);if(power)usePower(s,power,events,'现代工程');}
 if(f.pump){const pump=s.economy!.modern?'W07':'W03';consumeEquipment(s,pump,events);s.economy!.equipmentUsed[pump]=s.clock.absoluteTurn;log(events,'pumped',t.floor,s.economy!.modern?'离心泵用电排水，消耗1电及1耐用':'施工泵实际排水，消耗工地1木材与活塞泵1耐用；本季不能重复使用');}
 t.progress++;log(events,'built',t.floor,`${f.name}完成有效施工 ${t.progress}/${towerDuration(r,t.floor)} 季`,consumed);
 if(t.progress>=towerDuration(r,t.floor)){
  log(events,'floor-complete',t.floor,`${f.name}完成。${f.effect}`);
  t.floor++;t.progress=0;t.active=false;t.delivery=false;t.evidence=[];
  if(t.floor===floorsFor(s).length)log(events,'victory',t.floor,s.economy!.modern?'现代流域电网与数字协同工业区验收通过。':'两河大运河贯通：文明试炼全部通过。');
 }
}
export function towerView(s:GameState,r:Ruleset){
 const t=s.economy!.tower!;
 return {...structuredClone(t),name:s.economy!.modern?'现代流域电网与自动化工业区':'两河大运河',total:floorsFor(s).length,transport:towerTransport(s,r),capacity:r.tower!.capacity,blockers:towerBlockers(s,r),needs:towerNeeds(s,r),
  floors:floorsFor(s).map((f,i)=>({...f,index:i,seasons:towerDuration(r,i),proofNames:[...f.proof.map(id=>PROOF_NAMES[id]),...(s.economy!.modern?['现场用电'+(MODERN_FLOORS[i].power+(f.pump?1:0))+'份／有效季',...(i>=3?['无线电调度站本季在线']:[]),...(i===4?['数字协同控制中心本季在线','本季水电或光伏发电']:[]),...(f.pump?['电动离心泵可用']:[])]:[])],state:i<t.floor?'complete':i===t.floor?'current':'locked'}))};
}
