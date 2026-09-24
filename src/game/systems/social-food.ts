import {availableDays} from './calendar.js';
import {activePerson} from '../model/state.js';
import {canSucceed,relaxationRate} from './life.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
import {publicWaterFee} from './eras.js';
import {foodStock,amount,changeGoods} from './inventory.js';
import {EDIBLE} from './economy-catalog.js';
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
export function socialFoodQuote(s:GameState,afterProduction=false,_productionTime=0){
 const f=s.socialFood!,delivery=f.delivery||s.era?.index===3,stock=s.life?.calendar?(dietView(s)?.days??0)*dailyFoodNeed(s):foodStock(s),available=s.production!.market.food;
 const demand=s.life?.calendar?dailyFoodNeed(s)*Math.min(7,availableDays(s)):f.foodPerSeason;
 const target=demand+(f.policy==='reserve'?f.reserve:0);
 // Market living buys ready meals first, preserving grain for production when possible.
 const need=f.policy==='off'?0:Math.max(0,target-(f.policy==='market'?s.household.food:stock));
 const funds=Math.max(0,Math.floor((s.household.money-(afterProduction?0:publicWaterFee(s)))/f.price)),cap=Math.floor(Math.max(0,f.budget-(s.life?.calendar?.purchaseSpent??0))/f.price);
 const transport=s.economy!.shop!.transport;
 const quantity=Math.min(s.life?.calendar?Math.ceil(need):need,available,funds,cap,f.serviceRemaining,transport);
 // Buying food never reserves or consumes personal labor.
 const time=0;
 const reasons:string[]=[];
 if(need>0){
  if(funds<need)reasons.push(`资金不足：需${need*f.price}钱，现有${s.household.money}`);
  if(cap<need)reasons.push(`采购预算不足：本季上限${f.budget}钱`);
  if(available<need)reasons.push(`市场缺货：需${need}份，现有${available}`);
  if(f.serviceRemaining<need)reasons.push(`社会服务人员额度不足：剩余${f.serviceRemaining}份`);
  if(transport<need)reasons.push(`运输不足：共享采购运输剩余${transport}份`);
 }
 const purchase=quantity;
 return {policy:f.policy,policyName:FOOD_POLICIES[f.policy],delivery,budget:f.budget,reserve:f.reserve,price:f.price,foodPerSeason:demand,householdStock:stock,marketStock:available,storage:f.rules.storage,scheduledImports:f.rules.imports,serviceRemaining:f.serviceRemaining,transport,need,purchase,cost:purchase*f.price,time:purchase?time:0,missing:Math.max(0,demand-stock-purchase),expectedReserve:Math.max(0,stock+purchase-demand),reasons,source:'外部地区食品供应商定额到货；集镇人员办理采购配送，与商城即食口粮共用库存和运输。'};
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
  s.household.money-=q.cost;s.household.food+=q.purchase;if(s.life?.calendar)s.life.calendar.purchaseSpent+=q.cost;s.production!.market.food-=q.purchase;
  s.economy!.shop!.transport-=q.purchase;f.serviceRemaining-=q.purchase;s.life!.timeRemaining=Math.round((s.life!.timeRemaining-q.time)*100)/100;
  events.push({type:'food-purchased',amount:q.purchase,money:q.cost});
  socialFoodEvent(events,'purchased',`${q.policyName}：${q.delivery?'社会人员配送':'本人赶集'}${q.purchase}份食品，支付${q.cost}钱${q.time?'，耗时'+q.time:''}`,q.purchase,q.cost,q.time);
 }
 if(s.life?.calendar)return;
 // Existing grain remains a fallback even in market mode. One food conversion authority in v21.
 let need=Math.max(0,f.foodPerSeason-s.household.food);
 for(const id of EDIBLE){const n=Math.min(need,amount(s,id));if(n){changeGoods(s,{[id]:n},-1,events,'家庭生活取粮');s.household.food+=n;need-=n;}}
 if(q.reasons.length)socialFoodEvent(events,'shortfall',q.reasons.join('；')+`；预计生活缺口${Math.max(0,f.foodPerSeason-s.household.food)}份`);
}

export function dailyFoodNeed(s:GameState):number {
 const c=s.life?.calendar;return c?Math.round(c.rules.grainPerDay*(c.diet==='hearty'?c.rules.heartyMultiplier:1)*1000000)/1000000:0;
}
export function dietView(s:GameState){
 const c=s.life?.calendar;if(!c)return undefined;
 const dry=s.household.food,grain=EDIBLE.reduce((n,k)=>n+amount(s,k),0);
 const daily=dailyFoodNeed(s),grainDays=grain/daily,woodDays=amount(s,'wood')/c.rules.woodPerDay;
 return {mode:c.diet,name:c.diet==='hearty'?'丰足饮食':'简单饮食',dailyGrain:daily,dailyWood:c.rules.woodPerDay,
  days:Math.floor((dry/daily+Math.min(grainDays,woodDays))*2+1e-8)/2,grainDays:Math.floor(grainDays),woodDays:Math.floor(woodDays),
  mealDays:c.mealDays,recovery:relaxationRate(s),
  description:'库存按批量干粮／食材计；每天自动取粮、生火做饭，现做现吃。种子不会被食用。'};
}
/** Daily meals have one consumption authority; seasonal settlement must not eat again. */
export function feedCalendar(s:GameState,days:number,events:GameEvent[]):boolean {
 const c=s.life!.calendar!,r=c.rules,round=(n:number)=>Math.round(n*1000000)/1000000;
 const need=dailyFoodNeed(s)*days;
 if(s.socialFood&&s.socialFood.policy!=='off'&&(s.socialFood.policy==='market'||(dietView(s)?.days??0)<days))settleSocialFood(s,events);
 let remaining=need;
 // Prepare today's meal from grain when fuel permits; dry rations are the fallback.
 let cooked=0;const fuelDays=amount(s,'wood')/r.woodPerDay;
 const grainLimit=Math.min(need,fuelDays*dailyFoodNeed(s));
 for(const id of EDIBLE){
  const n=Math.min(remaining,Math.max(0,grainLimit-cooked),amount(s,id));
  if(n>0){s.economy!.goods[id]=round(amount(s,id)-n);remaining=round(remaining-n);cooked+=n;}
 }
 if(cooked>0)s.economy!.goods.wood=round(Math.max(0,amount(s,'wood')-cooked/dailyFoodNeed(s)*r.woodPerDay));
 const dry=Math.min(s.household.food,remaining);s.household.food=round(s.household.food-dry);remaining=round(remaining-dry);
 c.consumed=round(c.consumed+need-remaining);c.missing=round(c.missing+remaining);
 const fed=remaining<=0,v=activePerson(s).vitality!;
 if(!fed) {v.health=Math.max(0,round(v.health-r.hungerDamagePerDay*days));if(v.health===0){v.alive=false;s.status=canSucceed(s)?'handover':'ended';events.push({type:'life',personId:s.household.activePersonId,operation:'death',detail:'饮食长期不足，健康耗尽；'+(s.status==='handover'?'成年弟子可接续':'无人可接续')});}}
 c.mealDays=Math.max(0,round(c.mealDays-days));
 return fed;
}
