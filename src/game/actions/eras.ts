import {APPLIANCES} from '../model/electric.js';
import {usePower} from '../systems/modern.js';
import {equipped} from '../systems/economy.js';
import type {GameState} from '../model/state.js';
import {defineAction,type ActionDefinition} from './definition.js';
import {branchNeeds} from '../systems/branches.js';
import {amount,foodStock,changeGoods,missingGoods} from '../systems/economy.js';
import {ERAS} from '../model/eras.js';
import {eraEvent} from '../systems/eras.js';
export function eraActions(s:GameState):ActionDefinition[]{
 const e=s.era;if(!e)return [];const out:ActionDefinition[]=[];
 out.push(defineAction(s,'economy:erasettle:stage','结算当前社会并进入下一段','社会阶段',{ap:0},e.closed?['社会历程已结束']:[],'结束本季，按当前产能推算剩余时间并兑现本阶段回报。不要求建成水井或泵。现代阶段结算即结束旅程；家业试炼只影响胜负判定。',(d)=>{d.era!.pendingSettle=true;}));
 for(const on of [true,false])out.push(defineAction(s,'economy:tap:'+(on?'on':'off'),on?'接入家庭田自来水服务':'暂停自来水服务','社会阶段',{ap:0},[...(e.index!==3?['现代社会才提供公共自来水']:[]),...(e.tap===on?['已经是此安排']:[])],'每个确实缺水的季节支付1钱，由公共服务人员为家庭田补2水分。无需求不收费，无钱时保留自家供水退路。',(d,ev)=>{d.era!.tap=on;eraEvent(d,ev,'tap',on?'已接入自来水服务':'已暂停自来水服务');}));
 out.push(defineAction(s,'economy:publicmill:grain','使用公共磨坊','社会阶段',{time:1,energy:0,money:1},[
  ...(!ERAS[e.index].publicMill?['工业城镇以后才有公共磨坊']:[]),
  ...(amount(s,'wheat')<2?['需2小麦']:[]),
  ...(s.economy!.equipmentUsed.publicMill===s.clock.absoluteTurn?['本季已经用过公共磨坊']:[]),
 ],'社会提供的磨坊，不要求磨粮知识或设备。2小麦换1面粉，付1钱。每季一次。私人磨粮产量更高。',(d,ev)=>{changeGoods(d,{wheat:2},-1,ev,'公共磨坊');changeGoods(d,{flour:1},1,ev,'公共磨坊');d.economy!.equipmentUsed.publicMill=d.clock.absoluteTurn;eraEvent(d,ev,'public-mill','公共磨坊磨出1面粉',1,1);}));
 if(e.index!==3)return out;
 out.push(defineAction(s,'economy:dungeonstart:family','进入最终副本：跨代家业试炼','最终副本',{ap:0},e.dungeon.started?['已经进入副本']:[],`仅现代社会开放。不是离开现代的条件；完成副本并结算后才算旅程胜利。${s.electric?'v27 还需交付一次真实电力完成通电验收。':''}`,(d,ev)=>{d.era!.dungeon.started=true;eraEvent(d,ev,'dungeon-start','最终副本开始：为跨代家业工程提供真实供给或专业劳动');}));
 const options=[
  {id:'food',name:'交付4份家庭余粮',progress:1,time:2,energy:1,money:0,needs:foodStock(s)<s.socialFood!.foodPerSeason+4?['需4份余粮，并保留本季生活口粮']:[]},
  {id:'craft',name:'交付2根传动轴',progress:2,time:2,energy:1,money:0,needs:missingGoods(s,{shaft:2})},
  {id:'contract',name:'支付10钱委托专业施工',progress:1,time:2,energy:1,money:10,needs:[]},
  {id:'math',name:'完成一轮数学方案验算',progress:1,time:4,energy:2,money:0,needs:branchNeeds(s,['Q1','L0'])},
 ];
 if(s.electric){
  const r=s.electric.rules;
  options.push({id:'power',name:`交付${r.dungeonPower}电完成工程通电验收`,progress:r.powerProgress,time:2,energy:1,money:0,needs:[...branchNeeds(s,['L7']),...((s.economy!.modern?.power??0)<r.dungeonPower?[`需${r.dungeonPower}份可用电，将实际扣除`]:[])]});
  options.push({id:'appliance',name:'交付一台可用电器',progress:r.applianceProgress,time:2,energy:1,money:0,needs:APPLIANCES.some(id=>equipped(s,id)&&s.economy!.equipmentUsed[id]!==s.clock.absoluteTurn)?[]:['需本季未使用的可用电灯、电报终端或电解槽']});
 }
 for(const o of options)out.push(defineAction(s,'economy:dungeonwork:'+o.id,o.name,'最终副本',{time:o.time,energy:o.energy,money:o.money},[...(!e.dungeon.started?['先进入最终副本']:[]),...(e.dungeon.complete?['副本已完成，无需继续交付']:[]),...o.needs],`提供${o.progress}份工程进度，需达到${e.rules.dungeonTarget}份。${s.electric?'还须交付一次真实电力完成通电验收；电器按电灯、电报、电解槽顺序选择本季未使用的设备。':''}交付的商品真实移出家庭，专业施工由外部人员承担，数学验算是本人的工程劳动。`,(d,ev)=>{
  if(o.id==='food'){let need=4;const n=Math.min(need,d.household.food);d.household.food-=n;need-=n;for(const id of ['flour','wheat','soy']){const n=Math.min(need,amount(d,id));if(n)changeGoods(d,{[id]:n},-1,ev,'最终副本粮食交付');need-=n;}}
  if(o.id==='craft')changeGoods(d,{shaft:2},-1,ev,'最终副本部件交付');
  if(o.id==='power'){usePower(d,d.electric!.rules.dungeonPower,ev,'最终副本通电验收');d.era!.dungeon.powered=true;}
  if(o.id==='appliance'){const id=APPLIANCES.find(id=>equipped(d,id)&&d.economy!.equipmentUsed[id]!==d.clock.absoluteTurn)!;delete d.economy!.equipment[id];d.economy!.modern!.enabled=d.economy!.modern!.enabled.filter(x=>x!==id);eraEvent(d,ev,'appliance-delivered',`交付${id}，家庭不再持有该设备`);}
  const task=d.era!.dungeon;task.progress=Math.min(d.era!.rules.dungeonTarget,task.progress+o.progress);task.complete=task.progress>=d.era!.rules.dungeonTarget&&(!d.electric||!!task.powered);
  eraEvent(d,ev,'dungeon-work',`${o.name}：工程进度${task.progress}/${d.era!.rules.dungeonTarget}${task.complete?'，副本已完成。主动结算后若副本完成则旅程胜利':''}`,o.progress,o.money);
 }));
 return out;
}
