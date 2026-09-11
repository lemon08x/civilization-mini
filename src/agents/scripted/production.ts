import type { SessionObservation } from '../../runtime/session.js';
import type { PolicyId } from '../contract.js';

// 明确的脚本基线：木作/陶作家庭不耕作；只读取公开观察。
export function chooseProductionAction(observation: SessionObservation, policy: PolicyId): string | null {
  const o = observation.game, p = o.production!;
  const legal = (id: string) => o.actions.some(a => a.id === id && a.enabled);
  const first = (ids: string[]) => ids.find(legal) ?? null;
  const mastered = (id: string) => o.person.mastered.includes(id);
  if (legal('handover')) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;
  const nonfarm = policy === 'woodworker' || policy === 'potter';
  const food = () => first([
    ...(!nonfarm && o.harvest.food >= 2 ? ['cultivate'] : []),
    ...(p.gathering.food >= 2 ? ['gather:food'] : []), 'buy-food',
    ...(p.gathering.food > 0 ? ['gather:food'] : []), 'work', 'sell-good:woodenware', 'sell-good:pottery',
  ]);
  if (o.family.food < o.parameters.foodPerTurn) { const id = food(); if (id) return id; }
  if (policy === 'subsistence') return first([...(o.family.food < 6 && o.harvest.food > 0 ? ['cultivate'] : []), 'work', ...(o.family.food < 4 ? ['gather:food'] : []), 'end-turn']);
  const method = policy === 'potter' || policy === 'mixed' && !o.world.teachers.includes('woodworking') ? 'pottery' : 'woodworking';
  const learn = (id: string): string | null => {
    const tech = o.technologies.find(t => t.id === id)!;
    if (mastered(id)) return null;
    for (const parent of tech.prerequisites) if (!mastered(parent)) return learn(parent);
    if (!tech.accessible) return first([`buy-method:${id}`, 'work']);
    if (tech.studied < tech.required) return first([`study:${id}`]);
    if (id === 'controlled-fire') return first(['practice:controlled-fire:fire-tended', 'gather:wood']);
    return null;
  };
  if (p.project && legal('finish-craft')) return 'finish-craft';
  const learning = learn(method); if (learning) return learning;
  const material = method === 'pottery' ? 'pottery' : 'woodenware';
  if (mastered(method) && !p.storage[material]) {
    if (legal('study:storage')) return 'study:storage';
    if (legal(`install-storage:${material}`)) return `install-storage:${material}`;
  }
  // 留出第一件容器配置储存，后续商品交换获取口粮。
  if (p.inventory[material] > Number(!p.storage[material])) {
    const sale = first([`sell-good:${material}`]); if (sale) return sale;
  }
  if (o.clock.generation < o.clock.generations && mastered(method)) {
    const teachId = first([...(method === 'pottery' ? ['teach:controlled-fire'] : []), `teach:${method}`]);
    if (teachId) return teachId;
  }
  if (!p.project) {
    if (method === 'woodworking') {
      if (p.inventory.wood < p.parameters.woodRecipeCost) return first(['gather:wood', 'work', 'end-turn']);
      if (legal('craft:woodenware')) return 'craft:woodenware';
    } else {
      if (p.inventory.clay < p.parameters.potteryClayCost) { const id = first(['gather:clay']); if (id) return id; }
      if (p.inventory.wood < p.parameters.potteryFuelCost) { const id = first(['gather:wood']); if (id) return id; }
      if (legal('craft:pottery')) return 'craft:pottery';
    }
  }
  return first(['sell-good:woodenware', 'sell-good:pottery', 'work', ...(o.family.food < 4 ? [food() ?? 'end-turn'] : []), 'end-turn']);
}
