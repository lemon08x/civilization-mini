import { parseActionId } from '../model/action.js';
import { MATERIAL_NAMES } from '../model/production.js';
export function defineAction(state, id, label, group, costs, blockers, description, execute) {
    const { ap = 1, money = 0, food = 0 } = costs;
    const reasons = [...blockers];
    if (state.ap < ap)
        reasons.push('行动点不足');
    if (state.household.money < money)
        reasons.push('钱财不足');
    if (state.household.food < food)
        reasons.push('口粮不足');
    for (const [material, amount] of Object.entries(costs.materials ?? {}))
        if ((state.production?.inventory[material] ?? 0) < amount)
            reasons.push(`${MATERIAL_NAMES[material]}不足`);
    return { offer: { id, action: parseActionId(id), label, group, ap, money, food, ...(costs.materials ? { materials: { ...costs.materials } } : {}), enabled: reasons.length === 0, reason: reasons.join('；'), description }, execute };
}
