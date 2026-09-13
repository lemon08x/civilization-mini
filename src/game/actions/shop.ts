import { topicsFor,productsFor } from '../systems/economy-catalog.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { WorkerKind } from '../model/economy.js';
import { WORKER_NAMES } from '../systems/economy-catalog.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';
import { shopCatalog,cartQuote,deliverShop,deviceBusy,servicePending,repairPrice,shopEvent } from '../systems/shop.js';
export function shopActions(s:GameState,r:Ruleset):ActionDefinition[]{
 const e=s.economy!,sh=e.shop!,out:ActionDefinition[]=[];
 const add=(op:string,target:string,label:string,cost:Parameters<typeof defineAction>[4],blockers:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${target}`,label,'商城',cost,blockers,description,execute));
 const quote=cartQuote(s,r);
 const final=s.clock.generation>=r.parameters.generations&&s.clock.turn>=r.parameters.turnsPerGeneration;
 for(const item of shopCatalog(s,r)){
  const quantity=sh.cart[item.id]??0;
  add('cartadd',item.id,'加入'+item.name,{ap:0},[...(item.owned?['已拥有、在制或待交付']:[]),...(quantity>=item.stock?['已达到可购买库存']:[]),...(quote.weight+item.weight>r.shop!.transport?['整单超过单季最大运输容量']:[])],'只编辑采购清单；结账时按当时价格、库存和资金重新核验。',(draft,events)=>{draft.economy!.shop!.cart[item.id]=quantity+1;shopEvent(events,'cart',item.id,'已加入'+item.name);});
  add('cartremove',item.id,'移除一份'+item.name,{ap:0},quantity<1?['清单中没有此商品']:[],'移除一份，未付款。',(draft,events)=>{const c=draft.economy!.shop!.cart;if(quantity===1)delete c[item.id];else c[item.id]=quantity-1;shopEvent(events,'cart',item.id,'已移除'+item.name);});
 }
 add('clearcart','all','清空采购清单',{ap:0},quote.lines.length?[]:['清单为空'],'清单不保留价格或占用库存。',(draft,events)=>{draft.economy!.shop!.cart={};shopEvent(events,'cart','all','采购清单已清空');});
 add('checkout','cart','确认整单采购',{money:quote.total},quote.blockers,`合计${quote.total}钱、${quote.weight}运输容量，付款后剩${quote.remainingMoney}钱。现货立即交付，订货下一季开始交付；所有材料和食品都占运输额度。`,(draft,events)=>{
  const shop=draft.economy!.shop!;shop.transport-=quote.weight;
  for(const {item,quantity}of quote.lines){
   if(item.id==='good-food')draft.production!.market.food-=quantity;else shop.stock[item.id]-=quantity;
   const order={kind:item.kind,target:item.target,name:item.name,amount:quantity,due:draft.clock.absoluteTurn+1};
   shopEvent(events,'purchased',item.target,item.name+(item.local?'：本地现货':'：订货，下一季开始交付'),item.price*quantity,quantity);
   if(item.local)deliverShop(draft,r,order,events);else shop.orders.push(order);
  }
  shop.cart={};
 });
 for(const p of productsFor(s)){
  const durability=e.equipment[p.id];
  add('repair',p.id,'维修'+p.name,{money:repairPrice(s,r,p.id)},[
   ...(final?['最后一季无法完成维修']:[]),...(durability===undefined?['尚无设备']:[]),...(durability>=r.economy!.durability?['耐用度完整']:[]),
   ...(deviceBusy(s,p.id)?['设备有未完工项目']:[]),...(servicePending(s,'repair',p.id)||servicePending(s,'device',p.id)?['正在维修或等待交付']:[]),
   ...(e.equipmentUsed[p.id]===s.clock.absoluteTurn?['设备本季已加工，请次季送修']:[])
  ],'支付后本季停机，下一季开始恢复满耐用度；不增加理论或产出。',(draft,events)=>{draft.economy!.shop!.orders.push({kind:'repair',target:p.id,name:p.name+'维修',amount:1,due:draft.clock.absoluteTurn+1});shopEvent(events,'repair',p.id,'维修已预约，本季停机',repairPrice(s,r,p.id));});
 }
 for(const t of topicsFor(s)){
  const n=e.knowledge[s.household.activePersonId]?.[t.subject]??0;
  add('tuition',t.id,'授课：'+t.name,{money:r.shop!.lessonBase+t.level},[
   ...(n!==t.level-1?['只能学习本学科下一课题']:[]),...(t.level===1?['首阶可免费学习，无需购买授课']:[]),
   ...(t.level>2&&(e.regional.teaching[t.subject]??0)<t.level?['当地尚无对应教师；可订教材或自行研究']:[])
  ],'1行动完成当前课题学习，不需要另做研究；不会附送教材或家族记录。',(draft,events)=>{const person=draft.household.activePersonId;(draft.economy!.knowledge[person]??={})[t.subject]=t.level;events.push({type:'economy-learned',subject:t.subject,level:t.level,personId:person,source:'study'});shopEvent(events,'tuition',t.id,'已完成'+t.name+'授课',r.shop!.lessonBase+t.level);});
 }
 for(const kind of Object.keys(WORKER_NAMES) as WorkerKind[]){
  const w=e.workers[kind];
  add('paidtrain',kind,'委托培训'+WORKER_NAMES[kind],{money:r.shop!.trainingPrice},[
   ...(final?['最后一季无法完成培训']:[]),...(!w?['尚未招募']:[]),...(w&&w.experience>=8?['已达培训上限']:[]),...(w?.project?['先完成员工在制项目']:[]),...(servicePending(s,'training',kind)?['已在培训']:[])
  ],`本季停止工作、不扣工资；下一季开始经验+${r.shop!.trainingExperience}，上限8。培训不要求本人组织4阶。`,(draft,events)=>{draft.economy!.shop!.orders.push({kind:'training',target:kind,name:WORKER_NAMES[kind]+'培训',amount:1,due:draft.clock.absoluteTurn+1});shopEvent(events,'training',kind,'培训已安排，本季停工',r.shop!.trainingPrice);});
 }
 return out;
}
