import {eraActions} from './eras.js';
import {socialFoodActions} from './social-food.js';
import { industryActions } from './industry.js';
import {branchActionNeeds} from '../systems/branches.js';
import { branchActions } from './branches.js';
import { lifeActions } from './life.js';
import { economyActions } from './economy.js';
import { productNetworkActions } from './product-network.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { handover } from '../systems/inheritance.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';
import { livelihoodActions } from './livelihood.js';
import { educationActions } from './education.js';
import { researchActions } from './research.js';
import { craftActions } from './crafts.js';
import { societyActions } from './society.js';
import { developmentActions } from './development.js';

export function actionDefinitions(state: GameState, rules: Ruleset): ActionDefinition[] {
  if (state.status === 'complete' || state.status === 'ended') return [];
  if (state.status === 'handover') {
    const eraEnd=!!state.era&&state.era.index<3&&state.clock.generation+1-state.era.startGeneration>=state.era.rules.generationLimit;
    return [defineAction(state, 'handover', eraEnd?'结束本时代，开始新人物':'交接给后辈', '传承', { ap: 0 }, [], eraEnd?'结清本时代实际回报，下一时代从无亲属关系的新随机角色开始；个人知识从基础开始。':'保留后辈真实学习状态、家学、资产和未完项目；前代个人能力不会复制。', (draft, events) => handover(draft, rules, events))];
  }
  if(state.economy)return [...eraActions(state),...socialFoodActions(state),...industryActions(state),...lifeActions(state),...branchActions(state,rules),...economyActions(state,rules)].filter(a=>!state.economy?.branches||!branchActionNeeds(state,a.offer.id).some(reason=>reason.includes('尚未')||reason.includes('当前仅')));
  return [...livelihoodActions(state, rules), ...craftActions(state, rules), ...educationActions(state, rules), ...societyActions(state, rules), ...researchActions(state, rules), ...developmentActions(state,rules), ...productNetworkActions(state,rules), defineAction(state, 'end-turn', '结束本季', '回合', { ap: 0 }, [], `消耗 ${rules.parameters.foodPerTurn} 口粮，结算生活${rules.production ? '与余粮损耗' : ''}。剩余行动点不结转。`, () => {})];
}
