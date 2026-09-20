import {sectCosts} from './life.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
import {publicWaterFee} from './eras.js';
import {foodStock,amount,changeGoods} from './inventory.js';
export const FOOD_POLICIES={off:'暂停自动购买',self:'自给优先',market:'市场生活',reserve:'保留储备'};
export function socialFoodEvent(events:GameEvent[],operation:string,detail:string,amount=0,money=0,time=0){events.push({type:'social-food',operation,detail,amount,money,time});}
export function renewSocialFood(s:GameState,events:GameEvent[]):void{
 const f=s.socialFood;if(!f)return;
 f.serviceRemaining=f.rules.serviceCapacity;
 if(s.clock.absoluteTurn===1)return;
 const incoming=Math.min(f.rules.imports,Math.max(0,f.rules.storage-s.production!.market.food));
 s.production!.market.food+=incoming;
 socialFoodEvent(events,'arrived',`外部食品供应商到货${incoming}份，地区库存${s.production!.market.food}/${f.rules.storage}；本季服务人员可处理${f.serviceRemaining}份`,incoming);
}
export function socialFoodQuote(s:GameState,afterProduction=false,productionTime=0){
 const f=s.socialFood!,delivery=f.delivery||s.era?.index===3,stock=foodStock(s),available=s.production!.market.food;
 const target=f.foodPerSeason+(f.policy==='reserve'?f.reserve:0);
 // Market living buys ready meals first, preserving grain for production when possible.
 const need=f.policy==='off'?0:Math.max(0,target-(f.policy==='market'?s.household.food:stock));
 const funds=Math.max(0,Math.floor((s.household.money-(afterProduction?0:publicWaterFee(s)))/f.price)),cap=Math.floor(f.budget/f.price);
 const transport=s.economy!.shop!.transport;
 const quantity=Math.min(need,available,funds,cap,f.serviceRemaining,transport);
 const timeAvailable=Math.max(0,s.life!.timeRemaining-(afterProduction?0:productionTime));
 const time=quantity>0&&!delivery?sectCosts(s,'economy:food:pickup',{time:f.rules.pickupTime,energy:0}).time:0;
 const reasons:string[]=[];
 if(need>0){
  if(funds<need)reasons.push(`资金不足：需${need*f.price}钱，现有${s.household.money}`);
  if(cap<need)reasons.push(`采购预算不足：本季上限${f.budget}钱`);
  if(available<need)reasons.push(`市场缺货：需${need}份，现有${available}`);
  if(f.serviceRemaining<need)reasons.push(`社会服务人员额度不足：剩余${f.serviceRemaining}份`);
  if(transport<need)reasons.push(`运输不足：共享采购运输剩余${transport}份`);
  if(time>timeAvailable)reasons.push(`赶集时间不足：需${time}，扣除生产任务后可用${timeAvailable}`);
 }
 const purchase=time<=timeAvailable?quantity:0;
 return {policy:f.policy,policyName:FOOD_POLICIES[f.policy],delivery,budget:f.budget,reserve:f.reserve,price:f.price,foodPerSeason:f.foodPerSeason,householdStock:stock,marketStock:available,storage:f.rules.storage,scheduledImports:f.rules.imports,serviceRemaining:f.serviceRemaining,transport,need,purchase,cost:purchase*f.price,time:purchase?time:0,missing:Math.max(0,f.foodPerSeason-stock-purchase),expectedReserve:Math.max(0,stock+purchase-f.foodPerSeason),reasons,source:'外部地区食品供应商定额到货；集镇人员办理采购配送，与商城即食口粮共用库存和运输。'};
}
// This is a forecast, not a debit. It is included in the shared personal labor budget.
export function foodLabor(s:GameState,productionTime=0):{time:number;energy:number}{
 if(!s.socialFood)return {time:0,energy:0};
 const q=socialFoodQuote(s,false,productionTime);
 return {time:q.purchase>0?q.time:0,energy:0};
}
export function settleSocialFood(s:GameState,events:GameEvent[]):void{
 const f=s.socialFood;if(!f)return;
 const q=socialFoodQuote(s,true);
 if(q.purchase){
  s.household.money-=q.cost;s.household.food+=q.purchase;s.production!.market.food-=q.purchase;
  s.economy!.shop!.transport-=q.purchase;f.serviceRemaining-=q.purchase;s.life!.timeRemaining=Math.round((s.life!.timeRemaining-q.time)*100)/100;
  events.push({type:'food-purchased',amount:q.purchase,money:q.cost});
  socialFoodEvent(events,'purchased',`${q.policyName}：${q.delivery?'社会人员配送':'本人赶集'}${q.purchase}份食品，支付${q.cost}钱${q.time?'，耗时'+q.time:''}`,q.purchase,q.cost,q.time);
 }
 // Existing grain remains a fallback even in market mode. One food conversion authority in v21.
 let need=Math.max(0,f.foodPerSeason-s.household.food);
 for(const id of ['flour','wheat','soy']){const n=Math.min(need,amount(s,id));if(n){changeGoods(s,{[id]:n},-1,events,'家庭生活取粮');s.household.food+=n;need-=n;}}
 if(q.reasons.length)socialFoodEvent(events,'shortfall',q.reasons.join('；')+`；预计生活缺口${Math.max(0,f.foodPerSeason-s.household.food)}份`);
}
