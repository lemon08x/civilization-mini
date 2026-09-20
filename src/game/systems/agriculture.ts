import {sectCosts} from './life.js';
import { activePerson, type GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { Crop, Worker } from '../model/economy.js';
import { CROPS, WORKER_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import type { Ruleset } from '../ruleset.js';
import { level, recordEvidence, requirements, wage } from './knowledge.js';
import { branchHas } from './branches.js';
import { made } from './shop.js';

export function fieldYield(s: GameState): number {
  const f = s.economy!.field;
  if (!f.crop) return 0;
  const late = Math.max(0, f.growth - f.duration - (equipped(s, 'U04') ? 1 : 0));
  return Math.max(1, CROPS[f.crop].yield + f.bonus + (s.economy!.modern?.cropBonus ?? 0) + Math.min(1, f.fertility) - f.stress - late);
}
export function farmBlocker(s: GameState, crop: Crop, worker?: Worker): string[] {
  const f = s.economy!.field;
  if (s.economy!.branches) {
    if (crop === 'wheat' && !branchHas(s, 'A0') && !worker) return ['需掌握基础栽培'];
    if ((crop === 'soy' || crop === 'flax') && !branchHas(s, 'A4')) return ['需掌握油料与纤维作物'];
  }
  if (!f.crop) {
    if (worker?.kind === 'laborer' && worker.experience < 8) return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker ? [] : requirements(s, { agronomy: CROPS[crop].level })), ...missingGoods(s, { [CROPS[crop].seed]: 1 })];
  }
  if (f.growth >= f.duration) return [];
  if (f.tended === s.clock.absoluteTurn) return ['本季已管理田间'];
  if (s.location.rain + f.moisture >= 2) return ['本季水分充足，等待作物生长'];
  if (s.location.water < 1) return ['公共水不足'];
  return [];
}
export function farmWork(s: GameState, crop: Crop, events: GameEvent[], worker?: Worker): void {
  const e = s.economy!, f = e.field, actor = worker ? WORKER_NAMES[worker.kind] : '本人';
  if (!f.crop) {
    if (worker?.kind === 'farmer' && e.operations?.farm && f.fertility < 2 && amount(s, 'compost') > 0) {
      changeGoods(s, { compost: 1 }, -1, events, '农工托管施肥');
      f.fertility = Math.min(3, f.fertility + 1);
    }
    if (e.modern) e.modern.cropBonus = 0;
    const c = CROPS[crop];
    changeGoods(s, { [c.seed]: 1 }, -1, events, actor + '播种');
    let bonus = worker && worker.experience >= 8 ? 1 : 0;
    for (const id of (e.shop ? ['U01'] : ['U01', 'U02'])) if (equipped(s, id)) { bonus++; consumeEquipment(s, id, events); }
    if (e.shop && equipped(s, 'U02') && e.shop.seededTurn !== s.clock.absoluteTurn) {
      e.shop.seededTurn = s.clock.absoluteTurn;
      consumeEquipment(s, 'U02', events);
    }
    if (level(s, 'agronomy') >= 6 && f.lastCrop && f.lastCrop !== crop) bonus++;
    let duration = c.duration;
    if (equipped(s, 'U10')) { duration = Math.max(1, duration - 1); consumeEquipment(s, 'U10', events); }
    Object.assign(f, { crop, planted: s.clock.absoluteTurn, moisture: 0, growth: 0, stress: 0, tended: 0, composted: false, bonus, duration });
    events.push({ type: 'economy-farm', operation: 'sow', crop, actor, amount: 0 });
  } else if (f.growth >= f.duration) {
    const c = CROPS[f.crop], n = fieldYield(s), out: Record<string, number> = { [f.crop]: n, straw: c.straw, [c.seed]: 1 };
    if (level(s, 'agronomy') >= 5) out[c.seed]++;
    changeGoods(s, out, 1, events, actor + '收获');
    made(s, f.crop);
    if (equipped(s, 'U04')) consumeEquipment(s, 'U04', events);
    events.push({ type: 'economy-farm', operation: 'harvest', crop: f.crop, actor, amount: n });
    f.fertility = Math.max(0, Math.min(3, f.fertility + (f.crop === 'soy' ? 1 : -1)));
    f.lastCrop = f.crop;
    f.crop = null;
  } else {
    s.location.water--;
    f.moisture += equipped(s, 'W01') ? 2 : 1;
    if (equipped(s, 'W01')) consumeEquipment(s, 'W01', events);
    f.tended = s.clock.absoluteTurn;
    events.push({ type: 'economy-farm', operation: 'tend', crop: f.crop, actor, amount: 1 });
  }
  if (!worker) recordEvidence(s, 'agronomy', events, '田间实践');
}
export function farmCycleLabor(s: GameState) {
  const crop = s.economy?.ongoing?.farm;
  if (!crop || !s.life || s.economy!.workers.farmer?.active) return { time: 0, energy: 0 };
  const {time:t,energy}=sectCosts(s,'economy:farm:cycle',{time:s.life.renewal?.farmTime??3,energy:s.life.renewal?.farmEnergy??2}), f = s.economy!.field;
  if (f.crop && f.growth >= f.duration - 1) return { time: t * 2, energy: energy * 2 };
  if (!f.crop) return { time: t, energy };
  return { time: 0, energy: 0 };
}
export function settleOngoingFarm(s: GameState, rules: Ruleset, events: GameEvent[]): void {
  const crop = s.economy?.ongoing?.farm;
  if (!crop) return;
  const f = s.economy!.field, farmer = s.economy!.workers.farmer?.active ? s.economy!.workers.farmer : undefined;
  const {time:t,energy:en}=sectCosts(s,'economy:farm:cycle',{time:s.life?.renewal?.farmTime??3,energy:s.life?.renewal?.farmEnergy??2});
  const pay = (op: string) => {
    if (farmer) {
      const cost = wage(s, rules, farmer);
      if (s.household.money < cost) {
        events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: WORKER_NAMES.farmer, amount: 0 });
        return false;
      }
      s.household.money -= cost;
      events.push({ type: 'economy-worker', worker: 'farmer', operation: 'worked', money: cost, detail: '持续耕作' + op });
      return true;
    }
    if (!s.life || s.life.timeRemaining < t || activePerson(s).vitality!.energy < en) {
      events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: '本人', amount: 0 });
      return false;
    }
    s.life.timeRemaining = Math.round((s.life.timeRemaining-t)*100)/100;
    activePerson(s).vitality!.energy = Math.round((activePerson(s).vitality!.energy-en)*100)/100;
    return true;
  };
  if (f.crop && f.growth >= f.duration) { if (!pay('收获')) return; farmWork(s, f.crop, events, farmer); }
  if (!f.crop) {
    if (amount(s, CROPS[crop].seed) < 1) {
      events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: farmer ? WORKER_NAMES.farmer : '本人', amount: 0 });
      return;
    }
    if (!pay('播种')) return;
    farmWork(s, crop, events, farmer);
  }
}
