import {APPLIANCES} from '../model/electric.js';
import {usePower} from '../systems/modern.js';
import {equipped} from '../systems/economy.js';
import type {GameState} from '../model/state.js';
import {defineAction,type ActionDefinition} from './definition.js';
import {branchNeeds} from '../systems/branches.js';
import {amount,foodStock,changeGoods,missingGoods} from '../systems/economy.js';
import {ERAS,DUNGEON_TASKS} from '../model/eras.js';
import {eraEvent} from '../systems/eras.js';
export function eraActions(s:GameState):ActionDefinition[]{
 const e=s.era;if(!e)return [];const out:ActionDefinition[]=[];
 out.push(defineAction(s,'economy:erasettle:stage','结算当前社会并进入下一段','社会阶段',{ap:0},e.closed?['社会历程已结束']:[],'结束本季，按当前产能推算剩余代际并兑现本阶段回报。进入下一时代时从刚成年的新随机人物开始，不延续上一时代亲属关系或个人知识；资产与公共记录保留。不要求建成水井或泵。现代社会不限代数，结算即结束旅程并按副本任务计分；家业试炼只影响胜负判定。',(d)=>{d.era!.pendingSettle=true;}));
 for(const on of [true,false])out.push(defineAction(s,'economy:tap:'+(on?'on':'off'),on?'接入家庭田自来水服务':'暂停自来水服务','社会阶段',{ap:0},[...(e.index!==3?['现代社会才提供公共自来水']:[]),...(e.tap===on?['已经是此安排']:[])],'每个确实缺水的季节支付1钱，由公共服务人员为家庭田补2水分。无需求不收费，无钱时保留自家供水退路。',(d,ev)=>{d.era!.tap=on;eraEvent(d,ev,'tap',on?'已接入自来水服务':'已暂停自来水服务');}));
 out.push(defineAction(s,'economy:publicmill:grain','使用公共磨坊','社会阶段',{time:1,energy:0,money:1},[
  ...(!ERAS[e.index].publicMill?['工业城镇以后才有公共磨坊']:[]),
  ...(amount(s,'wheat')<2?['需2小麦']:[]),
  ...(s.economy!.equipmentUsed.publicMill===s.clock.absoluteTurn?['本季已经用过公共磨坊']:[]),
 ],'社会提供的磨坊，不要求磨粮知识或设备。2小麦换1面粉，付1钱。每季一次。私人磨粮产量更高。',(d,ev)=>{changeGoods(d,{wheat:2},-1,ev,'公共磨坊');changeGoods(d,{flour:1},1,ev,'公共磨坊');d.economy!.equipmentUsed.publicMill=d.clock.absoluteTurn;eraEvent(d,ev,'public-mill','公共磨坊磨出1面粉',1,1);}));
 if(e.index!==3)return out;
 out.push(defineAction(s,'economy:dungeonstart:family','进入最终副本：跨代家业试炼','最终副本',{ap:0},e.dungeon.started?['已经进入副本']:[],`仅现代社会开放；现代不限代数，无超时提醒。副本由六个一次性任务组成，按任务分值计分，达标并结算后才算旅程胜利。${s.electric?'v27 还需交付一次真实电力完成通电验收。':''}`,(d,ev)=>{d.era!.dungeon.started=true;eraEvent(d,ev,'dungeon-start','最终副本开始：为跨代家业工程提供真实供给或专业劳动');}));
 const costs:Record<string,{time:number;energy:number;money:number;needs:string[]}>={
  food:{time:2,energy:1,money:0,needs:foodStock(s)<s.socialFood!.foodPerSeason+4?['需4份余粮，并保留本季生活口粮']:[]},
  craft:{time:2,energy:1,money:0,needs:missingGoods(s,{shaft:2})},
  contract:{time:2,energy:1,money:10,needs:[]},
  math:{time:4,energy:2,money:0,needs:branchNeeds(s,['Q1','L0'])},
 };
 if(s.electric){
  const r=s.electric.rules;
  costs.power={time:2,energy:1,money:0,needs:[...branchNeeds(s,['L7']),...((s.economy!.modern?.power??0)<r.dungeonPower?[`需${r.dungeonPower}份可用电，将实际扣除`]:[])]};
  costs.appliance={time:2,energy:1,money:0,needs:APPLIANCES.some(id=>equipped(s,id)&&s.economy!.equipmentUsed[id]!==s.clock.absoluteTurn)?[]:['需本季未使用的可用电灯、电报终端或电解槽']};
 }
 const tasks=DUNGEON_TASKS.filter(t=>s.electric||(t.id!=='power'&&t.id!=='appliance')).map(t=>{
  let name=t.name,progress=t.progress;
  if(s.electric){const r=s.electric.rules;if(t.id==='power'){name=`交付${r.dungeonPower}电完成工程通电验收`;progress=r.powerProgress;}if(t.id==='appliance')progress=r.applianceProgress;}
  return {...t,name,progress,...costs[t.id]};
 });
 const scoreOf=(ids:string[]):number=>ids.reduce((a,id)=>a+(tasks.find(t=>t.id===id)?.progress??0),0);
 for(const o of tasks)out.push(defineAction(s,'economy:dungeonwork:'+o.id,o.name,'最终副本',{time:o.time,energy:o.energy,money:o.money},[...(!e.dungeon.started?['先进入最终副本']:[]),...(e.dungeon.tasks.includes(o.id)?['该任务已完成']:[]),...o.needs],`一次性任务，完成后不可重复交付${s.electric?'；通电验收是胜利门槛':''}。本次记${o.progress}分，副本总分达到${e.rules.dungeonTarget}分即达标，超出为高分。交付的商品真实移出家庭，专业施工由外部人员承担，数学验算是本人的工程劳动。`,(d,ev)=>{
  if(o.id==='food'){let need=4;const n=Math.min(need,d.household.food);d.household.food-=n;need-=n;for(const id of ['flour','wheat','soy']){const n=Math.min(need,amount(d,id));if(n)changeGoods(d,{[id]:n},-1,ev,'最终副本粮食交付');need-=n;}}
  if(o.id==='craft')changeGoods(d,{shaft:2},-1,ev,'最终副本部件交付');
  if(o.id==='power'){usePower(d,d.electric!.rules.dungeonPower,ev,'最终副本通电验收');d.era!.dungeon.powered=true;}
  if(o.id==='appliance'){const id=APPLIANCES.find(id=>equipped(d,id)&&d.economy!.equipmentUsed[id]!==d.clock.absoluteTurn)!;delete d.economy!.equipment[id];d.economy!.modern!.enabled=d.economy!.modern!.enabled.filter(x=>x!==id);eraEvent(d,ev,'appliance-delivered',`交付${id}，家庭不再持有该设备`);}
  const dungeon=d.era!.dungeon;dungeon.tasks.push(o.id);
  const score=scoreOf(dungeon.tasks),target=d.era!.rules.dungeonTarget;
  const complete=(!d.electric||!!dungeon.powered)&&score>=target;
  eraEvent(d,ev,'dungeon-work',`${o.name}完成：副本总分${score}/${target}${complete?'，通电验收与总分达标，结算即旅程胜利':''}`,o.progress,o.money);
 }));
 return out;
}
