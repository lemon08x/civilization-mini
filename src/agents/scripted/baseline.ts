import {chooseEconomyAction} from './economy.js';
import type { SessionObservation } from '../../runtime/session.js';
import type { Agent, PolicyId } from '../contract.js';
import { chooseProductionAction } from './production.js';
// 可解释的脚本对照组。不是大模型，不读取种子、RNG 或未来天气。
export function chooseAction(observation: SessionObservation, policy: PolicyId = 'subsistence'): string | null {
  if(observation.game.economy)return chooseEconomyAction(observation,policy);
  if (!observation.game.production && ['woodworker', 'potter', 'mixed'].includes(policy)) throw new Error('非农生产脚本需要通用生产规则 0.2.0');
  if (observation.game.production && ['subsistence', 'woodworker', 'potter', 'mixed'].includes(policy)) return chooseProductionAction(observation, policy);
  const selected = chooseAgricultureAction(observation, policy);
  if (!observation.game.production || observation.game.actions.some(a => a.id === selected && a.enabled)) return selected;
  return chooseProductionAction(observation, 'mixed');
}
function chooseAgricultureAction(observation: SessionObservation, policy: PolicyId): string | null {
  const o = observation.game;
  const byId = (id: string) => o.actions.find(a => a.id === id);
  const legal = (id: string) => byId(id)?.enabled;
  const tech = (id: string) => o.technologies.find(t => t.id === id);
  const mastered = (id: string) => o.person.mastered.includes(id);
  if (legal('handover')) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;

  function acquire(id: string): string | null {
    const action = byId(id);
    if (action?.enabled) return id;
    if (action && o.ap >= action.ap) {
      if (o.family.food < action.food) return legal('cultivate') && o.harvest.food > 0 ? 'cultivate' : legal('buy-food') ? 'buy-food' : 'work';
      if (o.family.money < action.money) return 'work';
    }
    return null;
  }

  // 安全底线只看当前可见天气与库存，不会预知下一季。
  if (o.family.food < o.parameters.foodPerTurn) {
    if (legal('cultivate') && o.harvest.food > 0) return 'cultivate';
    if (legal('buy-food')) return 'buy-food';
    if (legal('work')) return 'work';
  }
  if (legal('cultivate') && ((o.harvest.food >= 2 && o.family.food <= o.parameters.foodPerTurn + 3) || o.family.project)) return 'cultivate';

  function learn(id: string): string | null {
    const node = tech(id);
    if (!node || node.mastered) return null;
    for (const parent of node.prerequisites) {
      if (!mastered(parent)) return learn(parent);
    }
    if (node.studied < node.required) return acquire(`study:${id}`);
    const missing = node.practices.find(tag => !node.practicesDone.includes(tag));
    if (missing === 'cultivation') return acquire('cultivate');
    if (missing === 'trial-completed') {
      if (!o.family.candidate) return acquire('prepare-seed');
      if (!o.family.project) return acquire('start-trial');
      return legal('cultivate') ? 'cultivate' : 'end-turn';
    }
    if (missing === 'stock-release') {
      const samples = o.family.reports.at(-1)?.samples ?? [];
      const difference = samples.reduce((sum, sample) => sum + sample.candidate - sample.control, 0);
      return acquire(`release:${difference > 0 ? 'adopt' : 'keep'}`);
    }
    if (missing === 'water-plan' && !((o.family.channel?.durability ?? 0) > 0)) return acquire(o.family.channel ? 'repair-channel' : 'build-channel');
    return missing ? acquire(`practice:${id}:${missing}`) : null;
  }

  if (policy === 'irrigation' || policy === 'legacy') {
    const target = learn('ditch');
    if (target) return target;
    if (!o.family.channel) { const action = acquire('build-channel'); if (action) return action; }
    if (o.family.channel?.durability === 0 && o.world.rain < 2) { const action = acquire('repair-channel'); if (action) return action; }
    if (policy === 'irrigation') { const action = learn('allocation'); if (action) return action; }
  }
  if (policy === 'seed') {
    const target = learn('stabilize');
    if (target) return target;
  }
  if (policy !== 'subsistence' && o.clock.generation < o.clock.generations) {
    for (const node of o.technologies) {
      if (mastered(node.id) && !o.heir.mastered.includes(node.id) && legal(`teach:${node.id}`)) return `teach:${node.id}`;
    }
    if (policy === 'legacy') {
      for (const node of o.technologies) {
        if (mastered(node.id) && !node.archived) {
          const action = acquire(`archive:${node.id}`); if (action) return action;
        }
      }
    }
  }
  if (legal('cultivate') && o.harvest.food > 0 && o.family.food < 10) return 'cultivate';
  return legal('work') ? 'work' : 'end-turn';
}

export function scriptedAgent(id: PolicyId): Agent {
  return { id, kind: 'scripted', decide(observation) {
    const actionId = chooseAction(observation, id);
    return actionId ? { revision: observation.revision, actionId, reason: `scripted:${id}` } : null;
  } };
}
