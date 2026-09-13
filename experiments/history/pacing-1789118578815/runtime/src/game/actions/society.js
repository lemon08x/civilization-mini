import { activePerson, addUnique } from '../model/state.js';
import { MATERIAL_NAMES, WORKSHOP_NAMES } from '../model/production.js';
import { recipeMethod } from '../systems/crafts.js';
import { defineAction } from './definition.js';
export function societyActions(state, rules) {
    if (!state.society || !rules.socialInheritance)
        return [];
    const s = state.society, actions = [];
    for (const tech of rules.technologies) {
        const practical = (s.teaching[tech.id] ?? 0) >= 1;
        const materialPractice = practical && ['woodworking', 'controlled-fire', 'pottery'].includes(tech.id);
        actions.push(defineAction(state, `share:${tech.id}`, `${practical ? '指导邻里实践' : '向邻里讲授'}：${tech.name}`, '社会', {
            ...(materialPractice ? { materials: { wood: 1, ...(tech.id === 'pottery' ? { clay: 1 } : {}) } } : {}),
            money: practical && !materialPractice ? rules.parameters.trainingCost : 0,
        }, [...(!activePerson(state).mastered.includes(tech.id) ? ['需本人掌握方法'] : []), ...(s.methods.includes(tech.id) ? ['当地传授已完成'] : [])], '两次传授形成当地教学来源；工艺实践耗材料且不产商品。完成木作或陶作传授后，可委托学成匠人。不会授予后辈个人技能。', (draft, events) => {
            const social = draft.society;
            social.teaching[tech.id] = (social.teaching[tech.id] ?? 0) + 1;
            const completed = social.teaching[tech.id] >= 2;
            if (completed) {
                addUnique(social.methods, tech.id);
                addUnique(draft.location.teachers, tech.id);
            }
            events.push({ type: 'social-taught', nodeId: tech.id, completed });
        }));
    }
    for (const material of ['woodenware', 'pottery']) {
        const c = s.contracts[material];
        actions.push(defineAction(state, `entrust:${material}`, `委托匠人经营${WORKSHOP_NAMES[material]}`, '社会', {}, [
            ...(!state.production.workshops?.[material] ? ['需家族已建成对应设施'] : []), ...(!s.methods.includes(recipeMethod(material)) ? ['需先完成对应工艺的邻里传授'] : []),
            ...(c.active ? ['委托已生效'] : []), ...(state.production.project ? ['先完成家庭在制项目'] : []),
        ], `每次开工付 ${rules.socialInheritance.wage} 钱工资，匠人从当地取得配方原料；之后季末完工并按剩余订单出售，家族收货款。设施不能同时用于个人批量制作。`, (draft, events) => {
            draft.society.contracts[material].active = true;
            events.push({ type: 'contract-changed', material, active: true });
        }));
        actions.push(defineAction(state, `pause-contract:${material}`, `暂停${WORKSHOP_NAMES[material]}委托`, '社会', {}, c.active ? [] : ['当前没有生效的委托'], '暂停不再扣工资或原料，在制品保留且占用设施；恢复委托才继续完工。', (draft, events) => {
            draft.society.contracts[material].active = false;
            events.push({ type: 'contract-changed', material, active: false });
        }));
        const price = material === 'woodenware' ? rules.production.parameters.woodenwarePrice : rules.production.parameters.potteryPrice;
        actions.push(defineAction(state, `buy-good:${material}`, `购买公共库存中的${MATERIAL_NAMES[material]}`, '交换', { money: price }, s.goods[material] > 0 ? [] : ['公共商品库存为空'], '取得一件实物，不授予制造技能；学习储存后可配置。商品来自已完成的当地销售。', (draft, events) => {
            draft.society.goods[material]--;
            draft.production.inventory[material]++;
            events.push({ type: 'public-purchased', material, price });
        }));
    }
    return actions;
}
