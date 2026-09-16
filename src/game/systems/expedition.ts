import type { ExpeditionSpec, ExpeditionAttempt, ExpeditionState } from '../model/expedition.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { Ruleset } from '../ruleset.js';
import { changeGoods } from './inventory.js';
import { requirements } from './knowledge.js';
import { modernOnline,usePower } from './modern.js';
import { ALL_GOODS,ALL_TOPICS } from './economy-catalog.js';

// 副本定义是规则，不属于策略或统计。所有奖励只在结算权威内发放。
export const EXPEDITIONS:ExpeditionSpec[]=[
  {id:'harvest',name:'河谷粮站',purpose:'用农业余粮支持粮站，获得陶作材料与学习来源',requires:{agronomy:1},kit:{wheat:3,wood:2},seasons:1,proof:'harvest',eachSeason:false,power:0,services:[],clean:false,reward:{goods:{clay:4,ceramics:2},money:6,books:['M02'],supplyLevel:2}},
  {id:'kiln',name:'耐火窑场',purpose:'组织真实烧造，换取金属样品和机械资料',requires:{materials:2,heat:1},kit:{ceramics:3,wood:2},seasons:1,proof:'kiln',eachSeason:false,power:0,services:[],clean:false,reward:{goods:{iron:3,ore:4},money:10,books:['L03'],supplyLevel:4}},
  {id:'waterworks',name:'水利工坊',purpose:'投入传动与密封部件，获得电工试验的先导材料',requires:{mechanics:3,materials:3},kit:{shaft:2,seal:2,rope:1},seasons:1,proof:'mechanical',eachSeason:false,power:0,services:[],clean:false,reward:{goods:{copper:3,solution:2},money:14,books:['L06','M07'],supplyLevel:6}},
  {id:'grid',name:'区域输电工程',purpose:'持续发电与电工加工，获得电子制造材料',requires:{mechanics:8,materials:8},kit:{coil:1,cable:1},seasons:2,proof:'electrical',eachSeason:true,power:2,services:[],clean:false,reward:{goods:{silicon:2,circuit:2,battery:2},money:20,books:['C09','M09'],supplyLevel:8}},
  {id:'electronics',name:'通信与电子协作站',purpose:'雇员加工与无线通信共同运行，取得先进制造样件',requires:{mechanics:9,materials:9,organization:8},kit:{circuit:1,battery:1},seasons:2,proof:'delegated-electronics',eachSeason:true,power:2,services:['N08'],clean:false,reward:{goods:{controller:2,composite:2},money:26,books:['L10','O10'],supplyLevel:10}},
  {id:'smart',name:'清洁能源协同区',purpose:'连续维持清洁发电、控制器制造与数字调度',requires:{mechanics:10,materials:10,organization:10},kit:{controller:1,composite:1,cable:1},seasons:3,proof:'delegated-control',eachSeason:true,power:3,services:['N08','N10'],clean:true,reward:{goods:{battery:4,silicon:4},money:40,books:['C10','A10'],supplyLevel:10}},
];
const LINEAGE_WATERWORKS:ExpeditionSpec={id:'waterworks',name:'水利工坊',purpose:'用密封件完成水利试验，取得电工先导材料',requires:{mechanics:3,materials:3,organization:1},kit:{seal:2},seasons:1,proof:'seal',eachSeason:false,power:0,services:[],clean:false,reward:{goods:{copper:3,solution:2},money:14,books:['L06','M07'],supplyLevel:6}};
const LINEAGE_PARTS:ExpeditionSpec={id:'parts',name:'传动工场',purpose:'用窑场铁料做出传动轴，换取密封试验材料，把机械链从水利密封链拆开',requires:{mechanics:3,materials:2},kit:{shaft:2},seasons:1,proof:'mechanical',eachSeason:false,power:0,services:[],clean:false,reward:{goods:{fiber:4,oil:1,rope:1},money:8,books:['M03'],supplyLevel:5}};
export const LINEAGE_EXPEDITIONS:ExpeditionSpec[]=[EXPEDITIONS[0],EXPEDITIONS[1],LINEAGE_PARTS,LINEAGE_WATERWORKS,...EXPEDITIONS.slice(3)];
export const EXPEDITION_PROOFS:Record<string,string>={harvest:'挑战期间真实收获一次粮食作物',kiln:'挑战期间真实完成一次陶构件或砖烧造',mechanical:'挑战期间真实加工一次轴或阀门',seal:'本代真实制作一次密封件',electrical:'本季真实完成铜线或线圈', 'delegated-electronics':'本季雇员完成电路或控制器','delegated-control':'本季雇员完成控制器'};
export function expeditionCatalog(s:GameState):ExpeditionSpec[]{return s.economy?.lineage?LINEAGE_EXPEDITIONS:EXPEDITIONS;}
export const initialExpeditions=(lineage=false):ExpeditionState=>({selected:null,supplyLevel:1,attempts:{},...(lineage?{generationProofs:[]}:{})});
export const newAttempt=():ExpeditionAttempt=>({active:true,completed:false,progress:0,stock:{},shipments:[],evidence:[],seasonEvidence:[],evidenceTurn:0});
export function expeditionEvent(events:GameEvent[],id:string,operation:string,detail:string,goods:Record<string,number>={},money=0,books:string[]=[]):void {events.push({type:'expedition',id,operation,detail,goods,money,books});}
export function expeditionBlockers(s:GameState,f:ExpeditionSpec):string[]{
  const a=s.economy!.expeditions!.attempts[f.id];
  if(a?.completed)return ['副本已完成，奖励已发放'];
  return [...requirements(s,f.requires),...(!a?.active?['尚未开始或已暂停']:[]),
    ...Object.entries(f.kit).filter(([id,n])=>(a?.stock[id]??0)<n).map(([id,n])=>`现场缺${n-(a?.stock[id]??0)}份${ALL_GOODS[id].name}`),
    ...(!(f.eachSeason?a?.evidenceTurn===s.clock.absoluteTurn&&a.seasonEvidence.includes(f.proof):a?.evidence.includes(f.proof))?[EXPEDITION_PROOFS[f.proof]]:[]),
    ...((s.economy!.modern?.power??0)<f.power?[`副本需要${f.power}电，尚未包含工厂与服务用电`]:[]),
    ...f.services.filter(id=>!modernOnline(s,id)).map(id=>id==='N08'?'无线调度本季未在线':'数字控制本季未在线'),
    ...(f.clean&&!['E01','E03'].some(id=>s.economy!.modern!.operated[id]===s.clock.absoluteTurn)?['需要本季水电或光伏实际发电']:[])];
}
export function arriveExpeditions(s:GameState,events:GameEvent[]):void{
  for(const[id,a]of Object.entries(s.economy?.expeditions?.attempts??{})){
    const due=a.shipments.filter(x=>x.due<=s.clock.absoluteTurn);a.shipments=a.shipments.filter(x=>x.due>s.clock.absoluteTurn);
    for(const shipment of due){for(const[g,n]of Object.entries(shipment.goods))a.stock[g]=(a.stock[g]??0)+n;expeditionEvent(events,id,'arrived','副本物资到场',shipment.goods);}
    a.evidenceTurn=s.clock.absoluteTurn;a.seasonEvidence=[];
  }
}
export function recordExpeditionEvidence(s:GameState,events:GameEvent[]):void{
  const x=s.economy?.expeditions;if(!x)return;
  const a=x.selected?x.attempts[x.selected]:undefined;
  if(a&&a.active&&!a.completed&&a.evidenceTurn!==s.clock.absoluteTurn){a.seasonEvidence=[];a.evidenceTurn=s.clock.absoluteTurn;}
  const add=(id:string)=>{
    if(s.economy!.lineage){x.generationProofs??=[];if(!x.generationProofs.includes(id))x.generationProofs.push(id);}
    if(!a?.active||a.completed)return;
    if(!a.evidence.includes(id))a.evidence.push(id);if(!a.seasonEvidence.includes(id))a.seasonEvidence.push(id);
  };
  for(const e of events){
    if(e.type==='economy-farm'&&e.operation==='harvest'&&['wheat','soy'].includes(e.crop)&&e.amount>0)add('harvest');
    if(e.type==='economy-process'&&e.stage==='complete'){
      if(['ceramics','brick'].includes(e.recipe))add('kiln');
      if(['shaft','valve'].includes(e.recipe))add('mechanical');
      if(e.recipe==='seal')add('seal');
      if(['wire','coil'].includes(e.recipe))add('electrical');
      if(['circuit','controller'].includes(e.recipe)&&e.actor!=='本人')add('delegated-electronics');
      if(e.recipe==='controller'&&e.actor!=='本人')add('delegated-control');
    }
  }
}
export function applyGenerationProof(s:GameState,f:ExpeditionSpec):void{
  const x=s.economy?.expeditions;if(!s.economy?.lineage||!x||f.eachSeason)return;
  const a=x.attempts[f.id];if(!a||a.completed)return;
  if(x.generationProofs?.includes(f.proof)&&!a.evidence.includes(f.proof))a.evidence.push(f.proof);
}
export function settleExpeditions(s:GameState,_r:Ruleset,events:GameEvent[]):void{
  const x=s.economy?.expeditions;if(!x?.selected)return;const f=expeditionCatalog(s).find(f=>f.id===x.selected)!,a=x.attempts[f.id];if(a.completed)return;
  const season=events.find(e=>e.type==='season-settled'),blockers=expeditionBlockers(s,f);
  if(season?.type!=='season-settled'||season.missing)blockers.unshift('家庭本季缺粮，副本让位于生活');
  if(blockers.length){if(f.clean&&a.progress){a.progress=0;expeditionEvent(events,f.id,'interrupted','连续验证中断，已耗物资不返还');}if(a.active)expeditionEvent(events,f.id,'waiting',blockers.join('；'));return;}
  for(const[id,n]of Object.entries(f.kit))a.stock[id]-=n;
  if(f.power)usePower(s,f.power,events,f.name);
  a.progress++;expeditionEvent(events,f.id,'progress',`完成有效季 ${a.progress}/${f.seasons}`,f.kit);
  if(a.progress<f.seasons)return;
  // 完成标志和奖励在同一事务内持久化。不存在单独的可重复领奖接口。
  a.completed=true;a.active=false;
  const reward=f.reward;changeGoods(s,reward.goods,1,events,f.name+'首次完成奖励');s.household.money+=reward.money;
  for(const book of reward.books)if(!s.economy!.shop!.books.includes(book))s.economy!.shop!.books.push(book);
  x.supplyLevel=Math.max(x.supplyLevel,reward.supplyLevel);
  expeditionEvent(events,f.id,'reward',`${f.name}首次完成：获得物资、${reward.money}钱、教材及最高${x.supplyLevel}阶供应。教材仍需逐阶学习。`,reward.goods,reward.money,reward.books);
}
export function expeditionView(s:GameState){
  const x=s.economy!.expeditions!;
  return {...structuredClone(x),lineage:!!s.economy!.lineage,catalog:expeditionCatalog(s).map(f=>({...structuredClone(f),proofName:EXPEDITION_PROOFS[f.proof],bookNames:f.reward.books.map(id=>ALL_TOPICS.find(t=>t.id===id)!.name),entryBlockers:requirements(s,f.requires),blockers:expeditionBlockers(s,f)}))};
}
