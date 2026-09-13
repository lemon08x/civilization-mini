import { activePerson, channel, project, stock } from '../model/state.js';
import { has } from './learning.js';
export function harvestPreview(state, rules, seed = stock(state)) {
    const storedDrawn = Math.min(state.productNetwork?.storedWater ?? 0, Math.max(0, 2 - state.location.rain));
    const shortage = Math.max(0, 2 - state.location.rain - storedDrawn);
    const available = (channel(state)?.durability ?? 0) > 0 ? state.location.water : 0;
    const efficiency = has(activePerson(state), 'allocation') ? 2 : 1;
    const drawn = Math.min(available, Math.ceil(shortage / efficiency));
    const deficit = Math.max(0, shortage - drawn * efficiency);
    const basic = Math.max(0, seed.potential - deficit * (2 - seed.tolerance));
    const gross = basic + Number(basic > 0 && (state.development?.fieldDurability ?? 0) > 0);
    const landCost = project(state) ? rules.parameters.trialLandCost : 0;
    return { ...(state.productNetwork ? { storedDrawn } : {}), gross, food: Math.max(0, gross - landCost), drawn, deficit, landCost };
}
