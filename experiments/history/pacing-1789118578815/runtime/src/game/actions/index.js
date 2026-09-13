import { productNetworkActions } from './product-network.js';
import { handover } from '../systems/inheritance.js';
import { defineAction } from './definition.js';
import { livelihoodActions } from './livelihood.js';
import { educationActions } from './education.js';
import { researchActions } from './research.js';
import { craftActions } from './crafts.js';
import { societyActions } from './society.js';
import { developmentActions } from './development.js';
export function actionDefinitions(state, rules) {
    if (state.status === 'complete' || state.status === 'ended')
        return [];
    if (state.status === 'handover')
        return [defineAction(state, 'handover', '交接给后辈', '传承', { ap: 0 }, [], '保留后辈真实学习状态、家学、资产和未完项目；前代个人能力不会复制。', (draft, events) => handover(draft, rules, events))];
    return [...livelihoodActions(state, rules), ...craftActions(state, rules), ...educationActions(state, rules), ...societyActions(state, rules), ...researchActions(state, rules), ...developmentActions(state, rules), ...productNetworkActions(state, rules), defineAction(state, 'end-turn', '结束本季', '回合', { ap: 0 }, [], `消耗 ${rules.parameters.foodPerTurn} 口粮，结算生活${rules.production ? '与余粮损耗' : ''}。剩余行动点不结转。`, () => { })];
}
