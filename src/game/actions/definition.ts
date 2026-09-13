import { reservedLabor } from '../systems/industry.js';
import { branchActionNeeds } from '../systems/branches.js';
import { activePerson } from '../model/state.js';
import { lifeCost } from '../systems/life.js';
import { parseActionId } from '../model/action.js';
import type { ActionCost, ActionOffer } from '../model/action.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { MATERIAL_NAMES } from '../model/production.js';
import type { Material } from '../model/production.js';

export interface ActionDefinition { offer: ActionOffer; execute: (draft: GameState, events: GameEvent[]) => void }
export function defineAction(state: GameState, id: string, label: string, group: string, costs: Partial<ActionCost>, blockers: string[], description: string, execute: ActionDefinition['execute']): ActionDefinition {
  const { ap: requestedAp = 1, money = 0, food = 0 } = costs;
  const ap=state.life?0:requestedAp;
  const baseLife=state.life?lifeCost(state,id,requestedAp):undefined;
  const life=baseLife?{time:costs.time??baseLife.time,energy:costs.energy??baseLife.energy}:undefined;
  const reserved=state.economy?.industry?reservedLabor(state):{time:0,energy:0};
  const reasons = [...blockers.map(reason=>state.economy?.branches?reason.replace(/需生产组织第?1阶或家族记录/g,'需掌握劳动分工').replace(/需生产组织第?2阶或家族记录/g,'需掌握生产工序').replace(/需生产组织第?3阶或家族记录/g,'需掌握采购与交付'):reason),...branchActionNeeds(state,id)];
  if(life){if(life.time>0&&state.life!.timeRemaining-reserved.time<life.time)reasons.push('本季时间不足（含系统预留）');if(life.energy>0&&activePerson(state).vitality!.energy-reserved.energy<life.energy)reasons.push('精力不足，请休息或结束本季');}
  if (state.ap < ap) reasons.push('行动点不足');
  if (state.household.money < money) reasons.push('钱财不足');
  if (state.household.food < food) reasons.push('口粮不足');
  for (const [material, amount] of Object.entries(costs.materials ?? {})) if ((state.production?.inventory[material as Material] ?? 0) < amount) reasons.push(`${MATERIAL_NAMES[material as Material]}不足`);
  return { offer: { id, action: parseActionId(id), label, group, ap, ...(life??{}), money, food, ...(costs.materials ? { materials: { ...costs.materials } } : {}), enabled: reasons.length === 0, reason: reasons.join('；'), description: life?description.replace(/(?:花|用)?1行动/g,'相应时间与精力').replace(/免(?:个人)?行动/g,'节省个人投入'):description }, execute };
}
