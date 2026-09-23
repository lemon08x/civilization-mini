import {farmTasks} from '../systems/farm-calendar.js';
import {availableDays} from '../systems/calendar.js';
import { quoteReservedLabor } from '../systems/labor.js';
import { branchActionNeeds } from '../systems/branches.js';
import { activePerson } from '../model/state.js';
import { lifeCost, sectCosts, calendarCost } from '../systems/life.js';
import { HOME_PLOT, shedCovers } from '../systems/agriculture.js';
import { parseActionId } from '../model/action.js';
import type { ActionCost, ActionOffer } from '../model/action.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { MATERIAL_NAMES } from '../model/production.js';
import type { Material } from '../model/production.js';

export interface ActionDefinition { deferred?:boolean; prepare?: (draft:GameState, events:GameEvent[])=>void; offer: ActionOffer; execute: (draft: GameState, events:GameEvent[]) => void }
// Sheds halve the base time of sow/tend/harvest work on fields within Chebyshev distance 2.
function shedCoversPlot(state:GameState,id:string):boolean {
  const op=id.split(':')[1];if(op!=='farm'&&op!=='farmplot'&&op!=='farmrare')return false;
  const plots=state.economy?.farm?.plots;if(!plots)return false;
  const plot=plots[op==='farm'?HOME_PLOT:id.split(':')[2]?.split('-')[0]??''];
  return !!plot&&shedCovers(state,plot);
}
export function defineAction(state: GameState, id: string, label: string, group: string, costs: Partial<ActionCost>, blockers: string[], description: string, execute: ActionDefinition['execute']): ActionDefinition {
  const { ap: requestedAp = 1, money = 0, food = 0 } = costs;
  const ap=state.life?0:requestedAp;
  const baseLife=state.life?lifeCost(state,id,requestedAp):undefined;
  let quoted=baseLife?{time:costs.time??baseLife.time,energy:costs.energy??baseLife.energy}:undefined;
  let life=quoted?calendarCost(state,id,state.life?.calendar&&['branchlearn','farmproject','farmexplore','farmreclaim','wait','diet','cook','wildharvest'].includes(id.split(':')[1])?quoted:sectCosts(state,id,quoted)):undefined;
  if(life&&life.time>0&&shedCoversPlot(state,id)){life={...life,time:Math.max(0.5,Math.ceil(life.time)/2)};description+=' 窝棚覆盖：农活时间减半，最低半天。';}

  if(life&&life.time>0&&state.economy?.farm&&state.life?.calendar){const now=state.life.calendar.absoluteDay;const crossed=farmTasks(state).filter(t=>t.deadline>now&&t.deadline<=now+life!.time);if(crossed.length)description+=' 此行动将跨过农时截止：'+crossed.map(t=>t.name).join('、')+'。';}
  const reasons = [...new Set([...blockers.map(reason=>state.economy?.branches?reason.replace(/需生产组织第?1阶或家族记录/g,'需掌握劳动分工').replace(/需生产组织第?2阶或家族记录/g,'需掌握生产工序').replace(/需生产组织第?3阶或家族记录/g,'需掌握采购与交付'):reason),...branchActionNeeds(state,id)])];
  // Quote on an isolated draft: farming changes water demand; income, purchases and
  // household policies change shopping demand. Never mutate the real state or advance a season.
  const reserved=quoteReservedLabor(state,id,{money,food},reasons,execute);
  if(life){
    if(state.life?.calendar&&!['wait','rest','end','erasettle'].includes(id.split(':')[1])&&life.time>0&&(reserved.foodDays??0)<life.time+reserved.time)reasons.push(`饮食不足以支持这段工作：现有食材、柴火与干粮可支持${reserved.foodDays??0}天；先补给，或缩短研习安排`);
    if(id.split(':')[1]!=='wait'&&life.time>0&&availableDays(state)-reserved.time<life.time)reasons.push(`时间不足：剩余${availableDays(state)}，行动需${life.time}，行动后劳动预留${reserved.time}，可用${Math.max(0,availableDays(state)-reserved.time)}`);
    if(life.energy>0&&activePerson(state).vitality!.energy-reserved.energy<life.energy)reasons.push(`精力不足：剩余${activePerson(state).vitality!.energy}，行动需${life.energy}，行动后劳动预留${reserved.energy}；可休息或暂停系统`);
    if(state.life?.renewal)description+=` 行动耗费${life.time}${state.life?.calendar?'天':'时间'}／${life.energy}精力；行动后劳动预留${reserved.time}${state.life?.calendar?'天':'时间'}／${reserved.energy}精力（系统任务可暂停或改派，生活页可调整采购）。`;
  }
  if (state.ap < ap) reasons.push('行动点不足');
  if (state.household.money < money) reasons.push('钱财不足');
  if (state.household.food < food) reasons.push('口粮不足');
  for (const [material, amount] of Object.entries(costs.materials ?? {})) if ((state.production?.inventory[material as Material] ?? 0) < amount) reasons.push(`${MATERIAL_NAMES[material as Material]}不足`);
  if(state.life?.calendar){const period=(text:string)=>text.replaceAll('季末','经营周期到期时').replaceAll('每季','每90天经营周期').replaceAll('本季','本轮经营周期').replaceAll('次季','下一经营周期');label=period(label);description=period(description);for(let i=0;i<reasons.length;i++)reasons[i]=period(reasons[i]);}
  return { offer: { id, action: parseActionId(id), label, group, ap, ...(life??{}), money, food, ...(costs.materials ? { materials: { ...costs.materials } } : {}), enabled: reasons.length === 0, reason: reasons.join('；'), description: life?description.replace(/(?:花|用)?1行动/g,'相应时间与精力').replace(/免(?:个人)?行动/g,'节省个人投入'):description }, execute };
}
