import { methodBlockers } from '../systems/crafts.js';
import { activePerson, addUnique, channel } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { has } from '../systems/learning.js';
import { harvestPreview } from '../systems/production.js';
import { sampleTrial } from '../systems/projects.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';

export function livelihoodActions(state: GameState, rules: Ruleset): ActionDefinition[] {
  const p = rules.parameters, crop = harvestPreview(state, rules), canal = channel(state);
  const purchase=2;
  return [
    ...(rules.householdProgress?[defineAction(state,'buy-food-bulk','储备采购：买入4口粮','生活',{money:4*p.foodPrice},[...(!(state.production?.storage.woodenware||state.production?.storage.pottery)?['需先配置储存容器']:[]),...(state.production!.market.food<4?['当地可售粮食不足4']:[])],'有储存条件后集中采购；仍按原单价付款并扣除4份市场粮食。',(draft,events)=>{draft.production!.market.food-=4;draft.household.food+=4;events.push({type:'food-purchased',amount:4});})]:[]),
    defineAction(state, 'cultivate', '耕作并记录', '生活', {}, state.location.season.cultivated ? ['本季已耕作'] : [], `本季可得 ${crop.food} 口粮；引水 ${crop.drawn}，试验地占用 ${crop.landCost}。结果由当前天气、种源和设施计算。`, (draft, events) => {
      const result = harvestPreview(draft, rules);
      if(draft.development&&draft.development.fieldDurability>0&&result.gross>0){draft.development.fieldDurability--;events.push({type:'field-equipment-used',remaining:draft.development.fieldDurability});}
      sampleTrial(draft, rules, events);
      if(draft.productNetwork && result.storedDrawn){draft.productNetwork.storedWater-=result.storedDrawn;events.push({type:'stored-water-used',amount:result.storedDrawn});}
      draft.household.food += result.food; draft.location.water -= result.drawn;
      const asset = channel(draft);
      if (result.drawn > 0 && asset) { asset.durability--; draft.location.season.usedChannel = true; }
      draft.location.season.cultivated = true;
      addUnique(activePerson(draft).practices, 'cultivation');
      if (draft.location.weather === 'dry') addUnique(activePerson(draft).insights, 'observation');
      events.push({ type: 'harvest', food: result.food, drawn: result.drawn, deficit: result.deficit, channelExhausted: asset?.durability === 0 });
    }),
    defineAction(state, 'work', '为邻里做工', '生活', {}, state.production?.market.jobs === 0 ? ['本季岗位已用完'] : [], `收入 ${p.workIncome} 钱财。${state.production ? `本季剩余岗位 ${state.production.market.jobs}。` : ''}`, (draft, events) => { if (draft.production) draft.production.market.jobs--; draft.household.money += p.workIncome; events.push({ type: 'income', source: 'work', amount: p.workIncome }); }),
    defineAction(state, 'buy-food', `买入 ${purchase} 口粮`, '生活', { money: purchase * p.foodPrice }, state.production && state.production.market.food < purchase ? ['当地可售粮食不足'] : [], `用于家庭生活或实践；交易也占用行动点。${state.production ? `当前市场余粮 ${state.production.market.food}。` : ''}`, (draft, events) => { if (draft.production) draft.production.market.food -= purchase; draft.household.food += purchase; events.push({ type: 'food-purchased', amount: purchase }); }),
    defineAction(state, 'sell-food', '卖出 2 口粮', '生活', { food: 2 }, state.production && state.production.market.food + 2 > rules.scenarios[state.location.id].production!.market.food ? ['当地粮食收购容量已满'] : [], `收入 ${p.foodPrice} 钱财；不能买卖套利。`, (draft, events) => { if (draft.production) draft.production.market.food += 2; draft.household.money += p.foodPrice; events.push({ type: 'income', source: 'sale', amount: p.foodPrice }); }),
    defineAction(state, 'build-channel', '建设家用引水渠', '设施', { ap: 2, money: p.channelCost }, [
      ...(rules.householdProgress?methodBlockers(state,rules,'ditch'):!has(activePerson(state), 'ditch') ? ['需要掌握渠道布局'] : []), ...(canal ? ['渠道已经存在，请维修'] : []),
    ], ` ${rules.householdProgress?'可作为受指导的渠道实践，建造后记录实践；':''}建成后耐用 ${p.channelDurability} 次实际引水；缺水时耕作自动使用。`, (draft, events) => {
      if(rules.householdProgress){addUnique(activePerson(draft).practices,'channel-model');events.push({type:'practiced',personId:activePerson(draft).id,nodeId:'ditch',practiceId:'channel-model'});}
      const id = 'channel:household-1';
      draft.assets[id] = { id, kind: 'channel', durability: p.channelDurability }; draft.household.assetIds.push(id);
      events.push({ type: 'channel-changed', operation: 'build', assetId: id, durability: p.channelDurability });
    }),
    defineAction(state, 'repair-channel', '维修引水渠', '设施', { money: p.repairCost }, [...(!canal ? ['尚无渠道'] : []), ...(canal?.durability === p.channelDurability ? ['渠道完好'] : [])], '基础维护可向当地匠人求助，不要求继承人已会设计渠道。', (draft, events) => {
      const asset = channel(draft); if (!asset) throw new Error('渠道不存在');
      asset.durability = p.channelDurability;
      events.push({ type: 'channel-changed', operation: 'repair', assetId: asset.id, durability: p.channelDurability });
    }),
  ];
}
