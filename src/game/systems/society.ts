import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import type { CraftMaterial } from '../model/society.js';

export function contractBlocker(state: GameState, rules: Ruleset, material: CraftMaterial): string {
  const s = state.society!, local = state.production!, config = rules.socialInheritance!, p = rules.production!.parameters;
  const contract = s.contracts[material];
  if (!contract.active) return '未委托（暂停时在制品保留）';
  if (local.market[material] < 1 || s.goods[material] >= config.goodsCapacity) return '等待订单或公共库存空间';
  if (contract.project) return '';
  if (state.household.money < config.wage) return '钱财不足以支付开工工资';
  const wood = material === 'woodenware' ? p.woodRecipeCost : p.potteryFuelCost;
  if (local.stocks.timber < wood || material === 'pottery' && local.stocks.clay < p.potteryClayCost) return '当地原料不足';
  return '';
}

// 每季开工或完工一步；工匠劳动不占玩家行动，不产生个人学习记录。
export function settleSociety(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  if (!state.society || !rules.socialInheritance) return;
  const s = state.society, local = state.production!, p = rules.production!.parameters;
  for (const material of ['woodenware', 'pottery'] as const) {
    if (s.goods[material] > 0) { s.goods[material]--; events.push({ type: 'public-used', material, amount: 1 }); }
    const contract = s.contracts[material];
    if (!contract.active) continue;
    const reason = contractBlocker(state, rules, material);
    if (reason) { events.push({ type: 'contract-waiting', material, reason }); continue; }
    if (contract.project) {
      if (state.clock.absoluteTurn <= contract.project.started) continue;
      const amount = Math.min(contract.project.remaining, local.market[material], rules.socialInheritance.goodsCapacity - s.goods[material]);
      const earnings = amount * (material === 'woodenware' ? p.woodenwarePrice : p.potteryPrice);
      local.market[material] -= amount; s.goods[material] += amount; state.household.money += earnings;
      contract.project.remaining -= amount;
      if (contract.project.remaining === 0) contract.project = null;
      events.push({ type: 'contract-sold', material, amount, earnings });
    } else {
      const wood = material === 'woodenware' ? p.woodRecipeCost : p.potteryFuelCost;
      const clay = material === 'pottery' ? p.potteryClayCost : 0;
      local.stocks.timber -= wood; local.stocks.clay -= clay; state.household.money -= rules.socialInheritance.wage;
      contract.project = { started: state.clock.absoluteTurn, remaining: material === 'woodenware' ? 1 : 2 };
      events.push({ type: 'contract-started', material, wage: rules.socialInheritance.wage, wood, clay });
    }
  }
}
