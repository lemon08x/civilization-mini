import { activePerson, addUnique, channel, heir } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { accessible, has, practice, prerequisites, study, studyRequired, teach, techById } from '../systems/learning.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';

export function educationActions(state: GameState, rules: Ruleset): ActionDefinition[] {
  const actions: ActionDefinition[] = [], person = activePerson(state), child = heir(state), p = rules.parameters;
  for (const tech of rules.technologies) {
    const progress = person.learning[tech.id] ?? 0, required = studyRequired(rules, person, tech, state.knowledge.archives);
    const missing = tech.prerequisites.filter(id => !has(person, id)).map(id => techById(rules, id).name);
    if (tech.prerequisiteAny && !tech.prerequisiteAny.some(id => has(person, id))) missing.push(`任选其一：${tech.prerequisiteAny.map(id => techById(rules, id).name).join(' / ')}`);
    const common = [...(!state.world.technologies.includes(tech.world) ? ['社会技术尚未开放'] : []), ...(missing.length ? [`缺少前置：${missing.join('、')}`] : [])];
    actions.push(defineAction(state, `study:${tech.id}`, `学习：${tech.name}`, '学习', { money: state.knowledge.archives.includes(tech.id) ? 0 : p.studyCost }, [
      ...common, ...(!accessible(state, tech) ? ['当地没有教师，家庭也无材料'] : []), ...(has(person, tech.id) ? ['已经掌握'] : []), ...(progress >= required ? ['学习次数已足够，需完成实践'] : []),
    ], `学习 ${progress}/${required}；实践：${tech.practices.map(tag => rules.practiceNames[tag]).join('、')}。${tech.benefit}`, (draft, events) => study(draft, tech.id, events)));
    for (const tag of tech.practices) {
      if (['cultivation', 'trial-completed', 'stock-release', 'wood-shaped', 'pot-fired', 'storage-fitted'].includes(tag)) continue;
      actions.push(defineAction(state, `practice:${tech.id}:${tag}`, `实践：${rules.practiceNames[tag]}`, '实践', { money: ['selection', 'resource-survey', 'fire-tended'].includes(tag) ? 0 : p.trainingCost, food: tag === 'selection' ? 1 : 0, ...(tag === 'fire-tended' ? { materials: { wood: 1 } } : {}) }, [
        ...common, ...(!accessible(state, tech) ? ['没有受指导实践渠道'] : []), ...(progress < 1 ? ['先完成一次学习'] : []), ...(person.practices.includes(tag) ? ['已完成该项实践'] : []), ...(tag === 'water-plan' && !((channel(state)?.durability ?? 0) > 0) ? ['需要可用引水渠'] : []),
      ], '受指导练习只获得具体实践记录，不凭空生成家庭生产设施。', (draft, events) => practice(draft, tech.id, tag, events)));
    }
    actions.push(defineAction(state, `archive:${tech.id}`, `留存方法：${tech.name}`, '传承', { money: p.archiveCost }, [...(!has(person, tech.id) ? ['自己尚未掌握'] : []), ...(state.knowledge.archives.includes(tech.id) ? ['已完整留存'] : [])], '以样具、图样和委托记录等抽象载体留存方法；只保留学习渠道，不复制个人掌握。', (draft, events) => { addUnique(draft.knowledge.archives, tech.id); events.push({ type: 'archived', nodeId: tech.id }); }));
    const heirMissing = !prerequisites(child, tech);
    const heirNeedsStudy = (child.learning[tech.id] ?? 0) < studyRequired(rules, child, tech, state.knowledge.archives);
    const heirPractice = tech.practices.find(tag => !child.practices.includes(tag));
    const teachingMaterials = !heirNeedsStudy && ['wood-shaped', 'fire-tended', 'pot-fired'].includes(heirPractice ?? '') ? { wood: 1, ...(heirPractice === 'pot-fired' ? { clay: 1 } : {}) } : undefined;
    actions.push(defineAction(state, `teach:${tech.id}`, `${heirNeedsStudy ? '教导' : '带后辈练习'}：${tech.name}`, '传承', teachingMaterials ? { materials: teachingMaterials } : {}, [
      ...(!has(person, tech.id) ? ['自己尚未掌握'] : []), ...(heirMissing ? ['后辈缺少前置基础'] : []), ...(has(child, tech.id) ? ['后辈已经掌握'] : []),
      ...(!heirNeedsStudy && heirPractice === 'trial-completed' && !state.knowledge.reportIds.length ? ['需要家庭试种记录供后辈复盘'] : []),
      ...(!heirNeedsStudy && heirPractice === 'water-plan' && !((channel(state)?.durability ?? 0) > 0) ? ['需要可用引水渠'] : []),
      ...(!heirNeedsStudy && heirPractice === 'storage-fitted' && !state.production?.storage.woodenware && !state.production?.storage.pottery ? ['需要已配置容器供后辈练习'] : []),
    ], heirNeedsStudy ? '投入一点行动，完成后辈的一次学习。' : '投入一点行动开展有指导的练习／项目复盘；不额外产生产品。', (draft, events) => teach(draft, tech.id, rules, events)));
  }
  return actions;
}
