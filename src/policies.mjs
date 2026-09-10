// 可解释的脚本对照组。不是大模型，不读取种子、RNG 或未来天气。
export function chooseAction(observation, policy = 'subsistence') {
  const o = observation;
  const byId = id => o.actions.find(a => a.id === id);
  const legal = id => byId(id)?.enabled;
  const tech = id => o.technologies.find(t => t.id === id);
  const mastered = id => o.person.mastered.includes(id);
  if (legal('handover')) return 'handover';
  if (!o.actions.some(a => a.enabled)) return null;

  function acquire(id) {
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

  function learn(id) {
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
    if (missing === 'water-plan' && !(o.family.channel?.durability > 0)) return acquire(o.family.channel ? 'repair-channel' : 'build-channel');
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
