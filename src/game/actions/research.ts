import { activePerson, project } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { has, prerequisites, techById } from '../systems/learning.js';
import { prepareCandidate, selectStock, startTrial } from '../systems/projects.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';

export function researchActions(state: GameState, rules: Ruleset): ActionDefinition[] {
  const person = activePerson(state), family = state.household, p = rules.parameters;
  const actions = [
    defineAction(state, 'prepare-seed', '准备候选种源', '研究', { food: 1 }, [
      ...(!has(person, 'selection') ? ['需要掌握田间选种'] : []), ...(family.candidateId ? ['已经有候选种源'] : []), ...(state.knowledge.reportIds.length ? ['本实验的一组种源比较已经完成'] : []),
    ], '准备耐旱但丰水潜力较低的留选种源。是否值得替换，需要比较当地表现。', (draft, events) => prepareCandidate(draft, rules, events)),
    defineAction(state, 'start-trial', '启动比较试种', '研究', { money: p.trialCost }, [
      ...(!prerequisites(person, techById(rules, 'trial')) || (person.learning.trial ?? 0) < 1 ? ['需要选种基础并学习过对照试种'] : []), ...(!family.candidateId ? ['先准备候选种源'] : []), ...(project(state) ? ['已有试种项目'] : []), ...(state.knowledge.reportIds.length ? ['本轮候选试验已完成，先定选'] : []),
    ], `需要 ${p.trialSeasons} 个实际耕作季；每个耕作季少产 ${p.trialLandCost} 口粮，记录两种种源的同条件表现。`, startTrial),
  ];
  const canRelease = prerequisites(person, techById(rules, 'stabilize')) && (person.learning.stabilize ?? 0) >= 1;
  for (const decision of ['keep', 'adopt'] as const) actions.push(defineAction(state, `release:${decision}`, decision === 'keep' ? '定选：保留原种源' : '定选：采用候选种源', '研究', {}, [
    ...(!canRelease ? ['需要试种基础并学习过种源定选'] : []), ...(!state.knowledge.reportIds.length ? ['需要完整比较记录'] : []), ...(!family.candidateId ? ['没有待定选的种源'] : []),
  ], '这是选择适合本地的既有种源，不是宣称育成了新品种；比较记录不保证未来天气相同。', (draft, events) => selectStock(draft, decision, events)));
  return actions;
}
