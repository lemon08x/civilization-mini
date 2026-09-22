import { quoteReservedLabor } from '../systems/labor.js';
import { branchActionNeeds } from '../systems/branches.js';
import { activePerson } from '../model/state.js';
import { lifeCost, sectCosts, calendarCost } from '../systems/life.js';
import { parseActionId } from '../model/action.js';
import type { ActionCost, ActionOffer } from '../model/action.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { MATERIAL_NAMES } from '../model/production.js';
import type { Material } from '../model/production.js';

export interface ActionDefinition { prepare?: (draft:GameState, events:GameEvent[])=>void; offer: ActionOffer; execute: (draft: GameState, events: GameEvent[]) => void }
export function defineAction(state: GameState, id: string, label: string, group: string, costs: Partial<ActionCost>, blockers: string[], description: string, execute: ActionDefinition['execute']): ActionDefinition {
  const { ap: requestedAp = 1, money = 0, food = 0 } = costs;
  const ap=state.life?0:requestedAp;
  const baseLife=state.life?lifeCost(state,id,requestedAp):undefined;
  const quoted=baseLife?{time:costs.time??baseLife.time,energy:costs.energy??baseLife.energy}:undefined;
  const life=quoted?calendarCost(state,id,state.life?.calendar&&['branchlearn','farmproject','farmexplore','farmreclaim','wait','diet','cook'].includes(id.split(':')[1])?quoted:sectCosts(state,id,quoted)):undefined;
  const reasons = [...blockers.map(reason=>state.economy?.branches?reason.replace(/需生产组织第?1阶或家族记录/g,'需掌握劳动分工').replace(/需生产组织第?2阶或家族记录/g,'需掌握生产工序').replace(/需生产组织第?3阶或家族记录/g,'需掌握采购与交付'):reason),...branchActionNeeds(state,id)];
  // Quote on an isolated draft: farming changes water demand; income, purchases and
  // household policies change shopping demand. Never mutate the real state or advance a season.
  const reserved=quoteReservedLabor(state,id,{money,food},reasons,execute);
  if(life){
    if(state.life?.calendar&&!['wait','rest','end','erasettle'].includes(id.split(':')[1])&&life.time>0&&(reserved.foodDays??0)<life.time+reserved.time)reasons.push(`饮食不足以支持这段工作：现有食材、柴火与干粮可支持${reserved.foodDays??0}天；先补给，或缩短研习安排`);
    if(id.split(':')[1]!=='wait'&&life.time>0&&state.life!.timeRemaining-reserved.time<life.time)reasons.push(`时间不足：剩余${state.life!.timeRemaining}，行动需${life.time}，行动后劳动预留${reserved.time}，可用${Math.max(0,state.life!.timeRemaining-reserved.time)}`);
    if(life.energy>0&&activePerson(state).vitality!.energy-reserved.energy<life.energy)reasons.push(`精力不足：剩余${activePerson(state).vitality!.energy}，行动需${life.energy}，行动后劳动预留${reserved.energy}；可休息或暂停系统`);
    if(state.life?.renewal)description+=` 行动耗费${life.time}${state.life?.calendar?'天':'时间'}／${life.energy}精力；行动后劳动预留${reserved.time}${state.life?.calendar?'天':'时间'}／${reserved.energy}精力（系统任务可暂停或改派，生活页可调整采购）。`;
  }
  if (state.ap < ap) reasons.push('行动点不足');
  if (state.household.money < money) reasons.push('钱财不足');
  if (state.household.food < food) reasons.push('口粮不足');
  for (const [material, amount] of Object.entries(costs.materials ?? {})) if ((state.production?.inventory[material as Material] ?? 0) < amount) reasons.push(`${MATERIAL_NAMES[material as Material]}不足`);
  return { offer: { id, action: parseActionId(id), label, group, ap, ...(life??{}), money, food, ...(costs.materials ? { materials: { ...costs.materials } } : {}), enabled: reasons.length === 0, reason: reasons.join('；'), description: life?description.replace(/(?:花|用)?1行动/g,'相应时间与精力').replace(/免(?:个人)?行动/g,'节省个人投入'):description }, execute };
}
