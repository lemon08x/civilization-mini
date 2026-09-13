import { skillLevel } from '../systems/development.js';
import { activePerson, addUnique } from '../model/state.js';
import { MATERIAL_NAMES, RECIPE_NAMES, WORKSHOP_NAMES } from '../model/production.js';
import { gatherPreview, methodBlockers, recipeMethod, storageCapacity } from '../systems/crafts.js';
import { defineAction } from './definition.js';
export function craftActions(state, rules) {
    if (!state.production || !rules.production)
        return [];
    const local = state.production, p = rules.production.parameters, actions = [];
    if (rules.technologyFeedback) {
        const config = rules.technologyFeedback;
        for (const material of ['woodenware', 'pottery']) {
            const mastered = activePerson(state).mastered.includes(recipeMethod(material));
            actions.push(defineAction(state, `build-workshop:${material}`, `建造${WORKSHOP_NAMES[material]}`, '设施', {
                ap: config.buildActions, materials: material === 'woodenware' ? { wood: config.workbenchWood } : { wood: config.kilnWood, clay: config.kilnClay },
            }, [...(!mastered ? ['需本人掌握对应手艺'] : []), ...(local.workshops?.[material] ? ['设施已经建成'] : [])], '建成后开放批量制作：同等原料、两倍产品，制作仍需两次行动。设施跨代保留，新开批量项目仍需本人掌握手艺。', (draft, events) => {
                draft.production.workshops[material] = true;
                events.push({ type: 'workshop-built', material });
            }));
            actions.push(defineAction(state, `craft-batch:${material}`, `批量制作${MATERIAL_NAMES[material]}（${material === 'pottery' ? 4 : 2} 件）`, '制作', {
                materials: material === 'woodenware' ? { wood: p.woodRecipeCost * 2 } : { wood: p.potteryFuelCost * 2, clay: p.potteryClayCost * 2 },
            }, [...(!mastered ? ['需本人掌握对应手艺'] : []), ...(!local.workshops?.[material] ? [`需先建造${WORKSHOP_NAMES[material]}`] : []), ...(local.project || state.development?.project || state.productNetwork?.project ? ['先完成当前制作项目'] : []), ...(state.society?.contracts[material].active || state.society?.contracts[material].project ? ['设施由受托匠人或其在制品占用'] : [])], `支付两份配方原料，再花一次行动完工；比两次普通制作少 2 制作行动，建设、采料与销售另计。${material === 'pottery' ? '仍需跨季干燥。' : ''}`, (draft, events) => {
                draft.production.project = { recipe: material, started: draft.clock.absoluteTurn, stage: 'shaped', method: recipeMethod(material), batch: true };
                events.push({ type: 'craft-started', recipe: material, started: draft.clock.absoluteTurn, batch: true });
            }));
        }
    }
    for (const resource of ['food', 'wood', 'clay']) {
        const amount = gatherPreview(state, rules, resource), name = resource === 'food' ? '野生食物' : MATERIAL_NAMES[resource];
        actions.push(defineAction(state, `gather:${resource}`, `采集${name}`, '获取', {}, amount ? [] : ['当地可采资源已经耗尽'], `本次取得 ${amount}；扣减当地库存。${resource === 'clay' ? '黏土在本次窗口内不恢复。' : '下季按环境条件有限恢复。'}${resource === 'wood' && local.toolDurability > 0 ? '使用工具并消耗一次耐用度。' : ''}`, (draft, events) => {
            const production = draft.production, count = gatherPreview(draft, rules, resource);
            const key = resource === 'food' ? 'wildFood' : resource === 'wood' ? 'timber' : 'clay';
            const toolUsed = resource === 'wood' && production.toolDurability > 0;
            production.stocks[key] -= count;
            if (resource === 'food')
                draft.household.food += count;
            else
                production.inventory[resource] += count;
            if (toolUsed)
                production.toolDurability--;
            events.push({ type: 'resource-gathered', resource, amount: count, remaining: production.stocks[key], toolUsed });
        }));
    }
    for (const recipe of ['woodenware', 'pottery', 'gather-tool']) {
        const materials = recipe === 'pottery' ? { clay: p.potteryClayCost, wood: p.potteryFuelCost } : { wood: p.woodRecipeCost };
        const fluent = Boolean(rules.householdProgress && recipe !== 'pottery' && skillLevel(state, rules, 'woodwork') >= 1);
        actions.push(defineAction(state, `craft:${recipe}`, `${fluent ? '熟练制作' : '开始制作'}${RECIPE_NAMES[recipe]}`, '制作', { materials }, [
            ...methodBlockers(state, rules, recipeMethod(recipe)), ...(local.project || state.development?.project || state.productNetwork?.project ? ['先完成当前制作项目'] : []),
            ...(recipe === 'gather-tool' && local.toolDurability > 0 ? ['现有采集工具仍可使用'] : []),
        ], fluent ? '熟练木作：支付完整木材，1行动完成实物；不占用跨季项目。' : recipe === 'pottery' ? '支付黏土和燃料，成形后跨季干燥，再花一次行动烧制 2 件陶器。' : `支付木材并成形，再花一次行动装配${RECIPE_NAMES[recipe]}。`, (draft, events) => {
            draft.production.project = { recipe, started: draft.clock.absoluteTurn, stage: 'shaped', method: recipeMethod(recipe) };
            events.push({ type: 'craft-started', recipe, started: draft.clock.absoluteTurn });
            if (fluent) {
                if (recipe === 'gather-tool')
                    draft.production.toolDurability = p.toolDurability;
                else
                    draft.production.inventory[recipe]++;
                draft.production.project = null;
                addUnique(activePerson(draft).practices, 'wood-shaped');
                events.push({ type: 'craft-completed', recipe, amount: 1 });
            }
        }));
    }
    const project = local.project;
    actions.push(defineAction(state, 'finish-craft', project ? `完成${RECIPE_NAMES[project.recipe]}` : '完成制作项目', '制作', {}, [
        ...(!project ? ['没有在制项目'] : []), ...(project?.recipe === 'pottery' && state.clock.absoluteTurn <= project.started ? ['陶坯需要跨季干燥'] : []),
    ], '按已布置的方法完成常规工序；原料已在开工时支付，项目可由后辈接续。', (draft, events) => {
        const production = draft.production, task = production.project;
        const amount = (task.recipe === 'pottery' ? 2 : 1) * (task.batch ? 2 : 1);
        if (task.recipe === 'gather-tool')
            production.toolDurability = p.toolDurability;
        else
            production.inventory[task.recipe] += amount;
        addUnique(activePerson(draft).practices, task.recipe === 'pottery' ? 'pot-fired' : 'wood-shaped');
        production.project = null;
        events.push({ type: 'craft-completed', recipe: task.recipe, amount, ...(task.batch ? { batch: true } : {}) });
    }));
    for (const material of ['woodenware', 'pottery']) {
        const price = material === 'woodenware' ? p.woodenwarePrice : p.potteryPrice;
        actions.push(defineAction(state, `sell-good:${material}`, `出售一件${MATERIAL_NAMES[material]}`, '交换', { materials: { [material]: 1 } }, [...(local.market[material] > 0 ? [] : ['本季当地需求已满足']), ...(state.society && state.society.goods[material] >= rules.socialInheritance.goodsCapacity ? ['公共商品库存已满'] : [])], `获得 ${price} 钱财，消耗一个当地订单；本季尚有 ${local.market[material]} 个订单。`, (draft, events) => {
            draft.production.market[material]--;
            draft.household.money += price;
            if (draft.society)
                draft.society.goods[material]++;
            events.push({ type: 'goods-sold', material, amount: 1, earnings: price });
        }));
        actions.push(defineAction(state, `install-storage:${material}`, `配置${MATERIAL_NAMES[material]}储存`, '保存', { materials: { [material]: 1 } }, [
            ...methodBlockers(state, rules, 'storage'), ...(local.storage[material] ? ['这类储存容器已配置'] : []),
        ], `额外保护 ${material === 'woodenware' ? p.woodenStorage : p.potteryStorage} 余粮；每类最多一件。配置是实际储存实践。`, (draft, events) => {
            draft.production.storage[material] = true;
            addUnique(activePerson(draft).practices, 'storage-fitted');
            events.push({ type: 'storage-installed', material, capacity: storageCapacity(draft, rules) });
        }));
    }
    for (const id of rules.scenarios[state.location.id].production.imports) {
        const tech = rules.technologies.find(t => t.id === id);
        actions.push(defineAction(state, `buy-method:${id}`, `取得外来方法：${tech.name}`, '交换', { money: p.methodPrice }, [
            ...(local.market.methods < 1 ? ['本季方法交换机会已用完'] : []), ...(state.knowledge.archives.includes(id) ? ['家庭已有这份方法'] : []),
        ], '通过外部交换取得完整方法；提供学习与指导渠道，不直接授予技能。', (draft, events) => {
            draft.production.market.methods--;
            addUnique(draft.knowledge.archives, id);
            events.push({ type: 'method-acquired', nodeId: id });
        }));
    }
    return actions;
}
